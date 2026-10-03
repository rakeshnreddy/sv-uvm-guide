/**
 * Deterministic educational model of SystemVerilog functional coverage
 * (IEEE 1800-2023 Clause 19).
 *
 * Implemented rules (each one is pinned by a test in
 * tests/lib/coverage-model.test.ts that cites the clause):
 * - Value bins: one bin, an open array `b[]` (one bin per value) and a fixed
 *   count `b[N]` with the B = floor(values / N) distribution (§19.5.1).
 * - Automatic bins: N = enum cardinality, or min(2^M, auto_bin_max) with the
 *   last bin taking the remainder; names `auto[v]` / `auto[lo:hi]` (§19.5.3).
 * - Wildcard bins: `?`, `x`, `z` match 0 or 1 (§19.5.4).
 * - Transition bins: `=>`, consecutive `[*n]`/`[*m:n]` and goto `[->n]`/
 *   `[->m:n]` repetition; overlapping matches count; a bin increments at most
 *   once per sample; length-0 transitions are illegal (§19.5.2).
 * - `default` bins catch values outside every other bin; they never count
 *   toward coverage and are never crossed (§19.5, §19.6).
 * - ignore_bins (§19.5.5) and illegal_bins (§19.5.6): their values are removed
 *   from other bins after distribution; empty bins are excluded (§19.11);
 *   an illegal hit reports a run-time error and takes precedence over every
 *   other bin. Whether the simulation stops is a tool setting, not the LRM.
 * - Crosses: the Cartesian product of the counted bins of each coverpoint
 *   (§19.6); user cross bins built from `binsof(cp)`, `binsof(cp.bin)`,
 *   `intersect {…}`, `!`, `&&`, `||` (§19.6.1); ignore/illegal cross bins
 *   (§19.6.2, §19.6.3); automatic cross bins retained for products outside
 *   every user-defined bin (cross_retain_auto_bins = 1, Table 19-1).
 * - Coverage computation (§19.11): coverpoint = covered / bins; cross =
 *   covered / (Bc + Bu) (§19.11.2); covergroup = weighted average using
 *   option.weight; a bin is covered when hits >= at_least (Table 19-1).
 * - Type coverage across instances: weighted average, or the union of bins
 *   when type_option.merge_instances = 1 (§19.11.3).
 * - Sampling: a clocking event samples once per occurrence, as if the
 *   triggering process called sample() (§19.3); `iff` guards (§19.5, §19.6).
 *
 * Assumptions and limits (also listed next to the visuals):
 * - 2-state, unsigned integral coverpoints with at most 4096 values; enum
 *   coverpoints are numbered 0..N-1. No real coverpoints, no `with` clauses.
 * - Clocked sampling uses the edge-sampled convention: the value sampled at
 *   edge k is the value held just before edge k, as when the signal is driven
 *   with `<=` or through a clocking block.
 * - Nonconsecutive repetition `[=n]` and `default sequence` are not modelled.
 *   Ignored/illegal transitions prune only bounded transition bins.
 * - A guard (`iff`) that is false skips the sample for that item entirely,
 *   including its transition history.
 */

// ---------------------------------------------------------------------------
// Specification types
// ---------------------------------------------------------------------------

/** A single value or an inclusive `[lo:hi]` range. */
export type RangeItem = number | readonly [number, number];

export type BinKeyword = "bins" | "ignore_bins" | "illegal_bins";

/** `undefined` → one bin; `"open"` → `name[]`; a number → `name[N]`. */
export type BinArray = undefined | "open" | number;

export interface TransRepeat {
  /** `*` consecutive, `->` goto. */
  op: "*" | "->";
  min: number;
  max: number;
}

export interface TransItem {
  values: RangeItem[];
  repeat?: TransRepeat;
}

export type TransSequence = TransItem[];

export type BinDecl =
  | { form: "values"; keyword: BinKeyword; name: string; array?: BinArray; values: RangeItem[] }
  | { form: "wildcard"; keyword: BinKeyword; name: string; array?: "open"; pattern: string }
  | { form: "transition"; keyword: BinKeyword; name: string; array?: "open"; sequences: TransSequence[] }
  | { form: "default"; name: string };

export interface CoverpointSpec {
  /** Coverpoint label, e.g. `cp_addr`. */
  name: string;
  /** Sampled variable (also the key in each sample's values). */
  expr: string;
  /** Width in bits (unsigned). Ignored when `enumLabels` is given. */
  width: number;
  /** Enum constants in value order (value i ↔ enumLabels[i]). */
  enumLabels?: string[];
  bins: BinDecl[];
  /** Guard variable: the coverpoint is sampled only when it is non-zero. */
  iff?: string;
  autoBinMax?: number;
  atLeast?: number;
  weight?: number;
}

export type SelectExpr =
  | { op: "binsof"; coverpoint: string; bin?: string; intersect?: RangeItem[]; negate?: boolean }
  | { op: "and" | "or"; left: SelectExpr; right: SelectExpr };

export interface CrossBinDecl {
  keyword: BinKeyword;
  name: string;
  select: SelectExpr;
}

export interface CrossSpec {
  name: string;
  coverpoints: string[];
  bins?: CrossBinDecl[];
  iff?: string;
  atLeast?: number;
  weight?: number;
}

export type CovergroupEvent =
  | { kind: "clock"; expr: string }
  | { kind: "sample"; args: string }
  | { kind: "none" };

export interface CovergroupSpec {
  name: string;
  event?: CovergroupEvent;
  coverpoints: CoverpointSpec[];
  crosses?: CrossSpec[];
  /** Covergroup-level option.at_least (default for coverpoints and crosses). */
  atLeast?: number;
  /** Covergroup-level option.auto_bin_max (default for coverpoints). */
  autoBinMax?: number;
  perInstance?: boolean;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const DEFAULT_AUTO_BIN_MAX = 64; // Table 19-1
export const DEFAULT_AT_LEAST = 1; // Table 19-1
const MAX_DOMAIN = 4096;
const MAX_TRANSITION_EXPANSION = 256;

export function domainMax(width: number, enumLabels?: string[]): number {
  if (enumLabels && enumLabels.length > 0) return enumLabels.length - 1;
  return Math.pow(2, Math.max(1, width)) - 1;
}

/** Expands a range list into values in the order written (duplicates kept). */
export function expandRangeList(items: readonly RangeItem[], max: number): { values: number[]; dropped: number[] } {
  const values: number[] = [];
  const dropped: number[] = [];
  for (const item of items) {
    const [lo, hi] = typeof item === "number" ? [item, item] : item;
    if (lo > hi) continue; // empty range
    for (let v = lo; v <= hi; v += 1) {
      if (v < 0 || v > max) dropped.push(v);
      else values.push(v);
    }
  }
  return { values, dropped };
}

function uniqueInOrder(values: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function formatValue(v: number, enumLabels?: string[]): string {
  if (enumLabels && enumLabels[v] !== undefined) return enumLabels[v];
  return String(v);
}

/** Compresses a sorted value set back into `[lo:hi]` runs, e.g. "0:3, 7". */
export function describeValues(values: number[], enumLabels?: string[]): string {
  if (values.length === 0) return "∅";
  if (enumLabels) return uniqueInOrder(values).map((v) => formatValue(v, enumLabels)).join(", ");
  const sorted = uniqueInOrder(values).sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const v = sorted[i];
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    runs.push(start === prev ? String(start) : `${start}:${prev}`);
    start = v;
    prev = v;
  }
  return runs.join(", ");
}

// ---------------------------------------------------------------------------
// Wildcards (§19.5.4)
// ---------------------------------------------------------------------------

/** Normalises `4'b11??` / `11??` to an MSB-first pattern of 0, 1 and ?. */
export function normaliseWildcard(pattern: string, width: number): { bits: string; error?: string } {
  const body = pattern.replace(/_/g, "").replace(/^\s*\d*\s*'\s*[bB]\s*/, "").trim().toLowerCase();
  if (!/^[01xz?]+$/.test(body)) return { bits: "", error: `"${pattern}" is not a binary wildcard pattern` };
  const bits = body.replace(/[xz]/g, "?");
  if (bits.length > width) return { bits: bits.slice(bits.length - width), error: `pattern is wider than ${width} bits` };
  return { bits: bits.padStart(width, "0") };
}

export function wildcardMatches(bits: string, value: number): boolean {
  const width = bits.length;
  for (let i = 0; i < width; i += 1) {
    const c = bits[i];
    if (c === "?") continue;
    const bit = (value >> (width - 1 - i)) & 1;
    if (String(bit) !== c) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Elaborated (resolved) bins
// ---------------------------------------------------------------------------

export type ResolvedBinKind = "bins" | "auto" | "default" | "ignore" | "illegal";

export interface ResolvedBin {
  /** Unique key inside the covergroup, e.g. `cp_addr.mid[4]`. */
  key: string;
  /** Name as a report shows it, e.g. `mid[4]`, `auto[0:15]`. */
  name: string;
  /** Declared identifier (`mid`, `auto`) as used by `binsof(cp.bin)`. */
  declName: string;
  coverpoint: string;
  kind: ResolvedBinKind;
  transition: boolean;
  /** Values listed by the declaration, before ignore/illegal removal. */
  declaredValues: number[];
  /** Values the bin counts after removal (state bins). */
  values: number[];
  /** Transition sequences the bin matches (transition bins). */
  sequences: TransSequence[];
  /** True when the bin contributes to coverage (bins/auto, not empty). */
  counted: boolean;
  /** Why a bins/auto bin is excluded (empty after removal). */
  excludedReason?: string;
}

export interface ElaboratedCoverpoint {
  spec: CoverpointSpec;
  name: string;
  max: number;
  enumLabels?: string[];
  bins: ResolvedBin[];
  /** True when SystemVerilog created automatic bins. */
  autoBins: boolean;
  atLeast: number;
  weight: number;
  autoBinMax: number;
  diagnostics: string[];
  /** Values listed by any state bin (bins, ignore, illegal) — used by `default`. */
  listedValues: Set<number>;
  ignoreValues: Set<number>;
  illegalValues: Set<number>;
}

function binDisplayName(base: string, index: string | number): string {
  return `${base}[${index}]`;
}

/** Distributes values over N bins: B = max(1, floor(count / N)); the last bin takes the rest (§19.5.1). */
export function distributeFixed(values: number[], n: number): number[][] {
  const bins: number[][] = Array.from({ length: n }, () => []);
  const b = Math.max(1, Math.floor(values.length / n));
  values.forEach((v, i) => {
    const idx = Math.min(Math.floor(i / b), n - 1);
    bins[idx].push(v);
  });
  return bins;
}

/** Automatic bins (§19.5.3). */
export function automaticBins(width: number, autoBinMax: number, enumLabels?: string[]): { name: string; values: number[] }[] {
  if (enumLabels && enumLabels.length > 0) {
    return enumLabels.map((label, v) => ({ name: `auto[${label}]`, values: [v] }));
  }
  const total = Math.pow(2, width);
  const n = Math.max(1, Math.min(total, autoBinMax));
  const b = Math.floor(total / n);
  const out: { name: string; values: number[] }[] = [];
  for (let i = 0; i < n; i += 1) {
    const lo = i * b;
    const hi = i === n - 1 ? total - 1 : (i + 1) * b - 1;
    const values: number[] = [];
    for (let v = lo; v <= hi; v += 1) values.push(v);
    out.push({ name: lo === hi ? `auto[${lo}]` : `auto[${lo}:${hi}]`, values });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transitions (§19.5.2)
// ---------------------------------------------------------------------------

function itemRepeat(item: TransItem): TransRepeat {
  return item.repeat ?? { op: "*", min: 1, max: 1 };
}

function sequenceIsBounded(seq: TransSequence): boolean {
  return seq.every((item) => itemRepeat(item).op === "*");
}

/** Minimum number of samples a sequence spans; 1 means "length 0" (illegal). */
function sequenceMinSamples(seq: TransSequence): number {
  return seq.reduce((n, item) => n + Math.max(1, itemRepeat(item).min), 0);
}

/** Expands a bounded sequence into concrete value sequences, or null when too large. */
export function expandSequence(seq: TransSequence, max: number, limit = MAX_TRANSITION_EXPANSION): number[][] | null {
  let partial: number[][] = [[]];
  for (const item of seq) {
    const rep = itemRepeat(item);
    if (rep.op !== "*") return null;
    const vals = uniqueInOrder(expandRangeList(item.values, max).values);
    const next: number[][] = [];
    for (const prefix of partial) {
      for (let r = rep.min; r <= rep.max; r += 1) {
        let chunks: number[][] = [[]];
        for (let k = 0; k < r; k += 1) {
          const grown: number[][] = [];
          for (const c of chunks) for (const v of vals) grown.push([...c, v]);
          chunks = grown;
          if (chunks.length * partial.length > limit) return null;
        }
        for (const c of chunks) next.push([...prefix, ...c]);
        if (next.length > limit) return null;
      }
    }
    partial = next;
  }
  return partial;
}

function containsRun(haystack: number[], needle: number[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

const concreteToSequence = (values: number[]): TransSequence => values.map((v) => ({ values: [v] }));

export function formatTransition(seq: TransSequence, enumLabels?: string[]): string {
  return seq
    .map((item) => {
      const list = item.values.map((r) => (typeof r === "number" ? formatValue(r, enumLabels) : `[${formatValue(r[0], enumLabels)}:${formatValue(r[1], enumLabels)}]`)).join(", ");
      const rep = item.repeat;
      if (!rep || (rep.op === "*" && rep.min === 1 && rep.max === 1)) return list;
      const count = rep.min === rep.max ? `${rep.min}` : `${rep.min}:${rep.max}`;
      return `${list} [${rep.op === "*" ? "* " : "-> "}${count}]`;
    })
    .join(" => ");
}

/** NFA thread state: sequence index, item index, occurrences matched for that item. */
type ThreadState = string;

interface CompiledSequence {
  items: { set: Set<number>; repeat: TransRepeat }[];
}

function compileSequence(seq: TransSequence, max: number): CompiledSequence {
  return {
    items: seq.map((item) => ({ set: new Set(expandRangeList(item.values, max).values), repeat: itemRepeat(item) })),
  };
}

/**
 * Advances every live thread (plus a fresh thread per sequence, because
 * matches may start at any sample and may overlap) by one sampled value.
 * Returns the surviving threads and whether any sequence completed here.
 */
function stepTransition(seqs: CompiledSequence[], live: Set<ThreadState>, v: number): { next: Set<ThreadState>; completed: boolean } {
  const next = new Set<ThreadState>();
  let completed = false;
  const consider = new Set<ThreadState>(live);
  seqs.forEach((_, s) => consider.add(`${s}:0:0`));
  const advance = (s: number, j: number) => {
    if (j + 1 >= seqs[s].items.length) completed = true;
    else next.add(`${s}:${j + 1}:0`);
  };
  for (const state of Array.from(consider)) {
    const [s, j, c] = state.split(":").map(Number);
    const item = seqs[s].items[j];
    const hit = item.set.has(v);
    if (item.repeat.op === "*") {
      if (!hit) continue;
      const c2 = c + 1;
      if (c2 < item.repeat.max) next.add(`${s}:${j}:${c2}`);
      if (c2 >= item.repeat.min) advance(s, j);
    } else {
      if (!hit) {
        next.add(state); // goto: any number of other samples may intervene
        continue;
      }
      const c2 = c + 1;
      if (c2 < item.repeat.max) next.add(`${s}:${j}:${c2}`);
      if (c2 >= item.repeat.min) advance(s, j);
    }
  }
  return { next, completed };
}

// ---------------------------------------------------------------------------
// Coverpoint elaboration
// ---------------------------------------------------------------------------

const keywordKind = (k: BinKeyword): ResolvedBinKind => (k === "bins" ? "bins" : k === "ignore_bins" ? "ignore" : "illegal");

export function elaborateCoverpoint(spec: CoverpointSpec, group: { atLeast?: number; autoBinMax?: number } = {}): ElaboratedCoverpoint {
  const enumLabels = spec.enumLabels && spec.enumLabels.length > 0 ? spec.enumLabels : undefined;
  const max = domainMax(spec.width, enumLabels);
  const diagnostics: string[] = [];
  if (max + 1 > MAX_DOMAIN) diagnostics.push(`The model enumerates at most ${MAX_DOMAIN} values; ${spec.name} has ${max + 1}.`);
  const autoBinMax = spec.autoBinMax ?? group.autoBinMax ?? DEFAULT_AUTO_BIN_MAX;
  const atLeast = spec.atLeast ?? group.atLeast ?? DEFAULT_AT_LEAST;
  const weight = spec.weight ?? 1;
  const bins: ResolvedBin[] = [];
  const names = new Set<string>();
  const key = (name: string) => `${spec.name}.${name}`;
  const fmt = (v: number) => formatValue(v, enumLabels);

  const push = (bin: Omit<ResolvedBin, "key" | "coverpoint" | "counted">) => {
    bins.push({ ...bin, key: key(bin.name), coverpoint: spec.name, counted: false });
  };

  for (const decl of spec.bins) {
    if (names.has(decl.name)) diagnostics.push(`Bin name "${decl.name}" is declared twice in ${spec.name}.`);
    names.add(decl.name);
    if (decl.form === "default") {
      push({ name: decl.name, declName: decl.name, kind: "default", transition: false, declaredValues: [], values: [], sequences: [] });
      continue;
    }
    const kind = keywordKind(decl.keyword);
    if (decl.form === "values") {
      const { values, dropped } = expandRangeList(decl.values, max);
      if (dropped.length > 0) diagnostics.push(`${decl.name}: values outside 0..${max} are ignored (${describeValues(dropped)}).`);
      if (decl.array === undefined || kind !== "bins") {
        // ignore/illegal arrays still just name value sets; treat them as one set.
        push({ name: decl.name, declName: decl.name, kind, transition: false, declaredValues: uniqueInOrder(values), values: uniqueInOrder(values), sequences: [] });
      } else if (decl.array === "open") {
        for (const v of uniqueInOrder(values)) {
          push({ name: binDisplayName(decl.name, fmt(v)), declName: decl.name, kind, transition: false, declaredValues: [v], values: [v], sequences: [] });
        }
      } else {
        const n = Math.max(1, Math.floor(decl.array));
        distributeFixed(values, n).forEach((vals, i) => {
          push({ name: binDisplayName(decl.name, i), declName: decl.name, kind, transition: false, declaredValues: uniqueInOrder(vals), values: uniqueInOrder(vals), sequences: [] });
        });
      }
      continue;
    }
    if (decl.form === "wildcard") {
      const { bits, error } = normaliseWildcard(decl.pattern, enumLabels ? Math.ceil(Math.log2(max + 1)) || 1 : spec.width);
      if (error) diagnostics.push(`${decl.name}: ${error}.`);
      const matches: number[] = [];
      if (bits) for (let v = 0; v <= max; v += 1) if (wildcardMatches(bits, v)) matches.push(v);
      if (decl.array === "open" && kind === "bins") {
        for (const v of matches) {
          push({ name: binDisplayName(decl.name, fmt(v)), declName: decl.name, kind, transition: false, declaredValues: [v], values: [v], sequences: [] });
        }
      } else {
        push({ name: decl.name, declName: decl.name, kind, transition: false, declaredValues: matches, values: matches, sequences: [] });
      }
      continue;
    }
    // Transition bins
    const valid: TransSequence[] = [];
    for (const seq of decl.sequences) {
      if (seq.length === 0 || sequenceMinSamples(seq) < 2) {
        diagnostics.push(`${decl.name}: a transition of length 0 such as (${formatTransition(seq, enumLabels)}) is illegal (§19.5.2).`);
        continue;
      }
      valid.push(seq);
    }
    if (decl.array === "open" && kind === "bins") {
      for (const seq of valid) {
        if (!sequenceIsBounded(seq)) {
          diagnostics.push(`${decl.name}[]: a goto repetition has no fixed length, so it cannot form an array of bins (§19.5.2).`);
          continue;
        }
        const concrete = expandSequence(seq, max);
        if (!concrete) {
          diagnostics.push(`${decl.name}[]: expands to more than ${MAX_TRANSITION_EXPANSION} sequences; not modelled.`);
          continue;
        }
        for (const c of concrete) {
          const label = c.map(fmt).join("=>");
          push({ name: binDisplayName(decl.name, label), declName: decl.name, kind, transition: true, declaredValues: [], values: [], sequences: [concreteToSequence(c)] });
        }
      }
    } else {
      push({ name: decl.name, declName: decl.name, kind, transition: true, declaredValues: [], values: [], sequences: valid });
    }
  }

  const stateDecls = bins.filter((b) => !b.transition && b.kind !== "default");
  const ignoreValues = new Set(stateDecls.filter((b) => b.kind === "ignore").flatMap((b) => b.declaredValues));
  const illegalValues = new Set(stateDecls.filter((b) => b.kind === "illegal").flatMap((b) => b.declaredValues));

  // §19.5.3: automatic bins when no bins other than ignore/illegal are declared.
  const declaresBins = spec.bins.some((d) => d.form === "default" || d.keyword === "bins");
  let autoBins = false;
  if (!declaresBins) {
    autoBins = true;
    for (const a of automaticBins(spec.width, autoBinMax, enumLabels)) {
      bins.push({ key: key(a.name), name: a.name, declName: "auto", coverpoint: spec.name, kind: "auto", transition: false, declaredValues: a.values, values: a.values, sequences: [], counted: false });
    }
  }

  // §19.5.5 / §19.5.6: removal happens after distribution; empty bins are excluded (§19.11).
  const ignoreConcrete: number[][] = [];
  for (const b of bins) {
    if (!b.transition || (b.kind !== "ignore" && b.kind !== "illegal")) continue;
    for (const seq of b.sequences) {
      const c = expandSequence(seq, max);
      if (c) ignoreConcrete.push(...c);
    }
  }
  for (const b of bins) {
    if (b.kind !== "bins" && b.kind !== "auto") continue;
    if (!b.transition) {
      b.values = b.declaredValues.filter((v) => !ignoreValues.has(v) && !illegalValues.has(v));
      b.counted = b.values.length > 0;
      if (!b.counted) {
        b.excludedReason =
          b.declaredValues.length === 0 ? "it has no values" : "every value it lists is also an ignore_bins or illegal_bins value";
      }
      continue;
    }
    if (ignoreConcrete.length > 0 && b.sequences.every(sequenceIsBounded)) {
      const concrete = b.sequences.flatMap((s) => expandSequence(s, max) ?? []);
      const kept = concrete.filter((c) => !ignoreConcrete.some((ig) => containsRun(c, ig)));
      if (kept.length !== concrete.length) b.sequences = kept.map(concreteToSequence);
    }
    b.counted = b.sequences.length > 0;
    if (!b.counted) b.excludedReason = "every sequence it lists contains an ignored or illegal transition";
  }

  const listedValues = new Set(stateDecls.flatMap((b) => b.declaredValues));
  for (const b of bins) if (b.kind === "auto") b.declaredValues.forEach((v) => listedValues.add(v));

  return { spec, name: spec.name, max, enumLabels, bins, autoBins, atLeast, weight, autoBinMax, diagnostics, listedValues, ignoreValues, illegalValues };
}

// ---------------------------------------------------------------------------
// Classifying one value (state bins, stateless)
// ---------------------------------------------------------------------------

export type ValueOutcome = "hit" | "ignored" | "illegal" | "default" | "none";

export interface ValueClassification {
  value: number;
  outcome: ValueOutcome;
  /** Counted bins that increment. */
  hits: ResolvedBin[];
  illegal: ResolvedBin[];
  ignored: ResolvedBin[];
  /** bins/auto that list the value but lost it to ignore/illegal removal. */
  shadowed: ResolvedBin[];
  defaultBin?: ResolvedBin;
  why: string;
}

export function classifyValue(cp: ElaboratedCoverpoint, value: number): ValueClassification {
  const fmt = (v: number) => formatValue(v, cp.enumLabels);
  const state = cp.bins.filter((b) => !b.transition);
  const illegal = state.filter((b) => b.kind === "illegal" && b.declaredValues.includes(value));
  const ignored = state.filter((b) => b.kind === "ignore" && b.declaredValues.includes(value));
  const shadowed = state.filter((b) => (b.kind === "bins" || b.kind === "auto") && b.declaredValues.includes(value) && !b.values.includes(value));
  const hits = state.filter((b) => (b.kind === "bins" || b.kind === "auto") && b.values.includes(value));
  const defaultBin = state.find((b) => b.kind === "default");
  const v = fmt(value);
  if (illegal.length > 0) {
    const also = shadowed.length > 0 ? ` It is also listed in ${shadowed.map((b) => b.name).join(", ")}, but illegal bins take precedence and remove the value from every other bin.` : "";
    return {
      value,
      outcome: "illegal",
      hits: [],
      illegal,
      ignored,
      shadowed,
      why: `${v} is an illegal_bins value (${illegal[0].name}): the simulator reports a run-time error and no bin counts the sample.${also} Whether simulation stops depends on the tool's error settings (§19.5.6).`,
    };
  }
  if (ignored.length > 0) {
    const also = shadowed.length > 0 ? ` ${shadowed.map((b) => b.name).join(", ")} lists it too, but ignored values are removed from every bin (§19.5.5).` : "";
    return { value, outcome: "ignored", hits: [], illegal, ignored, shadowed, why: `${v} is in ignore_bins ${ignored[0].name}, so the sample is not counted anywhere.${also}` };
  }
  if (hits.length > 0) {
    const names = hits.map((b) => b.name).join(" and ");
    const overlap = hits.length > 1 ? " Overlapping bins each count the same sample." : "";
    return { value, outcome: "hit", hits, illegal, ignored, shadowed, why: `${v} lies in ${names}, so ${hits.length > 1 ? "each" : "it"} increments.${overlap}` };
  }
  if (defaultBin && !cp.listedValues.has(value)) {
    return {
      value,
      outcome: "default",
      hits: [],
      illegal,
      ignored,
      shadowed,
      defaultBin,
      why: `${v} lies outside every other bin, so the default bin ${defaultBin.name} counts it. Default bins never count toward coverage and are not crossed (§19.5).`,
    };
  }
  return {
    value,
    outcome: "none",
    hits: [],
    illegal,
    ignored,
    shadowed,
    why: `${v} lies outside every bin and there is no default bin, so the sample is simply not counted. There is no implicit default bin (§19.5).`,
  };
}

// ---------------------------------------------------------------------------
// Crosses (§19.6)
// ---------------------------------------------------------------------------

export type ProductStatus = "auto" | "user" | "ignored" | "illegal";

export interface CrossProduct {
  key: string;
  /** Report-style name, e.g. `<low,READ>`. */
  label: string;
  /** Bin keys, one per crossed coverpoint. */
  tuple: string[];
  status: ProductStatus;
  /** Name of the bin that counts this product (auto or user), or of the ignore/illegal bin. */
  binName: string;
}

export interface ResolvedCrossBin {
  key: string;
  name: string;
  kind: "auto" | "bins" | "ignore" | "illegal";
  products: string[];
  counted: boolean;
}

export interface ElaboratedCross {
  spec: CrossSpec;
  name: string;
  coverpoints: ElaboratedCoverpoint[];
  /** Counted bins of each crossed coverpoint (default/ignore/illegal/empty bins are not crossed). */
  axes: ResolvedBin[][];
  products: CrossProduct[];
  bins: ResolvedCrossBin[];
  /** Bc: automatically generated cross bins. */
  autoCount: number;
  /** Bu: significant user-defined bins (not ignore/illegal). */
  userCount: number;
  atLeast: number;
  weight: number;
  diagnostics: string[];
}

function binValuesForSelect(bin: ResolvedBin): number[] {
  if (!bin.transition) return bin.values;
  // §19.6.1: binsof uses the last value of a transition.
  return bin.sequences.flatMap((seq) => {
    const last = seq[seq.length - 1];
    return last ? expandRangeList(last.values, Number.MAX_SAFE_INTEGER).values : [];
  });
}

function evaluateSelect(sel: SelectExpr, tuple: ResolvedBin[], crossed: ElaboratedCoverpoint[], diagnostics: string[]): boolean {
  if (sel.op !== "binsof") {
    const l = evaluateSelect(sel.left, tuple, crossed, diagnostics);
    const r = evaluateSelect(sel.right, tuple, crossed, diagnostics);
    return sel.op === "and" ? l && r : l || r;
  }
  const axis = crossed.findIndex((c) => c.name === sel.coverpoint);
  if (axis < 0) {
    const msg = `binsof(${sel.coverpoint}) names a coverpoint that is not part of this cross.`;
    if (!diagnostics.includes(msg)) diagnostics.push(msg);
    return false;
  }
  const bin = tuple[axis];
  let cond = sel.bin === undefined || bin.declName === sel.bin;
  if (cond && sel.intersect) {
    const wanted = new Set(expandRangeList(sel.intersect, crossed[axis].max).values);
    cond = binValuesForSelect(bin).some((v) => wanted.has(v));
  }
  return sel.negate ? !cond : cond;
}

export function elaborateCross(spec: CrossSpec, coverpoints: ElaboratedCoverpoint[], group: { atLeast?: number } = {}): ElaboratedCross {
  const diagnostics: string[] = [];
  const crossed = spec.coverpoints
    .map((name) => {
      const cp = coverpoints.find((c) => c.name === name);
      if (!cp) diagnostics.push(`${spec.name}: ${name} is not a coverpoint of this covergroup.`);
      return cp;
    })
    .filter((c): c is ElaboratedCoverpoint => Boolean(c));
  const axes = crossed.map((cp) => cp.bins.filter((b) => b.counted));
  for (const userBin of spec.bins ?? []) {
    const check = (sel: SelectExpr) => {
      if (sel.op !== "binsof") {
        check(sel.left);
        check(sel.right);
        return;
      }
      if (sel.bin !== undefined) {
        const cp = crossed.find((c) => c.name === sel.coverpoint);
        if (cp && !cp.bins.some((b) => b.declName === sel.bin && b.counted)) {
          diagnostics.push(`${userBin.name}: ${sel.coverpoint}.${sel.bin} is not a counted bin, so it selects nothing.`);
        }
      }
    };
    check(userBin.select);
  }

  // Cartesian product of the counted bins (§19.6).
  let tuples: ResolvedBin[][] = [[]];
  for (const axis of axes) {
    const next: ResolvedBin[][] = [];
    for (const t of tuples) for (const b of axis) next.push([...t, b]);
    tuples = next;
  }
  if (axes.some((a) => a.length === 0)) tuples = [];

  const keyOf = (t: ResolvedBin[]) => t.map((b) => b.key).join("|");
  const nameOf = (t: ResolvedBin[]) => `<${t.map((b) => b.name).join(",")}>`;
  const selections = (spec.bins ?? []).map((b) => ({
    decl: b,
    selected: new Set(tuples.filter((t) => evaluateSelect(b.select, t, crossed, diagnostics)).map(keyOf)),
  }));
  const illegalSet = new Set<string>();
  const ignoreSet = new Set<string>();
  const userAny = new Set<string>();
  for (const s of selections) {
    s.selected.forEach((k) => userAny.add(k));
    if (s.decl.keyword === "illegal_bins") s.selected.forEach((k) => illegalSet.add(k));
    if (s.decl.keyword === "ignore_bins") s.selected.forEach((k) => ignoreSet.add(k));
  }

  const bins: ResolvedCrossBin[] = [];
  const products: CrossProduct[] = [];
  for (const t of tuples) {
    const k = keyOf(t);
    let status: ProductStatus = "auto";
    let binName = nameOf(t);
    if (illegalSet.has(k)) {
      status = "illegal";
      binName = selections.find((s) => s.decl.keyword === "illegal_bins" && s.selected.has(k))?.decl.name ?? binName;
    } else if (ignoreSet.has(k)) {
      status = "ignored";
      binName = selections.find((s) => s.decl.keyword === "ignore_bins" && s.selected.has(k))?.decl.name ?? binName;
    } else if (userAny.has(k)) {
      const owner = selections.find((s) => s.decl.keyword === "bins" && s.selected.has(k));
      status = owner ? "user" : "auto";
      binName = owner?.decl.name ?? binName;
    }
    products.push({ key: k, label: nameOf(t), tuple: t.map((b) => b.key), status, binName });
    // Automatic bins only for products outside every user-defined bin (cross_retain_auto_bins = 1).
    if (!userAny.has(k)) bins.push({ key: `${spec.name}.${nameOf(t)}`, name: nameOf(t), kind: "auto", products: [k], counted: true });
  }
  for (const s of selections) {
    const kind = s.decl.keyword === "bins" ? "bins" : s.decl.keyword === "ignore_bins" ? "ignore" : "illegal";
    // Ignored and illegal products are excluded even from other user bins (§19.6.2, §19.6.3).
    const prods = Array.from(s.selected).filter((k) => kind !== "bins" || (!ignoreSet.has(k) && !illegalSet.has(k)));
    bins.push({ key: `${spec.name}.${s.decl.name}`, name: s.decl.name, kind, products: prods, counted: kind === "bins" && prods.length > 0 });
    if (kind === "bins" && prods.length === 0) diagnostics.push(`${s.decl.name} selects no countable cross product.`);
  }
  const autoCount = bins.filter((b) => b.kind === "auto").length;
  const userCount = bins.filter((b) => b.kind === "bins" && b.counted).length;
  return {
    spec,
    name: spec.name,
    coverpoints: crossed,
    axes,
    products,
    bins,
    autoCount,
    userCount,
    atLeast: spec.atLeast ?? group.atLeast ?? DEFAULT_AT_LEAST,
    weight: spec.weight ?? 1,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Covergroup elaboration and the sampling engine
// ---------------------------------------------------------------------------

export interface ElaboratedCovergroup {
  spec: CovergroupSpec;
  coverpoints: ElaboratedCoverpoint[];
  crosses: ElaboratedCross[];
  diagnostics: string[];
}

export function elaborateCovergroup(spec: CovergroupSpec): ElaboratedCovergroup {
  const coverpoints = spec.coverpoints.map((cp) => elaborateCoverpoint(cp, { atLeast: spec.atLeast, autoBinMax: spec.autoBinMax }));
  const crosses = (spec.crosses ?? []).map((x) => elaborateCross(x, coverpoints, { atLeast: spec.atLeast }));
  return { spec, coverpoints, crosses, diagnostics: [...coverpoints.flatMap((c) => c.diagnostics), ...crosses.flatMap((c) => c.diagnostics)] };
}

export interface CoverageSample {
  values: Record<string, number>;
  /** Optional provenance, e.g. "@(posedge clk)" or "sample()". */
  source?: string;
  /** Optional clock edge the sample belongs to. */
  edge?: number;
}

export interface CoverageError {
  sample: number;
  item: string;
  bin: string;
  message: string;
}

export interface BinCount {
  key: string;
  name: string;
  item: string;
  kind: ResolvedBinKind | "bins" | "auto" | "ignore" | "illegal";
  hits: number;
  counted: boolean;
  covered: boolean;
}

export interface ItemCoverage {
  name: string;
  type: "coverpoint" | "cross";
  covered: number;
  total: number;
  /** 0..100. When the denominator is 0 the item is excluded (§19.11.1 a–d). */
  percent: number;
  excluded: boolean;
  weight: number;
  atLeast: number;
  bins: BinCount[];
}

export interface CoverageSnapshot {
  samples: number;
  items: ItemCoverage[];
  /** Weighted average of included items (§19.11). */
  percent: number;
  errors: CoverageError[];
  /** Hits per cross product key (all statuses), for grid displays. */
  productHits: Record<string, number>;
}

export interface SampleRecord {
  index: number;
  values: Record<string, number>;
  source?: string;
  edge?: number;
  /** Keys of bins that incremented on this sample. */
  hits: string[];
  /** Counted bins that became covered on this sample. */
  newlyCovered: string[];
  /** Cross product keys matched on this sample (any status). */
  products: string[];
  errors: CoverageError[];
  /** Per coverpoint: outcome of the value (state bins). */
  outcomes: Record<string, ValueOutcome | "guarded">;
  percent: number;
}

const isTrue = (values: Record<string, number>, guard?: string) => guard === undefined || Boolean(values[guard]);

function itemPercent(covered: number, total: number, weight: number): { percent: number; excluded: boolean } {
  if (total === 0) return { percent: weight === 0 ? 100 : 0, excluded: true };
  return { percent: (covered / total) * 100, excluded: false };
}

export function groupPercent(items: Pick<ItemCoverage, "percent" | "excluded" | "weight">[]): number {
  const included = items.filter((i) => !i.excluded);
  const totalWeight = included.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) return 0;
  return included.reduce((s, i) => s + i.weight * i.percent, 0) / totalWeight;
}

export interface CoverageAccumulator {
  apply(sample: CoverageSample): SampleRecord;
  snapshot(): CoverageSnapshot;
  hitCount(binKey: string): number;
}

/** Stateful accumulator over an elaborated covergroup. Deterministic: same samples → same result. */
export function createCoverageAccumulator(model: ElaboratedCovergroup): CoverageAccumulator {
  const hits = new Map<string, number>();
  const productHits = new Map<string, number>();
  const threads = new Map<string, Set<ThreadState>>();
  const compiled = new Map<string, CompiledSequence[]>();
  for (const cp of model.coverpoints) {
    for (const b of cp.bins) {
      if (b.transition) {
        compiled.set(b.key, b.sequences.map((s) => compileSequence(s, cp.max)));
        threads.set(b.key, new Set());
      }
    }
  }
  const errors: CoverageError[] = [];
  let count = 0;

  const coverpointBinCounts = (cp: ElaboratedCoverpoint): BinCount[] =>
    cp.bins.map((b) => {
      const h = hits.get(b.key) ?? 0;
      return { key: b.key, name: b.name, item: cp.name, kind: b.kind, hits: h, counted: b.counted, covered: b.counted && h >= cp.atLeast };
    });
  const crossBinCounts = (x: ElaboratedCross): BinCount[] =>
    x.bins.map((b) => {
      const h = hits.get(b.key) ?? 0;
      return { key: b.key, name: b.name, item: x.name, kind: b.kind, hits: h, counted: b.counted, covered: b.counted && h >= x.atLeast };
    });

  const snapshot = (): CoverageSnapshot => {
    const items: ItemCoverage[] = [];
    for (const cp of model.coverpoints) {
      const bins = coverpointBinCounts(cp);
      const total = bins.filter((b) => b.counted).length;
      const covered = bins.filter((b) => b.covered).length;
      items.push({ name: cp.name, type: "coverpoint", covered, total, ...itemPercent(covered, total, cp.weight), weight: cp.weight, atLeast: cp.atLeast, bins });
    }
    for (const x of model.crosses) {
      const bins = crossBinCounts(x);
      const total = x.autoCount + x.userCount; // §19.11.2: Bc + Bu
      const covered = bins.filter((b) => b.covered).length;
      items.push({ name: x.name, type: "cross", covered, total, ...itemPercent(covered, total, x.weight), weight: x.weight, atLeast: x.atLeast, bins });
    }
    return { samples: count, items, percent: groupPercent(items), errors: [...errors], productHits: Object.fromEntries(productHits) };
  };

  const isCovered = (key: string, atLeast: number) => (hits.get(key) ?? 0) >= atLeast;

  const apply = (sample: CoverageSample): SampleRecord => {
    const index = count;
    count += 1;
    const record: SampleRecord = { index, values: sample.values, source: sample.source, edge: sample.edge, hits: [], newlyCovered: [], products: [], errors: [], outcomes: {}, percent: 0 };
    const bump = (key: string, atLeast: number, counted: boolean) => {
      const before = hits.get(key) ?? 0;
      hits.set(key, before + 1);
      record.hits.push(key);
      if (counted && before + 1 === atLeast) record.newlyCovered.push(key);
    };
    const raise = (item: string, bin: string, message: string) => {
      const e = { sample: index, item, bin, message };
      errors.push(e);
      record.errors.push(e);
    };

    // Coverpoint bins matched on this sample (counted ones feed the crosses).
    const matched = new Map<string, ResolvedBin[]>();
    for (const cp of model.coverpoints) {
      if (!isTrue(sample.values, cp.spec.iff)) {
        record.outcomes[cp.name] = "guarded";
        matched.set(cp.name, []);
        continue;
      }
      const v = sample.values[cp.spec.expr];
      const counted: ResolvedBin[] = [];
      if (v === undefined) {
        matched.set(cp.name, []);
        continue;
      }
      const cls = classifyValue(cp, v);
      record.outcomes[cp.name] = cls.outcome;
      if (cls.outcome === "illegal") {
        cls.illegal.forEach((b) => bump(b.key, cp.atLeast, false));
        raise(cp.name, cls.illegal[0].name, `illegal_bins ${cp.name}.${cls.illegal[0].name} hit by ${cp.spec.expr} = ${formatValue(v, cp.enumLabels)}`);
      } else if (cls.outcome === "ignored") {
        cls.ignored.forEach((b) => bump(b.key, cp.atLeast, false));
      } else if (cls.outcome === "hit") {
        cls.hits.forEach((b) => {
          bump(b.key, cp.atLeast, b.counted);
          counted.push(b);
        });
      } else if (cls.outcome === "default" && cls.defaultBin) {
        bump(cls.defaultBin.key, cp.atLeast, false);
      }
      // Transition bins (§19.5.2): at most one increment per bin per sample.
      for (const b of cp.bins) {
        if (!b.transition) continue;
        const seqs = compiled.get(b.key) ?? [];
        const { next, completed } = stepTransition(seqs, threads.get(b.key) ?? new Set(), v);
        threads.set(b.key, next);
        if (!completed) continue;
        if (b.kind === "illegal") {
          bump(b.key, cp.atLeast, false);
          raise(cp.name, b.name, `illegal transition ${cp.name}.${b.name} completed at ${cp.spec.expr} = ${formatValue(v, cp.enumLabels)}`);
        } else if (b.kind === "ignore") {
          bump(b.key, cp.atLeast, false);
        } else if (b.counted) {
          bump(b.key, cp.atLeast, true);
          counted.push(b);
        }
      }
      matched.set(cp.name, counted);
    }

    // Crosses: every crossed coverpoint must match a counted bin (§19.6.1).
    for (const x of model.crosses) {
      if (!isTrue(sample.values, x.spec.iff)) continue;
      const lists = x.coverpoints.map((cp) => matched.get(cp.name) ?? []);
      if (lists.some((l) => l.length === 0)) continue;
      let tuples: string[][] = [[]];
      for (const l of lists) {
        const next: string[][] = [];
        for (const t of tuples) for (const b of l) next.push([...t, b.key]);
        tuples = next;
      }
      const productKeys = tuples.map((t) => t.join("|"));
      const touched = new Set<string>();
      for (const pk of productKeys) {
        const product = x.products.find((p) => p.key === pk);
        if (!product) continue;
        record.products.push(pk);
        productHits.set(pk, (productHits.get(pk) ?? 0) + 1);
        if (product.status === "illegal") {
          const ill = x.bins.find((b) => b.kind === "illegal" && b.products.includes(pk));
          if (ill && !touched.has(ill.key)) {
            touched.add(ill.key);
            bump(ill.key, x.atLeast, false);
            raise(x.name, ill.name, `illegal cross bin ${x.name}.${ill.name} hit by ${product.label}`);
          }
          continue;
        }
        if (product.status === "ignored") {
          const ign = x.bins.find((b) => b.kind === "ignore" && b.products.includes(pk));
          if (ign && !touched.has(ign.key)) {
            touched.add(ign.key);
            bump(ign.key, x.atLeast, false);
          }
          continue;
        }
        for (const b of x.bins) {
          if (!b.counted || touched.has(b.key) || !b.products.includes(pk)) continue;
          touched.add(b.key);
          bump(b.key, x.atLeast, true);
        }
      }
    }
    record.percent = snapshot().percent;
    return record;
  };

  return { apply, snapshot, hitCount: (k) => hits.get(k) ?? 0 };
}

/** Runs a list of samples and returns the per-sample records and the final snapshot. */
export function runCoverage(model: ElaboratedCovergroup, samples: CoverageSample[]): { records: SampleRecord[]; final: CoverageSnapshot } {
  const acc = createCoverageAccumulator(model);
  const records = samples.map((s) => acc.apply(s));
  return { records, final: acc.snapshot() };
}

/** Is every counted bin of every weighted, included item covered? */
export function isClosed(snapshot: CoverageSnapshot): boolean {
  const relevant = snapshot.items.filter((i) => !i.excluded && i.weight > 0);
  return relevant.length > 0 && relevant.every((i) => i.covered === i.total);
}

// ---------------------------------------------------------------------------
// Type coverage across instances (§19.11.3)
// ---------------------------------------------------------------------------

export interface InstanceResult {
  snapshot: CoverageSnapshot;
  /** Instance option.weight (default 1). */
  weight?: number;
}

export function typeCoverage(instances: InstanceResult[], opts: { mergeInstances: boolean }): number {
  if (instances.length === 0) return 0;
  if (!opts.mergeInstances) {
    const totalWeight = instances.reduce((s, i) => s + (i.weight ?? 1), 0);
    if (totalWeight === 0) return 0;
    return instances.reduce((s, i) => s + (i.weight ?? 1) * i.snapshot.percent, 0) / totalWeight;
  }
  // Union of bins by name; counts add; covered when count >= max(at_least) of all instances.
  const itemNames = Array.from(new Set(instances.flatMap((i) => i.snapshot.items.map((it) => it.name))));
  const merged = itemNames.map((name) => {
    const versions = instances.map((i) => i.snapshot.items.find((it) => it.name === name)).filter((x): x is ItemCoverage => Boolean(x));
    const atLeast = Math.max(...versions.map((v) => v.atLeast));
    const counts = new Map<string, number>();
    for (const v of versions) for (const b of v.bins) if (b.counted) counts.set(b.name, (counts.get(b.name) ?? 0) + b.hits);
    const total = counts.size;
    const covered = Array.from(counts.values()).filter((h) => h >= atLeast).length;
    const weight = versions[0]?.weight ?? 1;
    return { ...itemPercent(covered, total, weight), weight };
  });
  return groupPercent(merged);
}

// ---------------------------------------------------------------------------
// Sampling a clocked trace (§19.3)
// ---------------------------------------------------------------------------

export type SamplingMode =
  /** `covergroup cg @(posedge clk);` — one sample per edge. */
  | "clock"
  /** Clocked covergroup plus a manual `cg.sample()` on valid edges — two samples on those edges. */
  | "clock+sample"
  /** `with function sample(...)`, called by a monitor once per valid transfer. */
  | "sample-on-valid";

/**
 * Turns an edge-sampled trace (`signals[name][k]` = value held just before
 * edge k) into covergroup samples. A clocking event samples every time it
 * fires, exactly as if the triggering process called sample() (§19.3), so a
 * manual sample() on the same edge counts a second time.
 */
export function samplesFromClockedTrace(signals: Record<string, number[]>, edges: number, mode: SamplingMode, valid = "valid"): CoverageSample[] {
  const out: CoverageSample[] = [];
  for (let k = 0; k < edges; k += 1) {
    const values: Record<string, number> = {};
    for (const [name, vals] of Object.entries(signals)) values[name] = vals[k] ?? 0;
    const isValid = Boolean(values[valid]);
    if (mode === "clock" || mode === "clock+sample") out.push({ values, edge: k, source: "@(posedge clk)" });
    if ((mode === "clock+sample" || mode === "sample-on-valid") && isValid) out.push({ values, edge: k, source: "sample()" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seeded stimulus (dist weights, excluded combinations)
// ---------------------------------------------------------------------------

export interface StimulusVar {
  name: string;
  width?: number;
  enumLabels?: string[];
}

export interface DistItem {
  values: RangeItem;
  weight: number;
  /** `:=` weight per value; `:/` weight shared across the range (§18.5.4). */
  op: ":=" | ":/";
}

export interface ExcludeTerm {
  var: string;
  values: RangeItem[];
}

export interface StimulusSpec {
  vars: StimulusVar[];
  /** Missing → uniform over the variable's domain. A dist also restricts the variable to the listed values. */
  dist?: Record<string, DistItem[]>;
  /** Each entry is a conjunction; a combination matching every term is never generated. */
  exclude?: ExcludeTerm[][];
}

export interface StimulusOutcome {
  values: Record<string, number>;
  p: number;
}

/** Small deterministic LCG (Numerical Recipes constants); returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function varWeights(v: StimulusVar, dist: DistItem[] | undefined): number[] {
  const max = domainMax(v.width ?? 1, v.enumLabels);
  const w = new Array<number>(max + 1).fill(dist ? 0 : 1);
  if (!dist) return w;
  for (const item of dist) {
    const { values } = expandRangeList([item.values], max);
    const each = item.op === ":=" ? item.weight : item.weight / Math.max(1, values.length);
    for (const value of values) w[value] += each;
  }
  return w;
}

/** Exact joint distribution: product of per-variable dist weights, excluded combinations removed, renormalised. */
export function stimulusDistribution(spec: StimulusSpec): { outcomes: StimulusOutcome[]; unsatisfiable: boolean } {
  const weights = spec.vars.map((v) => varWeights(v, spec.dist?.[v.name]));
  let combos: { values: Record<string, number>; w: number }[] = [{ values: {}, w: 1 }];
  spec.vars.forEach((v, i) => {
    const next: { values: Record<string, number>; w: number }[] = [];
    for (const c of combos) {
      weights[i].forEach((w, value) => {
        if (w > 0) next.push({ values: { ...c.values, [v.name]: value }, w: c.w * w });
      });
    }
    combos = next;
  });
  const excluded = (values: Record<string, number>) =>
    (spec.exclude ?? []).some((conj) =>
      conj.every((term) => {
        const max = domainMax(spec.vars.find((x) => x.name === term.var)?.width ?? 32, spec.vars.find((x) => x.name === term.var)?.enumLabels);
        return expandRangeList(term.values, max).values.includes(values[term.var]);
      }),
    );
  const kept = combos.filter((c) => !excluded(c.values));
  const total = kept.reduce((s, c) => s + c.w, 0);
  if (total === 0) return { outcomes: [], unsatisfiable: true };
  return { outcomes: kept.map((c) => ({ values: c.values, p: c.w / total })), unsatisfiable: false };
}

/** Draws `count` samples from the exact distribution with a seeded RNG. */
export function generateStimulus(spec: StimulusSpec, count: number, seed: number): CoverageSample[] {
  const { outcomes } = stimulusDistribution(spec);
  if (outcomes.length === 0) return [];
  const cumulative: number[] = [];
  let acc = 0;
  for (const o of outcomes) {
    acc += o.p;
    cumulative.push(acc);
  }
  const rng = createRng(seed);
  const out: CoverageSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = rng() * acc;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    out.push({ values: { ...outcomes[lo].values }, source: "randomize()" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Closure forecast (coupon collector with unequal probabilities)
// ---------------------------------------------------------------------------

export interface ClosureTarget {
  key: string;
  name: string;
  item: string;
  /** Probability that one random sample hits this bin. */
  p: number;
  atLeast: number;
}

export interface ClosureForecast {
  /** Every counted bin of every weighted item. */
  targets: ClosureTarget[];
  /** The targets that actually gate closure (bins implied by others removed). */
  gating: ClosureTarget[];
  unreachable: ClosureTarget[];
  /** Expected samples until every target is covered; Infinity when a target is unreachable. */
  expectedSamples: number;
  /** k · H_k for k gating bins: the uniform coupon-collector number. */
  couponBaseline: number;
  method: "exact" | "approximate";
  /** P(closed within n samples). */
  probabilityWithin: (n: number) => number;
}

export function harmonic(k: number): number {
  let h = 0;
  for (let i = 1; i <= k; i += 1) h += 1 / i;
  return h;
}

function poissonAtLeast(lambda: number, m: number): number {
  if (m <= 0) return 1;
  let term = Math.exp(-lambda);
  let below = term;
  for (let j = 1; j < m; j += 1) {
    term *= lambda / j;
    below += term;
  }
  return Math.max(0, 1 - below);
}

/**
 * Expected samples to see every target `atLeast` times when targets are
 * disjoint (each sample hits at most one): E = ∫ (1 − Π P(Pois(p_i t) ≥ m_i)) dt,
 * exact by Poissonisation. Composite Simpson rule.
 */
export function expectedSamplesDisjoint(targets: { p: number; atLeast: number }[]): number {
  if (targets.length === 0) return 0;
  if (targets.some((t) => t.p <= 0)) return Infinity;
  const pMin = Math.min(...targets.map((t) => t.p));
  const mMax = Math.max(...targets.map((t) => t.atLeast));
  const tMax = (mMax + 45) / pMin;
  const n = 6000;
  const h = tMax / n;
  const f = (t: number) => 1 - targets.reduce((prod, x) => prod * poissonAtLeast(x.p * t, x.atLeast), 1);
  let sum = f(0) + f(tMax);
  for (let i = 1; i < n; i += 1) sum += (i % 2 === 0 ? 2 : 4) * f(i * h);
  return (sum * h) / 3;
}

/**
 * Exact expectation for at_least = 1 when targets may overlap:
 * E = Σ_{S≠∅} (−1)^{|S|+1} / P(a sample hits some target in S).
 * `signatures` maps a bitmask of hit targets to its probability.
 */
export function expectedSamplesInclusionExclusion(k: number, signatures: Map<number, number>): number {
  let e = 0;
  const sigs = Array.from(signatures.entries());
  for (let s = 1; s < 1 << k; s += 1) {
    let p = 0;
    for (const [mask, pm] of sigs) if (mask & s) p += pm;
    if (p <= 0) return Infinity;
    const bits = popcount(s);
    e += (bits % 2 === 1 ? 1 : -1) / p;
  }
  return e;
}

function popcount(x: number): number {
  let c = 0;
  let v = x;
  while (v) {
    v &= v - 1;
    c += 1;
  }
  return c;
}

/** Which counted bins a single sample hits, ignoring transitions and history. */
export function binsHitBySample(model: ElaboratedCovergroup, values: Record<string, number>): string[] {
  const acc = createCoverageAccumulator(model);
  const rec = acc.apply({ values });
  const counted = new Set<string>();
  for (const cp of model.coverpoints) for (const b of cp.bins) if (b.counted && !b.transition) counted.add(b.key);
  for (const x of model.crosses) for (const b of x.bins) if (b.counted) counted.add(b.key);
  return rec.hits.filter((k) => counted.has(k));
}

export function forecastClosure(model: ElaboratedCovergroup, stimulus: StimulusSpec): ClosureForecast {
  const { outcomes } = stimulusDistribution(stimulus);
  const targets: ClosureTarget[] = [];
  for (const cp of model.coverpoints) {
    if (cp.weight === 0) continue;
    for (const b of cp.bins) if (b.counted && !b.transition) targets.push({ key: b.key, name: b.name, item: cp.name, p: 0, atLeast: cp.atLeast });
  }
  for (const x of model.crosses) {
    if (x.weight === 0) continue;
    for (const b of x.bins) if (b.counted) targets.push({ key: b.key, name: b.name, item: x.name, p: 0, atLeast: x.atLeast });
  }
  const index = new Map(targets.map((t, i) => [t.key, i]));
  const hitSets: Set<number>[] = targets.map(() => new Set());
  const outcomeTargets: number[][] = outcomes.map((o, oi) => {
    const ids = binsHitBySample(model, o.values)
      .map((k) => index.get(k))
      .filter((i): i is number => i !== undefined);
    ids.forEach((i) => {
      targets[i].p += o.p;
      hitSets[i].add(oi);
    });
    return ids;
  });

  const unreachable = targets.filter((t) => t.p <= 1e-15);
  // Prune targets implied by another: if every sample hitting B also hits A, covering B covers A.
  const subset = (a: Set<number>, b: Set<number>) => Array.from(a).every((x) => b.has(x));
  const gatingIdx = targets
    .map((_, i) => i)
    .filter((i) => {
      if (targets[i].p <= 1e-15) return true;
      return !targets.some((t, j) => j !== i && t.p > 1e-15 && t.atLeast >= targets[i].atLeast && subset(hitSets[j], hitSets[i]) && (hitSets[j].size < hitSets[i].size || j < i));
    });
  const gating = gatingIdx.map((i) => targets[i]);
  const k = gating.length;
  const couponBaseline = k * harmonic(k);

  if (unreachable.length > 0) {
    return { targets, gating, unreachable, expectedSamples: Infinity, couponBaseline, method: "exact", probabilityWithin: () => 0 };
  }
  const disjoint = gatingIdx.every((i, a) => gatingIdx.every((j, b) => b <= a || Array.from(hitSets[i]).every((x) => !hitSets[j].has(x))));
  const allOnce = gating.every((t) => t.atLeast === 1);
  const signatures = new Map<number, number>();
  if (k <= 16) {
    outcomes.forEach((o, oi) => {
      let mask = 0;
      gatingIdx.forEach((ti, bit) => {
        if (outcomeTargets[oi].includes(ti)) mask |= 1 << bit;
      });
      signatures.set(mask, (signatures.get(mask) ?? 0) + o.p);
    });
  }
  let expectedSamples: number;
  let method: ClosureForecast["method"] = "exact";
  if (disjoint) expectedSamples = expectedSamplesDisjoint(gating);
  else if (k <= 16 && allOnce) expectedSamples = expectedSamplesInclusionExclusion(k, signatures);
  else {
    expectedSamples = expectedSamplesDisjoint(gating);
    method = "approximate";
  }

  const probabilityWithin = (n: number): number => {
    if (k === 0) return 1;
    if (k <= 16 && allOnce) {
      // P(T ≤ n) = Σ_S (−1)^{|S|} (1 − P(∪S))^n
      let total = 0;
      const sigs = Array.from(signatures.entries());
      for (let s = 0; s < 1 << k; s += 1) {
        let p = 0;
        for (const [mask, pm] of sigs) if (mask & s) p += pm;
        total += (popcount(s) % 2 === 0 ? 1 : -1) * Math.pow(Math.max(0, 1 - p), n);
      }
      return Math.min(1, Math.max(0, total));
    }
    return gating.reduce((prod, t) => prod * poissonAtLeast(t.p * n, t.atLeast), 1);
  };

  return { targets, gating, unreachable, expectedSamples, couponBaseline, method, probabilityWithin };
}

// ---------------------------------------------------------------------------
// SystemVerilog source generation (kept in sync with the model data)
// ---------------------------------------------------------------------------

export function formatRangeItem(item: RangeItem, enumLabels?: string[]): string {
  if (typeof item === "number") return formatValue(item, enumLabels);
  if (item[0] === item[1]) return formatValue(item[0], enumLabels);
  if (enumLabels) {
    const out: string[] = [];
    for (let v = item[0]; v <= item[1]; v += 1) out.push(formatValue(v, enumLabels));
    return out.join(", ");
  }
  return `[${item[0]}:${item[1]}]`;
}

export function formatRangeList(items: readonly RangeItem[], enumLabels?: string[]): string {
  return `{${items.map((i) => formatRangeItem(i, enumLabels)).join(", ")}}`;
}

export function binDeclToSource(decl: BinDecl, enumLabels?: string[]): string {
  if (decl.form === "default") return `bins ${decl.name} = default;`;
  const arr = decl.array === undefined ? "" : decl.array === "open" ? "[]" : `[${decl.array}]`;
  if (decl.form === "values") return `${decl.keyword} ${decl.name}${arr} = ${formatRangeList(decl.values, enumLabels)};`;
  if (decl.form === "wildcard") return `wildcard ${decl.keyword} ${decl.name}${arr} = {${decl.pattern}};`;
  return `${decl.keyword} ${decl.name}${arr} = ${decl.sequences.map((s) => `(${formatTransition(s, enumLabels)})`).join(", ")};`;
}

export function selectToSource(sel: SelectExpr, coverpoints: Pick<CoverpointSpec, "name" | "enumLabels">[], parentOp?: "and" | "or"): string {
  if (sel.op !== "binsof") {
    const text = `${selectToSource(sel.left, coverpoints, sel.op)} ${sel.op === "and" ? "&&" : "||"} ${selectToSource(sel.right, coverpoints, sel.op)}`;
    return parentOp && parentOp !== sel.op ? `(${text})` : text;
  }
  const cp = coverpoints.find((c) => c.name === sel.coverpoint);
  const target = sel.bin ? `${sel.coverpoint}.${sel.bin}` : sel.coverpoint;
  const intersect = sel.intersect ? ` intersect ${formatRangeList(sel.intersect, cp?.enumLabels)}` : "";
  return `${sel.negate ? "! " : ""}binsof(${target})${intersect}`;
}

export function coverpointToSource(cp: CoverpointSpec): string[] {
  const head = `${cp.name}: coverpoint ${cp.expr}${cp.iff ? ` iff (${cp.iff})` : ""}`;
  const body: string[] = [];
  if (cp.weight !== undefined && cp.weight !== 1) body.push(`option.weight = ${cp.weight};`);
  if (cp.autoBinMax !== undefined) body.push(`option.auto_bin_max = ${cp.autoBinMax};`);
  if (cp.atLeast !== undefined) body.push(`option.at_least = ${cp.atLeast};`);
  for (const b of cp.bins) body.push(binDeclToSource(b, cp.enumLabels));
  if (body.length === 0) return [`${head};`];
  return [`${head} {`, ...body.map((l) => `  ${l}`), "}"];
}

export function crossToSource(x: CrossSpec, coverpoints: Pick<CoverpointSpec, "name" | "enumLabels">[]): string[] {
  const head = `${x.name}: cross ${x.coverpoints.join(", ")}${x.iff ? ` iff (${x.iff})` : ""}`;
  const body: string[] = [];
  if (x.weight !== undefined && x.weight !== 1) body.push(`option.weight = ${x.weight};`);
  if (x.atLeast !== undefined) body.push(`option.at_least = ${x.atLeast};`);
  for (const b of x.bins ?? []) body.push(`${b.keyword} ${b.name} = ${selectToSource(b.select, coverpoints)};`);
  if (body.length === 0) return [`${head};`];
  return [`${head} {`, ...body.map((l) => `  ${l}`), "}"];
}

export function covergroupToSource(spec: CovergroupSpec): string[] {
  const ev = spec.event ?? { kind: "none" };
  const header =
    ev.kind === "clock" ? `covergroup ${spec.name} @(${ev.expr});` : ev.kind === "sample" ? `covergroup ${spec.name} with function sample(${ev.args});` : `covergroup ${spec.name};`;
  const lines = [header];
  if (spec.perInstance) lines.push("  option.per_instance = 1;");
  if (spec.autoBinMax !== undefined) lines.push(`  option.auto_bin_max = ${spec.autoBinMax};`);
  if (spec.atLeast !== undefined) lines.push(`  option.at_least = ${spec.atLeast};`);
  for (const cp of spec.coverpoints) lines.push(...coverpointToSource(cp).map((l) => `  ${l}`));
  for (const x of spec.crosses ?? []) lines.push(...crossToSource(x, spec.coverpoints).map((l) => `  ${l}`));
  lines.push("endgroup");
  return lines;
}

export function stimulusToSource(spec: StimulusSpec): string[] {
  const lines: string[] = [];
  const fmtTerm = (term: ExcludeTerm) => {
    const v = spec.vars.find((x) => x.name === term.var);
    if (term.values.length === 1 && typeof term.values[0] === "number") return `${term.var} == ${formatValue(term.values[0], v?.enumLabels)}`;
    return `${term.var} inside ${formatRangeList(term.values, v?.enumLabels)}`;
  };
  for (const v of spec.vars) {
    const dist = spec.dist?.[v.name];
    if (!dist) continue;
    lines.push(`  ${v.name} dist {${dist.map((d) => `${formatRangeItem(d.values, v.enumLabels)} ${d.op} ${d.weight}`).join(", ")}};`);
  }
  for (const conj of spec.exclude ?? []) lines.push(`  !(${conj.map(fmtTerm).join(" && ")});`);
  const names = spec.vars.map((v) => v.name).join(", ");
  if (lines.length === 0) return [`void'(std::randomize(${names}));`];
  return [`void'(std::randomize(${names}) with {`, ...lines, "});"];
}

// ---------------------------------------------------------------------------
// Text parsing for the compact bins editor
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(token: string, max: number, enumLabels?: string[]): number | null {
  const t = token.trim();
  if (t === "$") return max;
  if (enumLabels) {
    const i = enumLabels.indexOf(t);
    if (i >= 0) return i;
  }
  if (/^\d+$/.test(t)) return Number(t);
  const sized = /^(\d*)\s*'\s*([bBhHdD])\s*([0-9a-fA-F_]+)$/.exec(t);
  if (sized) {
    const base = sized[2].toLowerCase() === "b" ? 2 : sized[2].toLowerCase() === "h" ? 16 : 10;
    const n = parseInt(sized[3].replace(/_/g, ""), base);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Parses `[0:3], 7, [12:$]` (braces optional). */
export function parseRangeListText(text: string, max: number, enumLabels?: string[]): ParseResult<RangeItem[]> {
  const body = text.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!body) return { ok: false, error: "List at least one value or range" };
  const items: RangeItem[] = [];
  const re = /\[\s*([^\]:]+?)\s*:\s*([^\]]+?)\s*\]|([^,\s][^,]*)/g;
  let m: RegExpExecArray | null;
  const parts = body.split(",").map((p) => p.trim());
  if (parts.some((p) => p === "")) return { ok: false, error: "Remove the empty entry between commas" };
  while ((m = re.exec(body)) !== null) {
    if (m[1] !== undefined) {
      const lo = parseNumber(m[1], max, enumLabels);
      const hi = parseNumber(m[2], max, enumLabels);
      if (lo === null || hi === null) return { ok: false, error: `Cannot read the range [${m[1]}:${m[2]}]` };
      if (lo > hi) return { ok: false, error: `[${m[1]}:${m[2]}] is empty: write the low bound first` };
      items.push([lo, hi]);
    } else if (m[3] !== undefined) {
      const tok = m[3].trim();
      if (!tok) continue;
      const v = parseNumber(tok, max, enumLabels);
      if (v === null) return { ok: false, error: `Cannot read "${tok}"` };
      items.push(v);
    }
  }
  if (items.length === 0) return { ok: false, error: "List at least one value or range" };
  const outside = items.flatMap((i) => (typeof i === "number" ? [i] : [i[0], i[1]])).filter((v) => v < 0 || v > max);
  if (outside.length > 0) return { ok: false, error: `Values must be within 0..${max}` };
  return { ok: true, value: items };
}

/** Parses `(0 => 1 => 2), (5 [* 3]), (8 => 9 [-> 2] => 10)`. */
export function parseTransitionText(text: string, max: number, enumLabels?: string[]): ParseResult<TransSequence[]> {
  const body = text.trim();
  if (!body) return { ok: false, error: "Write a transition such as (1 => 2)" };
  const groups: string[] = [];
  if (body.startsWith("(")) {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (c === "(") {
        if (depth === 0) start = i + 1;
        depth += 1;
      } else if (c === ")") {
        depth -= 1;
        if (depth === 0) groups.push(body.slice(start, i));
        if (depth < 0) return { ok: false, error: "Unbalanced parentheses" };
      } else if (depth === 0 && c !== "," && c.trim() !== "") {
        return { ok: false, error: "Separate transition sets with commas: (a => b), (c => d)" };
      }
    }
    if (depth !== 0) return { ok: false, error: "Unbalanced parentheses" };
  } else {
    groups.push(body);
  }
  const sequences: TransSequence[] = [];
  for (const g of groups) {
    const seq: TransSequence = [];
    for (const part of g.split("=>")) {
      const rep = /\[\s*(\*|->|=)\s*(\d+)\s*(?::\s*(\d+)\s*)?\]\s*$/.exec(part);
      let listText = part;
      let repeat: TransRepeat | undefined;
      if (rep) {
        if (rep[1] === "=") return { ok: false, error: "Nonconsecutive repetition [= n] is not modelled here" };
        const min = Number(rep[2]);
        const maxRep = rep[3] !== undefined ? Number(rep[3]) : min;
        if (min < 1 || maxRep < min) return { ok: false, error: "Repetition counts must be 1 or more, low first" };
        repeat = { op: rep[1] === "*" ? "*" : "->", min, max: maxRep };
        listText = part.slice(0, rep.index);
      }
      const list = parseRangeListText(listText, max, enumLabels);
      if (!list.ok) return list;
      seq.push(repeat ? { values: list.value, repeat } : { values: list.value });
    }
    sequences.push(seq);
  }
  return { ok: true, value: sequences };
}

export function isIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// ---------------------------------------------------------------------------
// Presets used by the coverage visuals
// ---------------------------------------------------------------------------

export const OP_LABELS = ["READ", "WRITE", "BURST"];
export const OP_TYPEDEF = "typedef enum bit [1:0] {READ, WRITE, BURST} op_t;";
export const EXPLORER_SAMPLE_ARGS = "bit [5:0] addr, op_t op";

export type AddrPresetId = "ranges" | "fixed" | "auto" | "corners";
export type OpPresetId = "auto" | "named" | "rw";
export type StimulusPresetId = "uniform" | "biased" | "hole";

export interface CoverpointPreset {
  label: string;
  summary: string;
  spec: CoverpointSpec;
}

export const addrPresets: Record<AddrPresetId, CoverpointPreset> = {
  ranges: {
    label: "3 named ranges",
    summary: "bins low, mid, high: one bin per range.",
    spec: {
      name: "cp_addr",
      expr: "addr",
      width: 6,
      bins: [
        { form: "values", keyword: "bins", name: "low", values: [[0, 15]] },
        { form: "values", keyword: "bins", name: "mid", values: [[16, 47]] },
        { form: "values", keyword: "bins", name: "high", values: [[48, 63]] },
      ],
    },
  },
  fixed: {
    label: "quad[4] array",
    summary: "bins quad[4] = {[0:63]} splits 64 values into 4 bins of 16 (§19.5.1).",
    spec: { name: "cp_addr", expr: "addr", width: 6, bins: [{ form: "values", keyword: "bins", name: "quad", array: 4, values: [[0, 63]] }] },
  },
  auto: {
    label: "auto bins (max 4)",
    summary: "No bins declared, option.auto_bin_max = 4: SystemVerilog creates auto[0:15] … auto[48:63] (§19.5.3).",
    spec: { name: "cp_addr", expr: "addr", width: 6, autoBinMax: 4, bins: [] },
  },
  corners: {
    label: "corners + default",
    summary: "Only 0 and 63 are bins; every other address falls in the default bin, which is neither counted nor crossed.",
    spec: {
      name: "cp_addr",
      expr: "addr",
      width: 6,
      bins: [
        { form: "values", keyword: "bins", name: "zero", values: [0] },
        { form: "values", keyword: "bins", name: "max", values: [63] },
        { form: "default", name: "others" },
      ],
    },
  },
};

export const opPresets: Record<OpPresetId, CoverpointPreset> = {
  auto: {
    label: "auto (enum)",
    summary: "cp_op: coverpoint op; gets one automatic bin per enum constant.",
    spec: { name: "cp_op", expr: "op", width: 2, enumLabels: OP_LABELS, bins: [] },
  },
  named: {
    label: "named bins",
    summary: "bins rd, wr, burst: one named bin per operation.",
    spec: {
      name: "cp_op",
      expr: "op",
      width: 2,
      enumLabels: OP_LABELS,
      bins: [
        { form: "values", keyword: "bins", name: "rd", values: [0] },
        { form: "values", keyword: "bins", name: "wr", values: [1] },
        { form: "values", keyword: "bins", name: "burst", values: [2] },
      ],
    },
  },
  rw: {
    label: "reads vs writes",
    summary: "Two bins: reads = {READ}, writes = {WRITE, BURST}.",
    spec: {
      name: "cp_op",
      expr: "op",
      width: 2,
      enumLabels: OP_LABELS,
      bins: [
        { form: "values", keyword: "bins", name: "reads", values: [0] },
        { form: "values", keyword: "bins", name: "writes", values: [1, 2] },
      ],
    },
  },
};

const explorerVars: StimulusVar[] = [
  { name: "addr", width: 6 },
  { name: "op", width: 2, enumLabels: OP_LABELS },
];

export const stimulusPresets: Record<StimulusPresetId, { label: string; summary: string; spec: StimulusSpec }> = {
  uniform: {
    label: "uniform",
    summary: "Plain std::randomize(): every address and every operation equally likely.",
    spec: { vars: explorerVars },
  },
  biased: {
    label: "biased (dist)",
    summary: "Mostly low addresses and reads; BURST to the high region is 1 sample in 200.",
    spec: {
      vars: explorerVars,
      dist: {
        addr: [
          { values: [0, 15], weight: 60, op: ":/" },
          { values: [16, 47], weight: 35, op: ":/" },
          { values: [48, 63], weight: 5, op: ":/" },
        ],
        op: [
          { values: 0, weight: 6, op: ":=" },
          { values: 1, weight: 3, op: ":=" },
          { values: 2, weight: 1, op: ":=" },
        ],
      },
    },
  },
  hole: {
    label: "constrained (hole)",
    summary: "A constraint forbids BURST to addresses 48..63, so that combination is never generated.",
    spec: { vars: explorerVars, exclude: [[{ var: "addr", values: [[48, 63]] }, { var: "op", values: [2] }]] },
  },
};

export type CellMark = "ignore" | "illegal";

/** Short identifier fragment for a bin: `quad[2]` → `quad2`, `auto[0:15]` → `a0_15`, `auto[READ]` → `READ`. */
export function binShortName(bin: ResolvedBin): string {
  if (bin.kind === "auto") {
    const inner = bin.name.slice(5, -1);
    return /^\d/.test(inner) ? `a${inner.replace(/:/g, "_")}` : inner;
  }
  return bin.name.replace(/\[(.*)\]$/, "$1").replace(/[^A-Za-z0-9_]/g, "_");
}

function toRanges(values: number[]): RangeItem[] {
  const sorted = uniqueInOrder(values).sort((a, b) => a - b);
  const out: RangeItem[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const v = sorted[i];
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    if (start !== undefined) out.push(start === prev ? start : [start, prev]);
    start = v;
    prev = v;
  }
  return out;
}

/**
 * The select expression that picks exactly one coverpoint bin: `binsof(cp.bin)`
 * for a single named bin, otherwise `binsof(cp) intersect {its values}`
 * (array elements and automatic bins cannot be named in binsof, §19.6.1).
 */
export function selectForBin(cp: ElaboratedCoverpoint, bin: ResolvedBin): SelectExpr {
  const single = bin.kind === "bins" && bin.name === bin.declName && cp.bins.filter((b) => b.declName === bin.declName).length === 1;
  if (single) return { op: "binsof", coverpoint: cp.name, bin: bin.declName };
  return { op: "binsof", coverpoint: cp.name, intersect: toRanges(bin.values) };
}

/**
 * Turns marked grid cells into ignore_bins / illegal_bins declarations. A row
 * or column whose cells all carry the same mark becomes one `binsof(...)`;
 * remaining cells become `binsof(row) && binsof(col)`.
 */
export function crossBinsFromMarks(rowsCp: ElaboratedCoverpoint, colsCp: ElaboratedCoverpoint, marks: Record<string, CellMark>): CrossBinDecl[] {
  const rows = rowsCp.bins.filter((b) => b.counted);
  const cols = colsCp.bins.filter((b) => b.counted);
  const keyOf = (r: ResolvedBin, c: ResolvedBin) => `${r.key}|${c.key}`;
  const handled = new Set<string>();
  const decls: CrossBinDecl[] = [];
  const keyword = (m: CellMark): BinKeyword => (m === "ignore" ? "ignore_bins" : "illegal_bins");
  const prefix = (m: CellMark) => (m === "ignore" ? "ign" : "ill");
  for (const r of rows) {
    const m = marks[keyOf(r, cols[0])];
    if (cols.length > 0 && m && cols.every((c) => marks[keyOf(r, c)] === m)) {
      decls.push({ keyword: keyword(m), name: `${prefix(m)}_${binShortName(r)}`, select: selectForBin(rowsCp, r) });
      cols.forEach((c) => handled.add(keyOf(r, c)));
    }
  }
  for (const c of cols) {
    const m = marks[keyOf(rows[0], c)];
    if (rows.length > 0 && m && rows.every((r) => marks[keyOf(r, c)] === m) && rows.some((r) => !handled.has(keyOf(r, c)))) {
      decls.push({ keyword: keyword(m), name: `${prefix(m)}_${binShortName(c)}`, select: selectForBin(colsCp, c) });
      rows.forEach((r) => handled.add(keyOf(r, c)));
    }
  }
  for (const r of rows) {
    for (const c of cols) {
      const m = marks[keyOf(r, c)];
      if (!m || handled.has(keyOf(r, c))) continue;
      decls.push({
        keyword: keyword(m),
        name: `${prefix(m)}_${binShortName(r)}_${binShortName(c)}`,
        select: { op: "and", left: selectForBin(rowsCp, r), right: selectForBin(colsCp, c) },
      });
    }
  }
  return decls;
}

export interface ExplorerConfig {
  addr: AddrPresetId;
  op: OpPresetId;
  marks: Record<string, CellMark>;
  /** option.weight = 0 on both coverpoints so only the cross counts. */
  crossOnly?: boolean;
}

export function buildExplorerSpec(config: ExplorerConfig): CovergroupSpec {
  const addr = { ...addrPresets[config.addr].spec, ...(config.crossOnly ? { weight: 0 } : {}) };
  const op = { ...opPresets[config.op].spec, ...(config.crossOnly ? { weight: 0 } : {}) };
  const bins = crossBinsFromMarks(elaborateCoverpoint(addr), elaborateCoverpoint(op), config.marks);
  return {
    name: "cg_bus",
    event: { kind: "sample", args: EXPLORER_SAMPLE_ARGS },
    coverpoints: [addr, op],
    crosses: [{ name: "addr_x_op", coverpoints: ["cp_addr", "cp_op"], bins }],
  };
}
