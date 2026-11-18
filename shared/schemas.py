"""Shared Pydantic v2 schemas for Agent Pixelate.

Imported by both `/orchestrator` and `/agents` to enforce a single, strict
data contract across FastAPI routes, WebSocket streams, Band rooms, and
persistent campaign storage.
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

    brand_name: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Name of the brand or company.",
        examples=["NovaBrew"],
    )
    product_description: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Core product or service offering being promoted.",
        examples=["Zero-sugar sparkling cold brew infused with adaptogenic lions mane."],
    )
    target_audience: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Primary demographic, persona, or customer segment.",
        examples=["Gen-Z founders, designers, and late-night builders in urban hubs"],
    )
    campaign_goal: str = Field(
        default="Drive brand awareness and launch-day conversions",
        min_length=2,
        max_length=500,
        description="Primary marketing objective or KPI.",
    )
    brand_tone: str = Field(
        default="Bold, playful, and high-contrast",
        min_length=2,
        max_length=300,
        description="Desired brand voice and aesthetic tone.",
    )
    platforms: list[str] = Field(
        default_factory=lambda: ["instagram", "linkedin", "x", "web_banner"],
        min_length=1,
        max_length=10,
        description="Target marketing channels/platforms for visual and copy assets.",
    )
    color_palette: list[str] = Field(
        default_factory=list,
        max_length=8,
        description="Optional preferred brand colors (hex codes or color names).",
    )
    num_concepts: int = Field(
        default=3,
        ge=1,
        le=6,
        description="Number of visual campaign concepts/assets to generate.",
    )
    additional_notes: str | None = Field(
        default=None,
        max_length=1500,
        description="Optional constraints, seasonal themes, or compliance notes.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary caller metadata (e.g., workspace_id, user_id).",
    )

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

    asset_id: str = Field(
        default_factory=lambda: f"asset_{uuid4().hex[:10]}",
        description="Unique identifier for the generated visual asset.",
    )
    title: str = Field(..., min_length=1, max_length=200)
    platform: str = Field(..., min_length=1, max_length=60)
    aspect_ratio: str = Field(default="1:1", max_length=20)
    prompt_used: str = Field(..., min_length=1, max_length=4000)
    file_path: str | None = Field(
        default=None,
        description="Path inside persistent campaign storage (e.g., /data/campaigns/...).",
    )
    asset_url: str = Field(
        ...,
        min_length=1,
        description="API-served relative URL or external CDN URL for frontend rendering.",
    )
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
    creative_direction: str = Field(
        ...,
        min_length=1,
        description="High-level visual concept, composition philosophy, and narrative.",
    )
    mood_keywords: list[str] = Field(default_factory=list)
    color_palette: list[str] = Field(default_factory=list)
    typography_direction: str = Field(default="")
    visual_brief_markdown: str = Field(
        ...,
        min_length=1,
        description="Structured brief posted to the Band room and saved in Band Memory for @copy_pixelate.",
    )
    assets: list[VisualAsset] = Field(default_factory=list)
    band_memory_id: str | None = Field(
        default=None,
        description="Identifier of the shared Band Memory containing this visual brief.",
    )
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
    linked_asset_id: str | None = Field(
        default=None,
        description="Optional VisualAsset.asset_id paired with this copy block.",
    )


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
    band_memory_refs: list[str] = Field(
        default_factory=list,
        description="Band Memory IDs consumed by @copy_pixelate during generation.",
    )
    generated_at: datetime = Field(default_factory=utc_now)


class AgentEvent(BaseModel):
    """Real-time event streamed from Band rooms to `WS /ws/campaign/{campaign_id}`."""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    campaign_id: str = Field(..., min_length=1)
    room_id: str = Field(..., min_length=1)
    event_type: EventType
    sender: str = Field(
        ...,
        min_length=1,
        description="Originating agent handle or system identifier.",
    )
    mentions: list[str] = Field(
        default_factory=list,
        description="Explicit @mentions extracted from the room message.",
    )
    message: str = Field(..., description="Human-readable status or room message.")
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured event metadata (memory_id, asset previews, metrics, etc.).",
    )
    transport: Literal["band", "local_fallback"] = Field(
        default="local_fallback",
        description="Whether this event originated from live Band or local in-memory fallback.",
    )
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
