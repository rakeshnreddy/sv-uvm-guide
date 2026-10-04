/**
 * Deterministic cycle model of a virtual sequence coordinating a config agent
 * (APB register writes) and a data agent, plus an interrupt agent.
 *
 * DUT: data is accepted only while CTRL.EN = 1. cfg_seq writes SRC, then
 * CTRL.EN = 1 (two APB writes of two cycles each), so EN is visible 4 cycles
 * after cfg_seq starts. Data sent while EN = 0, or while reset is asserted, is
 * dropped. Accepted data appears at the output 2 cycles later. A reset clears
 * EN and discards in-flight data.
 *
 * Testbench: the scoreboard predicts one output per data item the input
 * monitor sees (its predictor does not model EN), drains with an objection
 * until nothing is outstanding (at most 4 cycles), reports leftovers in
 * check_phase, and in report_phase checks that all planned items were sent.
 *
 * SystemVerilog / UVM rules used:
 * - fork…join waits for all children, join_any for the first, join_none for
 *   none (IEEE 1800-2023 §9.3.2). A child that never ends keeps join waiting.
 * - uvm_event::wait_on returns at once if the event is already on, otherwise
 *   it waits for the trigger (1800.2-2020 §10.1.1.2.2, uvm-core
 *   src/base/uvm_event.svh). wait_trigger (§10.1.1.2.4) would miss a trigger
 *   that happened before the wait started.
 * - When the test drops its last objection the run phase ends and its
 *   processes, including forked sequence threads, are killed
 *   (src/base/uvm_objection.svh, src/base/uvm_phase_hopper.svh).
 * - If objections never drop, the phase hopper's watchdog fires
 *   `UVM_FATAL [PH_TIMEOUT] Default timeout of 9200s hit…`
 *   (UVM_DEFAULT_TIMEOUT = 9200s, src/macros/uvm_global_defines.svh).
 * - A passive agent never creates its sequencer, so its handle is null. A
 *   sequence started on null fails at its first start_item() with
 *   `UVM_FATAL [SEQ] neither the item's sequencer nor dedicated sequencer has
 *   been supplied…` (src/seq/uvm_sequence_base.svh).
 *
 * Time is in clock cycles of 10 ns. Threads that are ready in the same cycle
 * run in creation order; nothing here depends on that order.
 */

export const VC_CYCLE_NS = 10;
export const VC_ITEMS = 6;
export const VC_CFG_CYCLES = 4;
export const VC_LATENCY = 2;
export const VC_BODY_START = 1;
export const VC_RESET_AT = 8;
export const VC_RESET_LEN = 2;
export const VC_DRAIN_TIMEOUT = 4;
const HORIZON = 40;

export type SeqName = "cfg_seq" | "data_seq" | "irq_seq" | "irq_wait_seq";
export type SqrName = "apb_sqr" | "data_sqr" | "irq_sqr";

export type VseqStmt =
  | { op: "start"; seq: SeqName; sqr: SqrName }
  | { op: "trigger" }
  | { op: "wait" }
  | { op: "fork"; join: "join" | "join_any" | "join_none"; branches: VseqStmt[][] };

export type VseqVariant =
  | "sequential"
  | "fork-join"
  | "fork-event"
  | "background-join"
  | "passive-irq-seq"
  | "background-join-any"
  | "background-join-none"
  | "background-isolated";

export type ResetHandling = "none" | "flush" | "restart";

export interface CoordConfig {
  variant: VseqVariant;
  reset: boolean;
  resetHandling: ResetHandling;
}

export const DEFAULT_COORD_CONFIG: CoordConfig = { variant: "sequential", reset: false, resetHandling: "none" };

export const variantLabels: Record<VseqVariant, string> = {
  sequential: "cfg, then data",
  "fork-join": "fork cfg | data join",
  "fork-event": "fork + uvm_event",
  "background-join": "fork + background irq, join",
  "passive-irq-seq": "wait for irq with a sequence",
  "background-join-any": "join_any",
  "background-join-none": "join_none",
  "background-isolated": "background in its own join_none",
};

export const resetHandlingLabels: Record<ResetHandling, string> = {
  none: "ignore reset",
  flush: "flush scoreboard",
  restart: "flush + restart vseq",
};

const cfg: VseqStmt = { op: "start", seq: "cfg_seq", sqr: "apb_sqr" };
const data: VseqStmt = { op: "start", seq: "data_seq", sqr: "data_sqr" };
const irqForever: VseqStmt = { op: "start", seq: "irq_seq", sqr: "irq_sqr" };

/** The virtual sequence body for each variant, as data. The code panel is generated from it. */
export function vseqBody(variant: VseqVariant): VseqStmt[] {
  const evBranches: VseqStmt[][] = [
    [cfg, { op: "trigger" }],
    [{ op: "wait" }, data],
  ];
  switch (variant) {
    case "sequential":
      return [cfg, data];
    case "fork-join":
      return [{ op: "fork", join: "join", branches: [[cfg], [data]] }];
    case "fork-event":
      return [{ op: "fork", join: "join", branches: evBranches }];
    case "background-join":
      return [{ op: "fork", join: "join", branches: [...evBranches, [irqForever]] }];
    case "background-join-any":
      return [{ op: "fork", join: "join_any", branches: [...evBranches, [irqForever]] }];
    case "background-join-none":
      return [{ op: "fork", join: "join_none", branches: [...evBranches, [irqForever]] }];
    case "background-isolated":
      return [
        { op: "fork", join: "join_none", branches: [[irqForever]] },
        { op: "fork", join: "join", branches: evBranches },
      ];
    case "passive-irq-seq":
      return [cfg, data, { op: "start", seq: "irq_wait_seq", sqr: "irq_sqr" }];
  }
}

/** Is the irq agent passive in this variant's environment? */
export const irqPassive = (variant: VseqVariant) => variant === "passive-irq-seq";

export interface VseqCodeLine {
  text: string;
  key?: string;
}

function stmtLines(stmts: VseqStmt[], indent: string, out: VseqCodeLine[]) {
  for (const s of stmts) {
    if (s.op === "start") {
      out.push({ text: `${indent}${s.seq}.start(p_sequencer.${s.sqr});${s.seq === "irq_seq" ? "   // runs forever" : s.seq === "irq_wait_seq" ? "   // irq_agt is PASSIVE" : ""}`, key: s.seq });
    } else if (s.op === "trigger") {
      out.push({ text: `${indent}cfg_done.trigger();`, key: "trigger" });
    } else if (s.op === "wait") {
      out.push({ text: `${indent}cfg_done.wait_on();   // returns at once if already triggered`, key: "wait" });
    } else {
      out.push({ text: `${indent}fork`, key: "fork" });
      for (const b of s.branches) {
        if (b.length === 1) stmtLines(b, `${indent}  `, out);
        else {
          out.push({ text: `${indent}  begin` });
          stmtLines(b, `${indent}    `, out);
          out.push({ text: `${indent}  end` });
        }
      }
      out.push({ text: `${indent}${s.join}`, key: "join" });
    }
  }
}

/** SystemVerilog for the variant's body() (declarations first, as SV requires). */
export function vseqSource(variant: VseqVariant): VseqCodeLine[] {
  const out: VseqCodeLine[] = [{ text: "task body();" }];
  const body = vseqBody(variant);
  const uses = JSON.stringify(body);
  if (uses.includes('"trigger"')) out.push({ text: '  uvm_event cfg_done = new("cfg_done");' });
  const types: Record<SeqName, string> = { cfg_seq: "dma_cfg_seq", data_seq: "stream_seq", irq_seq: "irq_responder_seq", irq_wait_seq: "irq_wait_seq_t" };
  for (const name of ["cfg_seq", "data_seq", "irq_seq", "irq_wait_seq"] as SeqName[]) {
    if (uses.includes(`"${name}"`)) out.push({ text: `  ${name} = ${types[name]}::type_id::create("${name}");` });
  }
  stmtLines(body, "  ", out);
  out.push({ text: "endtask" });
  return out;
}

/* ------------------------------------------------------------------------- */
/* Simulation                                                                 */
/* ------------------------------------------------------------------------- */

type ThreadStatus = "ready" | "busy" | "wait-event" | "wait-join" | "done" | "killed";

interface Thread {
  id: number;
  name: string;
  stmts: VseqStmt[];
  pc: number;
  status: ThreadStatus;
  busyUntil: number;
  activity: string;
  parent: number | null;
  children: number[];
  joinMode?: "join" | "join_any" | "join_none";
  /** For data_seq: items this thread will still send. */
  dataLeft?: number;
  dataNext?: number;
}

export type ItemFate = "matched" | "dropped-en" | "dropped-reset" | "flushed" | "not-observed" | "cut";

export interface VcItem {
  name: string;
  driven: number | null;
  accepted: boolean;
  out: number | null;
  fate: ItemFate;
  why: string;
}

export interface VcCycle {
  t: number;
  rst_n: 0 | 1;
  apb: string;
  en: 0 | 1;
  din: string;
  dout: string;
  objection: 0 | 1;
  notes: string[];
}

export interface VcLane {
  name: string;
  /** Activity label per cycle (index = cycle). */
  values: string[];
}

export type VcOutcome = "pass" | "missing" | "count" | "hang" | "fatal";

export interface VcResult {
  config: CoordConfig;
  items: VcItem[];
  cycles: VcCycle[];
  lanes: VcLane[];
  bodyEnd: number | null;
  runEnd: number | null;
  fatalAt: number | null;
  outcome: VcOutcome;
  errors: { t: number | "9200 s"; id: string; text: string }[];
  log: string[];
  summary: string;
  why: string;
  /** Cycles to draw. */
  edges: number;
}

export const vcNs = (t: number) => `${t * VC_CYCLE_NS} ns`;

export function runCoordination(config: CoordConfig): VcResult {
  const { variant } = config;
  const resetOn = config.reset;
  const inReset = (t: number) => resetOn && t >= VC_RESET_AT && t < VC_RESET_AT + VC_RESET_LEN;

  const threads: Thread[] = [];
  const spawn = (name: string, stmts: VseqStmt[], parent: number | null, t: number): Thread => {
    const th: Thread = { id: threads.length, name, stmts, pc: 0, status: "ready", busyUntil: t, activity: "", parent, children: [] };
    threads.push(th);
    return th;
  };
  const branchName = (b: VseqStmt[]) => {
    const seqs = b.filter((s): s is Extract<VseqStmt, { op: "start" }> => s.op === "start").map((s) => s.seq);
    if (seqs.includes("irq_seq")) return "irq thread";
    if (seqs.includes("cfg_seq") && seqs.includes("data_seq")) return "main thread";
    if (seqs.includes("cfg_seq")) return "cfg thread";
    return "data thread";
  };

  // DUT + scoreboard state.
  let en: 0 | 1 = 0;
  const enRiseAt: number[] = [];
  const items: VcItem[] = [];
  const apbAt = new Map<number, string>();
  let itemCounter = 0;
  let triggeredAt: number | null = null;
  let fatalAt: number | null = null;
  let fatalSeq = "";
  let bodyEnd: number | null = null;
  let runEnd: number | null = null;
  let restartPending = false;
  let lastSimT = VC_BODY_START;
  const notes = new Map<number, string[]>();
  const note = (t: number, text: string) => notes.set(t, [...(notes.get(t) ?? []), text]);
  const laneValues = new Map<string, string[]>();
  const errors: VcResult["errors"] = [];

  let root = spawn("body", vseqBody(variant), null, VC_BODY_START);

  const startSeq = (th: Thread, s: Extract<VseqStmt, { op: "start" }>, t: number) => {
    if (s.seq === "cfg_seq") {
      th.status = "busy";
      th.busyUntil = t + VC_CFG_CYCLES;
      th.activity = "cfg_seq";
      apbAt.set(t, "SRC");
      apbAt.set(t + 1, "SRC");
      apbAt.set(t + 2, "CTRL");
      apbAt.set(t + 3, "CTRL");
    } else if (s.seq === "data_seq") {
      const left = th.dataLeft ?? VC_ITEMS - itemCounter;
      th.status = "busy";
      th.dataLeft = left;
      th.dataNext = t;
      th.busyUntil = t + left;
      th.activity = "data_seq";
    } else if (s.seq === "irq_seq") {
      th.status = "busy";
      th.busyUntil = Number.POSITIVE_INFINITY;
      th.activity = "irq_seq ∞";
    } else {
      // irq_wait_seq on the passive agent's null sequencer.
      th.status = "busy";
      th.activity = "irq_wait_seq";
      fatalAt = t;
      fatalSeq = "irq_wait_seq";
    }
  };

  const joinSatisfied = (th: Thread) => {
    const kids = th.children.map((c) => threads[c]);
    const finished = (k: Thread) => k.status === "done" || k.status === "killed";
    if (th.joinMode === "join") return kids.every(finished);
    if (th.joinMode === "join_any") return kids.some(finished);
    return true;
  };

  /** Runs one thread until it blocks; returns true if it made progress. */
  const execute = (th: Thread, t: number) => {
    while (th.status === "ready") {
      if (th.pc >= th.stmts.length) {
        th.status = "done";
        th.activity = th.parent === null ? "returned" : "done";
        if (th.parent === null) bodyEnd = t;
        return;
      }
      const s = th.stmts[th.pc];
      th.pc += 1;
      if (s.op === "start") {
        startSeq(th, s, t);
        if (fatalAt !== null) return;
      } else if (s.op === "trigger") {
        triggeredAt = t;
        th.activity = "trigger";
        note(t, "cfg_done.trigger()");
        for (const w of threads) if (w.status === "wait-event") w.status = "ready";
      } else if (s.op === "wait") {
        if (triggeredAt === null) {
          th.status = "wait-event";
          th.activity = "wait cfg_done";
        }
      } else {
        th.joinMode = s.join;
        th.children = s.branches.map((b) => spawn(branchName(b), b, th.id, t).id);
        if (s.join !== "join_none") {
          th.status = "wait-join";
          th.activity = s.join;
        }
      }
    }
  };

  const killAll = () => {
    for (const th of threads) if (th.status !== "done") th.status = "killed";
  };

  for (let t = VC_BODY_START; t <= HORIZON; t += 1) {
    // Reset assertion.
    if (resetOn && t === VC_RESET_AT) {
      en = 0;
      triggeredAt = null;
      note(t, "rst_n asserted: EN cleared, in-flight data discarded");
      for (const it of items) {
        if (it.accepted && it.out !== null && it.out >= t) {
          if (config.resetHandling === "none") {
            it.fate = "dropped-reset";
            it.why = `${it.name} was inside the DUT when reset hit, so it was discarded. The scoreboard was not told and still expects it.`;
          } else {
            it.fate = "flushed";
            it.why = `${it.name} was inside the DUT when reset hit. The scoreboard flushed its prediction on reset, so it is accounted as discarded, not missing.`;
          }
          it.out = null;
        }
      }
      if (config.resetHandling === "restart") {
        killAll();
        restartPending = true;
        note(t, "test kills the virtual sequence on reset");
      }
    }
    if (restartPending && t === VC_RESET_AT + VC_RESET_LEN) {
      restartPending = false;
      bodyEnd = null;
      root = spawn("body", vseqBody(variant), null, t);
      note(t, "rst_n released: test restarts the virtual sequence (remaining items only)");
    }
    // Wake busy threads whose sequence finished. cfg_seq finishing means the
    // CTRL.EN write has completed, so EN reads 1 from this cycle.
    for (const th of threads) {
      if (th.status === "busy" && th.busyUntil <= t && fatalAt === null) {
        th.status = "ready";
        if (th.activity === "data_seq") th.dataLeft = 0;
        if (th.activity === "cfg_seq" && !inReset(t)) {
          en = 1;
          enRiseAt.push(t);
          note(t, "cfg_seq done: CTRL.EN = 1");
        }
      }
    }
    // Run ready threads to a fixpoint (joins re-checked after every change).
    for (let guard = 0; guard < 50; guard += 1) {
      let progressed = false;
      for (const th of threads) {
        if (th.status === "wait-join" && joinSatisfied(th)) th.status = "ready";
        if (th.status === "ready") {
          execute(th, t);
          progressed = true;
          if (fatalAt !== null) break;
        }
      }
      if (!progressed || fatalAt !== null) break;
    }

    // Data driver: one item per cycle for each busy data thread.
    for (const th of threads) {
      if (th.status === "busy" && th.activity === "data_seq" && th.dataNext !== undefined && th.dataNext <= t && t < th.busyUntil) {
        const name = `D${itemCounter}`;
        itemCounter += 1;
        th.dataNext = t + 1;
        const accepted = en === 1 && !inReset(t);
        const it: VcItem = {
          name,
          driven: t,
          accepted,
          out: accepted ? t + VC_LATENCY : null,
          fate: accepted ? "matched" : inReset(t) ? "dropped-reset" : "dropped-en",
          why: accepted
            ? `${name} was sent while EN = 1, so the DUT accepted it.`
            : inReset(t)
              ? `${name} was sent while reset was asserted. The DUT ignores its inputs in reset.`
              : `${name} was sent while CTRL.EN = 0. The DUT drops data until it is configured, and the predictor still expects it.`,
        };
        items.push(it);
      }
    }

    // Activity rows (later threads with the same name, after a restart, win).
    for (const th of threads) {
      const values = laneValues.get(th.name) ?? [];
      values[t] = th.status === "killed" ? "killed" : th.status === "done" ? (th.parent === null ? "returned" : "done") : th.activity || "—";
      laneValues.set(th.name, values);
    }
    lastSimT = t;

    if (fatalAt !== null) break;

    // End of run: body returned, then drain until nothing is outstanding.
    if (bodyEnd !== null && !restartPending) {
      const outstanding = items.filter((it) => it.fate === "matched" && it.out !== null && it.out > t).length;
      if (outstanding === 0 || t >= bodyEnd + VC_DRAIN_TIMEOUT) {
        runEnd = t;
        killAll();
        break;
      }
    }
  }

  // Outputs observed only up to the end of the run.
  for (const it of items) {
    if (it.fate === "matched" && it.out !== null && ((runEnd !== null && it.out > runEnd) || (fatalAt !== null && it.out > fatalAt))) {
      it.fate = "not-observed";
      it.why = `${it.name} was accepted, but its output would appear at ${vcNs(it.out)}, after the run phase had ended.`;
    }
  }
  const hang = runEnd === null && fatalAt === null;
  const hangLabel = (t: number) => (hang && t > lastSimT ? "…" : undefined);
  // Planned items that were never sent.
  const sent = items.length;
  const cut: VcItem[] = [];
  for (let k = sent; k < VC_ITEMS; k += 1) {
    cut.push({
      name: `D${k}`,
      driven: null,
      accepted: false,
      out: null,
      fate: "cut",
      why: hang
        ? `D${k} was never sent.`
        : `D${k} was never sent: the run phase ended (or the sequence was killed) before data_seq reached it.`,
    });
  }
  const allItems = [...items, ...cut];

  // Errors and outcome.
  const missing = items.filter((it) => it.fate === "dropped-en" || it.fate === "dropped-reset" || it.fate === "not-observed");
  if (fatalAt !== null) {
    errors.push({
      t: fatalAt,
      id: "SEQ",
      text: "neither the item's sequencer nor dedicated sequencer has been supplied to start item in uvm_test_top.env.v_sqr.vseq.irq_wait_seq",
    });
  } else if (hang) {
    errors.push({ t: "9200 s", id: "PH_TIMEOUT", text: "Default timeout of 9200s hit, indicating a probable testbench issue" });
  } else {
    for (const it of missing) errors.push({ t: runEnd!, id: "SCB/MISSING", text: `${it.name} was predicted but never seen at the output` });
    if (sent < VC_ITEMS) errors.push({ t: runEnd!, id: "SCB/COUNT", text: `only ${sent} of ${VC_ITEMS} planned items were sent` });
  }
  const outcome: VcOutcome = fatalAt !== null ? "fatal" : hang ? "hang" : sent < VC_ITEMS ? "count" : missing.length > 0 ? "missing" : "pass";

  // Cycle table.
  const lastT = fatalAt ?? runEnd ?? 18;
  const edges = Math.min(Math.max(lastT + 3, 14), 24);
  const cycles: VcCycle[] = [];
  let enLevel: 0 | 1 = 0;
  const stopAt = runEnd ?? fatalAt ?? Number.POSITIVE_INFINITY;
  for (let t = 0; t < edges; t += 1) {
    const rst = resetOn && t >= VC_RESET_AT && t < VC_RESET_AT + VC_RESET_LEN ? 0 : 1;
    // EN as the DUT register: set when the CTRL write completes, cleared by reset.
    if (rst === 0) enLevel = 0;
    else if (enRiseAt.includes(t)) enLevel = 1;
    const din = items.find((it) => it.driven === t);
    const dout = items.find((it) => it.out === t && (it.fate === "matched" || it.fate === "not-observed"));
    const ended = (runEnd !== null && t > runEnd) || (fatalAt !== null && t > fatalAt);
    const cycleNotes = [...(notes.get(t) ?? [])];
    if (din && !din.accepted) cycleNotes.push(`${din.name} dropped (${din.fate === "dropped-reset" ? "in reset" : "EN = 0"})`);
    if (din && din.accepted) cycleNotes.push(`${din.name} accepted`);
    if (dout) cycleNotes.push(dout.fate === "matched" ? `${dout.name} out, matched` : `${dout.name} would come out here, after the run ended`);
    if (t === bodyEnd) cycleNotes.push("body() returns; the test drops its objection");
    if (t === runEnd) cycleNotes.push("run_phase ends (scoreboard drain over)");
    if (t === fatalAt) cycleNotes.push(`UVM_FATAL [SEQ]: ${fatalSeq} started on a null sequencer`);
    cycles.push({
      t,
      rst_n: rst,
      apb: ended ? "—" : (apbAt.get(t) ?? "—"),
      en: enLevel,
      din: din ? din.name : "—",
      dout: dout && dout.fate === "matched" && !ended ? dout.name : "—",
      objection: t >= VC_BODY_START && t <= stopAt ? 1 : 0,
      notes: cycleNotes,
    });
  }
  const lanes: VcLane[] = [...laneValues.entries()].map(([name, values]) => ({
    name,
    values: Array.from({ length: edges }, (_, t) => (t > lastSimT ? (hangLabel(t) ?? "—") : (values[t] ?? "—"))),
  }));

  // Explanations.
  const dropped = items.filter((it) => it.fate === "dropped-en");
  let why: string;
  switch (outcome) {
    case "fatal":
      why =
        "irq_agt is PASSIVE, so it never built a sequencer and p_sequencer.irq_sqr is null. irq_wait_seq.start(null) runs body(), and its first start_item() has no sequencer to talk to. Wait for the interrupt through the passive monitor (an analysis subscriber or a uvm_event it triggers), not through a sequence.";
      break;
    case "hang":
      why =
        "fork…join waits for every branch. The irq branch runs irq_seq, which never ends, so body() never returns, the test never drops its objection, and only the 9200 s watchdog stops the run. Run background traffic in its own fork…join_none.";
      break;
    case "count":
      why =
        bodyEnd !== null && bodyEnd <= VC_BODY_START
          ? "join_none lets body() return at once. The test drops its objection, run_phase ends, and the forked threads are killed before cfg_seq finishes. Nothing is sent, and only a planned-count check notices."
          : `body() returned at ${vcNs(bodyEnd ?? 0)} while data_seq was still running (join_any released on the first branch to finish). The run ended after the scoreboard's drain watchdog, killing data_seq part-way.`;
      break;
    case "missing": {
      const beforeCfg = dropped.filter((d) => d.driven !== null && (enRiseAt.length === 0 || d.driven < enRiseAt[0]));
      if (beforeCfg.length) {
        why = `data_seq started while cfg_seq was still writing, so ${beforeCfg.map((d) => d.name).join(", ")} reached the DUT with CTRL.EN = 0 and were dropped. The DUT is right; the virtual sequence broke the "configure first" ordering.`;
      } else if (resetOn && config.resetHandling === "none") {
        why = "Reset discarded in-flight data and cleared EN, but the testbench carried on as if nothing happened: the scoreboard still expects the discarded items, and data sent after reset hits an unconfigured DUT.";
      } else if (resetOn && config.resetHandling === "flush") {
        why = "The scoreboard flushed the in-flight items, but data_seq kept sending into a DUT whose EN was cleared by reset. Restart the virtual sequence after reset so it reconfigures first.";
      } else {
        why = "Some accepted items were still inside the DUT when the run phase ended.";
      }
      break;
    }
    default:
      why = resetOn
        ? "On reset the scoreboard flushed the in-flight predictions and the test restarted the virtual sequence, which reconfigured the DUT before sending the remaining items."
        : variant === "fork-event" || variant === "background-isolated"
          ? "The data thread waits for cfg_done, so every item is sent after CTRL.EN = 1. The background irq thread is not part of the join, so body() can return."
          : "cfg_seq returns only after CTRL.EN = 1 is written, so every data item reaches a configured DUT.";
  }
  const flushed = items.filter((it) => it.fate === "flushed").length;
  const matchedCount = items.filter((it) => it.fate === "matched").length;
  const summaryBy: Record<VcOutcome, string> = {
    pass: `PASS: ${matchedCount} item(s) matched${flushed ? `, ${flushed} discarded by reset and flushed` : ""}, nothing missing.`,
    missing: `FAIL: ${missing.length} item(s) predicted but never seen at the output.`,
    count: `FAIL: only ${sent} of ${VC_ITEMS} planned items were sent before the run ended.`,
    hang: "HANG: body() never returns; UVM_FATAL [PH_TIMEOUT] at 9200 s.",
    fatal: `UVM_FATAL [SEQ] at ${vcNs(fatalAt ?? 0)}: a sequence was started on the passive agent's null sequencer.`,
  };

  const log: string[] = [];
  if (apbAt.size) log.push(`UVM_INFO @ ${vcNs([...apbAt.keys()].sort((a, b) => a - b)[0] ?? 0)} [VSEQ] cfg_seq starts on apb_sqr`);
  for (const e of errors) log.push(`${e.id === "SEQ" || e.id === "PH_TIMEOUT" ? "UVM_FATAL" : "UVM_ERROR"} @ ${typeof e.t === "number" ? vcNs(e.t) : e.t} [${e.id}] ${e.text}`);
  if (outcome === "pass") log.push(`UVM_INFO @ ${vcNs(runEnd ?? 0)} [SCB] matched ${matchedCount}, flushed ${flushed}, missing 0 → PASS`);

  return {
    config,
    items: allItems,
    cycles,
    lanes,
    bodyEnd,
    runEnd,
    fatalAt,
    outcome,
    errors,
    log,
    summary: summaryBy[outcome],
    why,
    edges,
  };
}

/** Reset-handling code for the chosen option (kept beside the model that implements it). */
export function resetHandlingSource(handling: ResetHandling): VseqCodeLine[] {
  if (handling === "none") return [{ text: "// no reset handling: scoreboard and vseq carry on" }];
  const flush: VseqCodeLine[] = [
    { text: "// scoreboard: forget predictions the DUT discards on reset" },
    { text: "function void on_reset();  // called by the reset monitor", key: "flush" },
    { text: "  exp_q.delete();", key: "flush" },
    { text: "endfunction" },
  ];
  if (handling === "flush") return flush;
  return [
    ...flush,
    { text: "" },
    { text: "// test run_phase: restart the vseq after each reset" },
    { text: "forever begin", key: "restart" },
    { text: "  fork" },
    { text: "    vseq.start(env.v_sqr);   // cfg_seq, then the remaining data" },
    { text: "    @(negedge vif.rst_n);", key: "restart" },
    { text: "  join_any" },
    { text: "  disable fork;              // kill the vseq if reset won the race", key: "restart" },
    { text: "  if (vif.rst_n) break;      // vseq finished without a reset" },
    { text: "  @(posedge vif.rst_n);" },
    { text: "  vseq = soc_vseq::type_id::create(\"vseq\");" },
    { text: "end" },
  ];
}
