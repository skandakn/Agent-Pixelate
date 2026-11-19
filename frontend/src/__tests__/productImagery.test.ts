import { describe, it, expect } from "vitest";
import {
  getPosterMetadataForBrief,
  getProductVisualOptions,
} from "@/lib/productImagery";
import { DEMO_PRESETS } from "@/data/presets";

describe("productImagery & Commercial Poster Engine", () => {
  it("resolves tailored poster metadata for hydration bottle", () => {
    const meta = getPosterMetadataForBrief(DEMO_PRESETS[0].brief);
    expect(meta.headlines.length).toBeGreaterThanOrEqual(3);
    expect(meta.badge).toBeDefined();
    expect(meta.tagline).toBeDefined();
    expect(meta.features.length).toBeGreaterThanOrEqual(3);
    expect(meta.ctaText).toBe("PRE-ORDER NOW →");
    expect(meta.headlines[0]).toContain("HYDRATION");
  });

  it("resolves tailored poster metadata for earbuds", () => {
    const meta = getPosterMetadataForBrief(DEMO_PRESETS[1].brief);
    expect(meta.headlines.length).toBeGreaterThanOrEqual(3);
    expect(meta.badge).toContain("PRO SERIES");
    expect(meta.headlines[0]).toContain("SILENCE");
  });

  it("resolves tailored poster metadata for matcha tea", () => {
    const meta = getPosterMetadataForBrief(DEMO_PRESETS[2].brief);
    expect(meta.headlines.some((h) => h.includes("UJI") || h.includes("RITUAL") || h.includes("FOCUS"))).toBe(true);
    expect(meta.badge).toContain("FIRST HARVEST");
  });

  it("generates 4 distinct visual photography styles with images", () => {
    const options = getProductVisualOptions(DEMO_PRESETS[0].brief, "camp_123");
    expect(options).toHaveLength(4);
    expect(options[0].id).toContain("studio");
    expect(options[1].id).toContain("lifestyle");
    expect(options[2].id).toContain("macro");
    expect(options[3].id).toContain("editorial");
    options.forEach((opt) => {
      expect(opt.imageUrl).toMatch(/^https?:\/\//);
      expect(opt.label).toBeDefined();
      expect(opt.description).toBeDefined();
    });
  });

  it("falls back gracefully for unknown generic products", () => {
    const genericBrief = {
      productName: "Quantum Widget X",
      productDescription: "An enigmatic quantum device with mysterious properties.",
      targetAudience: "Quantum physicists",
      brandTone: "Bold",
      platforms: ["Instagram" as const],
    };
    const meta = getPosterMetadataForBrief(genericBrief);
    expect(meta.headlines).toHaveLength(3);
    expect(meta.ctaText).toBe("PRE-ORDER NOW →");

    const options = getProductVisualOptions(genericBrief, "camp_generic");
    expect(options).toHaveLength(4);
  });
});
