/**
 * How $display sizes a number and prints unknown and high-impedance bits.
 *
 * Pure model, no React. Every rule names its clause of IEEE 1800-2023:
 * - §21.2.1.2 "Size of displayed data": the field is sized automatically to
 *   the largest value the expression can hold (a 12-bit expression gets four
 *   columns in decimal because the largest value is 4095, and three in hex
 *   because it is FFF). Decimal suppresses leading zeros and replaces them
 *   with spaces; the other radices always display leading zeros. A field
 *   width of 0 displays the minimum width, with no leading spaces or zeros.
 * - §21.2.1.3 "Unknown and high-impedance values": the digit table encoded in
 *   `digitRule` (one row per bullet of the clause), the 4-bit hex and 3-bit
 *   octal grouping, %b printing every bit, and "decimal numerals always appear
 *   right-justified in a fixed-width field".
 *
 * Scope: unsigned vectors of 1 to 64 bits and the specifiers %d, %0d, %h,
 * %0h, %o, %0o, %b and %0b. Signed values, explicit field widths (%3d) and
 * %x are outside the model; the component says so in its assumptions.
 */

/** BigInt() calls instead of literals: tsconfig targets ES2015. */
const ZERO = BigInt(0);
const ONE = BigInt(1);

export type FourStateBit = "0" | "1" | "x" | "z";
export type Radix = "d" | "h" | "o" | "b";

export interface FormatSpec {
  radix: Radix;
  /** The %0 form: minimum width (§21.2.1.2). */
  minimal: boolean;
}

export const SPECIFIER_IDS = ["%d", "%0d", "%h", "%0h", "%o", "%b"] as const;
export type SpecifierId = (typeof SPECIFIER_IDS)[number];

export const SPECIFIERS: Record<SpecifierId, FormatSpec> = {
  "%d": { radix: "d", minimal: false },
  "%0d": { radix: "d", minimal: true },
  "%h": { radix: "h", minimal: false },
  "%0h": { radix: "h", minimal: true },
  "%o": { radix: "o", minimal: false },
  "%b": { radix: "b", minimal: false },
};

export const specifierText = (spec: FormatSpec): string => `%${spec.minimal ? "0" : ""}${spec.radix}`;

export const RADIX_NAME: Record<Radix, string> = { d: "decimal", h: "hexadecimal", o: "octal", b: "binary" };

/** Bits per printed digit: §21.2.1.3 (4 for hex, 3 for octal); binary prints each bit. Decimal has no digit groups. */
export const GROUP_SIZE: Record<Radix, number | null> = { d: null, h: 4, o: 3, b: 1 };

export const MIN_WIDTH = 1;
export const MAX_WIDTH = 64;

// ---------------------------------------------------------------------------
// §21.2.1.3: the digit table

/**
 * The rows of the §21.2.1.3 table. The same rows apply to a whole decimal
 * value and to each hex or octal digit group:
 * - all-x: all bits unknown, lowercase x
 * - all-z: all bits high impedance, lowercase z
 * - some-x: some but not all bits unknown (and no z), uppercase X
 * - some-z: some but not all bits high impedance and no x, uppercase Z
 * - some-z-and-x: some bits high impedance and some unknown, uppercase X
 * - known: every bit 0 or 1, the ordinary numeral
 */
export type DigitRule = "known" | "all-x" | "all-z" | "some-x" | "some-z" | "some-z-and-x";

export function digitRule(bits: readonly FourStateBit[]): DigitRule {
  const x = bits.filter((b) => b === "x").length;
  const z = bits.filter((b) => b === "z").length;
  if (x === 0 && z === 0) return "known";
  if (x === bits.length) return "all-x";
  if (z === bits.length) return "all-z";
  if (x > 0 && z > 0) return "some-z-and-x";
  if (x > 0) return "some-x";
  return "some-z";
}

/** The character a non-known rule prints (§21.2.1.3). */
export const RULE_CHAR: Record<Exclude<DigitRule, "known">, string> = {
  "all-x": "x",
  "all-z": "z",
  "some-x": "X",
  "some-z": "Z",
  "some-z-and-x": "X",
};

/** One sentence per row of the §21.2.1.3 table, as the component shows it. */
export const RULE_TEXT: Record<DigitRule, string> = {
  known: "every bit is 0 or 1, so the ordinary numeral prints",
  "all-x": "all bits are x, so a lowercase x prints",
  "all-z": "all bits are z, so a lowercase z prints",
  "some-x": "some but not all bits are x, so an uppercase X prints",
  "some-z": "some but not all bits are z and none is x, so an uppercase Z prints",
  "some-z-and-x": "some bits are z but some are also x, so an uppercase X prints (x wins over z)",
};

export const RULE_NAME: Record<DigitRule, string> = {
  known: "known",
  "all-x": "all x",
  "all-z": "all z",
  "some-x": "some x",
  "some-z": "some z, no x",
  "some-z-and-x": "z and x",
};

// ---------------------------------------------------------------------------
// Bits and values

export function isBitString(text: string): boolean {
  return /^[01xz]+$/.test(text.replace(/_/g, "").toLowerCase());
}

/** "10x1" or "0011_xz10_0101" to bits, most significant first. */
export function parseBits(text: string): FourStateBit[] {
  const clean = text.replace(/_/g, "").toLowerCase();
  if (!/^[01xz]+$/.test(clean)) throw new Error(`not a four-state bit string: ${text}`);
  return clean.split("") as FourStateBit[];
}

export const bitsText = (bits: readonly FourStateBit[]): string => bits.join("");

/** An unsigned number as `width` bits, most significant first. */
export function bitsFromNumber(value: number | bigint, width: number): FourStateBit[] {
  const v = BigInt(value);
  if (v < ZERO) throw new Error("the model covers unsigned values only");
  if (v >= ONE << BigInt(width)) throw new Error(`${v} does not fit in ${width} bits`);
  return v.toString(2).padStart(width, "0").split("") as FourStateBit[];
}

/** Resize to a new width, keeping the least significant bits and filling new bits with 0. */
export function resizeBits(bits: readonly FourStateBit[], width: number): FourStateBit[] {
  if (bits.length >= width) return bits.slice(bits.length - width);
  return [...(new Array(width - bits.length).fill("0") as FourStateBit[]), ...bits];
}

/** 0 → 1 → x → z → 0: the order the bit toggles step through. */
export function nextBit(bit: FourStateBit): FourStateBit {
  return bit === "0" ? "1" : bit === "1" ? "x" : bit === "x" ? "z" : "0";
}

const toBigInt = (bits: readonly FourStateBit[]): bigint => bits.reduce((acc, b) => (acc << ONE) | (b === "1" ? ONE : ZERO), ZERO);

const numeral = (value: bigint, radix: Radix): string => value.toString(radix === "d" ? 10 : radix === "h" ? 16 : radix === "o" ? 8 : 2);

/**
 * §21.2.1.2: the automatic field width is the number of characters of the
 * largest value the expression can hold, 2^width − 1 for an unsigned vector.
 */
export function largestValue(width: number, radix: Radix): string {
  const max = (ONE << BigInt(width)) - ONE;
  const text = numeral(max, radix);
  return radix === "h" ? text.toUpperCase() : text;
}

export const autoColumns = (width: number, radix: Radix): number => largestValue(width, radix).length;

// ---------------------------------------------------------------------------
// Formatting

export interface DigitGroup {
  /** Bit numbers of the group, [hi:lo] with bit 0 the least significant. */
  hi: number;
  lo: number;
  bits: FourStateBit[];
  rule: DigitRule;
  char: string;
}

export interface FormatResult {
  bits: FourStateBit[];
  width: number;
  spec: FormatSpec;
  specifier: string;
  /** The printed text, padding included. */
  text: string;
  /** The value's own characters, before padding or zero removal. */
  digits: string;
  /** One group for decimal (the whole value), one per digit for hex, octal and binary. */
  groups: DigitGroup[];
  /** §21.2.1.2: the automatic width (largest value's columns), or null for the %0 form. */
  autoColumns: number | null;
  largestValue: string;
  /** Spaces added on the left (decimal). */
  padSpaces: number;
  /** Leading zero digits kept (hex, octal, binary at automatic width). */
  leadingZerosKept: number;
  /** Leading zero digits removed by the %0 form. */
  leadingZerosRemoved: number;
  /** The rule that decided a decimal value with x or z bits. */
  decimalRule: DigitRule | null;
  /** The explanation lines, generated from the result. */
  widthSentence: string;
  ruleSentences: string[];
}

function digitGroups(bits: readonly FourStateBit[], size: number, radix: Radix): DigitGroup[] {
  const w = bits.length;
  const groups: DigitGroup[] = [];
  // Groups are counted from the least significant bit, as the §21.2.1.3 example xxXa (14 bits in hex) shows; the top one may be shorter.
  for (let lo = 0; lo < w; lo += size) {
    const hi = Math.min(lo + size - 1, w - 1);
    const slice = bits.slice(w - 1 - hi, w - lo);
    const rule = digitRule(slice);
    const char = rule === "known" ? numeral(toBigInt(slice), radix) : RULE_CHAR[rule];
    groups.unshift({ hi, lo, bits: slice, rule, char });
  }
  return groups;
}

export function formatValue(bits: readonly FourStateBit[], spec: FormatSpec): FormatResult {
  const width = bits.length;
  if (width < MIN_WIDTH || width > MAX_WIDTH) throw new Error(`width ${width} is outside 1 to ${MAX_WIDTH}`);
  const specifier = specifierText(spec);
  const largest = largestValue(width, spec.radix);
  const auto = spec.minimal ? null : largest.length;
  const radixName = RADIX_NAME[spec.radix];

  let groups: DigitGroup[];
  let digits: string;
  let decimalRule: DigitRule | null = null;
  if (spec.radix === "d") {
    // §21.2.1.3: in decimal the whole value is one "digit" for the x/z table.
    const rule = digitRule(bits);
    digits = rule === "known" ? toBigInt(bits).toString(10) : RULE_CHAR[rule];
    decimalRule = rule === "known" ? null : rule;
    groups = [{ hi: width - 1, lo: 0, bits: [...bits], rule, char: digits }];
  } else {
    groups = digitGroups(bits, GROUP_SIZE[spec.radix] as number, spec.radix);
    digits = groups.map((g) => g.char).join("");
  }

  let text = digits;
  let padSpaces = 0;
  let leadingZerosKept = 0;
  let leadingZerosRemoved = 0;
  if (spec.radix === "d") {
    // §21.2.1.2: leading zeros become spaces; §21.2.1.3: right-justified in a fixed-width field.
    if (auto !== null) {
      padSpaces = Math.max(0, auto - digits.length);
      text = " ".repeat(padSpaces) + digits;
    }
  } else {
    const leading = digits.match(/^0+/)?.[0].length ?? 0;
    // A value of all zeros keeps one digit.
    const removable = Math.min(leading, digits.length - 1);
    if (spec.minimal) {
      leadingZerosRemoved = removable;
      text = digits.slice(removable);
    } else {
      leadingZerosKept = removable;
    }
  }

  const columns = (n: number) => `${n} ${n === 1 ? "column" : "columns"}`;
  let widthSentence: string;
  if (auto === null) {
    widthSentence =
      spec.radix === "d"
        ? `${specifier} prints the minimum width, with no leading spaces: ${columns(text.length)} (§21.2.1.2).`
        : `${specifier} prints the minimum width, with no leading zeros${leadingZerosRemoved ? ` (${leadingZerosRemoved} removed)` : ""}: ${columns(text.length)} (§21.2.1.2).`;
  } else if (spec.radix === "d") {
    widthSentence = `A ${width}-bit value can be as large as ${largest}, which needs ${columns(auto)} in decimal, so the field is ${columns(auto)}${
      padSpaces ? ` and ${padSpaces} leading ${padSpaces === 1 ? "space fills" : "spaces fill"} it` : ""
    } (§21.2.1.2).`;
  } else {
    widthSentence = `A ${width}-bit value can be as large as ${largest} in ${radixName}, which needs ${columns(auto)}${
      leadingZerosKept
        ? `, and the ${leadingZerosKept} leading ${leadingZerosKept === 1 ? "zero stays" : "zeros stay"}${/^0+$/.test(digits) ? " before the value's own 0" : ""}`
        : ""
    } (§21.2.1.2).`;
  }

  const ruleSentences: string[] = [];
  if (spec.radix === "d") {
    if (decimalRule) ruleSentences.push(`In decimal the whole value is decided at once: ${RULE_TEXT[decimalRule]} (§21.2.1.3).`);
  } else if (spec.radix === "b") {
    if (bits.some((b) => b === "x" || b === "z")) ruleSentences.push("%b prints each bit separately as 0, 1, x or z (§21.2.1.3).");
  } else {
    const size = GROUP_SIZE[spec.radix] as number;
    groups
      .filter((g) => g.rule !== "known")
      .forEach((g) => ruleSentences.push(`Bits [${g.hi}:${g.lo}] are ${bitsText(g.bits)}: ${RULE_TEXT[g.rule]} (§21.2.1.3).`));
    if (width % size !== 0) {
      const top = groups[0];
      ruleSentences.push(
        `${width} bits do not divide into groups of ${size}, so the top digit covers only bits [${top.hi}:${top.lo}]; groups are counted from bit 0, as the §21.2.1.3 example xxXa (14 bits in hex) shows.`,
      );
    }
  }

  return {
    bits: [...bits],
    width,
    spec,
    specifier,
    text,
    digits,
    groups,
    autoColumns: auto,
    largestValue: largest,
    padSpaces,
    leadingZerosKept,
    leadingZerosRemoved,
    decimalRule,
    widthSentence,
    ruleSentences,
  };
}

/** Shorthand for a specifier id. */
export const formatWith = (bits: readonly FourStateBit[], id: SpecifierId): FormatResult => formatValue(bits, SPECIFIERS[id]);

/** The text an unsigned number prints with a specifier, e.g. for building $monitor lines. */
export const formatNumber = (value: number | bigint, width: number, id: SpecifierId): string => formatWith(bitsFromNumber(value, width), id).text;

// ---------------------------------------------------------------------------
// Grading a typed prediction

export const SPACE_GLYPH = "·";

/** The learner may type a space or the · glyph for a space. */
export const normalizeGuess = (guess: string): string => guess.split(SPACE_GLYPH).join(" ");

export type GuessReason =
  | "exact"
  /** Right except for the case of a hex letter a to f, which the standard does not fix: accepted. */
  | "hex-letter-case"
  | "empty"
  | "padding"
  | "dropped-zeros"
  | "extra-zeros"
  | "spaces-for-zeros"
  | "case"
  | "partial-number"
  | "other";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The standard never states whether the hex letters a to f print in upper or
 * lower case. The §21.2.1.2 and §21.2.1.3 examples print them in lowercase
 * (":00a:", "xxXa"); the uppercase FFF in the size rule only spells the largest value.
 */
export const HEX_LETTER_CASE_SENTENCE =
  "The standard does not state the case of the hex letters a to f; its examples in §21.2.1.2 and §21.2.1.3 print them in lowercase (:00a:), and the uppercase FFF in the size rule only spells the largest value, so the lab accepts either case for a to f.";

/** The x/z case sentence of §21.2.1.3. */
export const XZ_CASE_SENTENCE = "The case of x and z carries meaning: lowercase means every bit, uppercase means some bits.";

export interface CellCompare {
  index: number;
  expected: string | null;
  guessed: string | null;
  match: boolean;
}

export interface GuessGrade {
  correct: boolean;
  reason: GuessReason;
  /** Generated from the result; never typed per preset. */
  sentence: string;
  cells: CellCompare[];
}

const show = (text: string) => `"${text.split(" ").join(SPACE_GLYPH)}"`;

/** Leading padding: the spaces and zeros before the value's first other character (one character is always kept). */
const leadingPad = (text: string): string => text.match(/^[ 0]*(?=.)/)?.[0] ?? "";

export function gradeGuess(result: FormatResult, rawGuess: string): GuessGrade {
  const typed = normalizeGuess(rawGuess);
  const radix = result.spec.radix;
  const radixName = capitalize(RADIX_NAME[radix]);
  // Only hex has letters other than x and z. Their case is not fixed by the standard, so it is folded away.
  const guess = radix === "h" ? typed.replace(/[A-F]/g, (c) => c.toLowerCase()) : typed;
  const hexLetterCaseDiffers = guess !== typed;
  const expected = result.text;
  const n = Math.max(guess.length, expected.length);
  const cells: CellCompare[] = [];
  // Right-aligned comparison: printed numbers line up on their last digit.
  for (let i = 0; i < n; i += 1) {
    const e = expected[expected.length - n + i] ?? null;
    const g = typed[typed.length - n + i] ?? null;
    const folded = guess[guess.length - n + i] ?? null;
    cells.push({ index: i, expected: e, guessed: g, match: e !== null && e === folded });
  }
  const answer = `It prints ${show(expected)}.`;
  const rules = result.ruleSentences.length ? ` ${result.ruleSentences.join(" ")}` : "";
  if (guess === expected) {
    if (hexLetterCaseDiffers) return { correct: true, reason: "hex-letter-case", sentence: `${answer} ${HEX_LETTER_CASE_SENTENCE} ${result.widthSentence}${rules}`, cells };
    return { correct: true, reason: "exact", sentence: `${answer} ${result.widthSentence}${rules}`, cells };
  }
  // A wrong answer that also has an uppercase hex letter says why that letter was not the problem.
  const hexNote = hexLetterCaseDiffers ? ` ${HEX_LETTER_CASE_SENTENCE}` : "";
  const wrong = (reason: GuessReason, body: string): GuessGrade => ({ correct: false, reason, sentence: `${answer} ${body}${hexNote}`, cells });

  if (guess.length === 0) return { correct: false, reason: "empty", sentence: `Nothing was typed. ${answer}`, cells };
  const guessPad = leadingPad(guess);
  const expectedPad = leadingPad(expected);
  const trimmedGuess = guess.slice(guessPad.length);
  const trimmedExpected = expected.slice(expectedPad.length);
  if (radix === "d" && /^\s*\d+$/.test(guess) && result.decimalRule) {
    return wrong("partial-number", `A decimal value with x or z bits never prints a partial number: ${RULE_TEXT[result.decimalRule]} (§21.2.1.3).`);
  }
  // The value's characters differ only in the case of x or z (§21.2.1.3).
  if (trimmedGuess !== trimmedExpected && trimmedGuess.toLowerCase() === trimmedExpected.toLowerCase()) {
    const padLine = guessPad === expectedPad ? "" : ` The padding is also wrong. ${result.widthSentence}`;
    return wrong("case", `${XZ_CASE_SENTENCE}${rules}${padLine}`);
  }
  if (trimmedGuess === trimmedExpected) {
    if (radix === "d") {
      const zeros = guessPad.includes("0") ? " Decimal suppresses leading zeros and replaces them with spaces (§21.2.1.2)." : "";
      return wrong("padding", `The characters are right but the padding is not.${zeros} ${result.widthSentence}`);
    }
    if (guessPad.includes(" ")) {
      const how = result.spec.minimal
        ? `${result.specifier} pads with neither spaces nor zeros.`
        : `${radixName} pads with leading zeros, not spaces: only decimal turns leading zeros into spaces (§21.2.1.2).`;
      return wrong("spaces-for-zeros", `${how} ${result.widthSentence}`);
    }
    if (guess.length < expected.length) return wrong("dropped-zeros", `${radixName} keeps its leading zeros unless you write %0${radix}. ${result.widthSentence}`);
    const extra = guess.length - expected.length;
    return wrong("extra-zeros", `That is ${extra} leading ${extra === 1 ? "zero" : "zeros"} more than the field holds. ${result.widthSentence}`);
  }
  return wrong("other", `${result.widthSentence}${rules}`);
}

// ---------------------------------------------------------------------------
// Presets: one per lesson use

export const FORMAT_WIDTHS = [4, 9, 12] as const;
export type FormatWidth = (typeof FORMAT_WIDTHS)[number];

export interface FormatPreset {
  id: string;
  label: string;
  /** What the preset shows, generated where it states a value. */
  bits: FourStateBit[];
  specifier: SpecifierId;
}

export const FORMAT_PRESETS: readonly FormatPreset[] = [
  // The lesson's padding line and the §21.2.1.2 example: r1 = 10 on 12 bits.
  { id: "r1", label: "r1 = 10 on 12 bits", bits: bitsFromNumber(10, 12), specifier: "%d" },
  // The lesson's n = 4'b10x1 and quiz question 2.
  { id: "10x1", label: "4'b10x1", bits: parseBits("10x1"), specifier: "%h" },
  { id: "all-z", label: "All z", bits: parseBits("zzzzzzzzz"), specifier: "%d" },
  { id: "xz-digit", label: "x and z in one digit", bits: parseBits("0011_xz10_0101"), specifier: "%h" },
];

export const findFormatPreset = (id: string | undefined): FormatPreset => FORMAT_PRESETS.find((p) => p.id === id) ?? FORMAT_PRESETS[0];

/** A literal for the bits, e.g. 12'b0000_0000_1010, with an underscore every four bits from the right. */
export function literalText(bits: readonly FourStateBit[]): string {
  const w = bits.length;
  let out = "";
  bits.forEach((b, k) => {
    if (k > 0 && (w - k) % 4 === 0) out += "_";
    out += b;
  });
  return `${w}'b${out}`;
}
