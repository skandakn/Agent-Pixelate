"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Layers, Palette, PenTool } from "lucide-react";
import {
  AgentEvent,
  CampaignAssets,
  CampaignBrief,
  CampaignStatus,
  CampaignVideoAsset,
  ConnectionMode,
  PipelineStage,
  VideoAspectRatio,
  VideoShotStyle,
} from "@/types/campaign";
import { DEMO_PRESETS } from "@/data/presets";
import {
  CampaignSessionController,
  launchCampaignSession,
  requestCustomVideoCut,
} from "@/lib/campaignClient";
import { exportCampaignJson, exportCampaignZip } from "@/lib/exportKit";
import { TopNav } from "@/components/TopNav";
import { CampaignBriefStudio } from "@/components/CampaignBriefStudio";
import { AgentPipelineGraph } from "@/components/AgentPipelineGraph";
import { VisualShowcaseCard } from "@/components/VisualShowcaseCard";
import { CopyDeckCard } from "@/components/CopyDeckCard";

export function CampaignWorkspace() {
  const [brief, setBrief] = useState<CampaignBrief>(DEMO_PRESETS[0].brief);
  const [status, setStatus] = useState<CampaignStatus>("idle");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [preferMockMode, setPreferMockMode] = useState<boolean>(false);
  const [resolvedMode, setResolvedMode] = useState<ConnectionMode>("mock");
  const [modeNotice, setModeNotice] = useState<string | null>(null);

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
  const [partialAssets, setPartialAssets] = useState<Partial<CampaignAssets>>({});
  const [finalAssets, setFinalAssets] = useState<CampaignAssets | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [extraVideos, setExtraVideos] = useState<CampaignVideoAsset[]>([]);
  const [isRenderingCut, setIsRenderingCut] = useState(false);
  const [videoRenderError, setVideoRenderError] = useState<string | null>(null);

  const controllerRef = useRef<CampaignSessionController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

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
      setVideoRenderError(null);
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

  const handleExportJson = useCallback(() => {
    if (!finalAssets) return;
    exportCampaignJson(finalAssets);
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

  const handleRenderCustomCut = useCallback(
    async (aspectRatio: VideoAspectRatio, shotStyle: VideoShotStyle) => {
      if (!campaignId) return;
      setIsRenderingCut(true);
      setVideoRenderError(null);
      try {
        const newVideo = await requestCustomVideoCut(
          campaignId,
          aspectRatio,
          shotStyle
        );
        setExtraVideos((prev) => [...prev, newVideo]);
      } catch (err) {
        setVideoRenderError(
          err instanceof Error ? err.message : "Failed to render MP4 cut."
        );
      } finally {
        setIsRenderingCut(false);
      }
    },
    [campaignId]
  );

  const creatives = finalAssets?.creatives ?? partialAssets.creatives ?? [];
  const baseVideos = finalAssets?.videos ?? partialAssets.videos ?? [];
  const videos = [
    ...baseVideos,
    ...extraVideos.filter((ev) => !baseVideos.some((v) => v.id === ev.id)),
  ];
  const palette = finalAssets?.palette ?? partialAssets.palette ?? [];
  const storyboard = finalAssets?.storyboard ?? partialAssets.storyboard ?? [];
  const artDirectionSummary =
    finalAssets?.artDirectionSummary ?? partialAssets.artDirectionSummary ?? "";
  const handoff = finalAssets?.handoff ?? partialAssets.handoff ?? null;
  const socialPosts =
    finalAssets?.socialPosts ?? partialAssets.socialPosts ?? [];
  const metaAds = finalAssets?.metaAds ?? partialAssets.metaAds ?? [];
  const hashtags = finalAssets?.hashtags ?? partialAssets.hashtags ?? [];

  const showWorkspaceBento = status !== "idle" || creatives.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      <TopNav
        campaignId={campaignId}
        status={status}
        preferMockMode={preferMockMode}
        resolvedMode={resolvedMode}
        modeNotice={modeNotice}
        assets={finalAssets}
        onToggleMockMode={() => setPreferMockMode((v) => !v)}
        onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
        onExportJson={handleExportJson}
        onExportZip={handleExportZip}
        isExportingZip={isExportingZip}
      />

      <div className="mx-auto flex max-w-[1600px]">
        {/* Left Campaign Brief Studio Panel / Drawer */}
        <CampaignBriefStudio
          brief={brief}
          status={status}
          onChangeBrief={setBrief}
          onLaunch={() => handleLaunch()}
          onCancel={handleCancel}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />

        {/* Main Apple-Style Workspace Canvas */}
        <main className="min-w-0 flex-1 space-y-6 p-5 sm:p-8">
          {/* Live Multi-Agent Collaboration Pipeline */}
          <AgentPipelineGraph
            events={events}
            currentStage={currentStage}
            status={status}
            handoff={handoff}
          />

          {/* Main Asset Grid or Classic Apple Product-Launch Hero */}
          {!showWorkspaceBento ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="rounded-[24px] border border-black/[0.06] bg-white px-7 py-10 shadow-apple sm:px-14 sm:py-14"
            >
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#0071E3]">
                  Agent Pixelate Studio
                </p>

                <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.032em] text-[#1D1D1F] sm:text-5xl">
                  Two agents.
                  <br />
                  One effortless campaign.
                </h2>

                <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#6E6E73] sm:text-[17px]">
                  <span className="font-medium text-[#1D1D1F]">@VisualAgent</span>{" "}
                  and{" "}
                  <span className="font-medium text-[#1D1D1F]">@CopyAgent</span>{" "}
                  collaborate in a shared BAND room—turning a single product brief
                  into cohesive art direction, multi-aspect visuals, and
                  platform-native copy.
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleLaunch()}
                    className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-6 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#0077ED]"
                  >
                    Launch Campaign
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(true)}
                    className="inline-flex items-center justify-center rounded-full border border-[#0071E3] px-5 py-2.5 text-[14px] font-medium text-[#0066CC] transition hover:bg-[#0071E3]/[0.06] lg:hidden"
                  >
                    Edit Brief
                  </button>
                </div>
              </div>

              {/* Classic Apple Showcase Preset Tiles */}
              <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLaunch(preset.brief)}
                    className="group flex flex-col justify-between rounded-[18px] bg-[#F5F5F7] p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-[#EFEFF2] hover:shadow-apple"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className="h-3 w-3 rounded-full shadow-sm ring-2 ring-white"
                          style={{ backgroundColor: preset.accentHex }}
                        />
                        <span className="text-[11px] font-medium text-[#86868B]">
                          {preset.brief.brandTone}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                        {preset.label}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">
                        {preset.tagline}
                      </p>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-0.5 text-[13px] font-medium text-[#0066CC] transition group-hover:underline">
                      <span>Launch demo</span>
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Restrained Feature Spec Row */}
              <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-black/[0.06] pt-7 text-[12px] font-medium text-[#6E6E73]">
                <span className="inline-flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#1D1D1F]" />
                  3 Aspect Creatives &amp; MP4 Video Studio
                </span>
                <span className="inline-flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-[#1D1D1F]" />
                  Instagram, LinkedIn &amp; Meta Ads
                </span>
                <span className="inline-flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#1D1D1F]" />
                  JSON &amp; ZIP Campaign Kit
                </span>
              </div>
            </motion.section>
          ) : (
            /* Campaign Asset Bento Grid */
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <VisualShowcaseCard
                  campaignId={campaignId}
                  brief={brief}
                  creatives={creatives}
                  videos={videos}
                  palette={palette}
                  artDirectionSummary={artDirectionSummary}
                  storyboard={storyboard}
                  isLoading={status === "running"}
                  isLiveBackend={resolvedMode === "live" && !preferMockMode}
                  isRenderingCut={isRenderingCut}
                  renderError={videoRenderError}
                  onRenderCustomCut={handleRenderCustomCut}
                />
              </div>
              <div className="xl:col-span-5">
                <CopyDeckCard
                  assets={finalAssets}
                  socialPosts={socialPosts}
                  metaAds={metaAds}
                  hashtags={hashtags}
                  creatives={creatives}
                  selectedPlatforms={brief.platforms}
                  isLoading={status === "running"}
                  onExportJson={handleExportJson}
                  onExportZip={handleExportZip}
                  isExportingZip={isExportingZip}
                />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
