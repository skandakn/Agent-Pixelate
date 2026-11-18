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
    label: "Brief",
    sublabel: "Product & Tone",
    icon: FileText,
  },
  {
    id: "band_room",
    label: "BAND Room",
    sublabel: "Shared Memory",
    icon: Users,
  },
  {
    id: "visual_agent",
    label: "@VisualAgent",
    sublabel: "Art & Creatives",
    icon: Palette,
  },
  {
    id: "context_handoff",
    label: "Handoff",
    sublabel: "Visual → Copy",
    icon: ArrowRightLeft,
  },
  {
    id: "copy_agent",
    label: "@CopyAgent",
    sublabel: "Social & Ads",
    icon: PenTool,
  },
  {
    id: "final_campaign",
    label: "Campaign Kit",
    sublabel: "Ready to Export",
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
    <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-apple">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F7]">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                status === "running"
                  ? "animate-pulse bg-[#0071E3]"
                  : status === "completed"
                    ? "bg-[#248A3D]"
                    : "bg-[#86868B]"
              )}
            />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
              Multi-Agent Pipeline
            </h2>
            <p className="text-[12px] text-[#6E6E73]">
              {status === "running"
                ? "Live BAND room stream & structured context handoff in progress"
                : status === "completed"
                  ? "All stages synchronized · Select any node to filter activity"
                  : "Ready to connect @VisualAgent and @CopyAgent"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedStageFilter && (
            <button
              type="button"
              onClick={() => setSelectedStageFilter(null)}
              className="rounded-full bg-[#0071E3]/[0.1] px-3 py-1 text-[11px] font-medium text-[#0066CC] transition hover:bg-[#0071E3]/[0.16]"
            >
              Filter: {selectedStageFilter.replace("_", " ")} ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setLogExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition hover:bg-black/[0.06]"
          >
            <Activity className="h-3.5 w-3.5 text-[#6E6E73]" />
            <span>Activity ({events.length})</span>
            {logExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-[#6E6E73]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[#6E6E73]" />
            )}
          </button>
        </div>
      </div>

      {/* 6-Node Horizontal Precision Stepper */}
      <div className="overflow-x-auto px-5 py-5 sm:px-6">
        <div className="flex min-w-[760px] items-center justify-between gap-2">
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
                    "group relative flex w-[132px] shrink-0 flex-col items-center rounded-2xl border px-3 py-3.5 text-center transition-all duration-200",
                    nodeState === "active"
                      ? "border-[#0071E3] bg-[#0071E3]/[0.05] text-[#1D1D1F] shadow-sm"
                      : nodeState === "completed"
                        ? "border-black/[0.08] bg-white text-[#1D1D1F] hover:border-black/[0.16] hover:bg-[#FBFBFD]"
                        : "border-transparent bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#EFEFF2] hover:text-[#1D1D1F]",
                    isSelected && "ring-2 ring-[#0071E3] ring-offset-2 ring-offset-white"
                  )}
                >
                  <div
                    className={cn(
                      "relative mb-2 flex h-9 w-9 items-center justify-center rounded-full transition",
                      nodeState === "active"
                        ? "bg-[#0071E3] text-white"
                        : nodeState === "completed"
                          ? "bg-[#1D1D1F] text-white"
                          : "bg-white text-[#6E6E73] shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {nodeState === "completed" && (
                      <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-[#248A3D]" />
                    )}
                  </div>

                  <span className="text-[12px] font-semibold leading-tight tracking-[-0.01em]">
                    {node.label}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[#86868B]">
                    {node.sublabel}
                  </span>
                </button>

                {/* Subtle Precision Connector */}
                {index < PIPELINE_NODES.length - 1 && (
                  <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                    {getNodeStatus(index) === "completed" && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="h-full origin-left bg-[#1D1D1F]"
                      />
                    )}
                    {getNodeStatus(index) === "active" && (
                      <motion.div
                        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#0071E3] to-transparent"
                        animate={{ x: ["-100%", "220%"] }}
                        transition={{
                          duration: 1.2,
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

      {/* Expandable Activity Stream & BAND Context Handoff */}
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
              <div className="max-h-52 overflow-y-auto bg-[#FBFBFD] p-4 sm:px-6 xl:col-span-8">
                {filteredEvents.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-[13px] text-[#86868B]">
                    <span>
                      Launch agents from the brief to watch live reasoning and handoff events.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((evt) => {
                      const senderClass =
                        evt.sender === "@VisualAgent"
                          ? "bg-[#1D1D1F] text-white"
                          : evt.sender === "@CopyAgent"
                            ? "bg-[#0071E3] text-white"
                            : evt.sender === "Orchestrator"
                              ? "bg-[#248A3D]/10 text-[#1D6F31]"
                              : "bg-black/[0.06] text-[#1D1D1F]";

                      return (
                        <motion.div
                          key={evt.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "rounded-xl border px-3.5 py-2.5",
                            evt.type === "handoff"
                              ? "border-[#0071E3]/25 bg-[#0071E3]/[0.04]"
                              : "border-black/[0.06] bg-white"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] text-[#86868B]">
                              {formatTimeShort(evt.timestamp)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                senderClass
                              )}
                            >
                              {evt.sender}
                            </span>
                            <span className="text-[12px] font-semibold text-[#1D1D1F]">
                              {evt.title}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#6E6E73]">
                            {evt.message}
                          </p>
                        </motion.div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>

              {/* BAND Context Handoff Inspector */}
              <div className="bg-white p-4 sm:px-5 xl:col-span-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F]">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-[#0071E3]" />
                    BAND Context Handoff
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      handoff
                        ? "bg-[#248A3D]/10 text-[#1D6F31]"
                        : "bg-[#F5F5F7] text-[#86868B]"
                    )}
                  >
                    {handoff ? "Synced" : "Pending"}
                  </span>
                </div>

                {handoff ? (
                  <div className="space-y-2 rounded-2xl bg-[#F5F5F7] p-3.5 text-[12px]">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-semibold text-[#1D1D1F]">
                        {handoff.fromAgent}
                      </span>
                      <span className="text-[#86868B]">→</span>
                      <span className="font-semibold text-[#0071E3]">
                        {handoff.toAgent}
                      </span>
                    </div>
                    <div className="pt-0.5">
                      <span className="text-[#86868B]">Mood: </span>
                      <span className="font-medium text-[#1D1D1F]">
                        {handoff.dominantMood}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#86868B]">Motif: </span>
                      <span className="text-[#424245]">{handoff.heroMotif}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[#86868B]">Palette:</span>
                      {handoff.paletteHexes.map((hex) => (
                        <span
                          key={hex}
                          title={hex}
                          className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-black/[0.1] bg-[#FBFBFD] p-4 text-center text-[12px] text-[#86868B]">
                    Waiting for @VisualAgent to share art direction with @CopyAgent.
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
