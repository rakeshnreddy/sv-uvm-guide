/**
 * Deterministic educational model of SystemVerilog four-state values,
 * X/Z behaviour, nets versus variables, and net resolution.
 *
 * Every rule below was checked against the text of IEEE 1800-2023; the
 * clause or table is cited next to the code that implements it.
 *
 * Scope and assumptions (also surfaced to learners in the UI):
 * - Values are bit vectors written MSB first ("1x0z" = 4'b1x0z). Vectors of
 *   unequal width are zero-extended, i.e. operands are treated as unsigned.
 * - Net resolution works on one scalar net. Each driver has one value
 *   (0/1/x/z) and one drive strength applied to both its 0 and its 1
 *   (`assign (strong0, strong1) …`). L/H partial values from gates, charge
 *   decay delays, switches and user-defined nettypes are not modelled.
 * - Driver legality treats a variable as a single element. The standard
 *   checks each element of the longest static prefix separately (§6.5).
 */

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

/** One 4-state bit (§6.3.1): 0, 1, x (unknown) or z (high impedance). */
export type Bit4 = "0" | "1" | "x" | "z";

export const BIT4_VALUES: readonly Bit4[] = ["0", "1", "x", "z"];

export const isUnknownBit = (b: Bit4) => b === "x" || b === "z";
export const isKnownBit = (b: Bit4) => b === "0" || b === "1";

/**
 * Parses a binary literal body, MSB first. Accepts upper-case X/Z,
 * `?` as z (§5.7.1 / §12.5.1) and `_` separators.
 */
export function parseBits(text: string): Bit4[] {
  const bits: Bit4[] = [];
  for (const raw of text.replace(/_/g, "").toLowerCase()) {
    if (raw === "0" || raw === "1" || raw === "x" || raw === "z") bits.push(raw);
    else if (raw === "?") bits.push("z");
    else throw new Error(`Not a 4-state bit: "${raw}"`);
  }
  if (bits.length === 0) throw new Error("Empty bit vector");
  return bits;
}

export const bitsToString = (bits: readonly Bit4[]) => bits.join("");

/** Sized binary literal, e.g. `4'b1x0z`. */
export const formatLiteral = (bits: readonly Bit4[]) => `${bits.length}'b${bitsToString(bits)}`;

/** `$isunknown(e)`: 1 if any bit is x or z (§20.9). */
export const hasUnknown = (bits: readonly Bit4[]) => bits.some(isUnknownBit);

/** Zero-extends (unsigned) or truncates the MSBs to `width` bits (§6.11.2, §11.6). */
export function resize(bits: readonly Bit4[], width: number): Bit4[] {
  if (bits.length === width) return [...bits];
  if (bits.length > width) return bits.slice(bits.length - width);
  return [...Array<Bit4>(width - bits.length).fill("0"), ...bits];
}

function extendPair(a: readonly Bit4[], b: readonly Bit4[]): [Bit4[], Bit4[]] {
  const width = Math.max(a.length, b.length);
  return [resize(a, width), resize(b, width)];
}

/** Unsigned value of a fully known vector, otherwise null. */
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

export function toUnsigned(bits: readonly Bit4[]): bigint | null {
  if (hasUnknown(bits)) return null;
  return bits.reduce((acc, b) => acc * TWO + (b === "1" ? ONE : ZERO), ZERO);
}

/** Two's-complement value of a fully known vector, otherwise null. */
export function toSigned(bits: readonly Bit4[]): bigint | null {
  const u = toUnsigned(bits);
  if (u === null) return null;
  return bits[0] === "1" ? u - (ONE << BigInt(bits.length)) : u;
}

/** Vector of `width` bits holding `value` (two's complement for negatives). */
export function fromNumber(value: number | bigint, width: number): Bit4[] {
  const mod = ONE << BigInt(width);
  let v = BigInt(value) % mod;
  if (v < ZERO) v += mod;
  const bits: Bit4[] = [];
  for (let i = width - 1; i >= 0; i -= 1) bits.push(((v >> BigInt(i)) & ONE) === ONE ? "1" : "0");
  return bits;
}

/* ------------------------------------------------------------------ */
/* Bitwise and reduction operators (§11.4.8, §11.4.9)                  */
/* ------------------------------------------------------------------ */

export type BinaryBitwiseOp = "&" | "|" | "^" | "~^";

type Table = Record<Bit4, Record<Bit4, Bit4>>;

/** Builds a table from rows written in the standard's order 0, 1, x, z. */
function table(rows: [string, string, string, string]): Table {
  const out = {} as Table;
  BIT4_VALUES.forEach((left, i) => {
    out[left] = {} as Record<Bit4, Bit4>;
    BIT4_VALUES.forEach((right, j) => {
      out[left][right] = rows[i][j] as Bit4;
    });
  });
  return out;
}

/** Tables 11-11 … 11-14 (rows: left operand 0, 1, x, z; columns: right operand). */
export const BITWISE_TABLES: Record<BinaryBitwiseOp, Table> = {
  "&": table(["0000", "01xx", "0xxx", "0xxx"]), // Table 11-11
  "|": table(["01xx", "1111", "x1xx", "x1xx"]), // Table 11-12
  "^": table(["01xx", "10xx", "xxxx", "xxxx"]), // Table 11-13
  "~^": table(["10xx", "01xx", "xxxx", "xxxx"]), // Table 11-14
};

export const BITWISE_TABLE_NAMES: Record<BinaryBitwiseOp | "~", string> = {
  "&": "Table 11-11",
  "|": "Table 11-12",
  "^": "Table 11-13",
  "~^": "Table 11-14",
  "~": "Table 11-15",
};

/** Table 11-15: unary negation. */
const NOT_TABLE: Record<Bit4, Bit4> = { "0": "1", "1": "0", x: "x", z: "x" };

export const bitwiseBit = (op: BinaryBitwiseOp, a: Bit4, b: Bit4): Bit4 => BITWISE_TABLES[op][a][b];
export const notBit = (a: Bit4): Bit4 => NOT_TABLE[a];

export function bitwiseVec(op: BinaryBitwiseOp, a: readonly Bit4[], b: readonly Bit4[]): Bit4[] {
  const [x, y] = extendPair(a, b);
  return x.map((bit, i) => bitwiseBit(op, bit, y[i]));
}

export const notVec = (a: readonly Bit4[]): Bit4[] => a.map(notBit);

/** The value that forces an operator's result regardless of the other operand. */
export const CONTROLLING_VALUE: Partial<Record<BinaryBitwiseOp, Bit4>> = { "&": "0", "|": "1" };

/** One sentence explaining a single-bit result from the governing truth table. */
export function explainBitwise(op: BinaryBitwiseOp | "~", a: Bit4, b?: Bit4): string {
  if (op === "~") {
    const r = notBit(a);
    if (isKnownBit(a)) return `~ inverts a known bit: ~${a} = ${r} (Table 11-15).`;
    return `~ cannot invert an unknown: ~${a} = x. A z input is read as unknown, so it also becomes x (Table 11-15).`;
  }
  const right = b ?? "0";
  const r = bitwiseBit(op, a, right);
  const name = BITWISE_TABLE_NAMES[op];
  const controlling = CONTROLLING_VALUE[op];
  if (isKnownBit(a) && isKnownBit(right)) {
    return `Both bits are known, so ${op} acts as ordinary Boolean logic: ${a} ${op} ${right} = ${r} (${name}).`;
  }
  if (controlling && (a === controlling || right === controlling)) {
    return `${controlling} is the controlling value of ${op}: one ${controlling} forces the result to ${r} whatever the other bit is (${name}).`;
  }
  if (op === "^" || op === "~^") {
    return `${op} has no controlling value: flipping either input flips the output, so any x or z input makes the result x (${name}).`;
  }
  return `No operand forces the answer and the unknown bit could be 0 or 1, so the result is x. A z input counts as unknown for logic operators (${name}).`;
}

/** Diagnoses a wrong single-bit guess for `a op b` (or `~a`). */
export function diagnoseBitwiseGuess(op: BinaryBitwiseOp | "~", a: Bit4, b: Bit4 | undefined, guess: Bit4): string {
  const r = op === "~" ? notBit(a) : bitwiseBit(op, a, b ?? "0");
  if (guess === r) return explainBitwise(op, a, b);
  if (guess === "z") return "Logic operators never produce z. A z operand is treated as an unknown input, so the output is 0, 1 or x.";
  const controlling = op === "~" ? undefined : CONTROLLING_VALUE[op];
  if (guess === "x" && isKnownBit(r)) {
    if (controlling && (a === controlling || b === controlling)) {
      return `An unknown input does not always give x: here the ${controlling} decides the result on its own, so the other bit cannot matter.`;
    }
    return "Both operands are known, so no unknown can appear in the result.";
  }
  if (r === "x") {
    return "Nothing forces the answer: the unknown input could be 0 or 1 and the two cases give different outputs, so the simulator reports x.";
  }
  return `Read the truth table again: ${op === "~" ? `~${a}` : `${a} ${op} ${b}`} is ${r}.`;
}

export type ReductionOp = "&" | "~&" | "|" | "~|" | "^" | "~^";

/**
 * Reduction operators (§11.4.9): apply Table 11-16…11-18 bit by bit, left to
 * right; the NAND/NOR/XNOR forms invert the result.
 */
export function reduce(op: ReductionOp, bits: readonly Bit4[]): Bit4 {
  const base: BinaryBitwiseOp = op === "&" || op === "~&" ? "&" : op === "|" || op === "~|" ? "|" : "^";
  const r = bits.slice(1).reduce<Bit4>((acc, b) => bitwiseBit(base, acc, b), bits[0]);
  return op.startsWith("~") ? notBit(r) : r;
}

/* ------------------------------------------------------------------ */
/* Truth values and logical operators (§11.4.7, §12.4)                 */
/* ------------------------------------------------------------------ */

export type Truth = "true" | "false" | "unknown";

/**
 * A value is true when it is known to be nonzero (any bit is 1), false when
 * every bit is 0, and ambiguous otherwise (§11.4.7, §12.4).
 */
export function truthOf(bits: readonly Bit4[]): Truth {
  if (bits.some((b) => b === "1")) return "true";
  if (bits.every((b) => b === "0")) return "false";
  return "unknown";
}

const truthBit = (t: Truth): Bit4 => (t === "true" ? "1" : t === "false" ? "0" : "x");

/** `!a`: 1'b0 for true, 1'b1 for false, 1'bx when ambiguous (§11.4.7). */
export const logicalNot = (a: readonly Bit4[]): Bit4 => {
  const t = truthOf(a);
  return t === "true" ? "0" : t === "false" ? "1" : "x";
};

/** `a && b` (§11.4.7). */
export function logicalAnd(a: readonly Bit4[], b: readonly Bit4[]): Bit4 {
  const [ta, tb] = [truthOf(a), truthOf(b)];
  if (ta === "false" || tb === "false") return "0";
  if (ta === "true" && tb === "true") return "1";
  return "x";
}

/** `a || b` (§11.4.7). */
export function logicalOr(a: readonly Bit4[], b: readonly Bit4[]): Bit4 {
  const [ta, tb] = [truthOf(a), truthOf(b)];
  if (ta === "true" || tb === "true") return "1";
  if (ta === "false" && tb === "false") return "0";
  return "x";
}

/** Arithmetic: any x or z operand bit makes the whole result x (§11.4.3). */
export function add(a: readonly Bit4[], b: readonly Bit4[], width = Math.max(a.length, b.length)): Bit4[] {
  if (hasUnknown(a) || hasUnknown(b)) return Array<Bit4>(width).fill("x");
  return fromNumber((toUnsigned(a) ?? ZERO) + (toUnsigned(b) ?? ZERO), width);
}

/* ------------------------------------------------------------------ */
/* Equality operators (§11.4.5, §11.4.6)                               */
/* ------------------------------------------------------------------ */

export type EqualityOp = "==" | "!=" | "===" | "!==" | "==?" | "!=?";

export type BitOutcome = "match" | "mismatch" | "ambiguous" | "wildcard";

export interface BitComparison {
  /** Bit index, MSB = width - 1. */
  index: number;
  a: Bit4;
  b: Bit4;
  outcome: BitOutcome;
}

export interface EqualityResult {
  op: EqualityOp;
  result: Bit4;
  bits: BitComparison[];
  why: string;
}

function compareBits(a: readonly Bit4[], b: readonly Bit4[], mode: "logical" | "case" | "wildcard"): BitComparison[] {
  const [x, y] = extendPair(a, b);
  return x.map((ab, i) => {
    const bb = y[i];
    const index = x.length - 1 - i;
    let outcome: BitOutcome;
    if (mode === "case") outcome = ab === bb ? "match" : "mismatch";
    else if (mode === "wildcard" && isUnknownBit(bb)) outcome = "wildcard";
    else if (isUnknownBit(ab) || isUnknownBit(bb)) outcome = "ambiguous";
    else outcome = ab === bb ? "match" : "mismatch";
    return { index, a: ab, b: bb, outcome };
  });
}

const invert = (b: Bit4): Bit4 => notBit(b);

/**
 * `==` / `!=`: 0 when some pair of known bits differs, x when the relation
 * is ambiguous because of x/z bits, else 1 (§11.4.5).
 * `===` / `!==`: x and z compared literally, never x (§11.4.5).
 * `==?` / `!=?`: x/z in the RIGHT operand are wildcards; x/z in the left
 * operand are compared as for `==` (§11.4.6).
 */
export function compare(op: EqualityOp, a: readonly Bit4[], b: readonly Bit4[]): EqualityResult {
  const mode = op === "===" || op === "!==" ? "case" : op === "==?" || op === "!=?" ? "wildcard" : "logical";
  const bits = compareBits(a, b, mode);
  const mismatch = bits.find((c) => c.outcome === "mismatch");
  const ambiguous = bits.find((c) => c.outcome === "ambiguous");
  let equal: Bit4;
  let why: string;
  if (mode === "case") {
    equal = mismatch ? "0" : "1";
    why = mismatch
      ? `=== compares x and z literally. Bit ${mismatch.index} is ${mismatch.a} versus ${mismatch.b}, so the operands differ: the result is a known 0 (§11.4.5).`
      : "=== compares every bit literally, including x and z. All bits are identical, so the result is a known 1 (§11.4.5).";
  } else {
    const opName = mode === "wildcard" ? "==?" : "==";
    if (mismatch) {
      equal = "0";
      why = `Bit ${mismatch.index} is known in both operands and differs (${mismatch.a} vs ${mismatch.b}). Whatever the unknown bits are, the operands cannot be equal, so ${opName} gives 0 (${mode === "wildcard" ? "§11.4.6" : "§11.4.5"}).`;
    } else if (ambiguous) {
      equal = "x";
      why = `Every known bit matches, but bit ${ambiguous.index} is ${ambiguous.a} vs ${ambiguous.b}. The relation is ambiguous, so ${opName} gives x (${mode === "wildcard" ? "§11.4.6: x/z in the left operand are not wildcards" : "§11.4.5"}). An if treats that x as false.`;
    } else {
      equal = "1";
      why =
        mode === "wildcard" && bits.some((c) => c.outcome === "wildcard")
          ? "Every bit either matches or sits under an x/z wildcard in the right operand, so ==? gives 1 (§11.4.6)."
          : `All bits are known and equal, so ${opName} gives 1.`;
    }
  }
  const negated = op === "!=" || op === "!==" || op === "!=?";
  return { op, result: negated ? invert(equal) : equal, bits, why };
}

/** Diagnoses a guess for `a == b`. */
export function diagnoseEqualityGuess(a: readonly Bit4[], b: readonly Bit4[], guess: Bit4): string {
  const eq = compare("==", a, b);
  if (guess === eq.result) return eq.why;
  const anyUnknown = hasUnknown(a) || hasUnknown(b);
  if (guess === "x" && eq.result === "0") {
    return "An x in one operand does not automatically poison ==. A known bit that differs already proves the operands unequal, so the answer is a definite 0.";
  }
  if (guess === "x" && eq.result === "1") return "Every bit is known, so == cannot be ambiguous.";
  if (guess === "1" && eq.result === "x") {
    return "== does not treat x as matching x. An x bit could be 0 or 1, so equality is unknown. That literal match is what === is for.";
  }
  if (guess === "0" && eq.result === "x") {
    return "No known bit differs, so the operands might be equal. == reports that doubt as x, not as 0.";
  }
  if (guess === "z") return "Comparisons return a 1-bit 0, 1 or x, never z.";
  return anyUnknown ? eq.why : `Compare bit by bit: ${eq.why}`;
}

/* ------------------------------------------------------------------ */
/* Control flow with x/z (§12.4, §12.5, §12.5.1, §11.4.11)             */
/* ------------------------------------------------------------------ */

/**
 * if-else: the first statement runs only for a nonzero known value; a zero,
 * x or z condition is false, so the else branch runs (§12.4).
 */
export function ifBranch(cond: readonly Bit4[]): "then" | "else" {
  return truthOf(cond) === "true" ? "then" : "else";
}

export type CaseKind = "case" | "casez" | "casex";

/**
 * case: every bit must match exactly with respect to 0, 1, x and z (§12.5).
 * casez: z (and ?) in either the case expression or the item is a do-not-care.
 * casex: x and z in either one are do-not-cares (§12.5.1).
 */
export function caseItemMatches(kind: CaseKind, expr: readonly Bit4[], item: readonly Bit4[]): boolean {
  const [x, y] = extendPair(expr, item);
  return x.every((e, i) => {
    const it = y[i];
    if (kind === "casez" && (e === "z" || it === "z")) return true;
    if (kind === "casex" && (isUnknownBit(e) || isUnknownBit(it))) return true;
    return e === it;
  });
}

/** Linear search in source order; returns the first matching item index or "default" (§12.5). */
export function selectCaseItem(kind: CaseKind, expr: readonly Bit4[], items: readonly (readonly Bit4[])[]): number | "default" {
  const hit = items.findIndex((item) => caseItemMatches(kind, expr, item));
  return hit === -1 ? "default" : hit;
}

/** Explains why one case item did or did not match. */
export function explainCaseItem(kind: CaseKind, expr: readonly Bit4[], item: readonly Bit4[]): string {
  const [x, y] = extendPair(expr, item);
  const literal = formatLiteral(y);
  if (caseItemMatches(kind, expr, item)) {
    const dontCare = x
      .map((e, i) => ({ e, it: y[i], index: x.length - 1 - i }))
      .filter(({ e, it }) => (kind === "casez" && (e === "z" || it === "z")) || (kind === "casex" && (isUnknownBit(e) || isUnknownBit(it))));
    if (dontCare.length === 0) return `${literal} matches bit for bit.`;
    const fromExpr = dontCare.some(({ e }) => (kind === "casex" ? isUnknownBit(e) : e === "z"));
    return `${literal} matches: ${kind} ignores bit${dontCare.length > 1 ? "s" : ""} ${dontCare.map((d) => d.index).join(", ")}${
      fromExpr ? ", including the unknown bit of the case expression itself" : ""
    } (§12.5.1).`;
  }
  const i = x.findIndex((e, k) => {
    const it = y[k];
    if (kind === "casez" && (e === "z" || it === "z")) return false;
    if (kind === "casex" && (isUnknownBit(e) || isUnknownBit(it))) return false;
    return e !== it;
  });
  const index = x.length - 1 - i;
  const note =
    kind === "case" && (isUnknownBit(x[i]) || isUnknownBit(y[i]))
      ? " A plain case compares x and z literally, like ===."
      : kind === "casez" && x[i] === "x"
        ? " casez only ignores z, so an x still has to match exactly."
        : "";
  return `${literal} fails at bit ${index} (${x[i]} vs ${y[i]}).${note}`;
}

/** Table 11-20: how `?:` combines its two results when the condition is ambiguous. */
const CONDITIONAL_MERGE: Table = table(["0xxx", "x1xx", "xxxx", "xxxx"]);

/**
 * `cond ? a : b` (§11.4.11): a true condition yields a, false yields b. An
 * ambiguous condition evaluates both; if they are logically equal (==) the
 * result is that value, otherwise they are merged bit by bit with Table 11-20.
 */
export function conditionalOp(cond: readonly Bit4[], a: readonly Bit4[], b: readonly Bit4[]): Bit4[] {
  const t = truthOf(cond);
  const [x, y] = extendPair(a, b);
  if (t === "true") return x;
  if (t === "false") return y;
  if (compare("==", x, y).result === "1") return x;
  return x.map((bit, i) => CONDITIONAL_MERGE[bit][y[i]]);
}

/* ------------------------------------------------------------------ */
/* Types, defaults and 2-state conversion (§6.8, §6.11)                */
/* ------------------------------------------------------------------ */

export type IntegralTypeId = "logic" | "reg" | "integer" | "time" | "bit" | "byte" | "shortint" | "int" | "longint";

export interface IntegralTypeInfo {
  id: IntegralTypeId;
  /** Fixed width, or null for user-defined vector width (`logic [N-1:0]`). */
  width: number | null;
  states: 2 | 4;
  signed: boolean;
}

/** Table 6-8 (Integer data types). */
export const INTEGRAL_TYPES: Record<IntegralTypeId, IntegralTypeInfo> = {
  logic: { id: "logic", width: null, states: 4, signed: false },
  reg: { id: "reg", width: null, states: 4, signed: false },
  integer: { id: "integer", width: 32, states: 4, signed: true },
  time: { id: "time", width: 64, states: 4, signed: false },
  bit: { id: "bit", width: null, states: 2, signed: false },
  byte: { id: "byte", width: 8, states: 2, signed: true },
  shortint: { id: "shortint", width: 16, states: 2, signed: true },
  int: { id: "int", width: 32, states: 2, signed: true },
  longint: { id: "longint", width: 64, states: 2, signed: true },
};

/** Default initial value of a variable with no initializer (Table 6-7): 4-state 'x, 2-state '0. */
export function defaultVariableValue(typeId: IntegralTypeId, width?: number): Bit4[] {
  const info = INTEGRAL_TYPES[typeId];
  const w = info.width ?? width ?? 1;
  return Array<Bit4>(w).fill(info.states === 4 ? "x" : "0");
}

/** Default value of an undriven net: z, except trireg which starts at x (§6.7.1). */
export function defaultNetValue(netType: NetType, width = 1): Bit4[] {
  return Array<Bit4>(width).fill(netType === "trireg" ? "x" : "z");
}

export interface AssignmentResult {
  bits: Bit4[];
  /** Bit indices (MSB = width - 1) whose x/z was turned into 0. */
  zeroed: number[];
  why: string;
}

/**
 * Assignment of a value to an integral variable: the value is first resized
 * to the target width (zero-extension for an unsigned source, truncation of
 * MSBs), then, for a 2-state target, every x or z bit becomes 0 (§6.11.2).
 */
export function assignToIntegral(value: readonly Bit4[], target: { states: 2 | 4; width: number }): AssignmentResult {
  const sized = resize(value, target.width);
  if (target.states === 4) {
    return { bits: sized, zeroed: [], why: "A 4-state target stores 0, 1, x and z, so every bit is copied unchanged." };
  }
  const zeroed: number[] = [];
  const bits = sized.map((b, i) => {
    if (isUnknownBit(b)) {
      zeroed.push(sized.length - 1 - i);
      return "0" as Bit4;
    }
    return b;
  });
  const why =
    zeroed.length === 0
      ? "Every bit is known, so the 2-state target receives the same value."
      : `A 2-state type has no x or z. Bit${zeroed.length > 1 ? "s" : ""} ${zeroed.join(", ")} became 0 and the known bits were copied (§6.11.2). The fact that ${
          zeroed.length > 1 ? "they were" : "it was"
        } unknown is lost.`;
  return { bits, zeroed, why };
}

/* ------------------------------------------------------------------ */
/* Nets and strengths (§6.6, §28.11–§28.15)                            */
/* ------------------------------------------------------------------ */

export type NetType = "wire" | "tri" | "wand" | "triand" | "wor" | "trior" | "tri0" | "tri1" | "trireg" | "uwire";

export const NET_TYPES: readonly NetType[] = ["wire", "tri", "wand", "triand", "wor", "trior", "tri0", "tri1", "trireg", "uwire"];

/** Drive strengths a continuous assignment can use (§10.3.4, §28.11). */
export type DriveStrength = "supply" | "strong" | "pull" | "weak";
/** trireg charge strengths (§6.3.2.1, §28.15.2); medium is the default. */
export type ChargeStrength = "large" | "medium" | "small";
export type StrengthName = DriveStrength | ChargeStrength | "highz";

/** Table 28-7: strength levels. */
export const STRENGTH_LEVEL: Record<StrengthName, number> = {
  supply: 7,
  strong: 6,
  pull: 5,
  large: 4,
  weak: 3,
  medium: 2,
  small: 1,
  highz: 0,
};

/** Abbreviations used by `%v` style displays (Su1, St0, We1, HiZ …). */
export const STRENGTH_ABBREV: Record<StrengthName, string> = {
  supply: "Su",
  strong: "St",
  pull: "Pu",
  large: "La",
  weak: "We",
  medium: "Me",
  small: "Sm",
  highz: "Hi",
};

export const DRIVE_STRENGTHS: readonly DriveStrength[] = ["supply", "strong", "pull", "weak"];
export const CHARGE_STRENGTHS: readonly ChargeStrength[] = ["large", "medium", "small"];

export interface NetDriver {
  id: string;
  value: Bit4;
  strength: DriveStrength;
}

export type ResolutionRule =
  | "undriven" // no driver is on: z
  | "trireg-initial" // trireg never driven: x with its charge strength
  | "trireg-hold" // trireg capacitive state: keeps its last driven value
  | "pull-default" // tri0/tri1 with no driver at pull or above
  | "stronger-wins" // one value at the strongest level dominates weaker drivers
  | "like-values" // several drivers at the strongest level agree
  | "equal-conflict" // opposite values (or x) at the strongest level on a wire-like net
  | "wired-and" // wand/triand combined equal-strength drivers
  | "wired-or"; // wor/trior combined equal-strength drivers

export interface ResolvedNet {
  ok: true;
  value: Bit4;
  strength: StrengthName;
  /** `%v`-style label, e.g. St1, PuX, Me0, HiZ. */
  label: string;
  rule: ResolutionRule;
  /** Drivers (ids) at the strongest level, which set the value. */
  winners: string[];
  /** Drivers that were on but lost to a stronger level. */
  dominated: string[];
  why: string;
  clause: string;
}

export interface NetDriverError {
  ok: false;
  errorClass: DriverErrorClass;
  why: string;
  clause: string;
}

export type NetResolution = ResolvedNet | NetDriverError;

/** Built-in pull driver of a tri0/tri1 net (§6.6.5). */
export const IMPLICIT_PULL_ID = "pull";

export function strengthLabel(value: Bit4, strength: StrengthName): string {
  if (value === "z" || strength === "highz") return "HiZ";
  return `${STRENGTH_ABBREV[strength]}${value === "x" ? "X" : value}`;
}

/** Equal-strength combination table for the net type (Tables 6-2 … 6-6). */
function equalStrengthTable(netType: NetType): Table {
  if (netType === "wand" || netType === "triand") return table(["0000", "01x1", "0xxx", "01xz"]); // Table 6-3
  if (netType === "wor" || netType === "trior") return table(["01x0", "1111", "x1xx", "01xz"]); // Table 6-4
  return table(["0xx0", "x1x1", "xxxx", "01xz"]); // Table 6-2 (wire/tri; also trireg, tri0/tri1 drivers)
}

const isWiredAnd = (t: NetType) => t === "wand" || t === "triand";
const isWiredOr = (t: NetType) => t === "wor" || t === "trior";

function describeDriver(d: NetDriver): string {
  if (d.id === IMPLICIT_PULL_ID) return `the built-in pull${d.value === "0" ? "-down" : "-up"} (${d.value} at pull)`;
  return `${d.id} (${d.value} at ${d.strength})`;
}

const listIds = (ids: string[]) => (ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`);

/**
 * Resolves the drivers of one scalar net.
 * - Drivers at z are off (high impedance).
 * - The strongest level wins outright (§28.12.1). Drivers at that level are
 *   combined with the net type's equal-strength table: Table 6-2 for
 *   wire/tri (0 vs 1 → x), Table 6-3 for wand/triand, Table 6-4 for
 *   wor/trior (§6.6.1, §6.6.3, §28.12.4). An x driver occupies both the 0 and
 *   the 1 side at its strength (§28.12.2).
 * - tri0/tri1 add an implicit pull-strength 0/1 driver (§6.6.5).
 * - trireg keeps its last driven value at its charge strength when every
 *   driver is z, and starts at x (§6.6.4, §6.7.1, §28.15.2).
 * - uwire with more than one driver is an error (§6.6.2).
 */
export function resolveNet(
  netType: NetType,
  drivers: readonly NetDriver[],
  options: { charge?: ChargeStrength; stored?: Bit4 } = {},
): NetResolution {
  if (netType === "uwire" && drivers.length > 1) {
    return {
      ok: false,
      errorClass: "uwire-multiple-drivers",
      why: `A uwire allows exactly one driver, and ${drivers.length} drivers are connected, so the design does not elaborate (§6.6.2).`,
      clause: "§6.6.2",
    };
  }

  const active: NetDriver[] = drivers.filter((d) => d.value !== "z");
  if (netType === "tri0" || netType === "tri1") {
    active.push({ id: IMPLICIT_PULL_ID, value: netType === "tri0" ? "0" : "1", strength: "pull" });
  }

  if (active.length === 0) {
    if (netType === "trireg") {
      const charge = options.charge ?? "medium";
      const held = options.stored ?? "x";
      const never = options.stored === undefined;
      return {
        ok: true,
        value: held,
        strength: charge,
        label: strengthLabel(held, charge),
        rule: never ? "trireg-initial" : "trireg-hold",
        winners: [],
        dominated: [],
        why: never
          ? `No driver has driven this trireg yet, so it holds its initial x at ${charge} charge strength (§6.7.1).`
          : `Every driver is z, so the trireg enters its capacitive state: z does not propagate, and the net keeps its last driven value ${held} at ${charge} charge strength (§6.6.4, §28.15.2).`,
        clause: never ? "§6.7.1" : "§6.6.4",
      };
    }
    return {
      ok: true,
      value: "z",
      strength: "highz",
      label: "HiZ",
      rule: "undriven",
      winners: [],
      dominated: [],
      why: "Every driver is off (z), so nothing drives the net and it floats at z (§6.6.1, Table 6-2: z only when all inputs are z).",
      clause: "§6.6.1",
    };
  }

  const top = Math.max(...active.map((d) => STRENGTH_LEVEL[d.strength]));
  const winners = active.filter((d) => STRENGTH_LEVEL[d.strength] === top);
  const dominated = active.filter((d) => STRENGTH_LEVEL[d.strength] < top);
  const tbl = equalStrengthTable(netType);
  const value = winners.slice(1).reduce<Bit4>((acc, d) => tbl[acc][d.value], winners[0].value);
  const strength = winners[0].strength;
  const winnerIds = winners.map((d) => d.id);
  const dominatedIds = dominated.map((d) => d.id);
  const lostTo = dominated.length
    ? ` ${dominated.map(describeDriver).join(" and ")} ${dominated.length > 1 ? "are" : "is"} weaker and cannot affect the result (§28.12.1).`
    : "";

  const base = { ok: true as const, value, strength, label: strengthLabel(value, strength), winners: winnerIds, dominated: dominatedIds };

  if (winners.length === 1 && winners[0].id === IMPLICIT_PULL_ID) {
    return {
      ...base,
      rule: "pull-default",
      why: `No driver is as strong as the ${netType} net's built-in pull, so the net reads ${value} at pull strength (§6.6.5).${lostTo}`,
      clause: "§6.6.5",
    };
  }

  const distinct = new Set(winners.map((d) => d.value));
  if (winners.length === 1 || (distinct.size === 1 && !distinct.has("x"))) {
    const rule: ResolutionRule = winners.length === 1 ? "stronger-wins" : "like-values";
    const who = winners.length === 1 ? describeDriver(winners[0]) : `${listIds(winnerIds.map((id) => (id === IMPLICIT_PULL_ID ? "the built-in pull" : id)))} all drive ${value} at ${strength}`;
    const why =
      winners.length === 1
        ? value === "x"
          ? `${who} is the strongest driver and its value is unknown, so the net is x.${lostTo}`
          : dominated.length
            ? `${who} is the strongest driver, so it decides the net (§28.12.1).${lostTo}`
            : `${who} is the only driver that is on, so the net follows it.`
        : `${who}. Like values combine into the same value (§28.12.1).${lostTo}`;
    return { ...base, rule, why, clause: "§28.12.1" };
  }

  if (isWiredAnd(netType) || isWiredOr(netType)) {
    const opName = isWiredAnd(netType) ? "AND" : "OR";
    const values = winners.map((d) => d.value).join(` ${isWiredAnd(netType) ? "&" : "|"} `);
    return {
      ...base,
      rule: isWiredAnd(netType) ? "wired-and" : "wired-or",
      why: `${listIds(winnerIds)} drive at the same strength (${strength}), so the ${netType} net combines them with wired ${opName}: ${values} = ${value} (${
        isWiredAnd(netType) ? "Table 6-3" : "Table 6-4"
      }, §28.12.4).${lostTo}`,
      clause: "§28.12.4",
    };
  }

  const hasXDriver = winners.some((d) => d.value === "x");
  return {
    ...base,
    rule: "equal-conflict",
    why: hasXDriver
      ? `${listIds(winnerIds)} share the strongest level (${strength}) and one of them drives x, so the result is x (Table 6-2).${lostTo}`
      : `${listIds(winnerIds)} drive opposite values at the same strength (${strength}). A ${netType} net has no rule to pick a winner, so it resolves to x (§6.6.1, Table 6-2, §28.12.2).${lostTo}`,
    clause: "§28.12.2",
  };
}

/** Resolves a sequence of driver states; a trireg carries its charge from step to step. */
export function resolveNetOverTime(
  netType: NetType,
  steps: readonly (readonly NetDriver[])[],
  options: { charge?: ChargeStrength } = {},
): NetResolution[] {
  let stored: Bit4 | undefined;
  return steps.map((drivers) => {
    const r = resolveNet(netType, drivers, { charge: options.charge, stored });
    if (r.ok && netType === "trireg" && r.rule !== "trireg-hold" && r.rule !== "trireg-initial") stored = r.value;
    return r;
  });
}

/** Diagnoses a wrong guess about a resolved net value. */
export function diagnoseNetGuess(netType: NetType, drivers: readonly NetDriver[], guess: Bit4, options: { charge?: ChargeStrength; stored?: Bit4 } = {}): string {
  const r = resolveNet(netType, drivers, options);
  if (!r.ok) return r.why;
  if (guess === r.value) return r.why;
  if (guess === "z") {
    if (r.rule === "trireg-initial") return "A trireg starts at x, not z, and z from its drivers never propagates into it (§6.7.1, §6.6.4).";
    if (r.rule === "trireg-hold") {
      return "A trireg never floats to z once it holds charge: z from its drivers does not propagate into it (§6.6.4).";
    }
    if (r.rule === "pull-default") return `A ${netType} net is never left floating: its built-in pull supplies ${r.value} when nothing stronger drives it (§6.6.5).`;
    return "At least one driver is on, so the net is driven, not floating.";
  }
  if (guess === "x") {
    if (r.rule === "wired-and" || r.rule === "wired-or") {
      return `${netType} does not report a 0-versus-1 fight as x: it combines equal-strength drivers with wired ${r.rule === "wired-and" ? "AND" : "OR"}.`;
    }
    if (r.dominated.length > 0) {
      return "The drivers disagree, but not at the same strength. Strength is compared first and the stronger driver wins outright; x only appears when the strongest drivers disagree.";
    }
    if (r.rule === "trireg-hold") return "Stored charge only decays to x after a charge-decay delay, and none is declared here. The trireg keeps a known value.";
    return "Nothing here is unknown or in conflict, so the net has a known value.";
  }
  // Guessed 0 or 1.
  if (r.value === "x") {
    return r.winners.length > 1
      ? "The strongest drivers disagree at equal strength. A wire-like net cannot choose between them, so it reads x. Only wand/wor combine such drivers into 0 or 1."
      : "The strongest driver drives x, so the net is unknown.";
  }
  if (r.value === "z") return "Every driver is off (z). Nothing pulls the net to 0 or 1, so it floats at z.";
  if (r.dominated.length > 0) {
    return `Strength decides before value: the net follows the strongest driver, which drives ${r.value}.`;
  }
  if (r.rule === "trireg-hold") return `The trireg remembers the last value its drivers gave it, which was ${r.value}.`;
  return r.why;
}

/* ------------------------------------------------------------------ */
/* Who may write what (§6.5, §6.6.2, §9.2.2.2, §9.2.2.4, §10.3.2)       */
/* ------------------------------------------------------------------ */

export type WriterKind = "assign" | "port" | "procedural" | "always_comb" | "always_ff";

export interface Writer {
  id: string;
  kind: WriterKind;
}

export type DeclKind = "variable" | NetType;

export type DriverErrorClass =
  | "multiple-continuous-on-variable"
  | "mixed-continuous-procedural"
  | "procedural-on-net"
  | "always-block-shared"
  | "uwire-multiple-drivers";

export interface DriverCheck {
  legal: boolean;
  outcome: "net-resolves" | "single-driver" | "last-write-wins" | "compile-error";
  errorClass?: DriverErrorClass;
  /** Generic error class wording, not a vendor message. */
  message: string;
  why: string;
  clause: string;
}

const isContinuous = (k: WriterKind) => k === "assign" || k === "port";

/**
 * Checks whether a set of writers is legal for a declaration.
 * - Nets: one or more continuous drivers (assign, ports) are resolved by the
 *   net type; a net cannot be procedurally assigned (§6.5). A uwire allows
 *   only one driver (§6.6.2).
 * - Variables: any number of procedural writers, last write wins; OR exactly
 *   one continuous assignment or port. Multiple continuous assignments, or a
 *   mix of procedural and continuous, are errors (§6.5, §10.3.2).
 * - A variable written by always_comb/always_ff shall not be written by any
 *   other process (§9.2.2.2, §9.2.2.4).
 */
export function checkDrivers(decl: DeclKind, writers: readonly Writer[]): DriverCheck {
  const continuous = writers.filter((w) => isContinuous(w.kind));
  const procedural = writers.filter((w) => !isContinuous(w.kind));

  if (decl !== "variable") {
    if (procedural.length > 0) {
      return {
        legal: false,
        outcome: "compile-error",
        errorClass: "procedural-on-net",
        message: "Compile error: procedural assignment to a net",
        why: `A net is written only by continuous drivers (assign, ports, primitives). ${procedural.map((w) => w.id).join(", ")} assigns it procedurally, which is illegal (§6.5). Declare a variable, or use force/release for a test override.`,
        clause: "§6.5",
      };
    }
    if (decl === "uwire" && continuous.length > 1) {
      return {
        legal: false,
        outcome: "compile-error",
        errorClass: "uwire-multiple-drivers",
        message: "Elaboration error: more than one driver on a uwire",
        why: "uwire is an unresolved net: connecting more than one driver is an error (§6.6.2).",
        clause: "§6.6.2",
      };
    }
    return continuous.length > 1
      ? {
          legal: true,
          outcome: "net-resolves",
          message: "Legal: the net resolves its drivers",
          why: `A ${decl} accepts several continuous drivers and combines them with its resolution function (§6.5, §6.6).`,
          clause: "§6.5",
        }
      : {
          legal: true,
          outcome: "single-driver",
          message: "Legal: one continuous driver",
          why: `The ${decl} follows its single driver.`,
          clause: "§6.5",
        };
  }

  if (continuous.length > 1) {
    return {
      legal: false,
      outcome: "compile-error",
      errorClass: "multiple-continuous-on-variable",
      message: "Compile error: multiple continuous drivers on a variable",
      why: "A variable can be written by one continuous assignment or port only. Variables have no resolution function, so two continuous drivers are an error rather than an x (§6.5, §10.3.2). Use a net (wire/tri) if several drivers really share the signal.",
      clause: "§6.5",
    };
  }
  if (continuous.length === 1 && procedural.length > 0) {
    return {
      legal: false,
      outcome: "compile-error",
      errorClass: "mixed-continuous-procedural",
      message: "Compile error: variable has both continuous and procedural assignments",
      why: "Mixing a continuous assignment with procedural writes to the same variable is an error (§6.5, §10.3.2).",
      clause: "§6.5",
    };
  }
  const exclusive = procedural.find((w) => w.kind === "always_comb" || w.kind === "always_ff");
  if (exclusive && procedural.length > 1) {
    return {
      legal: false,
      outcome: "compile-error",
      errorClass: "always-block-shared",
      message: `Compile error: variable written by ${exclusive.kind} is also written by another process`,
      why: `Variables assigned in ${exclusive.kind} shall not be written by any other process (${exclusive.kind === "always_comb" ? "§9.2.2.2" : "§9.2.2.4"}).`,
      clause: exclusive.kind === "always_comb" ? "§9.2.2.2" : "§9.2.2.4",
    };
  }
  if (procedural.length > 1) {
    return {
      legal: true,
      outcome: "last-write-wins",
      message: "Legal: the last procedural write wins",
      why: "Variables can be written by several procedural statements and the last write determines the value (§6.5). Nothing resolves and no x appears. If the writes happen in the same time step, which one is last depends on process order: that is a race (§4.7).",
      clause: "§6.5",
    };
  }
  return {
    legal: true,
    outcome: "single-driver",
    message: "Legal: one writer",
    why: "One writer, so the variable simply holds what it last received.",
    clause: "§6.5",
  };
}

/* ------------------------------------------------------------------ */
/* Code generation (kept in sync with the model data)                  */
/* ------------------------------------------------------------------ */

/** `wire y;`, `trireg (medium) y;` … */
export function netDeclarationSource(netType: NetType, name = "y", charge?: ChargeStrength): string {
  if (netType === "trireg") return `trireg (${charge ?? "medium"}) ${name};`;
  return `${netType} ${name};`;
}

/** `assign (pull0, pull1) y = a;` (§10.3.4). */
export function driverAssignSource(driver: NetDriver, netName = "y"): string {
  return `assign (${driver.strength}0, ${driver.strength}1) ${netName} = ${driver.id};`;
}

/** `logic a = 1'bx;` declaration for a driver source. */
export const driverSourceDecl = (driver: NetDriver) => `logic ${driver.id} = 1'b${driver.value};`;
