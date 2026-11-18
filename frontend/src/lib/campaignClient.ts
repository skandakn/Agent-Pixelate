import {
  AgentEvent,
  AgentSender,
  CampaignAssets,
  CampaignBrief,
  ColorSwatch,
  ContextHandoffPayload,
  MetaAdVariant,
  PipelineStage,
  Platform,
  SocialPost,
  VisualCreative,
} from "@/types/campaign";
import { buildSimulatedCampaignAssets } from "@/data/presets";

function resolveBackendEndpoints(): { apiBase: string; wsBase: string } {
  const envApi = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  const envWs = process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "");

  if (envApi) {
    const derivedWs =
      envWs ||
      envApi.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    return { apiBase: envApi, wsBase: derivedWs };
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin, host } = window.location;
    // In local Next.js dev mode (`localhost:3000`), default to FastAPI on `:8000`
    if (
      (hostname === "localhost" || hostname === "127.0.0.1") &&
      port === "3000"
    ) {
      return {
        apiBase: "http://localhost:8000",
        wsBase: envWs || "ws://localhost:8000",
      };
    }
    // Same-origin deployment (Render, Agent37, Docker single-service)
    const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
    return {
      apiBase: origin,
      wsBase: envWs || `${wsProtocol}//${host}`,
    };
  }

  return {
    apiBase: "http://localhost:8000",
    wsBase: envWs || "ws://localhost:8000",
  };
}

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

interface BackendVisualAsset {
  asset_id: string;
  title: string;
  platform: string;
  aspect_ratio?: string;
  prompt_used?: string;
  asset_url: string;
  color_tokens?: string[];
  alt_text?: string;
}

interface BackendVisualOutput {
  campaign_id: string;
  creative_direction: string;
  mood_keywords?: string[];
  color_palette?: string[];
  typography_direction?: string;
  visual_brief_markdown?: string;
  assets?: BackendVisualAsset[];
  band_memory_id?: string | null;
}

interface BackendPlatformCopy {
  platform: string;
  headline: string;
  subheadline?: string | null;
  body_copy: string;
  call_to_action: string;
  hashtags?: string[];
  linked_asset_id?: string | null;
}

interface BackendCopyOutput {
  campaign_id: string;
  campaign_tagline: string;
  brand_voice_summary: string;
  key_messages?: string[];
  platform_copies?: BackendPlatformCopy[];
  email_subject_lines?: string[];
}

interface BackendCampaignResponse {
  campaign_id: string;
  status: string;
  room_id: string;
  transport: string;
  visual_output?: BackendVisualOutput | null;
  copy_output?: BackendCopyOutput | null;
  error?: string | null;
  created_at?: string;
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatPlatformLabel(raw: string): Platform {
  const lower = raw.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("meta") || lower.includes("ad") || lower.includes("banner"))
    return "Meta Ads";
  return "Instagram";
}

function normalizeAspect(raw?: string): VisualCreative["aspectRatio"] {
  if (raw === "4:5" || raw === "16:9" || raw === "9:16" || raw === "1:1") {
    return raw;
  }
  if (raw?.includes("1.91")) return "16:9";
  return "1:1";
}

function mapBackendSender(raw?: string): AgentSender {
  const value = (raw || "").toLowerCase();
  if (value.includes("visual")) return "@VisualAgent";
  if (value.includes("copy")) return "@CopyAgent";
  if (value.includes("orchestrat")) return "Orchestrator";
  if (value.includes("band")) return "BAND Room";
  return "System";
}

function mapBackendStage(
  eventType: string,
  sender: string,
  mentions: string[]
): PipelineStage {
  const et = eventType.toLowerCase();
  const s = sender.toLowerCase();
  const m = mentions.map((x) => x.toLowerCase());

  if (et === "campaign_created") return "user_brief";
  if (et === "room_initialized" || et === "agent_registered") return "band_room";
  if (et === "campaign_completed") return "final_campaign";
  if (et === "copy_completed") return "copy_agent";
  if (et === "visual_completed" || et === "asset_generated") return "visual_agent";
  if (et === "memory_stored" && s.includes("visual")) return "context_handoff";
  if (et === "agent_mention" && m.some((x) => x.includes("copy"))) {
    return "context_handoff";
  }
  if (et === "agent_mention" && m.some((x) => x.includes("visual"))) {
    return "band_room";
  }
  if (s.includes("copy")) return "copy_agent";
  if (s.includes("visual")) return "visual_agent";
  return "band_room";
}

function mapBackendEventTitle(eventType: string, sender: AgentSender): string {
  switch (eventType.toLowerCase()) {
    case "campaign_created":
      return "Campaign Brief Ingested";
    case "room_initialized":
      return "BAND Shared Room Initialized";
    case "memory_stored":
      return sender === "@VisualAgent"
        ? "Visual Brief Stored in BAND Memory"
        : "Campaign Context Stored in Memory";
    case "agent_mention":
      return sender === "@VisualAgent"
        ? "Context Handoff → @CopyAgent"
        : "Orchestrator Dispatched @VisualAgent";
    case "agent_started":
      return `${sender} Started Execution`;
    case "agent_thinking":
      return `${sender} Reasoning`;
    case "asset_generated":
      return "Visual Creative Rendered";
    case "visual_completed":
      return "@VisualAgent Completed Visual Suite";
    case "copy_completed":
      return "@CopyAgent Completed Copy Deck";
    case "campaign_completed":
      return "Campaign Kit Assembled & Persisted";
    case "agent_error":
      return "Agent Pipeline Error";
    default:
      return `${sender} Update`;
  }
}

function adaptBackendCampaignToAssets(
  backend: BackendCampaignResponse,
  brief: CampaignBrief,
  apiBase: string
): CampaignAssets {
  const fallback = buildSimulatedCampaignAssets(brief, backend.campaign_id);
  const visual = backend.visual_output;
  const copy = backend.copy_output;

  const paletteHexes =
    visual?.color_palette && visual.color_palette.length > 0
      ? visual.color_palette
      : fallback.palette.map((p) => p.hex);

  const swatchRoles = [
    "Primary Ground",
    "Hero Accent",
    "Secondary Highlight",
    "Typography Contrast",
    "Telemetry Glow",
  ];
  const palette: ColorSwatch[] = paletteHexes.slice(0, 5).map((hex, idx) => ({
    name: fallback.palette[idx]?.name ?? `Token 0${idx + 1}`,
    hex,
    role: swatchRoles[idx] ?? "Brand Accent",
  }));

  const creatives: VisualCreative[] =
    visual?.assets && visual.assets.length > 0
      ? visual.assets.map((asset, idx) => {
          const resolvedUrl = asset.asset_url.startsWith("http")
            ? asset.asset_url
            : `${apiBase}${asset.asset_url.startsWith("/") ? "" : "/"}${asset.asset_url}`;
          const platform = formatPlatformLabel(asset.platform);
          return {
            id: asset.asset_id || `${backend.campaign_id}-vis-${idx + 1}`,
            title: asset.title,
            subtitle: `${platform} Concept · Persisted Campaign Asset`,
            format: `${asset.aspect_ratio || "1:1"} Studio Render`,
            aspectRatio: normalizeAspect(asset.aspect_ratio),
            platform,
            imageUrl: resolvedUrl,
            lighting:
              fallback.creatives[idx % fallback.creatives.length]?.lighting ??
              "Studio dual-axis rim lighting",
            composition:
              visual.typography_direction ||
              "Balanced modular editorial layout with crisp negative space",
            artNote: visual.creative_direction,
            promptSummary: asset.prompt_used || visual.creative_direction,
          };
        })
      : fallback.creatives;

  const handoff: ContextHandoffPayload | null = visual
    ? {
        fromAgent: "@VisualAgent",
        toAgent: "@CopyAgent",
        visualConcept: visual.creative_direction,
        dominantMood:
          (visual.mood_keywords && visual.mood_keywords.join(" · ")) ||
          `${brief.brandTone} · Editorial`,
        paletteHexes,
        heroMotif:
          visual.typography_direction ||
          `${brief.productName} hero studio lockup`,
        messagingDirectives: [
          visual.creative_direction,
          `Band Memory ID: ${visual.band_memory_id || "room_shared_context"}`,
        ],
      }
    : fallback.handoff;

  const socialPosts: SocialPost[] = [];
  const metaAds: MetaAdVariant[] = [];
  const collectedHashtags = new Set<string>();

  if (copy?.platform_copies && copy.platform_copies.length > 0) {
    copy.platform_copies.forEach((pc, idx) => {
      const pLower = pc.platform.toLowerCase();
      (pc.hashtags || []).forEach((h) =>
        collectedHashtags.add(h.startsWith("#") ? h : `#${h}`)
      );

      if (pLower.includes("meta") || pLower.includes("ad") || pLower.includes("banner")) {
        const cleanDomain =
          brief.productName.toLowerCase().replace(/[^a-z0-9]/g, "") ||
          "agentpixelate";
        metaAds.push({
          id: `${backend.campaign_id}-meta-${idx + 1}`,
          angle: pc.subheadline || "Direct Response Conversion",
          headline: pc.headline,
          primaryText: pc.body_copy,
          description: copy.campaign_tagline,
          ctaLabel: pc.call_to_action || "Shop Now",
          displayUrl: `${cleanDomain}.com/launch`,
          creativeIndex: idx % Math.max(1, creatives.length),
        });
      } else {
        const mappedPlatform: "Instagram" | "LinkedIn" = pLower.includes("linkedin")
          ? "LinkedIn"
          : "Instagram";
        socialPosts.push({
          id: `${backend.campaign_id}-post-${idx + 1}`,
          platform: mappedPlatform,
          variantLabel: `${mappedPlatform} Launch Copy`,
          hook: pc.headline,
          body: pc.body_copy,
          callToAction: pc.call_to_action,
          bestTimeToPost:
            mappedPlatform === "LinkedIn"
              ? "Tue – Thu · 8:45 AM local"
              : "Tue & Thu · 6:30 PM local",
          estimatedEngagement:
            mappedPlatform === "LinkedIn" ? "4.9% CTR" : "7.2% ER",
        });
      }
    });
  }

  // Ensure every tab has crisp, aligned content even if only subset of platforms was chosen
  const finalSocialPosts =
    socialPosts.length > 0 ? socialPosts : fallback.socialPosts;
  const finalMetaAds = metaAds.length > 0 ? metaAds : fallback.metaAds;
  const finalHashtags =
    collectedHashtags.size > 0
      ? Array.from(collectedHashtags)
      : fallback.hashtags;

  return {
    campaignId: backend.campaign_id,
    generatedAt: backend.created_at || new Date().toISOString(),
    brief,
    artDirectionSummary:
      visual?.creative_direction || fallback.artDirectionSummary,
    palette,
    creatives,
    storyboard: fallback.storyboard.map((frame, i) => ({
      ...frame,
      accentHex: paletteHexes[1] ?? frame.accentHex,
      secondaryHex: paletteHexes[2] ?? frame.secondaryHex,
      captionOverlay:
        i === 0 && copy?.campaign_tagline
          ? copy.campaign_tagline.toUpperCase()
          : frame.captionOverlay,
    })),
    handoff,
    socialPosts: finalSocialPosts,
    metaAds: finalMetaAds,
    hashtags: finalHashtags,
  };
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

  schedule(650, () => {
    emit(
      "band_room",
      "BAND Room",
      "status",
      "Shared Agent Room Initialized",
      `Opened BAND session ${campaignId}. Subscribed @VisualAgent and @CopyAgent to shared creative memory bus.`
    );
  });

  schedule(1350, () => {
    emit(
      "visual_agent",
      "@VisualAgent",
      "thought",
      "Art Direction & Color Grading",
      `Synthesizing ${brief.brandTone.toLowerCase()} lighting cues for ${brief.targetAudience}. Selecting 5-token palette anchored by ${fullAssets.palette[1]?.hex ?? "#8B5CF6"} & ${fullAssets.palette[2]?.hex ?? "#06B6D4"}.`
    );
  });

  schedule(2200, () => {
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

  schedule(3000, () => {
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

  schedule(3850, () => {
    emit(
      "copy_agent",
      "@CopyAgent",
      "thought",
      "Aligning Copy Hooks with Visual Motif",
      `Ingested @VisualAgent palette & hero motif. Drafting high-converting ${brief.platforms.join(" + ")} copy decks calibrated to "${brief.brandTone}" voice.`
    );
  });

  schedule(4700, () => {
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

  schedule(5350, () => {
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

  const { apiBase, wsBase } = resolveBackendEndpoints();
  let activeSocket: WebSocket | null = null;
  let fallbackController: CampaignSessionController | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;
  let completed = false;
  const abortController = new AbortController();

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const triggerFallback = (reason: string) => {
    if (cancelled || fallbackController || completed) return;
    stopPolling();
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

  const hydrateFromBackend = async (
    campaignId: string,
    finalizeIfDone: boolean
  ) => {
    if (cancelled || completed) return;
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}`);
      if (!res.ok) return;
      const detail = (await res.json()) as BackendCampaignResponse;
      const adapted = adaptBackendCampaignToAssets(detail, brief, apiBase);

      if (detail.visual_output) {
        callbacks.onPartialAssets({
          campaignId: adapted.campaignId,
          generatedAt: adapted.generatedAt,
          brief: adapted.brief,
          artDirectionSummary: adapted.artDirectionSummary,
          palette: adapted.palette,
          creatives: adapted.creatives,
          storyboard: adapted.storyboard,
          handoff: adapted.handoff,
        });
      }

      if (detail.copy_output) {
        callbacks.onPartialAssets({
          socialPosts: adapted.socialPosts,
          metaAds: adapted.metaAds,
          hashtags: adapted.hashtags,
        });
      }

      if (
        finalizeIfDone &&
        (detail.status === "completed" ||
          (detail.visual_output && detail.copy_output))
      ) {
        completed = true;
        stopPolling();
        if (activeSocket) {
          try {
            activeSocket.close();
          } catch {
            // Ignore
          }
        }
        callbacks.onComplete(adapted);
      } else if (detail.status === "failed") {
        stopPolling();
        callbacks.onError(detail.error || "Campaign execution failed.");
      }
    } catch {
      // Transient fetch failure; WS or next poll will retry
    }
  };

  (async () => {
    try {
      const timeout = setTimeout(() => abortController.abort(), 12000);
      const response = await fetch(`${apiBase}/api/campaigns/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          brand_name: brief.productName.trim(),
          product_description:
            brief.productDescription.trim().length >= 5
              ? brief.productDescription.trim()
              : `${brief.productName.trim()} marketing campaign`,
          target_audience:
            brief.targetAudience.trim().length >= 2
              ? brief.targetAudience.trim()
              : "Modern digital consumers",
          brand_tone: brief.brandTone,
          platforms: brief.platforms.map((p) =>
            p.toLowerCase().replace(/\s+/g, "_")
          ),
          num_concepts: 3,
        }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        triggerFallback(
          `Backend returned HTTP ${response.status} — switched to Mock Studio Mode.`
        );
        return;
      }

      const data = (await response.json()) as {
        campaign_id?: string;
        ws_url?: string;
      };
      const campaignId = data.campaign_id;
      if (!campaignId) {
        triggerFallback(
          "Backend response missing campaign_id — switched to Mock Studio Mode."
        );
        return;
      }

      if (cancelled) return;
      callbacks.onCampaignId(campaignId);
      callbacks.onModeResolved("live");

      callbacks.onEvent({
        id: makeId("evt"),
        campaignId,
        timestamp: new Date().toISOString(),
        stage: "user_brief",
        sender: "System",
        type: "status",
        title: "Campaign Brief Dispatched",
        message: `Submitted "${brief.productName}" to Agent Pixelate Orchestrator (${campaignId}).`,
      });

      const wsTarget = data.ws_url?.startsWith("ws")
        ? data.ws_url
        : `${wsBase}${data.ws_url || `/ws/campaign/${campaignId}`}`;

      const ws = new WebSocket(wsTarget);
      activeSocket = ws;

      const seenEventIds = new Set<string>();
      let wsConnected = false;

      // Safety background poll so completion is guaranteed even if proxy drops WS
      pollInterval = setInterval(() => {
        void hydrateFromBackend(campaignId, true);
      }, 2000);

      ws.onopen = () => {
        wsConnected = true;
      };

      ws.onmessage = (msg) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(msg.data as string) as Record<
            string,
            unknown
          >;
          const eventTypeRaw = String(
            parsed.event_type || parsed.type || "agent_thinking"
          );
          if (eventTypeRaw === "heartbeat" || eventTypeRaw === "pong") {
            return;
          }

          const eventId = String(parsed.event_id || parsed.id || makeId("evt"));
          if (seenEventIds.has(eventId)) return;
          seenEventIds.add(eventId);

          const senderRaw = String(parsed.sender || parsed.agent || "system");
          const mentions = Array.isArray(parsed.mentions)
            ? parsed.mentions.map(String)
            : [];

          const sender = mapBackendSender(senderRaw);
          const stage = mapBackendStage(eventTypeRaw, senderRaw, mentions);

          const uiType: AgentEvent["type"] =
            stage === "context_handoff"
              ? "handoff"
              : eventTypeRaw === "campaign_completed"
                ? "complete"
                : eventTypeRaw === "agent_error"
                  ? "error"
                  : eventTypeRaw === "asset_generated" ||
                      eventTypeRaw === "visual_completed" ||
                      eventTypeRaw === "copy_completed"
                    ? "asset_ready"
                    : eventTypeRaw === "agent_thinking"
                      ? "thought"
                      : "status";

          callbacks.onEvent({
            id: eventId,
            campaignId,
            timestamp: String(parsed.timestamp || new Date().toISOString()),
            stage,
            sender,
            type: uiType,
            title: mapBackendEventTitle(eventTypeRaw, sender),
            message: String(
              parsed.message ||
                parsed.thought ||
                "Processing multi-agent step..."
            ),
          });

          if (
            eventTypeRaw === "asset_generated" ||
            eventTypeRaw === "visual_completed" ||
            eventTypeRaw === "copy_completed"
          ) {
            void hydrateFromBackend(campaignId, false);
          }

          if (eventTypeRaw === "campaign_completed") {
            void hydrateFromBackend(campaignId, true);
          }

          if (eventTypeRaw === "agent_error") {
            stopPolling();
            callbacks.onError(String(parsed.message || "Agent execution error"));
          }
        } catch {
          // Ignore non-JSON frames
        }
      };

      ws.onerror = () => {
        // Keep REST polling active; if campaign already started on backend, polling will hydrate it!
        if (!wsConnected && !completed) {
          void hydrateFromBackend(campaignId, true);
        }
      };

      ws.onclose = () => {
        if (!completed && !cancelled) {
          void hydrateFromBackend(campaignId, true);
        }
      };
    } catch {
      triggerFallback(
        "Orchestrator API unreachable — running seamless Mock Studio Mode."
      );
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      stopPolling();
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
