"""
Agent Pixelate — Structured JSON Logging & Observability

Provides machine-readable structured JSON telemetry logs with correlation IDs,
request tracing, agent context, and performance duration metrics.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context variable for distributed request tracing
correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default="system"
)
campaign_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "campaign_id", default="none"
)


class StructuredJsonFormatter(logging.Formatter):
    """Outputs log records formatted as newline-delimited JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get(),
            "campaign_id": campaign_id_ctx.get(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        # Include structured extra properties if passed via logging extra={}
        if hasattr(record, "structured_data") and isinstance(record.structured_data, dict):
            log_entry["data"] = record.structured_data

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def setup_structured_logging(level: str = "INFO") -> None:
    """Initialize structured logging on root logger."""
    root = logging.getLogger()
    root.setLevel(level.upper())

    # Avoid duplicate handlers
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())
    root.addHandler(handler)


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Middleware that assigns a unique correlation ID and logs structured HTTP metrics."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        corr_id = request.headers.get("X-Correlation-ID") or f"trace_{int(time.time()*1000)}"
        token = correlation_id_ctx.set(corr_id)
        start_time = time.perf_counter()

        response: Response
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logging.getLogger("pixelate.http").exception(
                "Unhandled HTTP Exception",
                extra={"structured_data": {"path": request.url.path, "duration_ms": duration_ms}},
            )
            raise
        finally:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            correlation_id_ctx.reset(token)

        response.headers["X-Correlation-ID"] = corr_id
        logging.getLogger("pixelate.http").info(
            f"{request.method} {request.url.path} - {response.status_code} ({duration_ms}ms)",
            extra={
                "structured_data": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            },
        )
        return response
