"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Hash,
  Megaphone,
  PenTool,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  CampaignAssets,
  MetaAdVariant,
  Platform,
  SocialPost,
  VisualCreative,
} from "@/types/campaign";
import { cn, copyTextToClipboard } from "@/lib/utils";

interface CopyDeckCardProps {
  assets: CampaignAssets | null;
  socialPosts: SocialPost[];
  metaAds: MetaAdVariant[];
  hashtags: string[];
  creatives: VisualCreative[];
  selectedPlatforms: Platform[];
  isLoading: boolean;
  onExportJson: () => void;
  onExportZip: () => void;
  isExportingZip: boolean;
}

type CopyTab = "Instagram" | "LinkedIn" | "Meta Ads";

export function CopyDeckCard({
  assets,
  socialPosts,
  metaAds,
  hashtags,
  creatives,
  selectedPlatforms,
  isLoading,
  onExportJson,
  onExportZip,
  isExportingZip,
}: CopyDeckCardProps) {
  const [activeTab, setActiveTab] = useState<CopyTab>("Instagram");
  const [activeMetaIndex, setActiveMetaIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tabs: CopyTab[] = ["Instagram", "LinkedIn", "Meta Ads"];

  const filteredPosts = useMemo(
    () => socialPosts.filter((p) => p.platform === activeTab),
    [socialPosts, activeTab]
  );

  const activeMetaAd = metaAds[activeMetaIndex] ?? metaAds[0];
  const metaPreviewCreative =
    creatives[activeMetaAd?.creativeIndex ?? 0] ?? creatives[0];

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
    }
  };

  const handleCopyFullDeck = () => {
    const sections: string[] = [];
    socialPosts.forEach((p) => {
      sections.push(
        `[${p.platform} - ${p.variantLabel}]\n${p.hook}\n\n${p.body}\n\nCTA: ${p.callToAction}`
      );
    });
    metaAds.forEach((ad) => {
      sections.push(
        `[Meta Ad - ${ad.angle}]\nHeadline: ${ad.headline}\nPrimary Text: ${ad.primaryText}\nDescription: ${ad.description}\nCTA: ${ad.ctaLabel}`
      );
    });
    if (hashtags.length > 0) {
      sections.push(`[Hashtags]\n${hashtags.join(" ")}`);
    }
    handleCopy("full-deck", sections.join("\n\n---\n\n"));
  };

  const hasContent = socialPosts.length > 0 || metaAds.length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-apple">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F]">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
                Copy Deck
              </h3>
              <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 font-mono text-[10px] font-medium text-[#6E6E73]">
                @CopyAgent
              </span>
            </div>
            <p className="text-[12px] text-[#6E6E73]">
              Platform-native posts, ad preview &amp; hashtags
            </p>
          </div>
        </div>

        {/* Classic Apple Segmented Tabs */}
        <div className="flex rounded-full bg-[#F5F5F7] p-1">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            const inBrief = selectedPlatforms.includes(tab);
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                  active ? "text-[#1D1D1F]" : "text-[#6E6E73] hover:text-[#1D1D1F]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="copyDeckTabBg"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-white shadow-apple-pill"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <span>{tab}</span>
                  {!inBrief && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D2D2D7]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          {isLoading ? (
            <>
              <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-[#0071E3]/[0.1] text-[#0071E3]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                Drafting synchronized platform copy…
              </p>
              <p className="text-[13px] text-[#6E6E73]">
                @CopyAgent is aligning tone and hooks to the visual brief.
              </p>
            </>
          ) : (
            <p className="text-[14px] text-[#86868B]">
              Instagram, LinkedIn, and Meta Ads copy will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-5 p-6">
          <div className="space-y-4">
            {/* Instagram & LinkedIn Posts */}
            {activeTab !== "Meta Ads" && (
              <div className="space-y-3.5">
                {filteredPosts.map((post) => {
                  const fullPostText = `${post.hook}\n\n${post.body}\n\n${post.callToAction}\n\n${hashtags.join(" ")}`;
                  const isCopied = copiedId === post.id;
                  return (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4 transition hover:border-black/[0.12]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#1D1D1F] shadow-sm">
                            {post.variantLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#6E6E73]">
                            <Clock className="h-3 w-3 text-[#86868B]" />
                            {post.bestTimeToPost}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#248A3D]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#1D6F31]">
                            <TrendingUp className="h-3 w-3" />
                            {post.estimatedEngagement}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.id, fullPostText)}
                            className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:border-black/[0.2]"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-[#248A3D]" />
                                <span className="text-[#1D6F31]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-[#6E6E73]" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-[#1D1D1F]">
                          {post.hook}
                        </p>
                        <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#424245]">
                          {post.body}
                        </p>
                        <div className="rounded-xl bg-white px-3.5 py-2.5 text-[12px] text-[#1D1D1F] shadow-sm">
                          <span className="font-semibold text-[#0066CC]">
                            Call to Action:{" "}
                          </span>
                          {post.callToAction}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Meta Ads Tab */}
            {activeTab === "Meta Ads" && activeMetaAd && (
              <div className="space-y-4">
                {metaAds.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {metaAds.map((variant, idx) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setActiveMetaIndex(idx)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition",
                          idx === activeMetaIndex
                            ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                            : "border-black/[0.08] bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                        )}
                      >
                        Variant 0{idx + 1}: {variant.angle}
                      </button>
                    ))}
                  </div>
                )}

                {/* Copy Spec */}
                <div className="space-y-3 rounded-2xl bg-[#F5F5F7] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F]">
                      <Megaphone className="h-3.5 w-3.5 text-[#0071E3]" />
                      Ad Copy Specification
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          activeMetaAd.id,
                          `Headline: ${activeMetaAd.headline}\nPrimary Text: ${activeMetaAd.primaryText}\nDescription: ${activeMetaAd.description}\nCTA: ${activeMetaAd.ctaLabel}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:border-black/[0.2]"
                    >
                      {copiedId === activeMetaAd.id ? (
                        <>
                          <Check className="h-3 w-3 text-[#248A3D]" />
                          <span className="text-[#1D6F31]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-[#6E6E73]" />
                          <span>Copy Ad</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2.5 text-[13px]">
                    <div>
                      <span className="text-[11px] font-medium text-[#86868B]">
                        Primary Text
                      </span>
                      <p className="mt-0.5 leading-relaxed text-[#1D1D1F]">
                        {activeMetaAd.primaryText}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <span className="text-[11px] font-medium text-[#86868B]">
                          Headline
                        </span>
                        <p className="mt-0.5 text-[13px] font-semibold text-[#1D1D1F]">
                          {activeMetaAd.headline}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <span className="text-[11px] font-medium text-[#86868B]">
                          Description
                        </span>
                        <p className="mt-0.5 text-[12px] text-[#424245]">
                          {activeMetaAd.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Light-Mode Meta Ad Feed Preview */}
                <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1D1D1F] text-[11px] font-semibold text-white">
                        {(assets?.brief.productName || "AP").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#1D1D1F]">
                          {assets?.brief.productName || "Brand Studio"}
                        </div>
                        <div className="text-[11px] text-[#86868B]">
                          Sponsored · Meta Feed Preview
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                      Ad Preview
                    </span>
                  </div>

                  <p className="px-4 pb-3 text-[13px] leading-relaxed text-[#424245]">
                    {activeMetaAd.primaryText}
                  </p>

                  {metaPreviewCreative && (
                    <div className="aspect-[16/9] w-full overflow-hidden border-y border-black/[0.06] bg-[#F5F5F7]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={metaPreviewCreative.imageUrl}
                        alt={activeMetaAd.headline}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FBFBFD] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-[#86868B]">
                        {activeMetaAd.displayUrl}
                      </div>
                      <div className="truncate text-[14px] font-semibold text-[#1D1D1F]">
                        {activeMetaAd.headline}
                      </div>
                      <div className="truncate text-[12px] text-[#6E6E73]">
                        {activeMetaAd.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `cta-${activeMetaAd.id}`,
                          activeMetaAd.ctaLabel
                        )
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#0077ED]"
                    >
                      <span>{activeMetaAd.ctaLabel}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Curated Hashtags */}
            {hashtags.length > 0 && (
              <div className="space-y-2.5 rounded-2xl bg-[#F5F5F7] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F]">
                    <Hash className="h-3.5 w-3.5 text-[#6E6E73]" />
                    Hashtags
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("all-tags", hashtags.join(" "))}
                    className="text-[12px] font-medium text-[#0066CC] transition hover:underline"
                  >
                    {copiedId === "all-tags" ? "Copied all" : "Copy all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => {
                    const isCopied = copiedId === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleCopy(tag, tag)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[12px] font-medium transition",
                          isCopied
                            ? "border-[#248A3D]/30 bg-[#248A3D]/10 text-[#1D6F31]"
                            : "border-black/[0.06] bg-white text-[#424245] hover:border-black/[0.2] hover:text-[#1D1D1F]"
                        )}
                      >
                        {isCopied ? `✓ ${tag}` : tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Classic Apple Export Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-black/[0.06] pt-4">
            <button
              type="button"
              onClick={handleCopyFullDeck}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-[12px] font-medium text-[#1D1D1F] transition hover:border-[#86868B] hover:bg-[#F5F5F7]"
            >
              {copiedId === "full-deck" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#248A3D]" />
                  <span className="text-[#1D6F31]">Copied Deck</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#6E6E73]" />
                  <span>Copy All</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!assets}
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-[12px] font-medium text-[#1D1D1F] transition hover:border-[#86868B] hover:bg-[#F5F5F7] disabled:opacity-40"
              >
                <FileJson className="h-3.5 w-3.5 text-[#6E6E73]" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                disabled={!assets || isExportingZip}
                onClick={onExportZip}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#0077ED] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExportingZip ? "Packing…" : "Export Kit"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
