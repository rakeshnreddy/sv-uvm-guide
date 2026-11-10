/**
 * Bit-level model of SystemVerilog streaming concatenations and bit-stream
 * casts, for StreamPackLab.
 *
 * Pure and deterministic (no React). Every rule names the IEEE 1800-2023
 * clause it implements; tests in tests/lib/sv-stream-model.test.ts pin each one
 * and reproduce the standard's own examples.
 *
 * Streaming (§11.4.14)
 * - §11.4.14.1 the operands are converted to one generic stream, leftmost
 *              operand first: a packed value contributes its bits; a struct
 *              its members in declaration order; an unpacked array or queue
 *              its elements in foreach order (element 0 first); a nested
 *              streaming concatenation its own (already re-ordered) result.
 * - §11.4.14.2 the stream is re-ordered: >> ignores the slice size and never
 *              re-orders; << cuts the stream into slices starting with the
 *              right-most bit (the last, left-most slice may be short, with no
 *              padding or truncation) and reverses the slice order, keeping
 *              the bits inside each slice. The slice size defaults to 1; zero
 *              or a negative size is an error.
 * - §11.4.14   as an assignment source, the stream is left-aligned in the
 *              target: a narrower fixed-size target is an error; a wider one is
 *              filled with zero bits on the right; a queue or dynamic array is
 *              resized to the smallest number of elements that holds the
 *              stream, then zero-filled on the right. The result is then cast
 *              to the target type, so x and z become 0 in a 2-state target
 *              (§6.11.2). A pack whose data contains any 4-state type is a
 *              4-state stream, decided by the types and not by the values
 *              (an integer literal is of type logic, §5.7.1).
 * - §11.4.14.3 as an assignment target (unpack), the source is consumed from
 *              its left (most significant) end: extra low bits are ignored, too
 *              few bits is an error. A 4-state stream unpacked into a 2-state
 *              target is cast to 2-state.
 * - §11.4.14.4 a `with [0 +: n]` range sizes a dynamic array in the unpack; it
 *              is evaluated just before its array, so it can read a field the
 *              same unpack filled earlier. Without a range, the first
 *              dynamically sized item is greedy: it takes all the data left
 *              after the later fixed-size items; later dynamic items stay
 *              empty. On the pack side a range acts as an array slice, and
 *              items beyond the array come from Table 7-1 (§7.4.5).
 *
 * Bit-stream casting (§6.24)
 * - §6.24.1    the casting type is one of the forms of Syntax 6-7 (a simple
 *              type such as a typedef name or int); `logic [31:0]` with a
 *              packed dimension is not one of them. A cast to an unpacked or
 *              otherwise not assignment-compatible bit-stream type follows
 *              §6.24.3.
 * - §6.24.3    the source is flattened into one generic packed value, first
 *              member in the most significant bits (4-state if any part is);
 *              the value is cut into the destination from the left; 2-state
 *              parts of the destination are assigned as if cast to 2-state,
 *              so x and z become 0 (§6.11.2). Fixed-size types of different
 *              sizes are a compile-time error when either type is unpacked.
 *
 * Readings the standard leaves open are listed in STREAM_ASSUMPTIONS.
 */

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

export type Bit = "0" | "1" | "x" | "z";

/** One bit of a stream, with where it came from (a field, a queue element, a zero fill). */
export interface TaggedBit {
  v: Bit;
  /** Short name of the bit's origin: "len", "q[0]", "w40", "lit". */
  origin: string;
  /** The bit's number inside its origin, or -1 for a zero fill. */
  index: number;
}

/** Origin tag of a zero fill added on the right of a left-aligned stream (§11.4.14). */
export const FILL_ORIGIN = "fill";
/** Origin tag of an element streamed from beyond the end of an array (Table 7-1, §11.4.14.4). */
export const NONEXISTENT_ORIGIN = "nonexistent";

const HEX_DIGITS = "0123456789ABCDEF";

/** Bits from a hex string of exactly width/4 digits, MSB first; x and z digits set four bits (§5.7.1). */
export function hexBits(hex: string, width: number): Bit[] {
  const digits = hex.replace(/_/g, "");
  if (digits.length * 4 !== width) throw new Error(`hexBits: ${hex} is not ${width} bits`);
  const out: Bit[] = [];
  for (const d of digits) {
    const lower = d.toLowerCase();
    if (lower === "x" || lower === "z") {
      out.push(lower, lower, lower, lower);
      continue;
    }
    const n = HEX_DIGITS.indexOf(d.toUpperCase());
    if (n < 0) throw new Error(`hexBits: bad digit ${d}`);
    for (let b = 3; b >= 0; b -= 1) out.push(((n >> b) & 1) === 1 ? "1" : "0");
  }
  return out;
}

/** Bits from a binary string such as "11_0101", MSB first. */
export function binBits(bin: string): Bit[] {
  return bin
    .replace(/_/g, "")
    .split("")
    .map((c) => {
      const l = c.toLowerCase();
      if (l !== "0" && l !== "1" && l !== "x" && l !== "z") throw new Error(`binBits: bad digit ${c}`);
      return l as Bit;
    });
}

const plain = (bits: readonly TaggedBit[]): Bit[] => bits.map((b) => b.v);

/** Groups a digit string with "_" every four digits from the right, as the lesson writes 32'h04BE_EF01. */
function groupFromRight(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 4 === 0) out += "_";
    out += digits[i];
  }
  return out;
}

/** A binary literal, underscores every four bits from the right: 6'b01_0111. */
export function binaryLiteral(bits: readonly Bit[]): string {
  if (bits.length === 0) return "no bits";
  return `${bits.length}'b${groupFromRight(bits.join(""))}`;
}

/**
 * A sized literal for a value: hex when the width is a multiple of 4 and every
 * nibble is all 0/1, all x or all z (§5.7.1); binary otherwise.
 */
export function formatBits(bits: readonly Bit[]): string {
  const w = bits.length;
  if (w === 0) return "no bits";
  if (w % 4 !== 0) return binaryLiteral(bits);
  let digits = "";
  for (let i = 0; i < w; i += 4) {
    const nib = bits.slice(i, i + 4);
    if (nib.every((b) => b === "x")) digits += "x";
    else if (nib.every((b) => b === "z")) digits += "z";
    else if (nib.every((b) => b === "0" || b === "1")) digits += HEX_DIGITS[parseInt(nib.join(""), 2)];
    else return binaryLiteral(bits);
  }
  return `${w}'h${groupFromRight(digits)}`;
}

/** Unsigned value of known bits, or null when any bit is x or z. */
export function unsignedValue(bits: readonly Bit[]): bigint | null {
  if (bits.some((b) => b === "x" || b === "z")) return null;
  let v = BigInt(0);
  for (const b of bits) v = v * BigInt(2) + (b === "1" ? BigInt(1) : BigInt(0));
  return v;
}

/** Two's-complement value of known bits (an int is signed, §6.11), or null with x or z. */
export function signedValue(bits: readonly Bit[]): bigint | null {
  const u = unsignedValue(bits);
  if (u === null || bits.length === 0) return u;
  return bits[0] === "1" ? u - (BigInt(1) << BigInt(bits.length)) : u;
}

/** §6.11.2: converting to a 2-state value turns every x and z bit into 0. */
export function toTwoState(bits: readonly TaggedBit[]): { bits: TaggedBit[]; converted: number } {
  let converted = 0;
  const out = bits.map((b) => {
    if (b.v === "x" || b.v === "z") {
      converted += 1;
      return { ...b, v: "0" as Bit };
    }
    return b;
  });
  return { bits: out, converted };
}

/** Does any bit hold x or z? A value test only: whether a stream is 4-state is decided by types (streamFourState). */
const hasUnknownBits = (bits: readonly TaggedBit[]) => bits.some((b) => b.v === "x" || b.v === "z");

// ---------------------------------------------------------------------------
// Stream expressions and operators
// ---------------------------------------------------------------------------

export type StreamDir = ">>" | "<<";

export interface StreamOperator {
  dir: StreamDir;
  /** Slice size in bits; undefined means none written, so the default 1 (§11.4.14.2). */
  slice?: number;
}

export type StreamExpr =
  | {
      kind: "packed";
      name: string;
      tag: string;
      bits: readonly Bit[];
      /** Is the operand's type 2-state (bit, byte, int...)? An integer literal is logic, so 4-state (§5.7.1). */
      twoState: boolean;
      /** Why the type is 4-state, for the pack step: "logic (4-state)". */
      stateNote?: string;
    }
  | { kind: "struct"; name: string; members: readonly StreamExpr[] }
  | {
      kind: "array";
      name: string;
      elements: readonly (readonly Bit[])[];
      elementWidth: number;
      /** 2-state element type: a nonexistent element reads '0, a 4-state one 'x (Table 7-1). */
      elementTwoState: boolean;
      /** Pack-side `with [0 +: count]` (§11.4.14.4). */
      withCount?: number;
    }
  | { kind: "stream"; op: StreamOperator; operands: readonly StreamExpr[] };

export const operatorText = (op: StreamOperator): string => (op.slice === undefined ? op.dir : `${op.dir} ${op.slice}`);

/** The expression as source text: {<< 8 {hdr}}. */
export function exprText(expr: StreamExpr): string {
  if (expr.kind === "packed" || expr.kind === "struct") return expr.name;
  if (expr.kind === "array") return expr.withCount === undefined ? expr.name : `${expr.name} with [0 +: ${expr.withCount}]`;
  return `{${operatorText(expr.op)} {${expr.operands.map(exprText).join(", ")}}}`;
}

export interface StreamSlice {
  /** Position (0 = leftmost) of the slice's first bit in the stream it was cut from. */
  start: number;
  /** Position of its last bit, inclusive. */
  end: number;
  width: number;
  /** Slice number counted from the right: slice 0 holds the right-most bit. */
  number: number;
}

/**
 * §11.4.14.2: slices of `size` bits cut starting with the right-most bit; the
 * left-most slice keeps whatever is left, with no padding or truncation.
 * Returned left to right.
 */
export function sliceFromRight(length: number, size: number): StreamSlice[] {
  if (!Number.isInteger(size) || size <= 0) throw new Error("slice size must be a positive integer (§11.4.14.2)");
  const out: StreamSlice[] = [];
  let end = length - 1;
  let number = 0;
  while (end >= 0) {
    const start = Math.max(0, end - size + 1);
    out.unshift({ start, end, width: end - start + 1, number });
    end = start - 1;
    number += 1;
  }
  return out;
}

/** §11.4.14.2: a slice size of zero or less is an error; null when the size is legal. */
export function sliceSizeError(op: StreamOperator): string | null {
  if (op.slice === undefined) return null;
  if (!Number.isInteger(op.slice) || op.slice <= 0) return `A slice size of ${op.slice} is an error: it must be positive (§11.4.14.2).`;
  return null;
}

export interface ReorderResult {
  /** The slices the << cut, left to right in the input; empty for >>. */
  slices: StreamSlice[];
  out: TaggedBit[];
}

/** §11.4.14.2: >> keeps the stream as it is; << reverses the order of the slices, keeping the bits in each. */
export function reorder(bits: readonly TaggedBit[], op: StreamOperator): ReorderResult {
  if (op.dir === ">>") return { slices: [], out: [...bits] };
  const slices = sliceFromRight(bits.length, op.slice ?? 1);
  const out: TaggedBit[] = [];
  for (let k = slices.length - 1; k >= 0; k -= 1) out.push(...bits.slice(slices[k].start, slices[k].end + 1));
  return { slices, out };
}

/** For each output position of reorder(·, op) on `length` bits, the input position it reads. */
export function reorderPermutation(length: number, op: StreamOperator): number[] {
  const probe: TaggedBit[] = Array.from({ length }, (_, i) => ({ v: "0", origin: "p", index: i }));
  return reorder(probe, op).out.map((b) => b.index);
}

/** §11.4.14.1: the generic stream, leftmost operand first. */
export function flatten(expr: StreamExpr): TaggedBit[] {
  if (expr.kind === "packed") return expr.bits.map((v, p) => ({ v, origin: expr.tag, index: expr.bits.length - 1 - p }));
  if (expr.kind === "struct") return expr.members.flatMap(flatten);
  if (expr.kind === "array") {
    const count = expr.withCount ?? expr.elements.length;
    const out: TaggedBit[] = [];
    for (let i = 0; i < count; i += 1) {
      const el = expr.elements[i];
      if (el) out.push(...el.map((v, p) => ({ v, origin: `${expr.name}[${i}]`, index: el.length - 1 - p })));
      else {
        // §11.4.14.4: beyond the array, the nonexistent entry value of Table 7-1 ('0 or 'x).
        const v: Bit = expr.elementTwoState ? "0" : "x";
        for (let p = 0; p < expr.elementWidth; p += 1) out.push({ v, origin: NONEXISTENT_ORIGIN, index: expr.elementWidth - 1 - p });
      }
    }
    return out;
  }
  return reorder(expr.operands.flatMap(flatten), expr.op).out;
}

/**
 * §11.4.14: "If the data being packed contains any 4-state types, the result of
 * a pack operation is a 4-state stream". Decided by the operands' types, never
 * by their values: a logic operand makes a 4-state stream even when every bit
 * is 0 or 1. §11.4.14.1 casts 2-state parts to 4-state when needed.
 */
export function streamFourState(expr: StreamExpr): boolean {
  if (expr.kind === "packed") return !expr.twoState;
  if (expr.kind === "struct") return expr.members.some(streamFourState);
  if (expr.kind === "array") return !expr.elementTwoState;
  return expr.operands.some(streamFourState);
}

interface StateReason {
  name: string;
  /** "is" for a packed operand, "has" for a struct or array. */
  verb: "is" | "has";
  note: string;
}

function fourStateReasons(expr: StreamExpr): StateReason[] {
  if (expr.kind === "packed") return expr.twoState ? [] : [{ name: expr.name, verb: "is", note: expr.stateNote ?? "of a 4-state type" }];
  if (expr.kind === "struct") {
    const four = expr.members.filter(streamFourState);
    if (four.length === 0) return [];
    const notes = new Set(four.map((m) => (m.kind === "packed" ? m.stateNote ?? "" : "")));
    const only = notes.size === 1 ? [...notes][0] : "";
    return [{ name: expr.name, verb: "has", note: only ? `${only} members` : "4-state members" }];
  }
  if (expr.kind === "array") return expr.elementTwoState ? [] : [{ name: expr.name, verb: "has", note: "4-state elements" }];
  return expr.operands.flatMap(fourStateReasons);
}

const joinNames = (names: readonly string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The §11.4.14 sentence of the pack step: which types make the stream 4-state, or that every type is 2-state. */
export function streamStateText(operands: readonly StreamExpr[], bits: readonly TaggedBit[]): string {
  const reasons = operands.flatMap(fourStateReasons);
  if (reasons.length === 0) return "Every operand is of a 2-state type, so the stream is 2-state (§11.4.14).";
  // Packed operands with the same note are named together: "hdr.len, hdr.addr and hdr.kind are logic (4-state)".
  const groups: { names: string[]; verb: "is" | "has"; note: string }[] = [];
  for (const r of reasons) {
    const last = groups[groups.length - 1];
    if (last && last.verb === "is" && r.verb === "is" && last.note === r.note) last.names.push(r.name);
    else groups.push({ names: [r.name], verb: r.verb, note: r.note });
  }
  const parts = groups.map((g) => `${joinNames(g.names)} ${g.verb === "is" ? (g.names.length > 1 ? "are" : "is") : g.names.length > 1 ? "have" : "has"} ${g.note}`);
  const x = hasUnknownBits(bits) ? " Only a 4-state stream can carry x or z bits, like the ones here." : "";
  return `${joinNames(parts)}, so the stream is 4-state (§11.4.14), whatever values its bits hold.${x}`;
}

/** One sentence per operand, in the order §11.4.14.1 streams them. */
function describeOperand(expr: StreamExpr): string {
  if (expr.kind === "packed") return `${expr.name} contributes its ${expr.bits.length} bits as they are`;
  if (expr.kind === "struct") {
    const names = expr.members.map((m) => (m.kind === "packed" ? m.tag : exprText(m)));
    return `${expr.name} is a struct, so its members are streamed in declaration order: ${names.join(", ")}`;
  }
  if (expr.kind === "array") {
    const n = expr.withCount ?? expr.elements.length;
    const beyond = expr.withCount !== undefined && expr.withCount > expr.elements.length ? `; ${expr.withCount - expr.elements.length} more come from beyond its end and read ${expr.elementTwoState ? "'0" : "'x"} (Table 7-1)` : "";
    return `${exprText(expr)} is streamed element by element, element 0 first: ${n} elements${beyond}`;
  }
  return `${exprText(expr)} is evaluated first and its ${flatten(expr).length}-bit result, ${formatBits(plain(flatten(expr)))}, is appended`;
}

// ---------------------------------------------------------------------------
// Targets and the pack (stream as an assignment source)
// ---------------------------------------------------------------------------

export type StreamTarget =
  | { kind: "fixed"; name: string; width: number; twoState: boolean; decl: string }
  | { kind: "queue"; name: string; elementWidth: number; twoState: boolean; decl: string };

export type StepId = "pack" | "slice" | "reverse" | "fit";

export interface StreamCard {
  label: string;
  bits: TaggedBit[];
}

export interface StreamStep {
  id: StepId;
  title: string;
  text: string;
  /** The bits this step shows; for a queue fit, the bits of every element in order. */
  bits: TaggedBit[];
  /** The slices drawn in this step (slice and reverse steps of a <<). */
  slices?: StreamSlice[];
  /** Pieces to draw as separate cards, in display order: slices, queue elements, unpack targets. */
  cards?: StreamCard[];
  /** Positions (0 = leftmost) of the bits this step marks: consumed source bits, filled zeros. */
  marked?: number[];
  markLabel?: string;
  error?: boolean;
}

export interface FitResult {
  ok: boolean;
  error?: string;
  /** One sentence: where the stream lands, with its clause. */
  summary: string;
  bits: TaggedBit[];
  /** Queue elements, element 0 first. */
  elements?: TaggedBit[][];
  zeroFill: number;
  converted: number;
  text: string;
}

/**
 * §11.4.14: the stream meets its target, left-aligned, and is then implicitly
 * cast to the target's type. `streamFourState` is the stream's type (see
 * streamFourState); by default it is taken as 4-state when any bit is x or z.
 */
export function fitToTarget(stream: readonly TaggedBit[], target: StreamTarget, streamFourState: boolean = hasUnknownBits(stream)): FitResult {
  const n = stream.length;
  const fill = (k: number): TaggedBit[] => Array.from({ length: k }, () => ({ v: "0" as Bit, origin: FILL_ORIGIN, index: -1 }));
  const castNote = (converted: number) =>
    converted > 0
      ? ` ${target.name} is 2-state, so the implicit cast to its type turns the ${converted} x and z bits into 0 (§11.4.14, §6.11.2).`
      : target.twoState && streamFourState
        ? ` ${target.name} is 2-state, so the 4-state stream is implicitly cast to its type (§11.4.14); it holds no x or z bits, so no bit changes.`
        : "";
  const castSummary = (converted: number) => (converted > 0 ? `; the x and z bits become 0 in the 2-state ${target.name} (§6.11.2)` : "");
  if (target.kind === "fixed") {
    if (target.width < n) {
      const error = `${target.name} is ${target.width} bits, narrower than the ${n}-bit stream: the standard requires an error (§11.4.14) and defines no value for ${target.name}.`;
      return {
        ok: false,
        error,
        summary: error,
        bits: [],
        zeroFill: 0,
        converted: 0,
        text: `Fit (§11.4.14): ${target.name} is ${target.width} bits, narrower than the ${n}-bit stream. That is an error; the stream is never truncated to fit.`,
      };
    }
    const zeroFill = target.width - n;
    const widened = [...stream, ...fill(zeroFill)];
    const cast = target.twoState ? toTwoState(widened) : { bits: widened, converted: 0 };
    const where =
      zeroFill === 0
        ? `${target.name} is ${target.width} bits, the same as the stream, so it takes the stream as it is`
        : `${target.name} is ${target.width} bits, wider than the ${n}-bit stream: the stream is left-aligned and ${zeroFill} zero bits are filled on the right`;
    const summary =
      zeroFill === 0
        ? `${target.name} is as wide as the stream, so it takes it as it is (§11.4.14)${castSummary(cast.converted)}.`
        : `The stream is left-aligned in ${target.name}, with ${zeroFill} zero bits filled on the right (§11.4.14)${castSummary(cast.converted)}.`;
    return { ok: true, bits: cast.bits, zeroFill, converted: cast.converted, summary, text: `Fit (§11.4.14): ${where}: ${formatBits(plain(cast.bits))}.${castNote(cast.converted)}` };
  }
  const e = target.elementWidth;
  const count = Math.ceil(n / e);
  const zeroFill = count * e - n;
  const widened = [...stream, ...fill(zeroFill)];
  const cast = target.twoState ? toTwoState(widened) : { bits: widened, converted: 0 };
  const elements: TaggedBit[][] = [];
  for (let i = 0; i < count; i += 1) elements.push(cast.bits.slice(i * e, (i + 1) * e));
  const padText = zeroFill > 0 ? `, and the last ${zeroFill} bits are zeros filled on the right` : "";
  const list = elements.map((el, i) => `${target.name}[${i}] = ${formatBits(plain(el))}`).join(", ");
  return {
    ok: true,
    bits: cast.bits,
    elements,
    zeroFill,
    converted: cast.converted,
    summary:
      count === 0
        ? `The stream has no bits, so ${target.name} is resized to 0 elements (§11.4.14).`
        : `${target.name} is resized to ${count} element${count === 1 ? "" : "s"}${zeroFill > 0 ? `, zero-filled on the right,` : ""} and ${target.name}[0] takes the most significant ${e} bits (§11.4.14)${castSummary(cast.converted)}.`,
    text:
      count === 0
        ? `Fit (§11.4.14): the stream has no bits, so ${target.name} is resized to 0 elements.`
        : `Fit (§11.4.14): ${target.name} is a queue, so it is resized to the smallest number of ${e}-bit elements that holds ${n} bits: ${count}${padText}. ${target.name}[0] takes the most significant bits: ${list}.${castNote(cast.converted)}`,
  };
}

export interface PackResult {
  ok: boolean;
  error?: string;
  expression: string;
  packed: TaggedBit[];
  reordered: TaggedBit[];
  slices: StreamSlice[];
  fit?: FitResult;
  steps: StreamStep[];
  fourState: boolean;
}

const sliceCards = (bits: readonly TaggedBit[], slices: readonly StreamSlice[]): StreamCard[] =>
  slices.map((s) => ({ label: `slice ${s.number}`, bits: bits.slice(s.start, s.end + 1) }));

function sliceStepText(op: StreamOperator, n: number, slices: StreamSlice[], unpack: boolean): string {
  if (op.dir === ">>") {
    return op.slice === undefined
      ? `Slice (§11.4.14.2): >> streams left to right and never re-orders, so the stream is not cut.`
      : `Slice (§11.4.14.2): >> streams left to right, so the slice size ${op.slice} is ignored and the stream is not cut.`;
  }
  const size = op.slice ?? 1;
  const short = slices.length > 0 && slices[0].width < size ? slices[0] : null;
  const dflt = op.slice === undefined ? "With no slice size written the default is 1, so " : "";
  const what = unpack ? `the ${n} consumed bits` : `the ${n}-bit stream`;
  const cut =
    size === 1
      ? `${dflt}every bit of ${what} is its own slice: ${slices.length} slices`
      : `${dflt}<< ${size} cuts ${what} into ${slices.length} slices, starting with the right-most bit`;
  const shortText = short ? `; the left-most slice, slice ${short.number}, keeps the remaining ${short.width} bit${short.width === 1 ? "" : "s"}, with no padding or truncation` : "";
  return `Slice (§11.4.14.2): ${cut}${shortText}.`;
}

function reverseStepText(op: StreamOperator, out: readonly TaggedBit[], slices: StreamSlice[]): string {
  if (op.dir === ">>") return `Reverse (§11.4.14.2): nothing to reverse; >> keeps the order: ${formatBits(plain(out))}.`;
  if (slices.length === 1) return `Reverse (§11.4.14.2): there is only one slice, so reversing the slice order changes nothing: ${formatBits(plain(out))}.`;
  return `Reverse (§11.4.14.2): << streams the slices right to left, so slice 0 comes first and slice ${slices.length - 1} last; the bits inside each slice keep their order: ${formatBits(plain(out))}.`;
}

/** A streaming concatenation used as an assignment source (§11.4.14). */
export function packStream(op: StreamOperator, operands: readonly StreamExpr[], target: StreamTarget): PackResult {
  const expression = exprText({ kind: "stream", op, operands });
  const sizeError = sliceSizeError(op);
  if (sizeError) return { ok: false, error: sizeError, expression, packed: [], reordered: [], slices: [], steps: [], fourState: false };
  const packed = operands.flatMap(flatten);
  // §11.4.14: decided by the operand types, not by whether a bit is x or z.
  const fourState = operands.some(streamFourState);
  const { slices, out } = reorder(packed, op);
  const fit = fitToTarget(out, target, fourState);
  const intro = operands.length > 1 ? "left operand first: " : "";
  const stateText = ` ${streamStateText(operands, packed)}`;
  const steps: StreamStep[] = [
    {
      id: "pack",
      title: "Pack",
      text: `Pack (§11.4.14.1): ${intro}${operands.map(describeOperand).join("; then ")}. The stream is ${packed.length} bits: ${formatBits(plain(packed))}.${stateText}`,
      bits: packed,
    },
    { id: "slice", title: "Slice", text: sliceStepText(op, packed.length, slices, false), bits: packed, slices, cards: op.dir === "<<" ? sliceCards(packed, slices) : undefined },
    {
      id: "reverse",
      title: "Reverse",
      text: reverseStepText(op, out, slices),
      bits: out,
      slices: op.dir === "<<" ? slices : undefined,
      cards: op.dir === "<<" ? sliceCards(packed, [...slices].reverse()) : undefined,
    },
    {
      id: "fit",
      title: "Fit",
      text: fit.text,
      bits: fit.ok ? fit.bits : out,
      marked: fit.ok && fit.zeroFill > 0 ? Array.from({ length: fit.zeroFill }, (_, i) => fit.bits.length - fit.zeroFill + i) : undefined,
      markLabel: "zero fill",
      error: !fit.ok,
      cards: fit.ok && fit.elements && target.kind === "queue" ? fit.elements.map((el, i) => ({ label: `${target.name}[${i}]`, bits: el })) : undefined,
    },
  ];
  return { ok: fit.ok, error: fit.error, expression, packed, reordered: out, slices, fit, steps, fourState };
}

// ---------------------------------------------------------------------------
// Unpack (stream as an assignment target)
// ---------------------------------------------------------------------------

export type UnpackItem =
  | { kind: "fixed"; name: string; width: number; twoState: boolean }
  | {
      kind: "dynamic";
      name: string;
      elementWidth: number;
      twoState: boolean;
      /** `with [0 +: count]`, as a number or as an earlier fixed item read as an unsigned count (§11.4.14.4). */
      withRange?: { count: number } | { countFrom: string };
    };

export type UnpackStatus = "ok" | "error" | "not-modelled";

export interface UnpackResult {
  status: UnpackStatus;
  message?: string;
  expression: string;
  source: TaggedBit[];
  /** Bits the targets need (N), when known. */
  needed: number;
  /** The values, by item name; a dynamic item's bits are its elements in order. */
  values: Record<string, TaggedBit[]>;
  /** A dynamic item's element count. */
  sizes: Record<string, number>;
  ignored: number;
  steps: StreamStep[];
}

const unpackLhs = (op: StreamOperator, items: readonly UnpackItem[]) =>
  `{${operatorText(op)} {${items
    .map((it) => (it.kind === "dynamic" && it.withRange ? `${it.name} with [0 +: ${"count" in it.withRange ? it.withRange.count : it.withRange.countFrom}]` : it.name))
    .join(", ")}}}`;

/** §11.4.14.3, §11.4.14.4: unpack `source` into `items`, left item first, from the most significant end. */
export function unpackStream(op: StreamOperator, items: readonly UnpackItem[], source: StreamExpr, sourceName: string): UnpackResult {
  const expression = `${unpackLhs(op, items)} = ${sourceName}`;
  const src = flatten(source);
  const available = src.length;
  const base = { expression, source: src, values: {}, sizes: {}, ignored: 0 };
  const sizeError = sliceSizeError(op);
  if (sizeError) return { ...base, status: "error", message: sizeError, needed: 0, steps: [] };
  const srcText = source.kind === "array" ? `${sourceName} is a queue of ${source.elements.length} elements, streamed element 0 first: ${available} bits` : `${sourceName} is ${available} bits`;

  // Sizes of every item, decided left to right (§11.4.14.4).
  const widths: number[] = [];
  const sizes: Record<string, number> = {};
  const values: Record<string, TaggedBit[]> = {};
  const fixedAfter = (i: number) => items.slice(i + 1).reduce((s, it) => s + (it.kind === "fixed" ? it.width : 0), 0);
  let greedyUsed = false;
  let cursor = 0;
  const sequential = op.dir === ">>";
  const notModelled = (message: string): UnpackResult => ({ ...base, status: "not-modelled", message, needed: 0, steps: [] });
  const tooFew = (needed: number): UnpackResult => ({
    ...base,
    status: "error",
    needed,
    message: `The targets need ${needed} bits but ${sourceName} provides only ${available}: more bits are needed than the source provides, which is an error (§11.4.14.3). The standard defines no values for the targets after it.`,
    steps: [
      {
        id: "pack",
        title: "Take the source",
        text: `Source (§11.4.14.3): ${srcText}. The targets need ${needed}: too few bits is an error, and the standard defines no values for the targets after it.`,
        bits: src,
        error: true,
      },
    ],
  });
  const withNotes: string[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (it.kind === "fixed") {
      widths.push(it.width);
    } else if (it.withRange) {
      let count: number;
      if ("count" in it.withRange) count = it.withRange.count;
      else {
        const from = it.withRange.countFrom;
        if (!sequential) return notModelled(`With <<, the number of bits consumed depends on ${from}, which the same unpack fills; the lab does not model that case.`);
        const fromValue = values[from];
        if (!fromValue) return notModelled(`${from} is not unpacked before ${it.name}; a with range that reads a later item uses its previous value (§11.4.14.4), which the lab does not model.`);
        const n = unsignedValue(plain(fromValue));
        if (n === null) return notModelled(`${from} holds x or z, so the with range is not a known count; the lab does not model that case.`);
        count = Number(n);
        withNotes.push(
          `the with expression is evaluated just before ${it.name} is unpacked, after ${from} was filled, so it reads ${from} = ${count} (§11.4.14.4)`,
        );
      }
      if (count <= 0) return notModelled(`A with range of [0 +: ${count}] has no positive width; the lab models only positive counts.`);
      sizes[it.name] = count;
      widths.push(count * it.elementWidth);
      withNotes.push(`${it.name} is a variable-size array, so it is resized to ${count} element${count === 1 ? "" : "s"} to hold the range (§11.4.14.4)`);
    } else if (!greedyUsed) {
      greedyUsed = true;
      const before = widths.reduce((s, w) => s + w, 0);
      const left = available - before - fixedAfter(i);
      if (left < 0) return tooFew(before + fixedAfter(i));
      if (items.slice(i + 1).some((x) => x.kind === "dynamic" && x.withRange)) return notModelled(`A with range after the greedy ${it.name} is not modelled.`);
      if (left % it.elementWidth !== 0)
        return notModelled(`${left} bits are left for ${it.name}, which is not a whole number of ${it.elementWidth}-bit elements; the lab does not model that case.`);
      const count = left / it.elementWidth;
      sizes[it.name] = count;
      widths.push(left);
      withNotes.push(`${it.name} has no with range, so it is greedy: it is resized to take all the data left after the fixed-size items that follow it, ${count} element${count === 1 ? "" : "s"} (§11.4.14.4)`);
    } else {
      sizes[it.name] = 0;
      widths.push(0);
      withNotes.push(`${it.name} comes after the greedy item, so it is left empty (§11.4.14.4)`);
    }
    // With >> the fill is sequential, so a later with range can read an earlier item.
    if (sequential) {
      const w = widths[i];
      if (cursor + w > available) return tooFew(widths.reduce((s, x) => s + x, 0));
      const raw = src.slice(cursor, cursor + w);
      values[it.name] = it.twoState ? toTwoState(raw).bits : raw;
      cursor += w;
    }
  }
  const needed = widths.reduce((s, w) => s + w, 0);
  if (needed > available) return tooFew(needed);
  const consumed = src.slice(0, needed);
  // Reading (STREAM_ASSUMPTIONS): bits are consumed from the left first, then the << is undone on them.
  const perm = reorderPermutation(needed, op);
  const concat: TaggedBit[] = new Array(needed);
  consumed.forEach((b, p) => {
    concat[perm[p]] = b;
  });
  // The slices the pack would cut from the targets' concatenation (§11.4.14.2): the consumed bits hold them slice 0 first.
  const targetSlices = op.dir === "<<" ? sliceFromRight(needed, op.slice ?? 1) : [];
  const consumedCards: StreamCard[] = [];
  let read = 0;
  for (let k = targetSlices.length - 1; k >= 0; k -= 1) {
    const s = targetSlices[k];
    consumedCards.push({ label: `slice ${s.number}`, bits: consumed.slice(read, read + s.width) });
    read += s.width;
  }
  let at = 0;
  items.forEach((it, i) => {
    const raw = concat.slice(at, at + widths[i]);
    values[it.name] = it.twoState ? toTwoState(raw).bits : raw;
    at += widths[i];
  });
  const ignored = available - needed;
  const consumeText =
    ignored > 0
      ? `the ${needed} bits at its left (most significant) end are consumed and the ${ignored} low bits are ignored`
      : "all of them are consumed";
  const fillList = items
    .map((it) => (it.kind === "dynamic" ? `${it.name}.size() = ${sizes[it.name]}${sizes[it.name] > 0 ? ` (${chunk(values[it.name], it.elementWidth).map((el) => formatBits(plain(el))).join(", ")})` : ""}` : `${it.name} = ${formatBits(plain(values[it.name]))}`))
    .join(", ");
  const steps: StreamStep[] = [
    {
      id: "pack",
      title: "Take the source",
      text: `Source (§11.4.14.3): ${srcText}. The targets need ${needed}, so ${consumeText}.`,
      bits: src,
      marked: Array.from({ length: needed }, (_, i) => i),
      markLabel: "consumed",
    },
    { id: "slice", title: "Slice", text: unpackSliceText(op, needed, targetSlices), bits: consumed, cards: op.dir === "<<" ? consumedCards : undefined },
    {
      id: "reverse",
      title: "Reverse",
      text:
        op.dir === ">>"
          ? "Reverse (§11.4.14.3): nothing to undo; >> fills the targets in stream order."
          : `Reverse (§11.4.14.3): the unpack is the reverse of the pack, so the slice order is reversed back; the bits inside each slice keep their order.`,
      bits: concat,
      cards: op.dir === "<<" ? sliceCards(concat, targetSlices) : undefined,
    },
    {
      id: "fit",
      title: "Fill the targets",
      text: `Fill (§11.4.14.3): the targets are filled from the most significant end, left target first${withNotes.length ? `; ${withNotes.join("; ")}` : ""}: ${fillList}.`,
      bits: concat,
      cards: items.flatMap((it): StreamCard[] =>
        it.kind === "dynamic" ? chunk(values[it.name], it.elementWidth).map((el, i) => ({ label: `${it.name}[${i}]`, bits: el })) : [{ label: it.name, bits: values[it.name] }],
      ),
    },
  ];
  return { ...base, status: "ok", needed, values, sizes, ignored, steps };
}

/** The slice step of an unpack: the consumed bits are cut back into the slices the pack made. */
function unpackSliceText(op: StreamOperator, needed: number, targetSlices: readonly StreamSlice[]): string {
  if (op.dir === ">>") return sliceStepText(op, needed, [], true);
  const size = op.slice ?? 1;
  const short = targetSlices.length > 0 && targetSlices[0].width < size ? targetSlices[0] : null;
  const shortText = short ? `; slice ${short.number}, the short one with ${short.width} bit${short.width === 1 ? "" : "s"}, comes last` : "";
  return `Slice (§11.4.14.2, §11.4.14.3): the unpack reverses the pack, so the ${needed} consumed bits are cut back into the ${targetSlices.length} slices a {${operatorText(op)} {…}} of the targets would make, slice 0 first${shortText}.`;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Segments: runs of bits from one origin, for coloured brackets
// ---------------------------------------------------------------------------

export interface BitRun {
  start: number;
  end: number;
  origin: string;
  /** "len[7:0]", "addr[0:15]" (reversed), "kind[3]", "zero fill". */
  label: string;
  /** The origin's own bit numbers at the run's left and right ends; absent for a zero fill or a nonexistent entry. */
  first?: number;
  last?: number;
}

/** Splits bits into runs with one origin and bit numbers stepping by one, so a reversed run reads addr[0:15]. */
export function bitRuns(bits: readonly TaggedBit[]): BitRun[] {
  const runs: { start: number; end: number; origin: string; step: number }[] = [];
  bits.forEach((b, p) => {
    const last = runs[runs.length - 1];
    if (last && last.origin === b.origin) {
      const prev = bits[p - 1].index;
      const step = b.index - prev;
      if (b.index < 0 && prev < 0) {
        last.end = p;
        return;
      }
      if ((step === 1 || step === -1) && (last.step === 0 || last.step === step)) {
        last.end = p;
        last.step = step;
        return;
      }
    }
    runs.push({ start: p, end: p, origin: b.origin, step: 0 });
  });
  return runs.map((r) => {
    if (r.origin === FILL_ORIGIN) return { start: r.start, end: r.end, origin: r.origin, label: "zero fill" };
    if (r.origin === NONEXISTENT_ORIGIN) return { start: r.start, end: r.end, origin: r.origin, label: "beyond the end" };
    const first = bits[r.start].index;
    const last = bits[r.end].index;
    return { start: r.start, end: r.end, origin: r.origin, first, last, label: first === last ? `${r.origin}[${first}]` : `${r.origin}[${first}:${last}]` };
  });
}

/**
 * A run's label in words, for a strip that adds its own bracketed position:
 * "kind bits 0..7" beside the strip's "[31:24]", never two bracketed ranges.
 */
export function segmentWords(r: BitRun): string {
  if (r.first === undefined || r.last === undefined) return r.label;
  return r.first === r.last ? `${r.origin} bit ${r.first}` : `${r.origin} bits ${r.first}..${r.last}`;
}

// ---------------------------------------------------------------------------
// Bit-stream casting (§6.24.1, §6.24.3)
// ---------------------------------------------------------------------------

export interface CastMember {
  name: string;
  width: number;
  twoState: boolean;
  /** Declaration line inside a struct, or the typedef base. */
  declType: string;
}

export interface CastSource {
  id: CastSourceId;
  name: string;
  typeName: string;
  decl: string[];
  members: { name: string; bits: Bit[]; twoState: boolean }[];
  /** Every source in this lab is an unpacked struct. */
  unpacked: true;
}

export interface CastDest {
  id: CastDestId;
  /** The text before the apostrophe: word_t, int, logic [31:0]. */
  castText: string;
  decl: string[];
  width: number;
  twoState: boolean;
  signed: boolean;
  unpacked: boolean;
  /** Is castText one of the casting_type forms of Syntax 6-7 (§6.24.1)? */
  validCastType: boolean;
}

export type CastSourceId = "rec" | "rec24";
export type CastDestId = "word_t" | "int" | "wide_t" | "bits24_t" | "inline";

/** hdr_rec_t, the lesson's unpacked header: len, addr, kind = 04, BEEF, 01. */
export const HDR_FIELDS = [
  { name: "len", width: 8, hex: "04" },
  { name: "addr", width: 16, hex: "BEEF" },
  { name: "kind", width: 8, hex: "01" },
] as const;

/** The nibble of addr that the x toggle replaces: addr[3:0]. */
export const X_ADDR_HEX = "BEEx";

/** hdr_rec_t's members are logic, a 4-state type (§6.11, Table 6-8). */
const HDR_STATE_NOTE = "logic (4-state)";

export const HDR_TYPEDEF = ["typedef struct {               // unpacked", "  logic [7:0]  len;", "  logic [15:0] addr;", "  logic [7:0]  kind;", "} hdr_rec_t;"];

const hdrHex = (name: string, xInAddr: boolean) => (name === "addr" && xInAddr ? X_ADDR_HEX : HDR_FIELDS.find((f) => f.name === name)?.hex ?? "");

export function hdrInit(xInAddr: boolean): string {
  return `'{len: 8'h${hdrHex("len", xInAddr)}, addr: 16'h${hdrHex("addr", xInAddr)}, kind: 8'h${hdrHex("kind", xInAddr)}}`;
}

export function castSource(id: CastSourceId, xInAddr = false): CastSource {
  if (id === "rec") {
    return {
      id,
      name: "rec",
      typeName: "hdr_rec_t",
      decl: [...HDR_TYPEDEF, `hdr_rec_t rec = ${hdrInit(xInAddr)};`],
      members: HDR_FIELDS.map((f) => ({ name: f.name, bits: hexBits(hdrHex(f.name, xInAddr), f.width), twoState: false })),
      unpacked: true,
    };
  }
  // The shape of the standard's own example in §6.24.3: struct {bit[7:0] a; shortint b;}, 24 bits, 2-state.
  return {
    id,
    name: "r24",
    typeName: "rec24_t",
    decl: ["typedef struct {               // unpacked, 24 bits", "  bit [7:0] a;", "  shortint  b;", "} rec24_t;", "rec24_t r24 = '{a: 8'h04, b: 16'hBEEF};"],
    members: [
      { name: "a", bits: hexBits("04", 8), twoState: true },
      { name: "b", bits: hexBits("BEEF", 16), twoState: true },
    ],
    unpacked: true,
  };
}

export const CAST_DESTS: Record<CastDestId, CastDest> = {
  word_t: { id: "word_t", castText: "word_t", decl: ["typedef logic [31:0] word_t;"], width: 32, twoState: false, signed: false, unpacked: false, validCastType: true },
  int: { id: "int", castText: "int", decl: [], width: 32, twoState: true, signed: true, unpacked: false, validCastType: true },
  wide_t: { id: "wide_t", castText: "wide_t", decl: ["typedef logic [39:0] wide_t;"], width: 40, twoState: false, signed: false, unpacked: false, validCastType: true },
  bits24_t: { id: "bits24_t", castText: "bits24_t", decl: ["typedef bit [23:0] bits24_t;"], width: 24, twoState: true, signed: false, unpacked: false, validCastType: true },
  inline: { id: "inline", castText: "logic [31:0]", decl: [], width: 32, twoState: false, signed: false, unpacked: false, validCastType: false },
};

export type CastFailure = "type-name" | "size";

export interface CastResult {
  compiles: boolean;
  failure?: CastFailure;
  expression: string;
  /** The generic packed value of step a (§6.24.3). */
  generic: TaggedBit[];
  genericFourState: boolean;
  value?: TaggedBit[];
  converted: number;
  steps: string[];
  message: string;
}

const castExpr = (src: CastSource, dest: CastDest) => `${dest.castText}'(${src.name})`;

/** The width of a source as a bit stream: the sum of its members (§6.24.3). */
export const sourceWidth = (src: CastSource) => src.members.reduce((s, m) => s + m.bits.length, 0);

/** §6.24.1 and §6.24.3: the cast `dest'(src)` for an unpacked struct source. */
export function bitStreamCast(src: CastSource, dest: CastDest): CastResult {
  const expression = castExpr(src, dest);
  const generic: TaggedBit[] = src.members.flatMap((m) => m.bits.map((v, p) => ({ v, origin: m.name, index: m.bits.length - 1 - p })));
  const genericFourState = src.members.some((m) => !m.twoState);
  const sw = generic.length;
  const flatText = `Flatten (§6.24.3 a): ${src.name} becomes one ${sw}-bit packed value, first member in the most significant bits: ${src.members.map((m) => m.name).join(", ")} = ${formatBits(plain(generic))}. ${
    genericFourState ? `${src.typeName} has 4-state members (logic), so the value is 4-state.` : `Every member of ${src.typeName} is 2-state, so the value is 2-state.`
  }`;
  if (!dest.validCastType) {
    const message = `${expression} does not parse. The casting type must be one of the forms of Syntax 6-7, such as a typedef name or a type keyword like int (§6.24.1); ${dest.castText}, with a packed dimension, is none of them. Declare typedef logic [31:0] word_t; and write word_t'(${src.name}).`;
    return { compiles: false, failure: "type-name", expression, generic, genericFourState, converted: 0, steps: [message], message };
  }
  if (sw !== dest.width) {
    const message = `${expression} is a compile-time error: ${src.typeName} is unpacked, and a bit-stream cast between fixed-size types of different sizes is an error when either type is unpacked (§6.24.3). ${src.name} is ${sw} bits and ${dest.castText} is ${dest.width}.`;
    return {
      compiles: false,
      failure: "size",
      expression,
      generic,
      genericFourState,
      converted: 0,
      steps: [flatText, `Sizes (§6.24.3): ${src.name} is ${sw} bits and ${dest.castText} is ${dest.width}; ${src.typeName} is unpacked, so they must be equal. They are not: compile-time error.`],
      message,
    };
  }
  const cast = dest.twoState && genericFourState ? toTwoState(generic) : { bits: generic, converted: 0 };
  const cutText = `Cut (§6.24.3 b): the value is cut into ${dest.castText} from the left, so the bit order is kept: ${formatBits(plain(cast.bits))}.${
    dest.twoState && genericFourState
      ? ` ${dest.castText} is a 2-state type, so it is assigned as if cast to 2-state: ${cast.converted > 0 ? `the ${cast.converted} x and z bits become 0` : "there are no x or z bits to change"} (§6.24.3 b, §6.11.2).`
      : !dest.twoState && genericFourState && hasUnknownBits(cast.bits)
        ? ` ${dest.castText} is 4-state (logic), so the x bits arrive as x.`
        : ""
  }`;
  const message = `${expression} compiles: ${src.name} and ${dest.castText} are both ${sw} bits (§6.24.3).`;
  return {
    compiles: true,
    expression,
    generic,
    genericFourState,
    value: cast.bits,
    converted: cast.converted,
    steps: [flatText, `Sizes (§6.24.3): ${src.name} is ${sw} bits and ${dest.castText} is ${dest.width}; ${src.typeName} is unpacked, so they must be equal, and they are.`, cutText],
    message,
  };
}

/** A cast result as text, with the int reading when the destination is signed. */
export function castValueText(result: CastResult, dest: CastDest): string {
  if (!result.compiles || !result.value) return "does not compile";
  const bits = plain(result.value);
  const lit = formatBits(bits);
  if (!dest.signed) return lit;
  const v = signedValue(bits);
  return v === null ? lit : `${lit} (${v.toString()})`;
}

/** The source as a stream operand, for the comparison rows. */
export function castSourceExpr(src: CastSource): StreamExpr {
  return { kind: "struct", name: src.name, members: src.members.map((m) => ({ kind: "packed", name: `${src.name}.${m.name}`, tag: m.name, bits: m.bits, twoState: m.twoState, stateNote: m.twoState ? undefined : HDR_STATE_NOTE })) };
}

export interface CompareRow {
  code: string;
  result: string;
  why: string;
  error: boolean;
}

/** The lesson's three-row table, computed for one source, every row assigned to a 32-bit word_t w. */
export function castCompareRows(src: CastSource): CompareRow[] {
  const w: StreamTarget = { kind: "fixed", name: "w", width: 32, twoState: false, decl: "word_t w;" };
  const cast = bitStreamCast(src, CAST_DESTS.word_t);
  const operand = castSourceExpr(src);
  const fwd = packStream({ dir: ">>" }, [operand], w);
  const swap = packStream({ dir: "<<", slice: 8 }, [operand], w);
  const pad = (r: PackResult) => (r.fit && r.fit.zeroFill > 0 ? `; the ${r.packed.length}-bit stream is left-aligned with ${r.fit.zeroFill} zero bits on the right` : "");
  return [
    {
      code: `w = word_t'(${src.name});`,
      result: cast.compiles && cast.value ? formatBits(plain(cast.value)) : "compile-time error",
      why: cast.compiles ? "bits copied in order; the sizes must be equal (§6.24.3)" : `the sizes differ, ${sourceWidth(src)} and 32, and ${src.typeName} is unpacked (§6.24.3)`,
      error: !cast.compiles,
    },
    {
      code: `w = {>> {${src.name}}};`,
      result: fwd.ok && fwd.fit ? formatBits(plain(fwd.fit.bits)) : "error",
      why: `the same bits, left to right${pad(fwd)} (§11.4.14)`,
      error: !fwd.ok,
    },
    {
      code: `w = {<< 8 {${src.name}}};`,
      result: swap.ok && swap.fit ? formatBits(plain(swap.fit.bits)) : "error",
      why: `${swap.slices.length} slices of 8 bits in reverse order${pad(swap)} (§11.4.14.2)`,
      error: !swap.ok,
    },
  ];
}

// ---------------------------------------------------------------------------
// Prediction options
// ---------------------------------------------------------------------------

export interface LabOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** A deterministic shuffle, so the correct option is not always first and the order is stable per scenario. */
export function arrangeOptions<T extends { id: string; label: string; correct: boolean }>(options: readonly T[], seed = ""): T[] {
  const out = [...options];
  if (out.length < 2) return out;
  const key = `${out.map((o) => o.label).join("|")}#${seed}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Keeps the first option of each label; the correct one is pushed first, so a distractor equal to it is dropped. */
function dedupe(options: LabOption[]): LabOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    if (seen.has(o.label)) return false;
    seen.add(o.label);
    return true;
  });
}

export const ERROR_LABEL = "an error";

// ---------------------------------------------------------------------------
// Stream mode: subjects, operators, targets, presets
// ---------------------------------------------------------------------------

export type StreamSubject = "hdr" | "fieldswap" | "literal" | "payload";
export type StreamOpId = ">>" | "<<8" | "<<" | "<<4" | ">>4" | "field<<8";
export type StreamTargetId = "w32" | "w40" | "w24" | "byteq" | "r6" | "r8";
export type StreamDirection = "pack" | "unpack";

export interface StreamConfig {
  subject: StreamSubject;
  direction: StreamDirection;
  op: StreamOpId;
  target: StreamTargetId;
  /** Replace addr[3:0] with x (hdr and fieldswap packs). */
  xInAddr: boolean;
  /** payload: unpack with `with [0 +: hdr.len]`. */
  withRange: boolean;
  /** payload: the value of the first byte of the received stream, which lands in hdr.len. */
  lenByte: number;
}

export const STREAM_OPS: Record<StreamOpId, { label: string; op: StreamOperator }> = {
  ">>": { label: "{>> {…}}", op: { dir: ">>" } },
  "<<8": { label: "{<< 8 {…}}", op: { dir: "<<", slice: 8 } },
  "<<": { label: "{<< {…}}", op: { dir: "<<" } },
  "<<4": { label: "{<< 4 {…}}", op: { dir: "<<", slice: 4 } },
  ">>4": { label: "{>> 4 {…}}", op: { dir: ">>", slice: 4 } },
  "field<<8": { label: "per field: {<< 8} on each", op: { dir: ">>" } },
};

export const STREAM_TARGETS: Record<StreamTargetId, StreamTarget> = {
  w32: { kind: "fixed", name: "w", width: 32, twoState: false, decl: "logic [31:0] w;" },
  w40: { kind: "fixed", name: "w40", width: 40, twoState: false, decl: "logic [39:0] w40;" },
  w24: { kind: "fixed", name: "w24", width: 24, twoState: false, decl: "logic [23:0] w24;" },
  byteq: { kind: "queue", name: "q", elementWidth: 8, twoState: true, decl: "byte unsigned q[$];" },
  r6: { kind: "fixed", name: "r6", width: 6, twoState: false, decl: "logic [5:0] r6;" },
  r8: { kind: "fixed", name: "r8", width: 8, twoState: false, decl: "logic [7:0] r8;" },
};

/** Unpack sources: the same names as the pack targets, holding the bytes 04 BE EF 01 (and AA for the 40-bit one). */
export const UNPACK_SOURCE_HEX: Record<"w32" | "w40" | "w24" | "byteq", string[]> = {
  w32: ["04", "BE", "EF", "01"],
  w40: ["04", "BE", "EF", "01", "AA"],
  w24: ["04", "BE", "EF"],
  byteq: ["04", "BE", "EF", "01"],
};

/** payload: the received byte queue rx, after its first (len) byte. */
export const PAYLOAD_TAIL_HEX = ["BE", "EF", "01", "11", "22", "33", "44", "55", "66"];

/** The standard's own remainder example (§11.4.14.2). */
export const REMAINDER_LITERAL = "6'b11_0101";

export const SUBJECT_OPS: Record<StreamSubject, StreamOpId[]> = {
  hdr: [">>", "<<8", "<<"],
  fieldswap: ["field<<8", "<<8"],
  literal: ["<<4", ">>4", "<<"],
  payload: [">>"],
};

export const SUBJECT_TARGETS: Record<StreamSubject, StreamTargetId[]> = {
  hdr: ["w32", "w40", "w24", "byteq"],
  fieldswap: ["w32", "w40", "w24", "byteq"],
  literal: ["r6", "r8", "byteq"],
  payload: ["byteq"],
};

export interface StreamPreset {
  id: string;
  label: string;
  /** The lesson section this preset is for. */
  section: string;
  config: StreamConfig;
}

const cfg = (c: Partial<StreamConfig> & Pick<StreamConfig, "subject" | "op" | "target">): StreamConfig => ({
  direction: "pack",
  xInAddr: false,
  withRange: true,
  lenByte: 4,
  ...c,
});

export const STREAM_PRESETS: StreamPreset[] = [
  { id: "big-endian", label: "A byte queue: q = {>> {hdr}}", section: "Streaming operators", config: cfg({ subject: "hdr", op: ">>", target: "byteq" }) },
  { id: "little-endian", label: "A byte queue: q = {<< 8 {hdr}}", section: "Expert: Streaming aggregates and byte order at scale", config: cfg({ subject: "hdr", op: "<<8", target: "byteq" }) },
  { id: "wide-target", label: "A 40-bit target: w40 = {>> {hdr}}", section: "Streaming operators (how a stream meets its target)", config: cfg({ subject: "hdr", op: ">>", target: "w40" }) },
  { id: "narrow-target", label: "A 24-bit target: w24 = {>> {hdr}}", section: "Streaming operators (how a stream meets its target)", config: cfg({ subject: "hdr", op: ">>", target: "w24" }) },
  { id: "unpack", label: "Unpack from a 40-bit source: {>> {hdr}} = w40", section: "Streaming operators (how a stream meets its target)", config: cfg({ subject: "hdr", direction: "unpack", op: ">>", target: "w40" }) },
  { id: "whole-vs-field", label: "Byte order: the whole struct or each field", section: "Expert: Streaming aggregates and byte order at scale", config: cfg({ subject: "fieldswap", op: "field<<8", target: "w32" }) },
  { id: "with-payload", label: "A variable-length payload and a with range", section: "Expert: Streaming aggregates and byte order at scale", config: cfg({ subject: "payload", direction: "unpack", op: ">>", target: "byteq" }) },
  { id: "remainder", label: "The remainder slice: {<< 4 {6'b11_0101}}", section: "Streaming operators (the remainder rule)", config: cfg({ subject: "literal", op: "<<4", target: "r6" }) },
];

export const STREAM_ASSUMPTIONS = [
  "Every value is computed by sv-stream-model from IEEE 1800-2023 §11.4.14 (targets, and 4-state streams decided by the operand types), §5.7.1 (an integer literal is of type logic), §11.4.14.1 (what is streamed and in which order), §11.4.14.2 (slicing and re-ordering), §11.4.14.3 (unpack), §11.4.14.4 (with ranges and greedy resizing), §6.11.2 (x and z to 2-state), §6.24.1 (cast syntax) and §6.24.3 (bit-stream casts).",
  "The steps are a teaching device. §11.4.14 describes the pack in two steps but says the intermediate stream is never visible and tools may compute the result any way that gives the same answer.",
  "Reading: §11.4.14.3 calls the unpack the reverse of the pack without listing steps. The lab consumes the bits from the left (most significant) end first and then undoes the << on them, which is the order the little-endian packet example of §11.4.14.4 needs.",
  "Where the standard requires an error for a stream (a narrower fixed target, too few source bits), it does not say whether a tool reports it when compiling or when running, or what the targets hold afterwards; the lab shows no value.",
  "Limits: the lab unpacks a with range only as [0 +: n] with >>, with the count read from a field unpacked earlier; with <<, the number of bits consumed would depend on that field, a case the lab does not model. It does not model a greedy item whose share is not a whole number of elements.",
  "hdr is the lesson's unpacked hdr_rec_t. A packed struct with the same members streams the same bits, because its first member is its most significant (§7.2.1).",
];

export const CAST_ASSUMPTIONS = [
  "Every value is computed by sv-stream-model from IEEE 1800-2023 §6.24.1 (Syntax 6-7: the casting type), §6.24.3 (bit-stream casting: flatten, size check, cut from the left, 2-state parts) and §6.11.2 (x and z become 0 in a 2-state type), and the comparison rows from §11.4.14.",
  "Both sources are unpacked structs, so every cast here is a bit-stream cast (§6.24.1 sends a cast that is not assignment compatible to §6.24.3) and a size difference is a compile-time error (§6.24.3).",
  "rec24_t has the shape of the standard's own 24-bit example in §6.24.3: struct {bit [7:0] a; shortint b;}. Its members are 2-state, so it has no x to inject.",
];

/** Builds the stream operands of a config's subject. */
export function subjectOperands(config: StreamConfig, opId: StreamOpId = config.op): StreamExpr[] {
  // §5.7.1: an integer literal constant is a vector of type logic, so it is 4-state.
  if (config.subject === "literal") return [{ kind: "packed", name: REMAINDER_LITERAL, tag: "lit", bits: binBits("110101"), twoState: false, stateNote: "an integer literal, of type logic (4-state) (§5.7.1)" }];
  const members: StreamExpr[] = HDR_FIELDS.map((f) => ({ kind: "packed", name: `hdr.${f.name}`, tag: f.name, bits: hexBits(hdrHex(f.name, config.xInAddr), f.width), twoState: false, stateNote: HDR_STATE_NOTE }));
  if (config.subject === "fieldswap" && opId === "field<<8") return members.map((m) => ({ kind: "stream", op: { dir: "<<", slice: 8 }, operands: [m] }));
  return [{ kind: "struct", name: "hdr", members }];
}

const HDR_UNPACK_ITEMS: UnpackItem[] = HDR_FIELDS.map((f) => ({ kind: "fixed", name: `hdr.${f.name}`, width: f.width, twoState: false }));

function unpackSource(config: StreamConfig): { expr: StreamExpr; name: string; decl: string } {
  if (config.subject === "payload") {
    const bytes = [config.lenByte.toString(16).toUpperCase().padStart(2, "0"), ...PAYLOAD_TAIL_HEX];
    return {
      expr: { kind: "array", name: "rx", elements: bytes.map((h) => hexBits(h, 8)), elementWidth: 8, elementTwoState: true },
      name: "rx",
      decl: `byte unsigned rx[$] = {${bytes.map((h) => `8'h${h}`).join(", ")}};`,
    };
  }
  const id = config.target as keyof typeof UNPACK_SOURCE_HEX;
  const bytes = UNPACK_SOURCE_HEX[id] ?? UNPACK_SOURCE_HEX.w32;
  const t = STREAM_TARGETS[id] ?? STREAM_TARGETS.w32;
  if (t.kind === "queue") {
    return {
      expr: { kind: "array", name: t.name, elements: bytes.map((h) => hexBits(h, 8)), elementWidth: 8, elementTwoState: true },
      name: t.name,
      decl: `byte unsigned ${t.name}[$] = {${bytes.map((h) => `8'h${h}`).join(", ")}};`,
    };
  }
  const bits = hexBits(bytes.join(""), bytes.length * 8);
  return { expr: { kind: "packed", name: t.name, tag: t.name, bits, twoState: t.twoState }, name: t.name, decl: `${t.decl.replace(";", "")} = ${formatBits(bits)};` };
}

function payloadItems(config: StreamConfig): UnpackItem[] {
  return [...HDR_UNPACK_ITEMS, { kind: "dynamic", name: "payload", elementWidth: 8, twoState: true, withRange: config.withRange ? { countFrom: "hdr.len" } : undefined }];
}

/** The statement of a config as source text. */
export function statementText(config: StreamConfig, opId: StreamOpId = config.op): string {
  const op = STREAM_OPS[opId].op;
  if (config.direction === "unpack" || config.subject === "payload") {
    const src = unpackSource(config);
    if (config.subject === "payload") return `{${operatorText(op)} {hdr, payload${config.withRange ? " with [0 +: hdr.len]" : ""}}} = ${src.name};`;
    return `{${operatorText(op)} {hdr}} = ${src.name};`;
  }
  const target = STREAM_TARGETS[config.target];
  return `${target.name} = ${exprText({ kind: "stream", op, operands: subjectOperands(config, opId) })};`;
}

/** The declarations and the statement a learner reads before predicting. No result appears in it. */
export function streamCode(config: StreamConfig): string[] {
  const lines = ["// the assignments run inside an initial block"];
  if (config.subject !== "literal") {
    lines.push(...HDR_TYPEDEF);
    lines.push(config.direction === "unpack" || config.subject === "payload" ? "hdr_rec_t hdr;" : `hdr_rec_t hdr = ${hdrInit(config.xInAddr)};`);
  }
  if (config.subject === "payload") {
    lines.push("byte unsigned payload[$];");
    lines.push(unpackSource(config).decl);
  } else if (config.direction === "unpack") {
    lines.push(unpackSource(config).decl);
  } else {
    lines.push(STREAM_TARGETS[config.target].decl);
  }
  lines.push(statementText(config));
  return lines;
}

export interface StreamRun {
  config: StreamConfig;
  code: string[];
  question: string;
  pack?: PackResult;
  unpack?: UnpackResult;
  /** The answer as an option label. */
  answer: string;
  answerIsError: boolean;
  options: LabOption[];
  /** Same operands, every operator of the subject, same target (pack only). */
  compare: CompareRow[];
  notes: string[];
}

/** What a pack is asked about: q[0] for a queue, the whole value for a fixed target. */
function packAnswer(r: PackResult, target: StreamTarget): string {
  if (!r.ok || !r.fit) return ERROR_LABEL;
  if (target.kind === "queue") return r.fit.elements && r.fit.elements.length > 0 ? formatBits(plain(r.fit.elements[0])) : "no element";
  return formatBits(plain(r.fit.bits));
}

export function streamQuestion(config: StreamConfig): string {
  if (config.subject === "payload") return "What is payload.size() after this unpack?";
  if (config.direction === "unpack") return "What is hdr.addr after this unpack?";
  const t = STREAM_TARGETS[config.target];
  return t.kind === "queue" ? `What is ${t.name}[0] after this assignment?` : `What does ${t.name} hold after this assignment?`;
}

const opExprText = (config: StreamConfig, opId: StreamOpId) =>
  exprText({ kind: "stream", op: STREAM_OPS[opId].op, operands: subjectOperands(config, opId) });

/** Left-to-right slicing: the misconception that << cuts from the left, so a short slice lands on the right. */
function sliceFromLeftValue(bits: readonly TaggedBit[], size: number): TaggedBit[] {
  const chunks = chunk(bits, size);
  return chunks.reverse().flat();
}

/** The re-order rule of a config in one clause, for the short feedback on the correct option. */
function reorderSummary(config: StreamConfig, r: PackResult): string {
  if (config.op === "field<<8") return "each inner {<< 8 {…}} reverses the bytes of its own field and the outer >> keeps the fields in order (§11.4.14.1, §11.4.14.2)";
  const op = STREAM_OPS[config.op].op;
  if (op.dir === ">>") return ">> keeps the stream in order (§11.4.14.2)";
  const size = op.slice ?? 1;
  const short = r.slices.length > 0 && r.slices[0].width < size ? ", the left-most one short," : "";
  if (size === 1) return "<< with no slice size reverses every bit (§11.4.14.2)";
  return `<< ${size} cuts ${size}-bit slices from the right${short} and reverses their order (§11.4.14.2)`;
}

/**
 * The feedback on the correct option: the deciding rules in one or two
 * sentences. The step-through below the verdict carries the detail.
 */
export function packCorrectFeedback(config: StreamConfig, r: PackResult): string {
  if (!r.ok || !r.fit) return r.error ?? "";
  const first = reorderSummary(config, r);
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}. ${r.fit.summary}`;
}

function packOptions(config: StreamConfig, r: PackResult): LabOption[] {
  const target = STREAM_TARGETS[config.target];
  const op = STREAM_OPS[config.op].op;
  const correct = packAnswer(r, target);
  const expr = opExprText(config, config.op);
  const why = packCorrectFeedback(config, r);
  const options: LabOption[] = [{ id: "correct", label: correct, correct: true, feedback: why }];
  // Every other operator of the subject, on the same target.
  SUBJECT_OPS[config.subject]
    .filter((id) => id !== config.op)
    .forEach((id) => {
      const other = packStream(STREAM_OPS[id].op, subjectOperands(config, id), target);
      const label = packAnswer(other, target);
      options.push({
        id: `op-${id}`,
        label,
        correct: false,
        feedback: `That is the answer for ${opExprText(config, id)}. ${expr} works differently: ${r.steps.filter((s) => s.id === "slice" || s.id === "reverse").map((s) => s.text).join(" ")}`,
      });
    });
  if (op.dir === "<<" && (op.slice ?? 1) > 1 && r.packed.length % (op.slice ?? 1) !== 0) {
    const wrong = fitToTarget(sliceFromLeftValue(r.packed, op.slice ?? 1), target, r.fourState);
    const label = wrong.ok ? (target.kind === "queue" && wrong.elements ? formatBits(plain(wrong.elements[0])) : formatBits(plain(wrong.bits))) : ERROR_LABEL;
    options.push({ id: "from-left", label, correct: false, feedback: `That cuts the slices from the left. §11.4.14.2 cuts them starting with the right-most bit, so the short slice is the left-most one: ${r.steps.find((s) => s.id === "slice")?.text}` });
  }
  if (r.ok && r.fit && r.fit.zeroFill > 0) {
    // The misconception that a stream is right-aligned and zero-extended on the left, like an ordinary assignment.
    const right: Bit[] = [...Array.from({ length: r.fit.zeroFill }, () => "0" as Bit), ...plain(r.reordered)];
    const label = target.kind === "queue" ? formatBits(right.slice(0, target.elementWidth)) : formatBits(right);
    options.push({ id: "right-aligned", label, correct: false, feedback: `That puts the zeros on the left, as an ordinary assignment would extend a value. A stream is left-aligned in its target, so the ${r.fit.zeroFill} zero bits go on the right (§11.4.14).` });
  }
  if (config.subject === "fieldswap") {
    const plainHdr = packStream({ dir: ">>" }, subjectOperands(config, "<<8"), target);
    options.push({ id: "unchanged", label: packAnswer(plainHdr, target), correct: false, feedback: `That is {>> {hdr}}, every field as it was. Each inner {<< 8 {…}} reverses the bytes of its own operand, so the two bytes of addr swap, while len and kind, one byte each, stay as they are (§11.4.14.1, §11.4.14.2).` });
  }
  if (!r.ok && target.kind === "fixed") {
    const high = plain(r.reordered).slice(0, target.width);
    options.push({ id: "left-kept", label: formatBits(high), correct: false, feedback: `That keeps the left ${target.width} bits of the stream. A stream is never cut to fit a narrower fixed target: ${r.error}` });
    const low = plain(r.reordered).slice(r.reordered.length - target.width);
    options.push({ id: "truncated", label: formatBits(low), correct: false, feedback: `That keeps the low ${target.width} bits, as an ordinary assignment would truncate. A stream is never truncated into a narrower fixed target: ${r.error}` });
  }
  if (target.kind === "queue" && r.ok && r.fit?.elements && r.fit.elements.length > 1) {
    const last = r.fit.elements[r.fit.elements.length - 1];
    options.push({ id: "last-element", label: formatBits(plain(last)), correct: false, feedback: `That is ${target.name}[${r.fit.elements.length - 1}], the last element. The stream is left-aligned, so ${target.name}[0] takes its most significant ${target.elementWidth} bits (§11.4.14).` });
  }
  options.push({
    id: "error",
    label: ERROR_LABEL,
    correct: false,
    feedback: `There is no error here: ${r.fit?.text ?? why}`,
  });
  return dedupe(options).slice(0, 5);
}

function unpackAnswer(config: StreamConfig, u: UnpackResult): string {
  if (u.status !== "ok") return ERROR_LABEL;
  if (config.subject === "payload") return String(u.sizes.payload);
  return formatBits(plain(u.values["hdr.addr"]));
}

/** The feedback on the correct unpack option: the deciding rule in one sentence; the steps carry the detail. */
export function unpackCorrectFeedback(config: StreamConfig, u: UnpackResult): string {
  if (u.status !== "ok") return u.message ?? "";
  if (config.subject === "payload") {
    const n = u.sizes.payload;
    const len = unsignedValue(plain(u.values["hdr.len"] ?? []));
    return config.withRange
      ? `The with range reads hdr.len = ${len?.toString() ?? "?"}, filled just before by the same unpack, so payload is resized to ${n} element${n === 1 ? "" : "s"} (§11.4.14.4).`
      : `With no with range, payload is greedy: it takes all the data left after hdr, ${n} element${n === 1 ? "" : "s"} (§11.4.14.4).`;
  }
  const op = STREAM_OPS[config.op].op;
  const undo = op.dir === "<<" ? `, and the ${operatorText(op)} slice order is undone on them` : "";
  return `The ${u.needed} bits at the left (most significant) end of the source fill hdr, left field first${undo} (§11.4.14.3).`;
}

function unpackOptions(config: StreamConfig, u: UnpackResult): LabOption[] {
  const correct = unpackAnswer(config, u);
  const fill = u.steps.find((s) => s.id === "fit")?.text ?? "";
  const options: LabOption[] = [{ id: "correct", label: correct, correct: true, feedback: unpackCorrectFeedback(config, u) }];
  if (config.subject === "payload") {
    const other = runStreamUnpack({ ...config, withRange: !config.withRange });
    const otherLabel = other.status === "ok" ? String(other.sizes.payload) : ERROR_LABEL;
    options.push({
      id: "other-with",
      label: otherLabel,
      correct: false,
      feedback: config.withRange
        ? `That is the greedy size, what payload gets with no with range. Here the range [0 +: hdr.len] sets the size: ${fill || u.message}`
        : `That is what [0 +: hdr.len] would give. With no with range the first dynamic item is greedy and takes all the data that is left (§11.4.14.4): ${fill || u.message}`,
    });
    const src = unpackSource(config).expr;
    const total = src.kind === "array" ? src.elements.length : 0;
    options.push({ id: "all", label: String(total), correct: false, feedback: `That is every element of rx. hdr takes the first 32 bits, so payload never sees all ${total} bytes (§11.4.14.3).` });
    options.push({ id: "zero", label: "0", correct: false, feedback: `payload starts empty, but the unpack resizes it (§11.4.14.4).` });
  } else {
    const src = unpackSource(config);
    SUBJECT_OPS.hdr
      .filter((id) => id !== config.op)
      .forEach((id) => {
        const other = unpackStream(STREAM_OPS[id].op, HDR_UNPACK_ITEMS, src.expr, src.name);
        options.push({
          id: `op-${id}`,
          label: other.status === "ok" ? formatBits(plain(other.values["hdr.addr"])) : ERROR_LABEL,
          correct: false,
          feedback: `That is what {${operatorText(STREAM_OPS[id].op)} {hdr}} = ${src.name} gives. Here the operator is ${operatorText(STREAM_OPS[config.op].op)}: ${u.status === "ok" ? u.steps.filter((s) => s.id === "slice" || s.id === "reverse").map((s) => s.text).join(" ") : u.message}`,
        });
      });
    if (u.status === "ok" && u.ignored > 0) {
      // The misconception that the low (right) end is consumed.
      const flat = flatten(src.expr);
      const low = flat.slice(u.ignored);
      const lowRun = unpackStream(STREAM_OPS[config.op].op, HDR_UNPACK_ITEMS, { kind: "packed", name: src.name, tag: src.name, bits: plain(low), twoState: false }, src.name);
      if (lowRun.status === "ok")
        options.push({ id: "low-end", label: formatBits(plain(lowRun.values["hdr.addr"])), correct: false, feedback: `That consumes the low ${u.needed} bits. The source is consumed from its left (most significant) end, so the ${u.ignored} low bits are the ones ignored (§11.4.14.3).` });
    }
    if (u.status !== "ok") {
      const padded: Bit[] = [...plain(flatten(src.expr)), ...Array.from({ length: 32 - flatten(src.expr).length }, () => "0" as Bit)];
      const padRun = unpackStream(STREAM_OPS[config.op].op, HDR_UNPACK_ITEMS, { kind: "packed", name: src.name, tag: src.name, bits: padded, twoState: false }, src.name);
      if (padRun.status === "ok")
        options.push({ id: "zero-padded", label: formatBits(plain(padRun.values["hdr.addr"])), correct: false, feedback: `That pads the short source with zeros. An unpack never invents bits: too few bits is an error (§11.4.14.3).` });
    }
  }
  options.push({ id: "error", label: ERROR_LABEL, correct: false, feedback: `There is no error here: ${fill}` });
  return dedupe(options).slice(0, 5);
}

function runStreamUnpack(config: StreamConfig): UnpackResult {
  const src = unpackSource(config);
  const items = config.subject === "payload" ? payloadItems(config) : HDR_UNPACK_ITEMS;
  return unpackStream(STREAM_OPS[config.op].op, items, src.expr, src.name);
}

/** Everything the stream mode shows for one config. */
export function runStream(config: StreamConfig): StreamRun {
  const code = streamCode(config);
  const question = streamQuestion(config);
  const notes: string[] = [];
  if (config.subject === "payload") notes.push("This lab unpacks a with range only with >>. With <<, as in the little-endian packet example of §11.4.14.4, the number of bits consumed depends on hdr.len, a case the lab does not model.");
  if (config.direction === "unpack" || config.subject === "payload") {
    const u = runStreamUnpack(config);
    const answer = unpackAnswer(config, u);
    return { config, code, question, unpack: u, answer, answerIsError: answer === ERROR_LABEL, options: unpackOptions(config, u), compare: [], notes };
  }
  const target = STREAM_TARGETS[config.target];
  const pack = packStream(STREAM_OPS[config.op].op, subjectOperands(config), target);
  const answer = packAnswer(pack, target);
  const compare = SUBJECT_OPS[config.subject].map((id) => {
    const r = packStream(STREAM_OPS[id].op, subjectOperands(config, id), target);
    const value = r.ok && r.fit ? (target.kind === "queue" && r.fit.elements ? r.fit.elements.map((e) => formatBits(plain(e))).join(", ") : formatBits(plain(r.fit.bits))) : "error";
    return {
      code: statementText(config, id),
      result: value,
      why: r.ok ? (r.steps.find((s) => s.id === "reverse")?.text ?? "") : (r.error ?? ""),
      error: !r.ok,
    };
  });
  return { config, code, question, pack, answer, answerIsError: answer === ERROR_LABEL, options: packOptions(config, pack), compare, notes };
}

// ---------------------------------------------------------------------------
// Cast mode: presets and options
// ---------------------------------------------------------------------------

export interface CastConfig {
  source: CastSourceId;
  dest: CastDestId;
  xInAddr: boolean;
}

export interface CastPreset {
  id: string;
  label: string;
  section: string;
  config: CastConfig;
}

export const CAST_PRESETS: CastPreset[] = [
  { id: "round-trip", label: "word_t'(rec)", section: "Bit-stream casting", config: { source: "rec", dest: "word_t", xInAddr: false } },
  { id: "x-to-int", label: "int'(rec) with an x in addr", section: "Bit-stream casting", config: { source: "rec", dest: "int", xInAddr: true } },
  { id: "size-mismatch", label: "int'(r24): a 24-bit record", section: "Bit-stream casting", config: { source: "rec24", dest: "int", xInAddr: false } },
  { id: "type-name", label: "logic [31:0]'(rec)", section: "Bit-stream casting", config: { source: "rec", dest: "inline", xInAddr: false } },
  { id: "equal-24", label: "bits24_t'(r24): a 24-bit record", section: "Bit-stream casting", config: { source: "rec24", dest: "bits24_t", xInAddr: false } },
];

export const CAST_SOURCE_IDS: CastSourceId[] = ["rec", "rec24"];
export const CAST_DEST_IDS: CastDestId[] = ["word_t", "int", "wide_t", "bits24_t", "inline"];

export interface CastRun {
  config: CastConfig;
  source: CastSource;
  dest: CastDest;
  code: string[];
  result: CastResult;
  compileQuestion: string;
  compileOptions: LabOption[];
  valueQuestion: string;
  valueOptions: LabOption[];
  valueText: string;
  compare: CompareRow[];
}

export function runCast(config: CastConfig): CastRun {
  const source = castSource(config.source, config.source === "rec" && config.xInAddr);
  const dest = CAST_DESTS[config.dest];
  const result = bitStreamCast(source, dest);
  const destDecl = dest.id === "inline" ? "logic [31:0] v;" : dest.id === "int" ? "int v;" : `${dest.castText} v;`;
  const code = ["// the assignments run inside an initial block", ...source.decl, ...dest.decl, destDecl, `v = ${result.expression};`];
  const sw = sourceWidth(source);
  const compileOptions: LabOption[] = [
    {
      id: "yes",
      label: "Yes, it compiles",
      correct: result.compiles,
      feedback: result.compiles
        ? `${dest.castText} is a type name and both sides are ${sw} bits, so the bit-stream cast compiles (§6.24.1, §6.24.3).`
        : result.failure === "type-name"
          ? `It does not parse: ${result.message}`
          : `It does not: ${result.message}`,
    },
    {
      id: "no-size",
      label: "No: the sizes differ",
      correct: result.failure === "size",
      feedback:
        result.failure === "size"
          ? result.message
          : result.failure === "type-name"
            ? `The sizes are equal (${sw} and ${dest.width}), but the cast fails before sizes matter: ${result.message}`
            : `The sizes are equal: ${source.name} is ${sw} bits and ${dest.castText} is ${dest.width} (§6.24.3).`,
    },
    {
      id: "no-name",
      label: "No: the cast type is not a type name",
      correct: result.failure === "type-name",
      feedback: result.failure === "type-name" ? result.message : `${dest.castText} is a single type name, one of the forms Syntax 6-7 allows (§6.24.1).`,
    },
  ];
  const valueText = castValueText(result, dest);
  const valueOptions: LabOption[] = [];
  if (result.compiles && result.value) {
    valueOptions.push({ id: "correct", label: formatBits(plain(result.value)), correct: true, feedback: castCorrectFeedback(result, source, dest) });
    const generic = plain(result.generic);
    // Distractors start from the destination's own bits, so in a 2-state destination they hold no x either.
    const swapped = plain(reorder(result.value, { dir: "<<", slice: 8 }).out);
    // Labels are literals only: an int reading on the correct option alone would give it away.
    const fmt = (bits: Bit[]) => formatBits(bits);
    valueOptions.push({ id: "swapped", label: fmt(swapped), correct: false, feedback: `That reverses the bytes, which is {<< 8 {${source.name}}}. A bit-stream cast keeps the bit order: the first member lands in the most significant bits (§6.24.3).` });
    if (result.converted > 0) {
      valueOptions.push({ id: "x-kept", label: formatBits(generic), correct: false, feedback: `That keeps the x. ${dest.castText} is 2-state, so the destination is assigned as if cast to 2-state and the x bits become 0 (§6.24.3 b, §6.11.2).` });
    } else if (hasUnknownBits(result.value)) {
      const zeroed = plain(toTwoState(result.value).bits);
      valueOptions.push({ id: "x-zeroed", label: formatBits(zeroed), correct: false, feedback: `That turns the x into 0. ${dest.castText} is a logic type, 4-state, so the x bits arrive as x; only a 2-state destination converts them (§6.24.3 b).` });
    }
    const reversed = plain(reorder(result.value, { dir: "<<" }).out);
    valueOptions.push({ id: "bit-reversed", label: fmt(reversed), correct: false, feedback: `That reverses every bit, which is {<< {${source.name}}}. A cast changes only the shape (§6.24.3).` });
  }
  return {
    config,
    source,
    dest,
    code,
    result,
    compileQuestion: `Does ${result.expression} compile?`,
    compileOptions,
    valueQuestion: `What does v hold after v = ${result.expression}?`,
    valueOptions: dedupe(valueOptions),
    valueText,
    compare: castCompareRows(source),
  };
}

/** The feedback on the correct value: the deciding rules in one or two sentences; the steps carry the detail. */
export function castCorrectFeedback(result: CastResult, source: CastSource, dest: CastDest): string {
  const order = `A bit-stream cast keeps the bit order: ${source.name}'s first member lands in the most significant bits of ${dest.castText} (§6.24.3).`;
  if (result.converted > 0) return `${order} ${dest.castText} is 2-state, so the ${result.converted} x and z bits become 0 (§6.24.3 b, §6.11.2).`;
  if (result.value && hasUnknownBits(result.value)) return `${order} ${dest.castText} is 4-state (logic), so the x bits arrive as x.`;
  return order;
}

/** Why the x toggle is off for the 24-bit record. */
export const REC24_X_NOTE = "rec24_t's members are bit and shortint, both 2-state types (§6.11, Table 6-8), so r24 cannot hold an x.";

/** Short control labels, from the declarations they stand for. */
export const TARGET_LABELS: Record<StreamTargetId, string> = {
  w32: "logic [31:0] w",
  w40: "logic [39:0] w40",
  w24: "logic [23:0] w24",
  byteq: "byte unsigned q[$]",
  r6: "logic [5:0] r6",
  r8: "logic [7:0] r8",
};

export const CAST_SOURCE_LABELS: Record<CastSourceId, string> = { rec: "hdr_rec_t rec (32 bits)", rec24: "rec24_t r24 (24 bits)" };

export const CAST_DEST_LABELS: Record<CastDestId, string> = {
  word_t: "word_t (logic [31:0])",
  int: "int",
  wide_t: "wide_t (logic [39:0])",
  bits24_t: "bits24_t (bit [23:0])",
  inline: "logic [31:0] written inline",
};
