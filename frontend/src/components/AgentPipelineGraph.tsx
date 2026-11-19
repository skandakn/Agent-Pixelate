"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Palette,
  PenTool,
  ShieldCheck,
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
    label: "Brief",
    sublabel: "Setup",
    icon: FileText,
  },
  {
    id: "band_room",
    label: "Room",
    sublabel: "BAND Mesh",
    icon: Users,
  },
  {
    id: "visual_agent",
    label: "Visual",
    sublabel: "Direction",
    icon: Palette,
  },
  {
    id: "context_handoff",
    label: "Handoff",
    sublabel: "Sync",
    icon: ArrowRightLeft,
  },
  {
    id: "copy_agent",
    label: "Copy",
    sublabel: "Deck",
    icon: PenTool,
  },
  {
    id: "final_campaign",
    label: "Ready",
    sublabel: "Review",
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
  // Keep logs collapsed by default for a clean, minimalist experience
  const [logExpanded, setLogExpanded] = useState(false);
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
    <section className="rounded-2xl border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      {/* Sleek Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] bg-[#FBFBFD] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "running"
                ? "animate-pulse bg-amber-500"
                : status === "completed"
                  ? "bg-emerald-500"
                  : "bg-neutral-300"
            )}
          />
          <span className="text-xs font-semibold text-[#1D1D1F]">
            Pipeline
          </span>
          <span className="text-xs text-neutral-400">
            {status === "running"
              ? "Executing stages..."
              : status === "completed"
                ? "All stages complete"
                : "Ready to launch"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedStageFilter && (
            <button
              type="button"
              onClick={() => setSelectedStageFilter(null)}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200"
            >
              Filter: {selectedStageFilter} ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setLogExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 shadow-sm"
          >
            <Activity className="h-3 w-3 text-neutral-400" />
            <span>Telemetry ({events.length})</span>
            {logExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
            )}
          </button>
        </div>
      </div>

      {/* 6-Node Horizontal Stepper */}
      <div className="overflow-x-auto bg-white p-4">
        <div className="flex min-w-[680px] items-center justify-between gap-2">
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
                    "group relative flex w-[100px] shrink-0 flex-col items-center rounded-xl border p-2.5 text-center transition-all",
                    nodeState === "active"
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                      : nodeState === "completed"
                        ? "border-emerald-200/80 bg-emerald-50/50 text-neutral-900"
                        : "border-black/[0.06] bg-[#FBFBFD] text-neutral-500 hover:bg-neutral-100/70",
                    isSelected && "ring-2 ring-neutral-400"
                  )}
                >
                  <div
                    className={cn(
                      "relative mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-xs",
                      nodeState === "active"
                        ? "bg-white/20 text-white"
                        : nodeState === "completed"
                          ? "bg-emerald-500 text-white"
                          : "bg-neutral-200/60 text-neutral-500"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <span className="text-xs font-semibold tracking-tight">
                    {node.label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      nodeState === "active" ? "text-neutral-300" : "text-neutral-400"
                    )}
                  >
                    {node.sublabel}
                  </span>
                </button>

                {/* Minimal Connector Line */}
                {index < PIPELINE_NODES.length - 1 && (
                  <div className="relative h-0.5 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                    {getNodeStatus(index) === "completed" && (
                      <div className="h-full w-full bg-emerald-500" />
                    )}
                    {getNodeStatus(index) === "active" && (
                      <motion.div
                        className="h-full w-1/2 bg-neutral-900"
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

      {/* Expandable Activity Stream & Context Handoff */}
      <AnimatePresence initial={false}>
        {logExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-black/[0.06]"
          >
            <div className="grid grid-cols-1 divide-y divide-black/[0.06] xl:grid-cols-12 xl:divide-x xl:divide-y-0">
              {/* Activity Feed */}
              <div className="max-h-56 overflow-y-auto bg-white p-4 xl:col-span-8">
                {filteredEvents.length === 0 ? (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400">
                    No active events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={cn(
                          "rounded-xl border p-2.5 transition",
                          evt.type === "handoff"
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-black/[0.05] bg-[#FBFBFD]"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-neutral-400">
                            {formatTimeShort(evt.timestamp)}
                          </span>
                          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                            {evt.sender}
                          </span>
                          <span className="text-xs font-semibold text-[#1D1D1F]">
                            {evt.title}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                          {evt.message}
                        </p>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>

              {/* Handoff Manifest */}
              <div className="bg-[#FBFBFD] p-4 xl:col-span-4">
                <div className="mb-2 flex items-center justify-between border-b border-black/[0.06] pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                    <ArrowRightLeft className="h-3 w-3 text-neutral-400" />
                    Handoff State
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      handoff ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {handoff ? "Synced" : "Pending"}
                  </span>
                </div>

                {handoff ? (
                  <div className="space-y-2 rounded-xl border border-black/[0.06] bg-white p-3 text-xs">
                    <div className="flex items-center justify-between border-b border-black/[0.04] pb-1.5">
                      <span className="font-semibold text-neutral-800">{handoff.fromAgent}</span>
                      <span className="text-neutral-400">➔</span>
                      <span className="font-semibold text-neutral-800">{handoff.toAgent}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Mood: </span>
                      <span className="font-medium text-neutral-800">{handoff.dominantMood}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Hero Motif: </span>
                      <span className="text-neutral-700">{handoff.heroMotif}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-neutral-400">Palette:</span>
                      {handoff.paletteHexes.map((hex) => (
                        <span
                          key={hex}
                          title={hex}
                          className="h-3.5 w-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400">
                    Awaiting visual art direction handoff
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
