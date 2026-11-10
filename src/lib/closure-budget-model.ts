/**
 * Closure budget model for the F1B "coverage closure trap" lab.
 *
 * What it computes (math only; no SystemVerilog source is shown):
 * - A coverage model of `commonBins` equally likely bins plus one rare bin.
 *   Every random sample lands in exactly one bin, so the bins are disjoint
 *   and their probabilities sum to 1.
 * - Coverage is the share of bins covered: IEEE 1800-2023 §19.11.1 gives a
 *   coverpoint's coverage as |bins_covered| / |bins| for user-defined bins.
 *   By linearity of expectation, the expected coverage after n samples is
 *   (1/K) Σ (1 − (1 − p_i)^n): each bin is covered with probability
 *   1 − (1 − p_i)^n.
 * - Expected samples to close: `expectedSamplesDisjoint` from coverage-model
 *   for all bins. It integrates the exact Poissonised expression numerically
 *   (Simpson's rule), so it is the coupon-collector expectation to within
 *   0.01 samples of the closed form H_k/q + B(p/q, k+1)/q (pinned by tests),
 *   shown rounded to whole samples. For k equally likely bins of probability q each the closed form
 *   H_k / q is used (`harmonic` from coverage-model).
 *   A single bin of probability p takes 1/p samples on average (geometric).
 * - A seeded run uses `createRng` from coverage-model, so a seed always gives
 *   the same run.
 *
 * Industry practice, not IEEE 1800-2023 (the lesson's four trap bullets):
 * - A waiver is a recorded decision with a reason: the bin is marked waived,
 *   not covered. Whether a report then excludes it from the denominator is a
 *   tool and project choice, so both figures are given.
 * - Coverage counts as evidence only from runs whose checks were live.
 * - A coverage model that lacks plan items reports 100% of an incomplete
 *   model: measured against the plan, the denominator grows.
 */

import { createRng, expectedSamplesDisjoint, harmonic } from "@/lib/coverage-model";

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export const COMMON_BIN_OPTIONS = [4, 8, 16, 32] as const;
export const RARE_PROBABILITY_OPTIONS = [0.001, 0.01, 0.05] as const;
export const BUDGET_OPTIONS = [100, 200, 500, 1000, 5000] as const;
/** The plan items the coverage model lacks, for the "plan gap" action. */
export const PLAN_GAP_ITEMS = ["reset mid-count", "back-to-back wrap"] as const;
export const MIN_WAIVER_REASON = 10;
export const MAX_COMMON_BINS = 64;
/** Sample counts of the lesson's static figure; the text table uses them too. */
export const FIGURE_CHECKPOINTS = [10, 20, 50, 100, 1000, 5000] as const;
export const PREDICTION_CHOICES = [100, 1000, 100000] as const;
/** The follow-on lesson that teaches covergroups, at_least and crosses. */
export const FOLLOW_ON_LESSON = { id: "I-SV-3A", title: "Functional Coverage Fundamentals", href: "/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index" } as const;
/** The "go further" setting: the most common bins at the rarest probability. */
export const GO_FURTHER_CONFIG = { commonBins: 32, rareP: 0.001 } as const;

export interface ClosureConfig {
  commonBins: number;
  /** Probability that one sample lands in the rare bin, 0 < p < 1. */
  rareP: number;
  /** Samples in one seeded run. */
  budget: number;
  /** Base seed: run k (from 1) uses `runSeedValue(seed, k)`. */
  seed: number;
}

export const DEFAULT_CONFIG: ClosureConfig = { commonBins: 16, rareP: 0.001, budget: 200, seed: 4 };

export interface ClosurePreset {
  id: string;
  /** Where the lab is embedded. */
  lesson: string;
  /** The prediction asks about this configuration. */
  config: ClosureConfig;
  /**
   * Where the workbench opens after the reveal, when it differs from the
   * prediction's configuration (otherwise it opens at `config`).
   */
  workbench?: ClosureConfig;
}

export const CLOSURE_PRESETS: Record<string, ClosurePreset> = {
  /**
   * F1B shows the static 0.1% curve (with its answer) just above the lab, so
   * the lab asks the same question at 1%, which that figure does not answer.
   * At 1% one 100-sample run hits the rare bin with probability 63.4%, so
   * that setting shows no plateau. After the reveal the workbench therefore
   * opens at the lesson's 0.1% bin (already answered by the figure), where
   * seed 2 misses the rare bin for six runs (pinned by tests).
   */
  "f1b-closure-trap": {
    id: "f1b-closure-trap",
    lesson: "T1_Foundational/F1B_The_Verification_Mindset/index.mdx > The coverage closure trap",
    config: { commonBins: 16, rareP: 0.01, budget: 100, seed: 2 },
    workbench: { commonBins: 16, rareP: 0.001, budget: 100, seed: 2 },
  },
  /** For a page without the static figure: the spec's question at 0.1%. */
  standalone: {
    id: "standalone",
    lesson: "Any page that does not already show the 0.1% closure curve",
    config: DEFAULT_CONFIG,
  },
};

export const DEFAULT_PRESET = "f1b-closure-trap";

export function getPreset(id: string | undefined): ClosurePreset {
  return (id && CLOSURE_PRESETS[id]) || CLOSURE_PRESETS[DEFAULT_PRESET];
}

/** The configuration the workbench opens at after the reveal. */
export function workbenchConfig(preset: ClosurePreset): ClosureConfig {
  return preset.workbench ?? preset.config;
}

// ---------------------------------------------------------------------------
// Probabilities and expectations
// ---------------------------------------------------------------------------

/** Validates and returns the bin probabilities: `commonBins` common bins share 1 − rareP; the last bin is the rare one. */
export function binProbabilities(commonBins: number, rareP: number): number[] {
  if (!Number.isInteger(commonBins) || commonBins < 1 || commonBins > MAX_COMMON_BINS) {
    throw new RangeError(`commonBins must be an integer from 1 to ${MAX_COMMON_BINS}`);
  }
  if (!Number.isFinite(rareP) || rareP <= 0 || rareP >= 1) {
    throw new RangeError("rareP must be greater than 0 and less than 1");
  }
  const q = (1 - rareP) / commonBins;
  return [...new Array<number>(commonBins).fill(q), rareP];
}

/** Probability that a bin of probability p has been hit at least once after n samples. */
export function hitProbability(p: number, n: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("p must be from 0 to 1");
  if (Number.isNaN(n) || n < 0) throw new RangeError("n must be 0 or more");
  if (p === 0) return 0;
  if (n === Infinity) return 1;
  return 1 - Math.pow(1 - p, n);
}

/**
 * Expected coverage after n samples: (1/K) Σ (1 − (1 − p_i)^n), the expected
 * value of |bins_covered| / |bins| (IEEE 1800-2023 §19.11.1). An empty model
 * has no coverage figure, so it is rejected.
 */
export function expectedCoverage(p: readonly number[], n: number): number {
  if (p.length === 0) throw new RangeError("a coverage model with no bins has no coverage figure");
  return p.reduce((sum, pi) => sum + hitProbability(pi, n), 0) / p.length;
}

/** Expected samples to hit every bin once (disjoint bins), or Infinity if a bin can never be hit. */
export function expectedSamplesToClose(p: readonly number[]): number {
  return expectedSamplesDisjoint(p.map((pi) => ({ p: pi, atLeast: 1 })));
}

/** Closed form for k equally likely bins of probability q each: H_k / q (coupon collector). */
export function expectedSamplesEqualBins(k: number, q: number): number {
  if (!Number.isInteger(k) || k < 0) throw new RangeError("k must be a whole number");
  if (k === 0) return 0;
  if (!(q > 0)) return Infinity;
  return harmonic(k) / q;
}

/** Expected samples for a single bin of probability p: 1/p (geometric distribution). */
export function expectedSamplesOneBin(p: number): number {
  return p > 0 ? 1 / p : Infinity;
}

export interface ClosureExpectations {
  bins: number;
  /** Expected samples to hit every bin. */
  all: number;
  /** Expected samples to hit the common bins only. */
  common: number;
  /** Expected samples for the rare bin on its own. */
  rare: number;
  /** Probability that one run of `budget` samples hits the rare bin. */
  rarePerRun: number;
}

export function closureExpectations(config: ClosureConfig): ClosureExpectations {
  const p = binProbabilities(config.commonBins, config.rareP);
  return {
    bins: p.length,
    all: expectedSamplesToClose(p),
    common: expectedSamplesEqualBins(config.commonBins, p[0]),
    rare: expectedSamplesOneBin(config.rareP),
    rarePerRun: hitProbability(config.rareP, config.budget),
  };
}

/** Log-spaced points of the expected curve from 1 to xMax. */
export function expectedCurve(p: readonly number[], xMax: number, points = 120): { n: number; coverage: number }[] {
  const top = Math.log10(Math.max(1, xMax));
  return Array.from({ length: points + 1 }, (_, i) => {
    const n = Math.pow(10, (top * i) / points);
    return { n, coverage: expectedCoverage(p, n) };
  });
}

/** Expected random runs of `budget` samples until the first one hits a bin of probability p (geometric over runs). */
export function expectedRunsToHit(p: number, budget: number): number {
  const perRun = hitProbability(p, budget);
  return perRun > 0 ? 1 / perRun : Infinity;
}

/** Formats a run count with one decimal: 1.58 → "1.6". */
export function formatRuns(runs: number): string {
  if (!Number.isFinite(runs)) return "never";
  return Number(runs.toFixed(1)).toLocaleString("en-US");
}

/** Upper end of the chart's log axis: the next power of ten above both 5 × the expected samples and the samples used. */
export function axisMax(expectedAll: number, samplesUsed: number): number {
  const reach = Math.max(1000, Number.isFinite(expectedAll) ? expectedAll * 5 : 0, samplesUsed);
  return Math.pow(10, Math.ceil(Math.log10(reach)));
}

export interface AxisTick {
  n: number;
  /** Label text, or null when the tick is drawn unlabelled to avoid crowding. */
  label: string | null;
  anchor: "start" | "middle" | "end";
}

/** Most decades the x axis labels before it labels every other one (counted back from the last, which is always labelled). */
export const MAX_LABELLED_DECADES = 5;

/**
 * Decade ticks from 1 to xMax. The last label is right-aligned so it stays
 * inside the plot; above MAX_LABELLED_DECADES decades every other tick is
 * labelled so the labels do not crowd at 390 px.
 */
export function axisTicks(xMax: number): AxisTick[] {
  const decades = Math.round(Math.log10(Math.max(1, xMax)));
  const step = decades > MAX_LABELLED_DECADES ? 2 : 1;
  return Array.from({ length: decades + 1 }, (_, i) => ({
    n: Math.pow(10, i),
    label: (decades - i) % step === 0 ? Math.pow(10, i).toLocaleString("en-US") : null,
    anchor: i === decades && decades > 0 ? "end" : "middle",
  }));
}

// ---------------------------------------------------------------------------
// Seeded runs
// ---------------------------------------------------------------------------

/** Bin index of one uniform draw u in [0, 1) against cumulative probabilities. */
export function sampleBin(p: readonly number[], u: number): number {
  let acc = 0;
  for (let i = 0; i < p.length; i += 1) {
    acc += p[i];
    if (u < acc) return i;
  }
  return p.length - 1;
}

/**
 * Runs `count` random samples with `createRng(seed)`. Returns, per bin, the
 * global index (1-based, offset by `start`) of its first hit in this run.
 */
export function runSeed(p: readonly number[], seed: number, count: number, start = 0): (number | null)[] {
  const rng = createRng(seed);
  const first: (number | null)[] = p.map(() => null);
  for (let i = 1; i <= count; i += 1) {
    const bin = sampleBin(p, rng());
    if (first[bin] === null) first[bin] = start + i;
  }
  return first;
}

/**
 * Seed of run k (1-based). createRng is a linear congruential generator, so
 * consecutive seeds give nearly equal first draws; mixing the run number
 * through a multiplicative hash keeps the runs' first samples unrelated.
 */
export function runSeedValue(base: number, run: number): number {
  return (Math.imul((base ^ Math.imul(run, 0x85ebca6b)) >>> 0, 0x9e3779b1) >>> 0) || 1;
}

/** Bins covered by random samples by sample n. */
export function coveredBy(firstHit: readonly (number | null)[], n: number): number {
  return firstHit.filter((i) => i !== null && i <= n).length;
}

// ---------------------------------------------------------------------------
// Lab state and action reducers
// ---------------------------------------------------------------------------

export type BinKind = "common" | "rare" | "plan";
export type BinStatus = "covered" | "waived" | "hole" | "not-in-model";

export type ActionId = "more-seeds" | "directed" | "waive" | "checks-off" | "plan-gap";

export interface ActionOutcome {
  action: ActionId;
  /** The action changed nothing; `text` says why. */
  refused: boolean;
  text: string;
  /** Set when a waiver was refused because of its typed reason (the input is invalid). */
  field?: "reason";
}

export interface ClosureState {
  config: ClosureConfig;
  /** Seeded runs so far (the first runs when the lab opens). */
  seedRuns: number;
  /** Per model bin: global index of the first random hit, or null. */
  firstHit: (number | null)[];
  samplesUsed: number;
  /** The rare bin was hit by a directed run. */
  directed: boolean;
  waiverReason: string | null;
  /** "Checks were off in these runs" is on: it applies to every run, directed ones included. */
  checksOff: boolean;
  /** "The plan has 2 items the model lacks" is on. */
  planGap: boolean;
  log: ActionOutcome[];
}

export type ClosureAction =
  | { type: "configure"; config: Partial<ClosureConfig> }
  | { type: "more-seeds" }
  | { type: "directed" }
  | { type: "waive"; reason: string }
  | { type: "checks-off"; on: boolean }
  | { type: "plan-gap"; on: boolean }
  | { type: "reset" };

export function initialClosureState(config: ClosureConfig = DEFAULT_CONFIG): ClosureState {
  const p = binProbabilities(config.commonBins, config.rareP);
  if (!Number.isInteger(config.budget) || config.budget < 1) throw new RangeError("budget must be a whole number of samples, 1 or more");
  return {
    config,
    seedRuns: 1,
    firstHit: runSeed(p, runSeedValue(config.seed, 1), config.budget),
    samplesUsed: config.budget,
    directed: false,
    waiverReason: null,
    checksOff: false,
    planGap: false,
    log: [],
  };
}

export function rareIndex(state: Pick<ClosureState, "config">): number {
  return state.config.commonBins;
}

export function isRareCovered(state: ClosureState): boolean {
  return state.directed || state.firstHit[rareIndex(state)] !== null;
}

/** Waiver rule (industry practice): a waiver must carry a reviewable reason. Returns null when the reason is acceptable. */
export function waiverReasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_WAIVER_REASON) {
    return `Type a reason of at least ${MIN_WAIVER_REASON} characters: a waiver is a decision someone must be able to review.`;
  }
  return null;
}

export interface ClosureSummary {
  modelBins: number;
  planBins: number;
  /** Denominator in use: the plan when the plan gap is on, otherwise the model. */
  denominator: number;
  covered: number;
  waived: number;
  holes: number;
  coverageOfModel: number;
  coverageOfPlan: number;
  /** Coverage shown on the coverage bar (against `denominator`). */
  coverage: number;
  /** Covered / (denominator − waived): what a report that excludes waived bins would show. */
  coverageExcludingWaived: number;
  /** Bins covered in runs whose checks were live. */
  evidenceBins: number;
  evidence: number;
  bins: { id: string; label: string; kind: BinKind; status: BinStatus; firstHit: number | null; directed: boolean }[];
}

export function summarize(state: ClosureState): ClosureSummary {
  const { commonBins } = state.config;
  const rare = rareIndex(state);
  const bins: ClosureSummary["bins"] = state.firstHit.map((hit, i) => {
    const kind: BinKind = i === rare ? "rare" : "common";
    const directed = i === rare && state.directed;
    const covered = hit !== null || directed;
    const status: BinStatus = covered ? "covered" : i === rare && state.waiverReason ? "waived" : "hole";
    return { id: kind === "rare" ? "rare" : `c${i + 1}`, label: kind === "rare" ? "rare bin" : `common bin ${i + 1}`, kind, status, firstHit: hit, directed };
  });
  if (state.planGap) {
    PLAN_GAP_ITEMS.forEach((item, i) => {
      bins.push({ id: `plan${i + 1}`, label: `plan item "${item}"`, kind: "plan", status: "not-in-model", firstHit: null, directed: false });
    });
  }
  const modelBins = commonBins + 1;
  const planBins = modelBins + PLAN_GAP_ITEMS.length;
  const denominator = state.planGap ? planBins : modelBins;
  const covered = bins.filter((b) => b.status === "covered").length;
  const waived = bins.filter((b) => b.status === "waived").length;
  const holes = denominator - covered - waived;
  const evidenceBins = state.checksOff ? 0 : covered;
  return {
    modelBins,
    planBins,
    denominator,
    covered,
    waived,
    holes,
    coverageOfModel: covered / modelBins,
    coverageOfPlan: covered / planBins,
    coverage: covered / denominator,
    coverageExcludingWaived: denominator - waived > 0 ? covered / (denominator - waived) : 0,
    evidenceBins,
    evidence: evidenceBins / denominator,
    bins,
  };
}

// ---------------------------------------------------------------------------
// Text, all generated from the numbers above
// ---------------------------------------------------------------------------

/** Formats a fraction as a percentage with one decimal, adding decimals when one would round a value that is not 0 or 1 to 0.0% or 100.0%. */
export function formatPercent(fraction: number): string {
  if (fraction >= 1) return "100%";
  if (fraction <= 0) return "0%";
  const pct = fraction * 100;
  for (let d = 1; d <= 4; d += 1) {
    const text = pct.toFixed(d);
    if (Number(text) < 100 && Number(text) > 0) return `${text}%`;
  }
  return pct >= 50 ? ">99.9999%" : "<0.0001%";
}

/** Formats a probability control value: 0.001 → "0.1%". */
export function formatProbability(p: number): string {
  return `${Number((p * 100).toPrecision(3))}%`;
}

/** Formats a sample count, rounded to a whole sample, with thousands separators. */
export function formatSamples(n: number): string {
  if (!Number.isFinite(n)) return "never";
  return Math.round(n).toLocaleString("en-US");
}

export function coverageSentence(s: ClosureSummary): string {
  return `${s.covered} of ${s.denominator} bins covered (${formatPercent(s.coverage)})`;
}

function rareHitText(state: ClosureState): string {
  const hit = state.firstHit[rareIndex(state)];
  return hit === null ? "" : ` The rare bin was first hit at sample ${formatSamples(hit)}.`;
}

export function moreSeedsText(before: ClosureState, after: ClosureState): string {
  const p = binProbabilities(after.config.commonBins, after.config.rareP);
  const sb = summarize(before);
  const sa = summarize(after);
  const e = closureExpectations(after.config);
  const rareNew = before.firstHit[rareIndex(before)] === null && after.firstHit[rareIndex(after)] !== null;
  return (
    `Run ${after.seedRuns} (a new seed) added ${formatSamples(after.config.budget)} samples (${formatSamples(after.samplesUsed)} in all): ` +
    `${sb.covered} → ${sa.covered} of ${sa.modelBins} model bins. Expected coverage moves from ${formatPercent(expectedCoverage(p, before.samplesUsed))} to ${formatPercent(expectedCoverage(p, after.samplesUsed))}; ` +
    `each extra seed hits the ${formatProbability(after.config.rareP)} bin with probability ${formatPercent(e.rarePerRun)}.` +
    (rareNew ? ` This seed hit the rare bin at sample ${formatSamples(after.firstHit[rareIndex(after)] as number)}.${runsVerdict(after.config)}` : "")
  );
}

/** How many runs random stimulus needs for the rare bin, and whether that is a plateau. */
function runsVerdict(config: ClosureConfig): string {
  const runs = expectedRunsToHit(config.rareP, config.budget);
  const base = ` On average a ${formatProbability(config.rareP)} bin takes about ${formatRuns(runs)} runs of ${formatSamples(config.budget)} samples`;
  return runs < 2
    ? `${base}, so at this setting one or two seeds usually close it: the plateau appears when 1/p is many runs, as with the 0.1% bin.`
    : `${base}, which is the plateau.`;
}

export function directedText(before: ClosureState, after: ClosureState): string {
  const sb = summarize(before);
  const sa = summarize(after);
  return (
    `One directed run drove the rare bin's scenario on purpose: ${sb.covered} → ${sa.covered} of ${sa.modelBins} model bins. ` +
    `Random stimulus needs about ${formatSamples(expectedSamplesOneBin(after.config.rareP))} samples on average (1/p) to hit a ${formatProbability(after.config.rareP)} bin` +
    `, about ${formatRuns(expectedRunsToHit(after.config.rareP, after.config.budget))} runs of ${formatSamples(after.config.budget)} samples` +
    (expectedRunsToHit(after.config.rareP, after.config.budget) < 2 ? ", so at this setting the directed test saves little; it pays off as the bin gets rarer." : ".") +
    (before.waiverReason ? " The bin is now covered, so its waiver is no longer needed." : "") +
    (after.checksOff ? " Checks are still off, and that covers this run too: it adds coverage but no evidence." : "")
  );
}

export function waiveText(after: ClosureState): string {
  const s = summarize(after);
  return (
    `Waived with the reason "${after.waiverReason}": the bin is marked waived, not covered. Covered stays ${s.covered} of ${s.denominator}; nothing new was exercised or checked. ` +
    `A report that leaves waived bins out of the denominator would show ${formatPercent(s.coverageExcludingWaived)}; whether it does is a tool and project choice.`
  );
}

export function checksOffText(after: ClosureState): string {
  const s = summarize(after);
  if (!after.checksOff) return `Checks live again: evidence equals coverage, ${s.evidenceBins} of ${s.denominator}.`;
  return (
    `Coverage stays ${s.covered} of ${s.denominator} (${formatPercent(s.coverage)}), but evidence drops to ${s.evidenceBins} of ${s.denominator}: a bin hit while no check could fail shows only that the stimulus happened. ` +
    `The setting applies to every run, a directed run made later included.`
  );
}

export function planGapText(after: ClosureState): string {
  const s = summarize(after);
  if (!after.planGap) return `Measured against the model again: ${s.covered} of ${s.modelBins} (${formatPercent(s.coverageOfModel)}).`;
  return (
    `The plan has ${PLAN_GAP_ITEMS.length} items the model lacks: the denominator grows from ${s.modelBins} to ${s.planBins}, so ${formatPercent(s.coverageOfModel)} of the model is ${formatPercent(s.coverageOfPlan)} of the plan. ` +
    `No sample can count toward an item that has no coverage item.`
  );
}

function withLog(state: ClosureState, outcome: ActionOutcome): ClosureState {
  return { ...state, log: [...state.log, outcome] };
}

/** The latest outcome of one action, for the line under its button. */
export function lastOutcome(state: ClosureState, action: ActionId): ActionOutcome | null {
  for (let i = state.log.length - 1; i >= 0; i -= 1) if (state.log[i].action === action) return state.log[i];
  return null;
}

/** Text alternative of the chart, generated from the same numbers it draws. */
export function chartSummary(state: ClosureState): string {
  const p = binProbabilities(state.config.commonBins, state.config.rareP);
  const all = expectedSamplesToClose(p);
  const random = coveredBy(state.firstHit, state.samplesUsed);
  return (
    `Expected coverage is ${formatPercent(expectedCoverage(p, 10))} at 10 samples, ${formatPercent(expectedCoverage(p, 100))} at 100 and ${formatPercent(expectedCoverage(p, 1000))} at 1,000; ` +
    `all ${p.length} bins are expected to close after about ${formatSamples(all)} samples. ` +
    `The seeded random runs covered ${random} of ${p.length} bins in ${formatSamples(state.samplesUsed)} samples` +
    (state.directed ? ", and a directed run covered the rare bin." : ".")
  );
}

export function closureReducer(state: ClosureState, action: ClosureAction): ClosureState {
  switch (action.type) {
    case "configure":
      return initialClosureState({ ...state.config, ...action.config });
    case "reset":
      return initialClosureState(state.config);
    case "more-seeds": {
      const { config } = state;
      const p = binProbabilities(config.commonBins, config.rareP);
      const run = runSeed(p, runSeedValue(config.seed, state.seedRuns + 1), config.budget, state.samplesUsed);
      const firstHit = state.firstHit.map((hit, i) => hit ?? run[i]);
      const next: ClosureState = { ...state, seedRuns: state.seedRuns + 1, firstHit, samplesUsed: state.samplesUsed + config.budget };
      return withLog(next, { action: "more-seeds", refused: false, text: moreSeedsText(state, next) });
    }
    case "directed": {
      if (isRareCovered(state)) return withLog(state, { action: "directed", refused: true, text: `The rare bin is already covered.${rareHitText(state)} A directed run would add no coverage.` });
      const next: ClosureState = { ...state, directed: true, waiverReason: null };
      return withLog(next, { action: "directed", refused: false, text: directedText(state, next) });
    }
    case "waive": {
      if (isRareCovered(state)) return withLog(state, { action: "waive", refused: true, text: "The rare bin is already covered: there is no hole to waive." });
      if (state.waiverReason) return withLog(state, { action: "waive", refused: true, text: "The rare bin is already waived." });
      const problem = waiverReasonProblem(action.reason);
      if (problem) return withLog(state, { action: "waive", refused: true, text: problem, field: "reason" });
      const next: ClosureState = { ...state, waiverReason: action.reason.trim() };
      return withLog(next, { action: "waive", refused: false, text: waiveText(next) });
    }
    case "checks-off": {
      if (state.checksOff === action.on) return state;
      const next: ClosureState = { ...state, checksOff: action.on };
      return withLog(next, { action: "checks-off", refused: false, text: checksOffText(next) });
    }
    case "plan-gap": {
      if (state.planGap === action.on) return state;
      const next: ClosureState = { ...state, planGap: action.on };
      return withLog(next, { action: "plan-gap", refused: false, text: planGapText(next) });
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Announcements (one live-region line per change)
// ---------------------------------------------------------------------------

/** Line announced when the settings change or the lab starts over, with the new expectations. */
export function settingsText(state: ClosureState, why: "configure" | "reset"): string {
  const { config } = state;
  const e = closureExpectations(config);
  return (
    `${why === "configure" ? "Settings changed" : "Started over"}: ${config.commonBins} common bins and a ${formatProbability(config.rareP)} rare bin, ${formatSamples(config.budget)} samples per run. ` +
    `Expect about ${formatSamples(e.all)} samples to close all ${e.bins} bins. The first run of seed ${config.seed} covered ${summarize(state).covered} of ${e.bins}.`
  );
}

/** What the live region says after an action: the action's outcome, the new settings, or nothing when nothing changed. */
export function announcementText(before: ClosureState, after: ClosureState, action: ClosureAction): string {
  if (action.type === "configure" || action.type === "reset") return settingsText(after, action.type);
  if (after.log.length > before.log.length) return after.log[after.log.length - 1].text;
  return "";
}

export interface LabView {
  lab: ClosureState;
  /** The latest announcement; `seq` grows on every announcement so identical text is re-announced. */
  notice: { text: string; seq: number };
}

export function initialLabView(config: ClosureConfig): LabView {
  return { lab: initialClosureState(config), notice: { text: "", seq: 0 } };
}

export function labViewReducer(view: LabView, action: ClosureAction): LabView {
  const lab = closureReducer(view.lab, action);
  if (lab === view.lab) return view;
  const text = announcementText(view.lab, lab, action);
  return { lab, notice: text ? { text, seq: view.notice.seq + 1 } : view.notice };
}

/** The workbench's opening line when it opens at a different setting from the one the learner predicted. */
export function workbenchIntro(preset: ClosurePreset): string | null {
  const wb = workbenchConfig(preset);
  const asked = preset.config;
  if (wb.rareP === asked.rareP && wb.commonBins === asked.commonBins && wb.budget === asked.budget) return null;
  const e = closureExpectations(wb);
  return (
    `You predicted the ${formatProbability(asked.rareP)} case. The lab opens at the lesson's ${formatProbability(wb.rareP)} bin, where the plateau shows: ` +
    `one run of ${formatSamples(wb.budget)} samples hits it with probability ${formatPercent(e.rarePerRun)}, about ${formatRuns(expectedRunsToHit(wb.rareP, wb.budget))} runs on average, ` +
    `and closing all ${e.bins} bins takes about ${formatSamples(e.all)} samples. Press More seeds a few times, then switch the rare-bin probability to ${formatProbability(asked.rareP)} and compare.`
  );
}

/** "Go further" line: a harder setting to try here, and what I-SV-3A adds, with model-computed figures. */
export function goFurtherText(): string {
  const { commonBins, rareP } = GO_FURTHER_CONFIG;
  const e = closureExpectations({ commonBins, rareP, budget: 100, seed: 1 });
  const p17 = binProbabilities(16, 0.001);
  const twice = expectedSamplesDisjoint(p17.map((p) => ({ p, atLeast: 2 })));
  return (
    `Go further: set ${commonBins} common bins at ${formatProbability(rareP)}. Closing all ${e.bins} takes about ${formatSamples(e.all)} samples, the common bins alone about ${formatSamples(e.common)}: the rare bin still sets the wait. ` +
    `${FOLLOW_ON_LESSON.id} teaches two things that make closure slower. The at_least option (IEEE 1800-2023 §19.7: a bin hit fewer times is not covered): with at_least = 2 the lesson's 17 bins at 0.1% take about ${formatSamples(twice)} samples. ` +
    `And crosses: a cross bin is a combination of coverpoint bins, so it is at most as likely as its rarest part.`
  );
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

export interface ClosurePredictionOption {
  id: string;
  label: string;
  value: number;
  correct: boolean;
  feedback: string;
}

export function predictionQuestion(commonBins: number, rareP: number): string {
  return `${commonBins} bins are common and one bin has probability ${formatProbability(rareP)}. Roughly how many random samples does it take to hit all ${commonBins + 1} bins?`;
}

/** Options 100 / 1,000 / 100,000; the correct one is nearest to the expected samples on a log scale. */
export function predictionOptions(commonBins: number, rareP: number): ClosurePredictionOption[] {
  const p = binProbabilities(commonBins, rareP);
  const all = expectedSamplesToClose(p);
  const common = expectedSamplesEqualBins(commonBins, p[0]);
  const rare = expectedSamplesOneBin(rareP);
  const distance = (v: number) => Math.abs(Math.log10(v) - Math.log10(all));
  const best = PREDICTION_CHOICES.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  const k = commonBins + 1;
  const pText = formatProbability(rareP);
  return PREDICTION_CHOICES.map((value) => {
    const correct = value === best;
    let feedback: string;
    if (correct) {
      feedback =
        `Expected samples to hit all ${k} bins: about ${formatSamples(all)}. The ${commonBins} common bins close after about ${formatSamples(common)}; ` +
        `the rest of the wait is the ${pText} bin, which on its own takes 1/p = ${formatSamples(rare)} samples on average.`;
    } else if (value < all) {
      feedback =
        `Too low. ${formatSamples(value)} samples give an expected coverage of ${formatPercent(expectedCoverage(p, value))}: the common bins close after about ${formatSamples(common)}, ` +
        `but by ${formatSamples(value)} samples the ${pText} bin has been hit with probability only ${formatPercent(hitProbability(rareP, value))}. Closing all ${k} takes about ${formatSamples(all)}.`;
    } else {
      feedback =
        `Too high. The wait is set by the rarest bin, 1/p = ${formatSamples(rare)} samples on average, so closing all ${k} takes about ${formatSamples(all)}. ` +
        `By ${formatSamples(value)} samples expected coverage is already ${formatPercent(expectedCoverage(p, value))}.`;
    }
    return { id: `n${value}`, label: `About ${formatSamples(value)}`, value, correct, feedback };
  });
}

// ---------------------------------------------------------------------------
// Text table equivalent of the chart
// ---------------------------------------------------------------------------

export interface ClosureTableRow {
  n: number;
  expected: number;
  /** Coverage of the seeded run by sample n, or null when the run has not reached n. */
  run: number | null;
}

export function closureTable(state: ClosureState): ClosureTableRow[] {
  const p = binProbabilities(state.config.commonBins, state.config.rareP);
  const marks = Array.from(new Set<number>([...FIGURE_CHECKPOINTS, state.samplesUsed])).sort((a, b) => a - b);
  return marks.map((n) => ({
    n,
    expected: expectedCoverage(p, n),
    run: n <= state.samplesUsed ? coveredBy(state.firstHit, n) / p.length : null,
  }));
}

/** Step points of the seeded run's coverage: (sample index, coverage) at each first hit, ending at samplesUsed. */
export function runSteps(state: ClosureState): { n: number; coverage: number }[] {
  const k = state.firstHit.length;
  const hits = state.firstHit.filter((i): i is number => i !== null).sort((a, b) => a - b);
  const steps = hits.map((n, i) => ({ n, coverage: (i + 1) / k }));
  steps.push({ n: state.samplesUsed, coverage: hits.length / k });
  return steps;
}
