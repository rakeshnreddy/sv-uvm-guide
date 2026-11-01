import { describe, expect, it } from "vitest";

import { REGION_ORDER, simulateTimeSlot } from "@/lib/sv-scheduler-model";
import {
  buildRegionQuiz,
  groupLandingsByRegion,
  outputOrderOptions,
  regionLandings,
  regionMapPrediction,
  regionMapSource,
  type RegionQuestion,
} from "@/lib/sv-region-map-model";
import {
  combAfterNbaScenario,
  programReactiveScenario,
  testbenchDriveScenario,
  zeroDelayPrintsScenario,
} from "@/lib/sv-scheduler-scenarios";
import { programWatcherScenario } from "@/lib/sv-region-map-scenarios-extra";

describe("sv-region-map-model: landings come from the trace", () => {
  it("records moved events under the region they were scheduled in (§4.5), with their delta", () => {
    const scenario = combAfterNbaScenario();
    const landings = regionLandings(scenario, simulateTimeSlot(scenario));
    const byRegion = groupLandingsByRegion(landings);
    expect(byRegion.preponed.map((l) => l.kind)).toEqual(["sample"]);
    expect(byRegion.nba.map((l) => l.label)).toEqual(["q ← 1 (q <= d;)"]);
    const runs = byRegion.active.filter((l) => l.kind === "run").map((l) => [l.processId, l.delta]);
    expect(runs).toEqual([
      ["FF", 0],
      ["CA", 1],
      ["COMB", 1],
    ]);
    expect(byRegion.observed).toHaveLength(0);
  });

  it("places the clocking-block event in Observed and the clocking drive in Re-NBA (§14.10, §14.16)", () => {
    const scenario = testbenchDriveScenario("clocking");
    const byRegion = groupLandingsByRegion(regionLandings(scenario, simulateTimeSlot(scenario)));
    expect(byRegion.observed.map((l) => l.kind)).toEqual(["clocking-event"]);
    expect(byRegion.reNba.map((l) => l.label)).toEqual(["din ← 7 (cb.din <= 7;)"]);
  });

  it("puts program code in Reactive and its `<=` update in Re-NBA (§24.3.1)", () => {
    const scenario = programReactiveScenario();
    const byRegion = groupLandingsByRegion(regionLandings(scenario, simulateTimeSlot(scenario)));
    expect(byRegion.reactive.some((l) => l.processId === "TB" && l.kind === "run")).toBe(true);
    expect(byRegion.reNba.map((l) => l.stmtId)).toEqual(["pr4"]);
    expect(byRegion.active.some((l) => l.processId === "TB")).toBe(false);
  });
});

describe("sv-region-map-model: source", () => {
  it("wraps program-context processes in program … endprogram", () => {
    const text = regionMapSource(programReactiveScenario()).map((l) => l.text);
    const start = text.indexOf("program tb;");
    expect(start).toBeGreaterThan(-1);
    expect(text[start + 1]).toBe("  initial forever @(posedge clk) begin");
    expect(text.at(-1)).toBe("endprogram");
    expect(regionMapSource(combAfterNbaScenario()).some((l) => l.text.includes("program"))).toBe(false);
  });
});

describe("sv-region-map-model: predictions are graded by the model", () => {
  it("comb-after-nba: exactly the 'second Active pass' option is correct", () => {
    const s = combAfterNbaScenario();
    const p = regionMapPrediction(s, simulateTimeSlot(s));
    expect(p.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["active-again"]);
  });

  it("program-reactive: the program reads the new q, not the Preponed value", () => {
    const s = programReactiveScenario();
    const p = regionMapPrediction(s, simulateTimeSlot(s));
    expect(p.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["new"]);
    expect(p.options.find((o) => o.id === "new")?.label).toMatch(/^1:/);
  });

  it("zero-delay-prints: the correct log is the model's, and every distractor differs from it", () => {
    const s = zeroDelayPrintsScenario();
    const options = outputOrderOptions(s);
    const correct = options.filter((o) => o.correct);
    expect(correct).toHaveLength(1);
    expect(correct[0].label).toBe("$display: q=0  →  $display: q=0  →  $strobe: q=5");
    // The "#0 waits for NBA" misconception would print the new value after #0.
    expect(options.find((o) => o.id === "zero-waits-for-nba")?.label).toBe("$display: q=0  →  $display: q=5  →  $strobe: q=5");
    expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
  });
});

describe("sv-region-map-model: region quiz answer key", () => {
  const quiz = buildRegionQuiz();
  const region = (id: string) => (quiz.find((q) => q.id === id) as RegionQuestion).answer;

  it("starts with an Active question", () => {
    expect(quiz[0].type).toBe("region");
    expect((quiz[0] as RegionQuestion).answer).toBe("active");
  });

  it("matches IEEE 1800-2023 §4.4.2 for every event it asks about", () => {
    expect(region("blocking-write")).toBe("active");
    expect(region("nba-update")).toBe("nba");
    expect(region("nba-rhs")).toBe("active");
    expect(region("zero-delay-resume")).toBe("inactive");
    expect(region("strobe")).toBe("postponed");
    expect(region("cb-sample")).toBe("preponed");
    expect(region("cb-event")).toBe("observed");
    expect(region("cb-drive")).toBe("reNba");
    expect(region("program-code")).toBe("reactive");
    expect(region("program-zero-delay")).toBe("reInactive");
    expect(region("comb-after-nba")).toBe("active");
  });

  it("the cb.q answer is the Preponed snapshot: the value read differs from q at the time of the read", () => {
    const s = testbenchDriveScenario("clocking");
    const run = simulateTimeSlot(s);
    const read = run.trace.find((st) => st.stmtId === "tb2" && st.kind === "statement");
    expect(read?.values.seen).toBe(run.trace[0].values.q);
    expect(read?.values.q).not.toBe(run.trace[0].values.q);
  });

  it("covers all nine regions, never mentions final, and every focus line exists in the code", () => {
    const answers = new Set(quiz.filter((q): q is RegionQuestion => q.type === "region").map((q) => q.answer));
    expect([...answers].sort()).toEqual([...REGION_ORDER].sort());
    for (const q of quiz) {
      expect(q.code.map((l) => l.text).join("\n")).not.toMatch(/\bfinal\b/);
      if (q.focusKey) expect(q.code.some((l) => l.key === q.focusKey)).toBe(true);
    }
  });

  it("explains resumes and wake-ups with the step that caused them", () => {
    const why = (id: string) => (quiz.find((q) => q.id === id) as RegionQuestion).why;
    expect(why("zero-delay-resume")).toMatch(/#0 moves the rest of the process to Inactive/);
    expect(why("program-zero-delay")).toMatch(/#0 moves the rest of the process to Re-Inactive/);
    expect(why("comb-after-nba")).toMatch(/q updates 0 → 1\..*wakes assign y/);
  });

  it("re-evaluating `assign y = q` happens in a later delta than the edge", () => {
    expect((quiz.find((q) => q.id === "comb-after-nba") as RegionQuestion).delta).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scheduler-model-v2: assertion and finish landings, next-region decisions
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

import { type SvScenario } from "@/lib/sv-scheduler-model";
import {
  NEXT_REGION_OPTIONS,
  decisionFeedback,
  decisionQuestion,
  explainDecision,
  isDecisionAnswer,
  nextRegionOptions,
  regionDecisions,
  type NextRegionAnswer,
} from "@/lib/sv-region-map-model";

const hash16 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** A flop, an assertion on the pre-edge q with a pass print, and an optional $finish in Active. */
const assertionScenario = (finishInActive = false): SvScenario => ({
  id: "assert-landings",
  title: "assertion landings",
  clock: "clk",
  initial: { clk: 0, d: 1, q: 0 },
  watch: ["clk", "q"],
  processes: [
    { id: "FF", label: "always_ff", owner: "design", context: "module", header: "always_ff @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "f1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }] },
    {
      id: "A",
      label: "a_low",
      owner: "design",
      context: "module",
      kind: "assertion",
      header: "a_low: assert property",
      trigger: { kind: "posedge", signal: "clk" },
      body: [],
      assertion: {
        property: { kind: "eq", left: { kind: "var", name: "q" }, right: { kind: "const", value: 0 } },
        pass: [{ kind: "display", id: "a1", signals: [], label: "PASS", args: [{ label: "$sampled(q)", expr: { kind: "sampledFn", name: "q" } }, { label: "q", expr: { kind: "var", name: "q" } }] }],
      },
    },
    ...(finishInActive
      ? [{ id: "T", label: "initial", owner: "testbench" as const, context: "module" as const, header: "initial @(posedge clk)", trigger: { kind: "posedge" as const, signal: "clk" }, body: [{ kind: "finish" as const, id: "fin" }] }]
      : []),
  ],
});

describe("sv-region-map-model: assertion and finish landings", () => {
  it("files the sample in Preponed, the evaluation in Observed and the action in Reactive (§16.5.1, §4.4.2.5, §4.4.2.6)", () => {
    const scenario = assertionScenario();
    const run = simulateTimeSlot(scenario);
    const byRegion = groupLandingsByRegion(regionLandings(scenario, run));
    expect(byRegion.preponed.map((l) => [l.kind, l.label])).toEqual([
      ["sample", "sample clk=0 q=0"],
      ["assert-sample", "a_low samples q = 0"],
    ]);
    expect(byRegion.observed.map((l) => [l.kind, l.label, l.executedIn])).toEqual([["assert-eval", "evaluate a_low: pass", "active"]]);
    expect(byRegion.reactive.map((l) => l.kind)).toEqual(["assert-action", "print"]);
    expect(byRegion.reactive[1].label).toBe("$display: PASS $sampled(q)=0 q=1");
    // The evaluation happens after the NBA update that changed q, in a later delta.
    const nbaUpdate = byRegion.nba[0];
    expect(byRegion.observed[0].stepIndex).toBeGreaterThan(nbaUpdate.stepIndex);
    expect(byRegion.observed[0].delta).toBeGreaterThan(nbaUpdate.delta);
  });

  it("files $finish under the region it executed in and stops the map there (§20.2, §9.2.3)", () => {
    const scenario = assertionScenario(true);
    const run = simulateTimeSlot(scenario, [0]);
    const landings = regionLandings(scenario, run);
    const finish = landings.find((l) => l.kind === "finish");
    expect(finish).toMatchObject({ region: "active", label: "$finish" });
    expect(landings.some((l) => l.kind === "assert-eval")).toBe(false);
    expect(landings.every((l) => l.stepIndex <= (finish?.stepIndex ?? -1))).toBe(true);
  });

  it("leaves the quiz answer key exactly as it was before the model was extended", () => {
    expect(hash16(buildRegionQuiz())).toBe("0eccade3e4fce898");
  });
});

describe("sv-region-map-model: a run ended by $finish (§20.2, §24.3, §9.2.3)", () => {
  /** `q <= 1` and a $strobe are queued in Active, then a second process calls $finish. */
  const finishWithStrobe = (): SvScenario => ({
    id: "finish-with-strobe",
    title: "$finish with work queued",
    clock: "clk",
    initial: { clk: 0, q: 0 },
    watch: ["clk", "q"],
    processes: [
      { id: "S", label: "strober", owner: "testbench", context: "module", header: "initial @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "s1", op: "nba", target: "q", expr: { kind: "const", value: 1 } }, { kind: "strobe", id: "s2", signals: ["q"] }] },
      { id: "T", label: "finisher", owner: "testbench", context: "module", header: "initial @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "finish", id: "t1" }] },
    ],
  });

  it("asks what runs next, naming the $finish, instead of claiming the region is empty", () => {
    const run = simulateTimeSlot(finishWithStrobe(), [0]);
    const [decision] = regionDecisions(run);
    expect(run.finished).toBeDefined();
    expect(decision.answer).toBe("end");
    expect(decisionQuestion(decision, run)).toBe(`$finish executed in step ${(run.finished?.stepIndex ?? 0) + 1}. What runs next?`);
    expect(run.trace[run.finished?.stepIndex ?? 0].stmtId).toBe("t1");
  });

  it("reads the queues: the queued $strobe never prints, and neither do queued updates", () => {
    const run = simulateTimeSlot(finishWithStrobe(), [0]);
    const [decision] = regionDecisions(run);
    expect(decisionFeedback(decision, "postponed", run)).toBe("$strobe was queued, but $finish ends the run before Postponed (§9.2.3).");
    expect(decisionFeedback(decision, "nba", run)).toMatch(/^NBA still holds events, but they never execute/);
    expect(decisionFeedback(decision, "inactive", run)).toMatch(/^\$finish ended the run/);
    expect(decisionFeedback(decision, "end", run)).toBe(explainDecision(decision, run));
    expect(nextRegionOptions(run).find((o) => o.id === "end")?.label).toBe("Nothing more runs: the simulation ends");
  });

  it("with nothing queued in Postponed, says Postponed does not run", () => {
    const run = simulateTimeSlot(assertionScenario(true), [0]);
    const [decision] = regionDecisions(run);
    expect(decisionFeedback(decision, "postponed", run)).toBe("Postponed does not run: $finish ends the run before it (§9.2.3).");
  });

  it("names the implicit $finish when the last program thread ended (§24.3)", () => {
    const scenario: SvScenario = {
      id: "implicit-finish",
      title: "last program thread ends",
      clock: "clk",
      initial: { clk: 0 },
      watch: ["clk"],
      processes: [{ id: "P", label: "program thread", owner: "testbench", context: "program", lastThread: true, header: "initial @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "display", id: "p1", signals: ["clk"] }] }],
    };
    const run = simulateTimeSlot(scenario);
    const decision = regionDecisions(run).at(-1);
    if (!decision) throw new Error("no decision");
    expect(decision).toMatchObject({ answer: "end", from: "reactive" });
    expect(decisionQuestion(decision, run)).toMatch(/^The implicit \$finish executed in step \d+\. What runs next\?$/);
    expect(decisionFeedback(decision, "postponed", run)).toBe("Postponed does not run: the implicit $finish ends the run before it (§9.2.3).");
  });
});

describe("sv-region-map-model: next-region decisions read from the trace (IEEE 1800-2023 §4.5)", () => {
  const answers = (scenario: SvScenario) => regionDecisions(simulateTimeSlot(scenario)).map((d) => d.answer);

  it("comb-after-nba: NBA, then the slot ends (Postponed is empty)", () => {
    const decisions = regionDecisions(simulateTimeSlot(combAfterNbaScenario()));
    expect(decisions.map((d) => [d.answer, d.from, d.delta])).toEqual([
      ["nba", "active", 1],
      ["end", "active", 1],
    ]);
    const run = simulateTimeSlot(combAfterNbaScenario());
    expect(run.trace[decisions[0].index].kind).toBe("move");
    expect(run.trace[decisions[1].index].kind).toBe("slot-end");
  });

  it("zero-delay-prints: Inactive, NBA, Postponed, and nothing is asked after Postponed", () => {
    expect(answers(zeroDelayPrintsScenario())).toEqual(["inactive", "nba", "postponed"]);
  });

  it("program-reactive: NBA, the reactive set, Re-NBA, back to Active, end", () => {
    const decisions = regionDecisions(simulateTimeSlot(programReactiveScenario()));
    expect(decisions.map((d) => d.answer)).toEqual(["nba", "reactive-set", "reNba", "active", "end"]);
    expect(decisions.map((d) => d.from)).toEqual(["active", "active", "reactive", "reactive", "active"]);
    expect(decisions.map((d) => d.delta)).toEqual([1, 1, 2, 2, 2]);
  });

  it("tb-clocking-block: entering the reactive set through an empty Reactive is one decision, and either name for it is correct", () => {
    const run = simulateTimeSlot(testbenchDriveScenario("clocking"));
    const decisions = regionDecisions(run);
    expect(decisions.map((d) => d.answer)).toEqual(["nba", "observed", "reNba", "end"]);
    expect(new Set(decisions.map((d) => d.index)).size).toBe(decisions.length);
    const entry = decisions[2];
    expect(entry).toMatchObject({ from: "active", alsoCorrect: "reactive-set", delta: 3 });
    expect(run.trace[entry.index]).toMatchObject({ kind: "move", region: "reNba" });
    expect(isDecisionAnswer(entry, "reNba")).toBe(true);
    expect(isDecisionAnswer(entry, "reactive-set")).toBe(true);
    expect(isDecisionAnswer(entry, "active")).toBe(false);
    expect(decisionFeedback(entry, "reactive-set", run)).toBe(explainDecision(entry, run));
    expect(explainDecision(entry, run)).toMatch(/turned to the reactive set\. Reactive itself holds nothing, so Re-NBA.*§4\.4\.2\.8, §14\.16, §4\.5/);
    expect(decisionFeedback(entry, "active", run)).toMatch(/Nothing sends the loop back to Active until the reactive set has run/);
    expect(decisionFeedback(entry, "end", run)).toMatch(/cannot end while Re-NBA still holds events/);
  });

  it("a program <= that clocks an assertion: the return to the active set lands on Observed, never claiming Active holds work", () => {
    const scenario: SvScenario = {
      id: "program-clocks-assertion",
      title: "program drives the assertion clock",
      clock: "tick",
      initial: { tick: 0, clk: 0, q: 0 },
      watch: ["tick", "clk"],
      processes: [
        { id: "TB", label: "program thread", owner: "testbench", context: "program", header: "initial @(posedge tick)", trigger: { kind: "posedge", signal: "tick" }, body: [{ kind: "assign", id: "tb1", op: "nba", target: "clk", expr: { kind: "const", value: 1 } }] },
        { id: "A", label: "a_low", owner: "design", context: "module", kind: "assertion", header: "a_low: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "eq", left: { kind: "var", name: "q" }, right: { kind: "const", value: 0 } } } },
      ],
    };
    const run = simulateTimeSlot(scenario);
    const decisions = regionDecisions(run);
    expect(decisions.map((d) => d.answer)).toEqual(["reactive-set", "reNba", "observed", "end"]);
    const back = decisions[2];
    expect(back).toMatchObject({ from: "reactive", alsoCorrect: "active" });
    expect(isDecisionAnswer(back, "active")).toBe(true);
    expect(run.trace[back.index - 1].queues.active).toHaveLength(0);
    expect(explainDecision(back, run)).toMatch(/Active itself holds nothing, so Observed, the first region of that set with events, moves into Active/);
    expect(explainDecision(back, run)).not.toMatch(/woke design processes/);
  });

  it("asks where the loop goes from the region that ran dry, counting steps from 1", () => {
    const run = simulateTimeSlot(combAfterNbaScenario());
    const [first] = regionDecisions(run);
    expect(decisionQuestion(first, run)).toBe(`Active is empty after step ${first.index}. Where does the scheduler go next?`);
    expect(run.trace[first.index - 1].kind).not.toBe("move");
  });

  it("a $finish in Active ends the slot: the only decision is the end, explained by the finish", () => {
    const run = simulateTimeSlot(assertionScenario(true), [0]);
    const decisions = regionDecisions(run);
    expect(decisions.map((d) => d.answer)).toEqual(["end"]);
    expect(explainDecision(decisions[0], run)).toMatch(/\$finish ended the run inside the slot/);
  });

  it("offers the same nine options at every decision and never copies the standard's pseudocode", () => {
    expect(NEXT_REGION_OPTIONS).toHaveLength(9);
    expect(NEXT_REGION_OPTIONS.map((o) => o.label)).toEqual(expect.arrayContaining(["Postponed, which has output to print", "Postponed is empty: the slot ends"]));
    expect(nextRegionOptions(simulateTimeSlot(programReactiveScenario()))).toBe(NEXT_REGION_OPTIONS);
    expect(new Set(NEXT_REGION_OPTIONS.map((o) => o.id)).size).toBe(9);
    const run = simulateTimeSlot(programReactiveScenario());
    for (const decision of regionDecisions(run)) {
      const text = explainDecision(decision, run);
      expect(text).toMatch(/Δ is now \d+: the model's count of moves back into Active or Reactive/);
      expect(text).not.toMatch(/first nonempty region|move events in R|execute_region|any region in \[/);
    }
  });

  it("explains wrong options from the queues at that moment", () => {
    const run = simulateTimeSlot(combAfterNbaScenario());
    const [nba, end] = regionDecisions(run);
    const say = (d: typeof nba, option: NextRegionAnswer) => decisionFeedback(d, option, run);
    expect(say(nba, "inactive")).toMatch(/Inactive holds no events at this point/);
    expect(say(nba, "active")).toMatch(/Active is the region that just ran dry/);
    expect(say(nba, "reactive-set")).toMatch(/reactive set starts only once .* NBA still holds events/);
    expect(say(nba, "postponed")).toMatch(/Postponed runs only once every region from Active to Re-NBA is empty; NBA still holds events/);
    expect(say(nba, "end")).toMatch(/cannot end while NBA still holds events/);
    expect(say(nba, "nba")).toBe(explainDecision(nba, run));
    expect(say(end, "postponed")).toMatch(/Postponed has nothing queued here/);
    expect(say(end, "active")).toMatch(/no reason to return to Active/);
    expect(say(end, "nba")).toMatch(/NBA holds no events at this point/);
    const program = regionDecisions(simulateTimeSlot(programReactiveScenario()));
    const programRun = simulateTimeSlot(programReactiveScenario());
    expect(decisionFeedback(program[1], "active", programRun)).toMatch(/Nothing sends the loop back to Active until the reactive set has run and created a design event/);
    expect(decisionFeedback(program[1], "reNba", programRun)).toMatch(/entered through Reactive itself/);
    expect(decisionFeedback(program[1], "end", programRun)).toMatch(/cannot end while Reactive still holds events/);
    expect(decisionFeedback(program[1], "postponed", programRun)).toMatch(/every region from Active to Re-NBA is empty; Reactive still holds events/);
  });

  it("Reactive ran dry with Re-NBA pending: 'Back to Active' is told the reactive set must drain first (§4.5)", () => {
    const run = simulateTimeSlot(programReactiveScenario());
    const decision = regionDecisions(run)[2];
    expect(decision).toMatchObject({ from: "reactive", answer: "reNba" });
    const text = decisionFeedback(decision, "active", run);
    expect(text).toBe("Reactive ran dry, but the reactive set is not finished: Re-NBA still holds events, and the loop only returns to Active once Reactive, Re-Inactive and Re-NBA are all empty (§4.5).");
    expect(text).not.toMatch(/Active is the region that just ran dry/);
    const watcherRun = simulateTimeSlot(programWatcherScenario());
    expect(decisionFeedback(regionDecisions(watcherRun)[2], "active", watcherRun)).toBe(text);
  });

  it("the reactive set offered from an empty active set: the reason is the empty reactive set, not a pending region", () => {
    const expected = "The active set is empty, but so is the whole reactive set: nothing is queued in Reactive, Re-Inactive or Re-NBA, so that loop has nothing to run (§4.5).";
    const comb = simulateTimeSlot(combAfterNbaScenario());
    expect(decisionFeedback(regionDecisions(comb)[1], "reactive-set", comb)).toBe(expected);
    const prints = simulateTimeSlot(zeroDelayPrintsScenario());
    expect(regionDecisions(prints)[2].answer).toBe("postponed");
    expect(decisionFeedback(regionDecisions(prints)[2], "reactive-set", prints)).toBe(expected);
    const program = simulateTimeSlot(programReactiveScenario());
    expect(decisionFeedback(regionDecisions(program)[4], "reactive-set", program)).toBe(expected);
  });

  it("the reactive set offered with active-set work pending: names every pending region, with the right verb", () => {
    const prints = simulateTimeSlot(zeroDelayPrintsScenario());
    const [inactive, nba] = regionDecisions(prints);
    expect(decisionFeedback(inactive, "reactive-set", prints)).toMatch(/all empty; Inactive and NBA still hold events \(§4\.5\)\.$/);
    expect(decisionFeedback(nba, "reactive-set", prints)).toMatch(/all empty; NBA still holds events \(§4\.5\)\.$/);
  });

  it("names regions, not option labels, in its sentences, and says why Active is pending", () => {
    const run = simulateTimeSlot(programReactiveScenario());
    const decisions = regionDecisions(run);
    const back = decisions[3];
    expect(back.answer).toBe("active");
    expect(decisionFeedback(back, "end", run)).toBe("The slot cannot end while Active holds a design process woken by reactive code; time only advances once every region is empty (§4.5).");
    expect(decisionFeedback(back, "postponed", run)).toBe("Postponed runs only once every region from Active to Re-NBA is empty; Active holds a design process woken by reactive code (§4.5).");
    for (const decision of decisions) {
      for (const option of NEXT_REGION_OPTIONS) {
        expect(decisionFeedback(decision, option.id, run)).not.toMatch(/Back to Active still|The reactive set \(Reactive\) still|The slot ends still|Postponed is empty: /);
      }
    }
  });
});
