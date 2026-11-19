"use client";

import React from "react";
import {
  Download,
  FileJson,
  PanelLeft,
  Plus,
  ShieldCheck,
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
  onNewCustomRun?: () => void;
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
  onNewCustomRun,
  onExportJson,
  onExportZip,
  isExportingZip,
}: TopNavProps) {
  const isLive = resolvedMode === "live" && !preferMockMode;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-black bg-[#E6F7EB]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1720px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Approva Brand + Mobile Drawer */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="inline-flex h-9 w-9 items-center justify-center border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none lg:hidden"
            aria-label="Toggle Mobile Navigation"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]">
              <ShieldCheck className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-black tracking-tight text-black">
                APPROVA
              </span>
              <span className="hidden font-mono text-[10px] font-bold uppercase tracking-widest text-black/70 sm:inline">
                / AGENT PIXELATE OPS
              </span>
            </div>
          </div>
        </div>

        {/* Center: Auditable Session Telemetry */}
        <div className="hidden items-center gap-3 lg:flex">
          {campaignId && (
            <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1 font-mono text-[11px] font-bold text-black shadow-[2px_2px_0px_#000000]">
              <span
                className={cn(
                  "h-2.5 w-2.5 border border-black",
                  status === "running"
                    ? "animate-pulse bg-[#F59E0B]"
                    : status === "completed"
                      ? "bg-[#10B981]"
                      : "bg-slate-300"
                )}
              />
              <span className="text-black/60">DOCKET:</span>
              <span className="text-black">{campaignId}</span>
            </div>
          )}

          <div className="flex items-center gap-2 border-2 border-black bg-[#D1FAE5] px-2.5 py-1 font-mono text-[11px] font-bold text-black shadow-[2px_2px_0px_#000000]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span>BAND PROTOCOL v2.4</span>
          </div>

          {modeNotice && (
            <div className="max-w-xs truncate border-2 border-black bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-black shadow-[2px_2px_0px_#000000]">
              {modeNotice}
            </div>
          )}
        </div>

        {/* Right: Operational Controls & Brutalist Export CTAs */}
        <div className="flex items-center gap-2.5">
          {onNewCustomRun && (
            <button
              type="button"
              onClick={onNewCustomRun}
              title="Launch a custom campaign brief for any product"
              className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-3.5 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              <span>+ NEW RUN</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMockMode}
            title="Toggle between Live FastAPI WebSocket and Simulated Test Engine"
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all",
              preferMockMode
                ? "bg-white text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                : isLive
                  ? "bg-[#10B981] text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  : "bg-white text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            )}
          >
            {preferMockMode ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : (
              <Wifi className="h-3.5 w-3.5" />
            )}
            <span>{preferMockMode ? "SIMULATED OPS" : isLive ? "LIVE ENGINE" : "AUTO WS"}</span>
          </button>

          {assets && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                <FileJson className="h-3.5 w-3.5" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={onExportZip}
                disabled={isExportingZip}
                className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-3.5 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{isExportingZip ? "PACKING..." : "EXPORT KIT"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
