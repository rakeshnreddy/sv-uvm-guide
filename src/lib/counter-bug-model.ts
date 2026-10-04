/**
 * Cycle-based model of a 3-bit up counter with a seeded bug, plus a tiny
 * evaluator for the handful of concurrent assertions offered in the F1B bug
 * hunt. Pure and deterministic: no React, no randomness.
 *
 * Conventions (match `CycleWaveform`):
 * - `count[k]` is the value *sampled at rising edge k*, i.e. the value the
 *   flop held just before edge k (the Preponed sample, IEEE 1800-2023 §16.5.1).
 * - The flop's update at edge k becomes `count[k + 1]`.
 * - `rst[k]` is the synchronous reset value at edge k. The testbench changes it
 *   away from clock edges, so its current and sampled values agree at each edge.
 *
 * Semantics pinned by tests (tests/lib/counter-bug-model.test.ts):
 * - §12.4: an `if` whose condition is x takes the else branch, so a counter
 *   that was never reset stays X (X + 1 = X).
 * - §16.6: an assertion boolean that evaluates to x/z is false.
 * - §16.12.7: no antecedent match → the implication succeeds (vacuously);
 *   `|->` checks the consequent at the same tick, `|=>` at the next tick.
 * - §16.14.8: an attempt whose antecedent is false is a vacuous success.
 * - §16.12 / §16.15: `disable iff (rst)` abandons an attempt while rst is 1.
 */

export type CounterSample = number | "X";

export const COUNTER_WIDTH = 3;
export const COUNTER_MODULUS = 1 << COUNTER_WIDTH; // 8
export const COUNTER_MAX = COUNTER_MODULUS - 1; // 7

export type CounterDesignId = "buggy" | "fixed";

export interface CounterDesign {
  id: CounterDesignId;
  /** Value at which the explicit wrap branch loads 0 (`if (count == 3'dN) count <= '0;`). */
  wrapAt: number;
}

/** The seeded bug: the wrap branch fires one value early, so 7 is never reached. */
export const BUGGY_COUNTER: CounterDesign = { id: "buggy", wrapAt: 6 };
/** The fix: wrap after 7 (identical to letting the 3-bit add overflow). */
export const FIXED_COUNTER: CounterDesign = { id: "fixed", wrapAt: 7 };

export interface CounterStimulus {
  edges: number;
  /** Synchronous reset sampled at each edge (1 = asserted). */
  rst: (0 | 1)[];
}

/** rst is high for edge 0 only, then released: the counter starts from 0 at edge 1. */
export const DEFAULT_STIMULUS: CounterStimulus = {
  edges: 12,
  rst: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export interface CounterTrace {
  design: CounterDesign;
  stimulus: CounterStimulus;
  /** Value sampled at each edge. */
  count: CounterSample[];
}

const rstAt = (stim: CounterStimulus, k: number): 0 | 1 => stim.rst[k] ?? 0;

/** Next-state function of the RTL shown to learners (see `counterSourceLines`). */
export function nextCount(design: CounterDesign, current: CounterSample, rst: 0 | 1): CounterSample {
  if (rst === 1) return 0; // if (rst) count <= '0;
  if (current === "X") return "X"; // §12.4: (X == 3'dN) is x → else branch; X + 1 = X
  if (current === design.wrapAt) return 0; // else if (count == 3'dN) count <= '0;
  return (current + 1) % COUNTER_MODULUS; // else count <= count + 3'd1; (3-bit result)
}

/** Simulate the DUT edge by edge. count[0] is X: nothing has initialised the flop yet. */
export function simulateCounter(design: CounterDesign, stimulus: CounterStimulus = DEFAULT_STIMULUS): CounterTrace {
  const count: CounterSample[] = ["X"];
  for (let k = 0; k < stimulus.edges - 1; k += 1) {
    count.push(nextCount(design, count[k], rstAt(stimulus, k)));
  }
  return { design, stimulus, count };
}

/**
 * Golden reference for the spec: "After reset, count increases by 1 on every
 * rising edge: 0, 1, …, 7, then wraps to 0." `null` = the spec says nothing
 * (before the first reset).
 */
export function specExpected(stimulus: CounterStimulus = DEFAULT_STIMULUS): (number | null)[] {
  const expected: (number | null)[] = [null];
  for (let k = 0; k < stimulus.edges - 1; k += 1) {
    const cur = expected[k];
    expected.push(rstAt(stimulus, k) === 1 ? 0 : cur === null ? null : (cur + 1) % COUNTER_MODULUS);
  }
  return expected;
}

export type EdgeCheck = "unspecified" | "match" | "mismatch";

export interface SpecComparison {
  expected: (number | null)[];
  checks: EdgeCheck[];
  /** First edge whose sample disagrees with the spec, or null when none does. */
  firstMismatch: number | null;
  checkedEdges: number;
}

export function compareWithSpec(trace: CounterTrace): SpecComparison {
  const expected = specExpected(trace.stimulus);
  const checks: EdgeCheck[] = expected.map((e, k) => (e === null ? "unspecified" : trace.count[k] === e ? "match" : "mismatch"));
  const first = checks.indexOf("mismatch");
  return {
    expected,
    checks,
    firstMismatch: first === -1 ? null : first,
    checkedEdges: checks.filter((c) => c !== "unspecified").length,
  };
}

export type EdgePickKind = "unspecified" | "match" | "cause" | "first-mismatch" | "later-mismatch";

export interface EdgePickDiagnosis {
  edge: number;
  kind: EdgePickKind;
  correct: boolean;
  message: string;
}

const show = (v: CounterSample | null) => (v === null ? "unspecified" : String(v));

/** Diagnostic feedback for "which edge is the first failure?". */
export function diagnoseEdgePick(trace: CounterTrace, edge: number): EdgePickDiagnosis {
  const cmp = compareWithSpec(trace);
  const actual = trace.count[edge];
  const expected = cmp.expected[edge];
  const first = cmp.firstMismatch;

  if (cmp.checks[edge] === "unspecified") {
    return {
      edge,
      kind: "unspecified",
      correct: false,
      message: `count is ${show(actual)} here because nothing has reset it yet. The spec only describes count after reset, so this is not a violation. rst is high at this edge, so count reads 0 one edge later.`,
    };
  }
  if (cmp.checks[edge] === "match") {
    if (first !== null && edge === first - 1) {
      return {
        edge,
        kind: "cause",
        correct: false,
        message: `count = ${show(actual)} is still correct here. But this is the edge where the counter decides its next value, and it decides wrongly. The wrong value only appears in the next sample. Look one edge later.`,
      };
    }
    const prev = edge > 0 ? cmp.expected[edge - 1] : null;
    return {
      edge,
      kind: "match",
      correct: false,
      message:
        prev === null
          ? `count = ${show(actual)}: reset was applied at the previous edge, and the spec says count starts at 0. This sample is correct.`
          : `count = ${show(actual)} is exactly what the spec expects (${prev} + 1${prev === COUNTER_MAX ? ", wrapping to 0" : ""}). This sample is correct.`,
    };
  }
  if (edge === first) {
    return {
      edge,
      kind: "first-mismatch",
      correct: true,
      message: `The spec expects ${show(expected)} (one more than ${show(cmp.expected[edge - 1])}), but the counter shows ${show(actual)}. This is the first sample that breaks the spec: the counter skipped ${show(expected)}.`,
    };
  }
  return {
    edge,
    kind: "later-mismatch",
    correct: false,
    message: `This sample is wrong too (expected ${show(expected)}, saw ${show(actual)}), but it is not the first one. Once a counter slips, every later value is shifted. Always debug from the first divergence.`,
  };
}

// ---------------------------------------------------------------------------
// Source code shown to learners, generated from the design data.
// ---------------------------------------------------------------------------

export type CounterLineKey =
  | "module"
  | "port-clk"
  | "port-rst"
  | "port-count"
  | "port-end"
  | "always"
  | "reset"
  | "wrap"
  | "incr"
  | "end"
  | "endmodule";

export interface CounterSourceLine {
  key: CounterLineKey;
  text: string;
}

export function counterSourceLines(design: CounterDesign): CounterSourceLine[] {
  return [
    { key: "module", text: "module up_counter (" },
    { key: "port-clk", text: "  input  logic       clk," },
    { key: "port-rst", text: "  input  logic       rst,   // synchronous, active-high" },
    { key: "port-count", text: "  output logic [2:0] count" },
    { key: "port-end", text: ");" },
    { key: "always", text: "  always_ff @(posedge clk) begin" },
    { key: "reset", text: "    if (rst)                count <= '0;" },
    { key: "wrap", text: `    else if (count == 3'd${design.wrapAt}) count <= '0;` },
    { key: "incr", text: "    else                    count <= count + 3'd1;" },
    { key: "end", text: "  end" },
    { key: "endmodule", text: "endmodule" },
  ];
}

export interface LineSuspect {
  key: CounterLineKey;
  culprit: boolean;
  feedback: string;
}

/** Feedback for each line the learner may suspect in the buggy design. */
export function lineSuspects(design: CounterDesign = BUGGY_COUNTER): LineSuspect[] {
  return [
    {
      key: "port-count",
      culprit: false,
      feedback: `Three bits hold 0 to ${COUNTER_MAX}, exactly the range in the spec. A wrong width would wrap at 3 or 15, not at ${design.wrapAt}.`,
    },
    {
      key: "always",
      culprit: false,
      feedback: "The waveform changes once per rising edge, as the spec asks, so the clocking is right.",
    },
    {
      key: "reset",
      culprit: false,
      feedback: "Reset works: rst is high at edge 0 and count reads 0 at edge 1. The bug appears much later, long after reset.",
    },
    {
      key: "wrap",
      culprit: true,
      feedback: `When count is ${design.wrapAt}, this branch loads 0 instead of letting the counter reach ${design.wrapAt + 1}. The terminal value is off by one. Compare against 3'd${COUNTER_MAX}, or delete the branch, because a 3-bit count + 1 already wraps from 7 to 0.`,
    },
    {
      key: "incr",
      culprit: false,
      feedback: `This increment produces every step from 0 to ${design.wrapAt} correctly. At count == ${design.wrapAt} it never runs, because the branch above it wins.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Assertion evaluator for the four offered properties.
// ---------------------------------------------------------------------------

export interface CountPredicate {
  op: "==" | "<=";
  value: number;
}

export interface CounterAssertion {
  id: string;
  /** SystemVerilog text shown to the learner. */
  source: string;
  disableOnRst: boolean;
  /** null = plain boolean property (no implication). */
  antecedent: CountPredicate | null;
  implication: "|->" | "|=>" | null;
  consequent: CountPredicate;
}

const literal = (n: number) => `3'd${n}`;
const predText = (p: CountPredicate) => `count ${p.op} ${literal(p.value)}`;

function assertionSource(a: Omit<CounterAssertion, "source">): string {
  const body = a.antecedent && a.implication ? `${predText(a.antecedent)} ${a.implication} ${predText(a.consequent)}` : predText(a.consequent);
  return `assert property (@(posedge clk)${a.disableOnRst ? " disable iff (rst)" : ""} ${body});`;
}

function makeAssertion(a: Omit<CounterAssertion, "source">): CounterAssertion {
  return { ...a, source: assertionSource(a) };
}

/** The four options offered in step 3. Only "catch" fires on the bug and stays quiet on the fix. */
export const ASSERTION_OPTIONS: CounterAssertion[] = [
  makeAssertion({ id: "catch", disableOnRst: true, antecedent: { op: "==", value: 6 }, implication: "|=>", consequent: { op: "==", value: 7 } }),
  makeAssertion({ id: "wrap-vacuous", disableOnRst: true, antecedent: { op: "==", value: 7 }, implication: "|=>", consequent: { op: "==", value: 0 } }),
  makeAssertion({ id: "tautology", disableOnRst: true, antecedent: null, implication: null, consequent: { op: "<=", value: 7 } }),
  makeAssertion({ id: "same-cycle", disableOnRst: false, antecedent: { op: "==", value: 6 }, implication: "|->", consequent: { op: "==", value: 7 } }),
];

/** §16.6: x or z makes the boolean false. */
export function evalPredicate(p: CountPredicate, v: CounterSample): boolean {
  if (v === "X") return false;
  return p.op === "==" ? v === p.value : v <= p.value;
}

export type AttemptStatus = "pass" | "fail" | "vacuous" | "disabled" | "pending";

export interface AttemptResult {
  start: number;
  status: AttemptStatus;
  /** Edge at which the attempt resolved (the failure edge for "fail"). */
  decidedAt: number;
}

export interface AssertionEvaluation {
  attempts: AttemptResult[];
  firstFailure: number | null;
  nonvacuousPasses: number;
  vacuous: number;
  verdict: "fails" | "passes" | "vacuous";
}

/**
 * One attempt starts at every edge. Disabled while rst is 1 at any tick the
 * attempt spans (§16.12 disable iff; rst changes away from edges, so its
 * current and sampled values agree). Antecedent false → vacuous success
 * (§16.12.7, §16.14.8). `|=>` checks the consequent one tick later.
 */
export function evaluateAssertion(a: CounterAssertion, trace: CounterTrace): AssertionEvaluation {
  const n = trace.stimulus.edges;
  const attempts: AttemptResult[] = [];
  for (let start = 0; start < n; start += 1) {
    const disabledAt = (k: number) => a.disableOnRst && rstAt(trace.stimulus, k) === 1;
    if (disabledAt(start)) {
      attempts.push({ start, status: "disabled", decidedAt: start });
      continue;
    }
    if (a.antecedent && !evalPredicate(a.antecedent, trace.count[start])) {
      attempts.push({ start, status: "vacuous", decidedAt: start });
      continue;
    }
    const checkAt = a.implication === "|=>" ? start + 1 : start;
    if (checkAt >= n) {
      attempts.push({ start, status: "pending", decidedAt: checkAt });
      continue;
    }
    if (disabledAt(checkAt)) {
      attempts.push({ start, status: "disabled", decidedAt: checkAt });
      continue;
    }
    attempts.push({ start, status: evalPredicate(a.consequent, trace.count[checkAt]) ? "pass" : "fail", decidedAt: checkAt });
  }
  const failures = attempts.filter((t) => t.status === "fail");
  const nonvacuousPasses = attempts.filter((t) => t.status === "pass").length;
  const vacuous = attempts.filter((t) => t.status === "vacuous").length;
  return {
    attempts,
    firstFailure: failures.length > 0 ? Math.min(...failures.map((f) => f.decidedAt)) : null,
    nonvacuousPasses,
    vacuous,
    verdict: failures.length > 0 ? "fails" : nonvacuousPasses === 0 ? "vacuous" : "passes",
  };
}

export interface AssertionGrade {
  assertion: CounterAssertion;
  onBuggy: AssertionEvaluation;
  onFixed: AssertionEvaluation;
  /** Fires on the bug and stays silent on the corrected design. */
  catchesBug: boolean;
  /** Fails on the corrected design (a false alarm). */
  falseAlarm: boolean;
}

export function gradeAssertion(a: CounterAssertion, stimulus: CounterStimulus = DEFAULT_STIMULUS): AssertionGrade {
  const onBuggy = evaluateAssertion(a, simulateCounter(BUGGY_COUNTER, stimulus));
  const onFixed = evaluateAssertion(a, simulateCounter(FIXED_COUNTER, stimulus));
  return {
    assertion: a,
    onBuggy,
    onFixed,
    catchesBug: onBuggy.verdict === "fails" && onFixed.verdict !== "fails",
    falseAlarm: onFixed.verdict === "fails",
  };
}

/** One-line, learner-facing summary of an evaluation. */
export function describeEvaluation(e: AssertionEvaluation): string {
  if (e.verdict === "fails") return `fails at edge ${e.firstFailure}`;
  if (e.verdict === "vacuous") return `never fails, but every attempt passed vacuously (${e.vacuous} vacuous, 0 real checks)`;
  return `never fails (${e.nonvacuousPasses} real check${e.nonvacuousPasses === 1 ? "" : "s"} passed)`;
}
