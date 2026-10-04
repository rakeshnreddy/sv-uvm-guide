import { describe, expect, it } from "vitest";

import { exploreOrderings, scenarioToSource, simulateTimeSlot, withZeroDelay } from "@/lib/sv-scheduler-model";
import {
  combAfterNbaScenario,
  getRegionMapPreset,
  programReactiveScenario,
  regionMapScenarioPresets,
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
