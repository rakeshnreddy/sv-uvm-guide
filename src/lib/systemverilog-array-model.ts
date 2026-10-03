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

export type QueueOp =
  | { op: "push_back"; value: number }
  | { op: "push_front"; value: number }
  | { op: "pop_front" }
  | { op: "pop_back" }
  | { op: "insert"; index: number; value: number }
  | { op: "delete-index"; index: number }
  | { op: "delete" }
  | { op: "read"; index: number }
  | { op: "size" };

export type AssocOp =
  | { op: "write"; key: AssocKey; value: number }
  | { op: "read"; key: AssocKey }
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
    if (state.entries.length === 0) return `${decl};`;
    const byWrite = state.writeOrder
      .map((k) => state.entries.find((e) => e.key === k))
      .filter((e): e is AssocEntry => Boolean(e));
    return `${decl} = '{${byWrite.map((e) => `${formatAssocKey(e.key)}:${formatElemLiteral(e.value, state.elemType)}`).join(", ")}};`;
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

export function applyQueueOp(state: QueueState, op: QueueOp, policy: QueueOverflowPolicy = "lrm"): ArrayOpResult<QueueState> {
  const def = defaultElementValue(state.elemType);
  const defText = formatElemLiteral(def, state.elemType);
  const n = state.name;
  const size = state.values.length;

  const write = (grown: SvElem[], insertedAt: number, code: string, what: string): ArrayOpResult<QueueState> => {
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
          ? `${what} put the new element at index ${insertedAt}, beyond the bound $:${state.bound}, so the new element is discarded and a warning is issued.`
          : `${what} shifted the existing elements up; the old last element ${formatElemList(bounded.discarded)} now sits beyond the bound $:${state.bound} and is discarded with a warning.`,
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
      return result({ before: state, after, code, why: `${what} was refused because the queue is full.`, clause: "misconception" });
    }
    return result({
      before: state,
      after,
      code,
      why: `${what}; size() is now ${bounded.values.length}${state.bound === null ? " (an unbounded queue just grows)" : ""}.`,
      clause: "§7.10.2",
      changedIndices: [insertedAt],
    });
  };

  switch (op.op) {
    case "push_back":
      return write([...state.values, wrapToType(op.value, state.elemType)], size, `${n}.push_back(${op.value});`, `push_back(${op.value}) appended at index ${size}`);
    case "push_front":
      return write([wrapToType(op.value, state.elemType), ...state.values], 0, `${n}.push_front(${op.value});`, `push_front(${op.value}) inserted at index 0`);
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
      return write(grown, op.index, code, `insert(${op.index}, ${op.value}) placed the item at index ${op.index}`);
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
): AssocArrayState {
  let state: AssocArrayState = { kind: "assoc", name, elemType, keyType, entries: [], iter: assocKeyDefault(keyType), writeOrder: [] };
  for (const [key, value] of writes) state = applyAssocOp(state, { op: "write", key, value }).after;
  return state;
}

export function applyAssocOp(state: AssocArrayState, op: AssocOp): ArrayOpResult<AssocArrayState> {
  const def = defaultElementValue(state.elemType);
  const defText = formatElemLiteral(def, state.elemType);
  const n = state.name;
  const keys = state.entries.map((e) => e.key);
  const has = (k: AssocKey) => state.entries.some((e) => e.key === k);
  const k = formatAssocKey;

  switch (op.op) {
    case "write": {
      const value = wrapToType(op.value, state.elemType);
      const exists = has(op.key);
      const entries = exists
        ? state.entries.map((e) => (e.key === op.key ? { ...e, value } : e))
        : [...state.entries, { key: op.key, value }].sort((a, b) => compareAssocKeys(a.key, b.key));
      return result({
        before: state,
        after: { ...state, entries, writeOrder: exists ? state.writeOrder : [...state.writeOrder, op.key] },
        code: `${n}[${k(op.key)}] = ${op.value};`,
        why: exists
          ? `Key ${k(op.key)} already exists, so its value is replaced.`
          : `Writing a new key allocates its entry, which takes its place in index order, not at the end.`,
        clause: exists ? "§7.8" : "§7.8.7",
        changedKeys: [op.key],
      });
    }
    case "read": {
      const code = `v = ${n}[${k(op.key)}];`;
      const entry = state.entries.find((e) => e.key === op.key);
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
    case "exists":
      return result({
        before: state,
        after: state,
        code: `found = ${n}.exists(${k(op.key)});`,
        returned: { label: "found", value: has(op.key) ? 1 : 0 },
        why: has(op.key) ? `exists() returns 1: the key is present.` : `exists() returns 0 and, unlike a read, raises no warning. Check before you read.`,
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
        why: "num() (and size()) return the number of entries.",
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
