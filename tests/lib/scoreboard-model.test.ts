import { describe, expect, it } from "vitest";

import {
  DEFAULT_SB_CONFIG,
  SB_IDLE_TIMEOUT,
  SB_T_DROP,
  dutOutputs,
  policyMatrix,
  runScoreboard,
  scoreboardSource,
  type SbConfig,
} from "@/lib/scoreboard-model";

const run = (over: Partial<SbConfig>) => runScoreboard({ ...DEFAULT_SB_CONFIG, ...over });

describe("scoreboard-model: DUT streams", () => {
  it("the cross-ID DUT reorders across IDs but keeps each ID in request order (AXI ordering rule)", () => {
    const outs = dutOutputs("cross-id", "none");
    expect(outs.map((o) => o.item.seq)).toEqual([2, 1, 4, 3, 5]);
    for (const id of [0, 1]) {
      const seqs = outs.filter((o) => o.item.id === id).map((o) => o.item.seq);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    }
  });

  it("mutants change exactly one thing", () => {
    expect(dutOutputs("in-order", "drop").map((o) => o.item.seq)).toEqual([1, 2, 3, 4]);
    expect(dutOutputs("in-order", "extra").filter((o) => o.item.seq === 2)).toHaveLength(2);
    expect(dutOutputs("in-order", "wrong-data").find((o) => o.item.seq === 4)!.item.data).toBe(0x25);
    expect(dutOutputs("cross-id", "reorder-same-id").filter((o) => o.item.id === 0).map((o) => o.item.seq)).toEqual([3, 1, 5]);
  });
});

describe("scoreboard-model: matching policies", () => {
  it("per-ID queues pass a correct DUT that reorders across IDs", () => {
    const r = run({ policy: "per-id", dut: "cross-id" });
    expect(r.truth).toBe("clean-pass");
    expect(r.matched).toBe(5);
  });

  it("an in-order queue raises a false mismatch when the DUT legally reorders across IDs", () => {
    const r = run({ policy: "in-order", dut: "cross-id" });
    expect(r.truth).toBe("false-alarm");
    const first = r.steps.find((s) => s.action === "mismatch")!;
    expect(first.item!.id).not.toBe(first.against!.id);
    expect(first.why).toMatch(/false mismatch/);
  });

  it("one slot per ID overwrites an outstanding same-ID item, so even an in-order DUT fails", () => {
    const r = run({ policy: "single-slot", dut: "in-order" });
    const ow = r.steps.find((s) => s.action === "overwrite")!;
    expect(ow.item!.seq).toBe(3);
    expect(ow.what).toMatch(/replaces #1/);
    expect(r.truth).toBe("false-alarm");
  });

  it("search-any-match lets a same-ID reorder escape; per-ID queues catch it in run_phase", () => {
    expect(run({ policy: "search-any", mutant: "reorder-same-id" }).truth).toBe("escaped");
    const perId = run({ policy: "per-id", mutant: "reorder-same-id" });
    expect(perId.truth).toBe("caught-run");
    expect(perId.runErrors[0].id).toBe("SCB/MISMATCH");
  });

  it("search-any turns wrong data into a leftover pair that only check_phase reports", () => {
    const r = run({ policy: "search-any", mutant: "wrong-data" });
    expect(r.runErrors).toHaveLength(0);
    expect(r.checkErrors.map((e) => e.id).sort()).toEqual(["SCB/MISSING", "SCB/UNEXPECTED"]);
    expect(r.truth).toBe("caught-check");
  });

  it("an extra response is a run-time mismatch for per-ID queues and leaves an unexpected actual", () => {
    const r = run({ policy: "per-id", mutant: "extra" });
    expect(r.truth).toBe("caught-run");
    expect(r.steps.some((s) => s.action === "held")).toBe(true);
    expect(r.leftoverActual).toHaveLength(1);
  });

  it("per-ID queues are the only policy that is clean on a correct cross-ID DUT and catches every mutant", () => {
    const matrix = policyMatrix("cross-id");
    const column = (p: string) => matrix.map((row) => row.cells.find((c) => c.policy === p)!.truth);
    expect(column("per-id")).toEqual(["clean-pass", "caught-check", "caught-run", "caught-run", "caught-run"]);
    expect(column("search-any")).toContain("escaped");
    expect(column("in-order")[0]).toBe("false-alarm");
    expect(column("single-slot")[0]).toBe("false-alarm");
  });
});

describe("scoreboard-model: end-of-test accounting (check_phase, drain)", () => {
  it("a dropped final response produces no run-time error; check_phase reports it MISSING", () => {
    const r = run({ mutant: "drop" });
    expect(r.runErrors).toHaveLength(0);
    expect(r.checkErrors).toEqual([expect.objectContaining({ id: "SCB/MISSING" })]);
    expect(r.outcome).toBe("check");
  });

  it("without the check_phase leftover check the same dropped response escapes as a PASS", () => {
    const r = run({ mutant: "drop", checkPhase: false });
    expect(r.verdict).toBe("PASS");
    expect(r.truth).toBe("escaped");
  });

  it("wait-until-idle ends run_phase when nothing is outstanding (uvm_objection drop after the last match)", () => {
    const r = run({});
    expect(r.endTime).toBe(9);
    expect(r.timedOut).toBe(false);
  });

  it("wait-until-idle falls back to its watchdog when a response never comes", () => {
    const r = run({ mutant: "drop" });
    expect(r.timedOut).toBe(true);
    expect(r.endTime).toBe(SB_T_DROP + SB_IDLE_TIMEOUT);
  });

  it("no drain: responses after the objection drop never reach the scoreboard (MISSING, not a DUT bug)", () => {
    const r = run({ endOfTest: "none" });
    expect(r.endTime).toBe(SB_T_DROP);
    expect(r.notObserved.filter((n) => n.kind === "act")).toHaveLength(3);
    expect(r.truth).toBe("false-alarm");
    expect(r.steps.find((s) => s.action === "missing")!.why).toMatch(/after run_phase ended/);
  });

  it("a fixed 30 ns drain time (uvm_objection.svh set_drain_time) is a guess: enough for the in-order DUT, too short for the slow ID", () => {
    expect(run({ endOfTest: "drain-time", dut: "in-order" }).truth).toBe("clean-pass");
    expect(run({ endOfTest: "drain-time", dut: "cross-id" }).truth).toBe("false-alarm");
  });

  it("a PASS with uncompared items is reported as hollow, not clean", () => {
    expect(run({ endOfTest: "none", checkPhase: false }).truth).toBe("hollow-pass");
  });
});

describe("scoreboard-model: generated code matches the policy", () => {
  it("per-ID code uses an associative array of queues with push_back / pop_front", () => {
    const text = scoreboardSource({ policy: "per-id", endOfTest: "until-idle", checkPhase: true }).map((l) => l.text).join("\n");
    expect(text).toContain("rsp_item exp_q[int unsigned][$];");
    expect(text).toContain("exp_q[t.id].push_back(t)");
    expect(text).toContain("exp_q[t.id].pop_front()");
    expect(text).toContain("function void check_phase");
    expect(text).toContain("wait (outstanding == 0);");
  });

  it("single-slot code shows the overwrite line the model flags", () => {
    const lines = scoreboardSource({ policy: "single-slot", endOfTest: "none", checkPhase: true });
    expect(lines.find((l) => l.key === "exp-store")!.text).toContain("expected[t.id] = t;");
  });

  it("every step's code key exists in the code panel", () => {
    for (const policy of ["in-order", "per-id", "single-slot", "search-any"] as const) {
      for (const mutant of ["none", "drop", "extra", "reorder-same-id", "wrong-data"] as const) {
        const cfg = { ...DEFAULT_SB_CONFIG, policy, mutant };
        const keys = new Set(scoreboardSource(cfg).map((l) => l.key));
        for (const s of runScoreboard(cfg).steps) expect(keys.has(s.codeKey), `${policy}/${mutant}/${s.codeKey}`).toBe(true);
      }
    }
  });
});
