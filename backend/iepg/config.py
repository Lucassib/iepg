"""Settings read from the environment, so that the same code runs in development and in the container.

IEPG_ENV              "production" turns off the interactive API docs and turns on HSTS.
IEPG_THESIS_DIR       the thesis sources (main.tex, the .aux files, bib/, usr/). Default: the compiled copy in
                      build/thesis (made by scripts/bundle_thesis.py) when it exists, else ../../tese/Tese_fable_51.
                      The application never writes in the thesis folder; its .aux files can be older than the .tex
                      (tectonic keeps them only on request), so the compiled copy is the one with current numbers.
IEPG_DIST_DIR         the built frontend. Default: ../frontend/dist.
IEPG_CLIENT_IP_HEADER the header that carries the visitor's address behind a proxy (Fly-Client-IP on Fly.io,
                      CF-Connecting-IP behind the Cloudflare proxy). Unset: the address of the TCP peer.
IEPG_CORS_ORIGINS     comma-separated origins allowed to call the API from another site. Unset: none.
IEPG_RATE_LIMITS      "0" turns the rate limits off (tests of throughput). Default: on.
"""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

_HERE = Path(__file__).resolve()
ROOT = _HERE.parents[3]  # .../Bricks, in development

PRODUCTION = os.environ.get("IEPG_ENV", "").lower() == "production"
THESIS_SOURCE = ROOT / "tese" / "Tese_fable_51"  # read only
_BUNDLE = _HERE.parents[2] / "build" / "thesis"
THESIS = Path(os.environ.get("IEPG_THESIS_DIR") or (_BUNDLE if (_BUNDLE / "main.tex").exists() else THESIS_SOURCE))


def thesis_date() -> str:
    """The date of the thesis the application reads: the last change of its .tex files, as recorded by the bundle."""
    stamp = THESIS / "BUNDLE.json"
    if stamp.exists():
        try:
            d = json.loads(stamp.read_text()).get("thesis_date")
            if d:
                return d
        except ValueError:
            pass
    texs = list(THESIS.rglob("*.tex"))
    return date.fromtimestamp(max(p.stat().st_mtime for p in texs)).isoformat() if texs else "unknown"


def thesis_changed_since_bundle() -> list:
    """The .tex files of the thesis folder newer than the compiled copy in use (empty when up to date)."""
    stamp = THESIS / "BUNDLE.json"
    if not stamp.exists() or not THESIS_SOURCE.exists():
        return []
    t = stamp.stat().st_mtime
    return sorted(str(p.relative_to(THESIS_SOURCE)) for p in THESIS_SOURCE.rglob("*.tex")
                  if p.stat().st_mtime > t and (THESIS / p.relative_to(THESIS_SOURCE)).exists())
DIST = Path(os.environ.get("IEPG_DIST_DIR") or _HERE.parents[2] / "frontend" / "dist")
CLIENT_IP_HEADER = (os.environ.get("IEPG_CLIENT_IP_HEADER") or "").strip().lower() or None
CORS_ORIGINS = [o.strip() for o in (os.environ.get("IEPG_CORS_ORIGINS") or "").split(",") if o.strip()]
RATE_LIMITS = os.environ.get("IEPG_RATE_LIMITS", "1") != "0"
