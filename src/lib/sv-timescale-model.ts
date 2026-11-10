/**
 * SystemVerilog time units, precision, rounding and time reporting.
 *
 * Every rule is implemented from IEEE 1800-2023 and named where it is used:
 * - 3.14: unit and precision are 1, 10 or 100 of s, ms, us, ns, ps, fs; the
 *   precision shall be at least as precise as the unit.
 * - 3.14.1: a delay is rounded to the precision of the design element that
 *   contains it; a finer precision elsewhere does not help. The precision is
 *   relative to the unit. Example: 2.75 ns at 1ns/100ps becomes 2.8 ns. No tie
 *   rule is stated, so at an exact half tick the model computes
 *   round-half-away-from-zero and round-half-to-even and reports both when they
 *   disagree. 3.14.1 states no order of scaling and rounding.
 * - 22.7: its example rounds to the nearest 1 ns, and lists the steps as round
 *   (1.55 to 1.6 by the precision), then scale (1.6 to 16); the two wakes are
 *   16 ns and 32 ns. Because the precision is relative to the unit, rounding in
 *   units and then scaling gives the same wake time as scaling and then rounding
 *   to the precision's ticks, which is how the model computes it.
 * - 3.14.2.1, 22.3, 22.7: a `timescale applies to the later design elements of
 *   the same compilation unit until the next `timescale or a `resetall.
 * - 3.12.1: how files map to compilation units is tool-specific; tools offer
 *   "all files one unit" and "each file its own unit".
 * - 3.14.2.2: timeunit and timeprecision keywords (one of each per time scope,
 *   before any other item; a later repeat shall match the first).
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
 * - 9.4, A.6.5, A.2.2.3, A.8.7: delay_control is # delay_value or
 *   # ( mintypmax_expression ) (A.6.5), and delay_value is unsigned_number,
 *   real_number, ps_identifier, time_literal or 1step (A.2.2.3): no unary minus,
 *   no based number and no unbased unsized literal (5.7.1), so #(-1), #(1'bx)
 *   and #('x) need their parentheses. 1step is a delay_value only, not a primary
 *   (A.8.4), so #(1step) is no legal delay. An x or z digit exists only inside a
 *   based number (A.8.7), so a bare x is an identifier (5.6, A.9.3), and a bare ?
 *   (a z_digit) is no legal delay: no simple identifier can contain it (5.6).
 * - 5.7.2: a real literal is held as an IEEE 754 double. The model rounds the
 *   exact decimal as written; whether a tool sees an exact half tick in a value
 *   such as 2.85, which has no exact binary form, is the lab's reasoning, not a
 *   rule of the standard.
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
/** 2^64: time is a 64-bit unsigned integer (6.11, Table 6-8), and 9.4.1 sizes a negative delay like it. 2^32: $stime keeps 32 bits (20.3.2). */
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
  /** `#(1'bx)`: a delay expression that evaluates to x or z is zero (9.4.1). */
  | { kind: "xz"; text: string; sizing?: string }
  /** `#(-1)`: a negative delay is a 64-bit two's-complement unsigned integer (9.4.1). */
  | { kind: "negative"; text: string; written: bigint; asUnsigned: bigint }
  | { kind: "invalid"; text: string; reason: string };

const OUTSIDE_64_BITS = "That delay comes to 2^64 time units or more, more than a 64-bit time variable (§6.11) can count. The sources give no rule for it, so it is outside this lab.";

/** The forms this lab computes. Said without calling other text illegal: a name or an expression can be a legal delay. */
const WRITE_A_DELAY = "Write a delay as #d (for example #2.75), a time literal (#2.1ns), #(1'bx) or #(-1): the forms this lab computes.";

/**
 * The delay without its # and parentheses, and whether it was parenthesised: the
 * grammar allows less without them. `raw` is the text as typed, for echoing and
 * for names; `body` drops the underscores that follow a digit, which §5.7.1
 * ignores in a number only. In an identifier (§5.6) an underscore is part of the
 * name, so names and 1step are checked against `raw`.
 */
const stripDelaySyntax = (text: string): { raw: string; body: string; parenthesised: boolean } => {
  let t = text.trim();
  if (t.startsWith("#")) t = t.slice(1).trim();
  const parenthesised = t.startsWith("(") && t.endsWith(")");
  if (parenthesised) t = t.slice(1, -1).trim();
  // An underscore may follow a digit only: `_1` is an identifier, because unsigned_number starts with a digit (A.8.7).
  return { raw: t, body: t.replace(/(\d)_+/g, "$1"), parenthesised };
};

/**
 * A based number whose digits are all x or z (A.8.7: x_digit and z_digit, with ?
 * a z_digit). A decimal base takes one such digit. §5.7.1 lets white space stand
 * between the size and the apostrophe and between the base and the value
 * ("5 'D 3", "'h 837FF"), but not between the apostrophe and the base letter, and
 * asks only that the size be nonzero, so a leading zero is allowed (04'bx).
 */
const BASED_UNKNOWN = /^(?:0*[1-9]\d*\s*)?'[sS]?(?:[bBoOhH]\s*[xXzZ?][xXzZ?_]*|[dD]\s*[xXzZ?]_*)$/;
/**
 * Any based number of A.8.7, each base with its own digits: binary 0, 1, x, z, ?;
 * octal 0-7 and those; hex 0-9, a-f and those; decimal an unsigned_number or one
 * x or z digit. The size is nonzero (§5.7.1), and white space may stand where
 * BASED_UNKNOWN allows it. Underscores after a decimal digit were already removed.
 */
const BASED_ANY = /^(?:0*[1-9]\d*\s*)?'[sS]?(?:[bB]\s*[01xXzZ?][01xXzZ?_]*|[oO]\s*[0-7xXzZ?][0-7xXzZ?_]*|[hH]\s*[\da-fA-FxXzZ?][\da-fA-FxXzZ?_]*|[dD]\s*(?:\d+|[xXzZ?]_*))$/;
/** One based literal after §5.7.1 sizing. */
interface SizedLiteral {
  /** The size written before the apostrophe, or undefined for an unsized literal. */
  size?: number;
  signed: boolean;
  /** b, o and h: the bits that are left (most significant first, each 0, 1, x or z). Left padding is not written out; see sizeBasedLiteral. */
  bits?: string;
  /** The unsigned value when every bit is known, before the s designator is read. */
  value?: bigint;
  /** The value fills the size exactly, so its leftmost bit is the one the s designator reads as the sign. */
  fillsSize: boolean;
  /** The digits gave more bits than the size, so §5.7.1 dropped bits on the left. */
  truncated: boolean;
}

const DIGIT_BITS: Record<string, number> = { b: 1, o: 3, h: 4 };

/**
 * Applies §5.7.1 to a based literal that BASED_ANY accepted. An x or z sets 1, 3 or 4
 * bits by base. A value longer than the size is truncated from the left. A shorter one
 * is padded on the left with 0, or with x or z when its leftmost bit is x or z; that
 * padding changes neither the value nor which bits are known, so it is not written
 * out (a size can be large). An unsized literal has at least 32 bits and the width its
 * value needs, so it is never truncated.
 */
const sizeBasedLiteral = (t: string): SizedLiteral => {
  const m = /^(?:(\d+)\s*)?'([sS]?)([bBoOhHdD])\s*(.*)$/.exec(t);
  const none: SizedLiteral = { signed: false, fillsSize: false, truncated: false };
  if (!m) return none;
  const size = m[1] === undefined ? undefined : Number(m[1]);
  const signed = m[2] !== "";
  const base = m[3].toLowerCase();
  const digits = m[4].replace(/_/g, "").toLowerCase().replace(/\?/g, "z");
  let bits: string;
  if (base === "d") {
    // Only a decimal unsigned_number reaches here: a d with an x or z digit is all x or z, which BASED_UNKNOWN takes.
    bits = BigInt(digits).toString(2);
  } else {
    const width = DIGIT_BITS[base];
    bits = "";
    for (const d of digits) bits += d === "x" || d === "z" ? d.repeat(width) : parseInt(d, 16).toString(2).padStart(width, "0");
  }
  let truncated = false;
  if (size !== undefined && bits.length > size) {
    bits = bits.slice(bits.length - size);
    truncated = true;
  }
  const value = /[xz]/.test(bits) ? undefined : BigInt(`0b${bits}`);
  return { size, signed, bits: base === "d" ? undefined : bits, value, fillsSize: size !== undefined && bits.length === size, truncated };
};

/** unbased_unsized_literal 'x or 'z (Syntax 5-2). */
const UNBASED_UNKNOWN = /^'[xXzZ]$/;
/** unbased_unsized_literal '0 or '1 (Syntax 5-2). */
const UNBASED_KNOWN = /^'[01]$/;
/** simple_identifier (§5.6, A.9.3): a letter or _, then letters, digits, _ and $. */
const SIMPLE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_$]*$/;
/** real_number in scientific notation (A.8.7, §5.7.2): unsigned_number [ . unsigned_number ] exp [ sign ] unsigned_number. */
const SCIENTIFIC = /^(\d+)(?:\.(\d+))?[eE]([+-]?)(\d+)$/;
/** The largest magnitude a 64-bit two's-complement value holds; §9.4.1 sizes the result like a time variable. */
const TWO_POW_63 = pow2(63);
/** A plain decimal, with or without a time unit: the forms the lab computes. */
const PLAIN_DELAY = /^(\d+)(?:\.(\d+))?(s|ms|us|ns|ps|fs)?$/;

/**
 * Why text that starts with a minus and has no parentheses is turned away. Any such
 * text is illegal: delay_value has no unary minus (A.2.2.3), and the other form
 * of delay_control starts with a parenthesis (A.6.5). The fix is offered, echoing
 * the text as typed, only when the operand is one primary the lab can name (a
 * number, a time literal, a based or unbased literal, a simple identifier), so
 * that the suggestion is itself a legal delay.
 */
const minusNeedsParentheses = (raw: string): string => {
  const rawOperand = raw.replace(/^-\s*/, "");
  const operand = rawOperand.replace(/(\d)_+/g, "$1");
  const onePrimary =
    PLAIN_DELAY.test(operand) || SCIENTIFIC.test(operand) || BASED_ANY.test(operand) || UNBASED_UNKNOWN.test(operand) || UNBASED_KNOWN.test(operand) || SIMPLE_IDENTIFIER.test(rawOperand);
  return `A delay_value has no unary minus (A.2.2.3), so a delay written with one needs parentheses (§9.4, A.6.5)${onePrimary ? `: write #(${raw})` : ""}.`;
};

/** A parenthesised negative real or time literal: §9.4.1 covers it, but the lab computes only whole numbers. */
const NEGATIVE_REAL_OR_LITERAL =
  "A negative real or time-literal delay is outside this lab. §9.4.1 reinterprets a delay expression that evaluates to a negative value, but the lab shows that only for whole numbers such as #(-1).";

/** 1step written in parentheses: 1step is a delay_value alternative only (A.2.2.3), not a primary (A.8.4), so no expression can hold it. */
const ONE_STEP_IN_PARENTHESES =
  "1step takes no parentheses: it appears in the grammar only as a delay_value (A.2.2.3), and it is not a primary (A.8.4), so no parenthesised expression can hold it. #1step is legal, but a step equals the global precision (§3.14.3), which depends on the whole design, so it is outside this lab.";

/** Why a real in scientific notation is turned away: it is legal, and the lab offers its plain decimal form when the exponent is small. `t` is the text as typed. */
const scientificReason = (t: string, m: RegExpExecArray): string => {
  const frac = m[2] ?? "";
  const exponent = Number(m[4]);
  let plain = " Write it as a plain decimal instead.";
  if (exponent <= 30) {
    const digits = BigInt(`${m[1]}${frac}`);
    const value = m[3] === "-" ? { num: digits, den: pow10(frac.length + exponent) } : { num: digits * pow10(exponent), den: pow10(frac.length) };
    plain = ` Write it as #${rationalToDecimal(value)} instead.`;
  }
  return `${t} is a real number in scientific notation, a legal delay_value (A.2.2.3, A.8.7), but this lab reads only plain decimals, so it is outside this lab.${plain}`;
};

/**
 * Parses "#2.75", "2.1ns", "#(1'bx)", "#('z)", "#(-1)". Decimal digits only;
 * nothing is converted to a float. Anything else is invalid with a reason, so the
 * lab never renders it as code. The reason says which case it is, and echoes the
 * text as typed:
 * - a form the grammar does not accept says why: a minus without parentheses
 *   (delay_value has no unary minus, A.2.2.3), a based or an unbased unsized
 *   literal without parentheses, a bare x or ?, 1step in parentheses, a space
 *   before a time unit;
 * - a legal form this lab does not compute says it is outside this lab: a based
 *   number with known digits, scientific notation, a name, #1step, and a
 *   parenthesised negative real or time literal with a nonzero value;
 * - any other text gets the list of forms the lab computes, without a verdict on
 *   its legality: an expression such as #(-a) or #(-1'bx), whose value the lab
 *   does not evaluate, or #(-0.0), which is not negative.
 */
export function parseDelay(text: string): ParsedDelay {
  const { raw, body: t, parenthesised } = stripDelaySyntax(text);
  const invalid = (reason: string): ParsedDelay => ({ kind: "invalid", text, reason });
  if (t.startsWith("-")) {
    if (!parenthesised) return invalid(minusNeedsParentheses(raw));
    const neg = /^-\s*(\d+)$/.exec(t);
    if (neg) {
      const written = BigInt(neg[1]);
      if (written === ZERO) return { kind: "number", text, digits: ZERO, den: ONE };
      if (written > TWO_POW_63) return invalid("That magnitude does not fit a 64-bit two's-complement value, so it is outside this lab (§9.4.1 sizes the result like a time variable).");
      return { kind: "negative", text, written: -written, asUnsigned: TWO_POW_64 - written };
    }
    // A real or a time literal whose value is below zero. Anything else (an x or z operand, a name, a nested expression, -0.0) has no value the lab can call negative.
    const negReal = /^-\s*(\d+)(?:\.(\d+))?(s|ms|us|ns|ps|fs)?$/.exec(t);
    if (negReal && /[1-9]/.test(`${negReal[1]}${negReal[2] ?? ""}`)) return invalid(NEGATIVE_REAL_OR_LITERAL);
    return invalid(WRITE_A_DELAY);
  }
  if (BASED_ANY.test(t) || UNBASED_UNKNOWN.test(t) || UNBASED_KNOWN.test(t)) {
    if (!parenthesised) {
      // §5.7.1 writes '0, '1, 'x and 'z "with an apostrophe ('), but without the base specifier"; A.8.4 and A.8.7 list them apart from based numbers.
      const what = BASED_ANY.test(t) ? "a based literal (A.2.2.3)" : "an unbased unsized literal (§5.7.1; not in A.2.2.3)";
      return invalid(`A delay_value cannot be ${what}, so this one needs parentheses (§9.4, A.6.5): write #(${raw}).`);
    }
    if (BASED_UNKNOWN.test(t) || UNBASED_UNKNOWN.test(t)) return { kind: "xz", text };
    if (UNBASED_KNOWN.test(t)) {
      // §5.7.1: every bit of '0 or '1 is set to that bit, and its width is 1 bit only in a self-determined context. '0 is zero at any width; '1 is not one number.
      const advice =
        t === "'0"
          ? "Its value is 0 at any width, so write #0 instead."
          : "Every bit of '1 is 1 and its width comes from its context (§5.7.1); this lab does not decide that width for a delay, so it offers no plain number for it.";
      return invalid(
        `#(${raw}) is a legal delay: an unbased unsized literal (§5.7.1, A.8.4) in parentheses (A.6.5). This lab computes only the x and z ones, which §9.4.1 makes zero, so this one is outside this lab. ${advice}`,
      );
    }
    // §5.7.1 sizes the digits first: a sized literal is padded or truncated on the left, so the bits that reach the delay decide whether it is known.
    const sized = sizeBasedLiteral(t);
    const sizeNote = sized.truncated ? ` Its digits give more than ${sized.size} bit${sized.size === 1 ? "" : "s"}, so §5.7.1 truncates it from the left to ${sized.size}.` : "";
    if (sized.bits !== undefined && /^[xz]+$/.test(sized.bits)) {
      // Reached only through truncation: an all-x/z digit string was taken by BASED_UNKNOWN above.
      return { kind: "xz", text, sizing: `${sizeNote.trim()} Every bit left is x or z.` };
    }
    const legal = `#(${raw}) is a legal delay: an integer literal (A.8.7) in parentheses (A.6.5). This lab computes such a literal only when every bit, after §5.7.1 sizing, is x or z, which §9.4.1 makes zero, so this one is outside this lab.${sizeNote}`;
    if (sized.value === undefined) {
      return invalid(
        `${legal} Some of its bits are x or z and some are known, so its value is partly unknown and has no plain-number form. §9.4.1 makes a delay that evaluates to an unknown or high-impedance value zero; this lab does not decide how that applies to a partly unknown value.`,
      );
    }
    const unsignedValue = sized.value;
    // §5.7.1: the s designator changes only the interpretation, as two's complement. Its sign is the leftmost bit of the sized value; a padded one starts with 0.
    if (sized.signed && sized.fillsSize && sized.size !== undefined && unsignedValue >> BigInt(sized.size - 1) === ONE) {
      const value = unsignedValue - (ONE << BigInt(sized.size));
      return invalid(
        `${legal} The s marks it signed, and §5.7.1 reads a signed literal as two's complement, so as a ${sized.size}-bit value it is ${value}. A negative delay falls under §9.4.1, but this lab does not decide how a ${sized.size}-bit signed value is widened to the size of a time variable, so it offers no plain number for it; #(${value}) is the nearest form the lab computes.`,
      );
    }
    if (unsignedValue >= TWO_POW_64) return invalid(`${legal} Its value is ${unsignedValue}, 2^64 or more, more than a 64-bit time variable (§6.11) can count, so the lab offers no plain number for it.`);
    return invalid(`${legal} Its value is ${unsignedValue}, so write #${unsignedValue} instead.`);
  }
  if (/^[xXzZ]+$/.test(t)) {
    // Offer the literal the learner meant: z only gives 1'bz, anything with an x gives 1'bx. Both are zero by §9.4.1.
    const literal = /[xX]/.test(t) ? "1'bx" : "1'bz";
    return invalid(`A bare ${raw} is not an unknown value. x and z digits exist only inside a based number (A.8.7), so here it would name an identifier (§5.6). Write #(${literal}).`);
  }
  if (/^[xXzZ?]+$/.test(t)) {
    // An escaped identifier (§5.6.1) can hold a ?, but it starts with a backslash; a simple identifier cannot.
    return invalid(`A bare ${raw} is not a legal delay. ? is a z_digit (A.8.7) only inside a based number, and no simple identifier can contain it (§5.6). Write #(1'bz).`);
  }
  const m = PLAIN_DELAY.exec(t);
  if (!m) {
    if (/^\d+(?:\.\d+)?\s+(?:s|ms|us|ns|ps|fs)$/.test(t)) return invalid("A time literal has no space before its unit (§5.8): write it as 5ns, not 5 ns.");
    const sci = SCIENTIFIC.exec(t);
    if (sci) return invalid(scientificReason(raw, sci));
    // 1step and names are checked as typed: §5.7.1 ignores underscores only in numbers, so 1_step is not 1step and d1_ns is not d1ns.
    if (raw === "1step") {
      if (parenthesised) return invalid(ONE_STEP_IN_PARENTHESES);
      return invalid("1step is in the delay_value grammar (A.2.2.3), and a step equals the global precision (§3.14.3), which depends on the whole design. This lab rounds one element's delay, so 1step is outside this lab.");
    }
    if (SIMPLE_IDENTIFIER.test(raw)) return invalid(`If ${raw} names a parameter or a variable, it is a legal delay (A.2.2.3, A.6.5), but this lab has no declaration for it, so it is outside this lab. ${WRITE_A_DELAY}`);
    return invalid(WRITE_A_DELAY);
  }
  const frac = m[2] ?? "";
  const digits = BigInt(`${m[1]}${frac}`);
  const den = pow10(frac.length);
  if (m[3]) return { kind: "literal", text, digits, den, literalUnit: m[3] as TimeUnitName };
  if (digits >= TWO_POW_64 * den) return invalid(OUTSIDE_64_BITS);
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
 * The wake time of a parsed delay: its size in the element's unit, on the grid
 * of the element's own precision (3.14.1), the nearest tick (22.7). The model
 * scales and then rounds to the precision's ticks; the steps also show 22.7's
 * order, round and then scale, which gives the same result. At an exact half
 * tick both tie rules are computed; when they disagree the result is marked
 * tool-dependent, because 3.14.1 states no tie rule. A delay whose wake reaches
 * 2^64 units, before or after rounding, is outside the lab.
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
        ...(input.sizing ? [input.sizing] : []),
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
  // A literal's size in units depends on the unit, so parseDelay cannot check it.
  if (scaledFs.num >= TWO_POW_64 * unitFs * scaledFs.den) return { ...base, error: OUTSIDE_64_BITS };
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
    steps.push(`${tickCount(rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * precisionFs }))} of the ${formatScale(precision)} precision: a whole number, so no rounding is needed (§3.14.1). Wake at ${show(wake)}.`);
    return { ...base, scaledFs, scaledInUnits, scaledText, ticks: { down: t.down, up: t.up, exactHalf: false }, candidatesFs: [wake], wakeFs: wake, steps };
  }
  // Rounding can carry a value just below 2^64 units up to it.
  const fits = (fs: bigint) => fs < TWO_POW_64 * unitFs;
  /**
   * 22.7 lists the steps as round, then scale; the model scales, then rounds to
   * the precision's ticks. Neither 3.14.1 nor 22.7 makes an order a rule, and the
   * precision is relative to the unit (3.14.1), so both give these wake times.
   */
  const placesText = (() => {
    const k = log10OfPowerOfTen(unitFs / precisionFs);
    return k === 0 ? "a whole number" : k === 1 ? "one decimal place" : `${k} decimal places`;
  })();
  /** Each candidate gets its own product, and "in either order" names the order, never the tie rules, which may disagree. */
  const roundThenScale = (wakes: bigint[]): string => {
    const inUnits = wakes.map((w) => rationalToDecimal({ num: w, den: unitFs }));
    const products = wakes.map((w, i) => `${inUnits[i]} × ${formatScale(unit)} is ${show(w)}`).join(", or ");
    return `§22.7 lists the steps as round, then scale: ${scaledInUnits} rounded to ${placesText} is ${inUnits.join(" or ")}, and ${products}. ${wakes.length > 1 ? "Each wake time" : "The wake time"} is the same in either order, because the precision is relative to the unit (§3.14.1).`;
  };
  const tickText = rationalToDecimal({ num: scaledFs.num, den: scaledFs.den * precisionFs });
  if (t.exactHalf) {
    const awayFromZero = t.down + ONE;
    const toEven = t.down % TWO === ZERO ? t.down : t.down + ONE;
    const tie: TieResult = { awayFromZero, toEven, agree: awayFromZero === toEven };
    const candidates = tie.agree ? [awayFromZero * precisionFs] : [toEven * precisionFs, awayFromZero * precisionFs];
    if (!candidates.every(fits)) return { ...base, error: OUTSIDE_64_BITS };
    steps.push(`${tickCount(tickText)} of the ${formatScale(precision)} precision: exactly half way between ${t.down.toString()} and ${(t.down + ONE).toString()}.`);
    if (tie.agree) {
      steps.push(
        `Half away from zero gives ${awayFromZero.toString()}; half to even also gives ${toEven.toString()}: both rules this lab computes agree. Wake at ${show(candidates[0])} (§3.14.1; the standard's own example rounds 2.75 ns to 2.8 ns the same way).`,
      );
    } else {
      steps.push(
        `Half away from zero gives ${tickCount(awayFromZero)} (${show(awayFromZero * precisionFs)}); half to even gives ${tickCount(toEven)} (${show(toEven * precisionFs)}). §3.14.1 states no tie rule, so the result is tool-dependent.`,
      );
    }
    steps.push(roundThenScale(candidates));
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
  if (!fits(wake)) return { ...base, error: OUTSIDE_64_BITS };
  steps.push(
    `${tickCount(tickText)} of the ${formatScale(precision)} precision: nearer to ${nearest.toString()} than to ${(t.above ? t.down : t.down + ONE).toString()}, so it rounds to the nearest tick, ${tickCount(nearest)} (§3.14.1, §22.7).`,
  );
  steps.push(
    wake === ZERO
      ? `Wake at 0 (§3.14.1). With no time left to wait, the statement runs in the same time slot. A finer precision elsewhere in the design does not change this.`
      : `Wake at ${show(wake)}${precision.unit === unit.unit ? "" : ` = ${formatFsIn(wake, precision.unit)}`}. A finer precision elsewhere in the design does not change this (§3.14.1).`,
  );
  steps.push(roundThenScale([wake]));
  return { ...base, scaledFs, scaledInUnits, scaledText, ticks: { down: t.down, up: t.down + ONE, exactHalf: false }, candidatesFs: [wake], wakeFs: wake, steps };
}

/** "1 tick", "28 ticks", "27.5 ticks". */
export function tickCount(n: bigint | string): string {
  const text = n.toString();
  return `${text} ${text === "1" ? "tick" : "ticks"}`;
}

/**
 * True when num/den (den a power of ten) has an exact binary form: once the
 * fraction is reduced, no factor 5 is left in the denominator. 0.5 and 2.75 do;
 * 2.85 and 0.15 do not. Exact BigInt arithmetic.
 */
export function exactInBinary(r: Rational): boolean {
  const FIVE = BigInt(5);
  let { num, den } = r;
  while (den % FIVE === ZERO && num % FIVE === ZERO) {
    num /= FIVE;
    den /= FIVE;
  }
  return num === ZERO || den % FIVE !== ZERO;
}

/**
 * For a tool-dependent half tick whose value in units has no exact binary form:
 * the lab's own reasoning, labelled as such, that a tool holding the value as an
 * IEEE 754 double may not see a half tick at all. A real literal is one by 5.7.2;
 * a time literal is a realtime value scaled to the current unit (5.8), and
 * realtime is real, a C double represented as IEEE 754 describes (6.12). Null
 * otherwise, so an exact tie such as #0.5 at 1ns/1ns carries no such remark.
 */
export function binaryRemark(r: RoundedDelay): string | null {
  if (!r.toolDependent || !r.scaledFs || r.scaledInUnits === null) return null;
  if (exactInBinary({ num: r.scaledFs.num, den: r.scaledFs.den * scaleToFs(r.unit) })) return null;
  const held =
    r.input.kind === "literal"
      ? "a time literal is a realtime value scaled to the current unit (§5.8), held as an IEEE 754 double (§6.12)"
      : "a real literal is held as an IEEE 754 double (§5.7.2)";
  return `The lab's reasoning, not a rule of the standard: ${held}, and ${r.scaledInUnits} has no exact binary form, so a simulator that rounds the double may not see a half tick here at all.`;
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
 * How many of `repeats` consecutive copies of the delay can be listed: a wake is
 * listed only while its total stays below 2^64 of the element's units (every
 * tie candidate included). A later wake would pass the 64 bits of a time
 * variable (9.4.1 sizes a negative delay like one; §6.11/§20.3.1 make time and
 * $time 64-bit, and $time counts in the caller's unit), and the sources give no
 * rule for time at or beyond 2^64 units, whether the delay was written as a
 * negative or a positive number.
 */
export function wakesBelow64Bits(r: RoundedDelay, repeats: number): number {
  if (r.error || r.candidatesFs.length === 0) return 0;
  const limit = TWO_POW_64 * scaleToFs(r.unit);
  let k = 0;
  while (k < repeats && r.candidatesFs.every((c) => c * BigInt(k + 1) < limit)) k += 1;
  return k;
}

/**
 * The clause after a first wake time when the delay runs again: nothing for a
 * delay that is zero or effectively forever, or whose second wake would pass 64
 * bits of time, and no number for a tool-dependent tie, because none of them has
 * a sensible "every N more".
 */
export function thenEveryText(r: RoundedDelay, repeats: number): string {
  if (repeats <= 1 || r.special || r.wakeFs === ZERO) return "";
  const listed = wakesBelow64Bits(r, repeats);
  if (listed <= 1) return "";
  const whileBelow = listed < repeats ? ", while the total stays below 2^64 units" : "";
  if (r.wakeFs === null) return `, then the same delay again${whileBelow}`;
  return `, then every ${wakeText(r)} more${whileBelow}`;
}

/**
 * Wake times of `repeats` consecutive copies of the same delay from t = 0.
 * Each delay is rounded on its own (3.14.1), so the k-th wake is k times the
 * rounded delay: 22.7's own example wakes at 16 ns and 32 ns, rounded to the
 * nearest 1 ns. With a tool-dependent tie both candidates are listed. Only the
 * wakes below 2^64 units are listed (see wakesBelow64Bits).
 */
export function repeatedWakes(r: RoundedDelay, repeats: number): { k: number; candidatesFs: bigint[] }[] {
  const out: { k: number; candidatesFs: bigint[] }[] = [];
  const last = wakesBelow64Bits(r, repeats);
  for (let k = 1; k <= last; k += 1) out.push({ k, candidatesFs: r.candidatesFs.map((c) => c * BigInt(k)) });
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

/** True when the scaled delay is already a whole number of precision ticks, so nothing is rounded. */
const onTick = (r: RoundedDelay): boolean => r.ticks !== null && !r.ticks.exactHalf && r.ticks.down === r.ticks.up;

/** "2.75 × 1ns", or "5ns = 5000 × 1ps" for a time literal, which the unit does not scale but converts (5.8). */
const valueTimesUnit = (r: RoundedDelay): string => {
  const product = `${r.scaledInUnits} × ${formatScale(r.unit)}`;
  return r.input.kind === "literal" ? `${rationalToDecimal({ num: r.input.digits, den: r.input.den })}${r.input.literalUnit} = ${product}` : product;
};

/** Why the correct wake time holds, without claiming a rounding that did not happen. */
const roundedFeedback = (r: RoundedDelay): string => {
  const precName = formatScale(r.precision);
  if (r.wakeFs === ZERO) {
    return onTick(r)
      ? `${valueTimesUnit(r)} is zero, so there is nothing to wait for and the statement runs in the same time slot.`
      : `${valueTimesUnit(r)} rounds to 0 at the ${precName} precision (§3.14.1). With no time left to wait, the statement runs in the same time slot.`;
  }
  return onTick(r)
    ? `${valueTimesUnit(r)} is ${r.scaledText}, already on a tick of the ${precName} precision, so no rounding is needed (§3.14.1).`
    : `${valueTimesUnit(r)} is rounded to the element's own ${precName} precision (§3.14.1).`;
};

/** How the time unit and the precision act on this delay: a time literal is converted once, not scaled by the number. */
const oneScaling = (r: RoundedDelay): string =>
  r.input.kind === "literal"
    ? `A time literal is converted to the current unit once (§5.8) and the ${formatScale(r.precision)} precision only rounds it (§3.14.1); nothing multiplies the result by ten.`
    : `The ${formatScale(r.unit)} unit scales the number once and the ${formatScale(r.precision)} precision only rounds it (§3.14, §3.14.1); nothing multiplies the result by ten.`;

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
      feedback: `${valueTimesUnit(r)} is exactly half way between two ${precName} ticks, and §3.14.1 states no tie rule: half away from zero and half to even disagree, so the result is tool-dependent.`,
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
      feedback: roundedFeedback(r),
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
        feedback: "That truncates. The precision rounds delays to the nearest tick (§22.7; §3.14.1 rounds 2.75 ns up to 2.8 ns), it does not cut them.",
      },
      truncated,
    );
    const ceiled = r.ticks.up * precFs;
    offer(
      {
        id: "ceiled",
        label: formatFsIn(ceiled, pUnit),
        correct: false,
        feedback: "That rounds up. The precision rounds to the nearest tick (§3.14.1, §22.7); a value below the half tick goes down.",
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
        feedback: `A time literal carries its own unit and is converted to the current unit where it is written (§5.8), so ${rationalToDecimal({ num: r.input.digits, den: r.input.den })}${r.input.literalUnit} is the same value before rounding in every module; each module's own precision then rounds it (§3.14.1).`,
      },
      misread.den === ONE ? misread.num : undefined,
    );
  }
  // Input-independent distractors keep the prediction a real choice when the
  // misconceptions above collapse onto the answer (a whole-number delay with
  // unit = precision offers nothing else). Added until four options exist.
  const wakeRef = r.candidatesFs[r.candidatesFs.length - 1] ?? ZERO;
  const pads: { fs: bigint | null; option: LabOption }[] = [
    // Offered only when 0 is no candidate (`used` holds the candidates), so the scaled delay is more than half a tick: no tie rule is needed to say so.
    { fs: ZERO, option: { id: "same-slot", label: `0 ${pUnit}`, correct: false, feedback: `${r.scaledText} is more than half a ${precName} tick, so rounding to the nearest tick (§22.7) cannot reach 0.` } },
    { fs: wakeRef + precFs, option: { id: "step-later", label: formatFsIn(wakeRef + precFs, pUnit), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step added to it (§3.14.1). ${r.scaledText} rounds to the nearest ${precName} tick (§22.7).` } },
    { fs: wakeRef * TEN, option: { id: "ten-x", label: formatFsIn(wakeRef * TEN, pUnit), correct: false, feedback: oneScaling(r) } },
    { fs: wakeRef - precFs, option: { id: "step-earlier", label: formatFsIn(wakeRef > precFs ? wakeRef - precFs : ZERO, pUnit), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step taken from it (§3.14.1). ${r.scaledText} rounds to the nearest ${precName} tick (§22.7).` } },
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
 * module ("13 ns, then 26 ns"). Every option lists the same number of wakes:
 * those below 2^64 units (wakesBelow64Bits). `contrast` gives another module
 * whose own rounding of the same delay serves as the "mixed up the modules"
 * distractor; its feedback never names that module or confirms the value, since
 * the other module's prompt may still be open.
 */
export function wakeSequenceOptions(r: RoundedDelay, repeats: number, contrast?: { name: string; unit: TimeScale; precision: TimeScale }): LabOption[] {
  if (r.error || r.candidatesFs.length === 0 || r.input.kind === "xz" || r.input.kind === "negative" || r.input.kind === "invalid") return roundingOptions(r);
  const unit = r.unit.unit;
  const listed = Math.max(1, wakesBelow64Bits(r, repeats));
  const seqOf = (wakes: bigint[]) => wakes.map((fs) => formatFsIn(fs, unit)).join(", then ");
  const seq = (fs: bigint) => seqOf(Array.from({ length: listed }, (_, i) => fs * BigInt(i + 1)));
  const precName = formatScale(r.precision);
  const delayText = `#${r.input.text.trim().replace(/^#/, "")}`;
  const options: LabOption[] = [];
  if (r.toolDependent && r.candidatesFs.length === 2) {
    options.push({ id: "tie", label: `${seq(r.candidatesFs[0])} or ${seq(r.candidatesFs[1])} (tool-dependent)`, correct: true, feedback: `${valueTimesUnit(r)} sits exactly half way between two ${precName} ticks and §3.14.1 states no tie rule.` });
  } else if (r.wakeFs !== null) {
    options.push({
      id: "rounded",
      label: seq(r.wakeFs),
      correct: true,
      feedback: onTick(r)
        ? `${delayText} is ${r.scaledText}, already on a tick of the module's own ${precName} precision, so no rounding is needed (§3.14.1).`
        : `${delayText} is ${r.scaledText}; the module's own ${precName} precision rounds it to ${formatFsIn(r.wakeFs, unit)} each time it runs (§3.14.1, §22.7).`,
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
  // Rounding the running total instead of each delay: it differs from the answer only from the second wake on.
  // A running total at an exact half tick has no single rounding when the tie rules disagree (§3.14.1 states none),
  // and half to even can then land on the answer itself (#0.125 twice at 10ns/1ns: 2.5 ticks), so the option is left out.
  if (listed >= 2 && r.wakeFs !== null && r.scaledFs) {
    const scaled = r.scaledFs;
    const totalTicks = Array.from({ length: listed }, (_, i) => ticksOf({ num: scaled.num * BigInt(i + 1), den: scaled.den }, precFs));
    const tieRulesAgree = totalTicks.every((t) => !t.exactHalf || t.down % TWO !== ZERO);
    const totals = totalTicks.map((t) => (t.exactHalf || t.above ? t.down + ONE : t.down) * precFs);
    const label = seqOf(totals);
    if (tieRulesAgree && label !== options[0]?.label) {
      options.push({
        id: "running-total",
        label,
        correct: false,
        feedback: `That rounds the running total. Each ${delayText} is rounded on its own when it runs, then added, so the k-th wake is k times the rounded delay (§3.14.1). §22.7's own example, #d twice with d = 1.55 at 10ns/1ns, wakes at 16 ns and 32 ns; rounding the running totals 15.5 ns and 31 ns would give 16 ns and 31 ns.`,
      });
    }
  }
  if (contrast) {
    const other = roundDelay(r.input, contrast.unit, contrast.precision);
    if (other.wakeFs !== null) {
      offer(
        {
          id: "other-module",
          label: seq(other.wakeFs),
          correct: false,
          feedback:
            r.input.kind === "literal"
              ? `Only this module's own ${precName} precision rounds the delay it runs (§3.14.1). A time literal is the same value before rounding in every module (§5.8); the other module's settings play no part here.`
              : `Only this module's own unit and precision decide its wake time: the ${formatScale(r.unit)} unit sets the size of the delay and the ${precName} precision rounds it (§3.14, §3.14.1). The other module's settings play no part here.`,
        },
        other.wakeFs,
      );
    }
  }
  if (r.ticks) {
    const truncated = r.ticks.down * precFs;
    if (truncated !== ZERO) offer({ id: "truncated", label: seq(truncated), correct: false, feedback: "That truncates. The precision rounds to the nearest tick (§3.14.1, §22.7)." }, truncated);
  }
  // Input-independent distractors, so a whole-number delay still gets a real choice.
  const wakeRef = r.candidatesFs[r.candidatesFs.length - 1];
  const pads: { fs: bigint; option: LabOption }[] = [
    { fs: wakeRef + precFs, option: { id: "step-later", label: seq(wakeRef + precFs), correct: false, feedback: `The precision is the grid the delay is rounded to, not a step added to it (§3.14.1).` } },
    { fs: wakeRef * TEN, option: { id: "ten-x", label: seq(wakeRef * TEN), correct: false, feedback: oneScaling(r) } },
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
 * Orders the options by a shuffle seeded from their labels, which one is
 * correct, and `seed` (pass the prompt's reset key). Labels alone are constant
 * in the which-unit and global-precision labs, so the answer would sit in one
 * slot whatever the state. Every option moves, not only the correct one, so no
 * option stands out as the one out of its usual order. Deterministic, so the
 * server and client renders agree.
 */
export function arrangeOptions<T extends { id: string; label: string; correct: boolean }>(options: readonly T[], seed = ""): T[] {
  const out = [...options];
  if (out.length < 2) return out;
  const key = `${out.map((o) => o.label).join("|")}#${out.find((o) => o.correct)?.id ?? ""}#${seed}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  // Spread a change in the seed's last characters over every bit before the shuffle draws from them.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
  { id: "xz", label: "#(1'bx) at 1ns/100ps", delay: "#(1'bx)", unit: scale(1, "ns"), precision: scale(100, "ps"), source: "A delay expression that evaluates to x.", note: "x or z delays are zero (§9.4.1)." },
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
  /** The specifiers the lab prints. A plain %d is left out: §21.2.1.2 sizes it from the expression, and no line here uses it. */
  spec: "%0d" | "%t" | "%0t" | `%.${number}f`;
}

export interface ReadTimeCaller {
  /** The instance or scope name used in the prompts and the log. */
  name: string;
  /** The name in the generated code, when it differs from `name`. */
  moduleName?: string;
  /** A comment on the generated module line. */
  moduleComment?: string;
  /** Lines of the module body before its initial block, for example an instantiation. */
  body?: readonly string[];
  unit: TimeScale;
  precision: TimeScale;
  steps: readonly ReadTimeStep[];
}

/** One moment is one $display: what the learner predicts, a line of the log. */
export interface ReadTimeSnapshot {
  caller: string;
  unit: TimeScale;
  precision: TimeScale;
  /** The caller's last delay, or null for a print before any delay. */
  afterDelay: RoundedDelay | null;
  /** 1 after the caller's first delay, 2 after its second, and so on. */
  delayOrdinal: number;
  readings: TimeReadings;
  /** The $timeformat in force at this moment (null: never called). */
  format: TimeFormat | null;
  template: string;
  args: readonly DisplayArg[];
  /** The line of readTimeCode that prints at this moment, and the delay line that led to it. */
  lineKey: string;
  delayKey: string | null;
  /** What the run did not settle on the way to this moment, such as a tool-dependent half tick. Shown only in its reveal. */
  notes: string[];
}

export interface ReadTimeLine {
  caller: string;
  absFs: bigint;
  text: string;
  /** %t had no format and the build has no `timescale: the units are tool-dependent. */
  toolDependent: boolean;
  /** Index into `snapshots` of the moment that prints this line. */
  momentIndex: number;
}

export interface ReadTimeTrace {
  snapshots: ReadTimeSnapshot[];
  lines: ReadTimeLine[];
  /** What stops the source from running: then there are no moments and no log. Each message once. */
  errors: string[];
  /** Every moment's notes. Each message once. */
  notes: string[];
}

/** The effective $timeformat: the last call, else Table 20-3 defaults (null when the units are tool-dependent). */
export function effectiveFormat(format: TimeFormat | null, build: Build): TimeFormat | null {
  if (format) return format;
  const units = defaultTimeformatUnits(build);
  if (!units) return null;
  return { units: scaleExponent(units), ...TIMEFORMAT_DEFAULTS };
}

const TOOL_DEPENDENT = "<tool-dependent>";

/** How each format specifier of a $display fills in. The distractors override one of these. */
interface DisplayValues {
  int: (fn: DisplayArg["fn"]) => string;
  fixed: (fn: DisplayArg["fn"], digits: number) => string;
  t: (fn: DisplayArg["fn"], zeroWidth: boolean) => string;
}

const fnFs = (readings: TimeReadings, unit: TimeScale, fn: DisplayArg["fn"]): bigint =>
  fn === "realtime" ? readings.absFs : (fn === "time" ? readings.time : readings.stime) * scaleToFs(unit);

function trueValues(readings: TimeReadings, unit: TimeScale, fmt: TimeFormat | null): DisplayValues {
  return {
    int: (fn) => (fn === "time" ? readings.time : fn === "stime" ? readings.stime : realToInteger(readings.realtime).value).toString(),
    fixed: (fn, digits) => rationalToDecimal(fn === "realtime" ? readings.realtime : { num: fn === "time" ? readings.time : readings.stime, den: ONE }, digits),
    t: (fn, zeroWidth) => (fmt ? formatPercentT(fnFs(readings, unit, fn), fmt, zeroWidth) : TOOL_DEPENDENT),
  };
}

/** Fills a $display template. Unknown specifiers stay as written. */
function fillTemplate(template: string, args: readonly DisplayArg[], values: DisplayValues): string {
  let i = 0;
  return template.replace(/%%|%0d|%0?t|%\.\d+f/g, (spec) => {
    if (spec === "%%") return "%";
    const arg = args[i];
    i += 1;
    if (!arg) return spec;
    if (spec === "%t" || spec === "%0t") return values.t(arg.fn, spec === "%0t");
    const f = /^%\.(\d+)f$/.exec(spec);
    if (f) return values.fixed(arg.fn, Number(f[1]));
    return values.int(arg.fn);
  });
}

/** Renders one $display template with the readings of the moment. */
export function renderDisplay(template: string, args: readonly DisplayArg[], readings: TimeReadings, unit: TimeScale, format: TimeFormat | null, build: Build): { text: string; toolDependent: boolean } {
  const text = fillTemplate(template, args, trueValues(readings, unit, effectiveFormat(format, build)));
  return { text, toolDependent: text.includes(TOOL_DEPENDENT) };
}

const isPercentT = (arg: DisplayArg) => arg.spec === "%t" || arg.spec === "%0t";

/**
 * Runs every caller's script from t = 0 and merges the events by time. The
 * $timeformat state is global (20.4.3: one call governs every %t in the design
 * until the next call). At equal times, callers run in array order, which is a
 * choice of this model, not a rule of the standard. Each $display is one moment.
 * Source with an error cannot run, so it has no moments and no log, however many
 * of its lines are fine.
 */
export function runReadTime(callers: readonly ReadTimeCaller[], build: Build, initialFormat: TimeFormat | null = null): ReadTimeTrace {
  interface Event {
    atFs: bigint;
    order: number;
    callerIndex: number;
    step: ReadTimeStep;
    afterDelay: RoundedDelay | null;
    notes: string[];
  }
  const events: Event[] = [];
  const errors = new Set<string>();
  const notes = new Set<string>();
  callers.forEach((caller, callerIndex) => {
    let now = ZERO;
    let lastDelay: RoundedDelay | null = null;
    const notesSoFar: string[] = [];
    caller.steps.forEach((step, order) => {
      if (step.kind === "delay") {
        const r = roundDelayText(step.delay, caller.unit, caller.precision);
        if (r.error) {
          errors.add(`${caller.name}: ${r.error}`);
          return;
        }
        if (r.wakeFs === null) {
          const note = `${caller.name}: #${step.delay.replace(/^#/, "")} sits on a tool-dependent half tick; the lab uses the half-to-even value for the timeline.`;
          notes.add(note);
          if (!notesSoFar.includes(note)) notesSoFar.push(note);
          now += r.candidatesFs[0];
        } else now += r.wakeFs;
        if (readTime(now, caller.unit).time >= TWO_POW_64) errors.add(`${caller.name}: this run passes the 64 bits of a time variable. The sources give no rule for time beyond that, so it is outside this lab.`);
        lastDelay = r;
        events.push({ atFs: now, order, callerIndex, step, afterDelay: r, notes: [...notesSoFar] });
      } else events.push({ atFs: now, order, callerIndex, step, afterDelay: lastDelay, notes: [...notesSoFar] });
    });
  });
  if (errors.size > 0) return { snapshots: [], lines: [], errors: Array.from(errors), notes: [] };
  events.sort((a, b) => (a.atFs === b.atFs ? (a.callerIndex === b.callerIndex ? a.order - b.order : a.callerIndex - b.callerIndex) : a.atFs < b.atFs ? -1 : 1));
  let format = initialFormat;
  const snapshots: ReadTimeSnapshot[] = [];
  const lines: ReadTimeLine[] = [];
  const delaysSoFar: number[] = callers.map(() => 0);
  const lastDelayKey: (string | null)[] = callers.map(() => null);
  for (const e of events) {
    const caller = callers[e.callerIndex];
    if (e.step.kind === "timeformat") {
      format = e.step.format;
      continue;
    }
    if (e.step.kind === "delay") {
      delaysSoFar[e.callerIndex] += 1;
      lastDelayKey[e.callerIndex] = `${e.callerIndex}:${e.order}`;
      continue;
    }
    const readings = readTime(e.atFs, caller.unit);
    const r = renderDisplay(e.step.template, e.step.args, readings, caller.unit, format, build);
    snapshots.push({
      caller: caller.name,
      unit: caller.unit,
      precision: caller.precision,
      afterDelay: e.afterDelay,
      delayOrdinal: delaysSoFar[e.callerIndex],
      readings,
      format,
      template: e.step.template,
      args: e.step.args,
      lineKey: `${e.callerIndex}:${e.order}`,
      delayKey: lastDelayKey[e.callerIndex],
      notes: e.notes,
    });
    lines.push({ caller: caller.name, absFs: e.atFs, text: r.text, toolDependent: r.toolDependent, momentIndex: snapshots.length - 1 });
  }
  return { snapshots, lines, errors: Array.from(errors), notes: Array.from(notes) };
}

/** The same scripts with every %t and %0t reading `arg`: the toggle changes the code, so the code, the log and the options stay one thing. */
export function withPercentTArg(callers: readonly ReadTimeCaller[], arg: "time" | "realtime"): ReadTimeCaller[] {
  return callers.map((c) => ({
    ...c,
    steps: c.steps.map((step) => (step.kind === "display" ? { ...step, args: step.args.map((a) => (isPercentT(a) ? { ...a, fn: arg } : a)) } : step)),
  }));
}

/** True when any line of the scripts prints with %t or %0t. */
export function usesPercentT(callers: readonly ReadTimeCaller[]): boolean {
  return callers.some((c) => c.steps.some((step) => step.kind === "display" && step.args.some(isPercentT)));
}

/** True when the code's own $timeformat runs before its first print: a format set beforehand then changes nothing (20.4.3). */
export function setsFormatBeforeFirstPrint(callers: readonly ReadTimeCaller[], build: Build): boolean {
  const { snapshots } = runReadTime(callers, build, null);
  return snapshots.length > 0 && snapshots.every((s) => s.format !== null);
}

/** True when %t of $time and %t of $realtime print different text somewhere in this run: otherwise a toggle between them shows nothing. */
export function percentTArgMatters(callers: readonly ReadTimeCaller[], build: Build, initialFormat: TimeFormat | null = null): boolean {
  const printed = (arg: "time" | "realtime") => runReadTime(withPercentTArg(callers, arg), build, initialFormat).lines.map((l) => l.text);
  const asTime = printed("time");
  return printed("realtime").some((text, i) => text !== asTime[i]);
}

export interface OutputPart {
  text: string;
  /** How many spaces of %t padding this part stands for; 0 for text as printed. */
  padding: number;
}

/**
 * Splits a printed line so its %t padding can be shown and named. Padding is the
 * run of spaces before a %t's digits, less any spaces the template itself has
 * there; other spaces, such as the alignment in "tb_top   $time", stay text.
 */
export function splitPadding(text: string, template: string): OutputPart[] {
  const literal = /( *)%0?t/.exec(template);
  if (!literal) return [{ text, padding: 0 }];
  const literalSpaces = literal[1].length;
  const parts: OutputPart[] = [];
  const run = / +(?=\d)/g;
  let from = 0;
  for (let m = run.exec(text); m; m = run.exec(text)) {
    const padding = m[0].length - literalSpaces;
    if (padding <= 0) continue;
    parts.push({ text: text.slice(from, m.index + literalSpaces), padding: 0 }, { text: "", padding });
    from = m.index + m[0].length;
  }
  parts.push({ text: text.slice(from), padding: 0 });
  return parts.filter((p) => p.padding > 0 || p.text !== "");
}

export const timeformatCode = (f: TimeFormat): string => `$timeformat(${f.units}, ${f.precision}, ${JSON.stringify(f.suffix)}, ${f.minWidth});`;

/** The $display statement of one moment, as source text. */
export function displayCode(template: string, args: readonly DisplayArg[]): string {
  return `$display(${JSON.stringify(template)}${args.map((a) => `, $${a.fn}`).join("")});`;
}

export interface ReadTimeCodeLine {
  key: string;
  text: string;
}

/**
 * The source the run executes, generated from the same steps (visual-language
 * principle 1), with keys that match each snapshot's lineKey and delayKey.
 * Only what the steps model is listed. A build with a `timescale gets the
 * directive; otherwise the module declares timeunit and timeprecision.
 */
export function readTimeCode(callers: readonly ReadTimeCaller[], build: Build, initialFormat: TimeFormat | null = null): ReadTimeCodeLine[] {
  const lines: ReadTimeCodeLine[] = [];
  const directive = build.timescalePrecisions.length > 0;
  callers.forEach((caller, ci) => {
    if (ci > 0) lines.push({ key: `${ci}:blank`, text: "" });
    if (directive) lines.push({ key: `${ci}:timescale`, text: `\`timescale ${formatScale(caller.unit)}/${formatScale(caller.precision)}` });
    lines.push({ key: `${ci}:module`, text: `module ${caller.moduleName ?? caller.name};${caller.moduleComment ? `  // ${caller.moduleComment}` : ""}` });
    if (!directive) lines.push({ key: `${ci}:timeunit`, text: `  timeunit ${formatScale(caller.unit)}; timeprecision ${formatScale(caller.precision)};` });
    (caller.body ?? []).forEach((text, i) => lines.push({ key: `${ci}:body${i}`, text: `  ${text}` }));
    lines.push({ key: `${ci}:initial`, text: "  initial begin" });
    if (ci === 0 && initialFormat) lines.push({ key: "initial-format", text: `    ${timeformatCode(initialFormat)}  // from the control above` });
    caller.steps.forEach((step, order) => {
      const key = `${ci}:${order}`;
      if (step.kind === "delay") lines.push({ key, text: `    #${step.delay.trim().replace(/^#/, "")};` });
      else if (step.kind === "timeformat") lines.push({ key, text: `    ${timeformatCode(step.format)}` });
      else lines.push({ key, text: `    ${displayCode(step.template, step.args)}` });
    });
    lines.push({ key: `${ci}:end`, text: "  end" }, { key: `${ci}:endmodule`, text: "endmodule" });
  });
  return lines;
}

const fnName = (fn: DisplayArg["fn"]) => `$${fn}`;

/**
 * What one line prints and why, written from its own specifiers and the format
 * in force at that moment, so a preset's explanation cannot drift from its log.
 */
export function explainLine(snapshot: ReadTimeSnapshot, build: Build): { what: string; why: string } {
  const { readings, unit, format, args } = snapshot;
  const fmt = effectiveFormat(format, build);
  const unitName = formatScale(unit);
  const realText = rationalToDecimal(readings.realtime);
  const what: string[] = [`t = ${formatFsAuto(readings.absFs)} is ${realText} of ${snapshot.caller}'s ${unitName} units.`];
  const why: string[] = [];
  const addWhy = (text: string) => {
    if (!why.includes(text)) why.push(text);
  };
  for (const arg of args) {
    if (isPercentT(arg)) {
      if (!fmt) {
        what.push(`${arg.spec} of ${fnName(arg.fn)} has no units to convert to.`);
        addWhy("No $timeformat was called and the source has no `timescale, so Table 20-3 gives no default units: the text is tool-dependent (§20.4.3).");
        continue;
      }
      const target = scaleFromExponent(fmt.units) as TimeScale;
      const argFs = fnFs(readings, unit, arg.fn);
      const zero = arg.spec === "%0t";
      const padding = zero ? ", and the 0 drops the padding" : fmt.minWidth > 0 ? `, padded to at least ${fmt.minWidth} characters` : "";
      const suffix = fmt.suffix ? `, the suffix ${JSON.stringify(fmt.suffix)}` : ", no suffix";
      const rounded = arg.fn !== "realtime" && argFs !== readings.absFs ? ` (${fnName(arg.fn)} has already rounded ${formatFsAuto(readings.absFs)})` : "";
      what.push(`${arg.spec} of ${fnName(arg.fn)} writes ${formatFsAuto(argFs)}${rounded} in ${formatScale(target)} units with ${fmt.precision} decimal${fmt.precision === 1 ? "" : "s"}${suffix}${padding}.`);
      addWhy(
        format
          ? "The last $timeformat call governs every %t in the design until the next call (§20.4.3)."
          : `No $timeformat has run yet, so Table 20-3 applies: units = the smallest \`timescale precision (${formatScale(target)}), 0 decimals, no suffix, width 20 (§20.4.3).`,
      );
      if (zero) addWhy("A field width of 0 asks for the minimum width (§21.2.1.2); this lab takes that to drop the padding (see its stated assumptions).");
    } else if (arg.fn === "time") {
      const half = readings.timeExactHalf ? ", an exact half: §20.3.1 states no tie rule, and the §6.12.1 real-to-integer rule rounds it away from zero" : "";
      what.push(readings.realtime.den === ONE ? `$time is ${readings.time.toString()} in the caller's unit.` : `$time rounds ${realText} to ${readings.time.toString()}${half}.`);
      addWhy(`$time is an integer scaled to the caller's ${unitName} unit, rounded (§20.3.1).`);
    } else if (arg.fn === "stime") {
      what.push(readings.stimeWrapped ? `$stime is ${readings.stime.toString()}, the low 32 bits of ${readings.time.toString()}.` : `$stime is ${readings.stime.toString()}: the value fits in 32 bits.`);
      addWhy("$stime is a 32-bit unsigned integer in the caller's unit; a time that does not fit gives its low 32 bits (§20.3.2).");
    } else {
      what.push(`$realtime keeps the fraction: ${realText}.`);
      addWhy(`$realtime is a real number in the caller's ${unitName} unit (§20.3.3).`);
    }
  }
  return { what: what.join(" "), why: why.join(" ") };
}

/**
 * Prediction options for one moment: the whole line as it prints. Each
 * distractor changes one thing a learner might get wrong; deduplicating by text
 * drops the ones this line cannot show. A padded %0t is offered only under the
 * Table 20-3 default width, which the lessons settle: once $timeformat sets a
 * width, how %0t interacts with it is one of the lab's stated assumptions.
 */
export function readTimeOptions(snapshot: ReadTimeSnapshot, build: Build): LabOption[] {
  const { readings, unit, format, template, args } = snapshot;
  const fmt = effectiveFormat(format, build);
  const unitName = formatScale(unit);
  const precName = formatScale(snapshot.precision);
  const base = trueValues(readings, unit, fmt);
  const render = (over: Partial<DisplayValues>) => fillTemplate(template, args, { ...base, ...over });
  const explanation = explainLine(snapshot, build);
  const options: LabOption[] = [{ id: "model", label: render({}), correct: true, feedback: explanation.why }];
  const push = (id: string, over: Partial<DisplayValues>, feedback: string) => options.push({ id, label: render(over), correct: false, feedback });

  if (readings.stimeWrapped) {
    push("stime-unwrapped", { int: (fn) => (fn === "realtime" ? base.int(fn) : readings.time.toString()) }, "$stime is 32 bits wide. A time that does not fit gives its low 32 bits, not the whole value (§20.3.2).");
    push("stime-saturated", { int: (fn) => (fn === "stime" ? (TWO_POW_32 - ONE).toString() : base.int(fn)) }, "$stime does not stop at its largest value. It returns the low 32 bits of the time (§20.3.2).");
  }

  const precUnits = normalizeRational({ num: readings.absFs, den: scaleToFs(snapshot.precision) });
  const precInt = realToInteger(precUnits).value;
  push(
    "precision-units",
    { int: (fn) => (fn === "stime" ? precInt % TWO_POW_32 : precInt).toString(), fixed: (_fn, digits) => rationalToDecimal(precUnits, digits) },
    `That counts in ${precName} precision steps. $time and $realtime report in the calling element's time unit, ${unitName} (§20.3.1, §20.3.3).`,
  );

  /** The value a %t argument stands for, written with the format's digits and suffix but not converted. */
  const rawT = (fn: DisplayArg["fn"], zeroWidth: boolean, f: TimeFormat) => {
    const raw = fn === "realtime" ? readings.realtime : { num: fn === "time" ? readings.time : readings.stime, den: ONE };
    const body = `${rationalToDecimal(raw, f.precision)}${f.suffix}`;
    return zeroWidth ? body : body.padStart(f.minWidth, " ");
  };
  if (fmt) {
    push("raw-t", { t: (fn, zeroWidth) => rawT(fn, zeroWidth, fmt) }, `%t does not print the raw number. It treats the value as a time in the caller's ${unitName} unit and converts it to the $timeformat units (§20.4.3).`);
    if (fmt.minWidth > 0) {
      push(
        "unpadded-t",
        { t: (fn, zeroWidth) => (zeroWidth ? base.t(fn, true) : formatPercentT(fnFs(readings, unit, fn), fmt, true)) },
        `A plain %t pads to the minimum field width in force, ${fmt.minWidth} (${format ? "the last $timeformat call" : "Table 20-3's default"}; §20.4.3). Only %0t asks for no padding.`,
      );
    }
    if (!format) {
      push(
        "padded-t",
        { t: (fn, zeroWidth) => formatPercentT(fnFs(readings, unit, fn), zeroWidth ? { ...fmt, minWidth: TIMEFORMAT_DEFAULTS.minWidth } : fmt, false) },
        "A field width of 0 asks for the minimum width (§21.2.1.2), and this lab assumes that drops the padding (see its stated assumptions). Only a plain %t pads to Table 20-3's default width of 20.",
      );
    }
  }
  const written = snapshot.afterDelay?.input;
  if (written && written.kind === "number" && snapshot.delayOrdinal === 1) {
    const asWritten = { num: written.digits, den: written.den };
    push("written-delay", { fixed: (fn, digits) => (fn === "realtime" ? rationalToDecimal(asWritten, digits) : base.fixed(fn, digits)) }, "The delay was rounded to the caller's precision before it was used (§3.14.1), and $realtime reports the time at which the process actually woke.");
  }
  push("unrounded", { int: (fn) => (fn === "time" ? rationalToDecimal(readings.realtime) : base.int(fn)) }, "$time returns an integer (§20.3.1); only $realtime keeps the fraction (§20.3.3).");
  if (readings.realtime.den !== ONE) {
    push(
      "truncated",
      { int: (fn) => (fn === "time" ? (readings.realtime.num / readings.realtime.den).toString() : base.int(fn)) },
      "$time rounds to the nearest integer, it does not truncate: §20.3.1's own example reads 2 at 16 ns in a 10 ns unit, not 1.",
    );
  }
  if (fmt) {
    if (format && fmt.minWidth !== TIMEFORMAT_DEFAULTS.minWidth) {
      push(
        "default-width",
        { t: (fn, zeroWidth) => (zeroWidth ? base.t(fn, true) : formatPercentT(fnFs(readings, unit, fn), { ...fmt, minWidth: TIMEFORMAT_DEFAULTS.minWidth })) },
        `20 is Table 20-3's default. This $timeformat call sets a minimum field width of ${fmt.minWidth}, which replaces it for every %t until the next call (§20.4.3).`,
      );
    }
    const def = effectiveFormat(null, build);
    const defUnits = def ? scaleFromExponent(def.units) : null;
    if (format) {
      push(
        "format-ignored",
        { t: (fn, zeroWidth) => (def ? formatPercentT(fnFs(readings, unit, fn), def, zeroWidth) : TOOL_DEPENDENT) },
        def && defUnits
          ? `That is Table 20-3's default (units ${formatScale(defUnits)}, 0 digits, no suffix). But $timeformat was called, and one call governs every %t in the design until the next (§20.4.3).`
          : "Without $timeformat the units would indeed be tool-dependent here: the source has no `timescale, so Table 20-3 gives none. But $timeformat was called, and it governs every %t until the next call (§20.4.3).",
      );
    }
    push(
      "tool-dependent",
      { t: () => TOOL_DEPENDENT },
      format
        ? "The units are settled: $timeformat was called, and it governs every %t in the design until the next call (§20.4.3)."
        : `The units are settled without a $timeformat call: Table 20-3 takes them from the smallest \`timescale precision in the source, ${defUnits ? formatScale(defUnits) : "shown above"}.`,
    );
  } else {
    push("numeric-guess", { t: () => rationalToDecimal(precUnits, 0) }, "A number needs units. No $timeformat was called and the source has no `timescale, so Table 20-3 gives no default units: the text is tool-dependent (§20.4.3).");
  }
  if (readings.absFs !== ZERO) {
    const tenTimes = normalizeRational({ num: readings.realtime.num * TEN, den: readings.realtime.den });
    const tenInt = realToInteger(tenTimes).value;
    push(
      "ten-x",
      { int: (fn) => (fn === "stime" ? tenInt % TWO_POW_32 : tenInt).toString(), fixed: (_fn, digits) => rationalToDecimal(tenTimes, digits) },
      `$time and $realtime report in the calling element's time unit, ${unitName} (§20.3.1, §20.3.3); nothing rescales them.`,
    );
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
    id: "stime-wrap",
    label: "$stime: a long run at 1ps/1ps",
    summary: "`timescale 1ps/1ps, one module: #5ms, then one print of $time and $stime.",
    outcome: "$time still reads 5000000000, but $stime is 32 bits wide, so it returns the low 32 bits of that value: 705032704 (§20.3.2). Use $time or $realtime for long runs.",
    build: { timescalePrecisions: [scale(1, "ps")] },
    arg: "time",
    callers: [
      {
        name: "tb_top",
        unit: scale(1, "ps"),
        precision: scale(1, "ps"),
        steps: [
          { kind: "delay", delay: "#5ms" },
          { kind: "display", template: "$time=%0d $stime=%0d", args: [{ fn: "time", spec: "%0d" }, { fn: "stime", spec: "%0d" }] },
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
        body: ["slow_gen u_slow ();"],
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
        moduleName: "slow_gen",
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
        moduleName: "uvm_stamp_sketch",
        moduleComment: "stands in for uvm_report_server, compiled in uvm_pkg",
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

/**
 * What differs from the preset's own code, or null when nothing does. A preset's
 * summary and outcome describe its own code, so they stand only while this is null.
 */
export function presetChangeText(preset: ReadTimePreset, arg: "time" | "realtime", initialFormat: TimeFormat | null): string | null {
  const changes: string[] = [];
  if (arg !== preset.arg) changes.push(`every %t now reads $${arg} instead of $${preset.arg}`);
  if (initialFormat) changes.push(`${timeformatCode(initialFormat)} now runs first`);
  return changes.length ? `You changed this preset's code: ${changes.join(", and ")}. The code panel shows what runs now.` : null;
}

/** How many lines of the log differ from what the preset's own code prints. */
export function linesChangedFromPreset(preset: ReadTimePreset, lines: readonly ReadTimeLine[]): number {
  const own = runReadTime(preset.callers, preset.build, null).lines;
  return lines.filter((l, i) => l.text !== own[i]?.text).length;
}

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

export interface SourceElement {
  kind: "element";
  name: string;
  elementKind: ElementKind;
  timeunit?: TimeScale;
  /** The second argument of the timeunit declaration: timeunit 1ms / 1us; (3.14.3 lists it apart from timeprecision). */
  timeunitPrecision?: TimeScale;
  timeprecision?: TimeScale;
  /** Nested modules or interfaces (3.14.2.3 rule a). Only design elements: `timescale and `resetall are illegal inside one (22.3, 22.7). */
  nested?: readonly SourceElement[];
}

export type SourceItem =
  | { kind: "timescale"; unit: TimeScale; precision: TimeScale }
  | { kind: "resetall" }
  /** timeunit at compilation-unit scope, outside every design element (3.14.2.3 rule c). */
  | { kind: "cu-timeunit"; unit: TimeScale; precision?: TimeScale }
  | SourceElement;

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

    const resolveElement = (item: SourceElement, file: SourceFile, enclosing: ResolvedElement | null) => {
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
      const declaredPrecision = item.timeprecision ?? item.timeunitPrecision;
      if (declaredPrecision) {
        precision = declaredPrecision;
        precisionRule = "declared";
        precisionSource = item.timeprecision
          ? `timeprecision ${formatScale(declaredPrecision)} in ${path}`
          : `timeunit ${formatScale(item.timeunit as TimeScale)} / ${formatScale(declaredPrecision)} in ${path}`;
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
      (item.nested ?? []).forEach((n) => resolveElement(n, file, resolved));
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
            // A later repeat is legal as long as it matches the first (3.14.2.2). A repeat that leaves out the precision states nothing different.
            const differs = !sameScale(cuUnit.unit, item.unit) || (cuUnit.precision !== undefined && item.precision !== undefined && !sameScale(cuUnit.precision, item.precision));
            if (differs) errors.push({ message: `${file.label}: this compilation-unit timeunit does not match the first (${cuUnit.source}).`, clause: "IEEE 1800-2023 §3.14.2.2", toolNote: "an error per the standard" });
          } else if (sawItem) {
            errors.push({
              message: `${file.label}: the compilation-unit timeunit comes after other items of its compilation unit; a time scope's timeunit shall precede any other item.`,
              clause: "IEEE 1800-2023 §3.14.2.2",
              toolNote: "an error per the standard",
            });
          }
          if (!cuUnit) cuUnit = { unit: item.unit, precision: item.precision, source: `compilation-unit timeunit ${formatScale(item.unit)}${item.precision ? ` / ${formatScale(item.precision)}` : ""} in ${file.label}` };
          if (item.precision) precisions.push({ scale: item.precision, source: `compilation-unit timeunit precision in ${file.label}` });
        } else {
          resolveElement(item, file, null);
          // Only a description counts as an item before the timeunit: source_text is [ timeunits_declaration ] { description }, and a directive is not a description.
          sawItem = true;
        }
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
        timeunitPrecision: scale(1, "us"),
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

/** tb_top and the instance u_slow of slow_gen: the two modules of the F3A figure and of the Make It Work bench. */
export const TB_TOP_SCOPE = { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") } as const;
export const U_SLOW_SCOPE = { name: "u_slow", moduleName: "slow_gen", unit: scale(10, "ns"), precision: scale(1, "ns") } as const;

export const timeunitLine = (s: { unit: TimeScale; precision: TimeScale }): string => `timeunit ${formatScale(s.unit)}; timeprecision ${formatScale(s.precision)};`;

/** The precision of the two-modules figure's design: the finer of its two modules (3.14.3). */
export function twoModulesGlobalPrecision(): TimeScale | null {
  return resolveTimeScopes(globalPrecisionDesign(false), "one").globalPrecision;
}

/**
 * The Make It Work bench as source files, with an optional vendor model compiled
 * under `timescale 1ns/1fs. tb_top instantiates the vendor model, so it is in the
 * design under any choice of top (3.14.3 counts what is in the design, 23.3.1).
 */
export function globalPrecisionDesign(withVendorModel: boolean): SourceFile[] {
  const element = (s: { unit: TimeScale; precision: TimeScale }, name: string): SourceItem => ({ kind: "element", name, elementKind: "module", timeunit: s.unit, timeprecision: s.precision });
  const files: SourceFile[] = [
    {
      id: "tb",
      label: "tb.sv",
      items: [element(U_SLOW_SCOPE, U_SLOW_SCOPE.moduleName), element(TB_TOP_SCOPE, TB_TOP_SCOPE.name)],
      code: [
        `module ${U_SLOW_SCOPE.moduleName};`,
        `  ${timeunitLine(U_SLOW_SCOPE)}`,
        "endmodule",
        `module ${TB_TOP_SCOPE.name};`,
        `  ${timeunitLine(TB_TOP_SCOPE)}`,
        `  ${U_SLOW_SCOPE.moduleName} ${U_SLOW_SCOPE.name} ();`,
        ...(withVendorModel ? ["  vendor_model u_vendor ();"] : []),
        "endmodule",
      ],
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
    mk("1fs", "Time scale of ($root) is 1fs / 1fs", withVendorModel ? "Right. The smallest `timescale precision counts toward the global precision whether or not other modules use that directive (§3.14.3): slow_gen and tb_top declare their own, and only vendor_model takes it. $root shows it as both unit and precision (§20.4.2), and 1step equals the global precision, so it is 1 fs too (§3.14.3)." : "There is no 1 fs precision anywhere in this design yet. Add the vendor model to see it."),
    mk("100ps", "Time scale of ($root) is 100ps / 100ps", withVendorModel ? "That was the answer before the vendor model. Its `timescale 1ns/1fs adds a 1 fs precision to the design, and the global precision is the minimum of all of them (§3.14.3)." : "Right. The finest precision in the design is tb_top's 100 ps (§3.14.3), shown as both unit and precision (§20.4.2). 1step equals the global precision, so it is 100 ps too (§3.14.3)."),
    mk("1ns-1fs", "Time scale of ($root) is 1ns / 1fs", "$root reports the simulation time unit, and its unit and precision are always identical (§20.4.2). 1ns / 1fs is the vendor model's own setting."),
    mk("1ns-100ps", "Time scale of ($root) is 1ns / 100ps", "That is tb_top's own setting. $root reports the global precision as both unit and precision (§20.4.2)."),
  ]);
}

/** Prediction options for the default %t units (Table 20-3), which move from undefined to 1 fs with one directive. */
export function defaultUnitsOptions(withVendorModel: boolean): LabOption[] {
  const units = globalPrecisionReport(withVendorModel).defaultPercentTUnits;
  const mk = (id: string, label: string, correct: boolean, feedback: string): LabOption => ({ id, label, correct, feedback });
  return [
    mk(
      "smallest",
      "1fs",
      units !== null && sameScale(units, scale(1, "fs")),
      withVendorModel
        ? "Right. Table 20-3 takes the default units from the smallest `timescale precision in the source, and the vendor model's directive is the only one there."
        : "That is the vendor model's precision, and it is not in this build. Without it the source has no `timescale at all.",
    ),
    mk("timeprecision", "100ps", false, "100ps comes from tb_top's timeprecision statement. Table 20-3 looks only at the precision arguments of `timescale directives."),
    mk("timeunit", "1ns", false, "1ns is a time unit, tb_top's. Table 20-3 takes the default from a precision argument, and only one of a `timescale directive."),
    mk(
      "undefined",
      "Tool-dependent: Table 20-3 does not define it",
      units === null,
      withVendorModel
        ? "The vendor model's `timescale is in the source now, so Table 20-3 names the units."
        : "Right. Table 20-3 names only the smallest `timescale precision, and this source has none: only timeunit and timeprecision. It does not define this case, so the lab calls it tool-dependent.",
    ),
  ];
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
}

export const CROSS_SCOPE_DEFAULT: CrossScopeConfig = {
  callerUnit: scale(1, "ns"),
  callerPrecision: scale(1, "ps"),
  calleeUnit: scale(1, "ps"),
  calleePrecision: scale(1, "ps"),
  format: timeformat(-9, 3, " ns", 0),
};

/** The half period in the repeat form's clock line. A time literal, so tb_top's unit only rescales it (5.8). */
const CLOCK_HALF_PERIOD = "#0.5ns";

/**
 * The period of the repeat form's clock, read through the model the way tb_top
 * reads its own line. `halfPeriod` defaults to that line; a bare number shows what
 * the period would be if the clock generator took tb_top's unit.
 */
export function clockPeriodFs(config: CrossScopeConfig = CROSS_SCOPE_DEFAULT, halfPeriod: string = CLOCK_HALF_PERIOD): bigint {
  const half = roundDelayText(halfPeriod, config.callerUnit, config.callerPrecision);
  if (half.wakeFs === null) throw new Error(`${halfPeriod} has no single value at ${formatScale(config.callerUnit)}/${formatScale(config.callerPrecision)}`);
  return half.wakeFs * TWO;
}

/**
 * What the value's unit is at one beat:
 * - tagged: read in the named time unit;
 * - count: a count of something else, here clock edges, so no time unit applies;
 * - dropped: it was understood in the caller's unit; as a plain number in the callee, that unit no longer applies;
 * - never-had: a plain number from the start;
 * - resolved-time: an absolute wake time, whose unit is part of the value.
 */
export type UnitState = "tagged" | "count" | "dropped" | "never-had" | "resolved-time";

export interface CrossScopeStep {
  /** Where the value is at this beat. */
  scope: "caller" | "boundary" | "callee" | "log";
  /** The line of crossScopeCode(form) that runs at this beat. */
  lineKey: string;
  title: string;
  /** The value as the code sees it, e.g. "5.0" or "5". */
  value: string;
  /** The unit the value is understood in, or null when `unitState` says why it has none. */
  unitTag: string | null;
  unitState: UnitState;
  /** For "dropped": the caller's unit the number was read in, which does not travel with it. */
  lostTag?: string;
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

/**
 * A real value as the lab writes one: a whole number keeps its ".0" (5.0, 1000.0)
 * and a fraction keeps its exact digits (0.005), so a real never reads like an
 * integer. Dropping the ".0" is how the lab shows a real becoming an integer.
 */
function realValueText(r: Rational): string {
  const n = normalizeRational(r);
  return rationalToDecimal(n, n.den === ONE ? 1 : undefined);
}

/** The value and wake time of one call form, beat by beat. */
export function traceCrossScope(form: CallForm, config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): CrossScopeTrace {
  const callerUnitText = formatScale(config.callerUnit);
  const calleeUnitText = formatScale(config.calleeUnit);
  const calleeUnitFs = scaleToFs(config.calleeUnit);
  const print = (fs: bigint) => `expected ${form === "wait_t_1p5ns" ? "1.5 ns" : "5 ns"}, woke at ${formatPercentT(fs, config.format, true)}`;
  const steps: CrossScopeStep[] = [];

  if (form === "repeat_posedge") {
    const period = clockPeriodFs(config);
    const wake = period * BigInt(5);
    steps.push({ scope: "caller", lineKey: "tb-call", title: "In tb_top", value: "5", unitTag: "clock edges", unitState: "count", what: "repeat (5) @(posedge clk) counts five rising edges of clk.", why: "An event control waits for a value change, not for a time (§9.4.2). This line has no time unit." });
    steps.push({ scope: "log", lineKey: "tb-display", title: "Wake", value: formatFsAuto(wake), unitTag: null, unitState: "resolved-time", what: `With clk rising every ${formatFsAuto(period)}, the fifth edge is at ${formatFsAuto(wake)}.`, why: `The clock generator's own delay sets how long those edges take. It is the literal ${CLOCK_HALF_PERIOD}, scaled to the current unit (§5.8), so the period stays ${formatFsAuto(period)} in any unit tb_top uses at this ${formatScale(config.callerPrecision)} precision.` });
    return { form, callText: CALL_FORM_TEXT[form], steps, wakeFs: wake, printed: print(wake), unitFree: true };
  }

  if (form === "wait_ns_5") {
    const literalInCallee = normalizeRational({ num: scaleToFs(scale(1, "ns")), den: calleeUnitFs });
    const product = normalizeRational({ num: BigInt(5) * literalInCallee.num, den: literalInCallee.den });
    const rounded = roundDelay({ kind: "number", text: rationalToDecimal(product), digits: product.num, den: product.den }, config.calleeUnit, config.calleePrecision);
    const wake = rounded.wakeFs ?? rounded.candidatesFs[0];
    steps.push({ scope: "caller", lineKey: "tb-call", title: "In tb_top", value: "5", unitTag: null, unitState: "never-had", what: "wait_ns(5) passes the plain number 5.", why: "The argument is a realtime: a number with no unit (§6.12). The task's name says it is nanoseconds; the language does not." });
    steps.push({
      scope: "boundary",
      lineKey: "pkg-task",
      title: "Crossing into util_pkg",
      value: "5.0",
      unitTag: null,
      unitState: "never-had",
      what: "Passed to the realtime argument delay_ns, the integer 5 becomes the real 5.0, and arrives in util_pkg as a plain number.",
      why: "Passing a value to a subroutine argument is an assignment-like context (§10.8), and assigning an expression to a real converts it (§6.12.1). Nothing rescales a number for the new scope's unit.",
    });
    // 1ns is a realtime value (§5.8) and the product of reals is real (§11.8.1), so both keep the ".0" of a real.
    steps.push({
      scope: "callee",
      lineKey: "pkg-delay",
      title: "In util_pkg",
      value: realValueText(product),
      unitTag: calleeUnitText,
      unitState: "tagged",
      what: `#(delay_ns * 1ns): the literal 1ns is converted in util_pkg's ${calleeUnitText} unit to ${realValueText(literalInCallee)}, so the delay is 5.0 × ${realValueText(literalInCallee)} = ${realValueText(product)} ${calleeUnitText} units.`,
      why: "A time literal is scaled to the current time unit where it is written (§5.8), and here it is written inside the package.",
    });
    steps.push({ scope: "log", lineKey: "tb-display", title: "Wake", value: formatFsAuto(wake), unitTag: null, unitState: "resolved-time", what: `The process wakes at ${formatFsIn(wake, "ps")} = ${formatFsAuto(wake)}; tb_top prints "${print(wake)}".`, why: "The scaling happened in the callee, so the result is right whatever unit the caller uses." });
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
    value: realValueText(inCaller),
    unitTag: callerUnitText,
    unitState: "tagged",
    what: `The literal ${literalText} is converted where it is written, in tb_top's ${callerUnitText} unit: the real number ${realValueText(inCaller)}.`,
    why: "A time literal is interpreted as a realtime value scaled to the current time unit (§5.8).",
  });
  steps.push({
    scope: "boundary",
    lineKey: "pkg-task",
    title: "Crossing into util_pkg",
    value: asTime.value.toString(),
    unitTag: null,
    unitState: "dropped",
    lostTag: callerUnitText,
    what: `Passing it to the time argument t makes it the integer ${asTime.value.toString()}${asTime.exactHalf ? ` (${rationalToDecimal(inCaller)} is an exact half, rounded away from zero)` : inCaller.den !== ONE ? ` (${rationalToDecimal(inCaller)} rounded to the nearest integer)` : ""}. Only the number is passed: ${realValueText(inCaller)} meant ${literalText} because tb_top reads numbers in its ${callerUnitText} unit, and that reading stays in tb_top.`,
    why:
      asTime.exactHalf || inCaller.den !== ONE
        ? "Passing a value to a subroutine argument is an assignment-like context (§10.8): a real assigned to an integer rounds to the nearest integer, and an exact .5 rounds away from zero (§6.12.1). Nothing rescales a number for the new scope's unit, and a realtime argument would pass a plain number too: a real carries no unit (§6.12)."
        : `Passing a value to a subroutine argument is an assignment-like context (§10.8), so the real ${rationalToDecimal(inCaller, 1)} becomes the integer ${asTime.value.toString()} of the time argument, an integer type (§6.11, §6.12.1). Nothing rescales a number for the new scope's unit, and a realtime argument would pass a plain ${rationalToDecimal(inCaller, 1)} just the same: a real carries no unit (§6.12).`,
  });
  steps.push({
    scope: "callee",
    lineKey: "pkg-delay",
    title: "In util_pkg",
    value: asTime.value.toString(),
    unitTag: calleeUnitText,
    unitState: "tagged",
    what: `#t means ${asTime.value.toString()} of util_pkg's ${calleeUnitText} units: ${formatFsIn(wake, "ps")}.`,
    why: `A delay is a number of the enclosing element's time units (§3.14), and util_pkg's unit is ${calleeUnitText}.`,
  });
  steps.push({
    scope: "log",
    lineKey: "tb-display",
    title: "Wake",
    value: formatFsAuto(wake),
    unitTag: null,
    unitState: "resolved-time",
    what: `The process wakes at ${formatFsAuto(wake)}; tb_top prints "${print(wake)}".`,
    why: "$timeformat(-9, 3, \" ns\", 0) prints %t in nanoseconds with three decimals (§20.4.3). It changes the text, never the delay.",
  });
  return { form, callText: CALL_FORM_TEXT[form], steps, wakeFs: wake, printed: print(wake), unitFree: false };
}

/** The second line of the crossing chip. For "dropped" the lab shows the lost unit struck through before it. */
export function unitChipText(step: CrossScopeStep): string {
  switch (step.unitState) {
    case "dropped":
      return "not passed on";
    case "never-had":
      return "plain number";
    case "resolved-time":
      return "wake time";
    default:
      return step.unitTag ?? "";
  }
}

/** One step's value in words, for the step heading and the live region. */
export function unitSentence(step: CrossScopeStep): string {
  switch (step.unitState) {
    case "tagged":
      return `value ${step.value} understood in ${step.unitTag}`;
    case "count":
      return `${step.value} ${step.unitTag}`;
    case "dropped":
      return `value ${step.value}; tb_top's ${step.lostTag ?? ""} reading is not passed on`;
    case "never-had":
      return `plain number ${step.value}`;
    case "resolved-time":
      return `wake time ${step.value}`;
  }
}

/** Prediction options for the wake time of one call form. */
export function crossScopeOptions(form: CallForm, config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): LabOption[] {
  const trace = traceCrossScope(form, config);
  const correct = trace.wakeFs === null ? "unit-free" : formatFsAuto(trace.wakeFs);
  const mk = (id: string, label: string, feedback: string): LabOption => ({ id, label, correct: label === correct, feedback });
  if (form === "repeat_posedge") {
    return [
      mk("5ns", correct, `Right. Five rising edges of a clock with a 1 ns period. The repeat line counts edges and has no unit (§9.4.2); the clock line's literal ${CLOCK_HALF_PERIOD} sets how long they take (§5.8).`),
      mk("5ps", "5 ps", "The repeat loop counts the edges and the event control waits for each one; neither uses a time unit (§12.7.2, §9.4.2). The package's 1 ps unit plays no part."),
      mk("5000ns", "5000 ns", "No conversion happens: five edges of a 1 ns clock take 5 ns."),
    ];
  }
  const integerPassed = trace.steps[1]?.value ?? "";
  /** wait_t(5ns) is followed by the hunt for the line, so its feedback stops at the symptom: naming the mechanism here would answer the hunt. */
  const hunted = form === "wait_t_5ns";
  const options: LabOption[] = [
    mk(
      "model",
      correct,
      hunted
        ? `The process wakes after ${correct}, so the log reads "${trace.printed}": 1000 times shorter than the bench intended. Next, find the line that did it.`
        : form === "wait_ns_5"
          ? `Right. 1ns is converted inside util_pkg to ${realValueText({ num: scaleToFs(scale(1, "ns")), den: scaleToFs(config.calleeUnit) })} of its ${formatScale(config.calleeUnit)} units (§5.8), so the task waits 5 ns.`
          : `Right. The literal becomes a real in tb_top's unit (§5.8), the time argument makes it the integer ${integerPassed}${form === "wait_t_1p5ns" ? " (an exact half rounds away from zero, §6.12.1)" : ""}, and #t reads that number in util_pkg's ${formatScale(config.calleeUnit)} unit (§3.14).`,
    ),
    mk(
      "expected",
      form === "wait_t_1p5ns" ? "1.5 ns" : "5 ns",
      hunted
        ? "That is the intent, not the result. The call and the print look consistent, yet the log reads 0.005 ns."
        : "That is the intent, not the result. The literal was converted in tb_top (§5.8) and #t reads the bare number in util_pkg's 1 ps unit (§3.14).",
    ),
  ];
  if (form === "wait_t_1p5ns") {
    options.push(mk("1ps", "1 ps", "1.5 passed to a time argument rounds to the nearest integer, and an exact half rounds away from zero: 2, not 1 (§6.12.1)."));
    options.push(mk("1.5ps", "1.5 ps", "A time variable is an integer type (§6.11), so the fraction cannot survive the call (§6.12.1)."));
  } else if (hunted) {
    options.push(mk("5000ns", "5000 ns", "The wait comes up shorter than the bench intended, not longer: the log reads 0.005 ns."));
  } else {
    options.push(mk("5ps", "5 ps", "That is wait_t's bug. wait_ns multiplies by the literal 1ns inside the package, where 1ns is 1000.0 of the 1 ps units (§5.8)."));
  }
  options.push(mk("error", "A compile error: units do not match", "It compiles: the language defines no error for this mismatch, and only the log shows it."));
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

/**
 * The four suspect lines. The verdict is the lesson's judgement of the line; the
 * evidence is recomputed with that line changed, so it can be checked against it.
 */
export function gradeCrossScopeSuspects(config: CrossScopeConfig = CROSS_SCOPE_DEFAULT): CrossScopeSuspect[] {
  const base = traceCrossScope("wait_t_5ns", config);
  const baseWake = base.wakeFs as bigint;
  // #t rewritten as #(t * 1ns): t is the integer the call passed, and 1ns is converted in the package (5.8).
  const t = BigInt(base.steps[1].value);
  const scaledT = normalizeRational({ num: t * scaleToFs(scale(1, "ns")), den: scaleToFs(config.calleeUnit) });
  const scaledHashT = roundDelay({ kind: "number", text: rationalToDecimal(scaledT), digits: scaledT.num, den: scaledT.den }, config.calleeUnit, config.calleePrecision);
  const callerInCalleeUnit = traceCrossScope("wait_t_5ns", { ...config, callerUnit: config.calleeUnit, callerPrecision: config.calleePrecision });
  const otherFormat = traceCrossScope("wait_t_5ns", { ...config, format: timeformat(-12, 0, " ps", 0) });
  const literalInCallee = roundDelayText("#5ns", config.calleeUnit, config.calleePrecision);
  return [
    {
      id: "hash-t",
      lineKey: "pkg-delay",
      label: "#t; in util_pkg",
      verdict: "culprit",
      evidence: `Recomputed with #t rewritten as #(t * 1ns), so the package says which unit it means: the same call wakes at ${wakeText(scaledHashT, "ns")} instead of ${formatFsAuto(baseWake)}.`,
      feedback: "Yes. #t reads t as a number of util_pkg's own 1 ps units (§3.14). The task promised to wait t without saying in which unit, and a bare number has none.",
    },
    {
      id: "call",
      lineKey: "tb-call",
      label: "util_pkg::wait_t(5ns); in tb_top",
      verdict: "contributes",
      evidence: `Recomputed with the literal written inside util_pkg instead: 5ns there is ${literalInCallee.scaledInUnits} units and wakes at ${wakeText(literalInCallee, "ns")} instead of ${formatFsAuto(baseWake)}.`,
      feedback: `Half right. This is where 5ns becomes the real ${base.steps[0].value}, read in tb_top's ${formatScale(config.callerUnit)} unit, because a literal is converted where it is written (§5.8); passing it to t keeps only the number. The real defect is the package's #t, which reads that number in a different unit.`,
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
  const coarseCaller = { ...config, callerUnit: scale(10, "ns"), callerPrecision: finePrecision(scale(10, "ns")) };
  const bareClockWake = formatFsAuto(clockPeriodFs(coarseCaller, "#0.5") * BigInt(5));
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
      code: `logic clk = 1;   // set before any procedure starts (§6.8)\nalways ${CLOCK_HALF_PERIOD} clk = ~clk;   // a literal: the same period in any unit at this ${formatScale(config.callerPrecision)} precision\nrepeat (5) @(posedge clk);   // in tb_top: five clock edges; this line has no unit`,
      results: run("repeat_posedge", (callerUnit) => ({ ...config, callerUnit, callerPrecision: finePrecision(callerUnit) })),
      review: `Accepted where a clock exists: an event control needs no unit (§9.4.2). It changes the API from a time to a cycle count, so callers must agree on the clock. These results assume the two clock lines above: clk starts at 1 before any procedure runs (§6.8), so it first rises one full period in, and the literal ${CLOCK_HALF_PERIOD} gives the same period in every caller unit at this ${formatScale(config.callerPrecision)} precision (§5.8). With a bare #0.5, a caller in 10ns would wake at ${bareClockWake}.`,
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
 * The repeat form declares its clock with a literal, so at this 1ps precision the
 * period does not depend on tb_top's unit (at a 1ns precision #0.5ns would be a
 * half tick with no single value): the initializer runs before any procedure
 * starts (§6.8), so there is no edge at time 0; clk falls at 0.5 ns and first
 * rises at 1 ns.
 *
 * `withholdMechanism` leaves out the comment on the package's delay line, which
 * explains the result, while the learner is still predicting or hunting for the
 * guilty line. The lesson's exact code returns once they are done.
 */
export function crossScopeCode(form: CallForm, withholdMechanism = false): readonly { key: string; text: string; owner?: "testbench" }[] {
  const swap = (changes: Readonly<Record<string, string>>) => CROSS_SCOPE_CODE.map((l) => (l.key in changes ? { ...l, text: changes[l.key] } : l));
  const hashT: Readonly<Record<string, string>> = withholdMechanism ? { "pkg-delay": "    #t;" } : {};
  switch (form) {
    case "wait_t_5ns":
      return withholdMechanism ? swap(hashT) : CROSS_SCOPE_CODE;
    case "wait_t_1p5ns":
      return swap({
        ...hashT,
        "tb-call": "    util_pkg::wait_t(1.5ns);         // intent: wait 1.5 ns",
        "tb-display": '    $display("expected 1.5 ns, woke at %t", $realtime);',
      });
    case "wait_ns_5":
      return swap({
        "pkg-task": "  task automatic wait_ns(realtime delay_ns);",
        "pkg-delay": withholdMechanism ? "    #(delay_ns * 1ns);" : "    #(delay_ns * 1ns);               // 1ns is converted in THIS package's time unit",
        "tb-call": "    util_pkg::wait_ns(5);",
      });
    case "repeat_posedge":
      return swap({ ...hashT, "tb-call": "    repeat (5) @(posedge clk);" }).flatMap((l) =>
        l.key === "tb-timeunit"
          ? [
              l,
              { key: "tb-clk", text: "  logic clk = 1;                     // set before any procedure starts: no edge at 0", owner: "testbench" as const },
              { key: "tb-clk-gen", text: `  always ${CLOCK_HALF_PERIOD} clk = ~clk;          // falls at 0.5 ns, rises at 1 ns, period 1 ns`, owner: "testbench" as const },
            ]
          : [l],
      );
  }
}
