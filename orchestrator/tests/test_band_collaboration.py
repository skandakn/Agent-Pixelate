"""End-to-end architectural tests for BAND (`band.ai`) Human + Multi-Agent Collaboration Room."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from orchestrator.config import Settings
from orchestrator.main import create_app


@pytest.mark.asyncio
async def test_band_human_approval_gate_memory_pin_and_mention_revision(
    tmp_path: Path,
) -> None:
    settings = Settings(
        campaign_data_dir=str(tmp_path),
        band_api_key=None,
        enable_local_agent_fallback=True,
    )
    app = create_app(settings=settings)

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Launch campaign with Human Approval Gate enabled
            gen_resp = await client.post(
                "/api/campaigns/generate",
                json={
                    "brand_name": "KuroAudio",
                    "product_description": "Machined titanium planar magnetic headphones with 50h battery.",
                    "target_audience": "Mastering engineers and industrial designers",
                    "brand_tone": "Minimalist",
                    "platforms": ["instagram", "linkedin"],
                    "num_concepts": 2,
                    "metadata": {"require_handoff_approval": True},
                },
            )
            assert gen_resp.status_code == 202
            campaign_id = gen_resp.json()["campaign_id"]

            # Wait briefly for @visual_pixelate to finish and pause at AWAITING_APPROVAL
            for _ in range(40):
                detail = (await client.get(f"/api/campaigns/{campaign_id}")).json()
                if detail["status"] == "awaiting_approval":
                    break
                await asyncio.sleep(0.1)

            assert detail["status"] == "awaiting_approval"
            assert detail["visual_output"] is not None
            assert detail["copy_output"] is None

            # 2. Inspect full BAND Room Snapshot
            room_resp = await client.get(f"/api/campaigns/{campaign_id}/band/room")
            assert room_resp.status_code == 200
            room = room_resp.json()
            assert room["approval_required"] is True
            assert room["pending_approval"] is True
            handles = {p["handle"] for p in room["participants"]}
            assert handles == {
                "@human_director",
                "@orchestrator_pixelate",
                "@visual_pixelate",
                "@copy_pixelate",
            }
            assert len(room["memories"]) >= 2
            assert len(room["delegations"]) >= 2

            # 3. Pin a custom Brand Guardrail into Shared BAND Memory
            pin_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/memories",
                json={
                    "author": "@human_director",
                    "key": "brand_guardrail",
                    "content": "Never use exclamation marks; emphasize machined titanium craft.",
                    "pinned": True,
                },
            )
            assert pin_resp.status_code == 201
            pinned_mem = pin_resp.json()
            assert pinned_mem["key"] == "brand_guardrail"

            # 4. Human Director approves handoff to @copy_pixelate
            approve_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/approve-handoff",
                json={
                    "approver": "@human_director",
                    "approved": True,
                    "note": "Keep LinkedIn tone architectural and restrained.",
                },
            )
            assert approve_resp.status_code == 200

            # Wait for @copy_pixelate to complete
            for _ in range(40):
                detail = (await client.get(f"/api/campaigns/{campaign_id}")).json()
                if detail["status"] == "completed":
                    break
                await asyncio.sleep(0.1)

            assert detail["status"] == "completed"
            assert detail["copy_output"] is not None

            # 5. Human Director sends live @mention delegation into BAND room
            msg_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/messages",
                json={
                    "sender": "@human_director",
                    "sender_name": "Alex",
                    "message": "@copy_pixelate Tighten the LinkedIn hook to under 10 words.",
                },
            )
            assert msg_resp.status_code == 201
            assert msg_resp.json()["event_type"] == "human_message"

            # Wait for revision task to settle
            await asyncio.sleep(0.4)
            room_after = (await client.get(f"/api/campaigns/{campaign_id}/band/room")).json()
            memory_keys = {m["key"] for m in room_after["memories"]}
            assert {"campaign_brief", "visual_brief", "brand_guardrail", "human_copy_directive"} <= memory_keys
            assert any(
                d["from_handle"] == "@human_director" and d["to_handle"] == "@copy_pixelate"
                for d in room_after["delegations"]
            )
