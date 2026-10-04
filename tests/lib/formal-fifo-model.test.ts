import { describe, expect, it } from "vitest";

import {
  CONTRACT_ASSUMPTIONS,
  FIFO_DEPTH,
  classifyReplay,
  evaluateAssertion,
  propertyModuleLines,
  replaySequenceLines,
  replayTrace,
  runFormal,
  simulateRandom,
  type AssumptionId,
} from "@/lib/formal-fifo-model";

const contract = [...CONTRACT_ASSUMPTIONS] as AssumptionId[];

describe("formal-fifo-model: formal engine (assumptions constrain, assertions are obligations)", () => {
  it("§16.14.2: with the interface contract assumed, the correct FIFO proves both assertions and covers count == DEPTH", () => {
    const r = runFormal({ dut: "correct", assumptions: contract });
    expect(r.assertions.p_count_in_range.status).toBe("proven");
    expect(r.assertions.p_full_is_correct.status).toBe("proven");
    expect(r.assertions.p_full_is_correct.vacuous).toBe(false);
    expect(r.covers.c_reach_depth.status).toBe("covered");
    expect(r.covers.c_reach_depth.hitCycle).toBe(FIFO_DEPTH);
  });

  it("pairing: dropping a_no_push_when_full breaks p_count_in_range (overflow), not p_full_is_correct", () => {
    const r = runFormal({ dut: "correct", assumptions: ["a_no_pop_when_empty"] });
    const cex = r.assertions.p_count_in_range;
    expect(cex.status).toBe("cex");
    expect(cex.failCycle).toBe(5);
    expect(cex.trace?.map((c) => c.push)).toEqual([1, 1, 1, 1, 1, 0]);
    expect(cex.trace?.[4]).toMatchObject({ count: 4, full: 1, push: 1 });
    expect(cex.trace?.[5].count).toBe(5);
    // Overflow does not violate (count == DEPTH) |-> full: full is still decoded from count.
    expect(r.assertions.p_full_is_correct.status).toBe("proven");
  });

  it("pairing: dropping a_no_pop_when_empty lets the 3-bit count wrap 0 → 7 at edge 1", () => {
    const r = runFormal({ dut: "correct", assumptions: ["a_no_push_when_full"] });
    expect(r.assertions.p_count_in_range.status).toBe("cex");
    expect(r.assertions.p_count_in_range.failCycle).toBe(1);
    expect(r.assertions.p_count_in_range.trace?.[1].count).toBe(7);
    expect(r.assertions.p_count_in_range.why).toMatch(/pops while empty/);
  });

  it("reports which assumptions each proof depends on", () => {
    const r = runFormal({ dut: "correct", assumptions: contract });
    expect(r.assertions.p_count_in_range.protectedBy).toEqual(["a_no_push_when_full", "a_no_pop_when_empty"]);
    expect(r.assertions.p_full_is_correct.protectedBy).toEqual([]);
  });

  it("counterexamples are shortest: BFS finds the 4-push trace for the late full flag", () => {
    const r = runFormal({ dut: "late_full", assumptions: contract });
    const cex = r.assertions.p_full_is_correct;
    expect(cex.status).toBe("cex");
    expect(cex.failCycle).toBe(4);
    expect(cex.trace?.[4]).toMatchObject({ count: 4, full: 0 });
    // The late flag also lets a contract-respecting environment overflow the FIFO.
    expect(r.assertions.p_count_in_range.failCycle).toBe(5);
    expect(r.assertions.p_count_in_range.trace?.[4]).toMatchObject({ count: 4, full: 0, push: 1 });
  });

  it("over-constraint: a_never_fill makes p_full_is_correct pass vacuously, hides the late-flag bug, and the cover is unreachable", () => {
    const r = runFormal({ dut: "late_full", assumptions: [...contract, "a_never_fill"] });
    expect(r.assertions.p_full_is_correct.status).toBe("proven");
    expect(r.assertions.p_full_is_correct.vacuous).toBe(true);
    expect(r.assertions.p_count_in_range.status).toBe("proven");
    expect(r.covers.c_reach_depth.status).toBe("unreachable");
  });

  it("§16.12.7: the implication is vacuous when the antecedent count == DEPTH does not hold", () => {
    expect(evaluateAssertion("p_full_is_correct", { count: 2, full: 0, empty: 0 })).toBe("vacuous");
    expect(evaluateAssertion("p_full_is_correct", { count: 4, full: 0, empty: 0 })).toBe("fail");
    expect(evaluateAssertion("p_full_is_correct", { count: 4, full: 1, empty: 0 })).toBe("pass");
  });
});

describe("formal-fifo-model: simulation and CEX replay", () => {
  it("§16.14.2: replaying the overflow CEX in simulation trips a_no_push_when_full first → spurious CEX", () => {
    const enabled: AssumptionId[] = ["a_no_pop_when_empty"];
    const r = runFormal({ dut: "correct", assumptions: enabled });
    const run = replayTrace("correct", r.assertions.p_count_in_range.trace!, enabled);
    expect(run.firstAssumptionFail.a_no_push_when_full).toBe(4);
    expect(run.firstAssertionFail.p_count_in_range).toBe(5);
    const verdict = classifyReplay(run);
    expect(verdict.kind).toBe("spurious");
    expect(verdict.property).toBe("a_no_push_when_full");
  });

  it("replaying the late-flag CEX keeps every assumption true → a real DUT bug", () => {
    const r = runFormal({ dut: "late_full", assumptions: contract });
    const verdict = classifyReplay(replayTrace("late_full", r.assertions.p_full_is_correct.trace!, contract));
    expect(verdict).toMatchObject({ kind: "dut_bug", property: "p_full_is_correct", cycle: 4 });
  });

  it("random simulation is seeded and deterministic, and the driver obeys c_legal", () => {
    const a = simulateRandom("correct", 3, contract);
    const b = simulateRandom("correct", 3, contract);
    expect(a.cycles.map((c) => [c.push, c.pop])).toEqual(b.cycles.map((c) => [c.push, c.pop]));
    expect(a.firstAssumptionFail).toEqual({});
    expect(a.cycles.every((c) => c.count <= FIFO_DEPTH)).toBe(true);
  });

  it("simulation only sees the traces it runs: seed 1 exposes the late flag, seed 2 never fills the FIFO", () => {
    const hit = simulateRandom("late_full", 1, contract);
    const miss = simulateRandom("late_full", 2, contract);
    expect(hit.firstAssertionFail.p_full_is_correct).toBe(15);
    expect(miss.firstAssertionFail).toEqual({});
    expect(miss.coverHit.c_reach_depth).toBeUndefined();
  });

  it("simulation checks assumptions: the over-tight a_never_fill fails against a legal random environment", () => {
    const run = simulateRandom("correct", 1, [...contract, "a_never_fill"]);
    expect(run.firstAssumptionFail.a_never_fill).toBe(14);
  });
});

describe("formal-fifo-model: generated code", () => {
  it("comments out disabled assumptions in the shared property module", () => {
    const lines = propertyModuleLines(["a_no_pop_when_empty"]).map((l) => l.text);
    expect(lines.find((l) => l.includes("a_no_push_when_full"))).toMatch(/^\s*\/\/ .*\(disabled\)$/);
    expect(lines.find((l) => l.includes("a_no_pop_when_empty"))).toMatch(/^\s*a_no_pop_when_empty:\s+assume property \(!\(pop && empty\)\);$/);
    expect(lines.some((l) => l.startsWith("bind fifo fifo_props"))).toBe(true);
  });

  it("the replay sequence drives exactly the trace inputs up to the failing edge", () => {
    const r = runFormal({ dut: "correct", assumptions: ["a_no_pop_when_empty"] });
    const code = replaySequenceLines(r.assertions.p_count_in_range.trace!).join("\n");
    expect(code).toContain("bit push_v[5] = '{1, 1, 1, 1, 1};");
    expect(code).toContain("bit pop_v[5]  = '{0, 0, 0, 0, 0};");
  });
});
