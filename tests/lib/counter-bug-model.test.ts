import { describe, expect, it } from "vitest";

import {
  ASSERTION_OPTIONS,
  BUGGY_COUNTER,
  DEFAULT_STIMULUS,
  FIXED_COUNTER,
  NONVACUOUS_PREDICTION_IDS,
  antecedentCover,
  bugCatchOutcome,
  compareWithSpec,
  counterSourceLines,
  coverHits,
  describeEvaluation,
  diagnoseEdgePick,
  evalPredicate,
  evaluateAssertion,
  gradeAssertion,
  lineSuspects,
  nextCount,
  nonvacuousPredictionHolds,
  simulateCounter,
  specExpected,
  tallyAttempts,
} from "@/lib/counter-bug-model";

const byId = (id: string) => {
  const a = ASSERTION_OPTIONS.find((o) => o.id === id);
  if (!a) throw new Error(`missing assertion ${id}`);
  return a;
};

describe("counter-bug-model: RTL behaviour", () => {
  it("the seeded bug wraps from 6 to 0, so 7 is never sampled", () => {
    const trace = simulateCounter(BUGGY_COUNTER);
    expect(trace.count).toEqual(["X", 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3]);
    expect(trace.count).not.toContain(7);
  });

  it("the fixed RTL counts 0..7 and wraps, matching the 3-bit spec", () => {
    expect(simulateCounter(FIXED_COUNTER).count).toEqual(["X", 0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2]);
  });

  it("§12.4: without reset the count stays X (x condition takes else; X + 1 = X)", () => {
    expect(nextCount(BUGGY_COUNTER, "X", 0)).toBe("X");
    const noReset = simulateCounter(BUGGY_COUNTER, { edges: 4, rst: [0, 0, 0, 0] });
    expect(noReset.count).toEqual(["X", "X", "X", "X"]);
  });

  it("synchronous reset wins over every other branch", () => {
    expect(nextCount(BUGGY_COUNTER, 6, 1)).toBe(0);
    expect(nextCount(BUGGY_COUNTER, "X", 1)).toBe(0);
  });

  it("source code is generated from the design data, so code and waveform cannot drift", () => {
    const wrapLine = (d = BUGGY_COUNTER) => counterSourceLines(d).find((l) => l.key === "wrap")?.text;
    expect(wrapLine()).toContain("count == 3'd6");
    expect(wrapLine(FIXED_COUNTER)).toContain("count == 3'd7");
  });
});

describe("counter-bug-model: spec comparison and edge diagnosis", () => {
  it("the spec expects 0..7 then 0 after reset, unspecified before it", () => {
    expect(specExpected(DEFAULT_STIMULUS)).toEqual([null, 0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2]);
  });

  it("the first mismatch is edge 8 (expected 7, saw 0); the fixed design has none", () => {
    const cmp = compareWithSpec(simulateCounter(BUGGY_COUNTER));
    expect(cmp.firstMismatch).toBe(8);
    expect(cmp.checks[0]).toBe("unspecified");
    expect(cmp.checks.slice(1, 8).every((c) => c === "match")).toBe(true);
    expect(compareWithSpec(simulateCounter(FIXED_COUNTER)).firstMismatch).toBeNull();
  });

  it("diagnoses each kind of wrong pick differently", () => {
    const trace = simulateCounter(BUGGY_COUNTER);
    expect(diagnoseEdgePick(trace, 8)).toMatchObject({ correct: true, kind: "first-mismatch" });
    expect(diagnoseEdgePick(trace, 7)).toMatchObject({ correct: false, kind: "cause" });
    expect(diagnoseEdgePick(trace, 9)).toMatchObject({ correct: false, kind: "later-mismatch" });
    expect(diagnoseEdgePick(trace, 0)).toMatchObject({ correct: false, kind: "unspecified" });
    expect(diagnoseEdgePick(trace, 3)).toMatchObject({ correct: false, kind: "match" });
    expect(diagnoseEdgePick(trace, 8).message).toMatch(/expects 7/);
  });

  it("exactly one suspect line is the culprit, and it is the wrap comparison", () => {
    const culprits = lineSuspects().filter((s) => s.culprit);
    expect(culprits.map((c) => c.key)).toEqual(["wrap"]);
  });
});

describe("counter-bug-model: assertion evaluation (IEEE 1800-2023 §16)", () => {
  it("§16.6: an x operand makes the assertion boolean false", () => {
    expect(evalPredicate({ op: "==", value: 6 }, "X")).toBe(false);
    expect(evalPredicate({ op: "<=", value: 7 }, "X")).toBe(false);
  });

  it("§16.12.7 |=>: count == 6 |=> count == 7 fails at edge 8 on the bug and passes on the fix", () => {
    const g = gradeAssertion(byId("catch"));
    expect(g.onBuggy.verdict).toBe("fails");
    expect(g.onBuggy.firstFailure).toBe(8);
    expect(g.onFixed.verdict).toBe("passes");
    expect(g.catchesBug).toBe(true);
    expect(g.falseAlarm).toBe(false);
  });

  it("§16.14.8: count == 7 |=> count == 0 is vacuous on the bug (7 never occurs) but real on the fix", () => {
    const g = gradeAssertion(byId("wrap-vacuous"));
    expect(g.onBuggy.verdict).toBe("vacuous");
    expect(g.onBuggy.nonvacuousPasses).toBe(0);
    expect(g.onFixed.verdict).toBe("passes");
    expect(g.onFixed.nonvacuousPasses).toBe(1);
    expect(g.catchesBug).toBe(false);
  });

  it("count <= 3'd7 never fails here: every known 3-bit value is at most 7, and disable iff (rst) masks the X before reset", () => {
    const g = gradeAssertion(byId("tautology"));
    expect(g.onBuggy.verdict).toBe("passes");
    expect(g.onFixed.verdict).toBe("passes");
    expect(g.catchesBug).toBe(false);
    // §16.6: X <= 3'd7 is x, which the assertion treats as false. Only disable iff hides it.
    expect(evalPredicate({ op: "<=", value: 7 }, "X")).toBe(false);
    const noDisable = evaluateAssertion({ ...byId("tautology"), disableOnRst: false }, simulateCounter(BUGGY_COUNTER));
    expect(noDisable.firstFailure).toBe(0);
  });

  it("bugCatchOutcome: failing on the buggy counter is not the same as catching the bug", () => {
    expect(bugCatchOutcome(gradeAssertion(byId("catch")))).toEqual({ kind: "catches", edge: 8 });
    expect(bugCatchOutcome(gradeAssertion(byId("wrap-vacuous")))).toEqual({ kind: "misses" });
    expect(bugCatchOutcome(gradeAssertion(byId("tautology")))).toEqual({ kind: "misses" });
    // The same-cycle check fires at edge 7, where the buggy counter still samples 6 as the spec expects.
    // The bug first shows at edge 8.
    expect(bugCatchOutcome(gradeAssertion(byId("same-cycle")))).toEqual({ kind: "fires-off-bug", edge: 7, sample: 6, check: "match" });
    expect(compareWithSpec(simulateCounter(BUGGY_COUNTER)).firstMismatch).toBe(8);
  });

  it("§16.12.7 |->: count == 6 |-> count == 7 checks the same tick, so it fails on the fix too (false alarm)", () => {
    const g = gradeAssertion(byId("same-cycle"));
    expect(g.onBuggy.firstFailure).toBe(7);
    expect(g.onFixed.firstFailure).toBe(7);
    expect(g.falseAlarm).toBe(true);
    expect(g.catchesBug).toBe(false);
  });

  it("disable iff (rst) abandons the attempt that starts while reset is asserted", () => {
    const evaluation = evaluateAssertion(byId("catch"), simulateCounter(BUGGY_COUNTER));
    expect(evaluation.attempts[0].status).toBe("disabled");
    // Without disable iff the edge-0 attempt sees count = X: antecedent false → vacuous (§16.6).
    const noDisable = evaluateAssertion(byId("same-cycle"), simulateCounter(BUGGY_COUNTER));
    expect(noDisable.attempts[0].status).toBe("vacuous");
  });

  it("an |=> attempt at the last edge has no next tick yet and stays pending", () => {
    const evaluation = evaluateAssertion(byId("catch"), simulateCounter(FIXED_COUNTER, { edges: 8, rst: [1, 0, 0, 0, 0, 0, 0, 0] }));
    expect(evaluation.attempts[7]).toMatchObject({ status: "pending" });
  });

  it("assertion source text is valid SVA built from the same data", () => {
    expect(byId("catch").source).toBe("assert property (@(posedge clk) disable iff (rst) count == 3'd6 |=> count == 3'd7);");
    expect(byId("same-cycle").source).toBe("assert property (@(posedge clk) count == 3'd6 |-> count == 3'd7);");
    expect(byId("tautology").source).toBe("assert property (@(posedge clk) disable iff (rst) count <= 3'd7);");
  });
});

const tallyOf = (id: string, design = BUGGY_COUNTER, stimulus = DEFAULT_STIMULUS) => tallyAttempts(evaluateAssertion(byId(id), simulateCounter(design, stimulus)));

describe("counter-bug-model: attempt tally (IEEE 1800-2023 §16.14.8, §16.14.3)", () => {
  it("the default run has 12 edges, so every assertion gets 12 attempts on each counter", () => {
    expect(DEFAULT_STIMULUS.edges).toBe(12);
    for (const a of ASSERTION_OPTIONS) {
      expect(tallyOf(a.id).attempts).toBe(12);
      expect(tallyOf(a.id, FIXED_COUNTER).attempts).toBe(12);
    }
  });

  it("the outcomes partition the attempts: nonvacuous + vacuous + failures + disabled + pending = attempts", () => {
    for (const a of ASSERTION_OPTIONS) {
      for (const design of [BUGGY_COUNTER, FIXED_COUNTER]) {
        const t = tallyOf(a.id, design);
        expect(t.nonvacuous + t.vacuous + t.failures + t.disabled + t.pending).toBe(t.attempts);
      }
    }
  });

  it("§16.12.7 + §16.14.8: count == 7 |=> count == 0 on the buggy counter has 0 nonvacuous successes and 0 failures", () => {
    // Edge 0 is disabled by rst; edges 1-11 never sample 7, so each is a vacuous success.
    expect(tallyOf("wrap-vacuous")).toEqual({ attempts: 12, nonvacuous: 0, vacuous: 11, failures: 0, disabled: 1, pending: 0 });
  });

  it("§16.14.8: the same assertion on the fixed counter checks once (edge 8 → edge 9) and succeeds nonvacuously", () => {
    expect(tallyOf("wrap-vacuous", FIXED_COUNTER)).toEqual({ attempts: 12, nonvacuous: 1, vacuous: 10, failures: 0, disabled: 1, pending: 0 });
    const attempt8 = evaluateAssertion(byId("wrap-vacuous"), simulateCounter(FIXED_COUNTER)).attempts[8];
    expect(attempt8).toEqual({ start: 8, status: "pass", decidedAt: 9 });
  });

  it("count == 6 |=> count == 7: the one real check fails on the bug and succeeds on the fix", () => {
    expect(tallyOf("catch")).toEqual({ attempts: 12, nonvacuous: 0, vacuous: 10, failures: 1, disabled: 1, pending: 0 });
    expect(tallyOf("catch", FIXED_COUNTER)).toEqual({ attempts: 12, nonvacuous: 1, vacuous: 10, failures: 0, disabled: 1, pending: 0 });
  });

  it("§16.14.8 (a): a property with no implication is never vacuous, so the tautology succeeds nonvacuously every enabled edge", () => {
    expect(tallyOf("tautology")).toEqual({ attempts: 12, nonvacuous: 11, vacuous: 0, failures: 0, disabled: 1, pending: 0 });
  });

  it("§16.6: without disable iff, the edge-0 attempt of count == 6 |-> count == 7 sees X, so its antecedent is false (vacuous)", () => {
    expect(tallyOf("same-cycle")).toEqual({ attempts: 12, nonvacuous: 0, vacuous: 11, failures: 1, disabled: 0, pending: 0 });
  });

  it("an |=> attempt whose antecedent matches at the last edge is counted as pending, not as a success", () => {
    const t = tallyOf("catch", FIXED_COUNTER, { edges: 8, rst: [1, 0, 0, 0, 0, 0, 0, 0] });
    expect(t).toEqual({ attempts: 8, nonvacuous: 0, vacuous: 6, failures: 0, disabled: 1, pending: 1 });
  });

  it("the tally is derived from the attempt statuses evaluateAssertion reports", () => {
    const evaluation = evaluateAssertion(byId("wrap-vacuous"), simulateCounter(FIXED_COUNTER));
    const t = tallyAttempts(evaluation);
    expect(t.nonvacuous).toBe(evaluation.nonvacuousPasses);
    expect(t.vacuous).toBe(evaluation.vacuous);
  });
});

describe("counter-bug-model: antecedent cover (IEEE 1800-2023 §16.14.3)", () => {
  const cover = antecedentCover(byId("wrap-vacuous"));

  it("the cover for the wrap rule is the cover property on its antecedent, generated from the same data", () => {
    expect(cover?.source).toBe("cover property (@(posedge clk) count == 3'd7);");
    expect(cover?.predicate).toEqual(byId("wrap-vacuous").antecedent);
    expect(antecedentCover(byId("tautology"))).toBeNull();
  });

  it("§16.14.3: with DEFAULT_STIMULUS the cover hits 0 times on the buggy counter and once (edge 8) on the fixed one", () => {
    if (!cover) throw new Error("missing cover");
    expect(coverHits(simulateCounter(BUGGY_COUNTER), cover.predicate)).toEqual([]);
    expect(coverHits(simulateCounter(FIXED_COUNTER), cover.predicate)).toEqual([8]);
  });

  it("§16.6: the cover samples like the assertion does, so the X at edge 0 never counts as a hit", () => {
    expect(coverHits(simulateCounter(BUGGY_COUNTER), { op: "<=", value: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("a 0 on the antecedent cover means the |=> assertion never completed a real check", () => {
    for (const design of [BUGGY_COUNTER, FIXED_COUNTER]) {
      const trace = simulateCounter(design);
      const t = tallyAttempts(evaluateAssertion(byId("wrap-vacuous"), trace));
      const hits = coverHits(trace, byId("wrap-vacuous").antecedent ?? { op: "==", value: 7 });
      // rst is low at every hit, so every antecedent match becomes exactly one checked attempt.
      expect(t.nonvacuous + t.failures + t.pending).toBe(hits.length);
    }
  });
});

describe("counter-bug-model: the nonvacuous-success prediction", () => {
  const holds = (id: string) => {
    const buggy = tallyOf(id);
    const fixed = tallyOf(id, FIXED_COUNTER);
    return NONVACUOUS_PREDICTION_IDS.filter((p) => nonvacuousPredictionHolds(p, buggy, fixed));
  };

  it("for the wrap rule exactly one answer is true: 0 (not 'same as fixed' = 1, not 'every attempt' = 12)", () => {
    expect(holds("wrap-vacuous")).toEqual(["zero"]);
  });

  it("the answers are judged from the tallies, not hard-coded", () => {
    // The tautology succeeds 11 times on both counters: the same as fixed, but not every attempt (edge 0 is disabled).
    expect(holds("tautology")).toEqual(["same-as-fixed"]);
  });
});

describe("counter-bug-model: learner-facing wording (IEEE 1800-2023 §16.14.8)", () => {
  it("a vacuous verdict is never described as a pass", () => {
    const text = describeEvaluation(gradeAssertion(byId("wrap-vacuous")).onBuggy);
    expect(text).toBe("never fails, but no attempt completed a real check (11 vacuous successes, 1 disabled, 0 nonvacuous)");
    expect(text).not.toMatch(/pass/);
  });

  it("failures and nonvacuous successes keep their wording", () => {
    expect(describeEvaluation(gradeAssertion(byId("catch")).onBuggy)).toBe("fails at edge 8");
    expect(describeEvaluation(gradeAssertion(byId("catch")).onFixed)).toBe("never fails (1 real check passed)");
  });
});
