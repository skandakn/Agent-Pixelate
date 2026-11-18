"""Agent Worker Runner & Band Room Listener for Agent Pixelate.

Exposes three seamless integration modes for `/orchestrator`:
  1. **Direct Async Python Invocation** (in-process):
       - `await run_visual_agent(req, emit_event)`
       - `await run_copy_agent(req, visual_out, emit_event)`
       - `await run_campaign_pipeline(req, emit_event)`
  2. **Band Room Listener** (`BandRoomListener`):
       - Connects to a live BAND (`band.ai`) room via Phoenix Channels WebSocket
         (`wss://app.band.ai/api/v1/socket/websocket`) + REST message/memory APIs,
         or runs in local async-queue mode when `BAND_API_KEY` is unset.
       - Automatically reacts to `@visual_pixelate` mentions -> runs Visual Agent
         -> writes Band Memory -> posts `@copy_pixelate` handoff -> runs Copy Agent.
  3. **Optional HTTP Worker Server** (`create_worker_app()`):
       - Exposes `POST /agents/visual/generate`, `POST /agents/copy/generate`, and
         `GET /health` matching `/orchestrator/workflow.py`'s remote dispatch contract.
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

import httpx
from dotenv import load_dotenv

from agents.contracts import (
    AgentEvent,
    AgentHandle,
    CampaignRequest,
    CampaignResponse,
    CampaignStatus,
    CopyOutput,
    EventType,
    VisualOutput,
    utc_now,
)
from agents.copy_agent import CopyAgent
from agents.image_providers import ImageGenerationService
from agents.skill_loader import FinchSkillLoader
from agents.visual_agent import VisualAgent

load_dotenv()

logger = logging.getLogger(__name__)

EventEmitter = Callable[[AgentEvent | dict[str, Any]], Awaitable[None] | None]

MENTION_RE = re.compile(r"(@[a-zA-Z0-9_]+)")


async def run_visual_agent(
    req: CampaignRequest,
    emit_event: EventEmitter | None = None,
    *,
    campaign_id: str | None = None,
    room_id: str | None = None,
    output_dir: Path | str | None = None,
    llm_provider: str | None = None,
    image_provider: str | None = None,
) -> VisualOutput:
    """Execute `@visual_pixelate` (AdaL/AdalFlow + Finch skills) and return `VisualOutput`."""
    agent = VisualAgent(
        skill_loader=FinchSkillLoader(),
        image_service=ImageGenerationService(provider=image_provider),
        llm_provider=llm_provider,
    )
    return await agent.run(
        req,
        emit_event=emit_event,
        campaign_id=campaign_id,
        room_id=room_id,
        output_dir=output_dir,
    )


async def run_copy_agent(
    req: CampaignRequest,
    visual_out: VisualOutput,
    emit_event: EventEmitter | None = None,
    *,
    room_id: str | None = None,
    output_dir: Path | str | None = None,
    llm_provider: str | None = None,
) -> CopyOutput:
    """Execute `@copy_pixelate` (AdaL/AdalFlow + Finch skills) using `VisualOutput` handoff."""
    agent = CopyAgent(
        skill_loader=FinchSkillLoader(),
        llm_provider=llm_provider,
    )
    return await agent.run(
        req,
        visual_out,
        emit_event=emit_event,
        room_id=room_id,
        output_dir=output_dir,
    )


async def run_campaign_pipeline(
    req: CampaignRequest,
    emit_event: EventEmitter | None = None,
    *,
    campaign_id: str | None = None,
    room_id: str | None = None,
    output_dir: Path | str | None = None,
    llm_provider: str | None = None,
    image_provider: str | None = None,
) -> CampaignResponse:
    """Run the full Visual -> BAND Handoff -> Copy pipeline and return `CampaignResponse`."""
    cid = campaign_id or f"camp_{uuid4().hex[:12]}"
    rid = room_id or f"room_{cid}"
    collected_events: list[AgentEvent] = []

    async def _collector(event: AgentEvent | dict[str, Any]) -> None:
        normalized = (
            event if isinstance(event, AgentEvent) else AgentEvent.model_validate(event)
        )
        collected_events.append(normalized)
        if emit_event is not None:
            res = emit_event(normalized)
            if asyncio.iscoroutine(res) or isinstance(res, Awaitable):
                await res

    visual_out = await run_visual_agent(
        req,
        emit_event=_collector,
        campaign_id=cid,
        room_id=rid,
        output_dir=output_dir,
        llm_provider=llm_provider,
        image_provider=image_provider,
    )
    copy_out = await run_copy_agent(
        req,
        visual_out,
        emit_event=_collector,
        room_id=rid,
        output_dir=output_dir,
        llm_provider=llm_provider,
    )

    complete_evt = AgentEvent(
        campaign_id=cid,
        room_id=rid,
        event_type=EventType.CAMPAIGN_COMPLETED,
        sender=AgentHandle.ORCHESTRATOR.value,
        message=(
            f"Campaign `{cid}` for **{req.brand_name}** completed end-to-end "
            f"({len(visual_out.assets)} visual assets + {len(copy_out.platform_copies)} platform copy sets)."
        ),
        payload={"campaign_id": cid, "status": CampaignStatus.COMPLETED.value},
    )
    await _collector(complete_evt)

    return CampaignResponse(
        campaign_id=cid,
        status=CampaignStatus.COMPLETED,
        room_id=rid,
        transport="local_fallback",
        request=req,
        visual_output=visual_out,
        copy_output=copy_out,
        events=collected_events,
        created_at=utc_now(),
        updated_at=utc_now(),
    )


class BandRoomListener:
    """Band (`band.ai`) room listener that routes `@visual_pixelate` and `@copy_pixelate` mentions.

    Supports both:
      - Live Band Phoenix Channels WebSocket (`wss://app.band.ai/api/v1/socket/websocket`)
        plus Band REST API (`https://app.band.ai/api/v1`) when `BAND_API_KEY` is configured.
      - Local in-memory room dispatch (`dispatch_room_message(...)`) for seamless local
        orchestrator integration and offline testing.
    """

    def __init__(
        self,
        *,
        band_api_key: str | None = None,
        band_rest_url: str | None = None,
        band_ws_url: str | None = None,
        emit_event: EventEmitter | None = None,
        output_dir: Path | str | None = None,
        llm_provider: str | None = None,
        image_provider: str | None = None,
    ) -> None:
        self.band_api_key = band_api_key or os.getenv("BAND_API_KEY")
        self.band_rest_url = (
            band_rest_url or os.getenv("BAND_REST_URL") or "https://app.band.ai"
        ).rstrip("/")
        self.band_ws_url = (
            band_ws_url
            or os.getenv("BAND_WS_URL")
            or "wss://app.band.ai/api/v1/socket/websocket"
        )
        self.emit_event = emit_event
        self.output_dir = output_dir
        self.llm_provider = llm_provider
        self.image_provider = image_provider

        self._campaign_requests: dict[str, CampaignRequest] = {}
        self._visual_outputs: dict[str, VisualOutput] = {}
        self._copy_outputs: dict[str, CopyOutput] = {}
        self._stop_event = asyncio.Event()
        self._http: httpx.AsyncClient | None = None

    @property
    def band_enabled(self) -> bool:
        return bool(self.band_api_key and self.band_api_key.strip())

    def register_campaign_context(
        self, campaign_id: str, request: CampaignRequest
    ) -> None:
        """Store campaign request metadata for incoming Band room mention triggers."""
        self._campaign_requests[campaign_id] = request

    def _auth_headers(self) -> dict[str, str]:
        if not self.band_api_key:
            return {}
        return {
            "X-API-Key": self.band_api_key,
            "Authorization": f"Bearer {self.band_api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _post_band_message(
        self, room_id: str, sender: str, message: str, metadata: dict[str, Any] | None = None
    ) -> None:
        if not self.band_enabled:
            return
        if self._http is None:
            self._http = httpx.AsyncClient(base_url=self.band_rest_url, timeout=15.0)
        mentions = sorted({m.lower() for m in MENTION_RE.findall(message)})
        try:
            await self._http.post(
                f"/api/v1/agent/chats/{room_id}/messages",
                headers=self._auth_headers(),
                json={
                    "content": message,
                    "body": message,
                    "sender": sender,
                    "mentions": mentions,
                    "metadata": metadata or {},
                },
            )
        except httpx.HTTPError as exc:
            logger.warning("Failed to post message to Band room %s: %s", room_id, exc)

    async def _store_band_memory(
        self, room_id: str, author: str, key: str, content: str, metadata: dict[str, Any]
    ) -> None:
        if not self.band_enabled:
            return
        if self._http is None:
            self._http = httpx.AsyncClient(base_url=self.band_rest_url, timeout=15.0)
        try:
            await self._http.post(
                f"/api/v1/agent/chats/{room_id}/context",
                headers=self._auth_headers(),
                json={
                    "chat_id": room_id,
                    "key": key,
                    "content": content,
                    "author": author,
                    "metadata": metadata,
                },
            )
        except httpx.HTTPError as exc:
            logger.debug("Band memory write skipped for room %s: %s", room_id, exc)

    async def dispatch_room_message(
        self,
        *,
        campaign_id: str,
        room_id: str,
        sender: str,
        message: str,
        request: CampaignRequest | None = None,
    ) -> VisualOutput | CopyOutput | None:
        """Process a Band room message and trigger the mentioned Agent Pixelate worker."""
        if request is not None:
            self._campaign_requests[campaign_id] = request

        mentions = [m.lower() for m in MENTION_RE.findall(message)]
        req = self._campaign_requests.get(campaign_id)
        if req is None:
            logger.warning(
                "Received room message for unknown campaign %s without registered CampaignRequest.",
                campaign_id,
            )
            return None

        if AgentHandle.VISUAL.value in mentions and sender != AgentHandle.VISUAL.value:
            visual_out = await run_visual_agent(
                req,
                emit_event=self.emit_event,
                campaign_id=campaign_id,
                room_id=room_id,
                output_dir=self.output_dir,
                llm_provider=self.llm_provider,
                image_provider=self.image_provider,
            )
            self._visual_outputs[campaign_id] = visual_out

            await self._store_band_memory(
                room_id=room_id,
                author=AgentHandle.VISUAL.value,
                key="visual_brief",
                content=visual_out.visual_brief_markdown,
                metadata={
                    "campaign_id": campaign_id,
                    "color_palette": visual_out.color_palette,
                    "asset_ids": [a.asset_id for a in visual_out.assets],
                },
            )
            handoff_text = (
                f"{AgentHandle.COPY.value} Visual system complete for **{req.brand_name}** "
                f"(memory `{visual_out.band_memory_id}`).\n\n{visual_out.visual_brief_markdown}"
            )
            await self._post_band_message(
                room_id=room_id,
                sender=AgentHandle.VISUAL.value,
                message=handoff_text,
                metadata={"campaign_id": campaign_id, "handoff_to": AgentHandle.COPY.value},
            )
            # In local mode, automatically chain the `@copy_pixelate` mention
            if not self.band_enabled:
                await self.dispatch_room_message(
                    campaign_id=campaign_id,
                    room_id=room_id,
                    sender=AgentHandle.VISUAL.value,
                    message=handoff_text,
                    request=req,
                )
            return visual_out

        if AgentHandle.COPY.value in mentions and sender != AgentHandle.COPY.value:
            visual_out = self._visual_outputs.get(campaign_id)
            if visual_out is None:
                logger.warning(
                    "Copy mention received for campaign %s before VisualOutput is available.",
                    campaign_id,
                )
                return None
            copy_out = await run_copy_agent(
                req,
                visual_out,
                emit_event=self.emit_event,
                room_id=room_id,
                output_dir=self.output_dir,
                llm_provider=self.llm_provider,
            )
            self._copy_outputs[campaign_id] = copy_out
            await self._post_band_message(
                room_id=room_id,
                sender=AgentHandle.COPY.value,
                message=(
                    f"Campaign copy ready for **{req.brand_name}** — "
                    f"Tagline: \"{copy_out.campaign_tagline}\" "
                    f"({len(copy_out.platform_copies)} channels)."
                ),
                metadata={"campaign_id": campaign_id, "event_type": EventType.COPY_COMPLETED.value},
            )
            return copy_out

        return None

    async def listen_room(self, room_id: str, campaign_id: str) -> None:
        """Connect to a live Band Phoenix Channels WebSocket room and listen for @mentions."""
        if not self.band_enabled:
            logger.info(
                "BAND_API_KEY not set — BandRoomListener for room %s running in local dispatch mode.",
                room_id,
            )
            return

        try:
            import websockets
        except ImportError:
            logger.warning("`websockets` package not installed; cannot listen to live Band WS.")
            return

        sep = "&" if "?" in self.band_ws_url else "?"
        connect_url = f"{self.band_ws_url}{sep}api_key={self.band_api_key}&vsn=2.0.0"
        topic = f"chat:{room_id}"

        async with websockets.connect(
            connect_url,
            additional_headers={"X-API-Key": self.band_api_key or ""},
            open_timeout=10,
            ping_interval=20,
        ) as ws:
            await ws.send(json.dumps(["1", "1", topic, "phx_join", {}]))
            logger.info("BandRoomListener joined Band topic %s", topic)

            async for raw in ws:
                if self._stop_event.is_set():
                    break
                try:
                    frame = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
                except Exception:
                    continue
                if isinstance(frame, list) and len(frame) >= 5:
                    event_name, payload = str(frame[3]), frame[4]
                elif isinstance(frame, dict):
                    event_name = str(frame.get("event") or "")
                    payload = frame.get("payload", frame)
                else:
                    continue

                if event_name in {"phx_reply", "phx_close", "presence_state", "presence_diff"}:
                    continue
                if not isinstance(payload, dict):
                    continue

                content = str(
                    payload.get("content") or payload.get("body") or payload.get("message") or ""
                ).strip()
                if not content:
                    continue

                sender_raw = str(payload.get("sender_handle") or payload.get("sender") or "band")
                sender = sender_raw if sender_raw.startswith("@") else f"@{sender_raw}"
                await self.dispatch_room_message(
                    campaign_id=campaign_id,
                    room_id=room_id,
                    sender=sender,
                    message=content,
                )

    async def close(self) -> None:
        self._stop_event.set()
        if self._http is not None:
            await self._http.aclose()
            self._http = None


def create_worker_app() -> Any:
    """Optional FastAPI microservice app matching `/orchestrator/workflow.py` remote dispatch."""
    from fastapi import FastAPI
    from pydantic import BaseModel

    app = FastAPI(title="Agent Pixelate AI Agents Worker", version="1.0.0")
    loader = FinchSkillLoader()
    orchestrator_url = os.getenv("ORCHESTRATOR_URL")

    class VisualGeneratePayload(BaseModel):
        campaign_id: str
        room_id: str
        request: CampaignRequest
        callback_url: str | None = None
        band_memories: list[dict[str, Any]] = []

    class CopyGeneratePayload(BaseModel):
        campaign_id: str
        room_id: str
        request: CampaignRequest
        visual_output: VisualOutput
        band_memories: list[dict[str, Any]] = []
        callback_url: str | None = None

    async def _forward_event(campaign_id: str, event: AgentEvent | dict[str, Any]) -> None:
        if not orchestrator_url:
            return
        evt = event if isinstance(event, AgentEvent) else AgentEvent.model_validate(event)
        url = f"{orchestrator_url.rstrip('/')}/api/campaigns/{campaign_id}/events"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    url,
                    json={
                        "event_type": evt.event_type.value,
                        "sender": evt.sender,
                        "message": evt.message,
                        "mentions": evt.mentions,
                        "payload": evt.payload,
                    },
                )
        except httpx.HTTPError:
            pass

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "service": "agent-pixelate-agents",
            "harness": "adal_adalflow",
            "finch_skills": loader.list_skill_ids(),
        }

    @app.post("/agents/visual/generate", response_model=VisualOutput)
    async def visual_generate(body: VisualGeneratePayload) -> VisualOutput:
        return await run_visual_agent(
            body.request,
            emit_event=lambda evt: _forward_event(body.campaign_id, evt),
            campaign_id=body.campaign_id,
            room_id=body.room_id,
        )

    @app.post("/agents/copy/generate", response_model=CopyOutput)
    async def copy_generate(body: CopyGeneratePayload) -> CopyOutput:
        return await run_copy_agent(
            body.request,
            body.visual_output,
            emit_event=lambda evt: _forward_event(body.campaign_id, evt),
            room_id=body.room_id,
        )

    return app


__all__ = [
    "BandRoomListener",
    "EventEmitter",
    "create_worker_app",
    "run_campaign_pipeline",
    "run_copy_agent",
    "run_visual_agent",
]
