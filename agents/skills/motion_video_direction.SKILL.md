---
name: motion_video_direction
version: 1.0.0
description: Cinematic motion-graphics and promo video direction rules synthesized from motionmaxxing, bang-motion, and video-shotcraft.
owner: "@visual_pixelate"
---

# Motion & Promo Video Direction Skill

## Core Craft Laws
1. **One Continuous World (from `bang-motion`):** Never render videos as disconnected PowerPoint slides. Maintain one continuous studio camera space, persistent lighting world, and a central product/brand motif that evolves across beats.
2. **Measured Easing Curves (from `motionmaxxing`):** Avoid linear easing (`ease 0.0`). Use calibrated curves:
   - `softLand`: Decelerated editorial arrival (`1 - (1 - t)^4`)
   - `snapSettle`: Fast kinetic entrance with subtle overshoot settle
   - `whipPush`: High-energy S-curve camera transition
3. **Shot Recipes & Beat Sync (from `video-shotcraft`):**
   - Structure 10–15s promos into 4 rhythmic beats: Hook (`0–2.6s`) → Craft Reveal (`2.6–5.3s`) → Audience & Palette Proof (`5.3–7.8s`) → Monolith CTA Lockup (`7.8–10.0s`).
   - Pair visual transitions with synchronized sonic hits and ambient underscore.
4. **Multi-Format Delivery:** Support both `16:9` widescreen cinema (LinkedIn / YouTube / Web) and `9:16` vertical Reels/Shorts (Instagram / TikTok / Meta Ads) in web-ready H.264 `yuv420p` `+faststart` MP4.
