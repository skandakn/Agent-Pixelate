"""Ultra-Fast Cinematic Motion Graphics MP4 Renderer for Agent Pixelate.

Inspired by motion-design craft principles from:
- `motionmaxxing` (measured easing curves: softLand, snapSettle, whipPush)
- `bang-motion` (one continuous camera world, moving light, zero slide-deck cuts)
- `video-shotcraft` (shot recipe styles & beat-synced sound design)

Pre-bakes volumetric Obsidian Canvas lighting once into a crisp RGB studio base
and streams raw RGB frames directly into `ffmpeg` stdin with a pure-Python
beat-synced soundtrack for sub-2s local / ~3s cloud H.264 MP4 rendering.
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
        "curve": "snapSettle · -0.045em",
        "description": "Oversized masked headline sweeps on architectural grid lines",
    },
    "luxury_editorial": {
        "label": "Luxury Editorial",
        "curve": "velvetDrift · 15fps",
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
    duration_sec: float = 6.0
    fps: int = 15


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def ease_soft_land(t: float) -> float:
    t = _clamp01(t)
    return 1.0 - (1.0 - t) ** 4


def ease_snap_settle(t: float) -> float:
    t = _clamp01(t)
    c1 = 1.15
    c3 = c1 + 1.0
    return 1.0 + c3 * ((t - 1.0) ** 3) + c1 * ((t - 1.0) ** 2)


def ease_whip_push(t: float) -> float:
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


def _synthesize_soundtrack_wav(
    wav_path: Path, duration_sec: float, shot_style: ShotStyle
) -> None:
    """Fast pure-Python ambient synth + beat-synced transition chime track."""
    sample_rate = 8000
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
        if t < 0.25:
            env = t / 0.25
        elif t > duration_sec - 0.5:
            env = max(0.0, (duration_sec - t) / 0.5)

        f0, f1, f2 = chords[min(3, int(t / (duration_sec * 0.25)))]
        pad = (
            math.sin(two_pi * f0 * t) * 0.34
            + math.sin(two_pi * f1 * t) * 0.20
            + math.sin(two_pi * f2 * t) * 0.12
        )
        pulse = 0.75 + 0.25 * math.sin(two_pi * pulse_hz * t)
        val = pad * pulse * 0.45

        for bt in beat_times:
            dt = t - bt
            if 0.0 <= dt < 0.30:
                hit = math.exp(-dt * 12.0)
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


def _build_studio_backdrop(
    width: int,
    height: int,
    bg_rgb: tuple[int, int, int],
    primary_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
    shot_style: ShotStyle,
    brand_name: str,
    mono_sm: ImageFont.FreeTypeFont | ImageFont.ImageFont,
) -> Image.Image:
    """Pre-render the Obsidian studio canvas with volumetric Gaussian halos ONCE."""
    canvas = Image.new("RGBA", (width, height), (*bg_rgb, 255))

    # Volumetric halos rendered once at high quality
    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer, "RGBA")
    r1 = int(min(width, height) * 0.48)
    cx1, cy1 = int(width * 0.74), int(height * 0.32)
    gd.ellipse(
        (cx1 - r1, cy1 - r1, cx1 + r1, cy1 + r1),
        fill=(*primary_rgb, 115 if shot_style != "luxury_editorial" else 85),
    )
    r2 = int(min(width, height) * 0.42)
    cx2, cy2 = int(width * 0.22), int(height * 0.78)
    gd.ellipse(
        (cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2),
        fill=(*accent_rgb, 90),
    )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(min(width, height) * 0.16)))
    canvas.alpha_composite(glow_layer)

    d = ImageDraw.Draw(canvas, "RGBA")
    for gx in range(16, width, 32):
        for gy in range(16, height, 32):
            d.rectangle((gx, gy, gx + 1, gy + 1), fill=(255, 255, 255, 22))

    pad = int(min(width, height) * 0.045)
    d.rounded_rectangle(
        (pad, pad, width - pad, height - pad),
        radius=16,
        outline=(255, 255, 255, 34),
        width=1,
    )
    top_bar_y = pad + 36
    d.line((pad, top_bar_y, width - pad, top_bar_y), fill=(255, 255, 255, 22), width=1)
    d.ellipse((pad + 12, pad + 14, pad + 20, pad + 22), fill=(*accent_rgb, 235))
    d.text((pad + 28, pad + 11), brand_name.upper()[:26], font=mono_sm, fill=(244, 244, 248, 225))

    return canvas.convert("RGB")


def _render_frame(
    *,
    t: float,
    duration: float,
    width: int,
    height: int,
    spec: VideoRenderSpec,
    fonts: dict[str, ImageFont.FreeTypeFont | ImageFont.ImageFont],
    base_rgb: Image.Image,
    bg_rgb: tuple[int, int, int],
    primary_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
    text_rgb: tuple[int, int, int],
    prewrapped: dict[str, list[str]],
) -> bytes:
    """Fast RGB-mode frame renderer (~3ms/frame) with smooth continuous motion."""
    is_vertical = height > width
    progress = _clamp01(t / duration)
    pad = int(min(width, height) * 0.045)
    beat_pulse = math.exp(-((t % 1.0) * 4.5))

    img = base_rgb.copy()
    draw = ImageDraw.Draw(img)

    # Top-right live timecode
    tc_text = f"00:{int(t):02d}:{int((t % 1.0) * spec.fps):02d} // {spec.shot_style.upper()}"
    tc_bbox = draw.textbbox((0, 0), tc_text, font=fonts["mono_xs"])
    draw.text(
        (width - pad - 14 - (tc_bbox[2] - tc_bbox[0]), pad + 12),
        tc_text,
        font=fonts["mono_xs"],
        fill=accent_rgb,
    )

    # Persistent rotating monolith prism sculpture
    b1 = duration * 0.26
    b2 = duration * 0.53
    b3 = duration * 0.78

    prism_cx = (
        (width * 0.50)
        if is_vertical
        else (width * (0.74 - 0.24 * ease_whip_push((t - b3) / 1.1)))
    )
    prism_cy = (height * 0.34) if is_vertical else (height * 0.53)
    prism_scale = 0.86 + 0.18 * math.sin(progress * math.pi) + 0.05 * beat_pulse
    base_r = min(width, height) * (0.20 if not is_vertical else 0.19) * prism_scale
    rot = t * (0.65 if spec.shot_style != "pulse_drop" else 1.1)

    ring_outer = _blend(bg_rgb, primary_rgb, 0.45)
    ring_inner = _blend(bg_rgb, accent_rgb, 0.75)
    for mult, col, lw in ((1.44, ring_outer, 1), (1.16, ring_inner, 2)):
        rr = base_r * mult
        draw.ellipse((prism_cx - rr, prism_cy - rr, prism_cx + rr, prism_cy + rr), outline=col, width=lw)

    pts = [
        (prism_cx + math.cos(rot + k * 1.5708) * base_r, prism_cy + math.sin(rot + k * 1.5708) * base_r)
        for k in range(4)
    ]
    draw.polygon(pts, fill=_blend(bg_rgb, primary_rgb, 0.35), outline=accent_rgb)

    inner_pts = [
        (
            prism_cx + math.cos(-rot * 0.75 + k * 1.5708) * (base_r * 0.56),
            prism_cy + math.sin(-rot * 0.75 + k * 1.5708) * (base_r * 0.56),
        )
        for k in range(4)
    ]
    draw.polygon(inner_pts, fill=_blend(bg_rgb, (20, 20, 30), 0.7), outline=(210, 215, 230))

    # Beat-synced audio bars
    if spec.shot_style in ("pulse_drop", "obsidian_cinema"):
        num_bars = 12
        bar_w = 4
        bar_gap = 7
        total_w = num_bars * (bar_w + bar_gap)
        start_x = prism_cx - total_w / 2
        base_y = prism_cy + base_r * 1.32
        for b in range(num_bars):
            bh = 6 + 20 * abs(math.sin(t * 4.5 + b * 0.65)) * (0.55 + 0.45 * beat_pulse)
            col = accent_rgb if b % 2 == 0 else primary_rgb
            draw.rounded_rectangle(
                (start_x + b * (bar_w + bar_gap), base_y - bh, start_x + b * (bar_w + bar_gap) + bar_w, base_y),
                radius=2,
                fill=col,
            )

    text_x = pad + 26
    text_base_y = int(height * 0.56) if is_vertical else int(height * 0.28)
    line_h = 38 if not is_vertical else 34

    if t < b1:
        e = ease_snap_settle(t / (b1 * 0.32))
        fade = _clamp01(e) * (1.0 - _clamp01((t - (b1 - 0.28)) / 0.28))
        y_shift = int((1.0 - e) * 26)
        pill_col = _blend(bg_rgb, primary_rgb, 0.28 * fade)
        draw.rounded_rectangle(
            (text_x, text_base_y - 34 + y_shift, text_x + 168, text_base_y - 12 + y_shift),
            radius=11,
            fill=pill_col,
            outline=_blend(bg_rgb, primary_rgb, 0.8 * fade),
        )
        draw.text(
            (text_x + 12, text_base_y - 29 + y_shift),
            f"{spec.brand_tone.upper()} LAUNCH FILM",
            font=fonts["mono_xs"],
            fill=_blend(bg_rgb, text_rgb, fade),
        )
        for idx_l, line in enumerate(prewrapped["hook"]):
            col = text_rgb if idx_l == 0 else accent_rgb
            draw.text(
                (text_x, text_base_y + idx_l * line_h + y_shift),
                line,
                font=fonts["display"],
                fill=_blend(bg_rgb, col, fade),
            )
        sub_y = text_base_y + len(prewrapped["hook"]) * line_h + 12 + y_shift
        for idx_s, sline in enumerate(prewrapped["intro"]):
            draw.text(
                (text_x, sub_y + idx_s * 22),
                sline,
                font=fonts["body"],
                fill=_blend(bg_rgb, (210, 214, 224), fade * 0.85),
            )

    elif t < b2:
        local_t = t - b1
        seg = b2 - b1
        e = ease_soft_land(local_t / (seg * 0.30))
        fade = e * (1.0 - _clamp01((local_t - (seg - 0.28)) / 0.28))
        y_shift = int((1.0 - e) * 22)

        draw.text(
            (text_x, text_base_y - 26 + y_shift),
            "02 // ENGINEERED DIFFERENCE",
            font=fonts["mono_sm"],
            fill=_blend(bg_rgb, accent_rgb, fade),
        )
        for idx_l, line in enumerate(prewrapped["brand"]):
            draw.text(
                (text_x, text_base_y + idx_l * line_h + y_shift),
                line,
                font=fonts["display"],
                fill=_blend(bg_rgb, text_rgb, fade),
            )
        desc_y = text_base_y + len(prewrapped["brand"]) * line_h + 12 + y_shift
        for idx_d, dline in enumerate(prewrapped["desc"]):
            draw.text(
                (text_x, desc_y + idx_d * 22),
                dline,
                font=fonts["body"],
                fill=_blend(bg_rgb, (205, 210, 222), fade * 0.9),
            )

    elif t < b3:
        local_t = t - b2
        seg = b3 - b2
        e = ease_soft_land(local_t / (seg * 0.30))
        fade = e * (1.0 - _clamp01((local_t - (seg - 0.28)) / 0.28))
        x_shift = int((1.0 - e) * -28)

        draw.text(
            (text_x + x_shift, text_base_y - 26),
            "03 // BUILT FOR YOUR WORLD",
            font=fonts["mono_sm"],
            fill=_blend(bg_rgb, primary_rgb, fade),
        )
        for idx_a, aline in enumerate(prewrapped["audience"]):
            draw.text(
                (text_x + x_shift, text_base_y + idx_a * 30),
                aline,
                font=fonts["subdisplay"],
                fill=_blend(bg_rgb, text_rgb, fade),
            )

        sw_y = text_base_y + len(prewrapped["audience"]) * 30 + 20
        for idx_c, hx in enumerate(spec.palette[:5]):
            sw_rgb = _hex_to_rgb(hx, primary_rgb)
            sx = text_x + x_shift + idx_c * 38
            draw.rounded_rectangle(
                (sx, sw_y, sx + 28, sw_y + 28),
                radius=6,
                fill=_blend(bg_rgb, sw_rgb, fade),
                outline=_blend(bg_rgb, (255, 255, 255), 0.45 * fade),
            )

        plat_str = " · ".join(p.replace("_", " ").upper() for p in spec.platforms)
        draw.text(
            (text_x + x_shift, sw_y + 38),
            plat_str,
            font=fonts["mono_xs"],
            fill=_blend(bg_rgb, accent_rgb, fade * 0.9),
        )

    else:
        local_t = t - b3
        e = ease_soft_land(local_t / 0.55)
        y_shift = int((1.0 - e) * 18)

        center_x = width // 2
        lock_y = int(height * (0.58 if is_vertical else 0.40)) + y_shift
        for idx_b, bline in enumerate(prewrapped["brand_center"]):
            bb = draw.textbbox((0, 0), bline, font=fonts["display"])
            draw.text(
                (center_x - (bb[2] - bb[0]) // 2, lock_y + idx_b * line_h),
                bline,
                font=fonts["display"],
                fill=_blend(bg_rgb, text_rgb, e),
            )

        tag_y = lock_y + len(prewrapped["brand_center"]) * line_h + 8
        tag_text = spec.tagline[:62]
        tb = draw.textbbox((0, 0), tag_text, font=fonts["body"])
        draw.text(
            (center_x - (tb[2] - tb[0]) // 2, tag_y),
            tag_text,
            font=fonts["body"],
            fill=_blend(bg_rgb, (210, 215, 228), e * 0.9),
        )

        cta_y = tag_y + 34
        cta_txt = f"{spec.cta_label.upper()}  →"
        cb = draw.textbbox((0, 0), cta_txt, font=fonts["mono_sm"])
        cw = (cb[2] - cb[0]) + 36
        ch = 34
        btn_col = _blend(bg_rgb, _blend(primary_rgb, accent_rgb, 0.35 + 0.25 * beat_pulse), e)
        draw.rounded_rectangle(
            (center_x - cw // 2, cta_y, center_x + cw // 2, cta_y + ch),
            radius=10,
            fill=btn_col,
            outline=_blend(bg_rgb, (255, 255, 255), 0.5 * e),
        )
        draw.text(
            (center_x - (cb[2] - cb[0]) // 2, cta_y + 9),
            cta_txt,
            font=fonts["mono_sm"],
            fill=_blend(bg_rgb, (255, 255, 255), e),
        )

    # Bottom progress timeline bar
    bar_y = height - pad - 12
    bar_x0 = pad + 14
    bar_x1 = width - pad - 14
    draw.rounded_rectangle((bar_x0, bar_y, bar_x1, bar_y + 3), radius=2, fill=(45, 45, 58))
    fill_x1 = bar_x0 + int((bar_x1 - bar_x0) * progress)
    if fill_x1 > bar_x0:
        draw.rounded_rectangle((bar_x0, bar_y, fill_x1, bar_y + 3), radius=2, fill=accent_rgb)

    return img.tobytes()


def render_campaign_video_mp4(spec: VideoRenderSpec, output_path: Path) -> Path:
    """Render a full H.264 MP4 promo video with synthesized audio to `output_path`."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        raise RuntimeError("ffmpeg binary not found on PATH; cannot encode MP4 video.")

    width, height = (360, 640) if spec.aspect_ratio == "9:16" else (640, 360)
    total_frames = max(24, int(spec.duration_sec * spec.fps))

    palette = spec.palette if len(spec.palette) >= 3 else ["#09090B", "#8B5CF6", "#06B6D4", "#F8FAFC"]
    bg_rgb = _hex_to_rgb(palette[0], (9, 9, 11))
    if sum(bg_rgb) > 120:
        bg_rgb = (9, 9, 12)
    primary_rgb = _hex_to_rgb(palette[1], (139, 92, 246))
    accent_rgb = _hex_to_rgb(palette[2], (6, 182, 212))
    text_rgb = (248, 250, 252)

    if spec.shot_style == "luxury_editorial":
        accent_rgb = (212, 175, 55)

    fonts = {
        "display": _load_font(30 if width > height else 26, bold=True),
        "subdisplay": _load_font(22 if width > height else 20, bold=True),
        "body": _load_font(14 if width > height else 13, bold=False),
        "mono_sm": _load_font(12, bold=True, mono=True),
        "mono_xs": _load_font(10, bold=True, mono=True),
    }

    base_rgb = _build_studio_backdrop(
        width=width,
        height=height,
        bg_rgb=bg_rgb,
        primary_rgb=primary_rgb,
        accent_rgb=accent_rgb,
        shot_style=spec.shot_style,
        brand_name=spec.brand_name,
        mono_sm=fonts["mono_sm"],
    )

    # Pre-wrap all text once before the frame loop
    pad = int(min(width, height) * 0.045)
    is_vertical = height > width
    text_max_w = (width - 2 * pad - 52) if is_vertical else int(width * 0.54)
    measure_draw = ImageDraw.Draw(base_rgb)
    prewrapped = {
        "hook": _wrap_text(measure_draw, spec.hook.upper(), fonts["display"], text_max_w, max_lines=3),
        "intro": _wrap_text(measure_draw, f"Introducing {spec.brand_name}.", fonts["body"], text_max_w, max_lines=2),
        "brand": _wrap_text(measure_draw, spec.brand_name, fonts["display"], text_max_w, max_lines=2),
        "desc": _wrap_text(measure_draw, spec.description[:130], fonts["body"], text_max_w, max_lines=3),
        "audience": _wrap_text(measure_draw, f"Crafted for {spec.target_audience}", fonts["subdisplay"], text_max_w, max_lines=3),
        "brand_center": _wrap_text(measure_draw, spec.brand_name.upper(), fonts["display"], width - 2 * pad - 48, max_lines=2),
    }

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
            "-tune",
            "fastdecode",
            "-threads",
            "2",
            "-crf",
            "25",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
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
                    base_rgb=base_rgb,
                    bg_rgb=bg_rgb,
                    primary_rgb=primary_rgb,
                    accent_rgb=accent_rgb,
                    text_rgb=text_rgb,
                    prewrapped=prewrapped,
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
