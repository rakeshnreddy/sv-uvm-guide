import { describe, expect, it } from "vitest";

import {
  ANCHOR_OPTIONS,
  COST_STAGES,
  costBarFraction,
  costRatio,
  DELAY_EXCEPTION_QUALIFIER,
  DELAY_EXCEPTION_STAGE,
  DELAY_RANKING_NOTE,
  delayLabel,
  formatMultiplier,
  formatUsd,
  illustrativeCost,
} from "@/lib/bug-cost-model";

describe("bug-cost-model: formatting", () => {
  it("regression: $100M prints as $100M, not $1.0B+", () => {
    expect(formatUsd(100_000_000)).toBe("$100M");
  });

  it("each suffix divides by its own unit", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(999)).toBe("$999");
    expect(formatUsd(1_000)).toBe("$1K");
    expect(formatUsd(2_500)).toBe("$2.5K");
    expect(formatUsd(10_000)).toBe("$10K");
    expect(formatUsd(1_500_000)).toBe("$1.5M");
    expect(formatUsd(1_000_000_000)).toBe("$1B");
    expect(formatUsd(12_500_000_000)).toBe("$12.5B");
  });

  it("formats multipliers with thousands separators", () => {
    expect(formatMultiplier(1)).toBe("×1");
    expect(formatMultiplier(10_000)).toBe("×10,000");
  });
});

describe("bug-cost-model: rule-of-thumb escalation (illustrative, not data)", () => {
  it("each later stage is one order of magnitude above the previous one", () => {
    for (let i = 1; i < COST_STAGES.length; i += 1) {
      expect(COST_STAGES[i].multiplier / COST_STAGES[i - 1].multiplier).toBe(10);
    }
  });

  it("a post-silicon fix is about 100× an RTL fix under the rule of thumb", () => {
    expect(costRatio("rtl", "post-silicon")).toBe(100);
  });

  it("a spec-review fix is a tenth of an RTL fix, and every stage pair is a power of ten", () => {
    expect(costRatio("rtl", "spec")).toBe(0.1);
    expect(costRatio("spec", "field")).toBe(10_000);
    expect(costRatio("system", "field")).toBe(100);
  });

  it("dollar figures are only the learner's anchor times the multiplier", () => {
    const field = COST_STAGES[COST_STAGES.length - 1];
    expect(illustrativeCost(field, ANCHOR_OPTIONS[2])).toBe(100_000_000);
    expect(formatUsd(illustrativeCost(field, ANCHOR_OPTIONS[2]))).toBe("$100M");
  });
});

describe("bug-cost-model: delay classes (F1A lesson wording, illustration, no numbers)", () => {
  it("every stage has a non-empty delay string", () => {
    for (const stage of COST_STAGES) {
      expect(typeof stage.delay).toBe("string");
      expect(stage.delay?.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses only the delay wording of the F1A stage table, worked example and exercise solution", () => {
    expect(COST_STAGES.map((s) => [s.id, s.delay])).toEqual([
      ["spec", "Hours"],
      ["rtl", "Minutes to days"],
      ["system", "Days to weeks"],
      ["post-silicon", "Weeks to months"],
      ["field", "Workaround as fast as a firmware release; the real fix waits for new silicon"],
    ]);
  });

  it("adds no new numbers: no delay string contains a digit", () => {
    for (const stage of COST_STAGES) expect(stage.delay).not.toMatch(/\d/);
  });

  it("the existing cost values are unchanged by the additive delay field", () => {
    expect(COST_STAGES.map((s) => [s.id, s.label, s.multiplier])).toEqual([
      ["spec", "Spec review", 1],
      ["rtl", "RTL simulation", 10],
      ["system", "Full-chip / emulation", 100],
      ["post-silicon", "Post-silicon (lab)", 1_000],
      ["field", "In the field", 10_000],
    ]);
    expect(ANCHOR_OPTIONS).toEqual([100, 1_000, 10_000]);
  });

  it("the delay ranking matches the cost ranking except at the field stage, as the lesson's exercise solution says", () => {
    expect(DELAY_EXCEPTION_STAGE).toBe("field");
    expect(DELAY_RANKING_NOTE).toBe(
      "By delay the order is the same as by cost, except that a field bug with a workaround can be contained quickly while its real fix waits for new silicon.",
    );
    // The exception's fast delay holds only when a workaround exists (lesson exercise solution).
    expect(DELAY_EXCEPTION_QUALIFIER).toBe("(fast only when a workaround exists)");
  });

  it("delayLabel returns the stage's delay, or a visible placeholder when one is missing", () => {
    expect(delayLabel(COST_STAGES[3])).toBe("Weeks to months");
    expect(delayLabel({ ...COST_STAGES[0], delay: undefined })).toBe("Delay not stated");
    expect(delayLabel({ ...COST_STAGES[0], delay: "" })).toBe("Delay not stated");
    expect(delayLabel({ ...COST_STAGES[0], delay: "   " })).toBe("Delay not stated");
  });
});

describe("bug-cost-model: log-scale bar lengths", () => {
  it("one equal step per order of magnitude, the largest stage at full length", () => {
    expect(COST_STAGES.map(costBarFraction)).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
  });
});
