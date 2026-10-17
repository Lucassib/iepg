"""The guard in front of the application: one ASGI middleware that

  * refuses request bodies over MAX_BODY bytes (413), counting the bytes even without a Content-Length;
  * limits the requests of each visitor with two token buckets, one for the computations (POST /api/...) and one
    for everything else (429 with Retry-After);
  * lets at most HEAVY_SLOTS computations run at once and makes the others wait up to HEAVY_WAIT seconds (503);
  * adds the security headers (CSP, nosniff, frame and referrer policies, HSTS in production) and the cache headers;
  * logs one line per request: method, path, status and time, never the visitor's address or the query string.

Every exact computation of the API is bounded by the input limits of main.py, so a slot is held for at most a few
seconds; the guard keeps many such requests from piling up on a small machine.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Dict, Optional, Tuple

from . import config

log = logging.getLogger("iepg.access")

MAX_BODY = 64 * 1024
HEAVY_SLOTS = 3
HEAVY_WAIT = 20.0
# (capacity, refill per second)
BUCKETS = {"heavy": (40, 1.0), "light": (240, 4.0)}
MAX_VISITORS = 20000

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",  # KaTeX and the SVG figures set style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
])

SECURITY_HEADERS = [
    (b"content-security-policy", CSP.encode()),
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"cross-origin-opener-policy", b"same-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
    # not indexed for now, even when a search engine reaches a page through a link from elsewhere
    (b"x-robots-tag", b"noindex, nofollow"),
]
HSTS = (b"strict-transport-security", b"max-age=31536000; includeSubDomains")


class _Bucket:
    __slots__ = ("tokens", "stamp")

    def __init__(self, capacity: float):
        self.tokens = capacity
        self.stamp = time.monotonic()


class RateLimiter:
    def __init__(self, buckets: Dict[str, Tuple[float, float]] = BUCKETS, max_visitors: int = MAX_VISITORS):
        self.spec = buckets
        self.max_visitors = max_visitors
        self.table: Dict[Tuple[str, str], _Bucket] = {}

    def take(self, visitor: str, kind: str) -> Optional[float]:
        """None when the request may go on, else the seconds to wait."""
        cap, rate = self.spec[kind]
        key = (visitor, kind)
        b = self.table.get(key)
        now = time.monotonic()
        if b is None:
            if len(self.table) >= self.max_visitors:
                self._prune(now)
            b = self.table[key] = _Bucket(cap)
        b.tokens = min(cap, b.tokens + (now - b.stamp) * rate)
        b.stamp = now
        if b.tokens >= 1:
            b.tokens -= 1
            return None
        return (1 - b.tokens) / rate

    def _prune(self, now: float):
        # drop the buckets that are full again (idle visitors); if none is, drop the oldest half
        full = [k for k, b in self.table.items() if b.tokens + (now - b.stamp) * self.spec[k[1]][1] >= self.spec[k[1]][0]]
        for k in full or sorted(self.table, key=lambda k: self.table[k].stamp)[: len(self.table) // 2]:
            del self.table[k]


def _visitor(scope) -> str:
    if config.CLIENT_IP_HEADER:
        h = config.CLIENT_IP_HEADER.encode()
        for k, v in scope.get("headers", []):
            if k == h:
                return v.decode("latin-1").split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


async def _send_json(send, status: int, code: str, detail: str, extra=()):
    body = json.dumps({"detail": {"code": code, "detail": detail}}).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *SECURITY_HEADERS, *extra]
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


def _cache_control(path: str, method: str, status: int) -> bytes:
    if path.startswith("/assets/") and status == 200:
        return b"public, max-age=31536000, immutable"
    if path.startswith("/api/"):
        return b"public, max-age=300" if method == "GET" and status == 200 else b"no-store"
    return b"no-cache"


class Guard:
    def __init__(self, app, *, limiter: Optional[RateLimiter] = None, slots: int = HEAVY_SLOTS, wait: float = HEAVY_WAIT,
                 max_body: int = MAX_BODY, rate_limits: Optional[bool] = None):
        self.app = app
        self.limiter = limiter or RateLimiter()
        self.slots = slots
        self.wait = wait
        self.max_body = max_body
        self.rate_limits = config.RATE_LIMITS if rate_limits is None else rate_limits
        self._sem: Optional[asyncio.Semaphore] = None

    @property
    def sem(self) -> asyncio.Semaphore:
        if self._sem is None:
            self._sem = asyncio.Semaphore(self.slots)
        return self._sem

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        t0 = time.perf_counter()
        method, path = scope["method"], scope["path"]
        heavy = method == "POST" and path.startswith("/api/")
        status = [0]

        # 1. the rate limits
        if self.rate_limits and path != "/api/v1/health":
            wait = self.limiter.take(_visitor(scope), "heavy" if heavy else "light")
            if wait is not None:
                await _send_json(send, 429, "RATE_LIMITED", "too many requests; try again in a few seconds",
                                 [(b"retry-after", str(max(1, round(wait))).encode())])
                return self._log(method, path, 429, t0)

        # 2. the body, read in full up to max_body and replayed to the application
        if method in ("POST", "PUT", "PATCH"):
            for k, v in scope.get("headers", []):
                if k == b"content-length" and v.isdigit() and int(v) > self.max_body:
                    await _send_json(send, 413, "TOO_LARGE", f"the request body is limited to {self.max_body // 1024} kB")
                    return self._log(method, path, 413, t0)
            chunks, size, more = [], 0, True
            while more:
                msg = await receive()
                if msg["type"] == "http.disconnect":
                    return
                chunk = msg.get("body", b"")
                size += len(chunk)
                if size > self.max_body:
                    await _send_json(send, 413, "TOO_LARGE", f"the request body is limited to {self.max_body // 1024} kB")
                    return self._log(method, path, 413, t0)
                chunks.append(chunk)
                more = msg.get("more_body", False)
            body = b"".join(chunks)
            replayed = [False]

            async def receive_replay():
                if not replayed[0]:
                    replayed[0] = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            inner_receive = receive_replay
        else:
            inner_receive = receive

        # 3. the headers of the response
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                status[0] = message["status"]
                headers = [h for h in message.get("headers", []) if h[0] != b"cache-control" or path.startswith("/api/")]
                if not any(h[0] == b"cache-control" for h in headers):
                    headers.append((b"cache-control", _cache_control(path, method, status[0])))
                headers.extend(SECURITY_HEADERS)
                if config.PRODUCTION:
                    headers.append(HSTS)
                message = {**message, "headers": headers}
            await send(message)

        # 4. at most `slots` computations at once
        if heavy:
            try:
                await asyncio.wait_for(self.sem.acquire(), timeout=self.wait)
            except asyncio.TimeoutError:
                await _send_json(send, 503, "BUSY", "the server is busy with other computations; try again shortly", [(b"retry-after", b"5")])
                return self._log(method, path, 503, t0)
            try:
                await self._run(scope, inner_receive, send_with_headers, status, method, path)
            finally:
                self.sem.release()
        else:
            await self._run(scope, inner_receive, send_with_headers, status, method, path)
        self._log(method, path, status[0], t0)

    async def _run(self, scope, receive, send, status, method, path):
        """An unexpected error becomes a short JSON answer with the usual headers, and is logged here."""
        try:
            await self.app(scope, receive, send)
        except Exception:  # noqa: BLE001
            log.exception("unhandled error on %s %s", method, path)
            if status[0]:
                raise
            status[0] = 500
            await _send_json(send, 500, "INTERNAL", "the server could not complete this request")

    @staticmethod
    def _log(method: str, path: str, status: int, t0: float):
        log.info("%s %s %d %.0fms", method, path, status, (time.perf_counter() - t0) * 1000)
