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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216] shadow-studio">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/15">
            <PenTool className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Matching Copy Deck
              </h3>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                @CopyAgent
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Platform-native posts, Meta Ads preview &amp; hashtag taxonomy
            </p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex rounded-xl border border-white/[0.08] bg-[#09090B] p-1">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            const inBrief = selectedPlatforms.includes(tab);
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="copyDeckTabBg"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-white/[0.1]"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <span>{tab}</span>
                  {!inBrief && (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          {isLoading ? (
            <>
              <div className="h-12 w-12 animate-pulse rounded-2xl border border-cyan-500/40 bg-cyan-500/15 p-3">
                <Sparkles className="h-full w-full text-cyan-300" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                @CopyAgent is awaiting visual handoff &amp; drafting platform copy...
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Synchronizing brand voice with visual lighting &amp; mood tokens
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              Generated Instagram, LinkedIn, and Meta Ads copy will populate here.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-5 p-5">
          <div className="space-y-4">
            {/* Social Posts Tab (Instagram / LinkedIn) */}
            {activeTab !== "Meta Ads" && (
              <div className="space-y-3.5">
                {filteredPosts.map((post) => {
                  const fullPostText = `${post.hook}\n\n${post.body}\n\n${post.callToAction}\n\n${hashtags.join(" ")}`;
                  const isCopied = copiedId === post.id;
                  return (
                    <div
                      key={post.id}
                      className="rounded-xl border border-white/[0.08] bg-[#0C0C10] p-4 transition hover:border-white/[0.15]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-cyan-300">
                            {post.variantLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                            <Clock className="h-3 w-3 text-zinc-500" />
                            {post.bestTimeToPost}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                            <TrendingUp className="h-3 w-3" />
                            {post.estimatedEngagement}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.id, fullPostText)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#16161D] px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-cyan-400/50 hover:text-white"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-300">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-zinc-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <p className="text-sm font-semibold leading-snug text-white">
                          {post.hook}
                        </p>
                        <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">
                          {post.body}
                        </p>
                        <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2 text-xs text-violet-200">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-violet-300">
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
                {/* Variant Selector */}
                {metaAds.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {metaAds.map((variant, idx) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setActiveMetaIndex(idx)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                          idx === activeMetaIndex
                            ? "border-violet-400/60 bg-violet-500/15 text-white"
                            : "border-white/[0.08] bg-[#0B0B0F] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                        )}
                      >
                        Variant 0{idx + 1}: {variant.angle}
                      </button>
                    ))}
                  </div>
                )}

                {/* Copy Spec Fields */}
                <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#0C0C10] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                      <Megaphone className="h-3 w-3" />
                      Meta Ad Copy Spec
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          activeMetaAd.id,
                          `Headline: ${activeMetaAd.headline}\nPrimary Text: ${activeMetaAd.primaryText}\nDescription: ${activeMetaAd.description}\nCTA: ${activeMetaAd.ctaLabel}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#16161D] px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-cyan-400/50"
                    >
                      {copiedId === activeMetaAd.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-zinc-400" />
                          <span>Copy Ad</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-zinc-500">
                        Primary Text
                      </span>
                      <p className="mt-0.5 leading-relaxed text-zinc-200">
                        {activeMetaAd.primaryText}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                      <div className="rounded-lg border border-white/[0.06] bg-[#14141A] p-2.5">
                        <span className="font-mono text-[10px] uppercase text-zinc-500">
                          Headline
                        </span>
                        <p className="mt-0.5 font-semibold text-white">
                          {activeMetaAd.headline}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-[#14141A] p-2.5">
                        <span className="font-mono text-[10px] uppercase text-zinc-500">
                          Description
                        </span>
                        <p className="mt-0.5 text-zinc-300">
                          {activeMetaAd.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Meta Ad CTA Preview Card */}
                <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0A0E]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-bold text-white">
                        {(assets?.brief.productName || "AP").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {assets?.brief.productName || "Brand Studio"}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          Sponsored · Meta Feed Preview
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                      AD PREVIEW
                    </span>
                  </div>

                  <p className="px-4 pb-3 text-xs leading-relaxed text-zinc-300">
                    {activeMetaAd.primaryText}
                  </p>

                  {metaPreviewCreative && (
                    <div className="aspect-[16/9] w-full overflow-hidden border-y border-white/[0.08] bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={metaPreviewCreative.imageUrl}
                        alt={activeMetaAd.headline}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#14141B] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {activeMetaAd.displayUrl}
                      </div>
                      <div className="truncate text-sm font-semibold text-white">
                        {activeMetaAd.headline}
                      </div>
                      <div className="truncate text-[11px] text-zinc-400">
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
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white shadow-violet-glow transition hover:brightness-110"
                    >
                      <span>{activeMetaAd.ctaLabel}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hashtag Pills */}
            {hashtags.length > 0 && (
              <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#0C0C10] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                    <Hash className="h-3 w-3 text-cyan-400" />
                    Curated Hashtags · Click Pill to Copy
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("all-tags", hashtags.join(" "))}
                    className="font-mono text-[10px] text-cyan-300 transition hover:text-cyan-200"
                  >
                    {copiedId === "all-tags" ? "✓ Copied All" : "Copy All"}
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
                          "rounded-full border px-2.5 py-1 font-mono text-[11px] transition",
                          isCopied
                            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                            : "border-white/[0.09] bg-[#16161D] text-zinc-300 hover:border-cyan-400/50 hover:text-white"
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

          {/* Export & Clipboard Footer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={handleCopyFullDeck}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#0B0B0F] px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              {copiedId === "full-deck" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied Full Copy Deck</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!assets}
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-zinc-100 transition hover:border-cyan-400/50 hover:text-white disabled:opacity-40"
              >
                <FileJson className="h-3.5 w-3.5 text-cyan-400" />
                <span>Export .JSON</span>
              </button>
              <button
                type="button"
                disabled={!assets || isExportingZip}
                onClick={onExportZip}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] px-4 py-2 text-xs font-semibold text-white shadow-violet-glow transition hover:brightness-110 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExportingZip ? "Building .ZIP..." : "Export Kit .ZIP"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
