"use client";

import React from "react";
import {
  Download,
  FileJson,
  PanelLeft,
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
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-[#FBFBFD]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Clean Brand + Mobile Menu Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-neutral-800 shadow-sm transition hover:bg-neutral-50 lg:hidden"
            aria-label="Toggle Navigation"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-sans text-base font-semibold tracking-tight text-[#1D1D1F]">
              Pixelate
            </span>
          </div>
        </div>

        {/* Center: Minimalist Active State Indicator */}
        <div className="hidden items-center gap-2 md:flex">
          {campaignId && (
            <div className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm">
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
              <span className="text-neutral-900 font-semibold">{campaignId}</span>
              {status === "running" && (
                <span className="text-neutral-400 font-normal">· Orchestrating</span>
              )}
              {status === "completed" && (
                <span className="text-neutral-400 font-normal">· Ready</span>
              )}
            </div>
          )}

          {modeNotice && (
            <div className="max-w-xs truncate rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs text-neutral-500 shadow-sm">
              {modeNotice}
            </div>
          )}
        </div>

        {/* Right: Minimalist Controls & Clean Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMockMode}
            title="Toggle between Live WebSocket and Simulated Engine"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all shadow-sm",
              preferMockMode
                ? "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                : isLive
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/60"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {preferMockMode ? (
              <WifiOff className="h-3 w-3 text-neutral-500" />
            ) : (
              <Wifi className="h-3 w-3 text-emerald-600" />
            )}
            <span>{preferMockMode ? "Simulated" : isLive ? "Live" : "Auto"}</span>
          </button>

          {assets && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              >
                <FileJson className="h-3.5 w-3.5 text-neutral-500" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={onExportZip}
                disabled={isExportingZip}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-black disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExportingZip ? "Exporting..." : "Export Kit"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
