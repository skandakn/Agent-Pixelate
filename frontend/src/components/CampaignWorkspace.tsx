/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  PenTool,
  Plus,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  AgentEvent,
  CampaignAssets,
  CampaignBrief,
  CampaignStatus,
  CampaignVideoAsset,
  ConnectionMode,
  PipelineStage,
} from "@/types/campaign";
import { BLANK_CUSTOM_BRIEF, DEMO_PRESETS } from "@/data/presets";
import { launchCampaignSession } from "@/lib/campaignClient";
import { exportCampaignZip } from "@/lib/exportKit";
import { cn, copyTextToClipboard } from "@/lib/utils";
import { TopNav } from "@/components/TopNav";
import { CampaignBriefStudio } from "@/components/CampaignBriefStudio";

export function CampaignWorkspace() {
  const [brief, setBrief] = useState<CampaignBrief>(DEMO_PRESETS[0].brief);
  const [status, setStatus] = useState<CampaignStatus>("idle");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [preferMockMode, setPreferMockMode] = useState<boolean>(false);
  const [resolvedMode, setResolvedMode] = useState<ConnectionMode>("mock");
  const [modeNotice, setModeNotice] = useState<string | null>(null);

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage>("user_brief");
  const [partialAssets, setPartialAssets] = useState<Partial<CampaignAssets>>({});
  const [finalAssets, setFinalAssets] = useState<CampaignAssets | null>(null);
  const [extraVideos, setExtraVideos] = useState<CampaignVideoAsset[]>([]);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [selectedAspect, setSelectedAspect] = useState<"1:1" | "9:16" | "16:9">("1:1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const controllerRef = useRef<{ cancel: () => void } | null>(null);

  const handleLaunch = useCallback(
    (overrideBrief?: CampaignBrief) => {
      const targetBrief = overrideBrief ?? brief;
      if (overrideBrief) {
        setBrief(overrideBrief);
      }

      controllerRef.current?.cancel();
      setStatus("running");
      setEvents([]);
      setCurrentStage("user_brief");
      setPartialAssets({});
      setFinalAssets(null);
      setExtraVideos([]);
      setModeNotice(null);

      controllerRef.current = launchCampaignSession(
        targetBrief,
        preferMockMode,
        {
          onCampaignId: (id) => setCampaignId(id),
          onModeResolved: (mode, notice) => {
            setResolvedMode(mode);
            if (notice) setModeNotice(notice);
          },
          onEvent: (evt) => {
            setEvents((prev) => [...prev, evt]);
            setCurrentStage(evt.stage);
          },
          onPartialAssets: (partial) => {
            setPartialAssets((prev) => ({ ...prev, ...partial }));
            setFinalAssets((prev) => (prev ? { ...prev, ...partial } : prev));
          },
          onApprovalRequired: () => {
            setStatus("awaiting_approval");
            setCurrentStage("context_handoff");
          },
          onComplete: (completeAssets) => {
            setFinalAssets(completeAssets);
            setPartialAssets(completeAssets);
            setCurrentStage("final_campaign");
            setStatus("completed");
          },
          onError: (msg) => {
            setModeNotice(msg);
            setStatus("error");
          },
        }
      );
    },
    [brief, preferMockMode]
  );

  const handleCancel = useCallback(() => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    setStatus(finalAssets ? "completed" : "idle");
  }, [finalAssets]);

  const handleExportZip = useCallback(async () => {
    if (!finalAssets) return;
    setIsExportingZip(true);
    try {
      const mergedVideos = [
        ...(finalAssets.videos ?? []),
        ...extraVideos.filter(
          (ev) => !(finalAssets.videos ?? []).some((v) => v.id === ev.id)
        ),
      ];
      await exportCampaignZip({ ...finalAssets, videos: mergedVideos });
    } finally {
      setIsExportingZip(false);
    }
  }, [finalAssets, extraVideos]);

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const currentAssets = finalAssets ?? partialAssets;
  const creatives = currentAssets.creatives ?? [];
  const videos = [
    ...(currentAssets.videos ?? []),
    ...extraVideos.filter(
      (ev) => !(currentAssets.videos ?? []).some((v) => v.id === ev.id)
    ),
  ];
  const palette = currentAssets.palette ?? [];
  const socialPosts = currentAssets.socialPosts ?? [];
  const hashtags = currentAssets.hashtags ?? [];
  const latestEvent = events[events.length - 1];

  const activeCreative =
    creatives.find((c) => c.aspectRatio === selectedAspect) || creatives[0];
  const activeVideo =
    videos.find((v) => v.aspectRatio === selectedAspect) || videos[0];

  return (
    <div className="min-h-screen bg-[#F4FBF7] font-sans text-black">
      {/* TopNav */}
      <TopNav
        campaignId={campaignId}
        status={status}
        preferMockMode={preferMockMode}
        resolvedMode={resolvedMode}
        modeNotice={modeNotice}
        assets={finalAssets}
        onToggleMockMode={() => setPreferMockMode((v) => !v)}
        onNewCustomRun={() => {
          setBrief(BLANK_CUSTOM_BRIEF);
          setStatus("idle");
          setFinalAssets(null);
          setPartialAssets({});
          setEvents([]);
        }}
        onExportZip={handleExportZip}
        isExportingZip={isExportingZip}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* VIEW 1: CREATION FORM (when idle or no final assets) */}
        {status === "idle" && !finalAssets && (
          <div className="space-y-8">
            <CampaignBriefStudio
              brief={brief}
              status={status}
              onChangeBrief={setBrief}
              onLaunch={() => handleLaunch()}
              onCancel={handleCancel}
            />

            {/* Subtle Feature Summary */}
            <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
              <div className="border border-black/15 bg-white p-4 shadow-[2px_2px_0px_#000000]">
                <div className="font-mono text-xs font-bold uppercase text-black">
                  Product Photography
                </div>
                <p className="mt-1 font-mono text-[11px] text-black/60">
                  1:1 Square, 9:16 Story, and 16:9 Wide
                </p>
              </div>

              <div className="border border-black/15 bg-white p-4 shadow-[2px_2px_0px_#000000]">
                <div className="font-mono text-xs font-bold uppercase text-black">
                  Kinetic MP4 Video
                </div>
                <p className="mt-1 font-mono text-[11px] text-black/60">
                  10s commercial cut matched to tone
                </p>
              </div>

              <div className="border border-black/15 bg-white p-4 shadow-[2px_2px_0px_#000000]">
                <div className="font-mono text-xs font-bold uppercase text-black">
                  Marketing Copy
                </div>
                <p className="mt-1 font-mono text-[11px] text-black/60">
                  Instagram captions and LinkedIn posts
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: RUNNING / LOADING STATE */}
        {(status === "running" || status === "awaiting_approval") && (
          <div className="border-2 border-black bg-white p-10 text-center shadow-[4px_4px_0px_#000000]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-black bg-[#E6F7EB] text-black shadow-[2px_2px_0px_#000000]">
              <Loader2 className="h-7 w-7 animate-spin text-[#10B981]" />
            </div>

            <h3 className="mt-5 font-display text-xl font-black uppercase text-black sm:text-2xl">
              Synthesizing Campaign Assets
            </h3>

            <p className="mx-auto mt-2 max-w-md font-mono text-xs text-black/70">
              {latestEvent
                ? latestEvent.message
                : "Collaborating to generate custom photography, kinetic video cuts, and marketing copy..."}
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={handleCancel}
                className="border border-black bg-white px-5 py-2 font-mono text-xs font-bold uppercase text-red-600 hover:bg-red-50"
              >
                Cancel Generation
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: COMPLETED RESULTS (CLEAN, MINIMALIST, HIGH-IMPACT) */}
        {status === "completed" && finalAssets && (
          <div className="space-y-8">
            {/* Header Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000000]">
              <div>
                <span className="border border-black bg-[#10B981] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                  GENERATED
                </span>
                <h2 className="mt-1 font-display text-lg font-black uppercase tracking-tight text-black">
                  {brief.productName}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBrief(BLANK_CUSTOM_BRIEF);
                    setStatus("idle");
                    setFinalAssets(null);
                    setPartialAssets({});
                    setEvents([]);
                  }}
                  className="inline-flex items-center gap-1.5 border border-black bg-white px-3.5 py-2 font-mono text-xs font-bold uppercase text-black hover:bg-gray-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Run</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isExportingZip}
                  className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-4 py-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
                >
                  <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>{isExportingZip ? "PACKING..." : "DOWNLOAD KIT (.ZIP)"}</span>
                </button>
              </div>
            </div>

            {/* Section 1: Generated Visuals */}
            <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                    Product Visuals
                  </h3>
                </div>

                {/* Aspect Switcher */}
                <div className="flex gap-1.5">
                  {(["1:1", "9:16", "16:9"] as const).map((aspect) => (
                    <button
                      key={aspect}
                      type="button"
                      onClick={() => setSelectedAspect(aspect)}
                      className={cn(
                        "border border-black px-2.5 py-1 font-mono text-xs font-bold uppercase transition",
                        selectedAspect === aspect
                          ? "bg-[#10B981] font-black text-black shadow-[1px_1px_0px_#000000]"
                          : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Image */}
              <div className="mt-4 flex items-center justify-center overflow-hidden border-2 border-black bg-black/5 p-2">
                {activeCreative?.imageUrl && (
                  <img
                    src={activeCreative.imageUrl}
                    alt={brief.productName}
                    className={cn(
                      "max-h-[500px] w-auto object-cover border border-black shadow-[2px_2px_0px_#000000]",
                      selectedAspect === "1:1" && "aspect-square",
                      selectedAspect === "9:16" && "aspect-[9/16]",
                      selectedAspect === "16:9" && "aspect-video"
                    )}
                  />
                )}
              </div>

              {/* Palette */}
              {palette.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
                  <span className="font-mono text-[11px] font-bold uppercase text-black/60">
                    Palette:
                  </span>
                  {palette.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => handleCopy(`hex_${swatch.hex}`, swatch.hex)}
                      className="inline-flex items-center gap-1.5 border border-black bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-black hover:bg-gray-50"
                    >
                      <span
                        className="h-2.5 w-2.5 border border-black"
                        style={{ backgroundColor: swatch.hex }}
                      />
                      <span>{copiedId === `hex_${swatch.hex}` ? "COPIED" : swatch.hex}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Kinetic MP4 Video */}
            {activeVideo?.videoUrl && (
              <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000]">
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                      Commercial Video (10s MP4)
                    </h3>
                  </div>
                  <a
                    href={activeVideo.videoUrl}
                    download={`${brief.productName.toLowerCase().replace(/\s+/g, "-")}-promo.mp4`}
                    className="inline-flex items-center gap-1 border border-black bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-black hover:bg-gray-50"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download MP4</span>
                  </a>
                </div>

                <div className="mt-4 flex items-center justify-center overflow-hidden border-2 border-black bg-black">
                  <video
                    src={activeVideo.videoUrl}
                    controls
                    playsInline
                    className="max-h-[360px] w-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Section 3: Marketing Copy */}
            {socialPosts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                  <PenTool className="h-4 w-4" />
                  <h3 className="font-display text-base font-black uppercase tracking-tight text-black">
                    Marketing Copy Decks
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {socialPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex flex-col justify-between border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000000]"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-black pb-2">
                          <span className="font-mono text-xs font-black uppercase text-black">
                            {post.platform}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(post.id, `${post.hook}\n\n${post.body}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`)
                            }
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-black hover:underline"
                          >
                            {copiedId === post.id ? (
                              <>
                                <Check className="h-3 w-3 text-[#10B981]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <h4 className="mt-3 font-display text-sm font-bold text-black">
                          {post.hook}
                        </h4>

                        <p className="mt-2 font-mono text-xs leading-relaxed text-black/80 whitespace-pre-line">
                          {post.body}
                        </p>
                      </div>

                      {hashtags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1 border-t border-black/10 pt-2 font-mono text-[10px] text-black/60">
                          {hashtags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={handleExportZip}
                disabled={isExportingZip}
                className="inline-flex items-center gap-2 border-2 border-black bg-[#10B981] px-6 py-3 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
              >
                <Download className="h-4 w-4 stroke-[2.5]" />
                <span>{isExportingZip ? "PREPARING ZIP..." : "DOWNLOAD COMPLETE CAMPAIGN KIT (.ZIP)"}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
