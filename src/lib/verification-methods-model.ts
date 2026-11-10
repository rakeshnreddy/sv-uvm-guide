/**
 * Verification methods model: what directed tests, constrained-random
 * stimulus and formal reachability explore on one small design.
 *
 * Source of the semantics: the F1B lesson's own counter
 * (content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx,
 * "### Directed, constrained-random and formal"). It has a synchronous reset,
 * an increment enable `en` and a load `ld` with data `d`. The spec: `count`
 * becomes `d` when `ld` is 1 (load wins), otherwise `count + 1` when `en` is 1,
 * otherwise it holds. The injected RTL bug: when `ld` and `en` are both 1 while
 * `count` is 7, the RTL increments to 0 instead of loading `d`; with `d` = 0
 * the bug is invisible because 7 + 1 also wraps to 0.
 *
 * No SystemVerilog semantics beyond that RTL are modelled. The only standard
 * text referenced is IEEE 1800-2023 §16.2 (assume: "an assumption for the
 * environment ... formal tools use the information to generate input
 * stimulus"; cover: "to monitor the property evaluation for coverage"), which
 * the formal tab's wording does not go beyond. "Formal" here is exhaustive
 * reachability over this 8-state model, not a tool run: a real tool may return
 * a bounded or inconclusive result, which is tool-dependent.
 *
 * Pure: no React. Every sentence the component shows is generated here.
 */

import { createRng } from "@/lib/coverage-model";

/* ------------------------------------------------------------------ */
/* The counter (lesson RTL)                                            */
/* ------------------------------------------------------------------ */

/** `count` is 3 bits wide: values 0 to 7, and 7 + 1 wraps to 0 (the lesson's own statement). */
export const COUNT_WIDTH = 3;
export const COUNT_MODULUS = 1 << COUNT_WIDTH;
export const COUNT_VALUES: readonly number[] = Array.from({ length: COUNT_MODULUS }, (_, i) => i);
export const D_VALUES: readonly number[] = COUNT_VALUES;
export const BUG_COUNT = COUNT_MODULUS - 1;

export type Bit = 0 | 1;

export interface Inputs {
  ld: Bit;
  en: Bit;
  /** Load data, 0 to 7. */
  d: number;
}

/** What the inputs ask for: the grid's four rows. */
export type Row = "hold" | "inc" | "load" | "loadInc";
export const ROWS: readonly Row[] = ["hold", "inc", "load", "loadInc"];

export const ROW_LABELS: Record<Row, string> = {
  hold: "hold",
  inc: "increment",
  load: "load",
  loadInc: "load + increment",
};

/** Short labels for the 390 px grid's row headers. */
export const ROW_SHORT: Record<Row, string> = {
  hold: "hold",
  inc: "incr.",
  load: "load",
  loadInc: "ld+en",
};

export const ROW_INPUTS: Record<Row, { ld: Bit; en: Bit }> = {
  hold: { ld: 0, en: 0 },
  inc: { ld: 0, en: 1 },
  load: { ld: 1, en: 0 },
  loadInc: { ld: 1, en: 1 },
};

export function rowOf(inputs: Pick<Inputs, "ld" | "en">): Row {
  if (inputs.ld === 1) return inputs.en === 1 ? "loadInc" : "load";
  return inputs.en === 1 ? "inc" : "hold";
}

/** Does the row use `d`? Only the two load rows do. */
export const rowUsesD = (row: Row): boolean => row === "load" || row === "loadInc";

function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 0 || count >= COUNT_MODULUS) throw new RangeError(`count must be an integer 0 to ${COUNT_MODULUS - 1}, got ${count}`);
}

function checkInputs(inputs: Inputs): void {
  if (inputs.ld !== 0 && inputs.ld !== 1) throw new RangeError("ld must be 0 or 1 (this model is 2-state)");
  if (inputs.en !== 0 && inputs.en !== 1) throw new RangeError("en must be 0 or 1 (this model is 2-state)");
  if (!Number.isInteger(inputs.d) || inputs.d < 0 || inputs.d >= COUNT_MODULUS) throw new RangeError(`d must be an integer 0 to ${COUNT_MODULUS - 1}, got ${inputs.d}`);
}

/** Lesson spec: load wins, else increment (7 + 1 wraps to 0), else hold. */
export function specNext(count: number, inputs: Inputs): number {
  checkCount(count);
  checkInputs(inputs);
  if (inputs.ld === 1) return inputs.d;
  if (inputs.en === 1) return (count + 1) % COUNT_MODULUS;
  return count;
}

/** Lesson RTL: the spec, except ld && en at count 7 increments (to 0) instead of loading d. */
export function rtlNext(count: number, inputs: Inputs): number {
  checkCount(count);
  checkInputs(inputs);
  if (count === BUG_COUNT && inputs.ld === 1 && inputs.en === 1) return (count + 1) % COUNT_MODULUS;
  return specNext(count, inputs);
}

/** The RTL and the spec disagree exactly here: count 7, ld && en, d != 0. */
export function isBugTrigger(count: number, inputs: Inputs): boolean {
  return count === BUG_COUNT && inputs.ld === 1 && inputs.en === 1 && inputs.d !== 0;
}

/** The bug cell on the grid (the d slice decides whether it can fire). */
export const isBugCell = (count: number, row: Row): boolean => count === BUG_COUNT && row === "loadInc";

/** Why d = 0 hides the bug: computed, not typed. */
export function maskedAtDZeroText(): string {
  const wrapped = rtlNext(BUG_COUNT, { ld: 1, en: 1, d: 0 });
  return `At d = 0 the bug is invisible: the RTL gives ${BUG_COUNT} + 1 = ${wrapped} (it wraps), and the spec loads d = ${specNext(BUG_COUNT, { ld: 1, en: 1, d: 0 })}, the same value.`;
}

/** Every 2-state input combination, in a fixed order: hold, increment, load d = 0..7, load+increment d = 0..7. */
export function allInputs(): Inputs[] {
  const out: Inputs[] = [{ ld: 0, en: 0, d: 0 }, { ld: 0, en: 1, d: 0 }];
  for (const d of D_VALUES) out.push({ ld: 1, en: 0, d });
  for (const d of D_VALUES) out.push({ ld: 1, en: 1, d });
  return out;
}

export function cellLabel(count: number, row: Row): string {
  return `count ${count}, ${ROW_LABELS[row]}`;
}

/** What the RTL does in a cell (with a d slice for the load rows). */
export function cellBehaviour(count: number, row: Row, d: number | null): string {
  const { ld, en } = ROW_INPUTS[row];
  if (rowUsesD(row) && d === null) {
    if (isBugCell(count, row)) return `the RTL gives ${rtlNext(count, { ld, en, d: 0 })} for every d; the spec loads d, so they differ for d ≠ 0`;
    return `count becomes d`;
  }
  const inputs = { ld, en, d: d ?? 0 };
  const rtl = rtlNext(count, inputs);
  const spec = specNext(count, inputs);
  if (rtl !== spec) return `the RTL gives ${rtl}, the spec gives ${spec}: the bug`;
  return `count becomes ${rtl}`;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** The prediction buckets' boundaries (probabilities). bucketOf and formatPercent both read them, so a shown number never sits on the wrong side of its bucket. */
export const BUCKET_BOUNDS = [0.1, 0.5, 0.9] as const;

/**
 * A probability as a percentage: one decimal, or two above 99% so 99.56% does
 * not round to 100%. Near a bucket boundary it adds decimals until the shown
 * number is on the same side as the value (9.99936% shows as 9.999%, not 10.0%).
 * `belowOne` says the exact value is known to be below 1 even if the double
 * rounded to 1, so it shows "> 99.99%" and never "100%".
 */
export function formatPercent(p: number, belowOne = false): string {
  if (!Number.isFinite(p)) return "—";
  const pct = p * 100;
  if (pct === 0) return "0%";
  if (pct === 100) return belowOne ? "> 99.99%" : "100%";
  if (pct > 99.995) return "> 99.99%";
  if (pct > 99) return `${pct.toFixed(2)}%`;
  if (pct < 0.1) return `${pct.toFixed(3)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  const bounds = BUCKET_BOUNDS.map((b) => b * 100);
  let dec = 1;
  while (dec < 8 && !bounds.includes(pct) && bounds.includes(Number(pct.toFixed(dec)))) dec++;
  return `${pct.toFixed(dec)}%`;
}

/** The number drawn inside a grid cell (no % sign), like the lesson figure. */
export function formatShare(p: number): string {
  const pct = p * 100;
  if (pct === 0) return "0";
  if (pct < 0.1) return pct.toFixed(2);
  return pct.toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Directed tests                                                      */
/* ------------------------------------------------------------------ */

export type DirectedStep = { kind: "reset" } | { kind: "hold" } | { kind: "inc" } | { kind: "load"; d: number } | { kind: "loadInc"; d: number };

export interface DirectedTest {
  id: string;
  name: string;
  /** The lesson's wording of the test. */
  description: string;
  steps: DirectedStep[];
}

const incs = (n: number): DirectedStep[] => Array.from({ length: n }, () => ({ kind: "inc" }) as DirectedStep);
const holds = (n: number): DirectedStep[] => Array.from({ length: n }, () => ({ kind: "hold" }) as DirectedStep);

/** The lesson's three directed tests ("a busy engineer might write"). */
export const LESSON_TESTS: readonly DirectedTest[] = [
  { id: "wrap", name: "Test 1: count through the wrap", description: "count from 0 through the wrap back to 0", steps: [{ kind: "reset" }, ...incs(COUNT_MODULUS)] },
  { id: "load5", name: "Test 2: load 5, then count on", description: "load 5 right after reset, then count on", steps: [{ kind: "reset" }, { kind: "load", d: 5 }, ...incs(3)] },
  { id: "hold", name: "Test 3: hold", description: "hold with en low right after reset", steps: [{ kind: "reset" }, ...holds(3)] },
];

/** A fourth test the learner can load into the builder: the one that finds the bug. */
export const BUG_HUNT_STEPS: readonly DirectedStep[] = [{ kind: "reset" }, { kind: "load", d: BUG_COUNT }, { kind: "loadInc", d: 3 }];

export const MAX_CUSTOM_STEPS = 24;

export function stepInputs(step: DirectedStep): Inputs | null {
  switch (step.kind) {
    case "reset":
      return null;
    case "hold":
      return { ld: 0, en: 0, d: 0 };
    case "inc":
      return { ld: 0, en: 1, d: 0 };
    case "load":
      return { ld: 1, en: 0, d: step.d };
    case "loadInc":
      return { ld: 1, en: 1, d: step.d };
  }
}

export function stepText(step: DirectedStep): string {
  switch (step.kind) {
    case "reset":
      return "reset";
    case "hold":
      return "hold";
    case "inc":
      return "increment";
    case "load":
      return `load ${step.d}`;
    case "loadInc":
      return `ld+en with d = ${step.d}`;
  }
}

export function stepsText(steps: readonly DirectedStep[]): string {
  if (steps.length === 0) return "no steps";
  const parts: string[] = [];
  for (let i = 0; i < steps.length; ) {
    const t = stepText(steps[i]);
    let j = i;
    while (j < steps.length && stepText(steps[j]) === t) j++;
    parts.push(j - i > 1 ? `${t} ×${j - i}` : t);
    i = j;
  }
  return parts.join(", ");
}

export interface DirectedTraceRow {
  /** 1-based step number. */
  step: number;
  text: string;
  /** count (RTL) when the step's inputs are sampled; null when unknown (X: no reset or load yet) or for a reset step. */
  count: number | null;
  row: Row | null;
  d: number | null;
  /** null = X. */
  rtlNext: number | null;
  /** null = X. */
  specNext: number | null;
  /** RTL and spec are both known and disagree after this step. */
  diverges: boolean;
  /** ld and en together while the RTL count is X: the RTL's result depends on how its condition is coded (see UNKNOWN_COUNT_RULES). */
  codingDependent: boolean;
}

export interface DirectedRun {
  trace: DirectedTraceRow[];
  found: boolean;
  /** 1-based step at which the bug cell was driven with d != 0. */
  foundAtStep: number | null;
  /** Steps sampled while the RTL count is unknown (X). */
  unknownSteps: number;
  /** 1-based steps where ld and en were driven together at an unknown count. */
  codingDependentSteps: number[];
}

/**
 * The 4-state rules for a step taken while count is still unknown, with the
 * clauses they rest on (IEEE 1800-2023). Shown by the component as written.
 */
export const UNKNOWN_COUNT_RULES =
  "Until a reset or a load, count is unknown (X): a 4-state variable starts at 'x (IEEE 1800-2023 §6.8, Table 6-7). Hold keeps X, and increment gives X because an arithmetic operand bit x makes the result x (§11.4.3). A load (ld = 1, en = 0) assigns count = d whatever count was, so count is known from the next edge. For ld and en together at an unknown count the spec loads d, but the buggy RTL's result depends on how its condition is coded (an if condition that is x takes the else branch, §12.4), so this model leaves the RTL count unknown. Steps at an unknown count are not placed on the grid.";

/**
 * Next value from an unknown (X) count, or null if it stays unknown.
 * Load (ld = 1, en = 0): count = d for both, since the bug needs en = 1 and
 * every known count loads d. Hold and increment: X (§11.4.3, x + 1 is x).
 * ld && en: the spec loads d; the buggy RTL is coding-dependent (§12.4), so X.
 */
function nextFromUnknown(design: Design, inputs: Inputs): number | null {
  const row = rowOf(inputs);
  if (row === "load") return inputs.d;
  if (row === "loadInc") return design === "spec" ? inputs.d : null;
  return null;
}

/**
 * Runs a step list on the RTL and the spec side by side. A reset puts both at
 * 0 (synchronous reset). Before the first reset or load the count is unknown
 * (X in a 4-state simulation); see UNKNOWN_COUNT_RULES. Steps at an unknown
 * count are not placed on the grid. After a divergence the RTL keeps its own
 * (wrong) count, as a DUT would.
 */
export function runDirected(steps: readonly DirectedStep[]): DirectedRun {
  let rtl: number | null = null;
  let spec: number | null = null;
  let foundAtStep: number | null = null;
  let unknownSteps = 0;
  const codingDependentSteps: number[] = [];
  const trace: DirectedTraceRow[] = [];
  steps.forEach((step, i) => {
    const inputs = stepInputs(step);
    if (!inputs) {
      rtl = 0;
      spec = 0;
      trace.push({ step: i + 1, text: stepText(step), count: null, row: null, d: null, rtlNext: 0, specNext: 0, diverges: false, codingDependent: false });
      return;
    }
    checkInputs(inputs);
    const row = rowOf(inputs);
    // The scoreboard compares with the spec model, which tracks the spec value; the DUT's state is the RTL value.
    const nextSpec: number | null = spec === null ? nextFromUnknown("spec", inputs) : specNext(spec, inputs);
    const nextRtl: number | null = rtl === null ? nextFromUnknown("rtl", inputs) : rtlNext(rtl, inputs);
    const codingDependent = rtl === null && row === "loadInc";
    if (rtl === null) unknownSteps++;
    if (codingDependent) codingDependentSteps.push(i + 1);
    if (rtl !== null && foundAtStep === null && isBugTrigger(rtl, inputs)) foundAtStep = i + 1;
    trace.push({
      step: i + 1,
      text: stepText(step),
      count: rtl,
      row,
      d: rowUsesD(row) ? inputs.d : null,
      rtlNext: nextRtl,
      specNext: nextSpec,
      diverges: nextRtl !== null && nextSpec !== null && nextRtl !== nextSpec,
      codingDependent,
    });
    rtl = nextRtl;
    spec = nextSpec;
  });
  return { trace, found: foundAtStep !== null, foundAtStep, unknownSteps, codingDependentSteps };
}

/** Grid cells a set of runs visited, keyed `${row}:${count}`, filtered by a d slice for the load rows. */
export function visitedCells(runs: readonly DirectedRun[], dSlice: number | null): Set<string> {
  const out = new Set<string>();
  for (const run of runs) {
    for (const t of run.trace) {
      if (t.count === null || t.row === null) continue;
      if (dSlice !== null && rowUsesD(t.row) && t.d !== dSlice) continue;
      out.add(cellKey(t.row, t.count));
    }
  }
  return out;
}

export const cellKey = (row: Row, count: number): string => `${row}:${count}`;

export function directedVerdict(tests: readonly { name: string; run: DirectedRun }[]): { found: boolean; text: string } {
  if (tests.length === 0) return { found: false, text: "No test is selected, so nothing is visited and nothing can be found." };
  const finders = tests.filter((t) => t.run.found);
  if (finders.length === 0) {
    const askedLdEnAt7 = tests.some((t) => t.run.trace.some((r) => r.count === BUG_COUNT && r.row === "loadInc"));
    const limited = tests.filter((t) => t.run.codingDependentSteps.length > 0);
    const limit =
      limited.length === 0
        ? ""
        : ` Limit: ${limited.map((t) => `${t.name} step ${t.run.codingDependentSteps[0]}`).join(", ")} drives ld and en together while count is still X; the buggy RTL's result there depends on how its condition is coded (IEEE 1800-2023 §12.4), so this model keeps its count unknown from then until a reset or a load.`;
    return {
      found: false,
      text:
        (askedLdEnAt7
          ? `Missed. A test drives load + increment at count ${BUG_COUNT}, but only with d = 0, where the bug is invisible. Directed tests find what you imagine.`
          : `Missed. No selected test asks for load and increment together at count ${BUG_COUNT}, so the bug cell is never visited. Directed tests find what you imagine.`) + limit,
    };
  }
  const t = finders[0];
  const row = t.run.trace[(t.run.foundAtStep ?? 1) - 1];
  return {
    found: true,
    text: `Found by ${t.name} at step ${t.run.foundAtStep}: count ${row.count}, ld and en both 1, d = ${row.d}. The spec gives ${row.specNext}, the RTL gives ${row.rtlNext}; a scoreboard sees it at the next edge.`,
  };
}

/* ------------------------------------------------------------------ */
/* Constrained-random stimulus: an exact Markov chain over count       */
/* ------------------------------------------------------------------ */

export interface RandomParams {
  /** P(en = 1) per cycle, independent of everything else. */
  pEn: number;
  /** P(ld = 1) per cycle, independent of everything else. */
  pLd: number;
  // d is drawn uniformly from 0 to 7 every cycle, as in the lesson.
}

/** The lesson's random test: en high half the time, ld one cycle in ten, d uniform. */
export const LESSON_RANDOM: RandomParams = { pEn: 0.5, pLd: 0.1 };
export const CYCLE_BUDGETS = [20, 100, 1000] as const;
export type CycleBudget = (typeof CYCLE_BUDGETS)[number];
export const P_EN_CHOICES: readonly number[] = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
export const P_LD_CHOICES: readonly number[] = [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1];

export function checkParams(params: RandomParams): void {
  for (const [name, p] of [["P(en)", params.pEn], ["P(ld)", params.pLd]] as const) {
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError(`${name} must be a probability from 0 to 1, got ${p}`);
  }
}

/** Probability of each input request (row) in one cycle. */
export function rowProbabilities(params: RandomParams): Record<Row, number> {
  checkParams(params);
  const { pEn, pLd } = params;
  return { hold: (1 - pLd) * (1 - pEn), inc: (1 - pLd) * pEn, load: pLd * (1 - pEn), loadInc: pLd * pEn };
}

/** One-cycle transition probabilities of the RTL: `safe` moves count without firing the bug; `bug` is the mass that fires it. */
function transition(count: number, params: RandomParams): { safe: number[]; bug: number } {
  const rows = rowProbabilities(params);
  const safe = new Array<number>(COUNT_MODULUS).fill(0);
  let bug = 0;
  for (const row of ROWS) {
    const { ld, en } = ROW_INPUTS[row];
    const pRow = rows[row];
    if (pRow === 0) continue;
    const ds = rowUsesD(row) ? D_VALUES : [0];
    const pEach = rowUsesD(row) ? pRow / COUNT_MODULUS : pRow;
    for (const d of ds) {
      const inputs = { ld, en, d };
      if (isBugTrigger(count, inputs)) bug += pEach;
      else safe[rtlNext(count, inputs)] += pEach;
    }
  }
  return { safe, bug };
}

/**
 * Exact probability that the bug cell is driven (count 7, ld && en, d != 0)
 * within the first `cycles` cycles after reset. Cycle 1 is the first cycle
 * after reset, with count 0. Computed by propagating the distribution of count
 * through a Markov chain with an absorbing "found" state: no geometric
 * approximation, because whether count is 7 depends on the history.
 */
export function foundProbabilities(params: RandomParams, maxCycles: number): number[] {
  return foundCurve(params, maxCycles).p;
}

/**
 * foundProbabilities plus, per cycle count, whether the exact value is below 1.
 * `belowOne[n]` is decided on the support of the not-found distribution (which
 * counts a bug-avoiding path of n cycles can end at), with booleans, so it does
 * not depend on floating-point mass that may round away: when `p[n]` rounds to
 * 1.0 but a path avoids the bug, the text still says "> 99.99%".
 */
export function foundCurve(params: RandomParams, maxCycles: number): { p: number[]; belowOne: boolean[] } {
  checkParams(params);
  if (!Number.isInteger(maxCycles) || maxCycles < 0) throw new RangeError(`cycles must be a non-negative integer, got ${maxCycles}`);
  const trans = COUNT_VALUES.map((c) => transition(c, params));
  let dist = new Array<number>(COUNT_MODULUS).fill(0);
  dist[0] = 1;
  let support = COUNT_VALUES.map((c) => c === 0);
  let found = 0;
  const p = [0];
  const belowOne = [true];
  for (let n = 1; n <= maxCycles; n++) {
    const nextDist = new Array<number>(COUNT_MODULUS).fill(0);
    const nextSupport = new Array<boolean>(COUNT_MODULUS).fill(false);
    for (const c of COUNT_VALUES) {
      if (support[c]) for (const k of COUNT_VALUES) if (trans[c].safe[k] > 0) nextSupport[k] = true;
      const m = dist[c];
      if (m === 0) continue;
      found += m * trans[c].bug;
      // Paths on which the bug fired are absorbed: only the not-found mass moves on.
      for (const k of COUNT_VALUES) nextDist[k] += m * trans[c].safe[k];
    }
    dist = nextDist;
    support = nextSupport;
    p.push(Math.min(1, found));
    belowOne.push(support.some(Boolean));
  }
  return { p, belowOne };
}

export function foundProbability(params: RandomParams, cycles: number): number {
  return foundProbabilities(params, cycles)[cycles];
}

/** The probability of finding the bug within `cycles`, formatted so a value below 1 never prints as 100%. */
export function formatFound(params: RandomParams, cycles: number): string {
  const c = foundCurve(params, cycles);
  return formatPercent(c.p[cycles], c.belowOne[cycles]);
}

/** Solve x P = x, sum x = 1 for an irreducible chain (Gaussian elimination, 8 unknowns). */
function solveStationary(P: number[][]): number[] {
  const n = P.length;
  // Rows of A: (P^T - I) with the last equation replaced by sum = 1.
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j === n ? 0 : P[j][i] - (i === j ? 1 : 0))));
  for (let j = 0; j <= n; j++) A[n - 1][j] = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const pv = A[col][col];
    for (let j = col; j <= n; j++) A[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row[n]);
}

/**
 * Which next-state function drives the long-run shares. "spec" is the
 * bug-free counter, and it is also the RTL's behaviour up to the first time
 * the bug fires (they differ only on that transition), which is the part of a
 * run that decides whether the bug is found. The lesson's 5.6% and 0.6% are
 * exact for it: the chain is doubly stochastic, so count is uniform. "rtl"
 * keeps running the buggy RTL after the bug fires; each hit sends count to 0
 * instead of d, so its shares drift towards count 0.
 */
export type Design = "rtl" | "spec";

/** Long-run distribution of count under random stimulus, starting from reset (count 0). */
export function countDistribution(params: RandomParams, design: Design = "spec"): number[] {
  checkParams(params);
  if (params.pEn === 0 && params.pLd === 0) {
    // Not irreducible: the counter holds at its reset value forever.
    return COUNT_VALUES.map((c) => (c === 0 ? 1 : 0));
  }
  // pLd > 0 reaches every d from every count; pLd = 0 with pEn > 0 cycles through all 8: irreducible either way.
  const next = design === "rtl" ? rtlNext : specNext;
  const rows = rowProbabilities(params);
  const P = COUNT_VALUES.map((c) => {
    const r = new Array<number>(COUNT_MODULUS).fill(0);
    for (const row of ROWS) {
      const { ld, en } = ROW_INPUTS[row];
      if (rows[row] === 0) continue;
      const ds = rowUsesD(row) ? D_VALUES : [0];
      for (const d of ds) r[next(c, { ld, en, d })] += rows[row] / ds.length;
    }
    return r;
  });
  return solveStationary(P);
}

/**
 * Each grid cell's long-run share of cycles: P(count = c) × P(row), and for a
 * d slice of a load row a further 1/8. Without a slice the load rows sum over d.
 */
export function cellShares(params: RandomParams, dSlice: number | null = null, design: Design = "spec"): Record<Row, number[]> {
  const counts = countDistribution(params, design);
  const rows = rowProbabilities(params);
  const out = {} as Record<Row, number[]>;
  for (const row of ROWS) {
    const dFactor = rowUsesD(row) && dSlice !== null ? 1 / COUNT_MODULUS : 1;
    out[row] = counts.map((pc) => pc * rows[row] * dFactor);
  }
  return out;
}

/** Long-run share of cycles that drive the bug (count 7, ld && en, d != 0). */
export function bugShare(params: RandomParams, design: Design = "spec"): number {
  const counts = countDistribution(params, design);
  return counts[BUG_COUNT] * rowProbabilities(params).loadInc * ((COUNT_MODULUS - 1) / COUNT_MODULUS);
}

export type ProbabilityBucket = "rare" | "sometimes" | "usually" | "almost-always";

export const BUCKET_LABELS: Record<ProbabilityBucket, string> = {
  rare: "Rarely: under 10% of seeds",
  sometimes: "Sometimes: 10% to 50% of seeds",
  usually: "Usually: 50% to 90% of seeds",
  "almost-always": "Almost always: over 90% of seeds",
};

export function bucketOf(p: number): ProbabilityBucket {
  const [b1, b2, b3] = BUCKET_BOUNDS;
  if (p < b1) return "rare";
  if (p < b2) return "sometimes";
  if (p < b3) return "usually";
  return "almost-always";
}

/** What the long-run shares describe: the bug-free counter, which the RTL matches until the bug first fires. */
export const LONG_RUN_SCOPE = "for the bug-free counter, which the RTL matches until the bug first fires";

/** Plain-language reason, generated from the numbers. */
export function randomExplanation(params: RandomParams, cycles: number): string {
  if (params.pLd === 0) return `With P(ld) = 0, ld is never 1, so the bug cell is never driven: 0% in any budget.`;
  if (params.pEn === 0) return `With P(en) = 0, en is never 1, so ld and en are never 1 together: 0% in any budget.`;
  return `The bug needs count ${BUG_COUNT}, ld and en together and d ≠ 0: about ${formatPercent(bugShare(params))} of cycles in the long run, ${LONG_RUN_SCOPE}. Within ${cycles.toLocaleString("en-US")} cycles after reset, ${formatFound(params, cycles)} of seeds reach it (exact, from a Markov chain over count). Random stimulus finds what is probable.`;
}

export interface SeededRun {
  seed: number;
  cycles: number;
  /** Per cycle (1-based index = position + 1): the sampled count and inputs. */
  samples: { count: number; inputs: Inputs }[];
  /** 1-based cycle at which the bug cell was first driven, or null. */
  foundAtCycle: number | null;
}

/**
 * One seeded run on the RTL using coverage-model's createRng. Each cycle draws
 * en, then ld, then d (uniform 0 to 7) from the stream. The seed decides one
 * sample path; it is not the exact probability above.
 */
export function simulateRandom(params: RandomParams, cycles: number, seed: number): SeededRun {
  checkParams(params);
  if (!Number.isInteger(cycles) || cycles < 0) throw new RangeError(`cycles must be a non-negative integer, got ${cycles}`);
  const rng = createRng(seed);
  let count = 0;
  let foundAtCycle: number | null = null;
  const samples: SeededRun["samples"] = [];
  for (let n = 1; n <= cycles; n++) {
    const en: Bit = rng() < params.pEn ? 1 : 0;
    const ld: Bit = rng() < params.pLd ? 1 : 0;
    const d = Math.min(COUNT_MODULUS - 1, Math.floor(rng() * COUNT_MODULUS));
    const inputs = { ld, en, d };
    samples.push({ count, inputs });
    if (foundAtCycle === null && isBugTrigger(count, inputs)) foundAtCycle = n;
    count = rtlNext(count, inputs);
  }
  return { seed, cycles, samples, foundAtCycle };
}

/** Cells visited by the first `upTo` cycles of a seeded run, filtered by a d slice. */
export function seededVisits(run: SeededRun, upTo: number, dSlice: number | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of run.samples.slice(0, upTo)) {
    const row = rowOf(s.inputs);
    if (dSlice !== null && rowUsesD(row) && s.inputs.d !== dSlice) continue;
    const key = cellKey(row, s.count);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export function seededRunText(run: SeededRun, upTo: number = run.cycles): string {
  const visited = seededVisits(run, upTo, null).size;
  const total = ROWS.length * COUNT_MODULUS;
  const found = run.foundAtCycle !== null && run.foundAtCycle <= upTo;
  const head = `Seed ${run.seed}, cycles 1 to ${upTo.toLocaleString("en-US")}: ${visited} of ${total} cells visited.`;
  if (found) {
    const s = run.samples[(run.foundAtCycle as number) - 1];
    return `${head} The bug cell is driven at cycle ${run.foundAtCycle} with d = ${s.inputs.d}: found.`;
  }
  return `${head} The bug cell is not driven with d ≠ 0: missed by this seed.`;
}

/* ------------------------------------------------------------------ */
/* Formal: exhaustive reachability under assumptions                   */
/* ------------------------------------------------------------------ */

export type AssumptionId = "none" | "noLdEn" | "dNot7";

export interface Assumption {
  id: AssumptionId;
  /** The SVA expression the learner would write in `assume property (@(posedge clk) ...)`. */
  expr: string;
  label: string;
  allows: (inputs: Inputs) => boolean;
}

export const ASSUMPTIONS: readonly Assumption[] = [
  { id: "none", expr: "", label: "No assumption", allows: () => true },
  { id: "noLdEn", expr: "!(ld && en)", label: "assume !(ld && en)", allows: (i) => !(i.ld === 1 && i.en === 1) },
  { id: "dNot7", expr: `d != ${BUG_COUNT}`, label: `assume d != ${BUG_COUNT}`, allows: (i) => i.d !== BUG_COUNT },
];

export const findAssumption = (id: AssumptionId): Assumption => ASSUMPTIONS.find((a) => a.id === id) ?? ASSUMPTIONS[0];

export function allowedInputs(id: AssumptionId): Inputs[] {
  const a = findAssumption(id);
  return allInputs().filter((i) => a.allows(i));
}

/** Counts reachable from reset (count 0) using only inputs the assumption allows. */
export function reachableCounts(id: AssumptionId): Set<number> {
  const inputs = allowedInputs(id);
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const c = queue.shift() as number;
    for (const i of inputs) {
      const n = rtlNext(c, i);
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

/** A cell is reachable when its count is reachable and the assumption allows an input of its row (with the d slice). */
export function cellReachable(id: AssumptionId, count: number, row: Row, dSlice: number | null): boolean {
  if (!reachableCounts(id).has(count)) return false;
  const { ld, en } = ROW_INPUTS[row];
  return allowedInputs(id).some((i) => i.ld === ld && i.en === en && (!rowUsesD(row) || dSlice === null || i.d === dSlice));
}

/** Rows (with the d slice) that the assumption removes entirely. */
export function excludedCells(id: AssumptionId, dSlice: number | null): Set<string> {
  const out = new Set<string>();
  for (const row of ROWS) for (const c of COUNT_VALUES) if (!cellReachable(id, c, row, dSlice)) out.add(cellKey(row, c));
  return out;
}

export type FormalResult =
  | { kind: "counterexample"; assumption: AssumptionId; inputs: Inputs[]; edges: number; text: string }
  | { kind: "proof"; assumption: AssumptionId; text: string };

/**
 * Breadth-first search from reset for the shortest input sequence that drives
 * the bug (the property "count matches the spec" fails one edge later).
 * Edge 0 is the reset edge; edge k applies inputs[k - 1]. Inputs are tried in
 * allInputs() order, and the final ld && en step uses `preferD` when allowed,
 * else the smallest allowed d != 0, so the trace is deterministic.
 */
export function formalCheck(id: AssumptionId, preferD = 3): FormalResult {
  const inputs = allowedInputs(id);
  const parent = new Map<number, { from: number; via: Inputs } | null>([[0, null]]);
  const queue = [0];
  const bugInputs = inputs.filter((i) => isBugTrigger(BUG_COUNT, i));
  while (queue.length) {
    const c = queue.shift() as number;
    for (const i of inputs) {
      const n = rtlNext(c, i);
      if (!parent.has(n)) {
        parent.set(n, { from: c, via: i });
        queue.push(n);
      }
    }
  }
  if (!parent.has(BUG_COUNT) || bugInputs.length === 0) {
    const why = !parent.has(BUG_COUNT)
      ? `count ${BUG_COUNT} is unreachable under the assumption`
      : `the assumption forbids ld and en together, so the bug cell can never be driven`;
    return { kind: "proof", assumption: id, text: `Proof passes, bug hidden: ${why}. The RTL bug is still there.` };
  }
  const path: Inputs[] = [];
  for (let c = BUG_COUNT; parent.get(c); ) {
    const p = parent.get(c) as { from: number; via: Inputs };
    path.unshift(p.via);
    c = p.from;
  }
  const last = bugInputs.find((i) => i.d === preferD) ?? bugInputs[0];
  path.push(last);
  const edges = path.length + 1; // the reset edge, then one edge per input
  const steps = ["reset", ...path.map((i) => describeInputs(i))].join(", then ");
  return { kind: "counterexample", assumption: id, inputs: path, edges, text: `Counterexample in ${edges} edges: ${steps}. The check fails at the next edge.` };
}

export function describeInputs(i: Inputs): string {
  const row = rowOf(i);
  if (row === "load") return `load ${i.d}`;
  if (row === "loadInc") return `ld+en with d = ${i.d}`;
  return ROW_LABELS[row];
}

/** Can `cover property (@(posedge clk) ld && en)` still match under the assumption? */
export function coverLdEnReachable(id: AssumptionId): boolean {
  return allowedInputs(id).some((i) => i.ld === 1 && i.en === 1);
}

export const COVER_LD_EN = "cover property (@(posedge clk) ld && en)";

export function coverWarning(id: AssumptionId): string | null {
  return coverLdEnReachable(id) ? null : `${COVER_LD_EN}: unreachable under assumptions. The assumption has removed a scenario that must stay reachable.`;
}

export interface WaveSignal {
  name: string;
  kind: "clock" | "bit" | "bus";
  values?: (number | undefined)[];
}

/**
 * The counterexample as sampled values per edge (the lesson's TimingDiagram
 * convention: values[k] is sampled at edge k, so an update made at edge k
 * shows at edge k + 1). One extra edge shows the divergence; inputs are low
 * there and d keeps its last value.
 */
export function counterexampleWave(result: Extract<FormalResult, { kind: "counterexample" }>): { edges: number; signals: WaveSignal[]; divergeEdge: number; triggerEdge: number } {
  const n = result.inputs.length;
  const edges = n + 2;
  const at = (k: number): Inputs | null => (k >= 1 && k <= n ? result.inputs[k - 1] : null);
  const rst: number[] = [];
  const ld: number[] = [];
  const en: number[] = [];
  const d: number[] = [];
  const expected: (number | undefined)[] = [undefined];
  const count: (number | undefined)[] = [undefined];
  let lastD = 0;
  for (let k = 0; k < edges; k++) {
    const i = at(k);
    rst.push(k === 0 ? 1 : 0);
    ld.push(i?.ld ?? 0);
    en.push(i?.en ?? 0);
    if (i && rowUsesD(rowOf(i))) lastD = i.d;
    d.push(lastD);
  }
  // Edge 0 resets both to 0, visible at edge 1.
  let r = 0;
  let s = 0;
  expected.push(0);
  count.push(0);
  for (let k = 1; k < edges - 1; k++) {
    const i = at(k) as Inputs;
    r = rtlNext(r, i);
    s = specNext(s, i);
    expected.push(s);
    count.push(r);
  }
  return {
    edges,
    divergeEdge: edges - 1,
    triggerEdge: n,
    signals: [
      { name: "clk", kind: "clock" },
      { name: "rst", kind: "bit", values: rst },
      { name: "ld", kind: "bit", values: ld },
      { name: "en", kind: "bit", values: en },
      { name: "d", kind: "bus", values: d },
      { name: "expected", kind: "bus", values: expected },
      { name: "count", kind: "bus", values: count },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Text alternatives and fidelity                                      */
/* ------------------------------------------------------------------ */

export const METHODS_ASSUMPTIONS: readonly string[] = [
  "The counter, its spec and its bug are the F1B lesson's own: load wins, else increment (7 + 1 wraps to 0), else hold; the RTL increments instead of loading when ld and en are both 1 at count 7. No other SystemVerilog semantics are modelled.",
  `Inputs are 2-state (0 or 1). An X or Z on ld, en or d is outside this model. ${UNKNOWN_COUNT_RULES}`,
  "Random: en, ld and d are independent each cycle; d is uniform 0 to 7. Cycle 1 is the first cycle after reset (count 0). 'Found' means the bug cell is driven with d ≠ 0; a scoreboard sees the wrong count at the next edge. The percentages are exact for this model, computed from a Markov chain over count. The per-cell shares are those of the bug-free counter, which is also the RTL's behaviour until the bug first fires; a buggy RTL left running after a hit drifts towards count 0. A seeded run is one sample path from coverage-model's createRng, not a real constraint solver.",
  "Formal here is exhaustive reachability over the model's 8 states, not a tool run. Real tools may stop with a bounded or inconclusive result; that is tool-dependent. IEEE 1800-2023 §16.2 describes assume as an assumption for the environment that formal tools use to generate input stimulus, and cover as monitoring a property for coverage; how a tool reports an unreachable cover is tool-dependent.",
];

/** Shown under the d slice on the Formal tab: the slice is a view filter, not an assumption. */
export const FORMAL_SLICE_NOTE = "The d slice only filters the view; the search covers every d. A slice of d ≠ 0 only picks the d shown in the counterexample's last step, when the assumption allows that d.";

export function gridSummary(tab: "directed" | "random" | "formal", dSlice: number | null): string {
  const slice = dSlice === null ? "all values of d" : `d = ${dSlice}`;
  const bug =
    dSlice === 0
      ? `In this slice the bug cell (count ${BUG_COUNT}, load + increment) cannot fire, because d = 0.`
      : `The bug lives in one cell: count ${BUG_COUNT}, load + increment, with d ≠ 0.`;
  return `Grid of ${ROWS.length * COUNT_MODULUS} cells for the ${tab} tab, showing ${slice}: count 0 to ${COUNT_MODULUS - 1} across; ${ROWS.map((r) => ROW_LABELS[r]).join(", ")} down. ${bug}`;
}

/* ------------------------------------------------------------------ */
/* Per-cell sentences (the grid's text equivalent)                     */
/* ------------------------------------------------------------------ */

export interface NamedRun {
  name: string;
  run: DirectedRun;
}

/** Which tests visit a cell, with the first step at which each does. */
export function cellVisitors(tests: readonly NamedRun[], row: Row, count: number, dSlice: number | null): { name: string; step: number }[] {
  const out: { name: string; step: number }[] = [];
  for (const t of tests) {
    const hit = t.run.trace.find((r) => r.row === row && r.count === count && (dSlice === null || !rowUsesD(row) || r.d === dSlice));
    if (hit) out.push({ name: t.name, step: hit.step });
  }
  return out;
}

function sliceNote(row: Row, dSlice: number | null): string {
  return rowUsesD(row) && dSlice !== null ? ` with d = ${dSlice}` : "";
}

export function directedCellText(tests: readonly NamedRun[], row: Row, count: number, dSlice: number | null): string {
  const visitors = cellVisitors(tests, row, count, dSlice);
  const who = visitors.length === 0 ? "not visited" : `visited by ${visitors.map((v) => `${v.name} (step ${v.step})`).join(", ")}`;
  return `${cellLabel(count, row)}${sliceNote(row, dSlice)}: ${who}. ${capitalise(cellBehaviour(count, row, dSlice))}.`;
}

/**
 * A random-tab cell's sentence. Pass `precomputed` (cellShares and seededVisits
 * for the same params, slice, run and upTo) to avoid recomputing them per cell.
 */
export function randomCellText(
  params: RandomParams,
  row: Row,
  count: number,
  dSlice: number | null,
  run: SeededRun | null,
  upTo: number,
  precomputed?: { shares: Record<Row, number[]>; visits: Map<string, number> | null },
): string {
  const share = (precomputed?.shares ?? cellShares(params, dSlice))[row][count];
  const base = `${cellLabel(count, row)}${sliceNote(row, dSlice)}: ${formatPercent(share)} of cycles in the long run (bug-free counter).`;
  if (!run) return base;
  const visits = precomputed?.visits ?? seededVisits(run, upTo, dSlice);
  const n = visits.get(cellKey(row, count)) ?? 0;
  return `${base} Seed ${run.seed}: ${n} ${n === 1 ? "visit" : "visits"} in cycles 1 to ${upTo.toLocaleString("en-US")}.`;
}

export function formalCellText(id: AssumptionId, row: Row, count: number, dSlice: number | null): string {
  const a = findAssumption(id);
  const reach = cellReachable(id, count, row, dSlice);
  const state = reach ? "reachable from reset" : `excluded: ${a.label} removes every input of this cell`;
  return `${cellLabel(count, row)}${sliceNote(row, dSlice)}: ${state}. ${capitalise(cellBehaviour(count, row, dSlice))}.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A sentence for the probability curve's text alternative. */
export function curveText(params: RandomParams): string {
  const curve = foundCurve(params, CYCLE_BUDGETS[CYCLE_BUDGETS.length - 1]);
  const parts = CYCLE_BUDGETS.map((n) => `${formatPercent(curve.p[n], curve.belowOne[n])} within ${n.toLocaleString("en-US")} cycles`);
  return `Exact probability of reaching the bug from reset: ${parts.join(", ")}.`;
}
