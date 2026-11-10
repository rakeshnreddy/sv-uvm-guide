export const MAX_ARRAY_DIMENSIONS = 3;
export const MAX_DIMENSION_SIZE = 64;
export const MAX_VISIBLE_INSTANCES = 8_192;

export interface ArrayDimensions {
  packed: number[];
  unpacked: number[];
}

export interface ArrayInstance {
  colorIndex: number;
  logicalIndex: number;
  position: [number, number, number];
}

export interface ArrayInstanceModel {
  dimensions: ArrayDimensions;
  instances: ArrayInstance[];
  logicalInstanceCount: number;
  truncated: boolean;
}

function validateDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_DIMENSION_SIZE, Math.trunc(value)));
}

function validateDimensionList(values: readonly number[]): number[] {
  const bounded = values.slice(0, MAX_ARRAY_DIMENSIONS).map(validateDimension);
  return bounded.length > 0 ? bounded : [1];
}

export function validateDimensions(dimensions: ArrayDimensions): ArrayDimensions {
  return {
    packed: validateDimensionList(dimensions.packed),
    unpacked: validateDimensionList(dimensions.unpacked),
  };
}

export function encodeArrayCoordinates(
  rawDimensions: ArrayDimensions,
  coordinates: { packed: readonly number[]; unpacked: readonly number[] },
): number | null {
  const dimensions = validateDimensions(rawDimensions);
  if (
    coordinates.packed.length !== dimensions.packed.length ||
    coordinates.unpacked.length !== dimensions.unpacked.length
  ) {
    return null;
  }

  const allDimensions = [...dimensions.unpacked, ...dimensions.packed];
  const allCoordinates = [...coordinates.unpacked, ...coordinates.packed];
  if (allCoordinates.some((coordinate, index) => (
    !Number.isInteger(coordinate) || coordinate < 0 || coordinate >= allDimensions[index]
  ))) {
    return null;
  }

  return allCoordinates.reduce(
    (logicalIndex, coordinate, index) => logicalIndex * allDimensions[index] + coordinate,
    0,
  );
}

function decodeIndex(index: number, dimensions: readonly number[]): number[] {
  const coordinates = Array(dimensions.length).fill(0) as number[];
  let remainder = index;
  for (let dimension = dimensions.length - 1; dimension >= 0; dimension -= 1) {
    coordinates[dimension] = remainder % dimensions[dimension];
    remainder = Math.floor(remainder / dimensions[dimension]);
  }
  return coordinates;
}

export function buildArrayInstances(
  rawDimensions: ArrayDimensions,
  instanceCap = MAX_VISIBLE_INSTANCES,
  requiredLogicalIndex: number | null = null,
): ArrayInstanceModel {
  const dimensions = validateDimensions(rawDimensions);
  const allDimensions = [...dimensions.unpacked, ...dimensions.packed];
  const logicalInstanceCount = allDimensions.reduce((total, value) => total * value, 1);
  const visibleCount = Math.min(logicalInstanceCount, Math.max(0, Math.trunc(instanceCap)));
  const logicalIndices = Array.from({ length: visibleCount }, (_, logicalIndex) => logicalIndex);
  if (
    visibleCount > 0 &&
    Number.isInteger(requiredLogicalIndex) &&
    requiredLogicalIndex !== null &&
    requiredLogicalIndex >= visibleCount &&
    requiredLogicalIndex < logicalInstanceCount
  ) {
    logicalIndices[visibleCount - 1] = requiredLogicalIndex;
  }
  const instances = logicalIndices.map((logicalIndex) => {
    const coordinates = decodeIndex(logicalIndex, allDimensions);
    const unpackedCoordinates = coordinates.slice(0, dimensions.unpacked.length);
    const packedCoordinates = coordinates.slice(dimensions.unpacked.length);
    const packedX = packedCoordinates.at(-1) ?? 0;
    const packedY = packedCoordinates.at(-2) ?? 0;
    const packedZ = packedCoordinates.at(-3) ?? 0;
    const groupX = (unpackedCoordinates.at(-1) ?? 0) * (dimensions.packed.at(-1)! + 2);
    const groupY = (unpackedCoordinates.at(-2) ?? 0) * ((dimensions.packed.at(-2) ?? 1) + 2);
    const groupZ = (unpackedCoordinates.at(-3) ?? 0) * ((dimensions.packed.at(-3) ?? 1) + 2);
    return {
      logicalIndex,
      colorIndex: unpackedCoordinates.reduce((sum, value, index) => sum + value * (index + 1), 0) % 8,
      position: [groupX + packedX, groupY + packedY, groupZ + packedZ] as [number, number, number],
    };
  });

  return {
    dimensions,
    instances,
    logicalInstanceCount,
    truncated: logicalInstanceCount > visibleCount,
  };
}

export function createQueueIdAllocator() {
  let current = 0;
  return { next: () => ++current };
}

// ===========================================================================
// Container semantics: dynamic arrays (IEEE 1800-2023 §7.5), queues (§7.10)
// and associative arrays (§7.8–§7.9). Pure and deterministic: every lab and
// visualizer renders the output of these functions and never invents state.
// ===========================================================================

export type SvElemTypeId = "int" | "logic8" | "byte" | "bit8";

export interface SvElemType {
  id: SvElemTypeId;
  /** Declaration text, e.g. `logic [7:0]`. */
  decl: string;
  width: number;
  signed: boolean;
  /** 4-state types default to 'x; 2-state types default to '0 (Table 6-7, Table 7-1). */
  fourState: boolean;
}

export const SV_ELEM_TYPES: Record<SvElemTypeId, SvElemType> = {
  int: { id: "int", decl: "int", width: 32, signed: true, fourState: false },
  logic8: { id: "logic8", decl: "logic [7:0]", width: 8, signed: false, fourState: true },
  byte: { id: "byte", decl: "byte", width: 8, signed: true, fourState: false },
  bit8: { id: "bit8", decl: "bit [7:0]", width: 8, signed: false, fourState: false },
};

/** One element value. `"X"` means every bit is x (the 4-state default `'x`). */
export type SvElem = number | "X";

/** Safety cap for lab inputs; it is not a SystemVerilog limit. */
export const LAB_MAX_ELEMENTS = 32;

/** Value of a new or nonexistent element: Table 7-1 (§7.4.5), which matches Table 6-7. */
export function defaultElementValue(type: SvElemTypeId): SvElem {
  return SV_ELEM_TYPES[type].fourState ? "X" : 0;
}

/** Two's-complement wrap of an integer to `width` bits with the given signedness. */
export function wrapToWidth(value: number | bigint, width: number, signed: boolean): number {
  const mod = BigInt(1) << BigInt(width);
  let v = (typeof value === "bigint" ? value : BigInt(Math.trunc(value))) % mod;
  if (v < BigInt(0)) v += mod;
  if (signed && v >= mod / BigInt(2)) v -= mod;
  return Number(v);
}

export function wrapToType(value: number, type: SvElemTypeId): number {
  const t = SV_ELEM_TYPES[type];
  return wrapToWidth(value, t.width, t.signed);
}

/** Compact value text for labels and code comments: X → `x`. */
export function formatElem(value: SvElem): string {
  return value === "X" ? "x" : String(value);
}

/** SystemVerilog literal for a value of the type, e.g. `8'hxx`. */
export function formatElemLiteral(value: SvElem, type: SvElemTypeId): string {
  if (value !== "X") return String(value);
  const t = SV_ELEM_TYPES[type];
  return t.width % 4 === 0 ? `${t.width}'h${"x".repeat(t.width / 4)}` : "'x";
}

export function formatElemList(values: readonly SvElem[]): string {
  return values.length === 0 ? "'{} (empty)" : `'{${values.map(formatElem).join(", ")}}`;
}

/**
 * - `warning`: the LRM says a warning *shall* be issued.
 * - `may-warn`: the LRM says the operation has no effect and *may* warn (tool-dependent).
 * - `error`: the code does not compile (or is a run-time error); nothing changes.
 */
export type DiagnosticLevel = "warning" | "may-warn" | "error";

export interface ArrayDiagnostic {
  level: DiagnosticLevel;
  text: string;
  clause: string;
}

export interface DynamicArrayState {
  kind: "dynamic";
  name: string;
  elemType: SvElemTypeId;
  values: SvElem[];
}

export interface QueueState {
  kind: "queue";
  name: string;
  elemType: SvElemTypeId;
  /** Declared right bound N of `[$:N]` (at most N+1 elements), or null for `[$]`. */
  bound: number | null;
  values: SvElem[];
}

export type AssocKeyType = "int" | "string";
export type AssocKey = number | string;

export interface AssocEntry {
  key: AssocKey;
  value: SvElem;
}

export interface AssocArrayState {
  kind: "assoc";
  name: string;
  elemType: SvElemTypeId;
  keyType: AssocKeyType;
  /** Always kept in index order (§7.8: the index type imposes an ordering). */
  entries: AssocEntry[];
  /** The `ref index` variable passed to first/next/last/prev. Starts at its type default. */
  iter: AssocKey;
  /** Lab metadata, not SV state: the order keys were first written, shown only to contrast with index order. */
  writeOrder: AssocKey[];
  /**
   * User-specified default from an `'{default: v}` literal (§7.9.11), or null/absent when none is declared.
   * It changes what a read of a missing key returns and the value an allocating read-modify-write starts
   * from (§7.8.7). It does not change any method: exists(), num(), first() and next() ignore it (§7.9.11).
   */
  declaredDefault?: SvElem | null;
}

export type ContainerState = DynamicArrayState | QueueState | AssocArrayState;

export type DynamicArrayOp =
  | { op: "new"; size: number }
  | { op: "new-copy"; size: number }
  | { op: "write"; index: number; value: number }
  | { op: "read"; index: number }
  | { op: "size" }
  | { op: "delete" }
  /** Not a dynamic-array method: modelled so the lab can show the compile error. */
  | { op: "push_back"; value: number };

/** A queue index or slice bound: an integer, or `"X"` for a 4-state expression with x/z bits. */
export type QueueIndexExpr = number | "X";

export type QueueOp =
  /** `s = q[from:to];` (§7.10.1). */
  | { op: "slice"; from: QueueIndexExpr; to: QueueIndexExpr }
  /** `q[index] = value;` (§7.10.1): update, append at $+1, or ignored with a warning. */
  | { op: "write"; index: QueueIndexExpr; value: number }
  | { op: "push_back"; value: number }
  | { op: "push_front"; value: number }
  | { op: "pop_front" }
  | { op: "pop_back" }
  | { op: "insert"; index: number; value: number }
  | { op: "delete-index"; index: number }
  | { op: "delete" }
  | { op: "read"; index: number }
  | { op: "size" };

/** Name of the 4-state index variable holding `'x` when an op uses `xIndex`. */
export const X_INDEX_NAME = "kx";
export const X_INDEX_DECL = "logic [31:0] kx = 'x;";

export type AssocRmwForm = "increment" | "add-assign";

export type AssocOp =
  /** `xIndex`: the index expression is 4-state with x bits (§7.8.4, §7.8.6); `key` is then ignored. */
  | { op: "write"; key: AssocKey; value: number; xIndex?: boolean }
  | { op: "read"; key: AssocKey; xIndex?: boolean }
  /** Read-modify-write: `aa[k]++` or `aa[k] += amount` (§7.8.7). */
  | { op: "rmw"; key: AssocKey; form: AssocRmwForm; amount?: number }
  /** `v = peek(aa[k]);` where `function automatic T peek(ref T r); return r; endfunction` (§7.8.7). */
  | { op: "ref-arg"; key: AssocKey }
  | { op: "exists"; key: AssocKey }
  | { op: "delete-key"; key: AssocKey }
  | { op: "delete" }
  | { op: "num" }
  | { op: "first" }
  | { op: "last" }
  | { op: "next" }
  | { op: "prev" }
  | { op: "foreach" };

export type ContainerOp = DynamicArrayOp | QueueOp | AssocOp;

export interface ArrayOpResult<S extends ContainerState = ContainerState> {
  before: S;
  after: S;
  /** The SystemVerilog statement for this operation. */
  code: string;
  /** Value produced by a call or read. */
  returned?: { label: string; value: SvElem | AssocKey };
  diagnostics: ArrayDiagnostic[];
  /** One sentence: why this outcome follows from the rule. */
  why: string;
  clause: string;
  /** Positions (dynamic array, queue) written by this operation, in `after`. */
  changedIndices: number[];
  /** Keys (associative array) written or selected by this operation. */
  changedKeys: AssocKey[];
  /** Elements thrown away by a bounded queue (§7.10.5). */
  discarded: SvElem[];
  /** Associative array `foreach`: keys in visit order. */
  visited?: AssocKey[];
  /** Queue value produced by a slice (§7.10.1). */
  returnedQueue?: SvElem[];
  /** Positions of `before` that a slice selected, or null when the slice is empty. */
  sliceRange?: { from: number; to: number } | null;
  /** Where the lab assumes something the cited clause does not state. */
  caveat?: string;
}

// ---- Shared helpers --------------------------------------------------------

const range = (n: number, start = 0) => Array.from({ length: Math.max(0, n) }, (_, i) => start + i);

export function declarationOf(state: ContainerState): string {
  const t = SV_ELEM_TYPES[state.elemType].decl;
  if (state.kind === "dynamic") return `${t} ${state.name}[];`;
  if (state.kind === "queue") return `${t} ${state.name}[$${state.bound === null ? "" : `:${state.bound}`}];`;
  return `${t} ${state.name}[${state.keyType}];`;
}

export function formatAssocKey(key: AssocKey): string {
  return typeof key === "string" ? `"${key}"` : String(key);
}

/** Maximum number of elements a queue may hold, or Infinity when unbounded. */
export function queueCapacity(state: Pick<QueueState, "bound">): number {
  return state.bound === null ? Number.POSITIVE_INFINITY : state.bound + 1;
}

/** Declaration plus an initializer that reproduces the current contents. */
export function declarationWithContents(state: ContainerState): string {
  const decl = declarationOf(state).replace(/;$/, "");
  if (state.kind === "assoc") {
    const hasDefault = state.declaredDefault !== undefined && state.declaredDefault !== null;
    if (state.entries.length === 0 && !hasDefault) return `${decl};`;
    const byWrite = state.writeOrder
      .map((k) => state.entries.find((e) => e.key === k))
      .filter((e): e is AssocEntry => Boolean(e));
    const items = byWrite.map((e) => `${formatAssocKey(e.key)}:${formatElemLiteral(e.value, state.elemType)}`);
    // §7.9.11: an associative array literal may carry a default index.
    if (hasDefault) items.push(`default:${formatElemLiteral(state.declaredDefault as SvElem, state.elemType)}`);
    return `${decl} = '{${items.join(", ")}};`;
  }
  if (state.values.length === 0) return `${decl};`;
  return `${decl} = '{${state.values.map((v) => formatElemLiteral(v, state.elemType)).join(", ")}};`;
}

function result<S extends ContainerState>(partial: Partial<ArrayOpResult<S>> & Pick<ArrayOpResult<S>, "before" | "after" | "code" | "why" | "clause">): ArrayOpResult<S> {
  return { diagnostics: [], changedIndices: [], changedKeys: [], discarded: [], ...partial };
}

// ---- Dynamic arrays (§7.5) ---------------------------------------------------

export function createDynamicArray(name: string, elemType: SvElemTypeId, values: SvElem[] = []): DynamicArrayState {
  return { kind: "dynamic", name, elemType, values: values.map((v) => (v === "X" ? v : wrapToType(v, elemType))) };
}

export function applyDynamicOp(state: DynamicArrayState, op: DynamicArrayOp): ArrayOpResult<DynamicArrayState> {
  const def = defaultElementValue(state.elemType);
  const defText = formatElemLiteral(def, state.elemType);
  const n = state.name;
  const size = state.values.length;
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < size;

  switch (op.op) {
    case "new":
    case "new-copy": {
      const copy = op.op === "new-copy";
      const code = `${n} = new[${op.size}]${copy ? `(${n})` : ""};`;
      if (!Number.isInteger(op.size) || op.size < 0) {
        return result({
          before: state,
          after: state,
          code,
          why: "The size operand of new[] must not be negative; the call is an error and the array is unchanged.",
          clause: "§7.5.1",
          diagnostics: [{ level: "error", text: "Negative size passed to new[]", clause: "§7.5.1" }],
        });
      }
      const target = Math.min(op.size, LAB_MAX_ELEMENTS);
      const values = copy
        ? range(target).map((i) => (i < size ? state.values[i] : def))
        : range(target).map(() => def);
      const after = { ...state, values };
      let why: string;
      if (!copy) {
        why = size > 0
          ? `new[${target}] without an initializer is destructive: the old ${size} element(s) are gone and every element starts at the default ${defText}.`
          : `new[${target}] creates ${target} element(s), each set to the default ${defText}.`;
      } else if (target > size) {
        why = `new[${target}](${n}) copies the ${size} old element(s) and pads the other ${target - size} with the default ${defText}.`;
      } else if (target < size) {
        why = `new[${target}](${n}) copies only the first ${target} element(s); the initializer is truncated and ${size - target} element(s) are lost.`;
      } else {
        why = `new[${target}](${n}) reallocates the same size and copies every element.`;
      }
      return result({
        before: state,
        after,
        code,
        why,
        clause: "§7.5.1",
        changedIndices: copy ? range(Math.max(0, target - size), size) : range(target),
      });
    }
    case "write": {
      const code = `${n}[${op.index}] = ${op.value};`;
      if (!valid(op.index)) {
        return result({
          before: state,
          after: state,
          code,
          why: `Index ${op.index} is outside 0..${size - 1}. Writing with an invalid index does nothing; a dynamic array never grows on a write.`,
          clause: "§7.4.5",
          diagnostics: [{ level: "may-warn", text: `Invalid index ${op.index}: write ignored`, clause: "§7.4.5" }],
        });
      }
      const values = [...state.values];
      values[op.index] = wrapToType(op.value, state.elemType);
      return result({
        before: state,
        after: { ...state, values },
        code,
        why: `Element ${op.index} is overwritten; size() stays ${size}.`,
        clause: "§7.4.5",
        changedIndices: [op.index],
      });
    }
    case "read": {
      const code = `v = ${n}[${op.index}];`;
      if (!valid(op.index)) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "v", value: def },
          why: `Index ${op.index} is invalid, so the read returns the Table 7-1 value for the element type (${defText}). Reads never resize the array.`,
          clause: "§7.4.5",
          diagnostics: [{ level: "may-warn", text: `Invalid index ${op.index}: read returns ${defText}`, clause: "§7.4.5" }],
        });
      }
      return result({
        before: state,
        after: state,
        code,
        returned: { label: "v", value: state.values[op.index] },
        why: `Element ${op.index} exists, so its value is returned.`,
        clause: "§7.4.5",
      });
    }
    case "size":
      return result({
        before: state,
        after: state,
        code: `n = ${n}.size();`,
        returned: { label: "n", value: size },
        why: "size() returns the number of elements; there is no separate capacity.",
        clause: "§7.5.2",
      });
    case "delete":
      return result({
        before: state,
        after: { ...state, values: [] },
        code: `${n}.delete();`,
        why: "delete() empties the array; size() becomes 0.",
        clause: "§7.5.3",
      });
    case "push_back":
      return result({
        before: state,
        after: state,
        code: `${n}.push_back(${op.value});`,
        why: `Dynamic arrays only have new[], size() and delete(). push_back() is a queue method, so this line does not compile. Use a queue, or grow explicitly with ${n} = new[${n}.size()+1](${n}).`,
        clause: "§7.5",
        diagnostics: [{ level: "error", text: "Compile error: push_back() is not a dynamic-array method", clause: "§7.5, §7.10.2" }],
      });
  }
}

// ---- Queues (§7.10) ------------------------------------------------------------

export function createQueue(name: string, elemType: SvElemTypeId, bound: number | null, values: SvElem[] = []): QueueState {
  const base = { kind: "queue" as const, name, elemType, bound, values: values.map((v) => (v === "X" ? v : wrapToType(v, elemType))) };
  return bound === null ? base : { ...base, values: base.values.slice(0, bound + 1) };
}

/**
 * How a queue treats elements that end up beyond its bound after a write.
 * Only `lrm` is SystemVerilog (§7.10.5); the others model common misconceptions
 * so a prediction can show where each wrong mental model diverges.
 */
export type QueueOverflowPolicy = "lrm" | "ignore-bound" | "drop-oldest" | "reject";

function boundWrite(
  state: QueueState,
  grown: SvElem[],
  policy: QueueOverflowPolicy,
): { values: SvElem[]; discarded: SvElem[]; rejected: boolean } {
  const cap = queueCapacity(state);
  if (grown.length <= cap || policy === "ignore-bound") return { values: grown, discarded: [], rejected: false };
  if (policy === "reject") return { values: state.values, discarded: [], rejected: true };
  if (policy === "drop-oldest") return { values: grown.slice(grown.length - cap), discarded: grown.slice(0, grown.length - cap), rejected: false };
  // §7.10.5: behave as if unbounded, then discard every element beyond the bound.
  return { values: grown.slice(0, cap), discarded: grown.slice(cap), rejected: false };
}

export function formatQueueIndex(index: QueueIndexExpr): string {
  return index === "X" ? X_INDEX_NAME : String(index);
}

export interface QueueSliceResult {
  values: SvElem[];
  /** Positions selected, or null for the empty queue. */
  range: { from: number; to: number } | null;
  /** The §7.10.1 rule that decided the result, as one sentence. */
  why: string;
}

/**
 * `Q[a:b]` by the §7.10.1 rules: x/z in a bound gives {}; a > b gives {}; Q[n:n] with n outside
 * 0..$ gives {}; a < 0 is treated as 0 and b > $ as $; otherwise b-a+1 items.
 */
export function queueSlice(values: readonly SvElem[], from: QueueIndexExpr, to: QueueIndexExpr): QueueSliceResult {
  const last = values.length - 1;
  const empty = (why: string): QueueSliceResult => ({ values: [], range: null, why });
  if (from === "X" || to === "X") return empty("A slice bound with x or z bits yields the empty queue {}.");
  if (from > to) return empty(`a = ${from} is greater than b = ${to}, so the slice is the empty queue {}.`);
  if (values.length === 0) {
    return empty(from === to
      ? `Q[n:n] with n outside 0..$ yields the empty queue {}; the queue is empty, so no n is in range.`
      : `The queue is empty, so no index is in range and Q[${from}:${to}] is the empty queue {}.`);
  }
  if (from === to && (from < 0 || from > last)) {
    return empty(`Q[n:n] with n = ${from} outside 0..$ (here 0..${last}) yields the empty queue {}.`);
  }
  const a = Math.max(0, from);
  const b = Math.min(last, to);
  const clamps = [
    from < 0 ? `a = ${from} < 0 is treated as 0` : "",
    to > last ? `b = ${to} > $ is treated as $ (${last})` : "",
  ].filter(Boolean);
  const prefix = clamps.length ? `${clamps.join(" and ")}, giving Q[${a}:${b}]. ` : "";
  if (a > b) return empty(`${prefix}Now a > b, so the slice is the empty queue {}.`);
  const count = b - a + 1;
  return {
    values: values.slice(a, b + 1),
    range: { from: a, to: b },
    why: `${prefix}Q[${a}:${b}] holds b-a+1 = ${count} item${count === 1 ? "" : "s"}.`,
  };
}

export function applyQueueOp(state: QueueState, op: QueueOp, policy: QueueOverflowPolicy = "lrm"): ArrayOpResult<QueueState> {
  const def = defaultElementValue(state.elemType);
  const defText = formatElemLiteral(def, state.elemType);
  const n = state.name;
  const size = state.values.length;

  /**
   * `done` describes a write that fits ("push_back(5) appended at index 3"); `legal` names the same
   * write as a clause that a "but ..." can follow ("push_back(5) is legal") for the bounded cases.
   */
  const write = (grown: SvElem[], insertedAt: number, code: string, done: string, legal: string): ArrayOpResult<QueueState> => {
    if (grown.length > LAB_MAX_ELEMENTS && state.bound === null) {
      return result({
        before: state,
        after: state,
        code,
        why: `The lab caps queues at ${LAB_MAX_ELEMENTS} elements to keep the picture readable. SystemVerilog itself would grow the queue.`,
        clause: "§7.10",
      });
    }
    const bounded = boundWrite(state, grown, policy);
    const after = { ...state, values: bounded.values };
    if (bounded.discarded.length > 0) {
      const lostNew = policy === "lrm" && insertedAt >= queueCapacity(state);
      return result({
        before: state,
        after,
        code,
        why: lostNew
          ? `${legal}, but as if the queue were unbounded the new element would sit at index ${insertedAt}, beyond the bound $:${state.bound}, so it is discarded and a warning is issued; size() stays ${bounded.values.length}.`
          : `${legal}, but it shifts the existing elements up; the old last element ${formatElemList(bounded.discarded)} now sits beyond the bound $:${state.bound} and is discarded with a warning.`,
        clause: "§7.10.5",
        discarded: bounded.discarded,
        changedIndices: insertedAt < bounded.values.length ? [insertedAt] : [],
        diagnostics: [
          {
            level: "warning",
            text: `Bound $:${state.bound} exceeded: discarded ${formatElemList(bounded.discarded)}`,
            clause: "§7.10.5",
          },
        ],
      });
    }
    if (bounded.rejected) {
      return result({ before: state, after, code, why: `${legal}, but in this wrong model it is refused because the queue is full.`, clause: "misconception" });
    }
    return result({
      before: state,
      after,
      code,
      why: `${done}; size() is now ${bounded.values.length}${state.bound === null ? " (an unbounded queue just grows)" : ""}.`,
      clause: "§7.10.2",
      changedIndices: [insertedAt],
    });
  };

  switch (op.op) {
    case "slice": {
      const s = queueSlice(state.values, op.from, op.to);
      return result({
        before: state,
        after: state,
        code: `s = ${n}[${formatQueueIndex(op.from)}:${formatQueueIndex(op.to)}];`,
        returnedQueue: s.values,
        sliceRange: s.range,
        why: s.why,
        clause: "§7.10.1",
      });
    }
    case "write": {
      const code = `${n}[${formatQueueIndex(op.index)}] = ${op.value};`;
      if (op.index === "X" || !Number.isInteger(op.index) || op.index < 0 || op.index > size) {
        const reason = op.index === "X"
          ? `${X_INDEX_NAME} has x bits, so it is an invalid index`
          : `Index ${op.index} lies outside 0..$+1 (here 0..${size})`;
        return result({
          before: state,
          after: state,
          code,
          why: `${reason}. The write is ignored and a run-time warning is issued; the queue does not grow or pad.`,
          clause: "§7.10.1",
          diagnostics: [{ level: "warning", text: `Write to ${n}[${formatQueueIndex(op.index)}] ignored`, clause: "§7.10.1" }],
        });
      }
      if (op.index === size) {
        const appended = write([...state.values, wrapToType(op.value, state.elemType)], size, code, `Writing to ${n}[$+1] (index ${size}) is legal and appends`, `Writing to ${n}[$+1] (index ${size}) is legal`);
        return appended.clause === "§7.10.2" ? { ...appended, clause: "§7.10.1" } : appended;
      }
      const values = [...state.values];
      values[op.index] = wrapToType(op.value, state.elemType);
      return result({
        before: state,
        after: { ...state, values },
        code,
        why: `Index ${op.index} is inside 0..$ (here 0..${size - 1}), so the element is updated in place; size() stays ${size}.`,
        clause: "§7.10.1",
        changedIndices: [op.index],
      });
    }
    case "push_back":
      return write([...state.values, wrapToType(op.value, state.elemType)], size, `${n}.push_back(${op.value});`, `push_back(${op.value}) appended at index ${size}`, `push_back(${op.value}) is legal`);
    case "push_front":
      return write([wrapToType(op.value, state.elemType), ...state.values], 0, `${n}.push_front(${op.value});`, `push_front(${op.value}) inserted at index 0`, `push_front(${op.value}) is legal`);
    case "insert": {
      const code = `${n}.insert(${op.index}, ${op.value});`;
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > size) {
        return result({
          before: state,
          after: state,
          code,
          why: `insert() accepts indices 0..size() (here 0..${size}). Index ${op.index} is out of range, so the call has no effect; it is not clamped.`,
          clause: "§7.10.2.2",
          diagnostics: [{ level: "may-warn", text: `insert(${op.index}) out of range: no effect`, clause: "§7.10.2.2" }],
        });
      }
      const grown = [...state.values];
      grown.splice(op.index, 0, wrapToType(op.value, state.elemType));
      return write(grown, op.index, code, `insert(${op.index}, ${op.value}) placed the item at index ${op.index}`, `insert(${op.index}, ${op.value}) is legal`);
    }
    case "pop_front":
    case "pop_back": {
      const front = op.op === "pop_front";
      const code = `v = ${n}.${op.op}();`;
      const clause = front ? "§7.10.2.4" : "§7.10.2.5";
      if (size === 0) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "v", value: def },
          why: `The queue is empty: ${op.op}() returns the nonexistent-entry value ${defText} (Table 7-1) and leaves the queue unchanged. It does not block.`,
          clause,
          diagnostics: [{ level: "may-warn", text: `${op.op}() on an empty queue returns ${defText}`, clause }],
        });
      }
      const value = front ? state.values[0] : state.values[size - 1];
      return result({
        before: state,
        after: { ...state, values: front ? state.values.slice(1) : state.values.slice(0, -1) },
        code,
        returned: { label: "v", value },
        why: `${op.op}() removes and returns the ${front ? "first" : "last"} element (${formatElem(value)}).`,
        clause,
      });
    }
    case "delete-index": {
      const code = `${n}.delete(${op.index});`;
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= size) {
        return result({
          before: state,
          after: state,
          code,
          why: `delete(index) accepts 0..size()-1 (here 0..${size - 1}). Index ${op.index} is out of range, so nothing is removed.`,
          clause: "§7.10.2.3",
          diagnostics: [{ level: "may-warn", text: `delete(${op.index}) out of range: no effect`, clause: "§7.10.2.3" }],
        });
      }
      const values = [...state.values];
      const [removed] = values.splice(op.index, 1);
      return result({
        before: state,
        after: { ...state, values },
        code,
        why: `delete(${op.index}) removes ${formatElem(removed)}; later elements move down one index.`,
        clause: "§7.10.2.3",
      });
    }
    case "delete":
      return result({ before: state, after: { ...state, values: [] }, code: `${n}.delete();`, why: "delete() with no index empties the queue.", clause: "§7.10.2.3" });
    case "read": {
      const code = `v = ${n}[${op.index}];`;
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= size) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "v", value: def },
          why: `Index ${op.index} is invalid, so the read returns ${defText} (Table 7-1).`,
          clause: "§7.4.5",
          diagnostics: [{ level: "may-warn", text: `Invalid index ${op.index}: read returns ${defText}`, clause: "§7.4.5" }],
        });
      }
      return result({ before: state, after: state, code, returned: { label: "v", value: state.values[op.index] }, why: `q[${op.index}] is the element at position ${op.index}, counted from the front.`, clause: "§7.10" });
    }
    case "size":
      return result({ before: state, after: state, code: `n = ${n}.size();`, returned: { label: "n", value: size }, why: "size() returns the number of items.", clause: "§7.10.2.1" });
  }
}

export interface QueueComparisonStep {
  op: QueueOp;
  unbounded: ArrayOpResult<QueueState>;
  bounded: ArrayOpResult<QueueState>;
  diverged: boolean;
}

export interface QueueComparison {
  steps: QueueComparisonStep[];
  /** Index of the first step whose contents differ, or -1. */
  firstDivergence: number;
  unboundedFinal: SvElem[];
  boundedFinal: SvElem[];
  warnings: number;
}

/** Runs the same program on `q[$]` and on `bq[$:bound]` (both starting with `initial`). */
export function runQueueComparison(
  initial: readonly SvElem[],
  bound: number,
  program: readonly QueueOp[],
  elemType: SvElemTypeId = "int",
  policy: QueueOverflowPolicy = "lrm",
): QueueComparison {
  let u = createQueue("q", elemType, null, [...initial]);
  let b = createQueue("bq", elemType, bound, [...initial]);
  const steps: QueueComparisonStep[] = [];
  let firstDivergence = -1;
  for (const op of program) {
    const ur = applyQueueOp(u, op);
    const br = applyQueueOp(b, op, policy);
    const diverged = formatElemList(ur.after.values) !== formatElemList(br.after.values);
    if (diverged && firstDivergence < 0) firstDivergence = steps.length;
    steps.push({ op, unbounded: ur, bounded: br, diverged });
    u = ur.after;
    b = br.after;
  }
  return {
    steps,
    firstDivergence,
    unboundedFinal: u.values,
    boundedFinal: b.values,
    warnings: steps.filter((s) => s.bounded.diagnostics.some((d) => d.level === "warning")).length,
  };
}

// ---- Associative arrays (§7.8, §7.9) -------------------------------------------

/** Index order: numeric for `int` (signed, §7.8.4); lexicographic by character code for `string` (§7.8.2). */
export function compareAssocKeys(a: AssocKey, b: AssocKey): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

export function assocKeyDefault(keyType: AssocKeyType): AssocKey {
  return keyType === "string" ? "" : 0;
}

export function createAssocArray(
  name: string,
  elemType: SvElemTypeId,
  keyType: AssocKeyType,
  writes: Array<[AssocKey, number]> = [],
  declaredDefault: SvElem | null = null,
): AssocArrayState {
  const dflt = declaredDefault === null || declaredDefault === "X" ? declaredDefault : wrapToType(declaredDefault, elemType);
  let state: AssocArrayState = { kind: "assoc", name, elemType, keyType, entries: [], iter: assocKeyDefault(keyType), writeOrder: [], declaredDefault: dflt };
  for (const [key, value] of writes) state = applyAssocOp(state, { op: "write", key, value }).after;
  return state;
}

/** Value a read of a missing key returns: the declared default (§7.9.11) or the Table 7-1 value (§7.8.6). */
export function assocMissingValue(state: AssocArrayState): SvElem {
  return state.declaredDefault ?? defaultElementValue(state.elemType);
}

export function hasDeclaredDefault(state: AssocArrayState): boolean {
  return state.declaredDefault !== undefined && state.declaredDefault !== null;
}

/** `value + delta` in the element type: any x operand gives x (§11.4.3); otherwise the sum wraps to the type. */
export function addToElem(value: SvElem, delta: number, type: SvElemTypeId): SvElem {
  return value === "X" ? "X" : wrapToType(value + delta, type);
}

function rmwDelta(op: { form: AssocRmwForm; amount?: number }): number {
  return op.form === "increment" ? 1 : op.amount ?? 2;
}

function upsertEntry(state: AssocArrayState, key: AssocKey, value: SvElem): AssocArrayState {
  const exists = state.entries.some((e) => e.key === key);
  const entries = exists
    ? state.entries.map((e) => (e.key === key ? { ...e, value } : e))
    : [...state.entries, { key, value }].sort((a, b) => compareAssocKeys(a.key, b.key));
  return { ...state, entries, writeOrder: exists ? state.writeOrder : [...state.writeOrder, key] };
}

export function applyAssocOp(state: AssocArrayState, op: AssocOp): ArrayOpResult<AssocArrayState> {
  const def = defaultElementValue(state.elemType);
  const defText = formatElemLiteral(def, state.elemType);
  const n = state.name;
  const keys = state.entries.map((e) => e.key);
  const has = (k: AssocKey) => state.entries.some((e) => e.key === k);
  const k = formatAssocKey;
  const declared = hasDeclaredDefault(state);
  const missingValue = assocMissingValue(state);
  const missingText = formatElemLiteral(missingValue, state.elemType);
  const methodNote = declared ? " The declared default does not change the methods (§7.9.11)." : "";

  switch (op.op) {
    case "write": {
      if (op.xIndex) {
        return result({
          before: state,
          after: state,
          code: `${n}[${X_INDEX_NAME}] = ${op.value};`,
          why: `${X_INDEX_NAME} has x bits, so it is an invalid index (§7.8.4). The write is ignored and a warning is issued; no entry is created.`,
          clause: "§7.8.6",
          diagnostics: [{ level: "warning", text: `Write with an x/z index ignored`, clause: "§7.8.6" }],
        });
      }
      const value = wrapToType(op.value, state.elemType);
      const exists = has(op.key);
      return result({
        before: state,
        after: upsertEntry(state, op.key, value),
        code: `${n}[${k(op.key)}] = ${op.value};`,
        why: exists
          ? `Key ${k(op.key)} already exists, so its value is replaced.`
          : `Writing a new key allocates its entry, which takes its place in index order, not at the end.`,
        clause: exists ? "§7.8" : "§7.8.7",
        changedKeys: [op.key],
      });
    }
    case "read": {
      if (op.xIndex) {
        return result({
          before: state,
          after: state,
          code: `v = ${n}[${X_INDEX_NAME}];`,
          returned: { label: "v", value: def },
          why: `${X_INDEX_NAME} has x bits, so it is an invalid index (§7.8.4). The read returns ${defText} (Table 7-1), issues a warning, and creates nothing.`,
          clause: "§7.8.6",
          diagnostics: [{ level: "warning", text: `Read with an x/z index returns ${defText}`, clause: "§7.8.6" }],
          caveat: declared
            ? "§7.8.6 says a user-specified default suppresses the warning, but it does not say whether that covers an x/z index as well as a missing key. The lab shows the Table 7-1 rule; check your simulator."
            : undefined,
        });
      }
      const code = `v = ${n}[${k(op.key)}];`;
      const entry = state.entries.find((e) => e.key === op.key);
      if (!entry && declared) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "v", value: missingValue },
          why: `There is no entry ${k(op.key)}. With a declared default, the read returns ${missingText} and no warning is issued. It still does not create the entry.`,
          clause: "§7.9.11, §7.8.6",
        });
      }
      if (!entry) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "v", value: def },
          why: `There is no entry ${k(op.key)}. A read returns ${defText} (Table 7-1), issues a warning, and does not create the entry; only a write allocates.`,
          clause: "§7.8.6",
          diagnostics: [{ level: "warning", text: `Read of nonexistent key ${k(op.key)} returns ${defText}`, clause: "§7.8.6" }],
        });
      }
      return result({ before: state, after: state, code, returned: { label: "v", value: entry.value }, why: `Key ${k(op.key)} exists.`, clause: "§7.8", changedKeys: [op.key] });
    }
    case "rmw": {
      const delta = rmwDelta(op);
      const code = op.form === "increment" ? `${n}[${k(op.key)}]++;` : `${n}[${k(op.key)}] += ${delta};`;
      const entry = state.entries.find((e) => e.key === op.key);
      const start = entry ? entry.value : missingValue;
      const next = addToElem(start, delta, state.elemType);
      const xNote = next === "X" ? ` Arithmetic with an x operand gives x (§11.4.3), so the entry holds ${formatElemLiteral("X", state.elemType)}.` : "";
      const after = upsertEntry(state, op.key, next);
      if (!entry) {
        return result({
          before: state,
          after,
          code,
          why: `${n}[${k(op.key)}] did not exist. A read-modify-write allocates it first with its ${declared ? "user-specified default" : "default value"} ${formatElemLiteral(start, state.elemType)}, before any reference, then writes ${formatElemLiteral(next, state.elemType)}. num() becomes ${after.entries.length}.${xNote}`,
          clause: next === "X" ? "§7.8.7, §11.4.3" : "§7.8.7",
          changedKeys: [op.key],
        });
      }
      return result({
        before: state,
        after,
        code,
        why: `Key ${k(op.key)} exists, so the statement reads ${formatElemLiteral(start, state.elemType)} and writes ${formatElemLiteral(next, state.elemType)}.${xNote}`,
        clause: next === "X" ? "§7.8, §11.4.3" : "§7.8",
        changedKeys: [op.key],
      });
    }
    case "ref-arg": {
      const code = `v = peek(${n}[${k(op.key)}]);`;
      const entry = state.entries.find((e) => e.key === op.key);
      if (entry) {
        return result({ before: state, after: state, code, returned: { label: "v", value: entry.value }, why: `Key ${k(op.key)} exists, so peek() reads it through the reference.`, clause: "§7.8, §13.5.2", changedKeys: [op.key] });
      }
      const after = upsertEntry(state, op.key, missingValue);
      return result({
        before: state,
        after,
        code,
        returned: { label: "v", value: missingValue },
        why: `Passing ${n}[${k(op.key)}] as the actual of a ref argument allocates the entry (§7.8.7), so peek() reads an entry that exists: v = ${missingText}. num() becomes ${after.entries.length}.`,
        clause: "§7.8.7",
        changedKeys: [op.key],
        caveat: `§7.8.7 gives the initial value (${declared ? "the user-specified default" : "the default value"}) for read-modify-write constructs; for a ref actual it says only that the entry is allocated. The lab assumes the same initial value.`,
      });
    }
    case "exists":
      return result({
        before: state,
        after: state,
        code: `found = ${n}.exists(${k(op.key)});`,
        returned: { label: "found", value: has(op.key) ? 1 : 0 },
        why: has(op.key)
          ? `exists() returns 1: the key is present.${methodNote}`
          : declared
            ? `exists() returns 0: the key was never written, and a declared default does not make it exist (§7.9.11).`
            : `exists() returns 0 and, unlike a read, raises no warning. Check before you read.`,
        clause: "§7.9.3",
      });
    case "delete-key": {
      const present = has(op.key);
      return result({
        before: state,
        after: present
          ? { ...state, entries: state.entries.filter((e) => e.key !== op.key), writeOrder: state.writeOrder.filter((w) => w !== op.key) }
          : state,
        code: `${n}.delete(${k(op.key)});`,
        why: present ? `The entry ${k(op.key)} is removed.` : `There is no entry ${k(op.key)}; delete(index) silently does nothing (no warning).`,
        clause: "§7.9.2",
      });
    }
    case "delete":
      return result({ before: state, after: { ...state, entries: [], writeOrder: [] }, code: `${n}.delete();`, why: "delete() with no index removes every entry.", clause: "§7.9.2" });
    case "num":
      return result({
        before: state,
        after: state,
        code: `n = ${n}.num();`,
        returned: { label: "n", value: keys.length },
        why: `num() (and size()) return the number of entries.${methodNote}`,
        clause: "§7.9.1",
      });
    case "first":
    case "last": {
      const code = `found = ${n}.${op.op}(key);`;
      const clause = op.op === "first" ? "§7.9.4" : "§7.9.5";
      if (keys.length === 0) {
        return result({ before: state, after: state, code, returned: { label: "found", value: 0 }, why: `The array is empty: ${op.op}() returns 0 and leaves key unchanged.`, clause });
      }
      const target = op.op === "first" ? keys[0] : keys[keys.length - 1];
      return result({
        before: state,
        after: { ...state, iter: target },
        code,
        returned: { label: "found", value: 1 },
        why: `${op.op}() sets key to the ${op.op === "first" ? "smallest" : "largest"} index, ${k(target)}, regardless of the order keys were written.`,
        clause,
        changedKeys: [target],
      });
    }
    case "next":
    case "prev": {
      const code = `found = ${n}.${op.op}(key);`;
      const clause = op.op === "next" ? "§7.9.6" : "§7.9.7";
      const candidates = op.op === "next"
        ? keys.filter((key) => compareAssocKeys(key, state.iter) > 0)
        : keys.filter((key) => compareAssocKeys(key, state.iter) < 0);
      if (candidates.length === 0) {
        return result({
          before: state,
          after: state,
          code,
          returned: { label: "found", value: 0 },
          why: `No index is ${op.op === "next" ? "greater" : "smaller"} than ${k(state.iter)}: ${op.op}() returns 0 and key stays ${k(state.iter)}. It does not wrap around.`,
          clause,
        });
      }
      const target = op.op === "next" ? candidates[0] : candidates[candidates.length - 1];
      return result({
        before: state,
        after: { ...state, iter: target },
        code,
        returned: { label: "found", value: 1 },
        why: `${op.op}() moves key to the ${op.op === "next" ? "smallest index greater" : "largest index smaller"} than ${k(state.iter)}: ${k(target)}.`,
        clause,
        changedKeys: [target],
      });
    }
    case "foreach":
      return result({
        before: state,
        after: state,
        code: `foreach (${n}[key]) $display(key);`,
        why: `foreach visits keys in index order (${state.keyType === "string" ? "lexicographic, uppercase before lowercase" : "signed numeric"}), not in the order they were written.`,
        clause: state.keyType === "string" ? "§7.8.2, §12.7.3" : "§7.8.4, §12.7.3",
        visited: keys,
      });
  }
}

// ---- Generic dispatch -----------------------------------------------------------

export function applyContainerOp(state: ContainerState, op: ContainerOp): ArrayOpResult {
  if (state.kind === "dynamic") return applyDynamicOp(state, op as DynamicArrayOp);
  if (state.kind === "queue") return applyQueueOp(state, op as QueueOp);
  return applyAssocOp(state, op as AssocOp);
}

// ---- Predictions ------------------------------------------------------------------

export interface PredictionChoice {
  id: string;
  label: string;
  correct: boolean;
  /** Diagnoses the misconception behind this choice. */
  feedback: string;
}

export interface ContainerPrediction {
  question: string;
  options: PredictionChoice[];
}

function dedupeChoices(choices: PredictionChoice[]): PredictionChoice[] {
  const seen = new Map<string, PredictionChoice>();
  for (const c of choices) {
    const prev = seen.get(c.label);
    if (!prev) seen.set(c.label, c);
    else if (c.correct && !prev.correct) seen.set(c.label, c);
  }
  return Array.from(seen.values());
}

/**
 * Prediction prompt for operations whose outcome a learner can reason about
 * and commonly gets wrong. Returns null for routine operations.
 * The correct option is always derived from the model result.
 */
export function predictContainerOp(state: ContainerState, op: ContainerOp): ContainerPrediction | null {
  if (state.kind === "dynamic") return predictDynamic(state, op as DynamicArrayOp);
  if (state.kind === "queue") return predictQueue(state, op as QueueOp);
  return predictAssoc(state, op as AssocOp);
}

function predictDynamic(state: DynamicArrayState, op: DynamicArrayOp): ContainerPrediction | null {
  const res = applyDynamicOp(state, op);
  const def = defaultElementValue(state.elemType);
  const fourState = SV_ELEM_TYPES[state.elemType].fourState;
  const wrongDefault: SvElem = fourState ? 0 : "X";
  const size = state.values.length;
  const n = state.name;
  const typeText = SV_ELEM_TYPES[state.elemType].decl;

  if (op.op === "new" && size > 0 && op.size > 0) {
    const shown = Math.min(op.size, size);
    const slice = (vals: SvElem[]) => formatElemList(vals.slice(0, shown));
    return {
      question: `${n} holds ${formatElemList(state.values)}. After \`${res.code}\`, what is in ${n}[0..${shown - 1}]?`,
      options: dedupeChoices([
        { id: "default", label: slice(res.after.values), correct: true, feedback: `new[N] without (${n}) is destructive: every element restarts at the ${typeText} default ${formatElemLiteral(def, state.elemType)} (§7.5.1).` },
        { id: "kept", label: slice(state.values), correct: false, feedback: `Keeping the old values needs the initializer form: ${n} = new[${op.size}](${n}). Plain new[N] copies nothing (§7.5.1).` },
        {
          id: "other-default",
          label: formatElemList(range(shown).map(() => wrongDefault)),
          correct: false,
          feedback: fourState
            ? `0 is the default for 2-state types such as int. ${typeText} is 4-state, so new elements are x (Table 7-1).`
            : `int is 2-state and cannot hold x. Its default is 0 (Table 7-1).`,
        },
      ]),
    };
  }
  if (op.op === "new-copy" && op.size > size && size > 0) {
    const padded = formatElemList(res.after.values.slice(size));
    return {
      question: `${n} holds ${formatElemList(state.values)}. After \`${res.code}\`, what is in the new slots ${n}[${size}..${op.size - 1}]?`,
      options: dedupeChoices([
        { id: "pad-default", label: padded, correct: true, feedback: `The old elements are copied and the rest is padded with the type default (§7.5.1).` },
        {
          id: "pad-other",
          label: formatElemList(range(op.size - size).map(() => wrongDefault)),
          correct: false,
          feedback: fourState ? `${typeText} is 4-state, so padding is x, not 0. The LRM example pads an int array with 0 because int is 2-state.` : `int is 2-state: padding is 0, never x.`,
        },
        { id: "capacity", label: `Nothing yet: size() is still ${size} until you write them`, correct: false, feedback: `Dynamic arrays have no hidden capacity. After new[${op.size}](${n}), size() is exactly ${op.size} and every slot exists.` },
      ]),
    };
  }
  if (op.op === "new-copy" && op.size < size) {
    return {
      question: `${n} holds ${formatElemList(state.values)}. What does \`${res.code}\` leave?`,
      options: [
        { id: "truncate", label: formatElemList(res.after.values), correct: true, feedback: `The initializer is truncated to the new size; the tail is lost (§7.5.1).` },
        { id: "keep", label: `${formatElemList(state.values)} (size stays ${size})`, correct: false, feedback: `new[N] sets the size to exactly N. Nothing beyond index ${op.size - 1} survives.` },
        { id: "error", label: "A run-time error: the source is larger than N", correct: false, feedback: `A larger initializer is legal; it is simply truncated (§7.5.1).` },
      ],
    };
  }
  if (op.op === "read" && (op.index < 0 || op.index >= size)) {
    return {
      question: `${n}.size() is ${size}. What does \`${res.code}\` give?`,
      options: [
        { id: "default", label: `v = ${formatElemLiteral(def, state.elemType)}; the array is unchanged (a warning is allowed)`, correct: true, feedback: `An invalid index reads the Table 7-1 value for the element type (§7.4.5).` },
        { id: "fatal", label: "Simulation stops with an out-of-bounds fatal error", correct: false, feedback: `SystemVerilog does not stop on a bad unpacked-array index; it returns the default value and may warn (§7.4.5). That is why such bugs hide.` },
        { id: "grow", label: `The array grows to ${op.index + 1} elements`, correct: false, feedback: `Reads never resize a dynamic array. Only new[] and assignment change its size (§7.5).` },
      ],
    };
  }
  if (op.op === "write" && (op.index < 0 || op.index >= size)) {
    return {
      question: `${n}.size() is ${size}. What does \`${res.code}\` do?`,
      options: [
        { id: "ignored", label: "Nothing: the write is ignored (a warning is allowed)", correct: true, feedback: `Writing with an invalid index performs no operation (§7.4.5).` },
        { id: "grow", label: `The array grows to ${op.index + 1} elements`, correct: false, feedback: `Dynamic arrays never grow on a write. Resize first: ${n} = new[${op.index + 1}](${n}).` },
        { id: "last", label: "It overwrites the last element", correct: false, feedback: `There is no clamping: an out-of-range index makes the write a no-op (§7.4.5).` },
      ],
    };
  }
  if (op.op === "push_back") {
    return {
      question: `Does \`${res.code}\` work on the dynamic array ${n}?`,
      options: [
        { id: "error", label: "No: it does not compile", correct: true, feedback: `push_back() belongs to queues (§7.10.2). A dynamic array only has new[], size() and delete() (§7.5).` },
        { id: "append", label: "Yes: it appends one element", correct: false, feedback: `That is queue behaviour. If you need to append, declare ${n} as a queue: ${typeText} ${n}[$].` },
        { id: "realloc", label: "Yes, but it reallocates and copies the whole array", correct: false, feedback: `There is no such method to reallocate. You would write ${n} = new[${n}.size()+1](${n}) yourself, which is why queues suit unknown counts.` },
      ],
    };
  }
  return null;
}

function predictQueue(state: QueueState, op: QueueOp): ContainerPrediction | null {
  const size = state.values.length;
  const cap = queueCapacity(state);
  const res = applyQueueOp(state, op);
  const def = defaultElementValue(state.elemType);
  const n = state.name;
  const isWrite = op.op === "push_back" || op.op === "push_front" || (op.op === "insert" && op.index >= 0 && op.index <= size);

  if (op.op === "slice") {
    return {
      question: `${n} holds ${formatElemList(state.values)}. What does \`${res.code}\` put in s?`,
      options: queueSliceChoices(state.values, op.from, op.to),
    };
  }
  if (op.op === "write") {
    return {
      question: state.bound === null
        ? `${n} holds ${formatElemList(state.values)} (size() = ${size}). What does \`${res.code}\` do?`
        : `${n} is declared \`${declarationOf(state)}\` and holds ${formatElemList(state.values)} (size() = ${size}). What does \`${res.code}\` do?`,
      options: queueWriteChoices(state, op),
    };
  }

  if (isWrite && size >= cap) {
    return {
      question: `${n} is declared \`${declarationOf(state)}\` and holds ${formatElemList(state.values)} (full). What does it hold after \`${res.code}\`?`,
      options: queueOverflowChoices(state, [op]),
    };
  }
  if ((op.op === "pop_front" || op.op === "pop_back") && size === 0) {
    return {
      question: `${n} is empty. What does \`${res.code}\` do?`,
      options: [
        { id: "default", label: `Returns ${formatElemLiteral(def, state.elemType)} and leaves ${n} empty (a warning is allowed)`, correct: true, feedback: `Popping an empty queue returns the nonexistent-entry value from Table 7-1 and has no effect (§7.10.2.4, §7.10.2.5).` },
        { id: "block", label: "Blocks until another process pushes an item", correct: false, feedback: `Queues never block. Blocking get() belongs to mailboxes. Guard pops with size() > 0 or wait (q.size() > 0).` },
        { id: "fatal", label: "Stops the simulation with a fatal error", correct: false, feedback: `The LRM defines the result: the default value, no change, and an optional warning. Silent defaults are why you check size() first.` },
      ],
    };
  }
  if ((op.op === "insert" && (op.index < 0 || op.index > size)) || (op.op === "delete-index" && (op.index < 0 || op.index >= size))) {
    const isInsert = op.op === "insert";
    return {
      question: `${n} holds ${size} item(s). What does \`${res.code}\` do?`,
      options: [
        { id: "none", label: "Nothing: the queue is unchanged (a warning is allowed)", correct: true, feedback: `An out-of-range index makes ${isInsert ? "insert()" : "delete()"} a no-op (${isInsert ? "§7.10.2.2" : "§7.10.2.3"}).` },
        {
          id: "clamp",
          label: isInsert ? "It appends the item at the end (index clamped)" : "It deletes the last item (index clamped)",
          correct: false,
          feedback: `SystemVerilog does not clamp queue indices. A clamped result would hide the bug that produced the bad index.`,
        },
        isInsert
          ? { id: "pad", label: `It pads with defaults up to index ${op.index}`, correct: false, feedback: `Queues have no sparse slots. Only index 0..size() is legal for insert().` }
          : { id: "fatal", label: "Simulation stops with an index error", correct: false, feedback: `The LRM makes it a no-op that may warn, not a fatal error.` },
      ],
    };
  }
  return null;
}

/** Choices for "what does the bounded queue hold after these writes", one per mental model. */
export function queueOverflowChoices(state: QueueState, program: readonly QueueOp[]): PredictionChoice[] {
  const policyFeedback: Record<QueueOverflowPolicy, string> = {
    lrm: "Each write behaves as if the queue were unbounded; whatever ends up beyond index N is discarded with a warning (§7.10.5). push_back loses the new item; push_front and a middle insert lose the old last item.",
    "ignore-bound": "The bound is not a hint: a [$:N] queue never keeps an element above index N (§7.10.5).",
    "drop-oldest": "That is a ring buffer. SystemVerilog discards whatever lands beyond the bound, the tail end, never the head (§7.10.5).",
    reject: "Writes are not blocked or refused: the operation runs, then out-of-bound elements are discarded. For push_front that throws away the old last element, not the new one (§7.10.5).",
  };
  const run = (policy: QueueOverflowPolicy) => {
    let s = state;
    for (const op of program) s = applyQueueOp(s, op, policy).after;
    return formatElemList(s.values);
  };
  const policies: QueueOverflowPolicy[] = ["lrm", "ignore-bound", "drop-oldest", "reject"];
  const groups = new Map<string, QueueOverflowPolicy[]>();
  for (const p of policies) {
    const label = run(p);
    groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  return Array.from(groups.entries()).map(([label, ps]) => {
    const correct = ps.includes("lrm");
    // A wrong answer can match several mental models (a ring buffer and a refused push both keep the old contents).
    let feedback = correct ? policyFeedback.lrm : ps.map((p) => policyFeedback[p]).join(" ");
    if (correct && ps.includes("reject")) {
      feedback += " A 'blocked push' guess gives the same contents here, but the mechanism differs: the item is written, then discarded with a mandatory warning.";
    }
    return { id: correct ? "lrm" : ps[0], label, correct, feedback };
  });
}

function predictAssoc(state: AssocArrayState, op: AssocOp): ContainerPrediction | null {
  const res = applyAssocOp(state, op);
  const n = state.name;
  const def = defaultElementValue(state.elemType);
  const keys = state.entries.map((e) => e.key);
  const fmtKeys = (ks: readonly AssocKey[]) => ks.map(formatAssocKey).join(", ");
  const outOfOrder = fmtKeys(state.writeOrder) !== fmtKeys(keys);

  if (op.op === "rmw" || op.op === "ref-arg" || (op.op === "read" && (op.xIndex || hasDeclaredDefault(state)) && !state.entries.some((e) => e.key === op.key))) {
    const q = accessSemanticsQuestions(state, op);
    const value = q.find((x) => x.aspect === "value");
    const num = q.find((x) => x.aspect === "num");
    if (op.op === "read" && value) return { question: value.question, options: value.options };
    return num ? { question: num.question, options: num.options } : null;
  }
  if (op.op === "read" && !state.entries.some((e) => e.key === op.key)) {
    return {
      question: `${n} has no key ${formatAssocKey(op.key)}. What does \`${res.code}\` do?`,
      options: [
        { id: "default-warn", label: `v = ${formatElemLiteral(def, state.elemType)}, a warning is issued, and no entry is created`, correct: true, feedback: `Reading a nonexistent entry returns the Table 7-1 value with a warning (§7.8.6). Entries are allocated only by writes (§7.8.7).` },
        { id: "allocate", label: `Creates ${n}[${formatAssocKey(op.key)}] with value ${formatElemLiteral(def, state.elemType)}`, correct: false, feedback: `That is C++ std::map::operator[]. In SystemVerilog a read never allocates; num() is unchanged.` },
        { id: "fatal", label: "Stops the simulation with a fatal error", correct: false, feedback: `It is a warning, not a fatal. Use exists() first to avoid both the warning and the silent default.` },
      ],
    };
  }
  if ((op.op === "first" || op.op === "foreach") && keys.length > 1 && outOfOrder) {
    const sorted = op.op === "first" ? formatAssocKey(keys[0]) : fmtKeys(keys);
    const written = op.op === "first" ? formatAssocKey(state.writeOrder[0]) : fmtKeys(state.writeOrder);
    const choices: PredictionChoice[] = [
      { id: "index-order", label: sorted, correct: true, feedback: `The index type imposes the order: ${state.keyType === "string" ? "strings compare lexicographically by character code, so uppercase sorts before lowercase (§7.8.2)" : "int keys are visited in signed numeric order (§7.8.4)"}.` },
      { id: "write-order", label: written, correct: false, feedback: `Associative arrays do not remember insertion order. They iterate in index order (§7.8).` },
    ];
    if (state.keyType === "string") {
      const ci = [...keys].sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
      const ciLabel = op.op === "first" ? formatAssocKey(ci[0]) : fmtKeys(ci);
      choices.push({ id: "dictionary", label: ciLabel, correct: false, feedback: `That is dictionary (case-insensitive) order. SystemVerilog compares character codes, and "A".."Z" (65–90) come before "a".."z" (97–122).` });
    }
    choices.push({ id: "unspecified", label: "Unspecified: it depends on the simulator's hash", correct: false, feedback: `For integral and string indices the order is defined (§7.8.2, §7.8.4). The LRM does not require hashing at all.` });
    return {
      question: op.op === "first"
        ? `Keys were written in the order ${fmtKeys(state.writeOrder)}. Which key does \`${res.code}\` put in key?`
        : `Keys were written in the order ${fmtKeys(state.writeOrder)}. In what order does \`${res.code}\` visit them?`,
      options: dedupeChoices(choices),
    };
  }
  if (op.op === "next" && keys.length > 0 && compareAssocKeys(state.iter, keys[keys.length - 1]) >= 0) {
    return {
      question: `key is ${formatAssocKey(state.iter)}, the last index. What does \`${res.code}\` do?`,
      options: [
        { id: "zero", label: `Returns 0; key stays ${formatAssocKey(state.iter)}`, correct: true, feedback: `next() returns 0 and leaves the index unchanged when there is no larger key (§7.9.6). That is how do…while (map.next(key)) loops end.` },
        { id: "wrap", label: `Wraps around: key becomes ${formatAssocKey(keys[0])}`, correct: false, feedback: `Enum next() wraps; associative-array next() does not.` },
        { id: "clear", label: `Returns 0 and resets key to ${formatAssocKey(assocKeyDefault(state.keyType))}`, correct: false, feedback: `The ref argument is untouched when next() fails (§7.9.6).` },
      ],
    };
  }
  return null;
}

// ---- Slice and indexed-write predictions (§7.10.1) ---------------------------------

/** Wrong mental models of `Q[a:b]`, each run as a model so its answer is computed, not typed. */
const SLICE_MISREADINGS: Array<{ id: string; run: (v: readonly SvElem[], a: number, b: number) => SvElem[] | null; feedback: string }> = [
  {
    id: "exclusive",
    run: (v, a, b) => (a > b ? [] : v.slice(Math.max(0, a), Math.max(0, Math.min(v.length, b)))),
    feedback: "That treats b as exclusive, as Python and C++ ranges do. Q[a:b] includes both ends: it holds b-a+1 items (§7.10.1).",
  },
  {
    id: "no-clamp",
    run: (v, a, b) => (a < 0 || b > v.length - 1 ? [] : null),
    feedback: "Out-of-range bounds are not rejected: a < 0 is treated as 0 and b > $ as $ (§7.10.1).",
  },
  {
    id: "from-end",
    run: (v, a, b) => (a < 0 ? (() => { const s = v.length + a; return s > b ? [] : v.slice(s, Math.min(v.length - 1, b) + 1); })() : null),
    feedback: "Negative indices do not count from the end in SystemVerilog. A negative a is treated as 0 (§7.10.1).",
  },
  {
    id: "reverse",
    run: (v, a, b) => (a > b && b >= 0 && a <= v.length - 1 ? v.slice(b, a + 1).reverse() : null),
    feedback: "A descending slice is not reversed: if a > b, Q[a:b] is the empty queue {} (§7.10.1).",
  },
];

/** Choices for `s = q[a:b]`; the correct label comes from queueSlice(). */
export function queueSliceChoices(values: readonly SvElem[], from: QueueIndexExpr, to: QueueIndexExpr): PredictionChoice[] {
  const correct = queueSlice(values, from, to);
  const choices: PredictionChoice[] = [{ id: "lrm", label: formatElemList(correct.values), correct: true, feedback: `${correct.why} (§7.10.1)` }];
  if (from !== "X" && to !== "X") {
    for (const m of SLICE_MISREADINGS) {
      const out = m.run(values, from, to);
      if (out) choices.push({ id: m.id, label: formatElemList(out), correct: false, feedback: m.feedback });
    }
  } else {
    // Two readings of an x bound. Reading x as 0 can give {} too (q[1:kx] -> Q[1:0]); reading it as $
    // still gives a distinct wrong answer then. mergeChoices drops any reading that matches the answer.
    const last = values.length - 1;
    const xReadings: Array<{ id: string; as: number; feedback: string }> = [
      { id: "x-as-zero", as: 0, feedback: "An x bound is not read as 0. A bound with x or z bits makes the whole slice the empty queue {} (§7.10.1)." },
      { id: "x-as-last", as: last, feedback: "An x bound is not read as $ (or as any other value). A bound with x or z bits makes the whole slice the empty queue {} (§7.10.1)." },
    ];
    for (const r of xReadings) {
      choices.push({ id: r.id, label: formatElemList(queueSlice(values, from === "X" ? r.as : from, to === "X" ? r.as : to).values), correct: false, feedback: r.feedback });
    }
  }
  const outOfRange = from === "X" || to === "X" || from < 0 || to > values.length - 1;
  if (outOfRange) {
    choices.push({ id: "error", label: "A run-time error: index out of range", correct: false, feedback: "Slicing never stops the simulation: §7.10.1 defines a result for every bound, including x, negative and past $." });
  }
  return mergeChoices(choices);
}

/**
 * Merge choices with the same label (the correct one wins, wrong feedback is joined), then order them
 * by label so the correct answer's position gives nothing away.
 */
function mergeChoices(choices: PredictionChoice[]): PredictionChoice[] {
  return mergeChoicesInOrder(choices).sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

function mergeChoicesInOrder(choices: PredictionChoice[]): PredictionChoice[] {
  const byLabel = new Map<string, PredictionChoice>();
  for (const c of choices) {
    const prev = byLabel.get(c.label);
    if (!prev) byLabel.set(c.label, c);
    else if (c.correct) byLabel.set(c.label, c);
    else if (!prev.correct && !prev.feedback.includes(c.feedback)) byLabel.set(c.label, { ...prev, feedback: `${prev.feedback} ${c.feedback}` });
  }
  return Array.from(byLabel.values());
}

export type QueueWriteOutcome = "update" | "append" | "ignored" | "discarded";

/**
 * What `q[i] = v` does (§7.10.1). On a full bounded queue q[$+1] is still legal, but the element it
 * adds lies beyond the bound, so it is discarded with a warning and size() is unchanged (§7.10.5).
 */
export function queueWriteOutcome(state: QueueState, index: QueueIndexExpr): QueueWriteOutcome {
  if (index === "X" || !Number.isInteger(index) || index < 0 || index > state.values.length) return "ignored";
  if (index < state.values.length) return "update";
  return state.values.length >= queueCapacity(state) ? "discarded" : "append";
}

/** Choices for `q[i] = v`: update, append at $+1, ignored with a warning, or the "pads" misconception. */
export function queueWriteChoices(state: QueueState, op: Extract<QueueOp, { op: "write" }>): PredictionChoice[] {
  const outcome = queueWriteOutcome(state, op.index);
  const res = applyQueueOp(state, op);
  const size = state.values.length;
  const n = state.name;
  const i = formatQueueIndex(op.index);
  const choices: PredictionChoice[] = [
    {
      id: "update",
      label: `Updates ${n}[${i}] in place; size() stays ${size}`,
      correct: outcome === "update",
      feedback: outcome === "update" ? res.why : `Only indices 0..$ (here 0..${size - 1}) name existing items (§7.10.1).`,
    },
    {
      id: "append",
      label: `Appends; size() becomes ${size + 1}`,
      correct: outcome === "append",
      feedback: outcome === "append"
        ? res.why
        : outcome === "discarded"
          ? `${n}[$+1] is legal, but ${n} is full: as if unbounded, the new element would sit at index ${size}, beyond the bound $:${state.bound}, so it is discarded with a warning and size() stays ${size} (§7.10.5).`
          : `Only ${n}[$+1], index ${size} here, appends (§7.10.1).`,
    },
    {
      id: "ignored",
      label: "Ignored, with a required warning",
      correct: outcome === "ignored",
      feedback: outcome === "ignored"
        ? res.why
        : outcome === "discarded"
          ? `Index ${i} is $+1, so the write itself is legal (§7.10.1). What happens next is the bound's rule, not an ignored write: the out-of-bound element is discarded and a warning is issued (§7.10.5).`
          : `Index ${i} is inside 0..$+1, so the write is legal (§7.10.1).`,
    },
  ];
  if (state.bound !== null) {
    choices.push({
      id: "discarded",
      label: `Discarded with a warning; size() stays ${size}`,
      correct: outcome === "discarded",
      feedback: outcome === "discarded"
        ? res.why
        : outcome === "append"
          ? `${n} holds ${size} of at most ${queueCapacity(state)} items, so ${n}[$+1] fits under the bound $:${state.bound} and nothing is discarded (§7.10.5).`
          : `Nothing ends up beyond the bound $:${state.bound}, so the §7.10.5 discard does not apply.`,
    });
  }
  if (typeof op.index === "number" && op.index > size) {
    choices.push({ id: "pad", label: `Grows ${n}, padding up to index ${op.index}`, correct: false, feedback: "Queues have no sparse slots and never pad. A write beyond $+1 is ignored with a warning (§7.10.1)." });
  }
  return choices;
}

// ---- Associative-array access semantics (§7.8.6, §7.8.7, §7.9.11) ----------------

export type AccessAspect = "value" | "warning" | "num";

export interface AccessQuestion {
  aspect: AccessAspect;
  question: string;
  options: PredictionChoice[];
}

/** Statements the access-semantics preset compares. Each is applied to the same key. */
export type AccessStatement = "read" | "write" | "increment" | "add-assign" | "ref-arg" | "exists" | "delete-key";

export const ACCESS_STATEMENTS: AccessStatement[] = ["read", "write", "increment", "add-assign", "ref-arg", "exists", "delete-key"];

/** Statements whose x/z-index behaviour §7.8.6 states. The others are excluded from the x-index choice. */
export const X_INDEX_STATEMENTS: AccessStatement[] = ["read", "write"];

export function accessOp(statement: AccessStatement, key: AssocKey, xIndex = false, value = 5): AssocOp {
  switch (statement) {
    case "read":
      return { op: "read", key, xIndex };
    case "write":
      return { op: "write", key, value, xIndex };
    case "increment":
      return { op: "rmw", key, form: "increment" };
    case "add-assign":
      return { op: "rmw", key, form: "add-assign", amount: 2 };
    case "ref-arg":
      return { op: "ref-arg", key };
    case "exists":
      return { op: "exists", key };
    case "delete-key":
      return { op: "delete-key", key };
  }
}

/** The value aspect of an access, or null for delete. */
function accessValueLabel(state: AssocArrayState, op: AssocOp, res: ArrayOpResult<AssocArrayState>): string | null {
  const lit = (v: SvElem) => formatElemLiteral(v, state.elemType);
  if (op.op === "read" || op.op === "ref-arg") return `v = ${lit(res.returned!.value as SvElem)}`;
  if (op.op === "exists") return `found = ${res.returned!.value}`;
  if (op.op === "write" || op.op === "rmw") {
    if (op.op === "write" && op.xIndex) return "No entry is written";
    const e = res.after.entries.find((x) => x.key === op.key);
    return e ? `${state.name}[${formatAssocKey(op.key)}] = ${lit(e.value)} afterwards` : "No entry is written";
  }
  return null;
}

function accessKeyText(state: AssocArrayState, op: AssocOp): string {
  return "xIndex" in op && op.xIndex ? X_INDEX_NAME : formatAssocKey((op as { key: AssocKey }).key);
}

/**
 * Three predictions for one access: the value it yields, whether a warning is
 * required, and num() afterwards. Every label is computed by running the model
 * (or a named wrong model of it); every feedback sentence is the model's rule.
 */
export function accessSemanticsQuestions(state: AssocArrayState, op: AssocOp): AccessQuestion[] {
  const res = applyAssocOp(state, op);
  const n = state.name;
  const declared = hasDeclaredDefault(state);
  const fourState = SV_ELEM_TYPES[state.elemType].fourState;
  const missing = !("xIndex" in op && op.xIndex) && "key" in op && !state.entries.some((e) => e.key === op.key);
  const questions: AccessQuestion[] = [];

  // Value aspect: the correct model plus wrong models (default ignored, 2-state thinking).
  const valueLabel = accessValueLabel(state, op, res);
  if (valueLabel !== null) {
    const choices: PredictionChoice[] = [{ id: "lrm", label: valueLabel, correct: true, feedback: res.why }];
    if (declared) {
      const noDefault = { ...state, declaredDefault: null };
      const label = accessValueLabel(noDefault, op, applyAssocOp(noDefault, op));
      if (label) {
        choices.push({
          id: "default-ignored",
          label,
          correct: false,
          feedback: op.op === "rmw"
            ? "That starts from the Table 7-1 value. A read-modify-write allocates the entry with its user-specified initial value before any reference (§7.8.7)."
            : op.op === "exists"
              ? "exists() reports entries, not values; it is unchanged by a default (§7.9.11)."
              : "That ignores the declared default. Reading a missing key with a declared default yields that default (§7.9.11).",
        });
      }
    }
    if (fourState) {
      const twoState = { ...state, elemType: "bit8" as const };
      const label = accessValueLabel(twoState, op, applyAssocOp(twoState, op));
      if (label) {
        choices.push({
          id: "two-state",
          label,
          correct: false,
          feedback: op.op === "rmw"
            ? `${SV_ELEM_TYPES[state.elemType].decl} is 4-state: its Table 7-1 value is 'x, not 0, and arithmetic with an x operand gives x (§11.4.3).`
            : `${SV_ELEM_TYPES[state.elemType].decl} is 4-state: its Table 7-1 value is 'x, not 0 (§7.8.6).`,
        });
      }
    }
    if (op.op === "exists") {
      const found = res.returned!.value === 1;
      choices.push({
        id: "exists-flip",
        label: `found = ${found ? 0 : 1}`,
        correct: false,
        feedback: found
          ? "The key was written, so the entry exists and exists() returns 1 (§7.9.3)."
          : "Only an allocated entry exists. A declared default or an earlier plain read does not create one (§7.9.3, §7.9.11).",
      });
    }
    if (!fourState && op.op !== "write" && op.op !== "exists") {
      const fourStateModel = { ...state, elemType: "logic8" as const };
      const label = accessValueLabel(fourStateModel, op, applyAssocOp(fourStateModel, op));
      if (label) {
        choices.push({
          id: "four-state",
          label,
          correct: false,
          feedback: `${SV_ELEM_TYPES[state.elemType].decl} is 2-state: its Table 7-1 value is 0, never 'x (§7.8.6).`,
        });
      }
    }
    // Wrong models that are about the access, not the element type: each label is computed from the state.
    const isX = "xIndex" in op && !!op.xIndex;
    const prior = !isX && "key" in op ? state.entries.find((e) => e.key === op.key) : undefined;
    const lit = (v: SvElem) => formatElemLiteral(v, state.elemType);
    if ((op.op === "write" || op.op === "rmw") && !isX) {
      if (missing) {
        choices.push({
          id: "not-allocated",
          label: "No entry is written",
          correct: false,
          feedback: op.op === "write"
            ? "A write to a missing key is not ignored: the target of an assignment is allocated (§7.8.7). Only an invalid (x/z) index makes a write a no-op (§7.8.6)."
            : "A read-modify-write is not a plain read: it allocates the missing entry with its initial value before any reference, then writes (§7.8.7).",
        });
      } else if (prior) {
        choices.push({
          id: "unchanged",
          label: `${n}[${formatAssocKey(op.key)}] = ${lit(prior.value)} afterwards`,
          correct: false,
          feedback: op.op === "write"
            ? "That is the old value. An assignment to an existing key replaces it."
            : "That is the old value. The statement reads the entry and writes the new value back to it.",
        });
      }
    }
    if ((op.op === "read" || op.op === "ref-arg") && prior) {
      choices.push({
        id: "table-7-1",
        label: `v = ${lit(defaultElementValue(state.elemType))}`,
        correct: false,
        feedback: "The key exists, so the read returns its stored value. The Table 7-1 value is only what a nonexistent entry reads as (§7.8.6).",
      });
      if (declared) {
        choices.push({
          id: "declared-default",
          label: `v = ${lit(state.declaredDefault as SvElem)}`,
          correct: false,
          feedback: "A declared default only stands in for keys that do not exist (§7.9.11). This key exists, so its stored value is read.",
        });
      }
    }
    choices.push({
      id: "fatal",
      label: "The simulation stops with an error",
      correct: false,
      feedback: "None of these accesses stops the simulation: §7.8.6 defines what a read returns and makes an invalid write a warning.",
    });
    questions.push({ aspect: "value", question: `What does \`${res.code}\` give?`, options: mergeChoices(choices) });
  }

  // Warning aspect.
  const required = res.diagnostics.some((d) => d.level === "warning");
  const warningWhy = accessWarningWhy(state, op, missing, declared);
  questions.push({
    aspect: "warning",
    question: `Does \`${res.code}\` issue a warning?`,
    options: [
      { id: "required", label: "A warning is required", correct: required, feedback: warningWhy },
      { id: "none", label: "No warning", correct: !required, feedback: warningWhy },
      {
        id: "optional",
        label: "A warning is allowed but not required",
        correct: false,
        feedback: `${warningWhy} "May warn" is the rule for invalid indices on fixed-size, dynamic and queue reads (§7.4.5), not for these associative-array cases.`,
      },
    ],
  });

  // num() aspect.
  const before = state.entries.length;
  const after = res.after.entries.length;
  const numWhy = accessNumWhy(state, op, missing, declared, after);
  const counts = Array.from(new Set([before - 1, before, before + 1].filter((c) => c >= 0)));
  questions.push({
    aspect: "num",
    question: `${n}.num() is ${before} before. What is it after \`${res.code}\`?`,
    options: counts.map((c) => ({ id: `num-${c}`, label: `num() = ${c}`, correct: c === after, feedback: numWhy })),
  });
  return questions;
}

function accessWarningWhy(state: AssocArrayState, op: AssocOp, missing: boolean, declared: boolean): string {
  switch (op.op) {
    case "read":
      if (op.xIndex) return "A read with an x/z index shall issue a warning (§7.8.6).";
      if (!missing) return "The entry exists, so nothing invalid is read.";
      return declared
        ? "With a user-specified default, a read of a missing key issues no warning (§7.8.6, §7.9.11)."
        : "Reading a nonexistent entry shall issue a warning (§7.8.6).";
    case "write":
      if (op.xIndex) return "A write with an invalid (x/z) index shall be ignored with a warning (§7.8.6).";
      return missing ? "A write to a missing key is legal: it allocates the entry (§7.8.7)." : "Overwriting an existing entry is an ordinary write.";
    case "rmw":
      return missing
        ? `The entry is allocated before any reference to it (§7.8.7), so no nonexistent entry is read and the §7.8.6 warning does not apply. Note: the standard does not state "no warning" for this case directly; the lab infers it from §7.8.7.`
        : "The entry exists, so nothing invalid is read.";
    case "ref-arg":
      return missing
        ? `The actual of a ref argument is allocated (§7.8.7), so peek() reads an entry that exists and the §7.8.6 warning does not apply. Note: the standard does not state "no warning" for this case directly; the lab infers it from §7.8.7.`
        : "The entry exists, so nothing invalid is read.";
    case "exists":
      return "exists() only asks whether the entry exists and returns 1 or 0 (§7.9.3); the §7.8.6 warning is for reads of a nonexistent entry.";
    case "delete-key":
      return missing ? "Deleting an entry that does not exist issues no warning (§7.9.2)." : "The entry exists and is removed (§7.9.2).";
    default:
      return "";
  }
}

function accessNumWhy(state: AssocArrayState, op: AssocOp, missing: boolean, declared: boolean, after: number): string {
  const n = `num() = ${after}`;
  switch (op.op) {
    case "read":
      if (op.xIndex || missing) {
        return declared && !op.xIndex
          ? `A declared default changes what the read returns, not the array: no entry is created, so ${n} (§7.9.11).`
          : `A plain read never allocates; only an assignment or a ref actual does (§7.8.7). ${n}.`;
      }
      return `Reading an existing entry changes nothing: ${n}.`;
    case "write":
      if (op.xIndex) return `The write is ignored (§7.8.6), so ${n}.`;
      return missing ? `The target of an assignment is allocated (§7.8.7): ${n}.` : `The key already existed: ${n}.`;
    case "rmw":
      return missing ? `A read-modify-write allocates the missing entry (§7.8.7): ${n}.` : `The key already existed: ${n}.`;
    case "ref-arg":
      return missing ? `The actual of a ref argument is allocated (§7.8.7): ${n}.` : `The key already existed: ${n}.`;
    case "exists":
      return `exists() never allocates${declared ? ", and a declared default does not change the methods (§7.9.11)" : ""}: ${n}.`;
    case "delete-key":
      return missing ? `There was nothing to delete (§7.9.2): ${n}.` : `delete(k) removes the entry (§7.9.2): ${n}.`;
    default:
      return n;
  }
}

/** Declaration of the peek() helper used by the ref-arg statement. A ref argument needs an automatic subroutine (§13.5.2). */
export function refPeekDecl(type: SvElemTypeId): string {
  const t = SV_ELEM_TYPES[type].decl;
  return `function automatic ${t} peek(ref ${t} r); return r; endfunction`;
}

// ---- Deleting while iterating an associative array (§7.9.6, §12.7.3, §7.12.1) -------

export type DeleteWalkStrategy = "foreach" | "find-index" | "first-next";

export interface DeleteWalkStep {
  /** Key of the code line this step executes (matches deleteWalkCode). */
  line: string;
  code: string;
  before: AssocArrayState;
  after: AssocArrayState;
  why: string;
  clause: string;
  changedKeys: AssocKey[];
  /** Value of `found` after a first()/next() call. */
  found?: number;
  /** Contents of empty_ids (find-index strategy). */
  emptyIds?: AssocKey[];
  /** The standard gives no outcome from this point on (§12.7.3). */
  undefinedOutcome?: boolean;
  /** A prediction to answer before this step's result is shown. */
  prediction?: ContainerPrediction;
}

export const DELETE_WALK_NAME = "exp_by_id";
export const DELETE_WALK_DECL = "bit [31:0] exp_by_id [int][$];  // value shown: each queue's size()";

/** exp_by_id with keys 1, 4 and 9; the entry values model each queue's size(): 2, 0 and 0. */
export function deleteWalkStart(): AssocArrayState {
  return createAssocArray(DELETE_WALK_NAME, "int", "int", [[1, 2], [4, 0], [9, 0]]);
}

export const DELETE_WALK_CODE: Record<DeleteWalkStrategy, Array<{ key: string; text: string }>> = {
  foreach: [
    { key: "loop", text: "foreach (exp_by_id[id])" },
    { key: "body", text: "  if (exp_by_id[id].size() == 0) exp_by_id.delete(id);" },
  ],
  "find-index": [
    { key: "decl", text: "int empty_ids [$];" },
    { key: "find", text: "empty_ids = exp_by_id.find_index with (item.size() == 0);" },
    { key: "del", text: "foreach (empty_ids[i]) exp_by_id.delete(empty_ids[i]);" },
  ],
  "first-next": [
    { key: "first", text: "found = exp_by_id.first(id);" },
    { key: "while", text: "while (found) begin" },
    { key: "body", text: "  if (exp_by_id[id].size() == 0) exp_by_id.delete(id);" },
    { key: "next", text: "  found = exp_by_id.next(id);" },
    { key: "end", text: "end" },
  ],
};

/** Wrong models of next() after the current key was deleted, each computed. */
function nextChoices(state: AssocArrayState): PredictionChoice[] {
  const keys = state.entries.map((e) => e.key);
  const id = state.iter;
  const res = applyAssocOp(state, { op: "next" });
  const label = (found: number, at: AssocKey) => `returns ${found}; id = ${formatAssocKey(at)}`;
  const idGone = !keys.includes(id);
  const choices: PredictionChoice[] = [
    { id: "lrm", label: label(res.returned!.value as number, res.after.iter), correct: true, feedback: `${res.why} next() looks for the smallest index greater than the given one, whether or not that index still exists (§7.9.6).` },
  ];
  if (idGone) {
    choices.push({ id: "fails", label: label(0, id), correct: false, feedback: "next() does not need id to be a key. It compares indices, so deleting the current entry does not stop the walk (§7.9.6)." });
  }
  if (keys.length > 0) {
    choices.push({ id: "restart", label: label(1, keys[0]), correct: false, feedback: "next() never restarts or wraps to the first key: with no greater index it returns 0 and leaves id unchanged (§7.9.6)." });
  }
  choices.push({ id: "reset", label: label(0, assocKeyDefault(state.keyType)), correct: false, feedback: "When next() finds nothing it leaves the index unchanged; it does not reset it (§7.9.6)." });
  return mergeChoices(choices);
}

export function deleteWalkSteps(strategy: DeleteWalkStrategy, start: AssocArrayState = deleteWalkStart()): DeleteWalkStep[] {
  const steps: DeleteWalkStep[] = [];
  const sizeOf = (s: AssocArrayState, key: AssocKey) => s.entries.find((e) => e.key === key)?.value;
  let s = start;
  const push = (step: Omit<DeleteWalkStep, "before"> & { before?: AssocArrayState }) => {
    steps.push({ before: s, ...step });
    s = step.after;
  };

  if (strategy === "find-index") {
    const empty = s.entries.filter((e) => e.value === 0).map((e) => e.key);
    push({
      line: "find",
      code: "empty_ids = exp_by_id.find_index with (item.size() == 0);",
      after: s,
      emptyIds: empty,
      changedKeys: empty,
      why: `Pass 1 only reads: empty_ids holds ${empty.map(formatAssocKey).join(", ")}, and the array keeps every key. Locators traverse in an unspecified order (§7.12.1), so empty_ids may list them in another order; the final keys do not depend on it.`,
      clause: "§7.12.1",
    });
    for (const key of empty) {
      const r = applyAssocOp(s, { op: "delete-key", key });
      push({ line: "del", code: r.code, after: r.after, emptyIds: empty, changedKeys: [], why: `Pass 2 iterates empty_ids, not exp_by_id, so deleting ${formatAssocKey(key)} changes nothing the loop depends on. ${r.why}`, clause: "§7.9.2, §12.7.3" });
    }
    return steps;
  }

  if (strategy === "foreach") {
    const keys = s.entries.map((e) => e.key);
    for (const key of keys) {
      const size = sizeOf(s, key);
      if (size !== 0) {
        push({ line: "body", code: `// id = ${formatAssocKey(key)}: size() is ${size}, keep`, after: { ...s, iter: key }, changedKeys: [key], why: `foreach visits the keys in index order (§7.8.4); id = ${formatAssocKey(key)} holds ${size} item(s), so it stays. Nothing has changed the array yet.`, clause: "§12.7.3, §7.8.4" });
        continue;
      }
      const r = applyAssocOp({ ...s, iter: key }, { op: "delete-key", key });
      push({ line: "body", code: r.code.replace(formatAssocKey(key), "id") + `  // id = ${formatAssocKey(key)}`, after: r.after, changedKeys: [], why: `id = ${formatAssocKey(key)} is empty and is deleted inside the foreach over the same array: the array changed size while the loop iterates over it.`, clause: "§12.7.3" });
      push({
        line: "loop",
        code: "// next iteration of foreach (exp_by_id[id])",
        after: s,
        changedKeys: [],
        undefinedOutcome: true,
        why: "If the dimensions of a dynamically sized array change while a foreach iterates over it, the results are undefined and may generate invalid index values (§12.7.3). The standard gives no next step, so the lab shows none.",
        clause: "§12.7.3",
        prediction: {
          question: `The loop just deleted key ${formatAssocKey(key)} from the array it is iterating. What does the next iteration do?`,
          options: [
            { id: "undefined", label: "Undefined: the standard promises no outcome", correct: true, feedback: "Changing a dynamically sized array during its own foreach makes the results undefined, and invalid index values may be generated (§12.7.3). A simulator may appear to work; the code is still wrong." },
            { id: "visit-next", label: `It visits the next remaining key and carries on`, correct: false, feedback: "A simulator may do that today, but §12.7.3 does not promise it. Code that relies on it can break on another tool or version." },
            { id: "ends", label: "The loop ends at once", correct: false, feedback: "Nothing guarantees that either: the results are undefined (§12.7.3)." },
          ],
        },
      });
      return steps;
    }
    return steps;
  }

  // first()/next() walk
  const first = applyAssocOp(s, { op: "first" });
  push({ line: "first", code: first.code.replace("key", "id"), after: first.after, found: first.returned!.value as number, changedKeys: first.changedKeys, why: first.why.replace("key", "id"), clause: first.clause });
  let found = first.returned!.value as number;
  let guard = 0;
  while (found && guard < 16) {
    guard += 1;
    const id = s.iter;
    const size = sizeOf(s, id);
    let deleted = false;
    if (size === 0) {
      const r = applyAssocOp(s, { op: "delete-key", key: id });
      push({ line: "body", code: `exp_by_id.delete(id);  // id = ${formatAssocKey(id)}`, after: r.after, changedKeys: [], why: `id = ${formatAssocKey(id)} holds an empty queue, so it is deleted. id keeps the value ${formatAssocKey(id)}, which is no longer a key.`, clause: "§7.9.2" });
      deleted = true;
    } else {
      push({ line: "body", code: `// id = ${formatAssocKey(id)}: size() is ${size}, keep`, after: s, changedKeys: [id], why: `id = ${formatAssocKey(id)} holds ${size} item(s), so it stays.`, clause: "§7.9.6" });
    }
    const r = applyAssocOp(s, { op: "next" });
    found = r.returned!.value as number;
    push({
      line: "next",
      code: r.code.replace("key", "id"),
      after: r.after,
      found,
      changedKeys: r.changedKeys,
      why: `${r.why.replace(/\bkey\b/g, "id")}${deleted ? " The deleted key is not needed: next() compares indices." : ""}`,
      clause: "§7.9.6",
      prediction: deleted
        ? { question: `id = ${formatAssocKey(id)} was just deleted; the keys are now ${s.entries.map((e) => formatAssocKey(e.key)).join(", ") || "none"}. What does \`found = exp_by_id.next(id)\` do?`, options: nextChoices(s) }
        : undefined,
    });
  }
  return steps;
}

// ---- A mixed queue program and its misreadings (§7.10.2) -----------------------------

export type QueueMisreading = "lrm" | "insert-after" | "pop-back-front" | "pop-peek";

export interface QueueIndexShift {
  value: SvElem;
  from: number;
  to: number;
}

/** Which surviving elements change index when `op` runs on `state` (unbounded semantics). */
export function queueIndexShifts(state: QueueState, op: QueueOp): QueueIndexShift[] {
  const v = state.values;
  const size = v.length;
  const moved = (start: number, end: number, delta: number) =>
    range(Math.max(0, end - start), start).map((i) => ({ value: v[i], from: i, to: i + delta }));
  switch (op.op) {
    case "push_front":
      return moved(0, size, 1);
    case "insert":
      return Number.isInteger(op.index) && op.index >= 0 && op.index <= size ? moved(op.index, size, 1) : [];
    case "pop_front":
      return size > 0 ? moved(1, size, -1) : [];
    case "delete-index":
      return Number.isInteger(op.index) && op.index >= 0 && op.index < size ? moved(op.index + 1, size, -1) : [];
    default:
      return [];
  }
}

const MISREADING_FEEDBACK: Record<Exclude<QueueMisreading, "lrm">, string> = {
  "insert-after": "insert(i, v) puts v at index i and moves the old item at i up one; it does not insert after index i (§7.10.2.2).",
  "pop-back-front": "pop_back() removes the last item, not the first (§7.10.2.5).",
  "pop-peek": "pop_back() removes the item it returns; it is not a peek. Read q[$] to look without removing (§7.10.2.5).",
};

function applyMisread(state: QueueState, op: QueueOp, reading: QueueMisreading): ArrayOpResult<QueueState> {
  if (reading === "insert-after" && op.op === "insert") {
    return applyQueueOp(state, { ...op, index: Math.min(op.index + 1, state.values.length) });
  }
  if (reading === "pop-back-front" && op.op === "pop_back") return applyQueueOp(state, { op: "pop_front" });
  if (reading === "pop-peek" && (op.op === "pop_back" || op.op === "pop_front")) {
    const r = applyQueueOp(state, op);
    return { ...r, after: state };
  }
  return applyQueueOp(state, op);
}

export interface QueueProgramStep {
  op: QueueOp;
  result: ArrayOpResult<QueueState>;
  shifts: QueueIndexShift[];
}

export interface QueueProgramRun {
  start: QueueState;
  steps: QueueProgramStep[];
  final: SvElem[];
  /** Values returned by pops, in order. */
  popped: SvElem[];
}

export function runQueueProgram(initial: readonly SvElem[], program: readonly QueueOp[], reading: QueueMisreading = "lrm", name = "q"): QueueProgramRun {
  const start = createQueue(name, "int", null, [...initial]);
  let s = start;
  const steps: QueueProgramStep[] = [];
  const popped: SvElem[] = [];
  for (const op of program) {
    const result = applyMisread(s, op, reading);
    steps.push({ op, result, shifts: reading === "lrm" ? queueIndexShifts(s, op) : [] });
    if ((op.op === "pop_back" || op.op === "pop_front") && result.returned) popped.push(result.returned.value as SvElem);
    s = result.after;
  }
  return { start, steps, final: s.values, popped };
}

function programOutcomeLabel(run: QueueProgramRun): string {
  const q = `${run.start.name} = ${formatElemList(run.final)}`;
  return run.popped.length ? `${q}; popped v = ${run.popped.map(formatElem).join(", ")}` : q;
}

/** Choices for "what does the queue hold, and what was popped": the model plus each misreading. */
export function queueProgramChoices(initial: readonly SvElem[], program: readonly QueueOp[]): PredictionChoice[] {
  const lrm = runQueueProgram(initial, program);
  const trace = lrm.steps.map((s) => `${formatElemList(s.result.after.values)} after ${s.result.code.replace(/^v = /, "").replace(/;$/, "").replace(/^q\./, "")}`).join("; ");
  const choices: PredictionChoice[] = [{ id: "lrm", label: programOutcomeLabel(lrm), correct: true, feedback: `Track the queue after every call: ${trace}.` }];
  for (const reading of Object.keys(MISREADING_FEEDBACK) as Array<Exclude<QueueMisreading, "lrm">>) {
    choices.push({ id: reading, label: programOutcomeLabel(runQueueProgram(initial, program, reading)), correct: false, feedback: MISREADING_FEEDBACK[reading] });
  }
  return mergeChoices(choices);
}
