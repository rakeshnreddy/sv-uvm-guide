import { describe, expect, it } from "vitest";

import { EDGE_TABLE as SHARED_EDGE_TABLE, parseEventExpression } from "@/lib/sv-event-control-model";
import {
  AXIS_END,
  BASE_CONTROLS,
  EDGE_TABLE,
  EVENT_PRESETS,
  INTRA_FORMS,
  LESSON_PRESETS,
  NO_REPEAT_NOTE,
  OFFERED_REPEAT_COUNTS,
  STIMULUS,
  TIME_CHOICES,
  WAIT_LOOP_CAUTION,
  WAKE_ARMING_NOTE,
  WAKE_WAITERS,
  controlText,
  drillControls,
  drillSummary,
  edgeCell,
  evaluateControl,
  evaluateDrill,
  evaluateIntra,
  evaluateRepeatCount,
  explainTimeChoice,
  explainValueChoice,
  explainWakeChoice,
  findEventPreset,
  findLessonPreset,
  intraSummary,
  nextBit,
  outcomeChoices,
  posedgeTime,
  posedgesOnAxis,
  scoreDrill,
  subjectValues,
  valueAt,
  valueChoices,
  wakeMatrix,
  wakeOutcome,
  wakeSteps,
  writeMarkers,
  type WakeStep,
  writeOnAxis,
  type ControlId,
  type EventDrill,
} from "@/lib/sv-intra-assignment-model";

const preset = (id: string): EventDrill => {
  const p = findEventPreset(id);
  if (!p) throw new Error(`no preset ${id}`);
  return p.drill;
};

const fires = (d: EventDrill) => Object.fromEntries(evaluateDrill(d).map((v) => [v.id, v.fires])) as Record<ControlId, boolean>;

describe("shared edge semantics", () => {
  it("re-exports the very Table 9-2 object of sv-event-control-model, so the two visuals cannot disagree (§9.4.2)", () => {
    expect(EDGE_TABLE).toBe(SHARED_EDGE_TABLE);
  });

  it("the bit editors cycle 0 → 1 → x → z → 0", () => {
    expect(["0", "1", "x", "z"].map((b) => nextBit(b as "0"))).toEqual(["1", "x", "z", "0"]);
  });
});

describe("§9.4.2 Table 9-2 drill presets", () => {
  it("x → 0 on rst_n is a negedge: @(negedge rst_n), @(edge rst_n) and @(rst_n) wake, @(posedge rst_n) does not (§9.4.2, Table 9-2)", () => {
    const d = preset("x-to-0-reset");
    expect(controlText(d, "negedge")).toBe("@(negedge rst_n)");
    expect(edgeCell(d)).toEqual({ from: "x", to: "0", edge: "negedge" });
    expect(fires(d)).toEqual({ posedge: false, negedge: true, edge: true, change: true, "posedge-iff": false });
    expect(evaluateControl(d, "negedge").reason).toContain("Table 9-2 lists as a negedge");
  });

  it("1 → z is a negedge, and the change wakes @(s) (§9.4.2, Table 9-2)", () => {
    const d = preset("one-to-z");
    expect(edgeCell(d).edge).toBe("negedge");
    expect(fires(d)).toEqual({ posedge: false, negedge: true, edge: true, change: true, "posedge-iff": false });
  });

  it("x → z changes the value but is no edge (§9.4.2, Table 9-2)", () => {
    const d: EventDrill = { ...preset("one-to-z"), s: { before: "x", after: "z" } };
    expect(fires(d)).toEqual({ posedge: false, negedge: false, edge: false, change: true, "posedge-iff": false });
    expect(evaluateControl(d, "edge").reason).toContain("no edge");
  });

  it("bus 4'b0011 → 4'b0010: the LSB 1 → 0 is a negedge (§9.4.2: edges on the least significant bit)", () => {
    const d = preset("bus-lsb-negedge");
    expect(subjectValues(d)).toEqual({ before: "0011", after: "0010" });
    expect(edgeCell(d)).toEqual({ from: "1", to: "0", edge: "negedge" });
    expect(fires(d).negedge).toBe(true);
    expect(fires(d).posedge).toBe(false);
    expect(evaluateControl(d, "negedge").reason).toContain("bus[0] goes 1 → 0");
  });

  it("bus 4'b0001 → 4'b0011: @(bus) wakes but @(posedge bus) does not, LSB unchanged (§9.4.2)", () => {
    const d = preset("bus-lsb-unchanged");
    expect(fires(d)).toEqual({ posedge: false, negedge: false, edge: false, change: true, "posedge-iff": false });
    expect(evaluateControl(d, "posedge").reason).toContain("bus[0] goes 1 → 1, which Table 9-2 lists as no edge");
    expect(evaluateControl(d, "change").reason).toContain("from 4'b0001 to 4'b0011");
  });

  it("@(a & b): b changes, a & b stays 0, so nothing wakes (§9.4.2: an operand change that leaves the value unchanged is not an event)", () => {
    const d = preset("and-unchanged");
    expect(subjectValues(d)).toEqual({ before: "0", after: "0" });
    expect(controlText(d, "change")).toBe("@(a & b)");
    expect(controlText(d, "posedge")).toBe("@(posedge (a & b))");
    expect(Object.values(fires(d)).every((f) => !f)).toBe(true);
    const reason = evaluateControl(d, "change").reason;
    expect(reason).toContain("b changed, but the expression's value did not");
    expect(reason).toContain("0 & 0 = 0 and is 0 & 1 = 0");
  });

  it("a & b uses the 4-state & of Table 11-11: x & 0 is 0, x & 1 is x", () => {
    const d = preset("and-unchanged");
    expect(subjectValues({ ...d, a: { before: "x", after: "x" }, b: { before: "0", after: "1" } })).toEqual({ before: "0", after: "x" });
  });

  it("en = x in the iff guard: the posedge is filtered out because x is not true (§9.4.2.3, §12.4)", () => {
    const d = preset("iff-en-x");
    expect(fires(d).posedge).toBe(true);
    expect(fires(d)["posedge-iff"]).toBe(false);
    expect(evaluateControl(d, "posedge-iff").reason).toContain("x and z count as false (§12.4)");
    expect(fires({ ...d, en: "z" })["posedge-iff"]).toBe(false);
    expect(fires({ ...d, en: "0" })["posedge-iff"]).toBe(false);
    expect(fires({ ...d, en: "1" })["posedge-iff"]).toBe(true);
  });

  it("iff binds tighter than or: (posedge s iff en) or (negedge s) wakes on a negedge with en = 0 (§9.4.2.3, §9.4.2.1)", () => {
    const d = preset("iff-binds-tighter");
    expect(drillControls(d)).toEqual([...BASE_CONTROLS, "iff-or"]);
    expect(controlText(d, "iff-or")).toBe("@(posedge s iff en or negedge s)");
    const v = evaluateControl(d, "iff-or");
    expect(v.fires).toBe(true);
    expect(v.firedBy).toEqual([1]);
    expect(v.reason).toContain("(posedge s iff en) or (negedge s)");
    expect(v.reason).toContain("If the guard applied to the whole list, it would not wake.");
  });

  it("the control text parses back to the same terms, so iff stays with its own term (§9.4.2.1, §9.4.2.3)", () => {
    const d = preset("iff-binds-tighter");
    expect(parseEventExpression(controlText(d, "iff-or").slice(2, -1))).toEqual([
      { kind: "posedge", expr: "s", iff: "en" },
      { kind: "negedge", expr: "s" },
    ]);
    expect(parseEventExpression(controlText(d, "posedge-iff").slice(2, -1))).toEqual([{ kind: "posedge", expr: "s", iff: "en" }]);
    expect(parseEventExpression(controlText(d, "change").slice(2, -1))).toEqual([{ kind: "change", expr: "s" }]);
  });

  it("no value change, no event: writing 0 over 0 wakes nothing (§9.4.2)", () => {
    const d: EventDrill = { ...preset("one-to-z"), s: { before: "0", after: "0" } };
    expect(Object.values(fires(d)).every((f) => !f)).toBe(true);
    expect(evaluateControl(d, "change").reason).toContain("is not a change");
  });

  it("grades each control: right when ticked exactly when it wakes", () => {
    const d = preset("bus-lsb-unchanged");
    expect(scoreDrill(d, ["change"])).toMatchObject({ correct: 5, total: 5 });
    expect(scoreDrill(d, ["change", "posedge"])).toMatchObject({ correct: 4, total: 5, perControl: { posedge: false, change: true } });
    expect(scoreDrill(d, [])).toMatchObject({ correct: 4 });
  });

  it("the summary is generated from the evaluation", () => {
    expect(drillSummary(preset("x-to-0-reset"))).toBe(
      "rst_n: 1'bx → 1'b0, en = 1. Wakes: @(negedge rst_n), @(edge rst_n), @(rst_n). Does not wake: @(posedge rst_n), @(posedge rst_n iff en).",
    );
  });

  it("every preset is evaluable and has a lesson note", () => {
    EVENT_PRESETS.forEach((p) => {
      expect(p.lesson.length).toBeGreaterThan(10);
      expect(evaluateDrill(p.drill).length).toBe(drillControls(p.drill).length);
    });
  });
});

describe("§9.4.2 and §9.4.3: what wakes a waiting process (wake script)", () => {
  const steps = wakeSteps();

  it("derives each write's old value from the script: a x → 0, 0 → 0, 0 → 1, then b 0 → 1", () => {
    expect(steps.map((s) => `${s.signal}:${s.from}->${s.to}`)).toEqual(["a:x->0", "a:0->0", "a:0->1", "b:0->1"]);
  });

  it("matrix of waiter × write follows Table 9-2, the no-change rule and §9.4.3", () => {
    const m = Object.fromEntries(wakeMatrix().map((r) => [r.waiter.code, r.outcomes]));
    expect(m).toEqual({
      "@(a)": ["wakes", "asleep", "wakes", "asleep"],
      "@(posedge a)": ["asleep", "asleep", "wakes", "asleep"],
      "@(negedge a)": ["wakes", "asleep", "asleep", "asleep"],
      "@(a & b)": ["asleep", "asleep", "asleep", "wakes"],
      "wait (a)": ["asleep", "asleep", "wakes", "passes-at-once"],
    });
  });

  it("@(a & b) sleeps through a x → 0 because x & 0 is already 0 (§9.4.2, Table 11-11)", () => {
    const v = wakeOutcome("change-and", steps[0]);
    expect(v.outcome).toBe("asleep");
    expect(v.rule).toContain("x & 0 = 0");
  });

  it("wait (a) passes at once when a is already true (§9.4.3)", () => {
    const v = wakeOutcome("wait-a", steps[3]);
    expect(v.outcome).toBe("passes-at-once");
    expect(v.rule).toContain("§9.4.3");
  });

  it("wait (a) stays blocked while a is x or 0, which are not true (§9.4.3, §12.4)", () => {
    expect(wakeOutcome("wait-a", steps[0]).rule).toBe(
      "a is 0 after this write: 0 is false (§12.4), so wait (a) stays blocked until a becomes true (§9.4.3).",
    );
    expect(wakeOutcome("wait-a", steps[1]).rule).toBe(
      "a is 0 after this write: 0 is false (§12.4), so wait (a) stays blocked until a becomes true (§9.4.3).",
    );
  });

  it.each(["x", "z"] as const)("wait (a) stays blocked when a write leaves a at %s: x and z are not true (§12.4)", (v) => {
    const step: WakeStep = { index: 0, signal: "a", from: "0", to: v, before: { a: "0", b: "0" }, after: { a: v, b: "0" } };
    const verdict = wakeOutcome("wait-a", step);
    expect(verdict.outcome).toBe("asleep");
    expect(verdict.rule).toBe(`a is ${v} after this write: x and z are not true (§12.4), so wait (a) stays blocked until a becomes true (§9.4.3).`);
  });

  it("wait (a) at write 3 wakes because a was 0 before it and is 1 after it (§9.4.3, §12.4)", () => {
    const v = wakeOutcome("wait-a", steps[2]);
    expect(v.outcome).toBe("wakes");
    expect(v.rule).toBe("wait (a) blocked because a was 0, which is not true (§12.4). a becomes 1, which is true, so the process continues (§9.4.3).");
  });

  it("wait (a) blocked on a false a, with a write to b, says b was written and a was not", () => {
    const step: WakeStep = { index: 3, signal: "b", from: "0", to: "1", before: { a: "0", b: "0" }, after: { a: "0", b: "1" } };
    expect(wakeOutcome("wait-a", step).rule).toBe(
      "Write 4 is to b; a is not written and stays 0: 0 is false (§12.4), so wait (a) stays blocked until a becomes true (§9.4.3).",
    );
  });

  it.each(["change-a", "posedge-a", "negedge-a"] as const)("%s at write 4 (b 0 → 1): the rule says b was written and a was not (§9.4.2)", (w) => {
    const v = wakeOutcome(w, steps[3]);
    expect(v.outcome).toBe("asleep");
    expect(v.rule).toContain("Write 4 is to b; a is not written and stays 1'b1, so there is no event (§9.4.2).");
    expect(v.rule).not.toContain("writing the value it already has");
    expect(explainWakeChoice(w, steps[3], "wakes").feedback).not.toContain("writing the value it already has");
  });

  it.each(["change-a", "posedge-a", "negedge-a"] as const)("%s at write 2 (a 0 → 0): writing the value a already has is no event (§9.4.2)", (w) => {
    expect(wakeOutcome(w, steps[1]).rule).toContain("a stays 1'b0: writing the value it already has is not a change, so there is no event (§9.4.2).");
  });

  it("the arming note does not frame the drill as a forever loop, and wait (a) carries the zero-delay loop caution (§9.4.3)", () => {
    expect(WAKE_ARMING_NOTE).not.toContain("forever");
    expect(WAIT_LOOP_CAUTION).toContain("forever wait (a);");
    expect(WAIT_LOOP_CAUTION).toContain("without simulation time advancing");
  });

  it("only wait offers 'passes at once'; an @ control always waits for an event", () => {
    expect(outcomeChoices("wait-a")).toContain("passes-at-once");
    WAKE_WAITERS.filter((w) => w.id !== "wait-a").forEach((w) => expect(outcomeChoices(w.id)).toEqual(["wakes", "asleep"]));
  });

  it("feedback for a wrong choice names the real outcome and its rule", () => {
    const fb = explainWakeChoice("posedge-a", steps[0], "wakes");
    expect(fb.correct).toBe(false);
    expect(fb.feedback).toContain('It stays asleep, not "wakes"');
    expect(fb.feedback).toContain("a goes x → 0, which Table 9-2 lists as a negedge");
    expect(explainWakeChoice("posedge-a", steps[2], "wakes").correct).toBe(true);
  });
});

describe("§9.4.5 and Table 9-3: intra-assignment timing", () => {
  it("the stimulus changes b and d at t = 2 and t = 7; clk rises at 3, 6, 9, 12", () => {
    expect(STIMULUS.b.slice(1).map((e) => e.time)).toEqual([2, 7]);
    expect(STIMULUS.d.slice(1).map((e) => e.time)).toEqual([2, 7]);
    expect(posedgesOnAxis()).toEqual([3, 6, 9, 12]);
    expect(valueAt("b", 0)).toBe(1);
    expect(valueAt("b", 5)).toBe(2);
    expect(valueAt("d", 9)).toBe(30);
  });

  it("a = #5 b: b is read before the delay, a is written at t = 5, the process blocks (§9.4.5, §10.4.1, Table 9-3 row 1)", () => {
    const r = evaluateIntra("blocking-intra");
    expect(r).toMatchObject({ readAt: 0, valueRead: 1, finalValue: 1, nextStatementAt: 5, blocks: true });
    expect(r.writes).toEqual([{ time: 5, region: "Active", value: 1 }]);
    expect(r.equivalent.fromTable).toBe(true);
    expect(r.equivalent.lines).toEqual(["begin", "  temp = b;", "  #5 a = temp;", "end"]);
  });

  it("a <= #5 b: b is read at t = 0, the NBA update lands at t = 5, the process does not block (§9.4.5, §10.4.2)", () => {
    const r = evaluateIntra("nonblocking-intra");
    expect(r).toMatchObject({ readAt: 0, finalValue: 1, nextStatementAt: 0, blocks: false });
    expect(r.writes).toEqual([{ time: 5, region: "NBA", value: 1 }]);
    expect(r.equivalent.fromTable).toBe(false);
  });

  it("#5 a = b: the delay precedes the statement, so b is read at t = 5 after its change (§9.4.1, §9.4.5)", () => {
    const r = evaluateIntra("delayed-statement");
    expect(r).toMatchObject({ readAt: 5, valueRead: 2, finalValue: 2, nextStatementAt: 5, blocks: true });
  });

  it("a <= repeat (3) @(posedge clk) d: d is read once at t = 0 and a is written at the third edge, t = 9 (§9.4.5, Table 9-3 row 3)", () => {
    const r = evaluateIntra("nonblocking-repeat", "three");
    expect(r).toMatchObject({ readAt: 0, valueRead: 10, finalValue: 10, nextStatementAt: 0, blocks: false });
    expect(r.writes).toEqual([{ time: 9, region: "NBA", value: 10 }]);
    expect(valueAt("d", 9)).not.toBe(r.finalValue);
    expect(r.equivalent.lines.filter((l) => l.includes("@(posedge clk)")).length).toBe(3);
    expect(r.code[0]).toBe("int n = 3;");
  });

  it.each([
    ["zero", 0],
    ["neg-int", -3],
  ] as const)("repeat count %s (<= 0) gives the assignment as if there were no repeat (§9.4.5)", (id, value) => {
    expect(evaluateRepeatCount(id)).toMatchObject({ value, waits: 0 });
    const r = evaluateIntra("nonblocking-repeat", id);
    expect(r.writes).toEqual([{ time: 0, region: "NBA", value: 10 }]);
  });

  it.each(["x", "z"] as const)("repeat count %s gives the assignment as if there were no repeat (§9.4.5)", (id) => {
    expect(evaluateRepeatCount(id)).toMatchObject({ value: id, waits: 0 });
    expect(evaluateIntra("nonblocking-repeat", id).writes[0].time).toBe(0);
  });

  it("-3 in an int unsigned is 4294967293, so the event control repeats 4294967293 times and is not simulated (§9.4.5 example)", () => {
    const rep = evaluateRepeatCount("neg-unsigned");
    expect(rep.value).toBe(2 ** 32 - 3);
    expect(rep.waits).toBe(4294967293);
    expect(rep.note).toContain("repeats 4294967293 times");
    const r = evaluateIntra("nonblocking-repeat", "neg-unsigned");
    expect(r.writes[0].time).toBe(posedgeTime(4294967293));
    expect(r.writes[0].time).toBe(12884901879);
    expect(writeOnAxis(r)).toBe(false);
    expect(r.nextStatementAt).toBe(0);
  });

  it("the signed -3 does not run the event control and the unsigned one does, as the clause's repeat (a) example says (§9.4.5)", () => {
    expect(evaluateRepeatCount("neg-int").waits).toBe(0);
    expect(evaluateRepeatCount("neg-unsigned").waits > 0).toBe(true);
    expect(NO_REPEAT_NOTE).toContain("will not execute the event control");
  });

  it("same-time writes share one marker whose label keeps the §4.6 b) order; other forms get one marker each", () => {
    expect(writeMarkers(evaluateIntra("nba-order"))).toEqual([{ time: 0, label: "a = 0, then 1 (NBA)" }]);
    expect(writeMarkers(evaluateIntra("blocking-intra"))).toEqual([{ time: 5, label: "a = 1 (Active)" }]);
    expect(writeMarkers(evaluateIntra("nonblocking-repeat", "three"))).toEqual([{ time: 9, label: "a = 10 (NBA)" }]);
  });

  it.each(["zero", "neg-int", "x", "z"] as const)("time feedback for repeat count %s carries the no-repeat reading (§9.4.5)", (id) => {
    const r = evaluateIntra("nonblocking-repeat", id);
    TIME_CHOICES.forEach((c) => expect(explainTimeChoice(r, c).feedback).toContain(NO_REPEAT_NOTE));
    expect(explainTimeChoice(evaluateIntra("nonblocking-repeat", "three"), 0).feedback).not.toContain(NO_REPEAT_NOTE);
  });

  it("a <= 0; a <= 1; leaves a at 1: NBA updates are performed in execution order (§4.6 b)", () => {
    const r = evaluateIntra("nba-order");
    expect(r.writes.map((w) => w.value)).toEqual([0, 1]);
    expect(r.finalValue).toBe(1);
    expect(explainValueChoice(r, "race").correct).toBe(false);
    expect(explainValueChoice(r, "race").feedback).toContain("§4.6 b)");
    expect(explainValueChoice(r, 1).correct).toBe(true);
  });

  it("value options are the values the read signal takes, and feedback names when each holds", () => {
    const r = evaluateIntra("blocking-intra");
    expect(valueChoices(r)).toEqual([1, 2, 3]);
    const fb = explainValueChoice(r, 2);
    expect(fb.correct).toBe(false);
    expect(fb.feedback).toContain("2 is the value b holds from t = 2");
    expect(fb.feedback).toContain("b is read at t = 0, when it holds 1");
  });

  it("time options are fixed for every form and contain each form's answer", () => {
    INTRA_FORMS.forEach((f) => {
      const r = evaluateIntra(f.id);
      expect(TIME_CHOICES).toContain(r.nextStatementAt);
      expect(TIME_CHOICES.filter((c) => explainTimeChoice(r, c).correct)).toHaveLength(1);
    });
  });

  it("picking the write time of a nonblocking form is diagnosed as the write, not the process (§10.4.2)", () => {
    const fb = explainTimeChoice(evaluateIntra("nonblocking-repeat", "three"), 9);
    expect(fb.correct).toBe(false);
    expect(fb.feedback).toContain("That is when a is written");
    const big = explainTimeChoice(evaluateIntra("nonblocking-repeat", "neg-unsigned"), "later");
    expect(big.feedback).toContain("That is when a is written");
  });

  it("the summary is generated from the result", () => {
    expect(intraSummary(evaluateIntra("nonblocking-intra"))).toBe(
      "a <= #5 b; b is read at t = 0 (1). a ends at 1, written in the NBA region at t = 5. The next statement runs at t = 0.",
    );
  });

  it("every offered repeat count stays within the axis except the unsigned one", () => {
    OFFERED_REPEAT_COUNTS.forEach((id) => {
      const r = evaluateIntra("nonblocking-repeat", id);
      expect(writeOnAxis(r)).toBe(id !== "neg-unsigned");
      expect(r.writes[0].time <= AXIS_END).toBe(id !== "neg-unsigned");
    });
  });
});

describe("lesson presets", () => {
  it("one preset per lesson use", () => {
    expect(LESSON_PRESETS.map((p) => [p.id, p.mode])).toEqual([
      ["f2c-timing-controls", "events"],
      ["f2c-sensitivity-lists", "events"],
      ["f2c-intra-assignment", "intra"],
      ["f3a-wake-rules", "wake"],
    ]);
    expect(findLessonPreset("f3a-wake-rules")?.start).toBe("change-and");
    expect(findEventPreset(findLessonPreset("f2c-timing-controls")?.start)).toBeDefined();
  });
});
