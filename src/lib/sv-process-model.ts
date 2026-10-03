/**
 * Deterministic educational model of SystemVerilog processes across
 * simulation time: initial/always/final procedures, fork-join variants,
 * process control, named events, mailboxes and semaphores.
 *
 * Rules implemented (IEEE 1800-2023, verified against the standard's text):
 * - §9.2: initial and always procedures are enabled at the beginning of
 *   simulation; there is no implied order between them. §9.2.3: final
 *   procedures run once, in zero time, when simulation ends.
 * - §9.3.2: join waits for all spawned processes, join_any for any one,
 *   join_none for none. "In all cases, processes spawned by a fork-join block
 *   shall not start executing until the parent process is blocked or
 *   terminates." Variables declared in the fork's block_item_declaration are
 *   initialized when execution enters the fork, before any process is spawned;
 *   a variable declared inside a spawned begin-end is initialized only when
 *   that process starts.
 * - §9.6.1: wait fork waits for immediate children only, not descendants.
 * - §9.6.2: disable of a named block (or task) ends every process executing
 *   it, whoever forked them; "disabling such a task shall disable all
 *   activations". Execution resumes after the block.
 * - §9.6.3: disable fork ends all descendants of the calling process,
 *   including descendants of children that already terminated.
 * - §15.3: semaphore get(n) blocks until n keys are available; put(n) may
 *   raise the key count above the initial count (§15.3.1); the waiting queue
 *   is FIFO (§15.3.3); try_get returns 0 instead of blocking (§15.3.4).
 * - §15.4: mailbox put blocks while a bounded mailbox is full, get/peek block
 *   while it is empty, try_* return 0 instead of blocking, the waiting queue is
 *   FIFO (§15.4.5), a message unblocks every waiting peek before it is taken
 *   by a get (§15.4.7), new() is unbounded (§15.4.1).
 * - §15.5: -> unblocks only processes already waiting (§15.5.2); ->> triggers
 *   the event in the NBA region (§15.5.1); ev.triggered stays true for the
 *   rest of the time step (§15.5.3).
 *
 * Modelling assumptions (surfaced in the UI):
 * - The order in which ready processes run is not specified by the standard
 *   (§4.7, §9.2). The model runs them in declaration/creation order by default;
 *   `order: "reverse"` and explicit `choices` explore other legal orders.
 * - A running process continues until it blocks or ends (§4.7 would also
 *   allow interleaving; that only adds orders).
 * - Mailbox and semaphore hand-off: when a waiter is woken, its get/put
 *   completes at once, so no later caller can overtake it. Blocked put()
 *   callers are also served FIFO (the standard states FIFO for the get queue).
 * - Semaphore waiters are examined in FIFO order and every waiter whose
 *   request fits is served. Whether a large request at the head must hold
 *   back smaller later requests is not spelled out; simulators may differ.
 * - Typed mailboxes only: the negative try_get/try_peek result for a type
 *   mismatch (§15.4.6) is not modelled.
 * - #0, the Inactive region, intra-assignment delays and process::kill() are
 *   not modelled.
 */

export type SvVal = number | "X";

export type BinOp = "+" | "-" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||";

export type Expr =
  | { kind: "const"; value: SvVal }
  | { kind: "var"; name: string }
  | { kind: "time" }
  | { kind: "bin"; op: BinOp; left: Expr; right: Expr }
  /** Bitwise invert of a 1-bit value (`~clk`). */
  | { kind: "inv"; operand: Expr }
  | { kind: "not"; operand: Expr }
  | { kind: "num"; mailbox: string };

export type JoinKind = "join" | "join_any" | "join_none";
export type MailboxOp = "put" | "get" | "peek" | "try_put" | "try_get" | "try_peek" | "num";
export type SemaphoreOp = "get" | "put" | "try_get";

/** `automatic int name = init;` inside a begin-end or fork-join. */
export interface Decl {
  name: string;
  init: Expr;
}

interface StmtBase {
  id?: string;
  /** Short comment rendered at the end of the source line. */
  comment?: string;
}

export type Stmt =
  | (StmtBase & { kind: "delay"; amount: Expr; then?: Stmt })
  | (StmtBase & { kind: "waitEvent"; event: string; then?: Stmt })
  | (StmtBase & { kind: "waitEdge"; edge: "posedge" | "negedge"; signal: string; then?: Stmt })
  | (StmtBase & { kind: "waitTriggered"; event: string; then?: Stmt })
  | (StmtBase & { kind: "waitCond"; cond: Expr; then?: Stmt })
  | (StmtBase & { kind: "trigger"; event: string; nonblocking?: boolean })
  | (StmtBase & { kind: "assign"; target: string; expr: Expr; nba?: boolean })
  | (StmtBase & { kind: "display"; format: string; args: Expr[]; strobe?: boolean })
  | (StmtBase & { kind: "seq"; name?: string; decls?: Decl[]; body: Stmt[] })
  | (StmtBase & { kind: "fork"; name?: string; join: JoinKind; decls?: Decl[]; branches: Stmt[]; labels?: string[] })
  | (StmtBase & { kind: "disableFork" })
  | (StmtBase & { kind: "waitFork" })
  | (StmtBase & { kind: "disable"; target: string })
  | (StmtBase & { kind: "repeat"; count: number; body: Stmt[] })
  | (StmtBase & { kind: "for"; variable: string; from: number; to: number; body: Stmt[] })
  | (StmtBase & { kind: "forever"; body: Stmt[] })
  | (StmtBase & { kind: "if"; cond: Expr; then: Stmt[]; else?: Stmt[] })
  | (StmtBase & { kind: "call"; task: string; args: Expr[] })
  | (StmtBase & { kind: "return" })
  | (StmtBase & { kind: "finish" })
  | (StmtBase & { kind: "mailbox"; op: MailboxOp; mailbox: string; value?: Expr; target?: string; result?: string })
  | (StmtBase & { kind: "semaphore"; op: SemaphoreOp; semaphore: string; keys: number; result?: string });

export type ProcedureKind = "initial" | "always" | "final";

export interface ProcessDef {
  id: string;
  /** Name shown in lanes, tables and narration. */
  label: string;
  kind: ProcedureKind;
  body: Stmt[];
  role?: "design" | "testbench";
}

export interface TaskDef {
  name: string;
  /** Static tasks share one copy of their arguments across concurrent calls. */
  automatic: boolean;
  params: string[];
  body: Stmt[];
}

export interface VarDecl {
  name: string;
  type: "int" | "logic" | "bit";
  init?: SvVal;
}

export interface ProcessScenario {
  id: string;
  title: string;
  vars?: VarDecl[];
  events?: string[];
  mailboxes?: { name: string; bound: number }[];
  semaphores?: { name: string; keys: number }[];
  tasks?: TaskDef[];
  processes: ProcessDef[];
  /** Statements one time step may execute before the model reports a zero-delay loop. */
  loopBudget?: number;
}

export type ThreadState = "pending" | "ready" | "running" | "blocked" | "done" | "killed";

export interface ProcSnapshot {
  pid: number;
  label: string;
  parent: number | null;
  depth: number;
  state: ThreadState;
  /** Human-readable wait reason when blocked. */
  blockedOn?: string;
  /** Source line the process is executing or blocked on. */
  lineKey?: string;
  kind: ProcedureKind | "child";
}

export interface MailboxSnapshot {
  bound: number;
  items: SvVal[];
  getWaiters: { label: string; peek: boolean }[];
  putWaiters: { label: string; value: SvVal }[];
}

export interface SemaphoreSnapshot {
  initial: number;
  keys: number;
  waiters: { label: string; keys: number }[];
  /** Bookkeeping only: SystemVerilog semaphores do not track who holds keys. */
  held: Record<string, number>;
}

export interface LogLine {
  time: number;
  pid: number;
  label: string;
  text: string;
  region: "active" | "postponed" | "final";
}

export type StepRegion = "active" | "nba" | "postponed" | "advance" | "final" | "end";

export type StepKind =
  | "start"
  | "exec"
  | "block"
  | "wake"
  | "release"
  | "kill"
  | "unwind"
  | "print"
  | "nba"
  | "advance"
  | "finish"
  | "final"
  | "end"
  | "loop";

export interface TraceStep {
  index: number;
  time: number;
  region: StepRegion;
  kind: StepKind;
  pid?: number;
  lineKey?: string;
  what: string;
  why: string;
  procs: ProcSnapshot[];
  vars: Record<string, SvVal>;
  mailboxes: Record<string, MailboxSnapshot>;
  semaphores: Record<string, SemaphoreSnapshot>;
  events: Record<string, boolean>;
  log: LogLine[];
  /** Labels of processes ended by a disable at this step. */
  killed?: string[];
  /** Labels of processes forced out of a named block at this step. */
  unwound?: string[];
  /** Set when several processes were ready and the model picked one. */
  choice?: { options: string[]; picked: string };
}

export type SimOutcome =
  | { kind: "finish"; time: number; by: string }
  | { kind: "quiet"; time: number }
  | { kind: "zero-delay-loop"; time: number; label: string; statements: number };

export interface SimResult {
  scenarioId: string;
  trace: TraceStep[];
  log: LogLine[];
  outcome: SimOutcome;
  endTime: number;
  /** Processes still blocked when simulation ended. */
  blockedAtEnd: { label: string; on: string }[];
  finalVars: Record<string, SvVal>;
  finalSemaphores: Record<string, SemaphoreSnapshot>;
  finalMailboxes: Record<string, MailboxSnapshot>;
  choices: number[];
  choiceWidths: number[];
  /** Every process ever created, in creation order. */
  processes: { pid: number; label: string; parent: number | null; depth: number; kind: ProcedureKind | "child" }[];
}

export interface SimOptions {
  /** Default policy at a choice point: run the earliest-declared ready process, or the latest. */
  order?: "declaration" | "reverse";
  /** Explicit index per choice point (into the ready list sorted by declaration/creation order). */
  choices?: number[];
  maxSteps?: number;
}

/* ------------------------------------------------------------------------- */
/* Builders: terse helpers for writing scenarios as data.                     */
/* ------------------------------------------------------------------------- */

export const c = (value: SvVal): Expr => ({ kind: "const", value });
export const v = (name: string): Expr => ({ kind: "var", name });
export const now: Expr = { kind: "time" };
export const bin = (op: BinOp, left: Expr, right: Expr): Expr => ({ kind: "bin", op, left, right });

/* ------------------------------------------------------------------------- */
/* Source generation: the code learners see is generated from the model data. */
/* ------------------------------------------------------------------------- */

export interface SourceLine {
  text: string;
  key?: string;
  owner?: "design" | "testbench";
}

export interface PreparedScenario {
  scenario: ProcessScenario;
  source: SourceLine[];
  /** Statement id → key of the source line that shows it. */
  lineKeyOf: Map<string, string>;
}

const prepared = new WeakMap<ProcessScenario, PreparedScenario>();

function exprToSource(expr: Expr, nested = false): string {
  switch (expr.kind) {
    case "const":
      return expr.value === "X" ? "'x" : String(expr.value);
    case "var":
      return expr.name;
    case "time":
      return "$time";
    case "num":
      return `${expr.mailbox}.num()`;
    case "inv":
      return `~${exprToSource(expr.operand, true)}`;
    case "not":
      return `!${exprToSource(expr.operand, true)}`;
    case "bin": {
      const text = `${exprToSource(expr.left, true)} ${expr.op} ${exprToSource(expr.right, true)}`;
      return nested ? `(${text})` : text;
    }
  }
}

function displayToSource(stmt: Extract<Stmt, { kind: "display" }>): string {
  const task = stmt.strobe ? "$strobe" : "$display";
  const args = stmt.args.map((a) => exprToSource(a)).join(", ");
  return `${task}("${stmt.format}"${args ? `, ${args}` : ""});`;
}

function delayToSource(amount: Expr): string {
  return amount.kind === "const" || amount.kind === "var" ? `#${exprToSource(amount)}` : `#(${exprToSource(amount)})`;
}

function isInline(stmt: Stmt): boolean {
  switch (stmt.kind) {
    case "delay":
    case "waitEvent":
    case "waitEdge":
    case "waitTriggered":
    case "waitCond":
      return !stmt.then || isInline(stmt.then);
    case "seq":
    case "fork":
    case "for":
      return false;
    case "repeat":
    case "forever":
      return stmt.body.length === 1 && isInline(stmt.body[0]);
    case "if":
      return !stmt.else && stmt.then.length === 1 && isInline(stmt.then[0]);
    default:
      return true;
  }
}

/** One-line rendering of an inline statement; registers nested ids on the same line. */
function inlineText(stmt: Stmt, key: string, map: Map<string, string>): string {
  if (stmt.id) map.set(stmt.id, key);
  const withThen = (head: string, then?: Stmt) => (then ? `${head} ${inlineText(then, key, map)}` : `${head};`);
  switch (stmt.kind) {
    case "delay":
      return withThen(delayToSource(stmt.amount), stmt.then);
    case "waitEvent":
      return withThen(`@(${stmt.event})`, stmt.then);
    case "waitEdge":
      return withThen(`@(${stmt.edge} ${stmt.signal})`, stmt.then);
    case "waitTriggered":
      return withThen(`wait (${stmt.event}.triggered)`, stmt.then);
    case "waitCond":
      return withThen(`wait (${exprToSource(stmt.cond)})`, stmt.then);
    case "trigger":
      return `${stmt.nonblocking ? "->>" : "->"} ${stmt.event};`;
    case "assign":
      return `${stmt.target} ${stmt.nba ? "<=" : "="} ${exprToSource(stmt.expr)};`;
    case "display":
      return displayToSource(stmt);
    case "disableFork":
      return "disable fork;";
    case "waitFork":
      return "wait fork;";
    case "disable":
      return `disable ${stmt.target};`;
    case "call":
      return `${stmt.task}(${stmt.args.map((a) => exprToSource(a)).join(", ")});`;
    case "return":
      return "return;";
    case "finish":
      return "$finish;";
    case "repeat":
      return `repeat (${stmt.count}) ${inlineText(stmt.body[0], key, map)}`;
    case "forever":
      return `forever ${inlineText(stmt.body[0], key, map)}`;
    case "if":
      return `if (${exprToSource(stmt.cond)}) ${inlineText(stmt.then[0], key, map)}`;
    case "mailbox": {
      const call = (arg?: string) => `${stmt.mailbox}.${stmt.op}(${arg ?? ""})`;
      switch (stmt.op) {
        case "put":
          return `${call(exprToSource(stmt.value ?? c(0)))};`;
        case "get":
        case "peek":
          return `${call(stmt.target)};`;
        case "try_put":
          return stmt.result
            ? `${stmt.result} = ${call(exprToSource(stmt.value ?? c(0)))};`
            : `void'(${call(exprToSource(stmt.value ?? c(0)))});`;
        case "try_get":
        case "try_peek":
          return stmt.result ? `${stmt.result} = ${call(stmt.target)};` : `void'(${call(stmt.target)});`;
        case "num":
          return `${stmt.target} = ${call()};`;
      }
      return "";
    }
    case "semaphore": {
      const call = `${stmt.semaphore}.${stmt.op}(${stmt.keys})`;
      if (stmt.op === "try_get") return stmt.result ? `${stmt.result} = ${call};` : `void'(${call});`;
      return `${call};`;
    }
    default:
      return "";
  }
}

function withComment(text: string, comment?: string): string {
  return comment ? `${text} // ${comment}` : text;
}

function renderStmt(stmt: Stmt, indent: string, lines: SourceLine[], map: Map<string, string>, owner?: SourceLine["owner"], label?: string) {
  const id = stmt.id as string;
  const comment = label ?? stmt.comment;
  if (isInline(stmt)) {
    lines.push({ text: withComment(indent + inlineText(stmt, id, map), comment), key: id, owner });
    return;
  }
  const inner = `${indent}  `;
  const body = (stmts: Stmt[]) => stmts.forEach((s) => renderStmt(s, inner, lines, map, owner));
  switch (stmt.kind) {
    case "seq": {
      map.set(id, id);
      lines.push({ text: withComment(`${indent}begin${stmt.name ? ` : ${stmt.name}` : ""}`, comment), key: id, owner });
      stmt.decls?.forEach((d) => lines.push({ text: `${inner}automatic int ${d.name} = ${exprToSource(d.init)};`, key: `${id}:decls`, owner }));
      body(stmt.body);
      lines.push({ text: `${indent}end${stmt.name ? ` : ${stmt.name}` : ""}`, key: `${id}:end`, owner });
      return;
    }
    case "fork": {
      map.set(id, id);
      lines.push({ text: withComment(`${indent}fork${stmt.name ? ` : ${stmt.name}` : ""}`, comment), key: id, owner });
      stmt.decls?.forEach((d) => lines.push({ text: `${inner}automatic int ${d.name} = ${exprToSource(d.init)};`, key: `${id}:decls`, owner }));
      stmt.branches.forEach((b, i) => renderStmt(b, inner, lines, map, owner, stmt.labels?.[i]?.replace(/\s*\{[^}]*\}/g, "")));
      lines.push({ text: `${indent}${stmt.join}${stmt.name ? ` : ${stmt.name}` : ""}`, key: `${id}:join`, owner });
      return;
    }
    case "for": {
      map.set(id, id);
      lines.push({
        text: withComment(`${indent}for (int ${stmt.variable} = ${stmt.from}; ${stmt.variable} < ${stmt.to}; ${stmt.variable}++) begin`, comment),
        key: id,
        owner,
      });
      body(stmt.body);
      lines.push({ text: `${indent}end`, key: `${id}:end`, owner });
      return;
    }
    case "repeat":
    case "forever": {
      map.set(id, id);
      const head = stmt.kind === "repeat" ? `repeat (${stmt.count}) begin` : "forever begin";
      lines.push({ text: withComment(`${indent}${head}`, comment), key: id, owner });
      body(stmt.body);
      lines.push({ text: `${indent}end`, key: `${id}:end`, owner });
      return;
    }
    case "if": {
      map.set(id, id);
      lines.push({ text: withComment(`${indent}if (${exprToSource(stmt.cond)}) begin`, comment), key: id, owner });
      body(stmt.then);
      if (stmt.else) {
        lines.push({ text: `${indent}end else begin`, key: `${id}:else`, owner });
        body(stmt.else);
      }
      lines.push({ text: `${indent}end`, key: `${id}:end`, owner });
      return;
    }
    default:
      lines.push({ text: withComment(indent + inlineText(stmt, id, map), comment), key: id, owner });
  }
}

function assignIds(scenario: ProcessScenario): ProcessScenario {
  let counter = 0;
  const visit = (stmt: Stmt): Stmt => {
    const id = stmt.id ?? `s${++counter}`;
    switch (stmt.kind) {
      case "delay":
      case "waitEvent":
      case "waitEdge":
      case "waitTriggered":
      case "waitCond":
        return { ...stmt, id, then: stmt.then ? visit(stmt.then) : undefined };
      case "seq":
        return { ...stmt, id, body: stmt.body.map(visit) };
      case "fork":
        return { ...stmt, id, branches: stmt.branches.map(visit) };
      case "repeat":
      case "for":
      case "forever":
        return { ...stmt, id, body: stmt.body.map(visit) };
      case "if":
        return { ...stmt, id, then: stmt.then.map(visit), else: stmt.else?.map(visit) };
      default:
        return { ...stmt, id };
    }
  };
  return {
    ...scenario,
    tasks: scenario.tasks?.map((t) => ({ ...t, body: t.body.map(visit) })),
    processes: scenario.processes.map((p) => ({ ...p, body: p.body.map(visit) })),
  };
}

function declToSource(d: VarDecl): string {
  return `${d.type} ${d.name}${d.init !== undefined ? ` = ${d.init === "X" ? "'x" : d.init}` : ""};`;
}

/** Assigns statement ids, generates SystemVerilog-style source and the statement → line map. */
export function prepareScenario(input: ProcessScenario): PreparedScenario {
  const cached = prepared.get(input);
  if (cached) return cached;
  const scenario = assignIds(input);
  const lines: SourceLine[] = [];
  const map = new Map<string, string>();
  scenario.vars?.forEach((d) => lines.push({ text: declToSource(d) }));
  scenario.events?.forEach((e) => lines.push({ text: `event ${e};` }));
  scenario.mailboxes?.forEach((m) => lines.push({ text: `mailbox #(int) ${m.name} = new(${m.bound === 0 ? "" : m.bound});` }));
  scenario.semaphores?.forEach((s) => lines.push({ text: `semaphore ${s.name} = new(${s.keys});` }));
  const blank = () => {
    if (lines.length > 0 && lines[lines.length - 1].text !== "") lines.push({ text: "" });
  };
  scenario.tasks?.forEach((t) => {
    blank();
    lines.push({ text: `task ${t.automatic ? "automatic " : ""}${t.name}(${t.params.map((p) => `int ${p}`).join(", ")});`, key: `task:${t.name}` });
    t.body.forEach((s) => renderStmt(s, "  ", lines, map, "testbench"));
    lines.push({ text: "endtask", key: `task:${t.name}:end` });
  });
  scenario.processes.forEach((p) => {
    blank();
    const owner = p.role ?? "testbench";
    if (p.body.length === 1 && isInline(p.body[0])) {
      const id = p.body[0].id as string;
      lines.push({ text: withComment(`${p.kind} ${inlineText(p.body[0], id, map)}`, p.label), key: id, owner });
      map.set(`${p.id}:head`, id);
      return;
    }
    lines.push({ text: withComment(`${p.kind} begin`, p.label), key: `${p.id}:head`, owner });
    p.body.forEach((s) => renderStmt(s, "  ", lines, map, owner));
    lines.push({ text: "end", key: `${p.id}:end`, owner });
  });
  const result = { scenario, source: lines, lineKeyOf: map };
  prepared.set(input, result);
  return result;
}

/* ------------------------------------------------------------------------- */
/* IPC core: pure mailbox and semaphore rules shared by the engine and the     */
/* interactive sandbox. `W` identifies a waiting process.                      */
/* ------------------------------------------------------------------------- */

export interface MailboxCore<W> {
  /** 0 means unbounded (§15.4.1). */
  bound: number;
  items: SvVal[];
  getWaiters: { who: W; peek: boolean }[];
  putWaiters: { who: W; value: SvVal }[];
}

export type MailboxWake<W> = { who: W; kind: "get" | "peek" | "put"; value: SvVal };

export interface SemaphoreCore<W> {
  initial: number;
  keys: number;
  waiters: { who: W; keys: number }[];
}

export function newMailbox<W>(bound: number): MailboxCore<W> {
  return { bound, items: [], getWaiters: [], putWaiters: [] };
}

export function mailboxIsFull<W>(m: MailboxCore<W>): boolean {
  return m.bound > 0 && m.items.length >= m.bound;
}

/**
 * Serves blocked callers oldest-first: each message first satisfies waiting
 * peeks ahead of it and then one waiting get (§15.4.5, §15.4.7); freed slots
 * admit blocked put() callers in arrival order (§15.4.3; FIFO for put waiters
 * is a modelling assumption).
 */
export function serveMailboxCore<W>(input: MailboxCore<W>): { state: MailboxCore<W>; woken: MailboxWake<W>[] } {
  const m: MailboxCore<W> = { bound: input.bound, items: [...input.items], getWaiters: [...input.getWaiters], putWaiters: [...input.putWaiters] };
  const woken: MailboxWake<W>[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    while (m.items.length > 0 && m.getWaiters.length > 0) {
      const w = m.getWaiters.shift() as { who: W; peek: boolean };
      const value = w.peek ? m.items[0] : (m.items.shift() as SvVal);
      woken.push({ who: w.who, kind: w.peek ? "peek" : "get", value });
      progress = true;
    }
    while (m.putWaiters.length > 0 && !mailboxIsFull(m)) {
      const w = m.putWaiters.shift() as { who: W; value: SvVal };
      m.items.push(w.value);
      woken.push({ who: w.who, kind: "put", value: w.value });
      progress = true;
    }
  }
  return { state: m, woken };
}

/** put() (blocking) or try_put() (non-blocking) (§15.4.3, §15.4.4). */
export function mailboxPut<W>(
  input: MailboxCore<W>,
  who: W,
  value: SvVal,
  blocking: boolean,
): { state: MailboxCore<W>; stored: boolean; blocked: boolean; woken: MailboxWake<W>[] } {
  if (mailboxIsFull(input)) {
    if (!blocking) return { state: input, stored: false, blocked: false, woken: [] };
    return { state: { ...input, putWaiters: [...input.putWaiters, { who, value }] }, stored: false, blocked: true, woken: [] };
  }
  const served = serveMailboxCore({ ...input, items: [...input.items, value] });
  return { state: served.state, stored: true, blocked: false, woken: served.woken };
}

/** get()/peek() (blocking) or try_get()/try_peek() (non-blocking) (§15.4.5–§15.4.8). */
export function mailboxTake<W>(
  input: MailboxCore<W>,
  who: W,
  peek: boolean,
  blocking: boolean,
): { state: MailboxCore<W>; value?: SvVal; blocked: boolean; woken: MailboxWake<W>[] } {
  if (input.items.length === 0) {
    if (!blocking) return { state: input, blocked: false, woken: [] };
    return { state: { ...input, getWaiters: [...input.getWaiters, { who, peek }] }, blocked: true, woken: [] };
  }
  const value = input.items[0];
  if (peek) return { state: input, value, blocked: false, woken: [] };
  const served = serveMailboxCore({ ...input, items: input.items.slice(1) });
  return { state: served.state, value, blocked: false, woken: served.woken };
}

export function newSemaphore<W>(keys: number): SemaphoreCore<W> {
  return { initial: keys, keys, waiters: [] };
}

/** get(n) (blocking) or try_get(n) (non-blocking) (§15.3.3, §15.3.4). */
export function semaphoreGet<W>(
  input: SemaphoreCore<W>,
  who: W,
  keys: number,
  blocking: boolean,
): { state: SemaphoreCore<W>; acquired: boolean; blocked: boolean } {
  if (input.keys >= keys) return { state: { ...input, keys: input.keys - keys }, acquired: true, blocked: false };
  if (!blocking) return { state: input, acquired: false, blocked: false };
  return { state: { ...input, waiters: [...input.waiters, { who, keys }] }, acquired: false, blocked: true };
}

/**
 * put(n) returns keys — there is no upper limit (§15.3.1, §15.3.2) — then
 * wakes waiters in FIFO order (§15.3.3). Every waiter whose request fits is
 * served; a larger request does not hold back later, smaller ones (modelling
 * assumption: the standard does not spell this out).
 */
export function semaphorePut<W>(input: SemaphoreCore<W>, keys: number): { state: SemaphoreCore<W>; woken: { who: W; keys: number }[] } {
  let available = input.keys + keys;
  const waiters: { who: W; keys: number }[] = [];
  const woken: { who: W; keys: number }[] = [];
  input.waiters.forEach((w) => {
    if (w.keys <= available) {
      available -= w.keys;
      woken.push(w);
    } else {
      waiters.push(w);
    }
  });
  return { state: { ...input, keys: available, waiters }, woken };
}

/* ------------------------------------------------------------------------- */
/* Simulation engine.                                                         */
/* ------------------------------------------------------------------------- */

interface Scope {
  vars: Map<string, SvVal>;
  parent: Scope | null;
}

type FrameKind = "root" | "block" | "then" | "for" | "repeat" | "forever" | "task" | "join" | "branch";

interface Frame {
  kind: FrameKind;
  stmts: Stmt[];
  pc: number;
  /** Block or task name, for `disable name`. */
  name?: string;
  scope?: Scope;
  ownerId?: string;
  variable?: string;
  to?: number;
  remaining?: number;
  join?: JoinKind;
  children?: number[];
}

type BlockReason =
  | { kind: "delay"; until: number }
  | { kind: "event"; event: string }
  | { kind: "edge"; edge: "posedge" | "negedge"; signal: string }
  | { kind: "triggered"; event: string }
  | { kind: "cond"; cond: Expr }
  | { kind: "join"; join: JoinKind }
  | { kind: "waitFork" }
  | { kind: "mbxPut"; mailbox: string; value: SvVal }
  | { kind: "mbxGet"; mailbox: string; peek: boolean }
  | { kind: "semGet"; semaphore: string; keys: number };

interface Proc {
  pid: number;
  label: string;
  parent: number | null;
  children: number[];
  rank: number;
  state: ThreadState;
  block?: BlockReason;
  frames: Frame[];
  /** Named blocks/tasks that enclosed this process when it was spawned. */
  inherited: string[];
  baseScope: Scope;
  lineKey?: string;
  kind: ProcedureKind | "child";
  depth: number;
  /** For mailbox get/peek hand-off: the variable (and scope) that receives the message. */
  receive?: { scope: Scope; name: string };
}

type MailboxState = MailboxCore<number>;

interface SemaphoreState extends SemaphoreCore<number> {
  /** Bookkeeping for narration: SystemVerilog does not track who holds keys. */
  held: Map<number, number>;
}

type NbaEntry =
  | { kind: "update"; scope: Scope; target: string; value: SvVal; pid: number; lineKey?: string }
  | { kind: "trigger"; event: string; pid: number; lineKey?: string };

class StopSimulation extends Error {}

const MAX_STEPS_DEFAULT = 4000;
const LOOP_BUDGET_DEFAULT = 200;

export function formatVal(value: SvVal | undefined): string {
  return value === undefined || value === "X" ? "x" : String(value);
}

function toNumber(value: SvVal): number | null {
  return value === "X" ? null : value;
}

function isTruthy(value: SvVal): boolean {
  return value !== "X" && value !== 0;
}

/** Formats `%0d`, `%d` and `%0t` the way $display would for these integer values. */
export function formatDisplay(format: string, values: SvVal[]): string {
  let i = 0;
  return format.replace(/%0?[dt]/g, () => formatVal(values[i++]));
}

export function simulateProcesses(input: ProcessScenario, options: SimOptions = {}): SimResult {
  const { scenario, lineKeyOf } = prepareScenario(input);
  const order = options.order ?? "declaration";
  const maxSteps = options.maxSteps ?? MAX_STEPS_DEFAULT;
  const loopBudget = scenario.loopBudget ?? LOOP_BUDGET_DEFAULT;

  const global: Scope = { vars: new Map(), parent: null };
  const varOrder = (scenario.vars ?? []).map((d) => d.name);
  (scenario.vars ?? []).forEach((d) => global.vars.set(d.name, d.init ?? (d.type === "logic" ? "X" : 0)));
  const events = new Map<string, boolean>((scenario.events ?? []).map((e) => [e, false]));
  const mailboxes = new Map<string, MailboxState>((scenario.mailboxes ?? []).map((m) => [m.name, newMailbox<number>(m.bound)]));
  const semaphores = new Map<string, SemaphoreState>(
    (scenario.semaphores ?? []).map((s) => [s.name, { ...newSemaphore<number>(s.keys), held: new Map() }]),
  );
  const tasks = new Map((scenario.tasks ?? []).map((t) => [t.name, t]));
  const staticTaskScopes = new Map<string, Scope>();

  const procs: Proc[] = [];
  let active: number[] = [];
  let nba: NbaEntry[] = [];
  let postponed: { pid: number; stmt: Extract<Stmt, { kind: "display" }>; scope: Scope }[] = [];
  let future: { time: number; pid: number; seq: number }[] = [];
  let futureSeq = 0;
  const log: LogLine[] = [];
  const trace: TraceStep[] = [];
  const usedChoices: number[] = [];
  const choiceWidths: number[] = [];
  let time = 0;
  let statementsThisStep = 0;
  // Assigned inside closures, so read it through a cast to avoid stale narrowing.
  let outcome = null as SimOutcome | null;
  let pendingChoice: TraceStep["choice"];

  const lineOf = (stmt: Stmt) => lineKeyOf.get(stmt.id as string) ?? (stmt.id as string);

  /* ---------- scopes and values ---------- */

  const currentScope = (p: Proc): Scope => {
    for (let i = p.frames.length - 1; i >= 0; i -= 1) {
      const scope = p.frames[i].scope;
      if (scope) return scope;
    }
    return p.baseScope;
  };

  const lookupScope = (scope: Scope, name: string): Scope => {
    let s: Scope | null = scope;
    while (s) {
      if (s.vars.has(name)) return s;
      s = s.parent;
    }
    throw new Error(`Scenario ${scenario.id}: unknown variable ${name}`);
  };

  const evalExpr = (expr: Expr, scope: Scope): SvVal => {
    switch (expr.kind) {
      case "const":
        return expr.value;
      case "var":
        return lookupScope(scope, expr.name).vars.get(expr.name) ?? "X";
      case "time":
        return time;
      case "num":
        return mailboxOf(expr.mailbox).items.length;
      case "inv": {
        const value = evalExpr(expr.operand, scope);
        return value === "X" ? "X" : value === 0 ? 1 : 0;
      }
      case "not": {
        const value = evalExpr(expr.operand, scope);
        return value === "X" ? "X" : value === 0 ? 1 : 0;
      }
      case "bin": {
        const l = evalExpr(expr.left, scope);
        const r = evalExpr(expr.right, scope);
        if (expr.op === "&&") return isTruthy(l) && isTruthy(r) ? 1 : 0;
        if (expr.op === "||") return isTruthy(l) || isTruthy(r) ? 1 : 0;
        const a = toNumber(l);
        const b = toNumber(r);
        if (a === null || b === null) return "X";
        switch (expr.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "==":
            return a === b ? 1 : 0;
          case "!=":
            return a !== b ? 1 : 0;
          case "<":
            return a < b ? 1 : 0;
          case "<=":
            return a <= b ? 1 : 0;
          case ">":
            return a > b ? 1 : 0;
          case ">=":
            return a >= b ? 1 : 0;
        }
      }
    }
    return "X";
  };

  const mailboxOf = (name: string): MailboxState => {
    const mb = mailboxes.get(name);
    if (!mb) throw new Error(`Scenario ${scenario.id}: unknown mailbox ${name}`);
    return mb;
  };
  const semaphoreOf = (name: string): SemaphoreState => {
    const sem = semaphores.get(name);
    if (!sem) throw new Error(`Scenario ${scenario.id}: unknown semaphore ${name}`);
    return sem;
  };

  /* ---------- snapshots and trace ---------- */

  const describeBlock = (p: Proc): string | undefined => {
    const b = p.block;
    if (!b) return undefined;
    switch (b.kind) {
      case "delay":
        return `#delay → wakes at t = ${b.until}`;
      case "event":
        return `@(${b.event})`;
      case "edge":
        return `@(${b.edge} ${b.signal})`;
      case "triggered":
        return `wait (${b.event}.triggered)`;
      case "cond":
        return `wait (${exprToSource(b.cond)})`;
      case "join": {
        const frame = p.frames[p.frames.length - 1];
        const kids = frame?.children ?? [];
        const alive = kids.filter((k) => !isTerminated(procs[k])).length;
        return `${b.join} (${alive} of ${kids.length} children still running)`;
      }
      case "waitFork": {
        const alive = p.children.filter((k) => !isTerminated(procs[k])).length;
        return `wait fork (${alive} child${alive === 1 ? "" : "ren"} still running)`;
      }
      case "mbxPut": {
        const mb = mailboxOf(b.mailbox);
        return `${b.mailbox}.put(${formatVal(b.value)}) — full (${mb.items.length}/${mb.bound})`;
      }
      case "mbxGet":
        return `${b.mailbox}.${b.peek ? "peek" : "get"} — empty`;
      case "semGet": {
        const sem = semaphoreOf(b.semaphore);
        return `${b.semaphore}.get(${b.keys}) — ${sem.keys} key${sem.keys === 1 ? "" : "s"} free`;
      }
    }
  };

  const snapshotProcs = (): ProcSnapshot[] =>
    procs.map((p) => ({
      pid: p.pid,
      label: p.label,
      parent: p.parent,
      depth: p.depth,
      state: p.state,
      blockedOn: p.state === "blocked" ? describeBlock(p) : undefined,
      lineKey: p.state === "done" || p.state === "killed" ? undefined : p.lineKey,
      kind: p.kind,
    }));

  const labelOf = (pid: number) => procs[pid]?.label ?? `#${pid}`;

  const snapshotSemaphores = (): Record<string, SemaphoreSnapshot> => {
    const out: Record<string, SemaphoreSnapshot> = {};
    semaphores.forEach((s, name) => {
      const held: Record<string, number> = {};
      s.held.forEach((n, pid) => {
        if (n > 0) held[labelOf(pid)] = n;
      });
      out[name] = { initial: s.initial, keys: s.keys, waiters: s.waiters.map((w) => ({ label: labelOf(w.who), keys: w.keys })), held };
    });
    return out;
  };

  const snapshotMailboxes = (): Record<string, MailboxSnapshot> => {
    const out: Record<string, MailboxSnapshot> = {};
    mailboxes.forEach((m, name) => {
      out[name] = {
        bound: m.bound,
        items: [...m.items],
        getWaiters: m.getWaiters.map((w) => ({ label: labelOf(w.who), peek: w.peek })),
        putWaiters: m.putWaiters.map((w) => ({ label: labelOf(w.who), value: w.value })),
      };
    });
    return out;
  };

  const snapshotVars = (): Record<string, SvVal> => {
    const out: Record<string, SvVal> = {};
    varOrder.forEach((name) => (out[name] = global.vars.get(name) ?? "X"));
    return out;
  };

  const push = (step: { region?: StepRegion; kind: StepKind; pid?: number; lineKey?: string; what: string; why: string; killed?: string[]; unwound?: string[] }) => {
    if (trace.length >= maxSteps) throw new Error(`Scenario ${scenario.id} exceeded ${maxSteps} steps`);
    const choice = pendingChoice && step.pid !== undefined ? pendingChoice : undefined;
    if (choice) pendingChoice = undefined;
    trace.push({
      index: trace.length,
      time,
      region: step.region ?? "active",
      kind: step.kind,
      pid: step.pid,
      lineKey: step.lineKey,
      what: step.what,
      why: step.why,
      killed: step.killed,
      unwound: step.unwound,
      choice,
      procs: snapshotProcs(),
      vars: snapshotVars(),
      mailboxes: snapshotMailboxes(),
      semaphores: snapshotSemaphores(),
      events: Object.fromEntries(events),
      log: [...log],
    });
  };

  /* ---------- process lifecycle ---------- */

  function isTerminated(p: Proc | undefined): boolean {
    return !p || p.state === "done" || p.state === "killed";
  }

  const namesWithin = (p: Proc): string[] => [...p.inherited, ...p.frames.map((f) => f.name).filter((n): n is string => Boolean(n))];

  const makeReady = (p: Proc) => {
    p.state = "ready";
    p.block = undefined;
    if (!active.includes(p.pid)) active.push(p.pid);
  };

  /** Spawned children start only once their parent blocks or terminates (§9.3.2). */
  const releaseChildren = (p: Proc, because: string) => {
    const pending = p.children.map((k) => procs[k]).filter((k) => k.state === "pending");
    if (pending.length === 0) return;
    pending.forEach(makeReady);
    push({
      kind: "release",
      pid: p.pid,
      lineKey: p.lineKey,
      what: `${pending.map((k) => k.label).join(", ")} may start now: ${p.label} ${because}.`,
      why: "Processes spawned by fork never start before their parent blocks or terminates (IEEE 1800-2023 §9.3.2).",
    });
  };

  const blockOn = (p: Proc, reason: BlockReason, step: { lineKey?: string; what: string; why: string }) => {
    p.state = "blocked";
    p.block = reason;
    if (reason.kind === "delay") future.push({ time: reason.until, pid: p.pid, seq: futureSeq++ });
    push({ kind: "block", pid: p.pid, lineKey: step.lineKey, what: step.what, why: step.why });
    releaseChildren(p, "is blocked");
  };

  const cancelWaits = (p: Proc) => {
    future = future.filter((f) => f.pid !== p.pid);
    active = active.filter((pid) => pid !== p.pid);
    mailboxes.forEach((m) => {
      m.getWaiters = m.getWaiters.filter((w) => w.who !== p.pid);
      m.putWaiters = m.putWaiters.filter((w) => w.who !== p.pid);
    });
    semaphores.forEach((s) => {
      s.waiters = s.waiters.filter((w) => w.who !== p.pid);
    });
    p.block = undefined;
  };

  const joinSatisfied = (frame: Frame): boolean => {
    const kids = frame.children ?? [];
    if (frame.join === "join_any") return kids.length === 0 || kids.some((k) => isTerminated(procs[k]));
    return kids.every((k) => isTerminated(procs[k]));
  };

  /** A child terminated: its parent may be waiting at a join or in wait fork. */
  const notifyParent = (child: Proc) => {
    if (child.parent === null) return;
    const parent = procs[child.parent];
    if (parent.state !== "blocked" || !parent.block) return;
    if (parent.block.kind === "join") {
      const frame = parent.frames[parent.frames.length - 1];
      if (frame?.kind !== "join" || !frame.children?.includes(child.pid) || !joinSatisfied(frame)) return;
      parent.frames.pop();
      const join = parent.block.join;
      makeReady(parent);
      parent.lineKey = frame.ownerId ? `${frame.ownerId}:join` : parent.lineKey;
      push({
        kind: "wake",
        pid: parent.pid,
        lineKey: parent.lineKey,
        what: `${parent.label} passes ${join}: ${child.label} ${child.state === "killed" ? "was killed" : "finished"}.`,
        why:
          join === "join_any"
            ? "join_any resumes the parent as soon as any one spawned process terminates; the others keep running (§9.3.2, Table 9-1)."
            : "join resumes the parent only when every process spawned by this fork has terminated (§9.3.2, Table 9-1).",
      });
    } else if (parent.block.kind === "waitFork" && parent.children.every((k) => isTerminated(procs[k]))) {
      makeReady(parent);
      push({
        kind: "wake",
        pid: parent.pid,
        lineKey: parent.lineKey,
        what: `${parent.label} passes wait fork: its last child, ${child.label}, ${child.state === "killed" ? "was killed" : "finished"}.`,
        why: "wait fork waits for the immediate children only — processes they spawned are not waited for (§9.6.1).",
      });
    }
  };

  const terminate = (p: Proc, why: string) => {
    p.state = "done";
    p.block = undefined;
    push({ kind: "exec", pid: p.pid, lineKey: p.lineKey, what: `${p.label} finishes.`, why });
    p.lineKey = undefined;
    releaseChildren(p, "has terminated");
    notifyParent(p);
  };

  const kill = (p: Proc) => {
    if (isTerminated(p)) return;
    cancelWaits(p);
    p.state = "killed";
    p.lineKey = undefined;
  };

  const descendants = (p: Proc): Proc[] => {
    const out: Proc[] = [];
    const visit = (q: Proc) =>
      q.children.forEach((k) => {
        out.push(procs[k]);
        visit(procs[k]);
      });
    visit(p);
    return out;
  };

  const heldNote = (victims: Proc[]): string => {
    const notes: string[] = [];
    semaphores.forEach((s, name) => {
      victims.forEach((v) => {
        const n = s.held.get(v.pid) ?? 0;
        if (n > 0) notes.push(`${v.label} still held ${n} key${n === 1 ? "" : "s"} of ${name}; killing it does not return them`);
      });
    });
    return notes.length ? ` ${notes.join("; ")}.` : "";
  };

  /* ---------- events, variables, IPC ---------- */

  const fireEvent = (name: string, by: Proc, lineKey: string | undefined, region: StepRegion, nonblocking: boolean) => {
    if (!events.has(name)) throw new Error(`Scenario ${scenario.id}: unknown event ${name}`);
    events.set(name, true);
    const woken = procs.filter(
      (p) => p.state === "blocked" && (p.block?.kind === "event" || p.block?.kind === "triggered") && p.block.event === name,
    );
    woken.forEach(makeReady);
    push({
      region,
      kind: region === "nba" ? "nba" : "exec",
      pid: by.pid,
      lineKey,
      what: `${nonblocking ? `NBA region: the ->> ${name} scheduled by ${by.label} fires now` : `${by.label} triggers ${name}`}.${
        woken.length ? ` It wakes ${woken.map((p) => p.label).join(", ")}.` : " Nobody is waiting on it yet."
      }`,
      why: woken.length
        ? `A trigger unblocks only the processes already waiting on @(${name}) or wait (${name}.triggered) (§15.5.2). ${name}.triggered stays true until time advances (§15.5.3).`
        : `The trigger is not stored: a process that reaches @(${name}) later in this time step stays blocked (§15.5.2). Only ${name}.triggered remembers it, until time advances (§15.5.3).`,
    });
  };

  const edgeFires = (edge: "posedge" | "negedge", oldValue: SvVal, newValue: SvVal) =>
    edge === "posedge"
      ? (oldValue === 0 && newValue !== 0) || (oldValue === "X" && newValue === 1)
      : (oldValue === 1 && newValue !== 1) || (oldValue === "X" && newValue === 0);

  /** Writes a variable; global changes wake edge and level waiters. Returns labels woken. */
  const writeVar = (scope: Scope, name: string, value: SvVal): string[] => {
    const target = lookupScope(scope, name);
    const oldValue = target.vars.get(name) ?? "X";
    target.vars.set(name, value);
    if (target !== global || oldValue === value) return [];
    const woken: string[] = [];
    procs.forEach((p) => {
      if (p.state !== "blocked" || !p.block) return;
      const b = p.block;
      const fires =
        (b.kind === "edge" && b.signal === name && edgeFires(b.edge, oldValue, value)) ||
        (b.kind === "cond" && isTruthy(evalExpr(b.cond, currentScope(p))));
      if (!fires) return;
      makeReady(p);
      woken.push(p.label);
    });
    return woken;
  };

  const deliver = (p: Proc, value: SvVal) => {
    if (p.receive) writeVar(p.receive.scope, p.receive.name, value);
    p.receive = undefined;
  };

  /** Wakes the processes the IPC core served; each resumes by itself (no polling). */
  const announceMailboxWakes = (name: string, by: Proc, woken: MailboxWake<number>[]) => {
    const mb = mailboxOf(name);
    woken.forEach((w) => {
      const waiter = procs[w.who];
      if (w.kind !== "put") deliver(waiter, w.value);
      makeReady(waiter);
      push({
        kind: "wake",
        pid: waiter.pid,
        lineKey: waiter.lineKey,
        what:
          w.kind === "put"
            ? `${waiter.label} wakes: its ${name}.put(${formatVal(w.value)}) completes now that a slot is free (${mb.items.length}/${mb.bound}).`
            : `${waiter.label} wakes: its ${name}.${w.kind} receives ${formatVal(w.value)}${w.kind === "peek" ? " (the message stays in the mailbox)" : ""}.`,
        why:
          w.kind === "put"
            ? `${by.label} took a message out, so the producer blocked in put() resumes on its own (§15.4.3). Blocked producers are served in arrival order (model assumption).`
            : `${by.label} made a message available. Blocked callers are served oldest-first (the mailbox waiting queue is FIFO, §15.4.5)${
                w.kind === "peek" ? "; a peek copies the message, so it can also release a waiting get (§15.4.7)" : ""
              }. No polling: the waiter resumes by itself.`,
      });
    });
  };

  const announceSemaphoreWakes = (name: string, by: Proc, woken: { who: number; keys: number }[]) => {
    const sem = semaphoreOf(name);
    woken.forEach((w) => {
      sem.held.set(w.who, (sem.held.get(w.who) ?? 0) + w.keys);
      const waiter = procs[w.who];
      makeReady(waiter);
      push({
        kind: "wake",
        pid: waiter.pid,
        lineKey: waiter.lineKey,
        what: `${waiter.label} wakes: its ${name}.get(${w.keys}) gets ${w.keys} key${w.keys === 1 ? "" : "s"} (${sem.keys} left).`,
        why: `${by.label} returned keys. Waiters are woken in arrival order — the semaphore waiting queue is FIFO (§15.3.3). The waiter resumes by itself; nobody polls.`,
      });
    });
  };

  /* ---------- named-block disable (§9.6.2) and disable fork (§9.6.3) ---------- */

  const disableNamed = (name: string, caller: Proc, lineKey: string) => {
    const alive = procs.filter((p) => !isTerminated(p));
    const victims = alive.filter((p) => p.inherited.includes(name));
    const unwinders = alive.filter((p) => !victims.includes(p) && p.frames.some((f) => f.name === name));
    unwinders.forEach((u) => {
      let idx = -1;
      u.frames.forEach((f, i) => {
        if (f.name === name) idx = i;
      });
      u.frames.splice(idx);
      if (u === caller) return;
      cancelWaits(u);
      makeReady(u);
    });
    victims.forEach(kill);
    const others = unwinders.filter((u) => u !== caller);
    push({
      kind: "kill",
      pid: caller.pid,
      lineKey,
      killed: victims.map((p) => p.label),
      unwound: others.map((p) => p.label),
      what: `${caller.label} executes disable ${name}: ${
        victims.length ? `kills ${victims.map((p) => p.label).join(", ")}` : "no spawned process is running in it"
      }${others.length ? `, and forces ${others.map((p) => p.label).join(", ")} out of its ${name} block` : ""}.`,
      why: `disable uses the static block name, so it ends every process executing ${name} — every activation, whoever started it (§9.6.2, §9.6.3).${heldNote(victims)}`,
    });
    victims.forEach(notifyParent);
  };

  /* ---------- statement execution ---------- */

  const pushFrame = (p: Proc, frame: Frame) => p.frames.push(frame);

  const newScope = (parent: Scope, decls: Decl[] | undefined, initScope: Scope): Scope | undefined => {
    if (!decls?.length) return undefined;
    const scope: Scope = { vars: new Map(), parent };
    decls.forEach((d) => scope.vars.set(d.name, evalExpr(d.init, initScope)));
    return scope;
  };

  const spawnLabel = (template: string | undefined, fallback: string, scope: Scope): string => {
    const base = (template ?? fallback).replace(/\{(\w+)\}/g, (_, name: string) => {
      try {
        return formatVal(evalExpr({ kind: "var", name }, scope));
      } catch {
        return name;
      }
    });
    if (base.includes("{#}")) {
      const stem = base.replace(/\s*\{#\}/, "");
      const count = procs.filter((p) => p.label === stem || p.label.startsWith(`${stem} `)).length + 1;
      return `${stem} ${count}`;
    }
    if (!procs.some((p) => p.label === base)) return base;
    let n = 2;
    while (procs.some((p) => p.label === `${base} #${n}`)) n += 1;
    return `${base} #${n}`;
  };

  const thenFrame = (p: Proc, then?: Stmt) => {
    if (then) pushFrame(p, { kind: "then", stmts: [then], pc: 0 });
  };

  const exec = (p: Proc, frame: Frame, stmt: Stmt) => {
    const lineKey = lineOf(stmt);
    p.lineKey = lineKey;
    const scope = currentScope(p);
    switch (stmt.kind) {
      case "delay": {
        frame.pc += 1;
        const amount = evalExpr(stmt.amount, scope);
        if (amount === "X" || amount <= 0) throw new Error(`Scenario ${scenario.id}: only positive delays are modelled`);
        thenFrame(p, stmt.then);
        blockOn(
          p,
          { kind: "delay", until: time + amount },
          {
            lineKey,
            what: `${p.label} waits #${amount}: it sleeps until t = ${time + amount}.`,
            why: "A delay suspends only this process. Other processes keep running at this time step.",
          },
        );
        return;
      }
      case "waitEvent":
        frame.pc += 1;
        thenFrame(p, stmt.then);
        blockOn(p, { kind: "event", event: stmt.event }, {
          lineKey,
          what: `${p.label} blocks on @(${stmt.event}).`,
          why: `@ waits for the next trigger. A trigger that already happened in this time step is missed (§15.5.2)${
            events.get(stmt.event) ? ` — ${stmt.event} was already triggered at t = ${time}, and that trigger does not count` : ""
          }.`,
        });
        return;
      case "waitEdge":
        frame.pc += 1;
        thenFrame(p, stmt.then);
        blockOn(p, { kind: "edge", edge: stmt.edge, signal: stmt.signal }, {
          lineKey,
          what: `${p.label} blocks on @(${stmt.edge} ${stmt.signal}).`,
          why: `An edge control waits for the next change of ${stmt.signal}; an edge that already happened does not count.`,
        });
        return;
      case "waitTriggered": {
        frame.pc += 1;
        thenFrame(p, stmt.then);
        if (events.get(stmt.event)) {
          push({
            kind: "exec",
            pid: p.pid,
            lineKey,
            what: `${p.label} passes wait (${stmt.event}.triggered) at once.`,
            why: `${stmt.event} was triggered earlier in this time step, and its triggered state persists until time advances (§15.5.3).`,
          });
          return;
        }
        blockOn(p, { kind: "triggered", event: stmt.event }, {
          lineKey,
          what: `${p.label} blocks on wait (${stmt.event}.triggered).`,
          why: `${stmt.event} has not been triggered in this time step yet. Unlike @, this wait also succeeds if the trigger comes first in the same time step (§15.5.3).`,
        });
        return;
      }
      case "waitCond": {
        frame.pc += 1;
        thenFrame(p, stmt.then);
        const value = evalExpr(stmt.cond, scope);
        if (isTruthy(value)) {
          push({
            kind: "exec",
            pid: p.pid,
            lineKey,
            what: `${p.label} passes wait (${exprToSource(stmt.cond)}) at once: the condition is already true.`,
            why: "wait (expr) is level-sensitive: it only blocks while the expression is false.",
          });
          return;
        }
        blockOn(p, { kind: "cond", cond: stmt.cond }, {
          lineKey,
          what: `${p.label} blocks on wait (${exprToSource(stmt.cond)}).`,
          why: "The condition is false now; the process resumes when a change makes it true.",
        });
        return;
      }
      case "trigger": {
        frame.pc += 1;
        if (stmt.nonblocking) {
          nba.push({ kind: "trigger", event: stmt.event, pid: p.pid, lineKey });
          push({
            kind: "exec",
            pid: p.pid,
            lineKey,
            what: `${p.label} executes ->> ${stmt.event}: the trigger is scheduled for the NBA region of t = ${time}.`,
            why: "->> does not trigger now. It creates a nonblocking update that triggers the event in the NBA region of this same time step (§15.5.1) — after every process already running at this time has had its turn.",
          });
        } else {
          fireEvent(stmt.event, p, lineKey, "active", false);
        }
        return;
      }
      case "assign": {
        frame.pc += 1;
        const value = evalExpr(stmt.expr, scope);
        if (stmt.nba) {
          nba.push({ kind: "update", scope: lookupScope(scope, stmt.target), target: stmt.target, value, pid: p.pid, lineKey });
          push({
            kind: "exec",
            pid: p.pid,
            lineKey,
            what: `${p.label}: ${stmt.target} <= ${formatVal(value)} is scheduled; ${stmt.target} still reads ${formatVal(evalExpr(v(stmt.target), scope))}.`,
            why: `A nonblocking assignment evaluates its right side now and updates ${stmt.target} in the NBA region of this same time step (t = ${time}), after the Active region empties (§10.4.2). It does not wait for a later time.`,
          });
          return;
        }
        const old = evalExpr(v(stmt.target), scope);
        const woken = writeVar(scope, stmt.target, value);
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label}: ${stmt.target} = ${formatVal(value)}${old !== value ? ` (was ${formatVal(old)})` : ""}.`,
          why: `A blocking assignment updates ${stmt.target} immediately${woken.length ? `; the change wakes ${woken.join(", ")}` : ""}.`,
        });
        return;
      }
      case "display": {
        frame.pc += 1;
        if (stmt.strobe) {
          postponed.push({ pid: p.pid, stmt, scope });
          push({
            kind: "exec",
            pid: p.pid,
            lineKey,
            what: `${p.label} schedules $strobe for the Postponed region of t = ${time}.`,
            why: "$strobe prints at the end of the time step, after every NBA update has landed (§21.2.2).",
          });
          return;
        }
        const text = formatDisplay(stmt.format, stmt.args.map((a) => evalExpr(a, scope)));
        log.push({ time, pid: p.pid, label: p.label, text, region: p.kind === "final" ? "final" : "active" });
        push({
          kind: "print",
          pid: p.pid,
          lineKey,
          region: p.kind === "final" ? "final" : "active",
          what: `${p.label} prints "${text}".`,
          why: "$display prints the values visible at this instant.",
        });
        return;
      }
      case "seq": {
        frame.pc += 1;
        const blockScope = newScope(scope, stmt.decls, scope);
        pushFrame(p, { kind: "block", stmts: stmt.body, pc: 0, name: stmt.name, scope: blockScope, ownerId: stmt.id });
        if (blockScope) {
          const inits = (stmt.decls ?? []).map((d) => `${d.name} = ${formatVal(blockScope.vars.get(d.name))}`).join(", ");
          p.lineKey = `${stmt.id}:decls`;
          push({
            kind: "exec",
            pid: p.pid,
            lineKey: p.lineKey,
            what: `${p.label} enters the block: automatic ${inits}.`,
            why: "A variable declared inside a begin-end is initialized when this process reaches the block — for a spawned process, that is when it starts running, not when it was forked (§9.3.2).",
          });
        }
        return;
      }
      case "fork": {
        frame.pc += 1;
        const forkScope = newScope(scope, stmt.decls, scope);
        const childBase = forkScope ?? scope;
        const inherited = [...namesWithin(p), ...(stmt.name ? [stmt.name] : [])];
        const kids = stmt.branches.map((branch, i) => {
          const child: Proc = {
            pid: procs.length,
            label: spawnLabel(stmt.labels?.[i], `${p.label}.${i + 1}`, childBase),
            parent: p.pid,
            children: [],
            rank: procs.length,
            state: "pending",
            frames: [{ kind: "branch", stmts: [branch], pc: 0 }],
            inherited,
            baseScope: childBase,
            lineKey: lineOf(branch),
            kind: "child",
            depth: p.depth + 1,
          };
          procs.push(child);
          p.children.push(child.pid);
          return child;
        });
        const declNote = forkScope
          ? ` Fork-local ${(stmt.decls ?? []).map((d) => `${d.name} = ${formatVal(forkScope.vars.get(d.name))}`).join(", ")} is initialized now, before anything is spawned (§9.3.2).`
          : "";
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label} forks ${kids.map((k) => k.label).join(", ")} (${stmt.join}).${declNote}`,
          why: `Each statement in the fork becomes its own process. None of them runs until ${p.label} blocks or terminates (§9.3.2).${
            stmt.join === "join_none" ? ` With join_none, ${p.label} keeps going without waiting.` : ""
          }`,
        });
        if (stmt.join === "join_none") return;
        pushFrame(p, { kind: "join", stmts: [], pc: 0, name: stmt.name, join: stmt.join, children: kids.map((k) => k.pid), ownerId: stmt.id });
        p.lineKey = `${stmt.id}:join`;
        blockOn(p, { kind: "join", join: stmt.join }, {
          lineKey: p.lineKey,
          what: `${p.label} waits at ${stmt.join}.`,
          why:
            stmt.join === "join"
              ? "join: the parent resumes when every spawned process has terminated."
              : "join_any: the parent resumes when the first spawned process terminates.",
        });
        return;
      }
      case "disableFork": {
        frame.pc += 1;
        const victims = descendants(p).filter((d) => !isTerminated(d));
        victims.forEach(kill);
        push({
          kind: "kill",
          pid: p.pid,
          lineKey,
          killed: victims.map((d) => d.label),
          what: victims.length
            ? `${p.label} executes disable fork: kills ${victims.map((d) => d.label).join(", ")}.`
            : `${p.label} executes disable fork: no descendant is still running.`,
          why: `disable fork ends every descendant of the calling process — not just the processes of the last fork — including descendants of children that already finished (§9.6.3).${heldNote(victims)}`,
        });
        victims.forEach(notifyParent);
        return;
      }
      case "waitFork": {
        frame.pc += 1;
        const alive = p.children.filter((k) => !isTerminated(procs[k]));
        if (alive.length === 0) {
          push({ kind: "exec", pid: p.pid, lineKey, what: `${p.label} passes wait fork at once: no child is running.`, why: "wait fork only waits for immediate children (§9.6.1)." });
          return;
        }
        blockOn(p, { kind: "waitFork" }, {
          lineKey,
          what: `${p.label} waits in wait fork for ${alive.map((k) => procs[k].label).join(", ")}.`,
          why: "wait fork blocks until every immediate child has terminated. Grandchildren (processes the children spawned) are not waited for (§9.6.1).",
        });
        return;
      }
      case "disable":
        frame.pc += 1;
        disableNamed(stmt.target, p, lineKey);
        return;
      case "repeat":
        frame.pc += 1;
        if (stmt.count > 0) pushFrame(p, { kind: "repeat", stmts: stmt.body, pc: 0, remaining: stmt.count, ownerId: stmt.id });
        return;
      case "forever":
        frame.pc += 1;
        pushFrame(p, { kind: "forever", stmts: stmt.body, pc: 0, ownerId: stmt.id });
        return;
      case "for": {
        frame.pc += 1;
        const loopScope: Scope = { vars: new Map([[stmt.variable, stmt.from]]), parent: scope };
        if (stmt.from >= stmt.to) return;
        pushFrame(p, { kind: "for", stmts: stmt.body, pc: 0, scope: loopScope, variable: stmt.variable, to: stmt.to, ownerId: stmt.id });
        push({
          kind: "loop",
          pid: p.pid,
          lineKey,
          what: `${p.label} enters the loop with ${stmt.variable} = ${stmt.from}.`,
          why: `The loop owns one variable ${stmt.variable}; every iteration updates that same variable.`,
        });
        return;
      }
      case "if": {
        frame.pc += 1;
        const taken = isTruthy(evalExpr(stmt.cond, scope));
        const branch = taken ? stmt.then : stmt.else;
        if (branch?.length) pushFrame(p, { kind: "then", stmts: branch, pc: 0 });
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label}: if (${exprToSource(stmt.cond)}) is ${taken ? "true" : "false"}.`,
          why: taken ? "The condition holds, so the guarded statement runs." : "The condition is false, so the guarded statement is skipped.",
        });
        return;
      }
      case "call": {
        frame.pc += 1;
        const task = tasks.get(stmt.task);
        if (!task) throw new Error(`Scenario ${scenario.id}: unknown task ${stmt.task}`);
        const args = stmt.args.map((a) => evalExpr(a, scope));
        let taskScope: Scope;
        if (task.automatic) {
          taskScope = { vars: new Map(), parent: global };
        } else {
          taskScope = staticTaskScopes.get(task.name) ?? { vars: new Map(), parent: global };
          staticTaskScopes.set(task.name, taskScope);
        }
        task.params.forEach((name, i) => taskScope.vars.set(name, args[i] ?? "X"));
        pushFrame(p, { kind: "task", stmts: task.body, pc: 0, name: task.name, scope: taskScope, ownerId: stmt.id });
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label} calls ${task.name}(${args.map(formatVal).join(", ")}).`,
          why: task.automatic
            ? "An automatic task gets fresh argument storage for every call, so concurrent calls do not interfere."
            : "A static task has one copy of its arguments shared by every call — concurrent calls overwrite each other.",
        });
        return;
      }
      case "return": {
        frame.pc += 1;
        let idx = -1;
        p.frames.forEach((f, i) => {
          if (f.kind === "task") idx = i;
        });
        const taskName = idx >= 0 ? p.frames[idx].name : undefined;
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label} returns early${taskName ? ` from ${taskName}` : ""}.`,
          why: "return skips every statement left in the task — including any cleanup written after it.",
        });
        if (idx >= 0) p.frames.splice(idx);
        else p.frames = [];
        return;
      }
      case "finish":
        frame.pc += 1;
        p.state = "done";
        push({
          kind: "finish",
          pid: p.pid,
          lineKey,
          what: `${p.label} calls $finish at t = ${time}.`,
          why: "$finish ends the simulation immediately. Processes still waiting never resume; final procedures run next (§9.2.3).",
        });
        outcome = { kind: "finish", time, by: p.label };
        throw new StopSimulation();
      case "mailbox":
        frame.pc += 1;
        execMailbox(p, stmt, scope, lineKey);
        return;
      case "semaphore":
        frame.pc += 1;
        execSemaphore(p, stmt, scope, lineKey);
        return;
    }
  };

  const setResult = (scope: Scope, name: string | undefined, value: number) => {
    if (name) writeVar(scope, name, value);
  };

  const execMailbox = (p: Proc, stmt: Extract<Stmt, { kind: "mailbox" }>, scope: Scope, lineKey: string) => {
    const mb = mailboxOf(stmt.mailbox);
    const name = stmt.mailbox;
    const fill = () => `${mb.items.length}/${mb.bound === 0 ? "∞" : mb.bound}`;
    switch (stmt.op) {
      case "put":
      case "try_put": {
        const value = evalExpr(stmt.value ?? c(0), scope);
        const r = mailboxPut(mb, p.pid, value, stmt.op === "put");
        Object.assign(mb, r.state);
        if (r.blocked) {
          blockOn(p, { kind: "mbxPut", mailbox: name, value }, {
            lineKey,
            what: `${p.label} blocks in ${name}.put(${formatVal(value)}): the mailbox is full (${fill()}).`,
            why: "put() on a full bounded mailbox suspends the caller until a get() frees a slot (§15.4.3).",
          });
          return;
        }
        if (!r.stored) {
          setResult(scope, stmt.result, 0);
          push({ kind: "exec", pid: p.pid, lineKey, what: `${p.label}: ${name}.try_put(${formatVal(value)}) returns 0 — the mailbox is full (${fill()}) and unchanged.`, why: "try_put never blocks: on a full mailbox it returns 0 and stores nothing (§15.4.4)." });
          return;
        }
        setResult(scope, stmt.result, 1);
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label}: ${name}.${stmt.op}(${formatVal(value)}) stores it${stmt.op === "try_put" ? " and returns 1" : ""}.`,
          why: mb.bound === 0 ? "new() with no bound is unbounded: put() never blocks (§15.4.1)." : "There was room, so the message is stored in FIFO order (§15.4.3).",
        });
        announceMailboxWakes(name, p, r.woken);
        return;
      }
      case "get":
      case "peek":
      case "try_get":
      case "try_peek": {
        const peek = stmt.op === "peek" || stmt.op === "try_peek";
        const tryOp = stmt.op === "try_get" || stmt.op === "try_peek";
        const target = stmt.target as string;
        const r = mailboxTake(mb, p.pid, peek, !tryOp);
        Object.assign(mb, r.state);
        if (r.blocked) {
          p.receive = { scope: lookupScope(scope, target), name: target };
          blockOn(p, { kind: "mbxGet", mailbox: name, peek }, {
            lineKey,
            what: `${p.label} blocks in ${name}.${stmt.op}(${target}): the mailbox is empty.`,
            why: `${stmt.op}() on an empty mailbox suspends the caller until a put() arrives (§15.4.5, §15.4.7).`,
          });
          return;
        }
        if (r.value === undefined) {
          setResult(scope, stmt.result, 0);
          push({ kind: "exec", pid: p.pid, lineKey, what: `${p.label}: ${name}.${stmt.op}(${target}) returns 0 — the mailbox is empty.`, why: `${stmt.op} never blocks: on an empty mailbox it returns 0 and leaves ${target} unchanged (§15.4.6, §15.4.8).` });
          return;
        }
        writeVar(scope, target, r.value);
        setResult(scope, stmt.result, 1);
        push({
          kind: "exec",
          pid: p.pid,
          lineKey,
          what: `${p.label}: ${name}.${stmt.op}(${target}) ${peek ? "copies" : "takes"} ${formatVal(r.value)} (${fill()} left)${tryOp ? " and returns 1" : ""}.`,
          why: peek ? "peek copies the oldest message and leaves it in the mailbox (§15.4.7)." : "get removes the oldest message — mailboxes are FIFO (§15.4.5).",
        });
        announceMailboxWakes(name, p, r.woken);
        return;
      }
      case "num": {
        writeVar(scope, stmt.target as string, mb.items.length);
        push({ kind: "exec", pid: p.pid, lineKey, what: `${p.label}: ${name}.num() returns ${mb.items.length}.`, why: "num() is only valid until the next put or get by any process (§15.4.2)." });
        return;
      }
    }
  };

  const execSemaphore = (p: Proc, stmt: Extract<Stmt, { kind: "semaphore" }>, scope: Scope, lineKey: string) => {
    const sem = semaphoreOf(stmt.semaphore);
    const name = stmt.semaphore;
    const n = stmt.keys;
    if (stmt.op === "put") {
      const r = semaphorePut(sem, n);
      Object.assign(sem, r.state);
      sem.held.set(p.pid, Math.max(0, (sem.held.get(p.pid) ?? 0) - n));
      const freed = sem.keys + r.woken.reduce((sum, w) => sum + w.keys, 0);
      push({
        kind: "exec",
        pid: p.pid,
        lineKey,
        what: `${p.label}: ${name}.put(${n}) returns ${n} key${n === 1 ? "" : "s"} (${freed} free before waiters are served).`,
        why: `put() always succeeds and never checks who took the keys; the count can even exceed the initial ${sem.initial} (§15.3.1, §15.3.2).`,
      });
      announceSemaphoreWakes(name, p, r.woken);
      return;
    }
    const r = semaphoreGet(sem, p.pid, n, stmt.op === "get");
    const before = sem.keys;
    Object.assign(sem, r.state);
    if (r.acquired) {
      sem.held.set(p.pid, (sem.held.get(p.pid) ?? 0) + n);
      setResult(scope, stmt.result, 1);
      push({
        kind: "exec",
        pid: p.pid,
        lineKey,
        what: `${p.label}: ${name}.${stmt.op}(${n}) takes ${n} key${n === 1 ? "" : "s"} (${sem.keys} left)${stmt.op === "try_get" ? " and returns 1" : ""}.`,
        why: "Enough keys were available, so the call returns at once (§15.3.3).",
      });
      return;
    }
    if (!r.blocked) {
      setResult(scope, stmt.result, 0);
      push({
        kind: "exec",
        pid: p.pid,
        lineKey,
        what: `${p.label}: ${name}.try_get(${n}) returns 0 — only ${before} key${before === 1 ? "" : "s"} free.`,
        why: "try_get never blocks: it returns 0 and takes nothing (§15.3.4). Code that ignores the 0 runs without the key.",
      });
      return;
    }
    blockOn(p, { kind: "semGet", semaphore: name, keys: n }, {
      lineKey,
      what: `${p.label} blocks in ${name}.get(${n}): ${before} key${before === 1 ? "" : "s"} free, ${n} needed. Queue position ${sem.waiters.length}.`,
      why: "get() suspends the caller until enough keys are returned; waiters queue first-in first-out (§15.3.3).",
    });
  };

  /** Called when a frame's statements are exhausted. */
  const endFrame = (p: Proc, frame: Frame) => {
    switch (frame.kind) {
      case "for": {
        const scope = frame.scope as Scope;
        const name = frame.variable as string;
        const next = (scope.vars.get(name) as number) + 1;
        scope.vars.set(name, next);
        p.lineKey = frame.ownerId;
        if (next < (frame.to as number)) {
          frame.pc = 0;
          push({ kind: "loop", pid: p.pid, lineKey: frame.ownerId, what: `${p.label}: ${name}++ → ${name} = ${next}; loop again.`, why: `The same loop variable ${name} now holds ${next}.` });
        } else {
          p.frames.pop();
          push({
            kind: "loop",
            pid: p.pid,
            lineKey: frame.ownerId,
            what: `${p.label}: ${name}++ → ${name} = ${next}; ${next} < ${frame.to} is false, so the loop ends.`,
            why: `The loop variable keeps its final value ${next}. Any spawned process that reads ${name} later sees ${next}.`,
          });
        }
        return;
      }
      case "repeat":
        frame.remaining = (frame.remaining as number) - 1;
        if (frame.remaining > 0) frame.pc = 0;
        else p.frames.pop();
        return;
      case "forever":
        frame.pc = 0;
        return;
      case "root":
        if (p.kind === "always") {
          frame.pc = 0;
          return;
        }
        p.frames.pop();
        return;
      default:
        p.frames.pop();
    }
  };

  const run = (p: Proc) => {
    p.state = "running";
    while (p.state === "running") {
      const frame = p.frames[p.frames.length - 1];
      if (!frame) {
        terminate(p, p.kind === "child" ? "Its statement is complete; the process ends." : "Its last statement is done; an initial procedure runs only once (§9.2.1).");
        return;
      }
      if (frame.pc >= frame.stmts.length) {
        endFrame(p, frame);
        continue;
      }
      statementsThisStep += 1;
      if (statementsThisStep > loopBudget) {
        outcome = { kind: "zero-delay-loop", time, label: p.label, statements: statementsThisStep - 1 };
        push({
          kind: "loop",
          pid: p.pid,
          what: `Stopped: ${statementsThisStep - 1} statements ran at t = ${time} without time advancing. ${p.label} is in a zero-delay loop.`,
          why: "Nothing in the loop blocks, so simulation time can never advance. A real simulator hangs here.",
        });
        throw new StopSimulation();
      }
      exec(p, frame, frame.stmts[frame.pc]);
    }
  };

  const pickNext = (): Proc => {
    const ready = [...active].sort((a, b) => procs[a].rank - procs[b].rank);
    let picked = ready[0];
    if (ready.length > 1) {
      const cp = usedChoices.length;
      const requested = options.choices?.[cp] ?? (order === "reverse" ? ready.length - 1 : 0);
      const index = Math.min(Math.max(requested, 0), ready.length - 1);
      usedChoices.push(index);
      choiceWidths.push(ready.length);
      picked = ready[index];
      pendingChoice = { options: ready.map(labelOf), picked: labelOf(picked) };
    }
    active = active.filter((pid) => pid !== picked);
    return procs[picked];
  };

  const applyNba = () => {
    const entries = nba;
    nba = [];
    entries.forEach((entry) => {
      const by = procs[entry.pid];
      if (entry.kind === "trigger") {
        fireEvent(entry.event, by, entry.lineKey, "nba", true);
        return;
      }
      const old = entry.scope.vars.get(entry.target) ?? "X";
      const woken = writeVar(entry.scope, entry.target, entry.value);
      push({
        region: "nba",
        kind: "nba",
        pid: entry.pid,
        lineKey: entry.lineKey,
        what: `NBA region, still t = ${time}: ${entry.target} updates ${formatVal(old)} → ${formatVal(entry.value)}.`,
        why: `The Active region is empty, so the nonblocking update scheduled by ${by.label} lands now — same simulation time, later region (§10.4.2).${
          woken.length ? ` The change wakes ${woken.join(", ")}.` : ""
        }`,
      });
    });
  };

  const runPostponed = () => {
    const entries = postponed;
    postponed = [];
    entries.forEach((entry) => {
      const p = procs[entry.pid];
      const text = formatDisplay(entry.stmt.format, entry.stmt.args.map((a) => evalExpr(a, entry.scope)));
      log.push({ time, pid: p.pid, label: p.label, text, region: "postponed" });
      push({
        region: "postponed",
        kind: "print",
        pid: p.pid,
        lineKey: lineOf(entry.stmt),
        what: `Postponed region, t = ${time}: $strobe from ${p.label} prints "${text}".`,
        why: "$strobe reads the settled values at the end of the time step, after every NBA update.",
      });
    });
  };

  /* ---------- top-level procedures ---------- */

  const finals: ProcessDef[] = [];
  scenario.processes.forEach((def) => {
    if (def.kind === "final") {
      finals.push(def);
      return;
    }
    const p: Proc = {
      pid: procs.length,
      label: def.label,
      parent: null,
      children: [],
      rank: procs.length,
      state: "ready",
      frames: [{ kind: "root", stmts: def.body, pc: 0, ownerId: def.id }],
      inherited: [],
      baseScope: global,
      lineKey: lineKeyOf.get(`${def.id}:head`) ?? `${def.id}:head`,
      kind: def.kind,
      depth: 0,
    };
    procs.push(p);
    active.push(p.pid);
  });

  push({
    region: "active",
    kind: "start",
    what: `t = 0: ${procs.map((p) => p.label).join(", ")} ${procs.length === 1 ? "is" : "are"} ready to run.`,
    why: "Every initial and always procedure is enabled at the start of simulation; the standard sets no order between them (§9.2).",
  });

  try {
    for (;;) {
      for (;;) {
        if (active.length > 0) {
          run(pickNext());
          continue;
        }
        if (nba.length > 0) {
          applyNba();
          continue;
        }
        break;
      }
      if (postponed.length > 0) runPostponed();
      events.forEach((_, name) => events.set(name, false));
      if (future.length === 0) {
        outcome = { kind: "quiet", time };
        break;
      }
      const nextTime = Math.min(...future.map((f) => f.time));
      const due = future.filter((f) => f.time === nextTime).sort((a, b) => a.seq - b.seq);
      future = future.filter((f) => f.time !== nextTime);
      time = nextTime;
      statementsThisStep = 0;
      due.forEach((f) => makeReady(procs[f.pid]));
      push({
        region: "advance",
        kind: "advance",
        what: `Time advances to t = ${time}: ${due.map((f) => procs[f.pid].label).join(", ")} wake${due.length === 1 ? "s" : ""} from a delay.`,
        why: "Nothing else can happen at the previous time, so the simulator jumps to the next scheduled wake-up. Every .triggered state resets (§15.5.3).",
      });
    }
  } catch (error) {
    if (!(error instanceof StopSimulation)) throw error;
  }

  const blockedAtEnd = procs
    .filter((p) => p.state === "blocked" || p.state === "pending" || p.state === "ready")
    .map((p) => ({ label: p.label, on: p.state === "blocked" ? describeBlock(p) ?? "" : p.state === "pending" ? "never started" : "ready, never resumed" }));

  // final procedures (§9.2.3): once, in zero time, at the end of simulation.
  if ((outcome as SimOutcome | null)?.kind !== "zero-delay-loop") {
    finals.forEach((def) => {
      const p: Proc = {
        pid: procs.length,
        label: def.label,
        parent: null,
        children: [],
        rank: procs.length,
        state: "running",
        frames: [{ kind: "root", stmts: def.body, pc: 0, ownerId: def.id }],
        inherited: [],
        baseScope: global,
        lineKey: lineKeyOf.get(`${def.id}:head`) ?? `${def.id}:head`,
        kind: "final",
        depth: 0,
      };
      procs.push(p);
      push({
        region: "final",
        kind: "final",
        pid: p.pid,
        lineKey: p.lineKey,
        what: `Simulation is over at t = ${time}; ${def.label} runs now.`,
        why: "A final procedure runs exactly once, when simulation ends ($finish or no more events), in zero time (§9.2.3). It is not part of any time step's regions.",
      });
      while (p.frames.length > 0) {
        const frame = p.frames[p.frames.length - 1];
        if (frame.pc >= frame.stmts.length) {
          p.frames.pop();
          continue;
        }
        const stmt = frame.stmts[frame.pc];
        if (!["display", "assign", "if"].includes(stmt.kind)) throw new Error(`final procedures may only contain function-like statements (${stmt.kind})`);
        exec(p, frame, stmt);
      }
      p.state = "done";
      p.lineKey = undefined;
    });
  }

  const finalOutcome: SimOutcome = (outcome as SimOutcome | null) ?? { kind: "quiet", time };
  push({
    region: "end",
    kind: "end",
    what:
      finalOutcome.kind === "finish"
        ? `Simulation ended by $finish at t = ${finalOutcome.time}.`
        : finalOutcome.kind === "zero-delay-loop"
          ? `Simulation is stuck at t = ${finalOutcome.time}: ${finalOutcome.label} never lets time advance.`
          : `No more events are scheduled: simulation ends at t = ${finalOutcome.time}.`,
    why: !blockedAtEnd.length
      ? "Every process finished or was ended."
      : finalOutcome.kind === "finish"
        ? `Still alive when $finish ran, and simply stopped: ${blockedAtEnd.map((b) => `${b.label} (${b.on})`).join("; ")}.`
        : `Still waiting, and nothing can ever wake them: ${blockedAtEnd.map((b) => `${b.label} (${b.on})`).join("; ")}. In a UVM test with a raised objection this is a hang.`,
  });

  return {
    scenarioId: scenario.id,
    trace,
    log,
    outcome: finalOutcome,
    endTime: time,
    blockedAtEnd,
    finalVars: snapshotVars(),
    finalSemaphores: snapshotSemaphores(),
    finalMailboxes: snapshotMailboxes(),
    choices: usedChoices,
    choiceWidths,
    processes: procs.map((p) => ({ pid: p.pid, label: p.label, parent: p.parent, depth: p.depth, kind: p.kind })),
  };
}

/* ------------------------------------------------------------------------- */
/* Order exploration.                                                         */
/* ------------------------------------------------------------------------- */

export interface ProcessOutcomeGroup {
  signature: string;
  result: SimResult;
  runs: number[][];
}

export interface ProcessExploration {
  deterministic: boolean;
  outcomes: ProcessOutcomeGroup[];
  runCount: number;
}

export function outcomeSignature(result: SimResult): string {
  return [
    result.outcome.kind,
    result.log.map((l) => `${l.time}:${l.label}:${l.text}`).join("|"),
    result.blockedAtEnd.map((b) => b.label).join(","),
  ].join("#");
}

/** Runs every legal order of simultaneously ready processes and groups distinct outcomes. */
export function exploreProcessOrders(scenario: ProcessScenario, maxRuns = 128): ProcessExploration {
  const groups = new Map<string, ProcessOutcomeGroup>();
  const stack: number[][] = [[]];
  let runCount = 0;
  while (stack.length > 0) {
    const prefix = stack.pop() as number[];
    const result = simulateProcesses(scenario, { choices: prefix });
    runCount += 1;
    if (runCount > maxRuns) throw new Error(`Scenario ${scenario.id} exceeded ${maxRuns} orderings`);
    for (let i = result.choices.length - 1; i >= prefix.length; i -= 1) {
      for (let alt = 1; alt < result.choiceWidths[i]; alt += 1) stack.push([...result.choices.slice(0, i), alt]);
    }
    const signature = outcomeSignature(result);
    const group = groups.get(signature);
    if (group) group.runs.push(result.choices);
    else groups.set(signature, { signature, result, runs: [result.choices] });
  }
  const outcomes = [...groups.values()];
  return { deterministic: outcomes.length === 1, outcomes, runCount };
}

/* ------------------------------------------------------------------------- */
/* Lanes: per-process activity over simulation time, derived from a trace.    */
/* ------------------------------------------------------------------------- */

export interface LaneMark {
  time: number;
  kind: "start" | "print" | "done" | "killed" | "wake" | "block";
  text?: string;
}

export interface Lane {
  pid: number;
  label: string;
  depth: number;
  /** Time the process was created (spawned) and first ran. */
  created: number;
  started?: number;
  /** Last time covered by the lane: termination, or the step's time. */
  end: number;
  endState: ThreadState;
  marks: LaneMark[];
}

/** Builds lanes from the first `uptoIndex + 1` steps, so a lane chart can grow with playback. */
export function processLanes(result: SimResult, uptoIndex = result.trace.length - 1): Lane[] {
  const lanes = new Map<number, Lane>();
  const steps = result.trace.slice(0, uptoIndex + 1);
  const last = steps[steps.length - 1];
  let prev: Map<number, ProcSnapshot> = new Map();
  steps.forEach((step) => {
    step.procs.forEach((p) => {
      let lane = lanes.get(p.pid);
      if (!lane) {
        lane = { pid: p.pid, label: p.label, depth: p.depth, created: step.time, end: step.time, endState: p.state, marks: [] };
        lanes.set(p.pid, lane);
      }
      const before = prev.get(p.pid);
      if (lane.started === undefined && (p.state === "running" || (step.pid === p.pid && p.state !== "pending"))) {
        lane.started = step.time;
        lane.marks.push({ time: step.time, kind: "start" });
      }
      if (before && before.state !== p.state) {
        if (p.state === "done") lane.marks.push({ time: step.time, kind: "done" });
        if (p.state === "killed") lane.marks.push({ time: step.time, kind: "killed" });
      }
      if (p.state !== "done" && p.state !== "killed") lane.end = step.time;
      else if (lane.endState !== "done" && lane.endState !== "killed") lane.end = step.time;
      lane.endState = p.state;
    });
    if (step.kind === "print" && step.pid !== undefined) {
      const text = step.log[step.log.length - 1]?.text;
      lanes.get(step.pid)?.marks.push({ time: step.time, kind: "print", text });
    }
    prev = new Map(step.procs.map((p) => [p.pid, p]));
  });
  // Lanes of live processes extend to the current time.
  lanes.forEach((lane) => {
    if (lane.endState !== "done" && lane.endState !== "killed") lane.end = last?.time ?? lane.end;
  });
  return [...lanes.values()];
}

/* ------------------------------------------------------------------------- */
/* Scenario catalogue (fork/join, process control, events, IPC).               */
/* ------------------------------------------------------------------------- */

const display = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args });
const delay = (amount: number | Expr, then?: Stmt): Stmt => ({ kind: "delay", amount: typeof amount === "number" ? c(amount) : amount, then });

export type ProcessScenarioId =
  | "join-variants"
  | "timeout-disable-fork"
  | "wait-fork"
  | "fork-loop-capture"
  | "named-disable"
  | "event-race";

export type JoinVariant = JoinKind;

export function joinVariantsScenario(join: JoinVariant): ProcessScenario {
  const child = (name: string, d: number): Stmt => ({
    kind: "seq",
    body: [display(`${name} starts`), delay(d, display(`${name} done`))],
  });
  return {
    id: `join-variants:${join}`,
    title: `fork … ${join}`,
    processes: [
      {
        id: "parent",
        label: "parent",
        kind: "initial",
        body: [
          display("parent: fork"),
          { kind: "fork", join, branches: [child("A", 10), child("B", 30), child("C", 20)], labels: ["A", "B", "C"] },
          display("parent continues"),
        ],
      },
    ],
  };
}

export type TimeoutFix = "none" | "isolate" | "named" | "wait-fork" | "remove";

/**
 * The per-transaction timeout pattern from a driver: `xfer` races a response
 * against a timer with join_any, then cleans up. A monitor was forked earlier
 * by the same process, and a watchdog stops runaway runs.
 */
export function timeoutBenchScenario(fix: TimeoutFix, concurrent: boolean): ProcessScenario {
  const race: Stmt = {
    id: "xfer-fork",
    kind: "fork",
    name: fix === "named" ? "guard" : undefined,
    join: "join_any",
    branches: [delay(v("lat"), display("xfer %0d response", v("id"))), delay(40, display("xfer %0d TIMEOUT", v("id")))],
    labels: ["rsp {id}", "timer {id}"],
  };
  const cleanup: Stmt[] =
    fix === "remove"
      ? []
      : fix === "named"
        ? [{ id: "xfer-cleanup", kind: "disable", target: "guard" }]
        : fix === "wait-fork"
          ? [{ id: "xfer-cleanup", kind: "waitFork" }]
          : [{ id: "xfer-cleanup", kind: "disableFork" }];
  const body: Stmt[] =
    fix === "isolate"
      ? [{ kind: "fork", join: "join", branches: [{ kind: "seq", body: [race, ...cleanup] }], labels: ["wrapper {id}"], comment: "isolation wrapper" }]
      : [race, ...cleanup];
  const calls: Stmt[] = concurrent
    ? [{ id: "call-xfer", kind: "fork", join: "join", branches: [{ kind: "call", task: "xfer", args: [c(1), c(15)] }, { kind: "call", task: "xfer", args: [c(2), c(30)] }], labels: ["xfer(1)", "xfer(2)"] }]
    : [{ id: "call-xfer", kind: "call", task: "xfer", args: [c(1), c(15)] }];
  return {
    id: `timeout:${fix}:${concurrent ? "2" : "1"}`,
    title: "Per-transaction timeout",
    tasks: [{ name: "xfer", automatic: true, params: ["id", "lat"], body }],
    processes: [
      {
        id: "test",
        label: "test",
        kind: "initial",
        body: [
          { id: "spawn-monitor", kind: "fork", join: "join_none", branches: [{ kind: "forever", body: [delay(10, display("monitor alive"))] }], labels: ["monitor"] },
          ...calls,
          { ...delay(30, display("test done")), id: "test-wait" },
          { kind: "finish" },
        ],
      },
      { id: "watchdog", label: "watchdog", kind: "initial", body: [delay(100, { kind: "finish" })] },
    ],
  };
}

export function waitForkScenario(): ProcessScenario {
  return {
    id: "wait-fork",
    title: "wait fork waits for children, not grandchildren",
    processes: [
      {
        id: "parent",
        label: "parent",
        kind: "initial",
        body: [
          {
            kind: "fork",
            join: "join_none",
            labels: ["A", "B"],
            branches: [
              delay(10, display("A done")),
              {
                kind: "seq",
                body: [
                  { kind: "fork", join: "join_none", branches: [delay(50, display("G (grandchild) done"))], labels: ["G"] },
                  delay(20, display("B done")),
                ],
              },
            ],
          },
          { kind: "waitFork" },
          display("parent passes wait fork"),
        ],
      },
    ],
  };
}

export type CaptureVariant = "bug" | "fork-automatic" | "begin-automatic";

export function forkLoopScenario(variant: CaptureVariant): ProcessScenario {
  const branch: Stmt =
    variant === "bug"
      ? display("i = %0d", v("i"))
      : variant === "fork-automatic"
        ? display("k = %0d", v("k"))
        : { kind: "seq", decls: [{ name: "m", init: v("i") }], body: [display("m = %0d", v("m"))] };
  return {
    id: `fork-loop:${variant}`,
    title: "fork inside a for loop",
    processes: [
      {
        id: "parent",
        label: "parent",
        kind: "initial",
        body: [
          {
            kind: "for",
            variable: "i",
            from: 0,
            to: 3,
            body: [{ kind: "fork", join: "join_none", decls: variant === "fork-automatic" ? [{ name: "k", init: v("i") }] : undefined, branches: [branch], labels: ["child {#}"] }],
          },
          { kind: "waitFork" },
        ],
      },
    ],
  };
}

export type EventVariant = "at-trigger" | "triggered" | "nonblocking" | "triggered-loop";

export function eventRaceScenario(variant: EventVariant): ProcessScenario {
  const consumerBody: Stmt[] =
    variant === "triggered-loop"
      ? [delay(10), { kind: "forever", body: [{ kind: "waitTriggered", event: "done" }, { kind: "assign", target: "n", expr: bin("+", v("n"), c(1)) }] }]
      : [
          delay(10, variant === "triggered" ? { kind: "waitTriggered", event: "done" } : { kind: "waitEvent", event: "done" }),
          display("consumer woke"),
        ];
  return {
    id: `event-race:${variant}`,
    title: "Trigger and wait in the same time step",
    vars: variant === "triggered-loop" ? [{ name: "n", type: "int", init: 0 }] : undefined,
    events: ["done"],
    loopBudget: variant === "triggered-loop" ? 40 : undefined,
    processes: [
      {
        id: "producer",
        label: "producer",
        kind: "initial",
        body: [delay(10, { kind: "trigger", event: "done", nonblocking: variant === "nonblocking" }), display("producer triggered done")],
      },
      { id: "consumer", label: "consumer", kind: "initial", body: consumerBody },
    ],
  };
}

export type SemaphoreVariant = "fifo" | "multi-key";

export function semaphoreScenario(variant: SemaphoreVariant): ProcessScenario {
  if (variant === "multi-key") {
    return {
      id: "sem:multi-key",
      title: "get(2) waits for two keys",
      semaphores: [{ name: "sem", keys: 0 }],
      processes: [
        { id: "B", label: "B", kind: "initial", body: [{ kind: "semaphore", op: "get", semaphore: "sem", keys: 2 }, display("B got 2 keys")] },
        {
          id: "A",
          label: "A",
          kind: "initial",
          body: [delay(5, { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 }), delay(5, { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 })],
        },
      ],
    };
  }
  return {
    id: "sem:fifo",
    title: "Waiters wake first-in first-out",
    semaphores: [{ name: "sem", keys: 1 }],
    processes: [
      { id: "A", label: "A", kind: "initial", body: [{ kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }, delay(10, { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 })] },
      {
        id: "B",
        label: "B",
        kind: "initial",
        body: [delay(2, { kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }), display("B got the key"), delay(5, { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 })],
      },
      {
        id: "C",
        label: "C",
        kind: "initial",
        body: [delay(4, { kind: "semaphore", op: "get", semaphore: "sem", keys: 1 }), display("C got the key"), { kind: "semaphore", op: "put", semaphore: "sem", keys: 1 }],
      },
    ],
  };
}

export function mailboxScenario(bound: number): ProcessScenario {
  return {
    id: `mbx:${bound}`,
    title: "Bounded mailbox back-pressure",
    vars: [{ name: "v", type: "int", init: 0 }],
    mailboxes: [{ name: "mbx", bound }],
    processes: [
      {
        id: "producer",
        label: "producer",
        kind: "initial",
        body: [{ kind: "for", variable: "i", from: 0, to: 4, body: [{ kind: "mailbox", op: "put", mailbox: "mbx", value: v("i") }, display("sent %0d", v("i"))] }],
      },
      {
        id: "consumer",
        label: "consumer",
        kind: "initial",
        body: [{ kind: "repeat", count: 4, body: [delay(10, { kind: "mailbox", op: "get", mailbox: "mbx", target: "v" }), display("got %0d", v("v"))] }],
      },
    ],
  };
}

export type KeyLeakFix = "bug" | "put-before-return" | "put-early" | "try-get" | "two-keys";

/** A sender returns early on an error path while holding the bus key. */
export function keyLeakScenario(fix: KeyLeakFix): ProcessScenario {
  const get: Stmt =
    fix === "try-get"
      ? { id: "send-get", kind: "semaphore", op: "try_get", semaphore: "bus", keys: 1 }
      : { id: "send-get", kind: "semaphore", op: "get", semaphore: "bus", keys: 1 };
  const put = (id: string): Stmt => ({ id, kind: "semaphore", op: "put", semaphore: "bus", keys: 1 });
  const errorPath: Stmt =
    fix === "put-before-return"
      ? { id: "send-error", kind: "if", cond: bin("==", v("id"), c(2)), then: [put("send-error-put"), { kind: "return" }], comment: "error path" }
      : { id: "send-error", kind: "if", cond: bin("==", v("id"), c(2)), then: [{ kind: "return" }], comment: "error path" };
  const body: Stmt[] = [
    get,
    ...(fix === "put-early" ? [put("send-put-early")] : []),
    errorPath,
    { kind: "assign", target: "busy", expr: bin("+", v("busy"), c(1)) },
    { kind: "if", cond: bin(">", v("busy"), c(1)), then: [display("COLLISION: %0d senders on the bus", v("busy"))] },
    delay(10, display("send %0d done", v("id"))),
    { kind: "assign", target: "busy", expr: bin("-", v("busy"), c(1)) },
    ...(fix === "put-early" ? [] : [put("send-put")]),
  ];
  return {
    id: `key-leak:${fix}`,
    title: "The lost key",
    vars: [{ name: "busy", type: "int", init: 0 }],
    semaphores: [{ name: "bus", keys: fix === "two-keys" ? 2 : 1 }],
    tasks: [{ name: "send", automatic: true, params: ["id"], body }],
    processes: [
      { id: "driver", label: "driver", kind: "initial", body: [{ kind: "for", variable: "id", from: 1, to: 4, body: [{ kind: "call", task: "send", args: [v("id")] }] }] },
      { id: "checker", label: "checker", kind: "initial", body: [{ ...delay(12, { kind: "call", task: "send", args: [c(4)] }), id: "checker-call" }] },
    ],
  };
}

export interface KeyLeakGrade {
  noHang: boolean;
  noCollision: boolean;
  keysReturned: boolean;
  passed: boolean;
}

/** Grades a key-leak run: nobody left blocked, mutual exclusion held, and the bucket ends where it started. */
export function gradeKeyLeak(result: SimResult): KeyLeakGrade {
  const bus = result.finalSemaphores.bus;
  const noHang = result.blockedAtEnd.length === 0;
  const noCollision = !result.log.some((l) => l.text.startsWith("COLLISION"));
  const keysReturned = bus ? bus.keys === bus.initial : false;
  return { noHang, noCollision, keysReturned, passed: noHang && noCollision && keysReturned };
}

export interface TimeoutGrade {
  monitorSurvives: boolean;
  noFalseTimeout: boolean;
  allResponses: boolean;
  testCompletes: boolean;
  passed: boolean;
}

/** Grades a timeout-bench run against what the test intends. */
export function gradeTimeoutBench(result: SimResult, concurrent: boolean): TimeoutGrade {
  const lastCall = concurrent ? 30 : 15;
  const monitorSurvives = result.log.some((l) => l.text === "monitor alive" && l.time > lastCall);
  const noFalseTimeout = !result.log.some((l) => l.text.includes("TIMEOUT"));
  const needed = concurrent ? ["xfer 1 response", "xfer 2 response"] : ["xfer 1 response"];
  const allResponses = needed.every((text) => result.log.some((l) => l.text === text));
  const testCompletes = result.log.some((l) => l.text === "test done");
  return { monitorSurvives, noFalseTimeout, allResponses, testCompletes, passed: monitorSurvives && noFalseTimeout && allResponses && testCompletes };
}
