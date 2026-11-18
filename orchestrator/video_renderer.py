"""Cinematic Motion Graphics MP4 Renderer for Agent Pixelate.

Synthesizes motion-design & AI filmmaking craft distilled from:
- `motionmaxxing` (measured easing curves, masked baseline reveals, anti-slop film grain)
- `bang-motion` (one continuous camera world, moving volumetric light, zero slide-deck cuts)
- `video-shotcraft` (shot recipe cards including Ink Press, beat-synced risers & impacts)
- `vox-director` (Vox paper-collage editorial cutout style, archival paper + halftone + highlighter)
- `visual-skills` & `narrative-film-direction` (4-beat cinematic dramaturgy & Ken Burns hero framing)
- `video-production-skills` / `hyperframes` (seek-safe deterministic timeline + layered audio mix)

Streams raw RGB frames at 24fps directly into `ffmpeg` stdin and muxes a stereo
22.05kHz beat-synced cinematic soundtrack (risers, sub-bass impacts, style percussion,
and harmonic pads) into a web-ready H.264 MP4 (`yuv420p`, `+faststart`).
"""

from __future__ import annotations

import logging
import math
import os
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

logger = logging.getLogger(__name__)

ShotStyle = Literal[
    "obsidian_cinema",
    "kinetic_type",
    "luxury_editorial",
    "pulse_drop",
    "vox_collage",
    "ink_press",
]

AspectRatio = Literal["16:9", "9:16"]

SHOT_STYLES: dict[str, dict[str, str]] = {
    "obsidian_cinema": {
        "label": "Obsidian Cinema",
        "curve": "softLand · 24fps",
        "source": "bang-motion",
        "description": "Volumetric studio halos, Ken Burns hero viewport & continuous dolly camera",
    },
    "kinetic_type": {
        "label": "Kinetic Type",
        "curve": "snapSettle · -0.045em",
        "source": "motionmaxxing",
        "description": "Masked baseline headline wipes, architectural guides & calibrated overshoot",
    },
    "luxury_editorial": {
        "label": "Luxury Editorial",
        "curve": "velvetDrift · 24fps",
        "source": "lemo-opuscar",
        "description": "Gallery framing, warm gold hairline rules, soft vignette & restrained drift",
    },
    "pulse_drop": {
        "label": "Pulse Drop",
        "curve": "whipPush · 124 BPM",
        "source": "video-shotcraft",
        "description": "Beat-synced shockwave rings, dynamic acoustic bars & rhythmic hi-hat groove",
    },
    "vox_collage": {
        "label": "Vox Collage",
        "curve": "snapSettle · Halftone",
        "source": "vox-director",
        "description": "Archival paper ground, torn cutout hero card, halftone dots & highlighter sweep",
    },
    "ink_press": {
        "label": "Ink Press",
        "curve": "pressStamp · Swiss Grid",
        "source": "video-shotcraft",
        "description": "High-contrast Swiss print editorial, registration marks & tactile stamp hits",
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
    fps: int = 24
    hero_image_paths: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Measured Easing Curves (inspired by motionmaxxing & hyperframes-animation)
# ---------------------------------------------------------------------------


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def ease_soft_land(t: float) -> float:
    """Decelerated arrival with zero bounce (high-craft editorial settle)."""
    t = _clamp01(t)
    return 1.0 - (1.0 - t) ** 4


def ease_snap_settle(t: float) -> float:
    """Fast kinetic snap with calibrated micro-overshoot settle."""
    t = _clamp01(t)
    c1 = 1.15
    c3 = c1 + 1.0
    return 1.0 + c3 * ((t - 1.0) ** 3) + c1 * ((t - 1.0) ** 2)


def ease_whip_push(t: float) -> float:
    """High-energy quartic S-curve camera push."""
    t = _clamp01(t)
    if t < 0.5:
        return 8.0 * (t**4)
    return 1.0 - ((-2.0 * t + 2.0) ** 4) / 2.0


def ease_velvet_drift(t: float) -> float:
    """Quintic ultra-smooth luxury gallery glide."""
    t = _clamp01(t)
    return 1.0 - (1.0 - t) ** 5


def ease_press_stamp(t: float) -> float:
    """Tactile letterpress slam with instantaneous hold."""
    t = _clamp01(t)
    if t < 0.35:
        return (t / 0.35) ** 3
    return 1.0 + math.sin((t - 0.35) * math.pi * 2.5) * 0.03 * (1.0 - t)


def build_directors_shot_list(spec: VideoRenderSpec) -> list[dict[str, str]]:
    """Generate a 4-beat dramaturgy shot list (visual-skills / narrative-film-direction)."""
    style_meta = SHOT_STYLES.get(spec.shot_style, SHOT_STYLES["obsidian_cinema"])
    b1 = round(spec.duration_sec * 0.25, 1)
    b2 = round(spec.duration_sec * 0.53, 1)
    b3 = round(spec.duration_sec * 0.78, 1)
    end = round(spec.duration_sec, 1)
    return [
        {
            "beat": "01",
            "window": f"0.0s–{b1}s",
            "name": "Pattern-Interrupt Hook",
            "camera": f"Masked baseline wipe · {style_meta['curve']}",
            "copy": spec.hook[:80],
        },
        {
            "beat": "02",
            "window": f"{b1}s–{b2}s",
            "name": "Visual Proof & Ken Burns Reveal",
            "camera": "Continuous dolly-in 1.00x→1.14x on generated hero visual",
            "copy": spec.description[:90],
        },
        {
            "beat": "03",
            "window": f"{b2}s–{b3}s",
            "name": "Audience & Brand Color World",
            "camera": "Parallax lateral sweep + live brand token swatch rail",
            "copy": f"Built for {spec.target_audience[:70]}",
        },
        {
            "beat": "04",
            "window": f"{b3}s–{end}s",
            "name": "Conversion Monolith Lockup",
            "camera": "Center settle + beat-synced pulsing CTA button",
            "copy": f"{spec.brand_name} — {spec.cta_label}",
        },
    ]


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


def _draw_masked_text_lines(
    canvas: Image.Image,
    *,
    x: int,
    y: int,
    lines: list[str],
    line_height: int,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    colors: list[tuple[int, int, int]],
    reveal: float,
    alpha: int,
    highlight_bg: tuple[int, int, int] | None = None,
) -> None:
    """MotionMaxx masked baseline reveal: lines rise cleanly out of a hidden clip box."""
    if alpha <= 2 or not lines:
        return
    r = _clamp01(reveal)
    # Render each line inside its own tightly clipped RGBA strip so text emerges from baseline
    for idx, line in enumerate(lines):
        line_r = _clamp01((r - idx * 0.12) / max(0.25, 1.0 - idx * 0.12))
        if line_r <= 0.01:
            continue
        col = colors[min(idx, len(colors) - 1)]
        strip_h = line_height + 10
        strip_w = max(60, canvas.width - x - 20)
        strip = Image.new("RGBA", (strip_w, strip_h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(strip, "RGBA")
        y_off = int((1.0 - line_r) * (line_height * 0.88))

        if highlight_bg is not None:
            bbox = sd.textbbox((0, 0), line, font=font)
            tw = int((bbox[2] - bbox[0] + 18) * line_r)
            if tw > 4:
                sd.rounded_rectangle(
                    (0, y_off + 2, min(strip_w, tw), min(strip_h, y_off + line_height + 2)),
                    radius=4,
                    fill=(*highlight_bg, int(alpha * 0.92)),
                )

        sd.text((6 if highlight_bg else 0, y_off), line, font=font, fill=(*col, alpha))
        canvas.paste(strip, (x, y + idx * line_height), strip)


# ---------------------------------------------------------------------------
# Layered Stereo Cinema Sound Design (WAV · 22.05kHz Stereo)
# Inspired by `video-shotcraft` sound-design & `hyperframes-audio`
# ---------------------------------------------------------------------------


def _synthesize_soundtrack_wav(
    wav_path: Path, duration_sec: float, shot_style: ShotStyle
) -> None:
    """Synthesize a stereo layered cinema score with risers, sub-bass hits, & style percussion."""
    sample_rate = 22050
    total_samples = int(duration_sec * sample_rate)

    # Harmonic progression per style
    if shot_style in ("vox_collage", "ink_press"):
        chords = [
            (196.00, 246.94, 293.66),  # G major editorial lift
            (164.81, 246.94, 329.63),  # E minor curiosity
            (130.81, 196.00, 261.63),  # C major resolution
            (146.83, 220.00, 293.66),  # D major push
        ]
    elif shot_style == "luxury_editorial":
        chords = [
            (110.00, 164.81, 246.94),  # Am9 warm velvet
            (130.81, 196.00, 293.66),  # Cadd9
            (146.83, 220.00, 329.63),  # Dm9
            (110.00, 164.81, 329.63),  # A5 resolve
        ]
    else:
        chords = [
            (130.81, 196.00, 261.63),
            (146.83, 220.00, 293.66),
            (110.00, 164.81, 220.00),
            (130.81, 196.00, 392.00),
        ]

    beat_times = [0.0, duration_sec * 0.25, duration_sec * 0.53, duration_sec * 0.78]
    bpm = 124.0 if shot_style == "pulse_drop" else (108.0 if shot_style in ("vox_collage", "ink_press") else 92.0)
    beat_period = 60.0 / bpm
    two_pi = 2.0 * math.pi
    inv_sr = 1.0 / sample_rate

    rng = random.Random(42)
    frames = bytearray(total_samples * 4)  # stereo 16-bit PCM

    for i in range(total_samples):
        t = i * inv_sr
        # Global fade-in / fade-out envelope
        env = 1.0
        if t < 0.22:
            env = t / 0.22
        elif t > duration_sec - 0.55:
            env = max(0.0, (duration_sec - t) / 0.55)

        seg_idx = min(3, int(t / (duration_sec * 0.25)))
        f0, f1, f2 = chords[seg_idx]

        # Wide stereo detuned analog pad
        pad_l = (
            math.sin(two_pi * f0 * t) * 0.30
            + math.sin(two_pi * (f1 * 1.003) * t) * 0.18
            + math.sin(two_pi * f2 * t) * 0.10
        )
        pad_r = (
            math.sin(two_pi * f0 * t) * 0.30
            + math.sin(two_pi * (f1 * 0.997) * t) * 0.18
            + math.sin(two_pi * (f2 * 1.002) * t) * 0.10
        )

        # Sidechain groove breathing
        beat_phase = (t % beat_period) / beat_period
        duck = 0.68 + 0.32 * min(1.0, beat_phase * 2.5)
        left = pad_l * duck * 0.42
        right = pad_r * duck * 0.42

        # Style-specific rhythmic texture (hi-hat pulse / editorial paper-tick / press click)
        if shot_style == "pulse_drop":
            sub_t = t % beat_period
            if sub_t < 0.14:
                kick_f = 135.0 * math.exp(-sub_t * 28.0) + 46.0
                kick = math.sin(two_pi * kick_f * sub_t) * math.exp(-sub_t * 16.0) * 0.34
                left += kick
                right += kick
            hat_t = (t + beat_period * 0.5) % (beat_period * 0.5)
            if hat_t < 0.03:
                hat = (rng.random() * 2.0 - 1.0) * math.exp(-hat_t * 120.0) * 0.09
                left += hat * 0.85
                right += hat * 1.15
        elif shot_style in ("vox_collage", "ink_press"):
            tick_t = t % (beat_period * 0.5)
            if tick_t < 0.025:
                click = (rng.random() * 2.0 - 1.0) * math.exp(-tick_t * 140.0) * 0.11
                left += click
                right += click * 0.7

        # Transition risers (0.42s before beat cut) + Sub-bass impact + shimmer chime on beat cuts
        for b_idx, bt in enumerate(beat_times):
            dt = t - bt
            # Pre-cut riser whoosh (skip bt=0)
            if b_idx > 0 and -0.42 <= dt < 0.0:
                u = (dt + 0.42) / 0.42
                riser_f = 220.0 + (u**2) * 880.0
                riser_noise = (rng.random() * 2.0 - 1.0) * 0.06 * (u**2)
                riser_tone = math.sin(two_pi * riser_f * t) * 0.07 * (u**2)
                left += riser_tone + riser_noise * 0.9
                right += riser_tone + riser_noise * 1.1
            # Beat impact & harmonic chime
            if 0.0 <= dt < 0.42:
                hit_env = math.exp(-dt * 10.5)
                sub_f = 95.0 * math.exp(-dt * 14.0) + 42.0
                sub = math.sin(two_pi * sub_f * dt) * 0.28 * hit_env
                chime_f = 523.25 if shot_style != "luxury_editorial" else 659.25
                chime = math.sin(two_pi * chime_f * dt) * 0.14 * math.exp(-dt * 8.5)
                left += sub + chime * 1.1
                right += sub + chime * 0.9

        l_s = int(max(-0.94, min(0.94, left * env)) * 32767)
        r_s = int(max(-0.94, min(0.94, right * env)) * 32767)
        struct.pack_into("<hh", frames, i * 4, l_s, r_s)

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(frames))


# ---------------------------------------------------------------------------
# Precomputed Studio Assets: Glow Sprites, Film Grain, Vignette, Hero Cards
# ---------------------------------------------------------------------------


def _make_glow_sprite(
    size: int, color: tuple[int, int, int], alpha: int
) -> Image.Image:
    sprite = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite, "RGBA")
    pad = int(size * 0.24)
    d.ellipse((pad, pad, size - pad, size - pad), fill=(*color, alpha))
    return sprite.filter(ImageFilter.GaussianBlur(radius=size * 0.16))


def _make_vignette_overlay(width: int, height: int, strength: int = 125) -> Image.Image:
    """Optical lens vignette for cinematic depth (motionmaxxing anti-slop)."""
    small_w, small_h = 160, 90 if width >= height else 160
    if height > width:
        small_w, small_h = 90, 160
    vig = Image.new("RGBA", (small_w, small_h), (0, 0, 0, 0))
    px = vig.load()
    cx, cy = small_w / 2.0, small_h / 2.0
    max_d = math.hypot(cx, cy)
    for y in range(small_h):
        for x in range(small_w):
            dist = math.hypot(x - cx, y - cy) / max_d
            a = int(strength * max(0.0, (dist - 0.45) / 0.55) ** 2)
            px[x, y] = (0, 0, 0, min(255, a))
    return vig.resize((width, height), Image.Resampling.BILINEAR)


def _make_film_grain_tiles(width: int, height: int, count: int = 3) -> list[Image.Image]:
    """Generate lightweight precomputed film-grain overlays cycled per frame."""
    tiles: list[Image.Image] = []
    gw, gh = width // 3, height // 3
    rng = random.Random(1337)
    for _ in range(count):
        tile = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
        px = tile.load()
        for y in range(gh):
            for x in range(gw):
                if rng.random() < 0.14:
                    v = 255 if rng.random() > 0.5 else 0
                    px[x, y] = (v, v, v, 14)
        tiles.append(tile.resize((width, height), Image.Resampling.NEAREST))
    return tiles


def _load_hero_images(paths: list[str], target_w: int, target_h: int) -> list[Image.Image]:
    """Load real generated Gemini PNG/JPG campaign visuals for Ken Burns compositing."""
    loaded: list[Image.Image] = []
    for raw_path in paths:
        if not raw_path:
            continue
        p = Path(raw_path)
        if not p.is_file() or p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        try:
            with Image.open(p) as im:
                rgb = im.convert("RGBA")
                # Pre-scale slightly oversized (1.22x) for smooth Ken Burns zoom/pan crops
                fitted = ImageOps.fit(
                    rgb,
                    (int(target_w * 1.22), int(target_h * 1.22)),
                    method=Image.Resampling.LANCZOS,
                )
                loaded.append(fitted)
                if len(loaded) >= 2:
                    break
        except Exception as exc:
            logger.debug("Skipping hero image %s: %s", raw_path, exc)
    return loaded


def _paste_ken_burns_hero_card(
    canvas: Image.Image,
    hero_img: Image.Image,
    *,
    cx: float,
    cy: float,
    card_w: int,
    card_h: int,
    progress: float,
    accent_rgb: tuple[int, int, int],
    shot_style: ShotStyle,
    tilt_deg: float = 0.0,
) -> None:
    """Composite a real generated Gemini image with Ken Burns dolly zoom + editorial frame."""
    sw, sh = hero_img.size
    # Smooth 1.00 -> 1.15 Ken Burns crop window
    zoom = 1.0 + 0.14 * _clamp01(progress)
    crop_w = int(sw / zoom)
    crop_h = int(sh / zoom)
    pan_x = int((sw - crop_w) * (0.35 + 0.30 * _clamp01(progress)))
    pan_y = int((sh - crop_h) * (0.45 - 0.15 * _clamp01(progress)))
    cropped = hero_img.crop((pan_x, pan_y, pan_x + crop_w, pan_y + crop_h))
    resized = cropped.resize((card_w, card_h), Image.Resampling.BILINEAR)

    # Rounded mask (or crisp torn/paper border for Vox Collage / Ink Press)
    pad = 12 if shot_style == "vox_collage" else (6 if shot_style == "ink_press" else 4)
    framed_w = card_w + pad * 2
    framed_h = card_h + pad * 2
    card = Image.new("RGBA", (framed_w, framed_h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card, "RGBA")

    if shot_style == "vox_collage":
        # Warm cream cutout paper mat + dark stamp shadow border
        cd.rectangle((0, 0, framed_w - 1, framed_h - 1), fill=(252, 249, 240, 255), outline=(28, 25, 23, 220), width=2)
        card.paste(resized, (pad, pad))
        # Masking-tape accent strip at top center
        tape_w = max(54, card_w // 4)
        cd.rectangle(
            (framed_w // 2 - tape_w // 2, 0, framed_w // 2 + tape_w // 2, 14),
            fill=(*accent_rgb, 215),
        )
    elif shot_style == "ink_press":
        cd.rectangle((0, 0, framed_w - 1, framed_h - 1), fill=(24, 24, 27, 255), outline=(24, 24, 27, 255), width=2)
        card.paste(resized, (pad, pad))
    else:
        mask = Image.new("L", (card_w, card_h), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle((0, 0, card_w, card_h), radius=18, fill=255)
        cd.rounded_rectangle(
            (0, 0, framed_w - 1, framed_h - 1),
            radius=21,
            fill=(16, 18, 28, 220),
            outline=(*accent_rgb, 185),
            width=2,
        )
        card.paste(resized, (pad, pad), mask)

    if abs(tilt_deg) > 0.2:
        card = card.rotate(tilt_deg, resample=Image.Resampling.BICUBIC, expand=True)

    # Soft drop shadow
    paste_x = int(cx - card.width / 2)
    paste_y = int(cy - card.height / 2)
    shadow = Image.new("RGBA", (card.width, card.height), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.rounded_rectangle((4, 8, card.width - 2, card.height - 2), radius=18, fill=(0, 0, 0, 88))
    canvas.paste(shadow, (paste_x + 4, paste_y + 10), shadow)
    canvas.paste(card, (paste_x, paste_y), card)


# ---------------------------------------------------------------------------
# Continuous-Camera Motion Frame Renderer (24fps)
# ---------------------------------------------------------------------------


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
    vignette: Image.Image,
    grain_tile: Image.Image,
    hero_images: list[Image.Image],
    bg_rgb: tuple[int, int, int],
    primary_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
    text_rgb: tuple[int, int, int],
    muted_rgb: tuple[int, int, int],
    is_light_ground: bool,
) -> bytes:
    """Render one 24fps frame of the continuous motion-graphics studio world."""
    is_vertical = height > width
    progress = _clamp01(t / duration)

    img = base_canvas.copy()

    cam_x = math.sin(progress * math.pi * 2.0) * (width * 0.04)
    cam_y = math.cos(progress * math.pi * 1.5) * (height * 0.025)
    bpm_period = 60.0 / (124.0 if spec.shot_style == "pulse_drop" else 100.0)
    beat_pulse = math.exp(-((t % bpm_period) * 5.2))

    # 1. Volumetric Moving Studio Halos (dark/cinematic modes) or Editorial Paper Wash
    if not is_light_ground:
        gw1, gh1 = glow_primary.size
        halo1_x = int(width * (0.74 - 0.12 * progress) + cam_x * 1.4 - gw1 / 2)
        halo1_y = int(height * (0.28 + 0.14 * math.sin(progress * math.pi)) + cam_y - gh1 / 2)
        img.paste(glow_primary, (halo1_x, halo1_y), glow_primary)

        gw2, gh2 = glow_accent.size
        halo2_x = int(width * (0.22 + 0.16 * progress) - cam_x - gw2 / 2)
        halo2_y = int(height * (0.78 - 0.12 * progress) - cam_y - gh2 / 2)
        img.paste(glow_accent, (halo2_x, halo2_y), glow_accent)

    overlay = ImageDraw.Draw(img, "RGBA")

    # 2. Architectural Frame, Registration Marks (Ink Press) & Telemetry Bar
    pad = int(min(width, height) * 0.045)
    border_col = (24, 24, 27, 65) if is_light_ground else (255, 255, 255, 34)
    divider_col = (24, 24, 27, 38) if is_light_ground else (255, 255, 255, 24)

    if spec.shot_style == "ink_press":
        overlay.rectangle((pad, pad, width - pad, height - pad), outline=(24, 24, 27, 190), width=2)
        # Print registration crosshairs in corners
        for rx, ry in ((pad - 8, pad - 8), (width - pad + 8, pad - 8), (pad - 8, height - pad + 8), (width - pad + 8, height - pad + 8)):
            overlay.line((rx - 6, ry, rx + 6, ry), fill=(24, 24, 27, 140), width=1)
            overlay.line((rx, ry - 6, rx, ry + 6), fill=(24, 24, 27, 140), width=1)
    else:
        overlay.rounded_rectangle(
            (pad, pad, width - pad, height - pad),
            radius=20 if spec.shot_style != "vox_collage" else 6,
            outline=border_col,
            width=2 if spec.shot_style == "vox_collage" else 1,
        )

    top_bar_y = pad + 44
    overlay.line((pad, top_bar_y, width - pad, top_bar_y), fill=divider_col, width=1)

    # Top-left live indicator + Brand
    dot_r = 4
    overlay.ellipse(
        (pad + 18 - dot_r, pad + 22 - dot_r, pad + 18 + dot_r, pad + 22 + dot_r),
        fill=(*accent_rgb, 245),
    )
    overlay.text(
        (pad + 32, pad + 14),
        spec.brand_name.upper()[:28],
        font=fonts["mono_sm"],
        fill=(*text_rgb, 235),
    )

    # Top-right shot style + live 24fps timecode
    style_label = SHOT_STYLES.get(spec.shot_style, {}).get("label", spec.shot_style).upper()
    tc_text = f"00:{int(t):02d}:{int((t % 1.0) * spec.fps):02d}  //  {style_label}"
    tc_bbox = overlay.textbbox((0, 0), tc_text, font=fonts["mono_xs"])
    overlay.text(
        (width - pad - 18 - (tc_bbox[2] - tc_bbox[0]), pad + 16),
        tc_text,
        font=fonts["mono_xs"],
        fill=(*accent_rgb, 225) if not is_light_ground else (24, 24, 27, 185),
    )

    # Beat boundaries
    b1 = duration * 0.25
    b2 = duration * 0.53
    b3 = duration * 0.78

    # 3. Persistent Hero Subject: Real Generated Gemini Image (Ken Burns) OR Sculptural Monolith
    end_shift = ease_whip_push((t - (b3 - 0.25)) / 0.85)
    prism_cx = (width * 0.50) if is_vertical else (width * (0.74 - 0.04 * math.sin(progress * math.pi)))
    prism_cy = (height * 0.31) if is_vertical else (height * 0.54)

    if hero_images and t < b3 + 0.15:
        # Select primary hero image (swap cleanly on Beat 3 if 2+ Gemini images exist)
        active_hero = hero_images[1] if (len(hero_images) > 1 and t >= b2) else hero_images[0]
        card_w = int(width * (0.72 if is_vertical else 0.34))
        card_h = int(card_w * (0.68 if not is_vertical else 0.72))
        tilt = -2.4 + 4.8 * progress if spec.shot_style == "vox_collage" else (0.0 if spec.shot_style == "ink_press" else math.sin(progress * math.pi * 2) * 1.4)
        hero_cx = prism_cx + (0 if is_vertical else int(end_shift * width * 0.45))
        _paste_ken_burns_hero_card(
            img,
            active_hero,
            cx=hero_cx,
            cy=prism_cy,
            card_w=card_w,
            card_h=card_h,
            progress=progress,
            accent_rgb=accent_rgb,
            shot_style=spec.shot_style,
            tilt_deg=tilt,
        )
        overlay = ImageDraw.Draw(img, "RGBA")
    else:
        # Sculptural orbital monolith when no raster hero image is present or on end lockup
        mono_cx = (width * 0.50) if is_vertical else (width * (0.74 - 0.24 * end_shift))
        prism_scale = 0.86 + 0.20 * math.sin(progress * math.pi) + 0.06 * beat_pulse
        base_r = min(width, height) * (0.20 if not is_vertical else 0.19) * prism_scale
        rot = t * (0.95 if spec.shot_style == "pulse_drop" else 0.55)

        for ring_idx, mult in enumerate((1.48, 1.18)):
            rr = base_r * mult
            ring_col = primary_rgb if ring_idx == 0 else accent_rgb
            overlay.ellipse(
                (mono_cx - rr, prism_cy - rr, mono_cx + rr, prism_cy + rr),
                outline=(*ring_col, 85 if ring_idx == 0 else 135),
                width=2 if ring_idx == 1 else 1,
            )

        pts = [
            (mono_cx + math.cos(rot + k * math.pi / 2.0) * base_r, prism_cy + math.sin(rot + k * math.pi / 2.0) * base_r)
            for k in range(4)
        ]
        overlay.polygon(pts, fill=(*primary_rgb, 75), outline=(*accent_rgb, 220))

        inner_pts = [
            (mono_cx + math.cos(-rot * 0.75 + k * math.pi / 2.0) * (base_r * 0.58), prism_cy + math.sin(-rot * 0.75 + k * math.pi / 2.0) * (base_r * 0.58))
            for k in range(4)
        ]
        overlay.polygon(inner_pts, fill=(*bg_rgb, 185), outline=(*text_rgb, 170))

    # Pulse-drop acoustic spectrum bars (always visible under hero subject in pulse_drop)
    if spec.shot_style in ("pulse_drop", "obsidian_cinema") and t < b3:
        num_bars = 16
        bar_w = 5
        bar_gap = 9
        total_w = num_bars * (bar_w + bar_gap)
        start_x = prism_cx - total_w / 2
        base_y = min(height - pad - 34, prism_cy + (height * 0.26 if not is_vertical else height * 0.21))
        for b in range(num_bars):
            bh = 7 + 24 * abs(math.sin(t * 5.0 + b * 0.6)) * (0.55 + 0.45 * beat_pulse)
            col = accent_rgb if b % 2 == 0 else primary_rgb
            overlay.rounded_rectangle(
                (start_x + b * (bar_w + bar_gap), base_y - bh, start_x + b * (bar_w + bar_gap) + bar_w, base_y),
                radius=3,
                fill=(*col, 195),
            )

    # 4. Four Continuous Dramaturgy Beats with Masked Baseline Typography Reveals
    text_x = pad + 34
    text_max_w = (width - 2 * pad - 68) if is_vertical else int(width * 0.50)
    text_base_y = int(height * 0.58) if is_vertical else int(height * 0.30)
    display_lh = 52 if not is_vertical else 44
    vox_hl = (250, 204, 21) if spec.shot_style == "vox_collage" else None

    if t < b1:
        # BEAT 1: Pattern-Interrupt Hook
        ease_fn = ease_press_stamp if spec.shot_style == "ink_press" else (
            ease_velvet_drift if spec.shot_style == "luxury_editorial" else ease_snap_settle
        )
        e = ease_fn(t / (b1 * 0.34))
        fade_out = 1.0 - _clamp01((t - (b1 - 0.28)) / 0.28)
        alpha = int(255 * _clamp01(e) * fade_out)

        pill_txt = f"01 // {spec.brand_tone.upper()} LAUNCH"
        pb = overlay.textbbox((0, 0), pill_txt, font=fonts["mono_xs"])
        pw = (pb[2] - pb[0]) + 28
        overlay.rounded_rectangle(
            (text_x, text_base_y - 44, text_x + pw, text_base_y - 18),
            radius=6 if spec.shot_style in ("vox_collage", "ink_press") else 13,
            fill=(*primary_rgb, int(55 * fade_out)) if not is_light_ground else (24, 24, 27, int(235 * fade_out)),
            outline=(*primary_rgb, int(170 * fade_out)),
        )
        overlay.text(
            (text_x + 14, text_base_y - 38),
            pill_txt,
            font=fonts["mono_xs"],
            fill=(*text_rgb, alpha) if not is_light_ground else (255, 255, 255, alpha),
        )

        lines = _wrap_text(overlay, spec.hook.upper(), fonts["display"], text_max_w, max_lines=3)
        _draw_masked_text_lines(
            img,
            x=text_x,
            y=text_base_y,
            lines=lines,
            line_height=display_lh,
            font=fonts["display"],
            colors=[text_rgb, accent_rgb if not is_light_ground else primary_rgb, text_rgb],
            reveal=e,
            alpha=alpha,
            highlight_bg=vox_hl,
        )
        overlay = ImageDraw.Draw(img, "RGBA")
        sub_y = text_base_y + len(lines) * display_lh + 14
        sub_lines = _wrap_text(overlay, f"Introducing {spec.brand_name}.", fonts["body"], text_max_w, max_lines=2)
        for idx_s, sline in enumerate(sub_lines):
            overlay.text((text_x, sub_y + idx_s * 26), sline, font=fonts["body"], fill=(*muted_rgb, int(alpha * 0.92)))

    elif t < b2:
        # BEAT 2: Visual Proof & Differentiator
        local_t = t - b1
        seg = b2 - b1
        e = ease_velvet_drift(local_t / (seg * 0.30)) if spec.shot_style == "luxury_editorial" else ease_soft_land(local_t / (seg * 0.28))
        fade_out = 1.0 - _clamp01((local_t - (seg - 0.28)) / 0.28)
        alpha = int(255 * e * fade_out)

        overlay.text(
            (text_x, text_base_y - 34),
            "02 // ENGINEERED DIFFERENCE",
            font=fonts["mono_sm"],
            fill=(*accent_rgb, alpha) if not is_light_ground else (*primary_rgb, alpha),
        )
        lines = _wrap_text(overlay, spec.brand_name, fonts["display"], text_max_w, max_lines=2)
        _draw_masked_text_lines(
            img,
            x=text_x,
            y=text_base_y,
            lines=lines,
            line_height=display_lh,
            font=fonts["display"],
            colors=[text_rgb, text_rgb],
            reveal=e,
            alpha=alpha,
            highlight_bg=vox_hl,
        )
        overlay = ImageDraw.Draw(img, "RGBA")
        desc_y = text_base_y + len(lines) * display_lh + 14
        desc_lines = _wrap_text(overlay, spec.description[:155], fonts["body"], text_max_w, max_lines=3)
        for idx_d, dline in enumerate(desc_lines):
            overlay.text((text_x, desc_y + idx_d * 27), dline, font=fonts["body"], fill=(*muted_rgb, int(alpha * 0.94)))

    elif t < b3:
        # BEAT 3: Audience & Brand Palette System
        local_t = t - b2
        seg = b3 - b2
        e = ease_soft_land(local_t / (seg * 0.28))
        fade_out = 1.0 - _clamp01((local_t - (seg - 0.28)) / 0.28)
        alpha = int(255 * e * fade_out)
        x_shift = int((1.0 - e) * -28)

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
        _draw_masked_text_lines(
            img,
            x=text_x + x_shift,
            y=text_base_y,
            lines=aud_lines,
            line_height=42,
            font=fonts["subdisplay"],
            colors=[text_rgb, text_rgb, text_rgb],
            reveal=e,
            alpha=alpha,
            highlight_bg=vox_hl,
        )
        overlay = ImageDraw.Draw(img, "RGBA")

        # Staggered animated brand swatch rail
        sw_y = text_base_y + len(aud_lines) * 42 + 24
        for idx_c, hx in enumerate(spec.palette[:5]):
            sw_e = ease_snap_settle((local_t - idx_c * 0.08) / 0.35)
            sw_a = int(alpha * _clamp01(sw_e))
            sw_rgb = _hex_to_rgb(hx, primary_rgb)
            sx = text_x + x_shift + idx_c * 48
            overlay.rounded_rectangle(
                (sx, sw_y + int((1.0 - _clamp01(sw_e)) * 12), sx + 36, sw_y + 36 + int((1.0 - _clamp01(sw_e)) * 12)),
                radius=8 if spec.shot_style != "ink_press" else 2,
                fill=(*sw_rgb, sw_a),
                outline=(*text_rgb, int(110 * fade_out)),
            )

        plat_str = " · ".join(p.replace("_", " ").upper() for p in spec.platforms)
        overlay.text(
            (text_x + x_shift, sw_y + 50),
            plat_str,
            font=fonts["mono_xs"],
            fill=(*accent_rgb, int(alpha * 0.92)) if not is_light_ground else (*muted_rgb, alpha),
        )

    else:
        # BEAT 4: Conversion Monolith End-Card + Pulsing CTA
        local_t = t - b3
        e = ease_soft_land(local_t / 0.65)
        alpha = int(255 * e)
        y_shift = int((1.0 - e) * 20)

        center_x = width // 2
        lock_y = int(height * (0.52 if is_vertical else 0.36)) + y_shift

        b_lines = _wrap_text(overlay, spec.brand_name.upper(), fonts["display"], width - 2 * pad - 60, max_lines=2)
        for idx_b, bline in enumerate(b_lines):
            bb = overlay.textbbox((0, 0), bline, font=fonts["display"])
            bw = bb[2] - bb[0]
            overlay.text(
                (center_x - bw // 2, lock_y + idx_b * display_lh),
                bline,
                font=fonts["display"],
                fill=(*text_rgb, alpha),
            )

        tag_y = lock_y + len(b_lines) * display_lh + 12
        tag_text = spec.tagline[:78]
        tb = overlay.textbbox((0, 0), tag_text, font=fonts["body"])
        overlay.text(
            (center_x - (tb[2] - tb[0]) // 2, tag_y),
            tag_text,
            font=fonts["body"],
            fill=(*muted_rgb, int(alpha * 0.94)),
        )

        # Pulsing CTA Button Pill
        cta_y = tag_y + 48
        cta_txt = f"{spec.cta_label.upper()}  →"
        cb = overlay.textbbox((0, 0), cta_txt, font=fonts["mono_sm"])
        cw = (cb[2] - cb[0]) + 52
        ch = 44
        btn_col = (24, 24, 27) if is_light_ground else _blend(primary_rgb, accent_rgb, 0.35 + 0.25 * beat_pulse)
        overlay.rounded_rectangle(
            (center_x - cw // 2, cta_y, center_x + cw // 2, cta_y + ch),
            radius=6 if spec.shot_style in ("vox_collage", "ink_press") else 14,
            fill=(*btn_col, alpha),
            outline=(*accent_rgb, int(180 * e)),
            width=2,
        )
        overlay.text(
            (center_x - (cb[2] - cb[0]) // 2, cta_y + 13),
            cta_txt,
            font=fonts["mono_sm"],
            fill=(255, 255, 255, alpha),
        )

    # 5. Bottom Progress Timeline Bar + Beat Notch Markers
    bar_y = height - pad - 14
    bar_x0 = pad + 18
    bar_x1 = width - pad - 18
    bar_len = bar_x1 - bar_x0
    overlay.rounded_rectangle(
        (bar_x0, bar_y, bar_x1, bar_y + 4),
        radius=2,
        fill=(24, 24, 27, 36) if is_light_ground else (255, 255, 255, 32),
    )
    fill_x1 = bar_x0 + int(bar_len * progress)
    if fill_x1 > bar_x0:
        overlay.rounded_rectangle(
            (bar_x0, bar_y, fill_x1, bar_y + 4),
            radius=2,
            fill=(*accent_rgb, 240) if not is_light_ground else (24, 24, 27, 230),
        )
    for frac in (0.25, 0.53, 0.78):
        nx = bar_x0 + int(bar_len * frac)
        overlay.rectangle((nx - 1, bar_y - 2, nx + 1, bar_y + 6), fill=(*text_rgb, 110))

    # 6. Anti-Slop Cinematic Finish: Optical Vignette + Animated Film Grain
    img.paste(vignette, (0, 0), vignette)
    img.paste(grain_tile, (0, 0), grain_tile)

    return img.convert("RGB").tobytes()


def render_campaign_video_mp4(spec: VideoRenderSpec, output_path: Path) -> Path:
    """Render a 24fps H.264 MP4 promo video with stereo beat-synced audio to `output_path`."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        raise RuntimeError("ffmpeg binary not found on PATH; cannot encode MP4 video.")

    # Crisp 960x540 (16:9) / 540x960 (9:16) @ 24fps — sharp cinema output with fast CPU encode
    width, height = (540, 960) if spec.aspect_ratio == "9:16" else (960, 540)
    total_frames = max(24, int(spec.duration_sec * spec.fps))

    palette = spec.palette if len(spec.palette) >= 3 else ["#09090B", "#8B5CF6", "#06B6D4", "#F8FAFC"]
    is_light_ground = spec.shot_style in ("vox_collage", "ink_press")

    if spec.shot_style == "vox_collage":
        bg_rgb = (244, 239, 230)  # Warm archival paper
        primary_rgb = _hex_to_rgb(palette[1], (220, 38, 38))
        accent_rgb = (234, 179, 8)  # Editorial Vox yellow
        text_rgb = (23, 23, 23)
        muted_rgb = (68, 64, 60)
    elif spec.shot_style == "ink_press":
        bg_rgb = (247, 246, 242)  # Swiss editorial ivory stock
        primary_rgb = (24, 24, 27)
        accent_rgb = _hex_to_rgb(palette[1], (225, 29, 72))
        text_rgb = (18, 18, 21)
        muted_rgb = (82, 82, 91)
    else:
        bg_rgb = _hex_to_rgb(palette[0], (9, 9, 12))
        if sum(bg_rgb) > 120:
            bg_rgb = (9, 9, 12)
        primary_rgb = _hex_to_rgb(palette[1], (139, 92, 246))
        accent_rgb = (212, 175, 55) if spec.shot_style == "luxury_editorial" else _hex_to_rgb(palette[2], (6, 182, 212))
        text_rgb = (248, 250, 252)
        muted_rgb = (203, 213, 225)

    fonts = {
        "display": _load_font(44 if width > height else 38, bold=True),
        "subdisplay": _load_font(34 if width > height else 28, bold=True),
        "body": _load_font(20 if width > height else 18, bold=False),
        "mono_sm": _load_font(15, bold=True, mono=True),
        "mono_xs": _load_font(13, bold=True, mono=True),
    }

    # Pre-render static canvas texture (halftone for Vox, architectural grid for Ink Press, dot-grid for Cinema)
    base_canvas = Image.new("RGBA", (width, height), (*bg_rgb, 255))
    base_draw = ImageDraw.Draw(base_canvas, "RGBA")
    if spec.shot_style == "vox_collage":
        # Subtle editorial halftone dot matrix
        for gx in range(12, width, 18):
            for gy in range(12, height, 18):
                base_draw.ellipse((gx, gy, gx + 2, gy + 2), fill=(28, 25, 23, 18))
    elif spec.shot_style == "ink_press":
        # Swiss architectural hairline rules
        for gx in range(0, width, 80):
            base_draw.line((gx, 0, gx, height), fill=(24, 24, 27, 14), width=1)
        for gy in range(0, height, 80):
            base_draw.line((0, gy, width, gy), fill=(24, 24, 27, 14), width=1)
    else:
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
    vignette = _make_vignette_overlay(width, height, strength=65 if is_light_ground else 135)
    grain_tiles = _make_film_grain_tiles(width, height, count=3)

    card_target_w = int(width * (0.72 if height > width else 0.34))
    card_target_h = int(card_target_w * 0.7)
    hero_images = _load_hero_images(spec.hero_image_paths, card_target_w, card_target_h)

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
            "veryfast",
            "-crf",
            "21",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
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
                    vignette=vignette,
                    grain_tile=grain_tiles[frame_idx % len(grain_tiles)],
                    hero_images=hero_images,
                    bg_rgb=bg_rgb,
                    primary_rgb=primary_rgb,
                    accent_rgb=accent_rgb,
                    text_rgb=text_rgb,
                    muted_rgb=muted_rgb,
                    is_light_ground=is_light_ground,
                )
                proc.stdin.write(raw)
            proc.stdin.flush()
        finally:
            proc.stdin.close()
            proc.stdin = None

        _, stderr_bytes = proc.communicate(timeout=120)
        if proc.returncode != 0:
            err = stderr_bytes.decode("utf-8", errors="ignore")
            raise RuntimeError(f"ffmpeg video encoding failed: {err}")

    return output_path
