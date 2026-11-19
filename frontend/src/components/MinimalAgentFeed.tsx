"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { AgentEvent } from "@/types/campaign";
import { cn, formatTimeShort } from "@/lib/utils";

interface MinimalAgentFeedProps {
  events: AgentEvent[];
  status: string;
  isSendingMessage: boolean;
  onSendMessage: (msg: string) => void;
}

export function MinimalAgentFeed({
  events,
  status,
  isSendingMessage,
  onSendMessage,
}: MinimalAgentFeedProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSendingMessage) return;
    onSendMessage(draft.trim());
    setDraft("");
  };

  return (
    <div className="flex h-[420px] flex-col border-2 border-black bg-white shadow-[4px_4px_0px_#000000]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black bg-[#E6F7EB]/60 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs font-black uppercase text-black">
          <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
          <span>Agent Collaboration Stream</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-black/60">
          <span>@visual_pixelate</span>
          <span>·</span>
          <span>@copy_pixelate</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-xs">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-black/40">
            Awaiting agent thoughts &amp; handoff events...
          </div>
        ) : (
          events.map((evt) => {
            const isVisual = evt.sender.includes("visual") || evt.sender.includes("Visual");
            const isCopy = evt.sender.includes("copy") || evt.sender.includes("Copy");
            const isUser = evt.sender.includes("human") || evt.sender.includes("Director");

            return (
              <div
                key={evt.id}
                className={cn(
                  "border p-3 transition",
                  isUser
                    ? "border-black bg-black text-white"
                    : isVisual
                      ? "border-black bg-[#ECFEFF] text-black"
                      : isCopy
                        ? "border-black bg-[#F0FDF4] text-black"
                        : "border-black/30 bg-gray-50 text-black"
                )}
              >
                <div className="flex items-center justify-between border-b pb-1.5 text-[10px] font-bold">
                  <span
                    className={cn(
                      "uppercase tracking-wider",
                      isUser
                        ? "text-[#10B981]"
                        : isVisual
                          ? "text-[#0891B2]"
                          : isCopy
                            ? "text-[#15803D]"
                            : "text-black/60"
                    )}
                  >
                    {evt.sender}
                  </span>
                  <span className={cn(isUser ? "text-white/60" : "text-black/40")}>
                    {formatTimeShort(evt.timestamp)}
                  </span>
                </div>
                <div className="mt-1.5 font-sans text-xs leading-relaxed">
                  {evt.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Re-prompt / directive bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t-2 border-black bg-white p-2.5"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a directive to @visual_pixelate or @copy_pixelate..."
          className="flex-1 border border-black bg-white px-3 py-2 font-mono text-xs outline-none focus:bg-[#E6F7EB]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSendingMessage}
          className="inline-flex items-center gap-1 border border-black bg-[#10B981] px-4 py-2 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
          <span>SEND</span>
        </button>
      </form>
    </div>
  );
}
