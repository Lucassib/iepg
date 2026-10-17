# The production image: the FastAPI backend serving the API and the built frontend on port 8080.
# Build it with scripts/release.sh, which first builds frontend/dist and bundles the thesis files into build/thesis.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    IEPG_ENV=production \
    IEPG_THESIS_DIR=/app/thesis \
    IEPG_DIST_DIR=/app/frontend/dist

# the commit of the code in the image: the page Algorithms links its Python functions to it on GitHub
ARG IEPG_COMMIT=main
ENV IEPG_COMMIT=${IEPG_COMMIT}

RUN groupadd --system --gid 10001 iepg && useradd --system --uid 10001 --gid iepg --home-dir /nonexistent --shell /usr/sbin/nologin iepg

WORKDIR /app
COPY backend/requirements.lock /app/requirements.lock
RUN pip install -r /app/requirements.lock && pip check

COPY backend/iepg /app/backend/iepg
COPY backend/data /app/backend/data
COPY build/thesis /app/thesis
COPY frontend/dist /app/frontend/dist

# the code and the data are read-only for the user that runs the server
RUN python -m compileall -q /app/backend/iepg && chmod -R a-w /app
USER iepg

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(urllib.request.urlopen('http://127.0.0.1:8080/api/v1/health', timeout=4).status != 200)"

CMD ["uvicorn", "iepg.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8080", \
     "--workers", "1", "--no-access-log", "--no-server-header", "--timeout-keep-alive", "5", "--limit-concurrency", "200"]
