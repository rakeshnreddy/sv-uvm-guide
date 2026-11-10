/**
 * Deferred reporting over one SystemVerilog time slot (IEEE 1800-2023).
 *
 * A post-processing model over the trace of `simulateTimeSlot`
 * (sv-scheduler-model.ts): the scheduler runs the slot and records where each
 * trace-only `check` and `assertcontrol` statement executed; this model
 * decides what becomes of the report each check produces. The slot loop is
 * not duplicated here.
 *
 * Rules implemented (each names its clause where it is applied):
 * - §12.4.2.1, §12.5.3.1: a unique/unique0/priority violation check is
 *   evaluated when the statement executes; the report is deferred to the
 *   Observed region and waits on a queue of the executing process.
 * - §12.4.2.2, §12.5.3.2: a check inside a function called by two processes
 *   is queued separately for each caller.
 * - Flush points (§12.4.2.1, §16.4.2): the procedure resumes after an event
 *   control or wait, or an always_comb/always_latch resumes on a transition of
 *   a dependent signal. Flushing discards every pending report of the process.
 *   A resume after a delay control (#d, #0) is not a flush point.
 * - §12.4.2.1: in Observed each pending violation report matures and can no
 *   longer be flushed; a tool-specific mechanism then reports it.
 * - §16.3: a simple immediate assertion acts at once. Its expression is read
 *   like an if condition: x, z or 0 fail.
 * - §16.4.1: an observed deferred (#0) report matures in Observed and its
 *   action runs in Reactive; a final deferred report matures in Postponed and
 *   its action is scheduled there. A Reactive-to-Active loop can still glitch
 *   the observed form; Postponed is not iterative, so the final form cannot.
 * - §20.11 (Tables 20-5 and 20-6): $assertcontrol Off (4) keeps queued
 *   reports, which "may still mature", and queues no new ones; Kill (5)
 *   flushes queued reports that have not matured and queues no new ones; On
 *   (3) enables them again. assertion_type selects the types by bit.
 *
 * Scope and limits (also shown to learners):
 * - A scenario process that runs at slot start (`resume`) cannot also wait on
 *   its inputs in the scheduler model, so an always_comb is given as two
 *   scheduler processes: its time-0 run (§9.2.2.2) and its input-triggered
 *   runs. This model maps both to one procedure with one report queue.
 *   Scenarios are built so the second never wakes before the first has run.
 * - The scheduler explores the order of processes ready in the same region
 *   (§4.7); it does not interleave statements within a process.
 * - Only what decides the reports is modelled: seed assignments, case items
 *   and branch bodies that only assign outputs are shown but not run.
 * - The wording, severity and exact moment of the tool's violation message
 *   are tool-specific (§12.4.2.1); the model shows the report where it matures.
 */

import {
  ASSERTION_TYPE_BITS,
  ASSERT_CONTROL_TYPES,
  REACTIVE_SET,
  findProcessStatement,
  isViolation,
  simulateTimeSlot,
  slotTimeLabel,
  type AssertControlType,
  type Expr,
  type RegionId,
  type SimulationResult,
  type Statement,
  type SvProcess,
  type SvScenario,
  type SvValue,
  type TraceStep,
  type ViolationCheckResult,
  type ViolationQualifier,
} from "./sv-scheduler-model";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AssertForm = "immediate" | "observed" | "final";

export const ASSERT_FORM_LABELS: Record<AssertForm, string> = {
  immediate: "immediate assert (e)",
  observed: "observed deferred assert #0 (e)",
  final: "final deferred assert final (e)",
};

/** A violation check or an assertion that a scheduler `check` statement stands for. */
export type CheckSpec =
  | {
      kind: "violation";
      id: string;
      /** Shown in trays and reports, e.g. "unique case (state)". */
      label: string;
      qualifier: ViolationQualifier;
      construct: "case";
      select: string;
      items: { name: string; value: number }[];
    }
  | {
      kind: "violation";
      id: string;
      label: string;
      qualifier: ViolationQualifier;
      construct: "if";
      /** if / else if conditions, in order. No final else. */
      conditions: Expr[];
      /** The check sits in a function and this is the calling process (§12.4.2.2). */
      calledFrom?: string;
    }
  | {
      kind: "assertion";
      id: string;
      label: string;
      form: AssertForm;
      condition: Expr;
    };

export type ProcedureKind = "always_comb" | "always_ff" | "initial" | "program-initial" | "assign";

export interface ProcedureSpec {
  id: string;
  label: string;
  kind: ProcedureKind;
  /** Scheduler process ids that are this one procedure. */
  schedulerIds: string[];
  /** The scheduler process that is always_comb's time-0 run (§9.2.2.2). */
  timeZeroRunId?: string;
  /** The event control's edge, checked against Table 9-2 on every wake. */
  edge?: { signal: string; kind: "negedge" | "posedge" };
  /** Source line keys of this procedure, highlighted while it runs. */
  lineKeys: string[];
  owner: "design" | "testbench";
}

export interface SourceLineSpec {
  key?: string;
  text: string;
  owner?: "design" | "testbench";
}

export interface DeferredScenario {
  id: DeferredPresetId;
  title: string;
  scheduler: SvScenario;
  procedures: ProcedureSpec[];
  /** Check specs by id. */
  checks: Record<string, CheckSpec>;
  /** Scheduler `check` statement id → check spec id (a function called by two processes shares one spec). */
  checkOf: Record<string, string>;
  /** Scheduler statement id → source line key, when they differ. */
  lineOf: Record<string, string>;
  source: SourceLineSpec[];
  /** Display names of values, e.g. state 0 → RED. */
  valueNames?: Record<string, Record<number, string>>;
  /** Signals shown in the value panel. */
  watch: string[];
  /** Notes about this scenario's modelling, shown with the assumptions. */
  notes: string[];
}

export type TicketKind = "violation" | "observed" | "final";

export type TicketStatus =
  /** On the queue. */
  | "pending"
  /** Joined the queue at this step. */
  | "queued"
  /** Discarded at a flush point. */
  | "flushed"
  /** Flushed by $assertcontrol Kill. */
  | "killed"
  /** Matured and reported. */
  | "matured"
  /** Queued before Off: not flushed, "may still mature" (§20.11). */
  | "maybe"
  /** A violation was found, but Off or Kill kept it off the queue. */
  | "blocked";

export interface TicketView {
  id: string;
  checkId: string;
  label: string;
  kind: TicketKind;
  /** Values read by the check when it executed, e.g. "state = x". */
  detail: string;
  status: TicketStatus;
}

export type ReportKind = "violation" | "immediate" | "observed" | "final";

export interface ReportLine {
  id: string;
  kind: ReportKind;
  procedureId: string;
  checkId: string;
  text: string;
  /** False when §20.11 only says the report "may" still mature. */
  certain: boolean;
  stage: StripStage;
}

/** The compact region strip: Active → NBA → Observed → Reactive → Postponed. */
export type StripStage = "active" | "nba" | "observed" | "reactive" | "postponed";
export const STRIP_STAGES: StripStage[] = ["active", "nba", "observed", "reactive", "postponed"];
export const STRIP_LABELS: Record<StripStage, string> = {
  active: "Active",
  nba: "NBA",
  observed: "Observed",
  reactive: "Reactive",
  postponed: "Postponed",
};
/** Short names for the strip at phone width; the full name stays available to screen readers. */
export const STRIP_SHORT_LABELS: Record<StripStage, string> = {
  active: "Active",
  nba: "NBA",
  observed: "Obs.",
  reactive: "React.",
  postponed: "Post.",
};

export type ReportStepKind =
  | "start"
  | "choice"
  | "run"
  | "flush"
  | "check"
  | "assign"
  | "update"
  | "suspend"
  | "wait"
  | "control"
  | "observed"
  | "reactive"
  | "postponed"
  | "end";

export interface ReportStep {
  index: number;
  kind: ReportStepKind;
  stage: StripStage | null;
  procedureId?: string;
  lineKey?: string;
  text: string;
  /** Clauses the sentence rests on, e.g. ["§12.5.3.1"]. */
  clauses: string[];
  values: Record<string, SvValue>;
  trays: Record<string, TicketView[]>;
  reports: ReportLine[];
  /** Trace index of the scheduler step, when there is one. */
  traceIndex?: number;
}

export interface DeferredRun {
  steps: ReportStep[];
  reports: ReportLine[];
  /** Every ticket's final state, in queue order. */
  tickets: TicketView[];
  /** Violations kept off the queue by Off or Kill. */
  blocked: TicketView[];
  /** What the scheduler picked at each choice point. */
  picks: string[];
  choices: number[];
  sim: SimulationResult;
}

/* ------------------------------------------------------------------ */
/* Clause notes                                                        */
/* ------------------------------------------------------------------ */

export const DEFERRED_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §12.4.2.1, §12.4.2.2, §12.5.3.1 and §12.5.3.2 (violation reports), §16.3 and §16.4.1–§16.4.2 (immediate and deferred assertions) and §20.11 Tables 20-5 and 20-6 ($assertcontrol On, Off, Kill and the assertion_type bits).",
  "The time slot itself is run by the same scheduler model as the F3B region visualizer; this model only decides what happens to each report.",
  "A pending report is discarded at a flush point: the procedure resumes after an event control or wait, or an always_comb resumes on a change of an input (§12.4.2.1, §16.4.2). A resume after a delay (#d) is not one.",
  "The scheduler runs every order of the processes ready in the same region (§4.7) but does not interleave statements inside one process.",
  "An always_comb's time-0 run (§9.2.2.2) and its later runs are one procedure with one report queue.",
  "The wording, severity and exact moment of a violation message are tool-specific (§12.4.2.1). Only what decides the reports is run: seed assignments, case items and branch bodies that only assign outputs are shown, not executed.",
];

/* ------------------------------------------------------------------ */
/* Values and expressions                                              */
/* ------------------------------------------------------------------ */

/** A value as the lesson writes it: an enum name, x for unknown, otherwise the number. */
export function valueText(scenario: Pick<DeferredScenario, "valueNames">, name: string, value: SvValue | undefined): string {
  if (value === undefined || value === "X") return "x";
  return scenario.valueNames?.[name]?.[value] ?? String(value);
}

/** Literal text for a constant assigned to `target`: an enum name, or a 1-bit literal. */
export function literalText(scenario: Pick<DeferredScenario, "valueNames">, target: string, value: SvValue): string {
  if (value === "X") return "1'bx";
  const named = scenario.valueNames?.[target]?.[value];
  return named ?? `1'b${value}`;
}

/** Source text of an expression. `inv` is written `!`: on the 1-bit values used here, ! and ~ agree (§11.4.7, §11.4.8). */
export function exprText(expr: Expr): string {
  switch (expr.kind) {
    case "const":
      return expr.value === "X" ? "1'bx" : String(expr.value);
    case "var":
    case "sampledFn":
    case "sampled":
      return expr.name;
    case "inv":
      if (expr.expr.kind === "eq") return `${exprText(expr.expr.left)} != ${exprText(expr.expr.right)}`;
      return `!${exprText(expr.expr)}`;
    case "eq":
      return `${exprText(expr.left)} == ${exprText(expr.right)}`;
  }
}

/** Names an expression reads, in order, without repeats. */
export function exprReads(expr: Expr): string[] {
  const out: string[] = [];
  const walk = (e: Expr) => {
    if (e.kind === "var" || e.kind === "sampled" || e.kind === "sampledFn") {
      if (!out.includes(e.name)) out.push(e.name);
    } else if (e.kind === "inv") walk(e.expr);
    else if (e.kind === "eq") {
      walk(e.left);
      walk(e.right);
    }
  };
  walk(expr);
  return out;
}

/**
 * Evaluates an expression on the values a check saw. `==` gives x when either
 * side is x (§11.4.5); `!` of x is x. Only 1-bit values reach `!`.
 */
export function evaluate(expr: Expr, values: Record<string, SvValue>): SvValue {
  switch (expr.kind) {
    case "const":
      return expr.value;
    case "var":
    case "sampled":
    case "sampledFn":
      return values[expr.name] ?? "X";
    case "inv": {
      const v = evaluate(expr.expr, values);
      if (v === "X") return "X";
      if (v === 0) return 1;
      if (v === 1) return 0;
      throw new Error(`! is modelled for 1-bit values only, not ${v}`);
    }
    case "eq": {
      const l = evaluate(expr.left, values);
      const r = evaluate(expr.right, values);
      if (l === "X" || r === "X") return "X";
      return l === r ? 1 : 0;
    }
  }
}

/** §12.4 and §16.3: a condition is true unless it is 0, x or z. */
export function isTrue(value: SvValue): boolean {
  return value !== "X" && value !== 0;
}

/** Signals a check reads. */
export function checkReads(check: CheckSpec): string[] {
  if (check.kind === "assertion") return exprReads(check.condition);
  if (check.construct === "case") return [check.select];
  const out: string[] = [];
  check.conditions.forEach((c) => exprReads(c).forEach((n) => (out.includes(n) ? null : out.push(n))));
  return out;
}

export interface CheckEvaluation {
  /** Violation checks: the result; assertions: pass or fail. */
  result: ViolationCheckResult | "fail";
  violation: boolean;
  /** "state = x" */
  detail: string;
  /** What was found, e.g. "no case item matches state = x". */
  finding: string;
}

/**
 * Evaluates a check on the values its process saw when it executed.
 * - case (§12.5): the select is compared with each item using case equality;
 *   an x select matches none of the known items.
 * - if (§12.4): each condition is true unless 0 or x; unique counts every
 *   true condition, so two true conditions overlap.
 * - assertion (§16.3): the expression fails on 0 or x.
 * The verdict for violation checks comes from `isViolation` (§12.4.2, §12.5.3).
 */
export function evaluateCheck(scenario: Pick<DeferredScenario, "valueNames">, check: CheckSpec, values: Record<string, SvValue>): CheckEvaluation {
  const reads = checkReads(check);
  const detail = reads.map((n) => `${n} = ${valueText(scenario, n, values[n])}`).join(", ");
  if (check.kind === "assertion") {
    const v = evaluate(check.condition, values);
    const holds = isTrue(v);
    const shown = v === "X" ? "x" : String(v);
    return {
      result: holds ? "pass" : "fail",
      violation: !holds,
      detail,
      finding: `${exprText(check.condition)} is ${shown}`,
    };
  }
  if (check.construct === "case") {
    const sel = values[check.select] ?? "X";
    const matches = sel === "X" ? [] : check.items.filter((i) => i.value === sel);
    const result: ViolationCheckResult = matches.length === 0 ? "no-match" : matches.length === 1 ? "pass" : "multiple-match";
    const finding =
      matches.length === 0
        ? `no case item matches ${check.select} = ${valueText(scenario, check.select, sel)}`
        : matches.length === 1
          ? `exactly one item, ${matches[0].name}, matches`
          : `${matches.length} items match`;
    return { result, violation: isViolation(check.qualifier, result), detail, finding };
  }
  const truths = check.conditions.map((c) => isTrue(evaluate(c, values)));
  const trueCount = truths.filter(Boolean).length;
  const result: ViolationCheckResult = trueCount === 0 ? "no-match" : trueCount === 1 ? "pass" : "multiple-match";
  const names = check.conditions.map((c) => exprText(c));
  const finding =
    trueCount === 0
      ? `no condition is true (${names.join(", ")}) and there is no else`
      : trueCount === 1
        ? `exactly one condition, ${names[truths.indexOf(true)]}, is true`
        : `${trueCount} conditions are true at once (${names.filter((_, i) => truths[i]).join(" and ")}): they overlap`;
  return { result, violation: isViolation(check.qualifier, result), detail, finding };
}

/* ------------------------------------------------------------------ */
/* Assertion control                                                   */
/* ------------------------------------------------------------------ */

/** The Table 20-6 bit for a check. */
export function assertionTypeBit(check: CheckSpec): number {
  if (check.kind === "assertion") {
    if (check.form === "immediate") return ASSERTION_TYPE_BITS.simpleImmediate;
    if (check.form === "observed") return ASSERTION_TYPE_BITS.observedDeferredImmediate;
    return ASSERTION_TYPE_BITS.finalDeferredImmediate;
  }
  return ASSERTION_TYPE_BITS[check.qualifier];
}

const TYPE_BIT_NAMES: [number, string][] = [
  [1, "Concurrent"],
  [2, "SimpleImmediate"],
  [4, "ObservedDeferredImmediate"],
  [8, "FinalDeferredImmediate"],
  [16, "Expect"],
  [32, "Unique"],
  [64, "Unique0"],
  [128, "Priority"],
];

/** "Unique | Unique0 | Priority" for 224 (Table 20-6). */
export function describeAssertionType(mask: number): string {
  const names = TYPE_BIT_NAMES.filter(([bit]) => (mask & bit) !== 0).map(([, n]) => n);
  return names.length ? names.join(" | ") : "nothing";
}

/** The sum written out, e.g. "32 + 64 + 128". */
export function assertionTypeSum(mask: number): string {
  return TYPE_BIT_NAMES.filter(([bit]) => (mask & bit) !== 0)
    .map(([bit]) => String(bit))
    .join(" + ");
}

type ControlState = "on" | "off" | "kill";

/* ------------------------------------------------------------------ */
/* Ticket helpers                                                      */
/* ------------------------------------------------------------------ */

function ticketKind(check: CheckSpec): TicketKind {
  if (check.kind === "violation") return "violation";
  return check.form === "final" ? "final" : "observed";
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function joinAnd(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Clauses for a violation report of a construct. */
function violationClause(check: CheckSpec): string {
  return check.kind === "violation" && check.construct === "case" ? "§12.5.3.1" : "§12.4.2.1";
}

function ruleClause(check: CheckSpec): string {
  return check.kind === "violation" && check.construct === "case" ? "§12.5.3" : "§12.4.2";
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Rejects scenarios this model cannot narrate faithfully. */
export function validateDeferredScenario(scenario: DeferredScenario): void {
  const owner = new Map<string, string>();
  for (const proc of scenario.procedures) {
    for (const id of proc.schedulerIds) {
      if (owner.has(id)) throw new Error(`Scheduler process ${id} belongs to two procedures`);
      owner.set(id, proc.id);
    }
  }
  if ((scenario.scheduler.clockings ?? []).length > 0) throw new Error(`${scenario.id}: clocking blocks put events in Observed, which this model does not narrate`);
  for (const process of scenario.scheduler.processes) {
    if (!owner.has(process.id)) throw new Error(`${scenario.id}: scheduler process ${process.id} has no procedure`);
    if (process.kind === "assertion") throw new Error(`${scenario.id}: concurrent assertions are outside this model`);
    const hasCheck = process.body.some((s) => s.kind === "check");
    for (const stmt of process.body) {
      if (stmt.kind === "display" || stmt.kind === "strobe" || stmt.kind === "finish" || stmt.kind === "cbDrive") {
        throw new Error(`${scenario.id}: ${stmt.kind} statements are outside this model`);
      }
      if (hasCheck && (stmt.kind === "delay0" || stmt.kind === "delay")) {
        throw new Error(`${scenario.id}: ${process.id} holds a check and a delay; a resume after a delay is not a flush point, which this model does not narrate`);
      }
      if (stmt.kind === "check" && !scenario.checks[scenario.checkOf[stmt.id] ?? stmt.id]) {
        throw new Error(`${scenario.id}: check statement ${stmt.id} has no check spec`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Run analysis                                                        */
/* ------------------------------------------------------------------ */

function stageOf(step: TraceStep): StripStage | null {
  if (step.kind === "slot-start") return null;
  if (step.sourceRegion === "nba" || step.region === "nba") return "nba";
  if (REACTIVE_SET.includes(step.region)) return "reactive";
  if (step.region === "postponed") return "postponed";
  if (step.region === "observed") return "observed";
  return "active";
}

function inActiveSet(region: RegionId): boolean {
  return region === "active" || region === "inactive" || region === "nba" || region === "observed";
}

interface LiveTicket extends TicketView {
  procedureId: string;
  typeBit: number;
  check: CheckSpec;
  /** Set once Off has acted on it while it was pending. */
  keptByOff?: boolean;
}

/**
 * Runs one order of the slot (the scheduler `choices`) and decides every
 * report. Each sentence is generated here, from the trace and the check specs.
 */
export function analyzeRun(scenario: DeferredScenario, choices: number[] = []): DeferredRun {
  validateDeferredScenario(scenario);
  const sim = simulateTimeSlot(scenario.scheduler, choices);
  // §9.2.3: after $finish no later region runs, so neither Observed nor Postponed would mature anything; the model does not narrate that.
  if (sim.finished) throw new Error(`${scenario.id}: the run ends by $finish inside the slot, which this model does not narrate`);
  const slot = slotTimeLabel(scenario.scheduler);
  const procOf = new Map<string, ProcedureSpec>();
  scenario.procedures.forEach((p) => p.schedulerIds.forEach((id) => procOf.set(id, p)));
  const processById = new Map<string, SvProcess>(scenario.scheduler.processes.map((p) => [p.id, p]));
  const hasChecks = (proc: ProcedureSpec) =>
    proc.schedulerIds.some((id) => processById.get(id)?.body.some((s) => s.kind === "check"));

  const queues: Record<string, LiveTicket[]> = Object.fromEntries(scenario.procedures.map((p) => [p.id, []]));
  const all: LiveTicket[] = [];
  const blocked: TicketView[] = [];
  const reports: ReportLine[] = [];
  const control: Record<number, ControlState> = {};
  const picks: string[] = [];
  const steps: ReportStep[] = [];
  /** Tickets whose status changed at the step being built: shown in the tray once more. */
  let transient: LiveTicket[] = [];
  let ticketSeq = 0;
  /** Values when each procedure last ran, to name what changed when it resumes. */
  const lastSeen = new Map<string, Record<string, SvValue>>();
  let values: Record<string, SvValue> = { ...scenario.scheduler.initial };

  const view = (t: LiveTicket): TicketView => ({ id: t.id, checkId: t.checkId, label: t.label, kind: t.kind, detail: t.detail, status: t.status });

  const push = (step: Omit<ReportStep, "index" | "values" | "trays" | "reports"> & { extra?: Record<string, TicketView[]> }) => {
    const trays: Record<string, TicketView[]> = {};
    for (const proc of scenario.procedures) {
      const shown = [...queues[proc.id], ...transient.filter((t) => t.procedureId === proc.id && !queues[proc.id].includes(t))];
      trays[proc.id] = [...shown.map(view), ...(step.extra?.[proc.id] ?? [])];
    }
    const { extra: _extra, ...rest } = step;
    void _extra;
    steps.push({ ...rest, index: steps.length, values: { ...values }, trays, reports: [...reports] });
    transient = [];
    // A ticket that only queued at this step is pending from the next one on.
    for (const t of all) if (t.status === "queued") t.status = "pending";
  };

  const procLabel = (id: string) => scenario.procedures.find((p) => p.id === id)?.label ?? id;
  const lineFor = (stmtId?: string) => (stmtId ? (scenario.lineOf[stmtId] ?? stmtId) : undefined);

  const changedSince = (proc: ProcedureSpec, signals: string[]): { name: string; from: SvValue; to: SvValue }[] => {
    const before = lastSeen.get(proc.id) ?? scenario.scheduler.initial;
    return signals.filter((s) => (before[s] ?? "X") !== (values[s] ?? "X")).map((s) => ({ name: s, from: before[s] ?? "X", to: values[s] ?? "X" }));
  };

  const describeChanges = (changes: { name: string; from: SvValue; to: SvValue }[]) =>
    joinAnd(changes.map((c) => `${c.name} ${valueText(scenario, c.name, c.from)} → ${valueText(scenario, c.name, c.to)}`));

  /** §12.4.2.1 Observed: every pending violation and #0 report matures. */
  const observed = () => {
    const pending = scenario.procedures.flatMap((p) => queues[p.id].filter((t) => t.kind !== "final"));
    const matured: LiveTicket[] = [];
    const maybe: LiveTicket[] = [];
    for (const t of pending) {
      queues[t.procedureId] = queues[t.procedureId].filter((q) => q !== t);
      const offNow = control[t.typeBit] === "off";
      if (t.keptByOff && offNow) {
        t.status = "maybe";
        maybe.push(t);
      } else {
        t.status = "matured";
        matured.push(t);
      }
    }
    transient = [...matured, ...maybe];
    const proc = (t: LiveTicket) => procLabel(t.procedureId);
    for (const t of [...matured, ...maybe]) {
      if (t.kind === "violation") {
        reports.push({
          id: t.id,
          kind: "violation",
          procedureId: t.procedureId,
          checkId: t.checkId,
          text: `${proc(t)}: ${t.label} violation, ${t.detail}${t.status === "maybe" ? " (may still mature under Off)" : ""}`,
          certain: t.status === "matured",
          stage: "observed",
        });
      }
    }
    const violations = [...matured, ...maybe].filter((t) => t.kind === "violation");
    const deferred = [...matured, ...maybe].filter((t) => t.kind === "observed");
    const clauses = new Set<string>();
    let text: string;
    if (pending.length === 0) {
      text = "Observed region: no report is pending, so nothing matures and nothing is reported.";
      clauses.add("§12.4.2.1");
    } else {
      const parts: string[] = [];
      const certainV = violations.filter((t) => t.status === "matured");
      if (certainV.length) {
        parts.push(`${plural(certainV.length, "pending violation report")} ${certainV.length === 1 ? "matures" : "mature"} and can no longer be flushed: ${joinAnd(certainV.map((t) => `${proc(t)}'s ${t.label} (${t.detail})`))}. The tool reports ${certainV.length === 1 ? "it" : "them"} in its own words.`);
        certainV.forEach((t) => clauses.add(violationClause(t.check)));
      }
      const maybeV = violations.filter((t) => t.status === "maybe");
      if (maybeV.length) {
        parts.push(`${joinAnd(maybeV.map((t) => `${proc(t)}'s ${t.label} report`))} was queued before Off, which does not flush it: it "may still mature" (§20.11). Whether it is printed is left to the tool.`);
        clauses.add("§20.11");
      }
      if (deferred.length) {
        parts.push(`${plural(deferred.length, "pending #0 report")} ${deferred.length === 1 ? "matures" : "mature"}: ${joinAnd(deferred.map((t) => `${t.label} (${t.detail})`))}. ${deferred.length === 1 ? "Its $error runs" : "Their $error calls run"} in Reactive.`);
        clauses.add("§16.4.1");
      }
      text = `Observed region: ${parts.join(" ")}`;
    }
    push({ kind: "observed", stage: "observed", text, clauses: [...clauses] });
    if (deferred.length) {
      for (const t of deferred) {
        reports.push({
          id: t.id,
          kind: "observed",
          procedureId: t.procedureId,
          checkId: t.checkId,
          text: `${t.label} failed: $error in Reactive, with ${t.detail} from when it was queued`,
          certain: t.status === "matured",
          stage: "reactive",
        });
      }
      push({
        kind: "reactive",
        stage: "reactive",
        text: `Reactive region: the matured #0 report${deferred.length === 1 ? "" : "s"} of ${joinAnd(deferred.map((t) => t.label))} ${deferred.length === 1 ? "runs its" : "run their"} $error now (§16.4.1). Program code ready in Reactive may run before or after it; the count is the same.`,
        clauses: ["§16.4.1"],
      });
    }
  };

  /** §16.4.1 Postponed: pending final reports mature and their $error runs there. */
  const postponed = () => {
    const pending = scenario.procedures.flatMap((p) => queues[p.id].filter((t) => t.kind === "final"));
    const hasFinal = Object.values(scenario.checks).some((c) => c.kind === "assertion" && c.form === "final");
    if (!hasFinal && pending.length === 0) return;
    for (const t of pending) {
      queues[t.procedureId] = queues[t.procedureId].filter((q) => q !== t);
      t.status = control[t.typeBit] === "off" && t.keptByOff ? "maybe" : "matured";
      reports.push({
        id: t.id,
        kind: "final",
        procedureId: t.procedureId,
        checkId: t.checkId,
        text: `${t.label} failed: $error in Postponed, with ${t.detail}`,
        certain: t.status === "matured",
        stage: "postponed",
      });
    }
    transient = pending;
    push({
      kind: "postponed",
      stage: "postponed",
      text: pending.length
        ? `Postponed region: the pending final report${pending.length === 1 ? "" : "s"} of ${joinAnd(pending.map((t) => `${t.label} (${t.detail})`))} ${pending.length === 1 ? "matures" : "mature"}; the $error is scheduled in this same Postponed region (§16.4.1). Postponed does not loop back, so no later pass can add a glitch.`
        : "Postponed region: no final deferred report is pending, so nothing matures here (§16.4.1).",
      clauses: ["§16.4.1"],
    });
  };

  let inActive = true;
  sim.trace.forEach((step, traceIndex) => {
    values = { ...step.values };
    if (step.kind !== "slot-start" && step.kind !== "slot-end") {
      const nowActive = inActiveSet(step.region);
      if (inActive && !nowActive) {
        // The active set has drained: Observed is reached before Reactive or Postponed (§4.4.2.5, §4.5).
        values = { ...(sim.trace[traceIndex - 1]?.values ?? values) };
        observed();
        values = { ...step.values };
      }
      inActive = nowActive;
    }
    const stage = stageOf(step);
    const proc = step.processId ? procOf.get(step.processId) : undefined;
    const process = step.processId ? processById.get(step.processId) : undefined;

    switch (step.kind) {
      case "slot-start": {
        push({
          kind: "start",
          stage: null,
          text: `Time slot ${slot} begins with ${joinAnd(scenario.watch.map((n) => `${n} = ${valueText(scenario, n, values[n])}`))}. Every report queue is empty.`,
          clauses: [],
          traceIndex,
        });
        return;
      }
      case "choice": {
        const options = step.choice?.options ?? [];
        const picked = step.choice?.picked ?? "";
        picks.push(options.length === 2 ? `${picked} before ${options.find((o) => o !== picked)}` : `${picked} first`);
        const t0 = scenario.procedures.filter((p) => p.timeZeroRunId && step.queues && Object.values(step.queues).some((q) => q.some((i) => i.processId === p.timeZeroRunId)));
        const t0Runs = t0.length === 1 ? `${t0[0].label}'s time-0 run is` : `The time-0 runs of ${joinAnd(t0.map((p) => p.label))} are`;
        const t0Note = t0.length
          ? ` ${t0Runs} triggered after every initial and always procedure has started (§9.2.2.2); started does not mean their first statements have run (§4.7), so any of these orders is legal.`
          : "";
        push({
          kind: "choice",
          stage,
          text: `${plural(options.length, "process", "processes")} are ready in ${STRIP_LABELS[stage ?? "active"]}: ${joinAnd(options)}. This run takes ${picked} first; the standard allows any order (§4.7).${t0Note}`,
          clauses: ["§4.7", ...(t0.length ? ["§9.2.2.2"] : [])],
          traceIndex,
        });
        return;
      }
      case "wake": {
        if (!proc || !process) return;
        if (proc.kind === "assign") return;
        const start = process.trigger.kind === "resume";
        if (start) {
          const isT0 = proc.timeZeroRunId === process.id;
          const why = isT0
            ? "an always_comb runs once at time zero (§9.2.2.2)"
            : scenario.scheduler.slotTime === 0
              ? proc.kind === "program-initial"
                ? "an initial procedure starts at time 0 (§9.2.1); in a program it runs in the Reactive region (§24.3.1)"
                : "an initial procedure starts at time 0 (§9.2.1)"
              : `its delay has expired at ${slot}; resuming after a delay is not a flush point`;
          lastSeen.set(proc.id, { ...values });
          push({ kind: "run", stage, procedureId: proc.id, lineKey: proc.lineKeys[0], text: `${proc.label} starts: ${why}.`, clauses: isT0 ? ["§9.2.2.2"] : scenario.scheduler.slotTime === 0 ? ["§9.2.1", ...(proc.kind === "program-initial" ? ["§24.3.1"] : [])] : [], traceIndex });
          return;
        }
        const trigger = process.trigger;
        const signals = trigger.kind === "change" ? trigger.signals : trigger.kind === "posedge" ? [trigger.signal] : [];
        const changes = changedSince(proc, signals);
        if (proc.edge) {
          const c = changes.find((x) => x.name === proc.edge!.signal);
          if (!c || !isEdge(proc.edge.kind, c.from, c.to)) throw new Error(`${scenario.id}: ${proc.id} woke without a ${proc.edge.kind} of ${proc.edge.signal}`);
        }
        const what = changes.length ? describeChanges(changes) : "an input changed";
        const edgeNote = proc.edge ? `, a ${proc.edge.kind} (Table 9-2)` : "";
        lastSeen.set(proc.id, { ...values });
        if (!hasChecks(proc)) {
          push({ kind: "run", stage, procedureId: proc.id, lineKey: proc.lineKeys[0], text: proc.kind === "always_comb" ? `${proc.label} resumes on a change of an input: ${what}.` : `${proc.label} resumes from its event control: ${what}${edgeNote}.`, clauses: proc.edge ? ["§9.4.2"] : [], traceIndex });
          return;
        }
        const pending = queues[proc.id];
        const comb = proc.kind === "always_comb";
        const cause = comb
          ? `an always_comb resumed by a change of an input (${what}) reaches a flush point`
          : `resuming after an event control (${what}${edgeNote}) is a flush point`;
        const clauses = new Set<string>();
        pending.forEach((t) => clauses.add(t.kind === "violation" ? violationClause(t.check) : "§16.4.2"));
        if (clauses.size === 0) {
          const kinds = proc.schedulerIds.flatMap((id) => processById.get(id)?.body ?? []).filter((s) => s.kind === "check");
          kinds.forEach((s) => {
            const c = scenario.checks[scenario.checkOf[s.id] ?? s.id];
            clauses.add(c.kind === "violation" ? violationClause(c) : "§16.4.2");
          });
        }
        let text: string;
        if (pending.length) {
          pending.forEach((t) => (t.status = "flushed"));
          transient = [...pending];
          text = `${proc.label} resumes: ${cause}. Its queue is cleared, so ${plural(pending.length, "pending report")} ${pending.length === 1 ? "is" : "are"} discarded: ${joinAnd(pending.map((t) => `${t.label} (${t.detail})`))}.`;
          queues[proc.id] = [];
        } else {
          text = `${proc.label} resumes: ${cause}. Its queue is already empty, so nothing is discarded.`;
        }
        push({ kind: "flush", stage, procedureId: proc.id, lineKey: proc.lineKeys[0], text, clauses: [...clauses], traceIndex });
        return;
      }
      case "statement":
      case "suspend": {
        if (!proc || !process) return;
        const stmt = findStatement(process, step.stmtId);
        if (!stmt) {
          if (step.kind === "statement" && process.sourceTail?.length) {
            const tail = process.sourceTail[0].trim();
            const waitKey = scenario.source.find((l) => l.key && proc.lineKeys.includes(l.key) && l.text.includes(tail))?.key;
            push({ kind: "wait", stage, procedureId: proc.id, lineKey: waitKey ?? proc.lineKeys[proc.lineKeys.length - 1], text: `${proc.label} reaches ${process.sourceTail[0]} and stays blocked there for the rest of this slot.`, clauses: [], traceIndex });
          }
          return;
        }
        if (stmt.kind === "check") {
          handleCheck(proc, stmt, stage, traceIndex);
          return;
        }
        if (stmt.kind === "assertcontrol") {
          handleControl(proc, stmt, stage, traceIndex);
          return;
        }
        if (stmt.kind === "assign") {
          const before = sim.trace[traceIndex - 1]?.values ?? scenario.scheduler.initial;
          const src = assignText(scenario, stmt, proc.kind === "assign");
          if (stmt.op === "nba") {
            push({ kind: "assign", stage, procedureId: proc.id, lineKey: lineFor(stmt.id), text: `${src} evaluates its right side now and schedules an NBA update of ${stmt.target}; until then every reader still sees ${stmt.target} = ${valueText(scenario, stmt.target, values[stmt.target])}.`, clauses: ["§4.9.4"], traceIndex });
          } else {
            const from = before[stmt.target] ?? "X";
            const to = values[stmt.target] ?? "X";
            const change = from === to ? `${stmt.target} stays ${valueText(scenario, stmt.target, to)}, so nothing wakes` : `${stmt.target} ${valueText(scenario, stmt.target, from)} → ${valueText(scenario, stmt.target, to)}`;
            push({ kind: "assign", stage, procedureId: proc.id, lineKey: lineFor(stmt.id), text: `${src} ${proc.kind === "assign" ? "updates" : "writes at once"}: ${change}.`, clauses: proc.kind === "assign" ? ["§4.9.1"] : [], traceIndex });
          }
          return;
        }
        if (stmt.kind === "delay") {
          const t = (scenario.scheduler.slotTime ?? 10) + stmt.units;
          push({ kind: "suspend", stage, procedureId: proc.id, lineKey: lineFor(stmt.id), text: `${proc.label} suspends on #${stmt.units}: the rest of it runs at t = ${t} ${scenario.scheduler.timeUnit ?? "ns"}, not in this slot (§9.4.1).`, clauses: ["§9.4.1"], traceIndex });
        }
        return;
      }
      case "update": {
        const before = sim.trace[traceIndex - 1]?.values ?? scenario.scheduler.initial;
        const target = step.changed[0];
        if (!target) return;
        const src = step.processId ? procOf.get(step.processId) : undefined;
        push({
          kind: "update",
          stage: "nba",
          procedureId: src?.id,
          lineKey: lineFor(step.stmtId),
          text: `NBA region: ${target} updates ${valueText(scenario, target, before[target])} → ${valueText(scenario, target, values[target])}. Processes waiting on ${target} wake and run in Active again.`,
          clauses: ["§4.4.2.4"],
          traceIndex,
        });
        return;
      }
      case "slot-end": {
        if (inActive) {
          values = { ...(sim.trace[traceIndex - 1]?.values ?? values) };
          observed();
          values = { ...step.values };
        }
        postponed();
        const certain = reports.filter((r) => r.certain).length;
        const maybe = reports.length - certain;
        push({
          kind: "end",
          stage: null,
          text: `Time slot ${slot} ends: ${certain === 0 ? "no report is" : `${plural(certain, "report")} ${certain === 1 ? "is" : "are"}`} printed${maybe ? `, and ${plural(maybe, "more report")} may be (§20.11)` : ""}.`,
          clauses: maybe ? ["§20.11"] : [],
          traceIndex,
        });
        return;
      }
      default:
        return;
    }
  });

  function handleCheck(proc: ProcedureSpec, stmt: Extract<Statement, { kind: "check" }>, stage: StripStage | null, traceIndex: number) {
    const check = scenario.checks[scenario.checkOf[stmt.id] ?? stmt.id];
    const evaluation = evaluateCheck(scenario, check, values);
    const bit = assertionTypeBit(check);
    const state = control[bit] ?? "on";
    const lineKey = lineFor(stmt.id);
    if (check.kind === "assertion" && state !== "on") {
      push({ kind: "check", stage, procedureId: proc.id, lineKey, text: `${check.label} is not checked: $assertcontrol ${state === "off" ? "Off" : "Kill"} is in force for ${describeAssertionType(bit)} (§20.11).`, clauses: ["§20.11"], traceIndex });
      return;
    }
    if (!evaluation.violation) {
      const text =
        check.kind === "assertion"
          ? `${check.label} evaluates ${exprText(check.condition)} with ${evaluation.detail}: it passes. Its pass action is empty, so nothing is queued.`
          : `${proc.label} executes ${check.label} with ${evaluation.detail}: ${evaluation.finding}, so there is no violation (${ruleClause(check)}).`;
      push({ kind: "check", stage, procedureId: proc.id, lineKey, text, clauses: [check.kind === "assertion" ? "§16.3" : ruleClause(check)], traceIndex });
      return;
    }
    if (check.kind === "assertion" && check.form === "immediate") {
      reports.push({ id: `imm-${ticketSeq++}`, kind: "immediate", procedureId: proc.id, checkId: check.id, text: `${check.label} failed: $error at once, with ${evaluation.detail}`, certain: true, stage: stage ?? "active" });
      push({
        kind: "check",
        stage,
        procedureId: proc.id,
        lineKey,
        text: `${check.label} evaluates ${exprText(check.condition)} with ${evaluation.detail}: ${evaluation.finding}, which counts as false, so it fails. A simple immediate assertion acts at once: its $error runs now, in ${STRIP_LABELS[stage ?? "active"]} (§16.3).`,
        clauses: ["§16.3"],
        traceIndex,
      });
      return;
    }
    const kind = ticketKind(check);
    if (state !== "on") {
      const ghost: TicketView = { id: `blocked-${ticketSeq++}`, checkId: check.id, label: check.label, kind, detail: evaluation.detail, status: "blocked" };
      blocked.push(ghost);
      push({
        kind: "check",
        stage,
        procedureId: proc.id,
        lineKey,
        text: `${proc.label} executes ${check.label} with ${evaluation.detail}: ${evaluation.finding}, a violation (${ruleClause(check)}). But $assertcontrol ${state === "off" ? "Off" : "Kill"} is in force for ${describeAssertionType(bit)}, so no new report joins the queue (§20.11).`,
        clauses: [ruleClause(check), "§20.11"],
        traceIndex,
        extra: { [proc.id]: [ghost] },
      });
      return;
    }
    const ticket: LiveTicket = { id: `t${ticketSeq++}`, checkId: check.id, label: check.label, kind, detail: evaluation.detail, status: "queued", procedureId: proc.id, typeBit: bit, check };
    queues[proc.id].push(ticket);
    all.push(ticket);
    const text =
      check.kind === "violation"
        ? `${proc.label} executes ${check.label} with ${evaluation.detail}: ${evaluation.finding}. That is a ${check.qualifier} violation (${ruleClause(check)}), but nothing is printed yet: a pending report joins ${proc.label}'s own queue, to mature in Observed unless a flush point comes first (${violationClause(check)}).${check.kind === "violation" && check.construct === "if" && check.calledFrom ? ` The function runs inside ${proc.label}'s process, so the report belongs to ${proc.label}, not to the function (§12.4.2.2).` : ""}`
        : `${check.label} evaluates ${exprText(check.condition)} with ${evaluation.detail}: ${evaluation.finding}, which counts as false, so it fails. The $error is not run now: it joins ${proc.label}'s deferred report queue, to mature in ${kind === "final" ? "Postponed" : "Observed"} unless a flush point comes first (§16.4.1).`;
    const callerClause = check.kind === "violation" && check.construct === "if" && check.calledFrom ? ["§12.4.2.2"] : [];
    push({ kind: "check", stage, procedureId: proc.id, lineKey, text, clauses: check.kind === "violation" ? [ruleClause(check), violationClause(check), ...callerClause] : ["§16.4.1"], traceIndex });
  }

  function handleControl(proc: ProcedureSpec, stmt: Extract<Statement, { kind: "assertcontrol" }>, stage: StripStage | null, traceIndex: number) {
    const bits = TYPE_BIT_NAMES.map(([b]) => b).filter((b) => (stmt.assertionType & b) !== 0);
    const pending = scenario.procedures.flatMap((p) => queues[p.id].filter((t) => bits.includes(t.typeBit)));
    const name = ASSERT_CONTROL_TYPES[stmt.controlType];
    const head = `$assertcontrol(${stmt.controlType}, ${stmt.assertionType}) runs: ${name} (Table 20-5) for assertion_type ${stmt.assertionType} = ${assertionTypeSum(stmt.assertionType)}, ${describeAssertionType(stmt.assertionType)} (Table 20-6).`;
    let tail: string;
    if (stmt.controlType === 3) {
      bits.forEach((b) => (control[b] = "on"));
      tail = "Checking and reporting are enabled again for these types (§20.11).";
    } else if (stmt.controlType === 4) {
      bits.forEach((b) => (control[b] = "off"));
      pending.forEach((t) => (t.keptByOff = true));
      tail = pending.length
        ? `Off does not flush what is already queued: ${joinAnd(pending.map((t) => `${t.label} (${t.detail})`))} stays and "may still mature"; no new report is queued until On (§20.11).`
        : "No report of these types is queued yet, and from now on none is queued until On (§20.11).";
    } else {
      bits.forEach((b) => (control[b] = "kill"));
      pending.forEach((t) => {
        t.status = "killed";
        queues[t.procedureId] = queues[t.procedureId].filter((q) => q !== t);
      });
      transient = [...pending];
      tail = pending.length
        ? `Kill flushes queued reports that have not matured: ${joinAnd(pending.map((t) => `${t.label} (${t.detail})`))} is discarded, and no new report is queued until On (§20.11).`
        : "No report of these types is queued yet, and from now on none is queued until On (§20.11).";
    }
    push({ kind: "control", stage, procedureId: proc.id, lineKey: lineFor(stmt.id), text: `${head} ${tail}`, clauses: ["§20.11"], traceIndex });
  }

  return { steps, reports, tickets: all.map(view), blocked, picks, choices: sim.choices, sim };
}

function findStatement(process: SvProcess, stmtId?: string): Statement | undefined {
  return stmtId ? process.body.find((s) => s.id === stmtId) : undefined;
}

/** Table 9-2 on 1-bit values: negedge is 1 → x/0 or x → 0; posedge is 0 → x/1 or x → 1. */
export function isEdge(kind: "negedge" | "posedge", from: SvValue, to: SvValue): boolean {
  if (from === to) return false;
  if (kind === "negedge") return (from === 1 && (to === 0 || to === "X")) || (from === "X" && to === 0);
  return (from === 0 && (to === 1 || to === "X")) || (from === "X" && to === 1);
}

/** Source text of an assignment, with enum names for constants. */
export function assignText(scenario: Pick<DeferredScenario, "valueNames">, stmt: Extract<Statement, { kind: "assign" }>, continuous = false): string {
  const rhs = stmt.expr.kind === "const" ? literalText(scenario, stmt.target, stmt.expr.value) : exprText(stmt.expr);
  return `${continuous ? "assign " : ""}${stmt.target} ${stmt.op === "nba" ? "<=" : "="} ${rhs};`;
}

/* ------------------------------------------------------------------ */
/* Every order                                                         */
/* ------------------------------------------------------------------ */

export interface DeferredOutcome {
  id: string;
  /** Signature used to group runs. */
  signature: string;
  runs: DeferredRun[];
  /** Reports of the first run in the group. */
  reports: ReportLine[];
}

export interface DeferredExploration {
  runs: DeferredRun[];
  outcomes: DeferredOutcome[];
  runCount: number;
  capped: boolean;
}

const MAX_ORDERS = 64;

function reportSignature(scenario: DeferredScenario, run: DeferredRun): string {
  if (Object.values(scenario.checks).some((c) => c.kind === "assertion")) {
    return countLines(scenario, run)
      .map((l) => l.text)
      .join("|");
  }
  return run.reports.map((r) => `${r.certain ? "" : "?"}${r.text}`).join("|") || "none";
}

/** Runs every order of the ready processes the scheduler offers (§4.7) and groups the outcomes by what is reported. */
export function exploreDeferred(scenario: DeferredScenario): DeferredExploration {
  const runs: DeferredRun[] = [];
  const stack: number[][] = [[]];
  let capped = false;
  while (stack.length) {
    const prefix = stack.pop() as number[];
    if (runs.length >= MAX_ORDERS) {
      capped = true;
      break;
    }
    const run = analyzeRun(scenario, prefix);
    runs.push(run);
    const { choices, choiceWidths } = run.sim;
    for (let i = choices.length - 1; i >= prefix.length; i -= 1) {
      for (let alt = 1; alt < choiceWidths[i]; alt += 1) stack.push([...choices.slice(0, i), alt]);
    }
  }
  runs.sort((a, b) => a.choices.join(",").localeCompare(b.choices.join(",")));
  const groups = new Map<string, DeferredOutcome>();
  for (const run of runs) {
    const signature = reportSignature(scenario, run);
    const g = groups.get(signature);
    if (g) g.runs.push(run);
    else groups.set(signature, { id: `outcome-${groups.size + 1}`, signature, runs: [run], reports: run.reports });
  }
  return { runs, outcomes: [...groups.values()], runCount: runs.length, capped };
}

/* ------------------------------------------------------------------ */
/* Counting and prediction                                             */
/* ------------------------------------------------------------------ */

/** The reports a prediction counts: every violation report, or the failures of one assertion. */
export function countedReports(scenario: DeferredScenario, run: DeferredRun, focus?: string): ReportLine[] {
  if (focus) return run.reports.filter((r) => r.checkId === focus);
  return run.reports.filter((r) => r.kind === "violation");
}

export interface ReportCount {
  certain: number;
  possible: number;
}

export function reportCount(scenario: DeferredScenario, run: DeferredRun, focus?: string): ReportCount {
  const list = countedReports(scenario, run, focus);
  const certain = list.filter((r) => r.certain).length;
  return { certain, possible: list.length - certain };
}

export function countText(count: ReportCount, noun = "report"): string {
  const base = count.certain === 0 ? `no ${noun}` : plural(count.certain, noun);
  return count.possible ? `${base}, plus ${plural(count.possible, `${noun} that may be printed`, `${noun}s that may be printed`)}` : base;
}

/** One line per assertion: its failure-report count in this run. */
export function countLines(scenario: DeferredScenario, run: DeferredRun): { checkId: string; text: string }[] {
  return Object.values(scenario.checks)
    .filter((c): c is Extract<CheckSpec, { kind: "assertion" }> => c.kind === "assertion")
    .map((c) => ({ checkId: c.id, text: `${c.label} (${c.form === "immediate" ? "immediate" : c.form === "observed" ? "#0" : "final"}): ${countText(reportCount(scenario, run, c.id), "failure report")}` }));
}

/** A sentence for each ticket's fate in a run, for feedback and the text alternative. */
export function fateSentences(scenario: DeferredScenario, run: DeferredRun, focus?: string): string[] {
  const procLabel = (id: string) => scenario.procedures.find((p) => p.id === id)?.label ?? id;
  const out: string[] = [];
  const keep = (checkId: string) => !focus || checkId === focus;
  const queuedBy = new Map<string, string>();
  for (const step of run.steps) {
    for (const [pid, tray] of Object.entries(step.trays)) {
      for (const t of tray) if (t.status === "queued" || t.status === "blocked") queuedBy.set(t.id, pid);
    }
  }
  for (const t of run.tickets) {
    if (!keep(t.checkId)) continue;
    const who = procLabel(queuedBy.get(t.id) ?? "");
    const what = `${who}'s ${t.label} report, queued with ${t.detail},`;
    const clause = t.kind === "violation" ? violationClause(scenario.checks[t.checkId]) : t.kind === "final" ? "§16.4.1" : "§16.4.1";
    if (t.status === "flushed") out.push(`${what} was discarded when ${who} ran again, a flush point (${t.kind === "violation" ? clause : "§16.4.2"}).`);
    else if (t.status === "killed") out.push(`${what} was flushed by $assertcontrol Kill before it matured (§20.11).`);
    else if (t.status === "maybe") out.push(`${what} was queued before Off, which does not flush it; it may still mature (§20.11).`);
    else if (t.status === "matured") out.push(`${what} matured in ${t.kind === "final" ? "Postponed" : "Observed"} and was reported (${clause}).`);
  }
  for (const b of run.blocked) if (keep(b.checkId)) out.push(`${procLabel(queuedBy.get(b.id) ?? "")}'s ${b.label} found a violation with ${b.detail}, but assertion control kept it off the queue (§20.11).`);
  const immediates = run.reports.filter((r) => r.kind === "immediate" && keep(r.checkId));
  if (immediates.length) out.push(`${scenario.checks[immediates[0].checkId]?.label ?? immediates[0].checkId} reported ${plural(immediates.length, "failure")} at once, one per failing run of its block (§16.3).`);
  if (out.length === 0) out.push("No check found a violation, so nothing was queued.");
  return out;
}

/**
 * The run that shows the most (for `focus`): first the most distinct fates
 * (flushed, killed, matured, may mature, kept off the queue), so that, for
 * example, a Kill race opens on the order where Kill flushes a queued report
 * and also keeps a later one off the queue (§20.11); then the most queued
 * reports; then the most kept off the queue. The first such run wins ties.
 */
export function richestRun(runs: DeferredRun[], focus?: string): DeferredRun {
  const score = (r: DeferredRun): number[] => {
    const tickets = r.tickets.filter((t) => !focus || t.checkId === focus);
    const blocked = r.blocked.filter((b) => !focus || b.checkId === focus);
    const fates = new Set([...tickets, ...blocked].map((t) => t.status));
    return [fates.size, tickets.length, blocked.length];
  };
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  return runs.reduce((best, r) => (better(score(r), score(best)) ? r : best), runs[0]);
}

export interface PredictionChoice {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface Prediction {
  question: string;
  options: PredictionChoice[];
  /** The counts seen across the orders, e.g. "1 or 2". */
  answer: string;
}

function sameCount(a: ReportCount, b: ReportCount) {
  return a.certain === b.certain && a.possible === b.possible;
}

/**
 * The prediction for a preset, built from every order the model ran. Options
 * are counts 0..`maxCount` and "it depends on the order"; the answer is the one
 * count every order gives, or "depends" when orders differ.
 */
export function buildPrediction(scenario: DeferredScenario, exploration: DeferredExploration, focus?: string): Prediction {
  const slot = slotTimeLabel(scenario.scheduler);
  const focusCheck = focus ? scenario.checks[focus] : undefined;
  const noun = focusCheck ? "failure report" : "violation report";
  const question = focusCheck
    ? `How many failure reports does ${focusCheck.label} produce in time slot ${slot}?`
    : `How many violation reports does time slot ${slot} print?`;
  const counts = exploration.runs.map((r) => reportCount(scenario, r, focus));
  const distinct: ReportCount[] = [];
  counts.forEach((c) => (distinct.some((d) => sameCount(d, c)) ? null : distinct.push(c)));
  const fixed = distinct.length === 1 && distinct[0].possible === 0 ? distinct[0].certain : undefined;
  const maxCount = Math.max(2, ...counts.map((c) => c.certain + c.possible));
  const richest = richestRun(exploration.runs, focus);
  const fates = fateSentences(scenario, richest, focus).join(" ");
  const orderSummary = exploration.outcomes
    .map((o) => {
      const c = reportCount(scenario, o.runs[0], focus);
      return `${o.runs[0].picks.join("; ") || "the one order"}: ${countText(c, noun)}`;
    })
    .join(". ");
  const answer = distinct.map((c) => countText(c, noun)).join(" or ");
  const queuedTotal = Math.max(...exploration.runs.map((r) => r.tickets.filter((t) => !focus || t.checkId === focus).length));
  // The processes whose reports make up a fixed count: each has its own queue (§12.4.2.1, §12.5.3.1).
  const fixedReports = countedReports(scenario, richest, focus).filter((r) => r.certain);
  const procName = (id: string) => scenario.procedures.find((p) => p.id === id)?.label ?? id;
  const reporters = [...new Set(fixedReports.map((r) => r.procedureId))].map(procName);
  const reporterClauses = [...new Set(fixedReports.map((r) => violationClause(scenario.checks[r.checkId])))].join(", ");
  const flushedAny = exploration.runs.some((r) => r.tickets.some((t) => (!focus || t.checkId === focus) && (t.status === "flushed" || t.status === "killed")));

  const options: PredictionChoice[] = [];
  for (let n = 0; n <= maxCount; n += 1) {
    const correct = fixed === n;
    let feedback: string;
    if (correct) {
      feedback = `Every order the model ran (${exploration.runCount}) gives ${countText({ certain: n, possible: 0 }, noun)}. ${fates}`;
    } else if (fixed === undefined) {
      feedback = `No single count holds: ${orderSummary}.`;
    } else if (n > fixed && flushedAny) {
      feedback = `That counts reports that were queued (up to ${queuedTotal} in one order), but a queued report is only a candidate: ${fates}`;
    } else if (n > fixed) {
      feedback = `Too many: every order gives ${countText({ certain: fixed, possible: 0 }, noun)}. ${fates}`;
    } else if (!focus && n > 0 && reporters.length > 1) {
      feedback = `Too few: each process has its own violation report queue (${reporterClauses}), and ${joinAnd(reporters)} each keep a pending report that no flush point reaches before it matures. ${fates}`;
    } else {
      feedback = `Too few: a pending report that no flush point reaches before it matures is reported. ${fates}`;
    }
    options.push({ id: `count-${n}`, label: n === 0 ? `No ${noun}` : plural(n, noun), correct, feedback });
  }
  options.push({
    id: "depends",
    label: "It depends on the order the scheduler picks",
    correct: fixed === undefined,
    feedback:
      fixed === undefined
        ? `Right: the orders disagree. ${orderSummary}.`
        : `Every order the model ran gives ${countText({ certain: fixed, possible: 0 }, noun)}: the order changes which steps happen, not the result.`,
  });
  return { question, options, answer };
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export type DeferredPresetId =
  | "reset-nba-flush"
  | "reset-delayed-matures"
  | "lrm-unique-glitch"
  | "loop-flush"
  | "two-callers"
  | "assertcontrol-race"
  | "assert-forms-glitch";

export interface PresetOptions {
  /** assertcontrol-race: Off (4) or Kill (5). */
  controlType?: 4 | 5;
  /** assert-forms-glitch: the testbench writes a from a program (Reactive) instead of with <= from a module. */
  reactiveWritesA?: boolean;
}

export interface PresetMeta {
  id: DeferredPresetId;
  label: string;
  lesson: "F2C" | "F3B";
  summary: string;
}

export const DEFERRED_PRESETS: PresetMeta[] = [
  { id: "reset-nba-flush", label: "Reset with <= at t = 0", lesson: "F2C", summary: "Both traffic-light decoders, next-state and output, run at time 0 while state is still x, and the bench drives the reset with <= at time 0." },
  { id: "reset-delayed-matures", label: "Reset delayed by #1", lesson: "F2C", summary: "The same two decoders, but the bench waits #1 before it drives the reset." },
  { id: "lrm-unique-glitch", label: "Standard's unique if glitch", lesson: "F2C", summary: "The standard's a / not_a example (§12.4.2.1): a changes before not_a has caught up." },
  { id: "loop-flush", label: "Standard's loop variant", lesson: "F2C", summary: "The same check inside a for loop (§12.4.2.1): each iteration can queue its own report." },
  { id: "two-callers", label: "One function, two callers", lesson: "F2C", summary: "A function with a unique if, called by two always_comb blocks (§12.4.2.2)." },
  { id: "assertcontrol-race", label: "$assertcontrol at t = 0", lesson: "F2C", summary: "An initial block switches violation reports off at time 0, when both decoders also make their first runs." },
  { id: "assert-forms-glitch", label: "Three assertion forms", lesson: "F3B", summary: "The standard's §16.4.2 example: assign not_a = !a and an always_comb checking not_a != a in three forms." },
];

export function findPresetMeta(id: DeferredPresetId): PresetMeta {
  const meta = DEFERRED_PRESETS.find((p) => p.id === id);
  if (!meta) throw new Error(`Unknown deferred-report preset ${id}`);
  return meta;
}

const STATE_NAMES = { 0: "RED", 1: "GREEN", 2: "YELLOW" } as const;
const STATE_ITEMS = [
  { name: "RED", value: 0 },
  { name: "GREEN", value: 1 },
  { name: "YELLOW", value: 2 },
];

const v = (name: string): Expr => ({ kind: "var", name });
const not = (e: Expr): Expr => ({ kind: "inv", expr: e });
const neq = (l: Expr, r: Expr): Expr => ({ kind: "inv", expr: { kind: "eq", left: l, right: r } });
const assign = (id: string, target: string, expr: Expr, op: "blocking" | "nba" = "blocking"): Statement => ({ kind: "assign", id, op, target, expr });
const constant = (value: SvValue): Expr => ({ kind: "const", value });
const checkStmt = (id: string, source: string): Statement => ({ kind: "check", id, qualifier: "unique", construct: "if", result: "pass", source });

/**
 * The F2C traffic light has two always_comb decoders, each with its own
 * `unique case (state)` and no default: the next-state decoder and the output
 * decoder. Each is its own process with its own report queue (§12.5.3.1).
 */
interface DecoderDef {
  /** Procedure id, also the check id. */
  id: "next" | "out";
  label: string;
  /** Scheduler process id prefix. */
  pid: "DEC" | "OUT";
  /** The seed assignment the lesson writes before the case. */
  seed: string;
  items: string;
}

const DECODERS: DecoderDef[] = [
  { id: "next", label: "next-state decoder", pid: "DEC", seed: "next_state = state;", items: STATE_ITEMS.map((i) => `${i.name}: …`).join("  ") },
  { id: "out", label: "output decoder", pid: "OUT", seed: "light = 3'b100;", items: STATE_ITEMS.map((i) => `${i.name}: …`).join("  ") },
];

const decoderCheck = (d: DecoderDef): CheckSpec => ({ kind: "violation", id: d.id, label: "unique case (state)", qualifier: "unique", construct: "case", select: "state", items: STATE_ITEMS });

function decoderProcesses(): SvProcess[] {
  return DECODERS.flatMap((d) => [
    { id: `${d.pid}0`, label: d.label, owner: "design", context: "module", header: "always_comb", trigger: { kind: "resume" }, body: [{ kind: "check", id: `${d.id}@0`, qualifier: "unique", construct: "case", result: "no-match", source: "unique case (state)" }] },
    { id: d.pid, label: d.label, owner: "design", context: "module", header: "always_comb", trigger: { kind: "change", signals: ["state"] }, body: [{ kind: "check", id: `${d.id}@1`, qualifier: "unique", construct: "case", result: "pass", source: "unique case (state)" }] },
  ]);
}

const DECODER_PROCS: ProcedureSpec[] = DECODERS.map((d) => ({
  id: d.id,
  label: d.label,
  kind: "always_comb",
  schedulerIds: [`${d.pid}0`, d.pid],
  timeZeroRunId: `${d.pid}0`,
  lineKeys: [`${d.id}-head`, `${d.id}-seed`, d.id, `${d.id}-items`, `${d.id}-end`],
  owner: "design",
}));

const DECODER_LINES: SourceLineSpec[] = DECODERS.flatMap((d, i) => [
  ...(i > 0 ? [{ text: "" }] : []),
  { key: `${d.id}-head`, text: `always_comb begin                  // ${d.label}`, owner: "design" as const },
  { key: `${d.id}-seed`, text: `  ${d.seed}`, owner: "design" as const },
  { key: d.id, text: "  unique case (state)              // no default", owner: "design" as const },
  { key: `${d.id}-items`, text: `    ${d.items}`, owner: "design" as const },
  { key: `${d.id}-end`, text: "  endcase", owner: "design" as const },
  { text: "end" },
]);

const DECODER_LINE_OF: Record<string, string> = Object.fromEntries(DECODERS.flatMap((d) => [[`${d.id}@0`, d.id], [`${d.id}@1`, d.id]]));

function decoderBase(id: DeferredPresetId, title: string): Pick<DeferredScenario, "id" | "title" | "checks" | "checkOf" | "valueNames"> {
  return {
    id,
    title,
    checks: Object.fromEntries(DECODERS.map((d) => [d.id, decoderCheck(d)])),
    checkOf: Object.fromEntries(DECODERS.flatMap((d) => [[`${d.id}@0`, d.id], [`${d.id}@1`, d.id]])),
    valueNames: { state: STATE_NAMES },
  };
}

function resetScenario(delayed: boolean): DeferredScenario {
  const id: DeferredPresetId = delayed ? "reset-delayed-matures" : "reset-nba-flush";
  const tbBody: Statement[] = delayed ? [{ kind: "delay", id: "tb-d", units: 1 }, assign("tb1", "rst_n", constant(0), "nba")] : [assign("tb1", "rst_n", constant(0), "nba")];
  return {
    ...decoderBase(id, delayed ? "Reset delayed by #1 at time 0" : "Reset with <= at time 0"),
    scheduler: {
      id,
      title: id,
      clock: "clk",
      clockSource: "process",
      slotTime: 0,
      initial: { rst_n: "X", state: "X" },
      watch: ["rst_n", "state"],
      processes: [
        { id: "TB", label: "bench", owner: "testbench", context: "module", header: "initial", trigger: { kind: "resume" }, body: tbBody },
        { id: "FF", label: "flop", owner: "design", context: "module", header: "always_ff @(posedge clk or negedge rst_n)", trigger: { kind: "change", signals: ["rst_n"] }, body: [assign("ff1", "state", constant(0), "nba")] },
        ...decoderProcesses(),
      ],
    },
    procedures: [
      { id: "bench", label: "bench", kind: "initial", schedulerIds: ["TB"], lineKeys: ["tb"], owner: "testbench" },
      { id: "flop", label: "flop", kind: "always_ff", schedulerIds: ["FF"], edge: { signal: "rst_n", kind: "negedge" }, lineKeys: ["ff-head", "ff1"], owner: "design" },
      ...DECODER_PROCS,
    ],
    lineOf: { "tb-d": "tb", tb1: "tb", ...DECODER_LINE_OF },
    source: [
      { key: "tb", text: delayed ? "initial #1 rst_n <= 1'b0;          // reset waits #1" : "initial rst_n <= 1'b0;             // reset at time 0", owner: "testbench" },
      { text: "" },
      { key: "ff-head", text: "always_ff @(posedge clk or negedge rst_n)", owner: "design" },
      { key: "ff1", text: "  if (!rst_n) state <= RED;        // reset branch", owner: "design" },
      { text: "" },
      ...DECODER_LINES,
    ],
    watch: ["rst_n", "state"],
    notes: [
      "From the F2C traffic light: both always_comb decoders, the flop's reset branch and the bench's reset. Each decoder has its own unique case (state) and its own report queue. The clock and the timer are left out.",
      "rst_n and state are logic, so they start at x (Table 6-7). The flop wakes on rst_n x → 0, a negedge (Table 9-2).",
    ],
  };
}

function lrmGlitchScenario(): DeferredScenario {
  const u1: CheckSpec = { kind: "violation", id: "u1", label: "u1: unique if", qualifier: "unique", construct: "if", conditions: [v("a"), v("not_a")] };
  return {
    id: "lrm-unique-glitch",
    title: "The standard's unique if glitch",
    scheduler: {
      id: "lrm-unique-glitch",
      title: "lrm-unique-glitch",
      clock: "clk",
      clockSource: "process",
      slotTime: 10,
      initial: { a: 0, not_a: 1 },
      watch: ["a", "not_a"],
      processes: [
        { id: "STIM", label: "stimulus", owner: "testbench", context: "module", header: "initial #10", trigger: { kind: "resume" }, body: [assign("s1", "a", constant(1))] },
        { id: "NOTA", label: "not_a block", owner: "design", context: "module", header: "always_comb", trigger: { kind: "change", signals: ["a"] }, body: [assign("n1", "not_a", not(v("a")))] },
        { id: "A1", label: "a1", owner: "design", context: "module", header: "always_comb begin : a1", trigger: { kind: "change", signals: ["a", "not_a"] }, body: [checkStmt("u1", "u1: unique if (a) … else if (not_a) …")] },
      ],
    },
    procedures: [
      { id: "stim", label: "stimulus", kind: "initial", schedulerIds: ["STIM"], lineKeys: ["s1"], owner: "testbench" },
      { id: "nota", label: "not_a block", kind: "always_comb", schedulerIds: ["NOTA"], lineKeys: ["n-head", "n1"], owner: "design" },
      { id: "a1", label: "a1", kind: "always_comb", schedulerIds: ["A1"], lineKeys: ["a1-head", "u1", "u1-else"], owner: "design" },
    ],
    checks: { u1 },
    checkOf: {},
    lineOf: {},
    source: [
      { key: "s1", text: "initial #10 a = 1'b1;   // drives the change; not in the standard", owner: "testbench" },
      { text: "" },
      { key: "n-head", text: "always_comb begin", owner: "design" },
      { key: "n1", text: "  not_a = !a;", owner: "design" },
      { text: "end" },
      { key: "a1-head", text: "always_comb begin : a1", owner: "design" },
      { key: "u1", text: "  u1: unique if (a) z = a | b;", owner: "design" },
      { key: "u1-else", text: "  else if (not_a) z = a | c;", owner: "design" },
      { text: "end" },
    ],
    watch: ["a", "not_a"],
    notes: ["The standard's example from §12.4.2.1. The z assignments are shown but not run: the check depends only on a and not_a. The initial block that changes a at t = 10 is added so the slot has a cause."],
  };
}

function loopScenario(): DeferredScenario {
  const js = [0, 1, 2];
  const checks: Record<string, CheckSpec> = {};
  js.forEach((j) => {
    checks[`u${j}`] = { kind: "violation", id: `u${j}`, label: `unique if, j = ${j}`, qualifier: "unique", construct: "if", conditions: [v(`a[${j}]`), v(`not_a[${j}]`)] };
  });
  return {
    id: "loop-flush",
    title: "The standard's loop variant",
    scheduler: {
      id: "loop-flush",
      title: "loop-flush",
      clock: "clk",
      clockSource: "process",
      slotTime: 10,
      initial: Object.fromEntries(js.flatMap((j) => [[`a[${j}]`, 0], [`not_a[${j}]`, 1]])),
      watch: js.flatMap((j) => [`a[${j}]`, `not_a[${j}]`]),
      processes: [
        { id: "STIM", label: "stimulus", owner: "testbench", context: "module", header: "initial #10", trigger: { kind: "resume" }, body: [assign("s0", "a[0]", constant(1)), assign("s2", "a[2]", constant(1))] },
        { id: "NOTA", label: "not_a loop", owner: "design", context: "module", header: "always_comb", trigger: { kind: "change", signals: js.map((j) => `a[${j}]`) }, body: js.map((j) => assign(`n${j}`, `not_a[${j}]`, not(v(`a[${j}]`)))) },
        { id: "A1", label: "a1", owner: "design", context: "module", header: "always_comb begin : a1", trigger: { kind: "change", signals: js.flatMap((j) => [`a[${j}]`, `not_a[${j}]`]) }, body: js.map((j) => checkStmt(`u${j}`, `unique if (a[${j}]) …`)) },
      ],
    },
    procedures: [
      { id: "stim", label: "stimulus", kind: "initial", schedulerIds: ["STIM"], lineKeys: ["stim"], owner: "testbench" },
      { id: "nota", label: "not_a loop", kind: "always_comb", schedulerIds: ["NOTA"], lineKeys: ["n-head", "n-for", "n-body"], owner: "design" },
      { id: "a1", label: "a1", kind: "always_comb", schedulerIds: ["A1"], lineKeys: ["a1-head", "a1-for", "u", "u-else"], owner: "design" },
    ],
    checks,
    checkOf: {},
    lineOf: { s0: "stim", s2: "stim", n0: "n-body", n1: "n-body", n2: "n-body", u0: "u", u1: "u", u2: "u" },
    source: [
      { key: "stim", text: "initial #10 begin a[0] = 1'b1; a[2] = 1'b1; end", owner: "testbench" },
      { text: "" },
      { key: "n-head", text: "always_comb begin", owner: "design" },
      { key: "n-for", text: "  for (int j = 0; j < 3; j++)", owner: "design" },
      { key: "n-body", text: "    not_a[j] = !a[j];", owner: "design" },
      { text: "end" },
      { key: "a1-head", text: "always_comb begin : a1", owner: "design" },
      { key: "a1-for", text: "  for (int j = 0; j < 3; j++)", owner: "design" },
      { key: "u", text: "    unique if (a[j]) z[j] = a[j] | b[j];", owner: "design" },
      { key: "u-else", text: "    else if (not_a[j]) z[j] = a[j] | c[j];", owner: "design" },
      { text: "end" },
    ],
    watch: js.flatMap((j) => [`a[${j}]`, `not_a[${j}]`]),
    notes: ["The standard's loop example from §12.4.2.1. The model unrolls each loop into its three iterations, j = 0, 1 and 2. The stimulus that sets a[0] and a[2] at t = 10 is added so the slot has a cause."],
  };
}

function twoCallersScenario(): DeferredScenario {
  // Each caller binds f1's arguments: b1 passes (c, d), b2 passes (e, f). The check is evaluated on the caller's values.
  const callerCheck = (id: string, a: string, na: string, caller: string): CheckSpec => ({ kind: "violation", id, label: "a1 in f1", qualifier: "unique", construct: "if", conditions: [v(a), v(na)], calledFrom: caller });
  return {
    id: "two-callers",
    title: "One function called by two processes",
    scheduler: {
      id: "two-callers",
      title: "two-callers",
      clock: "clk",
      clockSource: "process",
      slotTime: 10,
      initial: { c: 1, d: 0, e: 1, f: 0 },
      watch: ["c", "d", "e", "f"],
      processes: [
        { id: "STIM", label: "stimulus", owner: "testbench", context: "module", header: "initial #10", trigger: { kind: "resume" }, body: [assign("s1", "d", constant(1)), assign("s2", "f", constant(1))] },
        { id: "B1", label: "b1", owner: "design", context: "module", header: "always_comb begin : b1", trigger: { kind: "change", signals: ["c", "d"] }, body: [checkStmt("b1-f1", "f1(c, d)")] },
        { id: "B2", label: "b2", owner: "design", context: "module", header: "always_comb begin : b2", trigger: { kind: "change", signals: ["e", "f"] }, body: [checkStmt("b2-f1", "f1(e, f)")] },
      ],
    },
    procedures: [
      { id: "stim", label: "stimulus", kind: "initial", schedulerIds: ["STIM"], lineKeys: ["stim"], owner: "testbench" },
      { id: "b1", label: "b1", kind: "always_comb", schedulerIds: ["B1"], lineKeys: ["b1-head", "b1-call"], owner: "design" },
      { id: "b2", label: "b2", kind: "always_comb", schedulerIds: ["B2"], lineKeys: ["b2-head", "b2-call"], owner: "design" },
    ],
    checks: { "b1-f1": callerCheck("b1-f1", "c", "d", "b1"), "b2-f1": callerCheck("b2-f1", "e", "f", "b2") },
    checkOf: {},
    lineOf: { s1: "stim", s2: "stim", "b1-f1": "f1-a1", "b2-f1": "f1-a1" },
    source: [
      { key: "f1-head", text: "function bit f1(bit a, bit not_a);", owner: "design" },
      { key: "f1-a1", text: "  a1: unique if (a) …", owner: "design" },
      { key: "f1-else", text: "  else if (not_a) …", owner: "design" },
      { text: "endfunction" },
      { key: "b1-head", text: "always_comb begin : b1", owner: "design" },
      { key: "b1-call", text: "  some_stuff = f1(c, d);", owner: "design" },
      { text: "end" },
      { key: "b2-head", text: "always_comb begin : b2", owner: "design" },
      { key: "b2-call", text: "  other_stuff = f1(e, f);", owner: "design" },
      { text: "end" },
      { text: "" },
      { key: "stim", text: "initial #10 begin d = 1'b1; f = 1'b1; end", owner: "testbench" },
    ],
    watch: ["c", "d", "e", "f"],
    notes: [
      "The standard's example from §12.4.2.2, time step 1: b1 runs with c = d = 1 and b2 with e = f = 1, so a1 fails for each caller. The stimulus that sets d and f at t = 10 is added so the slot has a cause.",
      "f1's other statements and the assignments to some_stuff and other_stuff are not run.",
    ],
  };
}

function assertcontrolRaceScenario(controlType: 4 | 5): DeferredScenario {
  return {
    ...decoderBase("assertcontrol-race", `$assertcontrol(${controlType}, 224) and the decoder at time 0`),
    scheduler: {
      id: "assertcontrol-race",
      title: "assertcontrol-race",
      clock: "clk",
      clockSource: "process",
      slotTime: 0,
      initial: { state: "X" },
      watch: ["state"],
      processes: [
        {
          id: "CTL",
          label: "control initial",
          owner: "testbench",
          context: "module",
          header: "initial",
          trigger: { kind: "resume" },
          body: [{ kind: "assertcontrol", id: "ac", controlType, assertionType: ASSERTION_TYPE_BITS.unique | ASSERTION_TYPE_BITS.unique0 | ASSERTION_TYPE_BITS.priority }],
          sourceTail: ["@(posedge rst_n);", "$assertcontrol(3, 224);"],
        },
        ...decoderProcesses(),
      ],
    },
    procedures: [{ id: "control", label: "control initial", kind: "initial", schedulerIds: ["CTL"], lineKeys: ["ac-head", "ac", "ac-wait", "ac-on"], owner: "testbench" }, ...DECODER_PROCS],
    lineOf: { ac: "ac", ...DECODER_LINE_OF },
    source: [
      { key: "ac-head", text: "initial begin", owner: "testbench" },
      { key: "ac", text: `  $assertcontrol(${controlType}, 224);   // ${ASSERT_CONTROL_TYPES[controlType as AssertControlType]}`, owner: "testbench" },
      { key: "ac-wait", text: "  @(posedge rst_n);", owner: "testbench" },
      { key: "ac-on", text: "  $assertcontrol(3, 224);   // On", owner: "testbench" },
      { text: "end" },
      { text: "" },
      ...DECODER_LINES,
    ],
    watch: ["state"],
    notes: [
      "The F2C snippet that switches violation reports off during reset. The reset reaches state only after time slot 0 here, so state stays x through the slot, as when the register resets synchronously.",
      "224 = 32 + 64 + 128 selects Unique, Unique0 and Priority (Table 20-6); $assertoff, which is $assertcontrol(4, 15, 7), would not reach these reports.",
    ],
  };
}

function assertFormsScenario(reactive: boolean): DeferredScenario {
  const cond = neq(v("not_a"), v("a"));
  const checks: Record<string, CheckSpec> = {
    a1: { kind: "assertion", id: "a1", label: "a1", form: "immediate", condition: cond },
    a2: { kind: "assertion", id: "a2", label: "a2", form: "observed", condition: cond },
    a3: { kind: "assertion", id: "a3", label: "a3", form: "final", condition: cond },
  };
  const body = (suffix: string) => ["a1", "a2", "a3"].map((id) => checkStmt(`${id}${suffix}`, id));
  const tb: SvProcess = reactive
    ? { id: "TB", label: "program", owner: "testbench", context: "program", header: "initial", trigger: { kind: "resume" }, body: [assign("tb1", "a", constant(1))], sourceTail: ["#5 a = 1'b0;"] }
    : { id: "TB", label: "bench", owner: "testbench", context: "module", header: "initial", trigger: { kind: "resume" }, body: [assign("tb1", "a", constant(1), "nba")] };
  return {
    id: "assert-forms-glitch",
    title: reactive ? "Three assertion forms: Reactive writes a" : "Three assertion forms: a written with <=",
    scheduler: {
      id: "assert-forms-glitch",
      title: "assert-forms-glitch",
      clock: "clk",
      clockSource: "process",
      slotTime: 0,
      initial: { a: "X", not_a: "X" },
      watch: ["a", "not_a"],
      processes: [
        tb,
        { id: "ASSIGN", label: "assign not_a", owner: "design", context: "module", header: "assign", trigger: { kind: "change", signals: ["a"] }, body: [assign("na", "not_a", not(v("a")))] },
        { id: "B0", label: "b1", owner: "design", context: "module", header: "always_comb begin : b1", trigger: { kind: "resume" }, body: body("@0") },
        { id: "B", label: "b1", owner: "design", context: "module", header: "always_comb begin : b1", trigger: { kind: "change", signals: ["a", "not_a"] }, body: body("@1") },
      ],
    },
    procedures: [
      { id: "tb", label: reactive ? "program" : "bench", kind: reactive ? "program-initial" : "initial", schedulerIds: ["TB"], lineKeys: ["tb"], owner: "testbench" },
      { id: "assign", label: "assign not_a", kind: "assign", schedulerIds: ["ASSIGN"], lineKeys: ["na"], owner: "design" },
      { id: "b1", label: "b1", kind: "always_comb", schedulerIds: ["B0", "B"], timeZeroRunId: "B0", lineKeys: ["b1-head", "a1", "a2", "a3"], owner: "design" },
    ],
    checks,
    checkOf: { "a1@0": "a1", "a2@0": "a2", "a3@0": "a3", "a1@1": "a1", "a2@1": "a2", "a3@1": "a3" },
    lineOf: { tb1: "tb", "a1@0": "a1", "a2@0": "a2", "a3@0": "a3", "a1@1": "a1", "a2@1": "a2", "a3@1": "a3" },
    source: [
      { key: "na", text: "assign not_a = !a;", owner: "design" },
      { key: "b1-head", text: "always_comb begin : b1", owner: "design" },
      { key: "a1", text: `  a1: assert (${exprText(cond)});        // immediate`, owner: "design" },
      { key: "a2", text: `  a2: assert #0 (${exprText(cond)});     // observed deferred`, owner: "design" },
      { key: "a3", text: `  a3: assert final (${exprText(cond)});  // final deferred`, owner: "design" },
      { text: "end" },
      { text: "" },
      reactive
        ? { key: "tb", text: "program tb; initial begin a = 1'b1; #5 a = 1'b0; end endprogram", owner: "testbench" }
        : { key: "tb", text: "initial a <= 1'b1;   // module code: NBA update", owner: "testbench" },
    ],
    watch: ["a", "not_a"],
    notes: [
      "The standard's example from §16.4.2 with a final form, a3, added. a and not_a are logic, so they start at x (Table 6-7). The model leaves out the continuous assignment's own time-0 evaluation: it would compute !x = x and change nothing.",
      "With no else clause, a failing assert calls $error (§16.4.1). Each failing run of a1 reports at once.",
      ...(reactive ? ["The program's thread is still running after time slot 0 (#5), so no implicit $finish (§24.3) ends the slot early."] : []),
    ],
  };
}

/** Builds a preset's scenario. */
export function buildDeferredScenario(id: DeferredPresetId, options: PresetOptions = {}): DeferredScenario {
  switch (id) {
    case "reset-nba-flush":
      return resetScenario(false);
    case "reset-delayed-matures":
      return resetScenario(true);
    case "lrm-unique-glitch":
      return lrmGlitchScenario();
    case "loop-flush":
      return loopScenario();
    case "two-callers":
      return twoCallersScenario();
    case "assertcontrol-race":
      return assertcontrolRaceScenario(options.controlType ?? 4);
    case "assert-forms-glitch":
      return assertFormsScenario(options.reactiveWritesA ?? false);
  }
}

/** The source line keys a scenario uses, to pin every statement to a shown line. */
export function sourceKeys(scenario: DeferredScenario): string[] {
  return scenario.source.flatMap((l) => (l.key ? [l.key] : []));
}

/** A one-paragraph text alternative for the run being shown. */
export function runSummary(scenario: DeferredScenario, run: DeferredRun, focus?: string): string {
  const slot = slotTimeLabel(scenario.scheduler);
  const count = reportCount(scenario, run, focus);
  return `In this order (${run.picks.join("; ") || "the only order"}), time slot ${slot} gives ${countText(count, focus ? "failure report" : "violation report")}. ${fateSentences(scenario, run, focus).join(" ")}`;
}
