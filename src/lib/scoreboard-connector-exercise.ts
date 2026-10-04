/**
 * Scoreboard connector exercise: wire the checking side of an agent environment.
 * Pure and deterministic; the exercise component renders this module's output only.
 *
 * Every UVM rule comes from the shared TLM model (src/lib/uvm-tlm-model.ts), which was
 * checked against uvm-core 2020.3.1:
 * - each attempted connect() runs checkConnect(): the compile-time type check, then
 *   uvm_port_base::connect() (§5.5.2.14) in source order ("Cannot call an imp port's
 *   connect method", "Cannot connect exports to ports", the interface-mask check);
 * - goals are graded with goalStatus(), i.e. what resolve_bindings() (§5.5.2.15) collects;
 * - the write() call order comes from analysisCallOrder(): uvm_analysis_port::write()
 *   loops get_if(i), which walks m_imp_list[string] in full-name order.
 *
 * Facts about the components (uvm-core 2020.3.1):
 * - src/comps/uvm_subscriber.svh: analysis_export is a uvm_analysis_imp created as "analysis_imp".
 * - src/tlm1/uvm_tlm_fifos.svh: uvm_tlm_analysis_fifo is unbounded (size 0); its analysis_export
 *   is a uvm_analysis_imp whose write() is `void'(try_put(t))`. get() is a blocking task.
 * - src/tlm1/uvm_analysis_port.svh: uvm_analysis_port is built with min_size 0, so an
 *   unconnected analysis port passes end_of_elaboration silently.
 * - src/seq/uvm_sequencer.svh: seq_item_export is a uvm_seq_item_pull_imp (uvm_sqr_if_base family).
 *
 * The "wrong stream" rules (SCB_FORBIDDEN_FLOWS, port-to-port merges) are checking-design rules
 * of this exercise, not UVM rules: UVM accepts those connections without a message.
 */

import {
  analysisCallOrder,
  analysisFifoEndpoints,
  analysisImp,
  analysisPort,
  ancestry,
  checkConnect,
  elaborate,
  endpointFullName,
  findEndpoint,
  goalStatus,
  referenceFrom,
  resolveBindings,
  seqItemPullImp,
  seqItemPullPort,
  type ConnectResult,
  type Elaboration,
  type ReachGoal,
  type TlmConnection,
  type TlmEndpoint,
  type TlmTopology,
} from "@/lib/uvm-tlm-model";

// ── Topology ────────────────────────────────────────────────────────────────

export const SCB_TXN = "bus_item";
const SUBSCRIBER_CLS = `uvm_subscriber #(${SCB_TXN})`;
const FIFO_CLS = `uvm_tlm_analysis_fifo #(${SCB_TXN})`;

/** Only the FIFO's analysis side is offered; the scoreboard pulls with expected_fifo.get() in its run_phase. */
const fifoAnalysisExport = (owner: string): TlmEndpoint[] =>
  analysisFifoEndpoints(owner, SCB_TXN).filter((e) => e.handle === "analysis_export");

export const SCB_TOPOLOGY: TlmTopology = {
  components: [
    { id: "test", name: "uvm_test_top", parent: null, kind: "test", cls: "bus_test" },
    { id: "env", name: "env", parent: "test", kind: "env", cls: "bus_env" },
    { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
    { id: "mon", name: "mon", parent: "agt", kind: "monitor", cls: "bus_monitor" },
    { id: "drv", name: "drv", parent: "agt", kind: "driver", cls: "bus_driver" },
    { id: "sqr", name: "sqr", parent: "agt", kind: "sequencer", cls: "bus_sequencer" },
    { id: "prd", name: "prd", parent: "env", kind: "subscriber", cls: "bus_predictor" },
    { id: "scb", name: "scb", parent: "env", kind: "scoreboard", cls: "bus_scoreboard" },
    { id: "expected_fifo", name: "expected_fifo", parent: "scb", kind: "fifo", cls: FIFO_CLS },
    { id: "actual_fifo", name: "actual_fifo", parent: "scb", kind: "fifo", cls: FIFO_CLS },
    { id: "cov", name: "cov", parent: "env", kind: "subscriber", cls: "bus_coverage" },
  ],
  endpoints: [
    analysisPort("mon", "ap", SCB_TXN),
    seqItemPullPort("drv", SCB_TXN),
    seqItemPullImp("sqr", SCB_TXN, "bus_sequencer"),
    analysisImp("prd", "analysis_export", SCB_TXN, { objName: "analysis_imp", ownerCls: SUBSCRIBER_CLS }),
    analysisPort("prd", "ap", SCB_TXN),
    ...fifoAnalysisExport("expected_fifo"),
    ...fifoAnalysisExport("actual_fifo"),
    analysisImp("cov", "analysis_export", SCB_TXN, { objName: "analysis_imp", ownerCls: SUBSCRIBER_CLS }),
  ],
};

/** The class whose connect_phase the learner writes. */
export const SCB_WRITER = "env";

/** Already made in bus_agent::connect_phase; shown but not editable. */
export const SCB_GIVEN: TlmConnection[] = [{ from: "drv.seq_item_port", to: "sqr.seq_item_export" }];

/** Analysis ports whose owner calls write(): the monitor (observed items) and the predictor (expected items). */
export const SCB_PUBLISHERS = ["mon.ap", "prd.ap"] as const;

/** Argument name used for each publisher's write() in the call-order trace. */
const PUBLISHED_ARG: Record<string, string> = { "mon.ap": "t", "prd.ap": "exp" };

/** Subscribers whose write() publishes on another port before returning (the predictor forwards its prediction). */
export const SCB_FORWARDS: Record<string, string> = { "prd.analysis_export": "prd.ap" };

export const SCB_SOLUTION: TlmConnection[] = [
  { from: "mon.ap", to: "prd.analysis_export" },
  { from: "mon.ap", to: "actual_fifo.analysis_export" },
  { from: "mon.ap", to: "cov.analysis_export" },
  { from: "prd.ap", to: "expected_fifo.analysis_export" },
];

export const connectionKey = (c: TlmConnection) => `${c.from}->${c.to}`;

/** How an endpoint is written inside bus_env, e.g. `agt.mon.ap` or `scb.expected_fifo.analysis_export`. */
export function endpointRef(id: string): string {
  return referenceFrom(SCB_TOPOLOGY, SCB_WRITER, findEndpoint(SCB_TOPOLOGY, id));
}

/** A component's path below bus_env, e.g. `agt.mon` or `scb.actual_fifo`. */
export function componentRef(id: string): string {
  const byId = new Map(SCB_TOPOLOGY.components.map((c) => [c.id, c]));
  const chain = ancestry(SCB_TOPOLOGY, id);
  return chain
    .slice(chain.indexOf(SCB_WRITER) + 1)
    .map((c) => byId.get(c)?.name ?? c)
    .join(".");
}

const isGiven = (c: TlmConnection) => SCB_GIVEN.some((g) => g.from === c.from && g.to === c.to);

// ── Goals and forbidden flows ───────────────────────────────────────────────

export type ScbGoalId = "predictor" | "actual" | "coverage" | "expected";

export interface ScbGoal extends ReachGoal {
  id: ScbGoalId;
  label: string;
  /** What the connection achieves. */
  servesWhy: string;
  /** What goes wrong in simulation when the goal is missing. */
  missingWhy: string;
}

export const SCB_GOALS: ScbGoal[] = [
  {
    id: "predictor",
    from: "mon.ap",
    reaches: "prd.analysis_export",
    label: "The monitor stream reaches the predictor",
    servesWhy: "The predictor receives every observed transaction and computes the expected result from it.",
    missingWhy:
      "The predictor never receives a transaction, so it never writes a prediction. expected_fifo stays empty and the scoreboard waits in expected_fifo.get() forever: nothing is compared, and the test can still end without a single UVM_ERROR.",
  },
  {
    id: "actual",
    from: "mon.ap",
    reaches: "actual_fifo.analysis_export",
    label: "The monitor stream reaches the scoreboard's actual FIFO",
    servesWhy: "actual_fifo buffers what the DUT really did until the scoreboard's own thread pulls it with get().",
    missingWhy:
      "actual_fifo stays empty, so the scoreboard waits in actual_fifo.get() and never compares anything. A broken DUT would pass.",
  },
  {
    id: "coverage",
    from: "mon.ap",
    reaches: "cov.analysis_export",
    label: "The monitor stream reaches coverage",
    servesWhy: "Coverage samples what the DUT actually did, so it measures the scenarios that really happened.",
    missingWhy: "The coverage subscriber samples nothing and reports 0 %, so you cannot tell which scenarios the test exercised.",
  },
  {
    id: "expected",
    from: "prd.ap",
    reaches: "expected_fifo.analysis_export",
    label: "The predictor's output reaches the expected FIFO",
    servesWhy: "expected_fifo buffers each prediction until the scoreboard pairs it with the matching actual item.",
    missingWhy:
      "prd.ap has no subscriber, so every prediction is written to nobody. expected_fifo stays empty and the scoreboard waits in expected_fifo.get() forever.",
  },
];

/** Why UVM itself never reports a missing goal. */
export const SILENT_MISSING_NOTE =
  "UVM reports nothing about this: uvm_analysis_port is built with min_size 0, so an unconnected analysis port passes end_of_elaboration.";

export type ScbMistake =
  | "wrong-direction"
  | "seq-item-mismatch"
  | "type-mismatch"
  | "interface-mask"
  | "self"
  | "raw-to-expected"
  | "prediction-to-actual"
  | "prediction-to-coverage"
  | "feedback-loop"
  | "port-to-port";

export interface ScbForbiddenFlow {
  source: string;
  imp: string;
  mistake: ScbMistake;
  why: string;
}

/** Streams that must never reach a subscriber. UVM accepts every one of these connections. */
export const SCB_FORBIDDEN_FLOWS: ScbForbiddenFlow[] = [
  {
    source: "mon.ap",
    imp: "expected_fifo.analysis_export",
    mistake: "raw-to-expected",
    why: "expected_fifo must hold only predictions. Fed straight from the monitor, it holds the same observed items as actual_fifo, so the scoreboard compares the DUT with itself and a broken DUT still passes. With the predictor also connected, each transaction puts two items into expected_fifo and the pairs drift out of step.",
  },
  {
    source: "prd.ap",
    imp: "actual_fifo.analysis_export",
    mistake: "prediction-to-actual",
    why: "actual_fifo must hold only what the monitor observed. Predictions in it get compared with predictions, and the extra items push the real ones out of step.",
  },
  {
    source: "prd.ap",
    imp: "cov.analysis_export",
    mistake: "prediction-to-coverage",
    why: "Coverage must sample what the DUT actually did. Predictions come from the reference model, so coverage would count every scenario twice and could credit behaviour the DUT never showed.",
  },
  {
    source: "prd.ap",
    imp: "prd.analysis_export",
    mistake: "feedback-loop",
    why: "The predictor's write() publishes on prd.ap, which calls the predictor's own write() again. At the first transaction the recursion never ends; the exact crash or hang is tool-specific.",
  },
];

const UVM_ACCEPTS = "UVM accepts this connect(): it compiles and elaborates without a message. ";

// ── Per-connection classification ───────────────────────────────────────────

export type ScbConnectionStatus = "serves" | "wrong" | "unneeded" | "given";

export interface ScbConnectionFeedback {
  from: string;
  to: string;
  key: string;
  code: string;
  status: ScbConnectionStatus;
  mistake?: ScbMistake;
  /** Goals this connection carries. */
  goals: ScbGoalId[];
  why: string;
}

/**
 * Classifies one recorded connection within the full set (given + learner).
 * A port → imp call carries exactly one stream (from → to). A port → port call is a promotion,
 * which is never right here: none of these ports is the parent of another.
 */
export function classifyConnection(all: TlmConnection[], conn: TlmConnection): ScbConnectionFeedback {
  const statement = checkConnect(SCB_TOPOLOGY, [], conn.from, conn.to).statement;
  const base = { from: conn.from, to: conn.to, key: connectionKey(conn), code: statement.code, goals: [] as ScbGoalId[] };
  if (isGiven(conn)) {
    return {
      ...base,
      status: "given",
      why: "Already in bus_agent::connect_phase: the driver pulls items from the sequencer. It is not part of the checking side.",
    };
  }
  const to = findEndpoint(SCB_TOPOLOGY, conn.to);
  if (to.role === "port") {
    const reached = resolveBindings(SCB_TOPOLOGY, all).get(conn.to)?.imps ?? [];
    const fromRef = endpointRef(conn.from);
    const toRef = endpointRef(conn.to);
    const now = reached.length
      ? ` Right now that means ${fromRef}'s items would also reach ${reached.map(endpointRef).join(", ")}.`
      : "";
    return {
      ...base,
      status: "wrong",
      mistake: "port-to-port",
      why: `${UVM_ACCEPTS}Port-to-port connect() is promotion: a child's port connects up to its parent's port (analysis ports skip uvm-core's hierarchy check, so nothing warns). ${fromRef} and ${toRef} are not child and parent, so this merges two streams: every write() on ${fromRef} also reaches every subscriber of ${toRef}.${now}`,
    };
  }
  const bad = SCB_FORBIDDEN_FLOWS.find((f) => f.source === conn.from && f.imp === conn.to);
  if (bad) return { ...base, status: "wrong", mistake: bad.mistake, why: `${UVM_ACCEPTS}${bad.why}` };
  const goals = SCB_GOALS.filter((g) => g.from === conn.from && g.reaches === conn.to);
  if (goals.length) {
    return { ...base, status: "serves", goals: goals.map((g) => g.id), why: goals.map((g) => g.servesWhy).join(" ") };
  }
  return {
    ...base,
    status: "unneeded",
    why: "UVM accepts it, but none of the four goals needs it. Remove it to keep connect_phase minimal.",
  };
}

// ── One connect() attempt ───────────────────────────────────────────────────

export type ScbAttemptOutcome = "connected" | "flagged" | "rejected" | "duplicate";

export interface ScbAttempt {
  outcome: ScbAttemptOutcome;
  /** The uvm-core checks, from the shared TLM model. */
  result: ConnectResult;
  /** The statement as it would appear in connect_phase. */
  code: string;
  mistake?: ScbMistake;
  headline: string;
  why: string;
  /** The corrected statement, when one exists. */
  fix?: string;
  /** True when connect() records the binding, so it appears in connect_phase. */
  recorded: boolean;
}

function mistakeFor(result: ConnectResult): ScbMistake | undefined {
  switch (result.rule) {
    case "imp-connect":
    case "export-to-port":
      return "wrong-direction";
    case "type-parameter": {
      const from = findEndpoint(SCB_TOPOLOGY, result.from);
      const to = findEndpoint(SCB_TOPOLOGY, result.to);
      return from.family !== to.family ? "seq-item-mismatch" : "type-mismatch";
    }
    case "interface-mask":
      return "interface-mask";
    case "self":
      return "self";
    default:
      return undefined;
  }
}

function explainRejection(result: ConnectResult, mistake: ScbMistake | undefined): string {
  const from = findEndpoint(SCB_TOPOLOGY, result.from);
  const to = findEndpoint(SCB_TOPOLOGY, result.to);
  if (mistake === "wrong-direction") {
    const naming =
      from.role === "imp" && from.handle.endsWith("export")
        ? ` ${endpointRef(from.id)} is named like an export, but its type is ${from.typeName}: an imp, so uvm-core applies the imp rule.`
        : "";
    return `Wrong direction: connect() is called on the requirer and takes the provider, caller.connect(argument). ${result.why}${naming}`;
  }
  if (mistake === "seq-item-mismatch") {
    const sqr = from.family === "sqr" ? from : to;
    const tlm = from.family === "sqr" ? to : from;
    return `${result.why} ${endpointRef(sqr.id)} carries the sequencer pull interface (get_next_item(), item_done()); ${endpointRef(tlm.id)} carries write(). They are different interface classes, so no connect() can join them.`;
  }
  return result.why;
}

/** Runs one learner connect() against the current wiring and explains the outcome. */
export function attemptConnection(learner: TlmConnection[], from: string, to: string): ScbAttempt {
  const existing = [...SCB_GIVEN, ...learner];
  const result = checkConnect(SCB_TOPOLOGY, existing, from, to);
  const code = result.statement.code;

  if (result.kind === "duplicate") {
    return {
      outcome: "duplicate",
      result,
      code,
      headline: "= Already connected.",
      why: isGiven({ from, to })
        ? "bus_agent::connect_phase already makes this call. A second connect() stores the same provider again and changes nothing."
        : result.why,
      recorded: false,
    };
  }

  if (!result.accepted) {
    const mistake = mistakeFor(result);
    const reverse = checkConnect(SCB_TOPOLOGY, existing, to, from);
    const fix =
      mistake === "wrong-direction" && (reverse.accepted || reverse.kind === "duplicate") ? reverse.statement.code : undefined;
    return {
      outcome: "rejected",
      result,
      code,
      mistake,
      headline: result.kind === "compile_error" ? "✕ Compile error. Not connected." : "✕ UVM_ERROR. Not connected.",
      why: explainRejection(result, mistake),
      fix,
      recorded: false,
    };
  }

  const feedback = classifyConnection([...existing, { from, to }], { from, to });
  if (feedback.status === "wrong") {
    return {
      outcome: "flagged",
      result,
      code,
      mistake: feedback.mistake,
      headline: "! UVM accepts this, but it breaks the checker.",
      why: feedback.why,
      recorded: true,
    };
  }
  return { outcome: "connected", result, code, headline: "✓ Connected.", why: feedback.why, recorded: true };
}

// ── Grading ─────────────────────────────────────────────────────────────────

export interface ScbGoalResult extends ScbGoal {
  met: boolean;
}

export interface ScbGrade {
  /** 25 points per goal met, minus 25 per wrong connection, clamped to 0..100. */
  score: number;
  passed: boolean;
  goals: ScbGoalResult[];
  /** The learner's recorded connections, in connect() order. */
  connections: ScbConnectionFeedback[];
  wrongCount: number;
  /** Forbidden streams that reach their subscriber by any path. */
  forbiddenReached: ScbForbiddenFlow[];
  elaboration: Elaboration;
  /** UVM's own verdict on the same connect_phase. */
  uvmVerdict: string;
  message: string;
}

export const PASS_MESSAGE =
  "Passed: the predictor, the scoreboard's actual FIFO and coverage all receive the monitor stream, and only predictions reach the expected FIFO.";

export function gradeWiring(learner: TlmConnection[]): ScbGrade {
  const elaboration = elaborate(SCB_TOPOLOGY, [...SCB_GIVEN, ...learner]);
  const all = elaboration.connections;
  const status = goalStatus(SCB_TOPOLOGY, all, SCB_GOALS);
  const goals = SCB_GOALS.map((g, i) => ({ ...g, met: status[i].met }));
  const connections = all.filter((c) => !isGiven(c)).map((c) => classifyConnection(all, c));
  const wrongCount = connections.filter((c) => c.status === "wrong").length;
  const res = resolveBindings(SCB_TOPOLOGY, all);
  const forbiddenReached = SCB_FORBIDDEN_FLOWS.filter((f) => res.get(f.source)?.imps.includes(f.imp));
  const met = goals.filter((g) => g.met).length;
  const score = Math.max(0, Math.min(100, Math.round((100 * (met - wrongCount)) / goals.length)));
  const passed = met === goals.length && wrongCount === 0 && forbiddenReached.length === 0;

  const uvmVerdict = !elaboration.runStarts
    ? `UVM stops this env before run_phase (${elaboration.errorCount} error${elaboration.errorCount === 1 ? "" : "s"}).`
    : passed
      ? "UVM agrees: end_of_elaboration passes and run_phase starts."
      : "UVM would run this env without a single message: end_of_elaboration passes. Missing analysis connections and wrong streams are legal UVM, so only a goal check like this one catches them.";

  const issues: string[] = [];
  if (met < goals.length) issues.push(`${met} of ${goals.length} goals met`);
  if (wrongCount > 0) issues.push(`${wrongCount} connect() call${wrongCount === 1 ? "" : "s"} feed${wrongCount === 1 ? "s" : ""} the wrong stream`);
  const message = passed ? PASS_MESSAGE : `Not yet: ${issues.join("; ")}.`;

  return { score, passed, goals, connections, wrongCount, forbiddenReached, elaboration, uvmVerdict, message };
}

// ── Generated connect_phase code ────────────────────────────────────────────

export interface ScbCodeLine {
  text: string;
  /** Connection key, for highlighting and the remove control. */
  key?: string;
  /** Part of the given bus_agent code; not removable. */
  given?: boolean;
}

/** connect_phase code grouped by the class that holds each call: bus_env first, the given agent code last. */
export function connectPhaseSource(learner: TlmConnection[]): ScbCodeLine[] {
  const groups = new Map<string, { conn: TlmConnection; given: boolean }[]>([[SCB_WRITER, []]]);
  const add = (conn: TlmConnection, given: boolean) => {
    const { writer } = checkConnect(SCB_TOPOLOGY, [], conn.from, conn.to).statement;
    groups.set(writer, [...(groups.get(writer) ?? []), { conn, given }]);
  };
  learner.forEach((c) => add(c, false));
  SCB_GIVEN.forEach((c) => add(c, true));

  const lines: ScbCodeLine[] = [];
  for (const [writer, entries] of groups) {
    const cls = SCB_TOPOLOGY.components.find((c) => c.id === writer)?.cls ?? writer;
    const given = entries.length > 0 && entries.every((e) => e.given);
    lines.push({ text: `// ${cls}::connect_phase${given ? " (already written)" : ""}` });
    if (entries.length === 0) lines.push({ text: "// (no connect() calls yet)" });
    for (const { conn, given: g } of entries) {
      lines.push({
        text: checkConnect(SCB_TOPOLOGY, [], conn.from, conn.to).statement.code,
        key: connectionKey(conn),
        given: g || undefined,
      });
    }
  }
  return lines;
}

// ── After success: the write() call order ───────────────────────────────────

export interface ScbWriteCall {
  /** 0 = called by the monitor's ap.write(t); 1 = nested inside a forwarding subscriber. */
  depth: number;
  /** "1", "2", "2.1"… */
  index: string;
  imp: string;
  fullName: string;
  /** e.g. `cov.write(t)` or `scb.actual_fifo.write(t)`. */
  call: string;
  effect: string;
}

function effectOf(imp: TlmEndpoint, arg: string): string {
  if (imp.owner === "cov") return "samples the covergroup and returns.";
  if (SCB_FORWARDS[imp.id]) return `computes the expected item, then calls ${endpointRef(SCB_FORWARDS[imp.id])}.write(exp) before returning:`;
  if (imp.owner.endsWith("_fifo")) return `runs void'(try_put(${arg})): stores the handle in the unbounded FIFO and returns at once.`;
  return "runs and returns.";
}

/**
 * The nested write() calls one monitor write() triggers, in the order uvm-core 2020.3.1
 * makes them. Each level comes from analysisCallOrder() (full-name order).
 */
export function writeCallOrder(learner: TlmConnection[], portId: string = "mon.ap"): ScbWriteCall[] {
  const all = [...SCB_GIVEN, ...learner];
  const out: ScbWriteCall[] = [];
  const walk = (port: string, depth: number, prefix: string, stack: string[]) => {
    const arg = PUBLISHED_ARG[port] ?? "t";
    analysisCallOrder(SCB_TOPOLOGY, all, port).forEach((impId, i) => {
      const imp = findEndpoint(SCB_TOPOLOGY, impId);
      const index = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      out.push({
        depth,
        index,
        imp: impId,
        fullName: endpointFullName(SCB_TOPOLOGY, imp),
        call: `${componentRef(imp.owner)}.${imp.implMethod ?? "write"}(${arg})`,
        effect: effectOf(imp, arg),
      });
      const next = SCB_FORWARDS[impId];
      // A subscriber that is already on the call stack would recurse without end: stop there.
      if (next && !stack.includes(next)) walk(next, depth + 1, index, [...stack, next]);
    });
  };
  walk(portId, 0, "", [portId]);
  return out;
}

export const CALL_ORDER_RULE =
  "uvm-core 2020.3.1 calls the subscribers in full-name order. uvm_analysis_port::write() loops get_if(i) over m_imp_list, an associative array indexed by each imp's full name, and SystemVerilog walks string-indexed arrays in lexicographic order. connect() order does not matter, and IEEE 1800.2 promises no order at all, so checking code must never depend on it.";

export const FIFO_THREAD_POINTS = [
  "Every call above runs inside the monitor's run_phase process, at the same simulation time. write() is a function: it cannot wait, and the monitor's next statement runs only after the last call returns.",
  "uvm_tlm_analysis_fifo::write() is void'(try_put(t)) on an unbounded FIFO, so it always succeeds at once: the monitor never stalls and no item is dropped.",
  "The scoreboard's run_phase is a separate process. get() is a task that blocks until an item is present, so the scoreboard pairs each expected item with its actual item whichever was written first, and the comparison may take time without stalling the monitor.",
  "The FIFO stores the handle it is given, not a copy, so the predictor must write a new object and no subscriber may modify t.",
];

/** The scoreboard thread that drains both FIFOs. */
export function scoreboardRunPhaseSource(): string[] {
  return [
    "// bus_scoreboard::run_phase: its own process",
    "task run_phase(uvm_phase phase);",
    `  ${SCB_TXN} exp, act;`,
    "  forever begin",
    "    expected_fifo.get(exp);  // blocks until prd has written",
    "    actual_fifo.get(act);    // blocks until mon has written",
    '    if (!act.compare(exp)) `uvm_error("SCB", "mismatch")',
    "  end",
    "endtask",
  ];
}

// ── Prediction about the call order ─────────────────────────────────────────

export interface ScbPredictionOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Whose write() runs first when the monitor writes? Correctness comes from analysisCallOrder(). */
export function callOrderPrediction(learner: TlmConnection[]): ScbPredictionOption[] {
  const order = writeCallOrder(learner).filter((c) => c.depth === 0);
  const first = order[0];
  const names = order.map((c) => c.fullName).join(" < ");
  const firstIs = (imp: string) => first?.imp === imp;
  return [
    {
      id: "prd",
      label: "prd.write(t): the predictor has to run before the scoreboard.",
      correct: firstIs("prd.analysis_export"),
      feedback: firstIs("prd.analysis_export")
        ? `uvm-core walks the subscribers in full-name order: ${names}.`
        : `Nothing in UVM gives the predictor priority. The order comes from the imps' full names: ${names}.`,
    },
    {
      id: "cov",
      label: "cov.write(t).",
      correct: firstIs("cov.analysis_export"),
      feedback: firstIs("cov.analysis_export")
        ? `uvm-core walks the subscribers in full-name order: ${names}. The predictor still runs before actual_fifo receives its item, but only because "prd" sorts before "scb".`
        : `The order comes from the imps' full names: ${names}.`,
    },
    {
      id: "connect-order",
      label: "Whichever subscriber's connect() ran first.",
      correct: false,
      feedback: `uvm-core does not remember connect() order: resolve_bindings() stores the imps in an array keyed by full name, so the order is ${names} however you wrote connect_phase.`,
    },
    {
      id: "parallel",
      label: "None first: the three write() calls run in parallel threads.",
      correct: false,
      feedback:
        "write() is a function. The port's write() calls each subscriber in turn, inside the monitor's own process, and each call returns before the next one starts.",
    },
  ];
}
