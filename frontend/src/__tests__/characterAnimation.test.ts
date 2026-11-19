import { describe, expect, it } from "vitest";
import {
  CHARACTER_AVATARS,
  computeBlinkRatio,
  computeViseme,
  VisemeMouthState,
} from "@/lib/characterAnimation";

describe("Character Animation & Lip-Sync Viseme Engine", () => {
  it("defines all 4 character avatars with appropriate roles and colors", () => {
    expect(CHARACTER_AVATARS.maya.id).toBe("maya");
    expect(CHARACTER_AVATARS.maya.role).toContain("Tech");
    expect(CHARACTER_AVATARS.leo.id).toBe("leo");
    expect(CHARACTER_AVATARS.leo.name).toContain("Creator");
    expect(CHARACTER_AVATARS.leo.role).toContain("Presenter");
    expect(CHARACTER_AVATARS.aria.id).toBe("aria");
    expect(CHARACTER_AVATARS.pixel.id).toBe("pixel");
  });

  it("returns rest or smile when character is not speaking", () => {
    const visemeIdle = computeViseme(1000, false, 0);
    expect(["rest", "smile"]).toContain(visemeIdle);
  });

  it("cycles through speech visemes when speaking", () => {
    const observedVisemes = new Set<VisemeMouthState>();
    for (let t = 0; t < 1000; t += 50) {
      observedVisemes.add(computeViseme(t, true, 0.8));
    }
    expect(observedVisemes.has("open_a")).toBe(true);
    expect(observedVisemes.has("round_o")).toBe(true);
    expect(observedVisemes.has("wide_e")).toBe(true);
  });

  it("calculates eye blink ratio smoothly during blink cycle", () => {
    // Exactly at beginning of 3.6s cycle (e.g. t = 90ms into 180ms blink)
    const midBlink = computeBlinkRatio(90);
    expect(midBlink).toBeGreaterThan(0.9);

    // Outside blink window (e.g. t = 500ms)
    const eyesOpen = computeBlinkRatio(500);
    expect(eyesOpen).toBe(0);
  });
});
