---
name: social-platform-formatter
version: "1.0.0"
displayName: "Multi-Channel Social & Ad Platform Formatter"
description: >-
  Domain skill specifying native formatting, character limits, visual-hook pacing,
  hashtag strategy, and CTA ergonomics for Instagram, LinkedIn, X/Twitter, Web Hero
  Banners, and Paid Social Ads so every PlatformCopy artifact is publish-ready.
author: "Agent Pixelate Team"
license: "MIT"
category: "marketing-social-distribution"
provider: "finchtech.ai"
compatibility:
  - adal-agent-harness
  - adalflow
  - finch-agent-cli
  - agent-pixelate
triggers:
  - social_platform_formatting
  - instagram_caption_structure
  - linkedin_post_formatting
  - paid_ad_formatting
  - hashtag_optimization
inputs:
  - platform_list
  - draft_messaging
  - visual_assets
  - brand_tone
outputs:
  - formatted_platform_copies
  - asset_to_copy_bindings
  - optimized_hashtags
metadata:
  access: public
  pricing: free
  schema_standard: "finch-skill-v1"
---

# Social Platform Formatter Skill (`social_platform_formatter`)

## Purpose
Ensure every `PlatformCopy` item emitted by `@copy_pixelate` conforms strictly to
platform-native reading behavior, character envelopes, hashtag norms, and paired
`VisualAsset.asset_id` aspect ratios.

---

## 1. Platform Formatting Specifications

### Instagram (`instagram` & `instagram_story`)
- **Paired Visual:** `1:1` Feed Square or `9:16` Story/Reel Vertical.
- **Headline / Hook Line:** Punchy 1-line visual opener (≤ 90 chars) visible above the `...more` fold.
- **Body Structure:**
  - Line 1: Pattern-interrupt hook directly referencing the image's visual vibe.
  - Blank line.
  - 2–3 rhythmic micro-paragraphs (1–2 sentences each) with clean spacing for mobile thumb scanning.
  - Optional 1–3 tasteful emojis aligned to `brand_tone` (zero emoji clutter for luxury/minimal brands).
  - Closing conversational prompt or link-in-bio CTA.
- **Hashtags:** `5–8` targeted hashtags mixing: 1 branded tag (`#BrandName`), 2–3 niche community tags, 2–3 category/intent tags. Always prefixed with `#` and CamelCase for accessibility.

### LinkedIn (`linkedin`)
- **Paired Visual:** `16:9` Hero Banner or `1:1` Square visual card.
- **Hook:** First 2 lines (≤ 180 chars) establish an insight, contrarian POV, or sharp builder story before the fold.
- **Body Structure:**
  - Editorial, high-signal tone — zero fluff or hashtag stuffing.
  - Short 1–2 line scannable paragraphs + 3 crisp bullet takeaways (`→` or `•`).
  - Connect product craft, design philosophy, or market shift to `target_audience` outcomes.
  - End with a thoughtful CTA or discussion prompt.
- **Hashtags:** `3–5` authoritative industry/category hashtags only.

### Paid Social / Conversion Ad (`paid_ad`)
- **Paired Visual:** Highest-contrast `1:1` or `16:9` hero asset.
- **Headline:** ≤ 40 characters (optimized to avoid truncation in Meta/LinkedIn/Google feed cards).
- **Subheadline:** ≤ 90 characters (link description / trust proof line).
- **Body Copy (Primary Text):** Structured strictly with **PAS** or **AIDA**; first 125 chars carry the complete hook; 2–3 crisp benefit beats; unmistakable offer + CTA.
- **Call to Action:** 2–4 word button label (`Shop Now`, `Claim Launch Pack`, `Try It Free`).
- **Hashtags:** `0–2` clean brand/campaign tags max (paid ads convert better without hashtag clutter).

### X / Twitter (`x`)
- **Paired Visual:** `16:9` Hero Banner.
- **Body Length:** Strictly ≤ 260 characters (leaving room for link/media card).
- **Voice:** Sharp, high-contrast, quotable, zero corporate jargon.
- **Hashtags:** `1–2` max (or `0` when a raw punchy one-liner converts stronger).

### Web Hero Banner (`web_banner`)
- **Paired Visual:** `16:9` Hero Banner (designed with left-third negative space).
- **Headline:** 3–7 ultra-crisp words (`≤ 55 chars`).
- **Subheadline:** 1 clean value-prop sentence (`≤ 130 chars`).
- **Body Copy:** Concise 2-sentence hero supporting copy + 3 micro-trust badges.
- **Call to Action:** Primary button label (2–4 words).
- **Hashtags:** `0–1` campaign tag.

---

## 2. Asset-to-Copy Pairing Matrix
Every `PlatformCopy` MUST bind `linked_asset_id` to the most aspect-appropriate `VisualAsset`:
- `web_banner`, `linkedin`, `x` → Hero Banner (`16:9`)
- `instagram`, `paid_ad` → Instagram Feed Square (`1:1`)
- `instagram_story`, `tiktok`, `reels` → Story / Reel Vertical (`9:16`)

---

## 3. Pre-Output Validation Checklist
1. Every requested platform plus core channels (`instagram`, `linkedin`, `paid_ad`) has a dedicated, non-duplicate `PlatformCopy` entry.
2. All `headline` fields ≤ 240 chars (and ≤ 60 chars for ads/hero banners), `call_to_action` ≤ 160 chars, `body_copy` ≤ 4000 chars.
3. Every hashtag starts with `#`, contains no spaces, and respects platform count caps.
4. No copy block is an identical copy-paste of another platform — tone, cadence, and structure adapt visibly per channel.
