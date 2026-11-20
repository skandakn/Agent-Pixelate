"use client";

import React from "react";
import { Download, Plus, Sparkles, Wifi, WifiOff } from "lucide-react";
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
  onOpenMobileDrawer?: () => void;
  onNewCustomRun?: () => void;
  onExportJson?: () => void;
  onExportZip: () => void;
  isExportingZip: boolean;
}

export function TopNav({
  status,
  preferMockMode,
  resolvedMode,
  assets,
  onToggleMockMode,
  onNewCustomRun,
  onExportZip,
  isExportingZip,
}: TopNavProps) {
  const isLive = resolvedMode === "live" && !preferMockMode;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-black bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-[#10B981] text-black shadow-[2px_2px_0px_#000000]">
            <Sparkles className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-base font-black tracking-tight text-black sm:text-lg">
              PIXELATE
            </span>
            <span className="hidden font-mono text-[10px] font-bold uppercase tracking-widest text-black/50 sm:inline">
              STUDIO
            </span>
          </div>
        </div>

        {/* Center: Minimal Status Badge */}
        <div className="hidden items-center gap-2 font-mono text-xs md:flex">
          {status === "running" ? (
            <div className="flex items-center gap-2 border-2 border-black bg-[#FEF3C7] px-3 py-1 font-bold text-black shadow-[2px_2px_0px_#000000]">
              <span className="h-2 w-2 animate-ping rounded-full bg-[#F59E0B]" />
              <span>AGENTS GENERATING CAMPAIGN...</span>
            </div>
          ) : status === "completed" ? (
            <div className="flex items-center gap-2 border-2 border-black bg-[#D1FAE5] px-3 py-1 font-bold text-black shadow-[2px_2px_0px_#000000]">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span>CAMPAIGN READY</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-2 border-black bg-black/5 px-3 py-1 font-semibold text-black/70">
              <span className="h-2 w-2 rounded-full bg-black/40" />
              <span>STUDIO IDLE</span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {onNewCustomRun && (
            <button
              type="button"
              onClick={onNewCustomRun}
              className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>NEW RUN</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMockMode}
            title="Toggle between Live Engine and Simulated Engine"
            className={cn(
              "hidden items-center gap-1.5 border-2 border-black px-2.5 py-1.5 font-mono text-xs font-bold uppercase transition-all sm:inline-flex",
              isLive
                ? "bg-[#D1FAE5] text-black shadow-[2px_2px_0px_#000000]"
                : "bg-white text-black/70 shadow-[2px_2px_0px_#000000]"
            )}
          >
            {preferMockMode ? (
              <WifiOff className="h-3 w-3" />
            ) : (
              <Wifi className="h-3 w-3 text-[#10B981]" />
            )}
            <span>{preferMockMode ? "SIMULATED" : isLive ? "LIVE ENGINE" : "CONNECTING"}</span>
          </button>

          {assets && (
            <button
              type="button"
              onClick={onExportZip}
              disabled={isExportingZip}
              className="inline-flex items-center gap-1.5 border-2 border-black bg-[#10B981] px-3.5 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_#000000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{isExportingZip ? "EXPORTING..." : "EXPORT KIT"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
