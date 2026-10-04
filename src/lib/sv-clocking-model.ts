/**
 * Deterministic educational model of clocking-block timing across several
 * clock cycles (IEEE 1800-2023 Clause 14).
 *
 * F3C's `sv-scheduler-model.ts` explains what happens *inside* one time slot.
 * This model works one level up: it places clocking-block samples and drives
 * on a continuous time axis, refined by the scheduler region they land in, so
 * learners can see nonzero skews and multi-cycle effects. Region names are
 * reused from the scheduler model so both visuals speak the same language.
 *
 * Rules implemented (each is pinned by a test in tests/lib/sv-clocking-model.test.ts):
 * - Defaults: input skew #1step, output skew #0 (§14.3).
 * - Input skew #1step samples the value at the end of the previous time step,
 *   i.e. in the Preponed region of the edge's time slot (§14.4, §4.4.2.1).
 * - Input skew #N (N > 0) samples the value in the Postponed region of the time
 *   step N time units before the clocking event (§14.13).
 * - An explicit #0 input skew samples in the Observed region of the edge (§14.4, §14.13).
 * - The clocking block updates its samples before it triggers the clocking-block
 *   event, and that event `@(cb)` fires in Observed (§14.10, §14.13). Reading a
 *   clockvar after `@(posedge clk)` instead races between the old and new sample
 *   (§14.13 NOTE example).
 * - Synchronous drives mature in the Re-NBA region at the clocking event plus the
 *   output skew, whoever issues them (§14.16). A drive executed at a time that is
 *   not a clocking event behaves as if executed at the next clocking event
 *   (§14.16, `#3 cb.v <= expr1` example). `cb.v <= ##N e` postpones the update by
 *   N cycles of cb's own clocking event and does not block (§14.16).
 * - A procedural `##N` waits for N clocking-block events of the *default
 *   clocking*; without one the compiler shall issue an error (§14.11, §14.12).
 *   `##0` continues at once if the clocking event already occurred in this time
 *   step, otherwise it waits for it (§14.11).
 *
 * Assumptions (shown to learners):
 * - One clock with a fixed period; rising edges are the clocking events.
 * - Time is in whole units of the clocking block's time unit; #1step is drawn a
 *   hair before the edge, but it is one global-precision step (§3.14.3).
 * - A clockvar reads X before its first clocking event (clause unverified; tools
 *   initialise the sampled value to the signal type's default).
 */

import { REGION_LABELS, REGION_ORDER, type RegionId } from "./sv-scheduler-model";

export type ClockValue = number | string;

export const UNKNOWN: ClockValue = "X";

export type InputSkew = { kind: "1step" } | { kind: "zero" } | { kind: "delay"; units: number };
export type OutputSkew = { kind: "zero" } | { kind: "delay"; units: number };

/** §14.3: "Unless otherwise specified, the default input skew is 1step and the default output skew is 0." */
export const DEFAULT_INPUT_SKEW: InputSkew = { kind: "1step" };
export const DEFAULT_OUTPUT_SKEW: OutputSkew = { kind: "zero" };

export interface ClockSpec {
  /** Clock period in time units. */
  period: number;
  /** Time of the first rising edge (edge 1). */
  firstEdge: number;
  /** Number of rising edges modelled. */
  edges: number;
  /** Time unit used in generated code, e.g. "ns". */
  unit: string;
}

/** `always #5 clk = ~clk;` starting from 0: rising edges at 5, 15, 25, 35 ns. */
export const DEFAULT_CLOCK: ClockSpec = { period: 10, firstEdge: 5, edges: 4, unit: "ns" };

export interface SlotPoint {
  time: number;
  region: RegionId;
}

export const regionIndex = (region: RegionId) => REGION_ORDER.indexOf(region);

/** Orders two points: first by simulation time, then by region inside the time slot. */
export function comparePoints(a: SlotPoint, b: SlotPoint): number {
  return a.time - b.time || regionIndex(a.region) - regionIndex(b.region);
}

export function describePoint(point: SlotPoint, unit = "ns"): string {
  return `t = ${point.time} ${unit}, ${REGION_LABELS[point.region]}`;
}

/** Time of rising edge `edge` (1-based). */
export function edgeTime(clock: ClockSpec, edge: number): number {
  return clock.firstEdge + (edge - 1) * clock.period;
}

/** The edge index whose time is exactly `time`, or null. */
export function edgeAt(clock: ClockSpec, time: number): number | null {
  const k = (time - clock.firstEdge) / clock.period;
  return Number.isInteger(k) && k >= 0 ? k + 1 : null;
}

/** First edge strictly after `time`. */
export function nextEdgeAfter(clock: ClockSpec, time: number): number {
  if (time < clock.firstEdge) return 1;
  return Math.floor((time - clock.firstEdge) / clock.period) + 2;
}

export function formatInputSkew(skew: InputSkew, unit = "ns"): string {
  if (skew.kind === "1step") return "#1step";
  if (skew.kind === "zero") return "#0";
  return `#${skew.units}${unit}`;
}

export function formatOutputSkew(skew: OutputSkew, unit = "ns"): string {
  return skew.kind === "zero" ? "#0" : `#${skew.units}${unit}`;
}

export const outputSkewUnits = (skew: OutputSkew) => (skew.kind === "zero" ? 0 : skew.units);

export function formatClockValue(value: ClockValue | undefined): string {
  return value === undefined ? "X" : String(value);
}

// ---------------------------------------------------------------------------
// Signals and reads
// ---------------------------------------------------------------------------

export interface SignalChange {
  at: SlotPoint;
  value: ClockValue;
  cause: string;
}

export interface SignalTrace {
  name: string;
  initial: ClockValue;
  /** Sorted by `at`. */
  changes: SignalChange[];
}

export interface ReadResult {
  /** The value when the read is deterministic; the old value when it races. */
  value: ClockValue;
  /** Every value a legal process order could return. */
  candidates: ClockValue[];
  race: boolean;
  /** The change that produced `value`, if any. */
  source?: SignalChange;
}

/** Regions where processes run and can race with an update in the same region (§4.7). */
const ITERATIVE: RegionId[] = ["active", "inactive", "reactive", "reInactive"];

/**
 * The value a read at `at` sees. Changes strictly earlier (time, then region)
 * are visible. A change in the same time slot *and* the same process region
 * races with the read, because the standard lets ready processes run in any
 * order (§4.7). Read-only regions (Preponed, Observed, Postponed) never race.
 */
export function readSignal(trace: SignalTrace, at: SlotPoint): ReadResult {
  let value = trace.initial;
  let source: SignalChange | undefined;
  const racing: SignalChange[] = [];
  for (const change of trace.changes) {
    const order = comparePoints(change.at, at);
    if (order < 0) {
      value = change.value;
      source = change;
    } else if (order === 0 && ITERATIVE.includes(at.region)) {
      racing.push(change);
    }
  }
  if (racing.length === 0) return { value, candidates: [value], race: false, source };
  const candidates = [value, ...racing.map((c) => c.value)].filter((v, i, all) => all.indexOf(v) === i);
  return { value, candidates, race: candidates.length > 1, source };
}

// ---------------------------------------------------------------------------
// Input sampling (§14.4, §14.13)
// ---------------------------------------------------------------------------

export interface SamplePoint {
  edge: number;
  at: SlotPoint;
  /** One sentence, learner-facing. */
  rule: string;
  clause: string;
}

export function inputSamplePoint(clock: ClockSpec, edge: number, skew: InputSkew): SamplePoint {
  const t = edgeTime(clock, edge);
  if (skew.kind === "1step") {
    return {
      edge,
      at: { time: t, region: "preponed" },
      rule: `#1step samples the last value before edge ${edge}: the Preponed region of t = ${t} ${clock.unit} (the end of the previous time step).`,
      clause: "§14.4, §4.4.2.1",
    };
  }
  if (skew.kind === "zero") {
    return {
      edge,
      at: { time: t, region: "observed" },
      rule: `An explicit #0 samples at the edge itself, in the Observed region of t = ${t} ${clock.unit}, after the design's NBA updates.`,
      clause: "§14.4, §14.13",
    };
  }
  const st = t - skew.units;
  return {
    edge,
    at: { time: st, region: "postponed" },
    rule: `#${skew.units}${clock.unit} samples ${skew.units} ${clock.unit} before edge ${edge}: the Postponed region of t = ${st} ${clock.unit}, so a change at exactly t = ${st} is included.`,
    clause: "§14.13",
  };
}

export interface InputSample extends SamplePoint {
  value: ClockValue;
  source?: SignalChange;
}

export function sampleInput(trace: SignalTrace, clock: ClockSpec, edge: number, skew: InputSkew): InputSample {
  const point = inputSamplePoint(clock, edge, skew);
  const read = readSignal(trace, point.at);
  return { ...point, value: read.value, source: read.source };
}

export type ReaderSync = "cb" | "posedge";

export interface ClockvarRead {
  value: ClockValue;
  candidates: ClockValue[];
  race: boolean;
  why: string;
  clause: string;
}

/**
 * Value of `cb.sig` read by a process that resumed after `@(cb)` or after
 * `@(posedge clk)` at `edge`.
 */
export function readClockvar(trace: SignalTrace, clock: ClockSpec, edge: number, skew: InputSkew, sync: ReaderSync): ClockvarRead {
  const now = sampleInput(trace, clock, edge, skew).value;
  if (sync === "cb") {
    return {
      value: now,
      candidates: [now],
      race: false,
      why: `@(cb) fires in Observed, after the clocking block stored edge ${edge}'s sample, so the read is guaranteed to see it.`,
      clause: "§14.10, §14.13",
    };
  }
  const previous = edge > 1 ? sampleInput(trace, clock, edge - 1, skew).value : UNKNOWN;
  const candidates = [previous, now].filter((v, i, all) => all.indexOf(v) === i);
  return {
    value: previous,
    candidates,
    race: candidates.length > 1,
    why:
      candidates.length > 1
        ? `@(posedge clk) wakes in Active, racing the clocking block's own update at the same edge: the read may return the previous sample (${formatClockValue(previous)}) or the new one (${formatClockValue(now)}).`
        : "@(posedge clk) races the clocking block's update, but both candidate samples happen to be equal here.",
    clause: "§14.13 NOTE",
  };
}

/** A plain `@(posedge clk) x = sig;` read with no clocking block: Active region of the edge. */
export function readRawAtEdge(trace: SignalTrace, clock: ClockSpec, edge: number): ReadResult {
  return readSignal(trace, { time: edgeTime(clock, edge), region: "active" });
}

// ---------------------------------------------------------------------------
// Synchronous drives (§14.16)
// ---------------------------------------------------------------------------

export interface DriveRequest {
  /** Simulation time at which the drive statement executes. */
  issuedAt: number;
  /** `cb.sig <= ##N value` (0 when absent). */
  intraCycles?: number;
}

export interface DriveResult {
  /** The clocking event the drive is attached to (the current one if coincident, else the next). */
  clockingEdge: number;
  /** Edge after applying the intra-drive `##N`. */
  matureEdge: number;
  /** When the signal changes. Always Re-NBA. */
  at: SlotPoint;
  /** First edge whose Active-region flops see the new value. */
  capturedAtEdge: number;
  why: string[];
}

export function scheduleDrive(clock: ClockSpec, skew: OutputSkew, request: DriveRequest): DriveResult {
  const why: string[] = [];
  const coincident = edgeAt(clock, request.issuedAt);
  const clockingEdge = coincident ?? nextEdgeAfter(clock, request.issuedAt);
  if (coincident === null) {
    why.push(
      `The drive executes at t = ${request.issuedAt} ${clock.unit}, between clocking events, so it acts as if issued at the next one, edge ${clockingEdge} (§14.16).`,
    );
  } else {
    why.push(`The drive executes at edge ${clockingEdge}'s time step, so it belongs to that clocking event (§14.16).`);
  }
  const cycles = request.intraCycles ?? 0;
  const matureEdge = clockingEdge + cycles;
  if (cycles > 0) {
    why.push(`##${cycles} on the right-hand side postpones the update ${cycles} cycle${cycles > 1 ? "s" : ""} of cb's clock, to edge ${matureEdge}; the statement does not block (§14.16).`);
  }
  const units = outputSkewUnits(skew);
  const at: SlotPoint = { time: edgeTime(clock, matureEdge) + units, region: "reNba" };
  why.push(
    units === 0
      ? `Output skew #0: the value lands in Re-NBA of t = ${at.time} ${clock.unit}, after the design's flops already sampled in Active (§14.16).`
      : `Output skew ${formatOutputSkew(skew, clock.unit)}: the value lands in Re-NBA of t = ${at.time} ${clock.unit} (§14.16).`,
  );
  const capturedAtEdge = nextEdgeAfter(clock, at.time);
  why.push(`A DUT flop (\`always_ff @(posedge clk) q <= din;\`) first sees it at edge ${capturedAtEdge}.`);
  return { clockingEdge, matureEdge, at, capturedAtEdge, why };
}

/**
 * Capture edges for a racy `@(posedge clk) din = v;` blocking drive issued at
 * `edge`: the DUT flop may run before or after the testbench (§4.7).
 */
export function rawBlockingDriveCapture(edge: number): number[] {
  return [edge, edge + 1];
}

// ---------------------------------------------------------------------------
// Procedural cycle delay ## (§14.11, §14.12)
// ---------------------------------------------------------------------------

export type CycleDelayResult =
  | { ok: false; error: string; clause: string }
  | { ok: true; resumeEdge: number; suspends: boolean; why: string; clause: string };

export interface CycleDelayRequest {
  cycles: number;
  hasDefaultClocking: boolean;
  /** Time at which `##N` executes. */
  time: number;
  /** True when the clocking-block event of this time step has already fired (e.g. code resumed by `@(cb)`). */
  afterClockingEvent: boolean;
}

export function cycleDelay(clock: ClockSpec, request: CycleDelayRequest): CycleDelayResult {
  if (!request.hasDefaultClocking) {
    return {
      ok: false,
      error: "Compile error: ##N counts cycles of the default clocking, and none is declared in this scope.",
      clause: "§14.11",
    };
  }
  if (!Number.isInteger(request.cycles) || request.cycles < 0) {
    return { ok: false, error: "The cycle count must evaluate to a non-negative integer.", clause: "§14.11" };
  }
  const atEdge = edgeAt(clock, request.time);
  if (request.cycles === 0) {
    if (atEdge !== null && request.afterClockingEvent) {
      return { ok: true, resumeEdge: atEdge, suspends: false, why: "##0 after this step's clocking event continues without suspending.", clause: "§14.11" };
    }
    const target = atEdge ?? nextEdgeAfter(clock, request.time);
    return { ok: true, resumeEdge: target, suspends: true, why: `##0 waits for the clocking event (edge ${target}).`, clause: "§14.11" };
  }
  const firstCounted = atEdge !== null && !request.afterClockingEvent ? atEdge : nextEdgeAfter(clock, request.time);
  const resumeEdge = firstCounted + request.cycles - 1;
  const partial = atEdge === null ? " The first cycle is only the fraction left until the next edge." : "";
  return {
    ok: true,
    resumeEdge,
    suspends: true,
    why: `##${request.cycles} waits for ${request.cycles} clocking event${request.cycles > 1 ? "s" : ""} and resumes at edge ${resumeEdge}.${partial}`,
    clause: "§14.11",
  };
}

// ---------------------------------------------------------------------------
// Multi-cycle scenario used by ClockingBlockSkewVisualizer
// ---------------------------------------------------------------------------

export interface DutTiming {
  /** Delay from the edge to the change of `dout`. */
  delay: number;
  /** How the change is produced at delay 0: `<=` (NBA) or a racy blocking `=` (Active). */
  update: "nba" | "blocking";
}

export type DriveForm = "plain" | "intra" | "prefix";

export interface ClockingScenario {
  clock: ClockSpec;
  inputSkew: InputSkew;
  outputSkew: OutputSkew;
  dut: DutTiming;
  /** The testbench issues its drive right after `@(cb)` at this edge. */
  driveEdge: number;
  driveValue: ClockValue;
  driveForm: DriveForm;
  /** Whether `cb` is declared as `default clocking` in the testbench scope. */
  hasDefaultClocking: boolean;
  /** Edge whose `cb.dout` value the learner predicts. */
  questionEdge: number;
}

export const DEFAULT_SCENARIO: ClockingScenario = {
  clock: DEFAULT_CLOCK,
  inputSkew: DEFAULT_INPUT_SKEW,
  outputSkew: DEFAULT_OUTPUT_SKEW,
  dut: { delay: 0, update: "nba" },
  driveEdge: 2,
  driveValue: "A5",
  driveForm: "plain",
  hasDefaultClocking: true,
  questionEdge: 3,
};

/** `dout` counts edges: it is 0 before edge 1 and becomes k after edge k (plus the path delay). */
export function dutOutputTrace(clock: ClockSpec, dut: DutTiming): SignalTrace {
  const changes: SignalChange[] = [];
  for (let k = 1; k <= clock.edges; k += 1) {
    const t = edgeTime(clock, k) + dut.delay;
    const region: RegionId = dut.delay === 0 && dut.update === "nba" ? "nba" : "active";
    changes.push({
      at: { time: t, region },
      value: k,
      cause:
        dut.delay > 0
          ? `the ${dut.delay} ${clock.unit} path delay after edge ${k} expires`
          : dut.update === "nba"
            ? `the flop's NBA update at edge ${k}`
            : `a blocking update in Active at edge ${k}`,
    });
  }
  return { name: "dout", initial: 0, changes };
}

export interface EdgeReport {
  edge: number;
  time: number;
  sample: InputSample;
  /** `@(cb); x = cb.dout;` */
  afterCb: ClockvarRead;
  /** `@(posedge clk); x = cb.dout;` */
  afterPosedge: ClockvarRead;
  /** `@(posedge clk); x = dout;` — no clocking block. */
  raw: ReadResult;
}

export interface ClockingRun {
  dout: SignalTrace;
  din: SignalTrace;
  /** Sampled value held by `cb.dout` from each clocking event on. */
  clockvar: SignalTrace;
  edges: EdgeReport[];
  drive: DriveResult | null;
  /** Set when the drive form is illegal (e.g. `##1` without a default clocking). */
  driveError: { error: string; clause: string } | null;
  /** For the `##1 cb.din <= v;` form: when the process resumes. */
  driveBlocksUntilEdge: number | null;
  question: EdgeReport;
}

export function runClocking(scenario: ClockingScenario): ClockingRun {
  const { clock } = scenario;
  const dout = dutOutputTrace(clock, scenario.dut);
  const edges: EdgeReport[] = [];
  for (let k = 1; k <= clock.edges; k += 1) {
    edges.push({
      edge: k,
      time: edgeTime(clock, k),
      sample: sampleInput(dout, clock, k, scenario.inputSkew),
      afterCb: readClockvar(dout, clock, k, scenario.inputSkew, "cb"),
      afterPosedge: readClockvar(dout, clock, k, scenario.inputSkew, "posedge"),
      raw: readRawAtEdge(dout, clock, k),
    });
  }
  const clockvar: SignalTrace = {
    name: "cb.dout",
    initial: UNKNOWN,
    changes: edges.map((e) => ({
      at: { time: e.time, region: "observed" },
      value: e.sample.value,
      cause: `edge ${e.edge}'s sample becomes readable before @(cb) fires`,
    })),
  };

  const issuedAt = edgeTime(clock, scenario.driveEdge);
  let drive: DriveResult | null = null;
  let driveError: ClockingRun["driveError"] = null;
  let driveBlocksUntilEdge: number | null = null;
  if (scenario.driveForm === "plain") {
    drive = scheduleDrive(clock, scenario.outputSkew, { issuedAt });
  } else if (scenario.driveForm === "intra") {
    drive = scheduleDrive(clock, scenario.outputSkew, { issuedAt, intraCycles: 1 });
  } else {
    const wait = cycleDelay(clock, { cycles: 1, hasDefaultClocking: scenario.hasDefaultClocking, time: issuedAt, afterClockingEvent: true });
    if (!wait.ok) {
      driveError = { error: wait.error, clause: wait.clause };
    } else {
      driveBlocksUntilEdge = wait.resumeEdge;
      drive = scheduleDrive(clock, scenario.outputSkew, { issuedAt: edgeTime(clock, wait.resumeEdge) });
    }
  }
  const din: SignalTrace = {
    name: "din",
    initial: UNKNOWN,
    changes: drive ? [{ at: drive.at, value: scenario.driveValue, cause: "the synchronous drive matures" }] : [],
  };
  const question = edges[Math.min(Math.max(scenario.questionEdge, 1), edges.length) - 1];
  return { dout, din, clockvar, edges, drive, driveError, driveBlocksUntilEdge, question };
}

export interface CodeLine {
  text: string;
  owner?: "design" | "testbench";
  key?: string;
}

/** SystemVerilog shown next to the timeline, generated from the same scenario the model runs. */
export function scenarioToSource(scenario: ClockingScenario): CodeLine[] {
  const { clock, dut } = scenario;
  const lines: CodeLine[] = [];
  const dutLines: CodeLine[] =
    dut.delay > 0
      ? [
          { text: "always_ff @(posedge clk) q <= q + 1;", owner: "design", key: "dut" },
          { text: `assign #${dut.delay} dout = q;   // ${dut.delay} ${clock.unit} path to the output`, owner: "design", key: "dut-path" },
        ]
      : dut.update === "nba"
        ? [{ text: "always_ff @(posedge clk) dout <= dout + 1;", owner: "design", key: "dut" }]
        : [{ text: "always @(posedge clk) dout = dout + 1;   // blocking: bad RTL", owner: "design", key: "dut" }];
  lines.push(...dutLines, { text: "" });
  lines.push(
    { text: "module tb (input logic clk, input logic [7:0] dout,", owner: "testbench" },
    { text: "           output logic [7:0] din);", owner: "testbench" },
    {
      text: `  ${scenario.hasDefaultClocking ? "default clocking" : "clocking"} cb @(posedge clk);`,
      owner: "testbench",
      key: "cb-decl",
    },
    {
      text: `    default input ${formatInputSkew(scenario.inputSkew, clock.unit)} output ${formatOutputSkew(scenario.outputSkew, clock.unit)};`,
      owner: "testbench",
      key: "skews",
    },
    { text: "    input  dout;", owner: "testbench" },
    { text: "    output din;", owner: "testbench" },
    { text: "  endclocking", owner: "testbench" },
    { text: "  logic [7:0] x;", owner: "testbench" },
    { text: "  initial begin", owner: "testbench" },
    { text: `    repeat (${scenario.driveEdge}) @(cb);   // edge ${scenario.driveEdge}`, owner: "testbench" },
  );
  const value = `8'h${String(scenario.driveValue)}`;
  if (scenario.driveForm === "plain") lines.push({ text: `    cb.din <= ${value};`, owner: "testbench", key: "drive" });
  else if (scenario.driveForm === "intra") lines.push({ text: `    cb.din <= ##1 ${value};   // does not block`, owner: "testbench", key: "drive" });
  else lines.push({ text: `    ##1 cb.din <= ${value};   // blocks one cycle first`, owner: "testbench", key: "drive" });
  const waitsToQuestion = scenario.questionEdge - (scenario.driveForm === "prefix" && scenario.hasDefaultClocking ? scenario.driveEdge + 1 : scenario.driveEdge);
  if (waitsToQuestion > 0) {
    lines.push({ text: `    repeat (${waitsToQuestion}) @(cb);   // edge ${scenario.questionEdge}`, owner: "testbench" });
  }
  lines.push(
    { text: "    x = cb.dout;   // which value?", owner: "testbench", key: "read" },
    { text: "  end", owner: "testbench" },
    { text: "endmodule", owner: "testbench" },
  );
  return lines;
}
