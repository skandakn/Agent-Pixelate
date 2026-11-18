---
name: ad-copy-conversion
version: "1.0.0"
displayName: "High-Converting Ad Copy & Persuasion Frameworks"
description: >-
  Domain skill for writing high-converting headlines, subheadlines, value propositions,
  paid ad primary text, email subject lines, and CTAs using AIDA and PAS persuasion
  frameworks while explicitly mirroring visual motifs, lighting, and color mood
  supplied by the Visual Agent.
author: "Agent Pixelate Team"
license: "MIT"
category: "marketing-copywriting"
provider: "finchtech.ai"
compatibility:
  - adal-agent-harness
  - adalflow
  - finch-agent-cli
  - agent-pixelate
triggers:
  - campaign_copywriting
  - conversion_ad_copy
  - visual_to_copy_handoff
  - aida_pas_messaging
inputs:
  - campaign_request
  - visual_output
  - brand_visual_brief
outputs:
  - campaign_tagline
  - brand_voice_summary
  - key_messages
  - headlines_and_ctas
  - paid_ad_copy
  - email_subject_lines
metadata:
  access: public
  pricing: free
  schema_standard: "finch-skill-v1"
---

# High-Converting Ad Copy Skill (`ad_copy_conversion`)

## Purpose
Guide `@copy_pixelate` to transform a structured `VisualOutput` handoff and
`CampaignRequest` into sharp, conversion-engineered campaign messaging where every
line feels designed *with* the visual artwork rather than bolted on afterward.

---

## 1. Visual-to-Copy Alignment Mandate (BAND Handoff Rule)
Before drafting any headline or caption, inspect the Visual Agent's handoff payload:
- **`creative_direction`:** Identify the central visual metaphor, physical textures, and focal action.
- **`color_palette` & `mood_keywords`:** Translate color temperature and mood into sensory word choices (e.g., electric cyan/neon → *crisp, charged, midnight clarity*; warm amber/terracotta → *sun-drenched, grounded, unhurried*).
- **`typography_direction`:** Match sentence cadence to typography weight (bold condensed display type demands ultra-tight 3–6 word punchy headlines; editorial serif pairs with lyrical contrast).
- **Rule:** At least one phrase in the campaign tagline, hero headline, or body copy for each asset **MUST** echo a concrete visual cue (lighting, atmosphere, texture, or storyboard beat) so visual + copy form a unified creative object.

---

## 2. Persuasion Frameworks (AIDA & PAS)

### Framework A: AIDA (Best for Hero Banners, Product Launches, Instagram)
1. **Attention:** Stop-scroll opening hook (≤ 8 words) leveraging contrast, curiosity, or sensory vividness.
2. **Interest:** Concrete differentiator tied directly to the product mechanism (not vague hype).
3. **Desire:** Paint the "after" identity state for the `target_audience` using tactile outcomes.
4. **Action:** Low-friction, verb-led Call to Action (`Taste the Spark`, `Claim Launch Drop`, `Build Faster Today`).

### Framework B: PAS (Best for Paid Social Ads, LinkedIn, Email Hooks)
1. **Problem:** Call out the exact daily friction felt by `target_audience` with sharp specificity.
2. **Agitate:** Show the hidden cost of settling for outdated/cluttered alternatives.
3. **Solution:** Introduce `brand_name` as the unmistakable breakthrough, backed by a concrete proof point and clear CTA.

---

## 3. Headline & Subheadline Engineering Rules
- **Hero Headlines:** 3–8 words max; front-load the strongest verb or contrast word; eliminate weak fillers (*"Welcome to"*, *"Introducing the all-new"*, *"The best solution for"*).
- **Subheadlines:** 10–22 words; clarify *what it is* + *who it is for* + *why it wins now*.
- **Campaign Tagline:** Memorable rhythmic 3–6 word anchor (alliteration, antithesis, or crisp cadence) that works equally well on a billboard and a 15s video end-card.

---

## 4. Paid Ad Primary Text & CTA Rules
- **Hook Line (First 125 chars):** Must stand alone before the *"See more"* fold. Lead with a bold claim, sharp question, or visceral contrast.
- **Value Stack:** 2–3 tight proof bullets or micro-sentences emphasizing tangible outcomes.
- **Urgency / Social Proof Cue:** Launch edition, creator-loved, zero-compromise guarantee.
- **CTA Button Copy:** 2–4 action words max; pair benefit + action (`Shop Launch Drop`, `Start Free Trial`, `Unlock Early Access`). Never use generic `"Click Here"` or `"Submit"`.

---

## 5. Email Subject Line Craft (3–5 Variations)
Provide a balanced conversion mix:
1. **Curiosity / Pattern Interrupt** (≤ 45 chars)
2. **Direct Benefit + Specificity** (≤ 50 chars)
3. **Visual / Sensory Mood Teaser** (≤ 48 chars)
4. **Launch Urgency / Social Proof** (≤ 50 chars)

---

## 6. Anti-Cliché Quality Gate
Reject and rewrite any copy containing empty AI clichés:
- *Banned phrases:* "elevate your game", "game-changer", "unleash the power", "in today's fast-paced world", "seamlessly", "revolutionary synergy", "delve into".
- *Replacement standard:* Replace abstractions with crisp nouns, sensory verbs, and measurable or vivid user outcomes.
