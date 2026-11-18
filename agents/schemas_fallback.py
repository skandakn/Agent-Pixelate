"""Local fallback Pydantic v2 schemas matching `/shared/schemas.py` exactly.

These stubs are ONLY used when `/shared/schemas.py` has not been merged into
the active branch or PYTHONPATH yet. Every class, enum, validator, and
`ConfigDict(extra="forbid")` matches `/shared/schemas.py` field-for-field so
swapping to `/shared/schemas.py` on merge is 100% seamless.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class AgentHandle(str, Enum):
    """Canonical Band agent handles registered for Agent Pixelate."""

    ORCHESTRATOR = "@orchestrator_pixelate"
    VISUAL = "@visual_pixelate"
    COPY = "@copy_pixelate"


class CampaignStatus(str, Enum):
    """Lifecycle states of an Agent Pixelate marketing campaign."""

    QUEUED = "queued"
    VISUAL_GENERATING = "visual_generating"
    HANDOFF_TO_COPY = "handoff_to_copy"
    COPY_GENERATING = "copy_generating"
    COMPLETED = "completed"
    FAILED = "failed"


class EventType(str, Enum):
    """Structured event types emitted over Band rooms and frontend WebSockets."""

    CAMPAIGN_CREATED = "campaign_created"
    ROOM_INITIALIZED = "room_initialized"
    AGENT_REGISTERED = "agent_registered"
    AGENT_STARTED = "agent_started"
    AGENT_THINKING = "agent_thinking"
    ASSET_GENERATED = "asset_generated"
    MEMORY_STORED = "memory_stored"
    AGENT_MENTION = "agent_mention"
    VISUAL_COMPLETED = "visual_completed"
    COPY_COMPLETED = "copy_completed"
    CAMPAIGN_COMPLETED = "campaign_completed"
    AGENT_ERROR = "agent_error"
    HEARTBEAT = "heartbeat"


class CampaignRequest(BaseModel):
    """Input specification submitted to `POST /api/campaigns/generate`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    brand_name: str = Field(..., min_length=1, max_length=120)
    product_description: str = Field(..., min_length=5, max_length=2000)
    target_audience: str = Field(..., min_length=2, max_length=500)
    campaign_goal: str = Field(
        default="Drive brand awareness and launch-day conversions",
        min_length=2,
        max_length=500,
    )
    brand_tone: str = Field(
        default="Bold, playful, and high-contrast",
        min_length=2,
        max_length=300,
    )
    platforms: list[str] = Field(
        default_factory=lambda: ["instagram", "linkedin", "x", "web_banner"],
        min_length=1,
        max_length=10,
    )
    color_palette: list[str] = Field(default_factory=list, max_length=8)
    num_concepts: int = Field(default=3, ge=1, le=6)
    additional_notes: str | None = Field(default=None, max_length=1500)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("platforms")
    @classmethod
    def normalize_platforms(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            cleaned = item.strip().lower().replace(" ", "_")
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        if not normalized:
            raise ValueError("At least one non-empty platform must be provided.")
        return normalized


class VisualAsset(BaseModel):
    """Metadata and storage reference for a single generated visual asset."""

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(default_factory=lambda: f"asset_{uuid4().hex[:10]}")
    title: str = Field(..., min_length=1, max_length=200)
    platform: str = Field(..., min_length=1, max_length=60)
    aspect_ratio: str = Field(default="1:1", max_length=20)
    prompt_used: str = Field(..., min_length=1, max_length=4000)
    file_path: str | None = Field(default=None)
    asset_url: str = Field(..., min_length=1)
    mime_type: str = Field(default="image/png", max_length=100)
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    color_tokens: list[str] = Field(default_factory=list)
    alt_text: str = Field(default="", max_length=500)


class VisualOutput(BaseModel):
    """Structured creative output produced by `@visual_pixelate`."""

    model_config = ConfigDict(extra="forbid")

    campaign_id: str = Field(..., min_length=1)
    agent_handle: str = Field(default=AgentHandle.VISUAL.value)
    creative_direction: str = Field(..., min_length=1)
    mood_keywords: list[str] = Field(default_factory=list)
    color_palette: list[str] = Field(default_factory=list)
    typography_direction: str = Field(default="")
    visual_brief_markdown: str = Field(..., min_length=1)
    assets: list[VisualAsset] = Field(default_factory=list)
    band_memory_id: str | None = Field(default=None)
    generated_at: datetime = Field(default_factory=utc_now)


class PlatformCopy(BaseModel):
    """Channel-specific marketing copy aligned to a visual concept."""

    model_config = ConfigDict(extra="forbid")

    platform: str = Field(..., min_length=1, max_length=60)
    headline: str = Field(..., min_length=1, max_length=240)
    subheadline: str | None = Field(default=None, max_length=400)
    body_copy: str = Field(..., min_length=1, max_length=4000)
    call_to_action: str = Field(..., min_length=1, max_length=160)
    hashtags: list[str] = Field(default_factory=list)
    linked_asset_id: str | None = Field(default=None)


class CopyOutput(BaseModel):
    """Structured campaign copy produced by `@copy_pixelate` after @mention handoff."""

    model_config = ConfigDict(extra="forbid")

    campaign_id: str = Field(..., min_length=1)
    agent_handle: str = Field(default=AgentHandle.COPY.value)
    campaign_tagline: str = Field(..., min_length=1, max_length=300)
    brand_voice_summary: str = Field(..., min_length=1, max_length=1000)
    key_messages: list[str] = Field(default_factory=list)
    platform_copies: list[PlatformCopy] = Field(default_factory=list)
    email_subject_lines: list[str] = Field(default_factory=list)
    band_memory_refs: list[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=utc_now)


class AgentEvent(BaseModel):
    """Real-time event streamed from Band rooms to `WS /ws/campaign/{campaign_id}`."""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    campaign_id: str = Field(..., min_length=1)
    room_id: str = Field(..., min_length=1)
    event_type: EventType
    sender: str = Field(..., min_length=1)
    mentions: list[str] = Field(default_factory=list)
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)
    transport: Literal["band", "local_fallback"] = Field(default="local_fallback")
    timestamp: datetime = Field(default_factory=utc_now)


class BandMemoryEntry(BaseModel):
    """Shared memory artifact stored inside a campaign's Band room."""

    model_config = ConfigDict(extra="forbid")

    memory_id: str = Field(default_factory=lambda: f"mem_{uuid4().hex[:12]}")
    room_id: str
    campaign_id: str
    author: str
    key: str
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)


class CampaignResponse(BaseModel):
    """Complete aggregated campaign state persisted on disk and returned by GET."""

    model_config = ConfigDict(extra="forbid")

    campaign_id: str = Field(..., min_length=1)
    status: CampaignStatus = Field(default=CampaignStatus.QUEUED)
    room_id: str = Field(..., min_length=1)
    transport: Literal["band", "local_fallback"] = Field(default="local_fallback")
    request: CampaignRequest
    visual_output: VisualOutput | None = None
    copy_output: CopyOutput | None = None
    events: list[AgentEvent] = Field(default_factory=list)
    error: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CampaignGenerateResponse(BaseModel):
    """Immediate acknowledgement returned by `POST /api/campaigns/generate`."""

    model_config = ConfigDict(extra="forbid")

    campaign_id: str
    status: CampaignStatus
    room_id: str
    transport: Literal["band", "local_fallback"]
    ws_url: str
    detail_url: str
    created_at: datetime


class AgentEventInput(BaseModel):
    """Payload accepted by `POST /api/campaigns/{campaign_id}/events` from worker agents."""

    model_config = ConfigDict(extra="forbid")

    event_type: EventType = Field(default=EventType.AGENT_THINKING)
    sender: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    mentions: list[str] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
