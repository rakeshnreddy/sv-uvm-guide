import { describe, expect, it } from "vitest";

import {
  ALL_VALUE_COUNT,
  BOUNDARY_PROBE_ASSUMPTIONS,
  LENS_VALUES,
  MAX_VALUES,
  PRESETS,
  THRESHOLD,
  axisFraction,
  bandSentence,
  bandTickLabel,
  bandTickWidth,
  caseInequal,
  check,
  countOptions,
  disagreementBand,
  explainRun,
  landingText,
  markerLayout,
  nextStep,
  normalizeValues,
  parseTemp,
  presetById,
  relational,
  rtlAlarm,
  rtlLine,
  runChecks,
  specExpected,
  xInputOutcome,
  xNote,
} from "@/lib/boundary-probe-model";

describe("IEEE 1800-2023 §11.4.4 relational operators", () => {
  it("§11.4.4: yields 1'b1 when the relation is true and 1'b0 when false, for known operands", () => {
    expect(relational(101, ">", 100)).toBe(1);
    expect(relational(100, ">", 100)).toBe(0);
    expect(relational(100, ">=", 100)).toBe(1);
    expect(relational(99, ">=", 100)).toBe(0);
  });

  it("§11.4.4: yields 1'bx when either operand is unknown", () => {
    expect(relational("x", ">", 100)).toBe("x");
    expect(relational(100, ">=", "x")).toBe("x");
  });

  it("§11.4.4 and §6.11.3: logic [7:0] is unsigned, so 0 and 255 compare as the smallest and largest values", () => {
    expect(relational(0, ">=", THRESHOLD)).toBe(0);
    expect(relational(255, ">", THRESHOLD)).toBe(1);
    expect(rtlAlarm(0, false)).toBe(0);
    expect(specExpected(255)).toBe(1);
  });
});

describe("IEEE 1800-2023 §11.4.5 case inequality !==", () => {
  it("§11.4.5: compares including x, and always yields 0 or 1", () => {
    expect(caseInequal(0, 1)).toBe(1);
    expect(caseInequal(1, 1)).toBe(0);
    expect(caseInequal("x", 1)).toBe(1);
    expect(caseInequal("x", "x")).toBe(0);
  });

  it("§11.4.4 and §11.4.5: with temp = X both sides are 1'bx and the check counts a pass (the trap this lab leaves out)", () => {
    expect(xInputOutcome(false)).toEqual({ alarm: "x", expected: "x", differs: 0 });
    expect(xInputOutcome(true)).toEqual({ alarm: "x", expected: "x", differs: 0 });
    expect(xNote()).toContain("1'bx !== 1'bx is 0");
    expect(BOUNDARY_PROBE_ASSUMPTIONS).toContain(xNote());
  });
});

describe("the lesson's hand-traced output (F1A worked example)", () => {
  it("§11.4.4/§11.4.5: the boundary test with > prints FAIL temp=100 alarm=0 expected=1, then PASS=2 FAIL=1", () => {
    const run = runChecks(presetById("boundary").values, false);
    expect(run.output).toEqual(["FAIL temp=100 alarm=0 expected=1", "PASS=2 FAIL=1"]);
    expect([run.pass, run.fail]).toEqual([2, 1]);
  });

  it("§11.4.4: after the fix (>=) the same test prints PASS=3 FAIL=0", () => {
    const run = runChecks(presetById("boundary").values, true);
    expect(run.output).toEqual(["PASS=3 FAIL=0"]);
  });

  it("§11.4.4: the typical values 50 and 150 pass even with the bug", () => {
    expect(runChecks(presetById("typical").values, false).summary).toBe("PASS=2 FAIL=0");
    expect(runChecks(presetById("typical").values, false).output).toEqual(["PASS=2 FAIL=0"]);
  });

  it("pins the presets to the lesson's values, and an unknown id falls back to the default typical", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["typical", "boundary"]);
    expect(presetById("typical").values).toEqual([50, 150]);
    expect(presetById("boundary").values).toEqual([99, 100, 101]);
    expect(presetById("Boundary" as never).id).toBe("typical");
  });

  it("matches the lesson's trace table row by row", () => {
    const rows = [50, 99, 100, 101, 150].map((t) => check(t, false));
    expect(rows.map((r) => [r.temp, r.alarm, r.expected, r.pass])).toEqual([
      [50, 0, 0, true],
      [99, 0, 0, true],
      [100, 0, 1, false],
      [101, 1, 1, true],
      [150, 1, 1, true],
    ]);
  });

  it("an empty test prints only PASS=0 FAIL=0", () => {
    expect(runChecks([], false).output).toEqual(["PASS=0 FAIL=0"]);
  });

  it("writes the RTL line with the chosen operator", () => {
    expect(rtlLine(false)).toBe("assign alarm = (temp > 8'd100);");
    expect(rtlLine(true)).toBe("assign alarm = (temp >= 8'd100);");
  });
});

describe("the disagreement band over all 256 values (§11.4.4)", () => {
  it("is exactly one value wide, 100, with the bug", () => {
    expect(ALL_VALUE_COUNT).toBe(256);
    expect(disagreementBand(false)).toEqual({ values: [100], width: 1, text: "100" });
    expect(bandSentence(false)).toContain("exactly one of the 256 values, 100");
  });

  it("is empty after the fix", () => {
    expect(disagreementBand(true)).toEqual({ values: [], width: 0, text: "none" });
    expect(bandSentence(true)).toContain("agree on all 256 values");
  });

  it("the zoom lens covers the band and both neighbours", () => {
    expect(LENS_VALUES[0]).toBe(97);
    expect(LENS_VALUES[LENS_VALUES.length - 1]).toBe(103);
    expect(LENS_VALUES).toContain(100);
    expect(LENS_VALUES).toEqual([97, 98, 99, 100, 101, 102, 103]);
  });

  it("places each value at the centre of its slot on the 0 to 255 axis", () => {
    expect(axisFraction(0)).toBe(0.5 / 256);
    expect(axisFraction(255)).toBe(255.5 / 256);
    expect(axisFraction(100)).toBe(100.5 / 256);
  });
});

describe("custom values", () => {
  it("accepts whole numbers 0 to 255, including both ends", () => {
    expect(parseTemp("0", [])).toEqual({ ok: true, value: 0 });
    expect(parseTemp(" 255 ", [])).toEqual({ ok: true, value: 255 });
  });

  it("refuses out-of-range, negative, non-integer, X, duplicate and over-limit input with a reason", () => {
    for (const text of ["256", "-1", "12.5", "abc", "", "x", "Z"]) expect(parseTemp(text, []).ok).toBe(false);
    expect(parseTemp("x", [])).toMatchObject({ error: expect.stringContaining("X and Z") });
    expect(parseTemp("?", [])).toMatchObject({ error: expect.stringContaining("X and Z") });
    expect(parseTemp("256", [])).toMatchObject({ error: "256 does not fit in logic [7:0], which holds 0 to 255." });
    expect(parseTemp("-1", [])).toMatchObject({ error: "-1 does not fit in logic [7:0], which holds 0 to 255." });
    expect(parseTemp("12.5", [])).toMatchObject({ error: expect.stringContaining("is not a whole number") });
    expect(parseTemp("100", [100])).toMatchObject({ error: "100 is already in the test." });
    expect(parseTemp("7", [0, 1, 2, 3, 4, 5, 6, 8])).toMatchObject({ error: expect.stringContaining(`at most ${MAX_VALUES}`) });
  });

  it("normalizes to sorted unique in-range values", () => {
    expect(normalizeValues([150, 50, 50, 300, -2, 1.5])).toEqual([50, 150]);
  });
});

describe("the PASS/FAIL prediction", () => {
  it("offers every possible summary with exactly one correct, matching the run, for presets and custom sets", () => {
    const sets = [...PRESETS.map((p) => p.values), [100], [50], [0, 1, 99, 100, 101, 102, 254, 255]];
    for (const values of sets) {
      for (const fixed of [false, true]) {
        const opts = countOptions(values, fixed);
        expect(opts).toHaveLength(values.length + 1);
        const correct = opts.filter((o) => o.correct);
        expect(correct).toHaveLength(1);
        expect(correct[0].label).toBe(runChecks(values, fixed).summary);
        expect(correct[0].feedback).toBe(explainRun(values, fixed));
      }
    }
  });

  it("explains one-value and empty runs without awkward wording", () => {
    expect(explainRun([50], false)).toContain("PASS=1 FAIL=0: 50 is not 100");
    expect(explainRun([50], false)).not.toContain("none of");
    expect(explainRun([100], false)).toBe("PASS=0 FAIL=1: 100 sits in the disagreement band, where alarm is 0 but expected is 1.");
    expect(explainRun([], false)).toBe("PASS=0 FAIL=0: the test checks no values, so nothing can fail.");
  });

  it("after the fix every wrong option says no check can fail", () => {
    const wrong = countOptions([99, 100, 101], true).filter((o) => !o.correct);
    expect(wrong).toHaveLength(3);
    for (const o of wrong) expect(o.feedback).toContain("no check can fail");
  });

  it("explains why the boundary run fails once and the typical run hides the bug", () => {
    expect(explainRun([99, 100, 101], false)).toBe(
      "PASS=2 FAIL=1: only 100 sits in the disagreement band, where alarm is 0 but expected is 1; every other value lands on the same side of the threshold under both operators.",
    );
    expect(explainRun([50, 150], false)).toContain("none of 50 and 150 is 100");
    expect(explainRun([99, 100, 101], true)).toContain("every check passes");
  });

  it("wrong options say how many values really fall in the band", () => {
    const wrong = countOptions([50, 150], false).find((o) => o.label === "PASS=1 FAIL=1");
    expect(wrong?.feedback).toContain("none of these values lands");
    const under = countOptions([99, 100, 101], false).find((o) => o.label === "PASS=3 FAIL=0");
    expect(under?.feedback).toContain("1 of these values lands");
    expect(under?.feedback).toContain("each of those fails");
  });
});

describe("prediction feedback wording for every count", () => {
  it("never says 'all 1 of these values' when a single value fails", () => {
    const options = countOptions([100], false);
    const wrong = options.find((o) => o.label === "PASS=1 FAIL=0");
    expect(wrong).toBeDefined();
    for (const o of options) expect(o.feedback).not.toMatch(/all 1 of/);
    expect(landingText(1, 1)).toBe("the one value lands");
    expect(landingText(0, 1)).toBe("the one value does not land");
    expect(landingText(3, 3)).toBe("all 3 of these values land");
    expect(landingText(1, 3)).toBe("only 1 of these values lands");
    expect(landingText(0, 2)).toBe("none of these values lands");
  });
});

describe("number-line marker layout", () => {
  const spread = [0, 30, 60, 90, 120, 150, 180, 210];

  it("puts every value's triangle at its own true place on the axis", () => {
    for (const values of [spread, [0, 25, 50, 75, 100, 125, 150, 175], [97, 98, 99, 100, 101, 102, 103, 104]]) {
      const layout = markerLayout(values, null);
      expect(layout.markers.map((m) => m.value)).toEqual(values);
      for (const m of layout.markers) expect(m.at).toBe(axisFraction(m.value));
    }
  });

  it("keeps labels inside the axis and never overlaps two labels in one row, before and after the reveal", () => {
    for (const values of [spread, [97, 98, 99, 100, 101, 102, 103, 104], [0, 1, 254, 255], [99, 100, 101]]) {
      for (const run of [null, runChecks(values, false)]) {
        const { markers, rows } = markerLayout(values, run);
        for (const m of markers) {
          expect(m.labelLeft).toBeGreaterThanOrEqual(0);
          expect(m.labelLeft + m.labelWidth).toBeLessThanOrEqual(1 + 1e-9);
          expect(m.row).toBeLessThan(rows);
        }
        for (let r = 0; r < rows; r++) {
          const inRow = markers.filter((m) => m.row === r);
          for (let i = 1; i < inRow.length; i++) expect(inRow[i].labelLeft).toBeGreaterThan(inRow[i - 1].labelLeft + inRow[i - 1].labelWidth);
        }
      }
    }
  });

  it("labels carry the verdict glyph only after the reveal", () => {
    expect(markerLayout([99, 100, 101], null).markers.map((m) => m.label)).toEqual(["99", "100", "101"]);
    expect(markerLayout([99, 100, 101], runChecks([99, 100, 101], false)).markers.map((m) => m.label)).toEqual(["99 ✓", "100 ✕", "101 ✓"]);
  });

  it("the RTL-row band tick names the band value and disappears after the fix", () => {
    expect(bandTickLabel(false)).toBe(`${disagreementBand(false).text}: see close-up`);
    expect(bandTickLabel(false)).toMatch(/^100:/);
    expect(bandTickLabel(true)).toBeNull();
    expect(bandTickWidth(true)).toBeNull();
  });

  it("the band tick fits inside the axis at the narrowest layout", () => {
    const width = bandTickWidth(false) ?? 2;
    expect(axisFraction(disagreementBand(false).values[0]) + width).toBeLessThanOrEqual(1);
  });
});

describe("the next step after a reveal", () => {
  it("typical values point to the boundary preset", () => {
    const step = nextStep([50, 150], false);
    expect(step.action).toBe("boundary");
    expect(step.text).toContain("99, 100 and 101");
    expect(step.text).toContain("None of 50 and 150 is 100");
  });

  it("a single passing value is worded for one value", () => {
    expect(nextStep([50], false).text).toMatch(/^50 is not 100/);
  });

  it("a test that catches the bug points to the fix", () => {
    const step = nextStep([99, 100, 101], false);
    expect(step.action).toBe("fix");
    expect(step.text).toMatch(/^100 caught the bug/);
    expect(step.text).toContain("> becomes >=");
    expect(step.button).toBe("Apply the fix");
  });

  it("after the fix there is nothing left to catch", () => {
    const step = nextStep([99, 100, 101], true);
    expect(step.action).toBeNull();
    expect(step.button).toBeNull();
  });
});
