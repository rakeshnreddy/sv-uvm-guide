/**
 * Scenarios and derived views for RunEndingExplorer: how a run ends and how
 * simulation time advances. Every run is executed by the process model in
 * `sv-process-model.ts`; this file builds the scenarios as data, derives the
 * views (time-slot list, booked wake-ups, flowchart box), grades predictions
 * against the run, and generates every sentence the component shows.
 *
 * Rules (IEEE 1800-2023), each enforced by the engine and pinned by tests:
 * - §20.10: $info, $warning and $error print a tool-specific message and do
 *   not end the run; $fatal makes an implicit call to $finish. The message
 *   layout (prefix, file, line, scope, time) is tool-specific.
 * - §20.2: $stop suspends simulation; $finish makes the simulator exit.
 * - §9.2.3: final procedures run when simulation ends "due to an explicit or
 *   implicit call to $finish", in zero time, and no remaining scheduled event
 *   executes after them.
 * - §9.3.2: join_any resumes the parent when any one spawned process ends.
 * - §9.6.3: disable fork ends every descendant of the calling process.
 * - §9.6.1: simulation terminates by itself when there is no further activity
 *   of any kind. Whether final procedures run then is not stated: the model
 *   runs them and says it is a model assumption.
 * - §4.5: time advances only by moving to the first nonempty time slot. Only a
 *   delay books a later slot in these scenarios.
 * - §9.2.2.1: `always areg = ~areg;` is a zero-delay infinite loop.
 * - §12.7.4: while repeats while its condition is true.
 *
 * Model limits, surfaced in the UI: the horizon (a run that would go on is
 * cut at `maxTime`) and the loop budget (statements per time slot before the
 * model reports a zero-delay loop) are not SystemVerilog.
 */
import {
  bin,
  c,
  formatVal,
  isAlwaysFamily,
  lit,
  now,
  prepareScenario,
  simulateProcesses,
  stepNarrationBadges,
  v,
  type BookedWake,
  type Expr,
  type PreparedScenario,
  type ProcessScenario,
  type SeverityLevel,
  type SimOutcome,
  type SimResult,
  type SourceLine,
  type Stmt,
  type TraceStep,
} from "@/lib/sv-process-model";

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* ------------------------------------------------------------------------- */

export type RunEndingPreset = "severity-and-end" | "watchdog-race" | "scheduler-loop";
export type RunEndingView = "lanes" | "loop";

/** The view each preset is drawn in. */
export const PRESET_VIEW: Record<RunEndingPreset, RunEndingView> = {
  "severity-and-end": "lanes",
  "watchdog-race": "lanes",
  "scheduler-loop": "loop",
};

export const RUN_ENDING_ASSUMPTIONS = [
  "Runs on the tested process model of IEEE 1800-2023 (§4.5, §9.2, §9.3.2, §9.6, §20.2, §20.10). Delays are in ns.",
  "Severity messages: the standard requires a tool-specific message with the severity, file and line, scope and time (§20.10). The ‹… prefix› placeholders stand for that text; its layout is tool-specific.",
  "Model horizon: a run that would go on forever is cut at a fixed time. That is a limit of the model, not SystemVerilog.",
  "Loop budget: after a fixed number of statements in one time slot without time advancing, the model reports a zero-delay loop. A real simulator just hangs.",
  "When several processes are ready together the standard sets no order (§4.7, §9.3.2); the model runs them in declaration and creation order.",
  "§9.6.1: simulation ends by itself when nothing is left to do. The standard does not say whether final procedures run then; the model runs them and labels it a model assumption.",
];

const display = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args });
const delay = (amount: number | Expr, then?: Stmt, id?: string): Stmt => ({
  kind: "delay",
  amount: typeof amount === "number" ? c(amount) : amount,
  then,
  ...(id ? { id } : {}),
});
const incr = (name: string, id?: string): Stmt => ({ kind: "assign", target: name, expr: bin("+", v(name), c(1)), ...(id ? { id } : {}) });
const decr = (name: string): Stmt => ({ kind: "assign", target: name, expr: bin("-", v(name), c(1)) });

/**
 * The source lines as the lessons spell them. The model renders `x = x + 1;`;
 * as a statement, `x++;` does the same to an int (§11.4.2), so the line is
 * shown that way. A trailing comment that only repeats the procedure keyword
 * or the block name is dropped, and a process label on an `initial begin`
 * line becomes its block name (`initial begin : main`), as in the lesson.
 */
export function lessonSource(prepared: PreparedScenario): SourceLine[] {
  return prepared.source.map((line) => {
    let text = line.text;
    text = text.replace(/^(\s*)(\w+) = \2 \+ 1;/, "$1$2++;").replace(/^(\s*)(\w+) = \2 - 1;/, "$1$2--;");
    text = text.replace(/^(\s*begin : (\w+)) \/\/ \2$/, "$1").replace(/^(\s*)end : \w+$/, "$1end");
    text = text.replace(/^((initial|final|always)\b.*?) \/\/ \2$/, "$1");
    text = text.replace(/^initial begin \/\/ (\w+)$/, "initial begin : $1");
    return { ...line, text };
  });
}

/** Text of the line a statement id was rendered on. */
export function sourceLineOf(prepared: PreparedScenario, id: string): string {
  const key = prepared.lineKeyOf.get(id) ?? id;
  return lessonSource(prepared).find((l) => l.key === key)?.text.trim() ?? "";
}

/** Steps that ran final procedures (§9.2.3). */
export const finalSteps = (result: SimResult): TraceStep[] => result.trace.filter((s) => s.kind === "final");

/**
 * The clauses behind a zero-delay hang. §9.2.2.1 names the always form
 * (`always areg = ~areg;`) a zero-delay infinite loop; a `while` without a
 * timing control inside a task or initial is §12.7.4 plus the §4.5 loop.
 */
export function zeroDelayClauses(result: SimResult): string {
  const o = result.outcome;
  if (o.kind !== "zero-delay-loop") return "§4.5";
  const kind = result.trace[result.trace.length - 1]?.procs.find((p) => p.label === o.label)?.kind ?? "child";
  return kind === "always" ? "§9.2.2.1, §4.5" : "§12.7.4, §4.5";
}

/** Badges for one step; overrides the plain "End of simulation" where the run did not end. */
export function runStepBadges(step: TraceStep, outcome: SimOutcome, result?: SimResult) {
  const base = stepNarrationBadges(step, { outcome });
  if (step.kind !== "end") return base;
  if (outcome.kind === "stop") return { ...base, kind: "Suspended", where: "Suspended by $stop, not ended (§20.2)" };
  if (outcome.kind === "zero-delay-loop")
    return { ...base, kind: "Time stopped", where: `Simulation never ends: time cannot advance (${result ? zeroDelayClauses(result) : "§4.5"})` };
  return base;
}

/** Who still had a delay wake-up booked when the run stopped. */
export function bookedAtEnd(result: SimResult): BookedWake[] {
  return result.trace[result.trace.length - 1]?.booked ?? [];
}

const listBooked = (booked: BookedWake[]) => booked.map((b) => `${b.label} at t = ${b.time} ns`).join(", ");

/**
 * The "Why" of a step. The engine's text is kept except at the end step of a
 * run that did not end through $finish, where this file words it for the
 * outcome: a suspended run, a hang with time stopped, or a quiet end.
 */
export function runStepWhy(step: TraceStep, result: SimResult): string {
  if (step.kind !== "end") return step.why;
  const o = result.outcome;
  const booked = bookedAtEnd(result);
  const bookedLabels = new Set(booked.map((b) => b.label));
  const eventWaiters = result.blockedAtEnd.filter((b) => !bookedLabels.has(b.label));
  const list = (items: { label: string; on: string }[]) => items.map((b) => `${b.label} (${b.on})`).join("; ");
  switch (o.kind) {
    case "zero-delay-loop": {
      const bookedPart = booked.length
        ? `The booked wake-ups (${listBooked(booked)}) wait for a time that never comes, so none of these delays can fire.`
        : "Nothing is booked at a later time.";
      const waitPart = eventWaiters.length ? ` Still waiting for something other than a delay: ${list(eventWaiters)}.` : "";
      return `${o.label} never reaches a timing control, so the time slot never empties and time cannot advance (${zeroDelayClauses(result)}). ${bookedPart}${waitPart} The run hangs whatever else the code does.`;
    }
    case "stop": {
      const others = result.blockedAtEnd.filter((b) => b.label !== o.by);
      const othersPart = others.length ? `; the others wait where they were: ${list(others)}` : "; no other process is waiting";
      return `${o.by} is suspended at its $stop${othersPart}. Nothing runs unless someone resumes the simulation, and final procedures run only when simulation ends (§20.2, §9.2.3).`;
    }
    case "quiet": {
      const last = result.trace[result.trace.length - 1];
      const onlyAlways =
        result.blockedAtEnd.length > 0 && result.blockedAtEnd.every((b) => isAlwaysFamily(last.procs.find((p) => p.label === b.label)?.kind ?? "child"));
      if (result.blockedAtEnd.length === 0 || onlyAlways) return step.why;
      return `Nothing is booked at any later time, so simulation ends by itself (§9.6.1), with these still waiting: ${list(result.blockedAtEnd)}. In a UVM test this would not end here: uvm-core 2020.3.1 books a run-phase timeout delay (phase_timeout, default 9200 s), so a raised objection waits until that delay fires uvm_fatal("PH_TIMEOUT").`;
    }
    default:
      return step.why;
  }
}

/**
 * The diagnostic the tool prints when $finish, $stop or $fatal runs, which the
 * output panel does not show: level n of Table 20-1 (§20.2), 1 when no
 * argument is given; $fatal's first argument is the same level (§20.10).
 * `index` is the step that ended or suspended the run.
 */
export function endDiagnosticNote(result: SimResult, prepared: PreparedScenario): { index: number; text: string } | undefined {
  const o = result.outcome;
  if (o.kind !== "finish" && o.kind !== "stop") return undefined;
  const source = lessonSource(prepared);
  const lineOf = (s: TraceStep) => source.find((l) => l.key === s.lineKey)?.text ?? "";
  const index =
    o.kind === "stop"
      ? result.trace.findIndex((s) => s.kind === "exec" && s.time === o.time && /\$stop\b/.test(lineOf(s)))
      : result.trace.findIndex((s) => s.kind === "finish");
  const step = result.trace[index];
  if (!step) return undefined;
  const fatal = o.kind === "finish" && o.via === "fatal";
  const call = o.kind === "stop" ? "$stop" : fatal ? "$fatal" : "$finish";
  const line = lineOf(step);
  const arg = line.match(fatal ? /\$fatal\s*\(\s*([012])\b/ : /\$(?:stop|finish)\s*\(\s*([012])\s*\)/);
  const level = arg ? Number(arg[1]) : 1;
  const what = ["prints nothing", "prints the simulation time and location", "prints the simulation time, location, and memory and CPU statistics"][level];
  const why = fatal ? `its first argument is ${level}` : arg ? `the argument is ${level}` : "no argument means level 1";
  const clause = fatal ? "§20.10, §20.2 Table 20-1" : "§20.2 Table 20-1";
  return { index, text: `Not shown: at ${call} the tool also reports diagnostic level ${level} (${why}), which ${what}; the wording is the tool's own (${clause}).` };
}

/** One short line that names how the run ended. */
export function endingHeadline(result: SimResult): string {
  const o = result.outcome;
  switch (o.kind) {
    case "finish":
      return o.via === "fatal" ? `Ended at t = ${o.time} ns by the implicit $finish inside $fatal` : `Ended at t = ${o.time} ns by $finish`;
    case "stop":
      return `Suspended: what a batch tool does next is tool-dependent ($stop at t = ${o.time} ns)`;
    case "quiet":
      return `Ended at t = ${o.time} ns: nothing left booked`;
    case "horizon": {
      const who = bookedAtEnd(result)[0]?.label ?? "a process";
      return `Still running at the ${o.maxTime} ns model horizon: the ${who} always has another event booked`;
    }
    case "zero-delay-loop":
      return `Time stopped at t = ${o.time} ns: a zero-delay loop, so the run never ends`;
  }
}

/** The explanation under the headline, with clauses. Generated from the run. */
export function endingDetails(result: SimResult): string[] {
  const o = result.outcome;
  const finals = finalSteps(result);
  const finalNames = [...new Set(finals.map((s) => s.procs.find((p) => p.pid === s.pid)?.label ?? "final"))];
  const finalLine =
    finals.length > 0
      ? `Final procedures ran once, in zero time, at t = ${result.endTime} ns (${finalNames.join(", ")}), and no booked event runs after them (§9.2.3).`
      : "This code declares no final procedure, so nothing more runs (§9.2.3 would run one here).";
  const booked = bookedAtEnd(result);
  switch (o.kind) {
    case "finish":
      return [
        o.via === "fatal"
          ? `${o.by} called $fatal: it prints a fatal message and makes an implicit call to $finish (§20.10).`
          : `${o.by} called $finish: the simulator exits and returns control to the operating system (§20.2).`,
        finalLine,
        booked.length ? `Booked but never run: ${listBooked(booked)}. Nothing runs after the end.` : "Nothing was left booked.",
      ];
    case "stop":
      return [
        `${o.by} called $stop: simulation is suspended, not ended (§20.2). An interactive tool waits for a command; what a batch tool does next is tool-dependent.`,
        "Final procedures have not run: they run only when simulation ends through an explicit or implicit $finish (§9.2.3).",
      ];
    case "quiet":
      return [
        `Nothing is booked at any later time and nothing can wake the processes still waiting, so simulation ends by itself (§9.6.1).`,
        finals.length > 0
          ? `Model assumption: §9.2.3 ties final procedures to an explicit or implicit $finish and does not say whether they run here. The model runs them (${finalNames.join(", ")}).`
          : "No final procedure is declared.",
      ];
    case "horizon":
      return [
        `The next wake-up is booked for t = ${o.next} ns (${listBooked(booked) || "a delay"}), past the ${o.maxTime} ns horizon. The horizon is a limit of this model, not SystemVerilog.`,
        "A real simulation keeps going: something is always booked, so the loop of §4.5 never runs out of time slots. Only a call that ends simulation, such as $finish, or the job runner killing the job, stops it. Final procedures have not run.",
      ];
    case "zero-delay-loop":
      return [
        `${o.label} ran the model's ${o.statements}-statement loop budget at t = ${o.time} ns without reaching a timing control, so the time slot never empties and time cannot advance (${zeroDelayClauses(result)}).`,
        booked.length
          ? `Booked but never reached: ${listBooked(booked)}. A delay-based timer cannot fire while time is stopped.`
          : "Nothing else is booked.",
        "A real run hangs here (§9.2.2.1 calls the always form a simulation deadlock); the model stops after its loop budget.",
      ];
  }
}

/* ------------------------------------------------------------------------- */
/* Preset 1: severity-and-end                                                 */
/* ------------------------------------------------------------------------- */

export type EndControl = "error" | "fatal" | "stop" | "finish";
export const END_CONTROLS: EndControl[] = ["error", "fatal", "stop", "finish"];

export interface SeverityConfig {
  control: EndControl;
  /** `n_fail++` runs in the failing branch, before the control statement. */
  count: boolean;
}

/** One delay between the statements of the severity scenario (ns). */
export const SEVERITY_STEP_NS = 10;
const MISMATCH = "data mismatch at t=%0d";

/** What each control statement does, per the standard. The tests check every run against this table. */
/**
 * `returns`: true, the process goes on with the next statement; false, the run
 * ends there; "suspends", the run is suspended (§20.2) and goes on only if
 * someone resumes it, which nobody does in this run.
 */
export const CONTROL_FACTS: Record<EndControl, { returns: true | false | "suspends"; ends: "no" | "finish" | "suspend"; clause: string; label: string }> = {
  error: { returns: true, ends: "no", clause: "§20.10", label: "$error" },
  fatal: { returns: false, ends: "finish", clause: "§20.10", label: "$fatal(1, …)" },
  stop: { returns: "suspends", ends: "suspend", clause: "§20.2", label: "$stop" },
  finish: { returns: false, ends: "finish", clause: "§20.2", label: "$finish" },
};

function controlStmt(control: EndControl): Stmt {
  switch (control) {
    case "error":
      return { id: "ctl", kind: "severity", level: "error", format: MISMATCH, args: [now] };
    case "fatal":
      return { id: "ctl", kind: "severity", level: "fatal", finishNumber: 1, format: MISMATCH, args: [now] };
    case "stop":
      return { id: "ctl", kind: "stop" };
    case "finish":
      return { id: "ctl", kind: "finish" };
  }
}

export function severityScenario(cfg: SeverityConfig): ProcessScenario {
  const d = SEVERITY_STEP_NS;
  return {
    id: `severity:${cfg.control}:${cfg.count ? "count" : "nocount"}`,
    title: "Severity tasks and the end of the run",
    vars: [{ name: "n_fail", type: "int" }],
    processes: [
      {
        id: "test",
        label: "initial",
        kind: "initial",
        body: [
          { kind: "severity", level: "info", format: "check started", args: [] },
          delay(d, { kind: "severity", level: "warning", format: "response took %0d cycles", args: [c(9)] }),
          delay(d, undefined, "fail-wait"),
          ...(cfg.count ? [incr("n_fail", "count")] : []),
          controlStmt(cfg.control),
          delay(d, display("still running at t=%0d", now), "later"),
          { id: "end", kind: "finish" },
        ],
      },
      { id: "summary", label: "final", kind: "final", body: [display("final block: FAIL=%0d", v("n_fail"))] },
    ],
  };
}

export interface SeverityRun {
  config: SeverityConfig;
  scenario: ProcessScenario;
  prepared: PreparedScenario;
  result: SimResult;
  /** Time the control statement ran. */
  controlTime: number;
  /** Time of the "still running" line, as written in the code. */
  laterTime: number;
  laterPrinted: boolean;
  /** The final summary line, when final ran. */
  summary?: string;
  /** n_fail as the final procedure read it. */
  failCount?: number;
}

export function runSeverity(cfg: SeverityConfig): SeverityRun {
  const scenario = severityScenario(cfg);
  const prepared = prepareScenario(scenario);
  const result = simulateProcesses(scenario);
  const ctlKey = prepared.lineKeyOf.get("ctl") ?? "ctl";
  const controlStep = result.trace.find((s) => s.lineKey === ctlKey && s.pid !== undefined);
  const controlTime = controlStep?.time ?? 0;
  const later = result.log.find((l) => l.text.startsWith("still running"));
  const summaryLine = result.log.find((l) => l.region === "final");
  const finalStep = finalSteps(result)[0];
  return {
    config: cfg,
    scenario,
    prepared,
    result,
    controlTime,
    laterTime: controlTime + SEVERITY_STEP_NS,
    laterPrinted: later !== undefined,
    summary: summaryLine?.text,
    failCount: finalStep ? Number(formatVal(finalStep.vars.n_fail)) : undefined,
  };
}

export interface GradedOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Why the control statement does what it does, generated from CONTROL_FACTS and the run. */
export function controlExplanation(run: SeverityRun): string {
  const t = run.controlTime;
  switch (run.config.control) {
    case "error":
      return `$error prints its message with a tool-specific prefix and returns: §20.10 gives $error no implicit $finish (a tool option, such as an error-count limit, could still end a run). So the initial block goes on: it prints at t = ${run.laterTime} ns and calls $finish, and final runs (§9.2.3).`;
    case "fatal":
      return `$fatal prints a fatal error and makes an implicit call to $finish at t = ${t} ns, so the simulation ends with an error code; the 1 is the $finish diagnostic level (§20.10, §20.2 Table 20-1). The initial block never resumes, but final still runs, because the run ended through an implicit $finish (§9.2.3).`;
    case "stop":
      return `$stop suspends simulation at t = ${t} ns (§20.2). It does not end it, so final does not run (§9.2.3), and nothing later prints. Resumed from an interactive prompt, the initial block would go on at the next statement; nobody resumes it here, and what a batch tool does next is tool-dependent.`;
    case "finish":
      return `$finish ends the run at t = ${t} ns (§20.2): the initial block never resumes, and final runs once, in zero time (§9.2.3).`;
  }
}

/** Why the line after the control statement does not print, from CONTROL_FACTS. */
function notReachedReason(run: SeverityRun): string {
  const facts = CONTROL_FACTS[run.config.control];
  if (facts.returns === "suspends")
    return `${facts.label} suspends the run at t = ${run.controlTime} ns, so nothing after it runs unless someone resumes the simulation. In this run nobody does (${facts.clause}).`;
  return `${facts.label} ends the run and does not return, so the initial block never reaches t = ${run.laterTime} ns (${facts.clause}).`;
}

export function severityLineOptions(run: SeverityRun): GradedOption[] {
  const summaryPrinted = run.summary !== undefined;
  const at = run.laterTime;
  const explain = controlExplanation(run);
  const options: { id: string; label: string; later: boolean; summary: boolean; wrong: string }[] = [
    {
      id: "both",
      label: `"still running at t=${at}", then the final summary`,
      later: true,
      summary: true,
      wrong: notReachedReason(run),
    },
    {
      id: "summary",
      label: "Only the final summary",
      later: false,
      summary: true,
      wrong: run.laterPrinted
        ? `${CONTROL_FACTS[run.config.control].label} returns, so the run reaches t = ${at} ns as well.`
        : "Final runs only when simulation ends through an explicit or implicit $finish (§9.2.3). This run is suspended, not ended.",
    },
    {
      id: "neither",
      label: "Neither line",
      later: false,
      summary: false,
      wrong: "Something still runs: final procedures run when the run ends through an explicit or implicit $finish (§9.2.3).",
    },
    {
      id: "later",
      label: `Only "still running at t=${at}"`,
      later: true,
      summary: false,
      wrong: run.laterPrinted
        ? "The run ends with $finish, so final runs too (§9.2.3)."
        : notReachedReason(run),
    },
  ];
  return options.map((o) => {
    const correct = o.later === run.laterPrinted && o.summary === summaryPrinted;
    return { id: o.id, label: o.label, correct, feedback: correct ? explain : o.wrong };
  });
}

/** Why the summary shows the count it shows: only the counter decides (§20.10 adds no counter). */
export function counterExplanation(run: SeverityRun): string {
  if (run.summary === undefined) return "No summary prints. final has not run: $stop suspended the run without ending it (§20.2, §9.2.3).";
  const n = run.failCount ?? 0;
  const reported = run.config.control === "error" || run.config.control === "fatal";
  if (run.config.count)
    return `FAIL=${n}: final reads n_fail, and n_fail++ ran before the ${CONTROL_FACTS[run.config.control].label}. The summary is built only from the counter.`;
  return reported
    ? `FAIL=${n}: ${CONTROL_FACTS[run.config.control].label} printed ${run.config.control === "fatal" ? "a fatal error" : "an error"} but changed no variable, and nothing incremented n_fail. A script reading the summary sees no failure.`
    : `FAIL=${n}: nothing incremented n_fail, and the summary is built only from the counter.`;
}

export function severityCountOptions(run: SeverityRun): GradedOption[] {
  const explain = counterExplanation(run);
  const values: { id: string; label: string; value: number | undefined }[] = [
    { id: "0", label: "FAIL=0", value: 0 },
    { id: "1", label: "FAIL=1", value: 1 },
    { id: "none", label: "No summary prints", value: undefined },
  ];
  return values.map((o) => {
    const correct = o.value === run.failCount;
    let wrong: string;
    if (o.value === undefined) wrong = "final does run here: the run ends through an explicit or implicit $finish (§9.2.3).";
    else if (run.failCount === undefined) wrong = "There is no summary to count in: $stop suspended the run without ending it, so final has not run (§20.2, §9.2.3).";
    else if (o.value === 1) wrong = "$error and $fatal report; they do not count. Only n_fail++ changes n_fail.";
    else wrong = "n_fail++ ran before the control statement, so n_fail is 1 whatever that statement does.";
    return { id: o.id, label: o.label, correct, feedback: correct ? explain : wrong };
  });
}

/** Placeholder for the tool's own message text (§20.10: tool-specific). */
export function severityPrefix(level: SeverityLevel, time: number): string {
  const name = { info: "Info", warning: "Warning", error: "Error", fatal: "Fatal" }[level];
  return `‹${name} prefix, ${time} ns›`;
}

/* ------------------------------------------------------------------------- */
/* Preset 2: watchdog-race                                                    */
/* ------------------------------------------------------------------------- */

export type EndOfRunVariant = "normal" | "hang" | "no-finish" | "zero-delay";
export const END_OF_RUN_VARIANTS: { value: EndOfRunVariant; label: string }[] = [
  { value: "normal", label: "normal run" },
  { value: "hang", label: "run hangs on a wait that never completes" },
  { value: "no-finish", label: "$finish deleted" },
  { value: "zero-delay", label: "zero-delay wait loop" },
];

/** The watchdog timeout and the model horizon of the "$finish deleted" run (ns). */
export const WATCHDOG_TIMEOUT = 100;
export const NO_FINISH_HORIZON = 60;
/** Expectations queued by the run branch. */
export const EXPECTATIONS = 3;
const LOOP_BUDGET = 16;

/**
 * The lesson's watchdog race, with stand-ins for the parts the model cannot
 * run: n_exp stands in for exp_q.size() (the model has no queues), and
 * reset_dut()/drain() are reduced to the waits that matter here.
 */
export function endOfRunScenario(variant: EndOfRunVariant): ProcessScenario {
  const deadClock = variant === "hang";
  const drainBody: Stmt[] =
    variant === "zero-delay"
      ? [{ id: "drain-wait", kind: "while", cond: bin("!=", v("n_exp"), c(0)), body: [], comment: "no timing control inside" }]
      : [{ id: "drain-wait", kind: "waitCond", cond: bin("==", v("n_exp"), c(0)) }];
  const tail: Stmt[] =
    variant === "no-finish"
      ? [{ id: "main-report", kind: "call", task: "report", args: [], comment: "$finish deleted" }]
      : [
          { id: "main-report", kind: "call", task: "report", args: [] },
          { id: "main-finish", kind: "finish" },
        ];
  return {
    id: `end-of-run:${variant}`,
    title: "The watchdog race",
    vars: [
      {
        name: "clk",
        type: "logic",
        ...(deadClock ? { comment: "no initializer: ~x stays x" } : { init: 0, initLabel: "1'b0" }),
      },
      { name: "pass_cnt", type: "int", init: 0 },
      { name: "fail_cnt", type: "int", init: 0 },
      { name: "n_exp", type: "int", init: 0, comment: "stands in for exp_q.size()" },
      { name: "TIMEOUT", type: "int", init: WATCHDOG_TIMEOUT, comment: "a parameter in the lesson's bench" },
    ],
    tasks: [
      { name: "reset_dut", automatic: true, params: [], body: [{ id: "reset-wait", kind: "waitEdge", edge: "negedge", signal: "clk" }] },
      { name: "drain", automatic: true, params: [], body: drainBody },
      { name: "report", automatic: true, params: [], body: [display("PASS=%0d FAIL=%0d", v("pass_cnt"), v("fail_cnt"))] },
    ],
    loopBudget: LOOP_BUDGET,
    maxTime: variant === "no-finish" ? NO_FINISH_HORIZON : undefined,
    processes: [
      {
        id: "main",
        label: "main",
        kind: "initial",
        body: [
          {
            id: "race",
            kind: "fork",
            join: "join_any",
            branches: [
              {
                kind: "seq",
                name: "run",
                body: [
                  { id: "run-reset", kind: "call", task: "reset_dut", args: [] },
                  { id: "run-queue", kind: "assign", target: "n_exp", expr: c(EXPECTATIONS), comment: "expectations queued" },
                  { id: "run-drain", kind: "call", task: "drain", args: [] },
                ],
              },
              {
                kind: "seq",
                name: "watchdog",
                body: [
                  { ...delay(lit(WATCHDOG_TIMEOUT, "(TIMEOUT)")), id: "wd-delay" },
                  { ...incr("fail_cnt"), id: "wd-count", comment: "a hang is a failure" },
                  { id: "wd-report", kind: "call", task: "report", args: [] },
                  { id: "wd-fatal", kind: "severity", level: "fatal", finishNumber: 1, format: "WDOG still running at %0t", args: [now] },
                ],
              },
            ],
            labels: ["run", "watchdog"],
          },
          { id: "main-disable", kind: "disableFork" },
          ...tail,
        ],
      },
      { id: "clock", label: "clock", kind: "always", role: "clock", body: [delay(5, { kind: "assign", target: "clk", expr: { kind: "inv", operand: v("clk") } })] },
      {
        id: "checker",
        label: "checker",
        kind: "always",
        body: [
          {
            id: "chk-edge",
            kind: "waitEvents",
            terms: [{ edge: "posedge", expr: v("clk") }],
            then: { id: "chk-if", kind: "if", cond: bin("!=", v("n_exp"), c(0)), then: [decr("n_exp"), incr("pass_cnt")] },
          },
        ],
      },
    ],
  };
}

export type RunEnder = "main-finish" | "watchdog-fatal" | "still-running" | "time-stopped";

export interface EndOfRunRun {
  variant: EndOfRunVariant;
  scenario: ProcessScenario;
  prepared: PreparedScenario;
  result: SimResult;
  summary?: { text: string; time: number; by: string };
  ender: RunEnder;
  /** Time the watchdog was killed by disable fork, if it was. */
  watchdogKilledAt?: number;
}

export function classifyEnder(result: SimResult): RunEnder {
  const o = result.outcome;
  if (o.kind === "finish") return o.via === "fatal" ? "watchdog-fatal" : "main-finish";
  if (o.kind === "zero-delay-loop") return "time-stopped";
  return "still-running";
}

export function runEndOfRun(variant: EndOfRunVariant): EndOfRunRun {
  const scenario = endOfRunScenario(variant);
  const prepared = prepareScenario(scenario);
  const result = simulateProcesses(scenario);
  const line = result.log.find((l) => l.text.startsWith("PASS="));
  const kill = result.trace.find((s) => s.kind === "kill" && s.killed?.includes("watchdog"));
  return {
    variant,
    scenario,
    prepared,
    result,
    summary: line ? { text: line.text, time: line.time, by: line.label } : undefined,
    ender: classifyEnder(result),
    watchdogKilledAt: kill?.time,
  };
}

/** Why this variant ends as it does, generated from the run. */
export function endOfRunExplanation(run: EndOfRunRun): string {
  const r = run.result;
  const o = r.outcome;
  const summary = run.summary ? `"${run.summary.text}"` : "";
  switch (run.ender) {
    case "main-finish":
      return `The run branch ends at t = ${o.time} ns. join_any resumes main (§9.3.2), disable fork kills the waiting watchdog (§9.6.3), report() prints ${summary}, and $finish ends the run (§20.2).`;
    case "watchdog-fatal":
      return `run never gets past its wait, so join_any keeps main waiting. At t = ${o.time} ns the watchdog's #(TIMEOUT) expires: fail_cnt++, report() prints ${summary}, and $fatal's implicit $finish ends the run (§20.10). Final procedures would run now (§9.2.3).`;
    case "still-running":
      return `report() prints ${summary} at t = ${run.summary?.time ?? 0} ns, but with $finish deleted nothing ends the run. disable fork already killed the watchdog, and the free-running clock always has another event booked, so the loop of §4.5 never runs out of time slots. The model stops at its ${o.kind === "horizon" ? o.maxTime : NO_FINISH_HORIZON} ns horizon; a real job hangs until the runner kills it.`;
    case "time-stopped":
      return `At t = ${o.time} ns, while (n_exp != 0); spins with no timing control: the checker can never run to change n_exp, and time cannot advance (${zeroDelayClauses(r)}). The watchdog's wake-up at t = ${WATCHDOG_TIMEOUT} ns is booked but never arrives, so no summary prints.`;
  }
}

export function endOfRunOptions(run: EndOfRunRun): GradedOption[] {
  const printed = run.summary !== undefined;
  const explain = endOfRunExplanation(run);
  const options: { id: string; label: string; printed: boolean; ender: RunEnder; wrong: string }[] = [
    {
      id: "yes-finish",
      label: "Yes; main's $finish ends the run",
      printed: true,
      ender: "main-finish",
      wrong: "main reaches report() and $finish only when the run branch ends, and only if $finish is still there.",
    },
    {
      id: "yes-fatal",
      label: "Yes; the watchdog's $fatal ends the run",
      printed: true,
      ender: "watchdog-fatal",
      wrong: "The watchdog fires only if it is still alive at TIMEOUT and time can reach TIMEOUT.",
    },
    {
      id: "yes-never",
      label: "Yes; then nothing ends the run",
      printed: true,
      ender: "still-running",
      wrong: "A run goes on without $finish only while something is booked and nothing ends it.",
    },
    {
      id: "no-never",
      label: "No; time stops and nothing ends the run",
      printed: false,
      ender: "time-stopped",
      wrong: "Time stops when a loop runs without any timing control, so the time slot never empties (§4.5). Nothing in this run does that.",
    },
  ];
  return options.map((o) => {
    const correct = o.printed === printed && o.ender === run.ender;
    return { id: o.id, label: o.label, correct, feedback: correct ? explain : o.wrong };
  });
}

/* ------------------------------------------------------------------------- */
/* Preset 3: scheduler-loop (§4.5)                                            */
/* ------------------------------------------------------------------------- */

export type LoopVariant = "finish" | "quiet" | "free-clock" | "zero-delay";
export const LOOP_VARIANTS: { value: LoopVariant; label: string }[] = [
  { value: "finish", label: "$finish at 22 ns" },
  { value: "quiet", label: "blocked waiter, nothing booked" },
  { value: "free-clock", label: "free-running clock, no $finish" },
  { value: "zero-delay", label: "always areg = ~areg;" },
];
/** The test's delay before its last print (ns). */
export const TEST_DELAY = 22;
/** Horizon of the free-running-clock variant (a model limit). */
export const LOOP_HORIZON = 40;

const clockProc = { id: "clkgen", label: "clock", kind: "always" as const, role: "clock" as const, body: [delay(5, { kind: "assign", target: "clk", expr: { kind: "inv", operand: v("clk") } } as Stmt)] };
const counterProc = {
  id: "counter",
  label: "counter",
  kind: "always" as const,
  role: "design" as const,
  body: [{ kind: "waitEdge", edge: "posedge", signal: "clk", then: { kind: "assign", target: "count", expr: bin("+", v("count"), c(1)), nba: true } } as Stmt],
};

export function schedulerLoopScenario(variant: LoopVariant): ProcessScenario {
  const report = { id: "report", label: "report", kind: "final" as const, body: [display("final: count = %0d", v("count"))] };
  switch (variant) {
    case "finish":
    case "free-clock":
      return {
        id: `loop:${variant}`,
        title: variant === "finish" ? "$finish at 22 ns" : "A free-running clock and no $finish",
        vars: [
          { name: "clk", type: "logic", init: 0 },
          { name: "count", type: "int", init: 0 },
        ],
        maxTime: variant === "free-clock" ? LOOP_HORIZON : undefined,
        processes: [
          clockProc,
          counterProc,
          {
            id: "test",
            label: "test",
            kind: "initial",
            body: [display("test starts"), delay(TEST_DELAY, display("count = %0d", v("count"))), ...(variant === "finish" ? [{ kind: "finish" } as Stmt] : [])],
          },
          report,
        ],
      };
    case "quiet":
      return {
        id: "loop:quiet",
        title: "A blocked waiter and nothing booked",
        vars: [
          { name: "ready", type: "logic", init: 0 },
          { name: "count", type: "int", init: 0 },
        ],
        processes: [
          { id: "driver", label: "driver", kind: "initial", body: [delay(10, { kind: "assign", target: "ready", expr: c(1) })] },
          {
            id: "waiter",
            label: "waiter",
            kind: "initial",
            body: [delay(TEST_DELAY, { kind: "waitEdge", edge: "posedge", signal: "ready", then: { kind: "assign", target: "count", expr: c(1) } })],
          },
          report,
        ],
      };
    case "zero-delay":
      return {
        id: "loop:zero-delay",
        title: "always areg = ~areg;",
        vars: [
          { name: "areg", type: "logic", init: 0 },
          { name: "count", type: "int", init: 0 },
        ],
        loopBudget: LOOP_BUDGET,
        processes: [
          { id: "test", label: "test", kind: "initial", body: [display("test starts"), delay(TEST_DELAY, display("count = %0d", v("count"))), { kind: "finish" }] },
          { id: "toggle", label: "toggle", kind: "always", body: [{ kind: "assign", target: "areg", expr: { kind: "inv", operand: v("areg") } }] },
          report,
        ],
      };
  }
}

export interface LoopRun {
  variant: LoopVariant;
  scenario: ProcessScenario;
  prepared: PreparedScenario;
  result: SimResult;
  /** Every time slot the loop visited, in order. */
  visited: number[];
}

export function runSchedulerLoop(variant: LoopVariant): LoopRun {
  const scenario = schedulerLoopScenario(variant);
  const prepared = prepareScenario(scenario);
  const result = simulateProcesses(scenario);
  const visited = [0, ...result.trace.filter((s) => s.kind === "advance").map((s) => s.time)];
  return { variant, scenario, prepared, result, visited };
}

/** The boxes of the §4.5 loop, simplified as in the F3A lesson. */
export type LoopBox = "init" | "check" | "move" | "execute" | "exit" | "final";

export const LOOP_BOXES: { id: LoopBox; title: string; detail: string }[] = [
  { id: "init", title: "T = 0", detail: "Initialize nets and variables; schedule every time-0 event." },
  { id: "check", title: "Is any time slot nonempty?", detail: "No: simulation ends. Yes: go on." },
  { id: "move", title: "Move to the first nonempty time slot; set T", detail: "The only place time advances (§4.5)." },
  { id: "execute", title: "Execute the time slot", detail: "Take events until the slot is empty, then go back to the check." },
  { id: "exit", title: "$finish", detail: "Explicit or implicit: leave the loop at once (§20.2)." },
  { id: "final", title: "final procedures", detail: "Once, in zero time; no booked event runs after them (§9.2.3)." },
];

/** True when a final procedure ran before step `index`. */
const finalsBefore = (result: SimResult, index: number) => result.trace.some((s, i) => i < index && s.region === "final");

/**
 * The flowchart box a step belongs to. Once final procedures start, every
 * later step stays on "final": final runs in zero time after simulation ends,
 * outside the §4.5 loop (§9.2.3), so the run never goes back into a box.
 */
export function loopBoxOf(result: SimResult, index: number): LoopBox {
  const step = result.trace[index];
  const outcome = result.outcome;
  if (step.region === "final" || step.kind === "final") return "final";
  switch (step.kind) {
    case "start":
      return "init";
    case "advance":
      return "move";
    case "finish":
      return "exit";
    case "end":
      if (finalsBefore(result, index)) return "final";
      if (outcome.kind === "quiet" || outcome.kind === "horizon") return "check";
      if (outcome.kind === "finish") return "exit";
      return "execute";
    default:
      return "execute";
  }
}

/**
 * A box the loop passed through on the way into step `index`, with its note.
 * A run that ends without $finish leaves the loop at the check ("No"), and
 * only then do final procedures run (§4.5, §9.6.1): the first final step of
 * such a run passes the check first.
 */
export function loopBoxPassed(result: SimResult, index: number): { box: LoopBox; note: string } | undefined {
  if (index === 0 || loopBoxOf(result, index) !== "final" || finalsBefore(result, index)) return undefined;
  const before = loopBoxOf(result, index - 1);
  if (before === "exit" || before === "final") return undefined;
  return { box: "check", note: "No: every time slot is empty, so simulation ends (§9.6.1)." };
}

/** A note on the active box, where the step needs one. */
export function loopBoxNote(result: SimResult, index: number): string | undefined {
  const step = result.trace[index];
  const outcome = result.outcome;
  const box = loopBoxOf(result, index);
  if (box === "check" && step.kind === "end" && outcome.kind === "quiet") return "No: every time slot is empty, so simulation ends (§9.6.1).";
  if (box === "check" && step.kind === "end" && outcome.kind === "horizon")
    return `Yes: t = ${outcome.next} ns is booked. It lies past the ${outcome.maxTime} ns model horizon, so the model stops here; a real run goes on.`;
  if (box === "execute" && outcome.kind === "zero-delay-loop" && step.kind === "end")
    return `The slot never empties: the loop never returns to the check, so time never advances (${zeroDelayClauses(result)}).`;
  if (box === "final" && step.kind === "end")
    return outcome.kind === "quiet"
      ? "Run over: nothing runs after the final procedures. That they ran at all is a model assumption (§9.6.1, §9.2.3)."
      : "Run over: no booked event runs after the final procedures (§9.2.3).";
  if (box === "final" && outcome.kind === "quiet")
    return "Model assumption: the run ended without $finish (§9.6.1). §9.2.3 does not say whether final procedures run then; the model runs them.";
  if (box === "final") return "Reached through $finish: final procedures run once, in zero time (§9.2.3).";
  return undefined;
}

/**
 * ◆ update: a variable changed value. ▶ evaluation: a process runs (§4.3).
 * "final": a final procedure, which runs after the last time slot and not as
 * a separate process (§9.2.3), so it gets no ▶.
 */
export type SlotItem = { kind: "update" | "evaluation" | "final"; text: string; status: "done" | "now" | "pending" };

/** Steps that are not a process running: time moving, a wake-up, a release, an NBA update, the end. */
const NOT_RUNNING: TraceStep["kind"][] = ["advance", "wake", "release", "nba", "end"];
const runsAt = (s: TraceStep) => s.pid !== undefined && !NOT_RUNNING.includes(s.kind);
/** Consecutive changes of one variable, from this many on, are shown as one line. */
export const COLLAPSE_UPDATES_FROM = 3;

/**
 * The events of the current time slot up to this step. Within a step, the
 * process's evaluation comes before the updates it made. Pending evaluations
 * are the processes ready to run but not yet run. Once final procedures start
 * (finalPhase), the list holds only what ran after the last time slot.
 */
export function slotEvents(result: SimResult, index: number): { time: number; items: SlotItem[]; finalPhase: boolean } {
  const step = result.trace[index];
  const firstFinal = result.trace.findIndex((s) => s.region === "final");
  const finalPhase = firstFinal !== -1 && index >= firstFinal;
  let start = index;
  if (finalPhase) start = firstFinal;
  else while (start > 0 && result.trace[start].kind !== "advance" && result.trace[start].kind !== "start") start -= 1;
  const raw: (SlotItem & { name?: string; from?: string; to?: string })[] = [];
  const ranPids: number[] = [];
  for (let i = start; i <= index; i += 1) {
    const s = result.trace[i];
    const prev = i > 0 ? result.trace[i - 1] : undefined;
    if (runsAt(s) && s.pid !== undefined && ranPids[ranPids.length - 1] !== s.pid) {
      ranPids.push(s.pid);
      const label = s.procs.find((p) => p.pid === s.pid)?.label ?? `process ${s.pid}`;
      raw.push(
        s.region === "final"
          ? { kind: "final", text: `${label} (final procedure, zero time)`, status: "done" }
          : { kind: "evaluation", text: `${label} runs`, status: "done" },
      );
    }
    if (prev && s.kind !== "start")
      Object.keys(s.vars).forEach((name) => {
        if (prev.vars[name] !== s.vars[name]) {
          const from = formatVal(prev.vars[name]);
          const to = formatVal(s.vars[name]);
          raw.push({ kind: "update", text: `${name} ${from} → ${to}`, status: i === index ? "now" : "done", name, from, to });
        }
      });
  }
  const last = raw.filter((i) => i.kind !== "update").pop();
  if (last && runsAt(step) && step.kind !== "block" && ranPids[ranPids.length - 1] === step.pid) last.status = "now";

  const items: SlotItem[] = [];
  for (let i = 0; i < raw.length; ) {
    const item = raw[i];
    let j = i + 1;
    if (item.kind === "update") while (j < raw.length && raw[j].kind === "update" && raw[j].name === item.name) j += 1;
    const run = raw.slice(i, j);
    if (run.length >= COLLAPSE_UPDATES_FROM)
      items.push({
        kind: "update",
        text: `${item.name} changed ${run.length} times: ${item.from} → … → ${run[run.length - 1].to}`,
        status: run.some((r) => r.status === "now") ? "now" : "done",
      });
    else run.forEach((r) => items.push({ kind: r.kind, text: r.text, status: r.status }));
    i = j;
  }
  if (!finalPhase)
    step.procs
      .filter((p) => p.state === "ready")
      .forEach((p) => items.push({ kind: "evaluation", text: `${p.label} is ready to run`, status: "pending" }));
  return { time: step.time, items, finalPhase };
}

/**
 * Booked wake-ups at a step. "due": earliest first, as the loop will take
 * them. "booking": in the order they were booked, so a list shown during a
 * prediction does not give away which comes first.
 */
export function bookedList(result: SimResult, index: number, order: "due" | "booking"): BookedWake[] {
  const step = result.trace[index];
  if (order === "due") return [...step.booked].sort((a, b) => a.time - b.time || a.pid - b.pid);
  const firstSeen = new Map<string, number>();
  result.trace.slice(0, index + 1).forEach((s, i) => s.booked.forEach((b) => firstSeen.has(`${b.pid}@${b.time}`) || firstSeen.set(`${b.pid}@${b.time}`, i)));
  return [...step.booked].sort((a, b) => (firstSeen.get(`${a.pid}@${a.time}`) ?? 0) - (firstSeen.get(`${b.pid}@${b.time}`) ?? 0) || a.pid - b.pid);
}

/** Indices of the steps where time jumps: each is preceded by a prediction. */
export function jumpGates(result: SimResult): number[] {
  return result.trace.flatMap((s, i) => (s.kind === "advance" ? [i] : []));
}

/** Choices for "which time does the loop visit next?" before the jump at `gate`. */
export function jumpOptions(result: SimResult, gate: number): GradedOption[] {
  const before = result.trace[gate - 1];
  const target = result.trace[gate].time;
  const due = bookedList(result, gate - 1, "due");
  const who = (t: number) => due.filter((b) => b.time === t).map((b) => b.label).join(", ");
  const times = [...new Set(due.map((b) => b.time))].slice(0, 3);
  const next = before.time + 1;
  const all = times.includes(next) ? times : [next, ...times];
  return [...all]
    .sort((a, b) => a - b)
    .map((t) => {
      const correct = t === target;
      const feedback = correct
        ? `Time jumps straight to t = ${t} ns, the earliest booked wake-up (${who(t)}). Nothing is booked in between, so no time in between is ever visited (§4.5).`
        : t === next && !times.includes(t)
          ? `Time does not tick by 1 ns. Nothing is booked at t = ${t} ns, so that slot is empty and the loop never visits it (§4.5).`
          : `t = ${t} ns is booked (${who(t)}), but t = ${target} ns comes first: the loop moves to the first nonempty time slot (§4.5).`;
      return { id: String(t), label: `t = ${t} ns`, correct, feedback };
    });
}

/**
 * Feedback for the up-front "how does the run end?" prediction. It names how
 * and when, but not the times visited on the way: those are asked one jump at
 * a time later, and the full account appears in the ending panel.
 */
export function loopEndExplanation(run: LoopRun): string {
  const reason: Record<SimOutcome["kind"], string> = {
    finish: "A process reaches $finish, which ends the run at once (§20.2); final procedures then run once, in zero time (§9.2.3).",
    quiet: "No time slot is left nonempty, so the run ends by itself (§9.6.1). That final procedures still run is a model assumption (§9.2.3).",
    horizon: "Something is always booked, so the §4.5 loop never runs out of time slots. The horizon is a limit of the model, not SystemVerilog.",
    "zero-delay-loop": `A process never reaches a timing control, so the time slot never empties and time cannot advance (${zeroDelayClauses(run.result)}).`,
    stop: "$stop suspends the run without ending it (§20.2).",
  };
  return `${endingHeadline(run.result)}. ${reason[run.result.outcome.kind]}`;
}

/**
 * Feedback for a wrong "it never ends: something is always booked". A
 * zero-delay loop also never ends, but with time stuck, so it gets its own
 * account, built from the run: the stuck time and the wake-ups never reached.
 */
function horizonWrong(run: LoopRun): string {
  const o = run.result.outcome;
  if (o.kind === "zero-delay-loop") {
    const booked = bookedAtEnd(run.result);
    const missed = booked.length
      ? `so ${booked.length === 1 ? "the" : "each"} booked wake-up (${listBooked(booked)}) is never reached`
      : "so no later time is ever reached";
    return `This run never ends either, but not because something is always booked. Time is stuck at ${o.time} ns, ${missed} (${zeroDelayClauses(run.result)}).`;
  }
  return "A run keeps going with time advancing only while a process keeps booking delays and nothing ends it ($finish, or $fatal through its implicit $finish) (§4.5, §20.2, §20.10).";
}

/** Choices for "how does the run end?". */
export function loopEndOptions(run: LoopRun): GradedOption[] {
  const kind = run.result.outcome.kind;
  const explain = loopEndExplanation(run);
  const options: { id: SimOutcome["kind"]; label: string; wrong: string }[] = [
    { id: "finish", label: "A $finish ends it", wrong: "Only a process that reaches $finish (or $fatal) ends the run that way (§20.2)." },
    {
      id: "quiet",
      label: "It ends by itself: nothing is left booked",
      wrong: "The run ends by itself only when no time slot is nonempty (§9.6.1, §4.5).",
    },
    {
      id: "horizon",
      label: "It never ends: something is always booked",
      wrong: horizonWrong(run),
    },
    {
      id: "zero-delay-loop",
      label: "Time stops: a loop never lets the slot empty",
      wrong: "Time stops when a process keeps running without reaching a timing control, so the time slot never empties (§4.5). Nothing in this program does that.",
    },
  ];
  return options.map((o) => ({ id: o.id, label: o.label, correct: o.id === kind, feedback: o.id === kind ? explain : o.wrong }));
}
