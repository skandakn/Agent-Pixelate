"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  AtSign,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Pin,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AgentEvent,
  BandRoomState,
  CampaignStatus,
} from "@/types/campaign";
import { cn, formatTimeShort } from "@/lib/utils";

interface BandCollaborationRoomProps {
  roomState: BandRoomState;
  events: AgentEvent[];
  status: CampaignStatus;
  isLiveBackend: boolean;
  isSendingMessage: boolean;
  isPinningMemory: boolean;
  isApproving: boolean;
  isRunningCritic: boolean;
  onSendMessage: (message: string) => void;
  onPinMemory: (key: string, content: string) => void;
  onPromoteMemory: (memoryId: string) => void;
  onApproveHandoff: (approved: boolean, note?: string) => void;
  onPatchGovernance: (patch: {
    auto_critic_qa?: boolean;
    strict_loop_guard?: boolean;
    max_agent_hops?: number;
    mute_handle?: string;
    muted?: boolean;
  }) => void;
  onRunCritic: () => void;
  onExportAudit: () => void;
}

type RoomTab = "chat" | "memory" | "executions" | "control";

const MEMORY_KEYS = [
  { id: "brand_guardrail", label: "Brand Guardrail" },
  { id: "audience_insight", label: "Audience Insight" },
  { id: "cta_requirement", label: "CTA Requirement" },
  { id: "compliance_rule", label: "Compliance Note" },
];

const QUICK_DIRECTIVES = [
  {
    label: "Warmer editorial visuals",
    text: "@visual_pixelate Refine the lighting to warmer golden editorial contrast and elevate negative space.",
  },
  {
    label: "Sharper LinkedIn hook",
    text: "@copy_pixelate Make the LinkedIn headline shorter and bolder, and tighten the primary CTA.",
  },
  {
    label: "Run Brand QA Critic",
    text: "@critic_pixelate Run a WCAG 2.1 contrast and guardrail compliance audit on the current campaign.",
  },
];

function renderHighlightedMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) =>
    part.startsWith("@") ? (
      <span
        key={idx}
        className="rounded-md bg-[#0071E3]/[0.12] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0066CC]"
      >
        {part}
      </span>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export function BandCollaborationRoom({
  roomState,
  events,
  status,
  isLiveBackend,
  isSendingMessage,
  isPinningMemory,
  isApproving,
  isRunningCritic,
  onSendMessage,
  onPinMemory,
  onPromoteMemory,
  onApproveHandoff,
  onPatchGovernance,
  onRunCritic,
  onExportAudit,
}: BandCollaborationRoomProps) {
  const [activeTab, setActiveTab] = useState<RoomTab>("chat");
  const [selectedFocusHandle, setSelectedFocusHandle] = useState<string>("@visual_pixelate");
  const [draftMessage, setDraftMessage] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [memoryKey, setMemoryKey] = useState("brand_guardrail");
  const [memoryContent, setMemoryContent] = useState("");
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pendingApproval =
    status === "awaiting_approval" || roomState.pendingApproval;

  const insertMention = (handle: string) => {
    setDraftMessage((prev) => {
      const trimmed = prev.trimStart();
      if (trimmed.toLowerCase().startsWith(handle.toLowerCase())) {
        return prev;
      }
      return `${handle} ${trimmed}`;
    });
    inputRef.current?.focus();
  };

  const handleSubmitMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftMessage.trim();
    if (!cleaned || isSendingMessage) return;
    onSendMessage(cleaned);
    setDraftMessage("");
  };

  const handleSubmitMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = memoryContent.trim();
    if (!cleaned || isPinningMemory) return;
    onPinMemory(memoryKey, cleaned);
    setMemoryContent("");
  };

  const visibleMessages = useMemo(() => events.slice(-45), [events]);

  const activeFocusWindow = useMemo(() => {
    return (
      roomState.focusWindows.find((w) => w.agentHandle === selectedFocusHandle) ??
      roomState.focusWindows[0] ??
      null
    );
  }, [roomState.focusWindows, selectedFocusHandle]);

  const hopRatioPct = Math.min(
    100,
    Math.round(
      (roomState.loopGuard.currentHops / Math.max(1, roomState.loopGuard.maxAgentHops)) * 100
    )
  );

  return (
    <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-apple">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D1D1F] text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
                BAND Shared Room &amp; Control Plane
              </h3>
              <span className="rounded-full bg-[#0071E3]/[0.1] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#0066CC]">
                band.ai
              </span>
              <span className="hidden rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-[10px] text-[#6E6E73] sm:inline-block">
                {roomState.roomId}
              </span>
              {roomState.criticReport && (
                <span className="rounded-full bg-[#248A3D]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#1D6F31]">
                  QA {roomState.criticReport.overallScore}/100 ({roomState.criticReport.grade})
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#6E6E73]">
              Heterogeneous Agentic Mesh — Per-Agent Focus, Cross-Session Memory, Loop Guard &amp; Brand QA Critic.
            </p>
          </div>
        </div>

        {/* 4-Tab Classic Apple Segmented Switcher */}
        <div className="flex flex-wrap rounded-full bg-[#F5F5F7] p-1">
          {(
            [
              { id: "chat", label: `Room (${visibleMessages.length})`, icon: MessageSquare },
              {
                id: "memory",
                label: `Memory (${roomState.memories.length + roomState.brandMemories.length})`,
                icon: Database,
              },
              {
                id: "executions",
                label: `Focus & Runs (${roomState.executions.length})`,
                icon: Cpu,
              },
              { id: "control", label: "Control Plane", icon: Shield },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                  active
                    ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live 5-Participant Agentic Mesh Roster */}
      <div className="border-b border-black/[0.06] bg-[#FBFBFD] px-6 py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {roomState.participants.map((p) => {
            const policy = roomState.policies.find((pol) => pol.handle === p.handle);
            const isMuted = Boolean(policy?.muted);
            const dotColor = isMuted
              ? "bg-[#D2D2D7]"
              : p.status === "working" || p.status === "thinking"
                ? "bg-[#0071E3] animate-pulse"
                : p.status === "awaiting_approval"
                  ? "bg-[#FF9500]"
                  : p.status === "online"
                    ? "bg-[#248A3D]"
                    : "bg-[#86868B]";

            return (
              <button
                key={p.handle}
                type="button"
                onClick={() => {
                  if (p.kind === "agent") {
                    setActiveTab("chat");
                    insertMention(p.handle);
                  }
                }}
                title={
                  p.kind === "agent"
                    ? `Click to @mention ${p.handle} in BAND room`
                    : p.role
                }
                className={cn(
                  "flex items-center justify-between gap-2 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 text-left transition",
                  p.kind === "agent" && "hover:border-[#0071E3]/40 hover:shadow-sm",
                  isMuted && "opacity-60"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />
                    <span className="truncate text-[12px] font-semibold text-[#1D1D1F]">
                      {p.displayName}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[#6E6E73]">
                    {p.handle}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-medium capitalize text-[#6E6E73]">
                  {isMuted ? "muted" : p.status.replace("_", " ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Human-in-the-Loop Approval Gate Banner */}
      {pendingApproval && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-[#0071E3]/20 bg-[#0071E3]/[0.05] px-6 py-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                  Human Approval Gate — Visual Brief Ready for Review
                </h4>
                <p className="mt-0.5 text-[12px] text-[#424245]">
                  Dual-scope BAND policy requires Human `/me` approval before @visual_pixelate can delegate to @copy_pixelate.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Optional note for @copy_pixelate…"
                className="w-56 rounded-full border border-[#D2D2D7] bg-white px-3.5 py-1.5 text-[12px] text-[#1D1D1F] placeholder-[#86868B] outline-none focus:border-[#0071E3]"
              />
              <button
                type="button"
                disabled={isApproving}
                onClick={() => {
                  onApproveHandoff(false, approvalNote || "Refine contrast and focal framing");
                  setApprovalNote("");
                }}
                className="rounded-full border border-[#D2D2D7] bg-white px-4 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7] disabled:opacity-50"
              >
                Request Revision
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={() => {
                  onApproveHandoff(true, approvalNote);
                  setApprovalNote("");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0077ED] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isApproving ? "Delegating…" : "Approve & Hand Off"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 1: Interactive BAND Room Chat & @mention Delegation */}
      {activeTab === "chat" && (
        <div className="flex flex-col">
          <div className="max-h-72 space-y-2.5 overflow-y-auto bg-[#FBFBFD] px-6 py-4">
            {visibleMessages.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-[13px] text-[#86868B]">
                <span>
                  Launch a campaign or @mention @visual_pixelate, @copy_pixelate, or @critic_pixelate below.
                </span>
              </div>
            ) : (
              visibleMessages.map((evt) => {
                const isHuman = evt.sender === "You";
                const isCritic = evt.sender === "@CriticAgent";
                return (
                  <div
                    key={evt.id}
                    className={cn("flex", isHuman ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[86%] rounded-2xl px-4 py-2.5 text-[13px]",
                        isHuman
                          ? "bg-[#0071E3] text-white"
                          : isCritic
                            ? "border border-[#248A3D]/25 bg-[#248A3D]/[0.05] text-[#1D1D1F]"
                            : "border border-black/[0.06] bg-white text-[#1D1D1F] shadow-sm"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            isHuman
                              ? "text-white/95"
                              : isCritic
                                ? "text-[#1D6F31]"
                                : "text-[#1D1D1F]"
                          )}
                        >
                          {isHuman && <User className="h-3 w-3" />}
                          {isCritic && <ShieldCheck className="h-3 w-3" />}
                          {evt.sender}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            isHuman ? "text-white/80" : "text-[#6E6E73]"
                          )}
                        >
                          · {evt.title}
                        </span>
                        <span
                          className={cn(
                            "ml-auto font-mono text-[10px]",
                            isHuman ? "text-white/70" : "text-[#86868B]"
                          )}
                        >
                          {formatTimeShort(evt.timestamp)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-1 leading-relaxed",
                          isHuman ? "text-white" : "text-[#424245]"
                        )}
                      >
                        {isHuman ? evt.message : renderHighlightedMentions(evt.message)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2.5 border-t border-black/[0.06] bg-white px-6 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#86868B]">
                <AtSign className="h-3 w-3" />
                Route:
              </span>
              {["@visual_pixelate", "@copy_pixelate", "@critic_pixelate", "@all"].map(
                (handle) => (
                  <button
                    key={handle}
                    type="button"
                    onClick={() => insertMention(handle)}
                    className="rounded-full bg-[#F5F5F7] px-2.5 py-1 font-mono text-[11px] font-medium text-[#1D1D1F] transition hover:bg-[#0071E3]/[0.1] hover:text-[#0066CC]"
                  >
                    {handle}
                  </button>
                )
              )}
              <span className="mx-1 hidden h-3 w-px bg-black/10 sm:inline-block" />
              {QUICK_DIRECTIVES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDraftMessage(q.text)}
                  className="hidden items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] text-[#6E6E73] transition hover:border-black/[0.2] hover:text-[#1D1D1F] lg:inline-flex"
                >
                  <Sparkles className="h-3 w-3 text-[#0071E3]" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmitMessage} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Delegate to @visual_pixelate, @copy_pixelate, @critic_pixelate, or @all…"
                className="flex-1 rounded-full border border-[#D2D2D7] bg-[#FBFBFD] px-4 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:bg-white focus:ring-4 focus:ring-[#0071E3]/15"
              />
              <button
                type="submit"
                disabled={!draftMessage.trim() || isSendingMessage}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#0077ED] disabled:bg-[#D2D2D7] disabled:text-[#86868B]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSendingMessage ? "Sending…" : "Send"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Room Memory + Cross-Session Brand Memory Vault */}
      {activeTab === "memory" && (
        <div className="space-y-5 bg-[#FBFBFD] p-6">
          {/* Room-Scoped Memories */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                Active Room Memories ({roomState.memories.length})
              </span>
              <span className="text-[11px] text-[#6E6E73]">
                Promote any rule to persist across all future {roomState.brandName || "brand"} rooms
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {roomState.memories.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-black/[0.1] bg-white p-6 text-center text-[13px] text-[#86868B]">
                  Pin a brand guardrail below to populate Shared BAND Memory.
                </div>
              ) : (
                roomState.memories.map((mem) => {
                  const isPromoted = Boolean(promotedIds[mem.memoryId]);
                  return (
                    <div
                      key={mem.memoryId}
                      className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {mem.pinned && <Pin className="h-3 w-3 text-[#0071E3]" />}
                            <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#1D1D1F]">
                              {mem.key}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-[#86868B]">
                            {mem.memoryId}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-[#424245]">
                          {mem.content}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5 text-[10px]">
                        <span className="font-mono text-[#86868B]">{mem.author}</span>
                        <button
                          type="button"
                          onClick={() => {
                            onPromoteMemory(mem.memoryId);
                            setPromotedIds((prev) => ({ ...prev, [mem.memoryId]: true }));
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                            isPromoted
                              ? "bg-[#248A3D]/10 text-[#1D6F31]"
                              : "bg-[#F5F5F7] text-[#0066CC] hover:bg-[#0071E3]/[0.1]"
                          )}
                        >
                          {isPromoted ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Promoted to Brand</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3 w-3" />
                              <span>Promote to Brand</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cross-Session Brand Memories */}
          {roomState.brandMemories.length > 0 && (
            <div className="space-y-2.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#248A3D]" />
                Cross-Session Brand Vault — {roomState.brandName} ({roomState.brandMemories.length})
              </span>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {roomState.brandMemories.map((bm) => (
                  <div
                    key={bm.memoryId}
                    className="rounded-2xl border border-[#0071E3]/20 bg-[#0071E3]/[0.04] p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#0066CC]">
                        brand:{bm.key}
                      </span>
                      <span className="font-mono text-[10px] text-[#6E6E73]">
                        {bm.memoryId}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#1D1D1F]">{bm.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pin New Shared Memory Form */}
          <form
            onSubmit={handleSubmitMemory}
            className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center"
          >
            <select
              value={memoryKey}
              onChange={(e) => setMemoryKey(e.target.value)}
              className="rounded-full border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2 text-[12px] font-medium text-[#1D1D1F] outline-none focus:border-[#0071E3]"
            >
              {MEMORY_KEYS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              placeholder="Pin a shared rule for all agents (e.g. 'Never use exclamation marks; highlight Swiss craft')…"
              className="flex-1 rounded-full border border-[#D2D2D7] bg-[#FBFBFD] px-4 py-2 text-[12px] text-[#1D1D1F] placeholder-[#86868B] outline-none focus:border-[#0071E3] focus:bg-white"
            />
            <button
              type="submit"
              disabled={!memoryContent.trim() || isPinningMemory}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1D1D1F] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-black disabled:opacity-40"
            >
              <Pin className="h-3.5 w-3.5" />
              <span>{isPinningMemory ? "Pinning…" : "Pin Memory"}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Per-Agent Focus Inspector & Context-Isolated Executions */}
      {activeTab === "executions" && (
        <div className="space-y-5 bg-[#FBFBFD] p-6">
          {/* Per-Agent Focus Window Projector */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#0071E3]" />
                  <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                    BAND Per-Agent Focus Isolation
                  </h4>
                </div>
                <p className="mt-0.5 text-[12px] text-[#6E6E73]">
                  Each agent receives only relevant @mentions and scoped memories—preventing context bloat across heterogeneous frameworks.
                </p>
              </div>

              <div className="flex rounded-full bg-[#F5F5F7] p-1">
                {["@visual_pixelate", "@copy_pixelate", "@critic_pixelate"].map(
                  (handle) => (
                    <button
                      key={handle}
                      type="button"
                      onClick={() => setSelectedFocusHandle(handle)}
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-[11px] font-medium transition",
                        selectedFocusHandle === handle
                          ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                          : "text-[#6E6E73] hover:text-[#1D1D1F]"
                      )}
                    >
                      {handle.replace("_pixelate", "")}
                    </button>
                  )
                )}
              </div>
            </div>

            {activeFocusWindow && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#F5F5F7] p-3.5">
                  <div className="text-[11px] font-medium text-[#86868B]">
                    Context Window Saved
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#0071E3]">
                    {activeFocusWindow.contextSavingsPct}%
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
                    <div
                      className="h-full rounded-full bg-[#0071E3]"
                      style={{ width: `${Math.min(100, activeFocusWindow.contextSavingsPct)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[#6E6E73]">
                    {activeFocusWindow.focusedTokensEst} / {activeFocusWindow.fullRoomTokensEst} est. tokens
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F5F5F7] p-3.5">
                  <div className="text-[11px] font-medium text-[#86868B]">
                    Noise Filtered Out
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#1D1D1F]">
                    {activeFocusWindow.filteredNoiseCount} turns
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-[#6E6E73]">
                    Focused on {activeFocusWindow.focusedEventCount} of{" "}
                    {activeFocusWindow.totalRoomEvents} room events.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F5F5F7] p-3.5">
                  <div className="text-[11px] font-medium text-[#86868B]">
                    Hydrated Memory Keys
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeFocusWindow.includedMemoryKeys.length > 0 ? (
                      activeFocusWindow.includedMemoryKeys.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#1D1D1F] shadow-sm"
                        >
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#86868B]">Awaiting memories</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Context-Isolated Execution Traces */}
          <div className="space-y-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F]">
              <Activity className="h-3.5 w-3.5 text-[#0071E3]" />
              Context-Isolated Task Executions ({roomState.executions.length})
            </span>

            {roomState.executions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/[0.1] bg-white p-6 text-center text-[13px] text-[#86868B]">
                Execution traces &amp; tool calls will stream here as agents run.
              </div>
            ) : (
              roomState.executions.map((ex) => (
                <div
                  key={ex.executionId}
                  className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#1D1D1F]">
                        {ex.agentHandle}
                      </span>
                      <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-medium text-[#6E6E73]">
                        {ex.framework}
                      </span>
                      <span className="font-mono text-[10px] text-[#86868B]">
                        {ex.executionId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-[#6E6E73]">{ex.durationMs}ms</span>
                      <span className="rounded-full bg-[#248A3D]/10 px-2.5 py-0.5 font-medium capitalize text-[#1D6F31]">
                        {ex.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[12px] text-[#6E6E73]">
                    Triggered by <span className="font-mono text-[#1D1D1F]">{ex.triggerBy}</span> — {ex.triggerReason}
                  </p>
                  {ex.toolCalls.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {ex.toolCalls.map((tc, i) => (
                        <div
                          key={`${ex.executionId}-tc-${i}`}
                          className="rounded-xl bg-[#F5F5F7] px-3 py-2 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono font-semibold text-[#1D1D1F]">
                              {tc.toolName}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-[#86868B]">
                              {tc.durationMs}ms
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[#6E6E73]">
                            {tc.resultSummary}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BAND Control Plane (Brand QA Scorecard, Loop Guard, Dual-Scope Governance & Audit) */}
      {activeTab === "control" && (
        <div className="space-y-5 bg-[#FBFBFD] p-6">
          {/* Top Row: Brand QA Critic Scorecard + Loop-Prevention Circuit Breaker */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* @critic_pixelate Brand QA Scorecard */}
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#248A3D]/10 text-[#1D6F31]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                      @critic_pixelate Brand QA Scorecard
                    </h4>
                    <p className="text-[11px] text-[#6E6E73]">
                      Automated WCAG 2.1 contrast, anti-cliché &amp; pinned guardrail auditor
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRunningCritic}
                  onClick={onRunCritic}
                  className="rounded-full bg-[#1D1D1F] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-black disabled:opacity-50"
                >
                  {isRunningCritic ? "Auditing…" : "Run QA Audit"}
                </button>
              </div>

              {roomState.criticReport ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F5F5F7] px-4 py-3">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl font-semibold tracking-[-0.03em] text-[#1D1D1F]">
                        {roomState.criticReport.overallScore}
                        <span className="text-sm font-normal text-[#86868B]">/100</span>
                      </span>
                      <span className="rounded-full bg-[#248A3D]/12 px-2.5 py-0.5 text-[12px] font-semibold text-[#1D6F31]">
                        Grade {roomState.criticReport.grade}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#6E6E73]">
                      Peak WCAG Contrast: {roomState.criticReport.wcagContrastRatio}:1
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {roomState.criticReport.checks.map((chk) => (
                      <div
                        key={chk.category}
                        className="flex items-start justify-between gap-3 rounded-xl border border-black/[0.05] px-3 py-2 text-[12px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-[#1D1D1F]">
                            {chk.passed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#248A3D]" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#D70015]" />
                            )}
                            <span>{chk.label}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#6E6E73]">{chk.detail}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-[#1D1D1F]">
                          {chk.score}
                        </span>
                      </div>
                    ))}
                  </div>

                  {roomState.criticReport.recommendedMention && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-[#0071E3]/[0.06] px-3.5 py-2.5">
                      <span className="text-[12px] text-[#1D1D1F]">
                        {roomState.criticReport.recommendedMention}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (roomState.criticReport?.recommendedMention) {
                            onSendMessage(roomState.criticReport.recommendedMention);
                            setActiveTab("chat");
                          }
                        }}
                        className="shrink-0 rounded-full bg-[#0071E3] px-3 py-1 text-[11px] font-medium text-white"
                      >
                        Delegate Fix
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-black/[0.1] p-6 text-center text-[12px] text-[#86868B]">
                  Complete a campaign or click &ldquo;Run QA Audit&rdquo; to score WCAG contrast &amp; guardrails.
                </div>
              )}
            </div>

            {/* Loop-Prevention Circuit Breaker & SHA-256 Audit Ledger */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm xl:col-span-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#0071E3]" />
                    <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                      Loop-Prevention Circuit Breaker
                    </h4>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      roomState.loopGuard.circuitOpen
                        ? "bg-[#D70015]/10 text-[#D70015]"
                        : "bg-[#248A3D]/10 text-[#1D6F31]"
                    )}
                  >
                    {roomState.loopGuard.circuitOpen ? "Circuit Open" : "Protected"}
                  </span>
                </div>

                <div className="rounded-2xl bg-[#F5F5F7] p-3.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#6E6E73]">Agent-to-Agent Hops</span>
                    <span className="font-mono font-semibold text-[#1D1D1F]">
                      {roomState.loopGuard.currentHops} / {roomState.loopGuard.maxAgentHops}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
                    <div
                      className="h-full rounded-full bg-[#0071E3] transition-all"
                      style={{ width: `${hopRatioPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#6E6E73]">
                    <span className="truncate">{roomState.loopGuard.lastRoute || "No hops yet"}</span>
                    <span>Blocked: {roomState.loopGuard.blockedLoops}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] px-3.5 py-2.5 text-[12px]">
                  <span className="font-medium text-[#1D1D1F]">Auto Brand QA Critic</span>
                  <button
                    type="button"
                    onClick={() =>
                      onPatchGovernance({ auto_critic_qa: !roomState.autoCriticQa })
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      roomState.autoCriticQa ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                        roomState.autoCriticQa ? "translate-x-[18px]" : "translate-x-[2px]"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Tamper-Evident Audit Ledger Export */}
              <div className="space-y-2.5 border-t border-black/[0.06] pt-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1D1D1F]">
                    <Lock className="h-3.5 w-3.5 text-[#6E6E73]" />
                    SHA-256 Compliance Audit Chain
                  </span>
                  <button
                    type="button"
                    onClick={onExportAudit}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3 py-1 text-[11px] font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export Audit</span>
                  </button>
                </div>
                <div className="truncate rounded-xl bg-[#F5F5F7] px-3 py-2 font-mono text-[10px] text-[#6E6E73]">
                  HEAD: {roomState.auditChainHead || "pending"}
                </div>
              </div>
            </div>
          </div>

          {/* Dual-Scope Role Separation & Agent Authority Matrix */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                  Dual-Scope Authority Boundaries (Human `/me` vs. Agent Runtime)
                </h4>
                <p className="text-[11px] text-[#6E6E73]">
                  Agents are cryptographically partitioned from Human `/me` actions (approvals, brand memory promotion, governance). Mute any agent live.
                </p>
              </div>
              <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 font-mono text-[10px] text-[#6E6E73]">
                {isLiveBackend ? "LIVE ENFORCED" : "SIMULATED POLICY"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-black/[0.06] text-[11px] font-medium text-[#86868B]">
                    <th className="pb-2.5 pr-3">Participant</th>
                    <th className="pb-2.5 pr-3">API Scope</th>
                    <th className="pb-2.5 pr-3">Approvals &amp; Gov</th>
                    <th className="pb-2.5 pr-3">Allowed @mentions</th>
                    <th className="pb-2.5 text-right">Room Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {roomState.policies.map((pol) => (
                    <tr key={pol.handle}>
                      <td className="py-2.5 pr-3 font-mono text-[11px] font-semibold text-[#1D1D1F]">
                        {pol.handle}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium",
                            pol.apiScope === "human_me_api"
                              ? "bg-[#0071E3]/[0.1] text-[#0066CC]"
                              : "bg-[#F5F5F7] text-[#6E6E73]"
                          )}
                        >
                          {pol.apiScope === "human_me_api" ? "Human /me" : "Agent Runtime"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[11px] text-[#6E6E73]">
                        {pol.canApproveHandoff ? (
                          <span className="font-medium text-[#1D6F31]">Permitted</span>
                        ) : (
                          <span>Blocked (403)</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[10px] text-[#6E6E73]">
                        {pol.canMention.join(", ")}
                      </td>
                      <td className="py-2.5 text-right">
                        {pol.apiScope === "human_me_api" ? (
                          <span className="text-[11px] font-medium text-[#1D6F31]">Owner</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onPatchGovernance({
                                mute_handle: pol.handle,
                                muted: !pol.muted,
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                              pol.muted
                                ? "bg-[#D70015]/10 text-[#D70015]"
                                : "bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.08]"
                            )}
                          >
                            {pol.muted ? (
                              <>
                                <VolumeX className="h-3 w-3" />
                                <span>Muted</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3 text-[#248A3D]" />
                                <span>Active</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delegation Ledger Summary */}
          {roomState.delegations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[12px] font-semibold text-[#1D1D1F]">
                Delegation Chain ({roomState.delegations.length})
              </span>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {roomState.delegations.map((edge) => (
                  <div
                    key={edge.edgeId}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-[#1D1D1F]">
                        <span>{edge.fromHandle}</span>
                        <ArrowRight className="h-3 w-3 text-[#0071E3]" />
                        <span className="text-[#0066CC]">{edge.toHandle}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[#6E6E73]">{edge.reason}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] capitalize text-[#6E6E73]">
                      {edge.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
