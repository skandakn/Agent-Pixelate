"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Film,
  Layers,
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
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/TopNav";
import { CampaignBriefStudio } from "@/components/CampaignBriefStudio";
import { MinimalAgentFeed } from "@/components/MinimalAgentFeed";
import { MinimalVisualShowcase } from "@/components/MinimalVisualShowcase";
import { CopyDeckCard } from "@/components/CopyDeckCard";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WorkspaceErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("WorkspaceErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border-2 border-black bg-white p-8 text-center shadow-[4px_4px_0px_#000000]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-black bg-[#EF4444] text-white shadow-[2px_2px_0px_#000000]">
            <XCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-lg font-black uppercase text-black">
            Rendering Notice
          </h3>
          <p className="mx-auto mt-2 max-w-lg font-mono text-xs text-black/70">
            {this.state.error?.message || "An unexpected render event occurred."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              className="border-2 border-black bg-[#10B981] px-5 py-2 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000]"
            >
              Reset Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [activeTab, setActiveTab] = useState<"visuals" | "copy" | "activity">("visuals");
  const [isSendingMsg, setIsSendingMsg] = useState(false);

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
      setActiveTab("visuals");

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

  const handleSendMessage = useCallback(
    async (message: string) => {
      setIsSendingMsg(true);
      const humanEvt: AgentEvent = {
        id: `evt_human_${Date.now().toString(36)}`,
        campaignId: campaignId || "camp_manual",
        timestamp: new Date().toISOString(),
        stage: currentStage,
        sender: "You",
        type: "handoff",
        title: "Human Creative Directive",
        message,
      };
      setEvents((prev) => [...prev, humanEvt]);
      setTimeout(() => setIsSendingMsg(false), 300);
    },
    [campaignId, currentStage]
  );

  const currentAssets = finalAssets ?? partialAssets;
  const creatives = currentAssets.creatives ?? [];
  const videos = [
    ...(currentAssets.videos ?? []),
    ...extraVideos.filter(
      (ev) => !(currentAssets.videos ?? []).some((v) => v.id === ev.id)
    ),
  ];
  const palette = currentAssets.palette ?? [];
  const artDirectionSummary =
    currentAssets.artDirectionSummary ?? "Art direction pending generation.";
  const socialPosts = currentAssets.socialPosts ?? [];
  const metaAds = currentAssets.metaAds ?? [];
  const hashtags = currentAssets.hashtags ?? [];

  return (
    <div className="min-h-screen bg-[#E6F7EB] font-sans text-black">
      {/* Clean Minimalist TopNav */}
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

      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Focused Campaign Brief Panel (4 cols) */}
          <div className="lg:col-span-4">
            <CampaignBriefStudio
              brief={brief}
              status={status}
              onChangeBrief={setBrief}
              onLaunch={() => handleLaunch()}
              onCancel={handleCancel}
            />
          </div>

          {/* Right Column: Clean Studio Canvas (8 cols) */}
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <WorkspaceErrorBoundary onReset={handleCancel}>
              {/* STATE 1: IDLE WELCOME STATE */}
              {status === "idle" && !finalAssets && (
                <div className="border-2 border-black bg-white p-8 text-center shadow-[4px_4px_0px_#000000] sm:p-12">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-black bg-[#E6F7EB] text-black shadow-[2px_2px_0px_#000000]">
                    <Sparkles className="h-7 w-7 text-[#10B981]" />
                  </div>

                  <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
                    AI Creative Studio Ready
                  </h2>

                  <p className="mx-auto mt-3 max-w-xl font-mono text-xs leading-relaxed text-black/70 sm:text-sm">
                    Enter your product details on the left or select a template blueprint, then click{" "}
                    <span className="font-bold text-black">Generate Campaign</span> to synthesize high-res imagery, kinetic video cuts, and social copy.
                  </p>

                  {/* 3 Step Features */}
                  <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
                    <div className="border-2 border-black bg-[#E6F7EB]/40 p-4 shadow-[2px_2px_0px_#000000]">
                      <div className="font-mono text-[10px] font-black uppercase text-[#059669]">
                        01. VISUAL DIRECTION
                      </div>
                      <div className="mt-1 font-display text-xs font-black uppercase text-black">
                        3 Aspect Ratios
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-black/70">
                        1:1 Square, 9:16 Story, and 16:9 Landscape product photography.
                      </p>
                    </div>

                    <div className="border-2 border-black bg-[#E6F7EB]/40 p-4 shadow-[2px_2px_0px_#000000]">
                      <div className="font-mono text-[10px] font-black uppercase text-[#059669]">
                        02. KINETIC VIDEO
                      </div>
                      <div className="mt-1 font-display text-xs font-black uppercase text-black">
                        MP4 Motion Cuts
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-black/70">
                        10-second commercial promo video cuts tailored to your brand tone.
                      </p>
                    </div>

                    <div className="border-2 border-black bg-[#E6F7EB]/40 p-4 shadow-[2px_2px_0px_#000000]">
                      <div className="font-mono text-[10px] font-black uppercase text-[#059669]">
                        03. COPY DECKS
                      </div>
                      <div className="mt-1 font-display text-xs font-black uppercase text-black">
                        Multi-Platform
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-black/70">
                        High-converting hooks and post copy for Instagram, LinkedIn, and Meta Ads.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STATE 2: RUNNING / COLLABORATION FEED */}
              {(status === "running" || status === "awaiting_approval") && (
                <div className="space-y-6">
                  {/* Clean 4-Step Progress Bar */}
                  <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000000]">
                    <div className="grid grid-cols-4 gap-2 font-mono text-xs font-bold uppercase">
                      <div className="flex items-center gap-1.5 border border-black bg-[#D1FAE5] p-2 text-black">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                        <span>01. Brief</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 border border-black p-2",
                          currentStage === "visual_agent" || currentStage === "context_handoff"
                            ? "bg-[#FEF3C7] text-black font-black animate-pulse"
                            : currentStage === "copy_agent" || currentStage === "final_campaign"
                              ? "bg-[#D1FAE5] text-black"
                              : "bg-white text-black/40"
                        )}
                      >
                        <span>02. Visuals</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 border border-black p-2",
                          currentStage === "copy_agent"
                            ? "bg-[#FEF3C7] text-black font-black animate-pulse"
                            : currentStage === "final_campaign"
                              ? "bg-[#D1FAE5] text-black"
                              : "bg-white text-black/40"
                        )}
                      >
                        <span>03. Copy</span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 border border-black p-2",
                          currentStage === "final_campaign"
                            ? "bg-[#D1FAE5] text-black font-black"
                            : "bg-white text-black/40"
                        )}
                      >
                        <span>04. Complete</span>
                      </div>
                    </div>
                  </div>

                  {/* Agent Collaboration Stream */}
                  <MinimalAgentFeed
                    events={events}
                    status={status}
                    isSendingMessage={isSendingMsg}
                    onSendMessage={handleSendMessage}
                  />
                </div>
              )}

              {/* STATE 3: COMPLETED RESULTS CANVAS */}
              {status === "completed" && finalAssets && (
                <div className="space-y-6">
                  {/* Results Sub-Navigation Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000000]">
                    <div className="flex gap-1.5 font-mono text-xs font-bold uppercase">
                      <button
                        type="button"
                        onClick={() => setActiveTab("visuals")}
                        className={cn(
                          "flex items-center gap-1.5 border border-black px-4 py-2 transition",
                          activeTab === "visuals"
                            ? "bg-[#10B981] font-black text-black shadow-[2px_2px_0px_#000000]"
                            : "bg-white text-black hover:bg-gray-100"
                        )}
                      >
                        <Film className="h-3.5 w-3.5" />
                        <span>Visuals &amp; Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("copy")}
                        className={cn(
                          "flex items-center gap-1.5 border border-black px-4 py-2 transition",
                          activeTab === "copy"
                            ? "bg-[#10B981] font-black text-black shadow-[2px_2px_0px_#000000]"
                            : "bg-white text-black hover:bg-gray-100"
                        )}
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        <span>Copy Decks</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("activity")}
                        className={cn(
                          "flex items-center gap-1.5 border border-black px-4 py-2 transition",
                          activeTab === "activity"
                            ? "bg-[#10B981] font-black text-black shadow-[2px_2px_0px_#000000]"
                            : "bg-white text-black hover:bg-gray-100"
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Agent Stream ({events.length})</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
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

                  {/* Tab 1: Visuals & Video */}
                  {activeTab === "visuals" && (
                    <MinimalVisualShowcase
                      brief={brief}
                      creatives={creatives}
                      videos={videos}
                      palette={palette}
                      artDirectionSummary={artDirectionSummary}
                      isLoading={false}
                    />
                  )}

                  {/* Tab 2: Copy Decks */}
                  {activeTab === "copy" && (
                    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000]">
                      <CopyDeckCard
                        assets={finalAssets}
                        socialPosts={socialPosts}
                        metaAds={metaAds}
                        hashtags={hashtags}
                        creatives={creatives}
                        selectedPlatforms={brief?.platforms || []}
                        isLoading={false}
                        onExportJson={() => {}}
                        onExportZip={handleExportZip}
                        isExportingZip={isExportingZip}
                      />
                    </div>
                  )}

                  {/* Tab 3: Agent Stream */}
                  {activeTab === "activity" && (
                    <MinimalAgentFeed
                      events={events}
                      status={status}
                      isSendingMessage={isSendingMsg}
                      onSendMessage={handleSendMessage}
                    />
                  )}
                </div>
              )}
            </WorkspaceErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
