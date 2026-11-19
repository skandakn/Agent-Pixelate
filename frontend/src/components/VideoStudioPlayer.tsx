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
  StoryboardFrame,
  VideoAspectRatio,
  VideoShotStyle,
  VisualCreative,
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
  {
    id: "cyberpunk_neon",
    label: "Cyberpunk Neon",
    curve: "anamorphic · 2.39:1",
    tag: "video-shotcraft",
  },
  {
    id: "golden_hour_film",
    label: "Golden Hour 35mm",
    curve: "halation · 3200K",
    tag: "lemo-opuscar",
  },
  {
    id: "titanium_minimal",
    label: "Titanium Keynote",
    curve: "specular · 24fps",
    tag: "bang-motion",
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
  palette?: ColorSwatch[];
  videos: CampaignVideoAsset[];
  creatives?: VisualCreative[];
  storyboard?: StoryboardFrame[];
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
  videos,
  creatives = [],
  storyboard = [],
  isLiveBackend,
  isRenderingCut,
  renderError,
  onRenderCustomCut,
}: VideoStudioPlayerProps) {
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [shotStyle, setShotStyle] = useState<VideoShotStyle>("obsidian_cinema");
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = videos[activeVideoIndex] ?? videos[0];
  const [isPlayingCanvas, setIsPlayingCanvas] = useState(true);
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const heroCreative = creatives[0];
    if (!heroCreative?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = heroCreative.imageUrl;
    img.onload = () => {
      heroImageRef.current = img;
    };
  }, [creatives]);

  // Canvas 60fps Cinema Engine Loop
  const drawFrame = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const durationMs = 8000;
      const progress = ((timestamp % durationMs) / durationMs);
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#0A0D14";
      ctx.fillRect(0, 0, width, height);

      // Ken Burns Hero Image Rendering
      const hero = heroImageRef.current;
      if (hero && hero.complete && hero.naturalWidth > 0) {
        ctx.save();
        const kbScale = 1.0 + 0.12 * easeSoftLand(progress);
        const kbPanX = (progress - 0.5) * 18;
        const kbPanY = (progress - 0.5) * 12;

        ctx.translate(width / 2 + kbPanX, height / 2 + kbPanY);
        ctx.scale(kbScale, kbScale);
        ctx.translate(-width / 2, -height / 2);

        ctx.globalAlpha = 0.55;
        ctx.drawImage(hero, 0, 0, width, height);
        ctx.restore();
      }

      // Background vignette gradient
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.15,
        width / 2,
        height / 2,
        width * 0.7
      );
      grad.addColorStop(0, "rgba(0,0,0,0.1)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Text Overlays
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Product Title
      const titleAlpha = easeSoftLand(Math.min(1, progress * 4));
      ctx.globalAlpha = titleAlpha;
      ctx.font = `900 ${Math.round(height * 0.082)}px Archivo, sans-serif`;
      ctx.fillText(brief.productName.toUpperCase(), width / 2, height * 0.38);

      // Dynamic Beat / Tagline
      const beatIndex = Math.min(
        DIRECTOR_BEATS.length - 1,
        Math.floor(progress * DIRECTOR_BEATS.length)
      );
      const activeBeat = DIRECTOR_BEATS[beatIndex];

      ctx.fillStyle = "#10B981";
      ctx.font = `700 ${Math.round(height * 0.038)}px 'JetBrains Mono', monospace`;
      ctx.fillText(`BEAT ${activeBeat.beat} // ${activeBeat.label.toUpperCase()}`, width / 2, height * 0.52);

      // Value Prop Subtitle
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `600 ${Math.round(height * 0.032)}px 'Hanken Grotesk', sans-serif`;
      const snippet = brief.productDescription.slice(0, 60) + (brief.productDescription.length > 60 ? "…" : "");
      ctx.fillText(snippet, width / 2, height * 0.62);

      // Film Gate Corner Brackets ⌜ ⌝ ⌞ ⌟
      const pad = Math.round(width * 0.04);
      const bLen = 14;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.5;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
      // Top-Right
      ctx.moveTo(width - pad - bLen, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + bLen);
      // Bottom-Left
      ctx.moveTo(pad, height - pad - bLen); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + bLen, height - pad);
      // Bottom-Right
      ctx.moveTo(width - pad - bLen, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - bLen);
      ctx.stroke();

      // Optical Anamorphic Streak on Beat Transitions
      const localBeatProgress = (progress * DIRECTOR_BEATS.length) % 1;
      if (localBeatProgress < 0.22) {
        const flareIntensity = 1 - localBeatProgress / 0.22;
        ctx.save();
        ctx.strokeStyle = "rgba(0, 240, 255, " + (flareIntensity * 0.7).toFixed(2) + ")";
        ctx.lineWidth = 2 * flareIntensity;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.52);
        ctx.lineTo(width, height * 0.52);
        ctx.stroke();
        ctx.restore();
      }

      // Voiceover Subtitle Caption Pill
      if (enableVoiceover) {
        ctx.save();
        const voSnippet = effectiveScript.slice(0, 75);
        ctx.font = `500 ${Math.round(height * 0.026)}px 'Hanken Grotesk', sans-serif`;
        const metrics = ctx.measureText(voSnippet);
        const pillW = metrics.width + 24;
        const pillH = Math.round(height * 0.044);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect((width - pillW) / 2, height - pad - 36, pillW, pillH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(voSnippet, width / 2, height - pad - 36 + pillH / 2);
        ctx.restore();
      }

      // Progress Tracker Bar at Bottom
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(0, height - 6, width, 6);
      ctx.fillStyle = "#10B981";
      ctx.fillRect(0, height - 6, width * progress, 6);

      ctx.restore();

      if (isPlayingCanvas) {
        animFrameRef.current = requestAnimationFrame(drawFrame);
      }
    },
    [brief, isPlayingCanvas, effectiveScript, enableVoiceover]
  );

  useEffect(() => {
    if (isPlayingCanvas) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame, isPlayingCanvas]);

  return (
    <div className="space-y-4 font-sans">
      {/* Recipe & Aspect Director Box */}
      <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F]">
              Video Studio &amp; Motion Kinetics
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Autonomous cinematic direction, Ken Burns framing &amp; AI voiceover
            </p>
          </div>

          {/* Aspect Switcher */}
          <div className="inline-flex rounded-full bg-neutral-100 p-0.5">
            <button
              type="button"
              onClick={() => setAspectRatio("16:9")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                aspectRatio === "16:9"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>16:9 Cinema</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio("9:16")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                aspectRatio === "9:16"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>9:16 Reel</span>
            </button>
          </div>
        </div>

        {/* Shot Recipes Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHOT_RECIPES.map((recipe) => {
            const active = shotStyle === recipe.id;
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setShotStyle(recipe.id)}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition",
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                    : "border-black/[0.06] bg-[#FBFBFD] text-neutral-700 hover:bg-neutral-100/70"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-semibold">
                    {recipe.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-neutral-200/60 text-neutral-600"
                    )}
                  >
                    {recipe.tag}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-0.5 truncate text-[10px]",
                    active ? "text-neutral-300" : "text-neutral-500"
                  )}
                >
                  {recipe.curve}
                </div>
              </button>
            );
          })}
        </div>

        {/* AI Voiceover & Soundstage Console */}
        <div className="rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-sm">
                <Mic className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    AI Voiceover &amp; Soundstage
                  </span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                    Studio Mixed
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Synchronized vocal narration mixed over cinematic audio score
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setEnableVoiceover((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                enableVoiceover ? "bg-[#0071E3]" : "bg-neutral-300"
              )}
              role="switch"
              aria-checked={enableVoiceover}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                  enableVoiceover ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
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
                        "rounded-xl border p-2 text-left transition",
                        active
                          ? "border-neutral-900 bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-900"
                          : "border-black/[0.06] bg-white text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{vp.label}</span>
                        <span className="text-[9px] font-medium text-neutral-400">
                          {vp.tag}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
                        {vp.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Audition & Script Edit Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.04] pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAuditionVoiceover}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                      isAuditioning
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "border border-black/[0.08] bg-white text-neutral-700 hover:bg-neutral-50"
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
                        <span>Audition Voice</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScriptDrawer((s) => !s)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <FileText className="h-3 w-3" />
                    <span>{showScriptDrawer ? "Hide Script" : "Edit Script"}</span>
                  </button>
                </div>

                <span className="text-[11px] text-neutral-400">
                  4-Beat Directors&apos; Cadence
                </span>
              </div>

              {/* Script Drawer */}
              {showScriptDrawer && (
                <div className="space-y-2 rounded-xl border border-black/[0.06] bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-700">
                      Voiceover Narration Script
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceoverScript("")}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={voiceoverScript || defaultVoiceoverScript}
                    onChange={(e) => setVoiceoverScript(e.target.value)}
                    className="w-full rounded-lg border border-black/[0.08] p-2 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    placeholder="Enter narration script..."
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Render CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
          <span className="text-xs text-neutral-500">
            {isLiveBackend && campaignId
              ? "FastAPI orchestrator renders 24fps H.264 MP4 with FFmpeg & audio"
              : "Autonomous cinematic engine with AI voiceover and soundstage"}
          </span>

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
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#0077ED] active:scale-[0.99] disabled:opacity-50"
          >
            {isRenderingCut ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Rendering Cut...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  Render {aspectRatio === "9:16" ? "9:16 Reel" : "16:9 Cinema Cut"}
                  {enableVoiceover ? " + VO" : ""}
                </span>
              </>
            )}
          </button>
        </div>

        {renderError && (
          <p className="text-xs font-medium text-rose-600">{renderError}</p>
        )}
      </div>

      {/* Main Video Stage */}
      {activeVideo ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-black shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Radio className="h-3.5 w-3.5 text-[#0071E3]" />
                <span className="truncate text-xs font-semibold text-white">
                  {activeVideo.title}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                  H.264 · {activeVideo.aspectRatio}
                </span>
              </div>
              <a
                href={activeVideo.videoUrl}
                download={`${slugify(activeVideo.title)}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-medium text-white transition"
              >
                <Download className="h-3.5 w-3.5" />
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
                  "rounded-lg bg-black shadow-inner",
                  activeVideo.aspectRatio === "9:16"
                    ? "max-h-[460px] aspect-[9/16] w-auto"
                    : "aspect-video w-full"
                )}
              />
            </div>
          </div>

          {/* Generated Cuts Switcher */}
          {videos.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 mr-1">Cuts:</span>
              {videos.map((vid, idx) => (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => setActiveVideoIndex(idx)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                    idx === activeVideoIndex
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "border border-black/[0.08] bg-white text-neutral-700 hover:bg-neutral-100/70"
                  )}
                >
                  <Film className="h-3.5 w-3.5" />
                  <span>
                    Cut 0{idx + 1} · {vid.aspectRatio}
                  </span>
                  {(vid.hasVoiceover ||
                    vid.title.includes("VO:") ||
                    vid.promptSummary?.includes("VO:")) && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-200/60 px-1.5 py-0.2 text-[9px] text-neutral-700">
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
        /* Real-time Canvas Stage */
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-black shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-[#0071E3]" />
              <span className="text-xs font-medium text-white">
                Real-Time Motion Canvas Preview (60 FPS)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPlayingCanvas((p) => !p)}
              className="rounded-full bg-white/10 hover:bg-white/20 p-1.5 text-white transition"
            >
              {isPlayingCanvas ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex justify-center bg-black p-2">
            <canvas
              ref={canvasRef}
              width={aspectRatio === "9:16" ? 720 : 1280}
              height={aspectRatio === "9:16" ? 1280 : 720}
              className={cn(
                "rounded-lg bg-black",
                aspectRatio === "9:16"
                  ? "max-h-[460px] aspect-[9/16] w-auto"
                  : "aspect-video w-full"
              )}
            />
          </div>
        </div>
      )}

      {/* Director Beats Spec Grid */}
      <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
        <div className="border-b border-black/[0.06] pb-2 text-xs font-semibold text-[#1D1D1F]">
          Director Shot Choreography &amp; Beats
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          {DIRECTOR_BEATS.map((beat) => (
            <div
              key={beat.beat}
              className="rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-800">
                  Beat {beat.beat}
                </span>
                <span className="text-[10px] text-neutral-400">{beat.window}</span>
              </div>
              <div className="mt-1 font-medium text-neutral-900">
                {beat.label}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {beat.move}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
