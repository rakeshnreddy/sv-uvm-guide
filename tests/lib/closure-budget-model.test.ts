import { describe, expect, it } from "vitest";

import {
  CLOSURE_PRESETS,
  DEFAULT_CONFIG,
  FOLLOW_ON_LESSON,
  GO_FURTHER_CONFIG,
  MAX_LABELLED_DECADES,
  announcementText,
  axisTicks,
  expectedRunsToHit,
  formatRuns,
  goFurtherText,
  initialLabView,
  labViewReducer,
  settingsText,
  workbenchConfig,
  workbenchIntro,
  FIGURE_CHECKPOINTS,
  MIN_WAIVER_REASON,
  PLAN_GAP_ITEMS,
  axisMax,
  binProbabilities,
  chartSummary,
  closureExpectations,
  closureReducer,
  closureTable,
  coveredBy,
  expectedCoverage,
  expectedSamplesEqualBins,
  expectedSamplesOneBin,
  expectedSamplesToClose,
  formatPercent,
  formatProbability,
  formatSamples,
  getPreset,
  hitProbability,
  initialClosureState,
  isRareCovered,
  lastOutcome,
  predictionOptions,
  predictionQuestion,
  runSeed,
  runSeedValue,
  runSteps,
  sampleBin,
  summarize,
  waiverReasonProblem,
  type ClosureState,
} from "@/lib/closure-budget-model";
import { expectedSamplesDisjoint, harmonic } from "@/lib/coverage-model";

const p17 = binProbabilities(16, 0.001);

describe("bin probabilities", () => {
  it("16 common bins share 99.9% and the rare bin gets 0.1%; they sum to 1 (disjoint bins)", () => {
    expect(p17).toHaveLength(17);
    expect(p17[16]).toBe(0.001);
    expect(p17[0]).toBeCloseTo(0.999 / 16, 12);
    expect(p17.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("rejects bin counts and probabilities outside the controls' domain", () => {
    expect(() => binProbabilities(0, 0.01)).toThrow(RangeError);
    expect(() => binProbabilities(2.5, 0.01)).toThrow(RangeError);
    expect(() => binProbabilities(65, 0.01)).toThrow(RangeError);
    expect(() => binProbabilities(16, 0)).toThrow(RangeError);
    expect(() => binProbabilities(16, 1)).toThrow(RangeError);
    expect(() => binProbabilities(16, Number.NaN)).toThrow(RangeError);
    expect(() => binProbabilities(16, -0.1)).toThrow(RangeError);
  });
});

describe("expected coverage = E[|bins_covered| / |bins|] (IEEE 1800-2023 §19.11.1)", () => {
  it("matches the lesson's figure: 44.8 / 68.3 / 90.7 / 94.5 / 97.8 / 99.96% at 10 / 20 / 50 / 100 / 1000 / 5000 samples", () => {
    const shown = FIGURE_CHECKPOINTS.map((n) => formatPercent(expectedCoverage(p17, n)));
    expect(shown).toEqual(["44.8%", "68.3%", "90.7%", "94.5%", "97.8%", "99.96%"]);
  });

  it("is the mean of per-bin hit probabilities 1 − (1 − p)^n", () => {
    const n = 37;
    const manual = p17.reduce((s, p) => s + (1 - Math.pow(1 - p, n)), 0) / 17;
    expect(expectedCoverage(p17, n)).toBeCloseTo(manual, 14);
  });

  it("edge cases: 0 samples is 0%, infinite samples is 100%, a bin of probability 0 is never hit", () => {
    expect(expectedCoverage(p17, 0)).toBe(0);
    expect(expectedCoverage(p17, Infinity)).toBe(1);
    expect(expectedCoverage([0.5, 0.5, 0], Infinity)).toBeCloseTo(2 / 3, 12);
    expect(hitProbability(0, 1e9)).toBe(0);
  });

  it("rejects an empty model, negative or NaN sample counts and probabilities outside [0, 1]", () => {
    expect(() => expectedCoverage([], 10)).toThrow(RangeError);
    expect(() => expectedCoverage(p17, -1)).toThrow(RangeError);
    expect(() => expectedCoverage(p17, Number.NaN)).toThrow(RangeError);
    expect(() => hitProbability(1.5, 1)).toThrow(RangeError);
  });

  it("is monotone in n and never above 1", () => {
    let prev = 0;
    for (const n of [1, 2, 5, 10, 100, 1e3, 1e4, 1e5, 1e7]) {
      const c = expectedCoverage(p17, n);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c).toBeLessThanOrEqual(1);
      prev = c;
    }
  });
});

describe("expected samples to close (coupon collector; reuses coverage-model)", () => {
  it("about 54 samples for the 16 common bins: H_16 / q with q = 0.999/16", () => {
    const common = expectedSamplesEqualBins(16, 0.999 / 16);
    expect(common).toBeCloseTo((16 * harmonic(16)) / 0.999, 10);
    expect(formatSamples(common)).toBe("54");
    expect(expectedSamplesDisjoint(new Array(16).fill(0).map(() => ({ p: 0.999 / 16, atLeast: 1 })))).toBeCloseTo(common, 0);
  });

  it("about 1,002 for all 17 bins with the rare bin at 0.1%", () => {
    const all = expectedSamplesToClose(p17);
    expect(formatSamples(all)).toBe("1,002");
    expect(Math.abs(all - 1001.78)).toBeLessThan(1);
  });

  it("a single bin of probability p takes 1/p samples on average; a bin of probability 0 never closes", () => {
    expect(expectedSamplesOneBin(0.001)).toBeCloseTo(1000, 9);
    expect(expectedSamplesOneBin(0)).toBe(Infinity);
    expect(expectedSamplesToClose([0.5, 0.5, 0])).toBe(Infinity);
    expect(formatSamples(Infinity)).toBe("never");
    expect(expectedSamplesEqualBins(0, 0.1)).toBe(0);
  });

  it("the rare bin dominates: closing 17 bins costs about 18× closing the 16 common ones", () => {
    const e = closureExpectations(DEFAULT_CONFIG);
    expect(e.all / e.common).toBeGreaterThan(18);
    expect(e.all - e.rare).toBeLessThan(e.common);
  });

  it("per-run chance of hitting the rare bin is 1 − (1 − p)^budget", () => {
    expect(closureExpectations({ ...DEFAULT_CONFIG, budget: 200 }).rarePerRun).toBeCloseTo(1 - Math.pow(0.999, 200), 12);
  });
});

describe("seeded runs (createRng from coverage-model)", () => {
  it("a seed always gives the same run, and first-hit indices are offset by the start", () => {
    expect(runSeed(p17, 7, 300)).toEqual(runSeed(p17, 7, 300));
    const offset = runSeed(p17, 7, 300, 1000);
    runSeed(p17, 7, 300).forEach((hit, i) => expect(offset[i]).toBe(hit === null ? null : hit + 1000));
  });

  it("run seeds are mixed, never 0, and differ between runs", () => {
    const seeds = [1, 2, 3, 4, 5].map((k) => runSeedValue(4, k));
    expect(new Set(seeds).size).toBe(5);
    seeds.forEach((s) => expect(s).toBeGreaterThan(0));
  });

  it("sampleBin maps a uniform draw onto cumulative probabilities", () => {
    expect(sampleBin([0.25, 0.25, 0.5], 0)).toBe(0);
    expect(sampleBin([0.25, 0.25, 0.5], 0.3)).toBe(1);
    expect(sampleBin([0.25, 0.25, 0.5], 0.99)).toBe(2);
  });

  it("the default run covers the 16 common bins and misses the rare one: the plateau", () => {
    const s = initialClosureState(DEFAULT_CONFIG);
    expect(summarize(s).covered).toBe(16);
    expect(isRareCovered(s)).toBe(false);
    expect(coveredBy(s.firstHit, s.samplesUsed)).toBe(16);
  });

  it("the default run's frequencies track the expectation: the seeded coverage is within 3 bins of the expected curve at each checkpoint", () => {
    const s = initialClosureState({ ...DEFAULT_CONFIG, budget: 5000 });
    for (const row of closureTable(s)) {
      if (row.run === null) continue;
      expect(Math.abs(row.run - row.expected) * 17).toBeLessThanOrEqual(3);
    }
  });
});

const seeds = (s: ClosureState, k: number) => {
  let next = s;
  for (let i = 0; i < k; i += 1) next = closureReducer(next, { type: "more-seeds" });
  return next;
};

describe("action: more seeds", () => {
  it("adds one budget of samples per seed; the plateau barely moves for the default seed", () => {
    const s0 = initialClosureState(DEFAULT_CONFIG);
    const s3 = seeds(s0, 3);
    expect(s3.samplesUsed).toBe(800);
    expect(s3.seedRuns).toBe(4);
    expect(summarize(s3).covered).toBe(16);
    expect(s3.log.at(-1)?.text).toBe(
      `Run 4 (a new seed) added 200 samples (800 in all): 16 → 16 of 17 model bins. Expected coverage moves from ${formatPercent(expectedCoverage(p17, 600))} to ${formatPercent(expectedCoverage(p17, 800))}; each extra seed hits the 0.1% bin with probability ${formatPercent(1 - Math.pow(0.999, 200))}.`,
    );
  });

  it("reports the sample at which a later seed finally hits the rare bin", () => {
    const s = seeds(initialClosureState(DEFAULT_CONFIG), 6);
    expect(isRareCovered(s)).toBe(true);
    const hit = s.firstHit[16] as number;
    expect(hit).toBeGreaterThan(1200);
    expect(s.log.at(-1)?.text).toContain(`This seed hit the rare bin at sample ${formatSamples(hit)}.`);
  });

  it("keeps a bin's earliest hit across seeds", () => {
    const s0 = initialClosureState(DEFAULT_CONFIG);
    const s1 = seeds(s0, 1);
    s0.firstHit.forEach((hit, i) => {
      if (hit !== null) expect(s1.firstHit[i]).toBe(hit);
    });
  });
});

describe("action: directed test for the rare bin", () => {
  it("closes the rare bin in one run", () => {
    const s0 = initialClosureState(DEFAULT_CONFIG);
    const s1 = closureReducer(s0, { type: "directed" });
    expect(summarize(s1).covered).toBe(17);
    expect(summarize(s1).coverage).toBe(1);
    expect(s1.samplesUsed).toBe(s0.samplesUsed);
    expect(s1.log.at(-1)?.text).toBe(
      "One directed run drove the rare bin's scenario on purpose: 16 → 17 of 17 model bins. Random stimulus needs about 1,000 samples on average (1/p) to hit a 0.1% bin, about 5.5 runs of 200 samples.",
    );
  });

  it("is refused once the rare bin is covered", () => {
    const s = closureReducer(closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "directed" }), { type: "directed" });
    expect(s.log.at(-1)?.refused).toBe(true);
  });

  it("replaces a waiver: the bin is now covered", () => {
    const waived = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "waive", reason: "unreachable in this mode" });
    const s = closureReducer(waived, { type: "directed" });
    expect(s.waiverReason).toBeNull();
    expect(summarize(s).bins[16].status).toBe("covered");
    expect(s.log.at(-1)?.text).toContain("its waiver is no longer needed");
  });
});

describe("action: waive the hole (industry practice, not IEEE 1800-2023)", () => {
  it("requires a typed reason of at least 10 characters", () => {
    expect(waiverReasonProblem("   ")).toContain(`${MIN_WAIVER_REASON} characters`);
    expect(waiverReasonProblem("short")).not.toBeNull();
    expect(waiverReasonProblem("unreachable in this mode")).toBeNull();
    const s = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "waive", reason: "ok" });
    expect(s.waiverReason).toBeNull();
    expect(s.log.at(-1)?.refused).toBe(true);
  });

  it("marks the bin waived, not covered; covered stays the same", () => {
    const s = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "waive", reason: "  unreachable in this mode  " });
    const sum = summarize(s);
    expect(s.waiverReason).toBe("unreachable in this mode");
    expect(sum.bins[16].status).toBe("waived");
    expect(sum.covered).toBe(16);
    expect(sum.waived).toBe(1);
    expect(sum.coverage).toBeCloseTo(16 / 17, 12);
    expect(sum.coverageExcludingWaived).toBe(1);
    expect(s.log.at(-1)?.text).toContain("whether it does is a tool and project choice");
  });

  it("is refused when the rare bin is already covered or already waived", () => {
    const covered = closureReducer(closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "directed" }), { type: "waive", reason: "unreachable in this mode" });
    expect(covered.log.at(-1)?.refused).toBe(true);
    const twice = closureReducer(closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "waive", reason: "unreachable in this mode" }), { type: "waive", reason: "another reason here" });
    expect(twice.log.at(-1)?.text).toBe("The rare bin is already waived.");
  });
});

describe("action: checks were off in these runs (industry practice)", () => {
  it("coverage stays while evidence drops to 0", () => {
    const s0 = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "directed" });
    const s1 = closureReducer(s0, { type: "checks-off", on: true });
    expect(summarize(s1).coverage).toBe(1);
    expect(summarize(s1).evidence).toBe(0);
    expect(s1.log.at(-1)?.text).toBe(
      "Coverage stays 17 of 17 (100%), but evidence drops to 0 of 17: a bin hit while no check could fail shows only that the stimulus happened. The setting applies to every run, a directed run made later included.",
    );
    const s2 = closureReducer(s1, { type: "checks-off", on: false });
    expect(summarize(s2).evidence).toBe(1);
  });

  it("toggling to the current value changes nothing", () => {
    const s = initialClosureState(DEFAULT_CONFIG);
    expect(closureReducer(s, { type: "checks-off", on: false })).toBe(s);
  });
});

describe("action: the plan has 2 items the model lacks (industry practice)", () => {
  it("the denominator grows and 100% drops to 17/19", () => {
    const s0 = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "directed" });
    const s1 = closureReducer(s0, { type: "plan-gap", on: true });
    const sum = summarize(s1);
    expect(sum.denominator).toBe(17 + PLAN_GAP_ITEMS.length);
    expect(sum.coverageOfModel).toBe(1);
    expect(sum.coverage).toBeCloseTo(17 / 19, 12);
    expect(sum.bins.filter((b) => b.status === "not-in-model")).toHaveLength(2);
    expect(s1.log.at(-1)?.text).toBe(
      `The plan has 2 items the model lacks: the denominator grows from 17 to 19, so 100% of the model is ${formatPercent(17 / 19)} of the plan. No sample can count toward an item that has no coverage item.`,
    );
    expect(formatPercent(17 / 19)).toBe("89.5%");
  });

  it("more seeds cannot cover a plan item the model lacks", () => {
    const s = seeds(closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "plan-gap", on: true }), 10);
    expect(summarize(s).covered).toBeLessThanOrEqual(17);
    expect(summarize(s).holes).toBeGreaterThanOrEqual(2);
  });
});

describe("configure and reset", () => {
  it("configure starts a fresh run with the new settings; reset restarts the same settings", () => {
    const s = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "configure", config: { commonBins: 8, rareP: 0.05 } });
    expect(s.firstHit).toHaveLength(9);
    expect(s.log).toEqual([]);
    const r = closureReducer(closureReducer(s, { type: "directed" }), { type: "reset" });
    expect(r).toEqual(s);
  });

  it("rejects a budget below one sample", () => {
    expect(() => initialClosureState({ ...DEFAULT_CONFIG, budget: 0 })).toThrow(RangeError);
  });
});

describe("prediction", () => {
  it("the spec's question at 0.1%: about 1,000 is correct, with feedback from the model's numbers", () => {
    const options = predictionOptions(16, 0.001);
    expect(options.map((o) => o.label)).toEqual(["About 100", "About 1,000", "About 100,000"]);
    expect(options.filter((o) => o.correct).map((o) => o.value)).toEqual([1000]);
    expect(options[1].feedback).toBe(
      "Expected samples to hit all 17 bins: about 1,002. The 16 common bins close after about 54; the rest of the wait is the 0.1% bin, which on its own takes 1/p = 1,000 samples on average.",
    );
    expect(options[0].feedback).toContain(`hit with probability only ${formatPercent(1 - Math.pow(0.999, 100))}`);
    expect(options[2].feedback).toMatch(/^Too high/);
  });

  it("the F1B preset asks at 1%, which the lesson's static figure does not answer: about 100 is correct", () => {
    const preset = getPreset("f1b-closure-trap");
    expect(preset.config.rareP).toBe(0.01);
    const options = predictionOptions(16, preset.config.rareP);
    expect(options.find((o) => o.correct)?.value).toBe(100);
    expect(formatSamples(expectedSamplesToClose(binProbabilities(16, 0.01)))).toBe("114");
    expect(predictionQuestion(16, 0.01)).toBe("16 bins are common and one bin has probability 1%. Roughly how many random samples does it take to hit all 17 bins?");
  });

  it("the F1B preset's seed misses the rare bin in run 1 at 1% and in six runs at 0.1%", () => {
    const { config } = getPreset("f1b-closure-trap");
    const at1 = initialClosureState(config);
    expect(isRareCovered(at1)).toBe(false);
    expect(isRareCovered(seeds(at1, 1))).toBe(true);
    const at01 = closureReducer(at1, { type: "configure", config: { rareP: 0.001 } });
    expect(isRareCovered(seeds(at01, 5))).toBe(false);
  });

  it("an unknown preset falls back to the F1B preset; every preset is valid", () => {
    expect(getPreset("nope").id).toBe("f1b-closure-trap");
    for (const preset of Object.values(CLOSURE_PRESETS)) expect(() => initialClosureState(preset.config)).not.toThrow();
  });
});

describe("formatting and chart helpers", () => {
  it("chart summary and per-action outcomes come from the state", () => {
    const s0 = initialClosureState(DEFAULT_CONFIG);
    expect(chartSummary(s0)).toBe(
      "Expected coverage is 44.8% at 10 samples, 94.5% at 100 and 97.8% at 1,000; all 17 bins are expected to close after about 1,002 samples. The seeded random runs covered 16 of 17 bins in 200 samples.",
    );
    const s1 = closureReducer(closureReducer(s0, { type: "directed" }), { type: "directed" });
    expect(lastOutcome(s1, "directed")?.refused).toBe(true);
    expect(lastOutcome(s1, "waive")).toBeNull();
    expect(chartSummary(s1)).toMatch(/a directed run covered the rare bin\.$/);
  });

  it("percentages add decimals only when one decimal would round to 0.0% or 100.0%", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.9996)).toBe("99.96%");
    expect(formatPercent(0.9999)).toBe("99.99%");
    expect(formatPercent(0.0004)).toBe("0.04%");
    expect(formatPercent(1 - 1e-12)).toBe(">99.9999%");
    expect(formatProbability(0.001)).toBe("0.1%");
    expect(formatProbability(0.05)).toBe("5%");
  });

  it("axis runs to the next power of ten above 5 × the expected samples and the samples used", () => {
    expect(axisMax(1002, 200)).toBe(10000);
    expect(axisMax(114, 200)).toBe(1000);
    expect(axisMax(114, 20000)).toBe(100000);
    expect(axisMax(Infinity, 200)).toBe(1000);
  });

  it("the text table lists the figure's checkpoints plus the samples used; unreached rows have no run value", () => {
    const rows = closureTable(initialClosureState(DEFAULT_CONFIG));
    expect(rows.map((r) => r.n)).toEqual([10, 20, 50, 100, 200, 1000, 5000]);
    expect(rows.find((r) => r.n === 1000)?.run).toBeNull();
    expect(rows.find((r) => r.n === 200)?.run).toBeCloseTo(16 / 17, 12);
  });

  it("run steps rise by one bin per first hit and end at the samples used", () => {
    const s = initialClosureState(DEFAULT_CONFIG);
    const steps = runSteps(s);
    expect(steps.at(-1)).toEqual({ n: 200, coverage: 16 / 17 });
    expect(steps).toHaveLength(17);
  });
});

/** Closed form for k equal bins of probability q plus one bin of probability p (Beta integral), for checking the numeric quadrature. */
function exactExpectation(k: number, q: number, p: number): number {
  const a = p / q;
  let beta = 1 / a;
  for (let j = 1; j <= k; j += 1) beta *= j / (a + j);
  // E = ∫ (1 − (1 − e^{−qt})^k (1 − e^{−pt})) dt = H_k / q + B(p/q, k + 1) / q
  return harmonic(k) / q + beta / q;
}

describe("r2 fixes", () => {
  it("expected samples to close are within 0.01 samples of the closed form (numeric quadrature, not exact)", () => {
    for (const k of [4, 8, 16, 32]) {
      for (const rareP of [0.001, 0.01, 0.05]) {
        const exact = exactExpectation(k, (1 - rareP) / k, rareP);
        expect(Math.abs(expectedSamplesToClose(binProbabilities(k, rareP)) - exact)).toBeLessThan(0.01);
      }
    }
    expect(exactExpectation(16, 0.999 / 16, 0.001)).toBeCloseTo(1001.63, 2);
  });

  it("the F1B preset predicts at 1% but the workbench opens at the lesson's 0.1% bin, where more seeds plateau", () => {
    const preset = getPreset("f1b-closure-trap");
    expect(preset.config.rareP).toBe(0.01);
    const wb = workbenchConfig(preset);
    expect(wb).toEqual({ ...preset.config, rareP: 0.001 });
    const s1 = closureReducer(initialClosureState(wb), { type: "more-seeds" });
    expect(isRareCovered(s1)).toBe(false);
    expect(isRareCovered(seeds(initialClosureState(wb), 5))).toBe(false);
    // at the predicted 1% setting one more seed closes it: that is why the workbench does not open there
    expect(hitProbability(0.01, 100)).toBeCloseTo(0.634, 3);
    expect(workbenchIntro(preset)).toBe(
      `You predicted the 1% case. The lab opens at the lesson's 0.1% bin, where the plateau shows: one run of 100 samples hits it with probability ${formatPercent(hitProbability(0.001, 100))}, about ${formatRuns(expectedRunsToHit(0.001, 100))} runs on average, and closing all 17 bins takes about 1,002 samples. Press More seeds a few times, then switch the rare-bin probability to 1% and compare.`,
    );
    expect(formatRuns(expectedRunsToHit(0.001, 100))).toBe("10.5");
    expect(workbenchIntro(getPreset("standalone"))).toBeNull();
    expect(workbenchConfig(getPreset("standalone"))).toEqual(DEFAULT_CONFIG);
  });

  it("when a common-enough rare bin closes in a run or two, the more-seeds and directed lines say so", () => {
    const at1 = getPreset("f1b-closure-trap").config;
    const s = closureReducer(initialClosureState(at1), { type: "more-seeds" });
    expect(isRareCovered(s)).toBe(true);
    expect(s.log.at(-1)?.text).toContain("about 1.6 runs of 100 samples, so at this setting one or two seeds usually close it");
    const d = closureReducer(initialClosureState(at1), { type: "directed" });
    expect(d.log.at(-1)?.text).toContain("so at this setting the directed test saves little");
    const late = seeds(initialClosureState(DEFAULT_CONFIG), 6);
    expect(late.log.at(-1)?.text).toMatch(/about 5\.5 runs of 200 samples, which is the plateau\.$/);
  });

  it("checks off applies to a directed run made afterwards, and the directed line says so", () => {
    const off = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "checks-off", on: true });
    const d = closureReducer(off, { type: "directed" });
    expect(summarize(d).covered).toBe(17);
    expect(summarize(d).evidenceBins).toBe(0);
    expect(d.log.at(-1)?.text).toContain("Checks are still off, and that covers this run too: it adds coverage but no evidence.");
  });

  it("a waiver refused for its reason is marked as a reason problem; other refusals are not", () => {
    const bad = closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "waive", reason: "no" });
    expect(bad.log.at(-1)?.field).toBe("reason");
    const covered = closureReducer(closureReducer(initialClosureState(DEFAULT_CONFIG), { type: "directed" }), { type: "waive", reason: "no" });
    expect(covered.log.at(-1)?.refused).toBe(true);
    expect(covered.log.at(-1)?.field).toBeUndefined();
  });

  it("announcements: every outcome, settings changes with their expectations, and a growing sequence number", () => {
    let v = initialLabView(DEFAULT_CONFIG);
    expect(v.notice).toEqual({ text: "", seq: 0 });
    v = labViewReducer(v, { type: "waive", reason: "no" });
    const first = v.notice;
    v = labViewReducer(v, { type: "waive", reason: "no" });
    expect(v.notice.text).toBe(first.text);
    expect(v.notice.seq).toBe(first.seq + 1);
    const same = labViewReducer(v, { type: "checks-off", on: false });
    expect(same).toBe(v);
    v = labViewReducer(v, { type: "configure", config: { rareP: 0.05 } });
    expect(v.notice.text).toBe(settingsText(v.lab, "configure"));
    expect(v.notice.text).toBe(
      `Settings changed: 16 common bins and a 5% rare bin, 200 samples per run. Expect about ${formatSamples(closureExpectations({ ...DEFAULT_CONFIG, rareP: 0.05 }).all)} samples to close all 17 bins. The first run of seed 4 covered ${summarize(v.lab).covered} of 17.`,
    );
    v = labViewReducer(v, { type: "reset" });
    expect(v.notice.text).toMatch(/^Started over: /);
    const s0 = initialClosureState(DEFAULT_CONFIG);
    const s1 = closureReducer(s0, { type: "directed" });
    expect(announcementText(s0, s1, { type: "directed" })).toBe(s1.log[0].text);
    expect(announcementText(s0, s0, { type: "checks-off", on: false })).toBe("");
  });

  it("axis ticks: the last label is right-aligned; above five decades every other decade is labelled, the last always", () => {
    const six = axisTicks(1e6);
    expect(six).toHaveLength(7);
    expect(six.at(-1)).toEqual({ n: 1e6, label: "1,000,000", anchor: "end" });
    expect(six.map((t) => t.label)).toEqual(["1", null, "100", null, "10,000", null, "1,000,000"]);
    const three = axisTicks(1000);
    expect(three.map((t) => t.label)).toEqual(["1", "10", "100", "1,000"]);
    expect(three.at(-1)?.anchor).toBe("end");
    expect(axisTicks(1e5).filter((t) => t.label !== null)).toHaveLength(MAX_LABELLED_DECADES + 1);
    expect(axisTicks(1e7).map((t) => t.label)).toEqual([null, "10", null, "1,000", null, "100,000", null, "10,000,000"]);
    expect(axisTicks(1)).toEqual([{ n: 1, label: "1", anchor: "middle" }]);
  });

  it("go further: the 32-bin, 0.1% setting, at_least = 2 and crosses, with model-computed numbers, pointing to I-SV-3A", () => {
    const e = closureExpectations({ ...GO_FURTHER_CONFIG, budget: 100, seed: 1 });
    const twice = expectedSamplesDisjoint(p17.map((p) => ({ p, atLeast: 2 })));
    const text = goFurtherText();
    expect(text).toContain(`set 32 common bins at 0.1%. Closing all 33 takes about ${formatSamples(e.all)} samples, the common bins alone about ${formatSamples(e.common)}`);
    expect(text).toContain(`with at_least = 2 the lesson's 17 bins at 0.1% take about ${formatSamples(twice)} samples`);
    expect(text).toContain("§19.7");
    expect(twice).toBeGreaterThan(expectedSamplesToClose(p17));
    expect(FOLLOW_ON_LESSON.href).toBe("/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index");
  });
});
