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
    [brief, isPlayingCanvas]
  );

  useEffect(() => {
    if (isPlayingCanvas) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame, isPlayingCanvas]);

  const activeVideo = videos[activeVideoIndex] ?? videos[0];

  const handleRecordClientWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsRecordingWebm(true);
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(brief.productName)}-kinetic.webm`;
        a.click();
        URL.revokeObjectURL(url);
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
    <div className="space-y-4 font-sans">
      {/* Recipe & Aspect Director Box */}
      <div className="space-y-3 border-2 border-black bg-[#E6F7EB]/40 p-4 shadow-[2px_2px_0px_#000000]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2.5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            <span className="font-display text-xs font-black uppercase text-black">
              DIRECTOR RECIPES &amp; MOTION KINETICS
            </span>
          </div>

          {/* Aspect Switcher */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAspectRatio("16:9")}
              className={cn(
                "inline-flex items-center gap-1 border-2 border-black px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase transition-all",
                aspectRatio === "16:9"
                  ? "bg-black text-white shadow-[1px_1px_0px_#000000]"
                  : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <Monitor className="h-3 w-3" />
              <span>16:9 CINEMA</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio("9:16")}
              className={cn(
                "inline-flex items-center gap-1 border-2 border-black px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase transition-all",
                aspectRatio === "9:16"
                  ? "bg-black text-white shadow-[1px_1px_0px_#000000]"
                  : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <Smartphone className="h-3 w-3" />
              <span>9:16 REELS</span>
            </button>
          </div>
        </div>

        {/* 6 Recipes */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHOT_RECIPES.map((recipe) => {
            const active = shotStyle === recipe.id;
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setShotStyle(recipe.id)}
                className={cn(
                  "border-2 border-black p-2 text-left transition-all",
                  active
                    ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-display text-xs font-black uppercase">
                    {recipe.label}
                  </span>
                  <span className="shrink-0 border border-black bg-black px-1 font-mono text-[9px] text-white">
                    {recipe.tag}
                  </span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-black/70">
                  {recipe.curve}
                </div>
              </button>
            );
          })}
        </div>

        {/* AI Voiceover & Soundstage Console */}
        <div className="space-y-3 border-2 border-black bg-white p-3.5 shadow-[2px_2px_0px_#000000]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center border border-black bg-[#10B981] text-black">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-black uppercase text-black">
                    AI Voiceover &amp; Soundstage
                  </span>
                  <span className="border border-black bg-[#10B981] px-1 font-mono text-[9px] font-bold text-black">
                    Sidechain Ducking (-12dB)
                  </span>
                </div>
                <p className="font-mono text-[10px] text-black/70">
                  24fps synchronized vocal narration mixed over cinematic pads
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnableVoiceover((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-black transition-colors duration-200 ease-in-out focus:outline-none",
                  enableVoiceover ? "bg-[#10B981]" : "bg-black/20"
                )}
                role="switch"
                aria-checked={enableVoiceover}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full border border-black bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    enableVoiceover ? "translate-x-5" : "translate-x-0.5"
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
                        "border-2 p-2 text-left transition",
                        active
                          ? "border-black bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                          : "border-black bg-white text-black/80 hover:bg-[#F5F5F7]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black uppercase">{vp.label}</span>
                        <span className="font-mono text-[9px] font-bold text-black/70">{vp.tag}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 font-mono text-[9px] text-black/60">{vp.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Audition & Script Edit Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAuditionVoiceover}
                    className={cn(
                      "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-[11px] font-bold uppercase transition",
                      isAuditioning
                        ? "bg-[#D70015] text-white shadow-[2px_2px_0px_#000000]"
                        : "bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-[#F5F5F7]"
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
                    className="inline-flex items-center gap-1 border-2 border-black bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-[#F5F5F7]"
                  >
                    <FileText className="h-3 w-3 text-black" />
                    <span>{showScriptDrawer ? "Hide Script" : "Edit Narration"}</span>
                  </button>
                </div>

                <span className="font-mono text-[10px] text-black/70">
                  4-Beat Directors&apos; Cadence
                </span>
              </div>

              {/* Script Drawer */}
              {showScriptDrawer && (
                <div className="space-y-2 border border-black bg-[#F5F5F7] p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold uppercase text-black">
                      Voiceover Narration Script
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceoverScript("")}
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-black hover:underline"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Reset to AI default</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={voiceoverScript || defaultVoiceoverScript}
                    onChange={(e) => setVoiceoverScript(e.target.value)}
                    className="w-full border-2 border-black bg-white p-2 font-mono text-[11px] text-black focus:outline-none"
                    placeholder="Enter narration script..."
                  />
                  <div className="flex flex-wrap gap-1 font-mono text-[9px] text-black/70">
                    <span className="border border-black bg-white px-1 py-0.5">Beat 1: Hook</span>
                    <span>→</span>
                    <span className="border border-black bg-white px-1 py-0.5">Beat 2: Product</span>
                    <span>→</span>
                    <span className="border border-black bg-white px-1 py-0.5">Beat 3: Audience</span>
                    <span>→</span>
                    <span className="border border-black bg-white px-1 py-0.5">Beat 4: CTA</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Render CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black pt-2">
          <span className="font-mono text-[11px] text-black/70">
            {isLiveBackend && campaignId
              ? "FastAPI orchestrator renders beat-synced H.264 MP4 with FFmpeg"
              : "Simulated Ops: 60fps Canvas Kinetic Preview with WebM capture"}
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
              className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-4 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {isRenderingCut ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>RENDERING MP4...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    RENDER {aspectRatio} MP4{enableVoiceover ? " + VO" : ""}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isRecordingWebm}
              onClick={handleRecordClientWebm}
              className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-3.5 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {isRecordingWebm ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>RECORDING 5S WEBM...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>SAVE .WEBM</span>
                </>
              )}
            </button>
          )}
        </div>

        {renderError && (
          <p className="font-mono text-xs font-bold text-[#EF4444]">{renderError}</p>
        )}
      </div>

      {/* Main Video Stage */}
      {activeVideo ? (
        <div className="space-y-3">
          <div className="border-2 border-black bg-black shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black bg-white p-2.5">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-[#10B981]" />
                <span className="truncate font-display text-xs font-black uppercase text-black">
                  {activeVideo.title}
                </span>
                <span className="border border-black bg-[#E6F7EB] px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                  H.264 MP4 · {activeVideo.aspectRatio}
                </span>
              </div>
              <a
                href={activeVideo.videoUrl}
                download={`${slugify(activeVideo.title)}.mp4`}
                className="inline-flex items-center gap-1 border-2 border-black bg-[#10B981] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000]"
              >
                <Download className="h-3 w-3" />
                <span>DOWNLOAD MP4</span>
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
                  "border border-white/20 bg-black",
                  activeVideo.aspectRatio === "9:16"
                    ? "max-h-[440px] w-auto"
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
                  onClick={() => setActiveVideoIndex(idx)}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition",
                    idx === activeVideoIndex
                      ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                      : "bg-white text-black/70 hover:bg-[#F5F5F7]"
                  )}
                >
                  <Film className="h-3 w-3" />
                  <span>
                    Cut 0{idx + 1} · {vid.aspectRatio}
                  </span>
                  {(vid.hasVoiceover || vid.title.includes("VO:") || vid.promptSummary?.includes("VO:")) && (
                    <span className="inline-flex items-center gap-0.5 border border-black bg-white px-1 font-mono text-[9px] text-black">
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
        /* 60fps Canvas Stage */
        <div className="border-2 border-black bg-black shadow-[4px_4px_0px_#000000]">
          <div className="flex items-center justify-between border-b-2 border-black bg-white p-2.5">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              <span className="font-display text-xs font-black uppercase text-black">
                REAL-TIME MOTION KINETIC ENGINE (60 FPS)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPlayingCanvas((p) => !p)}
              className="border-2 border-black bg-[#E6F7EB] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000]"
            >
              {isPlayingCanvas ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          </div>

          <div className="flex justify-center bg-black p-2">
            <canvas
              ref={canvasRef}
              width={aspectRatio === "9:16" ? 720 : 1280}
              height={aspectRatio === "9:16" ? 1280 : 720}
              className={cn(
                "border border-white/20 bg-black",
                aspectRatio === "9:16" ? "max-h-[440px] w-auto" : "aspect-video w-full"
              )}
            />
          </div>
        </div>
      )}

      {/* Director Beats Spec Grid */}
      <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000000]">
        <div className="border-b border-black pb-1.5 font-display text-xs font-black uppercase text-black">
          DIRECTOR SHOT CHOREOGRAPHY &amp; BEATS
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
          {DIRECTOR_BEATS.map((beat) => (
            <div key={beat.beat} className="border border-black bg-[#E6F7EB]/40 p-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-black">BEAT {beat.beat}</span>
                <span className="text-black/60">{beat.window}</span>
              </div>
              <div className="mt-1 font-display font-bold uppercase text-black">{beat.label}</div>
              <div className="text-[10px] text-black/70">{beat.move}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
