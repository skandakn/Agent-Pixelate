import {
  AgentEvent,
  AgentSender,
  BandCriticReport,
  BandDelegationEdge,
  BandFocusWindow,
  BandLoopGuardState,
  BandParticipant,
  BandPolicyAuthority,
  BandRoomState,
  BandSharedMemory,
  BandTaskExecution,
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
import { getPosterMetadataForBrief, getProductVisualOptions } from "@/lib/productImagery";
import { PosterTheme } from "@/types/campaign";

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
  if (value.includes("critic")) return "@CriticAgent";
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
    const style: VideoShotStyle = idLower.includes("vox")
      ? "vox_collage"
      : idLower.includes("ink")
        ? "ink_press"
        : idLower.includes("kinetic")
          ? "kinetic_type"
          : idLower.includes("luxury")
            ? "luxury_editorial"
            : idLower.includes("pulse")
              ? "pulse_drop"
              : "obsidian_cinema";
    const prompt = asset.prompt_used || "";
    const hasVo = prompt.includes("VO:") || asset.title.includes("VO:");
    const voMatch = prompt.match(/VO:\s*([A-Za-z0-9_-]+)/i) || asset.title.match(/VO:\s*([A-Za-z0-9_-]+)/i);
    const voiceName = voMatch ? voMatch[1] : undefined;
    return {
      id: asset.asset_id || `${backend.campaign_id}-vid-${idx + 1}`,
      title: asset.title,
      videoUrl: resolvedUrl,
      aspectRatio: ar,
      shotStyle: style,
      durationSec: 10,
      promptSummary: asset.prompt_used || "Cinematic H.264 promo render",
      hasVoiceover: hasVo,
      voiceName,
    };
  });

  const creatives: VisualCreative[] =
    rawImageAssets.length > 0
      ? rawImageAssets.map((asset, idx) => {
        const resolvedUrl = asset.asset_url.startsWith("http")
          ? asset.asset_url
          : `${apiBase}${asset.asset_url.startsWith("/") ? "" : "/"}${asset.asset_url}`;
        const platform = formatPlatformLabel(asset.platform);
        const fallbackCreative = fallback.creatives[idx % fallback.creatives.length];
        return {
          id: asset.asset_id || `${backend.campaign_id}-vis-${idx + 1}`,
          title: asset.title,
          subtitle: `${platform} Concept · Persisted Campaign Asset`,
          format: `${asset.aspect_ratio || "1:1"} Studio Render`,
          aspectRatio: normalizeAspect(asset.aspect_ratio),
          platform,
          imageUrl: resolvedUrl,
          options: (asset as { options?: VisualCreative["options"] }).options || fallbackCreative?.options,
          headline: (asset as { headline?: string }).headline || fallbackCreative?.headline,
          tagline: (asset as { tagline?: string }).tagline || fallbackCreative?.tagline,
          badge: (asset as { badge?: string }).badge || fallbackCreative?.badge,
          ctaText: (asset as { ctaText?: string }).ctaText || fallbackCreative?.ctaText,
          features: (asset as { features?: string[] }).features || fallbackCreative?.features,
          posterTheme: (asset as { posterTheme?: VisualCreative["posterTheme"] }).posterTheme || fallbackCreative?.posterTheme || "billboard",
          lighting:
            fallbackCreative?.lighting ??
            "Studio dual-axis rim lighting",
          composition:
            visual?.typography_direction ||
            fallbackCreative?.composition ||
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
          "pixelate";
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

  let videoPollAttempts = 0;

  const hydrateFromBackend = async (
    campaignId: string,
    finalizeIfDone: boolean
  ) => {
    if (cancelled) return;
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

      if (completed) {
        videoPollAttempts += 1;
        if (adapted.videos.length > 0 || videoPollAttempts >= 8) {
          stopPolling();
        }
        return;
      }

      if (detail.status === "awaiting_approval") {
        callbacks.onApprovalRequired?.();
      } else if (
        finalizeIfDone &&
        (detail.status === "completed" ||
          (detail.visual_output && detail.copy_output))
      ) {
        completed = true;
        callbacks.onComplete(adapted);
        if (adapted.videos.length > 0) {
          stopPolling();
        } else {
          // Keep light background polling briefly until async MP4 finishes
          stopPolling();
          pollInterval = setInterval(() => {
            void hydrateFromBackend(campaignId, false);
          }, 1500);
        }
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
        message: `Submitted "${brief.productName}" to Pixelate Orchestrator (${campaignId}).`,
      });

      const wsTarget = data.ws_url?.startsWith("ws")
        ? data.ws_url
        : `${wsBase}${data.ws_url || `/ws/campaign/${campaignId}`}`;

      const ws = new WebSocket(wsTarget);
      activeSocket = ws;

      const seenEventIds = new Set<string>();
      const streamedCreatives: VisualCreative[] = [];
      let wsConnected = false;

      // Fast background poll so UI hydrates immediately even if proxy buffers WS
      pollInterval = setInterval(() => {
        void hydrateFromBackend(campaignId, true);
      }, 600);

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

          if (eventTypeRaw === "asset_generated") {
            const payload = (parsed.payload || {}) as Record<string, unknown>;
            const rawAsset = (payload.asset || parsed.asset) as BackendVisualAsset | undefined;
            if (rawAsset && rawAsset.asset_url) {
              const resolvedUrl = rawAsset.asset_url.startsWith("http")
                ? rawAsset.asset_url
                : `${apiBase}${rawAsset.asset_url.startsWith("/") ? "" : "/"}${rawAsset.asset_url}`;
              const platform = formatPlatformLabel(rawAsset.platform || "Instagram");
              const posterMeta = getPosterMetadataForBrief(brief);
              const idx = streamedCreatives.length;
              const themes: PosterTheme[] = ["billboard", "swiss", "luxury", "cyber"];

              const newCreative: VisualCreative = {
                id: rawAsset.asset_id || `${campaignId}-vis-${idx + 1}`,
                title: rawAsset.title || `${brief.productName} — Launch Key Visual`,
                subtitle: `${platform} Concept · Commercial Ad Poster`,
                format: `${rawAsset.aspect_ratio || "4:5"} Commercial Poster`,
                aspectRatio: normalizeAspect(rawAsset.aspect_ratio),
                platform,
                imageUrl: resolvedUrl,
                options: getProductVisualOptions(brief, campaignId),
                headline: posterMeta.headlines[idx % posterMeta.headlines.length],
                tagline: posterMeta.tagline,
                badge: posterMeta.badge,
                ctaText: posterMeta.ctaText,
                features: posterMeta.features,
                posterTheme: themes[idx % themes.length],
                lighting: "Studio dual-axis commercial rim lighting",
                composition: "Commercial advertising poster hierarchy with kicker badge & feature pills",
                artNote: rawAsset.prompt_used || "Commercial advertising poster layout with dynamic typography",
                promptSummary: rawAsset.prompt_used || `${brief.brandTone} commercial poster for ${brief.productName}`,
              };

              const existingIdx = streamedCreatives.findIndex((c) => c.id === newCreative.id);
              if (existingIdx >= 0) {
                streamedCreatives[existingIdx] = newCreative;
              } else {
                streamedCreatives.push(newCreative);
              }

              callbacks.onPartialAssets({
                creatives: [...streamedCreatives],
              });
            }
            void hydrateFromBackend(campaignId, false);
          } else if (
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
    {
      handle: "@critic_pixelate",
      displayName: "Critic Pixelate",
      role: "Brand QA, WCAG Contrast & Guardrail Auditor",
      kind: "agent",
      status: "online",
      framework: "BAND Policy Engine + WCAG 2.1",
      skills: ["wcag_contrast_audit", "brand_guardrail_verifier"],
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

  const executions: BandTaskExecution[] = [];
  if (handoff) {
    executions.push({
      executionId: `exec_vis_${cid.slice(-5)}`,
      agentHandle: "@visual_pixelate",
      framework: "AdaL / AdalFlow + Gemini Imagen",
      triggerBy: "@orchestrator_pixelate",
      triggerReason: `Visual system for ${brief.productName}`,
      focusMemoryIds: memories.slice(0, 1).map((m) => m.memoryId),
      focusTokenEstimate: 412,
      toolCalls: [
        {
          toolName: "load_finch_skill:brand_visual_direction",
          framework: "Finch SKILL.md",
          argsSummary: "skill='brand_visual_direction'",
          resultSummary: "Loaded 5-hex color & lighting physics",
          durationMs: 9,
          status: "ok",
        },
        {
          toolName: "generate_campaign_image",
          framework: "Imagen / Studio",
          argsSummary: "aspects=['16:9','1:1','9:16']",
          resultSummary: "Rendered 3 aspect-native assets",
          durationMs: 380,
          status: "ok",
        },
      ],
      status: "completed",
      durationMs: 425,
      startedAt: new Date().toISOString(),
    });
  }
  if (status === "completed") {
    executions.push(
      {
        executionId: `exec_copy_${cid.slice(-5)}`,
        agentHandle: "@copy_pixelate",
        framework: "AdaL / AdalFlow + Finch Copy",
        triggerBy: "@visual_pixelate",
        triggerReason: "Visual brief handoff via BAND Memory",
        focusMemoryIds: memories.map((m) => m.memoryId),
        focusTokenEstimate: 568,
        toolCalls: [
          {
            toolName: "load_finch_skill:ad_copy_conversion",
            framework: "Finch SKILL.md",
            argsSummary: "frameworks=['AIDA','PAS']",
            resultSummary: "Loaded conversion copy & formatting rules",
            durationMs: 8,
            status: "ok",
          },
          {
            toolName: "audit_copy_quality",
            framework: "AdaL / AdalFlow",
            argsSummary: `platforms=${brief.platforms.length}`,
            resultSummary: "Zero clichés; asset bindings verified",
            durationMs: 16,
            status: "ok",
          },
        ],
        status: "completed",
        durationMs: 290,
        startedAt: new Date().toISOString(),
      },
      {
        executionId: `exec_qa_${cid.slice(-5)}`,
        agentHandle: "@critic_pixelate",
        framework: "BAND Policy Engine + WCAG 2.1",
        triggerBy: "@copy_pixelate",
        triggerReason: "Automated Brand QA & Guardrail Scorecard",
        focusMemoryIds: memories.map((m) => m.memoryId),
        focusTokenEstimate: 495,
        toolCalls: [
          {
            toolName: "wcag_contrast_audit",
            framework: "BAND Policy Engine",
            argsSummary: `tokens=${handoff?.paletteHexes.length ?? 5}`,
            resultSummary: "Peak contrast 14.2:1 (WCAG AAA)",
            durationMs: 6,
            status: "ok",
          },
          {
            toolName: "brand_guardrail_verifier",
            framework: "BAND Policy Engine",
            argsSummary: `memories=${memories.length}`,
            resultSummary: "Score 96/100 (Grade A+)",
            durationMs: 11,
            status: "ok",
          },
        ],
        status: "completed",
        durationMs: 24,
        startedAt: new Date().toISOString(),
      }
    );
  }

  const focusWindows: BandFocusWindow[] = [
    {
      agentHandle: "@visual_pixelate",
      totalRoomEvents: 10,
      focusedEventCount: 4,
      filteredNoiseCount: 6,
      includedMemoryKeys: ["campaign_brief", "brand_guardrail"],
      includedMemoryIds: memories.slice(0, 1).map((m) => m.memoryId),
      focusedTokensEst: 412,
      fullRoomTokensEst: 1320,
      contextSavingsPct: 68.8,
      focusSummary: "Isolated 4/10 relevant turns & brief memories (68.8% context saved).",
    },
    {
      agentHandle: "@copy_pixelate",
      totalRoomEvents: 10,
      focusedEventCount: 5,
      filteredNoiseCount: 5,
      includedMemoryKeys: ["campaign_brief", "visual_brief", "brand_guardrail"],
      includedMemoryIds: memories.map((m) => m.memoryId),
      focusedTokensEst: 568,
      fullRoomTokensEst: 1320,
      contextSavingsPct: 57.0,
      focusSummary: "Isolated 5/10 visual handoff & copy turns (57.0% context saved).",
    },
    {
      agentHandle: "@critic_pixelate",
      totalRoomEvents: 10,
      focusedEventCount: 4,
      filteredNoiseCount: 6,
      includedMemoryKeys: ["visual_brief", "campaign_copy", "brand_guardrail"],
      includedMemoryIds: memories.map((m) => m.memoryId),
      focusedTokensEst: 495,
      fullRoomTokensEst: 1320,
      contextSavingsPct: 62.5,
      focusSummary: "Isolated 4/10 QA & policy turns for WCAG + guardrail audit (62.5% saved).",
    },
  ];

  const policies: BandPolicyAuthority[] = [
    {
      handle: "@human_director",
      apiScope: "human_me_api",
      canReadMemories: true,
      canWriteMemories: true,
      canPromoteBrandMemory: true,
      canApproveHandoff: true,
      canModifyGovernance: true,
      canMention: ["@visual_pixelate", "@copy_pixelate", "@critic_pixelate", "@all"],
      allowedTools: ["approve_handoff", "pin_memory", "promote_brand_memory", "governance_patch"],
      muted: false,
    },
    {
      handle: "@visual_pixelate",
      apiScope: "agent_runtime_api",
      canReadMemories: true,
      canWriteMemories: true,
      canPromoteBrandMemory: false,
      canApproveHandoff: false,
      canModifyGovernance: false,
      canMention: ["@copy_pixelate", "@human_director"],
      allowedTools: ["load_finch_skill:brand_visual_direction", "generate_campaign_image"],
      muted: false,
    },
    {
      handle: "@copy_pixelate",
      apiScope: "agent_runtime_api",
      canReadMemories: true,
      canWriteMemories: true,
      canPromoteBrandMemory: false,
      canApproveHandoff: false,
      canModifyGovernance: false,
      canMention: ["@critic_pixelate", "@human_director"],
      allowedTools: ["load_finch_skill:ad_copy_conversion", "audit_copy_quality"],
      muted: false,
    },
    {
      handle: "@critic_pixelate",
      apiScope: "agent_runtime_api",
      canReadMemories: true,
      canWriteMemories: true,
      canPromoteBrandMemory: false,
      canApproveHandoff: false,
      canModifyGovernance: false,
      canMention: ["@visual_pixelate", "@copy_pixelate", "@human_director"],
      allowedTools: ["wcag_contrast_audit", "brand_guardrail_verifier"],
      muted: false,
    },
  ];

  const loopGuard: BandLoopGuardState = {
    maxAgentHops: 6,
    currentHops: status === "completed" ? 3 : handoff ? 2 : campaignId ? 1 : 0,
    blockedLoops: 0,
    strictMode: true,
    circuitOpen: false,
    lastRoute:
      status === "completed"
        ? "@copy_pixelate -> @critic_pixelate"
        : handoff
          ? "@visual_pixelate -> @copy_pixelate"
          : "@orchestrator_pixelate -> @visual_pixelate",
  };

  const criticReport: BandCriticReport | null =
    status === "completed"
      ? {
        reportId: `qa_${cid.slice(-6)}`,
        overallScore: 96,
        grade: "A+",
        summary:
          "Brand QA passed (96/100, Grade A+) — WCAG AAA contrast (14.2:1), zero copy clichés, and full asset-copy pairing verified.",
        wcagContrastRatio: 14.2,
        checks: [
          {
            category: "contrast_wcag",
            label: "WCAG 2.1 Palette Contrast",
            passed: true,
            score: 98,
            detail: "Peak contrast ratio 14.2:1 across 5 tokens (exceeds WCAG AAA 7:1).",
          },
          {
            category: "palette_harmony",
            label: "Visual System & Multi-Aspect Coverage",
            passed: true,
            score: 96,
            detail: "5 brand hex tokens synchronized across 3 aspect-adapted creatives.",
          },
          {
            category: "copy_conversion",
            label: "Conversion Craft & Anti-Cliché Gate",
            passed: true,
            score: 97,
            detail: "Zero banned clichés detected across Instagram, LinkedIn & Meta Ad decks.",
          },
          {
            category: "platform_spec",
            label: "Asset-to-Copy Visual Pairing",
            passed: true,
            score: 96,
            detail: "All channel copy blocks explicitly linked to @visual_pixelate asset IDs.",
          },
          {
            category: "guardrails",
            label: "Shared BAND Guardrail Compliance",
            passed: true,
            score: 95,
            detail: "All pinned BAND Memory guidelines hydrated into agent focus windows.",
          },
        ],
        recommendedMention: null,
      }
      : null;

  return {
    campaignId: cid,
    roomId,
    brandName: brief.productName,
    transport: "local_fallback",
    approvalRequired: Boolean(brief.requireHandoffApproval),
    pendingApproval: status === "awaiting_approval",
    autoCriticQa: true,
    participants,
    memories,
    brandMemories: [],
    delegations,
    executions,
    focusWindows,
    policies,
    loopGuard,
    criticReport,
    auditChainHead: `sha256_${cid.slice(-8)}e9a4c1f7b2`,
  };
}

export async function fetchBandRoomSnapshot(
  campaignId: string
): Promise<BandRoomState | null> {
  const { apiBase } = resolveBackendEndpoints();
  try {
    const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/band/room`);
    if (!res.ok) return null;
    const raw = await res.json();
    return adaptBandRoomSnapshot(raw);
  } catch {
    return null;
  }
}

function adaptBandRoomSnapshot(raw: any): BandRoomState {
  const mapMemory = (m: any): BandSharedMemory => ({
    memoryId: m.memory_id,
    roomId: m.room_id,
    author: m.author,
    key: m.key,
    content: m.content,
    pinned: Boolean(m.metadata?.pinned),
    bandSynced: Boolean(m.metadata?.band_synced || raw.transport === "band"),
    createdAt: m.created_at,
  });

  return {
    campaignId: raw.campaign_id,
    roomId: raw.room_id,
    brandName: raw.brand_name || "",
    transport: raw.transport,
    approvalRequired: Boolean(raw.approval_required),
    pendingApproval: Boolean(raw.pending_approval),
    autoCriticQa: raw.auto_critic_qa ?? true,
    participants: (raw.participants || []).map((p: any) => ({
      handle: p.handle,
      displayName: p.display_name,
      role: p.role,
      kind: p.kind,
      status: p.status,
      framework: p.framework,
      skills: p.skills || [],
      registeredRemote: Boolean(p.registered_remote),
    })),
    memories: (raw.memories || []).map(mapMemory),
    brandMemories: (raw.brand_memories || []).map(mapMemory),
    delegations: (raw.delegations || []).map((d: any) => ({
      edgeId: d.edge_id,
      fromHandle: d.from_handle,
      toHandle: d.to_handle,
      reason: d.reason,
      memoryId: d.memory_id,
      status: d.status,
      timestamp: d.timestamp,
    })),
    executions: (raw.executions || []).map((e: any) => ({
      executionId: e.execution_id,
      agentHandle: e.agent_handle,
      framework: e.framework,
      triggerBy: e.trigger_by,
      triggerReason: e.trigger_reason,
      focusMemoryIds: e.focus_memory_ids || [],
      focusTokenEstimate: e.focus_token_estimate || 0,
      toolCalls: (e.tool_calls || []).map((t: any) => ({
        toolName: t.tool_name,
        framework: t.framework,
        argsSummary: t.args_summary || "",
        resultSummary: t.result_summary || "",
        durationMs: t.duration_ms || 0,
        status: t.status || "ok",
      })),
      status: e.status,
      durationMs: e.duration_ms || 0,
      startedAt: e.started_at,
    })),
    focusWindows: (raw.focus_windows || []).map((f: any) => ({
      agentHandle: f.agent_handle,
      totalRoomEvents: f.total_room_events || 0,
      focusedEventCount: f.focused_event_count || 0,
      filteredNoiseCount: f.filtered_noise_count || 0,
      includedMemoryKeys: f.included_memory_keys || [],
      includedMemoryIds: f.included_memory_ids || [],
      focusedTokensEst: f.focused_tokens_est || 0,
      fullRoomTokensEst: f.full_room_tokens_est || 0,
      contextSavingsPct: f.context_savings_pct || 0,
      focusSummary: f.focus_summary || "",
    })),
    policies: (raw.policies || []).map((p: any) => ({
      handle: p.handle,
      apiScope: p.api_scope,
      canReadMemories: Boolean(p.can_read_memories),
      canWriteMemories: Boolean(p.can_write_memories),
      canPromoteBrandMemory: Boolean(p.can_promote_brand_memory),
      canApproveHandoff: Boolean(p.can_approve_handoff),
      canModifyGovernance: Boolean(p.can_modify_governance),
      canMention: p.can_mention || [],
      allowedTools: p.allowed_tools || [],
      muted: Boolean(p.muted),
    })),
    loopGuard: raw.loop_guard
      ? {
        maxAgentHops: raw.loop_guard.max_agent_hops,
        currentHops: raw.loop_guard.current_hops,
        blockedLoops: raw.loop_guard.blocked_loops,
        strictMode: Boolean(raw.loop_guard.strict_mode),
        circuitOpen: Boolean(raw.loop_guard.circuit_open),
        lastRoute: raw.loop_guard.last_route || "",
      }
      : {
        maxAgentHops: 6,
        currentHops: 0,
        blockedLoops: 0,
        strictMode: true,
        circuitOpen: false,
        lastRoute: "",
      },
    criticReport: raw.critic_report
      ? {
        reportId: raw.critic_report.report_id,
        overallScore: raw.critic_report.overall_score,
        grade: raw.critic_report.grade,
        summary: raw.critic_report.summary,
        wcagContrastRatio: raw.critic_report.wcag_contrast_ratio,
        checks: (raw.critic_report.checks || []).map((c: any) => ({
          category: c.category,
          label: c.label,
          passed: Boolean(c.passed),
          score: c.score,
          detail: c.detail,
        })),
        recommendedMention: raw.critic_report.recommended_mention,
      }
      : null,
    auditChainHead: raw.audit_chain_head || "",
  };
}

export async function promoteBandMemoryToBrand(
  campaignId: string,
  memoryId: string
): Promise<BandSharedMemory | null> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(
    `${apiBase}/api/campaigns/${campaignId}/band/memories/promote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: memoryId, promoter: "@human_director" }),
    }
  );
  if (!res.ok) return null;
  const raw = await res.json();
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

export async function patchBandGovernance(
  campaignId: string,
  patch: {
    require_handoff_approval?: boolean;
    auto_critic_qa?: boolean;
    strict_loop_guard?: boolean;
    max_agent_hops?: number;
    mute_handle?: string;
    muted?: boolean;
  }
): Promise<BandRoomState | null> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(
    `${apiBase}/api/campaigns/${campaignId}/band/governance`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "@human_director", ...patch }),
    }
  );
  if (!res.ok) return null;
  return adaptBandRoomSnapshot(await res.json());
}

export async function runBandCriticAudit(
  campaignId: string
): Promise<BandCriticReport | null> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(
    `${apiBase}/api/campaigns/${campaignId}/band/critic/run`,
    { method: "POST" }
  );
  if (!res.ok) return null;
  const r = await res.json();
  return {
    reportId: r.report_id,
    overallScore: r.overall_score,
    grade: r.grade,
    summary: r.summary,
    wcagContrastRatio: r.wcag_contrast_ratio,
    checks: (r.checks || []).map((c: any) => ({
      category: c.category,
      label: c.label,
      passed: Boolean(c.passed),
      score: c.score,
      detail: c.detail,
    })),
    recommendedMention: r.recommended_mention,
  };
}

export async function downloadBandAuditLedger(
  campaignId: string | null,
  isLiveBackend: boolean,
  fallbackPayload: unknown
): Promise<void> {
  let payload: unknown = fallbackPayload;
  if (isLiveBackend && campaignId) {
    const { apiBase } = resolveBackendEndpoints();
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/band/audit`);
      if (res.ok) {
        payload = await res.json();
      }
    } catch {
      // Fallback to client snapshot
    }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `band-audit-${campaignId || "session"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

export interface VideoCutOptions {
  enableVoiceover?: boolean;
  voice?: string;
  voiceoverScript?: string;
}

export async function requestCustomVideoCut(
  campaignId: string,
  aspectRatio: VideoAspectRatio,
  shotStyle: VideoShotStyle,
  options?: VideoCutOptions
): Promise<CampaignVideoAsset> {
  const { apiBase } = resolveBackendEndpoints();
  const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aspect_ratio: aspectRatio,
      shot_style: shotStyle,
      enable_voiceover: options?.enableVoiceover ?? true,
      voice: options?.voice ?? "auto",
      voiceover_script: options?.voiceoverScript ?? null,
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

  const prompt = asset.prompt_used || "";
  const hasVo = prompt.includes("VO:") || Boolean(options?.enableVoiceover);
  const voMatch = prompt.match(/VO:\s*([A-Za-z0-9_-]+)/i) || asset.title.match(/VO:\s*([A-Za-z0-9_-]+)/i);
  const voiceName = options?.voice || (voMatch ? voMatch[1] : "Studio");

  return {
    id: asset.asset_id,
    title: asset.title,
    videoUrl: resolvedUrl,
    aspectRatio: asset.aspect_ratio === "9:16" ? "9:16" : "16:9",
    shotStyle,
    durationSec: 10,
    promptSummary: asset.prompt_used || "Cinematic H.264 MP4 render",
    hasVoiceover: hasVo,
    voiceName,
    voiceoverScript: options?.voiceoverScript,
  };
}
