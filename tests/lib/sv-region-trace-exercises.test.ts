import { describe, expect, it } from "vitest";

import {
  KATA_LINE_IDS,
  KATA_PRINTS,
  REGION_TRACE_ASSUMPTIONS,
  WORKED_CHANGES,
  WORKED_PRINTS,
  exploreScenario,
  finishPoints,
  gradeKata,
  gradeLogOrder,
  kataDValue,
  kataExpectedRegions,
  kataExplanation,
  kataKey,
  kataLineCode,
  kataListing,
  kataLog,
  kataOrderReason,
  kataReason,
  kataSampledOptions,
  kataScenario,
  legalOrdersText,
  legalPrintOrders,
  listingExcerpt,
  logOrderKey,
  longestCommonSubsequence,
  outcomeCards,
  printedText,
  startingChipOrder,
  survivalOf,
  traceRowSummary,
  variantOptions,
  variantOutcomeText,
  workedExampleListing,
  workedExampleScenario,
  workedLessonPrintOrder,
  workedLessonRun,
  workedTraceRows,
} from "@/lib/sv-region-trace-exercises";
import { REGION_LABELS, exploreOrderings, findProcessStatement, simulateTimeSlot, statementToSource } from "@/lib/sv-scheduler-model";

const names = (ids: readonly string[], prints = WORKED_PRINTS) => ids.map((id) => prints.find((p) => p.id === id)?.name);

describe("worked example: the lesson's trace table (IEEE 1800-2023 §4.4.2, §4.5)", () => {
  // The lesson's table: step, region, q and y after, what prints.
  const LESSON_TABLE: [number, string, number, number, string[]][] = [
    [0, "preponed", 0, 0, []],
    [1, "active", 0, 0, []],
    [2, "active", 0, 0, []],
    [3, "active", 0, 0, ["5 ACTIVE q=0 y=0"]],
    [4, "inactive", 0, 0, ["5 INACT  q=0 y=0"]],
    [5, "nba", 1, 0, []],
    [6, "active", 1, 1, []],
    [7, "observed", 1, 1, []],
    [8, "reactive", 1, 1, ["5 REACT  q=1 y=1"]],
    [9, "reactive", 1, 1, ["5 ACTION $sampled(q)=0 q=1"]],
    [10, "postponed", 1, 1, ["5 POSTP  q=1 y=1"]],
  ];

  it("reproduces every row of the lesson's table: region, q and y after, and the printed line", () => {
    const rows = workedTraceRows();
    expect(rows.map((r) => [r.step, r.region, r.q, r.y, r.prints])).toEqual(LESSON_TABLE);
  });

  it("every model step belongs to exactly one row, and the rows cover the whole run in order", () => {
    const rows = workedTraceRows();
    const run = workedLessonRun();
    const covered = rows.flatMap((r) => r.modelSteps);
    expect(covered).toEqual(run.trace.map((s) => s.index));
    rows.forEach((r) => expect(r.modelSteps.length).toBeGreaterThan(0));
  });

  it("the lesson's run takes always_ff before the initial (§4.7: steps 2 and 3 may swap) and the program thread before the pass action (steps 8 and 9)", () => {
    const run = workedLessonRun();
    const order = run.executionOrder;
    expect(order.indexOf("FF")).toBeLessThan(order.indexOf("TB"));
    const reactPrint = run.trace.findIndex((s) => s.stmtId === "r1" && s.kind === "print");
    const actionPrint = run.trace.findIndex((s) => s.stmtId === "a1" && s.kind === "print");
    expect(reactPrint).toBeLessThan(actionPrint);
  });

  it("the row summary is built from the row's model values", () => {
    const row = workedTraceRows()[5];
    expect(traceRowSummary(row)).toBe("Step 5, NBA: q takes its new value; the update wakes assign y = q. After it, q = 1 and y = 0.");
    expect(traceRowSummary(workedTraceRows()[3])).toMatch(/Prints 5 ACTIVE q=0 y=0\.$/);
  });

  it("the step excerpt holds the row's active and context lines, numbered as in the full listing", () => {
    const listing = workedExampleListing();
    const row = workedTraceRows()[3];
    const excerpt = listingExcerpt(listing, row.codeKey, row.contextKeys);
    expect(excerpt.map((l) => l.number)).toEqual(["t-wait", "t1", "t3"].map((k) => listing.findIndex((l) => l.key === k) + 1));
    expect(excerpt.filter((l) => l.active).map((l) => l.text)).toEqual([listing.find((l) => l.key === "t1")?.text.trim()]);
    for (const r of workedTraceRows()) expect(listingExcerpt(listing, r.codeKey, r.contextKeys).some((l) => l.active)).toBe(true);
  });

  it("every highlighted code key exists in the listing", () => {
    const keys = new Set(workedExampleListing().map((l) => l.key).filter(Boolean));
    for (const row of workedTraceRows()) {
      expect(keys.has(row.codeKey)).toBe(true);
      row.contextKeys.forEach((k) => expect(keys.has(k)).toBe(true));
    }
  });
});

describe("worked example: the listing matches the model's statements", () => {
  it("each keyed line carries the statement the model runs", () => {
    for (const variant of ["as-written", ...WORKED_CHANGES] as const) {
      const scenario = workedExampleScenario(variant);
      for (const line of workedExampleListing(variant)) {
        const stmt = line.key ? findProcessStatement(scenario, line.key) : undefined;
        if (stmt && stmt.kind !== "finish") expect(line.text).toContain(statementToSource(stmt));
      }
    }
  });

  it("each change edits only the lesson's line: #1 dropped, the program's trailing wait deleted, plain q printed", () => {
    expect(workedExampleListing("finish-now").find((l) => l.changed)?.text).toMatch(/^\s+\$finish;/);
    expect(workedExampleListing().some((l) => l.key === "r-tail")).toBe(true);
    expect(workedExampleListing("no-second-wait").some((l) => l.key === "r-tail")).toBe(false);
    expect(workedExampleListing("plain-q").find((l) => l.changed)?.text).toContain('$display("%0d ACTION q=%0d", $time, q);');
    expect(workedExampleListing().filter((l) => l.changed)).toHaveLength(0);
  });
});

describe("worked example: log order (§4.7 REACT and ACTION, both Reactive, in either order)", () => {
  const legal = legalPrintOrders(workedExampleScenario());

  it("the model finds exactly two orders, differing only in REACT and ACTION", () => {
    expect(legal.map((l) => names(l))).toEqual([
      ["ACTIVE", "INACT", "ACTION", "REACT", "POSTP"],
      ["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"],
    ]);
  });

  const key = logOrderKey(workedExampleScenario());

  it("an order short of a legal one is told which lines are missing, never an empty list", () => {
    const short = gradeLogOrder(["t1", "t3", "r1", "a1"], key, WORKED_PRINTS);
    expect(short.correct).toBe(false);
    expect(Object.values(short.marks).every((m) => m === "correct")).toBe(true);
    expect(short.feedback).toBe(`Not quite: POSTP is missing. ${legalOrdersText(legal, WORKED_PRINTS)}`);
    expect(short.feedback).not.toMatch(/:\s+are out of place/);
  });

  it("the key carries the model's legal orders and the region each line prints in (§4.4.2)", () => {
    expect(key.legal).toEqual(legal);
    expect(key.regions).toEqual({ t1: "active", t3: "inactive", r1: "reactive", a1: "reactive", t4: "postponed" });
  });

  it("accepts REACT and ACTION in either order, with every chip marked correct", () => {
    for (const order of [
      ["t1", "t3", "r1", "a1", "t4"],
      ["t1", "t3", "a1", "r1", "t4"],
    ]) {
      const grade = gradeLogOrder(order, key, WORKED_PRINTS);
      expect(grade.correct).toBe(true);
      expect(Object.values(grade.marks).every((m) => m === "correct")).toBe(true);
      expect(grade.closest).toEqual(order);
      expect(grade.reasons).toEqual({});
      expect(grade.feedback).toBe(`Correct. ${legalOrdersText(legal, WORKED_PRINTS)}`);
    }
  });

  it("one misplaced chip marks only that chip, and the reason comes from the region it prints in (§4.4.2.9)", () => {
    const wrong = gradeLogOrder(["t1", "t4", "t3", "r1", "a1"], key, WORKED_PRINTS);
    expect(wrong.correct).toBe(false);
    expect(wrong.marks).toEqual({ t1: "correct", t4: "wrong", t3: "correct", r1: "correct", a1: "correct" });
    expect(names(wrong.closest)).toEqual(["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"]);
    expect(wrong.reasons).toEqual({ t4: "POSTP prints in Postponed, the last region of the slot (§4.4.2.9), so it comes after INACT (Inactive), REACT (Reactive) and ACTION (Reactive)." });
    expect(wrong.feedback).toBe(`Not quite: POSTP is out of place. ${wrong.reasons.t4} The model finds two legal print orders: ACTIVE, INACT, ACTION, REACT, POSTP; or ACTIVE, INACT, REACT, ACTION, POSTP.`);
  });

  it("a chip placed too late is told what it must come before", () => {
    const wrong = gradeLogOrder(["t3", "r1", "t1", "a1", "t4"], key, WORKED_PRINTS);
    expect(Object.entries(wrong.marks).filter(([, m]) => m === "wrong").map(([id]) => id)).toEqual(["t1"]);
    expect(wrong.reasons.t1).toBe("ACTIVE prints in Active (§4.4.2.2), so it comes before INACT (Inactive) and REACT (Reactive).");
  });

  it("the REACT and ACTION pair is never given as a reason: §4.7 leaves their order open", () => {
    const wrong = gradeLogOrder(["t1", "a1", "t4", "r1", "t3"], key, WORKED_PRINTS);
    for (const reason of Object.values(wrong.reasons)) {
      expect(reason).not.toMatch(/^REACT.*ACTION \(|^ACTION.*REACT \(/);
    }
  });

  it("longestCommonSubsequence keeps the chips already in the right relative order", () => {
    expect(longestCommonSubsequence(["a", "d", "b", "c"], ["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(longestCommonSubsequence([], ["a"])).toEqual([]);
  });

  it("the legal orders sentence says print orders, in words", () => {
    expect(legalOrdersText(legal, WORKED_PRINTS)).toMatch(/^The model finds two legal print orders: /);
    expect(legalOrdersText(legalPrintOrders(kataScenario()), KATA_PRINTS)).toBe("The model finds one legal print order: A, B, D, C.");
  });

  it("the order the trace table follows is one of the legal orders: REACT before ACTION", () => {
    const traced = workedLessonPrintOrder();
    expect(legal.some((l) => l.join() === traced.join())).toBe(true);
    expect(names(traced)).toEqual(["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"]);
  });

  it("the chips start in an order that is not legal, and carry no printed value", () => {
    const start = startingChipOrder(WORKED_PRINTS, legal);
    expect(legal.some((l) => l.join() === start.join())).toBe(false);
    WORKED_PRINTS.forEach((p) => expect(`${p.name} ${p.source}`).not.toMatch(/=\d/));
  });

  it("outcome cards: two groups, each counting both orders of always_ff and the initial in Active", () => {
    const { cards, runCount } = outcomeCards(workedExampleScenario(), WORKED_PRINTS);
    expect(runCount).toBe(exploreOrderings(workedExampleScenario()).runCount);
    expect(cards.map((c) => c.title)).toEqual(["ACTION first", "REACT first"]);
    expect(cards.reduce((n, c) => n + c.runCount, 0)).toBe(runCount);
    cards.forEach((c) => expect(c.runCount).toBe(2));
    // Pinned on their own, so a change in the shared scheduler cannot move both sides of the sum unnoticed.
    expect(runCount).toBe(4);
    expect(exploreScenario(kataScenario()).runCount).toBe(2);
    expect(cards[1].lines.map((l) => l.text)).toEqual(["5 ACTIVE q=0 y=0", "5 INACT  q=0 y=0", "5 REACT  q=1 y=1", "5 ACTION $sampled(q)=0 q=1", "5 POSTP  q=1 y=1"]);
    expect(cards[0].endState).toBe("q = 1, y = 1");
  });

  it("printedText drops only the model's task prefix", () => {
    expect(printedText("$strobe: 5 POSTP  q=1 y=1")).toBe("5 POSTP  q=1 y=1");
  });
});

describe("worked example: $finish without #1 (IEEE 1800-2023 §20.2, §9.2.3)", () => {
  it("only ACTIVE and INACT print: the run ends at trace step 4, in the Inactive pass", () => {
    const survival = survivalOf(workedExampleScenario("finish-now"), WORKED_PRINTS);
    expect(survival).toEqual({ t1: "always", t3: "always", t4: "never", r1: "never", a1: "never" });
    expect(finishPoints(workedExampleScenario("finish-now"))).toEqual([{ cause: "finish", region: "inactive", processLabel: "initial", traceStep: 4 }]);
    expect(variantOutcomeText("finish-now")).toBe(
      "$finish in the initial procedure ends the run during the Inactive pass, at trace step 4, and no remaining scheduled event executes (§20.2, §9.2.3). Printed in every order: ACTIVE and INACT; never printed: POSTP, REACT and ACTION.",
    );
  });

  it("the NBA update never happens, so q and y stay 0", () => {
    expect(outcomeCards(workedExampleScenario("finish-now"), WORKED_PRINTS).cards).toMatchObject([{ title: "POSTP, REACT and ACTION do not print", endState: "q = 0, y = 0" }]);
  });
});

describe("worked example: the implicit $finish when the last program thread ends (IEEE 1800-2023 §24.3, §4.7)", () => {
  it("POSTP disappears, and ACTION survives only in the order that ran it first", () => {
    const survival = survivalOf(workedExampleScenario("no-second-wait"), WORKED_PRINTS);
    expect(survival).toEqual({ t1: "always", t3: "always", t4: "never", r1: "always", a1: "some-orders" });
    expect(finishPoints(workedExampleScenario("no-second-wait"))).toEqual([{ cause: "implicit-finish", region: "reactive", processLabel: "tb_prog thread", traceStep: 8 }]);
    const { cards } = outcomeCards(workedExampleScenario("no-second-wait"), WORKED_PRINTS);
    expect(cards.map((c) => [c.title, c.lines.map((l) => l.text)])).toEqual([
      ["ACTION first; POSTP does not print", ["5 ACTIVE q=0 y=0", "5 INACT  q=0 y=0", "5 ACTION $sampled(q)=0 q=1", "5 REACT  q=1 y=1"]],
      ["REACT first; POSTP and ACTION do not print", ["5 ACTIVE q=0 y=0", "5 INACT  q=0 y=0", "5 REACT  q=1 y=1"]],
    ]);
  });

  it("the as-written bench never ends inside the slot: the trailing wait keeps the program alive", () => {
    expect(finishPoints(workedExampleScenario())).toEqual([]);
    expect(variantOutcomeText("as-written")).toMatch(/^Nothing ends the run inside this slot/);
  });
});

describe("worked example: plain q in the pass action (IEEE 1800-2023 §16.5.1, §16.9.3, §4.4.2.6)", () => {
  it("prints ACTION q=1 for a check that passed on the sample q = 0", () => {
    expect(survivalOf(workedExampleScenario("plain-q"), WORKED_PRINTS)).toEqual({ t1: "always", t3: "always", t4: "always", r1: "always", a1: "always" });
    expect(variantOutcomeText("plain-q")).toContain("The pass action prints 5 ACTION q=1: a plain read returns the value current when the action runs in Reactive (§4.4.2.6, §16.14.1), although the property passed on the sample q = 0 (§16.5.1).");
  });
});

describe("worked example: the 'which lines survive?' options are graded by the model", () => {
  it("exactly one option per change is correct, and it is the one the model's run matches", () => {
    const correct = Object.fromEntries(WORKED_CHANGES.map((v) => [v, variantOptions(v).filter((o) => o.correct).map((o) => o.label)]));
    expect(correct).toEqual({
      "finish-now": ["ACTIVE and INACT"],
      "no-second-wait": ["ACTIVE, INACT and REACT, and ACTION only in some orders"],
      "plain-q": ['All five lines; the ACTION line reads "5 ACTION q=1"'],
    });
  });

  it("the wrong options are distinct and each explains its misconception with a clause", () => {
    for (const v of WORKED_CHANGES) {
      const options = variantOptions(v);
      expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
      options.forEach((o) => expect(o.feedback).toMatch(/§\d/));
    }
    expect(variantOptions("plain-q").map((o) => o.label)).toContain('All five lines; the ACTION line reads "5 ACTION q=0"');
  });

  it("the hand-written 'fails' label for plain q matches its survival set: ACTION never prints, the other four do", () => {
    const fails = variantOptions("plain-q").find((o) => o.id === "fails");
    expect(fails?.label).toMatch(/ACTION does not print/);
    expect(fails?.survival).toEqual({ t1: "always", t3: "always", t4: "always", r1: "always", a1: "never" });
    expect(fails?.correct).toBe(false);
  });
});

describe("kata: label the region (IEEE 1800-2023 §4.4.2, §4.9.1, §16.5.1, §16.9.3)", () => {
  it("reproduces the lesson's worked solution, line by line", () => {
    expect(kataExpectedRegions()).toEqual({
      L1: ["active", "nba"],
      L2: ["active"],
      L3: ["active"],
      L4: ["inactive"],
      L5: ["postponed"],
      L6: ["preponed", "observed", "reactive"],
    });
  });

  it("y = ~q is 1 before the edge (§4.9.1, evaluated at time zero), so the property passes on the sample y = 1", () => {
    const scenario = kataScenario();
    expect(scenario.initial.y).toBe(1);
    const run = simulateTimeSlot(scenario);
    expect(run.trace.find((s) => s.kind === "sample" && s.processId === "A")?.values.y).toBe(1);
    expect(run.trace.find((s) => s.assertion?.phase === "evaluate")).toMatchObject({ sourceRegion: "observed", assertion: { outcome: "pass" } });
    expect(kataLog()).toEqual(["A q=0 y=1", "B q=0 y=1", "D y=0", "C q=1 y=0"]);
  });

  it("the log order is A, B, D, C in every order the model runs, with D y=0", () => {
    expect(legalPrintOrders(kataScenario()).map((l) => names(l, KATA_PRINTS))).toEqual([["A", "B", "D", "C"]]);
    expect(kataDValue()).toBe(0);
    expect(kataOrderReason()).toBe("D prints in Reactive and C in Postponed, and Reactive comes first in the slot (§4.4.2.6, §4.4.2.9).");
  });

  it("$sampled(y) on L6 flips D to y=1 (§16.9.3) and changes nothing else", () => {
    expect(kataDValue(true)).toBe(1);
    expect(kataLog(true)).toEqual(["A q=0 y=1", "B q=0 y=1", "D y=1", "C q=1 y=0"]);
    expect(kataExpectedRegions(true)).toEqual(kataExpectedRegions());
    expect(kataListing(true).find((l) => l.key === "L6")?.text).toContain('$display("D y=%0d", $sampled(y));');
  });

  it("the picker code for L6 includes its assert property line, since Preponed and Observed belong to it", () => {
    expect(kataLineCode("L6")).toEqual(["a_y_high: assert property (@(posedge clk) y == 1'b1)", '$display("D y=%0d", y);']);
    expect(kataLineCode("L1")).toEqual(["always_ff @(posedge clk) q <= d;"]);
    expect(kataLineCode("L6", true)[1]).toBe('$display("D y=%0d", $sampled(y));');
  });

  it("a wrong kata order is explained from the print regions: C prints in Postponed, after D in Reactive", () => {
    const grade = gradeKata({ regions: {}, order: ["k3", "k4", "k5", "k6"], dValue: 0 });
    expect(grade.order.correct).toBe(false);
    expect(Object.entries(grade.order.marks).filter(([, m]) => m === "wrong")).toHaveLength(1);
    const [reason] = Object.values(grade.order.reasons);
    expect(reason).toMatch(/(C prints in Postponed, the last region of the slot \(§4\.4\.2\.9\), so it comes after D \(Reactive\)|D prints in Reactive \(§4\.4\.2\.6\), so it comes before C \(Postponed\))\.$/);
  });

  it("every explanation names the regions the model finds, and every reason names each of them", () => {
    const expected = kataExpectedRegions();
    for (const id of KATA_LINE_IDS) {
      const regions = expected[id].map((r) => REGION_LABELS[r]);
      expect(kataExplanation(id).startsWith(`${id}: `)).toBe(true);
      regions.forEach((r) => {
        expect(kataExplanation(id)).toContain(r);
        expect(kataReason(id)).toContain(r);
      });
    }
  });

  it("grades a perfect answer as full marks", () => {
    const grade = gradeKata({ regions: kataExpectedRegions(), order: ["k3", "k4", "k6", "k5"], dValue: 0 });
    expect(grade.score).toBe(grade.total);
    expect(grade.total).toBe(8);
    expect(grade.dFeedback).toBe(
      "D prints y=0. The property passed on the sample y = 1 (§16.5.1), but the pass action runs in Reactive (§4.4.2.6, §16.14.1), after the NBA update of q has changed y, and a plain read returns the current value.",
    );
  });

  it("a region set must match exactly: Active alone is wrong for L1, and an extra region is wrong too", () => {
    const grade = gradeKata({ regions: { L1: ["active"], L5: ["inactive", "postponed"], L6: ["observed", "reactive", "preponed"] }, order: ["k3", "k4", "k5", "k6"], dValue: 1 });
    const byId = Object.fromEntries(grade.lines.map((l) => [l.id, l.correct]));
    expect(byId).toMatchObject({ L1: false, L5: false, L6: true, L2: false });
    expect(grade.order.correct).toBe(false);
    expect(grade.dCorrect).toBe(false);
    expect(grade.score).toBe(1);
  });

  it("the $sampled(y) options: one correct, set by the model's D value, distinct labels, each feedback citing a clause", () => {
    const options = kataSampledOptions();
    expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual([`D y=${kataDValue(true)}`]);
    expect(options.map((o) => o.label)).toEqual(["D y=0", "D y=1"]);
    expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
    options.forEach((o) => expect(o.feedback).toMatch(/§\d/));
  });

  it("grading with a precomputed key gives the same result as grading without one", () => {
    const answer = { regions: kataExpectedRegions(), order: ["k3", "k4", "k5", "k6"], dValue: 1 as const };
    expect(gradeKata(answer, false, kataKey())).toEqual(gradeKata(answer));
    expect(gradeKata(answer, true, kataKey(true))).toEqual(gradeKata(answer, true));
  });

  it("L1 and L3 cite the Active region's clause (§4.4.2.2)", () => {
    expect(kataReason("L1")).toContain("Active (§4.4.2.2)");
    expect(kataReason("L3")).toContain("Active (§4.4.2.2)");
  });

  it("with $sampled(y), D=1 is graded correct and the feedback cites §16.9.3", () => {
    const grade = gradeKata({ regions: {}, order: ["k3", "k4", "k6", "k5"], dValue: 1 }, true);
    expect(grade.dCorrect).toBe(true);
    expect(grade.dFeedback).toBe("D prints y=1. $sampled(y) returns the Preponed sample (§16.9.3), y = 1, the value the property checked.");
  });
});

describe("assumptions", () => {
  it("name the clauses the model uses and the limits a learner must know", () => {
    const text = REGION_TRACE_ASSUMPTIONS.join(" ");
    ["§4.5", "§4.7", "§4.9.1", "§16.9.3", "§20.2", "§9.2.3", "§24.3"].forEach((c) => expect(text).toContain(c));
    expect(text).toMatch(/labelled with the region its event was scheduled into/);
    expect(text).toMatch(/Neither bench has a final procedure/);
    expect(text).toMatch(/not captured from a simulator run/);
    expect(text).toMatch(/tool-dependent/);
  });
});
