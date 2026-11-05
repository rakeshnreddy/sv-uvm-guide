import { describe, expect, it } from "vitest";

import {
  ALL_SCALES,
  CROSS_SCOPE_CODE,
  CROSS_SCOPE_DEFAULT,
  CALL_FORM_TEXT,
  READ_TIME_PRESETS,
  ROUNDING_PRESETS,
  WHICH_UNIT_FILES,
  argumentFs,
  arrangeOptions,
  axisForWakes,
  binaryRemark,
  checkScalePair,
  clockPeriodFs,
  crossScopeCode,
  crossScopeOptions,
  customReadTimeCaller,
  defaultTimeformatUnits,
  defaultUnitsOptions,
  displayCode,
  effectiveFormat,
  exactInBinary,
  explainLine,
  formatFsAuto,
  formatFsIn,
  formatPercentT,
  formatScale,
  globalPrecisionDesign,
  globalPrecisionOptions,
  globalPrecisionReport,
  gradeCrossScopeFixes,
  gradeCrossScopeSuspects,
  linesChangedFromPreset,
  parseDelay,
  parseScale,
  percentTArgMatters,
  pow10,
  presetChangeText,
  rationalToDecimal,
  readTime,
  readTimeCode,
  readTimeOptions,
  realToInteger,
  renderDisplay,
  repeatedWakes,
  resolveTimeScopes,
  roundDelayText,
  roundingOptions,
  runReadTime,
  scale,
  scaleExponent,
  scaleFromExponent,
  scaleToFs,
  setsFormatBeforeFirstPrint,
  splitPadding,
  thenEveryText,
  tickCount,
  traceCrossScope,
  twoModulesGlobalPrecision,
  unitChipText,
  unitSentence,
  usesPercentT,
  wakeSequenceOptions,
  wakeText,
  wakesBelow64Bits,
  whichUnitOptions,
  withPercentTArg,
  type SourceFile,
} from "@/lib/sv-timescale-model";

const ns = (n: number) => BigInt(n) * scaleToFs(scale(1, "ns"));
const ps = (n: number) => BigInt(n) * scaleToFs(scale(1, "ps"));
const filesInOrder = (ids: string[]): SourceFile[] => ids.map((id) => WHICH_UNIT_FILES.find((f) => f.id === id) as SourceFile);

describe("sv-timescale-model: units and scales (IEEE 1800-2023 §3.14, Table 3-1, Table 20-2)", () => {
  it("knows all 18 scales (1, 10 or 100 of s, ms, us, ns, ps, fs) and their Table 20-2 exponents", () => {
    expect(ALL_SCALES).toHaveLength(18);
    expect(scaleExponent(scale(100, "s"))).toBe(2);
    expect(scaleExponent(scale(1, "ns"))).toBe(-9);
    expect(scaleExponent(scale(100, "ps"))).toBe(-10);
    expect(scaleExponent(scale(1, "fs"))).toBe(-15);
    for (const s of ALL_SCALES) expect(scaleFromExponent(scaleExponent(s))).toEqual(s);
    expect(scaleFromExponent(3)).toBeNull();
    expect(scaleFromExponent(-16)).toBeNull();
  });

  it("converts scales to exact femtosecond counts and parses their text", () => {
    expect(scaleToFs(scale(1, "fs"))).toBe(BigInt(1));
    expect(scaleToFs(scale(1, "ns"))).toBe(pow10(6));
    expect(scaleToFs(scale(100, "s"))).toBe(pow10(17));
    expect(parseScale("100 ps")).toEqual(scale(100, "ps"));
    expect(parseScale("2ns")).toBeNull();
    expect(formatScale(scale(10, "ns"))).toBe("10ns");
  });

  it("§3.14: the precision shall be at least as precise as the unit", () => {
    expect(checkScalePair(scale(1, "ns"), scale(100, "ps"))).toBeNull();
    expect(checkScalePair(scale(1, "ns"), scale(1, "ns"))).toBeNull();
    expect(checkScalePair(scale(1, "ns"), scale(10, "ns"))).toMatch(/coarser than the unit/);
    expect(roundDelayText("#3.14", scale(1, "ns"), scale(10, "ns")).error).toMatch(/§3\.14/);
  });
});

describe("sv-timescale-model: exact decimal arithmetic (no floats)", () => {
  it("writes rationals as exact decimals, trimming or rounding half away from zero", () => {
    expect(rationalToDecimal({ num: BigInt(13), den: BigInt(10) })).toBe("1.3");
    expect(rationalToDecimal({ num: BigInt(1300), den: BigInt(1000) })).toBe("1.3");
    expect(rationalToDecimal({ num: BigInt(16), den: BigInt(1) })).toBe("16");
    expect(rationalToDecimal({ num: BigInt(13), den: BigInt(10) }, 2)).toBe("1.30");
    expect(rationalToDecimal({ num: BigInt(125), den: BigInt(100) }, 1)).toBe("1.3");
    expect(rationalToDecimal({ num: BigInt(124), den: BigInt(100) }, 1)).toBe("1.2");
  });

  it("picks a readable unit for femtosecond counts", () => {
    expect(formatFsAuto(ns(13))).toBe("13 ns");
    expect(formatFsAuto(ps(1300))).toBe("1.3 ns");
    expect(formatFsAuto(ps(5))).toBe("5 ps");
    expect(formatFsAuto(BigInt(0))).toBe("0 ns");
    expect(formatFsIn(ns(5), "ps")).toBe("5000 ps");
  });
});

describe("sv-timescale-model: parsing delays (§5.8 time literals, §9.4.1 x/z and negative delays)", () => {
  it("parses #d, time literals, #(x) and #(-1) without floats", () => {
    expect(parseDelay("#2.75")).toMatchObject({ kind: "number", digits: BigInt(275), den: BigInt(100) });
    expect(parseDelay("1_000")).toMatchObject({ kind: "number", digits: BigInt(1000), den: BigInt(1) });
    expect(parseDelay("#2.1ns")).toMatchObject({ kind: "literal", digits: BigInt(21), den: BigInt(10), literalUnit: "ns" });
    expect(parseDelay("40ps")).toMatchObject({ kind: "literal", digits: BigInt(40), literalUnit: "ps" });
    expect(parseDelay("#(1'bx)")).toMatchObject({ kind: "xz" });
    expect(parseDelay("#(1'bz)")).toMatchObject({ kind: "xz" });
    expect(parseDelay("#('x)")).toMatchObject({ kind: "xz" });
    expect(parseDelay("#(4'bxz_x)")).toMatchObject({ kind: "xz" });
    expect(parseDelay("#(1'b?)")).toMatchObject({ kind: "xz" });
    const neg = parseDelay("#(-1)");
    expect(neg.kind).toBe("negative");
    if (neg.kind === "negative") expect(neg.asUnsigned.toString()).toBe("18446744073709551615");
    expect(parseDelay("#abc").kind).toBe("invalid");
    expect(parseDelay("-1.5").kind).toBe("invalid");
  });
});

describe("sv-timescale-model: rounding to the element's precision (§3.14.1)", () => {
  it("§3.14.1 example: 2.75 ns at 1ns/100ps becomes 2.8 ns (27.5 ticks, both tie rules agree)", () => {
    const r = roundDelayText("#2.75", scale(1, "ns"), scale(100, "ps"));
    expect(r.scaledText).toBe("2.75 ns");
    expect(r.ticks).toMatchObject({ exactHalf: true });
    expect(r.tie).toMatchObject({ awayFromZero: BigInt(28), toEven: BigInt(28), agree: true });
    expect(r.wakeFs).toBe(ps(2800));
    expect(r.toolDependent).toBe(false);
    expect(wakeText(r)).toBe("2.8 ns");
  });

  it("reproduces the six rows of the F3A table", () => {
    const row = (delay: string, unit: ReturnType<typeof scale>, precision: ReturnType<typeof scale>) => wakeText(roundDelayText(delay, unit, precision));
    expect(row("#2.75", scale(1, "ns"), scale(100, "ps"))).toBe("2.8 ns");
    expect(row("#1.26", scale(1, "ns"), scale(100, "ps"))).toBe("1.3 ns");
    expect(row("#1.26", scale(10, "ns"), scale(1, "ns"))).toBe("13 ns");
    expect(row("#2.5", scale(10, "ns"), scale(1, "ns"))).toBe("25 ns");
    expect(row("#0.4", scale(1, "ns"), scale(1, "ns"))).toBe("0 ns");
    expect(row("#5ns", scale(1, "ps"), scale(1, "ps"))).toBe("5000 ps");
  });

  it("#1.55 at 1ns/100ps is 1.6 ns and #15.5 ns at 1 ns precision is 16 ns: 15.5 ticks round to 16 under both tie rules", () => {
    const a = roundDelayText("#1.55", scale(1, "ns"), scale(100, "ps"));
    expect(a.tie).toMatchObject({ awayFromZero: BigInt(16), toEven: BigInt(16), agree: true });
    expect(wakeText(a)).toBe("1.6 ns");
    const b = roundDelayText("#1.55", scale(10, "ns"), scale(1, "ns"));
    expect(b.scaledText).toBe("15.5 ns");
    expect(b.wakeFs).toBe(ns(16));
  });

  it("#2.85 at 1ns/100ps is an exact half tick where the tie rules disagree: tool-dependent, both values reported", () => {
    const r = roundDelayText("#2.85", scale(1, "ns"), scale(100, "ps"));
    expect(r.tie).toMatchObject({ awayFromZero: BigInt(29), toEven: BigInt(28), agree: false });
    expect(r.toolDependent).toBe(true);
    expect(r.wakeFs).toBeNull();
    expect(r.candidatesFs).toEqual([ps(2800), ps(2900)]);
    expect(wakeText(r)).toBe("2.8 ns or 2.9 ns (tool-dependent)");
    expect(r.steps.join(" ")).toMatch(/states no tie rule/);
  });

  it("§5.8: a time literal is scaled to the current unit, then rounded: #2.1ns at 10ns/1ns is 0.21 units and wakes at 2 ns", () => {
    const r = roundDelayText("#2.1ns", scale(10, "ns"), scale(1, "ns"));
    expect(r.scaledInUnits).toBe("0.21");
    expect(r.wakeFs).toBe(ns(2));
    expect(r.steps[0]).toMatch(/§5\.8/);
  });

  it("#0.4 at 1ns/1ns rounds to 0: the statement runs in the same time slot, whatever a finer precision elsewhere says", () => {
    const r = roundDelayText("#0.4", scale(1, "ns"), scale(1, "ns"));
    expect(r.wakeFs).toBe(BigInt(0));
    expect(r.steps.join(" ")).toMatch(/same time slot/);
    expect(r.steps.join(" ")).toMatch(/finer precision elsewhere/);
  });

  it("§9.4.1: an x or z delay is zero; a negative delay is a 64-bit unsigned value", () => {
    const x = roundDelayText("#(1'bx)", scale(1, "ns"), scale(100, "ps"));
    expect(x.wakeFs).toBe(BigInt(0));
    expect(x.special).toBe("x/z delay");
    const n = roundDelayText("#(-1)", scale(1, "ns"), scale(100, "ps"));
    expect(n.wakeFs).toBe(BigInt("18446744073709551615") * scaleToFs(scale(1, "ns")));
    expect(wakeText(n)).toMatch(/2\^64 − 1 units/);
  });

  it("repeated delays: the k-th wake is k times the rounded delay (tb_top 1.3 ns; u_slow 13 ns then 26 ns)", () => {
    const fast = roundDelayText("#1.26", scale(1, "ns"), scale(100, "ps"));
    const slow = roundDelayText("#1.26", scale(10, "ns"), scale(1, "ns"));
    expect(repeatedWakes(fast, 1).map((w) => w.candidatesFs[0])).toEqual([ps(1300)]);
    expect(repeatedWakes(slow, 2).map((w) => w.candidatesFs[0])).toEqual([ns(13), ns(26)]);
  });

  it("sequence options: u_slow's two wakes are 13 ns, then 26 ns, with tb_top's result as a distractor", () => {
    const slow = roundDelayText("#1.26", scale(10, "ns"), scale(1, "ns"));
    const options = wakeSequenceOptions(slow, 2, { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") });
    expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual(["13 ns, then 26 ns"]);
    expect(options.map((o) => o.label)).toEqual(expect.arrayContaining(["12.6 ns, then 25.2 ns", "1.3 ns, then 2.6 ns"]));
  });

  it("every rounding preset is legal and builds exactly one correct prediction option", () => {
    for (const p of ROUNDING_PRESETS) {
      const r = roundDelayText(p.delay, p.unit, p.precision);
      expect(r.error, p.id).toBeNull();
      const options = roundingOptions(r);
      expect(options.filter((o) => o.correct), p.id).toHaveLength(1);
      expect(new Set(options.map((o) => o.label)).size, p.id).toBe(options.length);
    }
  });

  it("every prediction is a real choice: at least three distinct options, exactly one correct, across all scale pairs", () => {
    const delays = ["#0", "#1", "#3", "#0.4", "#0.5", "#1.26", "#2.5", "#2.85", "#5ns", "#2.1ns", "#(1'bx)", "#(-1)"];
    let checked = 0;
    for (const unit of ALL_SCALES) {
      for (const precision of ALL_SCALES) {
        if (checkScalePair(unit, precision)) continue;
        for (const delay of delays) {
          const r = roundDelayText(delay, unit, precision);
          expect(r.error, delay).toBeNull();
          for (const options of [roundingOptions(r), wakeSequenceOptions(r, 2, { name: "other", unit: scale(10, "ns"), precision: scale(1, "ns") })]) {
            const where = `${delay} at ${formatScale(unit)}/${formatScale(precision)}`;
            expect(options.length, where).toBeGreaterThanOrEqual(3);
            expect(options.filter((o) => o.correct), where).toHaveLength(1);
            expect(new Set(options.map((o) => o.label)).size, where).toBe(options.length);
          }
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("the cases that used to collapse now keep their answer and gain distractors", () => {
    const three = roundingOptions(roundDelayText("#3", scale(1, "ns"), scale(1, "ns")));
    expect(three.find((o) => o.correct)?.label).toBe("3 ns");
    expect(three.map((o) => o.id)).toEqual(expect.arrayContaining(["same-slot", "step-later", "ten-x"]));
    const zero = roundingOptions(roundDelayText("#0", scale(1, "ns"), scale(1, "ns")));
    expect(zero.find((o) => o.correct)?.label).toBe("0 ns");
    expect(zero.length).toBeGreaterThanOrEqual(3);
    for (const id of ["table-2.5", "table-5ns"]) {
      const p = ROUNDING_PRESETS.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      if (p) expect(roundingOptions(roundDelayText(p.delay, p.unit, p.precision)).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it("arrangeOptions keeps every option, is deterministic, and does not always put the correct one first", () => {
    const arranged = ROUNDING_PRESETS.map((p) => {
      const options = roundingOptions(roundDelayText(p.delay, p.unit, p.precision));
      const once = arrangeOptions(options);
      expect(arrangeOptions(options), p.id).toEqual(once);
      expect([...once].sort((a, b) => a.id.localeCompare(b.id)), p.id).toEqual([...options].sort((a, b) => a.id.localeCompare(b.id)));
      return once.findIndex((o) => o.correct);
    });
    expect(new Set(arranged).size).toBeGreaterThan(1);
  });

  it("the prediction distractors name the misconceptions: unrounded, truncated and precision-as-unit", () => {
    const ids = roundingOptions(roundDelayText("#2.75", scale(1, "ns"), scale(100, "ps"))).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["rounded", "unrounded", "truncated", "precision-as-unit"]));
    const literal = roundingOptions(roundDelayText("#5ns", scale(1, "ps"), scale(1, "ps")));
    expect(literal.find((o) => o.id === "unit-ignored")?.label).toMatch(/^5 ps/);
  });
});

describe("sv-timescale-model: $time, $stime, $realtime (§20.3.1 to §20.3.3)", () => {
  it("§20.3.1 example: 16 ns and 32 ns in a 10 ns unit read as $time 2 and 3, $realtime 1.6 and 3.2", () => {
    const a = readTime(ns(16), scale(10, "ns"));
    const b = readTime(ns(32), scale(10, "ns"));
    expect(a.time).toBe(BigInt(2));
    expect(rationalToDecimal(a.realtime)).toBe("1.6");
    expect(b.time).toBe(BigInt(3));
    expect(rationalToDecimal(b.realtime)).toBe("3.2");
  });

  it("§20.3.2: $stime returns the low 32 bits (5 ms in a 1 ps unit reads 705,032,704)", () => {
    const r = readTime(BigInt(5) * scaleToFs(scale(1, "ms")), scale(1, "ps"));
    expect(r.time.toString()).toBe("5000000000");
    expect(r.stime.toString()).toBe("705032704");
    expect(r.stimeWrapped).toBe(true);
  });

  it("§6.12.1: real to integer rounds to nearest, an exact half away from zero", () => {
    expect(realToInteger({ num: BigInt(15), den: BigInt(10) })).toEqual({ value: BigInt(2), exactHalf: true });
    expect(realToInteger({ num: BigInt(357), den: BigInt(10) }).value).toBe(BigInt(36));
    expect(realToInteger({ num: BigInt(352), den: BigInt(10) }).value).toBe(BigInt(35));
    expect(readTime(ns(25), scale(10, "ns"))).toMatchObject({ time: BigInt(3), timeExactHalf: true });
  });
});

describe("sv-timescale-model: %t and $timeformat (§20.4.3, Tables 20-2 and 20-3)", () => {
  it("converts the argument to the $timeformat units with the given digits, suffix and minimum width", () => {
    expect(formatPercentT(ns(16), { units: -9, precision: 3, suffix: " ns", minWidth: 0 })).toBe("16.000 ns");
    expect(formatPercentT(ns(13), { units: -9, precision: 1, suffix: " ns", minWidth: 0 })).toBe("13.0 ns");
    expect(formatPercentT(ns(10), { units: -12, precision: 0, suffix: "", minWidth: 20 })).toBe("               10000");
    expect(formatPercentT(ns(10), { units: -9, precision: 0, suffix: " ns", minWidth: 8 })).toBe("   10 ns");
    expect(formatPercentT(ns(10), { units: -12, precision: 0, suffix: "", minWidth: 20 }, true)).toBe("10000");
  });

  it("Table 20-3 defaults: units are the smallest `timescale precision in the source, 0 digits, no suffix, width 20; no `timescale means tool-dependent", () => {
    expect(defaultTimeformatUnits({ timescalePrecisions: [scale(1, "ns"), scale(1, "ps"), scale(100, "ps")] })).toEqual(scale(1, "ps"));
    expect(defaultTimeformatUnits({ timescalePrecisions: [] })).toBeNull();
    expect(effectiveFormat(null, { timescalePrecisions: [scale(1, "ps")] })).toEqual({ units: -12, precision: 0, suffix: "", minWidth: 20 });
    expect(effectiveFormat(null, { timescalePrecisions: [] })).toBeNull();
  });

  it("%t of $time has already lost the fraction; %t of $realtime keeps it (the lesson's pitfall)", () => {
    const readings = readTime(ns(26), scale(10, "ns"));
    const fmt = { units: -9, precision: 1, suffix: " ns", minWidth: 0 };
    expect(formatPercentT(argumentFs(readings, "realtime", scale(10, "ns")), fmt)).toBe("26.0 ns");
    expect(formatPercentT(argumentFs(readings, "time", scale(10, "ns")), fmt)).toBe("30.0 ns");
  });

  it("renders $display templates and marks %t tool-dependent when nothing fixes the units", () => {
    const readings = readTime(ps(1300), scale(1, "ns"));
    const r = renderDisplay("tb_top   $time=%0d $realtime=%.2f %%t=%t", [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.2f" }, { fn: "realtime", spec: "%t" }], readings, scale(1, "ns"), { units: -9, precision: 1, suffix: " ns", minWidth: 0 }, { timescalePrecisions: [] });
    expect(r.text).toBe("tb_top   $time=1 $realtime=1.30 %t=1.3 ns");
    const td = renderDisplay("%t", [{ fn: "realtime", spec: "%t" }], readings, scale(1, "ns"), null, { timescalePrecisions: [] });
    expect(td.toolDependent).toBe(true);
  });
});

describe("sv-timescale-model: read-time presets run through the model", () => {
  const preset = (id: string) => READ_TIME_PRESETS.find((p) => p.id === id) as (typeof READ_TIME_PRESETS)[number];

  it("'20.3.1': #1.55 twice at 10ns/1ns prints $time 2 then 3 and $realtime 1.6 then 3.2", () => {
    const t = runReadTime(preset("20.3.1").callers, preset("20.3.1").build);
    expect(t.errors).toEqual([]);
    expect(t.snapshots.map((s) => formatFsAuto(s.readings.absFs))).toEqual(["16 ns", "32 ns"]);
    expect(t.lines.map((l) => l.text.replace(/\s+/g, " "))).toEqual(["$time=2 $realtime=1.6 %t= 16", "$time=3 $realtime=3.2 %t= 32"]);
  });

  it("'make-it-work': the lesson's three log lines, including %t converting u_slow's 1.3 to 13.0 ns", () => {
    const t = runReadTime(preset("make-it-work").callers, preset("make-it-work").build);
    expect(t.lines.map((l) => l.text)).toEqual([
      "tb_top   $time=1 $realtime=1.30 %t=1.3 ns",
      "slow_gen $time=1 $realtime=1.30 %t=13.0 ns",
      "slow_gen $time=3 $realtime=2.60 %t=26.0 ns",
    ]);
    expect(t.lines.every((l) => !l.toolDependent)).toBe(true);
  });

  it("'uvm-stamp': without $timeformat, %0t of $realtime at 15 ns under `timescale 1ns/1ps prints 15000", () => {
    const p = preset("uvm-stamp");
    const t = runReadTime(p.callers, p.build);
    expect(t.lines[0].text).toContain("@ 15000:");
    const fixed = runReadTime(p.callers, p.build, { units: -9, precision: 3, suffix: " ns", minWidth: 0 });
    expect(fixed.lines[0].text).toContain("@ 15.000 ns:");
  });

  it("'f2d-printing-time': the five lines of the F2D example", () => {
    const t = runReadTime(preset("f2d-printing-time").callers, preset("f2d-printing-time").build);
    expect(t.lines.map((l) => l.text)).toEqual(["a: 10", "b: [               10000]", "c: [10000]", "d: [   10 ns]", "e: 12 12.4"]);
  });

  it("a custom caller under timeunit only has tool-dependent %t until $timeformat is called", () => {
    const caller = customReadTimeCaller(scale(1, "ns"), scale(1, "ps"), ["#1.5"]);
    const t = runReadTime([caller], { timescalePrecisions: [] });
    expect(t.snapshots[0].readings.time).toBe(BigInt(2));
    expect(t.lines[0].toolDependent).toBe(true);
    const fixed = runReadTime([caller], { timescalePrecisions: [] }, { units: -12, precision: 0, suffix: " ps", minWidth: 0 });
    expect(fixed.lines[0].text).toContain("%t=1500 ps");
  });

  it("a caller whose unit, precision and %t units coincide still gets a real prediction, with or without a `timescale", () => {
    for (const build of [{ timescalePrecisions: [] }, { timescalePrecisions: [scale(1, "ns")] }]) {
      for (const delay of ["#3", "#0", "#(1'bx)", "#1.5"]) {
        const t = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ns"), [delay])], build);
        for (const snapshot of t.snapshots) {
          for (const arg of ["realtime", "time"] as const) {
            const options = readTimeOptions(runReadTime(withPercentTArg([customReadTimeCaller(scale(1, "ns"), scale(1, "ns"), [delay])], arg), build).snapshots[t.snapshots.indexOf(snapshot)], build);
            const where = `${delay}, ${build.timescalePrecisions.length} timescale, ${arg}`;
            expect(options.length, where).toBeGreaterThanOrEqual(2);
            expect(options.filter((o) => o.correct), where).toHaveLength(1);
            expect(new Set(options.map((o) => o.label)).size, where).toBe(options.length);
          }
        }
      }
    }
    const build = { timescalePrecisions: [scale(1, "ns")] };
    const t = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ns"), ["#3"])], build);
    const options = readTimeOptions(t.snapshots[0], build);
    expect(options.find((o) => o.correct)?.label).toBe(`$time=3 $stime=3 $realtime=3.000 %t=${"3".padStart(20)}`);
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(["unpadded-t", "tool-dependent", "ten-x"]));
  });

  it("every moment of every preset can be predicted", () => {
    for (const p of READ_TIME_PRESETS) {
      const t = runReadTime(p.callers, p.build);
      expect(t.snapshots.length, p.id).toBeGreaterThan(0);
      for (const snapshot of t.snapshots) {
        const options = readTimeOptions(snapshot, p.build);
        expect(options.length, p.id).toBeGreaterThanOrEqual(3);
        expect(options.filter((o) => o.correct), p.id).toHaveLength(1);
      }
    }
  });

  it("builds one correct option per snapshot with precision-unit and unrounded distractors", () => {
    const p = preset("make-it-work");
    const t = runReadTime(p.callers, p.build);
    const options = readTimeOptions(t.snapshots[1], p.build);
    expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual(["slow_gen $time=1 $realtime=1.30 %t=13.0 ns"]);
    expect(options.find((o) => o.id === "precision-units")?.label).toMatch(/\$time=13 /);
    expect(options.find((o) => o.id === "written-delay")?.label).toMatch(/\$realtime=1\.26 /);
  });
});

describe("sv-timescale-model: which unit applies (§3.14.2.1, §3.14.2.3, §3.12.1, §22.3)", () => {
  it("rule (b): with a.sv before b.sv in one compilation unit, b takes 1ns/1ps from a's `timescale", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "b", "c", "pkg", "nested"]), "one");
    const b = r.elements.find((e) => e.path === "b");
    expect(b).toMatchObject({ unit: scale(1, "ns"), precision: scale(1, "ps"), unitRule: "b" });
    expect(r.errors).toEqual([]);
    expect(whichUnitOptions(r).find((o) => o.correct)?.id).toBe("1ns");
  });

  it("compile order matters: with b.sv first, b falls to the implementation default and the design has mixed specification", () => {
    const r = resolveTimeScopes(filesInOrder(["b", "a", "c", "pkg", "nested"]), "one");
    const b = r.elements.find((e) => e.path === "b");
    expect(b).toMatchObject({ unit: null, precision: null, unitRule: "d" });
    expect(r.errors.map((e) => e.clause)).toContain("IEEE 1800-2023 §3.14.2.3");
    expect(r.errors[0].toolNote).toMatch(/some tools only warn/);
    expect(whichUnitOptions(r).find((o) => o.correct)?.id).toBe("default");
  });

  it("§3.12.1: with each file its own compilation unit, a's `timescale never reaches b", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "b", "c", "pkg", "nested"]), "each");
    expect(r.elements.find((e) => e.path === "b")?.unitRule).toBe("d");
    expect(r.compilationUnits).toHaveLength(5);
  });

  it("§22.3: a `resetall between a.sv and b.sv ends the `timescale", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "reset", "b", "c", "pkg", "nested"]), "one");
    expect(r.elements.find((e) => e.path === "b")?.unitRule).toBe("d");
    expect(r.elements.find((e) => e.path === "a")?.unitRule).toBe("b");
  });

  it("rule (c): a compilation-unit timeunit applies when no `timescale is in force, and loses to an earlier `timescale", () => {
    const viaCu = resolveTimeScopes(filesInOrder(["cu", "b", "a", "c", "pkg", "nested"]), "one");
    expect(viaCu.elements.find((e) => e.path === "b")).toMatchObject({ unit: scale(1, "us"), precision: scale(1, "ns"), unitRule: "c", precisionRule: "c" });
    expect(whichUnitOptions(viaCu).find((o) => o.correct)?.id).toBe("1us");
    const viaDirective = resolveTimeScopes(filesInOrder(["cu", "a", "b", "c", "pkg", "nested"]), "one");
    expect(viaDirective.elements.find((e) => e.path === "b")?.unitRule).toBe("b");
  });

  it("rule (a): a nested module inherits from the enclosing module; a declared timeunit is never leaked to another element", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "b", "c", "pkg", "nested"]), "one");
    expect(r.elements.find((e) => e.path === "outer.inner")).toMatchObject({ unit: scale(1, "ms"), precision: scale(1, "us"), unitRule: "a" });
    expect(r.elements.find((e) => e.path === "c")).toMatchObject({ unit: scale(100, "ps"), unitRule: "declared", precision: scale(1, "ps"), precisionRule: "b" });
    expect(whichUnitOptions(r).find((o) => o.id === "100ps")?.correct).toBe(false);
  });

  it("§3.14.2.2: a compilation-unit timeunit that is not the first item of its unit is reported", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "cu", "b"]), "one");
    expect(r.errors.some((e) => e.clause === "IEEE 1800-2023 §3.14.2.2")).toBe(true);
  });

  it("§3.14.3: the global precision is the minimum over declared precisions and the smallest `timescale precision", () => {
    const r = resolveTimeScopes(filesInOrder(["a", "b", "c", "pkg", "nested"]), "one");
    expect(r.globalPrecision).toEqual(scale(1, "ps"));
    const noDirective = resolveTimeScopes(filesInOrder(["nested"]), "one");
    expect(noDirective.globalPrecision).toEqual(scale(1, "us"));
    const nothing = resolveTimeScopes(filesInOrder(["b"]), "one");
    expect(nothing.globalPrecision).toBeNull();
  });
});

describe("sv-timescale-model: global precision and 1step (§3.14.3, §20.4.2, Table 20-3)", () => {
  it("the Make It Work bench reports $root as 100ps / 100ps, 1step = 100 ps and tool-dependent default %t units", () => {
    const r = globalPrecisionReport(false);
    expect(r.printtimescaleRoot).toBe("Time scale of ($root) is 100ps / 100ps");
    expect(r.oneStep).toBe("100 ps");
    expect(r.defaultPercentTUnits).toBeNull();
    expect(r.resolution.errors).toEqual([]);
  });

  it("one vendor model under `timescale 1ns/1fs makes everything 1 fs while each module's rounding is unchanged", () => {
    const r = globalPrecisionReport(true);
    expect(r.printtimescaleRoot).toBe("Time scale of ($root) is 1fs / 1fs");
    expect(r.oneStep).toBe("1 fs");
    expect(r.defaultPercentTUnits).toEqual(scale(1, "fs"));
    expect(r.moduleRounding.map((m) => `${m.name}:${m.wake}`)).toEqual(["slow_gen:13 ns", "tb_top:1.3 ns"]);
    expect(globalPrecisionReport(false).moduleRounding).toEqual(r.moduleRounding);
    expect(globalPrecisionOptions(true).find((o) => o.correct)?.id).toBe("1fs");
    expect(globalPrecisionOptions(false).find((o) => o.correct)?.id).toBe("100ps");
  });
});

describe("sv-timescale-model: values that cross a scope (§5.8, §6.12.1, §3.14)", () => {
  it("wait_t(5ns): 5ns becomes 5 in tb_top, #t reads 5 ps in util_pkg, the log says 0.005 ns", () => {
    const t = traceCrossScope("wait_t_5ns");
    expect(t.wakeFs).toBe(ps(5));
    expect(t.printed).toBe("expected 5 ns, woke at 0.005 ns");
    expect(t.steps.map((s) => s.unitTag)).toEqual(["1ns", null, "1ps", null]);
    expect(t.steps.map((s) => s.unitState)).toEqual(["tagged", "dropped", "tagged", "resolved-time"]);
    expect(t.steps[1].what).toContain("Only the number is passed: 5.0 meant 5ns because tb_top reads numbers in its 1ns unit, and that reading stays in tb_top.");
    expect(t.steps[1].what).not.toMatch(/unit tag/);
    expect(t.steps[1].lostTag).toBe("1ns");
  });

  it("wait_t(1.5ns): the real 1.5 rounds to 2 when passed to time (§6.12.1), so 2 ps", () => {
    const t = traceCrossScope("wait_t_1p5ns");
    expect(t.wakeFs).toBe(ps(2));
    expect(t.steps[1].value).toBe("2");
    expect(t.steps[1].why).toMatch(/§6\.12\.1/);
  });

  it("wait_ns(5) with #(delay_ns * 1ns): 1ns is converted inside the package to 1000, so 5000 ps = 5 ns", () => {
    const t = traceCrossScope("wait_ns_5");
    expect(t.wakeFs).toBe(ns(5));
    expect(t.printed).toBe("expected 5 ns, woke at 5.000 ns");
    // 1ns is a realtime value (§5.8) and a product with a real operand is real (§11.8.1): both keep the ".0" of a real.
    expect(t.steps[2].value).toBe("5000.0");
    expect(t.steps[2].what).toBe("#(delay_ns * 1ns): the literal 1ns is converted in util_pkg's 1ps unit to 1000.0, so the delay is 5.0 × 1000.0 = 5000.0 1ps units.");
    expect(crossScopeOptions("wait_ns_5").find((o) => o.correct)?.feedback).toBe("Right. 1ns is converted inside util_pkg to 1000.0 of its 1ps units (§5.8), so the task waits 5 ns.");
    // A callee unit coarser than 1ns keeps the exact fraction instead of a rounded ".0".
    const coarse = traceCrossScope("wait_ns_5", { ...CROSS_SCOPE_DEFAULT, calleeUnit: scale(100, "ns"), calleePrecision: scale(1, "ps") });
    expect(coarse.steps[2].what).toContain("to 0.01, so the delay is 5.0 × 0.01 = 0.05 100ns units");
    expect(t.steps.map((s) => s.unitState)).toEqual(["never-had", "never-had", "tagged", "resolved-time"]);
  });

  it("repeat (5) @(posedge clk) is unit-free", () => {
    const t = traceCrossScope("repeat_posedge");
    expect(t.unitFree).toBe(true);
    expect(t.wakeFs).toBe(ns(5));
    expect(t.steps[0].unitTag).toBe("clock edges");
    expect(t.steps.map((s) => s.unitState)).toEqual(["count", "resolved-time"]);
  });

  it("builds exactly one correct prediction option for every call form", () => {
    for (const form of ["wait_t_5ns", "wait_t_1p5ns", "wait_ns_5", "repeat_posedge"] as const) {
      const options = crossScopeOptions(form);
      expect(options.filter((o) => o.correct).map((o) => o.label), form).toHaveLength(1);
    }
    expect(crossScopeOptions("wait_t_5ns").find((o) => o.correct)?.label).toBe("5 ps");
    expect(crossScopeOptions("wait_t_1p5ns").find((o) => o.correct)?.label).toBe("2 ps");
  });

  it("grades the suspects by recomputing the wake time: #t is the culprit, $timeformat and tb_top's timeunit are decoys", () => {
    const suspects = gradeCrossScopeSuspects();
    const byId = Object.fromEntries(suspects.map((s) => [s.id, s]));
    expect(byId["hash-t"].verdict).toBe("culprit");
    expect(byId["hash-t"].evidence).toMatch(/wakes at 5 ns instead of 5 ps/);
    expect(byId.call.verdict).toBe("contributes");
    expect(byId["tb-timeunit"].verdict).toBe("decoy");
    expect(byId.timeformat.verdict).toBe("decoy");
    expect(byId.timeformat.evidence).toMatch(/still wakes at 5 ps/);
    for (const s of suspects) expect(CROSS_SCOPE_CODE.some((l) => l.key === s.lineKey), s.id).toBe(true);
  });

  it("grades the fixes by recomputing across caller units: the scaled wait_ns and a cycle count are robust, a project-wide timeunit is not", () => {
    const fixes = gradeCrossScopeFixes();
    const byId = Object.fromEntries(fixes.map((f) => [f.id, f]));
    expect(byId["wait-ns"]).toMatchObject({ correctHere: true, robust: true });
    expect(byId.cycles).toMatchObject({ correctHere: true, robust: true });
    expect(byId["project-timeunit"]).toMatchObject({ correctHere: true, robust: false });
    expect(byId["project-timeunit"].results.map((r) => r.wake)).toEqual(["5 ns", "5 us", "1 ns"]);
    expect(CROSS_SCOPE_DEFAULT.format).toEqual({ units: -9, precision: 3, suffix: " ns", minWidth: 0 });
  });
});

describe("two-modules axis", () => {
  const unitOf = (name: "ns" | "us" | "s") => scaleToFs(scale(1, name));

  it("keeps the lesson's 0-30 ns axis up to and including 30 ns", () => {
    for (const wake of [BigInt(0), ns(13), ns(26), ns(30)]) {
      const axis = axisForWakes(wake);
      expect(axis.endFs).toBe(ns(30));
      expect(axis.unit).toBe("ns");
      expect(axis.majorsFs).toEqual([0, 5, 10, 15, 20, 25, 30].map((n) => ns(n)));
    }
  });

  it("grows to the next 1, 2 or 5 × 10^k ns and changes to a coarser unit when the end reaches it", () => {
    const end = (wake: bigint) => axisForWakes(wake).endFs;
    expect(end(ns(31))).toBe(ns(50));
    expect(end(ns(51))).toBe(ns(100));
    expect(end(ns(100))).toBe(ns(100));
    expect(end(ns(101))).toBe(ns(200));
    expect(end(ns(1200))).toBe(ns(2000));
    expect(axisForWakes(ns(400)).unit).toBe("ns");
    expect(axisForWakes(ns(600)).unit).toBe("us");
    expect(axisForWakes(ns(1200)).unit).toBe("us");
  });

  it("every wake stays on the axis, the ticks are exact and they span the axis, even for 2^64 units", () => {
    const huge = BigInt("18446744073709551615") * unitOf("ns") * BigInt(30);
    for (const wake of [ns(31) + BigInt(1), ns(999), ns(1000), ns(1001), ps(30001), huge]) {
      const { endFs, majorsFs } = axisForWakes(wake);
      expect(wake <= endFs).toBe(true);
      expect(majorsFs[0]).toBe(BigInt(0));
      expect(majorsFs[majorsFs.length - 1]).toBe(endFs);
      for (let i = 1; i < majorsFs.length; i += 1) expect((majorsFs[i] - majorsFs[i - 1]) * BigInt(majorsFs.length - 1)).toBe(endFs);
    }
    expect(axisForWakes(huge).unit).toBe("s");
    expect(axisForWakes(huge).endFs % unitOf("s")).toBe(BigInt(0));
  });
});

describe("sv-timescale-model: nothing the learner reads first gives the answer away", () => {
  const mentions = (haystack: string, value: string) => new RegExp(`(?<![\\d.])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack);

  it("a rounding preset's label and source never name its result; the note does", () => {
    for (const p of ROUNDING_PRESETS) {
      const correct = roundingOptions(roundDelayText(p.delay, p.unit, p.precision)).find((o) => o.correct)?.label as string;
      expect(mentions(p.label, correct), p.id).toBe(false);
      expect(mentions(p.source, correct), p.id).toBe(false);
      expect(p.source, p.id).not.toBe(p.note);
    }
    expect(ROUNDING_PRESETS.map((p) => p.label).join("\n")).not.toMatch(/same slot|tool-dependent/);
  });

  it("each rounding preset's note names the model's own result, so a hand-written note cannot drift from it", () => {
    /** The number as a whole token: "2" does not match inside "0.21", and "13" does not match "130". */
    const names = (note: string, value: string) => new RegExp(`(?<![\\d.])${value.replace(/\./g, "\\.")}(?!\\d|\\.\\d)`).test(note);
    let checked = 0;
    for (const p of ROUNDING_PRESETS) {
      const r = roundDelayText(p.delay, p.unit, p.precision);
      if (r.input.kind === "xz" || r.input.kind === "negative") continue;
      expect(r.error, p.id).toBeNull();
      if (r.toolDependent) {
        // The tie preset: the note names each candidate's tick count under its rule.
        expect(r.tie, p.id).not.toBeNull();
        expect(names(p.note, (r.tie as { awayFromZero: bigint }).awayFromZero.toString()), `${p.id}: away`).toBe(true);
        expect(names(p.note, (r.tie as { toEven: bigint }).toEven.toString()), `${p.id}: even`).toBe(true);
      } else if (r.wakeFs === BigInt(0)) {
        expect(names(p.note, "0"), p.id).toBe(true);
      } else {
        // A nonzero wake is named with its unit, exactly as the lab writes it ("2.8 ns", "5000 ps").
        expect(p.note, p.id).toContain(wakeText(r));
        expect(names(p.note, wakeText(r).split(" ")[0]), p.id).toBe(true);
      }
      checked += 1;
    }
    expect(checked).toBe(ROUNDING_PRESETS.length - 2);
  });

  it("the 'same slot' distractor states no tie rule: it says only that the delay is more than half a tick", () => {
    const feedbackOf = (id: string) => {
      const p = ROUNDING_PRESETS.find((x) => x.id === id);
      return roundingOptions(roundDelayText(p?.delay as string, p?.unit as ReturnType<typeof scale>, p?.precision as ReturnType<typeof scale>)).find((o) => o.id === "same-slot")?.feedback;
    };
    expect(feedbackOf("table-2.5")).toBe("25 ns is more than half a 1ns tick, so rounding to the nearest tick (§22.7) cannot reach 0.");
    expect(feedbackOf("table-5ns")).toBe("5000 ps is more than half a 1ps tick, so rounding to the nearest tick (§22.7) cannot reach 0.");
    // Wherever it is offered, 0 is no candidate, including at #0.5 at 1ns/1ns, where half to even gives 0 and it is not offered.
    const inputs = ["#1.5", "#3", "#0.5", "#0.4", "#2.75", "#1.26", "#2.85", "#5ns", "#2.1ns", "#0.6", "#1"];
    const pairs = [
      [scale(1, "ns"), scale(1, "ns")],
      [scale(1, "ns"), scale(100, "ps")],
      [scale(10, "ns"), scale(1, "ns")],
      [scale(1, "ps"), scale(1, "ps")],
    ] as const;
    for (const d of inputs) {
      for (const [unit, precision] of pairs) {
        const r = roundDelayText(d, unit, precision);
        const option = roundingOptions(r).find((o) => o.id === "same-slot");
        if (!option) continue;
        expect(r.candidatesFs, `${d} at ${unit.magnitude}${unit.unit}`).not.toContain(BigInt(0));
        expect(option.feedback).not.toMatch(/below half|Only a delay/);
      }
    }
    expect(roundingOptions(roundDelayText("#0.5", scale(1, "ns"), scale(1, "ns"))).some((o) => o.id === "same-slot")).toBe(false);
  });

  it("a read-time preset's label and summary never contain a value it prints", () => {
    for (const p of READ_TIME_PRESETS) {
      const trace = runReadTime(p.callers, p.build, null);
      for (const snapshot of trace.snapshots) {
        const correct = readTimeOptions(snapshot, p.build).find((o) => o.correct)?.label as string;
        expect(`${p.label}\n${p.summary}`, p.id).not.toContain(correct);
        expect(mentions(`${p.label}\n${p.summary}`, formatFsAuto(snapshot.readings.absFs)), `${p.id}: ${formatFsAuto(snapshot.readings.absFs)}`).toBe(false);
      }
      expect(p.outcome.length, p.id).toBeGreaterThan(0);
    }
    const uvm = READ_TIME_PRESETS.find((p) => p.id === "uvm-stamp");
    expect(`${uvm?.label} ${uvm?.summary}`).not.toContain("15000");
    expect(uvm?.outcome).toContain("15000");
    expect(READ_TIME_PRESETS.find((p) => p.id === "20.3.1")?.outcome).toContain("2 then 3");
  });

  it("every option label is a value: no misconception suffix tells the wrong ones apart", () => {
    const inputs = ["#2.75", "#1.26", "#3", "#0.4", "#5ns", "#2.1ns", "#2.85", "#(1'bx)", "#(-1)"];
    const pairs = [
      [scale(1, "ns"), scale(100, "ps")],
      [scale(10, "ns"), scale(1, "ns")],
      [scale(1, "ns"), scale(1, "ns")],
      [scale(1, "ps"), scale(1, "ps")],
    ] as const;
    for (const d of inputs) {
      for (const [unit, precision] of pairs) {
        const r = roundDelayText(d, unit, precision);
        const labels = [...roundingOptions(r), ...wakeSequenceOptions(r, 2, { name: "other", unit: scale(100, "ns"), precision: scale(1, "ns") })].map((o) => o.label);
        for (const label of labels) expect(label, `${d} at ${formatScale(unit)}/${formatScale(precision)}`).not.toMatch(/: |precision step|as written|effectively/);
      }
    }
  });

  it("keeps the diagnosis in the feedback, under the option's id", () => {
    const options = roundingOptions(roundDelayText("#2.75", scale(1, "ns"), scale(100, "ps")));
    const byId = (id: string) => options.find((o) => o.id === id);
    expect(byId("unrounded")?.label).toBe("2.75 ns");
    expect(byId("unrounded")?.feedback).toMatch(/rounded to the element's precision/);
    expect(byId("truncated")?.label).toBe("2.7 ns");
    expect(byId("truncated")?.feedback).toMatch(/truncates/);
    expect(byId("precision-as-unit")?.label).toBe("0.275 ns");
    const xz = roundingOptions(roundDelayText("#(1'bx)", scale(1, "ns"), scale(100, "ps")));
    expect(xz.find((o) => o.correct)?.label).toBe("0 ns");
    expect(xz.find((o) => o.correct)?.feedback).toMatch(/same time slot/);
    const negative = roundingOptions(roundDelayText("#(-1)", scale(1, "ns"), scale(100, "ps")));
    expect(negative.find((o) => o.correct)?.label).toBe("2^64 − 1 units");
  });
});

describe("sv-timescale-model: the code of each call form", () => {
  const forms = Object.keys(CALL_FORM_TEXT) as (keyof typeof CALL_FORM_TEXT)[];
  const textOf = (form: keyof typeof CALL_FORM_TEXT, key: string) => crossScopeCode(form).find((l) => l.key === key)?.text ?? "";

  it("every step of every form names a line that exists in that form's code, and each key is unique", () => {
    for (const form of forms) {
      const keys = crossScopeCode(form).map((l) => l.key);
      expect(new Set(keys).size, form).toBe(keys.length);
      for (const step of traceCrossScope(form).steps) expect(keys, `${form}: ${step.title}`).toContain(step.lineKey);
    }
  });

  it("each form's call line is the call the form makes", () => {
    for (const form of forms) expect(textOf(form, "tb-call"), form).toContain(CALL_FORM_TEXT[form]);
  });

  it("wait_t(5ns) is the lesson's exact code", () => {
    expect(crossScopeCode("wait_t_5ns")).toBe(CROSS_SCOPE_CODE);
  });

  it("wait_ns swaps in the lesson's task, so the steps describe lines that run", () => {
    expect(textOf("wait_ns_5", "pkg-task")).toContain("task automatic wait_ns(realtime delay_ns);");
    expect(textOf("wait_ns_5", "pkg-delay")).toContain("#(delay_ns * 1ns);");
    expect(textOf("wait_ns_5", "pkg-delay")).not.toMatch(/5 ns|5000/);
  });

  it("the repeat form's clock, rounded by the model, is the clock the wake time assumes", () => {
    const code = crossScopeCode("repeat_posedge").map((l) => l.text).join("\n");
    expect(code).toContain("logic clk = 1;");
    expect(code).toContain("always #0.5ns clk = ~clk;");
    // The clock line through the model, in each caller unit the fix is graded in: a literal gives one period everywhere (§5.8).
    for (const [unit, precision] of [[scale(1, "ns"), scale(1, "ps")], [scale(1, "ps"), scale(1, "ps")], [scale(10, "ns"), scale(1, "ps")]] as const) {
      const config = { ...CROSS_SCOPE_DEFAULT, callerUnit: unit, callerPrecision: precision };
      const halfPeriod = roundDelayText("#0.5ns", unit, precision);
      expect(halfPeriod.wakeFs, formatScale(unit)).toBe(ps(500));
      expect(clockPeriodFs(config), formatScale(unit)).toBe(ns(1));
      // clk starts at 1, so its first rise is one full period in and the fifth is at five periods.
      expect(traceCrossScope("repeat_posedge", config).wakeFs, formatScale(unit)).toBe(ns(5));
    }
    // A bare #0.5 would follow tb_top's unit: 50 ns at 10ns/1ps, and an exact half tick with no single value at 1ps/1ps.
    expect(clockPeriodFs({ ...CROSS_SCOPE_DEFAULT, callerUnit: scale(10, "ns"), callerPrecision: scale(1, "ps") }, "#0.5") * BigInt(5)).toBe(ns(50));
    expect(roundDelayText("#0.5", scale(1, "ps"), scale(1, "ps")).toolDependent).toBe(true);
  });

  it("wait_t(1.5ns) expects 1.5 ns in its code, its print and its distractor", () => {
    expect(textOf("wait_t_1p5ns", "tb-display")).toContain("expected 1.5 ns");
    expect(traceCrossScope("wait_t_1p5ns").printed).toBe("expected 1.5 ns, woke at 0.002 ns");
    const options = crossScopeOptions("wait_t_1p5ns");
    expect(options.find((o) => o.id === "expected")).toMatchObject({ label: "1.5 ns", correct: false });
    expect(options.find((o) => o.id === "expected")?.feedback).toMatch(/intent/);
    expect(options.some((o) => o.label === "5 ns")).toBe(false);
  });
});

const pow2For32 = () => BigInt(4294967296);

describe("sv-timescale-model: the order of the options", () => {
  const files = (ids: string[]) => ids.map((id) => WHICH_UNIT_FILES.find((f) => f.id === id)).filter((f): f is (typeof WHICH_UNIT_FILES)[number] => Boolean(f));
  const correctSlot = (options: { id: string; label: string; correct: boolean }[], seed: string) => arrangeOptions(options, seed).findIndex((o) => o.correct);

  it("which-unit: the correct option moves with the compile order and grouping, though the labels never change", () => {
    const states: [string[], "one" | "each"][] = [
      [["a", "b", "c", "pkg", "nested"], "one"],
      [["a", "b", "c", "pkg", "nested"], "each"],
      [["b", "a", "c", "pkg", "nested"], "one"],
      [["a", "reset", "b", "c", "pkg", "nested"], "one"],
      [["cu", "b", "a", "c", "pkg", "nested"], "one"],
      [["a", "c", "b", "pkg", "nested"], "one"],
    ];
    const slots = states.map(([order, grouping]) => correctSlot(whichUnitOptions(resolveTimeScopes(files(order), grouping)), `0|${order.join(",")}|${grouping}`));
    expect(new Set(slots).size, slots.join(",")).toBeGreaterThanOrEqual(3);
  });

  it("the slot depends on which option is correct even without a seed", () => {
    const labels = ["w", "x", "y", "z"];
    const slots = labels.map((l) => correctSlot(labels.map((label) => ({ id: label, label, correct: label === l })), ""));
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it("global-precision: the correct option moves when the vendor model is added", () => {
    const seeds = ["0|false", "0|true"];
    expect(correctSlot(globalPrecisionOptions(false), seeds[0])).not.toBe(correctSlot(globalPrecisionOptions(true), seeds[1]));
  });

  it("is deterministic and keeps every option", () => {
    const options = globalPrecisionOptions(true);
    expect(arrangeOptions(options, "s")).toEqual(arrangeOptions(options, "s"));
    expect([...arrangeOptions(options, "s")].map((o) => o.id).sort()).toEqual(options.map((o) => o.id).sort());
  });
});

describe("sv-timescale-model: moments are the code's own prints", () => {
  const preset = (id: string) => READ_TIME_PRESETS.find((p) => p.id === id) as (typeof READ_TIME_PRESETS)[number];
  const formatAt = (units: number, precision: number, suffix: string, minWidth: number) => ({ units, precision, suffix, minWidth });

  it("every $display is one moment, and each option list's answer is the log's line", () => {
    for (const p of READ_TIME_PRESETS) {
      const t = runReadTime(p.callers, p.build);
      expect(t.snapshots.length, p.id).toBe(t.lines.length);
      t.lines.forEach((line, i) => {
        expect(line.momentIndex, p.id).toBe(i);
        expect(readTimeOptions(t.snapshots[i], p.build).find((o) => o.correct)?.label, p.id).toBe(line.text);
      });
    }
    expect(runReadTime(preset("f2d-printing-time").callers, preset("f2d-printing-time").build).snapshots).toHaveLength(5);
  });

  it("the generated code holds exactly the lines the moments point at", () => {
    for (const p of READ_TIME_PRESETS) {
      const t = runReadTime(p.callers, p.build);
      const code = readTimeCode(p.callers, p.build);
      expect(new Set(code.map((l) => l.key)).size, p.id).toBe(code.length);
      for (const s of t.snapshots) {
        expect(code.find((l) => l.key === s.lineKey)?.text.trim(), p.id).toBe(displayCode(s.template, s.args));
        expect(code.find((l) => l.key === s.delayKey)?.text.trim(), p.id).toBe(`#${s.afterDelay?.input.text.replace(/^#/, "")};`);
      }
    }
  });

  it("F2D's generated code matches the lesson's statements", () => {
    const p = preset("f2d-printing-time");
    expect(readTimeCode(p.callers, p.build).map((l) => l.text)).toEqual([
      "`timescale 1ns/1ps",
      "module tb_top;",
      "  initial begin",
      "    #10;",
      '    $display("a: %0d", $time);',
      '    $display("b: [%t]", $time);',
      '    $display("c: [%0t]", $time);',
      '    $timeformat(-9, 0, " ns", 8);',
      '    $display("d: [%t]", $time);',
      "    #2.4;",
      '    $display("e: %0d %.1f", $time, $realtime);',
      "  end",
      "endmodule",
    ]);
  });

  it("make-it-work's code declares timeunit in slow_gen and instantiates it in tb_top", () => {
    const p = preset("make-it-work");
    const text = readTimeCode(p.callers, p.build).map((l) => l.text);
    expect(text).toEqual(expect.arrayContaining(["module slow_gen;", "  timeunit 10ns; timeprecision 1ns;", "module tb_top;", "  timeunit 1ns; timeprecision 100ps;", "  slow_gen u_slow ();"]));
    expect(text.join("\n")).not.toContain("`timescale");
  });

  it("withPercentTArg changes only %t and %0t arguments", () => {
    const p = preset("f2d-printing-time");
    const t = runReadTime(withPercentTArg(p.callers, "realtime"), p.build);
    expect(t.snapshots.map((s) => s.args.map((a) => a.fn))).toEqual([["time"], ["realtime"], ["realtime"], ["realtime"], ["time", "realtime"]]);
    const make = preset("make-it-work");
    expect(runReadTime(withPercentTArg(make.callers, "time"), make.build).lines[2].text).toBe("slow_gen $time=3 $realtime=2.60 %t=30.0 ns");
  });

  it("knows which scripts use %t, and which set the format before their first print", () => {
    expect(READ_TIME_PRESETS.filter((p) => !usesPercentT(p.callers)).map((p) => p.id)).toEqual(["stime-wrap"]);
    expect(READ_TIME_PRESETS.filter((p) => setsFormatBeforeFirstPrint(p.callers, p.build)).map((p) => p.id)).toEqual(["make-it-work"]);
  });

  it("offers a padded %0t only under the Table 20-3 default width", () => {
    const uvm = preset("uvm-stamp");
    const defaults = readTimeOptions(runReadTime(uvm.callers, uvm.build).snapshots[0], uvm.build);
    expect(defaults.find((o) => o.id === "padded-t")?.label).toContain(`@ ${"15000".padStart(20)}:`);
    for (const format of [formatAt(-9, 3, " ns", 0), formatAt(-9, 3, " ns", 8)]) {
      const called = readTimeOptions(runReadTime(uvm.callers, uvm.build, format).snapshots[0], uvm.build);
      expect(called.map((o) => o.id), JSON.stringify(format)).not.toContain("padded-t");
      expect(called.find((o) => o.correct)?.label).toContain("@ 15.000 ns:");
    }
  });

  it("a plain %t under a width set by $timeformat is settled, so its padding can be asked about", () => {
    const f2d = preset("f2d-printing-time");
    const d = readTimeOptions(runReadTime(f2d.callers, f2d.build).snapshots[3], f2d.build);
    expect(d.find((o) => o.correct)?.label).toBe("d: [   10 ns]");
    expect(d.find((o) => o.id === "unpadded-t")?.label).toBe("d: [10 ns]");
    expect(d.find((o) => o.id === "default-width")?.label).toBe(`d: [${"10 ns".padStart(20)}]`);
    expect(d.find((o) => o.id === "format-ignored")?.label).toBe(`d: [${"10000".padStart(20)}]`);
  });

  it("no feedback or distractor claims a width that is not in force", () => {
    const make = preset("make-it-work");
    for (const s of runReadTime(make.callers, make.build).snapshots) {
      const options = readTimeOptions(s, make.build);
      expect(options.map((o) => o.id)).not.toContain("padded-t");
      expect(options.map((o) => o.id)).not.toContain("unpadded-t");
    }
  });

  it("stime-wrap: the lesson's 705,032,704 at 5 ms under 1ps/1ps, with $stime in every option", () => {
    const p = preset("stime-wrap");
    const t = runReadTime(p.callers, p.build);
    expect(t.lines.map((l) => l.text)).toEqual(["$time=5000000000 $stime=705032704"]);
    expect(BigInt(5000000000) % pow2For32()).toBe(BigInt(705032704));
    expect(t.snapshots[0].readings.stimeWrapped).toBe(true);
    const options = readTimeOptions(t.snapshots[0], p.build);
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(["model", "stime-unwrapped", "stime-saturated"]));
    for (const o of options) expect(o.label, o.id).toContain("$stime=");
    expect(options.find((o) => o.id === "stime-unwrapped")?.label).toBe("$time=5000000000 $stime=5000000000");
    expect(options.find((o) => o.id === "stime-saturated")?.label).toBe("$time=5000000000 $stime=4294967295");
  });

  it("explains each line from its own specifiers and the format in force", () => {
    const f2d = preset("f2d-printing-time");
    const t = runReadTime(f2d.callers, f2d.build);
    const e = t.snapshots.map((s) => explainLine(s, f2d.build));
    expect(e[1].what).toContain("padded to at least 20 characters");
    expect(e[1].why).toContain("Table 20-3");
    expect(e[2].what).toContain("the 0 drops the padding");
    expect(e[2].why).toContain("§21.2.1.2");
    expect(e[3].what).toContain('the suffix " ns", padded to at least 8 characters');
    expect(e[3].why).toContain("§20.4.3");
    expect(e[4].what).toContain("$time rounds 12.4 to 12");
    const noUnits = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ps"), ["#1"])], { timescalePrecisions: [] });
    expect(explainLine(noUnits.snapshots[0], { timescalePrecisions: [] }).why).toContain("tool-dependent");
  });

  it("reports an error once, however many delays hit it, and a tool-dependent half tick as a note", () => {
    const coarse = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(100, "ns"), ["#1", "#2", "#3"])], { timescalePrecisions: [] });
    expect(coarse.errors).toHaveLength(1);
    expect(coarse.notes).toEqual([]);
    const tie = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(100, "ps"), ["#2.85", "#2.85"])], { timescalePrecisions: [] });
    expect(tie.errors).toEqual([]);
    expect(tie.notes).toHaveLength(1);
    expect(tie.snapshots).toHaveLength(2);
  });
});

describe("sv-timescale-model: wording tied to the delay as written", () => {
  it("the two-modules feedback quotes a time literal with its unit", () => {
    const literal = wakeSequenceOptions(roundDelayText("#5ns", scale(10, "ns"), scale(1, "ns")), 1);
    expect(literal.find((o) => o.correct)?.feedback).toMatch(/^#5ns is 5 ns, already on a tick of the module's own 1ns precision, so no rounding is needed/);
    const plain = wakeSequenceOptions(roundDelayText("#1.26", scale(10, "ns"), scale(1, "ns")), 1);
    expect(plain.find((o) => o.correct)?.feedback).toMatch(/^#1\.26 is 12\.6 ns;/);
  });

  it("a repeated delay gets 'then every' only when that reads as a time", () => {
    const at = (d: string) => roundDelayText(d, scale(1, "ns"), scale(100, "ps"));
    expect(thenEveryText(at("#1.26"), 2)).toBe(", then every 1.3 ns more");
    expect(thenEveryText(at("#1.26"), 1)).toBe("");
    expect(thenEveryText(at("#(1'bx)"), 3)).toBe("");
    expect(thenEveryText(at("#(-1)"), 3)).toBe("");
    expect(thenEveryText(at("#0.04"), 2)).toBe("");
    expect(thenEveryText(at("#2.85"), 2)).toBe(", then the same delay again");
  });
});

describe("sv-timescale-model: the value's unit in words", () => {
  it("names the state at every step, and only the wait_t boundary drops a tag", () => {
    const steps = (form: "wait_t_5ns" | "wait_t_1p5ns" | "wait_ns_5" | "repeat_posedge") => traceCrossScope(form).steps;
    expect(steps("wait_t_5ns").map(unitChipText)).toEqual(["1ns", "not passed on", "1ps", "wake time"]);
    expect(steps("wait_ns_5").map(unitChipText)).toEqual(["plain number", "plain number", "1ps", "wake time"]);
    expect(steps("repeat_posedge").map(unitChipText)).toEqual(["clock edges", "wake time"]);
    expect(steps("wait_t_5ns").map(unitSentence)).toEqual(["value 5.0 understood in 1ns", "value 5; tb_top's 1ns reading is not passed on", "value 5 understood in 1ps", "wake time 5 ps"]);
    expect(steps("wait_ns_5").map(unitSentence)).toEqual(["plain number 5", "plain number 5.0", "value 5000.0 understood in 1ps", "wake time 5 ns"]);
    expect(steps("repeat_posedge").map(unitSentence)).toEqual(["5 clock edges", "wake time 5 ns"]);
    for (const form of ["wait_t_5ns", "wait_t_1p5ns", "wait_ns_5", "repeat_posedge"] as const) {
      for (const s of steps(form)) {
        expect(unitSentence(s), form).not.toContain("with no unit");
        expect(s.unitState === "dropped", form).toBe(s.scope === "boundary" && form.startsWith("wait_t"));
      }
    }
  });

  it("the suspect evidence for the call is computed: it follows the package's unit", () => {
    const call = (config?: Parameters<typeof gradeCrossScopeSuspects>[0]) => gradeCrossScopeSuspects(config).find((s) => s.id === "call")?.evidence;
    expect(call()).toContain("5ns there is 5000 units and wakes at 5 ns instead of 5 ps");
    expect(call({ ...CROSS_SCOPE_DEFAULT, calleeUnit: scale(100, "ps"), calleePrecision: scale(1, "ps") })).toContain("5ns there is 50 units and wakes at 5 ns instead of 500 ps");
  });

  it("the prediction feedback for wait_t(5ns) stops at the symptom; the other forms explain the mechanism", () => {
    for (const o of crossScopeOptions("wait_t_5ns")) expect(o.feedback, o.id).not.toMatch(/§3\.14|§5\.8|util_pkg|bare number|#t/);
    expect(crossScopeOptions("wait_t_1p5ns").find((o) => o.correct)?.feedback).toContain("§6.12.1");
    expect(crossScopeOptions("wait_ns_5").find((o) => o.correct)?.feedback).toContain("§5.8");
  });

  it("the comment that answers the hunt waits until the hunt is over; the lesson's code comes back whole", () => {
    expect(crossScopeCode("wait_t_5ns", true).find((l) => l.key === "pkg-delay")?.text).toBe("    #t;");
    expect(crossScopeCode("wait_t_5ns").find((l) => l.key === "pkg-delay")?.text).toContain("THIS package's time unit");
    expect(crossScopeCode("wait_t_5ns")).toBe(CROSS_SCOPE_CODE);
  });
});

describe("sv-timescale-model: the delay grammar (§9.4, A.6.5, A.2.2.3, A.8.7, §5.8)", () => {
  const reasonOf = (text: string) => {
    const parsed = parseDelay(text);
    return parsed.kind === "invalid" ? parsed.reason : `not invalid: ${parsed.kind}`;
  };

  it("a bare x or z is no unknown value: x and z digits exist only inside a based number, so it would name an identifier", () => {
    // The offered literal keeps the learner's intent: a bare z gets 1'bz, anything with an x gets 1'bx (both zero by §9.4.1).
    for (const [text, literal] of [
      ["x", "1'bx"],
      ["#x", "1'bx"],
      ["#(x)", "1'bx"],
      ["#(xz)", "1'bx"],
      ["(z)", "1'bz"],
      ["#(Z)", "1'bz"],
      ["#(zz)", "1'bz"],
    ] as const) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/^A bare [xXzZ]+ is not an unknown value\. x and z digits exist only inside a based number \(A\.8\.7\), so here it would name an identifier \(§5\.6\)\. Write #\(1'b[xz]\)\.$/);
      expect(reasonOf(text), text).toContain(`Write #(${literal}).`);
    }
  });

  it("a bare ? is no legal delay: it is a z_digit only inside a based number, and no simple identifier can contain it", () => {
    for (const text of ["?", "#?", "#(?)", "#(x?)", "#(z?x)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      // §5.6.1: an escaped identifier can hold any printable character, so the claim is about simple identifiers only.
      expect(reasonOf(text), text).toMatch(/^A bare [xXzZ?]+ is not a legal delay\. \? is a z_digit \(A\.8\.7\) only inside a based number, and no simple identifier can contain it \(§5\.6\)\. Write #\(1'bz\)\.$/);
      expect(reasonOf(text), text).not.toMatch(/name an identifier|no identifier/);
    }
  });

  it("a based number with only x or z digits is a zero delay; a malformed one is turned away without a verdict on the form", () => {
    for (const text of ["#(1'dx)", "#(1'sbx)", "#(8'hzz)", "#('Z)", "#(1'b?)", "#(4'bxz_x)"]) expect(parseDelay(text).kind, text).toBe("xz");
    // §5.7.1 asks only for a nonzero size (04 is one) and allows white space before the apostrophe and after the base ("5 'D 3", "'h 837FF").
    for (const text of ["#(04'bx)", "#('h x)", "#(1 'bx)", "#(16 'sd ?)", "#(0_8'hz)"]) expect(parseDelay(text).kind, text).toBe("xz");
    expect(reasonOf("#(5 'D 3)")).toMatch(/^#\(5 'D 3\) is a legal delay: an integer literal \(A\.8\.7\)/);
    // A size of 0 (§5.7.1), two x digits after a decimal base, no base letter, white space between the apostrophe and the
    // base letter (§5.7.1) or after the apostrophe of an unbased literal (A.8.7 footnote 53): not a literal of A.8.7.
    for (const text of ["#(0'bx)", "#(00'bx)", "#(1'dxx)", "#(1'x)", "#(1' bx)", "#(' x)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/^Write a delay as/);
    }
  });

  it("legal delays the lab does not compute say they are outside this lab, not that the grammar rejects them", () => {
    // A based number with known digits (A.8.7), and '0 or '1, in parentheses (A.6.5).
    for (const text of ["#(4'b1x0z)", "#(1'bx1)", "#(4'd5)", "#(4'b1x)", "#(8'hA_F)", "#('1)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/is a legal delay: an integer literal \(A\.8\.7\) in parentheses \(A\.6\.5\).*outside this lab/);
    }
    // A real in scientific notation is a delay_value (A.2.2.3, A.8.7); its plain form is offered when the exponent is small.
    expect(reasonOf("#1e3")).toBe("1e3 is a real number in scientific notation, a legal delay_value (A.2.2.3, A.8.7), but this lab reads only plain decimals, so it is outside this lab. Write it as #1000 instead.");
    expect(reasonOf("#1.5e-3")).toMatch(/legal delay_value.*outside this lab\. Write it as #0\.0015 instead\.$/);
    expect(reasonOf("#2E+2")).toMatch(/Write it as #200 instead\.$/);
    expect(reasonOf("#1e99999999999")).toMatch(/Write it as a plain decimal instead\.$/);
    expect(reasonOf("#1step")).toMatch(/^1step is in the delay_value grammar \(A\.2\.2\.3\).*global precision \(§3\.14\.3\).*outside this lab/);
    // A name may be a parameter: legal, but the lab has no declaration for it.
    for (const text of ["#abc", "#(delay)", "_1"]) expect(reasonOf(text), text).toMatch(/^If \S+ names a parameter or a variable, it is a legal delay \(A\.2\.2\.3, A\.6\.5\), but this lab has no declaration for it, so it is outside this lab\./);
    for (const text of ["#1e3", "#(4'd5)", "#abc", "#1step"]) expect(reasonOf(text), text).not.toMatch(/cannot|not accept|needs parentheses/);
  });

  it("names and 1step are read as typed: §5.7.1 ignores underscores only in numbers, never in a name (§5.6)", () => {
    expect(reasonOf("#(d1_ns)")).toMatch(/^If d1_ns names a parameter or a variable, it is a legal delay/);
    expect(reasonOf("#(d1_ns)")).not.toContain("d1ns");
    expect(reasonOf("#d_1_0")).toMatch(/^If d_1_0 names a parameter/);
    // 1_step is not 1step: it is neither a delay_value nor a name, so it gets the list of forms without a verdict.
    expect(reasonOf("#1_step")).toBe("Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(1'bx) or #(-1): the forms this lab computes.");
    // A number still drops its underscores, and the reason echoes it as typed.
    expect(reasonOf("#1_0e3")).toMatch(/^1_0e3 is a real number in scientific notation.*Write it as #10000 instead\.$/);
    expect(reasonOf("#(8'hA_F)")).toMatch(/^#\(8'hA_F\) is a legal delay/);
  });

  it("1step is a delay_value only, not a primary (A.8.4), so #(1step) is no legal delay and is not called one", () => {
    const reason = reasonOf("#(1step)");
    expect(reason).toBe(
      "1step takes no parentheses: it appears in the grammar only as a delay_value (A.2.2.3), and it is not a primary (A.8.4), so no parenthesised expression can hold it. #1step is legal, but a step equals the global precision (§3.14.3), which depends on the whole design, so it is outside this lab.",
    );
    expect(reason).not.toMatch(/^1step is in the delay_value grammar/);
    expect(reasonOf("( 1step )")).toBe(reason);
  });

  it("a time literal has no space before its unit (§5.8)", () => {
    for (const text of ["#5 ns", "2.1 ns", "#2.1 ns", "#(5 ns)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/no space before its unit \(§5\.8\)/);
    }
    expect(parseDelay("#5ns").kind).toBe("literal");
  });

  it("a minus, a based value or an unbased one needs parentheses: delay_value has none of them", () => {
    // Any text that starts with a minus and has no parentheses: delay_value has no unary minus (A.2.2.3), and the
    // other delay_control form starts with a parenthesis (A.6.5). The fix echoes the text as typed.
    for (const [text, fix] of [
      ["-1", "#(-1)"],
      ["#-1", "#(-1)"],
      ["#- 1", "#(- 1)"],
      ["-5", "#(-5)"],
      ["#-5", "#(-5)"],
      ["-1ns", "#(-1ns)"],
      ["#-2ns", "#(-2ns)"],
      ["-1.5", "#(-1.5)"],
      ["#-1.5", "#(-1.5)"],
      ["#-a", "#(-a)"],
      ["#-1'bx", "#(-1'bx)"],
      ["#-'x", "#(-'x)"],
      ["#-1_000", "#(-1_000)"],
    ] as const) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toBe(`A delay_value has no unary minus (A.2.2.3), so a delay written with one needs parentheses (§9.4, A.6.5): write ${fix}.`);
      expect(reasonOf(text), text).not.toMatch(/outside this lab/);
    }
    // When the operand is not one primary the lab can name, parentheses alone would not make it legal: no fix is offered.
    for (const text of ["#-1)", "#-1step", "#--1", "#-5 ns"]) {
      expect(reasonOf(text), text).toBe("A delay_value has no unary minus (A.2.2.3), so a delay written with one needs parentheses (§9.4, A.6.5).");
    }
    for (const text of ["1'bz", "#1'bz", "4'bx", "#4'bx", "#4'd5", "#1 'bx"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/cannot be a based literal \(A\.2\.2\.3\), so this one needs parentheses \(§9\.4, A\.6\.5\)/);
    }
    expect(reasonOf("#1 'bx")).toMatch(/write #\(1 'bx\)\.$/);
    // '0, '1, 'x and 'z have an apostrophe but no base specifier (§5.7.1): they are unbased unsized literals, not based ones.
    for (const text of ["'x", "#'z", "#'1", "'0", "#'X"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/^A delay_value cannot be an unbased unsized literal \(§5\.7\.1; not in A\.2\.2\.3\), so this one needs parentheses \(§9\.4, A\.6\.5\): write #\('[01xXzZ]\)\.$/);
      expect(reasonOf(text), text).not.toMatch(/based literal \(A\.2\.2\.3\)/);
    }
    expect(parseDelay("#(-1)").kind).toBe("negative");
    expect(parseDelay("#(- 1)").kind).toBe("negative");
    expect(parseDelay("#(1'bz)").kind).toBe("xz");
  });

  it("an underscore may only follow a digit, because unsigned_number starts with one", () => {
    for (const text of ["_1", "#_1", "#(_1)", "1._5"]) expect(parseDelay(text).kind, text).toBe("invalid");
    expect(parseDelay("1_000.5")).toMatchObject({ kind: "number", digits: BigInt(10005), den: BigInt(10) });
    expect(parseDelay("1.0_5")).toMatchObject({ kind: "number", digits: BigInt(105), den: BigInt(100) });
    expect(parseDelay("1_0ns")).toMatchObject({ kind: "literal", digits: BigInt(10), literalUnit: "ns" });
  });

  it("a negative delay stays in the range of a 64-bit two's-complement value, so a result is never negative or zero", () => {
    for (const text of ["#(-99999999999999999999)", "#(-18446744073709551616)", "#(-18446744073709551615)", "#(-9223372036854775809)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toMatch(/does not fit a 64-bit/);
    }
    const lowest = parseDelay("#(-9223372036854775808)");
    expect(lowest).toMatchObject({ kind: "negative", asUnsigned: BigInt("9223372036854775808") });
    expect(parseDelay("#(-0)")).toMatchObject({ kind: "number", digits: BigInt(0) });
  });

  it("a positive delay stays within what a 64-bit time variable counts, whether written as a number or a literal", () => {
    expect(parseDelay("#18446744073709551615").kind).toBe("number");
    expect(reasonOf("#18446744073709551616")).toMatch(/2\^64 time units/);
    expect(roundDelayText("#99999999s", scale(1, "fs"), scale(1, "fs")).error).toMatch(/2\^64 time units/);
    expect(roundDelayText("#99999999s", scale(1, "ns"), scale(1, "fs")).error).toBeNull();
  });

  it("the reason for a negative real or literal names what is outside the lab and does not narrow §9.4.1 to integers", () => {
    for (const text of ["#(-1ns)", "#(-1.5)", "(-0.5ns)", "#( - 2.25 )"]) {
      expect(reasonOf(text), text).toMatch(/^A negative real or time-literal delay is outside this lab/);
      expect(reasonOf(text), text).toMatch(/evaluates to a negative value/);
      expect(reasonOf(text), text).not.toMatch(/with a fraction|negative integer/);
    }
    expect(reasonOf("#(2+3)")).toBe("Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(1'bx) or #(-1): the forms this lab computes.");
    expect(reasonOf("#2.")).toBe("Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(1'bx) or #(-1): the forms this lab computes.");
  });

  it("a parenthesised minus is called negative only for a real or a time literal with a nonzero value", () => {
    const neutral = "Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(1'bx) or #(-1): the forms this lab computes.";
    // -1'bx and -'x are x (§11.4.3), which §9.4.1 makes zero; -a and -(1) are neither a real nor a time literal; -0.0 and -0ns are not negative.
    for (const text of ["#(-1'bx)", "#(-'x)", "#(-a)", "#(-(1))", "#(-0.0)", "#(-0ns)", "#(-1e3)"]) {
      expect(parseDelay(text).kind, text).toBe("invalid");
      expect(reasonOf(text), text).toBe(neutral);
    }
  });

  it("the x/z preset writes a form that compiles, and its 'compile error' distractor can honestly say so", () => {
    const p = ROUNDING_PRESETS.find((x) => x.id === "xz");
    expect(p?.delay).toBe("#(1'bx)");
    expect(p?.label).toContain("#(1'bx)");
    const r = roundDelayText(p?.delay as string, scale(1, "ns"), scale(100, "ps"));
    expect(r.steps[0]).toMatch(/evaluates to x or z/);
    expect(roundingOptions(r).find((o) => o.id === "error")?.feedback).toMatch(/§9\.4\.1/);
  });
});

describe("sv-timescale-model: what the feedback says about rounding", () => {
  const options = (d: string, unit: ReturnType<typeof scale>, precision: ReturnType<typeof scale>) => roundingOptions(roundDelayText(d, unit, precision));
  const correct = (d: string, unit: ReturnType<typeof scale>, precision: ReturnType<typeof scale>) => options(d, unit, precision).find((o) => o.correct)?.feedback ?? "";

  it("a time literal is the same value before rounding, not the same wake time, in every module", () => {
    const feedback = options("#2.1ns", scale(10, "ns"), scale(1, "ns")).find((o) => o.id === "unit-ignored")?.feedback;
    expect(feedback).toContain("is the same value before rounding in every module; each module's own precision then rounds it (§3.14.1)");
    expect(feedback).not.toContain("means the same time");
    // The module's own answer and the other module's differ, which the old sentence denied.
    expect(wakeText(roundDelayText("#2.1ns", scale(10, "ns"), scale(1, "ns")))).toBe("2 ns");
    expect(wakeText(roundDelayText("#2.1ns", scale(1, "ns"), scale(100, "ps")))).toBe("2.1 ns");
  });

  it("the correct option writes value × unit, and says 'is rounded' only when something is", () => {
    expect(correct("#2.75", scale(1, "ns"), scale(100, "ps"))).toBe("2.75 × 1ns is rounded to the element's own 100ps precision (§3.14.1).");
    expect(correct("#2.1ns", scale(10, "ns"), scale(1, "ns"))).toBe("2.1ns = 0.21 × 10ns is rounded to the element's own 1ns precision (§3.14.1).");
    expect(correct("#2.5", scale(10, "ns"), scale(1, "ns"))).toBe("2.5 × 10ns is 25 ns, already on a tick of the 1ns precision, so no rounding is needed (§3.14.1).");
    expect(correct("#5ns", scale(1, "ps"), scale(1, "ps"))).toBe("5ns = 5000 × 1ps is 5000 ps, already on a tick of the 1ps precision, so no rounding is needed (§3.14.1).");
  });

  it("§3.14.1 is cited for the rounding to 0 only; the same slot is stated apart from it", () => {
    const feedback = correct("#0.4", scale(1, "ns"), scale(1, "ns"));
    expect(feedback).toBe("0.4 × 1ns rounds to 0 at the 1ns precision (§3.14.1). With no time left to wait, the statement runs in the same time slot.");
    expect(correct("#0", scale(1, "ns"), scale(1, "ns"))).not.toContain("§3.14.1");
    const steps = roundDelayText("#0.4", scale(1, "ns"), scale(1, "ns")).steps.join(" ");
    expect(steps).toContain("Wake at 0 (§3.14.1). With no time left to wait, the statement runs in the same time slot.");
    expect(steps).not.toMatch(/same time slot \(§3\.14\.1\)/);
  });

  it("agreement between tie rules is claimed only for the two rules the lab computes", () => {
    const steps = roundDelayText("#2.75", scale(1, "ns"), scale(100, "ps")).steps.join(" ");
    expect(steps).toContain("both rules this lab computes agree");
    expect(steps).not.toContain("every common tie rule");
  });

  it("the unit explanations are not applied to a time literal", () => {
    const contrast = { name: "u_slow", unit: scale(10, "ns"), precision: scale(1, "ns") };
    const literal = wakeSequenceOptions(roundDelayText("#2.1ns", scale(1, "ns"), scale(100, "ps")), 2, contrast).find((o) => o.id === "other-module");
    expect(literal?.label).toBe("2 ns, then 4 ns");
    expect(literal?.feedback).toBe("Only this module's own 100ps precision rounds the delay it runs (§3.14.1). A time literal is the same value before rounding in every module (§5.8); the other module's settings play no part here.");
    expect(literal?.feedback).not.toContain("unit sets the size");
    const number = wakeSequenceOptions(roundDelayText("#1.26", scale(1, "ns"), scale(100, "ps")), 1, contrast);
    expect(number.find((o) => o.id === "other-module")?.feedback).toBe(
      "Only this module's own unit and precision decide its wake time: the 1ns unit sets the size of the delay and the 100ps precision rounds it (§3.14, §3.14.1). The other module's settings play no part here.",
    );
    const tenX = (d: string) => options(d, scale(1, "ns"), scale(1, "ns")).find((o) => o.id === "ten-x")?.feedback;
    expect(tenX("#5ns")).toMatch(/^A time literal is converted to the current unit once \(§5\.8\)/);
    expect(tenX("#3")).toMatch(/^The 1ns unit scales the number once/);
  });

  it("a negative delay lists its first wake only: a second copy would pass 64 bits of time", () => {
    const negative = roundDelayText("#(-1)", scale(1, "ns"), scale(100, "ps"));
    expect(repeatedWakes(negative, 3).map((w) => w.k)).toEqual([1]);
    expect(repeatedWakes(roundDelayText("#(1'bx)", scale(1, "ns"), scale(100, "ps")), 2).map((w) => w.candidatesFs[0])).toEqual([BigInt(0), BigInt(0)]);
  });
});

describe("sv-timescale-model: source that cannot run has no moments", () => {
  const noBuild = { timescalePrecisions: [] };

  it("a delay with an error stops the run: no snapshot and no log, even for lines that would print", () => {
    const coarse = runReadTime([customReadTimeCaller(scale(1, "ps"), scale(1, "ns"), ["#1", "#2"])], noBuild);
    expect(coarse.errors).toHaveLength(1);
    expect(coarse.errors[0]).toMatch(/§3\.14/);
    expect(coarse.snapshots).toEqual([]);
    expect(coarse.lines).toEqual([]);
    const typed = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ps"), ["abc", "#2"])], noBuild);
    expect(typed.errors).toHaveLength(1);
    expect(typed.snapshots).toEqual([]);
    expect(typed.lines).toEqual([]);
  });

  it("a run that passes 64 bits of time is an error: the sources give no rule for it", () => {
    const once = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ps"), ["#(-1)"])], noBuild);
    expect(once.errors).toEqual([]);
    expect(once.snapshots[0].readings.time.toString()).toBe("18446744073709551615");
    const twice = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ps"), ["#(-1)", "#(-1)"])], noBuild);
    expect(twice.errors[0]).toMatch(/passes the 64 bits/);
    expect(twice.snapshots).toEqual([]);
  });

  it("a half-tick note belongs to the moments it affects, so it can wait for their reveal", () => {
    const t = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(100, "ps"), ["#1", "#2.85", "#1"])], noBuild);
    expect(t.notes).toHaveLength(1);
    expect(t.snapshots.map((s) => s.notes.length)).toEqual([0, 1, 1]);
    expect(t.snapshots[1].notes[0]).toMatch(/#2\.85 sits on a tool-dependent half tick/);
  });

  it("only the specifiers the lab prints are filled: a plain %d, which §21.2.1.2 sizes from the expression, is not one of them", () => {
    const readings = readTime(ns(10), scale(1, "ns"));
    expect(renderDisplay("%d", [{ fn: "time", spec: "%0d" }], readings, scale(1, "ns"), null, noBuild).text).toBe("%d");
    expect(renderDisplay("%0d", [{ fn: "time", spec: "%0d" }], readings, scale(1, "ns"), null, noBuild).text).toBe("10");
  });

  it("explanations count the decimals in the right number", () => {
    const p = READ_TIME_PRESETS.find((x) => x.id === "make-it-work") as (typeof READ_TIME_PRESETS)[number];
    const what = explainLine(runReadTime(p.callers, p.build).snapshots[0], p.build).what;
    expect(what).toContain("with 1 decimal,");
    expect(what).not.toContain("1 decimals");
    const f2d = READ_TIME_PRESETS.find((x) => x.id === "f2d-printing-time") as (typeof READ_TIME_PRESETS)[number];
    expect(explainLine(runReadTime(f2d.callers, f2d.build).snapshots[1], f2d.build).what).toContain("with 0 decimals");
  });
});

describe("sv-timescale-model: a preset's prose describes its own code", () => {
  const preset = (id: string) => READ_TIME_PRESETS.find((p) => p.id === id) as (typeof READ_TIME_PRESETS)[number];
  const called = { units: -9, precision: 3, suffix: " ns", minWidth: 0 };

  it("names what changed, and nothing while nothing has", () => {
    const uvm = preset("uvm-stamp");
    expect(presetChangeText(uvm, "realtime", null)).toBeNull();
    expect(presetChangeText(uvm, "realtime", called)).toContain('$timeformat(-9, 3, " ns", 0); now runs first');
    expect(presetChangeText(preset("make-it-work"), "time", null)).toContain("every %t now reads $time instead of $realtime");
    expect(presetChangeText(preset("20.3.1"), "time", called)).toMatch(/\$time instead of \$realtime, and \$timeformat/);
  });

  it("counts the log lines that moved away from the preset's own", () => {
    const make = preset("make-it-work");
    const asTime = runReadTime(withPercentTArg(make.callers, "time"), make.build);
    expect(asTime.lines.map((l) => l.text.split("%t=")[1])).toEqual(["1.0 ns", "10.0 ns", "30.0 ns"]);
    expect(linesChangedFromPreset(make, asTime.lines)).toBe(3);
    const f2d = preset("f2d-printing-time");
    // Lines b and c: line d follows the code's own $timeformat either way.
    expect(linesChangedFromPreset(f2d, runReadTime(f2d.callers, f2d.build, called).lines)).toBe(2);
    expect(linesChangedFromPreset(f2d, runReadTime(f2d.callers, f2d.build).lines)).toBe(0);
  });

  it("the %t argument matters only where the two texts differ", () => {
    const matters = READ_TIME_PRESETS.filter((p) => percentTArgMatters(p.callers, p.build)).map((p) => p.id);
    expect(matters).toEqual(["20.3.1", "make-it-work"]);
    expect(percentTArgMatters(preset("uvm-stamp").callers, preset("uvm-stamp").build, called)).toBe(false);
    expect(percentTArgMatters([customReadTimeCaller(scale(10, "ns"), scale(1, "ns"), ["#1.55"])], { timescalePrecisions: [] })).toBe(false);
    expect(percentTArgMatters([customReadTimeCaller(scale(10, "ns"), scale(1, "ns"), ["#1.55"])], { timescalePrecisions: [] }, called)).toBe(true);
  });

  it("finds the %t padding and leaves other spaces alone", () => {
    expect(splitPadding(`b: [${"10000".padStart(20)}]`, "b: [%t]")).toEqual([
      { text: "b: [", padding: 0 },
      { text: "", padding: 15 },
      { text: "10000]", padding: 0 },
    ]);
    expect(splitPadding("b: [10000]", "b: [%t]")).toEqual([{ text: "b: [10000]", padding: 0 }]);
    // The template's own space before %0t is text, and only the rest of the run is padding.
    expect(splitPadding(`@ ${"15000".padStart(20)}:`, "@ %0t:")).toEqual([
      { text: "@ ", padding: 0 },
      { text: "", padding: 15 },
      { text: "15000:", padding: 0 },
    ]);
    expect(splitPadding("@ 15000:", "@ %0t:")).toEqual([{ text: "@ 15000:", padding: 0 }]);
    // Alignment in the template and spaces between values are not padding.
    expect(splitPadding("tb_top   $time=1 $realtime=1.30 %t=1.3 ns", "tb_top   $time=%0d $realtime=%.2f %%t=%t").every((p) => p.padding === 0)).toBe(true);
    expect(splitPadding("e: 12 12.4", "e: %0d %.1f")).toEqual([{ text: "e: 12 12.4", padding: 0 }]);
  });
});

describe("sv-timescale-model: which unit applies, the cases the lab can and cannot reach", () => {
  const cu = WHICH_UNIT_FILES.find((f) => f.id === "cu") as SourceFile;
  const cuAgain: SourceFile = { ...cu, id: "cu2", label: "cu2.sv" };
  const cuDifferent = (unit: ReturnType<typeof scale>, precision?: ReturnType<typeof scale>): SourceFile => ({ id: "cu3", label: "cu3.sv", code: [], items: [{ kind: "cu-timeunit", unit, precision }] });
  const clause = "IEEE 1800-2023 §3.14.2.2";

  it("§3.14.2.2: a repeated compilation-unit timeunit is legal when it matches and an error when it does not", () => {
    expect(resolveTimeScopes([cu, cuAgain], "one").errors).toEqual([]);
    // A matching repeat may come later: it is not a first declaration after other items.
    expect(resolveTimeScopes([cu, ...filesInOrder(["b"]), cuAgain], "one").errors).toEqual([]);
    const different = resolveTimeScopes([cu, cuDifferent(scale(1, "ms"), scale(1, "ns"))], "one").errors;
    expect(different).toHaveLength(1);
    expect(different[0].clause).toBe(clause);
    expect(different[0].message).toMatch(/does not match the first/);
    expect(resolveTimeScopes([cu, cuDifferent(scale(1, "us"), scale(1, "ps"))], "one").errors[0].message).toMatch(/does not match the first/);
    expect(resolveTimeScopes([cu, cuDifferent(scale(1, "us"))], "one").errors).toEqual([]);
  });

  it("§3.14.2.2: only a description comes before the timeunit: a directive does not count as an item", () => {
    expect(resolveTimeScopes(filesInOrder(["reset", "cu", "b"]), "one").errors).toEqual([]);
    expect(resolveTimeScopes(filesInOrder(["reset", "cu", "b"]), "one").elements.find((e) => e.path === "b")?.unitRule).toBe("c");
    const late = resolveTimeScopes(filesInOrder(["a", "cu", "b"]), "one").errors.find((e) => e.clause === clause);
    expect(late?.message).toMatch(/comes after other items/);
    expect(late?.toolNote).toBe("an error per the standard");
  });

  it("names the timeunit's second argument as the source of a precision (§3.14.3 lists it apart from timeprecision)", () => {
    const r = resolveTimeScopes(filesInOrder(["nested"]), "one");
    expect(r.elements.find((e) => e.path === "outer")?.precisionSource).toBe("timeunit 1ms / 1us in outer");
    expect(r.globalPrecisionSources).toEqual(["timeunit 1ms / 1us in outer"]);
    expect(r.elements.find((e) => e.path === "outer.inner")?.precisionRule).toBe("a");
    const declared = resolveTimeScopes(globalPrecisionDesign(false), "one");
    expect(declared.elements.find((e) => e.path === "tb_top")?.precisionSource).toBe("timeprecision 100ps in tb_top");
  });

  it("[cu, c, a, ...]: c's declared unit meets the compilation unit's coarser precision, an error by §3.14", () => {
    const r = resolveTimeScopes(filesInOrder(["cu", "c", "a", "b", "pkg", "nested"]), "one");
    expect(r.elements.find((e) => e.path === "c")).toMatchObject({ unit: scale(100, "ps"), precision: scale(1, "ns"), unitRule: "declared", precisionRule: "c" });
    expect(r.errors.find((e) => e.clause === "IEEE 1800-2023 §3.14")?.message).toMatch(/^c: precision 1ns is coarser than unit 100ps/);
  });

  it("[c, a, ...]: a declared unit with rule (d) precision counts as unspecified in the mixed-specification error", () => {
    const r = resolveTimeScopes(filesInOrder(["c", "a", "b", "pkg", "nested"]), "one");
    expect(r.elements.find((e) => e.path === "c")).toMatchObject({ unit: scale(100, "ps"), precision: null, precisionRule: "d", specified: false });
    expect(r.errors.find((e) => e.clause === "IEEE 1800-2023 §3.14.2.3")?.message).toMatch(/while c does not/);
  });

  it("rule (c) does not cross compilation units: with each file its own, b takes rule (d)", () => {
    const r = resolveTimeScopes(filesInOrder(["cu", "b", "a", "c", "pkg", "nested"]), "each");
    expect(r.elements.find((e) => e.path === "b")).toMatchObject({ unit: null, unitRule: "d" });
    expect(whichUnitOptions(r).find((o) => o.correct)?.id).toBe("default");
  });

  it("[cu, a, reset, b]: after a `resetall the compilation-unit timeunit still decides, by rule (c)", () => {
    const r = resolveTimeScopes(filesInOrder(["cu", "a", "reset", "b", "c", "pkg", "nested"]), "one");
    expect(r.elements.find((e) => e.path === "b")).toMatchObject({ unit: scale(1, "us"), precision: scale(1, "ns"), unitRule: "c" });
    expect(whichUnitOptions(r).find((o) => o.correct)?.id).toBe("1us");
  });
});

describe("sv-timescale-model: the global-precision lab's design", () => {
  it("tb_top instantiates the vendor model, so it is in the design under any choice of top; the bench's code comes from the data", () => {
    expect(globalPrecisionDesign(false)[0].code).toEqual(["module slow_gen;", "  timeunit 10ns; timeprecision 1ns;", "endmodule", "module tb_top;", "  timeunit 1ns; timeprecision 100ps;", "  slow_gen u_slow ();", "endmodule"]);
    expect(globalPrecisionDesign(true)[0].code).toContain("  vendor_model u_vendor ();");
    expect(globalPrecisionDesign(true)[1].code).toEqual(["`timescale 1ns/1fs", "module vendor_model; endmodule"]);
    expect(twoModulesGlobalPrecision()).toEqual(scale(100, "ps"));
  });

  it("the headline feedback describes this design: vendor_model takes the directive, the other two declare their own", () => {
    const feedback = globalPrecisionOptions(true).find((o) => o.correct)?.feedback;
    expect(feedback).toContain("whether or not other modules use that directive (§3.14.3)");
    expect(feedback).toContain("slow_gen and tb_top declare their own, and only vendor_model takes it");
    expect(feedback).not.toContain("every module overrides");
    const r = globalPrecisionReport(true).resolution.elements.find((e) => e.path === "vendor_model");
    expect(r).toMatchObject({ unitRule: "b", precisionRule: "b" });
  });

  it("the default %t units move from undefined to 1 fs, and only `timescale directives count (Table 20-3)", () => {
    const before = defaultUnitsOptions(false);
    expect(before.filter((o) => o.correct).map((o) => o.id)).toEqual(["undefined"]);
    expect(before.find((o) => o.correct)?.feedback).toContain("does not define this case");
    const after = defaultUnitsOptions(true);
    expect(after.filter((o) => o.correct).map((o) => o.label)).toEqual(["1fs"]);
    expect(after.find((o) => o.id === "timeprecision")?.feedback).toContain("Table 20-3 looks only at the precision arguments of `timescale directives");
  });
});

describe("sv-timescale-model: the reasons of the cross-scope trace", () => {
  const byId = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((x) => [x.id, x]));

  it("every step of wait_t and wait_ns cites the rule that moves the value", () => {
    const five = traceCrossScope("wait_t_5ns").steps;
    expect(five[0].why).toContain("§5.8");
    expect(five[1].why).toBe(
      "Passing a value to a subroutine argument is an assignment-like context (§10.8), so the real 5.0 becomes the integer 5 of the time argument, an integer type (§6.11, §6.12.1). Nothing rescales a number for the new scope's unit, and a realtime argument would pass a plain 5.0 just the same: a real carries no unit (§6.12).",
    );
    expect(five[1].why).not.toMatch(/Nothing converts/);
    expect(five[2].why).toContain("§3.14");
    expect(five[3].why).toContain("§20.4.3");
    expect(five[3].why).toContain("never the delay");
    expect(traceCrossScope("wait_t_1p5ns").steps[1].what).toContain("an exact half, rounded away from zero");
    const scaled = traceCrossScope("wait_ns_5").steps;
    expect(scaled[0].why).toContain("§6.12");
    expect(scaled[2].why).toContain("§5.8");
  });

  it("the repeat form claims only what the event control supports: the line has no unit, the clock's delay sets the time", () => {
    const steps = traceCrossScope("repeat_posedge").steps;
    expect(steps[0].why).toBe("An event control waits for a value change, not for a time (§9.4.2). This line has no time unit.");
    expect(steps[1].why).toContain("The clock generator's own delay sets how long those edges take");
    expect(steps[1].why).toContain("#0.5ns");
    expect(steps[1].why).toContain("§5.8");
    expect(steps.map((s) => s.why).join(" ")).not.toMatch(/same in every time unit|No time unit is involved/);
    const feedback = crossScopeOptions("repeat_posedge").find((o) => o.correct)?.feedback;
    expect(feedback).toContain("The repeat line counts edges and has no unit (§9.4.2)");
    expect(feedback).toContain("§5.8");
    expect(feedback).not.toContain("no time unit takes part");
  });

  it("the cycle-count fix is recomputed from its clock line, for each caller unit", () => {
    const fixes = byId(gradeCrossScopeFixes());
    expect(fixes.cycles.results.map((r) => [formatScale(r.callerUnit), r.wake, r.ok])).toEqual([
      ["1ns", "5 ns", true],
      ["1ps", "5 ns", true],
      ["10ns", "5 ns", true],
    ]);
    // Without the initializer clk is 'x (Table 6-7) and ~x stays x, so no posedge would ever come (§9.4.2).
    expect(fixes.cycles.code.split("\n")).toEqual([
      "logic clk = 1;   // set before any procedure starts (§6.8)",
      "always #0.5ns clk = ~clk;   // a literal: the same period in any unit at this 1ps precision",
      "repeat (5) @(posedge clk);   // in tb_top: five clock edges; this line has no unit",
    ]);
    expect(fixes.cycles.review).toContain("These results assume the two clock lines above: clk starts at 1 before any procedure runs (§6.8), so it first rises one full period in");
    expect(fixes.cycles.review).toContain("the same period in every caller unit at this 1ps precision (§5.8)");
    expect(fixes.cycles.review).toContain("With a bare #0.5, a caller in 10ns would wake at 50 ns.");
    expect(fixes["wait-ns"].review).toMatch(/^Accepted, and preferred/);
    expect(fixes["project-timeunit"].review).toMatch(/^Works for this bench/);
  });

  it("the suspects' feedback and evidence are pinned, and the culprit's evidence changes the culprit", () => {
    const suspects = byId(gradeCrossScopeSuspects());
    expect(suspects["hash-t"].evidence).toContain("#t rewritten as #(t * 1ns)");
    expect(suspects["hash-t"].evidence).toContain("wakes at 5 ns instead of 5 ps");
    expect(suspects["hash-t"].feedback).toContain("§3.14");
    expect(suspects.call.feedback).toMatch(/^Half right\./);
    expect(suspects.call.feedback).toContain("§5.8");
    expect(suspects["tb-timeunit"].feedback).toContain("§3.14.2.2");
    expect(suspects.timeformat.feedback).toContain("§20.4.3");
    expect(byId(gradeCrossScopeSuspects({ ...CROSS_SCOPE_DEFAULT, calleeUnit: scale(100, "ps"), calleePrecision: scale(1, "ps") }))["hash-t"].evidence).toContain("wakes at 5 ns instead of 500 ps");
  });

  it("the fraction's loss cites both the integer type and the conversion", () => {
    const feedback = crossScopeOptions("wait_t_1p5ns").find((o) => o.id === "1.5ps")?.feedback;
    expect(feedback).toContain("(§6.11)");
    expect(feedback).toContain("(§6.12.1)");
  });

  it("a comment that explains the result is withheld on request, in every form that has one", () => {
    const delayLine = (form: keyof typeof CALL_FORM_TEXT, withhold: boolean) => crossScopeCode(form, withhold).find((l) => l.key === "pkg-delay")?.text;
    for (const form of ["wait_t_5ns", "wait_t_1p5ns", "repeat_posedge"] as const) {
      expect(delayLine(form, true), form).toBe("    #t;");
      expect(delayLine(form, false), form).toContain("THIS package's time unit");
    }
    expect(delayLine("wait_ns_5", true)).toBe("    #(delay_ns * 1ns);");
    expect(delayLine("wait_ns_5", false)).toContain("THIS package's time unit");
  });
});

describe("sv-timescale-model: the reset key alone moves the options", () => {
  it("over many attempts the order changes and the correct slot covers every slot", () => {
    const options = globalPrecisionOptions(true);
    const orders = Array.from({ length: 400 }, (_, attempt) => arrangeOptions(options, `${attempt}|true`));
    const keys = orders.map((order) => order.map((o) => o.id).join(","));
    expect(new Set(keys).size).toBeGreaterThanOrEqual(20);
    const slots = orders.map((order) => order.findIndex((o) => o.correct));
    for (const slot of [0, 1, 2, 3]) expect(slots.filter((s) => s === slot).length, `slot ${slot}`).toBeGreaterThanOrEqual(60);
    const moved = keys.filter((key, i) => i > 0 && key !== keys[i - 1]).length;
    expect(moved).toBeGreaterThanOrEqual(340);
  });
});

describe("sv-timescale-model: fix round 1, the order of scaling and rounding (§3.14.1, §22.7)", () => {
  const at = (d: string, unit: ReturnType<typeof scale>, precision: ReturnType<typeof scale>) => roundDelayText(d, unit, precision);

  it("no step states an order as the rule; the §22.7 order is shown with the same result, computed for the delay", () => {
    expect(at("#1.26", scale(10, "ns"), scale(1, "ns")).steps).toContain(
      "§22.7 lists the steps as round, then scale: 1.26 rounded to one decimal place is 1.3, and 1.3 × 10ns is 13 ns. The wake time is the same in either order, because the precision is relative to the unit (§3.14.1).",
    );
    expect(at("#2.75", scale(1, "ns"), scale(100, "ps")).steps.join(" ")).toContain("2.75 rounded to one decimal place is 2.8, and 2.8 × 1ns is 2.8 ns.");
    expect(at("#0.4", scale(1, "ns"), scale(1, "ns")).steps.join(" ")).toContain("0.4 rounded to a whole number is 0, and 0 × 1ns is 0 ns.");
    expect(at("#1.234", scale(100, "ns"), scale(1, "ns")).steps.join(" ")).toContain("1.234 rounded to 2 decimal places is 1.23, and 1.23 × 100ns is 123 ns.");
    expect(at("#2.1ns", scale(10, "ns"), scale(1, "ns")).steps.join(" ")).toContain("0.21 rounded to one decimal place is 0.2, and 0.2 × 10ns is 2 ns.");
    // A tie: each candidate gets its own product, and "in either order" names the order, not the tie rules.
    expect(at("#2.85", scale(1, "ns"), scale(100, "ps")).steps).toContain(
      "§22.7 lists the steps as round, then scale: 2.85 rounded to one decimal place is 2.8 or 2.9, and 2.8 × 1ns is 2.8 ns, or 2.9 × 1ns is 2.9 ns. Each wake time is the same in either order, because the precision is relative to the unit (§3.14.1).",
    );
    for (const d of ["#1.26", "#2.85", "#0.5", "#2.75"]) expect(at(d, scale(1, "ns"), scale(100, "ps")).steps.join(" "), d).not.toContain("either way");
    // Nothing to round, nothing to order.
    expect(at("#2.5", scale(10, "ns"), scale(1, "ns")).steps.join(" ")).not.toContain("§22.7 lists");
    for (const d of ["#1.26", "#2.75", "#2.1ns", "#2.85", "#0.4"]) {
      const text = at(d, scale(1, "ns"), scale(100, "ps")).steps.join(" ");
      expect(text, d).not.toMatch(/scales the number, then|then the element's own precision rounds/);
    }
  });

  it("the nearest-tick step, the truncation and the step distractors cite §22.7 for 'nearest'", () => {
    expect(at("#1.26", scale(10, "ns"), scale(1, "ns")).steps).toContain("12.6 ticks of the 1ns precision: nearer to 13 than to 12, so it rounds to the nearest tick, 13 ticks (§3.14.1, §22.7).");
    const options = roundingOptions(at("#2.75", scale(1, "ns"), scale(100, "ps")));
    expect(options.find((o) => o.id === "truncated")?.feedback).toContain("nearest tick (§22.7; §3.14.1 rounds 2.75 ns up to 2.8 ns)");
    const three = roundingOptions(at("#3", scale(1, "ns"), scale(1, "ns")));
    expect(three.find((o) => o.id === "step-later")?.feedback).toMatch(/rounds to the nearest 1ns tick \(§22\.7\)\.$/);
    const seq = wakeSequenceOptions(at("#1.26", scale(1, "ns"), scale(100, "ps")), 1);
    expect(seq.find((o) => o.correct)?.feedback).toContain("each time it runs (§3.14.1, §22.7)");
  });
});

describe("sv-timescale-model: fix round 1, ticks and ties in words", () => {
  const at = (d: string, unit: ReturnType<typeof scale>, precision: ReturnType<typeof scale>) => roundDelayText(d, unit, precision);

  it("says '1 tick', never '1 ticks'", () => {
    expect(tickCount(BigInt(1))).toBe("1 tick");
    expect(tickCount("27.5")).toBe("27.5 ticks");
    expect(tickCount(BigInt(0))).toBe("0 ticks");
    for (const [d, unit, precision] of [
      ["#0.5", scale(1, "ns"), scale(1, "ns")],
      ["#50ps", scale(1, "ns"), scale(100, "ps")],
      ["#1", scale(1, "ns"), scale(1, "ns")],
      ["#0.8", scale(1, "ns"), scale(1, "ns")],
    ] as const) {
      const text = at(d, unit, precision).steps.join(" ");
      expect(text, d).not.toMatch(/\b1 ticks/);
    }
    expect(at("#0.5", scale(1, "ns"), scale(1, "ns")).steps.join(" ")).toContain("Half away from zero gives 1 tick (1 ns); half to even gives 0 ticks (0 ns).");
    expect(at("#1", scale(1, "ns"), scale(1, "ns")).steps.join(" ")).toContain("1 tick of the 1ns precision: a whole number");
  });

  it("the tie feedback writes value × unit, and a literal with its written value", () => {
    const tie = roundingOptions(at("#2.85", scale(1, "ns"), scale(100, "ps"))).find((o) => o.id === "tie")?.feedback;
    expect(tie).toMatch(/^2\.85 × 1ns is exactly half way between two 100ps ticks/);
    const literal = at("#2.5ns", scale(10, "ns"), scale(1, "ns"));
    expect(literal.toolDependent).toBe(true);
    expect(roundingOptions(literal).find((o) => o.id === "tie")?.feedback).toMatch(/^2\.5ns = 0\.25 × 10ns is exactly half way between two 1ns ticks/);
    expect(wakeSequenceOptions(literal, 1).find((o) => o.id === "tie")?.feedback).toBe("2.5ns = 0.25 × 10ns sits exactly half way between two 1ns ticks and §3.14.1 states no tie rule.");
  });

  it("the binary remark is the lab's reasoning, and only for a tool-dependent tie whose value has no exact binary form", () => {
    expect(exactInBinary({ num: BigInt(5), den: BigInt(10) })).toBe(true);
    expect(exactInBinary({ num: BigInt(275), den: BigInt(100) })).toBe(true);
    expect(exactInBinary({ num: BigInt(285), den: BigInt(100) })).toBe(false);
    expect(exactInBinary({ num: BigInt(15), den: BigInt(100) })).toBe(false);
    expect(exactInBinary({ num: BigInt(0), den: BigInt(1000) })).toBe(true);
    expect(binaryRemark(at("#2.85", scale(1, "ns"), scale(100, "ps")))).toBe(
      "The lab's reasoning, not a rule of the standard: a real literal is held as an IEEE 754 double (§5.7.2), and 2.85 has no exact binary form, so a simulator that rounds the double may not see a half tick here at all.",
    );
    // Exact ties in binary: no remark.
    expect(at("#0.5", scale(1, "ns"), scale(1, "ns")).toolDependent).toBe(true);
    expect(binaryRemark(at("#0.5", scale(1, "ns"), scale(1, "ns")))).toBeNull();
    expect(at("#2.5", scale(1, "ns"), scale(1, "ns")).toolDependent).toBe(true);
    expect(binaryRemark(at("#2.5", scale(1, "ns"), scale(1, "ns")))).toBeNull();
    // Not tool-dependent: no remark either.
    expect(binaryRemark(at("#1.55", scale(1, "ns"), scale(100, "ps")))).toBeNull();
  });

  it("the binary remark names a time literal for what it is: a realtime value (§5.8), a real held as IEEE 754 (§6.12)", () => {
    const literal = at("#5ps", scale(1, "ns"), scale(10, "ps"));
    expect(literal.toolDependent).toBe(true);
    expect(binaryRemark(literal)).toBe(
      "The lab's reasoning, not a rule of the standard: a time literal is a realtime value scaled to the current unit (§5.8), held as an IEEE 754 double (§6.12), and 0.005 has no exact binary form, so a simulator that rounds the double may not see a half tick here at all.",
    );
    expect(binaryRemark(literal)).not.toContain("real literal");
    expect(binaryRemark(at("#0.5ns", scale(10, "ns"), scale(1, "ns")))).toMatch(/a time literal is a realtime value scaled to the current unit \(§5\.8\).*0\.05 has no exact binary form/);
    // A tie whose value is exact in binary still carries no remark, literal or not: 500ps is 0.5 of 1ns.
    expect(at("#500ps", scale(1, "ns"), scale(1, "ns")).toolDependent).toBe(true);
    expect(binaryRemark(at("#500ps", scale(1, "ns"), scale(1, "ns")))).toBeNull();
  });
});

describe("sv-timescale-model: fix round 1, wakes stay below 2^64 units whatever the sign of the delay", () => {
  const u_slow = { unit: scale(10, "ns"), precision: scale(1, "ns") };
  const big = "#18446744073709551615";

  it("a positive delay just below 2^64 units lists only its first wake, in the wakes, the options and the 'then every' clause", () => {
    const r = roundDelayText(big, u_slow.unit, u_slow.precision);
    expect(r.error).toBeNull();
    expect(wakesBelow64Bits(r, 2)).toBe(1);
    expect(repeatedWakes(r, 2).map((w) => w.k)).toEqual([1]);
    expect(thenEveryText(r, 2)).toBe("");
    const options = wakeSequenceOptions(r, 2, { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") });
    expect(options.find((o) => o.correct)?.label).toBe("184467440737095516150 ns");
    for (const o of options) expect(o.label, o.id).not.toContain("then");
  });

  it("a delay whose second wake fits but third does not lists two, and the clause says where it stops", () => {
    const r = roundDelayText("#9223372036854775807", scale(1, "ns"), scale(1, "ns"));
    expect(repeatedWakes(r, 3).map((w) => w.k)).toEqual([1, 2]);
    expect(thenEveryText(r, 3)).toBe(", then every 9223372036854775807 ns more, while the total stays below 2^64 units");
    expect(thenEveryText(r, 2)).toBe(", then every 9223372036854775807 ns more");
    expect(wakeSequenceOptions(r, 3).find((o) => o.correct)?.label).toBe("9223372036854775807 ns, then 18446744073709551614 ns");
  });

  it("the negative delay keeps its single wake by the same rule, and rounding up to 2^64 units is outside the lab", () => {
    expect(repeatedWakes(roundDelayText("#(-1)", u_slow.unit, u_slow.precision), 3).map((w) => w.k)).toEqual([1]);
    expect(roundDelayText("#18446744073709551615.6", scale(1, "ns"), scale(1, "ns")).error).toMatch(/2\^64 time units or more/);
    expect(roundDelayText("#18446744073709551615.4", scale(1, "ns"), scale(1, "ns")).error).toBeNull();
  });
});

describe("sv-timescale-model: fix round 1, the second wake rounds each delay, not the total", () => {
  it("offers the running-total misconception when it differs from the answer, citing §3.14.1 and §22.7's example", () => {
    const slow = roundDelayText("#1.26", scale(10, "ns"), scale(1, "ns"));
    const options = wakeSequenceOptions(slow, 2, { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") });
    const running = options.find((o) => o.id === "running-total");
    expect(running?.label).toBe("13 ns, then 25 ns");
    expect(running?.feedback).toContain("Each #1.26 is rounded on its own when it runs, then added");
    expect(running?.feedback).toContain("(§3.14.1)");
    // §22.7 writes the example as `parameter d = 1.55;` with `#d set = 0; #d set = 1;`, so the feedback names it that way.
    expect(running?.feedback).toContain("§22.7's own example, #d twice with d = 1.55 at 10ns/1ns, wakes at 16 ns and 32 ns");
    const spine = wakeSequenceOptions(roundDelayText("#1.55", scale(10, "ns"), scale(1, "ns")), 2);
    expect(spine.find((o) => o.correct)?.label).toBe("16 ns, then 32 ns");
    expect(spine.find((o) => o.id === "running-total")?.label).toBe("16 ns, then 31 ns");
    // A whole-tick delay has no running-total error to show.
    expect(wakeSequenceOptions(roundDelayText("#2.5", scale(10, "ns"), scale(1, "ns")), 2).some((o) => o.id === "running-total")).toBe(false);
    expect(wakeSequenceOptions(slow, 1).some((o) => o.id === "running-total")).toBe(false);
  });

  it("leaves the running-total option out when a running total is a half tick the tie rules round apart", () => {
    // #0.125 at 10ns/1ns: 1.25 ns rounds to 1 ns, so the wakes are 1 ns and 2 ns. The running total 2.5 ns is a half tick:
    // half away from zero gives 3 ns, half to even gives 2 ns, the answer itself (§3.14.1 states no tie rule).
    const r = roundDelayText("#0.125", scale(10, "ns"), scale(1, "ns"));
    const options = wakeSequenceOptions(r, 2);
    expect(options.find((o) => o.correct)?.label).toBe("1 ns, then 2 ns");
    expect(options.some((o) => o.id === "running-total")).toBe(false);
    expect(options.map((o) => o.label)).not.toContain("1 ns, then 3 ns");
    // A half tick both rules round the same way keeps it: §22.7's 15.5 ns gives 16 ns under either rule.
    expect(wakeSequenceOptions(roundDelayText("#1.55", scale(10, "ns"), scale(1, "ns")), 2).find((o) => o.id === "running-total")?.label).toBe("16 ns, then 31 ns");
  });

  it("the other-module distractor names neither module nor confirms its value", () => {
    for (const [d, own, contrast] of [
      ["#1.26", { unit: scale(1, "ns"), precision: scale(100, "ps") }, { name: "u_slow", unit: scale(10, "ns"), precision: scale(1, "ns") }],
      ["#2.26ns", { unit: scale(10, "ns"), precision: scale(1, "ns") }, { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") }],
    ] as const) {
      const feedback = wakeSequenceOptions(roundDelayText(d, own.unit, own.precision), 2, contrast).find((o) => o.id === "other-module")?.feedback ?? "";
      expect(feedback, d).toMatch(/the other module's settings play no part here/i);
      expect(feedback, d).not.toMatch(/u_slow|tb_top|becomes in|10ns\/1ns|1ns\/100ps/);
    }
  });
});

describe("sv-timescale-model: fix round 1, the cross-scope wording", () => {
  it("the cycle count distractor: repeat counts, the event control waits for one edge", () => {
    expect(crossScopeOptions("repeat_posedge").find((o) => o.id === "5ps")?.feedback).toBe(
      "The repeat loop counts the edges and the event control waits for each one; neither uses a time unit (§12.7.2, §9.4.2). The package's 1 ps unit plays no part.",
    );
  });

  it("the compile-error distractor states what the language defines, not what a tool prints", () => {
    for (const form of ["wait_t_5ns", "wait_t_1p5ns", "wait_ns_5"] as const) {
      const feedback = crossScopeOptions(form).find((o) => o.id === "error")?.feedback;
      expect(feedback, form).toBe("It compiles: the language defines no error for this mismatch, and only the log shows it.");
    }
  });

  it("the wait_ns boundary names the int-to-real conversion and says nothing rescales the number", () => {
    const boundary = traceCrossScope("wait_ns_5").steps[1];
    expect(boundary.what).toBe("Passed to the realtime argument delay_ns, the integer 5 becomes the real 5.0, and arrives in util_pkg as a plain number.");
    expect(boundary.why).toContain("assignment-like context (§10.8)");
    expect(boundary.why).toContain("(§6.12.1)");
    expect(boundary.why).toContain("Nothing rescales a number for the new scope's unit.");
    expect(boundary.why).not.toMatch(/Nothing converts/);
    const half = traceCrossScope("wait_t_1p5ns").steps[1];
    expect(half.why).toContain("(§10.8)");
    expect(half.why).toContain("a realtime argument would pass a plain number too");
  });

  it("the call suspect says where 5ns becomes a number read in tb_top's unit, matching the chip at that line", () => {
    const call = gradeCrossScopeSuspects().find((s) => s.id === "call");
    expect(call?.feedback).toBe(
      "Half right. This is where 5ns becomes the real 5.0, read in tb_top's 1ns unit, because a literal is converted where it is written (§5.8); passing it to t keeps only the number. The real defect is the package's #t, which reads that number in a different unit.",
    );
    expect(traceCrossScope("wait_t_5ns").steps[0]).toMatchObject({ lineKey: "tb-call", value: "5.0", unitTag: "1ns" });
  });

  it("the tb_top timeunit decoy's evidence is computed and pinned", () => {
    const suspects = Object.fromEntries(gradeCrossScopeSuspects().map((s) => [s.id, s]));
    expect(suspects["tb-timeunit"].evidence).toBe("Recomputed with tb_top in 1ps: the call would pass 5000 and wake at 5 ns.");
    expect(suspects.timeformat.evidence).toBe('Recomputed with $timeformat(-12, 0, " ps", 0): the process still wakes at 5 ps; only the text changes to "expected 5 ns, woke at 5 ps".');
  });

  it("the clock period's 'any unit' holds at this precision, and the step says so", () => {
    expect(traceCrossScope("repeat_posedge").steps[1].why).toContain("so the period stays 1 ns in any unit tb_top uses at this 1ps precision.");
    // At 1ns/1ns, 0.5 ns is a tool-dependent half tick and has no single value.
    expect(() => clockPeriodFs({ ...CROSS_SCOPE_DEFAULT, callerUnit: scale(1, "ns"), callerPrecision: scale(1, "ns") })).toThrow(/no single value/);
  });

  it("1step equals the global precision in the headline feedback", () => {
    expect(globalPrecisionOptions(true).find((o) => o.correct)?.feedback).toContain("1step equals the global precision, so it is 1 fs too (§3.14.3)");
    expect(globalPrecisionOptions(false).find((o) => o.correct)?.feedback).toContain("1step equals the global precision, so it is 100 ps too (§3.14.3)");
  });
});
