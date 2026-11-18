"""Cinematic Motion Graphics MP4 Renderer for Agent Pixelate.

Inspired by motion-design craft principles from:
- `motionmaxxing` (measured easing curves: softLand, snapSettle, whipPush)
- `bang-motion` (one continuous camera world, moving light, zero slide-deck cuts)
- `video-shotcraft` (shot recipe styles & beat-synced sound design)

Streams raw RGB frames directly into `ffmpeg` stdin and muxes a synthesized
beat-synced ambient/pulse audio track into a web-ready H.264 MP4 (`yuv420p`,
`+faststart`) that plays natively in every browser and ad platform.
"""

from __future__ import annotations

import logging
import math
import os
import shutil
import struct
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageFilter, ImageFont

logger = logging.getLogger(__name__)

ShotStyle = Literal[
    "obsidian_cinema",
    "kinetic_type",
    "luxury_editorial",
    "pulse_drop",
]

AspectRatio = Literal["16:9", "9:16"]

SHOT_STYLES: dict[str, dict[str, str]] = {
    "obsidian_cinema": {
        "label": "Obsidian Cinema",
        "curve": "softLand · 65°",
        "description": "Volumetric studio halos, orbital prism & smooth dolly camera",
    },
    "kinetic_type": {
        "label": "Kinetic Type",
        "curve": "snapSettle · 0.045em",
        "description": "Oversized masked headline sweeps on architectural grid lines",
    },
    "luxury_editorial": {
        "label": "Luxury Editorial",
        "curve": "velvetDrift · 120fps",
        "description": "Restrained gallery framing, hairline rules & warm metallic shimmer",
    },
    "pulse_drop": {
        "label": "Pulse Drop",
        "curve": "whipPush · 124 BPM",
        "description": "Beat-synced shockwave rings & dynamic acoustic waveform bars",
    },
}


@dataclass(slots=True)
class VideoRenderSpec:
    brand_name: str
    tagline: str
    hook: str
    description: str
    target_audience: str
    brand_tone: str
    cta_label: str
    platforms: list[str]
    palette: list[str]
    aspect_ratio: AspectRatio = "16:9"
    shot_style: ShotStyle = "obsidian_cinema"
    duration_sec: float = 8.0
    fps: int = 18


# ---------------------------------------------------------------------------
# Measured Easing Curves (inspired by motionmaxxing)
# ---------------------------------------------------------------------------


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def ease_soft_land(t: float) -> float:
    """Decelerated arrival with zero bounce (high-craft editorial settle)."""
    t = _clamp01(t)
    return 1.0 - (1.0 - t) ** 4


def ease_snap_settle(t: float) -> float:
    """Fast kinetic snap with micro-overshoot settle."""
    t = _clamp01(t)
    c1 = 1.15
    c3 = c1 + 1.0
    return 1.0 + c3 * ((t - 1.0) ** 3) + c1 * ((t - 1.0) ** 2)


def ease_whip_push(t: float) -> float:
    """High-energy S-curve camera push."""
    t = _clamp01(t)
    if t < 0.5:
        return 8.0 * (t**4)
    return 1.0 - ((-2.0 * t + 2.0) ** 4) / 2.0


def _hex_to_rgb(hex_color: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    cleaned = hex_color.strip().lstrip("#")
    if len(cleaned) == 3:
        cleaned = "".join(ch * 2 for ch in cleaned)
    if len(cleaned) != 6:
        return fallback
    try:
        return (int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16))
    except ValueError:
        return fallback


def _blend(
    c1: tuple[int, int, int], c2: tuple[int, int, int], alpha: float
) -> tuple[int, int, int]:
    a = _clamp01(alpha)
    return (
        int(c1[0] + (c2[0] - c1[0]) * a),
        int(c1[1] + (c2[1] - c1[1]) * a),
        int(c1[2] + (c2[2] - c1[2]) * a),
    )


def _find_font_path(bold: bool = True, mono: bool = False) -> str | None:
    if mono:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
            "C:/Windows/Fonts/consolab.ttf",
            "C:/Windows/Fonts/consola.ttf",
        ]
    elif bold:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _load_font(
    size: int, bold: bool = True, mono: bool = False
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = _find_font_path(bold=bold, mono=mono)
    if path:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    max_width: int,
    max_lines: int = 3,
) -> list[str]:
    words = text.strip().split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        bbox = draw.textbbox((0, 0), trial, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
            if len(lines) >= max_lines - 1:
                break
    lines.append(current)
    return lines[:max_lines]


# ---------------------------------------------------------------------------
# Pure-Python Beat-Synced Cinematic Sound Design (WAV)
# ---------------------------------------------------------------------------


def _synthesize_soundtrack_wav(
    wav_path: Path, duration_sec: float, shot_style: ShotStyle
) -> None:
    """Synthesize a clean ambient synth + beat-synced transition chime track."""
    sample_rate = 11025
    total_samples = int(duration_sec * sample_rate)

    chords = [
        (130.81, 196.00, 261.63),
        (146.83, 220.00, 293.66),
        (110.00, 164.81, 220.00),
        (130.81, 196.00, 392.00),
    ]
    beat_times = [0.0, duration_sec * 0.26, duration_sec * 0.53, duration_sec * 0.78]
    pulse_hz = 2.0 if shot_style == "pulse_drop" else 1.0
    two_pi = 2.0 * math.pi
    inv_sr = 1.0 / sample_rate

    samples: list[int] = [0] * total_samples
    for i in range(total_samples):
        t = i * inv_sr
        env = 1.0
        if t < 0.3:
            env = t / 0.3
        elif t > duration_sec - 0.6:
            env = max(0.0, (duration_sec - t) / 0.6)

        f0, f1, f2 = chords[min(3, int(t / (duration_sec * 0.25)))]
        pad = (
            math.sin(two_pi * f0 * t) * 0.34
            + math.sin(two_pi * f1 * t) * 0.20
            + math.sin(two_pi * f2 * t) * 0.12
        )
        pulse = 0.74 + 0.26 * math.sin(two_pi * pulse_hz * t)
        val = pad * pulse * 0.45

        for bt in beat_times:
            dt = t - bt
            if 0.0 <= dt < 0.35:
                hit = math.exp(-dt * 11.0)
                val += (
                    math.sin(two_pi * 523.25 * dt) * 0.18
                    + math.sin(two_pi * 78.0 * dt) * 0.22
                ) * hit

        val = max(-0.92, min(0.92, val * env))
        samples[i] = int(val * 32767)

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{total_samples}h", *samples))


# ---------------------------------------------------------------------------
# Continuous-Camera Motion Frame Renderer
# ---------------------------------------------------------------------------


def _make_glow_sprite(
    size: int, color: tuple[int, int, int], alpha: int
) -> Image.Image:
    sprite = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite, "RGBA")
    pad = int(size * 0.24)
    d.ellipse((pad, pad, size - pad, size - pad), fill=(*color, alpha))
    return sprite.filter(ImageFilter.GaussianBlur(radius=size * 0.16))


def _render_frame(
    *,
    t: float,
    duration: float,
    width: int,
    height: int,
    spec: VideoRenderSpec,
    fonts: dict[str, ImageFont.FreeTypeFont | ImageFont.ImageFont],
    base_canvas: Image.Image,
    glow_primary: Image.Image,
    glow_accent: Image.Image,
    bg_rgb: tuple[int, int, int],
    primary_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
    text_rgb: tuple[int, int, int],
) -> bytes:
    """Render one frame of the continuous motion-graphics studio world."""
    is_vertical = height > width
    progress = _clamp01(t / duration)

    img = base_canvas.copy()

    # Continuous camera drift across the shared Obsidian Canvas world
    cam_x = math.sin(progress * math.pi * 2.0) * (width * 0.045)
    cam_y = math.cos(progress * math.pi * 1.5) * (height * 0.03)
    beat_pulse = math.exp(-((t % 1.0) * 4.5))

    # 1. Pre-blurred Volumetric Moving Studio Halos (fast C alpha paste)
    gw1, gh1 = glow_primary.size
    halo1_x = int(width * (0.74 - 0.12 * progress) + cam_x * 1.4 - gw1 / 2)
    halo1_y = int(height * (0.28 + 0.14 * math.sin(progress * math.pi)) + cam_y - gh1 / 2)
    img.paste(glow_primary, (halo1_x, halo1_y), glow_primary)

    gw2, gh2 = glow_accent.size
    halo2_x = int(width * (0.22 + 0.16 * progress) - cam_x - gw2 / 2)
    halo2_y = int(height * (0.78 - 0.12 * progress) - cam_y - gh2 / 2)
    img.paste(glow_accent, (halo2_x, halo2_y), glow_accent)

    overlay = ImageDraw.Draw(img, "RGBA")

    # 2. Studio Architectural Frame & Top Telemetry Bar
    pad = int(min(width, height) * 0.045)
    overlay.rounded_rectangle(
        (pad, pad, width - pad, height - pad),
        radius=20,
        outline=(255, 255, 255, 32),
        width=1,
    )

    top_bar_y = pad + 44
    overlay.line(
        (pad, top_bar_y, width - pad, top_bar_y),
        fill=(255, 255, 255, 22),
        width=1,
    )

    # Top-left live studio dot + Brand Name
    dot_r = 4
    overlay.ellipse(
        (pad + 18 - dot_r, pad + 22 - dot_r, pad + 18 + dot_r, pad + 22 + dot_r),
        fill=(*accent_rgb, 235),
    )
    overlay.text(
        (pad + 32, pad + 14),
        spec.brand_name.upper()[:28],
        font=fonts["mono_sm"],
        fill=(*text_rgb, 225),
    )

    # Top-right shot style + live timecode
    tc_text = f"00:{int(t):02d}:{int((t % 1.0) * spec.fps):02d}  //  {spec.shot_style.upper()}"
    tc_bbox = overlay.textbbox((0, 0), tc_text, font=fonts["mono_xs"])
    overlay.text(
        (width - pad - 18 - (tc_bbox[2] - tc_bbox[0]), pad + 16),
        tc_text,
        font=fonts["mono_xs"],
        fill=(*accent_rgb, 210),
    )

    # 4. Persistent Geometric Monolith / Orbital Sculpture (Morphs smoothly across beats!)
    prism_cx = (width * 0.50) if is_vertical else (width * (0.74 - 0.24 * ease_whip_push((t - 7.5) / 1.5)))
    prism_cy = (height * 0.34) if is_vertical else (height * 0.53)
    prism_scale = 0.85 + 0.22 * math.sin(progress * math.pi) + 0.06 * beat_pulse
    base_r = min(width, height) * (0.21 if not is_vertical else 0.20) * prism_scale
    rot = t * (0.55 if spec.shot_style != "pulse_drop" else 0.95)

    # Outer orbital rings
    for ring_idx, mult in enumerate((1.48, 1.18)):
        rr = base_r * mult
        ring_col = primary_rgb if ring_idx == 0 else accent_rgb
        overlay.ellipse(
            (prism_cx - rr, prism_cy - rr, prism_cx + rr, prism_cy + rr),
            outline=(*ring_col, 70 if ring_idx == 0 else 115),
            width=2 if ring_idx == 1 else 1,
        )

    # Rotating diamond monolith polygon
    pts = []
    for k in range(4):
        ang = rot + k * (math.pi / 2.0)
        rx = prism_cx + math.cos(ang) * base_r
        ry = prism_cy + math.sin(ang) * base_r
        pts.append((rx, ry))
    overlay.polygon(pts, fill=(*primary_rgb, 68), outline=(*accent_rgb, 210))

    inner_pts = []
    for k in range(4):
        ang = -rot * 0.75 + k * (math.pi / 2.0)
        rx = prism_cx + math.cos(ang) * (base_r * 0.58)
        ry = prism_cy + math.sin(ang) * (base_r * 0.58)
        inner_pts.append((rx, ry))
    overlay.polygon(inner_pts, fill=(*bg_rgb, 180), outline=(255, 255, 255, 165))

    # Pulse-drop / studio waveform bars below sculpture
    if spec.shot_style in ("pulse_drop", "obsidian_cinema"):
        num_bars = 14
        bar_w = 5
        bar_gap = 9
        total_w = num_bars * (bar_w + bar_gap)
        start_x = prism_cx - total_w / 2
        base_y = prism_cy + base_r * 1.32
        for b in range(num_bars):
            bh = 8 + 26 * abs(math.sin(t * 4.2 + b * 0.65)) * (0.55 + 0.45 * beat_pulse)
            col = accent_rgb if b % 2 == 0 else primary_rgb
            overlay.rounded_rectangle(
                (start_x + b * (bar_w + bar_gap), base_y - bh, start_x + b * (bar_w + bar_gap) + bar_w, base_y),
                radius=3,
                fill=(*col, 190),
            )

    # 5. Four Seamless Continuous Beats (zero jarring slide cuts)
    text_x = pad + 34
    text_max_w = (width - 2 * pad - 68) if is_vertical else int(width * 0.54)
    text_base_y = int(height * 0.56) if is_vertical else int(height * 0.28)

    # Beat boundaries scaled proportionally to duration (4 continuous beats)
    b1 = duration * 0.26
    b2 = duration * 0.53
    b3 = duration * 0.78

    if t < b1:
        # BEAT 1: Establishing Brand & Hook (snapSettle)
        e = ease_snap_settle(t / (b1 * 0.30))
        fade_out = 1.0 - _clamp01((t - (b1 - 0.35)) / 0.35)
        alpha = int(255 * _clamp01(e) * fade_out)
        y_shift = int((1.0 - e) * 34)

        # Agent pill
        overlay.rounded_rectangle(
            (text_x, text_base_y - 44 + y_shift, text_x + 196, text_base_y - 18 + y_shift),
            radius=13,
            fill=(*primary_rgb, int(55 * fade_out)),
            outline=(*primary_rgb, int(160 * fade_out)),
        )
        overlay.text(
            (text_x + 14, text_base_y - 38 + y_shift),
            f"{spec.brand_tone.upper()} LAUNCH FILM",
            font=fonts["mono_xs"],
            fill=(*text_rgb, alpha),
        )

        lines = _wrap_text(overlay, spec.hook.upper(), fonts["display"], text_max_w, max_lines=3)
        for idx_l, line in enumerate(lines):
            col = text_rgb if idx_l == 0 else accent_rgb
            overlay.text(
                (text_x, text_base_y + idx_l * (48 if not is_vertical else 42) + y_shift),
                line,
                font=fonts["display"],
                fill=(*col, alpha),
            )

        sub_y = text_base_y + len(lines) * (48 if not is_vertical else 42) + 18 + y_shift
        sub_lines = _wrap_text(overlay, f"Introducing {spec.brand_name}.", fonts["body"], text_max_w, max_lines=2)
        for idx_s, sline in enumerate(sub_lines):
            overlay.text(
                (text_x, sub_y + idx_s * 26),
                sline,
                font=fonts["body"],
                fill=(210, 214, 224, int(alpha * 0.85)),
            )

    elif t < b2:
        # BEAT 2: Product Craft & Differentiator (softLand)
        local_t = t - b1
        seg = b2 - b1
        e = ease_soft_land(local_t / (seg * 0.28))
        fade_out = 1.0 - _clamp01((local_t - (seg - 0.35)) / 0.35)
        alpha = int(255 * e * fade_out)
        y_shift = int((1.0 - e) * 28)

        overlay.text(
            (text_x, text_base_y - 34 + y_shift),
            "02 // ENGINEERED DIFFERENCE",
            font=fonts["mono_sm"],
            fill=(*accent_rgb, alpha),
        )
        lines = _wrap_text(overlay, spec.brand_name, fonts["display"], text_max_w, max_lines=2)
        for idx_l, line in enumerate(lines):
            overlay.text(
                (text_x, text_base_y + idx_l * 46 + y_shift),
                line,
                font=fonts["display"],
                fill=(*text_rgb, alpha),
            )
        desc_y = text_base_y + len(lines) * 46 + 16 + y_shift
        desc_lines = _wrap_text(overlay, spec.description[:145], fonts["body"], text_max_w, max_lines=3)
        for idx_d, dline in enumerate(desc_lines):
            overlay.text(
                (text_x, desc_y + idx_d * 26),
                dline,
                font=fonts["body"],
                fill=(205, 210, 222, int(alpha * 0.9)),
            )

    elif t < b3:
        # BEAT 3: Audience + Color System Swatch Strip (whipPush)
        local_t = t - b2
        seg = b3 - b2
        e = ease_soft_land(local_t / (seg * 0.28))
        fade_out = 1.0 - _clamp01((local_t - (seg - 0.35)) / 0.35)
        alpha = int(255 * e * fade_out)
        x_shift = int((1.0 - e) * -36)

        overlay.text(
            (text_x + x_shift, text_base_y - 34),
            "03 // BUILT FOR YOUR WORLD",
            font=fonts["mono_sm"],
            fill=(*primary_rgb, alpha),
        )
        aud_lines = _wrap_text(
            overlay,
            f"Crafted for {spec.target_audience}",
            fonts["subdisplay"],
            text_max_w,
            max_lines=3,
        )
        for idx_a, aline in enumerate(aud_lines):
            overlay.text(
                (text_x + x_shift, text_base_y + idx_a * 38),
                aline,
                font=fonts["subdisplay"],
                fill=(*text_rgb, alpha),
            )

        # Animated palette swatch tokens
        sw_y = text_base_y + len(aud_lines) * 38 + 26
        for idx_c, hx in enumerate(spec.palette[:5]):
            sw_rgb = _hex_to_rgb(hx, primary_rgb)
            sx = text_x + x_shift + idx_c * 46
            overlay.rounded_rectangle(
                (sx, sw_y, sx + 34, sw_y + 34),
                radius=8,
                fill=(*sw_rgb, alpha),
                outline=(255, 255, 255, int(110 * fade_out)),
            )

        plat_str = " · ".join(p.replace("_", " ").upper() for p in spec.platforms)
        overlay.text(
            (text_x + x_shift, sw_y + 48),
            plat_str,
            font=fonts["mono_xs"],
            fill=(*accent_rgb, int(alpha * 0.9)),
        )

    else:
        # BEAT 4: End-Frame Monolith Lockup + Pulsing CTA Pill (softLand)
        local_t = t - b3
        e = ease_soft_land(local_t / 0.7)
        alpha = int(255 * e)
        y_shift = int((1.0 - e) * 24)

        center_x = width // 2
        lock_y = int(height * (0.58 if is_vertical else 0.42)) + y_shift

        b_lines = _wrap_text(overlay, spec.brand_name.upper(), fonts["display"], width - 2 * pad - 60, max_lines=2)
        for idx_b, bline in enumerate(b_lines):
            bb = overlay.textbbox((0, 0), bline, font=fonts["display"])
            bw = bb[2] - bb[0]
            overlay.text(
                (center_x - bw // 2, lock_y + idx_b * 48),
                bline,
                font=fonts["display"],
                fill=(*text_rgb, alpha),
            )

        tag_y = lock_y + len(b_lines) * 48 + 10
        tag_text = spec.tagline[:72]
        tb = overlay.textbbox((0, 0), tag_text, font=fonts["body"])
        overlay.text(
            (center_x - (tb[2] - tb[0]) // 2, tag_y),
            tag_text,
            font=fonts["body"],
            fill=(210, 215, 228, int(alpha * 0.9)),
        )

        # Pulsing CTA Button Pill
        cta_y = tag_y + 44
        cta_txt = f"{spec.cta_label.upper()}  →"
        cb = overlay.textbbox((0, 0), cta_txt, font=fonts["mono_sm"])
        cw = (cb[2] - cb[0]) + 46
        ch = 40
        btn_col = _blend(primary_rgb, accent_rgb, 0.35 + 0.25 * beat_pulse)
        overlay.rounded_rectangle(
            (center_x - cw // 2, cta_y, center_x + cw // 2, cta_y + ch),
            radius=12,
            fill=(*btn_col, alpha),
            outline=(255, 255, 255, int(130 * e)),
        )
        overlay.text(
            (center_x - (cb[2] - cb[0]) // 2, cta_y + 11),
            cta_txt,
            font=fonts["mono_sm"],
            fill=(255, 255, 255, alpha),
        )

    # 6. Bottom Progress Timeline Bar
    bar_y = height - pad - 14
    bar_x0 = pad + 18
    bar_x1 = width - pad - 18
    overlay.rounded_rectangle((bar_x0, bar_y, bar_x1, bar_y + 4), radius=2, fill=(255, 255, 255, 28))
    fill_x1 = bar_x0 + int((bar_x1 - bar_x0) * progress)
    if fill_x1 > bar_x0:
        overlay.rounded_rectangle((bar_x0, bar_y, fill_x1, bar_y + 4), radius=2, fill=(*accent_rgb, 230))

    return img.convert("RGB").tobytes()


def render_campaign_video_mp4(spec: VideoRenderSpec, output_path: Path) -> Path:
    """Render a full H.264 MP4 promo video with synthesized audio to `output_path`."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        raise RuntimeError("ffmpeg binary not found on PATH; cannot encode MP4 video.")

    width, height = (450, 800) if spec.aspect_ratio == "9:16" else (800, 450)
    total_frames = max(24, int(spec.duration_sec * spec.fps))

    palette = spec.palette if len(spec.palette) >= 3 else ["#09090B", "#8B5CF6", "#06B6D4", "#F8FAFC"]
    bg_rgb = _hex_to_rgb(palette[0], (9, 9, 11))
    # Keep studio ground rich dark obsidian
    if sum(bg_rgb) > 120:
        bg_rgb = (9, 9, 12)
    primary_rgb = _hex_to_rgb(palette[1], (139, 92, 246))
    accent_rgb = _hex_to_rgb(palette[2], (6, 182, 212))
    text_rgb = (248, 250, 252)

    if spec.shot_style == "luxury_editorial":
        accent_rgb = (212, 175, 55)

    fonts = {
        "display": _load_font(40 if width > height else 34, bold=True),
        "subdisplay": _load_font(30 if width > height else 26, bold=True),
        "body": _load_font(18 if width > height else 16, bold=False),
        "mono_sm": _load_font(14, bold=True, mono=True),
        "mono_xs": _load_font(12, bold=True, mono=True),
    }

    # Pre-render static Obsidian dot-grid canvas + volumetric glow sprites once
    base_canvas = Image.new("RGBA", (width, height), (*bg_rgb, 255))
    base_draw = ImageDraw.Draw(base_canvas, "RGBA")
    for gx in range(18, width, 36):
        for gy in range(18, height, 36):
            base_draw.rectangle((gx, gy, gx + 1, gy + 1), fill=(255, 255, 255, 22))

    glow_size = int(min(width, height) * 1.15)
    glow_primary = _make_glow_sprite(
        glow_size,
        primary_rgb,
        125 if spec.shot_style != "luxury_editorial" else 90,
    )
    glow_accent = _make_glow_sprite(int(glow_size * 0.9), accent_rgb, 95)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="pixelate_vid_") as tmpdir:
        wav_path = Path(tmpdir) / "soundtrack.wav"
        _synthesize_soundtrack_wav(wav_path, spec.duration_sec, spec.shot_style)

        cmd = [
            ffmpeg_bin,
            "-y",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(spec.fps),
            "-i",
            "-",
            "-i",
            str(wav_path),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "24",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(output_path),
        ]

        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert proc.stdin is not None
        try:
            for frame_idx in range(total_frames):
                t = frame_idx / spec.fps
                raw = _render_frame(
                    t=t,
                    duration=spec.duration_sec,
                    width=width,
                    height=height,
                    spec=spec,
                    fonts=fonts,
                    base_canvas=base_canvas,
                    glow_primary=glow_primary,
                    glow_accent=glow_accent,
                    bg_rgb=bg_rgb,
                    primary_rgb=primary_rgb,
                    accent_rgb=accent_rgb,
                    text_rgb=text_rgb,
                )
                proc.stdin.write(raw)
            proc.stdin.flush()
        finally:
            proc.stdin.close()
            proc.stdin = None

        _, stderr_bytes = proc.communicate(timeout=90)
        if proc.returncode != 0:
            err = stderr_bytes.decode("utf-8", errors="ignore")
            raise RuntimeError(f"ffmpeg video encoding failed: {err}")

    return output_path
