"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Palette,
  Sparkles,
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
    <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
      {/* Approva Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E6F7EB] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_#000000]">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                VISUAL &amp; MOTION ASSET SUITE
              </h3>
              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                @VisualAgent
              </span>
            </div>
            <p className="font-mono text-xs text-black/70">
              Art-directed aspect ratios, branded swatches &amp; 10s video studio
            </p>
          </div>
        </div>

        {/* Brutalist Switcher */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("creatives")}
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition-all",
              activeTab === "creatives"
                ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                : "bg-white text-black hover:bg-gray-100"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>CREATIVES ({creatives.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition-all",
              activeTab === "storyboard"
                ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                : "bg-white text-black hover:bg-gray-100"
            )}
          >
            <Film className="h-3.5 w-3.5" />
            <span>VIDEO STUDIO</span>
            {videos.length > 0 && (
              <span className="border border-black bg-black px-1 text-[9px] text-white">
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
              <div className="flex h-12 w-12 animate-pulse items-center justify-center border-2 border-black bg-[#FEF3C7] text-black shadow-[3px_3px_0px_#000000]">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="font-display text-base font-black uppercase text-black">
                Composing Visual Assets &amp; Lighting Grids...
              </p>
              <p className="font-mono text-xs text-black/70">
                @VisualAgent is synthesizing aspect creatives, color tokens, and motion storyboard.
              </p>
            </>
          ) : (
            <div className="border-2 border-dashed border-black/40 bg-[#E6F7EB]/30 p-8">
              <p className="font-mono text-xs font-bold text-black/60">
                [NO ASSETS LOADED] Dispatch campaign from the brief to render creatives.
              </p>
            </div>
          )}
        </div>
      ) : activeTab === "creatives" ? (
        <div className="space-y-4 p-5">
          {/* Main Hero Viewer */}
          <div className="relative border-2 border-black bg-black shadow-[3px_3px_0px_#000000]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCreative.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative aspect-[16/10] w-full overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeCreative.imageUrl}
                  alt={activeCreative.title}
                  className="h-full w-full object-cover"
                />

                {/* Approva Brutalist Caption Box */}
                <div className="absolute inset-x-0 bottom-0 border-t-2 border-black bg-white/95 p-3.5 backdrop-blur-sm">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <span className="border border-black bg-[#10B981] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                        {activeCreative.platform} · {activeCreative.aspectRatio}
                      </span>
                      <h4 className="mt-1 font-display text-base font-black uppercase tracking-tight text-black">
                        {activeCreative.title}
                      </h4>
                      <p className="font-mono text-xs text-black/80">
                        {activeCreative.subtitle}
                      </p>
                    </div>
                    <span className="border border-black bg-white px-2 py-1 font-mono text-[11px] font-bold text-black shadow-[1px_1px_0px_#000000]">
                      {selectedIndex + 1} / {creatives.length}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Brutalist Gallery Buttons */}
            {creatives.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous creative"
                  className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next creative"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Brutalist Thumbnail Row */}
          <div className="grid grid-cols-3 gap-3">
            {creatives.map((creative, idx) => {
              const selected = idx === selectedIndex;
              return (
                <button
                  key={creative.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={cn(
                    "group overflow-hidden border-2 border-black text-left transition-all",
                    selected
                      ? "bg-[#D1FAE5] shadow-[3px_3px_0px_#000000] ring-2 ring-black"
                      : "bg-white opacity-85 shadow-[2px_2px_0px_#000000] hover:opacity-100 hover:translate-x-[1px] hover:translate-y-[1px]"
                  )}
                >
                  <div className="aspect-[16/10] w-full overflow-hidden border-b-2 border-black bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creative.imageUrl}
                      alt={creative.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2">
                    <div className="truncate font-display text-xs font-bold uppercase text-black">
                      {creative.platform}
                    </div>
                    <div className="font-mono text-[10px] text-black/60">
                      {creative.format}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Color Palette Matrix */}
          <div className="space-y-2 border-2 border-black bg-[#E6F7EB]/40 p-3.5 shadow-[2px_2px_0px_#000000]">
            <div className="flex items-center justify-between border-b border-black pb-1.5">
              <span className="font-display text-xs font-black uppercase text-black">
                APPROVED COLOR PALETTE TOKENS
              </span>
              <span className="font-mono text-[11px] text-black/70">
                {copiedHex ? (
                  <span className="font-bold text-[#10B981]">
                    COPIED {copiedHex}
                  </span>
                ) : (
                  "Click token to copy hex"
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {palette.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex)}
                  className="group flex flex-col border-2 border-black bg-white p-2 text-left shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  <div
                    className="h-7 w-full border border-black shadow-[1px_1px_0px_#000000]"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="mt-1.5 truncate font-display text-[11px] font-bold text-black">
                    {swatch.name}
                  </div>
                  <div className="font-mono text-[10px] text-black/60">
                    {swatch.hex}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Video Studio Tab */
        <div className="p-5">
          <VideoStudioPlayer
            campaignId={campaignId}
            brief={brief}
            storyboard={storyboard}
            videos={videos}
            creatives={creatives}
            isLiveBackend={isLiveBackend}
            isRenderingCut={isRenderingCut}
            renderError={renderError}
            onRenderCustomCut={onRenderCustomCut}
          />
        </div>
      )}
    </div>
  );
}
