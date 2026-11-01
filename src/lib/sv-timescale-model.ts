/**
 * SystemVerilog time units, precision, rounding and time reporting.
 *
 * Every rule is implemented from IEEE 1800-2023 and named where it is used:
 * - 3.14: unit and precision are 1, 10 or 100 of s, ms, us, ns, ps, fs; the
 *   precision shall be at least as precise as the unit.
 * - 3.14.1: a delay is rounded to the precision of the design element that
 *   contains it; a finer precision elsewhere does not help. Example: 2.75 ns at
 *   1ns/100ps becomes 2.8 ns. No tie rule is stated, so at an exact half tick
 *   the model computes round-half-away-from-zero and round-half-to-even and
 *   reports both when they disagree.
 * - 3.14.2.1, 22.3, 22.7: a `timescale applies to the later design elements of
 *   the same compilation unit until the next `timescale or a `resetall.
 * - 3.12.1: how files map to compilation units is tool-specific; tools offer
 *   "all files one unit" and "each file its own unit".
 * - 3.14.2.2: timeunit and timeprecision keywords (one of each per time scope).
 * - 3.14.2.3: precedence (a) nested elements inherit from the enclosing module or
 *   interface; (b) the last earlier `timescale in the compilation unit; (c) a
 *   compilation-unit timeunit; (d) the implementation default. It is an error
 *   when some design elements specify a unit and precision and others do not.
 * - 3.14.3: the global precision is the minimum over all timeprecision
 *   statements, all timeunit precision arguments and the smallest `timescale
 *   precision; 1step equals it.
 * - 5.8: a time literal is a realtime value scaled to the current time unit.
 * - 6.12.1: a real converted to an integer rounds to nearest; an exact .5
 *   rounds away from zero.
 * - 9.4.1: an x/z delay is zero; a negative delay is a two's-complement
 *   unsigned integer of the size of a time variable (64 bits).
 * - 20.3.1, 20.3.2, 20.3.3: $time (64-bit integer in the caller's unit,
 *   rounded), $stime (low 32 bits), $realtime (keeps the fraction).
 * - 20.4.2: $printtimescale($root) prints the global precision as unit and
 *   precision.
 * - 20.4.3, Tables 20-2 and 20-3: $timeformat and its defaults.
 *
 * All arithmetic is exact. Delays are parsed as decimal strings into integer
 * femtoseconds held in BigInt rationals (every denominator is a power of ten),
 * and a half tick is detected by doubling the remainder. No floats anywhere.
 * Pure, no React. BigInt() calls instead of literals because tsconfig targets
 * ES2015.
 */

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

/** 10^n as a BigInt (n >= 0). The ES2015 target forbids ** on bigint. */
export function pow10(n: number): bigint {
  let out = ONE;
  for (let i = 0; i < n; i += 1) out *= TEN;
  return out;
}

const pow2 = (n: number): bigint => {
  let v = ONE;
  for (let i = 0; i < n; i += 1) v *= TWO;
  return v;
};
/** The size of a time variable (9.4.1) and of $stime (20.3.2). */
const TWO_POW_64 = pow2(64);
const TWO_POW_32 = pow2(32);

// ---------------------------------------------------------------------------
// Units and scales (3.14, Table 3-1; Table 20-2)
// ---------------------------------------------------------------------------

export type TimeUnitName = "s" | "ms" | "us" | "ns" | "ps" | "fs";
export type Magnitude = 1 | 10 | 100;

export interface TimeScale {
  magnitude: Magnitude;
  unit: TimeUnitName;
}

export const UNIT_ORDER: readonly TimeUnitName[] = ["s", "ms", "us", "ns", "ps", "fs"];
export const MAGNITUDES: readonly Magnitude[] = [1, 10, 100];

/** Power of ten of one unit in seconds (Table 20-2: 1 s is 0, 1 fs is -15). */
export const UNIT_EXPONENT: Readonly<Record<TimeUnitName, number>> = { s: 0, ms: -3, us: -6, ns: -9, ps: -12, fs: -15 };

export const scale = (magnitude: Magnitude, unit: TimeUnitName): TimeScale => ({ magnitude, unit });

/** The Table 20-2 value of a scale: 100 s is 2, 1 fs is -15. */
export function scaleExponent(s: TimeScale): number {
  return UNIT_EXPONENT[s.unit] + (s.magnitude === 1 ? 0 : s.magnitude === 10 ? 1 : 2);
}

/** The scale for a Table 20-2 value in 2..-15, or null outside that range. */
export function scaleFromExponent(e: number): TimeScale | null {
  if (!Number.isInteger(e) || e > 2 || e < -15) return null;
  const unit = UNIT_ORDER.find((u) => e >= UNIT_EXPONENT[u]) as TimeUnitName;
  const diff = e - UNIT_EXPONENT[unit];
  return { magnitude: diff === 0 ? 1 : diff === 1 ? 10 : 100, unit };
}

/** The 18 legal scales, coarsest first. */
export const ALL_SCALES: readonly TimeScale[] = UNIT_ORDER.flatMap((u) => [100, 10, 1].map((m) => scale(m as Magnitude, u)));

/** One scale as an exact number of femtoseconds. */
export function scaleToFs(s: TimeScale): bigint {
  return pow10(scaleExponent(s) + 15);
}

export function formatScale(s: TimeScale): string {
  return `${s.magnitude}${s.unit}`;
}

export function sameScale(a: TimeScale, b: TimeScale): boolean {
  return a.magnitude === b.magnitude && a.unit === b.unit;
}

/** Parses "1ns", "100 ps", "10us". Null for anything else. */
export function parseScale(text: string): TimeScale | null {
  const m = /^\s*(1|10|100)\s*(s|ms|us|ns|ps|fs)\s*$/.exec(text);
  if (!m) return null;
  return scale(Number(m[1]) as Magnitude, m[2] as TimeUnitName);
}

/**
 * 3.14: "The time precision of a design element shall be at least as precise as
 * the time unit; it cannot be a longer unit of time than the time unit."
 * Returns the error sentence, or null when the pair is legal.
 */
export function checkScalePair(unit: TimeScale, precision: TimeScale): string | null {
  if (scaleToFs(precision) > scaleToFs(unit)) {
    return `A precision of ${formatScale(precision)} is coarser than the unit ${formatScale(unit)}; the precision shall be at least as precise as the unit (IEEE 1800-2023 §3.14).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Exact decimal rationals
// ---------------------------------------------------------------------------

/** num / den with den a power of ten, so every value has a finite decimal form. */
export interface Rational {
  num: bigint;
  den: bigint;
}

const log10OfPowerOfTen = (den: bigint): number => den.toString().length - 1;

/** Removes common powers of ten so equal values compare equal. */
export function normalizeRational(r: Rational): Rational {
  let { num, den } = r;
  while (den > ONE && num % TEN === ZERO) {
    num /= TEN;
    den /= TEN;
  }
  return { num, den };
}

export function rationalEquals(a: Rational, b: Rational): boolean {
  return a.num * b.den === b.num * a.den;
}

/**
 * Exact decimal text of num/den (num >= 0, den a power of ten).
 * Without `digits`, trailing zeros are trimmed ("1.3", "16"). With `digits`,
 * the value is rounded to that many places, an exact half away from zero (the
 * same rule 6.12.1 gives for real-to-integer conversion; C's %f rounding of
 * the binary value is not modelled).
 */
export function rationalToDecimal(r: Rational, digits?: number): string {
  if (digits === undefined) {
    const n = normalizeRational(r);
    const places = log10OfPowerOfTen(n.den);
    const intPart = n.num / n.den;
    const rem = n.num % n.den;
    if (places === 0 || rem === ZERO) return intPart.toString();
    return `${intPart.toString()}.${rem.toString().padStart(places, "0")}`;
  }
  const scaleUp = pow10(digits);
  const scaled = r.num * scaleUp;
  let q = scaled / r.den;
  const rem = scaled % r.den;
  if (rem * TWO >= r.den) q += ONE;
  if (digits === 0) return q.toString();
  const intPart = q / scaleUp;
  const frac = q % scaleUp;
  return `${intPart.toString()}.${frac.toString().padStart(digits, "0")}`;
}

/** A femtosecond count written in `s` units, exactly ("1.3" for 1 300 000 fs in 1ns). */
export function fsToDecimal(fs: bigint, s: TimeScale, digits?: number): string {
  return rationalToDecimal({ num: fs, den: scaleToFs(s) }, digits);
}

/** "1.3 ns": the coarsest 1-magnitude unit that keeps the value at or above 1 (0 is written in `zeroUnit`). */
export function formatFsAuto(fs: bigint, zeroUnit: TimeUnitName = "ns"): string {
  if (fs === ZERO) return `0 ${zeroUnit}`;
  for (const unit of UNIT_ORDER) {
    const s = scale(1, unit);
    if (fs >= scaleToFs(s)) return `${fsToDecimal(fs, s)} ${unit}`;
  }
  return `${fs.toString()} fs`;
}

/** "5000 ps": the value in one named unit. */
export function formatFsIn(fs: bigint, unit: TimeUnitName): string {
  return `${fsToDecimal(fs, scale(1, unit))} ${unit}`;
}

// ---------------------------------------------------------------------------
// Delay parsing (5.8 time literals, 9.4.1 x/z and negative delays)
// ---------------------------------------------------------------------------

export type ParsedDelay =
  /** `#2.75`: a plain number in the element's time unit. */
  | { kind: "number"; text: string; digits: bigint; den: bigint }
  /** `#2.1ns`: a time literal, converted to the current unit where it is written (5.8). */
  | { kind: "literal"; text: string; digits: bigint; den: bigint; literalUnit: TimeUnitName }
  /** `#(x)`: an unknown or high-impedance delay is zero (9.4.1). */
  | { kind: "xz"; text: string }
  /** `#(-1)`: a negative delay is a 64-bit two's-complement unsigned integer (9.4.1). */
  | { kind: "negative"; text: string; written: bigint; asUnsigned: bigint }
  | { kind: "invalid"; text: string; reason: string };

const stripDelaySyntax = (text: string): string => {
  let t = text.trim();
  if (t.startsWith("#")) t = t.slice(1).trim();
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1).trim();
  return t.replace(/_/g, "");
};

/** Parses "#2.75", "2.1ns", "#(x)", "#(-1)". Decimal digits only; nothing is converted to a float. */
export function parseDelay(text: string): ParsedDelay {
  const t = stripDelaySyntax(text);
  if (/^(?:\d*'[bBoOdDhH]?)?[xXzZ?]+$/.test(t)) return { kind: "xz", text };
  const neg = /^-\s*(\d+)$/.exec(t);
  if (neg) {
    const written = BigInt(neg[1]);
    if (written === ZERO) return { kind: "number", text, digits: ZERO, den: ONE };
    return { kind: "negative", text, written: -written, asUnsigned: TWO_POW_64 - written };
  }
  const m = /^(\d+)(?:\.(\d+))?\s*(s|ms|us|ns|ps|fs)?$/.exec(t);
  if (!m) {
    if (/^-/.test(t)) return { kind: "invalid", text, reason: "A negative delay with a fraction is outside this lab; 9.4.1 reinterprets negative integer values as unsigned 64-bit numbers." };
    return { kind: "invalid", text, reason: "Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(x) or #(-1)." };
  }
  const frac = m[2] ?? "";
  const digits = BigInt(`${m[1]}${frac}`);
  const den = pow10(frac.length);
  if (m[3]) return { kind: "literal", text, digits, den, literalUnit: m[3] as TimeUnitName };
  return { kind: "number", text, digits, den };
}

// ---------------------------------------------------------------------------
// Rounding to the element's precision (3.14.1)
// ---------------------------------------------------------------------------

export interface TieResult {
  /** Ticks under round-half-away-from-zero (the 6.12.1 rule, applied to ticks). */
  awayFromZero: bigint;
  /** Ticks under round-half-to-even. */
  toEven: bigint;
  agree: boolean;
}

export interface RoundedDelay {
  input: ParsedDelay;
  unit: TimeScale;
  precision: TimeScale;
  /** 3.14 pair error, or the parse error; everything else is then null. */
  error: string | null;
  /** The delay after scaling by the unit (5.8 for literals), exact, in femtoseconds. */
  scaledFs: Rational | null;
  /** The scaled delay written in the element's units ("2.75", "0.21", "5000"). */
  scaledInUnits: string | null;
  /** The scaled delay as a time in the unit's base unit ("12.6 ns", "5000 ps"), before rounding. */
  scaledText: string | null;
  /** Precision ticks below and above the scaled value, and whether it sits exactly half way. */
  ticks: { down: bigint; up: bigint; exactHalf: boolean } | null;
  /** Both tie rules, filled only at an exact half tick. */
  tie: TieResult | null;
  /** The wake time(s) in femtoseconds: one entry, or two when the tie rules disagree. */
  candidatesFs: bigint[];
  /** The single wake time, or null when it is tool-dependent. */
  wakeFs: bigint | null;
  toolDependent: boolean;
  /** Short reason the delay is zero or huge (x/z, negative). */
  special: string | null;
  /** Explanation beats: What happened, with the clause. */
  steps: string[];
}

const ticksOf = (scaledFs: Rational, precisionFs: bigint) => {
  const den = scaledFs.den * precisionFs;
  const down = scaledFs.num / den;
  const rem = scaledFs.num % den;
  const exactHalf = rem * TWO === den;
  const above = rem * TWO > den;
  const up = rem === ZERO ? down : down + ONE;
  return { down, up, exactHalf, above, exact: rem === ZERO };
};

/**
 * Scales a parsed delay by the element's unit and rounds it to the element's
 * precision (3.14.1). At an exact half tick both tie rules are computed; when
 * they disagree the result is marked tool-dependent, because 3.14.1 states no
 * tie rule.
 */
export function roundDelay(input: ParsedDelay, unit: TimeScale, precision: TimeScale): RoundedDelay {
  const base: RoundedDelay = {
    input,
    unit,
    precision,
    error: null,
    scaledFs: null,
    scaledInUnits: null,
    scaledText: null,
    ticks: null,
    tie: null,
    candidatesFs: [],
    wakeFs: null,
    toolDependent: false,
    special: null,
    steps: [],
  };
  const pairError = checkScalePair(unit, precision);
  if (pairError) return { ...base, error: pairError };
  if (input.kind === "invalid") return { ...base, error: input.reason };

  const unitFs = scaleToFs(unit);
  const precisionFs = scaleToFs(precision);
  /** Times are written in the unit's base unit, as the lesson does ("2.8 ns" at 1ns/100ps). */
  const show = (fs: bigint) => formatFsIn(fs, unit.unit);
  const baseUnitFs = scaleToFs(scale(1, unit.unit));

  if (input.kind === "xz") {
    return {
      ...base,
      scaledFs: { num: ZERO, den: ONE },
      scaledInUnits: "0",
      scaledText: show(ZERO),
      ticks: { down: ZERO, up: ZERO, exactHalf: false },
      candidatesFs: [ZERO],
      wakeFs: ZERO,
      special: "x/z delay",
      steps: [
        `The delay expression evaluates to x or z, so it is interpreted as zero delay (§9.4.1).`,
        `The statement runs later in the same time slot, at ${show(ZERO)}.`,
      ],
    };
  }

  if (input.kind === "negative") {
    const wake = input.asUnsigned * unitFs;
    return {
      ...base,
      scaledFs: { num: wake, den: ONE },
      scaledInUnits: input.asUnsigned.toString(),
      scaledText: formatFsAuto(wake),
      ticks: { down: wake / precisionFs, up: wake / precisionFs, exactHalf: false },
      candidatesFs: [wake],
      wakeFs: wake,
      special: "negative delay",
      steps: [
        `${input.written.toString()} is negative, so it is interpreted as a two's-complement unsigned integer of the size of a time variable, 64 bits: 2^64 ${input.written === -ONE ? "− 1" : `− ${(-input.written).toString()}`} = ${input.asUnsigned.toString()} units (§9.4.1).`,
        `Scaled by the ${formatScale(unit)} unit that is ${formatFsAuto(wake)}, effectively forever; it needs no rounding because it is a whole number of units.`,
      ],
    };
  }

  // number or literal
  const literalFs = input.kind === "literal" ? scaleToFs(scale(1, input.literalUnit)) : unitFs;
  const scaledFs = normalizeRational({ num: input.digits * literalFs, den: input.den });
  const scaledInUnits = rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * unitFs });
  const scaledText = `${rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * baseUnitFs })} ${unit.unit}`;
  const t = ticksOf(scaledFs, precisionFs);
  const steps: string[] = [];
  const writtenValue = rationalToDecimal({ num: input.digits, den: input.den });
  if (input.kind === "literal") {
    steps.push(
      `${writtenValue}${input.literalUnit} is a time literal: it is converted to a real number in the current time unit, ${formatScale(unit)}, where it is written: ${scaledInUnits} units = ${scaledText} (§5.8).`,
    );
  } else {
    steps.push(`#${writtenValue} is a number of ${formatScale(unit)} units: ${scaledInUnits} × ${formatScale(unit)} = ${scaledText}.`);
  }
  if (t.exact) {
    const wake = t.down * precisionFs;
    steps.push(`${rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * precisionFs })} ticks of the ${formatScale(precision)} precision: a whole number, so no rounding is needed (§3.14.1). Wake at ${show(wake)}.`);
    return { ...base, scaledFs, scaledInUnits, scaledText, ticks: { down: t.down, up: t.up, exactHalf: false }, candidatesFs: [wake], wakeFs: wake, steps };
  }
  const tickText = rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * precisionFs });
  if (t.exactHalf) {
    const awayFromZero = t.down + ONE;
    const toEven = t.down % TWO === ZERO ? t.down : t.down + ONE;
    const tie: TieResult = { awayFromZero, toEven, agree: awayFromZero === toEven };
    const candidates = tie.agree ? [awayFromZero * precisionFs] : [toEven * precisionFs, awayFromZero * precisionFs];
    steps.push(`${tickText} ticks of the ${formatScale(precision)} precision: exactly half way between ${t.down.toString()} and ${(t.down + ONE).toString()}.`);
    if (tie.agree) {
      steps.push(
        `Half away from zero gives ${awayFromZero.toString()}; half to even also gives ${toEven.toString()}: every common tie rule agrees. Wake at ${show(candidates[0])} (§3.14.1; the standard's own example rounds 2.75 ns to 2.8 ns the same way).`,
      );
    } else {
      steps.push(
        `Half away from zero gives ${awayFromZero.toString()} ticks (${show(awayFromZero * precisionFs)}); half to even gives ${toEven.toString()} ticks (${show(toEven * precisionFs)}). §3.14.1 states no tie rule, so the result is tool-dependent.`,
      );
    }
    return {
      ...base,
      scaledFs,
      scaledInUnits,
      scaledText,
      ticks: { down: t.down, up: t.down + ONE, exactHalf: true },
      tie,
      candidatesFs: candidates,
      wakeFs: tie.agree ? candidates[0] : null,
      toolDependent: !tie.agree,
      steps,
    };
  }
  const nearest = t.above ? t.down + ONE : t.down;
  const wake = nearest * precisionFs;
  steps.push(
    `${tickText} ticks of the ${formatScale(precision)} precision: nearer to ${nearest.toString()} than to ${(t.above ? t.down : t.down + ONE).toString()}, so it rounds to ${nearest.toString()} ticks (§3.14.1).`,
  );
  steps.push(
    wake === ZERO
      ? `Wake at 0: the statement runs in the same time slot (§3.14.1). A finer precision elsewhere in the design does not change this.`
      : `Wake at ${show(wake)}${precision.unit === unit.unit ? "" : ` = ${formatFsIn(wake, precision.unit)}`}. A finer precision elsewhere in the design does not change this (§3.14.1).`,
  );
  return { ...base, scaledFs, scaledInUnits, scaledText, ticks: { down: t.down, up: t.down + ONE, exactHalf: false }, candidatesFs: [wake], wakeFs: wake, steps };
}

/** Convenience: parse and round in one call. */
export function roundDelayText(text: string, unit: TimeScale, precision: TimeScale): RoundedDelay {
  return roundDelay(parseDelay(text), unit, precision);
}

/** Text of the wake time(s) in the unit's base unit: "2.8 ns", or "2.8 ns or 2.9 ns (tool-dependent)". */
export function wakeText(r: RoundedDelay, unit: TimeUnitName = r.unit.unit): string {
  if (r.error) return "—";
  if (r.candidatesFs.length === 2) return `${formatFsIn(r.candidatesFs[0], unit)} or ${formatFsIn(r.candidatesFs[1], unit)} (tool-dependent)`;
  if (r.wakeFs === null) return "—";
  if (r.input.kind === "negative") return `2^64 − ${(-r.input.written).toString()} units, effectively forever`;
  return formatFsIn(r.wakeFs, unit);
}

/**
 * Wake times of `repeats` consecutive copies of the same delay from t = 0.
 * Each delay is rounded on its own (3.14.1), so the k-th wake is k times the
 * rounded delay; with a tool-dependent tie both candidates are listed.
 */
export function repeatedWakes(r: RoundedDelay, repeats: number): { k: number; candidatesFs: bigint[] }[] {
  const out: { k: number; candidatesFs: bigint[] }[] = [];
  if (r.error || r.candidatesFs.length === 0) return out;
  for (let k = 1; k <= repeats; k += 1) out.push({ k, candidatesFs: r.candidatesFs.map((c) => c * BigInt(k)) });
  return out;
}

// ---------------------------------------------------------------------------
// Prediction options for the rounding lab
// ---------------------------------------------------------------------------

export interface LabOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

const dedupe = (options: LabOption[]): LabOption[] => {
  const seen = new Set<string>();
  return options.filter((o) => {
    if (seen.has(o.label)) return false;
    seen.add(o.label);
    return true;
  });
};

/** Prediction options for one rounded delay: the model's answer plus distractors built from common misconceptions. */
export function roundingOptions(r: RoundedDelay): LabOption[] {
  if (r.error || !r.scaledFs) return [];
  const pUnit = r.unit.unit;
  const unitName = formatScale(r.unit);
  const precName = formatScale(r.precision);
  if (r.input.kind === "xz") {
    return [
      { id: "zero", label: `0 ${pUnit}`, correct: true, feedback: "An x or z delay is interpreted as zero delay (§9.4.1), so the statement runs later in the same time slot." },
      { id: "never", label: "Never", correct: false, feedback: "Only a negative delay behaves like forever (§9.4.1). x and z become zero." },
      { id: "one", label: formatFsIn(scaleToFs(r.precision), pUnit), correct: false, feedback: "The standard says zero, not one precision step (§9.4.1)." },
      { id: "error", label: "A compile error", correct: false, feedback: "It compiles; §9.4.1 defines the behaviour as zero delay." },
    ];
  }
  if (r.input.kind === "negative") {
    const magnitude = (-r.input.written).toString();
    return [
      { id: "forever", label: `2^64 − ${magnitude} units`, correct: true, feedback: `A negative delay is reinterpreted as a two's-complement unsigned integer of the size of a time variable, 64 bits: 2^64 − ${magnitude} units, effectively forever (§9.4.1).` },
      { id: "zero", label: `0 ${pUnit}`, correct: false, feedback: "Only x and z become zero (§9.4.1). A negative value becomes a huge unsigned one." },
      { id: "back", label: `−${magnitude} units`, correct: false, feedback: "Simulation time never runs backwards. The value is reinterpreted as an unsigned 64-bit integer (§9.4.1)." },
      { id: "error", label: "A compile error", correct: false, feedback: "It compiles; §9.4.1 says how the value is interpreted." },
    ];
  }
  const options: LabOption[] = [];
  /** Femtosecond values already offered, so two options never name the same time. */
  const used = new Set<string>(r.candidatesFs.map((c) => c.toString()));
  const offer = (option: LabOption, fs?: bigint) => {
    if (fs !== undefined) {
      if (used.has(fs.toString())) return;
      used.add(fs.toString());
    }
    options.push(option);
  };
  if (r.toolDependent && r.candidatesFs.length === 2) {
    options.push({
      id: "tie",
      label: wakeText(r),
      correct: true,
      feedback: `${r.scaledInUnits} ${unitName} is exactly half way between two ${precName} ticks, and §3.14.1 states no tie rule: half away from zero and half to even disagree, so the result is tool-dependent.`,
    });
    options.push({
      id: "away",
      label: formatFsIn(r.candidatesFs[1], pUnit),
      correct: false,
      feedback: `That is the round-half-away-from-zero result. §3.14.1 states no tie rule, so a simulator that rounds half to even lands on ${formatFsIn(r.candidatesFs[0], pUnit)} instead.`,
    });
    options.push({
      id: "even",
      label: formatFsIn(r.candidatesFs[0], pUnit),
      correct: false,
      feedback: `That is the round-half-to-even result. §3.14.1 states no tie rule, so a simulator that rounds half away from zero lands on ${formatFsIn(r.candidatesFs[1], pUnit)} instead.`,
    });
  } else if (r.wakeFs !== null) {
    options.push({
      id: "rounded",
      label: wakeText(r),
      correct: true,
      feedback:
        r.wakeFs === ZERO
          ? `${r.scaledInUnits} ${unitName} rounds to 0 at the ${precName} precision, so the statement runs in the same time slot (§3.14.1).`
          : `${r.scaledInUnits} ${unitName} is rounded to the element's own ${precName} precision (§3.14.1).`,
    });
  }
  const scaledIsWhole = r.scaledFs.den === ONE;
  const scaledText = scaledIsWhole ? formatFsIn(r.scaledFs.num, pUnit) : `${rationalToDecimal(r.scaledFs)} fs`;
  offer(
    {
      id: "unrounded",
      label: scaledText,
      correct: false,
      feedback: `Delays are rounded to the element's precision before they are used (§3.14.1); ${scaledText} is not on the ${precName} grid.`,
    },
    scaledIsWhole ? r.scaledFs.num : undefined,
  );
  const precFs = scaleToFs(r.precision);
  if (r.ticks) {
    const truncated = r.ticks.down * precFs;
    offer(
      {
        id: "truncated",
        label: formatFsIn(truncated, pUnit),
        correct: false,
        feedback: "That truncates. The precision rounds delays to the nearest tick (§3.14.1 rounds 2.75 ns up to 2.8 ns), it does not cut them.",
      },
      truncated,
    );
    const ceiled = r.ticks.up * precFs;
    offer(
      {
        id: "ceiled",
        label: formatFsIn(ceiled, pUnit),
        correct: false,
        feedback: "That rounds up. The precision rounds to the nearest tick (§3.14.1); a value below the half tick goes down.",
      },
      ceiled,
    );
  }
  if (r.input.kind === "number") {
    const misread = normalizeRational({ num: r.input.digits * precFs, den: r.input.den });
    const text = misread.den === ONE ? formatFsIn(misread.num, pUnit) : `${rationalToDecimal(misread)} fs`;
    offer(
      {
        id: "precision-as-unit",
        label: text,
        correct: false,
        feedback: `The number is in the time unit (${unitName}), not in the precision. The precision only says how finely the result is rounded (§3.14, §3.14.1).`,
      },
      misread.den === ONE ? misread.num : undefined,
    );
  } else if (r.input.kind === "literal") {
    const misread = normalizeRational({ num: r.input.digits * scaleToFs(r.unit), den: r.input.den });
    const text = misread.den === ONE ? formatFsIn(misread.num, pUnit) : `${rationalToDecimal(misread)} fs`;
    offer(
      {
        id: "unit-ignored",
        label: text,
        correct: false,
        feedback: `A time literal carries its own unit and is converted to the current unit where it is written (§5.8), so ${rationalToDecimal({ num: r.input.digits, den: r.input.den })}${r.input.literalUnit} means the same time in every module.`,
      },
      misread.den === ONE ? misread.num : undefined,
    );
  }
  // Input-independent distractors keep the prediction a real choice when the
  // misconceptions above collapse onto the answer (a whole-number delay with
  // unit = precision offers nothing else). Added until four options exist.
  const wakeRef = r.candidatesFs[r.candidatesFs.length - 1] ?? ZERO;
  const pads: { fs: bigint | null; option: LabOption }[] = [
    { fs: ZERO, option: { id: "same-slot", label: `0 ${pUnit}`, correct: false, feedback: `Only a delay below half a ${precName} tick rounds to 0 (§3.14.1); ${r.scaledText} does not.` } },
    { fs: wakeRef + precFs, option: { id: "step-later", label: formatFsIn(wakeRef + precFs, pUnit), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step added to it (§3.14.1). ${r.scaledText} rounds to the nearest ${precName} tick.` } },
    { fs: wakeRef * TEN, option: { id: "ten-x", label: formatFsIn(wakeRef * TEN, pUnit), correct: false, feedback: `The ${unitName} unit scales the number once and the ${precName} precision only rounds it (§3.14, §3.14.1); nothing multiplies the result by ten.` } },
    { fs: wakeRef - precFs, option: { id: "step-earlier", label: formatFsIn(wakeRef > precFs ? wakeRef - precFs : ZERO, pUnit), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step taken from it (§3.14.1). ${r.scaledText} rounds to the nearest ${precName} tick.` } },
    { fs: null, option: { id: "error", label: "A compile error", correct: false, feedback: "It compiles. A delay is any number of time units, and §3.14.1 says how it is rounded to the precision." } },
  ];
  for (const pad of pads) {
    if (options.length >= 4) break;
    if (pad.fs !== null && pad.fs <= ZERO && pad.option.id !== "same-slot") continue;
    offer(pad.option, pad.fs ?? undefined);
  }
  return dedupe(options).slice(0, 4);
}

/**
 * Prediction options for `repeats` consecutive copies of one delay in one
 * module ("13 ns, then 26 ns"). `contrast` names another module whose own
 * rounding of the same delay serves as the "mixed up the modules" distractor.
 */
export function wakeSequenceOptions(r: RoundedDelay, repeats: number, contrast?: { name: string; unit: TimeScale; precision: TimeScale }): LabOption[] {
  if (r.error || r.candidatesFs.length === 0 || r.input.kind === "xz" || r.input.kind === "negative" || r.input.kind === "invalid") return roundingOptions(r);
  const unit = r.unit.unit;
  const seq = (fs: bigint) => Array.from({ length: repeats }, (_, i) => formatFsIn(fs * BigInt(i + 1), unit)).join(", then ");
  const unitName = formatScale(r.unit);
  const precName = formatScale(r.precision);
  const options: LabOption[] = [];
  if (r.toolDependent && r.candidatesFs.length === 2) {
    options.push({ id: "tie", label: `${seq(r.candidatesFs[0])} or ${seq(r.candidatesFs[1])} (tool-dependent)`, correct: true, feedback: `${r.scaledInUnits} ${unitName} sits exactly half way between two ${precName} ticks and §3.14.1 states no tie rule.` });
  } else if (r.wakeFs !== null) {
    options.push({
      id: "rounded",
      label: seq(r.wakeFs),
      correct: true,
      feedback: `#${rationalToDecimal({ num: r.input.digits, den: r.input.den })} is ${r.scaledText}; the module's own ${precName} precision rounds it to ${formatFsIn(r.wakeFs, unit)} each time (§3.14.1).`,
    });
  }
  const used = new Set<string>(r.candidatesFs.map((c) => c.toString()));
  const offer = (option: LabOption, fs: bigint) => {
    if (used.has(fs.toString())) return;
    used.add(fs.toString());
    options.push(option);
  };
  if (r.scaledFs && r.scaledFs.den === ONE) {
    offer({ id: "unrounded", label: seq(r.scaledFs.num), correct: false, feedback: `Delays are rounded to the module's ${precName} precision before they are used (§3.14.1).` }, r.scaledFs.num);
  }
  const precFs = scaleToFs(r.precision);
  if (r.ticks) {
    const truncated = r.ticks.down * precFs;
    if (truncated !== ZERO) offer({ id: "truncated", label: seq(truncated), correct: false, feedback: "That truncates. The precision rounds to the nearest tick (§3.14.1)." }, truncated);
  }
  if (contrast) {
    const other = roundDelay(r.input, contrast.unit, contrast.precision);
    if (other.wakeFs !== null) {
      offer(
        {
          id: "other-module",
          label: seq(other.wakeFs),
          correct: false,
          feedback: `That is what the same delay becomes in ${contrast.name} (${formatScale(contrast.unit)}/${formatScale(contrast.precision)}). The unit scales the number and the module's own precision rounds it (§3.14, §3.14.1).`,
        },
        other.wakeFs,
      );
    }
  }
  // Input-independent distractors, so a whole-number delay still gets a real choice.
  const wakeRef = r.candidatesFs[r.candidatesFs.length - 1];
  const pads: { fs: bigint; option: LabOption }[] = [
    { fs: wakeRef + precFs, option: { id: "step-later", label: seq(wakeRef + precFs), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step added to it (§3.14.1).` } },
    { fs: wakeRef * TEN, option: { id: "ten-x", label: seq(wakeRef * TEN), correct: false, feedback: `The ${unitName} unit scales the number once and the ${precName} precision only rounds it (§3.14, §3.14.1); nothing multiplies the result by ten.` } },
    { fs: wakeRef - precFs, option: { id: "step-earlier", label: seq(wakeRef > precFs ? wakeRef - precFs : ZERO), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step taken from it (§3.14.1).` } },
  ];
  for (const pad of pads) {
    if (options.length >= 4) break;
    if (pad.fs <= ZERO) continue;
    offer(pad.option, pad.fs);
  }
  // #0 has no multiple to offer, so the last resort is the one misreading that needs no time value.
  if (options.length < 3) options.push({ id: "error", label: "A compile error", correct: false, feedback: "It compiles. A delay is any number of time units, and §3.14.1 says how it is rounded to the precision." });
  return dedupe(options).slice(0, 4);
}

/**
 * Places the correct option at a position derived from the option labels, so it
 * is not always first. Deterministic, so the server and client renders agree
 * and a lesson shows the same order on every visit.
 */
export function arrangeOptions<T extends { label: string; correct: boolean }>(options: readonly T[]): T[] {
  const correct = options.find((o) => o.correct);
  if (!correct || options.length < 2) return [...options];
  let hash = 0;
  for (const ch of options.map((o) => o.label).join("|")) hash = (hash * 31 + ch.charCodeAt(0)) % 1009;
  const others = options.filter((o) => o !== correct);
  const at = hash % options.length;
  return [...others.slice(0, at), correct, ...others.slice(at)];
}

const NS_FS = scaleToFs(scale(1, "ns"));

/**
 * The axis end and its major ticks for the largest wake time of the two-modules
 * figure: 30 ns for the lesson's figure, otherwise the next 1, 2 or 5 × 10^k ns,
 * labelled in the coarsest unit that keeps the end at or above 1. Exact BigInt.
 */
export function axisForWakes(maxWakeFs: bigint): { endFs: bigint; majorsFs: bigint[]; unit: TimeUnitName } {
  const thirty = BigInt(30) * NS_FS;
  let endFs: bigint;
  let intervals: number;
  if (maxWakeFs <= thirty) {
    endFs = thirty;
    intervals = 6;
  } else {
    const wholeNs = maxWakeFs / NS_FS + (maxWakeFs % NS_FS === ZERO ? ZERO : ONE);
    const decade = pow10(wholeNs.toString().length - 1) * NS_FS;
    const leading = maxWakeFs / decade + (maxWakeFs % decade === ZERO ? ZERO : ONE);
    if (leading <= ONE) {
      endFs = decade;
      intervals = 5;
    } else if (leading <= BigInt(2)) {
      endFs = decade * BigInt(2);
      intervals = 4;
    } else if (leading <= BigInt(5)) {
      endFs = decade * BigInt(5);
      intervals = 5;
    } else {
      endFs = decade * TEN;
      intervals = 5;
    }
  }
  const majorsFs = Array.from({ length: intervals + 1 }, (_, i) => (endFs * BigInt(i)) / BigInt(intervals));
  const unit = UNIT_ORDER.find((u) => endFs >= scaleToFs(scale(1, u))) ?? "fs";
  return { endFs, majorsFs, unit };
}

export interface RoundingPreset {
  id: string;
  label: string;
  delay: string;
  unit: TimeScale;
  precision: TimeScale;
  /** Where the delay comes from. Shown before the prediction, so it never states the result. */
  source: string;
  /** The result in words. Shown only in the reveal. */
  note: string;
}

/** The six table rows of F3A (§3.14.1 examples) plus the extra cases the lesson discusses. */
export const ROUNDING_PRESETS: readonly RoundingPreset[] = [
  { id: "table-2.75", label: "#2.75 at 1ns/100ps (the standard's example)", delay: "#2.75", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "The standard's example (§3.14.1).", note: "§3.14.1's own example: 2.8 ns." },
  { id: "table-1.26-ns", label: "#1.26 at 1ns/100ps", delay: "#1.26", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "tb_top in the lesson figure.", note: "tb_top in the lesson figure: 1.3 ns." },
  { id: "table-1.26-10ns", label: "#1.26 at 10ns/1ns", delay: "#1.26", unit: scale(10, "ns"), precision: scale(1, "ns"), source: "u_slow in the lesson figure.", note: "u_slow in the lesson figure: 12.6 ns rounds to 13 ns." },
  { id: "table-2.5", label: "#2.5 at 10ns/1ns", delay: "#2.5", unit: scale(10, "ns"), precision: scale(1, "ns"), source: "A row of the lesson's table.", note: "25 ns needs no rounding." },
  { id: "table-0.4", label: "#0.4 at 1ns/1ns", delay: "#0.4", unit: scale(1, "ns"), precision: scale(1, "ns"), source: "A row of the lesson's table.", note: "Rounds to 0: the statement runs in the same time slot." },
  { id: "table-5ns", label: "#5ns at 1ps/1ps (time literal)", delay: "#5ns", unit: scale(1, "ps"), precision: scale(1, "ps"), source: "A row of the lesson's table.", note: "A time literal is scaled to the current unit (§5.8): 5000 ps." },
  { id: "spine-1.55", label: "#1.55 at 1ns/100ps", delay: "#1.55", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "The lesson's assessment item.", note: "15.5 ticks: both tie rules give 16, so 1.6 ns." },
  { id: "literal-2.1ns", label: "#2.1ns at 10ns/1ns", delay: "#2.1ns", unit: scale(10, "ns"), precision: scale(1, "ns"), source: "A time literal in a module with a coarser unit (§5.8).", note: "0.21 units, rounded to 2 ns." },
  { id: "tie-2.85", label: "#2.85 at 1ns/100ps", delay: "#2.85", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "From the lesson's Expert note on delay values.", note: "28.5 ticks: half away from zero says 29, half to even says 28." },
  { id: "xz", label: "#(x) at 1ns/100ps", delay: "#(x)", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "An unknown delay value.", note: "x or z delays are zero (§9.4.1)." },
  { id: "negative", label: "#(-1) at 1ns/100ps", delay: "#(-1)", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "A negative delay value.", note: "A negative delay becomes an unsigned 64-bit value (§9.4.1)." },
];

// ---------------------------------------------------------------------------
// Reading the time: $time, $stime, $realtime, %t and $timeformat (20.3, 20.4.3)
// ---------------------------------------------------------------------------

export interface TimeFormat {
  /** Table 20-2 value, 2..-15. */
  units: number;
  /** Digits after the decimal point. */
  precision: number;
  suffix: string;
  minWidth: number;
}

/** Table 20-3 defaults other than the units, which come from the build. */
export const TIMEFORMAT_DEFAULTS = { precision: 0, suffix: "", minWidth: 20 } as const;

/** What the model needs to know about the whole source description. */
export interface Build {
  /** The precision argument of every `timescale directive in the source. */
  timescalePrecisions: readonly TimeScale[];
}

/** Table 20-3: default %t units = the smallest `timescale precision in the source; null (tool-dependent) when the source has no `timescale. */
export function defaultTimeformatUnits(build: Build): TimeScale | null {
  if (build.timescalePrecisions.length === 0) return null;
  return build.timescalePrecisions.reduce((best, s) => (scaleToFs(s) < scaleToFs(best) ? s : best));
}

/** 6.12.1: nearest integer, an exact half away from zero (num >= 0). */
export function realToInteger(r: Rational): { value: bigint; exactHalf: boolean } {
  const q = r.num / r.den;
  const rem = r.num % r.den;
  const exactHalf = rem * TWO === r.den;
  return { value: rem * TWO >= r.den ? q + ONE : q, exactHalf };
}

export interface TimeReadings {
  absFs: bigint;
  /** 20.3.1: 64-bit integer in the caller's unit, rounded. */
  time: bigint;
  /** 20.3.2: the low 32 bits. */
  stime: bigint;
  stimeWrapped: boolean;
  /** 20.3.3: the real value in the caller's unit. */
  realtime: Rational;
  /** The caller-unit value sat exactly half way between two integers. */
  timeExactHalf: boolean;
}

/** The three time functions at one absolute time, for a caller with this unit (20.3.1 to 20.3.3). */
export function readTime(absFs: bigint, unit: TimeScale): TimeReadings {
  const realtime = normalizeRational({ num: absFs, den: scaleToFs(unit) });
  const { value: time, exactHalf } = realToInteger(realtime);
  const stime = time % TWO_POW_32;
  return { absFs, time, stime, stimeWrapped: time >= TWO_POW_32, realtime, timeExactHalf: exactHalf };
}

/**
 * 20.4.3: %t treats its argument as a time in the caller's unit and writes it
 * in the $timeformat units with `precision` digits, the suffix, and left
 * padding to `minWidth`. `zeroWidth` models %0t as "no padding" (21.2.1.2
 * says a field width of 0 means minimum width; 20.4.3 and 21.2.1.2 do not say
 * how that interacts with minimum_field_width, so this is an assumption).
 */
export function formatPercentT(argFs: bigint, format: TimeFormat, zeroWidth = false): string {
  const target = scaleFromExponent(format.units);
  if (!target) throw new Error(`units_number ${format.units} is outside 2..-15 (Table 20-2)`);
  const body = `${rationalToDecimal({ num: argFs, den: scaleToFs(target) }, format.precision)}${format.suffix}`;
  return zeroWidth ? body : body.padStart(format.minWidth, " ");
}

/** The femtoseconds a %t argument stands for: $time has already been rounded, $realtime has not. */
export function argumentFs(readings: TimeReadings, arg: "time" | "realtime", unit: TimeScale): bigint {
  return arg === "time" ? readings.time * scaleToFs(unit) : readings.absFs;
}

export type ReadTimeStep =
  | { kind: "delay"; delay: string }
  | { kind: "timeformat"; format: TimeFormat }
  | { kind: "display"; template: string; args: readonly DisplayArg[] };

/** One argument of a $display: which function and which format specifier consumes it. */
export interface DisplayArg {
  fn: "time" | "stime" | "realtime";
  /** "%0d", "%d", "%t", "%0t" or "%.Nf". */
  spec: string;
}

export interface ReadTimeCaller {
  name: string;
  unit: TimeScale;
  precision: TimeScale;
  steps: readonly ReadTimeStep[];
}

export interface ReadTimeSnapshot {
  caller: string;
  unit: TimeScale;
  afterDelay: RoundedDelay;
  /** 1 for the caller's first delay, 2 for its second, and so on. */
  delayOrdinal: number;
  readings: TimeReadings;
  /** The $timeformat in force at this moment (null: never called). */
  format: TimeFormat | null;
}

export interface ReadTimeLine {
  caller: string;
  absFs: bigint;
  text: string;
  /** %t had no format and the build has no `timescale: the units are tool-dependent. */
  toolDependent: boolean;
  /** Index into `snapshots` of the caller's last wake before this print (null: printed before any delay). */
  momentIndex: number | null;
}

export interface ReadTimeTrace {
  snapshots: ReadTimeSnapshot[];
  lines: ReadTimeLine[];
  errors: string[];
}

/** The effective $timeformat: the last call, else Table 20-3 defaults (null when the units are tool-dependent). */
export function effectiveFormat(format: TimeFormat | null, build: Build): TimeFormat | null {
  if (format) return format;
  const units = defaultTimeformatUnits(build);
  if (!units) return null;
  return { units: scaleExponent(units), ...TIMEFORMAT_DEFAULTS };
}

const TOOL_DEPENDENT = "<tool-dependent>";

/** Renders one $display template with the readings of the moment. Unknown specifiers are left as written. */
export function renderDisplay(template: string, args: readonly DisplayArg[], readings: TimeReadings, unit: TimeScale, format: TimeFormat | null, build: Build): { text: string; toolDependent: boolean } {
  let i = 0;
  let toolDependent = false;
  const fmt = effectiveFormat(format, build);
  const text = template.replace(/%%|%0?[dt]|%\.\d+f/g, (spec) => {
    if (spec === "%%") return "%";
    const arg = args[i];
    i += 1;
    if (!arg) return spec;
    if (spec === "%t" || spec === "%0t") {
      if (!fmt) {
        toolDependent = true;
        return TOOL_DEPENDENT;
      }
      const fs = arg.fn === "realtime" ? readings.absFs : (arg.fn === "time" ? readings.time : readings.stime) * scaleToFs(unit);
      return formatPercentT(fs, fmt, spec === "%0t");
    }
    const f = /^%\.(\d+)f$/.exec(spec);
    if (f) {
      const r = arg.fn === "realtime" ? readings.realtime : { num: arg.fn === "time" ? readings.time : readings.stime, den: ONE };
      return rationalToDecimal(r, Number(f[1]));
    }
    // %0d / %d (a %d width is tool-sized; the model prints the minimum width)
    const v = arg.fn === "time" ? readings.time : arg.fn === "stime" ? readings.stime : realToInteger(readings.realtime).value;
    return v.toString();
  });
  return { text, toolDependent };
}

/**
 * Runs every caller's script from t = 0 and merges the events by time. The
 * $timeformat state is global (20.4.3: one call governs every %t in the design
 * until the next call). At equal times, callers run in array order, which is a
 * choice of this model, not a rule of the standard.
 */
export function runReadTime(callers: readonly ReadTimeCaller[], build: Build, initialFormat: TimeFormat | null = null): ReadTimeTrace {
  interface Event {
    atFs: bigint;
    order: number;
    callerIndex: number;
    step: ReadTimeStep;
    afterDelay: RoundedDelay | null;
  }
  const events: Event[] = [];
  const errors: string[] = [];
  callers.forEach((caller, callerIndex) => {
    let now = ZERO;
    let lastDelay: RoundedDelay | null = null;
    caller.steps.forEach((step, order) => {
      if (step.kind === "delay") {
        const r = roundDelayText(step.delay, caller.unit, caller.precision);
        if (r.error) {
          errors.push(`${caller.name}: ${r.error}`);
          return;
        }
        if (r.wakeFs === null) {
          errors.push(`${caller.name}: #${step.delay.replace(/^#/, "")} sits on a tool-dependent half tick; the lab uses the half-to-even value for the timeline.`);
          now += r.candidatesFs[0];
        } else now += r.wakeFs;
        lastDelay = r;
        events.push({ atFs: now, order, callerIndex, step, afterDelay: r });
      } else events.push({ atFs: now, order, callerIndex, step, afterDelay: lastDelay });
    });
  });
  events.sort((a, b) => (a.atFs === b.atFs ? (a.callerIndex === b.callerIndex ? a.order - b.order : a.callerIndex - b.callerIndex) : a.atFs < b.atFs ? -1 : 1));
  let format = initialFormat;
  const snapshots: ReadTimeSnapshot[] = [];
  const lines: ReadTimeLine[] = [];
  const lastMoment: (number | null)[] = callers.map(() => null);
  const delaysSoFar: number[] = callers.map(() => 0);
  for (const e of events) {
    const caller = callers[e.callerIndex];
    if (e.step.kind === "timeformat") {
      format = e.step.format;
      continue;
    }
    const readings = readTime(e.atFs, caller.unit);
    if (e.step.kind === "delay" && e.afterDelay) {
      delaysSoFar[e.callerIndex] += 1;
      snapshots.push({ caller: caller.name, unit: caller.unit, afterDelay: e.afterDelay, delayOrdinal: delaysSoFar[e.callerIndex], readings, format });
      lastMoment[e.callerIndex] = snapshots.length - 1;
    }
    if (e.step.kind === "display") {
      const r = renderDisplay(e.step.template, e.step.args, readings, caller.unit, format, build);
      lines.push({ caller: caller.name, absFs: e.atFs, text: r.text, toolDependent: r.toolDependent, momentIndex: lastMoment[e.callerIndex] });
    }
  }
  return { snapshots, lines, errors };
}

/**
 * Prediction options for one snapshot: what $time, $realtime and %t show.
 * Distractors are deduplicated by their text, and enough of them do not
 * depend on the input (padding, a truncated $time, the default-format or
 * tool-dependent %t, a tenfold miscount) that at least three options survive
 * whenever the time is not zero. The caller should fall back to a plain
 * explanation when fewer than two remain.
 */
export function readTimeOptions(snapshot: ReadTimeSnapshot, build: Build, arg: "time" | "realtime"): LabOption[] {
  const { readings, unit, format } = snapshot;
  const fmt = effectiveFormat(format, build);
  const argFs = argumentFs(readings, arg, unit);
  const correctT = fmt ? formatPercentT(argFs, fmt, true) : TOOL_DEPENDENT;
  const line = (time: string, realtime: string, t: string) => `$time=${time} $realtime=${realtime} %0t=${t}`;
  const timeText = readings.time.toString();
  const realtimeText = rationalToDecimal(readings.realtime);
  const unitName = formatScale(unit);
  const options: LabOption[] = [
    {
      id: "model",
      label: line(timeText, realtimeText, correctT),
      correct: true,
      feedback: `$time and $realtime are in the caller's ${unitName} unit: $time rounds to an integer (§20.3.1), $realtime keeps the fraction (§20.3.3). %t converts its argument to the $timeformat units (§20.4.3).`,
    },
  ];
  const precUnits = normalizeRational({ num: readings.absFs, den: scaleToFs(snapshot.afterDelay.precision) });
  options.push({
    id: "precision-units",
    label: line(rationalToDecimal(precUnits, 0), rationalToDecimal(precUnits), correctT),
    correct: false,
    feedback: `That counts in ${formatScale(snapshot.afterDelay.precision)} precision steps. $time and $realtime report in the calling element's time unit, ${unitName} (§20.3.1, §20.3.3).`,
  });
  options.push({
    id: "unrounded",
    label: line(realtimeText, realtimeText, correctT),
    correct: false,
    feedback: "$time returns an integer (§20.3.1); only $realtime keeps the fraction (§20.3.3).",
  });
  if (readings.realtime.den !== ONE) {
    options.push({
      id: "truncated",
      label: line((readings.realtime.num / readings.realtime.den).toString(), realtimeText, correctT),
      correct: false,
      feedback: "$time rounds to the nearest integer, it does not truncate: §20.3.1's own example reads 2 at 16 ns in a 10 ns unit, not 1.",
    });
  }
  if (fmt) {
    options.push({
      id: "raw-t",
      label: line(timeText, realtimeText, `${rationalToDecimal(arg === "time" ? { num: readings.time, den: ONE } : readings.realtime, fmt.precision)}${fmt.suffix}`),
      correct: false,
      feedback: `%t does not print the raw number. It treats the value as a time in the caller's ${unitName} unit and converts it to the $timeformat units (§20.4.3).`,
    });
    const paddedWidth = fmt.minWidth > 0 ? fmt.minWidth : TIMEFORMAT_DEFAULTS.minWidth;
    options.push({
      id: "padded-t",
      label: line(timeText, realtimeText, formatPercentT(argFs, { ...fmt, minWidth: paddedWidth }, false)),
      correct: false,
      feedback: `A field width of 0 asks for the minimum width (§21.2.1.2), and this lab assumes that drops the padding (see its stated assumptions). A plain %t pads to the minimum_field_width in force (${fmt.minWidth}; Table 20-3's default is 20).`,
    });
    const def = effectiveFormat(null, build);
    const defUnits = def ? scaleFromExponent(def.units) : null;
    if (format) {
      options.push({
        id: "format-ignored",
        label: line(timeText, realtimeText, def ? formatPercentT(argFs, def, true) : TOOL_DEPENDENT),
        correct: false,
        feedback: def && defUnits
          ? `That is Table 20-3's default (units ${formatScale(defUnits)}, 0 digits, no suffix). But $timeformat was called, and one call governs every %t in the design until the next (§20.4.3).`
          : "Without $timeformat the units would indeed be tool-dependent here: the source has no `timescale, so Table 20-3 gives none. But $timeformat was called, and it governs every %t until the next call (§20.4.3).",
      });
    }
    options.push({
      id: "tool-dependent",
      label: line(timeText, realtimeText, TOOL_DEPENDENT),
      correct: false,
      feedback: format
        ? "The units are settled: $timeformat was called, and it governs every %t in the design until the next call (§20.4.3)."
        : `The units are settled without a $timeformat call: Table 20-3 takes them from the smallest \`timescale precision in the source, ${defUnits ? formatScale(defUnits) : "shown above"}.`,
    });
  } else {
    options.push({
      id: "numeric-guess",
      label: line(timeText, realtimeText, rationalToDecimal(precUnits, 0)),
      correct: false,
      feedback: "A number needs units. No $timeformat was called and the source has no `timescale, so Table 20-3 gives no default units: the text is tool-dependent (§20.4.3).",
    });
  }
  if (readings.absFs !== ZERO) {
    const tenTimes = normalizeRational({ num: readings.realtime.num * TEN, den: readings.realtime.den });
    options.push({
      id: "ten-x",
      label: line(realToInteger(tenTimes).value.toString(), rationalToDecimal(tenTimes), correctT),
      correct: false,
      feedback: `$time and $realtime report in the calling element's time unit, ${unitName} (§20.3.1, §20.3.3); nothing rescales them.`,
    });
  }
  return dedupe(options).slice(0, 5);
}

export interface ReadTimePreset {
  id: string;
  label: string;
  /** The setup only. Shown before the predictions, so it never states a printed value. */
  summary: string;
  /** What the run shows. Shown only once every moment is revealed. */
  outcome: string;
  build: Build;
  callers: readonly ReadTimeCaller[];
  /** The %t argument the preset's own lines use. */
  arg: "time" | "realtime";
}

const timeformat = (units: number, precision: number, suffix: string, minWidth: number): TimeFormat => ({ units, precision, suffix, minWidth });

export const READ_TIME_PRESETS: readonly ReadTimePreset[] = [
  {
    id: "20.3.1",
    label: "§20.3.1: #1.55 twice at 10ns/1ns",
    summary: "The standard's own example: `timescale 10 ns / 1 ns, two delays of 1.55.",
    outcome: "$time reports 2 then 3 while the process woke at 16 ns and 32 ns (§20.3.1).",
    build: { timescalePrecisions: [scale(1, "ns")] },
    arg: "realtime",
    callers: [
      {
        name: "test",
        unit: scale(10, "ns"),
        precision: scale(1, "ns"),
        steps: [
          { kind: "delay", delay: "#1.55" },
          { kind: "display", template: "$time=%0d $realtime=%.1f %%t=%t", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.1f" }, { fn: "realtime", spec: "%t" }] },
          { kind: "delay", delay: "#1.55" },
          { kind: "display", template: "$time=%0d $realtime=%.1f %%t=%t", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.1f" }, { fn: "realtime", spec: "%t" }] },
        ],
      },
    ],
  },
  {
    id: "make-it-work",
    label: "Make It Work: tb_top and u_slow",
    summary: "tb_top (1ns/100ps) sets $timeformat(-9, 1, \" ns\", 0) at time 0; both modules print after the same #1.26. No `timescale anywhere, only timeunit.",
    outcome: "Each module reads $time and $realtime in its own unit, so both print 1.30 at different times, while %t converts to the one $timeformat: 1.3 ns and 13.0 ns (§20.3, §20.4.3).",
    build: { timescalePrecisions: [] },
    arg: "realtime",
    callers: [
      {
        name: "tb_top",
        unit: scale(1, "ns"),
        precision: scale(100, "ps"),
        steps: [
          { kind: "timeformat", format: timeformat(-9, 1, " ns", 0) },
          { kind: "delay", delay: "#1.26" },
          { kind: "display", template: "tb_top   $time=%0d $realtime=%.2f %%t=%t", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.2f" }, { fn: "realtime", spec: "%t" }] },
        ],
      },
      {
        name: "u_slow",
        unit: scale(10, "ns"),
        precision: scale(1, "ns"),
        steps: [
          { kind: "delay", delay: "#1.26" },
          { kind: "display", template: "slow_gen $time=%0d $realtime=%.2f %%t=%t", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.2f" }, { fn: "realtime", spec: "%t" }] },
          { kind: "delay", delay: "#1.26" },
          { kind: "display", template: "slow_gen $time=%0d $realtime=%.2f %%t=%t", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.2f" }, { fn: "realtime", spec: "%t" }] },
        ],
      },
    ],
  },
  {
    id: "uvm-stamp",
    label: "UVM: the log time stamp",
    summary: "uvm_pkg compiled after `timescale 1ns/1ps (uvm_pkg.sv declares no timeunit). uvm_report_server formats the time with \"%0t\" and $realtime. Nobody called $timeformat.",
    outcome: "The stamp reads 15000, not 15: with no $timeformat call, Table 20-3 takes the %t units from the smallest `timescale precision, 1 ps.",
    build: { timescalePrecisions: [scale(1, "ps")] },
    arg: "realtime",
    callers: [
      {
        name: "uvm_pkg",
        unit: scale(1, "ns"),
        precision: scale(1, "ps"),
        steps: [
          { kind: "delay", delay: "#15" },
          { kind: "display", template: "UVM_INFO test.sv(42) @ %0t: uvm_test_top [TEST] reset done", args: [{ fn: "realtime", spec: "%0t" }] },
        ],
      },
    ],
  },
  {
    id: "f2d-printing-time",
    label: "F2D: printing time",
    summary: "`timescale 1ns/1ps, one module: #10, three prints of $time, a $timeformat(-9, 0, \" ns\", 8), then #2.4.",
    outcome: "Before the $timeformat call, %t uses the Table 20-3 defaults: 1 ps units and width 20, so 10 ns prints as 10000, padded unless %0t drops the padding. After #2.4, $time reports 12 while $realtime keeps 12.4.",
    build: { timescalePrecisions: [scale(1, "ps")] },
    arg: "time",
    callers: [
      {
        name: "tb_top",
        unit: scale(1, "ns"),
        precision: scale(1, "ps"),
        steps: [
          { kind: "delay", delay: "#10" },
          { kind: "display", template: "a: %0d", args: [{ fn: "time", spec: "%0d" }] },
          { kind: "display", template: "b: [%t]", args: [{ fn: "time", spec: "%t" }] },
          { kind: "display", template: "c: [%0t]", args: [{ fn: "time", spec: "%0t" }] },
          { kind: "timeformat", format: timeformat(-9, 0, " ns", 8) },
          { kind: "display", template: "d: [%t]", args: [{ fn: "time", spec: "%t" }] },
          { kind: "delay", delay: "#2.4" },
          { kind: "display", template: "e: %0d %.1f", args: [{ fn: "time", spec: "%0d" }, { fn: "realtime", spec: "%.1f" }] },
        ],
      },
    ],
  },
];

/** A custom caller: every delay in `delays` is followed by a full print. */
export function customReadTimeCaller(unit: TimeScale, precision: TimeScale, delays: readonly string[]): ReadTimeCaller {
  const steps: ReadTimeStep[] = [];
  delays.forEach((d) => {
    steps.push({ kind: "delay", delay: d });
    steps.push({
      kind: "display",
      template: "$time=%0d $stime=%0d $realtime=%.3f %%t=%t",
      args: [
        { fn: "time", spec: "%0d" },
        { fn: "stime", spec: "%0d" },
        { fn: "realtime", spec: "%.3f" },
        { fn: "realtime", spec: "%t" },
      ],
    });
  });
  return { name: "custom", unit, precision, steps };
}

// ---------------------------------------------------------------------------
// Which unit applies: compilation units, `timescale, timeunit, precedence (3.14.2)
// ---------------------------------------------------------------------------

export type ElementKind = "module" | "interface" | "program" | "package";

export type SourceItem =
  | { kind: "timescale"; unit: TimeScale; precision: TimeScale }
  | { kind: "resetall" }
  /** timeunit at compilation-unit scope, outside every design element (3.14.2.3 rule c). */
  | { kind: "cu-timeunit"; unit: TimeScale; precision?: TimeScale }
  | {
      kind: "element";
      name: string;
      elementKind: ElementKind;
      timeunit?: TimeScale;
      timeprecision?: TimeScale;
      /** Nested modules or interfaces (3.14.2.3 rule a). */
      nested?: readonly SourceItem[];
    };

export interface SourceFile {
  id: string;
  label: string;
  items: readonly SourceItem[];
  /** One line of the file's contents, for display. */
  code: readonly string[];
}

export type PrecedenceRule = "declared" | "a" | "b" | "c" | "d";

export const PRECEDENCE_TEXT: Readonly<Record<PrecedenceRule, string>> = {
  declared: "declared inside the element with timeunit / timeprecision (§3.14.2.2)",
  a: "rule (a): inherited from the enclosing module or interface (§3.14.2.3)",
  b: "rule (b): the last earlier `timescale in the same compilation unit (§3.14.2.3)",
  c: "rule (c): the timeunit of the compilation-unit scope (§3.14.2.3)",
  d: "rule (d): the implementation default (§3.14.2.3)",
};

export interface ResolvedElement {
  id: string;
  path: string;
  elementKind: ElementKind;
  fileId: string;
  compilationUnit: number;
  /** null: the implementation default, never shown as a number. */
  unit: TimeScale | null;
  precision: TimeScale | null;
  unitRule: PrecedenceRule;
  precisionRule: PrecedenceRule;
  unitSource: string;
  precisionSource: string;
  /** false when either value came from rule (d). */
  specified: boolean;
}

export interface ResolutionError {
  message: string;
  clause: string;
  /** How tools report it. */
  toolNote: string;
}

export interface Resolution {
  elements: ResolvedElement[];
  errors: ResolutionError[];
  /** null when no precision is specified anywhere (then it is implementation-specific). */
  globalPrecision: TimeScale | null;
  globalPrecisionSources: string[];
  /** Precision of every `timescale in the design (Table 20-3's source for default %t units). */
  timescalePrecisions: TimeScale[];
  compilationUnits: { index: number; fileIds: string[] }[];
}

export type Grouping = "one" | "each";

/**
 * Resolves the unit and precision of every design element (3.14.2.1, 3.14.2.3,
 * 22.3) and the global precision (3.14.3) for files compiled as one compilation
 * unit or each as its own (3.12.1).
 */
export function resolveTimeScopes(files: readonly SourceFile[], grouping: Grouping): Resolution {
  const units: SourceFile[][] = grouping === "one" ? [files.slice()] : files.map((f) => [f]);
  const elements: ResolvedElement[] = [];
  const errors: ResolutionError[] = [];
  const precisions: { scale: TimeScale; source: string }[] = [];
  const timescalePrecisions: TimeScale[] = [];

  units.forEach((cuFiles, cuIndex) => {
    let directive: { unit: TimeScale; precision: TimeScale; source: string } | null = null;
    let cuUnit: { unit: TimeScale; precision?: TimeScale; source: string } | null = null;
    let sawItem = false;

    const resolveElement = (item: Extract<SourceItem, { kind: "element" }>, file: SourceFile, enclosing: ResolvedElement | null) => {
      let unit: TimeScale | null;
      let precision: TimeScale | null;
      let unitRule: PrecedenceRule;
      let precisionRule: PrecedenceRule;
      let unitSource: string;
      let precisionSource: string;
      const path = enclosing ? `${enclosing.path}.${item.name}` : item.name;
      if (item.timeunit) {
        unit = item.timeunit;
        unitRule = "declared";
        unitSource = `timeunit ${formatScale(item.timeunit)} in ${path}`;
      } else if (enclosing) {
        unit = enclosing.unit;
        unitRule = "a";
        unitSource = `inherited from ${enclosing.path}`;
      } else if (directive) {
        unit = directive.unit;
        unitRule = "b";
        unitSource = directive.source;
      } else if (cuUnit) {
        unit = cuUnit.unit;
        unitRule = "c";
        unitSource = cuUnit.source;
      } else {
        unit = null;
        unitRule = "d";
        unitSource = "implementation-specific default";
      }
      const declaredPrecision = item.timeprecision;
      if (declaredPrecision) {
        precision = declaredPrecision;
        precisionRule = "declared";
        precisionSource = `timeprecision ${formatScale(declaredPrecision)} in ${path}`;
        precisions.push({ scale: declaredPrecision, source: precisionSource });
      } else if (enclosing) {
        precision = enclosing.precision;
        precisionRule = "a";
        precisionSource = `inherited from ${enclosing.path}`;
      } else if (directive) {
        precision = directive.precision;
        precisionRule = "b";
        precisionSource = directive.source;
      } else if (cuUnit?.precision) {
        precision = cuUnit.precision;
        precisionRule = "c";
        precisionSource = cuUnit.source;
      } else {
        precision = null;
        precisionRule = "d";
        precisionSource = "implementation-specific default";
      }
      if (unit && precision && checkScalePair(unit, precision)) {
        errors.push({
          message: `${path}: precision ${formatScale(precision)} is coarser than unit ${formatScale(unit)}.`,
          clause: "IEEE 1800-2023 §3.14",
          toolNote: "an error per the standard",
        });
      }
      const resolved: ResolvedElement = {
        id: `${file.id}:${path}`,
        path,
        elementKind: item.elementKind,
        fileId: file.id,
        compilationUnit: cuIndex,
        unit,
        precision,
        unitRule,
        precisionRule,
        unitSource,
        precisionSource,
        specified: unitRule !== "d" && precisionRule !== "d" && unit !== null && precision !== null,
      };
      elements.push(resolved);
      (item.nested ?? []).forEach((n) => {
        if (n.kind === "element") resolveElement(n, file, resolved);
      });
    };

    cuFiles.forEach((file) => {
      file.items.forEach((item) => {
        if (item.kind === "timescale") {
          directive = { unit: item.unit, precision: item.precision, source: `\`timescale ${formatScale(item.unit)}/${formatScale(item.precision)} in ${file.label}` };
          timescalePrecisions.push(item.precision);
          if (checkScalePair(item.unit, item.precision)) {
            errors.push({ message: `${file.label}: \`timescale precision ${formatScale(item.precision)} is coarser than unit ${formatScale(item.unit)}.`, clause: "IEEE 1800-2023 §22.7", toolNote: "an error per the standard" });
          }
        } else if (item.kind === "resetall") {
          directive = null;
        } else if (item.kind === "cu-timeunit") {
          if (cuUnit) {
            errors.push({ message: `${file.label}: a second timeunit for the compilation-unit scope (the first was ${cuUnit.source}).`, clause: "IEEE 1800-2023 §3.14.2.2", toolNote: "an error per the standard" });
          } else if (sawItem) {
            errors.push({
              message: `${file.label}: the compilation-unit timeunit comes after other items of its compilation unit; a time scope's timeunit shall precede any other item.`,
              clause: "IEEE 1800-2023 §3.14.2.2",
              toolNote: "an error per the standard; some tools only warn",
            });
          }
          if (!cuUnit) cuUnit = { unit: item.unit, precision: item.precision, source: `compilation-unit timeunit ${formatScale(item.unit)}${item.precision ? ` / ${formatScale(item.precision)}` : ""} in ${file.label}` };
          if (item.precision) precisions.push({ scale: item.precision, source: `compilation-unit timeunit precision in ${file.label}` });
        } else {
          resolveElement(item, file, null);
        }
        sawItem = true;
      });
    });
  });

  const specified = elements.filter((e) => e.specified);
  const unspecified = elements.filter((e) => !e.specified);
  if (specified.length > 0 && unspecified.length > 0) {
    errors.push({
      message: `Mixed specification: ${specified.map((e) => e.path).join(", ")} ${specified.length === 1 ? "has" : "have"} both a time unit and a precision while ${unspecified.map((e) => e.path).join(", ")} ${unspecified.length === 1 ? "does" : "do"} not.`,
      clause: "IEEE 1800-2023 §3.14.2.3",
      toolNote: "an error per the standard; some tools only warn",
    });
  }

  if (timescalePrecisions.length) {
    const smallest = timescalePrecisions.reduce((b, s) => (scaleToFs(s) < scaleToFs(b) ? s : b));
    precisions.push({ scale: smallest, source: `the smallest \`timescale precision, ${formatScale(smallest)}` });
  }
  let globalPrecision: TimeScale | null = null;
  for (const p of precisions) if (!globalPrecision || scaleToFs(p.scale) < scaleToFs(globalPrecision)) globalPrecision = p.scale;
  const globalPrecisionSources = globalPrecision ? precisions.filter((p) => sameScale(p.scale, globalPrecision as TimeScale)).map((p) => p.source) : [];

  return {
    elements,
    errors,
    globalPrecision,
    globalPrecisionSources,
    timescalePrecisions,
    compilationUnits: units.map((cuFiles, index) => ({ index, fileIds: cuFiles.map((f) => f.id) })),
  };
}

export const scaleText = (s: TimeScale | null): string => (s ? formatScale(s) : "implementation-specific");

/** The files of the which-unit lab. Optional ones are included by id. */
export const WHICH_UNIT_FILES: readonly SourceFile[] = [
  {
    id: "cu",
    label: "cu.sv",
    items: [{ kind: "cu-timeunit", unit: scale(1, "us"), precision: scale(1, "ns") }],
    code: ["timeunit 1us / 1ns;   // compilation-unit scope: outside every design element"],
  },
  {
    id: "a",
    label: "a.sv",
    items: [
      { kind: "timescale", unit: scale(1, "ns"), precision: scale(1, "ps") },
      { kind: "element", name: "a", elementKind: "module" },
    ],
    code: ["`timescale 1ns/1ps", "module a; endmodule           // no timeunit"],
  },
  {
    id: "b",
    label: "b.sv",
    items: [{ kind: "element", name: "b", elementKind: "module" }],
    code: ["module b; endmodule           // no timeunit, no `timescale"],
  },
  {
    id: "reset",
    label: "reset.sv",
    items: [{ kind: "resetall" }],
    code: ["`resetall                     // directives back to their defaults (§22.3)"],
  },
  {
    id: "c",
    label: "c.sv",
    items: [{ kind: "element", name: "c", elementKind: "module", timeunit: scale(100, "ps") }],
    code: ["module c;", "  timeunit 100ps;             // unit declared; precision by precedence", "endmodule"],
  },
  {
    id: "pkg",
    label: "pkg.sv",
    items: [{ kind: "element", name: "util_pkg", elementKind: "package" }],
    code: ["package util_pkg; endpackage  // no timeunit"],
  },
  {
    id: "nested",
    label: "nested.sv",
    items: [
      {
        kind: "element",
        name: "outer",
        elementKind: "module",
        timeunit: scale(1, "ms"),
        timeprecision: scale(1, "us"),
        nested: [{ kind: "element", name: "inner", elementKind: "module" }],
      },
    ],
    code: ["module outer;", "  timeunit 1ms / 1us;", "  module inner; endmodule     // nested: inherits outer's unit (rule a)", "endmodule"],
  },
];

export const WHICH_UNIT_OPTIONAL_IDS: readonly string[] = ["cu", "reset"];
export const WHICH_UNIT_DEFAULT_ORDER: readonly string[] = ["a", "b", "c", "pkg", "nested"];

/** Prediction options for b's unit, graded against the model's resolution. */
export function whichUnitOptions(resolution: Resolution): LabOption[] {
  const b = resolution.elements.find((e) => e.path === "b");
  const unit = b?.unit ?? null;
  const rule = b?.unitRule ?? "d";
  const is = (s: TimeScale) => unit !== null && sameScale(unit, s);
  return [
    {
      id: "1ns",
      label: "1ns, from a.sv's `timescale",
      correct: is(scale(1, "ns")) && rule === "b",
      feedback:
        is(scale(1, "ns")) && rule === "b"
          ? "Right. b has no timeunit, so the last earlier `timescale in the same compilation unit applies, rule (b) of §3.14.2.3."
          : "A `timescale reaches only the design elements that come after it in the same compilation unit (§3.14.2.1), and a `resetall ends it (§22.3). In this order and grouping it does not reach b.",
    },
    {
      id: "100ps",
      label: "100ps, from c.sv's timeunit",
      correct: false,
      feedback: "A timeunit inside module c sets c's own time scope and nothing else (§3.14.2.2). It never leaks into another design element.",
    },
    {
      id: "1us",
      label: "1us, from the compilation-unit timeunit",
      correct: is(scale(1, "us")) && rule === "c",
      feedback:
        is(scale(1, "us")) && rule === "c"
          ? "Right. No `timescale is in force for b, so the compilation-unit scope's timeunit applies, rule (c) of §3.14.2.3."
          : "Rule (c) applies only when no earlier `timescale is in force in b's compilation unit and the timeunit sits in that same compilation unit (§3.14.2.3).",
    },
    {
      id: "default",
      label: "The tool's default (implementation-specific)",
      correct: unit === null,
      feedback:
        unit === null
          ? "Right. No rule (a) to (c) applies, so the implementation default is used, rule (d) of §3.14.2.3. The standard gives it no value."
          : "Rule (d) is the last resort. An earlier `timescale in the same compilation unit or a compilation-unit timeunit decides first (§3.14.2.3).",
    },
  ];
}

// ---------------------------------------------------------------------------
// Global precision and 1step (3.14.3, 20.4.2, Table 20-3)
// ---------------------------------------------------------------------------

/** The Make It Work bench as source files, with an optional vendor model compiled under `timescale 1ns/1fs. */
export function globalPrecisionDesign(withVendorModel: boolean): SourceFile[] {
  const files: SourceFile[] = [
    {
      id: "tb",
      label: "tb.sv",
      items: [
        { kind: "element", name: "slow_gen", elementKind: "module", timeunit: scale(10, "ns"), timeprecision: scale(1, "ns") },
        { kind: "element", name: "tb_top", elementKind: "module", timeunit: scale(1, "ns"), timeprecision: scale(100, "ps") },
      ],
      code: ["module slow_gen;", "  timeunit 10ns; timeprecision 1ns;", "endmodule", "module tb_top;", "  timeunit 1ns; timeprecision 100ps;", "  slow_gen u_slow ();", "endmodule"],
    },
  ];
  if (withVendorModel) {
    files.push({
      id: "vendor",
      label: "vendor_model.sv",
      items: [
        { kind: "timescale", unit: scale(1, "ns"), precision: scale(1, "fs") },
        { kind: "element", name: "vendor_model", elementKind: "module" },
      ],
      code: ["`timescale 1ns/1fs", "module vendor_model; endmodule"],
    });
  }
  return files;
}

export interface GlobalPrecisionReport {
  resolution: Resolution;
  /** "Time scale of ($root) is 100ps / 100ps" (20.4.2), or the implementation-specific note. */
  printtimescaleRoot: string;
  /** "100 ps" (3.14.3). */
  oneStep: string;
  /** Default %t units (Table 20-3), or null when tool-dependent. */
  defaultPercentTUnits: TimeScale | null;
  /** Each module's rounding of #1.26, unchanged by the global precision (3.14.1). */
  moduleRounding: { name: string; unit: TimeScale; precision: TimeScale; wake: string }[];
}

export function globalPrecisionReport(withVendorModel: boolean): GlobalPrecisionReport {
  const files = globalPrecisionDesign(withVendorModel);
  const resolution = resolveTimeScopes(files, "one");
  const gp = resolution.globalPrecision;
  const moduleRounding = resolution.elements
    .filter((e) => e.unit && e.precision && e.path !== "vendor_model")
    .map((e) => ({ name: e.path, unit: e.unit as TimeScale, precision: e.precision as TimeScale, wake: wakeText(roundDelayText("#1.26", e.unit as TimeScale, e.precision as TimeScale)) }));
  return {
    resolution,
    printtimescaleRoot: gp ? `Time scale of ($root) is ${formatScale(gp)} / ${formatScale(gp)}` : "Time scale of ($root) is implementation-specific (no precision is specified anywhere)",
    oneStep: gp ? `${gp.magnitude} ${gp.unit}` : "implementation-specific",
    defaultPercentTUnits: defaultTimeformatUnits({ timescalePrecisions: resolution.timescalePrecisions }),
    moduleRounding,
  };
}

/** Prediction options for $printtimescale($root) after the vendor model is added. */
export function globalPrecisionOptions(withVendorModel: boolean): LabOption[] {
  const report = globalPrecisionReport(withVendorModel);
  const correct = report.printtimescaleRoot;
  const mk = (id: string, text: string, feedback: string): LabOption => ({ id, label: text, correct: text === correct, feedback });
  return dedupe([
    mk("1fs", "Time scale of ($root) is 1fs / 1fs", withVendorModel ? "Right. The precision of every `timescale directive counts toward the global precision, even when every module overrides the directive with its own timeunit (§3.14.3). $root shows it as both unit and precision (§20.4.2)." : "There is no 1 fs precision anywhere in this design yet. Add the vendor model to see it."),
    mk("100ps", "Time scale of ($root) is 100ps / 100ps", withVendorModel ? "That was the answer before the vendor model. Its `timescale 1ns/1fs adds a 1 fs precision to the design, and the global precision is the minimum of all of them (§3.14.3)." : "Right. The finest precision in the design is tb_top's 100 ps (§3.14.3), shown as both unit and precision (§20.4.2)."),
    mk("1ns-1fs", "Time scale of ($root) is 1ns / 1fs", "$root reports the simulation time unit, and its unit and precision are always identical (§20.4.2). 1ns / 1fs is the vendor model's own setting."),
    mk("1ns-100ps", "Time scale of ($root) is 1ns / 100ps", "That is tb_top's own setting. $root reports the global precision as both unit and precision (§20.4.2)."),
  ]);
}

// ---------------------------------------------------------------------------
// Values that cross a scope (5.8, 6.12.1, 3.14): the 1000× debug challenge
// ---------------------------------------------------------------------------

export type CallForm = "wait_t_5ns" | "wait_t_1p5ns" | "wait_ns_5" | "repeat_posedge";

export interface CrossScopeConfig {
  callerUnit: TimeScale;
  callerPrecision: TimeScale;
  calleeUnit: TimeScale;
  calleePrecision: TimeScale;
  /** tb_top's $timeformat. */
  format: TimeFormat;
  /** The clock used by the repeat form: it rises every period, first at one period. */
  clockPeriodFs: bigint;
}

export const CROSS_SCOPE_DEFAULT: CrossScopeConfig = {
  callerUnit: scale(1, "ns"),
  callerPrecision: scale(1, "ps"),
  calleeUnit: scale(1, "ps"),
  calleePrecision: scale(1, "ps"),
  format: timeformat(-9, 3, " ns", 0),
  clockPeriodFs: scaleToFs(scale(1, "ns")),
};

export interface CrossScopeStep {
  /** Where the value is at this beat. */
  scope: "caller" | "boundary" | "callee" | "log";
  /** The line of crossScopeCode(form) that runs at this beat. */
  lineKey: string;
  title: string;
  /** The value as the code sees it, e.g. "5.0" or "5". */
  value: string;
  /** The unit the value is understood in, or null for a bare number. */
  unitTag: string | null;
  what: string;
  why: string;
}

export interface CrossScopeTrace {
  form: CallForm;
  callText: string;
  steps: CrossScopeStep[];
  /** Null for the unit-free form when no clock period is given. */
  wakeFs: bigint | null;
  /** What tb_top's $display prints, with its $timeformat. */
  printed: string;
  unitFree: boolean;
}

export const CALL_FORM_TEXT: Readonly<Record<CallForm, string>> = {
  wait_t_5ns: "util_pkg::wait_t(5ns);",
  wait_t_1p5ns: "util_pkg::wait_t(1.5ns);",
  wait_ns_5: "util_pkg::wait_ns(5);",
  repeat_posedge: "repeat (5) @(posedge clk);",
};

/** The value and wake time of one call form, beat by beat. */
export function traceCrossScope(form: CallForm, config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): CrossScopeTrace {
  const callerUnitText = formatScale(config.callerUnit);
  const calleeUnitText = formatScale(config.calleeUnit);
  const calleeUnitFs = scaleToFs(config.calleeUnit);
  const print = (fs: bigint) => `expected ${form === "wait_t_1p5ns" ? "1.5 ns" : "5 ns"}, woke at ${formatPercentT(fs, config.format, true)}`;
  const steps: CrossScopeStep[] = [];

  if (form === "repeat_posedge") {
    const wake = config.clockPeriodFs * BigInt(5);
    steps.push({ scope: "caller", lineKey: "tb-call", title: "In tb_top", value: "5", unitTag: "clock edges", what: "repeat (5) @(posedge clk) counts five rising edges of clk.", why: "An event control waits for a value change, not for a time (§9.4.2). No time unit is involved." });
    steps.push({ scope: "log", lineKey: "tb-display", title: "Wake", value: formatFsAuto(wake), unitTag: null, what: `With clk rising every ${formatFsAuto(config.clockPeriodFs)}, the fifth edge is at ${formatFsAuto(wake)}.`, why: "The wait is defined by the clock, so it is the same in every time unit. Cycle counts are the unit-free way to express a wait." });
    return { form, callText: CALL_FORM_TEXT[form], steps, wakeFs: wake, printed: print(wake), unitFree: true };
  }

  if (form === "wait_ns_5") {
    const literalInCallee = normalizeRational({ num: scaleToFs(scale(1, "ns")), den: calleeUnitFs });
    const product = normalizeRational({ num: BigInt(5) * literalInCallee.num, den: literalInCallee.den });
    const rounded = roundDelay({ kind: "number", text: rationalToDecimal(product), digits: product.num, den: product.den }, config.calleeUnit, config.calleePrecision);
    const wake = rounded.wakeFs ?? rounded.candidatesFs[0];
    steps.push({ scope: "caller", lineKey: "tb-call", title: "In tb_top", value: "5", unitTag: null, what: "wait_ns(5) passes the plain number 5.", why: "The argument is a realtime: a number with no unit (§6.12). The task's name says it is nanoseconds; the language does not." });
    steps.push({ scope: "boundary", lineKey: "pkg-task", title: "Crossing into util_pkg", value: "5.0", unitTag: null, what: "The number 5.0 arrives in util_pkg unchanged.", why: "Nothing converts a number when it crosses from one scope into another." });
    steps.push({ scope: "callee", lineKey: "pkg-delay", title: "In util_pkg", value: rationalToDecimal(product), unitTag: calleeUnitText, what: `#(delay_ns * 1ns): the literal 1ns is converted in util_pkg's ${calleeUnitText} unit to ${rationalToDecimal(literalInCallee)}, so the delay is 5.0 × ${rationalToDecimal(literalInCallee)} = ${rationalToDecimal(product)} ${calleeUnitText} units.`, why: "A time literal is scaled to the current time unit where it is written (§5.8), and here it is written inside the package." });
    steps.push({ scope: "log", lineKey: "tb-display", title: "Wake", value: formatFsAuto(wake), unitTag: null, what: `The process wakes at ${formatFsIn(wake, "ps")} = ${formatFsAuto(wake)}; tb_top prints "${print(wake)}".`, why: "The scaling happened in the callee, so the result is right whatever unit the caller uses." });
    return { form, callText: CALL_FORM_TEXT[form], steps, wakeFs: wake, printed: print(wake), unitFree: false };
  }

  // wait_t(5ns) or wait_t(1.5ns): the literal becomes a real in the caller's unit, then a time integer.
  const literal = form === "wait_t_5ns" ? parseDelay("5ns") : parseDelay("1.5ns");
  if (literal.kind !== "literal") throw new Error("unreachable");
  const callerUnitFs = scaleToFs(config.callerUnit);
  const inCaller = normalizeRational({ num: literal.digits * scaleToFs(scale(1, literal.literalUnit)), den: literal.den * callerUnitFs });
  const asTime = realToInteger(inCaller);
  const wake = asTime.value * calleeUnitFs;
  const literalText = `${rationalToDecimal({ num: literal.digits, den: literal.den })}${literal.literalUnit}`;
  steps.push({
    scope: "caller",
    lineKey: "tb-call",
    title: "In tb_top",
    value: rationalToDecimal(inCaller, inCaller.den === ONE ? 1 : undefined),
    unitTag: callerUnitText,
    what: `The literal ${literalText} is converted where it is written, in tb_top's ${callerUnitText} unit: the real number ${rationalToDecimal(inCaller, inCaller.den === ONE ? 1 : undefined)}.`,
    why: "A time literal is interpreted as a realtime value scaled to the current time unit (§5.8).",
  });
  steps.push({
    scope: "boundary",
    lineKey: "pkg-task",
    title: "Crossing into util_pkg",
    value: asTime.value.toString(),
    unitTag: null,
    what: `Passing it to the time argument t makes it the integer ${asTime.value.toString()}${asTime.exactHalf ? ` (${rationalToDecimal(inCaller)} is an exact half, rounded away from zero)` : inCaller.den !== ONE ? ` (${rationalToDecimal(inCaller)} rounded to the nearest integer)` : ""}. The unit tag is gone: t is a number.`,
    why: asTime.exactHalf || inCaller.den !== ONE ? "A real assigned to an integer rounds to the nearest integer; an exact .5 rounds away from zero (§6.12.1). A time variable holds a plain number." : "A time variable holds a plain number. Nothing converts it when it crosses into another scope.",
  });
  steps.push({
    scope: "callee",
    lineKey: "pkg-delay",
    title: "In util_pkg",
    value: asTime.value.toString(),
    unitTag: calleeUnitText,
    what: `#t means ${asTime.value.toString()} of util_pkg's ${calleeUnitText} units: ${formatFsIn(wake, "ps")}.`,
    why: `A delay is a number of the enclosing element's time units (§3.14), and util_pkg's unit is ${calleeUnitText}.`,
  });
  steps.push({
    scope: "log",
    lineKey: "tb-display",
    title: "Wake",
    value: formatFsAuto(wake),
    unitTag: null,
    what: `The process wakes at ${formatFsAuto(wake)}; tb_top prints "${print(wake)}".`,
    why: "$timeformat(-9, 3, \" ns\", 0) prints %t in nanoseconds with three decimals (§20.4.3). It changes the text, never the delay.",
  });
  return { form, callText: CALL_FORM_TEXT[form], steps, wakeFs: wake, printed: print(wake), unitFree: false };
}

/** Prediction options for the wake time of one call form. */
export function crossScopeOptions(form: CallForm, config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): LabOption[] {
  const trace = traceCrossScope(form, config);
  const correct = trace.wakeFs === null ? "unit-free" : formatFsAuto(trace.wakeFs);
  const mk = (id: string, label: string, feedback: string): LabOption => ({ id, label, correct: label === correct, feedback });
  if (form === "repeat_posedge") {
    return [
      mk("5ns", correct, "Right. Five rising edges of a clock with a 1 ns period: the wait is defined by the clock, and no time unit takes part (§9.4.2)."),
      mk("5ps", "5 ps", "An event control counts edges, not time units. The package's 1 ps unit plays no part (§9.4.2)."),
      mk("5000ns", "5000 ns", "No conversion happens: five edges of a 1 ns clock take 5 ns."),
    ];
  }
  const integerPassed = trace.steps[1]?.value ?? "";
  const options: LabOption[] = [
    mk(
      "model",
      correct,
      form === "wait_ns_5"
        ? `Right. 1ns is converted inside util_pkg to ${rationalToDecimal(normalizeRational({ num: scaleToFs(scale(1, "ns")), den: scaleToFs(config.calleeUnit) }))} of its ${formatScale(config.calleeUnit)} units (§5.8), so the task waits 5 ns.`
        : `Right. The literal becomes a real in tb_top's unit (§5.8), the time argument makes it the integer ${integerPassed}${form === "wait_t_1p5ns" ? " (an exact half rounds away from zero, §6.12.1)" : ""}, and #t reads that number in util_pkg's ${formatScale(config.calleeUnit)} unit (§3.14).`,
    ),
    mk("expected", form === "wait_t_1p5ns" ? "1.5 ns" : "5 ns", "That is the intent, not the result. The literal was converted in tb_top (§5.8) and #t reads the bare number in util_pkg's 1 ps unit (§3.14)."),
  ];
  if (form === "wait_t_1p5ns") {
    options.push(mk("1ps", "1 ps", "1.5 passed to a time argument rounds to the nearest integer, and an exact half rounds away from zero: 2, not 1 (§6.12.1)."));
    options.push(mk("1.5ps", "1.5 ps", "A time variable is an integer type; the fraction cannot survive the call (§6.12.1)."));
  } else if (form === "wait_t_5ns") {
    options.push(mk("5000ns", "5000 ns", "The conversion goes the other way: the number is small (5) and util_pkg's unit is small (1 ps), so the wait is 5 ps."));
  } else {
    options.push(mk("5ps", "5 ps", "That is wait_t's bug. wait_ns multiplies by the literal 1ns inside the package, where 1ns is 1000.0 of the 1 ps units (§5.8)."));
  }
  options.push(mk("error", "A compile error: units do not match", "It compiles. Numbers carry no unit, so the language has nothing to check; the mismatch is silent."));
  return dedupe(options);
}

export interface CrossScopeSuspect {
  id: string;
  /** The code line key. */
  lineKey: string;
  label: string;
  verdict: "culprit" | "contributes" | "decoy";
  /** How the model checked it: recomputed wake time under the stated change. */
  evidence: string;
  feedback: string;
}

/** Suspects, each graded by recomputing the wake time with the suspect's scope changed. */
export function gradeCrossScopeSuspects(config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): CrossScopeSuspect[] {
  const base = traceCrossScope("wait_t_5ns", config);
  const baseWake = base.wakeFs as bigint;
  const calleeInCallerUnit = traceCrossScope("wait_t_5ns", { ...config, calleeUnit: config.callerUnit, calleePrecision: config.callerPrecision });
  const callerInCalleeUnit = traceCrossScope("wait_t_5ns", { ...config, callerUnit: config.calleeUnit, callerPrecision: config.calleePrecision });
  const otherFormat = traceCrossScope("wait_t_5ns", { ...config, format: timeformat(-12, 0, " ps", 0) });
  return [
    {
      id: "hash-t",
      lineKey: "pkg-delay",
      label: "#t; in util_pkg",
      verdict: "culprit",
      evidence: `Recomputed with util_pkg in ${formatScale(config.callerUnit)}: the same call wakes at ${formatFsAuto(calleeInCallerUnit.wakeFs as bigint)} instead of ${formatFsAuto(baseWake)}.`,
      feedback: "Yes. #t reads t as a number of util_pkg's own 1 ps units (§3.14). The task promised to wait t without saying in which unit, and a bare number has none.",
    },
    {
      id: "call",
      lineKey: "tb-call",
      label: "util_pkg::wait_t(5ns); in tb_top",
      verdict: "contributes",
      evidence: `Recomputed with the literal written inside util_pkg instead: 5ns there would be 5000 units and wake at 5 ns.`,
      feedback: "Half right. This is where 5ns becomes the bare number 5, because a literal is converted where it is written (§5.8). The real defect is the package's #t, which gives that number a different unit.",
    },
    {
      id: "tb-timeunit",
      lineKey: "tb-timeunit",
      label: "timeunit 1ns; timeprecision 1ps; in tb_top",
      verdict: "decoy",
      evidence: `Recomputed with tb_top in ${formatScale(config.calleeUnit)}: the call would pass ${rationalToDecimal(normalizeRational({ num: BigInt(5) * scaleToFs(scale(1, "ns")), den: scaleToFs(config.calleeUnit) }))} and wake at ${formatFsAuto(callerInCalleeUnit.wakeFs as bigint)}.`,
      feedback: "A decoy. The number tb_top passes does depend on its unit, but 1 ns is the bench's legitimate choice (§3.14.2.2). Making every file match the package hides the defect rather than fixing it.",
    },
    {
      id: "timeformat",
      lineKey: "tb-timeformat",
      label: "$timeformat(-9, 3, \" ns\", 0); in tb_top",
      verdict: "decoy",
      evidence: `Recomputed with $timeformat(-12, 0, " ps", 0): the process still wakes at ${formatFsAuto(otherFormat.wakeFs as bigint)}; only the text changes to "${otherFormat.printed}".`,
      feedback: "A decoy. $timeformat changes how %t prints (§20.4.3) and nothing else. The process woke at 5 ps whatever the format says.",
    },
  ];
}

export interface CrossScopeFix {
  id: string;
  label: string;
  code: string;
  /** Wake time for the lesson's 1 ns caller, and for callers in other units. */
  results: { callerUnit: TimeScale; wake: string; ok: boolean }[];
  /** Wakes at 5 ns for the lesson's caller. */
  correctHere: boolean;
  /** Wakes at 5 ns for every caller unit tried. */
  robust: boolean;
  review: string;
}

const FIVE_NS_FS = BigInt(5) * scaleToFs(scale(1, "ns"));

/** The three fixes, graded by recomputing the wake time for callers in 1 ns, 1 ps and 10 ns. */
export function gradeCrossScopeFixes(config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): CrossScopeFix[] {
  const callerUnits: TimeScale[] = [config.callerUnit, scale(1, "ps"), scale(10, "ns")];
  const run = (form: CallForm, cfg: (unit: TimeScale) => CrossScopeConfig) =>
    callerUnits.map((callerUnit) => {
      const t = traceCrossScope(form, cfg(callerUnit));
      const wake = t.wakeFs as bigint;
      return { callerUnit, wake: formatFsAuto(wake), ok: wake === FIVE_NS_FS };
    });
  const finePrecision = (unit: TimeScale) => (scaleToFs(unit) < scaleToFs(config.callerPrecision) ? unit : config.callerPrecision);
  const fixes: Omit<CrossScopeFix, "correctHere" | "robust">[] = [
    {
      id: "wait-ns",
      label: "Scale inside the package: wait_ns(realtime delay_ns) with #(delay_ns * 1ns)",
      code: "task automatic wait_ns(realtime delay_ns);\n  #(delay_ns * 1ns);   // 1ns is converted in util_pkg's own unit (§5.8)\nendtask",
      results: run("wait_ns_5", (callerUnit) => ({ ...config, callerUnit, callerPrecision: finePrecision(callerUnit) })),
      review: "Accepted, and preferred. The literal 1ns is converted in the package, so the task waits 5 ns for a caller in any unit (§5.8).",
    },
    {
      id: "project-timeunit",
      label: "Give util_pkg the bench's unit: timeunit 1ns; timeprecision 1ps;",
      code: "package util_pkg;\n  timeunit 1ns; timeprecision 1ps;   // match tb_top\n  task automatic wait_t(time t); #t; endtask\nendpackage",
      results: run("wait_t_5ns", (callerUnit) => ({ ...config, callerUnit, callerPrecision: finePrecision(callerUnit), calleeUnit: scale(1, "ns"), calleePrecision: scale(1, "ps") })),
      review: "Works for this bench, and only while every file agrees. A caller in another unit gets the wrong delay again, silently. Acceptable as a project-wide rule, not as a fix to the package.",
    },
    {
      id: "cycles",
      label: "Pass a cycle count: repeat (n) @(posedge clk);",
      code: "repeat (5) @(posedge clk);   // in tb_top: five clock edges, no unit",
      results: run("repeat_posedge", (callerUnit) => ({ ...config, callerUnit, callerPrecision: finePrecision(callerUnit) })),
      review: "Accepted where a clock exists: an event control needs no unit (§9.4.2). It changes the API from a time to a cycle count, so callers must agree on the clock.",
    },
  ];
  return fixes.map((f) => ({ ...f, correctHere: f.results[0].ok, robust: f.results.every((r) => r.ok) }));
}

export const CROSS_SCOPE_HINTS: readonly string[] = [
  "Where is the literal 5ns turned into a number, and in which unit? §5.8 says a literal is converted where it is written.",
  "What does the task receive: a time with a unit, or a plain integer? Follow t across the package boundary.",
  "#t inside util_pkg is read in util_pkg's own time unit (§3.14). Which unit is that, and how many of them is 5?",
];

/** The exact code of the lesson's debug challenge, keyed for the suspect controls. */
export const CROSS_SCOPE_CODE: readonly { key: string; text: string; owner?: "testbench" }[] = [
  { key: "pkg-head", text: "package util_pkg;" },
  { key: "pkg-timeunit", text: "  timeunit 1ps; timeprecision 1ps;   // the library team's convention" },
  { key: "pkg-task", text: "  task automatic wait_t(time t);" },
  { key: "pkg-delay", text: "    #t;                              // waits t units of THIS package's time unit" },
  { key: "pkg-endtask", text: "  endtask" },
  { key: "pkg-end", text: "endpackage" },
  { key: "blank", text: "" },
  { key: "tb-head", text: "module tb_top;", owner: "testbench" },
  { key: "tb-timeunit", text: "  timeunit 1ns; timeprecision 1ps;", owner: "testbench" },
  { key: "tb-initial", text: "  initial begin", owner: "testbench" },
  { key: "tb-timeformat", text: '    $timeformat(-9, 3, " ns", 0);', owner: "testbench" },
  { key: "tb-call", text: "    util_pkg::wait_t(5ns);           // intent: wait 5 ns", owner: "testbench" },
  { key: "tb-display", text: '    $display("expected 5 ns, woke at %t", $realtime);', owner: "testbench" },
  { key: "tb-finish", text: "    $finish;", owner: "testbench" },
  { key: "tb-end-initial", text: "  end", owner: "testbench" },
  { key: "tb-end", text: "endmodule", owner: "testbench" },
];

/**
 * The code that actually runs for one call form, with line keys that match the
 * steps of traceCrossScope. wait_ns is the lesson's fix, and its comment leaves
 * out the lesson's "= 5 ns" because the learner sees this before predicting.
 * The repeat form declares its clock: the initializer runs before any procedure
 * starts (§6.8), so there is no edge at time 0; clk falls at 0.5 ns and first
 * rises at 1 ns, which is CROSS_SCOPE_DEFAULT.clockPeriodFs.
 */
export function crossScopeCode(form: CallForm): readonly { key: string; text: string; owner?: "testbench" }[] {
  const swap = (changes: Readonly<Record<string, string>>) => CROSS_SCOPE_CODE.map((l) => (l.key in changes ? { ...l, text: changes[l.key] } : l));
  switch (form) {
    case "wait_t_5ns":
      return CROSS_SCOPE_CODE;
    case "wait_t_1p5ns":
      return swap({
        "tb-call": "    util_pkg::wait_t(1.5ns);         // intent: wait 1.5 ns",
        "tb-display": '    $display("expected 1.5 ns, woke at %t", $realtime);',
      });
    case "wait_ns_5":
      return swap({
        "pkg-task": "  task automatic wait_ns(realtime delay_ns);",
        "pkg-delay": "    #(delay_ns * 1ns);               // 1ns is converted in THIS package's time unit",
        "tb-call": "    util_pkg::wait_ns(5);",
      });
    case "repeat_posedge":
      return swap({ "tb-call": "    repeat (5) @(posedge clk);" }).flatMap((l) =>
        l.key === "tb-timeunit"
          ? [
              l,
              { key: "tb-clk", text: "  logic clk = 1;                     // set before any procedure starts: no edge at 0", owner: "testbench" as const },
              { key: "tb-clk-gen", text: "  always #0.5 clk = ~clk;            // falls at 0.5 ns, rises at 1 ns, period 1 ns", owner: "testbench" as const },
            ]
          : [l],
      );
  }
}
