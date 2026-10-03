import { describe, expect, it } from "vitest";

import { ANCHOR_OPTIONS, COST_STAGES, costRatio, formatMultiplier, formatUsd, illustrativeCost } from "@/lib/bug-cost-model";

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

  it("dollar figures are only the learner's anchor times the multiplier", () => {
    const field = COST_STAGES[COST_STAGES.length - 1];
    expect(illustrativeCost(field, ANCHOR_OPTIONS[2])).toBe(100_000_000);
    expect(formatUsd(illustrativeCost(field, ANCHOR_OPTIONS[2]))).toBe("$100M");
  });
});
