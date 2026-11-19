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
    <div className="flex flex-col border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
      {/* Approva Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E6F7EB] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_#000000]">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                COPYWRITING DECK &amp; CAMPAIGN TEXT
              </h3>
              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                @CopyAgent
              </span>
            </div>
            <p className="font-mono text-xs text-black/70">
              Platform-native posts, ad hooks &amp; hashtag clusters
            </p>
          </div>
        </div>

        {/* Brutalist Channel Tabs */}
        <div className="flex gap-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            const inBrief = selectedPlatforms.includes(tab);
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition-all",
                  active
                    ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                <span>{tab}</span>
                {!inBrief && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                )}
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
              <div className="flex h-12 w-12 animate-pulse items-center justify-center border-2 border-black bg-[#FEF3C7] text-black shadow-[3px_3px_0px_#000000]">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="font-display text-base font-black uppercase text-black">
                Generating Synchronized Conversion Copy...
              </p>
              <p className="font-mono text-xs text-black/70">
                @CopyAgent is reading visual mood and crafting channel-native messaging.
              </p>
            </>
          ) : (
            <div className="border-2 border-dashed border-black/40 bg-[#E6F7EB]/30 p-8">
              <p className="font-mono text-xs font-bold text-black/60">
                [NO COPY GENERATED] Run campaign brief to hydrate social &amp; ad variants.
              </p>
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
                      className="border-2 border-black bg-white p-3.5 shadow-[2px_2px_0px_#000000]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                        <div className="flex items-center gap-2">
                          <span className="border border-black bg-[#E6F7EB] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                            {post.variantLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-black/70">
                            <Clock className="h-3 w-3" />
                            {post.bestTimeToPost}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 border border-black bg-[#D1FAE5] px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                            <TrendingUp className="h-3 w-3" />
                            {post.estimatedEngagement}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.id, fullPostText)}
                            className="inline-flex items-center gap-1 border-2 border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-[#10B981]" />
                                <span>COPIED</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>COPY</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-2">
                        <p className="font-display text-sm font-black text-black">
                          {post.hook}
                        </p>
                        <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-black/80">
                          {post.body}
                        </p>
                        <div className="border border-black bg-[#E6F7EB]/50 p-2 font-mono text-xs text-black">
                          <span className="font-bold uppercase text-black">
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
                          "border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase transition-all",
                          idx === activeMetaIndex
                            ? "bg-black text-white shadow-[2px_2px_0px_#000000]"
                            : "bg-white text-black hover:bg-gray-100"
                        )}
                      >
                        VARIANT 0{idx + 1}: {variant.angle}
                      </button>
                    ))}
                  </div>
                )}

                {/* Copy Spec Box */}
                <div className="space-y-2.5 border-2 border-black bg-[#E6F7EB]/40 p-3.5 shadow-[2px_2px_0px_#000000]">
                  <div className="flex items-center justify-between border-b border-black pb-1.5">
                    <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-black">
                      <Megaphone className="h-3.5 w-3.5" />
                      AD COPY SPECIFICATION
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          activeMetaAd.id,
                          `Headline: ${activeMetaAd.headline}\nPrimary Text: ${activeMetaAd.primaryText}\nDescription: ${activeMetaAd.description}\nCTA: ${activeMetaAd.ctaLabel}`
                        )
                      }
                      className="inline-flex items-center gap-1 border-2 border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                    >
                      {copiedId === activeMetaAd.id ? (
                        <>
                          <Check className="h-3 w-3 text-[#10B981]" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>COPY AD</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div>
                      <span className="font-bold text-black/60">PRIMARY TEXT:</span>
                      <p className="mt-0.5 leading-relaxed text-black">
                        {activeMetaAd.primaryText}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                      <div className="border border-black bg-white p-2">
                        <span className="font-bold text-black/60">HEADLINE:</span>
                        <p className="mt-0.5 font-display text-xs font-bold text-black">
                          {activeMetaAd.headline}
                        </p>
                      </div>
                      <div className="border border-black bg-white p-2">
                        <span className="font-bold text-black/60">DESCRIPTION:</span>
                        <p className="mt-0.5 font-mono text-[11px] text-black/80">
                          {activeMetaAd.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brutalist Meta Feed Mockup */}
                <div className="border-2 border-black bg-white shadow-[2px_2px_0px_#000000]">
                  <div className="flex items-center justify-between border-b-2 border-black bg-[#E6F7EB]/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center border border-black bg-black font-mono text-[10px] font-bold text-white">
                        {(assets?.brief.productName || "AP").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-display text-xs font-bold text-black">
                          {assets?.brief.productName || "Brand Studio"}
                        </div>
                        <div className="font-mono text-[10px] text-black/60">
                          Sponsored · Feed Ad Preview
                        </div>
                      </div>
                    </div>
                    <span className="border border-black bg-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-black">
                      MOCKUP
                    </span>
                  </div>

                  <p className="p-3 font-mono text-xs leading-relaxed text-black">
                    {activeMetaAd.primaryText}
                  </p>

                  {metaPreviewCreative && (
                    <div className="aspect-[16/9] w-full overflow-hidden border-y-2 border-black bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={metaPreviewCreative.imageUrl}
                        alt={activeMetaAd.headline}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#E6F7EB]/20 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] uppercase text-black/60">
                        {activeMetaAd.displayUrl}
                      </div>
                      <div className="truncate font-display text-sm font-bold text-black">
                        {activeMetaAd.headline}
                      </div>
                      <div className="truncate font-mono text-xs text-black/70">
                        {activeMetaAd.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy("meta-cta", activeMetaAd.ctaLabel)}
                      className="border-2 border-black bg-[#10B981] px-3 py-1 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000]"
                    >
                      {activeMetaAd.ctaLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hashtag Stack */}
            {hashtags.length > 0 && (
              <div className="space-y-1.5 border-2 border-black bg-[#E6F7EB]/30 p-3 shadow-[2px_2px_0px_#000000]">
                <div className="flex items-center justify-between border-b border-black pb-1">
                  <span className="flex items-center gap-1 font-display text-xs font-bold uppercase text-black">
                    <Hash className="h-3 w-3" />
                    CAMPAIGN HASHTAG CLUSTER
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("hashtags", hashtags.join(" "))}
                    className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black"
                  >
                    {copiedId === "hashtags" ? "COPIED" : "COPY ALL"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-black bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-black shadow-[1px_1px_0px_#000000]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copy Full Deck Button */}
          <div className="border-t-2 border-black pt-3">
            <button
              type="button"
              onClick={handleCopyFullDeck}
              className="flex w-full items-center justify-center gap-2 border-2 border-black bg-white py-2 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-gray-50"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copiedId === "full-deck" ? "FULL DECK COPIED" : "COPY COMPLETE COPY DECK"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
