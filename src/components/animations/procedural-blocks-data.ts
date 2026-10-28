/**
 * Scenarios for ProceduralBlocksSimulator. Each one is data for the process
 * model in `src/lib/sv-process-model.ts`; the code learners read is generated
 * from the same data, and every prediction is graded against the model run.
 *
 * Two kinds of preset:
 * - `proceduralScenarios`: one run, graded on that run;
 * - `timeZeroScenarios`: time-zero races, graded on every order of the ready
 *   processes (`exploreProcessOrders`), because the right answer can be "it
 *   depends". The model runs each ready process until it blocks or ends; §4.7
 *   interleaving is not explored, and the UI says so.
 */
import {
  bin,
  c,
  exploreProcessOrders,
  formatVarValue,
  lit,
  now,
  settledHistory,
  startOrder,
  v,
  valueAt,
  type Expr,
  type ExploreOptions,
  type ProcessExploration,
  type ProcessScenario,
  type SimResult,
  type Stmt,
  type SvVal,
  type VarDecl,
} from "@/lib/sv-process-model";

export type TimeZeroScenarioId = "time0-reset" | "comb-vs-star" | "time0-race" | "decl-init-ready";
export type ProceduralScenarioId = "procedures" | "nba-swap" | "fork-timing" | "edge-vs-level" | TimeZeroScenarioId;
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
        feedback: () => "final exists for exactly this moment: it runs once, in zero time, when simulation ends due to an explicit or implicit call to $finish (§9.2.3).",
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

/* ========================================================================= */
/* Time zero: four races the standard leaves open, graded on every order.    */
/* ========================================================================= */

export type ResetForm = "blocking" | "nonblocking" | "initializer";
export type CombVariant = "inputs-change" | "inputs-static";
export type RaceVariant = "as-written" | "fix";
export type InitRuleVariant = "ieee1800" | "ieee1364-2005";

/** A preset's current configuration: the variant chosen in the code line, and the advanced toggle. */
export interface TimeZeroConfig {
  variant: string;
  advanced: boolean;
}

export interface TimeZeroPredictionOption {
  id: string;
  label: string;
  /** Diagnoses the reasoning behind this choice, for the current configuration. */
  feedback: (cfg: TimeZeroConfig) => string;
  /** True when every order of the ready processes the model ran agrees with this option. */
  matches: (exploration: ProcessExploration) => boolean;
}

export interface TimeZeroVariant {
  value: string;
  /** Short label for the pill inside the code line. */
  label: string;
  /** Full name, read by screen readers and shown under the code. */
  description: string;
}

export interface TimeZeroPreset {
  id: TimeZeroScenarioId;
  label: string;
  summary: string;
  /** One sentence telling the learner what to watch. */
  notice: (cfg: TimeZeroConfig) => string;
  /** Shows "Run every order of the ready processes" with grouped outcomes. */
  explore: true;
  /** Accessible name of the variant control that sits in the code line. */
  variantLabel: string;
  variants: TimeZeroVariant[];
  /** Key of the source line that carries the variant control. */
  variantLineKey: (cfg: TimeZeroConfig) => string;
  /** Optional "Show advanced" switch (progressive disclosure). */
  advanced?: { label: string; off: string; on: string };
  build: (cfg: TimeZeroConfig) => ProcessScenario;
  /** Variables whose history decides an outcome group and is drawn per group. */
  watch: string[];
  question: (cfg: TimeZeroConfig) => string;
  options: (cfg: TimeZeroConfig) => TimeZeroPredictionOption[];
  /** Names the processes whose relative order decides the outcome, for the group cards. */
  orderNote: string;
  /**
   * The lesson's own name for the order an outcome card shows (F3A's "Order A" /
   * "Order B"), from that card's run. Omitted, or undefined for a run: "Outcome n".
   */
  outcomeName?: (run: SimResult) => string | undefined;
  /** Extra assumptions shown in the fidelity badge. */
  assumptions: string[];
}

const assign = (target: string, expr: Expr, extra: Partial<Extract<Stmt, { kind: "assign" }>> = {}): Stmt => ({ kind: "assign", target, expr, ...extra });
const onChange = (names: string[], then: Stmt): Stmt => ({ kind: "waitEvents", terms: names.map((n) => ({ expr: v(n) })), then });

/** Exploration settings for a preset: compare the watched variables, never throw at the cap. */
export function timeZeroExploreOptions(preset: TimeZeroPreset): ExploreOptions {
  return { watch: preset.watch, onCap: "mark", maxRuns: 256 };
}

export function exploreTimeZero(preset: TimeZeroPreset, cfg: TimeZeroConfig): ProcessExploration {
  return exploreProcessOrders(preset.build(cfg), timeZeroExploreOptions(preset));
}

const all = (e: ProcessExploration, test: (r: SimResult) => boolean) => !e.capped && e.outcomes.every((o) => test(o.result));
const differs = (e: ProcessExploration, value: (r: SimResult) => string) => new Set(e.outcomes.map((o) => value(o.result))).size > 1;
const val = (r: SimResult, name: string, t: number) => formatVarValue(valueAt(r, name, t));

/* ---------- (1) time0-reset ---------- */

export function time0ResetScenario(form: ResetForm): ProcessScenario {
  const initializer = form === "initializer";
  const rstDecl: VarDecl = initializer
    ? { name: "rst_n", type: "logic", init: 0, initLabel: "1'b0", key: "decl:rst_n" }
    : { name: "rst_n", type: "logic", key: "decl:rst_n" };
  return {
    id: `time0-reset:${form}`,
    title: "A reset applied at time zero",
    initializerRule: "ieee1800",
    // `always #5 clk = ~clk` never runs out of events: stop the run before the 15 ns release (a model horizon).
    maxTime: 12,
    vars: [{ name: "clk", type: "logic", init: 0 }, rstDecl, { name: "state", type: "logic", enumLabels: ["S_IDLE", "S_RUN"] }],
    processes: [
      { id: "clock", label: "clock", kind: "always", role: "clock", body: [{ kind: "delay", amount: c(5), then: assign("clk", { kind: "inv", operand: v("clk") }) }] },
      {
        id: "flop",
        label: "flop",
        kind: "always",
        keyword: "always_ff",
        role: "design",
        body: [
          {
            id: "flop-event",
            kind: "waitEvents",
            terms: [
              { edge: "posedge", expr: v("clk") },
              { edge: "negedge", expr: v("rst_n") },
            ],
            then: {
              id: "flop-if",
              kind: "if",
              compact: true,
              cond: { kind: "not", operand: v("rst_n") },
              then: [assign("state", lit(0, "S_IDLE"), { nba: true })],
              else: [assign("state", lit(1, "S_RUN"), { nba: true })],
            },
          },
        ],
      },
      {
        id: "bench",
        label: "bench",
        kind: "initial",
        body: initializer
          ? [{ kind: "delay", amount: c(15), then: assign("rst_n", lit(1, "1'b1")) }]
          : [
              assign("rst_n", lit(0, "1'b0"), { id: "reset-write", nba: form === "nonblocking" }),
              { kind: "delay", amount: c(15), then: assign("rst_n", lit(1, "1'b1")) },
            ],
      },
    ],
  };
}

const stateAt0 = (r: SimResult) => valueAt(r, "state", 0);

const time0Reset: TimeZeroPreset = {
  id: "time0-reset",
  label: "reset at t = 0",
  summary: "A flop with an asynchronous active-low reset, a free-running clock, and a bench that applies reset at time 0.",
  notice: (cfg) =>
    cfg.variant === "blocking"
      ? "Open the outcome groups: the only difference is whether the flop or the bench starts first, and that decides whether the x → 0 negedge (Table 9-2) is seen."
      : cfg.variant === "nonblocking"
        ? "Find the NBA step at t = 0: rst_n changes only after every procedure has reached its first timing control, so the flop is always waiting."
        : "Look at the first step: rst_n is 0 before any procedure starts, so there is never an x → 0 change for the flop to see.",
  explore: true,
  variantLabel: "How the bench applies reset",
  variants: [
    { value: "blocking", label: "=", description: "Blocking: initial begin rst_n = 1'b0; #15 rst_n = 1'b1; end" },
    { value: "nonblocking", label: "<=", description: "Nonblocking: initial begin rst_n <= 1'b0; #15 rst_n = 1'b1; end" },
    { value: "initializer", label: "initializer", description: "Declaration initializer: logic rst_n = 1'b0; with initial #15 rst_n = 1'b1;" },
  ],
  variantLineKey: (cfg) => (cfg.variant === "initializer" ? "decl:rst_n" : "reset-write"),
  build: (cfg) => time0ResetScenario(cfg.variant as ResetForm),
  watch: ["state"],
  question: () => "Does state become S_IDLE at t = 0?",
  options: () => [
    {
      id: "always",
      label: "Yes: state is S_IDLE at t = 0 in every order of the ready processes",
      matches: (e) => all(e, (r) => stateAt0(r) === 0),
      feedback: (cfg) =>
        cfg.variant === "nonblocking"
          ? "Right: rst_n <= 1'b0 lands in the NBA region of time 0, after every procedure, the flop included, has run to its first timing control (§4.5, §10.4.2). The flop is already waiting, sees the x → 0 negedge (Table 9-2), and resets at t = 0 in every order."
          : cfg.variant === "blocking"
            ? "Only when the flop happens to start first. Procedures start in no defined order (§9.2): if the bench runs first, the x → 0 negedge (Table 9-2) happens while nothing waits, and state stays x until the 5 ns posedge."
            : "The initializer is set before any procedure starts (§6.8), so rst_n is already 0 when the flop starts waiting. There is no x → 0 change to see, so nothing resets the flop at t = 0.",
    },
    {
      id: "never",
      label: "No: state stays x until the clock rises at 5 ns",
      matches: (e) => all(e, (r) => stateAt0(r) === "X"),
      feedback: (cfg) =>
        cfg.variant === "initializer"
          ? "Right: rst_n = 1'b0 is set before any procedure starts (§6.8), so no change happens after the flop starts waiting (derived from §6.8). The first event the flop sees is the 5 ns posedge of clk; rst_n is 0 then, so state becomes S_IDLE at 5 ns."
          : cfg.variant === "blocking"
            ? "Not always: if the flop starts first, it is already waiting when rst_n goes x → 0, which is a negedge (Table 9-2), and it resets at t = 0. Only the bench-first order misses it."
            : "With <= the update lands in the NBA region, when the flop is already waiting, so it always sees the x → 0 negedge (Table 9-2) at t = 0.",
    },
    {
      id: "depends",
      label: "It depends on which procedure the simulator starts first",
      matches: (e) => !e.capped && differs(e, (r) => formatVarValue(stateAt0(r))),
      feedback: (cfg) =>
        cfg.variant === "blocking"
          ? "Right: procedures start in no defined order (§9.2). Flop first: it waits, the bench's x → 0 is a negedge (Table 9-2), and state resets at 0. Bench first: the negedge happens while nothing waits, so state stays x until the 5 ns posedge, where rst_n is low."
          : cfg.variant === "nonblocking"
            ? "Not with <=: the update waits for the NBA region, and by then every procedure has run to its first timing control (§4.5), so the start order no longer matters."
            : "Not here: the initializer is set before any procedure starts (§6.8), so every order sees the same thing — no change at time 0.",
    },
  ],
  orderNote: "Whether flop or bench starts first decides the outcome; the clock's place in the order does not matter.",
  assumptions: [
    "The run stops at a 12 ns horizon (a model limit): always #5 clk = ~clk never runs out of events, and the 15 ns reset release is a separate question.",
    "Edges follow Table 9-2 (§9.4.2): x → 0 is a negedge, 0 → 1 a posedge.",
  ],
};

/* ---------- (2) comb-vs-star ---------- */

/** Key of the stimulus line in comb-vs-star; in "inputs-static" a comment line keeps it. */
export const COMB_STIMULUS_KEY = "stim-line";

export function combVsStarScenario(variant: CombVariant, advanced: boolean): ProcessScenario {
  return {
    id: `comb-vs-star:${variant}:${advanced ? "initial" : "decl"}`,
    title: "always_comb is not always @*",
    initializerRule: "ieee1800",
    // F2C's listing: logic a = 1'b1; logic y1, y2; ... initial #10 a = 1'b0;
    vars: [
      advanced ? { name: "a", type: "logic", key: "decl:a" } : { name: "a", type: "logic", init: 1, initLabel: "1'b1", key: "decl:a" },
      { name: "y1", type: "logic" },
      { name: "y2", type: "logic", sharesLine: true },
    ],
    processes: [
      { id: "star", label: "star", kind: "always_star", role: "design", body: [assign("y1", v("a"))] },
      { id: "comb", label: "comb", kind: "always_comb", role: "design", body: [assign("y2", v("a"))] },
      ...(advanced ? [{ id: "init-a", label: "init a", kind: "initial" as const, body: [assign("a", lit(1, "1'b1"), { id: "init-a-write" })] }] : []),
      ...(variant === "inputs-change"
        ? [
            {
              id: "stim",
              label: "stimulus",
              kind: "initial" as const,
              body: [{ id: COMB_STIMULUS_KEY, kind: "delay" as const, amount: c(10), then: assign("a", lit(0, "1'b0")) }],
            },
          ]
        : []),
    ],
    // a static: the stimulus line stays, as a comment, so the control in it does not move.
    ...(variant === "inputs-static" ? { commentLines: [{ key: COMB_STIMULUS_KEY, text: "(no initial #10 a = 1'b0;)" }] } : {}),
  };
}

const combOptionsBasic = (variant: CombVariant): TimeZeroPredictionOption[] => {
  const at = variant === "inputs-change" ? "at 0 ns; both 0 at 10 ns" : "when the run ends";
  const grade = (y1: SvVal, y2: SvVal) => (e: ProcessExploration) =>
    all(e, (r) =>
      variant === "inputs-change"
        ? valueAt(r, "y1", 0) === y1 && valueAt(r, "y2", 0) === y2 && valueAt(r, "y1", 10) === 0 && valueAt(r, "y2", 10) === 0
        : r.finalVars.y1 === y1 && r.finalVars.y2 === y2,
    );
  return [
    {
      id: "comb-only",
      label: `y1 = x, y2 = 1 ${at}`,
      matches: grade("X", 1),
      feedback: () =>
        variant === "inputs-change"
          ? "Right: always_comb is triggered once at time zero, after every procedure has started, so y2 = 1 at once (§9.2.2.2). always @* waits for a change of a (§9.2.2.2.2), and the initializer happened before anything waited (§6.8), so y1 stays x until a falls at 10 ns, which wakes both."
          : "Right: a never changes after its initializer, so always @* never runs and y1 stays x for the whole run; always_comb ran once at time zero, so y2 = 1 (§9.2.2.2.2).",
    },
    {
      id: "both",
      label: `y1 = 1, y2 = 1 ${at}`,
      matches: grade(1, 1),
      feedback: () =>
        "That would need always @* to run at time 0. It does not: it waits until something it reads changes (§9.2.2.2.2), and the initializer of a was set before any procedure started, so that is not a change it can see (§6.8).",
    },
    {
      id: "neither",
      label: `y1 = x, y2 = x ${at}`,
      matches: grade("X", "X"),
      feedback: () => "always_comb is different: it is triggered once at time zero, after all initial and always procedures have started, so y2 follows a from the start (§9.2.2.2).",
    },
    {
      id: "swapped",
      label: `y1 = 1, y2 = x ${at}`,
      matches: grade(1, "X"),
      feedback: () => "Swapped: always_comb (y2) is the one with the time-zero run; always @* (y1) waits for a change.",
    },
    // The 10 ns half of the question: a learner who thinks @* never updates y1 picks this one.
    ...(variant === "inputs-change"
      ? [
          {
            id: "star-never",
            label: "y1 = x, y2 = 1 at 0 ns; y1 still x, y2 = 0 at 10 ns",
            matches: (e: ProcessExploration) =>
              all(e, (r) => valueAt(r, "y1", 0) === "X" && valueAt(r, "y2", 0) === 1 && valueAt(r, "y1", 10) === "X" && valueAt(r, "y2", 10) === 0),
            feedback: () =>
              "Half right: the 0 ns values are correct, but not y1 at 10 ns. always @* is waiting on a: @* adds every variable its statement reads to the event expression (§9.4.2.2). a going 1 → 0 at 10 ns is a change, so it wakes star and y1 = 0. @* misses only the initializer, which was set before anything waited (§6.8).",
          },
        ]
      : []),
  ];
};

// Every label has the same shape (a y1 clause, then a y2 clause), so length gives nothing away.
const combOptionsAdvanced = (): TimeZeroPredictionOption[] => [
  {
    id: "adv-yes",
    label: "Yes, in every order: y1 = 1 at t = 0; y2 = 1 at t = 0 too",
    matches: (e) => all(e, (r) => valueAt(r, "y1", 0) === 1 && valueAt(r, "y2", 0) === 1),
    feedback: () =>
      "Only if star is already waiting at @* when init a runs a = 1'b1. The standard starts procedures in no defined order (§9.2), so init a may run first and the change is gone before star waits.",
  },
  {
    id: "adv-no",
    label: "No, never: y1 stays x at t = 0; y2 = 1 at t = 0",
    matches: (e) => all(e, (r) => valueAt(r, "y1", 0) === "X" && valueAt(r, "y2", 0) === 1),
    feedback: () => "Unlike the initializer, initial a = 1'b1; is a real change from x to 1 at time 0. If star starts first and waits at @*, that change wakes it, and y1 = 1.",
  },
  {
    id: "adv-depends",
    label: "It depends on the start order for y1; y2 = 1 at t = 0 either way",
    matches: (e) => !e.capped && differs(e, (r) => val(r, "y1", 0)) && all(e, (r) => valueAt(r, "y2", 0) === 1),
    feedback: () =>
      "Right: whether @* catches the write depends on whether star starts before init a (§9.2), so there are two outcome groups. y2 does not race: always_comb is sensitive to a (§9.2.2.2.1), so even if its time-zero run came before init a's write, that write wakes it again, and y2 ends time 0 at 1 in every order.",
  },
  {
    id: "adv-both-depend",
    label: "It depends on the start order for y1; y2 at t = 0 depends on it too",
    matches: (e) => !e.capped && differs(e, (r) => val(r, "y1", 0)) && differs(e, (r) => val(r, "y2", 0)),
    feedback: () =>
      "y2 does not race. always_comb is sensitive to a (§9.2.2.2.1): even if its time-zero run came before init a's write, that write wakes it again, so y2 ends time 0 at 1 in every order. Only y1, from always @*, depends on the start order.",
  },
];

const combVsStar: TimeZeroPreset = {
  id: "comb-vs-star",
  label: "always_comb vs @*",
  summary: "Two blocks copy a into y1 and y2: one written always @*, one always_comb.",
  notice: (cfg) =>
    cfg.advanced
      ? "Compare the outcome groups: the start order of star and init a decides y1, while comb runs after both have started."
      : "Watch the comb lane: it starts only after every other procedure has started, and runs once. The star lane just waits.",
  explore: true,
  variantLabel: "What happens to a after time 0",
  variants: [
    { value: "inputs-change", label: "a falls", description: "a falls at 10 ns: initial #10 a = 1'b0;" },
    { value: "inputs-static", label: "a static", description: "a static: it never changes after time 0 (no initial #10 a = 1'b0;)" },
  ],
  // The control sits on the stimulus line, which stays (as a comment) when a is static.
  variantLineKey: () => COMB_STIMULUS_KEY,
  advanced: {
    label: "Show advanced: start a with initial a = 1'b1;",
    off: "Declaration initializer: logic a = 1'b1;",
    on: "Procedure: logic a; with initial a = 1'b1;",
  },
  build: (cfg) => combVsStarScenario(cfg.variant as CombVariant, cfg.advanced),
  watch: ["y1", "y2"],
  question: (cfg) =>
    cfg.advanced
      ? "a now gets its 1 from initial a = 1'b1; at t = 0. Does always @* see that write?"
      : cfg.variant === "inputs-change"
        ? "What are y1 and y2 at t = 0 (once time 0 settles) and at t = 10 ns?"
        : "a never changes after its initializer. What do y1 and y2 hold when the run ends?",
  options: (cfg) => (cfg.advanced ? combOptionsAdvanced() : combOptionsBasic(cfg.variant as CombVariant)),
  orderNote: "With the initializer there is nothing to race. With initial a = 1'b1;, whether star starts before init a decides y1.",
  assumptions: [
    "always_comb's time-zero run is placed after every initial and always procedure has started (§9.2.2.2); its inferred sensitivity follows §9.2.2.2.1, and @* follows §9.4.2.2.",
    "Placement: the model runs each started procedure to its first wait before always_comb's time-zero run. That is one legal order; §9.2.2.2 promises only that the run comes after every procedure has started, and §4.7 lets a started procedure be suspended part way.",
  ],
};

/* ---------- (3) time0-race (F3A) ---------- */

export function time0RaceScenario(variant: RaceVariant): ProcessScenario {
  const fix = variant === "fix";
  return {
    id: `time0-race:${variant}`,
    title: "The time-0 race",
    initializerRule: "ieee1800",
    vars: [
      fix
        ? { name: "a", type: "logic", init: 0, key: "decl:a", comment: "set before any process starts (§6.8): no change to miss" }
        : { name: "a", type: "logic", key: "decl:a", comment: "starts as x: no declaration initializer" },
    ],
    processes: [
      { id: "watcher", label: "always block", kind: "always", body: [onChange(["a"], { kind: "display", format: "t=%0d a=%b", args: [now, v("a")] })] },
      {
        id: "driver",
        label: "initial block",
        kind: "initial",
        body: [
          ...(fix ? [] : [assign("a", c(0), { id: "race-write" })]),
          { kind: "delay", amount: c(10), then: assign("a", c(1)) },
          { kind: "delay", amount: c(10), then: assign("a", c(0)) },
        ],
      },
    ],
  };
}

const lineCount = (r: SimResult) => r.log.length;

/** F3A's names for the two orders, keyed by the block that starts first. */
const RACE_ORDER_NAMES: Record<string, string | undefined> = { "always block": "Order A", "initial block": "Order B" };

const time0Race: TimeZeroPreset = {
  id: "time0-race",
  label: "the time-0 race",
  summary: "An always block prints every change of a; an initial block drives a at 0, 10 and 20 ns.",
  notice: (cfg) =>
    cfg.variant === "fix"
      ? "Both orders now print the same two lines: a is 0 before either block starts, so there is no time-0 change to win or lose."
      : "Compare Order A and Order B in the outcome groups: they split at the very first choice, and only the t = 0 line differs.",
  explore: true,
  variantLabel: "Declaration of a",
  variants: [
    { value: "as-written", label: "as written", description: "As written: logic a; with a = 0 in the initial block" },
    { value: "fix", label: "fix", description: "The fix: logic a = 0; and initial begin #10 a = 1; #10 a = 0; end" },
  ],
  variantLineKey: () => "decl:a",
  build: (cfg) => time0RaceScenario(cfg.variant as RaceVariant),
  watch: [],
  question: () => "How many lines does this print?",
  options: () => [
    {
      id: "three",
      label: "3 lines, on every simulator",
      matches: (e) => all(e, (r) => lineCount(r) === 3),
      feedback: (cfg) =>
        cfg.variant === "fix"
          ? "With the fix, a is already 0 when the always block starts waiting (§6.8), so nothing prints at t = 0: only the changes at 10 and 20 ns."
          : "Only in Order A, where the always block starts first and is waiting when a goes x → 0. The standard does not promise that order (§9.2).",
    },
    {
      id: "two",
      label: "2 lines, on every simulator",
      matches: (e) => all(e, (r) => lineCount(r) === 2),
      feedback: (cfg) =>
        cfg.variant === "fix"
          ? "Right: the initializer sets a = 0 before any process starts (§6.8), so there is no change at t = 0 for any order to catch. Both orders print t=10 a=1 and t=20 a=0."
          : "Only in Order B, where the initial block runs a = 0 before the always block waits. In Order A the always block catches that x → 0 change and prints a third line.",
    },
    {
      id: "depends",
      label: "2 or 3: it depends on which block the simulator starts first",
      matches: (e) => !e.capped && differs(e, (r) => String(lineCount(r))),
      feedback: (cfg) =>
        cfg.variant === "fix"
          ? "Not after the fix: every order prints the same two lines."
          : "Right: initial and always procedures start in no implied order (§9.2). Order A (always block first) prints t=0 a=0, t=10 a=1 and t=20 a=0; Order B (initial block first) misses the t = 0 change and prints only the last two. Both are legal.",
    },
  ],
  orderNote: "Order A: the always block starts first. Order B: the initial block starts first.",
  outcomeName: (run) => RACE_ORDER_NAMES[startOrder(run)[0] ?? ""],
  assumptions: ["After t = 20 nothing is scheduled, so the run ends by itself (§9.6.1); the always block is still waiting, which is normal."],
};

/* ---------- (4) decl-init-ready (F1C) ---------- */

export function declInitReadyScenario(rule: InitRuleVariant): ProcessScenario {
  return {
    id: `decl-init-ready:${rule}`,
    title: "Declaration initializers: 1800 versus 1364-2005",
    initializerRule: rule,
    vars: [{ name: "ready", type: "reg", init: 1, initLabel: "1'b1", key: "decl:ready" }],
    processes: [
      { id: "watcher", label: "always block", kind: "always", body: [onChange(["ready"], { kind: "display", format: "ready changed to %b", args: [v("ready")] })] },
    ],
  };
}

const printsAt0 = (r: SimResult) => r.log.some((l) => l.time === 0);

const declInitReady: TimeZeroPreset = {
  id: "decl-init-ready",
  label: "initializer: 1800 vs 1364",
  summary: "One reg with an initializer, and an always block that prints whenever it changes.",
  notice: (cfg) =>
    cfg.variant === "ieee1364-2005"
      ? "Under the old rule the initializer is one more time-zero process, so the outcome groups split on who runs first."
      : "The first step sets ready before any procedure exists to see it; the always block then waits for a change that never comes.",
  explore: true,
  variantLabel: "Initializer rule",
  variants: [
    { value: "ieee1800", label: "1800-2023", description: "IEEE 1800-2023 (6.8): initial value set before any procedure starts" },
    { value: "ieee1364-2005", label: "1364-2005", description: "IEEE 1364-2005 behaviour (6.8 NOTE): as if initial ready = 1'b1;" },
  ],
  variantLineKey: () => "decl:ready",
  build: (cfg) => declInitReadyScenario(cfg.variant as InitRuleVariant),
  watch: [],
  question: () => "Does the line print at t = 0?",
  options: () => [
    {
      id: "yes",
      label: "Yes: ready goes from x to 1, and the always block sees it",
      matches: (e) => all(e, printsAt0),
      feedback: (cfg) =>
        cfg.variant === "ieee1364-2005"
          ? "Only when the always block runs first. Under the 1364-2005 behaviour the initializer is like an initial procedure, and procedures start in no defined order (§6.8 NOTE, §9.2)."
          : "In SystemVerilog the value is set before any procedure starts (§6.8), so ready is already 1 when the always block starts waiting. There is no change at time 0.",
    },
    {
      id: "no",
      label: "No: nothing prints at t = 0",
      matches: (e) => all(e, (r) => !printsAt0(r)),
      feedback: (cfg) =>
        cfg.variant === "ieee1800"
          ? "Right: IEEE 1800-2023 sets a static variable's initial value before any initial or always procedure starts (§6.8). No procedure exists yet to see it, so it produces no event (derived from §6.8), and @(ready) waits for a change that never comes."
          : "Not under the old rule: if the always block happens to run first, the initializer's x → 1 change wakes it and the line prints.",
    },
    {
      id: "depends",
      label: "It depends on which process runs first",
      matches: (e) => !e.capped && differs(e, (r) => String(printsAt0(r))),
      feedback: (cfg) =>
        cfg.variant === "ieee1364-2005"
          ? "Right: under the IEEE 1364-2005 behaviour the initializer ran as if from an initial procedure after simulation started (§6.8 NOTE). It is a time-zero process in no defined order with the always block (§9.2): always block first, it prints; initializer first, it is silent."
          : "Not in SystemVerilog: the initializer is not a process at all. It is set before any procedure starts (§6.8), so every order agrees.",
    },
  ],
  orderNote: "Under 1364-2005 the initializer is a process too: whether it runs before the always block starts waiting decides the output.",
  assumptions: ["The 1364-2005 behaviour comes only from the §6.8 NOTE; the model runs the initializer as one more time-zero initial process."],
};

export const timeZeroScenarios: TimeZeroPreset[] = [time0Reset, combVsStar, time0Race, declInitReady];

export const TIME_ZERO_IDS: TimeZeroScenarioId[] = timeZeroScenarios.map((s) => s.id);

export function isTimeZeroScenario(id: ProceduralScenarioId): id is TimeZeroScenarioId {
  return (TIME_ZERO_IDS as string[]).includes(id);
}

export function getTimeZeroScenario(id: TimeZeroScenarioId): TimeZeroPreset {
  return timeZeroScenarios.find((s) => s.id === id) ?? timeZeroScenarios[0];
}

/** Every preset id, in picker order. */
export const ALL_PROCEDURAL_SCENARIO_IDS: ProceduralScenarioId[] = [...proceduralScenarios.map((s) => s.id), ...TIME_ZERO_IDS];

/** The four single-run programs: the picker the embeds that predate the time-zero programs show. */
export const SINGLE_RUN_SCENARIO_IDS: ProceduralScenarioId[] = proceduralScenarios.map((s) => s.id);

/**
 * The programs the picker offers. `scenarios` restricts it, in that order.
 * Omitted: the four single-run programs, or only `requested` when that is a
 * time-zero program, so time-zero programs appear only where an embed opts in.
 */
export function pickerScenarios(requested?: ProceduralScenarioId, scenarios?: ProceduralScenarioId[]): ProceduralScenarioId[] {
  const picked = [...new Set((scenarios ?? []).filter((id) => ALL_PROCEDURAL_SCENARIO_IDS.includes(id)))];
  if (picked.length) return picked;
  if (requested && isTimeZeroScenario(requested)) return [requested];
  return SINGLE_RUN_SCENARIO_IDS;
}

/** Picker label for any preset. */
export function scenarioLabel(id: ProceduralScenarioId): string {
  return isTimeZeroScenario(id) ? getTimeZeroScenario(id).label : getProceduralScenario(id).label;
}

/**
 * "x at 0 ns, S_IDLE from 5 ns": what a waveform viewer would show for one variable.
 * `spoken` names x "unknown (x)", the cue visual-language.md asks of accessible names.
 */
export function describeHistory(result: SimResult, name: string, decl?: VarDecl, options: { spoken?: boolean } = {}): string {
  const history = settledHistory(result, name);
  if (history.length === 0) return `${name}: not recorded`;
  const show = (value: SvVal) => (options.spoken && value === "X" ? `unknown (${formatVarValue(value, decl)})` : formatVarValue(value, decl));
  return `${name}: ${history.map((h, i) => (i === 0 ? `${show(h.value)} at ${h.time} ns` : `${show(h.value)} from ${h.time} ns`)).join(", ")}`;
}

/** Card names for an outcome group: the preset's name for that order, or "Outcome n". */
export function outcomeTitle(preset: Pick<TimeZeroPreset, "outcomeName">, run: SimResult, index: number): { title: string; inline: string } {
  const named = preset.outcomeName?.(run);
  return named ? { title: named, inline: named } : { title: `Outcome ${index + 1}`, inline: `outcome ${index + 1}` };
}

/* ---------- Outcome waveform layout (pure, so the drawing can be tested) ---------- */

/** Horizontal extent of the bars in the waveform's 300-unit-wide viewBox. */
export const TIMELINE_X0 = 54;
export const TIMELINE_X1 = 292;

/** Width a bar needs for its value label: 4 units of padding each side and about 6 per mono character at 10 px. */
export const timelineLabelWidth = (text: string) => 8 + 6 * text.length;

export interface TimelineSegment {
  /** Time the value was settled from. */
  time: number;
  value: SvVal;
  /** The value as the source names it (x, an enum label, 0/1). */
  label: string;
  unknown: boolean;
  /** viewBox x of the bar's left and right edges. */
  from: number;
  to: number;
  /** The bar is wide enough to carry its label. */
  labelFits: boolean;
}

export interface TimelineLayout {
  /** The run's last time step, marked on the axis. */
  endTime: number;
  /**
   * Right edge of the axis, past `endTime`: the last value of every row stays
   * drawn after the final time step, so a change at that step still gets a
   * labelled bar instead of a sliver at the edge.
   */
  axisEnd: number;
  /** viewBox x of `endTime`. */
  endX: number;
  ticks: { time: number; x: number }[];
  rows: { name: string; segments: TimelineSegment[] }[];
}

/** Settled values over time for the watched variables, laid out for the outcome waveform. */
export function timelineLayout(result: SimResult, names: string[], decls: Map<string, VarDecl> = new Map()): TimelineLayout {
  const endTime = result.endTime;
  // At least 20% of the width for the value after the last step: max(2, 25%) past endTime.
  const axisEnd = endTime + Math.max(2, endTime * 0.25);
  const xOf = (t: number) => TIMELINE_X0 + (Math.min(t, axisEnd) / axisEnd) * (TIMELINE_X1 - TIMELINE_X0);
  const rows = names.map((name) => {
    const history = settledHistory(result, name);
    const segments = history.map((h, k): TimelineSegment => {
      const from = xOf(h.time);
      const to = k + 1 < history.length ? xOf(history[k + 1].time) : TIMELINE_X1;
      const label = formatVarValue(h.value, decls.get(name));
      return { time: h.time, value: h.value, label, unknown: h.value === "X", from, to, labelFits: to - from >= timelineLabelWidth(label) };
    });
    return { name, segments };
  });
  const times = [...new Set([0, ...rows.flatMap((r) => r.segments.map((s) => s.time)), endTime])].sort((a, b) => a - b);
  return { endTime, axisEnd, endX: xOf(endTime), ticks: times.map((time) => ({ time, x: xOf(time) })), rows };
}

/** The default variant of a preset, or `requested` when the preset has it. */
export function initialVariantOf(preset: TimeZeroPreset, requested?: string): string {
  return preset.variants.some((o) => o.value === requested) ? (requested as string) : preset.variants[0].value;
}
