"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Square, X } from "lucide-react";
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
      className="flex h-full flex-col justify-between gap-5 overflow-y-auto bg-white p-5 font-sans"
    >
      <div className="space-y-5">
        {/* Studio Header */}
        <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="border border-black bg-[#10B981] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                CONFIG
              </span>
              <h2 className="font-display text-base font-black uppercase tracking-tight text-black">
                Campaign Brief Specification
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs text-black/70">
              Input parameters to instruct @VisualAgent &amp; @CopyAgent in the BAND room.
            </p>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="border-2 border-black bg-white p-1 text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none lg:hidden"
              aria-label="Close brief drawer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black">
            Pre-Approved Campaign Templates
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
                    "group flex items-center justify-between border-2 border-black p-2.5 text-left transition-all",
                    isSelected
                      ? "bg-[#D1FAE5] shadow-[3px_3px_0px_#000000]"
                      : "bg-white shadow-[2px_2px_0px_#000000] hover:bg-[#F3F4F6] hover:translate-x-[1px] hover:translate-y-[1px]",
                    isRunning && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate font-display text-[13px] font-bold text-black">
                      {preset.label}
                    </div>
                    <div className="truncate font-mono text-[11px] text-black/60">
                      {preset.tagline}
                    </div>
                  </div>
                  <span
                    className="h-3 w-3 shrink-0 border border-black shadow-[1px_1px_0px_#000000]"
                    style={{ backgroundColor: preset.accentHex }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="productName"
            className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black"
          >
            Product / Offering Identifier
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
            placeholder="e.g. Aura Soundbar Spatial"
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100 disabled:opacity-50"
          />
        </div>

        {/* Product Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="productDescription"
              className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black"
            >
              Creative Story &amp; Value Proposition
            </label>
            <span className="font-mono text-[10px] text-black/60">
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
            placeholder="Define core features, materials, acoustic architecture, and customer benefit..."
            className="w-full resize-none border-2 border-black bg-white px-3 py-2 font-mono text-xs leading-relaxed text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100 disabled:opacity-50"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-1.5">
          <label
            htmlFor="targetAudience"
            className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black"
          >
            Target Audience Segment
          </label>
          <input
            id="targetAudience"
            type="text"
            disabled={isRunning}
            value={brief.targetAudience}
            onChange={(e) =>
              onChangeBrief({ ...brief, targetAudience: e.target.value })
            }
            placeholder="e.g. Audiophiles, interior architects, premium design lovers"
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100 disabled:opacity-50"
          />
        </div>

        {/* Brand Tone Selector */}
        <div className="space-y-2">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black">
            Brand Tone Matrix
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
                    "border-2 border-black px-3 py-2 font-mono text-xs font-bold uppercase transition-all",
                    active
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-gray-50",
                    isRunning && "cursor-not-allowed opacity-50"
                  )}
                >
                  {tone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Switches */}
        <div className="space-y-2">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-black">
            Distribution Channels
          </span>
          <div className="space-y-2">
            {PLATFORMS.map(({ id, desc }) => {
              const checked = brief.platforms.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between border-2 border-black p-2.5 shadow-[2px_2px_0px_#000000] transition-all hover:bg-gray-50",
                    checked ? "bg-[#D1FAE5]" : "bg-white",
                    isRunning && "pointer-events-none opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlatform(id)}
                    className="sr-only"
                  />
                  <div>
                    <div className="font-display text-xs font-black uppercase text-black">
                      {id}
                    </div>
                    <div className="font-mono text-[11px] text-black/60">{desc}</div>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center border-2 border-black font-mono text-xs font-black",
                      checked ? "bg-black text-white" : "bg-white"
                    )}
                  >
                    {checked ? "✓" : ""}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Human Gate */}
        <div className="space-y-2 border-t-2 border-black pt-4">
          <label
            className={cn(
              "flex cursor-pointer items-center justify-between border-2 border-black bg-white p-2.5 shadow-[2px_2px_0px_#000000] transition-all hover:bg-gray-50",
              brief.requireHandoffApproval && "bg-[#FEF3C7]",
              isRunning && "pointer-events-none opacity-50"
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(brief.requireHandoffApproval)}
              onChange={(e) =>
                onChangeBrief({
                  ...brief,
                  requireHandoffApproval: e.target.checked,
                })
              }
              className="sr-only"
            />
            <div className="pr-3">
              <div className="font-display text-xs font-black uppercase text-black">
                Fintech Human Gate
              </div>
              <div className="font-mono text-[11px] text-black/60">
                Hold pipeline for sign-off before @CopyAgent handoff
              </div>
            </div>
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center border-2 border-black font-mono text-xs font-black",
                brief.requireHandoffApproval ? "bg-black text-white" : "bg-white"
              )}
            >
              {brief.requireHandoffApproval ? "✓" : ""}
            </div>
          </label>
        </div>
      </div>

      {/* Primary Brutalist Launch Button */}
      <div className="sticky bottom-0 -mx-5 border-t-2 border-black bg-white px-5 pb-2 pt-4">
        {isRunning ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 border-2 border-black bg-[#F59E0B] py-3 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_#000000]"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>ORCHESTRATING RUN...</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              title="Abort execution"
              className="flex h-11 w-11 items-center justify-center border-2 border-black bg-[#EF4444] text-white shadow-[3px_3px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canLaunch}
            className="flex w-full items-center justify-center gap-2 border-2 border-black bg-[#10B981] py-3 font-mono text-xs font-black uppercase tracking-widest text-black shadow-[4px_4px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>DISPATCH MULTI-AGENT RUN</span>
          </button>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop Sticky Left Studio Panel */}
      <aside className="hidden w-[360px] shrink-0 border-r-2 border-black bg-white lg:block">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{studioContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 h-full w-[88vw] max-w-[360px] border-r-2 border-black bg-white shadow-2xl">
            {studioContent}
          </aside>
        </div>
      )}
    </>
  );
}
