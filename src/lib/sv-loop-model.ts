/**
 * Loop tracer model: counts the passes of the SystemVerilog loop statements
 * and records every step, so the LoopTracer view can replay them. Pure: no
 * React, no scheduler.
 *
 * Rules, each from IEEE 1800-2023:
 * - §12.7.1 for: the initialization runs once; the test runs before every
 *   pass, and a false, x or z test (treated as zero) ends the loop; the step
 *   runs after each pass, then the test again.
 * - §12.7.2 repeat: the count is evaluated once, before the loop starts, and
 *   changing it inside the loop has no effect; a negative, unknown or
 *   high-impedance count is treated as zero, so no pass runs.
 * - §12.7.3 foreach: one loop per index, outer loops for the lower
 *   cardinality (leftmost) indices, so the rightmost index changes fastest;
 *   each index runs from its left bound to its right bound.
 * - §12.7.4 while: the test is made before each pass, so the body may run
 *   zero times; "true" is as defined in §12.4.
 * - §12.7.5 do...while: the test is evaluated after the statement, so the
 *   body runs at least once.
 * - §12.7.6 forever: no test; without a timing control it is a zero-delay
 *   infinite loop (§9.2.2.1 says the same of an always procedure).
 * - §12.8 continue jumps to the end of the loop and runs the loop control;
 *   break leaves the loop, and in a multi-dimensional foreach it leaves the
 *   whole loop, not just the current dimension.
 * - §12.4 a condition that is zero, x or z is false.
 * - §11.4.4 a relational operator with an x or z operand bit yields 1'bx; if
 *   either operand is unsigned the comparison is unsigned (zero-extended),
 *   otherwise signed (sign-extended).
 *
 * The zero-delay verdict uses a statement budget, after the loopBudget idea in
 * sv-process-model: more than ZERO_DELAY_BUDGET statements and loop tests at
 * one simulation time with nothing waiting is reported as a loop in which time
 * never advances. That is the model's heuristic, not a rule of the standard: a
 * real loop may legally run many more statements at one time and still end.
 * The lab's inputs are limited so every loop that ends does so well inside the
 * budget. A statement that would go over the budget is not run or counted, so
 * the verdict shows exactly ZERO_DELAY_BUDGET statements. A delay control such
 * as #5 belongs to the statement it delays (§9.4.1), so it is shown as a step
 * but not counted as a statement.
 */

import { fromNumber, hasUnknown, parseBits, resize, toSigned, toUnsigned, truthOf, type Bit4 } from "@/lib/sv-four-state-model";

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/** Declared type of the count variable `n`: int is 2-state, 32-bit, signed (§6.11). */
export type CountType = "int" | "logic4" | "logic4s";

export const COUNT_TYPE_DECL: Record<CountType, string> = {
  int: "int",
  logic4: "logic [3:0]",
  logic4s: "logic signed [3:0]",
};

export const INT_INPUT_MIN = -8;
export const INT_INPUT_MAX = 15;
export const BOUND_MIN = 0;
export const BOUND_MAX = 8;

export interface LoopInputs {
  countType: CountType;
  /** Value of an int n (clamped to INT_INPUT_MIN … INT_INPUT_MAX). */
  countInt: number;
  /** Four 4-state bits for a logic [3:0] n, MSB first, such as "1101" or "xxxx". */
  countBits: string;
  /** The 1-bit condition variable c of the while and do...while programs. */
  cond: Bit4;
  /** The N of `i < N` in the lesson's for loop. */
  bound: number;
}

export const DEFAULT_INPUTS: LoopInputs = { countType: "logic4", countInt: 3, countBits: "1101", cond: "0", bound: 5 };

export const clampInt = (v: number, min = INT_INPUT_MIN, max = INT_INPUT_MAX) =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, Math.trunc(v))) : min < 0 && max > 0 ? 0 : min;

export type BitsParse = { ok: true; bits: Bit4[] } | { ok: false; error: string };

/** Parses the four bits typed for a logic [3:0] n. */
export function parseCountBits(text: string): BitsParse {
  const clean = text.trim().replace(/_/g, "").toLowerCase();
  if (clean.length !== 4) return { ok: false, error: "Type exactly four bits, each 0, 1, x or z, such as 1101 or xxxx." };
  if (!/^[01xz]{4}$/.test(clean)) return { ok: false, error: "Use only 0, 1, x and z for the four bits." };
  return { ok: true, bits: parseBits(clean) };
}

/** The value of n as declared: its bits and signedness. */
export interface CountValue {
  type: CountType;
  bits: Bit4[];
  signed: boolean;
}

export function countValue(inputs: LoopInputs): CountValue {
  if (inputs.countType === "int") return { type: "int", bits: fromNumber(clampInt(inputs.countInt), 32), signed: true };
  const parsed = parseCountBits(inputs.countBits);
  const bits = parsed.ok ? parsed.bits : (["x", "x", "x", "x"] as Bit4[]);
  return { type: inputs.countType, bits, signed: inputs.countType === "logic4s" };
}

/** Decimal value of a fully known count, or null when any bit is x or z. */
export const countNumber = (n: CountValue): number | null => {
  const v = n.signed ? toSigned(n.bits) : toUnsigned(n.bits);
  return v === null ? null : Number(v);
};

/** How the count reads in text: `int n = -1`, `4'b1101 is 13 (unsigned)`. */
export function describeCount(n: CountValue): string {
  if (n.type === "int") return `n is ${countNumber(n)}`;
  const lit = `4'b${n.bits.join("")}`;
  if (n.bits.some((b) => b === "x")) return `n is ${lit}, which has an unknown (x) bit`;
  if (n.bits.some((b) => b === "z")) return `n is ${lit}, which has a high-impedance (z) bit`;
  return `n is ${lit}, which is ${countNumber(n)} as ${n.signed ? "a signed" : "an unsigned"} value`;
}

export type RepeatCountReason = "counted" | "negative" | "unknown" | "high-impedance";

/**
 * §12.7.2: the repeat count. A negative, unknown or high-impedance value is
 * treated as zero. The model reads a count with any x bit as unknown, and one
 * with z bits but no x bit as high impedance.
 */
export function repeatCount(n: CountValue): { count: number; reason: RepeatCountReason } {
  if (n.bits.some((b) => b === "x")) return { count: 0, reason: "unknown" };
  if (n.bits.some((b) => b === "z")) return { count: 0, reason: "high-impedance" };
  const v = countNumber(n) as number;
  if (v < 0) return { count: 0, reason: "negative" };
  return { count: v, reason: "counted" };
}

/** §11.4.4: a < b on 4-state operands. */
export function lessThan(a: { bits: readonly Bit4[]; signed: boolean }, b: { bits: readonly Bit4[]; signed: boolean }): Bit4 {
  if (hasUnknown(a.bits) || hasUnknown(b.bits)) return "x";
  const signed = a.signed && b.signed;
  const width = Math.max(a.bits.length, b.bits.length);
  const extend = (bits: readonly Bit4[]) =>
    signed ? [...Array<Bit4>(width - bits.length).fill(bits[0]), ...bits] : resize(bits, width);
  const read = (bits: Bit4[]) => (signed ? toSigned(bits) : toUnsigned(bits)) as bigint;
  return read(extend(a.bits)) < read(extend(b.bits)) ? "1" : "0";
}

/** §12.4: a condition is taken only when it is known nonzero. */
export const conditionTaken = (bits: readonly Bit4[]) => truthOf(bits) === "true";

/**
 * §12.7.3: the visit order of a foreach over the given [left:right] ranges.
 * The leftmost index is the outer loop and the rightmost changes fastest;
 * each index runs from its left bound to its right bound.
 */
export function foreachOrder(ranges: readonly (readonly [number, number])[], leftmostFastest = false): number[][] {
  const seq = ([l, r]: readonly [number, number]) => {
    const out: number[] = [];
    const dir = l <= r ? 1 : -1;
    for (let v = l; v !== r + dir; v += dir) out.push(v);
    return out;
  };
  const dims = ranges.map(seq);
  // Outer loops first: index 0 (leftmost) is the outermost unless the order is flipped.
  const outerFirst = leftmostFastest ? [...dims.keys()].reverse() : [...dims.keys()];
  let tuples: number[][] = [[]];
  for (const d of outerFirst) {
    const next: number[][] = [];
    for (const t of tuples) for (const v of dims[d]) next.push([...t, v]);
    tuples = next;
  }
  // Each tuple lists values outer loop first; put them back in index order.
  return tuples.map((t) => {
    const out = new Array<number>(ranges.length);
    outerFirst.forEach((d, i) => {
      out[d] = t[i];
    });
    return out;
  });
}

/* ------------------------------------------------------------------ */
/* Programs and presets                                                */
/* ------------------------------------------------------------------ */

export type LoopProgramId = "for-jumps" | "repeat-count" | "repeat-change" | "while" | "do-while" | "for-x" | "foreach" | "forever-clock" | "forever-toggle";

export type LoopForm = "for" | "repeat" | "while" | "do-while" | "foreach" | "forever";

export type FlowBoxId = "init" | "test" | "wait" | "body" | "step" | "exit";

export interface FlowBox {
  id: FlowBoxId;
  /** The code the box stands for. */
  code: string;
  /** What the box does, in words. */
  role: string;
  /** Where the loop goes from here. */
  next: string;
}

/** How the flowchart draws the loop's edges: the way back into the loop and the branches out of it. */
export interface FlowEdges {
  /** The box the last in-loop box goes back to. */
  loopBackTo: FlowBoxId;
  /** The loop-back marker's text, such as "back to the test". */
  loopBackLabel: string;
  /** Where the exit box is reached from; empty for forever, which has no exit. */
  exitFrom: string[];
}

export type TestPlacement = "before" | "after" | "none";

export type InputField = "count" | "countInt" | "cond" | "bound";

export interface LoopProgram {
  id: LoopProgramId;
  form: LoopForm;
  code: string[];
  boxes: FlowBox[];
  testPlacement: TestPlacement;
  inputs: InputField[];
  /** Condition values the learner may choose, for programs with a condition input. */
  condChoices?: Bit4[];
  edges: FlowEdges;
}

export const ZERO_DELAY_BUDGET = 60;
export const FOREVER_TRACE_PASSES = 6;
export const CLOCK_DELAY = 5;

export const FOREACH_RANGES: readonly (readonly [number, number])[] = [
  [1, 2],
  [1, 3],
];

const literal1 = (b: Bit4) => `1'b${b}`;

function countDecl(n: CountValue): string {
  if (n.type === "int") return `int n = ${countNumber(n)};`;
  const decl = COUNT_TYPE_DECL[n.type];
  if (n.bits.every((b) => b === "x")) return `${decl} n;  // never assigned: 4'bxxxx`;
  return `${decl} n = 4'b${n.bits.join("")};`;
}

export function buildProgram(id: LoopProgramId, inputs: LoopInputs): LoopProgram {
  const n = countValue(inputs);
  switch (id) {
    case "for-jumps": {
      const bound = clampInt(inputs.bound, BOUND_MIN, BOUND_MAX);
      return {
        id,
        form: "for",
        testPlacement: "before",
        inputs: ["bound"],
        code: [
          `for (int i = 0; i < ${bound}; i++) begin`,
          "  if (i == 1) continue;",
          "  if (i == 3) break;",
          '  $display("i = %0d", i);',
          "end",
        ],
        boxes: [
          { id: "init", code: "int i = 0", role: "Initialization: runs once", next: "Then the test" },
          { id: "test", code: `i < ${bound} ?`, role: "The test, before every pass", next: "True: run the body. False, x or z: leave the loop" },
          { id: "body", code: "if … continue; if … break; $display", role: "The body", next: "At its end or on continue: the step. On break: leave the loop" },
          { id: "step", code: "i++", role: "The step", next: "Back to the test" },
          { id: "exit", code: "loop ends", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the test", exitFrom: ["the test, when it is false, x or z", "break in the body"] },
      };
    }
    case "repeat-count":
      return {
        id,
        form: "repeat",
        testPlacement: "before",
        inputs: ["count"],
        code: [countDecl(n), "int count = 0;", "repeat (n) count++;", '$display("count = %0d", count);'],
        boxes: [
          { id: "init", code: "evaluate n", role: "The count, evaluated once before the loop", next: "Then the pass check" },
          { id: "test", code: "passes left ?", role: "Checked before every pass", next: "Yes: run the body. No: leave the loop" },
          { id: "body", code: "count++", role: "The body", next: "Back to the pass check" },
          { id: "exit", code: "$display", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the pass check", exitFrom: ["the pass check, when no passes are left"] },
      };
    case "repeat-change": {
      const v = clampInt(inputs.countInt);
      return {
        id,
        form: "repeat",
        testPlacement: "before",
        inputs: ["countInt"],
        code: [`int n = ${v};`, "repeat (n) begin", '  $display("n = %0d", n);', "  n++;", "end"],
        boxes: [
          { id: "init", code: "evaluate n", role: "The count, evaluated once before the loop", next: "Then the pass check" },
          { id: "test", code: "passes left ?", role: "Checked before every pass", next: "Yes: run the body. No: leave the loop" },
          { id: "body", code: "$display; n++", role: "The body", next: "Back to the pass check" },
          { id: "exit", code: "loop ends", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the pass check", exitFrom: ["the pass check, when no passes are left"] },
      };
    }
    case "while":
      return {
        id,
        form: "while",
        testPlacement: "before",
        inputs: ["cond"],
        condChoices: ["0", "1", "x", "z"],
        code: [`logic c = ${literal1(inputs.cond)};`, "while (c) begin", '  $display("pass, c = %b", c);', "  c = 1'b0;", "end"],
        boxes: [
          { id: "test", code: "c ?", role: "The test, before every pass", next: "True: run the body. False, x or z: leave the loop" },
          { id: "body", code: "$display; c = 1'b0", role: "The body", next: "Back to the test" },
          { id: "exit", code: "loop ends", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the test", exitFrom: ["the test, when c is false, x or z"] },
      };
    case "do-while": {
      const cond = inputs.cond === "1" ? "1" : "0";
      return {
        id,
        form: "do-while",
        testPlacement: "after",
        inputs: ["cond"],
        condChoices: ["0", "1"],
        code: [`logic c = ${literal1(cond)};`, "do begin", '  $display("pass, c = %b", c);', "  c = 1'b0;", "end while (c);"],
        boxes: [
          { id: "body", code: "$display; c = 1'b0", role: "The body, first", next: "Then the test" },
          { id: "test", code: "c ?", role: "The test, after every pass", next: "True: run the body again. False, x or z: leave the loop" },
          { id: "exit", code: "loop ends", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "body", loopBackLabel: "true: back to the body", exitFrom: ["the test, when c is false, x or z"] },
      };
    }
    case "for-x":
      return {
        id,
        form: "for",
        testPlacement: "before",
        inputs: ["count"],
        code: [countDecl(n), "int count = 0;", "for (int i = 0; i < n; i++) count++;", '$display("count = %0d", count);'],
        boxes: [
          { id: "init", code: "int i = 0", role: "Initialization: runs once", next: "Then the test" },
          { id: "test", code: "i < n ?", role: "The test, before every pass", next: "True: run the body. False, x or z: leave the loop" },
          { id: "body", code: "count++", role: "The body", next: "Then the step" },
          { id: "step", code: "i++", role: "The step", next: "Back to the test" },
          { id: "exit", code: "$display", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the test", exitFrom: ["the test, when it is false, x or z"] },
      };
    case "foreach":
      return {
        id,
        form: "foreach",
        testPlacement: "before",
        inputs: [],
        code: [
          "int prod [1:2][1:3];",
          "foreach (prod[k, m]) begin",
          "  if (m == 1) continue;",
          "  if (k == 1 && m == 3) break;",
          '  $display("k=%0d m=%0d", k, m);',
          "end",
        ],
        boxes: [
          { id: "init", code: "k = 1, m = 1", role: "The first index pair", next: "Then the check" },
          { id: "test", code: "pair left ?", role: "Checked before every pass", next: "Yes: run the body. No: leave the loop" },
          { id: "body", code: "if … continue; if … break; $display", role: "The body", next: "At its end or on continue: the next pair. On break: leave the whole loop" },
          { id: "step", code: "next pair", role: "m, the rightmost index, changes fastest", next: "Back to the check" },
          { id: "exit", code: "loop ends", role: "After the loop", next: "" },
        ],
        edges: { loopBackTo: "test", loopBackLabel: "back to the check", exitFrom: ["the check, when no pair is left", "break in the body, which leaves the whole loop"] },
      };
    case "forever-clock":
      return {
        id,
        form: "forever",
        testPlacement: "none",
        inputs: [],
        code: ["logic clk = 1'b0;", `initial forever #${CLOCK_DELAY} clk = ~clk;`],
        boxes: [
          { id: "wait", code: `#${CLOCK_DELAY}`, role: `Timing control: waits ${CLOCK_DELAY} time units`, next: "Then the statement" },
          { id: "body", code: "clk = ~clk", role: "The statement", next: "Back to the wait: there is no test" },
        ],
        edges: { loopBackTo: "wait", loopBackLabel: "back to the wait", exitFrom: [] },
      };
    case "forever-toggle":
      return {
        id,
        form: "forever",
        testPlacement: "none",
        inputs: [],
        code: ["logic x = 1'b0;", "initial forever x = ~x;"],
        boxes: [{ id: "body", code: "x = ~x", role: "The statement, with no timing control", next: "Straight back to the statement: there is no test" }],
        edges: { loopBackTo: "body", loopBackLabel: "back to the statement", exitFrom: [] },
      };
  }
}

export type LoopPresetId =
  | "for-continue-break"
  | "repeat-x"
  | "repeat-negative-int"
  | "repeat-1101"
  | "repeat-change-n"
  | "while-zero"
  | "do-while-zero"
  | "for-x-condition"
  | "foreach-visit-order"
  | "forever-clock"
  | "forever-zero-delay";

export interface LoopPreset {
  id: LoopPresetId;
  program: LoopProgramId;
  /** Picker label. Never names the answer. */
  label: string;
  inputs: Partial<LoopInputs>;
}

export const LOOP_PRESETS: readonly LoopPreset[] = [
  { id: "for-continue-break", program: "for-jumps", label: "for with continue and break", inputs: { bound: 5 } },
  { id: "repeat-x", program: "repeat-count", label: "repeat (n): n never assigned", inputs: { countType: "logic4", countBits: "xxxx" } },
  { id: "repeat-negative-int", program: "repeat-count", label: "repeat (n): int n = -1", inputs: { countType: "int", countInt: -1 } },
  { id: "repeat-1101", program: "repeat-count", label: "repeat (n): n = 4'b1101", inputs: { countType: "logic4", countBits: "1101" } },
  { id: "repeat-change-n", program: "repeat-change", label: "repeat (n): the body changes n", inputs: { countInt: 3 } },
  { id: "while-zero", program: "while", label: "while (c) with c = 0", inputs: { cond: "0" } },
  { id: "do-while-zero", program: "do-while", label: "do … while (c) with c = 0", inputs: { cond: "0" } },
  { id: "for-x-condition", program: "for-x", label: "for with i < n: n never assigned", inputs: { countType: "logic4", countBits: "xxxx" } },
  { id: "foreach-visit-order", program: "foreach", label: "foreach (prod[k, m]) with continue and break", inputs: {} },
  { id: "forever-clock", program: "forever-clock", label: "forever #5 clk = ~clk", inputs: {} },
  { id: "forever-zero-delay", program: "forever-toggle", label: "forever x = ~x", inputs: {} },
];

export const presetById = (id: LoopPresetId): LoopPreset => LOOP_PRESETS.find((p) => p.id === id) ?? LOOP_PRESETS[0];

export const presetInputs = (preset: LoopPreset): LoopInputs => ({ ...DEFAULT_INPUTS, ...preset.inputs });

/* ------------------------------------------------------------------ */
/* Tracing                                                             */
/* ------------------------------------------------------------------ */

/** A rule a learner might wrongly apply. The model can run with one flipped to build the wrong answers. */
export type Misconception =
  | "continue-skips-step"
  | "break-like-continue"
  | "test-after-body"
  | "inclusive-bound"
  | "x-is-true"
  | "signedness-flipped"
  | "count-reevaluated"
  | "count-error"
  | "while-runs-once"
  | "do-tests-first"
  | "condition-read-once"
  | "leftmost-fastest"
  | "break-inner-only"
  | "delay-ignored"
  | "forever-runs-once"
  | "time-advances-each-pass";

export interface LoopVar {
  name: string;
  value: string;
  /** "logic1" values use the four-state chip; the others are plain values. */
  kind: "int" | "logic1" | "logic4";
  changed: boolean;
}

export interface LoopStep {
  index: number;
  box: FlowBoxId;
  /** Index into the program's code lines. */
  line: number;
  what: string;
  clause: string;
  jump?: "continue" | "break";
  /** Passes started so far (entries into the body). */
  passes: number;
  time: number;
  /** Statements and loop tests run at the current time with nothing waiting. */
  statementsAtThisTime: number;
  vars: LoopVar[];
  console: string[];
}

export type LoopOutcome =
  | { kind: "exited"; via: "test" | "break" | "once" }
  | { kind: "zero-delay"; statements: number; time: number }
  | { kind: "trace-stopped"; time: number; period: number }
  | { kind: "error" };

export interface LoopRun {
  program: LoopProgram;
  steps: LoopStep[];
  passes: number;
  output: string[];
  outcome: LoopOutcome;
  /** Why the loop ended (or does not), with its clause. */
  verdict: string;
}

class BudgetSpent extends Error {}

class Tracer {
  steps: LoopStep[] = [];
  output: string[] = [];
  passes = 0;
  time = 0;
  atTime = 0;
  private vars = new Map<string, { kind: LoopVar["kind"]; value: string }>();

  constructor(private readonly budget: number) {}

  set(name: string, value: string, kind: LoopVar["kind"] = "int") {
    this.vars.set(name, { kind, value });
  }

  get(name: string) {
    return this.vars.get(name)?.value ?? "";
  }

  print(line: string) {
    this.output.push(line);
  }

  advance(dt: number) {
    this.time += dt;
    this.atTime = 0;
  }

  /**
   * A statement or loop test. When the budget is already spent the statement
   * does not run: nothing is counted, and a pass opened for it is taken back,
   * so the counters show only what went through.
   */
  step(s: { box: FlowBoxId; line: number; what: string; clause: string; jump?: "continue" | "break" }) {
    if (this.atTime >= this.budget) {
      this.passes = this.steps[this.steps.length - 1]?.passes ?? 0;
      throw new BudgetSpent();
    }
    this.atTime += 1;
    this.snapshot(s, this.atTime);
  }

  /** A step that records a verdict and does not count as a statement. */
  note(s: { box: FlowBoxId; line: number; what: string; clause: string }) {
    this.snapshot(s, this.atTime);
  }

  private snapshot(s: { box: FlowBoxId; line: number; what: string; clause: string; jump?: "continue" | "break" }, at: number) {
    const prev = this.steps[this.steps.length - 1];
    const vars: LoopVar[] = [...this.vars.entries()].map(([name, v]) => {
      const before = prev?.vars.find((p) => p.name === name);
      return { name, value: v.value, kind: v.kind, changed: before !== undefined && before.value !== v.value };
    });
    this.steps.push({
      index: this.steps.length,
      ...s,
      passes: this.passes,
      time: this.time,
      statementsAtThisTime: at,
      vars,
      console: [...this.output],
    });
  }
}

/** What a simulator may do with a zero-delay infinite loop: the tool's choice, worded once for every place that says it. */
export const TOOL_CHOICE = "it may hang, or stop the run with its own iteration limit";

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** §11.4.4: how i < n is compared, for the for-x trace. i is an int, so it is signed. */
const comparisonNote = (n: CountValue) =>
  !n.signed
    ? " (an unsigned comparison, because n is unsigned)"
    : n.type === "int"
      ? " (a signed comparison, because i and n are both signed)"
      : " (a signed comparison, because i and n are both signed; n is sign-extended to 32 bits)";

const passWord = (n: number) => `${n} pass${n === 1 ? "" : "es"}`;
const quote = (s: string) => `“${s}”`;

const notBit = (b: Bit4): Bit4 => (b === "0" ? "1" : b === "1" ? "0" : "x");

/** The text %b prints for a 1-bit value. */
const bitText = (b: Bit4) => b;

export interface RunOptions {
  /**
   * A wrong rule to run with. Such a run is used only for its answer label
   * (summarizeRun): its step and verdict texts still describe the correct
   * rules and are never shown.
   */
  misconception?: Misconception;
  budget?: number;
}

export function runLoop(programId: LoopProgramId, inputs: LoopInputs, options: RunOptions = {}): LoopRun {
  const program = buildProgram(programId, inputs);
  const m = options.misconception;
  const t = new Tracer(options.budget ?? ZERO_DELAY_BUDGET);
  let outcome: LoopOutcome = { kind: "exited", via: "test" };
  let verdict = "";
  const lastLine = program.code.length - 1;

  try {
    switch (programId) {
      case "for-jumps": {
        const bound = clampInt(inputs.bound, BOUND_MIN, BOUND_MAX);
        let i = 0;
        t.set("i", "0");
        t.step({ box: "init", line: 0, what: "int i = 0 runs once, before the first test. i is automatic and local to the loop.", clause: "§12.7.1" });
        let first = true;
        for (;;) {
          if (!(m === "test-after-body" && first)) {
            const pass = m === "inclusive-bound" ? i <= bound : i < bound;
            const bit: Bit4 = pass ? "1" : "0";
            t.step({
              box: "test",
              line: 0,
              what: `Test: i < ${bound} is ${i} < ${bound}, which is ${literal1(bit)}, so ${pass ? "the body runs" : "the loop ends"}.`,
              clause: "§12.7.1",
            });
            if (!pass) {
              verdict = `The test i < ${bound} was false with i = ${i}, so the loop ended (§12.7.1).`;
              break;
            }
          }
          first = false;
          t.passes += 1;
          if (i === 1) {
            t.step({ box: "body", line: 1, what: `Pass ${t.passes}: i == 1 is true, so continue runs.`, clause: "§12.8", jump: "continue" });
            if (m !== "continue-skips-step") {
              i += 1;
              t.set("i", String(i));
              t.step({ box: "step", line: 0, what: `continue jumped to the end of the pass, so the step still runs: i++ makes i = ${i}.`, clause: "§12.8, §12.7.1" });
            }
            continue;
          }
          t.step({ box: "body", line: 1, what: `Pass ${t.passes}: i == 1 is false.`, clause: "§12.4" });
          if (i === 3) {
            t.step({ box: "body", line: 2, what: `i == 3 is true, so break runs.`, clause: "§12.8", jump: "break" });
            if (m !== "break-like-continue") {
              outcome = { kind: "exited", via: "break" };
              verdict = `break left the loop at once, so i++ did not run and i is still ${i} (§12.8).`;
              break;
            }
          } else {
            t.step({ box: "body", line: 2, what: `i == 3 is false.`, clause: "§12.4" });
            t.print(`i = ${i}`);
            t.step({ box: "body", line: 3, what: `$display prints ${quote(`i = ${i}`)}.`, clause: "§12.7.1" });
          }
          i += 1;
          t.set("i", String(i));
          t.step({ box: "step", line: 0, what: `End of the pass: the step i++ makes i = ${i}, then the test runs again.`, clause: "§12.7.1" });
        }
        t.step({ box: "exit", line: lastLine, what: `The loop has ended. ${verdict}`, clause: outcome.kind === "exited" && outcome.via === "break" ? "§12.8" : "§12.7.1" });
        break;
      }

      case "repeat-count":
      case "repeat-change": {
        const n = programId === "repeat-change" ? countValue({ ...inputs, countType: "int" }) : countValue(inputs);
        const flipped = m === "signedness-flipped" && n.type !== "int" ? { ...n, signed: !n.signed } : n;
        const { count: baseCount, reason } = repeatCount(flipped);
        const count = m === "inclusive-bound" ? baseCount + 1 : baseCount;
        const isChange = programId === "repeat-change";
        let nValue = countNumber(n);
        if (isChange) t.set("n", String(nValue));
        else t.set("n", n.type === "int" ? String(nValue) : `4'b${n.bits.join("")}`, n.type === "int" ? "int" : "logic4");
        if (!isChange) t.set("count", "0");
        const loopLine = isChange ? 1 : 2;
        const why =
          reason === "counted"
            ? `${describeCount(flipped)}, so the loop makes ${passWord(count)}.`
            : `${describeCount(flipped)}. ${capitalize(article(reason))} ${reason} count is treated as zero, so no pass runs.`;
        t.step({ box: "init", line: loopLine, what: `repeat evaluates n once, before the loop starts: ${why}`, clause: "§12.7.2" });
        let done = 0;
        for (;;) {
          const limit = m === "count-reevaluated" && nValue !== null ? Math.max(0, nValue) : count;
          const more = done < limit;
          t.step({
            box: "test",
            line: loopLine,
            what: more ? `${done} of ${passWord(limit)} done, so pass ${done + 1} runs.` : `${done} of ${passWord(limit)} done, so the loop ends.`,
            clause: "§12.7.2",
          });
          if (!more) break;
          t.passes += 1;
          done += 1;
          if (isChange) {
            t.print(`n = ${nValue}`);
            t.step({ box: "body", line: 2, what: `Pass ${t.passes}: $display prints ${quote(`n = ${nValue}`)}.`, clause: "§12.7.2" });
            nValue = (nValue ?? 0) + 1;
            t.set("n", String(nValue));
            t.step({ box: "body", line: 3, what: `n++ makes n = ${nValue}. The count was fixed before the loop, so this does not change it.`, clause: "§12.7.2" });
          } else {
            t.set("count", String(done));
            t.step({ box: "body", line: 2, what: `Pass ${t.passes}: count++ makes count = ${done}.`, clause: "§12.7.2" });
          }
        }
        if (isChange) {
          verdict =
            reason === "counted"
              ? `The count was evaluated once as ${count}; changing n inside the loop has no effect on it (§12.7.2).`
              : `n was ${countNumber(n)} when repeat evaluated it, and a negative count is treated as zero, so no pass ran (§12.7.2).`;
          t.step({ box: "exit", line: lastLine, what: `The loop has ended. ${verdict}`, clause: "§12.7.2" });
        } else {
          verdict =
            reason === "counted"
              ? `${describeCount(flipped)}, evaluated once, so the body made ${passWord(count)} (§12.7.2).`
              : `${describeCount(flipped)}. §12.7.2 treats ${article(reason)} ${reason} count as zero, so the body never ran; the standard does not make it an error.`;
          const msg = `count = ${t.get("count")}`;
          t.print(msg);
          t.step({ box: "exit", line: 3, what: `After the loop, $display prints ${quote(msg)}. ${verdict}`, clause: "§12.7.2" });
        }
        break;
      }

      case "while":
      case "do-while": {
        const isDo = programId === "do-while";
        let c: Bit4 = isDo && inputs.cond !== "1" ? "0" : inputs.cond;
        const initial = c;
        t.set("c", c, "logic1");
        const testAfter = isDo ? m !== "do-tests-first" : m === "while-runs-once";
        const testLine = isDo ? 4 : 1;
        const test = (): boolean => {
          const seen = m === "condition-read-once" ? initial : c;
          const truth = truthOf([seen]);
          const taken = truth === "true" || (m === "x-is-true" && truth === "unknown");
          const meaning = truth === "unknown" ? `${literal1(seen)}, which counts as false` : literal1(seen);
          t.step({
            box: "test",
            line: testLine,
            what: `Test${isDo ? ", after the pass" : ""}: c is ${meaning}, so ${taken ? "the body runs" : "the loop ends"}.`,
            clause: isDo ? "§12.7.5" : truth === "unknown" ? "§12.7.4, §12.4" : "§12.7.4",
          });
          return taken;
        };
        for (;;) {
          if (!testAfter && !test()) break;
          t.passes += 1;
          const msg = `pass, c = ${bitText(c)}`;
          t.print(msg);
          t.step({ box: "body", line: 2, what: `Pass ${t.passes}: $display prints ${quote(msg)}.`, clause: isDo ? "§12.7.5" : "§12.7.4" });
          c = "0";
          t.set("c", c, "logic1");
          t.step({ box: "body", line: 3, what: "c = 1'b0.", clause: isDo ? "§12.7.5" : "§12.7.4" });
          if (testAfter && !test()) break;
        }
        if (isDo) {
          verdict = `do … while tests its condition after the body, so the body made ${passWord(t.passes)} before the test ended the loop (§12.7.5).`;
        } else if (t.passes === 0) {
          verdict =
            truthOf([initial]) === "unknown"
              ? `c was ${literal1(initial)} at the first test. A while-loop runs only while its condition is true as defined in §12.4, where x and z count as false, so the body never ran (§12.7.4).`
              : `c was ${literal1(initial)} at the first test, so the body never ran: a while-loop tests before every pass and may run zero times (§12.7.4).`;
        } else {
          verdict = `c was ${literal1(initial)} at the first test, so the body ran; it set c to 1'b0, so the next test ended the loop (§12.7.4).`;
        }
        t.step({ box: "exit", line: lastLine, what: `The loop has ended. ${verdict}`, clause: isDo ? "§12.7.5" : "§12.7.4" });
        break;
      }

      case "for-x": {
        const n = countValue(inputs);
        const read = m === "signedness-flipped" && n.type !== "int" ? { ...n, signed: !n.signed } : n;
        let i = 0;
        t.set("n", n.type === "int" ? String(countNumber(n)) : `4'b${n.bits.join("")}`, n.type === "int" ? "int" : "logic4");
        t.set("count", "0");
        t.set("i", "0");
        t.step({ box: "init", line: 2, what: "int i = 0 runs once, before the first test.", clause: "§12.7.1" });
        let lastTest: Bit4 = "0";
        let firstPass = true;
        for (;;) {
          if (m === "test-after-body" && firstPass) {
            firstPass = false;
            t.passes += 1;
            t.set("count", String(t.passes));
            t.step({ box: "body", line: 2, what: `Pass ${t.passes}: count++ makes count = ${t.passes}.`, clause: "§12.7.1" });
            i += 1;
            t.set("i", String(i));
            t.step({ box: "step", line: 2, what: `The step i++ makes i = ${i}.`, clause: "§12.7.1" });
            continue;
          }
          const strict = lessThan({ bits: fromNumber(i, 32), signed: true }, read);
          // The inclusive misconception reads the test as i <= n.
          const bit: Bit4 = m === "inclusive-bound" && strict === "0" && countNumber(read) === i ? "1" : strict;
          lastTest = bit;
          const taken = bit === "1" || (m === "x-is-true" && bit === "x");
          const nText = n.type === "int" ? String(countNumber(n)) : `4'b${n.bits.join("")}`;
          const how =
            bit === "x"
              ? `i < n is 1'bx, because n (${nText}) has an x or z bit (§11.4.4). The for-loop treats an unknown test as zero`
              : `i < n is ${i} < ${countNumber(read)}, which is ${literal1(bit)}${comparisonNote(read)}`;
          t.step({
            box: "test",
            line: 2,
            what: `Test: ${how}, so ${taken ? "the body runs" : "the loop ends"}.`,
            clause: "§11.4.4, §12.7.1",
          });
          if (!taken) break;
          t.passes += 1;
          t.set("count", String(t.passes));
          t.step({ box: "body", line: 2, what: `Pass ${t.passes}: count++ makes count = ${t.passes}.`, clause: "§12.7.1" });
          i += 1;
          t.set("i", String(i));
          t.step({ box: "step", line: 2, what: `The step i++ makes i = ${i}, then the test runs again.`, clause: "§12.7.1" });
        }
        verdict =
          lastTest === "x"
            ? `n has an x or z bit, so i < n is 1'bx (§11.4.4), and the for-loop treats an unknown test as zero: it exits ${t.passes === 0 ? "before the first pass" : `after ${passWord(t.passes)}`} (§12.7.1).`
            : `i < n became false with i = ${i}, so the loop ended after ${passWord(t.passes)} (§12.7.1, §11.4.4).`;
        const msg = `count = ${t.passes}`;
        t.print(msg);
        t.step({ box: "exit", line: 3, what: `After the loop, $display prints ${quote(msg)}. ${verdict}`, clause: "§12.7.1" });
        break;
      }

      case "foreach": {
        const order = foreachOrder(FOREACH_RANGES, m === "leftmost-fastest");
        t.set("k", String(order[0][0]));
        t.set("m", String(order[0][1]));
        t.step({ box: "init", line: 1, what: `The first index pair is k = ${order[0][0]}, m = ${order[0][1]}: each index starts at its left bound. k is the outer loop, m the inner one.`, clause: "§12.7.3" });
        let idx = 0;
        let broke = false;
        let skipK: number | null = null;
        for (;;) {
          while (idx < order.length && skipK !== null && order[idx][0] === skipK) idx += 1;
          skipK = null;
          const more = idx < order.length;
          t.step({ box: "test", line: 1, what: more ? `Index pair ${idx + 1} of ${order.length} is next, so the body runs.` : "No index pair is left, so the loop ends.", clause: "§12.7.3" });
          if (!more) break;
          const [k, mm] = order[idx];
          t.set("k", String(k));
          t.set("m", String(mm));
          t.passes += 1;
          if (mm === 1) {
            t.step({ box: "body", line: 2, what: `Pass ${t.passes} (k = ${k}, m = ${mm}): m == 1, so continue moves to the next index pair.`, clause: "§12.8", jump: "continue" });
          } else {
            t.step({ box: "body", line: 2, what: `Pass ${t.passes} (k = ${k}, m = ${mm}): m == 1 is false.`, clause: "§12.4" });
            if (k === 1 && mm === 3) {
              t.step({ box: "body", line: 3, what: "k == 1 && m == 3 is true, so break runs.", clause: "§12.8", jump: "break" });
              if (m === "break-inner-only") {
                skipK = k;
              } else {
                broke = true;
                break;
              }
            } else {
              t.step({ box: "body", line: 3, what: "k == 1 && m == 3 is false.", clause: "§12.4" });
              const msg = `k=${k} m=${mm}`;
              t.print(msg);
              t.step({ box: "body", line: 4, what: `$display prints ${quote(msg)}.`, clause: "§12.7.3" });
            }
          }
          idx += 1;
          if (skipK === null && idx < order.length) {
            t.step({ box: "step", line: 1, what: `Next pair: k = ${order[idx][0]}, m = ${order[idx][1]}. The rightmost index, m, changes fastest.`, clause: "§12.7.3" });
          }
        }
        outcome = { kind: "exited", via: broke ? "break" : "test" };
        verdict = broke
          ? `break left the whole foreach, not just the m dimension, so k never reached 2 (§12.8). The order was k outer, m inner: the rightmost index changes fastest (§12.7.3).`
          : "Every index pair was visited, with the rightmost index changing fastest (§12.7.3).";
        t.step({ box: "exit", line: lastLine, what: `The loop has ended. ${verdict}`, clause: broke ? "§12.8" : "§12.7.3" });
        break;
      }

      case "forever-clock":
      case "forever-toggle": {
        const isClock = programId === "forever-clock";
        const name = isClock ? "clk" : "x";
        let v: Bit4 = "0";
        t.set(name, v, "logic1");
        const delay = isClock ? (m === "delay-ignored" ? 0 : CLOCK_DELAY) : m === "time-advances-each-pass" ? 1 : 0;
        if (isClock && delay > 0) {
          t.note({ box: "wait", line: 1, what: `At t = 0, ${name} is ${literal1(v)}. The first #${delay} starts waiting, so nothing toggles before t = ${delay}.`, clause: "§12.7.6, §9.4.1" });
        }
        for (;;) {
          if (t.passes >= FOREVER_TRACE_PASSES && delay > 0) {
            outcome = { kind: "trace-stopped", time: t.time, period: delay };
            verdict = `The trace stops here at t = ${t.time}, but the loop does not: forever has no test, and each pass waits ${delay} time unit${delay === 1 ? "" : "s"}, so time keeps advancing (§12.7.6).`;
            t.note({ box: isClock ? "wait" : "body", line: 1, what: verdict, clause: "§12.7.6" });
            break;
          }
          t.passes += 1;
          if (isClock && delay > 0) {
            t.advance(delay);
            // #5 is a delay control on the statement, not a statement of its own (§9.4.1), so it is not counted.
            t.note({ box: "wait", line: 1, what: `Pass ${t.passes}: #${delay} waits, so time advances to t = ${t.time}.`, clause: "§12.7.6, §9.4.1" });
          } else if (delay > 0) {
            t.advance(delay);
          }
          v = notBit(v);
          t.set(name, v, "logic1");
          t.step({
            box: "body",
            line: 1,
            what: `${isClock && delay > 0 ? "" : `Pass ${t.passes}: `}${name} = ~${name} makes ${name} = ${literal1(v)} at t = ${t.time}.`,
            clause: "§12.7.6",
          });
          if (m === "forever-runs-once") {
            outcome = { kind: "exited", via: "once" };
            verdict = "Stopped after one pass.";
            break;
          }
        }
        break;
      }
    }
  } catch (err) {
    if (!(err instanceof BudgetSpent)) throw err;
    const statements = t.atTime;
    outcome = { kind: "zero-delay", statements, time: t.time };
    verdict = `Time never advances: ${statements} ${program.testPlacement === "none" ? "statements" : "statements and loop tests"} ran at t = ${t.time} and none of them waited. With no timing control the loop is a zero-delay infinite loop (§12.7.6; §9.2.2.1 says the same of an always procedure).`;
    const lastBox = t.steps[t.steps.length - 1]?.box ?? "body";
    t.note({ box: lastBox, line: t.steps[t.steps.length - 1]?.line ?? 0, what: `${verdict} The model stops after ${ZERO_DELAY_BUDGET} statements. What a real simulator does here is up to the tool: ${TOOL_CHOICE}.`, clause: "§12.7.6, §9.2.2.1" });
  }

  return { program, steps: t.steps, passes: t.passes, output: t.output, outcome, verdict };
}

/* ------------------------------------------------------------------ */
/* Prediction                                                          */
/* ------------------------------------------------------------------ */

const outputText = (lines: readonly string[]) => {
  if (lines.length === 0) return "prints nothing";
  const shown = lines.slice(0, 3).map(quote).join(", ");
  return lines.length > 3 ? `prints ${shown} and ${lines.length - 3} more line${lines.length - 3 === 1 ? "" : "s"}` : `prints ${shown}`;
};

/** One-line answer for a run: what the learner predicts. */
export function summarizeRun(run: Pick<LoopRun, "passes" | "output" | "outcome">): string {
  switch (run.outcome.kind) {
    case "exited":
      return `${passWord(run.passes)}, then the loop ends; ${outputText(run.output)}`;
    case "zero-delay":
      return `Never ends, and time stays at t = ${run.outcome.time}`;
    case "trace-stopped":
      return `Never ends on its own; time advances ${run.outcome.period} unit${run.outcome.period === 1 ? "" : "s"} each pass`;
    case "error":
      return "A run-time error stops the simulation at the loop";
  }
}

/** The misconceptions tried for each program, in the order they are offered. */
export const PROGRAM_MISCONCEPTIONS: Record<LoopProgramId, Misconception[]> = {
  "for-jumps": ["continue-skips-step", "break-like-continue", "test-after-body", "inclusive-bound"],
  "repeat-count": ["signedness-flipped", "count-error", "inclusive-bound"],
  "repeat-change": ["count-reevaluated", "inclusive-bound"],
  while: ["x-is-true", "while-runs-once", "condition-read-once"],
  "do-while": ["do-tests-first", "condition-read-once"],
  "for-x": ["x-is-true", "signedness-flipped", "inclusive-bound", "test-after-body"],
  foreach: ["leftmost-fastest", "break-inner-only"],
  "forever-clock": ["delay-ignored", "forever-runs-once"],
  "forever-toggle": ["time-advances-each-pass", "forever-runs-once"],
};

/** Why each wrong rule is wrong, with the clause that says so. */
export const MISCONCEPTION_FEEDBACK: Record<Misconception, string> = {
  "continue-skips-step": "That is continue skipping the step i++. continue jumps to the end of the loop and still runs the loop control, so i++ runs (§12.8).",
  "break-like-continue": "That is break acting like continue. break leaves the loop at once, so no later pass runs and the step is skipped (§12.8).",
  "inclusive-bound": "That counts one pass too many, as if the loop ran from 0 to n inclusive. The loop runs exactly while its test is true, or exactly its count (§12.7.1, §12.7.2).",
  "test-after-body": "That runs the body once before the first test, like do … while. A for-loop tests before every pass, including the first (§12.7.1).",
  "x-is-true": "That takes an x or z condition as true. A condition counts as true only when it is known nonzero; x and z count as false (§12.4, §12.7.1).",
  "signedness-flipped": "That reads n with the wrong signedness. logic [3:0] is unsigned, so 4'b1101 is 13; only logic signed [3:0] reads it as -3 (§6.11, §11.4.4, §12.7.2).",
  "count-reevaluated": "That re-reads n before every pass. repeat evaluates its count once, before the loop starts, and changing n inside the loop has no effect (§12.7.2).",
  "count-error": "§12.7.2 does not make this an error: a negative, unknown or high-impedance count is treated as zero, and the loop simply runs no pass. A tool may still warn, but that is up to the tool.",
  "while-runs-once": "That runs the body once before testing, like do … while. A while-loop tests first, so it may run zero times (§12.7.4).",
  "do-tests-first": "That tests before the first pass, like while. do … while evaluates its condition after the statement, so the body runs at least once (§12.7.5).",
  "condition-read-once": "That reads the condition only once. The condition is tested again on every pass, so the body's c = 1'b0 ends the loop (§12.7.4, §12.7.5).",
  "leftmost-fastest": "That changes k, the leftmost index, fastest. The leftmost index is the outer loop, so the rightmost index, m, changes fastest (§12.7.3).",
  "break-inner-only": "That ends only the m dimension and lets k move on. In a multi-dimensional foreach, break leaves the entire loop (§12.8).",
  "delay-ignored": "That ignores #5. The timing control suspends the loop for 5 time units on every pass, so time advances and the clock toggles every 5 units (§12.7.6).",
  "forever-runs-once": "forever has no test: it repeats its statement until something such as break, disable or the end of the simulation stops it (§12.7.6, §12.8).",
  "time-advances-each-pass": "A pass on its own takes no simulation time. Only a timing control such as #5 or @(posedge clk) lets time advance, and this loop has none (§12.7.6, §9.2.2.1).",
};

/**
 * The feedback for a wrong rule on these inputs. Most texts are fixed; the
 * signedness one is built from the actual bits of n, and the x-is-true one
 * names the clause of the loop it is about.
 */
export function misconceptionFeedback(m: Misconception, programId: LoopProgramId, inputs: LoopInputs): string {
  if (m === "x-is-true") {
    const loopClause = programId === "while" ? "§12.7.4" : "§12.7.1";
    return `That takes an x or z condition as true. A condition counts as true only when it is known nonzero; x and z count as false (§12.4, ${loopClause}).`;
  }
  if (m === "signedness-flipped" && inputs.countType !== "int") {
    const n = countValue(inputs);
    const u = toUnsigned(n.bits);
    const sv = toSigned(n.bits);
    if (u !== null && sv !== null) {
      const lit = `4'b${n.bits.join("")}`;
      if (programId === "for-x") {
        return n.signed
          ? `That compares i < n as unsigned. i is an int and n is logic signed [3:0], so both are signed (§6.11.3) and the comparison is signed: n is sign-extended, so ${lit} is ${sv} (§11.4.4).`
          : `That compares i < n as signed. n is logic [3:0], which is unsigned (§6.11.3), and when either operand is unsigned the comparison is unsigned, so ${lit} is ${u} (§11.4.4).`;
      }
      return n.signed
        ? `That reads n as unsigned. The signed keyword makes logic signed [3:0] signed, so ${lit} is ${sv}, not ${u} (§6.11.3, §12.7.2).`
        : `That reads n as signed. logic [3:0] is unsigned by default, so ${lit} is ${u}; only logic signed [3:0] would read it as ${sv} (§6.11.3, §12.7.2).`;
    }
  }
  return MISCONCEPTION_FEEDBACK[m];
}

export interface LoopOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Which misconceptions apply to these inputs (a wrong rule that cannot change the answer is not offered). */
function applies(m: Misconception, inputs: LoopInputs): boolean {
  if (m === "signedness-flipped") return inputs.countType !== "int";
  if (m === "count-error") return repeatCount(countValue(inputs)).reason !== "counted";
  return true;
}

/** Orders options by a deterministic shuffle seeded from their labels and `seed`, so the answer has no fixed slot. */
export function arrangeOptions<T extends { label: string; correct: boolean }>(options: readonly T[], seed = ""): T[] {
  const out = [...options];
  const key = `${out.map((o) => o.label).join("|")}#${seed}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The prediction options: the model's answer plus up to three answers from
 * runs with one wrong rule each, every label computed by the model. Wrong
 * rules that give the same answer as the right one are dropped.
 */
export function predictionOptions(programId: LoopProgramId, inputs: LoopInputs, run = runLoop(programId, inputs)): LoopOption[] {
  const correctLabel = summarizeRun(run);
  const options: LoopOption[] = [{ id: "model", label: correctLabel, correct: true, feedback: run.verdict }];
  for (const m of PROGRAM_MISCONCEPTIONS[programId]) {
    if (options.length >= 4) break;
    if (!applies(m, inputs)) continue;
    const label =
      m === "count-error" ? summarizeRun({ passes: 0, output: [], outcome: { kind: "error" } }) : summarizeRun(runLoop(programId, inputs, { misconception: m }));
    if (options.some((o) => o.label === label)) continue;
    options.push({ id: m, label, correct: false, feedback: misconceptionFeedback(m, programId, inputs) });
  }
  return arrangeOptions(options, `${programId}|${inputKey(programId, inputs)}`);
}

/** The inputs a program reads, as a stable key (used to reset a prediction when they change). */
export function inputKey(programId: LoopProgramId, inputs: LoopInputs): string {
  const program = buildProgram(programId, inputs);
  return program.inputs
    .map((f) => {
      if (f === "count") return `${inputs.countType}:${inputs.countType === "int" ? clampInt(inputs.countInt) : inputs.countBits.toLowerCase()}`;
      if (f === "countInt") return `n:${clampInt(inputs.countInt)}`;
      if (f === "cond") return `c:${programId === "do-while" && inputs.cond !== "1" ? "0" : inputs.cond}`;
      return `b:${clampInt(inputs.bound, BOUND_MIN, BOUND_MAX)}`;
    })
    .join(",");
}

/** What counts as a pass, stated with the question and in the assumptions. */
export const PASS_DEFINITION = "A pass that ends early with continue or break still counts.";

/** The question asked before the trace is shown. */
export const PREDICTION_QUESTION = `How many passes does the body make, and what does the console print? ${PASS_DEFINITION}`;

/** Caption for where the test sits, shown with the flowchart. */
export const TEST_PLACEMENT_TEXT: Record<TestPlacement, string> = {
  before: "Test before the body: the loop may run zero times.",
  after: "Test after the body: the loop runs at least once (§12.7.5).",
  none: "No test: forever ends only through break, disable or the end of the simulation (§12.7.6, §12.8).",
};

/** The clause that puts the test before the body, for each loop form that has one there. */
const TEST_BEFORE_CLAUSE: Partial<Record<LoopForm, string>> = {
  for: "§12.7.1",
  repeat: "§12.7.2",
  while: "§12.7.4",
  foreach: "§12.7.3",
};

/** The caption for where the program's test sits, with the clause for its loop form. */
export function testPlacementText(program: Pick<LoopProgram, "form" | "testPlacement">): string {
  const text = TEST_PLACEMENT_TEXT[program.testPlacement];
  const clause = program.testPlacement === "before" ? TEST_BEFORE_CLAUSE[program.form] : undefined;
  return clause ? text.replace(/\.$/, ` (${clause}).`) : text;
}

/** Notes shown beside the inputs, so every limit of the lab is visible. */
export const INPUT_NOTES = {
  int: `int is a 2-state type, so it cannot hold x or z (§6.11). The lab limits int n to ${INT_INPUT_MIN} to ${INT_INPUT_MAX} so the trace stays short.`,
  doWhileCond:
    "Only 0 and 1 here. do … while differs from while in testing its condition at the end of the loop (§12.7.5), so an x or z condition would count as false here too (§12.4); the while loop shows that case.",
} as const;

export const LOOP_ASSUMPTIONS: string[] = [
  `The model calls a loop zero-delay after ${ZERO_DELAY_BUDGET} statements and loop tests at one simulation time with nothing waiting. That is the model's limit, not the standard's: a real loop may run many more statements at one time and still end. Every loop that ends in this lab ends well inside the limit.`,
  `What a simulator does with a zero-delay infinite loop is up to the tool: ${TOOL_CHOICE} (§12.7.6 says only that such a loop could hang the scheduler).`,
  "For repeat, a count with any x bit is read as unknown and one with z bits but no x bit as high impedance; §12.7.2 treats both as zero.",
  `A pass is one entry into the loop body. ${PASS_DEFINITION}`,
  "The flowchart draws foreach as nested loops with a check for the next index pair before each pass. That check is how the model draws it: §12.7.3 gives no explicit test and describes foreach as similar to a repeat-loop that uses the array bounds as its count.",
  `The forever #${CLOCK_DELAY} trace stops after ${FOREVER_TRACE_PASSES} passes; the loop itself never ends.`,
];
