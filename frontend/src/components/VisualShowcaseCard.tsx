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
  Edit3,
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
  Platform,
  PosterTheme,
  StoryboardFrame,
  VideoAspectRatio,
  VideoShotStyle,
  VisualCreative,
  VisualOption,
} from "@/types/campaign";
import { cn, copyTextToClipboard } from "@/lib/utils";
import { VideoStudioPlayer } from "@/components/VideoStudioPlayer";
import { getPosterMetadataForBrief, getProductVisualOptions } from "@/lib/productImagery";
import { copyAdPosterToClipboard, downloadAdPoster } from "@/lib/adPosterRenderer";

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
  const [activeTab, setActiveTab] = useState<"creatives" | "storyboard">("creatives");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
  const [previewAspect, setPreviewAspect] = useState<"4:5" | "1:1" | "16:9" | "9:16">("4:5");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPoster, setCopiedPoster] = useState(false);
  const [isExportingPoster, setIsExportingPoster] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlayingMotion, setIsPlayingMotion] = useState(false);

  // Poster Customization State
  const [showPosterOverlay, setShowPosterOverlay] = useState(true);
  const [selectedPosterTheme, setSelectedPosterTheme] = useState<PosterTheme>("billboard");
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState(0);
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);
  const [customHeadline, setCustomHeadline] = useState<string | null>(null);

  // Derived options and poster metadata
  const fallbackOptions = useMemo(
    () => getProductVisualOptions(brief, campaignId || "camp_default"),
    [brief, campaignId]
  );

  const posterMeta = useMemo(
    () => getPosterMetadataForBrief(brief),
    [brief]
  );

  const defaultInitialCreative: VisualCreative = useMemo(() => {
    const opt = fallbackOptions[0];
    return {
      id: `${campaignId || "camp"}-init-1`,
      title: `${brief.productName} — Launch Key Visual`,
      subtitle: `${brief.platforms[0] || "Instagram"} Concept · Commercial Ad Poster`,
      format: "4:5 Commercial Poster",
      aspectRatio: "4:5",
      platform: (brief.platforms[0] as Platform) || "Instagram",
      imageUrl: opt?.imageUrl || "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
      options: fallbackOptions,
      headline: posterMeta.headlines[0],
      tagline: posterMeta.tagline,
      badge: posterMeta.badge,
      ctaText: posterMeta.ctaText,
      features: posterMeta.features,
      posterTheme: "billboard",
      lighting: "Studio high-contrast rim lighting",
      composition: "Commercial advertising poster hierarchy with kicker badge & feature pills",
      artNote: "High-impact advertising poster layout with dynamic typography",
      promptSummary: `${brief.brandTone} commercial poster for ${brief.productName}`,
    };
  }, [brief, campaignId, fallbackOptions, posterMeta]);

  const displayCreatives = useMemo(() => {
    return creatives.length > 0 ? creatives : [defaultInitialCreative];
  }, [creatives, defaultInitialCreative]);

  useEffect(() => {
    setSelectedIndex(0);
    setSelectedStyleIndex(0);
    setActiveSceneIndex(0);
    setSelectedHeadlineIndex(0);
    setCustomHeadline(null);
    setIsPlayingMotion(false);
  }, [displayCreatives.length, storyboard.length]);

  const activeCreative = displayCreatives[selectedIndex] ?? displayCreatives[0];
  const activeScene = storyboard[activeSceneIndex] ?? storyboard[0];

  const currentOptions: VisualOption[] = useMemo(() => {
    if (activeCreative?.options && activeCreative.options.length > 0) {
      return activeCreative.options;
    }
    return fallbackOptions;
  }, [activeCreative, fallbackOptions]);

  const activeOption =
    currentOptions[selectedStyleIndex] ?? currentOptions[0];

  const activeImageUrl = activeOption?.imageUrl || activeCreative?.imageUrl || "";

  // Dynamic Poster Copy resolution
  const activeHeadline = useMemo(() => {
    if (customHeadline) return customHeadline;
    if (activeCreative?.headline && selectedHeadlineIndex === 0) return activeCreative.headline;
    return posterMeta.headlines[selectedHeadlineIndex] ?? posterMeta.headlines[0];
  }, [customHeadline, activeCreative, posterMeta, selectedHeadlineIndex]);

  const activeBadge = activeCreative?.badge || posterMeta.badge;
  const activeTagline = activeCreative?.tagline || posterMeta.tagline;
  const activeFeatures = activeCreative?.features || posterMeta.features;
  const activeCta = activeCreative?.ctaText || posterMeta.ctaText;

  // Play motion preview for storyboard beats
  useEffect(() => {
    if (!isPlayingMotion || storyboard.length === 0) return;
    const interval = setInterval(() => {
      setActiveSceneIndex((prev) => (prev + 1) % storyboard.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlayingMotion, storyboard.length]);

  const handlePrev = () => {
    if (displayCreatives.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + displayCreatives.length) % displayCreatives.length);
    setSelectedStyleIndex(0);
  };

  const handleNext = () => {
    if (displayCreatives.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % displayCreatives.length);
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

  const handleDownloadCleanImage = () => {
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

  const handleDownloadPoster = async () => {
    if (!activeImageUrl) return;
    setIsExportingPoster(true);
    try {
      await downloadAdPoster({
        productName: brief.productName,
        headline: activeHeadline,
        subheadline: activeTagline,
        badge: activeBadge,
        ctaText: activeCta,
        features: activeFeatures,
        theme: selectedPosterTheme,
        imageUrl: activeImageUrl,
        aspectRatio: previewAspect,
        platform: activeCreative?.platform,
        brandTone: brief.brandTone,
      });
    } finally {
      setIsExportingPoster(false);
    }
  };

  const handleCopyPosterToClipboard = async () => {
    if (!activeImageUrl) return;
    const ok = await copyAdPosterToClipboard({
      productName: brief.productName,
      headline: activeHeadline,
      subheadline: activeTagline,
      badge: activeBadge,
      ctaText: activeCta,
      features: activeFeatures,
      theme: selectedPosterTheme,
      imageUrl: activeImageUrl,
      aspectRatio: previewAspect,
      platform: activeCreative?.platform,
      brandTone: brief.brandTone,
    });
    if (ok) {
      setCopiedPoster(true);
      setTimeout(() => setCopiedPoster(false), 2000);
    }
  };

  const aspectClass = useMemo(() => {
    if (previewAspect === "4:5") return "aspect-[4/5] max-h-[580px]";
    if (previewAspect === "1:1") return "aspect-square max-h-[500px]";
    if (previewAspect === "9:16") return "aspect-[9/16] max-h-[600px]";
    if (previewAspect === "16:9") return "aspect-[16/9] max-h-[460px]";
    return "aspect-[4/5] max-h-[580px]";
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
              Commercial ad posters &amp; video studio
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
            <span>Ad Posters ({displayCreatives.length})</span>
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

      <div className="flex flex-1 flex-col gap-4 p-5">
        {isLoading && creatives.length === 0 && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              <span className="font-medium">Streaming creative concepts…</span>
            </div>
          </div>
        )}

        {activeTab === "creatives" && activeCreative ? (
          <>
            {/* Placement & Ratio Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-neutral-400">
                  Placement:
                </span>
                <div className="flex flex-wrap gap-1">
                  {displayCreatives.map((creative, idx) => {
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
                            ? "bg-neutral-900 text-white shadow-sm"
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
                  { label: "4:5", val: "4:5" },
                  { label: "1:1", val: "1:1" },
                  { label: "9:16", val: "9:16" },
                  { label: "16:9", val: "16:9" },
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

            {/* Poster Style Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-neutral-400">
                  Theme:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: "billboard" as PosterTheme, label: "Billboard" },
                    { id: "swiss" as PosterTheme, label: "Swiss" },
                    { id: "luxury" as PosterTheme, label: "Luxury" },
                    { id: "cyber" as PosterTheme, label: "Cyber" },
                  ].map((theme) => {
                    const isSelected = selectedPosterTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedPosterTheme(theme.id)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium transition",
                          isSelected
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-600 hover:bg-neutral-100 border border-black/[0.06]"
                        )}
                      >
                        {theme.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* View Toggle */}
              <button
                type="button"
                onClick={() => setShowPosterOverlay((p) => !p)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition border",
                  showPosterOverlay
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-600 border-black/[0.08] hover:bg-neutral-50"
                )}
              >
                {showPosterOverlay ? "Poster View ✓" : "Photo Only"}
              </button>
            </div>

            {/* Poster Canvas Stage */}
            <div className="relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-[#09090C] shadow-sm">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeCreative.id}-${activeOption?.id || selectedStyleIndex}-${selectedPosterTheme}-${showPosterOverlay}`}
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    "relative w-full overflow-hidden transition-all duration-300 select-none",
                    aspectClass
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeImageUrl}
                    alt={activeOption?.label || activeCreative.title}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.01]"
                  />

                  {/* Graphic Design Poster Overlay */}
                  {showPosterOverlay && (
                    <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
                      {selectedPosterTheme === "billboard" && (
                        <>
                          <div className="absolute inset-2 sm:inset-3 border border-white/20 rounded-xl pointer-events-none" />
                          <div className="relative z-10 flex items-center justify-between gap-2 pointer-events-auto">
                            <div className="rounded-lg bg-black/80 backdrop-blur-md px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                              {brief.productName || "PRODUCT"}
                            </div>
                            <div className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-900 shadow-sm">
                              {activeBadge}
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />
                          <div className="relative z-10 flex flex-col gap-2 pt-10 pointer-events-auto">
                            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                              {activeHeadline}
                            </h2>
                            <p className="text-xs sm:text-sm text-white/80 line-clamp-2 max-w-xl">
                              {activeTagline}
                            </p>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {activeFeatures.slice(0, 3).map((feat) => (
                                <span
                                  key={feat}
                                  className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md"
                                >
                                  {feat}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-white">
                              <span className="text-[10px] text-white/60">
                                Available Globally
                              </span>
                              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900">
                                {activeCta}
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedPosterTheme === "swiss" && (
                        <>
                          <div className="absolute inset-3 border border-white/25 rounded-lg pointer-events-none" />
                          <div className="relative z-10 flex items-center justify-between border-b border-white/20 pb-2 pointer-events-auto">
                            <span className="text-xs font-medium uppercase tracking-widest text-white">
                              {brief.productName}
                            </span>
                            <span className="text-[11px] text-white/70">
                              {activeBadge}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
                          <div className="relative z-10 flex flex-col gap-2 pt-10 pointer-events-auto">
                            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                              {activeHeadline}
                            </h2>
                            <p className="text-xs sm:text-sm text-white/80 max-w-lg">
                              {activeTagline}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/15">
                              {activeFeatures.slice(0, 3).map((feat) => (
                                <div key={feat} className="text-[11px] text-white/80">
                                  {feat}
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between border-t border-white/20 pt-2 text-white">
                              <span className="text-[10px] text-white/60">
                                Edition 01
                              </span>
                              <span className="text-xs font-medium text-white underline underline-offset-4">
                                {activeCta}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedPosterTheme === "luxury" && (
                        <>
                          <div className="absolute inset-3 border border-[#D4AF37]/60 rounded-xl pointer-events-none" />
                          <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-auto">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37]">
                              Excellence
                            </span>
                            <h3 className="mt-0.5 text-sm font-semibold tracking-wider text-white">
                              {brief.productName}
                            </h3>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />
                          <div className="relative z-10 flex flex-col items-center text-center gap-2 pt-6 pointer-events-auto">
                            <h2 className="text-xl sm:text-3xl font-medium tracking-wide text-white max-w-lg leading-tight">
                              {activeHeadline}
                            </h2>
                            <p className="text-xs sm:text-sm text-[#D4AF37] max-w-md">
                              {activeTagline}
                            </p>
                            <div className="mt-1 rounded-full border border-[#D4AF37] bg-black/60 px-5 py-1 text-xs font-medium text-[#D4AF37] backdrop-blur-md">
                              {activeCta}
                            </div>
                          </div>
                        </>
                      )}

                      {selectedPosterTheme === "cyber" && (
                        <>
                          <div className="absolute left-3 top-3 w-5 h-5 border-l-2 border-t-2 border-[#06B6D4] pointer-events-none" />
                          <div className="absolute right-3 top-3 w-5 h-5 border-r-2 border-t-2 border-[#06B6D4] pointer-events-none" />
                          <div className="absolute left-3 bottom-3 w-5 h-5 border-l-2 border-b-2 border-[#06B6D4] pointer-events-none" />
                          <div className="absolute right-3 bottom-3 w-5 h-5 border-r-2 border-b-2 border-[#06B6D4] pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />
                          <div className="relative z-10 flex flex-col gap-2 pt-6 pointer-events-auto">
                            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white drop-shadow">
                              {activeHeadline}
                            </h2>
                            <p className="text-xs sm:text-sm text-white/80 max-w-lg">
                              {activeTagline}
                            </p>
                            <div className="flex items-center justify-between border-t border-[#06B6D4]/40 pt-2 text-[#06B6D4]">
                              <span className="text-[10px] text-white/60">
                                System Active
                              </span>
                              <div className="rounded-md bg-[#06B6D4] px-3 py-0.5 text-xs font-semibold text-black">
                                {activeCta}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!showPosterOverlay && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 pt-12">
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                        {activeOption?.label || "Packshot"}
                      </span>
                      <h4 className="mt-1 text-base font-semibold text-white sm:text-lg">
                        {activeCreative.title}
                      </h4>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Carousel Navigation */}
              {displayCreatives.length > 1 && (
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

            {/* Poster Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] px-3.5 py-2">
              <span className="text-xs font-medium text-neutral-500">
                Commercial Output
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPosterToClipboard}
                  className="flex h-7 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                >
                  {copiedPoster ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-neutral-400" />
                      <span>Copy Poster</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPoster}
                  disabled={isExportingPoster}
                  className="flex h-7 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  <span>{isExportingPoster ? "Rendering..." : "Download Poster (PNG)"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCleanImage}
                  title="Download Clean Photo"
                  className="flex h-7 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                >
                  <Download className="h-3 w-3 text-neutral-400" />
                  <span>Photo (JPG)</span>
                </button>

                <a
                  href={activeImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Full Resolution"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Headline Switcher */}
            <div className="space-y-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1D1D1F]">
                  Poster Headlines
                </span>
                <span className="text-[11px] text-neutral-400">
                  Select to change poster copy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {posterMeta.headlines.map((hl, idx) => {
                  const isSelected = selectedHeadlineIndex === idx && !customHeadline;
                  return (
                    <button
                      key={hl}
                      type="button"
                      onClick={() => {
                        setSelectedHeadlineIndex(idx);
                        setCustomHeadline(null);
                        setIsEditingHeadline(false);
                      }}
                      className={cn(
                        "rounded-xl border p-2.5 text-left text-xs transition",
                        isSelected
                          ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900 font-semibold"
                          : "border-black/[0.06] bg-white hover:bg-neutral-50 text-neutral-700"
                      )}
                    >
                      {hl}
                    </button>
                  );
                })}
              </div>

              {isEditingHeadline ? (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customHeadline ?? activeHeadline}
                    onChange={(e) => setCustomHeadline(e.target.value)}
                    placeholder="Enter custom headline..."
                    className="flex-1 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-xs text-[#1D1D1F] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingHeadline(false)}
                    className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingHeadline(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Custom Headline</span>
                  </button>
                </div>
              )}
            </div>

            {/* Visual Angles Variations */}
            <div className="space-y-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1D1D1F]">
                  Photography Angles ({currentOptions.length})
                </span>
                <span className="text-[11px] text-neutral-400">
                  Select photo for ad poster
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
    </div>
  );
}
