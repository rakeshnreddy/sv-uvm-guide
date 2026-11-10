/**
 * Pure model behind TimingControlExplorer: which value changes are events,
 * what wakes a waiting process, and when an assignment with a timing control
 * reads its right-hand side and writes its left-hand side.
 *
 * Every edge and change decision comes from `sv-event-control-model.ts`, the
 * same file the process model uses, so the two visuals cannot disagree. This
 * file only adds the drills, the scripts and the sentences the component shows.
 *
 * Rules (IEEE 1800-2023, checked against the standard's text):
 * - §9.4.2, Table 9-2 (via sv-event-control-model): edge detection, LSB only,
 *   and an operand change that leaves the expression's value unchanged is no event.
 * - §9.4.2.1: `or` and `,` are the same event OR; the list wakes when any term fires.
 * - §9.4.2.3: an `iff` guard must be true as defined in §12.4 (x and z are false)
 *   and `iff` has precedence over `or`.
 * - §9.4.3: `wait (expr)` passes at once when expr is already true; otherwise the
 *   process stays blocked until it becomes true.
 * - §11.4.8, Table 11-11: the 4-state `&` used for `a & b` (from sv-four-state-model).
 * - §9.4.5, Table 9-3: an intra-assignment delay or event control evaluates the
 *   right-hand side before the delay and assigns after it. The repeat count is
 *   evaluated once; a count <= 0, x or z gives the assignment "as if there is no
 *   repeat construct", and the clause's example `repeat (-3) @(event_expression)`
 *   "will not execute" the event control.
 * - §10.4.1: a blocking assignment executes before the statements after it in a
 *   sequential block, so a blocking intra-assignment control holds the process.
 * - §10.4.2: a nonblocking assignment schedules without blocking the procedural flow.
 * - §4.6 b): nonblocking updates are performed in the order the statements executed.
 */

import {
  EDGE_TABLE,
  edgeOf,
  eventControlFires,
  isTrueCondition,
  lsbOf,
  termFires,
  valueChanged,
  type Bit4,
  type EventTermKind,
} from "./sv-event-control-model";
import { bitwiseBit } from "./sv-four-state-model";

export { EDGE_TABLE, type Bit4 };

export const BIT4: readonly Bit4[] = ["0", "1", "x", "z"];

/** Next value in the 0 → 1 → x → z cycle used by the bit editors. */
export const nextBit = (bit: Bit4): Bit4 => BIT4[(BIT4.indexOf(bit) + 1) % BIT4.length];

/* ========================================================================= */
/* Part 1: the edge-detector drill (mode "events")                           */
/* ========================================================================= */

export type SubjectKind = "signal" | "bus" | "and";

export const BUS_WIDTH = 4;

export interface BitChange {
  before: Bit4;
  after: Bit4;
}

export interface EventDrill {
  subject: SubjectKind;
  /** Name of the one-bit signal when subject is "signal". */
  signalName: string;
  /** The one-bit signal (subject "signal"). */
  s: BitChange;
  /** The 4-bit bus, MSB first (subject "bus"). */
  bus: { before: Bit4[]; after: Bit4[] };
  /** The operands of `a & b` (subject "and"). */
  a: BitChange;
  b: BitChange;
  /** The iff guard's value when the expression changes. */
  en: Bit4;
  /** Adds `@(posedge s iff en or negedge s)` to the list of controls. */
  withIffOr: boolean;
  /**
   * Set only by the wake script: which signal this write goes to, so the
   * no-change sentence never claims the watched signal was written when it was not.
   */
  write?: { signal: "a" | "b"; number: number };
}

export type ControlId = "posedge" | "negedge" | "edge" | "change" | "posedge-iff" | "iff-or";

interface ControlTerm {
  kind: EventTermKind;
  guarded: boolean;
}

export const CONTROL_TERMS: Readonly<Record<ControlId, readonly ControlTerm[]>> = {
  posedge: [{ kind: "posedge", guarded: false }],
  negedge: [{ kind: "negedge", guarded: false }],
  edge: [{ kind: "edge", guarded: false }],
  change: [{ kind: "change", guarded: false }],
  "posedge-iff": [{ kind: "posedge", guarded: true }],
  "iff-or": [
    { kind: "posedge", guarded: true },
    { kind: "negedge", guarded: false },
  ],
};

export const BASE_CONTROLS: readonly ControlId[] = ["posedge", "negedge", "edge", "change", "posedge-iff"];

export function drillControls(drill: EventDrill): ControlId[] {
  return drill.withIffOr ? [...BASE_CONTROLS, "iff-or"] : [...BASE_CONTROLS];
}

/** The expression as written: `s`, `bus` or `a & b`. */
export function subjectName(drill: EventDrill): string {
  if (drill.subject === "bus") return "bus";
  if (drill.subject === "and") return "a & b";
  return drill.signalName;
}

/** Operand of an edge keyword: `(a & b)` needs parentheses, a name does not. */
const edgeOperand = (drill: EventDrill) => (drill.subject === "and" ? "(a & b)" : subjectName(drill));

function termText(drill: EventDrill, term: ControlTerm): string {
  const body = term.kind === "change" ? subjectName(drill) : `${term.kind} ${edgeOperand(drill)}`;
  return term.guarded ? `${body} iff en` : body;
}

/** Source text of a control, for example `@(posedge s iff en or negedge s)`. */
export function controlText(drill: EventDrill, id: ControlId): string {
  return `@(${CONTROL_TERMS[id].map((t) => termText(drill, t)).join(" or ")})`;
}

/** The expression's value before and after, as 4-state bit strings (MSB first). */
export function subjectValues(drill: EventDrill): { before: string; after: string } {
  if (drill.subject === "bus") return { before: drill.bus.before.join(""), after: drill.bus.after.join("") };
  if (drill.subject === "and")
    return { before: bitwiseBit("&", drill.a.before, drill.b.before), after: bitwiseBit("&", drill.a.after, drill.b.after) };
  return { before: drill.s.before, after: drill.s.after };
}

/** How a value is written in the sentences: one bit as 1'b0, the bus as 4'b0011. */
export function formatValue(bits: string): string {
  return `${bits.length}'b${bits}`;
}

/** The Table 9-2 cell the edge keywords look at: the LSB before and after (§9.4.2). */
export function edgeCell(drill: EventDrill): { from: Bit4; to: Bit4; edge: "posedge" | "negedge" | null } {
  const { before, after } = subjectValues(drill);
  const from = lsbOf(before);
  const to = lsbOf(after);
  return { from, to, edge: edgeOf(from, to) };
}

export interface ControlVerdict {
  id: ControlId;
  text: string;
  fires: boolean;
  /** Indexes of the terms that fired (more than one term only for "iff-or"). */
  firedBy: number[];
  /** Why, generated from the same evaluation. */
  reason: string;
}

const truthWord = (v: Bit4) =>
  v === "1" ? "1, which is true" : v === "0" ? "0, which is false" : `${v}, and x and z count as false (§12.4)`;

/** The no-change sentence, naming the operands when they changed and the result did not. */
function noChangeReason(drill: EventDrill, before: string): string {
  const name = subjectName(drill);
  if (drill.subject === "and") {
    const moved = (["a", "b"] as const).filter((op) => drill[op].before !== drill[op].after);
    const was = `${drill.a.before} & ${drill.b.before}`;
    const now = `${drill.a.after} & ${drill.b.after}`;
    if (moved.length > 0) {
      return `a & b was ${was} = ${before} and is ${now} = ${before} (Table 11-11). ${moved.join(" and ")} changed, but the expression's value did not, and an operand change that leaves the value unchanged is not an event (§9.4.2).`;
    }
    return `Neither a nor b changed, so a & b stays ${before}: no change, no event (§9.4.2).`;
  }
  if (drill.write && drill.write.signal !== name) {
    return `Write ${drill.write.number} is to ${drill.write.signal}; ${name} is not written and stays ${formatValue(before)}, so there is no event (§9.4.2).`;
  }
  return `${name} stays ${formatValue(before)}: writing the value it already has is not a change, so there is no event (§9.4.2).`;
}

function edgeSentence(drill: EventDrill): string {
  const { from, to, edge } = edgeCell(drill);
  const named = edge ? `a ${edge}` : "no edge";
  if (drill.subject === "bus") {
    return `Edges are detected on the least significant bit only (§9.4.2): bus[0] goes ${from} → ${to}, which Table 9-2 lists as ${named}.`;
  }
  return `${subjectName(drill)} goes ${from} → ${to}, which Table 9-2 lists as ${named}.`;
}

/** Evaluates one control against the drill, with the sentence that explains it. */
export function evaluateControl(drill: EventDrill, id: ControlId): ControlVerdict {
  const { before, after } = subjectValues(drill);
  const terms = CONTROL_TERMS[id];
  const { fires, firedBy } = eventControlFires(
    terms.map((t) => ({ kind: t.kind, before, after, ...(t.guarded ? { guard: drill.en } : {}) })),
  );
  const text = controlText(drill, id);
  const changed = valueChanged(before, after);
  const verdict = fires ? `${text} wakes.` : `${text} does not wake.`;
  let reason: string;

  if (!changed) {
    reason = `${noChangeReason(drill, before)} ${verdict}`;
  } else if (id === "change") {
    reason = `${subjectName(drill)} changes from ${formatValue(before)} to ${formatValue(after)}. Any change of the expression's value is an event (§9.4.2). ${verdict}`;
  } else if (id === "posedge" || id === "negedge" || id === "edge") {
    const edgeNote = id === "edge" ? " The edge keyword is detected on either a posedge or a negedge (§9.4.2)." : "";
    reason = `${edgeSentence(drill)}${edgeNote} ${verdict}`;
  } else if (id === "posedge-iff") {
    const edgeFires = termFires({ kind: "posedge", before, after });
    reason = edgeFires
      ? `${edgeSentence(drill)} The guard en is ${truthWord(drill.en)}. The event fires only if the guard is true (§9.4.2.3). ${verdict}`
      : `${edgeSentence(drill)} Without a posedge there is nothing for the guard to let through. ${verdict}`;
  } else {
    const [guardedTerm, plainTerm] = terms.map((t) => termText(drill, t));
    const termState = (i: number) => (firedBy.includes(i) ? "fires" : "does not fire");
    const wholeListGuarded = termFires({ kind: "edge", before, after, guard: drill.en });
    reason =
      `iff has precedence over or (§9.4.2.3), so the list is (${guardedTerm}) or (${plainTerm}). ` +
      `${edgeSentence(drill)} en is ${truthWord(drill.en)}. (${guardedTerm}) ${termState(0)}; (${plainTerm}) ${termState(1)}. ` +
      `The list wakes when any term fires (§9.4.2.1). ${verdict} ` +
      `If the guard applied to the whole list, it would ${wholeListGuarded ? "also wake" : "not wake"}.`;
  }
  return { id, text, fires, firedBy, reason };
}

export function evaluateDrill(drill: EventDrill): ControlVerdict[] {
  return drillControls(drill).map((id) => evaluateControl(drill, id));
}

export interface DrillScore {
  correct: number;
  total: number;
  /** Per control: did the learner's tick match the model? */
  perControl: Record<string, boolean>;
}

/** Grades a set of ticked controls: a control is right when ticked exactly when it wakes. */
export function scoreDrill(drill: EventDrill, ticked: readonly ControlId[]): DrillScore {
  const perControl: Record<string, boolean> = {};
  let correct = 0;
  evaluateDrill(drill).forEach((v) => {
    const ok = ticked.includes(v.id) === v.fires;
    perControl[v.id] = ok;
    if (ok) correct += 1;
  });
  return { correct, total: drillControls(drill).length, perControl };
}

/** One line for the live region and the reveal heading. */
export function drillSummary(drill: EventDrill): string {
  const verdicts = evaluateDrill(drill);
  const woke = verdicts.filter((v) => v.fires).map((v) => v.text);
  const slept = verdicts.filter((v) => !v.fires).map((v) => v.text);
  const { before, after } = subjectValues(drill);
  const head = `${subjectName(drill)}: ${formatValue(before)} → ${formatValue(after)}, en = ${drill.en}.`;
  return `${head} Wakes: ${woke.length ? woke.join(", ") : "none"}. Does not wake: ${slept.length ? slept.join(", ") : "none"}.`;
}

export interface EventPreset {
  id: string;
  title: string;
  /** What the preset is for, shown only inside the reveal. */
  lesson: string;
  drill: EventDrill;
}

const baseDrill: EventDrill = {
  subject: "signal",
  signalName: "s",
  s: { before: "0", after: "1" },
  bus: { before: ["0", "0", "1", "1"], after: ["0", "0", "1", "0"] },
  a: { before: "0", after: "0" },
  b: { before: "0", after: "1" },
  en: "1",
  withIffOr: false,
};

const drill = (patch: Partial<EventDrill>): EventDrill => ({ ...baseDrill, ...patch });

export const EVENT_PRESETS: readonly EventPreset[] = [
  {
    id: "x-to-0-reset",
    title: "x → 0 active-low reset",
    lesson: "An active-low reset that starts as x and is driven to 0 makes a negedge: x → 0 is in the negedge row of Table 9-2.",
    drill: drill({ signalName: "rst_n", s: { before: "x", after: "0" } }),
  },
  {
    id: "one-to-z",
    title: "1 → z",
    lesson: "Going to z is not 'no change': 1 → z is a negedge in Table 9-2, and @(s) sees the change too.",
    drill: drill({ s: { before: "1", after: "z" } }),
  },
  {
    id: "bus-lsb-negedge",
    title: "bus 4'b0011 → 4'b0010",
    lesson: "Only bus[0] matters to posedge and negedge. Its 1 → 0 is a negedge, whatever the other bits do.",
    drill: drill({ subject: "bus", bus: { before: ["0", "0", "1", "1"], after: ["0", "0", "1", "0"] } }),
  },
  {
    id: "bus-lsb-unchanged",
    title: "bus 4'b0001 → 4'b0011",
    lesson: "bus changed, so @(bus) wakes. bus[0] stayed 1, so @(posedge bus) does not.",
    drill: drill({ subject: "bus", bus: { before: ["0", "0", "0", "1"], after: ["0", "0", "1", "1"] } }),
  },
  {
    id: "and-unchanged",
    title: "@(a & b): b changes, a & b does not",
    lesson: "The event control watches the expression's value, not its operands.",
    drill: drill({ subject: "and", a: { before: "0", after: "0" }, b: { before: "0", after: "1" } }),
  },
  {
    id: "iff-en-x",
    title: "en = x in the iff guard",
    lesson: "The guard must be true as §12.4 defines it. x is not true, so the posedge is filtered out.",
    drill: drill({ s: { before: "0", after: "1" }, en: "x" }),
  },
  {
    id: "iff-binds-tighter",
    title: "iff binds tighter than or",
    lesson: "In posedge s iff en or negedge s the guard belongs to the first term only.",
    drill: drill({ s: { before: "1", after: "0" }, en: "0", withIffOr: true }),
  },
];

/* ========================================================================= */
/* Part 2: what wakes a waiting process (mode "wake")                        */
/* ========================================================================= */

export type WaiterId = "change-a" | "posedge-a" | "negedge-a" | "change-and" | "wait-a";

export interface Waiter {
  id: WaiterId;
  code: string;
}

export const WAKE_WAITERS: readonly Waiter[] = [
  { id: "change-a", code: "@(a)" },
  { id: "posedge-a", code: "@(posedge a)" },
  { id: "negedge-a", code: "@(negedge a)" },
  { id: "change-and", code: "@(a & b)" },
  { id: "wait-a", code: "wait (a)" },
];

export const WAKE_INITIAL: Readonly<{ a: Bit4; b: Bit4 }> = { a: "x", b: "0" };

/** The script of writes; each write's old value is derived, not typed. */
export const WAKE_WRITES: readonly { signal: "a" | "b"; value: Bit4 }[] = [
  { signal: "a", value: "0" },
  { signal: "a", value: "0" },
  { signal: "a", value: "1" },
  { signal: "b", value: "1" },
];

export interface WakeStep {
  index: number;
  signal: "a" | "b";
  from: Bit4;
  to: Bit4;
  /** Values of a and b before and after this write. */
  before: { a: Bit4; b: Bit4 };
  after: { a: Bit4; b: Bit4 };
}

export function wakeSteps(): WakeStep[] {
  let state = { ...WAKE_INITIAL };
  return WAKE_WRITES.map((w, index) => {
    const before = { ...state };
    const after = { ...state, [w.signal]: w.value };
    state = after;
    return { index, signal: w.signal, from: before[w.signal], to: w.value, before, after };
  });
}

export const writeText = (step: WakeStep) => `${step.signal} = 1'b${step.to};  (${step.signal} was ${step.from})`;

export type WakeOutcome = "wakes" | "asleep" | "passes-at-once";

export const WAKE_OUTCOME_LABELS: Readonly<Record<WakeOutcome, string>> = {
  wakes: "wakes",
  asleep: "stays asleep",
  "passes-at-once": "never blocks: passes at once",
};

/** The outcomes a learner can pick for a waiter. Only wait offers 'passes at once'; @ always waits for an event. */
export function outcomeChoices(waiter: WaiterId): WakeOutcome[] {
  return waiter === "wait-a" ? ["wakes", "asleep", "passes-at-once"] : ["wakes", "asleep"];
}

/** A drill for one write, so the @ waiters reuse exactly the event drill's reasoning. */
function stepDrill(step: WakeStep, waiter: WaiterId): EventDrill {
  if (waiter === "change-and") {
    return drill({
      subject: "and",
      a: { before: step.before.a, after: step.after.a },
      b: { before: step.before.b, after: step.after.b },
    });
  }
  return drill({ signalName: "a", s: { before: step.before.a, after: step.after.a }, write: { signal: step.signal, number: step.index + 1 } });
}

const WAITER_CONTROL: Readonly<Record<Exclude<WaiterId, "wait-a">, ControlId>> = {
  "change-a": "change",
  "posedge-a": "posedge",
  "negedge-a": "negedge",
  "change-and": "change",
};

export interface WakeVerdict {
  outcome: WakeOutcome;
  rule: string;
}

/** How the drill arms the waiter; shown under the waiter picker. */
export const WAKE_ARMING_NOTE =
  "Each write is judged on its own, with the waiter freshly reached just before that write.";

/**
 * Shown for wait (a) only: re-arming it in a loop is the zero-delay trap.
 * §9.4.3 blocks only while the condition is not true, so with a = 1 nothing in
 * `forever wait (a);` ever waits.
 */
export const WAIT_LOOP_CAUTION =
  "Caution: do not read this as forever wait (a);. Once a is 1, every pass of that loop goes through wait (a) at once, so the loop spins without simulation time advancing.";

/**
 * The waiter is freshly reached just before each write, so every write is
 * judged on its own (see WAKE_ARMING_NOTE and WAIT_LOOP_CAUTION).
 */
export function wakeOutcome(waiter: WaiterId, step: WakeStep): WakeVerdict {
  if (waiter === "wait-a") {
    const aBefore = step.before.a;
    const aAfter = step.after.a;
    if (isTrueCondition(aBefore)) {
      return {
        outcome: "passes-at-once",
        rule: `a is already ${aBefore}, which is true, when wait (a) is reached, so it passes at once without blocking (§9.4.3). This write plays no part.`,
      };
    }
    if (isTrueCondition(aAfter)) {
      return {
        outcome: "wakes",
        rule: `wait (a) blocked because a was ${aBefore}, which is not true (§12.4). a becomes ${aAfter}, which is true, so the process continues (§9.4.3).`,
      };
    }
    const why = aAfter === "0" ? "0 is false" : "x and z are not true";
    const state =
      step.signal === "a"
        ? `a is ${aAfter} after this write`
        : `Write ${step.index + 1} is to ${step.signal}; a is not written and stays ${aAfter}`;
    return {
      outcome: "asleep",
      rule: `${state}: ${why} (§12.4), so wait (a) stays blocked until a becomes true (§9.4.3).`,
    };
  }
  const verdict = evaluateControl(stepDrill(step, waiter), WAITER_CONTROL[waiter]);
  return { outcome: verdict.fires ? "wakes" : "asleep", rule: verdict.reason };
}

export function explainWakeChoice(waiter: WaiterId, step: WakeStep, choice: WakeOutcome): { correct: boolean; feedback: string } {
  const truth = wakeOutcome(waiter, step);
  if (choice === truth.outcome) return { correct: true, feedback: truth.rule };
  return {
    correct: false,
    feedback: `It ${WAKE_OUTCOME_LABELS[truth.outcome]}, not "${WAKE_OUTCOME_LABELS[choice]}". ${truth.rule}`,
  };
}

/** The full matrix (waiter × write) for the recap after the last write. */
export function wakeMatrix(): { waiter: Waiter; outcomes: WakeOutcome[] }[] {
  const steps = wakeSteps();
  return WAKE_WAITERS.map((waiter) => ({ waiter, outcomes: steps.map((s) => wakeOutcome(waiter.id, s).outcome) }));
}

/* ========================================================================= */
/* Part 3: intra-assignment timing (mode "intra")                            */
/* ========================================================================= */

export type IntraFormId = "blocking-intra" | "nonblocking-intra" | "delayed-statement" | "nonblocking-repeat" | "nba-order";

export const INTRA_FORMS: readonly { id: IntraFormId; code: string }[] = [
  { id: "blocking-intra", code: "a = #5 b;" },
  { id: "nonblocking-intra", code: "a <= #5 b;" },
  { id: "delayed-statement", code: "#5 a = b;" },
  { id: "nonblocking-repeat", code: "a <= repeat (n) @(posedge clk) d;" },
  { id: "nba-order", code: "a <= 0; a <= 1;" },
];

/** The statement starts at this time. */
export const START_TIME = 0;
/** The time axis drawn by the component ends here; later events are computed but not drawn. */
export const AXIS_END = 12;
export const DELAY = 5;

/** b and d change at t = 2 and t = 7; each entry is the value from that time on. */
export const STIMULUS: Readonly<Record<"b" | "d", readonly { time: number; value: number }[]>> = {
  b: [
    { time: 0, value: 1 },
    { time: 2, value: 2 },
    { time: 7, value: 3 },
  ],
  d: [
    { time: 0, value: 10 },
    { time: 2, value: 20 },
    { time: 7, value: 30 },
  ],
};

/** Rising edges of clk: the first at 3, then every 3 time units. */
export const CLOCK = { firstPosedge: 3, period: 3 } as const;

export function posedgeTime(n: number): number {
  return CLOCK.firstPosedge + (n - 1) * CLOCK.period;
}

export function posedgesOnAxis(): number[] {
  const out: number[] = [];
  for (let t = CLOCK.firstPosedge; t <= AXIS_END; t += CLOCK.period) out.push(t);
  return out;
}

/**
 * The value a signal holds when it is read at `time`. A read at the same time
 * as a change is avoided by the script (no read falls on t = 2 or 7).
 */
export function valueAt(signal: "b" | "d", time: number): number {
  const script = STIMULUS[signal];
  let value = script[0].value;
  script.forEach((e) => {
    if (e.time <= time) value = e.value;
  });
  return value;
}

export type RepeatCountId = "three" | "zero" | "neg-int" | "neg-unsigned" | "x" | "z";

export interface RepeatCountCase {
  id: RepeatCountId;
  /** Declaration as written. */
  declaration: string;
  label: string;
}

export const REPEAT_COUNTS: readonly RepeatCountCase[] = [
  { id: "three", declaration: "int n = 3;", label: "3" },
  { id: "zero", declaration: "int n = 0;", label: "0" },
  { id: "neg-int", declaration: "int n = -3;", label: "-3 (int)" },
  { id: "neg-unsigned", declaration: "int unsigned n = -3;", label: "-3 (int unsigned)" },
  { id: "x", declaration: "integer n = 'x;", label: "x (integer)" },
  { id: "z", declaration: "integer n = 'z;", label: "z (integer)" },
];

/** The counts the component offers (the spec's five; z is modelled and tested but not offered). */
export const OFFERED_REPEAT_COUNTS: readonly RepeatCountId[] = ["three", "zero", "neg-int", "neg-unsigned", "x"];

export interface RepeatEvaluation {
  /** The count as the repeat construct sees it, evaluated once. */
  value: number | "x" | "z";
  /** How many posedges are waited for: 0 when the count is <= 0, x or z (§9.4.5). */
  waits: number;
  /** Why, in one sentence. */
  note: string;
}

const INT_UNSIGNED_MODULUS = 2 ** 32;

/**
 * §9.4.5: the count is evaluated once before scheduling. -3 stored in a 32-bit
 * `int unsigned` is 2^32 - 3 (an assignment to an unsigned 32-bit variable keeps
 * the low 32 bits of the two's-complement value).
 */
export function evaluateRepeatCount(id: RepeatCountId): RepeatEvaluation {
  if (id === "x" || id === "z") {
    return {
      value: id,
      waits: 0,
      note: `n is ${id}: an unknown or high-impedance count makes the assignment occur as if there were no repeat construct (§9.4.5).`,
    };
  }
  const raw = id === "three" ? 3 : id === "zero" ? 0 : -3;
  if (id === "neg-unsigned") {
    const stored = ((raw % INT_UNSIGNED_MODULUS) + INT_UNSIGNED_MODULUS) % INT_UNSIGNED_MODULUS;
    return {
      value: stored,
      waits: stored,
      note: `n is an int unsigned, so -3 is stored as ${stored} (2^32 - 3). The count is positive: it repeats ${stored} times, as the clause's own repeat (a) example says for an unsigned a (§9.4.5).`,
    };
  }
  if (raw <= 0) {
    return {
      value: raw,
      waits: 0,
      note: `n is ${raw}, which is <= 0, so the assignment occurs as if there were no repeat construct (§9.4.5).`,
    };
  }
  return { value: raw, waits: raw, note: `n is ${raw}, so the assignment waits for ${raw} rising edges of clk (§9.4.5).` };
}

/** The clause's sentence and its example read slightly differently; the lab follows the example. */
export const NO_REPEAT_NOTE =
  "§9.4.5 says the assignment occurs \"as if there is no repeat construct\", and its example says repeat (-3) @(event_expression) will not execute the event control. The lab follows the example: no edge is waited for and the update is scheduled at once.";

export interface IntraWrite {
  /** Time of the write. The largest offered (3 * 2^32) is far inside Number.MAX_SAFE_INTEGER, so it stays exact. */
  time: number;
  region: "Active" | "NBA";
  value: number;
}

export interface IntraResult {
  form: IntraFormId;
  code: string[];
  /** The right-hand side signal, if one is read. */
  rhs: "b" | "d" | null;
  /** When the right-hand side is evaluated. */
  readAt: number | null;
  valueRead: number | null;
  writes: IntraWrite[];
  /** The value a holds once every write is done. */
  finalValue: number;
  /** When the statement after this one starts. */
  nextStatementAt: number;
  /** Does the process wait inside this statement? */
  blocks: boolean;
  repeat?: RepeatEvaluation;
  /** Table 9-3's equivalent, or why there is none. */
  equivalent: { fromTable: boolean; lines: string[]; note: string };
  /** The deciding rule in one or two sentences. */
  rule: string;
}

const lastWrite = (r: IntraResult) => r.writes[r.writes.length - 1];

/** Formats a time as t = N. */
export const timeText = (t: number) => `t = ${t.toString()}`;

export function evaluateIntra(form: IntraFormId, count: RepeatCountId = "three"): IntraResult {
  const code = INTRA_FORMS.find((f) => f.id === form)!.code;
  switch (form) {
    case "blocking-intra": {
      const v = valueAt("b", START_TIME);
      return {
        form,
        code: [code],
        rhs: "b",
        readAt: START_TIME,
        valueRead: v,
        writes: [{ time: START_TIME + DELAY, region: "Active", value: v }],
        finalValue: v,
        nextStatementAt: START_TIME + DELAY,
        blocks: true,
        equivalent: {
          fromTable: true,
          lines: ["begin", "  temp = b;", `  #${DELAY} a = temp;`, "end"],
          note: "Table 9-3 row 1: the same timing written without intra-assignment timing.",
        },
        rule: `The right-hand side is evaluated before the delay and the assignment is made after it (§9.4.5): b is read at ${timeText(START_TIME)} (${v}) and a is written at ${timeText(START_TIME + DELAY)}. A blocking assignment finishes before the next statement runs (§10.4.1), so the process waits ${DELAY} time units.`,
      };
    }
    case "nonblocking-intra": {
      const v = valueAt("b", START_TIME);
      return {
        form,
        code: [code],
        rhs: "b",
        readAt: START_TIME,
        valueRead: v,
        writes: [{ time: START_TIME + DELAY, region: "NBA", value: v }],
        finalValue: v,
        nextStatementAt: START_TIME,
        blocks: false,
        equivalent: {
          fromTable: false,
          lines: [],
          note: "Table 9-3 lists only blocking forms. The nonblocking form reads b now, schedules the update for later and does not hold the process (§9.4.5, §10.4.2).",
        },
        rule: `b is read at ${timeText(START_TIME)} (${v}), before the delay (§9.4.5). The nonblocking assignment schedules the update ${DELAY} time units later without blocking the procedural flow (§10.4.2), so the next statement runs at ${timeText(START_TIME)} and a becomes ${v} at ${timeText(START_TIME + DELAY)}.`,
      };
    }
    case "delayed-statement": {
      const at = START_TIME + DELAY;
      const v = valueAt("b", at);
      return {
        form,
        code: [code],
        rhs: "b",
        readAt: at,
        valueRead: v,
        writes: [{ time: at, region: "Active", value: v }],
        finalValue: v,
        nextStatementAt: at,
        blocks: true,
        equivalent: {
          fromTable: false,
          lines: [],
          note: "This is the 'without' column's shape, not an intra-assignment control: the delay precedes the whole statement, so b is read after it.",
        },
        rule: `The delay #${DELAY} precedes the statement and delays its execution (§9.4.1; §9.4.5 contrasts this with intra-assignment timing), so b is read at ${timeText(at)}, after its change at t = 2, and a gets ${v}.`,
      };
    }
    case "nonblocking-repeat": {
      const rep = evaluateRepeatCount(count);
      const decl = REPEAT_COUNTS.find((c) => c.id === count)!.declaration;
      const v = valueAt("d", START_TIME);
      const time = rep.waits > 0 ? posedgeTime(rep.waits) : START_TIME;
      const waitsText =
        rep.waits > 0 ? `a becomes ${v} in the NBA region at ${timeText(time)}, rising edge ${rep.waits} of clk` : `a becomes ${v} in the NBA region of ${timeText(time)}`;
      const tableLines =
        count === "three"
          ? ["begin", "  temp = d;", "  @(posedge clk);", "  @(posedge clk);", "  @(posedge clk) a = temp;", "end"]
          : [];
      return {
        form,
        code: [decl, code],
        rhs: "d",
        readAt: START_TIME,
        valueRead: v,
        writes: [{ time, region: "NBA", value: v }],
        finalValue: v,
        nextStatementAt: START_TIME,
        blocks: false,
        repeat: rep,
        equivalent: {
          fromTable: count === "three",
          lines: tableLines,
          note:
            count === "three"
              ? "Table 9-3 row 3 is the blocking form a = repeat(3) @(posedge clk) b; (shown here with d). With <= the process does not wait for it (§10.4.2)."
              : rep.waits > 0
                ? `The same pattern with ${rep.waits} @(posedge clk) lines; the lab computes the count and does not simulate it.`
                : "No edge is waited for, so there is no event control to write out.",
        },
        rule: `${rep.note} d is read once, at ${timeText(START_TIME)} (${v}), before any edge (§9.4.5); a later change of d does not matter. ${waitsText}. The nonblocking assignment does not block (§10.4.2), so the next statement runs at ${timeText(START_TIME)}.`,
      };
    }
    case "nba-order":
    default:
      return {
        form: "nba-order",
        code: ["a <= 0;", "a <= 1;"],
        rhs: null,
        readAt: null,
        valueRead: null,
        writes: [
          { time: START_TIME, region: "NBA", value: 0 },
          { time: START_TIME, region: "NBA", value: 1 },
        ],
        finalValue: 1,
        nextStatementAt: START_TIME,
        blocks: false,
        equivalent: { fromTable: false, lines: [], note: "No timing control here: §4.6 b) fixes the order of the two updates." },
        rule: `Both updates go to the NBA region of ${timeText(START_TIME)} and are performed in the order the statements executed (§4.6 b): a is assigned 0 and then 1, so it ends at 1. Neither statement blocks (§10.4.2).`,
      };
  }
}

/**
 * One marker per write time, so same-time writes (a <= 0; a <= 1;) share one
 * diamond whose label gives them in the order they are performed (§4.6 b).
 */
export function writeMarkers(r: IntraResult): { time: number; label: string }[] {
  const times = [...new Set(r.writes.map((w) => w.time))];
  return times.map((time) => {
    const at = r.writes.filter((w) => w.time === time);
    return { time, label: `a = ${at.map((w) => w.value).join(", then ")} (${at[at.length - 1].region})` };
  });
}

/** Is the last write drawn on the axis, or only computed? */
export function writeOnAxis(r: IntraResult): boolean {
  return lastWrite(r).time <= AXIS_END;
}

export type ValueChoice = number | "race";

/** Value options: every value the read signal takes, or 0 / 1 / "either" for the order case. */
export function valueChoices(r: IntraResult): ValueChoice[] {
  if (r.rhs === null) return [0, 1, "race"];
  return STIMULUS[r.rhs].map((e) => e.value);
}

export const valueChoiceLabel = (c: ValueChoice) => (c === "race" ? "either: the order is not defined" : `a = ${c}`);

export function explainValueChoice(r: IntraResult, choice: ValueChoice): { correct: boolean; feedback: string } {
  const correct = choice === r.finalValue;
  if (correct) return { correct, feedback: r.rule };
  if (choice === "race") {
    return { correct, feedback: `The order is defined: §4.6 b) performs nonblocking updates in the order the statements executed, so a ends at ${r.finalValue}.` };
  }
  if (r.rhs === null) {
    return { correct, feedback: `${choice} is written first, but the second update is performed after it (§4.6 b), so a ends at ${r.finalValue}.` };
  }
  const when = STIMULUS[r.rhs].find((e) => e.value === choice)!;
  const readText = r.readAt === null ? "" : `${r.rhs} is read at ${timeText(r.readAt)}, when it holds ${r.valueRead}`;
  return {
    correct,
    feedback: `${choice} is the value ${r.rhs} holds from ${timeText(when.time)}. ${readText}. ${r.rule}`,
  };
}

export type TimeChoice = number | "later";

/** Fixed time options so the set of choices never hints at the answer. */
export const TIME_CHOICES: readonly TimeChoice[] = [0, 3, 5, 9, "later"];

export const timeChoiceLabel = (c: TimeChoice) => (c === "later" ? `later than ${timeText(AXIS_END)}` : timeText(c));

export function explainTimeChoice(r: IntraResult, choice: TimeChoice): { correct: boolean; feedback: string } {
  const correct = choice === r.nextStatementAt;
  const next = `The next statement runs at ${timeText(r.nextStatementAt)}.`;
  // Says why the process waits or not, and never which value a gets: this answer is shown before the value prediction.
  const why =
    r.form === "delayed-statement"
      ? `The delay #${DELAY} before the statement delays its execution by ${DELAY} time units (§9.4.1), and the statement after it follows in order.`
      : r.blocks
        ? `The intra-assignment delay holds the assignment for ${DELAY} time units, and a blocking assignment finishes before the statements after it run (§9.4.5, §10.4.1), so the process waits.`
        : r.form === "nba-order"
          ? "Nonblocking assignments schedule their updates without blocking the procedural flow (§10.4.2)."
          : "A nonblocking assignment schedules the update without blocking the procedural flow (§10.4.2), whatever its timing control.";
  // A count <= 0, x or z: the reading of §9.4.5 the lab follows, shown with the first answer too.
  const noRepeat = r.repeat !== undefined && r.repeat.waits === 0 ? ` ${NO_REPEAT_NOTE}` : "";
  if (correct) return { correct, feedback: `${next} ${why}${noRepeat}` };
  const w = lastWrite(r);
  const isWriteTime = choice === "later" ? w.time > AXIS_END : choice === w.time;
  const hint = isWriteTime && !r.blocks ? ` That is when a is written, not when the process moves on.` : "";
  return { correct, feedback: `${next}${hint} ${why}${noRepeat}` };
}

/** One line for the live region once both predictions are revealed. */
export function intraSummary(r: IntraResult): string {
  const w = lastWrite(r);
  const read = r.readAt === null ? "No right-hand side signal is read." : `${r.rhs} is read at ${timeText(r.readAt)} (${r.valueRead}).`;
  return `${r.code.join(" ")} ${read} a ends at ${r.finalValue}, written in the ${w.region} region at ${timeText(w.time)}. The next statement runs at ${timeText(r.nextStatementAt)}.`;
}

/* ========================================================================= */
/* Presets per lesson use                                                    */
/* ========================================================================= */

export type ExplorerMode = "events" | "intra" | "wake";

export interface LessonPreset {
  id: string;
  mode: ExplorerMode;
  /** Starting event drill preset (events), form (intra) or waiter (wake). */
  start: string;
}

export const LESSON_PRESETS: readonly LessonPreset[] = [
  { id: "f2c-timing-controls", mode: "events", start: "x-to-0-reset" },
  { id: "f2c-sensitivity-lists", mode: "events", start: "bus-lsb-unchanged" },
  { id: "f2c-intra-assignment", mode: "intra", start: "blocking-intra" },
  { id: "f3a-wake-rules", mode: "wake", start: "change-and" },
];

export function findLessonPreset(id: string | undefined): LessonPreset | undefined {
  return LESSON_PRESETS.find((p) => p.id === id);
}

export function findEventPreset(id: string | undefined): EventPreset | undefined {
  return EVENT_PRESETS.find((p) => p.id === id);
}
