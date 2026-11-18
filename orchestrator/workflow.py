"""Multi-agent campaign orchestration and `@mention` handoff workflow.

Drives the Agent Pixelate pipeline:
  1. Orchestrator creates a task-scoped Band room for the campaign.
  2. Orchestrator posts the initial campaign brief and `@mentions` `@visual_pixelate`.
  3. `@visual_pixelate` generates visual concepts + media assets into `/data/campaigns`.
  4. Visual brief is saved to shared Band Memories and posted to the Band room
     explicitly `@mention`ing `@copy_pixelate`.
  5. `@copy_pixelate` hydrates shared Band Memories and generates aligned multi-platform copy.
  6. Aggregated `CampaignResponse` is persisted and `CAMPAIGN_COMPLETED` is streamed.
"""

from __future__ import annotations

import asyncio
import html
import logging
import os
from typing import Any
from uuid import uuid4

import httpx

from orchestrator.band_client import BandAdapter
from orchestrator.config import Settings
from orchestrator.event_bus import AsyncEventBus
from orchestrator.storage import CampaignStore
from shared.schemas import (
    AgentEvent,
    AgentHandle,
    BandMemoryEntry,
    CampaignRequest,
    CampaignResponse,
    CampaignStatus,
    CopyOutput,
    EventType,
    PlatformCopy,
    VisualAsset,
    VisualOutput,
)

logger = logging.getLogger(__name__)

PLATFORM_ASPECT_RATIOS: dict[str, tuple[str, int, int]] = {
    "instagram": ("4:5", 900, 580),
    "instagram_story": ("9:16", 1080, 1920),
    "meta_ads": ("1:1", 900, 580),
    "tiktok": ("9:16", 1080, 1920),
    "linkedin": ("16:9", 900, 580),
    "x": ("16:9", 900, 580),
    "twitter": ("16:9", 900, 580),
    "web_banner": ("16:9", 900, 580),
    "youtube": ("16:9", 900, 580),
}

DEFAULT_PALETTE = ["#09090B", "#8B5CF6", "#06B6D4", "#272736", "#F8FAFC"]


class CampaignCoordinator:
    """Coordinates Band rooms, external agent dispatch, and fallback synthesis."""

    def __init__(
        self,
        settings: Settings,
        store: CampaignStore,
        event_bus: AsyncEventBus,
        band: BandAdapter,
    ) -> None:
        self.settings = settings
        self.store = store
        self.event_bus = event_bus
        self.band = band
        self._background_tasks: set[asyncio.Task[None]] = set()
        self._http: httpx.AsyncClient | None = None

        # Wire Band `@mention` routing directly to agent dispatchers
        self.band.register_mention_handler(
            AgentHandle.VISUAL.value, self._on_visual_mentioned
        )
        self.band.register_mention_handler(
            AgentHandle.COPY.value, self._on_copy_mentioned
        )

    async def startup(self) -> None:
        self._http = httpx.AsyncClient(timeout=self.settings.agents_dispatch_timeout_s)

    async def shutdown(self) -> None:
        for task in list(self._background_tasks):
            task.cancel()
        if self._background_tasks:
            await asyncio.gather(*self._background_tasks, return_exceptions=True)
        self._background_tasks.clear()

        if self._http is not None:
            await self._http.aclose()
            self._http = None

    def _spawn(self, coro: Any, name: str) -> asyncio.Task[None]:
        task: asyncio.Task[None] = asyncio.create_task(coro, name=name)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        return task

    async def start_campaign(self, request: CampaignRequest) -> CampaignResponse:
        """Create campaign state, initialize a Band room, and trigger `@visual_pixelate`."""
        campaign_id = f"camp_{uuid4().hex[:12]}"
        room = await self.band.create_campaign_room(campaign_id, request.brand_name)

        campaign = CampaignResponse(
            campaign_id=campaign_id,
            status=CampaignStatus.QUEUED,
            room_id=room.room_id,
            transport=room.transport,
            request=request,
        )
        await self.store.save_campaign(campaign)

        # Emit lifecycle events for room & identity readiness
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=room.room_id,
            sender=AgentHandle.ORCHESTRATOR.value,
            event_type=EventType.ROOM_INITIALIZED,
            message=(
                f"Initialized task-scoped Band room `{room.room_id}` with "
                f"{AgentHandle.VISUAL.value} and {AgentHandle.COPY.value} "
                f"(transport={room.transport})."
            ),
            payload={
                "room_id": room.room_id,
                "participants": room.participants,
                "transport": room.transport,
            },
            trigger_mentions=False,
        )

        # Save initial campaign brief into shared Band Memories
        brief_memory = await self.band.store_memory(
            campaign_id=campaign_id,
            room_id=room.room_id,
            author=AgentHandle.ORCHESTRATOR.value,
            key="campaign_brief",
            content=(
                f"Brand: {request.brand_name}\n"
                f"Product: {request.product_description}\n"
                f"Audience: {request.target_audience}\n"
                f"Goal: {request.campaign_goal}\n"
                f"Tone: {request.brand_tone}\n"
                f"Platforms: {', '.join(request.platforms)}"
            ),
            metadata={"type": "campaign_request"},
        )

        # Explicitly @mention @visual_pixelate to kick off the visual pipeline
        initial_prompt = (
            f"{AgentHandle.VISUAL.value} New campaign brief ready for **{request.brand_name}** "
            f"(memory `{brief_memory.memory_id}`). Generate {request.num_concepts} high-impact "
            f"visual concepts targeting {request.target_audience} across "
            f"{', '.join(request.platforms)}. When finished, store the structured visual brief "
            f"in Band Memory and hand off to the copywriting agent."
        )
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=room.room_id,
            sender=AgentHandle.ORCHESTRATOR.value,
            event_type=EventType.AGENT_MENTION,
            message=initial_prompt,
            payload={
                "target_agent": AgentHandle.VISUAL.value,
                "brief_memory_id": brief_memory.memory_id,
            },
            trigger_mentions=True,
        )

        latest = await self.store.get_campaign(campaign_id)
        return latest or campaign

    async def _on_visual_mentioned(self, event: AgentEvent) -> None:
        """Mention routing handler: triggered when `@visual_pixelate` is mentioned in a room."""
        if event.sender == AgentHandle.VISUAL.value:
            return
        campaign = await self.store.get_campaign(event.campaign_id)
        if campaign is None or campaign.visual_output is not None:
            return
        if campaign.status not in {CampaignStatus.QUEUED}:
            return

        await self.store.update_status(event.campaign_id, CampaignStatus.VISUAL_GENERATING)
        self._spawn(
            self._run_visual_stage(campaign),
            name=f"visual-{event.campaign_id}",
        )

    async def _on_copy_mentioned(self, event: AgentEvent) -> None:
        """Mention routing handler: triggered when `@visual_pixelate` mentions `@copy_pixelate`."""
        if event.sender == AgentHandle.COPY.value:
            return
        campaign = await self.store.get_campaign(event.campaign_id)
        if campaign is None or campaign.copy_output is not None:
            return
        if campaign.visual_output is None:
            # Copy stage waits until visual output has been persisted
            return
        if campaign.status == CampaignStatus.COPY_GENERATING:
            return

        await self.store.update_status(event.campaign_id, CampaignStatus.COPY_GENERATING)
        self._spawn(
            self._run_copy_stage(campaign),
            name=f"copy-{event.campaign_id}",
        )

    async def _run_visual_stage(self, campaign: CampaignResponse) -> None:
        """Dispatch to external `/agents` service or run deterministic local visual synthesis."""
        campaign_id = campaign.campaign_id
        room_id = campaign.room_id

        try:
            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=room_id,
                sender=AgentHandle.VISUAL.value,
                event_type=EventType.AGENT_STARTED,
                message=(
                    f"{AgentHandle.VISUAL.value} picked up the brief for "
                    f"**{campaign.request.brand_name}**. Crafting creative direction & assets..."
                ),
                trigger_mentions=False,
            )

            visual_output = await self._dispatch_remote_visual(campaign)
            if visual_output is not None:
                await self.handle_visual_output(campaign_id, visual_output)
                return

            if not self.settings.enable_local_agent_fallback:
                # External agent accepted async callback mode; wait for callback endpoint
                return

            visual_output = await self._synthesize_fallback_visual(campaign)
            await self.handle_visual_output(campaign_id, visual_output)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Visual stage failed for campaign %s", campaign_id)
            await self._fail_campaign(campaign_id, room_id, AgentHandle.VISUAL.value, str(exc))

    async def _dispatch_remote_visual(
        self, campaign: CampaignResponse
    ) -> VisualOutput | None:
        """Attempt to call the external `/agents` visual endpoint if configured."""
        if not self.settings.agents_service_url or self._http is None:
            return None

        url = f"{self.settings.agents_service_url.rstrip('/')}/agents/visual/generate"
        callback_url = (
            f"{self.settings.orchestrator_public_url.rstrip('/')}"
            f"/api/campaigns/{campaign.campaign_id}/callbacks/visual"
        )
        memories = await self.band.get_room_memories(campaign.campaign_id, campaign.room_id)
        try:
            resp = await self._http.post(
                url,
                json={
                    "campaign_id": campaign.campaign_id,
                    "room_id": campaign.room_id,
                    "request": campaign.request.model_dump(mode="json"),
                    "callback_url": callback_url,
                    "band_memories": [m.model_dump(mode="json") for m in memories],
                },
            )
            if resp.status_code == 202:
                # Remote agent will invoke our callback asynchronously
                return None
            if resp.status_code < 400:
                return VisualOutput.model_validate(resp.json())
            logger.warning(
                "Remote visual agent returned HTTP %s; falling back if enabled.",
                resp.status_code,
            )
        except httpx.HTTPError as exc:
            logger.warning("Remote visual agent unreachable (%s); using fallback.", exc)
        return None

    async def handle_visual_output(
        self, campaign_id: str, visual_output: VisualOutput
    ) -> CampaignResponse:
        """Persist VisualOutput, write Band Memory, and `@mention` `@copy_pixelate`."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign {campaign_id} not found")

        # 1. Persist structured visual brief into Shared Band Memories
        memory = await self.band.store_memory(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            author=AgentHandle.VISUAL.value,
            key="visual_brief",
            content=visual_output.visual_brief_markdown,
            metadata={
                "creative_direction": visual_output.creative_direction,
                "mood_keywords": visual_output.mood_keywords,
                "color_palette": visual_output.color_palette,
                "asset_ids": [a.asset_id for a in visual_output.assets],
                "asset_urls": [a.asset_url for a in visual_output.assets],
            },
        )
        visual_output.band_memory_id = memory.memory_id

        # 2. Save aggregated visual state
        updated = await self.store.set_visual_output(
            campaign_id, visual_output, status=CampaignStatus.HANDOFF_TO_COPY
        )

        # 3. Emit MEMORY_STORED and VISUAL_COMPLETED events
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.MEMORY_STORED,
            message=(
                f"Saved structured visual brief & {len(visual_output.assets)} asset references "
                f"to Band Memory `{memory.memory_id}`."
            ),
            payload={
                "memory_id": memory.memory_id,
                "key": memory.key,
                "asset_count": len(visual_output.assets),
            },
            trigger_mentions=False,
        )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.VISUAL_COMPLETED,
            message=(
                f"Visual concepts completed ({len(visual_output.assets)} assets). "
                f"Creative direction: {visual_output.creative_direction}"
            ),
            payload={
                "visual_output": visual_output.model_dump(mode="json"),
            },
            trigger_mentions=False,
        )

        # 4. Explicit Band `@mention` handoff to `@copy_pixelate`
        handoff_message = (
            f"{AgentHandle.COPY.value} Visual concepts and assets for "
            f"**{campaign.request.brand_name}** are ready! "
            f"Shared Band Memory ID: `{memory.memory_id}`.\n\n"
            f"{visual_output.visual_brief_markdown}\n\n"
            f"Please generate cohesive, conversion-focused copy tailored to each platform."
        )
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.AGENT_MENTION,
            message=handoff_message,
            payload={
                "handoff_from": AgentHandle.VISUAL.value,
                "handoff_to": AgentHandle.COPY.value,
                "band_memory_id": memory.memory_id,
            },
            trigger_mentions=True,
        )

        return updated or campaign

    async def _run_copy_stage(self, campaign: CampaignResponse) -> None:
        """Hydrate shared Band Memories and dispatch to `@copy_pixelate` (or fallback)."""
        campaign_id = campaign.campaign_id
        room_id = campaign.room_id

        try:
            memories = await self.band.get_room_memories(campaign_id, room_id)
            memory_ids = [m.memory_id for m in memories]

            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=room_id,
                sender=AgentHandle.COPY.value,
                event_type=EventType.AGENT_STARTED,
                message=(
                    f"{AgentHandle.COPY.value} received @mention handoff and hydrated "
                    f"{len(memories)} shared Band Memory item(s) ({', '.join(memory_ids)}). "
                    f"Drafting platform copy..."
                ),
                payload={"band_memory_refs": memory_ids},
                trigger_mentions=False,
            )

            copy_output = await self._dispatch_remote_copy(campaign, memories)
            if copy_output is not None:
                await self.handle_copy_output(campaign_id, copy_output)
                return

            if not self.settings.enable_local_agent_fallback:
                return

            copy_output = await self._synthesize_fallback_copy(campaign, memories)
            await self.handle_copy_output(campaign_id, copy_output)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Copy stage failed for campaign %s", campaign_id)
            await self._fail_campaign(campaign_id, room_id, AgentHandle.COPY.value, str(exc))

    async def _dispatch_remote_copy(
        self, campaign: CampaignResponse, memories: list[BandMemoryEntry]
    ) -> CopyOutput | None:
        """Attempt to call the external `/agents` copy endpoint if configured."""
        if not self.settings.agents_service_url or self._http is None:
            return None

        url = f"{self.settings.agents_service_url.rstrip('/')}/agents/copy/generate"
        callback_url = (
            f"{self.settings.orchestrator_public_url.rstrip('/')}"
            f"/api/campaigns/{campaign.campaign_id}/callbacks/copy"
        )
        try:
            resp = await self._http.post(
                url,
                json={
                    "campaign_id": campaign.campaign_id,
                    "room_id": campaign.room_id,
                    "request": campaign.request.model_dump(mode="json"),
                    "visual_output": (
                        campaign.visual_output.model_dump(mode="json")
                        if campaign.visual_output
                        else None
                    ),
                    "band_memories": [m.model_dump(mode="json") for m in memories],
                    "callback_url": callback_url,
                },
            )
            if resp.status_code == 202:
                return None
            if resp.status_code < 400:
                return CopyOutput.model_validate(resp.json())
            logger.warning(
                "Remote copy agent returned HTTP %s; falling back if enabled.",
                resp.status_code,
            )
        except httpx.HTTPError as exc:
            logger.warning("Remote copy agent unreachable (%s); using fallback.", exc)
        return None

    async def handle_copy_output(
        self, campaign_id: str, copy_output: CopyOutput
    ) -> CampaignResponse:
        """Persist CopyOutput and emit completion events."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign {campaign_id} not found")

        # Record final campaign copy in Band Memory for downstream recall
        await self.band.store_memory(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            author=AgentHandle.COPY.value,
            key="campaign_copy",
            content=(
                f"Tagline: {copy_output.campaign_tagline}\n"
                f"Voice: {copy_output.brand_voice_summary}\n"
                f"Platforms: {', '.join(p.platform for p in copy_output.platform_copies)}"
            ),
            metadata={"platform_count": len(copy_output.platform_copies)},
        )

        updated = await self.store.set_copy_output(
            campaign_id, copy_output, status=CampaignStatus.COMPLETED
        )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.COPY.value,
            event_type=EventType.COPY_COMPLETED,
            message=(
                f"Copywriting complete — Tagline: \"{copy_output.campaign_tagline}\" "
                f"across {len(copy_output.platform_copies)} platform(s)."
            ),
            payload={"copy_output": copy_output.model_dump(mode="json")},
            trigger_mentions=False,
        )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.ORCHESTRATOR.value,
            event_type=EventType.CAMPAIGN_COMPLETED,
            message=(
                f"Campaign `{campaign_id}` for **{campaign.request.brand_name}** is complete "
                f"and persisted to campaign storage."
            ),
            payload={
                "campaign_id": campaign_id,
                "status": CampaignStatus.COMPLETED.value,
            },
            trigger_mentions=False,
        )

        return updated or campaign

    async def _fail_campaign(
        self, campaign_id: str, room_id: str, sender: str, error_msg: str
    ) -> None:
        await self.store.update_status(campaign_id, CampaignStatus.FAILED, error=error_msg)
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=room_id,
            sender=sender,
            event_type=EventType.AGENT_ERROR,
            message=f"Pipeline error: {error_msg}",
            payload={"error": error_msg},
            trigger_mentions=False,
        )

    async def _synthesize_fallback_visual(
        self, campaign: CampaignResponse
    ) -> VisualOutput:
        """Generate real SVG visual concept assets into `/data/campaigns` when `/agents` is offline."""
        req = campaign.request
        palette = req.color_palette if len(req.color_palette) >= 2 else DEFAULT_PALETTE
        primary = palette[0]
        accent = palette[1]
        highlight = palette[2] if len(palette) > 2 else "#22D3EE"

        assets: list[VisualAsset] = []
        concept_angles = [
            ("Hero Launch Spotlight", "High-contrast studio lighting with geometric motion grid"),
            ("Lifestyle Moment", "Authentic editorial framing tailored to daily ritual"),
            ("Feature Deep-Dive", "Kinetic typography paired with macro product texture"),
            ("Social Proof Frame", "Clean modular layout optimized for thumb-stop retention"),
            ("Limited Drop Teaser", "Atmospheric gradient aura with crisp callout badge"),
            ("Conversion Banner", "Balanced negative space drawing eyes to CTA lockup"),
        ]

        selected_platforms = req.platforms
        pace_delay = 0.0 if os.environ.get("PYTEST_CURRENT_TEST") else 0.35
        for idx in range(req.num_concepts):
            if pace_delay:
                await asyncio.sleep(pace_delay)
            platform = selected_platforms[idx % len(selected_platforms)]
            aspect, width, height = PLATFORM_ASPECT_RATIOS.get(platform, ("1:1", 900, 580))
            angle_title, angle_style = concept_angles[idx % len(concept_angles)]
            asset_id = f"asset_{idx + 1}_{uuid4().hex[:6]}"
            filename = f"{asset_id}_{platform}.svg"

            svg_content = self._render_concept_svg(
                brand_name=req.brand_name,
                concept_title=angle_title,
                platform=platform,
                tone=req.brand_tone,
                primary=primary,
                accent=accent,
                highlight=highlight,
                width=width,
                height=height,
            )
            saved_path = await self.store.write_asset_bytes(
                campaign.campaign_id, filename, svg_content.encode("utf-8")
            )

            asset = VisualAsset(
                asset_id=asset_id,
                title=f"{req.brand_name} — {angle_title}",
                platform=platform,
                aspect_ratio=aspect,
                prompt_used=(
                    f"{req.brand_tone} marketing visual for {req.brand_name}: "
                    f"{req.product_description}. Style: {angle_style}. "
                    f"Palette: {', '.join(palette)}."
                ),
                file_path=str(saved_path),
                asset_url=f"/api/campaigns/{campaign.campaign_id}/assets/{filename}",
                mime_type="image/svg+xml",
                width=width,
                height=height,
                color_tokens=palette,
                alt_text=f"{req.brand_name} {angle_title} visual for {platform}",
            )
            assets.append(asset)

            await self.band.post_room_message(
                campaign_id=campaign.campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.VISUAL.value,
                event_type=EventType.ASSET_GENERATED,
                message=f"Generated visual concept {idx + 1}/{req.num_concepts}: {asset.title} ({platform}).",
                payload={"asset": asset.model_dump(mode="json")},
                trigger_mentions=False,
            )

        mood_keywords = [
            kw.strip()
            for kw in req.brand_tone.replace(" and ", ",").split(",")
            if kw.strip()
        ] or ["modern", "vibrant", "high-contrast"]

        creative_direction = (
            f"A {req.brand_tone.lower()} visual system for {req.brand_name} built around "
            f"high-contrast geometric framing, tactile product focus, and unmistakable "
            f"color blocking tailored to {req.target_audience}."
        )
        asset_bullets = "\n".join(
            f"- **{a.title}** (`{a.platform}`, `{a.aspect_ratio}`): {a.asset_url}"
            for a in assets
        )
        visual_brief_md = (
            f"### Visual Brief — {req.brand_name}\n"
            f"- **Creative Direction:** {creative_direction}\n"
            f"- **Palette:** {', '.join(palette)}\n"
            f"- **Mood:** {', '.join(mood_keywords)}\n"
            f"- **Typography:** Geometric sans-serif display headlines paired with crisp editorial body.\n"
            f"- **Generated Assets:**\n{asset_bullets}"
        )

        return VisualOutput(
            campaign_id=campaign.campaign_id,
            creative_direction=creative_direction,
            mood_keywords=mood_keywords,
            color_palette=palette,
            typography_direction="Bold geometric display sans + clean grotesk body",
            visual_brief_markdown=visual_brief_md,
            assets=assets,
        )

    async def _synthesize_fallback_copy(
        self, campaign: CampaignResponse, memories: list[BandMemoryEntry]
    ) -> CopyOutput:
        """Synthesize cohesive multi-platform copy aligned to VisualOutput when `/agents` is offline."""
        req = campaign.request
        visual = campaign.visual_output
        assets = visual.assets if visual else []
        brand_slug = "".join(ch for ch in req.brand_name if ch.isalnum())

        platform_copies: list[PlatformCopy] = []
        pace_delay = 0.0 if os.environ.get("PYTEST_CURRENT_TEST") else 0.4
        if pace_delay:
            await asyncio.sleep(pace_delay)
        for idx, platform in enumerate(req.platforms):
            linked = assets[idx % len(assets)] if assets else None
            if platform == "linkedin":
                headline = f"Rethinking the standard with {req.brand_name}"
                body = (
                    f"Built for {req.target_audience}: {req.product_description}\n\n"
                    f"Engineered with a {req.brand_tone.lower()} design philosophy to "
                    f"{req.campaign_goal.lower()} without compromise."
                )
                cta = "Explore the launch story"
            elif platform == "meta_ads":
                headline = f"{req.brand_name} — Built for {req.brand_tone} Impact"
                body = (
                    f"Upgrade your daily standard with {req.brand_name}. "
                    f"{req.product_description} Tailored specifically for {req.target_audience}."
                )
                cta = "Shop Now"
            elif platform in {"x", "twitter"}:
                headline = f"Meet {req.brand_name}. Built different."
                body = (
                    f"{req.product_description} Made for {req.target_audience} who refuse average."
                )
                cta = "Try it today"
            elif platform == "web_banner":
                headline = f"{req.brand_name} — Elevate Every Moment"
                body = f"{req.product_description}"
                cta = "Get Started Now"
            else:
                headline = f"Say hello to {req.brand_name}."
                body = (
                    f"{req.product_description}\n\n"
                    f"Crafted for {req.target_audience} with a {req.brand_tone.lower()} studio aesthetic."
                )
                cta = "Shop the drop"

            platform_copies.append(
                PlatformCopy(
                    platform=platform,
                    headline=headline,
                    subheadline=f"{req.campaign_goal}",
                    body_copy=body,
                    call_to_action=cta,
                    hashtags=[f"#{brand_slug}", "#AgentPixelate", f"#{platform}"],
                    linked_asset_id=linked.asset_id if linked else None,
                )
            )

        return CopyOutput(
            campaign_id=campaign.campaign_id,
            campaign_tagline=f"{req.brand_name}: {req.brand_tone.split(',')[0].strip()} by design.",
            brand_voice_summary=(
                f"{req.brand_tone} voice tailored to {req.target_audience}, aligned with "
                f"@visual_pixelate's visual brief."
            ),
            key_messages=[
                f"Core value: {req.product_description}",
                f"Audience fit: Purpose-built for {req.target_audience}",
                f"Objective: {req.campaign_goal}",
            ],
            platform_copies=platform_copies,
            email_subject_lines=[
                f"Introducing {req.brand_name} — ready for launch",
                f"Made for {req.target_audience}: Meet {req.brand_name}",
                f"Inside the new {req.brand_name} drop",
            ],
            band_memory_refs=[m.memory_id for m in memories],
        )

    @staticmethod
    def _render_concept_svg(
        *,
        brand_name: str,
        concept_title: str,
        platform: str,
        tone: str,
        primary: str,
        accent: str,
        highlight: str,
        width: int,
        height: int,
    ) -> str:
        safe_brand = html.escape(brand_name)
        safe_title = html.escape(concept_title)
        safe_platform = html.escape(platform.replace("_", " ").upper())
        safe_tone = html.escape(tone[:64])
        p_hex = html.escape(primary)
        a_hex = html.escape(accent)
        h_hex = html.escape(highlight)
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{p_hex}"/>
      <stop offset="55%" stop-color="#0D0D14"/>
      <stop offset="100%" stop-color="#07070A"/>
    </linearGradient>
    <radialGradient id="glowA" cx="76%" cy="32%" r="54%">
      <stop offset="0%" stop-color="{a_hex}" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="{a_hex}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="22%" cy="84%" r="48%">
      <stop offset="0%" stop-color="{h_hex}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="{h_hex}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="prism" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{a_hex}"/>
      <stop offset="55%" stop-color="{h_hex}"/>
      <stop offset="100%" stop-color="#14141E"/>
    </linearGradient>
    <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.08)"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#dotGrid)"/>
  <rect width="100%" height="100%" fill="url(#glowA)"/>
  <rect width="100%" height="100%" fill="url(#glowB)"/>

  <rect x="28" y="28" width="{width - 56}" height="{height - 56}" rx="22" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/>
  <line x1="28" y1="96" x2="{width - 28}" y2="96" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <circle cx="62" cy="62" r="5" fill="{h_hex}"/>
  <text x="78" y="67" fill="rgba(255,255,255,0.88)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="3.5">{safe_brand.upper()}</text>

  <rect x="{width - 236}" y="46" width="184" height="30" rx="15" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
  <text x="{width - 144}" y="66" text-anchor="middle" fill="{h_hex}" font-family="monospace" font-size="11" font-weight="600" letter-spacing="1.4">{safe_platform}</text>

  <g transform="translate({int(width * 0.60)}, {int(height * 0.24)})">
    <circle cx="130" cy="145" r="118" fill="none" stroke="{a_hex}" stroke-width="1.4" stroke-dasharray="8 7" opacity="0.5"/>
    <polygon points="130,24 242,145 130,266 18,145" fill="url(#prism)" opacity="0.9" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <polygon points="130,68 198,145 130,222 62,145" fill="none" stroke="{h_hex}" stroke-width="2" opacity="0.9"/>
    <circle cx="130" cy="145" r="28" fill="#09090B" fill-opacity="0.72" stroke="rgba(255,255,255,0.32)"/>
  </g>

  <g transform="translate(62, {int(height * 0.27)})">
    <rect x="0" y="0" width="154" height="26" rx="13" fill="{a_hex}" fill-opacity="0.18" stroke="{a_hex}" stroke-opacity="0.5"/>
    <text x="77" y="17" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" letter-spacing="1.4">@VISUAL_PIXELATE</text>

    <text x="0" y="92" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" letter-spacing="-1">{safe_brand[:22]}</text>
    <text x="0" y="138" fill="{h_hex}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">{safe_title[:36]}</text>
    <text x="0" y="176" fill="rgba(255,255,255,0.68)" font-family="system-ui, -apple-system, sans-serif" font-size="16">{safe_tone} Campaign Direction</text>

    <g transform="translate(0, 224)">
      <rect x="0" y="0" width="26" height="26" rx="7" fill="{p_hex}" stroke="rgba(255,255,255,0.3)"/>
      <rect x="34" y="0" width="26" height="26" rx="7" fill="{a_hex}" stroke="rgba(255,255,255,0.3)"/>
      <rect x="68" y="0" width="26" height="26" rx="7" fill="{h_hex}" stroke="rgba(255,255,255,0.3)"/>
      <text x="108" y="18" fill="rgba(255,255,255,0.55)" font-family="monospace" font-size="12">{a_hex} · {h_hex}</text>
    </g>
  </g>

  <text x="62" y="{height - 46}" fill="rgba(255,255,255,0.42)" font-family="monospace" font-size="11" letter-spacing="1.5">AGENT PIXELATE // LIVE ORCHESTRATOR RENDER</text>
  <text x="{width - 62}" y="{height - 46}" text-anchor="end" fill="rgba(255,255,255,0.42)" font-family="monospace" font-size="11">BAND SHARED ROOM</text>
</svg>
"""
