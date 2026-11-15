/**
 * Boundary probe model: the F1A worked example, where the RTL writes
 * `temp > 8'd100` and the spec says "100 or more" (`t >= 8'd100`).
 *
 * The model reproduces the lesson's testbench exactly:
 *
 *   alarm    = (temp > 8'd100)        // RTL, or >= after the fix
 *   expected = (t >= 8'd100)          // the spec
 *   if (alarm !== expected) fail_cnt++ else pass_cnt++
 *   $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);
 *
 * Sources: IEEE 1800-2023 §11.4.4 (relational operators), §11.4.5 (equality
 * operators, `!==`), §6.11.3 (logic is unsigned by default) and §21.2.1.2
 * (size of displayed data). No React here: the component only renders this.
 */

/** `temp` is `logic [7:0]`: the 256 values 0 to 255. */
export const TEMP_MIN = 0;
export const TEMP_MAX = 255;
export const TEMP_WIDTH = 8;
/** The spec's threshold, `8'd100`. */
export const THRESHOLD = 100;
/** The most values a custom test may hold, so every prediction stays a short list. */
export const MAX_VALUES = 8;

export type Bit = 0 | 1;
/** A 1-bit result in four-state terms; only 0, 1 and x can come out of a comparison. */
export type Bit4 = Bit | "x";
export type RelOp = ">" | ">=";
export type Operand = number | "x";

/**
 * IEEE 1800-2023 §11.4.4: a relational expression yields 1'b0 if the relation
 * is false and 1'b1 if it is true; if either operand contains x or z the result
 * is 1'bx. `logic [7:0]` is unsigned (§6.11.3) and so is `8'd100`, a based
 * literal without the s designator (§5.7.1), so the comparison is between
 * unsigned values; for 0 to 255 that is plain integer comparison.
 */
export function relational(a: Operand, op: RelOp, b: Operand): Bit4 {
  if (a === "x" || b === "x") return "x";
  const truth = op === ">" ? a > b : a >= b;
  return truth ? 1 : 0;
}

/**
 * IEEE 1800-2023 §11.4.5: `a !== b` is "not equal, including x and z": it
 * compares bit for bit, x matching only x, and always yields 1'b0 or 1'b1.
 * Limited to the 1-bit outputs of relational() (0, 1 or x); it does not model
 * multi-bit or z operands.
 */
export function caseInequal(a: Bit4, b: Bit4): Bit {
  return a === b ? 0 : 1;
}

/** The RTL's operator: the bug writes `>`, the fix writes `>=`. */
export const rtlOperator = (fixed: boolean): RelOp => (fixed ? ">=" : ">");
export const rtlLine = (fixed: boolean): string => `assign alarm = (temp ${rtlOperator(fixed)} 8'd${THRESHOLD});`;
export const SPEC_LINE = `expected = (t >= 8'd${THRESHOLD});`;

export const rtlAlarm = (temp: Operand, fixed: boolean): Bit4 => relational(temp, rtlOperator(fixed), THRESHOLD);
export const specExpected = (temp: Operand): Bit4 => relational(temp, ">=", THRESHOLD);

export interface CheckResult {
  temp: number;
  alarm: Bit4;
  expected: Bit4;
  /** `alarm !== expected` (§11.4.5). */
  differs: Bit;
  pass: boolean;
  /** The line the lesson's `$display` prints on a failure, or null on a pass. */
  failLine: string | null;
}

const bitText = (b: Bit4) => String(b);

/**
 * One call of the lesson's `check` task. Displayed values are sized
 * automatically to the expression's width (§21.2.1.2): `%0d` prints the decimal
 * value with no padding, and `%b` of a 1-bit value is one character.
 */
export function check(temp: number, fixed: boolean): CheckResult {
  const alarm = rtlAlarm(temp, fixed);
  const expected = specExpected(temp);
  const differs = caseInequal(alarm, expected);
  const pass = differs === 0;
  return {
    temp,
    alarm,
    expected,
    differs,
    pass,
    failLine: pass ? null : `FAIL temp=${temp} alarm=${bitText(alarm)} expected=${bitText(expected)}`,
  };
}

export interface RunResult {
  results: CheckResult[];
  pass: number;
  fail: number;
  /** `PASS=%0d FAIL=%0d`. */
  summary: string;
  /** Everything the run prints, in order: each FAIL line, then the summary. */
  output: string[];
}

export const summaryLine = (pass: number, fail: number) => `PASS=${pass} FAIL=${fail}`;

/** The lesson's `initial` block: one check per value, in order, then the summary line. */
export function runChecks(values: readonly number[], fixed: boolean): RunResult {
  const results = values.map((v) => check(v, fixed));
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  const summary = summaryLine(pass, fail);
  const output = [...results.flatMap((r) => (r.failLine ? [r.failLine] : [])), summary];
  return { results, pass, fail, summary, output };
}

export interface Band {
  /** Every value of 0 to 255 where the RTL and the spec disagree. */
  values: number[];
  width: number;
  /** "100" or "none". */
  text: string;
}

/** Sweeps all 256 values of `logic [7:0]` and keeps the ones where alarm !== expected. */
export function disagreementBand(fixed: boolean): Band {
  const values: number[] = [];
  for (let t = TEMP_MIN; t <= TEMP_MAX; t++) if (check(t, fixed).differs === 1) values.push(t);
  return { values, width: values.length, text: values.length ? values.join(", ") : "none" };
}

export const ALL_VALUE_COUNT = TEMP_MAX - TEMP_MIN + 1;

/** Plain-language result of a band, for the reveal and the live region. */
export function bandSentence(fixed: boolean): string {
  const band = disagreementBand(fixed);
  if (band.width === 0) return `With ${rtlOperator(fixed)} the RTL and the spec agree on all ${ALL_VALUE_COUNT} values, so no test value can fail.`;
  const which = band.width === 1 ? `one of the ${ALL_VALUE_COUNT} values, ${band.text}` : `${band.width} of the ${ALL_VALUE_COUNT} values (${band.text})`;
  return `With ${rtlOperator(fixed)} the RTL and the spec disagree on exactly ${which}: the band is ${band.width} value${band.width === 1 ? "" : "s"} wide, so only a test that tries ${band.width === 1 ? "that value" : "one of them"} can fail.`;
}

// ---------------------------------------------------------------------------
// Presets: one per lesson use.

export type PresetId = "typical" | "boundary";

export interface Preset {
  id: PresetId;
  label: string;
  values: readonly number[];
  note: string;
}

export const PRESETS: readonly Preset[] = [
  { id: "typical", label: "Typical values", values: [50, 150], note: "Two values well away from the threshold, the kind a quick test picks." },
  { id: "boundary", label: "Boundary values", values: [99, 100, 101], note: "The lesson's test: just below, exactly at and just above the threshold." },
];

/** Falls back to PRESETS[0], "typical", the component's default, for an unknown id (an untyped MDX string). */
export const presetById = (id: PresetId): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * A custom value: a decimal integer 0 to 255. Anything else is refused with a
 * reason: the lab keeps to the values `logic [7:0]` holds and leaves x and z
 * out on purpose (see X_NOTE).
 */
export function parseTemp(text: string, current: readonly number[]): ParseResult {
  const t = text.trim();
  if (t === "") return { ok: false, error: "Type a whole number from 0 to 255." };
  if (/^[xXzZ?]$/.test(t)) return { ok: false, error: "X and Z are left out of this lab: see the note below." };
  if (!/^-?\d+$/.test(t)) return { ok: false, error: `"${t}" is not a whole number. Type a value from 0 to 255.` };
  const value = Number(t);
  if (value < TEMP_MIN || value > TEMP_MAX) return { ok: false, error: `${t} does not fit in logic [7:0], which holds ${TEMP_MIN} to ${TEMP_MAX}.` };
  if (current.includes(value)) return { ok: false, error: `${value} is already in the test.` };
  if (current.length >= MAX_VALUES) return { ok: false, error: `The test holds at most ${MAX_VALUES} values. Remove one first.` };
  return { ok: true, value };
}

/** Sorted, unique values within range: what a custom test may hold. */
export const normalizeValues = (values: readonly number[]): number[] =>
  Array.from(new Set(values.filter((v) => Number.isInteger(v) && v >= TEMP_MIN && v <= TEMP_MAX))).sort((a, b) => a - b).slice(0, MAX_VALUES);

// ---------------------------------------------------------------------------
// The prediction: what does the summary line print?

export interface CountOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

const listText = (values: readonly number[]) =>
  values.length <= 1 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

/** Why the run prints what it prints, generated from the run itself. */
export function explainRun(values: readonly number[], fixed: boolean): string {
  const run = runChecks(values, fixed);
  const band = disagreementBand(fixed);
  const failing = run.results.filter((r) => !r.pass).map((r) => r.temp);
  if (values.length === 0) return `${run.summary}: the test checks no values, so nothing can fail.`;
  if (band.width === 0) return `${run.summary}: with ${rtlOperator(fixed)} the RTL computes exactly what the spec says for every value, so every check passes.`;
  if (failing.length === 0)
    return `${run.summary}: ${values.length === 1 ? `${values[0]} is not` : `none of ${listText(values)} is`} ${band.text}, the only value where ${rtlOperator(fixed)} and >= disagree, so alarm equals expected every time and the bug stays hidden.`;
  const where = `sits in the disagreement band, where alarm is ${bitText(rtlAlarm(failing[0], fixed))} but expected is ${bitText(specExpected(failing[0]))}`;
  if (failing.length === values.length) return `${run.summary}: ${listText(failing)} ${where}.`;
  return `${run.summary}: only ${listText(failing)} ${where}; every other value lands on the same side of the threshold under both operators.`;
}

/** How many of the test's values land in the band, worded for any count, one value included. */
export function landingText(fail: number, total: number): string {
  if (fail === 0) return total === 1 ? "the one value does not land" : "none of these values lands";
  if (fail === total) return total === 1 ? "the one value lands" : `all ${fail} of these values land`;
  return `only ${fail} of these values ${fail === 1 ? "lands" : "land"}`;
}

/** Every possible summary for this many values, PASS=n down to PASS=0, one of them correct. */
export function countOptions(values: readonly number[], fixed: boolean): CountOption[] {
  const run = runChecks(values, fixed);
  const n = values.length;
  const options: CountOption[] = [];
  for (let pass = n; pass >= 0; pass--) {
    const fail = n - pass;
    const correct = pass === run.pass;
    const counted = `This counts ${fail} failure${fail === 1 ? "" : "s"}`;
    const landing = landingText(run.fail, n);
    let feedback: string;
    if (correct) feedback = explainRun(values, fixed);
    else if (disagreementBand(fixed).width === 0) feedback = `${counted}, but with ${rtlOperator(fixed)} the RTL computes the spec's own comparison, so alarm equals expected for every value and no check can fail.`;
    else if (fail > run.fail) feedback = `${counted}, but a check fails only where alarm !== expected, and ${landing} where ${rtlOperator(fixed)} and >= disagree.`;
    else feedback = `${counted}, but ${run.fail} of these values ${run.fail === 1 ? "lands" : "land"} where ${rtlOperator(fixed)} and >= give different answers, and each of those fails.`;
    options.push({ id: `pass-${pass}`, label: summaryLine(pass, fail), correct, feedback });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Drawing helpers.

/** The values the zoom lens shows around the threshold: 97 to 103 (seven columns fit 390 px). */
export const LENS_VALUES: readonly number[] = Array.from({ length: 7 }, (_, i) => THRESHOLD - 3 + i);

/** A value's place on the 0 to 255 axis as a fraction from 0 to 1 (centre of its slot). */
export const axisFraction = (v: number) => (v - TEMP_MIN + 0.5) / ALL_VALUE_COUNT;

/**
 * Where each test value's marker and label go on the number line. Every value
 * keeps its own triangle at its true place on the axis; only the labels move,
 * stacked into rows so no two labels in a row overlap.
 *
 * Label widths are estimated for the narrowest layout (a 390 px screen leaves
 * about MARKER_AXIS_PX for the axis, and 12 px monospace is about
 * MARKER_CHAR_PX per character), so wider screens only gain room.
 */
export const MARKER_AXIS_PX = 290;
export const MARKER_CHAR_PX = 7.4;
export const MARKER_GAP_PX = 6;

export interface MarkerPlacement {
  value: number;
  /** The triangle's place on the axis, 0 to 1: always axisFraction(value). */
  at: number;
  /** The label's left edge and width, as fractions of the axis (kept inside 0 to 1). */
  labelLeft: number;
  labelWidth: number;
  /** Which label row, 0 first. */
  row: number;
  /** The label: the value, plus its verdict glyph after the reveal. */
  label: string;
}

export interface MarkerLayout {
  markers: MarkerPlacement[];
  rows: number;
}

/** The verdict glyphs the number line shows after the reveal (✓ pass, ✕ fail). */
export const PASS_GLYPH = "✓";
export const FAIL_GLYPH = "✕";

export function markerLayout(values: readonly number[], run: RunResult | null): MarkerLayout {
  const rowEnds: number[] = [];
  const gap = MARKER_GAP_PX / MARKER_AXIS_PX;
  const markers = [...values]
    .sort((a, b) => a - b)
    .map((value) => {
      const result = run?.results.find((r) => r.temp === value);
      const label = result ? `${value} ${result.pass ? PASS_GLYPH : FAIL_GLYPH}` : String(value);
      const at = axisFraction(value);
      const labelWidth = Math.min(1, (label.length * MARKER_CHAR_PX) / MARKER_AXIS_PX);
      const labelLeft = Math.min(Math.max(at - labelWidth / 2, 0), 1 - labelWidth);
      let row = rowEnds.findIndex((end) => end + gap <= labelLeft);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(0);
      }
      rowEnds[row] = labelLeft + labelWidth;
      return { value, at, labelLeft, labelWidth, row, label };
    });
  return { markers, rows: rowEnds.length };
}

/** The pointer the number line draws on the RTL row after the reveal, or null when there is no band. */
export function bandTickLabel(fixed: boolean): string | null {
  const band = disagreementBand(fixed);
  return band.width ? `${band.text}: see close-up` : null;
}

/**
 * The band tick's estimated width as a fraction of the axis, on the same
 * narrowest-layout estimate as markerLayout: the label plus the glyph and its
 * gap (about two characters). Null when there is no tick.
 */
export function bandTickWidth(fixed: boolean): number | null {
  const label = bandTickLabel(fixed);
  return label === null ? null : ((label.length + 2) * MARKER_CHAR_PX) / MARKER_AXIS_PX;
}

// ---------------------------------------------------------------------------
// The next step after a reveal: the junior path typical, then boundary, then fix.

export interface NextStep {
  /** "boundary" switches to the boundary preset, "fix" turns on the fix, null is text only. */
  action: PresetId | "fix" | null;
  text: string;
  /** The button's label, when there is an action. */
  button: string | null;
}

export function nextStep(values: readonly number[], fixed: boolean): NextStep {
  const run = runChecks(values, fixed);
  const band = disagreementBand(fixed);
  if (band.width === 0)
    return { action: null, text: `With ${rtlOperator(fixed)} the band is gone, so no value can fail. Turn the fix off to see the bug come back.`, button: null };
  const boundary = presetById("boundary");
  if (run.fail === 0)
    return {
      action: "boundary",
      text: `${values.length === 1 ? `${values[0]} is not` : `None of ${listText(values)} is`} ${band.text}, so the bug stays hidden. Now try the boundary values ${listText(boundary.values)}.`,
      button: `Try ${boundary.label.toLowerCase()}`,
    };
  const failing = run.results.filter((r) => !r.pass).map((r) => r.temp);
  return {
    action: "fix",
    text: `${listText(failing)} caught the bug. Now fix the RTL (${rtlOperator(false)} becomes ${rtlOperator(true)}) and run the same values again.`,
    button: "Apply the fix",
  };
}

// ---------------------------------------------------------------------------
// The input the lab leaves out on purpose.

/**
 * With temp = X both comparisons give 1'bx (§11.4.4), and x !== x is 1'b0
 * (§11.4.5), so the check would count a pass. F2A covers x, !== and
 * $isunknown; this orientation lab keeps to known values.
 */
export function xInputOutcome(fixed: boolean): { alarm: Bit4; expected: Bit4; differs: Bit } {
  const alarm = rtlAlarm("x", fixed);
  const expected = specExpected("x");
  return { alarm, expected, differs: caseInequal(alarm, expected) };
}

export function xNote(): string {
  const o = xInputOutcome(false);
  return `X and Z are left out on purpose. With temp = X, alarm and expected both become 1'b${o.alarm} (§11.4.4) and 1'b${o.alarm} !== 1'b${o.expected} is ${o.differs} (§11.4.5), so this check would count a pass. F2A covers x, !== and $isunknown.`;
}

export const BOUNDARY_PROBE_ASSUMPTIONS = [
  "Every value comes from the boundary-probe model: IEEE 1800-2023 §11.4.4 (a relational operator yields 1'b0 or 1'b1 for known operands, and compares as unsigned when either operand is unsigned), §6.11.3 (logic defaults to unsigned) and §11.4.5 (!== compares bit for bit, x and z included).",
  "The run reproduces the lesson's testbench: one check per value, in order, a FAIL line for each mismatch, then PASS=%0d FAIL=%0d (§21.2.1.2: %0d prints no padding). The lesson's own output was traced by hand, not taken from a simulator.",
  "Values are whole numbers from 0 to 255, the range of logic [7:0]; the lab refuses anything else, and a custom test holds each value once.",
  xNote(),
];
