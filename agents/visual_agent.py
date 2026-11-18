"""Visual Agent (`@visual_pixelate`) built on AdaL / AdalFlow & Finch Skills.

Workflow:
  1. Loads `brand_visual_direction.SKILL.md` via `FinchSkillLoader`.
  2. Executes AdalFlow `FunctionTool`s + `AdalAgentHarness` structured planner to
     generate a cohesive visual concept, strictly validated 5-hex color palette,
     typography/art direction, 3 tailored multi-aspect image prompts (Hero Banner
     16:9, Instagram Square 1:1, Story/Reel Vertical 9:16), and a 3-scene
     promotional video storyboard script with explicit camera motion cues.
  3. Invokes `ImageGenerationService` (Gemini Imagen / OpenAI `gpt-image-1` /
     Fal.ai via `IMAGE_PROVIDER` env var, plus high-resolution studio PNG
     fallback) and persists images + `video_storyboard.json` locally.
  4. Returns validated `VisualOutput` JSON and emits a structured BAND handoff
     event mentioning `@copy_pixelate`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents.adal_harness import AdalAgentHarness, AdalSessionMemory
from agents.contracts import (
    AdalVisualPlanDataClass,
    AgentEvent,
    AgentHandle,
    CampaignRequest,
    EventType,
    ImagePromptSpec,
    StoryboardScene,
    VisualAsset,
    VisualDirectionPlan,
    VisualOutput,
)
from agents.image_providers import ImageGenerationService
from agents.skill_loader import FinchSkillLoader

logger = logging.getLogger(__name__)

EventEmitter = Callable[[AgentEvent | dict[str, Any]], Awaitable[None] | None]

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

# Tone-aware curated 5-hex anchor palettes [primary, deep, accent, surface, highlight]
TONE_PALETTES: dict[str, list[str]] = {
    "bold": ["#FF4D2E", "#0B0F19", "#00E5FF", "#1A1F36", "#F8FAFC"],
    "playful": ["#7C3AED", "#0F172A", "#FF3D81", "#1E1B4B", "#FFFDF7"],
    "luxury": ["#C6A15B", "#0E0D0B", "#E6D3A3", "#1F1C18", "#FAF8F5"],
    "minimal": ["#1F2937", "#090D16", "#38BDF8", "#182234", "#F9FAFB"],
    "organic": ["#2D6A4F", "#0B1F17", "#E9A03B", "#1B4332", "#FAF6EE"],
    "tech": ["#4F46E5", "#070B19", "#22D3EE", "#131C3A", "#F1F5F9"],
    "warm": ["#E05A2B", "#1A120E", "#F5B700", "#2E1F18", "#FFF9F0"],
}

CANONICAL_SLOTS: list[dict[str, Any]] = [
    {
        "slot": "hero_banner",
        "label": "Hero Banner",
        "platform": "web_banner",
        "aspect_ratio": "16:9",
        "width": 1600,
        "height": 900,
        "composition": (
            "Rule-of-thirds composition with hero product sculpted on the right third "
            "and a clean, low-frequency tonal negative-space gradient across the left third "
            "for bold editorial headline and CTA button placement."
        ),
    },
    {
        "slot": "instagram_square",
        "label": "Instagram Square",
        "platform": "instagram",
        "aspect_ratio": "1:1",
        "width": 1080,
        "height": 1080,
        "composition": (
            "Thumb-stopping centered diagonal composition with tactile macro surface textures, "
            "bold brand color-blocking, and a kinetic freeze-frame accent (light refraction or "
            "dynamic splash/particles) engineered to halt scroll within 0.4 seconds."
        ),
    },
    {
        "slot": "story_reel_vertical",
        "label": "Story / Reel Vertical",
        "platform": "instagram_story",
        "aspect_ratio": "9:16",
        "width": 1080,
        "height": 1920,
        "composition": (
            "Vertical safe-zone composition framing the hero subject inside the middle 60% "
            "band with ascending architectural light beams, leaving top 14% unobstructed for "
            "profile chrome and bottom 20% clean for interactive CTA sticker overlay."
        ),
    },
]


def _resolve_campaigns_root(output_dir: Path | str | None = None) -> Path:
    """Resolve writable campaign storage root matching `orchestrator/config.py`."""
    if output_dir is not None:
        root = Path(output_dir)
        root.mkdir(parents=True, exist_ok=True)
        return root

    configured = os.getenv("CAMPAIGN_DATA_DIR", "/data/campaigns")
    if os.name == "nt" and configured.startswith("/"):
        fallback = Path.cwd() / "data" / "campaigns"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback
    try:
        path = Path(configured)
        path.mkdir(parents=True, exist_ok=True)
        return path
    except OSError:
        fallback = Path.cwd() / "data" / "campaigns"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def normalize_five_hex_palette(
    hints: list[str] | None = None, brand_tone: str = "Bold, playful, and high-contrast"
) -> list[str]:
    """Validate hex hints and construct a strict 5-hex `#RRGGBB` palette.

    Args:
        hints: Optional user-provided hex color strings.
        brand_tone: Brand tone description used to select harmonious fallback anchors.

    Returns:
        Exactly 5 uppercase `#RRGGBB` hex color strings [primary, deep, accent, surface, highlight].
    """
    tone_lower = brand_tone.lower()
    base = TONE_PALETTES["tech"]
    for key, palette in TONE_PALETTES.items():
        if key in tone_lower:
            base = palette
            break

    valid_hints: list[str] = []
    for raw in hints or []:
        cleaned = raw.strip()
        if not cleaned.startswith("#"):
            cleaned = f"#{cleaned}"
        if len(cleaned) == 4 and all(ch in "0123456789abcdefABCDEF" for ch in cleaned[1:]):
            cleaned = "#" + "".join(ch * 2 for ch in cleaned[1:])
        if HEX_RE.match(cleaned):
            upper = cleaned.upper()
            if upper not in valid_hints:
                valid_hints.append(upper)

    merged: list[str] = list(valid_hints[:5])
    # Preserve functional role alignment [primary, deep, accent, surface, highlight]
    for slot_idx in range(len(merged), 5):
        candidate = base[slot_idx]
        if candidate not in merged:
            merged.append(candidate)
    for fallback_hex in base:
        if len(merged) >= 5:
            break
        if fallback_hex not in merged:
            merged.append(fallback_hex)

    return merged[:5]


def inspect_platform_aspect_specs() -> list[dict[str, Any]]:
    """Return canonical aspect ratios and resolutions for Agent Pixelate's 3 visual slots.

    Returns:
        List of dicts describing Hero Banner (16:9), Instagram Square (1:1), and
        Story/Reel Vertical (9:16) framing specs.
    """
    return [dict(item) for item in CANONICAL_SLOTS]


async def _safe_emit(
    emit_event: EventEmitter | None,
    *,
    campaign_id: str,
    room_id: str,
    event_type: EventType,
    message: str,
    mentions: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> AgentEvent:
    event = AgentEvent(
        campaign_id=campaign_id,
        room_id=room_id,
        event_type=event_type,
        sender=AgentHandle.VISUAL.value,
        mentions=mentions or [],
        message=message,
        payload=payload or {},
        transport="local_fallback",
    )
    if emit_event is not None:
        maybe_coro = emit_event(event)
        if asyncio.iscoroutine(maybe_coro) or isinstance(maybe_coro, Awaitable):
            await maybe_coro
    return event


class VisualAgent:
    """`@visual_pixelate` — Creative Director & Visual Asset Generator powered by AdaL + Finch."""

    SKILL_ID = "brand_visual_direction"

    def __init__(
        self,
        *,
        skill_loader: FinchSkillLoader | None = None,
        image_service: ImageGenerationService | None = None,
        llm_provider: str | None = None,
    ) -> None:
        self.skill_loader = skill_loader or FinchSkillLoader()
        self.image_service = image_service or ImageGenerationService()
        self.harness = AdalAgentHarness(
            name="VisualPixelateAgent",
            agent_handle=AgentHandle.VISUAL.value,
            role_desc=(
                "You are @visual_pixelate, an award-winning Creative Director and Art Systems "
                "architect inside Agent Pixelate. You transform product briefs into cohesive "
                "visual identities: a sharp visual concept, a 5-hex color palette with roles, "
                "typography and physical lighting direction, 3 aspect-native image generation "
                "prompts (Hero Banner 16:9, Instagram Square 1:1, Story/Reel Vertical 9:16), "
                "and a 3-scene 15-second promotional video storyboard with explicit camera motion cues."
            ),
            tools=[
                self.skill_loader.as_adal_tool_fn(),
                normalize_five_hex_palette,
                inspect_platform_aspect_specs,
            ],
            data_class=AdalVisualPlanDataClass,
            preferred_provider=llm_provider,
        )

    async def run(
        self,
        req: CampaignRequest,
        emit_event: EventEmitter | None = None,
        *,
        campaign_id: str | None = None,
        room_id: str | None = None,
        output_dir: Path | str | None = None,
    ) -> VisualOutput:
        """Execute the full Visual Agent workflow and return validated `VisualOutput`."""
        cid = campaign_id or f"camp_{uuid4().hex[:12]}"
        rid = room_id or f"room_{cid}"
        campaigns_root = _resolve_campaigns_root(output_dir)
        campaign_dir = campaigns_root / cid
        assets_dir = campaign_dir / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)

        session_memory = AdalSessionMemory(
            campaign_id=cid,
            agent_handle=AgentHandle.VISUAL.value,
            session_dir=campaign_dir,
        )

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_STARTED,
            message=(
                f"{AgentHandle.VISUAL.value} activated via AdaL/AdalFlow harness for "
                f"**{req.brand_name}**."
            ),
            payload={"brand_name": req.brand_name, "harness": "adal_adalflow"},
        )

        # 1. Dynamically load Finch `brand_visual_direction.SKILL.md`
        skill = self.skill_loader.load(self.SKILL_ID)
        session_memory.record_skill_load(skill.skill_id, skill.version, skill.provider)
        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_THINKING,
            message=(
                f"Loaded Finch skill `{skill.filename}` (v{skill.version}) — "
                f"applying lighting physics, 5-hex color theory, and 3-aspect framing rules."
            ),
            payload={"skill": skill.summary_card()},
        )

        # 2. Execute AdalFlow tools for 5-hex palette normalization & aspect specs
        normalized_palette: list[str] = await self.harness.execute_tool(
            "normalize_five_hex_palette",
            session_memory=session_memory,
            hints=req.color_palette,
            brand_tone=req.brand_tone,
        )
        aspect_specs: list[dict[str, Any]] = await self.harness.execute_tool(
            "inspect_platform_aspect_specs",
            session_memory=session_memory,
        )

        # 3. Generate strict structured VisualDirectionPlan via AdaL / AdalFlow Generator
        user_prompt = self._build_planner_prompt(req, normalized_palette, aspect_specs)
        plan, exec_mode = await self.harness.generate_structured(
            schema_cls=VisualDirectionPlan,
            user_prompt=user_prompt,
            skill_instructions=skill.render_prompt_block(),
            session_memory=session_memory,
            fallback_builder=lambda: self._build_deterministic_plan(
                req, normalized_palette, aspect_specs
            ),
            extra_schema_notes=(
                "STRICT REQUIREMENTS:\n"
                "- `color_palette` MUST be a list of EXACTLY 5 `#RRGGBB` hex strings.\n"
                "- `image_prompts` MUST contain at least 3 items with slots "
                "`hero_banner` (16:9, 1600x900, platform `web_banner`), "
                "`instagram_square` (1:1, 1080x1080, platform `instagram`), and "
                "`story_reel_vertical` (9:16, 1080x1920, platform `instagram_story`).\n"
                "- `video_storyboard` MUST contain EXACTLY 3 scenes (`scene_number` 1, 2, 3) "
                "each with explicit `camera_motion`, `lighting_cue`, `visual_action`, `on_screen_text`, `audio_sfx_cue`."
            ),
        )

        # Enforce strict 5-hex validity even on live LLM responses
        validated_palette = normalize_five_hex_palette(plan.color_palette, req.brand_tone)
        plan.color_palette = validated_palette

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_THINKING,
            message=(
                f"Art direction locked ({exec_mode}): 5-hex palette {', '.join(validated_palette)} "
                f"| Visual metaphor: {plan.visual_metaphor} | Generating {len(plan.image_prompts)} assets "
                f"& 3-scene storyboard..."
            ),
            payload={
                "execution_mode": exec_mode,
                "color_palette": validated_palette,
                "mood_keywords": plan.mood_keywords,
                "typography_direction": plan.typography_direction,
                "video_storyboard": [s.model_dump() for s in plan.video_storyboard],
            },
        )

        # 4. Generate & persist campaign images via ImageGenerationService
        assets: list[VisualAsset] = []
        prompt_specs = plan.image_prompts[: max(3, req.num_concepts)]
        for idx, spec in enumerate(prompt_specs, start=1):
            asset_id = f"asset_{idx}_{uuid4().hex[:6]}"
            img_result = await self.image_service.generate_image(
                campaign_id=cid,
                asset_id=asset_id,
                brand_name=req.brand_name,
                title=spec.title,
                slot=spec.slot,
                platform=spec.platform,
                aspect_ratio=spec.aspect_ratio,
                width=spec.width,
                height=spec.height,
                prompt=spec.prompt,
                color_palette=validated_palette,
                lighting_notes=spec.lighting_notes or plan.lighting_style,
                visual_metaphor=plan.visual_metaphor,
                assets_dir=assets_dir,
            )

            asset = VisualAsset(
                asset_id=asset_id,
                title=spec.title,
                platform=spec.platform,
                aspect_ratio=spec.aspect_ratio,
                prompt_used=spec.prompt,
                file_path=str(img_result.file_path) if img_result.file_path else None,
                asset_url=img_result.asset_url,
                mime_type=img_result.mime_type,
                width=img_result.width,
                height=img_result.height,
                color_tokens=validated_palette,
                alt_text=spec.alt_text
                or f"{req.brand_name} {spec.title} ({spec.aspect_ratio}) visual for {spec.platform}",
            )
            assets.append(asset)

            await _safe_emit(
                emit_event,
                campaign_id=cid,
                room_id=rid,
                event_type=EventType.ASSET_GENERATED,
                message=(
                    f"Generated asset {idx}/{len(prompt_specs)}: **{asset.title}** "
                    f"(`{asset.platform}`, `{asset.aspect_ratio}`, provider=`{img_result.provider_used}`)."
                ),
                payload={
                    "asset": asset.model_dump(mode="json"),
                    "provider_used": img_result.provider_used,
                    "fallback_reference_url": img_result.fallback_reference_url,
                },
            )

        # 5. Persist structured 3-scene promotional video storyboard JSON artifact
        storyboard_path = assets_dir / "video_storyboard.json"
        storyboard_payload = {
            "campaign_id": cid,
            "brand_name": req.brand_name,
            "duration_seconds": 15,
            "aspect_ratio": "9:16 / 16:9 adaptable",
            "visual_metaphor": plan.visual_metaphor,
            "lighting_style": plan.lighting_style,
            "color_palette": validated_palette,
            "scenes": [scene.model_dump() for scene in plan.video_storyboard],
        }
        await asyncio.to_thread(
            storyboard_path.write_text,
            json.dumps(storyboard_payload, indent=2),
            "utf-8",
        )

        # 6. Assemble rich `visual_brief_markdown` for Band Memory & `@copy_pixelate` handoff
        band_memory_id = f"mem_vis_{uuid4().hex[:10]}"
        visual_brief_markdown = self._render_visual_brief_markdown(
            req=req,
            plan=plan,
            assets=assets,
            storyboard_path=storyboard_path,
        )

        visual_output = VisualOutput(
            campaign_id=cid,
            agent_handle=AgentHandle.VISUAL.value,
            creative_direction=plan.creative_direction,
            mood_keywords=plan.mood_keywords,
            color_palette=validated_palette,
            typography_direction=plan.typography_direction,
            visual_brief_markdown=visual_brief_markdown,
            assets=assets,
            band_memory_id=band_memory_id,
        )

        # Store structured handoff artifacts into AdaL Session Memory
        session_memory.put_context("visual_output", visual_output.model_dump(mode="json"))
        session_memory.put_context("video_storyboard", storyboard_payload)
        session_memory.put_context("band_memory_id", band_memory_id)

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.MEMORY_STORED,
            message=(
                f"Stored visual concept, 5-hex palette, {len(assets)} assets, and 3-scene "
                f"video storyboard in shared memory `{band_memory_id}`."
            ),
            payload={
                "memory_id": band_memory_id,
                "storyboard_path": str(storyboard_path),
                "video_storyboard": storyboard_payload["scenes"],
            },
        )

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.VISUAL_COMPLETED,
            message=(
                f"{AgentHandle.VISUAL.value} completed visual direction for **{req.brand_name}** "
                f"with {len(assets)} rendered assets and a 3-scene video storyboard."
            ),
            payload={"visual_output": visual_output.model_dump(mode="json")},
        )

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_MENTION,
            mentions=[AgentHandle.COPY.value],
            message=(
                f"{AgentHandle.COPY.value} Visual system ready for **{req.brand_name}** "
                f"(memory `{band_memory_id}`). Palette: {', '.join(validated_palette)}. "
                f"Lighting: {plan.lighting_style}. Please craft aligned headlines, social "
                f"captions, and high-converting ad copy matching these visual motifs."
            ),
            payload={
                "handoff_from": AgentHandle.VISUAL.value,
                "handoff_to": AgentHandle.COPY.value,
                "band_memory_id": band_memory_id,
            },
        )

        return visual_output

    @staticmethod
    def _build_planner_prompt(
        req: CampaignRequest,
        normalized_palette: list[str],
        aspect_specs: list[dict[str, Any]],
    ) -> str:
        return (
            f"Create a complete, studio-grade visual campaign direction for:\n"
            f"- Brand Name: {req.brand_name}\n"
            f"- Product Description: {req.product_description}\n"
            f"- Target Audience: {req.target_audience}\n"
            f"- Campaign Goal: {req.campaign_goal}\n"
            f"- Brand Tone: {req.brand_tone}\n"
            f"- Requested Platforms: {', '.join(req.platforms)}\n"
            f"- Additional Notes: {req.additional_notes or 'None'}\n"
            f"- Validated 5-Hex Palette Seed (refine harmoniously if needed, MUST stay 5 valid #RRGGBB hexes): "
            f"{json.dumps(normalized_palette)}\n"
            f"- Mandatory 3 Image Slots:\n{json.dumps(aspect_specs, indent=2)}\n\n"
            f"Return a single strict JSON object matching `VisualDirectionPlan` with:\n"
            f"1. `creative_direction`: vivid visual concept, composition philosophy, lighting & material storytelling.\n"
            f"2. `visual_metaphor`: memorable central imagery motif.\n"
            f"3. `lighting_style`: concrete physical lighting setup (key, rim, color temp, optics).\n"
            f"4. `mood_keywords`: 5 evocative adjectives.\n"
            f"5. `color_palette`: exactly 5 `#RRGGBB` hex codes.\n"
            f"6. `color_roles`: mapping of each hex to its role (Primary, Deep Contrast, Accent, Surface, Highlight).\n"
            f"7. `typography_direction`: display + body pairing, tracking/weight contrast, motion style.\n"
            f"8. `image_prompts`: 3 richly detailed, self-contained image generation prompts (Hero Banner 16:9, "
            f"Instagram Square 1:1, Story/Reel Vertical 9:16) integrating the exact 5-hex palette and no garbled text.\n"
            f"9. `video_storyboard`: 3 scenes (0-3s Hook, 3-10s Feature Reveal, 10-15s Hero CTA) with explicit camera motion cues."
        )

    @staticmethod
    def _build_deterministic_plan(
        req: CampaignRequest,
        palette: list[str],
        aspect_specs: list[dict[str, Any]],
    ) -> VisualDirectionPlan:
        """High-craft deterministic visual direction synthesis when running offline or out of quota."""
        tone_lower = req.brand_tone.lower()
        p_primary, p_deep, p_accent, p_surface, p_light = palette

        if any(w in tone_lower for w in ("luxury", "editorial", "premium", "elegant")):
            lighting = (
                f"Soft overhead diffused scrim key light (45° camera-left, 3400K warm alabaster) "
                f"with precision {p_accent} specular rim bounce on honed stone and brushed metal; "
                f"85mm f/1.8 shallow depth of field."
            )
            typography = (
                "High-contrast editorial serif display (Didot/Playfair style, tight -0.02em tracking) "
                "paired with light geometric sans body (Inter 400) and slow fade-reveal motion."
            )
            metaphor = f"Sculpted light carving {req.brand_name} out of obsidian stillness"
            mood = ["sculptural", "luminous", "tactile", "editorial", "timeless"]
        elif any(w in tone_lower for w in ("organic", "calm", "wellness", "natural")):
            lighting = (
                f"Dappled golden-hour window key light (3600K) casting soft botanical shadow gobos, "
                f"balanced by {p_accent} warm bounce fill and micro-condensation specular highlights; "
                f"50mm natural bokeh."
            )
            typography = (
                "Humanist organic display serif paired with airy neo-grotesque body (Plus Jakarta Sans) "
                "and gentle organic ease-out typography reveals."
            )
            metaphor = f"Sun-warmed ritual clarity radiating from {req.brand_name}"
            mood = ["sun-drenched", "grounded", "tactile", "restorative", "crisp"]
        else:
            lighting = (
                f"Sculpted 45° hard studio key light (5200K crisp daylight) paired with dual-gel "
                f"{p_primary} and {p_accent} volumetric edge rim-lighting against a {p_deep} architectural "
                f"backdrop; 35mm anamorphic lens flare and razor-sharp micro-contrast."
            )
            typography = (
                "Bold condensed geometric display sans (Space Grotesk / Clash Display 800, tight -0.03em tracking) "
                "paired with crisp neo-grotesk body (Inter 400/500) and kinetic masked slide-up motion."
            )
            metaphor = f"Kinetic electric prism spotlighting {req.brand_name} in motion"
            mood = ["kinetic", "high-contrast", "electric", "tactile", "modern"]

        creative_direction = (
            f"A {req.brand_tone.lower()} editorial art system for {req.brand_name} centered on "
            f"'{metaphor}'. Built around a disciplined 5-hex palette ({', '.join(palette)}), "
            f"tactile material contrast, and sculpted studio rim-lighting tailored specifically "
            f"for {req.target_audience} to {req.campaign_goal.lower()}."
        )

        color_roles = {
            p_primary: "Primary Brand Anchor (60% hero visual weight)",
            p_deep: "Deep Structural Contrast (WCAG AAA headline backdrop)",
            p_accent: "High-Energy Accent (rim light, focal glow & CTA trigger)",
            p_surface: "Atmospheric Midtone Surface (gradient sweep & material base)",
            p_light: "Luminous Highlight Neutral (specular sheen & clean typography)",
        }

        image_prompts: list[ImagePromptSpec] = []
        slot_titles = {
            "hero_banner": f"{req.brand_name} — Hero Launch Spotlight",
            "instagram_square": f"{req.brand_name} — Tactile Scroll-Stopper",
            "story_reel_vertical": f"{req.brand_name} — Vertical Kinetic Reveal",
        }
        for spec in aspect_specs:
            slot = spec["slot"]
            prompt = (
                f"Commercial studio photography and editorial art direction for {req.brand_name}: "
                f"{req.product_description}. Visual concept: {metaphor}. "
                f"Target audience vibe: {req.target_audience}. Brand tone: {req.brand_tone}. "
                f"Lighting: {lighting} Composition: {spec['composition']} "
                f"Integrate the exact 5-color palette: primary {p_primary}, deep backdrop {p_deep}, "
                f"rim accent {p_accent}, surface {p_surface}, luminous specular highlights {p_light}. "
                f"Ultra-crisp 8K studio finish, photorealistic materials, clean editorial negative space "
                f"for typography overlay, no garbled text, no watermarks."
            )
            image_prompts.append(
                ImagePromptSpec(
                    slot=slot,
                    title=slot_titles.get(slot, f"{req.brand_name} — {spec['label']}"),
                    platform=spec["platform"],
                    aspect_ratio=spec["aspect_ratio"],
                    width=spec["width"],
                    height=spec["height"],
                    prompt=prompt,
                    lighting_notes=lighting,
                    composition_notes=spec["composition"],
                    alt_text=(
                        f"{req.brand_name} {spec['label']} ({spec['aspect_ratio']}) featuring "
                        f"{metaphor} in palette {', '.join(palette[:3])}"
                    ),
                )
            )

        storyboard = [
            StoryboardScene(
                scene_number=1,
                beat_name="Visual Hook",
                timecode="0.0s - 3.0s",
                camera_motion=(
                    "Whip-pan snap into extreme 120fps macro dolly-in across product silhouette"
                ),
                visual_action=(
                    f"Tight tactile close-up of {req.brand_name} emerging from {p_deep} shadow "
                    f"as a razor-sharp slice of {p_accent} light sweeps across its signature texture."
                ),
                lighting_cue=(
                    f"Strobe rim-light flash in {p_accent} slicing through subtle studio haze."
                ),
                on_screen_text=f"STOP SETTLING. MEET {req.brand_name.upper()}.",
                audio_sfx_cue="Sub-bass riser -> crisp tactile snap hit on frame 18.",
            ),
            StoryboardScene(
                scene_number=2,
                beat_name="Feature & Lifestyle Reveal",
                timecode="3.0s - 10.0s",
                camera_motion=(
                    "Fluid 180-degree orbital gimbal arc transitioning via match-cut into a "
                    "handheld lifestyle pull-back"
                ),
                visual_action=(
                    f"Seamless orbit reveals {req.product_description} in authentic motion with "
                    f"{req.target_audience}, bathed in {p_primary} and {p_surface} ambient tones "
                    f"while crisp kinetic feature callouts lock onto key surfaces."
                ),
                lighting_cue=(
                    f"45° key light opens to reveal rich material detail with warm {p_light} bounce."
                ),
                on_screen_text="CRAFTED FOR IMPACT. ZERO COMPROMISE.",
                audio_sfx_cue="Upbeat rhythmic percussion groove + soft air whoosh on match-cut.",
            ),
            StoryboardScene(
                scene_number=3,
                beat_name="Hero Lockup & CTA",
                timecode="10.0s - 15.0s",
                camera_motion=(
                    "Slow dramatic crane-out push settling into a symmetrical studio hero pedestal lockup"
                ),
                visual_action=(
                    f"{req.brand_name} stands centered on a sleek {p_surface} plinth with a "
                    f"luminous {p_accent} halo behind it; brand wordmark and launch CTA animate "
                    f"cleanly into the negative-space frame."
                ),
                lighting_cue=(
                    f"Full studio key + dual {p_primary}/{p_accent} halo backlight holding crisp contrast."
                ),
                on_screen_text=f"{req.brand_name.upper()} — EXPERIENCE THE LAUNCH",
                audio_sfx_cue="Melodic synth chord resolve + subtle signature brand chime.",
            ),
        ]

        return VisualDirectionPlan(
            creative_direction=creative_direction,
            visual_metaphor=metaphor,
            lighting_style=lighting,
            mood_keywords=mood,
            color_palette=palette,
            color_roles=color_roles,
            typography_direction=typography,
            image_prompts=image_prompts,
            video_storyboard=storyboard,
        )

    @staticmethod
    def _render_visual_brief_markdown(
        *,
        req: CampaignRequest,
        plan: VisualDirectionPlan,
        assets: list[VisualAsset],
        storyboard_path: Path,
    ) -> str:
        palette_lines = "\n".join(
            f"- `{hx}` — {plan.color_roles.get(hx, 'Brand Token')}"
            for hx in plan.color_palette
        )
        asset_lines = "\n".join(
            f"- **{a.title}** (`{a.asset_id}` | `{a.platform}` | `{a.aspect_ratio}` | "
            f"{a.width}x{a.height}): `{a.asset_url}`"
            for a in assets
        )
        scene_lines = "\n".join(
            f"#### Scene {s.scene_number} — {s.beat_name} (`{s.timecode}`)\n"
            f"- **Camera Motion:** {s.camera_motion}\n"
            f"- **Visual Action:** {s.visual_action}\n"
            f"- **Lighting Cue:** {s.lighting_cue}\n"
            f"- **On-Screen Super:** `{s.on_screen_text}`\n"
            f"- **Audio / SFX:** {s.audio_sfx_cue}"
            for s in plan.video_storyboard
        )

        return (
            f"## Visual Direction Brief — {req.brand_name}\n\n"
            f"### 1. Visual Concept & Art Direction\n"
            f"{plan.creative_direction}\n\n"
            f"- **Visual Metaphor:** {plan.visual_metaphor}\n"
            f"- **Lighting Physics:** {plan.lighting_style}\n"
            f"- **Mood Keywords:** {', '.join(plan.mood_keywords)}\n"
            f"- **Typography Direction:** {plan.typography_direction}\n\n"
            f"### 2. 5-Hex Color Palette\n"
            f"{palette_lines}\n\n"
            f"### 3. Generated Multi-Aspect Visual Assets\n"
            f"{asset_lines}\n\n"
            f"### 4. 3-Scene Promotional Video Storyboard (15s Cut)\n"
            f"_Storyboard artifact: `{storyboard_path.name}`_\n\n"
            f"{scene_lines}\n"
        )


__all__ = [
    "CANONICAL_SLOTS",
    "EventEmitter",
    "VisualAgent",
    "inspect_platform_aspect_specs",
    "normalize_five_hex_palette",
]
