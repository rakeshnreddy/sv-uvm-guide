import { describe, expect, it } from "vitest";

import {
  ALL_PROCEDURAL_SCENARIO_IDS,
  declInitReadyScenario,
  describeHistory,
  exploreTimeZero,
  getTimeZeroScenario,
  initialVariantOf,
  isTimeZeroScenario,
  outcomeTitle,
  pickerScenarios,
  proceduralScenarios,
  scenarioLabel,
  SINGLE_RUN_SCENARIO_IDS,
  time0RaceScenario,
  time0ResetScenario,
  TIMELINE_X1,
  timelineLabelWidth,
  timelineLayout,
  timeZeroScenarios,
  type TimeZeroConfig,
  type TimeZeroPreset,
} from "@/components/animations/procedural-blocks-data";
import {
  alignedOutcomeRuns,
  divergenceFromBase,
  firstDivergentStep,
  prepareScenario,
  settledHistory,
  simulateProcesses,
  startOrder,
  valueAt,
  type SimResult,
} from "@/lib/sv-process-model";

const configs = (preset: TimeZeroPreset): TimeZeroConfig[] =>
  preset.variants.flatMap((v) => (preset.advanced ? [false, true] : [false]).map((advanced) => ({ variant: v.value, advanced })));

const sourceOf = (preset: TimeZeroPreset, cfg: TimeZeroConfig) => prepareScenario(preset.build(cfg)).source.map((l) => l.text.replace(/\s*\/\/.*$/, "").trim()).filter(Boolean);
const outcomes = (preset: TimeZeroPreset, cfg: TimeZeroConfig) => exploreTimeZero(preset, cfg).outcomes.map((o) => o.result);
const reset = getTimeZeroScenario("time0-reset");
const comb = getTimeZeroScenario("comb-vs-star");
const race = getTimeZeroScenario("time0-race");
const ready = getTimeZeroScenario("decl-init-ready");

describe("preset catalogue", () => {
  it("keeps the four single-run presets unchanged and adds the four time-zero presets after them", () => {
    expect(proceduralScenarios.map((s) => s.id)).toEqual(["procedures", "nba-swap", "fork-timing", "edge-vs-level"]);
    expect(timeZeroScenarios.map((s) => s.id)).toEqual(["time0-reset", "comb-vs-star", "time0-race", "decl-init-ready"]);
    expect(ALL_PROCEDURAL_SCENARIO_IDS).toHaveLength(8);
    expect(ALL_PROCEDURAL_SCENARIO_IDS.filter(isTimeZeroScenario)).toHaveLength(4);
    expect(scenarioLabel("procedures")).toBe("initial · always · final");
  });

  it("pickerScenarios: without `scenarios`, the four single-run programs (or only a requested time-zero program)", () => {
    expect(pickerScenarios()).toEqual(SINGLE_RUN_SCENARIO_IDS);
    expect(SINGLE_RUN_SCENARIO_IDS).toEqual(["procedures", "nba-swap", "fork-timing", "edge-vs-level"]);
    expect(pickerScenarios("nba-swap")).toEqual(SINGLE_RUN_SCENARIO_IDS);
    expect(pickerScenarios("time0-race")).toEqual(["time0-race"]);
    expect(pickerScenarios("time0-reset", ["comb-vs-star", "time0-reset", "comb-vs-star"])).toEqual(["comb-vs-star", "time0-reset"]);
    expect(pickerScenarios(undefined, [])).toEqual(SINGLE_RUN_SCENARIO_IDS);
  });

  it("initialVariantOf accepts a variant the preset has and falls back otherwise", () => {
    expect(initialVariantOf(comb, "inputs-static")).toBe("inputs-static");
    expect(initialVariantOf(comb, "nope")).toBe("inputs-change");
    expect(initialVariantOf(reset)).toBe("blocking");
  });
});

describe("every time-zero prediction has exactly one option that every order of the ready processes confirms", () => {
  timeZeroScenarios.forEach((preset) => {
    it.each(configs(preset).map((cfg) => [`${cfg.variant}${cfg.advanced ? " + advanced" : ""}`, cfg] as const))(`${preset.id}: %s`, (_name, cfg) => {
      const e = exploreTimeZero(preset, cfg);
      expect(e.capped).toBe(false);
      const matching = preset.options(cfg).filter((o) => o.matches(e));
      expect(matching.map((o) => o.id)).toHaveLength(1);
      preset.options(cfg).forEach((o) => expect(o.feedback(cfg).length).toBeGreaterThan(40));
    });
  });

  it("each variant control sits on a line of the generated code", () => {
    timeZeroScenarios.forEach((preset) =>
      configs(preset).forEach((cfg) => {
        const keys = prepareScenario(preset.build(cfg)).source.map((l) => l.key);
        expect(keys, `${preset.id}/${cfg.variant}/${cfg.advanced}`).toContain(preset.variantLineKey(cfg));
      }),
    );
  });

  it("every trace step points only at generated source lines and ends with an end step", () => {
    timeZeroScenarios.forEach((preset) =>
      configs(preset).forEach((cfg) => {
        const scenario = preset.build(cfg);
        const keys = new Set(prepareScenario(scenario).source.map((l) => l.key).filter(Boolean));
        exploreTimeZero(preset, cfg).outcomes.forEach((o) => {
          o.result.trace.forEach((step) => {
            if (step.lineKey) expect(keys.has(step.lineKey), `${preset.id}: ${step.lineKey}`).toBe(true);
          });
          expect(o.result.trace.at(-1)?.kind).toBe("end");
        });
      }),
    );
  });
});

describe("(1) time0-reset: F2C 'Time zero and initialization order'", () => {
  it("shows the lesson's code, with the reset form chosen in the code line", () => {
    expect(sourceOf(reset, { variant: "blocking", advanced: false })).toEqual([
      "logic clk = 0;",
      "logic rst_n;",
      "enum logic {S_IDLE, S_RUN} state;",
      "always #5 clk = ~clk;",
      "always_ff @(posedge clk or negedge rst_n)",
      "if (!rst_n) state <= S_IDLE;",
      "else state <= S_RUN;",
      "initial begin",
      "rst_n = 1'b0;",
      "#15 rst_n = 1'b1;",
      "end",
    ]);
    expect(sourceOf(reset, { variant: "nonblocking", advanced: false })).toContain("rst_n <= 1'b0;");
    const initializer = sourceOf(reset, { variant: "initializer", advanced: false });
    expect(initializer).toContain("logic rst_n = 1'b0;");
    expect(initializer).toContain("initial #15 rst_n = 1'b1;");
  });

  it("§9.2 + Table 9-2: blocking — flop-first resets at 0; bench-first misses the x → 0 negedge and state stays x until the 5 ns posedge", () => {
    const runs = outcomes(reset, { variant: "blocking", advanced: false });
    expect(runs).toHaveLength(2);
    const flopFirst = runs.find((r) => startOrder(r).indexOf("flop") < startOrder(r).indexOf("bench")) as SimResult;
    const benchFirst = runs.find((r) => startOrder(r).indexOf("bench") < startOrder(r).indexOf("flop")) as SimResult;
    expect(valueAt(flopFirst, "state", 0)).toBe(0);
    expect(valueAt(benchFirst, "state", 0)).toBe("X");
    expect(valueAt(benchFirst, "state", 5)).toBe(0);
    // At the 5 ns posedge rst_n is still low, so the S_IDLE branch is taken.
    expect(valueAt(benchFirst, "rst_n", 5)).toBe(0);
    expect(benchFirst.trace.some((s) => /Table 9-2, from x to 0/.test(s.why) && /missed/.test(s.why))).toBe(true);
    expect(flopFirst.trace.some((s) => /fires: rst_n x → 0 is a negedge \(Table 9-2, from x to 0\)/.test(s.why))).toBe(true);
  });

  it("§4.5, §10.4.2: nonblocking — resets at 0 in every order", () => {
    const runs = outcomes(reset, { variant: "nonblocking", advanced: false });
    expect(runs).toHaveLength(1);
    expect(valueAt(runs[0], "state", 0)).toBe(0);
  });

  it("§6.8: declaration initializer — no change event, so state is x until 5 ns in every order", () => {
    const runs = outcomes(reset, { variant: "initializer", advanced: false });
    expect(runs).toHaveLength(1);
    expect(describeHistory(runs[0], "state", { name: "state", type: "logic", enumLabels: ["S_IDLE", "S_RUN"] })).toBe("state: x at 0 ns, S_IDLE from 5 ns");
    expect(runs[0].trace[0].why).toMatch(/derived from §6\.8/);
  });

  it("stops at the model horizon before the 15 ns release, and says so", () => {
    const r = simulateProcesses(time0ResetScenario("blocking"));
    expect(r.outcome).toMatchObject({ kind: "horizon", maxTime: 12, next: 15 });
    // Same due time: listed in booking order (bench booked at t = 0, the clock at t = 10).
    expect(r.trace.at(-1)?.booked.map((b) => `${b.label}@${b.time}`)).toEqual(["bench@15", "clock@15"]);
  });

  it("aligned outcome runs differ only in whether flop or bench runs first", () => {
    const cfg = { variant: "blocking", advanced: false };
    const runs = alignedOutcomeRuns(reset.build(cfg), exploreTimeZero(reset, cfg));
    expect(runs.map(startOrder)).toEqual([
      ["clock", "flop", "bench"],
      ["clock", "bench", "flop"],
    ]);
  });
});

describe("(2) comb-vs-star: F2C 'always_comb is not always @*' and F3A 'time zero, step by step'", () => {
  it("shows F2C's listing (logic a = 1'b1; logic y1, y2; ... initial #10 a = 1'b0;)", () => {
    expect(sourceOf(comb, { variant: "inputs-change", advanced: false })).toEqual([
      "logic a = 1'b1;",
      "logic y1, y2;",
      "always @* y1 = a;",
      "always_comb y2 = a;",
      "initial #10 a = 1'b0;",
    ]);
    expect(sourceOf(comb, { variant: "inputs-static", advanced: false })).not.toContain("initial #10 a = 1'b0;");
    const advanced = sourceOf(comb, { variant: "inputs-change", advanced: true });
    expect(advanced.slice(0, 2)).toEqual(["logic a;", "logic y1, y2;"]);
    expect(advanced).toContain("initial a = 1'b1;");
  });

  it("the variant control sits on the stimulus line; with a static, a comment line keeps that line", () => {
    [false, true].forEach((advanced) => {
      const change = prepareScenario(comb.build({ variant: "inputs-change", advanced })).source;
      const still = prepareScenario(comb.build({ variant: "inputs-static", advanced })).source;
      const key = comb.variantLineKey({ variant: "inputs-change", advanced });
      expect(key).toBe(comb.variantLineKey({ variant: "inputs-static", advanced }));
      const at = change.findIndex((l) => l.key === key);
      expect(change[at].text).toBe("initial #10 a = 1'b0; // stimulus");
      // Same line number in both variants, so the control does not move.
      expect(still.findIndex((l) => l.key === key)).toBe(at);
      expect(still[at].text).toBe("// (no initial #10 a = 1'b0;)");
    });
  });

  it("advanced: outcome 2's aligned run differs at the choice that decides y1 (init a before star), not at the stimulus", () => {
    const cfg = { variant: "inputs-change", advanced: true };
    const scenario = comb.build(cfg);
    const runs = alignedOutcomeRuns(scenario, exploreTimeZero(comb, cfg));
    const at = firstDivergentStep(runs);
    expect(runs.map((r) => r.trace[at].choice)).toEqual([
      { options: ["star", "init a", "stimulus"], picked: "star" },
      { options: ["star", "init a", "stimulus"], picked: "init a" },
    ]);
    expect(runs[1].trace[at].what).toBe("init a: a = 1 (was x).");
  });

  it("§9.2.2.2 / §9.2.2.2.2: y2 = 1 at 0; y1 stays x until 10; both are 0 at 10", () => {
    const [r, ...others] = outcomes(comb, { variant: "inputs-change", advanced: false });
    expect(others).toHaveLength(0);
    expect([valueAt(r, "y1", 0), valueAt(r, "y2", 0), valueAt(r, "y1", 10), valueAt(r, "y2", 10)]).toEqual(["X", 1, 0, 0]);
  });

  it("inputs-static (F3A): without the #10 write, always @* never computes y1", () => {
    const runs = outcomes(comb, { variant: "inputs-static", advanced: false });
    expect(runs).toHaveLength(1);
    expect(runs[0].finalVars).toMatchObject({ y1: "X", y2: 1 });
  });

  it("advanced: with initial a = 1'b1;, whether @* catches the write depends on start order; y2 ends time 0 at 1 in every order", () => {
    ["inputs-change", "inputs-static"].forEach((variant) => {
      const runs = outcomes(comb, { variant, advanced: true });
      expect(runs).toHaveLength(2);
      expect(runs.map((r) => valueAt(r, "y1", 0)).sort()).toEqual([1, "X"]);
      runs.forEach((r) => expect(valueAt(r, "y2", 0)).toBe(1));
    });
  });
});

describe("(3) time0-race: F3A 'The order the standard leaves open: the time-0 race'", () => {
  it("shows F3A's code exactly, and the fix", () => {
    expect(sourceOf(race, { variant: "as-written", advanced: false })).toEqual([
      "logic a;",
      'always @(a) $display("t=%0d a=%b", $time, a);',
      "initial begin",
      "a = 0;",
      "#10 a = 1;",
      "#10 a = 0;",
      "end",
    ]);
    expect(sourceOf(race, { variant: "fix", advanced: false })).toEqual([
      "logic a = 0;",
      'always @(a) $display("t=%0d a=%b", $time, a);',
      "initial begin",
      "#10 a = 1;",
      "#10 a = 0;",
      "end",
    ]);
  });

  it("§9.2: Order A (always block first) prints 3 lines, Order B (initial block first) prints 2", () => {
    const runs = outcomes(race, { variant: "as-written", advanced: false });
    const orderA = runs.find((r) => startOrder(r)[0] === "always block") as SimResult;
    const orderB = runs.find((r) => startOrder(r)[0] === "initial block") as SimResult;
    expect(orderA.log.map((l) => l.text)).toEqual(["t=0 a=0", "t=10 a=1", "t=20 a=0"]);
    expect(orderB.log.map((l) => l.text)).toEqual(["t=10 a=1", "t=20 a=0"]);
    expect(orderB.outcome).toEqual({ kind: "quiet", time: 20 });
  });

  it("§6.8: the fix collapses both orders into one group of 2 lines", () => {
    const e = exploreTimeZero(race, { variant: "fix", advanced: false });
    expect(e.runCount).toBe(2);
    expect(e.outcomes).toHaveLength(1);
    expect(e.outcomes[0].result.log.map((l) => l.text)).toEqual(["t=10 a=1", "t=20 a=0"]);
    expect(simulateProcesses(time0RaceScenario("fix")).trace[0].what).toMatch(/set a = 0/);
  });
});

describe("(4) decl-init-ready: F1C 'Not only keywords'", () => {
  it("shows F1C's code exactly", () => {
    expect(sourceOf(ready, { variant: "ieee1800", advanced: false })).toEqual(["reg ready = 1'b1;", 'always @(ready) $display("ready changed to %b", ready);']);
    expect(sourceOf(ready, { variant: "ieee1364-2005", advanced: false })).toEqual(sourceOf(ready, { variant: "ieee1800", advanced: false }));
  });

  it("IEEE 1800-2023 §6.8: silent in every order", () => {
    const runs = outcomes(ready, { variant: "ieee1800", advanced: false });
    expect(runs).toHaveLength(1);
    expect(runs[0].log).toEqual([]);
  });

  it("IEEE 1364-2005 behaviour (§6.8 NOTE): two groups — prints, or silent — decided by a scheduler choice", () => {
    const e = exploreTimeZero(ready, { variant: "ieee1364-2005", advanced: false });
    expect(e.outcomes.map((o) => o.result.log.map((l) => `${l.time}:${l.text}`))).toEqual(expect.arrayContaining([[], ["0:ready changed to 1"]]));
    e.outcomes.forEach((o) => expect(o.result.trace.some((s) => s.choice?.options.includes("init ready"))).toBe(true));
    expect(simulateProcesses(declInitReadyScenario("ieee1364-2005")).trace[0].why).toMatch(/§6\.8 NOTE/);
  });
});

describe("outcome waveforms (timelineLayout)", () => {
  const cases = timeZeroScenarios
    .filter((preset) => preset.watch.length)
    .flatMap((preset) => configs(preset).map((cfg) => [`${preset.id}: ${cfg.variant}${cfg.advanced ? " + advanced" : ""}`, preset, cfg] as const));

  it.each(cases)("every watched segment gets a visible, labelled bar: %s", (_name, preset, cfg) => {
    const scenario = preset.build(cfg);
    const decls = new Map((scenario.vars ?? []).map((d) => [d.name, d]));
    const e = exploreTimeZero(preset, cfg);
    // The cards draw the aligned runs; check the groups' own runs too.
    [...alignedOutcomeRuns(scenario, e), ...e.outcomes.map((o) => o.result)].forEach((run) => {
      const layout = timelineLayout(run, preset.watch, decls);
      expect(layout.axisEnd).toBeGreaterThan(layout.endTime);
      layout.rows.forEach((row) => {
        expect(row.segments).toHaveLength(settledHistory(run, row.name).length);
        row.segments.forEach((seg) => {
          expect(seg.labelFits, `${row.name} = ${seg.label} @ ${seg.time}`).toBe(true);
          expect(seg.to - seg.from).toBeGreaterThanOrEqual(timelineLabelWidth(seg.label));
        });
        // The last value runs on past the run's final time step to the right edge.
        expect(row.segments.at(-1)?.to).toBe(TIMELINE_X1);
        expect(layout.endX).toBeLessThan(TIMELINE_X1);
      });
    });
  });

  it("comb-vs-star 'a falls' (the F2C default): the 10 ns value of y1 and of y2 is a labelled bar, not a sliver at the edge", () => {
    const cfg = { variant: "inputs-change", advanced: false };
    const [run] = outcomes(comb, cfg);
    expect(run.endTime).toBe(10);
    const layout = timelineLayout(run, comb.watch);
    layout.rows.forEach((row) => {
      const last = row.segments.at(-1);
      expect(last).toMatchObject({ time: 10, label: "0", labelFits: true });
      expect((last?.to ?? 0) - (last?.from ?? 0)).toBeGreaterThan(40);
    });
    expect(layout.ticks.map((t) => t.time)).toEqual([0, 10]);
  });
});

describe("prediction options test both halves of the question", () => {
  it("comb-vs-star 'a falls' offers '@* never updates y1' (wrong at 10 ns), with §9.4.2.2 feedback", () => {
    const cfg = { variant: "inputs-change", advanced: false };
    const option = comb.options(cfg).find((o) => o.id === "star-never");
    expect(option?.label).toBe("y1 = x, y2 = 1 at 0 ns; y1 still x, y2 = 0 at 10 ns");
    expect(option?.matches(exploreTimeZero(comb, cfg))).toBe(false);
    expect(option?.feedback(cfg)).toMatch(/§9\.4\.2\.2/);
    expect(new Set(comb.options(cfg).map((o) => o.label.split("; ")[1]))).toEqual(new Set(["both 0 at 10 ns", "y1 still x, y2 = 0 at 10 ns"]));
    // Not offered when a never changes: "when the run ends" has no second half.
    expect(comb.options({ variant: "inputs-static", advanced: false }).some((o) => o.id === "star-never")).toBe(false);
  });

  it("comb-vs-star advanced: every option has a y1 clause and a parallel y2 clause", () => {
    comb.options({ variant: "inputs-change", advanced: true }).forEach((o) => {
      const [first, second] = o.label.split("; ");
      expect(first, o.label).toMatch(/y1/);
      expect(second, o.label).toMatch(/^y2 /);
    });
  });
});

describe("outcome cards", () => {
  it("time0-race names its cards Order A / Order B, as the notice and F3A's table do", () => {
    const cfg = { variant: "as-written", advanced: false };
    const runs = alignedOutcomeRuns(race.build(cfg), exploreTimeZero(race, cfg));
    expect(runs.map((r, i) => `${outcomeTitle(race, r, i).title}: ${startOrder(r)[0]}`)).toEqual(["Order A: always block", "Order B: initial block"]);
    expect(race.orderNote).toMatch(/Order A: the always block starts first\. Order B: the initial block starts first\./);
    expect(race.notice(cfg)).toMatch(/Order A and Order B/);
  });

  it("other presets keep 'Outcome n' (and 'outcome n' inside a sentence)", () => {
    const cfg = { variant: "blocking", advanced: false };
    const runs = alignedOutcomeRuns(reset.build(cfg), exploreTimeZero(reset, cfg));
    expect(runs.map((r, i) => outcomeTitle(reset, r, i))).toEqual([
      { title: "Outcome 1", inline: "outcome 1" },
      { title: "Outcome 2", inline: "outcome 2" },
    ]);
  });

  it("every multi-outcome card starts at a scheduler choice of its own run (so each badge names the choice that splits it)", () => {
    timeZeroScenarios.forEach((preset) =>
      configs(preset).forEach((cfg) => {
        const runs = alignedOutcomeRuns(preset.build(cfg), exploreTimeZero(preset, cfg));
        if (runs.length < 2) return;
        const at = divergenceFromBase(runs);
        runs.forEach((run, i) => expect(run.trace[at[i]].choice, `${preset.id}/${cfg.variant}/${cfg.advanced}/${i}`).toBeDefined());
        expect(at[0]).toBe(firstDivergentStep(runs));
      }),
    );
  });
});
