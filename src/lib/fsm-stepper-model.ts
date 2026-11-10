/**
 * Two-process FSM model: an always_ff that holds the state and an always_comb
 * that computes the next state and the outputs, evaluated edge by edge.
 *
 * Rules, all checked against IEEE 1800-2023:
 * - 10.4.2 Nonblocking procedural assignments: `state <= state_next` evaluates
 *   its right-hand side when the always_ff runs at the edge and updates `state`
 *   in the NBA region, after the processes woken by that edge have run. So
 *   everything that samples at edge k sees the old state; the new one appears
 *   just after the edge.
 * - 9.2.2.4 always_ff: one event control, and the variables it writes are
 *   written by no other process. Here it is the only writer of `state`.
 * - 9.2.2.2 always_comb: runs once at time zero and again whenever something
 *   it reads changes (implicit sensitivity, 9.2.2.2.1). Its outputs are written
 *   by no other process. "Software tools should perform additional checks to
 *   warn ... if latched behavior can be inferred": a should, not a guarantee.
 * - 12.5 case: the case expression is evaluated once, the items are compared
 *   in the order written, and the first match runs. With no match and no
 *   default, no item runs, so a variable the items would assign keeps its value.
 * - 6.19.4: an enum name used in an expression is cast to the base type, and
 *   assigning a non-enum expression to an enum variable needs a cast. The
 *   lesson's `if` form assigns enum names directly, so no cast is needed.
 *
 * Time model (same as the lessons' TimingDiagrams): column k is rising edge k.
 * A value in column k is the value sampled at that edge. Pure, no React.
 */

export type Bit = 0 | 1;

/* ------------------------------------------------------------------------ */
/* The 101 sequence detector                                                */
/* ------------------------------------------------------------------------ */

export type DetectorStyle = "mealy" | "moore";
export type DetectState = "S_IDLE" | "S_GOT_1" | "S_GOT_10" | "S_FOUND";
export type DetectTarget = "state_next" | "detected";

export type DetectValue = { kind: "state"; name: DetectState } | { kind: "current" } | { kind: "din" } | { kind: "bit"; bit: Bit };

export interface DetectAssign {
  target: DetectTarget;
  value: DetectValue;
}

export type DetectStmt =
  | { kind: "assign"; assign: DetectAssign; comment?: string }
  | { kind: "if"; cond: "din" | "!din"; then: DetectAssign; else?: DetectAssign; comment?: string; elseComment?: string };

export interface DetectArm {
  state: DetectState;
  stmts: DetectStmt[];
}

export interface DetectorMachine {
  style: DetectorStyle;
  /** Enum order: the first name has encoding 0 (6.19). */
  states: DetectState[];
  /** Width of the enum's base type, logic [1:0]. */
  encodingWidth: number;
  seeds: DetectAssign[];
  arms: DetectArm[];
}

const st = (name: DetectState): DetectValue => ({ kind: "state", name });
const nextIs = (name: DetectState): DetectAssign => ({ target: "state_next", value: st(name) });

const MEALY: DetectorMachine = {
  style: "mealy",
  states: ["S_IDLE", "S_GOT_1", "S_GOT_10"],
  encodingWidth: 2,
  seeds: [
    { target: "state_next", value: { kind: "current" } },
    { target: "detected", value: { kind: "bit", bit: 0 } },
  ],
  arms: [
    { state: "S_IDLE", stmts: [{ kind: "if", cond: "din", then: nextIs("S_GOT_1") }] },
    { state: "S_GOT_1", stmts: [{ kind: "if", cond: "!din", then: nextIs("S_GOT_10") }] },
    {
      state: "S_GOT_10",
      stmts: [
        { kind: "assign", assign: { target: "detected", value: { kind: "din" } }, comment: "Mealy output: depends on the state and on din" },
        { kind: "if", cond: "din", then: nextIs("S_GOT_1"), else: nextIs("S_IDLE"), comment: "the final 1 can start the next match" },
      ],
    },
  ],
};

const MOORE: DetectorMachine = {
  style: "moore",
  states: ["S_IDLE", "S_GOT_1", "S_GOT_10", "S_FOUND"],
  encodingWidth: 2,
  seeds: MEALY.seeds,
  arms: [
    { state: "S_IDLE", stmts: [{ kind: "if", cond: "din", then: nextIs("S_GOT_1") }] },
    { state: "S_GOT_1", stmts: [{ kind: "if", cond: "!din", then: nextIs("S_GOT_10") }] },
    { state: "S_GOT_10", stmts: [{ kind: "if", cond: "din", then: nextIs("S_FOUND"), else: nextIs("S_IDLE") }] },
    {
      state: "S_FOUND",
      stmts: [
        { kind: "assign", assign: { target: "detected", value: { kind: "bit", bit: 1 } }, comment: "Moore output: depends on the state only" },
        {
          kind: "if",
          cond: "din",
          then: nextIs("S_GOT_1"),
          else: nextIs("S_GOT_10"),
          comment: "this new 1 starts the next match",
          elseComment: "the match's final 1 and this 0 are a 1 0 prefix",
        },
      ],
    },
  ],
};

export function detectorMachine(style: DetectorStyle): DetectorMachine {
  return style === "mealy" ? MEALY : MOORE;
}

export const RESET_STATE: DetectState = "S_IDLE";

/** Encodings of the enum's base type that no enum name uses (6.19: names take 0, 1, 2 ... in order). */
export function unusedEncodings(machine: DetectorMachine): string[] {
  const out: string[] = [];
  for (let code = machine.states.length; code < 2 ** machine.encodingWidth; code += 1) {
    out.push(`${machine.encodingWidth}'b${code.toString(2).padStart(machine.encodingWidth, "0")}`);
  }
  return out;
}

/** Label of the row for a select that matches no case item (x, and any unused encoding). */
export function noMatchLabel(machine: DetectorMachine): string {
  const unused = unusedEncodings(machine);
  return unused.length ? `x or ${unused.join(", ")}` : "x";
}

/** Every select that matches no case item: x, then each unused encoding (12.5, 6.19). */
export function noMatchSelects(machine: DetectorMachine): DetectSelect[] {
  return ["x", ...(unusedEncodings(machine) as UnusedEncoding[])];
}

/* ---- code text, generated from the same data the model executes ---- */

export interface FsmCodeLine {
  text: string;
  key?: string;
}

function valueText(v: DetectValue): string {
  if (v.kind === "state") return v.name;
  if (v.kind === "current") return "state";
  if (v.kind === "din") return "din";
  return `1'b${v.bit}`;
}

export function assignText(a: DetectAssign): string {
  return `${a.target} = ${valueText(a.value)};`;
}

/** Comments inside a case item start at least this many columns after the item's indent, as in the lesson. */
const ITEM_COMMENT_COLUMN = 21;
const withComment = (text: string, comment?: string) =>
  comment ? `${text.padEnd(Math.max(text.length + 3, ITEM_COMMENT_COLUMN))}// ${comment}` : text;

/** Whether an arm is printed as `begin ... end`. */
const armIsBlock = (arm: DetectArm) => arm.stmts.length > 1 || arm.stmts.some((s) => s.kind === "if" && s.else);

export const armKey = (state: DetectState) => `arm:${state}`;
export const armLineKey = (state: DetectState, stmt: number, branch: "then" | "else" | "assign") => `arm:${state}:${stmt}:${branch}`;

export const SEED_KEYS: Record<DetectTarget, string> = { state_next: "seed:state_next", detected: "seed:detected" };

/** The lesson's code, with the seed lines removed when `seeds` is false. */
export function detectorCode(machine: DetectorMachine, seeds = true): FsmCodeLine[] {
  const lines: FsmCodeLine[] = [
    { text: `typedef enum logic [${machine.encodingWidth - 1}:0] {${machine.states.join(", ")}} state_t;`, key: "typedef" },
    { text: "state_t state, state_next;" },
    { text: "" },
    { text: "always_ff @(posedge clk or negedge rst_n) begin   // the only writer of state", key: "ff:head" },
    { text: `  if (!rst_n) state <= ${RESET_STATE};`, key: "ff:reset" },
    { text: "  else        state <= state_next;", key: "ff:update" },
    { text: "end" },
    { text: "" },
    { text: "always_comb begin", key: "comb:head" },
  ];
  machine.seeds.forEach((seed, i) => {
    const text = seed.target === "detected" ? `detected   = ${valueText(seed.value)};` : assignText(seed);
    const comment = i === 0 ? "seed every output: no path can infer a latch" : undefined;
    lines.push(
      seeds
        ? { text: comment ? `  ${text.padEnd(25)}// ${comment}` : `  ${text}`, key: SEED_KEYS[seed.target] }
        : { text: `  // removed: ${text}`, key: SEED_KEYS[seed.target] },
    );
  });
  const unused = unusedEncodings(machine);
  lines.push({
    text: `  unique case (state)      // no default: an x${unused.length ? " or illegal" : ""} state is reported`,
    key: "case:head",
  });
  const labelWidth = Math.max(...machine.states.map((s) => s.length)) + 2;
  for (const arm of machine.arms) {
    const label = `${arm.state}:`.padEnd(labelWidth);
    if (!armIsBlock(arm)) {
      const stmt = arm.stmts[0];
      if (stmt.kind === "if") {
        lines.push({ text: `    ${label}${`if (${stmt.cond})`.padEnd(9)} ${assignText(stmt.then)}`, key: armLineKey(arm.state, 0, "then") });
      } else {
        lines.push({ text: `    ${label}${withComment(assignText(stmt.assign), stmt.comment)}`, key: armLineKey(arm.state, 0, "assign") });
      }
      continue;
    }
    lines.push({ text: `    ${label}begin`, key: armKey(arm.state) });
    arm.stmts.forEach((stmt, i) => {
      if (stmt.kind === "assign") {
        lines.push({ text: `      ${withComment(assignText(stmt.assign), stmt.comment)}`, key: armLineKey(arm.state, i, "assign") });
      } else {
        const head = `if (${stmt.cond})`;
        lines.push({ text: `      ${withComment(`${head} ${assignText(stmt.then)}`, stmt.comment)}`, key: armLineKey(arm.state, i, "then") });
        if (stmt.else) {
          lines.push({ text: `      ${withComment(`${"else".padEnd(head.length)} ${assignText(stmt.else)}`, stmt.elseComment)}`, key: armLineKey(arm.state, i, "else") });
        }
      }
    });
    lines.push({ text: "    end", key: `${armKey(arm.state)}:end` });
  }
  lines.push({ text: "  endcase" }, { text: "end" });
  return lines;
}

/* ---- evaluation of one always_comb run ---- */

/** An encoding of the base type that no enum name uses, such as 2'b11 (6.19). */
export type UnusedEncoding = `${number}'b${string}`;
/** The value of `state` when the case runs: an enum name, x, or an unused encoding. */
export type DetectSelect = DetectState | "x" | UnusedEncoding;

export interface CombRun {
  /** The case item that ran (12.5: first match in written order), or null when none matched. */
  armIndex: number | null;
  /** Value each output ends with, or "unassigned" when no executed statement wrote it. */
  values: Record<DetectTarget, DetectState | Bit | "x" | UnusedEncoding | "unassigned">;
  /** Where each output's value came from. */
  source: Record<DetectTarget, "seed" | "item" | "none">;
  /** Keys of the code lines that executed an assignment inside the case item. */
  executedKeys: string[];
  /** Key of the line that decided the next state inside the item (an if branch), when the item has one. */
  decidingKey?: string;
}

function evalValue(v: DetectValue, state: DetectSelect, din: Bit): DetectState | Bit | "x" | UnusedEncoding {
  if (v.kind === "state") return v.name;
  if (v.kind === "current") return state;
  if (v.kind === "din") return din;
  return v.bit;
}

/** One run of the always_comb for a given state and din (din is 0 or 1 only). */
export function runComb(machine: DetectorMachine, state: DetectSelect, din: Bit, seeds = true): CombRun {
  const values: CombRun["values"] = { state_next: "unassigned", detected: "unassigned" };
  const source: CombRun["source"] = { state_next: "none", detected: "none" };
  if (seeds) {
    for (const seed of machine.seeds) {
      values[seed.target] = evalValue(seed.value, state, din);
      source[seed.target] = "seed";
    }
  }
  // 12.5: linear search in written order; the first matching item runs. The compare is exact
  // in 0, 1, x and z, so x matches no item, and nor does an encoding no enum name uses.
  const armIndex = machine.arms.findIndex((arm) => arm.state === state);
  const executedKeys: string[] = [];
  let decidingKey: string | undefined;
  if (armIndex >= 0) {
    const arm = machine.arms[armIndex];
    arm.stmts.forEach((stmt, i) => {
      const write = (a: DetectAssign, key: string) => {
        values[a.target] = evalValue(a.value, state, din);
        source[a.target] = "item";
        executedKeys.push(key);
      };
      if (stmt.kind === "assign") {
        write(stmt.assign, armLineKey(arm.state, i, "assign"));
        return;
      }
      const taken = stmt.cond === "din" ? din === 1 : din === 0;
      if (taken) {
        write(stmt.then, armLineKey(arm.state, i, "then"));
        decidingKey = armLineKey(arm.state, i, "then");
      } else if (stmt.else) {
        write(stmt.else, armLineKey(arm.state, i, "else"));
        decidingKey = armLineKey(arm.state, i, "else");
      } else {
        // The if is false and has no else: nothing in this item writes its target.
        decidingKey = armLineKey(arm.state, i, "then");
      }
    });
  }
  return { armIndex: armIndex >= 0 ? armIndex : null, values, source, executedKeys, decidingKey };
}

/* ---- unassigned-path analysis per (state, din) cell (9.2.2.2, 12.5) ---- */

export interface CellAnalysis {
  /** A state, or "x" for the no-match row (x and every unused encoding). */
  select: DetectState | "x";
  din: Bit;
  armIndex: number | null;
  /** Outputs that no statement on this path assigns. */
  unassigned: DetectTarget[];
}

export const DETECT_TARGETS: DetectTarget[] = ["state_next", "detected"];

/**
 * Every (state, din) cell, plus one no-match row. The no-match row covers x and every unused
 * encoding: none of them matches an item, so an output is unassigned there if any of them leaves it so.
 */
export function analyzeUnassigned(machine: DetectorMachine, seeds: boolean): CellAnalysis[] {
  const rows: (DetectState | "x")[] = [...machine.states, "x"];
  const cells: CellAnalysis[] = [];
  for (const row of rows) {
    const selects: DetectSelect[] = row === "x" ? noMatchSelects(machine) : [row];
    for (const din of [0, 1] as Bit[]) {
      const runs = selects.map((select) => runComb(machine, select, din, seeds));
      cells.push({
        select: row,
        din,
        armIndex: runs[0].armIndex,
        unassigned: DETECT_TARGETS.filter((t) => runs.some((r) => r.source[t] === "none")),
      });
    }
  }
  return cells;
}

export interface CellText {
  /** What the always_comb gives on this path: values, or which output holds its old value. */
  main: string;
  /** Set when an output is unassigned on this path. */
  warning?: string;
}

const HOLDS = "holds old value";

/** Text of one cell of the arc table, generated from runComb so the table and the stepper agree. */
export function cellText(machine: DetectorMachine, row: DetectState | "x", din: Bit, seeds: boolean): CellText {
  const cell = analyzeUnassigned(machine, seeds).find((c) => c.select === row && c.din === din);
  const warning = cell && cell.unassigned.length > 0 ? `${cell.unassigned.join(", ")} unassigned` : undefined;
  if (row === "x") {
    if (!seeds) return { main: `no item runs (12.5); state_next ${HOLDS}, detected ${HOLDS}`, warning };
    const nexts = noMatchSelects(machine).map((sel) => `${sel} stays ${String(runComb(machine, sel, din, true).values.state_next)}`);
    const det = runComb(machine, "x", din, true).values.detected;
    return { main: `no item runs (12.5); the seeds give state_next = state (${nexts.join(", ")}), detected = ${String(det)}`, warning };
  }
  const run = runComb(machine, row, din, seeds);
  if (seeds) {
    return { main: `${String(run.values.state_next)}${machine.style === "mealy" && run.values.detected === 1 ? ", detected = 1" : ""}`, warning };
  }
  const next = run.source.state_next === "none" ? `state_next ${HOLDS}` : String(run.values.state_next);
  const det = run.source.detected === "none" ? `detected ${HOLDS}` : `detected = ${String(run.values.detected)}`;
  return { main: `${next}, ${det}`, warning };
}

export const LATCH_NOTE = "holds old value: latched behaviour; tools should warn (9.2.2.2)";

export const SEEDS_OFF_STEPPING_NOTE =
  "Stepping pauses while the seeds are removed. On an unassigned path the output keeps whatever value the always_comb last wrote, and that depends on the order in which state and din changed within the time slot, so this model does not guess it.";

export function latchSummary(machine: DetectorMachine, seeds: boolean): string {
  const cells = analyzeUnassigned(machine, seeds);
  const open = cells.filter((c) => c.unassigned.length > 0);
  if (open.length === 0) {
    return `With the seed lines, all ${cells.length} cells assign both state_next and detected, including ${noMatchLabel(machine)}, where no case item runs. No latch can be inferred.`;
  }
  const count = (t: DetectTarget) => cells.filter((c) => c.unassigned.includes(t)).length;
  return `Without the seed lines, ${open.length} of ${cells.length} cells leave an output unassigned (state_next in ${count("state_next")}, detected in ${count("detected")}). On each such path the output ${LATCH_NOTE}.`;
}

/* ---- per-edge evaluation ---- */

export interface DetectorEdge {
  edge: number;
  din: Bit;
  /** State sampled at this edge (the value before this edge's NBA update, 10.4.2). */
  state: DetectState;
  nextState: DetectState;
  detected: Bit;
  comb: CombRun;
  /** Set when detected is 1 at this edge: which input bits (0-based) form the match. */
  match?: { from: number; to: number; overlapsPrevious: boolean; sharedBit?: number; number: number };
}

export interface DetectorRun {
  machine: DetectorMachine;
  din: Bit[];
  edges: DetectorEdge[];
  /** State after the last edge's NBA update. */
  finalState: DetectState;
  /** Moore only: detected at the edge after the last one, which the stream does not reach. */
  pendingDetect: boolean;
}

export function runDetector(style: DetectorStyle, din: Bit[]): DetectorRun {
  const machine = detectorMachine(style);
  let state: DetectState = RESET_STATE;
  const edges: DetectorEdge[] = [];
  let lastMatch: { from: number; to: number } | undefined;
  let matches = 0;
  din.forEach((bit, edge) => {
    const comb = runComb(machine, state, bit, true);
    const nextState = comb.values.state_next as DetectState;
    const detected = comb.values.detected as Bit;
    const entry: DetectorEdge = { edge, din: bit, state, nextState, detected, comb };
    if (detected === 1) {
      // Mealy: bits edge-2..edge; Moore: S_FOUND means bits edge-3..edge-1 were 1 0 1.
      const to = style === "mealy" ? edge : edge - 1;
      const from = to - 2;
      const overlapsPrevious = Boolean(lastMatch && lastMatch.to >= from);
      matches += 1;
      entry.match = { from, to, overlapsPrevious, sharedBit: overlapsPrevious ? from : undefined, number: matches };
      lastMatch = { from, to };
    }
    edges.push(entry);
    // 10.4.2: state <= state_next updates in the NBA region, after the edge's evaluation.
    state = nextState;
  });
  const pendingDetect = style === "moore" && state === "S_FOUND";
  return { machine, din, edges, finalState: state, pendingDetect };
}

export function detectionCount(run: DetectorRun): number {
  return run.edges.filter((e) => e.detected === 1).length + (run.pendingDetect ? 1 : 0);
}

/** Brute-force reference: the 0-based index of the last bit of every 1 0 1 window, overlaps included. */
export function referenceMatchEnds(din: Bit[]): number[] {
  const ends: number[] = [];
  for (let i = 2; i < din.length; i += 1) if (din[i - 2] === 1 && din[i - 1] === 0 && din[i] === 1) ends.push(i);
  return ends;
}

export const bitsText = (from: number, to: number) => `Bits ${from + 1} to ${to + 1}`;

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const ordinal = (n: number) => ORDINALS[n - 1] ?? `number ${n}`;

/** Waveform marker text, worded as the lesson's TimingDiagram markers. */
export function matchLabel(e: DetectorEdge): string | undefined {
  if (!e.match) return undefined;
  const bits = `${bitsText(e.match.from, e.match.to)} are 1 0 1`;
  return e.match.overlapsPrevious ? `${bits}: the overlapping ${ordinal(e.match.number)} match` : `${bits}: detected`;
}

/* ---- sentences, all generated from the run ---- */

function itemSentence(machine: DetectorMachine, e: DetectorEdge): string {
  const arm = e.comb.armIndex === null ? null : machine.arms[e.comb.armIndex];
  if (!arm) return `No case item matches, so no item runs (12.5).`;
  return `unique case (state) runs the ${arm.state} item, the first item that matches (12.5).`;
}

export function explainNext(run: DetectorRun, e: DetectorEdge): string {
  const machine = run.machine;
  const arm = e.comb.armIndex === null ? null : machine.arms[e.comb.armIndex];
  const intro = `In ${e.state} with din = ${e.din}, ${itemSentence(machine, e)}`;
  if (!arm) return intro;
  if (e.comb.source.state_next === "seed") {
    const stmt = arm.stmts.find((s) => s.kind === "if");
    const cond = stmt && stmt.kind === "if" ? stmt.cond : "din";
    return `${intro} Its if (${cond}) is false and has no else, so state_next keeps its seed, state: the next state is ${e.nextState}.`;
  }
  const writer = arm.stmts.flatMap((s) => (s.kind === "if" ? [s.then, ...(s.else ? [s.else] : [])] : [s.assign])).find(
    (a) => a.target === "state_next" && valueText(a.value) === e.nextState,
  );
  const code = (writer ? assignText(writer) : `state_next = ${e.nextState};`).replace(/;$/, "");
  return `${intro} It runs ${code}, so the next state is ${e.nextState}.`;
}

export function explainDetected(run: DetectorRun, e: DetectorEdge): string {
  const machine = run.machine;
  const writers = machine.arms.filter((arm) => arm.stmts.some((s) => s.kind === "assign" && s.assign.target === "detected")).map((a) => a.state);
  if (e.comb.source.detected === "seed") {
    return `Only the ${writers.join(" and ")} item assigns detected, so here it keeps its seed, 1'b0: detected is 0.`;
  }
  const arm = machine.arms[e.comb.armIndex ?? 0];
  const stmt = arm.stmts.find((s) => s.kind === "assign" && s.assign.target === "detected");
  const code = (stmt && stmt.kind === "assign" ? assignText(stmt.assign) : "detected").replace(/;$/, "");
  const kind =
    machine.style === "mealy"
      ? `A Mealy output depends on the state and on din, so it is ${e.detected} during this cycle.`
      : `A Moore output depends on the state only, so it is 1 for the whole cycle spent in ${arm.state}.`;
  return `The ${arm.state} item runs ${code}. ${kind}`;
}

export function explainUpdate(e: DetectorEdge): string {
  return `At edge ${e.edge}, state <= state_next is scheduled and updated in the NBA region, after the processes this edge woke have run (10.4.2). So edge ${e.edge} samples state = ${e.state}, and ${e.nextState === e.state ? `state stays ${e.state} after it` : `${e.nextState} appears just after it`}.`;
}

export function explainMatch(run: DetectorRun, e: DetectorEdge): string | undefined {
  if (!e.match) return undefined;
  const base = `${bitsText(e.match.from, e.match.to)} are 1 0 1.`;
  if (!e.match.overlapsPrevious) return `${base} This is detection ${e.match.number}.`;
  const sharedIndex = e.match.sharedBit ?? e.match.from;
  const shared = sharedIndex + 1;
  // The edge that sampled the shared 1, and the edge that sampled the 0 after it.
  const a = run.edges[sharedIndex];
  const b = run.edges[sharedIndex + 1];
  if (run.machine.style === "mealy") {
    return `${base} It overlaps the previous match: bit ${shared}, the 1 that completed that match, took the machine from ${a.state} to ${a.nextState} instead of ${RESET_STATE}, so it also starts this one. Overlapping matches count.`;
  }
  return `${base} It overlaps the previous match: bit ${shared}, the 1 that completed that match, took ${a.state} to ${a.nextState} at edge ${a.edge}. ${a.nextState} remembers that 1, so the 0 at bit ${shared + 1} took ${b.state} to ${b.nextState} at edge ${b.edge} instead of ${RESET_STATE}. Overlapping matches count.`;
}

export interface DetectorGuess {
  next: DetectState;
  detected: Bit;
}

export interface GuessGrade {
  /** False when the learner revealed without predicting. */
  predicted: boolean;
  nextCorrect: boolean;
  detectedCorrect: boolean;
  headline: string;
  sentences: string[];
}

export function gradeDetectorGuess(run: DetectorRun, edge: number, guess: DetectorGuess | null): GuessGrade {
  const e = run.edges[edge];
  const nextCorrect = guess?.next === e.nextState;
  const detectedCorrect = guess?.detected === e.detected;
  const headline = !guess
    ? `Revealed without a prediction: next state ${e.nextState}, detected ${e.detected}.`
    : nextCorrect && detectedCorrect
      ? `Correct: next state ${e.nextState}, detected ${e.detected}.`
      : nextCorrect
        ? `Next state ${e.nextState} is right, but detected is ${e.detected}, not ${guess.detected}.`
        : detectedCorrect
          ? `detected ${e.detected} is right, but the next state is ${e.nextState}, not ${guess.next}.`
          : `Not quite: the next state is ${e.nextState} (you said ${guess.next}) and detected is ${e.detected} (you said ${guess.detected}).`;
  const sentences = [explainNext(run, e), explainDetected(run, e), explainUpdate(e)];
  const match = explainMatch(run, e);
  if (match) sentences.push(match);
  return { predicted: guess !== null, nextCorrect, detectedCorrect, headline, sentences };
}

export function describeDetectorEdge(e: DetectorEdge): string {
  return `Edge ${e.edge}: state ${e.state}, din ${e.din}. Next state ${e.nextState}, detected ${e.detected}.`;
}

export function runSummary(run: DetectorRun): string {
  const n = detectionCount(run);
  const pending = run.pendingDetect ? ` The last one arrives at the edge after the stream ends, because a Moore output waits for S_FOUND.` : "";
  return `${run.din.length} edges, ${n} detection${n === 1 ? "" : "s"}.${pending}`;
}

/** Arcs of the state diagram: one per (state, din). */
export interface DetectorArc {
  from: DetectState;
  to: DetectState;
  din: Bit;
  /** Mealy output on this arc (1 only where detected = din with din = 1). */
  detected: Bit;
}

export function detectorArcs(machine: DetectorMachine): DetectorArc[] {
  const arcs: DetectorArc[] = [];
  for (const from of machine.states) {
    for (const din of [0, 1] as Bit[]) {
      const run = runComb(machine, from, din, true);
      arcs.push({ from, to: run.values.state_next as DetectState, din, detected: machine.style === "mealy" ? (run.values.detected as Bit) : 0 });
    }
  }
  return arcs;
}

/** Moore: the state whose item drives detected = 1 for the whole cycle. */
export function mooreOutputStates(machine: DetectorMachine): DetectState[] {
  if (machine.style !== "moore") return [];
  return machine.states.filter((s) => runComb(machine, s, 0).values.detected === 1 && runComb(machine, s, 1).values.detected === 1);
}

/* ---- din stream input ---- */

export const MAX_DIN_BITS = 16;

export interface DetectorPreset {
  id: string;
  label: string;
  din: Bit[];
  blurb: string;
}

export const DETECTOR_PRESETS: DetectorPreset[] = [
  { id: "bench", label: "Bench 1 0 1 0 1 1 0 1", din: [1, 0, 1, 0, 1, 1, 0, 1], blurb: "The worked bench's input pattern, as in the lesson's waveform." },
  { id: "overlap", label: "10101 overlap", din: [1, 0, 1, 0, 1], blurb: "Two detections: the middle 1 ends one match and starts the next." },
  { id: "1001", label: "1001", din: [1, 0, 0, 1], blurb: "The second 0 sends S_GOT_10 back to S_IDLE: no detection." },
  { id: "111", label: "111", din: [1, 1, 1], blurb: "S_GOT_1 holds on every 1: no detection." },
];

export function findDetectorPreset(id?: string): DetectorPreset {
  return DETECTOR_PRESETS.find((p) => p.id === id) ?? DETECTOR_PRESETS[0];
}

export function parseDinStream(text: string): { bits: Bit[]; error?: string } {
  const cleaned = text.replace(/[\s,_]/g, "");
  if (cleaned.length === 0) return { bits: [], error: "Type at least one bit." };
  const bad = cleaned.split("").find((c) => c !== "0" && c !== "1");
  if (bad !== undefined) {
    return { bits: [], error: `"${bad}" is not 0 or 1. This stepper drives din with 0 and 1 only; x and z are outside its model.` };
  }
  if (cleaned.length > MAX_DIN_BITS) return { bits: [], error: `At most ${MAX_DIN_BITS} bits.` };
  return { bits: cleaned.split("").map((c) => (c === "1" ? 1 : 0)) };
}

export const DETECTOR_ASSUMPTIONS = [
  "din is 0 or 1 at every edge; x and z inputs are outside this model.",
  "Reset has already put state in S_IDLE before edge 0, as the lesson's bench does.",
  "The stepper runs the seeded code. With the seeds removed it shows which paths leave an output unassigned, not the value it would hold.",
  "Violation reports from unique case (an x or illegal state) are not shown here; their timing is a time-slot effect (12.5.3).",
  "Clauses: 10.4.2 (nonblocking update), 9.2.2.2 (always_comb), 9.2.2.4 (always_ff), 12.5 (case), 6.19.4 (enum names in expressions), IEEE 1800-2023.",
];

/* ------------------------------------------------------------------------ */
/* The traffic-light controller                                             */
/* ------------------------------------------------------------------------ */

export type LightState = "RED" | "GREEN" | "YELLOW";
export const LIGHT_STATES: LightState[] = ["RED", "GREEN", "YELLOW"];

export interface TrafficMachine {
  succ: Record<LightState, LightState>;
  /** light = {red, yellow, green}. */
  light: Record<LightState, string>;
  /** Value loaded into timer when the state is entered. */
  loads: Record<LightState, number>;
  resetState: LightState;
  resetTimer: number;
  timerWidth: number;
  broken: boolean;
}

export function trafficMachine(breakYellow = false): TrafficMachine {
  return {
    succ: { RED: "GREEN", GREEN: "YELLOW", YELLOW: "RED" },
    light: { RED: "100", GREEN: "001", YELLOW: "010" },
    loads: { RED: 3, GREEN: 2, YELLOW: breakYellow ? 1 : 0 },
    resetState: "RED",
    resetTimer: 3,
    timerWidth: 4,
    broken: breakYellow,
  };
}

/** The bench's expected_light array, one entry per checked edge. */
export const TRAFFIC_EXPECTED_LIGHT = ["100", "100", "100", "100", "001", "001", "001", "010", "100", "100", "100", "100"];

/** Bench timing: clk rises at 5, 15, 25 ... ns; reset is released after 2 rising edges. */
export const TRAFFIC_BENCH = { firstRiseNs: 5, periodNs: 10, resetEdges: 2 } as const;

export const trafficEdgeTime = (k: number) => TRAFFIC_BENCH.firstRiseNs + TRAFFIC_BENCH.periodNs * (TRAFFIC_BENCH.resetEdges + k);

const timerLit = (m: TrafficMachine, n: number) => `${m.timerWidth}'d${n}`;

export interface TrafficEdge {
  edge: number;
  tNs: number;
  state: LightState;
  timer: number;
  /** Decoder output sampled at this edge. */
  light: string;
  expected: string;
  match: boolean;
  nextState: LightState;
  moves: boolean;
  /** Timer after this edge's NBA update. */
  nextTimer: number;
  /** The light printed just after this edge, when it changes. */
  printed?: string;
}

export interface TrafficRun {
  machine: TrafficMachine;
  edges: TrafficEdge[];
  pass: number;
  fail: number;
  firstFailure: number | null;
  log: string[];
}

export function runTraffic(machine: TrafficMachine, expected: string[] = TRAFFIC_EXPECTED_LIGHT): TrafficRun {
  let state = machine.resetState;
  let timer = machine.resetTimer;
  const mod = 2 ** machine.timerWidth;
  const edges: TrafficEdge[] = [];
  const log: string[] = [];
  expected.forEach((exp, edge) => {
    const light = machine.light[state];
    // next-state always_comb: seeded with state, moves on when timer == 0 (12.5 picks the state's item).
    const nextState = timer === 0 ? machine.succ[state] : state;
    const moves = nextState !== state;
    // always_ff: both nonblocking updates land in the NBA region (10.4.2). timer - 4'd1 wraps modulo 2^4.
    const nextTimer = moves ? machine.loads[nextState] : (timer - 1 + mod) % mod;
    const newLight = machine.light[nextState];
    const tNs = trafficEdgeTime(edge);
    const entry: TrafficEdge = { edge, tNs, state, timer, light, expected: exp, match: light === exp, nextState, moves, nextTimer };
    // The check runs at the edge; the change is printed later in the same time slot, after the NBA update.
    if (!entry.match) log.push(`$error at t=${tNs} ns: edge ${edge}: light=${light}, expected ${exp}`);
    if (newLight !== light) {
      entry.printed = newLight;
      log.push(`t=${tNs} ns: light=${newLight}`);
    }
    edges.push(entry);
    state = nextState;
    timer = nextTimer;
  });
  const pass = edges.filter((e) => e.match).length;
  const fail = edges.length - pass;
  log.push(`PASS=${pass} FAIL=${fail}`);
  const first = edges.find((e) => !e.match);
  return { machine, edges, pass, fail, firstFailure: first ? first.edge : null, log };
}

/** Number of edges each state lasts: one more than the value loaded. */
export const stateDuration = (m: TrafficMachine, s: LightState) => m.loads[s] + 1;

export const printEdges = (run: TrafficRun) => run.edges.filter((e) => e.printed !== undefined).map((e) => e.edge);

/** Log lines printed at or before edge k's time slot. */
export function logUpTo(run: TrafficRun, edge: number): string[] {
  const t = trafficEdgeTime(edge);
  return run.log.filter((line) => {
    const m = /t=(\d+) ns/.exec(line);
    return m ? Number(m[1]) <= t : edge === run.edges.length - 1;
  });
}

export interface TrafficSegment {
  state: LightState;
  from: number;
  to: number;
  /** Value loaded on entry, or the reset value for the first segment. */
  loaded: number;
  byReset: boolean;
  /** True when the run ends before the state's timer reaches 0. */
  cut: boolean;
}

export function trafficSegments(run: TrafficRun): TrafficSegment[] {
  const segs: TrafficSegment[] = [];
  run.edges.forEach((e) => {
    const last = segs[segs.length - 1];
    if (last && last.state === e.state) last.to = e.edge;
    else segs.push({ state: e.state, from: e.edge, to: e.edge, loaded: e.timer, byReset: segs.length === 0, cut: false });
  });
  const tail = segs[segs.length - 1];
  if (tail) tail.cut = !run.edges[tail.to].moves;
  return segs;
}

const edgeRange = (from: number, to: number) => (from === to ? `edge ${from}` : `edges ${from} to ${to}`);

export function explainLightAt(run: TrafficRun, edge: number): string {
  const seg = trafficSegments(run).find((s) => edge >= s.from && edge <= s.to);
  if (!seg) return "";
  const e = run.edges[edge];
  const how = seg.byReset
    ? `reset put it there with timer = ${seg.loaded}`
    : `it was entered after edge ${seg.from - 1}, where the flop loaded timer <= ${timerLit(run.machine, seg.loaded)}`;
  const lasts = `${seg.loaded + 1} edge${seg.loaded === 0 ? "" : "s"}`;
  const cut = seg.cut ? ` (the run ends at edge ${run.edges.length - 1}, before its timer reaches 0)` : "";
  const where = seg.from === seg.to ? `Edge ${edge} is the only edge where state is ${seg.state}` : `Edge ${edge} falls in ${edgeRange(seg.from, seg.to)}, where state is ${seg.state}`;
  return `${where}: ${how}, so it lasts ${lasts}${cut}. The decoder gives light = ${e.light}${e.match ? `, which matches expected_light[${edge}]` : `, but expected_light[${edge}] is ${e.expected}`}.`;
}

export function explainPrints(run: TrafficRun): string {
  const edges = run.edges.filter((e) => e.printed !== undefined);
  if (edges.length === 0) return "No edge changes the light, so nothing is printed.";
  const list = edges.map((e) => `${e.edge} (t = ${e.tNs} ns, light=${e.printed})`).join(", ");
  return `A change is printed after edges ${list}. Each is an edge where timer is 0: next_state moves on, the NBA update changes state, and the decoder's light changes later in the same time slot.`;
}

export function gradeLightGuess(run: TrafficRun, edge: number, guess: LightState | null): { correct: boolean; headline: string } {
  const e = run.edges[edge];
  if (!guess) return { correct: false, headline: `Revealed without a prediction: at edge ${edge} the light is ${e.light} (${e.state}).` };
  const correct = guess === e.state;
  return {
    correct,
    headline: correct
      ? `Correct: at edge ${edge} the light is ${e.light} (${e.state}).`
      : `Not quite: at edge ${edge} the light is ${e.light} (${e.state}), not ${run.machine.light[guess]} (${guess}).`,
  };
}

export function gradePrintGuess(run: TrafficRun, guess: number[]): { correct: boolean; sentence: string } {
  const actual = printEdges(run);
  const missing = actual.filter((k) => !guess.includes(k));
  const extra = guess.filter((k) => !actual.includes(k)).sort((a, b) => a - b);
  const correct = missing.length === 0 && extra.length === 0;
  if (correct) return { correct, sentence: `Correct: edges ${actual.join(", ")} print a change.` };
  const parts: string[] = [];
  if (missing.length) parts.push(`you missed ${missing.join(", ")}`);
  if (extra.length) {
    const why = extra.map((k) => `at edge ${k} timer is ${run.edges[k].timer}, so state holds`).join("; ");
    parts.push(`${extra.join(", ")} print nothing (${why})`);
  }
  return { correct, sentence: `Not quite: ${parts.join(", and ")}.` };
}

export function describeTrafficEdge(run: TrafficRun, e: TrafficEdge): string {
  const check = `EXP ${e.expected}, ACT ${e.light} ${e.match ? "✓" : "✕"}`;
  const next = e.moves
    ? `timer is 0, so next_state is ${e.nextState}; the flop loads timer <= ${timerLit(run.machine, e.nextTimer)} and the light changes to ${e.printed ?? run.machine.light[e.nextState]} later in this time slot.`
    : `timer is ${e.timer}, so state holds and timer counts down to ${e.nextTimer}.`;
  return `Edge ${e.edge} (t = ${e.tNs} ns): state ${e.state}, timer ${e.timer}, light ${e.light}; ${check}. ${next}`;
}

export function trafficVerdict(run: TrafficRun): string {
  if (run.firstFailure === null) return `PASS=${run.pass} FAIL=${run.fail}: every edge matches expected_light.`;
  const e = run.edges[run.firstFailure];
  return `PASS=${run.pass} FAIL=${run.fail}. The first failure is at edge ${e.edge} (t = ${e.tNs} ns): light=${e.light}, expected ${e.expected}.`;
}

export const nextKey = (s: LightState) => `next:${s}`;
export const decodeKey = (s: LightState) => `dec:${s}`;
export const loadKey = (s: LightState) => `load:${s}`;
export const COUNT_KEY = "ff:count";

export function trafficCode(m: TrafficMachine): FsmCodeLine[] {
  const pad = (s: string) => `${s}:`.padEnd(8);
  const lines: FsmCodeLine[] = [
    { text: `typedef enum logic [1:0] {${LIGHT_STATES.join(", ")}} state_t;` },
    { text: "state_t     state, next_state;" },
    { text: `logic [${m.timerWidth - 1}:0] timer;             // edges left in this state, counting down to 0` },
    { text: "" },
    { text: "// Next state: move on when the timer reaches 0." },
    { text: "always_comb begin" },
    { text: "  next_state = state;          // seed: assigned on every path, so no latch" },
    { text: "  unique case (state)          // no default: an x or illegal state is reported" },
    ...LIGHT_STATES.map((s) => ({ text: `    ${pad(s)}if (timer == ${timerLit(m, 0)}) next_state = ${m.succ[s]};`, key: nextKey(s) })),
    { text: "  endcase" },
    { text: "end" },
    { text: "" },
    { text: "// Output decode." },
    { text: "always_comb begin" },
    { text: `  light = 3'b${m.light[m.resetState]};              // seed with red, the safe value` },
    { text: "  unique case (state)" },
    ...LIGHT_STATES.map((s) => ({ text: `    ${pad(s)}light = 3'b${m.light[s]};`, key: decodeKey(s) })),
    { text: "  endcase" },
    { text: "end" },
    { text: "" },
    { text: "// State and timer registers." },
    { text: "always_ff @(posedge clk or negedge rst_n) begin" },
    { text: "  if (!rst_n) begin" },
    { text: `    state <= ${m.resetState};` },
    { text: `    timer <= ${timerLit(m, m.resetTimer)};` },
    { text: "  end else if (next_state != state) begin", key: "ff:move" },
    { text: "    state <= next_state;" },
    { text: "    unique case (next_state)   // load the length of the new state" },
    ...LIGHT_STATES.map((s) => ({
      text: `      ${pad(s)}timer <= ${timerLit(m, m.loads[s])};${m.broken && s === "YELLOW" ? "   // break-it: was 4'd0" : ""}`,
      key: loadKey(s),
    })),
    { text: "    endcase" },
    { text: "  end else begin" },
    { text: `    timer <= timer - ${timerLit(m, 1)};`, key: COUNT_KEY },
    { text: "  end" },
    { text: "end" },
  ];
  return lines;
}

/** Code lines that execute at an edge: the decoder item is the active one. */
export function trafficActiveKeys(e: TrafficEdge): { active: string; context: string[] } {
  return {
    active: decodeKey(e.state),
    context: [nextKey(e.state), ...(e.moves ? ["ff:move", loadKey(e.nextState)] : [COUNT_KEY])],
  };
}

export interface TrafficPreset {
  id: string;
  label: string;
  broken: boolean;
  /** Edge the light prediction opens on. */
  predictEdge: number;
}

export const TRAFFIC_PRESETS: TrafficPreset[] = [
  { id: "lesson", label: "Lesson controller", broken: false, predictEdge: 7 },
  { id: "break-yellow", label: "Break it: YELLOW loads 4'd1", broken: true, predictEdge: 8 },
];

export function findTrafficPreset(id?: string): TrafficPreset {
  return TRAFFIC_PRESETS.find((p) => p.id === id) ?? TRAFFIC_PRESETS[0];
}

export const TRAFFIC_ASSUMPTIONS = [
  "Edge k is the k-th rising edge after reset is released (t = 25 + 10k ns); values are the ones sampled at that edge.",
  "Each $error line is shown in a generic form; the prefix and severity wording vary by simulator.",
  "Reset-timing and default break-its, whose violation reports appear at t = 0, are time-slot effects outside this model (12.5.3).",
  "Clauses: 10.4.2 (nonblocking update), 9.2.2.2 (always_comb), 9.2.2.4 (always_ff), 12.5 (case), IEEE 1800-2023.",
];
