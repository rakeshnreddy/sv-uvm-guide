import { describe, expect, it } from "vitest";

import { exploreOrderings, simulateTimeSlot } from "@/lib/sv-scheduler-model";
import { regionLandings, regionMapPrediction, regionMapSource } from "@/lib/sv-region-map-model";
import {
  allRegionMapScenarioPresets,
  extraRegionMapScenarioPresets,
  getAnyRegionMapPreset,
  isExtraRegionMapScenarioId,
  programWatcherScenario,
} from "@/lib/sv-region-map-scenarios-extra";
import { combAfterNbaScenario, regionMapScenarioPresets, testbenchDriveScenario } from "@/lib/sv-scheduler-scenarios";

const wakeIndex = (run: ReturnType<typeof simulateTimeSlot>, id: string) => run.trace.findIndex((s) => s.kind === "wake" && s.processId === id);

describe("program-watcher: the reactive set drains before Active resumes (IEEE 1800-2023 §4.5, §24.3.1)", () => {
  it("adds a second program thread to programReactiveScenario and keeps the design unchanged", () => {
    const scenario = programWatcherScenario();
    expect(scenario.processes.map((p) => p.id)).toEqual(["FF", "LED", "TB", "W"]);
    expect(scenario.processes.find((p) => p.id === "W")).toMatchObject({ context: "program", trigger: { kind: "change", signals: ["cmd"] } });
    const text = regionMapSource(scenario).map((l) => l.text);
    expect(text.filter((t) => t === "program tb;")).toHaveLength(1);
    expect(text.at(-1)).toBe("endprogram");
    expect(text).toContain('  initial forever @(cmd) $display("cmd=%0d led=%0d", cmd, led);');
  });

  it("the watcher woken by the Re-NBA update runs in Reactive before assign led runs in Active, and sees led = 0", () => {
    const scenario = programWatcherScenario();
    const run = simulateTimeSlot(scenario);
    const cmdUpdate = run.trace.findIndex((s) => s.kind === "update" && s.changed.includes("cmd"));
    const watcher = wakeIndex(run, "W");
    const led = wakeIndex(run, "LED");
    expect(cmdUpdate).toBeGreaterThan(-1);
    expect(watcher).toBeGreaterThan(cmdUpdate);
    expect(led).toBeGreaterThan(watcher);
    expect(run.trace[watcher].region).toBe("reactive");
    expect(run.trace[led].region).toBe("active");
    expect(run.log).toEqual(["$display: cmd=1 led=0"]);
    expect(run.finalValues).toMatchObject({ cmd: 1, led: 1, seen: 1 });
    expect(exploreOrderings(scenario)).toMatchObject({ deterministic: true, runCount: 1 });
  });

  it("grades exactly the 'watcher first' option as correct", () => {
    const preset = getAnyRegionMapPreset("program-watcher");
    const scenario = preset.build();
    const [prediction] = preset.predictions(scenario, simulateTimeSlot(scenario));
    expect(prediction.question).toMatch(/Which runs first\?/);
    expect(prediction.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["watcher"]);
    expect(prediction.options).toHaveLength(4);
    // The led value the feedback quotes is the one the watcher's print showed in this run.
    expect(prediction.options.find((o) => o.id === "watcher")?.feedback).toMatch(/\(§4\.5, §24\.3\.1\)\. That is why the watcher prints led = 0\.$/);
    // §4.7 lists mid-process suspension too, so the race option must not claim same-region readiness is the only source.
    expect(prediction.options.find((o) => o.id === "race")?.feedback).toBe("The watcher sits in Reactive and assign led in Active, so §4.5 fixes the order between them; a pair ready in one region could go either way (§4.7).");
    expect(scenario.title).toBe("A second program thread waits on cmd");
  });
});

describe("clocking-drive: the existing tb-clocking-block scenario with region questions (§14.16, §14.13)", () => {
  it("registers testbenchDriveScenario('clocking') rather than a copy", () => {
    const preset = getAnyRegionMapPreset("clocking-drive");
    expect(preset.build()).toEqual(testbenchDriveScenario("clocking"));
    expect(preset.build().id).toBe("tb-clocking-block");
  });

  it("asks two questions: din changes in Re-NBA, and the driver read the Preponed q", () => {
    const preset = getAnyRegionMapPreset("clocking-drive");
    const scenario = preset.build();
    const run = simulateTimeSlot(scenario);
    const [region, sample] = preset.predictions(scenario, run);
    expect(region.question).toMatch(/In which region does din change\?/);
    expect(region.options.map((o) => o.id)).toEqual(["active", "nba", "reNba"]);
    expect(region.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["reNba"]);
    expect(sample.question).toMatch(/Which q does it get\?/);
    expect(sample.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["sample"]);
    expect(sample.options.find((o) => o.id === "sample")?.label).toBe("1: the Preponed sample (#1step)");
    expect(sample.options.find((o) => o.id === "new")?.label).toBe("3: the value after the flop's NBA update");
    // The answers are the model's: the landing of tb1 and the value the driver stored.
    const dinLanding = regionLandings(scenario, run).find((l) => l.stmtId === "tb1" && l.kind === "update");
    expect(dinLanding?.region).toBe("reNba");
    expect(run.finalValues.seen).toBe(run.trace[0].values.q);
    // The DUT flop read the old din in Active: q is 3, not the driven 7.
    expect(run.finalValues.q).toBe(3);
    expect(region.options.find((o) => o.id === "reNba")?.feedback).toMatch(/read din = 3 in Active long before that, so q becomes 3, not 7\.$/);
    // Those numbers are read from the run, so a different start value changes the sentence with the model.
    const other: typeof scenario = { ...scenario, initial: { ...scenario.initial, din: 5 } };
    const [otherRegion] = preset.predictions(other, simulateTimeSlot(other));
    expect(otherRegion.options.find((o) => o.id === "reNba")?.feedback).toMatch(/read din = 5 in Active long before that, so q becomes 5, not 7\.$/);
    // §14.16 places the drive in Re-NBA of this time step; §4.5 can still return to Active after it, so no text claims the last design NBA update of the slot.
    expect(region.options.find((o) => o.id === "reNba")?.label).toBe("Re-NBA, after the design NBA updates queued for this edge");
    expect(region.options.find((o) => o.id === "nba")?.feedback).toMatch(/after the design NBA updates already queued for this edge\.$/);
    for (const option of region.options) expect(`${option.label} ${option.feedback}`).not.toMatch(/every design NBA|all design NBA/);
    // §14.13 names the Postponed region of the prior time step; §4.4.2.1 makes that the Preponed sample, so every option cites both.
    const feedback = (id: string) => sample.options.find((o) => o.id === id)?.feedback;
    expect(feedback("sample")).toBe(
      "A clocking-block input with the default #1step skew returns the value sampled in Preponed, before anything in the slot changed (§14.13, §4.4.2.1). The flop's NBA update happened between the sample and the read, and does not show.",
    );
    expect(feedback("new")).toBe(
      "That is what a plain read of q would see: @(cb) triggers in Observed (§14.10), after NBA. But cb.q is the #1step sample taken in Preponed (§14.13, §4.4.2.1), so the pre-edge value comes back.",
    );
    expect(feedback("unknown")).toBe("The sample is taken at this clocking event, in Preponed (§14.13, §4.4.2.1), so it is valid as soon as the @(cb) process runs in the following Active pass.");
  });
});

describe("the merged preset list", () => {
  it("keeps the base presets first with their single prediction, then the extras", () => {
    expect(allRegionMapScenarioPresets.map((p) => p.id)).toEqual(["comb-after-nba", "zero-delay-prints", "program-reactive", "program-watcher", "clocking-drive"]);
    expect(extraRegionMapScenarioPresets.map((p) => p.id)).toEqual(["program-watcher", "clocking-drive"]);
    expect(regionMapScenarioPresets.map((p) => p.id)).toEqual(["comb-after-nba", "zero-delay-prints", "program-reactive"]);
    const base = getAnyRegionMapPreset("comb-after-nba");
    const scenario = combAfterNbaScenario();
    const run = simulateTimeSlot(scenario);
    expect(base.predictions(scenario, run)).toEqual([regionMapPrediction(scenario, run)]);
    expect(isExtraRegionMapScenarioId("program-watcher")).toBe(true);
    expect(isExtraRegionMapScenarioId("comb-after-nba")).toBe(false);
    expect(() => getAnyRegionMapPreset("nope" as never)).toThrow(/Unknown region-map scenario/);
  });

  it("what a preset shows before the reveal never names its answer", () => {
    const before = (id: Parameters<typeof getAnyRegionMapPreset>[0]) => {
      const preset = getAnyRegionMapPreset(id);
      return preset.setup ?? preset.summary;
    };
    expect(before("comb-after-nba")).toBe("A flop's q feeds a continuous assignment, whose y feeds an always_comb.");
    expect(before("comb-after-nba")).not.toMatch(/Active|second pass/);
    // The summary keeps the point for after the reveal.
    expect(getAnyRegionMapPreset("comb-after-nba").summary).toMatch(/runs again in Active/);
    expect(before("clocking-drive")).not.toMatch(/Re-NBA|Preponed/);
    expect(before("program-reactive")).not.toMatch(/Reactive|new q/);
    expect(before("program-watcher")).not.toMatch(/drains/);
  });

  it("every preset has one legal order, as the visualizer's assumptions state: no scheduler choice point at all (§4.7)", () => {
    for (const preset of allRegionMapScenarioPresets) {
      const scenario = preset.build();
      expect(simulateTimeSlot(scenario).choices).toEqual([]);
      expect(exploreOrderings(scenario)).toMatchObject({ deterministic: true, runCount: 1 });
    }
  });

  it("every preset has exactly one correct option per question and a replayable trace", () => {
    for (const preset of allRegionMapScenarioPresets) {
      const scenario = preset.build();
      const run = simulateTimeSlot(scenario);
      expect(simulateTimeSlot(preset.build()).trace).toEqual(run.trace);
      for (const prediction of preset.predictions(scenario, run)) {
        expect(prediction.options.filter((o) => o.correct)).toHaveLength(1);
        expect(new Set(prediction.options.map((o) => o.label)).size).toBe(prediction.options.length);
      }
    }
  });
});
