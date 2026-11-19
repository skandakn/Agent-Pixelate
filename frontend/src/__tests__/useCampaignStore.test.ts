import { describe, it, expect, beforeEach } from "vitest";
import { useCampaignStore } from "@/store/useCampaignStore";
import { DEMO_PRESETS } from "@/data/presets";
import { AgentEvent } from "@/types/campaign";

describe("useCampaignStore (Zustand Global State)", () => {
  beforeEach(() => {
    useCampaignStore.getState().resetSession();
  });

  it("initializes with default demo preset brief and idle status", () => {
    const state = useCampaignStore.getState();
    expect(state.status).toBe("idle");
    expect(state.brief.productName).toBe(DEMO_PRESETS[0].brief.productName);
    expect(state.activePosterTheme).toBe("billboard");
    expect(state.showPosterOverlay).toBe(true);
  });

  it("updates brief correctly via object or updater function", () => {
    const { setBrief } = useCampaignStore.getState();

    setBrief({
      ...DEMO_PRESETS[1].brief,
      productName: "Aether Pods Ultra",
    });

    expect(useCampaignStore.getState().brief.productName).toBe("Aether Pods Ultra");

    setBrief((prev) => ({
      ...prev,
      brandTone: "Luxury",
    }));

    expect(useCampaignStore.getState().brief.brandTone).toBe("Luxury");
  });

  it("accumulates telemetry events and updates currentStage", () => {
    const { addEvent } = useCampaignStore.getState();

    const mockEvent: AgentEvent = {
      id: "evt_101",
      campaignId: "camp_test_1",
      timestamp: new Date().toISOString(),
      stage: "visual_agent",
      sender: "@VisualAgent",
      type: "asset_ready",
      title: "Visual Creative Rendered",
      message: "Generated studio visual concept 1/3",
    };

    addEvent(mockEvent);

    const state = useCampaignStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0].id).toBe("evt_101");
    expect(state.currentStage).toBe("visual_agent");
  });

  it("manages poster customizer theme and headline states", () => {
    const { setActivePosterTheme, setSelectedHeadlineIndex, setCustomHeadline } =
      useCampaignStore.getState();

    setActivePosterTheme("cyber");
    expect(useCampaignStore.getState().activePosterTheme).toBe("cyber");

    setSelectedHeadlineIndex(2);
    expect(useCampaignStore.getState().selectedHeadlineIndex).toBe(2);

    setCustomHeadline("NEXT-GEN CYBER ACOUSTICS");
    expect(useCampaignStore.getState().customHeadline).toBe(
      "NEXT-GEN CYBER ACOUSTICS"
    );
  });
});
