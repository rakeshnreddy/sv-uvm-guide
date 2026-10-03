/**
 * Deterministic educational model of UVM phasing and objections.
 *
 * Semantics follow IEEE 1800.2-2020 as implemented by the Accellera
 * reference library uvm-core, tag 2020.3.1 (files under src/base unless noted).
 * Each rule below was checked against that source:
 *
 * - uvm_common_phases.svh: build and final extend uvm_topdown_phase; connect,
 *   end_of_elaboration, start_of_simulation, extract, check and report extend
 *   uvm_bottomup_phase; run extends uvm_task_phase (§9.8.1.1–9.8.1.9).
 * - uvm_topdown_phase.svh / uvm_bottomup_phase.svh traverse(): the component
 *   is executed before (top-down) or after (bottom-up) its children, which are
 *   visited with get_first_child()/get_next_child() — depth-first pre-order or
 *   post-order.
 * - uvm_component.svh: children live in `uvm_component m_children[string]`, so
 *   siblings are visited in lexicographic name order (IEEE 1800-2023 §7.8.2),
 *   not in creation order.
 * - uvm_runtime_phases.svh + uvm_domain.svh: add_uvm_phases() puts the 12
 *   runtime phases, in order, into the "uvm_sched" schedule of the "uvm"
 *   domain; get_common_domain() adds that domain `.with_phase(run)`, so the
 *   schedule runs alongside run_phase (§9.8.2.1–9.8.2.12, §9.4).
 * - uvm_task_phase.svh: exec_task is forked for every component (join_none);
 *   when the phase ends, threads still running are killed.
 * - uvm_phase_hopper.svh execute_phase(): after one NBA region a task phase
 *   with no objection raised is skipped ("No objections raised, skipping
 *   phase"); otherwise it waits for UVM_ALL_DROPPED. It then waits for itself
 *   and its siblings to drop and calls phase_ready_to_end() on every
 *   component, repeating while somebody re-raises, at most
 *   get_max_ready_to_end_iterations() times (default 20, §9.3.1.3.5). Only the
 *   phase named "run" starts the timeout watchdog: after uvm_root's
 *   phase_timeout (default `UVM_DEFAULT_TIMEOUT = 9200s; 0 = never) it issues
 *   `uvm_fatal("PH_TIMEOUT", "<Default|Explicit> timeout of <t> hit, ...")`.
 * - uvm_phase.svh wait_for_self_and_siblings_to_drop(): siblings are the other
 *   predecessors of this phase's successors. extract's predecessors are run
 *   and the end of the uvm domain, so run_phase cannot end before the uvm
 *   schedule has finished.
 * - uvm_objection.svh drop_objection() (§10.5.1.3.4): when an object's count
 *   reaches zero, propagation waits for that object's drain time
 *   (set_drain_time, §10.5.1.3.7); a raise during the drain cancels it.
 * - uvm_phase.svh add() (§9.3.1.6.1): anchors are looked up with
 *   find(phase, stay_in_scope=1). A phase outside the target schedule or
 *   domain is not found → `uvm_fatal("PH_BAD_ADD", "cannot find after_phase
 *   '<name>' within node '<node>'")`. With only after_phase the new phase is
 *   inserted serially; with_phase makes a parallel branch.
 * - uvm_phase.svh: the default exec_task() is empty.
 * - src/comps/uvm_agent.svh: build_phase calls super.build_phase, then reads
 *   is_active from the resource pool; is_active defaults to UVM_ACTIVE.
 *   uvm_component::build_phase → build() → apply_config_settings() when
 *   use_automatic_config() returns 1 (its default).
 *
 * Model assumptions (also shown to learners): times are in ns; drain time is
 * set on uvm_test_top and every objector is uvm_test_top or a descendant, so
 * the drain applies to the total count; a raise in the same time step as a
 * drop, or exactly when a drain ends, keeps the phase busy; phase jumps and
 * user-defined domains are not modelled.
 */

export type PhaseOrder = "top-down" | "bottom-up" | "parallel";
export type PhaseBase = "uvm_topdown_phase" | "uvm_bottomup_phase" | "uvm_task_phase";

export interface PhaseDef {
  /** get_name() of the phase object, e.g. "build" or "main". */
  name: string;
  /** Component callback, e.g. "build_phase". */
  method: string;
  phaseClass: string;
  base: PhaseBase;
  domain: "common" | "uvm";
  /** IEEE 1800.2-2020 clause, from the @uvm-ieee tag in uvm-core. */
  clause: string;
  purpose: string;
}

export const phaseOrder = (phase: PhaseDef): PhaseOrder =>
  phase.base === "uvm_topdown_phase" ? "top-down" : phase.base === "uvm_bottomup_phase" ? "bottom-up" : "parallel";

export const isTaskPhase = (phase: PhaseDef) => phase.base === "uvm_task_phase";

const common = (name: string, base: PhaseBase, clause: string, purpose: string): PhaseDef => ({
  name,
  method: `${name}_phase`,
  phaseClass: `uvm_${name}_phase`,
  base,
  domain: "common",
  clause,
  purpose,
});

/** The nine phases of the common domain, in schedule order (uvm_domain::get_common_domain). */
export const COMMON_PHASES: PhaseDef[] = [
  common("build", "uvm_topdown_phase", "9.8.1.1", "Create children with type_id::create and read configuration. A parent must exist before it can create its children."),
  common("connect", "uvm_bottomup_phase", "9.8.1.2", "Connect TLM ports, exports and imps. Every component exists by now."),
  common("end_of_elaboration", "uvm_bottomup_phase", "9.8.1.3", "Final topology checks and adjustments; print the topology."),
  common("start_of_simulation", "uvm_bottomup_phase", "9.8.1.4", "Last zero-time setup before time advances: banners, debug settings."),
  common("run", "uvm_task_phase", "9.8.1.5", "Consumes simulation time. Every component's run_phase is forked at once; drivers and monitors loop forever here."),
  common("extract", "uvm_bottomup_phase", "9.8.1.6", "Pull final data out of scoreboards, monitors and coverage."),
  common("check", "uvm_bottomup_phase", "9.8.1.7", "Check for errors, e.g. expected items that never arrived."),
  common("report", "uvm_bottomup_phase", "9.8.1.8", "Print results and the pass/fail summary."),
  common("final", "uvm_topdown_phase", "9.8.1.9", "Close files and finish anything that must happen last."),
];

export const RUNTIME_PHASE_NAMES = [
  "pre_reset",
  "reset",
  "post_reset",
  "pre_configure",
  "configure",
  "post_configure",
  "pre_main",
  "main",
  "post_main",
  "pre_shutdown",
  "shutdown",
  "post_shutdown",
] as const;
export type RuntimePhaseName = (typeof RUNTIME_PHASE_NAMES)[number];

const RUNTIME_PURPOSE: Record<RuntimePhaseName, string> = {
  pre_reset: "Wait for power-up or clock stability before reset.",
  reset: "Drive and release DUT reset.",
  post_reset: "Wait for the DUT to settle after reset.",
  pre_configure: "Prepare configuration (e.g. compute register values).",
  configure: "Program the DUT, e.g. through RAL.",
  post_configure: "Wait for configuration to take effect.",
  pre_main: "Wait until the DUT is ready for traffic.",
  main: "Primary stimulus.",
  post_main: "Let the last traffic finish.",
  pre_shutdown: "Prepare to stop.",
  shutdown: "Drain outstanding transactions.",
  post_shutdown: "Final time-consuming clean-up.",
};

/** The 12 runtime phases of the uvm schedule, in order (uvm_domain::add_uvm_phases). */
export const RUNTIME_PHASES: PhaseDef[] = RUNTIME_PHASE_NAMES.map((name, i) => ({
  name,
  method: `${name}_phase`,
  phaseClass: `uvm_${name}_phase`,
  base: "uvm_task_phase" as const,
  domain: "uvm" as const,
  clause: `9.8.2.${i + 1}`,
  purpose: RUNTIME_PURPOSE[name],
}));

export const ALL_PHASES: PhaseDef[] = [...COMMON_PHASES, ...RUNTIME_PHASES];

export function findPhase(name: string): PhaseDef | undefined {
  const bare = name.replace(/_phase$/, "");
  return ALL_PHASES.find((p) => p.name === bare);
}

// ---------------------------------------------------------------------------
// Component tree and traversal order
// ---------------------------------------------------------------------------

export interface ComponentNode {
  /** Instance name passed to type_id::create. */
  name: string;
  type: string;
  /** Listed in creation order (the order of the create calls in build_phase). */
  children?: ComponentNode[];
}

/**
 * Example tree used by the visuals. env creates scb before agt, and agt creates
 * sqr, drv, mon in that order, so creation order and visit order differ.
 */
export const EXAMPLE_TREE: ComponentNode = {
  name: "uvm_test_top",
  type: "my_test",
  children: [
    {
      name: "env",
      type: "my_env",
      children: [
        { name: "scb", type: "my_scoreboard" },
        {
          name: "agt",
          type: "my_agent",
          children: [
            { name: "sqr", type: "my_sequencer" },
            { name: "drv", type: "my_driver" },
            { name: "mon", type: "my_monitor" },
          ],
        },
      ],
    },
  ],
};

/** SystemVerilog string ordering for ASCII names: byte-wise, lesser to greater. */
export function compareInstanceNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Children in the order get_first_child()/get_next_child() return them. */
export function childrenInVisitOrder(node: ComponentNode): ComponentNode[] {
  return [...(node.children ?? [])].sort((a, b) => compareInstanceNames(a.name, b.name));
}

export interface PhaseCall {
  /** Full name, e.g. "uvm_test_top.env.agt.drv". */
  path: string;
  name: string;
  type: string;
  depth: number;
}

function walk(node: ComponentNode, prefix: string, depth: number, post: boolean, out: PhaseCall[]) {
  const path = prefix ? `${prefix}.${node.name}` : node.name;
  const call = { path, name: node.name, type: node.type, depth };
  if (!post) out.push(call);
  for (const child of childrenInVisitOrder(node)) walk(child, path, depth + 1, post, out);
  if (post) out.push(call);
}

/** Every component, parents before children (the build_phase order). */
export function componentList(root: ComponentNode = EXAMPLE_TREE): PhaseCall[] {
  const out: PhaseCall[] = [];
  walk(root, "", 0, false, out);
  return out;
}

export interface PhaseCallOrder {
  phase: PhaseDef;
  order: PhaseOrder;
  /**
   * Function phases: the exact call sequence. Task phases: the order in which
   * uvm_task_phase forks the per-component threads (children first). All of
   * them start in the same time step, so learners must not rely on it.
   */
  calls: PhaseCall[];
}

/**
 * Order in which a phase calls each component (uvm_root itself, the traversal
 * root, is omitted). Top-down = depth-first pre-order, bottom-up = depth-first
 * post-order, siblings in name order.
 */
export function phaseCallOrder(phaseName: string, root: ComponentNode = EXAMPLE_TREE): PhaseCallOrder {
  const phase = findPhase(phaseName);
  if (!phase) throw new Error(`Unknown phase ${phaseName}`);
  const order = phaseOrder(phase);
  const calls: PhaseCall[] = [];
  walk(root, "", 0, order !== "top-down", calls);
  return { phase, order, calls };
}

// ---------------------------------------------------------------------------
// super.build_phase: what it does and what it does not do
// ---------------------------------------------------------------------------

export type ActivePassive = "UVM_ACTIVE" | "UVM_PASSIVE";

export interface AgentBuildInput {
  /** Does my_agent::build_phase call super.build_phase(phase)? */
  callsSuper: boolean;
  /** uvm_config_db set of "is_active" for this agent, if any. */
  configuredIsActive: ActivePassive | null;
  /** uvm_config_db#(int) set of the `uvm_field_int`-registered num_txns, if any. */
  configuredNumTxns: number | null;
}

export interface AgentBuildOutcome {
  isActive: ActivePassive;
  isActiveSource: "config_db" | "default";
  numTxns: number;
  numTxnsSource: "config_db" | "default";
  /** Children the agent's own create() calls make. */
  children: string[];
  /** Did apply_config_settings run for this agent? */
  autoConfigApplied: boolean;
  /** The phasing engine still calls build_phase on every child that exists. */
  childBuildPhasesRun: boolean;
}

export const AGENT_NUM_TXNS_DEFAULT = 10;

/**
 * Outcome of my_agent::build_phase. Children are created only by the user's
 * own create() calls; super.build_phase contributes auto-config
 * (apply_config_settings, uvm_component.svh) and, for uvm_agent, the is_active
 * lookup (uvm_agent.svh). Skipping super therefore silently ignores both
 * config_db settings — it never stops child creation.
 */
export function agentBuild(input: AgentBuildInput): AgentBuildOutcome {
  const useConfig = input.callsSuper;
  const isActive: ActivePassive = useConfig && input.configuredIsActive ? input.configuredIsActive : "UVM_ACTIVE";
  const numTxns = useConfig && input.configuredNumTxns !== null ? input.configuredNumTxns : AGENT_NUM_TXNS_DEFAULT;
  return {
    isActive,
    isActiveSource: useConfig && input.configuredIsActive ? "config_db" : "default",
    numTxns,
    numTxnsSource: useConfig && input.configuredNumTxns !== null ? "config_db" : "default",
    children: isActive === "UVM_ACTIVE" ? ["mon", "drv", "sqr"] : ["mon"],
    autoConfigApplied: useConfig,
    childBuildPhasesRun: true,
  };
}

// ---------------------------------------------------------------------------
// Objections, drain time, phase_ready_to_end and the timeout
// ---------------------------------------------------------------------------

/** `UVM_DEFAULT_TIMEOUT (uvm_global_defines.svh) = 9200s, in ns. */
export const UVM_DEFAULT_TIMEOUT_NS = 9200e9;
/** uvm_phase m_default_max_ready_to_end_iters (§9.3.1.3.5). */
export const DEFAULT_MAX_READY_TO_END_ITERATIONS = 20;

export interface ObjectionSpan {
  /** Component path relative to uvm_test_top's parent, e.g. "uvm_test_top.env.scb". */
  who: string;
  /** ns after the phase starts. 0 = before anything consumes time. */
  raiseAt: number;
  /** ns after the phase starts; null = never dropped. */
  dropAt: number | null;
  label?: string;
}

export type ReadyToEndHook =
  /** Re-raise in phase_ready_to_end for `extendBy` ns, on the first `rounds` calls. */
  | { who: string; kind: "fixed"; extendBy: number; rounds: number }
  /** Raise while any arrival is still pending; drop when the last one arrives. */
  | { who: string; kind: "until-arrivals" };

export interface PhaseActivity {
  objections?: ObjectionSpan[];
  /** phase.get_objection().set_drain_time(this, drainTime) in uvm_test_top. */
  drainTime?: number;
  readyToEnd?: ReadyToEndHook;
  /** Things a thread of this phase waits to observe (e.g. the last DUT response), ns after phase start. */
  arrivals?: { at: number; label: string }[];
}

export interface RunScenario {
  run?: PhaseActivity;
  schedule?: Partial<Record<RuntimePhaseName, PhaseActivity>>;
  /** uvm_root phase_timeout in ns. Default 9200 s; 0 means no watchdog. */
  timeout?: number;
  maxReadyToEndIterations?: number;
}

export type PhaseEndReason = "all-dropped" | "no-objection" | "timeout" | "not-reached" | "hang";

export type ObjectionEventKind =
  | "start"
  | "raise"
  | "drop"
  | "drain"
  | "drain-cancel"
  | "all-dropped"
  | "skip"
  | "ready-to-end"
  | "end"
  | "killed"
  | "arrival"
  | "lost"
  | "timeout";

export interface ObjectionEvent {
  t: number;
  phase: string;
  kind: ObjectionEventKind;
  who?: string;
  count?: number;
  text: string;
}

export interface LaneResult {
  phase: string;
  start: number | null;
  /** null = the phase never ends (no watchdog). */
  end: number | null;
  reason: PhaseEndReason;
  /** When every objection had dropped (after drain), before phase_ready_to_end rounds. */
  allDroppedAt: number | null;
  readyToEndRounds: number;
  /** Total objection count below uvm_test_top over time, as [time, count] steps. */
  countSteps: [number, number][];
  drains: { from: number; to: number; cancelled: boolean }[];
  /** Raises that never executed because the phase had already ended and killed its threads. */
  killedRaises: ObjectionSpan[];
  arrivals: { at: number; label: string; seen: boolean }[];
  /** run only: its own objections had dropped, so it ended when the uvm schedule ended. */
  waitedForSchedule: boolean;
  events: ObjectionEvent[];
}

export interface RunResult {
  lanes: Record<string, LaneResult>;
  scheduleEnd: number | null;
  runEnd: number | null;
  fatal: { at: number; id: "PH_TIMEOUT"; message: string } | null;
  /** Time extract/check/report/final run (zero time), or null when they never run. */
  cleanupAt: number | null;
  /** Never ends and no watchdog: the simulation hangs. */
  hangs: boolean;
  timeout: number;
  events: ObjectionEvent[];
}

interface AbsSpan {
  r: number;
  d: number;
  who: string;
  hook: boolean;
  src?: ObjectionSpan;
}

interface Block {
  a: number;
  /** Last drop (count back to zero). */
  b: number;
  /** b + drain: when the drop reaches the top. */
  e: number;
  cancelled: { from: number; to: number }[];
}

/** Busy periods of the phase objection as seen at the top, including drain and drain cancellation. */
function busyBlocks(spans: AbsSpan[], drain: number): Block[] {
  const sorted = [...spans].sort((x, y) => x.r - y.r || x.d - y.d);
  const blocks: Block[] = [];
  for (const s of sorted) {
    const cur = blocks[blocks.length - 1];
    if (cur && s.r <= cur.b) {
      cur.b = Math.max(cur.b, s.d);
    } else if (cur && s.r <= cur.b + drain) {
      // A raise during the drain cancels it (uvm_objection.svh drop_objection).
      cur.cancelled.push({ from: cur.b, to: s.r });
      cur.b = Math.max(cur.b, s.d);
    } else {
      blocks.push({ a: s.r, b: s.d, e: 0, cancelled: [] });
      continue;
    }
  }
  for (const k of blocks) k.e = k.b + drain;
  return blocks;
}

const busyAt = (blocks: Block[], t: number) => blocks.some((k) => k.a <= t && t < k.e);

function firstIdle(blocks: Block[], t: number): number {
  let cur = t;
  for (let guard = 0; guard < blocks.length + 1; guard += 1) {
    const hit = blocks.find((k) => k.a <= cur && cur < k.e);
    if (!hit) return cur;
    cur = hit.e;
  }
  return cur;
}

export function formatTime(ns: number | null): string {
  if (ns === null || !Number.isFinite(ns)) return "never";
  if (ns >= 1e9 && ns % 1e9 === 0) return `${ns / 1e9} s`;
  if (ns >= 1e3 && ns % 1e3 === 0) return `${ns / 1e3} us`;
  return `${ns} ns`;
}

/** Round tick positions (ns) for a time axis from 0 to `max`. */
export function timeTicks(max: number, target = 5): number[] {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(t);
  return ticks;
}

/** One line of a simplified +UVM_OBJECTION_TRACE-style log. */
export function eventLogLine(e: ObjectionEvent): string {
  const tag =
    e.kind === "timeout"
      ? ""
      : e.kind === "raise" || e.kind === "drop" || e.kind === "drain" || e.kind === "drain-cancel" || e.kind === "all-dropped"
        ? "[OBJTN] "
        : e.kind === "arrival" || e.kind === "lost"
          ? "[SCB] "
          : "[PHASE] ";
  return `@ ${formatTime(e.t).padEnd(7)} ${e.phase.padEnd(5)} ${tag}${e.text}`;
}

function simulateLane(phase: string, activity: PhaseActivity | undefined, start: number, notBefore: number, maxIter: number): LaneResult {
  const act = activity ?? {};
  const drain = act.drainTime ?? 0;
  const spans: AbsSpan[] = (act.objections ?? []).map((o) => ({
    r: start + o.raiseAt,
    d: o.dropAt === null ? Number.POSITIVE_INFINITY : start + o.dropAt,
    who: o.who,
    hook: false,
    src: o,
  }));
  const arrivalsAbs = (act.arrivals ?? []).map((a) => ({ at: start + a.at, label: a.label }));
  const hookSpans: AbsSpan[] = [];
  const blocksNow = () => busyBlocks([...spans, ...hookSpans], drain);

  let t = firstIdle(blocksNow(), Math.max(start, notBefore));
  const allDroppedAt = t;
  const readyEvents: ObjectionEvent[] = [];
  let rounds = 0;
  while (Number.isFinite(t)) {
    rounds += 1;
    readyEvents.push({ t, phase, kind: "ready-to-end", text: `phase_ready_to_end() called on every component (round ${rounds})` });
    const hook = act.readyToEnd;
    if (hook?.kind === "fixed" && rounds <= hook.rounds && hook.extendBy > 0) {
      hookSpans.push({ r: t, d: t + hook.extendBy, who: hook.who, hook: true });
    } else if (hook?.kind === "until-arrivals") {
      const pending = arrivalsAbs.filter((a) => a.at > t);
      if (pending.length > 0) hookSpans.push({ r: t, d: Math.max(...pending.map((a) => a.at)), who: hook.who, hook: true });
    }
    const blocks = blocksNow();
    if (!busyAt(blocks, t)) break;
    t = firstIdle(blocks, t);
    if (rounds >= maxIter) break;
  }
  const end = t;

  const executed = [...spans, ...hookSpans].filter((s) => s.r <= end);
  const killedRaises = spans.filter((s) => s.r > end).map((s) => s.src as ObjectionSpan);
  const ownRaises = executed.length;

  // Objection count steps over [start, end].
  const deltas = new Map<number, number>();
  for (const s of executed) {
    deltas.set(s.r, (deltas.get(s.r) ?? 0) + 1);
    if (Number.isFinite(s.d) && s.d <= end) deltas.set(s.d, (deltas.get(s.d) ?? 0) - 1);
  }
  const countSteps: [number, number][] = [[start, 0]];
  let count = 0;
  for (const time of [...deltas.keys()].sort((x, y) => x - y)) {
    count += deltas.get(time) ?? 0;
    if (countSteps[countSteps.length - 1][0] === time) countSteps[countSteps.length - 1][1] = count;
    else countSteps.push([time, count]);
  }

  const finalBlocks = busyBlocks(executed, drain);
  const drains: LaneResult["drains"] = [];
  if (drain > 0) {
    for (const k of finalBlocks) {
      for (const c of k.cancelled) drains.push({ from: c.from, to: c.to, cancelled: true });
      if (Number.isFinite(k.b) && k.e <= end) drains.push({ from: k.b, to: k.e, cancelled: false });
    }
  }
  const skipped = !busyAt(busyBlocks(spans, drain), start);

  const events: ObjectionEvent[] = [{ t: start, phase, kind: "start", text: `${phase}_phase starts` }];
  if (skipped) {
    events.push({
      t: start,
      phase,
      kind: "skip",
      text:
        phase === "run" && notBefore > start
          ? "no objection raised in the first time step: run_phase stops waiting for its own objections, but still waits for the uvm schedule"
          : "no objection raised in the first time step: the phase is skipped",
    });
  }
  const timeline = [...executed]
    .flatMap((s) => [
      { t: s.r, kind: "raise" as const, s },
      ...(Number.isFinite(s.d) && s.d <= end ? [{ t: s.d, kind: "drop" as const, s }] : []),
    ])
    .sort((x, y) => x.t - y.t || (x.kind === "drop" ? -1 : 1));
  let running = 0;
  for (const ev of timeline) {
    running += ev.kind === "raise" ? 1 : -1;
    events.push({
      t: ev.t,
      phase,
      kind: ev.kind,
      who: ev.s.who,
      count: running,
      text: `${ev.s.who} ${ev.kind === "raise" ? "raised" : "dropped"} an objection${ev.s.hook ? " in phase_ready_to_end" : ""}: count=${running}`,
    });
  }
  for (const d of drains) {
    events.push(
      d.cancelled
        ? { t: d.to, phase, kind: "drain-cancel", text: `raise during the drain: drain cancelled` }
        : { t: d.from, phase, kind: "drain", text: `count is 0: waiting the ${formatTime(drain)} drain time` },
    );
  }
  if (Number.isFinite(allDroppedAt) && ownRaises > 0) {
    events.push({ t: allDroppedAt, phase, kind: "all-dropped", text: "all objections dropped" });
  }
  events.push(...readyEvents);
  if (Number.isFinite(end)) events.push({ t: end, phase, kind: "end", text: `${phase}_phase ends; its threads are killed` });
  for (const k of killedRaises) {
    events.push({ t: end, phase, kind: "killed", who: k.who, text: `${k.who}'s raise at +${k.raiseAt} ns never runs: the phase already ended` });
  }
  const arrivals = arrivalsAbs.map((a) => ({ ...a, seen: a.at <= end }));
  for (const a of arrivals) {
    events.push(
      a.seen
        ? { t: a.at, phase, kind: "arrival", text: `${a.label} observed` }
        : { t: end, phase, kind: "lost", text: `${a.label} (due at ${formatTime(a.at)}) is never observed: the thread was killed` },
    );
  }

  const anyRaiseExecuted = executed.length > 0;
  events.sort((a, b) => a.t - b.t);
  return {
    phase,
    start,
    end: Number.isFinite(end) ? end : null,
    reason: !Number.isFinite(end) ? "hang" : anyRaiseExecuted ? "all-dropped" : "no-objection",
    allDroppedAt: Number.isFinite(allDroppedAt) ? allDroppedAt : null,
    readyToEndRounds: rounds,
    countSteps,
    drains,
    killedRaises,
    arrivals,
    waitedForSchedule: phase === "run" && notBefore > start && allDroppedAt === notBefore && !busyAt(busyBlocks(spans, drain), notBefore),
    events,
  };
}

function notReached(phase: string): LaneResult {
  return {
    phase,
    start: null,
    end: null,
    reason: "not-reached",
    allDroppedAt: null,
    readyToEndRounds: 0,
    countSteps: [],
    drains: [],
    killedRaises: [],
    arrivals: [],
    waitedForSchedule: false,
    events: [],
  };
}

function truncate(lane: LaneResult, at: number): LaneResult {
  if (lane.start === null || lane.start >= at) return notReached(lane.phase);
  if (lane.end !== null && lane.end <= at) return lane;
  return {
    ...lane,
    end: at,
    reason: "timeout",
    countSteps: lane.countSteps.filter(([t]) => t <= at),
    drains: lane.drains.filter((d) => d.from < at),
    arrivals: lane.arrivals.map((a) => ({ ...a, seen: a.at <= at })),
    events: lane.events.filter((e) => e.t <= at && e.kind !== "end" && e.kind !== "killed" && e.kind !== "lost"),
  };
}

/**
 * Simulate the run-time part of a test: run_phase in parallel with the 12-phase
 * uvm schedule, objections, drain, phase_ready_to_end and the timeout.
 */
export function simulateRun(scenario: RunScenario): RunResult {
  const maxIter = scenario.maxReadyToEndIterations ?? DEFAULT_MAX_READY_TO_END_ITERATIONS;
  const timeout = scenario.timeout ?? UVM_DEFAULT_TIMEOUT_NS;
  let lanes: Record<string, LaneResult> = {};

  let cursor = 0;
  for (const name of RUNTIME_PHASE_NAMES) {
    if (!Number.isFinite(cursor)) {
      lanes[name] = notReached(name);
      continue;
    }
    const lane = simulateLane(name, scenario.schedule?.[name], cursor, cursor, maxIter);
    lanes[name] = lane;
    cursor = lane.end ?? Number.POSITIVE_INFINITY;
  }
  const scheduleEnd = cursor;
  // run_phase cannot end before the uvm schedule ends (wait_for_self_and_siblings_to_drop).
  const run = simulateLane("run", scenario.run, 0, scheduleEnd, maxIter);
  lanes.run = run;
  const runEnd = run.end ?? Number.POSITIVE_INFINITY;

  let fatal: RunResult["fatal"] = null;
  if (timeout > 0 && runEnd > timeout) {
    const kind = timeout === UVM_DEFAULT_TIMEOUT_NS ? "Default" : "Explicit";
    fatal = { at: timeout, id: "PH_TIMEOUT", message: `${kind} timeout of ${formatTime(timeout)} hit, indicating a probable testbench issue` };
    lanes = Object.fromEntries(Object.entries(lanes).map(([k, lane]) => [k, truncate(lane, timeout)]));
  }

  const events = Object.values(lanes)
    .flatMap((l) => l.events)
    .concat(fatal ? [{ t: fatal.at, phase: "run", kind: "timeout" as const, text: `UVM_FATAL [PH_TIMEOUT] ${fatal.message}` }] : [])
    .sort((a, b) => a.t - b.t);

  return {
    lanes,
    scheduleEnd: Number.isFinite(scheduleEnd) && !(fatal && scheduleEnd > fatal.at) ? scheduleEnd : null,
    runEnd: fatal ? null : Number.isFinite(runEnd) ? runEnd : null,
    fatal,
    cleanupAt: fatal || !Number.isFinite(runEnd) ? null : runEnd,
    hangs: !fatal && !Number.isFinite(runEnd),
    timeout,
    events,
  };
}

// ---------------------------------------------------------------------------
// Custom phase insertion (uvm_phase::add)
// ---------------------------------------------------------------------------

export type InsertTarget = "common" | "uvm_sched";

export interface CustomPhaseInsert {
  /** get_name() of the new phase, e.g. "load_fw". */
  name: string;
  target: InsertTarget;
  after?: string;
  before?: string;
  with?: string;
  implementsExecTask: boolean;
}

export type ScheduleStep = { kind: "phase"; name: string; custom?: boolean } | { kind: "parallel"; lanes: string[][]; custom: string };

export interface InsertResult {
  ok: boolean;
  fatal: { id: "PH_BAD_ADD"; message: string } | null;
  /** The edited container, in execution order. */
  steps: ScheduleStep[];
  /** Phase names of the edited container in order (custom included, parallel branch flattened). */
  container: string[];
  componentMethodCalled: boolean;
  notes: string[];
}

export const containerNodeName = (target: InsertTarget) => (target === "common" ? "common" : "uvm_sched");

const containerPhases = (target: InsertTarget): string[] =>
  target === "common" ? COMMON_PHASES.map((p) => p.name) : [...RUNTIME_PHASE_NAMES];

/** Model of uvm_phase::add(phase, with_phase, after_phase, before_phase) on a linear schedule. */
export function insertCustomPhase(spec: CustomPhaseInsert): InsertResult {
  const base = containerPhases(spec.target);
  const node = containerNodeName(spec.target);
  const fail = (message: string): InsertResult => ({
    ok: false,
    fatal: { id: "PH_BAD_ADD", message },
    steps: base.map((name) => ({ kind: "phase", name })),
    container: base,
    componentMethodCalled: false,
    notes: ["uvm_fatal ends the simulation during build_phase; no test runs."],
  });

  // Same order of checks as uvm_phase::add.
  for (const [arg, value] of [
    ["with_phase", spec.with],
    ["before_phase", spec.before],
    ["after_phase", spec.after],
  ] as const) {
    if (value && !base.includes(value)) return fail(`cannot find ${arg} '${value}' within node '${node}'`);
  }
  if (spec.with && spec.after) return fail("only one of with_phase/after_phase/start_with_phase may be specified as they all specify predecessor");
  if (spec.with && spec.before) return fail("only one of with_phase/before_phase/end_with_phase may be specified as they all specify successor");
  if (spec.after && spec.before && base.indexOf(spec.after) >= base.indexOf(spec.before)) {
    return fail(`Phase '${spec.before}' is not before phase '${spec.after}'`);
  }

  let steps: ScheduleStep[];
  if (spec.with) {
    steps = base.map((name) => (name === spec.with ? { kind: "parallel", lanes: [[name], [spec.name]], custom: spec.name } : { kind: "phase", name }));
  } else if (spec.after || spec.before) {
    const ai = spec.after ? base.indexOf(spec.after) : -1;
    const bi = spec.before ? base.indexOf(spec.before) : base.length;
    if (spec.after && spec.before && bi - ai > 1) {
      // Branch from after_phase to before_phase, in parallel with the phases between them.
      steps = [
        ...base.slice(0, ai + 1).map((name) => ({ kind: "phase" as const, name })),
        { kind: "parallel", lanes: [base.slice(ai + 1, bi), [spec.name]], custom: spec.name },
        ...base.slice(bi).map((name) => ({ kind: "phase" as const, name })),
      ];
    } else {
      const at = spec.after ? ai + 1 : bi;
      steps = [
        ...base.slice(0, at).map((name) => ({ kind: "phase" as const, name })),
        { kind: "phase", name: spec.name, custom: true },
        ...base.slice(at).map((name) => ({ kind: "phase" as const, name })),
      ];
    }
  } else {
    // No anchor: added before the container's end node, i.e. last.
    steps = [...base.map((name) => ({ kind: "phase" as const, name })), { kind: "phase", name: spec.name, custom: true }];
  }

  const container = steps.flatMap((s) => (s.kind === "phase" ? [s.name] : s.lanes.flat()));
  const notes: string[] = [];
  if (spec.target === "uvm_sched") {
    notes.push("The uvm schedule runs alongside run_phase. Every component in the uvm domain enters the new phase together and leaves it together.");
  }
  const idx = container.indexOf(spec.name);
  const runIdx = container.indexOf("run");
  if (spec.target === "common" && runIdx >= 0 && idx > runIdx) {
    notes.push(
      "It runs after run_phase and the uvm schedule have ended. Drivers and monitors forked in run_phase were killed then, and the PH_TIMEOUT watchdog only guards run_phase, so a hang here is never timed out.",
    );
  }
  if (spec.target === "common" && runIdx >= 0 && idx < runIdx) {
    notes.push("run_phase and the whole uvm schedule wait until this phase ends.");
  }
  if (!spec.implementsExecTask) {
    notes.push(
      "The class does not override exec_task. uvm_phase's default exec_task is empty, so no component method is called, nobody raises an objection, and the phase ends at once.",
    );
  }
  return { ok: true, fatal: null, steps, container, componentMethodCalled: spec.implementsExecTask, notes };
}

/** SystemVerilog for a custom task phase and its registration, generated from the same spec. */
export function customPhaseSource(spec: CustomPhaseInsert, envClass = "soc_env"): string {
  const cls = `${spec.name}_phase_c`;
  const getter = spec.target === "common" ? "uvm_domain::get_common_domain()" : "uvm_domain::get_uvm_schedule()";
  const args = [
    spec.with ? `.with_phase(uvm_${spec.with}_phase::get())` : null,
    spec.after ? `.after_phase(uvm_${spec.after}_phase::get())` : null,
    spec.before ? `.before_phase(uvm_${spec.before}_phase::get())` : null,
  ].filter(Boolean) as string[];
  const execTask = spec.implementsExecTask
    ? [
        `  // Called once per component in the domain (forked)`,
        `  virtual task exec_task(uvm_component comp, uvm_phase phase);`,
        `    ${envClass} env;`,
        `    if ($cast(env, comp)) env.${spec.name}_phase(phase);`,
        `  endtask`,
      ]
    : [`  // no exec_task override: the inherited one is empty`];
  return [
    `class ${cls} extends uvm_task_phase;`,
    `  local static ${cls} m_inst;`,
    `  function new(string name = "${spec.name}");`,
    `    super.new(name);`,
    `  endfunction`,
    `  static function ${cls} get();`,
    `    if (m_inst == null) m_inst = new();`,
    `    return m_inst;`,
    `  endfunction`,
    ...execTask,
    `endclass`,
    ``,
    `// base_test::build_phase (before run-time phases start)`,
    `${getter}.add(${cls}::get(),`,
    `  ${args.join(",\n  ") || "/* no anchor: added last */"});`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Phase sorter grading (two lanes + direction)
// ---------------------------------------------------------------------------

export const COMMON_ORDER = COMMON_PHASES.map((p) => p.name);
export const SCHEDULE_ORDER: string[] = [...RUNTIME_PHASE_NAMES];
/** The eight function phases whose traversal direction the learner classifies. */
export const DIRECTION_PHASES = COMMON_PHASES.filter((p) => !isTaskPhase(p)).map((p) => p.name);

export interface SorterAnswer {
  common: string[];
  schedule: string[];
  directions: Partial<Record<string, "top-down" | "bottom-up">>;
}

export interface SorterGrade {
  points: number;
  total: number;
  percent: number;
  passed: boolean;
  /** Names that sit in a longest correctly ordered subsequence of each lane. */
  commonInPlace: string[];
  scheduleInPlace: string[];
  directionCorrect: Record<string, boolean>;
  diagnoses: string[];
}

/** Longest subsequence of `items` already in the order of `reference`. */
function inOrder(items: string[], reference: string[]): string[] {
  const idx = items.map((n) => reference.indexOf(n));
  const best: number[] = idx.map(() => 1);
  const prev: number[] = idx.map(() => -1);
  for (let i = 0; i < idx.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (idx[j] < idx[i] && best[j] + 1 > best[i]) {
        best[i] = best[j] + 1;
        prev[i] = j;
      }
    }
  }
  let at = best.indexOf(Math.max(0, ...best));
  const out: string[] = [];
  while (at >= 0) {
    out.unshift(items[at]);
    at = prev[at];
  }
  return out;
}

export function gradePhaseSorter(answer: SorterAnswer): SorterGrade {
  const commonInPlace = inOrder(answer.common, COMMON_ORDER);
  const scheduleInPlace = inOrder(answer.schedule, SCHEDULE_ORDER);
  const directionCorrect: Record<string, boolean> = {};
  for (const name of DIRECTION_PHASES) {
    const phase = findPhase(name) as PhaseDef;
    directionCorrect[name] = answer.directions[name] === phaseOrder(phase);
  }
  const dirPoints = Object.values(directionCorrect).filter(Boolean).length;
  const total = COMMON_ORDER.length + SCHEDULE_ORDER.length + DIRECTION_PHASES.length;
  const points = commonInPlace.length + scheduleInPlace.length + dirPoints;

  const diagnoses: string[] = [];
  if (commonInPlace.length < COMMON_ORDER.length) {
    diagnoses.push("Common domain: build → connect → end_of_elaboration → start_of_simulation → run → extract → check → report → final.");
  }
  if (scheduleInPlace.length < SCHEDULE_ORDER.length) {
    diagnoses.push("uvm schedule: four groups (reset, configure, main, shutdown), each as pre_X → X → post_X.");
  }
  const dir = answer.directions;
  if (dir.build === "bottom-up") diagnoses.push("build_phase is top-down: a parent's build_phase creates its children, so it must run first.");
  if (["connect", "end_of_elaboration", "start_of_simulation"].some((n) => dir[n] === "top-down")) {
    diagnoses.push("connect, end_of_elaboration and start_of_simulation are bottom-up: every child finishes before its parent.");
  }
  if (["extract", "check", "report"].some((n) => dir[n] === "top-down")) {
    diagnoses.push("extract, check and report are bottom-up, so a parent sees its children's results.");
  }
  if (dir.final === "bottom-up") diagnoses.push("final_phase is top-down, like build_phase (uvm_final_phase extends uvm_topdown_phase).");
  if (DIRECTION_PHASES.some((n) => !dir[n])) diagnoses.push("Choose a direction for every function phase.");

  return {
    points,
    total,
    percent: Math.round((points / total) * 100),
    passed: points === total,
    commonInPlace,
    scheduleInPlace,
    directionCorrect,
    diagnoses,
  };
}

/** Deterministic shuffle (LCG); never returns the input order for two or more items. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = (seed * 1103515245 + 12345) >>> 0 || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift() as T);
  return out;
}
