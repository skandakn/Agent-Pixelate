"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Palette, PenTool, Rocket, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-[#09090B] bg-studio-glow text-zinc-100">
      <div className="min-h-screen bg-obsidian-grid bg-grid-24">
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

        <div className="mx-auto flex max-w-[1680px]">
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

          {/* Main Studio Workspace */}
          <main className="min-w-0 flex-1 space-y-5 p-4 sm:p-6">
            {/* Top/Center Live Multi-Agent Collaboration Telemetry */}
            <AgentPipelineGraph
              events={events}
              currentStage={currentStage}
              status={status}
              handoff={handoff}
            />

            {/* Main Asset Bento Grid or Studio Onboarding Hero */}
            {!showWorkspaceBento ? (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216]/90 p-6 shadow-studio sm:p-10"
              >
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

                <div className="relative z-10 max-w-3xl space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/35 bg-violet-500/10 px-3 py-1 font-mono text-[11px] text-violet-200">
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                    <span>OBSIDIAN CANVAS · REAL-TIME MULTI-AGENT STUDIO</span>
                  </div>

                  <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Orchestrate synchronized campaign visuals and high-converting copy in one room.
                  </h2>

                  <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Agent Pixelate connects{" "}
                    <span className="font-mono text-violet-300">@VisualAgent</span>{" "}
                    and{" "}
                    <span className="font-mono text-cyan-300">@CopyAgent</span>{" "}
                    inside a shared BAND memory bus. Watch visual concepts, hex
                    tokens, and art direction hand off live into platform-native
                    social decks and Meta Ads.
                  </p>

                  {/* Quick-Launch Cards */}
                  <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
                    {DEMO_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleLaunch(preset.brief)}
                        className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0B0B0F]/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-[#14141C]"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: preset.accentHex }}
                            />
                            <span className="font-mono text-[10px] uppercase text-zinc-500">
                              {preset.brief.brandTone}
                            </span>
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-white">
                            {preset.label}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-400">
                            {preset.tagline}
                          </p>
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-cyan-300 transition group-hover:translate-x-0.5">
                          <span>Launch Demo</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-violet-400" />
                      3 Aspect Creatives + 15s Storyboard
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <PenTool className="h-3.5 w-3.5 text-cyan-400" />
                      Instagram, LinkedIn &amp; Meta Ads Preview
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-emerald-400" />
                      One-Click .JSON &amp; .ZIP Campaign Kit
                    </span>
                  </div>

                  <div className="pt-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setMobileDrawerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] px-4 py-2.5 text-xs font-semibold text-white shadow-violet-glow"
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      <span>Open Campaign Brief Studio</span>
                    </button>
                  </div>
                </div>
              </motion.section>
            ) : (
              /* Campaign Asset Bento Grid */
              <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
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
    </div>
  );
}
