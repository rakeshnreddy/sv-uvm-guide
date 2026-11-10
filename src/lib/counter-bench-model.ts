/**
 * The F1B Make It Work bench as a pure, deterministic model: the up_counter
 * DUT (and three mutants of it), the testbench's check loop with four compare
 * forms, the printed PASS/FAIL and COVERAGE lines, code coverage of the RTL,
 * and the plan's functional coverage items. No React.
 *
 * Layered on two existing models (imports only):
 * - counter-bug-model: `simulateCounter` (with its rst schedule) and
 *   `nextCount` (X stays X because an x condition takes else, §12.4).
 * - sv-four-state-model: `compare` (§11.4.5) and `ifBranch` (§12.4).
 *
 * The bench being modelled (F1B "Make It Work", Step 2):
 *   always #5 clk = ~clk;              // clk starts at 0: rising edges at 5, 15, 25 ns ...
 *   initial begin
 *     @(posedge clk); rst <= 1'b0;     // rst is 1 at rising edge 0 only
 *     expected = 3'd0;
 *     repeat (N) begin
 *       @(negedge clk);                // check i at 10 + 10 i ns
 *       if (count === 3'd7) seen_max++;
 *       if (count !== expected) begin fail_cnt++; $error(...); end
 *       else pass_cnt++;
 *       expected = expected + 3'd1;
 *     end
 *     $display("PASS=%0d FAIL=%0d", ...); $display("COVERAGE seen_max=%0d", ...);
 *
 * Timing convention: check i (at the falling edge 10 + 10 i ns) reads the value
 * the flop took at rising edge i (5 + 10 i ns). In counter-bug-model terms that
 * is `count[i + 1]`, since `count[k]` is the value sampled at edge k (before its
 * update). A run of N checks therefore spans N rising edges, 0 to N - 1.
 *
 * Standard references (IEEE 1800-2023), each pinned by a test:
 * - §11.4.5: `!=` gives 1'bx when x/z bits make the relation ambiguous;
 *   `!==` and `===` compare x and z literally and always give 0 or 1.
 * - §12.4: an if condition that is 0, x or z is false, so the else runs.
 * - §6.8, Table 6-7: a 4-state variable with no initializer starts at 'x, so
 *   a counter that is never reset holds X.
 * - §20.9: `$isunknown(e)` is 1 when e has any x or z bit (used by one mutant).
 * - §19.2: code coverage is extracted from the design code; functional
 *   coverage is user-defined from the plan's features.
 * - §40.2.2: statement coverage (a statement executed at least once) and
 *   toggle coverage (each bit seen with a 0 value and a 1 value) are defined
 *   there, as are FSM and assertion coverage. Branch coverage is not: its
 *   counts here are labelled tool-defined.
 */

import { COUNTER_MAX, COUNTER_MODULUS, FIXED_COUNTER, BUGGY_COUNTER, nextCount, simulateCounter, type CounterDesign, type CounterSample } from "./counter-bug-model";
import { compare, fromNumber, ifBranch, type Bit4 } from "./sv-four-state-model";

// ---------------------------------------------------------------------------
// The DUT and its mutants
// ---------------------------------------------------------------------------

export type BenchDutId = "correct" | "wrap6" | "no-reset" | "reset-ignored";

export interface BenchDut {
  id: BenchDutId;
  /** Button label. */
  label: string;
  /** Short name for matrix columns and prose. */
  short: string;
  mutant: boolean;
  design: CounterDesign;
  /** The one line that differs from the correct bench, as SystemVerilog. */
  changedLine: string;
  /** What the change is, in one sentence. */
  change: string;
  /** The DUT's rst port is tied to 0, so it never sees the bench's reset. */
  rstTiedLow: boolean;
  /** The reset branch is gated by $isunknown(count): it only fires while count is X. */
  resetOnlyWhenUnknown: boolean;
}

export const BENCH_DUTS: Record<BenchDutId, BenchDut> = {
  correct: {
    id: "correct",
    label: "Correct: WRAP_AT(7)",
    short: "correct DUT",
    mutant: false,
    design: FIXED_COUNTER,
    changedLine: "up_counter #(.WRAP_AT(7)) dut (.clk(clk), .rst(rst), .count(count));",
    change: "The bench as written: the counter wraps after 7, as the spec says.",
    rstTiedLow: false,
    resetOnlyWhenUnknown: false,
  },
  wrap6: {
    id: "wrap6",
    label: "Mutant: WRAP_AT(6)",
    short: "WRAP_AT(6)",
    mutant: true,
    design: BUGGY_COUNTER,
    changedLine: "up_counter #(.WRAP_AT(6)) dut (.clk(clk), .rst(rst), .count(count));",
    change: "The lesson's mutant: the counter wraps at 6, so 7 never appears.",
    rstTiedLow: false,
    resetOnlyWhenUnknown: false,
  },
  "no-reset": {
    id: "no-reset",
    label: "Mutant: rst never reaches the DUT",
    short: "rst never asserted",
    mutant: true,
    design: FIXED_COUNTER,
    changedLine: "up_counter #(.WRAP_AT(7)) dut (.clk(clk), .rst(1'b0), .count(count));",
    change: "The DUT's rst port is tied to 0, so reset is never asserted and count stays X (§6.8, Table 6-7; §12.4).",
    rstTiedLow: true,
    resetOnlyWhenUnknown: false,
  },
  "reset-ignored": {
    id: "reset-ignored",
    label: "Mutant: reset ignored mid-count",
    short: "reset ignored mid-count",
    mutant: true,
    design: FIXED_COUNTER,
    changedLine: "if (rst && $isunknown(count)) count <= '0;",
    change: "The reset branch only fires while count is X (§20.9: $isunknown is 1 when any bit is x or z), so a reset after counting starts is ignored.",
    rstTiedLow: false,
    resetOnlyWhenUnknown: true,
  },
};

export const BENCH_DUT_IDS: BenchDutId[] = ["correct", "wrap6", "no-reset", "reset-ignored"];
export const MUTANT_IDS: BenchDutId[] = ["wrap6", "no-reset", "reset-ignored"];

// ---------------------------------------------------------------------------
// The compare forms
// ---------------------------------------------------------------------------

export type CompareFormId = "case-ne" | "logic-ne" | "commented" | "self-copy";

export interface CompareForm {
  id: CompareFormId;
  label: string;
  /** The compare line of the bench, as it reads with this form. */
  line: string;
  /** An extra line placed before the compare, or null. */
  before: string | null;
  /** The operator that runs, or null when no compare runs. */
  op: "!==" | "!=" | null;
  /** True when the right operand is the DUT's own output. */
  selfCopy: boolean;
}

export const COMPARE_FORMS: Record<CompareFormId, CompareForm> = {
  "case-ne": { id: "case-ne", label: "count !== expected", line: "if (count !== expected) fail_cnt++; else pass_cnt++;", before: null, op: "!==", selfCopy: false },
  "logic-ne": { id: "logic-ne", label: "count != expected", line: "if (count != expected) fail_cnt++; else pass_cnt++;", before: null, op: "!=", selfCopy: false },
  commented: { id: "commented", label: "compare commented out", line: "// if (count !== expected) fail_cnt++; else pass_cnt++;", before: null, op: null, selfCopy: false },
  "self-copy": {
    id: "self-copy",
    label: "expected = count (self-copy)",
    line: "if (count !== expected) fail_cnt++; else pass_cnt++;",
    before: "expected = count;  // 'model' copied from the DUT",
    op: "!==",
    selfCopy: true,
  },
};

export const COMPARE_FORM_IDS: CompareFormId[] = ["case-ne", "logic-ne", "commented", "self-copy"];

// ---------------------------------------------------------------------------
// Configuration and timing
// ---------------------------------------------------------------------------

/** The lesson bench runs repeat (20). */
export const LESSON_CHECKS = 20;
/** Run lengths offered in coverage mode. 5 never reaches the wrap; 9 reaches it once. */
export const RUN_LENGTHS = [5, 9, 20] as const;
/** always #5 clk = ~clk; */
export const HALF_PERIOD_NS = 5;

/** Rising edge i of clk (clk starts at 0, so the first rising edge is at 5 ns). */
export const riseTimeNs = (i: number) => HALF_PERIOD_NS + 2 * HALF_PERIOD_NS * i;
/** Check i is taken at the falling edge after rising edge i. */
export const checkTimeNs = (i: number) => 2 * HALF_PERIOD_NS * (i + 1);

export interface BenchConfig {
  dut: BenchDutId;
  form: CompareFormId;
  /** Number of checks (iterations of the repeat loop), at least 1. */
  checks: number;
  /**
   * Rising edge at which the bench asserts rst a second time (driven at the
   * falling edge before it, released after it, and `expected` reset to 0), or
   * null for the lesson bench. Edge 0 is the bench's own first reset.
   */
  midResetAt: number | null;
}

export const LESSON_CONFIG: BenchConfig = { dut: "correct", form: "case-ne", checks: LESSON_CHECKS, midResetAt: null };

export interface ConfigNote {
  field: "checks" | "midResetAt";
  text: string;
}

/**
 * Brings a config into range. Checks: an integer of at least 1 (at most 200,
 * so a run stays small). A mid-count reset must fall on edges 1 to checks - 1:
 * edge 0 is already the first reset, and an edge after the last check is
 * never observed.
 */
export function normalizeConfig(config: BenchConfig): { config: BenchConfig; notes: ConfigNote[] } {
  const notes: ConfigNote[] = [];
  let checks = Math.trunc(Number.isFinite(config.checks) ? config.checks : LESSON_CHECKS);
  if (checks < 1 || checks > 200) {
    const clamped = Math.min(200, Math.max(1, checks));
    notes.push({ field: "checks", text: `A run needs 1 to 200 checks; ${checks} was changed to ${clamped}.` });
    checks = clamped;
  }
  let midResetAt = config.midResetAt;
  if (midResetAt !== null) {
    const k = Math.trunc(midResetAt);
    if (!Number.isFinite(midResetAt) || k < 1 || k > checks - 1) {
      notes.push({ field: "midResetAt", text: `A second reset must fall on rising edges 1 to ${checks - 1}; edge ${midResetAt} is ignored.` });
      midResetAt = null;
    } else midResetAt = k;
  }
  return { config: { ...config, checks, midResetAt }, notes };
}

export const configKey = (c: BenchConfig) => `${c.dut}|${c.form}|${c.checks}|${c.midResetAt ?? "-"}`;

// ---------------------------------------------------------------------------
// Running the bench
// ---------------------------------------------------------------------------

export type DutBranch = "reset" | "wrap" | "increment";

export interface DutEdge {
  edge: number;
  timeNs: number;
  /** rst as the DUT's port sees it at this edge. */
  rst: 0 | 1;
  before: CounterSample;
  after: CounterSample;
  /** The always_ff branch that executed (§12.4: an x condition takes else). */
  branch: DutBranch;
}

export type CheckOutcome = "pass" | "fail" | "none";

export interface BenchCheck {
  index: number;
  timeNs: number;
  /** count at this check: the value after rising edge `index`. */
  actual: CounterSample;
  /** The reference model's value. */
  model: number;
  /** The right operand of the compare (the model, or count itself for a self-copy). */
  compared: CounterSample;
  op: "!==" | "!=" | null;
  /** Value of the compare, or null when no compare runs. */
  cond: Bit4 | null;
  branch: "then" | "else" | null;
  outcome: CheckOutcome;
  /** `count === 3'd7` was 1 here, so seen_max was incremented. */
  sawSeven: boolean;
  passSoFar: number;
  failSoFar: number;
  seenSoFar: number;
  /** Why the compare gave its value (from sv-four-state-model), or null. */
  why: string | null;
}

export type RunVerdict = "fail" | "pass" | "no-checks";

export interface BenchRun {
  config: BenchConfig;
  notes: ConfigNote[];
  /** rst as the bench drives it, per rising edge. */
  benchRst: (0 | 1)[];
  /** rst as the DUT sees it, per rising edge. */
  dutRst: (0 | 1)[];
  edges: DutEdge[];
  checks: BenchCheck[];
  pass: number;
  fail: number;
  seenMax: number;
  /** Compares that executed (0 when the compare is commented out). */
  comparesRun: number;
  passLine: string;
  coverageLine: string;
  firstFailure: { index: number; timeNs: number } | null;
  verdict: RunVerdict;
}

const bits3 = (v: CounterSample): Bit4[] => (v === "X" ? ["x", "x", "x"] : fromNumber(v, 3));
export const showSample = (v: CounterSample) => (v === "X" ? "X" : String(v));
export const literal3 = (v: CounterSample) => (v === "X" ? "3'bxxx" : `3'd${v}`);

/** The branch of `if (rst) … else if (count == WRAP_AT) … else …` that runs. Mirrors `nextCount`. */
export function dutBranch(dut: BenchDut, before: CounterSample, rst: 0 | 1): DutBranch {
  const resetFires = dut.resetOnlyWhenUnknown ? rst === 1 && before === "X" : rst === 1;
  if (resetFires) return "reset";
  // §12.4: (X == WRAP_AT) is x, which is false, so the else (increment) runs.
  if (before !== "X" && before === dut.design.wrapAt) return "wrap";
  return "increment";
}

function dutTrace(dut: BenchDut, dutRst: (0 | 1)[], checks: number): CounterSample[] {
  const stimulus = { edges: checks + 1, rst: dutRst };
  if (!dut.resetOnlyWhenUnknown) return simulateCounter(dut.design, stimulus).count;
  // The mutant's reset term is rst && $isunknown(count) (§20.9): rst only counts while count is X.
  const count: CounterSample[] = ["X"];
  for (let k = 0; k < checks; k += 1) {
    const cur = count[k];
    count.push(nextCount(dut.design, cur, cur === "X" ? dutRst[k] ?? 0 : 0));
  }
  return count;
}

export function runBench(input: BenchConfig): BenchRun {
  const { config, notes } = normalizeConfig(input);
  const dut = BENCH_DUTS[config.dut];
  const form = COMPARE_FORMS[config.form];
  const n = config.checks;

  const benchRst: (0 | 1)[] = Array.from({ length: n }, (_, i) => (i === 0 || i === config.midResetAt ? 1 : 0));
  const dutRst: (0 | 1)[] = dut.rstTiedLow ? benchRst.map(() => 0) : [...benchRst];
  const count = dutTrace(dut, dutRst, n);

  const edges: DutEdge[] = [];
  for (let i = 0; i < n; i += 1) {
    edges.push({ edge: i, timeNs: riseTimeNs(i), rst: dutRst[i], before: count[i], after: count[i + 1], branch: dutBranch(dut, count[i], dutRst[i]) });
  }

  const checks: BenchCheck[] = [];
  let pass = 0;
  let fail = 0;
  let seen = 0;
  let model = 0;
  for (let i = 0; i < n; i += 1) {
    // The bench's model: 0 after each reset it drives, else the previous value + 1 in 3 bits.
    if (i > 0) model = benchRst[i] === 1 ? 0 : (model + 1) % COUNTER_MODULUS;
    const actual = count[i + 1];
    const sawSeven = ifBranch([compare("===", bits3(actual), fromNumber(COUNTER_MAX, 3)).result]) === "then";
    if (sawSeven) seen += 1;
    const compared: CounterSample = form.selfCopy ? actual : model;
    let cond: Bit4 | null = null;
    let branch: "then" | "else" | null = null;
    let why: string | null = null;
    let outcome: CheckOutcome = "none";
    if (form.op) {
      const r = compare(form.op, bits3(actual), bits3(compared));
      cond = r.result;
      why = r.why;
      branch = ifBranch([cond]);
      outcome = branch === "then" ? "fail" : "pass";
      if (outcome === "fail") fail += 1;
      else pass += 1;
    }
    checks.push({ index: i, timeNs: checkTimeNs(i), actual, model, compared, op: form.op, cond, branch, outcome, sawSeven, passSoFar: pass, failSoFar: fail, seenSoFar: seen, why });
  }

  const firstFail = checks.find((c) => c.outcome === "fail");
  const comparesRun = checks.filter((c) => c.outcome !== "none").length;
  return {
    config,
    notes,
    benchRst,
    dutRst,
    edges,
    checks,
    pass,
    fail,
    seenMax: seen,
    comparesRun,
    passLine: `PASS=${pass} FAIL=${fail}`,
    coverageLine: `COVERAGE seen_max=${seen}`,
    firstFailure: firstFail ? { index: firstFail.index, timeNs: firstFail.timeNs } : null,
    verdict: fail > 0 ? "fail" : comparesRun === 0 ? "no-checks" : "pass",
  };
}

export const printedLines = (run: BenchRun) => `${run.passLine} / ${run.coverageLine}`;

// ---------------------------------------------------------------------------
// Narration (every sentence generated from the run)
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function listIndices(xs: number[]): string {
  if (xs.length === 0) return "none";
  if (xs.length === 1) return String(xs[0]);
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** One check, step by step, as the narration under the waveform reads it. */
export function explainCheck(check: BenchCheck, form: CompareFormId): string {
  const f = COMPARE_FORMS[form];
  const head = `Check ${check.index} at ${check.timeNs} ns: count = ${showSample(check.actual)}`;
  if (!f.op || check.cond === null) {
    return `${head}, the model says ${check.model}. The compare is commented out, so neither pass_cnt nor fail_cnt moves (PASS=${check.passSoFar} FAIL=${check.failSoFar}).`;
  }
  const right = f.selfCopy ? `expected = count copies the DUT's value, so expected is ${showSample(check.compared)} too (the model said ${check.model})` : `expected = ${check.model}`;
  const condText = `${f.op === "!==" ? "count !== expected" : "count != expected"} gives 1'b${check.cond}`;
  const clause = check.cond === "x" ? "(§11.4.5: x bits make != ambiguous)" : "(§11.4.5)";
  const ifText =
    check.cond === "x"
      ? "The if treats x as false and takes the else (§12.4): pass_cnt++. The X is counted as a pass."
      : check.branch === "then"
        ? "The if runs fail_cnt++ (§12.4)."
        : "The condition is 0, so the if takes the else: pass_cnt++ (§12.4).";
  return `${head}, ${right}. ${condText} ${clause}. ${ifText} Now PASS=${check.passSoFar} FAIL=${check.failSoFar}.`;
}

/** The run in a few sentences: what passed, the first failure, and seen_max. */
export function explainRun(run: BenchRun): string {
  const form = COMPARE_FORMS[run.config.form];
  const n = run.checks.length;
  const parts: string[] = [];
  const xChecks = run.checks.filter((c) => c.cond === "x").length;
  if (!form.op) {
    parts.push(`No compare runs, so pass_cnt and fail_cnt stay 0: ${run.passLine}. Zero checks is no evidence, yet FAIL=0 reads as clean to a script that only greps for failures.`);
  } else if (form.selfCopy) {
    parts.push(`expected = count overwrites the model with the DUT's own value, so count !== expected compares count with itself and gives 1'b0 every time (§11.4.5): ${run.passLine}, whatever the DUT does.`);
  } else if (xChecks === n) {
    parts.push(
      form.op === "!="
        ? `count is X at every check. count != expected gives 1'bx (§11.4.5), the if takes its else (§12.4), and every X is counted as a pass: ${run.passLine}.`
        : `count is X at every check. count !== expected compares x literally and gives 1'b1 (§11.4.5), so every check fails: ${run.passLine}.`,
    );
  } else if (run.firstFailure) {
    const before = run.firstFailure.index;
    const lead = before === 0 ? "The very first check fails" : `Checks 0 to ${before - 1} pass`;
    const firstCheck = run.checks[before];
    parts.push(
      `${lead}; the first failure is check ${before} at ${run.firstFailure.timeNs} ns, where the model expects ${firstCheck.model} and count is ${showSample(firstCheck.actual)}. ${run.passLine}: ${plural(run.fail, "check")} of ${n} fail.`,
    );
  } else {
    parts.push(`count matches the model at all ${plural(n, "check")}: ${run.passLine}.`);
  }
  const sevens = run.checks.filter((c) => c.sawSeven).map((c) => c.index);
  parts.push(
    sevens.length === 0
      ? `seen_max counts checks where count === 3'd7; 7 never appears, so ${run.coverageLine}.`
      : `seen_max counts checks where count === 3'd7: ${sevens.length === 1 ? "check" : "checks"} ${listIndices(sevens)}, so ${run.coverageLine}.`,
  );
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Mutation verdicts
// ---------------------------------------------------------------------------

export interface MutantVerdict {
  mutant: BenchDutId;
  form: CompareFormId;
  run: BenchRun;
  /** The same form on the correct DUT. */
  reference: BenchRun;
  /** The bench prints a failure with the mutant and none on the correct DUT. */
  killed: boolean;
  text: string;
}

export function mutantVerdict(mutant: BenchDutId, form: CompareFormId, checks = LESSON_CHECKS, midResetAt: number | null = null): MutantVerdict {
  const run = runBench({ dut: mutant, form, checks, midResetAt });
  const reference = runBench({ dut: "correct", form, checks, midResetAt });
  const killed = run.fail > 0 && reference.fail === 0;
  const name = BENCH_DUTS[mutant].short;
  const text = killed
    ? `Killed: ${run.passLine} with ${name}, against ${reference.passLine} on the correct DUT. This check can fail.`
    : run.comparesRun === 0
      ? `Survived: no compare ran (${run.passLine}), so the bench cannot tell ${name} from the correct DUT.`
      : `Survived: ${run.passLine} with ${name}, the same verdict as the correct DUT. This check cannot see this bug.`;
  return { mutant, form, run, reference, killed, text };
}

export type BenchPart = "stim" | "model" | "dut" | "chk" | "cov" | "sum";

export interface BrokenPart {
  part: BenchPart;
  reason: string;
}

/** The parts of the lesson's anatomy diagram that this configuration breaks. */
export function brokenParts(run: BenchRun): BrokenPart[] {
  const out: BrokenPart[] = [];
  const dut = BENCH_DUTS[run.config.dut];
  if (dut.mutant) out.push({ part: dut.rstTiedLow ? "stim" : "dut", reason: dut.change });
  const form = COMPARE_FORMS[run.config.form];
  if (!form.op) out.push({ part: "chk", reason: "The compare is commented out: no check runs." });
  if (form.selfCopy) out.push({ part: "model", reason: "expected is a copy of count, not an independent model." });
  const xBlind = run.checks.filter((c) => c.cond === "x").length;
  if (xBlind > 0) out.push({ part: "chk", reason: `count != expected gave 1'bx at ${plural(xBlind, "check")}, and each took the else as a pass (§11.4.5, §12.4).` });
  return out;
}

// ---------------------------------------------------------------------------
// Code coverage of the RTL (§19.2, §40.2.2)
// ---------------------------------------------------------------------------

export type RtlLineKey = "module" | "always" | "reset" | "wrap" | "incr" | "end" | "endmodule";

export interface RtlLine {
  key: RtlLineKey;
  text: string;
}

/** The DUT exactly as the Make It Work bench writes it (ports elided). */
export function benchRtlLines(dutId: BenchDutId = "correct"): RtlLine[] {
  const dut = BENCH_DUTS[dutId];
  return [
    { key: "module", text: `module up_counter #(parameter int WRAP_AT = 7) (...);` },
    { key: "always", text: "  always_ff @(posedge clk) begin" },
    { key: "reset", text: dut.resetOnlyWhenUnknown ? "    if (rst && $isunknown(count)) count <= '0;" : "    if (rst)                   count <= '0;" },
    { key: "wrap", text: "    else if (count == WRAP_AT) count <= '0;" },
    { key: "incr", text: "    else                       count <= count + 3'd1;" },
    { key: "end", text: "  end" },
    { key: "endmodule", text: "endmodule" },
  ];
}

export interface BranchCount {
  id: "rst-true" | "rst-false" | "wrap-true" | "wrap-false";
  label: string;
  hits: number;
}

export interface ToggleBit {
  signal: string;
  seen0: boolean;
  seen1: boolean;
}

export interface CodeCoverage {
  /** Hits per line: the always_ff body runs once per rising edge. */
  lineHits: Record<"always" | "reset" | "wrap" | "incr", number>;
  statementsCovered: number;
  statementsTotal: number;
  branches: BranchCount[];
  branchesCovered: number;
  toggle: ToggleBit[];
  toggledBits: number;
}

export function codeCoverage(run: BenchRun): CodeCoverage {
  const hits = (b: DutBranch) => run.edges.filter((e) => e.branch === b).length;
  const lineHits = { always: run.edges.length, reset: hits("reset"), wrap: hits("wrap"), incr: hits("increment") };
  const statements = [lineHits.reset, lineHits.wrap, lineHits.incr];
  const branches: BranchCount[] = [
    { id: "rst-true", label: "if (rst): true", hits: lineHits.reset },
    { id: "rst-false", label: "if (rst): false", hits: lineHits.wrap + lineHits.incr },
    { id: "wrap-true", label: "count == WRAP_AT: true", hits: lineHits.wrap },
    { id: "wrap-false", label: "count == WRAP_AT: false (or x)", hits: lineHits.incr },
  ];
  // §40.2.2 toggle: each bit seen with a 0 value and a 1 value. count holds X until the
  // first reset, then the value after each rising edge; X bits are neither 0 nor 1.
  const values: CounterSample[] = ["X", ...run.edges.map((e) => e.after)];
  const toggle: ToggleBit[] = [2, 1, 0].map((bit) => {
    const known = values.filter((v): v is number => v !== "X").map((v) => (v >> bit) & 1);
    return { signal: `count[${bit}]`, seen0: known.includes(0), seen1: known.includes(1) };
  });
  // rst as the DUT's port carries it over the run (the bench changes it away from edges).
  toggle.push({ signal: "rst", seen0: run.dutRst.includes(0), seen1: run.dutRst.includes(1) });
  // clk starts at 0 (always #5 clk = ~clk) and is 1 from each rising edge, so any run of
  // one or more edges has seen it at 0 and at 1.
  toggle.push({ signal: "clk", seen0: true, seen1: run.edges.length > 0 });
  return {
    lineHits,
    statementsCovered: statements.filter((h) => h > 0).length,
    statementsTotal: statements.length,
    branches,
    branchesCovered: branches.filter((b) => b.hits > 0).length,
    toggle,
    toggledBits: toggle.filter((t) => t.seen0 && t.seen1).length,
  };
}

// ---------------------------------------------------------------------------
// Functional coverage against the plan (user-defined, §19.2)
// ---------------------------------------------------------------------------

export type PlanItemId = "reset" | "increment" | "wrap" | "mid-reset" | "checks";

export interface PlanItem {
  id: PlanItemId;
  label: string;
  /** What the coverage item counts. */
  counts: string;
  /** Scenario items make up functional coverage; the checks row counts compares that ran. */
  scenario: boolean;
}

export const PLAN_ITEMS: PlanItem[] = [
  { id: "reset", label: "reset to 0", counts: "rising edges where the DUT took its reset branch", scenario: true },
  { id: "increment", label: "increment", counts: "edges where a known count n became n + 1 (n below 7)", scenario: true },
  { id: "wrap", label: "wrap 7 -> 0", counts: "edges where count went from 7 to 0 without a reset", scenario: true },
  { id: "mid-reset", label: "reset mid-count", counts: "edges where rst was 1 while count was known and nonzero", scenario: true },
  { id: "checks", label: "checks with !==", counts: "compares with !== that ran (evidence, not a scenario)", scenario: false },
];

export interface FunctionalCoverage {
  hits: Record<PlanItemId, number>;
  scenariosCovered: number;
  scenariosTotal: number;
}

export function functionalCoverage(run: BenchRun): FunctionalCoverage {
  const e = run.edges;
  const hits: Record<PlanItemId, number> = {
    reset: e.filter((x) => x.branch === "reset").length,
    increment: e.filter((x) => x.rst === 0 && x.before !== "X" && x.before < COUNTER_MAX && x.after === x.before + 1).length,
    wrap: e.filter((x) => x.rst === 0 && x.before === COUNTER_MAX && x.after === 0).length,
    "mid-reset": e.filter((x) => x.rst === 1 && x.before !== "X" && x.before !== 0).length,
    checks: run.checks.filter((c) => c.op === "!==").length,
  };
  const scenarios = PLAN_ITEMS.filter((p) => p.scenario);
  return { hits, scenariosCovered: scenarios.filter((p) => hits[p.id] > 0).length, scenariosTotal: scenarios.length };
}

export type EvidenceVerdict = "fail" | "pass" | "no-evidence";

/** Coverage measures; only checks decide. No compare that ran means no evidence, whatever coverage says. */
export function evidenceVerdict(run: BenchRun): { verdict: EvidenceVerdict; text: string } {
  const code = codeCoverage(run);
  const fn = functionalCoverage(run);
  const cov = `statements ${code.statementsCovered} of ${code.statementsTotal}, functional ${fn.scenariosCovered} of ${fn.scenariosTotal}`;
  if (run.comparesRun === 0) return { verdict: "no-evidence", text: `No evidence: ${cov}, but 0 checks ran, so nothing was compared.` };
  if (run.fail > 0) return { verdict: "fail", text: `FAIL: ${run.passLine} over ${plural(run.comparesRun, "check")}; coverage (${cov}) does not change that.` };
  return { verdict: "pass", text: `PASS backed by ${plural(run.comparesRun, "check")} (${cov}).` };
}

export const percent = (a: number, b: number) => (b === 0 ? 0 : Math.round((100 * a) / b));

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export interface LabOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Deterministic shuffle (FNV-1a seeded LCG) so the correct option is not always first. */
export function arrangeOptions<T extends { id: string; label: string }>(options: readonly T[], seed = ""): T[] {
  const out = [...options];
  let h = 2166136261;
  const key = `${out.map((o) => o.id).join("|")}#${seed}`;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const describeConfig = (c: BenchConfig) => `${BENCH_DUTS[c.dut].short} with ${COMPARE_FORMS[c.form].label}`;

/**
 * "Predict the two printed lines": the true output plus up to three outputs
 * this bench prints in other configurations, each explained by the run that
 * prints it.
 */
export function printedLinesOptions(config: BenchConfig): LabOption[] {
  const run = runBench(config);
  const truth = printedLines(run);
  const options: LabOption[] = [{ id: "truth", label: truth, correct: true, feedback: explainRun(run) }];
  const seen = new Set([truth]);
  const candidates: BenchConfig[] = [
    ...BENCH_DUT_IDS.filter((d) => d !== config.dut).map((dut) => ({ ...config, dut })),
    ...COMPARE_FORM_IDS.filter((f) => f !== config.form).map((form) => ({ ...config, form })),
  ];
  for (const c of candidates) {
    if (options.length >= 4) break;
    const other = runBench(c);
    const text = printedLines(other);
    if (seen.has(text)) continue;
    seen.add(text);
    options.push({
      id: `alt-${options.length}`,
      label: text,
      correct: false,
      feedback: `That is what the bench prints for ${describeConfig(c)}. ${explainRun(other)} Here it is ${describeConfig(config)}.`,
    });
  }
  return arrangeOptions(options, configKey(config));
}

export type CoverageQuestionKind = "baseline" | "mid-reset" | "compare" | "length" | "several";

export interface CoverageQuestion {
  kind: CoverageQuestionKind;
  question: string;
  options: LabOption[];
}

const codeSummary = (c: CodeCoverage) => `statements ${c.statementsCovered} of ${c.statementsTotal}, branches ${c.branchesCovered} of ${c.branches.length}`;
const coverageSummary = (c: CodeCoverage, f: FunctionalCoverage) => `${codeSummary(c)}; functional ${f.scenariosCovered} of ${f.scenariosTotal}`;

/** The plan's scenario items with at least one hit: functional coverage is this set, not its size. */
export function coveredScenarioIds(f: FunctionalCoverage): PlanItemId[] {
  return PLAN_ITEMS.filter((p) => p.scenario && f.hits[p.id] > 0).map((p) => p.id);
}

/** True when the two runs cover the same plan scenarios (the same items, not just the same number). */
export function sameFunctionalCoverage(a: FunctionalCoverage, b: FunctionalCoverage): boolean {
  const x = coveredScenarioIds(a);
  const y = coveredScenarioIds(b);
  return x.length === y.length && x.every((id) => y.includes(id));
}

/** True when the two runs cover the same statements and the same branch outcomes. */
export function sameCodeCoverage(a: CodeCoverage, b: CodeCoverage): boolean {
  const lines = ["reset", "wrap", "incr"] as const;
  return lines.every((l) => (a.lineHits[l] > 0) === (b.lineHits[l] > 0)) && a.branches.every((br, i) => (br.hits > 0) === (b.branches[i].hits > 0));
}

const planLabel = (id: PlanItemId) => PLAN_ITEMS.find((p) => p.id === id)?.label ?? id;

/** Why the wrap scenario was lost or gained between two runs, read from the runs' edges. */
function wrapChangeReason(prevRun: BenchRun, nextRun: BenchRun): string {
  const n = nextRun.edges.length;
  const k = nextRun.config.midResetAt;
  const wrapEdge = nextRun.edges.find((e) => e.branch === "wrap");
  if (wrapEdge) {
    const was = prevRun.config.midResetAt;
    const cause = was === null ? "" : k === null ? ` with the reset at edge ${was} removed` : ` with the second reset at edge ${k} instead of edge ${was}`;
    return `count now wraps from 7 to 0 at edge ${wrapEdge.edge}${cause}.`;
  }
  const known = nextRun.edges.map((e) => e.after).filter((v): v is number => v !== "X");
  const peak = known.length ? Math.max(...known) : null;
  if (peak === null) return `count never leaves X in ${n} cycles, so it never wraps.`;
  if (k !== null && nextRun.edges[k]?.branch === "reset") {
    if (nextRun.edges[k].before === COUNTER_MAX) return `count is 7 at edge ${k}, but rst is 1 there and if (rst) is tested first, so the reset branch runs instead of the wrap.`;
    const sevenAt = nextRun.edges.filter((e) => e.after === COUNTER_MAX).map((e) => e.edge);
    const last = sevenAt[sevenAt.length - 1];
    if (last === n - 1) return `the reset at edge ${k} leaves count at 0 there, so count first reaches 7 at edge ${last}, the last edge of the ${n}-cycle run, and the wrap would come one edge later.`;
    return `the reset at edge ${k} restarts the count at 0 before it reaches 7, so in ${n} cycles count peaks at ${peak} and never wraps.`;
  }
  return `in ${n} cycles count peaks at ${peak}, so it never wraps.`;
}

/** One sentence per plan scenario that was gained or lost between two runs, naming the cause. */
function scenarioChanges(prevRun: BenchRun, nextRun: BenchRun, pFn: FunctionalCoverage, nFn: FunctionalCoverage): string[] {
  const out: string[] = [];
  for (const p of PLAN_ITEMS.filter((x) => x.scenario)) {
    const a = pFn.hits[p.id];
    const b = nFn.hits[p.id];
    if ((a > 0) === (b > 0)) continue;
    const head = `'${planLabel(p.id)}' goes from ${a} to ${b}`;
    if (p.id === "wrap") out.push(`${head}${b === 0 ? ", so it is lost" : ", so it is gained"}: ${wrapChangeReason(prevRun, nextRun)}`);
    else if (p.id === "mid-reset" && b > 0) {
      const e = nextRun.edges.find((x) => x.rst === 1 && x.before !== "X" && x.before !== 0);
      out.push(`${head}, so it is gained: rst is 1 at edge ${e?.edge} while count is ${e ? showSample(e.before) : "nonzero"}.`);
    } else out.push(`${head}, so it is ${b === 0 ? "lost" : "gained"}.`);
  }
  return out;
}

/** Why statement and branch coverage changed when the wrap line's hits cross zero. */
function wrapLineNote(pCode: CodeCoverage, nCode: CodeCoverage): string {
  const a = pCode.lineHits.wrap;
  const b = nCode.lineHits.wrap;
  if (a > 0 && b === 0) return `The wrap assignment ran ${plural(a, "time")} before and now never runs, so its statement and the true branch of count == WRAP_AT drop out of code coverage.`;
  if (a === 0 && b > 0) return `The wrap assignment now runs ${plural(b, "time")}, so its statement and the true branch of count == WRAP_AT are now covered.`;
  return "";
}

/** Functional coverage before and after, naming the scenarios gained or lost even when the count is unchanged. */
function functionalChangeText(prevRun: BenchRun, nextRun: BenchRun, pFn: FunctionalCoverage, nFn: FunctionalCoverage): string {
  const changes = scenarioChanges(prevRun, nextRun, pFn, nFn);
  const tot = nFn.scenariosTotal;
  if (changes.length === 0) return `Functional coverage stays at ${nFn.scenariosCovered} of ${tot}, with the same plan items covered.`;
  const head =
    pFn.scenariosCovered === nFn.scenariosCovered
      ? `Functional coverage changes even though it stays at ${nFn.scenariosCovered} of ${tot}: a different set of plan items is covered.`
      : `Functional coverage goes from ${pFn.scenariosCovered} to ${nFn.scenariosCovered} of ${tot}.`;
  return `${head} ${changes.join(" ")}`;
}

type ConfigField = "dut" | "form" | "checks" | "midResetAt";

/** The fields that differ between two (normalized) configs, in a fixed order. */
export function changedFields(prev: BenchConfig, next: BenchConfig): ConfigField[] {
  return (["dut", "form", "checks", "midResetAt"] as const).filter((f) => prev[f] !== next[f]);
}

function describeChange(field: ConfigField, prev: BenchConfig, next: BenchConfig): string {
  switch (field) {
    case "dut":
      return `the DUT goes from ${BENCH_DUTS[prev.dut].short} to ${BENCH_DUTS[next.dut].short}`;
    case "form":
      return `the compare goes from ${COMPARE_FORMS[prev.form].label} to ${COMPARE_FORMS[next.form].label}`;
    case "checks":
      return `the run goes from ${prev.checks} to ${next.checks} cycles`;
    default:
      return prev.midResetAt === null
        ? `rst is asserted again at edge ${next.midResetAt}`
        : next.midResetAt === null
          ? `the second reset at edge ${prev.midResetAt} is removed`
          : `the second reset moves from edge ${prev.midResetAt} to edge ${next.midResetAt}`;
  }
}

/** What a value offered for "how many times does the increment line run?" really counts. */
function incrementValueMeaning(v: number, n: number, reset: number, wrap: number, inc: number): string {
  const split = `The body runs ${n} times: ${plural(reset, "edge")} reset, ${plural(wrap, "edge")} wrap, leaving ${inc} increments.`;
  if (v === n) return `${v} counts every rising edge, including the ones that reset or wrap. ${split}`;
  if (v === inc + wrap) return `${v} counts every edge that did not reset: the ${inc} increments plus the ${plural(wrap, "wrap edge")}, which run the wrap assignment instead. ${split}`;
  if (v === n - 1) return `${v} counts every edge but one. ${split}`;
  if (v === inc - 1) return `${v} is one short of the ${inc} increments. ${split}`;
  return `${v} is not a count this run produces. ${split}`;
}

/** Why a second reset at edge k is not a reset in the middle of counting, from the run. */
function notMidCountReason(run: BenchRun, k: number): string {
  const edge = run.edges[k];
  const prior = run.edges[k - 1];
  if (run.dutRst[k] === 0) return `The DUT's rst port is tied to 0, so the DUT never sees the reset at edge ${k}.`;
  if (edge.before === "X") return `count was still X at edge ${k}, so it is not a reset in the middle of counting.`;
  if (prior.branch === "reset" && prior.rst === 1) return `count was already 0 when rst was 1 at edge ${k} (rst stayed high from edge ${k - 1}), so it is not a reset in the middle of counting.`;
  if (prior.branch === "wrap") return `count was already 0 at edge ${k}: it wrapped from 7 to 0 at edge ${k - 1}, so the reset does not interrupt a count.`;
  return `count was ${showSample(edge.before)} at edge ${k}, so it is not a reset in the middle of counting.`;
}

/**
 * The question asked before a coverage run, chosen by what changed since the
 * last revealed run. One changed field gets its own question (compare,
 * mid-count reset or run length); a DUT change or several changes at once get
 * a neutral question, so no single change is credited with a difference that
 * another change caused. Every option's truth and feedback come from running
 * the configurations.
 */
export function coverageQuestion(prev: BenchConfig | null, next: BenchConfig): CoverageQuestion {
  const nextRun = runBench(next);
  const nCode = codeCoverage(nextRun);
  const nFn = functionalCoverage(nextRun);
  const nCfg = nextRun.config;

  if (prev === null) {
    const inc = nCode.lineHits.incr;
    const n = nextRun.edges.length;
    const { reset, wrap } = nCode.lineHits;
    const values = Array.from(new Set([n, n - 1, inc, inc + wrap, Math.max(0, inc - 1)])).filter((v) => v >= 0);
    const options = values.slice(0, 4).map((v, i) => ({
      id: `inc-${i}`,
      label: `${v}`,
      correct: v === inc,
      feedback:
        v === inc
          ? `The always_ff body runs at each of the ${n} rising edges: ${reset} take the reset branch, ${wrap} the wrap branch, and the remaining ${inc} increment.`
          : incrementValueMeaning(v, n, reset, wrap, inc),
    }));
    return { kind: "baseline", question: `How many times does the increment line run in ${n} cycles?`, options: arrangeOptions(options, configKey(nCfg)) };
  }

  const prevRun = runBench(prev);
  const pCode = codeCoverage(prevRun);
  const pFn = functionalCoverage(prevRun);
  const pCfg = prevRun.config;
  const fields = changedFields(pCfg, nCfg);

  if (fields.length > 1 || (fields.length === 1 && fields[0] === "dut")) {
    const truth = coverageSummary(nCode, nFn);
    const before = coverageSummary(pCode, pFn);
    const singles = fields.map((f) => runBench({ ...pCfg, [f]: nCfg[f] }));
    const labels: string[] = [truth];
    const add = (l: string) => {
      if (labels.length < 4 && !labels.includes(l)) labels.push(l);
    };
    add(before);
    for (const r of singles) add(coverageSummary(codeCoverage(r), functionalCoverage(r)));
    for (const s of [3, 2]) for (const b of [4, 3]) for (const f of [4, 3, 2]) add(`statements ${s} of ${nCode.statementsTotal}, branches ${b} of ${nCode.branches.length}; functional ${f} of ${nFn.scenariosTotal}`);
    const notes: string[] = [];
    if (fields.includes("checks")) notes.push(`The wrap assignment runs ${plural(nCode.lineHits.wrap, "time")} (was ${pCode.lineHits.wrap}).`);
    if (fields.includes("midResetAt")) notes.push(`'reset mid-count' goes from ${pFn.hits["mid-reset"]} to ${nFn.hits["mid-reset"]}, and the rst line from ${pCode.lineHits.reset} to ${nCode.lineHits.reset} hits.`);
    const wrapNote = wrapLineNote(pCode, nCode);
    if (wrapNote) notes.push(wrapNote);
    // Name every plan item gained or lost; with several changes at once the cause is not split out.
    const lostGained = PLAN_ITEMS.filter((p) => p.scenario && p.id !== "mid-reset" && (pFn.hits[p.id] > 0) !== (nFn.hits[p.id] > 0)).map(
      (p) => `'${planLabel(p.id)}' goes from ${pFn.hits[p.id]} to ${nFn.hits[p.id]}, so it is ${nFn.hits[p.id] > 0 ? "gained" : "lost"}.`,
    );
    notes.push(...lostGained);
    if (fields.includes("form")) notes.push(`${plural(nextRun.comparesRun, "check")} ran (was ${prevRun.comparesRun}); coverage never looks at the compare.`);
    const why = `Before: ${before}. Now: ${truth}. ${notes.join(" ")} ${evidenceVerdict(nextRun).text}`.replace(/\s+/g, " ").trim();
    const changes = fields.map((f) => describeChange(f, pCfg, nCfg)).join("; ");
    return {
      kind: "several",
      question: `${fields.length > 1 ? "Several things changed since the last run" : "Since the last run"}: ${changes}. What do statement, branch and functional coverage show now?`,
      options: arrangeOptions(
        labels.map((label, i) => ({ id: `sev-${i}`, label, correct: label === truth, feedback: label === truth ? why : `Not this. ${why}` })),
        configKey(nCfg),
      ),
    };
  }

  if (fields[0] === "form") {
    const v = evidenceVerdict(nextRun);
    const covSame = sameCodeCoverage(pCode, nCode) && sameFunctionalCoverage(pFn, nFn);
    // The evidence options follow this run's verdict, so a failing run is never graded as passing.
    const evidence = v.verdict === "fail" ? "fail" : "pass";
    const evidenceText = evidence === "fail" ? "the run fails on evidence" : "the run passes on evidence";
    const truthId = v.verdict === "no-evidence" ? (covSame ? "same-no-evidence" : "drop-no-evidence") : `${covSame ? "same" : "drop"}-${evidence}`;
    const why = `Code coverage is ${codeSummary(nCode)}, functional ${nFn.scenariosCovered} of ${nFn.scenariosTotal}, and ${plural(nextRun.comparesRun, "check")} ran. ${v.text}`;
    const opts: [string, string][] = [
      ["same-no-evidence", "Coverage stays the same, checks drop to 0: no evidence"],
      ["drop-no-evidence", "Coverage drops along with the checks"],
      [`same-${evidence}`, `Coverage stays the same and ${evidenceText}`],
      [`drop-${evidence}`, `Coverage drops, but ${evidenceText}`],
    ];
    const question =
      nCfg.form === "commented"
        ? "The compare is commented out. What happens to coverage and to the verdict?"
        : pCfg.form === "commented"
          ? `The compare is back as ${COMPARE_FORMS[nCfg.form].label}. What happens to coverage and to the verdict?`
          : `The compare changes from ${COMPARE_FORMS[pCfg.form].label} to ${COMPARE_FORMS[nCfg.form].label}. What happens to coverage and to the verdict?`;
    return {
      kind: "compare",
      question,
      options: arrangeOptions(
        opts.map(([id, label]) => ({ id, label, correct: id === truthId, feedback: id === truthId ? why : `Not this. ${why} Coverage counts what ran in the DUT and the plan; it never looks at the compare.` })),
        configKey(nCfg),
      ),
    };
  }

  if (fields[0] === "midResetAt") {
    // Coverage is which items are covered, not how many: compare the sets.
    const codeChanged = !sameCodeCoverage(pCode, nCode);
    const fnChanged = !sameFunctionalCoverage(pFn, nFn);
    const truthId = `${codeChanged ? "code" : "nocode"}-${fnChanged ? "fn" : "nofn"}`;
    const midSame = (pFn.hits["mid-reset"] > 0) === (nFn.hits["mid-reset"] > 0);
    const why = [
      codeChanged
        ? `Statement and branch coverage go from ${codeSummary(pCode)} to ${codeSummary(nCode)}; the rst line's hits go from ${pCode.lineHits.reset} to ${nCode.lineHits.reset}.`
        : `Statement and branch coverage stay at ${codeSummary(nCode)}; the rst line's hits go from ${pCode.lineHits.reset} to ${nCode.lineHits.reset}.`,
      !codeChanged && nextRun.edges[0].branch === "reset" ? "The reset at edge 0 already took the rst branch, so a second reset adds hits, not coverage." : "",
      wrapLineNote(pCode, nCode),
      functionalChangeText(prevRun, nextRun, pFn, nFn),
      midSame ? `'reset mid-count' goes from ${pFn.hits["mid-reset"]} to ${nFn.hits["mid-reset"]}.` : "",
      nCfg.midResetAt !== null && nFn.hits["mid-reset"] === 0 ? notMidCountReason(nextRun, nCfg.midResetAt) : "",
    ]
      .filter(Boolean)
      .join(" ");
    const opts: [string, string][] = [
      ["nocode-fn", "Code coverage stays the same; functional coverage changes"],
      ["nocode-nofn", "Neither changes"],
      ["code-nofn", "Code coverage changes; functional coverage stays the same"],
      ["code-fn", "Both change"],
    ];
    return {
      kind: "mid-reset",
      question:
        nCfg.midResetAt === null
          ? "The mid-count reset is removed. Does statement or branch coverage change? Does functional coverage?"
          : `rst is asserted again at edge ${nCfg.midResetAt}. Does statement or branch coverage change? Does functional coverage?`,
      options: arrangeOptions(
        opts.map(([id, label]) => ({ id, label, correct: id === truthId, feedback: id === truthId ? why : `Not this. ${why}` })),
        configKey(nCfg),
      ),
    };
  }

  // Run length (or no change at all).
  const truth = codeSummary(nCode);
  const candidates = [truth, "statements 3 of 3, branches 4 of 4", "statements 3 of 3, branches 3 of 4", "statements 2 of 3, branches 3 of 4", "statements 2 of 3, branches 2 of 4"];
  const labels = Array.from(new Set(candidates)).slice(0, 4);
  const wrapNote =
    nCode.lineHits.wrap === 0
      ? `In ${nextRun.edges.length} cycles count never reaches 7, so the wrap assignment never runs: its statement and the true branch of count == WRAP_AT stay at 0, while the false branch is covered because the condition was evaluated and was false.`
      : `In ${nextRun.edges.length} cycles count reaches 7, so the wrap assignment runs ${plural(nCode.lineHits.wrap, "time")}.`;
  const why = `${wrapNote} Result: ${truth}. Statement coverage counts statements executed at least once (§40.2.2); branch coverage is tool-defined, and here it counts the four outcomes of the two conditions.`;
  return {
    kind: "length",
    question: `A ${nextRun.edges.length}-cycle run. What do statement and branch coverage show?`,
    options: arrangeOptions(
      labels.map((label, i) => ({ id: `len-${i}`, label, correct: label === truth, feedback: label === truth ? why : `Not this. ${why}` })),
      configKey(nCfg),
    ),
  };
}

// ---------------------------------------------------------------------------
// Matrix mode: compare forms × mutants, with the plan's coverage rows
// ---------------------------------------------------------------------------

export interface PlanRow {
  id: PlanItemId;
  label: string;
  /** The mutant this plan row exists to catch, or null. */
  mutant: BenchDutId | null;
  hits: number;
}

/** Plan rows with their coverage counts on the lesson bench (correct DUT, !==). */
export function planRows(checks = LESSON_CHECKS, midResetAt: number | null = null): PlanRow[] {
  const fn = functionalCoverage(runBench({ dut: "correct", form: "case-ne", checks, midResetAt }));
  const target: Record<PlanItemId, BenchDutId | null> = { reset: "no-reset", increment: null, wrap: "wrap6", "mid-reset": "reset-ignored", checks: "no-reset" };
  return PLAN_ITEMS.map((p) => ({ id: p.id, label: p.label, mutant: target[p.id], hits: fn.hits[p.id] }));
}

export function mutationMatrix(checks = LESSON_CHECKS, midResetAt: number | null = null): MutantVerdict[] {
  return COMPARE_FORM_IDS.flatMap((form) => MUTANT_IDS.map((m) => mutantVerdict(m, form, checks, midResetAt)));
}

/** The edge the matrix offers for filling the 'reset mid-count' hole. */
export const HOLE_FILL_EDGE = 10;

// ---------------------------------------------------------------------------
// Presets (one per lesson use)
// ---------------------------------------------------------------------------

export type CounterBenchMode = "mutation" | "matrix" | "coverage";

export interface MutationPreset {
  id: string;
  label: string;
  dut: BenchDutId;
  form: CompareFormId;
}

export const MUTATION_PRESETS: MutationPreset[] = [
  { id: "lesson-mutant", label: "Make It Work Step 3: the WRAP_AT(6) mutant", dut: "wrap6", form: "case-ne" },
  { id: "x-blind", label: "A test must be able to fail: the X-blind compare", dut: "no-reset", form: "logic-ne" },
  { id: "self-copy", label: "Qualifying the testbench: a self-copy", dut: "wrap6", form: "self-copy" },
];

export const findMutationPreset = (id: string | undefined) => MUTATION_PRESETS.find((p) => p.id === id) ?? MUTATION_PRESETS[0];

export const COUNTER_BENCH_ASSUMPTIONS = [
  "Every number is computed by the counter-bench model from the lesson's bench: clk toggles every 5 ns from 0, rst is 1 at rising edge 0 only, and check i is taken at the falling edge 10 + 10 i ns, reading the value the flop took at rising edge i.",
  "Compare values follow IEEE 1800-2023 §11.4.5 (!= gives 1'bx when x or z bits make the relation ambiguous; !== and === compare x and z literally and give 0 or 1), and the if follows §12.4 (a 0, x or z condition takes the else).",
  "A counter that is never reset holds X: a 4-state variable with no initializer starts at 'x (§6.8, Table 6-7), and X + 1 stays X.",
  "The 'reset ignored mid-count' mutant gates its reset with $isunknown(count) (§20.9), so rst only works while count is X. It is a deliberate bug for this lab, not a pattern from the lesson.",
  "Statement and toggle coverage follow the §40.2.2 definitions (executed at least once; each bit seen at 0 and at 1). Branch coverage is not defined by the standard: the counts shown are the four outcomes of the two if conditions, and how a tool counts an x condition is tool-defined. Tools that count 0-to-1 and 1-to-0 transitions for toggle may report rst as only partly toggled.",
  "The statement count covers only the three assignments in always_ff, as the lesson's report does. §40.2.2 counts anything defined as a statement in the standard, with a granularity of per statement or per statement block depending on the query, so a tool may also count the if-else and the begin-end and show a different total.",
  "Functional coverage items are user-defined (§19.2); the five here are the lesson's plan rows. 'checks with !==' counts compares that ran: it is evidence that checking happened, not a scenario, so it is kept out of the functional percentage.",
  "A real simulator prints its own prefix on $error lines and formats coverage reports its own way; both are tool-dependent.",
];
