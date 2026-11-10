/**
 * IPC smell clinic: scenarios and pure analysis for the five ways
 * interprocess communication fails without printing an error. Everything runs
 * on the sv-process-model engine (which this file does not change), so every
 * log, end time and blocked call the component shows is a model result.
 *
 * Rules (IEEE 1800-2023, verified against the standard's text):
 * - §15.5.1: a trigger made with -> unblocks only the processes currently
 *   waiting on the event. §15.5.2: for @ to see a trigger, the @ statement
 *   must execute before the trigger; otherwise the waiter stays blocked.
 * - §15.5.3: the triggered state persists until simulation time advances, so
 *   a loop around `wait (ev.triggered)` with no delay never lets time advance.
 * - §15.3.2: put() returns keys to the bucket. §15.3.3: get() blocks until the
 *   keys are available; the waiting queue is FIFO. §15.3 defines no owner for a
 *   key (put() takes only a count), so "held by" edges are model bookkeeping.
 * - §15.4.5: get() blocks while the mailbox is empty.
 * - §4.7: processes ready at the same time may run in any order, so a run is
 *   explored across every order of the ready processes (each process runs
 *   until it blocks; §4.7 interleaving is not explored by the engine).
 * - §9.6.1: simulation terminates by itself when there is no further activity,
 *   so a run whose live processes are all blocked ends quietly; the standard
 *   reports no blocked process (what a tool prints is tool-dependent).
 *
 * Modelling limits (surfaced in the UI):
 * - The engine stops a zero-delay loop after the scenario's statement budget;
 *   a simulator keeps executing that time step (or applies its own iteration
 *   limit, tool-dependent).
 * - The engine has no localparam, so the shared count N appears as its value 3
 *   with a comment, and mon sends `$time` (10, 20, 30) where the lesson sends
 *   `i * 10` (the same values).
 * - Classifying a run into one of the five shapes uses only what the run
 *   shows (time stopped, blocked calls, the wait-for graph). It names the five
 *   lesson shapes; other causes can produce the same evidence.
 */

import { listCycles } from "./axi-deadlock-model";
import {
  bin,
  c,
  eventRaceScenario,
  exploreProcessOrders,
  isAlwaysFamily,
  keyLeakScenario,
  now,
  simulateProcesses,
  v,
  type ProcessExploration,
  type ProcessScenario,
  type SimResult,
  type Stmt,
  type TraceStep,
} from "./sv-process-model";

/* ------------------------------------------------------------------------- */
/* The five shapes.                                                           */
/* ------------------------------------------------------------------------- */

export type SmellId = "missed-trigger" | "spin-triggered" | "leaked-key" | "circular-wait" | "starved-consumer";

/** Lesson order. */
export const SMELL_IDS: readonly SmellId[] = ["missed-trigger", "spin-triggered", "leaked-key", "circular-wait", "starved-consumer"];

export interface SmellInfo {
  id: SmellId;
  name: string;
  /** Governing clause(s) of IEEE 1800-2023. */
  clause: string;
  /** The rule, paraphrased, with its clause. */
  rule: string;
  /** What the evidence of this shape looks like, as the classifier tests it. */
  signature: string;
  fix: string;
  /** Three progressive hints, weakest first. None names the shape. */
  hints: [string, string, string];
}

export const SMELLS: Readonly<Record<SmellId, SmellInfo>> = {
  "missed-trigger": {
    id: "missed-trigger",
    name: "Missed trigger",
    clause: "IEEE 1800-2023 §15.5.1, §15.5.2",
    rule: "-> unblocks only processes already waiting on the event (§15.5.1). If the trigger executes before the @ statement, the waiter stays blocked (§15.5.2). Which runs first at one time is the scheduler's choice (§4.7).",
    signature: "a process left blocked in @(event)",
    fix: "Start waiting before the trigger can happen, or, when both can land in one time slot, wait on the persistent state: wait (ev.triggered) (§15.5.3).",
    hints: [
      "Did simulation time keep advancing to the end of the run?",
      "Look at the call the blocked process is stuck in: is it waiting for data, for a key, or for an event?",
      "In the same time slot, which ran first: the statement that waits on the event, or the one that fires it?",
    ],
  },
  "spin-triggered": {
    id: "spin-triggered",
    name: "Spinning on triggered",
    clause: "IEEE 1800-2023 §15.5.3",
    rule: "The triggered state persists until simulation time advances (§15.5.3). A loop that waits on it without a delay passes again and again, so time can never advance.",
    signature: "simulation time stopped advancing (a zero-delay loop)",
    fix: "Use @(ev) inside loops, and start waiting before the trigger: here an always procedure that waits in @(done) from t = 0.",
    hints: [
      "Did simulation time keep advancing to the end of the run?",
      "No process is blocked, yet the run did not end normally. What keeps a process running without time passing?",
      "Some state stays true for the rest of a time step; a loop that waits on it never blocks again.",
    ],
  },
  "leaked-key": {
    id: "leaked-key",
    name: "Leaked key",
    clause: "IEEE 1800-2023 §15.3.2, §15.3.3",
    rule: "put() is how keys return to the bucket (§15.3.2); get() blocks until enough keys are available (§15.3.3). A path out of the critical section that skips put() leaves the bucket short for good.",
    signature: "processes blocked in get() of one semaphore, with no cycle between two processes",
    fix: "Give the critical section one exit path that always calls put(): here, put(1) before the early return.",
    hints: [
      "Did the first transfers finish before everything stopped?",
      "Every blocked process waits in get() of the same semaphore. Who could still return a key?",
      "Follow every path out of the critical section: does each one reach put()?",
    ],
  },
  "circular-wait": {
    id: "circular-wait",
    name: "Circular wait (deadlock)",
    clause: "IEEE 1800-2023 §15.3.3",
    rule: "get() blocks until the keys are available (§15.3.3). When each process holds a key the other needs, neither can reach its put(), so neither get() can ever return.",
    signature: "two or more processes blocked in get() whose wait-for graph closes a cycle through different processes",
    fix: "Take keys in one global order everywhere (here: s1, then s2).",
    hints: [
      "How many semaphores are the blocked processes waiting on?",
      "Draw who waits for which semaphore, and who took each key last.",
      "If the arrows lead back to where they started, no put() can ever run.",
    ],
  },
  "starved-consumer": {
    id: "starved-consumer",
    name: "Starved consumer",
    clause: "IEEE 1800-2023 §15.4.5",
    rule: "get() blocks while the mailbox is empty (§15.4.5). A consumer that expects more messages than any producer sends waits for good after the last one.",
    signature: "a process left blocked in a mailbox get()",
    fix: "Share one count (or an end marker) between producer and consumer: here N = 3 on both sides.",
    hints: [
      "Count the messages the log shows arriving.",
      "Look at the call the blocked process is stuck in: is it waiting for data, for a key, or for an event?",
      "Compare how many messages are sent with how many the receiver asks for.",
    ],
  },
};

export const QUIET_END_RULE =
  "IEEE 1800-2023 §9.6.1: simulation terminates by itself when there is no further activity, so a run whose live processes are all blocked simply ends. Nothing in the standard reports the blocked processes; what a tool prints at the end is tool-dependent.";

/* ------------------------------------------------------------------------- */
/* Scenarios (new ones; the existing ones come from sv-process-model).        */
/* ------------------------------------------------------------------------- */

const display = (format: string, ...args: ReturnType<typeof v>[]): Stmt => ({ kind: "display", format, args });
const semGet = (id: string, sem: string, comment?: string): Stmt => ({ id, kind: "semaphore", op: "get", semaphore: sem, keys: 1, comment });
const semPut = (id: string, sem: string): Stmt => ({ id, kind: "semaphore", op: "put", semaphore: sem, keys: 1 });
const after = (amount: number, then: Stmt, id?: string): Stmt => ({ id, kind: "delay", amount: c(amount), then });

export type AcquireOrder = "opposite" | "same";
export type StartDelay = 0 | 10;

export interface CircularWaitConfig {
  /** proc_b's order: "opposite" = s2 then s1 (the lesson's bug), "same" = s1 then s2. */
  order: AcquireOrder;
  /** When proc_b starts, in ns. The model has no #0, so 0 means no delay at all. */
  startDelay: StartDelay;
}

export const DEFAULT_CIRCULAR: CircularWaitConfig = { order: "opposite", startDelay: 0 };

/** The lesson's circular wait: proc_a takes s1 then s2; proc_b takes them in `order`, starting at `startDelay`. */
export function circularWaitScenario(config: CircularWaitConfig = DEFAULT_CIRCULAR): ProcessScenario {
  const [first, second] = config.order === "opposite" ? ["s2", "s1"] : ["s1", "s2"];
  const bFirst = semGet("b-get-1", first);
  return {
    id: `circular-wait:${config.order}:${config.startDelay}`,
    title: "Two semaphores, two processes",
    semaphores: [
      { name: "s1", keys: 1 },
      { name: "s2", keys: 1 },
    ],
    processes: [
      {
        id: "proc_a",
        label: "proc_a",
        kind: "initial",
        body: [semGet("a-get-1", "s1"), after(5, semGet("a-get-2", "s2"), "a-wait"), display("proc_a: has s1 and s2"), semPut("a-put-2", "s2"), semPut("a-put-1", "s1")],
      },
      {
        id: "proc_b",
        label: "proc_b",
        kind: "initial",
        body: [
          config.startDelay > 0 ? after(config.startDelay, bFirst, "b-start") : bFirst,
          after(5, semGet("b-get-2", second), "b-wait"),
          display(`proc_b: has ${second} and ${first}`),
          semPut("b-put-2", second),
          semPut("b-put-1", first),
        ],
      },
    ],
  };
}

export type StarvedFix = "bug" | "shared-count";

/** A producer sends 3 messages; the consumer asks for 4 (bug) or for the shared count 3 (fix). */
export function starvedConsumerScenario(fix: StarvedFix = "bug"): ProcessScenario {
  const gets = fix === "bug" ? 4 : 3;
  return {
    id: `starved-consumer:${fix}`,
    title: "Consumer waits for one more message",
    vars: [{ name: "v", type: "int" }],
    mailboxes: [{ name: "mbx", bound: 0 }],
    processes: [
      {
        id: "producer",
        label: "producer",
        kind: "initial",
        body: [
          {
            id: "prod-loop",
            kind: "for",
            variable: "i",
            from: 1,
            to: 4,
            comment: fix === "bug" ? "sends 3 messages" : "N = 3 messages",
            body: [after(10, { id: "prod-put", kind: "mailbox", op: "put", mailbox: "mbx", value: v("i") }, "prod-put-delay")],
          },
        ],
      },
      {
        id: "consumer",
        label: "consumer",
        kind: "initial",
        body: [
          {
            id: "cons-loop",
            kind: "repeat",
            count: gets,
            comment: fix === "bug" ? "expects 4" : "the same N = 3",
            body: [{ id: "cons-get", kind: "mailbox", op: "get", mailbox: "mbx", target: "v" }, display("consumer: got %0d", v("v"))],
          },
          display("consumer: all values checked"),
        ],
      },
    ],
  };
}

/** The spin fix: an always procedure waits in @(done) from t = 0, so each trigger is counted once. */
export function spinFixScenario(): ProcessScenario {
  return {
    id: "spin-triggered:fixed",
    title: "@(done) inside the loop",
    vars: [{ name: "n", type: "int", init: 0 }],
    events: ["done"],
    processes: [
      {
        id: "producer",
        label: "producer",
        kind: "initial",
        body: [after(10, { kind: "trigger", event: "done" }), display("producer triggered done")],
      },
      {
        id: "consumer",
        label: "consumer",
        kind: "always",
        body: [{ id: "cons-wait", kind: "waitEvent", event: "done" }, { kind: "assign", target: "n", expr: bin("+", v("n"), c(1)) }, display("consumer saw done, n = %0d", v("n"))],
      },
    ],
  };
}

export interface KataFixes {
  /** chk expects the count mon sends (N = 3), instead of repeat (4). */
  sharedN: boolean;
  /** report waits in @(mon_done) from t = 0, instead of `#30 @(mon_done)`. */
  waitFromZero: boolean;
}

export const KATA_STARTER: KataFixes = { sharedN: false, waitFromZero: false };

/** The lesson's "repair the hand-off" kata bench, with each fix as an independent switch. */
export function kataScenario(fixes: KataFixes = KATA_STARTER): ProcessScenario {
  const reportWait: Stmt = { id: "report-wait", kind: "waitEvent", event: "mon_done" };
  return {
    id: `kata:${fixes.sharedN ? "N" : "4"}:${fixes.waitFromZero ? "0" : "30"}`,
    title: "Repair the hand-off",
    vars: [{ name: "v", type: "int" }],
    events: ["mon_done"],
    mailboxes: [{ name: "mon2chk", bound: 0 }],
    processes: [
      {
        id: "mon",
        label: "mon",
        kind: "initial",
        body: [
          {
            id: "mon-loop",
            kind: "for",
            variable: "i",
            from: 1,
            to: 4,
            comment: fixes.sharedN ? "N = 3 values" : undefined,
            body: [{ ...after(10, { id: "mon-put", kind: "mailbox", op: "put", mailbox: "mon2chk", value: now }, "mon-put-delay"), comment: "sends 10, 20, 30" }],
          },
          { id: "mon-trigger", kind: "trigger", event: "mon_done", comment: "runs at t = 30 ns" },
        ],
      },
      {
        id: "chk",
        label: "chk",
        kind: "initial",
        body: [
          {
            id: "chk-loop",
            kind: "repeat",
            count: fixes.sharedN ? 3 : 4,
            comment: fixes.sharedN ? "N: exactly what mon sends" : undefined,
            body: [{ id: "chk-get", kind: "mailbox", op: "get", mailbox: "mon2chk", target: "v" }, display("chk: got %0d", v("v"))],
          },
          display("chk: all values checked"),
        ],
      },
      {
        id: "report",
        label: "report",
        kind: "initial",
        body: [fixes.waitFromZero ? { ...reportWait, comment: "waiting from t = 0" } : after(30, reportWait, "report-delay"), display("report: mon finished")],
      },
    ],
  };
}

/** The scenario behind each triage round, and its repaired version. */
export function smellScenario(smell: SmellId, fixed = false): ProcessScenario {
  switch (smell) {
    case "missed-trigger":
      return eventRaceScenario(fixed ? "triggered" : "at-trigger");
    case "spin-triggered":
      return fixed ? spinFixScenario() : eventRaceScenario("triggered-loop");
    case "leaked-key":
      return keyLeakScenario(fixed ? "put-before-return" : "bug");
    case "circular-wait":
      return circularWaitScenario(fixed ? { order: "same", startDelay: 0 } : DEFAULT_CIRCULAR);
    case "starved-consumer":
      return starvedConsumerScenario(fixed ? "shared-count" : "bug");
  }
}

/* ------------------------------------------------------------------------- */
/* Wait-for graph (semaphores).                                               */
/* ------------------------------------------------------------------------- */

export const HOLDER_EDGE_NOTE = "model bookkeeping: a semaphore does not track owners";

export interface WaitForNode {
  id: string;
  label: string;
  kind: "process" | "semaphore";
}

export interface WaitForEdge {
  from: string;
  to: string;
  /** "waits": a process is queued in get() of the semaphore. "held": the semaphore's key was last taken by the process (bookkeeping). */
  kind: "waits" | "held";
  label: string;
}

export interface WaitForGraph {
  nodes: WaitForNode[];
  edges: WaitForEdge[];
  /** Closed node lists [a, b, ..., a], from listCycles. */
  cycles: string[][];
  /** Cycles that pass through two or more processes. */
  multiProcessCycles: string[][];
}

const procNode = (label: string) => `proc:${label}`;
const semNode = (name: string) => `sem:${name}`;
const nodeLabel = (id: string) => id.replace(/^(proc|sem):/, "");
export const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

/**
 * Process -> the semaphore it waits on (§15.3.3); semaphore -> each process the
 * model's bookkeeping says holds its keys. Cycle detection reuses listCycles
 * from the AXI deadlock model, so there is one implementation.
 */
export function waitForGraph(step: TraceStep): WaitForGraph {
  const nodes: WaitForNode[] = [];
  const seen = new Set<string>();
  const add = (n: WaitForNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };
  step.procs.filter((p) => p.depth === 0 && p.kind !== "final").forEach((p) => add({ id: procNode(p.label), label: p.label, kind: "process" }));
  const edges: WaitForEdge[] = [];
  Object.entries(step.semaphores).forEach(([name, s]) => {
    add({ id: semNode(name), label: name, kind: "semaphore" });
    s.waiters.forEach((w) => {
      add({ id: procNode(w.label), label: w.label, kind: "process" });
      edges.push({ from: procNode(w.label), to: semNode(name), kind: "waits", label: `waits in ${name}.get(${w.keys})` });
    });
    Object.entries(s.held).forEach(([who, n]) => {
      add({ id: procNode(who), label: who, kind: "process" });
      edges.push({ from: semNode(name), to: procNode(who), kind: "held", label: `${n} key${n === 1 ? "" : "s"} held by ${who} (${HOLDER_EDGE_NOTE})` });
    });
  });
  const cycles = listCycles(edges.map((e) => ({ from: e.from, to: e.to, legality: "legal" as const, explanation: e.label })));
  const multiProcessCycles = cycles.filter((cy) => new Set(cy.filter((n) => n.startsWith("proc:"))).size >= 2);
  return { nodes, edges, cycles, multiProcessCycles };
}

/** Edge keys that lie on any cycle. */
export function cycleEdgeKeys(graph: WaitForGraph): Set<string> {
  const keys = new Set<string>();
  graph.cycles.forEach((cy) => cy.slice(0, -1).forEach((n, i) => keys.add(edgeKey({ from: n, to: cy[i + 1] }))));
  return keys;
}

/** "proc_a waits for s2, held by proc_b; proc_b waits for s1, held by proc_a." */
export function describeWaitCycle(cycle: string[]): string {
  const start = cycle.findIndex((n) => n.startsWith("proc:"));
  const open = cycle.slice(0, -1);
  const rotated = [...open.slice(start), ...open.slice(0, start)];
  const parts: string[] = [];
  for (let i = 0; i < rotated.length; i += 2) {
    const proc = nodeLabel(rotated[i]);
    const sem = nodeLabel(rotated[(i + 1) % rotated.length]);
    const holder = nodeLabel(rotated[(i + 2) % rotated.length]);
    parts.push(holder === proc ? `${proc} waits for ${sem}, whose key it took itself` : `${proc} waits for ${sem}, held by ${holder}`);
  }
  return `${parts.join("; ")}.`;
}

/** Index of the first trace step whose wait-for graph has a cycle, or -1. */
export function firstCycleStep(result: SimResult, multiProcess = true): number {
  return result.trace.findIndex((s) => {
    const g = waitForGraph(s);
    return (multiProcess ? g.multiProcessCycles : g.cycles).length > 0;
  });
}

/* ------------------------------------------------------------------------- */
/* Evidence: what a run shows, and which of the five shapes it matches.       */
/* ------------------------------------------------------------------------- */

export type BlockedKind = "event" | "semaphore" | "mailbox-get" | "mailbox-put" | "other";

export interface BlockedCall {
  label: string;
  /** The call, as the engine describes it (e.g. "bus.get(1) — 0 keys free"). */
  call: string;
  kind: BlockedKind;
  /** The event, semaphore or mailbox name. */
  object?: string;
}

/**
 * Processes still blocked when the run ended, with the kind of call. An always
 * procedure waiting for its next event is normal at the end of a run, so it is
 * left out (the engine narrates it the same way).
 */
export function blockedCalls(result: SimResult): BlockedCall[] {
  const kindOf = (label: string) => result.processes.find((p) => p.label === label)?.kind ?? "child";
  return result.blockedAtEnd
    .filter((b) => !isAlwaysFamily(kindOf(b.label)))
    .map((b) => {
      const sem = Object.entries(result.finalSemaphores).find(([, s]) => s.waiters.some((w) => w.label === b.label));
      if (sem) return { label: b.label, call: b.on, kind: "semaphore" as const, object: sem[0] };
      const getter = Object.entries(result.finalMailboxes).find(([, m]) => m.getWaiters.some((w) => w.label === b.label));
      if (getter) return { label: b.label, call: b.on, kind: "mailbox-get" as const, object: getter[0] };
      const putter = Object.entries(result.finalMailboxes).find(([, m]) => m.putWaiters.some((w) => w.label === b.label));
      if (putter) return { label: b.label, call: b.on, kind: "mailbox-put" as const, object: putter[0] };
      const ev = /^@\((\w+)\)$/.exec(b.on) ?? /^wait \((\w+)\.triggered\)$/.exec(b.on);
      if (ev) return { label: b.label, call: b.on, kind: "event" as const, object: ev[1] };
      return { label: b.label, call: b.on, kind: "other" as const };
    });
}

/** Every one of the five shapes the run's evidence shows, in lesson order. */
export function smellsIn(result: SimResult): SmellId[] {
  const found = new Set<SmellId>();
  if (result.outcome.kind === "zero-delay-loop") found.add("spin-triggered");
  const blocked = blockedCalls(result);
  const last = result.trace[result.trace.length - 1];
  const graph = waitForGraph(last);
  const inCycle = new Set(graph.multiProcessCycles.flatMap((cy) => cy.filter((n) => n.startsWith("proc:")).map(nodeLabel)));
  blocked.forEach((b) => {
    if (b.kind === "event") found.add("missed-trigger");
    if (b.kind === "mailbox-get") found.add("starved-consumer");
    if (b.kind === "semaphore") found.add(inCycle.has(b.label) ? "circular-wait" : "leaked-key");
  });
  return SMELL_IDS.filter((s) => found.has(s));
}

export type RunEnding = "time-stopped" | "quiet" | "finish" | "other";

export interface RunEvidence {
  endTime: number;
  ending: RunEnding;
  /** One sentence for the ending, generated from the run. */
  endingText: string;
  blocked: BlockedCall[];
  errorsPrinted: number;
}

export function runEvidence(result: SimResult): RunEvidence {
  const o = result.outcome;
  const errorsPrinted = result.log.filter((l) => l.severity === "error" || l.severity === "fatal").length;
  const blocked = blockedCalls(result);
  const noError = errorsPrinted === 0 ? "No error was printed." : `${errorsPrinted} error line${errorsPrinted === 1 ? " was" : "s were"} printed.`;
  if (o.kind === "zero-delay-loop") {
    return {
      endTime: o.time,
      ending: "time-stopped",
      endingText: `Simulation time stopped advancing at t = ${o.time} ns: ${o.label} ran ${o.statements} statements at that time without blocking. The model stops there; a simulator keeps executing the same time step until it is killed or reaches its own iteration limit (tool-dependent). ${noError}`,
      blocked,
      errorsPrinted,
    };
  }
  if (o.kind === "quiet") {
    const who = blocked.length ? ` with ${blocked.length} process${blocked.length === 1 ? "" : "es"} still blocked` : "";
    return {
      endTime: o.time,
      ending: "quiet",
      endingText: `The run ended quietly at t = ${o.time} ns${who}: nothing else was scheduled, so simulation terminated by itself (§9.6.1). ${noError}`,
      blocked,
      errorsPrinted,
    };
  }
  if (o.kind === "finish") return { endTime: o.time, ending: "finish", endingText: `$finish ended the run at t = ${o.time} ns. ${noError}`, blocked, errorsPrinted };
  return { endTime: result.endTime, ending: "other", endingText: `The run stopped at t = ${result.endTime} ns (${o.kind}). ${noError}`, blocked, errorsPrinted };
}

/* ------------------------------------------------------------------------- */
/* Exploration helpers.                                                       */
/* ------------------------------------------------------------------------- */

/** Every order of the ready processes, grouped by time stamp (§4.7), capped and marked. */
export function exploreScenario(scenario: ProcessScenario, maxRuns = 128): ProcessExploration {
  return exploreProcessOrders(scenario, { signature: "timestamps", onCap: "mark", maxRuns });
}

/* ------------------------------------------------------------------------- */
/* Triage rounds.                                                             */
/* ------------------------------------------------------------------------- */

export interface TriageRound {
  smell: SmellId;
  scenario: ProcessScenario;
  /** The run the learner triages: declaration order, one legal order (§4.7). */
  result: SimResult;
  evidence: RunEvidence;
  exploration: ProcessExploration;
  /** How many of the explored orders show this round's shape. */
  ordersWithSmell: number;
  fixedScenario: ProcessScenario;
  fixedResult: SimResult;
  fixedExploration: ProcessExploration;
}

export function buildTriageRound(smell: SmellId): TriageRound {
  const scenario = smellScenario(smell);
  const result = simulateProcesses(scenario);
  const exploration = exploreScenario(scenario);
  const fixedScenario = smellScenario(smell, true);
  const fixedResult = simulateProcesses(fixedScenario);
  const fixedExploration = exploreScenario(fixedScenario);
  const ordersWithSmell = exploration.outcomes.filter((g) => smellsIn(g.result).includes(smell)).reduce((n, g) => n + g.runs.length, 0);
  return { smell, scenario, result, evidence: runEvidence(result), exploration, ordersWithSmell, fixedScenario, fixedResult, fixedExploration };
}

/**
 * Is a fixed run clean in every explored order? The exploration must not be capped (so every
 * order was run), and in each outcome group the run must end quietly or by $finish (no
 * zero-delay loop or other stop), no initial or forked process may be left blocked in any
 * call (an always procedure waiting for its next trigger is normal, §9.2), and no shape is left.
 */
export function isRepaired(exploration: ProcessExploration): boolean {
  return !exploration.capped && exploration.outcomes.every((g) => isCleanRun(g.result));
}

/** One run is clean: it ends quietly or by $finish, with no non-always process blocked in any call and no shape. */
export function isCleanRun(result: SimResult): boolean {
  const kind = result.outcome.kind;
  return (kind === "quiet" || kind === "finish") && blockedCalls(result).length === 0 && smellsIn(result).length === 0;
}

/** Always procedures (and their children) still waiting at the end of a run: normal, not a shape (§9.2). */
export function waitingAlwaysAtEnd(result: SimResult): { label: string; on: string }[] {
  const stuck = new Set(blockedCalls(result).map((b) => b.label));
  return result.blockedAtEnd.filter((b) => !stuck.has(b.label)).map((b) => ({ label: b.label, on: b.on }));
}

/** The status line after "apply fix and rerun", generated from the fixed exploration. */
export function repairSummary(round: TriageRound): string {
  const ex = round.fixedExploration;
  const orders = `${ex.runCount} order${ex.runCount === 1 ? "" : "s"}`;
  if (!isRepaired(ex)) {
    const bad = ex.outcomes.filter((g) => !isCleanRun(g.result)).length;
    const capped = ex.capped ? " The model hit its exploration cap, so not every order was run." : "";
    return `Not repaired in every order: ${bad} of ${ex.outcomes.length} outcome group${ex.outcomes.length === 1 ? "" : "s"} still end with a blocked process, a shape, or no normal ending.${capped}`;
  }
  const allQuiet = ex.outcomes.every((g) => g.result.outcome.kind === "quiet");
  const ending = allQuiet ? "ends quietly" : "ends quietly or by $finish";
  const waiting = waitingAlwaysAtEnd(round.fixedResult);
  const note = waiting.length
    ? ` ${waiting.map((w) => `${w.label} still waits in ${w.on.split(" — ")[0]}`).join("; ")} at the end: an always procedure waiting for its next trigger is normal (§9.2).`
    : "";
  return `Repaired: in every one of the ${orders} of the ready processes the model ran, the run ${ending} with no process outside an always procedure left blocked and no zero-delay loop.${note}`;
}

/** 5! orders of the five shapes. */
const ORDER_COUNT = 120;
/** Coprime to 120 (7 x 13), so seed -> order index is a bijection on 0..119 and consecutive seeds never share an index. */
const ORDER_STEP = 91;
const ORDER_OFFSET = 37;

/**
 * Deterministic order of the five shapes, so server and client render the same order.
 * The seed picks one of the 120 permutations through an affine bijection on 0..119
 * (index = 91 * seed + 37 mod 120), decoded with the factorial number system (Lehmer code).
 * Every 120 consecutive seeds give all 120 orders once, and consecutive seeds always give
 * different orders. Negative and fractional seeds are floored and reduced mod 120.
 */
export function shuffledSmells(seed: number): SmellId[] {
  const s = Number.isFinite(seed) ? Math.floor(seed) : 0;
  let index = (((ORDER_STEP * (s % ORDER_COUNT) + ORDER_OFFSET) % ORDER_COUNT) + ORDER_COUNT) % ORDER_COUNT;
  const pool = [...SMELL_IDS];
  const out: SmellId[] = [];
  for (let f = pool.length - 1; f >= 1; f -= 1) {
    const radix = [1, 1, 2, 6, 24][f];
    const digit = Math.floor(index / radix);
    index %= radix;
    out.push(pool.splice(digit, 1)[0]);
  }
  return [...out, ...pool];
}

/** The next seed after `seed` whose order differs from `seed`'s, so "a new order" is always new. */
export function nextOrderSeed(seed: number): number {
  const current = shuffledSmells(seed).join();
  let next = Math.floor(seed) + 1;
  while (shuffledSmells(next).join() === current && next < Math.floor(seed) + ORDER_COUNT) next += 1;
  return next;
}

/** Feedback for naming `guess` on `round`; the evidence quoted is the round's own declaration-order run. */
export function triageFeedback(guess: SmellId, round: TriageRound): string {
  const found = smellsIn(round.result);
  const evidence = round.evidence;
  const blockedText = evidence.blocked.length ? evidence.blocked.map((b) => `${b.label} in ${b.call}`).join("; ") : "no process is blocked";
  const shows = `This run shows: ${evidence.ending === "time-stopped" ? "time stopped advancing" : `the run ended at t = ${evidence.endTime} ns`}; ${blockedText}.`;
  if (found.includes(guess)) return `${SMELLS[guess].name} is ${SMELLS[guess].signature}. ${shows}`;
  return `${SMELLS[guess].name} would show ${SMELLS[guess].signature}. ${shows}`;
}

/* ------------------------------------------------------------------------- */
/* Deadlock mode.                                                             */
/* ------------------------------------------------------------------------- */

export type DeadlockVerdict = "hang" | "finish" | "depends";

export interface DeadlockStory {
  config: CircularWaitConfig;
  scenario: ProcessScenario;
  /** Declaration-order run, for the stepper. */
  result: SimResult;
  exploration: ProcessExploration;
  verdict: DeadlockVerdict;
  /** First step whose graph closes a cycle through two processes, or -1. */
  cycleStep: number;
  cycleText?: string;
  /** Why the run ends as it does, generated from the run. */
  explanation: string;
}

const blockedOnSemaphore = (step: TraceStep, label: string) => Object.values(step.semaphores).some((s) => s.waiters.some((w) => w.label === label));

export function deadlockStory(config: CircularWaitConfig): DeadlockStory {
  const scenario = circularWaitScenario(config);
  const result = simulateProcesses(scenario);
  const exploration = exploreScenario(scenario);
  const hangs = exploration.outcomes.map((g) => g.result.blockedAtEnd.length > 0);
  const hangOrders = exploration.outcomes.filter((g) => g.result.blockedAtEnd.length > 0).reduce((n, g) => n + g.runs.length, 0);
  const verdict: DeadlockVerdict = hangs.every(Boolean) ? "hang" : hangs.some(Boolean) ? "depends" : "finish";
  const cycleStep = firstCycleStep(result);
  const cycle = cycleStep >= 0 ? waitForGraph(result.trace[cycleStep]).multiProcessCycles[0] : undefined;
  const cycleText = cycle ? describeWaitCycle(cycle) : undefined;
  const orders = `${exploration.runCount} order${exploration.runCount === 1 ? "" : "s"}`;
  let explanation: string;
  if (cycle && cycleStep >= 0) {
    explanation = `At t = ${result.trace[cycleStep].time} ns the wait-for graph closes a cycle: ${cycleText} Neither get() can return, because only the other process's put() could free the key (§15.3.3). Nothing else is scheduled, so the run ends quietly at t = ${result.endTime} ns with ${result.blockedAtEnd.map((b) => b.label).join(" and ")} still blocked and no error in the log (§9.6.1). The model ran ${orders} of the ready processes; ${hangOrders === exploration.runCount ? "all of them" : hangOrders} end this way.`;
  } else {
    const queuedAt = result.trace.find((s) => s.procs.some((p) => p.state === "blocked" && blockedOnSemaphore(s, p.label)));
    if (queuedAt) {
      const waiter = queuedAt.procs.find((p) => p.state === "blocked" && blockedOnSemaphore(queuedAt, p.label));
      const label = waiter?.label ?? "";
      const holder = Object.values(queuedAt.semaphores).flatMap((s) => (s.waiters.some((w) => w.label === label) ? Object.keys(s.held) : []))[0];
      const wake = result.trace.find((s) => s.index > queuedAt.index && s.procs.find((p) => p.label === label)?.state !== "blocked");
      const call = (waiter?.blockedOn ?? "get()").split(" — ")[0];
      const waiterHolds = Object.values(queuedAt.semaphores).reduce((n, s) => n + (s.held[label] ?? 0), 0);
      const noCycle =
        waiterHolds === 0
          ? `${label} holds no key while it waits, so ${holder ?? "the holder"} never waits for ${label} and no cycle can close.`
          : `${label} holds ${waiterHolds} key${waiterHolds === 1 ? "" : "s"} while it waits, yet no cycle closes in this run.`;
      explanation = `${label} blocks in ${call} at t = ${queuedAt.time} ns while ${holder ?? "the other process"} holds the key. It waits in the FIFO queue (§15.3.3) and gets the key when it is returned${wake ? ` at t = ${wake.time} ns` : ""}. ${noCycle} Both finish by t = ${result.endTime} ns. The model ran ${orders} of the ready processes; all of them finish.`;
    } else {
      const aDone = result.trace.find((s) => s.procs.find((p) => p.label === "proc_a")?.state === "done")?.time;
      explanation = `proc_a returns both keys at t = ${aDone} ns, before proc_b asks for its first key at t = ${config.startDelay} ns: the two critical sections never overlap, so nobody ever waits and no cycle can close. Both finish by t = ${result.endTime} ns. The model ran ${orders} of the ready processes; all of them finish.`;
    }
  }
  return { config, scenario, result, exploration, verdict, cycleStep, cycleText, explanation };
}

export const DEADLOCK_VERDICT_LABELS: Readonly<Record<DeadlockVerdict, string>> = {
  hang: "Hangs: both processes stay blocked forever",
  finish: "Both finish",
  depends: "Depends on the order the scheduler picks",
};

/** Feedback for each prediction, generated from the story. */
export function deadlockFeedback(option: DeadlockVerdict, story: DeadlockStory): string {
  if (option === story.verdict) return story.explanation;
  const orders = `${story.exploration.runCount} order${story.exploration.runCount === 1 ? "" : "s"}`;
  if (option === "depends") return `Every one of the ${orders} the model ran ends the same way, so the scheduler's choice does not matter here.`;
  if (option === "hang") return `No wait-for cycle through both processes closes in any of the ${orders} run, so every get() eventually returns.`;
  return `In the ${orders} the model ran, both processes end blocked: a closed cycle never opens again.`;
}

/* ------------------------------------------------------------------------- */
/* Kata mode.                                                                 */
/* ------------------------------------------------------------------------- */

export interface KataGroup {
  id: string;
  runCount: number;
  result: SimResult;
  reportPrinted: boolean;
  /** Values chk received before the run ended. */
  chkGets: number;
  chkBlocked: boolean;
  smells: SmellId[];
}

export interface KataStory {
  fixes: KataFixes;
  scenario: ProcessScenario;
  exploration: ProcessExploration;
  groups: KataGroup[];
  reportVerdict: "always" | "never" | "depends";
  /** The processes the scheduler chooses between at the trigger time, from the run's choice point. */
  raceAt?: { time: number; options: string[] };
  /** Each shape and the number of orders that show it. */
  smellOrders: Record<"starved-consumer" | "missed-trigger", number>;
}

export const REPORT_LINE = "report: mon finished";

export function kataStory(fixes: KataFixes = KATA_STARTER): KataStory {
  const scenario = kataScenario(fixes);
  const exploration = exploreScenario(scenario);
  const groups: KataGroup[] = exploration.outcomes.map((g, i) => {
    const r = g.result;
    return {
      id: `g${i}`,
      runCount: g.runs.length,
      result: r,
      reportPrinted: r.log.some((l) => l.text === REPORT_LINE),
      chkGets: r.log.filter((l) => l.label === "chk" && l.text.startsWith("chk: got")).length,
      chkBlocked: r.blockedAtEnd.some((b) => b.label === "chk"),
      smells: smellsIn(r),
    };
  });
  const printed = groups.map((g) => g.reportPrinted);
  const reportVerdict = printed.every(Boolean) ? "always" : printed.some(Boolean) ? "depends" : "never";
  const triggerStep = groups[0]?.result.trace.find((s) => s.lineKey === "mon-trigger" && s.kind === "exec");
  const raceStep = groups
    .flatMap((g) => g.result.trace)
    .find((s) => s.choice && triggerStep && s.time === triggerStep.time && s.choice.options.includes("report"));
  const count = (smell: SmellId) => groups.filter((g) => g.smells.includes(smell)).reduce((n, g) => n + g.runCount, 0);
  return {
    fixes,
    scenario,
    exploration,
    groups,
    reportVerdict,
    raceAt: raceStep?.choice ? { time: raceStep.time, options: raceStep.choice.options } : undefined,
    smellOrders: { "starved-consumer": count("starved-consumer"), "missed-trigger": count("missed-trigger") },
  };
}

/** A one-line end state for a kata group, generated from its run. */
export function kataEndState(group: KataGroup): string {
  const parts = group.result.blockedAtEnd.map((b) => (b.label === "chk" ? `chk blocked in get() #${group.chkGets + 1} (${b.on})` : `${b.label} blocked in ${b.on}`));
  return parts.length ? `${parts.join("; ")}; ended at t = ${group.result.endTime} ns` : `nobody blocked; ended at t = ${group.result.endTime} ns`;
}

export const KATA_VERDICT_LABELS: Readonly<Record<KataStory["reportVerdict"], string>> = {
  always: "It always prints",
  never: "It never prints",
  depends: "It depends on which process the scheduler runs first",
};

export function kataFeedback(option: KataStory["reportVerdict"], story: KataStory): string {
  const total = story.exploration.runCount;
  const printedOrders = story.groups.filter((g) => g.reportPrinted).reduce((n, g) => n + g.runCount, 0);
  const tally = `The model ran ${total} orders of the ready processes; ${printedOrders} print "${REPORT_LINE}".`;
  if (option === story.reportVerdict && option === "depends" && story.raceAt) {
    const [x, y] = story.raceAt.options;
    return `At t = ${story.raceAt.time} ns ${x} and ${y} are both ready, and the standard leaves their order open (§4.7). If report runs first it is already waiting in @(mon_done) when mon triggers it; if mon runs first, -> mon_done finds nobody waiting and the trigger is lost (§15.5.1, §15.5.2). ${tally}`;
  }
  if (option === story.reportVerdict) return tally;
  return `${tally} So "${KATA_VERDICT_LABELS[option].toLowerCase()}" does not match the model.`;
}
