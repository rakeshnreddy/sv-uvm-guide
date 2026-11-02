import { describe, expect, it } from "vitest";

import {
  exploreOrderings,
  isPosedge,
  scenarioToSource,
  simulateTimeSlot,
  withAssignmentOp,
  withZeroDelay,
} from "@/lib/sv-scheduler-model";
import {
  displayVsStrobeScenario,
  schedulerScenarioPresets,
  shiftRegisterScenario,
  testbenchDriveScenario,
} from "@/lib/sv-scheduler-scenarios";

describe("sv-scheduler-model: shift register", () => {
  it("blocking assignments race: q2 depends on which stage runs first", () => {
    const result = exploreOrderings(shiftRegisterScenario("blocking"));
    expect(result.deterministic).toBe(false);
    const q2Values = result.outcomes.map((o) => o.finalValues.q2).sort();
    expect(q2Values).toEqual([0, 1]);
  });

  it("stage A first makes q2 see the new q1 (data falls through both stages)", () => {
    const run = simulateTimeSlot(shiftRegisterScenario("blocking"), [0]);
    expect(run.executionOrder).toEqual(["A", "B"]);
    expect(run.finalValues).toMatchObject({ q1: 1, q2: 1 });
  });

  it("stage B first makes q2 see the old q1", () => {
    const run = simulateTimeSlot(shiftRegisterScenario("blocking"), [1]);
    expect(run.executionOrder).toEqual(["B", "A"]);
    expect(run.finalValues).toMatchObject({ q1: 1, q2: 0 });
  });

  it("nonblocking assignments are order independent and behave like hardware", () => {
    const result = exploreOrderings(shiftRegisterScenario("nba"));
    expect(result.deterministic).toBe(true);
    expect(result.runCount).toBe(2);
    expect(result.outcomes[0].finalValues).toMatchObject({ q1: 1, q2: 0 });
  });

  it("NBA updates are applied after the Active region empties, in a later delta", () => {
    const run = simulateTimeSlot(shiftRegisterScenario("nba"), [0]);
    const move = run.trace.find((s) => s.kind === "move");
    expect(move?.region).toBe("nba");
    const updates = run.trace.filter((s) => s.kind === "update" && s.changed.includes("q1"));
    expect(updates).toHaveLength(1);
    expect(updates[0].delta).toBeGreaterThan(0);
    // Both stages read before either write lands.
    const readsBeforeWrite = run.trace
      .filter((s) => s.kind === "statement" && s.stmtId)
      .every((s) => s.index < updates[0].index);
    expect(readsBeforeWrite).toBe(true);
  });

  it("mixing one blocking and one nonblocking stage is still evaluated per ordering", () => {
    const mixed = withAssignmentOp(shiftRegisterScenario("nba"), "a1", "blocking");
    const result = exploreOrderings(mixed);
    expect(result.deterministic).toBe(false);
  });

  it("#0 on the reader postpones it to Inactive and hides the race in this two-process case", () => {
    const patched = withZeroDelay(shiftRegisterScenario("blocking"), "B", true);
    const result = exploreOrderings(patched);
    expect(result.deterministic).toBe(true);
    expect(result.outcomes[0].finalValues.q2).toBe(1);
    const run = simulateTimeSlot(patched, [1]);
    expect(run.trace.some((s) => s.kind === "suspend")).toBe(true);
    expect(run.trace.some((s) => s.kind === "move" && s.region === "inactive")).toBe(true);
  });

  it("#0 on both stages re-creates the race one region later", () => {
    const both = withZeroDelay(withZeroDelay(shiftRegisterScenario("blocking"), "B", true), "A", true);
    const result = exploreOrderings(both);
    expect(result.deterministic).toBe(false);
  });
});

describe("sv-scheduler-model: testbench drive styles", () => {
  it("blocking TB drive races with the DUT flop sampling the same input", () => {
    const result = exploreOrderings(testbenchDriveScenario("blocking"));
    expect(result.deterministic).toBe(false);
    expect(result.outcomes.map((o) => o.finalValues.q).sort()).toEqual([3, 7]);
  });

  it("nonblocking TB drive lets the flop capture the pre-edge value in every ordering", () => {
    const result = exploreOrderings(testbenchDriveScenario("nba"));
    expect(result.deterministic).toBe(true);
    expect(result.outcomes[0].finalValues).toMatchObject({ q: 3, din: 7 });
  });

  it("clocking block samples in Preponed and drives in Re-NBA", () => {
    const scenario = testbenchDriveScenario("clocking");
    const result = exploreOrderings(scenario);
    expect(result.deterministic).toBe(true);
    // cb.q returns the pre-edge sample even though q changes in NBA.
    expect(result.outcomes[0].finalValues).toMatchObject({ q: 3, din: 7, seen: 1 });
    const run = simulateTimeSlot(scenario, [0]);
    const dinUpdate = run.trace.find((s) => s.kind === "update" && s.changed.includes("din"));
    const qUpdate = run.trace.find((s) => s.kind === "update" && s.changed.includes("q"));
    expect(dinUpdate?.region).toBe("reactive");
    expect(qUpdate?.region).toBe("active");
    expect((qUpdate?.index ?? 0) < (dinUpdate?.index ?? 0)).toBe(true);
    expect(run.trace.some((s) => s.kind === "move" && s.region === "reNba")).toBe(true);
  });
});

describe("sv-scheduler-model: printing", () => {
  it("$display shows the pre-NBA value and $strobe shows the settled value", () => {
    const run = simulateTimeSlot(displayVsStrobeScenario());
    expect(run.log).toEqual(["$display: q=0", "$strobe: q=5"]);
    const strobeStep = run.trace.find((s) => s.kind === "print" && s.region === "postponed");
    expect(strobeStep).toBeDefined();
  });
});

describe("sv-scheduler-model: trace integrity", () => {
  it.each(schedulerScenarioPresets.map((p) => [p.id, p] as const))("%s produces a replayable trace", (_id, preset) => {
    const scenario = preset.build();
    const first = simulateTimeSlot(scenario, [0]);
    const second = simulateTimeSlot(scenario, [0]);
    expect(second.trace).toEqual(first.trace);
    expect(first.trace[0].kind).toBe("slot-start");
    expect(first.trace[0].values).toEqual(scenario.initial);
    expect(first.trace.at(-1)?.kind).toBe("slot-end");
    first.trace.forEach((step, index) => expect(step.index).toBe(index));
    // Every statement step points at a line that exists in the generated source.
    const stmtIds = new Set(scenarioToSource(scenario).map((l) => l.stmtId).filter(Boolean));
    first.trace.filter((s) => s.stmtId).forEach((s) => expect(stmtIds.has(s.stmtId)).toBe(true));
  });

  it("generated source reflects the model's operators", () => {
    const text = scenarioToSource(shiftRegisterScenario("nba")).map((l) => l.text);
    expect(text).toContain("always @(posedge clk) q1 <= d;");
    const blocking = scenarioToSource(withAssignmentOp(shiftRegisterScenario("nba"), "b1", "blocking")).map((l) => l.text);
    expect(blocking).toContain("always @(posedge clk) q2 = q1;");
  });
});

describe("sv-scheduler-model: region provenance", () => {
  it("labels moved NBA and Re-NBA updates with the region they were scheduled in", () => {
    const nbaRun = simulateTimeSlot(shiftRegisterScenario("nba"), [0]);
    const q1Update = nbaRun.trace.find((s) => s.kind === "update" && s.changed.includes("q1"));
    expect(q1Update?.sourceRegion).toBe("nba");
    const clockUpdate = nbaRun.trace.find((s) => s.kind === "update" && s.changed.includes("clk"));
    expect(clockUpdate?.sourceRegion).toBeUndefined();
    const cbRun = simulateTimeSlot(testbenchDriveScenario("clocking"), [0]);
    const dinUpdate = cbRun.trace.find((s) => s.kind === "update" && s.changed.includes("din"));
    expect(dinUpdate?.sourceRegion).toBe("reNba");
  });
});

describe("sv-scheduler-model: static race hazards", () => {
  it("names the blocking write and the racing read", async () => {
    const { findRaceHazards } = await import("@/lib/sv-scheduler-model");
    const hazards = findRaceHazards(shiftRegisterScenario("blocking"));
    expect(hazards).toHaveLength(1);
    expect(hazards[0]).toMatchObject({ variable: "q1", writer: { stmtId: "a1" }, reader: { stmtId: "b1" } });
    expect(findRaceHazards(shiftRegisterScenario("nba"))).toHaveLength(0);
    const tb = findRaceHazards(testbenchDriveScenario("blocking"));
    expect(tb.map((h) => `${h.writer.stmtId}->${h.reader.stmtId}`)).toEqual(["tb1->dut1"]);
    expect(findRaceHazards(testbenchDriveScenario("clocking"))).toHaveLength(0);
  });

  it("agrees with exhaustive exploration for every preset", async () => {
    const { findRaceHazards } = await import("@/lib/sv-scheduler-model");
    for (const preset of schedulerScenarioPresets) {
      const scenario = preset.build();
      expect(findRaceHazards(scenario).length > 0).toBe(!exploreOrderings(scenario).deterministic);
    }
  });
});

describe("sv-scheduler-model: clocking block event timing (IEEE 1800-2023 §14.10)", () => {
  it("@(cb) is triggered in Observed, so the driver runs after the design's NBA updates", () => {
    const scenario = testbenchDriveScenario("clocking");
    const result = exploreOrderings(scenario);
    // No same-region choice exists between the DUT flop and the @(cb) process.
    expect(result.runCount).toBe(1);
    const run = simulateTimeSlot(scenario);
    const cbEvent = run.trace.find((s) => s.kind === "wake" && /Clocking block event @\(cb\)/.test(s.what));
    expect(cbEvent?.sourceRegion).toBe("observed");
    const qUpdate = run.trace.findIndex((s) => s.kind === "update" && s.changed.includes("q"));
    const tbStart = run.trace.findIndex((s) => s.kind === "wake" && s.processId === "TB");
    expect(qUpdate).toBeGreaterThan(-1);
    expect(tbStart).toBeGreaterThan(qUpdate);
    // Even though q already holds its new value, cb.q still returns the Preponed sample.
    expect(run.finalValues).toMatchObject({ q: 3, seen: 1, din: 7 });
  });
});

// ---------------------------------------------------------------------------
// Model additions (scheduler-model-v2). Every one is opt-in data; the first
// block proves that nothing changed for the scenarios that do not use them.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

import {
  ASSERTION_TYPE_BITS,
  DEFAULT_SLOT_TIME,
  assertionSampledSignals,
  exprNames,
  findRaceHazards,
  slotTimeLabel,
  withInterleaveNba,
  type SvScenario,
  type SvValue,
} from "@/lib/sv-scheduler-model";
import { programReactiveScenario, regionMapScenarioPresets } from "@/lib/sv-scheduler-scenarios";

const hash16 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** Every legal ordering's trace of a scenario, hashed. */
const traceSetHash = (scenario: SvScenario) =>
  hash16(
    exploreOrderings(scenario)
      .outcomes.flatMap((o) => o.runs)
      .map((r) => simulateTimeSlot(scenario, r.choices).trace),
  );

describe("sv-scheduler-model: additions are opt-in, so existing traces are unchanged", () => {
  // Hashes of every preset's full trace set, computed with the model as it was
  // before inv/resume/slotTime/assertions/finish/check/interleaveNba existed.
  const BASELINE: Record<string, string> = {
    "shift-blocking": "882e8eac82f79f09",
    "shift-nba": "d092e0757e6d3bee",
    "tb-blocking-drive": "455a40033a6c22e4",
    "tb-nba-drive": "4475be1c0c439984",
    "tb-clocking-block": "3cfe14b26578a8c7",
    "display-vs-strobe": "ba0cf7a52032098a",
    "comb-after-nba": "e830aa7592fd7c89",
    "zero-delay-prints": "2bc9ed90fd6b6553",
    "program-reactive": "192cbbf8c44691d2",
  };

  it.each([...schedulerScenarioPresets, ...regionMapScenarioPresets].map((p) => [p.id, p] as const))("%s: every legal ordering produces the trace it did before the extension", (id, preset) => {
    expect(traceSetHash(preset.build())).toBe(BASELINE[id]);
  });

  it("the #0 variants the region quiz uses are unchanged too", () => {
    expect(hash16(simulateTimeSlot(withZeroDelay(shiftRegisterScenario("blocking"), "B", true)).trace)).toBe("4aff938999a1fe32");
    expect(hash16(simulateTimeSlot(withZeroDelay(programReactiveScenario(), "TB", true)).trace)).toBe("3142098ff4f28af0");
  });

  it("the slot time defaults to 10 ns and is reported on the result", () => {
    const run = simulateTimeSlot(combAfterNbaScenarioFixture());
    expect(run.slotTime).toBe(DEFAULT_SLOT_TIME);
    expect(run.finished).toBeUndefined();
    expect(slotTimeLabel({})).toBe("t = 10 ns");
    expect(slotTimeLabel({ slotTime: 5 })).toBe("t = 5 ns");
  });
});

function combAfterNbaScenarioFixture(): SvScenario {
  return regionMapScenarioPresets[0].build();
}

// ---------------------------------------------------------------------------
// (1) inv and eq expressions
// ---------------------------------------------------------------------------

const invScenario = (u: SvValue): SvScenario => ({
  id: "inv",
  title: "~ and ==",
  clock: "clk",
  initial: { clk: 0, q: 0, y: 1, u, n: "X", e: "X" },
  watch: ["clk", "q", "y", "n", "e"],
  processes: [
    {
      id: "FF",
      label: "toggle",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "t1", op: "nba", target: "q", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }],
    },
    {
      id: "CA",
      label: "assign y",
      owner: "design",
      context: "module",
      header: "assign",
      trigger: { kind: "change", signals: ["q"] },
      body: [{ kind: "assign", id: "c1", op: "blocking", target: "y", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }],
    },
    {
      id: "P",
      label: "probe",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "assign", id: "p1", op: "blocking", target: "n", expr: { kind: "inv", expr: { kind: "var", name: "u" } } },
        { kind: "assign", id: "p2", op: "blocking", target: "e", expr: { kind: "eq", left: { kind: "var", name: "u" }, right: { kind: "const", value: 0 } } },
      ],
    },
  ],
});

describe("sv-scheduler-model: inv and eq (IEEE 1800-2023 §11.4.8 bitwise negation, §11.4.5 equality)", () => {
  it("~ maps 0 → 1 and 1 → 0, and the continuous assignment follows the toggled q in the same slot", () => {
    const run = simulateTimeSlot(invScenario(1), [0]);
    expect(run.finalValues).toMatchObject({ q: 1, y: 0, n: 0, e: 0 });
  });

  it("~X stays X, and X == 0 is X (Table 11-9: == can be unknown)", () => {
    const run = simulateTimeSlot(invScenario("X"), [0]);
    expect(run.finalValues).toMatchObject({ n: "X", e: "X" });
    const eq0 = simulateTimeSlot(invScenario(0), [0]);
    expect(eq0.finalValues.e).toBe(1);
  });

  it("renders ~q, q == 0 and ~(a == b) as source", () => {
    const text = scenarioToSource(invScenario(1)).map((l) => l.text);
    expect(text).toContain("always_ff @(posedge clk) q <= ~q;");
    expect(text).toContain("assign y = ~q;");
    expect(text).toContain("  e = u == 0;");
    expect(exprNames({ kind: "inv", expr: { kind: "eq", left: { kind: "var", name: "a" }, right: { kind: "sampledFn", name: "b" } } }, "live")).toEqual(["a"]);
    expect(exprNames({ kind: "inv", expr: { kind: "eq", left: { kind: "var", name: "a" }, right: { kind: "sampledFn", name: "b" } } }, "sampled")).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// (2) resume trigger, (3) slotTime and $time, and the F3A one-edge slot
// ---------------------------------------------------------------------------

/** F3A §"one edge": `always #5 clk = ~clk` drives the edge from inside the slot at t = 5. */
const oneEdgeScenario = (): SvScenario => ({
  id: "f3a-one-edge",
  title: "One clock edge, driven by always #5",
  clock: "clk",
  clockSource: "process",
  slotTime: 5,
  initial: { clk: 0, d: 1, q: 0, q_n: 1 },
  watch: ["clk", "d", "q", "q_n"],
  processes: [
    {
      id: "CLK",
      label: "clock",
      owner: "design",
      context: "module",
      header: "always #5",
      trigger: { kind: "resume", note: "#5 books t = 10" },
      body: [{ kind: "assign", id: "k1", op: "blocking", target: "clk", expr: { kind: "inv", expr: { kind: "var", name: "clk" } } }],
    },
    {
      id: "FF",
      label: "always_ff",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "f1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "QN",
      label: "assign q_n",
      owner: "design",
      context: "module",
      header: "assign",
      trigger: { kind: "change", signals: ["q"] },
      body: [{ kind: "assign", id: "n1", op: "blocking", target: "q_n", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }],
    },
    {
      id: "P",
      label: "initial",
      owner: "testbench",
      context: "module",
      header: "initial @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "display", id: "p1", signals: ["q", "q_n"], label: "display", showTime: true },
        { kind: "strobe", id: "p2", signals: ["q", "q_n"], label: "strobe", showTime: true },
        { kind: "delay", id: "p3", units: 1 },
      ],
    },
  ],
});

describe("sv-scheduler-model: resume trigger and slot time (IEEE 1800-2023 §4.5, §9.4.1, §20.3.1)", () => {
  it("a 'resume' process is ready in Active at slot start and its blocking write of clk is the edge that wakes the others", () => {
    const run = simulateTimeSlot(oneEdgeScenario(), [0]);
    const firstActive = run.trace.find((s) => s.region === "active");
    expect(firstActive).toMatchObject({ kind: "wake", processId: "CLK" });
    expect(firstActive?.why).toMatch(/Ready at the start of the slot: #5 books t = 10/);
    const edge = run.trace.find((s) => s.kind === "statement" && s.stmtId === "k1");
    expect(edge?.changed).toEqual(["clk"]);
    expect(edge?.why).toMatch(/wakes always_ff, initial/);
    // No implicit clock update event exists when the scenario drives its own clock.
    expect(run.trace.some((s) => s.kind === "update" && s.changed.includes("clk"))).toBe(false);
    expect(run.finalValues).toMatchObject({ clk: 1, q: 1, q_n: 0 });
  });

  it("$time prints the slot time; $display sees the old q and $strobe the settled q (§4.4.2.9)", () => {
    const run = simulateTimeSlot(oneEdgeScenario(), [0]);
    expect(run.slotTime).toBe(5);
    expect(run.log).toEqual(["$display: 5 display q=0 q_n=1", "$strobe: 5 strobe q=1 q_n=0"]);
    const text = scenarioToSource(oneEdgeScenario()).map((l) => l.text);
    expect(text).toContain("always #5 clk = ~clk;");
    expect(text).toContain('  $display("%0d display q=%0d q_n=%0d", $time, q, q_n);');
    expect(text).toContain("  #1;");
  });

  it("the two processes woken by the edge are a scheduler choice, and the output does not depend on it (§4.7)", () => {
    const result = exploreOrderings(oneEdgeScenario());
    expect(result.runCount).toBe(2);
    expect(result.deterministic).toBe(true);
  });

  it("#1 suspends the process until a later time slot (§9.4.1): the rest of the body does not run here", () => {
    const run = simulateTimeSlot(oneEdgeScenario(), [0]);
    const suspend = run.trace.find((s) => s.kind === "suspend" && s.stmtId === "p3");
    expect(suspend?.why).toMatch(/until t = 6 ns, a later time slot/);
    expect(run.trace.filter((s) => s.processId === "P" && s.kind === "statement" && /finishes and waits/.test(s.what))).toHaveLength(0);
    expect(run.finished).toBeUndefined();
  });

  it("the resume process re-arms on its next delay", () => {
    const run = simulateTimeSlot(oneEdgeScenario(), [0]);
    const done = run.trace.find((s) => s.processId === "CLK" && /finishes and waits/.test(s.what));
    expect(done?.why).toBe("Its next delay (#5 books t = 10) expires in a later time slot.");
  });
});

// ---------------------------------------------------------------------------
// (4) concurrent assertions, (5) $finish and the implicit program $finish
// ---------------------------------------------------------------------------

interface WorkedExampleOptions {
  /** `$finish` right after `$strobe` instead of `#1 $finish`. */
  finishNow?: boolean;
  /** Delete the program's second `@(posedge clk)`: its thread ends after REACT. */
  lastThread?: boolean;
  /** Print plain `q` in the pass action instead of `$sampled(q)`. */
  plainQ?: boolean;
  initialQ?: SvValue;
}

/** F3B "Worked example: one time slot, region by region" (t = 5). */
const workedExample = (opts: WorkedExampleOptions = {}): SvScenario => ({
  id: "f3b-worked-example",
  title: "One time slot, region by region",
  clock: "clk",
  clockSource: "process",
  slotTime: 5,
  initial: { clk: 0, d: 1, q: opts.initialQ ?? 0, y: opts.initialQ ?? 0 },
  watch: ["clk", "q", "y"],
  processes: [
    {
      id: "CLK",
      label: "clock",
      owner: "design",
      context: "module",
      header: "always #5",
      trigger: { kind: "resume", note: "#5 books t = 10" },
      body: [{ kind: "assign", id: "k1", op: "blocking", target: "clk", expr: { kind: "inv", expr: { kind: "var", name: "clk" } } }],
    },
    {
      id: "FF",
      label: "always_ff",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "f1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "CA",
      label: "assign y",
      owner: "design",
      context: "module",
      header: "assign",
      trigger: { kind: "change", signals: ["q"] },
      body: [{ kind: "assign", id: "c1", op: "blocking", target: "y", expr: { kind: "var", name: "q" } }],
    },
    {
      id: "A",
      label: "a_q_was_low",
      owner: "design",
      context: "module",
      kind: "assertion",
      header: "a_q_was_low: assert property",
      trigger: { kind: "posedge", signal: "clk" },
      body: [],
      assertion: {
        property: { kind: "eq", left: { kind: "var", name: "q" }, right: { kind: "const", value: 0 } },
        pass: [
          {
            kind: "display",
            id: "a1",
            signals: [],
            label: "ACTION",
            showTime: true,
            args: [
              opts.plainQ ? { label: "q", expr: { kind: "var", name: "q" } } : { label: "$sampled(q)", expr: { kind: "sampledFn", name: "q" } },
              { label: "q", expr: { kind: "var", name: "q" } },
            ],
          },
        ],
        fail: [{ kind: "display", id: "a2", signals: [], label: "FAIL", showTime: true, task: "error", args: [{ label: "$sampled(q)", expr: { kind: "sampledFn", name: "q" } }] }],
      },
    },
    {
      id: "TB",
      label: "initial",
      owner: "testbench",
      context: "module",
      header: "initial @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "display", id: "t1", signals: ["q", "y"], label: "ACTIVE", showTime: true },
        { kind: "delay0", id: "t2" },
        { kind: "display", id: "t3", signals: ["q", "y"], label: "INACT", showTime: true },
        { kind: "strobe", id: "t4", signals: ["q", "y"], label: "POSTP", showTime: true },
        ...(opts.finishNow ? [] : [{ kind: "delay", id: "t5", units: 1 } as const]),
        { kind: "finish", id: "t6" },
      ],
    },
    {
      id: "PR",
      label: "program thread",
      owner: "testbench",
      context: "program",
      header: "initial @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "display", id: "r1", signals: ["q", "y"], label: "REACT", showTime: true }],
      lastThread: opts.lastThread ?? false,
      sourceTail: opts.lastThread ? [] : ["@(posedge clk);"],
    },
  ],
});

const logsOf = (scenario: SvScenario) =>
  exploreOrderings(scenario)
    .outcomes.map((o) => o.log)
    .sort((a, b) => a.join().localeCompare(b.join()));

describe("sv-scheduler-model: concurrent assertions (IEEE 1800-2023 §16.5.1 sampling, §4.4.2.5 Observed, §4.4.2.6 Reactive, §16.9.3 $sampled)", () => {
  it("samples the property's signals in Preponed, before any process runs", () => {
    const run = simulateTimeSlot(workedExample(), [0]);
    expect(run.trace[0].kind).toBe("slot-start");
    const sample = run.trace[1];
    expect(sample).toMatchObject({ kind: "sample", region: "preponed", processId: "A", assertion: { phase: "sample" } });
    expect(sample.what).toBe("a_q_was_low samples q = 0.");
    expect(assertionSampledSignals(workedExample().processes[3])).toEqual(["q"]);
  });

  it("is evaluated in Observed, after the NBA update of q, yet passes on the sampled q = 0", () => {
    const run = simulateTimeSlot(workedExample(), [0]);
    const qUpdate = run.trace.findIndex((s) => s.kind === "update" && s.changed.includes("q"));
    const evaluation = run.trace.find((s) => s.assertion?.phase === "evaluate");
    expect(evaluation).toMatchObject({ kind: "statement", region: "active", sourceRegion: "observed", processId: "A", assertion: { phase: "evaluate", outcome: "pass" } });
    expect(evaluation!.index).toBeGreaterThan(qUpdate);
    expect(evaluation!.values.q).toBe(1);
    expect(evaluation!.what).toMatch(/q == 0 on the sampled values \(q = 0\): it passes/);
  });

  it("runs the pass action in Reactive, where plain q is current but $sampled(q) is the Preponed value", () => {
    const run = simulateTimeSlot(workedExample(), [0]);
    const action = run.trace.find((s) => s.assertion?.phase === "action" && s.kind === "wake");
    expect(action).toMatchObject({ region: "reactive", processId: "A" });
    expect(run.log).toContain("$display: 5 ACTION $sampled(q)=0 q=1");
    expect(simulateTimeSlot(workedExample({ plainQ: true }), [0]).log).toContain("$display: 5 ACTION q=1 q=1");
  });

  it("fails on q = 1 and on q = X (a property that is 0 or X is false, §16.6), running the else block with $error", () => {
    const failing = simulateTimeSlot(workedExample({ initialQ: 1 }), [0]);
    expect(failing.trace.find((s) => s.assertion?.phase === "evaluate")?.assertion?.outcome).toBe("fail");
    expect(failing.log).toContain("$error: 5 FAIL $sampled(q)=1");
    const unknown = simulateTimeSlot(workedExample({ initialQ: "X" }), [0]);
    expect(unknown.trace.find((s) => s.assertion?.phase === "evaluate")?.assertion?.outcome).toBe("fail");
    expect(unknown.log).toContain("$error: 5 FAIL $sampled(q)=X");
  });

  it("reproduces the F3B worked example: ACTIVE, INACT, then REACT and ACTION in either order (§4.7), then POSTP", () => {
    const logs = logsOf(workedExample());
    expect(logs).toHaveLength(2);
    for (const log of logs) {
      expect(log).toHaveLength(5);
      expect(log.slice(0, 2)).toEqual(["$display: 5 ACTIVE q=0 y=0", "$display: 5 INACT q=0 y=0"]);
      expect(log.slice(2, 4).sort()).toEqual(["$display: 5 ACTION $sampled(q)=0 q=1", "$display: 5 REACT q=1 y=1"]);
      expect(log[4]).toBe("$strobe: 5 POSTP q=1 y=1");
    }
  });

  it("renders the assertion with its clock, property and action blocks, and the program's trailing wait", () => {
    const text = scenarioToSource(workedExample()).map((l) => l.text);
    expect(text).toContain("a_q_was_low: assert property (@(posedge clk) q == 0)");
    expect(text).toContain('  $display("%0d ACTION $sampled(q)=%0d q=%0d", $time, $sampled(q), q);');
    expect(text).toContain('  else $error("%0d FAIL $sampled(q)=%0d", $time, $sampled(q));');
    expect(text).toContain("  @(posedge clk);");
    expect(text).toContain("  $finish;");
    expect(findRaceHazards(workedExample())).toHaveLength(0);
  });
});

describe("sv-scheduler-model: $finish (IEEE 1800-2023 §20.2, §9.2.3) and the implicit program $finish (§24.3)", () => {
  it("#1 $finish does not end this slot: the program, the action block and $strobe all still print", () => {
    const run = simulateTimeSlot(workedExample(), [0]);
    expect(run.finished).toBeUndefined();
    expect(run.log.at(-1)).toBe("$strobe: 5 POSTP q=1 y=1");
  });

  it("$finish right after $strobe ends the run at once: no later region runs, Postponed included", () => {
    const run = simulateTimeSlot(workedExample({ finishNow: true }), [0]);
    expect(run.log).toEqual(["$display: 5 ACTIVE q=0 y=0", "$display: 5 INACT q=0 y=0"]);
    expect(run.finished).toMatchObject({ cause: "finish", processId: "TB", stmtId: "t6" });
    const finish = run.trace[run.finished!.stepIndex];
    expect(finish).toMatchObject({ kind: "statement", endedBy: "finish", stmtId: "t6", sourceRegion: "inactive" });
    // The NBA update of q was still queued when the run ended.
    expect(run.finalValues.q).toBe(0);
    expect(run.trace.at(-1)).toMatchObject({ kind: "slot-end", endedBy: "finish" });
    expect(run.trace.at(-1)!.why).toMatch(/never execute/);
    expect(run.trace.some((s) => s.region === "postponed")).toBe(false);
  });

  it("when the program's last thread ends, the implicit $finish stops the slot: POSTP disappears and ACTION survives only when it ran first", () => {
    const logs = logsOf(workedExample({ lastThread: true }));
    expect(logs).toHaveLength(2);
    const withAction = logs.find((l) => l.some((line) => /ACTION/.test(line)));
    const withoutAction = logs.find((l) => !l.some((line) => /ACTION/.test(line)));
    expect(withAction).toEqual(["$display: 5 ACTIVE q=0 y=0", "$display: 5 INACT q=0 y=0", "$display: 5 ACTION $sampled(q)=0 q=1", "$display: 5 REACT q=1 y=1"]);
    expect(withoutAction).toEqual(["$display: 5 ACTIVE q=0 y=0", "$display: 5 INACT q=0 y=0", "$display: 5 REACT q=1 y=1"]);
    const run = simulateTimeSlot(workedExample({ lastThread: true }), [0, 0]);
    expect(run.finished?.cause).toBe("implicit-finish");
    expect(run.trace[run.finished!.stepIndex]).toMatchObject({ endedBy: "implicit-finish", processId: "PR", region: "reactive" });
    expect(run.trace[run.finished!.stepIndex].why).toMatch(/implicit call to \$finish \(§24\.3\)/);
  });
});

// ---------------------------------------------------------------------------
// The F3B kata: assign y = ~q with y = 1 since time 0, and a_y_high
// ---------------------------------------------------------------------------

const kataScenario = (sampledY: boolean): SvScenario => ({
  id: "f3b-kata",
  title: "Label the region",
  clock: "clk",
  clockSource: "process",
  slotTime: 5,
  initial: { clk: 0, d: 1, q: 0, y: 1 },
  watch: ["clk", "q", "y"],
  processes: [
    { id: "CLK", label: "clock", owner: "design", context: "module", header: "always #5", trigger: { kind: "resume" }, body: [{ kind: "assign", id: "k1", op: "blocking", target: "clk", expr: { kind: "inv", expr: { kind: "var", name: "clk" } } }] },
    { id: "L1", label: "always_ff", owner: "design", context: "module", header: "always_ff @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "l1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }] },
    { id: "L2", label: "assign y", owner: "design", context: "module", header: "assign", trigger: { kind: "change", signals: ["q"] }, body: [{ kind: "assign", id: "l2", op: "blocking", target: "y", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }] },
    {
      id: "TB",
      label: "initial",
      owner: "testbench",
      context: "module",
      header: "initial @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "display", id: "l3", signals: ["q", "y"], label: "A" },
        { kind: "delay0", id: "d0" },
        { kind: "display", id: "l4", signals: ["q", "y"], label: "B" },
        { kind: "strobe", id: "l5", signals: ["q", "y"], label: "C" },
        { kind: "delay", id: "d1", units: 1 },
        { kind: "finish", id: "fin" },
      ],
    },
    {
      id: "A",
      label: "a_y_high",
      owner: "design",
      context: "module",
      kind: "assertion",
      header: "a_y_high: assert property",
      trigger: { kind: "posedge", signal: "clk" },
      body: [],
      assertion: {
        property: { kind: "eq", left: { kind: "var", name: "y" }, right: { kind: "const", value: 1 } },
        pass: [{ kind: "display", id: "l6", signals: [], label: "D", args: [sampledY ? { label: "$sampled(y)", expr: { kind: "sampledFn", name: "y" } } : { label: "y", expr: { kind: "var", name: "y" } }] }],
      },
    },
  ],
});

describe("sv-scheduler-model: the F3B kata (§4.9.1 time-0 continuous assignment, §16.5.1, §4.4.2.9)", () => {
  it("prints A, B, D, C with D reading the current y = 0, and D y=1 once the action uses $sampled(y)", () => {
    const run = simulateTimeSlot(kataScenario(false), [0]);
    expect(run.log).toEqual(["$display: A q=0 y=1", "$display: B q=0 y=1", "$display: D y=0", "$strobe: C q=1 y=0"]);
    expect(exploreOrderings(kataScenario(false)).deterministic).toBe(true);
    expect(simulateTimeSlot(kataScenario(true), [0]).log[2]).toBe("$display: D $sampled(y)=1");
  });
});

// ---------------------------------------------------------------------------
// (6) trace-only check and assertcontrol statements
// ---------------------------------------------------------------------------

const checkScenario = (): SvScenario => ({
  id: "checks",
  title: "unique case and $assertcontrol",
  clock: "clk",
  initial: { clk: 0, state: "X" },
  watch: ["clk", "state"],
  processes: [
    {
      id: "DEC",
      label: "decoder",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "check", id: "ck1", qualifier: "unique", construct: "case", result: "no-match", source: "unique case (state) ... endcase" }],
    },
    {
      id: "CTL",
      label: "control",
      owner: "testbench",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assertcontrol", id: "ac1", controlType: 4, assertionType: ASSERTION_TYPE_BITS.unique | ASSERTION_TYPE_BITS.unique0 | ASSERTION_TYPE_BITS.priority }],
    },
  ],
});

describe("sv-scheduler-model: trace-only check and assertcontrol records (IEEE 1800-2023 §12.4.2.1, §12.5.3.1, §20.11 Tables 20-5 and 20-6)", () => {
  it("records a unique-case check with its result and process, prints nothing and decides nothing about reporting", () => {
    const run = simulateTimeSlot(checkScenario(), [0]);
    const check = run.trace.find((s) => s.record?.kind === "check");
    expect(check).toMatchObject({ kind: "statement", region: "active", processId: "DEC", stmtId: "ck1", record: { kind: "check", qualifier: "unique", construct: "case", result: "no-match", processId: "DEC", stmtId: "ck1" } });
    expect(check?.why).toMatch(/deferred \(§12\.4\.2\.1, §12\.5\.3\.1\)/);
    expect(run.log).toEqual([]);
  });

  it("records $assertcontrol(4, 224) as Off over Unique | Unique0 | Priority", () => {
    const run = simulateTimeSlot(checkScenario(), [0]);
    const ctl = run.trace.find((s) => s.record?.kind === "assertcontrol");
    expect(ctl?.record).toEqual({ kind: "assertcontrol", controlType: 4, assertionType: 224, processId: "CTL", stmtId: "ac1" });
    expect(ctl?.what).toMatch(/control_type 4 \(Off\) with assertion_type mask 224 \(Unique \| Unique0 \| Priority\)/);
    expect(scenarioToSource(checkScenario()).map((l) => l.text)).toContain("always @(posedge clk) $assertcontrol(4, 224);");
    // Both processes wake on the same edge: the order is a scheduler choice (§4.7) the downstream model can explore.
    expect(exploreOrderings(checkScenario()).runCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// (7) interleaveNba: a generated clock and a data NBA in the same batch
// ---------------------------------------------------------------------------

const gclkScenario = (): SvScenario => ({
  id: "gclk-interleave",
  title: "A generated clock in the same NBA batch as its data",
  clock: "clk",
  initial: { clk: 0, gclk: 0, a: 0, b: 0 },
  watch: ["clk", "gclk", "a", "b"],
  processes: [
    { id: "G", label: "gclk generator", owner: "design", context: "module", header: "always @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "g1", op: "nba", target: "gclk", expr: { kind: "inv", expr: { kind: "var", name: "gclk" } } }] },
    { id: "A", label: "a writer", owner: "design", context: "module", header: "always @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "a1", op: "nba", target: "a", expr: { kind: "const", value: 1 } }] },
    { id: "B", label: "always @(posedge gclk)", owner: "design", context: "module", header: "always @(posedge gclk)", trigger: { kind: "posedge", signal: "gclk" }, body: [{ kind: "assign", id: "b1", op: "nba", target: "b", expr: { kind: "var", name: "a" } }] },
  ],
});

describe("sv-scheduler-model: interleaveNba (IEEE 1800-2023 §4.5 'any event', §4.6 NBA order)", () => {
  it("off (default): every moved NBA update is applied before a woken process runs, so b always captures the new a", () => {
    const result = exploreOrderings(gclkScenario());
    expect(result.runCount).toBe(2);
    expect(result.deterministic).toBe(true);
    expect(result.outcomes[0].finalValues.b).toBe(1);
  });

  it("on: the process woken by gclk may run before a ← 1 is applied, which is a second legal outcome", () => {
    const result = exploreOrderings(withInterleaveNba(gclkScenario(), true));
    expect(result.runCount).toBe(3);
    expect(result.outcomes.map((o) => o.finalValues.b).sort()).toEqual([0, 1]);
    const run = simulateTimeSlot(withInterleaveNba(gclkScenario(), true), [0, 1]);
    const choice = run.trace.find((s) => s.kind === "choice" && s.choice?.options[0].startsWith("apply"));
    expect(choice?.choice).toEqual({ options: ["apply a ← 1", "run always @(posedge gclk)"], picked: "run always @(posedge gclk)" });
    expect(choice?.why).toMatch(/§4\.5.*§4\.6/);
    expect(run.finalValues.b).toBe(0);
  });

  it("keeps NBA updates in execution order among themselves and adds no choice when nothing wakes between them", () => {
    for (const preset of [...schedulerScenarioPresets, ...regionMapScenarioPresets]) {
      const off = exploreOrderings(preset.build());
      const on = exploreOrderings(withInterleaveNba(preset.build(), true));
      expect(on.outcomes.map((o) => o.signature).sort()).toEqual(off.outcomes.map((o) => o.signature).sort());
      expect(on.runCount).toBe(off.runCount);
    }
  });
});

describe("sv-scheduler-model: posedge follows Table 9-2 (IEEE 1800-2023 §9.4.2)", () => {
  it("isPosedge: 0 to anything else and X to 1 are edges; everything else is not", () => {
    expect(isPosedge(0, 1)).toBe(true);
    expect(isPosedge(0, "X")).toBe(true);
    expect(isPosedge("X", 1)).toBe(true);
    expect(isPosedge(0, 0)).toBe(false);
    expect(isPosedge(1, 1)).toBe(false);
    expect(isPosedge(1, 0)).toBe(false);
    expect(isPosedge(1, "X")).toBe(false);
    expect(isPosedge("X", 0)).toBe(false);
    expect(isPosedge("X", "X")).toBe(false);
  });

  /** A flop, a clocking block and an assertion on clk; `drive` sets clk from `start`. */
  const edgeScenario = (start: SvValue, drive: SvValue): SvScenario => ({
    id: "edge",
    title: "edge through X",
    clock: "clk",
    clockSource: "process",
    clockings: [{ name: "cb", clock: "clk" }],
    initial: { clk: start, d: 1, q: 0, ok: 1 },
    watch: ["clk", "q"],
    processes: [
      { id: "GEN", label: "clock generator", owner: "testbench", context: "module", header: "initial", trigger: { kind: "resume" }, body: [{ kind: "assign", id: "g1", op: "blocking", target: "clk", expr: { kind: "const", value: drive } }] },
      { id: "FF", label: "always_ff", owner: "design", context: "module", header: "always_ff @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "f1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }] },
      { id: "A", label: "a_ok", owner: "design", context: "module", kind: "assertion", header: "a_ok: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "ok" } } },
    ],
  });

  const edgeFired = (run: ReturnType<typeof simulateTimeSlot>) => ({
    flop: run.executionOrder.includes("FF"),
    clocking: run.trace.some((s) => s.what.includes("@(cb)")),
    assertion: run.trace.some((s) => s.assertion?.phase === "evaluate"),
  });

  it.each<[SvValue, SvValue]>([
    [0, 1],
    [0, "X"],
    ["X", 1],
  ])("%s -> %s wakes the flop and schedules the clocking event and the assertion", (start, drive) => {
    const run = simulateTimeSlot(edgeScenario(start, drive));
    expect(edgeFired(run)).toEqual({ flop: true, clocking: true, assertion: true });
    expect(run.finalValues.q).toBe(1);
  });

  it.each<[SvValue, SvValue]>([
    ["X", 0],
    [1, "X"],
    [1, 0],
  ])("%s -> %s is not a posedge: nothing fires", (start, drive) => {
    const run = simulateTimeSlot(edgeScenario(start, drive));
    expect(edgeFired(run)).toEqual({ flop: false, clocking: false, assertion: false });
    expect(run.finalValues.q).toBe(0);
  });

  it("an implicit clock from an initial X fires the edge too", () => {
    const run = simulateTimeSlot({ ...edgeScenario("X", 1), clockSource: "implicit", processes: edgeScenario("X", 1).processes.filter((p) => p.id !== "GEN") });
    expect(edgeFired(run)).toEqual({ flop: true, clocking: true, assertion: true });
  });
});
