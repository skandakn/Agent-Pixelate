"""Data contracts for Agent Pixelate agents.

Imports canonical Pydantic v2 schemas directly from `/shared/schemas.py` when
present in the repository, and gracefully falls back to `agents.schemas_fallback`
(an exact field-for-field mirror) when running `/agents` before `/shared` is
merged.

Also defines AdalFlow `DataClass` planning schemas used inside our AdaL /
AdalFlow modular agent pipelines for strict structured output enforcement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from adalflow.core import DataClass
from pydantic import BaseModel, Field

try:
    from shared.schemas import (  # type: ignore[import-not-found]
        AgentEvent,
        AgentEventInput,
        AgentHandle,
        BandMemoryEntry,
        CampaignGenerateResponse,
        CampaignRequest,
        CampaignResponse,
        CampaignStatus,
        CopyOutput,
        EventType,
        PlatformCopy,
        VisualAsset,
        VisualOutput,
        utc_now,
    )

    USING_SHARED_SCHEMAS = True
except ImportError:
    from agents.schemas_fallback import (
        AgentEvent,
        AgentEventInput,
        AgentHandle,
        BandMemoryEntry,
        CampaignGenerateResponse,
        CampaignRequest,
        CampaignResponse,
        CampaignStatus,
        CopyOutput,
        EventType,
        PlatformCopy,
        VisualAsset,
        VisualOutput,
        utc_now,
    )

    USING_SHARED_SCHEMAS = False


# ---------------------------------------------------------------------------
# Internal Structured Planning Models (AdalFlow DataClass + Pydantic v2)
# ---------------------------------------------------------------------------


class ImagePromptSpec(BaseModel):
    """Single aspect-ratio-native image generation brief."""

    slot: str = Field(
        ...,
        description="Canonical slot: hero_banner | instagram_square | story_reel_vertical",
    )
    title: str = Field(..., min_length=1, max_length=200)
    platform: str = Field(..., min_length=1, max_length=60)
    aspect_ratio: str = Field(..., description="16:9, 1:1, or 9:16")
    width: int = Field(..., ge=256)
    height: int = Field(..., ge=256)
    prompt: str = Field(..., min_length=10, max_length=3800)
    lighting_notes: str = Field(default="")
    composition_notes: str = Field(default="")
    alt_text: str = Field(default="", max_length=500)


class StoryboardScene(BaseModel):
    """Single scene in the 3-scene promotional video storyboard."""

    scene_number: int = Field(..., ge=1, le=3)
    beat_name: str = Field(..., description="Hook | Feature Reveal | Hero CTA")
    timecode: str = Field(..., description="e.g. 0.0s - 3.0s")
    camera_motion: str = Field(
        ..., description="Explicit camera motion cue (dolly-in, gimbal orbit, crane-out, etc.)"
    )
    visual_action: str = Field(..., min_length=10)
    lighting_cue: str = Field(..., min_length=5)
    on_screen_text: str = Field(..., max_length=120)
    audio_sfx_cue: str = Field(default="")


class VisualDirectionPlan(BaseModel):
    """Strict structured output emitted by the Visual Agent's AdalFlow planner."""

    creative_direction: str = Field(..., min_length=20)
    visual_metaphor: str = Field(..., min_length=5)
    lighting_style: str = Field(..., min_length=5)
    mood_keywords: list[str] = Field(..., min_length=3, max_length=8)
    color_palette: list[str] = Field(..., min_length=5, max_length=5)
    color_roles: dict[str, str] = Field(default_factory=dict)
    typography_direction: str = Field(..., min_length=10)
    image_prompts: list[ImagePromptSpec] = Field(..., min_length=3, max_length=6)
    video_storyboard: list[StoryboardScene] = Field(..., min_length=3, max_length=3)


@dataclass
class AdalVisualPlanDataClass(DataClass):
    """AdalFlow DataClass wrapper used by `DataClassParser` for structured Visual Agent planning."""

    creative_direction: str = field(
        default="",
        metadata={"desc": "Cohesive art direction, visual concept, composition philosophy, and lighting."},
    )
    visual_metaphor: str = field(
        default="",
        metadata={"desc": "Central visual metaphor connecting product to audience."},
    )
    lighting_style: str = field(
        default="",
        metadata={"desc": "Concrete physical lighting setup (key, rim, color temperature, optics)."},
    )
    mood_keywords: list[str] = field(
        default_factory=list,
        metadata={"desc": "5 concise mood/atmosphere keywords."},
    )
    color_palette: list[str] = field(
        default_factory=list,
        metadata={"desc": "Exactly 5 valid #RRGGBB hex codes [primary, deep, accent, surface, highlight]."},
    )
    color_roles: dict[str, str] = field(
        default_factory=dict,
        metadata={"desc": "Mapping of each hex token to its functional brand role."},
    )
    typography_direction: str = field(
        default="",
        metadata={"desc": "Display + body font pairing, weight contrast, and kinetic motion cues."},
    )
    image_prompts: list[dict[str, Any]] = field(
        default_factory=list,
        metadata={
            "desc": (
                "3 tailored image prompts: hero_banner (16:9 web_banner 1600x900), "
                "instagram_square (1:1 instagram 1080x1080), story_reel_vertical (9:16 instagram_story 1080x1920)."
            )
        },
    )
    video_storyboard: list[dict[str, Any]] = field(
        default_factory=list,
        metadata={
            "desc": (
                "3-scene 15s promotional video storyboard with scene_number, beat_name, "
                "timecode, camera_motion, visual_action, lighting_cue, on_screen_text, audio_sfx_cue."
            )
        },
    )


class CopyDraftPlan(BaseModel):
    """Strict structured output emitted by the Copy Agent's AdalFlow planner."""

    campaign_tagline: str = Field(..., min_length=3, max_length=300)
    brand_voice_summary: str = Field(..., min_length=10, max_length=1000)
    visual_alignment_notes: str = Field(
        default="",
        description="Explicit explanation of how the copy mirrors visual motifs, lighting, and palette.",
    )
    key_messages: list[str] = Field(..., min_length=3, max_length=6)
    platform_copies: list[PlatformCopy] = Field(..., min_length=3)
    email_subject_lines: list[str] = Field(..., min_length=3, max_length=6)


@dataclass
class AdalCopyPlanDataClass(DataClass):
    """AdalFlow DataClass wrapper used by `DataClassParser` for structured Copy Agent planning."""

    campaign_tagline: str = field(
        default="",
        metadata={"desc": "Punchy, rhythmic 3-8 word campaign tagline echoing the visual mood."},
    )
    brand_voice_summary: str = field(
        default="",
        metadata={"desc": "Voice guidelines referencing the Visual Agent's color mood, lighting, and tone."},
    )
    visual_alignment_notes: str = field(
        default="",
        metadata={"desc": "How the copy explicitly complements visual motifs, palette, and storyboard."},
    )
    key_messages: list[str] = field(
        default_factory=list,
        metadata={"desc": "3-5 sharp, non-cliche core value propositions."},
    )
    platform_copies: list[dict[str, Any]] = field(
        default_factory=list,
        metadata={
            "desc": (
                "PlatformCopy dicts for instagram, linkedin, paid_ad (AIDA/PAS primary text + CTA), "
                "plus requested channels (e.g. web_banner, x, instagram_story)."
            )
        },
    )
    email_subject_lines: list[str] = field(
        default_factory=list,
        metadata={"desc": "4 conversion-engineered email subject line variations."},
    )


__all__ = [
    "USING_SHARED_SCHEMAS",
    "AdalCopyPlanDataClass",
    "AdalVisualPlanDataClass",
    "AgentEvent",
    "AgentEventInput",
    "AgentHandle",
    "BandMemoryEntry",
    "CampaignGenerateResponse",
    "CampaignRequest",
    "CampaignResponse",
    "CampaignStatus",
    "CopyDraftPlan",
    "CopyOutput",
    "EventType",
    "ImagePromptSpec",
    "PlatformCopy",
    "StoryboardScene",
    "VisualAsset",
    "VisualDirectionPlan",
    "VisualOutput",
    "utc_now",
]
