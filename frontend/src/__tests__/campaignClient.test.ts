import { describe, it, expect } from "vitest";
import { buildSimulatedCampaignAssets } from "@/data/presets";
import { DEMO_PRESETS } from "@/data/presets";

describe("campaignClient & Asset Builders", () => {
  it("builds comprehensive simulated campaign assets for all presets", () => {
    DEMO_PRESETS.forEach((preset) => {
      const assets = buildSimulatedCampaignAssets(preset.brief, "camp_test_sim");
      expect(assets.campaignId).toBe("camp_test_sim");
      expect(assets.brief.productName).toBe(preset.brief.productName);
      expect(assets.palette).toHaveLength(5);
      expect(assets.creatives.length).toBeGreaterThanOrEqual(1);
      expect(assets.socialPosts.length).toBeGreaterThanOrEqual(1);
      expect(assets.metaAds.length).toBeGreaterThanOrEqual(1);
      expect(assets.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(assets.handoff).not.toBeNull();
      expect(assets.storyboard).toHaveLength(4);

      // Verify poster metadata presence
      assets.creatives.forEach((creative) => {
        expect(creative.headline).toBeDefined();
        expect(creative.badge).toBeDefined();
        expect(creative.tagline).toBeDefined();
        expect(creative.ctaText).toBeDefined();
        expect(creative.features?.length).toBeGreaterThanOrEqual(3);
        expect(creative.posterTheme).toBeDefined();
      });
    });
  });

  it("ensures each color swatch has a hex and role token", () => {
    const assets = buildSimulatedCampaignAssets(DEMO_PRESETS[0].brief, "camp_swatch");
    assets.palette.forEach((swatch) => {
      expect(swatch.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(swatch.name).toBeDefined();
      expect(swatch.role).toBeDefined();
    });
  });
});
