import { describe, expect, it } from "vitest";

import { exploreOrderings, scenarioToSource, simulateTimeSlot, withZeroDelay } from "@/lib/sv-scheduler-model";
import {
  allTracePresets,
  combAfterNbaScenario,
  combPrediction,
  describeWoken,
  F3A_HALF_PERIOD,
  f3aOneEdgeScenario,
  f3aPrintPrediction,
  foldTimeSlot,
  formatPrintAt,
  gclkPrediction,
  gclkScenario,
  getRegionMapPreset,
  getTracePreset,
  modelDeltaCount,
  nbaWritersScenario,
  printedLines,
  programReactiveScenario,
  regionMapScenarioPresets,
  schedulerScenarioPresets,
  traceExtraScenarioPresets,
  wakeSource,
  zeroDelayPrediction,
  zeroDelayPrintsScenario,
} from "@/lib/sv-scheduler-scenarios";

const regionOfWake = (run: ReturnType<typeof simulateTimeSlot>, processId: string) =>
  run.trace.find((s) => s.kind === "wake" && s.processId === processId);

describe("region-map scenarios: NBA update re-enters Active (IEEE 1800-2023 §4.5, §4.9.1)", () => {
  it("the continuous assignment and always_comb run after the NBA update, in a later delta of the same slot", () => {
    const run = simulateTimeSlot(combAfterNbaScenario());
    const qUpdate = run.trace.find((s) => s.kind === "update" && s.changed.includes("q"));
    expect(qUpdate?.sourceRegion).toBe("nba");
    const ca = regionOfWake(run, "CA");
    const comb = regionOfWake(run, "COMB");
    expect(ca?.region).toBe("active");
    expect(ca?.sourceRegion).toBeUndefined();
    expect(ca?.delta).toBeGreaterThan(0);
    expect((ca?.index ?? 0) > (qUpdate?.index ?? 0)).toBe(true);
    expect((comb?.index ?? 0) > (ca?.index ?? 0)).toBe(true);
    expect(run.finalValues).toMatchObject({ q: 1, y: 1, z: 1 });
    // One NBA → Active move is the loop-back the F3B ladder shows.
    expect(run.trace.filter((s) => s.kind === "move" && s.region === "nba")).toHaveLength(1);
  });

  it("is deterministic: no two ready processes ever share a region", () => {
    expect(exploreOrderings(combAfterNbaScenario())).toMatchObject({ deterministic: true, runCount: 1 });
  });

  it("generates `assign y = q;` and `always_comb z = y;` from the model data", () => {
    const text = scenarioToSource(combAfterNbaScenario()).map((l) => l.text);
    expect(text).toContain("assign y = q;");
    expect(text).toContain("always_comb z = y;");
    expect(text).toContain("always_ff @(posedge clk) q <= d;");
  });
});

describe("region-map scenarios: #0 resumes in Inactive, before NBA (§4.4.2.3, §4.4.2.4)", () => {
  it("both $display calls print the old q; only $strobe (Postponed, §21.2.2) prints the new q", () => {
    const run = simulateTimeSlot(zeroDelayPrintsScenario());
    expect(run.log).toEqual(["$display: q=0", "$display: q=0", "$strobe: q=5"]);
  });

  it("the second $display executes as part of the Inactive event, and the NBA update comes after it", () => {
    const run = simulateTimeSlot(zeroDelayPrintsScenario());
    const prints = run.trace.filter((s) => s.kind === "print");
    expect(prints.map((p) => p.sourceRegion ?? p.region)).toEqual(["active", "inactive", "postponed"]);
    const qUpdate = run.trace.findIndex((s) => s.kind === "update" && s.changed.includes("q"));
    expect(qUpdate).toBeGreaterThan(prints[1].index);
    expect(qUpdate).toBeLessThan(prints[2].index);
  });
});

describe("region-map scenarios: program code is reactive (§24.3.1)", () => {
  it("the program thread runs in Reactive and reads the post-NBA value of q", () => {
    const run = simulateTimeSlot(programReactiveScenario());
    const tb = regionOfWake(run, "TB");
    expect(tb?.region).toBe("reactive");
    const qUpdate = run.trace.findIndex((s) => s.kind === "update" && s.changed.includes("q"));
    expect(tb?.index).toBeGreaterThan(qUpdate);
    expect(run.finalValues.seen).toBe(1);
  });

  it("a program `<=` lands in Re-NBA and the design event it causes restarts the active set (§4.4.2.8, §4.5)", () => {
    const run = simulateTimeSlot(programReactiveScenario());
    const cmdUpdate = run.trace.find((s) => s.kind === "update" && s.changed.includes("cmd"));
    expect(cmdUpdate?.sourceRegion).toBe("reNba");
    const led = regionOfWake(run, "LED");
    expect(led?.region).toBe("active");
    expect(led?.index).toBeGreaterThan(cmdUpdate?.index ?? Infinity);
    expect(run.finalValues).toMatchObject({ cmd: 1, led: 1 });
  });

  it("#0 inside the program resumes in Re-Inactive (§4.4.2.7)", () => {
    const run = simulateTimeSlot(withZeroDelay(programReactiveScenario(), "TB", true));
    const resume = run.trace.filter((s) => s.kind === "wake" && s.processId === "TB").at(-1);
    expect(resume?.sourceRegion).toBe("reInactive");
    expect(resume?.region).toBe("reactive");
  });

  it("is deterministic: design and program never compete in one region", () => {
    expect(exploreOrderings(programReactiveScenario()).deterministic).toBe(true);
  });
});

describe("region-map presets", () => {
  it.each(regionMapScenarioPresets.map((p) => [p.id, p] as const))("%s replays identically and starts/ends the slot", (id, preset) => {
    const a = simulateTimeSlot(preset.build());
    const b = simulateTimeSlot(getRegionMapPreset(id).build());
    expect(b.trace).toEqual(a.trace);
    expect(a.trace[0].kind).toBe("slot-start");
    expect(a.trace.at(-1)?.kind).toBe("slot-end");
  });
});

// ---------------------------------------------------------------------------
// Trace presets for TimeSlotTraceVisualizer (F3A, F3B, F3C) and the folded view
// ---------------------------------------------------------------------------


const eventRows = (scenario: ReturnType<typeof f3aOneEdgeScenario>, choices: number[] = []) =>
  foldTimeSlot(scenario, simulateTimeSlot(scenario, choices))
    .events.filter((e) => e.kind !== "start")
    .map((e) => ({ event: `${e.glyph} ${e.label}`.trim(), clk: e.values.clk, q: e.values.q, q_n: e.values.q_n, printed: e.printed }));

describe("f3a-one-edge: the lesson's eight-event table (IEEE 1800-2023 §4.5 update and evaluation events)", () => {
  // F3A 'One time slot, traced event by event', steps 1 to 8, transcribed from the lesson.
  const LESSON_TABLE = [
    { event: "▶ clock", clk: 1, q: 0, q_n: 1, printed: [] },
    { event: "◆ clk 0 → 1", clk: 1, q: 0, q_n: 1, printed: [] },
    { event: "▶ always_ff", clk: 1, q: 0, q_n: 1, printed: [] },
    { event: "▶ initial", clk: 1, q: 0, q_n: 1, printed: ["5 display q=0 q_n=1"] },
    { event: "◆ q 0 → 1", clk: 1, q: 1, q_n: 1, printed: [] },
    { event: "▶ assign q_n", clk: 1, q: 1, q_n: 1, printed: [] },
    { event: "◆ q_n 1 → 0", clk: 1, q: 1, q_n: 0, printed: [] },
    { event: "end of slot", clk: 1, q: 1, q_n: 0, printed: ["5 strobe  q=1 q_n=0"] },
  ];

  it("the folded trace equals the lesson's table step for step", () => {
    expect(eventRows(f3aOneEdgeScenario())).toEqual(LESSON_TABLE);
  });

  it("step 0 is the state entering the slot: clk 0, q 0, q_n 1", () => {
    const start = foldTimeSlot(f3aOneEdgeScenario(), simulateTimeSlot(f3aOneEdgeScenario())).events[0];
    expect(start.kind).toBe("start");
    expect(start.values).toMatchObject({ clk: 0, q: 0, q_n: 1 });
  });

  it("the clk update wakes always_ff and the initial; the q update wakes the assign (§4.9.1); nothing waits on q_n", () => {
    const events = foldTimeSlot(f3aOneEdgeScenario(), simulateTimeSlot(f3aOneEdgeScenario())).events;
    const update = (signal: string) => events.find((e) => e.kind === "update" && e.signal === signal);
    expect(update("clk")?.woken).toEqual(["always_ff", "initial"]);
    expect(update("q")?.woken).toEqual(["assign q_n"]);
    expect(update("q_n")?.woken).toEqual([]);
    expect(describeWoken(update("q_n") ?? { woken: [] })).toBe("No process waits on this change.");
  });

  it("generates the lesson's code from the model data", () => {
    const text = scenarioToSource(f3aOneEdgeScenario()).map((l) => l.text.trim());
    expect(text).toContain(`always #${F3A_HALF_PERIOD} clk = ~clk;`);
    expect(text).toContain("always_ff @(posedge clk) q <= d;");
    expect(text).toContain("assign q_n = ~q;");
    expect(text).toContain('$display("%0d display q=%0d q_n=%0d", $time, q, q_n);');
    expect(text).toContain('$strobe("%0d strobe  q=%0d q_n=%0d", $time, q, q_n);');
  });

  it("the clock's next #5 books t = slotTime + 5, and the initial's #1 books t = slotTime + 1 (§9.4.1)", () => {
    const run = simulateTimeSlot(f3aOneEdgeScenario());
    expect(run.slotTime).toBe(F3A_HALF_PERIOD);
    const clockDone = run.trace.find((s) => s.processId === "CLK" && /waits for its next trigger/.test(s.what));
    expect(clockDone?.why).toContain(`books t = ${run.slotTime + F3A_HALF_PERIOD}`);
    const wait = run.trace.find((s) => s.stmtId === "f3a-wait");
    expect(wait?.why).toContain(`t = ${run.slotTime + 1} ns`);
    // $finish sits after #1, so it is not reached in this slot.
    expect(run.finished).toBeUndefined();
  });

  it("swapping always_ff and the initial (§4.7) swaps steps 3 and 4 but changes no printed line or value", () => {
    const swapped = eventRows(f3aOneEdgeScenario(), [1]);
    expect(swapped.map((r) => r.event).slice(2, 4)).toEqual(["▶ initial", "▶ always_ff"]);
    const result = exploreOrderings(f3aOneEdgeScenario());
    expect(result).toMatchObject({ deterministic: true, runCount: 2 });
    expect(printedLines(simulateTimeSlot(f3aOneEdgeScenario(), [1]))).toEqual(printedLines(simulateTimeSlot(f3aOneEdgeScenario(), [0])));
  });

  it("every event keeps $time at the slot time; the pass count only grows (§4.5)", () => {
    const folded = foldTimeSlot(f3aOneEdgeScenario(), simulateTimeSlot(f3aOneEdgeScenario()));
    expect(folded.slotTime).toBe(F3A_HALF_PERIOD);
    const deltas = folded.events.map((e) => e.delta);
    expect(deltas).toEqual([...deltas].sort((a, b) => a - b));
    expect(folded.delta).toBe(deltas.at(-1));
  });

  it("formatPrintAt matches the model's own log for every print", () => {
    for (const zero of [false, true]) {
      const scenario = f3aOneEdgeScenario(zero);
      const run = simulateTimeSlot(scenario);
      const prints = run.trace.filter((s) => s.kind === "print");
      prints.forEach((step, i) => {
        const stmt = scenario.processes.flatMap((p) => p.body).find((s) => s.id === step.stmtId);
        if (!stmt || (stmt.kind !== "display" && stmt.kind !== "strobe")) throw new Error("print without statement");
        expect(formatPrintAt(stmt, step.values, run.slotTime)).toBe(printedLines(run)[i]);
      });
    }
  });

  it("the print prediction marks exactly the model's two lines correct", () => {
    const prediction = f3aPrintPrediction(f3aOneEdgeScenario());
    const right = prediction.options.filter((o) => o.correct);
    expect(right).toHaveLength(1);
    expect(right[0].label).toBe(printedLines(simulateTimeSlot(f3aOneEdgeScenario())).join("  ·  "));
    expect(new Set(prediction.options.map((o) => o.label)).size).toBe(prediction.options.length);
    expect(prediction.question).toBe("The initial prints two lines at t = 5 ns. What are they?");
  });
});

describe("f3a-one-edge-zero-delay: #0 resumes in Inactive, before NBA (§4.4.2.3, §4.4.2.4)", () => {
  it("$display still prints the old q; only $strobe (Postponed, §4.4.2.9) sees the new q", () => {
    const run = simulateTimeSlot(f3aOneEdgeScenario(true));
    expect(printedLines(run)).toEqual(printedLines(simulateTimeSlot(f3aOneEdgeScenario(false))));
    const resume = run.trace.find((s) => s.kind === "wake" && s.processId === "INIT" && s.sourceRegion === "inactive");
    const qUpdate = run.trace.find((s) => s.kind === "update" && s.changed.includes("q"));
    expect(resume && qUpdate && resume.index < qUpdate.index).toBe(true);
  });

  it("the prediction's correct answer is 'no', computed from the run", () => {
    const prediction = zeroDelayPrediction(f3aOneEdgeScenario(true));
    expect(prediction.options.find((o) => o.correct)?.id).toBe("no");
    expect(prediction.question).toBe("With #0 before $display, does $display now print q=1?");
  });

  it("the folded view shows the initial twice: once to suspend, once resuming after #0", () => {
    const events = foldTimeSlot(f3aOneEdgeScenario(true), simulateTimeSlot(f3aOneEdgeScenario(true))).events;
    expect(events.filter((e) => e.processId === "INIT" && e.kind === "evaluate").map((e) => e.label)).toEqual(["initial", "initial (resumes)"]);
  });
});

describe("comb-after-nba as a trace preset: the NBA update feeds logic in the same slot (§4.5, §4.9.1, §4.9.4)", () => {
  it("Δ is the model's count of moves, and the prediction's numbers come from the run", () => {
    const scenario = combAfterNbaScenario();
    const run = simulateTimeSlot(scenario);
    expect(modelDeltaCount(run)).toBe(run.trace.filter((s) => s.kind === "move").length);
    expect(modelDeltaCount(run)).toBe(run.trace.filter((s) => s.kind === "move" && s.region === "nba").length);
    const prediction = combPrediction(scenario);
    const right = prediction.options.find((o) => o.correct);
    expect(right?.label).toBe(`y = ${run.finalValues.y}, z = ${run.finalValues.z}; Δ = ${modelDeltaCount(run)}; $time stays ${run.slotTime} ns`);
    expect(prediction.options.filter((o) => o.correct)).toHaveLength(1);
    expect(new Set(prediction.options.map((o) => o.label)).size).toBe(prediction.options.length);
    // $time never moves inside the slot.
    expect(foldTimeSlot(scenario, run).slotTime).toBe(run.slotTime);
  });
});

describe("program-drive: the Re-NBA write of cmd wakes the design assign after the NBA pass (§4.4.2.8, §4.5)", () => {
  it("Δ goes past 1 and equals the number of moves back to Active or Reactive", () => {
    const run = simulateTimeSlot(getTracePreset("program-drive").build());
    const moves = run.trace.filter((s) => s.kind === "move");
    expect(modelDeltaCount(run)).toBe(moves.length);
    expect(modelDeltaCount(run)).toBeGreaterThan(1);
    const cmd = run.trace.find((s) => s.kind === "update" && s.changed.includes("cmd"));
    const led = run.trace.find((s) => s.kind === "wake" && s.processId === "LED");
    expect(cmd?.sourceRegion).toBe("reNba");
    expect(led?.region).toBe("active");
  });
});

describe("gclk-interleave: a woken process may run between NBA updates (§4.5 'any event', §4.6, §4.7)", () => {
  it("three legal orders, two outcome groups: b gets the old a in one, the new a in two", () => {
    const scenario = gclkScenario("generated");
    expect(scenarioToSource(scenario).map((l) => l.text)).toEqual(
      expect.arrayContaining(["always @(posedge clk) gclk <= ~gclk;", "always @(posedge clk) a <= d;", "always @(posedge gclk) b <= a;"]),
    );
    const result = exploreOrderings(scenario);
    expect(result.runCount).toBe(3);
    const counts = Object.fromEntries(result.outcomes.map((o) => [String(o.finalValues.b), o.runs.length]));
    expect(counts).toEqual({ [String(scenario.initial.a)]: 1, "1": 2 });
  });

  it("without interleaveNba there is one group: the option is what opens the corner case", () => {
    const scenario = gclkScenario("generated");
    expect(exploreOrderings({ ...scenario, options: { interleaveNba: false } }).deterministic).toBe(true);
  });

  it("the prediction's answer is 'either', and its tally is the model's", () => {
    const prediction = gclkPrediction(gclkScenario("generated"));
    const either = prediction.options.find((o) => o.id === "either");
    expect(either?.correct).toBe(true);
    expect(prediction.options.filter((o) => o.correct)).toHaveLength(1);
    expect(either?.feedback).toContain("b = 0 (old a) in 1 of 3 orders and b = 1 (new a) in 2");
  });

  it("gclk-enable: one group, b always captures the old a; flop b reads en = 1 in every order, so its `if (en)` is taken", () => {
    const scenario = gclkScenario("enable");
    const result = exploreOrderings(scenario);
    expect(result.runCount).toBe(6);
    expect(result.deterministic).toBe(true);
    expect(result.outcomes[0].finalValues.b).toBe(scenario.initial.a);
    for (const run of result.outcomes.flatMap((o) => o.runs)) {
      const wake = simulateTimeSlot(scenario, run.choices).trace.find((s) => s.kind === "wake" && s.processId === "B");
      expect(wake?.values.en).toBe(1);
    }
    expect(gclkPrediction(scenario).options.find((o) => o.correct)?.id).toBe("old");
  });
});

describe("gclkPrediction wording: 'Not only.' only for a value b really takes", () => {
  it("gclk-enable: b never gets the new a, so the 'new' feedback says 'No.', never 'Not only'", () => {
    const options = gclkPrediction(gclkScenario("enable")).options;
    const fresh = options.find((o) => o.id === "new");
    expect(fresh?.correct).toBe(false);
    expect(fresh?.feedback).not.toContain("Not only");
    expect(fresh?.feedback.startsWith("No. ")).toBe(true);
    expect(fresh?.feedback).toContain("b = 1 (new a) in 0.");
    expect(options.find((o) => o.id === "either")?.feedback.startsWith("Not here. ")).toBe(true);
  });

  it("gclk-interleave: both values occur, so each single-value option says 'Not only.'", () => {
    const options = gclkPrediction(gclkScenario("generated")).options;
    for (const id of ["old", "new"]) expect(options.find((o) => o.id === id)?.feedback.startsWith("Not only. ")).toBe(true);
  });

  it("the NBA-wake explanation comes from the trace: which update woke flop b", () => {
    const generated = gclkScenario("generated");
    expect(wakeSource(simulateTimeSlot(generated).trace, generated, "B")).toEqual({ signal: "gclk", byNba: true });
    const enable = gclkScenario("enable");
    expect(wakeSource(simulateTimeSlot(enable).trace, enable, "B")).toEqual({ signal: "clk", byNba: false });
    // A clock made with a blocking assignment is not the clock either, yet it wakes b from an Active update.
    const blocking = {
      ...generated,
      processes: generated.processes.map((p) =>
        p.id === "DIV" ? { ...p, body: p.body.map((st) => (st.kind === "assign" ? { ...st, op: "blocking" as const } : st)) } : p,
      ),
    };
    expect(wakeSource(simulateTimeSlot(blocking).trace, blocking, "B")).toEqual({ signal: "gclk", byNba: false });
    expect(gclkPrediction(blocking).options[0].feedback).not.toContain("NBA update of gclk");
  });
});

describe("nba-writers benches: §4.6 orders one process's NBAs; §4.7 leaves two writers open", () => {
  it("one process: a = 1 in every order (§4.6 b)", () => {
    const result = exploreOrderings(nbaWritersScenario("one-process"));
    expect(result.deterministic).toBe(true);
    expect(result.outcomes[0].finalValues.a).toBe(1);
    const updates = simulateTimeSlot(nbaWritersScenario("one-process")).trace.filter((s) => s.kind === "update" && s.stmtId);
    expect(updates.map((s) => s.values.a)).toEqual([0, 1]);
  });

  it("two processes: two outcome groups even with <= (§4.7)", () => {
    const result = exploreOrderings(nbaWritersScenario("two-processes"));
    expect(result.deterministic).toBe(false);
    expect(result.outcomes.map((o) => o.finalValues.a).sort()).toEqual([0, 1]);
  });
});

describe("trace preset registry", () => {
  it("keeps the hash-pinned presets first and unchanged, and adds the extras after them", () => {
    expect(allTracePresets.slice(0, schedulerScenarioPresets.length)).toEqual(schedulerScenarioPresets);
    expect(allTracePresets.slice(schedulerScenarioPresets.length)).toEqual(traceExtraScenarioPresets);
    expect(new Set(allTracePresets.map((p) => p.id)).size).toBe(allTracePresets.length);
  });

  it.each(traceExtraScenarioPresets.map((p) => [p.id, p] as const))("%s replays identically, folds every step, and never says 'delta'", (_id, preset) => {
    const scenario = preset.build();
    const a = simulateTimeSlot(scenario);
    expect(simulateTimeSlot(preset.build()).trace).toEqual(a.trace);
    const folded = foldTimeSlot(scenario, a);
    const covered = folded.events.flatMap((e) => e.steps);
    const choiceOrMove = a.trace.filter((s) => s.kind === "choice" || s.kind === "move").map((s) => s.index);
    // A blocking write belongs to its ▶ and to the ◆ it creates, so a step may be folded twice.
    expect([...new Set([...covered, ...choiceOrMove])].sort((x, y) => x - y)).toEqual(a.trace.map((s) => s.index));
    const text = [preset.summary, ...(preset.prediction ? preset.prediction(scenario).options.flatMap((o) => [o.label, o.feedback]) : [])].join(" ");
    expect(text).not.toMatch(/delta/i);
  });
});
