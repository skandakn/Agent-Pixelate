"""Multi-provider Image Generation Backend with High-Resolution Curated Fallback.

Supports switching providers via the `IMAGE_PROVIDER` environment variable:
  - `auto` (default): tries Gemini Imagen -> OpenAI `gpt-image-1` -> Fal.ai -> studio PNG fallback
  - `gemini`: Google Gemini Imagen 3 (`imagen-3.0-generate-002`) via `google-genai`
  - `openai`: OpenAI `gpt-image-1` via `openai` SDK
  - `fal`: Fal.ai Flux (`fal-ai/flux/schnell` or `FAL_MODEL`) via REST API
  - `placeholder`: Studio-grade local Pillow PNG artwork rendered in the exact 5-hex
    campaign color palette and target aspect ratio (1600x900, 1080x1080, 1080x1920)
    with optional curated Unsplash reference URL metadata.

Whenever a live provider lacks credentials, hits rate limits/quotas, or returns an
error, the provider seamlessly falls back to high-resolution rendered PNG assets so
campaigns never break during hackathon demos.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import logging
import math
import os
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

logger = logging.getLogger(__name__)

# Curated high-resolution editorial photography fallbacks (Royalty-free Unsplash IDs)
CURATED_UNSPLASH_FALLBACKS: dict[str, str] = {
    "hero_banner": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&h=900&q=90",
    "instagram_square": "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1080&h=1080&q=90",
    "story_reel_vertical": "https://images.unsplash.com/photo-1618172193622-ae2d025f4032?auto=format&fit=crop&w=1080&h=1920&q=90",
}


@dataclass(slots=True)
class GeneratedImageResult:
    """Result returned by `ImageGenerationService.generate_image`."""

    file_path: Path | None
    asset_url: str
    mime_type: str
    width: int
    height: int
    provider_used: str
    fallback_reference_url: str | None = None


def _hex_to_rgb(hex_color: str, default: tuple[int, int, int] = (99, 102, 241)) -> tuple[int, int, int]:
    cleaned = hex_color.strip().lstrip("#")
    if len(cleaned) == 3:
        cleaned = "".join(ch * 2 for ch in cleaned)
    if len(cleaned) != 6:
        return default
    try:
        return (int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16))
    except ValueError:
        return default


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Attempt to load a crisp sans-serif TrueType font across Windows/Linux/macOS."""
    candidates = (
        [
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        ]
        if bold
        else [
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
        ]
    )
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def render_studio_placeholder_png(
    *,
    brand_name: str,
    title: str,
    slot: str,
    platform: str,
    aspect_ratio: str,
    width: int,
    height: int,
    color_palette: list[str],
    lighting_notes: str,
    visual_metaphor: str,
) -> bytes:
    """Render a high-resolution, editorial-grade studio visual PNG in the 5-hex brand palette.

    Produces a genuinely attractive, palette-accurate marketing mockup with smooth
    mesh gradients, soft studio rim-light orbs, geometric framing grid, palette
    swatches bar, and crisp typography so fallback visuals look intentional and
    presentation-ready in the UI.
    """
    palette = list(color_palette) if len(color_palette) >= 5 else [
        "#6366F1", "#0B1120", "#22D3EE", "#1E1B4B", "#F8FAFC"
    ]
    c_primary = _hex_to_rgb(palette[0], (99, 102, 241))
    c_deep = _hex_to_rgb(palette[1], (11, 17, 32))
    c_accent = _hex_to_rgb(palette[2], (34, 211, 238))
    c_surface = _hex_to_rgb(palette[3], (30, 27, 75))
    c_light = _hex_to_rgb(palette[4], (248, 250, 252))

    # Build smooth diagonal gradient at 1/4 scale then upscale with bicubic smoothing (fast & silky)
    gw, gh = max(64, width // 4), max(64, height // 4)
    grad = Image.new("RGB", (gw, gh), c_deep)
    px = grad.load()
    assert px is not None
    for y in range(gh):
        ty = y / max(1, gh - 1)
        for x in range(gw):
            tx = x / max(1, gw - 1)
            mix = 0.55 * tx + 0.45 * ty
            r = int(c_deep[0] * (1 - mix) + c_surface[0] * mix)
            g = int(c_deep[1] * (1 - mix) + c_surface[1] * mix)
            b = int(c_deep[2] * (1 - mix) + c_surface[2] * mix)
            px[x, y] = (r, g, b)

    canvas = grad.resize((width, height), resample=Image.Resampling.BICUBIC).convert("RGBA")

    # Atmospheric studio glow orbs (blurred layer for volumetric rim-lighting feel)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    seed_val = int(hashlib.sha256(f"{brand_name}:{slot}".encode()).hexdigest()[:6], 16)
    orb_r1 = int(min(width, height) * 0.42)
    orb_r2 = int(min(width, height) * 0.34)
    orb_r3 = int(min(width, height) * 0.24)

    cx1 = int(width * (0.76 if width >= height else 0.72))
    cy1 = int(height * (0.28 if width >= height else 0.26))
    cx2 = int(width * (0.22 + (seed_val % 10) * 0.01))
    cy2 = int(height * 0.80)
    cx3 = int(width * 0.65)
    cy3 = int(height * 0.64)

    gdraw.ellipse((cx1 - orb_r1, cy1 - orb_r1, cx1 + orb_r1, cy1 + orb_r1), fill=(*c_primary, 155))
    gdraw.ellipse((cx2 - orb_r2, cy2 - orb_r2, cx2 + orb_r2, cy2 + orb_r2), fill=(*c_accent, 115))
    gdraw.ellipse((cx3 - orb_r3, cy3 - orb_r3, cx3 + orb_r3, cy3 + orb_r3), fill=(*c_accent, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(32, min(width, height) // 10)))
    canvas = Image.alpha_composite(canvas, glow)

    # Subtle architectural pixel-grid + geometric focal sculpture
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    grid_step = max(48, min(width, height) // 14)
    for gx in range(0, width, grid_step):
        draw.line([(gx, 0), (gx, height)], fill=(*c_light, 16), width=1)
    for gy in range(0, height, grid_step):
        draw.line([(0, gy), (width, gy)], fill=(*c_light, 16), width=1)

    # Sculptural studio pedestal / focal geometric emblem on the hero side
    min_dim = min(width, height)
    if width > height:
        # 16:9 Hero Banner: right-third hero object, clean left-third typography space
        fx, fy = int(width * 0.74), int(height * 0.50)
        fr = int(min_dim * 0.28)
    elif height > width:
        # 9:16 Story/Reel: center safe-zone sculpture
        fx, fy = int(width * 0.50), int(height * 0.44)
        fr = int(min_dim * 0.27)
    else:
        # 1:1 Square: offset dynamic focal sculpture
        fx, fy = int(width * 0.68), int(height * 0.42)
        fr = int(min_dim * 0.24)

    # Concentric editorial rings + glowing core capsule
    for ring_idx, scale in enumerate((1.38, 1.15, 0.92)):
        rr = int(fr * scale)
        alpha = 42 + ring_idx * 25
        ring_col = c_accent if ring_idx == 1 else c_light
        draw.ellipse((fx - rr, fy - rr, fx + rr, fy + rr), outline=(*ring_col, alpha), width=2)

    # Tilted glassmorphic prism silhouette representing hero product spotlight
    prism_pts = [
        (fx + int(fr * 0.68 * math.cos(a)), fy + int(fr * 0.68 * math.sin(a)))
        for a in (math.radians(d) for d in (30, 90, 150, 210, 270, 330))
    ]
    draw.polygon(prism_pts, fill=(*c_primary, 130), outline=(*c_light, 200))
    inner_pts = [
        (fx + int(fr * 0.36 * math.cos(a)), fy + int(fr * 0.36 * math.sin(a)))
        for a in (math.radians(d) for d in (0, 60, 120, 180, 240, 300))
    ]
    draw.polygon(inner_pts, fill=(*c_accent, 170), outline=(*c_light, 230))

    # Crisp glassmorphic editorial framing card
    pad_x = int(width * 0.06)
    pad_y = int(height * 0.07)
    if width > height:
        card_box = (pad_x, pad_y, int(width * 0.54), height - pad_y)
    elif height > width:
        card_box = (pad_x, int(height * 0.62), width - pad_x, int(height * 0.87))
    else:
        card_box = (pad_x, int(height * 0.56), width - pad_x, height - pad_y)

    draw.rounded_rectangle(
        card_box,
        radius=28,
        fill=(*c_deep, 175),
        outline=(*c_light, 65),
        width=2,
    )

    # Typography inside the editorial card
    card_x0, card_y0, card_x1, card_y1 = card_box
    inner_pad = int(min_dim * 0.04)
    tx = card_x0 + inner_pad
    ty = card_y0 + inner_pad

    badge_font = _load_font(max(16, int(min_dim * 0.022)), bold=True)
    brand_font = _load_font(max(36, int(min_dim * 0.068)), bold=True)
    title_font = _load_font(max(22, int(min_dim * 0.032)), bold=True)
    meta_font = _load_font(max(15, int(min_dim * 0.020)), bold=False)

    # Channel & Aspect Pill
    badge_text = f"{platform.upper().replace('_', ' ')}  •  {aspect_ratio}  •  AGENT PIXELATE"
    draw.text((tx, ty), badge_text, fill=(*c_accent, 255), font=badge_font)
    ty += int(min_dim * 0.055)

    # Brand Name
    draw.text((tx, ty), brand_name[:28], fill=(*c_light, 255), font=brand_font)
    ty += int(min_dim * 0.095)

    # Concept Title (wrapped cleanly)
    max_chars = max(18, int((card_x1 - card_x0 - 2 * inner_pad) / max(10, min_dim * 0.017)))
    wrapped_title = textwrap.wrap(title, width=max_chars)[:2]
    for line in wrapped_title:
        draw.text((tx, ty), line, fill=(*c_light, 230), font=title_font)
        ty += int(min_dim * 0.046)

    ty += int(min_dim * 0.018)
    subtitle_src = lighting_notes or visual_metaphor
    wrapped_sub = textwrap.wrap(subtitle_src, width=int(max_chars * 1.4))[:2]
    for line in wrapped_sub:
        draw.text((tx, ty), line, fill=(*c_light, 175), font=meta_font)
        ty += int(min_dim * 0.032)

    # 5-Hex Color Swatch Strip at the bottom of the card
    swatch_size = max(20, int(min_dim * 0.028))
    swatch_y = card_y1 - inner_pad - swatch_size
    swatch_x = tx
    for hex_tok in palette[:5]:
        rgb = _hex_to_rgb(hex_tok)
        draw.rounded_rectangle(
            (swatch_x, swatch_y, swatch_x + swatch_size, swatch_y + swatch_size),
            radius=6,
            fill=(*rgb, 255),
            outline=(*c_light, 150),
            width=1,
        )
        swatch_x += swatch_size + 12

    hex_label = "  ".join(palette[:5])
    draw.text(
        (swatch_x + 6, swatch_y + max(2, swatch_size // 6)),
        hex_label,
        fill=(*c_light, 185),
        font=meta_font,
    )

    final_img = Image.alpha_composite(canvas, overlay).convert("RGB")
    buf = io.BytesIO()
    final_img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


class ImageGenerationService:
    """Unified async image generator supporting Gemini Imagen, OpenAI `gpt-image-1`, Fal.ai, and Studio Fallback."""

    def __init__(self, provider: str | None = None, timeout_s: float = 45.0) -> None:
        self.provider = (
            provider or os.getenv("IMAGE_PROVIDER") or "auto"
        ).strip().lower()
        self.timeout_s = timeout_s

    def _provider_chain(self) -> list[str]:
        if self.provider in {"placeholder", "offline", "mock", "fallback"}:
            return ["placeholder"]
        if self.provider in {"gemini", "imagen"}:
            return ["gemini", "placeholder"]
        if self.provider in {"openai", "gpt-image-1"}:
            return ["openai", "placeholder"]
        if self.provider in {"fal", "fal.ai", "flux"}:
            return ["fal", "placeholder"]
        # auto: try configured live providers in order, always ending with studio placeholder
        chain: list[str] = []
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            chain.append("gemini")
        if os.getenv("OPENAI_API_KEY"):
            chain.append("openai")
        if os.getenv("FAL_KEY"):
            chain.append("fal")
        chain.append("placeholder")
        return chain

    async def generate_image(
        self,
        *,
        campaign_id: str,
        asset_id: str,
        brand_name: str,
        title: str,
        slot: str,
        platform: str,
        aspect_ratio: str,
        width: int,
        height: int,
        prompt: str,
        color_palette: list[str],
        lighting_notes: str,
        visual_metaphor: str,
        assets_dir: Path,
    ) -> GeneratedImageResult:
        """Generate an image via the configured provider, saving locally to `assets_dir`."""
        assets_dir.mkdir(parents=True, exist_ok=True)
        safe_slot = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in slot.lower())
        filename = f"{asset_id}_{safe_slot}.png"
        target_path = assets_dir / filename
        asset_url = f"/api/campaigns/{campaign_id}/assets/{filename}"
        fallback_ref = CURATED_UNSPLASH_FALLBACKS.get(
            slot, CURATED_UNSPLASH_FALLBACKS["instagram_square"]
        )

        for provider_name in self._provider_chain():
            try:
                if provider_name == "gemini":
                    img_bytes = await self._call_gemini_imagen(prompt, aspect_ratio)
                    if img_bytes:
                        await asyncio.to_thread(target_path.write_bytes, img_bytes)
                        return GeneratedImageResult(
                            file_path=target_path,
                            asset_url=asset_url,
                            mime_type="image/png",
                            width=width,
                            height=height,
                            provider_used="gemini_imagen",
                            fallback_reference_url=fallback_ref,
                        )
                elif provider_name == "openai":
                    img_bytes = await self._call_openai_gpt_image(prompt, aspect_ratio)
                    if img_bytes:
                        await asyncio.to_thread(target_path.write_bytes, img_bytes)
                        return GeneratedImageResult(
                            file_path=target_path,
                            asset_url=asset_url,
                            mime_type="image/png",
                            width=width,
                            height=height,
                            provider_used="openai_gpt_image_1",
                            fallback_reference_url=fallback_ref,
                        )
                elif provider_name == "fal":
                    img_bytes = await self._call_fal_flux(prompt, width, height)
                    if img_bytes:
                        await asyncio.to_thread(target_path.write_bytes, img_bytes)
                        return GeneratedImageResult(
                            file_path=target_path,
                            asset_url=asset_url,
                            mime_type="image/png",
                            width=width,
                            height=height,
                            provider_used="fal_flux",
                            fallback_reference_url=fallback_ref,
                        )
                elif provider_name == "placeholder":
                    img_bytes = await asyncio.to_thread(
                        render_studio_placeholder_png,
                        brand_name=brand_name,
                        title=title,
                        slot=slot,
                        platform=platform,
                        aspect_ratio=aspect_ratio,
                        width=width,
                        height=height,
                        color_palette=color_palette,
                        lighting_notes=lighting_notes,
                        visual_metaphor=visual_metaphor,
                    )
                    await asyncio.to_thread(target_path.write_bytes, img_bytes)
                    # If caller specifically requested external curated CDN URLs
                    if os.getenv("IMAGE_FALLBACK_MODE", "local_studio").lower() == "unsplash":
                        return GeneratedImageResult(
                            file_path=target_path,
                            asset_url=fallback_ref,
                            mime_type="image/jpeg",
                            width=width,
                            height=height,
                            provider_used="curated_unsplash_fallback",
                            fallback_reference_url=fallback_ref,
                        )
                    return GeneratedImageResult(
                        file_path=target_path,
                        asset_url=asset_url,
                        mime_type="image/png",
                        width=width,
                        height=height,
                        provider_used="studio_placeholder_png",
                        fallback_reference_url=fallback_ref,
                    )
            except Exception as exc:
                logger.warning(
                    "Image provider %s failed for %s (%s); trying next provider in chain.",
                    provider_name,
                    slot,
                    exc,
                )
                continue

        raise RuntimeError(f"All image providers failed for slot {slot!r}.")

    async def _call_gemini_imagen(self, prompt: str, aspect_ratio: str) -> bytes | None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return None

        supported_aspect = aspect_ratio if aspect_ratio in {"1:1", "16:9", "9:16", "4:3", "3:4"} else "1:1"
        model_name = os.getenv("GEMINI_IMAGE_MODEL", "imagen-3.0-generate-002")

        def _invoke() -> bytes | None:
            from google import genai  # type: ignore[import-not-found]
            from google.genai import types  # type: ignore[import-not-found]

            client = genai.Client(api_key=api_key)
            resp = client.models.generate_images(
                model=model_name,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=supported_aspect,
                    output_mime_type="image/png",
                ),
            )
            generated = getattr(resp, "generated_images", None) or []
            if not generated:
                return None
            image_obj = generated[0].image
            return getattr(image_obj, "image_bytes", None)

        return await asyncio.wait_for(asyncio.to_thread(_invoke), timeout=self.timeout_s)

    async def _call_openai_gpt_image(self, prompt: str, aspect_ratio: str) -> bytes | None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None

        size_map = {
            "16:9": "1536x1024",
            "1:1": "1024x1024",
            "9:16": "1024x1536",
        }
        size = size_map.get(aspect_ratio, "1024x1024")
        model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
        base_url = os.getenv("OPENAI_BASE_URL")

        from openai import AsyncOpenAI

        client_kwargs: dict[str, Any] = {"api_key": api_key, "timeout": self.timeout_s}
        if base_url:
            client_kwargs["base_url"] = base_url
        client = AsyncOpenAI(**client_kwargs)

        try:
            resp = await client.images.generate(
                model=model,
                prompt=prompt[:3800],
                size=size,
                n=1,
            )
            if not resp.data:
                return None
            first = resp.data[0]
            if getattr(first, "b64_json", None):
                return base64.b64decode(first.b64_json)
            if getattr(first, "url", None):
                async with httpx.AsyncClient(timeout=self.timeout_s) as http:
                    dl = await http.get(first.url)
                    dl.raise_for_status()
                    return dl.content
            return None
        finally:
            await client.close()

    async def _call_fal_flux(self, prompt: str, width: int, height: int) -> bytes | None:
        fal_key = os.getenv("FAL_KEY")
        if not fal_key:
            return None

        fal_model = os.getenv("FAL_IMAGE_MODEL", "fal-ai/flux/schnell")
        endpoint = f"https://fal.run/{fal_model.lstrip('/')}"
        headers = {
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "prompt": prompt[:3800],
            "image_size": {"width": width, "height": height},
            "num_images": 1,
            "output_format": "png",
        }
        async with httpx.AsyncClient(timeout=self.timeout_s) as http:
            resp = await http.post(endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            images = data.get("images") or []
            if not images or not images[0].get("url"):
                return None
            img_resp = await http.get(images[0]["url"])
            img_resp.raise_for_status()
            return img_resp.content


__all__ = [
    "CURATED_UNSPLASH_FALLBACKS",
    "GeneratedImageResult",
    "ImageGenerationService",
    "render_studio_placeholder_png",
]
