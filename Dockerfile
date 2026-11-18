# syntax=docker/dockerfile:1.7
# Agent Pixelate Full-Stack Container (Next.js Static Studio + FastAPI BAND Orchestrator)
# Compatible with Render, Docker, and Agent37 Cloud Sandboxes (non-root user)

# --- Stage 1: Build Next.js 14 Static Frontend Studio ---
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: FastAPI Orchestrator + Served Static Frontend ---
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    CAMPAIGN_DATA_DIR=/data/campaigns \
    FRONTEND_DIST_DIR=/app/frontend/out \
    ORCHESTRATOR_HOST=0.0.0.0 \
    ORCHESTRATOR_PORT=8000 \
    PORT=8000 \
    AGENT37_RUNTIME=gvisor

# Create non-root user and persistent campaign volume mountpoint
RUN groupadd --gid 1000 pixelate \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/sh pixelate \
    && mkdir -p /app /data/campaigns /app/frontend/out \
    && chown -R pixelate:pixelate /app /data/campaigns

WORKDIR /app

# Install Python dependencies
COPY orchestrator/requirements.txt /app/orchestrator/requirements.txt
RUN pip install --no-cache-dir -r /app/orchestrator/requirements.txt

# Copy backend packages and built frontend bundle
COPY --chown=pixelate:pixelate shared /app/shared
COPY --chown=pixelate:pixelate orchestrator /app/orchestrator
COPY --chown=pixelate:pixelate agents /app/agents
COPY --from=frontend-builder --chown=pixelate:pixelate /frontend/out /app/frontend/out

USER pixelate

VOLUME ["/data/campaigns"]
EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; port = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3)" || exit 1

CMD ["sh", "-c", "uvicorn orchestrator.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
