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

    HUMAN = "@human_director"
    ORCHESTRATOR = "@orchestrator_pixelate"
    VISUAL = "@visual_pixelate"
    COPY = "@copy_pixelate"
    CRITIC = "@critic_pixelate"


class CampaignStatus(str, Enum):
    """Lifecycle states of an Agent Pixelate marketing campaign."""

    QUEUED = "queued"
    VISUAL_GENERATING = "visual_generating"
    AWAITING_APPROVAL = "awaiting_approval"
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
    HUMAN_MESSAGE = "human_message"
    PRESENCE_UPDATED = "presence_updated"
    APPROVAL_REQUIRED = "approval_required"
    APPROVAL_GRANTED = "approval_granted"
    AGENT_REVISION = "agent_revision"
    CRITIC_REVIEW = "critic_review"
    EXECUTION_TRACE = "execution_trace"
    POLICY_BLOCKED = "policy_blocked"
    AGENT_INVITED = "agent_invited"
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


class BandParticipant(BaseModel):
    """Live participant presence and capability metadata inside a BAND room."""

    model_config = ConfigDict(extra="forbid")

    handle: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)
    kind: Literal["human", "orchestrator", "agent"] = "agent"
    status: Literal["online", "thinking", "working", "awaiting_approval", "idle"] = "online"
    framework: str = Field(default="BAND Protocol")
    skills: list[str] = Field(default_factory=list)
    registered_remote: bool = False
    last_active_at: datetime = Field(default_factory=utc_now)


class BandDelegationEdge(BaseModel):
    """Auditable task delegation / handoff edge recorded inside a BAND room."""

    model_config = ConfigDict(extra="forbid")

    edge_id: str = Field(default_factory=lambda: f"del_{uuid4().hex[:10]}")
    from_handle: str
    to_handle: str
    reason: str
    memory_id: str | None = None
    status: Literal["dispatched", "awaiting_approval", "completed"] = "dispatched"
    timestamp: datetime = Field(default_factory=utc_now)


class BandMessageInput(BaseModel):
    """Human or teammate message posted into a campaign's BAND room."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sender: str = Field(default=AgentHandle.HUMAN.value, min_length=1, max_length=80)
    sender_name: str | None = Field(default=None, max_length=120)
    message: str = Field(..., min_length=1, max_length=2500)


class BandMemoryInput(BaseModel):
    """Pin or write a shared context entry into the campaign's BAND Memory vault."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    author: str = Field(default=AgentHandle.HUMAN.value, min_length=1, max_length=80)
    key: str = Field(default="brand_guardrail", min_length=1, max_length=80)
    content: str = Field(..., min_length=2, max_length=3000)
    pinned: bool = Field(default=True)
    metadata: dict[str, Any] = Field(default_factory=dict)


class BandApprovalInput(BaseModel):
    """Human-in-the-loop gate decision before `@visual_pixelate` hands off to `@copy_pixelate`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    approver: str = Field(default=AgentHandle.HUMAN.value, min_length=1, max_length=80)
    approved: bool = Field(default=True)
    note: str | None = Field(default=None, max_length=1500)


class BandToolCallTrace(BaseModel):
    """Auditable tool invocation inside a context-isolated BAND execution."""

    model_config = ConfigDict(extra="forbid")

    tool_name: str
    framework: str = "AdaL / AdalFlow"
    args_summary: str = ""
    result_summary: str = ""
    duration_ms: int = Field(default=0, ge=0)
    status: Literal["ok", "error", "blocked"] = "ok"


class BandTaskExecution(BaseModel):
    """Context-isolated BAND agent execution record with tool trace & focus slice."""

    model_config = ConfigDict(extra="forbid")

    execution_id: str = Field(default_factory=lambda: f"exec_{uuid4().hex[:10]}")
    campaign_id: str
    room_id: str
    agent_handle: str
    framework: str
    trigger_by: str
    trigger_reason: str
    focus_memory_ids: list[str] = Field(default_factory=list)
    focus_token_estimate: int = Field(default=0, ge=0)
    tool_calls: list[BandToolCallTrace] = Field(default_factory=list)
    status: Literal["queued", "running", "completed", "blocked_by_policy", "failed"] = "running"
    duration_ms: int = Field(default=0, ge=0)
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None


class BandFocusWindow(BaseModel):
    """Per-Agent Focus projection computed by the BAND Control Plane.

    Demonstrates BAND's context-isolation guarantee: each agent sees only the
    room messages, memories, and peers relevant to its turn.
    """

    model_config = ConfigDict(extra="forbid")

    agent_handle: str
    total_room_events: int = 0
    focused_event_count: int = 0
    filtered_noise_count: int = 0
    included_memory_keys: list[str] = Field(default_factory=list)
    included_memory_ids: list[str] = Field(default_factory=list)
    focused_tokens_est: int = 0
    full_room_tokens_est: int = 0
    context_savings_pct: float = 0.0
    focus_summary: str = ""


class BandPolicyAuthority(BaseModel):
    """Dual-scope authority boundary for a participant in the BAND Control Plane."""

    model_config = ConfigDict(extra="forbid")

    handle: str
    api_scope: Literal["human_me_api", "agent_runtime_api"]
    can_read_memories: bool = True
    can_write_memories: bool = True
    can_promote_brand_memory: bool = False
    can_approve_handoff: bool = False
    can_modify_governance: bool = False
    can_mention: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    muted: bool = False


class BandLoopGuardState(BaseModel):
    """BAND Loop-Prevention Circuit Breaker telemetry for a room."""

    model_config = ConfigDict(extra="forbid")

    max_agent_hops: int = Field(default=6, ge=1, le=20)
    current_hops: int = Field(default=0, ge=0)
    blocked_loops: int = Field(default=0, ge=0)
    strict_mode: bool = True
    circuit_open: bool = False
    last_route: str = ""


class BandCriticCheck(BaseModel):
    """Single automated audit check from `@critic_pixelate`."""

    model_config = ConfigDict(extra="forbid")

    category: Literal["contrast_wcag", "palette_harmony", "copy_conversion", "platform_spec", "guardrails"]
    label: str
    passed: bool
    score: int = Field(ge=0, le=100)
    detail: str


class BandCriticReport(BaseModel):
    """Structured Brand QA & Governance Scorecard emitted by `@critic_pixelate`."""

    model_config = ConfigDict(extra="forbid")

    report_id: str = Field(default_factory=lambda: f"qa_{uuid4().hex[:8]}")
    overall_score: int = Field(ge=0, le=100)
    grade: str
    summary: str
    wcag_contrast_ratio: float = 0.0
    checks: list[BandCriticCheck] = Field(default_factory=list)
    recommended_mention: str | None = None
    generated_at: datetime = Field(default_factory=utc_now)


class BandAuditEntry(BaseModel):
    """Tamper-evident SHA-256 hash-chained audit record for BAND compliance export."""

    model_config = ConfigDict(extra="forbid")

    seq: int
    timestamp: datetime
    actor: str
    api_scope: Literal["human_me_api", "agent_runtime_api"]
    action: str
    target: str = ""
    summary: str
    prev_hash: str
    entry_hash: str


class BandAgentDirectoryEntry(BaseModel):
    """Discoverable agent in the BAND Agentic Mesh Registry."""

    model_config = ConfigDict(extra="forbid")

    handle: str
    display_name: str
    framework: str
    agent_type: Literal["remote_sdk", "platform_hosted", "human_proxy"] = "remote_sdk"
    contact_status: Literal["mutual_approved", "pending", "system"] = "mutual_approved"
    description: str
    skills: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    registered_remote: bool = False


class BandGovernancePatch(BaseModel):
    """Runtime governance policy update submitted via the Human `/me` Control Plane."""

    model_config = ConfigDict(extra="forbid")

    actor: str = Field(default=AgentHandle.HUMAN.value)
    require_handoff_approval: bool | None = None
    auto_critic_qa: bool | None = None
    strict_loop_guard: bool | None = None
    max_agent_hops: int | None = Field(default=None, ge=1, le=20)
    mute_handle: str | None = None
    muted: bool | None = None


class BandPromoteMemoryInput(BaseModel):
    """Promote a campaign room memory to Cross-Session Brand Memory."""

    model_config = ConfigDict(extra="forbid")

    memory_id: str = Field(..., min_length=1)
    promoter: str = Field(default=AgentHandle.HUMAN.value)


class BandRoomSnapshot(BaseModel):
    """Full live collaboration & Control Plane state of a campaign's BAND room."""

    model_config = ConfigDict(extra="forbid")

    campaign_id: str
    room_id: str
    brand_name: str = ""
    transport: Literal["band", "local_fallback"] = "local_fallback"
    status: CampaignStatus
    approval_required: bool = False
    pending_approval: bool = False
    auto_critic_qa: bool = True
    participants: list[BandParticipant] = Field(default_factory=list)
    memories: list[BandMemoryEntry] = Field(default_factory=list)
    brand_memories: list[BandMemoryEntry] = Field(default_factory=list)
    messages: list[AgentEvent] = Field(default_factory=list)
    delegations: list[BandDelegationEdge] = Field(default_factory=list)
    executions: list[BandTaskExecution] = Field(default_factory=list)
    focus_windows: list[BandFocusWindow] = Field(default_factory=list)
    policies: list[BandPolicyAuthority] = Field(default_factory=list)
    loop_guard: BandLoopGuardState = Field(default_factory=BandLoopGuardState)
    critic_report: BandCriticReport | None = None
    audit_chain_head: str = ""
    updated_at: datetime = Field(default_factory=utc_now)
