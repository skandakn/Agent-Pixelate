"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Film,
  Loader2,
  Monitor,
  Pause,
  Play,
  Radio,
  Smartphone,
  Sparkles,
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
    shotStyle: VideoShotStyle
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);

  // Load hero creative into hidden HTMLImageElement for canvas rendering
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
              onClick={() => onRenderCustomCut(aspectRatio, shotStyle)}
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
                  <span>RENDER {aspectRatio} MP4</span>
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
