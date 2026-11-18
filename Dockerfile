# syntax=docker/dockerfile:1.7
# Agent Pixelate Orchestrator — gVisor-compatible image for Agent37 Cloud Sandboxes
# Constraints honored:
# - Targets linux/amd64 (Agent37 cloud build target)
# - Runs strictly as unprivileged non-root user (no CAP_SYS_ADMIN / no nested Docker daemon)
# - Persists campaign state & generated media assets under /data/campaigns

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    CAMPAIGN_DATA_DIR=/data/campaigns \
    ORCHESTRATOR_HOST=0.0.0.0 \
    ORCHESTRATOR_PORT=8000 \
    AGENT37_RUNTIME=gvisor

# Create non-root user and persistent campaign volume mountpoint
RUN groupadd --gid 1000 pixelate \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/sh pixelate \
    && mkdir -p /app /data/campaigns \
    && chown -R pixelate:pixelate /app /data/campaigns

WORKDIR /app

# Install Python dependencies first for layer caching
COPY orchestrator/requirements.txt /app/orchestrator/requirements.txt
RUN pip install --no-cache-dir -r /app/orchestrator/requirements.txt

# Copy shared Pydantic v2 schemas and orchestrator runtime
COPY --chown=pixelate:pixelate shared /app/shared
COPY --chown=pixelate:pixelate orchestrator /app/orchestrator

USER pixelate

VOLUME ["/data/campaigns"]
EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

CMD ["uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
