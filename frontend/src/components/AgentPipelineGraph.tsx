"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Palette,
  PenTool,
  Radio,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import {
  AgentEvent,
  CampaignStatus,
  ContextHandoffPayload,
  NodeStatus,
  PipelineStage,
} from "@/types/campaign";
import { cn, formatTimeShort } from "@/lib/utils";

interface PipelineNodeDef {
  id: PipelineStage;
  label: string;
  sublabel: string;
  accent: "violet" | "cyan" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_NODES: PipelineNodeDef[] = [
  {
    id: "user_brief",
    label: "User Brief",
    sublabel: "Product & Tone",
    accent: "violet",
    icon: FileText,
  },
  {
    id: "band_room",
    label: "BAND Shared Room",
    sublabel: "Memory Bus",
    accent: "cyan",
    icon: Users,
  },
  {
    id: "visual_agent",
    label: "@VisualAgent",
    sublabel: "Art & Creatives",
    accent: "violet",
    icon: Palette,
  },
  {
    id: "context_handoff",
    label: "Context Handoff",
    sublabel: "Visual → Copy",
    accent: "cyan",
    icon: ArrowRightLeft,
  },
  {
    id: "copy_agent",
    label: "@CopyAgent",
    sublabel: "Posts & Meta Ads",
    accent: "cyan",
    icon: PenTool,
  },
  {
    id: "final_campaign",
    label: "Final Campaign",
    sublabel: "Export Kit",
    accent: "emerald",
    icon: Sparkles,
  },
];

const STAGE_ORDER: PipelineStage[] = PIPELINE_NODES.map((n) => n.id);

interface AgentPipelineGraphProps {
  events: AgentEvent[];
  currentStage: PipelineStage | null;
  status: CampaignStatus;
  handoff: ContextHandoffPayload | null;
}

export function AgentPipelineGraph({
  events,
  currentStage,
  status,
  handoff,
}: AgentPipelineGraphProps) {
  const [selectedStageFilter, setSelectedStageFilter] =
    useState<PipelineStage | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logExpanded) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [events.length, logExpanded]);

  const activeIndex = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;

  const getNodeStatus = (idx: number): NodeStatus => {
    if (status === "idle") return "idle";
    if (status === "completed") return "completed";
    if (activeIndex < 0) return "idle";
    if (idx < activeIndex) return "completed";
    if (idx === activeIndex) return "active";
    return "idle";
  };

  const filteredEvents = useMemo(() => {
    if (!selectedStageFilter) return events;
    return events.filter((e) => e.stage === selectedStageFilter);
  }, [events, selectedStageFilter]);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#121216]/95 shadow-studio">
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
            <Radio
              className={cn(
                "h-3.5 w-3.5 text-cyan-400",
                status === "running" && "animate-pulse"
              )}
            />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-100 sm:text-sm">
              Live Multi-Agent Collaboration Pipeline
            </h2>
            <p className="font-mono text-[11px] text-zinc-400">
              {status === "running"
                ? "Streaming real-time BAND shared-room telemetry & context handoff"
                : status === "completed"
                  ? "Pipeline synchronized · Click any node to inspect stage logs"
                  : "Awaiting brief launch · Ready to connect to BAND multi-agent bus"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedStageFilter && (
            <button
              type="button"
              onClick={() => setSelectedStageFilter(null)}
              className="rounded-md border border-violet-500/40 bg-violet-500/15 px-2.5 py-1 font-mono text-[10px] text-violet-200 transition hover:bg-violet-500/25"
            >
              Filter: {selectedStageFilter} ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setLogExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0B0B0F] px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span>Thoughts ({events.length})</span>
            {logExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Interactive 6-Node Pipeline Visualizer */}
      <div className="overflow-x-auto px-4 py-4 sm:px-5">
        <div className="flex min-w-[760px] items-center justify-between gap-1">
          {PIPELINE_NODES.map((node, index) => {
            const nodeState = getNodeStatus(index);
            const Icon = node.icon;
            const isSelected = selectedStageFilter === node.id;

            const ringColor =
              node.accent === "violet"
                ? "border-violet-500/70 bg-violet-500/15 text-violet-200 shadow-violet-glow"
                : node.accent === "cyan"
                  ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100 shadow-cyan-glow"
                  : "border-emerald-400/70 bg-emerald-500/15 text-emerald-200";

            return (
              <React.Fragment key={node.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStageFilter((prev) =>
                      prev === node.id ? null : node.id
                    )
                  }
                  className={cn(
                    "group relative flex w-[132px] shrink-0 flex-col items-center rounded-xl border px-2.5 py-3 text-center transition-all",
                    nodeState === "active"
                      ? ringColor
                      : nodeState === "completed"
                        ? "border-white/[0.14] bg-[#17171F] text-zinc-100 hover:border-white/25"
                        : "border-white/[0.06] bg-[#0C0C10] text-zinc-500 hover:border-white/15 hover:text-zinc-300",
                    isSelected && "ring-2 ring-violet-400/80 ring-offset-2 ring-offset-[#121216]"
                  )}
                >
                  {nodeState === "active" && (
                    <motion.span
                      layoutId="activePipelineHalo"
                      className="pointer-events-none absolute -inset-px rounded-xl border border-cyan-400/70"
                      animate={{ opacity: [0.45, 1, 0.45] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                  )}

                  <div className="relative mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.09] bg-black/40">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        nodeState === "active"
                          ? node.accent === "violet"
                            ? "text-violet-300"
                            : "text-cyan-300"
                          : nodeState === "completed"
                            ? "text-emerald-400"
                            : "text-zinc-500"
                      )}
                    />
                    {nodeState === "completed" && (
                      <CheckCircle2 className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-[#121216] text-emerald-400" />
                    )}
                  </div>

                  <span className="text-[11px] font-semibold leading-tight">
                    {node.label}
                  </span>
                  <span className="mt-0.5 font-mono text-[9px] text-zinc-400">
                    {node.sublabel}
                  </span>
                </button>

                {/* Animated Connector Beam */}
                {index < PIPELINE_NODES.length - 1 && (
                  <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    {getNodeStatus(index) === "completed" && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45 }}
                        className="h-full origin-left bg-gradient-to-r from-violet-500 to-cyan-400"
                      />
                    )}
                    {getNodeStatus(index) === "active" && (
                      <motion.div
                        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                        animate={{ x: ["-100%", "220%"] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Live Terminal-Style Thought Bubbles & Context Handoff Log */}
      <AnimatePresence initial={false}>
        {logExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/[0.07]"
          >
            <div className="grid grid-cols-1 divide-y divide-white/[0.07] xl:grid-cols-12 xl:divide-x xl:divide-y-0">
              {/* Terminal Stream */}
              <div className="max-h-52 overflow-y-auto bg-[#0A0A0E] p-3.5 font-mono text-xs xl:col-span-8">
                {filteredEvents.length === 0 ? (
                  <div className="flex h-28 flex-col items-center justify-center gap-1.5 text-center text-zinc-500">
                    <Terminal className="h-4 w-4 text-zinc-600" />
                    <span>
                      Launch agents from the Brief Studio to watch live thoughts &amp; handoff streams.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((evt) => {
                      const senderClass =
                        evt.sender === "@VisualAgent"
                          ? "border-violet-500/35 bg-violet-500/10 text-violet-300"
                          : evt.sender === "@CopyAgent"
                            ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-300"
                            : evt.sender === "Orchestrator"
                              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                              : "border-white/15 bg-white/[0.04] text-zinc-300";

                      return (
                        <motion.div
                          key={evt.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "rounded-lg border px-3 py-2",
                            evt.type === "handoff"
                              ? "border-cyan-500/35 bg-gradient-to-r from-violet-500/[0.09] to-cyan-500/[0.09]"
                              : "border-white/[0.06] bg-[#111116]"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-zinc-500">
                              [{formatTimeShort(evt.timestamp)}]
                            </span>
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                                senderClass
                              )}
                            >
                              {evt.sender}
                            </span>
                            <span className="font-sans text-[11px] font-semibold text-zinc-100">
                              {evt.title}
                            </span>
                          </div>
                          <p className="mt-1 leading-relaxed text-zinc-400">
                            {evt.message}
                          </p>
                        </motion.div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>

              {/* Structured Context Handoff Inspector */}
              <div className="bg-[#0D0D12] p-3.5 xl:col-span-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    <ArrowRightLeft className="h-3 w-3" />
                    BAND Context Handoff Packet
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {handoff ? "SYNCED" : "PENDING"}
                  </span>
                </div>

                {handoff ? (
                  <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#121218] p-3 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-violet-300">{handoff.fromAgent}</span>
                      <span className="text-zinc-500">─────▶</span>
                      <span className="text-cyan-300">{handoff.toAgent}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">mood: </span>
                      <span className="text-zinc-200">{handoff.dominantMood}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">motif: </span>
                      <span className="text-zinc-300">{handoff.heroMotif}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-zinc-500">tokens:</span>
                      {handoff.paletteHexes.map((hex) => (
                        <span
                          key={hex}
                          title={hex}
                          className="h-3.5 w-3.5 rounded-sm border border-white/20"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-3 text-center font-mono text-[11px] text-zinc-500">
                    Waiting for @VisualAgent to emit creative context payload for @CopyAgent...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
