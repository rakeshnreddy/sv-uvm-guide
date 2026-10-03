import { describe, expect, it } from "vitest";

import {
  exploreOrderings,
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
