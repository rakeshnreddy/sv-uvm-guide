/**
 * Region-trace exercises for F3B "Scheduling Regions": the worked example
 * ("Worked example: one time slot, region by region") and the kata ("Kata:
 * label the region"). Every answer is computed by the scheduler model in
 * sv-scheduler-model.ts; this file only holds the scenario data, the lesson's
 * code listings, and the grading and wording built on the model's runs.
 *
 * Rules taught (IEEE 1800-2023):
 * - §4.4.2.1 Preponed: samples are taken before anything in the slot changes;
 *   §16.5.1: a concurrent assertion reads those sampled values.
 * - §4.4.2.3 Inactive: an explicit #0 suspends a process into Inactive.
 * - §4.4.2.4 NBA: a nonblocking assignment's update happens there.
 * - §4.9.1: a continuous assignment is a process sensitive to its operands,
 *   and is also evaluated at time zero (why y = ~q is already 1 at the edge).
 * - §4.4.2.5 Observed: property expressions are evaluated there, and the
 *   pass/fail code is scheduled in Reactive; §4.4.2.6 Reactive: program code
 *   and assertion action blocks run there; §24.3.1: initial procedures in a
 *   program are scheduled in Reactive.
 * - §16.9.3: $sampled returns the sampled value wherever it is called.
 * - §4.4.2.9 Postponed: $strobe prints there.
 * - §20.2: $finish makes the simulator exit; §9.2.3: no remaining scheduled
 *   event executes after the final procedures. §24.3: when every program
 *   initial procedure has ended, the simulation ends by an implicit $finish.
 * - §4.7: events ready in Active or Reactive may run in any order, so REACT
 *   and ACTION may print either way round.
 *
 * Limits: the scheduler model explores the order of the processes ready in a
 * region (§4.7, first source), not interleaving inside a process, and models
 * one time slot (t = 5). Simulator banners and $finish's own message
 * (§20.2, Table 20-1) are not in the log.
 */

import { landingRegion } from "@/lib/sv-region-map-model";
import {
  REGION_LABELS,
  REGION_ORDER,
  exploreOrderings,
  formatPrintValue,
  simulateTimeSlot,
  type FinishCause,
  type RegionId,
  type SimulationResult,
  type Statement,
  type SvProcess,
  type SvScenario,
  type SvValue,
  type TraceStep,
} from "@/lib/sv-scheduler-model";

export type RegionTracePresetId = "f3b-worked-example" | "f3b-kata";
export const REGION_TRACE_PRESETS: readonly RegionTracePresetId[] = ["f3b-worked-example", "f3b-kata"];

/** The edge both lessons trace: `always #5 clk = ~clk` gives the first rising edge at t = 5. */
export const HALF_PERIOD = 5;
export const SLOT_TIME = HALF_PERIOD;
export const SLOT_LABEL = `t = ${SLOT_TIME}`;

// ---------------------------------------------------------------------------
// Shared scenario parts
// ---------------------------------------------------------------------------

const clockProcess = (): SvProcess => ({
  id: "CLK",
  label: "clock",
  owner: "testbench",
  context: "module",
  header: `always #${HALF_PERIOD}`,
  trigger: { kind: "resume", note: `the #${HALF_PERIOD} from t = 0 is over, and the next #${HALF_PERIOD} books t = ${SLOT_TIME + HALF_PERIOD}` },
  body: [{ kind: "assign", id: "k1", op: "blocking", target: "clk", expr: { kind: "inv", expr: { kind: "var", name: "clk" } } }],
});

const flopProcess = (): SvProcess => ({
  id: "FF",
  label: "always_ff",
  owner: "design",
  context: "module",
  header: "always_ff @(posedge clk)",
  trigger: { kind: "posedge", signal: "clk" },
  body: [{ kind: "assign", id: "f1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
});

// ---------------------------------------------------------------------------
// Worked example (lesson code, "Worked example: one time slot, region by region")
// ---------------------------------------------------------------------------

/**
 * The lesson's three "predict again" changes ("How to work through it",
 * steps 5 to 7), plus the bench as written.
 */
export type WorkedVariant = "as-written" | "finish-now" | "no-second-wait" | "plain-q";
export const WORKED_CHANGES: readonly Exclude<WorkedVariant, "as-written">[] = ["finish-now", "no-second-wait", "plain-q"];

export const WORKED_VARIANT_LABELS: Record<WorkedVariant, string> = {
  "as-written": "As written",
  "finish-now": "$finish without #1",
  "no-second-wait": "No second @(posedge clk) in tb_prog",
  "plain-q": "Plain q in the pass action",
};

/** The lesson step each change comes from. */
export const WORKED_VARIANT_STEPS: Record<Exclude<WorkedVariant, "as-written">, string> = {
  "finish-now": "Step 5: change #1 $finish; to $finish;",
  "no-second-wait": "Step 6: delete the second @(posedge clk); in tb_prog",
  "plain-q": "Step 7: print plain q instead of $sampled(q) in the pass action",
};

/** How the pass action reads q: as written ($sampled(q) and q), or plain q only (lesson step 7). */
type ActionRead = "as-written" | "plain" | "sampled-only";

function passAction(read: ActionRead): Statement {
  if (read === "plain") return { kind: "display", id: "a1", signals: [], label: "ACTION", showTime: true, args: [{ label: "q", expr: { kind: "var", name: "q" } }] };
  if (read === "sampled-only") return { kind: "display", id: "a1", signals: [], label: "ACTION", showTime: true, args: [{ label: "q", expr: { kind: "sampledFn", name: "q" } }] };
  return {
    kind: "display",
    id: "a1",
    signals: [],
    label: "ACTION",
    showTime: true,
    args: [
      { label: "$sampled(q)", expr: { kind: "sampledFn", name: "q" } },
      { label: "q", expr: { kind: "var", name: "q" } },
    ],
  };
}

function workedScenario(variant: WorkedVariant, read: ActionRead): SvScenario {
  return {
    id: variant === "as-written" ? "f3b-worked-example" : `f3b-worked-example-${variant}`,
    title: "One time slot, region by region",
    clock: "clk",
    clockSource: "process",
    slotTime: SLOT_TIME,
    timeUnit: "ns",
    // Declaration initializers (§6.8); y = q holds 0 from time zero (§4.9.1).
    initial: { clk: 0, d: 1, q: 0, y: 0 },
    watch: ["clk", "q", "y"],
    processes: [
      clockProcess(),
      flopProcess(),
      {
        id: "CA",
        label: "assign y",
        owner: "design",
        context: "module",
        header: "assign",
        trigger: { kind: "change", signals: ["q"] },
        body: [{ kind: "assign", id: "c1", op: "blocking", target: "y", expr: { kind: "var", name: "q" } }],
      },
      {
        id: "A",
        label: "a_q_was_low",
        owner: "testbench",
        context: "module",
        kind: "assertion",
        header: "a_q_was_low: assert property",
        trigger: { kind: "posedge", signal: "clk" },
        body: [],
        assertion: {
          property: { kind: "eq", left: { kind: "var", name: "q" }, right: { kind: "const", value: 0 } },
          pass: [passAction(read)],
          fail: [{ kind: "display", id: "a2", signals: [], label: "FAIL", showTime: true, task: "error", args: [{ label: "$sampled(q)", expr: { kind: "sampledFn", name: "q" } }] }],
        },
      },
      {
        id: "TB",
        label: "initial",
        owner: "testbench",
        context: "module",
        header: "initial @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [
          { kind: "display", id: "t1", signals: ["q", "y"], label: "ACTIVE", showTime: true },
          { kind: "delay0", id: "t2" },
          // Two spaces after INACT, POSTP and REACT, as in the lesson's format strings.
          { kind: "display", id: "t3", signals: ["q", "y"], label: "INACT ", showTime: true },
          { kind: "strobe", id: "t4", signals: ["q", "y"], label: "POSTP ", showTime: true },
          ...(variant === "finish-now" ? [] : [{ kind: "delay", id: "t5", units: 1 } as const]),
          { kind: "finish", id: "t6" },
        ],
      },
      {
        id: "PR",
        label: "tb_prog thread",
        owner: "testbench",
        context: "program",
        header: "initial @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [{ kind: "display", id: "r1", signals: ["q", "y"], label: "REACT ", showTime: true }],
        // lastThread is set by hand: this bench has one program initial, so when it ends every program
        // initial has ended (§24.3). A bench with more program threads would have to derive it.
        ...(variant === "no-second-wait" ? { lastThread: true } : { sourceTail: ["@(posedge clk);"] }),
      },
    ],
  };
}

/** The worked example's bench, or one of the lesson's three changes to it. */
export function workedExampleScenario(variant: WorkedVariant = "as-written"): SvScenario {
  return workedScenario(variant, variant === "plain-q" ? "plain" : "as-written");
}

export interface ListingLine {
  /** Stable key for highlighting; lines that no trace step points at have none. */
  key?: string;
  text: string;
  owner?: "design" | "testbench";
  /** The line differs from the bench as written. */
  changed?: boolean;
}

/** The lesson's code for the worked example, with the chosen change applied. */
export function workedExampleListing(variant: WorkedVariant = "as-written"): ListingLine[] {
  const actionLine: ListingLine =
    variant === "plain-q"
      ? { key: "a1", owner: "testbench", changed: true, text: '    $display("%0d ACTION q=%0d", $time, q);  // pass' }
      : { key: "a1", owner: "testbench", text: '    $display("%0d ACTION $sampled(q)=%0d q=%0d", $time, $sampled(q), q);  // pass' };
  const finishLine: ListingLine =
    variant === "finish-now"
      ? { key: "t6", owner: "testbench", changed: true, text: "    $finish;  // no #1: the run ends at t = 5" }
      : { key: "t6", owner: "testbench", text: "    #1 $finish;  // t = 6: a $finish at t = 5 would end the run before Postponed" };
  const lines: (ListingLine | null)[] = [
    { text: "module tb_top;" },
    { text: "  timeunit 1ns; timeprecision 1ns;" },
    { text: "" },
    { text: "  logic clk = 1'b0;" },
    { text: "  logic d   = 1'b1;" },
    { text: "  logic q   = 1'b0;  // declaration initializers run before any process starts (§6.8)" },
    { text: "  logic y;" },
    { text: "" },
    { key: "k1", owner: "testbench", text: "  always #5 clk = ~clk;                 // first rising edge at t = 5" },
    { text: "" },
    { key: "f1", owner: "design", text: "  always_ff @(posedge clk) q <= d;      // reads d in Active, writes q in NBA" },
    { key: "c1", owner: "design", text: "  assign y = q;                         // runs again in Active after q changes" },
    { text: "" },
    { text: "  // Samples q in Preponed, evaluates in Observed, runs its action blocks in Reactive." },
    { key: "a-prop", owner: "testbench", text: "  a_q_was_low: assert property (@(posedge clk) q == 1'b0)" },
    actionLine,
    { key: "a2", owner: "testbench", text: '    else $error("%0d FAIL $sampled(q)=%0d", $time, $sampled(q));         // fail' },
    { text: "" },
    { text: "  initial begin" },
    { key: "t-wait", owner: "testbench", text: "    @(posedge clk);                                        // t = 5, Active" },
    { key: "t1", owner: "testbench", text: '    $display("%0d ACTIVE q=%0d y=%0d", $time, q, y);       // Active: before NBA' },
    { key: "t3", owner: "testbench", text: '    #0 $display("%0d INACT  q=%0d y=%0d", $time, q, y);    // Inactive: still before NBA' },
    { key: "t4", owner: "testbench", text: '    $strobe("%0d POSTP  q=%0d y=%0d", $time, q, y);        // printed in Postponed' },
    finishLine,
    { text: "  end" },
    { text: "" },
    { text: "  // Nested program without ports: it reads tb_top's q and y directly." },
    { text: "  program tb_prog;" },
    { text: "    timeunit 1ns; timeprecision 1ns;" },
    { text: "    initial begin" },
    { key: "r-wait", owner: "testbench", text: "      @(posedge clk);                                      // resumes in Reactive" },
    { key: "r1", owner: "testbench", text: '      $display("%0d REACT  q=%0d y=%0d", $time, q, y);' },
    variant === "no-second-wait" ? null : { key: "r-tail", owner: "testbench", text: "      @(posedge clk);  // stay alive: when all program initials end, $finish is implicit" },
    { text: "    end" },
    { text: "  endprogram" },
    { text: "endmodule" },
  ];
  return lines.filter((l): l is ListingLine => l !== null);
}

// ---------------------------------------------------------------------------
// Prints: the chips the learner orders
// ---------------------------------------------------------------------------

export interface PrintChip {
  /** The print statement's id in the scenario. */
  id: string;
  /** The word the line prints (ACTIVE, A, ...). */
  name: string;
  /** Which code prints it; no value, so a chip never answers the prediction. */
  source: string;
}

export const WORKED_PRINTS: readonly PrintChip[] = [
  { id: "t1", name: "ACTIVE", source: "$display in the initial, before #0" },
  { id: "t3", name: "INACT", source: "$display in the initial, after #0" },
  { id: "t4", name: "POSTP", source: "$strobe in the initial" },
  { id: "r1", name: "REACT", source: "$display in the tb_prog thread" },
  { id: "a1", name: "ACTION", source: "pass action of a_q_was_low" },
];

const nameOf = (prints: readonly PrintChip[], id: string) => prints.find((p) => p.id === id)?.name ?? id;

/** "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What the line prints, without the model's "$display: " task prefix. */
export function printedText(logLine: string): string {
  return logLine.replace(/^\$\w+: /, "");
}

export interface PrintedLine {
  stmtId: string;
  text: string;
  /** Region the print was scheduled in (§4.4.2). */
  region: RegionId;
  stepIndex: number;
}

/** The lines a run printed, in order, each with the statement that printed it. */
export function printedLines(run: SimulationResult): PrintedLine[] {
  return run.trace
    .filter((s) => s.kind === "print" && s.stmtId)
    // A print step appends its line to the log, so the line is the log's last entry at that step.
    .map((s) => ({ stmtId: s.stmtId as string, text: printedText(s.log[s.log.length - 1] ?? ""), region: landingRegion(s), stepIndex: s.index }));
}

/** One representative run per distinct outcome, with its print order. */
export interface ExploredOutcome {
  /** Print statement ids in the order they printed. */
  order: string[];
  lines: string[];
  runCount: number;
  run: SimulationResult;
  finalValues: Record<string, SvValue>;
}

export interface ExploredScenario {
  outcomes: ExploredOutcome[];
  runCount: number;
}

/** Every order of the ready processes the scheduler model runs (§4.7), grouped by outcome. */
export function exploreScenario(scenario: SvScenario): ExploredScenario {
  const explored = exploreOrderings(scenario);
  const outcomes = explored.outcomes.map((o) => {
    const run = simulateTimeSlot(scenario, o.runs[0].choices);
    const printed = printedLines(run);
    return { order: printed.map((p) => p.stmtId), lines: o.log.map(printedText), runCount: o.runs.length, run, finalValues: o.finalValues };
  });
  return { outcomes, runCount: explored.runCount };
}

/** The distinct print orders the model finds legal. */
export function legalPrintOrders(scenario: SvScenario): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const o of exploreScenario(scenario).outcomes) {
    const key = o.order.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o.order);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ordering the log
// ---------------------------------------------------------------------------

/** The clause that defines each region (IEEE 1800-2023 §4.4.2.1 to §4.4.2.9). */
export const REGION_CLAUSES: Record<RegionId, string> = {
  preponed: "§4.4.2.1",
  active: "§4.4.2.2",
  inactive: "§4.4.2.3",
  nba: "§4.4.2.4",
  observed: "§4.4.2.5",
  reactive: "§4.4.2.6",
  reInactive: "§4.4.2.7",
  reNba: "§4.4.2.8",
  postponed: "§4.4.2.9",
};

/** What grading a log order needs from the model: every legal print order, and the region each line prints in. */
export interface LogOrderKey {
  legal: string[][];
  /** Region each print statement printed in, from the model's runs. */
  regions: Record<string, RegionId>;
}

/** The legal print orders of a scenario and the region of each print, both from the model's runs. */
export function logOrderKey(scenario: SvScenario): LogOrderKey {
  const regions: Record<string, RegionId> = {};
  const seen = new Set<string>();
  const legal: string[][] = [];
  // One exploration gives both: the distinct print orders and the region of each print.
  for (const o of exploreScenario(scenario).outcomes) {
    for (const p of printedLines(o.run)) regions[p.stmtId] ??= p.region;
    const k = o.order.join(",");
    if (!seen.has(k)) {
      seen.add(k);
      legal.push(o.order);
    }
  }
  return { legal, regions };
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const countWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** "The model finds two legal print orders: ...", from the model's legal orders. */
export function legalOrdersText(legal: readonly (readonly string[])[], prints: readonly PrintChip[]): string {
  const names = (l: readonly string[]) => l.map((id) => nameOf(prints, id)).join(", ");
  return legal.length === 1
    ? `The model finds one legal print order: ${names(legal[0])}.`
    : `The model finds ${countWord(legal.length)} legal print orders: ${legal.map(names).join("; or ")}.`;
}

/** Ids of one longest common subsequence of `a` and `b` (the chips already in the right relative order). */
export function longestCommonSubsequence(a: readonly string[], b: readonly string[]): string[] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return out;
}

export interface OrderGrade {
  correct: boolean;
  /** The legal order the learner's order is closest to (the longest run of chips already in the right relative order). */
  closest: string[];
  /** Only the chips outside that common run are wrong, so one misplaced chip marks one chip. */
  marks: Record<string, "correct" | "wrong">;
  /** Why each wrong chip belongs elsewhere, from the region it prints in. */
  reasons: Record<string, string>;
  /** The legal orders, as a sentence, from the model. */
  legalText: string;
  /** Generated from the model's legal orders and print regions. */
  feedback: string;
}

/**
 * Why a misplaced chip goes where the closest legal order puts it: the region
 * it prints in, and the chips it must follow or precede because they print in
 * an earlier or later region. Only pairs whose region order agrees with the
 * legal order are given as reasons, so the sentence never contradicts the model.
 */
function chipReason(id: string, order: readonly string[], closest: readonly string[], key: LogOrderKey, prints: readonly PrintChip[]): string {
  const region = key.regions[id];
  const name = nameOf(prints, id);
  if (!region) return `${name} does not print in this slot.`;
  const rank = (r: RegionId) => REGION_ORDER.indexOf(r);
  const at = (l: readonly string[], x: string) => l.indexOf(x);
  const after: string[] = [];
  const before: string[] = [];
  for (const other of closest) {
    const r = key.regions[other];
    if (other === id || !r || r === region || at(order, other) < 0) continue;
    const legalBefore = at(closest, other) < at(closest, id);
    const learnerBefore = at(order, other) < at(order, id);
    if (legalBefore === learnerBefore) continue;
    if (legalBefore && rank(r) < rank(region)) after.push(`${nameOf(prints, other)} (${REGION_LABELS[r]})`);
    if (!legalBefore && rank(r) > rank(region)) before.push(`${nameOf(prints, other)} (${REGION_LABELS[r]})`);
  }
  const place = rank(region) === REGION_ORDER.length - 1 ? ", the last region of the slot" : rank(region) === 0 ? ", the first region of the slot" : "";
  const parts = [after.length ? `after ${joinNames(after)}` : "", before.length ? `before ${joinNames(before)}` : ""].filter(Boolean);
  return `${name} prints in ${REGION_LABELS[region]}${place} (${REGION_CLAUSES[region]})${parts.length ? `, so it comes ${parts.join(" and ")}` : ""}.`;
}

/** Grades a print order against every order the model found legal. */
export function gradeLogOrder(order: readonly string[], key: LogOrderKey, prints: readonly PrintChip[]): OrderGrade {
  const { legal } = key;
  if (legal.length === 0) throw new Error("No legal order to grade against");
  let closest = legal[0];
  let kept = longestCommonSubsequence(order, closest);
  for (const l of legal.slice(1)) {
    const common = longestCommonSubsequence(order, l);
    if (common.length > kept.length) {
      closest = l;
      kept = common;
    }
  }
  const correct = legal.some((l) => l.length === order.length && l.every((id, i) => order[i] === id));
  const keptSet = new Set(kept);
  const marks: Record<string, "correct" | "wrong"> = {};
  order.forEach((id) => {
    marks[id] = keptSet.has(id) && closest.includes(id) ? "correct" : "wrong";
  });
  const wrongIds = order.filter((id) => marks[id] === "wrong");
  const reasons: Record<string, string> = Object.fromEntries(wrongIds.map((id) => [id, chipReason(id, order, closest, key, prints)]));
  const legalText = legalOrdersText(legal, prints);
  const wrong = wrongIds.map((id) => nameOf(prints, id));
  // An order with every chip in place can still be short of a legal order: then say which lines are missing.
  const missing = closest.filter((id) => !order.includes(id)).map((id) => nameOf(prints, id));
  const problem = [
    wrong.length ? `${joinNames(wrong)} ${wrong.length === 1 ? "is" : "are"} out of place.` : "",
    missing.length ? `${joinNames(missing)} ${missing.length === 1 ? "is" : "are"} missing.` : "",
    ...wrongIds.map((id) => reasons[id]),
  ].filter(Boolean);
  const feedback = correct ? `Correct. ${legalText}` : `Not quite: ${problem.join(" ")} ${legalText}`;
  return { correct, closest: [...closest], marks, reasons, legalText, feedback };
}

/** The legal print order the lesson's trace table follows (REACT before ACTION), from the model's run. */
export function workedLessonPrintOrder(): string[] {
  return printedLines(workedLessonRun()).map((p) => p.stmtId);
}

/**
 * A starting order for the chips that is not a legal order: the chips sorted
 * by name, rotated until no legal order matches, so the starting arrangement
 * never gives the answer away.
 */
export function startingChipOrder(prints: readonly PrintChip[], legal: readonly (readonly string[])[]): string[] {
  const base = [...prints].sort((a, b) => a.name.localeCompare(b.name)).map((p) => p.id);
  const isLegal = (o: string[]) => legal.some((l) => l.join() === o.join());
  for (let shift = 0; shift < base.length; shift += 1) {
    const candidate = [...base.slice(shift), ...base.slice(0, shift)];
    if (!isLegal(candidate)) return candidate;
  }
  return base;
}

// ---------------------------------------------------------------------------
// The lesson's trace table (worked example, steps 0 to 10)
// ---------------------------------------------------------------------------

interface TraceRowSpec {
  step: number;
  /** Region the row's events were scheduled in. */
  region: RegionId;
  /** The process the row's steps belong to; none means every step of the region. */
  processId?: string;
  what: string;
  codeKey: string;
  contextKeys?: string[];
}

/** The lesson's trace table, row by row (the "What runs" column). */
const WORKED_TRACE_SPECS: readonly TraceRowSpec[] = [
  { step: 0, region: "preponed", what: "Samples are taken; the assertion will use the sampled q.", codeKey: "a-prop" },
  { step: 1, region: "active", processId: "CLK", what: "The clock process sets clk to 1. That wakes always_ff, the initial, the assertion's clock and the program thread.", codeKey: "k1" },
  { step: 2, region: "active", processId: "FF", what: "always_ff reads d and schedules the update of q.", codeKey: "f1" },
  { step: 3, region: "active", processId: "TB", what: "The initial prints, then #0 suspends it.", codeKey: "t1", contextKeys: ["t-wait", "t3"] },
  { step: 4, region: "inactive", what: "The initial resumes and prints; $strobe is queued for Postponed; #1 schedules t = 6.", codeKey: "t3", contextKeys: ["t4", "t6"] },
  { step: 5, region: "nba", what: "q takes its new value; the update wakes assign y = q.", codeKey: "f1" },
  { step: 6, region: "active", processId: "CA", what: "The continuous assignment updates y.", codeKey: "c1" },
  { step: 7, region: "observed", what: "a_q_was_low is evaluated on the sampled q and passes; its pass action goes to Reactive.", codeKey: "a-prop" },
  { step: 8, region: "reactive", processId: "PR", what: "The program thread prints, then waits for the next edge.", codeKey: "r1", contextKeys: ["r-wait", "r-tail"] },
  { step: 9, region: "reactive", processId: "A", what: "The pass action prints the sample and the current value.", codeKey: "a1" },
  { step: 10, region: "postponed", what: "$strobe prints the settled values.", codeKey: "t4" },
];

export interface TraceRow {
  step: number;
  region: RegionId;
  what: string;
  codeKey: string;
  contextKeys: string[];
  /** Values after the row, from the model. */
  q: SvValue;
  y: SvValue;
  /** Lines printed in the row, from the model. */
  prints: string[];
  /** Model trace steps the row stands for. */
  modelSteps: number[];
}

const rowOf = (step: TraceStep): number => {
  const region = landingRegion(step);
  const spec = WORKED_TRACE_SPECS.find((r) => r.region === region && (!r.processId || r.processId === step.processId));
  if (!spec) throw new Error(`Model step ${step.index} (${step.kind} in ${REGION_LABELS[region]}) matches no row of the lesson's trace`);
  return spec.step;
};

/**
 * The run the lesson's table follows: always_ff before the initial in Active
 * (steps 2 and 3) and the program thread before the pass action in Reactive
 * (steps 8 and 9). Found among the model's runs, not typed in.
 */
export function workedLessonRun(): SimulationResult {
  const scenario = workedExampleScenario();
  const explored = exploreOrderings(scenario);
  for (const o of explored.outcomes) {
    for (const r of o.runs) {
      const run = simulateTimeSlot(scenario, r.choices);
      const rows = run.trace.map(rowOf);
      if (rows.every((row, i) => i === 0 || row >= rows[i - 1])) return run;
    }
  }
  throw new Error("No run of the model follows the lesson's trace order");
}

/** The lesson's eleven trace rows, with values and prints taken from the model's run. */
export function workedTraceRows(): TraceRow[] {
  const run = workedLessonRun();
  const printed = printedLines(run);
  return WORKED_TRACE_SPECS.map((spec) => {
    const steps = run.trace.filter((s) => rowOf(s) === spec.step);
    const last = steps[steps.length - 1];
    return {
      step: spec.step,
      region: spec.region,
      what: spec.what,
      codeKey: spec.codeKey,
      contextKeys: spec.contextKeys ?? [],
      q: last.values.q,
      y: last.values.y,
      prints: printed.filter((p) => steps.some((s) => s.index === p.stepIndex)).map((p) => p.text),
      modelSteps: steps.map((s) => s.index),
    };
  });
}

export interface ExcerptLine {
  /** 1-based line number in the full listing, as the listing panel numbers it. */
  number: number;
  text: string;
  active: boolean;
}

/**
 * The lines a trace row points at (the active line and its context lines), in
 * listing order with their line numbers: a compact view of the code for narrow
 * screens, where the full listing is already shown above.
 */
export function listingExcerpt(lines: readonly ListingLine[], activeKey: string, contextKeys: readonly string[] = []): ExcerptLine[] {
  return lines
    .map((l, i) => ({ line: l, number: i + 1 }))
    .filter(({ line }) => line.key !== undefined && (line.key === activeKey || contextKeys.includes(line.key)))
    .map(({ line, number }) => ({ number, text: line.text.trim(), active: line.key === activeKey }));
}

/** One sentence per row for the live region and the scrubber's value text. */
export function traceRowSummary(row: TraceRow): string {
  const printed = row.prints.length ? ` Prints ${row.prints.join(" and ")}.` : "";
  return `Step ${row.step}, ${REGION_LABELS[row.region]}: ${row.what} After it, q = ${formatPrintValue(row.q)} and y = ${formatPrintValue(row.y)}.${printed}`;
}

// ---------------------------------------------------------------------------
// Which lines survive a change
// ---------------------------------------------------------------------------

export type Survival = "always" | "some-orders" | "never";

/** For each print: printed in every order the model runs, in some, or in none. */
export function survivalOf(scenario: SvScenario, prints: readonly PrintChip[]): Record<string, Survival> {
  const { outcomes } = exploreScenario(scenario);
  const out: Record<string, Survival> = {};
  for (const p of prints) {
    const count = outcomes.filter((o) => o.order.includes(p.id)).length;
    out[p.id] = count === outcomes.length ? "always" : count === 0 ? "never" : "some-orders";
  }
  return out;
}

export interface FinishPoint {
  cause: FinishCause;
  /** Region the ending event was scheduled in (a resumed #0 is an Inactive event, §4.4.2.3). */
  region: RegionId;
  processLabel: string;
  /** The row of the lesson's trace table where the run ends. */
  traceStep: number;
}

/** Where the run ends inside the slot, one entry per distinct ending; empty when the slot runs to the end. */
export function finishPoints(scenario: SvScenario): FinishPoint[] {
  const seen = new Set<string>();
  const out: FinishPoint[] = [];
  for (const o of exploreScenario(scenario).outcomes) {
    const f = o.run.finished;
    if (!f) continue;
    const label = scenario.processes.find((p) => p.id === f.processId)?.label ?? f.processId;
    const step = o.run.trace[f.stepIndex];
    const region = landingRegion(step);
    const key = `${f.cause}|${region}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ cause: f.cause, region, processLabel: label, traceStep: rowOf(step) });
  }
  return out;
}

const survivalText = (survival: Record<string, Survival>, prints: readonly PrintChip[]): string => {
  const by = (s: Survival) => prints.filter((p) => survival[p.id] === s).map((p) => p.name);
  const parts = [
    by("always").length ? `printed in every order: ${joinNames(by("always"))}` : "",
    by("some-orders").length ? `printed only in some orders: ${joinNames(by("some-orders"))}` : "",
    by("never").length ? `never printed: ${joinNames(by("never"))}` : "",
  ].filter(Boolean);
  const text = parts.join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The ACTION line a scenario prints (the first outcome's), or undefined. */
export function actionLine(scenario: SvScenario): string | undefined {
  for (const o of exploreScenario(scenario).outcomes) {
    const line = printedLines(o.run).find((p) => p.stmtId === "a1");
    if (line) return line.text;
  }
  return undefined;
}

/** The value of q the assertion sampled in Preponed (§16.5.1), from the model's sample step. */
export function assertionSample(scenario: SvScenario, signal: string): SvValue {
  const run = simulateTimeSlot(scenario);
  const sample = run.trace.find((s) => s.kind === "sample" && s.processId === "A");
  if (!sample) throw new Error(`${scenario.id} takes no assertion sample`);
  return sample.values[signal];
}

/** A process label as a phrase: the module's "initial" reads as "initial procedure". */
const processPhrase = (label: string) => (label === "initial" ? "initial procedure" : label);

/** What a change does to the run, generated from the model (shown after the reveal). */
export function variantOutcomeText(variant: WorkedVariant): string {
  const scenario = workedExampleScenario(variant);
  const survival = survivalOf(scenario, WORKED_PRINTS);
  const ends = finishPoints(scenario);
  const endText = ends.length
    ? ends
        .map((e) =>
          e.cause === "finish"
            ? `$finish in the ${processPhrase(e.processLabel)} ends the run during the ${REGION_LABELS[e.region]} pass, at trace step ${e.traceStep}, and no remaining scheduled event executes (§20.2, §9.2.3).`
            : `When the ${e.processLabel} ends, every program initial has ended, so an implicit $finish ends the run in ${REGION_LABELS[e.region]}, at trace step ${e.traceStep} (§24.3), and no remaining scheduled event executes (§9.2.3).`,
        )
        .join(" ")
    : "Nothing ends the run inside this slot, so Postponed still runs.";
  let actionText = "";
  if (variant === "plain-q") {
    const line = actionLine(scenario);
    const sample = formatPrintValue(assertionSample(scenario, "q"));
    actionText = ` The pass action prints ${line}: a plain read returns the value current when the action runs in Reactive (§4.4.2.6, §16.14.1), although the property passed on the sample q = ${sample} (§16.5.1). $sampled(q) would print the sample (§16.9.3).`;
  }
  return `${endText} ${survivalText(survival, WORKED_PRINTS)}.${actionText}`;
}

export interface VariantOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
  /** Which lines the option claims print. */
  survival: Record<string, Survival>;
}

interface VariantOptionSpec {
  id: string;
  survival: Record<string, Survival>;
  /** For the plain-q change: the ACTION line this option claims. */
  action?: string;
  /** A label for an option the survival list alone cannot say. */
  label?: string;
  feedback: string;
}

const allFive = (s: Survival): Record<string, Survival> => Object.fromEntries(WORKED_PRINTS.map((p) => [p.id, s]));
const survivalSet = (always: string[], some: string[] = []): Record<string, Survival> =>
  Object.fromEntries(WORKED_PRINTS.map((p) => [p.id, always.includes(p.id) ? "always" : some.includes(p.id) ? "some-orders" : "never"]));

const optionLabel = (spec: VariantOptionSpec): string => {
  const always = WORKED_PRINTS.filter((p) => spec.survival[p.id] === "always").map((p) => p.name);
  const some = WORKED_PRINTS.filter((p) => spec.survival[p.id] === "some-orders").map((p) => p.name);
  const lines = always.length === WORKED_PRINTS.length ? "All five lines" : joinNames(always);
  const someText = some.length ? `, and ${joinNames(some)} only in some orders` : "";
  const actionText = spec.action ? `; the ACTION line reads "${spec.action}"` : "";
  return `${lines}${someText}${actionText}`;
};

function variantSpecs(variant: Exclude<WorkedVariant, "as-written">): VariantOptionSpec[] {
  if (variant === "finish-now") {
    return [
      {
        id: "two",
        survival: survivalSet(["t1", "t3"]),
        feedback: "$finish now runs in the Inactive pass, right after $strobe is called. The simulator exits at once (§20.2), and no remaining scheduled event executes (§9.2.3), so NBA, Observed, Reactive and Postponed never get their turn.",
      },
      {
        id: "with-strobe",
        survival: survivalSet(["t1", "t3", "t4"]),
        feedback: "$strobe was called before $finish, but its print is an event of Postponed. After $finish no remaining scheduled event executes (§9.2.3), so the queued print never happens.",
      },
      {
        id: "all",
        survival: allFive("always"),
        feedback: "$finish does not wait for the slot to settle: the simulator exits when it runs (§20.2), and no remaining scheduled event executes (§9.2.3).",
      },
    ];
  }
  if (variant === "no-second-wait") {
    return [
      {
        id: "action-sometimes",
        survival: survivalSet(["t1", "t3", "r1"], ["a1"]),
        feedback: "The only program thread now ends right after REACT, so an implicit $finish ends the run at once (§24.3). REACT and ACTION are both ready in Reactive and may run in either order (§4.7): ACTION prints only if it ran first, and POSTP never prints (§9.2.3).",
      },
      {
        id: "all",
        survival: allFive("always"),
        feedback: "The implicit $finish comes immediately after the last program thread ends (§24.3); it does not wait for Postponed, so POSTP is lost (§9.2.3).",
      },
      {
        id: "action-always",
        survival: survivalSet(["t1", "t3", "r1", "a1"]),
        feedback: "Nothing makes the pass action run before the program thread: both are ready in Reactive, and §4.7 leaves their order open. When REACT runs first, the implicit $finish comes before ACTION (§24.3).",
      },
      {
        id: "action-never",
        survival: survivalSet(["t1", "t3", "r1"]),
        feedback: "ACTION is not always after REACT: both are ready in Reactive and may run in either order (§4.7). When ACTION runs first, it prints before the implicit $finish.",
      },
    ];
  }
  const scenario = workedExampleScenario("plain-q");
  const sampledLine = actionLine(workedScenario("plain-q", "sampled-only"));
  return [
    {
      id: "current",
      survival: allFive("always"),
      action: actionLine(scenario),
      feedback: "The property is still evaluated on the sample (§16.5.1), so it passes and nothing else changes. The action block runs in Reactive (§4.4.2.6, §16.14.1), after the NBA update, and a plain read there returns the current q.",
    },
    {
      id: "sample",
      survival: allFive("always"),
      action: sampledLine,
      feedback: "Only $sampled() returns the Preponed sample (§16.9.3). A plain read in the action block returns the value current in Reactive, after the NBA update (§4.4.2.6, §16.14.1).",
    },
    {
      id: "fails",
      survival: survivalSet(["t1", "t3", "r1", "t4"]),
      label: "The check now fails: ACTION does not print, and the else branch prints FAIL",
      feedback: "The property is unchanged and still reads the sampled q (§16.5.1), so it still passes and the pass action still prints. Only the message changes.",
    },
  ];
}

const sameSurvival = (a: Record<string, Survival>, b: Record<string, Survival>) => WORKED_PRINTS.every((p) => a[p.id] === b[p.id]);

/** The "which lines survive?" options for a change, each graded against the model. */
export function variantOptions(variant: Exclude<WorkedVariant, "as-written">): VariantOption[] {
  const scenario = workedExampleScenario(variant);
  const survival = survivalOf(scenario, WORKED_PRINTS);
  const action = variant === "plain-q" ? actionLine(scenario) : undefined;
  return variantSpecs(variant).map((spec) => ({
    id: spec.id,
    label: spec.label ?? optionLabel(spec),
    correct: sameSurvival(spec.survival, survival) && spec.action === action,
    feedback: spec.feedback,
    survival: spec.survival,
  }));
}

// ---------------------------------------------------------------------------
// Outcome groups (for OutcomeGroups)
// ---------------------------------------------------------------------------

export interface OutcomeCard {
  id: string;
  title: string;
  runCount: number;
  lines: { time: string; text: string }[];
  endState: string;
}

/** The model's outcome groups as cards, each titled by the print that comes first where they differ. */
export function outcomeCards(scenario: SvScenario, prints: readonly PrintChip[]): { cards: OutcomeCard[]; runCount: number } {
  const { outcomes, runCount } = exploreScenario(scenario);
  let divergent = 0;
  if (outcomes.length > 1) {
    const longest = Math.max(...outcomes.map((o) => o.order.length));
    while (divergent < longest && outcomes.every((o) => o.order[divergent] === outcomes[0].order[divergent])) divergent += 1;
  }
  const cards = outcomes.map((o, i) => {
    const missing = prints.filter((p) => !o.order.includes(p.id)).map((p) => p.name);
    const missingText = missing.length ? `${joinNames(missing)} ${missing.length === 1 ? "does" : "do"} not print` : "";
    const title =
      outcomes.length > 1 ? [`${nameOf(prints, o.order[divergent])} first`, missingText].filter(Boolean).join("; ") : missingText ? missingText.charAt(0).toUpperCase() + missingText.slice(1) : "Every line prints";
    return {
      id: `outcome-${i}`,
      title,
      runCount: o.runCount,
      lines: o.lines.map((text) => ({ time: SLOT_LABEL, text })),
      endState: `q = ${formatPrintValue(o.finalValues.q)}, y = ${formatPrintValue(o.finalValues.y)}`,
    };
  });
  return { cards, runCount };
}

// ---------------------------------------------------------------------------
// Kata ("Kata: label the region")
// ---------------------------------------------------------------------------

/** The kata snippet with `assign y = ~q;` and the a_y_high assertion; `sampledY` prints $sampled(y) on L6 (requirement 4). */
export function kataScenario(sampledY = false): SvScenario {
  return {
    id: sampledY ? "f3b-kata-sampled" : "f3b-kata",
    title: "Kata: label the region",
    clock: "clk",
    clockSource: "process",
    slotTime: SLOT_TIME,
    timeUnit: "ns",
    // y = ~q has held 1 since time zero: a continuous assignment is evaluated at time zero (§4.9.1).
    initial: { clk: 0, d: 1, q: 0, y: 1 },
    watch: ["clk", "q", "y"],
    processes: [
      clockProcess(),
      flopProcess(),
      {
        id: "CA",
        label: "assign y",
        owner: "design",
        context: "module",
        header: "assign",
        trigger: { kind: "change", signals: ["q"] },
        body: [{ kind: "assign", id: "c1", op: "blocking", target: "y", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }],
      },
      {
        id: "TB",
        label: "initial",
        owner: "testbench",
        context: "module",
        header: "initial @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [
          { kind: "display", id: "k3", signals: ["q", "y"], label: "A" },
          { kind: "delay0", id: "k4-wait" },
          { kind: "display", id: "k4", signals: ["q", "y"], label: "B" },
          { kind: "strobe", id: "k5", signals: ["q", "y"], label: "C" },
          { kind: "delay", id: "k5-wait", units: 1 },
          { kind: "finish", id: "k-finish" },
        ],
      },
      {
        id: "A",
        label: "a_y_high",
        owner: "testbench",
        context: "module",
        kind: "assertion",
        header: "a_y_high: assert property",
        trigger: { kind: "posedge", signal: "clk" },
        body: [],
        assertion: {
          property: { kind: "eq", left: { kind: "var", name: "y" }, right: { kind: "const", value: 1 } },
          pass: [{ kind: "display", id: "k6", signals: [], label: "D", args: [{ label: "y", expr: sampledY ? { kind: "sampledFn", name: "y" } : { kind: "var", name: "y" } }] }],
        },
      },
    ],
  };
}

export type KataLineId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export const KATA_LINE_IDS: readonly KataLineId[] = ["L1", "L2", "L3", "L4", "L5", "L6"];

interface KataLineSpec {
  id: KataLineId;
  /** Statements on the line. */
  stmtIds: string[];
  /** A concurrent assertion on the line: its sample and evaluation belong to it too. */
  assertionId?: string;
  /** Why, in words; the regions themselves come from the model. */
  reason: string;
}

const KATA_LINES: readonly KataLineSpec[] = [
  { id: "L1", stmtIds: ["f1"], reason: "always_ff runs on the edge in Active (§4.4.2.2), reads d and schedules the update; q takes the new value in NBA (§4.4.2.4)." },
  { id: "L2", stmtIds: ["c1"], reason: "y was already 1, because a continuous assignment is also evaluated at time zero (§4.9.1). The NBA update of q wakes it, and it reads q and writes y in Active, on a later pass of the loop." },
  { id: "L3", stmtIds: ["k3"], reason: "The initial resumes on the edge in Active (§4.4.2.2) and prints at once." },
  { id: "L4", stmtIds: ["k4"], reason: "#0 suspends the initial into Inactive (§4.4.2.3); it prints when it resumes there." },
  { id: "L5", stmtIds: ["k5"], reason: "$strobe is called in the Inactive pass, but it reads q and y and prints in Postponed (§4.4.2.9), after every change in the slot." },
  { id: "L6", stmtIds: ["k6"], assertionId: "A", reason: "The assertion samples y in Preponed (§16.5.1), evaluates the property in Observed (§4.4.2.5) and runs its pass action in Reactive (§4.4.2.6, §16.14.1)." },
];

export const KATA_PRINTS: readonly PrintChip[] = [
  { id: "k3", name: "A", source: "L3, $display" },
  { id: "k4", name: "B", source: "L4, $display after #0" },
  { id: "k5", name: "C", source: "L5, $strobe" },
  { id: "k6", name: "D", source: "L6, pass action of a_y_high" },
];

/** The lesson's kata code; L6 prints $sampled(y) when `sampledY` is set. */
export function kataListing(sampledY = false): ListingLine[] {
  return [
    { text: "// inside a module with timeunit 1ns; timeprecision 1ns; and" },
    { text: "//   logic clk = 1'b0, d = 1'b1, q = 1'b0; logic y; always #5 clk = ~clk;" },
    { key: "L1", owner: "design", text: "always_ff @(posedge clk) q <= d;  // L1" },
    { key: "L2", owner: "design", text: "assign y = ~q;                    // L2" },
    { text: "initial begin" },
    { text: "  @(posedge clk);" },
    { key: "L3", owner: "testbench", text: '  $display("A q=%0d y=%0d", q, y);    // L3' },
    { key: "L4", owner: "testbench", text: '  #0 $display("B q=%0d y=%0d", q, y); // L4' },
    { key: "L5", owner: "testbench", text: '  $strobe("C q=%0d y=%0d", q, y);     // L5' },
    { text: "  #1 $finish;" },
    { text: "end" },
    { key: "L6-prop", owner: "testbench", text: "a_y_high: assert property (@(posedge clk) y == 1'b1)" },
    sampledY
      ? { key: "L6", owner: "testbench", changed: true, text: '  $display("D y=%0d", $sampled(y));     // L6' }
      : { key: "L6", owner: "testbench", text: '  $display("D y=%0d", y);               // L6' },
  ];
}

/** Steps that read, write or print (a $strobe call itself does neither; its print does). */
function touchesLine(step: TraceStep, spec: KataLineSpec, scenario: SvScenario): boolean {
  if (spec.assertionId && step.processId === spec.assertionId && (step.kind === "sample" || step.assertion?.phase === "evaluate")) return true;
  if (!step.stmtId || !spec.stmtIds.includes(step.stmtId)) return false;
  if (step.kind === "print" || step.kind === "update") return true;
  if (step.kind !== "statement") return false;
  const stmt = scenario.processes.flatMap((p) => [...p.body, ...(p.assertion?.pass ?? [])]).find((s) => s.id === step.stmtId);
  return stmt?.kind === "assign" || stmt?.kind === "display";
}

/** The regions where each kata line reads, writes or prints, in region order, from every run the model explores. */
export function kataExpectedRegions(sampledY = false): Record<KataLineId, RegionId[]> {
  const scenario = kataScenario(sampledY);
  const out = {} as Record<KataLineId, RegionId[]>;
  const { outcomes } = exploreScenario(scenario);
  for (const spec of KATA_LINES) {
    const regions = new Set<RegionId>();
    for (const o of outcomes) for (const step of o.run.trace) if (touchesLine(step, spec, scenario)) regions.add(landingRegion(step));
    out[spec.id] = REGION_ORDER.filter((r) => regions.has(r));
  }
  return out;
}

/** The value of y the D line prints, from the model's log. */
export function kataDValue(sampledY = false): SvValue {
  const line = exploreScenario(kataScenario(sampledY)).outcomes[0].lines.find((l) => l.startsWith("D "));
  const m = /y=(\w+)/.exec(line ?? "");
  if (!m) throw new Error("The kata's D line did not print");
  return m[1] === "x" ? "X" : Number(m[1]);
}

/** The kata's printed log, from the model. */
export function kataLog(sampledY = false): string[] {
  return exploreScenario(kataScenario(sampledY)).outcomes[0].lines;
}

export const regionsText = (regions: readonly RegionId[]) => joinNames(regions.map((r) => REGION_LABELS[r]));

export interface KataLineGrade {
  id: KataLineId;
  expected: RegionId[];
  given: RegionId[];
  correct: boolean;
  explanation: string;
}

export interface KataAnswer {
  regions: Partial<Record<KataLineId, readonly RegionId[]>>;
  order: readonly string[];
  /** The learner's value of y on the D line. */
  dValue: SvValue | null;
}

export interface KataGrade {
  lines: KataLineGrade[];
  order: OrderGrade;
  dCorrect: boolean;
  dFeedback: string;
  score: number;
  total: number;
}

/**
 * The explanation of a line: its regions from the model, then why. Pass
 * `expected` (from kataExpectedRegions) to reuse regions already computed.
 */
export function kataExplanation(id: KataLineId, sampledY = false, expected: Record<KataLineId, RegionId[]> = kataExpectedRegions(sampledY)): string {
  const spec = KATA_LINES.find((l) => l.id === id);
  if (!spec) throw new Error(`Unknown kata line ${id}`);
  return `${id}: ${regionsText(expected[id])}. ${spec.reason}`;
}

const stripLineTag = (text: string) => text.replace(/\s*\/\/ L\d$/, "").trim();

/**
 * The code a kata line's picker shows: the line itself, and for a line that
 * belongs to a concurrent assertion (L6) the assert property line above it too,
 * because its sample and evaluation are graded with it.
 */
export function kataLineCode(id: KataLineId, sampledY = false): string[] {
  const listing = kataListing(sampledY);
  const spec = KATA_LINES.find((l) => l.id === id);
  const text = (key: string) => stripLineTag(listing.find((l) => l.key === key)?.text ?? "");
  return spec?.assertionId ? [text(`${id}-prop`), text(id)] : [text(id)];
}

export function kataReason(id: KataLineId): string {
  return KATA_LINES.find((l) => l.id === id)?.reason ?? "";
}

/** Everything grading the kata needs from the model, computed once. */
export interface KataKey {
  expected: Record<KataLineId, RegionId[]>;
  order: LogOrderKey;
  /** The value of y the D line prints. */
  d: SvValue;
  /** The value of y the assertion sampled in Preponed. */
  sample: SvValue;
}

export function kataKey(sampledY = false): KataKey {
  return { expected: kataExpectedRegions(sampledY), order: logOrderKey(kataScenario(sampledY)), d: kataDValue(sampledY), sample: assertionSample(kataScenario(sampledY), "y") };
}

/**
 * Grades the kata: each line's regions (an exact set), the log order and the D
 * value. Pass `key` (from kataKey) to reuse model results already computed.
 */
export function gradeKata(answer: KataAnswer, sampledY = false, key: KataKey = kataKey(sampledY)): KataGrade {
  const { expected, d, sample } = key;
  const lines = KATA_LINE_IDS.map((id) => {
    const given = REGION_ORDER.filter((r) => answer.regions[id]?.includes(r));
    const exp = expected[id];
    return { id, expected: exp, given, correct: given.length === exp.length && exp.every((r) => given.includes(r)), explanation: kataExplanation(id, sampledY, expected) };
  });
  const order = gradeLogOrder(answer.order, key.order, KATA_PRINTS);
  const dCorrect = answer.dValue === d;
  const dFeedback = `D prints y=${formatPrintValue(d)}. ${
    sampledY
      ? `$sampled(y) returns the Preponed sample (§16.9.3), y = ${formatPrintValue(sample)}, the value the property checked.`
      : `The property passed on the sample y = ${formatPrintValue(sample)} (§16.5.1), but the pass action runs in Reactive (§4.4.2.6, §16.14.1), after the NBA update of q has changed y, and a plain read returns the current value.`
  }`;
  const score = lines.filter((l) => l.correct).length + (order.correct ? 1 : 0) + (dCorrect ? 1 : 0);
  return { lines, order, dCorrect, dFeedback, score, total: lines.length + 2 };
}

/**
 * The "What does the D line print now?" options for requirement 4 ($sampled(y)
 * on L6). Labels come from the model's D values, and an option is correct when
 * its value is the one the D line prints with $sampled(y).
 */
export interface KataSampledOption {
  id: "plain" | "sampled";
  label: string;
  correct: boolean;
  feedback: string;
}

export function kataSampledOptions(): KataSampledOption[] {
  const sampled = kataDValue(true);
  const plain = kataDValue(false);
  const feedback = (id: KataSampledOption["id"]) =>
    id === "sampled"
      ? "$sampled(y) returns the Preponed sample wherever it is called (§16.9.3), the same value the property was evaluated on (§16.5.1)."
      : "A plain read in the pass action returns the current value, but $sampled(y) does not: it returns the Preponed sample wherever it is called (§16.9.3).";
  const options: KataSampledOption[] = [{ id: "plain", label: `D y=${formatPrintValue(plain)}`, correct: plain === sampled, feedback: feedback("plain") }];
  // If the two reads ever agreed, one option would stand for both: never two options with the same label.
  if (plain !== sampled) options.push({ id: "sampled", label: `D y=${formatPrintValue(sampled)}`, correct: true, feedback: feedback("sampled") });
  return options;
}

/** Why D prints before C (the kata's reflection), from the model's regions. */
export function kataOrderReason(): string {
  const regions = kataExpectedRegions();
  const dRegion = regions.L6[regions.L6.length - 1];
  const cRegion = regions.L5[regions.L5.length - 1];
  return `D prints in ${REGION_LABELS[dRegion]} and C in ${REGION_LABELS[cRegion]}, and ${REGION_LABELS[dRegion]} comes first in the slot (§4.4.2.6, §4.4.2.9).`;
}

/** Assumptions and limits shown in the frame. */
export const REGION_TRACE_ASSUMPTIONS: readonly string[] = [
  "Every region, value and printed line is computed by the scheduler model from IEEE 1800-2023 §4.4.2 (the regions), §4.5 (the reference algorithm), §4.7 (nondeterminism), §4.9.1 (continuous assignments), §16.5.1 and §16.9.3 (sampled values and $sampled), §20.2 and §9.2.3 ($finish), and §24.3 and §24.3.1 (program blocks and the implicit $finish).",
  "The model runs every order of the processes ready in a region (§4.7, first source). It does not interleave statements inside a process, which §4.7 also allows; no line here depends on that.",
  "Each step is labelled with the region its event was scheduled into (§4.4.2). The reference algorithm (§4.5) moves Inactive and NBA events into Active to execute them, so a step labelled Inactive is a process resumed after #0, executed once that move has happened.",
  "One time slot is modelled, t = 5. #1 $finish ends the run at t = 6, outside it.",
  "Neither bench has a final procedure, so once $finish runs, explicitly or implicitly, no remaining scheduled event executes (§9.2.3).",
  "The expected output is derived from the standard, not captured from a simulator run. A real tool also prints its own banner and a message when $finish runs (§20.2, Table 20-1); the log here leaves those out.",
  "Support for program blocks, the reactive regions and concurrent assertions varies among open-source simulators (tool-dependent).",
];
