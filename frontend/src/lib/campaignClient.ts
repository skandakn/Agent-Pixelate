import {
  AgentEvent,
  AgentSender,
  BandDelegationEdge,
  BandParticipant,
  BandRoomState,
  BandSharedMemory,
  CampaignAssets,
  CampaignBrief,
  CampaignVideoAsset,
  ColorSwatch,
  ContextHandoffPayload,
  MetaAdVariant,
  PipelineStage,
  Platform,
  SocialPost,
  VideoAspectRatio,
  VideoShotStyle,
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
  onApprovalRequired?: () => void;
  onComplete: (assets: CampaignAssets) => void;
  onError: (message: string) => void;
}

export interface CampaignSessionController {
  cancel: () => void;
  resumeAfterApproval?: (note?: string) => void;
}

interface BackendVisualAsset {
  asset_id: string;
  title: string;
  platform: string;
  aspect_ratio?: string;
  prompt_used?: string;
  asset_url: string;
  mime_type?: string;
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
  if (value.includes("human")) return "You";
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

  const rawAssets = visual?.assets ?? [];
  const rawImageAssets = rawAssets.filter(
    (a) =>
      !(a.mime_type?.startsWith("video/") || a.asset_url.toLowerCase().endsWith(".mp4"))
  );
  const rawVideoAssets = rawAssets.filter(
    (a) =>
      a.mime_type?.startsWith("video/") || a.asset_url.toLowerCase().endsWith(".mp4")
  );

  const videos: CampaignVideoAsset[] = rawVideoAssets.map((asset, idx) => {
    const resolvedUrl = asset.asset_url.startsWith("http")
      ? asset.asset_url
      : `${apiBase}${asset.asset_url.startsWith("/") ? "" : "/"}${asset.asset_url}`;
    const ar: VideoAspectRatio = asset.aspect_ratio === "9:16" ? "9:16" : "16:9";
    const idLower = `${asset.asset_id} ${asset.title}`.toLowerCase();
    const style: VideoShotStyle = idLower.includes("kinetic")
      ? "kinetic_type"
      : idLower.includes("luxury")
        ? "luxury_editorial"
        : idLower.includes("pulse")
          ? "pulse_drop"
          : "obsidian_cinema";
    return {
      id: asset.asset_id || `${backend.campaign_id}-vid-${idx + 1}`,
      title: asset.title,
      videoUrl: resolvedUrl,
      aspectRatio: ar,
      shotStyle: style,
      durationSec: 10,
      promptSummary: asset.prompt_used || "Cinematic H.264 promo render",
    };
  });

  const creatives: VisualCreative[] =
    rawImageAssets.length > 0
      ? rawImageAssets.map((asset, idx) => {
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
              visual?.typography_direction ||
              "Balanced modular editorial layout with crisp negative space",
            artNote: visual?.creative_direction || fallback.artDirectionSummary,
            promptSummary:
              asset.prompt_used ||
              visual?.creative_direction ||
              fallback.artDirectionSummary,
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
    videos,
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

  const scheduleCopyPhase = (approvalNote?: string) => {
    if (approvalNote) {
      emit(
        "context_handoff",
        "You",
        "handoff",
        "Human Director Approved Visual Handoff",
        `Approved visual direction with guidance: "${approvalNote}". Delegating to @CopyAgent.`
      );
    }

    schedule(650, () => {
      emit(
        "copy_agent",
        "@CopyAgent",
        "thought",
        "Aligning Copy Hooks with Visual Motif",
        `Ingested @VisualAgent palette, hero motif, and shared BAND memories${approvalNote ? ` (including director note: "${approvalNote}")` : ""}. Drafting ${brief.platforms.join(" + ")} copy decks calibrated to "${brief.brandTone}" voice.`
      );
    });

    schedule(1600, () => {
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

    schedule(2250, () => {
      emit(
        "final_campaign",
        "Orchestrator",
        "complete",
        "Campaign Kit Assembled & Ready to Export",
        `All visual and copy assets synchronized for "${brief.productName}". Ready for clipboard copy or .JSON / .ZIP export.`
      );
      callbacks.onComplete(fullAssets);
    });
  };

  schedule(3000, () => {
    callbacks.onPartialAssets({
      handoff: fullAssets.handoff,
    });
    if (brief.requireHandoffApproval) {
      emit(
        "context_handoff",
        "@VisualAgent",
        "handoff",
        "Awaiting Human Director Approval",
        `Visual direction & color tokens saved to BAND Memory. Review and approve to delegate to @CopyAgent, or @mention @visual_pixelate for revisions.`,
        fullAssets.handoff ?? undefined
      );
      callbacks.onApprovalRequired?.();
      return;
    }

    emit(
      "context_handoff",
      "@VisualAgent",
      "handoff",
      "Structured Context Handoff → @CopyAgent",
      `Passing visual motif, palette hex tokens, and mood directives to @CopyAgent inside BAND Shared Room.`,
      fullAssets.handoff ?? undefined
    );
    scheduleCopyPhase();
  });

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    },
    resumeAfterApproval: (note?: string) => {
      if (cancelled) return;
      scheduleCopyPhase(note);
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
          videos: adapted.videos,
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

      if (detail.status === "awaiting_approval") {
        callbacks.onApprovalRequired?.();
      } else if (
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
          metadata: {
            require_handoff_approval: Boolean(brief.requireHandoffApproval),
          },
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
    resumeAfterApproval: (note?: string) => {
      fallbackController?.resumeAfterApproval?.(note);
    },
  };
}

export function buildDefaultBandRoomState(
  campaignId: string | null,
  brief: CampaignBrief,
  status: string,
  handoff: ContextHandoffPayload | null
): BandRoomState {
  const cid = campaignId || "room_preview";
  const roomId = `room_${cid}`;
  const visualStatus: BandParticipant["status"] =
    status === "running" && !handoff
      ? "working"
      : status === "awaiting_approval"
        ? "awaiting_approval"
        : "online";
  const copyStatus: BandParticipant["status"] =
    status === "running" && handoff
      ? "working"
      : status === "awaiting_approval"
        ? "idle"
        : "online";

  const participants: BandParticipant[] = [
    {
      handle: "@human_director",
      displayName: "Creative Director (You)",
      role: "Approvals & @mention Delegation",
      kind: "human",
      status: "online",
      framework: "BAND Human-in-the-Loop",
      skills: ["brief", "approval_gate", "revisions"],
      registeredRemote: true,
    },
    {
      handle: "@orchestrator_pixelate",
      displayName: "BAND Orchestrator",
      role: "Shared Room Router & Memory Sync",
      kind: "orchestrator",
      status: status === "running" ? "working" : "online",
      framework: "BAND Protocol + FastAPI",
      skills: ["room_routing", "shared_memory", "mp4_studio"],
      registeredRemote: false,
    },
    {
      handle: "@visual_pixelate",
      displayName: "Visual Pixelate",
      role: "Creative Director & Asset Synthesizer",
      kind: "agent",
      status: visualStatus,
      framework: "AdaL / AdalFlow + Imagen",
      skills: ["brand_visual_direction", "motion_video_direction"],
      registeredRemote: false,
    },
    {
      handle: "@copy_pixelate",
      displayName: "Copy Pixelate",
      role: "Conversion Copywriter & Social Strategist",
      kind: "agent",
      status: copyStatus,
      framework: "AdaL / AdalFlow + Finch Skills",
      skills: ["ad_copy_conversion", "social_platform_formatter"],
      registeredRemote: false,
    },
  ];

  const memories: BandSharedMemory[] = [];
  if (campaignId) {
    memories.push({
      memoryId: `mem_brief_${cid.slice(-6)}`,
      roomId,
      author: "@orchestrator_pixelate",
      key: "campaign_brief",
      content: `Brand: ${brief.productName} | Tone: ${brief.brandTone} | Audience: ${brief.targetAudience} | Channels: ${brief.platforms.join(", ")}`,
      pinned: true,
      bandSynced: true,
      createdAt: new Date().toISOString(),
    });
  }
  if (handoff) {
    memories.push({
      memoryId: `mem_vis_${cid.slice(-6)}`,
      roomId,
      author: "@visual_pixelate",
      key: "visual_brief",
      content: `Mood: ${handoff.dominantMood} | Motif: ${handoff.heroMotif} | Palette: ${handoff.paletteHexes.join(", ")}`,
      pinned: true,
      bandSynced: true,
      createdAt: new Date().toISOString(),
    });
  }

  const delegations: BandDelegationEdge[] = [];
  if (campaignId) {
    delegations.push({
      edgeId: `del_1_${cid.slice(-4)}`,
      fromHandle: "@orchestrator_pixelate",
      toHandle: "@visual_pixelate",
      reason: `Generate multi-aspect visual system for ${brief.productName}`,
      memoryId: memories[0]?.memoryId,
      status: handoff ? "completed" : "dispatched",
      timestamp: new Date().toISOString(),
    });
  }
  if (handoff) {
    delegations.push({
      edgeId: `del_2_${cid.slice(-4)}`,
      fromHandle: "@visual_pixelate",
      toHandle: "@copy_pixelate",
      reason:
        status === "awaiting_approval"
          ? "Awaiting Human Director approval before copy synthesis"
          : "Visual brief & hex palette handoff for platform copy",
      memoryId: memories[1]?.memoryId,
      status:
        status === "awaiting_approval"
          ? "awaiting_approval"
          : status === "completed"
            ? "completed"
            : "dispatched",
      timestamp: new Date().toISOString(),
    });
  }

  return {
    campaignId: cid,
    roomId,
    transport: "local_fallback",
    approvalRequired: Boolean(brief.requireHandoffApproval),
    pendingApproval: status === "awaiting_approval",
    participants,
    memories,
    delegations,
  };
}

export async function fetchBandRoomSnapshot(
  campaignId: string
): Promise<BandRoomState | null> {
  const { apiBase } = resolveBackendEndpoints();
  try {
    const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/band/room`);
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      campaign_id: string;
      room_id: string;
      transport: "band" | "local_fallback";
      approval_required: boolean;
      pending_approval: boolean;
      participants: Array<{
        handle: string;
        display_name: string;
        role: string;
        kind: "human" | "orchestrator" | "agent";
        status: BandParticipant["status"];
        framework: string;
        skills: string[];
        registered_remote: boolean;
      }>;
      memories: Array<{
        memory_id: string;
        room_id: string;
        author: string;
        key: string;
        content: string;
        metadata?: { pinned?: boolean; band_synced?: boolean };
        created_at: string;
      }>;
      delegations: Array<{
        edge_id: string;
        from_handle: string;
        to_handle: string;
        reason: string;
        memory_id?: string | null;
        status: BandDelegationEdge["status"];
        timestamp: string;
      }>;
    };

    return {
      campaignId: raw.campaign_id,
      roomId: raw.room_id,
      transport: raw.transport,
      approvalRequired: raw.approval_required,
      pendingApproval: raw.pending_approval,
      participants: raw.participants.map((p) => ({
        handle: p.handle,
        displayName: p.display_name,
        role: p.role,
        kind: p.kind,
        status: p.status,
        framework: p.framework,
        skills: p.skills,
        registeredRemote: p.registered_remote,
      })),
      memories: raw.memories.map((m) => ({
        memoryId: m.memory_id,
        roomId: m.room_id,
        author: m.author,
        key: m.key,
        content: m.content,
        pinned: Boolean(m.metadata?.pinned),
        bandSynced: Boolean(m.metadata?.band_synced || raw.transport === "band"),
        createdAt: m.created_at,
      })),
      delegations: raw.delegations.map((d) => ({
        edgeId: d.edge_id,
        fromHandle: d.from_handle,
        toHandle: d.to_handle,
        reason: d.reason,
        memoryId: d.memory_id,
        status: d.status,
        timestamp: d.timestamp,
      })),
    };
  } catch {
    return null;
  }
}

export async function sendBandRoomMessage(
  campaignId: string,
  message: string,
  senderName?: string
): Promise<boolean> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/band/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: "@human_director",
      sender_name: senderName || "Creative Director",
      message,
    }),
  });
  return res.ok;
}

export async function pinBandRoomMemory(
  campaignId: string,
  key: string,
  content: string
): Promise<BandSharedMemory | null> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/band/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: "@human_director",
      key,
      content,
      pinned: true,
    }),
  });
  if (!res.ok) return null;
  const raw = (await res.json()) as {
    memory_id: string;
    room_id: string;
    author: string;
    key: string;
    content: string;
    created_at: string;
  };
  return {
    memoryId: raw.memory_id,
    roomId: raw.room_id,
    author: raw.author,
    key: raw.key,
    content: raw.content,
    pinned: true,
    bandSynced: true,
    createdAt: raw.created_at,
  };
}

export async function approveBandHandoff(
  campaignId: string,
  approved: boolean,
  note?: string
): Promise<boolean> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(
    `${apiBase}/api/campaigns/${campaignId}/band/approve-handoff`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approver: "@human_director",
        approved,
        note: note?.trim() || null,
      }),
    }
  );
  return res.ok;
}

export async function requestCustomVideoCut(
  campaignId: string,
  aspectRatio: VideoAspectRatio,
  shotStyle: VideoShotStyle
): Promise<CampaignVideoAsset> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aspect_ratio: aspectRatio,
      shot_style: shotStyle,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Video render failed (HTTP ${res.status}): ${detail}`);
  }

  const asset = (await res.json()) as BackendVisualAsset;
  const resolvedUrl = asset.asset_url.startsWith("http")
    ? asset.asset_url
    : `${apiBase}${asset.asset_url.startsWith("/") ? "" : "/"}${asset.asset_url}`;

  return {
    id: asset.asset_id,
    title: asset.title,
    videoUrl: resolvedUrl,
    aspectRatio: asset.aspect_ratio === "9:16" ? "9:16" : "16:9",
    shotStyle,
    durationSec: 10,
    promptSummary: asset.prompt_used || "Cinematic H.264 MP4 render",
  };
}
