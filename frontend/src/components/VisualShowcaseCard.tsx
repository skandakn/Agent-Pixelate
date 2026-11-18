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
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-apple">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F]">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
                Visual Showcase
              </h3>
              <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 font-mono text-[10px] font-medium text-[#6E6E73]">
                @VisualAgent
              </span>
            </div>
            <p className="text-[12px] text-[#6E6E73]">
              Art-directed creatives, color system &amp; 15s storyboard
            </p>
          </div>
        </div>

        {/* Classic Apple Segmented Switcher */}
        <div className="flex rounded-full bg-[#F5F5F7] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("creatives")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
              activeTab === "creatives"
                ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Creatives ({creatives.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
              activeTab === "storyboard"
                ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Video Studio</span>
            {videos.length > 0 && (
              <span className="rounded-full bg-[#248A3D]/12 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#1D6F31]">
                MP4
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Loading / Empty State */}
      {creatives.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          {isLoading ? (
            <>
              <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-[#0071E3]/[0.1] text-[#0071E3]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                Composing key visuals and lighting grids…
              </p>
              <p className="text-[13px] text-[#6E6E73]">
                @VisualAgent is rendering aspect creatives, swatches, and motion frames.
              </p>
            </>
          ) : (
            <p className="text-[14px] text-[#86868B]">
              Visual assets will appear here once agents launch.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-6">
          {activeTab === "creatives" && activeCreative ? (
            <>
              {/* Hero Gallery Stage */}
              <div className="relative overflow-hidden rounded-[18px] border border-black/[0.06] bg-[#1D1D1F]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCreative.id}
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.25 }}
                    className="relative aspect-[16/10] w-full overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeCreative.imageUrl}
                      alt={activeCreative.title}
                      className="h-full w-full object-cover"
                    />

                    {/* Subtle Editorial Caption Scrim */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-5 pt-14">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                            {activeCreative.platform} · {activeCreative.aspectRatio}
                          </span>
                          <h4 className="mt-2 text-[16px] font-semibold tracking-[-0.015em] text-white sm:text-[18px]">
                            {activeCreative.title}
                          </h4>
                          <p className="text-[12px] text-white/80">
                            {activeCreative.subtitle}
                          </p>
                        </div>
                        <span className="rounded-full bg-black/40 px-2.5 py-1 font-mono text-[11px] text-white/90 backdrop-blur-md">
                          {selectedIndex + 1} / {creatives.length}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Apple-Style Translucent Circular Gallery Arrows */}
                {creatives.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous creative"
                      className="absolute left-3.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#1D1D1F] shadow-md backdrop-blur-md transition hover:bg-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next creative"
                      className="absolute right-3.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#1D1D1F] shadow-md backdrop-blur-md transition hover:bg-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Clean Thumbnail Strip */}
              <div className="grid grid-cols-3 gap-3">
                {creatives.map((creative, idx) => {
                  const selected = idx === selectedIndex;
                  return (
                    <button
                      key={creative.id}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={cn(
                        "group overflow-hidden rounded-2xl border text-left transition",
                        selected
                          ? "border-[#0071E3] ring-2 ring-[#0071E3]/20"
                          : "border-black/[0.08] opacity-80 hover:border-black/[0.2] hover:opacity-100"
                      )}
                    >
                      <div className="aspect-[16/10] w-full overflow-hidden bg-[#F5F5F7]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={creative.imageUrl}
                          alt={creative.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="bg-white px-3 py-2">
                        <div className="truncate text-[12px] font-medium text-[#1D1D1F]">
                          {creative.platform}
                        </div>
                        <div className="text-[11px] text-[#86868B]">
                          {creative.format}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Color Palette System */}
              <div className="space-y-3 rounded-2xl bg-[#F5F5F7] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                    Color System
                  </span>
                  <span className="text-[11px] text-[#6E6E73]">
                    {copiedHex ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#248A3D]">
                        <Check className="h-3 w-3" />
                        Copied {copiedHex}
                      </span>
                    ) : (
                      "Click swatch to copy hex"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {palette.map((swatch) => {
                    const isCopied = copiedHex === swatch.hex;
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => handleCopyHex(swatch.hex)}
                        className="group flex flex-col overflow-hidden rounded-xl border border-black/[0.06] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div
                          className="relative h-11 w-full"
                          style={{ backgroundColor: swatch.hex }}
                        >
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-[#1D1D1F] opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                            {isCopied ? (
                              <Check className="h-3 w-3 text-[#248A3D]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </span>
                        </div>
                        <div className="p-2">
                          <div className="font-mono text-[11px] font-semibold text-[#1D1D1F]">
                            {swatch.hex}
                          </div>
                          <div className="truncate text-[10px] text-[#6E6E73]">
                            {swatch.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Art Direction Specifications */}
              <div className="space-y-3 rounded-2xl bg-[#F5F5F7] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                    Art Direction Notes
                  </span>
                  <span className="text-[11px] text-[#86868B]">
                    {activeCreative.format}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-[#424245]">
                  {activeCreative.artNote || artDirectionSummary}
                </p>
                <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-medium text-[#86868B]">
                      Lighting
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#1D1D1F]">
                      {activeCreative.lighting}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-medium text-[#86868B]">
                      Composition
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#1D1D1F]">
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
                  <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                    Director&apos;s Storyboard (4 Continuous Beats)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlayingMotion((p) => !p)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F7] px-3 py-1 text-[11px] font-medium text-[#0066CC] transition hover:bg-black/[0.06]"
                  >
                    {isPlayingMotion ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Pause Beats</span>
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
                  <div className="rounded-2xl bg-[#F5F5F7] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F]">
                        <Clapperboard className="h-3.5 w-3.5 text-[#0071E3]" />
                        Scene 0{activeScene.sceneNumber} · {activeScene.timecode} · {activeScene.title}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73] shadow-sm">
                        {activeScene.captionOverlay}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#424245]">
                      {activeScene.visualDirection}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-medium text-[#1D1D1F] shadow-sm">
                        <Camera className="h-3.5 w-3.5 shrink-0 text-[#6E6E73]" />
                        <span className="truncate">{activeScene.cameraMove}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-medium text-[#1D1D1F] shadow-sm">
                        <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#6E6E73]" />
                        <span className="truncate">{activeScene.audioCue}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          "rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-[#0071E3] bg-[#0071E3]/[0.05]"
                            : "border-black/[0.06] bg-[#F5F5F7] hover:border-black/[0.15]"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-medium text-[#0066CC]">
                            0{frame.sceneNumber} · {frame.timecode}
                          </span>
                          <span className="text-[#86868B]">{frame.durationSec}s</span>
                        </div>
                        <div className="mt-1.5 text-[13px] font-semibold text-[#1D1D1F]">
                          {frame.title}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6E6E73]">
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
