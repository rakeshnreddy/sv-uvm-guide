/**
 * Deterministic educational model of the UVM sequence ↔ sequencer ↔ driver
 * handshake and of sequencer arbitration.
 *
 * Every rule below was checked against the uvm-core 2020.3.1 reference
 * implementation (IEEE 1800.2-2020). Clause numbers come from the
 * `@uvm-ieee 1800.2-2020 auto X.Y.Z` annotations in that source.
 *
 * Sequence side (src/seq/uvm_sequence_base.svh):
 * - start_item() calls sequencer.wait_for_grant(this, priority) and then
 *   pre_do(1) (14.2.6.2). It blocks until the sequencer grants the request.
 * - finish_item() calls mid_do(item), send_request(), wait_for_item_done(),
 *   then post_do(item) (14.2.6.3). It blocks until the driver's item_done().
 * - The response queue holds response_queue_depth = 8 entries. On overflow
 *   put_base_response() drops the response; it reports
 *   "Response queue overflow, response was dropped" only when
 *   response_queue_error_report_enabled is set, and that bit has no
 *   initializer in 2020.3.1 (14.2.7.5, 14.2.7.7).
 * - start() priority -1 means 100 for a root sequence (14.2.3.1).
 *
 * Sequencer side (src/seq/uvm_sequencer_base.svh, uvm_sequencer.svh,
 * uvm_sequencer_param_base.svh):
 * - wait_for_grant() pushes a SEQ_TYPE_REQ to the back of arb_sequence_q.
 * - Arbitration (m_select_sequence → m_choose_next_request) only runs when
 *   the driver asks for an item, after wait_for_sequences() lets every
 *   request made in the same time step reach the queue.
 * - m_choose_next_request() first calls grant_queued_locks(), then keeps
 *   only SEQ_TYPE_REQ entries whose sequence is not is_blocked(). FIFO
 *   returns the first; with one candidate no draw is made; WEIGHTED draws
 *   $urandom_range(sum-1,0) over priorities; RANDOM draws uniformly;
 *   STRICT_FIFO / STRICT_RANDOM keep only the highest priority and take the
 *   first / a random one (15.3.2.19 set_arbitration; default FIFO).
 * - lock() pushes a SEQ_TYPE_LOCK to the back, grab() pushes it to the front,
 *   then grant_queued_locks() grants the first lock request in the queue
 *   whose sequence is not blocked (15.3.2.10, 15.3.2.11). A granted lock or
 *   grab stays in lock_list until unlock()/ungrab(); unlocking without a lock
 *   reports SQRUNL.
 * - is_blocked() is true when lock_list holds a sequence other than this one
 *   (or one of its ancestors) (15.3.2.8).
 * - When a sequence exits while still holding a lock,
 *   remove_sequence_from_queues() reports SEQFINERR and removes the lock.
 * - get_next_item() called again without item_done() reports
 *   "Get_next_item called twice without item_done or get in between" and,
 *   because an item is already requested, peeks the same item again
 *   (15.2.1.2.1, m_safe_select_item).
 * - item_done() removes the item from the request FIFO, wakes
 *   wait_for_item_done(), forwards an optional response, and calls
 *   grant_queued_locks() (15.2.1.2.3).
 * - put_response() with sequence_id == -1 (no rsp.set_id_info(req)) is the
 *   fatal SQRPUT "Driver put a response with null sequence_id" (15.2.1.2.9).
 *
 * Model simplifications (shown to learners):
 * - Time is in ns; each item takes `driveNs` to drive.
 * - Sequences that become ready at the same time run in the listed order.
 *   Real simulators may pick any order, so the presets stagger start times.
 * - Random modes use a seeded LCG, not the simulator's $urandom. The
 *   distribution matches; the exact sequence of picks does not.
 * - is_relevant() is always 1, there is no SEQ_ARB_USER, and sequences in a
 *   scenario are not parent/child of each other.
 */

export const ARB_MODES = [
  "UVM_SEQ_ARB_FIFO",
  "UVM_SEQ_ARB_WEIGHTED",
  "UVM_SEQ_ARB_RANDOM",
  "UVM_SEQ_ARB_STRICT_FIFO",
  "UVM_SEQ_ARB_STRICT_RANDOM",
] as const;

export type ArbMode = (typeof ARB_MODES)[number];

export const ARB_MODE_INFO: Record<ArbMode, { short: string; rule: string; random: boolean }> = {
  UVM_SEQ_ARB_FIFO: {
    short: "FIFO",
    rule: "Grant the oldest unblocked request. Priority is ignored. This is the default.",
    random: false,
  },
  UVM_SEQ_ARB_WEIGHTED: {
    short: "WEIGHTED",
    rule: "Random pick among unblocked requests; each request's chance is its priority divided by the sum of priorities.",
    random: true,
  },
  UVM_SEQ_ARB_RANDOM: {
    short: "RANDOM",
    rule: "Uniform random pick among unblocked requests. Priority is ignored.",
    random: true,
  },
  UVM_SEQ_ARB_STRICT_FIFO: {
    short: "STRICT_FIFO",
    rule: "Keep only the highest-priority unblocked requests, then grant the oldest of them.",
    random: false,
  },
  UVM_SEQ_ARB_STRICT_RANDOM: {
    short: "STRICT_RANDOM",
    rule: "Keep only the highest-priority unblocked requests, then pick one of them uniformly at random.",
    random: true,
  },
};

/** uvm_sequence_base: response_queue_depth = 8 (14.2.7.7). */
export const DEFAULT_RESPONSE_QUEUE_DEPTH = 8;
/** uvm_sequence_base::start(): root sequences with priority -1 get 100 (14.2.3.1). */
export const DEFAULT_SEQUENCE_PRIORITY = 100;

// ── Seeded random numbers ────────────────────────────────────────────────

export interface Rng {
  /** Mirrors $urandom_range(max, min): an integer in [min, max]. */
  urandomRange(max: number, min?: number): number;
  readonly draws: number;
}

/** murmur3 fmix32: spreads nearby seeds (1, 2, 3…) across the whole state space. */
function mixSeed(seed: number): number {
  let h = seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Small LCG (Numerical Recipes constants) on a mixed seed. Uses the high bits to avoid short low-bit cycles. */
export function createRng(seed: number): Rng {
  let state = mixSeed(seed) || 0x9e3779b9;
  let draws = 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    draws += 1;
    return state / 4294967296;
  };
  return {
    urandomRange(max: number, min = 0) {
      const span = max - min + 1;
      return min + Math.floor(next() * span);
    },
    get draws() {
      return draws;
    },
  };
}

// ── Scenario description ─────────────────────────────────────────────────

export type SeqOp =
  | { kind: "item"; priority?: number }
  | { kind: "lock" }
  | { kind: "grab" }
  | { kind: "unlock" }
  | { kind: "ungrab" }
  | { kind: "wait"; ns: number }
  | { kind: "get_response" };

export interface SequenceSpec {
  /** Short id used in item labels, e.g. "A" → items A1, A2. */
  id: string;
  /** SystemVerilog instance name, e.g. "seq_a". */
  name: string;
  /** Priority passed to start(); default 100. */
  priority: number;
  /** Simulation time (ns) at which start() is called. */
  startAt: number;
  ops: SeqOp[];
}

/** What the driver does after driving an item. */
export type DriverCompletion =
  | "item_done"
  | "item_done_rsp"
  | "put_response"
  | "none";

export interface DriverSpec {
  driveNs: number;
  completion: DriverCompletion;
  /** Responses copy the request's ids with rsp.set_id_info(req). */
  setIdInfo: boolean;
  /** BUG: calls get_next_item twice per loop (look-ahead without item_done). */
  doubleGet: boolean;
}

export interface SequencerScenario {
  mode: ArbMode;
  seed: number;
  sequences: SequenceSpec[];
  driver: DriverSpec;
  responseQueueDepth?: number;
  /** set_response_queue_error_report_enabled(1). Default 0 in uvm-core 2020.3.1. */
  responseQueueErrorReport?: boolean;
  /** Stop the run (and call it a hang) after this time. */
  maxTimeNs?: number;
}

export const DEFAULT_DRIVER: DriverSpec = { driveNs: 10, completion: "item_done", setIdInfo: true, doubleGet: false };

// ── Run results ──────────────────────────────────────────────────────────

export type Lane = "seq" | "sqr" | "drv";

export type SeqStatus =
  | "not-started"
  | "running"
  | "wait-grant"
  | "wait-lock"
  | "wait-item-done"
  | "wait-response"
  | "delay"
  | "finished";

export type Severity = "INFO" | "WARNING" | "ERROR" | "FATAL";

export interface UvmLogLine {
  time: number;
  severity: Severity;
  id: string;
  text: string;
}

export interface QueueEntryView {
  kind: "REQ" | "LOCK";
  seqId: string;
  priority: number;
  /** For LOCK entries: whether it came from grab() (front of queue). */
  grab?: boolean;
  queuedAt: number;
}

export interface SeqView {
  id: string;
  status: SeqStatus;
  /** Human-readable "where is it" sentence. */
  where: string;
  item?: string;
  holdsLock: boolean;
}

export interface DriverView {
  status: "idle" | "get" | "driving" | "stopped";
  where: string;
  item?: string;
}

export interface SqrStep {
  index: number;
  time: number;
  actor: Lane;
  seqId?: string;
  what: string;
  why: string;
  /** Line key in the sequence source that is executing. */
  seqCode?: string;
  /** Line key in the driver source that is executing. */
  drvCode?: string;
  message?: { from: Lane; to: Lane; label: string };
  sequences: SeqView[];
  queue: QueueEntryView[];
  lockList: string[];
  fifo: string | null;
  driver: DriverView;
  responses: Record<string, number>;
  log?: UvmLogLine;
  decisionIndex?: number;
}

export type CandidateOutcome = "won" | "lost" | "blocked" | "absent";

export interface ArbCandidate {
  seqId: string;
  outcome: CandidateOutcome;
  reason: string;
  /** Chance of winning this decision under the mode's rule (0..1). */
  chance: number;
}

export interface ArbDecision {
  /** Grant number, 1-based. */
  index: number;
  time: number;
  mode: ArbMode;
  queue: QueueEntryView[];
  lockList: string[];
  winner: string;
  item: string;
  /** Number of unblocked requests the rule chose from. */
  available: number;
  candidates: ArbCandidate[];
  draw?: { value: number; max: number };
  why: string;
}

export interface DrivenSpan {
  seqId: string;
  item: string;
  start: number;
  end: number;
  /** >1 when the same item is driven again (missing item_done, double get). */
  pass: number;
}

export interface LockSpan {
  seqId: string;
  kind: "lock" | "grab";
  start: number;
  end?: number;
}

export type OutcomeKind = "complete" | "hang" | "fatal" | "timeout";

export interface BlockedSequence {
  seqId: string;
  where: string;
  since: number;
}

export interface SequencerRun {
  steps: SqrStep[];
  decisions: ArbDecision[];
  driven: DrivenSpan[];
  lockSpans: LockSpan[];
  log: UvmLogLine[];
  responses: Record<string, { received: number; dropped: number; collected: number }>;
  outcome: { kind: OutcomeKind; time: number; summary: string; blocked: BlockedSequence[] };
  rngDraws: number;
}

// ── Engine internals ─────────────────────────────────────────────────────

interface ArbEntry {
  requestId: number;
  kind: "REQ" | "LOCK";
  seqId: string;
  priority: number;
  grab?: boolean;
  queuedAt: number;
}

interface ItemRef {
  seqId: string;
  n: number;
  label: string;
}

interface SeqRt {
  spec: SequenceSpec;
  pc: number;
  status: SeqStatus;
  phase?: "requested" | "granted" | "done";
  wakeAt?: number;
  itemsMade: number;
  current?: ItemRef;
  responseQueue: string[];
  received: number;
  dropped: number;
  collected: number;
  since: number;
}

interface DrvRt {
  status: "idle" | "get" | "driving" | "stopped";
  item?: ItemRef;
  until?: number;
  itemRequested: boolean;
  getCalled: boolean;
  passes: Map<string, number>;
  waitingSignature?: string;
}

function whereOf(rt: SeqRt): string {
  const item = rt.current?.label;
  switch (rt.status) {
    case "not-started":
      return `not started (start() at t = ${rt.spec.startAt} ns)`;
    case "running":
      return "running body()";
    case "wait-grant":
      return `blocked in start_item(${item}): waiting for a grant`;
    case "wait-lock":
      return "blocked in lock()/grab(): waiting for the lock";
    case "wait-item-done":
      return `blocked in finish_item(${item}): waiting for item_done()`;
    case "wait-response":
      return "blocked in get_response(): no response yet";
    case "delay":
      return `busy in body() until t = ${rt.wakeAt} ns`;
    case "finished":
      return "finished: body() returned";
  }
}

/**
 * Runs a scenario to completion, hang, fatal or timeout and returns full
 * snapshots for every step, every arbitration decision, and the UVM log.
 */
export function simulateSequencer(scenario: SequencerScenario): SequencerRun {
  const depth = scenario.responseQueueDepth ?? DEFAULT_RESPONSE_QUEUE_DEPTH;
  const reportOverflow = scenario.responseQueueErrorReport ?? false;
  const maxTime = scenario.maxTimeNs ?? 400;
  const rng = createRng(scenario.seed);
  const drvSpec = scenario.driver;

  const seqs: SeqRt[] = scenario.sequences.map((spec) => ({
    spec,
    pc: 0,
    status: "not-started",
    itemsMade: 0,
    responseQueue: [],
    received: 0,
    dropped: 0,
    collected: 0,
    since: 0,
  }));
  const byId = new Map(seqs.map((s) => [s.spec.id, s]));
  const arbQ: ArbEntry[] = [];
  const lockList: string[] = [];
  const lockKinds = new Map<string, "lock" | "grab">();
  let fifo: ItemRef | null = null;
  const drv: DrvRt = { status: "idle", itemRequested: false, getCalled: false, passes: new Map() };
  let nextRequestId = 0;
  let t = 0;
  let stopped: { kind: OutcomeKind; summary: string } | null = null;

  const steps: SqrStep[] = [];
  const decisions: ArbDecision[] = [];
  const driven: DrivenSpan[] = [];
  const lockSpans: LockSpan[] = [];
  const log: UvmLogLine[] = [];

  const queueView = (): QueueEntryView[] =>
    arbQ.map((e) => ({ kind: e.kind, seqId: e.seqId, priority: e.priority, grab: e.grab, queuedAt: e.queuedAt }));

  const driverView = (): DriverView => {
    switch (drv.status) {
      case "idle":
        return { status: "idle", where: "not yet in run_phase loop" };
      case "get":
        return drv.itemRequested && fifo
          ? { status: "get", where: `in get_next_item(): ${fifo.label} is still in the FIFO`, item: fifo.label }
          : { status: "get", where: "blocked in get_next_item(): waiting for an item" };
      case "driving":
        return { status: "driving", where: `driving ${drv.item?.label} until t = ${drv.until} ns`, item: drv.item?.label };
      case "stopped":
        return { status: "stopped", where: "stopped" };
    }
  };

  const emit = (step: Omit<SqrStep, "index" | "time" | "sequences" | "queue" | "lockList" | "fifo" | "driver" | "responses">) => {
    steps.push({
      ...step,
      index: steps.length,
      time: t,
      sequences: seqs.map((s) => ({
        id: s.spec.id,
        status: s.status,
        where: whereOf(s),
        item: s.current?.label,
        holdsLock: lockList.includes(s.spec.id),
      })),
      queue: queueView(),
      lockList: [...lockList],
      fifo: fifo?.label ?? null,
      driver: driverView(),
      responses: Object.fromEntries(seqs.map((s) => [s.spec.id, s.responseQueue.length])),
    });
    if (step.log) log.push(step.log);
  };

  const logLine = (severity: Severity, id: string, text: string): UvmLogLine => ({ time: t, severity, id, text });

  const isBlocked = (seqId: string) => lockList.some((owner) => owner !== seqId);

  /** uvm_sequencer_base::grant_queued_locks(): grant the first lock request that is not blocked. */
  const grantQueuedLocks = (): boolean => {
    const idx = arbQ.findIndex((e) => e.kind === "LOCK" && !isBlocked(e.seqId));
    if (idx < 0) return false;
    const entry = arbQ[idx];
    arbQ.splice(idx, 1);
    lockList.push(entry.seqId);
    const kind = entry.grab ? "grab" : "lock";
    lockKinds.set(entry.seqId, kind);
    lockSpans.push({ seqId: entry.seqId, kind, start: t });
    const rt = byId.get(entry.seqId);
    if (rt) {
      rt.status = "running";
      rt.phase = "granted";
    }
    emit({
      actor: "sqr",
      seqId: entry.seqId,
      what: `grant_queued_locks(): ${entry.seqId}'s ${kind}() is granted; ${entry.seqId} joins lock_list.`,
      why: `No other sequence is in lock_list, so ${entry.seqId} is not blocked. From now on is_blocked() is true for every other sequence until ${entry.seqId} calls ${kind === "grab" ? "ungrab" : "unlock"}().`,
      message: { from: "sqr", to: "seq", label: `${kind} granted` },
    });
    return true;
  };

  const releaseLock = (seqId: string) => {
    const i = lockList.indexOf(seqId);
    if (i >= 0) lockList.splice(i, 1);
    const span = [...lockSpans].reverse().find((s) => s.seqId === seqId && s.end === undefined);
    if (span) span.end = t;
    lockKinds.delete(seqId);
  };

  const stop = (kind: OutcomeKind, summary: string) => {
    stopped = { kind, summary };
    drv.status = "stopped";
  };

  // ── Sequence execution ──

  const finishSequence = (rt: SeqRt) => {
    rt.status = "finished";
    rt.current = undefined;
    emit({
      actor: "seq",
      seqId: rt.spec.id,
      what: `${rt.spec.name}.body() returns; start() finishes.`,
      why: "start() ends with clean_exit_sequence(), which removes the sequence from the sequencer's queues (m_sequence_exiting).",
      seqCode: "end",
    });
    for (let i = arbQ.length - 1; i >= 0; i -= 1) if (arbQ[i].seqId === rt.spec.id) arbQ.splice(i, 1);
    if (lockList.includes(rt.spec.id)) {
      const kind = lockKinds.get(rt.spec.id) ?? "lock";
      releaseLock(rt.spec.id);
      emit({
        actor: "sqr",
        seqId: rt.spec.id,
        what: `${rt.spec.id} finished while still holding its ${kind}; the sequencer removes it and reports SEQFINERR.`,
        why: `remove_sequence_from_queues() deletes a finished sequence's locks with an error. Until this moment every other sequence was blocked: forgetting ${kind === "grab" ? "ungrab" : "unlock"}() starves the sequencer for as long as the owner is alive.`,
        log: logLine(
          "ERROR",
          "SEQFINERR",
          `Parent sequence '${rt.spec.name}' should not finish before locks from itself and descedent sequences are removed.`,
        ),
      });
      grantQueuedLocks();
    }
  };

  const runSequence = (rt: SeqRt): boolean => {
    let progressed = false;
    if (rt.status === "not-started" && rt.spec.startAt <= t) {
      rt.status = "running";
      progressed = true;
      emit({
        actor: "seq",
        seqId: rt.spec.id,
        what: `${rt.spec.name}.start(sqr${rt.spec.priority !== DEFAULT_SEQUENCE_PRIORITY ? `, null, ${rt.spec.priority}` : ""}) begins; body() runs.`,
        why: `start() sets the sequence priority to ${rt.spec.priority}${rt.spec.priority === DEFAULT_SEQUENCE_PRIORITY ? " (the default for a root sequence)" : ""}. Only priority-aware modes use it.`,
        seqCode: "start",
      });
    }
    if (rt.status === "delay" && rt.wakeAt !== undefined && rt.wakeAt <= t) {
      rt.status = "running";
      rt.wakeAt = undefined;
      progressed = true;
    }
    let guard = 0;
    while (rt.status === "running" && !stopped && guard < 50) {
      guard += 1;
      progressed = true;
      const op = rt.spec.ops[rt.pc];
      if (!op) {
        finishSequence(rt);
        break;
      }
      switch (op.kind) {
        case "item": {
          if (rt.phase === undefined) {
            rt.itemsMade += 1;
            rt.current = { seqId: rt.spec.id, n: rt.itemsMade, label: `${rt.spec.id}${rt.itemsMade}` };
            const priority = op.priority ?? rt.spec.priority;
            arbQ.push({ requestId: nextRequestId++, kind: "REQ", seqId: rt.spec.id, priority, queuedAt: t });
            rt.status = "wait-grant";
            rt.phase = "requested";
            rt.since = t;
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `${rt.spec.id} calls start_item(${rt.current.label}): wait_for_grant() queues a request and blocks.`,
              why: "start_item() cannot return until the sequencer grants this request, and the sequencer only arbitrates when the driver asks for an item.",
              seqCode: "start_item",
              message: { from: "seq", to: "sqr", label: "request" },
            });
          } else if (rt.phase === "granted") {
            const label = rt.current?.label ?? "?";
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `start_item() returns; ${rt.spec.id} randomizes ${label} now, after the grant.`,
              why: "Randomizing after the grant (late randomization) lets constraints see the latest testbench state.",
              seqCode: "randomize",
            });
            fifo = rt.current ?? null;
            rt.status = "wait-item-done";
            rt.since = t;
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `finish_item(${label}): send_request() puts ${label} in the request FIFO; ${rt.spec.id} blocks in wait_for_item_done().`,
              why: "finish_item() returns only when the driver calls item_done() for this item. Handing the item over is not completion.",
              seqCode: "finish_item",
              message: { from: "seq", to: "sqr", label: `send_request(${label})` },
            });
          } else {
            // phase === "done": finish_item has returned
            rt.phase = undefined;
            rt.pc += 1;
          }
          break;
        }
        case "lock":
        case "grab": {
          if (rt.phase === undefined) {
            const entry: ArbEntry = {
              requestId: nextRequestId++,
              kind: "LOCK",
              seqId: rt.spec.id,
              priority: rt.spec.priority,
              grab: op.kind === "grab",
              queuedAt: t,
            };
            if (op.kind === "lock") arbQ.push(entry);
            else arbQ.unshift(entry);
            rt.status = "wait-lock";
            rt.phase = "requested";
            rt.since = t;
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what:
                op.kind === "lock"
                  ? `${rt.spec.id} calls lock(): a LOCK request joins the back of the arbitration queue.`
                  : `${rt.spec.id} calls grab(): a LOCK request is pushed to the front of the arbitration queue.`,
              why:
                op.kind === "lock"
                  ? "m_lock_req(lock=1) uses push_back, then immediately tries grant_queued_locks()."
                  : "m_lock_req(lock=0) uses push_front, so a grab is considered before every waiting lock.",
              seqCode: op.kind,
              message: { from: "seq", to: "sqr", label: op.kind },
            });
            grantQueuedLocks();
            if (!lockList.includes(rt.spec.id)) {
              const owner = lockList[0];
              emit({
                actor: "sqr",
                seqId: rt.spec.id,
                what: `${rt.spec.id}'s ${op.kind}() waits: ${owner} already holds the lock.`,
                why: `is_blocked(${rt.spec.id}) is true while lock_list contains ${owner}.`,
              });
            }
          } else {
            rt.phase = undefined;
            rt.pc += 1;
          }
          break;
        }
        case "unlock":
        case "ungrab": {
          if (lockList.includes(rt.spec.id)) {
            releaseLock(rt.spec.id);
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `${rt.spec.id} calls ${op.kind}(): it leaves lock_list.`,
              why: "m_unlock_req() deletes the lock and calls grant_queued_locks(), so a waiting lock or grab can take over.",
              seqCode: op.kind,
              message: { from: "seq", to: "sqr", label: op.kind },
            });
            grantQueuedLocks();
          } else {
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `${rt.spec.id} calls ${op.kind}() without holding a lock.`,
              why: "m_unlock_req() reports SQRUNL when the sequence is not in lock_list.",
              seqCode: op.kind,
              log: logLine("ERROR", "SQRUNL", `Sequence '${rt.spec.name}' called ungrab / unlock, but didn't have lock`),
            });
          }
          rt.pc += 1;
          break;
        }
        case "wait": {
          rt.status = "delay";
          rt.wakeAt = t + op.ns;
          rt.pc += 1;
          emit({
            actor: "seq",
            seqId: rt.spec.id,
            what: `${rt.spec.id} spends ${op.ns} ns in its own body (#${op.ns}ns) and queues no request.`,
            why: lockList.includes(rt.spec.id)
              ? `${rt.spec.id} still holds the lock while it waits, so nobody else can be granted.`
              : "A sequence that is not in start_item() has nothing in the arbitration queue.",
            seqCode: "wait",
          });
          break;
        }
        case "get_response": {
          if (rt.responseQueue.length > 0) {
            const rsp = rt.responseQueue.shift();
            rt.collected += 1;
            rt.pc += 1;
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `get_response() returns the response for ${rsp}.`,
              why: "The response was already waiting in this sequence's response queue (routed by its sequence_id).",
              seqCode: "get_response",
            });
          } else {
            rt.status = "wait-response";
            rt.since = t;
            emit({
              actor: "seq",
              seqId: rt.spec.id,
              what: `${rt.spec.id} blocks in get_response(): its response queue is empty.`,
              why: "get_response() waits until a response arrives. If the driver never sends one, it waits forever.",
              seqCode: "get_response",
            });
          }
          break;
        }
      }
    }
    return progressed;
  };

  const runSequences = (): boolean => {
    let any = false;
    for (const rt of seqs) {
      if (stopped) break;
      if (runSequence(rt)) any = true;
    }
    return any;
  };

  // ── Driver and sequencer ──

  const putResponse = (item: ItemRef, via: "item_done" | "put_response") => {
    if (!drvSpec.setIdInfo) {
      emit({
        actor: "drv",
        what: `The driver sends a response for ${item.label} without rsp.set_id_info(req).`,
        why: "A new rsp has sequence_id = -1, so the sequencer cannot route it to any sequence.",
        drvCode: via === "item_done" ? "item_done" : "put_response",
        log: logLine("FATAL", "SQRPUT", "Driver put a response with null sequence_id"),
      });
      stop("fatal", "UVM_FATAL SQRPUT: the response had no sequence_id because set_id_info() was not called.");
      return;
    }
    const rt = byId.get(item.seqId);
    if (!rt || rt.status === "finished") {
      emit({
        actor: "sqr",
        what: `Response for ${item.label} is dropped: its sequence has exited.`,
        why: "uvm_sequencer_param_base::put_response() cannot find the sequence id.",
        log: logLine("WARNING", "Sequencer", `Dropping response for sequence ${item.seqId}, sequence not found. Probable cause: sequence exited or has been killed`),
      });
      return;
    }
    rt.received += 1;
    if (rt.responseQueue.length < depth) {
      rt.responseQueue.push(item.label);
      emit({
        actor: "sqr",
        seqId: rt.spec.id,
        what: `Response for ${item.label} is routed to ${rt.spec.id}'s response queue (${rt.responseQueue.length}/${depth}).`,
        why: "The response carries the request's sequence_id and transaction_id (set_id_info), so the sequencer knows its owner.",
        message: { from: "drv", to: "seq", label: `rsp(${item.label})` },
      });
      if (rt.status === "wait-response") {
        rt.status = "running";
      }
    } else {
      rt.dropped += 1;
      emit({
        actor: "seq",
        seqId: rt.spec.id,
        what: `${rt.spec.id}'s response queue is full (${depth}/${depth}); the response for ${item.label} is dropped.`,
        why: reportOverflow
          ? "put_base_response() drops the response and reports an error because set_response_queue_error_report_enabled(1) was called."
          : "put_base_response() drops it silently: response_queue_error_report_enabled has no initializer in uvm-core 2020.3.1. Call set_response_queue_error_report_enabled(1) to get an error.",
        log: reportOverflow ? logLine("ERROR", rt.spec.name, "Response queue overflow, response was dropped") : undefined,
      });
    }
  };

  const itemDone = (withResponse: boolean) => {
    const item = fifo;
    drv.itemRequested = false;
    drv.getCalled = false;
    if (!item) {
      emit({
        actor: "drv",
        what: "item_done() is called with no outstanding item.",
        why: "Each item_done() must pair with an earlier get_next_item().",
        drvCode: "item_done",
        log: logLine("FATAL", "SQRBADITMDN", "Item_done() called with no outstanding requests. Each call to item_done() must be paired with a previous call to get_next_item()."),
      });
      stop("fatal", "UVM_FATAL SQRBADITMDN");
      return;
    }
    fifo = null;
    const rt = byId.get(item.seqId);
    if (rt && rt.status === "wait-item-done") {
      rt.status = "running";
      rt.phase = "done";
    }
    emit({
      actor: "drv",
      seqId: item.seqId,
      what: `item_done(${withResponse ? "rsp" : ""}): ${item.label} leaves the request FIFO; ${item.seqId}'s finish_item() returns.`,
      why: "item_done() completes the handshake: it wakes wait_for_item_done() in the sequence and frees the driver to ask for the next item.",
      drvCode: "item_done",
      message: { from: "drv", to: "seq", label: "item_done" },
    });
    if (withResponse) putResponse(item, "item_done");
    if (!stopped) grantQueuedLocks();
  };

  const startDriving = (item: ItemRef) => {
    const pass = (drv.passes.get(item.label) ?? 0) + 1;
    drv.passes.set(item.label, pass);
    const span = drvSpec.doubleGet ? 2 : 1;
    drv.item = item;
    drv.status = "driving";
    drv.until = t + drvSpec.driveNs * span;
    for (let k = 0; k < span; k += 1) {
      driven.push({
        seqId: item.seqId,
        item: item.label,
        start: t + k * drvSpec.driveNs,
        end: t + (k + 1) * drvSpec.driveNs,
        pass: pass + k,
      });
    }
    if (drvSpec.doubleGet) drv.passes.set(item.label, pass + 1);
  };

  const driverCompletion = (): boolean => {
    if (drv.status !== "driving" || drv.until === undefined || drv.until > t) return false;
    const item = drv.item;
    drv.item = undefined;
    drv.until = undefined;
    switch (drvSpec.completion) {
      case "none":
        drv.status = "get";
        emit({
          actor: "drv",
          what: `The driver finishes driving ${item?.label} but never calls item_done(); its loop goes back to get_next_item().`,
          why: `${item?.label} stays in the request FIFO and its sequence stays in finish_item().`,
          drvCode: "item_done",
        });
        return true;
      case "item_done":
        itemDone(false);
        break;
      case "item_done_rsp":
        itemDone(true);
        break;
      case "put_response":
        itemDone(false);
        if (item && !stopped) {
          emit({
            actor: "drv",
            what: `The driver calls put_response(rsp) for ${item.label}.`,
            why: "put_response() is a function: it never blocks the driver, even when nobody collects the response.",
            drvCode: "put_response",
          });
          putResponse(item, "put_response");
        }
        break;
    }
    if (!stopped) drv.status = "get";
    return true;
  };

  /** m_choose_next_request(): returns the winning queue index and the decision record. */
  const chooseNextRequest = (): { index: number; decision?: Omit<ArbDecision, "index" | "winner" | "item"> } => {
    const avail: number[] = [];
    arbQ.forEach((e, i) => {
      if (e.kind === "REQ" && !isBlocked(e.seqId)) avail.push(i);
    });
    const mode = scenario.mode;
    if (avail.length === 0) return { index: -1 };

    let chosen = -1;
    let draw: { value: number; max: number } | undefined;
    const prio = (i: number) => arbQ[i].priority;
    let highest: number[] = [];
    if (mode === "UVM_SEQ_ARB_FIFO") {
      chosen = avail[0];
    } else if (avail.length === 1) {
      chosen = avail[0];
    } else if (mode === "UVM_SEQ_ARB_WEIGHTED") {
      const sum = avail.reduce((s, i) => s + prio(i), 0);
      const temp = rng.urandomRange(sum - 1, 0);
      draw = { value: temp, max: sum - 1 };
      let acc = 0;
      for (const i of avail) {
        if (prio(i) + acc > temp) {
          chosen = i;
          break;
        }
        acc += prio(i);
      }
    } else if (mode === "UVM_SEQ_ARB_RANDOM") {
      const r = rng.urandomRange(avail.length - 1, 0);
      draw = { value: r, max: avail.length - 1 };
      chosen = avail[r];
    } else {
      let highestPri = 0;
      for (const i of avail) {
        if (prio(i) > highestPri) {
          highest = [i];
          highestPri = prio(i);
        } else if (prio(i) === highestPri) {
          highest.push(i);
        }
      }
      if (mode === "UVM_SEQ_ARB_STRICT_FIFO") {
        chosen = highest[0];
      } else {
        const r = rng.urandomRange(highest.length - 1, 0);
        draw = { value: r, max: highest.length - 1 };
        chosen = highest[r];
      }
    }

    // Theoretical chance of each available entry under this rule.
    const chanceOf = new Map<number, number>();
    if (mode === "UVM_SEQ_ARB_FIFO" || avail.length === 1) {
      avail.forEach((i) => chanceOf.set(i, i === chosen ? 1 : 0));
    } else if (mode === "UVM_SEQ_ARB_WEIGHTED") {
      const sum = avail.reduce((s, i) => s + prio(i), 0);
      avail.forEach((i) => chanceOf.set(i, prio(i) / sum));
    } else if (mode === "UVM_SEQ_ARB_RANDOM") {
      avail.forEach((i) => chanceOf.set(i, 1 / avail.length));
    } else if (mode === "UVM_SEQ_ARB_STRICT_FIFO") {
      avail.forEach((i) => chanceOf.set(i, i === chosen ? 1 : 0));
    } else {
      avail.forEach((i) => chanceOf.set(i, highest.includes(i) ? 1 / highest.length : 0));
    }

    const topPri = Math.max(...avail.map(prio));
    const candidates: ArbCandidate[] = seqs.map((rt) => {
      const id = rt.spec.id;
      const qi = arbQ.findIndex((e) => e.kind === "REQ" && e.seqId === id);
      if (qi < 0) {
        const lockWaiting = arbQ.some((e) => e.kind === "LOCK" && e.seqId === id);
        const reason =
          rt.status === "not-started"
            ? `No request yet: ${id} starts at t = ${rt.spec.startAt} ns. Arbitration only chooses among requests already queued.`
            : rt.status === "finished"
              ? `${id} has finished; it has nothing to send.`
              : rt.status === "delay"
                ? `${id} is busy in its own body until t = ${rt.wakeAt} ns, so it has no request queued.`
                : lockWaiting || rt.status === "wait-lock"
                  ? `${id} is still waiting for its lock()/grab() to be granted; it has not reached start_item().`
                  : rt.status === "wait-response"
                    ? `${id} is blocked in get_response(), not in start_item().`
                    : `${id} has no request queued right now.`;
        return { seqId: id, outcome: "absent", reason, chance: 0 };
      }
      const e = arbQ[qi];
      if (isBlocked(id)) {
        return {
          seqId: id,
          outcome: "blocked",
          reason: `${id}'s request is blocked: ${lockList.join(", ")} holds the lock, so is_blocked(${id}) is true and the request is skipped.`,
          chance: 0,
        };
      }
      const chance = chanceOf.get(qi) ?? 0;
      if (qi === chosen) {
        let reason: string;
        if (avail.length === 1) reason = `${id} has the only unblocked request, so no rule or draw is needed.`;
        else if (mode === "UVM_SEQ_ARB_FIFO") reason = `${id}'s request is the oldest unblocked one (queued at t = ${e.queuedAt} ns). FIFO ignores priority.`;
        else if (mode === "UVM_SEQ_ARB_STRICT_FIFO")
          reason = `${id} has the highest waiting priority (${e.priority}) and is the oldest request at that priority.`;
        else if (mode === "UVM_SEQ_ARB_WEIGHTED")
          reason = `${id} won the weighted draw (value ${draw?.value} of 0..${draw?.max}); its chance was ${Math.round(chance * 100)}%.`;
        else if (mode === "UVM_SEQ_ARB_RANDOM") reason = `${id} won the uniform draw; its chance was ${Math.round(chance * 100)}%.`;
        else reason = `${id} is in the highest-priority group (${e.priority}) and won the draw inside it; its chance was ${Math.round(chance * 100)}%.`;
        return { seqId: id, outcome: "won", reason, chance };
      }
      let reason: string;
      if (mode === "UVM_SEQ_ARB_FIFO") reason = `${id}'s request (queued at t = ${e.queuedAt} ns) is younger than the winner's. FIFO ignores priority${e.priority !== DEFAULT_SEQUENCE_PRIORITY ? ` (${e.priority})` : ""}.`;
      else if (mode === "UVM_SEQ_ARB_STRICT_FIFO")
        reason =
          e.priority < topPri
            ? `${id}'s priority ${e.priority} is below the highest waiting priority ${topPri}, so STRICT_FIFO does not consider it.`
            : `${id} has the same priority as the winner but queued later (t = ${e.queuedAt} ns).`;
      else if (mode === "UVM_SEQ_ARB_WEIGHTED") reason = `${id} lost the weighted draw; its chance was ${Math.round(chance * 100)}% (priority ${e.priority}).`;
      else if (mode === "UVM_SEQ_ARB_RANDOM") reason = `${id} lost the uniform draw; its chance was ${Math.round(chance * 100)}%. Priority plays no part.`;
      else
        reason =
          e.priority < topPri
            ? `${id}'s priority ${e.priority} is below ${topPri}; STRICT_RANDOM never picks it while a higher priority waits.`
            : `${id} is in the highest-priority group but lost the draw (chance ${Math.round(chance * 100)}%).`;
      return { seqId: id, outcome: "lost", reason, chance };
    });

    const winnerId = arbQ[chosen].seqId;
    const why = candidates.find((c) => c.seqId === winnerId)?.reason ?? "";
    return {
      index: chosen,
      decision: {
        time: t,
        mode,
        queue: queueView(),
        lockList: [...lockList],
        available: avail.length,
        candidates,
        draw,
        why,
      },
    };
  };

  const driverGet = (): boolean => {
    if (drv.status === "idle") {
      drv.status = "get";
      emit({
        actor: "drv",
        what: "The driver's run_phase loop calls seq_item_port.get_next_item(req).",
        why: "The driver pulls work: nothing is sent to it until it asks.",
        drvCode: "get",
        message: { from: "drv", to: "sqr", label: "get_next_item()" },
      });
      return true;
    }
    if (drv.status !== "get") return false;

    if (drv.getCalled) {
      // Second get_next_item() without item_done(): error, then the same item is peeked again.
      const item = fifo;
      emit({
        actor: "drv",
        what: `get_next_item() is called again without item_done(): UVM reports an error and returns ${item?.label ?? "the same item"} again.`,
        why: "An item is already requested, so m_safe_select_item() skips arbitration and peeks the item still sitting in the request FIFO.",
        drvCode: "get",
        log: logLine("ERROR", "uvm_test_top.env.agt.sqr", "Get_next_item called twice without item_done or get in between"),
      });
      if (item) startDriving(item);
      return true;
    }

    // First get_next_item(): arbitrate when nothing is requested yet.
    if (!drv.itemRequested) {
      grantQueuedLocks();
      const { index, decision } = chooseNextRequest();
      if (index < 0 || !decision) {
        const signature = `${queueView()
          .map((e) => `${e.kind}${e.seqId}`)
          .join(",")}|${lockList.join(",")}`;
        if (drv.waitingSignature !== signature) {
          drv.waitingSignature = signature;
          const blockedReqs = arbQ.filter((e) => e.kind === "REQ");
          if (blockedReqs.length > 0) {
            emit({
              actor: "sqr",
              what: `get_next_item() keeps waiting: every queued request is blocked by ${lockList.join(", ")}'s lock.`,
              why: `${lockList.join(", ")} holds the lock but has no item of its own queued, so the driver idles while other sequences starve.`,
            });
          }
        }
        return false;
      }
      drv.waitingSignature = undefined;
      const entry = arbQ[index];
      arbQ.splice(index, 1);
      const rt = byId.get(entry.seqId);
      const item = rt?.current?.label ?? entry.seqId;
      const full: ArbDecision = { ...decision, index: decisions.length + 1, winner: entry.seqId, item };
      decisions.push(full);
      drv.itemRequested = true;
      if (rt) {
        rt.status = "running";
        rt.phase = "granted";
      }
      emit({
        actor: "sqr",
        seqId: entry.seqId,
        what: `Arbitration (${ARB_MODE_INFO[scenario.mode].short}): grant #${full.index} goes to ${entry.seqId} for ${item}.`,
        why: full.why,
        message: { from: "sqr", to: "seq", label: "grant" },
        decisionIndex: full.index - 1,
      });
      return true;
    }

    // Granted; the item appears in the FIFO once the sequence reaches finish_item().
    if (fifo) {
      const item = fifo;
      drv.getCalled = true;
      emit({
        actor: "drv",
        seqId: item.seqId,
        what: `get_next_item() returns ${item.label}; the driver starts driving it (${drvSpec.driveNs} ns).`,
        why: "The item is peeked, not removed: it stays in the request FIFO until item_done().",
        drvCode: "get",
        message: { from: "sqr", to: "drv", label: item.label },
      });
      if (drvSpec.doubleGet) {
        emit({
          actor: "drv",
          seqId: item.seqId,
          what: `The driver calls get_next_item(next_req) to look ahead: UVM reports an error and next_req is ${item.label} again.`,
          why: `${item.seqId} is still blocked in finish_item(${item.label}), so no second item can exist. The call peeks the same handle, and the driver drives ${item.label} twice.`,
          drvCode: "get2",
          log: logLine("ERROR", "uvm_test_top.env.agt.sqr", "Get_next_item called twice without item_done or get in between"),
        });
      }
      startDriving(item);
      emit({
        actor: "drv",
        seqId: item.seqId,
        what: `Driving ${item.label}${drvSpec.doubleGet ? " and then the same item again" : ""} until t = ${drv.until} ns.`,
        why: "While the driver is busy, nobody calls get_next_item(), so no new grant can happen.",
        drvCode: "drive",
      });
      return true;
    }
    return false;
  };

  // ── Main loop ──

  let iterations = 0;
  while (!stopped && iterations < 4000) {
    iterations += 1;
    let changed = true;
    while (changed && !stopped && iterations < 4000) {
      iterations += 1;
      changed = runSequences();
      if (stopped) break;
      if (driverCompletion()) {
        changed = true;
        continue;
      }
      if (!changed) changed = driverGet();
    }
    if (stopped) break;

    const pending: number[] = [];
    for (const rt of seqs) {
      if (rt.status === "not-started") pending.push(rt.spec.startAt);
      if (rt.status === "delay" && rt.wakeAt !== undefined) pending.push(rt.wakeAt);
    }
    if (drv.status === "driving" && drv.until !== undefined) pending.push(drv.until);
    const future = pending.filter((p) => p > t);
    if (future.length === 0) break;
    const next = Math.min(...future);
    if (next > maxTime) {
      t = maxTime;
      stop("timeout", "");
      break;
    }
    t = next;
  }

  const blocked: BlockedSequence[] = seqs
    .filter((s) => s.status !== "finished")
    .map((s) => ({ seqId: s.spec.id, where: whereOf(s), since: s.since }));

  let outcome: SequencerRun["outcome"];
  // `stopped` is assigned inside closures, so TypeScript cannot narrow it here.
  const stopInfo = stopped as { kind: OutcomeKind; summary: string } | null;
  if (stopInfo && stopInfo.kind === "fatal") {
    outcome = { kind: "fatal", time: t, summary: stopInfo.summary, blocked };
  } else if (stopInfo && stopInfo.kind === "timeout") {
    const errors = log.filter((l) => l.severity === "ERROR").length;
    outcome = {
      kind: "timeout",
      time: t,
      summary: `Still running at t = ${t} ns with ${blocked.length} sequence(s) stuck${errors ? ` and ${errors} UVM_ERROR(s)` : ""}. The test only ends when the phase timeout fires.`,
      blocked,
    };
  } else if (blocked.length === 0) {
    outcome = { kind: "complete", time: t, summary: `All sequences finished by t = ${t} ns.`, blocked };
  } else {
    outcome = {
      kind: "hang",
      time: t,
      summary: `Nothing can move after t = ${t} ns: ${blocked.map((b) => `${b.seqId} is ${b.where}`).join("; ")}.`,
      blocked,
    };
  }

  emit({
    actor: "sqr",
    what:
      outcome.kind === "complete"
        ? `Done at t = ${t} ns: every sequence has returned. The driver waits in get_next_item() until the phase ends.`
        : outcome.kind === "fatal"
          ? `Simulation stops at t = ${t} ns: ${outcome.summary}`
          : outcome.kind === "timeout"
            ? `The model stops here. ${outcome.summary}`
            : `Deadlock at t = ${t} ns. ${outcome.summary}`,
    why:
      outcome.kind === "complete"
        ? "A driver blocked in get_next_item() is normal: the test ends when its objections drop, not when the driver returns."
        : "Find the call that never returns: the blocked sequence's line is highlighted.",
  });

  return {
    steps,
    decisions,
    driven,
    lockSpans,
    log,
    responses: Object.fromEntries(seqs.map((s) => [s.spec.id, { received: s.received, dropped: s.dropped, collected: s.collected }])),
    outcome,
    rngDraws: rng.draws,
  };
}

/** First decision where more than one unblocked request competed (null if none). */
export function firstContestedDecision(run: SequencerRun): ArbDecision | null {
  return run.decisions.find((d) => d.available > 1) ?? null;
}

/**
 * Empirical check for random modes: re-runs the scenario with many seeds and
 * counts who wins grant `decisionIndex`. Decisions before the first contested
 * one draw no random numbers, so that decision's state is seed-independent.
 */
export function sampleDecisionWinners(scenario: SequencerScenario, decisionIndex: number, seeds: number): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(scenario.sequences.map((s) => [s.id, 0]));
  for (let seed = 1; seed <= seeds; seed += 1) {
    const run = simulateSequencer({ ...scenario, seed });
    const d = run.decisions[decisionIndex - 1];
    if (d) counts[d.winner] = (counts[d.winner] ?? 0) + 1;
  }
  return counts;
}

// ── Presets ──────────────────────────────────────────────────────────────

const itemOps = (n: number): SeqOp[] => Array.from({ length: n }, () => ({ kind: "item" as const }));
const itemsWithResponses = (n: number): SeqOp[] =>
  Array.from({ length: n }, () => [{ kind: "item" as const }, { kind: "get_response" as const }]).flat();

export type HandshakePresetId =
  | "basic"
  | "responses"
  | "missing_item_done"
  | "double_get"
  | "rsp_no_id"
  | "rsp_overflow"
  | "response_hang";

/** One sequence on one sequencer with one driver; each preset isolates one rule or one bug. */
export function handshakeScenario(id: HandshakePresetId): SequencerScenario {
  const seq = (ops: SeqOp[]): SequenceSpec => ({ id: "A", name: "burst_seq", priority: DEFAULT_SEQUENCE_PRIORITY, startAt: 0, ops });
  const base = { mode: "UVM_SEQ_ARB_FIFO" as ArbMode, seed: 1 };
  switch (id) {
    case "basic":
      return { ...base, sequences: [seq(itemOps(3))], driver: { ...DEFAULT_DRIVER } };
    case "responses":
      return { ...base, sequences: [seq(itemsWithResponses(2))], driver: { ...DEFAULT_DRIVER, completion: "item_done_rsp" } };
    case "missing_item_done":
      return { ...base, sequences: [seq(itemOps(3))], driver: { ...DEFAULT_DRIVER, completion: "none" }, maxTimeNs: 40 };
    case "double_get":
      return { ...base, sequences: [seq(itemOps(2))], driver: { ...DEFAULT_DRIVER, doubleGet: true } };
    case "rsp_no_id":
      return { ...base, sequences: [seq(itemsWithResponses(2))], driver: { ...DEFAULT_DRIVER, completion: "item_done_rsp", setIdInfo: false } };
    case "rsp_overflow":
      return { ...base, sequences: [seq(itemOps(10))], driver: { ...DEFAULT_DRIVER, completion: "item_done_rsp" } };
    case "response_hang":
      return { ...base, sequences: [seq(itemsWithResponses(2))], driver: { ...DEFAULT_DRIVER, completion: "item_done" } };
  }
}

/** The corrected version of each debug preset (the clean presets are returned unchanged). */
export function fixedHandshakeScenario(id: HandshakePresetId): SequencerScenario {
  const s = handshakeScenario(id);
  switch (id) {
    case "missing_item_done":
      return { ...s, driver: { ...s.driver, completion: "item_done" } };
    case "double_get":
      return { ...s, driver: { ...s.driver, doubleGet: false } };
    case "rsp_no_id":
      return { ...s, driver: { ...s.driver, setIdInfo: true } };
    case "rsp_overflow":
      return { ...s, sequences: [{ ...s.sequences[0], ops: itemsWithResponses(10) }] };
    case "response_hang":
      return { ...s, driver: { ...s.driver, completion: "item_done_rsp" } };
    default:
      return s;
  }
}

export type ArbitrationPresetId ="fifo" | "strict_fifo" | "weighted" | "lock" | "forgot_unlock" | "grab_vs_lock";

/** Three sequences on one sequencer. Start times are staggered so queue order is explicit. */
export function arbitrationScenario(id: ArbitrationPresetId): SequencerScenario {
  const s = (sid: string, priority: number, startAt: number, ops: SeqOp[]): SequenceSpec => ({
    id: sid,
    name: `seq_${sid.toLowerCase()}`,
    priority,
    startAt,
    ops,
  });
  const driver = { ...DEFAULT_DRIVER };
  switch (id) {
    case "fifo":
      return { mode: "UVM_SEQ_ARB_FIFO", seed: 1, driver, sequences: [s("A", 100, 0, itemOps(2)), s("B", 100, 1, itemOps(2)), s("C", 300, 2, itemOps(2))] };
    case "strict_fifo":
      return { mode: "UVM_SEQ_ARB_STRICT_FIFO", seed: 1, driver, sequences: [s("A", 100, 0, itemOps(2)), s("B", 100, 1, itemOps(2)), s("C", 300, 2, itemOps(2))] };
    case "weighted":
      return { mode: "UVM_SEQ_ARB_WEIGHTED", seed: 7, driver, sequences: [s("A", 100, 0, itemOps(3)), s("B", 300, 1, itemOps(3)), s("C", 100, 2, itemOps(3))] };
    case "lock":
      return {
        mode: "UVM_SEQ_ARB_FIFO",
        seed: 1,
        driver,
        sequences: [s("A", 100, 0, itemOps(3)), s("B", 100, 5, [{ kind: "lock" }, ...itemOps(2), { kind: "unlock" }]), s("C", 100, 3, itemOps(2))],
      };
    case "forgot_unlock":
      return {
        mode: "UVM_SEQ_ARB_FIFO",
        seed: 1,
        driver,
        sequences: [s("A", 100, 0, itemOps(2)), s("B", 100, 1, [{ kind: "lock" }, ...itemOps(2), { kind: "wait", ns: 40 }]), s("C", 100, 2, itemOps(2))],
      };
    case "grab_vs_lock":
      return {
        mode: "UVM_SEQ_ARB_FIFO",
        seed: 1,
        driver,
        sequences: [
          s("A", 100, 0, [{ kind: "lock" }, ...itemOps(1), { kind: "wait", ns: 20 }, { kind: "unlock" }]),
          s("B", 100, 2, [{ kind: "lock" }, ...itemOps(1), { kind: "unlock" }]),
          s("C", 100, 4, [{ kind: "grab" }, ...itemOps(1), { kind: "ungrab" }]),
        ],
      };
  }
}

// ── Source generation (code shown next to the model) ─────────────────────

export interface SourceLine {
  text: string;
  key?: string;
}

/** Sequence body for a single-sequence handshake scenario. */
export function handshakeSequenceSource(seq: SequenceSpec): SourceLine[] {
  const items = seq.ops.filter((o) => o.kind === "item").length;
  const wantsResponse = seq.ops.some((o) => o.kind === "get_response");
  return [
    { text: `class ${seq.name} extends uvm_sequence #(bus_item);`, key: "start" },
    { text: `  \`uvm_object_utils(${seq.name})` },
    { text: `  function new(string name = "${seq.name}");` },
    { text: "    super.new(name);" },
    { text: "  endfunction" },
    { text: "  task body();" },
    { text: `    repeat (${items}) begin`, key: "loop" },
    { text: '      req = bus_item::type_id::create("req");', key: "create" },
    { text: "      start_item(req);      // blocks until granted", key: "start_item" },
    { text: '      if (!req.randomize()) `uvm_error("RND", "randomize failed")', key: "randomize" },
    { text: "      finish_item(req);     // blocks until item_done()", key: "finish_item" },
    ...(wantsResponse ? [{ text: "      get_response(rsp);    // blocks until a response arrives", key: "get_response" }] : []),
    { text: "    end" },
    { text: "  endtask", key: "end" },
    { text: "endclass" },
  ];
}

/** Driver run_phase generated from the driver spec. */
export function driverSource(spec: DriverSpec): SourceLine[] {
  const sendsResponse = spec.completion === "item_done_rsp" || spec.completion === "put_response";
  const lines: SourceLine[] = [
    { text: "class bus_driver extends uvm_driver #(bus_item);" },
    { text: "  `uvm_component_utils(bus_driver)" },
    { text: "  function new(string name, uvm_component parent);" },
    { text: "    super.new(name, parent);" },
    { text: "  endfunction" },
    { text: "  task run_phase(uvm_phase phase);" },
    { text: "    forever begin" },
    { text: "      seq_item_port.get_next_item(req);", key: "get" },
  ];
  if (spec.doubleGet) lines.push({ text: "      seq_item_port.get_next_item(next_req); // look-ahead: BUG", key: "get2" });
  lines.push({ text: `      drive(req);           // pin wiggling, ${spec.driveNs} ns`, key: "drive" });
  if (spec.doubleGet) lines.push({ text: "      drive(next_req);", key: "drive" });
  if (sendsResponse) {
    lines.push({ text: '      rsp = bus_item::type_id::create("rsp");', key: "rsp_create" });
    lines.push(
      spec.setIdInfo
        ? { text: "      rsp.set_id_info(req); // copy sequence_id + transaction_id", key: "set_id" }
        : { text: "      // rsp.set_id_info(req);  <- missing", key: "set_id" },
    );
  }
  switch (spec.completion) {
    case "item_done":
      lines.push({ text: "      seq_item_port.item_done();", key: "item_done" });
      break;
    case "item_done_rsp":
      lines.push({ text: "      seq_item_port.item_done(rsp);", key: "item_done" });
      break;
    case "put_response":
      lines.push({ text: "      seq_item_port.item_done();", key: "item_done" });
      lines.push({ text: "      seq_item_port.put_response(rsp);", key: "put_response" });
      break;
    case "none":
      lines.push({ text: "      // seq_item_port.item_done();  <- missing", key: "item_done" });
      break;
  }
  lines.push({ text: "    end" }, { text: "  endtask" }, { text: "endclass" });
  return lines;
}

/** The test code and sequence bodies for an arbitration scenario. */
export function arbitrationSource(scenario: SequencerScenario): SourceLine[] {
  const lines: SourceLine[] = [
    { text: "// test run_phase (objection raised around this block)" },
    { text: `env.agt.sqr.set_arbitration(${scenario.mode});`, key: "mode" },
    { text: "fork", key: "fork" },
  ];
  for (const s of scenario.sequences) {
    const delay = s.startAt > 0 ? `#${s.startAt}ns ` : "";
    lines.push({ text: `  ${delay}${s.name}.start(env.agt.sqr, null, ${s.priority});`, key: `start-${s.id}` });
  }
  lines.push({ text: "join" });
  for (const s of scenario.sequences) {
    lines.push({ text: "" });
    lines.push({ text: `// ${s.name}.body()`, key: `body-${s.id}` });
    let i = 0;
    while (i < s.ops.length) {
      const op = s.ops[i];
      if (op.kind === "item") {
        let n = 0;
        while (i + n < s.ops.length && s.ops[i + n].kind === "item") n += 1;
        lines.push({ text: `repeat (${n}) begin`, key: `items-${s.id}` });
        lines.push({ text: '  req = bus_item::type_id::create("req");' });
        lines.push({ text: "  start_item(req);  void'(req.randomize());  finish_item(req);" });
        lines.push({ text: "end" });
        i += n;
        continue;
      }
      if (op.kind === "wait") lines.push({ text: `#${op.ns}ns;  // other work: no request queued`, key: `op-${s.id}-${i}` });
      else if (op.kind === "get_response") lines.push({ text: "get_response(rsp);", key: `op-${s.id}-${i}` });
      else lines.push({ text: `${op.kind}();`, key: `op-${s.id}-${i}` });
      i += 1;
    }
    const takes = s.ops.some((o) => o.kind === "lock" || o.kind === "grab");
    const releases = s.ops.some((o) => o.kind === "unlock" || o.kind === "ungrab");
    if (takes && !releases) lines.push({ text: "// no unlock(): the lock is still held when body() returns" });
  }
  return lines;
}

// ── Sequence start hooks (uvm_sequence_base::start, 14.2.3) ─────────────

/**
 * How a parent starts a child sequence:
 * - "start_with_parent": child.start(m_sequencer, this) → call_pre_post = 1, parent hooks run.
 * - "uvm_do": `uvm_do(child) → uvm_rand_send → child.start(seqr, this, PRI, 0): call_pre_post = 0.
 * - "start_no_parent": child.start(m_sequencer) → no parent: no pre_do/mid_do/post_do on the
 *   parent, priority is not inherited, and the child is not is_child() of the parent for locks.
 */
export type ChildStartStyle = "start_with_parent" | "uvm_do" | "start_no_parent";

export const CHILD_START_CODE: Record<ChildStartStyle, (name: string) => string> = {
  start_with_parent: (name) => `${name}.start(m_sequencer, this);`,
  uvm_do: (name) => `\`uvm_do(${name})`,
  start_no_parent: (name) => `${name}.start(m_sequencer);`,
};

export interface HookChild {
  name: string;
  style: ChildStartStyle;
  items: number;
}

export interface HookTraceConfig {
  root: string;
  children: HookChild[];
  /** Expand each item into the calls inside start_item/finish_item. */
  itemDetail: boolean;
  /** The root calls lock() before starting children and unlock() after. */
  rootLocks: boolean;
}

export type HookKind = "hook" | "parent-hook" | "body" | "item" | "api" | "sequencer" | "driver" | "error";

export interface HookEvent {
  index: number;
  depth: number;
  /** Sequence whose method runs. */
  owner: string;
  call: string;
  kind: HookKind;
  why: string;
  /** Sequence name → status after this event. */
  status: Record<string, "idle" | "running" | "done" | "blocked">;
}

export interface HookTrace {
  events: HookEvent[];
  deadlock: boolean;
}

/** The hook calls a child produces in start() for a given style (body only, no items). */
export function childHookSequence(child: string, parent: string, style: ChildStartStyle): string[] {
  const calls: string[] = [];
  if (style === "uvm_do") calls.push(`${child}.randomize()`);
  calls.push(`${child}.pre_start()`);
  if (style !== "uvm_do") calls.push(`${child}.pre_body()`);
  if (style !== "start_no_parent") calls.push(`${parent}.pre_do(0)`, `${parent}.mid_do(${child})`);
  calls.push(`${child}.body()`);
  if (style !== "start_no_parent") calls.push(`${parent}.post_do(${child})`);
  if (style !== "uvm_do") calls.push(`${child}.post_body()`);
  calls.push(`${child}.post_start()`);
  return calls;
}

export function buildHookTrace(config: HookTraceConfig): HookTrace {
  const events: HookEvent[] = [];
  const names = [config.root, ...config.children.map((c) => c.name)];
  const status: HookEvent["status"] = Object.fromEntries(names.map((n) => [n, "idle"]));
  let deadlock = false;

  const push = (depth: number, owner: string, call: string, kind: HookKind, why: string) => {
    events.push({ index: events.length, depth, owner, call, kind, why, status: { ...status } });
  };

  const items = (owner: string, count: number, depth: number, blockedByLock: boolean): boolean => {
    for (let n = 1; n <= count; n += 1) {
      const req = `req${count > 1 ? n : ""}`;
      if (!config.itemDetail) {
        if (blockedByLock) {
          status[owner] = "blocked";
          push(depth, owner, `${owner}: start_item(${req})`, "error", `Deadlock: ${config.root} holds the lock and ${owner} was started without a parent, so is_blocked(${owner}) is true. start_item() never returns.`);
          return false;
        }
        push(depth, owner, `${owner}: start_item(${req}) … finish_item(${req})`, "item", "One item handshake (expand item detail to see the calls inside).");
        continue;
      }
      push(depth, owner, `${owner}.start_item(${req})`, "item", "Asks the sequencer for a grant.");
      push(depth + 1, owner, `m_sequencer.wait_for_grant(${owner}, priority)`, "sequencer", "Queues a request; returns when arbitration grants it (the driver must be asking).");
      if (blockedByLock) {
        status[owner] = "blocked";
        push(depth + 1, owner, "… never granted", "error", `Deadlock: ${config.root} holds the lock and ${owner} has no parent, so is_child(${config.root}, ${owner}) is false and is_blocked(${owner}) stays true.`);
        return false;
      }
      push(depth + 1, owner, `${owner}.pre_do(1)`, "hook", "Runs on the sequence that called start_item, after the grant. is_item = 1.");
      push(depth, owner, `${req}.randomize()`, "api", "Late randomization: after the grant, before finish_item.");
      push(depth, owner, `${owner}.finish_item(${req})`, "item", "Hands the item over and waits for item_done().");
      push(depth + 1, owner, `${owner}.mid_do(${req})`, "hook", "A function: it can modify the item, but cannot delay or veto it.");
      push(depth + 1, owner, `m_sequencer.send_request(${owner}, ${req})`, "sequencer", "Puts the item in the request FIFO; the driver's get_next_item() returns it.");
      push(depth + 1, owner, "driver: get_next_item(req) … item_done()", "driver", "The driver owns the pins; finish_item waits for its item_done().");
      push(depth + 1, owner, `${owner}.post_do(${req})`, "hook", "Runs after wait_for_item_done() returns.");
    }
    return true;
  };

  status[config.root] = "running";
  push(0, "test", `${config.root}.start(env.agt.sqr)`, "api", "The test starts the root sequence: no parent, call_pre_post = 1, priority 100.");
  push(1, config.root, `${config.root}.pre_start()`, "hook", "Always called by start().");
  push(1, config.root, `${config.root}.pre_body()`, "hook", "Called because call_pre_post = 1 (the default of start()).");
  push(1, config.root, `${config.root}.body()`, "body", "The root's body starts its children one after another.");
  if (config.rootLocks) push(2, config.root, `${config.root}.lock()`, "api", "The root reserves the sequencer for itself and its descendants.");

  for (const child of config.children) {
    push(2, config.root, CHILD_START_CODE[child.style](child.name), "api", startWhy(child.style));
    status[child.name] = "running";
    const calls = childHookSequence(child.name, config.root, child.style);
    for (const call of calls) {
      const isParent = call.startsWith(`${config.root}.`);
      if (call === `${child.name}.body()`) {
        push(3, child.name, call, "body", `${child.name}'s own work.`);
        const ok = items(child.name, child.items, 4, config.rootLocks && child.style === "start_no_parent");
        if (!ok) {
          deadlock = true;
          return { events, deadlock };
        }
        continue;
      }
      const kind: HookKind = isParent ? "parent-hook" : call.endsWith("randomize()") ? "api" : "hook";
      push(3, isParent ? config.root : child.name, call, kind, hookWhy(call, child, config.root));
    }
    status[child.name] = "done";
    push(3, child.name, `${child.name} returns`, "api", "start() has finished; the parent's body continues.");
  }

  if (config.rootLocks) push(2, config.root, `${config.root}.unlock()`, "api", "Releases the sequencer.");
  push(1, config.root, `${config.root}.post_body()`, "hook", "Called because call_pre_post = 1.");
  push(1, config.root, `${config.root}.post_start()`, "hook", "Always called by start().");
  status[config.root] = "done";
  push(0, "test", `${config.root}.start() returns`, "api", "The test can now drop its objection.");
  return { events, deadlock };
}

function startWhy(style: ChildStartStyle): string {
  switch (style) {
    case "start_with_parent":
      return "start(sqr, this): the parent is passed, call_pre_post keeps its default 1.";
    case "uvm_do":
      return "`uvm_do creates and randomizes the child, then calls start(seqr, this, PRIORITY, 0): call_pre_post = 0.";
    case "start_no_parent":
      return "start(sqr) without a parent: the child is a new root sequence.";
  }
}

function hookWhy(call: string, child: HookChild, parent: string): string {
  if (call.endsWith(".randomize()")) return "`uvm_do randomizes a sequence before starting it (unless randomization is disabled).";
  if (call.includes(".pre_start()")) return "Always called first by start().";
  if (call.includes(".post_start()")) return "Always called last by start().";
  if (call.includes(".pre_body()")) return "Runs only when call_pre_post = 1.";
  if (call.includes(".post_body()")) return "Runs only when call_pre_post = 1.";
  if (call.startsWith(`${parent}.pre_do`)) return `Parent hook: runs because ${child.name} has a parent. is_item = 0 (a sequence, not an item).`;
  if (call.startsWith(`${parent}.mid_do`)) return "Parent hook, a function: runs just before the child's body.";
  if (call.startsWith(`${parent}.post_do`)) return "Parent hook: runs right after the child's body returns.";
  return "";
}

// ── Virtual sequence on two agent sequencers ─────────────────────────────

export type VseqDispatch = "ordered" | "fork_join" | "fork_join_none";

export interface VseqConfig {
  dispatch: VseqDispatch;
  /** env.connect_phase assigned vsqr.data_sqr = data_agt.sqr. */
  dataHandleAssigned: boolean;
  cfgItems?: number;
  cfgDriveNs?: number;
  dataItems?: number;
  dataDriveNs?: number;
}

export interface VseqBar {
  lane: "cfg" | "data";
  label: string;
  start: number;
  end: number;
}

export interface VseqEvent {
  time: number;
  lane: "vseq" | "cfg" | "data" | "test";
  what: string;
}

export interface VseqRun {
  bars: VseqBar[];
  events: VseqEvent[];
  vseqReturnsAt: number;
  cfgDoneAt?: number;
  firstDataAt?: number;
  endOfTest: number;
  outcome: { kind: "ok" | "order-violation" | "killed" | "fatal"; summary: string };
  log: UvmLogLine[];
}

function agentRun(id: string, name: string, items: number, driveNs: number, startAt: number) {
  return simulateSequencer({
    mode: "UVM_SEQ_ARB_FIFO",
    seed: 1,
    sequences: [{ id, name, priority: DEFAULT_SEQUENCE_PRIORITY, startAt, ops: Array.from({ length: items }, () => ({ kind: "item" as const })) }],
    driver: { ...DEFAULT_DRIVER, driveNs },
  });
}

/**
 * Virtual sequence that must configure the DUT (cfg_seq on the slow config
 * agent) before sending data (data_seq on the data agent). Each agent's
 * timeline comes from simulateSequencer; the virtual sequence only decides
 * when each child's start() is called.
 * Assumption: the test raises an objection, calls vseq.start(), and drops it
 * when start() returns (no drain time).
 */
export function runVirtualSequence(config: VseqConfig): VseqRun {
  const cfgItems = config.cfgItems ?? 2;
  const cfgNs = config.cfgDriveNs ?? 20;
  const dataItems = config.dataItems ?? 3;
  const dataNs = config.dataDriveNs ?? 10;
  const events: VseqEvent[] = [];
  const log: UvmLogLine[] = [];
  const bars: VseqBar[] = [];

  events.push({ time: 0, lane: "test", what: "phase.raise_objection(this); vseq.start(env.vsqr);" });
  const cfgRun = agentRun("C", "cfg_seq", cfgItems, cfgNs, 0);
  const cfgDone = cfgRun.outcome.time;
  const dataStart = config.dispatch === "ordered" ? cfgDone : 0;
  events.push({ time: 0, lane: "vseq", what: "body() starts; p_sequencer is the env's virtual sequencer." });
  events.push({ time: 0, lane: "cfg", what: "cfg_seq.start(p_sequencer.cfg_sqr)" });

  let dataRun: SequencerRun | null = null;
  let fatal = false;
  if (config.dataHandleAssigned) {
    dataRun = agentRun("D", "data_seq", dataItems, dataNs, dataStart);
  }
  events.push({ time: dataStart, lane: "data", what: "data_seq.start(p_sequencer.data_sqr)" });
  if (!config.dataHandleAssigned && config.dispatch === "fork_join_none") {
    // The run ends at 0 ns anyway; which of the two 0 ns events wins is not something to teach.
    events.push({ time: 0, lane: "data", what: "p_sequencer.data_sqr is also null: once join_none is fixed, data_seq's start_item() would be a UVM_FATAL." });
  } else if (!config.dataHandleAssigned) {
    fatal = true;
    log.push({
      time: dataStart,
      severity: "FATAL",
      id: "SEQ",
      text: "neither the item's sequencer nor dedicated sequencer has been supplied to start item in uvm_test_top.vseq.data_seq",
    });
    events.push({ time: dataStart, lane: "data", what: "p_sequencer.data_sqr is null: data_seq's start_item() is a UVM_FATAL." });
  }

  const vseqReturnsAt =
    config.dispatch === "fork_join_none"
      ? 0
      : config.dispatch === "ordered"
        ? dataRun
          ? dataRun.outcome.time
          : dataStart
        : Math.max(cfgDone, dataRun ? dataRun.outcome.time : 0);

  // The run ends at the fatal, or when the test drops its objection.
  const endOfTest = fatal ? dataStart : vseqReturnsAt;
  const inRun = (s: { start: number }) => s.start < endOfTest;
  for (const d of cfgRun.driven) if (inRun(d)) bars.push({ lane: "cfg", label: d.item, start: d.start, end: Math.min(d.end, endOfTest) });
  if (dataRun) {
    for (const d of dataRun.driven) if (inRun(d)) bars.push({ lane: "data", label: d.item, start: d.start, end: Math.min(d.end, endOfTest) });
  }

  const firstDataAt = dataRun && config.dispatch !== "fork_join_none" ? dataRun.driven[0]?.start : undefined;
  if (config.dispatch === "fork_join_none") {
    events.push({ time: 0, lane: "vseq", what: "fork…join_none returns at once; body() ends and vseq.start() returns at t = 0 ns." });
    events.push({ time: 0, lane: "test", what: "The test drops its objection: run_phase ends and both child sequences are killed." });
  } else if (!fatal) {
    events.push({ time: cfgDone, lane: "cfg", what: `cfg_seq returns (${cfgItems} config items done).` });
    if (dataRun) events.push({ time: dataRun.outcome.time, lane: "data", what: `data_seq returns (${dataItems} data items done).` });
    events.push({ time: vseqReturnsAt, lane: "vseq", what: `body() returns at t = ${vseqReturnsAt} ns.` });
    events.push({ time: vseqReturnsAt, lane: "test", what: "vseq.start() returns; the test drops its objection." });
  }
  events.sort((a, b) => a.time - b.time);

  let outcome: VseqRun["outcome"];
  if (fatal) {
    outcome = {
      kind: "fatal",
      summary: `UVM_FATAL at t = ${dataStart} ns: data_seq was started on a null sequencer because the env never assigned vsqr.data_sqr in connect_phase.`,
    };
  } else if (config.dispatch === "fork_join_none") {
    outcome = { kind: "killed", summary: "vseq.start() returned at 0 ns, so the test ended before any item finished. join_none needs a wait fork (or a join) before body() returns." };
  } else if (firstDataAt !== undefined && firstDataAt < cfgDone) {
    outcome = {
      kind: "order-violation",
      summary: `Data item D1 reaches the data driver at t = ${firstDataAt} ns, before configuration completes at t = ${cfgDone} ns. fork…join runs both children at once; it does not order them.`,
    };
  } else {
    outcome = { kind: "ok", summary: `Configuration completes at t = ${cfgDone} ns; the first data item starts at t = ${firstDataAt} ns.` };
  }

  return { bars, events, vseqReturnsAt, cfgDoneAt: fatal && dataStart === 0 ? undefined : cfgDone, firstDataAt, endOfTest, outcome, log };
}

/** Body of the virtual sequence for a dispatch style. */
export function vseqBodySource(dispatch: VseqDispatch): SourceLine[] {
  const head: SourceLine[] = [
    { text: "class soc_vseq extends uvm_sequence;" },
    { text: "  `uvm_object_utils(soc_vseq)" },
    { text: "  `uvm_declare_p_sequencer(soc_vsqr)  // typed handle to m_sequencer", key: "psqr" },
    { text: '  function new(string name = "soc_vseq");' },
    { text: "    super.new(name);" },
    { text: "  endfunction" },
    { text: "  task body();" },
    { text: "    cfg_seq  c = cfg_seq::type_id::create(\"c\");" },
    { text: "    data_seq d = data_seq::type_id::create(\"d\");" },
  ];
  const tail: SourceLine[] = [{ text: "  endtask" }, { text: "endclass" }];
  const body: Record<VseqDispatch, SourceLine[]> = {
    ordered: [
      { text: "    c.start(p_sequencer.cfg_sqr);   // returns after the last config item", key: "cfg" },
      { text: "    d.start(p_sequencer.data_sqr);  // only then does data start", key: "data" },
    ],
    fork_join: [
      { text: "    fork", key: "fork" },
      { text: "      c.start(p_sequencer.cfg_sqr);", key: "cfg" },
      { text: "      d.start(p_sequencer.data_sqr);", key: "data" },
      { text: "    join                          // waits for both", key: "join" },
    ],
    fork_join_none: [
      { text: "    fork", key: "fork" },
      { text: "      c.start(p_sequencer.cfg_sqr);", key: "cfg" },
      { text: "      d.start(p_sequencer.data_sqr);", key: "data" },
      { text: "    join_none                     // body() returns immediately", key: "join" },
    ],
  };
  return [...head, ...body[dispatch], ...tail];
}
