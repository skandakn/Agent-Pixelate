"""FastAPI entrypoint for the Agent Pixelate Backend Orchestrator.

Exposes:
- `POST /api/campaigns/generate`: Validates `CampaignRequest`, initializes a
  task-scoped Band room, dispatches the initial prompt to `@visual_pixelate`,
  and returns `campaign_id`.
- `WS /ws/campaign/{campaign_id}`: Streams live `AgentEvent` JSON objects from
  the Band room (or local async event bus fallback) to the Next.js frontend.
- `GET /api/campaigns/{campaign_id}`: Returns the complete aggregated
  `VisualOutput` + `CopyOutput` state from persistent storage (`/data/campaigns`).
"""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from orchestrator.band_client import BandAdapter
from orchestrator.config import Settings, get_settings
from orchestrator.event_bus import AsyncEventBus
from orchestrator.storage import CampaignStore
from orchestrator.video_renderer import AspectRatio, ShotStyle
from orchestrator.workflow import CampaignCoordinator
from pydantic import BaseModel
from shared.schemas import (
    AgentEvent,
    AgentEventInput,
    BandAgentDirectoryEntry,
    BandApprovalInput,
    BandAuditEntry,
    BandCriticReport,
    BandFocusWindow,
    BandGovernancePatch,
    BandMemoryEntry,
    BandMemoryInput,
    BandMessageInput,
    BandPromoteMemoryInput,
    BandRoomSnapshot,
    CampaignGenerateResponse,
    CampaignRequest,
    CampaignResponse,
    CopyOutput,
    EventType,
    VisualAsset,
    VisualOutput,
    utc_now,
)


class VideoRenderRequest(BaseModel):
    """On-demand video cut generation request."""

    aspect_ratio: AspectRatio = "16:9"
    shot_style: ShotStyle = "obsidian_cinema"

logger = logging.getLogger("agent_pixelate.orchestrator")


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Factory that builds a configured FastAPI application instance."""
    cfg = settings or get_settings()
    _configure_logging(cfg.log_level)

    data_dir = cfg.resolve_data_dir()
    store = CampaignStore(base_dir=data_dir)
    event_bus = AsyncEventBus()
    band = BandAdapter(settings=cfg, event_bus=event_bus, store=store)
    coordinator = CampaignCoordinator(
        settings=cfg,
        store=store,
        event_bus=event_bus,
        band=band,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        await band.startup()
        await coordinator.startup()
        logger.info(
            "Agent Pixelate Orchestrator ready (transport=%s, storage=%s)",
            band.active_transport,
            data_dir,
        )
        try:
            yield
        finally:
            await coordinator.shutdown()
            await band.shutdown()
            logger.info("Agent Pixelate Orchestrator shut down cleanly.")

    app = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        description=(
            "Multi-agent AI marketing campaign orchestrator powered by Band (`band.ai`) "
            "rooms, @mention handoffs, shared Band Memories, and Agent37 cloud sandboxes."
        ),
        lifespan=lifespan,
    )

    # Store runtime services on app.state for dependency access & tests
    app.state.settings = cfg
    app.state.store = store
    app.state.event_bus = event_bus
    app.state.band = band
    app.state.coordinator = coordinator

    # CORS middleware for Next.js frontend and Agent37 HTTPS preview origins
    allow_all = "*" in cfg.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else cfg.cors_origin_list,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(ValueError)
    async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(exc)},
        )

    @app.exception_handler(PermissionError)
    async def permission_error_handler(
        _request: Request, exc: PermissionError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": str(exc)},
        )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, Any]:
        """Service health, Band integration status, and Agent37 runtime diagnostics."""
        return {
            "status": "ok",
            "service": cfg.app_name,
            "version": cfg.app_version,
            "environment": cfg.environment,
            "storage_dir": str(store.base_dir),
            "band": band.status_summary(),
            "agents_service_configured": bool(cfg.agents_service_url),
            "gemini_configured": bool(cfg.gemini_api_key),
            "clerk_configured": bool(os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")),
            "sandbox_runtime": os.environ.get("AGENT37_RUNTIME", "standard"),
            "timestamp": utc_now().isoformat(),
        }

    @app.get("/api/config", tags=["system"])
    async def public_runtime_config() -> dict[str, Any]:
        """Expose non-secret public runtime configuration (e.g., Clerk publishable key)."""
        return {
            "clerk_publishable_key": os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", ""),
            "gemini_enabled": bool(cfg.gemini_api_key),
            "band_transport": band.active_transport,
        }

    @app.post(
        "/api/campaigns/generate",
        response_model=CampaignGenerateResponse,
        status_code=status.HTTP_202_ACCEPTED,
        tags=["campaigns"],
    )
    async def generate_campaign(
        payload: CampaignRequest,
    ) -> CampaignGenerateResponse:
        """Validate `CampaignRequest`, create a Band room, and dispatch to `@visual_pixelate`."""
        try:
            campaign = await coordinator.start_campaign(payload)
        except Exception as exc:
            logger.exception("Failed to initialize campaign")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start campaign orchestration: {exc}",
            ) from exc

        return CampaignGenerateResponse(
            campaign_id=campaign.campaign_id,
            status=campaign.status,
            room_id=campaign.room_id,
            transport=campaign.transport,
            ws_url=f"/ws/campaign/{campaign.campaign_id}",
            detail_url=f"/api/campaigns/{campaign.campaign_id}",
            created_at=campaign.created_at,
        )

    @app.get(
        "/api/campaigns",
        response_model=list[CampaignResponse],
        tags=["campaigns"],
    )
    async def list_campaigns(
        limit: int = Query(default=25, ge=1, le=100),
    ) -> list[CampaignResponse]:
        """List recent campaigns from persistent storage."""
        return await store.list_campaigns(limit=limit)

    @app.get(
        "/api/campaigns/{campaign_id}",
        response_model=CampaignResponse,
        tags=["campaigns"],
    )
    async def get_campaign(campaign_id: str) -> CampaignResponse:
        """Return the complete aggregated `VisualOutput` + `CopyOutput` state from storage."""
        try:
            campaign = await store.get_campaign(campaign_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return campaign

    @app.get(
        "/api/campaigns/{campaign_id}/memories",
        response_model=list[BandMemoryEntry],
        tags=["band"],
    )
    async def get_campaign_memories(campaign_id: str) -> list[BandMemoryEntry]:
        """Inspect shared Band Memories stored for a campaign's collaboration room."""
        campaign = await store.get_campaign(campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return await band.get_room_memories(campaign_id, campaign.room_id)

    @app.get(
        "/api/campaigns/{campaign_id}/band/room",
        response_model=BandRoomSnapshot,
        tags=["band"],
    )
    async def get_band_room_snapshot(campaign_id: str) -> BandRoomSnapshot:
        """Return live BAND room snapshot: participant presence, memories, messages & delegations."""
        campaign = await store.get_campaign(campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return await band.build_room_snapshot(campaign)

    @app.post(
        "/api/campaigns/{campaign_id}/band/messages",
        response_model=AgentEvent,
        status_code=status.HTTP_201_CREATED,
        tags=["band"],
    )
    async def post_band_room_message(
        campaign_id: str, body: BandMessageInput
    ) -> AgentEvent:
        """Post a human message into the BAND room and route `@mention` revisions to agents."""
        try:
            return await coordinator.post_human_room_message(
                campaign_id=campaign_id,
                sender=body.sender,
                sender_name=body.sender_name,
                message=body.message,
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/band/memories",
        response_model=BandMemoryEntry,
        status_code=status.HTTP_201_CREATED,
        tags=["band"],
    )
    async def pin_band_room_memory(
        campaign_id: str, body: BandMemoryInput
    ) -> BandMemoryEntry:
        """Pin a shared brand guideline or constraint into BAND Room Memory."""
        try:
            return await coordinator.pin_room_memory(
                campaign_id=campaign_id,
                author=body.author,
                key=body.key,
                content=body.content,
                pinned=body.pinned,
                metadata=body.metadata,
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/band/approve-handoff",
        response_model=CampaignResponse,
        tags=["band"],
    )
    async def approve_band_handoff(
        campaign_id: str, body: BandApprovalInput
    ) -> CampaignResponse:
        """Human-in-the-loop gate approval (or revision request) before `@copy_pixelate` runs."""
        try:
            return await coordinator.approve_handoff(
                campaign_id=campaign_id,
                approver=body.approver,
                approved=body.approved,
                note=body.note,
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

    @app.get(
        "/api/band/registry",
        response_model=list[BandAgentDirectoryEntry],
        tags=["band-control-plane"],
    )
    async def list_band_agent_registry() -> list[BandAgentDirectoryEntry]:
        """BAND Agentic Mesh Discovery Registry across heterogeneous frameworks."""
        return band.get_agent_directory()

    @app.get(
        "/api/band/brands/{brand_name}/memories",
        response_model=list[BandMemoryEntry],
        tags=["band-control-plane"],
    )
    async def list_cross_session_brand_memories(brand_name: str) -> list[BandMemoryEntry]:
        """Retrieve persistent Cross-Session Brand Memories shared across BAND rooms."""
        return band.brand_vault.list_brand_memories(brand_name)

    @app.get(
        "/api/campaigns/{campaign_id}/band/focus/{agent_handle}",
        response_model=BandFocusWindow,
        tags=["band-control-plane"],
    )
    async def get_band_agent_focus(
        campaign_id: str, agent_handle: str
    ) -> BandFocusWindow:
        """Inspect BAND Per-Agent Focus context isolation & token savings for an agent."""
        campaign = await store.get_campaign(campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return await band.get_agent_focus(campaign, agent_handle)

    @app.get(
        "/api/campaigns/{campaign_id}/band/audit",
        response_model=list[BandAuditEntry],
        tags=["band-control-plane"],
    )
    async def get_band_audit_ledger(campaign_id: str) -> list[BandAuditEntry]:
        """Export SHA-256 hash-chained BAND Governance & Interaction Audit Ledger."""
        campaign = await store.get_campaign(campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return band.build_audit_log(campaign)

    @app.post(
        "/api/campaigns/{campaign_id}/band/memories/promote",
        response_model=BandMemoryEntry,
        status_code=status.HTTP_201_CREATED,
        tags=["band-control-plane"],
    )
    async def promote_band_memory(
        campaign_id: str, body: BandPromoteMemoryInput
    ) -> BandMemoryEntry:
        """Promote a room memory to Cross-Session Brand Memory (Human /me scope)."""
        try:
            return await coordinator.promote_memory_to_brand(
                campaign_id=campaign_id,
                memory_id=body.memory_id,
                promoter=body.promoter,
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.patch(
        "/api/campaigns/{campaign_id}/band/governance",
        response_model=BandRoomSnapshot,
        tags=["band-control-plane"],
    )
    async def patch_band_governance(
        campaign_id: str, body: BandGovernancePatch
    ) -> BandRoomSnapshot:
        """Update BAND Control Plane policies (Human /me scope: loop guard, auto QA, mutes)."""
        try:
            updated = await coordinator.update_governance(campaign_id, body)
            return await band.build_room_snapshot(updated)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/band/critic/run",
        response_model=BandCriticReport,
        tags=["band-control-plane"],
    )
    async def run_band_critic(campaign_id: str) -> BandCriticReport:
        """Trigger `@critic_pixelate` Brand QA, WCAG contrast & guardrail audit."""
        try:
            return await coordinator.run_critic_audit(campaign_id)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.get(
        "/api/campaigns/{campaign_id}/assets/{filename}",
        tags=["assets"],
    )
    async def get_campaign_asset(campaign_id: str, filename: str) -> FileResponse:
        """Serve generated media assets persisted in `/data/campaigns/{campaign_id}/assets/`."""
        try:
            asset_path = store.resolve_asset_path(campaign_id, filename)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        if asset_path is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset '{filename}' not found for campaign '{campaign_id}'.",
            )
        media_type, _ = mimetypes.guess_type(str(asset_path))
        if asset_path.suffix.lower() == ".mp4":
            media_type = "video/mp4"
        return FileResponse(
            path=asset_path,
            media_type=media_type or "application/octet-stream",
            filename=asset_path.name,
        )

    @app.post(
        "/api/campaigns/{campaign_id}/video",
        response_model=VisualAsset,
        status_code=status.HTTP_201_CREATED,
        tags=["assets"],
    )
    async def render_campaign_video(
        campaign_id: str, body: VideoRenderRequest
    ) -> VisualAsset:
        """Render an on-demand cinematic H.264 MP4 cut (16:9 or 9:16) with shot recipes."""
        try:
            return await coordinator.render_campaign_video(
                campaign_id,
                aspect_ratio=body.aspect_ratio,
                shot_style=body.shot_style,
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/callbacks/visual",
        response_model=CampaignResponse,
        tags=["callbacks"],
    )
    async def visual_agent_callback(
        campaign_id: str, visual_output: VisualOutput
    ) -> CampaignResponse:
        """Callback invoked by `@visual_pixelate` upon finishing visual asset generation.

        Persists the output, stores the visual brief in Band Memory, and posts an
        explicit `@copy_pixelate` mention into the Band room to trigger copy generation.
        """
        if visual_output.campaign_id != campaign_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="visual_output.campaign_id does not match URL campaign_id.",
            )
        try:
            return await coordinator.handle_visual_output(campaign_id, visual_output)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/callbacks/copy",
        response_model=CampaignResponse,
        tags=["callbacks"],
    )
    async def copy_agent_callback(
        campaign_id: str, copy_output: CopyOutput
    ) -> CampaignResponse:
        """Callback invoked by `@copy_pixelate` upon finishing multi-platform copy."""
        if copy_output.campaign_id != campaign_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="copy_output.campaign_id does not match URL campaign_id.",
            )
        try:
            return await coordinator.handle_copy_output(campaign_id, copy_output)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

    @app.post(
        "/api/campaigns/{campaign_id}/events",
        response_model=AgentEvent,
        status_code=status.HTTP_201_CREATED,
        tags=["callbacks"],
    )
    async def publish_agent_event(
        campaign_id: str, body: AgentEventInput
    ) -> AgentEvent:
        """Allow external agents or Band webhooks to emit live `AgentEvent` updates."""
        campaign = await store.get_campaign(campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return await band.post_room_message(
            campaign_id=campaign_id,
            room_id=campaign.room_id,
            sender=body.sender,
            message=body.message,
            event_type=body.event_type,
            payload=body.payload,
            trigger_mentions=True,
        )

    @app.websocket("/ws/campaign/{campaign_id}")
    async def campaign_websocket(websocket: WebSocket, campaign_id: str) -> None:
        """Stream live `AgentEvent` JSON frames from the campaign's Band room to the frontend."""
        try:
            campaign = await store.get_campaign(campaign_id)
        except ValueError:
            await websocket.close(code=1008, reason="Invalid campaign_id")
            return

        await websocket.accept()

        # Hydrate event bus history from disk in case the orchestrator restarted
        if campaign is not None and campaign.events:
            await event_bus.seed_history(campaign_id, campaign.events)

        room_id = campaign.room_id if campaign is not None else f"room_{campaign_id}"
        transport = campaign.transport if campaign is not None else band.active_transport
        sent_ids: set[str] = set()

        async def _drain_client_frames() -> None:
            """Consume client ping/text frames so disconnects are detected immediately."""
            try:
                while True:
                    msg = await websocket.receive_text()
                    if msg.strip().lower() == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": utc_now().isoformat()})
            except WebSocketDisconnect:
                return
            except Exception:
                return

        reader_task = asyncio.create_task(_drain_client_frames())

        try:
            async with event_bus.subscribe(campaign_id, replay_history=True) as (
                history,
                queue,
            ):
                # 1. Replay all prior room events in order
                for past_event in history:
                    await websocket.send_json(past_event.model_dump(mode="json"))
                    sent_ids.add(past_event.event_id)

                # 2. Stream live events as they arrive from Band / local event bus
                while not reader_task.done():
                    try:
                        next_event = await asyncio.wait_for(
                            queue.get(), timeout=cfg.ws_heartbeat_interval_s
                        )
                    except TimeoutError:
                        if reader_task.done():
                            break
                        heartbeat = AgentEvent(
                            campaign_id=campaign_id,
                            room_id=room_id,
                            event_type=EventType.HEARTBEAT,
                            sender="system",
                            message="heartbeat",
                            transport=transport,
                        )
                        await websocket.send_json(heartbeat.model_dump(mode="json"))
                        continue

                    if next_event.event_id in sent_ids:
                        continue
                    sent_ids.add(next_event.event_id)
                    await websocket.send_json(next_event.model_dump(mode="json"))
        except WebSocketDisconnect:
            logger.debug("WebSocket disconnected for campaign %s", campaign_id)
        except Exception as exc:
            logger.warning("WebSocket stream error for campaign %s: %s", campaign_id, exc)
        finally:
            reader_task.cancel()
            await asyncio.gather(reader_task, return_exceptions=True)

    # Serve compiled Next.js static export (`frontend/out`) when available
    frontend_dist_candidates = [
        Path(os.environ["FRONTEND_DIST_DIR"])
        if os.environ.get("FRONTEND_DIST_DIR")
        else None,
        Path("/app/frontend/out"),
        Path(__file__).resolve().parent.parent / "frontend" / "out",
    ]
    frontend_dist = next(
        (p for p in frontend_dist_candidates if p is not None and (p / "index.html").is_file()),
        None,
    )

    if frontend_dist is not None:
        next_assets_dir = frontend_dist / "_next"
        if next_assets_dir.is_dir():
            app.mount(
                "/_next",
                StaticFiles(directory=str(next_assets_dir)),
                name="frontend_next_assets",
            )

        @app.get("/", include_in_schema=False)
        async def serve_frontend_root() -> FileResponse:
            return FileResponse(frontend_dist / "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend_static(full_path: str) -> FileResponse:
            if full_path.startswith(("api/", "ws/", "health", "docs", "redoc", "openapi.json")):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

            candidate = (frontend_dist / full_path).resolve()
            try:
                candidate.relative_to(frontend_dist.resolve())
            except ValueError as exc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found") from exc

            if candidate.is_file():
                return FileResponse(candidate)
            if (candidate / "index.html").is_file():
                return FileResponse(candidate / "index.html")
            return FileResponse(frontend_dist / "index.html")
    else:
        @app.get("/", tags=["system"])
        async def root_status() -> dict[str, Any]:
            return {
                "service": cfg.app_name,
                "version": cfg.app_version,
                "status": "ok",
                "docs_url": "/docs",
                "health_url": "/health",
                "generate_url": "/api/campaigns/generate",
            }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "orchestrator.main:app",
        host=settings.orchestrator_host,
        port=settings.orchestrator_port,
        reload=settings.environment == "development",
    )
