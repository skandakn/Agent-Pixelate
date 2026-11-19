"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
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
    <div className="flex flex-col rounded-2xl border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] bg-[#FBFBFD] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <PenTool className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#1D1D1F]">
              Copy Deck
            </h3>
            <p className="text-[11px] text-neutral-400">
              Channel-tailored messaging &amp; ad hooks
            </p>
          </div>
        </div>

        {/* Minimalist Segmented Tabs */}
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-medium">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-all",
                  active
                    ? "bg-white text-neutral-900 shadow-sm font-semibold"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
          {isLoading ? (
            <>
              <div className="flex h-9 w-9 animate-pulse items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-neutral-800">
                Crafting channel messaging...
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400">
              Launch a campaign to generate copy variants.
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div className="space-y-4">
            {/* Instagram & LinkedIn Posts */}
            {activeTab !== "Meta Ads" && (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const fullPostText = `${post.hook}\n\n${post.body}\n\n${post.callToAction}\n\n${hashtags.join(" ")}`;
                  const isCopied = copiedId === post.id;
                  return (
                    <div
                      key={post.id}
                      className="rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-4 transition hover:border-black/[0.12]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-700">
                            {post.variantLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                            <Clock className="h-3 w-3" />
                            {post.bestTimeToPost}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <TrendingUp className="h-3 w-3" />
                            {post.estimatedEngagement}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.id, fullPostText)}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-neutral-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold text-[#1D1D1F]">
                          {post.hook}
                        </p>
                        <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-600">
                          {post.body}
                        </p>
                        <div className="rounded-lg bg-neutral-100/60 p-2 text-xs text-neutral-700">
                          <span className="font-medium text-neutral-900">
                            CTA:{" "}
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
                  <div className="flex flex-wrap gap-1.5">
                    {metaAds.map((variant, idx) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setActiveMetaIndex(idx)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition",
                          idx === activeMetaIndex
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        )}
                      >
                        {variant.angle}
                      </button>
                    ))}
                  </div>
                )}

                {/* Copy Spec Box */}
                <div className="space-y-2 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3.5">
                  <div className="flex items-center justify-between border-b border-black/[0.04] pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                      <Megaphone className="h-3.5 w-3.5 text-neutral-400" />
                      Ad Copy
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          activeMetaAd.id,
                          `Headline: ${activeMetaAd.headline}\nPrimary Text: ${activeMetaAd.primaryText}\nDescription: ${activeMetaAd.description}\nCTA: ${activeMetaAd.ctaLabel}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm"
                    >
                      {copiedId === activeMetaAd.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-neutral-400" />
                          <span>Copy Ad</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[11px] text-neutral-400">Primary:</span>
                      <p className="mt-0.5 leading-relaxed text-neutral-800">
                        {activeMetaAd.primaryText}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-2 border border-black/[0.04]">
                        <span className="text-[10px] text-neutral-400">Headline:</span>
                        <p className="mt-0.5 text-xs font-semibold text-[#1D1D1F]">
                          {activeMetaAd.headline}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-black/[0.04]">
                        <span className="text-[10px] text-neutral-400">Description:</span>
                        <p className="mt-0.5 text-[11px] text-neutral-600">
                          {activeMetaAd.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Minimalist Meta Feed Mockup */}
                <div className="rounded-xl border border-black/[0.08] bg-white overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between border-b border-black/[0.04] bg-[#FBFBFD] px-3.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[9px] font-bold text-white">
                        {(assets?.brief.productName || "AP").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-neutral-800">
                        {assets?.brief.productName || "Brand"}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400">Sponsored</span>
                  </div>

                  <p className="p-3 text-xs leading-relaxed text-neutral-700">
                    {activeMetaAd.primaryText}
                  </p>

                  {metaPreviewCreative && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={metaPreviewCreative.imageUrl}
                        alt={activeMetaAd.headline}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase text-neutral-400">
                        {activeMetaAd.displayUrl}
                      </div>
                      <div className="truncate text-xs font-semibold text-[#1D1D1F]">
                        {activeMetaAd.headline}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy("meta-cta", activeMetaAd.ctaLabel)}
                      className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-black transition"
                    >
                      {activeMetaAd.ctaLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hashtag Stack */}
            {hashtags.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-black/[0.06] bg-[#FBFBFD] p-3">
                <div className="flex items-center justify-between border-b border-black/[0.04] pb-1.5">
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#1D1D1F]">
                    <Hash className="h-3 w-3 text-neutral-400" />
                    Hashtags
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("hashtags", hashtags.join(" "))}
                    className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900"
                  >
                    {copiedId === "hashtags" ? "Copied" : "Copy All"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copy Full Deck Button */}
          <div className="border-t border-black/[0.06] pt-3">
            <button
              type="button"
              onClick={handleCopyFullDeck}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition"
            >
              <Copy className="h-3.5 w-3.5 text-neutral-500" />
              <span>{copiedId === "full-deck" ? "Copied" : "Copy Deck"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
