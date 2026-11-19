import { describe, it, expect } from "vitest";
import { POSTER_THEME_CONFIGS } from "@/lib/adPosterRenderer";
import { PosterTheme } from "@/types/campaign";

describe("adPosterRenderer Configuration & Geometry", () => {
  const themes: PosterTheme[] = ["billboard", "swiss", "luxury", "cyber"];

  it("defines complete configuration specs for all 4 commercial themes", () => {
    themes.forEach((theme) => {
      const config = POSTER_THEME_CONFIGS[theme];
      expect(config).toBeDefined();
      expect(config.label).toBeDefined();
      expect(config.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.frameColor).toBeDefined();
      expect(config.kickerBg).toBeDefined();
      expect(config.kickerText).toBeDefined();
      expect(config.ctaBg).toBeDefined();
      expect(config.ctaText).toBeDefined();
      expect(config.fontFamilyDisplay).toBeDefined();
      expect(config.fontFamilyMono).toBeDefined();
    });
  });

  it("configures Street Billboard theme with neon mint brutalist accents", () => {
    const billboard = POSTER_THEME_CONFIGS.billboard;
    expect(billboard.label).toBe("Street Billboard");
    expect(billboard.accentColor).toBe("#00E599");
  });

  it("configures Luxury Editorial with gold frame accents", () => {
    const luxury = POSTER_THEME_CONFIGS.luxury;
    expect(luxury.accentColor).toBe("#D4AF37");
    expect(luxury.label).toBe("Luxury Editorial");
  });

  it("configures Cyber Tech HUD with cyan telemetry accents", () => {
    const cyber = POSTER_THEME_CONFIGS.cyber;
    expect(cyber.accentColor).toBe("#06B6D4");
    expect(cyber.label).toBe("Cyber Tech HUD");
  });
});
