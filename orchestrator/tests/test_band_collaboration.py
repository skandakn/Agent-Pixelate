"""End-to-end architectural tests for the BAND (`band.ai`) Agentic Mesh & Control Plane."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from orchestrator.config import Settings
from orchestrator.main import create_app


@pytest.mark.asyncio
async def test_band_full_control_plane_focus_critic_cross_session_and_audit(
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
            # 1. Verify Agentic Mesh Discovery Registry
            reg_resp = await client.get("/api/band/registry")
            assert reg_resp.status_code == 200
            registry = reg_resp.json()
            assert {a["handle"] for a in registry} >= {
                "@visual_pixelate",
                "@copy_pixelate",
                "@critic_pixelate",
                "@orchestrator_pixelate",
            }

            # 2. Launch Campaign #1 with Human Approval Gate enabled
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

            for _ in range(50):
                detail = (await client.get(f"/api/campaigns/{campaign_id}")).json()
                if detail["status"] == "awaiting_approval":
                    break
                await asyncio.sleep(0.1)

            assert detail["status"] == "awaiting_approval"
            assert detail["visual_output"] is not None
            assert detail["copy_output"] is None

            # 3. Verify Dual-Scope Policy blocks an Agent from approving its own Human Gate (HTTP 403)
            forged_approve = await client.post(
                f"/api/campaigns/{campaign_id}/band/approve-handoff",
                json={"approver": "@visual_pixelate", "approved": True},
            )
            assert forged_approve.status_code == 403

            # 4. Pin a custom Brand Guardrail and promote it to Cross-Session Brand Memory
            pin_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/memories",
                json={
                    "author": "@human_director",
                    "key": "brand_guardrail",
                    "content": "Emphasize machined titanium acoustics and architectural restraint.",
                    "pinned": True,
                },
            )
            assert pin_resp.status_code == 201
            pinned_id = pin_resp.json()["memory_id"]

            promo_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/memories/promote",
                json={"memory_id": pinned_id, "promoter": "@human_director"},
            )
            assert promo_resp.status_code == 201

            brand_mems = (await client.get("/api/band/brands/KuroAudio/memories")).json()
            assert len(brand_mems) == 1
            assert "machined titanium" in brand_mems[0]["content"]

            # 5. Human Director approves handoff -> @copy_pixelate + automatic @critic_pixelate QA
            approve_resp = await client.post(
                f"/api/campaigns/{campaign_id}/band/approve-handoff",
                json={
                    "approver": "@human_director",
                    "approved": True,
                    "note": "Keep LinkedIn tone architectural and restrained.",
                },
            )
            assert approve_resp.status_code == 200

            for _ in range(50):
                room = (await client.get(f"/api/campaigns/{campaign_id}/band/room")).json()
                if room["status"] == "completed" and room["critic_report"] is not None:
                    break
                await asyncio.sleep(0.1)

            assert room["status"] == "completed"
            assert room["critic_report"] is not None
            assert room["critic_report"]["overall_score"] >= 70
            assert room["critic_report"]["wcag_contrast_ratio"] > 1.0
            assert len(room["executions"]) >= 3
            assert len(room["focus_windows"]) == 3
            assert room["audit_chain_head"]

            # 6. Verify Per-Agent Focus endpoint
            focus_resp = await client.get(
                f"/api/campaigns/{campaign_id}/band/focus/@copy_pixelate"
            )
            assert focus_resp.status_code == 200
            focus = focus_resp.json()
            assert focus["agent_handle"] == "@copy_pixelate"
            assert "visual_brief" in focus["included_memory_keys"]

            # 7. Verify SHA-256 Hash-Chained Audit Ledger integrity
            audit_resp = await client.get(f"/api/campaigns/{campaign_id}/band/audit")
            assert audit_resp.status_code == 200
            chain = audit_resp.json()
            assert len(chain) >= 6
            assert chain[0]["prev_hash"] == "0" * 64
            for i in range(1, len(chain)):
                assert chain[i]["prev_hash"] == chain[i - 1]["entry_hash"]

            # 8. Verify Governance PATCH (Human /me scope) + Agent block (403)
            bad_gov = await client.patch(
                f"/api/campaigns/{campaign_id}/band/governance",
                json={"actor": "@copy_pixelate", "max_agent_hops": 20},
            )
            assert bad_gov.status_code == 403

            good_gov = await client.patch(
                f"/api/campaigns/{campaign_id}/band/governance",
                json={
                    "actor": "@human_director",
                    "max_agent_hops": 8,
                    "mute_handle": "@critic_pixelate",
                    "muted": True,
                },
            )
            assert good_gov.status_code == 200
            gov_room = good_gov.json()
            assert gov_room["loop_guard"]["max_agent_hops"] == 8
            critic_pol = next(
                p for p in gov_room["policies"] if p["handle"] == "@critic_pixelate"
            )
            assert critic_pol["muted"] is True

            # 9. Verify Cross-Session Brand Memory auto-hydration into Campaign #2!
            gen2 = await client.post(
                "/api/campaigns/generate",
                json={
                    "brand_name": "KuroAudio",
                    "product_description": "Desktop Class-A balanced DAC & headphone amplifier.",
                    "target_audience": "Audiophiles and studio engineers",
                    "brand_tone": "Minimalist",
                    "platforms": ["linkedin"],
                    "num_concepts": 1,
                },
            )
            assert gen2.status_code == 202
            cid2 = gen2.json()["campaign_id"]
            room2 = (await client.get(f"/api/campaigns/{cid2}/band/room")).json()
            assert any(
                m["key"] == "cross_session_brand_memory" and "machined titanium" in m["content"]
                for m in room2["memories"]
            )
