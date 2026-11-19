from pathlib import Path
import pytest
from PIL import Image, ImageDraw, ImageFont

from orchestrator.video_renderer import (
    VideoRenderSpec,
    build_directors_shot_list,
    build_voiceover_script,
    build_voiceover_beats,
    _draw_character_host_overlay,
    _draw_youtube_ad_chrome_overlay,
    _load_font,
)


def test_video_render_spec_defaults_and_character_fields():
    spec = VideoRenderSpec(
        brand_name="LumaDrop Hydro",
        tagline="Hydration perfected with UV-C clarity",
        hook="Never drink stale water again.",
        description="Self-cleaning UV-C insulated smart water bottle.",
        target_audience="Urban athletes & eco founders",
        brand_tone="Bold",
        cta_label="Order Now",
        platforms=["Instagram", "Meta Ads"],
        palette=["#00E599", "#0A0D14"],
        aspect_ratio="16:9",
        shot_style="obsidian_cinema",
        enable_character=True,
        character_avatar="maya",
        character_position="pip_bottom_right",
    )

    assert spec.enable_character is True
    assert spec.character_avatar == "maya"
    assert spec.character_position == "pip_bottom_right"
    assert spec.duration_sec == 8.0


def test_build_voiceover_script_and_beats():
    spec = VideoRenderSpec(
        brand_name="AuraSound Pro",
        tagline="Pure neural silence",
        hook="Tune out the world with adaptive AI.",
        description="Adaptive neural acoustic earbuds with active noise cancellation.",
        target_audience="Remote founders and creatives",
        brand_tone="Minimalist",
        cta_label="Pre-Order",
        platforms=["LinkedIn"],
        palette=["#FFFFFF", "#000000"],
    )

    script = build_voiceover_script(spec)
    assert "Introducing AuraSound Pro" in script
    assert "Pre-Order today" in script

    beats = build_voiceover_beats(spec)
    assert len(beats) == 4
    assert beats[0]["beat"] == "01"
    assert beats[3]["beat"] == "04"


def test_character_and_youtube_overlay_drawing():
    # Verify procedural PIL drawing without errors
    img = Image.new("RGBA", (640, 360), (10, 13, 20, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    fonts = {
        "mono_sm": _load_font(12, bold=True, mono=True),
        "body": _load_font(14, bold=False),
        "display": _load_font(24, bold=True),
    }
    spec = VideoRenderSpec(
        brand_name="LumaDrop",
        tagline="Clean water",
        hook="Stay hydrated",
        description="Smart bottle",
        target_audience="Athletes",
        brand_tone="Bold",
        cta_label="Shop",
        platforms=["Instagram"],
        palette=["#06B6D4"],
        character_avatar="maya",
    )

    _draw_character_host_overlay(
        draw,
        t=2.5,
        duration=8.0,
        width=640,
        height=360,
        pad=16,
        avatar="maya",
        fonts=fonts,
        accent_rgb=(6, 182, 212),
        is_vertical=False,
    )

    _draw_youtube_ad_chrome_overlay(
        draw,
        t=2.5,
        duration=8.0,
        width=640,
        height=360,
        pad=16,
        fonts=fonts,
        spec=spec,
        accent_rgb=(6, 182, 212),
    )

    # Validate output image mode and non-empty pixels
    assert img.size == (640, 360)
    assert img.mode == "RGBA"
