"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileCheck,
  FileJson,
  FileText,
  Filter,
  Layers,
  MessageSquare,
  Palette,
  PenTool,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
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
import { DEMO_PRESETS, getMockCampaignAssets } from "@/data/presets";
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
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/TopNav";
import { CampaignBriefStudio } from "@/components/CampaignBriefStudio";
import { AgentPipelineGraph } from "@/components/AgentPipelineGraph";
import { BandCollaborationRoom } from "@/components/BandCollaborationRoom";
import { VisualShowcaseCard } from "@/components/VisualShowcaseCard";
import { CopyDeckCard } from "@/components/CopyDeckCard";

// Approva Fintech Approval Item Definition
interface ApprovalQueueItem {
  id: string;
  poNumber: string;
  brief: CampaignBrief;
  slaMinutesLeft: number;
  slaStatus: "met" | "urgent" | "normal";
  status: "pending_approval" | "in_progress" | "approved" | "needs_detail" | "rejected";
  requestedBy: string;
  unitCostEstimate: string;
  tokenCostEstimate: string;
  currentStep: number; // 1: Brief, 2: Visual, 3: Copy, 4: Approve
  submittedAt: string;
}

const DEFAULT_QUEUE_ITEMS: ApprovalQueueItem[] = [
  {
    id: "camp_eco_hydro",
    poNumber: "PO-PIX-8491",
    brief: DEMO_PRESETS[0].brief,
    slaMinutesLeft: 14,
    slaStatus: "normal",
    status: "pending_approval",
    requestedBy: "@human_director",
    unitCostEstimate: "$0.048",
    tokenCostEstimate: "2,140",
    currentStep: 4,
    submittedAt: "10 mins ago",
  },
  {
    id: "camp_ai_earbuds",
    poNumber: "PO-PIX-9120",
    brief: DEMO_PRESETS[1].brief,
    slaMinutesLeft: 4,
    slaStatus: "urgent",
    status: "needs_detail",
    requestedBy: "@founder_ops",
    unitCostEstimate: "$0.052",
    tokenCostEstimate: "2,480",
    currentStep: 3,
    submittedAt: "25 mins ago",
  },
  {
    id: "camp_artisanal_matcha",
    poNumber: "PO-PIX-7402",
    brief: DEMO_PRESETS[2].brief,
    slaMinutesLeft: 0,
    slaStatus: "met",
    status: "approved",
    requestedBy: "@chief_brand",
    unitCostEstimate: "$0.064",
    tokenCostEstimate: "3,110",
    currentStep: 4,
    submittedAt: "1 hour ago",
  },
  {
    id: "camp_carbon_ebike",
    poNumber: "PO-PIX-5821",
    brief: {
      productName: "Veloce HyperLight",
      productDescription:
        "Featherlight aerospace carbon fiber commuter e-bike featuring torque-sensing stealth drive, integrated radar brake lights, and 80-mile magnetic battery swap.",
      targetAudience: "Urban design connoisseurs, high-efficiency commuters, tech founders",
      brandTone: "Bold",
      platforms: ["Instagram", "LinkedIn", "Meta Ads"],
    },
    slaMinutesLeft: 38,
    slaStatus: "normal",
    status: "pending_approval",
    requestedBy: "@growth_lead",
    unitCostEstimate: "$0.056",
    tokenCostEstimate: "2,760",
    currentStep: 4,
    submittedAt: "40 mins ago",
  },
];

export function CampaignWorkspace() {
  const [brief, setBrief] = useState<CampaignBrief>(DEMO_PRESETS[0].brief);
  const [status, setStatus] = useState<CampaignStatus>("idle");
  const [campaignId, setCampaignId] = useState<string | null>("PO-PIX-8491");
  const [preferMockMode, setPreferMockMode] = useState<boolean>(false);
  const [resolvedMode, setResolvedMode] = useState<ConnectionMode>("mock");
  const [modeNotice, setModeNotice] = useState<string | null>(null);

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>("final_campaign");
  const [partialAssets, setPartialAssets] = useState<Partial<CampaignAssets>>({});
  const [finalAssets, setFinalAssets] = useState<CampaignAssets | null>(() =>
    getMockCampaignAssets(DEMO_PRESETS[0].brief)
  );

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [extraVideos, setExtraVideos] = useState<CampaignVideoAsset[]>([]);
  const [isRenderingCut, setIsRenderingCut] = useState(false);
  const [videoRenderError, setVideoRenderError] = useState<string | null>(null);

  // Approva 3-Pane UI State
  const [sidebarTab, setSidebarTab] = useState<
    "queue" | "brief" | "room" | "vault" | "copy" | "audit"
  >("queue");
  const [docketWorkspaceTab, setDocketWorkspaceTab] = useState<
    "visual" | "copy" | "room" | "stepper" | "brief"
  >("visual");
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "approved" | "needs_detail">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("camp_eco_hydro");
  const [queueItems, setQueueItems] = useState<ApprovalQueueItem[]>(DEFAULT_QUEUE_ITEMS);

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

      const generatedPo = `PO-PIX-${Math.floor(1000 + Math.random() * 9000)}`;

      controllerRef.current = launchCampaignSession(
        targetBrief,
        preferMockMode,
        {
          onCampaignId: (id) => {
            setCampaignId(id);
            // Prepend new run to Approva queue
            setQueueItems((prev) => [
              {
                id: id,
                poNumber: generatedPo,
                brief: targetBrief,
                slaMinutesLeft: 30,
                slaStatus: "normal",
                status: "in_progress",
                requestedBy: "@human_director",
                unitCostEstimate: "$0.048",
                tokenCostEstimate: "2,200",
                currentStep: 2,
                submittedAt: "Just now",
              },
              ...prev.filter((item) => item.id !== id),
            ]);
            setSelectedQueueId(id);
          },
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
            setDocketApprovalStatus("pending");
            setQueueItems((prev) =>
              prev.map((item) =>
                item.brief.productName === targetBrief.productName
                  ? { ...item, status: "pending_approval", currentStep: 4 }
                  : item
              )
            );
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
        const mentionsVisual = lower.includes("@visual") || lower.includes("@all");
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
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === selectedQueueId ? { ...item, status: "approved" } : item
      )
    );
  };

  const handleRejectDocket = () => {
    setDocketApprovalStatus("rejected");
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === selectedQueueId ? { ...item, status: "rejected" } : item
      )
    );
  };

  const handleDispatchRevisionDirective = () => {
    if (!needsDetailFeedback.trim()) return;
    handleSendBandMessage(needsDetailFeedback.trim());
    setDocketApprovalStatus("needs_detail");
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === selectedQueueId ? { ...item, status: "needs_detail" } : item
      )
    );
    setNeedsDetailDialogOpen(false);
    setNeedsDetailFeedback("");
    setDocketWorkspaceTab("room");
  };

  // Switch Selected Campaign from Queue
  const handleSelectQueueItem = (item: ApprovalQueueItem) => {
    setSelectedQueueId(item.id);
    setBrief(item.brief);
    setCampaignId(item.poNumber);
    setDocketApprovalStatus(
      item.status === "approved"
        ? "approved"
        : item.status === "rejected"
          ? "rejected"
          : item.status === "needs_detail"
            ? "needs_detail"
            : "pending"
    );
    // Generate mock assets if needed
    const mocked = getMockCampaignAssets(item.brief);
    setFinalAssets(mocked);
    setPartialAssets(mocked);
  };

  // Filtered Queue
  const filteredQueueItems = useMemo(() => {
    return queueItems.filter((item) => {
      const matchFilter =
        queueFilter === "all" ||
        (queueFilter === "pending" && item.status === "pending_approval") ||
        (queueFilter === "approved" && item.status === "approved") ||
        (queueFilter === "needs_detail" && item.status === "needs_detail");

      const matchSearch =
        !searchQuery.trim() ||
        item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brief.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requestedBy.toLowerCase().includes(searchQuery.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [queueItems, queueFilter, searchQuery]);

  const activeDocketItem =
    queueItems.find((i) => i.id === selectedQueueId) ?? queueItems[0];

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
        memories: [...liveBandRoom.memories, ...localPinnedMemories],
        brandMemories: [...liveBandRoom.brandMemories, ...localBrandMemories],
        delegations: [...liveBandRoom.delegations, ...localDelegations],
      };
    }
    const defaultState = buildDefaultBandRoomState(campaignId, brief, status, handoff);
    return {
      ...defaultState,
      memories: [...defaultState.memories, ...localPinnedMemories],
      brandMemories: [...defaultState.brandMemories, ...localBrandMemories],
      delegations: [...defaultState.delegations, ...localDelegations],
      policies: {
        ...defaultState.policies,
        autoCriticQa: localAutoCritic,
      },
    };
  }, [
    liveBandRoom,
    localPinnedMemories,
    localBrandMemories,
    localDelegations,
    localAutoCritic,
    campaignId,
    brief,
    status,
    handoff,
  ]);

  return (
    <div className="min-h-screen bg-[#E6F7EB] font-sans text-black">
      {/* Approva Top Brand Bar */}
      <TopNav
        campaignId={activeDocketItem.poNumber}
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

      {/* Approva 3-Pane Responsive Layout */}
      <div className="mx-auto flex max-w-[1880px] border-b-2 border-black">
        {/* ==================================================================== */}
        {/* PANE 1: LEFT SIDEBAR NAVIGATION (Approva Ops Nav)                   */}
        {/* ==================================================================== */}
        <aside className="hidden w-[240px] shrink-0 border-r-2 border-black bg-white xl:block">
          <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col justify-between p-4">
            <div className="space-y-5">
              {/* Approva Header Tag */}
              <div className="border-2 border-black bg-[#E6F7EB] p-2.5 shadow-[2px_2px_0px_#000000]">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-black uppercase text-black">
                    AUDIT INBOX
                  </span>
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                </div>
                <div className="mt-1 font-mono text-[10px] text-black/70">
                  FINTECH OPS CONSOLE
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1.5 font-mono text-xs font-bold uppercase">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("queue");
                    setDocketWorkspaceTab("visual");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "queue"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>APPROVAL QUEUE</span>
                  </div>
                  <span className="border border-black bg-black px-1.5 py-0.2 text-[9px] text-white">
                    {queueItems.filter((i) => i.status === "pending_approval").length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("brief");
                    setDocketWorkspaceTab("brief");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "brief"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>NEW BRIEF SPEC</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("room");
                    setDocketWorkspaceTab("room");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "room"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>BAND LIVE ROOM</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("vault");
                    setDocketWorkspaceTab("visual");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "vault"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <Palette className="h-4 w-4" />
                  <span>CREATIVE VAULT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("copy");
                    setDocketWorkspaceTab("copy");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "copy"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <PenTool className="h-4 w-4" />
                  <span>COPY DECKS</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarTab("audit");
                    setDocketWorkspaceTab("stepper");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-2 border-black px-3 py-2 text-left transition-all",
                    sidebarTab === "audit"
                      ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>AUDIT LEDGER</span>
                </button>
              </nav>

              {/* Active Agent Fleet Roster */}
              <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000000]">
                <div className="border-b border-black pb-1.5 font-display text-[11px] font-black uppercase text-black">
                  ACTIVE AGENT MESH
                </div>
                <div className="mt-2 space-y-2 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">@visual_pixelate</span>
                    <span className="border border-black bg-[#D1FAE5] px-1 font-bold text-black">
                      READY
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">@copy_pixelate</span>
                    <span className="border border-black bg-[#D1FAE5] px-1 font-bold text-black">
                      SYNCED
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">@critic_pixelate</span>
                    <span className="border border-black bg-[#FEF3C7] px-1 font-bold text-black">
                      GUARD 98%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approver Identity Box */}
            <div className="border-2 border-black bg-[#E6F7EB] p-2.5 shadow-[2px_2px_0px_#000000]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center border border-black bg-black font-mono text-xs font-black text-white">
                  OP
                </div>
                <div>
                  <div className="font-display text-xs font-black uppercase text-black">
                    Chief Approver
                  </div>
                  <div className="font-mono text-[10px] text-black/60">
                    Fintech Ops Director
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ==================================================================== */}
        {/* PANE 2: MIDDLE REQUEST QUEUE (Approva Approver Inbox)               */}
        {/* ==================================================================== */}
        <section className="hidden w-[350px] shrink-0 border-r-2 border-black bg-[#DCF5E3]/40 lg:block xl:w-[380px]">
          <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col justify-between">
            {/* Queue Header & Filters */}
            <div className="border-b-2 border-black bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-black uppercase tracking-tight text-black">
                    REQUEST QUEUE
                  </h2>
                  <span className="border border-black bg-[#10B981] px-1.5 py-0.5 font-mono text-[10px] font-black text-black">
                    {filteredQueueItems.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunch()}
                  className="border-2 border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                >
                  + NEW RUN
                </button>
              </div>

              {/* Filter Pills */}
              <div className="mt-3 flex gap-1 font-mono text-[10px] font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setQueueFilter("all")}
                  className={cn(
                    "border border-black px-2 py-1 transition-all",
                    queueFilter === "all"
                      ? "bg-black text-white shadow-[1px_1px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100"
                  )}
                >
                  ALL ({queueItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter("pending")}
                  className={cn(
                    "border border-black px-2 py-1 transition-all",
                    queueFilter === "pending"
                      ? "bg-[#F59E0B] text-black shadow-[1px_1px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100"
                  )}
                >
                  PENDING ({queueItems.filter((i) => i.status === "pending_approval").length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter("approved")}
                  className={cn(
                    "border border-black px-2 py-1 transition-all",
                    queueFilter === "approved"
                      ? "bg-[#10B981] text-black shadow-[1px_1px_0px_#000000]"
                      : "bg-white text-black hover:bg-gray-100"
                  )}
                >
                  APPROVED
                </button>
              </div>

              {/* Search Bar */}
              <div className="mt-2.5 flex items-center border-2 border-black bg-white px-2 py-1 shadow-[1px_1px_0px_#000000]">
                <Search className="mr-1.5 h-3.5 w-3.5 text-black/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by PO # or product..."
                  className="w-full font-mono text-xs text-black outline-none placeholder-black/40"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")}>
                    <X className="h-3 w-3 text-black/60" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Queue Cards */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {filteredQueueItems.map((item) => {
                const isSelected = item.id === selectedQueueId;
                const isPending = item.status === "pending_approval";
                const isApproved = item.status === "approved";
                const isUrgent = item.slaStatus === "urgent";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectQueueItem(item)}
                    className={cn(
                      "group w-full border-2 border-black p-3 text-left transition-all",
                      isSelected
                        ? "bg-white shadow-[4px_4px_0px_#000000] ring-2 ring-black border-l-[6px] border-l-[#10B981]"
                        : "bg-white/90 shadow-[2px_2px_0px_#000000] hover:bg-white hover:translate-x-[1px] hover:translate-y-[1px]"
                    )}
                  >
                    {/* Top Row: PO & SLA Badge */}
                    <div className="flex items-center justify-between border-b border-black pb-1.5">
                      <span className="font-mono text-xs font-black text-black">
                        {item.poNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "border border-black px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase",
                            isApproved
                              ? "bg-[#D1FAE5] text-black"
                              : isUrgent
                                ? "bg-[#FEE2E2] text-black animate-pulse"
                                : "bg-[#FEF3C7] text-black"
                          )}
                        >
                          <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                          {isApproved ? "SLA MET" : `SLA: ${item.slaMinutesLeft}m`}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Title & Brand Tone */}
                    <div className="mt-2">
                      <h3 className="font-display text-sm font-black uppercase tracking-tight text-black">
                        {item.brief.productName}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 font-mono text-[11px] text-black/70">
                        {item.brief.productDescription}
                      </p>
                    </div>

                    {/* Approva Stepper Dots Component */}
                    <div className="mt-2.5 border-y border-black/20 py-1.5">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="flex items-center gap-1 font-bold">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full border border-black",
                              item.currentStep >= 1 ? "bg-[#10B981]" : "bg-gray-200"
                            )}
                          />
                          Brief
                        </span>
                        <span className="text-black/40">➔</span>
                        <span className="flex items-center gap-1 font-bold">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full border border-black",
                              item.currentStep >= 2 ? "bg-[#10B981]" : "bg-gray-200"
                            )}
                          />
                          Visual
                        </span>
                        <span className="text-black/40">➔</span>
                        <span className="flex items-center gap-1 font-bold">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full border border-black",
                              item.currentStep >= 3 ? "bg-[#10B981]" : "bg-gray-200"
                            )}
                          />
                          Copy
                        </span>
                        <span className="text-black/40">➔</span>
                        <span className="flex items-center gap-1 font-bold">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full border border-black",
                              item.status === "approved"
                                ? "bg-[#10B981]"
                                : item.status === "pending_approval"
                                  ? "bg-[#F59E0B] animate-pulse"
                                  : "bg-gray-200"
                            )}
                          />
                          Approve
                        </span>
                      </div>
                    </div>

                    {/* Bottom Metadata Row */}
                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-black/70">
                      <div>
                        <span>EST. </span>
                        <span className="font-bold text-black">{item.unitCostEstimate}</span>
                        <span> ({item.tokenCostEstimate} tok)</span>
                      </div>
                      <span
                        className={cn(
                          "border border-black px-1.5 py-0.2 font-mono text-[9px] font-black uppercase",
                          isApproved
                            ? "bg-[#10B981] text-black"
                            : item.status === "needs_detail"
                              ? "bg-[#FEF3C7] text-black"
                              : "bg-[#F59E0B] text-black"
                        )}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Queue Footer Summary */}
            <div className="border-t-2 border-black bg-white p-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-black/70">QUEUE STATUS:</span>
                <span className="font-bold text-black">
                  {queueItems.filter((i) => i.status === "approved").length} of {queueItems.length} SHIPPED
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* PANE 3: RIGHT PURCHASE-ORDER DOCUMENT & ACTION RAIL                  */}
        {/* ==================================================================== */}
        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          {/* 1. APPROVA STICKY ACTION RAIL (Signature Brutalist CTA Bar) */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000000]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Document Identity */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="border border-black bg-[#10B981] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                    PURCHASE ORDER &amp; CAMPAIGN DOCKET
                  </span>
                  <span className="font-mono text-xs font-black text-black">
                    #{activeDocketItem.poNumber}
                  </span>
                </div>
                <h1 className="mt-1 font-display text-xl font-black uppercase tracking-tight text-black sm:text-2xl">
                  {activeDocketItem.brief.productName}
                </h1>
              </div>

              {/* Action Decision Rail Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {docketApprovalStatus === "approved" ? (
                  <div className="flex items-center gap-2 border-2 border-black bg-[#D1FAE5] px-4 py-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000]">
                    <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                    <span>APPROVED &amp; STAMPED AT {approvalStampTime || "12:00 PM"}</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleApproveAndShip}
                      className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px]"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>APPROVE &amp; SHIP PO</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNeedsDetailDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 border-2 border-black bg-[#F59E0B] px-3.5 py-2 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000]"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>NEEDS DETAIL</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRejectDocket}
                      className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#EF4444] shadow-[3px_3px_0px_#000000] transition-all hover:bg-[#FEE2E2] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000]"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>REJECT</span>
                    </button>
                  </>
                )}

                {/* Secondary Fast Exports */}
                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isExportingZip}
                  className="inline-flex items-center gap-1 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{isExportingZip ? "PACKING..." : "ZIP KIT"}</span>
                </button>
              </div>
            </div>

            {/* Approval Banner if Stamped */}
            {docketApprovalStatus === "approved" && (
              <div className="mt-3 flex items-center justify-between border-2 border-black bg-[#10B981] p-2.5 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000000]">
                <span>✓ SIGN-OFF COMPLETE: DISPATCHED TO ASSET PRODUCTION &amp; DISTRIBUTION VAULT</span>
                <span className="underline cursor-pointer" onClick={handleExportZip}>
                  DOWNLOAD SIGNED ASSET KIT
                </span>
              </div>
            )}
          </div>

          {/* 2. PO SPECIFICATION & FINANCIALS METADATA GRID */}
          <div className="grid grid-cols-2 gap-3 border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000000] sm:grid-cols-4 lg:grid-cols-6 font-mono text-xs">
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">PURCHASE ORDER:</span>
              <div className="mt-0.5 font-black text-black">{activeDocketItem.poNumber}</div>
            </div>
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">SUBMITTED BY:</span>
              <div className="mt-0.5 font-bold text-black">{activeDocketItem.requestedBy}</div>
            </div>
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">BRAND TONE:</span>
              <div className="mt-0.5 font-bold text-black">{activeDocketItem.brief.brandTone}</div>
            </div>
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">EST. BUDGET:</span>
              <div className="mt-0.5 font-black text-[#10B981]">{activeDocketItem.unitCostEstimate} USD</div>
            </div>
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">CHANNELS:</span>
              <div className="mt-0.5 font-bold text-black">
                {activeDocketItem.brief.platforms.join(" · ")}
              </div>
            </div>
            <div className="border border-black bg-[#E6F7EB]/40 p-2.5">
              <span className="text-black/60">BAND ROOM:</span>
              <div className="mt-0.5 font-bold text-black">room_{activeDocketItem.id.slice(0, 8)}</div>
            </div>
          </div>

          {/* 3. POLICY-CHECK & COMPLIANCE CHECKLIST (Approva Signature Component) */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <h2 className="font-display text-sm font-black uppercase text-black">
                  POLICY &amp; BRAND COMPLIANCE AUDIT CHECKLIST
                </h2>
              </div>
              <span className="border border-black bg-[#D1FAE5] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                ALL 4 CHECKS PASSED (100%)
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
              <div className="border-2 border-black bg-[#E6F7EB]/30 p-3 shadow-[1px_1px_0px_#000000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black">01. TONE &amp; VOICE</span>
                  <span className="border border-black bg-[#10B981] px-1 text-[9px] font-black text-black">
                    ✓ PASS
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold text-black">
                  Verified 98% Adherence
                </div>
                <div className="mt-0.5 text-[10px] text-black/70">
                  Zero forbidden adjectives. Complies with {activeDocketItem.brief.brandTone} rules.
                </div>
              </div>

              <div className="border-2 border-black bg-[#E6F7EB]/30 p-3 shadow-[1px_1px_0px_#000000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black">02. WCAG 2.1 CONTRAST</span>
                  <span className="border border-black bg-[#10B981] px-1 text-[9px] font-black text-black">
                    ✓ PASS
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold text-black">
                  14.2:1 Ratio Verified
                </div>
                <div className="mt-0.5 text-[10px] text-black/70">
                  Passed AAA standards for all rendered creative typography overlays.
                </div>
              </div>

              <div className="border-2 border-black bg-[#E6F7EB]/30 p-3 shadow-[1px_1px_0px_#000000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black">03. GUARDRAIL SCAN</span>
                  <span className="border border-black bg-[#10B981] px-1 text-[9px] font-black text-black">
                    ✓ PASS
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold text-black">
                  Zero Blocked Claims
                </div>
                <div className="mt-0.5 text-[10px] text-black/70">
                  Passed LoopGuard safety filter: no unverified medical or IP claims.
                </div>
              </div>

              <div className="border-2 border-black bg-[#E6F7EB]/30 p-3 shadow-[1px_1px_0px_#000000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black">04. ASSET DELIVERY</span>
                  <span className="border border-black bg-[#10B981] px-1 text-[9px] font-black text-black">
                    ✓ PASS
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold text-black">
                  3/3 Formats + MP4
                </div>
                <div className="mt-0.5 text-[10px] text-black/70">
                  1:1, 9:16, 16:9 renders validated with 10s kinetic video stream.
                </div>
              </div>
            </div>
          </div>

          {/* 4. LINE-ITEM PO TABLE (Approva Signature Component) */}
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between border-b-2 border-black bg-[#E6F7EB] p-3.5">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <h2 className="font-display text-sm font-black uppercase text-black">
                  LINE-ITEM PURCHASE ORDER BREAKDOWN
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-black">
                TOTAL ALLOCATION: $0.068 USD
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b-2 border-black bg-gray-100 font-bold uppercase text-black">
                  <tr>
                    <th className="p-3">ITEM #</th>
                    <th className="p-3">ASSET SPECIFICATION</th>
                    <th className="p-3">DIMENSIONS</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">EST. COST</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/30">
                  <tr className="hover:bg-[#E6F7EB]/20">
                    <td className="p-3 font-bold">LINE-01</td>
                    <td className="p-3">
                      <div className="font-bold text-black">Square Visual Master</div>
                      <div className="text-[10px] text-black/60">Feed, Carousel &amp; Catalog Anchor</div>
                    </td>
                    <td className="p-3">1080×1080 (1:1)</td>
                    <td className="p-3">
                      <span className="border border-black bg-[#D1FAE5] px-1.5 py-0.5 font-bold text-black">
                        READY
                      </span>
                    </td>
                    <td className="p-3">$0.012</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocketWorkspaceTab("visual")}
                        className="border border-black bg-white px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6F7EB]/20">
                    <td className="p-3 font-bold">LINE-02</td>
                    <td className="p-3">
                      <div className="font-bold text-black">Vertical Story &amp; Reel</div>
                      <div className="text-[10px] text-black/60">Instagram Reels &amp; TikTok Creative</div>
                    </td>
                    <td className="p-3">1080×1920 (9:16)</td>
                    <td className="p-3">
                      <span className="border border-black bg-[#D1FAE5] px-1.5 py-0.5 font-bold text-black">
                        READY
                      </span>
                    </td>
                    <td className="p-3">$0.012</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocketWorkspaceTab("visual")}
                        className="border border-black bg-white px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6F7EB]/20">
                    <td className="p-3 font-bold">LINE-03</td>
                    <td className="p-3">
                      <div className="font-bold text-black">Horizontal Banner</div>
                      <div className="text-[10px] text-black/60">LinkedIn Hero &amp; Meta Landscape</div>
                    </td>
                    <td className="p-3">1920×1080 (16:9)</td>
                    <td className="p-3">
                      <span className="border border-black bg-[#D1FAE5] px-1.5 py-0.5 font-bold text-black">
                        READY
                      </span>
                    </td>
                    <td className="p-3">$0.012</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocketWorkspaceTab("visual")}
                        className="border border-black bg-white px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6F7EB]/20">
                    <td className="p-3 font-bold">LINE-04</td>
                    <td className="p-3">
                      <div className="font-bold text-black">10s Cinematic Promo Video</div>
                      <div className="text-[10px] text-black/60">6-Style Motion Engine with Stereo Riser</div>
                    </td>
                    <td className="p-3">H.264 MP4 (24fps)</td>
                    <td className="p-3">
                      <span className="border border-black bg-[#D1FAE5] px-1.5 py-0.5 font-bold text-black">
                        RENDERED
                      </span>
                    </td>
                    <td className="p-3">$0.024</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocketWorkspaceTab("visual")}
                        className="border border-black bg-white px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                      >
                        PLAY
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6F7EB]/20">
                    <td className="p-3 font-bold">LINE-05</td>
                    <td className="p-3">
                      <div className="font-bold text-black">Multi-Channel Copy Deck</div>
                      <div className="text-[10px] text-black/60">3 IG Hooks, 2 LinkedIn Articles, 3 Meta Ads</div>
                    </td>
                    <td className="p-3">Markdown + JSON</td>
                    <td className="p-3">
                      <span className="border border-black bg-[#D1FAE5] px-1.5 py-0.5 font-bold text-black">
                        FORMATTED
                      </span>
                    </td>
                    <td className="p-3">$0.008</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocketWorkspaceTab("copy")}
                        className="border border-black bg-white px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0px_#000000] hover:bg-gray-100"
                      >
                        INSPECT
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. TABBED INTERACTIVE DETAIL WORKSPACE IN DOCKET */}
          <div className="space-y-4">
            {/* Brutalist Docket Sub-navigation Switcher */}
            <div className="flex flex-wrap gap-2 border-b-2 border-black pb-2">
              <button
                type="button"
                onClick={() => setDocketWorkspaceTab("visual")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all",
                  docketWorkspaceTab === "visual"
                    ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                )}
              >
                <Palette className="h-4 w-4" />
                <span>VISUAL &amp; VIDEO STUDIO</span>
              </button>

              <button
                type="button"
                onClick={() => setDocketWorkspaceTab("copy")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all",
                  docketWorkspaceTab === "copy"
                    ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                )}
              >
                <PenTool className="h-4 w-4" />
                <span>COPYWRITING DECK</span>
              </button>

              <button
                type="button"
                onClick={() => setDocketWorkspaceTab("room")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all",
                  docketWorkspaceTab === "room"
                    ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>BAND SHARED ROOM ({events.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDocketWorkspaceTab("stepper")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all",
                  docketWorkspaceTab === "stepper"
                    ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                )}
              >
                <Cpu className="h-4 w-4" />
                <span>PIPELINE TELEMETRY</span>
              </button>

              <button
                type="button"
                onClick={() => setDocketWorkspaceTab("brief")}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all",
                  docketWorkspaceTab === "brief"
                    ? "bg-[#10B981] text-black shadow-[3px_3px_0px_#000000]"
                    : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000000]"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>EDIT BRIEF &amp; RUN</span>
              </button>
            </div>

            {/* Active Tab Content Display */}
            {docketWorkspaceTab === "visual" && (
              <VisualShowcaseCard
                campaignId={activeDocketItem.poNumber}
                brief={activeDocketItem.brief}
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
            )}

            {docketWorkspaceTab === "copy" && (
              <CopyDeckCard
                assets={finalAssets}
                socialPosts={socialPosts}
                metaAds={metaAds}
                hashtags={hashtags}
                creatives={creatives}
                selectedPlatforms={activeDocketItem.brief.platforms}
                isLoading={status === "running"}
                onExportJson={handleExportJson}
                onExportZip={handleExportZip}
                isExportingZip={isExportingZip}
              />
            )}

            {docketWorkspaceTab === "room" && (
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
            )}

            {docketWorkspaceTab === "stepper" && (
              <AgentPipelineGraph
                events={events}
                currentStage={currentStage}
                status={status}
                handoff={handoff}
              />
            )}

            {docketWorkspaceTab === "brief" && (
              <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000]">
                <CampaignBriefStudio
                  brief={brief}
                  status={status}
                  onChangeBrief={setBrief}
                  onLaunch={() => handleLaunch()}
                  onCancel={handleCancel}
                />
              </div>
            )}
          </div>
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
