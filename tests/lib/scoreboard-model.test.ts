import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SB_CONFIG,
  SB_IDLE_TIMEOUT,
  SB_T_DROP,
  dutOutputs,
  F2B_STRAY,
  normalizePlainSvCheckers,
  plainSvACauseNote,
  plainSvKeyOptions,
  plainSvScoreboardSource,
  plainSvStrayProbe,
  plainSvSummaryOptions,
  plainSvVerdictOptions,
  policyMatrix,
  runPlainSvScoreboard,
  runScoreboard,
  scoreboardSource,
  sparseMemRead,
  unguardedPop,
  type PlainSvConfig,
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

/* ------------------------------------------------------------------------- */
/* Plain SystemVerilog tracker (F2B Dynamic Structures)                        */
/* ------------------------------------------------------------------------- */

const MIW = (injectBugs: boolean): PlainSvConfig => ({ injectBugs, checkers: ["per-id"] });
const KATA = (injectBugs: boolean): PlainSvConfig => ({ injectBugs, checkers: ["in-order", "per-id"] });

describe("scoreboard-model: plain-SV tracker reproduces the F2B lesson output", () => {
  it("Make It Work, INJECT_BUGS = 1: the lesson's expected output, line for line", () => {
    expect(runPlainSvScoreboard(MIW(true)).log).toEqual([
      "Error: MISMATCH id=1 exp=000000a1 act=000000a2",
      "Error: MISMATCH id=1 exp=000000a2 act=000000a1",
      "mem[1000]=deadbeef mem[2000]=xxxxxxxx",
      "Error: PENDING id=3 count=1",
      "SCB_SUMMARY matches=1 mismatches=2 pending=1",
    ]);
  });

  it("Make It Work, INJECT_BUGS = 0: only the memory line and a passing summary", () => {
    expect(runPlainSvScoreboard(MIW(false)).log).toEqual(["mem[1000]=deadbeef mem[2000]=xxxxxxxx", "SCB_SUMMARY matches=4 mismatches=0 pending=0"]);
  });

  it("Kata, INJECT_BUGS = 0: checker A false-alarms twice on the legal overtake, checker B passes", () => {
    expect(runPlainSvScoreboard(KATA(false)).log).toEqual([
      "Error: A: MISMATCH id=2 exp=000000a1 act=000000b1",
      "Error: A: MISMATCH id=1 exp=000000b1 act=000000a1",
      "A: SCB_SUMMARY matches=2 mismatches=2 pending=0",
      "B: SCB_SUMMARY matches=4 mismatches=0 pending=0",
    ]);
  });

  it("Kata, INJECT_BUGS = 1: both checkers fail and both report the request for ID 3 pending", () => {
    expect(runPlainSvScoreboard(KATA(true)).log).toEqual([
      "Error: A: MISMATCH id=2 exp=000000a1 act=000000b1",
      "Error: A: MISMATCH id=1 exp=000000b1 act=000000a2",
      "Error: B: MISMATCH id=1 exp=000000a1 act=000000a2",
      "Error: A: MISMATCH id=1 exp=000000a2 act=000000a1",
      "Error: B: MISMATCH id=1 exp=000000a2 act=000000a1",
      "Error: B: PENDING id=3 count=1",
      "Error: A: PENDING count=1",
      "A: SCB_SUMMARY matches=0 mismatches=3 pending=1",
      "B: SCB_SUMMARY matches=1 mismatches=2 pending=1",
    ]);
  });

  it("the trace table for INJECT_BUGS = 1: exp_by_id after every call", () => {
    const rows = runPlainSvScoreboard(MIW(true)).steps.map((s) => s.after.byId.map((r) => `${r.id}:[${r.items.map((v) => v.toString(16).toUpperCase()).join(", ")}]`).join(" "));
    expect(rows).toEqual([
      "1:[A1]",
      "1:[A1] 2:[B1]",
      "1:[A1, A2] 2:[B1]",
      "1:[A1, A2] 2:[B1] 3:[C1]",
      "1:[A1, A2] 3:[C1]",
      "1:[A2] 3:[C1]",
      "3:[C1]",
      "3:[C1]",
      "3:[C1]",
    ]);
  });
});

describe("scoreboard-model: plain-SV tracker rules (IEEE 1800-2023)", () => {
  it("§7.8.7: the first add_expected for an ID allocates its key by assignment; later ones only push", () => {
    const steps = runPlainSvScoreboard(MIW(true)).steps.filter((s) => s.call.kind === "add");
    expect(steps.map((s) => s.allocatedKey)).toEqual([1, 2, undefined, 3]);
    expect(steps[0].activeKey).toBe("add-alloc");
    expect(steps[2].activeKey).toBe("add-push");
    expect(steps[0].why).toMatch(/§7\.8\.7/);
  });

  it("§7.8.6 / §7.10.2.4: unguardedPop models a read without exists(): a missing key warns and pop_front() gives '0", () => {
    // An unguarded read of a missing key warns (§7.8.6) and pop_front on the empty queue gives '0 (§7.10.2.4).
    expect(unguardedPop(new Map([[1, [0xa1]]]), 9)).toEqual({ value: 0, readWarns: true, popMayWarn: true });
    expect(unguardedPop(new Map([[1, [0xa1]]]), 1)).toEqual({ value: 0xa1, readWarns: false, popMayWarn: false });
  });

  it("§7.9.3: in the Make It Work run the first check_actual finds its key with exists() and matches", () => {
    for (const bugs of [false, true]) {
      const first = runPlainSvScoreboard(MIW(bugs)).steps.find((s) => s.call.kind === "check")!;
      expect(first.results).toHaveLength(1);
      expect(first.results[0].outcome).toBe("match");
    }
  });

  it("§7.9.3: a response for an ID with no key is UNEXPECTED in checker B; checker A reports UNEXPECTED only when exp_q is empty", () => {
    const calls = [
      { kind: "add" as const, id: 1, data: 0xa1, key: "add-0" },
      { kind: "check" as const, id: 9, data: 0x99, key: "chk-0" },
      { kind: "check" as const, id: 1, data: 0xa1, key: "ok-0" },
      { kind: "check" as const, id: 1, data: 0xa1, key: "ok-1" },
      { kind: "final" as const, key: "fin-foreach" },
    ];
    const r = runPlainSvScoreboard(KATA(false), calls);
    expect(r.log).toEqual([
      "Error: A: MISMATCH id=9 exp=000000a1 act=00000099",
      "Error: B: UNEXPECTED id=9 data=00000099",
      "Error: A: UNEXPECTED id=1 data=000000a1",
      "Error: A: UNEXPECTED id=1 data=000000a1",
      "Error: B: UNEXPECTED id=1 data=000000a1",
      "A: SCB_SUMMARY matches=0 mismatches=3 pending=0",
      "B: SCB_SUMMARY matches=1 mismatches=2 pending=0",
    ]);
    const unexpected = r.steps[1].results.find((x) => x.checker === "per-id")!;
    expect(unexpected.outcome).toBe("unexpected");
    expect(r.steps[1].deletedKey).toBeUndefined();
    expect(plainSvVerdictOptions(runPlainSvScoreboard(MIW(false), calls).steps[1]).find((o) => o.correct)!.id).toBe("unexpected");
    // No reorder happens here: the stray id=9 response popped A1 off exp_q, so checker A is out of step, not fooled by an overtake.
    const aOf = (i: number) => r.steps[i].results.find((x) => x.checker === "in-order")!;
    expect([1, 2, 3].map((i) => aOf(i).falseAlarm)).toEqual([undefined, undefined, undefined]);
    expect(aOf(2)).toMatchObject({ outcome: "unexpected", aCause: "out-of-step", note: plainSvACauseNote["out-of-step"] });
    expect(r.steps[2].why).toBe("exp_q is empty because an earlier response already consumed this item, so checker A is out of step; checker B still had A1 waiting for ID 1 and matched it.");
    expect(r.steps[2].why).not.toMatch(/reorder/);
    const fb = plainSvVerdictOptions(r.steps[2]).find((o) => o.correct)!.feedback;
    expect(fb).not.toMatch(/reorder/);
    expect(fb).toContain("Checker A is out of step");
    expect(aOf(1).aCause).toBeUndefined();
    expect(aOf(3).aCause).toBeUndefined();
  });

  it("checker A's false alarms in the Kata: the first is a legal overtake, the second a knock-on desync", () => {
    const r = runPlainSvScoreboard(KATA(false));
    const errs = r.steps.flatMap((s) => s.results.filter((x) => x.checker === "in-order" && x.outcome !== "match").map((x) => ({ s, x })));
    expect(errs.map(({ s }) => s.label)).toEqual(["check_actual(2, 32'hB1)", "check_actual(1, 32'hA1)"]);
    expect(errs.map(({ x }) => x.aCause)).toEqual(["overtake", "out-of-step"]);
    expect(errs[0].s.why).toMatch(/legal reorder across IDs/);
    expect(errs[1].s.why).toBe(
      "False alarm in checker A: checker B matched this response, but the item checker A popped, B1 for ID 2, was already taken by an earlier response for ID 2. exp_q is out of step, so its front no longer lines up with the responses.",
    );
    expect(errs[1].s.why).not.toMatch(/reorder/);
    expect(plainSvVerdictOptions(errs[1].s).find((o) => o.correct)!.feedback).not.toMatch(/reorder/);
  });

  it("§7.10.2.4: pop_front() returns and removes the front item, even when the compare fails", () => {
    const s = runPlainSvScoreboard(MIW(true)).steps[5];
    expect(s.label).toBe("check_actual(1, 32'hA2)");
    expect(s.results[0]).toMatchObject({ outcome: "mismatch", expected: 0xa1, actual: 0xa2 });
    expect(s.after.byId.find((k) => k.id === 1)!.items).toEqual([0xa2]);
  });

  it("§7.9.2: a key is deleted when its queue empties, so the keys left at final are the pending IDs", () => {
    const r = runPlainSvScoreboard(MIW(true));
    expect(r.steps.filter((s) => s.deletedKey !== undefined).map((s) => s.deletedKey)).toEqual([2, 1]);
    expect(r.pendingKeys).toEqual([{ id: 3, items: [0xc1] }]);
    for (const s of r.steps) for (const k of s.after.byId) expect(k.items.length).toBeGreaterThan(0);
  });

  it("§7.8: foreach in final visits the remaining keys in ascending key order", () => {
    const r = runPlainSvScoreboard(MIW(false));
    expect(r.steps[3].after.byId.map((k) => k.id)).toEqual([1, 2, 3]);
  });

  it("§7.8, §7.8.4: keys allocated out of order are kept in signed numerical order, and final prints PENDING in that order", () => {
    const calls = [
      { kind: "add" as const, id: 5, data: 0x51, key: "add-0" },
      { kind: "add" as const, id: -2, data: 0x21, key: "add-1" },
      { kind: "add" as const, id: 3, data: 0x31, key: "add-2" },
      { kind: "final" as const, key: "fin-foreach" },
    ];
    const r = runPlainSvScoreboard(MIW(false), calls);
    expect(r.steps[2].after.byId.map((k) => k.id)).toEqual([-2, 3, 5]);
    expect(r.pendingKeys.map((k) => k.id)).toEqual([-2, 3, 5]);
    expect(r.log.filter((l) => l.includes("PENDING"))).toEqual(["Error: PENDING id=-2 count=1", "Error: PENDING id=3 count=1", "Error: PENDING id=5 count=1"]);
  });

  it("§7.8: storage only when used: exp_by_id starts empty, and an UNEXPECTED check allocates nothing", () => {
    const r = runPlainSvScoreboard(MIW(true));
    expect(r.steps[0].before.byId).toEqual([]);
    const calls = [
      { kind: "add" as const, id: 1, data: 0xa1, key: "add-0" },
      { kind: "check" as const, id: 9, data: 0x99, key: "chk-0" },
      { kind: "final" as const, key: "fin-foreach" },
    ];
    const s = runPlainSvScoreboard(MIW(false), calls).steps[1];
    expect(s.results[0].outcome).toBe("unexpected");
    expect(s.after.byId).toEqual(s.before.byId);
  });

  it("the sparse-memory step says it has no row in the lesson's trace table", () => {
    const mem = runPlainSvScoreboard(MIW(true)).steps.find((s) => s.call.kind === "mem")!;
    expect(mem.what).toMatch(/trace table has no row for this step/);
  });

  it("Kata, INJECT_BUGS = 1: when both checkers mismatch on different items, the why says checker A's exp= is out of step", () => {
    const steps = runPlainSvScoreboard(KATA(true)).steps.filter((s) => s.call.kind === "check");
    expect(steps[1].label).toBe("check_actual(1, 32'hA2)");
    expect(steps[1].why).toContain("Checker A also fires, but its expected B1 is not the oldest item for ID 1");
    // On the next check both checkers expected A2, so no such clause.
    expect(steps[2].why).not.toContain("Checker A also fires");
  });

  it("§9.2.3 / §20.10: the final step is last and reports each leftover with $error before the summary", () => {
    const r = runPlainSvScoreboard(MIW(true));
    const fin = r.steps[r.steps.length - 1];
    expect(fin.call.kind).toBe("final");
    expect(fin.log).toEqual(["Error: PENDING id=3 count=1", "SCB_SUMMARY matches=1 mismatches=2 pending=1"]);
    expect(fin.what).toMatch(/§9\.2\.3/);
  });

  it("§7.9.3: mem_read checks exists() first, so the unwritten address reads 'x without allocating", () => {
    const mem = new Map([[0x1000, 0xdeadbeef]]);
    expect(sparseMemRead(mem, 0x2000)).toBe("x");
    expect(mem.size).toBe(1);
  });

  it("the in-order checker's errors on a correct DUT are flagged as false alarms; real DUT bugs are not", () => {
    const clean = runPlainSvScoreboard(KATA(false)).steps.flatMap((s) => s.results).filter((r) => r.checker === "in-order" && r.outcome !== "match");
    expect(clean.map((r) => r.falseAlarm)).toEqual([true, true]);
    const buggy = runPlainSvScoreboard(KATA(true)).steps.flatMap((s) => s.results).filter((r) => r.checker === "in-order" && r.outcome !== "match");
    expect(buggy.map((r) => Boolean(r.falseAlarm))).toEqual([true, false, false]);
  });

  it("every check_actual and final is gated for a prediction; the adds and the memory step are not", () => {
    const r = runPlainSvScoreboard(MIW(true));
    expect(r.steps.map((s) => s.gated)).toEqual([false, false, false, false, true, true, true, false, true]);
  });
});

describe("scoreboard-model: plain-SV predictions are generated from the run", () => {
  it("verdict options: exactly one correct, and it matches the step's outcome", () => {
    for (const cfg of [MIW(true), MIW(false), KATA(true), KATA(false)]) {
      for (const s of runPlainSvScoreboard(cfg).steps.filter((st) => st.call.kind === "check")) {
        const opts = plainSvVerdictOptions(s);
        expect(opts.filter((o) => o.correct)).toHaveLength(1);
        for (const o of opts) expect(o.feedback.length).toBeGreaterThan(10);
      }
    }
    const s = runPlainSvScoreboard(MIW(true)).steps[5];
    expect(plainSvVerdictOptions(s).find((o) => o.correct)!.id).toBe("mismatch");
    const k = runPlainSvScoreboard(KATA(false)).steps[4];
    expect(plainSvVerdictOptions(k).find((o) => o.correct)!.id).toBe("a");
  });

  it("key options: the correct option is the deleted key, or none", () => {
    const steps = runPlainSvScoreboard(MIW(true)).steps.filter((st) => st.call.kind === "check");
    expect(steps.map((s) => plainSvKeyOptions(s).find((o) => o.correct)!.id)).toEqual(["key-2", "none", "key-1"]);
  });

  it("key options: exactly one correct in every config, pinned per config", () => {
    const expected: [PlainSvConfig, string[]][] = [
      [MIW(true), ["key-2", "none", "key-1"]],
      [MIW(false), ["key-2", "none", "key-1", "key-3"]],
      [KATA(true), ["key-2", "none", "key-1"]],
      [KATA(false), ["key-2", "none", "key-1", "key-3"]],
    ];
    for (const [cfg, ids] of expected) {
      const steps = runPlainSvScoreboard(cfg).steps.filter((st) => st.call.kind === "check");
      for (const s of steps) expect(plainSvKeyOptions(s).filter((o) => o.correct)).toHaveLength(1);
      expect(steps.map((s) => plainSvKeyOptions(s).find((o) => o.correct)!.id)).toEqual(ids);
    }
  });

  it("key options: deleting the last key is worded as no key left, not 'the keys left, none'", () => {
    const steps = runPlainSvScoreboard(MIW(false)).steps.filter((st) => st.call.kind === "check");
    const last = plainSvKeyOptions(steps[3]).find((o) => o.correct)!;
    expect(last.feedback).toContain("No keys are left, so no ID is still pending.");
    expect(last.feedback).not.toMatch(/keys left, none/);
    expect(plainSvKeyOptions(steps[0]).find((o) => o.correct)!.feedback).toContain("The keys left, 1, 3, are the IDs still pending.");
  });

  it("summary options: the correct line is the model's own summary, with distinct distractors", () => {
    for (const cfg of [MIW(true), MIW(false), KATA(true), KATA(false)]) {
      const { checker, options } = plainSvSummaryOptions(cfg);
      const line = runPlainSvScoreboard(cfg).summaries.find((s) => s.checker === checker)!.line;
      expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual([line]);
      expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
      expect(options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("summary options are sorted by label, and each config keeps its distractors", () => {
    const expected: [PlainSvConfig, string[]][] = [
      [MIW(true), ["other-checker", "no-leftovers", "correct", "other-inject"]],
      [MIW(false), ["other-inject", "other-checker", "correct"]],
      [KATA(true), ["no-leftovers", "correct", "other-checker", "other-inject"]],
      [KATA(false), ["other-inject", "correct", "other-checker"]],
    ];
    for (const [cfg, ids] of expected) {
      const labels = plainSvSummaryOptions(cfg).options.map((o) => o.label);
      expect(labels).toEqual([...labels].sort());
      expect(plainSvSummaryOptions(cfg).options.map((o) => o.id)).toEqual(ids);
    }
  });

  it("the other-checker distractor for Make It Work credits the overtake with one false MISMATCH, and the real bug with the rest", () => {
    const fb = (bugs: boolean) => plainSvSummaryOptions(MIW(bugs)).options.find((o) => o.id === "other-checker")!.feedback;
    expect(fb(true)).toContain("gives it a false MISMATCH and puts its queue out of step, on top of the real bug.");
    expect(fb(false)).toContain("gives it a false MISMATCH and puts its queue out of step.");
    expect(fb(false)).not.toContain("real bug");
  });
});

describe("scoreboard-model: plain-SV source matches the lesson", () => {
  const text = (cfg: PlainSvConfig) => plainSvScoreboardSource(cfg).map((l) => l.text).join("\n");

  it("Make It Work source: associative array of queues, exists() guard, delete on empty, final leftover check, no UVM", () => {
    const t = text(MIW(true));
    expect(t).toMatch(/bit \[31:0\]\s+exp_by_id \[int\]\[\$\];/);
    expect(t).toContain("localparam bit INJECT_BUGS = 1;");
    expect(t).toContain("if (!exp_by_id.exists(id)) begin");
    expect(t).toContain("expected = exp_by_id[id].pop_front();");
    expect(t).toContain("if (exp_by_id[id].size() == 0) exp_by_id.delete(id);");
    expect(t).toContain("final begin");
    expect(t).toContain('$error("PENDING id=%0d count=%0d", id, exp_by_id[id].size());');
    expect(t).not.toMatch(/uvm_|objection|drain|check_phase|analysis/);
    expect(text(MIW(false))).toContain("localparam bit INJECT_BUGS = 0;");
  });

  it("Kata source declares checker A's exp_q[$] beside checker B and prints both summaries", () => {
    const t = text(KATA(false));
    expect(t).toContain("bit [31:0] exp_q [$];");
    expect(t).toContain('$display("A: SCB_SUMMARY');
    expect(t).toContain('$display("B: SCB_SUMMARY');
    expect(t).not.toMatch(/uvm_|objection|drain|check_phase|analysis/);
  });

  it("every step's code keys exist in the generated source", () => {
    for (const cfg of [MIW(true), MIW(false), KATA(true), KATA(false)]) {
      const keys = new Set(plainSvScoreboardSource(cfg).map((l) => l.key));
      for (const s of runPlainSvScoreboard(cfg).steps) {
        for (const k of [s.callKey, s.activeKey, ...s.contextKeys]) expect(keys.has(k), k).toBe(true);
      }
    }
  });

  it("the generated source equals the lesson's code fences line for line (Make It Work and the Kata solution), skipping // compile", () => {
    const mdx = readFileSync(resolve(process.cwd(), "content/curriculum/T1_Foundational/F2B_Dynamic_Structures/index.mdx"), "utf8");
    const fenceAfter = (marker: string) => {
      const at = mdx.indexOf(marker);
      expect(at, marker).toBeGreaterThan(-1);
      const open = mdx.indexOf("```systemverilog\n", at);
      const body = mdx.slice(open + "```systemverilog\n".length, mdx.indexOf("\n```", open));
      return body.split("\n").filter((l) => l.trim() !== "// compile");
    };
    const lines = (cfg: PlainSvConfig) => plainSvScoreboardSource(cfg).map((l) => l.text);
    expect(lines(MIW(true))).toEqual(fenceAfter("### Worked example: an expected-transaction tracker"));
    expect(lines(KATA(false))).toEqual(fenceAfter("<summary>Worked solution</summary>"));
  });

  it("compare normalisation: in-order brings in both checkers; unsupported policies are reported", () => {
    expect(normalizePlainSvCheckers(["in-order", "per-id"])).toEqual({ checkers: ["in-order", "per-id"], ignored: [] });
    expect(normalizePlainSvCheckers(undefined)).toEqual({ checkers: ["per-id"], ignored: [] });
    expect(normalizePlainSvCheckers(["per-id", "search-any"])).toEqual({ checkers: ["per-id"], ignored: ["search-any"] });
  });
});

describe("scoreboard-model: past the lesson, a stray response guarded and unguarded", () => {
  it("the guarded check reports UNEXPECTED, reads nothing and deletes nothing (§7.9.3)", () => {
    for (const cfg of [MIW(true), MIW(false)]) {
      const p = plainSvStrayProbe(cfg);
      expect(p.label).toBe("check_actual(9, 32'h0)");
      expect([p.id, p.data]).toEqual([...F2B_STRAY]);
      expect(p.step.results).toHaveLength(1);
      expect(p.step.results[0].outcome).toBe("unexpected");
      expect(p.step.log).toEqual(["Error: UNEXPECTED id=9 data=00000000"]);
      expect(p.step.after.byId).toEqual(p.step.before.byId);
      expect(p.verdictOptions.find((o) => o.correct)!.id).toBe("unexpected");
    }
  });

  it("the unguarded read of the same state warns, pop_front() gives '0, and data 0 passes silently (§7.8.6, §7.10.2.4)", () => {
    const p = plainSvStrayProbe(MIW(true));
    expect(p.unguarded).toEqual({ value: 0, readWarns: true, popMayWarn: true, passes: true });
    expect(p.unguardedOptions.filter((o) => o.correct).map((o) => o.id)).toEqual(["default"]);
    expect(p.unguardedText).toMatch(/§7\.8\.6/);
    expect(p.unguardedText).toMatch(/§7\.10\.2\.4/);
    expect(p.unguardedText).toMatch(/n_match counts a response nobody requested/);
    // The allocation question is recorded as open, not answered.
    expect(p.unguardedText).toMatch(/simulators differ/);
    expect(p.unguardedText).toMatch(/is not stated/);
    // Non-zero data would be a MISMATCH against '0 instead.
    const q = plainSvStrayProbe(MIW(true), 9, 0x5);
    expect(q.unguarded.passes).toBe(false);
    expect(q.unguardedOptions.find((o) => o.correct)!.label).toMatch(/MISMATCH/);
  });

  it("with both checkers, the stray meets an empty exp_q in the clean run and checker B's guard", () => {
    const p = plainSvStrayProbe(KATA(false));
    expect(p.step.log).toEqual(["Error: A: UNEXPECTED id=9 data=00000000", "Error: B: UNEXPECTED id=9 data=00000000"]);
    expect(p.step.results.find((r) => r.checker === "in-order")!.falseAlarm).toBeUndefined();
    expect(p.verdictOptions.find((o) => o.correct)!.id).toBe("both");
    expect(p.unguardedText).toMatch(/b_match/);
  });

  it("refuses an ID the script requests, since that would not be a stray", () => {
    expect(() => plainSvStrayProbe(MIW(true), 1, 0)).toThrow(/not a stray/);
  });
});
