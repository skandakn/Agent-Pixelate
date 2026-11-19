"use client";

import React from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { BrandTone, CampaignBrief, CampaignStatus, Platform } from "@/types/campaign";
import { BLANK_CUSTOM_BRIEF, DEMO_PRESETS } from "@/data/presets";
import { cn } from "@/lib/utils";

const BRAND_TONES: BrandTone[] = ["Minimalist", "Bold", "Luxury", "Playful"];
const PLATFORMS: Platform[] = ["Instagram", "LinkedIn", "Meta Ads"];

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

  const handleApplyPreset = (presetBrief: CampaignBrief) => {
    onChangeBrief({ ...presetBrief, platforms: [...presetBrief.platforms] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canLaunch) {
      onLaunch();
    }
  };

  return (
    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000] sm:p-6">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <span className="border border-black bg-[#10B981] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-black">
            01. BRIEF
          </span>
          <h2 className="font-display text-base font-black uppercase tracking-tight text-black">
            Campaign Setup
          </h2>
        </div>
        <button
          type="button"
          disabled={isRunning}
          onClick={() => onChangeBrief(BLANK_CUSTOM_BRIEF)}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-black/60 hover:text-red-600 transition"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* 1-Click Starter Presets */}
      <div className="mt-4">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-black/60">
          Quick Starter Blueprints:
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DEMO_PRESETS.map((p) => {
            const isSelected = brief.productName === p.brief.productName;
            return (
              <button
                key={p.id}
                type="button"
                disabled={isRunning}
                onClick={() => handleApplyPreset(p.brief)}
                className={cn(
                  "border border-black px-2.5 py-1 font-mono text-xs font-bold transition",
                  isSelected
                    ? "bg-[#10B981] text-black shadow-[1px_1px_0px_#000000]"
                    : "bg-[#F3F4F6] text-black hover:bg-gray-200"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Product Name */}
        <div>
          <label
            htmlFor="productName"
            className="block font-mono text-xs font-bold uppercase text-black"
          >
            Product / Brand Identifier *
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
            placeholder="e.g. Veloce Carbon Bike or AeroFlow AI"
            className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100"
          />
        </div>

        {/* Product Description */}
        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="productDescription"
              className="block font-mono text-xs font-bold uppercase text-black"
            >
              Creative Story &amp; Moat *
            </label>
            <span className="font-mono text-[10px] text-black/50">
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
            placeholder="Describe unique features, target transformation, materials, and aesthetic vibe..."
            className="mt-1 w-full resize-none border-2 border-black bg-white px-3 py-2 font-mono text-xs leading-relaxed text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100"
          />
        </div>

        {/* Target Audience */}
        <div>
          <label
            htmlFor="targetAudience"
            className="block font-mono text-xs font-bold uppercase text-black"
          >
            Audience Segment
          </label>
          <input
            id="targetAudience"
            type="text"
            disabled={isRunning}
            value={brief.targetAudience}
            onChange={(e) =>
              onChangeBrief({ ...brief, targetAudience: e.target.value })
            }
            placeholder="e.g. Urban athletes, founders, luxury buyers"
            className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs text-black placeholder-black/40 shadow-[2px_2px_0px_#000000] outline-none transition focus:bg-[#E6F7EB] disabled:bg-gray-100"
          />
        </div>

        {/* Brand Tone Matrix */}
        <div>
          <label className="block font-mono text-xs font-bold uppercase text-black">
            Brand Tone Matrix
          </label>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {BRAND_TONES.map((tone) => {
              const active = brief.brandTone === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={isRunning}
                  onClick={() => onChangeBrief({ ...brief, brandTone: tone })}
                  className={cn(
                    "border border-black py-1.5 font-mono text-[11px] font-bold uppercase transition",
                    active
                      ? "bg-[#10B981] font-black text-black shadow-[1px_1px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100"
                  )}
                >
                  {tone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Distribution Channels */}
        <div>
          <label className="block font-mono text-xs font-bold uppercase text-black">
            Channels
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {PLATFORMS.map((plat) => {
              const active = brief.platforms.includes(plat);
              return (
                <button
                  key={plat}
                  type="button"
                  disabled={isRunning}
                  onClick={() => togglePlatform(plat)}
                  className={cn(
                    "flex items-center justify-between border border-black px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase transition",
                    active
                      ? "bg-[#10B981] text-black shadow-[1px_1px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100"
                  )}
                >
                  <span>{plat}</span>
                  <span>{active ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          {isRunning ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-2 border-2 border-black bg-[#FEF3C7] py-3 font-mono text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000000]"
              >
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>AGENTS SYNTHESIZING...</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full border border-black bg-white py-1.5 font-mono text-[11px] font-bold uppercase text-red-600 hover:bg-red-50"
              >
                Cancel Run
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!canLaunch}
              className="inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-[#10B981] py-3 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000000] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>GENERATE CAMPAIGN →</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
