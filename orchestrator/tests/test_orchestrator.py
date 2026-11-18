"""Comprehensive tests for Agent Pixelate Orchestrator, Shared Schemas & Band Adapter."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from orchestrator.band_client import BandAdapter
from orchestrator.config import Settings
from orchestrator.event_bus import AsyncEventBus
from orchestrator.main import create_app
from orchestrator.storage import CampaignStore
from shared.schemas import (
    AgentEvent,
    AgentHandle,
    CampaignRequest,
    CampaignStatus,
    CopyOutput,
    EventType,
    PlatformCopy,
    VisualAsset,
    VisualOutput,
)


def _sample_request() -> dict:
    return {
        "brand_name": "NovaBrew",
        "product_description": "Zero-sugar sparkling cold brew infused with adaptogenic lions mane.",
        "target_audience": "Founders, designers, and late-night builders",
        "campaign_goal": "Drive launch-week waitlist signups",
        "brand_tone": "Bold, witty, electric",
        "platforms": ["Instagram", " LinkedIn ", "web banner"],
        "color_palette": ["#0B1020", "#7C3AED", "#EC4899"],
        "num_concepts": 2,
    }


def test_campaign_request_strict_validation() -> None:
    req = CampaignRequest.model_validate(_sample_request())
    assert req.platforms == ["instagram", "linkedin", "web_banner"]

    bad = _sample_request()
    bad["unexpected_field"] = "forbidden"
    with pytest.raises(ValidationError):
        CampaignRequest.model_validate(bad)


def test_health_and_end_to_end_fallback_pipeline_with_websocket(tmp_path: Path) -> None:
    settings = Settings(
        campaign_data_dir=str(tmp_path),
        band_api_key=None,
        agents_service_url=None,
        enable_local_agent_fallback=True,
        ws_heartbeat_interval_s=5.0,
    )
    app = create_app(settings=settings)

    with TestClient(app) as client:
        # 1. Verify /health and registered Band identities
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        health = health_resp.json()
        assert health["status"] == "ok"
        assert health["band"]["transport"] == "local_fallback"
        assert "@visual_pixelate" in health["band"]["registered_agents"]
        assert "@copy_pixelate" in health["band"]["registered_agents"]

        # 2. Kick off a new campaign
        gen_resp = client.post("/api/campaigns/generate", json=_sample_request())
        assert gen_resp.status_code == 202
        gen_data = gen_resp.json()
        campaign_id = gen_data["campaign_id"]
        assert campaign_id.startswith("camp_")
        assert gen_data["ws_url"] == f"/ws/campaign/{campaign_id}"

        # 3. Stream live AgentEvent frames over WebSocket until CAMPAIGN_COMPLETED
        received_events: list[AgentEvent] = []
        with client.websocket_connect(f"/ws/campaign/{campaign_id}") as ws:
            deadline = time.monotonic() + 10.0
            while time.monotonic() < deadline:
                raw_event = ws.receive_json()
                evt = AgentEvent.model_validate(raw_event)
                received_events.append(evt)
                if evt.event_type == EventType.CAMPAIGN_COMPLETED:
                    break

        event_types = [e.event_type for e in received_events]
        assert EventType.ROOM_INITIALIZED in event_types
        assert EventType.MEMORY_STORED in event_types
        assert EventType.VISUAL_COMPLETED in event_types
        assert EventType.COPY_COMPLETED in event_types
        assert EventType.CAMPAIGN_COMPLETED in event_types

        # Verify explicit @mention handoff from @visual_pixelate -> @copy_pixelate
        handoff_events = [
            e
            for e in received_events
            if e.event_type == EventType.AGENT_MENTION
            and e.sender == AgentHandle.VISUAL.value
            and AgentHandle.COPY.value in e.mentions
        ]
        assert len(handoff_events) >= 1

        # 4. Verify GET /api/campaigns/{campaign_id} returns aggregated Visual + Copy output
        detail_resp = client.get(f"/api/campaigns/{campaign_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["status"] == CampaignStatus.COMPLETED.value
        assert detail["visual_output"] is not None
        assert detail["copy_output"] is not None
        assert len(detail["visual_output"]["assets"]) == 2
        assert detail["visual_output"]["band_memory_id"] is not None
        assert len(detail["copy_output"]["platform_copies"]) == 3
        assert len(detail["copy_output"]["band_memory_refs"]) >= 2

        # 5. Verify generated visual asset is persisted and served via API
        asset_url = detail["visual_output"]["assets"][0]["asset_url"]
        asset_resp = client.get(asset_url)
        assert asset_resp.status_code == 200
        assert "<svg" in asset_resp.text

        # 6. Verify shared Band memories endpoint
        mem_resp = client.get(f"/api/campaigns/{campaign_id}/memories")
        assert mem_resp.status_code == 200
        memories = mem_resp.json()
        memory_keys = {m["key"] for m in memories}
        assert {"campaign_brief", "visual_brief", "campaign_copy"}.issubset(memory_keys)


def test_external_agent_callbacks_trigger_band_handoff(tmp_path: Path) -> None:
    settings = Settings(
        campaign_data_dir=str(tmp_path),
        band_api_key=None,
        agents_service_url=None,
        enable_local_agent_fallback=False,
    )
    app = create_app(settings=settings)

    with TestClient(app) as client:
        gen = client.post("/api/campaigns/generate", json=_sample_request()).json()
        cid = gen["campaign_id"]

        visual_payload = VisualOutput(
            campaign_id=cid,
            creative_direction="Electric brutalist launch aesthetic",
            mood_keywords=["electric", "kinetic"],
            color_palette=["#0B1020", "#7C3AED"],
            visual_brief_markdown="## Visual Brief\nBold purple neon can floating over obsidian grid.",
            assets=[
                VisualAsset(
                    asset_id="asset_ext_1",
                    title="Hero Can Render",
                    platform="instagram",
                    aspect_ratio="1:1",
                    prompt_used="Studio macro render of NovaBrew can",
                    asset_url="https://cdn.example.com/novabrew-hero.png",
                )
            ],
        )
        vis_resp = client.post(
            f"/api/campaigns/{cid}/callbacks/visual",
            json=visual_payload.model_dump(mode="json"),
        )
        assert vis_resp.status_code == 200
        vis_state = vis_resp.json()
        assert vis_state["visual_output"]["band_memory_id"] is not None

        copy_payload = CopyOutput(
            campaign_id=cid,
            campaign_tagline="Fuel Your Midnight Build.",
            brand_voice_summary="Sharp, energetic, founder-native.",
            key_messages=["Zero sugar", "Adaptogenic clarity"],
            platform_copies=[
                PlatformCopy(
                    platform="instagram",
                    headline="Midnight clarity in a can.",
                    body_copy="Sparkling cold brew built for late-night shipping.",
                    call_to_action="Claim your drop",
                    hashtags=["#NovaBrew"],
                    linked_asset_id="asset_ext_1",
                )
            ],
            band_memory_refs=[vis_state["visual_output"]["band_memory_id"]],
        )
        copy_resp = client.post(
            f"/api/campaigns/{cid}/callbacks/copy",
            json=copy_payload.model_dump(mode="json"),
        )
        assert copy_resp.status_code == 200
        final_state = copy_resp.json()
        assert final_state["status"] == CampaignStatus.COMPLETED.value
        assert final_state["copy_output"]["campaign_tagline"] == "Fuel Your Midnight Build."

        # Verify 404 on unknown campaign
        assert client.get("/api/campaigns/camp_does_not_exist").status_code == 404


@pytest.mark.asyncio
async def test_live_band_rest_adapter_requests(tmp_path: Path) -> None:
    """Verify BandAdapter hits real Band REST API endpoints when BAND_API_KEY is present."""
    recorded_calls: list[tuple[str, str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        recorded_calls.append(
            (request.method, request.url.path, request.headers.get("X-API-Key"))
        )
        if request.method == "GET" and request.url.path == "/api/v1/me/agents":
            return httpx.Response(200, json={"data": []})
        if request.method == "POST" and request.url.path == "/api/v1/me/agents":
            return httpx.Response(201, json={"data": {"id": "band_ag_123"}})
        if request.method == "POST" and request.url.path == "/api/v1/agent/chats":
            return httpx.Response(201, json={"data": {"id": "band_room_999"}})
        if request.method == "POST" and request.url.path.endswith("/context"):
            return httpx.Response(201, json={"data": {"id": "band_mem_777"}})
        if request.method == "POST" and request.url.path.endswith("/messages"):
            return httpx.Response(201, json={"data": {"id": "band_msg_555"}})
        return httpx.Response(200, json={"data": []})

    settings = Settings(
        campaign_data_dir=str(tmp_path),
        band_api_key="band_test_secret_key",
        band_rest_url="https://app.band.ai",
    )
    store = CampaignStore(tmp_path)
    bus = AsyncEventBus()
    band = BandAdapter(settings=settings, event_bus=bus, store=store)
    band._http = httpx.AsyncClient(
        base_url="https://app.band.ai",
        transport=httpx.MockTransport(handler),
    )

    try:
        identities = await band.register_agent_identities()
        assert identities["@visual_pixelate"].registered_remote is True
        assert identities["@copy_pixelate"].registered_remote is True

        room = await band.create_campaign_room("camp_live1", "NovaBrew")
        assert room.room_id == "band_room_999"
        assert room.transport == "band"

        mem = await band.store_memory(
            campaign_id="camp_live1",
            room_id=room.room_id,
            author="@visual_pixelate",
            key="visual_brief",
            content="Electric neon aesthetic brief",
        )
        assert mem.memory_id == "band_mem_777"

        evt = await band.post_room_message(
            campaign_id="camp_live1",
            room_id=room.room_id,
            sender="@visual_pixelate",
            message="@copy_pixelate Visual brief ready in Band Memory!",
            event_type=EventType.AGENT_MENTION,
            trigger_mentions=False,
        )
        assert evt.event_id == "band_msg_555"
        assert evt.transport == "band"
        assert evt.mentions == ["@copy_pixelate"]

        paths = [path for _, path, _ in recorded_calls]
        assert "/api/v1/me/agents" in paths
        assert "/api/v1/agent/chats" in paths
        assert "/api/v1/agent/chats/band_room_999/context" in paths
        assert "/api/v1/agent/chats/band_room_999/messages" in paths
        assert all(key == "band_test_secret_key" for _, _, key in recorded_calls)
    finally:
        await band.shutdown()
