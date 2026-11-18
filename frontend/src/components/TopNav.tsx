"use client";

import React from "react";
import {
  Download,
  FileJson,
  PanelLeft,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { CampaignAssets, CampaignStatus, ConnectionMode } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface TopNavProps {
  campaignId: string | null;
  status: CampaignStatus;
  preferMockMode: boolean;
  resolvedMode: ConnectionMode;
  modeNotice: string | null;
  assets: CampaignAssets | null;
  onToggleMockMode: () => void;
  onOpenMobileDrawer: () => void;
  onExportJson: () => void;
  onExportZip: () => void;
  isExportingZip: boolean;
}

export function TopNav({
  campaignId,
  status,
  preferMockMode,
  resolvedMode,
  modeNotice,
  assets,
  onToggleMockMode,
  onOpenMobileDrawer,
  onExportJson,
  onExportZip,
  isExportingZip,
}: TopNavProps) {
  const isLive = resolvedMode === "live" && !preferMockMode;

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#09090B]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand & Mobile Drawer Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#121216] text-zinc-300 transition hover:border-white/20 hover:text-white lg:hidden"
            aria-label="Open Campaign Brief Studio"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/25 via-[#121216] to-cyan-500/20 shadow-violet-glow">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#09090B] bg-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                  Agent Pixelate
                </h1>
                <span className="hidden rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-violet-300 sm:inline-block">
                  BAND Studio
                </span>
              </div>
              <p className="hidden text-[11px] text-zinc-400 md:block">
                Multi-Agent AI Campaign Orchestrator
              </p>
            </div>
          </div>
        </div>

        {/* Center: Active Session Telemetry Pill */}
        <div className="hidden items-center gap-2.5 xl:flex">
          {campaignId && (
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#121216] px-3 py-1 font-mono text-xs text-zinc-300">
              <Radio
                className={cn(
                  "h-3.5 w-3.5",
                  status === "running"
                    ? "animate-pulse text-cyan-400"
                    : status === "completed"
                      ? "text-emerald-400"
                      : "text-zinc-500"
                )}
              />
              <span className="text-zinc-500">SESSION</span>
              <span className="text-zinc-100">{campaignId}</span>
            </div>
          )}

          {modeNotice && (
            <div className="max-w-md truncate rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 font-mono text-[11px] text-amber-300">
              {modeNotice}
            </div>
          )}
        </div>

        {/* Right: Mode Toggle & Export Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleMockMode}
            title="Toggle between Live localhost:8000 WebSocket and Simulated Mock Mode"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium transition",
              preferMockMode
                ? "border-amber-500/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                : isLive
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                  : "border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
            )}
          >
            {preferMockMode ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-cyan-400" />
            )}
            <span>{preferMockMode ? "Mock Mode: ON" : "Auto Live / Fallback"}</span>
          </button>

          {assets && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#121216] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:bg-[#18181F] hover:text-white"
              >
                <FileJson className="h-3.5 w-3.5 text-cyan-400" />
                <span>.JSON</span>
              </button>
              <button
                type="button"
                onClick={onExportZip}
                disabled={isExportingZip}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-violet-300" />
                <span>{isExportingZip ? "Packing..." : "Export Kit .ZIP"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
