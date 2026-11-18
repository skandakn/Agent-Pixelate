export type BrandTone = "Bold" | "Minimalist" | "Luxury" | "Playful";

export type Platform = "Instagram" | "LinkedIn" | "Meta Ads";

export type PipelineStage =
  | "user_brief"
  | "band_room"
  | "visual_agent"
  | "context_handoff"
  | "copy_agent"
  | "final_campaign";

export type NodeStatus = "idle" | "active" | "completed" | "error";

export type AgentSender =
  | "System"
  | "BAND Room"
  | "@VisualAgent"
  | "@CopyAgent"
  | "Orchestrator";

export type CampaignStatus = "idle" | "running" | "completed" | "error";

export type ConnectionMode = "live" | "mock";

export interface CampaignBrief {
  productName: string;
  productDescription: string;
  targetAudience: string;
  brandTone: BrandTone;
  platforms: Platform[];
}

export interface DemoPreset {
  id: string;
  label: string;
  tagline: string;
  accentHex: string;
  brief: CampaignBrief;
}

export interface ColorSwatch {
  name: string;
  hex: string;
  role: string;
}

export interface VisualCreative {
  id: string;
  title: string;
  subtitle: string;
  format: string;
  aspectRatio: "1:1" | "4:5" | "16:9" | "9:16";
  platform: Platform;
  imageUrl: string;
  svgMarkup?: string;
  lighting: string;
  composition: string;
  artNote: string;
  promptSummary: string;
}

export interface StoryboardFrame {
  id: string;
  sceneNumber: number;
  timecode: string;
  durationSec: number;
  title: string;
  visualDirection: string;
  cameraMove: string;
  audioCue: string;
  captionOverlay: string;
  accentHex: string;
  secondaryHex: string;
}

export interface SocialPost {
  id: string;
  platform: "Instagram" | "LinkedIn";
  variantLabel: string;
  hook: string;
  body: string;
  callToAction: string;
  bestTimeToPost: string;
  estimatedEngagement: string;
}

export interface MetaAdVariant {
  id: string;
  angle: string;
  headline: string;
  primaryText: string;
  description: string;
  ctaLabel: string;
  displayUrl: string;
  creativeIndex: number;
}

export interface ContextHandoffPayload {
  fromAgent: "@VisualAgent";
  toAgent: "@CopyAgent";
  visualConcept: string;
  dominantMood: string;
  paletteHexes: string[];
  heroMotif: string;
  messagingDirectives: string[];
}

export interface CampaignAssets {
  campaignId: string;
  generatedAt: string;
  brief: CampaignBrief;
  artDirectionSummary: string;
  palette: ColorSwatch[];
  creatives: VisualCreative[];
  storyboard: StoryboardFrame[];
  handoff: ContextHandoffPayload | null;
  socialPosts: SocialPost[];
  metaAds: MetaAdVariant[];
  hashtags: string[];
}

export interface AgentEvent {
  id: string;
  campaignId: string;
  timestamp: string;
  stage: PipelineStage;
  sender: AgentSender;
  type: "thought" | "status" | "handoff" | "asset_ready" | "complete" | "error";
  title: string;
  message: string;
  handoffPayload?: ContextHandoffPayload;
  metadata?: Record<string, string | number | boolean>;
}
