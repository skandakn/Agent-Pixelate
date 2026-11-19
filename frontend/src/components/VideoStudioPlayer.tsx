"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Film,
  Loader2,
  Mic,
  Monitor,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Smartphone,
  Sparkles,
  Square,
  Volume2,
  Wand2,
} from "lucide-react";
import {
  CampaignBrief,
  CampaignVideoAsset,
  ColorSwatch,
  VideoAspectRatio,
  VideoShotStyle,
} from "@/types/campaign";
import { cn, slugify } from "@/lib/utils";

const SHOT_RECIPES: {
  id: VideoShotStyle;
  label: string;
  curve: string;
  tag: string;
}[] = [
  {
    id: "obsidian_cinema",
    label: "Obsidian Cinema",
    curve: "softLand · 24fps",
    tag: "bang-motion",
  },
  {
    id: "kinetic_type",
    label: "Kinetic Type",
    curve: "snapSettle · -0.045em",
    tag: "motionmaxxing",
  },
  {
    id: "luxury_editorial",
    label: "Luxury Editorial",
    curve: "velvetDrift · Gold",
    tag: "lemo-opuscar",
  },
  {
    id: "pulse_drop",
    label: "Pulse Drop",
    curve: "whipPush · 124 BPM",
    tag: "video-shotcraft",
  },
  {
    id: "vox_collage",
    label: "Vox Collage",
    curve: "halftone · Cutout",
    tag: "vox-director",
  },
  {
    id: "ink_press",
    label: "Ink Press",
    curve: "pressStamp · Swiss",
    tag: "video-shotcraft",
  },
];

const DIRECTOR_BEATS = [
  { beat: "01", window: "0.0–2.0s", label: "Hook Wipe", move: "Masked baseline reveal" },
  { beat: "02", window: "2.0–4.2s", label: "Visual Proof", move: "Ken Burns 1.0→1.14x" },
  { beat: "03", window: "4.2–6.2s", label: "Brand World", move: "Palette swatch rail" },
  { beat: "04", window: "6.2–8.0s", label: "CTA Lockup", move: "Beat-synced pulse" },
];

const VOICEOVER_PRESETS: {
  id: "auto" | "zira" | "david";
  label: string;
  tag: string;
  desc: string;
}[] = [
  {
    id: "auto",
    label: "Adaptive Auto",
    tag: "Tone Matched",
    desc: "Auto-selects female/male vocal timbre tailored to brand tone",
  },
  {
    id: "zira",
    label: "Aria / Zira",
    tag: "Warm Studio",
    desc: "Nuanced, editorial, conversational female studio voice",
  },
  {
    id: "david",
    label: "David / Marcus",
    tag: "Cinematic Executive",
    desc: "Resonant, authoritative, high-energy male narrator",
  },
];

interface VideoStudioPlayerProps {
  campaignId: string | null;
  brief: CampaignBrief;
  palette: ColorSwatch[];
  videos: CampaignVideoAsset[];
  isLiveBackend: boolean;
  isRenderingCut: boolean;
  renderError: string | null;
  onRenderCustomCut: (
    aspectRatio: VideoAspectRatio,
    shotStyle: VideoShotStyle,
    voiceoverOptions?: {
      enableVoiceover?: boolean;
      voice?: string;
      voiceoverScript?: string;
    }
  ) => void;
}

function easeSoftLand(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 4);
}

function easeSnapSettle(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const c1 = 1.15;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

export function VideoStudioPlayer({
  campaignId,
  brief,
  palette,
  videos,
  isLiveBackend,
  isRenderingCut,
  renderError,
  onRenderCustomCut,
}: VideoStudioPlayerProps) {
  const [selectedVideoIdx, setSelectedVideoIdx] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [shotStyle, setShotStyle] = useState<VideoShotStyle>("obsidian_cinema");

  // Client-side 60fps canvas fallback (for Mock Mode or instant local preview)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasPlaying, setCanvasPlaying] = useState(true);
  const [isRecordingWebm, setIsRecordingWebm] = useState(false);

  // Voiceover & soundstage configuration
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<"auto" | "zira" | "david">("auto");
  const [showScriptDrawer, setShowScriptDrawer] = useState(false);
  const [isAuditioning, setIsAuditioning] = useState(false);

  const defaultVoiceoverScript = useMemo(() => {
    const brand = brief.productName.trim();
    const firstSentence =
      brief.productDescription.split(/[.!?]/)[0]?.trim() || `${brand} is here`;
    const words = brief.productDescription.trim().split(/\s+/);
    const shortDesc = words.slice(0, 14).join(" ").replace(/[.,!?]+$/, "");
    const aud = brief.targetAudience.trim().slice(0, 48);
    const tone = brief.brandTone.toLowerCase();
    const cta = tone.includes("lux") ? "Discover the collection" : "Shop the drop";
    return `Introducing ${brand}. ${firstSentence}. ${shortDesc}. Built for ${aud}. Experience ${brand}. ${cta} today.`;
  }, [brief]);

  const [voiceoverScript, setVoiceoverScript] = useState("");
  const effectiveScript = voiceoverScript.trim() || defaultVoiceoverScript;

  const handleAuditionVoiceover = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isAuditioning) {
      window.speechSynthesis.cancel();
      setIsAuditioning(false);
      return;
    }

    const text = effectiveScript;
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (
      selectedVoice === "david" ||
      (selectedVoice === "auto" &&
        ["bold", "tech", "pulse", "athletic"].some((k) =>
          brief.brandTone.toLowerCase().includes(k)
        ))
    ) {
      const male = voices.find(
        (v) =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("guy")
      );
      if (male) utter.voice = male;
      utter.pitch = 0.95;
      utter.rate = 1.05;
    } else {
      const female = voices.find(
        (v) =>
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("aria") ||
          v.name.toLowerCase().includes("samantha")
      );
      if (female) utter.voice = female;
      utter.pitch = 1.05;
      utter.rate = 1.0;
    }

    utter.onend = () => setIsAuditioning(false);
    utter.onerror = () => setIsAuditioning(false);

    setIsAuditioning(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [effectiveScript, isAuditioning, selectedVoice, brief.brandTone]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (videos.length > 0) {
      setSelectedVideoIdx(videos.length - 1);
    }
  }, [videos.length]);

  const activeVideo = videos[selectedVideoIdx] ?? videos[0] ?? null;

  const drawCanvasFrame = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, tSec: number) => {
      const dur = 10;
      const t = tSec % dur;
      const progress = t / dur;
      const isLightPaper = shotStyle === "vox_collage" || shotStyle === "ink_press";
      const primary =
        shotStyle === "vox_collage"
          ? "#DC2626"
          : shotStyle === "ink_press"
            ? "#18181B"
            : (palette[1]?.hex ?? "#8B5CF6");
      const accent =
        shotStyle === "luxury_editorial"
          ? "#D4AF37"
          : shotStyle === "vox_collage"
            ? "#EAB308"
            : shotStyle === "ink_press"
              ? "#E11D48"
              : (palette[2]?.hex ?? "#06B6D4");
      const textCol = isLightPaper ? "#18181B" : "#FFFFFF";
      const mutedCol = isLightPaper ? "rgba(24,24,27,0.72)" : "rgba(255,255,255,0.72)";
      const beatPulse = Math.exp(-((t % 1.25) * 4.5));
      const isVertical = h > w;

      ctx.fillStyle =
        shotStyle === "vox_collage"
          ? "#F4EFE6"
          : shotStyle === "ink_press"
            ? "#F7F6F2"
            : "#09090B";
      ctx.fillRect(0, 0, w, h);

      // Moving volumetric studio glows (dark modes only)
      if (!isLightPaper) {
        const g1x = w * (0.72 - 0.14 * progress) + Math.sin(progress * Math.PI * 2) * 28;
        const g1y = h * (0.3 + 0.12 * Math.sin(progress * Math.PI));
        const g1 = ctx.createRadialGradient(g1x, g1y, 10, g1x, g1y, Math.min(w, h) * 0.65);
        g1.addColorStop(0, `${primary}77`);
        g1.addColorStop(1, "rgba(9,9,11,0)");
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);

        const g2x = w * (0.24 + 0.14 * progress);
        const g2y = h * (0.78 - 0.1 * progress);
        const g2 = ctx.createRadialGradient(g2x, g2y, 8, g2x, g2y, Math.min(w, h) * 0.55);
        g2.addColorStop(0, `${accent}55`);
        g2.addColorStop(1, "rgba(9,9,11,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
      }

      // Parallax halftone / Swiss grid / dot grid
      const step = shotStyle === "vox_collage" ? 20 : 32;
      const ox = (t * 14) % step;
      const oy = (t * 7) % step;
      ctx.fillStyle = isLightPaper ? "rgba(24,24,27,0.09)" : "rgba(255,255,255,0.08)";
      for (let x = -step + ox; x < w + step; x += step) {
        for (let y = -step + oy; y < h + step; y += step) {
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }

      // Studio frame
      const pad = 22;
      ctx.strokeStyle = isLightPaper ? "rgba(24,24,27,0.35)" : "rgba(255,255,255,0.14)";
      ctx.lineWidth = shotStyle === "ink_press" ? 2 : 1;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

      // Top telemetry bar
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(pad + 18, pad + 20, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textCol;
      ctx.font = "700 12px monospace";
      ctx.fillText(brief.productName.toUpperCase().slice(0, 26), pad + 30, pad + 24);

      const tc = `00:0${Math.floor(t)}:${String(Math.floor((t % 1) * 24)).padStart(2, "0")} // ${shotStyle.toUpperCase()}`;
      ctx.fillStyle = isLightPaper ? "#18181B" : accent;
      const tcW = ctx.measureText(tc).width;
      ctx.fillText(tc, w - pad - 16 - tcW, pad + 24);

      // Persistent geometric monolith sculpture
      const cx = isVertical ? w * 0.5 : w * 0.74;
      const cy = isVertical ? h * 0.34 : h * 0.52;
      const r = Math.min(w, h) * 0.19 * (0.9 + 0.15 * Math.sin(progress * Math.PI) + 0.05 * beatPulse);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = `${primary}88`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(t * (shotStyle === "pulse_drop" ? 0.95 : 0.55));
      ctx.fillStyle = `${primary}44`;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Continuous beat typography
      const tx = pad + 28;
      const ty = isVertical ? h * 0.62 : h * 0.42;
      ctx.save();
      if (t < 3.2) {
        const e = easeSnapSettle(t / 0.7);
        ctx.globalAlpha = Math.max(0, Math.min(1, e * (1 - Math.max(0, (t - 2.8) / 0.4))));
        if (shotStyle === "vox_collage") {
          ctx.fillStyle = "#FACC15";
          ctx.fillRect(tx - 4, ty - 20 + (1 - e) * 24, 310, 38);
        }
        ctx.fillStyle = isLightPaper ? primary : accent;
        ctx.font = "700 11px monospace";
        ctx.fillText(`${brief.brandTone.toUpperCase()} LAUNCH FILM`, tx, ty - 28 + (1 - e) * 24);
        ctx.fillStyle = textCol;
        ctx.font = "800 32px sans-serif";
        ctx.fillText(brief.productName.toUpperCase().slice(0, 22), tx, ty + 10 + (1 - e) * 24);
        ctx.fillStyle = mutedCol;
        ctx.font = "500 14px sans-serif";
        ctx.fillText(brief.targetAudience.slice(0, 48), tx, ty + 38 + (1 - e) * 24);
      } else if (t < 6.8) {
        const lt = t - 3.2;
        const e = easeSoftLand(lt / 0.65);
        ctx.globalAlpha = Math.max(0, Math.min(1, e * (1 - Math.max(0, (lt - 3.2) / 0.4))));
        ctx.fillStyle = primary;
        ctx.font = "700 11px monospace";
        ctx.fillText("02 // CRAFTED FOR DAILY IMPACT", tx, ty - 24 + (1 - e) * 22);
        ctx.fillStyle = textCol;
        ctx.font = "700 22px sans-serif";
        ctx.fillText(brief.productDescription.slice(0, 44), tx, ty + 12 + (1 - e) * 22);
        ctx.fillStyle = mutedCol;
        ctx.font = "500 14px sans-serif";
        ctx.fillText(brief.productDescription.slice(44, 96), tx, ty + 38 + (1 - e) * 22);
      } else {
        const lt = t - 6.8;
        const e = easeSoftLand(lt / 0.7);
        ctx.globalAlpha = Math.max(0, Math.min(1, e));
        ctx.fillStyle = textCol;
        ctx.font = "800 30px sans-serif";
        ctx.fillText(`EXPERIENCE ${brief.productName.toUpperCase().slice(0, 18)}`, tx, ty + (1 - e) * 20);
        ctx.fillStyle = isLightPaper ? "#18181B" : accent;
        ctx.fillRect(tx, ty + 20 + (1 - e) * 20, 146, 32);
        ctx.fillStyle = isLightPaper ? "#FFFFFF" : "#09090B";
        ctx.font = "800 12px monospace";
        ctx.fillText("SHOP THE DROP →", tx + 14, ty + 40 + (1 - e) * 20);
      }
      ctx.restore();

      // Progress timeline bar
      const by = h - pad - 10;
      ctx.fillStyle = isLightPaper ? "rgba(24,24,27,0.16)" : "rgba(255,255,255,0.16)";
      ctx.fillRect(pad + 16, by, w - pad * 2 - 32, 3);
      ctx.fillStyle = isLightPaper ? "#18181B" : accent;
      ctx.fillRect(pad + 16, by, (w - pad * 2 - 32) * progress, 3);
    },
    [brief, palette, shotStyle]
  );

  // Run 60fps canvas animation when no server MP4 is loaded yet
  useEffect(() => {
    if (activeVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = canvasPlaying ? (now - start) / 1000 : 1.5;
      drawCanvasFrame(ctx, canvas.width, canvas.height, elapsed);
      if (canvasPlaying) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeVideo, canvasPlaying, drawCanvasFrame]);

  const handleRecordClientWebm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === "undefined") return;
    setIsRecordingWebm(true);
    setCanvasPlaying(true);

    try {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(brief.productName)}-${shotStyle}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setIsRecordingWebm(false);
      };
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 5000);
    } catch {
      setIsRecordingWebm(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Shot Recipe & Aspect Ratio Director Controls */}
      <div className="space-y-3 rounded-2xl bg-[#F5F5F7] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-[#0071E3]" />
            <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              ShotCraft &amp; MotionMaxx Video Engine
            </span>
          </div>

          {/* Aspect Ratio Switcher */}
          <div className="flex rounded-full bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setAspectRatio("16:9")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition",
                aspectRatio === "16:9"
                  ? "bg-[#1D1D1F] text-white"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              <Monitor className="h-3 w-3" />
              <span>16:9 Cinema</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio("9:16")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition",
                aspectRatio === "9:16"
                  ? "bg-[#1D1D1F] text-white"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              )}
            >
              <Smartphone className="h-3 w-3" />
              <span>9:16 Reels</span>
            </button>
          </div>
        </div>

        {/* 6 Shot Recipe Cards (distilled from starred motion-design repos) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHOT_RECIPES.map((recipe) => {
            const active = shotStyle === recipe.id;
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setShotStyle(recipe.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-[#0071E3] bg-white text-[#1D1D1F] shadow-sm"
                    : "border-black/[0.06] bg-white/70 text-[#6E6E73] hover:bg-white hover:text-[#1D1D1F]"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold">
                    {recipe.label}
                  </span>
                  <span className="shrink-0 rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-[#6E6E73]">
                    {recipe.tag}
                  </span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-[#86868B]">
                  {recipe.curve}
                </div>
              </button>
            );
          })}
        </div>

        {/* AI Voiceover & Soundstage Console */}
        <div className="space-y-3 rounded-xl border border-black/[0.06] bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0071E3]/10 text-[#0071E3]">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#1D1D1F]">
                    AI Voiceover &amp; Soundstage
                  </span>
                  <span className="rounded bg-[#0071E3]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#0071E3]">
                    Sidechain Ducking (-12dB)
                  </span>
                </div>
                <p className="text-[10px] text-[#6E6E73]">
                  24fps synchronized vocal narration mixed over cinematic pads
                </p>
              </div>
            </div>

            {/* Apple iOS-style Toggle Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnableVoiceover((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  enableVoiceover ? "bg-[#30D158]" : "bg-black/20"
                )}
                role="switch"
                aria-checked={enableVoiceover}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    enableVoiceover ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {enableVoiceover && (
            <div className="space-y-2.5 pt-1">
              {/* Voice Preset Selector */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {VOICEOVER_PRESETS.map((vp) => {
                  const active = selectedVoice === vp.id;
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => setSelectedVoice(vp.id)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-left transition",
                        active
                          ? "border-[#0071E3] bg-[#0071E3]/[0.04] text-[#1D1D1F]"
                          : "border-black/[0.06] bg-[#F5F5F7]/60 text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold">{vp.label}</span>
                        <span className="font-mono text-[9px] text-[#86868B]">{vp.tag}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[9px] text-[#86868B]">{vp.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Audition & Script Edit Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAuditionVoiceover}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition",
                      isAuditioning
                        ? "bg-[#D70015] text-white"
                        : "bg-[#0071E3]/10 text-[#0071E3] hover:bg-[#0071E3]/15"
                    )}
                  >
                    {isAuditioning ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        <span>Stop Audition</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span>Audition Voiceover</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScriptDrawer((s) => !s)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
                  >
                    <FileText className="h-3 w-3 text-[#6E6E73]" />
                    <span>{showScriptDrawer ? "Hide Script" : "Edit Narration"}</span>
                  </button>
                </div>

                <span className="font-mono text-[10px] text-[#86868B]">
                  4-Beat Directors&apos; Cadence
                </span>
              </div>

              {/* Script Drawer */}
              {showScriptDrawer && (
                <div className="space-y-2 rounded-lg bg-[#F5F5F7] p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1D1D1F]">
                      Voiceover Narration Script
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceoverScript("")}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0071E3] hover:underline"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Reset to AI default</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={voiceoverScript || defaultVoiceoverScript}
                    onChange={(e) => setVoiceoverScript(e.target.value)}
                    className="w-full rounded-md border border-black/[0.08] bg-white p-2 text-[11px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none"
                    placeholder="Enter narration script..."
                  />
                  <div className="flex flex-wrap gap-1 font-mono text-[9px] text-[#86868B]">
                    <span className="rounded bg-black/[0.04] px-1 py-0.5">Beat 1: Hook</span>
                    <span>→</span>
                    <span className="rounded bg-black/[0.04] px-1 py-0.5">Beat 2: Product</span>
                    <span>→</span>
                    <span className="rounded bg-black/[0.04] px-1 py-0.5">Beat 3: Audience</span>
                    <span>→</span>
                    <span className="rounded bg-black/[0.04] px-1 py-0.5">Beat 4: CTA</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Render / Export Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-[#6E6E73]">
            {isLiveBackend && campaignId
              ? "Server renders H.264 MP4 with beat-synced audio via FFmpeg"
              : "Simulated Mode: Live 60fps Canvas Cinema Engine with WebM export"}
          </span>

          {isLiveBackend && campaignId ? (
            <button
              type="button"
              disabled={isRenderingCut}
              onClick={() =>
                onRenderCustomCut(aspectRatio, shotStyle, {
                  enableVoiceover,
                  voice: selectedVoice,
                  voiceoverScript: effectiveScript,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0077ED] disabled:opacity-50"
            >
              {isRenderingCut ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Rendering MP4…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    Render {aspectRatio} MP4{enableVoiceover ? " + VO" : ""}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isRecordingWebm}
              onClick={handleRecordClientWebm}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0077ED] disabled:opacity-50"
            >
              {isRecordingWebm ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Recording 5s WebM…</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Save .WebM</span>
                </>
              )}
            </button>
          )}
        </div>

        {renderError && (
          <p className="text-[12px] font-medium text-[#D70015]">{renderError}</p>
        )}
      </div>

      {/* Main Video Stage: Real Server MP4 OR Live 60fps Canvas Engine */}
      {activeVideo ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[18px] border border-black/[0.08] bg-[#1D1D1F]">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#151517] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-[#30D158]" />
                <span className="truncate text-[12px] font-semibold text-white">
                  {activeVideo.title}
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] text-white/90">
                  H.264 MP4 · {activeVideo.aspectRatio}
                </span>
              </div>
              <a
                href={activeVideo.videoUrl}
                download={`${slugify(activeVideo.title)}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:bg-white/90"
              >
                <Download className="h-3 w-3" />
                <span>Download MP4</span>
              </a>
            </div>

            <div className="flex justify-center bg-black p-2">
              <video
                key={activeVideo.videoUrl}
                src={activeVideo.videoUrl}
                controls
                playsInline
                autoPlay
                loop
                muted
                className={cn(
                  "rounded-lg bg-black shadow-2xl",
                  activeVideo.aspectRatio === "9:16"
                    ? "max-h-[460px] w-auto"
                    : "aspect-video w-full"
                )}
              />
            </div>
          </div>

          {/* Generated Cuts Switcher */}
          {videos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {videos.map((vid, idx) => (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => setSelectedVideoIdx(idx)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                    idx === selectedVideoIdx
                      ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                      : "border-black/[0.08] bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                  )}
                >
                  <Film className="h-3 w-3" />
                  <span>
                    Cut 0{idx + 1} · {vid.aspectRatio}
                  </span>
                  {(vid.hasVoiceover || vid.title.includes("VO:") || vid.promptSummary?.includes("VO:")) && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0071E3]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#0071E3]">
                      <Mic className="h-2.5 w-2.5" />
                      <span>VO</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Live 60fps Canvas Motion Engine (Mock Mode) */
        <div className="overflow-hidden rounded-[18px] border border-black/[0.08] bg-[#1D1D1F]">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#151517] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Film className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[12px] font-semibold text-white">
                Motion Canvas ({aspectRatio})
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] text-white/90">
                60 FPS
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCanvasPlaying((p) => !p)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:bg-white/90"
            >
              {canvasPlaying ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>
          </div>
          <div className="flex justify-center bg-black p-2">
            <canvas
              ref={canvasRef}
              width={aspectRatio === "9:16" ? 420 : 800}
              height={aspectRatio === "9:16" ? 746 : 450}
              className={cn(
                "rounded-lg bg-[#09090B]",
                aspectRatio === "9:16"
                  ? "max-h-[420px] w-auto"
                  : "aspect-video w-full"
              )}
            />
          </div>
        </div>
      )}
      {/* 4-Beat Director's Dramaturgy Shot List (visual-skills / narrative-film-direction) */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F5F5F7] p-3 sm:grid-cols-4">
        {DIRECTOR_BEATS.map((b) => (
          <div
            key={b.beat}
            className="rounded-xl border border-black/[0.05] bg-white px-2.5 py-2"
          >
            <div className="flex items-center justify-between font-mono text-[10px] text-[#86868B]">
              <span className="font-semibold text-[#0071E3]">BEAT {b.beat}</span>
              <span>{b.window}</span>
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-[#1D1D1F]">
              {b.label}
            </div>
            <div className="truncate text-[10px] text-[#6E6E73]">{b.move}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
