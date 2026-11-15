/**
 * Deterministic model of a UVM transaction scoreboard: expected items from a
 * predictor, actual items from an output monitor, a matching policy, an
 * end-of-test rule, and check_phase accounting.
 *
 * Sources checked (uvm-core 2020.3.1, IEEE 1800.2-2020):
 * - src/comps/uvm_scoreboard.svh: `uvm_scoreboard` exists (§13.6.1). It is a
 *   virtual class that extends uvm_component and adds no behaviour, so all
 *   matching and accounting below is the testbench's own code.
 * - src/tlm1/uvm_tlm_fifos.svh: `uvm_tlm_analysis_fifo::write()` calls
 *   try_put on an unbounded FIFO (size 0), so a monitor write never blocks and
 *   never drops; the FIFO stores the handle it is given, not a copy.
 * - src/base/uvm_objection.svh: drop_objection (§10.5.1.3.4) and
 *   set_drain_time (§10.5.1.3.7). When the count reaches zero the phase waits
 *   the drain time, and a raise during the drain cancels the end.
 * - src/base/uvm_phase_hopper.svh: phase_ready_to_end is called again after
 *   every re-raise, up to max_ready_to_end_iterations (default 20,
 *   src/base/uvm_phase.svh, §9.3.1.3.5). An unguarded `#100ns` drain there
 *   therefore repeats up to 20 times.
 *
 * Time is in clock cycles of 10 ns. Within one cycle the predictor's write is
 * processed before the output monitor's write. In a real bench that order is
 * a race between two monitors, which is why the queue policies hold an early
 * actual item instead of reporting it at once.
 */

export const SB_CYCLE_NS = 10;
/** Cycle in which the test's sequence ends and the test drops its objection. */
export const SB_T_DROP = 5;
/** Drain time used by the "drain-time" rule, in cycles (30 ns). */
export const SB_DRAIN_CYCLES = 3;
/** Watchdog used by the "until-idle" rule, in cycles (60 ns). */
export const SB_IDLE_TIMEOUT = 6;

export type MatchPolicy = "in-order" | "per-id" | "single-slot" | "search-any";
export type DutOrdering = "in-order" | "cross-id";
export type Mutant = "none" | "drop" | "extra" | "reorder-same-id" | "wrong-data";
export type EndOfTest = "none" | "drain-time" | "until-idle";

export interface SbItem {
  /** Request number (1-based), shared by the expected and actual copies. */
  seq: number;
  id: number;
  data: number;
}

export interface SbConfig {
  policy: MatchPolicy;
  dut: DutOrdering;
  mutant: Mutant;
  endOfTest: EndOfTest;
  /** check_phase reports leftover expected (MISSING) and actual (UNEXPECTED) items. */
  checkPhase: boolean;
}

export const DEFAULT_SB_CONFIG: SbConfig = {
  policy: "per-id",
  dut: "cross-id",
  mutant: "none",
  endOfTest: "until-idle",
  checkPhase: true,
};

export const policyLabels: Record<MatchPolicy, string> = {
  "in-order": "In-order queue",
  "per-id": "Per-ID queues",
  "single-slot": "One slot per ID",
  "search-any": "Search any match",
};

export const mutantLabels: Record<Mutant, string> = {
  none: "No bug",
  drop: "Drops the last id-0 response",
  extra: "Sends #2 twice",
  "reorder-same-id": "Swaps #1 and #3 (same ID)",
  "wrong-data": "Corrupts #4's data",
};

export const endOfTestLabels: Record<EndOfTest, string> = {
  none: "No drain",
  "drain-time": "Drain time 30 ns",
  "until-idle": "Wait until idle",
};

/** Five tagged requests. Same-ID requests overlap, as AXI allows. */
export const SB_STIMULUS: { t: number; item: SbItem }[] = [
  { t: 1, item: { seq: 1, id: 0, data: 0x10 } },
  { t: 2, item: { seq: 2, id: 1, data: 0x20 } },
  { t: 3, item: { seq: 3, id: 0, data: 0x11 } },
  { t: 4, item: { seq: 4, id: 1, data: 0x21 } },
  { t: 5, item: { seq: 5, id: 0, data: 0x12 } },
];

export interface SbActual {
  t: number;
  item: SbItem;
  /** Why this output differs from a correct DUT, if it does. */
  note?: string;
}

const hex = (v: number) => `0x${v.toString(16).toUpperCase().padStart(2, "0")}`;
export const ns = (t: number) => `${t * SB_CYCLE_NS} ns`;
export const itemText = (i: SbItem) => `#${i.seq} (id ${i.id}, ${hex(i.data)})`;
export const itemShort = (i: SbItem) => `id${i.id} ${hex(i.data)}`;

/**
 * Output stream of the DUT. An in-order DUT answers every request 3 cycles
 * later. The cross-ID DUT answers id 1 after 2 cycles and id 0 after 4, so it
 * reorders across IDs but keeps each ID in request order (the AXI rule).
 */
export function dutOutputs(dut: DutOrdering, mutant: Mutant): SbActual[] {
  const latency = (id: number) => (dut === "in-order" ? 3 : id === 1 ? 2 : 4);
  let outs: SbActual[] = SB_STIMULUS.map(({ t, item }) => ({ t: t + latency(item.id), item: { ...item } })).sort((a, b) => a.t - b.t);

  if (mutant === "drop") {
    outs = outs.filter((o) => o.item.seq !== 5);
  } else if (mutant === "wrong-data") {
    outs = outs.map((o) => (o.item.seq === 4 ? { ...o, item: { ...o.item, data: 0x25 }, note: "data corrupted (0x21 → 0x25)" } : o));
  } else if (mutant === "reorder-same-id") {
    const t1 = outs.find((o) => o.item.seq === 1)!.t;
    const t3 = outs.find((o) => o.item.seq === 3)!.t;
    outs = outs
      .map((o) => (o.item.seq === 1 ? { ...o, t: t3, note: "returned after #3 (same ID)" } : o.item.seq === 3 ? { ...o, t: t1, note: "returned before #1 (same ID)" } : o))
      .sort((a, b) => a.t - b.t);
  } else if (mutant === "extra") {
    const dupAt = outs.find((o) => o.item.seq === 2)!.t;
    outs = outs.map((o) => (o.t > dupAt ? { ...o, t: o.t + 1 } : o));
    outs.push({ t: dupAt + 1, item: { seq: 2, id: 1, data: 0x20 }, note: "duplicate of #2" });
    outs.sort((a, b) => a.t - b.t);
  }
  return outs;
}

/* ------------------------------------------------------------------------- */
/* Matching engine                                                            */
/* ------------------------------------------------------------------------- */

export type SbAction =
  | "queued"
  | "overwrite"
  | "match"
  | "mismatch"
  | "held"
  | "unexpected"
  | "held-match"
  | "held-mismatch"
  | "run-end"
  | "not-observed"
  | "missing"
  | "leftover-actual"
  | "check-clean"
  | "check-skipped";

export interface PendingView {
  /** Container name as written in the code, e.g. `exp_q[0]`. */
  name: string;
  items: SbItem[];
}

export interface SbSnapshot {
  pending: PendingView[];
  held: SbItem[];
  outstanding: number;
}

export interface SbStep {
  t: number;
  phase: "run" | "end" | "check";
  kind: "exp" | "act" | "end" | "check";
  item?: SbItem;
  /** The expected item the actual was compared with, if any. */
  against?: SbItem;
  action: SbAction;
  what: string;
  why: string;
  /** Key of the code line that executes (see scoreboardSource). */
  codeKey: string;
  snapshot: SbSnapshot;
  /** Error id when this step reports one. */
  error?: string;
}

export interface SbMessage {
  t: number;
  phase: "run" | "check";
  id: string;
  text: string;
}

export type SbTruth = "clean-pass" | "hollow-pass" | "false-alarm" | "caught-run" | "caught-check" | "escaped";
export type SbOutcome = "pass" | "run" | "check";

export interface SbResult {
  config: SbConfig;
  steps: SbStep[];
  expected: { t: number; item: SbItem }[];
  actuals: SbActual[];
  endTime: number;
  timedOut: boolean;
  runErrors: SbMessage[];
  checkErrors: SbMessage[];
  leftoverExpected: SbItem[];
  leftoverActual: SbItem[];
  /** Writes that happened after run_phase ended (never reach the scoreboard). */
  notObserved: { t: number; kind: "exp" | "act"; item: SbItem }[];
  matched: number;
  verdict: "PASS" | "FAIL";
  outcome: SbOutcome;
  truth: SbTruth;
  summary: string;
  log: string[];
}

interface Store {
  /** in-order / search-any: one list. per-id: one queue per ID. single-slot: one slot per ID. */
  list: SbItem[];
  byId: Map<number, SbItem[]>;
  slot: Map<number, SbItem>;
  held: SbItem[];
}

const sameItem = (a: SbItem, b: SbItem) => a.id === b.id && a.data === b.data;

function snapshotOf(policy: MatchPolicy, s: Store): SbSnapshot {
  let pending: PendingView[];
  if (policy === "per-id") {
    pending = [...s.byId.keys()].sort((a, b) => a - b).map((id) => ({ name: `exp_q[${id}]`, items: [...(s.byId.get(id) ?? [])] }));
  } else if (policy === "single-slot") {
    pending = [...s.slot.keys()].sort((a, b) => a - b).map((id) => ({ name: `expected[${id}]`, items: [s.slot.get(id)!] }));
  } else {
    pending = [{ name: policy === "in-order" ? "exp_q" : "exp_l", items: [...s.list] }];
  }
  const outstanding = pending.reduce((n, p) => n + p.items.length, 0);
  return { pending, held: [...s.held], outstanding };
}

function outstandingOf(policy: MatchPolicy, s: Store): number {
  return snapshotOf(policy, s).outstanding;
}

/** End-of-test time for the chosen rule, given the outstanding count after each cycle. */
function runEndTime(rule: EndOfTest, outstandingAfter: (t: number) => number): { end: number; timedOut: boolean } {
  if (rule === "none") return { end: SB_T_DROP, timedOut: false };
  if (rule === "drain-time") return { end: SB_T_DROP + SB_DRAIN_CYCLES, timedOut: false };
  const limit = SB_T_DROP + SB_IDLE_TIMEOUT;
  for (let t = SB_T_DROP; t <= limit; t += 1) {
    if (outstandingAfter(t) === 0) return { end: t, timedOut: false };
  }
  return { end: limit, timedOut: true };
}

/** Runs one configuration and returns every step, the verdict and why. */
export function runScoreboard(config: SbConfig): SbResult {
  const { policy } = config;
  const expected = SB_STIMULUS.map((s) => ({ t: s.t, item: { ...s.item } }));
  const actuals = dutOutputs(config.dut, config.mutant);
  const events = [
    ...expected.map((e) => ({ t: e.t, kind: "exp" as const, item: e.item, note: undefined as string | undefined })),
    ...actuals.map((a) => ({ t: a.t, kind: "act" as const, item: a.item, note: a.note })),
  ].sort((a, b) => a.t - b.t || (a.kind === b.kind ? 0 : a.kind === "exp" ? -1 : 1));

  // Pass 1 needs the outstanding count per cycle to place the end of the run
  // phase; pass 2 records steps only up to that end.
  const simulate = (endAt: number) => {
    const s: Store = { list: [], byId: new Map(), slot: new Map(), held: [] };
    const steps: SbStep[] = [];
    const runErrors: SbMessage[] = [];
    const outstandingAt = new Map<number, number>();
    let matched = 0;
    const push = (step: Omit<SbStep, "snapshot" | "phase">) => steps.push({ ...step, phase: "run", snapshot: snapshotOf(policy, s) });
    const err = (t: number, id: string, text: string) => runErrors.push({ t, phase: "run", id, text });

    for (const ev of events) {
      if (ev.t > endAt) break;
      const it = ev.item;
      if (ev.kind === "exp") {
        if (policy === "single-slot") {
          const old = s.slot.get(it.id);
          s.slot.set(it.id, it);
          if (old) {
            push({
              t: ev.t, kind: "exp", item: it, action: "overwrite", codeKey: "exp-store",
              what: `Predictor writes ${itemText(it)}. expected[${it.id}] = #${it.seq} replaces #${old.seq}, which is still outstanding.`,
              why: `One slot per ID cannot hold two outstanding requests with the same ID. #${old.seq} silently disappears from the books.`,
            });
          } else {
            push({
              t: ev.t, kind: "exp", item: it, action: "queued", codeKey: "exp-store",
              what: `Predictor writes ${itemText(it)} into expected[${it.id}].`,
              why: `The slot for id ${it.id} was empty, so nothing is lost yet.`,
            });
          }
        } else {
          // A held (early) actual is matched first.
          const heldIdx =
            policy === "in-order" ? (s.held.length ? 0 : -1) : policy === "per-id" ? s.held.findIndex((h) => h.id === it.id) : s.held.findIndex((h) => sameItem(h, it));
          if (heldIdx >= 0) {
            const act = s.held.splice(heldIdx, 1)[0];
            const ok = policy === "per-id" ? act.data === it.data : sameItem(act, it);
            if (ok) matched += 1;
            else err(ev.t, "SCB/MISMATCH", `expected ${itemText(it)}, got id ${act.id} ${hex(act.data)}`);
            push({
              t: ev.t, kind: "exp", item: it, against: act, action: ok ? "held-match" : "held-mismatch", codeKey: ok ? "exp-held" : "mismatch",
              what: `Predictor writes ${itemText(it)}; an actual item was already waiting.`,
              why: ok
                ? "The actual arrived first (the monitors raced) and was held, so it is compared now instead of being reported as unexpected."
                : `The waiting actual (id ${act.id}, ${hex(act.data)}) does not equal the new expected item.`,
              error: ok ? undefined : "SCB/MISMATCH",
            });
          } else {
            if (policy === "per-id") {
              const q = s.byId.get(it.id) ?? [];
              q.push(it);
              s.byId.set(it.id, q);
            } else {
              s.list.push(it);
            }
            const where = policy === "per-id" ? `exp_q[${it.id}]` : policy === "in-order" ? "exp_q" : "exp_l";
            push({
              t: ev.t, kind: "exp", item: it, action: "queued", codeKey: "exp-store",
              what: `Predictor writes ${itemText(it)}; it joins the back of ${where}.`,
              why:
                policy === "per-id"
                  ? `Each ID keeps its own queue, oldest first, so two outstanding id-${it.id} requests can coexist.`
                  : policy === "in-order"
                    ? "One queue for every ID: the scoreboard assumes responses come back in request order."
                    : "One unordered list: any later actual that equals this item will claim it.",
            });
          }
        }
      } else {
        // Actual item.
        if (policy === "single-slot") {
          const exp = s.slot.get(it.id);
          if (!exp) {
            err(ev.t, "SCB", `Unexpected output with id=${it.id}`);
            push({
              t: ev.t, kind: "act", item: it, action: "unexpected", codeKey: "unexpected",
              what: `Output monitor writes id ${it.id}, ${hex(it.data)}${ev.note ? ` (${ev.note})` : ""}.`,
              why: `expected[${it.id}] does not exist (it was consumed or overwritten), so the code reports an unexpected output at once.`,
              error: "SCB",
            });
          } else {
            s.slot.delete(it.id);
            const ok = exp.data === it.data;
            if (ok) matched += 1;
            else err(ev.t, "SCB", `MISMATCH id=${it.id}: expected ${hex(exp.data)}, got ${hex(it.data)}`);
            push({
              t: ev.t, kind: "act", item: it, against: exp, action: ok ? "match" : "mismatch", codeKey: ok ? "match" : "mismatch",
              what: `Output monitor writes id ${it.id}, ${hex(it.data)}${ev.note ? ` (${ev.note})` : ""}; compared with expected[${it.id}] = #${exp.seq}.`,
              why: ok
                ? "The slot held the right item this time."
                : exp.seq !== it.seq
                  ? `The slot holds #${exp.seq}, the newest id-${it.id} request, but the DUT is answering #${it.seq}. The older request was overwritten.`
                  : "Same request, different data.",
              error: ok ? undefined : "SCB",
            });
          }
        } else {
          let exp: SbItem | undefined;
          if (policy === "in-order") exp = s.list.shift();
          else if (policy === "per-id") exp = s.byId.get(it.id)?.shift();
          else {
            const idx = s.list.findIndex((e) => sameItem(e, it));
            exp = idx >= 0 ? s.list.splice(idx, 1)[0] : undefined;
          }
          if (!exp) {
            s.held.push(it);
            push({
              t: ev.t, kind: "act", item: it, action: "held", codeKey: "act-held",
              what: `Output monitor writes id ${it.id}, ${hex(it.data)}${ev.note ? ` (${ev.note})` : ""}; nothing to compare it with.`,
              why:
                policy === "search-any"
                  ? "No pending expected item equals it. It is held: it may still be matched, and check_phase reports it if not."
                  : `No expected item is waiting${policy === "per-id" ? ` for id ${it.id}` : ""}. It is held in case its expected item is still on the way; check_phase reports it if it is never matched.`,
            });
          } else {
            const ok = policy === "per-id" ? exp.data === it.data : sameItem(exp, it);
            if (ok) matched += 1;
            else err(ev.t, "SCB/MISMATCH", `expected ${itemText(exp)}, got id ${it.id} ${hex(it.data)}`);
            let why: string;
            if (ok) {
              why =
                policy === "per-id"
                  ? `write_act pops the oldest expected item for id ${it.id} (#${exp.seq}) and the data agrees.`
                  : policy === "in-order"
                    ? `The oldest expected item (#${exp.seq}) is exactly this response.`
                    : `A pending item equals it (#${exp.seq}), so it is claimed, whatever its position.`;
            } else if (policy === "in-order" && exp.id !== it.id) {
              why = `An in-order scoreboard compares with the oldest expected item of any ID (#${exp.seq}, id ${exp.id}). The DUT answered id ${it.id} first. Across IDs that is legal, so this is a false mismatch, and the queue is now out of step.`;
            } else {
              why = `Responses with one ID must return in request order, so the oldest id-${it.id} item (#${exp.seq}, ${hex(exp.data)}) is the only legal partner. The data differs.`;
            }
            push({
              t: ev.t, kind: "act", item: it, against: exp, action: ok ? "match" : "mismatch", codeKey: ok ? "match" : "mismatch",
              what: `Output monitor writes id ${it.id}, ${hex(it.data)}${ev.note ? ` (${ev.note})` : ""}; compared with #${exp.seq}.`,
              why,
              error: ok ? undefined : "SCB/MISMATCH",
            });
          }
        }
      }
      outstandingAt.set(ev.t, outstandingOf(policy, s));
    }
    return { s, steps, runErrors, matched, outstandingAt };
  };

  // Outstanding count after each cycle (carried forward between events).
  const probe = simulate(Number.POSITIVE_INFINITY);
  const outstandingAfter = (t: number) => {
    let value = 0;
    for (let k = 0; k <= t; k += 1) if (probe.outstandingAt.has(k)) value = probe.outstandingAt.get(k)!;
    return value;
  };
  const { end: endTime, timedOut } = runEndTime(config.endOfTest, outstandingAfter);
  const run = simulate(endTime);
  const { s, steps } = run;

  const notObserved = events.filter((e) => e.t > endTime).map((e) => ({ t: e.t, kind: e.kind, item: e.item }));
  const endWhy =
    config.endOfTest === "none"
      ? `The test drops its objection when its sequence ends (${ns(SB_T_DROP)}). With no drain, run_phase ends in that time step.`
      : config.endOfTest === "drain-time"
        ? `The objection count reaches zero at ${ns(SB_T_DROP)}; the drain time holds the phase for ${SB_DRAIN_CYCLES * SB_CYCLE_NS} ns more, whatever is still in flight.`
        : timedOut
          ? `The scoreboard objected while items were outstanding, but its ${SB_IDLE_TIMEOUT * SB_CYCLE_NS} ns watchdog expired first and it dropped the objection.`
          : `The scoreboard kept an objection raised until nothing was outstanding (${ns(endTime)}).`;
  steps.push({
    t: endTime, phase: "end", kind: "end", action: "run-end", codeKey: "drain",
    what: `run_phase ends at ${ns(endTime)}.${notObserved.length ? ` ${notObserved.length} later write(s) never reach the scoreboard.` : ""}`,
    why: endWhy,
    snapshot: snapshotOf(policy, s),
  });

  const leftoverExpected = snapshotOf(policy, s).pending.flatMap((p) => p.items);
  const leftoverActual = [...s.held];
  const checkErrors: SbMessage[] = [];
  const checkT = endTime;
  if (!config.checkPhase) {
    steps.push({
      t: checkT, phase: "check", kind: "check", action: "check-skipped", codeKey: "check",
      what: "check_phase does not look at leftovers.",
      why:
        leftoverExpected.length + leftoverActual.length > 0
          ? `${leftoverExpected.length} expected and ${leftoverActual.length} actual item(s) are still in the scoreboard, and nothing reports them.`
          : "Nothing is left over, so here the missing check changes nothing.",
      snapshot: snapshotOf(policy, s),
    });
  } else {
    for (const it of leftoverExpected) {
      checkErrors.push({ t: checkT, phase: "check", id: "SCB/MISSING", text: `${itemText(it)} was predicted but never seen at the output` });
      steps.push({
        t: checkT, phase: "check", kind: "check", item: it, action: "missing", codeKey: "check", error: "SCB/MISSING",
        what: `check_phase: ${itemText(it)} is still expected.`,
        why: notObserved.some((n) => n.kind === "act" && n.item.seq === it.seq)
          ? "The DUT did answer, but after run_phase ended, so the monitor's write never reached the scoreboard."
          : policy === "single-slot"
            ? "Its slot was never consumed."
            : "No response ever claimed it: the DUT dropped it, or its response was compared with another item.",
        snapshot: snapshotOf(policy, s),
      });
    }
    for (const it of leftoverActual) {
      checkErrors.push({ t: checkT, phase: "check", id: "SCB/UNEXPECTED", text: `id ${it.id} ${hex(it.data)} arrived but matched no prediction` });
      steps.push({
        t: checkT, phase: "check", kind: "check", item: it, action: "leftover-actual", codeKey: "check", error: "SCB/UNEXPECTED",
        what: `check_phase: an actual item (id ${it.id}, ${hex(it.data)}) was never matched.`,
        why: "The DUT produced something nobody predicted: an extra response, or corrupted data that no expected item equals.",
        snapshot: snapshotOf(policy, s),
      });
    }
    if (leftoverExpected.length + leftoverActual.length === 0) {
      steps.push({
        t: checkT, phase: "check", kind: "check", action: "check-clean", codeKey: "check",
        what: "check_phase: nothing left over.",
        why: "Every expected item was consumed and every actual item was compared.",
        snapshot: snapshotOf(policy, s),
      });
    }
  }

  const runErrors = run.runErrors;
  const verdict = runErrors.length + checkErrors.length === 0 ? "PASS" : "FAIL";
  const outcome: SbOutcome = verdict === "PASS" ? "pass" : runErrors.length > 0 ? "run" : "check";
  const bug = config.mutant !== "none";
  const unchecked = leftoverExpected.length + leftoverActual.length;
  const truth: SbTruth = bug
    ? verdict === "PASS"
      ? "escaped"
      : runErrors.length > 0
        ? "caught-run"
        : "caught-check"
    : verdict === "PASS"
      ? unchecked > 0
        ? "hollow-pass"
        : "clean-pass"
      : "false-alarm";

  const firstRun = steps.find((st) => st.phase === "run" && st.error);
  let summary: string;
  if (outcome === "pass") {
    summary =
      unchecked > 0
        ? `PASS, but ${unchecked} item(s) were never compared: ${notObserved.length ? "run_phase ended before they arrived" : "they are still in the scoreboard"}, and check_phase does not count leftovers.`
        : `PASS. Every expected item met its actual partner and nothing was left over.`;
  } else if (outcome === "run") {
    summary = `UVM_ERROR during run_phase at ${ns(firstRun!.t)}: ${firstRun!.why}`;
  } else {
    const parts = [];
    if (leftoverExpected.length) parts.push(`${leftoverExpected.length} MISSING`);
    if (leftoverActual.length) parts.push(`${leftoverActual.length} UNEXPECTED`);
    summary = `No error while the test ran. check_phase reports ${parts.join(" and ")}: ${
      steps.find((st) => st.phase === "check" && st.error)?.why ?? ""
    }`;
  }

  const log: string[] = [
    ...runErrors.map((m) => `UVM_ERROR @ ${ns(m.t)} [${m.id}] ${m.text}`),
    `UVM_INFO @ ${ns(endTime)} [PH] run_phase ends${timedOut ? " (scoreboard drain watchdog expired)" : ""}`,
    ...checkErrors.map((m) => `UVM_ERROR @ ${ns(m.t)} [${m.id}] ${m.text}`),
    `UVM_INFO @ ${ns(endTime)} [SCB] matched ${run.matched}, errors ${runErrors.length + checkErrors.length} → ${verdict}`,
  ];

  return {
    config,
    steps,
    expected,
    actuals,
    endTime,
    timedOut,
    runErrors,
    checkErrors,
    leftoverExpected,
    leftoverActual,
    notObserved,
    matched: run.matched,
    verdict,
    outcome,
    truth,
    summary,
    log,
  };
}

export const MUTANTS: Mutant[] = ["none", "drop", "extra", "reorder-same-id", "wrong-data"];
export const POLICIES: MatchPolicy[] = ["in-order", "per-id", "single-slot", "search-any"];

/** Which policy catches which DUT bug, for one DUT ordering and end-of-test rule. */
export function policyMatrix(dut: DutOrdering, endOfTest: EndOfTest = "until-idle", checkPhase = true) {
  return MUTANTS.map((mutant) => ({
    mutant,
    cells: POLICIES.map((policy) => {
      const r = runScoreboard({ policy, dut, mutant, endOfTest, checkPhase });
      return { policy, truth: r.truth, outcome: r.outcome };
    }),
  }));
}

export const truthLabels: Record<SbTruth, { glyph: string; text: string }> = {
  "clean-pass": { glyph: "✓", text: "clean pass" },
  "hollow-pass": { glyph: "◌", text: "pass, items unchecked" },
  "false-alarm": { glyph: "!", text: "false alarm" },
  "caught-run": { glyph: "✕", text: "caught in run_phase" },
  "caught-check": { glyph: "◐", text: "caught in check_phase" },
  escaped: { glyph: "⚠", text: "bug escaped" },
};

/* ------------------------------------------------------------------------- */
/* Code shown to the learner (generated from the same policy data)            */
/* ------------------------------------------------------------------------- */

export interface SbCodeLine {
  text: string;
  key?: string;
}

const L = (text: string, key?: string): SbCodeLine => ({ text, key });

export function scoreboardSource(config: Pick<SbConfig, "policy" | "endOfTest" | "checkPhase">): SbCodeLine[] {
  const { policy } = config;
  const head = [
    L("`uvm_analysis_imp_decl(_exp)"),
    L("`uvm_analysis_imp_decl(_act)"),
    L("class rsp_scoreboard extends uvm_scoreboard;"),
    L("  `uvm_component_utils(rsp_scoreboard)"),
    L("  uvm_analysis_imp_exp #(rsp_item, rsp_scoreboard) exp_imp; // predictor"),
    L("  uvm_analysis_imp_act #(rsp_item, rsp_scoreboard) act_imp; // output monitor"),
  ];
  let body: SbCodeLine[];
  if (policy === "per-id") {
    body = [
      L("  rsp_item exp_q[int unsigned][$];   // one ordered queue per ID"),
      L("  rsp_item held_q[$];                // actuals that beat their prediction"),
      L("  int unsigned outstanding;"),
      L(""),
      L("  function void write_exp(rsp_item t);"),
      L("    foreach (held_q[i]) if (held_q[i].id == t.id) begin", "exp-held"),
      L("      compare(t, held_q[i]); held_q.delete(i); return;", "exp-held"),
      L("    end"),
      L("    exp_q[t.id].push_back(t); outstanding++;", "exp-store"),
      L("  endfunction"),
      L(""),
      L("  function void write_act(rsp_item t);"),
      L("    if (!exp_q.exists(t.id) || exp_q[t.id].size() == 0) begin"),
      L("      held_q.push_back(t); return;      // maybe early; check_phase decides", "act-held"),
      L("    end"),
      L("    compare(exp_q[t.id].pop_front(), t); outstanding--;", "match"),
      L("  endfunction"),
    ];
  } else if (policy === "in-order") {
    body = [
      L("  rsp_item exp_q[$];                 // every ID in one queue"),
      L("  rsp_item held_q[$];"),
      L("  int unsigned outstanding;"),
      L(""),
      L("  function void write_exp(rsp_item t);"),
      L("    if (held_q.size()) begin compare(t, held_q.pop_front()); return; end", "exp-held"),
      L("    exp_q.push_back(t); outstanding++;", "exp-store"),
      L("  endfunction"),
      L(""),
      L("  function void write_act(rsp_item t);"),
      L("    if (exp_q.size() == 0) begin held_q.push_back(t); return; end", "act-held"),
      L("    compare(exp_q.pop_front(), t); outstanding--;  // oldest of ANY id", "match"),
      L("  endfunction"),
    ];
  } else if (policy === "search-any") {
    body = [
      L("  rsp_item exp_l[$];                 // unordered pool"),
      L("  rsp_item held_q[$];"),
      L("  int unsigned outstanding;"),
      L(""),
      L("  function void write_exp(rsp_item t);"),
      L("    foreach (held_q[i]) if (held_q[i].compare(t)) begin", "exp-held"),
      L("      held_q.delete(i); return;", "exp-held"),
      L("    end"),
      L("    exp_l.push_back(t); outstanding++;", "exp-store"),
      L("  endfunction"),
      L(""),
      L("  function void write_act(rsp_item t);"),
      L("    foreach (exp_l[i]) if (exp_l[i].compare(t)) begin   // any position", "match"),
      L("      exp_l.delete(i); outstanding--; return;", "match"),
      L("    end"),
      L("    held_q.push_back(t);               // no equal item pending", "act-held"),
      L("  endfunction"),
    ];
  } else {
    body = [
      L("  rsp_item expected[int unsigned];   // ONE slot per ID"),
      L(""),
      L("  function void write_exp(rsp_item t);"),
      L("    expected[t.id] = t;              // overwrites an outstanding item", "exp-store"),
      L("  endfunction"),
      L(""),
      L("  function void write_act(rsp_item t);"),
      L("    if (!expected.exists(t.id)) begin"),
      L('      `uvm_error("SCB", $sformatf("Unexpected output id=%0d", t.id))', "unexpected"),
      L("      return;"),
      L("    end"),
      L("    if (t.data != expected[t.id].data)", "match"),
      L('      `uvm_error("SCB", "MISMATCH")', "mismatch"),
      L("    expected.delete(t.id);"),
      L("  endfunction"),
    ];
  }
  const compare =
    policy === "single-slot"
      ? []
      : [
          L(""),
          L("  function void compare(rsp_item exp, rsp_item act);"),
          L(policy === "per-id" ? "    if (act.data != exp.data)" : "    if (!act.compare(exp))   // id and data", "match"),
          L('      `uvm_error("SCB/MISMATCH", $sformatf("exp %s got %s", exp.convert2string(), act.convert2string()))', "mismatch"),
          L("  endfunction"),
        ];
  const check = config.checkPhase
    ? policy === "single-slot"
      ? [
          L(""),
          L("  function void check_phase(uvm_phase phase);", "check"),
          L("    if (expected.size())", "check"),
          L('      `uvm_error("SCB/MISSING", $sformatf("%0d never received", expected.size()))', "check"),
          L("  endfunction"),
        ]
      : [
          L(""),
          L("  function void check_phase(uvm_phase phase);", "check"),
          L(policy === "per-id" ? "    foreach (exp_q[id]) foreach (exp_q[id][i])" : `    foreach (${policy === "in-order" ? "exp_q" : "exp_l"}[i])`, "check"),
          L('      `uvm_error("SCB/MISSING", "predicted but never seen")', "check"),
          L("    foreach (held_q[i])", "check"),
          L('      `uvm_error("SCB/UNEXPECTED", "seen but never predicted")', "check"),
          L("  endfunction"),
        ]
    : [L(""), L("  // no check_phase: leftovers are never reported", "check")];
  const drain =
    config.endOfTest === "until-idle" && policy !== "single-slot"
      ? [
          L(""),
          L("  bit drained;"),
          L("  function void phase_ready_to_end(uvm_phase phase);", "drain"),
          L('    if (phase.get_name() != "run" || outstanding == 0 || drained) return;', "drain"),
          L("    drained = 1;   // ready_to_end is called again after each drop", "drain"),
          L('    phase.raise_objection(this, "outstanding responses");', "drain"),
          L("    fork begin"),
          L("      fork"),
          L("        wait (outstanding == 0);", "drain"),
          L("        #60ns;   // watchdog", "drain"),
          L("      join_any"),
          L("      disable fork;"),
          L("      phase.drop_objection(this);", "drain"),
          L("    end join_none"),
          L("  endfunction"),
        ]
      : config.endOfTest === "until-idle"
        ? [
            L(""),
            L("  function void phase_ready_to_end(uvm_phase phase);", "drain"),
            L("    // waits while expected.size() > 0, with a 60 ns watchdog (as above)", "drain"),
            L("  endfunction"),
          ]
        : [];
  const tail = [L("endclass")];
  const testSide =
    config.endOfTest === "drain-time"
      ? [
          L(""),
          L("// in the test's run_phase", "drain"),
          L("seq.start(env.agt.sqr);", "drain"),
          L("phase.get_objection().set_drain_time(this, 30ns);", "drain"),
          L("phase.drop_objection(this);", "drain"),
        ]
      : config.endOfTest === "none"
        ? [L(""), L("// in the test's run_phase", "drain"), L("seq.start(env.agt.sqr);", "drain"), L("phase.drop_objection(this);  // no drain", "drain")]
        : [];
  return [...head, ...body, ...compare, ...check, ...drain, ...tail, ...testSide];
}

/* ========================================================================= */
/* Plain SystemVerilog tracker (F2B Dynamic Structures, Make It Work + Kata)  */
/* ========================================================================= */
/*
 * A model of the lesson's `tb_top`: an associative array of queues
 * (`bit [31:0] exp_by_id [int][$]`) used as an expected-by-ID tracker, and the
 * Kata's checker A (one `exp_q[$]` in request order). No UVM: add_expected /
 * check_actual are plain functions, the leftover check is a final block and
 * every report is $error.
 *
 * Rules implemented (IEEE 1800-2023):
 * - §7.8, §7.8.4: an associative array allocates no storage until used and
 *   keeps its entries in the order of the index type; for an integral index
 *   that is signed or unsigned numerical order, so `foreach` over int keys
 *   visits them in ascending signed order.
 * - §7.8.6: reading a nonexistent entry issues a warning and returns the
 *   nonexistent-entry value of Table 7-1 (§7.4.5; an empty queue for a queue
 *   element), which is why check_actual calls exists() before any read.
 * - §7.8.7: an entry is allocated when it is the target of an assignment
 *   (`exp_by_id[id] = {}`) or the actual of a ref argument. Whether
 *   `push_back` on a missing key allocates is not named there, so the lesson
 *   allocates explicitly.
 * - §7.9.2: delete(index) removes that entry (no warning if it is missing).
 * - §7.9.3: exists(index) returns 1 if the entry exists, otherwise 0.
 * - §7.10.2.4: pop_front() removes and returns the first item; on an empty
 *   queue it returns the Table 7-1 value ('0 for a 2-state element) and may
 *   warn. The per-ID tracker never pops an empty queue: it deletes a key as
 *   soon as its queue empties.
 * - §9.2.3: final procedures run at the end of simulation, in zero time.
 * - §20.10: $error prints a tool-specific message (severity, file, line, time,
 *   scope); "Error: " stands for that prefix here, as in the lesson.
 */

export type PlainSvChecker = "in-order" | "per-id";
export const PLAIN_SV_CHECKERS: PlainSvChecker[] = ["in-order", "per-id"];

export const plainSvCheckerInfo: Record<PlainSvChecker, { letter: "A" | "B"; title: string; container: string; rule: string }> = {
  "in-order": { letter: "A", title: "Checker A: one queue", container: "exp_q", rule: "one global order: compares with the oldest item of any ID" },
  "per-id": { letter: "B", title: "Checker B: one queue per ID", container: "exp_by_id", rule: "order only within an ID: compares with the oldest item for that ID" },
};

export interface PlainSvConfig {
  /** The lesson's `localparam bit INJECT_BUGS`: 1 plays a DUT that answers ID 1 out of order and never answers ID 3. */
  injectBugs: boolean;
  /** ["per-id"] is the Make It Work tracker; ["in-order", "per-id"] is the Kata's checker A beside checker B. */
  checkers: PlainSvChecker[];
}

/**
 * Turns a `compare` prop into the checkers the plain-SV view can run. Only the
 * in-order queue (checker A) and per-ID queues (checker B) exist in the
 * lesson; any other policy is returned in `ignored` so the view can say so.
 */
export function normalizePlainSvCheckers(compare?: readonly string[]): { checkers: PlainSvChecker[]; ignored: string[] } {
  const list = compare ?? [];
  const ignored = list.filter((p) => !(PLAIN_SV_CHECKERS as string[]).includes(p));
  const checkers: PlainSvChecker[] = list.includes("in-order") ? ["in-order", "per-id"] : ["per-id"];
  return { checkers, ignored };
}

/** `A1` for 32'hA1: the lesson's shorthand. */
export const svShort = (v: number) => v.toString(16).toUpperCase();
/** `32'hA1` as written in the source. */
export const svLit = (v: number) => `32'h${svShort(v)}`;
/** `%h` of a 32-bit value: 8 lowercase hex digits. */
export const svHex32 = (v: number | "x") => (v === "x" ? "xxxxxxxx" : (v >>> 0).toString(16).padStart(8, "0"));

/** The lesson's scripted traffic. */
export const F2B_ADDS: ReadonlyArray<readonly [number, number]> = [
  [1, 0xa1],
  [2, 0xb1],
  [1, 0xa2],
  [3, 0xc1],
];
export const F2B_FIRST_CHECK: readonly [number, number] = [2, 0xb1];
export const F2B_BUG_CHECKS: ReadonlyArray<readonly [number, number]> = [
  [1, 0xa2],
  [1, 0xa1],
];
export const F2B_OK_CHECKS: ReadonlyArray<readonly [number, number]> = [
  [1, 0xa1],
  [1, 0xa2],
  [3, 0xc1],
];
const F2B_MEM_WRITE = { addr: 0x1000, data: 0xdeadbeef };
const F2B_MEM_READS = [0x1000, 0x2000];

export type PlainSvCall =
  | { kind: "add"; id: number; data: number; key: string }
  | { kind: "check"; id: number; data: number; key: string }
  | { kind: "mem"; key: string }
  | { kind: "final"; key: string };

/** The calls the lesson's initial block makes, then final. The Make It Work bench also exercises the sparse memory. */
export function f2bLessonCalls(config: PlainSvConfig): PlainSvCall[] {
  const calls: PlainSvCall[] = F2B_ADDS.map(([id, data], i) => ({ kind: "add", id, data, key: `add-${i}` }));
  calls.push({ kind: "check", id: F2B_FIRST_CHECK[0], data: F2B_FIRST_CHECK[1], key: "chk-0" });
  const branch = config.injectBugs ? F2B_BUG_CHECKS : F2B_OK_CHECKS;
  branch.forEach(([id, data], i) => calls.push({ kind: "check", id, data, key: `${config.injectBugs ? "bug" : "ok"}-${i}` }));
  if (isMakeItWork(config)) calls.push({ kind: "mem", key: "mem-run" });
  calls.push({ kind: "final", key: "fin-foreach" });
  return calls;
}

const isMakeItWork = (config: PlainSvConfig) => !config.checkers.includes("in-order");

export interface PlainSvKeyRow {
  id: number;
  items: number[];
}

export interface PlainSvCounts {
  match: number;
  mismatch: number;
  /** Items counted by the final block; 0 until final runs. */
  pending: number;
}

export interface PlainSvSnapshot {
  /** exp_by_id, keys in ascending order (§7.8, §7.8.4). */
  byId: PlainSvKeyRow[];
  /** exp_q (checker A), oldest first. */
  inOrder: number[];
  counts: Record<PlainSvChecker, PlainSvCounts>;
}

export type PlainSvOutcome = "match" | "mismatch" | "unexpected";
export type PlainSvACause = "overtake" | "out-of-step";

/** Chip text for checker A's error when checker B matched the same response. */
export const plainSvACauseNote: Record<PlainSvACause, string> = {
  overtake: "false alarm: legal reorder across IDs",
  "out-of-step": "exp_q out of step",
};

export interface PlainSvCheckResult {
  checker: PlainSvChecker;
  outcome: PlainSvOutcome;
  id: number;
  actual: number;
  /** The item pop_front() returned, when the check got that far. */
  expected?: number;
  /** Key deleted because its queue emptied (per-ID only). */
  deletedKey?: number;
  /**
   * In-order only: checker A reported MISMATCH, checker B matched the same
   * response, and the item A popped was a real expected item taken in the
   * wrong order. Never set for UNEXPECTED: an empty exp_q is a desync, not a
   * reorder.
   */
  falseAlarm?: boolean;
  /**
   * In-order only, set when checker A errs while checker B matches.
   * "overtake": A popped an item of another ID that was still pending (a legal
   * reorder across IDs). "out-of-step": A's queue no longer lines up with the
   * responses, because an earlier response already took the item A pops (or
   * emptied exp_q).
   */
  aCause?: PlainSvACause;
  /** In-order only: a short chip text for aCause. */
  note?: string;
  /** One sentence that explains the result. */
  sentence: string;
}

export interface PlainSvStep {
  index: number;
  call: PlainSvCall;
  /** `check_actual(2, 32'hB1)`, `final`, … */
  label: string;
  /** Steps the learner predicts before they run: every check_actual and final. */
  gated: boolean;
  results: PlainSvCheckResult[];
  allocatedKey?: number;
  deletedKey?: number;
  before: PlainSvSnapshot;
  after: PlainSvSnapshot;
  /** Output lines this step prints. */
  log: string[];
  /** The call's own line in the initial block (or the first line of final). */
  callKey: string;
  /** The line that decided the outcome. */
  activeKey: string;
  contextKeys: string[];
  what: string;
  why: string;
}

export interface PlainSvSummary {
  checker: PlainSvChecker;
  counts: PlainSvCounts;
  line: string;
}

export interface PlainSvResult {
  config: PlainSvConfig;
  steps: PlainSvStep[];
  summaries: PlainSvSummary[];
  log: string[];
  /** Keys left in exp_by_id when final runs: the pending IDs. */
  pendingKeys: PlainSvKeyRow[];
}

const rowsText = (rows: PlainSvKeyRow[]) => (rows.length ? rows.map((r) => `${r.id}:[${r.items.map(svShort).join(", ")}]`).join(" ") : "empty");
const listText = (items: number[]) => `[${items.map(svShort).join(", ")}]`;

/** The SCB_SUMMARY line exactly as the lesson's $display formats it. */
export function plainSvSummaryLine(counts: PlainSvCounts, prefix = ""): string {
  return `${prefix}SCB_SUMMARY matches=${counts.match} mismatches=${counts.mismatch} pending=${counts.pending}`;
}

/** mem_read(): exists() first, so an unwritten address returns 'x without a warning or an allocation (§7.9.3, §7.8.6). */
export function sparseMemRead(mem: ReadonlyMap<number, number>, addr: number): number | "x" {
  return mem.has(addr) ? mem.get(addr)! : "x";
}

/**
 * What an unguarded read would do (§7.8.6, §7.10.2.4): `exp_by_id[id]` on a
 * missing key warns and yields an empty queue; pop_front() on that returns
 * '0 for `bit [31:0]` and may warn. A response with data 0 would then pass.
 *
 * Assumption, which differs between simulators: `exp_by_id[id].pop_front()`
 * is treated as a read of the missing entry (§7.8.6 warning). pop_front()
 * also changes the element it is called on, and §7.8.7 names allocation only
 * for an assignment target, a ref actual, or read-and-write constructs such
 * as ++; the standard does not say whether this method call allocates the
 * key. `readWarns` records the §7.8.6 reading, not every tool's behaviour.
 */
export function unguardedPop(byId: ReadonlyMap<number, number[]>, id: number): { value: number; readWarns: boolean; popMayWarn: boolean } {
  const q = byId.get(id);
  if (q && q.length) return { value: q[0], readWarns: false, popMayWarn: false };
  return { value: 0, readWarns: !q, popMayWarn: true };
}

/**
 * Runs the lesson's traffic through the chosen checkers. `calls` replaces the
 * traffic (tests use it to reach the UNEXPECTED path, which the lesson's
 * script never takes); it must end with a final call.
 */
export function runPlainSvScoreboard(config: PlainSvConfig, calls: PlainSvCall[] = f2bLessonCalls(config)): PlainSvResult {
  const both = config.checkers.includes("in-order");
  const prefix = (c: PlainSvChecker) => (both ? `${plainSvCheckerInfo[c].letter}: ` : "");
  const byId = new Map<number, number[]>();
  const expQ: number[] = [];
  // Bookkeeping the SV source does not have: which request each queued item
  // came from, so the model can tell a legal overtake from a desync.
  const expQReq: { id: number; seq: number }[] = [];
  const seqById = new Map<number, number[]>();
  let nextSeq = 0;
  const mem = new Map<number, number>();
  const counts: Record<PlainSvChecker, PlainSvCounts> = {
    "in-order": { match: 0, mismatch: 0, pending: 0 },
    "per-id": { match: 0, mismatch: 0, pending: 0 },
  };
  const snap = (): PlainSvSnapshot => ({
    byId: [...byId.keys()].sort((a, b) => a - b).map((id) => ({ id, items: [...byId.get(id)!] })),
    inOrder: [...expQ],
    counts: { "in-order": { ...counts["in-order"] }, "per-id": { ...counts["per-id"] } },
  });
  const branchKey = (key: string) => (key.startsWith("bug") || key.startsWith("ok") ? ["inject-if"] : []);
  const steps: PlainSvStep[] = [];

  calls.forEach((call, index) => {
    const before = snap();
    const log: string[] = [];
    if (call.kind === "add") {
      const existed = byId.has(call.id); // §7.9.3
      if (!existed) byId.set(call.id, []); // §7.8.7: assignment allocates the key
      byId.get(call.id)!.push(call.data);
      const seq = nextSeq++;
      if (!seqById.has(call.id)) seqById.set(call.id, []);
      seqById.get(call.id)!.push(seq);
      if (both) {
        expQ.push(call.data);
        expQReq.push({ id: call.id, seq });
      }
      const q = byId.get(call.id)!;
      const what = existed
        ? `add_expected(${call.id}, ${svLit(call.data)}): key ${call.id} already exists, so push_back puts ${svShort(call.data)} behind the older items: exp_by_id[${call.id}] = ${listText(q)}.`
        : `add_expected(${call.id}, ${svLit(call.data)}): key ${call.id} is new, so exp_by_id[${call.id}] = {} allocates it, then push_back adds ${svShort(call.data)}.`;
      const why = existed
        ? `exists(${call.id}) returns 1 (§7.9.3), so nothing is allocated. Within one ID the queue keeps request order, oldest at the front.`
        : `exists(${call.id}) returns 0 (§7.9.3). Assigning to a missing key allocates the entry (§7.8.7); the lesson does it explicitly because §7.8.7 does not name push_back on a missing key.`;
      steps.push({
        index, call, label: `add_expected(${call.id}, ${svLit(call.data)})`, gated: false, results: [],
        allocatedKey: existed ? undefined : call.id, before, after: snap(), log,
        callKey: call.key, activeKey: existed ? "add-push" : "add-alloc",
        contextKeys: [call.key, "add-alloc", "add-push", ...(both ? ["add-pushq"] : [])],
        what: both ? `${what} Checker A also appends it to exp_q = ${listText(expQ)}.` : what,
        why,
      });
      return;
    }

    if (call.kind === "check") {
      const results: PlainSvCheckResult[] = [];
      const ctx: string[] = [call.key, ...branchKey(call.key)];
      let activeKey = "b-compare";
      let aPopped: { id: number; seq: number } | undefined;
      if (both) {
        // Checker A runs first in the Kata's check_actual.
        if (expQ.length === 0) {
          counts["in-order"].mismatch += 1;
          log.push(`Error: ${prefix("in-order")}UNEXPECTED id=${call.id} data=${svHex32(call.data)}`);
          results.push({ checker: "in-order", outcome: "unexpected", id: call.id, actual: call.data, sentence: `Checker A: exp_q is empty, so the response is UNEXPECTED.` });
          ctx.push("a-size", "a-unexp");
        } else {
          const exp = expQ.shift()!; // §7.10.2.4
          aPopped = expQReq.shift();
          const ok = exp === call.data;
          if (ok) counts["in-order"].match += 1;
          else {
            counts["in-order"].mismatch += 1;
            log.push(`Error: ${prefix("in-order")}MISMATCH id=${call.id} exp=${svHex32(exp)} act=${svHex32(call.data)}`);
          }
          results.push({
            checker: "in-order", outcome: ok ? "match" : "mismatch", id: call.id, actual: call.data, expected: exp,
            sentence: ok
              ? `Checker A: pop_front() on exp_q returns ${svShort(exp)}, equal to the response: match.`
              : `Checker A: pop_front() on exp_q returns ${svShort(exp)}, the oldest item of any ID, but the response is ${svShort(call.data)}: MISMATCH.`,
          });
          ctx.push("a-size", "a-pop", "a-compare", ok ? "a-match" : "a-mismatch");
        }
      }
      // Whether the item checker A popped was still waiting in checker B, decided before B pops.
      const aItemPending = aPopped !== undefined && (seqById.get(aPopped.id) ?? []).includes(aPopped.seq);
      // Checker B: the per-ID tracker.
      if (!byId.has(call.id)) {
        // §7.9.3: exists() is 0, so nothing is read (§7.8.6 would warn).
        counts["per-id"].mismatch += 1;
        log.push(`Error: ${prefix("per-id")}UNEXPECTED id=${call.id} data=${svHex32(call.data)}`);
        results.push({
          checker: "per-id", outcome: "unexpected", id: call.id, actual: call.data,
          sentence: `${both ? "Checker B: " : ""}exists(${call.id}) returns 0, so no request with ID ${call.id} is waiting: UNEXPECTED, and the function returns before it reads anything.`,
        });
        ctx.push("b-exists", "b-unexp");
        activeKey = "b-unexp";
      } else {
        const q = byId.get(call.id)!;
        const exp = q.length ? q.shift()! : 0; // §7.10.2.4 (never empty here: emptied keys are deleted)
        seqById.get(call.id)?.shift();
        const ok = exp === call.data;
        if (ok) counts["per-id"].match += 1;
        else {
          counts["per-id"].mismatch += 1;
          log.push(`Error: ${prefix("per-id")}MISMATCH id=${call.id} exp=${svHex32(exp)} act=${svHex32(call.data)}`);
        }
        let deletedKey: number | undefined;
        if (q.length === 0) {
          byId.delete(call.id); // §7.9.2
          seqById.delete(call.id);
          deletedKey = call.id;
        }
        const lead = `${both ? "Checker B: " : ""}exists(${call.id}) returns 1 and pop_front() returns ${svShort(exp)}, the oldest item for ID ${call.id}`;
        const tail =
          deletedKey !== undefined
            ? ` The queue is now empty, so delete(${call.id}) removes key ${call.id}.`
            : ` exp_by_id[${call.id}] still holds ${listText(q)}, so key ${call.id} stays.`;
        results.push({
          checker: "per-id", outcome: ok ? "match" : "mismatch", id: call.id, actual: call.data, expected: exp, deletedKey,
          sentence: ok
            ? `${lead}; it equals the response: match.${tail}`
            : `${lead}, but the response is ${svShort(call.data)}: MISMATCH. The popped item is gone all the same.${tail}`,
        });
        ctx.push("b-exists", "b-pop", "b-compare", ok ? "b-match" : "b-mismatch", "b-delete");
        activeKey = deletedKey !== undefined ? "b-delete" : ok ? "b-match" : "b-mismatch";
      }
      const a = results.find((r) => r.checker === "in-order");
      const b = results.find((r) => r.checker === "per-id")!;
      if (a && a.outcome !== "match" && b.outcome === "match") {
        // A real overtake: A popped an item of another ID that B still had waiting.
        const overtake = a.outcome === "mismatch" && aPopped !== undefined && aPopped.id !== call.id && aItemPending;
        a.aCause = overtake ? "overtake" : "out-of-step";
        a.note = plainSvACauseNote[a.aCause];
        // A MISMATCH on a real expected item is a false alarm; an empty exp_q (UNEXPECTED) is a desync, never a reorder.
        if (a.outcome === "mismatch") a.falseAlarm = true;
      }
      const why = a?.aCause === "overtake"
        ? `False alarm in checker A: answers for different IDs may overtake each other, and checker B matched the same response. A single in-order queue reads a legal reorder across IDs as an error, and its queue is then out of step.`
        : a?.aCause === "out-of-step" && a.outcome === "mismatch"
          ? aItemPending
            ? `False alarm in checker A: checker B matched this response. The item checker A popped, ${svShort(a.expected!)} for ID ${aPopped!.id}, is still waiting, but an earlier response already popped this response's item from exp_q, so exp_q is out of step.`
            : `False alarm in checker A: checker B matched this response, but the item checker A popped, ${svShort(a.expected!)} for ID ${aPopped!.id}, was already taken by an earlier response for ID ${aPopped!.id}. exp_q is out of step, so its front no longer lines up with the responses.`
          : a?.aCause === "out-of-step"
            ? `exp_q is empty because an earlier response already consumed this item, so checker A is out of step; checker B still had ${svShort(call.data)} waiting for ID ${call.id} and matched it.`
            : b.outcome === "unexpected"
          ? `Calling exists() first keeps the check from reading a missing key, which would warn and return the default value (§7.8.6).`
          : b.outcome === "mismatch"
            ? `Responses with the same ID must return in request order, so the oldest item for ID ${call.id} is the only legal partner. pop_front() removes it whether or not it matches (§7.10.2.4).${
                a?.outcome === "mismatch" && a.expected !== b.expected
                  ? ` Checker A also fires, but its expected ${svShort(a.expected!)} is not the oldest item for ID ${call.id}: exp_q is out of step after an earlier response, so A's exp= value does not describe this bug.`
                  : ""
              }`
            : b.deletedKey !== undefined
              ? `Deleting a key when its queue empties (§7.9.2) keeps an invariant: the keys left are exactly the IDs still waiting, and no queue that exists is ever empty.`
              : `pop_front() removes and returns the front item (§7.10.2.4); the next response for ID ${call.id} meets the item behind it.`;
      steps.push({
        index, call, label: `check_actual(${call.id}, ${svLit(call.data)})`, gated: true, results,
        deletedKey: b.deletedKey, before, after: snap(), log, callKey: call.key, activeKey, contextKeys: ctx,
        what: results.map((r) => r.sentence).join(" "),
        why,
      });
      return;
    }

    if (call.kind === "mem") {
      mem.set(F2B_MEM_WRITE.addr, F2B_MEM_WRITE.data); // §7.8.7
      const [r1, r2] = F2B_MEM_READS.map((addr) => sparseMemRead(mem, addr));
      log.push(`mem[${F2B_MEM_READS[0].toString(16)}]=${svHex32(r1)} mem[${F2B_MEM_READS[1].toString(16)}]=${svHex32(r2)}`);
      steps.push({
        index, call, label: "sparse memory write and reads", gated: false, results: [], before, after: snap(), log,
        callKey: call.key, activeKey: "mem", contextKeys: [call.key, "mem"],
        what: `mem[32'h${F2B_MEM_WRITE.addr.toString(16)}] = 32'h${F2B_MEM_WRITE.data.toString(16).toUpperCase()} allocates one entry. mem_read(32'h${F2B_MEM_READS[1].toString(16)}) calls exists() first and returns 'x, so the unwritten address is not allocated and gives no warning. The lesson's trace table has no row for this step, so final comes one step later here.`,
        why: `An assignment allocates an associative-array entry (§7.8.7); exists() reads nothing (§7.9.3), so the missing-key warning of §7.8.6 never fires.`,
      });
      return;
    }

    // final (§9.2.3)
    const pendingKeys = snap().byId;
    for (const row of pendingKeys) {
      log.push(`Error: ${prefix("per-id")}PENDING id=${row.id} count=${row.items.length}`);
      counts["per-id"].pending += row.items.length;
    }
    if (both) {
      if (expQ.length > 0) log.push(`Error: ${prefix("in-order")}PENDING count=${expQ.length}`);
      counts["in-order"].pending = expQ.length;
    }
    const summaries: PlainSvSummary[] = config.checkers.map((c) => ({ checker: c, counts: { ...counts[c] }, line: plainSvSummaryLine(counts[c], prefix(c)) }));
    for (const s of summaries) log.push(s.line);
    const pendText = pendingKeys.length
      ? `foreach visits the keys left, in key order (§7.8, §7.8.4): ${pendingKeys.map((r) => `key ${r.id} holds ${r.items.length}`).join(", ")}, so $error reports PENDING for each (§20.10).`
      : "foreach finds no keys: every queue emptied and its key was deleted, so nothing is pending.";
    const pass = summaries.every((s) => s.counts.mismatch === 0 && s.counts.pending === 0);
    steps.push({
      index, call, label: "final", gated: true, results: [], before, after: snap(), log,
      callKey: call.key, activeKey: "fin-summary",
      contextKeys: ["fin-foreach", ...(pendingKeys.length ? ["fin-pending"] : []), ...(both ? ["fin-a-pending"] : []), "fin-summary"],
      what: `final runs once, at the end of simulation (§9.2.3). ${pendText}${both ? ` Checker A has ${expQ.length} item(s) left in exp_q.` : ""}`,
      why: pass
        ? "The pass signature: mismatches=0 and pending=0 with no Error lines."
        : `The run fails: the pass signature needs mismatches=0 and pending=0. ${pendingKeys.length ? "A leftover key is a response that never came; without the final check this bench would stay silent about it." : ""}`.trim(),
    });
  });

  const final = steps[steps.length - 1];
  const summaries: PlainSvSummary[] = config.checkers.map((c) => ({ checker: c, counts: { ...final.after.counts[c] }, line: plainSvSummaryLine(final.after.counts[c], prefix(c)) }));
  return { config, steps, summaries, log: steps.flatMap((s) => s.log), pendingKeys: final.before.byId };
}

/* ------------------------------------------------------------------------- */
/* Prediction options, generated from the run                                 */
/* ------------------------------------------------------------------------- */

export interface PlainSvOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

const outcomeLabel: Record<PlainSvOutcome, string> = { match: "match", mismatch: "MISMATCH", unexpected: "UNEXPECTED" };

function whyNot(chosen: PlainSvOutcome, r: PlainSvCheckResult, before: PlainSvSnapshot): string {
  const row = before.byId.find((k) => k.id === r.id);
  if (chosen === "unexpected") return `exists(${r.id}) returns 1: key ${r.id} holds ${listText(row?.items ?? [])}, so the check goes on to pop_front().`;
  if (r.outcome === "unexpected") return chosen === "match" ? `There is nothing to match: key ${r.id} does not exist.` : `A MISMATCH needs an item to compare with, and key ${r.id} does not exist.`;
  if (chosen === "match") return `The front of exp_by_id[${r.id}] is ${svShort(r.expected!)}, not ${svShort(r.actual)}: order within one ID is checked, so the response must equal the oldest item.`;
  return `The front of exp_by_id[${r.id}] is ${svShort(r.expected!)}, exactly the response.`;
}

/** Options for "what does this check_actual report?". */
export function plainSvVerdictOptions(step: PlainSvStep): PlainSvOption[] {
  const a = step.results.find((r) => r.checker === "in-order");
  const b = step.results.find((r) => r.checker === "per-id")!;
  if (!a) {
    return (["match", "mismatch", "unexpected"] as PlainSvOutcome[]).map((o) => ({
      id: o,
      label: outcomeLabel[o],
      correct: o === b.outcome,
      feedback: o === b.outcome ? b.sentence : whyNot(o, b, step.before),
    }));
  }
  const errA = a.outcome !== "match";
  const errB = b.outcome !== "match";
  const combos: { id: string; label: string; a: boolean; b: boolean }[] = [
    { id: "neither", label: "Neither checker", a: false, b: false },
    { id: "a", label: "Checker A only", a: true, b: false },
    { id: "b", label: "Checker B only", a: false, b: true },
    { id: "both", label: "Both checkers", a: true, b: true },
  ];
  return combos.map((c) => {
    const correct = c.a === errA && c.b === errB;
    const parts: string[] = [];
    if (correct) parts.push(a.sentence, b.sentence);
    else {
      if (c.a !== errA) parts.push(a.sentence);
      if (c.b !== errB) parts.push(b.sentence);
    }
    if (correct && a.aCause === "overtake") parts.push("Checker A's error is a false alarm: the reorder across IDs is legal.");
    else if (correct && a.aCause === "out-of-step")
      parts.push(
        a.outcome === "mismatch"
          ? "Checker A's error is a false alarm: checker B matched, and exp_q is out of step after an earlier response."
          : "Checker A is out of step: an earlier response already emptied exp_q, while checker B still had this item waiting.",
      );
    return { id: c.id, label: c.label, correct, feedback: parts.join(" ") };
  });
}

/** Options for "which key of exp_by_id disappears?". */
export function plainSvKeyOptions(step: PlainSvStep): PlainSvOption[] {
  const b = step.results.find((r) => r.checker === "per-id")!;
  const ids = step.before.byId.map((k) => k.id);
  if (!ids.includes(b.id)) ids.push(b.id);
  ids.sort((x, y) => x - y);
  const left = step.after.byId.map((k) => k.id);
  const afterRow = step.after.byId.find((k) => k.id === b.id);
  const stays =
    b.outcome === "unexpected"
      ? `check_actual returns at the exists() guard, so it deletes nothing.`
      : `exp_by_id[${b.id}] still holds ${listText(afterRow?.items ?? [])} after the pop, so key ${b.id} stays.`;
  const options: PlainSvOption[] = [
    {
      id: "none",
      label: "No key",
      correct: step.deletedKey === undefined,
      feedback: step.deletedKey === undefined ? stays : `The pop takes the last item for ID ${b.id}, and the delete line runs when size() is 0.`,
    },
  ];
  for (const id of ids) {
    const correct = step.deletedKey === id;
    const row = step.before.byId.find((k) => k.id === id);
    options.push({
      id: `key-${id}`,
      label: `Key ${id}`,
      correct,
      feedback: correct
        ? `pop_front() leaves exp_by_id[${id}] empty, so delete(${id}) removes key ${id} (§7.9.2). ${left.length ? `The keys left, ${left.join(", ")}, are the IDs still pending.` : "No keys are left, so no ID is still pending."}`
        : id === b.id
          ? stays
          : `check_actual(${b.id}, …) touches only key ${b.id}; key ${id} keeps ${listText(row?.items ?? [])}.`,
    });
  }
  return options;
}

/** Options for "what does the SCB_SUMMARY line print?" (checker A's line when both checkers run). */
export function plainSvSummaryOptions(config: PlainSvConfig): { checker: PlainSvChecker; options: PlainSvOption[] } {
  const run = runPlainSvScoreboard(config);
  const other = runPlainSvScoreboard({ ...config, injectBugs: !config.injectBugs });
  const both = config.checkers.includes("in-order");
  const asked: PlainSvChecker = both ? "in-order" : "per-id";
  const pre = both ? "A: " : "";
  const c = run.summaries.find((s) => s.checker === asked)!.counts;
  const otherCounts = other.summaries.find((s) => s.checker === asked)!.counts;
  const rivalChecker: PlainSvChecker = asked === "per-id" ? "in-order" : "per-id";
  const rival = runPlainSvScoreboard({ injectBugs: config.injectBugs, checkers: ["in-order", "per-id"] }).summaries.find((s) => s.checker === rivalChecker)!.counts;
  const mismatchCalls = run.steps.flatMap((s) => s.results.filter((r) => r.checker === asked && r.outcome !== "match").map(() => s.label));
  const correctFeedback = `${c.match} compare(s) matched and ${c.mismatch} did not${mismatchCalls.length ? ` (${mismatchCalls.join(", ")})` : ""}; final counts ${c.pending} leftover item(s).`;
  const candidates: PlainSvOption[] = [
    { id: "correct", label: plainSvSummaryLine(c, pre), correct: true, feedback: correctFeedback },
    {
      id: "no-leftovers",
      label: plainSvSummaryLine({ ...c, pending: 0 }, pre),
      correct: false,
      feedback: `The compares are right, but final still finds ${c.pending} item(s) queued for responses that never came, and pending counts them.`,
    },
    {
      id: "other-inject",
      label: plainSvSummaryLine(otherCounts, pre),
      correct: false,
      feedback: `That is the line for INJECT_BUGS = ${config.injectBugs ? 0 : 1}. Here INJECT_BUGS = ${config.injectBugs ? 1 : 0}: ${correctFeedback}`,
    },
    {
      id: "other-checker",
      label: plainSvSummaryLine(rival, pre),
      correct: false,
      feedback:
        asked === "in-order"
          ? `Those are the per-ID counts (checker B). Checker A compares with the oldest item of any ID, so the legal overtake of ID 2 costs it: ${correctFeedback}`
          : `Those are the counts of a single in-order queue: the legal overtake of ID 2 gives it a false MISMATCH and puts its queue out of step${config.injectBugs ? ", on top of the real bug" : ""}. exp_by_id keeps order only within an ID: ${correctFeedback}`,
    },
  ];
  const seen = new Set<string>();
  const options = candidates.filter((o) => (seen.has(o.label) ? false : (seen.add(o.label), true)));
  options.sort((x, y) => (x.label < y.label ? -1 : x.label > y.label ? 1 : 0));
  return { checker: asked, options };
}

/* ------------------------------------------------------------------------- */
/* Past the lesson: a stray response, guarded against unguarded               */
/* ------------------------------------------------------------------------- */

/** The probe's stray response: an ID the script never requests, with data 0. */
export const F2B_STRAY: readonly [number, number] = [9, 0];

export interface PlainSvStrayProbe {
  id: number;
  data: number;
  /** `check_actual(9, 32'h0)` */
  label: string;
  /** The guarded check: the lesson's script with the stray response just before final. */
  step: PlainSvStep;
  verdictOptions: PlainSvOption[];
  /** What `expected = exp_by_id[id].pop_front();` would do on the same state without the exists() guard. */
  unguarded: { value: number; readWarns: boolean; popMayWarn: boolean; passes: boolean };
  unguardedOptions: PlainSvOption[];
  /** The explanation of the unguarded read, generated from `unguarded`. */
  unguardedText: string;
}

/**
 * Sends one response the script never asked for, after the lesson's calls and
 * before final, and sets the guarded check beside an unguarded read of the
 * same state (§7.9.3, §7.8.6, §7.10.2.4). Not part of the lesson's output.
 */
export function plainSvStrayProbe(config: PlainSvConfig, id: number = F2B_STRAY[0], data: number = F2B_STRAY[1]): PlainSvStrayProbe {
  const lesson = f2bLessonCalls(config);
  if (lesson.some((c) => c.kind === "add" && c.id === id)) throw new Error(`plainSvStrayProbe: ID ${id} is requested by the script, so it is not a stray`);
  const calls: PlainSvCall[] = [...lesson.slice(0, -1), { kind: "check", id, data, key: "stray" }, lesson[lesson.length - 1]];
  const run = runPlainSvScoreboard(config, calls);
  const step = run.steps[calls.length - 2];
  const both = config.checkers.includes("in-order");
  const u = unguardedPop(new Map(step.before.byId.map((r) => [r.id, r.items])), id);
  const passes = u.value === data;
  const label = `check_actual(${id}, ${svLit(data)})`;
  const outcomeText = passes
    ? `'0 equals the response data ${svLit(data)}, so the compare passes and ${both ? "b_match" : "n_match"} counts a response nobody requested.`
    : `'0 differs from the response data ${svLit(data)}, so the compare reports MISMATCH exp=${svHex32(u.value)}, which hides that no request with ID ${id} was ever made.`;
  const unguardedText = [
    `Without the exists() guard, ${both ? "checker B's " : ""}expected = exp_by_id[${id}].pop_front() reads exp_by_id[${id}], a nonexistent entry: §7.8.6 says a warning shall be issued and the nonexistent-entry value is returned, an empty queue (Table 7-1).`,
    `pop_front() on an empty queue returns '0 for bit [31:0] and may warn (§7.10.2.4).`,
    outcomeText,
    `The warning is the only sign, and simulators differ here: pop_front() changes the element it is called on, while §7.8.7 names allocation only for an assignment target, a ref argument or a read-and-write construct such as ++, so whether a tool warns or allocates key ${id} is not stated.`,
  ].join(" ");
  const unguardedOptions: PlainSvOption[] = [
    {
      id: "x",
      label: "pop_front() returns 'x, so the compare fails",
      correct: false,
      feedback: `The queues in exp_by_id hold bit [31:0], a 2-state type. The nonexistent-entry value is '0, not 'x (§7.10.2.4, Table 7-1).`,
    },
    {
      id: "default",
      label: passes ? "pop_front() returns '0, so the compare passes" : "pop_front() returns '0, so the compare reports MISMATCH",
      correct: true,
      feedback: outcomeText,
    },
    {
      id: "stop",
      label: "The read stops the simulation with an error",
      correct: false,
      feedback: "§7.8.6 calls for a warning and the nonexistent-entry value, not an error: the run carries on with '0.",
    },
    {
      id: "unexpected",
      label: "It still prints UNEXPECTED",
      correct: false,
      feedback: "Only the exists() branch prints UNEXPECTED. Without it, nothing notices that the key is missing.",
    },
  ];
  return { id, data, label, step, verdictOptions: plainSvVerdictOptions(step), unguarded: { ...u, passes }, unguardedOptions, unguardedText };
}

/* ------------------------------------------------------------------------- */
/* The lesson's source, generated                                              */
/* ------------------------------------------------------------------------- */

const CHECK_COMMENTS: Record<string, string> = {
  "chk-0": "    // legal: ID 2 overtakes ID 1",
  "bug-0": "  // DUT bug: ID 1 answers out of order",
  "bug-1": "  // ...and ID 3 never answers",
};

function initialBlock(withComments: boolean): SbCodeLine[] {
  const call = (fn: string, id: number, data: number, key: string, indent: string) =>
    L(`${indent}${fn}(${id}, ${svLit(data)});${withComments ? (CHECK_COMMENTS[key] ?? "") : ""}`, key);
  return [
    L("  initial begin"),
    ...F2B_ADDS.map(([id, d], i) => call("add_expected", id, d, `add-${i}`, "    ")),
    call("check_actual", F2B_FIRST_CHECK[0], F2B_FIRST_CHECK[1], "chk-0", "    "),
    L("    if (INJECT_BUGS) begin", "inject-if"),
    ...F2B_BUG_CHECKS.map(([id, d], i) => call("check_actual", id, d, `bug-${i}`, "      ")),
    L("    end else begin", "inject-if"),
    ...F2B_OK_CHECKS.map(([id, d], i) => call("check_actual", id, d, `ok-${i}`, "      ")),
    L("    end"),
  ];
}

/**
 * The lesson's plain-SV bench: the Make It Work tracker for ["per-id"], the
 * Kata's two-checker solution when "in-order" is included. Plain modules,
 * functions, a final block and $error only.
 */
export function plainSvScoreboardSource(config: PlainSvConfig): SbCodeLine[] {
  const param = L(`  localparam bit INJECT_BUGS = ${config.injectBugs ? 1 : 0};${isMakeItWork(config) ? "  // 0 replays the same traffic from a correct DUT" : ""}`, "param");
  if (isMakeItWork(config)) {
    return [
      L("// A plain-SV expected-transaction tracker and sparse memory model (no DUT, no UVM)."),
      L("module tb_top;"),
      param,
      L(""),
      L("  bit [31:0]   exp_by_id [int][$];  // expected data per ID, oldest first", "decl"),
      L("  logic [31:0] mem [bit [31:0]];    // sparse memory: only written addresses exist"),
      L("  int n_match, n_mismatch, n_pending;"),
      L(""),
      L("  // Record what the DUT must return for a request with this ID."),
      L("  function automatic void add_expected(int id, bit [31:0] data);"),
      L("    if (!exp_by_id.exists(id)) exp_by_id[id] = {};  // allocate the key explicitly", "add-alloc"),
      L("    exp_by_id[id].push_back(data);", "add-push"),
      L("  endfunction"),
      L(""),
      L("  // Check one response against the oldest outstanding item of the same ID."),
      L("  function automatic void check_actual(int id, bit [31:0] data);"),
      L("    bit [31:0] expected;"),
      L("    if (!exp_by_id.exists(id)) begin  // never read a key you have not checked", "b-exists"),
      L('      $error("UNEXPECTED id=%0d data=%h", id, data);', "b-unexp"),
      L("      n_mismatch++;", "b-unexp"),
      L("      return;", "b-unexp"),
      L("    end"),
      L("    expected = exp_by_id[id].pop_front();  // order must hold within one ID", "b-pop"),
      L("    if (expected !== data) begin", "b-compare"),
      L('      $error("MISMATCH id=%0d exp=%h act=%h", id, expected, data);', "b-mismatch"),
      L("      n_mismatch++;", "b-mismatch"),
      L("    end else begin"),
      L("      n_match++;", "b-match"),
      L("    end"),
      L("    if (exp_by_id[id].size() == 0) exp_by_id.delete(id);  // keys = pending IDs", "b-delete"),
      L("  endfunction"),
      L(""),
      L("  // An unwritten address reads x without the missing-key warning."),
      L("  function automatic logic [31:0] mem_read(bit [31:0] addr);"),
      L("    return mem.exists(addr) ? mem[addr] : 'x;", "mem"),
      L("  endfunction"),
      L(""),
      ...initialBlock(true),
      L("    mem[32'h1000] = 32'hDEAD_BEEF;", "mem-run"),
      L('    $display("mem[1000]=%h mem[2000]=%h", mem_read(32\'h1000), mem_read(32\'h2000));', "mem-run"),
      L("  end  // no clock: the run ends here, then final runs"),
      L(""),
      L("  final begin", "fin-foreach"),
      L("    foreach (exp_by_id[id]) begin", "fin-foreach"),
      L('      $error("PENDING id=%0d count=%0d", id, exp_by_id[id].size());', "fin-pending"),
      L("      n_pending += exp_by_id[id].size();", "fin-pending"),
      L("    end"),
      L('    $display("SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",', "fin-summary"),
      L("             n_match, n_mismatch, n_pending);", "fin-summary"),
      L("  end"),
      L("endmodule"),
    ];
  }
  return [
    L("module tb_top;"),
    param,
    L(""),
    L("  bit [31:0] exp_by_id [int][$];  // checker B: one queue per ID", "decl"),
    L("  bit [31:0] exp_q [$];           // checker A: one queue in request order", "decl-a"),
    L("  int a_match, a_mismatch;"),
    L("  int b_match, b_mismatch, b_pending;"),
    L(""),
    L("  function automatic void add_expected(int id, bit [31:0] data);"),
    L("    if (!exp_by_id.exists(id)) exp_by_id[id] = {};", "add-alloc"),
    L("    exp_by_id[id].push_back(data);", "add-push"),
    L("    exp_q.push_back(data);", "add-pushq"),
    L("  endfunction"),
    L(""),
    L("  function automatic void check_actual(int id, bit [31:0] data);"),
    L("    bit [31:0] expected;"),
    L("    // Checker A assumes one global order."),
    L("    if (exp_q.size() == 0) begin", "a-size"),
    L('      $error("A: UNEXPECTED id=%0d data=%h", id, data);', "a-unexp"),
    L("      a_mismatch++;", "a-unexp"),
    L("    end else begin"),
    L("      expected = exp_q.pop_front();", "a-pop"),
    L("      if (expected !== data) begin", "a-compare"),
    L('        $error("A: MISMATCH id=%0d exp=%h act=%h", id, expected, data);', "a-mismatch"),
    L("        a_mismatch++;", "a-mismatch"),
    L("      end else a_match++;", "a-match"),
    L("    end"),
    L("    // Checker B keeps order only within an ID."),
    L("    if (!exp_by_id.exists(id)) begin", "b-exists"),
    L('      $error("B: UNEXPECTED id=%0d data=%h", id, data);', "b-unexp"),
    L("      b_mismatch++;", "b-unexp"),
    L("      return;", "b-unexp"),
    L("    end"),
    L("    expected = exp_by_id[id].pop_front();", "b-pop"),
    L("    if (expected !== data) begin", "b-compare"),
    L('      $error("B: MISMATCH id=%0d exp=%h act=%h", id, expected, data);', "b-mismatch"),
    L("      b_mismatch++;", "b-mismatch"),
    L("    end else b_match++;", "b-match"),
    L("    if (exp_by_id[id].size() == 0) exp_by_id.delete(id);", "b-delete"),
    L("  endfunction"),
    L(""),
    ...initialBlock(false),
    L("  end"),
    L(""),
    L("  final begin", "fin-foreach"),
    L("    foreach (exp_by_id[id]) begin", "fin-foreach"),
    L('      $error("B: PENDING id=%0d count=%0d", id, exp_by_id[id].size());', "fin-pending"),
    L("      b_pending += exp_by_id[id].size();", "fin-pending"),
    L("    end"),
    L('    if (exp_q.size() > 0) $error("A: PENDING count=%0d", exp_q.size());', "fin-a-pending"),
    L('    $display("A: SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",', "fin-summary"),
    L("             a_match, a_mismatch, exp_q.size());", "fin-summary"),
    L('    $display("B: SCB_SUMMARY matches=%0d mismatches=%0d pending=%0d",', "fin-summary"),
    L("             b_match, b_mismatch, b_pending);", "fin-summary"),
    L("  end"),
    L("endmodule"),
  ];
}
