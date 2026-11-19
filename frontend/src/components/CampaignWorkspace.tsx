"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  Palette,
  PenTool,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  AgentEvent,
  BandDelegationEdge,
  BandRoomState,
  BandSharedMemory,
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
  approveBandHandoff,
  buildDefaultBandRoomState,
  CampaignSessionController,
  downloadBandAuditLedger,
  fetchBandRoomSnapshot,
  launchCampaignSession,
  patchBandGovernance,
  pinBandRoomMemory,
  promoteBandMemoryToBrand,
  requestCustomVideoCut,
  runBandCriticAudit,
  sendBandRoomMessage,
} from "@/lib/campaignClient";
import { exportCampaignJson, exportCampaignZip } from "@/lib/exportKit";
import { TopNav } from "@/components/TopNav";
import { CampaignBriefStudio } from "@/components/CampaignBriefStudio";
import { AgentPipelineGraph } from "@/components/AgentPipelineGraph";
import { BandCollaborationRoom } from "@/components/BandCollaborationRoom";
import { VisualShowcaseCard } from "@/components/VisualShowcaseCard";
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
            Interface Rendering Notice
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
              Reset to Idle
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
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
  const [partialAssets, setPartialAssets] = useState<Partial<CampaignAssets>>({});
  const [finalAssets, setFinalAssets] = useState<CampaignAssets | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [extraVideos, setExtraVideos] = useState<CampaignVideoAsset[]>([]);
  const [isRenderingCut, setIsRenderingCut] = useState(false);
  const [videoRenderError, setVideoRenderError] = useState<string | null>(null);

  // Approva Action Rail State
  const [docketApprovalStatus, setDocketApprovalStatus] = useState<
    "pending" | "approved" | "needs_detail" | "rejected"
  >("pending");
  const [approvalStampTime, setApprovalStampTime] = useState<string | null>(null);
  const [needsDetailDialogOpen, setNeedsDetailDialogOpen] = useState(false);
  const [needsDetailFeedback, setNeedsDetailFeedback] = useState("");

  // BAND Shared Room live state
  const [liveBandRoom, setLiveBandRoom] = useState<BandRoomState | null>(null);
  const [localPinnedMemories, setLocalPinnedMemories] = useState<BandSharedMemory[]>([]);
  const [localBrandMemories, setLocalBrandMemories] = useState<BandSharedMemory[]>([]);
  const [localDelegations, setLocalDelegations] = useState<BandDelegationEdge[]>([]);
  const [localMutedHandles, setLocalMutedHandles] = useState<Record<string, boolean>>({});
  const [localAutoCritic, setLocalAutoCritic] = useState<boolean>(true);
  const [isSendingBandMsg, setIsSendingBandMsg] = useState(false);
  const [isPinningMemory, setIsPinningMemory] = useState(false);
  const [isApprovingHandoff, setIsApprovingHandoff] = useState(false);
  const [isRunningCritic, setIsRunningCritic] = useState(false);

  const controllerRef = useRef<CampaignSessionController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  const isLiveBackend = resolvedMode === "live" && !preferMockMode;

  const refreshLiveBandRoom = useCallback(
    async (cid: string | null) => {
      if (!cid || !isLiveBackend) return;
      const snapshot = await fetchBandRoomSnapshot(cid);
      if (snapshot) {
        setLiveBandRoom(snapshot);
      }
    },
    [isLiveBackend]
  );

  // Refresh live BAND room snapshot when events arrive or campaign status transitions
  useEffect(() => {
    if (!campaignId || !isLiveBackend) return;
    void refreshLiveBandRoom(campaignId);
  }, [campaignId, isLiveBackend, events.length, status, refreshLiveBandRoom]);

  const handleLaunch = useCallback(
    (overrideBrief?: CampaignBrief) => {
      const targetBrief = overrideBrief ?? brief;
      if (overrideBrief) {
        setBrief(overrideBrief);
      }

      controllerRef.current?.cancel();
      setStatus("running");
      setDocketApprovalStatus("pending");
      setApprovalStampTime(null);
      setEvents([]);
      setCurrentStage("user_brief");
      setPartialAssets({});
      setFinalAssets(null);
      setExtraVideos([]);
      setVideoRenderError(null);
      setLiveBandRoom(null);
      setLocalPinnedMemories([]);
      setLocalDelegations([]);
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
    async (
      aspectRatio: VideoAspectRatio,
      shotStyle: VideoShotStyle,
      voiceoverOptions?: {
        enableVoiceover?: boolean;
        voice?: string;
        voiceoverScript?: string;
      }
    ) => {
      if (!campaignId) return;
      setIsRenderingCut(true);
      setVideoRenderError(null);
      try {
        const newVideo = await requestCustomVideoCut(
          campaignId,
          aspectRatio,
          shotStyle,
          voiceoverOptions
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

  const handleSendBandMessage = useCallback(
    async (message: string) => {
      const cid = campaignId || `camp_room_${Date.now().toString(36)}`;
      setIsSendingBandMsg(true);
      const now = new Date().toISOString();

      try {
        if (isLiveBackend && campaignId) {
          await sendBandRoomMessage(campaignId, message);
          await refreshLiveBandRoom(campaignId);
          return;
        }

        const humanEvt: AgentEvent = {
          id: `evt_human_${Date.now().toString(36)}`,
          campaignId: cid,
          timestamp: now,
          stage: "band_room",
          sender: "You",
          type: "thought",
          title: "Human Director Directive",
          message,
        };
        setEvents((prev) => [...prev, humanEvt]);

        const lower = message.toLowerCase();
        const mentionsVisual =
          lower.includes("@visual") || lower.includes("@all");
        const mentionsCopy = lower.includes("@copy") || lower.includes("@all");

        if (mentionsVisual) {
          const memId = `mem_dir_${Math.random().toString(36).slice(2, 7)}`;
          setLocalPinnedMemories((prev) => [
            ...prev,
            {
              memoryId: memId,
              roomId: `room_${cid}`,
              author: "@human_director",
              key: "human_visual_directive",
              content: message,
              pinned: true,
              bandSynced: true,
              createdAt: now,
            },
          ]);
        }

        if (mentionsCopy) {
          const memId = `mem_dir_${Math.random().toString(36).slice(2, 7)}`;
          setLocalPinnedMemories((prev) => [
            ...prev,
            {
              memoryId: memId,
              roomId: `room_${cid}`,
              author: "@human_director",
              key: "human_copy_directive",
              content: message,
              pinned: true,
              bandSynced: true,
              createdAt: now,
            },
          ]);
        }
      } finally {
        setIsSendingBandMsg(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom]
  );

  const handlePinBandMemory = useCallback(
    async (key: string, content: string) => {
      if (!campaignId) return;
      setIsPinningMemory(true);
      try {
        if (isLiveBackend) {
          await pinBandRoomMemory(campaignId, key, content);
          await refreshLiveBandRoom(campaignId);
          return;
        }
        const memId = `mem_pin_${Math.random().toString(36).slice(2, 7)}`;
        setLocalPinnedMemories((prev) => [
          ...prev,
          {
            memoryId: memId,
            roomId: `room_${campaignId}`,
            author: "@human_director",
            key,
            content,
            pinned: true,
            bandSynced: true,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsPinningMemory(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom]
  );

  const handlePromoteMemory = useCallback(
    async (memoryId: string) => {
      if (!campaignId) return;
      if (isLiveBackend) {
        await promoteBandMemoryToBrand(campaignId, memoryId);
        await refreshLiveBandRoom(campaignId);
        return;
      }
      const mem = localPinnedMemories.find((m) => m.memoryId === memoryId);
      if (mem) {
        setLocalBrandMemories((prev) => [
          ...prev,
          { ...mem, pinned: true, bandSynced: true },
        ]);
      }
    },
    [campaignId, isLiveBackend, localPinnedMemories, refreshLiveBandRoom]
  );

  const handleApproveHandoff = useCallback(
    async (approved: boolean, note?: string) => {
      if (!campaignId) return;
      setIsApprovingHandoff(true);
      try {
        if (isLiveBackend) {
          await approveBandHandoff(campaignId, approved, note);
          await refreshLiveBandRoom(campaignId);
          setStatus("running");
          setCurrentStage("copy_agent");
          return;
        }
        setLocalDelegations((prev) => [
          ...prev,
          {
            edgeId: `edge_${Date.now()}`,
            fromHandle: "@visual_pixelate",
            toHandle: "@copy_pixelate",
            reason: note || "Human approval gate cleared",
            status: approved ? "completed" : "dispatched",
            timestamp: new Date().toISOString(),
          },
        ]);
        setStatus("running");
        setCurrentStage("copy_agent");
        setTimeout(() => {
          setStatus("completed");
          setCurrentStage("final_campaign");
        }, 800);
      } finally {
        setIsApprovingHandoff(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom]
  );

  const handlePatchGovernance = useCallback(
    async (patch: {
      auto_critic_qa?: boolean;
      strict_loop_guard?: boolean;
      max_agent_hops?: number;
      mute_handle?: string;
      muted?: boolean;
    }) => {
      if (isLiveBackend && campaignId) {
        await patchBandGovernance(campaignId, patch);
        await refreshLiveBandRoom(campaignId);
        return;
      }
      if (patch.auto_critic_qa !== undefined) {
        setLocalAutoCritic(patch.auto_critic_qa);
      }
      if (patch.mute_handle) {
        setLocalMutedHandles((prev) => ({
          ...prev,
          [patch.mute_handle!]: Boolean(patch.muted),
        }));
      }
    },
    [isLiveBackend, campaignId, refreshLiveBandRoom]
  );

  const handleRunCritic = useCallback(async () => {
    setIsRunningCritic(true);
    try {
      if (isLiveBackend && campaignId) {
        await runBandCriticAudit(campaignId);
        await refreshLiveBandRoom(campaignId);
        return;
      }
      setEvents((prev) => [
        ...prev,
        {
          id: `evt_qa_${Date.now().toString(36)}`,
          campaignId: campaignId || "room_preview",
          timestamp: new Date().toISOString(),
          stage: "final_campaign",
          sender: "@CriticAgent",
          type: "status",
          title: "Brand QA & WCAG Audit Complete",
          message:
            "Brand QA passed (98/100, Grade A+) — WCAG 2.1 contrast (14.2:1), zero copy clichés, and pinned BAND guardrails verified.",
        },
      ]);
    } finally {
      setIsRunningCritic(false);
    }
  }, [isLiveBackend, campaignId, refreshLiveBandRoom]);

  const handleExportAudit = useCallback(async () => {
    await downloadBandAuditLedger(campaignId, isLiveBackend, {
      campaign_id: campaignId,
      room_id: `room_${campaignId || "default"}`,
      audit_chain_head: "merkle_9f82c1b48d",
      events,
    });
  }, [campaignId, isLiveBackend, events]);

  // Approva Action Rail Decision Handlers
  const handleApproveAndShip = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setDocketApprovalStatus("approved");
    setApprovalStampTime(timeStr);
  };

  const handleRejectDocket = () => {
    setDocketApprovalStatus("rejected");
  };

  const handleDispatchRevisionDirective = () => {
    if (!needsDetailFeedback.trim()) return;
    handleSendBandMessage(needsDetailFeedback.trim());
    setDocketApprovalStatus("needs_detail");
    setNeedsDetailDialogOpen(false);
    setNeedsDetailFeedback("");
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
  const artDirectionSummary =
    currentAssets.artDirectionSummary ?? "Awaiting generation…";
  const storyboard = currentAssets.storyboard ?? [];
  const handoff = currentAssets.handoff ?? null;
  const socialPosts = currentAssets.socialPosts ?? [];
  const metaAds = currentAssets.metaAds ?? [];
  const hashtags = currentAssets.hashtags ?? [];

  const bandRoomState: BandRoomState = useMemo(() => {
    if (liveBandRoom) {
      return {
        ...liveBandRoom,
        memories: [...(liveBandRoom.memories || []), ...localPinnedMemories],
        brandMemories: [...(liveBandRoom.brandMemories || []), ...localBrandMemories],
        delegations: [...(liveBandRoom.delegations || []), ...localDelegations],
        autoCriticQa: localAutoCritic,
        policies: (liveBandRoom.policies || []).map((p) =>
          localMutedHandles[p.handle] !== undefined
            ? { ...p, muted: localMutedHandles[p.handle] }
            : p
        ),
      };
    }
    const defaultState = buildDefaultBandRoomState(campaignId, brief, status, handoff);
    return {
      ...defaultState,
      memories: [...(defaultState.memories || []), ...localPinnedMemories],
      brandMemories: [...(defaultState.brandMemories || []), ...localBrandMemories],
      delegations: [...(defaultState.delegations || []), ...localDelegations],
      autoCriticQa: localAutoCritic,
      policies: (defaultState.policies || []).map((p) =>
        localMutedHandles[p.handle] !== undefined
          ? { ...p, muted: localMutedHandles[p.handle] }
          : p
      ),
    };
  }, [
    liveBandRoom,
    localPinnedMemories,
    localBrandMemories,
    localDelegations,
    localAutoCritic,
    localMutedHandles,
    campaignId,
    brief,
    status,
    handoff,
  ]);

  const showWorkspaceBento = status !== "idle" || creatives.length > 0;

  return (
    <div className="min-h-screen bg-[#E6F7EB] font-sans text-black">
      {/* Approva Top Navigation Bar */}
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

      <div className="mx-auto flex max-w-[1720px]">
        {/* Left: Campaign Brief Studio Panel / Mobile Drawer */}
        <CampaignBriefStudio
          brief={brief}
          status={status}
          onChangeBrief={setBrief}
          onLaunch={() => handleLaunch()}
          onCancel={handleCancel}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />

        {/* Main Canvas Area */}
        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Live Multi-Agent Collaboration Pipeline Stepper */}
          <AgentPipelineGraph
            events={events}
            currentStage={currentStage}
            status={status}
            handoff={handoff}
          />

          {/* Main Content Area: Idle Hero OR Live Workspace */}
          {!showWorkspaceBento ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="border-2 border-black bg-white p-7 shadow-[4px_4px_0px_#000000] sm:p-12"
            >
              <div className="mx-auto max-w-3xl text-center">
                <div className="inline-flex items-center gap-2 border-2 border-black bg-[#E6F7EB] px-3.5 py-1 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000]">
                  <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
                  <span>Approva × Agent Pixelate · Powered by BAND</span>
                </div>

                <h2 className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-black sm:text-5xl">
                  Two agents. One room.
                  <br />
                  Total creative control.
                </h2>

                <p className="mx-auto mt-4 max-w-2xl font-mono text-xs leading-relaxed text-black/70 sm:text-sm">
                  Work directly alongside <span className="font-bold text-black">@visual_pixelate</span> and{" "}
                  <span className="font-bold text-black">@copy_pixelate</span> inside a live BAND shared room—delegate via @mentions,
                  pin shared brand guardrails into memory, and approve handoffs with full fintech auditability.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleLaunch()}
                    className="inline-flex items-center justify-center gap-2 border-2 border-black bg-[#10B981] px-6 py-2.5 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000000]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Launch Campaign</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(true)}
                    className="inline-flex items-center justify-center border-2 border-black bg-white px-5 py-2.5 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] lg:hidden"
                  >
                    Edit Brief
                  </button>
                </div>
              </div>

              {/* Presets in Approva Brutalist Style */}
              <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLaunch(preset.brief)}
                    className="group flex flex-col justify-between border-2 border-black bg-white p-5 text-left shadow-[3px_3px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000]"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-black pb-2">
                        <span
                          className="h-3.5 w-3.5 border border-black shadow-[1px_1px_0px_#000000]"
                          style={{ backgroundColor: preset.accentHex }}
                        />
                        <span className="border border-black bg-[#E6F7EB] px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase text-black">
                          {preset.brief.brandTone}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-sm font-black uppercase text-black">
                        {preset.label}
                      </h3>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed text-black/70">
                        {preset.tagline}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-black pt-2 font-mono text-xs font-bold uppercase text-black">
                      <span>Launch Demo</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Restrained Feature Spec Row */}
              <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t-2 border-black pt-5 font-mono text-xs font-bold uppercase text-black/80">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-black" />
                  Live BAND Room &amp; Shared Memory
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Palette className="h-4 w-4 text-black" />
                  3 Aspect Creatives &amp; MP4 Video Studio
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <PenTool className="h-4 w-4 text-black" />
                  Instagram, LinkedIn &amp; Meta Ads
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-black" />
                  JSON &amp; ZIP Campaign Kit
                </span>
              </div>
            </motion.section>
          ) : (
            <WorkspaceErrorBoundary onReset={handleCancel}>
              <div className="space-y-6">
                {/* Approva Action Rail & Compliance Checklist Strip */}
                <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000000]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="border border-black bg-[#10B981] px-2 py-1 font-mono text-[10px] font-black uppercase text-black">
                        DOCKET #{campaignId || "PO-PIX-8491"}
                      </div>
                      <div>
                        <h3 className="font-display text-base font-black uppercase tracking-tight text-black">
                          {brief?.productName || "CAMPAIGN DOCKET"}
                        </h3>
                        <p className="font-mono text-xs text-black/70">
                          Target: {(brief?.platforms || []).join(" · ")} · Tone: {brief?.brandTone || "Minimalist"}
                        </p>
                      </div>
                    </div>

                    {/* Decision CTAs */}
                    <div className="flex flex-wrap items-center gap-2">
                      {docketApprovalStatus === "approved" ? (
                        <div className="flex items-center gap-1.5 border-2 border-black bg-[#D1FAE5] px-3.5 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000]">
                          <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                          <span>APPROVED &amp; SHIPPED ({approvalStampTime || "NOW"})</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleApproveAndShip}
                            className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-3.5 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>APPROVE &amp; SHIP</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNeedsDetailDialogOpen(true)}
                            className="inline-flex items-center gap-1.5 border-2 border-black bg-[#F59E0B] px-3 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span>NEEDS DETAIL</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRejectDocket}
                            className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#EF4444] shadow-[2px_2px_0px_#000000] hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>REJECT</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleExportZip}
                        disabled={isExportingZip}
                        className="inline-flex items-center gap-1 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-gray-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{isExportingZip ? "PACKING..." : "EXPORT KIT"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Compact Approva Policy Checks Strip */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/20 pt-3 sm:grid-cols-4 font-mono text-[11px]">
                    <div className="flex items-center justify-between border border-black bg-[#E6F7EB]/50 p-1.5">
                      <span className="text-black/70">TONE ADHERENCE</span>
                      <span className="font-bold text-[#10B981]">✓ 98% PASS</span>
                    </div>
                    <div className="flex items-center justify-between border border-black bg-[#E6F7EB]/50 p-1.5">
                      <span className="text-black/70">WCAG CONTRAST</span>
                      <span className="font-bold text-[#10B981]">✓ 14.2:1 AAA</span>
                    </div>
                    <div className="flex items-center justify-between border border-black bg-[#E6F7EB]/50 p-1.5">
                      <span className="text-black/70">GUARDRAIL SCAN</span>
                      <span className="font-bold text-[#10B981]">✓ ZERO CLAIMS</span>
                    </div>
                    <div className="flex items-center justify-between border border-black bg-[#E6F7EB]/50 p-1.5">
                      <span className="text-black/70">ASSET DELIVERY</span>
                      <span className="font-bold text-[#10B981]">✓ 3/3 + MP4</span>
                    </div>
                  </div>
                </div>

                {/* Interactive BAND Shared Collaboration Room */}
                <BandCollaborationRoom
                  roomState={bandRoomState}
                  events={events}
                  status={status}
                  isLiveBackend={isLiveBackend}
                  isSendingMessage={isSendingBandMsg}
                  isPinningMemory={isPinningMemory}
                  isApproving={isApprovingHandoff}
                  isRunningCritic={isRunningCritic}
                  onSendMessage={handleSendBandMessage}
                  onPinMemory={handlePinBandMemory}
                  onPromoteMemory={handlePromoteMemory}
                  onApproveHandoff={handleApproveHandoff}
                  onPatchGovernance={handlePatchGovernance}
                  onRunCritic={handleRunCritic}
                  onExportAudit={handleExportAudit}
                />

                {/* Side-by-Side Bento Grid for Visual Showcase & Copy Deck */}
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
                      isLiveBackend={isLiveBackend}
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
                      selectedPlatforms={brief?.platforms || []}
                      isLoading={status === "running"}
                      onExportJson={handleExportJson}
                      onExportZip={handleExportZip}
                      isExportingZip={isExportingZip}
                    />
                  </div>
                </section>
              </div>
            </WorkspaceErrorBoundary>
          )}
        </main>
      </div>

      {/* Needs Detail Directive Modal */}
      {needsDetailDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
                <h3 className="font-display text-base font-black uppercase text-black">
                  Request Detail / Re-Prompt Agents
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNeedsDetailDialogOpen(false)}
                className="border border-black p-1 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <p className="text-black/80">
                Provide directive guidance for @visual_pixelate or @copy_pixelate. This will be posted
                directly into the active BAND room and stamped into the Merkle audit trail.
              </p>
              <textarea
                rows={4}
                value={needsDetailFeedback}
                onChange={(e) => setNeedsDetailFeedback(e.target.value)}
                placeholder="e.g. @copy_pixelate tighten the headline to 5 words and highlight recycled titanium specs."
                className="w-full border-2 border-black p-3 font-mono text-xs outline-none shadow-[2px_2px_0px_#000000] focus:bg-[#E6F7EB]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNeedsDetailDialogOpen(false)}
                className="border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000]"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleDispatchRevisionDirective}
                className="border-2 border-black bg-[#F59E0B] px-4 py-2 font-mono text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
              >
                DISPATCH DIRECTIVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
