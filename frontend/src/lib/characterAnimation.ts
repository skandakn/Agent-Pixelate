/**
 * Character Animation & Viseme Lip-Sync Engine
 * Inspired by bytedance/LatentSync, Vincentwei1021/video-talkcraft, and theatre-js
 *
 * Provides real-time procedural avatar generation, eye-blinking cycles,
 * sound-reactive lip visemes, dynamic gesture poses, and typewriter speech bubbles.
 */

import { CharacterAvatarConfig, CharacterAvatarId, CharacterPosition } from "@/types/campaign";

export const CHARACTER_AVATARS: Record<CharacterAvatarId, CharacterAvatarConfig> = {
  maya: {
    id: "maya",
    name: "Maya // AI Tech Host",
    role: "YouTube Hardware & Tech Reviewer",
    tagline: "Ultra-crisp technical breakdowns & HUD diagnostics",
    themeColor: "#06B6D4", // Cyan
    accentBadge: "NEURAL HOST v2.4",
  },
  leo: {
    id: "leo",
    name: "Leo // YouTube Creator",
    role: "Dynamic Unboxing & Lifestyle Presenter",
    tagline: "High-energy creator commentary with punchy pacing",
    themeColor: "#10B981", // Emerald
    accentBadge: "STUDIO CREATOR",
  },
  aria: {
    id: "aria",
    name: "Aria // Luxury Ambassador",
    role: "Editorial Fashion & High-Design Voice",
    tagline: "Sophisticated minimalism with restrained elegance",
    themeColor: "#F59E0B", // Gold/Amber
    accentBadge: "HAUTE DIRECTION",
  },
  pixel: {
    id: "pixel",
    name: "Pixel // 8-Bit Spokesbot",
    role: "Retro Mascot & Brand Sidekick",
    tagline: "Playful chiptune enthusiasm & energetic callouts",
    themeColor: "#EC4899", // Neon Pink
    accentBadge: "RETRO BOT // 60FPS",
  },
};

export type VisemeMouthState = "rest" | "open_a" | "round_o" | "wide_e" | "smile";

export interface CharacterRenderState {
  timeMs: number;
  isSpeaking: boolean;
  audioEnergy: number; // 0.0 to 1.0 (from TTS or simulated audio)
  currentPhrase: string;
  avatarId: CharacterAvatarId;
  position: CharacterPosition;
}

/**
 * Calculates current viseme based on elapsed time and voice activity.
 */
export function computeViseme(timeMs: number, isSpeaking: boolean, audioEnergy = 0.5): VisemeMouthState {
  if (!isSpeaking) {
    // Subtle breathing rest mouth
    return Math.sin(timeMs * 0.003) > 0.85 ? "smile" : "rest";
  }

  // Cycles through speech shapes influenced by audio energy
  const cycle = (timeMs * 0.012 * (0.8 + audioEnergy * 0.5)) % 4;
  if (cycle < 1.0) return "open_a";
  if (cycle < 2.0) return "round_o";
  if (cycle < 3.0) return "wide_e";
  return "smile";
}

/**
 * Calculates eye blink ratio (0 = fully open, 1 = fully closed).
 */
export function computeBlinkRatio(timeMs: number): number {
  const blinkCycle = timeMs % 3600;
  if (blinkCycle < 180) {
    // Smooth blink in and out
    return Math.sin((blinkCycle / 180) * Math.PI);
  }
  return 0;
}

/**
 * Draws procedural character avatar into an HTML5 Canvas context.
 */
export function drawCharacterAvatar(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  state: CharacterRenderState
): void {
  const { x, y, width, height } = bounds;
  const config = CHARACTER_AVATARS[state.avatarId] || CHARACTER_AVATARS.maya;
  const blink = computeBlinkRatio(state.timeMs);
  const viseme = computeViseme(state.timeMs, state.isSpeaking, state.audioEnergy);

  ctx.save();

  // Avatar Container Card (YouTube PiP Glassmorphism Frame)
  ctx.fillStyle = "rgba(10, 13, 20, 0.88)";
  ctx.strokeStyle = config.themeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 14);
  ctx.fill();
  ctx.stroke();

  // Subtle pulsing soundstage glow behind head
  const headCenterX = x + width * 0.32;
  const headCenterY = y + height * 0.54;
  const headRadius = height * 0.32;

  if (state.isSpeaking) {
    const pulseRadius = headRadius * (1.1 + Math.sin(state.timeMs * 0.01) * 0.12 * state.audioEnergy);
    const glow = ctx.createRadialGradient(
      headCenterX,
      headCenterY,
      headRadius * 0.4,
      headCenterX,
      headCenterY,
      pulseRadius
    );
    glow.addColorStop(0, config.themeColor + "33");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Avatar Archetype Head & Features
  if (state.avatarId === "pixel") {
    drawPixelBot(ctx, headCenterX, headCenterY, headRadius, blink, viseme, state.timeMs);
  } else if (state.avatarId === "leo") {
    drawCreatorLeo(ctx, headCenterX, headCenterY, headRadius, blink, viseme, state.timeMs, config.themeColor);
  } else if (state.avatarId === "aria") {
    drawLuxuryAria(ctx, headCenterX, headCenterY, headRadius, blink, viseme, state.timeMs, config.themeColor);
  } else {
    // Maya // AI Tech Host
    drawTechMaya(ctx, headCenterX, headCenterY, headRadius, blink, viseme, state.timeMs, config.themeColor);
  }

  // Header Pill / Host Tagline
  ctx.fillStyle = config.themeColor;
  ctx.fillRect(x + 12, y + 10, 6, 12);
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(config.name.toUpperCase(), x + 24, y + 20);

  // Live Audio Activity Indicator / VU dots
  if (state.isSpeaking) {
    const vuX = x + width - 42;
    const vuY = y + 15;
    for (let i = 0; i < 4; i++) {
      const barH = 4 + Math.abs(Math.sin(state.timeMs * 0.015 + i * 0.8)) * 10 * state.audioEnergy;
      ctx.fillStyle = config.themeColor;
      ctx.fillRect(vuX + i * 7, vuY - barH / 2, 4, barH);
    }
  }

  // Speech Dialogue / Thought Bubble
  if (state.isSpeaking && state.currentPhrase) {
    const bubbleX = x + width * 0.58;
    const bubbleY = y + 36;
    const bubbleW = width * 0.38;
    const bubbleH = height - 48;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 8);
    ctx.fill();
    ctx.stroke();

    // Typewriter or wrapped caption text
    ctx.font = "500 11px 'Hanken Grotesk', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    const snippet = state.currentPhrase.length > 55 ? state.currentPhrase.slice(0, 52) + "…" : state.currentPhrase;
    wrapTextLines(ctx, snippet, bubbleX + 8, bubbleY + 16, bubbleW - 16, 14);
  }

  ctx.restore();
}

/**
 * Maya — Futuristic Cybernetic Host
 */
function drawTechMaya(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  blink: number,
  viseme: VisemeMouthState,
  timeMs: number,
  accent: string
): void {
  // Head base
  ctx.fillStyle = "#F5D0C5"; // Warm skin
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.8, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cybernetic Bob Hair
  ctx.fillStyle = "#1E293B";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.1, r * 0.88, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();

  // Neon Hair Bangs
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.6);
  ctx.lineTo(cx - r * 0.1, cy - r * 0.3);
  ctx.lineTo(cx + r * 0.4, cy - r * 0.55);
  ctx.stroke();

  // Holographic Visor / Glasses
  ctx.fillStyle = "rgba(6, 182, 212, 0.45)";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const visorW = r * 1.1;
  const visorH = r * 0.26;
  ctx.beginPath();
  ctx.roundRect(cx - visorW / 2, cy - r * 0.25, visorW, visorH, 4);
  ctx.fill();
  ctx.stroke();

  // Visor Scanline Sweep
  const sweep = ((timeMs * 0.08) % visorW) - visorW / 2;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + sweep, cy - r * 0.25);
  ctx.lineTo(cx + sweep + 6, cy - r * 0.25 + visorH);
  ctx.stroke();

  // Eyes through visor
  if (blink < 0.8) {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.12, 3, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.3, cy - r * 0.12, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animated Mouth / Viseme
  drawVisemeMouth(ctx, cx, cy + r * 0.4, r * 0.22, viseme, "#991B1B");
}

/**
 * Leo — YouTube Video Creator Host
 */
function drawCreatorLeo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  blink: number,
  viseme: VisemeMouthState,
  timeMs: number,
  accent: string
): void {
  // Head
  ctx.fillStyle = "#ECC695";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Messy Studio Hair
  ctx.fillStyle = "#3E2723";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r * 0.88, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();

  // Studio Headphones Band & Cans
  ctx.strokeStyle = "#1F2937";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.1, r * 0.95, Math.PI, 0);
  ctx.stroke();

  // Headphone ear cups with accent ring
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.95, cy - r * 0.2, r * 0.2, r * 0.45, 6);
  ctx.roundRect(cx + r * 0.75, cy - r * 0.2, r * 0.2, r * 0.45, 6);
  ctx.fill();
  ctx.stroke();

  // Eyes & Eyebrows (Dynamic expression)
  if (blink < 0.7) {
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(cx - r * 0.26, cy - r * 0.05, 4, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.26, cy - r * 0.05, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = "#3E2723";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.22);
    ctx.lineTo(cx - r * 0.15, cy - r * 0.25);
    ctx.moveTo(cx + r * 0.15, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.4, cy - r * 0.22);
    ctx.stroke();
  }

  // Microphone boom
  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy);
  ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.35, cx - r * 0.1, cy + r * 0.35);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx - r * 0.1, cy + r * 0.35, 4, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  drawVisemeMouth(ctx, cx, cy + r * 0.38, r * 0.25, viseme, "#881337");
}

/**
 * Aria — Luxury Brand Ambassador
 */
function drawLuxuryAria(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  blink: number,
  viseme: VisemeMouthState,
  timeMs: number,
  accent: string
): void {
  // Face contour
  ctx.fillStyle = "#FDE68A";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.75, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sleek black high-fashion parted hair
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.25, r * 0.88, Math.PI * 0.7, Math.PI * 2.3);
  ctx.fill();

  // Gold Earring drop
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.75, cy + r * 0.15);
  ctx.lineTo(cx - r * 0.75, cy + r * 0.5);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx - r * 0.75, cy + r * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Almond Eyes
  if (blink < 0.75) {
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.1, 7, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.25, cy - r * 0.1, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#451A03";
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.1, 3, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.25, cy - r * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red Wine Lipstick Viseme Mouth
  drawVisemeMouth(ctx, cx, cy + r * 0.42, r * 0.22, viseme, "#BE123C");
}

/**
 * Pixel — 8-Bit Retro Bot
 */
function drawPixelBot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  blink: number,
  viseme: VisemeMouthState,
  timeMs: number
): void {
  const s = Math.round(r * 1.5);
  const left = cx - s / 2;
  const top = cy - s / 2;

  // Bot chassis
  ctx.fillStyle = "#1E1E2E";
  ctx.strokeStyle = "#EC4899";
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, s, s);
  ctx.fillRect(left, top, s, s);

  // Antenna with blinking LED
  ctx.strokeStyle = "#EC4899";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top - 18);
  ctx.stroke();
  ctx.fillStyle = Math.sin(timeMs * 0.01) > 0 ? "#F43F5E" : "#FFE4E6";
  ctx.beginPath();
  ctx.arc(cx, top - 18, 5, 0, Math.PI * 2);
  ctx.fill();

  // Green CRT Terminal Screen
  ctx.fillStyle = "#064E3B";
  ctx.fillRect(left + 8, top + 10, s - 16, s - 20);

  // Pixel Eyes
  ctx.fillStyle = blink > 0.7 ? "#064E3B" : "#34D399";
  const eyeSize = 8;
  ctx.fillRect(cx - 20, cy - 8, eyeSize, eyeSize);
  ctx.fillRect(cx + 12, cy - 8, eyeSize, eyeSize);

  // Pixel Mouth / Audio VU line
  ctx.fillStyle = "#34D399";
  if (viseme === "open_a" || viseme === "round_o") {
    ctx.fillRect(cx - 14, cy + 12, 28, 8);
  } else if (viseme === "wide_e") {
    ctx.fillRect(cx - 18, cy + 14, 36, 4);
  } else {
    ctx.fillRect(cx - 10, cy + 15, 20, 3);
  }
}

/**
 * Procedural mouth rendering based on phoneme viseme shapes
 */
function drawVisemeMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  viseme: VisemeMouthState,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (viseme) {
    case "open_a":
      // Open oval mouth
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 0.75, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tooth hint
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - radius * 0.4, y - radius * 0.5, radius * 0.8, 3);
      break;

    case "round_o":
      // Round 'O' mouth
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "wide_e":
      // Wide teeth grin
      ctx.beginPath();
      ctx.roundRect(x - radius * 0.85, y - 3, radius * 1.7, 7, 3);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - radius * 0.6, y - 2, radius * 1.2, 3);
      break;

    case "smile":
      // Gentle upturned smile curve
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y - 4, radius * 0.75, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;

    case "rest":
    default:
      // Neutral resting line
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.6, y);
      ctx.lineTo(x + radius * 0.6, y);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

/**
 * Helper to wrap text cleanly in canvas speech bubbles
 */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
