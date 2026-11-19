"use client";

import React, { useState } from "react";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import {
  ArrowRight,
  Cpu,
  Eye,
  Film,
  LogIn,
  MousePointerClick,
  PenTool,
  Radio,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CameraFocusTarget } from "@/components/ThreeDashboardScene";
import { useRuntimeAuthConfig } from "@/components/ClerkAuthProvider";
import { CampaignWorkspace } from "@/components/CampaignWorkspace";

const ThreeDashboardScene = dynamic(
  () =>
    import("@/components/ThreeDashboardScene").then(
      (mod) => mod.ThreeDashboardScene
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#09090b] text-violet-400">
        <span className="font-mono text-xs tracking-wider animate-pulse">
          INITIALIZING 3D NEURAL MESH...
        </span>
      </div>
    ),
  }
);

const NODE_DETAILS: Record<
  CameraFocusTarget,
  { label: string; subtitle: string; accentClass: string; badge: string }
> = {
  overview: {
    label: "BAND Multi-Agent Neural Mesh",
    subtitle:
      "Drag to orbit, scroll to zoom, or click any glowing 3D agent node to inspect the live campaign architecture.",
    accentClass: "text-violet-300 border-violet-400/30 bg-violet-500/15",
    badge: "3D Overview",
  },
  orchestrator: {
    label: "@orchestrator_pixelate · BAND Core",
    subtitle:
      "Creates task-scoped BAND rooms, persists shared memories, and streams live AgentEvent WebSocket telemetry.",
    accentClass: "text-violet-300 border-violet-400/30 bg-violet-500/15",
    badge: "Orchestrator",
  },
  visual: {
    label: "@visual_pixelate · Creative Director",
    subtitle:
      "Generates Gemini-powered art direction, brand palettes, campaign visuals, and 10s H.264 promo MP4s before @mentioning Copy.",
    accentClass: "text-cyan-300 border-cyan-400/30 bg-cyan-500/15",
    badge: "Visual Agent",
  },
  copy: {
    label: "@copy_pixelate · Conversion Copywriter",
    subtitle:
      "Hydrates shared BAND Memories on @mention handoff to craft channel-tailored LinkedIn, Instagram, X, and ad copy.",
    accentClass: "text-emerald-300 border-emerald-400/30 bg-emerald-500/15",
    badge: "Copy Agent",
  },
};

function InteractiveThreeDGateView({
  clerkEnabled,
  configLoaded,
  geminiEnabled,
  bandTransport,
  onEnterPreview,
}: {
  clerkEnabled: boolean;
  configLoaded: boolean;
  geminiEnabled: boolean;
  bandTransport: string;
  onEnterPreview?: () => void;
}) {
  const [focusTarget, setFocusTarget] = useState<CameraFocusTarget>("overview");
  const activeDetail = NODE_DETAILS[focusTarget];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050711] text-white">
      {/* Ambient radial lighting backdrop behind WebGL canvas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 22% 24%, rgba(139,92,246,0.22), transparent 44%), radial-gradient(circle at 80% 72%, rgba(6,182,212,0.18), transparent 46%), radial-gradient(circle at 50% 100%, rgba(16,185,129,0.12), transparent 50%)",
        }}
      />

      {/* Fullscreen Interactive Three.js 3D Multi-Agent Canvas */}
      <div className="absolute inset-0">
        <ThreeDashboardScene
          focusTarget={focusTarget}
          onSelectNode={setFocusTarget}
          geminiEnabled={geminiEnabled}
        />
      </div>

      {/* Top Floating Navigation Telemetry Bar */}
      <header className="pointer-events-none relative z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1020]/70 px-4 py-2.5 backdrop-blur-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white sm:text-base">
                Agent Pixelate
              </span>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                3D Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-Agent AI Campaign Orchestrator
            </p>
          </div>
        </div>

        {/* Live Stack Badges */}
        <div className="pointer-events-auto hidden items-center gap-2 md:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0B1020]/70 px-3.5 py-1.5 font-mono text-[11px] text-slate-200 backdrop-blur-xl">
            <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            <span>
              {geminiEnabled ? "GEMINI AI LIVE" : "STUDIO ENGINE READY"}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0B1020]/70 px-3.5 py-1.5 font-mono text-[11px] text-slate-300 backdrop-blur-xl">
            <Cpu className="h-3.5 w-3.5 text-violet-400" />
            <span>
              BAND · {bandTransport === "band" ? "LIVE ROOM" : "EVENT BUS"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Split Overlay: Left Interactive 3D Telemetry + Right Glass Sign-In Card */}
      <main className="pointer-events-none relative z-20 mx-auto flex h-[calc(100vh-148px)] max-w-[1440px] flex-col justify-between px-5 py-2 sm:px-8 lg:flex-row lg:items-center">
        {/* Left: Live 3D Node Telemetry Readout */}
        <div className="pointer-events-auto max-w-md space-y-3 self-start lg:self-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md ${activeDetail.accentClass}`}
          >
            <Eye className="h-3 w-3" />
            {activeDetail.badge}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow sm:text-4xl lg:text-5xl">
            Orchestrate Campaigns in{" "}
            <span className="bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Real-Time 3D.
            </span>
          </h1>
          <div className="rounded-2xl border border-white/10 bg-[#0B1020]/65 p-4 backdrop-blur-xl">
            <p className="font-mono text-xs font-semibold text-cyan-300">
              {activeDetail.label}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              {activeDetail.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Frosted Glass Sign-In Command Card */}
        <div className="pointer-events-auto mt-4 w-full max-w-sm self-center rounded-3xl border border-white/15 bg-[#0B1020]/75 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur-2xl sm:p-7 lg:mt-0">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              Clerk Secured
            </span>
            <span className="font-mono text-[11px] text-slate-400">v1.0</span>
          </div>

          <h2 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Sign in to launch your studio
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Access `@visual_pixelate`, `@copy_pixelate`, BAND shared memories,
            Gemini AI generation, and cinematic MP4 video rendering.
          </p>

          {/* Feature mini-grid */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <Sparkles className="mx-auto h-4 w-4 text-cyan-300" />
              <p className="mt-1 text-[10px] font-semibold text-slate-200">
                Visual AI
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <PenTool className="mx-auto h-4 w-4 text-emerald-300" />
              <p className="mt-1 text-[10px] font-semibold text-slate-200">
                Copy Deck
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <Film className="mx-auto h-4 w-4 text-violet-300" />
              <p className="mt-1 text-[10px] font-semibold text-slate-200">
                MP4 Studio
              </p>
            </div>
          </div>

          {/* Auth CTA Buttons */}
          <div className="mt-6 space-y-2.5">
            {!configLoaded ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-slate-200">
                <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                Connecting to Clerk Auth…
              </div>
            ) : clerkEnabled ? (
              <>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110 active:scale-[0.99]"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-cyan-300" />
                    <span>Create Free Account</span>
                  </button>
                </SignUpButton>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnterPreview}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110"
              >
                <span>Enter Campaign Studio</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Interactive 3D Camera Controls Dock */}
      <footer className="pointer-events-none relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 pb-4 sm:px-8">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0B1020]/75 p-1.5 backdrop-blur-xl">
          {(
            [
              ["overview", "3D Overview"],
              ["orchestrator", "BAND Core"],
              ["visual", "@visual_pixelate"],
              ["copy", "@copy_pixelate"],
            ] as [CameraFocusTarget, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFocusTarget(id)}
              className={`rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium transition ${
                focusTarget === id
                  ? "bg-white text-slate-950 shadow"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto hidden items-center gap-2 rounded-full border border-white/10 bg-[#0B1020]/65 px-3.5 py-1.5 font-mono text-[11px] text-slate-400 backdrop-blur-xl sm:inline-flex">
          <MousePointerClick className="h-3.5 w-3.5 text-cyan-400" />
          <span>Drag to orbit · Scroll to zoom · Click 3D nodes</span>
        </div>
      </footer>
    </div>
  );
}

export function ThreeDLandingGate() {
  const { clerkEnabled, configLoaded, geminiEnabled, bandTransport } =
    useRuntimeAuthConfig();
  const [guestEntered, setGuestEntered] = useState(false);

  // If Clerk is active, gate the Campaign Studio behind Clerk <SignedIn> / <SignedOut>
  if (clerkEnabled) {
    return (
      <>
        <SignedOut>
          <InteractiveThreeDGateView
            clerkEnabled={true}
            configLoaded={configLoaded}
            geminiEnabled={geminiEnabled}
            bandTransport={bandTransport}
          />
        </SignedOut>
        <SignedIn>
          <CampaignWorkspace />
        </SignedIn>
      </>
    );
  }

  // While /api/config is still loading or if running locally without Clerk keys
  if (!guestEntered) {
    return (
      <InteractiveThreeDGateView
        clerkEnabled={false}
        configLoaded={configLoaded}
        geminiEnabled={geminiEnabled}
        bandTransport={bandTransport}
        onEnterPreview={() => setGuestEntered(true)}
      />
    );
  }

  return <CampaignWorkspace />;
}
