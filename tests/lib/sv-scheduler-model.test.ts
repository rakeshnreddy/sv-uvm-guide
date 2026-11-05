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
  runsOnce,
  slotTimeLabel,
  validateScenario,
  withInterleaveNba,
  type Statement,
  type SvScenario,
  type SvValue,
  type TraceStep,
} from "@/lib/sv-scheduler-model";
import { combAfterNbaScenario, programReactiveScenario, regionMapScenarioPresets, zeroDelayPrintsScenario } from "@/lib/sv-scheduler-scenarios";
import { programWatcherScenario } from "@/lib/sv-region-map-scenarios-extra";

const hash16 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** What a trace does, without its narration: rewording `what` and `why` can neither break nor fake the opt-in proof below. */
const structure = (trace: TraceStep[]) =>
  trace.map((s) => ({
    index: s.index,
    kind: s.kind,
    region: s.region,
    sourceRegion: s.sourceRegion,
    delta: s.delta,
    processId: s.processId,
    stmtId: s.stmtId,
    values: s.values,
    changed: s.changed,
    queues: s.queues,
    log: s.log,
    choice: s.choice,
  }));

/** Every legal ordering's trace structure of a scenario, hashed. */
const traceSetHash = (scenario: SvScenario) =>
  hash16(
    exploreOrderings(scenario)
      .outcomes.flatMap((o) => o.runs)
      .map((r) => structure(simulateTimeSlot(scenario, r.choices).trace)),
  );

describe("sv-scheduler-model: additions are opt-in, so existing traces are unchanged", () => {
  // Hashes of `structure` over every preset's trace set, computed by running the
  // model and scenarios of commit ba9dbe7a^, from before inv/resume/slotTime/
  // assertions/finish/check/interleaveNba existed. Do not recompute them from the
  // current model: that would prove nothing. Narration is pinned separately below.
  const BASELINE: Record<string, string> = {
    "shift-blocking": "a7e14d80f1a3e6dd",
    "shift-nba": "9fb23c1aaf9c27f6",
    "tb-blocking-drive": "3448772ce32d034a",
    "tb-nba-drive": "8cccd05fdcec4f84",
    "tb-clocking-block": "1a79df39e1aa1c8d",
    "display-vs-strobe": "54a412a8f1f7f74a",
    "comb-after-nba": "48f8b99ef7a45404",
    "zero-delay-prints": "1c70726b12aa71fc",
    "program-reactive": "32e6930ba95b45b3",
  };

  it.each([...schedulerScenarioPresets, ...regionMapScenarioPresets].map((p) => [p.id, p] as const))("%s: every legal ordering does what it did before the extension", (id, preset) => {
    expect(traceSetHash(preset.build())).toBe(BASELINE[id]);
  });

  it("the #0 variants the region quiz uses are unchanged too", () => {
    expect(hash16(structure(simulateTimeSlot(withZeroDelay(shiftRegisterScenario("blocking"), "B", true)).trace))).toBe("472d96496e5d6d5d");
    expect(hash16(structure(simulateTimeSlot(withZeroDelay(programReactiveScenario(), "TB", true)).trace))).toBe("48798c6a8b899e5a");
  });

  it("at slot time 0 the sample is `initial`, which stands for static-variable declaration initializers (§16.5.1; the file header states the limit)", () => {
    const scenario: SvScenario = {
      id: "time-zero",
      title: "assertion at time 0",
      clock: "clk",
      slotTime: 0,
      initial: { clk: 0, y: 1 },
      watch: ["clk", "y"],
      processes: [{ id: "A", label: "a_y", owner: "design", context: "module", kind: "assertion", header: "a_y: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "y" }, pass: [{ kind: "display", id: "a1", signals: [], label: "PASS" }] } }],
    };
    const run = simulateTimeSlot(scenario);
    expect(run.slotTime).toBe(0);
    expect(run.trace.find((s) => s.assertion?.phase === "evaluate")?.assertion?.outcome).toBe("pass");
  });

  it("the slot time defaults to 10 ns and is reported on the result", () => {
    const run = simulateTimeSlot(combAfterNbaScenarioFixture());
    expect(run.slotTime).toBe(DEFAULT_SLOT_TIME);
    expect(run.finished).toBeUndefined();
    expect(slotTimeLabel({})).toBe("t = 10 ns");
    expect(slotTimeLabel({ slotTime: 5 })).toBe("t = 5 ns");
  });
});

describe("sv-scheduler-model: narration (pinned apart from the structure, because these sentences teach)", () => {
  const stepOf = (scenario: SvScenario, find: (s: TraceStep) => boolean) => {
    const step = simulateTimeSlot(scenario).trace.find(find);
    if (!step) throw new Error("no such step");
    return step;
  };

  it("a continuous assignment is narrated as one, not as a blocking statement (§4.9.1)", () => {
    const comb = stepOf(combAfterNbaScenario(), (s) => s.stmtId === "ca1" && s.kind === "statement");
    expect(comb.what).toBe("assign y = q; reads q = 1 and updates y.");
    expect(comb.why).toBe("A continuous assignment re-evaluates when its source changes and updates its target through an active update event (§4.9.1); the change wakes always_comb. Any process that reads y later in this slot sees 1.");
    for (const scenario of [programReactiveScenario(), programWatcherScenario()]) {
      const led = stepOf(scenario, (s) => s.kind === "statement" && s.changed.includes("led"));
      expect(led.what).toMatch(/^assign led = cmd; reads cmd = 1 and updates led\.$/);
      expect(led.why).toMatch(/^A continuous assignment re-evaluates/);
      expect(led.why).not.toMatch(/blocking|next statement/);
    }
  });

  it("always_comb and procedural code keep the blocking-assignment narration", () => {
    const comb = stepOf(combAfterNbaScenario(), (s) => s.stmtId === "cb1" && s.kind === "statement");
    expect(comb.what).toBe("z = y; reads y = 1 and writes z immediately.");
    expect(comb.why).toBe("A blocking assignment updates its target before the next statement runs. Any process that reads z later in this slot sees 1.");
  });

  it("a print names what is really pending: an NBA update when one is queued (§4.4.2.4)", () => {
    const first = stepOf(zeroDelayPrintsScenario(), (s) => s.kind === "print");
    expect(first.queues.nba.length).toBeGreaterThan(0);
    expect(first.why).toBe("$display prints the values visible at this instant — pending NBA updates are not yet applied.");
  });

  it("a print with no update pending says nothing about NBA, and names the process Active still holds (§4.5)", () => {
    const watcher = stepOf(programWatcherScenario(), (s) => s.kind === "print");
    expect(watcher.queues.nba).toEqual([]);
    expect(watcher.queues.reNba).toEqual([]);
    expect(watcher.queues.active.map((q) => q.label)).toEqual(["run assign led"]);
    expect(watcher.why).toBe("$display prints the values visible now. Active still holds run assign led, which waits until the reactive set has drained (§4.5), so its effect does not show yet.");
  });

  it("no print of any preset claims a pending update the queues do not hold", () => {
    for (const preset of [...schedulerScenarioPresets, ...regionMapScenarioPresets]) {
      for (const step of simulateTimeSlot(preset.build()).trace) {
        if (step.kind !== "print" || step.region === "postponed") continue;
        if (/pending NBA/.test(step.why)) expect(step.queues.nba.length).toBeGreaterThan(0);
        if (/pending Re-NBA/.test(step.why)) expect(step.queues.reNba.length).toBeGreaterThan(0);
        if (step.queues.nba.length) expect(step.why).toMatch(/pending NBA/);
        if (step.queues.reNba.length) expect(step.why).toMatch(/Re-NBA updates/);
      }
    }
  });

  it("a clocking drive lands in Re-NBA after the active set drains, with no claim about the rest of the slot (§14.16, §4.5)", () => {
    const drive = stepOf(testbenchDriveScenario("clocking"), (s) => s.stmtId === "tb1" && s.kind === "statement");
    expect(drive.why).toBe("A synchronous drive through a clocking block is applied in Re-NBA, after the active set has drained, so design logic triggered by this edge has already captured the old value (§14.16).");
    expect(drive.why).not.toMatch(/all design NBA/);
  });

  it("a move says 'this loop', because Observed is in neither region set (§4.4.1)", () => {
    const moves = simulateTimeSlot(testbenchDriveScenario("clocking")).trace.filter((s) => s.kind === "move");
    expect(moves.map((m) => m.region)).toContain("observed");
    for (const move of moves) expect(move.why).toMatch(/every earlier region of this loop is empty/);
    expect(moves[0].what).toBe("Active is empty. 1 NBA event moves to Active: q ← 3.");
  });

  it("a move names Δ as the model's count, not as a term of the standard", () => {
    const [move] = simulateTimeSlot(combAfterNbaScenario()).trace.filter((s) => s.kind === "move");
    expect(move.why).toBe("The scheduler only advances to NBA once every earlier region of this loop is empty. Moving events back adds one to the model's Δ count; simulation time does not change.");
    for (const preset of [...schedulerScenarioPresets, ...regionMapScenarioPresets]) {
      for (const step of simulateTimeSlot(preset.build()).trace) expect(`${step.what} ${step.why}`).not.toMatch(/delta/i);
    }
  });

  it("slot start says what reads the Preponed samples: a procedural read of cb.q does, a plain read of a variable does not (§14.13, §16.9.3)", () => {
    const run = simulateTimeSlot(testbenchDriveScenario("clocking"));
    expect(run.trace[0].why).toBe(
      "Preponed samples every value before anything in this slot changes. Clocking-block inputs (#1step), concurrent assertions and $sampled() return these samples; a plain read of a variable returns its current value.",
    );
    // The driver's procedural `seen = cb.q;` gets the sample while q already holds its new value.
    const read = run.trace.find((s) => s.stmtId === "tb2");
    expect(read?.values).toMatchObject({ q: 3, seen: 1 });
  });

  it("an edge wakes processes but only schedules Observed events, and the narration keeps the two apart (§14.10, §4.4.2.5)", () => {
    const clocking = simulateTimeSlot(testbenchDriveScenario("clocking")).trace.find((s) => s.kind === "update" && s.changed.includes("clk"));
    expect(clocking?.why).toBe("The clock generator drives clk high. The change wakes DUT flop and schedules the @(cb) clocking event in Observed.");
    const both: SvScenario = {
      id: "edge-narration",
      title: "edge narration",
      clock: "clk",
      clockings: [{ name: "cb", clock: "clk" }],
      initial: { clk: 0, ok: 1 },
      watch: ["clk"],
      processes: [
        { id: "F", label: "flop", owner: "design", context: "module", header: "always_ff @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "assign", id: "f1", op: "nba", target: "ok", expr: { kind: "const", value: 0 } }] },
        { id: "G", label: "logger", owner: "design", context: "module", header: "always @(posedge clk)", trigger: { kind: "posedge", signal: "clk" }, body: [{ kind: "display", id: "g1", signals: ["ok"] }] },
        { id: "A", label: "a_ok", owner: "design", context: "module", kind: "assertion", header: "a_ok: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "ok" } } },
      ],
    };
    const edge = simulateTimeSlot(both).trace.find((s) => s.kind === "update" && s.changed.includes("clk"));
    expect(edge?.why).toBe("The clock generator drives clk high. The change wakes flop and logger and schedules the @(cb) clocking event and the evaluation of a_ok in Observed.");
    const scheduledOnly: SvScenario = { ...both, processes: both.processes.filter((p) => p.id === "A") };
    expect(simulateTimeSlot(scheduledOnly).trace.find((s) => s.kind === "update" && s.changed.includes("clk"))?.why).toBe(
      "The clock generator drives clk high. The change schedules the @(cb) clocking event and the evaluation of a_ok in Observed.",
    );
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

  it("~ of a multi-bit value is outside the model and throws rather than invent X (§11.4.8)", () => {
    expect(() => simulateTimeSlot(invScenario(5))).toThrow(/~ is modelled for single-bit values only, not 5/);
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
    expect(edge?.why).toMatch(/; the change wakes always_ff and initial\. /);
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

  /** One `resume` process that drives clk, with whatever header, note and slot time a test wants. */
  const startScenario = (opts: { header: string; note?: string; slotTime?: number; context?: "module" | "program" }): SvScenario => ({
    id: "start",
    title: "start",
    clock: "clk",
    clockSource: "process",
    ...(opts.slotTime === undefined ? {} : { slotTime: opts.slotTime }),
    initial: { clk: 0 },
    watch: ["clk"],
    processes: [
      {
        id: "GEN",
        label: "gen",
        owner: "testbench",
        context: opts.context ?? "module",
        header: opts.header,
        trigger: { kind: "resume", ...(opts.note ? { note: opts.note } : {}) },
        body: [{ kind: "assign", id: "g1", op: "blocking", target: "clk", expr: { kind: "const", value: 1 } }],
      },
    ],
  });
  const ended = (run: ReturnType<typeof simulateTimeSlot>) => run.trace.findLast((s) => s.processId === "GEN" && s.kind === "statement");

  it("an initial at time 0 starts there and then ends: no delay expired, and none comes next (§9.2.1)", () => {
    const run = simulateTimeSlot(startScenario({ header: "initial", slotTime: 0 }));
    expect(run.trace.find((s) => s.kind === "wake")?.why).toBe("Ready at the start of the slot: the procedure starts at time 0.");
    expect(ended(run)).toMatchObject({
      what: "gen finishes: the procedure has ended.",
      why: "An initial procedure executes once, and its activity then ceases (§9.2.1). Nothing runs it again.",
    });
    for (const step of run.trace) expect(`${step.what} ${step.why}`).not.toMatch(/delay expired|next delay|waits for its next trigger/);
  });

  it("an initial whose delay expired later still ends, with or without a note, in module or program code", () => {
    const expired = simulateTimeSlot(startScenario({ header: "initial" }));
    expect(expired.trace.find((s) => s.kind === "wake")?.why).toBe("Ready at the start of the slot: its delay expired at this time.");
    expect(ended(expired)?.what).toBe("gen finishes: the procedure has ended.");
    const noted = simulateTimeSlot(startScenario({ header: "initial", note: "#5 expired" }));
    expect(ended(noted)?.what).toBe("gen finishes: the procedure has ended.");
    expect(ended(noted)?.why).not.toMatch(/next delay/);
    const program = simulateTimeSlot(startScenario({ header: "initial", context: "program" }));
    expect(ended(program)).toMatchObject({ region: "reactive", what: "gen finishes: the procedure has ended." });
  });

  it("an always keeps the delay narration, at time 0 too", () => {
    const zero = simulateTimeSlot(startScenario({ header: "always #5", slotTime: 0 }));
    expect(zero.trace.find((s) => s.kind === "wake")?.why).toBe("Ready at the start of the slot: the procedure starts at time 0.");
    expect(ended(zero)).toMatchObject({ what: "gen finishes and waits for its next trigger.", why: "Its next delay expires in a later time slot." });
  });

  it("runsOnce reads the source the learner sees: forever and a trailing wait keep a thread alive", () => {
    expect(runsOnce({ header: "initial" })).toBe(true);
    expect(runsOnce({ header: "initial @(posedge clk)" })).toBe(true);
    expect(runsOnce({ header: "initial forever @(posedge clk)" })).toBe(false);
    expect(runsOnce({ header: "initial @(posedge clk)", sourceTail: ["@(posedge clk);"] })).toBe(false);
    expect(runsOnce({ header: "always #5" })).toBe(false);
    expect(runsOnce({ header: "always_ff @(posedge clk)" })).toBe(false);
  });

  it("a finished initial is not re-armed: a second edge in the slot wakes the always but not the initial", () => {
    const flop = (id: string, header: string): SvScenario["processes"][number] => ({
      id,
      label: id,
      owner: "testbench",
      context: "module",
      header,
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "display", id: `${id}1`, signals: ["clk"], label: id }],
    });
    const run = simulateTimeSlot({
      id: "two-edges",
      title: "two edges",
      clock: "clk",
      clockSource: "process",
      initial: { clk: 0 },
      watch: ["clk"],
      processes: [
        {
          id: "GEN",
          label: "gen",
          owner: "testbench",
          context: "module",
          header: "initial",
          trigger: { kind: "resume" },
          body: [
            { kind: "assign", id: "g1", op: "blocking", target: "clk", expr: { kind: "const", value: 1 } },
            { kind: "delay0", id: "g2" },
            { kind: "assign", id: "g3", op: "blocking", target: "clk", expr: { kind: "const", value: 0 } },
            { kind: "delay0", id: "g4" },
            { kind: "assign", id: "g5", op: "blocking", target: "clk", expr: { kind: "const", value: 1 } },
          ],
        },
        flop("ONCE", "initial @(posedge clk)"),
        flop("LOOP", "always @(posedge clk)"),
      ],
    });
    const wakes = (id: string) => run.trace.filter((s) => s.kind === "wake" && s.processId === id).length;
    expect(wakes("LOOP")).toBe(2);
    expect(wakes("ONCE")).toBe(1);
  });

  it("program context: a process ready at slot start wakes in Reactive, not Active (§24.3.1)", () => {
    const run = simulateTimeSlot(startScenario({ header: "always #5", note: "#5 books t = 15", context: "program" }));
    const wake = run.trace.find((s) => s.kind === "wake" && s.processId === "GEN");
    expect(wake).toMatchObject({ region: "reactive", why: "Ready at the start of the slot: #5 books t = 15." });
    expect(wake?.sourceRegion).toBeUndefined();
    expect(run.trace.filter((s) => s.region === "active")).toEqual([]);
    expect(run.finalValues.clk).toBe(1);
  });

  it("the time-0 sample is the default sampled value, not a Preponed read (§16.5.1)", () => {
    const assertion = (slotTime?: number): SvScenario => ({
      ...startScenario({ header: "always #5", ...(slotTime === undefined ? {} : { slotTime }) }),
      initial: { clk: 0, y: 1 },
      processes: [
        ...startScenario({ header: "always #5" }).processes,
        { id: "A", label: "a_y", owner: "design", context: "module", kind: "assertion", header: "a_y: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "y" } } },
      ],
    });
    const sampleOf = (run: ReturnType<typeof simulateTimeSlot>) => run.trace.find((s) => s.kind === "sample");
    const evalOf = (run: ReturnType<typeof simulateTimeSlot>) => run.trace.find((s) => s.assertion?.phase === "evaluate");
    const zero = simulateTimeSlot(assertion(0));
    expect(sampleOf(zero)?.why).toBe(
      "At time 0 a concurrent assertion reads default sampled values (§16.5.1). The model's start values stand for static-variable declaration initializers, which is what those defaults are. $sampled() returns the same values later in the slot (§16.9.3). The property itself is not evaluated until Observed.",
    );
    expect(evalOf(zero)?.why).toMatch(/^Property expressions are evaluated in the Observed region, after the active set has settled, but on the values sampled in Preponed: at time 0, the default sampled values \(§4\.4\.2\.5, §16\.5\.1\)\./);
    const later = simulateTimeSlot(assertion());
    expect(sampleOf(later)?.why).toMatch(/^A concurrent assertion reads sampled values: the values its signals had in Preponed/);
    expect(evalOf(later)?.why).toMatch(/but on the values sampled in Preponed \(§4\.4\.2\.5, §16\.5\.1\)\./);
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
    // %0d shows a lowercase x when every bit is unknown (§21.2.1.3).
    expect(unknown.log).toContain("$error: 5 FAIL $sampled(q)=x");
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

  /** A failing assertion with no else clause: `y` is sampled low, and it has no action blocks at all. */
  const noElseScenario = (): SvScenario => ({
    id: "no-else",
    title: "no else clause",
    clock: "clk",
    initial: { clk: 0, y: 0 },
    watch: ["clk", "y"],
    processes: [{ id: "A", label: "a_y", owner: "design", context: "module", kind: "assertion", header: "a_y: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "y" } } }],
  });

  it("a failing assertion with no else clause calls $error by default (§16.14.1): fail in Observed, then the print in Reactive", () => {
    const run = simulateTimeSlot(noElseScenario());
    const evaluation = run.trace.find((s) => s.assertion?.phase === "evaluate");
    expect(evaluation).toMatchObject({ sourceRegion: "observed", assertion: { phase: "evaluate", outcome: "fail" }, what: "a_y evaluates y on the sampled values (y = 0): it fails." });
    expect(evaluation?.why).toBe(
      "Property expressions are evaluated in the Observed region, after the active set has settled, but on the values sampled in Preponed (§4.4.2.5, §16.5.1). It has no else clause, so the tool calls $error by default, unless $assertcontrol suppresses it (§16.14.1). The model runs that call with the fail code, which §4.4.2.5 schedules in the Reactive region.",
    );
    const action = run.trace.find((s) => s.assertion?.phase === "action" && s.kind === "wake");
    expect(action).toMatchObject({ region: "reactive", what: "a_y has no else clause, so its default $error runs." });
    expect(action?.why).toBe(
      "With the else clause omitted, the tool calls $error when the assertion fails, unless $assertcontrol suppresses it (§16.14.1). The model does not apply $assertcontrol, and a real tool words the message its own way. The model runs the call with the fail code, in the Reactive region (§4.4.2.5).",
    );
    expect(run.log).toEqual(["$error: a_y failed"]);
  });

  it("the default $error reports only the label, so its narration says nothing about values being visible", () => {
    const print = simulateTimeSlot(noElseScenario()).trace.find((s) => s.kind === "print");
    expect(print).toMatchObject({ region: "reactive", what: "Prints a_y failed immediately." });
    expect(print?.why).toBe("The tool reports the failure; its wording is tool-specific, and the model prints only the assertion's label, so no signal value is read here.");
  });

  it("the default $error is the model's: the source shows no else clause and no $error line", () => {
    const text = scenarioToSource(noElseScenario()).map((l) => l.text);
    expect(text).toEqual(["a_y: assert property (@(posedge clk) y);"]);
  });

  it("a passing assertion with no action block schedules nothing and prints nothing", () => {
    const run = simulateTimeSlot({ ...noElseScenario(), initial: { clk: 0, y: 1 } });
    expect(run.trace.find((s) => s.assertion?.phase === "evaluate")?.why).toMatch(/It has no pass action block, so nothing more is scheduled\.$/);
    expect(run.log).toEqual([]);
    expect(run.trace.some((s) => s.region === "reactive")).toBe(false);
  });

  it("a constant property samples nothing: no sample step, and no empty list of sampled values", () => {
    const constant = (pass?: Statement[]): SvScenario => ({
      ...noElseScenario(),
      processes: [{ id: "A", label: "a_c", owner: "design", context: "module", kind: "assertion", header: "a_c: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "const", value: 1 }, pass } }],
    });
    const run = simulateTimeSlot(constant());
    expect(run.trace.some((s) => s.kind === "sample")).toBe(false);
    const evaluation = run.trace.find((s) => s.assertion?.phase === "evaluate");
    expect(evaluation?.what).toBe("a_c evaluates 1: it passes.");
    expect(evaluation?.why).toBe("Property expressions are evaluated in the Observed region, after the active set has settled (§4.4.2.5). This one reads no signal, so no sample matters. It has no pass action block, so nothing more is scheduled.");
    // A $sampled() in its action block still takes a sample.
    const sampling = simulateTimeSlot(constant([{ kind: "display", id: "a1", signals: [], args: [{ label: "y", expr: { kind: "sampledFn", name: "y" } }] }]));
    expect(sampling.trace.find((s) => s.kind === "sample")?.what).toBe("a_c samples y = 0.");
    expect(sampling.trace.find((s) => s.assertion?.phase === "evaluate")?.what).toBe("a_c evaluates 1: it passes.");
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
    // The closing step is no event of Inactive, though the $finish that ended the run was.
    expect(run.trace.at(-1)!.sourceRegion).toBeUndefined();
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

  /** The worked example with the program thread replaced by `patch` of it. */
  const withProgramThread = (patch: Partial<SvScenario["processes"][number]>): SvScenario => {
    const base = workedExample({ lastThread: true });
    return { ...base, processes: base.processes.map((p) => (p.id === "PR" ? { ...p, ...patch } : p)) };
  };

  it("only a thread that ends can be the last: lastThread on a forever or on a trailing wait throws instead of inventing an implicit $finish (§24.3)", () => {
    expect(() => validateScenario(workedExample({ lastThread: true }))).not.toThrow();
    expect(() => simulateTimeSlot(withProgramThread({ header: "initial forever @(posedge clk)" }))).toThrow(/never ends/);
    expect(() => simulateTimeSlot(withProgramThread({ sourceTail: ["@(posedge clk);"] }))).toThrow(/never ends/);
  });

  it("lastThread belongs to a program initial: on module code it throws (§24.3)", () => {
    expect(() => simulateTimeSlot(withProgramThread({ context: "module" }))).toThrow(/program initial procedure/);
  });
});

describe("sv-scheduler-model: a trailing wait is shown, never run", () => {
  it("the thread reaches its trailing @(posedge clk); and waits there: it has not ended, and the narration does not say it finished", () => {
    const run = simulateTimeSlot(workedExample(), [0, 0]);
    const steps = run.trace.filter((s) => s.processId === "PR" && s.kind === "statement");
    expect(steps.at(-1)).toMatchObject({
      what: "program thread reaches @(posedge clk); and waits there.",
      why: "The procedure has not ended: it is blocked at that statement. The model runs none of the lines after the body, so it does not wake this process again in this slot.",
    });
    expect(steps.some((s) => /finishes/.test(s.what))).toBe(false);
  });

  it("a second edge in the slot does not re-run a body that is blocked at its trailing wait", () => {
    const flop = (id: string, header: string, sourceTail?: string[]): SvScenario["processes"][number] => ({
      id,
      label: id,
      owner: "testbench",
      context: "module",
      header,
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "display", id: `${id}1`, signals: ["clk"], label: id }],
      ...(sourceTail ? { sourceTail } : {}),
    });
    const run = simulateTimeSlot({
      id: "two-edges-tail",
      title: "two edges, one trailing wait",
      clock: "clk",
      clockSource: "process",
      initial: { clk: 0 },
      watch: ["clk"],
      processes: [
        {
          id: "GEN",
          label: "gen",
          owner: "testbench",
          context: "module",
          header: "initial",
          trigger: { kind: "resume" },
          body: [
            { kind: "assign", id: "g1", op: "blocking", target: "clk", expr: { kind: "const", value: 1 } },
            { kind: "delay0", id: "g2" },
            { kind: "assign", id: "g3", op: "blocking", target: "clk", expr: { kind: "const", value: 0 } },
            { kind: "delay0", id: "g4" },
            { kind: "assign", id: "g5", op: "blocking", target: "clk", expr: { kind: "const", value: 1 } },
          ],
        },
        flop("TAIL", "initial @(posedge clk)", ["@(posedge clk);"]),
        flop("LOOP", "always @(posedge clk)"),
      ],
    });
    const wakes = (id: string) => run.trace.filter((s) => s.kind === "wake" && s.processId === id).length;
    expect(wakes("LOOP")).toBe(2);
    expect(wakes("TAIL")).toBe(1);
    expect(run.log.filter((l) => / TAIL /.test(` ${l} `))).toHaveLength(1);
  });
});

describe("sv-scheduler-model: a concurrent assertion needs a property and a posedge clock", () => {
  const assertionWith = (patch: Partial<SvScenario["processes"][number]>): SvScenario => ({
    id: "bad-assertion",
    title: "bad assertion",
    clock: "clk",
    initial: { clk: 0, y: 1 },
    watch: ["clk", "y"],
    processes: [{ id: "A", label: "a_y", owner: "design", context: "module", kind: "assertion", header: "a_y: assert property", trigger: { kind: "posedge", signal: "clk" }, body: [], assertion: { property: { kind: "var", name: "y" } }, ...patch }],
  });

  it("a posedge-clocked assertion is accepted", () => {
    expect(() => simulateTimeSlot(assertionWith({}))).not.toThrow();
  });

  it("any other trigger throws, in the run and in the source, rather than show a clock the model never ticks", () => {
    const changeClocked = assertionWith({ trigger: { kind: "change", signals: ["clk"] } });
    expect(() => simulateTimeSlot(changeClocked)).toThrow(/posedge/);
    expect(() => scenarioToSource(changeClocked)).toThrow(/posedge/);
  });

  it("an assertion with no property throws rather than run as an empty procedure", () => {
    expect(() => simulateTimeSlot(assertionWith({ assertion: undefined }))).toThrow(/no property/);
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

  it("on: an Active choice is narrated as moved NBA events", () => {
    const run = simulateTimeSlot(withInterleaveNba(gclkScenario(), true), [0, 1]);
    const choice = run.trace.find((s) => s.kind === "choice" && s.choice?.options[0].startsWith("apply"));
    expect(choice?.what).toBe('Active holds 1 pending NBA update and 1 woken process: apply a ← 1, run always @(posedge gclk). This run picks "run always @(posedge gclk)" first.');
    expect(choice?.why).toBe(
      "Once NBA events have moved to Active, the loop may take any event from the region (§4.5): the updates keep their order among themselves (§4.6), but a process woken by one of them may run before the rest are applied. Code whose result depends on this is a race.",
    );
  });

  /** The same batch in program code: the updates land in Re-NBA and execute in Reactive. */
  const programGclkScenario = (): SvScenario => {
    const base = gclkScenario();
    return {
      ...base,
      id: "program-gclk-interleave",
      processes: base.processes.map((p) => ({ ...p, context: "program" as const, owner: "testbench" as const, label: p.label.replace(/^always/, "initial forever"), header: p.header.replace(/^always/, "initial forever") })),
    };
  };

  it("on, in program code: the choice is among Re-NBA events moved to Reactive, and the words say so (§4.4.2.8, §4.5)", () => {
    const scenario = withInterleaveNba(programGclkScenario(), true);
    const first = simulateTimeSlot(scenario, [0, 1]);
    const choice = first.trace.find((s) => s.kind === "choice" && s.choice?.options[0].startsWith("apply"));
    expect(choice).toMatchObject({ region: "reactive", choice: { options: ["apply a ← 1", "run initial forever @(posedge gclk)"], picked: "run initial forever @(posedge gclk)" } });
    expect(choice?.what).toBe('Reactive holds 1 pending Re-NBA update and 1 woken process: apply a ← 1, run initial forever @(posedge gclk). This run picks "run initial forever @(posedge gclk)" first.');
    expect(choice?.why).toBe(
      "Once Re-NBA events have moved to Reactive, the loop may take any event from the region (§4.4.2.8, §4.5): the updates keep their order among themselves (§4.6), but a process woken by one of them may run before the rest are applied. Code whose result depends on this is a race.",
    );
    expect(first.finalValues.b).toBe(0);
    expect(simulateTimeSlot(scenario, [0, 0]).finalValues.b).toBe(1);
    expect(exploreOrderings(programGclkScenario()).deterministic).toBe(true);
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
  it("isPosedge reads the LSB of a multi-bit value (§9.4.2)", () => {
    expect(isPosedge(0, 2)).toBe(false);
    expect(isPosedge(2, 4)).toBe(false);
    expect(isPosedge(1, 3)).toBe(false);
    expect(isPosedge(0, 3)).toBe(true);
    expect(isPosedge(2, 3)).toBe(true);
    expect(isPosedge(2, "X")).toBe(true);
    expect(isPosedge("X", 3)).toBe(true);
    expect(isPosedge("X", 2)).toBe(false);
    expect(isPosedge(3, 2)).toBe(false);
  });

  it("isPosedge: Table 9-2 on 0, 1 and X", () => {
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
