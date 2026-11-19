/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { Check, Copy, Download, Film, Image as ImageIcon, Palette, Play } from "lucide-react";
import { CampaignBrief, CampaignVideoAsset, ColorSwatch, VisualCreative } from "@/types/campaign";
import { cn, copyTextToClipboard } from "@/lib/utils";

interface MinimalVisualShowcaseProps {
  brief: CampaignBrief;
  creatives: VisualCreative[];
  videos: CampaignVideoAsset[];
  palette: ColorSwatch[];
  artDirectionSummary: string;
  isLoading: boolean;
}

export function MinimalVisualShowcase({
  brief,
  creatives,
  videos,
  palette,
  artDirectionSummary,
  isLoading,
}: MinimalVisualShowcaseProps) {
  const [selectedAspect, setSelectedAspect] = useState<"1:1" | "9:16" | "16:9">("1:1");
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Find matching creative for aspect ratio or fallback
  const activeCreative =
    creatives.find((c) => c.aspectRatio === selectedAspect) || creatives[0];

  // Find matching video or fallback
  const activeVideo =
    videos.find((v) => v.aspectRatio === selectedAspect) || videos[0];

  const handleCopyHex = async (hex: string) => {
    const ok = await copyTextToClipboard(hex);
    if (ok) {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Direction Header */}
      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <span className="border border-black bg-[#10B981] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-black">
              02. VISUALS
            </span>
            <h3 className="font-display text-base font-black uppercase tracking-tight text-black">
              Generated Visuals &amp; Media
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-black/60">
            {brief.productName} · {brief.brandTone}
          </span>
        </div>
        <p className="mt-3 font-mono text-xs leading-relaxed text-black/80">
          {artDirectionSummary || "Creative art direction tailored to your product specs and brand tone."}
        </p>

        {/* Aspect Ratio Switcher */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: "1:1", label: "1:1 Square (Feed & Ads)" },
              { id: "9:16", label: "9:16 Story (Reels & Shorts)" },
              { id: "16:9", label: "16:9 Cinema (Web & Display)" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedAspect(item.id)}
              className={cn(
                "border-2 border-black px-3 py-1.5 font-mono text-xs font-bold transition",
                selectedAspect === item.id
                  ? "bg-[#10B981] font-black text-black shadow-[2px_2px_0px_#000000]"
                  : "bg-white text-black hover:bg-gray-100"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Visual Display & Video Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Visual Image Display (7 cols) */}
        <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000] lg:col-span-7">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
              <ImageIcon className="h-4 w-4" />
              <span>Creative Asset ({selectedAspect})</span>
            </div>
            {activeCreative?.imageUrl && (
              <a
                href={activeCreative.imageUrl}
                download={`${brief.productName.toLowerCase().replace(/\s+/g, "-")}-${selectedAspect}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 border border-black bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000] hover:bg-gray-50"
              >
                <Download className="h-3 w-3" />
                <span>Save Image</span>
              </a>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center overflow-hidden border-2 border-black bg-black/5 p-2">
            {activeCreative?.imageUrl ? (
              <img
                src={activeCreative.imageUrl}
                alt={activeCreative.title || brief.productName}
                className={cn(
                  "max-h-[460px] w-auto object-cover border border-black shadow-[2px_2px_0px_#000000]",
                  selectedAspect === "1:1" && "aspect-square",
                  selectedAspect === "9:16" && "aspect-[9/16]",
                  selectedAspect === "16:9" && "aspect-video"
                )}
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center font-mono text-xs text-black/50">
                Awaiting creative render...
              </div>
            )}
          </div>

          {activeCreative && (
            <div className="mt-3 border-t border-black/10 pt-2 font-mono text-[11px] text-black/70">
              <span className="font-bold text-black">{activeCreative.title}</span> — {activeCreative.subtitle}
            </div>
          )}
        </div>

        {/* Video Player & Palette (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Video Player Card */}
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
                <Film className="h-4 w-4" />
                <span>Kinetic MP4 Cut</span>
              </div>
              {activeVideo?.videoUrl && (
                <a
                  href={activeVideo.videoUrl}
                  download={`${brief.productName.toLowerCase().replace(/\s+/g, "-")}-promo.mp4`}
                  className="inline-flex items-center gap-1 border border-black bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000] hover:bg-gray-50"
                >
                  <Download className="h-3 w-3" />
                  <span>MP4</span>
                </a>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center overflow-hidden border-2 border-black bg-black">
              {activeVideo?.videoUrl ? (
                <video
                  src={activeVideo.videoUrl}
                  controls
                  playsInline
                  className="max-h-[280px] w-full object-contain"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center font-mono text-xs text-white/50">
                  Video render in progress...
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-black/70">
              <span>{activeVideo?.title || "Product Commercial"}</span>
              <span className="font-bold text-black">{activeVideo?.durationSec || 10}s · H.264</span>
            </div>
          </div>

          {/* Color Palette Card */}
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
                <Palette className="h-4 w-4" />
                <span>Color Palette</span>
              </div>
              <span className="font-mono text-[10px] text-black/50">Click to copy</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {palette.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex)}
                  className="group flex flex-col border-2 border-black bg-white p-2 text-left shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
                >
                  <span
                    className="h-10 w-full border border-black shadow-[1px_1px_0px_#000000]"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="mt-1.5 truncate font-mono text-[10px] font-bold text-black">
                    {swatch.name}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-black/60 group-hover:text-black">
                    {copiedHex === swatch.hex ? "✓ COPIED" : swatch.hex}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
