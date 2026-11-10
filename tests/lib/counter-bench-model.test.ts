import { describe, expect, it } from "vitest";

import { BUGGY_COUNTER, FIXED_COUNTER, nextCount, simulateCounter } from "@/lib/counter-bug-model";
import {
  BENCH_DUTS,
  BENCH_DUT_IDS,
  COMPARE_FORM_IDS,
  COUNTER_BENCH_ASSUMPTIONS,
  HOLE_FILL_EDGE,
  LESSON_CONFIG,
  MUTANT_IDS,
  MUTATION_PRESETS,
  benchRtlLines,
  brokenParts,
  checkTimeNs,
  codeCoverage,
  configKey,
  coverageQuestion,
  coveredScenarioIds,
  dutBranch,
  evidenceVerdict,
  explainCheck,
  explainRun,
  findMutationPreset,
  functionalCoverage,
  mutantVerdict,
  mutationMatrix,
  normalizeConfig,
  planRows,
  printedLinesOptions,
  riseTimeNs,
  runBench,
  sameFunctionalCoverage,
  type BenchConfig,
} from "@/lib/counter-bench-model";

const cfg = (over: Partial<BenchConfig>): BenchConfig => ({ ...LESSON_CONFIG, ...over });

describe("counter-bench-model: the lesson's printed lines", () => {
  it("correct DUT with !==: PASS=20 FAIL=0 and COVERAGE seen_max=2 (checks 7 and 15 see 7)", () => {
    const run = runBench(LESSON_CONFIG);
    expect(run.passLine).toBe("PASS=20 FAIL=0");
    expect(run.coverageLine).toBe("COVERAGE seen_max=2");
    expect(run.checks.filter((c) => c.sawSeven).map((c) => c.index)).toEqual([7, 15]);
    expect(run.verdict).toBe("pass");
  });

  it("WRAP_AT(6) mutant: PASS=7 FAIL=13 seen_max=0, first failure check 7 at 80 ns (count 0, expected 7)", () => {
    const run = runBench(cfg({ dut: "wrap6" }));
    expect(run.passLine).toBe("PASS=7 FAIL=13");
    expect(run.coverageLine).toBe("COVERAGE seen_max=0");
    expect(run.firstFailure).toEqual({ index: 7, timeNs: 80 });
    expect(run.checks[7].actual).toBe(0);
    expect(run.checks[7].model).toBe(7);
    // The lesson's $error log: count=0..6,0..5 against expected 7,0..6,7,0..3 ... (first 13 failures)
    const failing = run.checks.filter((c) => c.outcome === "fail").map((c) => `count=${c.actual} expected=${c.model}`);
    expect(failing.slice(0, 3)).toEqual(["count=0 expected=7", "count=1 expected=0", "count=2 expected=1"]);
    expect(failing[failing.length - 1]).toBe("count=5 expected=3");
  });

  it("§11.4.5 + §12.4: stuck-X DUT with != prints PASS=20 FAIL=0 (1'bx takes the else, pass_cnt++)", () => {
    const run = runBench(cfg({ dut: "no-reset", form: "logic-ne" }));
    expect(run.passLine).toBe("PASS=20 FAIL=0");
    expect(run.checks.every((c) => c.actual === "X" && c.cond === "x" && c.branch === "else" && c.outcome === "pass")).toBe(true);
    expect(run.coverageLine).toBe("COVERAGE seen_max=0");
  });

  it("§11.4.5: stuck-X DUT with !== gives 1'b1 at every check, so FAIL=20", () => {
    const run = runBench(cfg({ dut: "no-reset" }));
    expect(run.passLine).toBe("PASS=0 FAIL=20");
    expect(run.checks.every((c) => c.cond === "1")).toBe(true);
  });

  it("§11.4.5: count === 3'd7 is 0 for X, so seen_max never counts an X", () => {
    expect(runBench(cfg({ dut: "no-reset" })).seenMax).toBe(0);
  });
});

describe("counter-bench-model: timing and layering", () => {
  it("rising edge i is at 5 + 10 i ns and check i at 10 + 10 i ns", () => {
    expect([riseTimeNs(0), riseTimeNs(7)]).toEqual([5, 75]);
    expect([checkTimeNs(0), checkTimeNs(7), checkTimeNs(19)]).toEqual([10, 80, 200]);
  });

  it("check i reads simulateCounter's count[i + 1] (the value after rising edge i)", () => {
    const run = runBench(LESSON_CONFIG);
    const trace = simulateCounter(FIXED_COUNTER, { edges: 21, rst: run.dutRst });
    run.checks.forEach((c) => expect(c.actual).toBe(trace.count[c.index + 1]));
  });

  it("§12.4: dutBranch agrees with nextCount for every DUT, value and rst", () => {
    for (const id of ["correct", "wrap6"] as const) {
      const dut = BENCH_DUTS[id];
      for (const v of ["X", 0, 1, 5, 6, 7] as const) {
        for (const rst of [0, 1] as const) {
          const b = dutBranch(dut, v, rst);
          const next = nextCount(dut.design, v, rst);
          if (b === "reset" || b === "wrap") expect(next).toBe(0);
          else expect(next).toBe(v === "X" ? "X" : (v + 1) % 8);
        }
      }
    }
    expect(BENCH_DUTS.wrap6.design).toBe(BUGGY_COUNTER);
  });

  it("§20.9: the reset-ignored mutant resets while count is X, and ignores rst once count is known", () => {
    const dut = BENCH_DUTS["reset-ignored"];
    expect(dutBranch(dut, "X", 1)).toBe("reset");
    expect(dutBranch(dut, 4, 1)).toBe("increment");
    // Without a second reset it matches the correct DUT exactly.
    expect(runBench(cfg({ dut: "reset-ignored" })).passLine).toBe("PASS=20 FAIL=0");
    const withHole = runBench(cfg({ dut: "reset-ignored", midResetAt: HOLE_FILL_EDGE }));
    expect(withHole.firstFailure?.index).toBe(HOLE_FILL_EDGE);
    expect(withHole.checks[HOLE_FILL_EDGE].actual).toBe(2);
    expect(withHole.checks[HOLE_FILL_EDGE].model).toBe(0);
  });

  it("§6.8 Table 6-7: with rst tied low the DUT never leaves X, while the bench still drives rst", () => {
    const run = runBench(cfg({ dut: "no-reset" }));
    expect(run.benchRst[0]).toBe(1);
    expect(run.dutRst.every((r) => r === 0)).toBe(true);
    expect(run.edges.every((e) => e.after === "X")).toBe(true);
  });

  it("normalizeConfig clamps checks and drops a mid-count reset outside edges 1..checks-1, with a visible note", () => {
    const a = normalizeConfig(cfg({ checks: 0 }));
    expect(a.config.checks).toBe(1);
    expect(a.notes[0].text).toMatch(/1 to 200 checks/);
    const b = normalizeConfig(cfg({ checks: 5, midResetAt: 5 }));
    expect(b.config.midResetAt).toBeNull();
    expect(b.notes[0].text).toMatch(/edges 1 to 4/);
    expect(normalizeConfig(cfg({ midResetAt: 0 })).config.midResetAt).toBeNull();
    expect(configKey(LESSON_CONFIG)).toBe("correct|case-ne|20|-");
  });
});

describe("counter-bench-model: compare forms that cannot fail", () => {
  it("every compare form prints FAIL=0 on the correct DUT (no false alarms)", () => {
    for (const form of COMPARE_FORM_IDS) expect(runBench(cfg({ form })).fail).toBe(0);
  });

  it("a commented-out compare prints PASS=0 FAIL=0 on every DUT: zero checks", () => {
    for (const dut of BENCH_DUT_IDS) {
      const run = runBench(cfg({ dut, form: "commented" }));
      expect(run.passLine).toBe("PASS=0 FAIL=0");
      expect(run.verdict).toBe("no-checks");
    }
  });

  it("§11.4.5: a self-copy compares count with itself (x !== x is 0), so it prints PASS=20 on every DUT", () => {
    for (const dut of BENCH_DUT_IDS) expect(runBench(cfg({ dut, form: "self-copy" })).passLine).toBe("PASS=20 FAIL=0");
    expect(runBench(cfg({ dut: "no-reset", form: "self-copy" })).checks[0].cond).toBe("0");
  });

  it("the mutation matrix: !== kills WRAP_AT(6) and the stuck X; != misses the X; nothing kills reset-ignored", () => {
    const killed = Object.fromEntries(mutationMatrix().map((v) => [`${v.form}:${v.mutant}`, v.killed]));
    expect(killed).toEqual({
      "case-ne:wrap6": true,
      "case-ne:no-reset": true,
      "case-ne:reset-ignored": false,
      "logic-ne:wrap6": true,
      "logic-ne:no-reset": false,
      "logic-ne:reset-ignored": false,
      "commented:wrap6": false,
      "commented:no-reset": false,
      "commented:reset-ignored": false,
      "self-copy:wrap6": false,
      "self-copy:no-reset": false,
      "self-copy:reset-ignored": false,
    });
  });

  it("filling the 'reset mid-count' hole kills the reset-ignored mutant with != and !==", () => {
    expect(mutantVerdict("reset-ignored", "case-ne", 20, HOLE_FILL_EDGE).killed).toBe(true);
    expect(mutantVerdict("reset-ignored", "logic-ne", 20, HOLE_FILL_EDGE).killed).toBe(true);
    expect(mutantVerdict("reset-ignored", "self-copy", 20, HOLE_FILL_EDGE).killed).toBe(false);
  });

  it("with rst asserted again at edge 10, only reset-ignored changes its kill pattern across the whole matrix", () => {
    const killed = Object.fromEntries(mutationMatrix(20, HOLE_FILL_EDGE).map((v) => [`${v.form}:${v.mutant}`, v.killed]));
    expect(killed).toEqual({
      "case-ne:wrap6": true,
      "case-ne:no-reset": true,
      "case-ne:reset-ignored": true,
      "logic-ne:wrap6": true,
      "logic-ne:no-reset": false,
      "logic-ne:reset-ignored": true,
      "commented:wrap6": false,
      "commented:no-reset": false,
      "commented:reset-ignored": false,
      "self-copy:wrap6": false,
      "self-copy:no-reset": false,
      "self-copy:reset-ignored": false,
    });
    expect(mutantVerdict("wrap6", "case-ne", 20, HOLE_FILL_EDGE).run.passLine).toBe("PASS=14 FAIL=6");
    expect(mutantVerdict("reset-ignored", "case-ne", 20, HOLE_FILL_EDGE).run.passLine).toBe("PASS=10 FAIL=10");
    for (const form of COMPARE_FORM_IDS) expect(runBench(cfg({ form, midResetAt: HOLE_FILL_EDGE })).fail).toBe(0);
  });

  it("verdict text is generated from the runs", () => {
    expect(mutantVerdict("wrap6", "case-ne").text).toBe("Killed: PASS=7 FAIL=13 with WRAP_AT(6), against PASS=20 FAIL=0 on the correct DUT. This check can fail.");
    expect(mutantVerdict("wrap6", "commented").text).toMatch(/^Survived: no compare ran \(PASS=0 FAIL=0\)/);
  });

  it("brokenParts marks the DUT, the reset path, the compare or the model", () => {
    expect(brokenParts(runBench(cfg({ dut: "wrap6" }))).map((p) => p.part)).toEqual(["dut"]);
    expect(brokenParts(runBench(cfg({ dut: "no-reset", form: "logic-ne" }))).map((p) => p.part)).toEqual(["stim", "chk"]);
    expect(brokenParts(runBench(cfg({ form: "self-copy" }))).map((p) => p.part)).toEqual(["model"]);
    expect(brokenParts(runBench(cfg({ form: "commented" }))).map((p) => p.part)).toEqual(["chk"]);
    expect(brokenParts(runBench(LESSON_CONFIG))).toEqual([]);
  });
});

describe("counter-bench-model: narration", () => {
  it("§11.4.5 + §12.4: an X check under != narrates 1'bx, the else and pass_cnt++", () => {
    const run = runBench(cfg({ dut: "no-reset", form: "logic-ne" }));
    const text = explainCheck(run.checks[0], "logic-ne");
    expect(text).toContain("count != expected gives 1'bx");
    expect(text).toContain("takes the else (§12.4): pass_cnt++");
    expect(text).toContain("PASS=1 FAIL=0");
  });

  it("explainRun names the first failure and the sevens from the run", () => {
    expect(explainRun(runBench(cfg({ dut: "wrap6" })))).toContain("Checks 0 to 6 pass; the first failure is check 7 at 80 ns, where the model expects 7 and count is 0. PASS=7 FAIL=13");
    expect(explainRun(runBench(LESSON_CONFIG))).toContain("checks 7 and 15, so COVERAGE seen_max=2");
  });

  it("printed-line options: exactly one is right and it is the run's output", () => {
    for (const p of MUTATION_PRESETS) {
      const opts = printedLinesOptions({ ...LESSON_CONFIG, dut: p.dut, form: p.form });
      const right = opts.filter((o) => o.correct);
      expect(right).toHaveLength(1);
      const run = runBench({ ...LESSON_CONFIG, dut: p.dut, form: p.form });
      expect(right[0].label).toBe(`${run.passLine} / ${run.coverageLine}`);
      expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length);
    }
    expect(findMutationPreset("nope").id).toBe("lesson-mutant");
  });
});

describe("counter-bench-model: coverage (§19.2, §40.2.2)", () => {
  it("lesson trace: always_ff 20, rst 1, wrap 2, increment 17; statements 3 of 3", () => {
    const c = codeCoverage(runBench(LESSON_CONFIG));
    expect(c.lineHits).toEqual({ always: 20, reset: 1, wrap: 2, incr: 17 });
    expect(c.statementsCovered).toBe(3);
    expect(c.branchesCovered).toBe(4);
  });

  it("§40.2.2 toggle: every bit of count, rst and clk seen at 0 and at 1; X bits count as neither", () => {
    const c = codeCoverage(runBench(LESSON_CONFIG));
    expect(c.toggle.map((t) => t.signal)).toEqual(["count[2]", "count[1]", "count[0]", "rst", "clk"]);
    expect(c.toggledBits).toBe(5);
    expect(codeCoverage(runBench(cfg({ checks: 1 }))).toggle.find((t) => t.signal === "clk")).toEqual({ signal: "clk", seen0: true, seen1: true });
    expect(COUNTER_BENCH_ASSUMPTIONS.some((a) => /per statement or per statement block/.test(a))).toBe(true);
    const x = codeCoverage(runBench(cfg({ dut: "no-reset" })));
    expect(x.toggle.filter((t) => t.signal.startsWith("count")).every((t) => !t.seen0 && !t.seen1)).toBe(true);
  });

  it("lesson plan: reset 1, increment 17, wrap 2, reset mid-count 0, checks with !== 20", () => {
    const f = functionalCoverage(runBench(LESSON_CONFIG));
    expect(f.hits).toEqual({ reset: 1, increment: 17, wrap: 2, "mid-reset": 0, checks: 20 });
    expect(f.scenariosCovered).toBe(3);
  });

  it("a mid-count reset adds rst hits but no statement or branch coverage; 'reset mid-count' goes 0 to 1", () => {
    const base = runBench(LESSON_CONFIG);
    const mid = runBench(cfg({ midResetAt: HOLE_FILL_EDGE }));
    expect(codeCoverage(mid).lineHits.reset).toBe(2);
    expect(codeCoverage(mid).statementsCovered).toBe(codeCoverage(base).statementsCovered);
    expect(codeCoverage(mid).branchesCovered).toBe(codeCoverage(base).branchesCovered);
    expect(functionalCoverage(mid).hits["mid-reset"]).toBe(1);
    const q = coverageQuestion(LESSON_CONFIG, cfg({ midResetAt: HOLE_FILL_EDGE }));
    expect(q.kind).toBe("mid-reset");
    expect(q.options.find((o) => o.correct)?.label).toBe("Code coverage stays the same; functional coverage changes");
  });

  it("a reset at edge 1 (count is 0) is not mid-count, and the question's answer follows the model", () => {
    expect(functionalCoverage(runBench(cfg({ midResetAt: 1 }))).hits["mid-reset"]).toBe(0);
    const q = coverageQuestion(LESSON_CONFIG, cfg({ midResetAt: 1 }));
    expect(q.options.find((o) => o.correct)?.label).toBe("Neither changes");
    expect(q.options.find((o) => o.correct)?.feedback).toMatch(/count was already 0 when rst was 1 at edge 1 \(rst stayed high from edge 0\)/);
  });

  it("a reset at edge 9 lands just after the wrap: not mid-count, and the reason names the wrap", () => {
    expect(functionalCoverage(runBench(cfg({ midResetAt: 9 }))).hits["mid-reset"]).toBe(0);
    const q = coverageQuestion(LESSON_CONFIG, cfg({ midResetAt: 9 }));
    expect(q.options.find((o) => o.correct)?.label).toBe("Neither changes");
    expect(q.options.find((o) => o.correct)?.feedback).toMatch(/count was already 0 at edge 9: it wrapped from 7 to 0 at edge 8/);
  });

  it("9 cycles, reset at edge 4: wrap is lost as mid-reset is gained, so functional coverage changes at the same 3 of 4", () => {
    const before = functionalCoverage(runBench(cfg({ checks: 9 })));
    const after = functionalCoverage(runBench(cfg({ checks: 9, midResetAt: 4 })));
    expect(before.scenariosCovered).toBe(3);
    expect(after.scenariosCovered).toBe(3);
    expect(coveredScenarioIds(before)).toEqual(["reset", "increment", "wrap"]);
    expect(coveredScenarioIds(after)).toEqual(["reset", "increment", "mid-reset"]);
    expect(sameFunctionalCoverage(before, after)).toBe(false);
    const q = coverageQuestion(cfg({ checks: 9 }), cfg({ checks: 9, midResetAt: 4 }));
    expect(q.kind).toBe("mid-reset");
    const right = q.options.filter((o) => o.correct);
    expect(right).toHaveLength(1);
    expect(right[0].label).toBe("Both change");
    const fb = right[0].feedback;
    expect(fb).toContain("Statement and branch coverage go from statements 3 of 3, branches 4 of 4 to statements 2 of 3, branches 3 of 4");
    expect(fb).toContain("The wrap assignment ran 1 time before and now never runs, so its statement and the true branch of count == WRAP_AT drop out of code coverage.");
    expect(fb).toContain("Functional coverage changes even though it stays at 3 of 4: a different set of plan items is covered.");
    expect(fb).toContain("'wrap 7 -> 0' goes from 1 to 0, so it is lost: the reset at edge 4 restarts the count at 0 before it reaches 7, so in 9 cycles count peaks at 4 and never wraps.");
    expect(fb).toContain("'reset mid-count' goes from 0 to 1, so it is gained: rst is 1 at edge 4 while count is 3.");
    expect(runBench(cfg({ checks: 9, midResetAt: 4 })).edges[4].before).toBe(3);
    expect(fb).not.toMatch(/goes from 3 to 3/);
  });

  it("9 cycles, reset at edge 1: both change, and the feedback says why (the wrap at edge 8 is lost)", () => {
    const q = coverageQuestion(cfg({ checks: 9 }), cfg({ checks: 9, midResetAt: 1 }));
    expect(q.kind).toBe("mid-reset");
    const right = q.options.filter((o) => o.correct);
    expect(right).toHaveLength(1);
    expect(right[0].label).toBe("Both change");
    const fb = right[0].feedback;
    expect(runBench(cfg({ checks: 9 })).edges[8].branch).toBe("wrap");
    expect(fb).toContain("The wrap assignment ran 1 time before and now never runs");
    expect(fb).toContain("Functional coverage goes from 3 to 2 of 4.");
    expect(fb).toContain("'wrap 7 -> 0' goes from 1 to 0, so it is lost: the reset at edge 1 leaves count at 0 there, so count first reaches 7 at edge 8, the last edge of the 9-cycle run");
    expect(fb).toContain("'reset mid-count' goes from 0 to 0.");
    expect(fb).toMatch(/count was already 0 when rst was 1 at edge 1 \(rst stayed high from edge 0\)/);
  });

  it("9 cycles, reset at edge 8 (count is 7): the reset branch runs instead of the wrap", () => {
    const q = coverageQuestion(cfg({ checks: 9 }), cfg({ checks: 9, midResetAt: 8 }));
    const right = q.options.filter((o) => o.correct);
    expect(right).toHaveLength(1);
    expect(right[0].label).toBe("Both change");
    expect(right[0].feedback).toContain("count is 7 at edge 8, but rst is 1 there and if (rst) is tested first, so the reset branch runs instead of the wrap.");
    // Removing that reset gives the wrap back, and the feedback names where it happens.
    const back = coverageQuestion(cfg({ checks: 9, midResetAt: 8 }), cfg({ checks: 9 }));
    expect(back.options.find((o) => o.correct)?.label).toBe("Both change");
    expect(back.options.find((o) => o.correct)?.feedback).toContain("'wrap 7 -> 0' goes from 0 to 1, so it is gained: count now wraps from 7 to 0 at edge 8 with the reset at edge 8 removed.");
  });

  it("two changes at once get a neutral question; the answer is the new run, not one change's effect", () => {
    const next = cfg({ checks: 5, midResetAt: 2 });
    const q = coverageQuestion(LESSON_CONFIG, next);
    expect(q.kind).toBe("several");
    expect(q.question).toBe(
      "Several things changed since the last run: the run goes from 20 to 5 cycles; rst is asserted again at edge 2. What do statement, branch and functional coverage show now?",
    );
    const right = q.options.filter((o) => o.correct);
    expect(right).toHaveLength(1);
    expect(right[0].label).toBe("statements 2 of 3, branches 3 of 4; functional 3 of 4");
    expect(right[0].feedback).toContain("'reset mid-count' goes from 0 to 1");
    expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
    expect(q.options.some((o) => /stays the same|changes/.test(o.label))).toBe(false);

    const q2 = coverageQuestion(LESSON_CONFIG, cfg({ checks: 5, form: "commented" }));
    expect(q2.kind).toBe("several");
    expect(q2.question).toContain("the compare goes from count !== expected to compare commented out; the run goes from 20 to 5 cycles");
    const right2 = q2.options.filter((o) => o.correct);
    expect(right2).toHaveLength(1);
    expect(right2[0].label).toBe("statements 2 of 3, branches 3 of 4; functional 2 of 4");
    expect(right2[0].feedback).toMatch(/0 checks ran \(was 20\); coverage never looks at the compare/);
    expect(right2[0].feedback).toMatch(/No evidence:/);
  });

  it("the compare question's labels follow the run's verdict, on any DUT", () => {
    const q = coverageQuestion(cfg({ dut: "wrap6", form: "commented" }), cfg({ dut: "wrap6", form: "case-ne" }));
    expect(q.kind).toBe("compare");
    expect(q.question).toBe("The compare is back as count !== expected. What happens to coverage and to the verdict?");
    expect(q.options.find((o) => o.correct)?.label).toBe("Coverage stays the same and the run fails on evidence");
    expect(q.options.some((o) => /passes on evidence/.test(o.label))).toBe(false);
    // Changing the DUT and the compare together is two changes: a neutral question.
    expect(coverageQuestion(cfg({ form: "commented" }), cfg({ dut: "wrap6" })).kind).toBe("several");
  });

  it("compare disabled: coverage unchanged, 0 checks, verdict 'no evidence'", () => {
    const run = runBench(cfg({ form: "commented", midResetAt: HOLE_FILL_EDGE }));
    expect(codeCoverage(run).statementsCovered).toBe(3);
    expect(functionalCoverage(run).scenariosCovered).toBe(4);
    expect(functionalCoverage(run).hits.checks).toBe(0);
    expect(evidenceVerdict(run).verdict).toBe("no-evidence");
    expect(evidenceVerdict(run).text).toMatch(/^No evidence: .*0 checks ran/);
    const q = coverageQuestion(cfg({ midResetAt: HOLE_FILL_EDGE }), cfg({ form: "commented", midResetAt: HOLE_FILL_EDGE }));
    expect(q.options.find((o) => o.correct)?.label).toBe("Coverage stays the same, checks drop to 0: no evidence");
  });

  it("a 5-cycle run never takes the wrap branch: statements 2 of 3, branches 3 of 4 (false branch evaluated, true never)", () => {
    const c = codeCoverage(runBench(cfg({ checks: 5 })));
    expect(c.lineHits).toEqual({ always: 5, reset: 1, wrap: 0, incr: 4 });
    expect(c.statementsCovered).toBe(2);
    expect(c.branches.find((b) => b.id === "wrap-false")?.hits).toBe(4);
    expect(c.branches.find((b) => b.id === "wrap-true")?.hits).toBe(0);
    const q = coverageQuestion(LESSON_CONFIG, cfg({ checks: 5 }));
    expect(q.kind).toBe("length");
    expect(q.options.find((o) => o.correct)?.label).toBe("statements 2 of 3, branches 3 of 4");
    // 9 cycles reach 7 once.
    expect(codeCoverage(runBench(cfg({ checks: 9 }))).lineHits.wrap).toBe(1);
  });

  it("baseline question: the increment line runs 17 times in 20 cycles", () => {
    const q = coverageQuestion(null, LESSON_CONFIG);
    expect(q.options.find((o) => o.correct)?.label).toBe("17");
    expect(q.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it("baseline question: each wrong value is told what it really counts", () => {
    const q = coverageQuestion(null, LESSON_CONFIG);
    const fb = (label: string) => q.options.find((o) => o.label === label)?.feedback ?? "";
    expect(q.options.map((o) => o.label).sort()).toEqual(["16", "17", "19", "20"]);
    expect(fb("20")).toMatch(/^20 counts every rising edge, including the ones that reset or wrap\. The body runs 20 times: 1 edge reset, 2 edges wrap, leaving 17 increments\.$/);
    expect(fb("19")).toMatch(/^19 counts every edge that did not reset: the 17 increments plus the 2 wrap edges/);
    expect(fb("16")).toMatch(/^16 is one short of the 17 increments/);
    for (const o of q.options.filter((x) => !x.correct)) expect(o.feedback).not.toMatch(/did not increment/);
  });

  it("plan rows: 'Reset mid-count' has 0 hits and its mutant survives every compare form", () => {
    const rows = planRows();
    const mid = rows.find((r) => r.id === "mid-reset");
    expect(mid?.hits).toBe(0);
    expect(mid?.mutant).toBe("reset-ignored");
    for (const form of COMPARE_FORM_IDS) expect(mutantVerdict("reset-ignored", form).killed).toBe(false);
    expect(MUTANT_IDS).toContain("reset-ignored");
  });

  it("the RTL text is generated per DUT", () => {
    expect(benchRtlLines("correct").find((l) => l.key === "wrap")?.text).toContain("count == WRAP_AT");
    expect(benchRtlLines("reset-ignored").find((l) => l.key === "reset")?.text).toContain("$isunknown(count)");
  });
});
