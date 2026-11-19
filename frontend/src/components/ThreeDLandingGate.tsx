"use client";

import React, { useState } from "react";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { ArrowRight, LogIn, Sparkles, UserPlus } from "lucide-react";
import dynamic from "next/dynamic";
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
      <div className="flex h-full w-full items-center justify-center bg-[#050711] text-cyan-400">
        <span className="font-mono text-xs tracking-wider animate-pulse">
          INITIALIZING 3D ENGINE...
        </span>
      </div>
    ),
  }
);

function InteractiveThreeDGateView({
  clerkEnabled,
  configLoaded,
  geminiEnabled,
  onEnterPreview,
}: {
  clerkEnabled: boolean;
  configLoaded: boolean;
  geminiEnabled: boolean;
  onEnterPreview?: () => void;
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050711] text-white">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.15), transparent 60%)",
        }}
      />

      {/* 3D WebGL Scene */}
      <div className="absolute inset-0">
        <ThreeDashboardScene
          focusTarget="overview"
          onSelectNode={() => {}}
          geminiEnabled={geminiEnabled}
        />
      </div>

      {/* Floating Minimalist Top Bar */}
      <header className="pointer-events-none relative z-20 flex items-center justify-between p-6">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0B1020]/60 px-4 py-2 backdrop-blur-md">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981] text-black">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-white">
            Agent Pixelate
          </span>
        </div>
      </header>

      {/* Centered Minimalist Glass Card */}
      <main className="pointer-events-none relative z-20 flex h-[calc(100vh-120px)] items-center justify-center px-4">
        <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/15 bg-[#0B1020]/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
            <Sparkles className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Agent Pixelate
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Autonomous multi-agent creative studio for high-res product visuals, kinetic promo video cuts, and marketing copy.
          </p>

          <div className="mt-8 space-y-3">
            {!configLoaded ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-slate-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-[#10B981]" />
                Initializing studio...
              </div>
            ) : clerkEnabled ? (
              <>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10B981] py-3 text-sm font-bold text-black transition hover:bg-[#059669] hover:text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Studio</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Create Account</span>
                  </button>
                </SignUpButton>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnterPreview}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10B981] py-3 text-sm font-bold text-black transition hover:bg-[#059669] hover:text-white"
              >
                <span>Enter Studio</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export function ThreeDLandingGate() {
  const { clerkEnabled, configLoaded, geminiEnabled } = useRuntimeAuthConfig();
  const [guestEntered, setGuestEntered] = useState(false);

  if (clerkEnabled) {
    return (
      <>
        <SignedOut>
          <InteractiveThreeDGateView
            clerkEnabled={true}
            configLoaded={configLoaded}
            geminiEnabled={geminiEnabled}
          />
        </SignedOut>
        <SignedIn>
          <CampaignWorkspace />
        </SignedIn>
      </>
    );
  }

  if (!guestEntered) {
    return (
      <InteractiveThreeDGateView
        clerkEnabled={false}
        configLoaded={configLoaded}
        geminiEnabled={geminiEnabled}
        onEnterPreview={() => setGuestEntered(true)}
      />
    );
  }

  return <CampaignWorkspace />;
}
