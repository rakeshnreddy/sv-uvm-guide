/**
 * Event memory matrix: how long each construct remembers a notification.
 *
 * One process, reset_gen, notifies at a fixed 20 ns. A waiter starts waiting
 * at 0 ns, at 20 ns (the same time step) or at 50 ns, with one of four wait
 * forms. Every cell is a scenario for the sv-process-model engine (which this
 * file does not change); each cell's verdict comes from running every order of
 * the ready processes, never from a table typed by hand.
 *
 * Rules (IEEE 1800-2023, checked against the standard's text):
 * - §15.5.1: a trigger made with -> unblocks all processes currently waiting
 *   on the event; the trigger behaves like a one shot.
 * - §15.5.2: for a trigger to unblock a process waiting with @, the waiter
 *   must execute the @ statement before the trigger executes; if the trigger
 *   executes first, the waiter remains blocked.
 * - §15.5.3: the triggered state persists throughout the time step, until
 *   simulation time advances; wait (ev.triggered) is unblocked whether the
 *   wait executes before or at the same simulation time as the trigger.
 * - §9.4.3: wait (expression) is level-sensitive: if the condition is already
 *   true the following statement runs at once; otherwise it stays blocked
 *   until the condition becomes true.
 * - §15.3.1: new(keyCount) sets the initial keys (default 0) and the bucket
 *   can hold more keys than that. §15.3.2: put() returns keys to the bucket
 *   and a suspended get() runs once enough keys are back. §15.3.3: get()
 *   takes the keys at once when they are available and blocks otherwise.
 * - §4.7: events ready in the Active region may be processed in any order, so
 *   the 20 ns column (both processes wake at 20 ns) is run in every order of
 *   the ready processes. The engine runs each process until it blocks or ends;
 *   the §4.7 interleaving of a running process is not explored.
 * - §9.6.1: simulation terminates when there is no further activity, so a
 *   waiter that nothing will ever wake is still blocked when the run ends.
 *
 * Modelling limits (surfaced in the UI):
 * - "Blocks forever" means: in this scenario nothing notifies again, so the
 *   waiter never resumes. With a later trigger, @ and wait (ev.triggered)
 *   would pass at that later trigger.
 * - Times are in ns with no `timescale shown; the delays are exact.
 */

import {
  c,
  exploreProcessOrders,
  alignedOutcomeRuns,
  prepareScenario,
  v,
  type ProcessExploration,
  type ProcessScenario,
  type SimResult,
  type Stmt,
} from "./sv-process-model";

/* ------------------------------------------------------------------------- */
/* Axes.                                                                      */
/* ------------------------------------------------------------------------- */

/** The notification time: fixed for every cell. */
export const TRIGGER_TIME = 20;

export type WaitForm = "at-event" | "triggered" | "flag" | "semaphore";
export type WaiterStart = 0 | 20 | 50;

/** Row order of the matrix: the two event forms first, then the two that remember. */
export const WAIT_FORMS: readonly WaitForm[] = ["at-event", "triggered", "flag", "semaphore"];
/** Column order of the matrix. */
export const WAITER_STARTS: readonly WaiterStart[] = [0, 20, 50];

export interface WaitFormInfo {
  form: WaitForm;
  /** The wait as the waiter writes it. */
  waitCode: string;
  /** The notification reset_gen executes at TRIGGER_TIME. */
  notifyCode: string;
  /** How long the notification lasts, in words. */
  memory: string;
  /** Clauses for this form. */
  clauses: string;
}

export const WAIT_FORM_INFO: Readonly<Record<WaitForm, WaitFormInfo>> = {
  "at-event": {
    form: "at-event",
    waitCode: "@(ev)",
    notifyCode: "-> ev",
    memory: "No memory: the trigger reaches only processes already waiting",
    clauses: "§15.5.1, §15.5.2",
  },
  triggered: {
    form: "triggered",
    waitCode: "wait (ev.triggered)",
    notifyCode: "-> ev",
    memory: "ev.triggered stays true for the rest of the time step",
    clauses: "§15.5.3",
  },
  flag: {
    form: "flag",
    waitCode: "wait (flag)",
    notifyCode: "flag = 1",
    memory: "flag stays 1 until something clears it",
    clauses: "§9.4.3",
  },
  semaphore: {
    form: "semaphore",
    waitCode: "sem.get(1)",
    notifyCode: "sem.put(1)",
    memory: "The key stays in the bucket until a get() takes it",
    clauses: "§15.3.1, §15.3.2, §15.3.3",
  },
};

export const WAITER_START_LABELS: Readonly<Record<WaiterStart, string>> = {
  0: "Waiting since 0 ns",
  20: "Starts at 20 ns (same time step)",
  50: "Starts at 50 ns (late)",
};

/** Short column headings for the matrix at phone width. */
export const WAITER_START_SHORT: Readonly<Record<WaiterStart, string>> = {
  0: "From 0 ns",
  20: "At 20 ns",
  50: "At 50 ns",
};

/** The line the waiter prints once its wait completes. */
export const WAITER_PASSED_TEXT = "waiter passed";
export const notifyLogText = (form: WaitForm) => `reset_gen: ${WAIT_FORM_INFO[form].notifyCode}`;

/* ------------------------------------------------------------------------- */
/* Scenario builder.                                                          */
/* ------------------------------------------------------------------------- */

const display = (format: string): Stmt => ({ kind: "display", format, args: [] });

function waitStmt(form: WaitForm): Stmt {
  switch (form) {
    case "at-event":
      return { kind: "waitEvent", event: "ev" };
    case "triggered":
      return { kind: "waitTriggered", event: "ev" };
    case "flag":
      return { kind: "waitCond", cond: v("flag") };
    case "semaphore":
      return { kind: "semaphore", op: "get", semaphore: "sem", keys: 1 };
  }
}

function notifyStmt(form: WaitForm): Stmt {
  switch (form) {
    case "at-event":
    case "triggered":
      return { kind: "trigger", event: "ev" };
    case "flag":
      return { kind: "assign", target: "flag", expr: c(1) };
    case "semaphore":
      return { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 };
  }
}

const memoScenario = new Map<string, ProcessScenario>();

/**
 * The scenario for one cell: reset_gen notifies at 20 ns; the waiter starts
 * its wait at `waiterStart`. Memoised so prepareScenario's cache is reused.
 */
export function eventMemoryScenario(form: WaitForm, waiterStart: WaiterStart): ProcessScenario {
  const id = `event-memory:${form}:${waiterStart}`;
  const cached = memoScenario.get(id);
  if (cached) return cached;
  const wait = waitStmt(form);
  const waiterBody: Stmt[] = [
    waiterStart === 0 ? wait : { kind: "delay", amount: c(waiterStart), then: wait },
    display(WAITER_PASSED_TEXT),
  ];
  const scenario: ProcessScenario = {
    id,
    title: `${WAIT_FORM_INFO[form].waitCode}, waiter from ${waiterStart} ns`,
    vars: form === "flag" ? [{ name: "flag", type: "bit", comment: "0 until reset_gen sets it" }] : undefined,
    events: form === "at-event" || form === "triggered" ? ["ev"] : undefined,
    semaphores: form === "semaphore" ? [{ name: "sem", keys: 0 }] : undefined,
    processes: [
      {
        id: "reset_gen",
        label: "reset_gen",
        kind: "initial",
        body: [{ kind: "delay", amount: c(TRIGGER_TIME), then: notifyStmt(form) }, display(notifyLogText(form))],
      },
      { id: "waiter", label: "waiter", kind: "initial", body: waiterBody },
    ],
  };
  memoScenario.set(id, scenario);
  return scenario;
}

/** Source lines of a cell's scenario, as the engine renders them. */
export function eventMemorySource(form: WaitForm, waiterStart: WaiterStart) {
  return prepareScenario(eventMemoryScenario(form, waiterStart)).source;
}

/* ------------------------------------------------------------------------- */
/* Running a cell.                                                            */
/* ------------------------------------------------------------------------- */

export type CellVerdict = "passes" | "blocks" | "depends";

export const VERDICT_LABELS: Readonly<Record<CellVerdict, string>> = {
  passes: "Passes",
  blocks: "Blocks forever",
  depends: "Depends on order",
};

/** Non-colour cue for each verdict (shape). */
export const VERDICT_ICONS: Readonly<Record<CellVerdict, string>> = {
  passes: "✓",
  blocks: "✕",
  depends: "◐",
};

export interface CellRun {
  result: SimResult;
  /** How many of the orders run ended this way. */
  runCount: number;
  passed: boolean;
  /** Time the waiter printed WAITER_PASSED_TEXT, when it passed. */
  passTime?: number;
}

export interface CellOutcome {
  form: WaitForm;
  waiterStart: WaiterStart;
  verdict: CellVerdict;
  exploration: ProcessExploration;
  /** One run per outcome group, aligned so the cards differ only where the order decides. */
  runs: CellRun[];
}

export function waiterPassTime(result: SimResult): number | undefined {
  return result.log.find((l) => l.label === "waiter" && l.text === WAITER_PASSED_TEXT)?.time;
}

const memoOutcome = new Map<string, CellOutcome>();

/** Runs a cell in every order of the ready processes and grades it. */
export function runEventMemoryCell(form: WaitForm, waiterStart: WaiterStart): CellOutcome {
  const key = `${form}:${waiterStart}`;
  const cached = memoOutcome.get(key);
  if (cached) return cached;
  const scenario = eventMemoryScenario(form, waiterStart);
  const exploration = exploreProcessOrders(scenario, { signature: "timestamps" });
  if (exploration.capped) throw new Error(`Scenario ${scenario.id} was capped`);
  const aligned = alignedOutcomeRuns(scenario, exploration);
  const runs: CellRun[] = aligned.map((result, i) => {
    const passTime = waiterPassTime(result);
    return {
      result,
      runCount: exploration.outcomes[i].runs.length,
      passed: passTime !== undefined,
      passTime,
    };
  });
  const passing = runs.filter((r) => r.passed).length;
  const verdict: CellVerdict = passing === runs.length ? "passes" : passing === 0 ? "blocks" : "depends";
  const outcome: CellOutcome = { form, waiterStart, verdict, exploration, runs };
  memoOutcome.set(key, outcome);
  return outcome;
}

/** All twelve cells, row by row (WAIT_FORMS) and column by column (WAITER_STARTS). */
export function eventMemoryMatrix(): CellOutcome[][] {
  return WAIT_FORMS.map((form) => WAITER_STARTS.map((start) => runEventMemoryCell(form, start)));
}

/* ------------------------------------------------------------------------- */
/* Notification memory: how long the run shows the notification is held.      */
/* ------------------------------------------------------------------------- */

export interface MemorySpan {
  /** "instant": the trigger itself (no state @ can read); the others are read from the trace. */
  kind: "instant" | "time-step" | "level" | "banked";
  from: number;
  /** Last time the notification is still held; undefined while it is still held at the end of the run. */
  until?: number;
  text: string;
  /** Short label drawn on the memory lane, so spans that look alike on the ns axis still read apart. */
  label: string;
}

/**
 * Reads, from one run's trace, how long the notification stays visible to a
 * wait: ev.triggered while true (§15.5.3), flag while 1 (§9.4.3), keys while
 * the bucket holds any (§15.3). For @(ev) the trigger is instantaneous
 * (§15.5.3) and a one shot (§15.5.1): @ reads no state, so the span is the
 * trigger's own time.
 */
export function memorySpan(form: WaitForm, result: SimResult): MemorySpan {
  const endTime = result.endTime;
  if (form === "at-event") {
    return {
      kind: "instant",
      from: TRIGGER_TIME,
      until: TRIGGER_TIME,
      text: `The trigger at ${TRIGGER_TIME} ns lasts no time; @(ev) reads no stored state (§15.5.1, §15.5.3).`,
      label: "-> ev is an instant; @(ev) reads no stored state",
    };
  }
  const held = (step: SimResult["trace"][number]) =>
    form === "triggered" ? step.events.ev === true : form === "flag" ? step.vars.flag === 1 : (step.semaphores.sem?.keys ?? 0) > 0;
  const times = result.trace.filter(held).map((s) => s.time);
  const from = times.length ? Math.min(...times) : TRIGGER_TIME;
  const last = times.length ? Math.max(...times) : TRIGGER_TIME;
  const lastStep = result.trace[result.trace.length - 1];
  const stillHeld = lastStep ? held(lastStep) : false;
  if (form === "triggered") {
    return {
      kind: "time-step",
      from,
      until: last,
      text: `ev.triggered is true from the trigger until time advances past ${last} ns (§15.5.3).`,
      label: `ev.triggered true for the rest of the ${last} ns time step`,
    };
  }
  if (form === "flag") {
    return stillHeld
      ? {
          kind: "level",
          from,
          text:
            endTime === from
              ? `flag becomes 1 at ${from} ns and stays 1; nothing clears it (§9.4.3).`
              : `flag is 1 from ${from} ns on, and nothing clears it before the run ends at ${endTime} ns (§9.4.3).`,
          label: `flag = 1 from ${from} ns to the end of the run`,
        }
      : { kind: "level", from, until: last, text: `flag is 1 from ${from} ns to ${last} ns (§9.4.3).`, label: `flag = 1, ${from} to ${last} ns` };
  }
  if (!times.length) {
    return {
      kind: "banked",
      from: TRIGGER_TIME,
      until: TRIGGER_TIME,
      text: `The key put at ${TRIGGER_TIME} ns goes straight to the blocked get(); the bucket never holds it (§15.3.2).`,
      label: "key handed straight to the get()",
    };
  }
  if (stillHeld) {
    return {
      kind: "banked",
      from,
      text: `The bucket holds 1 key from ${from} ns on, and no get() takes it before the run ends at ${endTime} ns (§15.3.1).`,
      label: `1 key from ${from} ns to the end of the run`,
    };
  }
  return {
    kind: "banked",
    from,
    until: last,
    // Same time step: the bucket held the key, so in this run put(1) ran before get(1). In the other
    // order the key goes straight to the suspended get() (§15.3.2); both orders end the same way.
    text:
      from === last
        ? `In the order shown, put(1) runs first: the bucket holds 1 key at ${from} ns until the get() in the same time step takes it (§15.3.1, §15.3.3).`
        : `The bucket holds 1 key from ${from} ns until the get() at ${last} ns takes it (§15.3.1, §15.3.3).`,
    label: from === last ? `1 key, taken in the ${last} ns time step` : `1 key, ${from} to ${last} ns`,
  };
}

/**
 * What happened inside one time step, in the order this run took: the steps
 * the processes executed at `time` (a process wakes, blocks, passes a wait,
 * notifies), read from the trace. Print and finish steps are left out; the
 * log shows the prints. §4.7 leaves this order open, so another run may differ.
 */
export function timeStepOrder(result: SimResult, time: number = TRIGGER_TIME): string[] {
  return result.trace
    .filter((s) => s.time === time && s.pid !== undefined && (s.kind === "exec" || s.kind === "block" || s.kind === "wake") && !/ finishes\.$/.test(s.what))
    .map((s) => s.what);
}

/* ------------------------------------------------------------------------- */
/* Timeline: what the lanes draw for one run.                                  */
/* ------------------------------------------------------------------------- */

export interface CellTimeline {
  /** Right end of the time axis (ns). */
  axisEnd: number;
  /** Tick times, ascending, without repeats. */
  ticks: number[];
  /** When reset_gen's notification ran (read from its log line). */
  notifyTime?: number;
  waiterStart: WaiterStart;
  /** When the waiter printed WAITER_PASSED_TEXT. */
  passTime?: number;
  endTime: number;
  /** The waiter is still blocked when the run ends. */
  stillBlocked: boolean;
  memory: MemorySpan;
}

/** Lane data for one run of a cell, every time read from the run. */
export function cellTimeline(cell: CellOutcome, run: CellRun): CellTimeline {
  const { result } = run;
  const notifyTime = result.log.find((l) => l.label === "reset_gen" && l.text === notifyLogText(cell.form))?.time;
  const endTime = result.endTime;
  const axisEnd = Math.max(endTime, ...WAITER_STARTS) + 10;
  const ticks = [...new Set([0, TRIGGER_TIME, cell.waiterStart, endTime])].sort((a, b) => a - b);
  return {
    axisEnd,
    ticks,
    notifyTime,
    waiterStart: cell.waiterStart,
    passTime: run.passTime,
    endTime,
    stillBlocked: result.blockedAtEnd.some((b) => b.label === "waiter"),
    memory: memorySpan(cell.form, result),
  };
}

/* ------------------------------------------------------------------------- */
/* Explanations: every sentence the component shows about a cell.             */
/* ------------------------------------------------------------------------- */

/** Why this cell has the verdict it has, generated from the cell's runs. */
export function cellExplanation(cell: CellOutcome): string {
  const { form, waiterStart, verdict } = cell;
  const passTimes = [...new Set(cell.runs.filter((r) => r.passed).map((r) => r.passTime as number))];
  const at = passTimes.length ? `${passTimes.join(" or ")} ns` : "";
  const early = waiterStart < TRIGGER_TIME;
  const same = waiterStart === TRIGGER_TIME;
  switch (form) {
    case "at-event":
      if (verdict === "depends") {
        return `Both processes wake at ${TRIGGER_TIME} ns and either may run first (§4.7). If the waiter reaches @(ev) first, -> ev wakes it (§15.5.1); if -> ev runs first, the waiter arrives after the trigger and stays blocked (§15.5.2).`;
      }
      if (verdict === "passes") {
        return `The waiter is already blocked on @(ev) when -> ev runs at ${TRIGGER_TIME} ns, so the trigger wakes it and it passes at ${at} (§15.5.1, §15.5.2).`;
      }
      return `The waiter reaches @(ev) at ${waiterStart} ns, after the only trigger at ${TRIGGER_TIME} ns. @ waits for the next trigger and none comes, so it never resumes (§15.5.2).`;
    case "triggered":
      if (verdict === "passes" && early) {
        return `The waiter blocks on wait (ev.triggered) because ev has not been triggered yet; the trigger at ${TRIGGER_TIME} ns makes it true and the waiter passes at ${at} (§15.5.3).`;
      }
      if (verdict === "passes" && same) {
        return `In every order the waiter passes at ${at}: if it waits first, the trigger unblocks it; if the trigger runs first, ev.triggered is still true for the rest of the ${TRIGGER_TIME} ns time step (§15.5.3).`;
      }
      if (verdict === "blocks") {
        return `ev.triggered was true only during the ${TRIGGER_TIME} ns time step and cleared when time advanced. At ${waiterStart} ns it is false and nothing triggers ev again, so the waiter never resumes (§15.5.3).`;
      }
      break;
    case "flag":
      if (verdict === "passes" && early) {
        return `flag is 0, so wait (flag) blocks; flag = 1 at ${TRIGGER_TIME} ns makes the condition true and the waiter passes at ${at} (§9.4.3).`;
      }
      if (verdict === "passes" && !same) {
        return `flag was set to 1 at ${TRIGGER_TIME} ns and is still 1 at ${waiterStart} ns, so wait (flag) passes at once, at ${at}: wait is level-sensitive (§9.4.3).`;
      }
      if (verdict === "passes") {
        return `wait is level-sensitive: whenever the waiter arrives after flag = 1 it passes at once, and if it arrives first, the change to 1 wakes it. It passes at ${at} in every order (§9.4.3).`;
      }
      break;
    case "semaphore":
      if (verdict === "passes" && early) {
        return `sem was made with new(0), so get(1) blocks; put(1) at ${TRIGGER_TIME} ns returns a key and the suspended get takes it, so the waiter passes at ${at} (§15.3.2, §15.3.3).`;
      }
      if (verdict === "passes" && !same) {
        return `put(1) at ${TRIGGER_TIME} ns left a key in the bucket (§15.3.1, §15.3.2). It is still there at ${waiterStart} ns, so get(1) takes it at once and the waiter passes at ${at} (§15.3.3).`;
      }
      if (verdict === "passes") {
        return `put(1) at ${TRIGGER_TIME} ns leaves a key in the bucket until a get takes it (§15.3.1, §15.3.2). Whenever get(1) runs after the put it takes the key at once, and a get that came first is woken by the put. The waiter passes at ${at} in every order (§15.3.3).`;
      }
      break;
  }
  return `Unexpected result for ${WAIT_FORM_INFO[form].waitCode} from ${waiterStart} ns: ${VERDICT_LABELS[verdict]}.`;
}

/** Feedback for each prediction: right or wrong, it names what the run shows. */
export function predictionFeedback(cell: CellOutcome, choice: CellVerdict): string {
  if (choice === cell.verdict) return cellExplanation(cell);
  const code = WAIT_FORM_INFO[cell.form].waitCode;
  if (cell.verdict === "depends") {
    return choice === "passes"
      ? `${code} passes only in the orders where the waiter blocks before -> ev runs. Both are ready at ${TRIGGER_TIME} ns and the standard leaves their order open (§4.7).`
      : `${code} stays blocked only when -> ev runs before the waiter reaches @. Both are ready at ${TRIGGER_TIME} ns and the standard leaves their order open (§4.7), so in the other order it passes.`;
  }
  if (choice === "depends") {
    return cell.verdict === "passes"
      ? `The order of the processes ready at the same time does not change this one: every order the model ran ends with the waiter through ${code}.`
      : `No order rescues this one: in every order the model ran the waiter is still blocked in ${code} when the run ends.`;
  }
  const info = WAIT_FORM_INFO[cell.form];
  if (choice === "passes") {
    if (cell.form === "triggered") {
      return `${code} cannot see a notification that is already over. ev.triggered was true only during the ${TRIGGER_TIME} ns time step; at ${cell.waiterStart} ns it is false (${info.clauses}).`;
    }
    return `${code} cannot see a notification that is already over. ${info.memory} (${info.clauses}).`;
  }
  if (cell.waiterStart < TRIGGER_TIME) {
    return `The waiter is already blocked in ${code} from ${cell.waiterStart} ns, so ${info.notifyCode} at ${TRIGGER_TIME} ns wakes it (${info.clauses}).`;
  }
  return `${code} does not need to be waiting when ${info.notifyCode} runs. ${info.memory} (${info.clauses}).`;
}

/** Title of one outcome group's card. */
export function runTitle(run: CellRun): string {
  return run.passed ? `Waiter passes at ${run.passTime} ns` : "Waiter stays blocked";
}

/** End state of one run for its outcome card. */
export function runEndState(run: CellRun): string {
  const blocked = run.result.blockedAtEnd;
  return blocked.length ? blocked.map((b) => `${b.label} blocked in ${b.on}`).join("; ") : `nobody blocked, run ends at ${run.result.endTime} ns`;
}

/* ------------------------------------------------------------------------- */
/* The takeaway, from the completed matrix.                                   */
/* ------------------------------------------------------------------------- */

/** Wait forms that do not pass in every order for a waiter that starts at 50 ns. */
export function lateArrivalFailures(matrix: CellOutcome[][] = eventMemoryMatrix()): WaitForm[] {
  return matrix.flat().filter((cell) => cell.waiterStart === 50 && cell.verdict !== "passes").map((cell) => cell.form);
}

/** Cells that depend on the order of processes ready at the same time. */
export function orderDependentCells(matrix: CellOutcome[][] = eventMemoryMatrix()): CellOutcome[] {
  return matrix.flat().filter((cell) => cell.verdict === "depends");
}

export function matrixTakeaway(matrix: CellOutcome[][] = eventMemoryMatrix()): string {
  const failing = lateArrivalFailures(matrix).map((f) => WAIT_FORM_INFO[f].waitCode);
  const remembering = WAIT_FORMS.filter((f) => !lateArrivalFailures(matrix).includes(f)).map((f) => WAIT_FORM_INFO[f].waitCode);
  const depends = orderDependentCells(matrix).map((cell) => `${WAIT_FORM_INFO[cell.form].waitCode} at ${cell.waiterStart} ns`);
  const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
  return [
    `Only the event forms, ${list(failing)}, fail a waiter that arrives after the time step of the trigger; ${list(remembering)} keep the notification and pass.`,
    depends.length === 1
      ? `The only cell that depends on order is ${list(depends)}: the race that wait (ev.triggered) removes (§15.5.3).`
      : depends.length > 1
        ? `The cells that depend on order are ${list(depends)}.`
        : "",
    "When a late arrival must pass, keep the fact in a level or a banked key, not an event.",
  ]
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------------------------- */
/* A path through the matrix: which cell to try next.                         */
/* ------------------------------------------------------------------------- */

/** Key of one cell, as the component stores it. */
export const eventMemoryCellKey = (form: WaitForm, waiterStart: WaiterStart) => `${form}:${waiterStart}`;

/**
 * The suggested order of cells, most instructive first: the same-time-step
 * column for the two event forms (where order inside the time step matters),
 * then the late column, then the rest. A fixed teaching order; it names cells
 * by their setup only, so it never gives an answer away.
 */
export const SUGGESTED_CELL_ORDER: readonly { form: WaitForm; waiterStart: WaiterStart }[] = [
  { form: "at-event", waiterStart: 20 },
  { form: "triggered", waiterStart: 20 },
  { form: "at-event", waiterStart: 50 },
  { form: "triggered", waiterStart: 50 },
  { form: "flag", waiterStart: 50 },
  { form: "semaphore", waiterStart: 50 },
  { form: "flag", waiterStart: 20 },
  { form: "semaphore", waiterStart: 20 },
  { form: "at-event", waiterStart: 0 },
  { form: "triggered", waiterStart: 0 },
  { form: "flag", waiterStart: 0 },
  { form: "semaphore", waiterStart: 0 },
];

export interface CellSuggestion {
  form: WaitForm;
  waiterStart: WaiterStart;
  /** "wait (flag), starts at 50 ns (late)". */
  label: string;
  /** Why to try it, from the cell's setup only (no verdict). */
  hint: string;
}

/** What the waiter faces in a column, from the times alone. */
export function columnHint(waiterStart: WaiterStart): string {
  if (waiterStart < TRIGGER_TIME) return `the waiter is already waiting when the notification runs at ${TRIGGER_TIME} ns`;
  if (waiterStart === TRIGGER_TIME) return `the waiter and the notification are ready in the same ${TRIGGER_TIME} ns time step`;
  return `the waiter arrives ${waiterStart - TRIGGER_TIME} ns after the only notification`;
}

/** The first cell in SUGGESTED_CELL_ORDER not yet revealed, or undefined when every cell is. */
export function nextSuggestedCell(revealedKeys: Iterable<string>): CellSuggestion | undefined {
  const done = new Set(revealedKeys);
  const next = SUGGESTED_CELL_ORDER.find((c) => !done.has(eventMemoryCellKey(c.form, c.waiterStart)));
  if (!next) return undefined;
  return {
    ...next,
    label: `${WAIT_FORM_INFO[next.form].waitCode}, ${WAITER_START_LABELS[next.waiterStart].toLowerCase()}`,
    hint: columnHint(next.waiterStart),
  };
}

/* ------------------------------------------------------------------------- */
/* Presets.                                                                   */
/* ------------------------------------------------------------------------- */

export type EventMemoryPreset = "late-arrival" | "named-event-mistakes";

export interface EventMemoryPresetInfo {
  id: EventMemoryPreset;
  /** The cell opened first. */
  form: WaitForm;
  waiterStart: WaiterStart;
  /** Lesson section the preset is for. */
  section: string;
  intro: string;
}

export const EVENT_MEMORY_PRESETS: Readonly<Record<EventMemoryPreset, EventMemoryPresetInfo>> = {
  "late-arrival": {
    id: "late-arrival",
    form: "flag",
    waiterStart: 50,
    section: "Push Further > Expert: When a signal must last, use a level, not an event",
    intro: "The waiter arrives at 50 ns, 30 ns after the only notification. Which forms still let it through?",
  },
  "named-event-mistakes": {
    id: "named-event-mistakes",
    form: "at-event",
    waiterStart: 20,
    section: "Build Your Mental Model > Named events: announce that something happened",
    intro: "Start with @(ev): the waiter and -> ev are both ready at 20 ns. Then try the other columns and rows.",
  },
};

export const EVENT_MEMORY_ASSUMPTIONS: readonly string[] = [
  "Every verdict, log line and lane comes from the process model running the cell's code (IEEE 1800-2023 §15.5.1 to §15.5.3 events, §9.4.3 wait, §15.3.1 to §15.3.3 semaphores; delays in ns).",
  "Processes ready at the same time may run in any order (§4.7). Each cell is run in every order of the ready processes, each process until it blocks or ends; §4.7 interleaving is not explored.",
  "“Blocks forever” means nothing in this code notifies again: simulation terminates when there is no further activity (§9.6.1), with the waiter still blocked. A later notification would still wake it.",
  "IEEE 1800-2023 does not require a simulator to report processes still blocked at the end; what tools print is tool-dependent.",
];
