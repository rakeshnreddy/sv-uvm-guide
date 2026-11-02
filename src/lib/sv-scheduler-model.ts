/**
 * Deterministic educational model of one SystemVerilog time slot.
 *
 * The model follows the region iteration of the IEEE 1800 reference
 * scheduling algorithm (Clause 4): the first inner loop (Active, Inactive,
 * NBA, Observed) iterates until empty, then the reactive region set
 * (Reactive, Re-Inactive, Re-NBA) iterates, and the slot repeats while any
 * iterative region still holds events. Postponed runs last.
 *
 * Scope and assumptions (also surfaced to learners in the UI):
 * - One time slot is modelled: the slot that contains a clock edge.
 * - Processes are small structured programs, not parsed SystemVerilog.
 * - The only nondeterminism explored is the relative order of processes that
 *   are ready in the same region (IEEE 1800 permits any order). Update events
 *   are applied in the order they were scheduled, which matches the
 *   standard's guarantee for nonblocking assignments. With the opt-in
 *   `interleaveNba` option, a process woken by one applied NBA update may
 *   also run before the remaining updates are applied (§4.5 takes "any
 *   event"); that is explored as a further choice point.
 * - Clocking-block inputs use the default #1step input skew (value sampled
 *   before anything changes in the slot) and outputs use #0 output skew
 *   (drive scheduled in Re-NBA).
 * - Two clocking-block limits, which no scenario exercises: every `cb.sig <= v`
 *   is treated as coincident with its clocking event, whichever process runs
 *   it, and lands in this slot's Re-NBA, although a drive that is not
 *   coincident with the event acts at the next clocking event (§14.16). And
 *   every `cb.sig` read returns this slot's Preponed sample, although a read
 *   after @(posedge clk) rather than @(cb) may see the old or the new sample
 *   (§14.13). sv-clocking-model.ts models both.
 * - Concurrent assertions (process kind 'assertion') sample in Preponed
 *   (§16.5.1), are evaluated in Observed on their clock edge (§4.4.2.5) and
 *   run their pass/fail action blocks in Reactive (§4.4.2.6). A failure with
 *   no else clause calls $error (§16.14.1); the standard does not say where
 *   that implicit call runs, so the model runs it with the fail code, in
 *   Reactive.
 * - `$finish` (§20.2) and the implicit `$finish` when the last program
 *   thread ends (§24.3) stop the run at once: no later region of the slot,
 *   Postponed included, executes (§9.2.3).
 *
 * - Slot time 0: `initial` stands for static-variable declaration initializers
 *   there, so the Preponed sample equals the default sampled value §16.5.1
 *   requires at time 0. Any other variable or net, `wire y = 1` included, is
 *   outside the model: its default sampled value would be its type's default
 *   (Table 6-7), and the model still samples `initial`.
 * - Edges follow Table 9-2 on the LSB of the value (§9.4.2). The model has one
 *   unknown value, X, standing for x and z alike on an edge. Printed output
 *   covers only all-x: `%0d` of an all-z value prints z (§21.2.1.3), which the
 *   model never produces.
 * - `~` is defined here for single-bit values only: a real ~ negates each bit
 *   of a multi-bit value (§11.4.8), and the model throws on one rather than
 *   invent a result.
 *
 * Every addition beyond the original model is opt-in scenario data, so
 * scenarios that do not use it produce the same structure they always did
 * (regions, deltas, queues, values and log, pinned by hash in
 * tests/lib/sv-scheduler-model.test.ts). The narration may be reworded.
 */

export type SvValue = number | "X";

export type RegionId =
  | "preponed"
  | "active"
  | "inactive"
  | "nba"
  | "observed"
  | "reactive"
  | "reInactive"
  | "reNba"
  | "postponed";

export const REGION_ORDER: RegionId[] = [
  "preponed",
  "active",
  "inactive",
  "nba",
  "observed",
  "reactive",
  "reInactive",
  "reNba",
  "postponed",
];

export const REGION_LABELS: Record<RegionId, string> = {
  preponed: "Preponed",
  active: "Active",
  inactive: "Inactive",
  nba: "NBA",
  observed: "Observed",
  reactive: "Reactive",
  reInactive: "Re-Inactive",
  reNba: "Re-NBA",
  postponed: "Postponed",
};

/** First inner loop of §4.5: the active region set plus Observed (which §4.4.1 places in neither set). */
export const ACTIVE_SET: RegionId[] = ["active", "inactive", "nba", "observed"];
export const REACTIVE_SET: RegionId[] = ["reactive", "reInactive", "reNba"];

/** Simulation time of a modelled slot when the scenario does not say (the lessons' "t = 10 ns"). */
export const DEFAULT_SLOT_TIME = 10;
export const DEFAULT_TIME_UNIT = "ns";

export type Expr =
  | { kind: "const"; value: SvValue }
  | { kind: "var"; name: string }
  /** Clocking-block input: the value sampled in Preponed (#1step skew, §14.13, §4.4.2.1). Always this slot's sample; the file header states the limit. */
  | { kind: "sampled"; name: string; clocking: string }
  /** `~e` (§11.4.8): 0 → 1, 1 → 0, X → X. Single-bit values only; any other value throws (see the file header). */
  | { kind: "inv"; expr: Expr }
  /** `a == b` (§11.4.5, Table 11-9): 1 or 0, or X when either side is X. */
  | { kind: "eq"; left: Expr; right: Expr }
  /** `$sampled(sig)` (§16.9.3): the value sampled in Preponed, wherever the read happens. */
  | { kind: "sampledFn"; name: string };

/** One `label=%0d` item of a $display / $strobe format. */
export interface PrintArg {
  label: string;
  expr: Expr;
}

export type PrintTask = "display" | "error";

export type ViolationQualifier = "unique" | "unique0" | "priority";
export type ViolationCheckResult = "no-match" | "multiple-match" | "pass";

/** $assertcontrol control_type values this model records (Table 20-5): 3 On, 4 Off, 5 Kill. */
export type AssertControlType = 3 | 4 | 5;
export const ASSERT_CONTROL_TYPES: Record<AssertControlType, string> = { 3: "On", 4: "Off", 5: "Kill" };

/** assertion_type bits of $assertcontrol (Table 20-6). */
export const ASSERTION_TYPE_BITS = {
  concurrent: 1,
  simpleImmediate: 2,
  observedDeferredImmediate: 4,
  finalDeferredImmediate: 8,
  expect: 16,
  unique: 32,
  unique0: 64,
  priority: 128,
} as const;

const ASSERTION_TYPE_NAMES: [number, string][] = [
  [1, "Concurrent"],
  [2, "SimpleImmediate"],
  [4, "ObservedDeferredImmediate"],
  [8, "FinalDeferredImmediate"],
  [16, "Expect"],
  [32, "Unique"],
  [64, "Unique0"],
  [128, "Priority"],
];

export type Statement =
  | { kind: "assign"; id: string; op: "blocking" | "nba"; target: string; expr: Expr }
  /** Clocking-block synchronous drive (`cb.sig <= expr`). Updates in Re-NBA. */
  | { kind: "cbDrive"; id: string; clocking: string; target: string; expr: Expr }
  | { kind: "delay0"; id: string }
  /**
   * `$display` (or `$error` with `task: "error"`). `signals` prints `name=%0d`
   * items; `args` replaces them with arbitrary expressions, `label` adds a
   * literal word and `showTime` prefixes `%0d` of `$time` (§20.3.1).
   */
  | { kind: "display"; id: string; signals: string[]; label?: string; showTime?: boolean; args?: PrintArg[]; task?: PrintTask }
  | { kind: "strobe"; id: string; signals: string[]; label?: string; showTime?: boolean; args?: PrintArg[] }
  /** `#d` with d > 0: the process resumes in a later time slot (§9.4.1); nothing more of it runs here. */
  | { kind: "delay"; id: string; units: number }
  /** `$finish` (§20.2): the run ends at once; no later region of the slot executes (§9.2.3). */
  | { kind: "finish"; id: string }
  /**
   * Trace-only: a unique/unique0/priority violation check (§12.4.2, §12.5.3)
   * with the result the scenario author assigns. The scheduler records where
   * it executed; deferred reporting (§12.4.2.1) is interpreted elsewhere.
   */
  | { kind: "check"; id: string; qualifier: ViolationQualifier; construct: "if" | "case"; result: ViolationCheckResult; source: string }
  /** Trace-only: `$assertcontrol(control_type, assertion_type)` (§20.11). Recorded, not applied. */
  | { kind: "assertcontrol"; id: string; controlType: AssertControlType; assertionType: number };

export type ProcessTrigger =
  | { kind: "posedge"; signal: string }
  | { kind: "change"; signals: string[] }
  /** `@(cb)`: the clocking block event, triggered in Observed (§14.10). */
  | { kind: "clocking"; clocking: string }
  /**
   * Ready when the slot starts, in Active, or Reactive for program context
   * (§24.3.1): a `#d` from an earlier slot that expired at this time, or, at
   * slot time 0, the start of the procedure. Models `always #5 clk = ~clk`
   * running inside the slot. `note` names the next booking, e.g.
   * "#5 books t = 10". An `initial` that runs once has no next delay; see
   * `runsOnce`.
   */
  | { kind: "resume"; note?: string };

export interface ClockingBlock {
  name: string;
  /** Signal whose rising edge is the clocking event. */
  clock: string;
}

export type AssertionOutcome = "pass" | "fail";

export interface AssertionSpec {
  /** Property expression over sampled values (§16.5.1), read as a condition (§16.6): 1 passes; 0 or X fails. */
  property: Expr;
  /** Pass action block, run in Reactive (§4.4.2.5, §4.4.2.6). */
  pass?: Statement[];
  /** Fail (`else`) action block, run in Reactive. Left out, a failure runs the default $error instead (§16.14.1). */
  fail?: Statement[];
}

export interface SvProcess {
  id: string;
  /** Short name shown in queues and choice prompts. */
  label: string;
  owner: "design" | "testbench";
  /** Program-block code runs in the reactive region set. */
  context: "module" | "program";
  header: string;
  trigger: ProcessTrigger;
  body: Statement[];
  /**
   * 'assertion': a concurrent assertion clocked by `trigger` (a posedge).
   * `body` is ignored; `assertion` holds the property and action blocks.
   */
  kind?: "procedural" | "assertion";
  assertion?: AssertionSpec;
  /** Program process whose end is the end of the last program thread: implicit $finish (§24.3). */
  lastThread?: boolean;
  /** Display-only source lines rendered after the body, e.g. a trailing `@(posedge clk);`. No scheduling effect. */
  sourceTail?: string[];
}

export interface SchedulerOptions {
  /**
   * Off (default): every NBA update moved to Active is applied before any
   * process they wake runs (one legal order). On: after each applied update,
   * a woken process may run before the remaining updates are applied (§4.5
   * takes "any event"; §4.6 only orders the updates among themselves). Each
   * such point is a scheduler choice.
   */
  interleaveNba?: boolean;
}

export interface SvScenario {
  id: string;
  title: string;
  clock: string;
  initial: Record<string, SvValue>;
  processes: SvProcess[];
  clockings?: ClockingBlock[];
  /** Signals to show in value and waveform panels, in display order. */
  watch: string[];
  /** Simulation time of the modelled slot, used by `$time` and labels. Default 10. At 0, `initial` stands for static-variable declaration initializers (file header, §16.5.1). */
  slotTime?: number;
  /** Unit shown next to the slot time. Default "ns". */
  timeUnit?: string;
  /**
   * 'implicit' (default): the model schedules `clock ← 1` as the first Active
   * event. 'process': a scenario process (normally a 'resume' one running
   * `clk = ~clk`) drives the clock itself.
   */
  clockSource?: "implicit" | "process";
  options?: SchedulerOptions;
}

export type SchedulerEvent =
  | { kind: "update"; target: string; value: SvValue; from: string; stmtId?: string; reason: string }
  | { kind: "evaluate"; processId: string; pc: number; reason: string }
  | { kind: "print"; text: string; stmtId: string; processId: string }
  | { kind: "clockingEvent"; clocking: string }
  /** Evaluation of a concurrent assertion, scheduled in Observed by its clock edge. */
  | { kind: "assertEval"; processId: string }
  /** Pass/fail action block of a concurrent assertion, scheduled in Reactive. */
  | { kind: "assertAction"; processId: string; outcome: AssertionOutcome; pc: number };

export interface QueueItem {
  label: string;
  kind: SchedulerEvent["kind"];
  processId?: string;
}

export type StepKind =
  | "slot-start"
  | "sample"
  | "update"
  | "statement"
  | "suspend"
  | "wake"
  | "move"
  | "choice"
  | "print"
  | "slot-end";

export type FinishCause = "finish" | "implicit-finish";

/** Trace-only record of a statement the scheduler does not interpret. */
export type TraceRecord =
  | { kind: "check"; qualifier: ViolationQualifier; construct: "if" | "case"; result: ViolationCheckResult; processId: string; stmtId: string }
  | { kind: "assertcontrol"; controlType: AssertControlType; assertionType: number; processId: string; stmtId: string };

export interface TraceStep {
  index: number;
  kind: StepKind;
  /** Region currently being executed (moved events execute in Active or Reactive). */
  region: RegionId;
  /** Region the executing event was originally scheduled in, when it was moved. */
  sourceRegion?: RegionId;
  /** Number of times events were moved from a later region back into Active/Reactive. */
  delta: number;
  processId?: string;
  stmtId?: string;
  what: string;
  why: string;
  values: Record<string, SvValue>;
  changed: string[];
  queues: Record<RegionId, QueueItem[]>;
  log: string[];
  choice?: { options: string[]; picked: string };
  /** Set on the steps of a concurrent assertion: its Preponed sample, Observed evaluation, Reactive action. */
  assertion?: { phase: "sample" | "evaluate" | "action"; outcome?: AssertionOutcome };
  /** Set on the step that ended the run and on the final slot-end step. */
  endedBy?: FinishCause;
  /** Trace-only record for 'check' and 'assertcontrol' statements. */
  record?: TraceRecord;
}

export interface SimulationResult {
  scenarioId: string;
  choices: number[];
  /** Number of options available at each choice point, in order. */
  choiceWidths: number[];
  trace: TraceStep[];
  finalValues: Record<string, SvValue>;
  log: string[];
  /** Process ids in the order they first executed. */
  executionOrder: string[];
  /** Simulation time of the slot ($time). */
  slotTime: number;
  /** Present when the run ended inside the slot. */
  finished?: { cause: FinishCause; processId: string; stmtId?: string; region: RegionId; stepIndex: number };
}

export interface OutcomeGroup {
  signature: string;
  finalValues: Record<string, SvValue>;
  log: string[];
  /** Representative choice vector and execution order for each run in the group. */
  runs: { choices: number[]; executionOrder: string[] }[];
}

export interface ExplorationResult {
  deterministic: boolean;
  outcomes: OutcomeGroup[];
  runCount: number;
}

/** Slot-start narration: what reads the Preponed samples (§14.13, §4.4.2.1, §16.5.1, §16.9.3). Also the answer text of the region quiz's cb-sample question. */
export const SLOT_START_WHY =
  "Preponed samples every value before anything in this slot changes. Clocking-block inputs (#1step), concurrent assertions and $sampled() return these samples; a plain read of a variable returns its current value.";

const MAX_STEPS = 400;
const MAX_RUNS = 256;

export function formatValue(value: SvValue | undefined): string {
  if (value === undefined || value === "X") return "X";
  return String(value);
}

/** What `%0d` prints for a value: an all-x value prints as a lowercase x (§21.2.1.3). The model produces no all-z output (file header). */
export function formatPrintValue(value: SvValue | undefined): string {
  return value === undefined || value === "X" ? "x" : String(value);
}

/** "t = 10 ns" for the scenario's slot. */
export function slotTimeLabel(scenario: Pick<SvScenario, "slotTime" | "timeUnit">): string {
  return `t = ${scenario.slotTime ?? DEFAULT_SLOT_TIME} ${scenario.timeUnit ?? DEFAULT_TIME_UNIT}`;
}

export function exprToSource(expr: Expr): string {
  switch (expr.kind) {
    case "const":
      return formatValue(expr.value);
    case "var":
      return expr.name;
    case "sampled":
      return `${expr.clocking}.${expr.name}`;
    case "inv":
      return expr.expr.kind === "eq" ? `~(${exprToSource(expr.expr)})` : `~${exprToSource(expr.expr)}`;
    case "eq":
      return `${exprToSource(expr.left)} == ${exprToSource(expr.right)}`;
    case "sampledFn":
      return `$sampled(${expr.name})`;
  }
}

/**
 * Names an expression reads. 'live': variables read at execution time (a
 * clocking input or $sampled() reads a sample, not the variable). 'sampled':
 * every signal whose Preponed sample the expression uses when evaluated as a
 * property. 'sampledFn': only explicit $sampled() reads.
 */
export function exprNames(expr: Expr, mode: "live" | "sampled" | "sampledFn"): string[] {
  switch (expr.kind) {
    case "const":
      return [];
    case "var":
      return mode === "sampledFn" ? [] : [expr.name];
    case "sampled":
      return mode === "sampled" ? [expr.name] : [];
    case "sampledFn":
      return mode === "live" ? [] : [expr.name];
    case "inv":
      return exprNames(expr.expr, mode);
    case "eq":
      return [...exprNames(expr.left, mode), ...exprNames(expr.right, mode)];
  }
}

type PrintStatement = Extract<Statement, { kind: "display" | "strobe" }>;

/** The `label=%0d` items of a print, derived from `args` or `signals`. */
export function printArgs(stmt: PrintStatement): PrintArg[] {
  return stmt.args ?? stmt.signals.map((s) => ({ label: s, expr: { kind: "var", name: s } as Expr }));
}

function printFormat(stmt: PrintStatement): { format: string; args: string[] } {
  const items = printArgs(stmt);
  const words = [...(stmt.showTime ? ["%0d"] : []), ...(stmt.label ? [stmt.label] : []), ...items.map((a) => `${a.label}=%0d`)];
  const args = [...(stmt.showTime ? ["$time"] : []), ...items.map((a) => exprToSource(a.expr))];
  return { format: words.join(" "), args };
}

export function statementToSource(stmt: Statement): string {
  switch (stmt.kind) {
    case "assign":
      return `${stmt.target} ${stmt.op === "blocking" ? "=" : "<="} ${exprToSource(stmt.expr)};`;
    case "cbDrive":
      return `${stmt.clocking}.${stmt.target} <= ${exprToSource(stmt.expr)};`;
    case "delay0":
      return "#0;";
    case "display": {
      const { format, args } = printFormat(stmt);
      return `$${stmt.task ?? "display"}("${format}"${args.map((a) => `, ${a}`).join("")});`;
    }
    case "strobe": {
      const { format, args } = printFormat(stmt);
      return `$strobe("${format}"${args.map((a) => `, ${a}`).join("")});`;
    }
    case "delay":
      return `#${stmt.units};`;
    case "finish":
      return "$finish;";
    case "check":
      return stmt.source;
    case "assertcontrol":
      return `$assertcontrol(${stmt.controlType}, ${stmt.assertionType});`;
  }
}

export interface SourceLine {
  text: string;
  processId?: string;
  stmtId?: string;
}

/** Statement ids of a process, including those inside assertion action blocks. */
export function processStatements(process: SvProcess): Statement[] {
  return [...process.body, ...(process.assertion?.pass ?? []), ...(process.assertion?.fail ?? [])];
}

/** Finds a statement anywhere in the scenario (bodies and assertion action blocks). */
export function findProcessStatement(scenario: SvScenario, stmtId?: string): Statement | undefined {
  if (!stmtId) return undefined;
  for (const process of scenario.processes) {
    const found = processStatements(process).find((s) => s.id === stmtId);
    if (found) return found;
  }
  return undefined;
}

/** Signals whose Preponed sample a concurrent assertion uses: the property's operands and any $sampled() in its action blocks. */
export function assertionSampledSignals(process: SvProcess): string[] {
  const spec = process.assertion;
  if (!spec) return [];
  const names = exprNames(spec.property, "sampled");
  for (const stmt of [...(spec.pass ?? []), ...(spec.fail ?? [])]) {
    if (stmt.kind === "assign" || stmt.kind === "cbDrive") names.push(...exprNames(stmt.expr, "sampledFn"));
    if (stmt.kind === "display" || stmt.kind === "strobe") printArgs(stmt).forEach((a) => names.push(...exprNames(a.expr, "sampledFn")));
  }
  return [...new Set(names)];
}

/**
 * §16.14.1: when the else clause is omitted, the tool calls $error on failure,
 * unless $assertcontrol suppresses it. The real message is tool-specific; the
 * model prints the assertion's label. Only called when `spec.fail` is empty,
 * so these statements never appear in the scenario's source.
 */
const defaultErrorId = (process: SvProcess) => `${process.id}-default-error`;

function defaultFailAction(process: SvProcess): Statement[] {
  return [{ kind: "display", id: defaultErrorId(process), signals: [], task: "error", label: `${process.label} failed` }];
}

const usesDefaultError = (spec: AssertionSpec, outcome: AssertionOutcome) => outcome === "fail" && !spec.fail?.length;

/** The statements a concurrent assertion runs in Reactive for an outcome. */
function assertionActions(process: SvProcess, spec: AssertionSpec, outcome: AssertionOutcome): Statement[] {
  if (usesDefaultError(spec, outcome)) return defaultFailAction(process);
  return (outcome === "pass" ? spec.pass : spec.fail) ?? [];
}

function assertionClock(process: SvProcess, scenario: SvScenario): string {
  return process.trigger.kind === "posedge" ? process.trigger.signal : scenario.clock;
}

/** Renders scenario processes as SystemVerilog-style source, one entry per line. */
export function scenarioToSource(scenario: SvScenario): SourceLine[] {
  const lines: SourceLine[] = [];
  scenario.processes.forEach((process, index) => {
    if (index > 0) lines.push({ text: "" });
    if (process.kind === "assertion" && process.assertion) {
      const spec = process.assertion;
      const hasActions = Boolean(spec.pass?.length || spec.fail?.length);
      lines.push({ text: `${process.header} (@(posedge ${assertionClock(process, scenario)}) ${exprToSource(spec.property)})${hasActions ? "" : ";"}`, processId: process.id });
      const block = (stmts: Statement[], prefix: string) => {
        if (stmts.length === 1) {
          lines.push({ text: `  ${prefix}${statementToSource(stmts[0])}`, processId: process.id, stmtId: stmts[0].id });
          return;
        }
        lines.push({ text: `  ${prefix}begin`, processId: process.id });
        stmts.forEach((stmt) => lines.push({ text: `    ${statementToSource(stmt)}`, processId: process.id, stmtId: stmt.id }));
        lines.push({ text: "  end", processId: process.id });
      };
      if (spec.pass?.length) block(spec.pass, "");
      if (spec.fail?.length) block(spec.fail, "else ");
      return;
    }
    const tail = process.sourceTail ?? [];
    if (process.body.length === 1 && tail.length === 0) {
      lines.push({ text: `${process.header} ${statementToSource(process.body[0])}`, processId: process.id, stmtId: process.body[0].id });
      return;
    }
    lines.push({ text: `${process.header} begin`, processId: process.id });
    process.body.forEach((stmt) => {
      lines.push({ text: `  ${statementToSource(stmt)}`, processId: process.id, stmtId: stmt.id });
    });
    tail.forEach((text) => lines.push({ text: `  ${text}`, processId: process.id }));
    lines.push({ text: "end", processId: process.id });
  });
  return lines;
}

function emptyQueues(): Record<RegionId, SchedulerEvent[]> {
  return {
    preponed: [],
    active: [],
    inactive: [],
    nba: [],
    observed: [],
    reactive: [],
    reInactive: [],
    reNba: [],
    postponed: [],
  };
}

function describeEvent(event: SchedulerEvent, processes: Map<string, SvProcess>): QueueItem {
  switch (event.kind) {
    case "update":
      return { kind: "update", label: `${event.target} ← ${formatValue(event.value)}` };
    case "evaluate": {
      const process = processes.get(event.processId);
      return {
        kind: "evaluate",
        processId: event.processId,
        label: event.pc === 0 ? `run ${process?.label ?? event.processId}` : `resume ${process?.label ?? event.processId}`,
      };
    }
    case "print":
      return { kind: "print", processId: event.processId, label: "$strobe" };
    case "clockingEvent":
      return { kind: "clockingEvent", label: `@(${event.clocking}) event` };
    case "assertEval":
      return { kind: "assertEval", processId: event.processId, label: `evaluate ${processes.get(event.processId)?.label ?? event.processId}` };
    case "assertAction":
      return { kind: "assertAction", processId: event.processId, label: `${processes.get(event.processId)?.label ?? event.processId} ${event.outcome} action` };
  }
}

/** The bit an edge event looks at: the LSB of the value (§9.4.2). X has an unknown LSB. */
function edgeBit(value: SvValue): 0 | 1 | "X" {
  if (value === "X") return "X";
  return value % 2 === 0 ? 0 : 1;
}

/**
 * Table 9-2 (§9.4.2), on the LSB: a posedge is a transition from 0 to something
 * else, or from an unknown value to 1. The model has one unknown value, X,
 * standing for x and z alike. Any other transition is not a posedge, X → 0
 * included, and so is 0 → 2, whose LSB does not move.
 */
export function isPosedge(oldValue: SvValue, newValue: SvValue): boolean {
  const from = edgeBit(oldValue);
  const to = edgeBit(newValue);
  return (from === 0 && to !== 0) || (from === "X" && to === 1);
}

/** A continuous assignment (§4.9.1), modelled as a process sensitive to its source, not a procedural statement. */
export function isContinuousAssign(process: Pick<SvProcess, "header">): boolean {
  return process.header === "assign";
}

/**
 * An `initial` with no `forever` and no trailing wait in the source shown: it
 * executes once and its activity then ceases (§9.2.1), so nothing re-arms it.
 * Read from what the learner sees, so the narration cannot disagree with it.
 */
export function runsOnce(process: Pick<SvProcess, "header" | "sourceTail">): boolean {
  return /^initial\b/.test(process.header) && !/\bforever\b/.test(process.header) && !process.sourceTail?.length;
}

function invert(value: SvValue): SvValue {
  if (value === "X") return "X";
  if (value === 0) return 1;
  if (value === 1) return 0;
  throw new Error(`~ is modelled for single-bit values only, not ${value}: a real ~ negates each bit (§11.4.8)`);
}

function evaluateExpr(expr: Expr, values: Record<string, SvValue>, sampled: Record<string, SvValue>): SvValue {
  switch (expr.kind) {
    case "const":
      return expr.value;
    case "var":
      return values[expr.name] ?? "X";
    case "sampled":
      return sampled[expr.name] ?? "X";
    case "inv":
      return invert(evaluateExpr(expr.expr, values, sampled));
    case "eq": {
      const left = evaluateExpr(expr.left, values, sampled);
      const right = evaluateExpr(expr.right, values, sampled);
      if (left === "X" || right === "X") return "X";
      return left === right ? 1 : 0;
    }
    case "sampledFn":
      return sampled[expr.name] ?? "X";
  }
}

/** §16.6 / §12.4: a condition is false when it is 0 or X, true otherwise. */
function isTrue(value: SvValue): boolean {
  return value !== "X" && value !== 0;
}

function joinWithAnd(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatSignals(signals: string[], values: Record<string, SvValue>): string {
  return signals.map((s) => `${s}=${formatValue(values[s])}`).join(" ");
}

/** The text a print produces: optional $time, optional label, then each `label=value`. */
function formatPrint(stmt: PrintStatement, values: Record<string, SvValue>, sampled: Record<string, SvValue>, slotTime: number): string {
  const parts = [
    ...(stmt.showTime ? [String(slotTime)] : []),
    ...(stmt.label ? [stmt.label] : []),
    ...printArgs(stmt).map((a) => `${a.label}=${formatPrintValue(evaluateExpr(a.expr, values, sampled))}`),
  ];
  return parts.join(" ");
}

function describeAssertionMask(mask: number): string {
  const names = ASSERTION_TYPE_NAMES.filter(([bit]) => (mask & bit) !== 0).map(([, name]) => name);
  return names.length ? names.join(" | ") : "nothing";
}

const CHECK_RESULT_TEXT: Record<ViolationCheckResult, string> = {
  "no-match": "no condition matched",
  "multiple-match": "more than one condition matched",
  pass: "exactly one condition matched",
};

/**
 * Runs one time slot. `choices[i]` selects the option taken at the i-th
 * choice point (index into the ready list in declaration order, or, for an
 * `interleaveNba` point, 0 = apply the next update, k = run the k-th woken
 * process). Missing entries default to 0.
 */
export function simulateTimeSlot(scenario: SvScenario, choices: number[] = []): SimulationResult {
  const processes = new Map(scenario.processes.map((p) => [p.id, p]));
  const declarationIndex = new Map(scenario.processes.map((p, i) => [p.id, i]));
  const queues = emptyQueues();
  const values: Record<string, SvValue> = { ...scenario.initial };
  const sampled: Record<string, SvValue> = { ...scenario.initial };
  const slotTime = scenario.slotTime ?? DEFAULT_SLOT_TIME;
  const timeUnit = scenario.timeUnit ?? DEFAULT_TIME_UNIT;
  const interleaveNba = scenario.options?.interleaveNba ?? false;
  const log: string[] = [];
  const trace: TraceStep[] = [];
  const usedChoices: number[] = [];
  const choiceWidths: number[] = [];
  const executionOrder: string[] = [];
  const isAssertion = (p: SvProcess) => p.kind === "assertion" && Boolean(p.assertion);
  /** Procedural processes currently waiting on their trigger (not running or scheduled). */
  const waiting = new Set(scenario.processes.filter((p) => !isAssertion(p)).map((p) => p.id));
  let delta = 0;
  let currentRegion: RegionId = "preponed";
  const origin = new WeakMap<SchedulerEvent, RegionId>();
  let currentSource: RegionId | undefined;
  let ended: SimulationResult["finished"];

  const snapshotQueues = (): Record<RegionId, QueueItem[]> => {
    const out = {} as Record<RegionId, QueueItem[]>;
    for (const region of REGION_ORDER) {
      out[region] = queues[region].map((e) => describeEvent(e, processes));
    }
    return out;
  };

  const push = (step: Omit<TraceStep, "index" | "values" | "queues" | "log" | "delta" | "region" | "changed"> & { region?: RegionId; changed?: string[] }) => {
    if (trace.length >= MAX_STEPS) throw new Error(`Scenario ${scenario.id} exceeded ${MAX_STEPS} steps`);
    trace.push({
      ...step,
      region: step.region ?? currentRegion,
      sourceRegion: step.kind === "move" ? undefined : currentSource,
      changed: step.changed ?? [],
      index: trace.length,
      delta,
      values: { ...values },
      queues: snapshotQueues(),
      log: [...log],
    });
  };

  const regionFor = (process: SvProcess): RegionId => (process.context === "program" ? "reactive" : "active");

  const wakeSensitive = (signal: string, oldValue: SvValue, newValue: SvValue): string[] => {
    const woken: string[] = [];
    for (const process of scenario.processes) {
      if (!waiting.has(process.id)) continue;
      const t = process.trigger;
      const fires =
        (t.kind === "posedge" && t.signal === signal && isPosedge(oldValue, newValue)) ||
        (t.kind === "change" && t.signals.includes(signal));
      if (!fires) continue;
      waiting.delete(process.id);
      queues[regionFor(process)].push({
        kind: "evaluate",
        processId: process.id,
        pc: 0,
        reason: t.kind === "posedge" ? `@(posedge ${signal}) fired` : `${signal} changed`,
      });
      woken.push(process.label);
    }
    return woken;
  };

  /** Clocking-block events (§14.10) and concurrent-assertion evaluations (§4.4.2.5) that a posedge of `signal` (Table 9-2) schedules in Observed. */
  const scheduleEdgeEffects = (signal: string, oldValue: SvValue, newValue: SvValue): string[] => {
    if (!isPosedge(oldValue, newValue)) return [];
    const out: string[] = [];
    (scenario.clockings ?? [])
      .filter((cb) => cb.clock === signal)
      .forEach((cb) => {
        queues.observed.push({ kind: "clockingEvent", clocking: cb.name });
        out.push(`the @(${cb.name}) clocking event`);
      });
    for (const process of scenario.processes) {
      if (!isAssertion(process) || process.trigger.kind !== "posedge" || process.trigger.signal !== signal) continue;
      queues.observed.push({ kind: "assertEval", processId: process.id });
      out.push(`the evaluation of ${process.label}`);
    }
    return out;
  };

  /** A change wakes processes at once, but only schedules Observed events: "wakes A and B and schedules C in Observed". */
  const changeEffects = (signal: string, oldValue: SvValue, newValue: SvValue): string => {
    const woken = wakeSensitive(signal, oldValue, newValue);
    const scheduled = scheduleEdgeEffects(signal, oldValue, newValue);
    return [...(woken.length ? [`wakes ${joinWithAnd(woken)}`] : []), ...(scheduled.length ? [`schedules ${joinWithAnd(scheduled)} in Observed`] : [])].join(" and ");
  };

  const applyUpdate = (event: Extract<SchedulerEvent, { kind: "update" }>, region: RegionId) => {
    const oldValue = values[event.target] ?? "X";
    values[event.target] = event.value;
    const changed = oldValue !== event.value;
    const effects = changed ? changeEffects(event.target, oldValue, event.value) : "";
    push({
      kind: "update",
      region,
      stmtId: event.stmtId,
      processId: event.from,
      what: `${event.target} updates ${formatValue(oldValue)} → ${formatValue(event.value)}.`,
      why: changed
        ? `${event.reason}${effects ? ` The change ${effects}.` : ""}`
        : `${event.reason} The value is unchanged, so no process wakes.`,
      changed: changed ? [event.target] : [],
    });
  };

  /**
   * Why an immediate print shows what it shows, read from the queues at that
   * moment: only updates and processes actually waiting are named.
   */
  const printWhy = (task: string, region: RegionId): string => {
    const moved = [...queues.active, ...queues.reactive].flatMap((e) => (e.kind === "update" && isMovedNba(e) ? [origin.get(e) as RegionId] : []));
    const pending = (["nba", "reNba"] as RegionId[]).filter((r) => queues[r].length > 0 || moved.includes(r)).map((r) => REGION_LABELS[r]);
    const base = pending.length ? `${task} prints the values visible at this instant — pending ${pending.join(" and ")} updates are not yet applied.` : `${task} prints the values visible now.`;
    const waiting = region === "reactive" ? queues.active.map((e) => describeEvent(e, processes).label) : [];
    if (waiting.length === 0) return base;
    const one = waiting.length === 1;
    return `${base} Active still holds ${waiting.join(", ")}, which ${one ? "waits" : "wait"} until the reactive set has drained (§4.5), so ${one ? "its effect does" : "their effects do"} not show yet.`;
  };

  type BodyOutcome = "done" | "suspended" | "ended";

  /** Executes `stmts` from `startPc` in `region`. `resumeAt` builds the event that continues the body after #0. */
  const runStatements = (
    process: SvProcess,
    stmts: Statement[],
    startPc: number,
    region: RegionId,
    resumeAt: (pc: number) => SchedulerEvent,
  ): BodyOutcome => {
    const reactive = region === "reactive";
    for (let pc = startPc; pc < stmts.length; pc += 1) {
      const stmt = stmts[pc];
      switch (stmt.kind) {
        case "assign": {
          const value = evaluateExpr(stmt.expr, values, sampled);
          if (stmt.op === "blocking") {
            const oldValue = values[stmt.target] ?? "X";
            values[stmt.target] = value;
            const changed = oldValue !== value;
            const effects = changed ? changeEffects(stmt.target, oldValue, value) : "";
            const wakes = effects ? `; the change ${effects}` : "";
            const readers = `Any process that reads ${stmt.target} later in this slot sees ${formatValue(value)}.`;
            const continuous = isContinuousAssign(process);
            const source = `${continuous ? "assign " : ""}${statementToSource(stmt)}`;
            const write = continuous ? `updates ${stmt.target}` : `writes ${stmt.target} immediately`;
            push({
              kind: "statement",
              region,
              processId: process.id,
              stmtId: stmt.id,
              what: stmt.expr.kind === "const" ? `${source} ${write}.` : `${source} reads ${exprToSource(stmt.expr)} = ${formatValue(value)} and ${write}.`,
              why: continuous
                ? `A continuous assignment re-evaluates when its source changes and updates its target through an active update event (§4.9.1)${wakes}. ${readers}`
                : `A blocking assignment updates its target before the next statement runs${wakes}. ${readers}`,
              changed: changed ? [stmt.target] : [],
            });
          } else {
            const target: RegionId = reactive ? "reNba" : "nba";
            queues[target].push({
              kind: "update",
              target: stmt.target,
              value,
              from: process.id,
              stmtId: stmt.id,
              reason: `Scheduled by the nonblocking assignment in ${process.label}.`,
            });
            push({
              kind: "statement",
              region,
              processId: process.id,
              stmtId: stmt.id,
              what:
                stmt.expr.kind === "const"
                  ? `${statementToSource(stmt)} evaluates its right side now, but defers the write.`
                  : `${statementToSource(stmt)} reads ${exprToSource(stmt.expr)} = ${formatValue(value)} now, but defers the write.`,
              why: `A nonblocking assignment evaluates its right side immediately and schedules the update in ${REGION_LABELS[target]}. Until then every reader still sees ${stmt.target} = ${formatValue(values[stmt.target])}.`,
            });
          }
          break;
        }
        case "cbDrive": {
          const value = evaluateExpr(stmt.expr, values, sampled);
          queues.reNba.push({
            kind: "update",
            target: stmt.target,
            value,
            from: process.id,
            stmtId: stmt.id,
            reason: `Clocking-block drive from ${process.label} (output skew #0) matures in Re-NBA.`,
          });
          push({
            kind: "statement",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `${statementToSource(stmt)} schedules ${stmt.target} ← ${formatValue(value)} in Re-NBA.`,
            why: "A synchronous drive through a clocking block is applied in Re-NBA, after the active set has drained, so design logic triggered by this edge has already captured the old value (§14.16).",
          });
          break;
        }
        case "delay0": {
          const target: RegionId = reactive ? "reInactive" : "inactive";
          queues[target].push(resumeAt(pc + 1));
          push({
            kind: "suspend",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `${process.label} suspends on #0.`,
            why: `#0 moves the rest of the process to ${REGION_LABELS[target]}. It runs only after the current ${REGION_LABELS[region]} events are exhausted — it postpones the race rather than removing it.`,
          });
          return "suspended";
        }
        case "display": {
          const formatted = formatPrint(stmt, values, sampled, slotTime);
          const text = `$${stmt.task ?? "display"}: ${formatted}`;
          log.push(text);
          push({
            kind: "print",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `Prints ${formatted} immediately.`,
            why:
              stmt.id === defaultErrorId(process)
                ? "The tool reports the failure; its wording is tool-specific, and the model prints only the assertion's label, so no signal value is read here."
                : printWhy(`$${stmt.task ?? "display"}`, region),
          });
          break;
        }
        case "strobe": {
          queues.postponed.push({ kind: "print", text: "", stmtId: stmt.id, processId: process.id });
          push({
            kind: "statement",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `$strobe is deferred to Postponed.`,
            why: "$strobe prints the values that remain after every region of the slot has settled.",
          });
          break;
        }
        case "delay": {
          const next = stmts[pc + 1];
          push({
            kind: "suspend",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `${process.label} suspends on #${stmt.units}.`,
            why: `A nonzero delay suspends the process until t = ${slotTime + stmt.units} ${timeUnit}, a later time slot (§9.4.1). Nothing more of it runs in this slot${next ? `, so ${statementToSource(next)} is not reached now` : ""}.`,
          });
          return "suspended";
        }
        case "finish": {
          ended = { cause: "finish", processId: process.id, stmtId: stmt.id, region, stepIndex: trace.length };
          push({
            kind: "statement",
            region,
            processId: process.id,
            stmtId: stmt.id,
            endedBy: "finish",
            what: `$finish ends the simulation at t = ${slotTime} ${timeUnit}.`,
            why: "$finish makes the simulator exit (§20.2). Final procedures run, and then no remaining scheduled event executes (§9.2.3): the rest of this time slot, Postponed included, never runs.",
          });
          return "ended";
        }
        case "check": {
          push({
            kind: "statement",
            region,
            processId: process.id,
            stmtId: stmt.id,
            record: { kind: "check", qualifier: stmt.qualifier, construct: stmt.construct, result: stmt.result, processId: process.id, stmtId: stmt.id },
            what: `${stmt.source} performs its ${stmt.qualifier} check: ${CHECK_RESULT_TEXT[stmt.result]}.`,
            why: `The model records only that the check executed here, in ${REGION_LABELS[region]}, and its result. A ${stmt.qualifier} check is evaluated when the statement executes, but its violation report is deferred (§12.4.2.1, §12.5.3.1); what becomes of it is decided outside this scheduler model.`,
          });
          break;
        }
        case "assertcontrol": {
          push({
            kind: "statement",
            region,
            processId: process.id,
            stmtId: stmt.id,
            record: { kind: "assertcontrol", controlType: stmt.controlType, assertionType: stmt.assertionType, processId: process.id, stmtId: stmt.id },
            what: `$assertcontrol(${stmt.controlType}, ${stmt.assertionType}) executes: control_type ${stmt.controlType} (${ASSERT_CONTROL_TYPES[stmt.controlType]}) with assertion_type mask ${stmt.assertionType} (${describeAssertionMask(stmt.assertionType)}).`,
            why: "Recorded only: the model does not apply it. control_type 3 = On, 4 = Off, 5 = Kill (Table 20-5); the assertion_type mask selects which assertion and violation-report types are affected (Table 20-6).",
          });
          break;
        }
      }
    }
    return "done";
  };

  const runProcess = (event: Extract<SchedulerEvent, { kind: "evaluate" }>, region: RegionId) => {
    const process = processes.get(event.processId);
    if (!process) return;
    if (!executionOrder.includes(process.id)) executionOrder.push(process.id);
    push({
      kind: "wake",
      region,
      processId: process.id,
      what: event.pc === 0 ? `${process.label} starts executing.` : `${process.label} resumes after #0.`,
      why: event.reason,
    });
    const outcome = runStatements(process, process.body, event.pc, region, (pc) => ({ kind: "evaluate", processId: process.id, pc, reason: "#0 delay expired." }));
    if (outcome !== "done") return;
    if (process.lastThread && process.context === "program") {
      ended = { cause: "implicit-finish", processId: process.id, region, stepIndex: trace.length };
      push({
        kind: "statement",
        region,
        processId: process.id,
        endedBy: "implicit-finish",
        what: `${process.label} ends, and with it the last program thread: an implicit $finish ends the simulation at t = ${slotTime} ${timeUnit}.`,
        why: "When all threads of all program initial procedures have ended, the simulation ends through an implicit call to $finish (§24.3). Final procedures run, and no remaining scheduled event executes (§9.2.3): the rest of this time slot, Postponed included, never runs.",
      });
      return;
    }
    if (runsOnce(process)) {
      push({
        kind: "statement",
        region,
        processId: process.id,
        what: `${process.label} finishes: the procedure has ended.`,
        why: "An initial procedure executes once, and its activity then ceases (§9.2.1). Nothing runs it again.",
      });
      return;
    }
    waiting.add(process.id);
    push({
      kind: "statement",
      region,
      processId: process.id,
      what: `${process.label} finishes and waits for its next trigger.`,
      why:
        process.trigger.kind === "posedge"
          ? `It is blocked on @(posedge ${process.trigger.signal}) again.`
          : process.trigger.kind === "clocking"
            ? `It is blocked on @(${process.trigger.clocking}) again.`
            : process.trigger.kind === "resume"
              ? `Its next delay${process.trigger.note ? ` (${process.trigger.note})` : ""} expires in a later time slot.`
              : "It waits for its inputs to change again.",
    });
  };

  const evaluateAssertion = (event: Extract<SchedulerEvent, { kind: "assertEval" }>, region: RegionId) => {
    const process = processes.get(event.processId);
    const spec = process?.assertion;
    if (!process || !spec) return;
    const holds = isTrue(evaluateExpr(spec.property, sampled, sampled));
    const outcome: AssertionOutcome = holds ? "pass" : "fail";
    const actions = assertionActions(process, spec, outcome);
    if (actions.length) queues.reactive.push({ kind: "assertAction", processId: process.id, outcome, pc: 0 });
    const sampledText = exprNames(spec.property, "sampled")
      .map((n) => `${n} = ${formatValue(sampled[n])}`)
      .join(", ");
    const whenEvaluated = sampledText
      ? `Property expressions are evaluated in the Observed region, after the active set has settled, but on the values sampled in ${slotTime === 0 ? "Preponed: at time 0, the default sampled values" : "Preponed"} (§4.4.2.5, §16.5.1).`
      : "Property expressions are evaluated in the Observed region, after the active set has settled (§4.4.2.5). This one reads no signal, so no sample matters.";
    push({
      kind: "statement",
      region,
      processId: process.id,
      assertion: { phase: "evaluate", outcome },
      what: `${process.label} evaluates ${exprToSource(spec.property)}${sampledText ? ` on the sampled values (${sampledText})` : ""}: it ${holds ? "passes" : "fails"}.`,
      why: `${whenEvaluated} ${
        usesDefaultError(spec, outcome)
          ? "It has no else clause, so the tool calls $error by default, unless $assertcontrol suppresses it (§16.14.1). The model runs that call with the fail code, which §4.4.2.5 schedules in the Reactive region."
          : actions.length
            ? `Its ${outcome} action block is scheduled in the Reactive region (§4.4.2.5).`
            : "It has no pass action block, so nothing more is scheduled."
      }`,
    });
  };

  const runAssertionAction = (event: Extract<SchedulerEvent, { kind: "assertAction" }>, region: RegionId) => {
    const process = processes.get(event.processId);
    const spec = process?.assertion;
    if (!process || !spec) return;
    const stmts = assertionActions(process, spec, event.outcome);
    const defaultError = usesDefaultError(spec, event.outcome);
    if (!executionOrder.includes(process.id)) executionOrder.push(process.id);
    push({
      kind: "wake",
      region,
      processId: process.id,
      assertion: { phase: "action", outcome: event.outcome },
      what: defaultError
        ? `${process.label} has no else clause, so its default $error runs.`
        : event.pc === 0
          ? `${process.label}'s ${event.outcome} action block runs.`
          : `${process.label}'s ${event.outcome} action block resumes after #0.`,
      why: defaultError
        ? "With the else clause omitted, the tool calls $error when the assertion fails, unless $assertcontrol suppresses it (§16.14.1). The model does not apply $assertcontrol, and a real tool words the message its own way. The model runs the call with the fail code, in the Reactive region (§4.4.2.5)."
        : event.pc === 0
          ? "Action blocks of concurrent assertions run in the Reactive region (§4.4.2.6), after the design's active set has settled. Plain reads here see current values; $sampled() still returns the Preponed sample (§16.9.3)."
          : "#0 in the reactive set resumes in Re-Inactive (§4.4.2.7).",
    });
    const outcome = runStatements(process, stmts, event.pc, region, (pc) => ({ kind: "assertAction", processId: process.id, outcome: event.outcome, pc }));
    if (outcome !== "done") return;
    push({
      kind: "statement",
      region,
      processId: process.id,
      assertion: { phase: "action", outcome: event.outcome },
      what: defaultError ? `${process.label}'s default $error finishes.` : `${process.label}'s action block finishes.`,
      why: "The assertion is evaluated again at its next clock tick, on fresh Preponed samples.",
    });
  };

  const isReady = (event: SchedulerEvent): event is Extract<SchedulerEvent, { kind: "evaluate" | "assertAction" }> =>
    event.kind === "evaluate" || event.kind === "assertAction";
  const readyLabel = (event: Extract<SchedulerEvent, { kind: "evaluate" | "assertAction" }>): string => {
    const label = processes.get(event.processId)?.label ?? event.processId;
    return event.kind === "assertAction" ? `${label}'s ${event.outcome} action` : label;
  };
  const isMovedNba = (event: SchedulerEvent) => {
    const from = origin.get(event);
    return from === "nba" || from === "reNba";
  };

  /** Picks the next event of a region. Ready processes at the head are a choice point. */
  const takeNext = (region: RegionId): SchedulerEvent => {
    const queue = queues[region];
    const head = queue[0];
    if (interleaveNba && head.kind === "update" && isMovedNba(head)) {
      const ready = queue.map((event, position) => ({ event, position })).filter((r) => isReady(r.event)) as { event: Extract<SchedulerEvent, { kind: "evaluate" | "assertAction" }>; position: number }[];
      if (ready.length > 0) {
        const movedFrom = origin.get(head) as RegionId;
        const updateRegion = REGION_LABELS[movedFrom];
        const pendingUpdates = queue.filter((e) => e.kind === "update" && origin.get(e) === movedFrom).length;
        const options = [`apply ${describeEvent(head, processes).label}`, ...ready.map((r) => `run ${readyLabel(r.event)}`)];
        const choicePoint = usedChoices.length;
        const requested = choices[choicePoint] ?? 0;
        const pick = Math.min(Math.max(requested, 0), options.length - 1);
        usedChoices.push(pick);
        choiceWidths.push(options.length);
        const chosen = pick === 0 ? head : ready[pick - 1].event;
        currentSource = origin.get(chosen);
        push({
          kind: "choice",
          region,
          processId: chosen.kind === "update" ? chosen.from : chosen.processId,
          what: `${REGION_LABELS[region]} holds ${pendingUpdates} pending ${updateRegion} update${pendingUpdates === 1 ? "" : "s"} and ${ready.length} woken process${ready.length === 1 ? "" : "es"}: ${options.join(", ")}. This run picks "${options[pick]}" first.`,
          why: `Once ${updateRegion} events have moved to ${REGION_LABELS[region]}, the loop may take any event from the region (${movedFrom === "reNba" ? "§4.4.2.8, " : ""}§4.5): the updates keep their order among themselves (§4.6), but a process woken by one of them may run before the rest are applied. Code whose result depends on this is a race.`,
          choice: { options, picked: options[pick] },
        });
        if (pick === 0) return queue.shift() as SchedulerEvent;
        queue.splice(ready[pick - 1].position, 1);
        return chosen;
      }
    }
    if (!isReady(head)) return queue.shift() as SchedulerEvent;
    let runEnd = 0;
    while (runEnd < queue.length && isReady(queue[runEnd])) runEnd += 1;
    const ready = queue
      .slice(0, runEnd)
      .map((event, position) => ({ event: event as Extract<SchedulerEvent, { kind: "evaluate" | "assertAction" }>, position }))
      .sort((a, b) => (declarationIndex.get(a.event.processId) ?? 0) - (declarationIndex.get(b.event.processId) ?? 0));
    if (ready.length === 1) return queue.shift() as SchedulerEvent;
    const choicePoint = usedChoices.length;
    const requested = choices[choicePoint] ?? 0;
    const pick = Math.min(Math.max(requested, 0), ready.length - 1);
    usedChoices.push(pick);
    choiceWidths.push(ready.length);
    const chosen = ready[pick];
    const labels = ready.map((r) => readyLabel(r.event));
    currentSource = origin.get(chosen.event);
    push({
      kind: "choice",
      region,
      processId: chosen.event.processId,
      what: `${labels.length} processes are ready in ${REGION_LABELS[region]}: ${labels.join(", ")}. This run executes ${labels[pick]} first.`,
      why: "IEEE 1800 allows ready processes in the same region to run in any order. Code whose result depends on this choice contains a race.",
      choice: { options: labels, picked: labels[pick] },
    });
    queue.splice(chosen.position, 1);
    return chosen.event;
  };

  const executeEvent = (event: SchedulerEvent, region: RegionId) => {
    currentSource = origin.get(event);
    switch (event.kind) {
      case "update":
        applyUpdate(event, region);
        break;
      case "evaluate":
        runProcess(event, region);
        break;
      case "assertEval":
        evaluateAssertion(event, region);
        break;
      case "assertAction":
        runAssertionAction(event, region);
        break;
      case "clockingEvent": {
        const woken: string[] = [];
        const wokenByContext: Record<SvProcess["context"], string[]> = { module: [], program: [] };
        for (const process of scenario.processes) {
          const t = process.trigger;
          if (t.kind !== "clocking" || t.clocking !== event.clocking || !waiting.has(process.id)) continue;
          waiting.delete(process.id);
          queues[regionFor(process)].push({ kind: "evaluate", processId: process.id, pc: 0, reason: `@(${event.clocking}) fired in Observed.` });
          woken.push(process.label);
          wokenByContext[process.context].push(process.label);
        }
        const runsWhere = [
          wokenByContext.module.length ? ` Module code waiting on it (${wokenByContext.module.join(", ")}) runs in the first Active region after Observed (§14.10).` : "",
          wokenByContext.program.length ? ` Program code waiting on it (${wokenByContext.program.join(", ")}) runs in Reactive (§24.3.1).` : "",
        ].join("");
        push({
          kind: "wake",
          region,
          what: `Clocking block event @(${event.clocking}) triggers${woken.length ? ` and wakes ${woken.join(", ")}` : ""}.`,
          why: `A clocking block event is triggered in the Observed region (§14.10), after the design's NBA updates for this edge.${runsWhere}`,
        });
        break;
      }
      case "print": {
        const process = processes.get(event.processId);
        const stmt = process ? processStatements(process).find((s) => s.id === event.stmtId) : undefined;
        const formatted = stmt && stmt.kind === "strobe" ? formatPrint(stmt, values, sampled, slotTime) : "";
        const text = `$strobe: ${formatted}`;
        log.push(text);
        push({
          kind: "print",
          region,
          processId: event.processId,
          stmtId: event.stmtId,
          what: `Prints ${formatted}.`,
          why: "Postponed is read-only: these are the final settled values of the time slot.",
        });
        break;
      }
    }
  };

  const drainSet = (set: RegionId[], home: RegionId) => {
    const anyNonEmpty = () => set.some((r) => queues[r].length > 0);
    while (!ended && anyNonEmpty()) {
      currentRegion = home;
      while (!ended && queues[home].length > 0) {
        executeEvent(takeNext(home), home);
      }
      if (ended) return;
      currentSource = undefined;
      const next = set.find((r) => queues[r].length > 0);
      if (next && next !== home) {
        const moved = queues[next].map((e) => describeEvent(e, processes).label);
        delta += 1;
        currentRegion = next;
        push({
          kind: "move",
          region: next,
          what: `${REGION_LABELS[home]} is empty. ${moved.length} ${REGION_LABELS[next]} event${moved.length === 1 ? " moves" : "s move"} to ${REGION_LABELS[home]}: ${moved.join(", ")}.`,
          why: `The scheduler only advances to ${REGION_LABELS[next]} once every earlier region of this loop is empty. Moving events back adds one to the model's Δ count; simulation time does not change.`,
        });
        queues[next].forEach((e) => origin.set(e, next));
        queues[home].push(...queues[next]);
        queues[next] = [];
      }
    }
  };

  // Preponed: snapshot values for clocking-block inputs and assertions.
  currentRegion = "preponed";
  push({
    kind: "slot-start",
    what: `Time slot begins. ${formatSignals(scenario.watch, values)}.`,
    why: SLOT_START_WHY,
  });

  // Concurrent assertions take their samples here (§16.5.1).
  for (const process of scenario.processes) {
    if (!isAssertion(process)) continue;
    const names = assertionSampledSignals(process);
    if (names.length === 0) continue;
    push({
      kind: "sample",
      processId: process.id,
      assertion: { phase: "sample" },
      what: `${process.label} samples ${names.map((n) => `${n} = ${formatValue(sampled[n])}`).join(", ")}.`,
      why:
        slotTime === 0
          ? "At time 0 a concurrent assertion reads default sampled values (§16.5.1). The model's start values stand for static-variable declaration initializers, which is what those defaults are. $sampled() returns the same values later in the slot (§16.9.3). The property itself is not evaluated until Observed."
          : "A concurrent assertion reads sampled values: the values its signals had in Preponed, before anything in this slot changes (§16.5.1). $sampled() returns the same values later in the slot (§16.9.3). The property itself is not evaluated until Observed.",
    });
  }

  // Processes ready at slot start, a #d that expired at this time or a procedure starting at time 0 (§4.5): in Active, or Reactive for program context (§24.3.1).
  for (const process of scenario.processes) {
    if (isAssertion(process) || process.trigger.kind !== "resume") continue;
    waiting.delete(process.id);
    queues[regionFor(process)].push({
      kind: "evaluate",
      processId: process.id,
      pc: 0,
      reason: process.trigger.note
        ? `Ready at the start of the slot: ${process.trigger.note}.`
        : slotTime === 0
          ? "Ready at the start of the slot: the procedure starts at time 0."
          : "Ready at the start of the slot: its delay expired at this time.",
    });
  }

  // The clock generator's blocking update is the triggering event, unless a scenario process drives the clock.
  if ((scenario.clockSource ?? "implicit") === "implicit") {
    queues.active.push({
      kind: "update",
      target: scenario.clock,
      value: 1,
      from: "clock",
      reason: `The clock generator drives ${scenario.clock} high.`,
    });
  }
  currentRegion = "active";

  const reactiveHasWork = () => REACTIVE_SET.some((r) => queues[r].length > 0);
  const activeHasWork = () => ACTIVE_SET.some((r) => queues[r].length > 0);
  let guard = 0;
  while (!ended && (activeHasWork() || reactiveHasWork())) {
    guard += 1;
    if (guard > 50) throw new Error(`Scenario ${scenario.id} did not settle`);
    drainSet(ACTIVE_SET, "active");
    if (!ended && reactiveHasWork()) {
      currentRegion = "reactive";
      drainSet(REACTIVE_SET, "reactive");
    }
  }

  if (ended) {
    // The closing step is no event of any region; without this it inherits the source region of the event that ended the run.
    currentSource = undefined;
    const pending = REGION_ORDER.reduce((n, r) => n + queues[r].length, 0);
    push({
      kind: "slot-end",
      endedBy: ended.cause,
      what: `Simulation ended at t = ${slotTime} ${timeUnit} by ${ended.cause === "finish" ? "$finish" : "an implicit $finish"}. ${formatSignals(scenario.watch, values)}.`,
      why: `${pending ? `${pending} queued event${pending === 1 ? "" : "s"} never execute${pending === 1 ? "s" : ""}` : "No queued event remains"}: after the final procedures, no remaining scheduled event executes (§9.2.3).`,
    });
  } else {
    currentRegion = "postponed";
    while (queues.postponed.length > 0) {
      executeEvent(queues.postponed.shift() as SchedulerEvent, "postponed");
    }
    push({
      kind: "slot-end",
      what: `Time slot settles. ${formatSignals(scenario.watch, values)}.`,
      why: "Simulation time can now advance. These are the values the next clock edge will see.",
    });
  }

  return {
    scenarioId: scenario.id,
    choices: usedChoices,
    choiceWidths,
    trace,
    finalValues: { ...values },
    log: [...log],
    executionOrder,
    slotTime,
    ...(ended ? { finished: ended } : {}),
  };
}

function outcomeSignature(result: SimulationResult, watch: string[]): string {
  return `${watch.map((s) => `${s}=${formatValue(result.finalValues[s])}`).join(",")}|${result.log.join(";")}`;
}

/** Explores every legal ordering of ready processes and groups distinct outcomes. */
export function exploreOrderings(scenario: SvScenario): ExplorationResult {
  const groups = new Map<string, OutcomeGroup>();
  const stack: number[][] = [[]];
  let runCount = 0;
  while (stack.length > 0) {
    const prefix = stack.pop() as number[];
    const result = simulateTimeSlot(scenario, prefix);
    runCount += 1;
    if (runCount > MAX_RUNS) throw new Error(`Scenario ${scenario.id} exceeded ${MAX_RUNS} orderings`);
    // Branch on every choice point beyond the forced prefix.
    for (let i = result.choices.length - 1; i >= prefix.length; i -= 1) {
      for (let alt = 1; alt < result.choiceWidths[i]; alt += 1) {
        stack.push([...result.choices.slice(0, i), alt]);
      }
    }
    const signature = outcomeSignature(result, scenario.watch);
    const group = groups.get(signature);
    const run = { choices: result.choices, executionOrder: result.executionOrder };
    if (group) {
      group.runs.push(run);
    } else {
      groups.set(signature, { signature, finalValues: result.finalValues, log: result.log, runs: [run] });
    }
  }
  const outcomes = [...groups.values()];
  return { deterministic: outcomes.length === 1, outcomes, runCount };
}

export function withAssignmentOp(scenario: SvScenario, stmtId: string, op: "blocking" | "nba"): SvScenario {
  return {
    ...scenario,
    processes: scenario.processes.map((process) => ({
      ...process,
      body: process.body.map((stmt) => (stmt.kind === "assign" && stmt.id === stmtId ? { ...stmt, op } : stmt)),
    })),
  };
}

export function withZeroDelay(scenario: SvScenario, processId: string, enabled: boolean): SvScenario {
  return {
    ...scenario,
    processes: scenario.processes.map((process) => {
      if (process.id !== processId) return process;
      const hasDelay = process.body[0]?.kind === "delay0";
      if (enabled === hasDelay) return process;
      return {
        ...process,
        body: enabled ? [{ kind: "delay0", id: `${process.id}-d0` } as Statement, ...process.body] : process.body.slice(1),
      };
    }),
  };
}

/** Turns the `interleaveNba` option on or off without touching anything else. */
export function withInterleaveNba(scenario: SvScenario, enabled: boolean): SvScenario {
  return { ...scenario, options: { ...scenario.options, interleaveNba: enabled } };
}

export interface RaceHazard {
  variable: string;
  writer: { processId: string; stmtId: string };
  reader: { processId: string; stmtId: string };
  explanation: string;
}

function readsOf(stmt: Statement): string[] {
  if (stmt.kind === "assign" || stmt.kind === "cbDrive") {
    return exprNames(stmt.expr, "live");
  }
  if (stmt.kind === "display") return stmt.args ? stmt.args.flatMap((a) => exprNames(a.expr, "live")) : stmt.signals;
  return [];
}

function triggerKey(trigger: ProcessTrigger): string {
  switch (trigger.kind) {
    case "posedge":
      return `posedge:${trigger.signal}`;
    case "change":
      return `change:${trigger.signals.join(",")}`;
    case "clocking":
      return `clocking:${trigger.clocking}`;
    case "resume":
      return "resume";
  }
}

/**
 * Static check for the classic write/read race: a variable written with a
 * blocking assignment by one process and read by another process that wakes
 * on the same event in the same region set, before any #0, #d or $finish
 * separates them.
 * Concurrent assertions read Preponed samples, so they never take part.
 */
export function findRaceHazards(scenario: SvScenario): RaceHazard[] {
  const hazards: RaceHazard[] = [];
  const procedural = scenario.processes.filter((p) => p.kind !== "assertion");
  const firstSegment = (p: SvProcess) => {
    // #0 resumes later in this slot, #d resumes in a later slot (§9.4.1) and $finish ends the run (§20.2): nothing after any of them shares the first segment's turn.
    const stopAt = p.body.findIndex((s) => s.kind === "delay0" || s.kind === "delay" || s.kind === "finish");
    return { stmts: stopAt === -1 ? p.body : p.body.slice(0, stopAt), delayed: p.body[0]?.kind === "delay0" };
  };
  for (const writer of procedural) {
    for (const reader of procedural) {
      if (writer.id === reader.id) continue;
      if (triggerKey(writer.trigger) !== triggerKey(reader.trigger) || writer.context !== reader.context) continue;
      const w = firstSegment(writer);
      const r = firstSegment(reader);
      if (w.delayed !== r.delayed) continue;
      for (const ws of w.stmts) {
        if (ws.kind !== "assign" || ws.op !== "blocking") continue;
        const rs = r.stmts.find((s) => readsOf(s).includes(ws.target));
        if (!rs) continue;
        hazards.push({
          variable: ws.target,
          writer: { processId: writer.id, stmtId: ws.id },
          reader: { processId: reader.id, stmtId: rs.id },
          explanation: `${writer.label} writes ${ws.target} with a blocking assignment while ${reader.label} reads ${ws.target}; both wake on the same event in the same region, so the value ${reader.label} sees depends on execution order.`,
        });
      }
    }
  }
  return hazards;
}
