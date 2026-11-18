"""Automated tests for Agent Pixelate AI Agents, AdaL/AdalFlow Harness, Finch Skills & Band Listener."""

from __future__ import annotations

import json
from pathlib import Path

import adalflow as adal
import pytest
from PIL import Image

from agents.contracts import (
    AgentEvent,
    AgentHandle,
    CampaignRequest,
    CopyOutput,
    EventType,
    VisualOutput,
)
from agents.skill_loader import FinchSkillLoader
from agents.visual_agent import VisualAgent, normalize_five_hex_palette
from agents.worker import (
    BandRoomListener,
    run_campaign_pipeline,
    run_copy_agent,
    run_visual_agent,
)


def _sample_request() -> CampaignRequest:
    return CampaignRequest(
        brand_name="NovaBrew",
        product_description=(
            "Zero-sugar sparkling cold brew infused with lion's mane and yuzu peel "
            "for jitter-free late-night creative focus."
        ),
        target_audience="Gen-Z founders and product designers in urban hubs",
        campaign_goal="Drive launch-day awareness and DTC drop conversions",
        brand_tone="Bold, electric, and high-contrast",
        platforms=["instagram", "linkedin", "x", "web_banner"],
        color_palette=["#4F46E5", "#070B19", "#22D3EE"],
        num_concepts=3,
    )


def test_finch_skill_loader_parses_all_three_skills() -> None:
    loader = FinchSkillLoader()
    ids = loader.list_skill_ids()
    assert set(ids) == {
        "brand_visual_direction",
        "ad_copy_conversion",
        "social_platform_formatter",
    }

    catalog = loader.list_catalog()
    assert len(catalog) == 3
    for card in catalog:
        assert card["provider"] == "finchtech.ai"
        assert "adal-agent-harness" in card["compatibility"]

    tool_fn = loader.as_adal_tool_fn()
    rendered = tool_fn("brand_visual_direction")
    assert "FINCH SKILL LOADED" in rendered
    assert "5-Hex Palette" in rendered


def test_palette_normalizer_preserves_role_slots() -> None:
    palette = normalize_five_hex_palette(["#4F46E5", "#070B19", "#22D3EE"], "Bold, electric")
    assert len(palette) == 5
    assert palette[:3] == ["#4F46E5", "#070B19", "#22D3EE"]
    assert palette[4] == "#F8FAFC"


def test_visual_agent_uses_adalflow_component_and_tools() -> None:
    agent = VisualAgent(llm_provider="offline")
    assert isinstance(agent.harness, adal.Component)
    tool_names = {t.definition.func_name for t in agent.harness.function_tools}
    assert {"load_finch_skill", "normalize_five_hex_palette", "inspect_platform_aspect_specs"} <= tool_names


@pytest.mark.asyncio
async def test_full_visual_to_copy_pipeline(tmp_path: Path) -> None:
    req = _sample_request()
    events: list[AgentEvent] = []

    async def on_event(evt: AgentEvent | dict) -> None:
        events.append(evt if isinstance(evt, AgentEvent) else AgentEvent.model_validate(evt))

    visual_out = await run_visual_agent(
        req,
        emit_event=on_event,
        campaign_id="camp_test_001",
        output_dir=tmp_path,
        llm_provider="offline",
        image_provider="placeholder",
    )
    assert isinstance(visual_out, VisualOutput)
    assert len(visual_out.color_palette) == 5
    assert len(visual_out.assets) == 3
    assert visual_out.band_memory_id is not None

    # Verify generated PNG dimensions match exact aspect slots
    dims = {}
    for asset in visual_out.assets:
        assert asset.file_path is not None
        p = Path(asset.file_path)
        assert p.is_file()
        with Image.open(p) as im:
            dims[asset.aspect_ratio] = im.size
    assert dims == {"16:9": (1600, 900), "1:1": (1080, 1080), "9:16": (1080, 1920)}

    # Verify 3-scene storyboard artifact with camera motion cues
    storyboard_file = tmp_path / "camp_test_001" / "assets" / "video_storyboard.json"
    assert storyboard_file.is_file()
    storyboard = json.loads(storyboard_file.read_text(encoding="utf-8"))
    assert len(storyboard["scenes"]) == 3
    for scene in storyboard["scenes"]:
        assert scene["camera_motion"]
        assert scene["lighting_cue"]

    # Verify BAND handoff mention to @copy_pixelate was emitted
    mentions = [e for e in events if e.event_type == EventType.AGENT_MENTION]
    assert any(AgentHandle.COPY.value in m.mentions for m in mentions)

    # Run Copy Agent with VisualOutput handoff
    copy_out = await run_copy_agent(
        req,
        visual_out,
        emit_event=on_event,
        output_dir=tmp_path,
        llm_provider="offline",
    )
    assert isinstance(copy_out, CopyOutput)
    assert visual_out.band_memory_id in copy_out.band_memory_refs
    channels = {pc.platform: pc for pc in copy_out.platform_copies}
    assert {"instagram", "linkedin", "paid_ad", "x", "web_banner"} <= set(channels)
    for pc in copy_out.platform_copies:
        assert pc.linked_asset_id is not None
        assert len(pc.headline) > 0
        assert len(pc.call_to_action) > 0

    # Verify persistent AdaL session memory recorded both agents
    session_file = tmp_path / "camp_test_001" / "camp_test_001_adal_session.json"
    assert session_file.is_file()
    session_data = json.loads(session_file.read_text(encoding="utf-8"))
    assert set(session_data["loaded_skills"]) == {
        "brand_visual_direction",
        "ad_copy_conversion",
        "social_platform_formatter",
    }


@pytest.mark.asyncio
async def test_band_room_listener_local_handoff(tmp_path: Path) -> None:
    req = _sample_request()
    listener = BandRoomListener(
        band_api_key="",
        output_dir=tmp_path,
        llm_provider="offline",
        image_provider="placeholder",
    )
    try:
        result = await listener.dispatch_room_message(
            campaign_id="camp_band_001",
            room_id="room_band_001",
            sender=AgentHandle.ORCHESTRATOR.value,
            message=f"{AgentHandle.VISUAL.value} Please build the launch visuals for NovaBrew.",
            request=req,
        )
        assert isinstance(result, VisualOutput)
        # Local listener automatically chained @copy_pixelate handoff
        assert "camp_band_001" in listener._copy_outputs
        assert isinstance(listener._copy_outputs["camp_band_001"], CopyOutput)
    finally:
        await listener.close()


@pytest.mark.asyncio
async def test_run_campaign_pipeline_convenience(tmp_path: Path) -> None:
    resp = await run_campaign_pipeline(
        _sample_request(),
        output_dir=tmp_path,
        llm_provider="offline",
        image_provider="placeholder",
    )
    assert resp.status.value == "completed"
    assert resp.visual_output is not None
    assert resp.copy_output is not None
    assert len(resp.events) >= 8
