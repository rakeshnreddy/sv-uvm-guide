import { describe, expect, it } from "vitest";

import { compare, fromNumber, parseBits, type Bit4 } from "@/lib/sv-four-state-model";
import {
  CHECKER_PRESETS,
  CHECK_EDGES,
  CULPRITS,
  DEBUG_HINTS,
  DEBUG_SCENARIOS,
  DEFAULT_CHECKER_PRESET,
  NO_FIXES,
  VERDICT_TEXT,
  checkLine,
  checkerOptions,
  checkerSource,
  operatorBits,
  debugLogOptions,
  debugSource,
  evaluateChecker,
  explainRun,
  findCheckerPreset,
  fixKey,
  gradeSuspects,
  matchingPreset,
  simulateStatusReg,
  sumLiteral,
  valueText,
  type CheckerConfig,
  type FixSet,
} from "@/lib/x-check-model";

const preset = (id: string) => findCheckerPreset(id).config;
const withForm = (c: CheckerConfig, form: CheckerConfig["form"]): CheckerConfig => ({ ...c, form });
const value = (r: ReturnType<typeof evaluateChecker>, kind: string) => r.steps.find((s) => s.kind === kind)?.value;

describe("x-check-model · checker presets are the F2E table rows", () => {
  it("has one preset per table row plus the control-signal and 2-state-copy cases, defaulting to 9'b0_0000_101x", () => {
    expect(CHECKER_PRESETS.map((p) => p.id)).toEqual(["d10", "d11", "all-x", "x-low", "x-high", "valid-x", "int-copy"]);
    expect(findCheckerPreset(undefined).id).toBe(DEFAULT_CHECKER_PRESET);
    expect(findCheckerPreset("nope").id).toBe("x-low");
    expect(sumLiteral(preset("x-low").sum)).toBe("9'b0_0000_101x");
    expect(sumLiteral(preset("x-high").sum)).toBe("9'b1_0000_101x");
    expect(valueText(preset("d11").sum)).toBe("9'd11");
    expect(valueText(preset("d10").exp)).toBe("9'd10");
  });

  it("recognises an untouched preset and an edited one", () => {
    expect(matchingPreset(preset("d10"))).toBe("d10");
    expect(matchingPreset({ ...preset("d10"), outValid: "z" })).toBeNull();
  });

  // The F2E table: sum != 10, what the if/else counts, and sum !== 10.
  it.each([
    ["d10", "0", "pass", "0", "pass"],
    ["d11", "1", "fail", "1", "fail"],
    ["all-x", "x", "pass", "1", "fail"],
    ["x-low", "x", "pass", "1", "fail"],
    ["x-high", "1", "fail", "1", "fail"],
  ])("§11.4.5 + §12.4: %s gives != %s (%s) and !== %s (%s)", (id, neq, neqCount, cneq, cneqCount) => {
    const c = preset(id);
    const a = evaluateChecker(withForm(c, "neq"));
    expect(a.operatorResult).toBe(neq);
    expect(a.counter).toBe(neqCount);
    const b = evaluateChecker(withForm(c, "case-neq"));
    expect(b.operatorResult).toBe(cneq);
    expect(b.counter).toBe(cneqCount);
  });
});

describe("x-check-model · the rules, by clause", () => {
  it("§11.4.5: != is x when the known bits agree and a bit is x or z, 1 when a known bit differs; !== is never x", () => {
    for (const unknown of ["x", "z"] as Bit4[]) {
      const sum = parseBits(`0_0000_101${unknown}`);
      expect(compare("!=", sum, fromNumber(10, 9)).result).toBe("x");
      expect(compare("!==", sum, fromNumber(10, 9)).result).toBe("1");
      const r = evaluateChecker({ ...preset("x-low"), sum });
      expect(r.operatorResult).toBe("x");
      expect(r.counter).toBe("pass");
      expect(r.verdict).toBe("false-pass");
    }
  });

  it("§12.4: an x condition is false, so if (sum != e.sum) runs its else branch and counts a pass", () => {
    const r = evaluateChecker(preset("x-low"));
    expect(r.steps.map((s) => s.kind)).toEqual(["guard", "valid", "operator", "branch", "counter"]);
    expect(value(r, "operator")).toBe("1'bx");
    expect(value(r, "branch")).toBe("else");
    expect(value(r, "counter")).toBe("pass_cnt++");
    expect(r.steps.find((s) => s.kind === "branch")?.text).toMatch(/treats x as false.*§12\.4/);
  });

  it("§16.3: an immediate assert fails on x, z or 0 and runs its fail statement; it passes on 1", () => {
    expect(evaluateChecker(withForm(preset("x-low"), "assert-eq")).counter).toBe("fail");
    expect(evaluateChecker(withForm({ ...preset("x-low"), sum: parseBits("0_0000_101z") }, "assert-eq")).counter).toBe("fail");
    expect(evaluateChecker(withForm(preset("d11"), "assert-eq")).counter).toBe("fail");
    const pass = evaluateChecker(withForm(preset("d10"), "assert-eq"));
    expect(pass.counter).toBe("pass");
    expect(pass.verdict).toBe("honest-pass");
    const fail = evaluateChecker(withForm(preset("all-x"), "assert-eq"));
    expect(fail.steps.find((s) => s.kind === "branch")).toMatchObject({ clause: "§16.3", value: "fail statement (else)" });
    expect(fail.steps.find((s) => s.kind === "branch")?.text).toMatch(/Without an else clause the tool would call \$error by default/);
  });

  it("§6.11.2: a copy into int turns x and z into 0 before the compare, so even !== passes 9'b0_0000_101x against 10", () => {
    const r = evaluateChecker(preset("int-copy"));
    expect(r.steps.map((s) => s.kind)).toEqual(["guard", "valid", "copy", "operator", "branch", "counter"]);
    expect(value(r, "copy")).toBe("s = 10");
    expect(r.counter).toBe("pass");
    expect(r.verdict).toBe("false-pass");
    // A known x-free difference survives the copy.
    expect(evaluateChecker({ ...preset("int-copy"), sum: parseBits("1_0000_101x") }).counter).toBe("fail");
  });

  it("§12.4 + §20.9: without a guard an x or z out_valid skips the compare; with $isunknown it is a failure", () => {
    for (const ov of ["x", "z"] as Bit4[]) {
      const skip = evaluateChecker({ ...preset("valid-x"), outValid: ov });
      expect(skip.counter).toBe("neither");
      expect(skip.operatorResult).toBeNull();
      expect(skip.verdict).toBe("silent-skip");
      const guarded = evaluateChecker({ ...preset("valid-x"), outValid: ov, guard: true });
      expect(guarded.counter).toBe("fail");
      expect(guarded.errorCalled).toBe(true);
      expect(guarded.steps[0]).toMatchObject({ kind: "guard", value: "1", clause: "§20.9" });
    }
    const idle = evaluateChecker({ ...preset("d10"), outValid: "0" });
    expect(idle.counter).toBe("neither");
    expect(idle.verdict).toBe("no-result");
  });

  it("§11.4.5: !== matches x against x, so an unknown expectation lets an unknown sum pass (a bench bug)", () => {
    const allX = Array<Bit4>(9).fill("x");
    const r = evaluateChecker({ ...preset("all-x"), form: "case-neq", exp: allX });
    expect(r.counter).toBe("pass");
    expect(r.verdict).toBe("bad-expectation");
  });

  it("covers the extremes: 0 and 511 compare as known values", () => {
    for (const n of [0, 511]) {
      const c = { ...preset("d10"), sum: fromNumber(n, 9), exp: fromNumber(n, 9) };
      expect(evaluateChecker(c).verdict).toBe("honest-pass");
      expect(evaluateChecker({ ...c, copyToInt: true, form: "case-neq" }).counter).toBe("pass");
    }
  });

  it("§6.11.2: the copy step names the unknown it erases and how many bits; a zeroed copy that fails is not called honest", () => {
    const step = (c: CheckerConfig, kind: string) => evaluateChecker(c).steps.find((s) => s.kind === kind);
    expect(step(preset("int-copy"), "copy")?.text).toBe("int is 2-state, so assigning sum to s turns the x bit into 0 (§6.11.2). The compare never sees the unknown.");
    const allZ: CheckerConfig = { ...preset("int-copy"), sum: Array<Bit4>(9).fill("z") };
    expect(step(allZ, "copy")).toMatchObject({ value: "s = 0", text: expect.stringContaining("turns the 9 z bits into 0 (§6.11.2)") });
    expect(step({ ...preset("int-copy"), sum: fromNumber(10, 9) }, "copy")?.text).toBe("Every bit of sum is known, so the int copy holds the same value.");
    for (const sum of [Array<Bit4>(9).fill("x"), parseBits("1_0000_101x")]) {
      const r = evaluateChecker({ ...preset("int-copy"), sum });
      expect(r.counter).toBe("fail");
      expect(r.verdict).toBe("masked-fail");
      expect(r.verdictText).toMatch(/not because of the unknown.*§6\.11\.2.*false pass/);
    }
    // Without the copy the same unknown sums are honest failures under !==.
    expect(evaluateChecker(withForm(preset("all-x"), "case-neq")).verdict).toBe("honest-fail");
  });

  it("§11.4.5: the operator step names the bit that decides the result for every operator", () => {
    const op = (c: CheckerConfig) => evaluateChecker(c).steps.find((s) => s.kind === "operator")?.text;
    expect(op(withForm(preset("x-low"), "case-neq"))).toBe(
      "sum !== e.sum is 1'b1. !== compares x and z as values and always returns 0 or 1 (§11.4.5). Bit 0 is x versus 0, so the operands differ. === would give 0, so !== is a known 1.",
    );
    expect(op(withForm(preset("d10"), "case-neq"))).toMatch(/Every bit matches literally, so the operands are identical\. === would give 1, so !== is a known 0\.$/);
    expect(op({ ...preset("all-x"), form: "case-neq", exp: Array<Bit4>(9).fill("x") })).toMatch(/Every bit matches literally, x against x and z against z/);
    expect(op(preset("x-low"))).toBe(
      "sum != e.sum is 1'bx. Every bit known in both operands matches, but bit 0 is x vs 0. The relation is ambiguous, so == gives x (§11.4.5). != is the negation of ==, so it gives x.",
    );
    // No bit is known on both sides: "every known bit matches" would be vacuous.
    expect(op(preset("all-x"))).toMatch(/^sum != e\.sum is 1'bx\. No bit is known in both operands, so nothing proves them different, but bit 8 is x vs 0\./);
    // Fully known operands are not described with "whatever the unknown bits are".
    expect(op(withForm(preset("d11"), "assert-eq"))).toBe("sum == e.sum is 1'b0. Every bit is known and bit 0 differs (1 vs 0), so == gives 0 (§11.4.5).");
    expect(op(preset("x-high"))).toMatch(/Bit 8 is known in both operands and differs \(1 vs 0\)\. Whatever the x or z bits are/);
    expect(op(withForm(preset("d10"), "assert-eq"))).toBe("sum == e.sum is 1'b1. All bits are known and equal, so == gives 1 (§11.4.5).");
    // The operator step is about the operator; the branch step states the if rule once.
    for (const p of CHECKER_PRESETS) for (const form of ["neq", "case-neq", "assert-eq"] as const) expect(op({ ...p.config, form }) ?? "").not.toMatch(/An if treats/);
  });

  it("§16.3: the assert fail step keeps the $assertcontrol exception to the default $error", () => {
    const branch = evaluateChecker(withForm(preset("d11"), "assert-eq")).steps.find((s) => s.kind === "branch")?.text;
    expect(branch).toMatch(/call \$error by default \(§16\.3, §20\.10\), unless \$assertcontrol suppresses the failure \(§20\.11\)\.$/);
  });

  it("§12.4: the skip sentence matches out_valid: a 0 hides nothing, an x or z is named", () => {
    const counter = (c: CheckerConfig) => evaluateChecker(c).steps.find((s) => s.kind === "counter")?.text;
    expect(counter({ ...preset("valid-x"), outValid: "0" })).toBe("Neither counter moves: out_valid is 0.");
    expect(counter(preset("valid-x"))).toBe("Neither counter moves. Without the $isunknown guard, an x out_valid passes unnoticed.");
    expect(counter({ ...preset("valid-x"), outValid: "z" })).toBe("Neither counter moves. Without the $isunknown guard, a z out_valid passes unnoticed.");
  });

  it("every verdict has a sentence", () => {
    for (const v of Object.keys(VERDICT_TEXT)) expect(VERDICT_TEXT[v as keyof typeof VERDICT_TEXT].length).toBeGreaterThan(10);
  });
});

describe("x-check-model · code and predictions", () => {
  it("generates the checker code from the configuration", () => {
    expect(checkLine(preset("x-low"))).toBe("if (sum != e.sum) fail_cnt++; else pass_cnt++;");
    expect(checkLine(withForm(preset("x-low"), "case-neq"))).toBe("if (sum !== e.sum) fail_cnt++; else pass_cnt++;");
    expect(checkLine(withForm(preset("x-low"), "assert-eq"))).toBe("assert (sum == e.sum) pass_cnt++; else fail_cnt++;");
    expect(checkLine(preset("int-copy"))).toBe("if (s !== e.sum) fail_cnt++; else pass_cnt++;");
    const guarded = checkerSource(preset("x-low")).map((l) => l.text.trim());
    expect(guarded).toContain("if ($isunknown(out_valid)) begin");
    expect(guarded).toContain("end else if (out_valid) begin");
    const bare = checkerSource(preset("valid-x")).map((l) => l.text.trim());
    expect(bare).toContain("if (out_valid) begin");
    expect(bare.some((t) => t.includes("$isunknown"))).toBe(false);
    // Every step points at a line that exists.
    for (const p of CHECKER_PRESETS) {
      const keys = checkerSource(p.config).map((l) => l.key);
      for (const s of evaluateChecker(p.config).steps) expect(keys).toContain(s.lineKey);
    }
  });

  it("§11.4.5: the bit table marks x against a known bit as unknown for != and as a difference for !==", () => {
    const neq = operatorBits(preset("x-low"));
    expect(neq).toHaveLength(9);
    expect(neq[0]).toMatchObject({ index: 8, outcome: "match" });
    expect(neq[8]).toMatchObject({ index: 0, left: "x", right: "0", outcome: "ambiguous" });
    expect(operatorBits(withForm(preset("x-low"), "case-neq"))[8].outcome).toBe("mismatch");
    // The int copy: bit 0 of s is already 0.
    expect(operatorBits(preset("int-copy"))[8]).toMatchObject({ left: "0", outcome: "match" });
  });

  it("offers pass / fail / neither with exactly one correct, and the correct feedback is the step sentences", () => {
    for (const p of CHECKER_PRESETS) {
      const opts = checkerOptions(p.config);
      expect(opts.map((o) => o.id)).toEqual(["pass", "fail", "neither"]);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
      const r = evaluateChecker(p.config);
      expect(opts.find((o) => o.correct)?.feedback).toBe(r.steps.map((s) => s.text).join(" "));
    }
  });

  it("diagnoses the misconceptions behind wrong counter guesses", () => {
    const fb = (c: CheckerConfig, id: string) => checkerOptions(c).find((o) => o.id === id)?.feedback;
    expect(fb(preset("x-low"), "fail")).toMatch(/An x condition is not a failure for an if/);
    expect(fb(withForm(preset("x-low"), "case-neq"), "pass")).toMatch(/!== never returns x/);
    expect(fb(withForm(preset("x-low"), "assert-eq"), "pass")).toMatch(/reads x like an if does/);
    expect(fb(preset("valid-x"), "pass")).toMatch(/nothing guards it/);
    expect(fb(preset("int-copy"), "fail")).toMatch(/never reaches the compare/);
    expect(fb(preset("x-high"), "pass")).toMatch(/A known bit differs/);
    expect(fb(preset("d11"), "pass")).toMatch(/Every bit is known and the values differ/);
    expect(fb(preset("d10"), "fail")).toBe("sum != e.sum is 1'b0, which sends the check down its passing path. A known, equal pair of values is a pass.");
  });

  describe("wrong-guess feedback names the mechanism of the operand the compare actually reads", () => {
    const fb = (c: CheckerConfig, id: string) => checkerOptions(c).find((o) => o.id === id)?.feedback ?? "";
    const allX = Array<Bit4>(9).fill("x");
    const allZ = Array<Bit4>(9).fill("z");

    it("§11.4.5: a known differing sum under !== is not blamed on an unknown bit", () => {
      const f = fb(withForm(preset("d11"), "case-neq"), "pass");
      expect(f).not.toMatch(/unknown bit/);
      expect(f).toMatch(/Every bit is known and the values differ, so !== is 1/);
    });

    it("§6.11.2: with the int copy, a pass guess on a failing check says the copy zeroed the unknown, for !== and !=", () => {
      for (const [sum, form, word, s] of [
        [parseBits("1_0000_101x"), "case-neq", "x bit", "s = 266"],
        [allX, "case-neq", "x bits", "s = 0"],
        [allX, "neq", "x bits", "s = 0"],
        [allZ, "case-neq", "z bits", "s = 0"],
      ] as const) {
        const c = { ...preset("int-copy"), form, sum: [...sum] } as CheckerConfig;
        expect(evaluateChecker(c).counter).toBe("fail");
        const f = fb(c, "pass");
        expect(f).toContain(`the int copy turned the ${word} into 0 (§6.11.2), so the compare reads ${s}`);
        expect(f).toMatch(/because the zeroed value differs from e\.sum, not because of the unknown/);
        expect(f).not.toMatch(/a sum with an unknown bit|whatever the x/);
      }
    });

    it("§12.4: with the int copy and an unknown e.sum, a fail guess is told the x comes from e.sum, not that s matches", () => {
      const c: CheckerConfig = { ...preset("int-copy"), form: "neq", exp: parseBits("0_0000_101x") };
      const r = evaluateChecker(c);
      expect(r.operatorResult).toBe("x");
      expect(r.counter).toBe("pass");
      const f = fb(c, "fail");
      expect(f).not.toMatch(/matches e\.sum/);
      expect(f).toMatch(/An x condition is not a failure for an if.*the x comes from e\.sum/);
    });

    it("§16.3: a pass guess on an assert whose expression is a known 0 is diagnosed", () => {
      for (const id of ["d11", "x-high"]) {
        expect(fb(withForm(preset(id), "assert-eq"), "pass")).toBe("sum == e.sum is 1'b0, a known mismatch, so the assertion fails and its else clause, fail_cnt++, runs (§16.3).");
      }
    });

    it("names the z when the copied unknown is z", () => {
      const c: CheckerConfig = { ...preset("int-copy"), sum: parseBits("0_0000_101z") };
      expect(fb(c, "fail")).toBe("The z never reaches the compare: the int copy turned the z bit into 0 (§6.11.2), so the compare reads s = 10, a known value that matches e.sum.");
    });
  });
});

describe("x-check-model · debug challenge (F2A status_reg)", () => {
  it("prints status_reg and tb_top as the lesson does, with the (A) (B) (C) labels", () => {
    const src = debugSource();
    const text = (k: string) => src.find((l) => l.key === k)?.text;
    expect(text("A")).toBe("    if (!rst_n) busy <= 1'b0;             // (A)");
    expect(text("B")).toBe("  bit   err_bit;                          // (B) the monitor's copy of the flag");
    expect(text("C")).toBe("      if (err_bit != 1'b0) begin          // (C) the check");
    expect(text("rst")).toBe("    rst_n <= 1'b1;                        // nonblocking: the DUT samples the old value");
    expect(src.filter((l) => l.label).map((l) => l.label)).toEqual(["A", "B", "C"]);
    expect(src.find((l) => l.key === "ff")?.owner).toBe("design");
    expect(src.find((l) => l.key === "C")?.owner).toBe("testbench");
  });

  it("applies the lesson's fixes to the code", () => {
    const src = debugSource({ A: true, B: true, C: true });
    const text = (k: string) => src.find((l) => l.key === k)?.text ?? "";
    expect(text("A")).toContain("if (!rst_n) begin busy <= 1'b0; err <= 1'b0; end");
    expect(text("B")).toContain("logic err_q;");
    expect(text("copy")).toBe("      err_q = dut.err;");
    expect(text("C")).toContain("if (err_q !== 1'b0) begin");
  });

  it("Table 6-7 + §6.11.2: dut.err is x at every edge, err_bit reads 0, $isunknown(dut.err) is 1", () => {
    const run = simulateStatusReg();
    expect(run.rstN).toEqual(["0", "0", "1", "1", "1"]);
    expect(run.setErr).toEqual(["0", "0", "0", "0", "0"]);
    expect(run.dutErr).toEqual(["x", "x", "x", "x", "x"]);
    expect(run.copy).toEqual(["0", "0", "0", "0", "0"]);
    expect(run.unknown).toEqual(["1", "1", "1", "1", "1"]);
    expect(run.resetEdges).toEqual([0, 1]);
    expect(run.checks.map((c) => c.edge)).toEqual([...CHECK_EDGES]);
  });

  it("pins the four logs: B only, C only, B and C, then the DUT fixed as well", () => {
    const log = (f: FixSet) => simulateStatusReg(f).log.map((l) => (l.kind === "error" ? `error@${l.edge}: ${l.text}` : l.text));
    expect(log(NO_FIXES)).toEqual(["PASS=3 FAIL=0"]);
    // Fix B only: still PASS=3, because != gives x (§11.4.5, §12.4).
    const b = simulateStatusReg({ A: false, B: true, C: false });
    expect(b.copy).toEqual(["x", "x", "x", "x", "x"]);
    expect(b.checks.every((c) => c.result === "x" && c.branch === "else")).toBe(true);
    expect(log(b.fixes)).toEqual(["PASS=3 FAIL=0"]);
    // Fix C only: still PASS=3, because err_bit is a clean 0.
    const c = simulateStatusReg({ A: false, B: false, C: true });
    expect(c.checks.every((k) => k.copy === "0" && k.result === "0")).toBe(true);
    expect(log(c.fixes)).toEqual(["PASS=3 FAIL=0"]);
    // B and C: every check fails, and $error lets the run continue (§20.10).
    expect(log({ A: false, B: true, C: true })).toEqual(["error@2: err is set", "error@3: err is set", "error@4: err is set", "PASS=0 FAIL=3"]);
    // DUT fixed as well: an honest PASS=3.
    const abc = simulateStatusReg({ A: true, B: true, C: true });
    expect(abc.dutErr).toEqual(["x", "0", "0", "0", "0"]);
    expect(abc.unknown).toEqual(["1", "0", "0", "0", "0"]);
    expect(log(abc.fixes)).toEqual(["PASS=3 FAIL=0"]);
    expect(DEBUG_SCENARIOS.map((s) => fixKey(s.fixes))).toEqual(["none", "B", "C", "BC", "ABC"]);
  });

  it("explains each log from its own run", () => {
    expect(explainRun(simulateStatusReg({ A: false, B: true, C: false }))).toMatch(/err_q != 1'b0 is x \(§11\.4\.5\), and the if takes the else branch \(§12\.4\)\. Every check counts a pass: PASS=3 FAIL=0\. The x is still there/);
    expect(explainRun(simulateStatusReg({ A: false, B: false, C: true }))).toMatch(/err_bit is a bit, so the copy turns x into 0 \(§6\.11\.2\)/);
    expect(explainRun(simulateStatusReg({ A: false, B: true, C: true }))).toMatch(/PASS=0 FAIL=3.*tells the truth/);
    expect(explainRun(simulateStatusReg({ A: true, B: true, C: true }))).toMatch(/honest/);
  });

  it("offers each log prediction with one correct answer and a §20.10 note on $error", () => {
    for (const s of DEBUG_SCENARIOS) {
      const opts = debugLogOptions(s.fixes);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
      expect(opts.find((o) => o.correct)?.label).toBe(simulateStatusReg(s.fixes).summary);
      expect(opts.find((o) => o.id === "stop")?.feedback).toMatch(/only \$fatal implies \$finish \(§20\.10\)/);
    }
    expect(debugLogOptions({ A: false, B: true, C: false }).find((o) => o.id === "all-fail")?.feedback).toMatch(/err_q keeps the x/);
    expect(debugLogOptions({ A: false, B: false, C: true }).find((o) => o.id === "all-fail")?.feedback).toMatch(/cannot catch an x that is already gone/);
  });

  it("grades the suspects: A, B, C are culprits with model evidence; the nonblocking release, the counters and clk are decoys", () => {
    const s = gradeSuspects();
    expect(s.filter((x) => x.verdict === "culprit").map((x) => x.id)).toEqual([...CULPRITS]);
    expect(s.filter((x) => x.verdict === "decoy").map((x) => x.id)).toEqual(["rst-nb", "counters", "clk"]);
    const by = (id: string) => s.find((x) => x.id === id);
    expect(by("A")?.evidence).toBe("dut.err at edges 0 to 4: x, x, x, x, x. With err <= 1'b0 added to the reset branch: x, 0, 0, 0, 0.");
    expect(by("B")?.evidence).toBe("At the checks (edges 2, 3, 4) dut.err is x, x, x but err_bit reads 0, 0, 0.");
    // C's verdict must not give away the fix predictions' logs.
    expect(by("C")?.evidence).toBe("The check runs at edges 2, 3, 4 and compares with !=.");
    for (const x of s) expect(`${x.feedback} ${x.evidence}`).not.toMatch(/PASS=/);
    expect(by("rst-nb")?.evidence).toMatch(/edges 0 and 1/);
    expect(by("A")?.feedback).toMatch(/Table 6-7/);
    expect(by("B")?.feedback).toMatch(/§6\.11\.2/);
    expect(by("C")?.feedback).toMatch(/§11\.4\.5, §12\.4/);
    // Each suspect points at a line of the program.
    const keys = debugSource().map((l) => l.key);
    for (const x of s) expect(keys).toContain(x.lineKey);
    expect(DEBUG_HINTS).toHaveLength(3);
  });
});
