"""BAND (`band.ai`) Multi-Agent Room, Identity, @mention Routing & Memory Adapter.

Implements the official Band REST + WebSocket (Phoenix Channels) protocol
(`https://app.band.ai/api/v1` and `wss://app.band.ai/api/v1/socket/websocket`)
with optional `band-sdk` awareness and a seamless async in-memory event bus
fallback when `BAND_API_KEY` is omitted in local development.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import uuid4

import httpx

from orchestrator.config import Settings
from orchestrator.event_bus import AsyncEventBus
from orchestrator.storage import CampaignStore
from shared.schemas import (
    AgentEvent,
    AgentHandle,
    BandDelegationEdge,
    BandMemoryEntry,
    BandParticipant,
    BandRoomSnapshot,
    CampaignResponse,
    CampaignStatus,
    EventType,
    utc_now,
)

logger = logging.getLogger(__name__)

MENTION_PATTERN = re.compile(r"(@[a-zA-Z0-9_]+)")

MentionHandler = Callable[[AgentEvent], Awaitable[None]]


@dataclass(slots=True)
class BandAgentIdentity:
    """Registered Band identity metadata for an Agent Pixelate worker."""

    handle: str
    display_name: str
    role_description: str
    band_agent_id: str | None = None
    api_key: str | None = None
    registered_remote: bool = False


@dataclass(slots=True)
class BandRoom:
    """Task-scoped Band collaboration room bound to a single campaign."""

    room_id: str
    campaign_id: str
    title: str
    participants: list[str]
    transport: Literal["band", "local_fallback"]
    metadata: dict[str, Any] = field(default_factory=dict)


class BandAdapter:
    """Coordinates Band agent identities, task-scoped rooms, memories, and @mentions."""

    def __init__(
        self,
        settings: Settings,
        event_bus: AsyncEventBus,
        store: CampaignStore,
    ) -> None:
        self.settings = settings
        self.event_bus = event_bus
        self.store = store

        self._http: httpx.AsyncClient | None = None
        self._sdk_available: bool = importlib.util.find_spec("band_sdk") is not None
        self._mention_handlers: dict[str, list[MentionHandler]] = {}
        self._room_ws_tasks: dict[str, asyncio.Task[None]] = {}
        self._rooms: dict[str, BandRoom] = {}
        self._presence: dict[str, dict[str, Literal["online", "thinking", "working", "awaiting_approval", "idle"]]] = {}
        self._delegations: dict[str, list[BandDelegationEdge]] = {}
        self._human_names: dict[str, str] = {}

        # Canonical two sponsor-required agent identities
        self.identities: dict[str, BandAgentIdentity] = {
            AgentHandle.VISUAL.value: BandAgentIdentity(
                handle=AgentHandle.VISUAL.value,
                display_name="Visual Pixelate",
                role_description=(
                    "Creative director & visual asset generator for Agent Pixelate. "
                    "Produces campaign concepts, color systems, and image assets, "
                    "writes structured visual briefs to Band Memory, and @mentions @copy_pixelate."
                ),
                api_key=settings.band_visual_agent_key,
            ),
            AgentHandle.COPY.value: BandAgentIdentity(
                handle=AgentHandle.COPY.value,
                display_name="Copy Pixelate",
                role_description=(
                    "Brand copywriter & channel strategist for Agent Pixelate. "
                    "Activated via @mention from @visual_pixelate, reads shared Band Memories, "
                    "and crafts high-converting multi-platform campaign copy."
                ),
                api_key=settings.band_copy_agent_key,
            ),
        }

    @property
    def active_transport(self) -> Literal["band", "local_fallback"]:
        return "band" if self.settings.band_enabled else "local_fallback"

    @property
    def sdk_available(self) -> bool:
        return self._sdk_available

    async def startup(self) -> None:
        """Initialize HTTP transport and register `@visual_pixelate` & `@copy_pixelate`."""
        self._http = httpx.AsyncClient(
            base_url=self.settings.band_rest_url.rstrip("/"),
            timeout=self.settings.band_request_timeout_s,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        await self.register_agent_identities()

    async def shutdown(self) -> None:
        """Cancel active Band WebSocket room bridges and close HTTP connections."""
        for task in list(self._room_ws_tasks.values()):
            task.cancel()
        if self._room_ws_tasks:
            await asyncio.gather(*self._room_ws_tasks.values(), return_exceptions=True)
        self._room_ws_tasks.clear()

        if self._http is not None:
            await self._http.aclose()
            self._http = None

    def register_mention_handler(self, handle: str, handler: MentionHandler) -> None:
        """Register an async callback invoked whenever `handle` is @mentioned in a room."""
        normalized = handle if handle.startswith("@") else f"@{handle}"
        self._mention_handlers.setdefault(normalized.lower(), []).append(handler)

    @staticmethod
    def extract_mentions(text: str) -> list[str]:
        """Extract unique canonical `@handle` tokens from a message string."""
        seen: list[str] = []
        for match in MENTION_PATTERN.findall(text):
            token = match.lower()
            if token not in seen:
                seen.append(token)
        return seen

    def _auth_headers(self, agent_handle: str | None = None) -> dict[str, str]:
        """Build Band API authentication headers (`X-API-Key` + Bearer fallback)."""
        api_key = self.settings.band_api_key
        if agent_handle and agent_handle in self.identities:
            identity_key = self.identities[agent_handle].api_key
            if identity_key:
                api_key = identity_key
        if not api_key:
            return {}
        return {
            "X-API-Key": api_key,
            "Authorization": f"Bearer {api_key}",
        }

    async def register_agent_identities(self) -> dict[str, BandAgentIdentity]:
        """Ensure `@visual_pixelate` and `@copy_pixelate` exist in Band (or local registry)."""
        if not self.settings.band_enabled or self._http is None:
            for identity in self.identities.values():
                if not identity.band_agent_id:
                    identity.band_agent_id = f"local_{identity.handle.lstrip('@')}"
                identity.registered_remote = False
            logger.info(
                "BAND_API_KEY not set — registered %s in local fallback mode",
                list(self.identities.keys()),
            )
            return self.identities

        existing_by_handle: dict[str, dict[str, Any]] = {}
        try:
            resp = await self._http.get("/api/v1/me/agents", headers=self._auth_headers())
            if resp.status_code < 400:
                payload = resp.json()
                agents_list = (
                    payload.get("data", payload) if isinstance(payload, dict) else payload
                )
                if isinstance(agents_list, list):
                    for item in agents_list:
                        raw_handle = str(item.get("handle") or item.get("username") or "").lower()
                        if raw_handle:
                            canonical = (
                                raw_handle if raw_handle.startswith("@") else f"@{raw_handle}"
                            )
                            existing_by_handle[canonical] = item
        except httpx.HTTPError as exc:
            logger.warning("Could not list existing Band agents: %s", exc)

        for handle, identity in self.identities.items():
            if handle in existing_by_handle:
                record = existing_by_handle[handle]
                identity.band_agent_id = str(record.get("id") or record.get("agent_id") or handle)
                identity.registered_remote = True
                logger.info("Verified Band agent identity %s (%s)", handle, identity.band_agent_id)
                continue

            try:
                create_resp = await self._http.post(
                    "/api/v1/me/agents",
                    headers=self._auth_headers(),
                    json={
                        "handle": handle.lstrip("@"),
                        "name": identity.display_name,
                        "description": identity.role_description,
                        "capabilities": ["chat", "mentions", "memories"],
                    },
                )
                if create_resp.status_code < 400:
                    data = create_resp.json()
                    record = data.get("data", data) if isinstance(data, dict) else {}
                    identity.band_agent_id = str(
                        record.get("id") or record.get("agent_id") or f"band_{handle.lstrip('@')}"
                    )
                    if record.get("api_key") and not identity.api_key:
                        identity.api_key = str(record["api_key"])
                    identity.registered_remote = True
                    logger.info("Registered Band agent identity %s", handle)
                else:
                    logger.warning(
                        "Band agent registration for %s returned HTTP %s: %s",
                        handle,
                        create_resp.status_code,
                        create_resp.text[:300],
                    )
                    identity.band_agent_id = f"local_{handle.lstrip('@')}"
            except httpx.HTTPError as exc:
                logger.warning("Band agent registration failed for %s: %s", handle, exc)
                identity.band_agent_id = f"local_{handle.lstrip('@')}"

        return self.identities

    async def create_campaign_room(
        self, campaign_id: str, brand_name: str
    ) -> BandRoom:
        """Create a dedicated task-scoped collaboration room for a campaign."""
        participants = [AgentHandle.VISUAL.value, AgentHandle.COPY.value]
        room_title = f"Agent Pixelate · {brand_name} ({campaign_id})"
        transport: Literal["band", "local_fallback"] = self.active_transport
        room_id = f"room_{campaign_id}"
        metadata: dict[str, Any] = {"campaign_id": campaign_id, "brand_name": brand_name}

        if self.settings.band_enabled and self._http is not None:
            participant_ids = [
                self.identities[h].band_agent_id or h.lstrip("@") for h in participants
            ]
            created = False
            for endpoint in ("/api/v1/agent/chats", "/api/v1/me/chats"):
                try:
                    resp = await self._http.post(
                        endpoint,
                        headers=self._auth_headers(),
                        json={
                            "title": room_title,
                            "name": room_title,
                            "participants": participant_ids,
                            "participant_handles": [h.lstrip("@") for h in participants],
                            "metadata": {
                                "campaign_id": campaign_id,
                                "brand_name": brand_name,
                                "scope": "campaign_task",
                            },
                        },
                    )
                    if resp.status_code < 400:
                        data = resp.json()
                        record = data.get("data", data) if isinstance(data, dict) else {}
                        remote_id = record.get("id") or record.get("chat_id") or record.get("room_id")
                        if remote_id:
                            room_id = str(remote_id)
                        metadata["band_endpoint"] = endpoint
                        created = True
                        logger.info("Created Band room %s for campaign %s", room_id, campaign_id)
                        break
                    logger.warning(
                        "Band room create via %s returned HTTP %s", endpoint, resp.status_code
                    )
                except httpx.HTTPError as exc:
                    logger.warning("Band room create via %s failed: %s", endpoint, exc)

            if not created:
                if self.settings.band_fallback_on_error:
                    logger.warning(
                        "Falling back to local event bus room for campaign %s", campaign_id
                    )
                    transport = "local_fallback"
                else:
                    raise RuntimeError("Failed to create Band room and fallback is disabled.")

        room = BandRoom(
            room_id=room_id,
            campaign_id=campaign_id,
            title=room_title,
            participants=participants,
            transport=transport,
            metadata=metadata,
        )
        self._rooms[campaign_id] = room

        if transport == "band":
            self._start_room_ws_bridge(room)

        return room

    def _start_room_ws_bridge(self, room: BandRoom) -> None:
        """Spawn a background Phoenix Channels WebSocket listener for a live Band room."""
        if room.campaign_id in self._room_ws_tasks:
            return
        task = asyncio.create_task(
            self._listen_band_ws(room),
            name=f"band-ws-{room.campaign_id}",
        )
        self._room_ws_tasks[room.campaign_id] = task

    async def _listen_band_ws(self, room: BandRoom) -> None:
        """Bridge live Band WebSocket events into `AsyncEventBus` as `AgentEvent` objects."""
        try:
            import websockets
        except ImportError:
            logger.debug("`websockets` package not installed; skipping remote Band WS listener.")
            return

        api_key = self.settings.band_api_key
        if not api_key:
            return

        ws_url = self.settings.band_ws_url
        sep = "&" if "?" in ws_url else "?"
        connect_url = f"{ws_url}{sep}api_key={api_key}&vsn=2.0.0"
        topic = f"chat:{room.room_id}"

        try:
            async with websockets.connect(
                connect_url,
                additional_headers={"X-API-Key": api_key},
                open_timeout=10,
                ping_interval=20,
            ) as ws:
                # Join Phoenix channel topic for this task-scoped Band room
                join_frame = json.dumps(["1", "1", topic, "phx_join", {}])
                await ws.send(join_frame)
                logger.info("Connected Band WebSocket bridge for topic %s", topic)

                async for raw in ws:
                    event = self._parse_band_ws_frame(raw, room)
                    if event is None:
                        continue
                    await self.store.append_event(room.campaign_id, event)
                    await self.event_bus.publish(event)
                    await self._dispatch_mentions(event)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "Band WebSocket bridge stopped for room %s (%s); REST + local bus remain active.",
                room.room_id,
                exc,
            )

    def _parse_band_ws_frame(self, raw: str | bytes, room: BandRoom) -> AgentEvent | None:
        """Translate a Band Phoenix Channels WS message into a strict `AgentEvent`."""
        try:
            data = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        except Exception:
            return None

        # Phoenix v2 wire format: [join_ref, ref, topic, event_name, payload]
        if isinstance(data, list) and len(data) >= 5:
            event_name = str(data[3])
            payload = data[4] if isinstance(data[4], dict) else {}
        elif isinstance(data, dict):
            event_name = str(data.get("event") or data.get("type") or "")
            payload = data.get("payload", data)
        else:
            return None

        if event_name in {"phx_reply", "phx_close", "presence_state", "presence_diff"}:
            return None

        content = str(
            payload.get("content")
            or payload.get("body")
            or payload.get("message")
            or ""
        ).strip()
        if not content:
            return None

        sender_raw = str(
            payload.get("sender_handle")
            or payload.get("sender")
            or payload.get("author")
            or "band"
        )
        sender = sender_raw if sender_raw.startswith("@") else f"@{sender_raw}"
        mentions = self.extract_mentions(content)
        event_id = str(payload.get("id") or f"band_evt_{uuid4().hex[:10]}")

        event_type = EventType.AGENT_MENTION if mentions else EventType.AGENT_THINKING
        return AgentEvent(
            event_id=event_id,
            campaign_id=room.campaign_id,
            room_id=room.room_id,
            event_type=event_type,
            sender=sender,
            mentions=mentions,
            message=content,
            payload={"band_event": event_name, "raw_metadata": payload.get("metadata", {})},
            transport="band",
            timestamp=utc_now(),
        )

    async def store_memory(
        self,
        campaign_id: str,
        room_id: str,
        author: str,
        key: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> BandMemoryEntry:
        """Persist shared memory in Band room context/memories and local campaign storage."""
        entry = BandMemoryEntry(
            room_id=room_id,
            campaign_id=campaign_id,
            author=author,
            key=key,
            content=content,
            metadata=metadata or {},
        )

        room = self._rooms.get(campaign_id)
        use_remote = (
            self.settings.band_enabled
            and self._http is not None
            and (room is None or room.transport == "band")
        )

        if use_remote and self._http is not None:
            for endpoint in (
                f"/api/v1/agent/chats/{room_id}/context",
                "/api/v1/agent/memories",
            ):
                try:
                    resp = await self._http.post(
                        endpoint,
                        headers=self._auth_headers(author),
                        json={
                            "chat_id": room_id,
                            "key": key,
                            "content": content,
                            "author": author,
                            "metadata": {
                                **(metadata or {}),
                                "campaign_id": campaign_id,
                                "memory_id": entry.memory_id,
                            },
                        },
                    )
                    if resp.status_code < 400:
                        data = resp.json()
                        record = data.get("data", data) if isinstance(data, dict) else {}
                        if record.get("id"):
                            entry.memory_id = str(record["id"])
                        entry.metadata["band_synced"] = True
                        break
                except httpx.HTTPError as exc:
                    logger.debug("Band memory write via %s failed: %s", endpoint, exc)

        await self.store.save_memory(entry)
        return entry

    async def get_room_memories(
        self, campaign_id: str, room_id: str
    ) -> list[BandMemoryEntry]:
        """Retrieve shared Band Memories for a campaign room (remote + local durable store)."""
        local_memories = await self.store.get_memories(campaign_id)
        room = self._rooms.get(campaign_id)
        use_remote = (
            self.settings.band_enabled
            and self._http is not None
            and (room is None or room.transport == "band")
        )
        if not use_remote or self._http is None:
            return local_memories

        try:
            resp = await self._http.get(
                f"/api/v1/agent/chats/{room_id}/context",
                headers=self._auth_headers(),
            )
            if resp.status_code < 400:
                payload = resp.json()
                remote_items = (
                    payload.get("memories")
                    or payload.get("data")
                    or (payload if isinstance(payload, list) else [])
                )
                if isinstance(remote_items, list):
                    known_ids = {m.memory_id for m in local_memories}
                    for item in remote_items:
                        if not isinstance(item, dict) or not item.get("content"):
                            continue
                        mem_id = str(item.get("id") or f"band_mem_{uuid4().hex[:8]}")
                        if mem_id not in known_ids:
                            local_memories.append(
                                BandMemoryEntry(
                                    memory_id=mem_id,
                                    room_id=room_id,
                                    campaign_id=campaign_id,
                                    author=str(item.get("author") or AgentHandle.VISUAL.value),
                                    key=str(item.get("key") or "shared_context"),
                                    content=str(item["content"]),
                                    metadata=item.get("metadata") or {},
                                )
                            )
        except httpx.HTTPError as exc:
            logger.debug("Band room context fetch failed for %s: %s", room_id, exc)

        return local_memories

    async def post_room_message(
        self,
        campaign_id: str,
        room_id: str,
        sender: str,
        message: str,
        event_type: EventType = EventType.AGENT_THINKING,
        payload: dict[str, Any] | None = None,
        trigger_mentions: bool = True,
    ) -> AgentEvent:
        """Post a message to the Band room, persist it, stream via WebSocket, and route @mentions."""
        mentions = self.extract_mentions(message)
        room = self._rooms.get(campaign_id)
        transport: Literal["band", "local_fallback"] = (
            room.transport if room is not None else self.active_transport
        )
        remote_message_id: str | None = None

        if transport == "band" and self._http is not None and self.settings.band_enabled:
            try:
                resp = await self._http.post(
                    f"/api/v1/agent/chats/{room_id}/messages",
                    headers=self._auth_headers(sender),
                    json={
                        "content": message,
                        "body": message,
                        "sender": sender,
                        "mentions": mentions,
                        "metadata": {
                            "campaign_id": campaign_id,
                            "event_type": event_type.value,
                            **(payload or {}),
                        },
                    },
                )
                if resp.status_code < 400:
                    data = resp.json()
                    record = data.get("data", data) if isinstance(data, dict) else {}
                    if record.get("id"):
                        remote_message_id = str(record["id"])
                else:
                    logger.warning(
                        "Band message post returned HTTP %s; event still delivered via event bus.",
                        resp.status_code,
                    )
            except httpx.HTTPError as exc:
                logger.warning("Band message post failed (%s); using local event bus.", exc)

        event = AgentEvent(
            event_id=remote_message_id or f"evt_{uuid4().hex[:12]}",
            campaign_id=campaign_id,
            room_id=room_id,
            event_type=event_type,
            sender=sender,
            mentions=mentions,
            message=message,
            payload=payload or {},
            transport=transport,
            timestamp=utc_now(),
        )

        await self.store.append_event(campaign_id, event)
        await self.event_bus.publish(event)

        if trigger_mentions and mentions:
            await self._dispatch_mentions(event)

        return event

    async def _dispatch_mentions(self, event: AgentEvent) -> None:
        """Invoke registered local routing callbacks for any `@handle` mentioned in `event`."""
        for mention in event.mentions:
            handlers = self._mention_handlers.get(mention.lower(), [])
            for handler in handlers:
                try:
                    await handler(event)
                except Exception as exc:
                    logger.exception("Mention handler failed for %s: %s", mention, exc)

    def set_participant_status(
        self,
        campaign_id: str,
        handle: str,
        status: Literal["online", "thinking", "working", "awaiting_approval", "idle"],
    ) -> None:
        """Update live presence state for a human or AI participant in a BAND room."""
        room_map = self._presence.setdefault(campaign_id, {})
        room_map[handle] = status

    def set_human_display_name(self, campaign_id: str, display_name: str | None) -> None:
        if display_name and display_name.strip():
            self._human_names[campaign_id] = display_name.strip()

    def record_delegation(
        self,
        *,
        campaign_id: str,
        from_handle: str,
        to_handle: str,
        reason: str,
        memory_id: str | None = None,
        status: Literal["dispatched", "awaiting_approval", "completed"] = "dispatched",
    ) -> BandDelegationEdge:
        """Record an auditable BAND task delegation edge in the campaign room."""
        edge = BandDelegationEdge(
            from_handle=from_handle,
            to_handle=to_handle,
            reason=reason,
            memory_id=memory_id,
            status=status,
        )
        self._delegations.setdefault(campaign_id, []).append(edge)
        return edge

    def complete_delegation(self, campaign_id: str, to_handle: str) -> None:
        """Mark the most recent active delegation targeting `to_handle` as completed."""
        for edge in reversed(self._delegations.get(campaign_id, [])):
            if edge.to_handle == to_handle and edge.status != "completed":
                edge.status = "completed"
                break

    def get_participants(self, campaign: CampaignResponse) -> list[BandParticipant]:
        """Return live participant roster with presence, frameworks, and Finch skills."""
        cid = campaign.campaign_id
        presence = self._presence.get(cid, {})
        human_name = self._human_names.get(cid) or str(
            campaign.request.metadata.get("human_name") or "Creative Director (You)"
        )

        # Derive smart defaults from campaign lifecycle if explicit presence wasn't set
        def _default_visual_status() -> Literal["online", "thinking", "working", "awaiting_approval", "idle"]:
            if campaign.status == CampaignStatus.VISUAL_GENERATING:
                return "working"
            if campaign.status == CampaignStatus.AWAITING_APPROVAL:
                return "awaiting_approval"
            return "online"

        def _default_copy_status() -> Literal["online", "thinking", "working", "awaiting_approval", "idle"]:
            if campaign.status == CampaignStatus.COPY_GENERATING:
                return "working"
            if campaign.status == CampaignStatus.AWAITING_APPROVAL:
                return "idle"
            return "online"

        vis_ident = self.identities.get(AgentHandle.VISUAL.value)
        copy_ident = self.identities.get(AgentHandle.COPY.value)

        return [
            BandParticipant(
                handle=AgentHandle.HUMAN.value,
                display_name=human_name,
                role="Human Director · Approvals & @mention Delegation",
                kind="human",
                status=presence.get(AgentHandle.HUMAN.value, "online"),
                framework="BAND Human-in-the-Loop",
                skills=["campaign_brief", "approval_gate", "live_feedback"],
                registered_remote=True,
                last_active_at=campaign.updated_at,
            ),
            BandParticipant(
                handle=AgentHandle.ORCHESTRATOR.value,
                display_name="BAND Orchestrator",
                role="Shared Room Router & Memory Sync",
                kind="orchestrator",
                status=presence.get(AgentHandle.ORCHESTRATOR.value, "online"),
                framework="BAND Protocol + FastAPI",
                skills=["room_routing", "shared_memory_sync", "ffmpeg_mp4_studio"],
                registered_remote=self.active_transport == "band",
                last_active_at=campaign.updated_at,
            ),
            BandParticipant(
                handle=AgentHandle.VISUAL.value,
                display_name="Visual Pixelate",
                role="Creative Director & Visual Asset Synthesizer",
                kind="agent",
                status=presence.get(AgentHandle.VISUAL.value, _default_visual_status()),
                framework="AdaL / AdalFlow + Gemini Imagen",
                skills=["brand_visual_direction", "motion_video_direction"],
                registered_remote=bool(vis_ident and vis_ident.registered_remote),
                last_active_at=campaign.updated_at,
            ),
            BandParticipant(
                handle=AgentHandle.COPY.value,
                display_name="Copy Pixelate",
                role="Conversion Copywriter & Social Strategist",
                kind="agent",
                status=presence.get(AgentHandle.COPY.value, _default_copy_status()),
                framework="AdaL / AdalFlow + Finch Skills",
                skills=["ad_copy_conversion", "social_platform_formatter"],
                registered_remote=bool(copy_ident and copy_ident.registered_remote),
                last_active_at=campaign.updated_at,
            ),
        ]

    async def build_room_snapshot(self, campaign: CampaignResponse) -> BandRoomSnapshot:
        """Assemble the complete live BAND room state for frontend collaboration UI."""
        memories = await self.get_room_memories(campaign.campaign_id, campaign.room_id)
        approval_required = bool(campaign.request.metadata.get("require_handoff_approval", False))
        pending_approval = campaign.status == CampaignStatus.AWAITING_APPROVAL
        delegations = list(self._delegations.get(campaign.campaign_id, []))

        # Hydrate delegation edges from persisted events if orchestrator restarted
        if not delegations:
            for evt in campaign.events:
                if evt.event_type == EventType.AGENT_MENTION and evt.mentions:
                    for target in evt.mentions:
                        delegations.append(
                            BandDelegationEdge(
                                edge_id=f"del_{evt.event_id[-8:]}",
                                from_handle=evt.sender,
                                to_handle=target,
                                reason=evt.message[:140],
                                memory_id=evt.payload.get("band_memory_id")
                                or evt.payload.get("brief_memory_id"),
                                status="awaiting_approval"
                                if pending_approval and target == AgentHandle.COPY.value
                                else "completed"
                                if campaign.status == CampaignStatus.COMPLETED
                                else "dispatched",
                                timestamp=evt.timestamp,
                            )
                        )

        return BandRoomSnapshot(
            campaign_id=campaign.campaign_id,
            room_id=campaign.room_id,
            transport=campaign.transport,
            status=campaign.status,
            approval_required=approval_required,
            pending_approval=pending_approval,
            participants=self.get_participants(campaign),
            memories=memories,
            messages=[e for e in campaign.events if e.event_type != EventType.HEARTBEAT],
            delegations=delegations,
            updated_at=utc_now(),
        )

    def status_summary(self) -> dict[str, Any]:
        """Diagnostic summary returned by `/health`."""
        return {
            "transport": self.active_transport,
            "band_rest_url": self.settings.band_rest_url,
            "band_ws_url": self.settings.band_ws_url,
            "band_sdk_installed": self._sdk_available,
            "registered_agents": {
                handle: {
                    "display_name": ident.display_name,
                    "band_agent_id": ident.band_agent_id,
                    "registered_remote": ident.registered_remote,
                }
                for handle, ident in self.identities.items()
            },
        }
