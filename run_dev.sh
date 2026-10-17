#!/usr/bin/env bash
# Starts the backend (port 8000) and the frontend dev server (port 5173). Ctrl-C stops both.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt
fi
# a compiled copy of the thesis in build/thesis (the thesis folder is only read)
.venv/bin/python "$HERE/scripts/bundle_thesis.py"
.venv/bin/python -m uvicorn iepg.main:app --reload --port 8000 &
BACK=$!
cd "$HERE/frontend"
if [ ! -d node_modules ]; then npm install; fi
npm run dev -- --port 5173 &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null' EXIT INT TERM
wait
