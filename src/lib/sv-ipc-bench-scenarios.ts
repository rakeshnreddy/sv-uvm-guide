/**
 * The IPC lesson's bench (gen, drv, irq, chk) and the same-time semaphore
 * program, built only from sv-process-model statements (this file does not
 * change the engine). Every log line, end time, queue and outcome group the
 * component shows is a model result; the prediction options and their
 * feedback are generated here from those results.
 *
 * Rules (IEEE 1800-2023, verified against the standard's text):
 * - §15.3.1: new(int keyCount = 0): "The default value for keyCount is 0", so
 *   `semaphore bus = new;` starts with an empty bucket; put() may raise the
 *   count above keyCount. §15.3.2: put() returns keys. §15.3.3: get() blocks
 *   until the keys are available; the waiting queue is FIFO, which "does not
 *   guarantee the order in which processes arrive at the queue".
 * - §15.4.1: new() with no bound is unbounded. §15.4.3: put() on a full
 *   bounded mailbox suspends the caller until there is room. §15.4.5: get()
 *   blocks while the mailbox is empty; the waiting queue is FIFO, with the same
 *   sentence about the arrival order.
 * - §15.5.1 / §15.5.2: -> unblocks only processes already waiting in @; the @
 *   statement must execute before the trigger. §15.5.3: a wait (ev.triggered)
 *   that runs later in the same time step proceeds too.
 * - §4.7: events ready in the Active region may be processed in any order, so
 *   same-time arrivals at a FIFO queue come in an order the simulator chooses.
 * - §20.10: $error prints its message and the process carries on.
 * - §9.6.1: simulation terminates when there is no further activity, so a
 *   bench whose live processes are all blocked ends quietly. A free-running
 *   clock is always further activity, so with one the run goes on until the
 *   watchdog's $finish (§20.2).
 *
 * Modelling limits (surfaced in the UI):
 * - Values are numbers (SvVal), so the lesson's `bus_write(string who, int data)`
 *   becomes `bus_write(int data)`: the caller's name comes from the process
 *   that runs the task, which the log shows as its own column (time, process,
 *   text). The lesson prints the same columns with %0t and %s.
 * - The engine renders `for (int i = 1; i < 4; i++)`, which runs the same
 *   iterations as the lesson's `i <= 3`, and `semaphore bus = new(0);` for the
 *   lesson's `new` (the same default, §15.3.1).
 * - Exploration runs every order of the processes ready at one time, each until
 *   it blocks or ends; §4.7 interleaving inside a process is not explored. A
 *   run count cap marks the exploration as incomplete instead of failing.
 */

import {
  alignedOutcomeRuns,
  bin,
  c,
  exploreProcessOrders,
  firstDivergentStep,
  simulateProcesses,
  timestampSignature,
  v,
  type Expr,
  type LogLine,
  type ProcessDef,
  type ProcessExploration,
  type ProcessScenario,
  type SimResult,
  type Stmt,
  type TraceStep,
} from "./sv-process-model";

/* ------------------------------------------------------------------------- */
/* Statement helpers.                                                         */
/* ------------------------------------------------------------------------- */

const display = (id: string, format: string, args: Expr[] = [], comment?: string): Stmt => ({ id, kind: "display", format, args, comment });
const after = (id: string, amount: number, then?: Stmt, comment?: string): Stmt => ({ id, kind: "delay", amount: c(amount), then, comment });

/* ------------------------------------------------------------------------- */
/* The bench.                                                                 */
/* ------------------------------------------------------------------------- */

/** The watchdog's delay, in ns. */
export const WATCHDOG_NS = 100;
/** irq's delay before it calls bus_write, in ns (the lesson's #25). */
export const IRQ_AT_NS = 25;
/** chk's delay in the race variant, in ns (the lesson's #30). */
export const LATE_WAIT_NS = 30;

export type BenchVariant = "as-written" | "no-put" | "new-zero" | "late-wait";

/** Lesson order: the bench, then the three "break it on purpose" changes. */
export const BENCH_VARIANTS: readonly BenchVariant[] = ["as-written", "no-put", "new-zero", "late-wait"];

export const BENCH_VARIANT_LABELS: Readonly<Record<BenchVariant, string>> = {
  "as-written": "As written",
  "no-put": "Delete bus.put(1)",
  "new-zero": "new instead of new(1)",
  "late-wait": "chk: #30 @(drv_done)",
};

/** What each change does, in the lesson's words, for the caption above the code. */
export const BENCH_VARIANT_CHANGES: Readonly<Record<BenchVariant, string>> = {
  "as-written": "The bench from the lesson: a bounded mailbox, a one-key semaphore and an event.",
  "no-put": "bus_write no longer returns the key.",
  "new-zero": "semaphore bus = new; creates the bucket with the default keyCount, 0 (§15.3.1). The model's code shows that default as new(0).",
  "late-wait": `chk starts waiting for drv_done only after #${LATE_WAIT_NS}.`,
};

export interface BenchOptions {
  /** Adds `always #5 clk = ~clk;` and an `initial #100 $finish;` watchdog. */
  advanced?: boolean;
}


/** The lesson's tb_top bench with one change applied. */
export function benchScenario(variant: BenchVariant, options: BenchOptions = {}): ProcessScenario {
  const advanced = options.advanced ?? false;
  const busWrite: Stmt[] = [
    { id: "bw-get", kind: "semaphore", op: "get", semaphore: "bus", keys: 1, comment: "waits while another process holds the key" },
    display("bw-start", "write %0d start", [v("data")]),
    after("bw-delay", 10, undefined, "the transfer occupies the bus for 10 ns"),
    display("bw-end", "write %0d end", [v("data")], variant === "no-put" ? "bus.put(1) deleted here" : undefined),
    ...(variant === "no-put" ? [] : [{ id: "bw-put", kind: "semaphore", op: "put", semaphore: "bus", keys: 1, comment: "the oldest waiter, if any, takes the key" } as Stmt]),
  ];
  const chkWait: Stmt =
    variant === "late-wait"
      ? after("chk-wait", LATE_WAIT_NS, { id: "chk-at", kind: "waitEvent", event: "drv_done" }, `starts waiting at ${LATE_WAIT_NS} ns`)
      : { id: "chk-wait", kind: "waitEvent", event: "drv_done", comment: "waiting from t = 0" };
  const processes: ProcessDef[] = [
    {
      id: "gen",
      label: "gen",
      kind: "initial",
      body: [
        {
          id: "gen-loop",
          kind: "for",
          variable: "i",
          from: 1,
          to: 4,
          body: [
            { id: "gen-put", kind: "mailbox", op: "put", mailbox: "gen2drv", value: v("i"), comment: "waits while the mailbox is full" },
            display("gen-print", "put %0d", [v("i")]),
          ],
        },
      ],
    },
    {
      id: "drv",
      label: "drv",
      kind: "initial",
      body: [
        {
          id: "drv-loop",
          kind: "repeat",
          count: 3,
          body: [
            { id: "drv-get", kind: "mailbox", op: "get", mailbox: "gen2drv", target: "item", comment: "waits while the mailbox is empty" },
            { id: "drv-write", kind: "call", task: "bus_write", args: [v("item")] },
            { id: "drv-count", kind: "assign", target: "n_sent", expr: bin("+", v("n_sent"), c(1)) },
          ],
        },
        { id: "drv-trigger", kind: "trigger", event: "drv_done" },
      ],
    },
    { id: "irq", label: "irq", kind: "initial", body: [after("irq-wait", IRQ_AT_NS, { id: "irq-write", kind: "call", task: "bus_write", args: [c(99)] }, "arrives while drv holds the bus")] },
    {
      id: "chk",
      label: "chk",
      kind: "initial",
      body: [
        chkWait,
        {
          id: "chk-check",
          kind: "if",
          cond: bin("==", v("n_sent"), c(3)),
          then: [display("chk-pass", "PASS, drv sent %0d items", [v("n_sent")])],
          else: [{ id: "chk-error", kind: "severity", level: "error", format: "drv sent %0d items, expected 3", args: [v("n_sent")] }],
        },
      ],
    },
  ];
  if (advanced) {
    processes.push(
      { id: "clock", label: "clock", kind: "always", role: "clock", body: [after("clk-toggle", 5, { id: "clk-assign", kind: "assign", target: "clk", expr: { kind: "inv", operand: v("clk") } })] },
      { id: "watchdog", label: "watchdog", kind: "initial", body: [after("wd-wait", WATCHDOG_NS, { id: "wd-finish", kind: "finish" })] },
    );
  }
  return {
    id: `ipc-bench:${variant}:${advanced ? "clock" : "plain"}`,
    title: "Generator, driver, interrupt and checker",
    vars: [
      { name: "n_sent", type: "int", init: 0, comment: "written only by drv" },
      { name: "item", type: "int", init: 0, comment: "drv's received item" },
      ...(advanced ? [{ name: "clk", type: "bit" as const, comment: "free-running clock" }] : []),
    ],
    events: ["drv_done"],
    mailboxes: [{ name: "gen2drv", bound: 1 }],
    semaphores: [{ name: "bus", keys: variant === "new-zero" ? 0 : 1 }],
    tasks: [{ name: "bus_write", automatic: true, params: ["data"], body: busWrite }],
    processes,
    maxTime: advanced ? WATCHDOG_NS + 10 : undefined,
  };
}

/* ------------------------------------------------------------------------- */
/* Reading a run.                                                             */
/* ------------------------------------------------------------------------- */

/** A log line as the lesson prints it: time stamp, process, text. */
export function logLineText(line: Pick<LogLine, "time" | "label" | "text" | "severity">): string {
  return `${line.time} ${line.label}: ${line.severity ? `$${line.severity}: ` : ""}${line.text}`;
}

/** Time a process printed exactly this text, if it did. */
export function printTime(result: SimResult, label: string, text: string): number | undefined {
  return result.log.find((l) => l.label === label && l.text === text)?.time;
}

export const PASS_TEXT = (n: number) => `PASS, drv sent ${n} items`;

export function passed(result: SimResult): boolean {
  return result.log.some((l) => l.label === "chk" && l.text.startsWith("PASS"));
}

/** First time a process blocked in a semaphore get, as the trace records it (the key bucket's queue). */
export function firstQueuedAt(result: SimResult, semaphore: string, label: string): number | undefined {
  return result.trace.find((s) => s.semaphores[semaphore]?.waiters.some((w) => w.label === label))?.time;
}

/** The step where a trigger of `event` wakes `label`, if any. */
export function triggerWakeStep(result: SimResult, event: string, label: string): TraceStep | undefined {
  return result.trace.find((s) => s.kind === "exec" && s.what.includes(`triggers ${event}`) && s.what.includes(`wakes ${label}`));
}

/* ------------------------------------------------------------------------- */
/* Presenting a run (the trace the component steps through).                  */
/* ------------------------------------------------------------------------- */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The engine completes a producer's suspended put() inside the get() that frees
 * the slot: that get's snapshot already holds the producer's message while the
 * producer is still listed as blocked. §15.4.3 says the caller of put() "shall
 * be suspended until there is enough room in the queue", so the message is
 * stored by the producer's own put() once it resumes. This regroups each such
 * hand-off: the get leaves the slot empty and marks the producer ready, the
 * wake step says the put can now complete, and a step of the producer's own,
 * just before it next runs, stores the message. Times, the log and the outcome
 * are the engine's; only steps inside one time stamp are regrouped. A hand-off
 * is left as the engine wrote it when anything else touches that mailbox
 * before the producer runs (the regrouped state could then disagree with the
 * run); the get's explanation then says so (UNREGROUPED_HANDOFF_NOTE), and
 * HANDOFF_REGROUP_ASSUMPTION states the engine's behaviour.
 */
export const UNREGROUPED_HANDOFF_NOTE =
  "This step is shown as the engine runs it: the slot already holds the suspended put()'s message, because another statement uses this mailbox before the producer resumes (see Assumptions and limits).";

function regroupPutHandoffs(trace: TraceStep[]): TraceStep[] {
  const out = trace.slice();
  const leaveAsEngine = (g: number) => {
    if (!out[g].why.endsWith(UNREGROUPED_HANDOFF_NOTE)) out[g] = { ...out[g], why: `${out[g].why} ${UNREGROUPED_HANDOFF_NOTE}` };
  };
  const getRe = /^(\S+): (\S+)\.(get|try_get)\((\S+)\) takes (.+) \((\d+)\/(\d+) left\)( and returns 1)?\.$/;
  for (let g = 1; g < out.length - 1; g++) {
    const get = out[g];
    const gm = get.kind === "exec" ? getRe.exec(get.what) : null;
    if (!gm) continue;
    const name = gm[2];
    const wake = out[g + 1];
    const wakeRe = new RegExp(`^(\\S+) wakes: its ${escapeRe(name)}\\.put\\((.+)\\) completes now that a slot is free \\((\\d+)/(\\d+)\\)\\.$`);
    const wm = wake.kind === "wake" ? wakeRe.exec(wake.what) : null;
    if (!wm || wake.pid === undefined) continue;
    // Only one producer per freed slot; a second put wake would need its own slot.
    if (out[g + 2] && out[g + 2].kind === "wake" && wakeRe.test(out[g + 2].what)) {
      leaveAsEngine(g);
      continue;
    }
    const label = wm[1];
    const shownValue = wm[2];
    const waiting = out[g - 1].mailboxes[name]?.putWaiters.find((w) => w.label === label);
    const pid = wake.pid;
    const r = out.findIndex((s, i) => i > g + 1 && s.pid === pid);
    const touched = r > 0 && out.slice(g + 2, r).some((s) => s.what.includes(`${name}.`));
    if (!waiting || r < 0 || out[r].time !== wake.time || touched) {
      leaveAsEngine(g);
      continue;
    }
    const bound = get.mailboxes[name].bound;
    const withoutHandoff = (s: TraceStep): TraceStep => {
      const m = s.mailboxes[name];
      return { ...s, mailboxes: { ...s.mailboxes, [name]: { ...m, items: m.items.slice(0, m.items.length - 1) } } };
    };
    const left = get.mailboxes[name].items.length - 1;
    const readyProducer = (procs: TraceStep["procs"]) => procs.map((p) => (p.pid === pid ? { ...p, state: "ready" as const, blockedOn: undefined } : p));
    for (let i = g; i < r; i++) out[i] = withoutHandoff(out[i]);
    out[g] = {
      ...out[g],
      what: `${gm[1]}: ${name}.${gm[3]}(${gm[4]}) takes ${gm[5]} (${left}/${bound} left)${gm[8] ?? ""}.`,
      why: `${get.why} That frees the slot, so ${label}'s suspended put(${shownValue}) can resume; it stores its message when ${label} runs (§15.4.3).`,
      procs: readyProducer(out[g].procs),
    };
    out[g + 1] = {
      ...out[g + 1],
      what: `${label} wakes: its ${name}.put(${shownValue}) can complete now that a slot is free (${left}/${bound}). The put stores ${shownValue} when ${label} runs.`,
    };
    const before = out[r - 1];
    const runner = out[r];
    const beforeMb = before.mailboxes[name];
    const store: TraceStep = {
      ...before,
      region: runner.region,
      kind: "exec",
      pid,
      lineKey: wake.lineKey,
      what: `${label}'s ${name}.put(${shownValue}) stores ${shownValue} (${beforeMb.items.length + 1}/${bound}).`,
      why: `${label} resumes inside its suspended put(), and the put stores the message now that there is room in the queue, in strict FIFO order (§15.4.3).`,
      procs: before.procs.map((p) => (p.pid === pid ? { ...p, state: "running" as const, blockedOn: undefined, lineKey: wake.lineKey } : p.state === "running" ? { ...p, state: "ready" as const } : p)),
      mailboxes: { ...before.mailboxes, [name]: { ...beforeMb, items: [...beforeMb.items, waiting.value] } },
      choice: runner.choice,
      killed: undefined,
      unwound: undefined,
      preStart: undefined,
    };
    out[r] = { ...runner, choice: undefined };
    out.splice(r, 0, store);
  }
  return out.map((s, index) => (s.index === index ? s : { ...s, index }));
}

/**
 * The engine's trigger narration groups wait (ev.triggered) with @ev under
 * "only the processes already waiting". §15.5.2 says that of @ev; §15.5.3 lets
 * a wait (ev.triggered) that runs later in the same time step proceed too, so
 * the shown text gives each its own clause.
 */
function scopeTriggerWhy(step: TraceStep): TraceStep {
  const m = /^A trigger unblocks only the processes already waiting on @\((\S+)\) or wait \(\1\.triggered\) \(§15\.5\.2\)\. \1\.triggered stays true until time advances \(§15\.5\.3\)\.$/.exec(step.why);
  if (!m) return step;
  const ev = m[1];
  return {
    ...step,
    why: `A trigger unblocks only the processes already waiting in @(${ev}); one that reaches @(${ev}) after the trigger stays blocked (§15.5.2). A wait (${ev}.triggered) also proceeds if it runs later in this time step, because ${ev}.triggered stays true until time advances (§15.5.3).`,
  };
}

/**
 * Any process-model run as the component shows it, in every mode that steps
 * through a trace: the engine's run with each put() hand-off regrouped (see
 * regroupPutHandoffs) and the trigger narration scoped to its clauses.
 * Idempotent; the log, outcome and end state are unchanged.
 */
export function presentProcessRun(result: SimResult): SimResult {
  return { ...result, trace: regroupPutHandoffs(result.trace).map(scopeTriggerWhy) };
}

/** The bench's name for presentProcessRun. */
export const presentBenchRun = presentProcessRun;

/**
 * Every change between fill levels of the mailbox, in order, as the presented
 * trace shows them (one entry per change, so a slot that empties and refills in
 * one time stamp gives two entries at that time).
 */
export function mailboxFillHistory(result: SimResult, mailbox: string): { time: number; items: number }[] {
  const out: { time: number; items: number }[] = [];
  presentBenchRun(result).trace.forEach((s) => {
    const m = s.mailboxes[mailbox];
    if (!m) return;
    if (out.length === 0 || out[out.length - 1].items !== m.items.length) out.push({ time: s.time, items: m.items.length });
  });
  return out;
}

/**
 * Clauses for one step: the ones the engine's narration cites, or, for the
 * step kinds whose narration cites none, the clause that defines the statement.
 * A time advance also names the reference algorithm's move to the next
 * nonempty time slot (§4.5), and a $finish call the clause that defines it (§20.2).
 */
export function stepClauses(step: TraceStep): string[] {
  const cited = [...new Set(step.why.match(/§\d+(?:\.\d+)*/g) ?? [])];
  if (step.kind === "advance") return [...new Set(["§4.5", ...cited])];
  if (step.kind === "finish") return [...new Set([...cited, "§20.2"])];
  if (cited.length) return cited;
  if (step.kind === "end") return step.what.includes("$finish") ? ["§20.2"] : step.what.startsWith("No more events") ? ["§9.6.1"] : [];
  if (step.kind === "print") return ["§21.2.1"];
  if (step.kind === "loop") return /enters the loop with|\+\+/.test(step.what) ? ["§12.7.1"] : ["§12.7.2"];
  if (/ calls bus_write\(/.test(step.what)) return ["§13.3", "§13.3.1"];
  if (/ blocks on wait \(/.test(step.what)) return ["§9.4.3"];
  if (/\bfinishes\.$/.test(step.what)) return ["§9.2.1"];
  if (/ = /.test(step.what) && step.kind === "exec") return ["§10.4.1"];
  if (/: if \(/.test(step.what)) return ["§12.4"];
  if (/#\d+|delay/i.test(step.what) || /delay suspends/i.test(step.why)) return ["§9.4.1"];
  return [];
}

/* ------------------------------------------------------------------------- */
/* Exploration.                                                               */
/* ------------------------------------------------------------------------- */

/** Most orders explored before the result is marked as capped (a model limit). */
export const BENCH_MAX_RUNS = 400;

/** Every order of the ready processes, compared by time stamp (§4.7), capped and marked. */
export function exploreBench(scenario: ProcessScenario, maxRuns = BENCH_MAX_RUNS): ProcessExploration {
  return exploreProcessOrders(scenario, { signature: "timestamps", onCap: "mark", maxRuns });
}

/**
 * One run per outcome group, aligned so each shares the longest prefix with the
 * first group's run: the cards then differ only where the outcome is decided,
 * not in the order of lines inside an earlier time stamp. A capped exploration
 * may hold no run of a group that shares that prefix, so the first group's run
 * with one scheduler choice changed is tried too; such a run is kept only when
 * it has the group's outcome and stays with the first run for longer.
 */
export function outcomeRuns(scenario: ProcessScenario, exploration: ProcessExploration): SimResult[] {
  const aligned = alignedOutcomeRuns(scenario, exploration);
  const base = aligned[0];
  if (!base) return [];
  let flips: SimResult[] | undefined;
  const singleFlips = () =>
    (flips ??= base.choices.flatMap((_, k) =>
      Array.from({ length: Math.max(0, base.choiceWidths[k] - 1) }, (__, a) => simulateProcesses(scenario, { choices: [...base.choices.slice(0, k), a + 1] })),
    ));
  return aligned
    .map((run, i) => {
      if (i === 0) return run;
      const signature = exploration.outcomes[i]?.signature;
      let best = run;
      let bestAt = firstDivergentStep([base, run]);
      singleFlips().forEach((f) => {
        if (timestampSignature(f) !== signature) return;
        const at = firstDivergentStep([base, f]);
        if (at > bestAt) {
          best = f;
          bestAt = at;
        }
      });
      return best;
    })
    .map(presentBenchRun);
}

export interface BenchMoment {
  id: string;
  label: string;
  /** Trace index to seek to. */
  index: number;
}

/**
 * Key moments of a run, found in its trace: the mailbox filling, each process
 * joining a semaphore's queue, an event trigger waking a waiter, and the end.
 */
export function benchMoments(result: SimResult): BenchMoment[] {
  const out: BenchMoment[] = [];
  const full = result.trace.find((s) => Object.values(s.mailboxes).some((m) => m.bound > 0 && m.items.length >= m.bound));
  if (full) {
    const name = Object.entries(full.mailboxes).find(([, m]) => m.bound > 0 && m.items.length >= m.bound)?.[0] ?? "";
    out.push({ id: "mailbox-full", label: `${name} full at ${full.time} ns`, index: full.index });
  }
  const queued = new Set<string>();
  result.trace.forEach((s) =>
    Object.entries(s.semaphores).forEach(([name, sem]) =>
      sem.waiters.forEach((w) => {
        const key = `${name}:${w.label}`;
        if (queued.has(key)) return;
        queued.add(key);
        out.push({ id: `queue-${key}`, label: `${w.label} queues for ${name} at ${s.time} ns`, index: s.index });
      }),
    ),
  );
  result.trace.forEach((s) => {
    const m = s.kind === "exec" ? /^(\S+) triggers (\S+)\.(?: It wakes (.+)\.| Nobody is waiting on it yet\.)$/.exec(s.what) : null;
    if (m) out.push({ id: `trigger-${s.index}`, label: m[3] ? `-> ${m[2]} wakes ${m[3]} at ${s.time} ns` : `-> ${m[2]} at ${s.time} ns: nobody waiting`, index: s.index });
  });
  const last = result.trace[result.trace.length - 1];
  if (last) out.push({ id: "end", label: `Run ends at ${result.endTime} ns`, index: last.index });
  return out.sort((a, b) => a.index - b.index);
}

/* ------------------------------------------------------------------------- */
/* Predictions (generated from the runs).                                     */
/* ------------------------------------------------------------------------- */

export interface BenchOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface BenchQuestion {
  id: string;
  question: string;
  options: BenchOption[];
}

const ns = (t: number | undefined) => (t === undefined ? "never" : `${t} ns`);

/** How a run ended, in one sentence tied to its clause. */
export function endingSentence(result: SimResult): string {
  const blocked = result.blockedAtEnd.filter((b) => b.label !== "clock");
  const who = blocked.map((b) => `${b.label} in ${b.on.split(" — ")[0]}`).join(", ");
  switch (result.outcome.kind) {
    case "quiet":
      return blocked.length
        ? `The run ends quietly at ${result.endTime} ns with ${who} still blocked: nothing else is scheduled, so simulation terminates (§9.6.1). The bench prints no error; anything a tool reports at the end is tool-dependent.`
        : `The run ends at ${result.endTime} ns: every process finished and nothing else is scheduled (§9.6.1).`;
    case "finish":
      return `The watchdog's $finish ends the run at ${result.endTime} ns (§20.2)${blocked.length ? `, with ${who} still blocked` : ""}. The clock kept the simulation busy until then.`;
    case "horizon":
      return `The model stops at its ${result.outcome.maxTime} ns horizon (a model limit, not SystemVerilog).`;
    default:
      return `The run ends at ${result.endTime} ns (${result.outcome.kind}).`;
  }
}

/** Questions for the as-written bench: when gen prints "put 3", and when irq starts its write. */
function asWrittenQuestions(result: SimResult): BenchQuestion[] {
  const put3 = printTime(result, "gen", "put 3");
  const irqStart = printTime(result, "irq", "write 99 start");
  const queued = firstQueuedAt(result, "bus", "irq");
  const drvFree = result.log.find((l) => l.label === "drv" && l.text === "write 2 start")?.time;
  const put3Feedback = (t: number | undefined): string => {
    if (t === put3)
      return `gen2drv = new(1) holds one item. put(3) waits while item 2 sits in the slot (§15.4.3), and drv's get takes item 2 at ${ns(drvFree)}, so put(3) completes and gen prints at ${ns(put3)}.`;
    if (t === 0) return "At 0 ns the one slot already holds an item, so the third put() waits for room (§15.4.3). A bounded mailbox holds back the producer.";
    if (t === undefined) return "drv keeps taking items, so gen always gets room eventually; put() only waits until there is room (§15.4.3).";
    return `Too late: the slot frees as soon as drv's get takes item 2 at ${ns(drvFree)}, not when drv finishes writing it.`;
  };
  const irqFeedback = (t: number | undefined): string => {
    if (t === irqStart)
      return `irq calls bus.get(1) at ${ns(queued)} while drv holds the only key, so it waits in the semaphore's FIFO queue (§15.3.3). drv's put(1) at ${ns(irqStart)} hands it the key.`;
    if (t === queued) return `irq asks at ${ns(queued)}, but drv holds the only key until its third write ends. get() blocks until the key is available (§15.3.3).`;
    if (t === undefined) return "drv returns the key on every path out of bus_write, so the waiting irq is served (§15.3.2, §15.3.3).";
    return `Earlier: irq is first in the queue, so drv's put(1) at ${ns(irqStart)} wakes it at once (§15.3.3).`;
  };
  const choices = (values: (number | undefined)[]) => [...new Set(values)];
  return [
    {
      id: "put3",
      question: "When does gen print “put 3”?",
      options: choices([0, 10, 20, undefined]).map((t) => ({ id: ns(t), label: t === undefined ? "Never" : `t = ${t} ns`, correct: t === put3, feedback: put3Feedback(t) })),
    },
    {
      id: "irq",
      question: `irq calls bus_write at ${IRQ_AT_NS} ns. When does it print “write 99 start”?`,
      options: choices([IRQ_AT_NS, 30, 40, undefined]).map((t) => ({ id: ns(t), label: t === undefined ? "Never" : `t = ${t} ns`, correct: t === irqStart, feedback: irqFeedback(t) })),
    },
  ];
}

export interface StopPoint {
  line: string;
  end: number;
}

/** Where a run's log stops and when the run ends. */
export function stopPoint(result: SimResult): StopPoint {
  const last = result.log[result.log.length - 1];
  return { line: last ? logLineText(last) : "(nothing printed)", end: result.endTime };
}

/** The two key bugs share one question; its options come from both runs, so each bug's answer is the other's distractor. */
function stopQuestion(variant: "no-put" | "new-zero", options: BenchOptions): BenchQuestion {
  const runs = (["no-put", "new-zero"] as const).map((vt) => ({ vt, result: simulateProcesses(benchScenario(vt, options)) }));
  const mine = runs.find((r) => r.vt === variant)?.result as SimResult;
  const actual = stopPoint(mine);
  const lastTime = mine.log[mine.log.length - 1]?.time ?? 0;
  const candidates: StopPoint[] = [];
  const add = (p: StopPoint) => {
    if (!candidates.some((q) => q.line === p.line && q.end === p.end)) candidates.push(p);
  };
  runs.forEach((r) => add(stopPoint(r.result)));
  add({ line: actual.line, end: lastTime });
  const feedback = (p: StopPoint): string => {
    if (p.line === actual.line && p.end === actual.end) return endingSentence(mine);
    if (p.line === actual.line)
      return mine.outcome.kind === "finish"
        ? `The last line is right, but the run does not end when the last line prints: the free-running clock always has a next wake-up, so the simulation stays busy (§9.6.1). ${endingSentence(mine)}`
        : `The last line is right, but the run does not end when the last line prints: irq is still booked to wake at ${IRQ_AT_NS} ns. ${endingSentence(mine)}`;
    return `That is where the other bug stops. ${variant === "no-put" ? "Here the bucket starts with one key, so drv's first write runs; the key is never returned (§15.3.2)." : "Here the bucket starts empty (§15.3.1), so drv blocks on its very first write."}`;
  };
  return {
    id: "stop",
    question: "Where does the log stop, and when does the run end?",
    options: [
      ...candidates.map((p, i) => ({ id: `p${i}`, label: `After “${p.line}”, ending at ${p.end} ns`, correct: p.line === actual.line && p.end === actual.end, feedback: feedback(p) })),
      {
        id: "hang",
        label: "It never ends: the blocked processes keep it running",
        correct: false,
        feedback: `Blocked processes are not activity. ${endingSentence(mine)}`,
      },
    ],
  };
}

export type PassVerdict = "always" | "never" | "depends";

export const PASS_VERDICT_LABELS: Readonly<Record<PassVerdict, string>> = {
  always: "Yes, in every order",
  never: "No, never",
  depends: "It depends on the process order",
};

/** Whether PASS prints in every explored order, in none, or in some. */
export function passVerdict(exploration: ProcessExploration): PassVerdict {
  const withPass = exploration.outcomes.filter((g) => passed(g.result)).length;
  if (withPass === exploration.outcomes.length) return "always";
  return withPass === 0 ? "never" : "depends";
}

/** When a process triggers an event in a run, if it does. */
export function triggerTime(result: SimResult, event: string): number | undefined {
  return result.trace.find((s) => s.kind === "exec" && s.what.includes(` triggers ${event}.`))?.time;
}

function lateWaitQuestion(result: SimResult, exploration: ProcessExploration): BenchQuestion {
  const verdict = passVerdict(exploration);
  const groupsWithPass = exploration.outcomes.filter((g) => passed(g.result));
  const ordersWithPass = groupsWithPass.reduce((n, g) => n + g.runs.length, 0);
  const at = triggerTime(result, "drv_done");
  const why = `At ${ns(at)} drv's last #10 and chk's #${LATE_WAIT_NS} both expire, so both are ready and the simulator may run either first (§4.7). If drv runs first, its -> drv_done fires before chk reaches @(drv_done), and chk misses it (§15.5.2).`;
  const counts = `${ordersWithPass} of the ${exploration.runCount} orders the model ran print PASS${exploration.capped ? " (the exploration stopped at its cap, so more orders exist)" : ""}.`;
  return {
    id: "pass",
    question: "Does PASS print?",
    options: (["always", "never", "depends"] as const).map((id) => ({
      id,
      label: PASS_VERDICT_LABELS[id],
      correct: id === verdict,
      feedback: id === verdict ? `${why} ${counts}` : `${id === "always" ? "Not in every order." : id === "never" ? "It can print." : ""} ${why} ${counts}`.trim(),
    })),
  };
}

export interface BenchStory {
  variant: BenchVariant;
  advanced: boolean;
  scenario: ProcessScenario;
  /** The declaration-order run the scrubber steps through, as presentBenchRun shows it. */
  result: SimResult;
  /** Every order of the ready processes (only for the race variant, where the order changes the outcome). */
  exploration?: ProcessExploration;
  questions: BenchQuestion[];
}

export function benchStory(variant: BenchVariant, options: BenchOptions = {}): BenchStory {
  const scenario = benchScenario(variant, options);
  const result = presentBenchRun(simulateProcesses(scenario));
  const exploration = variant === "late-wait" ? exploreBench(scenario) : undefined;
  const questions =
    variant === "as-written" ? asWrittenQuestions(result) : variant === "late-wait" ? [lateWaitQuestion(result, exploration as ProcessExploration)] : [stopQuestion(variant, options)];
  return { variant, advanced: options.advanced ?? false, scenario, result, exploration, questions };
}

/* ------------------------------------------------------------------------- */
/* The same-time semaphore program.                                           */
/* ------------------------------------------------------------------------- */

export type SameTimeVariant = "shared-key" | "owner";

/** When B and C ask, when the bus comes free, and how long each holder keeps it, in ns. */
export const SAME_TIME_TIMING = { arriveNs: 2, releaseNs: 10, holdNs: 5 } as const;
const { arriveNs, releaseNs, holdNs } = SAME_TIME_TIMING;

export const SAME_TIME_VARIANT_LABELS: Readonly<Record<SameTimeVariant, string>> = {
  "shared-key": `B and C call get at ${SAME_TIME_TIMING.arriveNs} ns`,
  owner: "Requests through one owner",
};

/** Requester ids carried in the owner variant's request mailbox. */
export const REQUESTER_IDS = { B: 1, C: 2 } as const;

/**
 * shared-key: A holds the one key until 10 ns; B and C both call get(1) at 2 ns.
 * owner: B and C put their id into an unbounded request mailbox; one owner
 * process takes both requests and grants by a fixed rule (lowest id first).
 */
export function sameTimeScenario(variant: SameTimeVariant = "shared-key"): ProcessScenario {
  if (variant === "owner") {
    const requester = (who: "B" | "C"): ProcessDef => ({
      id: who,
      label: who,
      kind: "initial",
      body: [
        after(`${who}-req`, arriveNs, { id: `${who}-put`, kind: "mailbox", op: "put", mailbox: "req", value: { kind: "const", value: REQUESTER_IDS[who], label: String(REQUESTER_IDS[who]) } }, `request: id ${REQUESTER_IDS[who]}`),
        { id: `${who}-wait`, kind: "waitCond", cond: bin("==", v("grant"), c(REQUESTER_IDS[who])) },
        display(`${who}-got`, `${who} ${GOT_TEXT.owner}`),
      ],
    });
    return {
      id: "same-time:owner",
      title: "One owner decides",
      vars: [
        { name: "a", type: "int", init: 0 },
        { name: "b", type: "int", init: 0 },
        { name: "t", type: "int", init: 0 },
        { name: "grant", type: "int", init: 0, comment: "id of the process allowed on the bus" },
      ],
      mailboxes: [{ name: "req", bound: 0 }],
      processes: [
        {
          id: "owner",
          label: "owner",
          kind: "initial",
          body: [
            after("own-busy", releaseNs, undefined, `the bus is busy until ${releaseNs} ns, as A held it`),
            { id: "own-get-a", kind: "mailbox", op: "get", mailbox: "req", target: "a", comment: `both requests arrived at ${arriveNs} ns` },
            { id: "own-get-b", kind: "mailbox", op: "get", mailbox: "req", target: "b" },
            {
              id: "own-sort",
              kind: "if",
              cond: bin(">", v("a"), v("b")),
              comment: "the policy: lowest id first, whatever the arrival order",
              then: [
                { id: "own-t", kind: "assign", target: "t", expr: v("a") },
                { id: "own-a", kind: "assign", target: "a", expr: v("b") },
                { id: "own-b", kind: "assign", target: "b", expr: v("t") },
              ],
            },
            { id: "own-grant-a", kind: "assign", target: "grant", expr: v("a") },
            after("own-hold", holdNs, { id: "own-grant-b", kind: "assign", target: "grant", expr: v("b") }, `the first holder uses the bus for ${holdNs} ns`),
          ],
        },
        requester("B"),
        requester("C"),
      ],
    };
  }
  const contender = (who: "B" | "C"): ProcessDef => ({
    id: who,
    label: who,
    kind: "initial",
    body: [
      after(`${who}-wait`, arriveNs, { id: `${who}-get`, kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }, `arrives at ${arriveNs} ns`),
      display(`${who}-got`, `${who} ${GOT_TEXT["shared-key"]}`),
      after(`${who}-hold`, holdNs, { id: `${who}-put`, kind: "semaphore", op: "put", semaphore: "sem", keys: 1 }),
    ],
  });
  return {
    id: "same-time:shared-key",
    title: "Two waiters arrive in one time slot",
    semaphores: [{ name: "sem", keys: 1 }],
    processes: [
      { id: "A", label: "A", kind: "initial", body: [{ id: "A-get", kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }, after("A-hold", releaseNs, { id: "A-put", kind: "semaphore", op: "put", semaphore: "sem", keys: 1 })] },
      contender("B"),
      contender("C"),
    ],
  };
}

export type FirstAt10 = "B" | "C" | "depends";

export const FIRST_AT_10_LABELS: Readonly<Record<FirstAt10, string>> = { B: "B", C: "C", depends: "It depends on the process order" };

/** What a contender prints when it may use the bus: the semaphore's key, or the owner's grant (the owner variant has no key). */
export const GOT_TEXT: Readonly<Record<SameTimeVariant, string>> = { "shared-key": "got the key", owner: "got the bus" };

/** Who prints "got the key" (or, in the owner variant, "got the bus") at 10 ns in one run. */
export function firstGotAt(result: SimResult, t: number): "B" | "C" | undefined {
  const line = result.log.find((l) => l.time === t && (l.text.endsWith(GOT_TEXT["shared-key"]) || l.text.endsWith(GOT_TEXT.owner)));
  return line?.label === "B" || line?.label === "C" ? line.label : undefined;
}

export interface SameTimeStory {
  variant: SameTimeVariant;
  scenario: ProcessScenario;
  result: SimResult;
  exploration: ProcessExploration;
  verdict: FirstAt10;
  question: BenchQuestion;
  /** Queue order at the moment both contenders have arrived, per outcome group (shared-key only). */
  queues: string[][];
}

export function sameTimeStory(variant: SameTimeVariant = "shared-key"): SameTimeStory {
  const scenario = sameTimeScenario(variant);
  const result = presentBenchRun(simulateProcesses(scenario));
  const exploration = exploreBench(scenario);
  const firsts = [...new Set(exploration.outcomes.map((g) => firstGotAt(g.result, releaseNs)))];
  const verdict: FirstAt10 = firsts.length === 1 && firsts[0] ? firsts[0] : "depends";
  const queues = exploration.outcomes.map((g) => {
    const step = g.result.trace.find((s) => (s.semaphores.sem?.waiters.length ?? 0) === 2);
    return step ? step.semaphores.sem.waiters.map((w) => w.label) : [];
  });
  const groups = exploration.outcomes.length;
  const why =
    variant === "owner"
      ? `The owner takes both requests and grants by its own rule (lowest id first), so whichever request arrived first, B is granted at ${ns(printTime(result, "B", `B ${GOT_TEXT.owner}`))} and C at ${ns(printTime(result, "C", `C ${GOT_TEXT.owner}`))}. Every one of the ${exploration.runCount} orders the model ran gives the same time-stamped log. Same-time put() calls still arrive in a simulator-chosen order (§4.7); the owner's rule makes that order irrelevant.`
      : `The queue is FIFO (§15.3.3), but B and C arrive in the same time slot, and §15.3.3 "does not guarantee the order in which processes arrive at the queue". The simulator may run either first (§4.7). The model ran ${exploration.runCount} orders and found ${groups} outcome${groups === 1 ? "" : "s"}.`;
  const question: BenchQuestion = {
    id: "first",
    question: `The bus comes free at ${releaseNs} ns. Who prints “${GOT_TEXT[variant]}” first?`,
    options: (["B", "C", "depends"] as const).map((id) => ({
      id,
      label: FIRST_AT_10_LABELS[id],
      correct: id === verdict,
      feedback: id === verdict ? why : `${id === "depends" ? "Not here." : verdict === "depends" ? `Not always ${id}.` : `Not ${id}: in every order the model ran, ${verdict} is first.`} ${why}`,
    })),
  };
  return { variant, scenario, result, exploration, verdict, question, queues };
}

/* ------------------------------------------------------------------------- */
/* Limits shown under "Assumptions and limits".                               */
/* ------------------------------------------------------------------------- */

/** Shown in every mode whose trace can contain a bounded mailbox's put() hand-off. */
export const HANDOFF_REGROUP_ASSUMPTION =
  "The engine completes a producer's suspended put() inside the get() that frees the slot. The steps shown are regrouped to follow §15.4.3: the get leaves the slot empty and the producer ready, and the producer's own step stores its message when it resumes. Times, the log and every outcome are the engine's; only the order of steps inside one time stamp is regrouped. If another statement uses that mailbox before the producer resumes, the hand-off is shown as the engine runs it, and that step says so.";

export const BENCH_ASSUMPTIONS: readonly string[] = [
  "The log shows each line as time stamp, process and text. The lesson prints the same columns with %0t and %s; the model's values are numbers, so bus_write takes only the data, and the caller's name is the process that runs the task. For the same reason the code's strings leave out the lesson's leading time stamp and process name: the lesson's $error(\"chk: drv sent %0d items, expected 3\") appears as $error(\"drv sent %0d items, expected 3\"), and the log's process column adds chk back.",
  HANDOFF_REGROUP_ASSUMPTION,
  "The code shows for (int i = 1; i < 4; i++) for the lesson's i <= 3 (the same iterations), and new(0) for the lesson's new (the same default keyCount, §15.3.1).",
  `Order exploration (the #30 change and the same-time program) runs every order of the processes ready at one time, each until it blocks or ends, up to ${BENCH_MAX_RUNS} orders. A capped result says so and claims nothing about the orders it did not run.`,
  `With the clock and watchdog switched on, the clock always has a next wake-up, so the run is never out of activity: it continues to the watchdog's $finish at ${WATCHDOG_NS} ns (§9.6.1, §20.2).`,
  "$error is modelled as printing its message and returning (§20.10); the tool's own prefix, file, line and time are not shown. No bench change here reaches that branch: chk either passes or stays blocked in @(drv_done).",
];
