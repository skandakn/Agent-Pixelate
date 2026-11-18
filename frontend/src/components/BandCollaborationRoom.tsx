"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AtSign,
  Check,
  CheckCircle2,
  Database,
  GitBranch,
  MessageSquare,
  Pin,
  Send,
  ShieldCheck,
  Sparkles,
  User,
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
  onSendMessage: (message: string) => void;
  onPinMemory: (key: string, content: string) => void;
  onApproveHandoff: (approved: boolean, note?: string) => void;
}

type RoomTab = "chat" | "memory" | "delegations";

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
    label: "Sync both agents",
    text: "@all Shift the campaign angle toward craft precision and architectural minimalism.",
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
  onSendMessage,
  onPinMemory,
  onApproveHandoff,
}: BandCollaborationRoomProps) {
  const [activeTab, setActiveTab] = useState<RoomTab>("chat");
  const [draftMessage, setDraftMessage] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [memoryKey, setMemoryKey] = useState("brand_guardrail");
  const [memoryContent, setMemoryContent] = useState("");
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

  const visibleMessages = useMemo(() => events.slice(-40), [events]);

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
                BAND Shared Collaboration Room
              </h3>
              <span className="rounded-full bg-[#0071E3]/[0.1] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#0066CC]">
                band.ai
              </span>
              <span className="hidden rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-[10px] text-[#6E6E73] sm:inline-block">
                {roomState.roomId}
              </span>
            </div>
            <p className="text-[12px] text-[#6E6E73]">
              Work directly alongside @VisualAgent &amp; @CopyAgent — delegate via @mentions, pin shared memories &amp; approve handoffs.
            </p>
          </div>
        </div>

        {/* Apple Segmented Control */}
        <div className="flex rounded-full bg-[#F5F5F7] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
              activeTab === "chat"
                ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Room ({visibleMessages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("memory")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
              activeTab === "memory"
                ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Shared Memory ({roomState.memories.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("delegations")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
              activeTab === "delegations"
                ? "bg-white text-[#1D1D1F] shadow-apple-pill"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Delegations ({roomState.delegations.length})</span>
          </button>
        </div>
      </div>

      {/* Live Participant Roster & Presence Strip */}
      <div className="border-b border-black/[0.06] bg-[#FBFBFD] px-6 py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {roomState.participants.map((p) => {
            const dotColor =
              p.status === "working" || p.status === "thinking"
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
                  p.kind === "agent" && "hover:border-[#0071E3]/40 hover:shadow-sm"
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
                    {p.handle} · {p.framework}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-medium capitalize text-[#6E6E73]">
                  {p.status.replace("_", " ")}
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
                  @visual_pixelate stored its art direction &amp; palette in Shared BAND Memory. Approve to delegate to @copy_pixelate, or request a visual revision.
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
          {/* Messages Stream */}
          <div className="max-h-72 space-y-2.5 overflow-y-auto bg-[#FBFBFD] px-6 py-4">
            {visibleMessages.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-[13px] text-[#86868B]">
                <span>
                  Launch a campaign or send a message below to collaborate with @visual_pixelate and @copy_pixelate.
                </span>
              </div>
            ) : (
              visibleMessages.map((evt) => {
                const isHuman = evt.sender === "You";
                return (
                  <div
                    key={evt.id}
                    className={cn("flex", isHuman ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px]",
                        isHuman
                          ? "bg-[#0071E3] text-white"
                          : "border border-black/[0.06] bg-white text-[#1D1D1F] shadow-sm"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            isHuman ? "text-white/95" : "text-[#1D1D1F]"
                          )}
                        >
                          {isHuman && <User className="h-3 w-3" />}
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

          {/* Quick @mention & Directive Composer */}
          <div className="space-y-2.5 border-t border-black/[0.06] bg-white px-6 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#86868B]">
                <AtSign className="h-3 w-3" />
                Delegate:
              </span>
              {["@visual_pixelate", "@copy_pixelate", "@all"].map((handle) => (
                <button
                  key={handle}
                  type="button"
                  onClick={() => insertMention(handle)}
                  className="rounded-full bg-[#F5F5F7] px-2.5 py-1 font-mono text-[11px] font-medium text-[#1D1D1F] transition hover:bg-[#0071E3]/[0.1] hover:text-[#0066CC]"
                >
                  {handle}
                </button>
              ))}
              <span className="mx-1 hidden h-3 w-px bg-black/10 sm:inline-block" />
              {QUICK_DIRECTIVES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDraftMessage(q.text)}
                  className="hidden items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] text-[#6E6E73] transition hover:border-black/[0.2] hover:text-[#1D1D1F] md:inline-flex"
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
                placeholder="Message the BAND room or @mention @visual_pixelate / @copy_pixelate to revise live…"
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

      {/* TAB 2: Shared BAND Memory Vault */}
      {activeTab === "memory" && (
        <div className="space-y-4 bg-[#FBFBFD] p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {roomState.memories.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-black/[0.1] bg-white p-6 text-center text-[13px] text-[#86868B]">
                Launch a campaign or pin a brand guardrail below to populate Shared BAND Memory.
              </div>
            ) : (
              roomState.memories.map((mem) => (
                <div
                  key={mem.memoryId}
                  className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm"
                >
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
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#86868B]">
                    <span className="font-mono">{mem.author}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#248A3D]">
                      <CheckCircle2 className="h-3 w-3" />
                      {isLiveBackend && roomState.transport === "band"
                        ? "Synced to band.ai"
                        : "Shared in Room"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

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
              placeholder="Pin a shared rule for both agents (e.g. 'Never use exclamation marks; highlight Swiss craft')…"
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

      {/* TAB 3: Live BAND Delegation Graph */}
      {activeTab === "delegations" && (
        <div className="space-y-2.5 bg-[#FBFBFD] p-6">
          {roomState.delegations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.1] bg-white p-6 text-center text-[13px] text-[#86868B]">
              Task delegations between humans, @orchestrator_pixelate, @visual_pixelate, and @copy_pixelate will appear here.
            </div>
          ) : (
            roomState.delegations.map((edge) => (
              <div
                key={edge.edgeId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-[#1D1D1F]">
                      {edge.fromHandle}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#0071E3]" />
                    <span className="font-semibold text-[#0066CC]">
                      {edge.toHandle}
                    </span>
                    {edge.memoryId && (
                      <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] text-[#6E6E73]">
                        {edge.memoryId}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-[#6E6E73]">{edge.reason}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                    edge.status === "completed"
                      ? "bg-[#248A3D]/10 text-[#1D6F31]"
                      : edge.status === "awaiting_approval"
                        ? "bg-[#FF9500]/15 text-[#B25000]"
                        : "bg-[#0071E3]/10 text-[#0066CC]"
                  )}
                >
                  {edge.status.replace("_", " ")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
