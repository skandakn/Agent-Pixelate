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
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Minimal Apple-Grade Brand Mark & Mobile Drawer Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.1] bg-[#F5F5F7] text-[#1D1D1F] transition hover:bg-black/[0.06] lg:hidden"
            aria-label="Open Campaign Brief Studio"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#1D1D1F] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                Agent Pixelate
              </h1>
              <span className="hidden text-xs font-medium text-[#86868B] sm:inline">
                Campaign Studio
              </span>
            </div>
          </div>
        </div>

        {/* Center: Understated Session Telemetry */}
        <div className="hidden items-center gap-2.5 xl:flex">
          {campaignId && (
            <div className="flex items-center gap-2 rounded-full bg-[#F5F5F7] px-3 py-1 text-[11px] font-medium text-[#6E6E73]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "running"
                    ? "animate-pulse bg-[#0071E3]"
                    : status === "completed"
                      ? "bg-[#248A3D]"
                      : "bg-[#86868B]"
                )}
              />
              <span>Session</span>
              <span className="font-mono text-[#1D1D1F]">{campaignId}</span>
            </div>
          )}

          {modeNotice && (
            <div className="max-w-md truncate rounded-full bg-[#F5F5F7] px-3 py-1 text-[11px] font-medium text-[#6E6E73]">
              {modeNotice}
            </div>
          )}
        </div>

        {/* Right: Clean Connection Pill & Classic Apple Pill CTAs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMockMode}
            title="Toggle between Live localhost:8000 WebSocket and Simulated Mode"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
              preferMockMode
                ? "border-black/[0.1] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.06]"
                : isLive
                  ? "border-[#248A3D]/25 bg-[#248A3D]/[0.08] text-[#1D6F31] hover:bg-[#248A3D]/[0.12]"
                  : "border-black/[0.08] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.06]"
            )}
          >
            {preferMockMode ? (
              <WifiOff className="h-3.5 w-3.5 text-[#6E6E73]" />
            ) : (
              <Wifi
                className={cn(
                  "h-3.5 w-3.5",
                  isLive ? "text-[#248A3D]" : "text-[#0071E3]"
                )}
              />
            )}
            <span>
              {preferMockMode
                ? "Simulated Mode"
                : isLive
                  ? "Live API Connected"
                  : "Live API · Auto"}
            </span>
          </button>

          {assets && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition hover:border-[#86868B] hover:bg-[#F5F5F7]"
              >
                <FileJson className="h-3.5 w-3.5 text-[#6E6E73]" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={onExportZip}
                disabled={isExportingZip}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0077ED] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExportingZip ? "Exporting…" : "Export Kit"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
