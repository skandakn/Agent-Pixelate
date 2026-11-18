"""End-to-end CLI test runner for Agent Pixelate's Visual & Copy AI Agents.

Usage:
    python -m agents.test_pipeline
    python -m agents.test_pipeline --offline
    python -m agents.test_pipeline --brand "NovaBrew" --save-json campaign_out.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from agents.contracts import (
    USING_SHARED_SCHEMAS,
    AgentEvent,
    CampaignRequest,
    CampaignResponse,
)
from agents.skill_loader import FinchSkillLoader
from agents.worker import run_campaign_pipeline

load_dotenv()


def build_sample_request(brand_name: str = "NovaBrew") -> CampaignRequest:
    """Construct a rich, realistic sample product brief for end-to-end verification."""
    return CampaignRequest(
        brand_name=brand_name,
        product_description=(
            "Zero-sugar sparkling cold brew infused with organic lion's mane mushrooms, "
            "L-theanine, and yuzu peel — engineered for jitter-free late-night creative flow."
        ),
        target_audience="Gen-Z founders, product designers, and late-night builders in urban hubs",
        campaign_goal="Drive launch-day awareness and first-batch direct-to-consumer drop conversions",
        brand_tone="Bold, electric, playful, and high-contrast",
        platforms=["instagram", "linkedin", "x", "web_banner"],
        color_palette=["#4F46E5", "#070B19", "#22D3EE"],
        num_concepts=3,
        additional_notes="Highlight crisp icy condensation, neon studio contrast, and zero-crash clarity.",
    )


async def _run_cli(args: argparse.Namespace) -> int:
    loader = FinchSkillLoader()
    skills = loader.list_skill_ids()

    print("=" * 78, file=sys.stderr)
    print("AGENT PIXELATE — MULTI-AGENT PIPELINE TEST (AdaL/AdalFlow + Finch Skills)", file=sys.stderr)
    print("=" * 78, file=sys.stderr)
    print(f"Schema source : {'/shared/schemas.py' if USING_SHARED_SCHEMAS else 'agents.schemas_fallback (exact mirror)'}", file=sys.stderr)
    print(f"Finch skills  : {', '.join(skills)}", file=sys.stderr)

    req = build_sample_request(brand_name=args.brand)
    llm_provider = "offline" if args.offline else args.llm_provider
    image_provider = "placeholder" if args.offline else args.image_provider

    def _on_event(event: AgentEvent | dict) -> None:
        if args.quiet_events:
            return
        evt = event if isinstance(event, AgentEvent) else AgentEvent.model_validate(event)
        mentions_str = f" -> {', '.join(evt.mentions)}" if evt.mentions else ""
        print(
            f"  [{evt.event_type.value:<18}] {evt.sender}{mentions_str}: {evt.message}",
            file=sys.stderr,
        )

    campaign: CampaignResponse = await run_campaign_pipeline(
        req,
        emit_event=_on_event,
        output_dir=args.output_dir,
        llm_provider=llm_provider,
        image_provider=image_provider,
    )

    # Sanity verification assertions
    assert campaign.visual_output is not None, "VisualOutput must not be None"
    assert campaign.copy_output is not None, "CopyOutput must not be None"
    assert len(campaign.visual_output.color_palette) == 5, "Palette must have exactly 5 hex codes"
    assert len(campaign.visual_output.assets) >= 3, "Visual Agent must produce >= 3 image assets"
    for asset in campaign.visual_output.assets:
        if asset.file_path:
            assert Path(asset.file_path).is_file(), f"Missing generated image file: {asset.file_path}"

    platforms_covered = {p.platform for p in campaign.copy_output.platform_copies}
    for required_channel in ("instagram", "linkedin", "paid_ad"):
        assert required_channel in platforms_covered, f"Missing copy for channel: {required_channel}"

    final_json = json.dumps(campaign.model_dump(mode="json"), indent=2)

    if args.save_json:
        out_path = Path(args.save_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(final_json, encoding="utf-8")
        print(f"\nSaved full campaign JSON to: {out_path.resolve()}", file=sys.stderr)

    print("\n" + "=" * 78, file=sys.stderr)
    print("FINAL CAMPAIGN JSON OUTPUT:", file=sys.stderr)
    print("=" * 78, file=sys.stderr)
    print(final_json)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Agent Pixelate Visual + Copy agents end-to-end and print campaign JSON."
    )
    parser.add_argument("--brand", default="NovaBrew", help="Sample brand name to generate for.")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Force deterministic offline AdaL synthesis + studio placeholder PNGs.",
    )
    parser.add_argument(
        "--llm-provider",
        default=None,
        help="Override LLM provider: auto | gemini | openai | offline",
    )
    parser.add_argument(
        "--image-provider",
        default=None,
        help="Override IMAGE_PROVIDER: auto | gemini | openai | fal | placeholder",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory for generated campaign assets (defaults to CAMPAIGN_DATA_DIR or ./data/campaigns).",
    )
    parser.add_argument(
        "--save-json",
        default=None,
        help="Optional path to save the final campaign JSON.",
    )
    parser.add_argument(
        "--quiet-events",
        action="store_true",
        help="Suppress live event logs on stderr and output only final JSON on stdout.",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run_cli(args)))


if __name__ == "__main__":
    main()
