# Deployment

The site is a single container: the FastAPI backend serves the API and the built frontend on port 8080. There is no
database, no user account and no secret. The public instance runs at https://iepg.mat.br on Fly.io.

## What the image needs

- `build/thesis`: the compiled copy of the thesis that the backend reads (theorem numbers, statements, glossary,
  notation). It is made by `scripts/bundle_thesis.py --source DIR` from the LaTeX sources of the thesis, which are not
  in this repository, and needs `tectonic`. Without it the backend does not start.
- `frontend/dist`: the built frontend (`npm ci && npm run build` in `frontend/`).

## Build and check locally

```bash
scripts/release.sh            # backend tests, frontend build, thesis bundle, Docker image, smoke test of the container
docker run --rm -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp iepg:release
```

`scripts/smoke_test.py URL` checks a running server from outside: pages, API, security headers, paths outside the site
and the time limit of the computations.

## Configuration

| Variable | Meaning |
|---|---|
| `IEPG_ENV=production` | set in the image: interactive API docs off, HSTS on, hard time limit of 10 s per computation |
| `IEPG_CLIENT_IP_HEADER` | the header with the visitor's address behind a proxy, for the rate limits (`Fly-Client-IP` on Fly.io) |
| `IEPG_RATE_LIMITS=0` | turns the rate limits off, for load tests only |
| `IEPG_COMMIT` (build argument) | the commit the page Algorithms links to on GitHub; defaults to `main` |

## Publishing on Fly.io

`fly.toml` describes one machine with a health check on `/api/v1/health` and a blue-green deployment: the new machine
takes the traffic only after it passes the check. Push the commit before deploying, so that the links of the page
Algorithms exist on GitHub:

```bash
git push
scripts/release.sh
fly deploy --ha=false --remote-only --build-arg IEPG_COMMIT=$(git rev-parse HEAD)
backend/.venv/bin/python scripts/smoke_test.py https://iepg.mat.br
```

## Security in short

Strict Content Security Policy (only the site itself), `nosniff`, no framing, HSTS; request bodies up to 64 kB; rate
limits per visitor; at most three computations at once, each with input limits and a hard time limit in a separate
process; a container without root and with a read-only file system; logs without addresses or parameters.
