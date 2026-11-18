import {
  AgentEvent,
  AgentSender,
  CampaignAssets,
  CampaignBrief,
  ContextHandoffPayload,
  PipelineStage,
} from "@/types/campaign";
import { buildSimulatedCampaignAssets } from "@/data/presets";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";
const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "") ||
  "ws://localhost:8000";

export interface StreamCallbacks {
  onCampaignId: (campaignId: string) => void;
  onModeResolved: (mode: "live" | "mock", notice?: string) => void;
  onEvent: (event: AgentEvent) => void;
  onPartialAssets: (partial: Partial<CampaignAssets>) => void;
  onComplete: (assets: CampaignAssets) => void;
  onError: (message: string) => void;
}

export interface CampaignSessionController {
  cancel: () => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeStage(raw?: string): PipelineStage {
  const value = (raw || "").toLowerCase();
  if (value.includes("brief") || value.includes("input")) return "user_brief";
  if (value.includes("band") || value.includes("room") || value.includes("init"))
    return "band_room";
  if (value.includes("handoff") || value.includes("transfer"))
    return "context_handoff";
  if (value.includes("visual") || value.includes("image") || value.includes("art"))
    return "visual_agent";
  if (value.includes("copy") || value.includes("text") || value.includes("ad"))
    return "copy_agent";
  if (value.includes("final") || value.includes("complete") || value.includes("done"))
    return "final_campaign";
  return "band_room";
}

function normalizeSender(raw?: string, stage?: PipelineStage): AgentSender {
  const value = (raw || "").toLowerCase();
  if (value.includes("visual")) return "@VisualAgent";
  if (value.includes("copy")) return "@CopyAgent";
  if (value.includes("band")) return "BAND Room";
  if (value.includes("orchestrat")) return "Orchestrator";
  if (stage === "visual_agent" || stage === "context_handoff") return "@VisualAgent";
  if (stage === "copy_agent") return "@CopyAgent";
  return "System";
}

export function runSimulatedCampaignStream(
  brief: CampaignBrief,
  callbacks: StreamCallbacks,
  notice?: string
): CampaignSessionController {
  const campaignId = `camp_${Math.random().toString(36).slice(2, 8)}`;
  const fullAssets = buildSimulatedCampaignAssets(brief, campaignId);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  callbacks.onCampaignId(campaignId);
  callbacks.onModeResolved("mock", notice);

  const schedule = (delayMs: number, fn: () => void) => {
    const t = setTimeout(() => {
      if (!cancelled) fn();
    }, delayMs);
    timers.push(t);
  };

  const emit = (
    stage: PipelineStage,
    sender: AgentSender,
    type: AgentEvent["type"],
    title: string,
    message: string,
    handoffPayload?: ContextHandoffPayload
  ) => {
    callbacks.onEvent({
      id: makeId("evt"),
      campaignId,
      timestamp: new Date().toISOString(),
      stage,
      sender,
      type,
      title,
      message,
      handoffPayload,
    });
  };

  schedule(120, () => {
    emit(
      "user_brief",
      "System",
      "status",
      "Campaign Brief Ingested",
      `Parsed brief for "${brief.productName}" (${brief.brandTone} tone · ${brief.platforms.join(", ")}).`
    );
  });

  schedule(700, () => {
    emit(
      "band_room",
      "BAND Room",
      "status",
      "Shared Agent Room Initialized",
      `Opened BAND session ${campaignId}. Subscribed @VisualAgent and @CopyAgent to shared creative memory bus.`
    );
  });

  schedule(1400, () => {
    emit(
      "visual_agent",
      "@VisualAgent",
      "thought",
      "Art Direction & Color Grading",
      `Synthesizing ${brief.brandTone.toLowerCase()} lighting cues for ${brief.targetAudience}. Selecting 5-token palette anchored by ${fullAssets.palette[1]?.hex ?? "#8B5CF6"} & ${fullAssets.palette[2]?.hex ?? "#06B6D4"}.`
    );
  });

  schedule(2300, () => {
    emit(
      "visual_agent",
      "@VisualAgent",
      "asset_ready",
      "Key Visuals & 15s Storyboard Rendered",
      `Generated ${fullAssets.creatives.length} aspect-adapted campaign creatives + 4-scene motion storyboard.`
    );
    callbacks.onPartialAssets({
      campaignId,
      generatedAt: fullAssets.generatedAt,
      brief: fullAssets.brief,
      artDirectionSummary: fullAssets.artDirectionSummary,
      palette: fullAssets.palette,
      creatives: fullAssets.creatives,
      storyboard: fullAssets.storyboard,
    });
  });

  schedule(3150, () => {
    emit(
      "context_handoff",
      "@VisualAgent",
      "handoff",
      "Structured Context Handoff → @CopyAgent",
      `Passing visual motif, palette hex tokens, and mood directives to @CopyAgent inside BAND Shared Room.`,
      fullAssets.handoff ?? undefined
    );
    callbacks.onPartialAssets({
      handoff: fullAssets.handoff,
    });
  });

  schedule(4050, () => {
    emit(
      "copy_agent",
      "@CopyAgent",
      "thought",
      "Aligning Copy Hooks with Visual Motif",
      `Ingested @VisualAgent palette & hero motif. Drafting high-converting ${brief.platforms.join(" + ")} copy decks calibrated to "${brief.brandTone}" voice.`
    );
  });

  schedule(4950, () => {
    emit(
      "copy_agent",
      "@CopyAgent",
      "asset_ready",
      "Multi-Platform Copy Deck Compiled",
      `Completed ${fullAssets.socialPosts.length} social posts, ${fullAssets.metaAds.length} Meta Ad variants with CTA previews, and ${fullAssets.hashtags.length} curated hashtags.`
    );
    callbacks.onPartialAssets({
      socialPosts: fullAssets.socialPosts,
      metaAds: fullAssets.metaAds,
      hashtags: fullAssets.hashtags,
    });
  });

  schedule(5650, () => {
    emit(
      "final_campaign",
      "Orchestrator",
      "complete",
      "Campaign Kit Assembled & Ready to Export",
      `All visual and copy assets synchronized for "${brief.productName}". Ready for clipboard copy or .JSON / .ZIP export.`
    );
    callbacks.onComplete(fullAssets);
  });

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    },
  };
}

export function launchCampaignSession(
  brief: CampaignBrief,
  preferMockMode: boolean,
  callbacks: StreamCallbacks
): CampaignSessionController {
  if (preferMockMode) {
    return runSimulatedCampaignStream(
      brief,
      callbacks,
      "Mock Studio Mode enabled — streaming simulated BAND multi-agent telemetry."
    );
  }

  let activeSocket: WebSocket | null = null;
  let fallbackController: CampaignSessionController | null = null;
  let cancelled = false;
  const abortController = new AbortController();

  const triggerFallback = (reason: string) => {
    if (cancelled || fallbackController) return;
    if (activeSocket) {
      try {
        activeSocket.close();
      } catch {
        // Ignore close errors
      }
      activeSocket = null;
    }
    fallbackController = runSimulatedCampaignStream(brief, callbacks, reason);
  };

  (async () => {
    try {
      const timeout = setTimeout(() => abortController.abort(), 2800);
      const response = await fetch(`${API_BASE}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          product_name: brief.productName,
          product_description: brief.productDescription,
          target_audience: brief.targetAudience,
          brand_tone: brief.brandTone,
          platforms: brief.platforms,
        }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        triggerFallback(
          `Backend returned HTTP ${response.status} — seamlessly switched to Mock Studio Mode.`
        );
        return;
      }

      const data = (await response.json()) as {
        campaign_id?: string;
        id?: string;
      };
      const campaignId = data.campaign_id || data.id;
      if (!campaignId) {
        triggerFallback(
          "Backend response missing campaign_id — seamlessly switched to Mock Studio Mode."
        );
        return;
      }

      if (cancelled) return;
      callbacks.onCampaignId(campaignId);
      callbacks.onModeResolved("live");

      const ws = new WebSocket(`${WS_BASE}/ws/campaign/${campaignId}`);
      activeSocket = ws;

      const simulatedTemplate = buildSimulatedCampaignAssets(brief, campaignId);
      let connected = false;
      let completed = false;

      const wsTimeout = setTimeout(() => {
        if (!connected && !cancelled) {
          triggerFallback(
            "WebSocket stream timed out at localhost:8000 — switched to Mock Studio Mode."
          );
        }
      }, 3000);

      ws.onopen = () => {
        connected = true;
        clearTimeout(wsTimeout);
        callbacks.onEvent({
          id: makeId("evt"),
          campaignId,
          timestamp: new Date().toISOString(),
          stage: "band_room",
          sender: "BAND Room",
          type: "status",
          title: "Live WebSocket Connected",
          message: `Subscribed to ws://localhost:8000/ws/campaign/${campaignId}`,
        });
      };

      ws.onmessage = (msg) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(msg.data as string) as Record<string, unknown>;
          const stage = normalizeStage(
            (parsed.stage as string) ||
              (parsed.node as string) ||
              (parsed.type as string)
          );
          const sender = normalizeSender(
            (parsed.agent as string) || (parsed.sender as string),
            stage
          );

          const eventTypeRaw = String(parsed.type || parsed.event_type || "thought").toLowerCase();
          const eventType: AgentEvent["type"] =
            eventTypeRaw.includes("handoff")
              ? "handoff"
              : eventTypeRaw.includes("complete") || eventTypeRaw.includes("done")
                ? "complete"
                : eventTypeRaw.includes("error")
                  ? "error"
                  : eventTypeRaw.includes("asset")
                    ? "asset_ready"
                    : eventTypeRaw.includes("status")
                      ? "status"
                      : "thought";

          const handoffObj = parsed.handoff_payload as ContextHandoffPayload | undefined;

          callbacks.onEvent({
            id: (parsed.id as string) || makeId("evt"),
            campaignId,
            timestamp: (parsed.timestamp as string) || new Date().toISOString(),
            stage,
            sender,
            type: eventType,
            title:
              (parsed.title as string) ||
              (parsed.step as string) ||
              `${sender} Update`,
            message:
              (parsed.message as string) ||
              (parsed.thought as string) ||
              (parsed.content as string) ||
              "Processing campaign artifacts...",
            handoffPayload: handoffObj,
          });

          const payloadData = (parsed.data || parsed.assets || parsed.campaign) as
            | Partial<CampaignAssets>
            | undefined;

          if (payloadData && typeof payloadData === "object") {
            callbacks.onPartialAssets(payloadData);
          }

          if (eventType === "complete" || stage === "final_campaign") {
            completed = true;
            callbacks.onComplete({
              ...simulatedTemplate,
              ...(payloadData || {}),
              campaignId,
              brief,
            });
          }
        } catch {
          // Ignore malformed non-JSON heartbeat frames
        }
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        if (!connected) {
          triggerFallback(
            "Unable to open WebSocket at ws://localhost:8000 — switched to Mock Studio Mode."
          );
        }
      };

      ws.onclose = () => {
        clearTimeout(wsTimeout);
        if (!connected && !cancelled && !completed) {
          triggerFallback(
            "Backend WebSocket closed before handshake — switched to Mock Studio Mode."
          );
        }
      };
    } catch {
      triggerFallback(
        "Backend at localhost:8000 unreachable — running seamless Mock Studio Mode."
      );
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      abortController.abort();
      if (activeSocket) {
        try {
          activeSocket.close();
        } catch {
          // Ignore
        }
      }
      if (fallbackController) {
        fallbackController.cancel();
      }
    },
  };
}
