/**
 * Pure rules for event controls (`@(...)`), shared by the process model and
 * any visual that needs to say whether a value change is an event.
 *
 * Rules implemented (IEEE 1800-2023, checked against the standard's text):
 * - §9.4.2, Table 9-2: posedge is detected on 0→1, 0→x, 0→z, x→1 and z→1;
 *   negedge on 1→0, 1→x, 1→z, x→0 and z→0. The third edge keyword, `edge`,
 *   is detected whenever posedge or negedge is.
 * - §9.4.2: an edge event is detected on the least significant bit of the
 *   expression only. A change of an operand that leaves the expression's
 *   value unchanged is not an event.
 * - §9.4.2.1: `or` and `,` are the same event OR operator; a combination of
 *   both may appear in one list.
 * - §9.4.2.3: an `iff` guard is evaluated when its event expression changes
 *   (not when the guard changes) and must be true as defined in §12.4: a
 *   nonzero known value. x and z are false. `iff` binds tighter than `or`.
 *
 * Values are 4-state: a known number, or a bit string, most significant bit
 * first, over 0/1/x/z (for example "x", "z", "10x1"). The process model only
 * uses the 0/1/x subset.
 */

export type Bit4 = "0" | "1" | "x" | "z";

/** A known value, or a bit string MSB first over 0/1/x/z. */
export type FourStateValue = number | string;

export type EdgeKind = "posedge" | "negedge" | "edge";

/** What an event term waits for: any change of its expression, or an edge. */
export type EventTermKind = "change" | EdgeKind;

const BITS = new Set(["0", "1", "x", "z"]);

function bitString(value: string): string {
  const bits = value.trim().toLowerCase();
  if (bits.length === 0 || [...bits].some((b) => !BITS.has(b))) throw new RangeError(`Not a 4-state bit string: "${value}"`);
  return bits;
}

/** Least significant bit of a value (§9.4.2: edges are detected on the LSB only). */
export function lsbOf(value: FourStateValue): Bit4 {
  if (typeof value === "number") return (value & 1) === 1 ? "1" : "0";
  const bits = bitString(value);
  return bits[bits.length - 1] as Bit4;
}

/** Table 9-2, indexed [from][to]. `null` is "No edge". */
export const EDGE_TABLE: Readonly<Record<Bit4, Readonly<Record<Bit4, "posedge" | "negedge" | null>>>> = {
  "0": { "0": null, "1": "posedge", x: "posedge", z: "posedge" },
  "1": { "0": "negedge", "1": null, x: "negedge", z: "negedge" },
  x: { "0": "negedge", "1": "posedge", x: null, z: null },
  z: { "0": "negedge", "1": "posedge", x: null, z: null },
};

/** The edge (if any) of a one-bit transition, per Table 9-2. */
export function edgeOf(from: Bit4, to: Bit4): "posedge" | "negedge" | null {
  return EDGE_TABLE[from][to];
}

/** Canonical text of a value, so 1 and "0001" compare equal and "X" equals "x". */
function canonical(value: FourStateValue): string {
  if (typeof value === "number") return value < 0 ? `-${(-value).toString(2)}` : value.toString(2);
  const bits = bitString(value);
  const stripped = bits.replace(/^0+(?=.)/, "");
  return stripped;
}

/** True when the value changed (§9.4.2: an implicit event is any change of the expression's value). */
export function valueChanged(before: FourStateValue, after: FourStateValue): boolean {
  return canonical(before) !== canonical(after);
}

/** Whether an edge keyword matches a change of the whole expression (LSB only, §9.4.2). */
export function edgeMatches(kind: EdgeKind, before: FourStateValue, after: FourStateValue): boolean {
  const edge = edgeOf(lsbOf(before), lsbOf(after));
  return kind === "edge" ? edge !== null : edge === kind;
}

/**
 * §12.4 truth: true only for a nonzero known value; zero, x and z are false.
 * A vector that mixes known 1 bits with x or z bits is outside this model.
 */
export function isTrueCondition(value: FourStateValue): boolean {
  if (typeof value === "number") return value !== 0;
  const bits = bitString(value);
  const unknown = /[xz]/.test(bits);
  if (!unknown) return /1/.test(bits);
  if (/1/.test(bits)) throw new RangeError(`Mixed known and unknown bits ("${value}") are outside this model`);
  return false;
}

export interface EventTermEvaluation {
  kind: EventTermKind;
  /** Value of the term's expression before the update. */
  before: FourStateValue;
  /** Value after the update. */
  after: FourStateValue;
  /** Value of the `iff` guard when the expression changes, if the term has one. */
  guard?: FourStateValue;
}

/** Does one event term fire for this update? */
export function termFires({ kind, before, after, guard }: EventTermEvaluation): boolean {
  if (!valueChanged(before, after)) return false;
  if (kind !== "change" && !edgeMatches(kind, before, after)) return false;
  if (guard !== undefined && !isTrueCondition(guard)) return false;
  return true;
}

/** An event OR list fires when any one of its terms fires (§9.4.2.1). Returns the indexes that fired. */
export function eventControlFires(terms: EventTermEvaluation[]): { fires: boolean; firedBy: number[] } {
  const firedBy = terms.flatMap((t, i) => (termFires(t) ? [i] : []));
  return { fires: firedBy.length > 0, firedBy };
}

/** Plain-language description of a one-bit transition, naming its Table 9-2 cell. */
export function describeTransition(before: FourStateValue, after: FourStateValue): string {
  const from = lsbOf(before);
  const to = lsbOf(after);
  const edge = edgeOf(from, to);
  return edge
    ? `${from} → ${to} is a ${edge} (Table 9-2, from ${from} to ${to})`
    : `${from} → ${to} is no edge (Table 9-2, from ${from} to ${to})`;
}

/* ------------------------------------------------------------------------- */
/* A small parser for event expressions, used to pin the operator rules.      */
/* ------------------------------------------------------------------------- */

export interface ParsedEventTerm {
  kind: EventTermKind;
  /** The expression text (an identifier in this model). */
  expr: string;
  /** The `iff` guard text, if any. */
  iff?: string;
}

const KEYWORDS = new Set(["posedge", "negedge", "edge", "or", "iff"]);

/** Splits at top-level `or` keywords and commas (equivalent, §9.4.2.1), ignoring parenthesised text. */
function splitOrList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  const tokens = text.split(/(\(|\)|,|\bor\b)/);
  tokens.forEach((token) => {
    if (token === "(") depth += 1;
    if (token === ")") depth -= 1;
    if (depth === 0 && (token === "," || token === "or")) {
      parts.push(current.trim());
      current = "";
      return;
    }
    current += token;
  });
  parts.push(current.trim());
  if (parts.some((p) => p.length === 0)) throw new SyntaxError(`Empty event term in "${text}"`);
  return parts;
}

/**
 * Parses `posedge clk or negedge rst_n`, `a, b`, `a iff en or b`. The list is
 * split on `or`/`,` first, so `iff` stays with its own term: `a iff en or b`
 * is `(a iff en) or b` (§9.4.2.3).
 */
export function parseEventExpression(text: string): ParsedEventTerm[] {
  return splitOrList(text).map((term) => {
    const match = /^(?:(posedge|negedge|edge)\s+)?([A-Za-z_][\w.$[\]]*)(?:\s+iff\s+(.+))?$/.exec(term);
    if (!match || KEYWORDS.has(match[2])) throw new SyntaxError(`Unsupported event term "${term}"`);
    const [, edge, expr, iff] = match;
    return { kind: (edge as EdgeKind | undefined) ?? "change", expr, ...(iff ? { iff: iff.trim() } : {}) };
  });
}
