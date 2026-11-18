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
import base64
import html
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx

from orchestrator.band_client import BandAdapter
from orchestrator.config import Settings
from orchestrator.event_bus import AsyncEventBus
from orchestrator.storage import CampaignStore
from orchestrator.video_renderer import (
    AspectRatio,
    SHOT_STYLES,
    ShotStyle,
    VideoRenderSpec,
    render_campaign_video_mp4,
)
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

        # Track live BAND presence & initial delegation edge
        self.band.set_participant_status(campaign_id, AgentHandle.HUMAN.value, "online")
        self.band.set_participant_status(campaign_id, AgentHandle.ORCHESTRATOR.value, "working")
        self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "thinking")
        self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "idle")
        self.band.record_delegation(
            campaign_id=campaign_id,
            from_handle=AgentHandle.ORCHESTRATOR.value,
            to_handle=AgentHandle.VISUAL.value,
            reason=f"Initial visual brief for {request.brand_name}",
            memory_id=brief_memory.memory_id,
            status="dispatched",
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

        self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "online")
        self.band.complete_delegation(campaign_id, AgentHandle.VISUAL.value)

        require_approval = bool(
            campaign.request.metadata.get("require_handoff_approval", False)
        )
        already_approved = bool(
            campaign.request.metadata.get("_handoff_approved", False)
        )

        # 2. Save aggregated visual state
        next_status = (
            CampaignStatus.AWAITING_APPROVAL
            if (require_approval and not already_approved)
            else CampaignStatus.HANDOFF_TO_COPY
        )
        updated = await self.store.set_visual_output(
            campaign_id, visual_output, status=next_status
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

        # 4A. Human-in-the-Loop BAND Approval Gate (if enabled)
        if require_approval and not already_approved:
            self.band.set_participant_status(
                campaign_id, AgentHandle.VISUAL.value, "awaiting_approval"
            )
            self.band.record_delegation(
                campaign_id=campaign_id,
                from_handle=AgentHandle.VISUAL.value,
                to_handle=AgentHandle.COPY.value,
                reason="Awaiting human director approval before @copy_pixelate handoff",
                memory_id=memory.memory_id,
                status="awaiting_approval",
            )
            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.VISUAL.value,
                event_type=EventType.APPROVAL_REQUIRED,
                message=(
                    f"{AgentHandle.HUMAN.value} Visual direction and {len(visual_output.assets)} assets "
                    f"for **{campaign.request.brand_name}** are ready in Band Memory `{memory.memory_id}`. "
                    f"Approve to delegate to {AgentHandle.COPY.value}, or @mention {AgentHandle.VISUAL.value} "
                    f"with revision feedback."
                ),
                payload={
                    "band_memory_id": memory.memory_id,
                    "handoff_to": AgentHandle.COPY.value,
                    "pending_approval": True,
                },
                trigger_mentions=False,
            )
            return updated or campaign

        # 4B. Explicit Band `@mention` handoff to `@copy_pixelate`
        self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "thinking")
        self.band.record_delegation(
            campaign_id=campaign_id,
            from_handle=AgentHandle.VISUAL.value,
            to_handle=AgentHandle.COPY.value,
            reason=f"Visual brief handoff via Band Memory {memory.memory_id}",
            memory_id=memory.memory_id,
            status="dispatched",
        )
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

        self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "online")
        self.band.set_participant_status(campaign_id, AgentHandle.ORCHESTRATOR.value, "online")
        self.band.complete_delegation(campaign_id, AgentHandle.COPY.value)

        return updated or campaign

    async def approve_handoff(
        self,
        campaign_id: str,
        *,
        approver: str = AgentHandle.HUMAN.value,
        approved: bool = True,
        note: str | None = None,
    ) -> CampaignResponse:
        """Human-in-the-loop gate decision inside the BAND collaboration room."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign '{campaign_id}' not found")
        if campaign.visual_output is None:
            raise ValueError("Visual assets are not ready yet to approve.")

        if not approved:
            directive = (
                note.strip()
                if note and note.strip()
                else "Refine visual contrast and typography hierarchy."
            )
            await self.post_human_room_message(
                campaign_id=campaign_id,
                sender=approver,
                message=f"{AgentHandle.VISUAL.value} Revision requested before handoff: {directive}",
            )
            return (await self.store.get_campaign(campaign_id)) or campaign

        note_memory_id: str | None = None
        if note and note.strip():
            mem = await self.band.store_memory(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                author=approver,
                key="human_approval_note",
                content=note.strip(),
                metadata={"pinned": True, "stage": "handoff_approval"},
            )
            note_memory_id = mem.memory_id

        campaign.request.metadata["_handoff_approved"] = True
        campaign.status = CampaignStatus.HANDOFF_TO_COPY
        await self.store.save_campaign(campaign)

        self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "online")
        self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "working")
        self.band.record_delegation(
            campaign_id=campaign_id,
            from_handle=approver,
            to_handle=AgentHandle.COPY.value,
            reason=note.strip() if note and note.strip() else "Approved visual handoff to Copy Agent",
            memory_id=note_memory_id or campaign.visual_output.band_memory_id,
            status="dispatched",
        )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=approver,
            event_type=EventType.APPROVAL_GRANTED,
            message=(
                f"Approved visual direction for **{campaign.request.brand_name}**"
                + (f" — Note: {note.strip()}" if note and note.strip() else ".")
            ),
            payload={"approved": True, "note_memory_id": note_memory_id},
            trigger_mentions=False,
        )

        handoff_msg = (
            f"{AgentHandle.COPY.value} Human director approved visual direction "
            f"(memory `{campaign.visual_output.band_memory_id}`"
            + (f", guidance `{note_memory_id}`" if note_memory_id else "")
            + "). Proceed with platform-native campaign copy."
        )
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.AGENT_MENTION,
            message=handoff_msg,
            payload={
                "handoff_from": AgentHandle.VISUAL.value,
                "handoff_to": AgentHandle.COPY.value,
                "band_memory_id": campaign.visual_output.band_memory_id,
            },
            trigger_mentions=True,
        )
        return (await self.store.get_campaign(campaign_id)) or campaign

    async def pin_room_memory(
        self,
        campaign_id: str,
        *,
        author: str = AgentHandle.HUMAN.value,
        key: str = "brand_guardrail",
        content: str,
        pinned: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> BandMemoryEntry:
        """Pin a human/team guideline directly into shared BAND Memory and notify the room."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign '{campaign_id}' not found")

        entry = await self.band.store_memory(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            author=author,
            key=key,
            content=content,
            metadata={**(metadata or {}), "pinned": pinned, "source": "human_room"},
        )
        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=author,
            event_type=EventType.MEMORY_STORED,
            message=f"Pinned shared Band Memory `{entry.key}` (`{entry.memory_id}`): {content}",
            payload={"memory": entry.model_dump(mode="json"), "pinned": pinned},
            trigger_mentions=False,
        )
        return entry

    async def post_human_room_message(
        self,
        campaign_id: str,
        *,
        sender: str = AgentHandle.HUMAN.value,
        sender_name: str | None = None,
        message: str,
    ) -> AgentEvent:
        """Post a human message into the BAND room and dispatch live `@mention` agent revisions."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign '{campaign_id}' not found")

        self.band.set_human_display_name(campaign_id, sender_name)
        self.band.set_participant_status(campaign_id, AgentHandle.HUMAN.value, "online")

        event = await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=sender,
            event_type=EventType.HUMAN_MESSAGE,
            message=message,
            payload={"sender_name": sender_name or "Creative Director"},
            trigger_mentions=False,
        )

        lowered = message.lower()
        mentions_visual = (
            "@visual_pixelate" in lowered
            or "@visualagent" in lowered
            or "@all" in lowered
        )
        mentions_copy = (
            "@copy_pixelate" in lowered
            or "@copyagent" in lowered
            or "@all" in lowered
        )

        if mentions_visual:
            mem = await self.band.store_memory(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                author=sender,
                key="human_visual_directive",
                content=message,
                metadata={"pinned": True, "target": AgentHandle.VISUAL.value},
            )
            self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "working")
            self.band.record_delegation(
                campaign_id=campaign_id,
                from_handle=sender,
                to_handle=AgentHandle.VISUAL.value,
                reason=message[:140],
                memory_id=mem.memory_id,
                status="dispatched",
            )
            self._spawn(
                self._run_visual_revision(
                    campaign_id=campaign_id,
                    directive=message,
                    memory_id=mem.memory_id,
                    chain_copy=mentions_copy,
                ),
                name=f"visual-rev-{campaign_id}-{uuid4().hex[:4]}",
            )
        elif mentions_copy:
            mem = await self.band.store_memory(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                author=sender,
                key="human_copy_directive",
                content=message,
                metadata={"pinned": True, "target": AgentHandle.COPY.value},
            )
            self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "working")
            self.band.record_delegation(
                campaign_id=campaign_id,
                from_handle=sender,
                to_handle=AgentHandle.COPY.value,
                reason=message[:140],
                memory_id=mem.memory_id,
                status="dispatched",
            )
            self._spawn(
                self._run_copy_revision(
                    campaign_id=campaign_id,
                    directive=message,
                    memory_id=mem.memory_id,
                ),
                name=f"copy-rev-{campaign_id}-{uuid4().hex[:4]}",
            )
        else:
            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.ORCHESTRATOR.value,
                event_type=EventType.AGENT_THINKING,
                message=(
                    f"Logged note in BAND room `{campaign.room_id}`. Tip: `@mention` "
                    f"{AgentHandle.VISUAL.value}, {AgentHandle.COPY.value}, or `@all` "
                    f"to delegate live creative revisions."
                ),
                trigger_mentions=False,
            )

        return event

    async def _run_visual_revision(
        self,
        *,
        campaign_id: str,
        directive: str,
        memory_id: str,
        chain_copy: bool,
    ) -> None:
        """Re-run `@visual_pixelate` incorporating a live human directive & shared BAND memories."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            return
        try:
            memories = await self.band.get_room_memories(campaign_id, campaign.room_id)
            pinned_notes = "\n".join(
                f"- [{m.key}] {m.content}" for m in memories if m.metadata.get("pinned")
            )
            merged_notes = f"{campaign.request.additional_notes or ''}\nBAND Revision Directive: {directive}\n{pinned_notes}".strip()
            campaign.request.additional_notes = merged_notes[:1450]
            campaign.status = CampaignStatus.VISUAL_GENERATING
            await self.store.save_campaign(campaign)

            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.VISUAL.value,
                event_type=EventType.AGENT_REVISION,
                message=(
                    f"{AgentHandle.VISUAL.value} acknowledged human delegation (`{memory_id}`) "
                    f"and is revising art direction & creatives..."
                ),
                payload={"memory_id": memory_id, "directive": directive},
                trigger_mentions=False,
            )

            revised_visual = await self._dispatch_remote_visual(campaign)
            if revised_visual is None:
                revised_visual = await self._synthesize_fallback_visual(campaign)

            rev_mem = await self.band.store_memory(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                author=AgentHandle.VISUAL.value,
                key="visual_brief_revision",
                content=f"Revision applied ({directive}):\n{revised_visual.visual_brief_markdown}",
                metadata={"directive_memory_id": memory_id},
            )
            revised_visual.band_memory_id = rev_mem.memory_id

            target_status = (
                CampaignStatus.COPY_GENERATING
                if chain_copy
                else CampaignStatus.AWAITING_APPROVAL
                if campaign.request.metadata.get("require_handoff_approval")
                and campaign.copy_output is None
                else CampaignStatus.COMPLETED
            )
            await self.store.set_visual_output(campaign_id, revised_visual, status=target_status)
            self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "online")
            self.band.complete_delegation(campaign_id, AgentHandle.VISUAL.value)

            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.VISUAL.value,
                event_type=EventType.VISUAL_COMPLETED,
                message=(
                    f"Visual revision ready (`{rev_mem.memory_id}`) incorporating: \"{directive[:120]}\""
                ),
                payload={"visual_output": revised_visual.model_dump(mode="json"), "revision": True},
                trigger_mentions=False,
            )

            if chain_copy:
                await self._run_copy_revision(
                    campaign_id=campaign_id,
                    directive=f"Synchronize copy with revised visual brief ({rev_mem.memory_id}): {directive}",
                    memory_id=rev_mem.memory_id,
                )
        except Exception as exc:
            logger.exception("Visual revision failed for campaign %s", campaign_id)
            self.band.set_participant_status(campaign_id, AgentHandle.VISUAL.value, "online")
            await self._fail_campaign(campaign_id, campaign.room_id, AgentHandle.VISUAL.value, str(exc))

    async def _run_copy_revision(
        self,
        *,
        campaign_id: str,
        directive: str,
        memory_id: str,
    ) -> None:
        """Re-run `@copy_pixelate` hydrated with latest shared BAND Memories & human directive."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            return
        try:
            memories = await self.band.get_room_memories(campaign_id, campaign.room_id)
            pinned_notes = "\n".join(
                f"- [{m.key}] {m.content}" for m in memories if m.metadata.get("pinned")
            )
            campaign.request.additional_notes = (
                f"{campaign.request.additional_notes or ''}\nCopy Directive: {directive}\n{pinned_notes}"
            ).strip()[:1450]
            campaign.status = CampaignStatus.COPY_GENERATING
            await self.store.save_campaign(campaign)

            await self.band.post_room_message(
                campaign_id=campaign_id,
                room_id=campaign.room_id,
                sender=AgentHandle.COPY.value,
                event_type=EventType.AGENT_REVISION,
                message=(
                    f"{AgentHandle.COPY.value} hydrated {len(memories)} shared Band Memories "
                    f"(including `{memory_id}`) and is revising platform copy..."
                ),
                payload={"memory_id": memory_id, "directive": directive},
                trigger_mentions=False,
            )

            revised_copy = await self._dispatch_remote_copy(campaign, memories)
            if revised_copy is None:
                revised_copy = await self._synthesize_fallback_copy(campaign, memories)
            if memory_id not in revised_copy.band_memory_refs:
                revised_copy.band_memory_refs.append(memory_id)

            await self.handle_copy_output(campaign_id, revised_copy)
        except Exception as exc:
            logger.exception("Copy revision failed for campaign %s", campaign_id)
            self.band.set_participant_status(campaign_id, AgentHandle.COPY.value, "online")
            await self._fail_campaign(campaign_id, campaign.room_id, AgentHandle.COPY.value, str(exc))

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

    async def _gemini_generate_json(self, prompt: str) -> dict[str, Any] | None:
        """Call Gemini REST API for structured JSON output when `GEMINI_API_KEY` is configured."""
        api_key = self.settings.gemini_api_key
        if not api_key or os.environ.get("PYTEST_CURRENT_TEST") or self._http is None:
            return None

        model = os.environ.get("GEMINI_TEXT_MODEL", "gemini-3.5-flash-lite")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            resp = await self._http.post(
                url,
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.65,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=30.0,
            )
            if resp.status_code >= 400:
                logger.warning("Gemini JSON call (%s) HTTP %s: %s", model, resp.status_code, resp.text[:200])
                return None
            data = resp.json()
            parts = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [])
            )
            text = "".join(str(p.get("text", "")) for p in parts if isinstance(p, dict)).strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:].strip()
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except Exception as exc:
            logger.warning("Gemini JSON generation failed (%s); falling back cleanly.", exc)
            return None

    async def _gemini_generate_image(self, prompt: str) -> tuple[bytes, str] | None:
        """Generate a real campaign visual via Gemini Flash Image when `GEMINI_API_KEY` is configured."""
        api_key = self.settings.gemini_api_key
        if not api_key or os.environ.get("PYTEST_CURRENT_TEST") or self._http is None:
            return None

        model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-lite-image")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            resp = await self._http.post(
                url,
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseModalities": ["IMAGE"]},
                },
                timeout=40.0,
            )
            if resp.status_code >= 400:
                logger.warning("Gemini image call (%s) HTTP %s", model, resp.status_code)
                return None
            data = resp.json()
            parts = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [])
            )
            for part in parts:
                inline = part.get("inlineData") or part.get("inline_data")
                if isinstance(inline, dict) and inline.get("data"):
                    raw_bytes = base64.b64decode(inline["data"])
                    mime = str(inline.get("mimeType") or inline.get("mime_type") or "image/png")
                    return raw_bytes, mime
        except Exception as exc:
            logger.warning("Gemini image generation failed (%s); using studio SVG.", exc)
        return None

    async def _synthesize_fallback_visual(
        self, campaign: CampaignResponse
    ) -> VisualOutput:
        """Generate Gemini-powered visual concepts & assets (with studio SVG fallback)."""
        req = campaign.request
        gemini_plan = await self._gemini_generate_json(
            (
                "You are @visual_pixelate, an elite creative director. Return ONLY valid JSON with keys: "
                '"creative_direction" (string, 2 crisp sentences), '
                '"mood_keywords" (array of 4 short adjectives), '
                '"color_palette" (array of 5 hex strings starting with #), '
                '"typography_direction" (string), '
                f'"concepts" (array of exactly {req.num_concepts} objects each with "title", "style_notes", and "image_prompt").\n'
                f"Brand: {req.brand_name}\n"
                f"Product: {req.product_description}\n"
                f"Target Audience: {req.target_audience}\n"
                f"Goal: {req.campaign_goal}\n"
                f"Brand Tone: {req.brand_tone}\n"
                f"Platforms: {', '.join(req.platforms)}\n"
                f"Preferred Palette: {', '.join(req.color_palette) if req.color_palette else 'Choose a cohesive 5-hex palette'}"
            )
        )

        raw_palette = (
            gemini_plan.get("color_palette")
            if gemini_plan and isinstance(gemini_plan.get("color_palette"), list)
            else None
        )
        valid_gemini_palette = [
            str(c) for c in (raw_palette or []) if isinstance(c, str) and c.startswith("#")
        ]
        palette = (
            req.color_palette
            if len(req.color_palette) >= 2
            else (valid_gemini_palette if len(valid_gemini_palette) >= 3 else DEFAULT_PALETTE)
        )
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
        gemini_concepts = (
            gemini_plan.get("concepts")
            if gemini_plan and isinstance(gemini_plan.get("concepts"), list)
            else []
        )

        selected_platforms = req.platforms
        pace_delay = 0.0 if os.environ.get("PYTEST_CURRENT_TEST") else 0.25
        for idx in range(req.num_concepts):
            if pace_delay and not gemini_plan:
                await asyncio.sleep(pace_delay)
            platform = selected_platforms[idx % len(selected_platforms)]
            aspect, width, height = PLATFORM_ASPECT_RATIOS.get(platform, ("1:1", 900, 580))
            fallback_title, fallback_style = concept_angles[idx % len(concept_angles)]
            c_item = gemini_concepts[idx] if idx < len(gemini_concepts) and isinstance(gemini_concepts[idx], dict) else {}
            angle_title = str(c_item.get("title") or fallback_title)[:120]
            prompt_used = str(
                c_item.get("image_prompt")
                or (
                    f"{req.brand_tone} marketing visual for {req.brand_name}: "
                    f"{req.product_description}. Style: {c_item.get('style_notes') or fallback_style}. "
                    f"Palette: {', '.join(palette)}. Ultra-clean commercial studio photography, no garbled text."
                )
            )[:3800]
            asset_id = f"asset_{idx + 1}_{uuid4().hex[:6]}"

            # Try real Gemini Flash Image generation first when GEMINI_API_KEY is active
            img_result = await self._gemini_generate_image(prompt_used)
            if img_result is not None:
                img_bytes, mime_type = img_result
                ext = "jpg" if "jpeg" in mime_type or "jpg" in mime_type else "png"
                filename = f"{asset_id}_{platform}.{ext}"
                saved_path = await self.store.write_asset_bytes(
                    campaign.campaign_id, filename, img_bytes
                )
            else:
                filename = f"{asset_id}_{platform}.svg"
                mime_type = "image/svg+xml"
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
                prompt_used=prompt_used,
                file_path=str(saved_path),
                asset_url=f"/api/campaigns/{campaign.campaign_id}/assets/{filename}",
                mime_type=mime_type,
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
                message=(
                    f"Generated {'Gemini AI' if img_result else 'studio'} visual concept "
                    f"{idx + 1}/{req.num_concepts}: {asset.title} ({platform})."
                ),
                payload={"asset": asset.model_dump(mode="json")},
                trigger_mentions=False,
            )

        # Render cinematic H.264 MP4 promo video (inspired by motionmaxxing + bang-motion + video-shotcraft)
        if shutil.which("ffmpeg") and not os.environ.get("PYTEST_CURRENT_TEST"):
            try:
                default_style: ShotStyle = (
                    "luxury_editorial"
                    if "lux" in req.brand_tone.lower()
                    else "pulse_drop"
                    if "bold" in req.brand_tone.lower()
                    else "obsidian_cinema"
                )
                video_asset = await self._render_video_asset(
                    campaign=campaign,
                    palette=palette,
                    aspect_ratio="16:9",
                    shot_style=default_style,
                )
                assets.append(video_asset)
                await self.band.post_room_message(
                    campaign_id=campaign.campaign_id,
                    room_id=campaign.room_id,
                    sender=AgentHandle.VISUAL.value,
                    event_type=EventType.ASSET_GENERATED,
                    message=(
                        f"Rendered 10s cinematic H.264 promo video ({default_style}, 16:9) "
                        f"with beat-synced soundtrack: {video_asset.title}."
                    ),
                    payload={"asset": video_asset.model_dump(mode="json")},
                    trigger_mentions=False,
                )
            except Exception as exc:
                logger.warning(
                    "MP4 video rendering skipped for campaign %s: %s",
                    campaign.campaign_id,
                    exc,
                )

        mood_keywords = (
            [str(k) for k in gemini_plan.get("mood_keywords", []) if str(k).strip()][:6]
            if gemini_plan and isinstance(gemini_plan.get("mood_keywords"), list)
            else []
        ) or [
            kw.strip()
            for kw in req.brand_tone.replace(" and ", ",").split(",")
            if kw.strip()
        ] or ["modern", "vibrant", "high-contrast"]

        creative_direction = str(
            (gemini_plan or {}).get("creative_direction")
            or (
                f"A {req.brand_tone.lower()} visual system for {req.brand_name} built around "
                f"high-contrast geometric framing, tactile product focus, and unmistakable "
                f"color blocking tailored to {req.target_audience}."
            )
        )
        typography_direction = str(
            (gemini_plan or {}).get("typography_direction")
            or "Bold geometric display sans + clean grotesk body"
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
            f"- **Typography:** {typography_direction}\n"
            f"- **Generated Assets:**\n{asset_bullets}"
        )

        return VisualOutput(
            campaign_id=campaign.campaign_id,
            creative_direction=creative_direction,
            mood_keywords=mood_keywords,
            color_palette=palette,
            typography_direction=typography_direction,
            visual_brief_markdown=visual_brief_md,
            assets=assets,
        )

    async def _synthesize_fallback_copy(
        self, campaign: CampaignResponse, memories: list[BandMemoryEntry]
    ) -> CopyOutput:
        """Synthesize Gemini-powered multi-platform copy aligned to VisualOutput & Band Memories."""
        req = campaign.request
        visual = campaign.visual_output
        assets = visual.assets if visual else []
        brand_slug = "".join(ch for ch in req.brand_name if ch.isalnum())

        memory_context = "\n\n".join(f"[{m.key} by {m.author}]\n{m.content}" for m in memories)
        gemini_copy = await self._gemini_generate_json(
            (
                "You are @copy_pixelate, an elite conversion copywriter collaborating in a BAND room. "
                "Return ONLY valid JSON with keys: "
                '"campaign_tagline" (string, punchy <120 chars), '
                '"brand_voice_summary" (string), '
                '"key_messages" (array of 3 concise strings), '
                '"email_subject_lines" (array of 3 high-open-rate subject lines), '
                f'"platform_copies" (array with one entry per platform in {json.dumps(req.platforms)}, each having '
                '"platform", "headline", "subheadline", "body_copy", "call_to_action", "hashtags" [array of 3-5 #tags]).\n\n'
                f"Brand: {req.brand_name}\nProduct: {req.product_description}\n"
                f"Target Audience: {req.target_audience}\nGoal: {req.campaign_goal}\nTone: {req.brand_tone}\n\n"
                f"Shared Band Memories from @visual_pixelate:\n{memory_context}"
            )
        )

        if gemini_copy and isinstance(gemini_copy.get("platform_copies"), list) and gemini_copy["platform_copies"]:
            parsed_copies: list[PlatformCopy] = []
            by_platform = {
                str(item.get("platform", "")).strip().lower(): item
                for item in gemini_copy["platform_copies"]
                if isinstance(item, dict)
            }
            for idx, platform in enumerate(req.platforms):
                linked = assets[idx % len(assets)] if assets else None
                item = by_platform.get(platform) or (
                    gemini_copy["platform_copies"][idx]
                    if idx < len(gemini_copy["platform_copies"])
                    and isinstance(gemini_copy["platform_copies"][idx], dict)
                    else {}
                )
                headline = str(item.get("headline") or f"Meet {req.brand_name}")[:230]
                body = str(item.get("body_copy") or req.product_description)[:3900]
                cta = str(item.get("call_to_action") or "Explore Now")[:150]
                sub = str(item.get("subheadline") or req.campaign_goal)[:390]
                raw_tags = item.get("hashtags") if isinstance(item.get("hashtags"), list) else []
                hashtags = [
                    t if str(t).startswith("#") else f"#{t}"
                    for t in raw_tags
                    if str(t).strip()
                ] or [f"#{brand_slug}", "#AgentPixelate", f"#{platform}"]
                parsed_copies.append(
                    PlatformCopy(
                        platform=platform,
                        headline=headline,
                        subheadline=sub,
                        body_copy=body,
                        call_to_action=cta,
                        hashtags=hashtags,
                        linked_asset_id=linked.asset_id if linked else None,
                    )
                )

            return CopyOutput(
                campaign_id=campaign.campaign_id,
                campaign_tagline=str(
                    gemini_copy.get("campaign_tagline") or f"{req.brand_name}: Built for impact."
                )[:290],
                brand_voice_summary=str(
                    gemini_copy.get("brand_voice_summary")
                    or f"{req.brand_tone} voice tailored to {req.target_audience}."
                )[:980],
                key_messages=[
                    str(m) for m in gemini_copy.get("key_messages", []) if str(m).strip()
                ][:5]
                or [req.product_description],
                platform_copies=parsed_copies,
                email_subject_lines=[
                    str(s) for s in gemini_copy.get("email_subject_lines", []) if str(s).strip()
                ][:5]
                or [f"Introducing {req.brand_name}"],
                band_memory_refs=[m.memory_id for m in memories],
            )

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

    async def _render_video_asset(
        self,
        *,
        campaign: CampaignResponse,
        palette: list[str],
        aspect_ratio: AspectRatio = "16:9",
        shot_style: ShotStyle = "obsidian_cinema",
    ) -> VisualAsset:
        req = campaign.request
        style_meta = SHOT_STYLES.get(shot_style, SHOT_STYLES["obsidian_cinema"])
        ar_slug = aspect_ratio.replace(":", "x")
        asset_id = f"video_{shot_style}_{ar_slug}_{uuid4().hex[:6]}"
        filename = f"{asset_id}.mp4"
        out_path: Path = self.store.assets_dir(campaign.campaign_id) / filename

        hook = (
            campaign.copy_output.platform_copies[0].headline
            if campaign.copy_output and campaign.copy_output.platform_copies
            else f"{req.brand_name} — Reimagined"
        )
        tagline = (
            campaign.copy_output.campaign_tagline
            if campaign.copy_output
            else f"{req.brand_tone} craft built for {req.target_audience[:42]}"
        )
        cta_label = (
            campaign.copy_output.platform_copies[0].call_to_action
            if campaign.copy_output and campaign.copy_output.platform_copies
            else "Shop Now"
        )

        spec = VideoRenderSpec(
            brand_name=req.brand_name,
            tagline=tagline,
            hook=hook,
            description=req.product_description,
            target_audience=req.target_audience,
            brand_tone=req.brand_tone,
            cta_label=cta_label,
            platforms=req.platforms,
            palette=palette,
            aspect_ratio=aspect_ratio,
            shot_style=shot_style,
            duration_sec=8.0,
            fps=18,
        )

        await asyncio.to_thread(render_campaign_video_mp4, spec, out_path)

        width, height = (450, 800) if aspect_ratio == "9:16" else (800, 450)
        return VisualAsset(
            asset_id=asset_id,
            title=f"{req.brand_name} — {style_meta['label']} Promo ({aspect_ratio})",
            platform="video_reel" if aspect_ratio == "9:16" else "video_cinema",
            aspect_ratio=aspect_ratio,
            prompt_used=(
                f"MotionMaxx/ShotCraft {style_meta['label']} ({style_meta['curve']}): "
                f"{style_meta['description']}"
            ),
            file_path=str(out_path),
            asset_url=f"/api/campaigns/{campaign.campaign_id}/assets/{filename}",
            mime_type="video/mp4",
            width=width,
            height=height,
            color_tokens=palette,
            alt_text=f"10s H.264 cinematic promo video for {req.brand_name}",
        )

    async def render_campaign_video(
        self,
        campaign_id: str,
        *,
        aspect_ratio: AspectRatio = "16:9",
        shot_style: ShotStyle = "obsidian_cinema",
    ) -> VisualAsset:
        """Render a fresh on-demand MP4 cut for an existing campaign and persist it."""
        campaign = await self.store.get_campaign(campaign_id)
        if campaign is None:
            raise KeyError(f"Campaign '{campaign_id}' not found.")

        palette = (
            campaign.visual_output.color_palette
            if campaign.visual_output and campaign.visual_output.color_palette
            else DEFAULT_PALETTE
        )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.AGENT_THINKING,
            message=(
                f"Rendering custom {aspect_ratio} MP4 cut using `{shot_style}` shot recipe "
                f"with measured easing curves and beat-synced soundtrack..."
            ),
            payload={"aspect_ratio": aspect_ratio, "shot_style": shot_style},
            trigger_mentions=False,
        )

        video_asset = await self._render_video_asset(
            campaign=campaign,
            palette=palette,
            aspect_ratio=aspect_ratio,
            shot_style=shot_style,
        )

        # Persist the newly rendered video onto the campaign's visual_output
        if campaign.visual_output is not None:
            campaign.visual_output.assets.append(video_asset)
            await self.store.set_visual_output(
                campaign_id,
                campaign.visual_output,
                status=campaign.status,
            )

        await self.band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=AgentHandle.VISUAL.value,
            event_type=EventType.ASSET_GENERATED,
            message=f"Custom MP4 video ready: {video_asset.title}",
            payload={"asset": video_asset.model_dump(mode="json")},
            trigger_mentions=False,
        )

        return video_asset

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
