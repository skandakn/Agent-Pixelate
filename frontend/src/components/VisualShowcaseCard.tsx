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
  RotateCcw,
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

  const activeOption = currentOptions[selectedStyleIndex] ?? currentOptions[0];
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
    if (displayCreatives.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + displayCreatives.length) % displayCreatives.length);
    setSelectedStyleIndex(0);
  };

  const handleNext = () => {
    if (displayCreatives.length === 0) return;
    setSelectedIndex((prev) => (prev + 1 + displayCreatives.length) % displayCreatives.length);
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
    if (previewAspect === "9:16") return "aspect-[9/16] max-h-[620px]";
    if (previewAspect === "16:9") return "aspect-[16/9] max-h-[460px]";
    return "aspect-[4/5] max-h-[580px]";
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
                COMMERCIAL AD POSTERS &amp; CREATIVE SHOWCASE
              </h3>
              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                @VisualAgent
              </span>
            </div>
            <p className="font-mono text-xs text-black/70">
              High-impact advertising posters, product photography &amp; 10s video studio
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
            <span>Ad Posters ({displayCreatives.length})</span>
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

      <div className="flex flex-1 flex-col gap-5 p-5">
        {isLoading && creatives.length === 0 && (
          <div className="flex items-center justify-between border-2 border-black bg-[#E6F7EB] px-3.5 py-2 font-mono text-xs shadow-[2px_2px_0px_#000000]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin text-[#00A86B]" />
              <span className="font-bold text-black uppercase">@VisualAgent Streaming Concepts…</span>
            </div>
            <span className="text-[11px] text-black/70">Live commercial poster draft rendered below</span>
          </div>
        )}
          {activeTab === "creatives" && activeCreative ? (
            <>
              {/* Placement & Ratio Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#F8FAFC] p-3 shadow-[2px_2px_0px_#000000]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase text-black">
                    Ad Placement:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
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
                    Ratio:
                  </span>
                  {[
                    { label: "4:5 Feed", val: "4:5" },
                    { label: "1:1 Square", val: "1:1" },
                    { label: "9:16 Reel", val: "9:16" },
                    { label: "16:9 Banner", val: "16:9" },
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

              {/* POSTER STYLE OPTIONS & CUSTOMIZER BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#E6F7EB] p-3 shadow-[2px_2px_0px_#000000]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-black">
                    <Wand2 className="h-3.5 w-3.5 text-black" />
                    <span>Poster Style:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "billboard" as PosterTheme, label: "Street Billboard" },
                      { id: "swiss" as PosterTheme, label: "Swiss Grid" },
                      { id: "luxury" as PosterTheme, label: "Luxury Editorial" },
                      { id: "cyber" as PosterTheme, label: "Cyber Tech HUD" },
                    ].map((theme) => {
                      const isSelected = selectedPosterTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setSelectedPosterTheme(theme.id)}
                          className={cn(
                            "border-2 border-black px-2.5 py-0.5 font-mono text-xs font-bold uppercase transition",
                            isSelected
                              ? "bg-black text-white shadow-[2px_2px_0px_#00E599]"
                              : "bg-white text-black hover:bg-white/80"
                          )}
                        >
                          {theme.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Poster View Mode Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPosterOverlay((p) => !p)}
                    className={cn(
                      "border-2 border-black px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase transition",
                      showPosterOverlay
                        ? "bg-[#00E599] text-black shadow-[1px_1px_0px_#000000]"
                        : "bg-white text-black hover:bg-[#F8FAFC]"
                    )}
                  >
                    {showPosterOverlay ? "Ad Poster View ✓" : "Packshot Only"}
                  </button>
                </div>
              </div>

              {/* Commercial Ad Poster Canvas Stage */}
              <div className="relative mx-auto flex w-full items-center justify-center overflow-hidden border-2 border-black bg-[#09090C] shadow-[4px_4px_0px_#000000]">
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
                    {/* Background Product Photography */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeImageUrl}
                      alt={activeOption?.label || activeCreative.title}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.015]"
                    />

                    {/* COMMERCIAL AD POSTER GRAPHIC DESIGN OVERLAY */}
                    {showPosterOverlay && (
                      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
                        {/* THEME SPECIFIC POSTER FRAMING */}
                        {selectedPosterTheme === "billboard" && (
                          <>
                            {/* Outer Mint Brutalist Frame */}
                            <div className="absolute inset-2 sm:inset-3 border-2 border-[#00E599] pointer-events-none" />

                            {/* Top Header Bar */}
                            <div className="relative z-10 flex items-center justify-between gap-2 pointer-events-auto">
                              <div className="border-2 border-black bg-black px-3 py-1 font-display text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-[2px_2px_0px_#00E599]">
                                {brief.productName || "PRODUCT"}
                              </div>
                              <div className="border-2 border-black bg-[#00E599] px-2.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-black uppercase text-black shadow-[2px_2px_0px_#000000]">
                                {activeBadge}
                              </div>
                            </div>

                            {/* Center Atmospheric Gradient Scrim */}
                            <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

                            {/* Bottom Advertising Poster Headline & Callouts */}
                            <div className="relative z-10 flex flex-col gap-2.5 pt-10 pointer-events-auto">
                              {/* Giant Bold Headline */}
                              <h2 className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight drop-shadow-md">
                                {activeHeadline}
                              </h2>

                              {/* Subheadline Tagline */}
                              <p className="font-mono text-xs sm:text-sm text-white/90 line-clamp-2 max-w-xl">
                                {activeTagline}
                              </p>

                              {/* Feature Callout Badges */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {activeFeatures.slice(0, 3).map((feat) => (
                                  <span
                                    key={feat}
                                    className="border border-white/40 bg-black/70 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-bold uppercase text-white backdrop-blur-md shadow-sm"
                                  >
                                    ● {feat}
                                  </span>
                                ))}
                              </div>

                              {/* Bottom Brand Bar & CTA */}
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#00E599] pt-2.5 text-white">
                                <span className="font-mono text-[10px] sm:text-xs font-bold text-white/80">
                                  AVAILABLE GLOBALLY // SS-26 CAMPAIGN
                                </span>
                                <div className="border-2 border-black bg-[#00E599] px-3.5 py-1 font-display text-xs sm:text-sm font-black uppercase text-black shadow-[2px_2px_0px_#000000]">
                                  {activeCta}
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedPosterTheme === "swiss" && (
                          <>
                            {/* Swiss Architectural Hairline Grid */}
                            <div className="absolute inset-3 border border-white/40 pointer-events-none" />

                            {/* Top Swiss Header with line */}
                            <div className="relative z-10 flex items-center justify-between border-b border-white/30 pb-2 pointer-events-auto">
                              <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-white">
                                {brief.productName} / SPEC. 01
                              </span>
                              <span className="font-mono text-[10px] sm:text-xs text-white/70">
                                {activeBadge}
                              </span>
                            </div>

                            {/* Dark vignette */}
                            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

                            {/* Swiss Grid Headline & Specs */}
                            <div className="relative z-10 flex flex-col gap-2 pt-10 pointer-events-auto">
                              <div className="flex flex-col">
                                <span className="font-mono text-[10px] uppercase text-white/60 tracking-wider">
                                  [01] OFFICIAL LAUNCH
                                </span>
                                <h2 className="font-display text-2xl sm:text-4xl font-bold uppercase tracking-tight text-white leading-tight">
                                  {activeHeadline}
                                </h2>
                              </div>

                              <p className="font-mono text-xs sm:text-sm text-white/80 max-w-lg">
                                {activeTagline}
                              </p>

                              {/* Numbered micro specs */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/20">
                                {activeFeatures.slice(0, 3).map((feat, i) => (
                                  <div key={feat} className="font-mono text-[10px] sm:text-[11px] text-white/85">
                                    <span className="text-white/50">[0{i + 1}]</span> {feat}
                                  </div>
                                ))}
                              </div>

                              {/* Footer */}
                              <div className="flex items-center justify-between border-t border-white/30 pt-2 text-white">
                                <span className="font-mono text-[10px] text-white/70">
                                  EDITION 01/500 // TOKYO • NYC • LONDON
                                </span>
                                <span className="font-mono text-xs font-bold text-white underline underline-offset-4">
                                  {activeCta}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedPosterTheme === "luxury" && (
                          <>
                            {/* Luxury Double Gold Border */}
                            <div className="absolute inset-2.5 sm:inset-4 border border-[#D4AF37]/80 pointer-events-none" />
                            <div className="absolute inset-3.5 sm:inset-5 border border-[#D4AF37]/40 pointer-events-none" />

                            {/* Top Center Luxury Crest */}
                            <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-auto">
                              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-[#D4AF37]">
                                — HAUTE CRAFTSMANSHIP —
                              </span>
                              <h3 className="mt-1 font-display text-sm sm:text-base font-extrabold uppercase tracking-[0.2em] text-white">
                                {brief.productName}
                              </h3>
                              <span className="font-mono text-[9px] text-white/60">
                                MMXXVI • ARCHIVE NO. 884
                              </span>
                            </div>

                            {/* Bottom Dark Vignette */}
                            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />

                            {/* Refined Luxury Typography */}
                            <div className="relative z-10 flex flex-col items-center text-center gap-2 pt-6 pointer-events-auto">
                              <h2 className="font-display text-xl sm:text-3xl font-bold uppercase tracking-[0.08em] text-white max-w-lg leading-tight">
                                {activeHeadline}
                              </h2>

                              <p className="font-mono text-xs sm:text-sm text-[#D4AF37] max-w-md">
                                {activeTagline}
                              </p>

                              <div className="flex items-center justify-center gap-3 py-1 font-mono text-[10px] text-white/75">
                                {activeFeatures.slice(0, 3).join("  •  ")}
                              </div>

                              <div className="mt-1 border border-[#D4AF37] bg-black/60 px-5 py-1.5 font-display text-xs font-bold uppercase tracking-widest text-[#D4AF37] shadow-sm backdrop-blur-md">
                                {activeCta}
                              </div>
                            </div>
                          </>
                        )}

                        {selectedPosterTheme === "cyber" && (
                          <>
                            {/* Glowing Cyan HUD Brackets */}
                            <div className="absolute left-3 top-3 w-6 h-6 border-l-2 border-t-2 border-[#06B6D4] pointer-events-none" />
                            <div className="absolute right-3 top-3 w-6 h-6 border-r-2 border-t-2 border-[#06B6D4] pointer-events-none" />
                            <div className="absolute left-3 bottom-3 w-6 h-6 border-l-2 border-b-2 border-[#06B6D4] pointer-events-none" />
                            <div className="absolute right-3 bottom-3 w-6 h-6 border-r-2 border-b-2 border-[#06B6D4] pointer-events-none" />

                            {/* Top HUD Telemetry */}
                            <div className="relative z-10 flex items-center justify-between font-mono text-[10px] sm:text-xs text-[#06B6D4] pointer-events-auto">
                              <span className="bg-black/60 px-2 py-0.5 border border-[#06B6D4]/50">
                                SYS//TARGET: {brief.productName.toUpperCase()} [ACTIVE]
                              </span>
                              <span className="hidden sm:inline bg-black/60 px-2 py-0.5 border border-[#06B6D4]/50">
                                TELEMETRY: OK // 0.8MS
                              </span>
                            </div>

                            {/* Bottom Dark Vignette */}
                            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />

                            {/* Futuristic Cyber Typography */}
                            <div className="relative z-10 flex flex-col gap-2 pt-6 pointer-events-auto">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#06B6D4] animate-ping" />
                                <span className="font-mono text-[10px] uppercase text-[#06B6D4] tracking-widest">
                                  NEURAL HUD ADVERTISEMENT
                                </span>
                              </div>

                              <h2 className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_10px_rgba(6,182,212,0.4)]">
                                {activeHeadline}
                              </h2>

                              <p className="font-mono text-xs sm:text-sm text-white/90 max-w-lg">
                                {activeTagline}
                              </p>

                              {/* Cyber Feature Badges */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {activeFeatures.slice(0, 3).map((feat) => (
                                  <span
                                    key={feat}
                                    className="border border-[#06B6D4]/60 bg-[#06B6D4]/10 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-semibold text-[#06B6D4] backdrop-blur-md"
                                  >
                                    [+] {feat}
                                  </span>
                                ))}
                              </div>

                              {/* Bottom HUD Bar */}
                              <div className="flex items-center justify-between border-t border-[#06B6D4]/40 pt-2 text-[#06B6D4]">
                                <span className="font-mono text-[10px] text-white/70">
                                  AGENT PIXELATE AUTHENTICATED
                                </span>
                                <div className="border border-[#06B6D4] bg-[#06B6D4] px-3.5 py-1 font-mono text-xs font-bold uppercase text-black">
                                  {activeCta}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Scrim when poster overlay is off */}
                    {!showPosterOverlay && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 pt-14">
                        <div>
                          <span className="border border-black bg-[#00E599] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black">
                            {activeOption?.label || "Clean Packshot"}
                          </span>
                          <h4 className="mt-2 font-display text-base font-bold uppercase tracking-tight text-white sm:text-lg">
                            {activeCreative.title}
                          </h4>
                          <p className="mt-0.5 font-mono text-xs text-white/90 line-clamp-1">
                            {activeOption?.description || activeCreative.subtitle}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Left/Right Carousel Nav */}
                {displayCreatives.length > 1 && (
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

              {/* POSTER HEADLINE HOOKS SWITCHER */}
              <div className="flex flex-col gap-2 border-2 border-black bg-white p-3.5 shadow-[2px_2px_0px_#000000]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <div className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-black">
                    <Edit3 className="h-3.5 w-3.5 text-black" />
                    <span>Advertisement Poster Headlines (Hook Variations)</span>
                  </div>
                  <span className="font-mono text-[11px] text-black/60">
                    Click to switch poster copy
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
                          "border-2 p-2.5 text-left font-mono transition",
                          isSelected
                            ? "border-black bg-[#E6F7EB] shadow-[2px_2px_0px_#000000]"
                            : "border-black/30 bg-white hover:border-black hover:bg-[#F8FAFC]"
                        )}
                      >
                        <div className="text-[10px] font-bold text-black/60 uppercase">
                          Hook 0{idx + 1}
                        </div>
                        <div className="text-xs font-bold text-black line-clamp-2 mt-0.5">
                          &ldquo;{hl}&rdquo;
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Inline Headline Editor */}
                {isEditingHeadline ? (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={customHeadline || activeHeadline}
                      onChange={(e) => setCustomHeadline(e.target.value)}
                      placeholder="Type custom advertising headline..."
                      className="flex-1 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#00E599]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingHeadline(false)}
                      className="border-2 border-black bg-[#00E599] px-3 py-1 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000]"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsEditingHeadline(true)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-black underline underline-offset-2 hover:text-[#00A86B]"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit Custom Headline</span>
                    </button>
                  </div>
                )}
              </div>

              {/* POSTER EXPORT ACTION BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#E6F7EB] p-3 shadow-[2px_2px_0px_#000000]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase text-black">
                    Poster Output:
                  </span>
                  <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                    High-Res Commercial PNG
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPosterToClipboard}
                    className="flex h-8 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#F8FAFC]"
                  >
                    {copiedPoster ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#00A86B]" />
                        <span>Poster Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Poster</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPoster}
                    disabled={isExportingPoster}
                    className="flex h-8 items-center gap-1.5 border-2 border-black bg-[#00E599] px-3.5 font-mono text-xs font-black text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#00D08A] disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isExportingPoster ? "Rendering 1200px..." : "Download Ad Poster (.PNG)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCleanImage}
                    title="Download Clean Photo Without Poster Text"
                    className="flex h-8 items-center gap-1.5 border-2 border-black bg-white px-3 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#F8FAFC]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Clean Photo (.JPG)</span>
                  </button>

                  <a
                    href={activeImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Full Resolution Photo"
                    className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] transition hover:bg-[#F8FAFC]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Product Visual Angles & Context Variations */}
              <div className="space-y-3 border-2 border-black bg-[#F8FAFC] p-4 shadow-[2px_2px_0px_#000000]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-black" />
                    <span className="font-display text-xs font-black uppercase tracking-tight text-black">
                      PRODUCT PHOTOGRAPHY ANGLES &amp; BACKGROUND CONTEXT ({currentOptions.length} VARIATIONS)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-black/60">
                    Changes product photo in the ad poster
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
    </div>
  );
}
