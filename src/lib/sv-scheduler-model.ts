/**
 * Deterministic educational model of one SystemVerilog time slot.
 *
 * The model follows the region iteration of the IEEE 1800 reference
 * scheduling algorithm (Clause 4): the active region set (Active, Inactive,
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
 *   standard's guarantee for nonblocking assignments.
 * - Clocking-block inputs use the default #1step input skew (value sampled
 *   before anything changes in the slot) and outputs use #0 output skew
 *   (drive scheduled in Re-NBA).
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

export type Expr =
  | { kind: "const"; value: SvValue }
  | { kind: "var"; name: string }
  /** Clocking-block input: the value sampled in Preponed (#1step skew). */
  | { kind: "sampled"; name: string; clocking: string };

export type Statement =
  | { kind: "assign"; id: string; op: "blocking" | "nba"; target: string; expr: Expr }
  /** Clocking-block synchronous drive (`cb.sig <= expr`). Updates in Re-NBA. */
  | { kind: "cbDrive"; id: string; clocking: string; target: string; expr: Expr }
  | { kind: "delay0"; id: string }
  | { kind: "display"; id: string; signals: string[] }
  | { kind: "strobe"; id: string; signals: string[] };

export type ProcessTrigger =
  | { kind: "posedge"; signal: string }
  | { kind: "change"; signals: string[] }
  /** `@(cb)`: the clocking block event, triggered in Observed (§14.10). */
  | { kind: "clocking"; clocking: string };

export interface ClockingBlock {
  name: string;
  /** Signal whose rising edge is the clocking event. */
  clock: string;
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
}

export type SchedulerEvent =
  | { kind: "update"; target: string; value: SvValue; from: string; stmtId?: string; reason: string }
  | { kind: "evaluate"; processId: string; pc: number; reason: string }
  | { kind: "print"; text: string; stmtId: string; processId: string }
  | { kind: "clockingEvent"; clocking: string };

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

const MAX_STEPS = 400;
const MAX_RUNS = 256;

export function formatValue(value: SvValue | undefined): string {
  if (value === undefined || value === "X") return "X";
  return String(value);
}

export function exprToSource(expr: Expr): string {
  switch (expr.kind) {
    case "const":
      return formatValue(expr.value);
    case "var":
      return expr.name;
    case "sampled":
      return `${expr.clocking}.${expr.name}`;
  }
}

export function statementToSource(stmt: Statement): string {
  switch (stmt.kind) {
    case "assign":
      return `${stmt.target} ${stmt.op === "blocking" ? "=" : "<="} ${exprToSource(stmt.expr)};`;
    case "cbDrive":
      return `${stmt.clocking}.${stmt.target} <= ${exprToSource(stmt.expr)};`;
    case "delay0":
      return "#0;";
    case "display":
      return `$display("${stmt.signals.map((s) => `${s}=%0d`).join(" ")}", ${stmt.signals.join(", ")});`;
    case "strobe":
      return `$strobe("${stmt.signals.map((s) => `${s}=%0d`).join(" ")}", ${stmt.signals.join(", ")});`;
  }
}

export interface SourceLine {
  text: string;
  processId?: string;
  stmtId?: string;
}

/** Renders scenario processes as SystemVerilog-style source, one entry per line. */
export function scenarioToSource(scenario: SvScenario): SourceLine[] {
  const lines: SourceLine[] = [];
  scenario.processes.forEach((process, index) => {
    if (index > 0) lines.push({ text: "" });
    if (process.body.length === 1) {
      lines.push({ text: `${process.header} ${statementToSource(process.body[0])}`, processId: process.id, stmtId: process.body[0].id });
      return;
    }
    lines.push({ text: `${process.header} begin`, processId: process.id });
    process.body.forEach((stmt) => {
      lines.push({ text: `  ${statementToSource(stmt)}`, processId: process.id, stmtId: stmt.id });
    });
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
  }
}

function evaluateExpr(expr: Expr, values: Record<string, SvValue>, sampled: Record<string, SvValue>): SvValue {
  switch (expr.kind) {
    case "const":
      return expr.value;
    case "var":
      return values[expr.name] ?? "X";
    case "sampled":
      return sampled[expr.name] ?? "X";
  }
}

function formatSignals(signals: string[], values: Record<string, SvValue>): string {
  return signals.map((s) => `${s}=${formatValue(values[s])}`).join(" ");
}

/**
 * Runs one time slot. `choices[i]` selects which ready process runs at the
 * i-th choice point (index into the ready list in declaration order). Missing
 * entries default to 0.
 */
export function simulateTimeSlot(scenario: SvScenario, choices: number[] = []): SimulationResult {
  const processes = new Map(scenario.processes.map((p) => [p.id, p]));
  const declarationIndex = new Map(scenario.processes.map((p, i) => [p.id, i]));
  const queues = emptyQueues();
  const values: Record<string, SvValue> = { ...scenario.initial };
  const sampled: Record<string, SvValue> = { ...scenario.initial };
  const log: string[] = [];
  const trace: TraceStep[] = [];
  const usedChoices: number[] = [];
  const choiceWidths: number[] = [];
  const executionOrder: string[] = [];
  /** Processes currently waiting on their trigger (not running or scheduled). */
  const waiting = new Set(scenario.processes.map((p) => p.id));
  let delta = 0;
  let currentRegion: RegionId = "preponed";
  const origin = new WeakMap<SchedulerEvent, RegionId>();
  let currentSource: RegionId | undefined;

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
        (t.kind === "posedge" && t.signal === signal && oldValue === 0 && newValue === 1) ||
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

  const applyUpdate = (event: Extract<SchedulerEvent, { kind: "update" }>, region: RegionId) => {
    const oldValue = values[event.target] ?? "X";
    values[event.target] = event.value;
    const changed = oldValue !== event.value;
    const woken = changed ? wakeSensitive(event.target, oldValue, event.value) : [];
    const clockingEvents =
      changed && oldValue === 0 && event.value === 1
        ? (scenario.clockings ?? []).filter((cb) => cb.clock === event.target)
        : [];
    clockingEvents.forEach((cb) => queues.observed.push({ kind: "clockingEvent", clocking: cb.name }));
    if (clockingEvents.length) {
      woken.push(...clockingEvents.map((cb) => `the @(${cb.name}) clocking event (scheduled in Observed)`));
    }
    push({
      kind: "update",
      region,
      stmtId: event.stmtId,
      processId: event.from,
      what: `${event.target} updates ${formatValue(oldValue)} → ${formatValue(event.value)}.`,
      why: changed
        ? `${event.reason}${woken.length ? ` The change wakes ${woken.join(", ")}.` : ""}`
        : `${event.reason} The value is unchanged, so no process wakes.`,
      changed: changed ? [event.target] : [],
    });
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
    for (let pc = event.pc; pc < process.body.length; pc += 1) {
      const stmt = process.body[pc];
      switch (stmt.kind) {
        case "assign": {
          const value = evaluateExpr(stmt.expr, values, sampled);
          if (stmt.op === "blocking") {
            const oldValue = values[stmt.target] ?? "X";
            values[stmt.target] = value;
            const changed = oldValue !== value;
            const woken = changed ? wakeSensitive(stmt.target, oldValue, value) : [];
            push({
              kind: "statement",
              region,
              processId: process.id,
              stmtId: stmt.id,
              what: `${statementToSource(stmt)} reads ${exprToSource(stmt.expr)} = ${formatValue(value)} and writes ${stmt.target} immediately.`,
              why: `A blocking assignment updates its target before the next statement runs${woken.length ? `; the change wakes ${woken.join(", ")}` : ""}. Any process that reads ${stmt.target} later in this slot sees ${formatValue(value)}.`,
              changed: changed ? [stmt.target] : [],
            });
          } else {
            const target = process.context === "program" ? "reNba" : "nba";
            queues[target].push({
              kind: "update",
              target: stmt.target,
              value,
              from: process.id,
              stmtId: stmt.id,
              reason: `Scheduled by ${process.label}'s nonblocking assignment.`,
            });
            push({
              kind: "statement",
              region,
              processId: process.id,
              stmtId: stmt.id,
              what: `${statementToSource(stmt)} reads ${exprToSource(stmt.expr)} = ${formatValue(value)} now, but defers the write.`,
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
            why: "A synchronous drive through a clocking block is applied after all design NBA updates of this slot, so design logic triggered by this edge has already captured the old value.",
          });
          break;
        }
        case "delay0": {
          const target = process.context === "program" ? "reInactive" : "inactive";
          queues[target].push({ kind: "evaluate", processId: process.id, pc: pc + 1, reason: "#0 delay expired." });
          push({
            kind: "suspend",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `${process.label} suspends on #0.`,
            why: `#0 moves the rest of the process to ${REGION_LABELS[target]}. It runs only after the current ${REGION_LABELS[region]} events are exhausted — it postpones the race rather than removing it.`,
          });
          return;
        }
        case "display": {
          const text = `$display: ${formatSignals(stmt.signals, values)}`;
          log.push(text);
          push({
            kind: "print",
            region,
            processId: process.id,
            stmtId: stmt.id,
            what: `Prints ${formatSignals(stmt.signals, values)} immediately.`,
            why: "$display prints the values visible at this instant — pending NBA updates are not yet applied.",
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
      }
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
            : "It waits for its inputs to change again.",
    });
  };

  /** Picks the next event of a region. Ready processes at the head are a choice point. */
  const takeNext = (region: RegionId): SchedulerEvent => {
    const queue = queues[region];
    if (queue[0].kind !== "evaluate") return queue.shift() as SchedulerEvent;
    let runEnd = 0;
    while (runEnd < queue.length && queue[runEnd].kind === "evaluate") runEnd += 1;
    const ready = queue
      .slice(0, runEnd)
      .map((event, position) => ({ event: event as Extract<SchedulerEvent, { kind: "evaluate" }>, position }))
      .sort((a, b) => (declarationIndex.get(a.event.processId) ?? 0) - (declarationIndex.get(b.event.processId) ?? 0));
    if (ready.length === 1) return queue.shift() as SchedulerEvent;
    const choicePoint = usedChoices.length;
    const requested = choices[choicePoint] ?? 0;
    const pick = Math.min(Math.max(requested, 0), ready.length - 1);
    usedChoices.push(pick);
    choiceWidths.push(ready.length);
    const chosen = ready[pick];
    const labels = ready.map((r) => processes.get(r.event.processId)?.label ?? r.event.processId);
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
      case "clockingEvent": {
        const woken: string[] = [];
        for (const process of scenario.processes) {
          const t = process.trigger;
          if (t.kind !== "clocking" || t.clocking !== event.clocking || !waiting.has(process.id)) continue;
          waiting.delete(process.id);
          queues[regionFor(process)].push({ kind: "evaluate", processId: process.id, pc: 0, reason: `@(${event.clocking}) fired in Observed.` });
          woken.push(process.label);
        }
        push({
          kind: "wake",
          region,
          what: `Clocking block event @(${event.clocking}) triggers${woken.length ? ` and wakes ${woken.join(", ")}` : ""}.`,
          why: "A clocking block event is triggered in the Observed region (§14.10), after the design's NBA updates for this edge. Processes waiting on it run in the next Active pass.",
        });
        break;
      }
      case "print": {
        const process = processes.get(event.processId);
        const stmt = process?.body.find((s) => s.id === event.stmtId);
        const signals = stmt && stmt.kind === "strobe" ? stmt.signals : [];
        const text = `$strobe: ${formatSignals(signals, values)}`;
        log.push(text);
        push({
          kind: "print",
          region,
          processId: event.processId,
          stmtId: event.stmtId,
          what: `Prints ${formatSignals(signals, values)}.`,
          why: "Postponed is read-only: these are the final settled values of the time slot.",
        });
        break;
      }
    }
  };

  const drainSet = (set: RegionId[], home: RegionId) => {
    const anyNonEmpty = () => set.some((r) => queues[r].length > 0);
    while (anyNonEmpty()) {
      currentRegion = home;
      while (queues[home].length > 0) {
        executeEvent(takeNext(home), home);
      }
      currentSource = undefined;
      const next = set.find((r) => queues[r].length > 0);
      if (next && next !== home) {
        const moved = queues[next].map((e) => describeEvent(e, processes).label);
        delta += 1;
        currentRegion = next;
        push({
          kind: "move",
          region: next,
          what: `${REGION_LABELS[home]} is empty. ${moved.length} ${REGION_LABELS[next]} event${moved.length === 1 ? "" : "s"} move to ${REGION_LABELS[home]}: ${moved.join(", ")}.`,
          why: `The scheduler only advances to ${REGION_LABELS[next]} once every earlier region of the set is empty. Moving events back is one more delta iteration of the same simulation time.`,
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
    why: "Preponed samples every value before anything in this slot changes. Clocking-block inputs (#1step) and concurrent assertions read these samples; procedural code does not.",
  });

  // The clock generator's blocking update is the triggering event.
  queues.active.push({
    kind: "update",
    target: scenario.clock,
    value: 1,
    from: "clock",
    reason: `The clock generator drives ${scenario.clock} high.`,
  });
  currentRegion = "active";

  const reactiveHasWork = () => REACTIVE_SET.some((r) => queues[r].length > 0);
  const activeHasWork = () => ACTIVE_SET.some((r) => queues[r].length > 0);
  let guard = 0;
  while (activeHasWork() || reactiveHasWork()) {
    guard += 1;
    if (guard > 50) throw new Error(`Scenario ${scenario.id} did not settle`);
    drainSet(ACTIVE_SET, "active");
    if (reactiveHasWork()) {
      currentRegion = "reactive";
      drainSet(REACTIVE_SET, "reactive");
    }
  }

  currentRegion = "postponed";
  while (queues.postponed.length > 0) {
    executeEvent(queues.postponed.shift() as SchedulerEvent, "postponed");
  }
  push({
    kind: "slot-end",
    what: `Time slot settles. ${formatSignals(scenario.watch, values)}.`,
    why: "Simulation time can now advance. These are the values the next clock edge will see.",
  });

  return {
    scenarioId: scenario.id,
    choices: usedChoices,
    choiceWidths,
    trace,
    finalValues: { ...values },
    log: [...log],
    executionOrder,
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

export interface RaceHazard {
  variable: string;
  writer: { processId: string; stmtId: string };
  reader: { processId: string; stmtId: string };
  explanation: string;
}

function readsOf(stmt: Statement): string[] {
  if (stmt.kind === "assign" || stmt.kind === "cbDrive") {
    return stmt.expr.kind === "var" ? [stmt.expr.name] : [];
  }
  if (stmt.kind === "display") return stmt.signals;
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
  }
}

/**
 * Static check for the classic write/read race: a variable written with a
 * blocking assignment by one process and read by another process that wakes
 * on the same event in the same region set, before any #0 separates them.
 */
export function findRaceHazards(scenario: SvScenario): RaceHazard[] {
  const hazards: RaceHazard[] = [];
  const firstSegment = (p: SvProcess) => {
    const delayAt = p.body.findIndex((s) => s.kind === "delay0");
    return { stmts: delayAt === -1 ? p.body : p.body.slice(0, delayAt), delayed: delayAt === 0 };
  };
  for (const writer of scenario.processes) {
    for (const reader of scenario.processes) {
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
