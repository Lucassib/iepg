#!/usr/bin/env bash
# Builds everything the container needs and checks it, without publishing anything:
#   1. the backend tests, 2. the frontend build, 3. the thesis bundle, 4. the Docker image, 5. a smoke test of the
#   running container (pages, API, security headers, the path that used to leak files).
# Then `fly deploy` publishes (see DEPLOY.md). Commit and push first: the page Algorithms links to the commit in the image.
# Usage, from iepg_app/:  scripts/release.sh [--no-docker]
set -euo pipefail
cd "$(dirname "$0")/.."
PY=backend/.venv/bin/python

echo "== 1/5 backend tests"
(cd backend && .venv/bin/python -m pytest -q tests)

echo "== 2/5 frontend build"
(cd frontend && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null)
test -f frontend/dist/index.html

echo "== 3/5 thesis bundle"
$PY scripts/bundle_thesis.py

if [[ "${1:-}" == "--no-docker" ]]; then echo "skipping the image"; exit 0; fi

# copies such as "index 2.html", left by file synchronization in the generated folders, stay out of the image
find frontend/dist build/thesis -name "* [0-9].*" -delete
if [[ -z "$(git branch -r --contains HEAD 2>/dev/null)" ]]; then
  echo "note: HEAD is not on GitHub yet; the links of the page Algorithms open only after a push"
fi

echo "== 4/5 docker image"
docker build --build-arg IEPG_COMMIT="$(git rev-parse HEAD)" -t iepg:release . >/dev/null

echo "== 5/5 smoke test of the container"
docker rm -f iepg-smoke >/dev/null 2>&1 || true
docker run -d --name iepg-smoke -p 127.0.0.1:18080:8080 --read-only --tmpfs /tmp iepg:release >/dev/null
trap 'docker rm -f iepg-smoke >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 40); do
  curl -sf http://127.0.0.1:18080/api/v1/health >/dev/null && break
  sleep 0.5
done
$PY scripts/smoke_test.py http://127.0.0.1:18080
echo "release ready: image iepg:release"
