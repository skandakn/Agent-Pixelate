"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Film,
  Image as ImageIcon,
  Palette,
  Pause,
  Play,
  Sparkles,
  Volume2,
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
import { cn, copyTextToClipboard } from "@/lib/utils";
import { VideoStudioPlayer } from "@/components/VideoStudioPlayer";

interface VisualShowcaseCardProps {
  campaignId: string | null;
  brief: CampaignBrief;
  creatives: VisualCreative[];
  videos: CampaignVideoAsset[];
  palette: ColorSwatch[];
  artDirectionSummary: string;
  storyboard: StoryboardFrame[];
  isLoading: boolean;
  isLiveBackend: boolean;
  isRenderingCut: boolean;
  renderError: string | null;
  onRenderCustomCut: (
    aspectRatio: VideoAspectRatio,
    shotStyle: VideoShotStyle
  ) => void;
}

export function VisualShowcaseCard({
  campaignId,
  brief,
  creatives,
  videos,
  palette,
  artDirectionSummary,
  storyboard,
  isLoading,
  isLiveBackend,
  isRenderingCut,
  renderError,
  onRenderCustomCut,
}: VisualShowcaseCardProps) {
  const [activeTab, setActiveTab] = useState<"creatives" | "storyboard">(
    "creatives"
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlayingMotion, setIsPlayingMotion] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
    setActiveSceneIndex(0);
    setIsPlayingMotion(false);
  }, [creatives.length, storyboard.length]);

  useEffect(() => {
    if (!isPlayingMotion || storyboard.length === 0) return;
    const current = storyboard[activeSceneIndex];
    const durationMs = Math.max(1800, (current?.durationSec ?? 3) * 850);
    const timer = setTimeout(() => {
      setActiveSceneIndex((prev) => (prev + 1) % storyboard.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isPlayingMotion, activeSceneIndex, storyboard]);

  const handleCopyHex = async (hex: string) => {
    const ok = await copyTextToClipboard(hex);
    if (ok) {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex((curr) => (curr === hex ? null : curr)), 1600);
    }
  };

  const activeCreative = creatives[selectedIndex] ?? creatives[0];
  const activeScene = storyboard[activeSceneIndex] ?? storyboard[0];

  const handlePrev = () => {
    if (creatives.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + creatives.length) % creatives.length);
  };

  const handleNext = () => {
    if (creatives.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % creatives.length);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216] shadow-studio">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/15">
            <Palette className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Visual Showcase
              </h3>
              <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                @VisualAgent
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Art-directed creatives, brand swatches &amp; 15s motion storyboard
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-xl border border-white/[0.08] bg-[#09090B] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("creatives")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              activeTab === "creatives"
                ? "bg-violet-500/20 text-white shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5 text-violet-300" />
            <span>Creatives ({creatives.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              activeTab === "storyboard"
                ? "bg-cyan-500/20 text-white shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Film className="h-3.5 w-3.5 text-cyan-300" />
            <span>Video Studio</span>
            {videos.length > 0 && (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
                MP4
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Loading Skeleton when VisualAgent is rendering */}
      {creatives.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          {isLoading ? (
            <>
              <div className="h-12 w-12 animate-pulse rounded-2xl border border-violet-500/40 bg-violet-500/15 p-3">
                <Sparkles className="h-full w-full text-violet-300" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                @VisualAgent is composing key visuals &amp; lighting grids...
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Rendering color palette tokens and storyboard frames
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              Visual assets will appear here once agents launch.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-5">
          {activeTab === "creatives" && activeCreative ? (
            <>
              {/* Hero Carousel Stage */}
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#08080B]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCreative.id}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.25 }}
                    className="relative aspect-[16/10] w-full overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeCreative.imageUrl}
                      alt={activeCreative.title}
                      className="h-full w-full object-cover"
                    />

                    {/* Subtle Overlay Metadata */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-12">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-full border border-white/15 bg-black/55 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 backdrop-blur-md">
                            {activeCreative.platform} · {activeCreative.aspectRatio}
                          </span>
                          <h4 className="mt-1.5 text-sm font-semibold text-white sm:text-base">
                            {activeCreative.title}
                          </h4>
                          <p className="text-xs text-zinc-300">
                            {activeCreative.subtitle}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-zinc-400">
                          0{selectedIndex + 1} / 0{creatives.length}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Carousel Controls */}
                {creatives.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous creative"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition hover:border-violet-400/60 hover:bg-black/80"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next creative"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition hover:border-violet-400/60 hover:bg-black/80"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail Grid Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                {creatives.map((creative, idx) => {
                  const selected = idx === selectedIndex;
                  return (
                    <button
                      key={creative.id}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border text-left transition",
                        selected
                          ? "border-violet-400/80 ring-2 ring-violet-500/25"
                          : "border-white/[0.08] opacity-70 hover:border-white/25 hover:opacity-100"
                      )}
                    >
                      <div className="aspect-[16/10] w-full overflow-hidden bg-[#09090B]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={creative.imageUrl}
                          alt={creative.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="bg-[#0D0D12] px-2.5 py-1.5">
                        <div className="truncate text-[11px] font-medium text-zinc-200">
                          {creative.platform}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-500">
                          {creative.format}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Color Palette Swatches (Click-to-Copy Hex) */}
              <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#0C0C10] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                    Generated Color System · Click to Copy Hex
                  </span>
                  {copiedHex && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                      <Check className="h-3 w-3" />
                      Copied {copiedHex}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {palette.map((swatch) => {
                    const isCopied = copiedHex === swatch.hex;
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => handleCopyHex(swatch.hex)}
                        className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#14141A] text-left transition hover:-translate-y-0.5 hover:border-white/25"
                      >
                        <div
                          className="relative h-11 w-full"
                          style={{ backgroundColor: swatch.hex }}
                        >
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-black/50 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </span>
                        </div>
                        <div className="p-2">
                          <div className="font-mono text-[11px] font-semibold text-zinc-100">
                            {swatch.hex}
                          </div>
                          <div className="truncate text-[10px] text-zinc-400">
                            {swatch.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Art Direction Notes */}
              <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#0C0C10] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                    Art Direction Notes
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {activeCreative.format}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-300">
                  {activeCreative.artNote || artDirectionSummary}
                </p>
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.06] bg-[#131319] p-2.5">
                    <div className="font-mono text-[10px] uppercase text-zinc-500">
                      Lighting Setup
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-200">
                      {activeCreative.lighting}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-[#131319] p-2.5">
                    <div className="font-mono text-[10px] uppercase text-zinc-500">
                      Composition
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-200">
                      {activeCreative.composition}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Video Studio (Real MP4 / Live 60fps Canvas) + Director Storyboard */
            <div className="space-y-5">
              <VideoStudioPlayer
                campaignId={campaignId}
                brief={brief}
                palette={palette}
                videos={videos}
                isLiveBackend={isLiveBackend}
                isRenderingCut={isRenderingCut}
                renderError={renderError}
                onRenderCustomCut={onRenderCustomCut}
              />

              {/* Interactive Director's Storyboard Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                    ShotCraft Director&apos;s Storyboard (4 Continuous Beats)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlayingMotion((p) => !p)}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300 transition hover:text-cyan-200"
                  >
                    {isPlayingMotion ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Pause Beat Highlight</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" />
                        <span>Cycle Beats</span>
                      </>
                    )}
                  </button>
                </div>

                {activeScene && (
                  <div className="rounded-xl border border-white/[0.08] bg-[#0B0B10] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-cyan-300">
                        <Clapperboard className="h-3.5 w-3.5" />
                        SCENE 0{activeScene.sceneNumber} · {activeScene.timecode} · {activeScene.title}
                      </span>
                      <span className="font-mono text-[10px] text-violet-300">
                        {activeScene.captionOverlay}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                      {activeScene.visualDirection}
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#13131A] px-2.5 py-1.5 text-[11px] text-zinc-300">
                        <Camera className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                        <span className="truncate">{activeScene.cameraMove}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#13131A] px-2.5 py-1.5 text-[11px] text-zinc-300">
                        <Volume2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span className="truncate">{activeScene.audioCue}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {storyboard.map((frame, idx) => {
                    const selected = idx === activeSceneIndex;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => {
                          setActiveSceneIndex(idx);
                          setIsPlayingMotion(false);
                        }}
                        className={cn(
                          "rounded-xl border p-3.5 text-left transition",
                          selected
                            ? "border-cyan-400/60 bg-cyan-500/[0.08]"
                            : "border-white/[0.07] bg-[#0C0C10] hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-semibold text-cyan-300">
                            0{frame.sceneNumber} · {frame.timecode}
                          </span>
                          <span className="text-zinc-500">{frame.durationSec}s</span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-white">
                          {frame.title}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                          {frame.visualDirection}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
