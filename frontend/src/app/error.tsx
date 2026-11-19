"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production, log to structured error monitoring service
    console.error("[Agent Pixelate Client Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] p-6 text-white">
      <div className="w-full max-w-md border-2 border-red-500/40 bg-[#121216] p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-mono text-lg font-bold tracking-tight text-red-200">
          Campaign Runtime Exception
        </h2>
        <p className="mt-2 font-mono text-xs text-slate-400">
          {error?.message || "An unexpected error occurred during multi-agent orchestration."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-violet-500"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Recover Session</span>
        </button>
      </div>
    </div>
  );
}
