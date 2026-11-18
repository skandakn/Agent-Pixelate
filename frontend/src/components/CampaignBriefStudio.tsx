"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, Square, X } from "lucide-react";
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
      className="flex h-full flex-col justify-between gap-6 overflow-y-auto px-6 py-6"
    >
      <div className="space-y-6">
        {/* Studio Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
              Campaign Brief
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-[#6E6E73]">
              Configure your product story to orchestrate @VisualAgent and @CopyAgent.
            </p>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-full bg-[#F5F5F7] p-1.5 text-[#6E6E73] transition hover:text-[#1D1D1F] lg:hidden"
              aria-label="Close brief drawer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <span className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Quick Presets
          </span>
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
                    "group flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition",
                    isSelected
                      ? "border-[#0071E3] bg-[#0071E3]/[0.05]"
                      : "border-black/[0.08] bg-[#FBFBFD] hover:border-black/[0.18] hover:bg-[#F5F5F7]",
                    isRunning && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-[13px] font-medium text-[#1D1D1F]">
                      {preset.label}
                    </div>
                    <div className="truncate text-[11px] text-[#6E6E73]">
                      {preset.tagline}
                    </div>
                  </div>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: preset.accentHex }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-black/[0.06]" />

        {/* Product Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="productName"
            className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]"
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
            className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 disabled:bg-[#F5F5F7] disabled:opacity-60"
          />
        </div>

        {/* Product Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="productDescription"
              className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]"
            >
              Product Story
            </label>
            <span className="text-[11px] text-[#86868B]">
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
            placeholder="Describe key features, craftsmanship, differentiators, and benefit..."
            className="w-full resize-none rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 disabled:bg-[#F5F5F7] disabled:opacity-60"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-1.5">
          <label
            htmlFor="targetAudience"
            className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]"
          >
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
            placeholder="e.g. Design-forward founders, creative teams"
            className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 disabled:bg-[#F5F5F7] disabled:opacity-60"
          />
        </div>

        {/* Brand Tone — Classic macOS Segmented Selector */}
        <div className="space-y-2">
          <span className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Brand Tone
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F5F5F7] p-1">
            {BRAND_TONES.map((tone) => {
              const active = brief.brandTone === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={isRunning}
                  onClick={() => onChangeBrief({ ...brief, brandTone: tone })}
                  className={cn(
                    "relative rounded-xl px-3 py-2 text-[13px] font-medium transition",
                    active
                      ? "text-[#1D1D1F]"
                      : "text-[#6E6E73] hover:text-[#1D1D1F]",
                    isRunning && "cursor-not-allowed opacity-60"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="activeTonePill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-white shadow-apple-pill"
                    />
                  )}
                  <span className="relative z-10">{tone}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Switches — Classic iOS-style Rows */}
        <div className="space-y-2">
          <span className="block text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Target Channels
          </span>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.08] bg-[#FBFBFD]">
            {PLATFORMS.map(({ id, desc }) => {
              const checked = brief.platforms.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-3.5 py-3 transition hover:bg-[#F5F5F7]",
                    isRunning && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlatform(id)}
                    className="sr-only"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[#1D1D1F]">
                      {id}
                    </div>
                    <div className="text-[11px] text-[#6E6E73]">{desc}</div>
                  </div>
                  {/* iOS Switch */}
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200",
                      checked ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                        checked ? "translate-x-[18px]" : "translate-x-[2px]"
                      )}
                    />
                  </span>
                </label>
              );
            })}
          </div>
          {brief.platforms.length === 0 && (
            <p className="text-[12px] text-[#D70015]">
              Select at least one channel to generate campaign copy.
            </p>
          )}
        </div>
      </div>

      {/* Primary Apple Blue Pill CTA */}
      <div className="sticky bottom-0 -mx-6 border-t border-black/[0.06] bg-white/90 px-6 pb-1 pt-4 backdrop-blur-md">
        {isRunning ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-5 py-3 text-[14px] font-medium text-white opacity-90"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Orchestrating…</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              title="Stop active agent stream"
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border border-black/[0.1] bg-[#F5F5F7] text-[#1D1D1F] transition hover:bg-black/[0.08]"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: canLaunch ? 0.985 : 1 }}
            type="submit"
            disabled={!canLaunch}
            className="flex w-full items-center justify-center rounded-full bg-[#0071E3] px-5 py-3 text-[14px] font-medium text-white transition hover:bg-[#0077ED] disabled:cursor-not-allowed disabled:bg-[#D2D2D7] disabled:text-[#86868B]"
          >
            Launch Agents
          </motion.button>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop Sticky Left Studio Panel */}
      <aside className="hidden w-[356px] shrink-0 border-r border-black/[0.08] bg-white lg:block xl:w-[376px]">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{studioContent}</div>
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <motion.aside
            initial={{ x: -360 }}
            animate={{ x: 0 }}
            exit={{ x: -360 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="relative z-10 h-full w-[88vw] max-w-[376px] border-r border-black/[0.08] bg-white shadow-2xl"
          >
            {studioContent}
          </motion.aside>
        </div>
      )}
    </>
  );
}
