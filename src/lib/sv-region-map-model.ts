/**
 * Region map and region quiz derived from the scheduler model.
 *
 * Nothing here decides *where* an event goes: every region, delta and output
 * comes from `simulateTimeSlot` in `sv-scheduler-model.ts`. This file only
 * (a) reads a trace and records the region each event was scheduled in, and
 * (b) turns chosen events into quiz questions whose answer key is that
 * recorded region, so the key cannot drift from the model.
 *
 * Region semantics (IEEE 1800-2023, verified against the standard's text):
 * - §4.4.2.1 Preponed: #1step samples, taken before anything changes.
 * - §4.4.2.2 Active / §4.4.2.6 Reactive: ready processes, any order.
 * - §4.4.2.3 Inactive / §4.4.2.7 Re-Inactive: processes resumed after #0.
 * - §4.4.2.4 NBA / §4.4.2.8 Re-NBA: nonblocking-assignment updates.
 * - §4.4.2.5 Observed: property evaluation; clocking-block events (§14.10).
 * - §4.4.2.9 Postponed: $strobe / $monitor; read-only.
 * - §4.5: events of a later region are moved into Active (or Reactive) and
 *   executed there; we report the region they were scheduled in.
 * - §24.3.1: program-block code runs in the reactive region set.
 */

import {
  REGION_LABELS,
  REGION_ORDER,
  exploreOrderings,
  formatValue,
  scenarioToSource,
  simulateTimeSlot,
  statementToSource,
  withZeroDelay,
  type RegionId,
  type SimulationResult,
  type Statement,
  type SvScenario,
  type SvValue,
  type TraceStep,
} from "./sv-scheduler-model";
import {
  combAfterNbaScenario,
  displayVsStrobeScenario,
  programReactiveScenario,
  shiftRegisterScenario,
  testbenchDriveScenario,
  zeroDelayPrintsScenario,
} from "./sv-scheduler-scenarios";

/** Sub-clause of IEEE 1800-2023 §4.4.2 that defines each region. */
export const REGION_CLAUSES: Record<RegionId, string> = {
  preponed: "§4.4.2.1",
  active: "§4.4.2.2",
  inactive: "§4.4.2.3",
  nba: "§4.4.2.4",
  observed: "§4.4.2.5",
  reactive: "§4.4.2.6",
  reInactive: "§4.4.2.7",
  reNba: "§4.4.2.8",
  postponed: "§4.4.2.9",
};

export type LandingKind = "sample" | "update" | "run" | "resume" | "statement" | "suspend" | "print" | "clocking-event";

export interface RegionLanding {
  stepIndex: number;
  /** Region the event was scheduled in. */
  region: RegionId;
  /** Region it executed in (moved events execute in Active or Reactive, §4.5). */
  executedIn: RegionId;
  delta: number;
  kind: LandingKind;
  label: string;
  processId?: string;
  stmtId?: string;
}

function findStatement(scenario: SvScenario, stmtId?: string): Statement | undefined {
  if (!stmtId) return undefined;
  for (const p of scenario.processes) {
    const s = p.body.find((x) => x.id === stmtId);
    if (s) return s;
  }
  return undefined;
}

const labelOf = (scenario: SvScenario, id?: string) => scenario.processes.find((p) => p.id === id)?.label ?? id ?? "";

/** The region an executed trace step was scheduled in. */
export function landingRegion(step: TraceStep): RegionId {
  if (step.kind === "slot-start") return "preponed";
  return step.sourceRegion ?? step.region;
}

/** One entry per scheduled event of the run, in execution order. */
export function regionLandings(scenario: SvScenario, result: SimulationResult): RegionLanding[] {
  const out: RegionLanding[] = [];
  for (const step of result.trace) {
    const base = { stepIndex: step.index, region: landingRegion(step), executedIn: step.region, delta: step.delta, processId: step.processId, stmtId: step.stmtId };
    const stmt = findStatement(scenario, step.stmtId);
    switch (step.kind) {
      case "slot-start":
        out.push({ ...base, kind: "sample", label: `sample ${scenario.watch.map((s) => `${s}=${formatValue(step.values[s])}`).join(" ")}` });
        break;
      case "update": {
        const target = step.changed[0] ?? (stmt && (stmt.kind === "assign" || stmt.kind === "cbDrive") ? stmt.target : undefined);
        const value = target ? formatValue(step.values[target]) : "";
        const from = stmt ? statementToSource(stmt) : `${scenario.clock} edge`;
        out.push({ ...base, kind: "update", label: target ? `${target} ← ${value} (${from})` : step.what });
        break;
      }
      case "wake":
        if (step.processId) {
          const resumed = base.region === "inactive" || base.region === "reInactive";
          out.push({ ...base, kind: resumed ? "resume" : "run", label: `${resumed ? "resume" : "run"} ${labelOf(scenario, step.processId)}` });
        } else {
          const cb = /@\((\w+)\)/.exec(step.what)?.[1] ?? "cb";
          out.push({ ...base, kind: "clocking-event", label: `@(${cb}) event triggers` });
        }
        break;
      case "statement":
        if (stmt) {
          const src = statementToSource(stmt);
          const note =
            stmt.kind === "assign" && stmt.op === "nba"
              ? "reads RHS, schedules update"
              : stmt.kind === "cbDrive"
                ? "schedules the drive"
                : stmt.kind === "strobe"
                  ? "queues the print"
                  : "writes now";
          out.push({ ...base, kind: "statement", label: `${src} ${note}` });
        }
        break;
      case "suspend":
        out.push({ ...base, kind: "suspend", label: `#0 suspends ${labelOf(scenario, step.processId)}` });
        break;
      case "print":
        out.push({ ...base, kind: "print", label: step.log[step.log.length - 1] ?? step.what });
        break;
      default:
        break;
    }
  }
  return out;
}

/** Landings grouped by the region they were scheduled in, in ladder order. */
export function groupLandingsByRegion(landings: RegionLanding[]): Record<RegionId, RegionLanding[]> {
  const out = Object.fromEntries(REGION_ORDER.map((r) => [r, [] as RegionLanding[]])) as Record<RegionId, RegionLanding[]>;
  landings.forEach((l) => out[l.region].push(l));
  return out;
}

// ---------------------------------------------------------------------------
// Source with program wrappers
// ---------------------------------------------------------------------------

export interface RegionMapLine {
  text: string;
  key?: string;
  owner?: "design" | "testbench";
  processId?: string;
}

export const headerKey = (processId: string) => `${processId}:header`;

/**
 * Scenario source as shown to learners. Program-context processes are
 * wrapped in `program tb; … endprogram`, derived from the model's `context`
 * field, so the wrapper cannot disagree with the scheduling the model applies.
 */
export function regionMapSource(scenario: SvScenario): RegionMapLine[] {
  const lines: RegionMapLine[] = [];
  let inProgram = false;
  scenario.processes.forEach((process, index) => {
    const isProgram = process.context === "program";
    if (inProgram && !isProgram) {
      lines.push({ text: "endprogram", owner: "testbench" });
      inProgram = false;
    }
    if (index > 0) lines.push({ text: "" });
    if (isProgram && !inProgram) {
      lines.push({ text: "program tb;", owner: "testbench" });
      inProgram = true;
    }
    const indent = isProgram ? "  " : "";
    const own = scenarioToSource({ ...scenario, processes: [process] });
    own.forEach((line, i) => {
      lines.push({
        text: `${indent}${line.text}`,
        key: line.stmtId ?? (i === 0 ? headerKey(process.id) : `${process.id}:${i}`),
        owner: process.owner,
        processId: process.id,
      });
    });
  });
  if (inProgram) lines.push({ text: "endprogram", owner: "testbench" });
  return lines;
}

// ---------------------------------------------------------------------------
// Predictions for the F3B region map (correct flags computed from the model)
// ---------------------------------------------------------------------------

export interface ModelOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface ModelPrediction {
  question: string;
  options: ModelOption[];
}

/** Log a run would print if every print used `values` instead of the real ones. */
function logWith(result: SimulationResult, scenario: SvScenario, pick: (step: TraceStep, index: number) => Record<string, SvValue>): string[] {
  const out: string[] = [];
  result.trace.forEach((step, i) => {
    if (step.kind !== "print") return;
    const stmt = findStatement(scenario, step.stmtId);
    if (!stmt || (stmt.kind !== "display" && stmt.kind !== "strobe")) return;
    const values = pick(step, i);
    out.push(`$${stmt.kind}: ${stmt.signals.map((s) => `${s}=${formatValue(values[s])}`).join(" ")}`);
  });
  return out;
}

/**
 * Output-order question: the correct log comes from the model; distractors
 * re-evaluate the same prints under a named misconception.
 */
export function outputOrderOptions(scenario: SvScenario, result: SimulationResult = simulateTimeSlot(scenario)): ModelOption[] {
  const actual = result.log;
  const initial = result.trace[0].values;
  const final = result.finalValues;
  const firstSuspend = result.trace.findIndex((s) => s.kind === "suspend");
  const candidates: { id: string; log: string[]; feedback: string }[] = [
    {
      id: "model",
      log: actual,
      feedback:
        "$display prints immediately, and a #0 resume runs in Inactive, which still comes before NBA (§4.4.2.3, §4.4.2.4). Only $strobe waits for Postponed, after every update of the slot (§4.4.2.9, §21.2.2).",
    },
    {
      id: "zero-waits-for-nba",
      log: logWith(result, scenario, (step, i) => (firstSuspend >= 0 && i > firstSuspend ? final : step.values)),
      feedback: "#0 does not wait for nonblocking updates. It resumes the process in Inactive, and Inactive is drained before the NBA region (§4.4.2.3).",
    },
    {
      id: "all-settled",
      log: logWith(result, scenario, () => final),
      feedback: "$display does not wait for anything: it prints the values visible at the moment it executes, before the NBA update of q.",
    },
    {
      id: "all-old",
      log: logWith(result, scenario, () => initial),
      feedback: "$strobe is deferred to Postponed, after the NBA update, so it prints the settled value (§21.2.2). Only the immediate prints see the old q.",
    },
  ];
  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      const key = c.log.join(" | ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({ id: c.id, label: c.log.join("  →  "), correct: c.log.join("|") === actual.join("|"), feedback: c.feedback }));
}

export function regionMapPrediction(scenario: SvScenario, result: SimulationResult): ModelPrediction {
  const landings = regionLandings(scenario, result);
  if (scenario.id === "comb-after-nba") {
    const run = landings.find((l) => l.processId === "CA" && l.kind === "run");
    return {
      question: "q changes in the NBA region. Where does `assign y = q;` run after that?",
      options: [
        {
          id: "active-again",
          label: "Back in Active, in a second pass of the same time slot",
          correct: Boolean(run && run.region === "active" && run.delta > 0),
          feedback:
            "The update of q is an event in its own right: it wakes everything sensitive to q, and the scheduler returns from NBA to Active within the same simulation time (§4.5, §4.9.1). Each return is one more delta.",
        },
        {
          id: "nba",
          label: "In NBA, together with the update of q",
          correct: run?.region === "nba",
          feedback: "NBA only applies the scheduled updates. Processes woken by those updates are scheduled in Active, so they run after the scheduler moves back there.",
        },
        {
          id: "next-slot",
          label: "At the next clock edge",
          correct: !run,
          feedback: "Combinational logic does not wait for a clock: y follows q in the same time slot, only in a later delta. A waveform viewer draws it at the same instant.",
        },
        {
          id: "observed",
          label: "In Observed, after all design updates",
          correct: run?.region === "observed",
          feedback: "Observed evaluates properties and triggers clocking events. Design logic never runs there.",
        },
      ],
    };
  }
  if (scenario.id === "program-reactive") {
    const seen = result.finalValues.seen;
    const newQ = result.finalValues.q;
    const oldQ = scenario.initial.q;
    const deterministic = exploreOrderings(scenario).deterministic;
    return {
      question: "The DUT flop and the program thread wake on the same edge. What does the program read into `seen`?",
      options: [
        {
          id: "new",
          label: `${formatValue(newQ)}: the new q`,
          correct: deterministic && seen === newQ,
          feedback: "Program code runs in the Reactive region (§24.3.1), which starts only after the active region set, including NBA, is empty. The flop's update has already landed.",
        },
        {
          id: "old",
          label: `${formatValue(oldQ)}: the value before the edge`,
          correct: deterministic && seen === oldQ && newQ !== oldQ,
          feedback: "That is what a clocking-block input (`cb.q`) would return: it reads the Preponed sample (§14.13). A plain read in program code sees the current value.",
        },
        {
          id: "race",
          label: "It depends on process order: a race",
          correct: !deterministic,
          feedback: "The flop (active set) and the program (reactive set) never share a region, so no order choice exists between them. That separation is what program blocks were for.",
        },
      ],
    };
  }
  return { question: "What does the log show, in order?", options: outputOrderOptions(scenario, result) };
}

// ---------------------------------------------------------------------------
// Region quiz (EventRegionGame)
// ---------------------------------------------------------------------------

export interface RegionQuizQuestionBase {
  id: string;
  scenarioId: string;
  title: string;
  code: RegionMapLine[];
  /** Key of the line the question is about. */
  focusKey?: string;
  prompt: string;
}

export interface RegionQuestion extends RegionQuizQuestionBase {
  type: "region";
  answer: RegionId;
  /** The model's own explanation for the step. */
  why: string;
  delta: number;
}

export interface OutputQuestion extends RegionQuizQuestionBase {
  type: "output";
  options: ModelOption[];
  why: string;
}

export type RegionQuizQuestion = RegionQuestion | OutputQuestion;

interface RegionTarget {
  id: string;
  build: () => SvScenario;
  prompt: string;
  /** Picks the landing the question is about. Must match exactly one event. */
  select: (landings: RegionLanding[], scenario: SvScenario) => RegionLanding | undefined;
  focus?: (scenario: SvScenario) => string | undefined;
}

const byStmt = (stmtId: string, kind: LandingKind) => (ls: RegionLanding[]) => ls.find((l) => l.stmtId === stmtId && l.kind === kind);

/**
 * Which events the game asks about. Only the event is chosen here; the
 * region answer is always read from the model's trace.
 */
const REGION_TARGETS: RegionTarget[] = [
  {
    id: "blocking-write",
    build: () => shiftRegisterScenario("blocking"),
    prompt: "Stage A executes `q1 = d;`. In which region is q1 written?",
    select: byStmt("a1", "statement"),
  },
  {
    id: "nba-update",
    build: () => shiftRegisterScenario("nba"),
    prompt: "With `q1 <= d;`, in which region does q1 actually change?",
    select: byStmt("a1", "update"),
  },
  {
    id: "zero-delay-resume",
    build: () => withZeroDelay(shiftRegisterScenario("blocking"), "B", true),
    prompt: "Stage B starts with `#0;`. In which region does it resume?",
    select: (ls) => ls.find((l) => l.processId === "B" && l.kind === "resume"),
    focus: () => "B-d0",
  },
  {
    id: "strobe",
    build: displayVsStrobeScenario,
    prompt: "Where does the `$strobe` line print?",
    select: byStmt("p3", "print"),
  },
  {
    id: "cb-sample",
    build: () => testbenchDriveScenario("clocking"),
    prompt: "The driver reads `cb.q` (default input skew #1step). In which region was the value it gets sampled?",
    select: (ls, scenario) => {
      // A clocking-block input reads the Preponed snapshot (§14.13); the model
      // evaluates `sampled` expressions from that snapshot.
      const stmt = findStatement(scenario, "tb2");
      const reads = stmt && stmt.kind === "assign" && stmt.expr.kind === "sampled";
      return reads ? ls.find((l) => l.kind === "sample") : undefined;
    },
    focus: () => "tb2",
  },
  {
    id: "cb-event",
    build: () => testbenchDriveScenario("clocking"),
    prompt: "The driver waits on `@(cb)`. In which region is that clocking event triggered?",
    select: (ls) => ls.find((l) => l.kind === "clocking-event"),
    focus: () => headerKey("TB"),
  },
  {
    id: "cb-drive",
    build: () => testbenchDriveScenario("clocking"),
    prompt: "`cb.din <= 7;` drives through the clocking block (output skew #0). In which region does din change?",
    select: byStmt("tb1", "update"),
  },
  {
    id: "program-code",
    build: programReactiveScenario,
    prompt: "The program thread executes `seen = q;`. In which region?",
    select: byStmt("pr3", "statement"),
  },
  {
    id: "program-zero-delay",
    build: () => withZeroDelay(programReactiveScenario(), "TB", true),
    prompt: "The program thread now starts with `#0;`. In which region does it resume?",
    select: (ls) => ls.find((l) => l.processId === "TB" && l.kind === "resume"),
    focus: () => "TB-d0",
  },
  {
    id: "nba-rhs",
    build: () => shiftRegisterScenario("nba"),
    prompt: "With `q1 <= d;`, in which region is the right-hand side d read?",
    select: byStmt("a1", "statement"),
  },
  {
    id: "comb-after-nba",
    build: combAfterNbaScenario,
    prompt: "q changes in NBA. In which region does `assign y = q;` then run?",
    select: (ls) => ls.find((l) => l.processId === "CA" && l.kind === "run"),
    focus: () => "ca1",
  },
];

export function buildRegionQuestion(target: RegionTarget): RegionQuestion {
  const scenario = target.build();
  const result = simulateTimeSlot(scenario);
  const landings = regionLandings(scenario, result);
  const landing = target.select(landings, scenario);
  if (!landing) throw new Error(`Region quiz target ${target.id} matched no event in ${scenario.id}`);
  const step = result.trace[landing.stepIndex];
  return {
    type: "region",
    id: target.id,
    scenarioId: scenario.id,
    title: scenario.title,
    code: regionMapSource(scenario),
    focusKey: target.focus?.(scenario) ?? landing.stmtId,
    prompt: target.prompt,
    answer: landing.region,
    why: step.why,
    delta: landing.delta,
  };
}

/** The full game, in play order. The first answer is Active. */
export function buildRegionQuiz(): RegionQuizQuestion[] {
  const regionQuestions = REGION_TARGETS.map(buildRegionQuestion);
  const prints = zeroDelayPrintsScenario();
  const output: OutputQuestion = {
    type: "output",
    id: "print-order",
    scenarioId: prints.id,
    title: prints.title,
    code: regionMapSource(prints),
    prompt: "This process runs once at the clock edge (d = 5, q = 0 before it). What does the log show, in order?",
    options: outputOrderOptions(prints),
    why: "Read the prints against the ladder: Active, then Inactive (after #0), then NBA updates q, then Postponed.",
  };
  return [...regionQuestions, output];
}

export const regionLabel = (r: RegionId) => REGION_LABELS[r];
