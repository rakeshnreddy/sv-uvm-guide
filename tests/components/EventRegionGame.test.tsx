import { describe, expect, it } from "vitest";

import { QUESTIONS } from "@/components/visuals/EventRegionGame";

// Pins the graded answers to IEEE 1800-2023 so the game can no longer reward
// the misconceptions it used to teach (final/assertions in Postponed).
describe("EventRegionGame answer key", () => {
  const regionFor = (fragment: string) => QUESTIONS.find((q) => q.code.includes(fragment))?.region;

  it("evaluates concurrent assertions in Observed and samples them in Preponed", () => {
    expect(QUESTIONS.find((q) => /evaluated/.test(q.prompt))?.region).toBe("Observed");
    expect(QUESTIONS.find((q) => /sampled/.test(q.prompt))?.region).toBe("Preponed");
  });

  it("places NBA updates, clocking drives and $strobe in their regions", () => {
    expect(regionFor("q <= d")).toBe("NBA");
    expect(regionFor("vif.cb.din")).toBe("Re-NBA");
    expect(regionFor("$strobe")).toBe("Postponed");
  });

  it("never treats a final block as a time-slot region", () => {
    expect(QUESTIONS.some((q) => /\bfinal\b/.test(q.code))).toBe(false);
  });
});
