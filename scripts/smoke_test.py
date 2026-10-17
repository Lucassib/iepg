"""Checks a running server (the local container, or the published site) from the outside.

Usage: python scripts/smoke_test.py https://example.org
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
fails = []


def get(path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json"} if body is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def check(name, ok, info=""):
    print(("ok   " if ok else "FAIL ") + name + (f"  ({info})" if info and not ok else ""))
    if not ok:
        fails.append(name)


s, h, b = get("/")
check("home page", s == 200 and b"<div id=\"root\">" in b, s)
check("CSP header", "default-src 'self'" in h.get("Content-Security-Policy", h.get("content-security-policy", "")))
check("nosniff header", h.get("X-Content-Type-Options", h.get("x-content-type-options")) == "nosniff")
s, h, b = get("/playground")
check("client route served by the SPA", s == 200 and b"<div id=\"root\">" in b, s)
s, h, b = get("/robots.txt")
check("robots.txt keeps search engines out", s == 200 and b"Disallow: /\n" in b, s)
s, h, b = get("/api/v1/health")
check("health", s == 200 and json.loads(b) == {"ok": True}, s)
s, h, b = get("/api/v1/meta")
check("meta", s == 200 and "catalog_hash" in json.loads(b), s)
s, h, b = get("/api/v1/statements")
check("statements from the thesis bundle", s == 200 and len(json.loads(b)) > 50, s)
s, h, b = get("/api/v1/trees/analyze", "POST", {"tree": {"format": "catalog", "data": "S6_3"}})
check("analyze S6_3", s == 200, s)
s, h, b = get("/api/v1/playground/generate", "POST", {"seed": "T_2_5", "d": 7, "ops": []})
check("playground generate", s == 200 and json.loads(b).get("ok") is True, s)
for p in ["/..%2F..%2Fbackend%2Frequirements.lock", "/%2e%2e/%2e%2e/etc/passwd", "/assets/..%2F..%2F..%2Fetc%2Fpasswd"]:
    s, h, b = get(p)
    check(f"no file outside the site: {p}", b"root:" not in b and b"fastapi" not in b and s in (200, 404), s)
s, h, b = get("/api/v1/nothing")
check("unknown API path is 404", s == 404, s)
s, h, b = get("/docs")
check("interactive docs off in production", b"swagger" not in b.lower(), s)
s, h, b = get("/api/v1/admissible", "POST", {"set": [str(i) for i in range(41)]})
check("oversized admissibility test refused", s == 422, s)

# the hard time limit: a valid request that takes minutes is cut, and the server keeps answering meanwhile
import threading
import time
from pathlib import Path

slow = json.loads((Path(__file__).parent / "fixtures" / "slow_latent.json").read_text())
res = {}


def run_slow():
    t = time.time()
    res["status"], _, res["body"] = get("/api/v1/latent", "POST", slow)
    res["time"] = time.time() - t


th = threading.Thread(target=run_slow)
th.start()
time.sleep(1.0)
t = time.time()
s, h, b = get("/api/v1/trees/analyze", "POST", {"tree": {"format": "catalog", "data": "S6_3"}})
check("another computation answers while a slow one runs", s == 200 and time.time() - t < 3, f"{s} in {time.time() - t:.1f}s")
th.join(60)
check("the slow computation is stopped by the time limit", res.get("status") == 422 and b"TOO_SLOW" in res.get("body", b"") and res["time"] < 15,
      f"{res.get('status')} after {res.get('time', 0):.1f}s")

print(f"{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
