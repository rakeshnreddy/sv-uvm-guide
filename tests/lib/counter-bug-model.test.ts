import { describe, expect, it } from "vitest";

import {
  ASSERTION_OPTIONS,
  BUGGY_COUNTER,
  DEFAULT_STIMULUS,
  FIXED_COUNTER,
  compareWithSpec,
  counterSourceLines,
  diagnoseEdgePick,
  evalPredicate,
  evaluateAssertion,
  gradeAssertion,
  lineSuspects,
  nextCount,
  simulateCounter,
  specExpected,
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

  it("a 3-bit count <= 3'd7 can never fail: it checks nothing the type does not already guarantee", () => {
    const g = gradeAssertion(byId("tautology"));
    expect(g.onBuggy.verdict).toBe("passes");
    expect(g.onFixed.verdict).toBe("passes");
    expect(g.catchesBug).toBe(false);
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
