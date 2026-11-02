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
  checkScalePair,
  crossScopeCode,
  crossScopeOptions,
  customReadTimeCaller,
  defaultTimeformatUnits,
  effectiveFormat,
  formatFsAuto,
  formatFsIn,
  formatPercentT,
  formatScale,
  globalPrecisionOptions,
  globalPrecisionReport,
  gradeCrossScopeFixes,
  gradeCrossScopeSuspects,
  parseDelay,
  parseScale,
  pow10,
  rationalToDecimal,
  readTime,
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
  traceCrossScope,
  wakeSequenceOptions,
  wakeText,
  whichUnitOptions,
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
    expect(parseDelay("#(x)")).toMatchObject({ kind: "xz" });
    expect(parseDelay("1'bz")).toMatchObject({ kind: "xz" });
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
    const x = roundDelayText("#(x)", scale(1, "ns"), scale(100, "ps"));
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
    const delays = ["#0", "#1", "#3", "#0.4", "#0.5", "#1.26", "#2.5", "#2.85", "#5ns", "#2.1ns", "#(x)", "#(-1)"];
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
      for (const delay of ["#3", "#0", "#(x)", "#1.5"]) {
        const t = runReadTime([customReadTimeCaller(scale(1, "ns"), scale(1, "ns"), [delay])], build);
        for (const snapshot of t.snapshots) {
          for (const arg of ["realtime", "time"] as const) {
            const options = readTimeOptions(snapshot, build, arg);
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
    const options = readTimeOptions(t.snapshots[0], build, "realtime");
    expect(options.find((o) => o.correct)?.label).toBe("$time=3 $realtime=3 %0t=3");
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(["padded-t", "tool-dependent", "ten-x"]));
  });

  it("every moment of every preset can be predicted", () => {
    for (const p of READ_TIME_PRESETS) {
      const t = runReadTime(p.callers, p.build);
      expect(t.snapshots.length, p.id).toBeGreaterThan(0);
      for (const snapshot of t.snapshots) {
        const options = readTimeOptions(snapshot, p.build, p.arg);
        expect(options.length, p.id).toBeGreaterThanOrEqual(2);
        expect(options.filter((o) => o.correct), p.id).toHaveLength(1);
      }
    }
  });

  it("builds one correct option per snapshot with precision-unit and unrounded distractors", () => {
    const p = preset("make-it-work");
    const t = runReadTime(p.callers, p.build);
    const options = readTimeOptions(t.snapshots[1], p.build, "realtime");
    expect(options.filter((o) => o.correct).map((o) => o.label)).toEqual(["$time=1 $realtime=1.3 %0t=13.0 ns"]);
    expect(options.find((o) => o.id === "precision-units")?.label).toMatch(/^\$time=13 /);
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
    expect(t.steps[1].what).toMatch(/unit tag is gone/);
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
    expect(t.steps[2].value).toBe("5000");
  });

  it("repeat (5) @(posedge clk) is unit-free", () => {
    const t = traceCrossScope("repeat_posedge");
    expect(t.unitFree).toBe(true);
    expect(t.wakeFs).toBe(ns(5));
    expect(t.steps[0].unitTag).toBe("clock edges");
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

  it("a read-time preset's label and summary never contain a value it prints", () => {
    for (const p of READ_TIME_PRESETS) {
      const trace = runReadTime(p.callers, p.build, null);
      for (const snapshot of trace.snapshots) {
        const correct = readTimeOptions(snapshot, p.build, p.arg).find((o) => o.correct)?.label as string;
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
    const inputs = ["#2.75", "#1.26", "#3", "#0.4", "#5ns", "#2.1ns", "#2.85", "#(x)", "#(-1)"];
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
    const xz = roundingOptions(roundDelayText("#(x)", scale(1, "ns"), scale(100, "ps")));
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
    expect(code).toContain("always #0.5 clk = ~clk;");
    const halfPeriod = roundDelayText("#0.5", CROSS_SCOPE_DEFAULT.callerUnit, CROSS_SCOPE_DEFAULT.callerPrecision).wakeFs as bigint;
    expect(halfPeriod * BigInt(2)).toBe(CROSS_SCOPE_DEFAULT.clockPeriodFs);
    // clk starts at 1, so its first rise is one full period in and the fifth is at five periods.
    expect(traceCrossScope("repeat_posedge").wakeFs).toBe(CROSS_SCOPE_DEFAULT.clockPeriodFs * BigInt(5));
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
