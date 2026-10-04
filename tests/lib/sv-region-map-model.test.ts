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
