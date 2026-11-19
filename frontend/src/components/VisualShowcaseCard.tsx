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
    setActiveSceneIndex(0);
    setIsPlayingMotion(false);
  }, [creatives.length, storyboard.length]);

  const activeCreative = creatives[selectedIndex] ?? creatives[0];
  const activeScene = storyboard[activeSceneIndex] ?? storyboard[0];

  const currentOptions: VisualOption[] = useMemo(() => {
    if (activeCreative?.options && activeCreative.options.length > 0) {
      return activeCreative.options;
    }
    return fallbackOptions;
  }, [activeCreative, fallbackOptions]);

  const activeOption = currentOptions[selectedStyleIndex] ?? currentOptions[0];
  const activeImageUrl = activeOption?.imageUrl || activeCreative?.imageUrl || "";

  useEffect(() => {
    if (!isPlayingMotion || storyboard.length === 0) return;
    const current = storyboard[activeSceneIndex];
    const durationMs = Math.max(1800, (current?.durationSec ?? 3) * 850);
    const timer = setTimeout(() => {
      setActiveSceneIndex((prev) => (prev + 1) % storyboard.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isPlayingMotion, activeSceneIndex, storyboard]);

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
    <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
      {/* Approva Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E6F7EB] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_#000000]">
            <Layers className="h-4 w-4 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                VISUAL SHOWCASE &amp; PRODUCT CREATIVES
              </h3>
              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                @VisualAgent
              </span>
            </div>
            <p className="font-mono text-xs text-black/70">
              High-fidelity product photography, visual options &amp; 10s video studio
            </p>
          </div>
        </div>

        {/* Brutalist Switcher */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("creatives")}
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition",
              activeTab === "creatives"
                ? "bg-black text-white shadow-[2px_2px_0px_#00E599]"
                : "bg-white text-black hover:bg-[#F0FDF4]"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Creatives ({creatives.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition",
              activeTab === "storyboard"
                ? "bg-black text-white shadow-[2px_2px_0px_#00E599]"
                : "bg-white text-black hover:bg-[#F0FDF4]"
            )}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Video Studio</span>
            {videos.length > 0 && (
              <span className="border border-black bg-[#00E599] px-1 font-mono text-[9px] font-black text-black">
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
              <div className="flex h-12 w-12 animate-pulse items-center justify-center border-2 border-black bg-[#E6F7EB] text-black shadow-[2px_2px_0px_#000000]">
                <Sparkles className="h-5 w-5 text-[#00A86B]" />
              </div>
              <p className="font-display text-sm font-black uppercase text-black">
                Rendering photorealistic product visuals…
              </p>
              <p className="font-mono text-xs text-black/70">
                @VisualAgent is composing studio packshots, lifestyle frames &amp; style variations.
              </p>
            </>
          ) : (
            <p className="font-mono text-xs text-black/60">
              Visual assets will appear here once agents launch.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-5">
          {activeTab === "creatives" && activeCreative ? (
            <>
              {/* Concept Angle & Aspect Ratio Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#F8FAFC] p-3 shadow-[2px_2px_0px_#000000]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase text-black">
                    Placement:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
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
                            "border-2 border-black px-2.5 py-1 font-mono text-xs font-bold uppercase transition",
                            selected
                              ? "bg-[#00E599] text-black shadow-[2px_2px_0px_#000000]"
                              : "bg-white text-black hover:bg-[#E6F7EB]"
                          )}
                        >
                          {creative.platform}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aspect Ratio Framing Options */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold uppercase text-black/70">
                    Frame:
                  </span>
                  {[
                    { label: "Default", val: "16/10" },
                    { label: "4:5 Feed", val: "4:5" },
                    { label: "1:1 Square", val: "1:1" },
                    { label: "16:9 Cinema", val: "16:9" },
                    { label: "9:16 Reel", val: "9:16" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setPreviewAspect(item.val as any)}
                      className={cn(
                        "border border-black px-2 py-0.5 font-mono text-[11px] font-bold uppercase transition",
                        (previewAspect as string) === item.val
                          ? "bg-black text-white shadow-[1px_1px_0px_#000000]"
                          : "bg-white text-black hover:bg-[#E6F7EB]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero Photographic Stage */}
              <div className="relative mx-auto flex w-full items-center justify-center overflow-hidden border-2 border-black bg-[#0E0E12] shadow-[3px_3px_0px_#000000]">
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
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                    />

                    {/* Gradient Editorial Caption Scrim */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 pt-14">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="border border-white/60 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white backdrop-blur-md">
                              {activeCreative.platform}
                            </span>
                            <span className="border border-black bg-[#00E599] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black backdrop-blur-md">
                              {activeOption?.label || "Studio Packshot"}
                            </span>
                          </div>
                          <h4 className="mt-2 font-display text-base font-bold uppercase tracking-tight text-white sm:text-lg">
                            {activeCreative.title}
                          </h4>
                          <p className="mt-0.5 font-mono text-xs text-white/90 line-clamp-1">
                            {activeOption?.description || activeCreative.subtitle}
                          </p>
                        </div>

                        {/* Quick Action Overlay */}
                        <div className="pointer-events-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            title="Copy High-Res Image URL"
                            className="flex h-8 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#E6F7EB]"
                          >
                            {copiedUrl ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-[#00A86B]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadImage}
                            title="Download Image File"
                            className="flex h-8 items-center gap-1.5 border-2 border-black bg-[#00E599] px-3 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#00D08A]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </button>
                          <a
                            href={activeImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open Full Resolution in New Tab"
                            className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#E6F7EB]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Left/Right Carousel Nav */}
                {creatives.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous placement creative"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#E6F7EB]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next placement creative"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#E6F7EB]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Product Visual Style Options (The user requested options!) */}
              <div className="space-y-3 border-2 border-black bg-[#F8FAFC] p-4 shadow-[2px_2px_0px_#000000]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-black" />
                    <span className="font-display text-xs font-black uppercase tracking-tight text-black">
                      PRODUCT VISUAL OPTIONS &amp; ANGLES ({currentOptions.length} VARIATIONS)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-black/60">
                    Click any variation to switch style
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {currentOptions.map((opt, idx) => {
                    const isSelected = idx === selectedStyleIndex;
                    return (
                      <button
                        key={opt.id || opt.style || idx}
                        type="button"
                        onClick={() => setSelectedStyleIndex(idx)}
                        className={cn(
                          "group flex flex-col overflow-hidden border-2 text-left transition-all",
                          isSelected
                            ? "border-black bg-white shadow-[3px_3px_0px_#00E599] -translate-y-0.5"
                            : "border-black/30 bg-white hover:border-black hover:shadow-[2px_2px_0px_#000000]"
                        )}
                      >
                        {/* Option Thumbnail */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={opt.imageUrl}
                            alt={opt.label}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {isSelected && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center border border-black bg-[#00E599] text-black shadow-sm">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}
                          <span className="absolute bottom-1 left-1 border border-black bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                            0{idx + 1}
                          </span>
                        </div>

                        {/* Option Label & Style */}
                        <div className="p-2.5">
                          <div className="font-mono text-[11px] font-bold uppercase text-black">
                            {opt.label}
                          </div>
                          <p className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-snug text-black/70">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Art Direction & Photography Specifications */}
              <div className="space-y-3 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#000000]">
                <div className="flex items-center justify-between border-b border-black/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-black" />
                    <span className="font-display text-xs font-black uppercase text-black">
                      STUDIO ART DIRECTION SPECIFICATIONS
                    </span>
                  </div>
                  <span className="border border-black bg-[#E6F7EB] px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                    {activeOption?.label || activeCreative.format}
                  </span>
                </div>

                <p className="font-mono text-xs leading-relaxed text-black/80">
                  {activeOption?.description || activeCreative.artNote || artDirectionSummary}
                </p>

                <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                  <div className="border border-black bg-[#F8FAFC] p-3 shadow-[1px_1px_0px_#000000]">
                    <div className="font-mono text-[10px] font-bold uppercase text-black/60">
                      Lighting Setup
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-semibold text-black">
                      {activeOption?.lighting || activeCreative.lighting}
                    </div>
                  </div>
                  <div className="border border-black bg-[#F8FAFC] p-3 shadow-[1px_1px_0px_#000000]">
                    <div className="font-mono text-[10px] font-bold uppercase text-black/60">
                      Composition &amp; Framing
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-semibold text-black">
                      {activeOption?.composition || activeCreative.composition}
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
                palette={[]}
                videos={videos}
                isLiveBackend={isLiveBackend}
                isRenderingCut={isRenderingCut}
                renderError={renderError}
                onRenderCustomCut={onRenderCustomCut}
              />

              {/* Interactive Director's Storyboard Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-black uppercase text-black">
                    Director&apos;s Storyboard (4 Continuous Beats)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlayingMotion((p) => !p)}
                    className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#E6F7EB]"
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
                  <div className="border-2 border-black bg-[#F8FAFC] p-4 shadow-[2px_2px_0px_#000000]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-black">
                        <Clapperboard className="h-3.5 w-3.5 text-black" />
                        Scene 0{activeScene.sceneNumber} · {activeScene.timecode} · {activeScene.title}
                      </span>
                      <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                        {activeScene.captionOverlay}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs leading-relaxed text-black/80">
                      {activeScene.visualDirection}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 border border-black bg-white px-3 py-2 font-mono text-xs font-semibold text-black">
                        <Camera className="h-3.5 w-3.5 shrink-0 text-black/60" />
                        <span className="truncate">{activeScene.cameraMove}</span>
                      </div>
                      <div className="flex items-center gap-2 border border-black bg-white px-3 py-2 font-mono text-xs font-semibold text-black">
                        <Volume2 className="h-3.5 w-3.5 shrink-0 text-black/60" />
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
                          "border-2 p-3 text-left transition",
                          selected
                            ? "border-black bg-[#00E599]/20 shadow-[3px_3px_0px_#000000]"
                            : "border-black/30 bg-white hover:border-black hover:shadow-[2px_2px_0px_#000000]"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-black">
                            0{frame.sceneNumber} · {frame.timecode}
                          </span>
                          <span className="font-mono text-black/60">{frame.durationSec}s</span>
                        </div>
                        <div className="mt-1 font-mono text-xs font-bold text-black">
                          {frame.title}
                        </div>
                        <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-black/70">
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
