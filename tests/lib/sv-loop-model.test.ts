import { describe, expect, it } from "vitest";

import { parseBits } from "@/lib/sv-four-state-model";
import {
  BOUND_MAX,
  BOUND_MIN,
  DEFAULT_INPUTS,
  FOREACH_RANGES,
  FOREVER_TRACE_PASSES,
  INT_INPUT_MAX,
  INT_INPUT_MIN,
  LOOP_ASSUMPTIONS,
  LOOP_PRESETS,
  MISCONCEPTION_FEEDBACK,
  PASS_DEFINITION,
  PREDICTION_QUESTION,
  PROGRAM_MISCONCEPTIONS,
  TOOL_CHOICE,
  ZERO_DELAY_BUDGET,
  buildProgram,
  clampInt,
  countValue,
  describeCount,
  foreachOrder,
  inputKey,
  lessThan,
  misconceptionFeedback,
  parseCountBits,
  predictionOptions,
  presetById,
  presetInputs,
  repeatCount,
  runLoop,
  summarizeRun,
  testPlacementText,
  type LoopInputs,
  type LoopProgramId,
} from "@/lib/sv-loop-model";

const inputs = (over: Partial<LoopInputs>): LoopInputs => ({ ...DEFAULT_INPUTS, ...over });
const presetRun = (id: Parameters<typeof presetById>[0]) => {
  const p = presetById(id);
  return runLoop(p.program, presetInputs(p));
};

describe("sv-loop-model · for (§12.7.1) with continue and break (§12.8)", () => {
  it("§12.7.1 + §12.8: the lesson's loop makes 4 passes, prints i = 0 and i = 2, and break leaves i at 3", () => {
    const run = presetRun("for-continue-break");
    expect(run.passes).toBe(4);
    expect(run.output).toEqual(["i = 0", "i = 2"]);
    expect(run.outcome).toEqual({ kind: "exited", via: "break" });
    expect(run.steps.at(-1)?.vars.find((v) => v.name === "i")?.value).toBe("3");
    expect(run.verdict).toMatch(/i is still 3/);
  });

  it("§12.7.1: the initialization runs once, then the test comes before the first body step", () => {
    const run = presetRun("for-continue-break");
    expect(run.steps.filter((s) => s.box === "init")).toHaveLength(1);
    expect(run.steps.map((s) => s.box).slice(0, 3)).toEqual(["init", "test", "body"]);
  });

  it("§12.8: continue jumps to the step, so i++ runs right after the continue", () => {
    const run = presetRun("for-continue-break");
    const at = run.steps.findIndex((s) => s.jump === "continue");
    expect(run.steps[at + 1].box).toBe("step");
    expect(run.steps[at + 1].vars.find((v) => v.name === "i")).toMatchObject({ value: "2", changed: true });
  });

  it("§12.8: break goes straight to the exit, with no step after it", () => {
    const run = presetRun("for-continue-break");
    const at = run.steps.findIndex((s) => s.jump === "break");
    expect(run.steps[at + 1].box).toBe("exit");
  });

  it("§12.7.1: at every bound, each pass starts right after a test, and every step goes on to a test or the exit", () => {
    for (let b = BOUND_MIN; b <= BOUND_MAX; b += 1) {
      const steps = runLoop("for-jumps", inputs({ bound: b })).steps;
      steps.forEach((s, i) => {
        if (i > 0 && s.passes > steps[i - 1].passes) expect(steps[i - 1].box, `bound ${b} step ${i}`).toBe("test");
        if (s.box === "step") expect(["test", "exit"], `bound ${b} step ${i}`).toContain(steps[i + 1]?.box);
      });
    }
  });

  it("§12.4: the if checks in the body cite the if statement, not the for-loop clause", () => {
    const forChecks = presetRun("for-continue-break").steps.filter((st) => /i == [13] is false/.test(st.what));
    const foreachChecks = presetRun("foreach-visit-order").steps.filter((st) => /is false\.$/.test(st.what));
    expect(forChecks.length).toBeGreaterThan(0);
    expect(foreachChecks.length).toBeGreaterThan(0);
    for (const s of [...forChecks, ...foreachChecks]) expect(s.clause).toBe("§12.4");
  });

  it("§12.7.1: with i < 0 the test is false at once and the body never runs", () => {
    const run = runLoop("for-jumps", inputs({ bound: 0 }));
    expect(run.passes).toBe(0);
    expect(run.output).toEqual([]);
  });

  it("§12.7.1: every bound the lab offers ends inside the zero-delay budget", () => {
    for (let b = BOUND_MIN; b <= BOUND_MAX; b += 1) {
      const run = runLoop("for-jumps", inputs({ bound: b }));
      expect(run.outcome.kind).toBe("exited");
      expect(run.passes).toBe(Math.min(b, 4));
    }
  });
});

describe("sv-loop-model · repeat (§12.7.2)", () => {
  it("§12.7.2: an x count is treated as zero, so no pass runs and count stays 0", () => {
    const run = presetRun("repeat-x");
    expect(run.passes).toBe(0);
    expect(run.output).toEqual(["count = 0"]);
    expect(repeatCount(countValue(inputs({ countBits: "xxxx" })))).toEqual({ count: 0, reason: "unknown" });
  });

  it("§12.7.2: a count with any x bit reads as unknown, and one with z bits but no x as high impedance", () => {
    expect(repeatCount(countValue(inputs({ countBits: "0x1z" })))).toEqual({ count: 0, reason: "unknown" });
    expect(repeatCount(countValue(inputs({ countBits: "zzzz" })))).toEqual({ count: 0, reason: "high-impedance" });
    expect(repeatCount(countValue(inputs({ countBits: "z1z1" })))).toEqual({ count: 0, reason: "high-impedance" });
  });

  it("describes the count the way the verdicts word it", () => {
    expect(describeCount(countValue(inputs({ countType: "int", countInt: -1 })))).toBe("n is -1");
    expect(describeCount(countValue(inputs({ countBits: "1101" })))).toBe("n is 4'b1101, which is 13 as an unsigned value");
    expect(describeCount(countValue(inputs({ countType: "logic4s", countBits: "1101" })))).toBe("n is 4'b1101, which is -3 as a signed value");
    expect(describeCount(countValue(inputs({ countBits: "0x1z" })))).toBe("n is 4'b0x1z, which has an unknown (x) bit");
    expect(describeCount(countValue(inputs({ countBits: "zz01" })))).toBe("n is 4'bzz01, which has a high-impedance (z) bit");
  });

  it("§12.7.2: a z count is treated as zero", () => {
    expect(repeatCount(countValue(inputs({ countBits: "zz01" })))).toEqual({ count: 0, reason: "high-impedance" });
    expect(runLoop("repeat-count", inputs({ countBits: "zz01" })).passes).toBe(0);
  });

  it("§12.7.2: a negative int count (-1) is treated as zero", () => {
    const run = presetRun("repeat-negative-int");
    expect(run.passes).toBe(0);
    expect(repeatCount(countValue(inputs({ countType: "int", countInt: -1 })))).toEqual({ count: 0, reason: "negative" });
  });

  it("§12.7.2 + §6.11: 4'b1101 is 13 passes as logic [3:0] and zero as logic signed [3:0] (-3)", () => {
    expect(presetRun("repeat-1101").passes).toBe(13);
    expect(presetRun("repeat-1101").output).toEqual(["count = 13"]);
    const signed = runLoop("repeat-count", inputs({ countType: "logic4s", countBits: "1101" }));
    expect(signed.passes).toBe(0);
    expect(signed.verdict).toMatch(/-3/);
  });

  it("§12.7.2: the count is evaluated once, so n++ inside the loop has no effect", () => {
    const run = presetRun("repeat-change-n");
    expect(run.passes).toBe(3);
    expect(run.output).toEqual(["n = 3", "n = 4", "n = 5"]);
    expect(run.steps.filter((s) => s.box === "init")).toHaveLength(1);
  });

  it("§12.7.2: every count the lab offers ends inside the zero-delay budget", () => {
    for (let v = INT_INPUT_MIN; v <= INT_INPUT_MAX; v += 1) {
      expect(runLoop("repeat-count", inputs({ countType: "int", countInt: v })).passes).toBe(Math.max(0, v));
      expect(runLoop("repeat-change", inputs({ countInt: v })).passes).toBe(Math.max(0, v));
    }
    for (let v = 0; v < 16; v += 1) {
      const bits = v.toString(2).padStart(4, "0");
      expect(runLoop("repeat-count", inputs({ countType: "logic4", countBits: bits })).passes).toBe(v);
      expect(runLoop("repeat-count", inputs({ countType: "logic4s", countBits: bits })).passes).toBe(v < 8 ? v : 0);
    }
  });
});

describe("sv-loop-model · while (§12.7.4) and do...while (§12.7.5)", () => {
  it("§12.7.4: while (0) runs zero passes", () => {
    const run = presetRun("while-zero");
    expect(run.passes).toBe(0);
    expect(run.output).toEqual([]);
    expect(run.steps[0].box).toBe("test");
  });

  it("§12.7.5: do...while (0) runs exactly one pass, and the test comes after the body", () => {
    const run = presetRun("do-while-zero");
    expect(run.passes).toBe(1);
    expect(run.output).toEqual(["pass, c = 0"]);
    expect(run.steps[0].box).toBe("body");
    expect(run.steps.filter((s) => s.box === "test")).toHaveLength(1);
  });

  it("§12.7.4 + §12.4: an x or z while condition is false, so no pass runs", () => {
    for (const cond of ["x", "z"] as const) {
      const run = runLoop("while", inputs({ cond }));
      expect(run.passes).toBe(0);
      expect(run.verdict).toMatch(/§12\.4/);
    }
  });

  it("§12.7.4: while (c) with c = 1 runs once, because the body clears c", () => {
    expect(runLoop("while", inputs({ cond: "1" }))).toMatchObject({ passes: 1, output: ["pass, c = 1"] });
  });

  it("the wrong-rule runs for while and do...while compute what that rule really gives", () => {
    expect(runLoop("while", inputs({ cond: "0" }), { misconception: "while-runs-once" })).toMatchObject({ passes: 1, output: ["pass, c = 0"] });
    expect(runLoop("do-while", inputs({ cond: "0" }), { misconception: "do-tests-first" })).toMatchObject({ passes: 0, output: [] });
    expect(runLoop("while", inputs({ cond: "1" }), { misconception: "condition-read-once" }).outcome.kind).toBe("zero-delay");
    const label = (id: LoopProgramId, ins: LoopInputs, m: Parameters<typeof misconceptionFeedback>[0]) => summarizeRun(runLoop(id, ins, { misconception: m }));
    const whileZero = presetInputs(presetById("while-zero"));
    expect(predictionOptions("while", whileZero).find((o) => o.id === "while-runs-once")?.label).toBe(label("while", whileZero, "while-runs-once"));
    const doZero = presetInputs(presetById("do-while-zero"));
    expect(predictionOptions("do-while", doZero).find((o) => o.id === "do-tests-first")?.label).toBe(label("do-while", doZero, "do-tests-first"));
    expect(predictionOptions("while", inputs({ cond: "1" })).find((o) => o.id === "condition-read-once")?.label).toBe("Never ends, and time stays at t = 0");
  });

  it("§12.7.4 + §12.4: for an x or z while condition the x-is-true answer is offered, with the while clause", () => {
    for (const cond of ["x", "z"] as const) {
      const opt = predictionOptions("while", inputs({ cond })).find((o) => o.id === "x-is-true");
      expect(opt?.label).toBe(`1 pass, then the loop ends; prints “pass, c = ${cond}”`);
      expect(opt?.feedback).toMatch(/\(§12\.4, §12\.7\.4\)/);
    }
    expect(misconceptionFeedback("x-is-true", "for-x", DEFAULT_INPUTS)).toMatch(/\(§12\.4, §12\.7\.1\)/);
  });

  it("§12.7.5: do...while exits when its test is false, x or z, like while", () => {
    const p = buildProgram("do-while", DEFAULT_INPUTS);
    expect(p.edges.exitFrom).toEqual(["the test, when c is false, x or z"]);
    expect(p.boxes.find((b) => b.id === "test")?.next).toMatch(/False, x or z: leave the loop/);
  });

  it("§12.7.5: the do...while program offers only 0 and 1, and maps any other value to 0", () => {
    expect(buildProgram("do-while", DEFAULT_INPUTS).condChoices).toEqual(["0", "1"]);
    expect(runLoop("do-while", inputs({ cond: "x" })).output).toEqual(["pass, c = 0"]);
  });
});

describe("sv-loop-model · for with an x condition (§12.7.1, §11.4.4)", () => {
  it("§11.4.4: a relational operator with an x or z operand bit yields 1'bx", () => {
    const i = { bits: parseBits("0000"), signed: true };
    expect(lessThan(i, { bits: parseBits("xxxx"), signed: false })).toBe("x");
    expect(lessThan(i, { bits: parseBits("00z1"), signed: false })).toBe("x");
  });

  it("§11.4.4: unsigned if either operand is unsigned, signed if both are signed", () => {
    const minusOne = { bits: parseBits("1111"), signed: true };
    const one = { bits: parseBits("0001"), signed: true };
    expect(lessThan(minusOne, one)).toBe("1");
    expect(lessThan(minusOne, { ...one, signed: false })).toBe("0");
  });

  it("§12.7.1: i < n with n = 4'bxxxx is unknown, treated as zero, so the loop exits before the first pass", () => {
    const run = presetRun("for-x-condition");
    expect(run.passes).toBe(0);
    expect(run.output).toEqual(["count = 0"]);
    expect(run.steps.find((s) => s.box === "test")?.what).toMatch(/1'bx/);
  });

  it("§12.7.1: with known n the loop counts to n; a negative signed n gives zero", () => {
    expect(runLoop("for-x", inputs({ countType: "logic4", countBits: "1101" })).passes).toBe(13);
    expect(runLoop("for-x", inputs({ countType: "logic4s", countBits: "1101" })).passes).toBe(0);
    expect(runLoop("for-x", inputs({ countType: "int", countInt: 4 })).passes).toBe(4);
  });

  it("§11.4.4: the for-x test says whether i < n is compared signed or unsigned", () => {
    const testText = (over: Partial<LoopInputs>) => runLoop("for-x", inputs(over)).steps.find((s) => s.box === "test")?.what ?? "";
    expect(testText({ countType: "logic4", countBits: "1101" })).toMatch(/an unsigned comparison, because n is unsigned/);
    expect(testText({ countType: "logic4s", countBits: "1101" })).toMatch(/a signed comparison, because i and n are both signed; n is sign-extended to 32 bits/);
    expect(testText({ countType: "int", countInt: 4 })).toMatch(/a signed comparison, because i and n are both signed\)/);
  });

  it("§12.7.1: every input the lab offers ends inside the zero-delay budget", () => {
    for (const countType of ["logic4", "logic4s"] as const) {
      for (const b of ["0", "1", "x", "z"]) {
        for (let v = 0; v < 16; v += 1) {
          const bits = v.toString(2).padStart(4, "0").replace(/^./, b);
          expect(runLoop("for-x", inputs({ countType, countBits: bits })).outcome.kind).toBe("exited");
        }
      }
    }
  });
});

describe("sv-loop-model · foreach (§12.7.3) with continue and break (§12.8)", () => {
  it("§12.7.3: the rightmost index changes fastest and each index runs from its left bound to its right bound", () => {
    expect(foreachOrder(FOREACH_RANGES)).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
    expect(foreachOrder([[5, 1]]).map((t) => t[0])).toEqual([5, 4, 3, 2, 1]);
    expect(foreachOrder([[0, 1], [0, 2], [0, 3]])[1]).toEqual([0, 0, 1]);
  });

  it("§12.8: break in a two-index foreach leaves the whole loop", () => {
    const run = presetRun("foreach-visit-order");
    expect(run.output).toEqual(["k=1 m=2"]);
    expect(run.passes).toBe(3);
    expect(run.outcome).toEqual({ kind: "exited", via: "break" });
  });

  it("§12.8: continue moves on to the next index pair", () => {
    const run = presetRun("foreach-visit-order");
    const at = run.steps.findIndex((s) => s.jump === "continue");
    expect(run.steps[at + 1].box).toBe("step");
    expect(run.steps[at + 1].what).toMatch(/k = 1, m = 2/);
  });
});

describe("sv-loop-model · forever (§12.7.6, §9.2.2.1)", () => {
  it("§12.7.6: forever #5 clk = ~clk advances time by 5 each pass and never ends on its own", () => {
    const run = presetRun("forever-clock");
    expect(run.outcome).toEqual({ kind: "trace-stopped", time: 5 * FOREVER_TRACE_PASSES, period: 5 });
    expect(run.steps.slice(1, -1).filter((s) => s.box === "wait").map((s) => s.time)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(Math.max(...run.steps.map((s) => s.statementsAtThisTime))).toBe(1);
  });

  it("§12.7.6: the forever #5 trace opens at t = 0 with clk = 1'b0, before the first wait", () => {
    const first = presetRun("forever-clock").steps[0];
    expect(first.clause).toBe("§12.7.6, §9.4.1");
    expect(first).toMatchObject({ box: "wait", time: 0, passes: 0, statementsAtThisTime: 0 });
    expect(first.vars.find((v) => v.name === "clk")?.value).toBe("0");
    expect(first.what).toMatch(/^At t = 0, clk is 1'b0\. The first #5 starts waiting/);
  });

  it("§9.4.1: #5 is a delay control on the statement, so only clk = ~clk counts as a statement at each new time", () => {
    const run = presetRun("forever-clock");
    // The last step is the verdict note, made after the toggle at t = 30.
    for (const s of run.steps.slice(0, -1).filter((st) => st.box === "wait")) expect(s.statementsAtThisTime).toBe(0);
    expect(run.steps.at(-1)?.statementsAtThisTime).toBe(1);
    for (const s of run.steps.filter((st) => st.box === "body")) expect(s.statementsAtThisTime).toBe(1);
  });

  it("§12.7.6 + §9.2.2.1: forever x = ~x climbs the statement count while t stays 0, with the verdict 'time never advances'", () => {
    const run = presetRun("forever-zero-delay");
    expect(run.outcome).toEqual({ kind: "zero-delay", statements: ZERO_DELAY_BUDGET, time: 0 });
    expect(run.steps.every((s) => s.time === 0)).toBe(true);
    const counts = run.steps.map((s) => s.statementsAtThisTime);
    expect(counts.slice(0, -1)).toEqual(counts.slice(0, -1).map((_, i) => i + 1));
    expect(run.verdict).toMatch(/^Time never advances/);
    expect(run.steps.at(-1)?.what).toMatch(/up to the tool/);
  });

  it("the zero-delay verdict step shows the same count its text states: the budget, for passes and statements", () => {
    const run = presetRun("forever-zero-delay");
    const last = run.steps.at(-1)!;
    expect(last.statementsAtThisTime).toBe(ZERO_DELAY_BUDGET);
    expect(last.passes).toBe(ZERO_DELAY_BUDGET);
    expect(run.passes).toBe(ZERO_DELAY_BUDGET);
    expect(last.what).toContain(`${ZERO_DELAY_BUDGET} statements ran at t = 0`);
    expect(last.what).toContain(`The model stops after ${ZERO_DELAY_BUDGET} statements`);
    expect(Math.max(...run.steps.map((s) => s.statementsAtThisTime))).toBe(ZERO_DELAY_BUDGET);
    expect(Math.max(...run.steps.map((s) => s.passes))).toBe(ZERO_DELAY_BUDGET);
  });

  it("the delay-ignored distractor stops at the budget too, never above it", () => {
    const run = runLoop("forever-clock", DEFAULT_INPUTS, { misconception: "delay-ignored" });
    expect(run.outcome).toEqual({ kind: "zero-delay", statements: ZERO_DELAY_BUDGET, time: 0 });
    expect(run.passes).toBe(ZERO_DELAY_BUDGET);
    expect(run.steps.at(-1)).toMatchObject({ passes: ZERO_DELAY_BUDGET, statementsAtThisTime: ZERO_DELAY_BUDGET });
  });

  it("a loop with tests stops at the budget with the passes of the statements that ran (continue-skips-step)", () => {
    const run = runLoop("for-jumps", inputs({ bound: 5 }), { misconception: "continue-skips-step" });
    expect(run.outcome).toMatchObject({ kind: "zero-delay", statements: ZERO_DELAY_BUDGET });
    const last = run.steps.at(-1)!;
    expect(last.statementsAtThisTime).toBe(ZERO_DELAY_BUDGET);
    expect(last.passes).toBe(run.steps.at(-2)!.passes);
    expect(run.passes).toBe(last.passes);
  });

  it("the trace-stopped verdict uses the singular for a 1-unit wait", () => {
    expect(runLoop("forever-toggle", DEFAULT_INPUTS, { misconception: "time-advances-each-pass" }).verdict).toMatch(/waits 1 time unit, so/);
    expect(presetRun("forever-clock").verdict).toMatch(/waits 5 time units, so/);
  });

  it("the verdict step and the assumptions word the tool's choice the same way", () => {
    expect(presetRun("forever-zero-delay").steps.at(-1)?.what).toContain(TOOL_CHOICE);
    expect(LOOP_ASSUMPTIONS.some((a) => a.includes(TOOL_CHOICE))).toBe(true);
    expect(LOOP_ASSUMPTIONS.join(" ")).not.toMatch(/loop limit/);
  });
});

describe("sv-loop-model · flowchart edges", () => {
  const programs: LoopProgramId[] = ["for-jumps", "repeat-count", "repeat-change", "while", "do-while", "for-x", "foreach", "forever-clock", "forever-toggle"];

  it("every loop goes back to a box inside the loop, and only forever has no exit", () => {
    for (const id of programs) {
      const p = buildProgram(id, DEFAULT_INPUTS);
      const ids = p.boxes.map((b) => b.id);
      expect(ids).toContain(p.edges.loopBackTo);
      expect(["init", "exit"]).not.toContain(p.edges.loopBackTo);
      expect(p.edges.exitFrom.length > 0).toBe(ids.includes("exit"));
      expect(p.edges.exitFrom.length === 0).toBe(p.form === "forever");
    }
  });

  it("§12.7.5: do...while goes back from the test to the body; the others with a test go back to it", () => {
    expect(buildProgram("do-while", DEFAULT_INPUTS).edges.loopBackTo).toBe("body");
    for (const id of ["for-jumps", "repeat-count", "repeat-change", "while", "for-x", "foreach"] as const) expect(buildProgram(id, DEFAULT_INPUTS).edges.loopBackTo).toBe("test");
    expect(buildProgram("forever-clock", DEFAULT_INPUTS).edges.loopBackTo).toBe("wait");
  });

  it("the test caption names the clause of the loop form when the test comes first", () => {
    expect(testPlacementText(buildProgram("for-jumps", DEFAULT_INPUTS))).toBe("Test before the body: the loop may run zero times (§12.7.1).");
    expect(testPlacementText(buildProgram("repeat-count", DEFAULT_INPUTS))).toMatch(/\(§12\.7\.2\)\.$/);
    expect(testPlacementText(buildProgram("while", DEFAULT_INPUTS))).toMatch(/\(§12\.7\.4\)\.$/);
    expect(testPlacementText(buildProgram("foreach", DEFAULT_INPUTS))).toMatch(/\(§12\.7\.3\)\.$/);
    expect(testPlacementText(buildProgram("do-while", DEFAULT_INPUTS))).toMatch(/\(§12\.7\.5\)\.$/);
    expect(testPlacementText(buildProgram("forever-clock", DEFAULT_INPUTS))).toMatch(/^No test/);
  });

  it("the assumptions say the foreach check is the model's drawing, not a test the clause states", () => {
    expect(LOOP_ASSUMPTIONS.some((a) => /foreach/.test(a) && /§12\.7\.3 gives no explicit test/.test(a))).toBe(true);
  });

  it("§12.8: the programs whose body can break list break as a way out", () => {
    for (const id of programs) {
      const p = buildProgram(id, DEFAULT_INPUTS);
      const breaks = p.code.some((l) => /\bbreak;/.test(l));
      expect(p.edges.exitFrom.some((e) => /break/.test(e))).toBe(breaks);
    }
  });
});

describe("sv-loop-model · inputs", () => {
  it("parses exactly four 4-state bits and explains a bad entry", () => {
    expect(parseCountBits("1x0Z")).toEqual({ ok: true, bits: ["1", "x", "0", "z"] });
    expect(parseCountBits("101").ok).toBe(false);
    expect(parseCountBits("12ab").ok).toBe(false);
  });

  it("§6.11: int n is a 32-bit signed 2-state value and is clamped to the lab's range", () => {
    expect(countValue(inputs({ countType: "int", countInt: -1 })).bits).toHaveLength(32);
    expect(clampInt(99)).toBe(INT_INPUT_MAX);
    expect(clampInt(-99)).toBe(INT_INPUT_MIN);
    expect(clampInt(Number.NaN)).toBe(0);
  });

  it("writes the declaration from the inputs", () => {
    expect(buildProgram("repeat-count", inputs({ countType: "logic4", countBits: "xxxx" })).code[0]).toBe("logic [3:0] n;  // never assigned: 4'bxxxx");
    expect(buildProgram("repeat-count", inputs({ countType: "logic4s", countBits: "1101" })).code[0]).toBe("logic signed [3:0] n = 4'b1101;");
    expect(buildProgram("repeat-count", inputs({ countType: "int", countInt: -1 })).code[0]).toBe("int n = -1;");
  });

  it("keys a prediction only on the inputs a program reads", () => {
    expect(inputKey("foreach", inputs({ bound: 2 }))).toBe(inputKey("foreach", inputs({ bound: 7 })));
    expect(inputKey("for-jumps", inputs({ bound: 2 }))).not.toBe(inputKey("for-jumps", inputs({ bound: 7 })));
  });
});

describe("sv-loop-model · prediction options", () => {
  const programs: LoopProgramId[] = ["for-jumps", "repeat-count", "repeat-change", "while", "do-while", "for-x", "foreach", "forever-clock", "forever-toggle"];

  it("every preset has exactly one correct option, labelled from the model's own run", () => {
    for (const preset of LOOP_PRESETS) {
      const ins = presetInputs(preset);
      const options = predictionOptions(preset.program, ins);
      const correct = options.filter((o) => o.correct);
      expect(correct).toHaveLength(1);
      expect(correct[0].label).toBe(summarizeRun(runLoop(preset.program, ins)));
      expect(correct[0].feedback).toBe(runLoop(preset.program, ins).verdict);
      expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers at least one wrong answer for every input combination the lab allows", () => {
    const combos: LoopInputs[] = [];
    for (let b = BOUND_MIN; b <= BOUND_MAX; b += 1) combos.push(inputs({ bound: b }));
    for (let v = INT_INPUT_MIN; v <= INT_INPUT_MAX; v += 1) combos.push(inputs({ countType: "int", countInt: v }));
    for (const countType of ["logic4", "logic4s"] as const)
      for (const bits of ["0000", "0001", "0111", "1000", "1101", "1111", "xxxx", "zzzz", "1x01", "0z10"]) combos.push(inputs({ countType, countBits: bits }));
    for (const cond of ["0", "1", "x", "z"] as const) combos.push(inputs({ cond }));
    for (const id of programs) for (const c of combos) expect(predictionOptions(id, c).length, `${id} ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(2);
  });

  it("wrong options carry the feedback of the rule they break", () => {
    const options = predictionOptions("for-jumps", inputs({ bound: 5 }));
    const skip = options.find((o) => o.id === "continue-skips-step");
    expect(skip?.label).toBe("Never ends, and time stays at t = 0");
    expect(skip?.feedback).toBe(MISCONCEPTION_FEEDBACK["continue-skips-step"]);
  });

  it("§12.8 + §12.7.1: the for-jumps wrong rules compute their labels", () => {
    const at5 = predictionOptions("for-jumps", inputs({ bound: 5 }));
    expect(at5.find((o) => o.id === "break-like-continue")?.label).toBe("5 passes, then the loop ends; prints “i = 0”, “i = 2”, “i = 4”");
    const at3 = predictionOptions("for-jumps", inputs({ bound: 3 }));
    expect(at3.find((o) => o.id === "inclusive-bound")?.label).toBe("4 passes, then the loop ends; prints “i = 0”, “i = 2”");
  });

  it("§12.7.1: at bound 0 the wrong answer of one pass carries the 'for tests first' feedback", () => {
    const options = predictionOptions("for-jumps", inputs({ bound: 0 }));
    const wrong = options.find((o) => o.id === "test-after-body");
    expect(wrong?.label).toBe("1 pass, then the loop ends; prints “i = 0”");
    expect(wrong?.feedback).toBe(MISCONCEPTION_FEEDBACK["test-after-body"]);
    expect(options.some((o) => o.id === "inclusive-bound")).toBe(false);
  });

  it("§12.7.2: the repeat-change options include re-reading the count each pass", () => {
    const opt = predictionOptions("repeat-change", presetInputs(presetById("repeat-change-n"))).find((o) => o.id === "count-reevaluated");
    expect(opt?.label).toBe("Never ends, and time stays at t = 0");
    expect(opt?.feedback).toBe(MISCONCEPTION_FEEDBACK["count-reevaluated"]);
  });

  it("§6.11.3: the signedness feedback is built from the actual bits of n and cites the right clause", () => {
    const repeatU = predictionOptions("repeat-count", inputs({ countType: "logic4", countBits: "1000" })).find((o) => o.id === "signedness-flipped");
    expect(repeatU?.feedback).toBe("That reads n as signed. logic [3:0] is unsigned by default, so 4'b1000 is 8; only logic signed [3:0] would read it as -8 (§6.11.3, §12.7.2).");
    const repeatS = predictionOptions("repeat-count", inputs({ countType: "logic4s", countBits: "1101" })).find((o) => o.id === "signedness-flipped");
    expect(repeatS?.feedback).toMatch(/4'b1101 is -3, not 13 \(§6\.11\.3, §12\.7\.2\)/);
    const forU = predictionOptions("for-x", inputs({ countType: "logic4", countBits: "1111" })).find((o) => o.id === "signedness-flipped");
    expect(forU?.feedback).toMatch(/4'b1111 is 15 \(§11\.4\.4\)/);
    expect(forU?.feedback).not.toMatch(/§12\.7\.2/);
    const forS = predictionOptions("for-x", inputs({ countType: "logic4s", countBits: "1101" })).find((o) => o.id === "signedness-flipped");
    expect(forS?.feedback).toMatch(/both are signed .* 4'b1101 is -3 \(§11\.4\.4\)/);
  });

  it("§12.7.2: the repeat (n) with n = x options include the run-time error belief, which the feedback corrects", () => {
    const options = predictionOptions("repeat-count", inputs({ countBits: "xxxx" }));
    expect(options.find((o) => o.id === "count-error")?.feedback).toMatch(/does not make this an error/);
  });

  it("§12.7.3: the foreach options include leftmost-fastest and break-inner-only orders", () => {
    const labels = predictionOptions("foreach", DEFAULT_INPUTS).map((o) => o.label);
    expect(labels).toContain(summarizeRun(runLoop("foreach", DEFAULT_INPUTS, { misconception: "leftmost-fastest" })));
    expect(runLoop("foreach", DEFAULT_INPUTS, { misconception: "break-inner-only" }).output).toEqual(["k=1 m=2", "k=2 m=2", "k=2 m=3"]);
  });

  it("the question says a pass that ends early with continue or break still counts", () => {
    expect(PREDICTION_QUESTION).toContain(PASS_DEFINITION);
    expect(PASS_DEFINITION).toMatch(/continue or break still counts/);
  });

  it("every program lists only misconceptions that have feedback", () => {
    for (const list of Object.values(PROGRAM_MISCONCEPTIONS)) for (const m of list) expect(MISCONCEPTION_FEEDBACK[m]).toBeTruthy();
  });
});
