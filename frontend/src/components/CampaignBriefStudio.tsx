"use client";

import React from "react";
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
  { id: "Instagram", desc: "Feed & Reels" },
  { id: "LinkedIn", desc: "Post & Article" },
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
      className="flex h-full flex-col justify-between overflow-y-auto bg-white p-5 font-sans"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <h2 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
            Campaign Brief
          </h2>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 lg:hidden"
              aria-label="Close brief drawer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500">
            Presets
          </label>
          <div className="grid grid-cols-1 gap-1.5">
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
                    "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                    isSelected
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                      : "border-black/[0.06] bg-[#FBFBFD] text-neutral-800 hover:bg-neutral-100/70",
                    isRunning && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-xs font-semibold">
                      {preset.label}
                    </div>
                    <div
                      className={cn(
                        "truncate text-[11px]",
                        isSelected ? "text-neutral-300" : "text-neutral-500"
                      )}
                    >
                      {preset.tagline}
                    </div>
                  </div>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
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
            className="block text-xs font-medium text-neutral-500"
          >
            Product
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
            placeholder="e.g. Aura Spatial Audio"
            className="w-full rounded-xl border border-black/[0.08] bg-neutral-50/50 px-3.5 py-2 text-sm text-[#1D1D1F] placeholder-neutral-400 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-400 disabled:opacity-50"
          />
        </div>

        {/* Product Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="productDescription"
              className="block text-xs font-medium text-neutral-500"
            >
              Description
            </label>
            <span className="text-[10px] text-neutral-400">
              {brief.productDescription.length} chars
            </span>
          </div>
          <textarea
            id="productDescription"
            rows={3}
            required
            disabled={isRunning}
            value={brief.productDescription}
            onChange={(e) =>
              onChangeBrief({ ...brief, productDescription: e.target.value })
            }
            placeholder="Key features, materials, customer benefits..."
            className="w-full resize-none rounded-xl border border-black/[0.08] bg-neutral-50/50 px-3.5 py-2 text-xs leading-relaxed text-[#1D1D1F] placeholder-neutral-400 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-400 disabled:opacity-50"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-1.5">
          <label
            htmlFor="targetAudience"
            className="block text-xs font-medium text-neutral-500"
          >
            Audience
          </label>
          <input
            id="targetAudience"
            type="text"
            disabled={isRunning}
            value={brief.targetAudience}
            onChange={(e) =>
              onChangeBrief({ ...brief, targetAudience: e.target.value })
            }
            placeholder="e.g. Designers, creators, minimalists"
            className="w-full rounded-xl border border-black/[0.08] bg-neutral-50/50 px-3.5 py-2 text-xs text-[#1D1D1F] placeholder-neutral-400 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-400 disabled:opacity-50"
          />
        </div>

        {/* Brand Tone Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500">
            Tone
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {BRAND_TONES.map((tone) => {
              const active = brief.brandTone === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={isRunning}
                  onClick={() => onChangeBrief({ ...brief, brandTone: tone })}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-medium transition-all",
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                      : "border-black/[0.06] bg-[#FBFBFD] text-neutral-700 hover:bg-neutral-100",
                    isRunning && "cursor-not-allowed opacity-50"
                  )}
                >
                  {tone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500">
            Channels
          </label>
          <div className="space-y-1.5">
            {PLATFORMS.map(({ id, desc }) => {
              const checked = brief.platforms.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all",
                    checked
                      ? "border-black/[0.12] bg-neutral-50"
                      : "border-black/[0.06] bg-white hover:bg-neutral-50/50",
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
                    <div className="text-xs font-semibold text-[#1D1D1F]">
                      {id}
                    </div>
                    <div className="text-[11px] text-neutral-400">{desc}</div>
                  </div>
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-md border text-[10px] font-bold transition-colors",
                      checked
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white"
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
        <div className="border-t border-black/[0.06] pt-3">
          <label
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-black/[0.06] p-2.5 transition-all",
              brief.requireHandoffApproval ? "bg-amber-50/60 border-amber-200" : "bg-white hover:bg-neutral-50/60",
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
              <div className="text-xs font-medium text-neutral-800">
                Approval Gate
              </div>
              <div className="text-[11px] text-neutral-400">
                Review visual assets before copy handoff
              </div>
            </div>
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-md border text-[10px] font-bold transition-colors",
                brief.requireHandoffApproval
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white"
              )}
            >
              {brief.requireHandoffApproval ? "✓" : ""}
            </div>
          </label>
        </div>
      </div>

      {/* Action Button */}
      <div className="sticky bottom-0 -mx-5 border-t border-black/[0.06] bg-white px-5 pb-2 pt-4">
        {isRunning ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 py-2.5 text-xs font-medium text-white shadow-sm"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Orchestrating...</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              title="Cancel execution"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-100"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canLaunch}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0071E3] py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#0077ED] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate Campaign</span>
          </button>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop Sticky Left Studio Panel */}
      <aside className="hidden w-[340px] shrink-0 border-r border-black/[0.08] bg-white lg:block">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{studioContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 h-full w-[88vw] max-w-[340px] border-r border-black/[0.08] bg-white shadow-xl">
            {studioContent}
          </aside>
        </div>
      )}
    </>
  );
}
