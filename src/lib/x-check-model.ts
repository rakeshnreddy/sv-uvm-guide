/**
 * Deterministic educational model of how an X result slips past a
 * self-check, and of the F2A "reset bug nobody saw" debug challenge.
 *
 * It is composed from sv-four-state-model (imported, never copied), so the
 * operators, the if rule, the 2-state conversion and the default values are
 * the same functions the F2A explorers use. Rules, from IEEE 1800-2023:
 * - §11.4.5: == and != return x when an operand bit is x or z and the known
 *   bits agree; === and !== compare x and z literally and return 0 or 1.
 * - §12.4: an if condition that is 0, x or z is false, so the else branch runs.
 * - §16.3: an immediate assert is interpreted like an if condition, so x, z or
 *   0 fails it. Its else clause is the fail statement; without one the tool
 *   calls $error by default (§20.10) unless $assertcontrol suppresses it (§20.11).
 * - §6.11.2: assigning a 4-state value to a 2-state type turns x and z into 0.
 * - Table 6-7: a 4-state variable with no initializer starts at 'x, a 2-state
 *   one at '0.
 * - §20.9: $isunknown(e) is 1 when any bit of e is x or z.
 * - §20.10: $error reports a run-time error and the run continues; only
 *   $fatal implies $finish. The message's prefix and layout are tool-specific.
 */

import {
  assignToIntegral,
  compare,
  defaultVariableValue,
  formatLiteral,
  fromNumber,
  hasUnknown,
  ifBranch,
  parseBits,
  toUnsigned,
  type Bit4,
  type EqualityOp,
  type EqualityResult,
} from "@/lib/sv-four-state-model";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** Width of the adder result `sum` (logic [8:0]) in F2E. */
export const SUM_WIDTH = 9;

/** Width of `int` (Table 6-8). */
export const INT_WIDTH = 32;

export type Counter = "pass" | "fail" | "neither";

export const COUNTER_TEXT: Record<Counter, string> = {
  pass: "pass_cnt++",
  fail: "fail_cnt++",
  neither: "neither counter moves",
};

/** 1-bit result as a sized literal, e.g. 1'bx. */
export const bitLiteral = (b: Bit4) => `1'b${b}`;

/** Sized binary literal with an underscore after the top bit for 9-bit values, as the lesson writes them: 9'b0_0000_101x. */
export function sumLiteral(bits: readonly Bit4[]): string {
  if (bits.length !== SUM_WIDTH) return formatLiteral(bits);
  const s = bits.join("");
  return `9'b${s[0]}_${s.slice(1, 5)}_${s.slice(5)}`;
}

/** Decimal literal when every bit is known (9'd10), else the binary literal; all-x is written 9'bx_xxxx_xxxx. */
export function valueText(bits: readonly Bit4[]): string {
  const u = toUnsigned(bits);
  if (u !== null) return `${bits.length}'d${u.toString()}`;
  return sumLiteral(bits);
}

/* ------------------------------------------------------------------ */
/* Checker mode                                                        */
/* ------------------------------------------------------------------ */

export type CheckerForm = "neq" | "case-neq" | "assert-eq";

export const CHECKER_FORMS: readonly CheckerForm[] = ["neq", "case-neq", "assert-eq"];

/** Short labels for the in-line operator control. */
export const CHECKER_FORM_LABELS: Record<CheckerForm, string> = {
  neq: "if (… != …)",
  "case-neq": "if (… !== …)",
  "assert-eq": "assert (… == …)",
};

export interface CheckerConfig {
  /** sum from the DUT, MSB first, 9 bits. */
  sum: Bit4[];
  /** e.sum, the expectation, MSB first, 9 bits. */
  exp: Bit4[];
  form: CheckerForm;
  /** Wraps the compare in `if ($isunknown(out_valid)) … else if (out_valid)`. Without it, `if (out_valid)`. */
  guard: boolean;
  outValid: Bit4;
  /** Copies sum into `int s` and compares s instead of sum. */
  copyToInt: boolean;
}

export interface CheckerPreset {
  id: string;
  label: string;
  config: CheckerConfig;
}

const ten = () => fromNumber(10, SUM_WIDTH);

/** The defaults the lesson's checker uses: != with the $isunknown guard, out_valid = 1, no copy. */
const LESSON_CHECK = { form: "neq" as CheckerForm, guard: true, outValid: "1" as Bit4, copyToInt: false };

/**
 * One preset per row of the F2E table "sum from the DUT / Expected / sum != 10 …",
 * then the two other ways X hides (a control signal, a 2-state copy).
 */
export const CHECKER_PRESETS: readonly CheckerPreset[] = [
  { id: "d10", label: "9'd10", config: { ...LESSON_CHECK, sum: fromNumber(10, SUM_WIDTH), exp: ten() } },
  { id: "d11", label: "9'd11", config: { ...LESSON_CHECK, sum: fromNumber(11, SUM_WIDTH), exp: ten() } },
  { id: "all-x", label: "all bits x", config: { ...LESSON_CHECK, sum: Array<Bit4>(SUM_WIDTH).fill("x"), exp: ten() } },
  { id: "x-low", label: "9'b0_0000_101x", config: { ...LESSON_CHECK, sum: parseBits("0_0000_101x"), exp: ten() } },
  { id: "x-high", label: "9'b1_0000_101x", config: { ...LESSON_CHECK, sum: parseBits("1_0000_101x"), exp: ten() } },
  {
    id: "valid-x",
    label: "out_valid = x, no guard",
    config: { ...LESSON_CHECK, guard: false, outValid: "x", sum: parseBits("0_0000_101x"), exp: ten() },
  },
  {
    id: "int-copy",
    label: "int copy, !==",
    config: { ...LESSON_CHECK, form: "case-neq", copyToInt: true, sum: parseBits("0_0000_101x"), exp: ten() },
  },
];

export const DEFAULT_CHECKER_PRESET = "x-low";

export function findCheckerPreset(id: string | undefined): CheckerPreset {
  return CHECKER_PRESETS.find((p) => p.id === id) ?? (CHECKER_PRESETS.find((p) => p.id === DEFAULT_CHECKER_PRESET) as CheckerPreset);
}

/** The id of the preset this configuration equals, or null once the learner has edited it. */
export function matchingPreset(config: CheckerConfig): string | null {
  const same = (a: CheckerConfig, b: CheckerConfig) =>
    a.form === b.form &&
    a.guard === b.guard &&
    a.outValid === b.outValid &&
    a.copyToInt === b.copyToInt &&
    a.sum.join("") === b.sum.join("") &&
    a.exp.join("") === b.exp.join("");
  return CHECKER_PRESETS.find((p) => same(p.config, config))?.id ?? null;
}

/** The value name the compare reads: sum, or the int copy s. */
const compared = (config: CheckerConfig) => (config.copyToInt ? "s" : "sum");

/** The comparison as written in the code line. */
export function compareExpression(config: CheckerConfig): string {
  const v = compared(config);
  if (config.form === "assert-eq") return `${v} == e.sum`;
  return `${v} ${config.form === "neq" ? "!=" : "!=="} e.sum`;
}

/** The code line that holds the check (the in-line control sits on it). */
export function checkLine(config: CheckerConfig): string {
  const expr = compareExpression(config);
  if (config.form === "assert-eq") return `assert (${expr}) pass_cnt++; else fail_cnt++;`;
  return `if (${expr}) fail_cnt++; else pass_cnt++;`;
}

export interface CheckerLine {
  key: string;
  text: string;
}

/** The checker as code, generated from the configuration. */
export function checkerSource(config: CheckerConfig): CheckerLine[] {
  const lines: CheckerLine[] = [];
  if (config.copyToInt) lines.push({ key: "decl-s", text: "int s;                        // 2-state copy of sum" });
  lines.push({ key: "always", text: "always @(posedge clk) begin" });
  if (config.guard) {
    lines.push({ key: "guard", text: "  if ($isunknown(out_valid)) begin" });
    lines.push({ key: "guard-fail", text: '    fail_cnt++; $error("out_valid is %b", out_valid);' });
    lines.push({ key: "valid", text: "  end else if (out_valid) begin" });
  } else {
    lines.push({ key: "valid", text: "  if (out_valid) begin" });
  }
  if (config.copyToInt) lines.push({ key: "copy", text: "    s = sum;" });
  lines.push({ key: "check", text: `    ${checkLine(config)}` });
  lines.push({ key: "end-valid", text: "  end" });
  lines.push({ key: "end", text: "end" });
  return lines;
}

export type StepKind = "guard" | "valid" | "copy" | "operator" | "branch" | "counter";

export interface CheckStep {
  kind: StepKind;
  /** Key of the code line this step executes. */
  lineKey: string;
  /** What is evaluated, e.g. "sum != e.sum". */
  label: string;
  /** The value the step produces, e.g. "1'bx", "else", "pass_cnt++". */
  value: string;
  clause: string;
  text: string;
}

export type CheckVerdict = "honest-pass" | "honest-fail" | "masked-fail" | "false-pass" | "silent-skip" | "no-result" | "bad-expectation";

export interface CheckerResult {
  steps: CheckStep[];
  counter: Counter;
  /** $error is called on this path. */
  errorCalled: boolean;
  /** Result of the compare operator, or null when the compare never ran. */
  operatorResult: Bit4 | null;
  verdict: CheckVerdict;
  /** One sentence on whether the count was right, generated from verdict. */
  verdictText: string;
}

const isEqualKnown = (a: readonly Bit4[], b: readonly Bit4[]) => !hasUnknown(a) && !hasUnknown(b) && toUnsigned(a) === toUnsigned(b);

function verdictOf(config: CheckerConfig, counter: Counter): CheckVerdict {
  if (counter === "neither") return config.outValid === "0" ? "no-result" : "silent-skip";
  if (hasUnknown(config.exp) && counter === "pass") return "bad-expectation";
  const correctPass = isEqualKnown(config.sum, config.exp) && config.outValid !== "x" && config.outValid !== "z";
  if (counter === "pass") return correctPass ? "honest-pass" : "false-pass";
  // Every failing path here is a real problem: the guard caught an unknown out_valid, or the compare saw a wrong or unknown sum.
  if (config.outValid !== "x" && config.outValid !== "z" && hasUnknown(config.exp)) return "bad-expectation";
  // The compare ran on a 2-state copy that erased x or z bits: the failure came from the zeroed value, not from the unknown.
  if (config.copyToInt && hasUnknown(config.sum) && config.outValid === "1") return "masked-fail";
  return "honest-fail";
}

/** Exported for the test: every verdict has a sentence. */
export const VERDICT_TEXT: Record<CheckVerdict, string> = {
  "honest-pass": "Honest: sum is known and equals e.sum, so a pass is the right count.",
  "honest-fail": "Honest: something here is wrong or unknown, and the check counted a failure.",
  "masked-fail":
    "Caught, but not because of the unknown: the int copy erased the x or z bits (§6.11.2) and the zeroed value differs from e.sum. Had e.sum equalled the zeroed value, this bench would have counted a false pass.",
  "false-pass": "False pass: sum is not a known match for e.sum, yet pass_cnt moved.",
  "silent-skip": "Silent skip: a result may have been present, but no counter moved and nothing was reported.",
  "no-result": "Correct: out_valid is 0, so there is no result to check.",
  "bad-expectation": "Bench bug: e.sum itself has an x or z bit. Guard the model with $isunknown(e.sum) and report a bench error instead of comparing.",
};

/**
 * Runs the checker once on one rising edge, following the code line by line.
 * Each step names its clause; the sentences are built from the values the
 * four-state model returns.
 */
export function evaluateChecker(config: CheckerConfig): CheckerResult {
  const steps: CheckStep[] = [];
  const finish = (counter: Counter, errorCalled: boolean, operatorResult: Bit4 | null): CheckerResult => {
    const verdict = verdictOf(config, counter);
    return { steps, counter, errorCalled, operatorResult, verdict, verdictText: VERDICT_TEXT[verdict] };
  };
  const ov = [config.outValid];

  if (config.guard) {
    const unknown = hasUnknown(ov);
    steps.push({
      kind: "guard",
      lineKey: "guard",
      label: "$isunknown(out_valid)",
      value: unknown ? "1" : "0",
      clause: "§20.9",
      text: unknown
        ? `out_valid is ${config.outValid}, so $isunknown returns 1 and the guard's then branch runs (§20.9, §12.4).`
        : `out_valid is ${config.outValid}, a known value, so $isunknown returns 0 and the else if runs (§20.9).`,
    });
    if (unknown) {
      steps.push({
        kind: "counter",
        lineKey: "guard-fail",
        label: "guard",
        value: "fail_cnt++",
        clause: "§20.10",
        text: "The guard counts a failure and calls $error, which reports a run-time error and lets the run continue (§20.10).",
      });
      return finish("fail", true, null);
    }
  }

  const validBranch = ifBranch(ov);
  steps.push({
    kind: "valid",
    lineKey: "valid",
    label: config.guard ? "else if (out_valid)" : "if (out_valid)",
    value: validBranch === "then" ? "true" : "false",
    clause: "§12.4",
    text:
      validBranch === "then"
        ? "out_valid is 1, a nonzero known value, so the compare runs (§12.4)."
        : config.outValid === "0"
          ? "out_valid is 0, so the compare is skipped: there is no result this cycle (§12.4)."
          : `out_valid is ${config.outValid}. An if treats x or z as false, so the compare is skipped and nothing is reported (§12.4).`,
  });
  if (validBranch === "else") {
    steps.push({
      kind: "counter",
      lineKey: "valid",
      label: "counters",
      value: COUNTER_TEXT.neither,
      clause: "§12.4",
      text:
        config.outValid === "0"
          ? "Neither counter moves: out_valid is 0."
          : `Neither counter moves. Without the $isunknown guard, ${config.outValid === "x" ? "an x" : "a z"} out_valid passes unnoticed.`,
    });
    return finish("neither", false, null);
  }

  let left: Bit4[] = config.sum;
  if (config.copyToInt) {
    const copy = assignToIntegral(config.sum, { states: 2, width: INT_WIDTH });
    left = copy.bits;
    steps.push({
      kind: "copy",
      lineKey: "copy",
      label: "s = sum",
      value: `s = ${toUnsigned(copy.bits)?.toString() ?? "?"}`,
      clause: "§6.11.2",
      text:
        copy.zeroed.length === 0
          ? "Every bit of sum is known, so the int copy holds the same value."
          : `int is 2-state, so assigning sum to s turns ${copy.zeroed.length === 1 ? `the ${unknownWord(config.sum)} bit` : `the ${copy.zeroed.length} ${unknownWord(config.sum)} bits`} into 0 (§6.11.2). The compare never sees the unknown.`,
    });
  }

  const op: EqualityOp = config.form === "neq" ? "!=" : config.form === "case-neq" ? "!==" : "==";
  const cmp = compare(op, left, config.exp);
  const expr = compareExpression(config);
  steps.push({
    kind: "operator",
    lineKey: "check",
    label: expr,
    value: bitLiteral(cmp.result),
    clause: "§11.4.5",
    text: `${expr} is ${bitLiteral(cmp.result)}. ${operatorSentence(op, cmp)}`,
  });

  const branch = ifBranch([cmp.result]);
  if (config.form === "assert-eq") {
    const passes = branch === "then";
    steps.push({
      kind: "branch",
      lineKey: "check",
      label: "assert",
      value: passes ? "pass statement" : "fail statement (else)",
      clause: "§16.3",
      text: passes
        ? "An immediate assert reads its expression like an if condition. It is 1, so the assertion passes and its pass statement runs (§16.3)."
        : `An immediate assert reads its expression like an if condition: ${bitLiteral(cmp.result)} is false, so the assertion fails and the else clause, its fail statement, runs (§16.3). Without an else clause the tool would call $error by default (§16.3, §20.10), unless $assertcontrol suppresses the failure (§20.11).`,
    });
    const counter: Counter = passes ? "pass" : "fail";
    steps.push({ kind: "counter", lineKey: "check", label: "counters", value: COUNTER_TEXT[counter], clause: "§16.3", text: counterSentence(counter) });
    return finish(counter, false, cmp.result);
  }

  steps.push({
    kind: "branch",
    lineKey: "check",
    label: "if",
    value: branch === "then" ? "then" : "else",
    clause: "§12.4",
    text:
      branch === "then"
        ? "The condition is 1, a nonzero known value, so the then branch runs (§12.4)."
        : cmp.result === "x"
          ? "An if treats x as false, so the else branch runs (§12.4)."
          : "The condition is 0, so the else branch runs (§12.4).",
  });
  const counter: Counter = branch === "then" ? "fail" : "pass";
  steps.push({ kind: "counter", lineKey: "check", label: "counters", value: COUNTER_TEXT[counter], clause: "§12.4", text: counterSentence(counter) });
  return finish(counter, false, cmp.result);
}

export interface OperatorBit {
  index: number;
  left: Bit4;
  right: Bit4;
  /** match / mismatch, or ambiguous when == or != meets an x or z (§11.4.5). */
  outcome: "match" | "mismatch" | "ambiguous";
}

/**
 * The compare bit by bit, for bits 8 down to 0. With the int copy the left
 * operand is s, whose bits 31 to 9 are 0, as e.sum's are after zero-extension
 * (§11.4.5 extends the shorter operand), so they always match and are left out.
 */
export function operatorBits(config: CheckerConfig): OperatorBit[] {
  const left = config.copyToInt ? assignToIntegral(config.sum, { states: 2, width: INT_WIDTH }).bits : config.sum;
  const op: EqualityOp = config.form === "neq" ? "!=" : config.form === "case-neq" ? "!==" : "==";
  return compare(op, left, config.exp)
    .bits.filter((b) => b.index < SUM_WIDTH)
    .map((b) => ({ index: b.index, left: b.a, right: b.b, outcome: b.outcome === "wildcard" ? "match" : b.outcome }));
}

/** Words for the bit table's outcome row. */
export const OPERATOR_BIT_WORD: Record<OperatorBit["outcome"], string> = { match: "match", mismatch: "differs", ambiguous: "unknown" };

/**
 * The operator step's explanation, built from the bit comparison the
 * four-state model returns (not from its prose), so it names the bit that
 * decides the result and is phrased by whether any bit is unknown (§11.4.5).
 */
export function operatorSentence(op: EqualityOp, cmp: EqualityResult): string {
  const mismatch = cmp.bits.find((b) => b.outcome === "mismatch");
  const anyUnknown = cmp.bits.some((b) => b.a === "x" || b.a === "z" || b.b === "x" || b.b === "z");
  if (op === "!==" || op === "===") {
    const head = `${op} compares x and z as values and always returns 0 or 1 (§11.4.5).`;
    const eqResult = mismatch ? "0" : "1";
    const tail = op === "!==" ? ` === would give ${eqResult}, so !== is a known ${cmp.result}.` : "";
    return mismatch
      ? `${head} Bit ${mismatch.index} is ${mismatch.a} versus ${mismatch.b}, so the operands differ.${tail}`
      : `${head} Every bit matches literally${anyUnknown ? ", x against x and z against z" : ""}, so the operands are identical.${tail}`;
  }
  const ambiguous = cmp.bits.find((b) => b.outcome === "ambiguous");
  const knownPairs = cmp.bits.filter((b) => b.outcome === "match" || b.outcome === "mismatch").length;
  let eq: string;
  if (mismatch) {
    eq = anyUnknown
      ? `Bit ${mismatch.index} is known in both operands and differs (${mismatch.a} vs ${mismatch.b}). Whatever the x or z bits are, the operands cannot be equal, so == gives 0 (§11.4.5).`
      : `Every bit is known and bit ${mismatch.index} differs (${mismatch.a} vs ${mismatch.b}), so == gives 0 (§11.4.5).`;
  } else if (ambiguous) {
    const lead = knownPairs === 0 ? "No bit is known in both operands, so nothing proves them different" : "Every bit known in both operands matches";
    eq = `${lead}, but bit ${ambiguous.index} is ${ambiguous.a} vs ${ambiguous.b}. The relation is ambiguous, so == gives x (§11.4.5).`;
  } else {
    eq = "All bits are known and equal, so == gives 1 (§11.4.5).";
  }
  const negation = op === "!=" ? ` != is the negation of ==, so it gives ${cmp.result}.` : "";
  return `${eq}${negation}`;
}

/** Which unknown values a vector holds, for sentences: "x", "z" or "x and z". */
function unknownWord(bits: readonly Bit4[]): string {
  const x = bits.includes("x");
  const z = bits.includes("z");
  return x && z ? "x and z" : z ? "z" : "x";
}

const counterSentence = (counter: Counter) =>
  counter === "pass" ? "pass_cnt++ runs: this result is counted as a pass." : counter === "fail" ? "fail_cnt++ runs: this result is counted as a failure." : "Neither counter moves.";

export interface CounterOption {
  id: Counter;
  label: string;
  correct: boolean;
  feedback: string;
}

/** The three predictions, each with feedback that diagnoses the misconception behind it. */
export function checkerOptions(config: CheckerConfig): CounterOption[] {
  const r = evaluateChecker(config);
  const why = r.steps.map((s) => s.text).join(" ");
  const ids: Counter[] = ["pass", "fail", "neither"];
  return ids.map((id) => ({ id, label: COUNTER_TEXT[id], correct: id === r.counter, feedback: id === r.counter ? why : diagnoseCounterGuess(config, r, id) }));
}

/** Why a wrong counter guess is wrong, from the step the guess misreads. */
export function diagnoseCounterGuess(config: CheckerConfig, r: CheckerResult, guess: Counter): string {
  if (guess === r.counter) return r.steps.map((s) => s.text).join(" ");
  const guard = r.steps.find((s) => s.kind === "guard");
  if (guard && guard.value === "1") {
    return `The $isunknown guard runs first and out_valid is ${config.outValid}, so it counts a failure before any compare (§20.9).`;
  }
  if (r.counter === "neither") {
    return config.outValid === "0"
      ? "out_valid is 0, so the compare does not run at all. Only a cycle with a result moves a counter."
      : `out_valid is ${config.outValid} and nothing guards it: if (out_valid) treats ${config.outValid} as false, so the compare never runs and neither counter moves (§12.4).`;
  }
  if (guess === "neither") return "out_valid is 1, so the compare runs, and both outcomes of the check move a counter: every path ends in pass_cnt++ or fail_cnt++.";
  const copy = r.steps.find((s) => s.kind === "copy");
  const operator = r.steps.find((s) => s.kind === "operator");
  const expUnknown = hasUnknown(config.exp);
  // The operand the compare actually reads: the int copy s, or sum itself.
  const left = config.copyToInt ? assignToIntegral(config.sum, { states: 2, width: INT_WIDTH }).bits : config.sum;
  const leftUnknown = hasUnknown(left);
  const erased = copy !== undefined && hasUnknown(config.sum);
  const erasedText = erased
    ? `the int copy turned the ${unknownWord(config.sum)} ${config.sum.filter((b) => b === "x" || b === "z").length === 1 ? "bit" : "bits"} into 0 (§6.11.2), so the compare reads ${copy.value}, a known value`
    : "";
  const knownEqual = r.operatorResult === (config.form === "assert-eq" ? "1" : "0");

  if (erased && guess === "fail" && knownEqual && !expUnknown) {
    return `The ${unknownWord(config.sum)} never reaches the compare: ${erasedText} that matches e.sum.`;
  }
  if (erased && guess === "pass" && r.counter === "fail") {
    return `The ${unknownWord(config.sum)} never reaches the compare: ${erasedText}. ${operator?.text ?? ""} So the check counts a failure${expUnknown ? "" : ", because the zeroed value differs from e.sum, not because of the unknown"}.`;
  }
  if (guess === "fail" && r.operatorResult === "x") {
    const source = expUnknown
      ? leftUnknown
        ? " Here both operands hold unknown bits."
        : ` Here the x comes from e.sum, which has an unknown bit${erased ? "; the copy had already removed the unknown from s" : ""}.`
      : "";
    return `An x condition is not a failure for an if: §12.4 treats x as false, so the else branch runs, and here the else branch counts a pass.${source}`;
  }
  if (guess === "pass" && config.form === "assert-eq") {
    return r.operatorResult === "x"
      ? "An immediate assert reads x like an if does, as false, so the assertion fails (§16.3)."
      : `${operator?.label} is ${operator?.value}, a known mismatch, so the assertion fails and its else clause, fail_cnt++, runs (§16.3).`;
  }
  if (guess === "pass" && config.form === "case-neq") {
    if (leftUnknown && !expUnknown) {
      return `!== never returns x. It compares x and z literally, so a ${compared(config)} with an unknown bit differs from a known e.sum and the result is 1 (§11.4.5).`;
    }
    if (!leftUnknown && !expUnknown) return "Every bit is known and the values differ, so !== is 1 and the then branch counts a failure (§11.4.5, §12.4).";
    return `${operator?.text ?? ""} The then branch counts a failure (§12.4).`;
  }
  if (guess === "pass" && r.operatorResult === "1" && config.form === "neq") {
    return leftUnknown || expUnknown
      ? "A known bit differs, so the operands cannot be equal whatever the x or z bits are: != gives a definite 1 (§11.4.5)."
      : "Every bit is known and the values differ, so != is 1 and the then branch counts a failure (§11.4.5, §12.4).";
  }
  if (guess === "fail" && r.counter === "pass" && r.operatorResult !== null && !expUnknown) {
    return `${operator?.label} is ${operator?.value}, which sends the check down its passing path. A known, equal pair of values is a pass.`;
  }
  if (guess === "fail" && r.counter === "pass" && expUnknown) {
    return "=== and !== match x against x literally, so an unknown sum can match an unknown expectation (§11.4.5).";
  }
  return r.steps.map((s) => s.text).join(" ");
}

/* ------------------------------------------------------------------ */
/* Debug mode: the F2A status_reg challenge                            */
/* ------------------------------------------------------------------ */

/** A: reset err in the DUT. B: a 4-state copy (logic err_q). C: compare with !==. */
export type FixId = "A" | "B" | "C";

export const FIX_IDS: readonly FixId[] = ["A", "B", "C"];

export type FixSet = Readonly<Record<FixId, boolean>>;

export const NO_FIXES: FixSet = { A: false, B: false, C: false };

export const FIX_LABELS: Record<FixId, string> = {
  A: "(A) reset err in the DUT",
  B: "(B) copy into logic err_q",
  C: "(C) compare with !==",
};

export const fixKey = (f: FixSet) => FIX_IDS.filter((id) => f[id]).join("") || "none";

export type DebugLineKey =
  | "ts"
  | "m-head"
  | "m-in"
  | "m-out"
  | "m-close"
  | "ff"
  | "A"
  | "else"
  | "busy1"
  | "seterr"
  | "ff-end"
  | "m-end"
  | "blank"
  | "tb-head"
  | "tb-logic"
  | "tb-dut-sigs"
  | "B"
  | "cnt"
  | "blank2"
  | "inst"
  | "blank3"
  | "clk"
  | "blank4"
  | "init"
  | "wait2"
  | "rst"
  | "rep"
  | "at"
  | "copy"
  | "C"
  | "fail"
  | "error"
  | "else-pass"
  | "rep-end"
  | "display"
  | "finish"
  | "init-end"
  | "tb-end";

export interface DebugLine {
  key: DebugLineKey;
  text: string;
  owner: "design" | "testbench";
  /** The lesson's (A)/(B)/(C) label, when the line carries one. */
  label?: FixId;
}

/**
 * status_reg and tb_top exactly as the F2A lesson prints them (with the
 * `// compile` marker dropped), then edited by the chosen fixes. The fixes
 * use the lesson's solution text: `err <= 1'b0;` in the reset branch,
 * `logic err_q;`, and `!==`.
 */
/** Column of the "// (C)" comment in the lesson's line `      if (err_bit != 1'b0) begin          // (C) the check`. */
const C_COMMENT_COLUMN = "      if (err_bit != 1'b0) begin          ".length;

export function debugSource(fixes: FixSet = NO_FIXES): DebugLine[] {
  const copy = fixes.B ? "err_q" : "err_bit";
  const op = fixes.C ? "!==" : "!=";
  const d = (key: DebugLineKey, text: string, label?: FixId): DebugLine => ({ key, text, owner: "design", label });
  const t = (key: DebugLineKey, text: string, label?: FixId): DebugLine => ({ key, text, owner: "testbench", label });
  return [
    d("ts", "`timescale 1ns/1ps"),
    d("m-head", "module status_reg ("),
    d("m-in", "  input  logic clk, rst_n, set_err,"),
    d("m-out", "  output logic err, busy"),
    d("m-close", ");"),
    d("ff", "  always_ff @(posedge clk or negedge rst_n)"),
    fixes.A
      ? d("A", "    if (!rst_n) begin busy <= 1'b0; err <= 1'b0; end  // (A) fixed", "A")
      : d("A", "    if (!rst_n) busy <= 1'b0;             // (A)", "A"),
    d("else", "    else begin"),
    d("busy1", "      busy <= 1'b1;"),
    d("seterr", "      if (set_err) err <= 1'b1;"),
    d("ff-end", "    end"),
    d("m-end", "endmodule"),
    t("blank", ""),
    t("tb-head", "module tb_top;"),
    t("tb-logic", "  logic clk = 0, rst_n = 0, set_err = 0;"),
    t("tb-dut-sigs", "  logic err, busy;"),
    fixes.B
      ? t("B", "  logic err_q;                            // (B) fixed: a 4-state copy", "B")
      : t("B", "  bit   err_bit;                          // (B) the monitor's copy of the flag", "B"),
    t("cnt", "  int   pass_cnt, fail_cnt;"),
    t("blank2", ""),
    t("inst", "  status_reg dut (.*);"),
    t("blank3", ""),
    t("clk", "  always #5 clk = ~clk;"),
    t("blank4", ""),
    t("init", "  initial begin"),
    t("wait2", "    repeat (2) @(posedge clk);"),
    t("rst", "    rst_n <= 1'b1;                        // nonblocking: the DUT samples the old value"),
    t("rep", "    repeat (3) begin"),
    t("at", "      @(posedge clk);"),
    t("copy", `      ${copy} = dut.err;`),
    t("C", `${`      if (${copy} ${op} 1'b0) begin`.padEnd(C_COMMENT_COLUMN - 1)} // (C) the check${fixes.C ? ", fixed" : ""}`, "C"),
    t("fail", "        fail_cnt++;"),
    t("error", '        $error("err is set");'),
    t("else-pass", "      end else pass_cnt++;"),
    t("rep-end", "    end"),
    t("display", '    $display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);'),
    t("finish", "    $finish;"),
    t("init-end", "  end"),
    t("tb-end", "endmodule"),
  ];
}

/** Number of rising edges the challenge shows (0 to 4), and the edges the monitor checks. */
export const DEBUG_EDGES = 5;
export const CHECK_EDGES: readonly number[] = [2, 3, 4];

export interface DebugCheck {
  edge: number;
  /** The copy's value when the check reads it. */
  copy: Bit4;
  op: "!=" | "!==";
  result: Bit4;
  branch: "then" | "else";
  counter: "pass" | "fail";
}

export interface DebugRun {
  fixes: FixSet;
  /** rst_n as the DUT samples it at edge k. */
  rstN: Bit4[];
  setErr: Bit4[];
  /** dut.err as read at edge k (before that edge's nonblocking updates). */
  dutErr: Bit4[];
  /** The monitor's copy as the check at edge k sees it; its initial value before the first check. */
  copy: Bit4[];
  /** $isunknown(dut.err) at edge k. */
  unknown: Bit4[];
  /** Edges at which the reset branch runs. */
  resetEdges: number[];
  checks: DebugCheck[];
  pass: number;
  fail: number;
  /** Ordered log: one entry per $error, then the $display line. */
  log: DebugLogLine[];
  /** The $display line, exactly as the format string prints it. */
  summary: string;
}

export interface DebugLogLine {
  kind: "error" | "display";
  edge?: number;
  /** The user part of the message (the tool adds its own prefix, §20.10). */
  text: string;
}

/**
 * Simulates the challenge edge by edge.
 * - err starts at 'x (logic, no initializer: Table 6-7); err_bit at '0 (bit),
 *   err_q at 'x (logic).
 * - rst_n starts at 0 (initializer, §6.8). `rst_n <= 1'b1` after the second
 *   edge is a nonblocking assignment, applied in the NBA region (§4.4.2.4,
 *   §10.4.2), so always_ff, woken by the same edge, still reads 0 there. The
 *   DUT first sees rst_n = 1 at edge 2.
 * - The reset branch assigns err only when fix A is applied. set_err stays 0,
 *   so the else branch never assigns err either.
 * - At edges 2, 3, 4 the monitor copies dut.err (the value before that edge's
 *   nonblocking updates; err does not change at those edges in any variant),
 *   converts it for a bit copy (§6.11.2), compares with != or !== (§11.4.5)
 *   and branches (§12.4).
 */
export function simulateStatusReg(fixes: FixSet = NO_FIXES): DebugRun {
  const rstN: Bit4[] = [];
  const setErr: Bit4[] = [];
  const dutErr: Bit4[] = [];
  const copyRow: Bit4[] = [];
  const unknown: Bit4[] = [];
  const resetEdges: number[] = [];
  const checks: DebugCheck[] = [];
  const log: DebugLogLine[] = [];
  let err: Bit4 = defaultVariableValue("logic", 1)[0];
  let copy: Bit4 = defaultVariableValue(fixes.B ? "logic" : "bit", 1)[0];
  let rst: Bit4 = "0";
  const op = fixes.C ? "!==" : "!=";
  let pass = 0;
  let fail = 0;
  for (let edge = 0; edge < DEBUG_EDGES; edge += 1) {
    rstN.push(rst);
    setErr.push("0");
    // The monitor and the DUT both wake on this edge; neither of the DUT's nonblocking updates is visible yet.
    const errNow = err;
    dutErr.push(errNow);
    unknown.push(hasUnknown([errNow]) ? "1" : "0");
    if (CHECK_EDGES.includes(edge)) {
      copy = assignToIntegral([errNow], { states: fixes.B ? 4 : 2, width: 1 }).bits[0];
      const result = compare(op, [copy], ["0"]).result;
      const branch = ifBranch([result]);
      const counter = branch === "then" ? "fail" : "pass";
      if (counter === "fail") {
        fail += 1;
        log.push({ kind: "error", edge, text: "err is set" });
      } else pass += 1;
      checks.push({ edge, copy, op, result, branch, counter });
    }
    copyRow.push(copy);
    // DUT: always_ff on this posedge. rst_n is read before the bench's nonblocking release lands.
    let nextErr = err;
    if (rst === "0") {
      resetEdges.push(edge);
      if (fixes.A) nextErr = "0";
    } else {
      // set_err is 0, so `if (set_err) err <= 1'b1;` does not run.
    }
    err = nextErr;
    // Bench: after the second edge (edge 1), rst_n <= 1'b1 lands in the NBA region of edge 1.
    if (edge === 1) rst = "1";
  }
  const summary = `PASS=${pass} FAIL=${fail}`;
  log.push({ kind: "display", text: summary });
  return { fixes, rstN, setErr, dutErr, copy: copyRow, unknown, resetEdges, checks, pass, fail, log, summary };
}

/** The four fix states the challenge asks about, in the order the lesson tells them. */
export const DEBUG_SCENARIOS: readonly { id: string; fixes: FixSet }[] = [
  { id: "none", fixes: NO_FIXES },
  { id: "B", fixes: { A: false, B: true, C: false } },
  { id: "C", fixes: { A: false, B: false, C: true } },
  { id: "BC", fixes: { A: false, B: true, C: true } },
  { id: "ABC", fixes: { A: true, B: true, C: true } },
];

const copyName = (run: DebugRun) => (run.fixes.B ? "err_q" : "err_bit");

/** Why this run logs what it logs: built from its first check. */
export function explainRun(run: DebugRun): string {
  const c = run.checks[0];
  const name = copyName(run);
  const errText = run.dutErr[c.edge];
  const source =
    errText === "x"
      ? run.fixes.B
        ? `dut.err is x and the 4-state copy ${name} keeps the x.`
        : `dut.err is x, but ${name} is a bit, so the copy turns x into 0 (§6.11.2).`
      : `dut.err is ${errText}: the reset branch now assigns it, so ${name} is ${c.copy}.`;
  const cmp =
    c.result === "x"
      ? `${name} ${c.op} 1'b0 is x (§11.4.5), and the if takes the else branch (§12.4).`
      : `${name} ${c.op} 1'b0 is ${c.result}, so the if takes the ${c.branch === "then" ? "then" : "else"} branch.`;
  const counted = run.fail === 0 ? `Every check counts a pass: ${run.summary}` : `Every check counts a failure and calls $error: ${run.summary}`;
  const honest = run.fixes.A
    ? " This time the pass is honest."
    : run.fail === 0
      ? " The x is still there: the log is wrong."
      : " The log now tells the truth about the DUT.";
  return `${source} ${cmp} ${counted}.${honest}`;
}

export interface LogOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Predictions for one fix state's log, with feedback from the model run. */
export function debugLogOptions(fixes: FixSet): LogOption[] {
  const run = simulateStatusReg(fixes);
  const right = explainRun(run);
  const allPass = `PASS=${CHECK_EDGES.length} FAIL=0`;
  const allFail = `PASS=0 FAIL=${CHECK_EDGES.length}`;
  const stopAtFirst = "PASS=0 FAIL=1, then the run stops";
  const opts: LogOption[] = [
    {
      id: "all-pass",
      label: allPass,
      correct: run.summary === allPass,
      feedback:
        run.summary === allPass
          ? right
          : `Not this time. ${copyName(run)} is ${run.checks[0].copy}, and ${copyName(run)} ${run.checks[0].op} 1'b0 is ${run.checks[0].result}, so the if takes the then branch and counts a failure at every check (§11.4.5, §12.4).`,
    },
    {
      id: "all-fail",
      label: allFail,
      correct: run.summary === allFail,
      feedback: run.summary === allFail ? right : diagnoseAllFail(run),
    },
    {
      id: "stop",
      label: stopAtFirst,
      correct: false,
      feedback: "$error reports a run-time error and the run goes on; only $fatal implies $finish (§20.10). A failing run still prints its PASS/FAIL line.",
    },
  ];
  return opts;
}

function diagnoseAllFail(run: DebugRun): string {
  const c = run.checks[0];
  if (run.fixes.A) return `The DUT now resets err to 0, so ${copyName(run)} is a known 0 and ${copyName(run)} ${c.op} 1'b0 is ${c.result}: every check passes, honestly.`;
  if (!run.fixes.B)
    return `err_bit is a bit, so the copy turned the x into 0 before the compare (§6.11.2), and 0 ${c.op} 1'b0 is ${c.result}: ${c.op === "!==" ? "!== cannot catch an x that is already gone" : "the check sees a clean 0"}.`;
  return `err_q keeps the x, but err_q ${c.op} 1'b0 is ${c.result} (§11.4.5), and the if treats x as false (§12.4): the else branch counts a pass.`;
}

export type SuspectId = FixId | "rst-nb" | "counters" | "clk";

export interface Suspect {
  id: SuspectId;
  lineKey: DebugLineKey;
  verdict: "culprit" | "decoy";
  /** Which part of the bug a culprit is. */
  role?: "creates" | "erases" | "hides";
  feedback: string;
  /** A recomputation by the model that backs the verdict. */
  evidence: string;
}

const row = (bits: readonly Bit4[]) => bits.join(", ");

/** Grades every suspect line, with evidence recomputed by the model. */
export function gradeSuspects(): Suspect[] {
  const base = simulateStatusReg(NO_FIXES);
  const dutFixed = simulateStatusReg({ A: true, B: false, C: false });
  const checkCopies = base.checks.map((c) => c.copy);
  return [
    {
      id: "A",
      lineKey: "A",
      verdict: "culprit",
      role: "creates",
      feedback: "Found it: (A) creates the x. The reset branch assigns busy but never err, and set_err stays 0, so err keeps the 'x a logic variable starts with when it has no initializer (Table 6-7).",
      evidence: `dut.err at edges 0 to ${DEBUG_EDGES - 1}: ${row(base.dutErr)}. With err <= 1'b0 added to the reset branch: ${row(dutFixed.dutErr)}.`,
    },
    {
      id: "B",
      lineKey: "B",
      verdict: "culprit",
      role: "erases",
      feedback: "Found it: (B) erases the x. err_bit is a 2-state bit, and assigning the 4-state dut.err to it turns x into 0 (§6.11.2).",
      evidence: `At the checks (edges ${CHECK_EDGES.join(", ")}) dut.err is ${row(CHECK_EDGES.map((e) => base.dutErr[e]))} but err_bit reads ${row(checkCopies)}.`,
    },
    {
      id: "C",
      lineKey: "C",
      verdict: "culprit",
      role: "hides",
      feedback:
        "Found it: (C) is the check that decides what an unknown counts as. Look at its operator and at what an if does with x (§11.4.5, §12.4). The fixes below test whether (B) alone is enough.",
      // The logs themselves stay behind the fix predictions, so this evidence does not answer them.
      evidence: `The check runs at edges ${CHECK_EDGES.join(", ")} and compares with ${base.checks[0].op}.`,
    },
    {
      id: "rst-nb",
      lineKey: "rst",
      verdict: "decoy",
      feedback:
        "A decoy. The nonblocking release is deliberate: it lands in the NBA region (§4.4.2.4, §10.4.2), after the DUT's always_ff has read rst_n at the same edge, so the DUT sees the release cleanly at the next edge. It never touches err.",
      evidence: `The reset branch runs at edges ${base.resetEdges.join(" and ")}, and dut.err is ${row(base.dutErr)} either way: the reset branch never assigns it.`,
    },
    {
      id: "counters",
      lineKey: "cnt",
      verdict: "decoy",
      feedback: "A decoy. int is 2-state and starts at 0 without an initializer (Table 6-7), which is exactly what a counter needs. 2-state is wrong for a copy of a DUT signal, not for a count.",
      evidence: `The counters add up to ${base.pass + base.fail}, one per check at edges ${CHECK_EDGES.join(", ")}.`,
    },
    {
      id: "clk",
      lineKey: "clk",
      verdict: "decoy",
      feedback: "A decoy. clk is declared logic clk = 0, so it starts at 0, not x (§6.8), and ~clk toggles it every 5 ns. Without the initializer it would stay x forever.",
      evidence: `The model sees ${DEBUG_EDGES} rising edges, and the monitor checks at edges ${CHECK_EDGES.join(", ")}.`,
    },
  ];
}

export const CULPRITS: readonly SuspectId[] = ["A", "B", "C"];

export const DEBUG_HINTS: readonly string[] = [
  "Follow err from where it is born to where it is counted: the DUT's reset branch, the monitor's copy, then the if.",
  "Which variables are 2-state here? A 2-state variable cannot hold x (§6.11.2).",
  "Even with a 4-state copy, what does err_q != 1'b0 return when err_q is x, and which branch does the if take (§11.4.5, §12.4)?",
];

export const DEBUG_ASSUMPTION =
  "The run is modelled edge by edge. The bench and the DUT both wake on each rising edge; the monitor reads dut.err before that edge's nonblocking updates, which is safe here because err changes only at reset edges. The $error message's prefix and layout are tool-specific (§20.10); the lab prints only the user text.";
