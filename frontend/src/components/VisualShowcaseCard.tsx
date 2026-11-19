"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  Sparkles,
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
  VisualOption,
} from "@/types/campaign";
import { cn, copyTextToClipboard } from "@/lib/utils";
import { VideoStudioPlayer } from "@/components/VideoStudioPlayer";
import { getProductVisualOptions } from "@/lib/productImagery";

interface VisualShowcaseCardProps {
  campaignId: string | null;
  brief: CampaignBrief;
  creatives: VisualCreative[];
  videos: CampaignVideoAsset[];
  palette?: ColorSwatch[];
  artDirectionSummary: string;
  storyboard: StoryboardFrame[];
  isLoading: boolean;
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

export function VisualShowcaseCard({
  campaignId,
  brief,
  creatives,
  videos,
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
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
  const [previewAspect, setPreviewAspect] = useState<"4:5" | "1:1" | "16:9" | "9:16">("16/10" as any);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlayingMotion, setIsPlayingMotion] = useState(false);

  // Derived options for current creative
  const fallbackOptions = useMemo(
    () => getProductVisualOptions(brief, campaignId || "camp_default"),
    [brief, campaignId]
  );

  useEffect(() => {
    setSelectedIndex(0);
    setSelectedStyleIndex(0);
  }, [creatives.length]);

  const activeCreative = creatives[selectedIndex] ?? creatives[0];

  const currentOptions: VisualOption[] = useMemo(() => {
    if (activeCreative?.options && activeCreative.options.length > 0) {
      return activeCreative.options;
    }
    return fallbackOptions;
  }, [activeCreative, fallbackOptions]);

  const activeOption =
    currentOptions[selectedStyleIndex] ?? currentOptions[0];

  const activeImageUrl = activeOption?.imageUrl || activeCreative?.imageUrl || "";

  // Play motion preview for storyboard beats
  useEffect(() => {
    if (!isPlayingMotion || storyboard.length === 0) return;
    const interval = setInterval(() => {
      setActiveSceneIndex((prev) => (prev + 1) % storyboard.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlayingMotion, storyboard.length]);

  const activeScene = storyboard[activeSceneIndex] ?? storyboard[0];

  const handlePrev = () => {
    if (creatives.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + creatives.length) % creatives.length);
    setSelectedStyleIndex(0);
  };

  const handleNext = () => {
    if (creatives.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % creatives.length);
    setSelectedStyleIndex(0);
  };

  const handleCopyLink = async () => {
    if (!activeImageUrl) return;
    const ok = await copyTextToClipboard(activeImageUrl);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleDownloadImage = () => {
    if (!activeImageUrl) return;
    const cleanBrand = (brief.productName || "product").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const styleTag = activeOption?.style || "creative";
    const filename = `${cleanBrand}-${styleTag}.jpg`;

    const a = document.createElement("a");
    a.href = activeImageUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const aspectClass = useMemo(() => {
    if (previewAspect === "4:5") return "aspect-[4/5] max-h-[520px]";
    if (previewAspect === "1:1") return "aspect-square max-h-[480px]";
    if (previewAspect === "9:16") return "aspect-[9/16] max-h-[540px]";
    if (previewAspect === "16:9") return "aspect-[16/9] max-h-[440px]";
    return "aspect-[16/10] max-h-[480px]";
  }, [previewAspect]);

  return (
    <div className="flex flex-col rounded-2xl border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] bg-[#FBFBFD] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#1D1D1F]">
              Visual Showcase
            </h3>
            <p className="text-[11px] text-neutral-400">
              Photographic packshots &amp; video studio
            </p>
          </div>
        </div>

        {/* Minimalist Switcher */}
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("creatives")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all",
              activeTab === "creatives"
                ? "bg-white text-neutral-900 shadow-sm font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            <ImageIcon className="h-3 w-3" />
            <span>Creatives ({creatives.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all",
              activeTab === "storyboard"
                ? "bg-white text-neutral-900 shadow-sm font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            <Film className="h-3 w-3" />
            <span>Video Studio</span>
            {videos.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800">
                MP4
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Loading / Empty State */}
      {creatives.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
          {isLoading ? (
            <>
              <div className="flex h-9 w-9 animate-pulse items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-neutral-800">
                Generating visual packshots...
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400">
              Launch a campaign to generate visuals.
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-5">
          {activeTab === "creatives" && activeCreative ? (
            <>
              {/* Concept Angle & Aspect Ratio Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] px-3.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-400">
                    Platform:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {creatives.map((creative, idx) => {
                      const selected = idx === selectedIndex;
                      return (
                        <button
                          key={creative.id}
                          type="button"
                          onClick={() => {
                            setSelectedIndex(idx);
                            setSelectedStyleIndex(0);
                          }}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium transition",
                            selected
                              ? "bg-neutral-900 text-white"
                              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-black/[0.06]"
                          )}
                        >
                          {creative.platform}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aspect Ratio Framing Options */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-neutral-400">
                    Ratio:
                  </span>
                  {[
                    { label: "16:10", val: "16/10" },
                    { label: "4:5", val: "4:5" },
                    { label: "1:1", val: "1:1" },
                    { label: "16:9", val: "16:9" },
                    { label: "9:16", val: "9:16" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setPreviewAspect(item.val as any)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                        (previewAspect as string) === item.val
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-500 hover:bg-neutral-100"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero Photographic Stage */}
              <div className="relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-[#0E0E12] shadow-sm">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeCreative.id}-${activeOption?.id || selectedStyleIndex}`}
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={cn(
                      "relative w-full overflow-hidden transition-all duration-300",
                      aspectClass
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeImageUrl}
                      alt={activeOption?.label || activeCreative.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.01]"
                    />

                    {/* Gradient Caption Scrim */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 pt-12">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                              {activeCreative.platform}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-900 backdrop-blur-md">
                              {activeOption?.label || "Studio Packshot"}
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-base font-semibold text-white sm:text-lg">
                            {activeCreative.title}
                          </h4>
                        </div>

                        {/* Actions */}
                        <div className="pointer-events-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            title="Copy Image URL"
                            className="flex h-7 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-medium text-neutral-800 shadow-sm backdrop-blur-md transition hover:bg-white"
                          >
                            {copiedUrl ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-neutral-500" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadImage}
                            title="Download Image"
                            className="flex h-7 items-center gap-1.5 rounded-full bg-neutral-900 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-black"
                          >
                            <Download className="h-3 w-3" />
                            <span>Download</span>
                          </button>
                          <a
                            href={activeImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in New Tab"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm backdrop-blur-md transition hover:bg-white"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Carousel Navigation */}
                {creatives.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous creative"
                      className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-md backdrop-blur-md transition hover:bg-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next creative"
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-md backdrop-blur-md transition hover:bg-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Product Visual Style Options */}
              <div className="space-y-2.5 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    Visual Angles ({currentOptions.length})
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Click variation to switch
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {currentOptions.map((opt, idx) => {
                    const isSelected = idx === selectedStyleIndex;
                    return (
                      <button
                        key={opt.id || opt.style || idx}
                        type="button"
                        onClick={() => setSelectedStyleIndex(idx)}
                        className={cn(
                          "group flex flex-col overflow-hidden rounded-xl border text-left transition-all",
                          isSelected
                            ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900"
                            : "border-black/[0.06] bg-white hover:border-black/[0.12]"
                        )}
                      >
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={opt.imageUrl}
                            alt={opt.label}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {isSelected && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-[11px] font-semibold text-neutral-800">
                            {opt.label}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Art Direction Specs */}
              <div className="space-y-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    Art Direction
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                    {activeOption?.label || activeCreative.format}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-neutral-600">
                  {activeOption?.description || activeCreative.artNote || artDirectionSummary}
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-2.5 border border-black/[0.04]">
                    <div className="text-[10px] text-neutral-400">Lighting</div>
                    <div className="mt-0.5 text-xs font-medium text-neutral-800">
                      {activeOption?.lighting || activeCreative.lighting}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-black/[0.04]">
                    <div className="text-[10px] text-neutral-400">Composition</div>
                    <div className="mt-0.5 text-xs font-medium text-neutral-800">
                      {activeOption?.composition || activeCreative.composition}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Video Studio */
            <div className="space-y-4">
              <VideoStudioPlayer
                campaignId={campaignId}
                brief={brief}
                palette={[]}
                videos={videos}
                isLiveBackend={isLiveBackend}
                isRenderingCut={isRenderingCut}
                renderError={renderError}
                onRenderCustomCut={onRenderCustomCut}
              />

              {/* Storyboard Beats */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    Director Storyboard
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlayingMotion((p) => !p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm transition"
                  >
                    {isPlayingMotion ? (
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

                {activeScene && (
                  <div className="rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
                    <div className="flex items-center justify-between border-b border-black/[0.04] pb-2">
                      <span className="text-xs font-semibold text-[#1D1D1F]">
                        Scene 0{activeScene.sceneNumber} · {activeScene.timecode}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {activeScene.captionOverlay}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                      {activeScene.visualDirection}
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-2 border border-black/[0.04] text-xs text-neutral-700">
                        <span className="text-neutral-400">Camera: </span>
                        {activeScene.cameraMove}
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-black/[0.04] text-xs text-neutral-700">
                        <span className="text-neutral-400">Audio: </span>
                        {activeScene.audioCue}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                          "rounded-xl border p-3 text-left transition",
                          selected
                            ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900"
                            : "border-black/[0.06] bg-[#FBFBFD] hover:bg-neutral-100/60"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <span>0{frame.sceneNumber} · {frame.timecode}</span>
                          <span>{frame.durationSec}s</span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[#1D1D1F]">
                          {frame.title}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">
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
