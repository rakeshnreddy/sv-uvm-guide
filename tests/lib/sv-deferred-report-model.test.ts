import { describe, expect, it } from "vitest";

import {
  DEFERRED_PRESETS,
  analyzeRun,
  assertionTypeBit,
  assertionTypeSum,
  buildDeferredScenario,
  buildPrediction,
  countLines,
  describeAssertionType,
  evaluate,
  evaluateCheck,
  exploreDeferred,
  exprText,
  fateSentences,
  isEdge,
  reportCount,
  richestRun,
  runSummary,
  sourceKeys,
  validateDeferredScenario,
  type CheckSpec,
  type DeferredPresetId,
  type DeferredRun,
  type DeferredScenario,
  type PresetOptions,
} from "@/lib/sv-deferred-report-model";

const VARIANTS: { id: DeferredPresetId; options: PresetOptions }[] = [
  { id: "reset-nba-flush", options: {} },
  { id: "reset-delayed-matures", options: {} },
  { id: "lrm-unique-glitch", options: {} },
  { id: "loop-flush", options: {} },
  { id: "two-callers", options: {} },
  { id: "assertcontrol-race", options: { controlType: 4 } },
  { id: "assertcontrol-race", options: { controlType: 5 } },
  { id: "assert-forms-glitch", options: { reactiveWritesA: false } },
  { id: "assert-forms-glitch", options: { reactiveWritesA: true } },
];

const certainCounts = (scenario: DeferredScenario, focus?: string) =>
  [...new Set(exploreDeferred(scenario).runs.map((r) => reportCount(scenario, r, focus).certain))].sort();

/** The run whose scheduler picks include `pick`. */
const runWhere = (scenario: DeferredScenario, pick: RegExp): DeferredRun => {
  const run = exploreDeferred(scenario).runs.find((r) => r.picks.some((p) => pick.test(p)));
  if (!run) throw new Error(`No run with a pick matching ${pick}`);
  return run;
};

describe("sv-deferred-report-model: checks (IEEE 1800-2023 §12.4, §12.5, §16.3, §11.4.5)", () => {
  const values = { state: "X" as const, a: 1, not_a: 1 };
  const caseCheck: CheckSpec = { kind: "violation", id: "c", label: "unique case (state)", qualifier: "unique", construct: "case", select: "state", items: [{ name: "RED", value: 0 }, { name: "GREEN", value: 1 }] };
  const scenario = { valueNames: { state: { 0: "RED", 1: "GREEN" } } };

  it("§12.5 and §12.5.3: an x select matches no known case item, which unique reports", () => {
    const e = evaluateCheck(scenario, caseCheck, values);
    expect(e).toMatchObject({ result: "no-match", violation: true, detail: "state = x", finding: "no case item matches state = x" });
    expect(evaluateCheck(scenario, caseCheck, { state: 1 })).toMatchObject({ result: "pass", violation: false, finding: "exactly one item, GREEN, matches" });
  });

  it("§12.4.2: unique if reports two true conditions; unique0 does not report no match; priority does not report overlap", () => {
    const ifCheck = (qualifier: "unique" | "unique0" | "priority"): CheckSpec => ({ kind: "violation", id: "u", label: "u", qualifier, construct: "if", conditions: [{ kind: "var", name: "a" }, { kind: "var", name: "not_a" }] });
    expect(evaluateCheck({}, ifCheck("unique"), { a: 1, not_a: 1 })).toMatchObject({ result: "multiple-match", violation: true });
    expect(evaluateCheck({}, ifCheck("unique"), { a: 0, not_a: 0 })).toMatchObject({ result: "no-match", violation: true });
    expect(evaluateCheck({}, ifCheck("unique0"), { a: 0, not_a: 0 })).toMatchObject({ result: "no-match", violation: false });
    expect(evaluateCheck({}, ifCheck("priority"), { a: 1, not_a: 1 })).toMatchObject({ result: "multiple-match", violation: false });
    // §12.4: an x condition is false.
    expect(evaluateCheck({}, ifCheck("unique"), { a: "X", not_a: 1 })).toMatchObject({ result: "pass", violation: false });
  });

  it("§16.3 and §11.4.5: an assertion fails when its expression is 0 or x; x != x is x", () => {
    const neq = { kind: "inv", expr: { kind: "eq", left: { kind: "var", name: "not_a" }, right: { kind: "var", name: "a" } } } as const;
    expect(exprText(neq)).toBe("not_a != a");
    expect(evaluate(neq, { a: "X", not_a: "X" })).toBe("X");
    expect(evaluate(neq, { a: 1, not_a: "X" })).toBe("X");
    expect(evaluate(neq, { a: 1, not_a: 1 })).toBe(0);
    expect(evaluate(neq, { a: 1, not_a: 0 })).toBe(1);
    const a: CheckSpec = { kind: "assertion", id: "a2", label: "a2", form: "observed", condition: neq };
    expect(evaluateCheck({}, a, { a: "X", not_a: "X" })).toMatchObject({ result: "fail", violation: true, finding: "not_a != a is x" });
    expect(evaluateCheck({}, a, { a: 1, not_a: 0 })).toMatchObject({ result: "pass", violation: false });
  });

  it("Table 9-2: negedge is 1 → 0/x or x → 0; posedge is 0 → 1/x or x → 1", () => {
    expect(isEdge("negedge", "X", 0)).toBe(true);
    expect(isEdge("negedge", 1, 0)).toBe(true);
    expect(isEdge("negedge", 0, "X")).toBe(false);
    expect(isEdge("posedge", "X", 1)).toBe(true);
    expect(isEdge("posedge", "X", 0)).toBe(false);
    expect(isEdge("posedge", 1, 1)).toBe(false);
  });
});

describe("sv-deferred-report-model: assertion control bits (IEEE 1800-2023 §20.11, Tables 20-5 and 20-6)", () => {
  it("Table 20-6: 224 = 32 + 64 + 128 selects Unique, Unique0 and Priority; 15 selects the four assertion kinds", () => {
    expect(assertionTypeSum(224)).toBe("32 + 64 + 128");
    expect(describeAssertionType(224)).toBe("Unique | Unique0 | Priority");
    expect(describeAssertionType(15)).toBe("Concurrent | SimpleImmediate | ObservedDeferredImmediate | FinalDeferredImmediate");
  });

  it("Table 20-6: each check maps to its own bit", () => {
    const cond = { kind: "var", name: "a" } as const;
    expect(assertionTypeBit({ kind: "violation", id: "u", label: "u", qualifier: "unique", construct: "if", conditions: [cond] })).toBe(32);
    expect(assertionTypeBit({ kind: "violation", id: "u", label: "u", qualifier: "unique0", construct: "if", conditions: [cond] })).toBe(64);
    expect(assertionTypeBit({ kind: "violation", id: "u", label: "u", qualifier: "priority", construct: "if", conditions: [cond] })).toBe(128);
    expect(assertionTypeBit({ kind: "assertion", id: "a", label: "a", form: "immediate", condition: cond })).toBe(2);
    expect(assertionTypeBit({ kind: "assertion", id: "a", label: "a", form: "observed", condition: cond })).toBe(4);
    expect(assertionTypeBit({ kind: "assertion", id: "a", label: "a", form: "final", condition: cond })).toBe(8);
  });
});

describe("sv-deferred-report-model: violation report queues and flush points (IEEE 1800-2023 §12.4.2.1, §12.5.3.1)", () => {
  it("reset-nba-flush: both F2C decoders queue a report with state = x, the NBA update of state re-triggers each (a flush point), and nothing is printed in any order (§12.5.3.1)", () => {
    const scenario = buildDeferredScenario("reset-nba-flush");
    expect(scenario.procedures.filter((p) => p.kind === "always_comb").map((p) => p.label)).toEqual(["next-state decoder", "output decoder"]);
    const ex = exploreDeferred(scenario);
    // 3! orders of bench and the two time-0 runs, times 2 orders of the two re-triggered decoders.
    expect(ex.runCount).toBe(12);
    expect(ex.outcomes).toHaveLength(1);
    for (const run of ex.runs) {
      expect(run.reports).toEqual([]);
      expect([...run.tickets].sort((a, b) => a.checkId.localeCompare(b.checkId))).toEqual([
        expect.objectContaining({ checkId: "next", detail: "state = x", status: "flushed" }),
        expect.objectContaining({ checkId: "out", detail: "state = x", status: "flushed" }),
      ]);
      expect(run.steps.filter((s) => s.kind === "flush").map((s) => s.procedureId).sort()).toEqual(["next", "out"]);
      const kinds = run.steps.map((s) => s.kind);
      // Queued in Active, then two NBA updates, then the flush, then Observed with nothing pending.
      expect(kinds.indexOf("check")).toBeLessThan(kinds.indexOf("flush"));
      expect(kinds.lastIndexOf("update")).toBeLessThan(kinds.indexOf("flush"));
      expect(kinds.indexOf("flush")).toBeLessThan(kinds.indexOf("observed"));
    }
    const flush = ex.runs[0].steps.find((s) => s.kind === "flush")!;
    expect(flush.text).toBe("next-state decoder resumes: an always_comb resumed by a change of an input (state x → RED) reaches a flush point. Its queue is cleared, so 1 pending report is discarded: unique case (state) (state = x).");
    expect(flush.clauses).toEqual(["§12.5.3.1"]);
    expect(flush.trays.next).toEqual([expect.objectContaining({ status: "flushed" })]);
    // The output decoder's queue is its own: it still holds its report until it is re-triggered.
    expect(flush.trays.out).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(ex.runs[0].steps.find((s) => s.kind === "observed")?.text).toBe("Observed region: no report is pending, so nothing matures and nothing is reported.");
  });

  it("reset-delayed-matures: with the reset waiting #1, no flush point comes, and each decoder's report matures in Observed (§12.5.3.1)", () => {
    const scenario = buildDeferredScenario("reset-delayed-matures");
    const ex = exploreDeferred(scenario);
    expect(ex.runCount).toBe(6);
    expect(ex.outcomes).toHaveLength(1);
    for (const run of ex.runs) {
      expect(run.reports).toEqual([
        expect.objectContaining({ kind: "violation", certain: true, stage: "observed", text: "next-state decoder: unique case (state) violation, state = x" }),
        expect.objectContaining({ kind: "violation", certain: true, stage: "observed", text: "output decoder: unique case (state) violation, state = x" }),
      ]);
      expect(run.steps.some((s) => s.kind === "flush")).toBe(false);
      expect(run.steps.find((s) => s.kind === "suspend")?.text).toBe("bench suspends on #1: the rest of it runs at t = 1 ns, not in this slot (§9.4.1).");
    }
    const observed = ex.runs[0].steps.find((s) => s.kind === "observed")!;
    expect(observed.text).toContain("2 pending violation reports mature and can no longer be flushed: next-state decoder's unique case (state) (state = x) and output decoder's unique case (state) (state = x).");
    expect(observed.clauses).toEqual(["§12.5.3.1"]);
  });

  it("lrm-unique-glitch: the standard's a / not_a example; when a1 runs first it queues an overlap report that its re-run flushes (§12.4.2.1)", () => {
    const scenario = buildDeferredScenario("lrm-unique-glitch");
    expect(certainCounts(scenario)).toEqual([0]);
    const glitch = runWhere(scenario, /^a1 before/);
    expect(glitch.tickets).toEqual([expect.objectContaining({ detail: "a = 1, not_a = 1", status: "flushed" })]);
    const check = glitch.steps.find((s) => s.kind === "check")!;
    expect(check.text).toContain("2 conditions are true at once (a and not_a): they overlap");
    expect(check.clauses).toEqual(["§12.4.2", "§12.4.2.1"]);
    const settled = runWhere(scenario, /^not_a block before/);
    expect(settled.tickets).toEqual([]);
  });

  it("loop-flush: each iteration checks on its own, and one re-run of a1 flushes every pending iteration report (§12.4.2.1)", () => {
    const scenario = buildDeferredScenario("loop-flush");
    expect(certainCounts(scenario)).toEqual([0]);
    const glitch = runWhere(scenario, /^a1 before/);
    expect(glitch.tickets.map((t) => [t.checkId, t.status])).toEqual([
      ["u0", "flushed"],
      ["u2", "flushed"],
    ]);
    expect(glitch.steps.find((s) => s.kind === "flush" && s.text.includes("are discarded"))?.text).toContain("2 pending reports are discarded");
  });

  it("two-callers: a check in a function belongs to each calling process, so b1 and b2 each report (§12.4.2.2)", () => {
    const scenario = buildDeferredScenario("two-callers");
    const ex = exploreDeferred(scenario);
    expect(ex.outcomes).toHaveLength(1);
    const run = ex.runs[0];
    expect(run.reports.map((r) => r.text)).toEqual(["b1: a1 in f1 violation, c = 1, d = 1", "b2: a1 in f1 violation, e = 1, f = 1"]);
    const checks = run.steps.filter((s) => s.kind === "check");
    expect(checks.map((s) => s.procedureId)).toEqual(["b1", "b2"]);
    expect(checks.every((s) => s.clauses.includes("§12.4.2.2"))).toBe(true);
    expect(checks.every((s) => s.lineKey === "f1-a1")).toBe(true);
  });

  it("a resume after a delay is not narrated as a flush point (§12.4.2.1 lists event controls and wait only)", () => {
    const run = analyzeRun(buildDeferredScenario("two-callers"));
    expect(run.steps.find((s) => s.procedureId === "stim" && s.kind === "run")?.text).toBe("stimulus starts: its delay has expired at t = 10 ns; resuming after a delay is not a flush point.");
  });
});

describe("sv-deferred-report-model: $assertcontrol Off and Kill (IEEE 1800-2023 §20.11)", () => {
  it("Off before both decoders' first checks: no new report joins either queue (§20.11)", () => {
    const scenario = buildDeferredScenario("assertcontrol-race", { controlType: 4 });
    const run = runWhere(scenario, /^control initial first/);
    expect(run.tickets).toEqual([]);
    expect(run.blocked).toEqual([expect.objectContaining({ status: "blocked", detail: "state = x" }), expect.objectContaining({ status: "blocked", detail: "state = x" })]);
    expect(run.reports).toEqual([]);
  });

  it("Off after both decoders' first checks: the queued reports are not flushed and may still mature, so they are shown as possible, not certain (§20.11)", () => {
    const scenario = buildDeferredScenario("assertcontrol-race", { controlType: 4 });
    const run = runWhere(scenario, /^output decoder before control initial/);
    expect(run.tickets).toEqual([expect.objectContaining({ status: "maybe" }), expect.objectContaining({ status: "maybe" })]);
    expect(run.reports.map((r) => r.certain)).toEqual([false, false]);
    expect(run.steps.find((s) => s.kind === "control")?.text).toContain('stays and "may still mature"; no new report is queued until On (§20.11)');
    expect(reportCount(scenario, run)).toEqual({ certain: 0, possible: 2 });
  });

  it("Off between the two decoders' first checks: one report is kept and may mature, the other is kept off the queue (§20.11)", () => {
    const scenario = buildDeferredScenario("assertcontrol-race", { controlType: 4 });
    const run = runWhere(scenario, /^control initial before output decoder/);
    expect(run.picks[0]).toBe("next-state decoder first");
    expect(run.tickets).toEqual([expect.objectContaining({ checkId: "next", status: "maybe" })]);
    expect(run.blocked).toEqual([expect.objectContaining({ checkId: "out", status: "blocked" })]);
    expect(reportCount(scenario, run)).toEqual({ certain: 0, possible: 1 });
  });

  it("Kill after a decoder's first check flushes the report that has not matured; nothing is printed in any order (§20.11)", () => {
    const scenario = buildDeferredScenario("assertcontrol-race", { controlType: 5 });
    const ex = exploreDeferred(scenario);
    expect(ex.runCount).toBe(6);
    expect(ex.outcomes).toHaveLength(1);
    const run = runWhere(scenario, /^output decoder before control initial/);
    expect(run.tickets).toEqual([expect.objectContaining({ status: "killed" }), expect.objectContaining({ status: "killed" })]);
    expect(run.steps.find((s) => s.kind === "control")?.text).toContain("Kill flushes queued reports that have not matured");
  });

  it("Kill: the run shown first is one where Kill flushes a queued report, not only one where Kill keeps reports off the queue (§20.11)", () => {
    const scenario = buildDeferredScenario("assertcontrol-race", { controlType: 5 });
    const ex = exploreDeferred(scenario);
    const shown = richestRun(ex.runs);
    expect(shown.tickets.map((t) => t.status)).toContain("killed");
    const fates = fateSentences(scenario, shown);
    expect(fates.some((f) => f.includes("was flushed by $assertcontrol Kill before it matured (§20.11)"))).toBe(true);
    expect(fates.some((f) => f.includes("kept it off the queue (§20.11)"))).toBe(true);
    const correct = buildPrediction(scenario, ex).options.find((o) => o.correct)!;
    expect(correct.feedback).toContain("was flushed by $assertcontrol Kill before it matured (§20.11)");
  });

  it("the $assertcontrol step names the Table 20-5 control and the Table 20-6 mask", () => {
    const run = analyzeRun(buildDeferredScenario("assertcontrol-race", { controlType: 4 }));
    expect(run.steps.find((s) => s.kind === "control")?.text).toMatch(/^\$assertcontrol\(4, 224\) runs: Off \(Table 20-5\) for assertion_type 224 = 32 \+ 64 \+ 128, Unique \| Unique0 \| Priority \(Table 20-6\)\./);
  });
});

describe("sv-deferred-report-model: deferred assertions (IEEE 1800-2023 §16.3, §16.4.1, §16.4.2)", () => {
  it("§16.3: a simple immediate assertion reports each failing run at once, so its count depends on the order (1 or 2)", () => {
    const scenario = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: false });
    expect(certainCounts(scenario, "a1")).toEqual([1, 2]);
    const glitch = runWhere(scenario, /^b1 before assign not_a/);
    expect(glitch.reports.filter((r) => r.kind === "immediate").map((r) => r.text)).toEqual(["a1 failed: $error at once, with not_a = x, a = x", "a1 failed: $error at once, with not_a = x, a = 1"]);
  });

  it("§16.4.2: with a written by <=, the NBA update re-triggers b1 before Observed, so the #0 and final reports are flushed", () => {
    const scenario = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: false });
    expect(certainCounts(scenario, "a2")).toEqual([0]);
    expect(certainCounts(scenario, "a3")).toEqual([0]);
  });

  it("§16.4.1: when Reactive code writes a, the #0 report has already matured in Observed and its $error runs in Reactive: the observed form glitches", () => {
    const scenario = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: true });
    expect(certainCounts(scenario, "a2")).toEqual([1]);
    const run = exploreDeferred(scenario).runs[0];
    const a2 = run.reports.find((r) => r.checkId === "a2")!;
    expect(a2).toMatchObject({ kind: "observed", stage: "reactive", text: "a2 failed: $error in Reactive, with not_a = x, a = x from when it was queued" });
    const kinds = run.steps.map((s) => s.kind);
    expect(kinds.indexOf("observed")).toBeLessThan(kinds.indexOf("reactive"));
    expect(run.steps.find((s) => s.kind === "reactive")?.clauses).toEqual(["§16.4.1"]);
  });

  it("§16.4.1: the final form matures only in Postponed, which does not loop, so the later re-run of b1 flushes it and it never glitches", () => {
    const scenario = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: true });
    expect(certainCounts(scenario, "a3")).toEqual([0]);
    const run = exploreDeferred(scenario).runs[0];
    expect(run.tickets.filter((t) => t.checkId === "a3").map((t) => t.status)).toContain("flushed");
    expect(run.steps.find((s) => s.kind === "postponed")?.text).toBe("Postponed region: no final deferred report is pending, so nothing matures here (§16.4.1).");
  });

  it("§16.4.1: a final report that is never flushed matures in Postponed and its $error is scheduled there", () => {
    // Remove the re-triggered run: only the time-0 run of b1 executes, with a = x.
    const base = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: false });
    const scenario: DeferredScenario = {
      ...base,
      scheduler: { ...base.scheduler, processes: base.scheduler.processes.filter((p) => p.id !== "TB") },
    };
    const run = analyzeRun(scenario);
    expect(run.reports.map((r) => [r.checkId, r.stage])).toEqual([
      ["a1", "active"],
      ["a2", "reactive"],
      ["a3", "postponed"],
    ]);
    expect(run.steps.find((s) => s.kind === "postponed")?.text).toContain("the $error is scheduled in this same Postponed region (§16.4.1)");
  });

  it("count lines give each form's count from the run", () => {
    const scenario = buildDeferredScenario("assert-forms-glitch", { reactiveWritesA: true });
    const run = runWhere(scenario, /^b1 before assign not_a/);
    expect(countLines(scenario, run).map((l) => l.text)).toEqual(["a1 (immediate): 2 failure reports", "a2 (#0): 1 failure report", "a3 (final): no failure report"]);
  });
});

describe("sv-deferred-report-model: order exploration (IEEE 1800-2023 §4.7, §9.2.2.2)", () => {
  it("the time-0 choice between an initial and always_comb's time-0 run cites §9.2.2.2 and §4.7", () => {
    const run = analyzeRun(buildDeferredScenario("reset-nba-flush"));
    const choice = run.steps.find((s) => s.kind === "choice")!;
    expect(choice.clauses).toEqual(["§4.7", "§9.2.2.2"]);
    expect(choice.text).toContain("The time-0 runs of next-state decoder and output decoder are triggered after every initial and always procedure has started (§9.2.2.2)");
  });

  it("assertcontrol-race with Off has four outcomes (no report, either decoder's, or both may print); with Kill, one", () => {
    expect(exploreDeferred(buildDeferredScenario("assertcontrol-race", { controlType: 4 })).outcomes).toHaveLength(4);
    expect(exploreDeferred(buildDeferredScenario("assertcontrol-race", { controlType: 5 })).outcomes).toHaveLength(1);
  });
});

describe("sv-deferred-report-model: predictions are answered by the model", () => {
  const answer = (id: DeferredPresetId, options: PresetOptions = {}, focus?: string) => {
    const scenario = buildDeferredScenario(id, options);
    const p = buildPrediction(scenario, exploreDeferred(scenario), focus);
    const correct = p.options.filter((o) => o.correct);
    expect(correct).toHaveLength(1);
    return { label: correct[0].label, p };
  };

  it("each preset has exactly one correct option, matching the counts the model gives", () => {
    expect(answer("reset-nba-flush").label).toBe("No violation report");
    expect(answer("reset-delayed-matures").label).toBe("2 violation reports");
    expect(answer("lrm-unique-glitch").label).toBe("No violation report");
    expect(answer("loop-flush").label).toBe("No violation report");
    expect(answer("two-callers").label).toBe("2 violation reports");
    expect(answer("assertcontrol-race", { controlType: 4 }).label).toBe("It depends on the order the scheduler picks");
    expect(answer("assertcontrol-race", { controlType: 5 }).label).toBe("No violation report");
    expect(answer("assert-forms-glitch", { reactiveWritesA: false }, "a1").label).toBe("It depends on the order the scheduler picks");
    expect(answer("assert-forms-glitch", { reactiveWritesA: false }, "a2").label).toBe("No failure report");
    expect(answer("assert-forms-glitch", { reactiveWritesA: true }, "a2").label).toBe("1 failure report");
    expect(answer("assert-forms-glitch", { reactiveWritesA: true }, "a3").label).toBe("No failure report");
  });

  it("the question names the slot time computed from the scenario", () => {
    expect(answer("reset-nba-flush").p.question).toBe("How many violation reports does time slot t = 0 ns print?");
    expect(answer("two-callers").p.question).toBe("How many violation reports does time slot t = 10 ns print?");
    expect(answer("assert-forms-glitch", {}, "a2").p.question).toBe("How many failure reports does a2 produce in time slot t = 0 ns?");
  });

  it("feedback explains with the model's own fates: a wrong '1' on reset-nba-flush names the flush", () => {
    const { p } = answer("reset-nba-flush");
    const one = p.options.find((o) => o.id === "count-1")!;
    expect(one.feedback).toContain("was discarded when next-state decoder ran again, a flush point (§12.5.3.1)");
    expect(p.options.find((o) => o.correct)?.feedback).toMatch(/^Every order the model ran \(12\) gives no violation report\./);
    expect(one.feedback).toContain("was discarded when output decoder ran again, a flush point (§12.5.3.1)");
  });

  it("reset-delayed-matures: a wrong '1' names each decoder's own queue (§12.5.3.1)", () => {
    const { p } = answer("reset-delayed-matures");
    const one = p.options.find((o) => o.id === "count-1")!;
    expect(one.correct).toBe(false);
    expect(one.feedback).toMatch(/^Too few: each process has its own violation report queue \(§12\.5\.3\.1\), and next-state decoder and output decoder each keep a pending report/);
  });

  it("the Off race's answer lists every outcome's order", () => {
    const { p } = answer("assertcontrol-race", { controlType: 4 });
    expect(p.answer).toBe("no violation report or no violation report, plus 1 violation report that may be printed or no violation report, plus 2 violation reports that may be printed");
    const feedback = p.options.find((o) => o.correct)!.feedback;
    expect(feedback).toContain("control initial first; next-state decoder before output decoder: no violation report.");
    expect(feedback).toContain("next-state decoder first; output decoder before control initial: no violation report, plus 2 violation reports that may be printed");
  });
});

describe("sv-deferred-report-model: scenario data", () => {
  it.each(VARIANTS)("$id $options: validates, every statement and check sits on a shown line, and every step has a stage", ({ id, options }) => {
    const scenario = buildDeferredScenario(id, options);
    expect(() => validateDeferredScenario(scenario)).not.toThrow();
    const keys = sourceKeys(scenario);
    for (const process of scenario.scheduler.processes) {
      for (const stmt of process.body) {
        expect(keys).toContain(scenario.lineOf[stmt.id] ?? stmt.id);
      }
    }
    for (const proc of scenario.procedures) proc.lineKeys.forEach((k) => expect(keys).toContain(k));
    // Every check's condition text appears on its line.
    for (const process of scenario.scheduler.processes) {
      for (const stmt of process.body) {
        if (stmt.kind !== "check") continue;
        const check = scenario.checks[scenario.checkOf[stmt.id] ?? stmt.id];
        const line = scenario.source.find((l) => l.key === (scenario.lineOf[stmt.id] ?? stmt.id))!;
        if (check.kind === "assertion") expect(line.text).toContain(exprText(check.condition));
        if (check.kind === "violation" && check.construct === "case") expect(line.text).toContain(`case (${check.select})`);
      }
    }
    const run = analyzeRun(scenario);
    expect(run.steps[0].kind).toBe("start");
    expect(run.steps[run.steps.length - 1].kind).toBe("end");
    expect(run.steps.filter((s) => s.kind === "observed").length).toBeGreaterThanOrEqual(1);
    expect(runSummary(scenario, run).length).toBeGreaterThan(20);
  });

  it("every preset is listed once with its lesson", () => {
    expect(DEFERRED_PRESETS.map((p) => p.id)).toEqual(["reset-nba-flush", "reset-delayed-matures", "lrm-unique-glitch", "loop-flush", "two-callers", "assertcontrol-race", "assert-forms-glitch"]);
    expect(DEFERRED_PRESETS.filter((p) => p.lesson === "F3B").map((p) => p.id)).toEqual(["assert-forms-glitch"]);
  });

  it("rejects a check process with a delay, and a run that ends by $finish", () => {
    const base = buildDeferredScenario("lrm-unique-glitch");
    const withDelay: DeferredScenario = {
      ...base,
      scheduler: { ...base.scheduler, processes: base.scheduler.processes.map((p) => (p.id === "A1" ? { ...p, body: [{ kind: "delay0", id: "d0" }, ...p.body] } : p)) },
    };
    expect(() => validateDeferredScenario(withDelay)).toThrow(/not a flush point/);
    const withFinish: DeferredScenario = {
      ...base,
      scheduler: { ...base.scheduler, processes: base.scheduler.processes.map((p) => (p.id === "STIM" ? { ...p, body: [...p.body, { kind: "finish", id: "f" }] } : p)) },
    };
    expect(() => analyzeRun(withFinish)).toThrow();
  });

  it("the flop's wake is checked against Table 9-2: rst_n x → 0 is a negedge", () => {
    const run = analyzeRun(buildDeferredScenario("reset-nba-flush"));
    expect(run.steps.find((s) => s.procedureId === "flop" && s.kind === "run")?.text).toBe("flop resumes from its event control: rst_n x → 0, a negedge (Table 9-2).");
  });
});
