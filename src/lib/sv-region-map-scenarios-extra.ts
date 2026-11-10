/**
 * Extra region-map presets for SVSchedulerRegionVisualizer.
 *
 * The base presets live in `sv-scheduler-scenarios.ts` (owned by the trace
 * visualizer's item); this file adds the F3B-only presets and gives every
 * preset the same shape: `build()` plus `predictions()`, a list of prompts
 * whose correct flags are computed from the model's trace, never hand-set.
 *
 * - 'program-watcher': programReactiveScenario plus a second program thread
 *   `@(cmd)`. After the Re-NBA update of cmd wakes both that thread and the
 *   design's `assign led = cmd`, the reactive set drains first (§4.5), so the
 *   watcher runs before the design assign and still sees led = 0.
 * - 'clocking-drive': the existing testbenchDriveScenario('clocking'), asked
 *   as region questions: the clocking drive lands in Re-NBA (§14.16) and the
 *   driver's `cb.q` is the Preponed sample (§14.13, §4.4.2.1).
 */

import { exploreOrderings, formatPrintValue, formatValue, type SimulationResult, type SvScenario } from "./sv-scheduler-model";
import { regionLandings, regionMapPrediction, type ModelPrediction } from "./sv-region-map-model";
import { programReactiveScenario, regionMapScenarioPresets, testbenchDriveScenario, type RegionMapScenarioId } from "./sv-scheduler-scenarios";

export type ExtraRegionMapScenarioId = "program-watcher" | "clocking-drive";
export type AnyRegionMapScenarioId = RegionMapScenarioId | ExtraRegionMapScenarioId;

export interface AnyRegionMapPreset {
  id: AnyRegionMapScenarioId;
  label: string;
  /** What the scenario is about, shown from the reveal on. It may name the answer. */
  summary: string;
  /** Shown instead of `summary` until the last prediction is committed, for a summary that names the answer. */
  setup?: string;
  build: () => SvScenario;
  /** One or more prediction prompts, graded from the run. */
  predictions: (scenario: SvScenario, result: SimulationResult) => ModelPrediction[];
}

/**
 * programReactiveScenario plus a program thread that waits on cmd. The cmd
 * update (Re-NBA, executed in Reactive) wakes the watcher into Reactive
 * (§24.3.1) and `assign led` into Active, since design processes wake in the
 * active region set (§24.3.2); the reactive loop finishes first (§4.5).
 */
export const programWatcherScenario = (): SvScenario => {
  const base = programReactiveScenario();
  return {
    ...base,
    id: "program-watcher",
    title: "A second program thread waits on cmd",
    processes: [
      ...base.processes,
      {
        id: "W",
        label: "watcher",
        owner: "testbench",
        context: "program",
        header: "initial forever @(cmd)",
        trigger: { kind: "change", signals: ["cmd"] },
        body: [{ kind: "display", id: "pw1", signals: ["cmd", "led"] }],
      },
    ],
  };
};

const wakeIndex = (result: SimulationResult, processId: string) => result.trace.findIndex((s) => s.kind === "wake" && s.processId === processId);

function programWatcherPredictions(scenario: SvScenario, result: SimulationResult): ModelPrediction[] {
  const watcher = wakeIndex(result, "W");
  const led = wakeIndex(result, "LED");
  const deterministic = exploreOrderings(scenario).deterministic;
  const bothRun = watcher >= 0 && led >= 0;
  // What the watcher's own print showed for led, read from the run rather than written down.
  const watcherPrint = result.trace.find((s) => s.kind === "print" && s.processId === "W");
  const ledSeen = watcherPrint ? ` That is why the watcher prints led = ${formatPrintValue(watcherPrint.values.led)}.` : "";
  return [
    {
      question: "`cmd <= 1` lands in Re-NBA. Its update wakes two processes: the program's `@(cmd)` watcher and the design's `assign led = cmd`. Which runs first?",
      options: [
        {
          id: "watcher",
          label: "The watcher: the reactive set drains completely before the loop returns to Active",
          correct: deterministic && bothRun && watcher < led,
          feedback: `The update of cmd executes inside the reactive loop. It wakes the watcher into Reactive (§24.3.1) and assign led into Active, because design processes woken by the reactive set wake in the active region set (§24.3.2). The scheduler keeps iterating Reactive, Re-Inactive and Re-NBA until all three are empty, and only then returns to Active (§4.5).${ledSeen}`,
        },
        {
          id: "design",
          label: "assign led = cmd: design code resumes as soon as a design signal changes",
          correct: deterministic && bothRun && led < watcher,
          feedback:
            "A design event does send the outer loop back to Active, but not yet: the reactive set must drain first (§4.5). The watcher is already queued in Reactive, so it runs before any Active pass.",
        },
        {
          id: "race",
          label: "Either, in any order: both are ready at the same moment, so it is a race",
          correct: !deterministic,
          feedback:
            "The watcher sits in Reactive and assign led in Active, so §4.5 fixes the order between them; a pair ready in one region could go either way (§4.7).",
        },
        {
          id: "next-slot",
          label: "Neither until the next clock edge: a Re-NBA update is only visible in the next time slot",
          correct: !bothRun,
          feedback:
            "Re-NBA is a region of this time slot (§4.4.2.8). Its update is an event like any other: it wakes the processes sensitive to cmd at once, and they run before time advances.",
        },
      ],
    },
  ];
}

function clockingDrivePredictions(scenario: SvScenario, result: SimulationResult): ModelPrediction[] {
  const landings = regionLandings(scenario, result);
  const dinUpdate = landings.find((l) => l.stmtId === "tb1" && l.kind === "update");
  const dinRegion = dinUpdate?.region;
  const initialQ = result.trace[0].values.q;
  const finalQ = result.finalValues.q;
  const seen = result.finalValues.seen;
  const driven = result.finalValues.din;
  // The din the DUT flop's `q <= din` read: nothing writes din before the Re-NBA drive, so it is din at that statement.
  const dutRead = result.trace.find((s) => s.kind === "statement" && s.stmtId === "dut1")?.values.din;
  const flopNote =
    dutRead === undefined
      ? ""
      : ` The DUT flop read din = ${formatValue(dutRead)} in Active long before that, so q becomes ${formatValue(finalQ)}${finalQ !== driven ? `, not ${formatValue(driven)}` : ""}.`;
  return [
    {
      question: "`cb.din <= 7;` is a clocking-block drive executed by module code. In which region does din change?",
      options: [
        {
          id: "active",
          label: "Active: the drive is executed there, so din changes at once",
          correct: dinRegion === "active",
          feedback: "A clocking drive is not a blocking write. The statement only schedules the update; the signal changes in Re-NBA (§14.16).",
        },
        {
          id: "nba",
          label: "NBA, like any <= executed by module code",
          correct: dinRegion === "nba",
          feedback:
            "That is where a plain din <= 7 from module code would land (§4.4.2.4). A zero-skew clocking drive is scheduled in Re-NBA whatever code executes it (§14.16), after the design NBA updates already queued for this edge.",
        },
        {
          id: "reNba",
          label: "Re-NBA, after the design NBA updates queued for this edge",
          correct: dinRegion === "reNba",
          feedback: `A zero-skew synchronous drive with no cycle delay schedules its update in the Re-NBA region of the same time step (§14.16).${flopNote}`,
        },
      ],
    },
    {
      question: "The driver then reads `cb.q` into seen. Which q does it get?",
      options: [
        {
          id: "sample",
          label: `${formatValue(initialQ)}: the Preponed sample (#1step)`,
          correct: seen === initialQ,
          feedback:
            "A clocking-block input with the default #1step skew returns the value sampled in Preponed, before anything in the slot changed (§14.13, §4.4.2.1). The flop's NBA update happened between the sample and the read, and does not show.",
        },
        {
          id: "new",
          label: `${formatValue(finalQ)}: the value after the flop's NBA update`,
          correct: seen === finalQ && finalQ !== initialQ,
          feedback:
            "That is what a plain read of q would see: @(cb) triggers in Observed (§14.10), after NBA. But cb.q is the #1step sample taken in Preponed (§14.13, §4.4.2.1), so the pre-edge value comes back.",
        },
        {
          id: "unknown",
          label: "X: cb.q is not valid until the next clocking event",
          correct: seen === "X",
          feedback: "The sample is taken at this clocking event, in Preponed (§14.13, §4.4.2.1), so it is valid as soon as the @(cb) process runs in the following Active pass.",
        },
      ],
    },
  ];
}

export const extraRegionMapScenarioPresets: AnyRegionMapPreset[] = [
  {
    id: "program-watcher",
    label: "program watcher",
    summary: "A second program thread waits on cmd. After the Re-NBA update, does it run before or after the design's assign led?",
    build: programWatcherScenario,
    predictions: programWatcherPredictions,
  },
  {
    id: "clocking-drive",
    label: "clocking drive",
    summary: "The driver writes cb.din and reads cb.q at the same edge the DUT flop samples din.",
    build: () => testbenchDriveScenario("clocking"),
    predictions: clockingDrivePredictions,
  },
];

/** The base summaries that state their own answer get a neutral sentence until the reveal. */
const BASE_SETUPS: Partial<Record<RegionMapScenarioId, string>> = {
  "comb-after-nba": "A flop's q feeds a continuous assignment, whose y feeds an always_comb.",
};

/** Every region-map preset the visualizer accepts, base presets first. */
export const allRegionMapScenarioPresets: AnyRegionMapPreset[] = [
  ...regionMapScenarioPresets.map((p) => ({ ...p, setup: BASE_SETUPS[p.id], predictions: (scenario: SvScenario, result: SimulationResult) => [regionMapPrediction(scenario, result)] })),
  ...extraRegionMapScenarioPresets,
];

export function isExtraRegionMapScenarioId(id: string): id is ExtraRegionMapScenarioId {
  return extraRegionMapScenarioPresets.some((p) => p.id === id);
}

export function getAnyRegionMapPreset(id: AnyRegionMapScenarioId): AnyRegionMapPreset {
  const preset = allRegionMapScenarioPresets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown region-map scenario: ${id}`);
  return preset;
}
