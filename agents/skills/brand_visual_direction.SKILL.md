---
name: brand-visual-direction
version: "1.0.0"
displayName: "Brand Visual Direction & Art Systems"
description: >-
  Domain skill for crafting cohesive brand visual concepts, 5-hex color palettes,
  editorial lighting and composition rules, multi-aspect image generation prompts
  (Hero Banner 16:9, Instagram Square 1:1, Story/Reel Vertical 9:16), and
  3-scene promotional video storyboards with camera motion cues.
author: "Agent Pixelate Team"
license: "MIT"
category: "marketing-creative-direction"
provider: "finchtech.ai"
compatibility:
  - adal-agent-harness
  - adalflow
  - finch-agent-cli
  - agent-pixelate
triggers:
  - visual_campaign_concept
  - brand_art_direction
  - image_prompt_engineering
  - video_storyboard_scripting
inputs:
  - brand_name
  - product_description
  - target_audience
  - brand_tone
  - color_palette_hints
  - platforms
outputs:
  - creative_direction
  - color_palette_5hex
  - typography_direction
  - mood_keywords
  - tailored_image_prompts
  - three_scene_video_storyboard
metadata:
  access: public
  pricing: free
  schema_standard: "finch-skill-v1"
---

# Brand Visual Direction Skill (`brand_visual_direction`)

## Purpose
Equip `@visual_pixelate` with repeatable, studio-grade art direction rules so every
generated campaign exhibits cohesive color harmony, deliberate lighting physics,
intentional composition, crisp typographic hierarchy, and platform-native framing.

---

## 1. Color Theory & 5-Hex Palette Architecture
Every visual concept **MUST** produce exactly **5 validated `#RRGGBB` hex tokens**
mapped to explicit functional roles:

1. **Primary Brand Anchor (`#HEX1`)** — Dominant emotional signature (60% visual weight in hero spaces or packaging accents).
2. **Deep Structural Contrast (`#HEX2`)** — Dark obsidian, midnight, or rich espresso tone guaranteeing ≥ 7:1 WCAG AAA contrast behind headlines.
3. **High-Energy Accent (`#HEX3`)** — Complementary or split-complementary focal spark used for CTAs, rim lighting, and product glow (10% weight).
4. **Atmospheric Surface / Midtone (`#HEX4`)** — Gradient backdrop, studio sweep, or tactile surface material (30% weight).
5. **Luminous Highlight / Neutral (`#HEX5`)** — Specular sheen, clean negative space, or crisp editorial typography foreground.

### Palette Harmony Rules
- If the requester supplies `color_palette` hints, preserve valid hex codes as anchors and complete the remaining slots using **split-complementary** or **analogous + high-contrast accent** harmony.
- Avoid muddy mid-gray saturation traps: pair at least one high-chroma accent (`S >= 65%`) with one deep anchor (`L <= 18%`) and one luminous highlight (`L >= 88%`).
- Every color token must be referenced explicitly inside the image prompts and visual brief so `@copy_pixelate` can echo the color mood verbally.

---

## 2. Lighting & Atmospheric Physics
Select and declare a deliberate lighting schema aligned to `brand_tone`:

| Brand Tone Archetype | Recommended Lighting Setup | Surface & Lens Cues |
| :--- | :--- | :--- |
| **Bold / Playful / Disruptive** | Hard sculpted key light + dual-gel cyan/coral rim lights | Crisp shadows, glossy acrylic reflections, 35mm wide dynamic angle |
| **Luxury / Editorial / Minimal** | Soft diffused overhead scrim + warm golden bounce fill | Brushed travertine or matte anodized metal, 85mm f/1.8 shallow DOF |
| **Tech / Futuristic / Performance** | Volumetric studio haze + precision neon edge-lighting | Glass refraction, dark carbon surface, anamorphic horizontal flare |
| **Organic / Wellness / Calm** | Dappled golden-hour window light + botanical shadow gobos | Linen, ceramic, condensation droplets, 50mm natural bokeh |

### Lighting Checklist
- Specify **key light direction** (e.g., 45° camera-left softbox), **rim/back separation light**, and **ambient color temperature** (e.g., 3200K warm amber vs. 5600K daylight).
- Never use generic filler phrases like "good lighting" or "nice photo"; describe concrete physical optics (caustics, subsurface scattering, micro-condensation, specular rim).

---

## 3. Composition & Multi-Aspect Framing Rules
Generate **3 distinct, aspect-ratio-native image prompts** tailored to channel ergonomics:

1. **Hero Banner (`web_banner`, `16:9`, `1600x900`)**
   - **Rule of Thirds Negative Space:** Place the hero product on the right third (`65%` horizontal axis) so the left third remains a clean, low-frequency tonal gradient for UI headlines and CTA buttons.
   - **Depth Layers:** Foreground subtle bokeh prop → razor-sharp hero product → sculpted architectural/environmental background.
2. **Instagram Feed Square (`instagram`, `1:1`, `1080x1080`)**
   - **Thumb-Stopper Center Gravity:** Centered or slight diagonal hero placement with bold color-blocking and tactile close-up textures that remain legible at mobile thumbnail scale.
   - **Visual Hook:** Include a dynamic motion freeze cue (splash, floating particles, light trail, or geometric shadow slice) to halt scroll velocity within 0.4 seconds.
3. **Story / Reel Vertical (`instagram_story`, `9:16`, `1080x1920`)**
   - **Safe-Zone Discipline:** Keep critical focal subject inside the center `60%` vertical band (top 14% clear for profile chrome, bottom 20% clear for swipe-up / CTA sticker).
   - **Vertical Leading Lines:** Use ascending light beams, tall architectural framing, or stacked motion depth to pull the eye downward toward the CTA zone.

### Prompt Engineering Guardrails
- Keep each image prompt self-contained: `[Subject & Hero Action] + [Environment & Materiality] + [Exact Lighting Physics] + [Camera/Lens & Framing] + [5-Hex Color Integration] + [Clean Negative-Space Directive]`.
- Exclude embedded gibberish text inside generated imagery (`no garbled text, no watermarks, clean editorial negative space for typography overlay`).

---

## 4. Typography & Graphic System Direction
Specify a concrete typographic pairing that matches the visual aesthetic:
- **Display Face:** High-character geometric grotesque, condensed brutalist sans, or high-contrast editorial serif for headlines.
- **Body / UI Face:** Clean neo-grotesque or humanist sans optimized for small mobile legibility.
- **Hierarchy Spec:** Display tracking, weight contrast (e.g., `800 ExtraBold` headlines vs. `400 Regular` captions), and motion treatment (e.g., kinetic masked slide-up).

---

## 5. Three-Scene Promotional Video Storyboard (15s Social Cut)
Every campaign visual brief **MUST** include a 3-scene storyboard with explicit camera motion cues:

1. **Scene 1 — Visual Hook (`0.0s – 3.0s`)**
   - **Goal:** Pattern interrupt in the first 1.5 seconds.
   - **Camera Cue:** e.g., `Whip-pan snap into extreme macro dolly-in (120fps slow-motion reveal)`.
   - **Elements:** Tactile close-up, high-contrast color flash, punchy 3–5 word on-screen super, crisp SFX hit.
2. **Scene 2 — Feature & Lifestyle Proof (`3.0s – 10.0s`)**
   - **Goal:** Demonstrate core product transformation in target audience context.
   - **Camera Cue:** e.g., `Smooth 180-degree orbital gimbal arc transitioning to match-cut lifestyle pull-back`.
   - **Elements:** Product in authentic use, ambient lighting shift matching accent hex, 2 short benefit callouts.
3. **Scene 3 — Hero Lockup & Conversion CTA (`10.0s – 15.0s`)**
   - **Goal:** Brand recall + unmistakable action trigger.
   - **Camera Cue:** e.g., `Slow dramatic crane-out push to symmetrical studio hero table lockup`.
   - **Elements:** Full product silhouette bathed in rim light, brand tagline lockup, CTA badge, musical resolve.

---

## 6. Handoff Contract to `@copy_pixelate`
Format `visual_brief_markdown` so the Copy Agent can immediately extract:
- Core visual metaphor & focal motifs
- Named 5-hex palette + emotional color cues
- Lighting atmosphere & sensory textures
- Typography energy
- Scene-by-scene storyboard beats & asset IDs for copy-to-asset pairing
