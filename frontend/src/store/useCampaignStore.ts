/**
 * Agent Pixelate — Centralized Campaign & Telemetry Store (Zustand)
 *
 * Provides reactive global state for multi-agent campaign orchestration,
 * real-time BAND room telemetry, and commercial ad poster customizer controls.
 */

import { create } from "zustand";
import {
  AgentEvent,
  CampaignAssets,
  CampaignBrief,
  PipelineStage,
  PosterTheme,
} from "@/types/campaign";
import { DEMO_PRESETS } from "@/data/presets";

export type CampaignExecutionStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "error";

export interface CampaignStoreState {
  // --- Brief & Specification ---
  brief: CampaignBrief;
  status: CampaignExecutionStatus;
  campaignId: string | null;
  mode: "live" | "mock";
  modeNotice: string | null;

  // --- Real-time Agent Telemetry & BAND Feed ---
  events: AgentEvent[];
  currentStage: PipelineStage;

  // --- Campaign Assets & Creatives ---
  partialAssets: Partial<CampaignAssets>;
  finalAssets: CampaignAssets | null;

  // --- Commercial Ad Poster Customizer State ---
  selectedCreativeIndex: number;
  selectedStyleIndex: number;
  activePosterTheme: PosterTheme;
  selectedHeadlineIndex: number;
  customHeadline: string | null;
  showPosterOverlay: boolean;
  previewAspect: "4:5" | "1:1" | "16:9" | "9:16";

  // --- Actions ---
  setBrief: (brief: CampaignBrief | ((prev: CampaignBrief) => CampaignBrief)) => void;
  setStatus: (status: CampaignExecutionStatus) => void;
  setCampaignId: (id: string | null) => void;
  setMode: (mode: "live" | "mock", notice?: string | null) => void;
  addEvent: (event: AgentEvent) => void;
  setEvents: (events: AgentEvent[]) => void;
  setCurrentStage: (stage: PipelineStage) => void;
  setPartialAssets: (partial: Partial<CampaignAssets> | ((prev: Partial<CampaignAssets>) => Partial<CampaignAssets>)) => void;
  setFinalAssets: (assets: CampaignAssets | null) => void;
  setSelectedCreativeIndex: (idx: number) => void;
  setSelectedStyleIndex: (idx: number) => void;
  setActivePosterTheme: (theme: PosterTheme) => void;
  setSelectedHeadlineIndex: (idx: number) => void;
  setCustomHeadline: (headline: string | null) => void;
  setShowPosterOverlay: (show: boolean | ((prev: boolean) => boolean)) => void;
  setPreviewAspect: (aspect: "4:5" | "1:1" | "16:9" | "9:16") => void;
  resetSession: () => void;
}

const INITIAL_BRIEF: CampaignBrief = DEMO_PRESETS[0].brief;

export const useCampaignStore = create<CampaignStoreState>((set) => ({
  // State
  brief: INITIAL_BRIEF,
  status: "idle",
  campaignId: null,
  mode: "live",
  modeNotice: null,
  events: [],
  currentStage: "user_brief",
  partialAssets: {},
  finalAssets: null,
  selectedCreativeIndex: 0,
  selectedStyleIndex: 0,
  activePosterTheme: "billboard",
  selectedHeadlineIndex: 0,
  customHeadline: null,
  showPosterOverlay: true,
  previewAspect: "4:5",

  // Actions
  setBrief: (updater) =>
    set((state) => ({
      brief: typeof updater === "function" ? updater(state.brief) : updater,
    })),

  setStatus: (status) => set({ status }),

  setCampaignId: (campaignId) => set({ campaignId }),

  setMode: (mode, notice = null) => set({ mode, modeNotice: notice }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
      currentStage: event.stage,
    })),

  setEvents: (events) => set({ events }),

  setCurrentStage: (currentStage) => set({ currentStage }),

  setPartialAssets: (updater) =>
    set((state) => ({
      partialAssets:
        typeof updater === "function" ? updater(state.partialAssets) : updater,
    })),

  setFinalAssets: (finalAssets) => set({ finalAssets }),

  setSelectedCreativeIndex: (selectedCreativeIndex) =>
    set({ selectedCreativeIndex, selectedStyleIndex: 0 }),

  setSelectedStyleIndex: (selectedStyleIndex) => set({ selectedStyleIndex }),

  setActivePosterTheme: (activePosterTheme) => set({ activePosterTheme }),

  setSelectedHeadlineIndex: (selectedHeadlineIndex) =>
    set({ selectedHeadlineIndex, customHeadline: null }),

  setCustomHeadline: (customHeadline) => set({ customHeadline }),

  setShowPosterOverlay: (updater) =>
    set((state) => ({
      showPosterOverlay:
        typeof updater === "function"
          ? updater(state.showPosterOverlay)
          : updater,
    })),

  setPreviewAspect: (previewAspect) => set({ previewAspect }),

  resetSession: () =>
    set({
      status: "idle",
      campaignId: null,
      events: [],
      currentStage: "user_brief",
      partialAssets: {},
      finalAssets: null,
      selectedCreativeIndex: 0,
      selectedStyleIndex: 0,
      selectedHeadlineIndex: 0,
      customHeadline: null,
      modeNotice: null,
    }),
}));
