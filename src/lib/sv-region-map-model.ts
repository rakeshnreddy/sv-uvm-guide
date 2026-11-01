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
 * - §16.5.1 / §4.4.2.5 / §4.4.2.6: a concurrent assertion samples in
 *   Preponed, is evaluated in Observed and runs its action block in Reactive.
 * - §20.2 / §24.3 / §9.2.3: $finish (explicit or implicit) ends the run; no
 *   later region of the slot executes.
 *
 * `regionDecisions` turns a trace into the points where the loop of §4.5 had
 * to choose where to go next (the "next-region" mode of the visualizer); the
 * answer key is read from the trace, never written by hand.
 */

import {
  ACTIVE_SET,
  REACTIVE_SET,
  REGION_LABELS,
  REGION_ORDER,
  exploreOrderings,
  findProcessStatement,
  formatPrintValue,
  formatValue,
  processStatements,
  scenarioToSource,
  simulateTimeSlot,
  statementToSource,
  withZeroDelay,
  type Expr,
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

export type LandingKind =
  | "sample"
  | "update"
  | "run"
  | "resume"
  | "statement"
  | "suspend"
  | "print"
  | "clocking-event"
  /** A concurrent assertion's Preponed sample (§16.5.1). */
  | "assert-sample"
  /** Its property evaluation, scheduled in Observed (§4.4.2.5). */
  | "assert-eval"
  /** Its pass/fail action block, scheduled in Reactive (§4.4.2.6). */
  | "assert-action"
  /** $finish, explicit (§20.2) or implicit at the end of the last program thread (§24.3). */
  | "finish";

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

const findStatement = (scenario: SvScenario, stmtId?: string): Statement | undefined => findProcessStatement(scenario, stmtId);

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
      case "sample":
        if (step.assertion?.phase === "sample") {
          out.push({ ...base, kind: "assert-sample", label: step.what.replace(/\.$/, "") });
        }
        break;
      case "update": {
        const target = step.changed[0] ?? (stmt && (stmt.kind === "assign" || stmt.kind === "cbDrive") ? stmt.target : undefined);
        const value = target ? formatValue(step.values[target]) : "";
        const from = stmt ? statementToSource(stmt) : `${scenario.clock} edge`;
        out.push({ ...base, kind: "update", label: target ? `${target} ← ${value} (${from})` : step.what });
        break;
      }
      case "wake":
        if (step.assertion?.phase === "action") {
          out.push({ ...base, kind: "assert-action", label: `${labelOf(scenario, step.processId)} ${step.assertion.outcome ?? ""} action ${base.region === "reInactive" ? "resumes" : "runs"}`.replace(/\s+/g, " ") });
        } else if (step.processId) {
          const resumed = base.region === "inactive" || base.region === "reInactive";
          out.push({ ...base, kind: resumed ? "resume" : "run", label: `${resumed ? "resume" : "run"} ${labelOf(scenario, step.processId)}` });
        } else {
          const cb = /@\((\w+)\)/.exec(step.what)?.[1] ?? "cb";
          out.push({ ...base, kind: "clocking-event", label: `@(${cb}) event triggers` });
        }
        break;
      case "statement":
        if (step.assertion?.phase === "evaluate") {
          out.push({ ...base, kind: "assert-eval", label: `evaluate ${labelOf(scenario, step.processId)}: ${step.assertion.outcome ?? "?"}` });
        } else if (step.endedBy) {
          out.push({ ...base, kind: "finish", label: step.endedBy === "finish" ? "$finish" : `implicit $finish (${labelOf(scenario, step.processId)} was the last program thread)` });
        } else if (stmt) {
          const src = statementToSource(stmt);
          const note =
            stmt.kind === "assign" && stmt.op === "nba"
              ? "reads RHS, schedules update"
              : stmt.kind === "cbDrive"
                ? "schedules the drive"
                : stmt.kind === "strobe"
                  ? "queues the print"
                  : stmt.kind === "check" || stmt.kind === "assertcontrol"
                    ? "recorded"
                    : "writes now";
          out.push({ ...base, kind: "statement", label: `${src} ${note}` });
        }
        break;
      case "suspend":
        out.push({ ...base, kind: "suspend", label: stmt?.kind === "delay" ? `#${stmt.units} suspends ${labelOf(scenario, step.processId)} until a later slot` : `#0 suspends ${labelOf(scenario, step.processId)}` });
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
// Where does the loop go next? (next-region mode)
// ---------------------------------------------------------------------------

/** What Δ counts. IEEE 1800-2023 defines no delta count, so this is the model's own measure. */
export const DELTA_DEFINITION = "the model's count of times a later region's events (Inactive, NBA, Observed, Re-Inactive, Re-NBA) moved up into Active or Reactive";

/** Where the §4.5 loop can go once the region it was executing is empty. */
export type NextRegionAnswer = "inactive" | "nba" | "observed" | "reactive-set" | "reInactive" | "reNba" | "active" | "postponed" | "end";

export interface NextRegionOption {
  id: NextRegionAnswer;
  label: string;
}

/**
 * Fixed option list, so the choices on offer never hint at the answer. §4.5
 * runs Postponed once per slot even when it is empty, so plain "Postponed" and
 * "The slot ends" would both be defensible there; the two labels say what each
 * option claims about the Postponed queue, and the queue chips settle it.
 */
export const NEXT_REGION_OPTIONS: NextRegionOption[] = [
  { id: "inactive", label: "Inactive" },
  { id: "nba", label: "NBA" },
  { id: "observed", label: "Observed" },
  { id: "reactive-set", label: "The reactive set (Reactive)" },
  { id: "reInactive", label: "Re-Inactive" },
  { id: "reNba", label: "Re-NBA" },
  { id: "active", label: "Back to Active" },
  { id: "postponed", label: "Postponed, which has output to print" },
  { id: "end", label: "Postponed is empty: the slot ends" },
];

/**
 * The options for a run. A run ended by $finish can stop with Postponed still
 * holding output, so its 'end' option cannot claim that Postponed is empty.
 */
export function nextRegionOptions(result: SimulationResult): NextRegionOption[] {
  if (!result.finished) return NEXT_REGION_OPTIONS;
  return NEXT_REGION_OPTIONS.map((o) => (o.id === "end" ? { ...o, label: "No scheduled event runs: the simulation ends" } : o));
}

export interface RegionDecision {
  /** Index of the first trace step after the decision (a move, or the first step of the new region). */
  index: number;
  /** The region that had just run dry. */
  from: "active" | "reactive";
  answer: NextRegionAnswer;
  /**
   * Set when the loop changed region set and the new set's home region is
   * empty, so its later region moves at once (§4.5). Naming the set is as
   * right as naming the region: one decision, either answer is correct.
   */
  alsoCorrect?: "reactive-set" | "active";
  /**
   * Set when nothing ran dry: an update applied in the reactive loop left work
   * in both Reactive and Active, and the loop has to pick (§4.5, §24.3.1).
   */
  priority?: boolean;
  /** Δ after the decision; see DELTA_DEFINITION. Only a decision that moves events raises it. */
  delta: number;
}

type Segment = "preponed" | "active" | "reactive" | "postponed" | "end";

function segmentOf(step: TraceStep): Segment {
  if (step.kind === "slot-start" || step.kind === "sample") return "preponed";
  if (step.kind === "slot-end") return "end";
  if (step.kind === "move") return REACTIVE_SET.includes(step.region) ? "reactive" : "active";
  if (step.region === "postponed") return "postponed";
  if (REACTIVE_SET.includes(step.region)) return "reactive";
  return "active";
}

const MOVE_ANSWERS: Partial<Record<RegionId, NextRegionAnswer>> = { inactive: "inactive", nba: "nba", observed: "observed", reInactive: "reInactive", reNba: "reNba" };

/**
 * The points in a run where the executing region was empty and the loop of
 * §4.5 chose where to go: a move from a later region of the same set, the
 * switch from the active set to the reactive set, the return to Active after
 * the reactive set drained, Postponed, or the end of the slot. A switch whose
 * first step is a move is one decision (see `alsoCorrect`). After Postponed
 * only the slot end can follow, so that step asks nothing. One point is not a
 * dry region: an update in the reactive loop that leaves ready work in both
 * Reactive and Active is a real priority choice (see `priority`).
 */
export function regionDecisions(result: SimulationResult): RegionDecision[] {
  const out: RegionDecision[] = [];
  const trace = result.trace;
  for (let i = 1; i < trace.length; i += 1) {
    const step = trace[i];
    const before = trace[i - 1];
    const prev = segmentOf(before);
    const cur = segmentOf(step);
    if (prev === "preponed") continue;
    const reactiveHead = before.queues.reactive[0];
    if (prev === "reactive" && cur === "reactive" && before.kind === "update" && before.queues.active.length > 0 && reactiveHead && reactiveHead.kind !== "update") {
      out.push({ index: i, from: "reactive", answer: "reactive-set", priority: true, delta: step.delta });
      continue;
    }
    const from: RegionDecision["from"] = prev === "reactive" ? "reactive" : "active";
    const crossing: RegionDecision["alsoCorrect"] = cur === "reactive" && prev === "active" ? "reactive-set" : cur === "active" && prev === "reactive" ? "active" : undefined;
    const moved = step.kind === "move" ? MOVE_ANSWERS[step.region] : undefined;
    if (moved) out.push({ index: i, from, answer: moved, ...(crossing ? { alsoCorrect: crossing } : {}), delta: step.delta });
    else if (crossing) out.push({ index: i, from, answer: crossing, delta: step.delta });
    else if (cur !== prev && cur === "postponed") out.push({ index: i, from, answer: "postponed", delta: step.delta });
    else if (cur !== prev && cur === "end" && prev !== "postponed") out.push({ index: i, from, answer: "end", delta: step.delta });
  }
  return out;
}

/** Whether picking `option` at `decision` is graded correct. */
export function isDecisionAnswer(decision: RegionDecision, option: NextRegionAnswer): boolean {
  return option === decision.answer || option === decision.alsoCorrect;
}

const finishName = (result: SimulationResult) => (result.finished?.cause === "implicit-finish" ? "the implicit $finish" : "$finish");

const capitalized = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}`;

/** The question asked at a decision; step numbers count from 1, as the scrubber does. */
export function decisionQuestion(decision: RegionDecision, result: SimulationResult): string {
  if (decision.answer === "end" && result.finished) return `${capitalized(finishName(result))} executed in step ${result.finished.stepIndex + 1}. What runs next?`;
  if (decision.priority) return `Active and Reactive both hold work after step ${decision.index}. Which runs next?`;
  return `${REGION_LABELS[decision.from]} is empty after step ${decision.index}. Where does the scheduler go next?`;
}

/** The region an option stands for, when it is one. */
const optionRegion: Partial<Record<NextRegionAnswer, RegionId>> = {
  inactive: "inactive",
  nba: "nba",
  observed: "observed",
  "reactive-set": "reactive",
  reInactive: "reInactive",
  reNba: "reNba",
  active: "active",
  postponed: "postponed",
};

/** Whether this decision moves a later region's events up, which is the only thing that raises Δ. */
export function decisionMovesEvents(decision: RegionDecision): boolean {
  return Object.values(MOVE_ANSWERS).includes(decision.answer);
}

function deltaSentence(decision: RegionDecision): string {
  const n = decision.delta;
  if (decisionMovesEvents(decision)) return `Δ is now ${n}: ${DELTA_DEFINITION} (IEEE 1800-2023 defines no delta count).`;
  if (decision.priority) return `Δ stays at ${n}: Reactive already holds this work, so nothing moves.`;
  if (decision.answer === "reactive-set") return `Δ stays at ${n}: a set switch moves no events.`;
  if (decision.answer === "active") return `Δ stays at ${n}: Active already holds this work, so nothing moves.`;
  return `Δ stays at ${n}: nothing moves.`;
}

/** One line for the revealed decision: the number, and whether this decision changed it. */
export function decisionDeltaSummary(decision: RegionDecision): string {
  return decisionMovesEvents(decision) ? "up by one, because events moved" : "unchanged, because no events moved";
}

/** Paraphrase of the §4.5 step that produced `decision` (never the standard's wording). */
export function explainDecision(decision: RegionDecision, result: SimulationResult): string {
  const home = decision.from === "active" ? "Active" : "Reactive";
  const deltaNote = deltaSentence(decision);
  const finished = result.finished;
  const movedRegion = optionRegion[decision.answer];
  if (decision.priority) {
    return `The update woke a process into Reactive and a design process into Active. The scheduler is inside the reactive loop, and that loop runs until Reactive, Re-Inactive and Re-NBA are all empty, so Reactive runs next and Active waits for the outer loop (§4.5, §24.3.1). ${deltaNote}`;
  }
  if (decision.alsoCorrect === "reactive-set" && movedRegion) {
    return `The active region set and Observed were all empty, so the scheduler turned to the reactive set. Reactive itself holds nothing, so ${REGION_LABELS[movedRegion]}, the first region of that set with events, moves into Reactive and executes there (${REGION_CLAUSES[movedRegion]}${movedRegion === "reNba" ? ", §14.16" : ""}, §4.5). ${deltaNote}`;
  }
  if (decision.alsoCorrect === "active" && movedRegion) {
    return `The reactive set has drained, so the outer loop returns to the active set in the same time slot. Active itself holds nothing, so ${REGION_LABELS[movedRegion]}, the first region of that set with events, moves into Active and executes there (${REGION_CLAUSES[movedRegion]}, §4.5). ${deltaNote}`;
  }
  switch (decision.answer) {
    case "inactive":
      return `${home} ran dry, so the loop looked down the ladder for the first region that still holds events and found Inactive. The processes that executed #0 move up into Active and resume there, before any NBA update is applied (§4.4.2.3, §4.5). ${deltaNote}`;
    case "nba":
      return `Active and Inactive were both empty, and NBA is the first region with events. Its updates move into Active and are applied in the order they were scheduled (§4.5, §4.6); design processes they wake run in Active; program code runs in Reactive (§24.3.1). ${deltaNote}`;
    case "observed":
      return `Everything from Active to NBA was empty, so the Observed events are next: property evaluations and clocking-block events move into Active and execute there (§4.4.2.5, §14.10, §4.5). ${deltaNote}`;
    case "reactive-set":
      return `The active region set and Observed were all empty. The scheduler turns to the reactive set and keeps iterating Reactive, Re-Inactive and Re-NBA until all three are empty; only then can it look at Active again (§4.5, §4.4.2.6). ${deltaNote}`;
    case "reInactive":
      return `Reactive ran dry and Re-Inactive holds the program code that executed #0. It moves into Reactive and resumes there, before any Re-NBA update (§4.4.2.7, §4.5). ${deltaNote}`;
    case "reNba":
      return `Reactive and Re-Inactive were empty, so the Re-NBA updates (program-code <= and clocking-block drives) move into Reactive and are applied there (§4.4.2.8, §14.16, §4.5). ${deltaNote}`;
    case "active":
      return `The reactive set has drained, but Active holds work again: an update in the reactive set woke design processes. The outer loop therefore returns to Active in the same time slot (§4.5). ${deltaNote}`;
    case "postponed":
      return `No region from Active to Re-NBA holds anything, so the slot's last region runs once: $strobe and $monitor print the settled values, and nothing may write any more (§4.4.2.9). ${deltaNote}`;
    case "end":
      return finished
        ? `${capitalized(finishName(result))} ended the run inside the slot: after the final procedures, no remaining event executes, so the regions below never run (§20.2, §24.3, §9.2.3). ${deltaNote}`
        : `Nothing is left in any region, Postponed included, so the time slot is complete and simulation time moves to the next slot that has events (§4.5). ${deltaNote}`;
  }
}

/** Why a wrong option is wrong at this decision, read from the queues of the step before it. */
export function decisionFeedback(decision: RegionDecision, option: NextRegionAnswer, result: SimulationResult): string {
  if (isDecisionAnswer(decision, option)) return explainDecision(decision, result);
  const before = result.trace[Math.max(0, decision.index - 1)];
  const queued = (r: RegionId) => before.queues[r].length;
  const region = optionRegion[option];
  const answerRegion = optionRegion[decision.answer];
  const answerName = answerRegion ? REGION_LABELS[answerRegion] : "The slot end";
  /** What keeps the loop from going where `option` says. */
  const answerHolds = decision.answer === "active" ? "Active holds a design process woken by reactive code" : `${answerName} still holds events`;
  const activeSetPending = ACTIVE_SET.filter((r) => r !== "active" && queued(r) > 0).map((r) => REGION_LABELS[r]);
  if (decision.priority && option === "active") {
    return "Active does hold work, but the scheduler is still inside the reactive loop. It returns to Active only once Reactive, Re-Inactive and Re-NBA are all empty (§4.5).";
  }
  if (decision.answer === "end" && result.finished) {
    const name = finishName(result);
    if (option === "postponed") {
      return queued("postponed") > 0 ? `$strobe was queued, but ${name} ends the run before Postponed (§9.2.3).` : `Postponed does not run: ${name} ends the run before it (§9.2.3).`;
    }
    if (region && queued(region) > 0) return `${REGION_LABELS[region]} still holds events, but they never execute: after ${name} and the final procedures, no remaining scheduled event executes (§9.2.3).`;
    return `${capitalized(name)} ended the run, so the loop looks at no further region (§20.2, §9.2.3).`;
  }
  if (option === "end") {
    if (decision.answer === "postponed") return "The slot is not over: Postponed still has output to print, and it runs once after every other region is empty (§4.4.2.9).";
    return `The slot cannot end while ${answerHolds}; time only advances once every region is empty (§4.5).`;
  }
  if (option === "postponed") {
    if (decision.answer === "end") return "Postponed has nothing queued here (no $strobe or $monitor), so the slot simply ends.";
    return `Postponed runs only once every region from Active to Re-NBA is empty; ${answerHolds} (§4.5).`;
  }
  if (option === "active") {
    if (decision.alsoCorrect === "reactive-set" || decision.answer === "reactive-set") {
      return "Active is empty, and so are Inactive, NBA and Observed. Nothing sends the loop back to Active until the reactive set has run and created a design event (§4.5).";
    }
    if (decision.answer === "postponed" || decision.answer === "end") return "Nothing is pending from Active to Re-NBA, so there is no reason to return to Active.";
    if (decision.from === "reactive") {
      return `Reactive ran dry, but the reactive set is not finished: ${answerName} still holds events, and the loop only returns to Active once Reactive, Re-Inactive and Re-NBA are all empty (§4.5).`;
    }
    return `Active is the region that just ran dry; the loop looks for the first later region of the set that still holds events, which is ${answerName} (§4.5).`;
  }
  if (option === "reactive-set" && decision.from === "active") {
    if (activeSetPending.length === 0) {
      return "The active set is empty, but so is the whole reactive set: nothing is queued in Reactive, Re-Inactive or Re-NBA, so that loop has nothing to run (§4.5).";
    }
    return `The reactive set starts only once Active, Inactive, NBA and Observed are all empty; ${activeSetPending.join(" and ")} still ${activeSetPending.length === 1 ? "holds" : "hold"} events (§4.5).`;
  }
  if ((option === "reInactive" || option === "reNba") && decision.answer === "reactive-set" && !decision.priority) {
    return "The reactive set is entered through Reactive itself; Re-Inactive and Re-NBA come only after Reactive is empty (§4.5).";
  }
  if (region && queued(region) === 0) {
    return `${REGION_LABELS[region]} holds no events at this point. The loop only stops at a region that has something queued (§4.5).`;
  }
  if (region && REACTIVE_SET.includes(region) && decision.from === "active" && !(answerRegion && REACTIVE_SET.includes(answerRegion))) {
    return `${REGION_LABELS[region]} belongs to the reactive set, which waits until the whole active set is empty; ${answerName} comes first (§4.5).`;
  }
  return `${answerName} comes first: the loop takes the earliest region of the set that still holds events (§4.5).`;
}

const DECISION_PATH_LABELS: Record<NextRegionAnswer, string> = {
  inactive: REGION_LABELS.inactive,
  nba: REGION_LABELS.nba,
  observed: REGION_LABELS.observed,
  "reactive-set": REGION_LABELS.reactive,
  reInactive: REGION_LABELS.reInactive,
  reNba: REGION_LABELS.reNba,
  active: REGION_LABELS.active,
  postponed: REGION_LABELS.postponed,
  end: "slot end",
};

/** The route the loop took through a run's decisions, starting in Active. */
export function decisionPath(decisions: RegionDecision[]): string {
  return ["Active", ...decisions.map((d) => DECISION_PATH_LABELS[d.answer])].join(" → ");
}

/** The closing line of next-region mode. */
export function decisionRecap(decisions: RegionDecision[], correct: number): string {
  return `${correct} of ${decisions.length} right; the loop went ${decisionPath(decisions)}.`;
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

/** Clockvars `clocking` reads in an expression: its inputs. */
function clockvarsRead(expr: Expr, clocking: string): string[] {
  switch (expr.kind) {
    case "sampled":
      return expr.clocking === clocking ? [expr.name] : [];
    case "inv":
      return clockvarsRead(expr.expr, clocking);
    case "eq":
      return [...clockvarsRead(expr.left, clocking), ...clockvarsRead(expr.right, clocking)];
    default:
      return [];
  }
}

/**
 * The clocking blocks a scenario declares, with directions derived from how its
 * statements use each clockvar and the default skews of §14.3, so the
 * declaration cannot disagree with what the model does with `cb.x`.
 */
function clockingDeclarationLines(scenario: SvScenario): RegionMapLine[] {
  const statements = scenario.processes.flatMap(processStatements);
  return (scenario.clockings ?? []).flatMap((cb) => {
    const reads = statements.flatMap((stmt) => {
      if (stmt.kind === "assign" || stmt.kind === "cbDrive") return clockvarsRead(stmt.expr, cb.name);
      if (stmt.kind === "display" || stmt.kind === "strobe") return (stmt.args ?? []).flatMap((a) => clockvarsRead(a.expr, cb.name));
      return [];
    });
    const drives = statements.flatMap((stmt) => (stmt.kind === "cbDrive" && stmt.clocking === cb.name ? [stmt.target] : []));
    const inner = [...[...new Set(reads)].map((name) => `input ${name};  // default skew #1step`), ...[...new Set(drives)].map((name) => `output ${name};  // default skew #0`)];
    return [`clocking ${cb.name} @(posedge ${cb.clock});`, ...inner.map((line) => `  ${line}`), "endclocking", ""].map((text) => ({ text, ...(text ? { owner: "testbench" as const } : {}) }));
  });
}

/**
 * Scenario source as shown to learners. Program-context processes are
 * wrapped in `program tb; … endprogram`, derived from the model's `context`
 * field, so the wrapper cannot disagree with the scheduling the model applies.
 */
export function regionMapSource(scenario: SvScenario): RegionMapLine[] {
  const lines: RegionMapLine[] = clockingDeclarationLines(scenario);
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
    out.push(`$${stmt.kind}: ${stmt.signals.map((s) => `${s}=${formatPrintValue(values[s])}`).join(" ")}`);
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
            "The update of q is an event in its own right: it wakes everything sensitive to q, and the scheduler returns from NBA to Active within the same simulation time (§4.5, §4.9.1). Each move up from a later region adds one to Δ.",
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
          feedback: "That is what a clocking-block input (cb.q) would return: it reads the Preponed sample (§14.13). A plain read in program code sees the current value.",
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

/**
 * The model's explanation for a landing. A wake step only records its trigger
 * ("#0 delay expired."), so for resumes and woken processes the step that
 * caused them (the suspend, or the value change) carries the useful reason.
 */
export function explainLanding(result: SimulationResult, landing: RegionLanding): string {
  const step = result.trace[landing.stepIndex];
  const before = result.trace.slice(0, landing.stepIndex).reverse();
  if (landing.kind === "resume") {
    const suspend = before.find((s) => s.kind === "suspend" && s.processId === landing.processId);
    if (suspend) return suspend.why;
  }
  if (landing.kind === "run") {
    const cause = before.find((s) => s.kind === "update" || s.kind === "statement");
    if (cause && cause.kind === "update") return `${cause.what} ${cause.why}`;
  }
  return step.why;
}

export function buildRegionQuestion(target: RegionTarget): RegionQuestion {
  const scenario = target.build();
  const result = simulateTimeSlot(scenario);
  const landings = regionLandings(scenario, result);
  const landing = target.select(landings, scenario);
  if (!landing) throw new Error(`Region quiz target ${target.id} matched no event in ${scenario.id}`);
  return {
    type: "region",
    id: target.id,
    scenarioId: scenario.id,
    title: scenario.title,
    code: regionMapSource(scenario),
    focusKey: target.focus?.(scenario) ?? landing.stmtId,
    prompt: target.prompt,
    answer: landing.region,
    why: explainLanding(result, landing),
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
