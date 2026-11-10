import {
  DEFAULT_TIME_UNIT,
  exploreOrderings,
  findProcessStatement,
  formatPrintValue,
  formatValue,
  isContinuousAssign,
  printArgs,
  simulateTimeSlot,
  slotTimeLabel,
  type ExplorationResult,
  type Expr,
  type SimulationResult,
  type Statement,
  type SvScenario,
  type SvValue,
  type TraceStep,
} from "./sv-scheduler-model";

/**
 * Scenario library for the scheduling/race visuals. Every scenario is data:
 * the displayed code is generated from the same objects the model executes,
 * so the code panel can never disagree with the simulated behaviour.
 */

export type SchedulerScenarioId =
  | "shift-blocking"
  | "shift-nba"
  | "tb-blocking-drive"
  | "tb-nba-drive"
  | "tb-clocking-block"
  | "display-vs-strobe";

export const shiftRegisterScenario = (op: "blocking" | "nba"): SvScenario => ({
  id: op === "blocking" ? "shift-blocking" : "shift-nba",
  title: op === "blocking" ? "Two-stage shift register (blocking)" : "Two-stage shift register (nonblocking)",
  clock: "clk",
  initial: { clk: 0, d: 1, q1: 0, q2: 0 },
  watch: ["clk", "d", "q1", "q2"],
  processes: [
    {
      id: "A",
      label: "Stage A",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "a1", op, target: "q1", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "B",
      label: "Stage B",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "b1", op, target: "q2", expr: { kind: "var", name: "q1" } }],
    },
  ],
});

type DriveStyle = "blocking" | "nba" | "clocking";

/** A testbench driver and a design flop that both wake on the same edge. */
export const testbenchDriveScenario = (style: DriveStyle): SvScenario => {
  const driverBody =
    style === "clocking"
      ? [
          { kind: "cbDrive" as const, id: "tb1", clocking: "cb", target: "din", expr: { kind: "const" as const, value: 7 } },
          { kind: "assign" as const, id: "tb2", op: "blocking" as const, target: "seen", expr: { kind: "sampled" as const, name: "q", clocking: "cb" } },
        ]
      : [
          { kind: "assign" as const, id: "tb1", op: style === "blocking" ? ("blocking" as const) : ("nba" as const), target: "din", expr: { kind: "const" as const, value: 7 } },
          { kind: "assign" as const, id: "tb2", op: "blocking" as const, target: "seen", expr: { kind: "var" as const, name: "q" } },
        ];
  return {
    id: style === "blocking" ? "tb-blocking-drive" : style === "nba" ? "tb-nba-drive" : "tb-clocking-block",
    title:
      style === "blocking"
        ? "Testbench drives with = at the clock edge"
        : style === "nba"
          ? "Testbench drives with <= at the clock edge"
          : "Testbench drives and samples through a clocking block",
    clock: "clk",
    initial: { clk: 0, din: 3, q: 1, seen: "X" },
    watch: ["clk", "din", "q", "seen"],
    clockings: style === "clocking" ? [{ name: "cb", clock: "clk" }] : undefined,
    processes: [
      {
        id: "DUT",
        label: "DUT flop",
        owner: "design",
        context: "module",
        header: "always_ff @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [{ kind: "assign", id: "dut1", op: "nba", target: "q", expr: { kind: "var", name: "din" } }],
      },
      {
        id: "TB",
        label: "TB driver",
        owner: "testbench",
        context: "module",
        header: style === "clocking" ? "always @(cb)" : "always @(posedge clk)",
        trigger: style === "clocking" ? { kind: "clocking", clocking: "cb" } : { kind: "posedge", signal: "clk" },
        body: driverBody,
      },
    ],
  };
};

export const displayVsStrobeScenario = (): SvScenario => ({
  id: "display-vs-strobe",
  title: "$display versus $strobe after a nonblocking assignment",
  clock: "clk",
  initial: { clk: 0, d: 5, q: 0 },
  watch: ["clk", "d", "q"],
  processes: [
    {
      id: "P",
      label: "Flop + prints",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "assign", id: "p1", op: "nba", target: "q", expr: { kind: "var", name: "d" } },
        { kind: "display", id: "p2", signals: ["q"] },
        { kind: "strobe", id: "p3", signals: ["q"] },
      ],
    },
  ],
});

export interface ScenarioPreset {
  id: SchedulerScenarioId;
  label: string;
  summary: string;
  build: () => SvScenario;
}

export const schedulerScenarioPresets: ScenarioPreset[] = [
  {
    id: "shift-blocking",
    label: "Shift register · =",
    summary: "Two flops written with blocking assignments read and write q1 in the same Active region.",
    build: () => shiftRegisterScenario("blocking"),
  },
  {
    id: "shift-nba",
    label: "Shift register · <=",
    summary: "The same flops with nonblocking assignments: reads happen in Active, writes wait for NBA.",
    build: () => shiftRegisterScenario("nba"),
  },
  {
    id: "tb-blocking-drive",
    label: "TB drive · =",
    summary: "A testbench drives the DUT input with = on the same edge the DUT samples it.",
    build: () => testbenchDriveScenario("blocking"),
  },
  {
    id: "tb-nba-drive",
    label: "TB drive · <=",
    summary: "The testbench drives with <=, so the DUT flop always captures the pre-edge value.",
    build: () => testbenchDriveScenario("nba"),
  },
  {
    id: "tb-clocking-block",
    label: "TB · clocking block",
    summary: "The driver writes cb.din (Re-NBA) and reads cb.q (Preponed sample).",
    build: () => testbenchDriveScenario("clocking"),
  },
  {
    id: "display-vs-strobe",
    label: "$display vs $strobe",
    summary: "One process prints q right after scheduling q <= d.",
    build: () => displayVsStrobeScenario(),
  },
];

export function getScenarioPreset(id: SchedulerScenarioId): ScenarioPreset {
  const preset = schedulerScenarioPresets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown scheduler scenario: ${id}`);
  return preset;
}

// ---------------------------------------------------------------------------
// Region-map scenarios (F3B "where does each event land?"). Appended; the
// presets above are unchanged. Each scenario isolates one rule of the region
// loop in IEEE 1800-2023 §4.4–§4.5.
// ---------------------------------------------------------------------------

export type RegionMapScenarioId = "comb-after-nba" | "zero-delay-prints" | "program-reactive";

/**
 * A flop feeds a continuous assignment, which feeds an always_comb.
 * The NBA update of q wakes `assign y = q` (§4.9.1: an active update event),
 * so the scheduler returns from NBA to Active in the same time slot (§4.5).
 */
export const combAfterNbaScenario = (): SvScenario => ({
  id: "comb-after-nba",
  title: "A flop feeds a continuous assignment and an always_comb",
  clock: "clk",
  initial: { clk: 0, d: 1, q: 0, y: 0, z: 0 },
  watch: ["clk", "d", "q", "y", "z"],
  processes: [
    {
      id: "FF",
      label: "always_ff",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "ff1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "CA",
      label: "assign y",
      owner: "design",
      context: "module",
      header: "assign",
      trigger: { kind: "change", signals: ["q"] },
      body: [{ kind: "assign", id: "ca1", op: "blocking", target: "y", expr: { kind: "var", name: "q" } }],
    },
    {
      id: "COMB",
      label: "always_comb",
      owner: "design",
      context: "module",
      header: "always_comb",
      trigger: { kind: "change", signals: ["y"] },
      body: [{ kind: "assign", id: "cb1", op: "blocking", target: "z", expr: { kind: "var", name: "y" } }],
    },
  ],
});

/**
 * One process prints q three ways after scheduling `q <= d`:
 * $display before #0 (Active), $display after #0 (Inactive, which still
 * precedes NBA, §4.4.2.3–§4.4.2.4) and $strobe (Postponed, §4.4.2.9, §21.2.2).
 */
export const zeroDelayPrintsScenario = (): SvScenario => ({
  id: "zero-delay-prints",
  title: "$display, #0 and $strobe after a nonblocking assignment",
  clock: "clk",
  initial: { clk: 0, d: 5, q: 0 },
  watch: ["clk", "d", "q"],
  processes: [
    {
      id: "P",
      label: "Flop + prints",
      owner: "design",
      context: "module",
      header: "always @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "assign", id: "zp1", op: "nba", target: "q", expr: { kind: "var", name: "d" } },
        { kind: "display", id: "zp2", signals: ["q"] },
        { kind: "delay0", id: "zp3" },
        { kind: "display", id: "zp4", signals: ["q"] },
        { kind: "strobe", id: "zp5", signals: ["q"] },
      ],
    },
  ],
});

/**
 * A design flop, a design continuous assignment, and a program-block process
 * woken by the same edge. Program code runs in Reactive (§24.3.1), after the
 * design's NBA updates; its `<=` lands in Re-NBA (§4.4.2.8, §24.3.1); the
 * resulting design event sends the scheduler back to Active (§4.5).
 */
export const programReactiveScenario = (): SvScenario => ({
  id: "program-reactive",
  title: "A program block reacts to the same clock edge",
  clock: "clk",
  initial: { clk: 0, d: 1, q: 0, seen: "X", cmd: 0, led: 0 },
  watch: ["clk", "q", "seen", "cmd", "led"],
  processes: [
    {
      id: "FF",
      label: "DUT flop",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "pr1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "LED",
      label: "assign led",
      owner: "design",
      context: "module",
      header: "assign",
      trigger: { kind: "change", signals: ["cmd"] },
      body: [{ kind: "assign", id: "pr2", op: "blocking", target: "led", expr: { kind: "var", name: "cmd" } }],
    },
    {
      id: "TB",
      label: "program thread",
      owner: "testbench",
      context: "program",
      header: "initial forever @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [
        { kind: "assign", id: "pr3", op: "blocking", target: "seen", expr: { kind: "var", name: "q" } },
        { kind: "assign", id: "pr4", op: "nba", target: "cmd", expr: { kind: "const", value: 1 } },
      ],
    },
  ],
});

export interface RegionMapPreset {
  id: RegionMapScenarioId;
  label: string;
  summary: string;
  build: () => SvScenario;
}

export const regionMapScenarioPresets: RegionMapPreset[] = [
  {
    id: "comb-after-nba",
    label: "NBA → combinational",
    summary: "q changes in NBA, and the logic that reads q runs again in Active: a second pass of the same time slot.",
    build: combAfterNbaScenario,
  },
  {
    id: "zero-delay-prints",
    label: "$display · #0 · $strobe",
    summary: "Three prints of q after q <= d: before #0, after #0, and with $strobe.",
    build: zeroDelayPrintsScenario,
  },
  {
    id: "program-reactive",
    label: "program block",
    summary: "A program thread wakes on the same edge as the design flop, reads q, and drives cmd.",
    build: programReactiveScenario,
  },
];

export function getRegionMapPreset(id: RegionMapScenarioId): RegionMapPreset {
  const preset = regionMapScenarioPresets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown region-map scenario: ${id}`);
  return preset;
}

// ---------------------------------------------------------------------------
// Trace presets for TimeSlotTraceVisualizer's F3A, F3B and F3C uses, the
// folded (region-free) view of one time slot, and the NBA-writer benches of
// RaceConditionDebugger. Kept out of `schedulerScenarioPresets`, whose trace
// sets are pinned by hash in tests/lib/sv-scheduler-model.test.ts.
//
// Rules (IEEE 1800-2023):
// - §4.5: a time slot is a set of update events (◆) and evaluation events (▶);
//   the slot repeats while any event remains, and time moves only when the
//   scheduler moves to the next nonempty time slot.
// - §4.9.1: a continuous assignment is re-evaluated when an operand changes,
//   and its new value is an active update event.
// - §4.9.4: a nonblocking assignment schedules its update as an NBA event.
// - §4.4.2.3 / §4.4.2.4: #0 resumes in Inactive, which comes before NBA.
// - §4.4.2.9: $strobe prints in Postponed.
// - §4.6: NBAs from one process are performed in execution order.
// - §4.7: processes ready together may run in any order.
// - §4.5 "any event": a process woken by one NBA update may run before the
//   remaining updates are applied (the model's opt-in interleaveNba).
// The standard never uses the term "delta cycle"; Δ here is the model's count
// of moves back to Active or Reactive, and tools count differently.
// ---------------------------------------------------------------------------

export type TraceExtraScenarioId = "f3a-one-edge" | "f3a-one-edge-zero-delay" | "comb-after-nba" | "program-drive" | "gclk-interleave" | "gclk-enable";
export type TraceScenarioId = SchedulerScenarioId | TraceExtraScenarioId;

/** The clock period of the F3A bench: `always #5 clk = ~clk`. */
export const F3A_HALF_PERIOD = 5;

/**
 * F3A's bench (the lesson's "One time slot, traced event by event"):
 * `always #5 clk = ~clk;`, `always_ff @(posedge clk) q <= d;`,
 * `assign q_n = ~q;` and an initial that waits on @(posedge clk), prints with
 * $display and $strobe, then waits #1. The slot modelled is t = 5, where the
 * clock process's #5 from t = 0 expires. `zeroDelay` adds `#0` before $display.
 */
export const f3aOneEdgeScenario = (zeroDelay = false): SvScenario => {
  const slotTime = F3A_HALF_PERIOD;
  return {
    id: zeroDelay ? "f3a-one-edge-zero-delay" : "f3a-one-edge",
    title: zeroDelay ? "The same edge with #0 before $display" : "One rising clock edge, event by event",
    clock: "clk",
    clockSource: "process",
    slotTime,
    timeUnit: "ns",
    initial: { clk: 0, d: 1, q: 0, q_n: 1 },
    watch: ["clk", "d", "q", "q_n"],
    processes: [
      {
        id: "CLK",
        label: "clock",
        owner: "testbench",
        context: "module",
        header: `always #${F3A_HALF_PERIOD}`,
        trigger: {
          kind: "resume",
          note: `the #${F3A_HALF_PERIOD} from t = ${slotTime - F3A_HALF_PERIOD} is over, and the next #${F3A_HALF_PERIOD} books t = ${slotTime + F3A_HALF_PERIOD}`,
        },
        body: [{ kind: "assign", id: "f3a-clk", op: "blocking", target: "clk", expr: { kind: "inv", expr: { kind: "var", name: "clk" } } }],
      },
      {
        id: "FF",
        label: "always_ff",
        owner: "design",
        context: "module",
        header: "always_ff @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [{ kind: "assign", id: "f3a-ff", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
      },
      {
        id: "CA",
        label: "assign q_n",
        owner: "design",
        context: "module",
        header: "assign",
        trigger: { kind: "change", signals: ["q"] },
        body: [{ kind: "assign", id: "f3a-ca", op: "blocking", target: "q_n", expr: { kind: "inv", expr: { kind: "var", name: "q" } } }],
      },
      {
        id: "INIT",
        label: "initial",
        owner: "testbench",
        context: "module",
        header: "initial @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [
          ...(zeroDelay ? [{ kind: "delay0" as const, id: "f3a-zero" }] : []),
          { kind: "display", id: "f3a-display", signals: ["q", "q_n"], label: "display", showTime: true },
          // Two spaces after "strobe", as in the lesson, so the two lines align.
          { kind: "strobe", id: "f3a-strobe", signals: ["q", "q_n"], label: "strobe ", showTime: true },
          { kind: "delay", id: "f3a-wait", units: 1 },
          { kind: "finish", id: "f3a-finish" },
        ],
      },
    ],
  };
};

/**
 * F3B's corner case: a clock generated with `<=` (`gclk <= ~gclk`) shares the
 * NBA batch with `a <= d`, and `always @(posedge gclk) b <= a;` is woken by the
 * gclk update. interleaveNba lets the woken flop run before `a ← 1` is applied
 * (§4.5 "any event", §4.6 orders only the updates).
 * 'enable' replaces the generated clock with clk and an enable that toggles
 * with `en <= ~en`; the model does not evaluate `if`, so the scenario fixes
 * en = 1 on this edge and a test pins that every order reads en = 1.
 */
export const gclkScenario = (style: "generated" | "enable"): SvScenario => {
  const flopA = {
    id: "A",
    label: "flop a",
    owner: "design" as const,
    context: "module" as const,
    header: "always @(posedge clk)",
    trigger: { kind: "posedge" as const, signal: "clk" },
    body: [{ kind: "assign" as const, id: "gc-a", op: "nba" as const, target: "a", expr: { kind: "var" as const, name: "d" } }],
  };
  if (style === "generated") {
    return {
      id: "gclk-interleave",
      title: "A clock generated with <= in the same NBA batch as its data",
      clock: "clk",
      initial: { clk: 0, gclk: 0, d: 1, a: 0, b: "X" },
      watch: ["clk", "gclk", "a", "b"],
      options: { interleaveNba: true },
      processes: [
        {
          id: "DIV",
          label: "divider",
          owner: "design",
          context: "module",
          header: "always @(posedge clk)",
          trigger: { kind: "posedge", signal: "clk" },
          body: [{ kind: "assign", id: "gc-div", op: "nba", target: "gclk", expr: { kind: "inv", expr: { kind: "var", name: "gclk" } } }],
        },
        flopA,
        {
          id: "B",
          label: "flop b",
          owner: "design",
          context: "module",
          header: "always @(posedge gclk)",
          trigger: { kind: "posedge", signal: "gclk" },
          body: [{ kind: "assign", id: "gc-b", op: "nba", target: "b", expr: { kind: "var", name: "a" } }],
        },
      ],
    };
  }
  return {
    id: "gclk-enable",
    title: "The same flops on clk with an enable",
    clock: "clk",
    initial: { clk: 0, en: 1, d: 1, a: 0, b: "X" },
    watch: ["clk", "en", "a", "b"],
    options: { interleaveNba: true },
    processes: [
      {
        id: "EN",
        label: "enable",
        owner: "design",
        context: "module",
        header: "always @(posedge clk)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [{ kind: "assign", id: "gc-en", op: "nba", target: "en", expr: { kind: "inv", expr: { kind: "var", name: "en" } } }],
      },
      flopA,
      {
        id: "B",
        label: "flop b",
        owner: "design",
        context: "module",
        header: "always @(posedge clk) if (en)",
        trigger: { kind: "posedge", signal: "clk" },
        body: [{ kind: "assign", id: "gc-b", op: "nba", target: "b", expr: { kind: "var", name: "a" } }],
      },
    ],
  };
};

export type NbaWritersForm = "one-process" | "two-processes";

/**
 * F3B's guarantee rows 2 and 3. 'one-process': `a <= 0; a <= 1;` in one
 * begin-end, so §4.6 performs the updates in execution order and a ends 1.
 * 'two-processes': `a <= 0` and `a <= 1` in two processes woken by one edge,
 * so §4.7 lets either run first and either update lands last.
 */
export const nbaWritersScenario = (form: NbaWritersForm): SvScenario => {
  const write = (id: string, value: number) => ({ kind: "assign" as const, id, op: "nba" as const, target: "a", expr: { kind: "const" as const, value } });
  const proc = (id: string, label: string, body: ReturnType<typeof write>[]) => ({
    id,
    label,
    owner: "design" as const,
    context: "module" as const,
    header: "always @(posedge clk)",
    trigger: { kind: "posedge" as const, signal: "clk" },
    body,
  });
  return {
    id: form === "one-process" ? "nba-writers-one" : "nba-writers-two",
    title: form === "one-process" ? "Two nonblocking writes in one process" : "Two processes write a with <= on one edge",
    clock: "clk",
    initial: { clk: 0, a: "X" },
    watch: ["clk", "a"],
    processes: form === "one-process" ? [proc("P", "one process", [write("nw0", 0), write("nw1", 1)])] : [proc("W0", "writer a <= 0", [write("nw0", 0)]), proc("W1", "writer a <= 1", [write("nw1", 1)])],
  };
};

// ---------------------------------------------------------------------------
// Pure helpers over a run: printed lines and the folded view.
// ---------------------------------------------------------------------------

/** The text each print produced, without the model's "$display: " prefix. */
export function printedLines(run: Pick<SimulationResult, "log">): string[] {
  return run.log.map(stripTask);
}

const stripTask = (line: string) => line.replace(/^\$\w+: /, "");

/** The model's Δ at the end of a run: its count of moves back to Active or Reactive. */
export function modelDeltaCount(run: SimulationResult): number {
  return run.trace.at(-1)?.delta ?? 0;
}

type PrintStmt = Extract<Statement, { kind: "display" | "strobe" }>;

/**
 * What a print statement would show for a given set of values, formatted the
 * way the model formats its log (`%0d` of $time, label, then `name=%0d`).
 * Only plain variables and constants are read; anything else throws. Used to
 * build prediction distractors; a test pins it to the model's own log.
 */
export function formatPrintAt(stmt: PrintStmt, values: Record<string, SvValue>, slotTime: number): string {
  const read = (expr: Expr): SvValue => {
    if (expr.kind === "var") return values[expr.name] ?? "X";
    if (expr.kind === "const") return expr.value;
    throw new Error(`formatPrintAt reads plain variables and constants only, not ${expr.kind}`);
  };
  return [...(stmt.showTime ? [String(slotTime)] : []), ...(stmt.label ? [stmt.label] : []), ...printArgs(stmt).map((a) => `${a.label}=${formatPrintValue(read(a.expr))}`)].join(" ");
}

export type FoldedEventKind = "start" | "evaluate" | "update" | "end";

export interface FoldedEvent {
  index: number;
  kind: FoldedEventKind;
  /** ▶ evaluation event, ◆ update event (§4.5); empty for the start and end of the slot. */
  glyph: "" | "▶" | "◆";
  label: string;
  processId?: string;
  signal?: string;
  from?: SvValue;
  to?: SvValue;
  /** Process labels this update woke, read from the model's queues. */
  woken: string[];
  /** The model's narration of every step folded into this event. */
  detail: string[];
  why: string;
  /** The model's Δ when this event ran. */
  delta: number;
  /** Set when the scheduler moved events back to Active or Reactive just before this event. */
  movedBefore?: string;
  /** Set when a scheduler choice picked this event. */
  choice?: { what: string; options: string[]; picked: string };
  /** Trace indices folded into this event. */
  steps: number[];
  values: Record<string, SvValue>;
  /** Lines printed by this event. */
  printed: string[];
  /** Everything printed up to and including this event. */
  log: string[];
}

export interface FoldedSlot {
  events: FoldedEvent[];
  slotTime: number;
  timeUnit: string;
  /** The model's final Δ. */
  delta: number;
}

/** Processes with an evaluation event queued after a step that were not queued before it. */
function newlyQueued(before: TraceStep | undefined, after: TraceStep, scenario: SvScenario): string[] {
  const ids = (step: TraceStep | undefined) =>
    new Set(step ? Object.values(step.queues).flatMap((q) => q.filter((i) => i.kind === "evaluate" && i.processId).map((i) => i.processId as string)) : []);
  const was = ids(before);
  return [...ids(after)].filter((id) => !was.has(id)).map((id) => scenario.processes.find((p) => p.id === id)?.label ?? id);
}

function targetOf(scenario: SvScenario, stmtId: string | undefined): string | undefined {
  const stmt = findProcessStatement(scenario, stmtId);
  return stmt && (stmt.kind === "assign" || stmt.kind === "cbDrive") ? stmt.target : undefined;
}

/**
 * Folds a run's trace into the events of §4.5, region-free: ▶ when a process
 * is evaluated, ◆ when a value is updated. A blocking write inside a procedure
 * changes the value while the process runs, so the ▶ shows the new value and
 * the ◆ that follows names what it woke. A continuous assignment's new value is
 * an active update event of its own (§4.9.1), so its ▶ shows the old value and
 * the ◆ the new one. Moves back to Active or Reactive and scheduler choices are
 * attached to the event that follows them.
 */
export function foldTimeSlot(scenario: SvScenario, run: SimulationResult): FoldedSlot {
  const events: FoldedEvent[] = [];
  let pendingMove: string | undefined;
  let pendingChoice: FoldedEvent["choice"];
  const labelOf = (id?: string) => scenario.processes.find((p) => p.id === id)?.label ?? id ?? "";

  const open = (step: TraceStep, init: Pick<FoldedEvent, "kind" | "glyph" | "label"> & Partial<FoldedEvent>): FoldedEvent => {
    const event: FoldedEvent = {
      woken: [],
      detail: [],
      why: step.why,
      printed: [],
      ...init,
      index: events.length,
      delta: step.delta,
      steps: [step.index],
      values: { ...step.values },
      log: step.log.map(stripTask),
      ...(pendingMove ? { movedBefore: pendingMove } : {}),
      ...(pendingChoice ? { choice: pendingChoice } : {}),
    };
    pendingMove = undefined;
    pendingChoice = undefined;
    events.push(event);
    return event;
  };

  const attach = (event: FoldedEvent | undefined, step: TraceStep, opts: { values?: boolean; detail?: boolean } = {}) => {
    if (!event) return;
    if (!event.steps.includes(step.index)) event.steps.push(step.index);
    if (opts.detail !== false) event.detail.push(step.what);
    if (opts.values !== false) event.values = { ...step.values };
    event.log = step.log.map(stripTask);
  };

  let end: FoldedEvent | undefined;
  const endEvent = (step: TraceStep) => {
    if (end) return end;
    end = open(step, { kind: "end", glyph: "", label: step.endedBy ? `run ended by ${step.endedBy === "finish" ? "$finish" : "an implicit $finish"}` : "end of slot" });
    return end;
  };

  run.trace.forEach((step, i) => {
    const before = i > 0 ? run.trace[i - 1] : undefined;
    const current = events.at(-1);
    switch (step.kind) {
      case "slot-start":
        open(step, { kind: "start", glyph: "", label: "entering the slot", detail: [step.what] });
        return;
      case "sample":
        attach(current, step);
        return;
      case "choice":
        pendingChoice = step.choice ? { what: step.what, options: step.choice.options, picked: step.choice.picked } : undefined;
        return;
      case "move":
        pendingMove = step.what;
        return;
      case "wake":
        open(step, {
          kind: "evaluate",
          glyph: "▶",
          label: step.processId ? `${labelOf(step.processId)}${/resumes/.test(step.what) ? " (resumes)" : ""}` : step.what,
          processId: step.processId,
          detail: [step.what],
        });
        return;
      case "update": {
        const signal = step.changed[0] ?? targetOf(scenario, step.stmtId) ?? scenario.clock;
        const from = before?.values[signal] ?? "X";
        const to = step.values[signal] ?? "X";
        open(step, {
          kind: "update",
          glyph: "◆",
          label: `${signal} ${formatValue(from)} → ${formatValue(to)}`,
          processId: step.processId,
          signal,
          from,
          to,
          woken: newlyQueued(before, step, scenario),
          detail: [step.what],
        });
        return;
      }
      case "slot-end":
        attach(endEvent(step), step);
        return;
      case "print":
        if (step.region === "postponed") {
          const e = endEvent(step);
          attach(e, step);
          e.printed.push(stripTask(step.log.at(-1) ?? ""));
          return;
        }
        attach(current, step);
        current?.printed.push(stripTask(step.log.at(-1) ?? ""));
        return;
      default: {
        const process = scenario.processes.find((p) => p.id === step.processId);
        if (step.changed.length > 0 && process && current) {
          // §4.9.1: a continuous assignment's new value is its own active update event, so its ▶ keeps the old value.
          attach(current, step, { values: !isContinuousAssign(process) });
          for (const signal of step.changed) {
            const from = before?.values[signal] ?? "X";
            const to = step.values[signal] ?? "X";
            open(step, {
              kind: "update",
              glyph: "◆",
              label: `${signal} ${formatValue(from)} → ${formatValue(to)}`,
              processId: process.id,
              signal,
              from,
              to,
              woken: newlyQueued(before, step, scenario),
              detail: [],
            });
          }
          return;
        }
        attach(current, step);
      }
    }
  });

  return { events, slotTime: run.slotTime, timeUnit: scenario.timeUnit ?? DEFAULT_TIME_UNIT, delta: modelDeltaCount(run) };
}

/** One sentence per update event: what it woke, from the model's queues. */
export function describeWoken(event: Pick<FoldedEvent, "woken">): string {
  if (event.woken.length === 0) return "No process waits on this change.";
  return `Wakes ${event.woken.length === 1 ? event.woken[0] : `${event.woken.slice(0, -1).join(", ")} and ${event.woken.at(-1)}`}.`;
}

// ---------------------------------------------------------------------------
// Predictions. Every label and every correct flag is computed from the model.
// ---------------------------------------------------------------------------

export interface TracePredictionOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface TracePrediction {
  question: string;
  options: TracePredictionOption[];
}

function printStatements(scenario: SvScenario): { display: PrintStmt; strobe: PrintStmt } {
  const stmts = scenario.processes.flatMap((p) => p.body);
  const display = stmts.find((s): s is PrintStmt => s.kind === "display");
  const strobe = stmts.find((s): s is PrintStmt => s.kind === "strobe");
  if (!display || !strobe) throw new Error(`${scenario.id} needs a $display and a $strobe`);
  return { display, strobe };
}

const pairLabel = (a: string, b: string) => `${a}  ·  ${b}`;

/** F3A: predict both printed lines. Distractors are the same prints at other moments of the slot. */
export function f3aPrintPrediction(scenario: SvScenario): TracePrediction {
  const run = simulateTimeSlot(scenario);
  const { display, strobe } = printStatements(scenario);
  const actual = printedLines(run);
  const start = run.trace[0].values;
  const qStep = run.trace.find((s) => s.kind === "update" && s.changed.includes("q"));
  const afterQ = qStep ? qStep.values : run.finalValues;
  const final = run.finalValues;
  const t = run.slotTime;
  const at = (stmt: PrintStmt, v: Record<string, SvValue>) => formatPrintAt(stmt, v, t);
  const v = (name: string, values: Record<string, SvValue>) => formatPrintValue(values[name]);
  const candidates: { id: string; lines: [string, string]; feedback: string }[] = [
    {
      id: "display-old-strobe-final",
      lines: [at(display, start), at(strobe, final)],
      feedback: `$display runs in the first pass, before the NBA update of q is applied (§4.9.4, §4.4.2.4), whichever of always_ff and initial runs first, so it prints q=${v("q", start)} q_n=${v("q_n", start)}. $strobe prints in Postponed (§4.4.2.9), after the NBA update of q (§4.4.2.4) and the assign it wakes (§4.9.1): q=${v("q", final)} q_n=${v("q_n", final)}.`,
    },
    {
      id: "both-old",
      lines: [at(display, start), at(strobe, start)],
      feedback: `$strobe does not print when it is called: it books its print for Postponed (§4.4.2.9), the end of the slot, after q has become ${v("q", final)}.`,
    },
    {
      id: "both-final",
      lines: [at(display, final), at(strobe, final)],
      feedback: `q <= d does not change q when the always_ff runs: the update is an NBA event (§4.9.4), applied only after the Active work, and $display is part of that Active work. It still sees q=${v("q", start)}.`,
    },
    {
      id: "strobe-before-assign",
      lines: [at(display, start), at(strobe, afterQ)],
      feedback: `The assign is re-evaluated as soon as q changes (§4.9.1), and its update of q_n happens in the same slot, before Postponed. So $strobe sees q_n=${v("q_n", final)}, not ${v("q_n", afterQ)}.`,
    },
  ];
  const seen = new Set<string>();
  const options = candidates
    .filter((c) => {
      const key = c.lines.join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({ id: c.id, label: pairLabel(c.lines[0], c.lines[1]), correct: c.lines[0] === actual[0] && c.lines[1] === actual[1], feedback: c.feedback }));
  return { question: `The initial prints two lines at t = ${t} ${scenario.timeUnit ?? DEFAULT_TIME_UNIT}. What are they?`, options };
}

/** F3A advanced: with #0 before $display, does $display now see the new q? */
export function zeroDelayPrediction(scenario: SvScenario): TracePrediction {
  const run = simulateTimeSlot(scenario);
  const displayStep = run.trace.find((s) => s.kind === "print" && s.region !== "postponed");
  const shown = displayStep?.values.q ?? "X";
  const newQ = run.finalValues.q;
  const seesNew = shown === newQ;
  const why = `#0 suspends the initial into Inactive (§4.4.2.3), and the scheduler takes Inactive events before NBA events (§4.4.2.4, §4.5). The NBA update of q has not been applied when $display runs, so it prints q=${formatPrintValue(shown)}. Only $strobe, in Postponed (§4.4.2.9), sees q=${formatPrintValue(newQ)}.`;
  return {
    question: `With #0 before $display, does $display now print q=${formatPrintValue(newQ)}?`,
    options: [
      {
        id: "yes",
        label: `Yes: #0 waits until the nonblocking update has landed, so it prints q=${formatPrintValue(newQ)}`,
        correct: seesNew,
        feedback: seesNew ? why : `Not here. ${why}`,
      },
      {
        id: "no",
        label: `No: it still prints q=${formatPrintValue(run.trace[0].values.q)}`,
        correct: !seesNew,
        feedback: why,
      },
    ],
  };
}

/** F3C: predict the settled y and z, the model's Δ, and whether $time moves. */
export function combPrediction(scenario: SvScenario): TracePrediction {
  const run = simulateTimeSlot(scenario);
  const delta = modelDeltaCount(run);
  const start = run.trace[0].values;
  const final = run.finalValues;
  const wakes = run.trace.filter((s) => s.kind === "wake").length;
  const wrongDelta = wakes === delta ? delta + 1 : wakes;
  const time = `${run.slotTime} ${scenario.timeUnit ?? DEFAULT_TIME_UNIT}`;
  const yz = (v: Record<string, SvValue>) => `y = ${formatValue(v.y)}, z = ${formatValue(v.z)}`;
  const right = `${yz(final)}; Δ = ${delta}; $time stays ${time}`;
  const candidates: TracePredictionOption[] = [
    {
      id: "right",
      label: right,
      correct: true,
      feedback: `Once Active is empty, the NBA update of q (§4.9.4) moves back to Active: in the model's count that happens ${delta} time${delta === 1 ? "" : "s"} in this slot. The update wakes assign y = q (§4.9.1), whose change wakes the always_comb, and the slot settles with ${yz(final)}. All of it happens at ${time}: time moves only when the scheduler moves to the next nonempty time slot (§4.5).`,
    },
    {
      id: "logic-first",
      label: `${yz(start)}; Δ = 0; $time stays ${time}`,
      correct: false,
      feedback: `The logic does not stop after the first pass. When q changes, everything that reads q is re-evaluated in the same slot (§4.9.1, §4.5), so y and z become ${formatValue(final.y)}.`,
    },
    {
      id: "time-moves",
      label: `${yz(final)}; Δ = ${delta}; $time moves on by one Δ`,
      correct: false,
      feedback: `Δ is not a unit of time. It counts the model's moves back to Active inside one time slot; $time stays ${time} throughout (§4.5). The standard does not even use the term.`,
    },
    {
      id: "per-process",
      label: `${yz(final)}; Δ = ${wrongDelta}; $time stays ${time}`,
      correct: false,
      feedback: `Δ does not count processes. ${wakes} process evaluations run, but the model adds one to Δ only when Active empties and later events move back into it: ${delta} here.`,
    },
  ];
  // A computed distractor can never equal the right answer.
  const options = candidates.filter((c) => c.id === "right" || c.label !== right);
  return { question: `q <= d updates q, and two pieces of logic read q, then y. When the slot settles, what are y and z, what is the model's Δ, and does $time move?`, options };
}

/**
 * Which update woke `processId` in this run: the last step, before the process first wakes,
 * that changed the signal of its posedge trigger. `byNba` is true when that update was an NBA event
 * moved to Active (§4.4.2.4, §4.5).
 */
export function wakeSource(trace: TraceStep[], scenario: SvScenario, processId: string): { signal: string; byNba: boolean } {
  const process = scenario.processes.find((p) => p.id === processId);
  if (!process || process.trigger.kind !== "posedge") throw new Error(`${processId} in ${scenario.id} has no posedge trigger`);
  const signal = process.trigger.signal;
  const wakeAt = trace.findIndex((s) => s.kind === "wake" && s.processId === processId);
  if (wakeAt < 0) throw new Error(`${processId} never wakes in ${scenario.id}`);
  // A blocking write changes the signal on its statement step; an NBA or continuous update on an update step.
  const update = trace.slice(0, wakeAt).reverse().find((s) => s.changed.includes(signal));
  if (!update) throw new Error(`no update of ${signal} precedes ${processId}'s wake in ${scenario.id}`);
  return { signal, byNba: update.sourceRegion === "nba" };
}

/** F3B: does b capture the old a, the new a, or either? */
export function gclkPrediction(scenario: SvScenario): TracePrediction {
  const exploration = exploreOrderings(scenario);
  const oldA = scenario.initial.a;
  const newA = simulateTimeSlot(scenario).finalValues.a;
  const captured = new Set(exploration.outcomes.map((o) => o.finalValues.b));
  const getsOld = captured.has(oldA);
  const getsNew = captured.has(newA);
  const count = (value: SvValue) => exploration.outcomes.filter((o) => o.finalValues.b === value).reduce((n, o) => n + o.runs.length, 0);
  const tally = `In the model, b = ${formatValue(oldA)} (old a) in ${count(oldA)} of ${exploration.runCount} orders and b = ${formatValue(newA)} (new a) in ${count(newA)}.`;
  const either = getsOld && getsNew;
  // Derived from the trace, never from signal names: the update that woke flop b is the last update
  // of its trigger signal before b's first wake. When that update was an NBA event moved to Active,
  // b is woken by an NBA update; otherwise it is woken by an Active update such as the clock itself.
  const wake = wakeSource(simulateTimeSlot(scenario).trace, scenario, "B");
  const reason = wake.byNba
    ? `flop b is woken by the NBA update of ${wake.signal}. §4.6 orders the NBA updates only among themselves, and §4.5 takes any event, so the woken flop may run before or after a ← ${formatValue(newA)} is applied.`
    : `flop b is woken by ${wake.signal} itself, like flop a, so it reads a in Active, before any NBA update is applied (§4.4.2.4, §4.9.4).`;
  // "Not only." would claim the value sometimes occurs: use it only when it does.
  const wrongSingle = (occurs: boolean) => (occurs ? "Not only. " : "No. ");
  return {
    question: "On this edge, does b capture the old a, the new a, or either?",
    options: [
      { id: "old", label: `The old a (${formatValue(oldA)})`, correct: getsOld && !getsNew, feedback: `${getsOld && !getsNew ? "" : wrongSingle(getsOld)}${reason} ${tally}` },
      { id: "new", label: `The new a (${formatValue(newA)})`, correct: getsNew && !getsOld, feedback: `${getsNew && !getsOld ? "" : wrongSingle(getsNew)}${reason} ${tally}` },
      { id: "either", label: "Either: the standard does not decide", correct: either, feedback: `${either ? "" : "Not here. "}${reason} ${tally}` },
    ],
  };
}

export interface TracePreset {
  id: TraceScenarioId;
  label: string;
  /** Shown before and after the prediction: never names the answer. */
  summary: string;
  build: () => SvScenario;
  /** Predict-then-reveal gate built from the model. */
  prediction?: (scenario: SvScenario) => TracePrediction;
  /** Show the grouped outcomes of every explored order. */
  outcomeGroups?: boolean;
  /** Listed behind "Show advanced". */
  advanced?: boolean;
  /** A visible limit of the model for this preset. */
  modelNote?: (scenario: SvScenario) => string;
}

export const traceExtraScenarioPresets: TracePreset[] = [
  {
    id: "f3a-one-edge",
    label: "One edge · F3A",
    summary: `A clock process, a flop, a continuous assignment and an initial that prints, at ${slotTimeLabel(f3aOneEdgeScenario())}. Predict the two printed lines, then step through every event of the slot.`,
    build: () => f3aOneEdgeScenario(false),
    prediction: f3aPrintPrediction,
  },
  {
    id: "f3a-one-edge-zero-delay",
    label: "#0 before $display",
    summary: "The same bench with #0 before $display. Does waiting #0 let $display see the nonblocking update?",
    build: () => f3aOneEdgeScenario(true),
    prediction: zeroDelayPrediction,
    advanced: true,
  },
  {
    id: "comb-after-nba",
    label: "NBA → combinational",
    summary: "A flop feeds a continuous assignment, which feeds an always_comb. Follow q's NBA update into the logic that reads it.",
    build: combAfterNbaScenario,
    prediction: combPrediction,
  },
  {
    id: "program-drive",
    label: "program drive",
    summary: "A program thread wakes on the same edge as the design flop, reads q and drives cmd with <=, which feeds a design assign.",
    build: programReactiveScenario,
  },
  {
    id: "gclk-interleave",
    label: "Clock made with <=",
    summary: "A divider makes gclk with gclk <= ~gclk. On the same clk edge, flop a executes a <= d, and flop b runs on posedge gclk.",
    build: () => gclkScenario("generated"),
    prediction: gclkPrediction,
    outcomeGroups: true,
  },
  {
    id: "gclk-enable",
    label: "clk + enable",
    summary: "The same flops, with flop b on clk and an enable instead of a generated clock.",
    build: () => gclkScenario("enable"),
    prediction: gclkPrediction,
    outcomeGroups: true,
    modelNote: (scenario) =>
      `The model does not evaluate if. It runs b <= a on this edge because en is ${formatValue(scenario.initial.en)} when flop b reads it in Active, in every order: en <= ~en is applied later, in NBA (§4.9.4).`,
  },
];

/** Every preset the trace visualizer offers: the hash-pinned originals, then the extras. */
export const allTracePresets: TracePreset[] = [...schedulerScenarioPresets, ...traceExtraScenarioPresets];

export function getTracePreset(id: TraceScenarioId): TracePreset {
  const preset = allTracePresets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown trace scenario: ${id}`);
  return preset;
}

// ---------------------------------------------------------------------------
// Outcome groups and order labels, for the grouped-outcome cards.
// ---------------------------------------------------------------------------

export interface TraceOutcomeGroup {
  id: string;
  /** The final values that differ between groups, e.g. "b = 0". */
  title: string;
  runCount: number;
  /** The ▶ and ◆ events of the group's first run, in order. */
  lines: { text: string }[];
  endState: string;
  /** Choice vectors of every run in the group. */
  choices: number[][];
}

/** Groups every explored order by its result, each described by the events of its first run. */
export function traceOutcomeGroups(scenario: SvScenario, exploration: ExplorationResult): TraceOutcomeGroup[] {
  const differing = scenario.watch.filter((s) => new Set(exploration.outcomes.map((o) => formatValue(o.finalValues[s]))).size > 1);
  return exploration.outcomes.map((o, i) => {
    const folded = foldTimeSlot(scenario, simulateTimeSlot(scenario, o.runs[0].choices));
    return {
      id: `outcome-${i}`,
      title: differing.length ? differing.map((s) => `${s} = ${formatValue(o.finalValues[s])}`).join(", ") : "Every order",
      runCount: o.runs.length,
      lines: folded.events.filter((e) => e.kind === "evaluate" || e.kind === "update").map((e) => ({ text: `${e.glyph} ${e.label}` })),
      endState: scenario.watch.map((s) => `${s} = ${formatValue(o.finalValues[s])}`).join(", "),
      choices: o.runs.map((r) => r.choices),
    };
  });
}

/** Names a run by the scheduler choices it made, e.g. "always_ff first" or "divider first, then run flop b first". */
export function choiceLabel(run: SimulationResult): string {
  const picks = run.trace.filter((s) => s.kind === "choice" && s.choice).map((s) => `${s.choice?.picked} first`);
  return picks.length ? picks.join(", then ") : "the only order";
}
