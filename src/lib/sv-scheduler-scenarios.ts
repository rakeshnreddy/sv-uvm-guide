import type { SvScenario } from "./sv-scheduler-model";

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
