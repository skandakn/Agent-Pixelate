export type BrandTone = "Bold" | "Minimalist" | "Luxury" | "Playful";

export type Platform = "Instagram" | "LinkedIn" | "Meta Ads";

export type VideoShotStyle =
  | "obsidian_cinema"
  | "kinetic_type"
  | "luxury_editorial"
  | "pulse_drop"
  | "vox_collage"
  | "ink_press"
  | "cyberpunk_neon"
  | "golden_hour_film"
  | "titanium_minimal";

export type VideoAspectRatio = "16:9" | "9:16";

export type CharacterAvatarId = "maya" | "leo" | "aria" | "pixel";
export type CharacterPosition = "pip_bottom_right" | "pip_bottom_left" | "split_host" | "floating_badge";

export interface CharacterAvatarConfig {
  id: CharacterAvatarId;
  name: string;
  role: string;
  tagline: string;
  themeColor: string;
  accentBadge: string;
}

export interface CampaignVideoAsset {
  id: string;
  title: string;
  videoUrl: string;
  aspectRatio: VideoAspectRatio;
  shotStyle: VideoShotStyle;
  durationSec: number;
  promptSummary: string;
  hasVoiceover?: boolean;
  voiceName?: string;
  voiceoverScript?: string;
  enableCharacter?: boolean;
  characterAvatar?: CharacterAvatarId;
  characterPosition?: CharacterPosition;
}

export type PipelineStage =
  | "user_brief"
  | "band_room"
  | "visual_agent"
  | "context_handoff"
  | "copy_agent"
  | "final_campaign";

export type NodeStatus = "idle" | "active" | "completed" | "error";

export type AgentSender =
  | "You"
  | "System"
  | "BAND Room"
  | "@VisualAgent"
  | "@CopyAgent"
  | "@CriticAgent"
  | "Orchestrator";

export type CampaignStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "error";

export type ConnectionMode = "live" | "mock";

export interface CampaignBrief {
  productName: string;
  productDescription: string;
  targetAudience: string;
  brandTone: BrandTone;
  platforms: Platform[];
  requireHandoffApproval?: boolean;
}

export interface BandParticipant {
  handle: string;
  displayName: string;
  role: string;
  kind: "human" | "orchestrator" | "agent";
  status: "online" | "thinking" | "working" | "awaiting_approval" | "idle";
  framework: string;
  skills: string[];
  registeredRemote: boolean;
}

export interface BandSharedMemory {
  memoryId: string;
  roomId: string;
  author: string;
  key: string;
  content: string;
  pinned: boolean;
  bandSynced: boolean;
  createdAt: string;
}

export interface BandDelegationEdge {
  edgeId: string;
  fromHandle: string;
  toHandle: string;
  reason: string;
  memoryId?: string | null;
  status: "dispatched" | "awaiting_approval" | "completed";
  timestamp: string;
}

export interface BandToolCallTrace {
  toolName: string;
  framework: string;
  argsSummary: string;
  resultSummary: string;
  durationMs: number;
  status: "ok" | "error" | "blocked";
}

export interface BandTaskExecution {
  executionId: string;
  agentHandle: string;
  framework: string;
  triggerBy: string;
  triggerReason: string;
  focusMemoryIds: string[];
  focusTokenEstimate: number;
  toolCalls: BandToolCallTrace[];
  status: "queued" | "running" | "completed" | "blocked_by_policy" | "failed";
  durationMs: number;
  startedAt: string;
}

export interface BandFocusWindow {
  agentHandle: string;
  totalRoomEvents: number;
  focusedEventCount: number;
  filteredNoiseCount: number;
  includedMemoryKeys: string[];
  includedMemoryIds: string[];
  focusedTokensEst: number;
  fullRoomTokensEst: number;
  contextSavingsPct: number;
  focusSummary: string;
}

export interface BandPolicyAuthority {
  handle: string;
  apiScope: "human_me_api" | "agent_runtime_api";
  canReadMemories: boolean;
  canWriteMemories: boolean;
  canPromoteBrandMemory: boolean;
  canApproveHandoff: boolean;
  canModifyGovernance: boolean;
  canMention: string[];
  allowedTools: string[];
  muted: boolean;
}

export interface BandLoopGuardState {
  maxAgentHops: number;
  currentHops: number;
  blockedLoops: number;
  strictMode: boolean;
  circuitOpen: boolean;
  lastRoute: string;
}

export interface BandCriticCheck {
  category: string;
  label: string;
  passed: boolean;
  score: number;
  detail: string;
}

export interface BandCriticReport {
  reportId: string;
  overallScore: number;
  grade: string;
  summary: string;
  wcagContrastRatio: number;
  checks: BandCriticCheck[];
  recommendedMention?: string | null;
}

export interface BandRoomState {
  campaignId: string;
  roomId: string;
  brandName: string;
  transport: "band" | "local_fallback";
  approvalRequired: boolean;
  pendingApproval: boolean;
  autoCriticQa: boolean;
  participants: BandParticipant[];
  memories: BandSharedMemory[];
  brandMemories: BandSharedMemory[];
  delegations: BandDelegationEdge[];
  executions: BandTaskExecution[];
  focusWindows: BandFocusWindow[];
  policies: BandPolicyAuthority[];
  loopGuard: BandLoopGuardState;
  criticReport: BandCriticReport | null;
  auditChainHead: string;
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

export type VisualStyle = "studio" | "lifestyle" | "macro" | "editorial";

export interface VisualOption {
  id: string;
  label: string;
  style: VisualStyle;
  imageUrl: string;
  description: string;
  lighting?: string;
  composition?: string;
}

export type PosterTheme = "billboard" | "swiss" | "luxury" | "cyber";

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
  options?: VisualOption[];
  headline?: string;
  tagline?: string;
  badge?: string;
  ctaText?: string;
  features?: string[];
  posterTheme?: PosterTheme;
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
  videos: CampaignVideoAsset[];
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
