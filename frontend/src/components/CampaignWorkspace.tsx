"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Layers, Palette, PenTool, Users } from "lucide-react";
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

        // Seamless interactive BAND simulation when running offline / Simulated Mode
        const humanEvt: AgentEvent = {
          id: `evt_human_${Date.now().toString(36)}`,
          campaignId: cid,
          timestamp: now,
          stage: "band_room",
          sender: "You",
          type: "thought",
          title: "Human Director Message",
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
          setLocalDelegations((prev) => [
            ...prev,
            {
              edgeId: `del_vis_${Date.now().toString(36)}`,
              fromHandle: "@human_director",
              toHandle: "@visual_pixelate",
              reason: message.slice(0, 120),
              memoryId: memId,
              status: "completed",
              timestamp: now,
            },
          ]);
          setTimeout(() => {
            setEvents((prev) => [
              ...prev,
              {
                id: `evt_vrev_${Date.now().toString(36)}`,
                campaignId: cid,
                timestamp: new Date().toISOString(),
                stage: "visual_agent",
                sender: "@VisualAgent",
                type: "asset_ready",
                title: "Visual Revision Applied via BAND",
                message: `Incorporated directive (${memId}) into lighting hierarchy and updated visual brief for @copy_pixelate.`,
              },
            ]);
          }, 650);
        }

        if (mentionsCopy) {
          const memId = `mem_copy_${Math.random().toString(36).slice(2, 7)}`;
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
          setLocalDelegations((prev) => [
            ...prev,
            {
              edgeId: `del_copy_${Date.now().toString(36)}`,
              fromHandle: "@human_director",
              toHandle: "@copy_pixelate",
              reason: message.slice(0, 120),
              memoryId: memId,
              status: "completed",
              timestamp: now,
            },
          ]);
          setTimeout(() => {
            setEvents((prev) => [
              ...prev,
              {
                id: `evt_crev_${Date.now().toString(36)}`,
                campaignId: cid,
                timestamp: new Date().toISOString(),
                stage: "copy_agent",
                sender: "@CopyAgent",
                type: "asset_ready",
                title: "Copy Deck Revised via BAND Memory",
                message: `Hydrated shared BAND memory (${memId}) and sharpened headlines, hooks, and CTA pacing across all active channels.`,
              },
            ]);
          }, mentionsVisual ? 1250 : 650);
        }
      } finally {
        setIsSendingBandMsg(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom]
  );

  const handlePinBandMemory = useCallback(
    async (key: string, content: string) => {
      const cid = campaignId || "room_preview";
      setIsPinningMemory(true);
      try {
        if (isLiveBackend && campaignId) {
          await pinBandRoomMemory(campaignId, key, content);
          await refreshLiveBandRoom(campaignId);
          return;
        }
        const entry: BandSharedMemory = {
          memoryId: `mem_${Math.random().toString(36).slice(2, 8)}`,
          roomId: `room_${cid}`,
          author: "@human_director",
          key,
          content,
          pinned: true,
          bandSynced: true,
          createdAt: new Date().toISOString(),
        };
        setLocalPinnedMemories((prev) => [...prev, entry]);
        setEvents((prev) => [
          ...prev,
          {
            id: `evt_mem_${Date.now().toString(36)}`,
            campaignId: cid,
            timestamp: entry.createdAt,
            stage: "band_room",
            sender: "You",
            type: "status",
            title: `Pinned Shared BAND Memory (${key})`,
            message: `Pinned "${content}" as ${entry.memoryId}. Both @visual_pixelate and @copy_pixelate will enforce this rule.`,
          },
        ]);
      } finally {
        setIsPinningMemory(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom]
  );

  const handleApproveHandoff = useCallback(
    async (approved: boolean, note?: string) => {
      setIsApprovingHandoff(true);
      try {
        if (isLiveBackend && campaignId) {
          await approveBandHandoff(campaignId, approved, note);
          setStatus("running");
          await refreshLiveBandRoom(campaignId);
          return;
        }

        if (approved) {
          setStatus("running");
          setLocalDelegations((prev) => [
            ...prev,
            {
              edgeId: `del_app_${Date.now().toString(36)}`,
              fromHandle: "@human_director",
              toHandle: "@copy_pixelate",
              reason: note?.trim() || "Approved visual brief handoff",
              status: "completed",
              timestamp: new Date().toISOString(),
            },
          ]);
          controllerRef.current?.resumeAfterApproval?.(note?.trim() || undefined);
        } else {
          await handleSendBandMessage(
            `@visual_pixelate Revision requested before handoff: ${note?.trim() || "Refine contrast and focal hierarchy."}`
          );
        }
      } finally {
        setIsApprovingHandoff(false);
      }
    },
    [campaignId, isLiveBackend, refreshLiveBandRoom, handleSendBandMessage]
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

  const bandRoomState = useMemo<BandRoomState>(() => {
    if (liveBandRoom) return liveBandRoom;
    const base = buildDefaultBandRoomState(campaignId, brief, status, handoff);
    return {
      ...base,
      autoCriticQa: localAutoCritic,
      memories: [...base.memories, ...localPinnedMemories],
      brandMemories: [...base.brandMemories, ...localBrandMemories],
      delegations: [...base.delegations, ...localDelegations],
      policies: base.policies.map((p) => ({
        ...p,
        muted: localMutedHandles[p.handle] ?? p.muted,
      })),
    };
  }, [
    liveBandRoom,
    campaignId,
    brief,
    status,
    handoff,
    localAutoCritic,
    localPinnedMemories,
    localBrandMemories,
    localDelegations,
    localMutedHandles,
  ]);

  const handlePromoteMemory = useCallback(
    async (memoryId: string) => {
      if (isLiveBackend && campaignId) {
        await promoteBandMemoryToBrand(campaignId, memoryId);
        await refreshLiveBandRoom(campaignId);
        return;
      }
      const target = bandRoomState.memories.find((m) => m.memoryId === memoryId);
      if (!target) return;
      const promoted: BandSharedMemory = {
        ...target,
        memoryId: `bmem_${target.memoryId.slice(-6)}`,
        roomId: `brand:${brief.productName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        pinned: true,
      };
      setLocalBrandMemories((prev) =>
        prev.some((m) => m.content === promoted.content) ? prev : [...prev, promoted]
      );
    },
    [isLiveBackend, campaignId, refreshLiveBandRoom, bandRoomState.memories, brief.productName]
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
        const next = await patchBandGovernance(campaignId, patch);
        if (next) setLiveBandRoom(next);
        return;
      }
      if (typeof patch.auto_critic_qa === "boolean") {
        setLocalAutoCritic(patch.auto_critic_qa);
      }
      if (patch.mute_handle && typeof patch.muted === "boolean") {
        setLocalMutedHandles((prev) => ({
          ...prev,
          [patch.mute_handle!]: patch.muted!,
        }));
      }
    },
    [isLiveBackend, campaignId]
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
            "Brand QA passed (96/100, Grade A+) — WCAG 2.1 contrast (14.2:1), zero copy clichés, and pinned BAND guardrails verified.",
        },
      ]);
    } finally {
      setIsRunningCritic(false);
    }
  }, [isLiveBackend, campaignId, refreshLiveBandRoom]);

  const handleExportAudit = useCallback(async () => {
    await downloadBandAuditLedger(campaignId, isLiveBackend, {
      campaign_id: campaignId,
      room_id: bandRoomState.roomId,
      audit_chain_head: bandRoomState.auditChainHead,
      policies: bandRoomState.policies,
      loop_guard: bandRoomState.loopGuard,
      executions: bandRoomState.executions,
      critic_report: bandRoomState.criticReport,
      events,
    });
  }, [campaignId, isLiveBackend, bandRoomState, events]);

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
                  Agent Pixelate · Powered by BAND
                </p>

                <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.032em] text-[#1D1D1F] sm:text-5xl">
                  Two agents. One room.
                  <br />
                  Total creative control.
                </h2>

                <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#6E6E73] sm:text-[17px]">
                  Work directly alongside{" "}
                  <span className="font-medium text-[#1D1D1F]">@visual_pixelate</span>{" "}
                  and{" "}
                  <span className="font-medium text-[#1D1D1F]">@copy_pixelate</span>{" "}
                  inside a live BAND shared room—delegate via @mentions, pin shared
                  brand guardrails into memory, and approve handoffs in real time.
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
                  <Users className="h-4 w-4 text-[#1D1D1F]" />
                  Live BAND Room &amp; Shared Memory
                </span>
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
            <div className="space-y-6">
              {/* Interactive BAND Shared Collaboration Room (Chat, Memory Vault, Focus, Control Plane) */}
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

              {/* Campaign Asset Bento Grid */}
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
                    selectedPlatforms={brief.platforms}
                    isLoading={status === "running"}
                    onExportJson={handleExportJson}
                    onExportZip={handleExportZip}
                    isExportingZip={isExportingZip}
                  />
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
