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
