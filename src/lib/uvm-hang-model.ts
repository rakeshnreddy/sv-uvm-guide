/**
 * Deterministic model of UVM run-phase hangs for triage practice. A tiny
 * cooperative scheduler runs the test, sequences, sequencer arbitration, driver
 * and scoreboard as processes and reports where each one is blocked when the
 * run phase ends or times out.
 *
 * Rules checked against uvm-core 2020.3.1 (IEEE 1800.2-2020):
 *  - seq/uvm_sequencer.svh get_next_item(): a second call without item_done reports
 *    UVM_ERROR "Get_next_item called twice without item_done or get in between"
 *    (id = the sequencer's full name) and, through m_safe_select_item, returns the SAME
 *    outstanding item again. item_done() releases the sequence blocked in finish_item.
 *  - seq/uvm_sequencer_base.svh: grab() takes the sequencer; while lock_list is not empty
 *    only the grabbing sequence is granted (is_grabbed(), current_grabber()). A lock is
 *    removed by ungrab()/unlock() or when the grabbing sequence exits (with a SEQFINERR
 *    error); a still-running sequence keeps it forever.
 *  - base/uvm_objection.svh: +UVM_OBJECTION_TRACE prints
 *    "Object <path> raised|dropped <n> <objection> objection(s) (<desc>): count=<c>  total=<t>"
 *    (id OBJTN_TRC); display_objections() prints Source/Total counts per object (10.5.1).
 *    The run phase ends when every objection is dropped; one never raised ends it at once.
 *  - base/uvm_phase_hopper.svh: when the phase timeout expires, `uvm_fatal("PH_TIMEOUT",
 *    "<Explicit|Default> timeout of <t> hit, indicating a probable testbench issue").
 *    The default timeout is `UVM_DEFAULT_TIMEOUT (9200 s); the scenarios set 1000 ns.
 * Simplifications: drain time 0, no phase_ready_to_end, propagation trace lines omitted,
 * FIFO arbitration only, every item takes 10 ns to drive.
 */

export type HangScenarioId = "missing-item-done" | "stuck-objection" | "grab-leak" | "no-objection";

export type HangVariant = "bug" | "fixed" | "longer-timeout" | "drop-early" | "drain-time" | "lock-instead";

export interface HangSetup {
  scenario: HangScenarioId;
  variant: HangVariant;
  /** Print OBJTN_TRC lines (+UVM_OBJECTION_TRACE). */
  objectionTrace?: boolean;
}

export type LogKind = "info" | "error" | "fatal" | "trace";

export interface LogLine {
  time: number;
  kind: LogKind;
  text: string;
  /** Identical consecutive lines are folded: how many times this one occurred. */
  repeat?: number;
  lastTime?: number;
}

export interface ProcessState {
  name: string;
  component: string;
  /** Final status when the run ended. */
  status: string;
  blocked: boolean;
  since: number;
}

export interface ObjectionRow {
  path: string;
  source: number;
  total: number;
}

export interface HangRun {
  setup: HangSetup;
  ended: "all-dropped" | "timeout";
  endTime: number;
  timeoutNs: number;
  log: LogLine[];
  processes: ProcessState[];
  objections: ObjectionRow[];
  /** display_objections() output at the end. */
  objectionTable: string[];
  sequencer: { grabbedBy: string | null; outstandingItem: string | null; waitingRequests: string[] };
  itemsCompleted: number;
  itemsPlanned: number;
  errors: number;
  /** Plain-language account of how the run ended (model narration, not log output). */
  narration: string;
}

const SQR = "uvm_test_top.env.agt.sqr";
const DRV = "uvm_test_top.env.agt.drv";
const SCB = "uvm_test_top.env.scb";
const TEST = "uvm_test_top";
export const ITEM_NS = 10;

type Wait = { kind: "delay"; ns: number; label: string } | { kind: "until"; cond: () => boolean; label: string };
type Gen = Generator<Wait, void, void>;

interface Proc {
  name: string;
  component: string;
  gen: Gen;
  status: "ready" | "delay" | "wait" | "done" | "killed";
  wakeAt: number;
  cond?: () => boolean;
  label: string;
  since: number;
}

interface Item {
  id: number;
  seq: string;
  label: string;
}

export function runHang(setup: HangSetup): HangRun {
  const { scenario, variant } = setup;
  const timeoutNs = variant === "longer-timeout" ? 10_000 : 1000;
  let now = 0;
  const log: LogLine[] = [];
  const say = (kind: LogKind, text: string) => log.push({ time: now, kind, text });
  let errors = 0;

  // --- objections ---------------------------------------------------------
  const source = new Map<string, number>();
  const total = new Map<string, number>();
  let everRaised = false;
  const ancestors = (path: string) => {
    const parts = path.split(".");
    const out = ["uvm_top"];
    for (let i = 1; i <= parts.length; i += 1) out.push(parts.slice(0, i).join("."));
    return out;
  };
  const raise = (path: string, desc: string) => {
    everRaised = true;
    source.set(path, (source.get(path) ?? 0) + 1);
    for (const a of ancestors(path)) total.set(a, (total.get(a) ?? 0) + 1);
    if (setup.objectionTrace) say("trace", `UVM_INFO @ ${now}: run_objection [OBJTN_TRC] Object ${path} raised 1 run_objection objection(s) (${desc}): count=${source.get(path)}  total=${total.get(path)}`);
  };
  const drop = (path: string, desc: string) => {
    source.set(path, (source.get(path) ?? 0) - 1);
    for (const a of ancestors(path)) total.set(a, (total.get(a) ?? 0) - 1);
    if (setup.objectionTrace) say("trace", `UVM_INFO @ ${now}: run_objection [OBJTN_TRC] Object ${path} dropped 1 run_objection objection(s) (${desc}): count=${source.get(path)}  total=${total.get(path)}`);
  };
  const topTotal = () => total.get("uvm_top") ?? 0;

  // --- sequencer ------------------------------------------------------------
  const requests: string[] = []; // sequences waiting in start_item (FIFO)
  let granted: string | null = null;
  let lockOwner: string | null = null;
  let fifo: Item | null = null; // item handed over by finish_item, until item_done
  // Read through a function: closures update fifo, which TypeScript's flow analysis cannot see.
  const currentItem = (): Item | null => fifo;
  let driverWaiting = false;
  let getNextItemCalled = false;
  const done = new Set<number>();
  let nextItemId = 1;
  let itemsCompleted = 0;

  const startItem = function* (seq: string): Gen {
    requests.push(seq);
    yield { kind: "until", cond: () => granted === seq, label: "start_item: waiting for grant" };
    granted = null;
  };
  const finishItem = function* (seq: string, label: string): Gen {
    const item: Item = { id: nextItemId++, seq, label };
    fifo = item;
    yield { kind: "until", cond: () => done.has(item.id), label: `finish_item: waiting for item_done (${label})` };
  };
  const arbitrate = () => {
    if (!driverWaiting || fifo || granted) return false;
    const pick = requests.find((s) => lockOwner === null || lockOwner === s);
    if (!pick) return false;
    requests.splice(requests.indexOf(pick), 1);
    granted = pick;
    return true;
  };

  // --- processes ------------------------------------------------------------
  const procs: Proc[] = [];
  const spawn = (name: string, component: string, gen: Gen) => procs.push({ name, component, gen, status: "ready", wakeAt: 0, label: "ready", since: now });
  const plannedMain = scenario === "missing-item-done" ? 3 : 4;
  let mainDone = false;

  const mainSeq = function* (): Gen {
    for (let i = 1; i <= plannedMain; i += 1) {
      yield* startItem("main_seq");
      yield* finishItem("main_seq", `pkt ${i}`);
    }
    mainDone = true;
  };

  // test
  spawn(
    "test run_phase",
    TEST,
    (function* (): Gen {
      const raises = scenario !== "no-objection" || variant === "fixed";
      if (raises) raise(TEST, "start main_seq");
      if (variant === "drop-early") {
        spawn("main_seq", `${SQR}.main_seq`, mainSeq());
        drop(TEST, "dropped right after fork");
        return;
      }
      spawn("main_seq", `${SQR}.main_seq`, mainSeq());
      yield { kind: "until", cond: () => mainDone, label: "main_seq.start(): waiting for the sequence to finish" };
      if (raises) drop(TEST, "main_seq done");
    })(),
  );

  // driver → scoreboard queues (the monitor/predictor path, simplified)
  const expQ: Item[] = [];
  const actQ: Item[] = [];

  // driver
  const driverCallsItemDone = !(scenario === "missing-item-done" && variant !== "fixed");
  spawn(
    "driver run_phase",
    DRV,
    (function* (): Gen {
      for (;;) {
        let item: Item;
        if (getNextItemCalled) {
          errors += 1;
          say("error", `UVM_ERROR @ ${now}: ${SQR} [${SQR}] Get_next_item called twice without item_done or get in between`);
          item = currentItem() as Item;
        } else {
          driverWaiting = true;
          yield { kind: "until", cond: () => fifo !== null, label: "get_next_item: waiting for an item" };
          driverWaiting = false;
          getNextItemCalled = true;
          item = currentItem() as Item;
        }
        if (scenario === "stuck-objection") expQ.push(item);
        yield { kind: "delay", ns: ITEM_NS, label: `driving ${item.label}` };
        if (scenario === "stuck-objection") actQ.push(item);
        if (driverCallsItemDone) {
          getNextItemCalled = false;
          done.add(item.id);
          fifo = null;
          itemsCompleted += 1;
        }
      }
    })(),
  );

  // scoreboard (stuck-objection)
  if (scenario === "stuck-objection") {
    const dropsOnEveryPath = variant === "fixed";
    spawn(
      "scoreboard run_phase",
      SCB,
      (function* (): Gen {
        for (;;) {
          yield { kind: "until", cond: () => expQ.length > 0, label: "waiting for an expected packet" };
          const exp = expQ.shift() as Item;
          raise(SCB, "pending compare");
          yield { kind: "until", cond: () => actQ.length > 0, label: "waiting for the actual packet" };
          actQ.shift();
          if (exp.label === "pkt 3") {
            errors += 1;
            say("error", `UVM_ERROR @ ${now}: ${SCB} [SCB] pkt 3 mismatch: exp data 'h3c, act 'h3d`);
            if (!dropsOnEveryPath) continue;
          }
          drop(SCB, "compare done");
        }
      })(),
    );
  }

  // interrupt sequence (grab-leak)
  if (scenario === "grab-leak") {
    let irq = false;
    spawn(
      "irq event",
      "tb_top.irq",
      (function* (): Gen {
        yield { kind: "delay", ns: 15, label: "waiting" };
        irq = true;
      })(),
    );
    spawn(
      "irq_seq",
      `${SQR}.irq_seq`,
      (function* (): Gen {
        for (;;) {
          yield { kind: "until", cond: () => irq, label: "waiting for the next interrupt" };
          irq = false;
          // grab()/lock(): granted at once when no other sequence holds the sequencer.
          yield { kind: "until", cond: () => lockOwner === null, label: variant === "lock-instead" ? "lock(): waiting" : "grab(): waiting" };
          lockOwner = "irq_seq";
          yield* startItem("irq_seq");
          yield* finishItem("irq_seq", "isr item");
          if (variant === "fixed") lockOwner = null; // ungrab()
        }
      })(),
    );
  }

  // --- scheduler ---------------------------------------------------------------
  let ended: HangRun["ended"] | null = null;
  const step = (p: Proc) => {
    const r = p.gen.next();
    if (r.done) {
      p.status = "done";
      p.label = "finished";
      p.since = now;
      return;
    }
    const w = r.value;
    p.label = w.label;
    p.since = now;
    if (w.kind === "delay") {
      p.status = "delay";
      p.wakeAt = now + w.ns;
    } else {
      p.status = "wait";
      p.cond = w.cond;
    }
  };

  for (let guard = 0; guard < 100_000 && !ended; guard += 1) {
    // Delta loop: run every ready process until nothing changes.
    let progress = true;
    while (progress) {
      progress = false;
      if (arbitrate()) progress = true;
      for (const p of [...procs]) {
        if (p.status === "wait" && p.cond?.()) {
          p.status = "ready";
        }
        if (p.status === "ready") {
          step(p);
          progress = true;
        }
      }
    }
    // End of the run phase: all objections dropped (or none ever raised).
    if (topTotal() === 0 && (everRaised || now === 0)) {
      ended = "all-dropped";
      break;
    }
    const next = Math.min(...procs.filter((p) => p.status === "delay").map((p) => p.wakeAt));
    if (!Number.isFinite(next) || next >= timeoutNs) {
      now = timeoutNs;
      ended = "timeout";
      break;
    }
    now = next;
    for (const p of procs) if (p.status === "delay" && p.wakeAt === now) p.status = "ready";
  }

  let narration: string;
  let fatals = 0;
  if (ended === "timeout") {
    fatals = 1;
    say("fatal", `UVM_FATAL @ ${now}: reporter [PH_TIMEOUT] Explicit timeout of ${timeoutNs} hit, indicating a probable testbench issue`);
    narration = `The run phase was still open at t = ${now}: the timeout watchdog fired.`;
  } else if (!everRaised || topTotal() === 0 && itemsCompleted === 0 && now === 0) {
    narration = `No objection was holding the run phase at t = ${now}, so it ended immediately and killed the sequence before it drove anything.`;
  } else {
    narration = `All run-phase objections dropped at t = ${now}; run_phase ended and the remaining forever loops were killed.`;
  }
  // die() / end of test: the report server prints its summary (abridged here).
  say("info", `UVM_INFO @ ${now}: reporter [UVM/REPORT/SERVER] --- UVM Report Summary --- UVM_ERROR : ${errors}  UVM_FATAL : ${fatals}`);

  const objections: ObjectionRow[] = [...total.entries()]
    .filter(([, t]) => t > 0)
    .map(([path, t]) => ({ path, source: source.get(path) ?? 0, total: t }))
    .sort((a, b) => (a.path === "uvm_top" ? -1 : b.path === "uvm_top" ? 1 : a.path < b.path ? -1 : 1));

  return {
    setup,
    ended: ended ?? "timeout",
    endTime: now,
    timeoutNs,
    log: foldRepeats(log),
    processes: procs
      .filter((p) => p.name !== "irq event")
      .map((p) => ({
        name: p.name,
        component: p.component,
        status: p.status === "done" ? "finished" : p.label,
        blocked: p.status === "wait",
        since: p.since,
      })),
    objections,
    objectionTable: displayObjections(objections),
    sequencer: {
      grabbedBy: lockOwner,
      outstandingItem: currentItem()?.label ?? null,
      waitingRequests: [...requests],
    },
    itemsCompleted,
    itemsPlanned: plannedMain,
    errors,
    narration,
  };
}

function foldRepeats(lines: LogLine[]): LogLine[] {
  const out: LogLine[] = [];
  const body = (l: LogLine) => l.text.replace(/@ \d+:/, "@ t:");
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === l.kind && body(prev) === body(l)) {
      prev.repeat = (prev.repeat ?? 1) + 1;
      prev.lastTime = l.time;
    } else out.push({ ...l });
  }
  return out;
}

/** uvm_objection::m_display_objections layout. */
export function displayObjections(rows: ObjectionRow[]): string[] {
  const t = rows.find((r) => r.path === "uvm_top")?.total ?? 0;
  const out = [`The total objection count is ${t}`];
  if (t === 0) return out;
  out.push("---------------------------------------------------------", "Source  Total   ", "Count   Count   Object", "---------------------------------------------------------");
  for (const r of rows) {
    const depth = r.path === "uvm_top" ? 0 : r.path.split(".").length;
    const leaf = r.path === "uvm_top" ? "uvm_top" : (r.path.split(".").pop() as string);
    // "%-6d  %-6d %s%s" with blank.substr(0, 2*depth): SV substr is inclusive, so 2*depth+1 spaces.
    out.push(`${String(r.source).padEnd(6)}  ${String(r.total).padEnd(6)} ${" ".repeat(2 * depth + 1)}${leaf}`);
  }
  out.push("---------------------------------------------------------");
  return out;
}

// ---------------------------------------------------------------------------
// Triage scenarios (data for the visual)
// ---------------------------------------------------------------------------

export interface Suspect {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface FixOption {
  id: string;
  label: string;
  variant: HangVariant;
  correct: boolean;
  review: string;
}

export interface HangScenario {
  id: HangScenarioId;
  title: string;
  symptom: string;
  code: string[];
  /** Key into the code for the line at fault. */
  faultLine: number;
  suspects: Suspect[];
  hints: string[];
  fixes: FixOption[];
  fixedCode: string[];
}

const commonSuspects = {
  test: { id: "test", label: "uvm_test_top (the test)" },
  mainSeq: { id: "main_seq", label: "main_seq" },
  sqr: { id: "sequencer", label: "agt.sqr (the sequencer)" },
  drv: { id: "driver", label: "agt.drv (the driver)" },
  scb: { id: "scoreboard", label: "env.scb (the scoreboard)" },
  irq: { id: "irq_seq", label: "irq_seq" },
};

export const hangScenarios: Record<HangScenarioId, HangScenario> = {
  "missing-item-done": {
    id: "missing-item-done",
    title: "Same packet, over and over",
    symptom: "The log fills with one repeated sequencer error, then the run dies at the timeout.",
    code: [
      "// pkt_driver",
      "task run_phase(uvm_phase phase);",
      "  forever begin",
      "    seq_item_port.get_next_item(req);",
      "    drive(req);                     // 10 ns",
      "  end",
      "endtask",
    ],
    faultLine: 4,
    suspects: [
      { ...commonSuspects.drv, correct: true, feedback: "Yes. The driver never calls item_done(), so the sequencer keeps the first item outstanding: the next get_next_item() reports the error and hands back the same item, and main_seq waits in finish_item forever." },
      { ...commonSuspects.sqr, correct: false, feedback: "The sequencer reports the problem, but it is enforcing the protocol: get_next_item() must be followed by item_done() before the next request." },
      { ...commonSuspects.mainSeq, correct: false, feedback: "main_seq is blocked in finish_item(pkt 1). It is waiting for item_done(), which only the driver can call." },
      { ...commonSuspects.test, correct: false, feedback: "The test holds its objection because main_seq never returns. That is the consequence, not the cause." },
    ],
    hints: [
      "Read the repeated error. Which two calls must alternate on the driver side?",
      "Which process is blocked, and in which call? (see the process table)",
      "Every get_next_item() needs a matching item_done().",
    ],
    fixes: [
      { id: "item-done", label: "Call seq_item_port.item_done() after drive(req)", variant: "fixed", correct: true, review: "Each item now completes in 10 ns; main_seq finishes, the test drops its objection and the run ends cleanly." },
      { id: "timeout", label: "Raise the timeout to 10 µs", variant: "longer-timeout", correct: false, review: "The same hang, ten times later and with ten times more errors. A timeout only bounds a hang; it never fixes one." },
      { id: "drop-early", label: "Drop the test's objection right after starting main_seq", variant: "drop-early", correct: false, review: "The run now ends at t = 0 before anything is driven, and the summary shows 0 errors: the bug is hidden, not fixed." },
    ],
    fixedCode: ["task run_phase(uvm_phase phase);", "  forever begin", "    seq_item_port.get_next_item(req);", "    drive(req);", "    seq_item_port.item_done();", "  end", "endtask"],
  },
  "stuck-objection": {
    id: "stuck-objection",
    title: "One mismatch, then silence",
    symptom: "The scoreboard reports one mismatch, stimulus finishes at 40 ns, and nothing happens until the timeout.",
    code: [
      "// pkt_scoreboard",
      "task run_phase(uvm_phase phase);",
      "  forever begin",
      "    exp_fifo.get(exp);",
      '    phase.raise_objection(this, "pending compare");',
      "    act_fifo.get(act);",
      "    if (!exp.compare(act)) begin",
      '      `uvm_error("SCB", ...)',
      "      continue;                     // skips the drop",
      "    end",
      '    phase.drop_objection(this, "compare done");',
      "  end",
      "endtask",
    ],
    faultLine: 8,
    suspects: [
      { ...commonSuspects.scb, correct: true, feedback: "Yes. display_objections() shows scb with source count 1: it raised for pkt 3 and the mismatch path skipped the drop." },
      { ...commonSuspects.test, correct: false, feedback: "The trace shows the test dropped its objection at 40 ns. Its own count is 0; it only appears in the table because its child holds one." },
      { ...commonSuspects.drv, correct: false, feedback: "All four packets were driven and every item_done() was called; the driver is idle in get_next_item, which is normal at the end of stimulus." },
      { ...commonSuspects.mainSeq, correct: false, feedback: "main_seq finished at 40 ns. A finished sequence cannot hold the phase." },
    ],
    hints: [
      "Turn on +UVM_OBJECTION_TRACE: who raised more times than they dropped?",
      "In display_objections(), the Source column says who holds the objection; Total includes children.",
      "Look at every path through the loop after raise_objection.",
    ],
    fixes: [
      { id: "drop-all-paths", label: "Drop the objection on every path (drop before reporting the mismatch)", variant: "fixed", correct: true, review: "The run ends at 40 ns and reports the mismatch as a UVM_ERROR — a clean failure instead of a hang." },
      { id: "drain", label: "Add phase.phase_done.set_drain_time(this, 100ns)", variant: "drain-time", correct: false, review: "Drain time only starts once the total reaches zero. The scoreboard's count never reaches zero, so the hang is unchanged." },
      { id: "timeout", label: "Raise the timeout to 10 µs", variant: "longer-timeout", correct: false, review: "Same hang, later. The objection count does not change with time." },
    ],
    fixedCode: [
      "task run_phase(uvm_phase phase);",
      "  forever begin",
      "    exp_fifo.get(exp);",
      '    phase.raise_objection(this, "pending compare");',
      "    act_fifo.get(act);",
      "    if (!exp.compare(act))",
      '      `uvm_error("SCB", ...)',
      '    phase.drop_objection(this, "compare done");',
      "  end",
      "endtask",
    ],
  },
  "grab-leak": {
    id: "grab-leak",
    title: "Stimulus stops after the interrupt",
    symptom: "No errors at all. Traffic stops after the interrupt at 15 ns and the run dies at the timeout.",
    code: [
      "// irq_seq (started in parallel, runs forever)",
      "task body();",
      "  forever begin",
      "    @(p_sequencer.irq_ev);",
      "    grab();",
      "    `uvm_do(isr)",
      "    // missing: ungrab();",
      "  end",
      "endtask",
    ],
    faultLine: 6,
    suspects: [
      { ...commonSuspects.irq, correct: true, feedback: "Yes. sqr.is_grabbed() is 1 and current_grabber() is irq_seq: it took the sequencer for the ISR and, still running, never released it. main_seq can never be granted again." },
      { ...commonSuspects.drv, correct: false, feedback: "The driver is waiting in get_next_item with nothing to drive. It is idle because no sequence is granted, not stuck on its own." },
      { ...commonSuspects.mainSeq, correct: false, feedback: "main_seq is waiting in start_item for a grant it will never get. It is the victim." },
      { ...commonSuspects.sqr, correct: false, feedback: "The sequencer is doing what grab() asked: only the grabbing sequence may proceed until ungrab()." },
    ],
    hints: [
      "No errors and an idle driver: is any sequence waiting to be granted?",
      "Ask the sequencer: is_grabbed() and current_grabber().",
      "Every grab() needs an ungrab() before the sequence waits for its next event.",
    ],
    fixes: [
      { id: "ungrab", label: "Call ungrab() after the ISR item", variant: "fixed", correct: true, review: "The interrupt is serviced at 20–30 ns, then main_seq resumes; all four packets complete and the run ends at 50 ns." },
      { id: "lock", label: "Use lock() instead of grab()", variant: "lock-instead", correct: false, review: "lock() only differs in where the request queues. It is held until unlock() just like grab(), so the hang is identical." },
      { id: "timeout", label: "Raise the timeout to 10 µs", variant: "longer-timeout", correct: false, review: "Same hang, later." },
    ],
    fixedCode: ["task body();", "  forever begin", "    @(p_sequencer.irq_ev);", "    grab();", "    `uvm_do(isr)", "    ungrab();", "  end", "endtask"],
  },
  "no-objection": {
    id: "no-objection",
    title: "The test passes in 0 ns",
    symptom: "No hang at all: the report summary shows 0 errors, but the waveform shows no traffic.",
    code: ["// pkt_test", "task run_phase(uvm_phase phase);", "  main_seq seq = main_seq::type_id::create(\"seq\");", "  seq.start(env.agt.sqr);", "endtask"],
    faultLine: 3,
    suspects: [
      { ...commonSuspects.test, correct: true, feedback: "Yes. Nobody raised a run-phase objection, so run_phase ended at t = 0 and killed the sequence before its first item." },
      { ...commonSuspects.mainSeq, correct: false, feedback: "main_seq was started correctly but killed when the phase ended. (It could raise its own objection with set_automatic_phase_objection(1), but the test owns end-of-test here.)" },
      { ...commonSuspects.drv, correct: false, feedback: "The driver never received an item; it was waiting in get_next_item when the phase ended." },
      { ...commonSuspects.sqr, correct: false, feedback: "The sequencer never had a chance to arbitrate." },
    ],
    hints: ["When does a run phase end?", "Who raised an objection in this test?", "Raise before seq.start(), drop after it returns."],
    fixes: [
      { id: "raise", label: "Raise an objection before seq.start() and drop it after", variant: "fixed", correct: true, review: "The run lasts until all four packets are driven (40 ns), then ends." },
      { id: "drain", label: "Add a 100 ns drain time", variant: "drain-time", correct: false, review: "Drain time applies after the total drops to zero from a raised objection. With nothing raised, the phase still ends at once." },
    ],
    fixedCode: ["task run_phase(uvm_phase phase);", "  main_seq seq = main_seq::type_id::create(\"seq\");", "  phase.raise_objection(this);", "  seq.start(env.agt.sqr);", "  phase.drop_objection(this);", "endtask"],
  },
};

export const HANG_SCENARIOS: HangScenarioId[] = ["missing-item-done", "stuck-objection", "grab-leak"];
export const ALL_SCENARIOS: HangScenarioId[] = [...HANG_SCENARIOS, "no-objection"];
