"""The guard, the static route and the input limits: what a public deployment relies on."""
import asyncio
import json
import random
import time

import pytest
from fastapi.testclient import TestClient

from iepg import config
from iepg.main import app
from iepg.security import Guard, RateLimiter

c = TestClient(app)
HAS_DIST = (config.DIST / "index.html").exists()


# ---- the static route --------------------------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_DIST, reason="the frontend is not built")
@pytest.mark.parametrize("path", [
    "/..%2F..%2Fbackend%2Frequirements.txt",
    "/%2e%2e/%2e%2e/backend/requirements.txt",
    "/..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd",
    "/assets/..%2F..%2F..%2Fbackend%2Frequirements.txt",
    "/assets/%2e%2e/%2e%2e/index.html",
])
def test_no_file_outside_dist(path):
    r = c.get(path)
    assert "fastapi" not in r.text and "root:" not in r.text
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        assert r.text.lstrip().lower().startswith("<!doctype html>")


def test_unknown_api_is_404_json():
    r = c.get("/api/v1/nothing-here")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "NOT_FOUND"


def test_health():
    assert c.get("/api/v1/health").json() == {"ok": True}


# ---- headers -----------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("path", ["/api/v1/meta", "/"])
def test_security_headers(path):
    r = c.get(path)
    h = r.headers
    assert "default-src 'self'" in h["content-security-policy"]
    assert "script-src 'self'" in h["content-security-policy"]
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "cache-control" in h


def test_cors_closed_by_default():
    r = c.get("/api/v1/meta", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


# ---- body size ---------------------------------------------------------------------------------------------------

def test_body_too_large():
    r = c.post("/api/v1/trees/parse", content=b"x" * (65 * 1024), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_chunked_body_too_large():
    def gen():
        for _ in range(70):
            yield b" " * 1024
    r = c.post("/api/v1/trees/parse", content=gen(), headers={"content-type": "application/json"})
    assert r.status_code == 413


# ---- rate limits and the queue of computations -------------------------------------------------------------------

async def _ok_app(scope, receive, send):
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"{}"})


def _run(guard, method="GET", path="/", client=("1.2.3.4", 1)):
    out = {}

    async def receive():
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(m):
        if m["type"] == "http.response.start":
            out["status"] = m["status"]
            out["headers"] = dict(m["headers"])

    scope = {"type": "http", "method": method, "path": path, "headers": [], "client": client}
    asyncio.run(guard(scope, receive, send))
    return out


def test_rate_limit_per_visitor():
    g = Guard(_ok_app, limiter=RateLimiter({"heavy": (3, 0.001), "light": (5, 0.001)}), rate_limits=True)
    codes = [_run(g, "POST", "/api/v1/latent")["status"] for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert _run(g, "POST", "/api/v1/latent", client=("5.6.7.8", 1))["status"] == 200  # another visitor
    r = _run(g, "POST", "/api/v1/latent")
    assert r["status"] == 429 and b"retry-after" in r["headers"]


def test_busy_when_all_slots_are_taken():
    async def slow(scope, receive, send):
        await asyncio.sleep(0.3)
        await _ok_app(scope, receive, send)

    g = Guard(slow, slots=1, wait=0.05, rate_limits=False)

    async def main():
        results = []

        async def one():
            out = {}

            async def receive():
                return {"type": "http.request", "body": b"{}", "more_body": False}

            async def send(m):
                if m["type"] == "http.response.start":
                    out["status"] = m["status"]

            await g({"type": "http", "method": "POST", "path": "/api/v1/x", "headers": [], "client": ("1.1.1.1", 1)}, receive, send)
            results.append(out["status"])

        await asyncio.gather(one(), one())
        return sorted(results)

    assert asyncio.run(main()) == [200, 503]


# ---- input limits ------------------------------------------------------------------------------------------------

LIMITS = [
    ("/api/v1/admissible", {"set": [str(i * 7) for i in range(23)]}),
    ("/api/v1/admissible", {"set": ["1" * 81, "2", "3"]}),
    ("/api/v1/lab/strong-realization", {"set": [str(i) for i in range(17)]}),
    ("/api/v1/lab/strong-realization", {"set": ["1", "2"]}),
    ("/api/v1/playground/state", {"seed": "S_1000", "d": 1000, "ops": []}),
    ("/api/v1/playground/state", {"seed": "T_1_1", "d": 99, "ops": []}),
    ("/api/v1/playground/state", {"seed": "nonsense", "d": 7, "ops": []}),
    ("/api/v1/playground/generate", {"seed": "S_7", "d": 7, "ops": [], "params": {"alpha": 10 ** 16}}),
    ("/api/v1/playground/generate", {"seed": "S6_1", "d": 6, "ops": [], "params": {"Lambda": [1, 2, 3]}}),
    ("/api/v1/playground/generate", {"seed": "S_7", "d": 7, "ops": [[0, 1]] * 151}),
    ("/api/v1/graphs/cograph", {"expr": {"op": "union", "children": [{"op": "v"}] * 61}}),
    ("/api/v1/graphs/unicyclic", {"n": 5, "edges": [[0, 1, 2]]}),
    ("/api/v1/graphs/unicyclic", {"n": -3, "edges": []}),
]


@pytest.mark.parametrize("path,body", LIMITS)
def test_limits(path, body):
    t = time.time()
    r = c.post(path, json=body)
    assert r.status_code == 422, r.text[:200]
    assert time.time() - t < 2


def test_deep_cograph_is_refused_not_crashed():
    e = {"op": "v"}
    for _ in range(400):
        e = {"op": "union", "children": [e, {"op": "v"}]}
    r = c.post("/api/v1/graphs/cograph", json={"expr": e})
    assert r.status_code == 422


def test_duplications_cannot_grow_past_the_limit():
    # duplicate the largest duplicable branch of S_15 until the tree would pass 200 vertices
    ops = []
    for _ in range(12):
        st = c.post("/api/v1/playground/state", json={"seed": "S_15", "d": 15, "ops": ops})
        if st.status_code != 200:
            break
        dup = st.json()["duplicable"]
        u = max(dup, key=lambda x: int(x))
        ops.append([dup[u], int(u)])
    r = c.post("/api/v1/playground/state", json={"seed": "S_15", "d": 15, "ops": ops})
    assert r.status_code in (200, 422)
    if r.status_code == 200:
        assert r.json()["n"] <= 200


# ---- no 500 on garbage -------------------------------------------------------------------------------------------

ENDPOINTS = ["/api/v1/trees/parse", "/api/v1/trees/fold", "/api/v1/trees/analyze", "/api/v1/diagonalize", "/api/v1/latent",
             "/api/v1/lab/strong-realization", "/api/v1/admissible", "/api/v1/lab/family", "/api/v1/lab/tower",
             "/api/v1/playground/state", "/api/v1/playground/generate", "/api/v1/graphs/unicyclic", "/api/v1/graphs/couple",
             "/api/v1/graphs/threshold", "/api/v1/graphs/cograph"]


def _garbage(rng):
    atoms = [None, True, -1, 0, 3, 10 ** 30, 2.5, "", "x", "1/0", "-7/3", "0-1, 1-2", "S_9", "graph6", [], [1, 2], [[0, 1]], {}, {"op": "v"}]
    keys = ["tree", "format", "data", "root", "matrix", "lam", "k", "set", "alpha", "beta", "delta", "pair", "b", "even", "Lambda",
            "lambda7", "seed", "d", "ops", "params", "n", "edges", "attach", "mode", "sequence", "expr", "canonical", "diag", "w2"]

    def val(depth):
        r = rng.random()
        if depth > 2 or r < 0.55:
            return rng.choice(atoms)
        if r < 0.8:
            return {rng.choice(keys): val(depth + 1) for _ in range(rng.randint(1, 4))}
        return [val(depth + 1) for _ in range(rng.randint(0, 3))]

    return {rng.choice(keys): val(0) for _ in range(rng.randint(1, 5))}


def test_garbage_never_500_and_fast():
    rng = random.Random(20260927)
    slow = []
    for i in range(600):
        path = ENDPOINTS[i % len(ENDPOINTS)]
        body = _garbage(rng)
        t = time.time()
        r = c.post(path, json=body)
        dt = time.time() - t
        assert r.status_code < 500, (path, json.dumps(body)[:300], r.text[:300])
        if dt > 3:
            slow.append((path, body, dt))
    assert not slow, slow[:3]
