import { describe, expect, it } from "vitest";

import {
  ALL_TEST_IDS,
  CLINIC_CASES,
  DEFAULT_CONFIG,
  LINE_FACTS,
  MATRIX_MUTANTS,
  PLAN_MUTANTS,
  PRESETS,
  benchSource,
  buildMatrix,
  clinicCase,
  columnId,
  diagnoseSuspect,
  dutNextSum,
  dutSource,
  dutStep,
  edgePrediction,
  edgeTime,
  explainEscape,
  expectedResultCount,
  formatDec,
  formatLogLine,
  formatQueue,
  gradeFix,
  holdCheckPrediction,
  initialDutState,
  judge,
  lineRan,
  negedgeTime,
  numVal,
  passWithoutMatch,
  popFront,
  predictionKey,
  presetConfig,
  queuePrediction,
  runBench,
  suspectKeys,
  testsFor,
  testsRule,
  type EdgeStep,
  type Expectation,
  type MutantId,
  type RunResult,
} from "@/lib/selfcheck-bench-model";
import { logicalNot, parseBits } from "@/lib/sv-four-state-model";

const logText = (run: RunResult) => run.log.map(formatLogLine);
const errors = (run: RunResult) => run.log.filter((l) => l.kind === "error").map(formatLogLine);
const edgeSteps = (run: RunResult) => run.steps.filter((s): s is EdgeStep => s.kind === "edge");
const stepAt = (run: RunResult, edge: number) => edgeSteps(run).find((s) => s.edge === edge) as EdgeStep;
const bits = (text: string) => parseBits(text);

describe("time axis", () => {
  it("edge k rises at 5 + 10k ns and falls at 10 + 10k ns (always #5 clk = ~clk from clk = 0)", () => {
    expect(edgeTime(0)).toBe(5);
    expect(edgeTime(2)).toBe(25);
    expect(negedgeTime(21)).toBe(220);
  });
});

describe("the lesson's hand-traced logs", () => {
  it("no plusargs, BUG=0: TEST lines at 15/55/135 ns, PASS=14 FAIL=0, run ends at 250 ns", () => {
    const run = runBench(DEFAULT_CONFIG);
    expect(logText(run)).toEqual(["15 ns TEST smoke", "55 ns TEST corners", "135 ns TEST gaps", "PASS=14 FAIL=0"]);
    expect(run.ended).toBe(true);
    expect(run.endReason).toBe("finish");
    expect(run.endTime).toBe(250);
    // The last result is checked at 225 ns; drain() finds the queue empty at 230 ns; two quiet edges follow.
    const last = run.expectations[run.expectations.length - 1];
    expect(edgeTime(last.checkedAtEdge as number)).toBe(225);
    expect(stepAt(run, 23).events.some((e) => e.kind === "drain-check" && e.empty && e.time === 230)).toBe(true);
    const endStep = run.steps[run.steps.length - 1];
    expect(endStep.kind).toBe("end");
    expect(endStep.events.some((e) => e.kind === "drain-quiet" && e.time === 250)).toBe(true);
    expect(endStep.events.some((e) => e.kind === "finish")).toBe(true);
  });

  it("+TEST=corners against BUG=1: errors at 75, 85 and 95 ns, PASS=4 FAIL=3", () => {
    const run = runBench(presetConfig("corners", 1));
    expect(errors(run)).toEqual([
      "[error @ 75 ns] CHK a=255 b=1: sum=0, expected 256",
      "[error @ 85 ns] CHK a=255 b=255: sum=254, expected 510",
      "[error @ 95 ns] CHK a=128 b=128: sum=0, expected 256",
    ]);
    expect(run.summary).toBe("PASS=4 FAIL=3");
    expect(run.firstFailEdge).toBe(7);
  });

  it("+TEST=smoke against BUG=1 escapes: PASS=3 FAIL=0", () => {
    const run = runBench(presetConfig("smoke", 1));
    expect(logText(run)).toEqual(["15 ns TEST smoke", "PASS=3 FAIL=0"]);
    expect(run.caught).toBe(false);
  });

  it("+TEST=smoke against BUG=2: every result fails at 45, 55 and 65 ns, PASS=0 FAIL=3", () => {
    const run = runBench(presetConfig("smoke", 2));
    expect(errors(run)).toEqual([
      "[error @ 45 ns] CHK a=1 b=2: sum=4, expected 3",
      "[error @ 55 ns] CHK a=10 b=20: sum=31, expected 30",
      "[error @ 65 ns] CHK a=100 b=27: sum=128, expected 127",
    ]);
    expect(run.summary).toBe("PASS=0 FAIL=3");
  });

  it("kata: +TEST=hold against BUG=3 with the hold check: errors at 55, 65 and 75 ns, PASS=1 FAIL=3", () => {
    const run = runBench(presetConfig("hold", 3, true));
    expect(logText(run)).toEqual([
      "15 ns TEST hold",
      "[error @ 55 ns] CHK sum changed to 110 while out_valid=0 (held 7)",
      "[error @ 65 ns] CHK sum changed to 150 while out_valid=0 (held 7)",
      "[error @ 75 ns] CHK sum changed to 150 while out_valid=0 (held 7)",
      "PASS=1 FAIL=3",
    ]);
    // The result 7 is checked at 45 ns; the run ends at 80 ns so the edge at 85 ns never runs.
    expect(edgeTime(run.expectations[0].checkedAtEdge as number)).toBe(45);
    expect(run.endTime).toBe(80);
  });

  it("kata: no plusargs with the hold test registered and BUG=0: TEST hold at 215 ns, PASS=15 FAIL=0", () => {
    const run = runBench(presetConfig("all", 0, true));
    expect(logText(run)).toEqual(["15 ns TEST smoke", "55 ns TEST corners", "135 ns TEST gaps", "215 ns TEST hold", "PASS=15 FAIL=0"]);
    expect(run.endTime).toBe(280);
  });

  it("kata: BUG=3 with no plusargs and the hold check: only hold fails, PASS=15 FAIL=3", () => {
    const run = runBench(presetConfig("all", 3, true));
    expect(run.summary).toBe("PASS=15 FAIL=3");
    expect(run.log.filter((l) => l.kind === "error").every((l) => l.time >= 215)).toBe(true);
  });

  it("kata step 2: BUG=3 escapes the original bench, PASS=14 FAIL=0", () => {
    expect(runBench(presetConfig("all", 3)).summary).toBe("PASS=14 FAIL=0");
  });

  it("+TEST=corners alone: PASS=7 FAIL=0; +TEST=gaps alone ends at 130 ns with PASS=4 FAIL=0", () => {
    expect(runBench(presetConfig("corners", 0)).summary).toBe("PASS=7 FAIL=0");
    const gaps = runBench(presetConfig("gaps", 0));
    expect(gaps.summary).toBe("PASS=4 FAIL=0");
    expect(gaps.endTime).toBe(130);
  });
});

describe("the gaps trace, edge by edge (lesson table)", () => {
  const run = runBench(presetConfig("gaps", 0));

  it("exp_q after edges 2..10 is {10} {10} {} {15} {15, 19} {19} {23} {23} {}", () => {
    const after = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => formatQueue(stepAt(run, k).queueAfter));
    expect(after).toEqual(["{10}", "{10}", "{}", "{15}", "{15, 19}", "{19}", "{23}", "{23}", "{}"]);
  });

  it("send(5, 5) at edge 2 is sampled by the DUT at edge 3 and checked at edge 4 (§4.9.4, §10.4.2)", () => {
    expect(run.expectations[0].sentAtEdge).toBe(2);
    expect(run.expectations[0].checkedAtEdge).toBe(4);
    expect(run.signals.in_valid.slice(0, 6).map(formatDec)).toEqual(["0", "0", "0", "1", "0", "0"]);
    expect(run.signals.sum.slice(0, 6).map(formatDec)).toEqual(["x", "0", "0", "0", "10", "10"]);
    expect(run.signals.out_valid.slice(0, 6).map(formatDec)).toEqual(["x", "0", "0", "0", "1", "0"]);
    expect(run.signals.rst_n.slice(0, 6).map(formatDec)).toEqual(["0", "0", "1", "1", "1", "1"]);
    expect(stepAt(run, 4).checker.kind).toBe("pass");
    expect(stepAt(run, 4).popped?.sum).toEqual(numVal(10, 9));
  });

  it("reset_dut() releases reset with <= at edge 1, so the DUT first sees rst_n = 1 on edge 2", () => {
    expect(stepAt(run, 1).events.some((e) => e.kind === "reset-release")).toBe(true);
    expect(stepAt(run, 1).sampled.rst_n).toEqual(bits("0"));
    expect(stepAt(run, 2).sampled.rst_n).toEqual(bits("1"));
    expect(stepAt(run, 1).checker.kind).toBe("in-reset");
  });

  it("narration names the step's what and why and points at a tb_top line", () => {
    const s = stepAt(run, 2);
    expect(s.what).toMatch(/send\(5, 5\) drives in_valid, a and b with <= and pushes 10 onto exp_q/);
    expect(s.why).toMatch(/§4\.9\.4/);
    expect(s.activeKey).toBe("send-drive");
    expect(stepAt(run, 4).activeKey).toBe("check-cmp");
    expect(stepAt(run, 4).node).toBe("chk");
  });
});

describe("DUT semantics", () => {
  it("next_sum keeps the carry at W + 1 bits; BUG=1 clears bit 8, BUG=2 adds one, swap-ab is identical", () => {
    const a = numVal(255, 8);
    const b = numVal(1, 8);
    expect(formatDec(dutNextSum(0, a, b))).toBe("256");
    expect(formatDec(dutNextSum(1, a, b))).toBe("0");
    expect(formatDec(dutNextSum(2, a, b))).toBe("257");
    expect(dutNextSum("swap-ab", a, b)).toEqual(dutNextSum(0, a, b));
    expect(formatDec(dutNextSum("x-carry", a, b))).toBe("X");
  });

  it("an x operand bit makes the whole sum x (§11.4.3)", () => {
    expect(formatDec(dutNextSum(0, bits("xxxxxxxx"), numVal(1, 8)))).toBe("x");
  });

  it("!rst_n with rst_n = x is x, so the if takes the else branch and the DUT is never reset (§12.4)", () => {
    const r = dutStep(0, initialDutState(0), { rstN: bits("x"), inValid: bits("1"), a: numVal(1, 8), b: numVal(2, 8) });
    expect(formatDec(r.next.sum)).toBe("3");
    expect(r.note).toMatch(/rst_n is x/);
  });

  it("the extra stage is narrated as what its code does on edges 3, 4 and 5 of +TEST=gaps, and matches its own waveform", () => {
    const run = runBench(presetConfig("gaps", "extra-stage"));
    const notes = [3, 4, 5].map((k) => stepAt(run, k).dutNote);
    expect(notes[0]).toBe("samples in_valid = 1, a = 5, b = 5: schedules ov_q <= 1 and sum_q <= 10; out_valid <= 0 and sum <= 0 (the old ov_q and sum_q)");
    expect(notes[1]).toBe("samples in_valid = 0: schedules ov_q <= 0, and sum_q holds 10; out_valid <= 1 and sum <= 10 (the old ov_q and sum_q)");
    expect(notes[2]).toBe("samples in_valid = 0: schedules ov_q <= 0, and sum_q holds 10; out_valid <= 0 and sum <= 10 (the old ov_q and sum_q)");
    expect(run.signals.out_valid.slice(3, 7).map(formatDec)).toEqual(["0", "0", "1", "0"]);
    expect(run.signals.sum.slice(3, 7).map(formatDec)).toEqual(["0", "0", "10", "10"]);
    expect(stepAt(run, 5).what).toMatch(/reads out_valid = 1 and sum = 10/);
  });

  it("the extra stage's highlighted line follows the code: dut-ff-ov when the inputs are sampled, dut-ff-sum when the result moves to the outputs", () => {
    // +TEST=gaps with the final idle deleted: after the last send() the bench is quiet and in_valid is still 1, so the DUT is the only actor.
    const run = runBench({ ...presetConfig("gaps", "extra-stage"), dropFinalIdle: "gaps" });
    const keys = new Set(dutSource("extra-stage").map((l) => l.key));
    const sampling = edgeSteps(run).find((s) => s.activeKey === "dut-ff-ov");
    expect(keys.has("dut-ff-ov") && keys.has("dut-ff-sum")).toBe(true);
    expect(sampling?.dutNote).toMatch(/samples in_valid = 1/);
    expect(sampling?.why).toMatch(/schedule ov_q and sum_q/);
    // +TEST=gaps as written: edge 4 samples in_valid = 0, and the second stage moves the first result to the outputs.
    const moving = edgeSteps(runBench(presetConfig("gaps", "extra-stage"))).find((s) => s.activeKey === "dut-ff-sum");
    expect(moving?.edge).toBe(4);
    expect(moving?.dutNote).toMatch(/out_valid <= 1 and sum <= 10/);
    expect(moving?.why).toMatch(/copies ov_q and sum_q to out_valid and sum/);
  });

  it("the DUT is lit on the edge it samples a valid input, and the bench's line stays lit beside it (the concept is send, sample, check)", () => {
    (["smoke", "gaps", "corners", "all", "hold"] as const).forEach((preset) => {
      const run = runBench(presetConfig(preset, 0, preset === "hold"));
      expect(edgeSteps(run).some((s) => s.node === "dut"), preset).toBe(true);
      expect(edgeSteps(run).every((s) => s.alsoNodes.every((n) => n !== s.node)), preset).toBe(true);
    });
    const gaps = stepAt(runBench(presetConfig("gaps", 0)), 3);
    expect(gaps.node).toBe("dut");
    expect(gaps.activeKey).toBe("dut-ff-sum");
    expect(gaps.alsoNodes).toEqual(["stim"]);
    expect(gaps.contextKeys).toContain("idle");
    expect(gaps.why).toMatch(/The flop reads a and b as they were before this edge/);
    expect(gaps.what).toMatch(/idle\(\) drives in_valid <= 0\. The DUT samples in_valid = 1, a = 5, b = 5/);
    const smoke = stepAt(runBench(presetConfig("smoke", 0)), 3);
    expect(smoke.node).toBe("dut");
    expect(smoke.alsoNodes).toEqual(["stim"]);
    expect(smoke.contextKeys).toEqual(expect.arrayContaining(["send-drive", "send-push"]));
  });

  it("on back-to-back traffic send, sample and check share an edge: the checker's verdict leads and the others stay lit", () => {
    const s = stepAt(runBench(presetConfig("smoke", 0)), 4);
    expect(s.node).toBe("chk");
    expect(s.activeKey).toBe("check-cmp");
    expect([...s.alsoNodes].sort()).toEqual(["dut", "stim"]);
    expect(s.contextKeys).toContain("dut-ff-sum");
    expect(s.contextKeys).toContain("send-drive");
    // An edge where only the bench acts lights only the bench.
    const send = stepAt(runBench(presetConfig("gaps", 0)), 2);
    expect(send.node).toBe("stim");
    expect(send.alsoNodes).toEqual([]);
  });

  it("BUG=3 lights the DUT on the idle cycle it moves sum, and says that breaks R4", () => {
    // Without the kata's check nothing decides at edge 5, so the DUT leads; with it the hold check's failure leads and the DUT stays lit.
    const s = stepAt(runBench(presetConfig("hold", 3)), 5);
    expect(s.dutNote).toMatch(/BUG=3 still schedules sum/);
    expect(s.node).toBe("dut");
    expect(s.activeKey).toBe("dut-ff-sum");
    expect(s.why).toMatch(/R4 says sum holds while in_valid is 0/);
    const checked = stepAt(runBench(presetConfig("hold", 3, true)), 5);
    expect(checked.node).toBe("chk");
    expect(checked.alsoNodes).toContain("dut");
    expect(stepAt(runBench(presetConfig("hold", 0)), 5).node).not.toBe("dut");
  });

  it("R1 clears both outputs; R4 holds sum on idle cycles unless BUG=3", () => {
    const reset = dutStep(0, { outValid: bits("1"), sum: numVal(7, 9) }, { rstN: bits("0"), inValid: bits("1"), a: numVal(1, 8), b: numVal(1, 8) });
    expect(formatDec(reset.next.sum)).toBe("0");
    expect(formatDec(reset.next.outValid)).toBe("0");
    const held = dutStep(0, { outValid: bits("1"), sum: numVal(7, 9) }, { rstN: bits("1"), inValid: bits("0"), a: numVal(50, 8), b: numVal(60, 8) });
    expect(formatDec(held.next.sum)).toBe("7");
    const moved = dutStep(3, { outValid: bits("1"), sum: numVal(7, 9) }, { rstN: bits("1"), inValid: bits("0"), a: numVal(50, 8), b: numVal(60, 8) });
    expect(formatDec(moved.next.sum)).toBe("110");
  });
});

describe("anatomy tokens agree with the other panes", () => {
  const tokenOn = (s: EdgeStep, edgeId: string) => s.tokens.filter((t) => t.edgeId === edgeId);

  it("on the sampling edge the transaction is at the DUT and its expected value waits in exp_q, on no wire", () => {
    const s = stepAt(runBench(presetConfig("gaps", 0)), 3);
    expect(tokenOn(s, "dut-chk")).toEqual([]);
    expect(tokenOn(s, "q-chk")).toEqual([]);
    expect(tokenOn(s, "stim-dut")).toEqual([{ edgeId: "stim-dut", t: 0.92, label: "5+5" }]);
    expect(formatQueue(s.queueAfter)).toBe("{10}");
  });

  it("on the send edge a+b heads for the DUT and the expected sum heads into exp_q", () => {
    const s = stepAt(runBench(presetConfig("gaps", 0)), 2);
    expect(s.tokens.map((t) => [t.edgeId, t.label])).toEqual([
      ["stim-dut", "5+5"],
      ["model-q", "10"],
    ]);
  });

  it("at the check, actual meets expected: BUG=2 shows 11 on the DUT's wire against 10 from exp_q", () => {
    const good = stepAt(runBench(presetConfig("gaps", 0)), 4);
    expect(tokenOn(good, "dut-chk").map((t) => t.label)).toEqual(["10"]);
    expect(tokenOn(good, "q-chk").map((t) => t.label)).toEqual(["10"]);
    const bad = stepAt(runBench(presetConfig("gaps", 2)), 4);
    expect(tokenOn(bad, "dut-chk").map((t) => t.label)).toEqual(["11"]);
    expect(tokenOn(bad, "q-chk").map((t) => t.label)).toEqual(["10"]);
  });

  it("the extra stage holds the transaction at the DUT, then at its output wire, and the checker still reads it one edge later", () => {
    const run = runBench(presetConfig("gaps", "extra-stage"));
    expect(tokenOn(stepAt(run, 3), "stim-dut").map((t) => t.label)).toEqual(["5+5"]);
    expect(tokenOn(stepAt(run, 4), "dut-chk")).toEqual([{ edgeId: "dut-chk", t: 0.08, label: "5+5" }]);
    expect(tokenOn(stepAt(run, 4), "q-chk")).toEqual([]);
    expect(tokenOn(stepAt(run, 5), "dut-chk").map((t) => t.label)).toEqual(["10"]);
  });

  it("a transaction nobody checked never reaches the checker's wires", () => {
    const run = runBench(clinicCase("no-reset").config);
    edgeSteps(run).forEach((s) => {
      expect(tokenOn(s, "q-chk")).toEqual([]);
      expect(tokenOn(s, "dut-chk")).toEqual([]);
    });
  });
});

describe("narration while exp_q is still hidden", () => {
  const run = runBench(presetConfig("gaps", 0));

  it("names no pushed or popped value, on the edges that have them and at the falling-edge drain", () => {
    const send = stepAt(run, 6).narration;
    expect(send.bench).toMatch(/pushes 19 onto exp_q/);
    expect(send.benchNoQueue).toBe("Edge 6 (65 ns): send(9, 10) drives in_valid, a and b with <=; the queue is hidden until you predict.");
    const pop = stepAt(run, 7).narration;
    expect(pop.checker).toMatch(/pops 15 from exp_q/);
    expect(pop.checkerNoQueue).toMatch(/reads out_valid = 1 and sum = 15, pops the oldest expectation \(the queue is hidden until you predict\): a match/);
    edgeSteps(run).forEach((s) => {
      expect(s.narration.queueHidden).not.toMatch(/pushes \d|pops \d|holding \d|exp_q empty/);
      expect(s.narration.benchNoQueue).not.toMatch(/pushes \d|holding \d|exp_q empty/);
    });
  });

  it("is otherwise the same narration", () => {
    expect(stepAt(run, 1).narration.queueHidden).toBe(stepAt(run, 1).what);
    expect(stepAt(run, 3).narration.queueHidden).toMatch(/The DUT samples in_valid = 1, a = 5, b = 5: schedules out_valid <= 1 and sum <= 10/);
  });
});

describe("queue and compare rules", () => {
  it("pop_front on an empty queue returns the default exp_t (all x) with a warning and leaves the queue unchanged (§7.10.2.4, Table 7-1)", () => {
    const q: Expectation[] = [];
    const r = popFront(q);
    expect(formatDec(r.value.sum)).toBe("x");
    expect(formatDec(r.value.a)).toBe("x");
    expect(r.warning).toMatch(/7\.10\.2\.4/);
    expect(q).toHaveLength(0);
  });

  it("!== fails an X result; != with an ambiguous x gives x and the if takes else, counting a pass (§11.4.5, §12.4)", () => {
    const actualX = bits("x00000000"); // known bits match 0, bit 8 unknown
    expect(judge("!==", actualX, numVal(0, 9))).toBe("fail");
    expect(judge("!=", actualX, numVal(0, 9))).toBe("x-pass");
    expect(judge("!=", bits("100000000"), numVal(0, 9))).toBe("fail"); // bit 8 known and differs
    expect(judge("!=", numVal(10, 9), numVal(10, 9))).toBe("pass");
  });

  it("!== compares x and z as values: x against x is equal, x against a known bit is not (§11.4.5)", () => {
    const allX = bits("xxxxxxxxx");
    expect(judge("!==", allX, allX)).toBe("pass");
    expect(judge("!==", allX, numVal(0, 9))).toBe("fail");
    expect(judge("!==", bits("zzzzzzzzz"), allX)).toBe("fail");
    expect(benchSource(DEFAULT_CONFIG).find((l) => l.key === "check-cmp")?.text).toMatch(/\/\/ !== : x and z compare as values, so an x bit against a known bit is a mismatch$/);
    expect(benchSource(DEFAULT_CONFIG).map((l) => l.text).join("\n")).not.toMatch(/an x or z bit is a mismatch/);
  });

  it("an immediate assertion treats x as false and fails (§16.3); a 2-state copy turns x into 0 first (§6.11.2)", () => {
    const actualX = bits("x00000000");
    expect(judge("assert-eq", actualX, numVal(0, 9))).toBe("fail");
    expect(judge("int-copy", actualX, numVal(0, 9))).toBe("pass");
    expect(judge("int-copy", actualX, numVal(256, 9))).toBe("fail");
    // The copy cleans actual only: an x in the expected value still makes s != e.sum x, and the if takes its else (§11.4.5, §12.4).
    expect(judge("int-copy", numVal(5, 9), bits("xxxxxxxxx"))).toBe("x-pass");
    expect(judge("assert-eq", numVal(5, 9), bits("xxxxxxxxx"))).toBe("fail");
  });

  it("a pass counted without a match is told apart from a real one", () => {
    const exp = { id: 0, a: numVal(0, 8), b: numVal(0, 8), sum: numVal(0, 9), sentAtEdge: 0, checkedAtEdge: 0 };
    expect(passWithoutMatch({ kind: "x-pass", exp, actual: bits("x00000000") })).toBe(true);
    expect(passWithoutMatch({ kind: "pass", exp, actual: bits("x00000000") })).toBe(true);
    expect(passWithoutMatch({ kind: "pass", exp, actual: numVal(0, 9) })).toBe(false);
    expect(passWithoutMatch({ kind: "fail", exp, actual: bits("x00000000") })).toBe(false);
  });

  it("the checker's narration is true of the operator the bench uses", () => {
    const firstOf = (config: Parameters<typeof runBench>[0], kind: EdgeStep["checker"]["kind"]) => edgeSteps(runBench(config)).find((s) => s.checker.kind === kind) as EdgeStep;
    const neq = clinicCase("neq").config;
    // != on known bits.
    const plain = firstOf({ ...DEFAULT_CONFIG, compareOp: "!=" }, "pass");
    expect(plain.why).toMatch(/!= is 0 only when every bit is known and equal \(§11\.4\.5\)/);
    expect(plain.why).not.toMatch(/!==/);
    expect(plain.what).toMatch(/: a match, pass_cnt\+\+\./);
    // The assertion form.
    const held = firstOf({ ...DEFAULT_CONFIG, compareOp: "assert-eq" }, "pass");
    expect(held.why).toMatch(/§16\.3/);
    expect(held.why).not.toMatch(/!==/);
    expect(held.what).toMatch(/the assertion holds and its pass statement runs pass_cnt\+\+/);
    const failedAssert = firstOf({ ...neq, compareOp: "assert-eq" }, "fail");
    expect(failedAssert.what).toMatch(/== gives x, so the assertion fails/);
    // A 2-state copy of an X: only the copy matched.
    const copied = firstOf({ ...neq, compareOp: "int-copy" }, "pass");
    expect(formatDec(copied.sampled.sum)).toBe("X");
    expect(copied.what).toMatch(/the X itself is no match, but its 2-state copy matched/);
    expect(copied.what).not.toMatch(/: a match/);
    expect(copied.why).toMatch(/turned every x bit into 0 before the compare \(§6\.11\.2\)/);
    expect(copied.why).not.toMatch(/!==/);
    expect(firstOf({ ...DEFAULT_CONFIG, compareOp: "int-copy" }, "pass").what).toMatch(/: a match, pass_cnt\+\+\./);
    // !== keeps the lesson's words.
    const caseNeq = firstOf(DEFAULT_CONFIG, "pass");
    expect(caseNeq.what).toMatch(/: a match, pass_cnt\+\+\./);
    expect(caseNeq.why).toMatch(/!== returns 0 or 1 whatever the bits \(§11\.4\.5\)/);
  });

  it("%0d prints an all-x value as x and a partly unknown one as X (§21.2.1.3)", () => {
    expect(formatDec(bits("xxxxxxxxx"))).toBe("x");
    expect(formatDec(bits("x00000101"))).toBe("X");
    expect(formatDec(numVal(10, 9))).toBe("10");
  });

  it("%0d prints an all-z value as z, a partly z one as Z, and X when x and z are mixed (§21.2.1.3)", () => {
    expect(formatDec(bits("zzzzzzzzz"))).toBe("z");
    expect(formatDec(bits("z00000101"))).toBe("Z");
    expect(formatDec(bits("xz0000101"))).toBe("X");
  });
});

describe("mutation matrix", () => {
  it("reproduces the lesson's BUG=0/1/2 table for smoke, corners, gaps and all", () => {
    const summary = (preset: "smoke" | "corners" | "gaps" | "all", m: 0 | 1 | 2) => runBench(presetConfig(preset, m)).summary;
    expect([summary("smoke", 0), summary("smoke", 1), summary("smoke", 2)]).toEqual(["PASS=3 FAIL=0", "PASS=3 FAIL=0", "PASS=0 FAIL=3"]);
    expect([summary("corners", 0), summary("corners", 1), summary("corners", 2)]).toEqual(["PASS=7 FAIL=0", "PASS=4 FAIL=3", "PASS=0 FAIL=7"]);
    expect([summary("gaps", 0), summary("gaps", 1), summary("gaps", 2)]).toEqual(["PASS=4 FAIL=0", "PASS=4 FAIL=0", "PASS=0 FAIL=4"]);
    expect([summary("all", 0), summary("all", 1), summary("all", 2)]).toEqual(["PASS=14 FAIL=0", "PASS=11 FAIL=3", "PASS=0 FAIL=14"]);
  });

  it("without the hold check only corners catches BUG=1, everything catches BUG=2, nothing catches BUG=3, the extra stage or the swap", () => {
    const m = buildMatrix(false);
    expect(m.rows).toEqual(ALL_TEST_IDS);
    expect(m.columns).toEqual(MATRIX_MUTANTS);
    const state = (t: (typeof ALL_TEST_IDS)[number], c: string) => m.cells[t][c].state;
    expect(ALL_TEST_IDS.map((t) => state(t, "bug1"))).toEqual(["survived", "caught", "survived", "survived"]);
    expect(ALL_TEST_IDS.map((t) => state(t, "bug2"))).toEqual(["caught", "caught", "caught", "caught"]);
    expect(ALL_TEST_IDS.map((t) => state(t, "bug3"))).toEqual(["survived", "survived", "survived", "survived"]);
    expect(ALL_TEST_IDS.map((t) => state(t, "extra-stage"))).toEqual(["survived", "survived", "survived", "survived"]);
    expect(ALL_TEST_IDS.map((t) => state(t, "swap-ab"))).toEqual(["survived", "survived", "survived", "survived"]);
    expect(m.cells.smoke.bug1.summary).toBe("PASS=3 FAIL=0");
    expect(m.cells.hold.bug3.summary).toBe("PASS=1 FAIL=0");
  });

  it("with the hold check, BUG=3 is caught by hold and only by hold: it needs both the test and the check", () => {
    const m = buildMatrix(true);
    expect(ALL_TEST_IDS.map((t) => m.cells[t].bug3.state)).toEqual(["survived", "survived", "survived", "caught"]);
    expect(m.cells.hold.bug3.summary).toBe("PASS=1 FAIL=3");
    // The extra stage still passes with the hold check: sum and out_valid move together.
    expect(ALL_TEST_IDS.map((t) => m.cells[t]["extra-stage"].state)).toEqual(["survived", "survived", "survived", "survived"]);
  });

  it("explains each escape from the run: no smoke result reaches 256; the swap is equivalent; the extra stage hides behind the queue", () => {
    const m = buildMatrix(false);
    expect(explainEscape("smoke", 1, false, m.cells.smoke.bug1.run)).toMatch(/No smoke result reaches 256 \(the largest is 127\)/);
    expect(explainEscape("gaps", "swap-ab", false, m.cells.gaps["swap-ab"].run)).toMatch(/equivalent mutant/);
    expect(explainEscape("corners", "extra-stage", false, m.cells.corners["extra-stage"].run)).toMatch(/values in order, not timing/);
    expect(explainEscape("gaps", 3, false, m.cells.gaps.bug3.run)).toMatch(/only when out_valid is 1/);
    expect(explainEscape("gaps", 3, true, buildMatrix(true).cells.gaps.bug3.run)).toMatch(/never changes a or b on an idle cycle/);
    expect(explainEscape("hold", 1, false, m.cells.hold.bug1.run)).toMatch(/produces the same 1 sum:/);
    expect(explainEscape("smoke", 1, false, m.cells.smoke.bug1.run)).toMatch(/produces the same 3 sums:/);
    expect(columnId(1)).toBe("bug1");
    expect(columnId("extra-stage")).toBe("extra-stage");
  });

  it("the extra pipeline stage delays every result one more edge and still passes every test (an in-order queue cannot see latency)", () => {
    const run = runBench(presetConfig("gaps", "extra-stage"));
    expect(run.summary).toBe("PASS=4 FAIL=0");
    expect(run.expectations[0].sentAtEdge).toBe(2);
    expect(run.expectations[0].checkedAtEdge).toBe(5);
  });
});

describe("prediction questions are generated from the run", () => {
  it("gaps: the checker sees the result of send(5, 5) at edge 4; exp_q after edge 6 is {15, 19}", () => {
    const run = runBench(presetConfig("gaps", 0));
    const eq = edgePrediction(run);
    expect(eq?.question).toMatch(/send\(5, 5\) runs on edge 2\. On which edge does the checker see the result of send\(5, 5\) \(out_valid = 1\)\?/);
    expect(eq?.options.find((o) => o.correct)?.label).toMatch(/^Edge 4/);
    expect(eq?.options.find((o) => o.id === "e3")?.feedback).toMatch(/schedules out_valid <= 1 and sum <= 10/);
    const qq = queuePrediction(run);
    expect(qq?.question).toMatch(/after edge 6/);
    expect(qq?.options.find((o) => o.correct)?.label).toBe("{15, 19}");
    expect(qq?.options.some((o) => o.label === "{15}")).toBe(true);
    expect(qq?.options.some((o) => o.label === "{19}")).toBe(true);
    expect(qq?.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it("smoke: the first result is seen at edge 4 too, and exp_q is empty after edge 6", () => {
    const run = runBench(presetConfig("smoke", 0));
    expect(edgePrediction(run)?.options.find((o) => o.correct)?.label).toMatch(/^Edge 4/);
    expect(queuePrediction(run)?.options.find((o) => o.correct)?.label).toBe("{}");
  });

  it("the edge question offers every edge from the send to one past the check: 2..5 normally, 2..6 for the extra stage (so edge 4 is a wrong answer there)", () => {
    const normal = edgePrediction(runBench(presetConfig("smoke", 0)));
    expect(normal?.options.map((o) => o.id)).toEqual(["e2", "e3", "e4", "e5"]);
    const extra = edgePrediction(runBench(presetConfig("smoke", "extra-stage")));
    expect(extra?.options.map((o) => o.id)).toEqual(["e2", "e3", "e4", "e5", "e6"]);
    expect(extra?.options.find((o) => o.correct)?.id).toBe("e5");
    expect(extra?.options.find((o) => o.id === "e4")?.feedback).toMatch(/the DUT here has an extra pipeline stage/);
    expect(extra?.options.find((o) => o.id === "e6")?.feedback).toMatch(/2 edges inside the DUT, one for the checker/);
    expect(normal?.options.find((o) => o.id === "e5")?.feedback).toMatch(/one edge for the DUT, one for the checker/);
  });

  it("BUG=2: the value on the wire comes from the run, kept apart from the expected value popped from exp_q", () => {
    const run = runBench(presetConfig("gaps", 2));
    const eq = edgePrediction(run) as NonNullable<ReturnType<typeof edgePrediction>>;
    expect(eq.question).not.toMatch(/sum = /);
    const correct = eq.options.find((o) => o.correct);
    expect(correct?.id).toBe("e4");
    expect(correct?.feedback).toMatch(/the checker reads out_valid = 1 and sum = 11 /);
    expect(correct?.feedback).toMatch(/pops 10 from exp_q/);
    expect(correct?.feedback).toMatch(/The expected value is 10 and the actual value is 11: a mismatch/);
    expect(correct?.feedback).not.toMatch(/sum = 10/);
    const sampling = eq.options.find((o) => o.id === "e3");
    expect(sampling?.feedback).toMatch(/schedules out_valid <= 1 and sum <= 11/);
    expect(sampling?.feedback).toMatch(/the expected value is 10/);
    expect(sampling?.feedback).not.toMatch(/sum <= 10/);
    // The same facts as the run's own narration.
    expect(stepAt(run, 3).what).toMatch(/sum <= 11/);
    expect(stepAt(run, 4).what).toMatch(/sum = 11, pops 10 from exp_q: a mismatch/);
  });

  it("a DUT whose result equals the expected value says nothing about a mismatch; 0 + 0 no longer reads as 'sum = 0'", () => {
    const eq = edgePrediction(runBench(presetConfig("corners", 0)));
    expect(eq?.question).toMatch(/result of send\(0, 0\)/);
    expect(eq?.options.find((o) => o.correct)?.feedback).not.toMatch(/mismatch/);
    expect(eq?.options.find((o) => o.id === "e3")?.feedback).not.toMatch(/expected value/);
  });

  it("extra stage: the feedback names ov_q and sum_q on the sampling edge and out_valid and sum one edge later", () => {
    const eq = edgePrediction(runBench(presetConfig("gaps", "extra-stage")));
    const e3 = eq?.options.find((o) => o.id === "e3")?.feedback;
    expect(e3).toMatch(/schedules ov_q <= 1 and sum_q <= 10/);
    expect(e3).not.toMatch(/schedules out_valid/);
    expect(eq?.options.find((o) => o.id === "e4")?.feedback).toMatch(/schedule out_valid <= 1 and sum <= 10 from ov_q and sum_q/);
    expect(eq?.options.find((o) => o.correct)?.id).toBe("e5");
  });

  it("the queue question always has at least three options with exactly one correct, and the position of the correct one varies", () => {
    const presets = ["smoke", "corners", "gaps", "all", "hold"] as const;
    const mutants: readonly MutantId[] = [0, ...MATRIX_MUTANTS];
    const correctAt = new Set<number>();
    presets.forEach((p) =>
      mutants.forEach((m) => {
        const q = queuePrediction(runBench(presetConfig(p, m, p === "hold")));
        expect(q, `${p} x ${String(m)}`).not.toBeNull();
        expect(q?.options.length, `${p} x ${String(m)}`).toBeGreaterThanOrEqual(3);
        expect(q?.options.filter((o) => o.correct), `${p} x ${String(m)}`).toHaveLength(1);
        expect(new Set(q?.options.map((o) => o.label)).size).toBe(q?.options.length);
        correctAt.add(q?.options.findIndex((o) => o.correct) ?? -1);
      }),
    );
    expect(correctAt.size).toBeGreaterThan(1);
    // +TEST=hold: the only send is popped at edge 4, so the usual distractors collapse; the phantom one says send_invalid pushes nothing.
    const hold = queuePrediction(runBench(presetConfig("hold", 0, true)));
    expect(hold?.options.find((o) => o.correct)?.label).toBe("{}");
    expect(hold?.options.map((o) => o.label)).toContain("{7}");
    expect(hold?.options.find((o) => o.id === "phantom")).toMatchObject({ label: "{110, 150}" });
    expect(hold?.options.find((o) => o.id === "phantom")?.feedback).toMatch(/pushes nothing onto exp_q/);
  });
});

describe("ending the run", () => {
  it("logic clk; without an initializer never toggles: no TEST line, the watchdog reports PASS=0 FAIL=1 and $fatal ends the run at 10000 ns (§6.8, §11.4.8, §20.10)", () => {
    const run = runBench({ ...DEFAULT_CONFIG, clockInit: "none" });
    expect(logText(run)).toEqual(["PASS=0 FAIL=1", "[fatal @ 10000 ns] WDOG test 'all' still running at 10000 ns"]);
    expect(run.ended).toBe(true);
    expect(run.endReason).toBe("fatal");
    expect(run.edges).toBe(0);
    expect(run.clock).toBe("x");
    // The watchdog's own fail_cnt++ runs before report(), so the counters report() found were PASS=0 FAIL=1.
    expect(run.rawPass).toBe(0);
    expect(run.rawFail).toBe(1);
    expect(runBench({ ...DEFAULT_CONFIG, clockInit: "none", mutant: 1 }).caught).toBe(false);
    expect(run.steps[0].what).toMatch(/the watchdog counts the hang, prints the summary and calls \$fatal/);
    expect(run.steps[0].why).toMatch(/\$fatal ends the run through an implicit \$finish \(§20\.10\)/);
  });

  it("a live clock whose TIMEOUT expires mid-run: the watchdog fires at TIMEOUT, in time order with the edges", () => {
    // 100 ns: edges up to 95 ns have run, five results are checked, and the two still in flight count as leftovers.
    const at100 = runBench({ ...DEFAULT_CONFIG, timeoutNs: 100 });
    expect(logText(at100).slice(-3)).toEqual(["[error @ 100 ns] CHK 2 result(s) never arrived", "PASS=5 FAIL=3", "[fatal @ 100 ns] WDOG test 'all' still running at 100 ns"]);
    expect(at100.endReason).toBe("fatal");
    expect(at100.endTime).toBe(100);
    expect(at100.rawPass).toBe(5);
    expect(at100.rawFail).toBe(1);
    expect(at100.edges).toBe(10);
    const step = at100.steps[at100.steps.length - 1];
    expect(step.kind).toBe("wdog");
    expect(step.what).toMatch(/#\(TIMEOUT\) expired first/);
    expect(step.why).toMatch(/implies \$finish \(§20\.10\)/);
    const keys = new Set(benchSource(at100.config).map((l) => l.key));
    expect(keys.has(step.activeKey)).toBe(true);
    step.contextKeys.forEach((k) => expect(keys.has(k)).toBe(true));
  });

  it("near the end of a run the watchdog still wins when TIMEOUT comes before the run branch ends", () => {
    // drain()'s last quiet edge is at 250 ns.
    const at247 = runBench({ ...DEFAULT_CONFIG, timeoutNs: 247 });
    expect(at247.endReason).toBe("fatal");
    expect(at247.endTime).toBe(247);
    expect(at247.summary).toBe("PASS=14 FAIL=1");
    expect(at247.log.some((l) => l.kind === "fatal" && l.time === 247)).toBe(true);
    // Between a rising and a falling edge: the falling edge's work must not run first.
    const at228 = runBench({ ...DEFAULT_CONFIG, timeoutNs: 228 });
    expect(at228.endTime).toBe(228);
    expect(at228.steps.flatMap((s) => s.events).some((e) => e.kind === "drain-check" && e.time === 230)).toBe(false);
    // Before the first edge: nothing has been sampled.
    const at3 = runBench({ ...DEFAULT_CONFIG, timeoutNs: 3 });
    expect(at3.edges).toBe(0);
    expect(at3.summary).toBe("PASS=0 FAIL=1");
    expect(at3.endTime).toBe(3);
    // A run that ends in time is untouched, and a tie goes to the edge's work.
    expect(runBench({ ...DEFAULT_CONFIG, timeoutNs: 251 }).endReason).toBe("finish");
    expect(runBench({ ...DEFAULT_CONFIG, timeoutNs: 250 }).endReason).toBe("finish");
  });

  it("an X result counted as a pass is explained with the operators that would have failed it (!==/=== or an assertion)", () => {
    const run = runBench(clinicCase("neq").config);
    const s = edgeSteps(run).find((e) => e.checker.kind === "x-pass") as EdgeStep;
    expect(s.why).toMatch(/To make an unknown fail, use !==\/===, which never return x, or put the pass on the true branch of an if \(==\) or assertion \(§16\.3\), so x falls to the failing side/);
    // The fault is where the pass sits, not the operator alone: if (actual == e.sum) pass_cnt++; else fail_cnt++; fails an x too.
    expect(s.why).not.toMatch(/Only a case compare/);
    expect(s.what).toMatch(/the known bits agree and some bit is x, so != gives x/);
    const copy = edgeSteps(runBench({ ...DEFAULT_CONFIG, tests: ["smoke"], testName: "smoke", compareOp: "int-copy", dropFinalIdle: "smoke", unexpectedGuard: false })).find((e) => e.checker.kind === "x-pass");
    expect(copy?.what).toMatch(/the 2-state copy is known but the expected value has x bits, so s != e\.sum gives x/);
    expect(copy?.what).not.toMatch(/known bits agree/);
  });

  it("no $finish: the summary prints and the run never ends (§9.6.1); a model note says so", () => {
    const run = runBench({ ...DEFAULT_CONFIG, ending: "none" });
    expect(run.summary).toBe("PASS=14 FAIL=0");
    expect(run.ended).toBe(false);
    expect(run.endReason).toBe("horizon");
    // The log note names the cause only: in the clinic it is on screen before the learner picks a suspect.
    const note = run.log.find((l) => l.kind === "note");
    expect(note?.text).toBe("the summary printed, but the free-running clock keeps the simulation busy (§9.6.1)");
    const horizon = run.steps.find((s) => s.kind === "horizon");
    expect(horizon).toBeDefined();
    expect(horizon?.what).toMatch(/there is no \$finish, and disable fork already killed the watchdog/);
    expect(horizon?.what).toMatch(/still running at the horizon \(a model label\)/);
    expect(run.steps.filter((s) => s.kind === "edge").length).toBeGreaterThan(25);
  });

  it("$stop suspends instead of ending (§20.2), and what happens next is marked tool-dependent", () => {
    const run = runBench({ ...DEFAULT_CONFIG, ending: "stop" });
    expect(run.ended).toBe(false);
    expect(run.endReason).toBe("stop");
    const stop = run.steps[run.steps.length - 1];
    expect(stop.what).toMatch(/\$stop suspended the simulation \(§20\.2\)/);
    expect(stop.what).toMatch(/tool-dependent/);
    expect(stop.what).toMatch(/does not exit the simulator the way \$finish does/);
    expect(stop.why).toMatch(/tool-dependent/);
    [stop.what, stop.why, clinicCase("no-finish").fixes.find((f) => f.id === "stop")?.review ?? ""].forEach((text) => {
      expect(text).not.toMatch(/forever/);
      expect(text).not.toMatch(/[Oo]nly \$finish/);
    });
  });

  it("in a normal run the run branch ends first: join_any resumes main and disable fork kills the watchdog, which never prints (§9.3.2, §9.6.3)", () => {
    const run = runBench(DEFAULT_CONFIG);
    expect(run.log.some((l) => /WDOG/.test(l.text))).toBe(false);
    const end = run.steps[run.steps.length - 1];
    expect(end.events.some((e) => e.kind === "watchdog-killed")).toBe(true);
    expect(end.why).toMatch(/§9\.3\.2/);
    expect(end.why).toMatch(/§9\.6\.3/);
  });
});

describe("generated source", () => {
  it("the checker is a plain always and the DUT an always_ff (§9.2.2.2, §9.2.2.4); the compare is !== and BUG follows the mutant", () => {
    const src = benchSource(presetConfig("corners", 1));
    const text = src.map((l) => l.text).join("\n");
    expect(text).toMatch(/always @\(posedge clk\)/);
    expect(text).not.toMatch(/always_ff/);
    expect(text).toMatch(/actual !== e\.sum/);
    expect(text).toMatch(/\.BUG\(1\)/);
    expect(text).toMatch(/send\(8'd255, 8'd1\);/);
    expect(src.find((l) => l.key === "check-cmp")?.text).toMatch(/!==/);
    const dut = dutSource(1).map((l) => l.text).join("\n");
    expect(dut).toMatch(/always_ff @\(posedge clk\)/);
    expect(dut).toMatch(/next_sum\[W\] = 1'b0/);
    expect(dutSource(3).map((l) => l.text).join("\n")).toMatch(/in_valid \|\| BUG == 3/);
  });

  it("the kata's additions appear only with the hold check: send_invalid, last_sum and test_hold registered in run_one", () => {
    const base = benchSource(DEFAULT_CONFIG).map((l) => l.text).join("\n");
    expect(base).not.toMatch(/send_invalid/);
    expect(base).not.toMatch(/"hold": test_hold/);
    const kata = benchSource(presetConfig("all", 0, true)).map((l) => l.text).join("\n");
    expect(kata).toMatch(/send_invalid\(8'd50, 8'd60\);/);
    expect(kata).toMatch(/sum !== last_sum/);
    expect(kata).toMatch(/"hold": test_hold\(\);/);
    expect(kata).toMatch(/run_one\("hold"\);/);
  });

  it("+TEST=hold without the kata's check still registers test_hold and send_invalid (the test it runs), but not last_sum or the hold branch", () => {
    const src = benchSource(presetConfig("hold", 2, false));
    const text = src.map((l) => l.text).join("\n");
    expect(src.some((l) => l.key === "test-hold")).toBe(true);
    expect(src.some((l) => l.key === "send-invalid")).toBe(true);
    expect(text).toMatch(/"hold": test_hold\(\);/);
    expect(text).toMatch(/send_invalid\(8'd70, 8'd80\);/);
    expect(text).not.toMatch(/last_sum/);
    expect(src.find((l) => l.key === "chk-outvalid")?.text).toBe("      else if (out_valid) check_result(sum);");
  });

  it("every line a matrix run points at exists in that run's own generated tb_top (the hold row included)", () => {
    [false, true].forEach((holdCheck) => {
      const m = buildMatrix(holdCheck);
      ALL_TEST_IDS.forEach((t) =>
        MATRIX_MUTANTS.forEach((mut) => {
          const run = m.cells[t][columnId(mut)].run;
          const keys = new Set([...dutSource(run.config.mutant), ...benchSource(run.config)].map((l) => l.key).filter(Boolean));
          run.steps.forEach((s) => {
            expect(keys.has(s.activeKey)).toBe(true);
            s.contextKeys.forEach((k) => expect(keys.has(k)).toBe(true));
          });
        }),
      );
    });
  });

  it("both design elements declare a time unit (3.14.2.3) and tb_top declares the W it uses", () => {
    expect(dutSource(0).map((l) => l.text)).toContain("  timeunit 1ns; timeprecision 1ps;        // every module needs one (3.14.2.3)");
    expect(dutSource("extra-stage").some((l) => l.key === "dut-timeunit")).toBe(true);
    const tb = benchSource(DEFAULT_CONFIG);
    expect(tb[1].text).toBe("  timeunit 1ns; timeprecision 1ps;");
    expect(tb[2]).toEqual({ text: "  localparam int W = 8;", key: "w-decl", owner: "testbench" });
  });

  it("idle after every send is shown in the test tasks only, so the code runs one idle cycle per transaction like the model", () => {
    const src = benchSource({ ...DEFAULT_CONFIG, idleAfterEachSend: true });
    expect(src.some((l) => l.key === "send-idle")).toBe(false);
    const sendTask = src.slice(src.findIndex((l) => l.key === "send-task"), src.findIndex((l) => l.key === "idle-task")).map((l) => l.text);
    expect(sendTask.filter((t) => /@\(posedge clk\)/.test(t))).toHaveLength(1);
    expect(src.filter((l) => l.key?.startsWith("test-smoke-")).map((l) => l.text.trim())).toEqual(["send(8'd1, 8'd2);", "idle(1);", "send(8'd10, 8'd20);", "idle(1);", "send(8'd100, 8'd27);", "idle(1);", "idle(1);"]);
  });

  it("the assertion form of check_result counts the pass once and closes its else block with a plain end", () => {
    const src = benchSource({ ...DEFAULT_CONFIG, compareOp: "assert-eq" });
    const body = src.slice(src.findIndex((l) => l.key === "check-task"), src.findIndex((l) => l.key === "chk-always")).map((l) => l.text);
    expect(body.find((t) => /assert/.test(t))).toMatch(/^\s+assert \(actual == e\.sum\) pass_cnt\+\+; else begin/);
    expect(src.find((l) => l.key === "check-pass")?.text).toBe("    end");
    expect(body.join("\n").match(/pass_cnt\+\+/g)).toHaveLength(1);
    expect(body.join("\n")).not.toMatch(/end else pass_cnt/);
    expect(benchSource(DEFAULT_CONFIG).find((l) => l.key === "check-pass")?.text).toBe("    end else pass_cnt++;");
  });

  it("the x-carry mutant is described as a carry bit driven x, matching the RTL it shows", () => {
    expect(dutSource("x-carry").find((l) => l.key === "dut-bug")?.text).toMatch(/next_sum\[W\] = 1'bx;.*driven x/);
    expect(clinicCase("neq").command).toMatch(/carry bit is driven x/);
  });

  it("a broken bench's source shows its fault in neutral code, with no comment that labels the culprit", () => {
    expect(benchSource(clinicCase("neq").config).find((l) => l.key === "check-cmp")?.text).toBe("    if (actual != e.sum) begin");
    const noIdle = benchSource(clinicCase("no-idle").config);
    const smoke = noIdle.filter((l) => l.key?.startsWith("test-smoke-")).map((l) => l.text.trim());
    expect(smoke).toEqual(["send(8'd1, 8'd2);", "send(8'd10, 8'd20);", "send(8'd100, 8'd27);"]);
    expect(benchSource(clinicCase("clk-x").config).find((l) => l.key === "clk-decl")?.text).toBe("  logic clk;");
    // A clock that never toggles has no rising edges to promise (§6.8, §11.4.8, Table 9-2); a live one does.
    expect(benchSource(clinicCase("clk-x").config).find((l) => l.key === "clk-always")?.text).toBe("  always #5 clk = ~clk;");
    expect(benchSource(DEFAULT_CONFIG).find((l) => l.key === "clk-always")?.text).toMatch(/rising edges at 5, 15, 25 ns/);
    expect(benchSource(clinicCase("single-expected").config).find((l) => l.key === "exp-decl")?.text).toBe("  exp_t expected;");
    const noFinish = benchSource(clinicCase("no-finish").config);
    expect(noFinish.some((l) => l.key === "main-finish")).toBe(false);
    expect(noFinish.map((l) => l.text).join("\n")).not.toMatch(/\(no /);
    const noReset = benchSource(clinicCase("no-reset").config);
    expect(noReset.some((l) => l.key === "reset-task")).toBe(false);
    expect(noReset.map((l) => l.text).join("\n")).not.toMatch(/\(no /);
  });

  it("a deleted statement puts the culprit on the real line beside the gap, and the feedback names what is missing", () => {
    const noReset = clinicCase("no-reset");
    const resetLines = benchSource(noReset.config);
    const runBegin = resetLines.findIndex((l) => l.text.trim() === "begin : run");
    expect(resetLines[runBegin + 1].key).toBe(noReset.culprit);
    expect(noReset.found).toMatch(/nothing drives rst_n before this line/);
    const noFinish = clinicCase("no-finish");
    const finishLines = benchSource(noFinish.config);
    expect(finishLines.find((l) => l.key === noFinish.culprit)?.text.trim()).toBe("report();");
    expect(noFinish.found).toMatch(/nothing ends the run after it/);
    // Those lines take a suspect control in every case, so having one says nothing.
    CLINIC_CASES.forEach((kase) => {
      const keys = suspectKeys(benchSource(kase.config), kase);
      expect(keys).toContain("main-run-all");
      expect(keys).toContain("main-report");
    });
  });

  it("no comment in a broken bench promises what that bench cannot do", () => {
    const early = benchSource(clinicCase("early-check").config);
    expect(early.find((l) => l.key === "drain-quiet")?.text).toMatch(/\/\/ two quiet cycles$/);
    expect(early.find((l) => l.key === "exp-decl")?.text).toBe("  exp_t exp_q[$];");
    expect(benchSource(DEFAULT_CONFIG).find((l) => l.key === "drain-quiet")?.text).toMatch(/two quiet cycles: time for a late result to reach the checker/);
  });

  it("no generated source references exp_q unless it declares it", () => {
    const configs = [
      ...CLINIC_CASES.flatMap((k) => [k.config, ...k.fixes.map((f) => f.apply(k.config))]),
      ...(["smoke", "corners", "gaps", "all", "hold"] as const).map((p) => presetConfig(p, 0, p === "hold")),
    ];
    configs.forEach((config) => {
      const text = benchSource(config).map((l) => l.text).join("\n");
      const declared = /exp_t exp_q\[\$\];/.test(text);
      expect(/exp_q/.test(text), `${config.checkStyle}: ${text}`).toBe(declared);
    });
    expect(configs.some((c) => c.checkStyle === "single-expected" || c.checkStyle === "live-model")).toBe(true);
  });

  it("without a queue drain() is one falling edge plus the two quiet ones, as the model times it", () => {
    const config = clinicCase("single-expected").config;
    const src = benchSource(config);
    expect(src.find((l) => l.key === "drain-task")?.text).toBe("  task automatic drain();");
    expect(src.find((l) => l.key === "drain")?.text).toMatch(/^\s+repeat \(3\) @\(negedge clk\);/);
    const run = runBench(config);
    const drainEvents = run.steps.flatMap((s) => s.events).filter((e) => e.kind === "drain-check" || e.kind === "drain-quiet");
    expect(drainEvents).toHaveLength(3);
    expect(run.endTime).toBe(drainEvents[2].kind === "drain-quiet" ? drainEvents[2].time : -1);
  });

  it("the int-copy form declares s with the other declarations and assigns it after the pop", () => {
    const src = benchSource({ ...DEFAULT_CONFIG, compareOp: "int-copy" });
    const body = src.slice(src.findIndex((l) => l.key === "check-task") + 1, src.findIndex((l) => l.key === "check-cmp")).map((l) => l.text.trim());
    expect(body.slice(0, 2)).toEqual(["exp_t e;", "int s;"]);
    expect(body.findIndex((t) => t.startsWith("s = actual;"))).toBeGreaterThan(body.findIndex((t) => t.startsWith("e = exp_q.pop_front();")));
    expect(body.join("\n")).not.toMatch(/int s = /);
    // The same holds for the benches with no pop: every declaration comes before the first statement.
    (["single-expected", "live-model"] as const).forEach((checkStyle) => {
      const other = benchSource({ ...DEFAULT_CONFIG, checkStyle, compareOp: "int-copy" });
      const lines = other.slice(other.findIndex((l) => l.key === "check-task") + 1, other.findIndex((l) => l.key === "check-cmp")).map((l) => l.text.trim());
      expect(lines[1]).toBe("int s;");
      expect(lines[2]).toMatch(/^s = actual;/);
    });
  });
});

describe("debug clinic: broken benches reproduce the lesson's symptoms", () => {
  it("reset_dut() deleted: rst_n is x, every check is skipped, the raw counters are PASS=0 FAIL=0 and report() turns 14 leftovers into failures", () => {
    const run = runBench(clinicCase("no-reset").config);
    expect(run.rawPass).toBe(0);
    expect(run.rawFail).toBe(0);
    expect(errors(run)).toEqual([`[error @ ${run.endTime} ns] CHK 14 result(s) never arrived`]);
    expect(run.summary).toBe("PASS=0 FAIL=14");
    expect(run.log[0]).toEqual({ time: 0, kind: "test", text: "TEST smoke" });
    expect(run.signals.rst_n.every((v) => formatDec(v) === "x")).toBe(true);
    expect(edgeSteps(run).slice(2).every((s) => s.checker.kind === "guard-x")).toBe(true);
    // The DUT did answer: out_valid rose even though nobody checked.
    expect(run.signals.out_valid.some((v) => formatDec(v) === "1")).toBe(true);
  });

  it("!= with an x carry: corners passes every X result, PASS=7 FAIL=0, while !== fails all seven as sum=X", () => {
    const kase = clinicCase("neq");
    const run = runBench(kase.config);
    expect(run.summary).toBe("PASS=7 FAIL=0");
    expect(edgeSteps(run).filter((s) => s.checker.kind === "x-pass")).toHaveLength(7);
    expect(run.signals.sum.filter((v) => formatDec(v) === "X").length).toBeGreaterThan(0);
    const fixed = runBench({ ...kase.config, compareOp: "!==" });
    expect(fixed.summary).toBe("PASS=0 FAIL=7");
    expect(errors(fixed)[0]).toBe("[error @ 45 ns] CHK a=0 b=0: sum=X, expected 0");
  });

  it("a check made one edge early: sum=0 expected 3, sum=3 expected 30, sum=30 expected 127 (quiz)", () => {
    const run = runBench(clinicCase("early-check").config);
    expect(errors(run)).toEqual([
      "[error @ 35 ns] CHK a=1 b=2: sum=0, expected 3",
      "[error @ 55 ns] CHK a=10 b=20: sum=3, expected 30",
      "[error @ 75 ns] CHK a=100 b=27: sum=30, expected 127",
    ]);
    expect(run.summary).toBe("PASS=0 FAIL=3");
  });

  it("one expected variable overwritten by the next send(): each actual equals the previous expected, and the last result passes", () => {
    const run = runBench(clinicCase("single-expected").config);
    expect(errors(run)).toEqual(["[error @ 45 ns] CHK a=10 b=20: sum=3, expected 30", "[error @ 55 ns] CHK a=100 b=27: sum=30, expected 127"]);
    expect(run.summary).toBe("PASS=1 FAIL=2");
  });

  it("a missing final idle(): in_valid stays high, the DUT answers 127 again and again, and each extra result is unexpected until drain()'s quiet cycles run out", () => {
    const run = runBench(clinicCase("no-idle").config);
    expect(errors(run)).toEqual([
      "[error @ 75 ns] CHK unexpected result sum=127: nothing was sent",
      "[error @ 85 ns] CHK unexpected result sum=127: nothing was sent",
    ]);
    expect(run.summary).toBe("PASS=3 FAIL=2");
    // drain() finds the queue empty at 70 ns, watches 80 and 90 ns, and the run ends at 90 ns.
    expect(run.endTime).toBe(90);
    expect(run.signals.in_valid.slice(3).every((v) => formatDec(v) === "1")).toBe(true);
  });

  it("in the all-tests run the missing idle is invisible: corners' first send() follows at once, so no idle cycle exposes it", () => {
    expect(runBench({ ...clinicCase("no-idle").config, tests: ["smoke", "corners", "gaps"], testName: "all" }).summary).toBe("PASS=14 FAIL=0");
  });

  it("deleting the size() guard instead reaches pop_front on an empty queue: the default exp_t is x and the compare fails anyway (§7.10.2.4)", () => {
    const run = runBench({ ...clinicCase("no-idle").config, unexpectedGuard: false });
    // §7.10.2.4 only says the call may warn, so the line is this model's note, not a simulator's message.
    expect(logText(run)).toContain("(model @ 75 ns) a simulator may warn here: pop_front() on an empty queue returned the default exp_t (every logic member x) and left the queue unchanged (§7.10.2.4, Table 7-1)");
    expect(logText(run).some((l) => l.startsWith("[warning"))).toBe(false);
    expect(errors(run)[0]).toBe("[error @ 75 ns] CHK a=x b=x: sum=127, expected x");
  });

  it("every case names a culprit line that exists in its own source and diagnoses every other suspect", () => {
    CLINIC_CASES.forEach((kase) => {
      const src = benchSource(kase.config);
      const keys = suspectKeys(src, kase);
      expect(keys).toContain(kase.culprit);
      expect(keys.length).toBeGreaterThan(5);
      expect(diagnoseSuspect(kase, kase.culprit)).toEqual({ culprit: true, text: kase.found });
      keys
        .filter((k) => k !== kase.culprit && !kase.alsoCulprits?.includes(k))
        .forEach((k) => {
          const d = diagnoseSuspect(kase, k);
          expect(d.culprit).toBe(false);
          expect(d.text.length).toBeGreaterThan(20);
        });
      expect(kase.hints).toHaveLength(3);
      expect(kase.fixes.some((f) => f.reviewOk)).toBe(true);
    });
  });
});

describe("debug clinic: grading a fix reruns the bench", () => {
  const accepted = (caseId: Parameters<typeof clinicCase>[0], fixId: string) => {
    const kase = clinicCase(caseId);
    const fix = kase.fixes.find((f) => f.id === fixId);
    if (!fix) throw new Error(`missing fix ${fixId}`);
    return gradeFix(kase, fix);
  };

  it("a fix passes only when a correct DUT ends the case's own run PASS=<n> FAIL=0 and +TEST=corners still catches BUG=1", () => {
    const g = accepted("no-reset", "restore-reset");
    expect(g.clean).toBe(true);
    expect(g.cleanRun.summary).toBe("PASS=14 FAIL=0");
    expect(g.expectedPass).toBe(expectedResultCount(testsFor("all", false)));
    expect(g.bug1Caught).toBe(true);
    expect(g.bug1Run.summary).toBe("PASS=4 FAIL=3");
    expect(g.accepted).toBe(true);
    // The broken bench itself does not pass its own grading.
    const kase = clinicCase("no-reset");
    expect(gradeFix(kase, { id: "none", label: "no change", apply: (c) => c, reviewOk: true, review: "" }).clean).toBe(false);
  });

  it("initialising rst_n high or dropping the guard leaves a DUT nobody reset: $isunknown fails on the first edges", () => {
    const high = accepted("no-reset", "init-high");
    expect(high.clean).toBe(false);
    expect(high.accepted).toBe(false);
    expect(errors(high.cleanRun)[0]).toMatch(/CHK out_valid is x after reset/);
    expect(accepted("no-reset", "drop-guard").clean).toBe(false);
  });

  it("the X clinic also requires every X result to fail: !== and an assertion pass, a 2-state copy does not", () => {
    expect(accepted("neq", "case-neq").accepted).toBe(true);
    expect(accepted("neq", "assert").accepted).toBe(true);
    const copy = accepted("neq", "int-copy");
    expect(copy.clean).toBe(true);
    expect(copy.xCaught).toBe(false);
    // Only the three results whose carry should be 1 fail; the four whose x bit became 0 pass silently.
    expect(copy.xRun?.summary).toBe("PASS=4 FAIL=3");
    expect(copy.accepted).toBe(false);
  });

  it("a fix the model accepts can still fail code review: idle after every send hides the overwrite but changes the stimulus", () => {
    const g = accepted("single-expected", "idle-each");
    expect(g.modelOk).toBe(true);
    expect(g.accepted).toBe(false);
    expect(g.review).toMatch(/rejected in review/);
    expect(accepted("single-expected", "queue").accepted).toBe(true);
    expect(accepted("single-expected", "live-model").clean).toBe(false);
  });

  it("early check: the queue is accepted; comparing with the live signals or adding idle cycles still reads one edge early", () => {
    expect(accepted("early-check", "queue").accepted).toBe(true);
    expect(accepted("early-check", "live-sig").clean).toBe(false);
    expect(accepted("early-check", "idle-each").clean).toBe(false);
  });

  it("dead clock: only the initializer helps; a longer TIMEOUT or !clk still ends in the WDOG fatal", () => {
    expect(accepted("clk-x", "init-zero").accepted).toBe(true);
    const slow = accepted("clk-x", "timeout");
    expect(slow.clean).toBe(false);
    expect(slow.cleanRun.endReason).toBe("fatal");
    expect(slow.cleanRun.endTime).toBe(100_000);
    expect(accepted("clk-x", "not-op").clean).toBe(false);
  });

  it("missing idle: restoring idle(1) is accepted; dropping the guard still fails; a drain() that drives in_valid cancels the last send()", () => {
    expect(accepted("no-idle", "restore-idle").accepted).toBe(true);
    const guard = accepted("no-idle", "drop-guard");
    expect(guard.clean).toBe(false);
    expect(errors(guard.cleanRun)[0]).toMatch(/expected x/);
    const hack = accepted("no-idle", "drain-idle");
    expect(hack.clean).toBe(false);
    expect(hack.cleanRun.summary).toBe("PASS=2 FAIL=1");
    expect(errors(hack.cleanRun)).toEqual([`[error @ ${hack.cleanRun.endTime} ns] CHK 1 result(s) never arrived`]);
    expect(hack.accepted).toBe(false);
  });

  it("BUG=1 is caught only by a check failure the mutant caused: a hung run is 'never exercised', whatever its counters say", () => {
    (["timeout", "not-op"] as const).forEach((fixId) => {
      const g = accepted("clk-x", fixId);
      expect(g.bug1Run.summary).toBe("PASS=0 FAIL=1");
      expect(g.bug1Caught).toBe(false);
      expect(g.bug1Outcome).toBe("hung");
      expect(g.bug1Text).toBe("run hung, BUG=1 never exercised");
    });
  });

  it("BUG=1 caught by a run that never ends is reported as caught, with what stops the run ending", () => {
    const stop = accepted("no-finish", "stop");
    expect(stop.bug1Run.summary).toBe("PASS=4 FAIL=3");
    expect(stop.bug1Caught).toBe(true);
    expect(stop.bug1Outcome).toBe("caught-no-end");
    expect(stop.bug1Text).toBe("caught, but $stop leaves the run suspended");
    const wdog = accepted("no-finish", "rely-wdog");
    expect(wdog.bug1Run.summary).toBe("PASS=4 FAIL=3");
    expect(wdog.bug1Run.ended).toBe(false);
    expect(wdog.bug1Caught).toBe(true);
    expect(wdog.bug1Outcome).toBe("caught-no-end");
    expect(wdog.bug1Text).toBe("caught, but the run never ends");
    expect(accepted("no-finish", "finish").bug1Outcome).toBe("caught");
  });

  it("a bench that fails the correct DUT just as often has not caught BUG=1", () => {
    [accepted("early-check", "live-sig"), accepted("single-expected", "live-model")].forEach((g) => {
      expect(g.bug1Run.summary).toBe("PASS=2 FAIL=5");
      expect(g.bug1Baseline.summary).toBe("PASS=2 FAIL=5");
      expect(g.bug1Caught).toBe(false);
      expect(g.bug1Outcome).toBe("escaped");
      expect(g.bug1Text).toBe("not caught: the correct DUT fails just as often (PASS=2 FAIL=5)");
    });
    // A bench that fails the correct DUT less often than BUG=1 still shows the mutant's own failures.
    const high = accepted("no-reset", "init-high");
    expect(high.bug1Baseline.summary).toBe("PASS=7 FAIL=2");
    expect(high.bug1Run.summary).toBe("PASS=4 FAIL=5");
    expect(high.bug1Outcome).toBe("caught");
    expect(high.clean).toBe(false);
  });

  it("every case's run label names plusargs only, with no DUT", () => {
    CLINIC_CASES.forEach((k) => expect(k.runArgs).toMatch(/^(no plusargs \(all tests\)|\+TEST=\w+)$/));
    expect(clinicCase("neq").runArgs).toBe("+TEST=corners");
  });

  it("in the dead-clock case main never reaches the run or report lines, and the diagnosis says so", () => {
    const kase = clinicCase("clk-x");
    expect(diagnoseSuspect(kase, "main-run-all").text).toMatch(/never reached this line/);
    expect(diagnoseSuspect(kase, "main-report").text).toMatch(/watchdog's own report\(\) call/);
  });

  it("clk-x: every suspect that ran or waits has its own diagnosis, and the rest say they never ran, because no posedge ever came", () => {
    const kase = clinicCase("clk-x");
    const run = runBench(kase.config);
    expect(kase.found).toMatch(/logic clk; starts at x \(§6\.8, Table 6-7\)/);
    expect(kase.found).toMatch(/~x is x \(§11\.4\.8\)/);
    expect(kase.found).toMatch(/no posedge is ever detected \(Table 9-2\)/);
    expect(kase.found).toMatch(/\$fatal \(§20\.10\)/);
    const ranThere = new Set(["dut-inst", "report"]);
    suspectKeys(benchSource(kase.config), kase)
      .filter((k) => k !== kase.culprit && !kase.wrong[k])
      .forEach((key) => {
        const text = diagnoseSuspect(kase, key).text;
        expect(lineRan(run, key), key).toBe(ranThere.has(key));
        if (ranThere.has(key)) expect(text, key).toMatch(/behaves as written/);
        else {
          expect(text, key).toMatch(/This line never ran in this run/);
          expect(text, key).not.toMatch(/behaves as written/);
        }
      });
    expect(diagnoseSuspect(kase, "chk-always").text).toMatch(/no rising edge ever comes/);
    expect(diagnoseSuspect(kase, "run-one").text).toMatch(/never ran/);
    expect(diagnoseSuspect(kase, "main-finish").text).toMatch(/never ran/);
  });

  it("no-reset: the lines behind the x guard say they never ran", () => {
    const kase = clinicCase("no-reset");
    (["check-pop", "check-cmp", "chk-isunknown", "chk-outvalid"] as const).forEach((key) => expect(diagnoseSuspect(kase, key).text, key).toMatch(/This line never ran in this run/));
    expect(diagnoseSuspect(kase, "test-smoke").text).toMatch(/behaves as written/);
  });

  it("whether a line ran is read from the run itself", () => {
    const ran = (id: Parameters<typeof clinicCase>[0], key: string) => lineRan(runBench(clinicCase(id).config), key);
    expect(ran("no-finish", "check-cmp")).toBe(true);
    expect(ran("no-finish", "main-report")).toBe(true);
    expect(ran("no-idle", "idle")).toBe(false);
    expect(ran("no-idle", "check-pop")).toBe(true);
    expect(ran("no-idle", "test-smoke-2")).toBe(true);
    expect(ran("no-idle", "test-gaps")).toBe(false);
    expect(ran("no-reset", "reset-task")).toBe(false);
    expect(ran("early-check", "send-check")).toBe(true);
    expect(ran("neq", "main-finish")).toBe(true);
    expect(ran("clk-x", "report")).toBe(true);
    expect(ran("clk-x", "main-report")).toBe(false);
  });

  it("a test +TEST= did not select is called that, not a line the run failed to reach", () => {
    const text = diagnoseSuspect(clinicCase("no-idle"), "test-gaps").text;
    expect(text).toMatch(/\+TEST=smoke does not select this test/);
    expect(text).not.toMatch(/what kept the run/);
    expect(diagnoseSuspect(clinicCase("clk-x"), "test-gaps").text).toMatch(/what kept the run from reaching it/);
  });

  it("drain()'s facts hold in the bench on screen: no checker in early-check, an x guard in no-reset", () => {
    CLINIC_CASES.forEach((kase) => {
      const text = diagnoseSuspect(kase, "drain").text;
      if (kase.id !== "neq") expect(text, kase.id).not.toMatch(/late or extra result/);
    });
    const early = diagnoseSuspect(clinicCase("early-check"), "drain").text;
    expect(early).toMatch(/nothing is pushed onto exp_q/);
    expect(early).toMatch(/first falling edge/);
    const earlyRun = runBench(clinicCase("early-check").config);
    const firstDrain = earlyRun.steps.flatMap((s) => s.events).find((e) => e.kind === "drain-check");
    expect(firstDrain).toMatchObject({ empty: true });
    expect(earlyRun.log.filter((l) => l.kind === "error").every((l) => l.time < (firstDrain as { time: number }).time)).toBe(true);
    const noReset = diagnoseSuspect(clinicCase("no-reset"), "drain").text;
    expect(noReset).toMatch(/20-cycle bound/);
    expect(noReset).toMatch(/410 ns/);
    expect(runBench(clinicCase("no-reset").config).endTime).toBe(410);
    expect(LINE_FACTS.drain).toMatch(/late or extra result still fails/);
  });

  it("no diagnosis claims a log line the run did not print", () => {
    expect(LINE_FACTS["model-add"]).not.toMatch(/log/);
    CLINIC_CASES.forEach((kase) => {
      const run = runBench(kase.config);
      suspectKeys(benchSource(kase.config), kase).forEach((key) => {
        const text = diagnoseSuspect(kase, key).text;
        if (/errors in the log/.test(text)) expect(run.log.some((l) => l.kind === "error"), `${kase.id} ${key}`).toBe(true);
        if (/TEST lines/.test(text)) expect(run.log.some((l) => l.kind === "test"), `${kase.id} ${key}`).toBe(true);
        expect(text, `${kase.id} ${key}`).not.toMatch(/log shows the expected/);
      });
    });
  });

  it("no-finish: main has run to its end; what goes on is the simulation (§9.2.1, §9.6.1)", () => {
    const kase = clinicCase("no-finish");
    const texts = [kase.found, ...kase.hints, ...suspectKeys(benchSource(kase.config), kase).map((k) => diagnoseSuspect(kase, k).text)];
    texts.forEach((t) => expect(t).not.toMatch(/main is what never ends|main never ends/));
    expect(diagnoseSuspect(kase, "drain").text).toMatch(/main has no statements left; the simulation goes on because the clock is still active \(§9\.6\.1\)/);
  });

  it("the dead clock's !clk fix is rejected for a reason the expression model agrees with: !x is x (§11.4.7)", () => {
    expect(logicalNot(bits("x"))).toBe("x");
    expect(clinicCase("clk-x").fixes.find((f) => f.id === "not-op")?.review).toMatch(/!x is also x \(§11\.4\.7\)/);
  });

  it("early-check does not overstate its first error: sum=0 at 35 ns is R1's reset value, not an earlier transaction's result", () => {
    const kase = clinicCase("early-check");
    expect(kase.found).toMatch(/R1's 0 on the first check, and the previous transaction's result on every check after it/);
    expect(kase.hints[0]).toMatch(/^After the first check, each actual/);
    expect(kase.wrong["dut-inst"]).toMatch(/after the reset value 0 on the first check/);
    expect(errors(runBench(kase.config))[0]).toMatch(/@ 35 ns\] CHK a=1 b=2: sum=0, expected 3/);
  });

  it("every stimulus line takes a suspect control in every case, so a control beside a deleted statement says nothing; no-idle accepts the last send", () => {
    CLINIC_CASES.forEach((kase) => {
      const src = benchSource(kase.config);
      const stim = src.map((l) => l.key).filter((k): k is string => Boolean(k && /^test-\w+-\d+$/.test(k)));
      expect(stim.length).toBeGreaterThan(0);
      const keys = suspectKeys(src, kase);
      stim.forEach((k) => expect(keys).toContain(k));
    });
    const noIdle = clinicCase("no-idle");
    expect(diagnoseSuspect(noIdle, "test-smoke-2")).toEqual({ culprit: true, text: noIdle.found });
    expect(benchSource(noIdle.config).find((l) => l.key === "test-smoke-2")?.text.trim()).toBe("send(8'd100, 8'd27);");
    expect(diagnoseSuspect(noIdle, "test-smoke-0")).toMatchObject({ culprit: false });
    expect(diagnoseSuspect(noIdle, "test-smoke-0").text).toMatch(/one stimulus step of test_smoke\(\)/);
    expect(diagnoseSuspect(noIdle, "idle").text).toMatch(/nothing in this run calls it/);
    expect(lineRan(runBench(noIdle.config), "idle")).toBe(false);
  });

  it("every wrong suspect's diagnosis is true of the bench on screen: the single-expected case has no pop_front, no queue to drain and no leftovers", () => {
    const kase = clinicCase("single-expected");
    (["check-pop", "drain", "report"] as const).forEach((key) => {
      const text = diagnoseSuspect(kase, key).text;
      expect(text).not.toMatch(/pop_front/);
      expect(text).not.toMatch(/until exp_q is empty/);
      expect(text).not.toMatch(/adds leftovers/);
    });
  });

  it("missing $finish: $finish is accepted; $stop suspends; relying on the dead watchdog never ends", () => {
    expect(accepted("no-finish", "finish").accepted).toBe(true);
    const stop = accepted("no-finish", "stop");
    expect(stop.clean).toBe(false);
    expect(stop.cleanRun.endReason).toBe("stop");
    expect(accepted("no-finish", "rely-wdog").cleanRun.endReason).toBe("horizon");
  });
});

describe("learner-facing wording", () => {
  const everyConfig = [
    ...PRESETS.flatMap((p) => [...MATRIX_MUTANTS, 0 as MutantId].flatMap((m) => [presetConfig(p, m), presetConfig(p, m, true)])),
    ...CLINIC_CASES.flatMap((k) => [k.config, ...k.fixes.map((f) => f.apply(k.config))]),
  ];
  const everyRun = everyConfig.map((c) => runBench(c));

  it("§9.6.1 is not taught as a universal rule: the clause also ends a simulation when all program blocks finish", () => {
    const horizon = runBench(clinicCase("no-finish").config).steps.find((s) => s.kind === "horizon");
    expect(horizon?.why).toMatch(/ends by itself when no activity of any kind remains \(§9\.6\.1; this bench has no program blocks/);
    expect(clinicCase("no-finish").found).toMatch(/this bench has no program blocks/);
    const texts = [
      ...everyRun.flatMap((r) => r.steps.flatMap((st) => [st.what, st.why])),
      ...CLINIC_CASES.flatMap((k) => [k.symptom, k.found, ...k.hints, ...Object.values(k.wrong).map(String), ...k.fixes.flatMap((f) => [f.label, f.review])]),
      ...Object.values(LINE_FACTS),
    ];
    texts.forEach((t) => expect(t).not.toMatch(/only when no activity/));
  });

  it("every narrated DUT sentence reads as a sentence: 'The DUT' is followed by a verb, on reset edges too", () => {
    everyRun.forEach((r) => edgeSteps(r).forEach((st) => expect(st.dutNote).toMatch(/^(sees|samples) /)));
    expect(stepAt(runBench(presetConfig("gaps", 0)), 0).what).toMatch(/The DUT sees rst_n = 0: R1 clears out_valid and sum\./);
    expect(stepAt(runBench(presetConfig("gaps", "extra-stage")), 1).what).toMatch(/The DUT sees rst_n = 0: R1 clears out_valid, sum and the extra stage/);
  });

  it("testsRule names the tests after the first one", () => {
    expect(testsRule(testsFor("smoke", false))).toBe("R3 for ordinary values");
    expect(testsRule(testsFor("all", false))).toBe("R3 for ordinary values, then corners and gaps");
    expect(testsRule(testsFor("all", true))).toBe("R3 for ordinary values, then corners, gaps and hold");
    expect(testsRule(["smoke", "gaps"])).toBe("R3 for ordinary values, then gaps");
  });

  it("the plan's columns are BUG=1 and BUG=2, both in the full matrix", () => {
    expect(PLAN_MUTANTS).toEqual([1, 2]);
    PLAN_MUTANTS.forEach((m) => expect(MATRIX_MUTANTS).toContain(m));
  });
});

describe("prediction gates", () => {
  const edgeKeyOf = (mutant: MutantId, hold = false, preset: "smoke" | "gaps" | "all" = "gaps") => predictionKey(edgePrediction(runBench(presetConfig(preset, mutant, hold))));
  const queueKeyOf = (mutant: MutantId, hold = false, preset: "smoke" | "gaps" | "all" = "gaps") => predictionKey(queuePrediction(runBench(presetConfig(preset, mutant, hold))));

  it("a DUT or hold change that moves no result keeps both keys", () => {
    const base = [edgeKeyOf(0), queueKeyOf(0)];
    ([1, 2, 3, "swap-ab"] as MutantId[]).forEach((m) => {
      expect([edgeKeyOf(m), queueKeyOf(m)]).toEqual(base);
      expect([edgeKeyOf(m, true), queueKeyOf(m, true)]).toEqual(base);
    });
    expect(edgeKeyOf(0, true, "all")).toBe(edgeKeyOf(0, false, "all"));
  });

  it("a new test or the extra stage changes the key, because the question or the answer changes", () => {
    expect(edgeKeyOf(0, false, "smoke")).not.toBe(edgeKeyOf(0));
    expect(queueKeyOf(0, false, "smoke")).not.toBe(queueKeyOf(0));
    expect(edgeKeyOf("extra-stage")).not.toBe(edgeKeyOf(0));
    expect(queueKeyOf("extra-stage", false, "smoke")).not.toBe(queueKeyOf(0, false, "smoke"));
    // gaps holds {15, 19} after edge 6 with or without the extra stage: same question, same answer, same key.
    expect(queueKeyOf("extra-stage")).toBe(queueKeyOf(0));
  });

  it("only a null spec has an empty key", () => {
    expect(predictionKey(null)).toBe("");
    expect(edgeKeyOf(0)).not.toBe("");
  });

  it("BUG=1, 2, 3 and swap-ab keep every option's id and label across a key", () => {
    const labels = (m: MutantId) => queuePrediction(runBench(presetConfig("gaps", m)))?.options.map((o) => [o.id, o.label]);
    ([1, 2, 3, "swap-ab"] as MutantId[]).forEach((m) => expect(labels(m)).toEqual(labels(0)));
    const edgeLabels = (m: MutantId) => edgePrediction(runBench(presetConfig("gaps", m)))?.options.map((o) => [o.id, o.label]);
    ([1, 2, 3, "swap-ab"] as MutantId[]).forEach((m) => expect(edgeLabels(m)).toEqual(edgeLabels(0)));
  });

  it("the extra stage keeps the queue key on gaps but can drop a distractor: {19} collapses onto the answer, so the view keeps what the learner committed", () => {
    const options = (m: MutantId) => queuePrediction(runBench(presetConfig("gaps", m)))?.options.map((o) => o.label);
    expect(queueKeyOf("extra-stage")).toBe(queueKeyOf(0));
    expect(options(0)).toContain("{19}");
    expect(options("extra-stage")).not.toContain("{19}");
    expect(options("extra-stage")).toContain("{15, 19}");
  });
});

describe("the hold-check question in matrix mode", () => {
  it("comes from the runs: exactly one answer is right, +TEST=hold only", () => {
    const q = holdCheckPrediction();
    expect(q.question).toBe("With the hold check on, which rows catch BUG=3?");
    expect(q.options.map((o) => o.id)).toEqual(["none", "hold", "gaps-hold", "every"]);
    expect(q.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["hold"]);
    expect(q.options.find((o) => o.id === "hold")?.catchers).toEqual(["hold"]);
    expect(q.options.find((o) => o.correct)?.feedback).toMatch(/PASS=1 FAIL=3/);
    expect(q.options.find((o) => o.id === "gaps-hold")?.feedback).toMatch(/idle\(\) leaves a and b as they were/);
    expect(q.options.find((o) => o.id === "gaps-hold")?.feedback).toMatch(/PASS=4 FAIL=0/);
  });

  it("the hold check changes one cell only, so predictions for the others still apply", () => {
    const off = buildMatrix(false);
    const on = buildMatrix(true);
    const changed: string[] = [];
    ALL_TEST_IDS.forEach((t) => MATRIX_MUTANTS.forEach((m) => {
      if (off.cells[t][columnId(m)].state !== on.cells[t][columnId(m)].state) changed.push(`${t}:${columnId(m)}`);
    }));
    expect(changed).toEqual(["hold:bug3"]);
  });
});

describe("the clinic's fix step is a real decision", () => {
  const accepted = (k: (typeof CLINIC_CASES)[number]) => k.fixes.map((f, i) => (gradeFix(k, f).accepted ? i : -1)).filter((i) => i >= 0);

  it("the accepted fix's position varies: neither 'pick the first' nor 'pick the last' solves more than half the cases", () => {
    const first = CLINIC_CASES.filter((k) => accepted(k).includes(0));
    const last = CLINIC_CASES.filter((k) => accepted(k).includes(k.fixes.length - 1));
    expect(first.length).toBeLessThanOrEqual(CLINIC_CASES.length / 2);
    expect(last.length).toBeLessThanOrEqual(CLINIC_CASES.length / 2);
    expect(new Set(CLINIC_CASES.map((k) => accepted(k)[0])).size).toBeGreaterThan(1);
    CLINIC_CASES.forEach((k) => expect(accepted(k).length).toBeGreaterThan(0));
  });

  it("'found' states the cause and leaves the remedy to the accepted fix's review", () => {
    const remedies: Record<string, RegExp> = {
      "no-reset": /reset_dut\(\)/,
      neq: /!==/,
      "early-check": /queue/i,
      "single-expected": /queue|push_back|pop_front/i,
      "clk-x": /initiali[sz]|1'b0/i,
      "no-idle": /idle\(/,
      "no-finish": /\$finish/,
    };
    CLINIC_CASES.forEach((k) => {
      expect(k.found).not.toMatch(remedies[k.id]);
      k.fixes.filter((f) => f.reviewOk).forEach((f) => expect(k.found).not.toContain(f.label));
    });
    // The sentences moved, not lost.
    const review = (id: Parameters<typeof clinicCase>[0], fixId: string) => clinicCase(id).fixes.find((f) => f.id === fixId)?.review;
    expect(review("neq", "case-neq")).toMatch(/always returns 0 or 1/);
    expect(review("early-check", "queue")).toMatch(/Matching results on out_valid with a queue never counts edges/);
    expect(review("single-expected", "queue")).toMatch(/push_back per send and pop_front per result/);
    expect(review("no-idle", "restore-idle")).toMatch(/idle\(1\) drives in_valid back to 0/);
    expect(review("no-finish", "finish")).toMatch(/\$finish exits the simulator/);
  });

  it("the live-model review matches its rerun: the last result passes, the others fail", () => {
    const kase = clinicCase("single-expected");
    const fix = kase.fixes.find((f) => f.id === "live-model");
    if (!fix) throw new Error("missing fix");
    const grade = gradeFix(kase, fix);
    expect(grade.cleanRun.summary).toBe("PASS=1 FAIL=2");
    expect(fix.review).toMatch(/only the last result, with nothing sent after it, matches/);
    expect(fix.review).not.toMatch(/each result/);
  });
});
