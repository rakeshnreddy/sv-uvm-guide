/**
 * Pure model of how a select addresses packed and unpacked array dimensions,
 * how indexed part-selects count, and what the array query functions return.
 * No React. Every rule names the IEEE 1800-2023 clause it implements; the
 * component (ArraySelectExplorer) only renders what these functions return,
 * so the text on screen and the model cannot disagree.
 *
 * Clauses used:
 * - §7.4.1 packed arrays (a packed array used as a primary is one vector;
 *   int is selected from as if it were [31:0]).
 * - §7.4.2 unpacked arrays ([size] means [0:size-1]).
 * - §7.4.4 multidimensional arrays (packed dimensions follow the unpacked ones
 *   when referenced; the rightmost dimension varies fastest; omitting the
 *   fastest-varying indices references a subarray).
 * - §7.4.5 indexing and slicing (a slice of a packed array is packed, a slice of
 *   an unpacked array is unpacked; invalid indexes into unpacked arrays read the
 *   Table 7-1 value; packed arrays defer to §11.5.1).
 * - §11.5.1 bit-selects and part-selects (invalid bit-select reads x or 0;
 *   out-of-range part-selects read x; indexed part-selects +: and -:).
 * - §20.7 and §20.7.1 array query functions; §7.11 points to §20.7.
 */

/* ------------------------------------------------------------------ */
/* Shared types and formatting                                         */
/* ------------------------------------------------------------------ */

export type Bit = "0" | "1" | "x";

export interface Range {
  left: number;
  right: number;
}

export const rangeText = (r: Range) => `[${r.left}:${r.right}]`;
export const rangeSize = (r: Range) => Math.abs(r.left - r.right) + 1;
export const inRange = (r: Range, i: number) => i >= Math.min(r.left, r.right) && i <= Math.max(r.left, r.right);
/** Distance of index i from the right bound, which is the least significant end of a packed dimension (§20.7: $right of a packed dimension is the least significant element). */
export const offsetFromRight = (r: Range, i: number) => (r.left >= r.right ? i - r.right : r.right - i);
/** Indices from the left bound to the right bound, in declaration order. */
export function rangeIndices(r: Range): number[] {
  const step = r.left >= r.right ? -1 : 1;
  const out: number[] = [];
  for (let i = r.left; ; i += step) {
    out.push(i);
    if (i === r.right) break;
  }
  return out;
}

/**
 * A sized literal: 1'b1 for one bit; hex (underscore every four digits) when
 * each nibble is fully known or fully x, as in 32'hAABB_CCDD or 8'hxx;
 * otherwise binary with an underscore every four bits, as in 8'bxxxx_1010.
 */
export function formatBits(bits: readonly Bit[]): string {
  const w = bits.length;
  if (w === 0) return "no bits";
  if (w === 1) return `1'b${bits[0]}`;
  const nibbles: Bit[][] = [];
  if (w % 4 === 0) for (let k = 0; k < w; k += 4) nibbles.push(bits.slice(k, k + 4) as Bit[]);
  const hexable = w % 4 === 0 && nibbles.every((n) => n.every((b) => b !== "x") || n.every((b) => b === "x"));
  if (hexable) {
    const digits = nibbles.map((n) => (n[0] === "x" ? "x" : parseInt(n.join(""), 2).toString(16).toUpperCase()));
    let out = "";
    digits.forEach((d, k) => {
      if (k > 0 && (digits.length - k) % 4 === 0) out += "_";
      out += d;
    });
    return `${w}'h${out}`;
  }
  let out = "";
  bits.forEach((b, k) => {
    if (k > 0 && (w - k) % 4 === 0) out += "_";
    out += b;
  });
  return `${w}'b${out}`;
}

/** Bits of a value of at most 32 bits, most significant first, two's complement in `width` bits. */
export function wordBits(value: number, width: number): Bit[] {
  if (width > 32) throw new Error("the model's words are at most 32 bits");
  const out: Bit[] = [];
  for (let p = width - 1; p >= 0; p -= 1) out.push(bitOf(value, p) ? "1" : "0");
  return out;
}

/** Bit p (0 = least significant) of a non-negative or 32-bit two's complement value. */
function bitOf(value: number, p: number): boolean {
  return p < 32 && ((value >>> 0) >>> p) % 2 === 1;
}

function bitsToSigned(bits: readonly Bit[]): number {
  let v = 0;
  bits.forEach((b) => {
    v = v * 2 + (b === "1" ? 1 : 0);
  });
  if (bits[0] === "1") v -= 2 ** bits.length;
  return v;
}

/* ------------------------------------------------------------------ */
/* Selects (§7.4.4, §7.4.5, §11.5.1, Table 7-1)                        */
/* ------------------------------------------------------------------ */

export type StateKind = "logic" | "bit";

export interface ArrayDecl {
  name: string;
  /** "int" is 2-state and selected from as if it were [31:0] (§7.4.1). */
  base: StateKind | "int";
  packed: Range[];
  unpacked: Range[];
  /** The packed word stored at these unpacked indices. */
  word: (unpackedIndices: readonly number[]) => number;
  /** How the declaration is written, e.g. "logic [3:0][7:0] w". */
  declText: string;
  /** How the value is given, e.g. "w = 32'hAABB_CCDD". */
  valueText: string;
}

export const isFourState = (d: ArrayDecl) => d.base === "logic";
export const wordWidth = (d: ArrayDecl) => d.packed.reduce((acc, r) => acc * rangeSize(r), 1);

export type SelectItem =
  | { kind: "index"; value: number | "x"; /** Shown instead of the number, e.g. "i". */ name?: string }
  | { kind: "range"; left: number; right: number };

export type SelectKind = "packed" | "unpacked" | "bit" | "invalid";

export const SELECT_KIND_LABELS: Record<SelectKind, string> = {
  packed: "packed vector",
  unpacked: "unpacked array (separate elements)",
  bit: "single bit",
  invalid: "invalid select",
};

export type SelectValue =
  | { shape: "packed"; bits: Bit[]; intLike: boolean }
  | { shape: "unpacked"; range: Range; elements: SelectValue[] };

export interface SelectResult {
  expr: string;
  kind: SelectKind;
  value: SelectValue | null;
  valueText: string;
  typeText: string;
  /** Unpacked index tuples whose words are read. */
  rows: number[][];
  /** Bit positions (0 = least significant) read inside each of those words. */
  wordBits: number[];
  /** For a single bit: "2×8 + 3 = 19". */
  bitArithmetic?: string;
  invalid?: { packed: boolean; reason: "out-of-bounds" | "x-index"; dimension: Range; index: number | "x" | Range };
  /** Packed elements named by a slice that do not exist. */
  missingElements: number[];
  /**
   * §11.5.1 gives x for an out-of-range part-select and states no separate
   * 2-state value. Set when that rule applies to a 2-state declaration.
   */
  twoStateUnstated: boolean;
  steps: string[];
  explanation: string;
  notes: string[];
  clauses: string[];
  /** Set when the select is outside what the model covers or is illegal. */
  error?: string;
}

export function selectExpr(decl: ArrayDecl, items: readonly SelectItem[]): string {
  return `${decl.name}${items.map((it) => (it.kind === "range" ? `[${it.left}:${it.right}]` : `[${it.name ?? it.value}]`)).join("")}`;
}

function invalidBits(width: number, fourState: boolean): Bit[] {
  return new Array(width).fill(fourState ? "x" : "0");
}

function packedTypeText(base: string, dims: readonly Range[]): string {
  if (base === "int" && dims.length === 1 && dims[0].left === 31 && dims[0].right === 0) return "int";
  const b = base === "int" ? "bit" : base;
  return dims.length ? `${b} ${dims.map(rangeText).join("")}` : b;
}

function valueText(v: SelectValue): string {
  if (v.shape === "packed") return v.intLike && v.bits.every((b) => b !== "x") ? String(bitsToSigned(v.bits)) : formatBits(v.bits);
  return `'{${v.elements.map(valueText).join(", ")}}`;
}

export const selectValueText = valueText;

function fullWordValue(decl: ArrayDecl, u: readonly number[]): SelectValue {
  return { shape: "packed", bits: wordBits(decl.word(u), wordWidth(decl)), intLike: decl.base === "int" };
}

/** Elements of the remaining unpacked dimensions, as nested unpacked values. */
function subarray(decl: ArrayDecl, prefix: number[], dims: readonly Range[], rows: number[][]): SelectValue {
  if (dims.length === 0) {
    rows.push(prefix);
    return fullWordValue(decl, prefix);
  }
  const [first, ...rest] = dims;
  return { shape: "unpacked", range: first, elements: rangeIndices(first).map((i) => subarray(decl, [...prefix, i], rest, rows)) };
}

function stepIndex(name: string, packed: boolean, index: number, r: Range, bitsText?: string) {
  return `[${name}] selects element ${index} of the ${packed ? "packed" : "unpacked"} dimension ${rangeText(r)}${bitsText ? `, ${bitsText}` : ""} (§7.4.5).`;
}

/**
 * Evaluates a select. Unpacked indices are applied first, then packed ones,
 * each group left to right (§7.4.4). A slice may only be the last item
 * (§7.4.5: "Slices of an array can only apply to one dimension").
 */
export function evaluateSelect(decl: ArrayDecl, items: readonly SelectItem[]): SelectResult {
  const expr = selectExpr(decl, items);
  const four = isFourState(decl);
  const W = wordWidth(decl);
  const nU = decl.unpacked.length;
  const nP = decl.packed.length;
  const base: SelectResult = {
    expr,
    kind: "packed",
    value: null,
    valueText: "",
    typeText: "",
    rows: [],
    wordBits: [],
    missingElements: [],
    twoStateUnstated: false,
    steps: [],
    explanation: "",
    notes: [],
    clauses: [],
  };
  const fail = (error: string): SelectResult => ({ ...base, kind: "invalid", error, explanation: error, valueText: "not modelled" });
  if (items.length > nU + nP) return fail(`${expr} has more indices than ${decl.name} has dimensions.`);
  if (items.slice(0, -1).some((it) => it.kind === "range")) return fail(`${expr}: a slice can only apply to one dimension, so the model allows it only as the last select (§7.4.5).`);

  const steps: string[] = [];
  const clauses = new Set<string>();
  const notes: string[] = [];
  const u: number[] = [];

  // 1. Unpacked dimensions first (§7.4.4).
  for (let k = 0; k < Math.min(items.length, nU); k += 1) {
    const it = items[k];
    const dim = decl.unpacked[k];
    const remainingUnpacked = decl.unpacked.slice(k + 1);
    if (it.kind === "range") {
      const r = { left: it.left, right: it.right };
      const sameDirection = r.left === r.right || (dim.left >= dim.right) === (r.left >= r.right);
      if (!inRange(dim, r.left) || !inRange(dim, r.right) || !sameDirection) {
        return fail(`${expr}: the model covers only in-range unpacked slices in the declared direction ${rangeText(dim)}.`);
      }
      const rows: number[][] = [];
      const value: SelectValue = {
        shape: "unpacked",
        range: r,
        elements: rangeIndices(r).map((i) => subarray(decl, [...u, i], remainingUnpacked, rows)),
      };
      steps.push(`[${it.left}:${it.right}] is a slice of the unpacked dimension ${rangeText(dim)}: elements ${it.left} to ${it.right}.`);
      steps.push("A slice of an unpacked array is an unpacked array: separate elements, not one vector (§7.4.5).");
      clauses.add("§7.4.5");
      const elemType = remainingUnpacked.length
        ? `unpacked array ${remainingUnpacked.map(rangeText).join("")} of ${packedTypeText(decl.base, decl.packed)}`
        : packedTypeText(decl.base, decl.packed);
      return finish({ ...base, kind: "unpacked", value, rows, wordBits: allBits(W), typeText: `unpacked array ${rangeText(r)} of ${elemType}` }, steps, clauses, notes);
    }
    if (it.value === "x" || !inRange(dim, it.value)) {
      // §7.4.5 + Table 7-1: an invalid index into an unpacked array.
      const reason = it.value === "x" ? "x-index" : "out-of-bounds";
      // The read has the shape and type the select would have with a valid index; every bit is the Table 7-1 value.
      const shaped = evaluateSelect(decl, items.map((x, j) => (j === k ? idx(dim.left) : x)));
      const blank = (v: SelectValue): SelectValue =>
        v.shape === "packed" ? { ...v, bits: invalidBits(v.bits.length, four) } : { ...v, elements: v.elements.map(blank) };
      const value: SelectValue = shaped.value ? blank(shaped.value) : { shape: "packed", bits: invalidBits(W, four), intLike: decl.base === "int" };
      const elemDims = items.length === k + 1 ? remainingUnpacked : [];
      steps.push(
        reason === "x-index"
          ? `[${it.name ?? "x"}] is an index with x bits, so it is invalid (§7.4.5).`
          : `[${it.value}] is outside the unpacked dimension ${rangeText(dim)}, so the index is invalid (§7.4.5).`,
      );
      steps.push(
        `Reading an unpacked array with an invalid index returns the Table 7-1 value: ${four ? "'x for a 4-state" : "'0 for a 2-state"} integral element (§7.4.5, Table 7-1).`,
      );
      if (elemDims.length) steps.push("For a fixed-size unpacked element, Table 7-1 gives an array whose every element has that value.");
      steps.push("Writing through an invalid index does nothing (§7.4.5).");
      notes.push("Implementations may issue a warning for an invalid index (§7.4.5).");
      clauses.add("§7.4.5").add("Table 7-1");
      return finish(
        {
          ...base,
          kind: "invalid",
          value,
          typeText: shaped.typeText,
          invalid: { packed: false, reason, dimension: dim, index: it.value },
        },
        steps,
        clauses,
        notes,
      );
    }
    steps.push(stepIndex(String(it.name ?? it.value), false, it.value, dim));
    u.push(it.value);
  }

  // Fewer unpacked indices than unpacked dimensions: a subarray (§7.4.4).
  if (items.length < nU) {
    const rows: number[][] = [];
    const value = subarray(decl, u, decl.unpacked.slice(items.length), rows);
    steps.push(
      items.length === 0
        ? "With no index, the name references the entire array (§7.4.4)."
        : "The fastest-varying indices are omitted, so this references a subarray (§7.4.4): an unpacked array of separate elements.",
    );
    clauses.add("§7.4.4");
    const remaining = decl.unpacked.slice(items.length);
    return finish(
      { ...base, kind: "unpacked", value, rows, wordBits: allBits(W), typeText: `unpacked array ${remaining.map(rangeText).join("")} of ${packedTypeText(decl.base, decl.packed)}` },
      steps,
      clauses,
      notes,
    );
  }
  if (nU > 0 && items.length > nU) {
    steps.push("Unpacked indices come first, then packed ones; the rightmost dimension varies fastest (§7.4.4).");
    clauses.add("§7.4.4");
  }

  // 2. Packed dimensions (§7.4.4, §7.4.5; invalid access in §11.5.1).
  const elemWidth = decl.packed.map((_, k) => decl.packed.slice(k + 1).reduce((acc, r) => acc * rangeSize(r), 1));
  const word = wordBits(decl.word(u), W); // MSB first
  const bitAt = (p: number): Bit => word[W - 1 - p];
  let offset = 0;
  let width = W;
  const terms: string[] = [];
  const packedItems = items.slice(nU);
  if (packedItems.length === 0) {
    if (nU === 0) {
      steps.push("With no index, the name references the entire array (§7.4.4); a packed array used as a primary is one vector (§7.4.1).");
      clauses.add("§7.4.1").add("§7.4.4");
    } else {
      steps.push(`All unpacked indices are given, so this is one element: the whole packed word, ${W} bits.`);
    }
  }
  for (let k = 0; k < packedItems.length; k += 1) {
    const it = packedItems[k];
    const dim = decl.packed[k];
    const ew = elemWidth[k];
    const remaining = decl.packed.slice(k + 1);
    if (it.kind === "range") {
      const r = { left: it.left, right: it.right };
      const sameDirection = r.left === r.right || (dim.left >= dim.right) === (r.left >= r.right);
      if (!sameDirection) {
        return fail(`${expr}: the first index of a range must address the more significant end (§11.5.1); in ${rangeText(dim)} write [${it.right}:${it.left}].`);
      }
      const bits: Bit[] = [];
      const read: number[] = [];
      const missing: number[] = [];
      rangeIndices(r).forEach((i) => {
        if (inRange(dim, i)) {
          const lo = offset + offsetFromRight(dim, i) * ew;
          for (let p = lo + ew - 1; p >= lo; p -= 1) {
            bits.push(bitAt(p));
            read.push(p);
          }
        } else {
          missing.push(i);
          bits.push(...new Array<Bit>(ew).fill("x"));
        }
      });
      clauses.add("§7.4.5");
      const count = rangeSize(r);
      if (missing.length === count) {
        // §11.5.1: completely out of range reads x.
        steps.push(
          `[${it.left}:${it.right}] names elements ${it.left} to ${it.right} of the packed dimension ${rangeText(dim)}, and none of them exists.`,
        );
        steps.push("A part-select completely out of the address bounds yields x when read and has no effect when written (§11.5.1).");
        steps.push(`The slice names ${count} elements of ${ew} bits, so the model shows ${count * ew} x bits.`);
        notes.push("Indices outside the declared range may be flagged as a compile-time error (§11.5.1, NOTE 2), so many tools warn or reject this at compile time (tool-dependent).");
        clauses.add("§11.5.1");
        if (!four) notes.push("§11.5.1 gives x for this read and states no separate 2-state value; a 2-state variable cannot hold x, so what a bit array reads here is not stated by the standard. Check your tool.");
        return finish(
          {
            ...base,
            kind: "invalid",
            value: { shape: "packed", bits, intLike: false },
            twoStateUnstated: !four,
            missingElements: missing,
            typeText: packedTypeText(decl.base, [r, ...remaining]),
            invalid: { packed: true, reason: "out-of-bounds", dimension: dim, index: r },
            rows: nU ? [u] : [],
          },
          steps,
          clauses,
          notes,
        );
      }
      steps.push(`[${it.left}:${it.right}] is a slice of the packed dimension ${rangeText(dim)}: ${count} elements of ${ew} bit${ew === 1 ? "" : "s"}.`);
      steps.push("A slice of a packed array is a packed array: one vector (§7.4.5).");
      if (missing.length) {
        steps.push(`Elements ${missing.join(", ")} do not exist, so their bits read x (§11.5.1).`);
        clauses.add("§11.5.1");
      }
      return finish(
        {
          ...base,
          kind: "packed",
          value: { shape: "packed", bits, intLike: false },
          twoStateUnstated: !four && missing.length > 0,
          missingElements: missing,
          rows: nU ? [u] : [],
          wordBits: read,
          typeText: packedTypeText(decl.base, [r, ...remaining]),
        },
        steps,
        clauses,
        notes,
      );
    }
    if (it.value === "x" || !inRange(dim, it.value)) {
      // §11.5.1: an invalid bit-select reads x (4-state) or 0 (2-state); 7.4.5 sends packed arrays here.
      const reason = it.value === "x" ? "x-index" : "out-of-bounds";
      steps.push(
        reason === "x-index"
          ? `[${it.name ?? "x"}] has x bits, so the select address is invalid (§11.5.1).`
          : `[${it.value}] is outside the packed dimension ${rangeText(dim)}, so the select address is invalid (§11.5.1).`,
      );
      steps.push(`An invalid select of a packed array reads ${four ? "x for a 4-state" : "0 for a 2-state"} value (§11.5.1; §7.4.5 sends packed arrays to §11.5.1).`);
      clauses.add("§11.5.1").add("§7.4.5");
      return finish(
        {
          ...base,
          kind: "invalid",
          value: { shape: "packed", bits: invalidBits(ew, four), intLike: false },
          typeText: packedTypeText(decl.base, remaining),
          invalid: { packed: true, reason, dimension: dim, index: it.value },
          rows: nU ? [u] : [],
        },
        steps,
        clauses,
        notes,
      );
    }
    const pos = offsetFromRight(dim, it.value);
    const lo = offset + pos * ew;
    const bitsText = ew === 1 ? `bit ${lo} of the word` : `bits ${lo + ew - 1}:${lo} of the word`;
    steps.push(stepIndex(String(it.name ?? it.value), true, it.value, dim, bitsText));
    terms.push(ew === 1 ? `${pos}` : `${pos}×${ew}`);
    offset = lo;
    width = ew;
  }
  clauses.add("§7.4.5");
  const bits: Bit[] = [];
  const read: number[] = [];
  for (let p = offset + width - 1; p >= offset; p -= 1) {
    bits.push(bitAt(p));
    read.push(p);
  }
  const remaining = decl.packed.slice(packedItems.length);
  const isBit = width === 1 && packedItems.length > 0;
  const result: SelectResult = {
    ...base,
    kind: isBit ? "bit" : "packed",
    value: { shape: "packed", bits, intLike: decl.base === "int" && packedItems.length === 0 },
    rows: nU ? [u] : [],
    wordBits: read,
    typeText: isBit ? (decl.base === "logic" ? "logic" : "bit") : packedTypeText(decl.base, remaining),
  };
  if (isBit && terms.length > 1) result.bitArithmetic = `${terms.join(" + ")} = ${offset}`;
  if (isBit) steps.push(`That is bit ${offset} of ${nU ? `${decl.name}[${u.join("][")}]` : decl.name}${result.bitArithmetic ? ` (${result.bitArithmetic})` : ""}.`);
  return finish(result, steps, clauses, notes);
}

function allBits(W: number): number[] {
  return Array.from({ length: W }, (_, k) => W - 1 - k);
}

/** What the explorer says instead of a value when §11.5.1 gives x and states no 2-state value. */
export const TWO_STATE_UNSTATED_TEXT = "the standard gives no 2-state value (§11.5.1 gives x)";

function finish(r: SelectResult, steps: string[], clauses: Set<string>, notes: string[]): SelectResult {
  const valueStr = r.value ? valueText(r.value) : "";
  const shown = r.twoStateUnstated ? TWO_STATE_UNSTATED_TEXT : valueStr;
  const kindWord = SELECT_KIND_LABELS[r.kind];
  return {
    ...r,
    valueText: shown,
    steps,
    notes,
    clauses: Array.from(clauses),
    explanation: `${r.expr} reads ${shown}: ${kindWord}, type ${r.typeText}. ${steps.join(" ")}`,
  };
}

/* ---------------- The lesson's arrays ---------------- */

const W_VALUE = 0xaabbccdd;
const B_VALUES = [0x11, 0x22, 0x33, 0x44];

/** mem[i][j] = 8'((i << 4) | j): byte lane j of word i. */
export const memByte = (i: number, j: number) => ((i << 4) | j) & 0xff;
export const memWord = (i: number): number => [3, 2, 1, 0].reduce((acc, j) => acc * 256 + memByte(i, j), 0);
/** grid[r][c] = 10*r + c. */
export const gridValue = (r: number, c: number) => 10 * r + c;

export type DeclId = "w" | "b" | "mem" | "grid";

export function lessonDecl(id: DeclId, state: StateKind = "logic"): ArrayDecl {
  switch (id) {
    case "w":
      return {
        name: "w",
        base: state,
        packed: [
          { left: 3, right: 0 },
          { left: 7, right: 0 },
        ],
        unpacked: [],
        word: () => W_VALUE,
        declText: `${state} [3:0][7:0] w`,
        valueText: `w = ${formatBits(wordBits(W_VALUE, 32))}`,
      };
    case "b":
      return {
        name: "b",
        base: state,
        packed: [{ left: 7, right: 0 }],
        unpacked: [{ left: 0, right: 3 }], // [4] means [0:3] (§7.4.2)
        word: ([i]) => B_VALUES[i],
        declText: `${state} [7:0] b [4]`,
        valueText: `b = '{${B_VALUES.map((v) => formatBits(wordBits(v, 8))).join(", ")}}`,
      };
    case "mem":
      return {
        name: "mem",
        base: state,
        packed: [
          { left: 3, right: 0 },
          { left: 7, right: 0 },
        ],
        unpacked: [{ left: 0, right: 15 }],
        word: ([i]) => memWord(i),
        declText: `${state} [3:0][7:0] mem [16]`,
        valueText: "mem[i][j] = 8'((i << 4) | j)",
      };
    case "grid":
      return {
        name: "grid",
        base: "int",
        packed: [{ left: 31, right: 0 }],
        unpacked: [
          { left: 0, right: 3 },
          { left: 0, right: 7 },
        ],
        word: ([r, c]) => gridValue(r, c),
        declText: "int grid [4][8]",
        valueText: "grid[r][c] = 10*r + c",
      };
  }
}

/** The same array with the elements of its first packed dimension in reverse order: what "count lanes from the left" would read. */
function mirroredFirstPacked(decl: ArrayDecl): ArrayDecl {
  const [first, ...rest] = decl.packed;
  const ew = rest.reduce((acc, r) => acc * rangeSize(r), 1);
  const n = rangeSize(first);
  return {
    ...decl,
    word: (u) => {
      const w = decl.word(u);
      let out = 0;
      for (let k = 0; k < n; k += 1) {
        const chunk = Math.floor(w / 2 ** (k * ew)) % 2 ** ew;
        out += chunk * 2 ** ((n - 1 - k) * ew);
      }
      return out;
    },
  };
}

/** The array seen as one flat vector [W-1:0]: what "the index is a bit number" would read. */
function flattened(decl: ArrayDecl): ArrayDecl {
  return { ...decl, packed: [{ left: wordWidth(decl) - 1, right: 0 }] };
}

export interface SelectCase {
  id: string;
  decl: DeclId;
  items: SelectItem[];
  /** Extra given shown with the case, e.g. "i = 'x". */
  given?: string;
}

const idx = (value: number | "x", name?: string): SelectItem => ({ kind: "index", value, ...(name ? { name } : {}) });
const rng = (left: number, right: number): SelectItem => ({ kind: "range", left, right });

export const SELECT_CASES: readonly SelectCase[] = [
  { id: "w", decl: "w", items: [] },
  { id: "w2", decl: "w", items: [idx(2)] },
  { id: "w3_2", decl: "w", items: [rng(3, 2)] },
  { id: "w2_3", decl: "w", items: [idx(2), idx(3)] },
  { id: "w23_16", decl: "w", items: [rng(23, 16)] },
  { id: "b1", decl: "b", items: [idx(1)] },
  { id: "b1_2", decl: "b", items: [rng(1, 2)] },
  { id: "b5", decl: "b", items: [idx(5)] },
  { id: "bi", decl: "b", items: [idx("x", "i")], given: "i holds 'x" },
  { id: "mem5", decl: "mem", items: [idx(5)] },
  { id: "mem5_2", decl: "mem", items: [idx(5), idx(2)] },
  { id: "mem5_2_3", decl: "mem", items: [idx(5), idx(2), idx(3)] },
  { id: "grid1", decl: "grid", items: [idx(1)] },
  { id: "grid1_7", decl: "grid", items: [idx(1), idx(7)] },
];

export function findSelectCase(id: string | undefined): SelectCase | undefined {
  return SELECT_CASES.find((c) => c.id === id);
}

export function evaluateCase(c: SelectCase, state: StateKind): SelectResult {
  return evaluateSelect(lessonDecl(c.decl, state), c.items);
}

/** The word a single-bit select reads from: "w" or "mem[5]". */
function wordName(r: SelectResult): string {
  const name = r.expr.split("[")[0];
  return r.rows.length ? `${name}[${r.rows[0].join("][")}]` : name;
}

/** "bit 19 of w" for a single-bit select, else undefined. */
export function bitWhere(r: SelectResult): string | undefined {
  return r.kind === "bit" && r.wordBits.length === 1 ? `bit ${r.wordBits[0]} of ${wordName(r)}` : undefined;
}

/** "8'hBB · packed vector"; for a single bit the bit number comes first: "bit 19 of w = 1'b1 · single bit". */
export function outcomeLabel(r: SelectResult): string {
  const where = bitWhere(r);
  return where ? `${where} = ${r.valueText} · ${SELECT_KIND_LABELS.bit}` : `${r.valueText} · ${SELECT_KIND_LABELS[r.kind]}`;
}

export interface SelectQuestion {
  /** "value": value and kind; "bit": which bit and its value; "standard": what the standard states (no 2-state value given). */
  asks: "value" | "bit" | "standard";
  lead: string;
  expr: string;
  tail: string;
}

/**
 * The prediction question for a case, chosen so that the options differ in
 * what is asked: a single-bit select asks for the bit as well as the value,
 * because two different bits can hold the same value.
 */
export function selectQuestion(c: SelectCase, state: StateKind): SelectQuestion {
  const r = evaluateCase(c, state);
  if (r.kind === "bit") return { asks: "bit", lead: "Which bit does ", expr: r.expr, tail: " read, and what is its value?" };
  if (r.twoStateUnstated) return { asks: "standard", lead: "What does IEEE 1800-2023 state that ", expr: r.expr, tail: ` reads on this 2-state ${state} array, and what kind of value is it?` };
  return { asks: "value", lead: "What does ", expr: r.expr, tail: " read, and what kind of value is it?" };
}

export const selectQuestionText = (q: SelectQuestion) => `${q.lead}${q.expr}${q.tail}`;

export interface SelectOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
  /** For select options: the value, kind and (single bit) bit number the option claims. */
  valueText?: string;
  kind?: SelectKind;
  bit?: number;
}

/** Names the bit a single-bit distractor reads against the right one: "Bit 11 of w, not bit 19,". */
function bitContrast(alt: SelectResult, right: SelectResult): string | undefined {
  const a = bitWhere(alt);
  if (!a || right.kind !== "bit" || alt.wordBits[0] === right.wordBits[0]) return undefined;
  return `Bit ${alt.wordBits[0]} of ${wordName(alt)}, not bit ${right.wordBits[0]}`;
}

type Alt = { id: string; result: SelectResult | null; feedback: (alt: SelectResult, right: SelectResult) => string };

function swapKind(r: SelectResult): SelectResult | null {
  const v = r.value;
  if (!v) return null;
  if (v.shape === "unpacked") {
    if (!v.elements.every((e) => e.shape === "packed" && !e.intLike)) return null;
    const bits = v.elements.flatMap((e) => (e.shape === "packed" ? e.bits : []));
    return { ...r, kind: "packed", value: { shape: "packed", bits, intLike: false }, valueText: formatBits(bits) };
  }
  // A packed value split into 8-bit elements, read as separate elements.
  if (v.intLike || v.bits.length < 16 || v.bits.length % 8 !== 0) return null;
  const elements: SelectValue[] = [];
  for (let k = 0; k < v.bits.length; k += 8) elements.push({ shape: "packed", bits: v.bits.slice(k, k + 8), intLike: false });
  const value: SelectValue = { shape: "unpacked", range: { left: 0, right: elements.length - 1 }, elements };
  return { ...r, kind: "unpacked", value, valueText: valueText(value) };
}

function withItems(c: SelectCase, items: SelectItem[], state: StateKind, transform?: (d: ArrayDecl) => ArrayDecl): SelectResult {
  const d = lessonDecl(c.decl, state);
  return evaluateSelect(transform ? transform(d) : d, items);
}

/**
 * Prediction options for a case. The correct one is the model's result; each
 * distractor is the model's result for a named misreading, so its value is
 * computed, not typed.
 */
export function selectOptions(c: SelectCase, state: StateKind): SelectOption[] {
  const right = evaluateCase(c, state);
  const other: StateKind = state === "logic" ? "bit" : "logic";
  const indexItems = c.items.filter((i): i is Extract<SelectItem, { kind: "index" }> => i.kind === "index");
  const alts: Alt[] = [];
  const decl = lessonDecl(c.decl, state);
  const nU = decl.unpacked.length;

  const reachesPacked = c.items.length > nU;
  if (reachesPacked) {
    const first = c.items[nU];
    const p0 = decl.packed[0];
    const fromLeft =
      first.kind === "index" && first.value !== "x"
        ? withItems(c, c.items.map((it, k) => (k === nU ? idx(p0.left + p0.right - (first.value as number)) : it)), state)
        : withItems(c, c.items, state, mirroredFirstPacked);
    alts.push({
      id: "from-left",
      result: fromLeft,
      feedback: (alt, r) =>
        `${bitContrast(alt, r) ? `${bitContrast(alt, r)}, holding ${alt.valueText}, is` : `${alt.valueText} is`} what you get by counting the elements of ${rangeText(decl.packed[0])} from the left. The index is the declared index, not a position: in ${rangeText(decl.packed[0])} element ${decl.packed[0].left} is the most significant, and the bit an address reaches depends on the declaration (§11.5.1).`,
    });
  }
  if (nU === 0 && c.items.length === 1) {
    alts.push({
      id: "bit-number",
      result: withItems(c, c.items, state, flattened),
      feedback: (alt) =>
        `${alt.valueText} is what ${alt.expr} would read on a one-dimensional ${state} [${wordWidth(decl) - 1}:0], where the index is a bit number. On ${decl.declText} the first index selects an element of the leftmost dimension ${rangeText(decl.packed[0])} (§7.4.4, §7.4.5).`,
    });
  }
  if (c.items.length === 0 && nU === 0) {
    alts.push({
      id: "no-index-zero",
      result: withItems(c, [idx(0)], state),
      feedback: (alt) => `${alt.valueText} is ${alt.expr}. A name with no index references the entire array (§7.4.4).`,
    });
  }
  if (indexItems.length >= 2 && c.items.every((i) => i.kind === "index")) {
    const swapped = [...c.items];
    const n = swapped.length;
    [swapped[n - 2], swapped[n - 1]] = [swapped[n - 1], swapped[n - 2]];
    alts.push({
      id: "swapped",
      result: withItems(c, swapped, state),
      feedback: (alt, r) =>
        `${bitWhere(alt) && r.kind === "bit" && alt.wordBits[0] !== r.wordBits[0] ? `${alt.expr} reads ${bitWhere(alt)}, not bit ${r.wordBits[0]}, holding ${alt.valueText}` : `${alt.valueText} is ${alt.expr}`}: the last two indices applied in the other order. Indices apply left to right, unpacked first and then packed, and the rightmost dimension varies fastest (§7.4.4).`,
    });
  }
  if (right.kind === "unpacked" || (right.kind === "packed" && (c.items.length === 0 || c.items.some((i) => i.kind === "range") || (nU > 0 && c.items.length === nU)))) {
    const s = swapKind(right);
    if (s) {
      alts.push({
        id: "kind-swap",
        result: s,
        feedback: (alt) =>
          right.kind === "unpacked"
            ? `${alt.valueText} would treat the elements as one vector. A slice or subarray of an unpacked array is unpacked: separate elements (§7.4.5, §7.4.4).`
            : `${alt.valueText} would treat the bytes as separate elements. ${right.expr} is packed: one vector you can add and compare in one step (§7.4.1, §7.4.5).`,
      });
    }
  }
  if (c.decl === "grid" && c.items.length === 1) {
    alts.push({
      id: "column",
      result: (() => {
        const d = lessonDecl("grid");
        const rows: number[][] = [];
        const r = c.items[0].kind === "index" ? (c.items[0].value as number) : 0;
        const value: SelectValue = { shape: "unpacked", range: d.unpacked[0], elements: rangeIndices(d.unpacked[0]).map((i) => subarray(d, [i, r], [], rows)) };
        return { ...right, value, valueText: valueText(value) };
      })(),
      feedback: (alt) => `${alt.valueText} is column ${c.items[0].kind === "index" ? c.items[0].value : ""}. The first index belongs to the slowest-varying dimension, [4], so grid[1] is a whole row (§7.4.4).`,
    });
    alts.push({
      id: "no-index-zero",
      result: withItems(c, [...c.items, idx(0)], state),
      feedback: (alt) => `${alt.valueText} is ${alt.expr}. Omitting the fastest-varying index references a subarray, not element 0 (§7.4.4).`,
    });
  }
  if (c.decl === "mem" && c.items[0]?.kind === "index" && c.items[0].value !== "x" && !inRange(decl.packed[0], c.items[0].value)) {
    const packedOnly: ArrayDecl = { ...decl, unpacked: [], word: () => decl.word([0]) };
    alts.push({
      id: "packed-first",
      result: evaluateSelect(packedOnly, c.items.slice(0, decl.packed.length)),
      feedback: (alt) =>
        `${alt.valueText} is what you get if the first index went to the packed dimension ${rangeText(decl.packed[0])}, where ${c.items[0].kind === "index" ? c.items[0].value : ""} is out of range. The unpacked indices come first, so [${c.items[0].kind === "index" ? c.items[0].value : ""}] selects a word of ${rangeText(decl.unpacked[0])} (§7.4.4).`,
    });
  }
  if (c.decl === "b" && c.items.length === 1 && c.items[0].kind === "index" && right.kind !== "invalid") {
    const u0 = decl.unpacked[0];
    const i0 = c.items[0].value as number;
    alts.push({
      id: "from-end",
      result: withItems(c, [idx(u0.left + u0.right - i0)], state),
      feedback: (alt) => `${alt.valueText} is ${alt.expr}: counting from the right-hand end. [4] means [0:3] (§7.4.2), and the initializer gives b[0] = ${evaluateSelect(decl, [idx(0)]).valueText}.`,
    });
  }
  if (c.decl === "b" && indexItems.length === 1 && indexItems[0].value !== "x" && right.kind !== "invalid") {
    alts.push({
      id: "from-one",
      result: withItems(c, c.items.map((i) => (i.kind === "index" ? idx((i.value as number) - 1) : { ...i, left: i.left - 1, right: i.right - 1 })), state),
      feedback: (alt) => `${alt.valueText} counts from 1. [4] means [0:3] (§7.4.2), so b[0] is the first element.`,
    });
  }
  if (c.decl === "b" && c.items.length === 1 && c.items[0].kind === "range") {
    alts.push({
      id: "from-one",
      result: withItems(c, [rng(c.items[0].left - 1, c.items[0].right - 1)], state),
      feedback: (alt) => `${alt.valueText} counts from 1. [4] means [0:3] (§7.4.2), so b[1:2] holds the second and third elements.`,
    });
  }
  if (c.decl === "grid" && c.items.length === 2) {
    alts.push({
      id: "from-one",
      result: withItems(c, c.items.map((i) => (i.kind === "index" ? idx((i.value as number) - 1) : i)), state),
      feedback: (alt) => `${alt.valueText} counts from 1. [4][8] means [0:3][0:7] (§7.4.2).`,
    });
  }
  if (right.invalid && !right.invalid.packed) {
    const bad = c.items[0];
    if (bad.kind === "index" && bad.value !== "x") {
      const size = rangeSize(decl.unpacked[0]);
      alts.push({
        id: "wrap",
        result: withItems(c, [idx(bad.value % size)], state),
        feedback: (alt) => `${alt.valueText} is ${alt.expr}: indices do not wrap. ${bad.value} is outside ${rangeText(decl.unpacked[0])}, so the index is invalid (§7.4.5).`,
      });
    }
    if (bad.kind === "index" && bad.value === "x") {
      alts.push({
        id: "x-as-zero",
        result: withItems(c, [idx(0)], state),
        feedback: (alt) => `${alt.valueText} treats x as 0. An index with any x or z bit is invalid (§7.4.5).`,
      });
    }
    alts.push({
      id: "other-state",
      result: withItems(c, c.items, other),
      feedback: (alt) =>
        `${alt.valueText} is what a ${other} array reads. Table 7-1 gives ${state === "logic" ? "'x for a 4-state" : "'0 for a 2-state"} element, and this array is ${state} (§7.4.5, Table 7-1).`,
    });
  }
  if (right.invalid?.packed && right.invalid.index !== "x" && typeof right.invalid.index === "object") {
    alts.push({
      id: "zero",
      result: { ...right, valueText: formatBits(invalidBits(right.value?.shape === "packed" ? right.value.bits.length : 1, false)), twoStateUnstated: false },
      feedback: () =>
        right.twoStateUnstated
          ? "0 is the §11.5.1 rule for an invalid 2-state bit-select. This is a part-select, and §11.5.1 gives x for it with no separate 2-state value, so the standard does not state what a bit array reads. A tool may return 0 here, but that is the tool's choice, not a value the standard gives."
          : "0 is the §11.5.1 rule for an invalid 2-state bit-select. This array is 4-state, and a part-select completely out of range yields x (§11.5.1).",
    });
  }

  // A distractor must differ from every other option in what the question asks:
  // value and kind, plus the bit number when the question asks for the bit.
  const asksBit = selectQuestion(c, state).asks === "bit";
  const key = (r: SelectResult) => `${r.valueText}|${r.kind}${asksBit && r.kind === "bit" ? `|${r.wordBits[0]}` : ""}`;
  const describe = (r: SelectResult) => ({ valueText: r.valueText, kind: r.kind, ...(r.kind === "bit" && r.wordBits.length === 1 ? { bit: r.wordBits[0] } : {}) });
  const options: SelectOption[] = [{ id: "correct", label: outcomeLabel(right), correct: true, feedback: right.explanation, ...describe(right) }];
  const seen = new Set([key(right)]);
  alts.forEach((a) => {
    if (!a.result || a.result.error) return;
    const k = key(a.result);
    if (seen.has(k)) return;
    seen.add(k);
    options.push({ id: a.id, label: outcomeLabel(a.result), correct: false, feedback: a.feedback(a.result, right), ...describe(a.result) });
  });
  return options.slice(0, 4);
}

/** Stable order that does not always put the right answer first. */
export function orderedOptions<T extends { id: string }>(options: readonly T[], seed: string): T[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rot = options.length ? h % options.length : 0;
  return [...options.slice(rot), ...options.slice(0, rot)];
}

/* ------------------------------------------------------------------ */
/* Indexed part-selects (§11.5.1)                                      */
/* ------------------------------------------------------------------ */

export interface VectorDecl {
  name: string;
  /** Left bound: the most significant bit (§11.5.1). */
  msb: number;
  /** Right bound: the least significant bit. */
  lsb: number;
  value: number;
  declText: string;
}

export const VECTOR_V: VectorDecl = { name: "v", msb: 31, lsb: 0, value: 0xaabbccdd, declText: "logic [31:0] v" };
export const VECTOR_UP: VectorDecl = { name: "up_vect", msb: 0, lsb: 15, value: 0xc3a5, declText: "logic [0:15] up_vect" };

export const vectorWidth = (d: VectorDecl) => Math.abs(d.msb - d.lsb) + 1;
export const isAscending = (d: VectorDecl) => d.msb < d.lsb;
export const vectorBits = (d: VectorDecl) => wordBits(d.value, vectorWidth(d));
/** Bit at a declared index, or x when the index is outside the declaration. */
export function vectorBitAt(d: VectorDecl, i: number): Bit {
  if (i < Math.min(d.msb, d.lsb) || i > Math.max(d.msb, d.lsb)) return "x";
  const pos = Math.abs(i - d.lsb); // 0 = least significant
  return bitOf(d.value, pos) ? "1" : "0";
}

export type PartDir = "+:" | "-:";

export interface PartSelectResult {
  expr: string;
  /** The non-indexed part-select it equals, e.g. "up_vect[0:7]". */
  equivalent: string;
  /** Declared indices read, most significant first. */
  indices: number[];
  bits: Bit[];
  outOfRange: number[];
  status: "in" | "partial" | "out" | "x-base" | "error";
  valueText: string;
  /** Plain words for where the in-range bits sit, e.g. "the most significant byte". */
  place: string;
  explanation: string;
  notes: string[];
}

/**
 * v[base +: w] selects w bits starting at the base and ascending the index
 * numbers; v[base -: w] descends (§11.5.1). On a descending declaration the
 * +: base is the lsb_base_expr; on an ascending one it is the msb_base_expr,
 * so up_vect[0 +: 8] == up_vect[0:7] and up_vect[15 -: 8] == up_vect[8:15].
 */
export function indexedPartSelect(d: VectorDecl, baseValue: number | "x", width: number, dir: PartDir, baseText?: string): PartSelectResult {
  const expr = `${d.name}[${baseText ?? baseValue} ${dir} ${width}]`;
  const notes: string[] = [];
  if (!Number.isInteger(width) || width <= 0) {
    return {
      expr,
      equivalent: "",
      indices: [],
      bits: [],
      outOfRange: [],
      status: "error",
      valueText: "illegal",
      place: "",
      explanation: `${expr} is illegal: the width shall be a positive constant integer expression (§11.5.1).`,
      notes,
    };
  }
  if (baseValue === "x") {
    const bits = new Array<Bit>(width).fill("x");
    return {
      expr,
      equivalent: "",
      indices: [],
      bits,
      outOfRange: [],
      status: "x-base",
      valueText: formatBits(bits),
      place: "no bits: the address is unknown",
      explanation: `The base holds x, so ${expr} is a part-select that is x: it yields x when read and has no effect when written (§11.5.1).`,
      notes: ["Part-select indices that evaluate to x or z may be flagged as a compile-time error (§11.5.1, NOTE 1)."],
    };
  }
  const span = Array.from({ length: width }, (_, k) => (dir === "+:" ? baseValue + k : baseValue - k));
  const lo = Math.min(...span);
  const hi = Math.max(...span);
  // Most significant first: on a descending declaration the larger index, on an ascending one the smaller.
  const indices = isAscending(d) ? [...span].sort((a, b) => a - b) : [...span].sort((a, b) => b - a);
  const equivalent = isAscending(d) ? `${d.name}[${lo}:${hi}]` : `${d.name}[${hi}:${lo}]`;
  const bits = indices.map((i) => vectorBitAt(d, i));
  const outOfRange = indices.filter((i) => i < Math.min(d.msb, d.lsb) || i > Math.max(d.msb, d.lsb));
  const status = outOfRange.length === 0 ? "in" : outOfRange.length === width ? "out" : "partial";
  const dirWords = dir === "+:" ? "ascending" : "descending";
  const baseRole = (dir === "+:") === isAscending(d) ? "msb_base_expr" : "lsb_base_expr";
  const parts = [
    `${expr} starts at bit ${baseValue} and selects ${width} bits ${dirWords} the index numbers, so it equals ${equivalent} (§11.5.1).`,
    `In ${d.declText} the base is the ${baseRole}: bit ${d.msb} is the most significant bit${isAscending(d) ? ", so higher index numbers are less significant" : ""}.`,
  ];
  const place = placeOf(d, indices.filter((i) => !outOfRange.includes(i)));
  if (status === "in") parts.push(`It reads ${place}: ${formatBits(bits)}.`);
  if (status === "partial") {
    parts.push(`It is partially out of range: bits ${describeIndices(outOfRange)} do not exist and read x; the in-range bits read their values (§11.5.1).`);
    notes.push("A write through this select changes only the in-range bits (§11.5.1).");
  }
  if (status === "out") parts.push("Every bit is outside the declared range, so the whole select yields x when read and does nothing when written (§11.5.1).");
  if (status !== "in") notes.push("A constant index outside the declared range may be flagged as a compile-time error (§11.5.1, NOTE 2); whether it is depends on the tool.");
  return { expr, equivalent, indices, bits, outOfRange, status, valueText: formatBits(bits), place, explanation: parts.join(" "), notes };
}

function describeIndices(list: readonly number[]): string {
  if (list.length === 1) return `${list[0]}`;
  return `${list[0]} to ${list[list.length - 1]}`;
}

/** Where a set of in-range declared indices sits, in byte terms when they form one byte. */
export function placeOf(d: VectorDecl, indices: readonly number[]): string {
  if (indices.length === 0) return "no bits of the vector";
  const pos = indices.map((i) => Math.abs(i - d.lsb)).sort((a, b) => a - b);
  const W = vectorWidth(d);
  const aligned = pos.length === 8 && pos[0] % 8 === 0 && pos[7] === pos[0] + 7;
  if (!aligned) return `bits at positions ${pos[pos.length - 1]} down to ${pos[0]} from the least significant end`;
  const byte = pos[0] / 8;
  const top = W / 8 - 1;
  const name = byte === top ? "the most significant byte" : byte === 0 ? "the least significant byte" : `byte ${byte} counted from the least significant end`;
  return name;
}

export interface PartCase {
  id: string;
  vector: "v" | "up_vect";
  dir: PartDir;
  width: number;
  /** A fixed base, or a base of 8*i driven by a slider. */
  base: number | "x" | { times: number; slider: { name: string; min: number; max: number } };
  baseText?: string;
}

export const PART_CASES: readonly PartCase[] = [
  { id: "v-var", vector: "v", dir: "+:", width: 8, base: { times: 8, slider: { name: "i", min: 0, max: 4 } } },
  { id: "v-15-down", vector: "v", dir: "-:", width: 8, base: 15 },
  { id: "v-partial", vector: "v", dir: "+:", width: 8, base: 28 },
  { id: "v-negative", vector: "v", dir: "+:", width: 8, base: -4 },
  { id: "v-x", vector: "v", dir: "+:", width: 8, base: "x", baseText: "i" },
  { id: "up-0-up", vector: "up_vect", dir: "+:", width: 8, base: 0 },
  { id: "up-15-down", vector: "up_vect", dir: "-:", width: 8, base: 15 },
  { id: "up-var", vector: "up_vect", dir: "+:", width: 8, base: { times: 8, slider: { name: "i", min: 0, max: 2 } } },
  { id: "up-partial", vector: "up_vect", dir: "+:", width: 8, base: 12 },
];

export const vectorDecl = (v: "v" | "up_vect") => (v === "v" ? VECTOR_V : VECTOR_UP);

/** The base value of a case: fixed, x, or 8*i for the slider value. */
export function partBase(c: PartCase, sliderValue = 0): number | "x" {
  return typeof c.base === "object" ? c.base.times * sliderValue : c.base;
}

export function evaluatePartCase(c: PartCase, sliderValue = 0): PartSelectResult {
  const d = vectorDecl(c.vector);
  if (typeof c.base === "object") {
    return indexedPartSelect(d, c.base.times * sliderValue, c.width, c.dir, `${c.base.times}*${c.base.slider.name}`);
  }
  return indexedPartSelect(d, c.base, c.width, c.dir, c.baseText);
}

export function partOptions(c: PartCase, sliderValue = 0): SelectOption[] {
  const right = evaluatePartCase(c, sliderValue);
  const d = vectorDecl(c.vector);
  const label = (r: PartSelectResult) => (r.equivalent ? `${r.equivalent} = ${r.valueText}` : r.valueText);
  const options: SelectOption[] = [{ id: "correct", label: label(right), correct: true, feedback: right.explanation }];
  if (right.status === "x-base") {
    const zero = indexedPartSelect(d, 0, c.width, c.dir);
    options.push({ id: "x-as-zero", label: label(zero), correct: false, feedback: `That treats the x base as 0. A part-select whose address is x yields x (§11.5.1).` });
    return options;
  }
  const baseValue = partBase(c, sliderValue) as number;
  const flipped = indexedPartSelect(d, baseValue, c.width, c.dir === "+:" ? "-:" : "+:");
  options.push({
    id: "flipped",
    label: label(flipped),
    correct: false,
    feedback: `That is ${flipped.expr}, the other direction. ${c.dir} selects bits starting at the base and ${c.dir === "+:" ? "ascending" : "descending"} the index numbers, whatever the declaration's direction (§11.5.1).`,
  });
  if (right.status === "partial") {
    const allX = new Array<Bit>(c.width).fill("x");
    options.push({
      id: "all-x",
      label: `${right.equivalent} = ${formatBits(allX)}`,
      correct: false,
      feedback: "Only a part-select completely out of range reads all x. A partially out-of-range one reads x only for the missing bits (§11.5.1).",
    });
    const inBits = right.indices.filter((i) => !right.outOfRange.includes(i));
    options.push({
      id: "truncated",
      label: `${inBits.length} bits = ${formatBits(inBits.map((i) => vectorBitAt(d, i)))}`,
      correct: false,
      feedback: `The width of a part-select is always the constant width, ${c.width} here (§11.5.1); missing bits read x, they are not dropped.`,
    });
  } else if (right.status === "out") {
    const hiIdx = Math.max(d.msb, d.lsb);
    const loIdx = Math.min(d.msb, d.lsb);
    const clamped = Math.min(...right.indices) > hiIdx ? indexedPartSelect(d, hiIdx, c.width, "-:") : indexedPartSelect(d, loIdx, c.width, "+:");
    options.push({ id: "clamped", label: label(clamped), correct: false, feedback: "Selects do not clamp to the nearest valid bits. Every bit is out of range, so the read yields x (§11.5.1)." });
  } else {
    const allX = new Array<Bit>(c.width).fill("x");
    options.push({ id: "out", label: `${right.equivalent} = ${formatBits(allX)}`, correct: false, feedback: `Every bit of ${right.equivalent} lies inside ${d.name}[${d.msb}:${d.lsb}], so nothing reads x (§11.5.1).` });
  }
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.label) ? false : (seen.add(o.label), true)));
}

/* ------------------------------------------------------------------ */
/* Array query functions (§20.7, §20.7.1, §7.11)                       */
/* ------------------------------------------------------------------ */

/** Highest possible index of an int-indexed associative array: int is a 32-bit signed integer (§6.11). */
export const INT_INDEX_MAX = 2 ** 31 - 1;

export type QueryDim =
  | { kind: "fixed"; range: Range; packed: boolean; note?: string }
  | { kind: "queue"; size: number | null }
  | { kind: "assoc"; keys: number[] | null };

export interface QueryTarget {
  id: string;
  expr: string;
  declText: string;
  /** What the array holds, for the 2D drawing. */
  contents: string;
  dims: QueryDim[];
  /** For the tracker: the queue length under each key. */
  rows?: { key: number; length: number }[];
  /** Data for a queue: element values. */
  values?: number[];
}

const INT_PACKED: QueryDim = { kind: "fixed", range: { left: 31, right: 0 }, packed: true, note: "int is treated as a packed [31:0] dimension (§20.7)" };

const EXP_ROWS = [
  { key: 5, length: 2 },
  { key: 9, length: 1 },
];

export const QUERY_TARGETS: readonly QueryTarget[] = [
  { id: "f", expr: "f", declText: "int f [7:0]", contents: "8 ints, indices 7 down to 0", dims: [{ kind: "fixed", range: { left: 7, right: 0 }, packed: false }, INT_PACKED] },
  { id: "q", expr: "q", declText: "int q[$] = '{10, 20, 30}", contents: "a queue of 3", dims: [{ kind: "queue", size: 3 }, INT_PACKED], values: [10, 20, 30] },
  { id: "q0", expr: "q", declText: "int q[$] (empty)", contents: "an empty queue", dims: [{ kind: "queue", size: 0 }, INT_PACKED], values: [] },
  { id: "aa", expr: "aa", declText: "int aa[int] (keys 5 and 9)", contents: "keys 5 and 9", dims: [{ kind: "assoc", keys: [5, 9] }, INT_PACKED] },
  { id: "aa0", expr: "aa", declText: "int aa[int] (empty)", contents: "no keys", dims: [{ kind: "assoc", keys: [] }, INT_PACKED] },
  {
    id: "exp",
    expr: "exp_by_id",
    declText: "bit [31:0] exp_by_id [int][$]",
    contents: "key 5 holds a queue of 2, key 9 a queue of 1",
    dims: [{ kind: "assoc", keys: EXP_ROWS.map((r) => r.key) }, { kind: "queue", size: null }, { kind: "fixed", range: { left: 31, right: 0 }, packed: true }],
    rows: EXP_ROWS,
  },
  {
    id: "exp5",
    expr: "exp_by_id[5]",
    declText: "exp_by_id[5]: the queue under key 5",
    contents: "a queue of 2",
    dims: [{ kind: "queue", size: EXP_ROWS[0].length }, { kind: "fixed", range: { left: 31, right: 0 }, packed: true }],
  },
];

export function findQueryTarget(id: string | undefined): QueryTarget | undefined {
  return QUERY_TARGETS.find((t) => t.id === id);
}

export type QueryValue = number | "x" | "error";
export const QUERY_FUNCTIONS = ["$left", "$right", "$low", "$high", "$increment", "$size", "$dimensions", "$unpacked_dimensions"] as const;
export type QueryFunction = (typeof QUERY_FUNCTIONS)[number];
export const PER_DIMENSION: readonly QueryFunction[] = ["$left", "$right", "$low", "$high", "$increment", "$size"];

export interface QueryResult {
  target: QueryTarget;
  dimension: number;
  status: "ok" | "out-of-range" | "illegal";
  values: Record<QueryFunction, QueryValue>;
  /** Why each value holds, generated from the rule that produced it. */
  why: Record<QueryFunction, string>;
  summary: string;
  /** The legal alternative for an illegal query, computed. */
  alternative?: { call: string; value: QueryValue };
}

export const queryValueText = (v: QueryValue) => (v === "x" ? "'x" : v === "error" ? "error" : v < 0 ? `−${-v}` : String(v));

export function callText(fn: QueryFunction, target: QueryTarget, dimension: number): string {
  return fn === "$dimensions" || fn === "$unpacked_dimensions" ? `${fn}(${target.expr})` : `${fn}(${target.expr}, ${dimension})`;
}

/** §20.7 / §20.7.1. Dimensions are numbered from the slowest-varying, which is 1; unpacked before packed. */
export function queryArray(target: QueryTarget, dimension: number): QueryResult {
  const dims = target.dims;
  const nDims = dims.length;
  const nUnpacked = dims.filter((d) => !(d.kind === "fixed" && d.packed)).length;
  const values = {} as Record<QueryFunction, QueryValue>;
  const why = {} as Record<QueryFunction, string>;
  values.$dimensions = nDims;
  values.$unpacked_dimensions = nUnpacked;
  const packedNote = dims.some((d) => d.kind === "fixed" && d.packed && d.note) ? " int counts as one packed [31:0] dimension." : "";
  why.$dimensions = `${nDims}: every dimension, packed and unpacked, static or dynamic (§20.7).${packedNote}`;
  why.$unpacked_dimensions = `${nUnpacked}: the unpacked dimensions only, static or dynamic (§20.7).`;

  const setAll = (v: QueryValue, text: string) =>
    PER_DIMENSION.forEach((fn) => {
      values[fn] = v;
      why[fn] = text;
    });

  if (!Number.isInteger(dimension) || dimension < 1 || dimension > nDims) {
    setAll("x", `Dimension ${dimension} is out of range: ${target.expr} has ${nDims}, so 'x is returned (§20.7).`);
    return { target, dimension, status: "out-of-range", values, why, summary: `Dimension ${dimension} does not exist, so every per-dimension function returns 'x (§20.7).` };
  }
  const d = dims[dimension - 1];
  if (dimension > 1 && d.kind !== "fixed") {
    setAll("error", `Dimension ${dimension} is variable-sized and greater than 1, so the call is an error (§20.7.1).`);
    const element = QUERY_TARGETS.find((t) => t.expr === `${target.expr}[${target.rows?.[0]?.key}]`);
    const alternative = element ? { call: `$size(${element.expr}, 1)`, value: queryArray(element, 1).values.$size } : undefined;
    return {
      target,
      dimension,
      status: "illegal",
      values,
      why,
      alternative,
      summary: `$size(${target.expr}, ${dimension}) is illegal: dimension ${dimension} is a variable-sized ${d.kind === "queue" ? "queue" : "associative"} dimension (§20.7.1). ${
        alternative ? `Ask one element instead: ${alternative.call} = ${queryValueText(alternative.value)}.` : ""
      }`.trim(),
    };
  }
  if (d.kind === "fixed") {
    const { left, right } = d.range;
    const inc = left >= right ? 1 : -1;
    values.$left = left;
    values.$right = right;
    values.$increment = inc;
    values.$low = inc === -1 ? left : right;
    values.$high = inc === -1 ? right : left;
    values.$size = (values.$high as number) - (values.$low as number) + 1;
    why.$left = `${left}: the left bound${d.packed ? ", the most significant element of a packed dimension" : ""} (§20.7).`;
    why.$right = `${right}: the right bound${d.packed ? ", the least significant element" : ""} (§20.7).`;
    why.$increment = `${queryValueText(inc)}: for a fixed-size dimension, 1 when $left ≥ $right and −1 when $left < $right (§20.7).`;
    why.$low = `${values.$low}: equals ${inc === -1 ? "$left because $increment is −1" : "$right because $increment is 1"} (§20.7).`;
    why.$high = `${values.$high}: equals ${inc === -1 ? "$right because $increment is −1" : "$left because $increment is 1"} (§20.7).`;
    why.$size = `${values.$size}: $high − $low + 1 (§20.7).`;
    return { target, dimension, status: "ok", values, why, summary: `Dimension ${dimension} is the fixed-size ${d.packed ? "packed" : "unpacked"} dimension ${rangeText(d.range)}.` };
  }
  if (d.kind === "queue") {
    const n = d.size ?? 0;
    values.$left = 0;
    values.$right = n - 1;
    values.$increment = -1;
    values.$low = 0;
    values.$high = n - 1;
    values.$size = n;
    why.$left = "0: always 0 for a queue or dynamic array dimension (§20.7).";
    why.$right = n === 0 ? "−1: the current size is zero (§20.7)." : `${n - 1}: the right bound of the current contents, size − 1 (§20.7).`;
    why.$increment = "−1: always −1 for a queue or dynamic array dimension (§20.7).";
    why.$low = "0: equals $left because $increment is −1 (§20.7).";
    why.$high = `${queryValueText(n - 1)}: equals $right because $increment is −1 (§20.7).`;
    why.$size = `${n}: the number of elements now in the queue (§20.7).`;
    return { target, dimension, status: "ok", values, why, summary: `Dimension ${dimension} is a queue holding ${n} element${n === 1 ? "" : "s"}: the functions describe its current state (§20.7).` };
  }
  const keys = d.keys ?? [];
  values.$left = 0;
  values.$right = INT_INDEX_MAX;
  values.$increment = -1;
  values.$low = keys.length ? Math.min(...keys) : "x";
  values.$high = keys.length ? Math.max(...keys) : "x";
  values.$size = keys.length;
  why.$left = "0: always 0 for an associative dimension with an integral index (§20.7).";
  why.$right = `${INT_INDEX_MAX}: the highest possible int index value, not the largest key (§20.7).`;
  why.$increment = "−1: always −1 for an associative dimension (§20.7).";
  why.$low = keys.length ? `${values.$low}: the lowest key now allocated (§20.7).` : "'x: no element is allocated (§20.7).";
  why.$high = keys.length ? `${values.$high}: the highest key now allocated (§20.7).` : "'x: no element is allocated (§20.7).";
  why.$size = `${keys.length}: the number of elements now allocated (§20.7).`;
  return {
    target,
    dimension,
    status: "ok",
    values,
    why,
    summary: keys.length
      ? `Dimension ${dimension} is an associative dimension indexed by int with keys ${keys.join(" and ")}. $right is not a key: a loop from $low to $right would count up to ${INT_INDEX_MAX}.`
      : `Dimension ${dimension} is an associative dimension indexed by int with no keys, so $low and $high are 'x (§20.7).`,
  };
}

/**
 * Parses a typed prediction: an integer (with -, the minus sign U+2212, or an
 * en or figure dash), a power of two written 2**n or 2^n with an optional
 * "- k" (so 2**31-1 is 2147483647), 'x / x, or error. Null when it is none of these.
 */
export function parseQueryAnswer(text: string): QueryValue | null {
  const t = text.trim().toLowerCase().replace(/[\u2212\u2013\u2012]/g, "-");
  if (t === "") return null;
  if (t === "'x" || t === "x") return "x";
  if (t === "error" || t === "err" || t === "illegal") return "error";
  if (/^-?\d+$/.test(t)) return Number(t);
  const pow = /^(-?)2\s*(?:\*\*|\^)\s*(\d+)(?:\s*-\s*(\d+))?$/.exec(t);
  if (pow && Number(pow[2]) <= 52) {
    const v = (pow[1] ? -1 : 1) * 2 ** Number(pow[2]) - Number(pow[3] ?? 0);
    return Number.isSafeInteger(v) ? v : null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Presets (one per lesson use)                                        */
/* ------------------------------------------------------------------ */

export type ExplorerMode = "select" | "part-select" | "query";

export interface ExplorerPreset {
  id: string;
  mode: ExplorerMode;
  title: string;
  caseId?: string;
  partCaseId?: string;
  slider?: number;
  targetId?: string;
  dimension?: number;
}

export const ARRAY_SELECT_PRESETS: readonly ExplorerPreset[] = [
  { id: "packed-unpacked", mode: "select", title: "F2A: packed and unpacked selects", caseId: "w2" },
  { id: "mixed-dimensions", mode: "select", title: "F2A: arrays with both kinds of dimension", caseId: "mem5" },
  { id: "indexed-part-select", mode: "part-select", title: "F2A: indexed part-selects and range direction", partCaseId: "v-var", slider: 1 },
  { id: "query-functions", mode: "query", title: "F2B: array query functions", targetId: "f", dimension: 1 },
];

export const DEFAULT_PRESET: Record<ExplorerMode, string> = {
  select: "packed-unpacked",
  "part-select": "indexed-part-select",
  query: "query-functions",
};

/** The preset for a mode: the named one when it belongs to that mode, else the mode's default. */
export function resolvePreset(mode: ExplorerMode, id?: string): { preset: ExplorerPreset; unknown: boolean } {
  const named = id ? ARRAY_SELECT_PRESETS.find((p) => p.id === id && p.mode === mode) : undefined;
  const fallback = ARRAY_SELECT_PRESETS.find((p) => p.id === DEFAULT_PRESET[mode]) as ExplorerPreset;
  return { preset: named ?? fallback, unknown: Boolean(id) && !named };
}
