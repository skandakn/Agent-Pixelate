"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Check,
  Layers,
  Loader2,
  Rocket,
  Sliders,
  Sparkles,
  Square,
  Target,
  Wand2,
  X,
} from "lucide-react";
import {
  BrandTone,
  CampaignBrief,
  CampaignStatus,
  Platform,
} from "@/types/campaign";
import { DEMO_PRESETS } from "@/data/presets";
import { cn } from "@/lib/utils";

const BRAND_TONES: BrandTone[] = ["Bold", "Minimalist", "Luxury", "Playful"];
const PLATFORMS: { id: Platform; desc: string }[] = [
  { id: "Instagram", desc: "Carousels & Reels" },
  { id: "LinkedIn", desc: "Editorial & Founder" },
  { id: "Meta Ads", desc: "Direct Response" },
];

interface CampaignBriefStudioProps {
  brief: CampaignBrief;
  status: CampaignStatus;
  onChangeBrief: (next: CampaignBrief) => void;
  onLaunch: () => void;
  onCancel: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function CampaignBriefStudio({
  brief,
  status,
  onChangeBrief,
  onLaunch,
  onCancel,
  mobileOpen = false,
  onCloseMobile,
}: CampaignBriefStudioProps) {
  const isRunning = status === "running";
  const canLaunch =
    brief.productName.trim().length > 0 &&
    brief.productDescription.trim().length > 0 &&
    brief.platforms.length > 0 &&
    !isRunning;

  const togglePlatform = (platform: Platform) => {
    const exists = brief.platforms.includes(platform);
    const nextPlatforms = exists
      ? brief.platforms.filter((p) => p !== platform)
      : [...brief.platforms, platform];
    onChangeBrief({ ...brief, platforms: nextPlatforms });
  };

  const applyPreset = (presetBrief: CampaignBrief) => {
    onChangeBrief({ ...presetBrief, platforms: [...presetBrief.platforms] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canLaunch) {
      onLaunch();
      onCloseMobile?.();
    }
  };

  const studioContent = (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col justify-between gap-5 overflow-y-auto p-5"
    >
      <div className="space-y-5">
        {/* Studio Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Campaign Brief Studio
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Define your product signal to orchestrate @VisualAgent &amp; @CopyAgent.
            </p>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg border border-white/[0.08] p-1.5 text-zinc-400 transition hover:text-white lg:hidden"
              aria-label="Close brief drawer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Demo Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              <Wand2 className="h-3 w-3 text-cyan-400" />
              One-Click Demo Presets
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_PRESETS.map((preset) => {
              const isSelected =
                brief.productName === preset.brief.productName &&
                brief.brandTone === preset.brief.brandTone;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => applyPreset(preset.brief)}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
                    isSelected
                      ? "border-violet-500/50 bg-violet-500/10 shadow-[0_0_20px_-10px_rgba(139,92,246,0.6)]"
                      : "border-white/[0.08] bg-[#16161C]/70 hover:border-white/20 hover:bg-[#1A1A22]",
                    isRunning && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-xs font-semibold text-zinc-100 group-hover:text-white">
                      {preset.label}
                    </div>
                    <div className="truncate text-[11px] text-zinc-400">
                      {preset.tagline}
                    </div>
                  </div>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: preset.accentHex }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/[0.07]" />

        {/* Product Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="productName"
            className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400"
          >
            Product Name
          </label>
          <input
            id="productName"
            type="text"
            required
            disabled={isRunning}
            value={brief.productName}
            onChange={(e) =>
              onChangeBrief({ ...brief, productName: e.target.value })
            }
            placeholder="e.g. LumaDrop Hydro"
            className="w-full rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
          />
        </div>

        {/* Product Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="productDescription"
              className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400"
            >
              Product Description
            </label>
            <span className="font-mono text-[10px] text-zinc-500">
              {brief.productDescription.length} chars
            </span>
          </div>
          <textarea
            id="productDescription"
            rows={4}
            required
            disabled={isRunning}
            value={brief.productDescription}
            onChange={(e) =>
              onChangeBrief({ ...brief, productDescription: e.target.value })
            }
            placeholder="Describe key features, craftsmanship, differentiators, and emotional benefit..."
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder-zinc-500 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-1.5">
          <label
            htmlFor="targetAudience"
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400"
          >
            <Target className="h-3 w-3 text-violet-400" />
            Target Audience
          </label>
          <input
            id="targetAudience"
            type="text"
            disabled={isRunning}
            value={brief.targetAudience}
            onChange={(e) =>
              onChangeBrief({ ...brief, targetAudience: e.target.value })
            }
            placeholder="e.g. Design-forward founders, Gen Z athletes"
            className="w-full rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60"
          />
        </div>

        {/* Brand Tone Selector Pills */}
        <div className="space-y-2">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Brand Tone
          </span>
          <div className="grid grid-cols-2 gap-2">
            {BRAND_TONES.map((tone) => {
              const active = brief.brandTone === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={isRunning}
                  onClick={() => onChangeBrief({ ...brief, brandTone: tone })}
                  className={cn(
                    "relative overflow-hidden rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-violet-400/60 text-white"
                      : "border-white/[0.08] bg-[#0B0B0F] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                    isRunning && "cursor-not-allowed opacity-60"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="activeTonePill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 bg-gradient-to-r from-violet-600/35 to-cyan-500/20"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    {active && <Sparkles className="h-3 w-3 text-violet-300" />}
                    {tone}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Checkboxes */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <Layers className="h-3 w-3 text-cyan-400" />
            Target Platforms
          </span>
          <div className="space-y-2">
            {PLATFORMS.map(({ id, desc }) => {
              const checked = brief.platforms.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 transition",
                    checked
                      ? "border-cyan-500/45 bg-cyan-500/[0.08]"
                      : "border-white/[0.08] bg-[#0B0B0F] hover:border-white/20",
                    isRunning && "pointer-events-none opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlatform(id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition",
                        checked
                          ? "border-cyan-400 bg-cyan-500 text-black"
                          : "border-white/20 bg-transparent"
                      )}
                    >
                      {checked && <Check className="h-3 w-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-zinc-100">
                        {id}
                      </div>
                      <div className="text-[11px] text-zinc-400">{desc}</div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase",
                      checked ? "text-cyan-300" : "text-zinc-600"
                    )}
                  >
                    {checked ? "ON" : "OFF"}
                  </span>
                </label>
              );
            })}
          </div>
          {brief.platforms.length === 0 && (
            <p className="text-[11px] text-rose-400">
              Select at least one platform to generate copy assets.
            </p>
          )}
        </div>
      </div>

      {/* Primary Launch CTA */}
      <div className="sticky bottom-0 -mx-5 border-t border-white/[0.08] bg-[#121216]/95 px-5 pt-4 backdrop-blur-md">
        {isRunning ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-violet-glow"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Agents Streaming...</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              title="Stop active agent stream"
              className="inline-flex items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 text-rose-300 transition hover:bg-rose-500/25"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: canLaunch ? 1.01 : 1 }}
            whileTap={{ scale: canLaunch ? 0.985 : 1 }}
            type="submit"
            disabled={!canLaunch}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B5CF6] via-violet-500 to-[#06B6D4] px-4 py-3 text-sm font-semibold text-white shadow-violet-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Rocket className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            <span>Launch Agents</span>
          </motion.button>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop Sticky Left Studio Panel */}
      <aside className="hidden w-[360px] shrink-0 border-r border-white/[0.08] bg-[#121216]/90 lg:block xl:w-[385px]">
        <div className="sticky top-16 h-[calc(100vh-4rem)]">{studioContent}</div>
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <motion.aside
            initial={{ x: -360 }}
            animate={{ x: 0 }}
            exit={{ x: -360 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative z-10 h-full w-[88vw] max-w-[380px] border-r border-white/[0.1] bg-[#121216] shadow-2xl"
          >
            {studioContent}
          </motion.aside>
        </div>
      )}
    </>
  );
}
