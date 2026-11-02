/**
 * Cycle model of the F2E lesson's registered adder (`adder_reg`) and its
 * self-checking testbench (`tb_top`), edge by edge. Pure and deterministic:
 * no React, no randomness. Four-state values come from sv-four-state-model.
 *
 * Time: `clk` rises at 5 + 10k ns (edge k) and falls at 10 + 10k ns. Every
 * value recorded for edge k is the value *sampled at that edge*: what the
 * flops and the checker read before the edge's nonblocking updates land.
 *
 * Rules implemented, each cited where the code applies it (IEEE 1800-2023):
 * - §4.9.4, §10.4.2: a nonblocking assignment made at edge k is visible to
 *   every reader only from edge k + 1. The DUT's always_ff, the checker and
 *   the bench's tasks all read the pre-edge values.
 * - §7.10.2.4 (Table 7-1): pop_front on an empty queue returns the element
 *   type's default value (x for logic members) and may warn.
 * - §11.4.5, §12.4: `!=` with an ambiguous x operand gives x; an `if` treats
 *   x as false and takes the else branch. `!==` is always 0 or 1.
 * - §11.4.3: an arithmetic operand bit at x makes the whole result x.
 * - §16.3: an immediate assertion whose expression is x fails.
 * - §6.11.2: assigning to a 2-state type turns x bits into 0.
 * - §20.10: $error continues; $fatal implies $finish. §20.2: $finish ends the
 *   run, $stop only suspends it.
 * - §9.6.1: a run ends by itself when no activity of any kind remains (the
 *   clause also names one other case, all program blocks finished; this bench
 *   has none). A free-running clock is activity forever, so a missing $finish
 *   never ends ("still running at the horizon" is this model's label, not a
 *   simulator message).
 * - §9.3.2 join_any and §9.6.3 disable fork: the watchdog branch is killed when
 *   the run branch ends first.
 * - §9.2.2.2, §9.2.2.4: the checker is a plain always because always_ff and
 *   always_comb forbid other writers of their variables (fail_cnt is shared).
 * - §6.8, Table 6-7: a logic variable without an initializer starts at x;
 *   §11.4.8: ~x is x, so `logic clk;` never toggles (Table 9-2: no edge).
 * - §21.2.1.3: %0d prints an all-x value as x and a partly unknown one as X.
 *
 * Hand-traced logs in the lesson (PASS=14 FAIL=0 at 250 ns, the BUG=1 and
 * BUG=2 error times, the kata's BUG=3 errors and PASS=15) are pinned by
 * tests/lib/selfcheck-bench-model.test.ts.
 */

import { add, assignToIntegral, compare, fromNumber, hasUnknown, ifBranch, logicalNot, toUnsigned, truthOf, type Bit4 } from "@/lib/sv-four-state-model";

/* ------------------------------------------------------------------ */
/* Values and time                                                     */
/* ------------------------------------------------------------------ */

export type Val = readonly Bit4[];

export const W = 8;
export const SUM_W = W + 1;
export const CLOCK_HALF_PERIOD_NS = 5;
export const DEFAULT_TIMEOUT_NS = 10_000;
/** Bound on simulated edges (safety for runs that never end). */
export const MAX_EDGES = 400;
/** Edges simulated past the end of a run that never finishes. */
export const HORIZON_EDGES = 3;
/** drain(): the bounded wait for an empty queue, then the quiet cycles. */
export const DRAIN_MAX_CYCLES = 20;
export const DRAIN_QUIET_CYCLES = 2;

export const edgeTime = (k: number): number => CLOCK_HALF_PERIOD_NS + 2 * CLOCK_HALF_PERIOD_NS * k;
export const negedgeTime = (k: number): number => 2 * CLOCK_HALF_PERIOD_NS * (k + 1);

const xs = (width: number): Bit4[] => Array<Bit4>(width).fill("x");
const zeros = (width: number): Bit4[] => Array<Bit4>(width).fill("0");
export const bitVal = (b: 0 | 1): Val => [b === 1 ? "1" : "0"];
export const numVal = (n: number, width: number): Val => fromNumber(n, width);

/** Unsigned value of a fully known vector, else null. */
export function valueOf(v: Val): number | null {
  const u = toUnsigned(v);
  return u === null ? null : Number(u);
}

/** `%0d`: a single x when every bit is x, X when only some are (§21.2.1.3). */
export function formatDec(v: Val): string {
  const n = valueOf(v);
  if (n !== null) return String(n);
  if (v.every((b) => b === "x")) return "x";
  if (v.every((b) => b === "z")) return "z";
  return v.some((b) => b === "x") ? "X" : "Z";
}

/** `%b` of a one-bit value. */
export const formatBit = (v: Val): string => v.join("");

/** `%t` with `$timeformat(-9, 0, " ns", 0)`. */
export const formatTime = (ns: number): string => `${ns} ns`;

/** Waveform cell: a number when known, "X" when partly or wholly unknown. */
export function waveValue(v: Val): number | "X" | "Z" {
  const n = valueOf(v);
  if (n !== null) return n;
  return v.every((b) => b === "z") ? "Z" : "X";
}

/* ------------------------------------------------------------------ */
/* Stimulus: the lesson's directed tests                                */
/* ------------------------------------------------------------------ */

export type Stim = { kind: "send"; a: number; b: number } | { kind: "idle"; n: number } | { kind: "send_invalid"; a: number; b: number };

export type TestId = "smoke" | "corners" | "gaps" | "hold";
export type PresetId = TestId | "all";

export interface DirectedTest {
  id: TestId;
  /** Plan row the test exercises. */
  rule: string;
  summary: string;
  stimulus: Stim[];
  /** The kata adds this test; run_one registers it when the hold check is on or when `+TEST=hold` itself is run. */
  kata?: boolean;
}

const send = (a: number, b: number): Stim => ({ kind: "send", a, b });
const idle = (n: number): Stim => ({ kind: "idle", n });
const sendInvalid = (a: number, b: number): Stim => ({ kind: "send_invalid", a, b });

export const TESTS: Record<TestId, DirectedTest> = {
  smoke: {
    id: "smoke",
    rule: "R3 for ordinary values",
    summary: "1 + 2, 10 + 20, 100 + 27: the basic path works end to end.",
    stimulus: [send(1, 2), send(10, 20), send(100, 27), idle(1)],
  },
  corners: {
    id: "corners",
    rule: "R3 keeps the carry; R3 at the boundaries",
    summary: "0 + 0, 255 + 0, 0 + 255, 255 + 1, 255 + 255, 128 + 128, AA + 55: bit 8 can be 1, every other bit can be 0 or 1.",
    stimulus: [send(0, 0), send(255, 0), send(0, 255), send(255, 1), send(255, 255), send(128, 128), send(0xaa, 0x55), idle(1)],
  },
  gaps: {
    id: "gaps",
    rule: "R2: one result per valid input",
    summary: "valid, two idle, two back to back, idle, valid: out_valid follows in_valid one cycle later.",
    stimulus: [send(5, 5), idle(2), send(7, 8), send(9, 10), idle(1), send(11, 12), idle(1)],
  },
  hold: {
    id: "hold",
    rule: "R4: sum holds while in_valid is 0 (kata)",
    summary: "3 + 4, then two idle cycles that carry 50 + 60 and 70 + 80: sum must stay 7.",
    stimulus: [send(3, 4), sendInvalid(50, 60), sendInvalid(70, 80), idle(1)],
    kata: true,
  },
};

export const BASE_TESTS: readonly TestId[] = ["smoke", "corners", "gaps"];
export const ALL_TEST_IDS: readonly TestId[] = ["smoke", "corners", "gaps", "hold"];
export const PRESETS: readonly PresetId[] = ["smoke", "corners", "gaps", "all", "hold"];

/** The tests `+TEST=<preset>` runs; `all` adds `hold` only when the kata registered it. */
export function testsFor(preset: PresetId, holdRegistered: boolean): TestId[] {
  if (preset === "all") return holdRegistered ? [...BASE_TESTS, "hold"] : [...BASE_TESTS];
  return [preset];
}

/** The plan row a run of these tests follows: the first test's rule, then the names of the others. */
export function testsRule(tests: readonly TestId[]): string {
  const [first, ...rest] = tests;
  if (!rest.length) return TESTS[first].rule;
  const names = rest.length === 1 ? rest[0] : `${rest.slice(0, -1).join(", ")} and ${rest[rest.length - 1]}`;
  return `${TESTS[first].rule}, then ${names}`;
}

/** Number of results a correct DUT returns for these tests (one per send). */
export function expectedResultCount(tests: readonly TestId[]): number {
  return tests.reduce((n, id) => n + TESTS[id].stimulus.filter((s) => s.kind === "send").length, 0);
}

/** `model_add`: widen first, so the carry is kept. */
export function modelAdd(a: number, b: number): number {
  return a + b;
}

/* ------------------------------------------------------------------ */
/* The DUT and its mutants                                             */
/* ------------------------------------------------------------------ */

export type MutantId = 0 | 1 | 2 | 3 | "extra-stage" | "swap-ab" | "x-carry";

export interface MutantInfo {
  id: MutantId;
  /** Column label. */
  label: string;
  /** One-line description of the RTL change. */
  change: string;
  /** No test can kill it: the change never alters behaviour. */
  equivalent?: boolean;
  /** How the RTL is written for this mutant (the `case (BUG)` arm or the edit). */
  rtl: string;
}

export const MUTANTS: Record<string, MutantInfo> = {
  "0": { id: 0, label: "BUG=0 (correct)", change: "the design as specified", rtl: "default: ;" },
  "1": { id: 1, label: "BUG=1, carry stuck at 0", change: "bit 8 of sum is forced to 0", rtl: "1: next_sum[W] = 1'b0;" },
  "2": { id: 2, label: "BUG=2, off by one", change: "sum is a + b + 1", rtl: "2: next_sum = a + b + 1'b1;" },
  "3": { id: 3, label: "BUG=3, sum moves on idle cycles", change: "sum also updates when in_valid is 0", rtl: "if (in_valid || BUG == 3) sum <= next_sum;" },
  "extra-stage": { id: "extra-stage", label: "an extra pipeline stage", change: "out_valid and sum pass through one more register", rtl: "out_valid <= ov_q; sum <= sum_q;  // one more stage" },
  "swap-ab": { id: "swap-ab", label: "a and b swapped", change: "next_sum = b + a", equivalent: true, rtl: "next_sum = b + a;" },
  "x-carry": { id: "x-carry", label: "x on the carry bit", change: "the carry bit (bit 8 of sum) is driven x", rtl: "next_sum[W] = 1'bx;  // the carry bit is driven x" },
};

export const MATRIX_MUTANTS: readonly MutantId[] = [1, 2, 3, "extra-stage", "swap-ab"];
/** The columns a learner can read at the lesson's test-plan section, before the kata and the expert mutants. */
export const PLAN_MUTANTS: readonly MutantId[] = [1, 2];

export const mutantInfo = (m: MutantId): MutantInfo => MUTANTS[String(m)];

export interface DutState {
  outValid: Val;
  sum: Val;
  /** First stage of the extra-stage mutant; absent for the others. */
  stage?: { outValid: Val; sum: Val };
}

/** Flops start at x: nothing has initialised them (§6.8, Table 6-7). */
export function initialDutState(mutant: MutantId): DutState {
  const base = { outValid: xs(1), sum: xs(SUM_W) };
  return mutant === "extra-stage" ? { ...base, stage: { outValid: xs(1), sum: xs(SUM_W) } } : base;
}

/** `always_comb next_sum = a + b;` at W + 1 bits, then the mutant's edit. Any x operand bit makes the sum x (§11.4.3). */
export function dutNextSum(mutant: MutantId, a: Val, b: Val): Val {
  const base = mutant === "swap-ab" ? add(b, a, SUM_W) : add(a, b, SUM_W);
  if (mutant === 1) return ["0", ...base.slice(1)]; // bit W (the MSB, index 0) forced to 0
  if (mutant === 2) return add(base, numVal(1, SUM_W), SUM_W);
  if (mutant === "x-carry") return ["x", ...base.slice(1)];
  return base;
}

export interface DutInputs {
  rstN: Val;
  inValid: Val;
  a: Val;
  b: Val;
}

/**
 * The always_ff at one rising edge: reads the sampled inputs and state and
 * returns the state the nonblocking updates produce (visible from the next
 * edge, §4.9.4). `!rst_n` with rst_n at x is x, so the if takes the else
 * branch (§12.4): a DUT nobody reset behaves as if out of reset.
 */
export function dutStep(mutant: MutantId, state: DutState, inputs: DutInputs): { next: DutState; note: string } {
  const notRst = logicalNot(inputs.rstN);
  if (ifBranch([notRst]) === "then") {
    const next: DutState = { outValid: zeros(1), sum: zeros(SUM_W) };
    if (mutant === "extra-stage") next.stage = { outValid: zeros(1), sum: zeros(SUM_W) };
    return { next, note: mutant === "extra-stage" ? "sees rst_n = 0: R1 clears out_valid, sum and the extra stage (ov_q, sum_q)" : "sees rst_n = 0: R1 clears out_valid and sum" };
  }
  const nextSum = dutNextSum(mutant, inputs.a, inputs.b);
  const validTruth = truthOf(inputs.inValid);
  const takesSum = validTruth === "true" || mutant === 3;
  const stage1 = { outValid: [...inputs.inValid] as Val, sum: takesSum ? nextSum : (state.stage ?? state).sum };
  const whyX = hasUnknown(inputs.rstN) ? " (rst_n is x: !x is x, so the if takes the else branch, §12.4)" : "";
  if (mutant === "extra-stage") {
    // Two stages: the inputs go to ov_q and sum_q; out_valid and sum take the values ov_q and sum_q held before this edge.
    const stage = state.stage ?? { outValid: xs(1), sum: xs(SUM_W) };
    const held = formatDec(stage.sum);
    const firstStage =
      validTruth === "true"
        ? `samples in_valid = 1, a = ${formatDec(inputs.a)}, b = ${formatDec(inputs.b)}: schedules ov_q <= 1 and sum_q <= ${formatDec(nextSum)}`
        : validTruth === "false"
          ? `samples in_valid = 0: schedules ov_q <= 0, and sum_q holds ${held}`
          : `samples in_valid = x: schedules ov_q <= x, and if (in_valid) takes the else branch, so sum_q holds ${held}`;
    return {
      next: { outValid: stage.outValid, sum: stage.sum, stage: stage1 },
      note: `${firstStage}; out_valid <= ${formatBit(stage.outValid)} and sum <= ${held} (the old ov_q and sum_q)${whyX}`,
    };
  }
  let note: string;
  if (validTruth === "true") note = `samples in_valid = 1, a = ${formatDec(inputs.a)}, b = ${formatDec(inputs.b)}: schedules out_valid <= 1 and sum <= ${formatDec(nextSum)}${whyX}`;
  else if (validTruth === "false") note = mutant === 3 ? `samples in_valid = 0 but BUG=3 still schedules sum <= ${formatDec(nextSum)} (a = ${formatDec(inputs.a)}, b = ${formatDec(inputs.b)})` : `samples in_valid = 0: out_valid <= 0, sum holds ${formatDec(state.sum)} (R4)${whyX}`;
  else note = `samples in_valid = x: out_valid <= x, and if (in_valid) takes the else branch, so sum holds${whyX}`;
  return { next: { outValid: stage1.outValid, sum: stage1.sum }, note };
}

/* ------------------------------------------------------------------ */
/* Bench configuration                                                 */
/* ------------------------------------------------------------------ */

export type CompareOp = "!==" | "!=" | "assert-eq" | "int-copy";
export type CheckStyle = "queue" | "early-inline" | "early-inline-sig" | "single-expected" | "live-model";

export interface BenchConfig {
  /** Tests in run order. */
  tests: TestId[];
  /** What `+TEST=` said: a test id or "all". */
  testName: string;
  mutant: MutantId;
  /** The kata's hold check in the checker; it also registers `hold` in run_one (as does running `+TEST=hold` itself). */
  holdCheck: boolean;
  reset: "normal" | "deleted" | "init-high";
  /** `if (rst_n)` around the checker. */
  checkerGuard: "if-rst" | "none";
  compareOp: CompareOp;
  checkStyle: CheckStyle;
  /** `logic clk = 1'b0;` (zero) or `logic clk;` (none: starts at x and never toggles). */
  clockInit: "zero" | "none";
  timeoutNs: number;
  /** A test whose final idle(1) was deleted. */
  dropFinalIdle: TestId | null;
  /** Every send() followed by an idle cycle (a stimulus-changing "fix"). */
  idleAfterEachSend: boolean;
  /** The `exp_q.size() == 0` guard in check_result(). */
  unexpectedGuard: boolean;
  /** drain() drives in_valid <= 0 on its falling edges (a bench-side hack). */
  drainDrivesIdle: boolean;
  ending: "finish" | "none" | "stop";
}

export const DEFAULT_CONFIG: BenchConfig = {
  tests: [...BASE_TESTS],
  testName: "all",
  mutant: 0,
  holdCheck: false,
  reset: "normal",
  checkerGuard: "if-rst",
  compareOp: "!==",
  checkStyle: "queue",
  clockInit: "zero",
  timeoutNs: DEFAULT_TIMEOUT_NS,
  dropFinalIdle: null,
  idleAfterEachSend: false,
  unexpectedGuard: true,
  drainDrivesIdle: false,
  ending: "finish",
};

/** A config for `+TEST=<preset>` against a mutant, with the kata's hold check on or off. */
export function presetConfig(preset: PresetId, mutant: MutantId, holdCheck = false, overrides: Partial<BenchConfig> = {}): BenchConfig {
  return { ...DEFAULT_CONFIG, tests: testsFor(preset, holdCheck), testName: preset, mutant, holdCheck, ...overrides };
}

/** The stimulus a test drives under this config (with the clinic's deletions applied). */
export function effectiveStimulus(config: BenchConfig, test: TestId): Stim[] {
  let stim = [...TESTS[test].stimulus];
  if (config.dropFinalIdle === test && stim.length && stim[stim.length - 1].kind === "idle") stim = stim.slice(0, -1);
  if (config.idleAfterEachSend) stim = stim.flatMap((s) => (s.kind === "send" ? [s, idle(1)] : [s]));
  return stim;
}

/* ------------------------------------------------------------------ */
/* Queue and expectations                                               */
/* ------------------------------------------------------------------ */

export interface Expectation {
  id: number;
  a: Val;
  b: Val;
  sum: Val;
  /** Edge at which send() pushed it; -1 for pop_front's default value. */
  sentAtEdge: number;
  /** Edge at which the checker popped it (filled in as the run proceeds). */
  checkedAtEdge: number | null;
}

/** pop_front() on an empty queue returns the element type's default (every logic member x, Table 7-1) and may warn (§7.10.2.4). */
export function popFront(queue: Expectation[]): { value: Expectation; warning: string | null } {
  if (queue.length === 0) {
    return {
      value: { id: -1, a: xs(W), b: xs(W), sum: xs(SUM_W), sentAtEdge: -1, checkedAtEdge: null },
      warning: "a simulator may warn here: pop_front() on an empty queue returned the default exp_t (every logic member x) and left the queue unchanged (§7.10.2.4, Table 7-1)",
    };
  }
  return { value: queue.shift() as Expectation, warning: null };
}

export const formatQueue = (queue: readonly Expectation[]): string => (queue.length ? `{${queue.map((e) => formatDec(e.sum)).join(", ")}}` : "{}");

/* ------------------------------------------------------------------ */
/* Log                                                                  */
/* ------------------------------------------------------------------ */

export type LogKind = "test" | "error" | "summary" | "fatal" | "note";

export interface LogLine {
  time: number;
  kind: LogKind;
  text: string;
}

/** One log line as a simulator (or, for notes, this model) prints it. */
export function formatLogLine(line: LogLine): string {
  switch (line.kind) {
    case "test":
      return `${formatTime(line.time)} ${line.text}`;
    case "error":
      return `[error @ ${formatTime(line.time)}] ${line.text}`;
    case "fatal":
      return `[fatal @ ${formatTime(line.time)}] ${line.text}`;
    case "note":
      return `(model @ ${formatTime(line.time)}) ${line.text}`;
    default:
      return line.text;
  }
}

/* ------------------------------------------------------------------ */
/* Steps                                                                */
/* ------------------------------------------------------------------ */

export type BenchEvent =
  | { kind: "reset-drive" }
  | { kind: "reset-release" }
  | { kind: "test-start"; test: TestId; time: number }
  | { kind: "send"; a: number; b: number; exp: Expectation }
  | { kind: "send_invalid"; a: number; b: number }
  | { kind: "idle" }
  | { kind: "inline-check"; exp: Expectation; actual: Val; pass: boolean }
  | { kind: "drain-check"; time: number; size: number; empty: boolean }
  | { kind: "drain-quiet"; time: number; remaining: number }
  | { kind: "drain-drive-idle"; time: number }
  | { kind: "report"; time: number }
  | { kind: "finish"; time: number }
  | { kind: "stop"; time: number }
  | { kind: "watchdog-killed"; time: number }
  | { kind: "watchdog-fired"; time: number };

export type CheckerAction =
  | { kind: "absent" }
  | { kind: "in-reset" }
  | { kind: "guard-x" }
  | { kind: "x-out-valid" }
  | { kind: "no-result" }
  | { kind: "hold-fail"; sum: Val; held: Val }
  | { kind: "pass"; exp: Expectation; actual: Val }
  | { kind: "x-pass"; exp: Expectation; actual: Val }
  | { kind: "fail"; exp: Expectation; actual: Val }
  | { kind: "unexpected"; actual: Val };

export interface Sampled {
  rst_n: Val;
  in_valid: Val;
  a: Val;
  b: Val;
  out_valid: Val;
  sum: Val;
}

export const SIGNAL_NAMES: readonly (keyof Sampled)[] = ["rst_n", "in_valid", "a", "b", "out_valid", "sum"];

export interface AnatomyToken {
  edgeId: string;
  t: number;
  label: string;
}

interface StepBase {
  index: number;
  time: number;
  events: BenchEvent[];
  queueAfter: Expectation[];
  passCnt: number;
  failCnt: number;
  /** Log lines printed up to and including this step. */
  logCount: number;
  /** tb_top line executing (CodeTrace key) and the lines also active this step. */
  activeKey: string;
  contextKeys: string[];
  /** Anatomy node lit at this step: the one `activeKey` and `why` describe. */
  node: string;
  /** Other anatomy nodes acting at the same step: on back-to-back traffic the bench, the DUT and the checker all act on one edge. */
  alsoNodes: string[];
  tokens: AnatomyToken[];
  what: string;
  why: string;
}

export interface EdgeStep extends StepBase {
  kind: "edge";
  edge: number;
  sampled: Sampled;
  dutNote: string;
  checker: CheckerAction;
  pushed: Expectation[];
  popped: Expectation | null;
  /**
   * `what`, split so a view can show the bench's part before the DUT's and the
   * checker's are revealed. The `NoQueue` texts and `queueHidden` (all of `what`)
   * leave out what is pushed onto or popped from exp_q, for a view whose queue
   * prediction is still open.
   */
  narration: { bench: string; dut: string; checker: string; benchNoQueue: string; checkerNoQueue: string; queueHidden: string };
}

export interface MomentStep extends StepBase {
  kind: "end" | "wdog" | "horizon" | "stop";
}

export type Step = EdgeStep | MomentStep;

export type EndReason = "finish" | "fatal" | "horizon" | "stop";

export interface RunResult {
  config: BenchConfig;
  steps: Step[];
  log: LogLine[];
  passCnt: number;
  failCnt: number;
  /**
   * The counters as report() found them, before its guards added leftovers or
   * the zero-check failure. The watchdog's own fail_cnt++ runs before report(),
   * so a hung run has rawFail >= 1.
   */
  rawPass: number;
  rawFail: number;
  /** "PASS=n FAIL=m", or "" when no summary was printed. */
  summary: string;
  ended: boolean;
  endReason: EndReason;
  endTime: number;
  /** Rising edges simulated (the waveform's length). */
  edges: number;
  /** Values sampled at each edge, per signal. */
  signals: Record<keyof Sampled, Val[]>;
  /** `clk` as sampled: "clock" for a live clock, else all x. */
  clock: "clock" | "x";
  expectations: Expectation[];
  firstFailEdge: number | null;
  /** The DUT is a mutant and at least one check failed. */
  caught: boolean;
}

/* ------------------------------------------------------------------ */
/* The bench program as a coroutine                                     */
/* ------------------------------------------------------------------ */

type Wait = "posedge" | "negedge";

interface EdgeContext {
  edge: number;
  time: number;
  sampled: Sampled;
}

interface NegedgeContext {
  time: number;
  queueSize: number;
}

interface BenchIo {
  nba: (signal: "rst_n" | "in_valid" | "a" | "b", value: Val) => void;
  push: (exp: Expectation) => void;
  setExpected: (exp: Expectation) => void;
  log: (line: LogLine) => void;
  event: (e: BenchEvent) => void;
  inlineCheck: (exp: Expectation, actual: Val) => void;
  newExpectation: (a: number, b: number, edge: number) => Expectation;
}

/** The `run` branch of tb_top's main initial block, yielding at each @(posedge clk) / @(negedge clk). */
function* benchProgram(config: BenchConfig, io: BenchIo): Generator<Wait, void, EdgeContext | NegedgeContext> {
  let lastTime = 0;
  const posedge = function* (): Generator<Wait, EdgeContext, EdgeContext | NegedgeContext> {
    const ctx = (yield "posedge") as EdgeContext;
    lastTime = ctx.time;
    return ctx;
  };
  const negedge = function* (): Generator<Wait, NegedgeContext, EdgeContext | NegedgeContext> {
    const ctx = (yield "negedge") as NegedgeContext;
    lastTime = ctx.time;
    return ctx;
  };

  if (config.reset === "normal") {
    io.nba("rst_n", bitVal(0));
    io.nba("in_valid", bitVal(0));
    io.nba("a", zeros(W));
    io.nba("b", zeros(W));
    io.event({ kind: "reset-drive" });
    yield* posedge();
    yield* posedge();
    io.nba("rst_n", bitVal(1));
    io.event({ kind: "reset-release" });
  }

  for (const testId of config.tests) {
    io.log({ time: lastTime, kind: "test", text: `TEST ${testId}` });
    io.event({ kind: "test-start", test: testId, time: lastTime });
    for (const stim of effectiveStimulus(config, testId)) {
      if (stim.kind === "send") {
        const ctx = yield* posedge();
        io.nba("in_valid", bitVal(1));
        io.nba("a", numVal(stim.a, W));
        io.nba("b", numVal(stim.b, W));
        const exp = io.newExpectation(stim.a, stim.b, ctx.edge);
        io.event({ kind: "send", a: stim.a, b: stim.b, exp });
        if (config.checkStyle === "queue") io.push(exp);
        else if (config.checkStyle === "single-expected") io.setExpected(exp);
        else if (config.checkStyle === "early-inline" || config.checkStyle === "early-inline-sig") {
          const ctx2 = yield* posedge();
          io.nba("in_valid", bitVal(0));
          io.inlineCheck(exp, ctx2.sampled.sum);
        }
      } else if (stim.kind === "send_invalid") {
        yield* posedge();
        io.nba("in_valid", bitVal(0));
        io.nba("a", numVal(stim.a, W));
        io.nba("b", numVal(stim.b, W));
        io.event({ kind: "send_invalid", a: stim.a, b: stim.b });
      } else {
        for (let i = 0; i < stim.n; i += 1) {
          yield* posedge();
          io.nba("in_valid", bitVal(0));
          io.event({ kind: "idle" });
        }
      }
    }
  }

  // drain(): wait (bounded) for an empty queue on falling edges, then quiet cycles.
  for (let i = 0; i < DRAIN_MAX_CYCLES; i += 1) {
    const ctx = yield* negedge();
    if (config.drainDrivesIdle) {
      io.nba("in_valid", bitVal(0));
      io.event({ kind: "drain-drive-idle", time: ctx.time });
    }
    io.event({ kind: "drain-check", time: ctx.time, size: ctx.queueSize, empty: ctx.queueSize === 0 });
    if (ctx.queueSize === 0) break;
  }
  for (let i = 0; i < DRAIN_QUIET_CYCLES; i += 1) {
    const ctx = yield* negedge();
    io.event({ kind: "drain-quiet", time: ctx.time, remaining: DRAIN_QUIET_CYCLES - 1 - i });
  }
}

/* ------------------------------------------------------------------ */
/* Running the bench                                                   */
/* ------------------------------------------------------------------ */

const usesQueue = (c: BenchConfig) => c.checkStyle === "queue" || c.checkStyle === "early-inline" || c.checkStyle === "early-inline-sig";

export function runBench(config: BenchConfig): RunResult {
  const log: LogLine[] = [];
  const steps: Step[] = [];
  const expectations: Expectation[] = [];
  const signals: Record<keyof Sampled, Val[]> = { rst_n: [], in_valid: [], a: [], b: [], out_valid: [], sum: [] };
  const queue: Expectation[] = [];
  let expectedVar: Expectation = { id: -1, a: xs(W), b: xs(W), sum: xs(SUM_W), sentAtEdge: -1, checkedAtEdge: null };
  let pendingExpected: Expectation | null = null;
  let passCnt = 0;
  let failCnt = 0;
  let lastSum: Val = xs(SUM_W); // logic [W:0] last_sum; starts at x (§6.8)
  let dut = initialDutState(config.mutant);
  let nextExpId = 0;

  // Bench-driven variables: logic without an initializer starts at x (Table 6-7).
  const vars: Record<"rst_n" | "in_valid" | "a" | "b", Val> = {
    rst_n: config.reset === "init-high" ? bitVal(1) : xs(1),
    in_valid: xs(1),
    a: xs(W),
    b: xs(W),
  };
  let pendingNba: Partial<Record<"rst_n" | "in_valid" | "a" | "b", Val>> = {};
  let stepEvents: BenchEvent[] = [];
  let stepPushed: Expectation[] = [];
  let betweenEvents: BenchEvent[] = [];
  let inlineChecks: { exp: Expectation; actual: Val; pass: boolean }[] = [];

  const io: BenchIo = {
    nba: (signal, value) => {
      pendingNba[signal] = value;
    },
    push: (exp) => {
      queue.push(exp);
      stepPushed.push(exp);
    },
    setExpected: (exp) => {
      pendingExpected = exp; // expected <= '{...}: lands with the other nonblocking updates
    },
    log: (line) => log.push(line),
    event: (e) => stepEvents.push(e),
    inlineCheck: (exp, actual) => {
      const r = compare("!==", actual, exp.sum).result;
      const pass = r !== "1";
      if (pass) passCnt += 1;
      else {
        failCnt += 1;
        log.push({ time: edgeTimeOfCurrent(), kind: "error", text: chkMessage(exp, actual) });
      }
      exp.checkedAtEdge = currentEdge;
      inlineChecks.push({ exp, actual, pass });
      stepEvents.push({ kind: "inline-check", exp, actual, pass });
    },
    newExpectation: (a, b, edge) => {
      const exp: Expectation = { id: nextExpId, a: numVal(a, W), b: numVal(b, W), sum: numVal(modelAdd(a, b), SUM_W), sentAtEdge: edge, checkedAtEdge: null };
      nextExpId += 1;
      expectations.push(exp);
      return exp;
    },
  };

  let currentEdge = 0;
  const edgeTimeOfCurrent = () => edgeTime(currentEdge);

  const report = (time: number): void => {
    if (usesQueue(config) && queue.length) {
      failCnt += queue.length;
      log.push({ time, kind: "error", text: `CHK ${queue.length} result(s) never arrived` });
    }
    if (passCnt === 0 && failCnt === 0) {
      failCnt += 1;
      log.push({ time, kind: "error", text: "CHK nothing was checked" });
    }
    log.push({ time, kind: "summary", text: `PASS=${passCnt} FAIL=${failCnt}` });
  };

  // ---- A clock that never toggles: no edges, the watchdog ends the run (§6.8, §11.4.8, §20.10).
  if (config.clockInit === "none") {
    const events: BenchEvent[] = [];
    if (config.reset === "normal") events.push({ kind: "reset-drive" });
    if (config.reset !== "normal") {
      // run_one() prints at time 0 and send() then waits for an edge that never comes.
      const first = config.tests[0];
      if (first) {
        log.push({ time: 0, kind: "test", text: `TEST ${first}` });
        events.push({ kind: "test-start", test: first, time: 0 });
      }
    }
    failCnt += 1; // the watchdog counts the hang, then calls report()
    const rawPass = passCnt;
    const rawFail = failCnt;
    report(config.timeoutNs);
    log.push({ time: config.timeoutNs, kind: "fatal", text: `WDOG test '${config.testName}' still running at ${formatTime(config.timeoutNs)}` });
    const wdogEvents: BenchEvent[] = [{ kind: "watchdog-fired", time: config.timeoutNs }, { kind: "report", time: config.timeoutNs }];
    steps.push({
      kind: "wdog",
      index: 0,
      time: config.timeoutNs,
      events: [...events, ...wdogEvents],
      queueAfter: [],
      passCnt,
      failCnt,
      logCount: log.length,
      activeKey: "main-wdog",
      contextKeys: ["clk-decl", "clk-always"],
      node: "wdog",
      alsoNodes: [],
      tokens: [],
      what: `No rising edge ever happens: logic clk starts at x and ~x is x, so always #5 clk = ~clk; keeps writing x (§6.8, §11.4.8; Table 9-2: no edge). reset_dut() waits forever; at ${formatTime(config.timeoutNs)} the watchdog counts the hang, prints the summary and calls $fatal.`,
      why: "$fatal ends the run through an implicit $finish (§20.10). Without the watchdog this run would never end and never print a verdict.",
    });
    return {
      config,
      steps,
      log,
      passCnt,
      failCnt,
      rawPass,
      rawFail,
      summary: `PASS=${passCnt} FAIL=${failCnt}`,
      ended: true,
      endReason: "fatal",
      endTime: config.timeoutNs,
      edges: 0,
      signals,
      clock: "x",
      expectations,
      firstFailEdge: null,
      caught: false, // the only failure is the watchdog's own count: no check ever ran
    };
  }

  // ---- A live clock: run the program edge by edge.
  const program = benchProgram(config, io);
  let waiting: Wait | null = null;
  let programDone = false;
  const advance = (ctx: EdgeContext | NegedgeContext) => {
    const r = program.next(ctx);
    if (r.done) {
      programDone = true;
      waiting = null;
    } else waiting = r.value;
  };
  // Start the program: everything up to its first wait runs at t = 0.
  {
    const r = program.next(undefined as unknown as EdgeContext);
    if (r.done) programDone = true;
    else waiting = r.value;
  }
  // Nonblocking updates made at t = 0 land before edge 0.
  const applyNba = () => {
    (Object.keys(pendingNba) as (keyof typeof vars)[]).forEach((k) => {
      const v = pendingNba[k];
      if (v) vars[k] = v;
    });
    pendingNba = {};
    if (pendingExpected) {
      expectedVar = pendingExpected;
      pendingExpected = null;
    }
  };
  applyNba();
  const timeZeroEvents = stepEvents;
  stepEvents = [];

  let ended = false;
  let endReason: EndReason = "finish";
  let endTime = 0;
  let horizonLeft: number | null = null;
  let firstFailEdge: number | null = null;
  let rawPass = 0;
  let rawFail = 0;

  const checker = (s: Sampled, edge: number): { action: CheckerAction; popped: Expectation | null } => {
    if (config.checkStyle === "early-inline" || config.checkStyle === "early-inline-sig") return { action: { kind: "absent" }, popped: null };
    if (config.checkerGuard === "if-rst") {
      if (ifBranch(s.rst_n) === "else") {
        if (config.holdCheck) lastSum = zeros(SUM_W); // R1: sum is 0 after reset
        return { action: hasUnknown(s.rst_n) ? { kind: "guard-x" } : { kind: "in-reset" }, popped: null };
      }
    }
    if (hasUnknown(s.out_valid)) {
      failCnt += 1;
      log.push({ time: edgeTime(edge), kind: "error", text: `CHK out_valid is ${formatBit(s.out_valid)} after reset` });
      return { action: { kind: "x-out-valid" }, popped: null };
    }
    if (truthOf(s.out_valid) === "true") {
      const result = checkResult(s, edge);
      if (config.holdCheck) lastSum = s.sum;
      return result;
    }
    if (config.holdCheck && compare("!==", s.sum, lastSum).result === "1") {
      failCnt += 1;
      log.push({ time: edgeTime(edge), kind: "error", text: `CHK sum changed to ${formatDec(s.sum)} while out_valid=0 (held ${formatDec(lastSum)})` });
      return { action: { kind: "hold-fail", sum: s.sum, held: lastSum }, popped: null };
    }
    return { action: { kind: "no-result" }, popped: null };
  };

  const checkResult = (s: Sampled, edge: number): { action: CheckerAction; popped: Expectation | null } => {
    const actual = s.sum;
    let exp: Expectation;
    let popped: Expectation | null = null;
    if (config.checkStyle === "queue") {
      if (config.unexpectedGuard && queue.length === 0) {
        failCnt += 1;
        log.push({ time: edgeTime(edge), kind: "error", text: `CHK unexpected result sum=${formatDec(actual)}: nothing was sent` });
        return { action: { kind: "unexpected", actual }, popped: null };
      }
      const r = popFront(queue);
      if (r.warning) log.push({ time: edgeTime(edge), kind: "note", text: r.warning });
      exp = r.value;
      popped = exp;
      if (exp.id >= 0) exp.checkedAtEdge = edge;
    } else if (config.checkStyle === "single-expected") {
      exp = expectedVar;
      if (exp.id >= 0 && exp.checkedAtEdge === null) exp.checkedAtEdge = edge;
    } else {
      // live-model: compare with model_add(a, b) of the signals as they are now.
      const av = valueOf(s.a);
      const bv = valueOf(s.b);
      exp = { id: -2, a: s.a, b: s.b, sum: av !== null && bv !== null ? numVal(modelAdd(av, bv), SUM_W) : xs(SUM_W), sentAtEdge: -1, checkedAtEdge: edge };
    }
    const verdict = judge(config.compareOp, actual, exp.sum);
    if (verdict === "pass" || verdict === "x-pass") {
      passCnt += 1;
      return { action: verdict === "pass" ? { kind: "pass", exp, actual } : { kind: "x-pass", exp, actual }, popped };
    }
    failCnt += 1;
    log.push({ time: edgeTime(edge), kind: "error", text: chkMessage(exp, actual) });
    return { action: { kind: "fail", exp, actual }, popped };
  };

  // The watchdog wins the race when #(TIMEOUT) expires while the run branch is still busy: it counts the hang,
  // reports and calls $fatal (§20.10). On a tie with an edge this model lets the edge's work go first.
  const fireWatchdog = () => {
    failCnt += 1;
    rawPass = passCnt;
    rawFail = failCnt;
    report(config.timeoutNs);
    log.push({ time: config.timeoutNs, kind: "fatal", text: `WDOG test '${config.testName}' still running at ${formatTime(config.timeoutNs)}` });
    steps.push(momentStep("wdog", steps.length, config.timeoutNs, [...betweenEvents, { kind: "watchdog-fired", time: config.timeoutNs }, { kind: "report", time: config.timeoutNs }], queue, passCnt, failCnt, log.length, config));
    betweenEvents = [];
  };

  for (let edge = 0; edge < MAX_EDGES && !ended; edge += 1) {
    if (!programDone && edgeTime(edge) > config.timeoutNs) {
      fireWatchdog();
      ended = true;
      endReason = "fatal";
      endTime = config.timeoutNs;
      break;
    }
    currentEdge = edge;
    const time = edgeTime(edge);
    const sampled: Sampled = { rst_n: vars.rst_n, in_valid: vars.in_valid, a: vars.a, b: vars.b, out_valid: dut.outValid, sum: dut.sum };
    SIGNAL_NAMES.forEach((n) => signals[n].push(sampled[n]));

    // Active region, in this model's fixed order: the checker reads, the DUT reads, the bench tasks run.
    // All three read the pre-edge values; the queue is the only shared blocking state (see the lesson).
    const failBefore = failCnt;
    const { action, popped } = checker(sampled, edge);
    const dutResult = dutStep(config.mutant, dut, { rstN: sampled.rst_n, inValid: sampled.in_valid, a: sampled.a, b: sampled.b });
    stepEvents = [...betweenEvents];
    betweenEvents = [];
    if (edge === 0) stepEvents.unshift(...timeZeroEvents);
    stepPushed = [];
    inlineChecks = [];
    if (!programDone && waiting === "posedge") advance({ edge, time, sampled });

    // NBA region: every scheduled update lands now (§4.9.4).
    applyNba();
    dut = dutResult.next;
    const failedHere = failCnt > failBefore;
    if (failedHere && firstFailEdge === null) firstFailEdge = edge;

    const step: EdgeStep = {
      kind: "edge",
      index: steps.length,
      edge,
      time,
      sampled,
      events: stepEvents,
      dutNote: dutResult.note,
      checker: action,
      pushed: stepPushed,
      popped,
      queueAfter: [...queue],
      passCnt,
      failCnt,
      logCount: log.length,
      activeKey: "",
      contextKeys: [],
      node: "",
      alsoNodes: [],
      tokens: [],
      what: "",
      why: "",
      narration: { bench: "", dut: "", checker: "", benchNoQueue: "", checkerNoQueue: "", queueHidden: "" },
    };
    describeEdge(step, config, dut);
    steps.push(step);

    // Falling edge: drain() reads the queue here, when the checker is not running.
    const negTime = negedgeTime(edge);
    if (!programDone && negTime > config.timeoutNs) {
      fireWatchdog();
      ended = true;
      endReason = "fatal";
      endTime = config.timeoutNs;
      break;
    }
    if (!programDone && waiting === "negedge") {
      stepEvents = []; // a fresh array: the edge step above keeps its own events
      advance({ time: negTime, queueSize: queue.length });
      // drain() may wait again (another negedge) or finish; its events belong to the next step.
      betweenEvents = stepEvents;
      stepEvents = [];
      applyNba();
    }
    if (programDone && horizonLeft === null) {
      // join_any resumes main (§9.3.2); disable fork kills the waiting watchdog (§9.6.3); report(); then the ending.
      rawPass = passCnt;
      rawFail = failCnt;
      report(negTime);
      const endEvents: BenchEvent[] = [...betweenEvents, { kind: "watchdog-killed", time: negTime }, { kind: "report", time: negTime }];
      betweenEvents = [];
      if (config.ending === "finish") {
        endEvents.push({ kind: "finish", time: negTime });
        ended = true;
        endReason = "finish";
        endTime = negTime;
        steps.push(momentStep("end", steps.length, negTime, endEvents, queue, passCnt, failCnt, log.length, config));
      } else if (config.ending === "stop") {
        endEvents.push({ kind: "stop", time: negTime });
        ended = true; // the model stops here; the run is suspended, not finished
        endReason = "stop";
        endTime = negTime;
        steps.push(momentStep("stop", steps.length, negTime, endEvents, queue, passCnt, failCnt, log.length, config));
      } else {
        log.push({ time: negTime, kind: "note", text: "the summary printed, but the free-running clock keeps the simulation busy (§9.6.1)" });
        steps.push(momentStep("horizon", steps.length, negTime, endEvents, queue, passCnt, failCnt, log.length, config));
        horizonLeft = HORIZON_EDGES;
        endTime = negTime;
      }
    } else if (horizonLeft !== null) {
      horizonLeft -= 1;
      if (horizonLeft <= 0) {
        ended = true;
        endReason = "horizon";
      }
    }
  }
  if (!ended) {
    // Safety bound reached: treat as still running.
    endReason = "horizon";
    endTime = edgeTime(steps.length - 1);
    if (horizonLeft === null) {
      rawPass = passCnt;
      rawFail = failCnt;
    }
  }

  // Backfill anatomy tokens now that every expectation knows when it was checked.
  steps.forEach((s) => {
    if (s.kind === "edge") s.tokens = tokensAt(s.edge, expectations, config, s.sampled.sum);
  });

  const summaryLine = log.find((l) => l.kind === "summary");
  return {
    config,
    steps,
    log,
    passCnt,
    failCnt,
    rawPass,
    rawFail,
    summary: summaryLine ? summaryLine.text : "",
    ended: endReason === "finish" || endReason === "fatal",
    endReason,
    endTime,
    edges: signals.sum.length,
    signals,
    clock: "clock",
    expectations,
    firstFailEdge,
    caught: config.mutant !== 0 && failCnt > 0,
  };
}

/** `CHK a=%0d b=%0d: sum=%0d, expected %0d` (§21.2.1.3 for x and X). */
export const chkMessage = (exp: Expectation, actual: Val): string => `CHK a=${formatDec(exp.a)} b=${formatDec(exp.b)}: sum=${formatDec(actual)}, expected ${formatDec(exp.sum)}`;

/**
 * The compare each operator makes, with the standard's x rules:
 * - `!==` compares x and z as values (§11.4.5): 0 or 1, never x.
 * - `!=` is x when known bits agree and some bit is x; `if (x)` takes the else
 *   branch (§12.4), so the X result is counted as a pass ("x-pass").
 * - `assert (actual == exp)`: an x expression fails the assertion (§16.3).
 * - `int s = actual; if (s != exp)`: x bits in actual become 0 first (§6.11.2).
 *   A compare that is still x (an x in the expected value) also takes the else
 *   branch, so it too is counted as a pass ("x-pass").
 */
export function judge(op: CompareOp, actual: Val, expected: Val): "pass" | "fail" | "x-pass" {
  switch (op) {
    case "!==":
      return compare("!==", actual, expected).result === "1" ? "fail" : "pass";
    case "!=": {
      const r = compare("!=", actual, expected).result;
      if (r === "1") return "fail";
      return r === "x" ? "x-pass" : "pass";
    }
    case "assert-eq":
      return compare("==", actual, expected).result === "1" ? "pass" : "fail";
    case "int-copy": {
      const copied = assignToIntegral(actual, { states: 2, width: 32 }).bits;
      const r = compare("!=", copied, expected).result;
      if (r === "1") return "fail";
      return r === "x" ? "x-pass" : "pass";
    }
    default:
      return "fail";
  }
}

/** pass_cnt moved on a result with an unknown bit, or on a compare that came out x: nothing showed the result to be right. */
export const passWithoutMatch = (c: CheckerAction): boolean => c.kind === "x-pass" || (c.kind === "pass" && hasUnknown(c.actual));

function momentStep(kind: MomentStep["kind"], index: number, time: number, events: BenchEvent[], queue: Expectation[], passCnt: number, failCnt: number, logCount: number, config: BenchConfig): MomentStep {
  const base = { index, time, events, queueAfter: [...queue], passCnt, failCnt, logCount, contextKeys: [] as string[], alsoNodes: [] as string[], tokens: [] as AnatomyToken[] };
  const drained = events.find((e) => e.kind === "drain-quiet" || e.kind === "drain-check");
  const drainText = drained ? "drain() finished its quiet cycles, so the run branch ended. " : "";
  switch (kind) {
    case "end":
      return {
        ...base,
        kind,
        activeKey: "main-finish",
        contextKeys: ["main-disable", "main-report", "report-display"],
        node: "rpt",
        what: `${formatTime(time)}: ${drainText}join_any resumed main, disable fork killed the waiting watchdog, report() printed PASS=${passCnt} FAIL=${failCnt}, and $finish ended the run.`,
        why: "join_any resumes when the first branch ends (§9.3.2); disable fork kills every descendant of main, here only the watchdog (§9.6.3); $finish returns control to the operating system (§20.2).",
      };
    case "stop":
      return {
        ...base,
        kind,
        activeKey: "main-finish",
        contextKeys: ["main-report"],
        node: "rpt",
        what: `${formatTime(time)}: report() printed PASS=${passCnt} FAIL=${failCnt}, then $stop suspended the simulation (§20.2). What happens next is tool-dependent; it does not exit the simulator the way $finish does.`,
        why: "§20.2 says $stop causes simulation to be suspended. What follows is tool-dependent: an interactive prompt, or a batch flow that may continue or quit. It does not exit the simulator the way $finish does, and $fatal ends a run through its implicit $finish (§20.10).",
      };
    case "horizon":
      return {
        ...base,
        kind,
        activeKey: "main-report",
        contextKeys: ["clk-always"],
        node: "rpt",
        what: `${formatTime(time)}: report() printed PASS=${passCnt} FAIL=${failCnt}, and then nothing ends the run: there is no $finish, and disable fork already killed the watchdog. The clock keeps toggling: still running at the horizon (a model label).`,
        why: "A simulation ends by itself when no activity of any kind remains (§9.6.1; this bench has no program blocks, the other case that clause names). always #5 clk = ~clk; is activity forever.",
      };
    default:
      return {
        ...base,
        kind,
        activeKey: "main-wdog",
        contextKeys: ["main-report"],
        node: "wdog",
        what: `${formatTime(time)}: the watchdog's #(TIMEOUT) expired first: fail_cnt++, report() printed PASS=${passCnt} FAIL=${failCnt}, and $fatal ended the run with the WDOG message (test '${config.testName}').`,
        why: "$fatal prints a fatal error and implies $finish (§20.10), so a run that outlasts TIMEOUT still ends with a verdict line.",
      };
  }
}

/* ------------------------------------------------------------------ */
/* Narration, active code line and anatomy node per step                */
/* ------------------------------------------------------------------ */

const sendEvent = (s: EdgeStep) => s.events.find((e): e is Extract<BenchEvent, { kind: "send" }> => e.kind === "send");

function describeEdge(step: EdgeStep, config: BenchConfig, nextDut: DutState): void {
  const { sampled, checker, events, edge } = step;
  const parts: string[] = [];
  const noQueueParts: string[] = [];
  const say = (text: string, noQueue: string = text) => {
    parts.push(text);
    noQueueParts.push(noQueue);
  };
  const context = new Set<string>();
  let active = "";
  let node = "";
  let why = "";
  const t = formatTime(step.time);

  const between = events.filter((e) => e.kind === "drain-check" || e.kind === "drain-quiet" || e.kind === "drain-drive-idle");
  between.forEach((e) => {
    if (e.kind === "drain-check") say(`At ${formatTime(e.time)} (falling edge) drain() found exp_q ${e.empty ? "empty" : `holding ${e.size}`}${e.empty ? ": two quiet cycles follow" : ", so it keeps waiting"}.`, `At ${formatTime(e.time)} (falling edge) drain() checked exp_q; the queue is hidden until you predict.`);
    if (e.kind === "drain-quiet") say(`At ${formatTime(e.time)} drain() counted a quiet cycle${e.remaining ? ` (${e.remaining} more)` : ""}.`);
    if (e.kind === "drain-drive-idle") say(`At ${formatTime(e.time)} drain() drove in_valid <= 0.`);
    context.add("drain");
  });
  if (events.some((e) => e.kind === "reset-drive")) {
    say("Before this edge, at 0 ns, reset_dut() drove rst_n, in_valid, a and b with <=.");
    context.add("reset-task");
  }

  // Bench actions at this edge, in the order the run branch executes them.
  const sendEv = sendEvent(step);
  const testStart = events.find((e): e is Extract<BenchEvent, { kind: "test-start" }> => e.kind === "test-start");
  const inline = events.find((e): e is Extract<BenchEvent, { kind: "inline-check" }> => e.kind === "inline-check");
  if (events.some((e) => e.kind === "reset-release")) {
    say(`Edge ${edge} (${t}): reset_dut() releases reset with rst_n <= 1; the DUT first sees rst_n = 1 on edge ${edge + 1}.`);
    active = "reset-release";
    node = "gen";
    why = "A nonblocking update lands after every process woken by this edge has read rst_n (§4.9.4, §10.4.2), so the release is seen one edge later in every simulator.";
  }
  if (sendEv) {
    const where = config.checkStyle === "queue" ? ` and pushes ${formatDec(sendEv.exp.sum)} onto exp_q` : config.checkStyle === "single-expected" ? ` and sets expected to ${formatDec(sendEv.exp.sum)}` : "";
    const sendLead = `${active ? "" : `Edge ${edge} (${t}): `}send(${sendEv.a}, ${sendEv.b}) drives in_valid, a and b with <=`;
    say(`${sendLead}${where}.`, config.checkStyle === "queue" ? `${sendLead}; the queue is hidden until you predict.` : `${sendLead}${where}.`);
    context.add("send-drive");
    if (config.checkStyle === "queue") context.add("send-push");
    if (!active) {
      active = "send-drive";
      node = "stim";
      why = `The <= updates land after every process woken by this edge has run (§4.9.4, §10.4.2), so the DUT samples ${sendEv.a} and ${sendEv.b} on edge ${edge + 1}.`;
    }
  }
  const sendInv = events.find((e): e is Extract<BenchEvent, { kind: "send_invalid" }> => e.kind === "send_invalid");
  if (sendInv) {
    say(`${active ? "" : `Edge ${edge} (${t}): `}send_invalid(${sendInv.a}, ${sendInv.b}) drives new a and b with in_valid <= 0: the DUT must ignore them (R4).`);
    context.add("send-invalid");
    if (!active) {
      active = "send-invalid";
      node = "stim";
      why = "R4: when in_valid is 0, sum keeps its value. Only a check on idle cycles can see a DUT that recomputes anyway.";
    }
  }
  if (events.some((e) => e.kind === "idle")) {
    say(`${active ? "" : `Edge ${edge} (${t}): `}idle() drives in_valid <= 0.`);
    context.add("idle");
    if (!active) {
      active = "idle";
      node = "stim";
      why = "An idle cycle drives in_valid low, so the DUT gets no further valid input; the final idle(1) of every test keeps in_valid from staying high into the next test or drain().";
    }
  }
  if (testStart) {
    say(`${active ? "" : `Edge ${edge} (${t}): `}run_one("${testStart.test}") prints "${formatTime(testStart.time)} TEST ${testStart.test}".`);
    context.add("run-display");
    context.add(`test-${testStart.test}`);
    if (!active) {
      active = "run-display";
      node = "tests";
      why = "The TEST line marks where each test begins, in the log and on the waveform's time axis.";
    }
  }
  if (inline) {
    say(`The inline check reads sum = ${formatDec(inline.actual)} against model_add(${formatDec(inline.exp.a)}, ${formatDec(inline.exp.b)}) = ${formatDec(inline.exp.sum)}: ${inline.pass ? "a match" : "a mismatch, one edge too early"}.`);
    active = "send-check";
    node = "chk";
    why = "The DUT samples the inputs on this edge and schedules sum with <=, so a read on the same edge sees the previous result (§4.9.4).";
  }

  if (!parts.length || !parts[0].startsWith("Edge")) {
    parts.unshift(`Edge ${edge} (${t}).`);
    noQueueParts.unshift(`Edge ${edge} (${t}).`);
  }
  const benchText = parts.join(" ");
  const benchNoQueue = noQueueParts.join(" ");

  // Whichever part acts next takes over the highlight; the part it displaces stays lit beside it.
  const alsoNodes = new Set<string>();
  const takeOver = (nextActive: string, nextNode: string, nextWhy: string) => {
    if (active) context.add(active);
    if (node) alsoNodes.add(node);
    active = nextActive;
    node = nextNode;
    why = nextWhy;
  };

  // The DUT: it acts when it samples a valid input, when BUG=3 recomputes on an idle cycle, and when an extra stage moves a result to its outputs.
  const dutLine = `The DUT ${step.dutNote}.`;
  say(dutLine);
  const extraStage = config.mutant === "extra-stage";
  const samplesValid = step.dutNote.startsWith("samples in_valid = 1");
  const movesOnIdle = config.mutant === 3 && step.dutNote.includes("BUG=3 still schedules");
  const secondStage = extraStage && truthOf(nextDut.outValid) === "true";
  if (samplesValid || movesOnIdle || secondStage) {
    const dutKey = extraStage && samplesValid ? "dut-ff-ov" : "dut-ff-sum";
    const dutWhy = movesOnIdle
      ? "R4 says sum holds while in_valid is 0; BUG=3 recomputes it anyway. Only a check that reads sum while out_valid is 0 can see that."
      : extraStage && samplesValid
        ? "The flops read a and b as they were before this edge and schedule ov_q and sum_q with <=. out_valid and sum take those values one edge later, and the checker reads them one edge after that (§4.9.4, §10.4.2)."
        : extraStage
          ? "The second stage copies ov_q and sum_q to out_valid and sum with <=; the checker reads them on the next edge (§4.9.4, §10.4.2)."
          : "The flop reads a and b as they were before this edge and schedules the result with <=; the checker reads it one edge later (§4.9.4, §10.4.2).";
    if (inline) {
      // The inline check reads on this same edge, so it keeps the highlight and the DUT is lit beside it.
      alsoNodes.add("dut");
      context.add(dutKey);
    } else takeOver(dutKey, "dut", dutWhy);
    if (extraStage && samplesValid && secondStage) context.add("dut-ff-sum");
  }

  // The checker.
  const chk = describeChecker(checker, sampled, config);
  const checkerNoQueue = chk.noQueueText ?? chk.text;
  if (chk.text) say(chk.text, checkerNoQueue);
  if (chk.key) context.add(chk.key);
  step.narration = { bench: benchText, dut: dutLine, checker: chk.text, benchNoQueue, checkerNoQueue, queueHidden: noQueueParts.join(" ") };
  const checkerDecides = checker.kind === "pass" || checker.kind === "fail" || checker.kind === "x-pass" || checker.kind === "unexpected" || checker.kind === "hold-fail" || checker.kind === "x-out-valid";
  if (checkerDecides) takeOver(chk.key, "chk", chk.why);
  else if (!active) {
    active = chk.key || "chk-always";
    node = checker.kind === "in-reset" || checker.kind === "guard-x" ? "chk" : node || "chk";
    why = why || chk.why;
  }

  step.activeKey = active;
  step.contextKeys = [...context].filter((k) => k !== active);
  step.node = node || "chk";
  alsoNodes.delete(step.node);
  step.alsoNodes = [...alsoNodes];
  step.what = parts.join(" ");
  step.why = why || "Every process woken by this edge reads the values from before it; the nonblocking updates land afterwards (§4.9.4).";
}

/** A counted pass, in words that are true of the operator that counted it (§11.4.5, §16.3, §6.11.2). */
function passWords(op: CompareOp, actual: Val): { verdict: string; note: string } {
  const unknown = hasUnknown(actual);
  switch (op) {
    case "!=":
      return { verdict: "a match, pass_cnt++", note: "!= is 0 only when every bit is known and equal (§11.4.5)." };
    case "assert-eq":
      return { verdict: "a match: the assertion holds and its pass statement runs pass_cnt++", note: "An immediate assertion reads its expression like an if condition, and only a nonzero known value holds (§16.3)." };
    case "int-copy":
      return unknown
        ? { verdict: "the X itself is no match, but its 2-state copy matched, so pass_cnt++", note: "s = actual turned every x bit into 0 before the compare (§6.11.2), so the x was lost." }
        : { verdict: "a match, pass_cnt++", note: "s = actual changes nothing when every bit is known (§6.11.2)." };
    default:
      return { verdict: unknown ? "equal as values (x matches x), pass_cnt++" : "a match, pass_cnt++", note: "!== returns 0 or 1 whatever the bits (§11.4.5)." };
  }
}

/** A counted failure, in the same terms. */
function failWords(op: CompareOp, actual: Val): string {
  const unknown = hasUnknown(actual);
  if (op === "assert-eq") return unknown ? "== gives x, so the assertion fails: fail_cnt++ and $error" : "a mismatch: the assertion fails, fail_cnt++ and $error";
  if (op === "int-copy" && unknown) return "its 2-state copy differs: fail_cnt++ and $error";
  return "a mismatch, fail_cnt++ and $error";
}

function describeChecker(action: CheckerAction, s: Sampled, config: BenchConfig): { text: string; key: string; why: string; noQueueText?: string } {
  // What the checker takes from the queue, with and without the value for a view whose queue prediction is open.
  const against = (exp: Expectation) => (config.checkStyle === "queue" ? `, pops ${formatDec(exp.sum)} from exp_q` : ` against expected ${formatDec(exp.sum)}`);
  const againstHidden = (exp: Expectation) => (config.checkStyle === "queue" ? ", pops the oldest expectation (the queue is hidden until you predict)" : against(exp));
  switch (action.kind) {
    case "absent":
      return { text: "", key: "", why: "" };
    case "in-reset":
      return { text: "The checker sees rst_n = 0 and compares nothing while the DUT is in reset.", key: "chk-guard", why: "No checks during reset: the outputs are being cleared (R1)." };
    case "guard-x":
      return {
        text: "The checker's if (rst_n) sees x and takes the else branch: nothing is compared.",
        key: "chk-guard",
        why: "An if treats x as false (§12.4). rst_n was never driven, so it has stayed at its initial x (§6.8, Table 6-7).",
      };
    case "x-out-valid":
      return {
        text: `The checker finds out_valid = ${formatBit(s.out_valid)} after reset: $isunknown fails the check.`,
        key: "chk-isunknown",
        why: "R1 says the outputs are known after reset; $isunknown(out_valid) is 1 for an x or z bit (§20.9).",
      };
    case "no-result":
      return { text: `The checker sees out_valid = 0: nothing to compare${config.holdCheck ? `, and sum = ${formatDec(s.sum)} still holds` : ""}.`, key: "chk-outvalid", why: "Results are matched on out_valid, so idle cycles cost nothing." };
    case "hold-fail":
      return {
        text: `The checker sees out_valid = 0 but sum = ${formatDec(action.sum)} while the last result was ${formatDec(action.held)}: the hold check fails.`,
        key: "chk-hold",
        why: "R4: sum must keep its value while in_valid is 0. !== compares every bit, so any change is a mismatch (§11.4.5).",
      };
    case "pass": {
      const words = passWords(config.compareOp, action.actual);
      return {
        text: `The checker reads out_valid = 1 and sum = ${formatDec(action.actual)}${against(action.exp)}: ${words.verdict}.`,
        noQueueText: `The checker reads out_valid = 1 and sum = ${formatDec(action.actual)}${againstHidden(action.exp)}: ${words.verdict}.`,
        key: "check-cmp",
        why: `The checker reads out_valid and sum as they were before this edge: the DUT writes them with <=, after every process woken by the edge has run (§4.9.4). ${words.note}`,
      };
    }
    case "x-pass": {
      const cause = config.compareOp === "int-copy" ? "the 2-state copy is known but the expected value has x bits, so s != e.sum gives x" : "the known bits agree and some bit is x, so != gives x";
      return {
        text: `The checker reads sum = ${formatDec(action.actual)} against ${formatDec(action.exp.sum)}: ${cause}, the if takes the else branch, and pass_cnt++ counts the result as a pass.`,
        noQueueText: `The checker reads sum = ${formatDec(action.actual)} against the oldest expectation (the queue is hidden until you predict): ${cause}, the if takes the else branch, and pass_cnt++ counts the result as a pass.`,
        key: "check-cmp",
        why: "== and != return x when the relation is ambiguous (§11.4.5); an if treats x as false and runs its else (§12.4), and this bench puts the pass there. To make an unknown fail, use !==/===, which never return x, or put the pass on the true branch of an if (==) or assertion (§16.3), so x falls to the failing side.",
      };
    }
    case "fail":
      return {
        text: `The checker reads out_valid = 1 and sum = ${formatDec(action.actual)}${against(action.exp)}: ${failWords(config.compareOp, action.actual)}.`,
        noQueueText: `The checker reads out_valid = 1 and sum = ${formatDec(action.actual)}${againstHidden(action.exp)}: ${failWords(config.compareOp, action.actual)}.`,
        key: "check-cmp",
        why: "$error reports and lets the run continue (§20.10), so one run shows every failure.",
      };
    case "unexpected":
      return {
        text: `The checker reads out_valid = 1 and sum = ${formatDec(action.actual)} but exp_q is empty: a result nobody expected, fail_cnt++.`,
        key: "check-guard",
        why: "Checking exp_q.size() first turns an extra result into a failure instead of a pop_front on an empty queue (§7.10.2.4).",
      };
    default:
      return { text: "", key: "", why: "" };
  }
}

/**
 * Anatomy edge ids (see ANATOMY_EDGES) for the tokens of the transactions in
 * flight at this edge, kept in step with the other panes:
 * - sent: a+b is on its way to the DUT, the expected sum on its way into exp_q;
 * - before the check: a+b is at the DUT (sampled, or still in its registers) and
 *   the expected sum waits in exp_q, on no wire;
 * - checked: actual (the sum the checker read) meets expected on the checker's two inputs.
 */
function tokensAt(edge: number, expectations: readonly Expectation[], config: BenchConfig, sampledSum: Val): AnatomyToken[] {
  const tokens: AnatomyToken[] = [];
  const inFlight = expectations.filter((e) => e.sentAtEdge <= edge && (e.checkedAtEdge === null ? edge - e.sentAtEdge <= 3 : edge <= e.checkedAtEdge)).slice(-3);
  for (const e of inFlight) {
    const dataLabel = `${formatDec(e.a)}+${formatDec(e.b)}`;
    const expLabel = formatDec(e.sum);
    const age = edge - e.sentAtEdge;
    const checkAge = e.checkedAtEdge === null ? 2 : e.checkedAtEdge - e.sentAtEdge;
    if (age === 0) {
      tokens.push({ edgeId: "stim-dut", t: 0.55, label: dataLabel });
      if (config.checkStyle === "queue") tokens.push({ edgeId: "model-q", t: 0.8, label: expLabel });
      else if (config.checkStyle === "single-expected") tokens.push({ edgeId: "stim-model", t: 0.7, label: expLabel });
    } else if (age < checkAge) {
      // The extra stage's second edge has the result leaving the DUT; the checker still reads it one edge later.
      tokens.push(age === checkAge - 1 && checkAge > 2 ? { edgeId: "dut-chk", t: 0.08, label: dataLabel } : { edgeId: "stim-dut", t: 0.92, label: dataLabel });
    } else if (e.checkedAtEdge !== null) {
      tokens.push({ edgeId: "dut-chk", t: 0.92, label: formatDec(sampledSum) });
      if (config.checkStyle === "queue") tokens.push({ edgeId: "q-chk", t: 0.88, label: expLabel });
    }
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Anatomy diagram data (mirrors the lesson's diagram)                   */
/* ------------------------------------------------------------------ */

export interface AnatomyNodeSpec {
  id: string;
  label: string;
  sublabel?: string;
  kind: "test" | "generic" | "driver" | "dut" | "model" | "fifo" | "scoreboard";
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  container?: boolean;
  /** CodeTrace key the node jumps to. */
  codeKey: string;
}

export interface AnatomyEdgeSpec {
  id: string;
  from: string;
  to: string;
  style: "data" | "causal";
  label: string;
}

export const ANATOMY_NODES: readonly AnatomyNodeSpec[] = [
  { id: "top", label: "tb_top", kind: "generic", col: 0, row: 0, colSpan: 2, rowSpan: 5, container: true, codeKey: "tb-module" },
  { id: "tests", label: "test_*()", sublabel: "chosen by +TEST=", kind: "test", col: 0, row: 0, codeKey: "run-one" },
  { id: "gen", label: "clock + reset", sublabel: "always #5, reset_dut()", kind: "generic", col: 1, row: 0, codeKey: "clk-always" },
  { id: "stim", label: "send() / idle()", sublabel: "drive with <=", kind: "driver", col: 0, row: 1, codeKey: "send-drive" },
  { id: "dut", label: "dut", sublabel: "adder_reg", kind: "dut", col: 1, row: 1, codeKey: "dut-inst" },
  { id: "model", label: "model_add()", sublabel: "from the spec", kind: "model", col: 0, row: 2, codeKey: "model-add" },
  { id: "q", label: "exp_q[$]", sublabel: "oldest first", kind: "fifo", col: 0, row: 3, codeKey: "exp-decl" },
  { id: "chk", label: "checker", sublabel: "always @(posedge clk)", kind: "scoreboard", col: 1, row: 3, codeKey: "chk-always" },
  { id: "wdog", label: "watchdog", sublabel: "#(TIMEOUT), $fatal", kind: "generic", col: 0, row: 4, codeKey: "main-wdog" },
  { id: "rpt", label: "report()", sublabel: "PASS=n FAIL=m", kind: "generic", col: 1, row: 4, codeKey: "report" },
];

export const ANATOMY_EDGES: readonly AnatomyEdgeSpec[] = [
  { id: "tests-stim", from: "tests", to: "stim", style: "causal", label: "calls" },
  { id: "gen-dut", from: "gen", to: "dut", style: "data", label: "clk, rst_n" },
  { id: "stim-dut", from: "stim", to: "dut", style: "data", label: "in_valid, a, b" },
  { id: "stim-model", from: "stim", to: "model", style: "causal", label: "model_add(a_val, b_val)" },
  { id: "model-q", from: "model", to: "q", style: "data", label: "push_back" },
  { id: "dut-chk", from: "dut", to: "chk", style: "data", label: "out_valid, sum" },
  { id: "q-chk", from: "q", to: "chk", style: "data", label: "pop_front" },
  { id: "chk-rpt", from: "chk", to: "rpt", style: "data", label: "pass_cnt, fail_cnt" },
  { id: "wdog-rpt", from: "wdog", to: "rpt", style: "causal", label: "on timeout" },
];

/* ------------------------------------------------------------------ */
/* Source generation (kept in sync with the model's data)                */
/* ------------------------------------------------------------------ */

export interface SourceLine {
  text: string;
  key?: string;
  owner?: "design" | "testbench";
}

const fmtStim = (s: Stim): string =>
  s.kind === "send" ? `send(8'd${s.a}, 8'd${s.b});` : s.kind === "send_invalid" ? `send_invalid(8'd${s.a}, 8'd${s.b});` : `idle(${s.n});`;

/** The DUT as the lesson writes it, with the mutant's edit in place. */
export function dutSource(mutant: MutantId): SourceLine[] {
  const d = (text: string, key?: string): SourceLine => ({ text, key, owner: "design" });
  const bugParam = typeof mutant === "number" ? mutant : 0;
  const lines: SourceLine[] = [
    d(`module adder_reg #(parameter int W = 8, parameter int BUG = ${bugParam}) (`, "dut-module"),
    d("  input  logic clk, rst_n, in_valid, input logic [W-1:0] a, b,"),
    d("  output logic out_valid, output logic [W:0] sum);"),
    d("  timeunit 1ns; timeprecision 1ps;        // every module needs one (3.14.2.3)", "dut-timeunit"),
    d(mutant === "extra-stage" ? "  logic [W:0] next_sum, sum_q; logic ov_q;" : "  logic [W:0] next_sum;"),
    d("  always_comb begin", "dut-comb"),
    d(mutant === "swap-ab" ? "    next_sum = b + a;                      // mutant: operands swapped" : "    next_sum = a + b;                      // W+1 bits: the carry is kept"),
  ];
  if (mutant === "x-carry") lines.push(d("    next_sum[W] = 1'bx;                    // mutant: the carry bit is driven x", "dut-bug"));
  else {
    lines.push(d("    case (BUG)", "dut-bug"));
    lines.push(d("      1: next_sum[W] = 1'b0;               // mutant 1: carry stuck at 0"));
    lines.push(d("      2: next_sum = a + b + 1'b1;          // mutant 2: off by one"));
    lines.push(d("      default: ;"));
    lines.push(d("    endcase"));
  }
  lines.push(d("  end"));
  lines.push(d("  always_ff @(posedge clk) begin", "dut-ff"));
  lines.push(d(mutant === "extra-stage" ? "    if (!rst_n) {out_valid, sum, ov_q, sum_q} <= '0;   // R1" : "    if (!rst_n) begin out_valid <= 1'b0; sum <= '0; end  // R1", "dut-ff-reset"));
  if (mutant === "extra-stage") {
    lines.push(d("    else begin"));
    lines.push(d("      ov_q <= in_valid; if (in_valid) sum_q <= next_sum;", "dut-ff-ov"));
    lines.push(d("      out_valid <= ov_q; sum <= sum_q;        // mutant: one more stage", "dut-ff-sum"));
    lines.push(d("    end"));
  } else {
    lines.push(d("    else begin"));
    lines.push(d("      out_valid <= in_valid;               // R2: one result per valid input", "dut-ff-ov"));
    lines.push(d(mutant === 3 ? "      if (in_valid || BUG == 3) sum <= next_sum;  // mutant 3: moves on idle cycles" : "      if (in_valid) sum <= next_sum;       // R3; otherwise sum holds (R4)", "dut-ff-sum"));
    lines.push(d("    end"));
  }
  lines.push(d("  end"));
  lines.push(d("endmodule"));
  return lines;
}

/** tb_top as the config describes it: the lesson's bench, the kata's additions, or a clinic's broken variant. */
export function benchSource(config: BenchConfig): SourceLine[] {
  const t = (text: string, key?: string): SourceLine => ({ text, key, owner: "testbench" });
  const bugParam = typeof config.mutant === "number" ? config.mutant : 0;
  // run_one() knows test_hold when the kata's check is in (the kata registers it) or when +TEST=hold is the run itself.
  const registered: readonly TestId[] = config.holdCheck || config.tests.includes("hold") ? ALL_TEST_IDS : BASE_TESTS;
  const lines: SourceLine[] = [t("module tb_top;", "tb-module"), t("  timeunit 1ns; timeprecision 1ps;", "tb-timeunit")];
  lines.push(t("  localparam int W = 8;", "w-decl"));
  lines.push(t(`  localparam realtime TIMEOUT = ${config.timeoutNs >= 1000 ? `${config.timeoutNs / 1000}us` : `${config.timeoutNs}ns`};`, "timeout"));
  lines.push(t(config.clockInit === "zero" ? "  logic clk = 1'b0;                 // must start known: ~x stays x" : "  logic clk;", "clk-decl"));
  lines.push(t(config.reset === "init-high" ? "  logic rst_n = 1'b1;" : "  logic rst_n;", "rst-decl"));
  lines.push(t("  logic in_valid; logic [W-1:0] a, b; logic out_valid; logic [W:0] sum;", "sig-decl"));
  lines.push(t("  typedef struct { logic [W-1:0] a, b; logic [W:0] sum; } exp_t;"));
  if (config.checkStyle === "single-expected") lines.push(t("  exp_t expected;", "exp-decl"));
  else if (config.checkStyle === "live-model") lines.push(t("  // no expectation storage: the checker recomputes from a and b", "exp-decl"));
  else lines.push(t(config.checkStyle === "queue" ? "  exp_t exp_q[$];                   // one expectation per transaction, oldest first" : "  exp_t exp_q[$];", "exp-decl"));
  lines.push(t("  int pass_cnt = 0, fail_cnt = 0;", "cnt-decl"));
  if (config.holdCheck) lines.push(t("  logic [W:0] last_sum;             // the last result the DUT reported", "last-sum-decl"));
  lines.push(t(`  adder_reg #(.W(W), .BUG(${bugParam})) dut (.clk(clk), .rst_n(rst_n), .in_valid(in_valid),`, "dut-inst"));
  lines.push(t("    .a(a), .b(b), .out_valid(out_valid), .sum(sum));"));
  lines.push(t(config.clockInit === "zero" ? "  always #5 clk = ~clk;              // rising edges at 5, 15, 25 ns ..." : "  always #5 clk = ~clk;", "clk-always"));
  lines.push(t("  function automatic logic [W:0] model_add(input logic [W-1:0] op_a, op_b);", "model-add"));
  lines.push(t("    return {1'b0, op_a} + {1'b0, op_b};   // widen first: the carry is kept"));
  lines.push(t("  endfunction"));
  if (config.reset === "normal") {
    lines.push(t("  task automatic reset_dut(input int cycles = 2);", "reset-task"));
    lines.push(t("    rst_n <= 1'b0; in_valid <= 1'b0; a <= '0; b <= '0;", "reset-drive"));
    lines.push(t("    repeat (cycles) @(posedge clk);"));
    lines.push(t("    rst_n <= 1'b1;                   // just after an edge: seen on the next one", "reset-release"));
    lines.push(t("  endtask"));
  }
  lines.push(t("  task automatic send(input logic [W-1:0] a_val, b_val);", "send-task"));
  lines.push(t("    @(posedge clk);", "send-wait"));
  lines.push(t("    in_valid <= 1'b1; a <= a_val; b <= b_val;   // <= lands after the DUT's flops read this edge", "send-drive"));
  if (config.checkStyle === "queue") lines.push(t("    exp_q.push_back(exp_t'{a: a_val, b: b_val, sum: model_add(a_val, b_val)});", "send-push"));
  else if (config.checkStyle === "single-expected") lines.push(t("    expected <= exp_t'{a: a_val, b: b_val, sum: model_add(a_val, b_val)};", "send-push"));
  else if (config.checkStyle === "early-inline" || config.checkStyle === "early-inline-sig") {
    lines.push(t("    @(posedge clk);"));
    lines.push(t("    in_valid <= 1'b0;"));
    const rhs = config.checkStyle === "early-inline" ? "model_add(a_val, b_val)" : "model_add(a, b)";
    lines.push(t(`    if (sum !== ${rhs}) begin fail_cnt++; $error("CHK a=%0d b=%0d: sum=%0d, expected %0d", a_val, b_val, sum, ${rhs}); end`, "send-check"));
    lines.push(t("    else pass_cnt++;"));
  }
  lines.push(t("  endtask"));
  lines.push(t("  task automatic idle(input int n);", "idle-task"));
  lines.push(t("    repeat (n) begin @(posedge clk); in_valid <= 1'b0; end", "idle"));
  lines.push(t("  endtask"));
  if (registered.includes("hold")) {
    lines.push(t("  task automatic send_invalid(input logic [W-1:0] a_val, b_val);", "send-invalid-task"));
    lines.push(t("    @(posedge clk); in_valid <= 1'b0; a <= a_val; b <= b_val;   // new data, no valid", "send-invalid"));
    lines.push(t("  endtask"));
  }
  if (config.checkStyle !== "early-inline" && config.checkStyle !== "early-inline-sig") {
    lines.push(t("  function automatic void check_result(input logic [W:0] actual);", "check-task"));
    if (config.checkStyle === "queue") {
      lines.push(t("    exp_t e;"));
      if (config.compareOp === "int-copy") lines.push(t("    int s;"));
      if (config.unexpectedGuard) {
        lines.push(t('    if (exp_q.size() == 0) begin fail_cnt++; $error("CHK unexpected result sum=%0d: nothing was sent", actual); return; end', "check-guard"));
      }
      lines.push(t("    e = exp_q.pop_front();", "check-pop"));
    } else if (config.checkStyle === "single-expected") {
      lines.push(t("    exp_t e = expected;", "check-pop"));
      if (config.compareOp === "int-copy") lines.push(t("    int s;"));
    } else {
      lines.push(t("    exp_t e = '{a: a, b: b, sum: model_add(a, b)};   // from the signals as they are now", "check-pop"));
      if (config.compareOp === "int-copy") lines.push(t("    int s;"));
    }
    if (config.compareOp === "int-copy") lines.push(t("    s = actual;                        // 2-state copy: every x bit becomes 0 (6.11.2)", "check-copy"));
    lines.push(t(compareLine(config.compareOp), "check-cmp"));
    lines.push(t('      fail_cnt++; $error("CHK a=%0d b=%0d: sum=%0d, expected %0d", e.a, e.b, actual, e.sum);', "check-fail"));
    // The assertion form already counted the pass in its pass statement; its else block just closes.
    lines.push(t(config.compareOp === "assert-eq" ? "    end" : "    end else pass_cnt++;", "check-pass"));
    lines.push(t("  endfunction"));
    lines.push(t("  always @(posedge clk) begin         // a plain always: fail_cnt has other writers (9.2.2.4)", "chk-always"));
    if (config.checkerGuard === "if-rst") lines.push(t("    if (rst_n) begin                 // no checks while the DUT is in reset", "chk-guard"));
    else lines.push(t("    begin                            // no reset guard", "chk-guard"));
    lines.push(t('      if ($isunknown(out_valid)) begin fail_cnt++; $error("CHK out_valid is %b after reset", out_valid); end', "chk-isunknown"));
    lines.push(t(config.holdCheck ? "      else if (out_valid) begin check_result(sum); last_sum = sum; end" : "      else if (out_valid) check_result(sum);", "chk-outvalid"));
    if (config.holdCheck) {
      lines.push(t('      else if (sum !== last_sum) begin fail_cnt++; $error("CHK sum changed to %0d while out_valid=0 (held %0d)", sum, last_sum); end', "chk-hold"));
      lines.push(t("    end else last_sum = '0;            // R1: sum is 0 after reset"));
    } else lines.push(t("    end"));
    lines.push(t("  end"));
  }
  registered.forEach((id) => {
    lines.push(t(`  task automatic test_${id}();`, `test-${id}`));
    effectiveStimulus(config, id).forEach((s, i) => lines.push(t(`    ${fmtStim(s)}`, `test-${id}-${i}`)));
    lines.push(t("  endtask"));
  });
  lines.push(t("  task automatic run_one(input string name);", "run-one"));
  lines.push(t('    $display("%t TEST %s", $time, name);', "run-display"));
  lines.push(t(`    case (name) ${registered.map((id) => `"${id}": test_${id}();`).join(" ")}`));
  lines.push(t(`      default: $fatal(1, "TEST unknown test '%s' (use ${registered.join(", ")}, all)", name); endcase`));
  lines.push(t("  endtask"));
  if (usesQueue(config)) {
    lines.push(t(`  task automatic drain(input int max_cycles = ${DRAIN_MAX_CYCLES});`, "drain-task"));
    lines.push(t(config.drainDrivesIdle ? "    repeat (max_cycles) begin @(negedge clk); in_valid <= 1'b0; if (exp_q.size() == 0) break; end" : "    repeat (max_cycles) begin @(negedge clk); if (exp_q.size() == 0) break; end", "drain"));
    // An inline check has no always checker for a late result to reach, so the comment says only what the line does.
    const inlineCheck = config.checkStyle === "early-inline" || config.checkStyle === "early-inline-sig";
    lines.push(t(`    repeat (${DRAIN_QUIET_CYCLES}) @(negedge clk);           // two quiet cycles${inlineCheck ? "" : ": time for a late result to reach the checker"}`, "drain-quiet"));
  } else {
    // No queue to wait for: the model's drain() is one falling edge plus the quiet ones.
    lines.push(t("  task automatic drain();", "drain-task"));
    lines.push(t(config.drainDrivesIdle ? `    @(negedge clk); in_valid <= 1'b0; repeat (${DRAIN_QUIET_CYCLES}) @(negedge clk);` : `    repeat (${1 + DRAIN_QUIET_CYCLES}) @(negedge clk);           // one falling edge, then two quiet cycles`, "drain"));
  }
  lines.push(t("  endtask"));
  lines.push(t("  function automatic void report();", "report"));
  if (usesQueue(config)) lines.push(t('    if (exp_q.size() != 0) begin fail_cnt += exp_q.size(); $error("CHK %0d result(s) never arrived", exp_q.size()); end', "report-leftover"));
  lines.push(t('    if (pass_cnt == 0 && fail_cnt == 0) begin fail_cnt++; $error("CHK nothing was checked"); end', "report-nothing"));
  lines.push(t('    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);', "report-display"));
  lines.push(t("  endfunction"));
  lines.push(t("  initial begin : main", "main"));
  lines.push(t('    string test_name; $timeformat(-9, 0, " ns", 0);'));
  lines.push(t('    if (!$value$plusargs("TEST=%s", test_name)) test_name = "all";', "main-plusarg"));
  lines.push(t("    fork", "main-fork"));
  lines.push(t("      begin : run"));
  if (config.reset === "normal") lines.push(t("        reset_dut();", "main-reset-call"));
  lines.push(t(`        if (test_name == "all") begin ${registered.map((id) => `run_one("${id}");`).join(" ")} end`, "main-run-all"));
  lines.push(t("        else run_one(test_name);"));
  lines.push(t("        drain();", "main-drain"));
  lines.push(t("      end"));
  lines.push(t("      begin : watchdog", "main-wdog"));
  lines.push(t('        #(TIMEOUT); fail_cnt++; report(); $fatal(1, "WDOG test \'%s\' still running at %t", test_name, $time);'));
  lines.push(t("      end"));
  lines.push(t("    join_any                           // resume when either branch ends (9.3.2)", "main-join"));
  lines.push(t("    disable fork;                      // kill the branch still running (9.6.3)", "main-disable"));
  lines.push(t("    report();", "main-report"));
  if (config.ending === "finish") lines.push(t("    $finish;", "main-finish"));
  else if (config.ending === "stop") lines.push(t("    $stop;", "main-finish"));
  lines.push(t("  end"));
  lines.push(t("endmodule"));
  return lines;
}

function compareLine(op: CompareOp): string {
  switch (op) {
    case "!==":
      return "    if (actual !== e.sum) begin        // !== : x and z compare as values, so an x bit against a known bit is a mismatch";
    case "!=":
      return "    if (actual != e.sum) begin";
    case "assert-eq":
      return "    assert (actual == e.sum) pass_cnt++; else begin   // an x expression fails the assertion";
    case "int-copy":
      return "    if (s != e.sum) begin              // compares the 2-state copy";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Mutation matrix                                                      */
/* ------------------------------------------------------------------ */

export interface MatrixCell {
  state: "caught" | "survived";
  summary: string;
  run: RunResult;
}

export interface MutationMatrixData {
  rows: readonly TestId[];
  columns: readonly MutantId[];
  cells: Record<TestId, Record<string, MatrixCell>>;
}

export const columnId = (m: MutantId): string => (typeof m === "number" ? `bug${m}` : m);

/** Every matrix test against every matrix mutant, run by the model. */
export function buildMatrix(holdCheck: boolean): MutationMatrixData {
  const cells = {} as Record<TestId, Record<string, MatrixCell>>;
  ALL_TEST_IDS.forEach((test) => {
    cells[test] = {};
    MATRIX_MUTANTS.forEach((m) => {
      const run = runBench(presetConfig(test, m, holdCheck));
      cells[test][columnId(m)] = { state: run.failCnt > 0 ? "caught" : "survived", summary: run.summary, run };
    });
  });
  return { rows: ALL_TEST_IDS, columns: MATRIX_MUTANTS, cells };
}

/** Why a test let a mutant through, derived from the run. */
export function explainEscape(test: TestId, mutant: MutantId, holdCheck: boolean, run: RunResult): string {
  const sums = run.expectations.map((e) => valueOf(e.sum) ?? 0);
  const n = sums.length;
  switch (mutant) {
    case 1: {
      const max = Math.max(...sums);
      return `No ${test} result reaches 256 (the largest is ${max}), so bit 8 of every expected sum is 0. A carry stuck at 0 produces the same ${n} sum${n === 1 ? "" : "s"}: the stimulus never provokes the bug, so the check has nothing to see.`;
    }
    case 2:
      return `Every result is one too large, so the off-by-one can never escape a test that checks a result.`;
    case 3:
      return holdCheck
        ? `${test} never changes a or b on an idle cycle, so recomputing a + b there gives the value sum already holds. The hold check is in place, but this stimulus gives it nothing to catch: the kata's send_invalid() is what provokes BUG=3.`
        : `The checker compares sum only when out_valid is 1, so a sum that moves on idle cycles is never looked at. No stimulus can catch BUG=3 until the bench also checks that sum holds while out_valid is 0 (R4).`;
    case "extra-stage":
      return `The queue matches values in order, not timing: each result arrives one edge later and still pops the right expectation, and drain() waits for an empty queue before the summary. A latency change is invisible to this bench; a time sent field in exp_t would catch it.`;
    case "swap-ab":
      return `a + b and b + a are equal for every pair of operands, so the mutant changes the code but never the behaviour. No test can kill an equivalent mutant; count it out of the mutation score.`;
    case "x-carry":
      return `The compare uses !=: when the known bits agree and bit 8 is x the result is x, and the if takes the else branch (§11.4.5, §12.4), so every X result was counted as a pass.`;
    default:
      return `No check failed.`;
  }
}

/* ------------------------------------------------------------------ */
/* Prediction questions for the stepper                                 */
/* ------------------------------------------------------------------ */

export interface PredictionChoice {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface PredictionSpec {
  question: string;
  options: PredictionChoice[];
}

/**
 * The lesson's "on which edge does the checker see the first result?" question,
 * generated from the run. Values on the wire come from the run's own steps, not
 * from the expectation: a mutant's result can differ from what was expected.
 */
export function edgePrediction(run: RunResult): PredictionSpec | null {
  const first = run.expectations.find((e) => e.checkedAtEdge !== null);
  if (!first) return null;
  const s = first.sentAtEdge;
  const c = first.checkedAtEdge as number;
  const a = formatDec(first.a);
  const b = formatDec(first.b);
  const sentCall = `send(${a}, ${b})`;
  const expected = formatDec(first.sum);
  const edgeStep = (k: number) => run.steps.find((st): st is EdgeStep => st.kind === "edge" && st.edge === k);
  // What the checker reads at edge c, and what the DUT computes from the inputs it samples at edge s + 1.
  const actual = formatDec(edgeStep(c)?.sampled.sum ?? first.sum);
  const sampledInputs = edgeStep(s + 1)?.sampled;
  const scheduled = sampledInputs ? formatDec(dutNextSum(run.config.mutant, sampledInputs.a, sampledInputs.b)) : expected;
  const isQueue = run.config.checkStyle === "queue";
  const extraStage = run.config.mutant === "extra-stage";
  const expectedNote = scheduled === expected ? "" : ` (the expected value is ${expected}, so this result is already wrong)`;
  // Every edge from the send to one past the check, so the tempting wrong answers are all offered
  // (for the extra-stage DUT that includes the lesson's normal answer, edge s + 2).
  const edges = Array.from({ length: c - s + 2 }, (_, i) => s + i);
  const latency = c - s === 2 ? "one edge for the DUT, one for the checker" : `${c - s - 1} edges inside the DUT, one for the checker`;
  const options: PredictionChoice[] = edges.map((k) => {
    const label = `Edge ${k} (${formatTime(edgeTime(k))})`;
    if (k === s)
      return { id: `e${k}`, label, correct: false, feedback: `Edge ${k} is when ${sentCall} drives in_valid, a and b with <=. Those updates land after every process woken by this edge has run (§4.9.4, §10.4.2), so the DUT has not even sampled the inputs yet.` };
    if (k === c) {
      const mismatch = actual === expected ? "" : ` The expected value is ${expected} and the actual value is ${actual}: a mismatch, so this DUT fails the check.`;
      return {
        id: `e${k}`,
        label,
        correct: true,
        feedback: `${c - s === 2 ? "One edge for the DUT to sample the inputs, one for the checker to read the registered result." : `The DUT takes ${c - s - 1} edges to produce the result, and the checker reads it one edge after that.`} At edge ${c} the checker reads out_valid = 1 and sum = ${actual} as they were before this edge's updates${isQueue ? `, and pops ${expected} from exp_q` : ""}.${mismatch}`,
      };
    }
    if (k === s + 1)
      return {
        id: `e${k}`,
        label,
        correct: false,
        feedback: extraStage
          ? `At edge ${k} the DUT samples in_valid = 1, a = ${a}, b = ${b} and schedules ov_q <= 1 and sum_q <= ${scheduled}${expectedNote}: the first of its two stages. out_valid and sum do not take these values until a later edge, so the checker still sees the old out_valid and sum (§4.9.4).`
          : `At edge ${k} the DUT samples in_valid = 1, a = ${a}, b = ${b} and schedules out_valid <= 1 and sum <= ${scheduled} with <=${expectedNote}. That update lands after the checker's read of this edge, so the checker still sees the old out_valid and sum (§4.9.4).`,
      };
    if (k < c)
      return {
        id: `e${k}`,
        label,
        correct: false,
        feedback: extraStage
          ? `At edge ${k} the result is still moving through the DUT's registers: the DUT here has an extra pipeline stage, so only now does it schedule out_valid <= 1 and sum <= ${scheduled} from ov_q and sum_q. Those updates land after the checker's read of this edge (§4.9.4), one edge later than the lesson's two-edge latency.`
          : `At edge ${k} the result is still moving through the DUT's registers. Each stage's <= update lands after the checker's read of that edge (§4.9.4).`,
      };
    return { id: `e${k}`, label, correct: false, feedback: `By edge ${k} the result has already been checked, at edge ${c}. The latency is counted once: ${latency}.` };
  });
  return {
    question: `In +TEST=${run.config.testName}, ${sentCall} runs on edge ${s}. On which edge does the checker see the result of ${sentCall} (out_valid = 1)?`,
    options,
  };
}

/** The default edge for the queue question (the lesson asks about edge 6). */
export const QUEUE_QUESTION_EDGE = 6;

/** "What does exp_q hold after edge 6?", generated from the run's queue states. */
export function queuePrediction(run: RunResult, atEdge = QUEUE_QUESTION_EDGE): PredictionSpec | null {
  const edgeSteps = run.steps.filter((s): s is EdgeStep => s.kind === "edge");
  const target = edgeSteps.find((s) => s.edge === atEdge);
  if (!target || run.config.checkStyle !== "queue") return null;
  const correct = formatQueue(target.queueAfter);
  const before = edgeSteps.find((s) => s.edge === atEdge - 1);
  const after = edgeSteps.find((s) => s.edge === atEdge + 1);
  const allPushed = run.expectations.filter((e) => e.sentAtEdge <= atEdge);
  const describeStep = (s: EdgeStep) => {
    const bits: string[] = [];
    if (s.pushed.length) bits.push(`send() pushed ${s.pushed.map((e) => formatDec(e.sum)).join(" and ")}`);
    if (s.popped) bits.push(`the checker popped ${formatDec(s.popped.sum)}`);
    return bits.length ? bits.join(" and ") : "nothing was pushed or popped";
  };
  const options: PredictionChoice[] = [
    {
      id: "correct",
      label: correct,
      correct: true,
      feedback: `At edge ${atEdge} ${describeStep(target)}, leaving ${correct}. ${target.queueAfter.length > 1 ? `${target.queueAfter.length} results are in flight at once, and the queue absorbs them: the checker never needs to know the latency.` : target.queueAfter.length === 1 ? "One result is in flight: it pops when out_valid says so." : "Nothing is in flight: every result sent so far has been checked."}`,
    },
  ];
  const addDistractor = (id: string, label: string, feedback: string) => {
    if (label !== correct && !options.some((o) => o.label === label)) options.push({ id, label, correct: false, feedback });
  };
  if (before) addDistractor("before", formatQueue(before.queueAfter), `That is exp_q after edge ${atEdge - 1}. At edge ${atEdge} ${describeStep(target)}.`);
  if (after) addDistractor("after", formatQueue(after.queueAfter), `That is exp_q after edge ${atEdge + 1}: at edge ${atEdge + 1} ${describeStep(after)}. The question asks about edge ${atEdge}.`);
  addDistractor(
    "all-pushed",
    formatQueue(allPushed),
    `That is every expectation pushed up to edge ${atEdge}, as if nothing had been popped. The checker pops the oldest expectation each time out_valid is 1: ${allPushed
      .filter((e) => e.checkedAtEdge !== null && (e.checkedAtEdge as number) <= atEdge)
      .map((e) => `${formatDec(e.sum)} at edge ${e.checkedAtEdge}`)
      .join(", ") || "none yet"}.`,
  );
  if (options.length < 3) addDistractor("empty", "{}", `The queue is not empty after edge ${atEdge}: ${describeStep(target)}.`);
  // A two-option question is a coin flip: when the edges around atEdge all collapse onto the answer
  // (+TEST=hold: one send, then only send_invalid and idle), build distractors from other mistakes.
  if (options.length < 3) {
    const invalidSums = edgeSteps
      .filter((s) => s.edge <= atEdge)
      .flatMap((s) => s.events.filter((e): e is Extract<BenchEvent, { kind: "send_invalid" }> => e.kind === "send_invalid"))
      .map((e) => formatDec(numVal(modelAdd(e.a, e.b), SUM_W)));
    if (invalidSums.length)
      addDistractor(
        "phantom",
        `{${[...target.queueAfter.map((e) => formatDec(e.sum)), ...invalidSums].join(", ")}}`,
        `send_invalid() drives new a and b with in_valid <= 0 and pushes nothing onto exp_q: only send() creates an expectation, because only a valid input owes a result (R2, R4).`,
      );
  }
  if (options.length < 3) {
    const later = edgeSteps.find((s) => s.edge === atEdge + 2);
    if (later) addDistractor("later", formatQueue(later.queueAfter), `That is exp_q after edge ${atEdge + 2}. The question asks about edge ${atEdge}, where ${describeStep(target)}.`);
  }
  if (options.length < 3) {
    const earlier = [...edgeSteps].reverse().find((s) => s.edge < atEdge && s.queueAfter.length > 0);
    if (earlier) addDistractor("earlier", formatQueue(earlier.queueAfter), `That is exp_q after edge ${earlier.edge}, the last edge before ${atEdge} at which it held anything. By edge ${atEdge} ${describeStep(target)}.`);
  }
  // Order by size, then text, so the position of an option says nothing about its correctness.
  const size = (label: string) => (label === "{}" ? 0 : label.split(",").length);
  options.sort((p, q) => size(p.label) - size(q.label) || p.label.localeCompare(q.label));
  return { question: `In +TEST=${run.config.testName}, what does exp_q hold after edge ${atEdge}?`, options };
}

/**
 * Identity of a prediction: its question and its answer. A gate opened for one
 * key stays open for any run with the same key (BUG=1 or a/b swapped does not
 * move a result), and re-arms when the question or the answer changes.
 */
export function predictionKey(spec: PredictionSpec | null): string {
  return spec ? `${spec.question}|${spec.options.find((o) => o.correct)?.label ?? ""}` : "";
}

export interface HoldCheckChoice extends PredictionChoice {
  /** The rows this answer says catch BUG=3. */
  catchers: readonly TestId[];
}

/**
 * "With the hold check on, which rows catch BUG=3?", asked before the toggle
 * shows it. The correct answer and the summaries come from the runs.
 */
export function holdCheckPrediction(matrix: MutationMatrixData = buildMatrix(true)): { question: string; options: HoldCheckChoice[] } {
  const bug3 = columnId(3);
  const actual = matrix.rows.filter((t) => matrix.cells[t][bug3].state === "caught");
  const summary = (t: TestId) => matrix.cells[t][bug3].summary;
  const answers: { id: string; label: string; catchers: readonly TestId[]; feedback: string }[] = [
    {
      id: "none",
      label: "No row",
      catchers: [],
      feedback: `The hold check does fire. In +TEST=hold, send_invalid() moves a and b while out_valid is 0, and BUG=3 moves sum with them: ${summary("hold")}.`,
    },
    {
      id: "hold",
      label: "+TEST=hold only",
      catchers: ["hold"],
      feedback: `Only test_hold drives new a and b on idle cycles, so only there does BUG=3's recomputed sum differ from the value held, and only the hold check reads sum on those cycles: ${summary("hold")}. The mutant needs both the stimulus and the check.`,
    },
    {
      id: "gaps-hold",
      label: "+TEST=gaps and +TEST=hold",
      catchers: ["gaps", "hold"],
      feedback: `+TEST=gaps has idle cycles, but idle() leaves a and b as they were, so BUG=3 recomputes the value sum already holds: ${summary("gaps")}.`,
    },
    {
      id: "every",
      label: "Every row",
      catchers: matrix.rows,
      feedback: `The check is in every test's bench, but smoke, corners and gaps never change a or b on an idle cycle, so BUG=3 recomputes the value sum already holds and nothing fails (+TEST=smoke: ${summary("smoke")}).`,
    },
  ];
  const sameRows = (rows: readonly TestId[]) => rows.length === actual.length && rows.every((t) => actual.includes(t));
  return {
    question: "With the hold check on, which rows catch BUG=3?",
    options: answers.map((a) => ({ ...a, correct: sameRows(a.catchers) })),
  };
}

/* ------------------------------------------------------------------ */
/* Debug clinic: broken benches, suspects, fixes and grading             */
/* ------------------------------------------------------------------ */

export type ClinicCaseId = "no-reset" | "neq" | "early-check" | "single-expected" | "clk-x" | "no-idle" | "no-finish";

export interface ClinicFix {
  id: string;
  label: string;
  /** The config the fix produces. */
  apply: (c: BenchConfig) => BenchConfig;
  /** Code review verdict beyond what the model measures. */
  reviewOk: boolean;
  review: string;
}

export interface ClinicCase {
  id: ClinicCaseId;
  /** Symptom, as the lesson's debug table words it; never names the cause. */
  symptom: string;
  /** The run shown to the learner. */
  config: BenchConfig;
  /** `+TEST=` as the learner ran it, with the case's own DUT. */
  command: string;
  /** The plusargs alone, with nothing about any DUT: the label for a rerun against another DUT. */
  runArgs: string;
  /** CodeTrace key of the line that causes the symptom. For a deleted statement, the real line beside the gap; `found` says what that leaves undone. */
  culprit: string;
  /** Other lines that point at the same fault, accepted as the culprit. */
  alsoCulprits?: readonly string[];
  /** Feedback when the culprit is chosen: the cause only. The fixes are offered right after it, so the remedy belongs in the accepted fix's `review`. */
  found: string;
  /** Diagnostic feedback for wrong suspects, by key; `LINE_FACTS` covers the rest. */
  wrong: Partial<Record<string, string>>;
  hints: [string, string, string];
  /** Rendered in this order, which must not give the answer away: the accepted fix sits at a different position from case to case. */
  fixes: ClinicFix[];
}

const broken = (preset: PresetId, overrides: Partial<BenchConfig>): BenchConfig => presetConfig(preset, 0, false, overrides);

/** True facts about each suspectable line, used when a case has no sharper diagnosis for a wrong pick. */
export const LINE_FACTS: Record<string, string> = {
  "clk-decl": "The clock variable's declaration decides whether the clock ever toggles: with an initializer it starts at 0 and always #5 flips it; without one it starts at x and ~x stays x (§6.8, §11.4.8).",
  "clk-always": "always #5 clk = ~clk; toggles a known clock every 5 ns. It is only as good as clk's initial value.",
  "model-add": "model_add() widens each operand before adding, so the carry is kept. It is written from the specification.",
  "reset-task": "reset_dut() drives every DUT input to a known value, holds rst_n low for two edges and releases it with <=.",
  "reset-release": "rst_n <= 1 right after an edge is race-free: the DUT sees the release on the next edge in every simulator (§4.9.4).",
  "send-drive": "send() drives in_valid, a and b with <= right after the edge, so the DUT samples them on the next edge. The drive is race-free.",
  "send-push": "One expectation per transaction, pushed when the stimulus is driven, so the checker can match results in order.",
  "send-check": "A compare inside send() runs when send() reaches it, not when the result is valid.",
  idle: "idle() drives in_valid <= 0 for n edges. Every test must end with one so the next test, or drain(), starts from a quiet bus.",
  "check-guard": "The exp_q.size() guard turns a result nobody expected into a failure instead of a pop_front on an empty queue (§7.10.2.4).",
  "check-pop": "pop_front() takes the oldest expectation: results are matched in order.",
  "check-cmp": "The compare decides what counts as a mismatch. !== treats x and z as values; != gives x on an ambiguous compare and an if treats that x as false (§11.4.5, §12.4).",
  "chk-always": "The checker is a plain always @(posedge clk): always_ff would forbid report() and the watchdog from also writing fail_cnt (§9.2.2.4).",
  "chk-guard": "if (rst_n) skips the checks while the DUT is in reset. It also skips them whenever rst_n is x, because an if treats x as false (§12.4).",
  "chk-isunknown": "$isunknown(out_valid) fails a run whose control output is x or z after reset (§20.9).",
  "chk-outvalid": "The checker compares only when out_valid is 1, so it never needs to count edges.",
  "chk-hold": "The hold check fails when sum changes while out_valid is 0 (R4).",
  "run-one": "run_one() prints the TEST line and calls the test task named by the plusarg; an unknown name is fatal.",
  drain: "drain() waits, on falling edges, until exp_q is empty (bounded), then two quiet cycles, so a late or extra result still fails.",
  report: "report() adds leftovers to FAIL, fails a run that checked nothing, and prints exactly one summary line.",
  "main-reset-call": "The run branch starts with reset_dut(), so every test begins from a known DUT state.",
  "main-run-all": "This line runs the tests +TEST= named: every registered test for all, otherwise the one given.",
  "main-report": "main calls report() after disable fork, so the summary line prints once, when the run branch has ended.",
  "main-wdog": "The watchdog counts a hang as a failure, prints the summary and calls $fatal after TIMEOUT.",
  "main-finish": "$finish after report() is what ends a normal run; the clock would otherwise keep the simulation alive (§9.6.1, §20.2).",
  "dut-inst": "The DUT instance wires the bench signals to adder_reg; BUG selects the mutant.",
  "test-smoke": "test_smoke() sends 1 + 2, 10 + 20 and 100 + 27, then idles one cycle.",
  "test-corners": "test_corners() sends the seven boundary cases, then idles one cycle.",
  "test-gaps": "test_gaps() mixes valid and idle cycles, including two back to back, then idles one cycle.",
};

export const CLINIC_CASES: readonly ClinicCase[] = [
  {
    id: "no-reset",
    symptom: "result(s) never arrived, with PASS=0: 14 expectations and not one check",
    config: broken("all", { reset: "deleted" }),
    command: "no plusargs (all tests)",
    runArgs: "no plusargs (all tests)",
    culprit: "main-run-all",
    found:
      "Found it. The run branch goes straight to the tests: nothing drives rst_n before this line, so it stays at its initial x (§6.8, Table 6-7). The checker's if (rst_n) treats x as false (§12.4), so it compares nothing: the raw counters were PASS=0 FAIL=0, a vacuous pass. report()'s guards turned the 14 leftovers into failures.",
    wrong: {
      "chk-guard": "Close: this guard is where the x bites, but the guard is correct. Ask why rst_n is x at every edge: who was supposed to drive it?",
      "send-drive": "send() drove every transaction: the DUT produced results (out_valid rose), the checker just never looked. The TEST lines show the tests ran on time.",
      "model-add": "model_add() produced 14 expectations; the queue holds all of them at the end. Nothing was wrong with the expected values; nothing was compared.",
      report: "report() did its job: it turned 14 leftovers into FAIL=14 instead of printing PASS=0 FAIL=0. The cause is upstream.",
      "clk-decl": "The clock toggled: the TEST lines carry advancing times, and the run ended at a falling edge.",
      drain: "drain() did what it could: exp_q never empties in this run, so it ran out its 20-cycle bound and then its two quiet cycles, which is why the run ends at 410 ns. Nothing compared a result in that time either. Ask why the queue never emptied.",
    },
    hints: [
      "PASS=0 FAIL=14 with 14 leftovers means the checker never compared a single result. What condition sits around every compare?",
      "That condition reads rst_n. What value does a logic variable have before anything drives it, and how does if treat it?",
      "Who drives rst_n in this bench? Look for a write to it before the first test runs.",
    ],
    fixes: [
      {
        id: "init-high",
        label: "Initialise the variable: logic rst_n = 1'b1; (no reset task)",
        apply: (c) => ({ ...c, reset: "init-high" }),
        reviewOk: false,
        review: "Rejected. The guard opens, but the DUT was never reset: out_valid starts at x, so $isunknown fails the first edges (R1 never happened) and in_valid, a and b are x until the first send().",
      },
      {
        id: "drop-guard",
        label: "Delete the if (rst_n) guard around the checks",
        apply: (c) => ({ ...c, checkerGuard: "none" }),
        reviewOk: false,
        review: "Rejected. The guard was not the bug. Without it the checker sees the x outputs of a DUT nobody reset and fails $isunknown on the first edges, and later it compares against a DUT that may never have been cleared.",
      },
      {
        id: "restore-reset",
        label: "Restore reset_dut() at the start of the run branch",
        apply: (c) => ({ ...c, reset: "normal" }),
        reviewOk: true,
        review: "Accepted. rst_n is 0 for two edges and then released with <=, so R1 happens and the checker's guard opens on edge 2.",
      },
    ],
  },
  {
    id: "neq",
    symptom: "PASS=7 FAIL=0 although the waveform shows sum = X on every result",
    config: broken("corners", { compareOp: "!=", mutant: "x-carry" }),
    command: "+TEST=corners, against a DUT whose carry bit is driven x",
    runArgs: "+TEST=corners",
    culprit: "check-cmp",
    found:
      "Found it. actual != e.sum is x when the known bits agree and one bit is x (§11.4.5), and an if treats x as false and runs its else branch (§12.4): pass_cnt++. Every X result was counted as a pass.",
    wrong: {
      "chk-isunknown": "$isunknown guards out_valid, the control signal, and out_valid was a clean 1 on every result. The x is in sum, which this line never looks at.",
      "model-add": "The expected values are right: 0, 255, 255, 256, 510, 256, 255. The question is why an actual value with an x bit was counted as equal to them.",
      "check-pop": "pop_front returned the right expectation each time (the queue is empty at the end, with no leftovers). Look at what happens to the value it returned.",
      "send-drive": "The stimulus is correct and the DUT's low bits are correct too. The x comes from the DUT's carry bit; the bench's job was to notice it.",
      "dut-inst": "The DUT has the bug, yes, but a bench exists to catch DUT bugs. Which line let an X result through?",
    },
    hints: [
      "A pass means pass_cnt++ ran. Find the if whose else branch does that, and ask what its condition evaluates to when sum has an x bit.",
      "== and != return x, not 0, when the known bits agree and some bit is x or z (§11.4.5).",
      "What does if (x) do (§12.4)? Which operator never returns x?",
    ],
    fixes: [
      {
        id: "int-copy",
        label: "Copy sum into an int first: int s = actual; if (s != e.sum)",
        apply: (c) => ({ ...c, compareOp: "int-copy" }),
        reviewOk: false,
        review: "Rejected. A 2-state copy turns every x bit into 0 before the compare (§6.11.2): results whose carry should be 0 now pass silently, and only the ones whose carry should be 1 fail. The fact that the bit was unknown is lost.",
      },
      {
        id: "case-neq",
        label: "Compare with !== instead of !=",
        apply: (c) => ({ ...c, compareOp: "!==" }),
        reviewOk: true,
        review: "Accepted. !== compares x and z as values and always returns 0 or 1 (§11.4.5): every X result is now a failure, printed as sum=X (§21.2.1.3).",
      },
      {
        id: "assert",
        label: "Use an immediate assertion: assert (actual == e.sum) pass_cnt++; else fail",
        apply: (c) => ({ ...c, compareOp: "assert-eq" }),
        reviewOk: true,
        review: "Accepted. An immediate assertion treats x as false and fails (§16.3), so the X lands on the failing side. The lesson keeps if/else with !== until assertions are taught; either way, write every check so an unknown fails.",
      },
    ],
  },
  {
    id: "early-check",
    symptom: "each actual value equals the previous expected value: sum=0 expected 3, sum=3 expected 30, sum=30 expected 127",
    config: broken("smoke", { checkStyle: "early-inline" }),
    command: "+TEST=smoke",
    runArgs: "+TEST=smoke",
    culprit: "send-check",
    found:
      "Found it. On the second edge the DUT is only sampling a and b: it schedules sum <= a + b with <=, and that update lands after send() has read sum (§4.9.4). So the check reads sum from before this result: R1's 0 on the first check, and the previous transaction's result on every check after it.",
    wrong: {
      "send-drive": "The drive is right: <= right after the edge, so the DUT samples the new inputs on the next edge. The problem is when the result is read, not when the inputs are driven.",
      "model-add": "The expected values 3, 30 and 127 are correct; it is the actual values that are one transaction behind.",
      "dut-inst": "The DUT is fine: after the reset value 0 on the first check, each sum is the right answer for the previous inputs, which is exactly its one-cycle latency.",
      "clk-always": "The clock is fine: the error times advance by 20 ns per transaction, two edges each.",
      drain: "drain() has nothing to wait for: nothing is pushed onto exp_q in this bench, so it finds the queue empty at its first falling edge, and all three errors came from inside send() before it started.",
    },
    hints: [
      "After the first check, each actual is the right answer to the previous question. Is the DUT late, or is the bench early?",
      "The DUT samples the inputs on the edge after send() drives them, and updates sum with <=. When does that update become visible?",
      "The lesson's checker never counts edges: it waits for out_valid and pops the oldest expectation.",
    ],
    fixes: [
      {
        id: "live-sig",
        label: "Compare with model_add(a, b) of the signals instead of model_add(a_val, b_val)",
        apply: (c) => ({ ...c, checkStyle: "early-inline-sig" }),
        reviewOk: false,
        review: "Rejected. a and b already hold a_val and b_val at that edge, so the expectation does not change; the actual value is still read one edge too early.",
      },
      {
        id: "queue",
        label: "Match results on out_valid with the queue (restore the always checker)",
        apply: (c) => ({ ...c, checkStyle: "queue" }),
        reviewOk: true,
        review: "Accepted, preferred. Matching results on out_valid with a queue never counts edges: the checker fires when out_valid is 1 and pops the oldest expectation, whatever the latency.",
      },
      {
        id: "idle-each",
        label: "Add an idle cycle after every send() and keep the inline check",
        apply: (c) => ({ ...c, idleAfterEachSend: true }),
        reviewOk: false,
        review: "Rejected. The read still happens on the edge the DUT samples the inputs; an idle cycle afterwards does not move it, so the same mismatches appear.",
      },
    ],
  },
  {
    id: "single-expected",
    symptom: "each actual value equals the previous expected value, and the last result passes",
    config: broken("smoke", { checkStyle: "single-expected" }),
    command: "+TEST=smoke",
    runArgs: "+TEST=smoke",
    culprit: "send-push",
    found:
      "Found it. One expected variable cannot hold results in flight: with back-to-back sends the next send() overwrites it before the earlier result arrives, so each result except the last is compared with the expectation of the transaction after it.",
    wrong: {
      "check-cmp": "The compare is right (!== on the value it was given). The value it was given is the wrong expectation.",
      "send-drive": "The drive is race-free and on time. Look at what else send() records, and how many of them can exist at once.",
      "chk-outvalid": "Matching on out_valid is right. What the checker compares against is the problem: there is only one of them.",
      "model-add": "model_add() computed 3, 30 and 127 correctly. Where did 3 go by the time the first result arrived?",
      "check-pop": "This line reads the expected variable as it is now, and that read is correct. Ask what that variable has held by the time each result arrives.",
      drain: "drain() has no queue to wait for here: it waits one falling edge and two quiet cycles, and the errors in the log came before it started.",
      report: "report() printed the right counts. There is no queue here, so it has no leftovers to add. The cause is upstream.",
    },
    hints: [
      "Each actual is the previous transaction's answer, yet the DUT is correct. What happened to the expectation for that transaction?",
      "How many results are in flight when sends are back to back, and how many expectations can this bench hold at once?",
      "The lesson stores one struct per transaction in a queue: push_back in send(), pop_front in the checker.",
    ],
    fixes: [
      {
        id: "queue",
        label: "Use a queue: exp_q.push_back() in send(), pop_front() in the checker",
        apply: (c) => ({ ...c, checkStyle: "queue" }),
        reviewOk: true,
        review: "Accepted. A queue keeps expectations in order, push_back per send and pop_front per result, so back-to-back traffic is fine.",
      },
      {
        id: "idle-each",
        label: "Add idle(1) after every send() so one variable is enough",
        apply: (c) => ({ ...c, idleAfterEachSend: true }),
        reviewOk: false,
        review: "Passes the model, rejected in review. It passes by changing the stimulus: test_gaps no longer drives two results back to back, so the R2 row of the plan is no longer tested. Fix the scoreboard, not the test.",
      },
      {
        id: "live-model",
        label: "Compare against model_add(a, b) of the signals in the checker",
        apply: (c) => ({ ...c, checkStyle: "live-model" }),
        reviewOk: false,
        review: "Rejected. With back-to-back sends, a and b already hold the next transaction's operands when a result arrives, so those results are compared with the wrong sum; only the last result, with nothing sent after it, matches.",
      },
    ],
  },
  {
    id: "clk-x",
    symptom: "the run ends with the WDOG fatal: no TEST line, PASS=0 FAIL=1",
    config: broken("all", { clockInit: "none" }),
    command: "no plusargs (all tests)",
    runArgs: "no plusargs (all tests)",
    culprit: "clk-decl",
    found:
      "Found it. logic clk; starts at x (§6.8, Table 6-7), and ~x is x (§11.4.8), so always #5 clk = ~clk; writes x forever and no posedge is ever detected (Table 9-2). reset_dut() waits for an edge that never comes, and the watchdog ends the run with $fatal (§20.10).",
    wrong: {
      "clk-always": "The always block is the usual one. It can only toggle a clock that starts at a known value: ~x is x (§11.4.8). Look at the declaration it toggles.",
      "main-wdog": "The watchdog did exactly its job: it turned a silent hang into a verdict line and a WDOG message. It is the messenger.",
      "reset-task": "reset_dut() is waiting at repeat (cycles) @(posedge clk). Ask why that edge never arrives.",
      "main-reset-call": "The call is there and it started: the signals were driven at 0 ns. It never returned because the edges it waits for never happened.",
      drain: "drain() never ran: the run branch is still inside reset_dut(). No TEST line was printed.",
      "main-run-all": "The run branch never reached this line: no TEST line was printed, because reset_dut() never returned.",
      "main-report": "main never reached this line, because the run branch never ended. The summary in the log came from the watchdog's own report() call.",
      "chk-always": "The checker's body never ran: it is waiting at @(posedge clk), and no rising edge ever comes. Ask why.",
    },
    hints: [
      "No TEST line means run_one() never ran, so reset_dut() never returned. What does it wait for?",
      "@(posedge clk) needs a transition toward 1 (Table 9-2). What value does clk have, and what is ~ of that value (§11.4.8)?",
      "Compare the clock's declaration with the lesson's: logic clk = 1'b0;",
    ],
    fixes: [
      {
        id: "timeout",
        label: "Raise TIMEOUT to 100us",
        apply: (c) => ({ ...c, timeoutNs: 100_000 }),
        reviewOk: false,
        review: "Rejected. The hang is not slowness: no edge ever comes. The watchdog just fires later with the same PASS=0 FAIL=1.",
      },
      {
        id: "not-op",
        label: "Toggle with logical not: always #5 clk = !clk;",
        apply: (c) => c,
        reviewOk: false,
        review: "Rejected. !x is also x (§11.4.7): the clock still never leaves x and the watchdog still ends the run.",
      },
      {
        id: "init-zero",
        label: "Initialise the clock: logic clk = 1'b0;",
        apply: (c) => ({ ...c, clockInit: "zero" }),
        reviewOk: true,
        review: "Accepted. With an initializer clk starts known (§6.8) and toggles every 5 ns, so rising edges happen at 5, 15, 25 ns ...",
      },
    ],
  },
  {
    id: "no-idle",
    symptom: "unexpected result sum=127: nothing was sent, twice, after the three smoke results passed",
    config: broken("smoke", { dropFinalIdle: "smoke" }),
    command: "+TEST=smoke",
    runArgs: "+TEST=smoke",
    culprit: "test-smoke",
    alsoCulprits: ["test-smoke-2"],
    found:
      "Found it. test_smoke() ends on its last send(), and nothing drives in_valid back to 0, so it stays 1 with a = 100 and b = 27 on the bus. The DUT keeps sampling a valid input on every edge and reports 127 again and again; the checker finds exp_q empty and counts each extra result as a failure, which is exactly what the size() guard is for.",
    wrong: {
      "check-guard": "This guard is the messenger: it turned a result nobody expected into a failure. Ask why the DUT produced extra results at 75 and 85 ns.",
      "send-drive": "send() drives in_valid <= 1 as it should. Something has to drive it back to 0 after the last send, and look at who did not.",
      drain: "drain() waited for the queue to empty and two quiet cycles, as designed; the extra results arrived during that window, which is why they were caught.",
      idle: "Close: the task itself is right, but nothing in this run calls it. Look at what should have.",
      "dut-inst": "The DUT is behaving: it sees in_valid = 1 on every edge and answers every one. Look at the stimulus that left in_valid high.",
      "chk-outvalid": "The checker matched on out_valid correctly. The problem is that out_valid stayed 1 after the last expected result.",
    },
    hints: [
      "Each extra result is 127 = 100 + 27, the last addition sent. What does the DUT see on its inputs after that send()?",
      "send() drives in_valid <= 1. Which task drives it back to 0, and where should it be called at the end of a test?",
      "Compare test_smoke() with the lesson's version, line by line.",
    ],
    fixes: [
      {
        id: "drop-guard",
        label: "Delete the exp_q.size() == 0 guard in check_result()",
        apply: (c) => ({ ...c, unexpectedGuard: false }),
        reviewOk: false,
        review: "Rejected. The extra results are still there: pop_front() on an empty queue returns an exp_t with every member x (§7.10.2.4), the compare fails anyway, and the message now says expected x instead of naming the real cause.",
      },
      {
        id: "restore-idle",
        label: "End test_smoke() with idle(1)",
        apply: (c) => ({ ...c, dropFinalIdle: null }),
        reviewOk: true,
        review: "Accepted. idle(1) drives in_valid back to 0 after the last send, so the DUT produces exactly one result per transaction.",
      },
      {
        id: "drain-idle",
        label: "Make drain() drive in_valid <= 0 on its falling edges",
        apply: (c) => ({ ...c, drainDrivesIdle: true }),
        reviewOk: false,
        review: "Rejected. drain()'s first falling edge comes 5 ns after the last send(), before the DUT samples it, so in_valid <= 0 there cancels the last transaction: its result never arrives. drain() is end-of-test accounting, not a driver; the test left in_valid high and should own its cleanup with idle(1).",
      },
    ],
  },
  {
    id: "no-finish",
    symptom: "the summary prints, PASS=14 FAIL=0, but the run never ends",
    config: broken("all", { ending: "none" }),
    command: "no plusargs (all tests)",
    runArgs: "no plusargs (all tests)",
    culprit: "main-report",
    found:
      "Found it. This report() call is the last statement of main, and nothing ends the run after it: a simulation ends by itself when no activity of any kind remains (§9.6.1; this bench has no program blocks, the other case that clause names), the free-running clock is activity forever, and disable fork has already killed the watchdog, so the regression would have to kill the job.",
    wrong: {
      "main-wdog": "The watchdog cannot help: disable fork killed it when the run branch finished, and that is correct, or every clean run would end with a fatal.",
      "clk-always": "The clock is doing what a clock does. It is the reason the simulation stays alive, not a bug; something else has to end the run.",
      drain: "drain() returned: the summary printed right after it. The run branch is finished and main has no statements left; the simulation goes on because the clock is still active (§9.6.1).",
      report: "report() ran once and printed the right line. What should follow it?",
    },
    hints: [
      "The summary printed, so the run branch, join_any, disable fork and report() all completed. What is the last statement of main in the lesson?",
      "When does a simulation end by itself (§9.6.1)? What in this bench never stops producing events?",
      "Which system task returns control to the operating system (§20.2)?",
    ],
    fixes: [
      {
        id: "finish",
        label: "Add $finish; after report()",
        apply: (c) => ({ ...c, ending: "finish" }),
        reviewOk: true,
        review: "Accepted. $finish exits the simulator right after the verdict line (§20.2).",
      },
      {
        id: "stop",
        label: "Add $stop; after report()",
        apply: (c) => ({ ...c, ending: "stop" }),
        reviewOk: false,
        review: "Rejected. $stop causes simulation to be suspended (§20.2). What follows is tool-dependent: an interactive prompt, or a batch flow that may continue or quit. It does not exit the simulator the way $finish does, so a clean run should end with $finish.",
      },
      {
        id: "rely-wdog",
        label: "Rely on the watchdog to end the run after TIMEOUT",
        apply: (c) => c,
        reviewOk: false,
        review: "Rejected. disable fork killed the watchdog when the run branch ended (§9.6.3); nothing is left to fire, and a clean run should not end with a fatal anyway.",
      },
    ],
  },
];

export const clinicCase = (id: ClinicCaseId): ClinicCase => CLINIC_CASES.find((c) => c.id === id) as ClinicCase;

/** A stimulus line inside a test task: test-<id>-<n>. */
const STIM_LINE = /^test-(smoke|corners|gaps|hold)-\d+$/;

/**
 * The lines a learner may suspect: the keys of the broken bench's source that
 * have a diagnosis. Every stimulus line of every test is one, so that a suspect
 * control on the line beside a deleted statement says nothing.
 */
export function suspectKeys(source: readonly SourceLine[], kase: ClinicCase): string[] {
  const keys = new Set<string>([kase.culprit, ...(kase.alsoCulprits ?? []), ...Object.keys(kase.wrong), ...Object.keys(LINE_FACTS)]);
  return source.map((l) => l.key).filter((k): k is string => Boolean(k) && (keys.has(k as string) || STIM_LINE.test(k as string)));
}

/**
 * Whether a line of the bench executed in this run, read from the run's own
 * events and checker actions. Lines not listed here (declarations, the clock,
 * the DUT instance, the watchdog's start) run in every run.
 */
export function lineRan(run: RunResult, key: string): boolean {
  const events = run.steps.flatMap((s) => s.events);
  const has = (kind: BenchEvent["kind"]) => events.some((e) => e.kind === kind);
  const started = new Set(events.flatMap((e) => (e.kind === "test-start" ? [e.test as string] : [])));
  const kinds = new Set(run.steps.flatMap((s) => (s.kind === "edge" ? [s.checker.kind as string] : [])));
  const compared = kinds.has("pass") || kinds.has("x-pass") || kinds.has("fail");
  const test = /^test-(smoke|corners|gaps|hold)(-\d+)?$/.exec(key);
  if (test) return started.has(test[1]);
  switch (key) {
    case "reset-task":
    case "main-reset-call":
      return has("reset-drive");
    case "reset-release":
      return has("reset-release");
    case "send-drive":
    case "send-push":
    case "model-add":
      return has("send");
    case "send-check":
      return has("inline-check");
    case "idle":
      return has("idle");
    case "check-guard":
      return compared || kinds.has("unexpected");
    case "check-pop":
    case "check-cmp":
      return compared;
    case "chk-always":
    case "chk-guard":
      return run.edges > 0;
    case "chk-isunknown":
      return compared || kinds.has("unexpected") || kinds.has("no-result") || kinds.has("x-out-valid") || kinds.has("hold-fail");
    case "chk-outvalid":
      return compared || kinds.has("unexpected") || kinds.has("no-result") || kinds.has("hold-fail");
    case "chk-hold":
      return kinds.has("no-result") || kinds.has("hold-fail");
    case "run-one":
    case "main-run-all":
      return started.size > 0;
    case "drain":
      return has("drain-check");
    case "report":
      return has("report");
    case "main-report":
      return has("watchdog-killed");
    case "main-finish":
      return has("finish") || has("stop");
    default:
      return true;
  }
}

/** Feedback for a suspect line: the case's own diagnosis, else the line's facts and whether it ran. */
export function diagnoseSuspect(kase: ClinicCase, key: string): { culprit: boolean; text: string } {
  if (key === kase.culprit || kase.alsoCulprits?.includes(key)) return { culprit: true, text: kase.found };
  const specific = kase.wrong[key];
  if (specific) return { culprit: false, text: specific };
  const stim = STIM_LINE.exec(key);
  const fact = stim ? `This is one stimulus step of test_${stim[1]}(), as the lesson writes it.` : LINE_FACTS[key];
  const testId = /^test-(smoke|corners|gaps|hold)/.exec(key)?.[1];
  const verdict = lineRan(runBench(kase.config), key)
    ? "It behaves as written in this run; the cause is elsewhere."
    : testId && !(kase.config.tests as string[]).includes(testId)
      ? `+TEST=${kase.config.testName} does not select this test, so it never ran and is not the cause.`
      : "This line never ran in this run, so it is not the cause: ask what kept the run from reaching it.";
  return { culprit: false, text: fact ? `${fact} ${verdict}` : verdict };
}

/**
 * What the fixed bench does with BUG=1 on +TEST=corners:
 * - "caught": BUG=1 fails more checks than the correct DUT, and the run ends;
 * - "caught-no-end": the same, but the run never ends or is left suspended;
 * - "hung": the watchdog ended the run and no check ever saw the mutant;
 * - "escaped": the run completed with no more failures than the correct DUT.
 */
export type Bug1Outcome = "caught" | "caught-no-end" | "hung" | "escaped";

export interface FixGrade {
  /** A correct DUT ends the run with PASS=<n> FAIL=0 for all tests. */
  clean: boolean;
  cleanRun: RunResult;
  expectedPass: number;
  /** BUG=1 caused at least one check failure: its run fails more often than the correct DUT's, not counting the watchdog. */
  bug1Caught: boolean;
  bug1Outcome: Bug1Outcome;
  /** The verdict in words, for the grade's BUG=1 line. */
  bug1Text: string;
  bug1Run: RunResult;
  /** The same fixed bench and +TEST=corners against the correct DUT, the baseline for bug1Caught. */
  bug1Baseline: RunResult;
  /** For the X clinic: every X result is a failure under the x-carry DUT. */
  xCaught: boolean | null;
  xRun: RunResult | null;
  /** The model accepts the fix. */
  modelOk: boolean;
  /** Model and code review both accept it. */
  accepted: boolean;
  review: string;
}

/** fail_cnt without the watchdog's own count of the hang, which says nothing about the DUT. */
const checkFailures = (run: RunResult): number => run.failCnt - (run.endReason === "fatal" ? 1 : 0);

function gradeBug1(bug1Run: RunResult, baseline: RunResult): { outcome: Bug1Outcome; text: string } {
  const mutantFails = checkFailures(bug1Run);
  const baselineFails = checkFailures(baseline);
  if (mutantFails > baselineFails) {
    if (bug1Run.ended) return { outcome: "caught", text: "still caught" };
    return { outcome: "caught-no-end", text: bug1Run.endReason === "stop" ? "caught, but $stop leaves the run suspended" : "caught, but the run never ends" };
  }
  if (bug1Run.endReason === "fatal") return { outcome: "hung", text: "run hung, BUG=1 never exercised" };
  return { outcome: "escaped", text: baselineFails > 0 ? `not caught: the correct DUT fails just as often (${baseline.summary})` : "escapes" };
}

/**
 * Reruns the fixed bench: the case's own command line with a correct DUT must
 * end PASS=<n> FAIL=0 (n = one per send), +TEST=corners must still catch BUG=1,
 * and (for the X clinic) the x-carry DUT must fail every result. The case's
 * own tests are used because some faults (a missing idle) only show on their
 * own run. Code review may still reject a fix the model accepts.
 */
export function gradeFix(kase: ClinicCase, fix: ClinicFix): FixGrade {
  const fixed = fix.apply(kase.config);
  const cleanRun = runBench({ ...fixed, mutant: 0 });
  const expectedPass = expectedResultCount(fixed.tests);
  const clean = cleanRun.ended && cleanRun.endReason === "finish" && cleanRun.failCnt === 0 && cleanRun.passCnt === expectedPass;
  const bug1Run = runBench({ ...fixed, tests: ["corners"], testName: "corners", mutant: 1 });
  const bug1Baseline = runBench({ ...fixed, tests: ["corners"], testName: "corners", mutant: 0 });
  const { outcome: bug1Outcome, text: bug1Text } = gradeBug1(bug1Run, bug1Baseline);
  const bug1Caught = bug1Outcome === "caught" || bug1Outcome === "caught-no-end";
  let xRun: RunResult | null = null;
  let xCaught: boolean | null = null;
  if (kase.id === "neq") {
    xRun = runBench({ ...fixed, mutant: "x-carry" });
    xCaught = xRun.ended && xRun.failCnt === expectedPass;
  }
  const modelOk = clean && bug1Caught && xCaught !== false;
  return { clean, cleanRun, expectedPass, bug1Caught, bug1Outcome, bug1Text, bug1Run, bug1Baseline, xCaught, xRun, modelOk, accepted: modelOk && fix.reviewOk, review: fix.review };
}
