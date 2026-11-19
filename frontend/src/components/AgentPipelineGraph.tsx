"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Palette,
  PenTool,
  ShieldCheck,
  Sparkles,
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
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_NODES: PipelineNodeDef[] = [
  {
    id: "user_brief",
    label: "01. Brief",
    sublabel: "Product & Tone",
    icon: FileText,
  },
  {
    id: "band_room",
    label: "02. BAND Room",
    sublabel: "Memory Mesh",
    icon: Users,
  },
  {
    id: "visual_agent",
    label: "03. @Visual",
    sublabel: "Art & Video",
    icon: Palette,
  },
  {
    id: "context_handoff",
    label: "04. Handoff",
    sublabel: "Visual ➔ Copy",
    icon: ArrowRightLeft,
  },
  {
    id: "copy_agent",
    label: "05. @Copy",
    sublabel: "Social & Ads",
    icon: PenTool,
  },
  {
    id: "final_campaign",
    label: "06. Approval",
    sublabel: "Audit & Sign-Off",
    icon: ShieldCheck,
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
    <section className="border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
      {/* Approva Ops Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#E6F7EB] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_#000000]">
            <span
              className={cn(
                "h-2.5 w-2.5 border border-black",
                status === "running"
                  ? "animate-pulse bg-[#F59E0B]"
                  : status === "completed"
                    ? "bg-[#10B981]"
                    : "bg-gray-300"
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-black uppercase tracking-tight text-black">
                EXECUTION STEPPER &amp; PROTOCOL PIPELINE
              </span>
              <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black">
                {status.toUpperCase()}
              </span>
            </div>
            <p className="font-mono text-xs text-black/70">
              {status === "running"
                ? "Live BAND multi-agent orchestration running · Auto-recording to Merkle audit chain"
                : status === "completed"
                  ? "All 6 pipeline stages verified & ready for sign-off"
                  : "Awaiting brief submission to initialize execution"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedStageFilter && (
            <button
              type="button"
              onClick={() => setSelectedStageFilter(null)}
              className="border-2 border-black bg-[#FEF3C7] px-2.5 py-1 font-mono text-[11px] font-bold text-black shadow-[2px_2px_0px_#000000]"
            >
              FILTER: {selectedStageFilter.toUpperCase()} [✕]
            </button>
          )}
          <button
            type="button"
            onClick={() => setLogExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>AUDIT TELEMETRY ({events.length})</span>
            {logExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 6-Node Horizontal Precision Brutalist Stepper */}
      <div className="overflow-x-auto bg-white p-4">
        <div className="flex min-w-[780px] items-center justify-between gap-2">
          {PIPELINE_NODES.map((node, index) => {
            const nodeState = getNodeStatus(index);
            const Icon = node.icon;
            const isSelected = selectedStageFilter === node.id;

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
                    "group relative flex w-[124px] shrink-0 flex-col items-center border-2 border-black p-3 text-center transition-all",
                    nodeState === "active"
                      ? "bg-[#FEF3C7] shadow-[3px_3px_0px_#000000] ring-2 ring-black"
                      : nodeState === "completed"
                        ? "bg-[#D1FAE5] shadow-[2px_2px_0px_#000000]"
                        : "bg-white text-black/60 shadow-[1px_1px_0px_#000000] hover:bg-gray-50",
                    isSelected && "ring-2 ring-black bg-[#E6F7EB]"
                  )}
                >
                  <div
                    className={cn(
                      "relative mb-1.5 flex h-8 w-8 items-center justify-center border-2 border-black shadow-[1px_1px_0px_#000000]",
                      nodeState === "active"
                        ? "bg-[#F59E0B] text-black"
                        : nodeState === "completed"
                          ? "bg-[#10B981] text-black"
                          : "bg-white text-black/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {nodeState === "completed" && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center border border-black bg-black text-[9px] font-black text-white">
                        ✓
                      </span>
                    )}
                  </div>

                  <span className="font-display text-xs font-black tracking-tight text-black">
                    {node.label}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] text-black/70">
                    {node.sublabel}
                  </span>
                </button>

                {/* Hard Brutalist Connector */}
                {index < PIPELINE_NODES.length - 1 && (
                  <div className="relative h-1 flex-1 border-y border-black bg-gray-200">
                    {getNodeStatus(index) === "completed" && (
                      <div className="h-full w-full bg-[#10B981]" />
                    )}
                    {getNodeStatus(index) === "active" && (
                      <motion.div
                        className="h-full w-1/2 bg-[#F59E0B]"
                        animate={{ x: ["0%", "100%", "0%"] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
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

      {/* Expandable Activity Stream & BAND Context Handoff */}
      <AnimatePresence initial={false}>
        {logExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t-2 border-black"
          >
            <div className="grid grid-cols-1 divide-y-2 divide-black xl:grid-cols-12 xl:divide-x-2 xl:divide-y-0">
              {/* Activity Feed */}
              <div className="max-h-56 overflow-y-auto bg-white p-4 xl:col-span-8">
                {filteredEvents.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center border-2 border-dashed border-black/40 bg-[#E6F7EB]/40 p-4 text-center font-mono text-xs text-black/70">
                    <span>
                      [AWAITING DISPATCH] Launch campaign to stream live agent reasoning &amp; handoff events.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((evt) => {
                      const senderBadge =
                        evt.sender === "@VisualAgent"
                          ? "bg-black text-white"
                          : evt.sender === "@CopyAgent"
                            ? "bg-[#8B5CF6] text-white"
                            : evt.sender === "@CriticAgent"
                              ? "bg-[#EF4444] text-white"
                              : evt.sender === "Orchestrator"
                                ? "bg-[#10B981] text-black"
                                : "bg-gray-200 text-black";

                      return (
                        <div
                          key={evt.id}
                          className={cn(
                            "border-2 border-black p-2.5 shadow-[2px_2px_0px_#000000]",
                            evt.type === "handoff"
                              ? "bg-[#FEF3C7]"
                              : "bg-white"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-black/60">
                              [{formatTimeShort(evt.timestamp)}]
                            </span>
                            <span
                              className={cn(
                                "border border-black px-1.5 py-0.5 font-mono text-[10px] font-black uppercase",
                                senderBadge
                              )}
                            >
                              {evt.sender}
                            </span>
                            <span className="font-display text-xs font-bold uppercase text-black">
                              {evt.title}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-xs leading-relaxed text-black/80">
                            {evt.message}
                          </p>
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>

              {/* BAND Context Handoff Inspector */}
              <div className="bg-[#E6F7EB]/60 p-4 xl:col-span-4">
                <div className="mb-2 flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-black">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    BAND Handoff Manifest
                  </span>
                  <span
                    className={cn(
                      "border border-black px-1.5 py-0.5 font-mono text-[10px] font-black uppercase",
                      handoff ? "bg-[#10B981] text-black" : "bg-gray-200 text-black/60"
                    )}
                  >
                    {handoff ? "SYNCED" : "PENDING"}
                  </span>
                </div>

                {handoff ? (
                  <div className="space-y-2 border-2 border-black bg-white p-3 font-mono text-xs shadow-[2px_2px_0px_#000000]">
                    <div className="flex items-center justify-between border-b border-black pb-1">
                      <span className="font-bold text-black">{handoff.fromAgent}</span>
                      <span className="font-bold text-black">➔</span>
                      <span className="font-bold text-[#8B5CF6]">{handoff.toAgent}</span>
                    </div>
                    <div>
                      <span className="text-black/60">MOOD: </span>
                      <span className="font-bold text-black">{handoff.dominantMood}</span>
                    </div>
                    <div>
                      <span className="text-black/60">HERO MOTIF: </span>
                      <span className="text-black">{handoff.heroMotif}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-black/60">PALETTE:</span>
                      {handoff.paletteHexes.map((hex) => (
                        <span
                          key={hex}
                          title={hex}
                          className="h-4 w-4 border border-black shadow-[1px_1px_0px_#000000]"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center border-2 border-dashed border-black/40 bg-white p-3 text-center font-mono text-xs text-black/60">
                    [AWAITING HANDOFF] Visual Art Direction will hydrate here before Copy delegation.
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
