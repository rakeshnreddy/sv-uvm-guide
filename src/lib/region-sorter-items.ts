/**
 * Region sorter: cards for EventRegionGame's sorter mode (`items` prop).
 *
 * Each card is one construct. The learner places it on every region of the
 * IEEE 1800-2023 §4.4.2 ladder where one of its events lands, or in the
 * "no region" tray. Some constructs land in several regions: a nonblocking
 * assignment reads its right-hand side where it executes and updates in NBA
 * (§4.9.4, §4.4.2.4); a concurrent assertion samples, evaluates and acts in
 * three regions (§16.5.1, §4.4.2.5, §4.4.2.6).
 *
 * Two kinds of card:
 * - "model" cards: every region is read from a run of the scheduler model
 *   (`buildRegionQuestion`, which calls `simulateTimeSlot`), so the key cannot
 *   drift from the model the F3B and F3C visuals use. The card's code is
 *   printed from the same scenario.
 * - "reference" cards: constructs the scheduler model does not simulate
 *   ($monitor, ->>, final, deferred assertions). Their regions are written
 *   here from the clause each one names, and the UI marks them "reference,
 *   not simulated".
 *
 * Region rules used (IEEE 1800-2023, checked against the standard's text):
 * - §4.4.2.1-§4.4.2.9: the nine regions. Inactive holds #0 resumes
 *   (§4.4.2.3); NBA holds nonblocking updates (§4.4.2.4); Observed evaluates
 *   property expressions (§4.4.2.5); Reactive holds program blocking code and
 *   concurrent-assertion action blocks (§4.4.2.6); Re-Inactive holds #0
 *   resumes in the reactive set (§4.4.2.7); Re-NBA holds nonblocking updates
 *   made from the reactive set (§4.4.2.8); Postponed holds $monitor and
 *   $strobe (§4.4.2.9).
 * - §15.5.1: `->>` creates a nonblocking assign update event whose effect is
 *   to trigger the event in the nonblocking assignment region.
 * - §14.10: the clocking block event is triggered in Observed. §14.13: an
 *   input whose skew is not an explicit #0 samples the value at the Postponed
 *   region of the time step skew time units before the clocking event (for
 *   #1step, the Preponed value, §4.4.2.1). §14.16: zero-skew drives with no
 *   cycle delay are scheduled in Re-NBA of the clocking event's step.
 * - §16.4, §16.4.1: a deferred assertion's expression is evaluated when the
 *   statement is processed; an observed deferred report matures in Observed
 *   and its action runs in Reactive; a final deferred report matures and runs
 *   in Postponed.
 * - §16.5, §16.5.1: concurrent assertions are evaluated in Observed; in most
 *   cases the sampled value is the value in Preponed.
 * - §9.2.3: a final procedure occurs at the end of simulation time, runs in
 *   zero time as a series of function calls from a single process (not as a
 *   separate process), when the simulation ends through an explicit or
 *   implicit $finish, and no remaining scheduled event executes after the
 *   final procedures. §9.2.3 names no region and does not say that the time
 *   slot of the $finish runs to completion first; the sorter reads it as "no
 *   region of the §4.4.2 ladder" and never says it runs outside a time slot.
 * - §24.3.1: program code runs in the reactive region set; its nonblocking
 *   assignments update in Re-NBA.
 */

import {
  REGION_LABELS,
  REGION_ORDER,
  findProcessStatement,
  formatValue,
  statementToSource,
  withZeroDelay,
  type RegionId,
  type SvScenario,
} from "./sv-scheduler-model";
import { REGION_CLAUSES, buildRegionQuestion, regionMapSource, type LandingKind, type RegionLanding } from "./sv-region-map-model";
import { displayVsStrobeScenario, programReactiveScenario, shiftRegisterScenario, testbenchDriveScenario } from "./sv-scheduler-scenarios";

/** A rung of the §4.4.2 ladder, or the tray for constructs that run in no region. */
export type SorterPlace = RegionId | "none";

/** Ladder order, then the tray. */
export const SORTER_PLACES: SorterPlace[] = [...REGION_ORDER, "none"];

export const PLACE_LABELS: Record<SorterPlace, string> = { ...REGION_LABELS, none: "No region" };

/**
 * The clause that defines each rung: its §4.4.2 sub-clause. The tray has no
 * defining clause of its own (it is "not a region"), so a tray landing shows
 * the clause of the card's own landing instead: see `landingPlaceClause`.
 */
export const PLACE_CLAUSES: Record<RegionId, string> = { ...REGION_CLAUSES };

/** What the tray is for, shown when a learner puts a card there that lands on the ladder. */
export const TRAY_HOLDS = "Constructs that run in no region of the §4.4.2 ladder.";

export type SorterCardId =
  | "blocking"
  | "nonblocking"
  | "zero-delay"
  | "display"
  | "strobe"
  | "monitor"
  | "concurrent-assertion"
  | "clocking-drive"
  | "step-input"
  | "clocking-event"
  | "nonblocking-trigger"
  | "program-nonblocking"
  | "program-zero-delay"
  | "final"
  | "deferred-observed"
  | "deferred-final";

export interface SorterLanding {
  place: SorterPlace;
  /** What happens there, without naming the region ("q1 changes"). */
  event: string;
  /** Why it lands there, as the clause states the rule, in terms of this card's own code. */
  why: string;
  /** Model cards only: the scheduler model's own explanation for the event, which names details of its scenario (see `scenarioCode`). */
  modelWhy?: string;
  /** Clauses for this landing. */
  clause: string;
}

/** The clause shown beside a landing's place: the §4.4.2 sub-clause of a rung, or for the tray the landing's own clause. */
export const landingPlaceClause = (l: SorterLanding): string => (l.place === "none" ? l.clause : PLACE_CLAUSES[l.place]);

export interface SorterCard {
  id: SorterCardId;
  /** Code on the card. For model cards it is printed from the scenario the model runs. */
  code: string;
  /** Where the code sits, so the card has one answer ("in module code"). */
  context: string;
  /** The question, naming the events to place but never their regions. */
  ask: string;
  fidelity: "model" | "reference";
  /** Construct column of the reference table row (F3B "Where each construct runs"). */
  construct: string;
  /** Every place an event of the construct lands, in ladder order. */
  landings: SorterLanding[];
  /** Every clause the card cites, landings first. */
  clauses: string[];
  /** A limit of the model or a choice the standard leaves open, shown with the reveal. */
  note?: string;
  /** Model cards only: the scenario the regions were read from. */
  scenarioTitle?: string;
  /** Model cards only: the scenario's code, printed from the model, with its starting values and each process's label, so `modelWhy` can be read against it. */
  scenarioCode?: string[];
  /** Short context that tells apart two cards with the same code ("module", "program"). */
  codeContext?: string;
}

// ---------------------------------------------------------------------------
// Scenario the scheduler model runs for the concurrent-assertion card
// ---------------------------------------------------------------------------

/**
 * A flop and a concurrent assertion on the same clock edge. The model samples
 * d in Preponed (§16.5.1), evaluates the property in Observed (§4.4.2.5) and
 * runs the pass action in Reactive (§4.4.2.6).
 */
export const sorterAssertionScenario = (): SvScenario => ({
  id: "sorter-concurrent-assertion",
  title: "A concurrent assertion on the clock edge",
  clock: "clk",
  initial: { clk: 0, d: 1, q: 0 },
  watch: ["clk", "d", "q"],
  processes: [
    {
      id: "FF",
      label: "DUT flop",
      owner: "design",
      context: "module",
      header: "always_ff @(posedge clk)",
      trigger: { kind: "posedge", signal: "clk" },
      body: [{ kind: "assign", id: "sa1", op: "nba", target: "q", expr: { kind: "var", name: "d" } }],
    },
    {
      id: "A",
      label: "a_d",
      owner: "design",
      context: "module",
      kind: "assertion",
      header: "a_d: assert property",
      trigger: { kind: "posedge", signal: "clk" },
      body: [],
      assertion: { property: { kind: "var", name: "d" }, pass: [{ kind: "display", id: "sa2", signals: [], label: "PASS" }] },
    },
  ],
});

// ---------------------------------------------------------------------------
// Model cards
// ---------------------------------------------------------------------------

type RegionTarget = Parameters<typeof buildRegionQuestion>[0];

interface ModelLandingSpec {
  event: string;
  /** The rule for this card's event, citing its clauses and naming the region; a test checks it names the region the model chose. */
  why: string;
  clause: string;
  select: RegionTarget["select"];
}

interface ModelCardSpec {
  id: SorterCardId;
  build: () => SvScenario;
  code: (scenario: SvScenario) => string;
  context: string;
  ask: string;
  construct: string;
  landings: ModelLandingSpec[];
  extraClauses?: string[];
  note?: string;
  codeContext?: string;
}

const statementSource = (scenario: SvScenario, stmtId: string): string => {
  const stmt = findProcessStatement(scenario, stmtId);
  if (!stmt) throw new Error(`Region sorter: statement ${stmtId} not found in ${scenario.id}`);
  return statementToSource(stmt);
};

const byStmt = (stmtId: string, kind: LandingKind) => (ls: RegionLanding[]) => ls.find((l) => l.stmtId === stmtId && l.kind === kind);
const byProcess = (processId: string, kind: LandingKind) => (ls: RegionLanding[]) => ls.find((l) => l.processId === processId && l.kind === kind);

const MODEL_CARDS: ModelCardSpec[] = [
  {
    id: "blocking",
    build: () => shiftRegisterScenario("blocking"),
    code: (s) => statementSource(s, "a1"),
    context: "in an always @(posedge clk) of module code",
    ask: "Where is q1 written?",
    construct: "Blocking assignment",
    landings: [{
        event: "q1 is written, at once",
        why: "With no delay, the process performs the assignment to the left-hand side as it executes the statement (§4.9.3). This module process is woken by the design clock, so it executes in the Active region, which holds the active region set events being evaluated (§4.4.2.2).",
        clause: "§4.9.3",
        select: byStmt("a1", "statement") }],
  },
  {
    id: "nonblocking",
    build: () => shiftRegisterScenario("nba"),
    code: (s) => statementSource(s, "a1"),
    context: "in an always @(posedge clk) of module code",
    ask: "Where is d read, and where does q1 change?",
    construct: "Nonblocking assignment",
    landings: [
      {
        event: "d is read and the update is scheduled",
        why: "The right-hand side is computed when the statement executes, and the update is scheduled as an NBA update event (§4.9.4). The module process, woken by the design clock, executes the statement in the Active region, which holds the active region set events being evaluated (§4.4.2.2).",
        clause: "§4.9.4",
        select: byStmt("a1", "statement") },
      {
        event: "q1 changes",
        why: "The update was scheduled when the statement executed (§4.9.4), and the NBA region holds the nonblocking assignment updates made from the active region set (§4.4.2.4).",
        clause: "§4.9.4",
        select: byStmt("a1", "update") },
    ],
  },
  {
    id: "zero-delay",
    build: () => withZeroDelay(shiftRegisterScenario("blocking"), "B", true),
    code: (s) => statementSource(s, "B-d0"),
    context: "at the start of an always @(posedge clk) of module code",
    ask: "After the #0, where is the event that resumes the process scheduled?",
    construct: "#0 in module code",
    codeContext: "module",
    landings: [{
        event: "the event that resumes the process is scheduled",
        why: "In the active region set, an explicit #0 suspends the process and schedules an event in the Inactive region of the current time slot, so the process resumes in the next Inactive to Active iteration (§4.4.2.3).",
        clause: "§4.4.2.3",
        select: (ls) => ls.find((l) => l.processId === "B" && l.kind === "resume") }],
    note: "In this run only Stage B waits on #0, so Stage A always writes q1 first and Stage B then reads the new q1: the order is fixed, but q2 takes d on the same edge. The model's line that #0 postpones the race describes two processes that both wait on #0: they race again after it.",
  },
  {
    id: "display",
    build: displayVsStrobeScenario,
    code: (s) => statementSource(s, "p2"),
    context: "after q <= d in an always @(posedge clk) of module code",
    ask: "Where does the line print?",
    construct: "$display",
    landings: [{
        event: "it prints at once, with current values",
        why: "$display is a statement of the process that calls it, so it prints where that process executes (§21.2.1). Here that is a module process woken by the design clock, in the Active region, which holds the active region set events being evaluated (§4.4.2.2).",
        clause: "§21.2.1",
        select: byStmt("p2", "print") }],
    note: "$display has no region of its own: it prints in the region of the process that calls it. Called from program code, it would print in the reactive region set, usually in Reactive (§24.3.1).",
  },
  {
    id: "strobe",
    build: displayVsStrobeScenario,
    code: (s) => statementSource(s, "p3"),
    context: "after q <= d in an always @(posedge clk) of module code",
    ask: "Where does the line print?",
    construct: "$strobe",
    landings: [{
        event: "it prints the settled values",
        why: "$strobe writes just before simulation time advances, after all other events at that time (§21.2.2); $strobe events are scheduled in the Postponed region (§4.4.2.9).",
        clause: "§21.2.2",
        select: byStmt("p3", "print") }],
  },
  {
    id: "concurrent-assertion",
    build: sorterAssertionScenario,
    code: (s) =>
      regionMapSource(s)
        .filter((l) => l.processId === "A")
        .map((l) => l.text.trim())
        .join(" "),
    context: "in module code, clocked by the same edge as a flop q <= d",
    ask: "Where are its values sampled, where is the property evaluated, and where does its action block run?",
    construct: "Concurrent assertion",
    landings: [
      {
        event: "the values it uses are sampled",
        why: "In most cases the sampled value of an expression in a concurrent assertion is its value in the Preponed region (§16.5.1, §4.4.2.1).",
        clause: "§16.5.1",
        select: byProcess("A", "assert-sample") },
      {
        event: "the property is evaluated",
        why: "The Observed region is for the evaluation of property expressions when they are triggered (§4.4.2.5, §16.5).",
        clause: "§16.5",
        select: byProcess("A", "assert-eval") },
      {
        event: "the pass or fail action block runs",
        why: "During property evaluation, the pass/fail code is scheduled in the Reactive region of the current time slot (§4.4.2.5); the Reactive region holds the code in action blocks of concurrent assertions (§4.4.2.6).",
        clause: "§4.4.2.5",
        select: byProcess("A", "assert-action") },
    ],
    note: "§16.5.1 says the sampled value is the Preponed value \"in most cases\" and lists exceptions; this card is the usual case. §16.5 also exempts disable conditions and clocking events from sampling, so clk itself is not sampled.",
  },
  {
    id: "clocking-drive",
    build: () => testbenchDriveScenario("clocking"),
    code: (s) => statementSource(s, "tb1"),
    context: "executed by module code at the clocking event, output skew #0, no ##",
    ask: "Where does din change?",
    construct: "Clocking drive, zero skew, no cycle delay",
    landings: [{
        event: "din changes",
        why: "For a zero-skew clocking output with no cycle delay, the synchronous drive schedules the new value in the Re-NBA region of the time step of the clocking event (§14.16, §4.4.2.8).",
        clause: "§14.16",
        select: byStmt("tb1", "update") }],
    note: "The model treats every clocking drive as executed at its clocking event. A drive executed between clocking events waits for the next one, and a nonzero skew or ##n moves it to a later time step (§14.16).",
  },
  {
    id: "step-input",
    build: () => testbenchDriveScenario("clocking"),
    code: (s) => statementSource(s, "tb2"),
    context: "in an always @(cb) of module code; cb.q has the default input skew #1step",
    ask: "Where was the value that cb.q returns sampled?",
    construct: "Clocking-block input with the default #1step skew",
    landings: [
      {
        event: "the value cb.q returns was sampled",
        why: "With an input skew that is not an explicit #0, the sample is the value in the Postponed region of the time step skew before the clocking event (§14.13); #1step sampling is identical to sampling in the Preponed region of the current time slot (§4.4.2.1).",
        clause: "§14.13",
        select: (ls, scenario) => {
          // The model evaluates a `sampled` read from the Preponed snapshot (§14.13, §4.4.2.1).
          const stmt = findProcessStatement(scenario, "tb2");
          return stmt && stmt.kind === "assign" && stmt.expr.kind === "sampled" ? ls.find((l) => l.kind === "sample") : undefined;
        },
      },
    ],
    note: "§14.13 defines the sample as the value in the Postponed region of the time step one step before the clocking event, which is the value Preponed holds in this slot (§4.4.2.1).",
  },
  {
    id: "clocking-event",
    build: () => testbenchDriveScenario("clocking"),
    code: (s) => /@\(\w+\)/.exec(s.processes.find((p) => p.id === "TB")?.header ?? "")?.[0] ?? "",
    context: "the clocking block cb @(posedge clk), waited on by module code",
    ask: "Where is the clocking block event triggered?",
    construct: "Clocking block event",
    landings: [{
        event: "the event @(cb) is triggered",
        why: "On its clocking event, a clocking block triggers the event named by the clocking block, and that event is triggered in the Observed region (§14.10, §4.4.2.5).",
        clause: "§14.10",
        select: (ls) => ls.find((l) => l.kind === "clocking-event") }],
    note: "Module code waiting on @(cb) then runs in the first Active region after that Observed region (§14.10).",
  },
  {
    id: "program-nonblocking",
    build: programReactiveScenario,
    code: (s) => statementSource(s, "pr4"),
    context: "in an initial of a program block",
    ask: "Where is the right-hand side read, and where does cmd change?",
    construct: "Nonblocking assignment in program code",
    landings: [
      {
        event: "the right-hand side is read and the update is scheduled",
        why: "Initial procedures of a program block are scheduled in the Reactive region (§24.3.1, §4.4.2.6), so the right-hand side is computed there when the statement executes (§4.9.4).",
        clause: "§24.3.1",
        select: byStmt("pr4", "statement") },
      {
        event: "cmd changes",
        why: "Nonblocking assignments in program code schedule their updates in the Re-NBA region (§24.3.1, §4.4.2.8).",
        clause: "§24.3.1",
        select: byStmt("pr4", "update") },
    ],
  },
  {
    id: "program-zero-delay",
    build: () => withZeroDelay(programReactiveScenario(), "TB", true),
    code: (s) => statementSource(s, "TB-d0"),
    context: "at the start of an initial of a program block",
    ask: "After the #0, where is the event that resumes the program thread scheduled?",
    construct: "#0 in program code",
    codeContext: "program",
    landings: [{
        event: "the event that resumes the program thread is scheduled",
        why: "In the reactive region set, an explicit #0 suspends the process and schedules an event in the Re-Inactive region of the current time slot, so it resumes in the next Re-Inactive to Reactive iteration (§4.4.2.7).",
        clause: "§4.4.2.7",
        select: (ls) => ls.find((l) => l.processId === "TB" && l.kind === "resume") }],
  },
];

/**
 * The scenario's code as the model prints it, after a line of starting
 * values, with each process's label as a comment on its first line, so the
 * model's own explanation ("Stage A", "TB driver") can be read against it.
 */
export function annotatedScenarioSource(scenario: SvScenario): string[] {
  const seen = new Set<string>();
  const lines = regionMapSource(scenario).map((l) => {
    if (!l.processId || seen.has(l.processId)) return l.text;
    seen.add(l.processId);
    const label = scenario.processes.find((p) => p.id === l.processId)?.label;
    return label ? `${l.text}  // ${label}` : l.text;
  });
  const start = Object.entries(scenario.initial)
    .map(([name, value]) => `${name} = ${formatValue(value)}`)
    .join(", ");
  return [`// starting values: ${start}`, ...lines];
}

function buildModelCard(spec: ModelCardSpec): SorterCard {
  const scenario = spec.build();
  const landings: SorterLanding[] = spec.landings.map((l, i) => {
    const question = buildRegionQuestion({ id: `${spec.id}-${i}`, build: spec.build, prompt: spec.ask, select: l.select });
    return { place: question.answer, event: l.event, why: l.why, modelWhy: question.why, clause: uniqueClauses([l.clause, REGION_CLAUSES[question.answer]]).join(", ") };
  });
  const places = landings.map((l) => l.place);
  if (new Set(places).size !== places.length) throw new Error(`Region sorter card ${spec.id}: two events land in the same region`);
  landings.sort((a, b) => SORTER_PLACES.indexOf(a.place) - SORTER_PLACES.indexOf(b.place));
  return {
    id: spec.id,
    code: spec.code(scenario),
    context: spec.context,
    ask: spec.ask,
    fidelity: "model",
    construct: spec.construct,
    landings,
    clauses: uniqueClauses([...landings.map((l) => l.clause), ...(spec.extraClauses ?? [])]),
    note: spec.note,
    scenarioTitle: scenario.title,
    scenarioCode: annotatedScenarioSource(scenario),
    codeContext: spec.codeContext,
  };
}

// ---------------------------------------------------------------------------
// Reference cards (not simulated): each landing names its clause
// ---------------------------------------------------------------------------

const REFERENCE_SPECS: Omit<SorterCard, "clauses">[] = [
  {
    id: "monitor",
    code: "$monitor(\"q=%0d\", q);",
    context: "called once from module code",
    ask: "Where does it print?",
    fidelity: "reference",
    construct: "$monitor",
    landings: [
      {
        place: "postponed",
        event: "it prints, in each time step where one of its arguments changed",
        why: "$monitor displays its whole argument list at the end of each time step in which an argument changed value (§21.2.3); $monitor events are scheduled in the Postponed region (§4.4.2.9).",
        clause: "§21.2.3, §4.4.2.9",
      },
    ],
    note: "§21.2.3 leaves out changes to $time, $stime and $realtime: a change to one of them alone never triggers a display.",
  },
  {
    id: "nonblocking-trigger",
    code: "->> e;",
    context: "in module code, with no delay or event control",
    ask: "Where is the event e triggered?",
    fidelity: "reference",
    construct: "Nonblocking event trigger",
    landings: [
      {
        place: "nba",
        event: "e is triggered",
        why: "->> executes without blocking and creates a nonblocking assign update event; the effect of that update is to trigger e in the nonblocking assignment region (§15.5.1).",
        clause: "§15.5.1, §4.4.2.4",
      },
    ],
    note: "§15.5.1 names the nonblocking assignment region and does not describe ->> executed from program code separately; this card is module code.",
  },
  {
    id: "final",
    code: "final $display(\"done\");",
    context: "a final procedure in a module",
    ask: "Where does it run?",
    fidelity: "reference",
    construct: "final procedure",
    landings: [
      {
        place: "none",
        event: "it runs once when simulation ends through $finish, in zero time, as function calls; no event still scheduled runs after it",
        why: "A final procedure occurs at the end of simulation time, when the simulation ends through an explicit or implicit $finish. It is not a separate process: it runs in zero time as a series of function calls from a single process, and no remaining scheduled event executes after the final procedures (§9.2.3).",
        clause: "§9.2.3",
      },
    ],
    note: "§9.2.3 names no region for final. The sorter reads \"end of simulation time\" and \"not a separate process\" as no region of the §4.4.2 ladder. It appears to run at the simulation time where $finish took effect, an inference from the clause's example, which reads $time; §9.2.3 does not say whether the rest of that time slot runs first.",
  },
  {
    id: "deferred-observed",
    code: "assert #0 (a == b) else $error(\"a != b\");",
    context: "a deferred assertion with #0, in an always_comb of module code",
    ask: "Where is the expression evaluated, where does the report mature, and where does the action run?",
    fidelity: "reference",
    construct: "Observed deferred assertion",
    landings: [
      {
        place: "active",
        event: "the expression is evaluated, when the statement is processed",
        why: "A deferred assertion's expression is evaluated when the statement is processed (§16.4); here the module process runs in the Active region, which holds the active region set events being evaluated (§4.4.2.2).",
        clause: "§16.4, §4.4.2.2",
      },
      {
        place: "observed",
        event: "the pending report matures",
        why: "In the Observed region of each time step, each pending observed deferred report that was not flushed matures (§16.4.1).",
        clause: "§16.4.1",
      },
      {
        place: "reactive",
        event: "the action block's call (or $error) runs",
        why: "Once the report matures, its subroutine call, or $error when an assert fails with no else, is executed in the Reactive region (§16.4.1).",
        clause: "§16.4.1",
      },
    ],
    note: "A flush point (§16.4.2) clears pending reports before they mature, so a glitch that is gone by Observed is never reported.",
  },
  {
    id: "deferred-final",
    code: "assert final (a == b) else $error(\"a != b\");",
    context: "a final deferred assertion in an always_comb of module code",
    ask: "Where is the expression evaluated, and where does the report mature and run?",
    fidelity: "reference",
    construct: "Final deferred assertion",
    landings: [
      {
        place: "active",
        event: "the expression is evaluated, when the statement is processed",
        why: "A deferred assertion's expression is evaluated when the statement is processed (§16.4); here the module process runs in the Active region, which holds the active region set events being evaluated (§4.4.2.2).",
        clause: "§16.4, §4.4.2.2",
      },
      {
        place: "postponed",
        event: "the pending report matures and its call (or $error) runs",
        why: "In the Postponed region, each pending final deferred report that was not flushed matures, and its subroutine call is scheduled in the same Postponed region (§16.4.1).",
        clause: "§16.4.1",
      },
    ],
  },
];

const REFERENCE_CARDS: SorterCard[] = REFERENCE_SPECS.map((card) => ({ ...card, clauses: uniqueClauses(card.landings.map((l) => l.clause)) }));

function uniqueClauses(list: string[]): string[] {
  return [...new Set(list.flatMap((c) => c.split(/,\s*/)).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

/** Play order of the full deck. */
export const SORTER_CARD_ORDER: SorterCardId[] = [
  "blocking",
  "nonblocking",
  "zero-delay",
  "display",
  "strobe",
  "monitor",
  "concurrent-assertion",
  "clocking-drive",
  "step-input",
  "clocking-event",
  "nonblocking-trigger",
  "program-nonblocking",
  "program-zero-delay",
  "final",
  "deferred-observed",
  "deferred-final",
];

/**
 * The F3B "first read" set: `=`, `<=`, `#0`, `$display`, `$strobe`,
 * concurrent assertions, clocking drives and `final`, the eight constructs
 * the lesson's "Where each construct runs" asks the learner to read first.
 */
export const FIRST_READ_IDS: SorterCardId[] = ["blocking", "nonblocking", "zero-delay", "display", "strobe", "concurrent-assertion", "clocking-drive", "final"];

let cache: Map<SorterCardId, SorterCard> | null = null;

/** Every card, keyed by id. Model cards are built (and the model run) once. */
export function sorterCards(): Map<SorterCardId, SorterCard> {
  if (!cache) {
    const built = [...MODEL_CARDS.map(buildModelCard), ...REFERENCE_CARDS];
    cache = new Map(SORTER_CARD_ORDER.map((id) => {
      const card = built.find((c) => c.id === id);
      if (!card) throw new Error(`Region sorter: no card ${id}`);
      return [id, card] as const;
    }));
  }
  return cache;
}

export const isSorterCardId = (id: string): id is SorterCardId => (SORTER_CARD_ORDER as string[]).includes(id);

export type SorterItems = "all" | "first-read" | string[];

export interface SorterDeck {
  cards: SorterCard[];
  /** Ids in a custom list that name no card; shown as a note, never silently dropped. */
  unknownIds: string[];
  /** Cards left out because the deck takes one place per card and they land in several. */
  omittedMulti: SorterCard[];
  allowMulti: boolean;
}

const isDeckName = (s: string): s is "all" | "first-read" => s === "all" || s === "first-read";

/**
 * Resolves the `items` and `allowMulti` props into the deck the learner plays.
 * Names and ids are trimmed and lowercased, a deck name works alone in an
 * array too, and an MDX string `allowMulti="false"` reads as false.
 */
export function resolveSorterDeck(items: SorterItems | string = "all", allowMulti: boolean | string = true): SorterDeck {
  const all = sorterCards();
  const multi = typeof allowMulti === "string" ? allowMulti.trim().toLowerCase() !== "false" : allowMulti;
  // A plain MDX string other than the two names is read as a comma-separated id list.
  const raw = (typeof items === "string" ? items.split(",") : items).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ids: string[] = raw.length === 1 && isDeckName(raw[0]) ? (raw[0] === "all" ? SORTER_CARD_ORDER : FIRST_READ_IDS) : [...new Set(raw)];
  const unknownIds = ids.filter((id) => !isSorterCardId(id));
  const chosen = ids.filter(isSorterCardId).map((id) => all.get(id)!);
  const omittedMulti = multi ? [] : chosen.filter((c) => c.landings.length > 1);
  const cards = multi ? chosen : chosen.filter((c) => c.landings.length === 1);
  return { cards, unknownIds, omittedMulti, allowMulti: multi };
}

// ---------------------------------------------------------------------------
// Placing and grading
// ---------------------------------------------------------------------------

/**
 * The new set of places after the learner chooses `place`. With several
 * places allowed it toggles; otherwise the choice replaces the old one.
 * The tray and the ladder exclude each other: a construct that runs in no
 * region cannot also run on a rung.
 */
export function togglePlace(current: SorterPlace[], place: SorterPlace, allowMulti: boolean): SorterPlace[] {
  if (!allowMulti) return current.length === 1 && current[0] === place ? [] : [place];
  if (current.includes(place)) return current.filter((p) => p !== place);
  const next: SorterPlace[] = place === "none" ? ["none"] : [...current.filter((p) => p !== "none"), place];
  return SORTER_PLACES.filter((p) => next.includes(p));
}

export type PlacementStatus = "correct" | "partial" | "wrong";

export interface PlacementResult {
  status: PlacementStatus;
  /** Places picked that are right. */
  hits: SorterPlace[];
  /** Places the construct lands in that were not picked. */
  missed: SorterPlace[];
  /** Places picked where it does not land. */
  extra: SorterPlace[];
}

export function gradePlacement(card: SorterCard, picked: SorterPlace[]): PlacementResult {
  const answer = card.landings.map((l) => l.place);
  const hits = SORTER_PLACES.filter((p) => picked.includes(p) && answer.includes(p));
  const missed = SORTER_PLACES.filter((p) => answer.includes(p) && !picked.includes(p));
  const extra = SORTER_PLACES.filter((p) => picked.includes(p) && !answer.includes(p));
  const status: PlacementStatus = missed.length === 0 && extra.length === 0 ? "correct" : hits.length > 0 ? "partial" : "wrong";
  return { status, hits, missed, extra };
}

/** A place's name inside a sentence: the tray is "the no-region tray", so "No region is missing" never reads as "nothing is missing". */
const placeName = (p: SorterPlace) => (p === "none" ? "the no-region tray" : PLACE_LABELS[p]);

const listPlaces = (places: SorterPlace[]) => {
  const names = places.map(placeName);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/**
 * The card's name in the deck picker and the results list: its code, plus
 * its code context when another card in the deck has the same code (the
 * module and program #0 cards both read "#0;").
 */
export function cardLabel(card: SorterCard, deck: SorterCard[]): string {
  const clash = deck.some((c) => c.id !== card.id && c.code === card.code);
  return clash ? `${card.code} (${card.codeContext ?? card.construct})` : card.code;
}

/** Badge for a whole deck: a model run only when every card is one; otherwise the lower, illustration badge. */
export const deckFidelity = (cards: SorterCard[]): "model" | "illustration" =>
  cards.length > 0 && cards.every((c) => c.fidelity === "model") ? "model" : "illustration";

/** Where the construct lands, as the reference table's "where" column: generated from the landings. */
export function whereText(card: SorterCard): string {
  return card.landings.map((l) => (l.place === "none" ? `no region: ${l.event}` : `${PLACE_LABELS[l.place]}: ${l.event}`)).join("; ");
}

/** The verdict sentence shown after a check, generated from the grade. */
export function placementVerdict(card: SorterCard, result: PlacementResult): string {
  const lands = card.landings.length === 1 && card.landings[0].place === "none" ? "It runs in no region." : `It lands in ${listPlaces(card.landings.map((l) => l.place))}.`;
  if (result.status === "correct") return card.landings.length > 1 ? `Right: all ${card.landings.length} places. ${lands}` : `Right. ${lands}`;
  const parts: string[] = [];
  if (result.hits.length) parts.push(`${listPlaces(result.hits)} ${result.hits.length === 1 ? "is" : "are"} right`);
  if (result.missed.length) parts.push(`${listPlaces(result.missed)} ${result.missed.length === 1 ? "is" : "are"} missing`);
  if (result.extra.length) parts.push(`${listPlaces(result.extra)} ${result.extra.length === 1 ? "is" : "are"} not where it lands`);
  const joined = parts.join("; ");
  return `${result.status === "partial" ? "Partly right" : "Not quite"}: ${joined}. ${lands}`;
}

/** What the live region announces after a place is chosen. */
export function placementAnnouncement(card: SorterCard, picked: SorterPlace[]): string {
  return picked.length === 0 ? `${card.code} is not placed yet.` : `${card.code} placed on ${listPlaces(picked)}.`;
}

/** End-of-deck summary, counted from the results. */
export function sorterSummary(results: PlacementResult[], total: number): string {
  const exact = results.filter((r) => r.status === "correct").length;
  const partial = results.filter((r) => r.status === "partial").length;
  return `${exact} of ${total} cards placed exactly${partial ? `, ${partial} partly right` : ""}.`;
}
