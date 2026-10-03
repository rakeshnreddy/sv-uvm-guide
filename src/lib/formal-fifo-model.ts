/**
 * Formal vs simulation on one small design: the occupancy counter of a FIFO,
 * its shared SVA property library, and two engines that consume it.
 *
 * Semantics implemented (IEEE 1800-2023):
 * - §16.2 / §16.14.2: an `assume` is a hypothesis for formal analysis (the
 *   engine only explores input sequences that satisfy it and does not verify
 *   it), while "like an asserted property, an assumed property shall be
 *   checked and reported if it fails to hold" in simulation.
 * - §16.14.1: an `assert` is an obligation on the design.
 * - §16.14.3: `cover` reports whether the property was ever satisfied.
 * - §16.12.7: an implication whose antecedent does not match succeeds
 *   (vacuously).
 * - §16.5.1: concurrent properties use the values sampled at the clock edge.
 *
 * The formal engine is an exhaustive breadth-first search over every input
 * sequence the enabled assumptions allow. The state space is tiny (3-bit
 * count plus one flag), so the search is a full proof, and the first
 * violating state found is a shortest counterexample (CEX).
 */

export const FIFO_DEPTH = 4;
/** `$clog2(DEPTH) + 1` bits, so the counter can hold DEPTH itself. */
export const COUNT_WIDTH = 3;
const COUNT_MOD = 1 << COUNT_WIDTH;

export type DutVariant = "correct" | "late_full";
export type AssumptionId = "a_no_push_when_full" | "a_no_pop_when_empty" | "a_never_fill";
export type AssertionId = "p_count_in_range" | "p_full_is_correct";
export type CoverId = "c_reach_depth";
export type PropertyId = AssumptionId | AssertionId | CoverId;

export type Bit = 0 | 1;

export interface FifoInputs {
  push: Bit;
  pop: Bit;
}

/** Values sampled at one clock edge (§16.5.1). */
export interface SampledValues {
  count: number;
  full: Bit;
  empty: Bit;
}

/** One clock edge of a trace: the sampled DUT outputs plus the inputs applied at that edge. */
export interface TraceCycle extends SampledValues, FifoInputs {
  cycle: number;
}

export interface PropertyDef {
  id: PropertyId;
  kind: "assume" | "assert" | "cover";
  /** SVA expression, exactly as shown in the generated property module. */
  expr: string;
  summary: string;
}

/** The interface contract: what the real environment promises. */
export const CONTRACT_ASSUMPTIONS: readonly AssumptionId[] = ["a_no_push_when_full", "a_no_pop_when_empty"];
export const ASSUMPTION_IDS: readonly AssumptionId[] = ["a_no_push_when_full", "a_no_pop_when_empty", "a_never_fill"];
export const ASSERTION_IDS: readonly AssertionId[] = ["p_count_in_range", "p_full_is_correct"];
export const COVER_IDS: readonly CoverId[] = ["c_reach_depth"];

export const PROPERTIES: Record<PropertyId, PropertyDef> = {
  a_no_push_when_full: {
    id: "a_no_push_when_full",
    kind: "assume",
    expr: "!(push && full)",
    summary: "Interface contract: never push while full is 1.",
  },
  a_no_pop_when_empty: {
    id: "a_no_pop_when_empty",
    kind: "assume",
    expr: "!(pop && empty)",
    summary: "Interface contract: never pop while empty is 1.",
  },
  a_never_fill: {
    id: "a_never_fill",
    kind: "assume",
    expr: `!(push && count == ${FIFO_DEPTH - 1})`,
    summary: "Over-tight: never push into the last free slot. The real environment makes no such promise.",
  },
  p_count_in_range: {
    id: "p_count_in_range",
    kind: "assert",
    expr: "count <= DEPTH",
    summary: "The occupancy never exceeds DEPTH (no overflow, no wrap-around).",
  },
  p_full_is_correct: {
    id: "p_full_is_correct",
    kind: "assert",
    expr: "(count == DEPTH) |-> full",
    summary: "Whenever the FIFO holds DEPTH entries, full is already 1.",
  },
  c_reach_depth: {
    id: "c_reach_depth",
    kind: "cover",
    expr: "count == DEPTH",
    summary: "The FIFO can actually fill up (also the antecedent of p_full_is_correct).",
  },
};

export const DUT_LABELS: Record<DutVariant, string> = {
  correct: "Correct RTL",
  late_full: "Bug: full flag is registered (one cycle late)",
};

const ALL_INPUTS: readonly FifoInputs[] = [
  { push: 0, pop: 0 },
  { push: 1, pop: 0 },
  { push: 0, pop: 1 },
  { push: 1, pop: 1 },
];

interface DutState {
  count: number;
  /** Registered full flag (only observable in the `late_full` variant). */
  fullQ: Bit;
}

const RESET_STATE: DutState = { count: 0, fullQ: 0 };

/** DUT outputs for a state. `correct` decodes full from count; `late_full` uses last cycle's decode. */
export function sampleOutputs(dut: DutVariant, state: { count: number; fullQ: Bit }): SampledValues {
  const fullNow: Bit = state.count === FIFO_DEPTH ? 1 : 0;
  return {
    count: state.count,
    full: dut === "correct" ? fullNow : state.fullQ,
    empty: state.count === 0 ? 1 : 0,
  };
}

/** `count <= count + push - pop` in 3 bits (wraps modulo 8), plus `full_q <= (count == DEPTH)`. */
function nextState(dut: DutVariant, state: DutState, inputs: FifoInputs): DutState {
  return {
    count: (state.count + inputs.push - inputs.pop + COUNT_MOD) % COUNT_MOD,
    fullQ: dut === "late_full" && state.count === FIFO_DEPTH ? 1 : 0,
  };
}

const ASSUMPTION_HOLDS: Record<AssumptionId, (s: SampledValues, i: FifoInputs) => boolean> = {
  a_no_push_when_full: (s, i) => !(i.push === 1 && s.full === 1),
  a_no_pop_when_empty: (s, i) => !(i.pop === 1 && s.empty === 1),
  a_never_fill: (s, i) => !(i.push === 1 && s.count === FIFO_DEPTH - 1),
};

export type AssertionResult = "pass" | "fail" | "vacuous";

/** Per-edge evaluation of each assertion on sampled values. */
export function evaluateAssertion(id: AssertionId, s: SampledValues): AssertionResult {
  if (id === "p_count_in_range") return s.count <= FIFO_DEPTH ? "pass" : "fail";
  // §16.12.7: no antecedent match → the implication succeeds vacuously.
  if (s.count !== FIFO_DEPTH) return "vacuous";
  return s.full === 1 ? "pass" : "fail";
}

export function evaluateCover(id: CoverId, s: SampledValues): boolean {
  return id === "c_reach_depth" && s.count === FIFO_DEPTH;
}

export function assumptionHolds(id: AssumptionId, s: SampledValues, i: FifoInputs): boolean {
  return ASSUMPTION_HOLDS[id](s, i);
}

// ── Formal engine ────────────────────────────────────────────────────────────

export interface FormalConfig {
  dut: DutVariant;
  assumptions: readonly AssumptionId[];
}

export interface AssertionVerdict {
  id: AssertionId;
  status: "proven" | "cex";
  /** Shortest counterexample from reset (only for `cex`). */
  trace?: TraceCycle[];
  failCycle?: number;
  /** Proven, but the antecedent can never match under the assumptions. */
  vacuous: boolean;
  /** Enabled assumptions whose removal turns this proof into a CEX. */
  protectedBy: AssumptionId[];
  why: string;
}

export interface CoverVerdict {
  id: CoverId;
  status: "covered" | "unreachable";
  trace?: TraceCycle[];
  hitCycle?: number;
  why: string;
}

export interface FormalReport {
  config: FormalConfig;
  assertions: Record<AssertionId, AssertionVerdict>;
  covers: Record<CoverId, CoverVerdict>;
  reachableStates: number;
}

const stateKey = (s: DutState) => `${s.count}/${s.fullQ}`;

interface Exploration {
  order: DutState[];
  parent: Map<string, { prev: string | null; inputs?: FifoInputs; state: DutState }>;
}

function explore(config: FormalConfig): Exploration {
  const parent: Exploration["parent"] = new Map();
  const order: DutState[] = [];
  const queue: DutState[] = [RESET_STATE];
  parent.set(stateKey(RESET_STATE), { prev: null, state: RESET_STATE });
  while (queue.length > 0) {
    const state = queue.shift() as DutState;
    order.push(state);
    const sampled = sampleOutputs(config.dut, state);
    for (const inputs of ALL_INPUTS) {
      if (!config.assumptions.every((a) => ASSUMPTION_HOLDS[a](sampled, inputs))) continue;
      const next = nextState(config.dut, state, inputs);
      const key = stateKey(next);
      if (!parent.has(key)) {
        parent.set(key, { prev: stateKey(state), inputs, state: next });
        queue.push(next);
      }
    }
  }
  return { order, parent };
}

/** Rebuilds the input sequence from reset to `target`; the final edge idles (always legal here). */
function traceTo(dut: DutVariant, exploration: Exploration, target: DutState): TraceCycle[] {
  const path: { state: DutState; inputs: FifoInputs }[] = [];
  let key: string | null = stateKey(target);
  let inputsIntoNext: FifoInputs = { push: 0, pop: 0 };
  while (key !== null) {
    const entry = exploration.parent.get(key);
    if (!entry) break;
    path.unshift({ state: entry.state, inputs: inputsIntoNext });
    inputsIntoNext = entry.inputs ?? { push: 0, pop: 0 };
    key = entry.prev;
  }
  return path.map(({ state, inputs }, cycle) => ({ cycle, ...sampleOutputs(dut, state), ...inputs }));
}

function describeCountCex(trace: TraceCycle[], config: FormalConfig): string {
  const fail = trace[trace.length - 1];
  const cause = trace[trace.length - 2];
  if (cause && cause.pop === 1 && cause.count === 0) {
    const off = config.assumptions.includes("a_no_pop_when_empty") ? "" : " (a_no_pop_when_empty is off)";
    return `At edge ${cause.cycle} formal pops while empty = 1${off}. The 3-bit count wraps 0 → ${fail.count}, which is > DEPTH at edge ${fail.cycle}.`;
  }
  if (cause && cause.push === 1 && cause.count === FIFO_DEPTH && cause.full === 1) {
    return `At edge ${cause.cycle} formal pushes while full = 1 (a_no_push_when_full is off). count goes ${FIFO_DEPTH} → ${fail.count} at edge ${fail.cycle}: overflow.`;
  }
  if (cause && cause.push === 1 && cause.count === FIFO_DEPTH && cause.full === 0) {
    return `At edge ${cause.cycle} count = ${FIFO_DEPTH} but the late full flag still reads 0, so a push is legal even under a_no_push_when_full. count overflows to ${fail.count} at edge ${fail.cycle}.`;
  }
  return `count reaches ${fail.count} at edge ${fail.cycle}.`;
}

function analyse(config: FormalConfig, withProtectors: boolean): FormalReport {
  const exploration = explore(config);
  const sampledOrder = exploration.order.map((st) => ({ st, s: sampleOutputs(config.dut, st) }));

  const assertions = {} as Record<AssertionId, AssertionVerdict>;
  for (const id of ASSERTION_IDS) {
    const failing = sampledOrder.find(({ s }) => evaluateAssertion(id, s) === "fail");
    const antecedentReached = sampledOrder.some(({ s }) => evaluateAssertion(id, s) !== "vacuous");
    const protectedBy =
      withProtectors && !failing
        ? config.assumptions.filter(
            (a) => analyse({ ...config, assumptions: config.assumptions.filter((x) => x !== a) }, false).assertions[id].status === "cex",
          )
        : [];
    if (failing) {
      const trace = traceTo(config.dut, exploration, failing.st);
      const failCycle = trace[trace.length - 1].cycle;
      const why =
        id === "p_count_in_range"
          ? describeCountCex(trace, config)
          : `At edge ${failCycle} count = ${FIFO_DEPTH}, but full is a register that copies (count == DEPTH) one edge later, so full = 0 here.`;
      assertions[id] = { id, status: "cex", trace, failCycle, vacuous: false, protectedBy, why };
    } else if (!antecedentReached) {
      assertions[id] = {
        id,
        status: "proven",
        vacuous: true,
        protectedBy,
        why: `Proven only vacuously: no input sequence the assumptions allow ever reaches count == DEPTH, so the antecedent never matches (§16.12.7). The unreachable cover is the warning sign.`,
      };
    } else {
      const depends =
        protectedBy.length > 0
          ? `It depends on ${protectedBy.join(" and ")}: drop ${protectedBy.length > 1 ? "either" : "it"} and formal finds a counterexample.`
          : "No assumption is needed: the RTL alone guarantees it.";
      const base =
        id === "p_count_in_range"
          ? "Every input sequence the assumptions allow keeps count within 0..DEPTH."
          : "full is decoded from count in the same cycle, so it is 1 whenever count == DEPTH.";
      assertions[id] = { id, status: "proven", vacuous: false, protectedBy, why: `${base} ${depends}` };
    }
  }

  const covers = {} as Record<CoverId, CoverVerdict>;
  for (const id of COVER_IDS) {
    const hit = sampledOrder.find(({ s }) => evaluateCover(id, s));
    if (hit) {
      const trace = traceTo(config.dut, exploration, hit.st);
      const hitCycle = trace[trace.length - 1].cycle;
      covers[id] = { id, status: "covered", trace, hitCycle, why: `Reached at edge ${hitCycle} after ${hitCycle} pushes from reset.` };
    } else {
      covers[id] = {
        id,
        status: "unreachable",
        why: "No input sequence allowed by the assumptions reaches count == DEPTH. An over-constraining assumption is hiding real behaviour.",
      };
    }
  }

  return { config, assertions, covers, reachableStates: exploration.order.length };
}

/** Exhaustive proof run. Assumptions constrain inputs and are never checked (§16.14.2). */
export function runFormal(config: FormalConfig): FormalReport {
  return analyse(config, true);
}

// ── Simulation engine ────────────────────────────────────────────────────────

export interface SimCycle extends TraceCycle {
  assertions: Record<AssertionId, AssertionResult>;
  /** Assumptions that failed at this edge (simulation checks them, §16.14.2). */
  assumptionFails: AssumptionId[];
  covers: CoverId[];
}

export interface SimRun {
  cycles: SimCycle[];
  /** First failing edge per assertion. */
  firstAssertionFail: Partial<Record<AssertionId, number>>;
  /** First failing edge per checked assumption. */
  firstAssumptionFail: Partial<Record<AssumptionId, number>>;
  /** First edge each cover was hit. */
  coverHit: Partial<Record<CoverId, number>>;
}

function runSimulation(
  dut: DutVariant,
  cycles: number,
  chooseInputs: (s: SampledValues, cycle: number) => FifoInputs,
  checkedAssumptions: readonly AssumptionId[],
): SimRun {
  let state = RESET_STATE;
  const run: SimRun = { cycles: [], firstAssertionFail: {}, firstAssumptionFail: {}, coverHit: {} };
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const s = sampleOutputs(dut, state);
    const inputs = chooseInputs(s, cycle);
    const assertions = {} as Record<AssertionId, AssertionResult>;
    for (const id of ASSERTION_IDS) {
      assertions[id] = evaluateAssertion(id, s);
      if (assertions[id] === "fail" && run.firstAssertionFail[id] === undefined) run.firstAssertionFail[id] = cycle;
    }
    const assumptionFails = checkedAssumptions.filter((a) => !ASSUMPTION_HOLDS[a](s, inputs));
    for (const a of assumptionFails) if (run.firstAssumptionFail[a] === undefined) run.firstAssumptionFail[a] = cycle;
    const covers = COVER_IDS.filter((c) => evaluateCover(c, s));
    for (const c of covers) if (run.coverHit[c] === undefined) run.coverHit[c] = cycle;
    run.cycles.push({ cycle, ...s, ...inputs, assertions, assumptionFails, covers });
    state = nextState(dut, state, inputs);
  }
  return run;
}

/** Small deterministic LCG so a seed always reproduces the same run. */
export function lcg(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x;
  };
}

/** The driver's `c_legal` constraint, solved against the flags it observes this cycle. */
export function legalForTestbench(s: SampledValues, i: FifoInputs): boolean {
  return !(i.push === 1 && s.full === 1) && !(i.pop === 1 && s.empty === 1);
}

export const SIM_CYCLES = 16;

/**
 * One constrained-random UVM run: each cycle the driver picks uniformly among
 * the push/pop combinations its `c_legal` constraint allows. The bound
 * property library checks every assertion and every enabled assumption.
 */
export function simulateRandom(dut: DutVariant, seed: number, checkedAssumptions: readonly AssumptionId[], cycles = SIM_CYCLES): SimRun {
  const next = lcg(seed);
  return runSimulation(
    dut,
    cycles,
    (s) => {
      const legal = ALL_INPUTS.filter((i) => legalForTestbench(s, i));
      return legal[(next() >>> 16) % legal.length];
    },
    checkedAssumptions,
  );
}

/**
 * Replays a formal trace cycle-for-cycle in the UVM environment. The
 * environment binds the interface contract checks as well as whatever
 * assumptions the library enables, so an illegal stimulus is reported.
 */
export function replayTrace(dut: DutVariant, trace: TraceCycle[], enabledAssumptions: readonly AssumptionId[]): SimRun {
  const checked = Array.from(new Set([...CONTRACT_ASSUMPTIONS, ...enabledAssumptions]));
  return runSimulation(dut, trace.length, (_, k) => ({ push: trace[k].push, pop: trace[k].pop }), checked);
}

export interface ReplayVerdict {
  kind: "spurious" | "dut_bug" | "no_failure";
  cycle?: number;
  property?: PropertyId;
  why: string;
}

/** Triage: an assumption failing first means the CEX used illegal stimulus. */
export function classifyReplay(run: SimRun): ReplayVerdict {
  const firstOf = <K extends string>(rec: Partial<Record<K, number>>) =>
    (Object.entries(rec) as [K, number][]).sort((a, b) => a[1] - b[1])[0];
  const assume = firstOf(run.firstAssumptionFail);
  const assertFail = firstOf(run.firstAssertionFail);
  if (assume && (!assertFail || assume[1] <= assertFail[1])) {
    return {
      kind: "spurious",
      cycle: assume[1],
      property: assume[0],
      why: `In simulation ${assume[0]} is checked, and it fails at edge ${assume[1]}: the replayed stimulus breaks the interface contract. The CEX is spurious; fix the formal environment, not the RTL.`,
    };
  }
  if (assertFail) {
    return {
      kind: "dut_bug",
      cycle: assertFail[1],
      property: assertFail[0],
      why: `Every assumption holds on the replayed stimulus, and ${assertFail[0]} fails at edge ${assertFail[1]}. This is a real RTL bug, now reproducible in simulation.`,
    };
  }
  return { kind: "no_failure", why: "Nothing fails on replay. Check that the driver reproduced the trace cycle-for-cycle." };
}

// ── Code views generated from the same data ─────────────────────────────────

export interface CodeLine {
  key?: string;
  text: string;
}

export function propertyModuleLines(enabled: readonly AssumptionId[]): CodeLine[] {
  const pad = (id: string) => `${id}:`.padEnd(22, " ");
  const body: CodeLine[] = [];
  for (const id of ASSUMPTION_IDS) {
    const line = `${pad(id)}assume property (${PROPERTIES[id].expr});`;
    body.push({ key: id, text: enabled.includes(id) ? `  ${line}` : `  // ${line}  (disabled)` });
  }
  for (const id of ASSERTION_IDS) body.push({ key: id, text: `  ${pad(id)}assert property (${PROPERTIES[id].expr});` });
  for (const id of COVER_IDS) body.push({ key: id, text: `  ${pad(id)}cover  property (${PROPERTIES[id].expr});` });
  return [
    { text: `module fifo_props #(parameter int DEPTH = ${FIFO_DEPTH}) (` },
    { text: "  input logic clk, rst_n, push, pop, full, empty," },
    { text: `  input logic [${COUNT_WIDTH - 1}:0] count);` },
    { text: "  default clocking @(posedge clk); endclocking" },
    { text: "  default disable iff (!rst_n);" },
    ...body,
    { text: "endmodule" },
    { text: "" },
    { text: "// One bind: simulation and formal load the same checkers." },
    { text: `bind fifo fifo_props #(.DEPTH(${FIFO_DEPTH})) u_fifo_props (.*);` },
  ];
}

export function dutLines(dut: DutVariant): CodeLine[] {
  const fullLines: CodeLine[] =
    dut === "correct"
      ? [{ key: "full", text: "assign full  = (count == DEPTH);" }]
      : [
          { key: "full", text: "always_ff @(posedge clk or negedge rst_n)   // BUG: one edge late" },
          { key: "full", text: "  if (!rst_n) full <= 1'b0; else full <= (count == DEPTH);" },
        ];
  return [
    { text: "always_ff @(posedge clk or negedge rst_n)" },
    { key: "count", text: "  if (!rst_n) count <= '0;" },
    { key: "count", text: "  else        count <= count + push - pop;  // 3 bits: wraps" },
    ...fullLines,
    { key: "empty", text: "assign empty = (count == 0);" },
  ];
}

/** Directed replay sequence generated from the trace's inputs (one item per clock). */
export function replaySequenceLines(trace: TraceCycle[]): string[] {
  const driven = trace.slice(0, Math.max(1, trace.length - 1));
  const n = driven.length;
  const bits = (sel: (c: TraceCycle) => Bit) => driven.map(sel).join(", ");
  return [
    "class cex_replay_seq extends uvm_sequence #(fifo_item);",
    "  `uvm_object_utils(cex_replay_seq)",
    `  // Inputs copied from the formal trace, edges 0..${n - 1}`,
    `  bit push_v[${n}] = '{${bits((c) => c.push)}};`,
    `  bit pop_v[${n}]  = '{${bits((c) => c.pop)}};`,
    '  function new(string name = "cex_replay_seq");',
    "    super.new(name);",
    "  endfunction",
    "  task body();",
    "    foreach (push_v[i]) begin",
    '      req = fifo_item::type_id::create($sformatf("cex_%0d", i));',
    "      start_item(req);",
    "      req.push = push_v[i];  // assigned, not randomized:",
    "      req.pop  = pop_v[i];   // c_legal is NOT applied",
    "      finish_item(req);      // driver must apply one item per clock",
    "    end",
    "  endtask",
    "endclass",
  ];
}
