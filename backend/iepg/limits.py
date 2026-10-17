"""A hard time limit for the computations of the API.

The input limits of main.py bound the size of every computation, but the time of the exact root isolation (the
latent values, a user matrix in the analysis) also grows with the size of the entries. To guarantee that no request
holds the CPU for long, each computation runs in a child process forked from the server, which is killed after
`seconds`; the visitor then gets a 422 asking for a smaller input.

Forking is cheap on Linux (the child shares the memory of the server, including the caches warmed at start-up).
It is on by default in production on Linux, off elsewhere (the tests on macOS run the functions inline); the
variable IEPG_TIME_LIMITS=1 or 0 forces it.
"""
from __future__ import annotations

import functools
import multiprocessing
import os
import sys

from fastapi import HTTPException

from . import config

_env = os.environ.get("IEPG_TIME_LIMITS")
ENABLED = (_env == "1") if _env in ("0", "1") else (config.PRODUCTION and sys.platform.startswith("linux"))
DEFAULT_SECONDS = 10.0


def _child(conn, fn, args, kwargs):
    try:
        conn.send(("ok", fn(*args, **kwargs)))
    except HTTPException as e:
        conn.send(("http", e.status_code, e.detail))
    except BaseException as e:  # noqa: BLE001 - reported to the parent as a 500
        conn.send(("err", f"{type(e).__name__}: {e}"[:300]))
    finally:
        conn.close()


def run_limited(fn, args, kwargs, seconds: float):
    ctx = multiprocessing.get_context("fork")
    parent, child = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_child, args=(child, fn, args, kwargs), daemon=True)
    proc.start()
    child.close()
    msg = None
    try:
        if parent.poll(seconds):
            msg = parent.recv()
    except EOFError:
        msg = ("err", "the computation stopped unexpectedly")
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(2)
        parent.close()
    if msg is None:
        raise HTTPException(422, dict(code="TOO_SLOW", detail=f"this computation takes more than {seconds:.0f} s on the server; "
                                                              "try a smaller tree or smaller entries"))
    if msg[0] == "ok":
        return msg[1]
    if msg[0] == "http":
        raise HTTPException(msg[1], msg[2])
    raise RuntimeError(msg[1])


def time_limited(seconds: float = DEFAULT_SECONDS):
    """Decorator for a synchronous endpoint (FastAPI runs it in a worker thread, which waits for the child)."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if not ENABLED:
                return fn(*args, **kwargs)
            return run_limited(fn, args, kwargs, seconds)
        return wrapper
    return deco
