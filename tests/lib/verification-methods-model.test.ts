import { describe, expect, it } from "vitest";

import { createRng } from "@/lib/coverage-model";
import {
  BUG_COUNT,
  BUG_HUNT_STEPS,
  COUNT_VALUES,
  COVER_LD_EN,
  CYCLE_BUDGETS,
  LESSON_RANDOM,
  LESSON_TESTS,
  LONG_RUN_SCOPE,
  P_EN_CHOICES,
  P_LD_CHOICES,
  ROWS,
  UNKNOWN_COUNT_RULES,
  allInputs,
  bucketOf,
  bugShare,
  cellKey,
  cellReachable,
  cellShares,
  countDistribution,
  counterexampleWave,
  coverLdEnReachable,
  coverWarning,
  curveText,
  directedVerdict,
  excludedCells,
  formalCheck,
  formatFound,
  formatPercent,
  formatShare,
  foundCurve,
  foundProbabilities,
  foundProbability,
  isBugTrigger,
  maskedAtDZeroText,
  randomCellText,
  randomExplanation,
  reachableCounts,
  rowOf,
  rtlNext,
  runDirected,
  seededRunText,
  seededVisits,
  simulateRandom,
  specNext,
  stepsText,
  visitedCells,
} from "@/lib/verification-methods-model";

const LESSON = "F1B lesson, Directed, constrained-random and formal";

describe(`counter next state (${LESSON}: load wins, injected bug at count 7)`, () => {
  it("spec: ld loads d (load wins), else en increments with 7 + 1 wrapping to 0, else hold", () => {
    expect(specNext(3, { ld: 1, en: 1, d: 6 })).toBe(6);
    expect(specNext(3, { ld: 1, en: 0, d: 6 })).toBe(6);
    expect(specNext(3, { ld: 0, en: 1, d: 6 })).toBe(4);
    expect(specNext(7, { ld: 0, en: 1, d: 0 })).toBe(0);
    expect(specNext(3, { ld: 0, en: 0, d: 6 })).toBe(3);
  });

  it("RTL differs from the spec exactly at count 7 with ld && en && d != 0, over all 8 x 18 combinations", () => {
    const diffs: string[] = [];
    for (const c of COUNT_VALUES) for (const i of allInputs()) if (rtlNext(c, i) !== specNext(c, i)) diffs.push(`${c}:${i.ld}${i.en}:${i.d}`);
    expect(diffs).toEqual([1, 2, 3, 4, 5, 6, 7].map((d) => `7:11:${d}`));
    for (const c of COUNT_VALUES) for (const i of allInputs()) expect(isBugTrigger(c, i)).toBe(rtlNext(c, i) !== specNext(c, i));
  });

  it("d = 0 masks the bug because 7 + 1 wraps to 0 (lesson's own statement)", () => {
    expect(rtlNext(7, { ld: 1, en: 1, d: 0 })).toBe(specNext(7, { ld: 1, en: 1, d: 0 }));
    expect(maskedAtDZeroText()).toContain("7 + 1 = 0");
  });

  it("rejects values outside the 3-bit, 2-state model rather than guessing", () => {
    expect(() => specNext(8, { ld: 0, en: 0, d: 0 })).toThrow(RangeError);
    expect(() => specNext(-1, { ld: 0, en: 0, d: 0 })).toThrow(RangeError);
    expect(() => rtlNext(0, { ld: 0, en: 0, d: 8 })).toThrow(RangeError);
    expect(() => rtlNext(0, { ld: 2 as 0, en: 0, d: 0 })).toThrow(RangeError);
  });

  it("rowOf maps (ld, en) to the grid's four rows", () => {
    expect([rowOf({ ld: 0, en: 0 }), rowOf({ ld: 0, en: 1 }), rowOf({ ld: 1, en: 0 }), rowOf({ ld: 1, en: 1 })]).toEqual(ROWS);
  });
});

describe(`directed tests (${LESSON}: the three tests a busy engineer might write)`, () => {
  const runs = LESSON_TESTS.map((t) => runDirected(t.steps));

  it("the lesson's three tests visit the whole increment row, plus load and hold at count 0, and miss the bug", () => {
    const cells = visitedCells(runs, null);
    expect([...cells].sort()).toEqual([...COUNT_VALUES.map((c) => cellKey("inc", c)), cellKey("hold", 0), cellKey("load", 0)].sort());
    expect(runs.every((r) => !r.found)).toBe(true);
    const v = directedVerdict(LESSON_TESTS.map((t, i) => ({ name: t.name, run: runs[i] })));
    expect(v.found).toBe(false);
    expect(v.text).toMatch(/No selected test asks for load and increment together at count 7/);
  });

  it("a fourth test, reset, load 7, then ld+en with d = 3, finds the bug at step 3: spec 3, RTL 0", () => {
    const run = runDirected(BUG_HUNT_STEPS);
    expect(stepsText(BUG_HUNT_STEPS)).toBe("reset, load 7, ld+en with d = 3");
    expect(run.found).toBe(true);
    expect(run.foundAtStep).toBe(3);
    expect(run.trace[2]).toMatchObject({ count: 7, row: "loadInc", d: 3, specNext: 3, rtlNext: 0, diverges: true });
    expect(directedVerdict([{ name: "Test 4", run }]).text).toBe(
      "Found by Test 4 at step 3: count 7, ld and en both 1, d = 3. The spec gives 3, the RTL gives 0; a scoreboard sees it at the next edge.",
    );
  });

  it("the same test with d = 0 visits the bug cell but cannot find the bug", () => {
    const run = runDirected([{ kind: "reset" }, { kind: "load", d: 7 }, { kind: "loadInc", d: 0 }]);
    expect(run.found).toBe(false);
    expect(visitedCells([run], 0).has(cellKey("loadInc", 7))).toBe(true);
    expect(visitedCells([run], 3).has(cellKey("loadInc", 7))).toBe(false);
    expect(directedVerdict([{ name: "T", run }]).text).toMatch(/only with d = 0/);
  });

  it("steps before the first reset have an unknown count and are not placed on the grid; an empty selection finds nothing", () => {
    const run = runDirected([{ kind: "inc" }, { kind: "reset" }, { kind: "inc" }]);
    expect(run.unknownSteps).toBe(1);
    expect(run.trace[0].count).toBeNull();
    expect([...visitedCells([run], null)]).toEqual([cellKey("inc", 0)]);
    expect(directedVerdict([]).found).toBe(false);
  });

  it("hold before any reset keeps the count unknown (IEEE 1800-2023 §6.8 Table 6-7 'x start; §11.4.3 x + 1 is x)", () => {
    const run = runDirected([{ kind: "hold" }, { kind: "inc" }, { kind: "hold" }]);
    expect(run.unknownSteps).toBe(3);
    expect(run.trace.map((r) => [r.count, r.rtlNext, r.specNext])).toEqual([
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
    expect(visitedCells([run], null).size).toBe(0);
    expect(UNKNOWN_COUNT_RULES).toMatch(/until a reset or a load/i);
  });

  it("a load before any reset makes the count known: count = d whatever count was", () => {
    const run = runDirected([{ kind: "load", d: 5 }, { kind: "inc" }, { kind: "hold" }]);
    expect(run.unknownSteps).toBe(1);
    expect(run.trace[0]).toMatchObject({ count: null, row: "load", d: 5, rtlNext: 5, specNext: 5, diverges: false, codingDependent: false });
    expect(run.trace[1]).toMatchObject({ count: 5, rtlNext: 6, specNext: 6 });
    expect([...visitedCells([run], null)].sort()).toEqual([cellKey("hold", 6), cellKey("inc", 5)].sort());
  });

  it("no reset: load 7, then ld+en with d = 3 finds the bug at step 2 (count is 7 from the load), as a 4-state simulation would", () => {
    const steps = [{ kind: "load", d: 7 }, { kind: "loadInc", d: 3 }] as const;
    const run = runDirected(steps);
    expect(run.unknownSteps).toBe(1);
    expect(run.found).toBe(true);
    expect(run.foundAtStep).toBe(2);
    expect(run.trace[1]).toMatchObject({ count: 7, row: "loadInc", d: 3, specNext: 3, rtlNext: 0, diverges: true });
    expect(directedVerdict([{ name: "T", run }]).text).toMatch(/^Found by T at step 2: count 7/);
  });

  it("ld+en at an unknown count: the spec loads d, the buggy RTL stays X (coding-dependent, §12.4), and the verdict states the limit", () => {
    const run = runDirected([{ kind: "loadInc", d: 7 }, { kind: "loadInc", d: 3 }, { kind: "load", d: 7 }, { kind: "loadInc", d: 3 }]);
    expect(run.trace[0]).toMatchObject({ count: null, specNext: 7, rtlNext: null, diverges: false, codingDependent: true });
    expect(run.trace[1]).toMatchObject({ count: null, specNext: 3, rtlNext: null, codingDependent: true });
    expect(run.codingDependentSteps).toEqual([1, 2]);
    expect(run.unknownSteps).toBe(3);
    // The load at step 3 makes the RTL count known again, and step 4 then fires the bug.
    expect(run.foundAtStep).toBe(4);
    const missed = runDirected([{ kind: "loadInc", d: 7 }, { kind: "loadInc", d: 3 }]);
    expect(missed.found).toBe(false);
    expect(directedVerdict([{ name: "T", run: missed }]).text).toMatch(/Limit: T step 1 drives ld and en together while count is still X; .*§12\.4/);
    // The lesson's tests have no such limit, so their verdict carries no note.
    expect(directedVerdict(LESSON_TESTS.map((t) => ({ name: t.name, run: runDirected(t.steps) }))).text).not.toMatch(/Limit/);
  });

  it("formatPercent keeps 99.56% from rounding to 100% and never prints 100% for a probability below 1", () => {
    expect(formatPercent(0.99999)).toBe("> 99.99%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(1, true)).toBe("> 99.99%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.0055)).toBe("0.55%");
  });

  it("formatPercent never shows a number on the wrong side of a bucket boundary", () => {
    expect(formatPercent(0.0999936)).toBe("9.999%");
    expect(bucketOf(0.0999936)).toBe("rare");
    expect(formatPercent(0.0996)).toBe("9.96%");
    expect(formatPercent(0.1)).toBe("10.0%");
    expect(formatPercent(0.4999)).toBe("49.99%");
    expect(formatPercent(0.89996)).toBe("89.996%");
    // Every selectable control setting and budget: the shown number agrees with the bucket.
    for (const pEn of P_EN_CHOICES)
      for (const pLd of P_LD_CHOICES)
        for (const n of CYCLE_BUDGETS) {
          const p = foundProbability({ pEn, pLd }, n);
          const shown = Number(formatFound({ pEn, pLd }, n).replace(/[^0-9.]/g, "")) / 100;
          if (shown === 0) continue;
          const b = bucketOf(p);
          if (b === "rare") expect(shown).toBeLessThan(0.1);
          if (b === "sometimes") expect(shown >= 0.1 && shown < 0.5).toBe(true);
          if (b === "usually") expect(shown >= 0.5 && shown < 0.9).toBe(true);
          if (b === "almost-always") expect(shown).toBeGreaterThanOrEqual(0.9);
        }
  });

  it("stepsText compresses repeats", () => {
    expect(stepsText(LESSON_TESTS[0].steps)).toBe("reset, increment ×8");
  });
});

describe(`constrained random (${LESSON}: en 50%, ld 10%, d uniform; exact Markov chain over count)`, () => {
  it("pins the audit-verified reachability: 7.7% within 20 cycles, 40% within 100, 99.56% within 1,000", () => {
    expect(foundProbability(LESSON_RANDOM, 20)).toBeCloseTo(0.07669637, 7);
    expect(foundProbability(LESSON_RANDOM, 100)).toBeCloseTo(0.40299042, 7);
    expect(foundProbability(LESSON_RANDOM, 1000)).toBeCloseTo(0.99561476, 7);
    expect([20, 100, 1000].map((n) => formatPercent(foundProbability(LESSON_RANDOM, n)))).toEqual(["7.7%", "40.3%", "99.56%"]);
  });

  it("recomputes the lesson figure's ~8% (20 cycles) and ~99.6% (1,000 cycles)", () => {
    expect(Math.round(foundProbability(LESSON_RANDOM, 20) * 100)).toBe(8);
    expect((foundProbability(LESSON_RANDOM, 1000) * 100).toFixed(1)).toBe("99.6");
  });

  it("is not a geometric approximation: the first 7 cycles cannot reach count 7 and fire the bug before cycle 2", () => {
    const curve = foundProbabilities(LESSON_RANDOM, 30);
    expect(curve[0]).toBe(0);
    expect(curve[1]).toBe(0); // cycle 1 is at count 0
    expect(curve[2]).toBeGreaterThan(0); // load 7 at cycle 1, ld+en at cycle 2
    const share = bugShare(LESSON_RANDOM);
    const geometric = 1 - (1 - share) ** 20;
    expect(Math.abs(curve[20] - geometric)).toBeGreaterThan(1e-3);
    for (let n = 1; n < curve.length; n++) expect(curve[n]).toBeGreaterThanOrEqual(curve[n - 1]);
  });

  it("shares match the lesson figure: 5.6% per cell in hold and increment, 0.6% in the load rows, bug about 0.55%", () => {
    {
      const shares = cellShares(LESSON_RANDOM);
      for (const c of COUNT_VALUES) {
        expect(formatShare(shares.hold[c])).toBe("5.6");
        expect(formatShare(shares.inc[c])).toBe("5.6");
        expect(formatShare(shares.load[c])).toBe("0.6");
        expect(formatShare(shares.loadInc[c])).toBe("0.6");
      }
      const total = ROWS.reduce((s, r) => s + shares[r].reduce((a, b) => a + b, 0), 0);
      expect(total).toBeCloseTo(1, 12);
    }
    // The bug-free spec is doubly stochastic: count is exactly uniform, so 0.45 / 8 and 0.05 / 8.
    expect(cellShares(LESSON_RANDOM, null, "spec").hold[3]).toBeCloseTo(0.05625, 12);
    expect(cellShares(LESSON_RANDOM, null, "spec").loadInc[7]).toBeCloseTo(0.00625, 12);
    expect(formatPercent(bugShare(LESSON_RANDOM))).toBe("0.55%");
    expect(bugShare(LESSON_RANDOM)).toBeCloseTo(0.00625 * 7 / 8, 12);
  });

  it("the shares are the spec counter's (= the RTL before the bug first fires); the buggy RTL run forever drifts toward count 0", () => {
    const rtl = countDistribution(LESSON_RANDOM, "rtl");
    expect(rtl.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(rtl[0]).toBeGreaterThan(1 / 8);
    expect(formatShare(cellShares(LESSON_RANDOM, null, "rtl").hold[0])).toBe("5.9");
    expect(countDistribution(LESSON_RANDOM, "spec").every((p) => Math.abs(p - 1 / 8) < 1e-12)).toBe(true);
  });

  it("a d slice divides the load rows by 8 and leaves hold and increment alone", () => {
    const all = cellShares(LESSON_RANDOM, null, "spec");
    const slice = cellShares(LESSON_RANDOM, 3, "spec");
    expect(slice.hold[2]).toBeCloseTo(all.hold[2], 12);
    expect(slice.load[2]).toBeCloseTo(all.load[2] / 8, 12);
  });

  it("edge cases: P(ld) = 0 or P(en) = 0 never reaches the bug; P = 0 for both holds at reset; out-of-range probabilities throw", () => {
    expect(foundProbability({ pEn: 0.5, pLd: 0 }, 1000)).toBe(0);
    expect(foundProbability({ pEn: 0, pLd: 0.5 }, 1000)).toBe(0);
    expect(randomExplanation({ pEn: 0.5, pLd: 0 }, 20)).toMatch(/ld is never 1/);
    expect(countDistribution({ pEn: 0, pLd: 0 })).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => foundProbability({ pEn: 1.5, pLd: 0.1 }, 20)).toThrow(RangeError);
    expect(() => foundProbability({ pEn: Number.NaN, pLd: 0.1 }, 20)).toThrow(RangeError);
    expect(() => foundProbabilities(LESSON_RANDOM, -1)).toThrow(RangeError);
    // P(ld) = P(en) = 1: cycle 1 loads d from count 0, and from count 7 every d != 0 fires.
    expect(foundProbability({ pEn: 1, pLd: 1 }, 2)).toBeCloseTo((1 / 8) * (7 / 8), 12);
  });

  it("buckets and explanation text are generated from the numbers", () => {
    expect(bucketOf(foundProbability(LESSON_RANDOM, 20))).toBe("rare");
    expect(bucketOf(foundProbability(LESSON_RANDOM, 100))).toBe("sometimes");
    expect(bucketOf(foundProbability(LESSON_RANDOM, 1000))).toBe("almost-always");
    expect(randomExplanation(LESSON_RANDOM, 20)).toContain("7.7% of seeds");
  });

  it("P(en) 0.75, P(ld) 0.5 at 1,000 cycles: the double rounds to 1, but a bug-avoiding path exists, so no text says 100%", () => {
    const params = { pEn: 0.75, pLd: 0.5 };
    const curve = foundCurve(params, 1000);
    expect(curve.p[1000]).toBe(1);
    expect(curve.belowOne[1000]).toBe(true);
    expect(formatFound(params, 1000)).toBe("> 99.99%");
    expect(randomExplanation(params, 1000)).toContain("> 99.99% of seeds reach it");
    expect(randomExplanation(params, 1000)).not.toMatch(/100%/);
    expect(curveText(params)).toContain("> 99.99% within 1,000 cycles");
    expect(curveText(params)).not.toMatch(/100%/);
    // A path that avoids the bug always exists here (hold, increment, or load d = 0), so belowOne holds at every n.
    expect(curve.belowOne.every(Boolean)).toBe(true);
    expect(foundCurve({ pEn: 1, pLd: 1 }, 50).belowOne.every(Boolean)).toBe(true);
  });

  it("P(en) 1, P(ld) 0.01 at 100 cycles: 9.99936% is shown as 9.999%, inside its 'under 10%' bucket", () => {
    const p = foundProbability({ pEn: 1, pLd: 0.01 }, 100);
    expect(p).toBeCloseTo(0.0999936, 6);
    expect(bucketOf(p)).toBe("rare");
    expect(formatFound({ pEn: 1, pLd: 0.01 }, 100)).toBe("9.999%");
  });

  it("the long-run bug share is scoped to the bug-free counter, which the RTL matches until the bug first fires", () => {
    expect(randomExplanation(LESSON_RANDOM, 20)).toContain(`0.55% of cycles in the long run, ${LONG_RUN_SCOPE}.`);
    const run = simulateRandom(LESSON_RANDOM, 20, 1);
    const text = randomCellText(LESSON_RANDOM, "hold", 2, null, run, 20);
    expect(text).toBe(`count 2, hold: 5.6% of cycles in the long run (bug-free counter). Seed 1: ${seededVisits(run, 20, null).get(cellKey("hold", 2)) ?? 0} ${(seededVisits(run, 20, null).get(cellKey("hold", 2)) ?? 0) === 1 ? "visit" : "visits"} in cycles 1 to 20.`);
    // Precomputed shares and visits give the same sentence as computing them per cell.
    for (const row of ROWS)
      for (const c of COUNT_VALUES)
        expect(randomCellText(LESSON_RANDOM, row, c, 3, run, 12, { shares: cellShares(LESSON_RANDOM, 3), visits: seededVisits(run, 12, 3) })).toBe(randomCellText(LESSON_RANDOM, row, c, 3, run, 12));
  });

  it("a seeded run uses coverage-model's createRng (en, ld, d drawn in that order) and is reproducible", () => {
    const run = simulateRandom(LESSON_RANDOM, 50, 7);
    const rng = createRng(7);
    const en = rng() < 0.5 ? 1 : 0;
    const ld = rng() < 0.1 ? 1 : 0;
    const d = Math.floor(rng() * 8);
    expect(run.samples[0]).toEqual({ count: 0, inputs: { ld, en, d } });
    expect(simulateRandom(LESSON_RANDOM, 50, 7)).toEqual(run);
    for (let i = 1; i < run.samples.length; i++) expect(run.samples[i].count).toBe(rtlNext(run.samples[i - 1].count, run.samples[i - 1].inputs));
    const total = [...seededVisits(run, 50, null).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(50);
  });

  it("the seeded-run sentence matches the run's own first trigger", () => {
    let seed = 1;
    let run = simulateRandom(LESSON_RANDOM, 1000, seed);
    while (run.foundAtCycle === null && seed < 50) run = simulateRandom(LESSON_RANDOM, 1000, ++seed);
    expect(run.foundAtCycle).not.toBeNull();
    const at = run.foundAtCycle as number;
    expect(isBugTrigger(run.samples[at - 1].count, run.samples[at - 1].inputs)).toBe(true);
    expect(seededRunText(run)).toContain(`driven at cycle ${at}`);
    if (at > 1) expect(seededRunText(run, at - 1)).toMatch(/missed by this seed/);
  });
});

describe(`formal reachability (${LESSON}; IEEE 1800-2023 §16.2 assume and cover framing)`, () => {
  it("without assumptions every count is reachable and BFS returns the 3-edge counterexample: reset, load 7, ld+en with d != 0", () => {
    expect(reachableCounts("none").size).toBe(8);
    const r = formalCheck("none");
    expect(r.kind).toBe("counterexample");
    if (r.kind !== "counterexample") return;
    expect(r.edges).toBe(3);
    expect(r.inputs).toEqual([
      { ld: 1, en: 0, d: 7 },
      { ld: 1, en: 1, d: 3 },
    ]);
    expect(r.text).toBe("Counterexample in 3 edges: reset, then load 7, then ld+en with d = 3. The check fails at the next edge.");
    const fallback = formalCheck("none", 0);
    expect(fallback.kind === "counterexample" && fallback.inputs[1].d).toBe(1);
  });

  it("the counterexample waveform matches the lesson's TimingDiagram (rst, ld, en, d, expected, count)", () => {
    const r = formalCheck("none");
    if (r.kind !== "counterexample") throw new Error("expected a counterexample");
    const w = counterexampleWave(r);
    expect(w.edges).toBe(4);
    const v = Object.fromEntries(w.signals.map((s) => [s.name, s.values]));
    expect(v.rst).toEqual([1, 0, 0, 0]);
    expect(v.ld).toEqual([0, 1, 1, 0]);
    expect(v.en).toEqual([0, 0, 1, 0]);
    expect(v.d).toEqual([0, 7, 3, 3]);
    expect(v.expected).toEqual([undefined, 0, 7, 3]);
    expect(v.count).toEqual([undefined, 0, 7, 0]);
    expect([w.triggerEdge, w.divergeEdge]).toEqual([2, 3]);
  });

  it("assume !(ld && en): the load + increment row is excluded, the proof passes and the bug is hidden", () => {
    const r = formalCheck("noLdEn");
    expect(r.kind).toBe("proof");
    expect(r.text).toMatch(/^Proof passes, bug hidden/);
    const ex = excludedCells("noLdEn", null);
    expect([...ex].sort()).toEqual(COUNT_VALUES.map((c) => cellKey("loadInc", c)).sort());
    expect(cellReachable("noLdEn", 7, "loadInc", null)).toBe(false);
  });

  it("the guard: cover (ld && en) is unreachable under !(ld && en) and reachable otherwise", () => {
    expect(coverLdEnReachable("noLdEn")).toBe(false);
    expect(coverWarning("noLdEn")).toBe(`${COVER_LD_EN}: unreachable under assumptions. The assumption has removed a scenario that must stay reachable.`);
    expect(coverWarning("none")).toBeNull();
    expect(coverWarning("dNot7")).toBeNull();
  });

  it("assume d != 7 does not hide the bug: the counterexample grows to 4 edges (reset, load 6, increment, ld+en)", () => {
    const r = formalCheck("dNot7");
    expect(r.kind === "counterexample" && r.edges).toBe(4);
    expect(r.text).toBe("Counterexample in 4 edges: reset, then load 6, then increment, then ld+en with d = 3. The check fails at the next edge.");
    expect(excludedCells("dNot7", 7)).toEqual(new Set(COUNT_VALUES.flatMap((c) => [cellKey("load", c), cellKey("loadInc", c)])));
    expect(excludedCells("dNot7", null).size).toBe(0);
  });
});
