/**
 * Scenarios for ProceduralBlocksSimulator. Each one is data for the process
 * model in `src/lib/sv-process-model.ts`; the code learners read is generated
 * from the same data, and every prediction is graded against the model run.
 */
import { bin, c, v, type Expr, type ProcessScenario, type SimResult, type Stmt } from "@/lib/sv-process-model";

export type ProceduralScenarioId = "procedures" | "nba-swap" | "fork-timing" | "edge-vs-level";
export type AssignStyle = "nba" | "blocking";

export interface ProceduralPredictionOption {
  id: string;
  label: string;
  /** Diagnoses the reasoning behind this choice, for the given assignment style. */
  feedback: (style: AssignStyle) => string;
  /** True when the model run produces the outcome this option describes. */
  matches: (result: SimResult) => boolean;
}

export interface ProceduralScenarioPreset {
  id: ProceduralScenarioId;
  label: string;
  summary: string;
  /** One sentence telling the learner what to watch. */
  notice: string;
  /** Offer the `<=` / `=` toggle. */
  styleToggle?: boolean;
  build: (style: AssignStyle) => ProcessScenario;
  question: string;
  options: ProceduralPredictionOption[];
}

const display = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args });
const strobe = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args, strobe: true });
const delay = (amount: number, then?: Stmt): Stmt => ({ kind: "delay", amount: c(amount), then });

const printed = (result: SimResult, text: string, time?: number) =>
  result.log.some((l) => l.text === text && (time === undefined || l.time === time));

function proceduresScenario(): ProcessScenario {
  return {
    id: "procedures",
    title: "initial, always and final",
    vars: [
      { name: "clk", type: "logic", init: 0 },
      { name: "count", type: "int", init: 0 },
    ],
    processes: [
      { id: "clkgen", label: "clock", kind: "always", body: [delay(5, { kind: "assign", target: "clk", expr: { kind: "inv", operand: v("clk") } })] },
      {
        id: "counter",
        label: "counter",
        kind: "always",
        role: "design",
        body: [{ kind: "waitEdge", edge: "posedge", signal: "clk", then: { kind: "assign", target: "count", expr: bin("+", v("count"), c(1)), nba: true } }],
      },
      {
        id: "test",
        label: "test",
        kind: "initial",
        body: [display("test starts"), delay(22, display("count = %0d", v("count"))), { kind: "finish" }],
      },
      { id: "report", label: "report", kind: "final", body: [display("final: count = %0d", v("count"))] },
    ],
  };
}

function swapScenario(style: AssignStyle): ProcessScenario {
  const nba = style === "nba";
  return {
    id: `nba-swap:${style}`,
    title: "Swap with <= or =",
    vars: [
      { name: "a", type: "int", init: 1 },
      { name: "b", type: "int", init: 2 },
    ],
    processes: [
      {
        id: "swap",
        label: "swap",
        kind: "initial",
        body: [
          delay(10),
          { kind: "assign", target: "a", expr: v("b"), nba },
          { kind: "assign", target: "b", expr: v("a"), nba },
          display("display: a=%0d b=%0d", v("a"), v("b")),
          strobe("strobe: a=%0d b=%0d", v("a"), v("b")),
          delay(1, display("one ns later: a=%0d b=%0d", v("a"), v("b"))),
        ],
      },
    ],
  };
}

function forkTimingScenario(): ProcessScenario {
  return {
    id: "fork-timing",
    title: "Delays inside fork…join",
    vars: [
      { name: "a", type: "int", init: 0 },
      { name: "b", type: "int", init: 0 },
    ],
    processes: [
      {
        id: "stim",
        label: "stimulus",
        kind: "initial",
        body: [
          delay(5),
          {
            kind: "fork",
            join: "join",
            labels: ["set a", "set b"],
            branches: [delay(5, { kind: "assign", target: "a", expr: c(1) }), delay(10, { kind: "assign", target: "b", expr: c(2) })],
          },
          display("join done: a=%0d b=%0d", v("a"), v("b")),
        ],
      },
    ],
  };
}

function edgeVsLevelScenario(): ProcessScenario {
  return {
    id: "edge-vs-level",
    title: "@(posedge) versus wait()",
    vars: [{ name: "ready", type: "logic", init: 0 }],
    processes: [
      { id: "driver", label: "driver", kind: "initial", body: [delay(10, { kind: "assign", target: "ready", expr: c(1) })] },
      {
        id: "edge",
        label: "edge waiter",
        kind: "initial",
        body: [delay(20, { kind: "waitEdge", edge: "posedge", signal: "ready", then: display("@(posedge ready) passed") })],
      },
      {
        id: "level",
        label: "level waiter",
        kind: "initial",
        body: [delay(20, { kind: "waitCond", cond: v("ready"), then: display("wait (ready) passed") })],
      },
    ],
  };
}

export const proceduralScenarios: ProceduralScenarioPreset[] = [
  {
    id: "procedures",
    label: "initial · always · final",
    summary: "A clock, a counter, a test that stops the run, and a final report.",
    notice: "Watch the counter lane: it wakes only on rising clock edges, and its count update lands in the NBA region of the same time step.",
    build: () => proceduresScenario(),
    question: "What does the final procedure print, and when?",
    options: [
      {
        id: "two",
        label: "final: count = 2, at t = 22 ns",
        feedback: () =>
          "Right: rising edges happen at 5 ns and 15 ns, so count is 2 when the test calls $finish at 22 ns. final then runs once, in zero time, at that same moment (§9.2.3).",
        matches: (r) => r.log.some((l) => l.region === "final" && l.text === "final: count = 2" && l.time === 22),
      },
      {
        id: "four",
        label: "final: count = 4, at t = 22 ns",
        feedback: () => "4 would count every clock change. always @(posedge clk) waits for rising edges only: 0→1 at 5 ns and 15 ns.",
        matches: (r) => r.log.some((l) => l.region === "final" && l.text === "final: count = 4"),
      },
      {
        id: "none",
        label: "Nothing: $finish ends the run before final can execute",
        feedback: () => "final exists for exactly this moment: it runs when simulation ends, whether by $finish or because nothing is left to do (§9.2.3).",
        matches: (r) => !r.log.some((l) => l.region === "final"),
      },
      {
        id: "zero",
        label: "final: count = 0, at t = 0 ns",
        feedback: () => "final is not a second initial. It runs once at the end of simulation, not at time 0.",
        matches: (r) => r.log.some((l) => l.region === "final" && l.time === 0),
      },
    ],
  },
  {
    id: "nba-swap",
    label: "<= versus =",
    summary: "One process swaps a and b at t = 10 ns, then prints them three ways.",
    notice: "Look at the region badge: the <= updates land in the NBA region at t = 10 ns — the same time step — after $display has already printed.",
    styleToggle: true,
    build: swapScenario,
    question: "At t = 10 ns, what do $display and $strobe print?",
    options: [
      {
        id: "nba",
        label: "$display a=1 b=2, then $strobe a=2 b=1",
        feedback: (style) =>
          style === "nba"
            ? "Right: both right-hand sides are read in Active before either update lands. $display prints the old values; the NBA updates land later in the same time step, and $strobe prints the swapped result."
            : "With = the first assignment overwrites a immediately, so the second one copies the new a back into b. There is no swap.",
        matches: (r) => printed(r, "display: a=1 b=2", 10) && printed(r, "strobe: a=2 b=1", 10),
      },
      {
        id: "immediate",
        label: "$display a=2 b=1, then $strobe a=2 b=1",
        feedback: () => "<= does not update immediately. $display runs in the Active region, before any nonblocking update has landed.",
        matches: (r) => printed(r, "display: a=2 b=1", 10),
      },
      {
        id: "later",
        label: "$display a=1 b=2 and $strobe a=1 b=2 — the swap appears at t = 11 ns",
        feedback: () =>
          "Nonblocking updates do not wait for a later time. They land in the NBA region of the same time step, so $strobe at t = 10 ns already sees the swap (§10.4.2).",
        matches: (r) => printed(r, "strobe: a=1 b=2", 10),
      },
      {
        id: "blocking",
        label: "$display a=2 b=2, then $strobe a=2 b=2",
        feedback: (style) =>
          style === "blocking"
            ? "Right: with =, a takes b's value (2) at once, and then b = a copies that 2 back. Both print 2 — the blocking version is not a swap."
            : "That is the blocking result. With <= both right-hand sides are sampled before either variable changes.",
        matches: (r) => printed(r, "display: a=2 b=2", 10) && printed(r, "strobe: a=2 b=2", 10),
      },
    ],
  },
  {
    id: "fork-timing",
    label: "fork…join timing",
    summary: "After 5 ns, a fork starts two delayed assignments.",
    notice: "Both delays count from the moment the fork starts (t = 5 ns), not from each other.",
    build: () => forkTimingScenario(),
    question: "When does “join done” print?",
    options: [
      {
        id: "fifteen",
        label: "t = 15 ns",
        feedback: () => "Right: both branches start at 5 ns. a is set at 10 ns, b at 15 ns, and join waits for the later one (§9.3.2).",
        matches: (r) => printed(r, "join done: a=1 b=2", 15),
      },
      {
        id: "twenty",
        label: "t = 20 ns",
        feedback: () => "20 ns adds the delays one after another (5 + 5 + 10). Inside a fork they run in parallel, each relative to the fork's start.",
        matches: (r) => r.log.some((l) => l.text.startsWith("join done") && l.time === 20),
      },
      {
        id: "ten",
        label: "t = 10 ns",
        feedback: () => "10 ns is when the first branch finishes — that would be join_any. join waits for every branch.",
        matches: (r) => r.log.some((l) => l.text.startsWith("join done") && l.time === 10),
      },
      {
        id: "five",
        label: "t = 5 ns",
        feedback: () => "Continuing at once would be join_none. With join the stimulus process waits.",
        matches: (r) => r.log.some((l) => l.text.startsWith("join done") && l.time === 5),
      },
    ],
  },
  {
    id: "edge-vs-level",
    label: "@(posedge) vs wait()",
    summary: "ready rises at 10 ns; two processes start waiting for it at 20 ns.",
    notice: "Compare the two waiter lanes after t = 20 ns: one waits for a change, the other checks a level.",
    build: () => edgeVsLevelScenario(),
    question: "Both waiters start at t = 20 ns, after ready rose at 10 ns. Which get through?",
    options: [
      {
        id: "level",
        label: "Only wait (ready)",
        feedback: () =>
          "Right: wait (ready) is level-sensitive and ready is already 1, so it passes at once. @(posedge ready) waits for the next rising edge, which never comes.",
        matches: (r) => printed(r, "wait (ready) passed") && !printed(r, "@(posedge ready) passed"),
      },
      {
        id: "edge",
        label: "Only @(posedge ready)",
        feedback: () => "The edge happened at 10 ns, before the process reached @. An event control only sees edges that happen while it waits.",
        matches: (r) => printed(r, "@(posedge ready) passed") && !printed(r, "wait (ready) passed"),
      },
      {
        id: "both",
        label: "Both",
        feedback: () => "An event control does not remember past edges. Only the level-sensitive wait sees that ready is already 1.",
        matches: (r) => printed(r, "wait (ready) passed") && printed(r, "@(posedge ready) passed"),
      },
      {
        id: "neither",
        label: "Neither",
        feedback: () => "wait (expr) does not need a change: it only blocks while the expression is false.",
        matches: (r) => !printed(r, "wait (ready) passed") && !printed(r, "@(posedge ready) passed"),
      },
    ],
  },
];

export function getProceduralScenario(id: ProceduralScenarioId): ProceduralScenarioPreset {
  return proceduralScenarios.find((s) => s.id === id) ?? proceduralScenarios[0];
}
