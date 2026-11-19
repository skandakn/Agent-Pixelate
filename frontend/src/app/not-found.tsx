import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] p-6 text-white">
      <div className="w-full max-w-md border border-white/10 bg-[#121216] p-8 text-center shadow-xl">
        <h1 className="font-mono text-4xl font-extrabold text-violet-400">404</h1>
        <p className="mt-2 font-mono text-sm text-slate-300">
          Campaign or route not found
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Campaign Studio</span>
        </Link>
      </div>
    </div>
  );
}
