"""Configuration management for the Agent Pixelate Orchestrator."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed environment settings loaded from process env and optional `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Agent Pixelate Orchestrator"
    app_version: str = "1.0.0"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # Server & CORS
    orchestrator_host: str = Field(default="0.0.0.0")
    orchestrator_port: int = Field(default=8000)
    orchestrator_public_url: str = Field(default="http://localhost:8000")
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000"
    )

    # Persistent campaign & media asset storage (Agent37 persistent volume mount)
    campaign_data_dir: str = Field(default="/data/campaigns")

    # BAND (band.ai) Multi-Agent Room & Memory Integration
    band_api_key: str | None = Field(default=None)
    band_visual_agent_key: str | None = Field(default=None)
    band_copy_agent_key: str | None = Field(default=None)
    band_rest_url: str = Field(default="https://app.band.ai")
    band_ws_url: str = Field(default="wss://app.band.ai/api/v1/socket/websocket")
    band_request_timeout_s: float = Field(default=15.0)
    band_fallback_on_error: bool = Field(
        default=True,
        description="If Band API is unreachable, gracefully fall back to in-memory event bus.",
    )

    # Downstream Agents microservice (optional in standalone local dev)
    agents_service_url: str | None = Field(default=None)
    agents_dispatch_timeout_s: float = Field(default=90.0)
    enable_local_agent_fallback: bool = Field(
        default=True,
        description="Run local visual/copy fallback synthesis if agents service is not running.",
    )

    # Sponsor / Model Provider keys (forwarded/checked in diagnostics)
    agent37_api_key: str | None = Field(default=None)
    adal_api_key: str | None = Field(default=None)
    finch_api_key: str | None = Field(default=None)
    openai_api_key: str | None = Field(default=None)
    gemini_api_key: str | None = Field(default=None)

    # WebSocket keepalive interval
    ws_heartbeat_interval_s: float = Field(default=20.0)

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return origins or ["*"]

    @property
    def band_enabled(self) -> bool:
        return bool(self.band_api_key and self.band_api_key.strip())

    def resolve_data_dir(self) -> Path:
        """Resolve writable campaign storage path.

        Uses `/data/campaigns` inside Docker / Agent37 sandboxes, and falls back
        to a local `./data/campaigns` folder if the configured root path is not
        writable on a local developer machine (e.g., Windows without `/data`).
        """
        configured = Path(self.campaign_data_dir)
        # On Windows, a POSIX absolute path like "/data/campaigns" points to the drive root.
        # Prefer a writable local directory unless explicitly writable and non-POSIX-root.
        if os.name == "nt" and self.campaign_data_dir.startswith("/"):
            fallback = Path.cwd() / "data" / "campaigns"
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback

        try:
            configured.mkdir(parents=True, exist_ok=True)
            probe = configured / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return configured
        except OSError:
            fallback = Path.cwd() / "data" / "campaigns"
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton settings loader."""
    return Settings()
