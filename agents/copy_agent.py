"""Copy Agent (`@copy_pixelate`) built on AdaL / AdalFlow & Finch Skills.

Workflow:
  1. Receives the original `CampaignRequest` + `VisualOutput` handed off from
     `@visual_pixelate` via BAND room mention & shared memory.
  2. Dynamically loads BOTH `ad_copy_conversion.SKILL.md` and
     `social_platform_formatter.SKILL.md` via `FinchSkillLoader`.
  3. Runs AdalFlow `FunctionTool` `extract_visual_cues` to translate the Visual
     Agent's `creative_direction`, 5-hex `color_palette`, `mood_keywords`,
     `typography_direction`, and `visual_brief_markdown` into concrete sensory
     motifs and asset-to-platform pairings.
  4. Executes `AdalAgentHarness` structured planner (`AdalCopyPlanDataClass` +
     `CopyDraftPlan`) applying AIDA & PAS conversion frameworks to produce punchy
     headlines, subheadlines, platform-tailored captions (Instagram, LinkedIn,
     high-converting Paid Ad Primary Text + CTA, plus any extra requested
     channels), hashtags, and email subject lines.
  5. Runs AdalFlow `FunctionTool` `audit_copy_quality` to strip AI clichés,
     normalize hashtags, bind `linked_asset_id`s, and return validated `CopyOutput`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from agents.adal_harness import AdalAgentHarness, AdalSessionMemory
from agents.contracts import (
    AdalCopyPlanDataClass,
    AgentEvent,
    AgentHandle,
    CampaignRequest,
    CopyDraftPlan,
    CopyOutput,
    EventType,
    PlatformCopy,
    VisualOutput,
)
from agents.skill_loader import FinchSkillLoader
from agents.visual_agent import _resolve_campaigns_root

logger = logging.getLogger(__name__)

EventEmitter = Callable[[AgentEvent | dict[str, Any]], Awaitable[None] | None]

BANNED_CLICHES = (
    "elevate your game",
    "game-changer",
    "unleash the power",
    "in today's fast-paced world",
    "revolutionary synergy",
    "delve into",
)


def _truncate_words(text: str, max_len: int) -> str:
    """Truncate text cleanly at a word boundary without mid-word cuts."""
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    clipped = cleaned[: max_len - 1].rsplit(" ", 1)[0].rstrip(".,;:—- ")
    return f"{clipped}…" if clipped else cleaned[: max_len - 1] + "…"


def _describe_hex_energy(hex_code: str) -> str:
    """Translate a `#RRGGBB` hex token into an editorial color mood descriptor."""
    cleaned = hex_code.strip().lstrip("#")
    if len(cleaned) != 6:
        return "vivid studio tone"
    try:
        r, g, b = int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16)
    except ValueError:
        return "vivid studio tone"

    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    if luminance < 0.18:
        return "midnight obsidian"
    if luminance > 0.86:
        return "luminous alabaster"
    if r > 180 and g < 110 and b < 110:
        return "ember coral"
    if r > 180 and g > 140 and b < 110:
        return "warm amber gold"
    if b > 180 and g > 150 and r < 110:
        return "electric cyan"
    if r > 120 and b > 170:
        return "ultraviolet indigo"
    if g > 130 and r < 110:
        return "botanical emerald"
    return "sculpted studio chroma"


def extract_visual_cues(visual_output_json: str) -> dict[str, Any]:
    """Analyze VisualOutput handoff JSON to extract sensory motifs, palette mood, and asset bindings.

    Args:
        visual_output_json: JSON-serialized `VisualOutput` handed off from `@visual_pixelate`.

    Returns:
        Structured dict with color mood descriptors, visual metaphor, lighting cue,
        and platform-to-asset_id pairing map.
    """
    data = json.loads(visual_output_json)
    palette = data.get("color_palette") or []
    color_moods = [
        {"hex": hx, "mood": _describe_hex_energy(hx)} for hx in palette[:5]
    ]

    brief = str(data.get("visual_brief_markdown") or "")
    metaphor_match = re.search(r"\*\*Visual Metaphor:\*\*\s*(.+)", brief)
    lighting_match = re.search(r"\*\*Lighting Physics:\*\*\s*(.+)", brief)

    assets = data.get("assets") or []
    by_platform: dict[str, str] = {}
    hero_id: str | None = None
    square_id: str | None = None
    vertical_id: str | None = None

    for asset in assets:
        aid = asset.get("asset_id")
        plat = str(asset.get("platform") or "").lower()
        aspect = str(asset.get("aspect_ratio") or "")
        if aid:
            by_platform[plat] = aid
            if aspect == "16:9" or plat == "web_banner":
                hero_id = hero_id or aid
            elif aspect == "1:1" or plat == "instagram":
                square_id = square_id or aid
            elif aspect == "9:16" or "story" in plat:
                vertical_id = vertical_id or aid

    fallback_asset_id = assets[0].get("asset_id") if assets else None
    asset_bindings = {
        "web_banner": by_platform.get("web_banner") or hero_id or fallback_asset_id,
        "linkedin": by_platform.get("linkedin") or hero_id or square_id or fallback_asset_id,
        "x": by_platform.get("x") or hero_id or fallback_asset_id,
        "instagram": by_platform.get("instagram") or square_id or fallback_asset_id,
        "paid_ad": square_id or hero_id or fallback_asset_id,
        "instagram_story": by_platform.get("instagram_story") or vertical_id or square_id or fallback_asset_id,
        "tiktok": vertical_id or square_id or fallback_asset_id,
    }

    return {
        "creative_direction": data.get("creative_direction", ""),
        "visual_metaphor": metaphor_match.group(1).strip() if metaphor_match else "",
        "lighting_cue": lighting_match.group(1).strip() if lighting_match else "",
        "typography_direction": data.get("typography_direction", ""),
        "mood_keywords": data.get("mood_keywords") or [],
        "color_moods": color_moods,
        "asset_bindings": asset_bindings,
        "band_memory_id": data.get("band_memory_id"),
    }


def audit_copy_quality(
    platform_copies_json: str, asset_bindings_json: str, brand_name: str
) -> list[dict[str, Any]]:
    """Enforce Finch skill guardrails: strip clichés, normalize hashtags, and bind asset IDs.

    Args:
        platform_copies_json: JSON list of `PlatformCopy` dicts.
        asset_bindings_json: JSON dict mapping platform names to `VisualAsset.asset_id`.
        brand_name: Brand name used to ensure branded hashtag integrity.

    Returns:
        Cleaned, schema-compliant list of `PlatformCopy` dicts.
    """
    copies = json.loads(platform_copies_json)
    bindings: dict[str, str | None] = json.loads(asset_bindings_json)
    brand_tag = "#" + "".join(ch for ch in brand_name if ch.isalnum())

    max_hashtags = {
        "instagram": 8,
        "instagram_story": 4,
        "linkedin": 5,
        "paid_ad": 2,
        "x": 2,
        "web_banner": 1,
    }

    cleaned: list[dict[str, Any]] = []
    for item in copies:
        platform = str(item.get("platform") or "instagram").strip().lower().replace(" ", "_")
        headline = str(item.get("headline") or "").strip()[:240]
        subheadline = item.get("subheadline")
        if isinstance(subheadline, str):
            subheadline = subheadline.strip()[:400] or None
        body = str(item.get("body_copy") or "").strip()[:4000]
        cta = str(item.get("call_to_action") or "Explore Now").strip()[:160]

        # Anti-cliché sweep
        for cliche in BANNED_CLICHES:
            pattern = re.compile(re.escape(cliche), re.IGNORECASE)
            headline = pattern.sub("stand apart", headline)
            body = pattern.sub("built to stand apart", body)

        # Normalize hashtags
        raw_tags = item.get("hashtags") or []
        norm_tags: list[str] = []
        cap = max_hashtags.get(platform, 5)
        for tag in raw_tags:
            token = re.sub(r"[^a-zA-Z0-9_]", "", str(tag).lstrip("#"))
            if token:
                formatted = f"#{token}"
                if formatted.lower() not in {t.lower() for t in norm_tags}:
                    norm_tags.append(formatted)
        if cap > 0 and brand_tag != "#" and brand_tag.lower() not in {t.lower() for t in norm_tags}:
            norm_tags.insert(0, brand_tag)
        norm_tags = norm_tags[:cap]

        # Enforce X character discipline
        if platform in {"x", "twitter"} and len(body) > 270:
            body = body[:267].rstrip() + "..."

        linked_id = item.get("linked_asset_id") or bindings.get(platform) or bindings.get("instagram")

        cleaned.append(
            {
                "platform": platform,
                "headline": headline,
                "subheadline": subheadline,
                "body_copy": body,
                "call_to_action": cta,
                "hashtags": norm_tags,
                "linked_asset_id": linked_id,
            }
        )

    return cleaned


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
        sender=AgentHandle.COPY.value,
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


class CopyAgent:
    """`@copy_pixelate` — Conversion Copywriter & Channel Strategist powered by AdaL + Finch."""

    SKILL_IDS = ["ad_copy_conversion", "social_platform_formatter"]

    def __init__(
        self,
        *,
        skill_loader: FinchSkillLoader | None = None,
        llm_provider: str | None = None,
    ) -> None:
        self.skill_loader = skill_loader or FinchSkillLoader()
        self.harness = AdalAgentHarness(
            name="CopyPixelateAgent",
            agent_handle=AgentHandle.COPY.value,
            role_desc=(
                "You are @copy_pixelate, a senior Direct-Response Conversion Copywriter and "
                "Multi-Channel Social Strategist inside Agent Pixelate. You receive visual art "
                "direction from @visual_pixelate via BAND handoff and craft punchy headlines, "
                "subheadlines, Instagram & LinkedIn captions, hashtags, and AIDA/PAS high-converting "
                "paid ad copy that explicitly mirrors the imagery's lighting, color mood, and visual motifs."
            ),
            tools=[
                self.skill_loader.as_adal_tool_fn(),
                extract_visual_cues,
                audit_copy_quality,
            ],
            data_class=AdalCopyPlanDataClass,
            preferred_provider=llm_provider,
        )

    async def run(
        self,
        req: CampaignRequest,
        visual_out: VisualOutput,
        emit_event: EventEmitter | None = None,
        *,
        room_id: str | None = None,
        output_dir: Path | str | None = None,
    ) -> CopyOutput:
        """Execute the full Copy Agent workflow and return validated `CopyOutput`."""
        cid = visual_out.campaign_id
        rid = room_id or f"room_{cid}"
        campaigns_root = _resolve_campaigns_root(output_dir)
        campaign_dir = campaigns_root / cid
        campaign_dir.mkdir(parents=True, exist_ok=True)

        session_memory = AdalSessionMemory(
            campaign_id=cid,
            agent_handle=AgentHandle.COPY.value,
            session_dir=campaign_dir,
        )

        memory_refs = [visual_out.band_memory_id] if visual_out.band_memory_id else []

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_STARTED,
            message=(
                f"{AgentHandle.COPY.value} received BAND handoff from {AgentHandle.VISUAL.value} "
                f"(memory `{visual_out.band_memory_id or 'inline'}`). Initializing AdaL/AdalFlow harness..."
            ),
            payload={"band_memory_refs": memory_refs, "harness": "adal_adalflow"},
        )

        # 1. Dynamically load BOTH Finch skills (`ad_copy_conversion` + `social_platform_formatter`)
        loaded_skills = self.skill_loader.load_many(self.SKILL_IDS)
        for skill in loaded_skills:
            session_memory.record_skill_load(skill.skill_id, skill.version, skill.provider)

        combined_skill_instructions = "\n\n".join(
            s.render_prompt_block() for s in loaded_skills
        )

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_THINKING,
            message=(
                f"Loaded Finch skills: {', '.join(f'`{s.filename}`' for s in loaded_skills)} — "
                f"applying AIDA/PAS frameworks and platform formatting envelopes."
            ),
            payload={"skills": [s.summary_card() for s in loaded_skills]},
        )

        # 2. Run AdalFlow tool `extract_visual_cues` on the Visual Agent's handoff
        visual_cues: dict[str, Any] = await self.harness.execute_tool(
            "extract_visual_cues",
            session_memory=session_memory,
            visual_output_json=visual_out.model_dump_json(),
        )

        target_platforms = self._resolve_target_platforms(req)

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.AGENT_THINKING,
            message=(
                f"Decoded visual motifs from {AgentHandle.VISUAL.value}: "
                f"palette mood ({', '.join(c['mood'] for c in visual_cues['color_moods'][:3])}), "
                f"mood keywords ({', '.join(visual_cues['mood_keywords'][:4])}). "
                f"Writing aligned copy for {', '.join(target_platforms)}..."
            ),
            payload={
                "visual_cues": visual_cues,
                "target_platforms": target_platforms,
            },
        )

        # 3. Generate strict structured CopyDraftPlan via AdaL / AdalFlow Generator
        user_prompt = self._build_planner_prompt(req, visual_out, visual_cues, target_platforms)
        plan, exec_mode = await self.harness.generate_structured(
            schema_cls=CopyDraftPlan,
            user_prompt=user_prompt,
            skill_instructions=combined_skill_instructions,
            session_memory=session_memory,
            fallback_builder=lambda: self._build_deterministic_copy_plan(
                req, visual_out, visual_cues, target_platforms
            ),
            extra_schema_notes=(
                "STRICT REQUIREMENTS:\n"
                f"- `platform_copies` MUST include dedicated entries for ALL of: {json.dumps(target_platforms)}.\n"
                "- Each `platform_copies` item MUST have exact keys: `platform`, `headline`, "
                "`subheadline`, `body_copy`, `call_to_action`, `hashtags`, `linked_asset_id`.\n"
                "- Copy MUST explicitly echo visual motifs, color mood, or lighting from @visual_pixelate.\n"
                "- Include a `paid_ad` entry structured with AIDA/PAS (Primary Text + high-converting CTA).\n"
                "- Zero generic AI clichés."
            ),
        )

        # 4. Run AdalFlow tool `audit_copy_quality` to guarantee strict platform formatting & asset bindings
        audited_dicts: list[dict[str, Any]] = await self.harness.execute_tool(
            "audit_copy_quality",
            session_memory=session_memory,
            platform_copies_json=json.dumps([p.model_dump() for p in plan.platform_copies]),
            asset_bindings_json=json.dumps(visual_cues["asset_bindings"]),
            brand_name=req.brand_name,
        )

        # Ensure every mandatory channel is present even if a live LLM dropped one
        present_platforms = {d["platform"] for d in audited_dicts}
        if not set(target_platforms).issubset(present_platforms):
            fallback_plan = self._build_deterministic_copy_plan(
                req, visual_out, visual_cues, target_platforms
            )
            for fp in fallback_plan.platform_copies:
                if fp.platform not in present_platforms:
                    audited_dicts.append(fp.model_dump())

        validated_platform_copies = [PlatformCopy.model_validate(d) for d in audited_dicts]

        copy_output = CopyOutput(
            campaign_id=cid,
            agent_handle=AgentHandle.COPY.value,
            campaign_tagline=plan.campaign_tagline,
            brand_voice_summary=plan.brand_voice_summary,
            key_messages=plan.key_messages,
            platform_copies=validated_platform_copies,
            email_subject_lines=plan.email_subject_lines,
            band_memory_refs=memory_refs,
        )

        session_memory.put_context("copy_output", copy_output.model_dump(mode="json"))
        session_memory.put_context("copy_execution_mode", exec_mode)

        await _safe_emit(
            emit_event,
            campaign_id=cid,
            room_id=rid,
            event_type=EventType.COPY_COMPLETED,
            message=(
                f"{AgentHandle.COPY.value} finished aligned campaign copy ({exec_mode}) — "
                f"Tagline: \"{copy_output.campaign_tagline}\" across "
                f"{len(copy_output.platform_copies)} channel(s)."
            ),
            payload={
                "execution_mode": exec_mode,
                "copy_output": copy_output.model_dump(mode="json"),
            },
        )

        return copy_output

    @staticmethod
    def _resolve_target_platforms(req: CampaignRequest) -> list[str]:
        """Guarantee Instagram, LinkedIn, and Paid Ad alongside all requested platforms."""
        ordered: list[str] = []
        for plat in ["instagram", "linkedin", "paid_ad", *req.platforms]:
            cleaned = plat.strip().lower().replace(" ", "_")
            if cleaned and cleaned not in ordered:
                ordered.append(cleaned)
        return ordered

    @staticmethod
    def _build_planner_prompt(
        req: CampaignRequest,
        visual_out: VisualOutput,
        visual_cues: dict[str, Any],
        target_platforms: list[str],
    ) -> str:
        return (
            f"Write conversion-engineered, visually aligned campaign copy for:\n"
            f"- Brand Name: {req.brand_name}\n"
            f"- Product Description: {req.product_description}\n"
            f"- Target Audience: {req.target_audience}\n"
            f"- Campaign Goal: {req.campaign_goal}\n"
            f"- Brand Tone: {req.brand_tone}\n"
            f"- Additional Notes: {req.additional_notes or 'None'}\n\n"
            f"=== VISUAL HANDOFF FROM @visual_pixelate (MEMORY: {visual_out.band_memory_id}) ===\n"
            f"- Creative Direction: {visual_out.creative_direction}\n"
            f"- 5-Hex Color Palette: {', '.join(visual_out.color_palette)}\n"
            f"- Color Mood Translation: {json.dumps(visual_cues['color_moods'])}\n"
            f"- Mood Keywords: {', '.join(visual_out.mood_keywords)}\n"
            f"- Typography Direction: {visual_out.typography_direction}\n"
            f"- Visual Brief & 3-Scene Storyboard:\n{visual_out.visual_brief_markdown}\n\n"
            f"- Asset Bindings (`linked_asset_id` per platform): {json.dumps(visual_cues['asset_bindings'])}\n"
            f"- Required Platforms: {json.dumps(target_platforms)}\n\n"
            f"Return a single strict JSON object matching `CopyDraftPlan`."
        )

    @staticmethod
    def _build_deterministic_copy_plan(
        req: CampaignRequest,
        visual_out: VisualOutput,
        visual_cues: dict[str, Any],
        target_platforms: list[str],
    ) -> CopyDraftPlan:
        """High-converting deterministic copy synthesis explicitly mirroring the VisualOutput."""
        brand = req.brand_name
        brand_slug = "".join(ch for ch in brand if ch.isalnum()) or "AgentPixelate"
        moods = visual_out.mood_keywords or ["kinetic", "high-contrast", "modern"]
        lead_mood = moods[0].capitalize()
        second_mood = moods[1] if len(moods) > 1 else "crisp"

        color_moods = visual_cues.get("color_moods") or []
        primary_color_feel = color_moods[0]["mood"] if len(color_moods) > 0 else "bold studio"
        accent_color_feel = color_moods[2]["mood"] if len(color_moods) > 2 else "electric rim-light"
        metaphor = visual_cues.get("visual_metaphor") or f"sculpted studio light around {brand}"
        bindings: dict[str, str | None] = visual_cues.get("asset_bindings") or {}

        campaign_tagline = f"{brand}: {lead_mood} Clarity, Built to Cut Through."
        brand_voice_summary = (
            f"{req.brand_tone} voice tuned for {req.target_audience}, echoing @visual_pixelate's "
            f"{primary_color_feel} and {accent_color_feel} aesthetic with sharp, zero-fluff rhythm "
            f"matched to {visual_out.typography_direction[:110]}."
        )

        key_messages = [
            f"Built for {req.target_audience}: {req.product_description}",
            f"Visual-first identity: {metaphor} — unmistakable on screen and in hand.",
            f"Engineered to {req.campaign_goal.lower()} with zero filler and immediate payoff.",
            f"{lead_mood}, {second_mood} craft from the first glance to daily ritual.",
        ]

        platform_copies: list[PlatformCopy] = []
        for platform in target_platforms:
            linked_id = bindings.get(platform) or bindings.get("instagram")

            if platform == "instagram":
                platform_copies.append(
                    PlatformCopy(
                        platform="instagram",
                        headline=f"Step into the {accent_color_feel}. Meet {brand}.",
                        subheadline=f"{lead_mood} design meets everyday performance for {req.target_audience}.",
                        body_copy=(
                            f"Caught in {accent_color_feel} light and built to stop the scroll.\n\n"
                            f"{req.product_description}\n\n"
                            f"No muted routines. No half-measures. Just {brand} — crafted with a "
                            f"{req.brand_tone.lower()} edge for {req.target_audience} who move first.\n\n"
                            f"Tap the link in bio to claim the launch drop and tell us which frame hits hardest."
                        ),
                        call_to_action="Shop the Launch Drop",
                        hashtags=[
                            f"#{brand_slug}",
                            "#LaunchDrop",
                            "#DesignForward",
                            "#BuiltDifferent",
                            "#VisualCraft",
                            "#AgentPixelate",
                        ],
                        linked_asset_id=linked_id,
                    )
                )
            elif platform == "linkedin":
                platform_copies.append(
                    PlatformCopy(
                        platform="linkedin",
                        headline=f"Why we built {brand} for {req.target_audience}",
                        subheadline="A new bar for craft, clarity, and category momentum.",
                        body_copy=(
                            f"Most launches blend into the feed before your thumb even slows down.\n\n"
                            f"With {brand}, we started from one conviction: {req.target_audience} "
                            f"deserve something engineered with unmistakable focus.\n\n"
                            f"What sets {brand} apart:\n"
                            f"→ Product truth: {req.product_description}\n"
                            f"→ Creative signature: {metaphor}, anchored in {primary_color_feel} contrast.\n"
                            f"→ Built for outcome: {req.campaign_goal}.\n\n"
                            f"Explore the full launch story and see how the visual system comes alive."
                        ),
                        call_to_action="Explore the Launch Story",
                        hashtags=[
                            f"#{brand_slug}",
                            "#ProductLaunch",
                            "#BrandStrategy",
                            "#CreativeDirection",
                        ],
                        linked_asset_id=linked_id,
                    )
                )
            elif platform == "paid_ad":
                # PAS + AIDA high-converting Paid Social Primary Text + CTA
                platform_copies.append(
                    PlatformCopy(
                        platform="paid_ad",
                        headline=f"{brand}: Cut Through the Noise",
                        subheadline=f"Zero compromise. Made for {req.target_audience}.",
                        body_copy=(
                            f"Tired of settling for forgettable options that slow you down? "
                            f"Every minute wasted on mediocre gear costs momentum you never get back.\n\n"
                            f"Meet {brand} — {req.product_description}\n\n"
                            f"• Sharp {lead_mood.lower()} performance built specifically for {req.target_audience}\n"
                            f"• Signature {accent_color_feel} design you spot across the room\n"
                            f"• Launch-day access engineered to {req.campaign_goal.lower()}\n\n"
                            f"Claim the limited launch edition before first-batch inventory closes."
                        ),
                        call_to_action="Claim Launch Drop",
                        hashtags=[f"#{brand_slug}", "#LaunchEdition"],
                        linked_asset_id=linked_id,
                    )
                )
            elif platform == "web_banner":
                platform_copies.append(
                    PlatformCopy(
                        platform="web_banner",
                        headline=f"{brand}. {lead_mood} by Design.",
                        subheadline=_truncate_words(req.product_description, 125),
                        body_copy=(
                            f"Bathed in {accent_color_feel} contrast and tailored for {req.target_audience}. "
                            f"Experience {brand} today — crafted to {req.campaign_goal.lower()}."
                        ),
                        call_to_action="Get Early Access",
                        hashtags=[f"#{brand_slug}"],
                        linked_asset_id=linked_id,
                    )
                )
            elif platform in {"x", "twitter"}:
                short_prod = _truncate_words(req.product_description, 110).rstrip(".")
                short_aud = _truncate_words(req.target_audience, 55)
                x_body = _truncate_words(
                    f"{brand} just dropped: {short_prod} Sculpted in {accent_color_feel} contrast for {short_aud}.",
                    255,
                )
                platform_copies.append(
                    PlatformCopy(
                        platform="x",
                        headline=f"Meet {brand}. Zero filler.",
                        subheadline=f"Built for {short_aud}.",
                        body_copy=x_body,
                        call_to_action="See the Drop",
                        hashtags=[f"#{brand_slug}", "#LaunchDay"],
                        linked_asset_id=linked_id,
                    )
                )
            else:
                platform_copies.append(
                    PlatformCopy(
                        platform=platform,
                        headline=f"{brand} — {lead_mood} Launch Frame",
                        subheadline=f"Tailored for {req.target_audience}.",
                        body_copy=(
                            f"Watch {metaphor} come alive in 15 seconds.\n\n"
                            f"{req.product_description} Built to {req.campaign_goal.lower()}."
                        ),
                        call_to_action="Tap to Experience",
                        hashtags=[f"#{brand_slug}", f"#{platform.title().replace('_', '')}"],
                        linked_asset_id=linked_id,
                    )
                )

        email_subject_lines = [
            f"Cut through the dark: Meet {brand}",
            f"Built for {req.target_audience} — {brand} is live",
            f"Inside the {accent_color_feel} drop ({brand})",
            f"First-batch access to {brand} ends soon",
        ]

        return CopyDraftPlan(
            campaign_tagline=campaign_tagline,
            brand_voice_summary=brand_voice_summary,
            visual_alignment_notes=(
                f"Explicitly anchored headlines, hooks, and sensory cues in @visual_pixelate's "
                f"{primary_color_feel}/{accent_color_feel} palette, '{metaphor}', and 3-scene storyboard."
            ),
            key_messages=key_messages,
            platform_copies=platform_copies,
            email_subject_lines=email_subject_lines,
        )


__all__ = [
    "CopyAgent",
    "EventEmitter",
    "audit_copy_quality",
    "extract_visual_cues",
]
