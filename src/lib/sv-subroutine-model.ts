/**
 * Deterministic educational model of where a SystemVerilog task's or
 * function's variables live: activation records, static versus automatic
 * storage, argument directions, the directions and types a formal inherits
 * when none is written, and the F2D kata bench that puts three such bugs
 * together.
 *
 * Rules implemented (IEEE 1800-2023, read from the standard's text):
 * - §13.3: input is copied in when the call starts, output is copied out at
 *   the return, inout both; ref passes a reference (§13.5.2). The default
 *   direction is input until a direction is written; later formals with no
 *   direction take the previous formal's direction. A formal with no data
 *   type is logic (one bit) if it is the first formal or has its own
 *   direction; otherwise it inherits the previous formal's type.
 * - §13.3.1 / §13.4.2: tasks and functions in a module, interface, program or
 *   package default to static; `automatic` (or an automatic container) makes
 *   them allocate per call. A static function's items are shared across its
 *   concurrent uses; an automatic function is reentrant, which recursion needs.
 * - §13.3.2: a static task has one copy of each variable per module instance,
 *   shared by every concurrent activation; its variables, formals included,
 *   keep their values between calls and start at the §6.8 defaults. An
 *   automatic task replicates its variables per activation and initializes
 *   them, outputs included, to their defaults when execution enters it; inputs
 *   and inouts then take the passed values. Automatic variables may not be
 *   assigned with nonblocking assignments.
 * - §13.4: a function may not contain time controls (#, @, fork-join...); a
 *   function declared with no return type returns a one-bit logic.
 * - §13.5: an output or inout actual must be assignable; §13.5.2: a ref formal
 *   is the caller's variable, changes are visible at once, ref is illegal in a
 *   static subroutine, only variables (or properties, struct members, unpacked
 *   array elements) may be passed by reference, and a write to a const ref is
 *   a compile error. Because the variable bound to a ref may be automatic, a
 *   ref argument may not be used where an automatic variable may not (so no
 *   nonblocking assignment through it) unless it is declared ref static, which
 *   this model does not offer.
 * - §6.21: in a static task, function or block, a variable declaration with an
 *   initializer must say `static` (run once at time zero) or `automatic` (run
 *   on every entry).
 * - §6.8, Table 6-7: defaults are 'x for 4-state types, '0 for 2-state types,
 *   "" for strings. §10.7: a wider value assigned to a narrower variable keeps
 *   its low bits. §9.4.2: an event control on a variable fires on a change of
 *   its value, so writing the value it already holds is no event.
 * - §4.7: processes ready in the same region run in an unspecified order; the
 *   model explores every order of the ready processes (each runs until it
 *   blocks or ends; interleaving is not explored).
 */

/* ========================================================================= */
/* Values and types                                                           */
/* ========================================================================= */

/** Integer, string (for the kata's log_after(string)) or unknown. String values are never "X". */
export type Value = number | string | "X";
export type Lifetime = "static" | "automatic";
export type Direction = "input" | "output" | "inout" | "ref" | "const ref";
export type Qualifier = "static" | "automatic";
export type DataType = "int" | "int unsigned" | "logic" | "logic [7:0]" | "logic [15:0]" | "string";

export const DIRECTIONS: readonly Direction[] = ["input", "output", "inout", "ref", "const ref"];
export const DATA_TYPES: readonly DataType[] = ["int", "int unsigned", "logic", "logic [7:0]", "logic [15:0]", "string"];

/** Bit width of a type; strings have none. */
export function widthOf(type: DataType): number | undefined {
  switch (type) {
    case "int":
    case "int unsigned":
      return 32;
    case "logic":
      return 1;
    case "logic [7:0]":
      return 8;
    case "logic [15:0]":
      return 16;
    case "string":
      return undefined;
  }
}

export function isFourState(type: DataType): boolean {
  return type.startsWith("logic");
}

/** §6.8, Table 6-7: 'x for 4-state integral types, '0 for 2-state ones, "" for string. */
export function defaultValue(type: DataType): Value {
  if (type === "string") return "";
  return isFourState(type) ? "X" : 0;
}

/** §10.7: the MSBs beyond `width` are discarded. */
export function truncateTo(value: number, width: number): number {
  if (width >= 32) return value;
  const modulus = 2 ** width;
  return ((value % modulus) + modulus) % modulus;
}

/** Stores `value` into a variable of `type`: truncation (§10.7); x into a 2-state type reads as 0. */
export function coerce(value: Value, type: DataType): Value {
  if (type === "string") return typeof value === "string" ? value : String(value);
  if (value === "X") return isFourState(type) ? "X" : 0;
  if (typeof value === "string") return value;
  const width = widthOf(type);
  return width === undefined ? value : truncateTo(value, width);
}

/** Number of 1 bits, for `foreach (v[i]) if (v[i]) n++;`. */
export function popcount(value: Value): Value {
  if (typeof value !== "number") return "X";
  let n = 0;
  let v = value >>> 0;
  while (v) {
    n += v & 1;
    v >>>= 1;
  }
  return n;
}

/** How a value prints in narration and storage boxes: x for unknown, strings as typed. */
export function formatValue(value: Value | undefined): string {
  if (value === undefined || value === "X") return "x";
  return String(value);
}

/**
 * `%0d` decimal, `%b`/`%0b` binary, `%s` string, as $display prints these
 * values. `%d` is accepted and printed like `%0d`, without the field padding a
 * simulator adds; `%t` is not modelled (it would print in $timeformat units)
 * and is left in the text, so no bench uses it.
 */
export function formatDisplay(format: string, values: Value[]): string {
  let i = 0;
  return format.replace(/%0?[dbs]/g, (spec) => {
    const value = values[i++];
    if (spec.endsWith("b")) return typeof value === "number" ? value.toString(2) : "x";
    return formatValue(value);
  });
}

/* ========================================================================= */
/* Formal directions and types (§13.3, §13.4)                                 */
/* ========================================================================= */

export interface FormalSpec {
  name: string;
  /** Omitted: resolved by the §13.3 default or inheritance rule. */
  direction?: Direction;
  /** Omitted: resolved by the §13.3 default (one-bit logic) or inheritance rule. */
  type?: DataType;
}

export type ResolutionSource = "explicit" | "default" | "inherited";

export interface ResolvedFormal {
  name: string;
  direction: Direction;
  type: DataType;
  directionSource: ResolutionSource;
  typeSource: ResolutionSource;
  /** The earlier formal the direction is inherited from. */
  directionFrom?: string;
  /** The earlier formal the type is inherited from. */
  typeFrom?: string;
}

/**
 * §13.3: "There is a default direction of input if no direction has been
 * specified. Once a direction is given, subsequent formals default to the same
 * direction." The data type "is logic if it is the first argument or if the
 * argument direction is explicitly specified. Otherwise, the data type is
 * inherited from the previous argument." Functions follow the same rules (§13.4).
 */
export function resolveFormals(specs: readonly FormalSpec[]): ResolvedFormal[] {
  const out: ResolvedFormal[] = [];
  let directionGiven = false;
  specs.forEach((spec, i) => {
    const previous = out[i - 1];
    let direction: Direction;
    let directionSource: ResolutionSource;
    let directionFrom: string | undefined;
    if (spec.direction) {
      direction = spec.direction;
      directionSource = "explicit";
      directionGiven = true;
    } else if (!directionGiven || !previous) {
      direction = "input";
      directionSource = "default";
    } else {
      direction = previous.direction;
      directionSource = "inherited";
      directionFrom = previous.name;
    }
    let type: DataType;
    let typeSource: ResolutionSource;
    let typeFrom: string | undefined;
    if (spec.type) {
      type = spec.type;
      typeSource = "explicit";
    } else if (i === 0 || spec.direction || !previous) {
      type = "logic";
      typeSource = "default";
    } else {
      type = previous.type;
      typeSource = "inherited";
      typeFrom = previous.name;
    }
    out.push({ name: spec.name, direction, type, directionSource, typeSource, directionFrom, typeFrom });
  });
  return out;
}

/** §13.4: an empty implicit return type is a logic scalar. */
export function resolveReturnType(declared?: DataType | "void"): { type: DataType | "void"; source: "explicit" | "implicit" } {
  return declared ? { type: declared, source: "explicit" } : { type: "logic", source: "implicit" };
}

/** `[direction ][type ]name` for each formal, as a signature prints them. */
export function formalsToSource(specs: readonly FormalSpec[]): string {
  return specs.map((f) => [f.direction, f.type, f.name].filter(Boolean).join(" ")).join(", ");
}

export interface SignatureSpec {
  kind: "task" | "function";
  name: string;
  lifetime: Lifetime;
  returnType?: DataType | "void";
  formals: FormalSpec[];
}

export function signatureToSource(sig: SignatureSpec): string {
  const lifetime = sig.lifetime === "automatic" ? "automatic " : "";
  const ret = sig.kind === "function" && sig.returnType ? `${sig.returnType} ` : "";
  return `${sig.kind} ${lifetime}${ret}${sig.name}(${formalsToSource(sig.formals)});`;
}

/** The lesson's four signatures, exactly as written in tasks-functions.mdx. */
export const FORMAL_SIGNATURES: Record<"split" | "wait_cycles" | "wait_cycles_ok" | "add", SignatureSpec> = {
  split: {
    kind: "task",
    name: "split",
    lifetime: "automatic",
    formals: [
      { name: "word", direction: "input", type: "logic [15:0]" },
      { name: "hi", direction: "output", type: "logic [7:0]" },
      { name: "lo" },
    ],
  },
  wait_cycles: { kind: "task", name: "wait_cycles", lifetime: "automatic", formals: [{ name: "n" }] },
  wait_cycles_ok: { kind: "task", name: "wait_cycles_ok", lifetime: "automatic", formals: [{ name: "n", direction: "input", type: "int unsigned" }] },
  add: {
    kind: "function",
    name: "add",
    lifetime: "automatic",
    formals: [
      { name: "a", direction: "input", type: "int" },
      { name: "b", direction: "input", type: "int" },
    ],
  },
};

/** `repeat (n) @(posedge clk)` after `n` was stored into a formal of `type`: the stored value and the cycles waited. */
export function waitCyclesEffect(n: number, type: DataType): { stored: Value; cycles: number } {
  const stored = coerce(n, type);
  return { stored, cycles: typeof stored === "number" ? stored : 0 };
}

/** `return a + b` through the function's (possibly implicit) return type (§13.4, §10.7). */
export function addReturns(a: number, b: number, returnType?: DataType): Value {
  const resolved = resolveReturnType(returnType).type;
  return coerce(a + b, resolved === "void" ? "int" : resolved);
}

/** Why a literal cannot be the actual of `formal`, or undefined for an input. §13.5: output and inout need an assignable actual; §13.5.2: only a variable may be passed by reference. */
function literalActualIssue(sub: string, actual: string, formal: { name: string; direction: Direction }, key?: string, owner?: string): CompileIssue | undefined {
  if (formal.direction === "input") return undefined;
  const byRef = formal.direction === "ref" || formal.direction === "const ref";
  return {
    key,
    sub: owner,
    clause: byRef ? "§13.5.2" : "§13.5",
    message: byRef
      ? `${sub}(..., ${actual}, ...): only a variable (or a class property, structure member or unpacked array element) may be passed to the ${formal.direction} formal ${formal.name}; a literal cannot.`
      : `${sub}(..., ${actual}, ...): the actual for the ${formal.direction} formal ${formal.name} must be assignable, such as a variable.`,
  };
}

/** The compile issues of calling `sub` with literal actuals; empty when every formal is an input. */
export function literalCallIssues(sub: string, formals: readonly Pick<ResolvedFormal, "name" | "direction">[], actuals: readonly number[]): CompileIssue[] {
  return formals.flatMap((formal, i) => {
    const issue = literalActualIssue(sub, String(actuals[i]), formal);
    return issue ? [issue] : [];
  });
}

export interface AddCallResult {
  /** Set when a formal cannot take a literal; the other fields are then absent. */
  issues: CompileIssue[];
  /** Each argument as passed and as stored in its formal. */
  args?: { name: string; passed: number; stored: Value; type: DataType }[];
  /** `a + b`, from the stored values. */
  sum?: number;
  returned?: Value;
}

/** `add(2, 3)` through the formals as resolved: each argument is stored in its formal's type (§10.7), then the sum goes through the return type (§13.4). */
export function addCall(formals: readonly ResolvedFormal[], returnType?: DataType | "void", actuals: readonly number[] = [2, 3]): AddCallResult {
  const issues = literalCallIssues("add", formals, actuals);
  if (issues.length) return { issues };
  const args = formals.map((formal, i) => ({ name: formal.name, passed: actuals[i], stored: coerce(actuals[i], formal.type), type: formal.type }));
  const [a, b] = args.map((arg) => (typeof arg.stored === "number" ? arg.stored : 0));
  return { issues, args, sum: a + b, returned: addReturns(a, b, returnType === "void" ? undefined : returnType) };
}

/* ========================================================================= */
/* Initializer rule (§6.21)                                                   */
/* ========================================================================= */

export interface InitializerVerdict {
  ok: boolean;
  /** The declaration as the learner wrote it. */
  source: string;
  message: string;
  clause: "§6.21";
}

/**
 * §6.21: in a static task, function or block, a declaration with an
 * initializer needs an explicit `static` (run once at time zero) or
 * `automatic` (run on every entry). Inside an automatic subroutine the
 * variable is automatic by default, so the bare form is legal.
 */
export function checkInitializer(lifetime: Lifetime, qualifier: Qualifier | "none", name = "calls", init = "0"): InitializerVerdict {
  const source = `${qualifier === "none" ? "" : `${qualifier} `}int ${name} = ${init};`;
  if (qualifier === "static") {
    return { ok: true, source, clause: "§6.21", message: `Legal: ${name} is static, so "= ${init}" runs once, at time 0, and ${name} keeps counting across calls.` };
  }
  if (qualifier === "automatic") {
    return { ok: true, source, clause: "§6.21", message: `Legal: ${name} is automatic, so "= ${init}" runs again at the start of every call.` };
  }
  if (lifetime === "automatic") {
    return { ok: true, source, clause: "§6.21", message: `Legal: inside an automatic task the variable is automatic by default, so "= ${init}" runs on every call.` };
  }
  return {
    ok: false,
    source,
    clause: "§6.21",
    message: `Compile error: inside a static task a declaration with an initializer must say static (run once at time 0) or automatic (run on every call). The bare form could mean either, so the standard rejects it.`,
  };
}

/* ========================================================================= */
/* Bench data                                                                 */
/* ========================================================================= */

export type BinOp = "+" | "-" | "*" | "<=" | "<" | "==" | ">";

export type Expr =
  | { kind: "const"; value: Value; label?: string }
  | { kind: "var"; name: string }
  | { kind: "time" }
  | { kind: "bin"; op: BinOp; left: Expr; right: Expr }
  /** `foreach (v[i]) if (v[i]) n++;` folded into one expression. */
  | { kind: "popcount"; operand: Expr }
  /** Nonvoid function call inside an expression. */
  | { kind: "fcall"; fn: string; args: Expr[] };

export const c = (value: Value, label?: string): Expr => ({ kind: "const", value, label });
export const v = (name: string): Expr => ({ kind: "var", name });
export const now: Expr = { kind: "time" };
export const bin = (op: BinOp, left: Expr, right: Expr): Expr => ({ kind: "bin", op, left, right });
export const fcall = (fn: string, ...args: Expr[]): Expr => ({ kind: "fcall", fn, args });

interface StmtBase {
  /** Stable key of the source line (for highlighting and line controls). Assigned when omitted. */
  key?: string;
  comment?: string;
  /** Overrides the generated source text of the statement. */
  source?: string;
}

export type Stmt =
  | (StmtBase & { kind: "delay"; amount: Expr; then?: Stmt })
  | (StmtBase & { kind: "display"; format: string; args: Expr[] })
  | (StmtBase & { kind: "assign"; target: string; expr: Expr; nba?: boolean })
  /** Task enable, or a function called as a statement. */
  | (StmtBase & { kind: "call"; sub: string; args: Expr[] })
  | (StmtBase & { kind: "return"; expr?: Expr })
  | (StmtBase & { kind: "if"; cond: Expr; then: Stmt[] })
  /** fork ... join: every branch is one process. */
  | (StmtBase & { kind: "fork"; branches: Stmt[][] });

export interface Formal {
  name: string;
  direction: Direction;
  type: DataType;
}

export interface LocalDecl {
  name: string;
  type: DataType;
  /** Explicit lifetime qualifier on the declaration. */
  qualifier?: Qualifier;
  init?: Expr;
  key?: string;
  comment?: string;
}

export interface SubroutineDef {
  name: string;
  kind: "task" | "function";
  lifetime: Lifetime;
  /** Functions only. Omitted: the implicit one-bit logic return type (§13.4). */
  returnType?: DataType | "void";
  formals: Formal[];
  locals: LocalDecl[];
  body: Stmt[];
  /** Render one formal per source line so each gets its own line control. */
  formalsOnLines?: boolean;
  comment?: string;
}

export interface GlobalDecl {
  name: string;
  type: DataType;
  init?: Value;
  initLabel?: string;
  /** Declared on the previous declaration's line (`int a = 5, b = 5;`). */
  sharesLine?: boolean;
  key?: string;
}

export interface ProcessDef {
  id: string;
  label: string;
  body: Stmt[];
}

/** `always @(variable) $display(format, $time, variable);` */
export interface Watcher {
  variable: string;
  format: string;
  key?: string;
}

export interface Bench {
  id: string;
  title: string;
  globals: GlobalDecl[];
  subs: SubroutineDef[];
  processes: ProcessDef[];
  watchers?: Watcher[];
}

/* ========================================================================= */
/* Source generation                                                          */
/* ========================================================================= */

export interface SourceLine {
  text: string;
  key?: string;
}

const quote = (s: string) => `"${s}"`;

export function exprToSource(expr: Expr): string {
  switch (expr.kind) {
    case "const":
      if (expr.label) return expr.label;
      return typeof expr.value === "string" && expr.value !== "X" ? quote(expr.value) : expr.value === "X" ? "'x" : String(expr.value);
    case "var":
      return expr.name;
    case "time":
      return "$time";
    case "bin":
      return `${exprToSource(expr.left)} ${expr.op} ${exprToSource(expr.right)}`;
    case "popcount":
      return `$countones(${exprToSource(expr.operand)})`;
    case "fcall":
      return `${expr.fn}(${expr.args.map(exprToSource).join(", ")})`;
  }
}

function delayAmountSource(amount: Expr): string {
  return amount.kind === "const" ? exprToSource(amount) : `(${exprToSource(amount)})`;
}

/** One statement on one line (fork and if are rendered by `stmtLines`). */
export function stmtToSource(stmt: Stmt): string {
  if (stmt.source) return stmt.source;
  switch (stmt.kind) {
    case "delay":
      return `#${delayAmountSource(stmt.amount)}${stmt.then ? ` ${stmtToSource(stmt.then)}` : ";"}`;
    case "display":
      return `$display(${[quote(stmt.format), ...stmt.args.map(exprToSource)].join(", ")});`;
    case "assign":
      return `${stmt.target} ${stmt.nba ? "<=" : "="} ${exprToSource(stmt.expr)};`;
    case "call":
      return `${stmt.sub}(${stmt.args.map(exprToSource).join(", ")});`;
    case "return":
      return stmt.expr ? `return ${exprToSource(stmt.expr)};` : "return;";
    case "if":
      return `if (${exprToSource(stmt.cond)})`;
    case "fork":
      return "fork";
  }
}

const withComment = (text: string, comment: string | undefined, comments: boolean) => (comment && comments ? `${text}   // ${comment}` : text);

function stmtLines(stmts: Stmt[], indent: string, lines: SourceLine[], comments: boolean): void {
  stmts.forEach((stmt) => {
    if (stmt.kind === "fork") {
      lines.push({ text: withComment(`${indent}fork`, stmt.comment, comments), key: stmt.key });
      stmt.branches.forEach((branch) => stmtLines(branch, `${indent}  `, lines, comments));
      lines.push({ text: `${indent}join`, key: `${stmt.key}:join` });
      return;
    }
    if (stmt.kind === "if" && !stmt.source) {
      if (stmt.then.length === 1 && stmt.then[0].kind !== "fork" && stmt.then[0].kind !== "if") {
        lines.push({ text: withComment(`${indent}if (${exprToSource(stmt.cond)}) ${stmtToSource(stmt.then[0])}`, stmt.comment, comments), key: stmt.key });
        return;
      }
      lines.push({ text: withComment(`${indent}if (${exprToSource(stmt.cond)}) begin`, stmt.comment, comments), key: stmt.key });
      stmtLines(stmt.then, `${indent}  `, lines, comments);
      lines.push({ text: `${indent}end` });
      return;
    }
    lines.push({ text: withComment(`${indent}${stmtToSource(stmt)}`, stmt.comment, comments), key: stmt.key });
  });
}

export function subHeaderSource(sub: SubroutineDef): string {
  const lifetime = sub.lifetime === "automatic" ? "automatic " : "";
  const ret = sub.kind === "function" && sub.returnType ? `${sub.returnType} ` : "";
  return `${sub.kind} ${lifetime}${ret}${sub.name}`;
}

export function formalToSource(f: Formal): string {
  return `${f.direction} ${f.type} ${f.name}`;
}

export interface BenchSourceOptions {
  /**
   * Default true. False leaves out every `//` comment, for a bench whose comments
   * would give away a prediction. A comment on a line of its own becomes a blank
   * line, so a line keeps its number when the comments come back.
   */
  comments?: boolean;
}

/** Keys: `sub:<name>` header, `formal:<sub>:<name>`, `local:<sub>:<name>`, statement keys, `watch:<var>`, `global:<name>`. */
export function benchSource(input: Bench, { comments = true }: BenchSourceOptions = {}): SourceLine[] {
  const bench = prepareBench(input);
  const lines: SourceLine[] = [];
  lines.push({ text: "module tb_top;" });
  let pending: { parts: string[]; key?: string } | undefined;
  const flushGlobals = () => {
    if (pending) lines.push({ text: `  ${pending.parts.join(", ")};`, key: pending.key });
    pending = undefined;
  };
  bench.globals.forEach((g) => {
    const init = g.init === undefined ? "" : ` = ${g.initLabel ?? (typeof g.init === "string" ? quote(g.init) : g.init)}`;
    if (g.sharesLine && pending) {
      pending.parts.push(`${g.name}${init}`);
      return;
    }
    flushGlobals();
    pending = { parts: [`${g.type} ${g.name}${init}`], key: g.key ?? `global:${g.name}` };
  });
  flushGlobals();
  bench.subs.forEach((sub) => {
    lines.push({ text: "" });
    if (sub.comment) lines.push({ text: comments ? `  // ${sub.comment}` : "" });
    const header = `  ${subHeaderSource(sub)}`;
    if (sub.formalsOnLines && sub.formals.length) {
      lines.push({ text: `${header}(`, key: `sub:${sub.name}` });
      sub.formals.forEach((f, i) => {
        lines.push({ text: `    ${formalToSource(f)}${i < sub.formals.length - 1 ? "," : ""}`, key: `formal:${sub.name}:${f.name}` });
      });
      lines.push({ text: "  );" });
    } else {
      lines.push({ text: `${header}(${sub.formals.map(formalToSource).join(", ")});`, key: `sub:${sub.name}` });
    }
    sub.locals.forEach((l) => {
      const qualifier = l.qualifier ? `${l.qualifier} ` : "";
      const init = l.init ? ` = ${exprToSource(l.init)}` : "";
      lines.push({ text: withComment(`    ${qualifier}${l.type} ${l.name}${init};`, l.comment, comments), key: l.key ?? `local:${sub.name}:${l.name}` });
    });
    stmtLines(sub.body, "    ", lines, comments);
    lines.push({ text: sub.kind === "task" ? "  endtask" : "  endfunction" });
  });
  (bench.watchers ?? []).forEach((w) => {
    lines.push({ text: "" });
    lines.push({ text: `  always @(${w.variable}) $display(${quote(w.format)}, $time, ${w.variable});`, key: w.key ?? `watch:${w.variable}` });
  });
  bench.processes.forEach((p) => {
    lines.push({ text: "" });
    lines.push({ text: "  initial begin", key: `proc:${p.id}` });
    stmtLines(p.body, "    ", lines, comments);
    lines.push({ text: "  end" });
  });
  lines.push({ text: "endmodule" });
  return lines;
}

/* ========================================================================= */
/* Preparation: stable statement keys                                        */
/* ========================================================================= */

function keyStmts(stmts: Stmt[], prefix: string): Stmt[] {
  return stmts.map((stmt, i) => {
    const key = stmt.key ?? `${prefix}:${i}`;
    switch (stmt.kind) {
      case "fork":
        return { ...stmt, key, branches: stmt.branches.map((b, j) => keyStmts(b, `${key}:b${j}`)) };
      case "if":
        // `if (cond) return 1;` is one source line, so a lone simple statement shares the line's key.
        return {
          ...stmt,
          key,
          then: stmt.then.length === 1 && stmt.then[0].kind !== "fork" && stmt.then[0].kind !== "if" ? [{ ...stmt.then[0], key }] : keyStmts(stmt.then, `${key}:then`),
        };
      case "delay":
        // `#10 $display(...)` is one source line, so the statement after the delay shares the line's key.
        return { ...stmt, key, then: stmt.then ? { ...stmt.then, key } : undefined };
      default:
        return { ...stmt, key };
    }
  });
}

/** A copy of the bench in which every statement has a line key. */
export function prepareBench(bench: Bench): Bench {
  return {
    ...bench,
    subs: bench.subs.map((sub) => ({ ...sub, body: keyStmts(sub.body, sub.name) })),
    processes: bench.processes.map((p) => ({ ...p, body: keyStmts(p.body, p.id) })),
  };
}

/* ========================================================================= */
/* Compile checks                                                             */
/* ========================================================================= */

export interface CompileIssue {
  /** Source line the issue belongs to. */
  key?: string;
  sub?: string;
  message: string;
  clause: string;
}

function* walkStmts(stmts: Stmt[]): Generator<Stmt> {
  for (const stmt of stmts) {
    yield stmt;
    if (stmt.kind === "fork") for (const b of stmt.branches) yield* walkStmts(b);
    if (stmt.kind === "if") yield* walkStmts(stmt.then);
    if (stmt.kind === "delay" && stmt.then) yield* walkStmts([stmt.then]);
  }
}

function* walkExprs(expr: Expr): Generator<Expr> {
  yield expr;
  if (expr.kind === "bin") {
    yield* walkExprs(expr.left);
    yield* walkExprs(expr.right);
  }
  if (expr.kind === "popcount") yield* walkExprs(expr.operand);
  if (expr.kind === "fcall") for (const a of expr.args) yield* walkExprs(a);
}

function* exprsOf(stmt: Stmt): Generator<Expr> {
  switch (stmt.kind) {
    case "delay":
      yield* walkExprs(stmt.amount);
      break;
    case "display":
      for (const a of stmt.args) yield* walkExprs(a);
      break;
    case "assign":
      yield* walkExprs(stmt.expr);
      break;
    case "call":
      for (const a of stmt.args) yield* walkExprs(a);
      break;
    case "return":
      if (stmt.expr) yield* walkExprs(stmt.expr);
      break;
    case "if":
      yield* walkExprs(stmt.cond);
      break;
    default:
      break;
  }
}

/** Is `name` an automatic item of `sub` (allocated per activation)? Ref formals are bindings, not items: §13.5.2 covers them separately. */
function isAutomaticItem(sub: SubroutineDef, name: string): boolean {
  const formal = sub.formals.find((f) => f.name === name);
  if (formal) return sub.lifetime === "automatic" && formal.direction !== "ref" && formal.direction !== "const ref";
  const local = sub.locals.find((l) => l.name === name);
  if (local) return (local.qualifier ?? sub.lifetime) === "automatic";
  return false;
}

/** Static semantics the lesson teaches, each with its clause. Empty when the bench compiles. */
export function compileBench(input: Bench): CompileIssue[] {
  const bench = prepareBench(input);
  const issues: CompileIssue[] = [];
  const subs = new Map(bench.subs.map((s) => [s.name, s]));
  bench.subs.forEach((sub) => {
    sub.formals.forEach((f) => {
      if ((f.direction === "ref" || f.direction === "const ref") && sub.lifetime === "static") {
        issues.push({
          key: sub.formalsOnLines ? `formal:${sub.name}:${f.name}` : `sub:${sub.name}`,
          sub: sub.name,
          clause: "§13.5.2",
          message: `${f.direction} ${f.name}: pass by reference is illegal in a subroutine with static lifetime. Make ${sub.name} automatic, or pass ${f.name} by value.`,
        });
      }
    });
    sub.locals.forEach((l) => {
      if (l.init && !l.qualifier && sub.lifetime === "static") {
        issues.push({
          key: l.key ?? `local:${sub.name}:${l.name}`,
          sub: sub.name,
          clause: "§6.21",
          message: `${l.type} ${l.name} = ${exprToSource(l.init)}: inside a static ${sub.kind} a declaration with an initializer must say static or automatic.`,
        });
      }
    });
    for (const stmt of walkStmts(sub.body)) {
      if (stmt.kind === "assign") {
        const formal = sub.formals.find((f) => f.name === stmt.target);
        if (formal?.direction === "const ref") {
          issues.push({ key: stmt.key, sub: sub.name, clause: "§13.5.2", message: `${stmt.target} is a const ref: the subroutine may read it but a write is a compile error.` });
        }
        if (stmt.nba && (formal?.direction === "ref" || formal?.direction === "const ref")) {
          // §13.5.2: the variable bound to a ref may be automatic, so a ref argument may not be used where an automatic variable may not (§6.21, §10.4.2), unless it is ref static.
          issues.push({
            key: stmt.key,
            sub: sub.name,
            clause: "§13.5.2",
            message: `${stmt.target} <= ...: ${stmt.target} is a ${formal.direction} argument, and the variable bound to it may be automatic, so it may not be used where an automatic variable may not: no nonblocking assignment through ${stmt.target} unless the formal is declared ref static. Use = for the write.`,
          });
        } else if (stmt.nba && isAutomaticItem(sub, stmt.target)) {
          issues.push({
            key: stmt.key,
            sub: sub.name,
            clause: "§13.3.2",
            message: `${stmt.target} <= ...: an automatic variable is deallocated when the call ends, so it may not be assigned with a nonblocking assignment. Use = for ${sub.name}'s own variables.`,
          });
        }
      }
      if (sub.kind === "function" && (stmt.kind === "delay" || stmt.kind === "fork")) {
        issues.push({ key: stmt.key, sub: sub.name, clause: "§13.4", message: `A function may not contain time controls such as # or fork-join; ${sub.name} must be a task.` });
      }
    }
  });
  const checkCall = (name: string, args: Expr[], key: string | undefined, owner?: string) => {
    const callee = subs.get(name);
    if (!callee) throw new Error(`Bench ${bench.id}: unknown subroutine ${name}`);
    if (args.length !== callee.formals.length) throw new Error(`Bench ${bench.id}: ${name} called with ${args.length} arguments, declared with ${callee.formals.length}`);
    callee.formals.forEach((f, i) => {
      const actual = args[i];
      if (actual.kind === "var") return;
      const issue = literalActualIssue(name, exprToSource(actual), f, key, owner);
      if (issue) issues.push(issue);
    });
  };
  const checkBody = (stmts: Stmt[], owner?: string) => {
    for (const stmt of walkStmts(stmts)) {
      if (stmt.kind === "call") checkCall(stmt.sub, stmt.args, stmt.key, owner);
      for (const expr of exprsOf(stmt)) if (expr.kind === "fcall") checkCall(expr.fn, expr.args, stmt.key, owner);
    }
  };
  bench.subs.forEach((sub) => checkBody(sub.body, sub.name));
  bench.processes.forEach((p) => checkBody(p.body));
  return issues;
}

/* ========================================================================= */
/* Simulation                                                                 */
/* ========================================================================= */

export interface ActivationRecord {
  id: number;
  sub: string;
  kind: "task" | "function";
  lifetime: Lifetime;
  /** `send(1)`: the call as written, with argument values. */
  label: string;
  /** `call 1`, `call 2`: the n-th call of this subroutine. */
  ordinal: number;
  pid: number;
  /** Call depth within its process (recursion). */
  depth: number;
  startTime: number;
  endTime?: number;
  returnValue?: Value;
}

export interface BoxVar {
  name: string;
  value: Value;
  type: DataType;
  role: "formal" | "local";
  direction?: Direction;
  /** Changed since the previous step (new boxes count as changed). */
  changed: boolean;
}

export interface StorageBox {
  /** `static:<sub>` or `act:<id>`. */
  id: string;
  sub: string;
  /** The subroutine's one static copy, or the activation that owns this copy. */
  owner: "static" | number;
  vars: BoxVar[];
  /** Ref formals of the activations using this box: `d → v_ref`. */
  refs: { name: string; target: string; direction: Direction }[];
  /** Activations currently using this box. */
  activations: number[];
  /** False only in the step where an automatic box is dropped at the return. */
  alive: boolean;
}

export interface LogLine {
  time: number;
  text: string;
  pid: number;
  activationId?: number;
  /** Source line of the $display that printed it. */
  lineKey?: string;
}

export type StepKind = "start" | "enter" | "exec" | "wait" | "advance" | "print" | "return" | "nba" | "watch" | "fork" | "join" | "end";

export interface SubStep {
  index: number;
  time: number;
  kind: StepKind;
  pid?: number;
  activationId?: number;
  lineKey?: string;
  what: string;
  why: string;
  clause?: string;
  globals: Record<string, Value>;
  changedGlobals: string[];
  boxes: StorageBox[];
  activations: ActivationRecord[];
  /** Activation ids open in the running process, outermost first. */
  callStack: number[];
  log: LogLine[];
  /** §4.7: several processes were ready; the model picked one. */
  choice?: { options: string[]; picked: string };
}

export interface SubroutineRun {
  benchId: string;
  trace: SubStep[];
  log: LogLine[];
  endTime: number;
  globals: Record<string, Value>;
  activations: ActivationRecord[];
  choices: number[];
  choiceWidths: number[];
}

export interface SimOptions {
  /** Which ready process to run at each §4.7 choice point; missing entries pick the first (declaration order). */
  choices?: number[];
  maxSteps?: number;
}

interface Slot {
  value: Value;
  type: DataType;
  role: "formal" | "local" | "global";
  direction?: Direction;
}
type Store = Map<string, Slot>;

interface Binding {
  store: Store;
  name: string;
  /** Name as the caller sees it (`v_ref`). */
  label: string;
}

interface Activation {
  record: ActivationRecord;
  def: SubroutineDef;
  own: Store;
  shared: Store;
  refs: Map<string, Binding>;
  copyOuts: { formal: string; target: Binding; direction: Direction }[];
}

interface Frame {
  stmts: Stmt[];
  pc: number;
  act?: Activation;
}

interface Proc {
  pid: number;
  label: string;
  frames: Frame[];
  state: "ready" | "blocked" | "done";
  wakeAt?: number;
  joinWait?: number[];
  parent?: number;
  forkKey?: string;
}

interface Ctx {
  pid: number;
  act?: Activation;
}

class ModelError extends Error {}

const MAX_STEPS_DEFAULT = 2500;

const isAre = (names: readonly string[]) => (names.length === 1 ? "is" : "are");

/**
 * The clause for a step that touches `names` of `def`. Tasks: §13.3.2; functions:
 * §13.4.2. A local whose own qualifier overrides the subroutine's lifetime also
 * cites where that is allowed: §13.3.1 or §13.4.2, and §6.21 for what it means.
 */
function storageClause(def: SubroutineDef, names: readonly string[]): string {
  const overridden = names.some((name) => {
    const qualifier = def.locals.find((l) => l.name === name)?.qualifier;
    return qualifier !== undefined && qualifier !== def.lifetime;
  });
  if (def.kind === "function") return overridden ? "§13.4.2, §6.21" : "§13.4.2";
  return overridden ? "§13.3.1, §6.21" : "§13.3.2";
}

export function simulateBench(input: Bench, options: SimOptions = {}): SubroutineRun {
  const bench = prepareBench(input);
  const issues = compileBench(bench);
  if (issues.length) throw new ModelError(`Bench ${bench.id} does not compile: ${issues.map((i) => `${i.clause} ${i.message}`).join(" | ")}`);
  const maxSteps = options.maxSteps ?? MAX_STEPS_DEFAULT;
  const subs = new Map(bench.subs.map((s) => [s.name, s]));
  const watchers = new Map((bench.watchers ?? []).map((w) => [w.variable, w]));

  /* ---------- storage ---------- */
  const globals: Store = new Map();
  bench.globals.forEach((g) => globals.set(g.name, { value: g.init === undefined ? defaultValue(g.type) : coerce(g.init, g.type), type: g.type, role: "global" }));
  // §13.3.2 / §6.21: static items exist from time 0 at their §6.8 defaults; `static` initializers run once.
  const shared = new Map<string, Store>();
  bench.subs.forEach((sub) => {
    const store: Store = new Map();
    sub.formals.forEach((f) => {
      if (sub.lifetime === "static" && f.direction !== "ref" && f.direction !== "const ref") store.set(f.name, { value: defaultValue(f.type), type: f.type, role: "formal", direction: f.direction });
    });
    sub.locals.forEach((l) => {
      if ((l.qualifier ?? sub.lifetime) === "static") store.set(l.name, { value: l.init ? coerce(evalConst(l.init), l.type) : defaultValue(l.type), type: l.type, role: "local" });
    });
    shared.set(sub.name, store);
  });

  const records: ActivationRecord[] = [];
  const live = new Map<number, Activation>();
  const callStacks = new Map<number, number[]>();
  const log: LogLine[] = [];
  const trace: SubStep[] = [];
  const procs: Proc[] = [];
  const nbaQueue: { binding: Binding; value: Value; pid: number; lineKey?: string; act?: Activation }[] = [];
  const choices: number[] = [];
  const choiceWidths: number[] = [];
  let pendingChoice: SubStep["choice"];
  let time = 0;
  const lastBoxValues = new Map<string, Value>();
  let lastGlobals = new Map<string, Value>();

  function evalConst(expr: Expr): Value {
    if (expr.kind === "const") return expr.value;
    throw new ModelError(`Bench ${bench.id}: a static initializer must be a constant`);
  }

  /* ---------- snapshots ---------- */

  const liveOf = (sub: string) => [...live.values()].filter((a) => a.def.name === sub).map((a) => a.record.id);

  function boxOf(id: string, sub: string, owner: "static" | number, store: Store, acts: Activation[], alive: boolean): StorageBox {
    const vars: BoxVar[] = [...store.entries()].map(([name, slot]) => {
      const key = `${id}/${name}`;
      const prev = lastBoxValues.get(key);
      return { name, value: slot.value, type: slot.type, role: slot.role === "global" ? "local" : slot.role, direction: slot.direction, changed: prev === undefined || prev !== slot.value };
    });
    const refs = acts.flatMap((a) => [...a.refs.entries()].map(([name, b]) => ({ name, target: b.label, direction: a.def.formals.find((f) => f.name === name)?.direction ?? "ref" })));
    return { id, sub, owner, vars, refs, activations: acts.map((a) => a.record.id), alive };
  }

  function snapshotBoxes(dropped?: Activation): StorageBox[] {
    const boxes: StorageBox[] = [];
    bench.subs.forEach((sub) => {
      const store = shared.get(sub.name) as Store;
      const acts = [...live.values()].filter((a) => a.def.name === sub.name);
      const droppedHere = dropped && dropped.def.name === sub.name ? [dropped] : [];
      if (store.size > 0) boxes.push(boxOf(`static:${sub.name}`, sub.name, "static", store, [...acts, ...droppedHere], true));
    });
    [...live.values()].forEach((a) => {
      if (a.own.size > 0 || a.refs.size > 0) boxes.push(boxOf(`act:${a.record.id}`, a.def.name, a.record.id, a.own, [a], true));
    });
    if (dropped && (dropped.own.size > 0 || dropped.refs.size > 0)) boxes.push(boxOf(`act:${dropped.record.id}`, dropped.def.name, dropped.record.id, dropped.own, [dropped], false));
    lastBoxValues.clear();
    boxes.forEach((b) => b.vars.forEach((x) => lastBoxValues.set(`${b.id}/${x.name}`, x.value)));
    return boxes;
  }

  function emit(partial: Omit<SubStep, "index" | "time" | "globals" | "changedGlobals" | "boxes" | "activations" | "callStack" | "log" | "choice"> & { dropped?: Activation }): void {
    if (trace.length >= maxSteps) throw new ModelError(`Bench ${bench.id}: more than ${maxSteps} steps`);
    const globalsNow: Record<string, Value> = {};
    const changedGlobals: string[] = [];
    globals.forEach((slot, name) => {
      globalsNow[name] = slot.value;
      if (lastGlobals.get(name) !== slot.value) changedGlobals.push(name);
    });
    lastGlobals = new Map([...globals.entries()].map(([n, s]) => [n, s.value] as [string, Value]));
    const { dropped, ...rest } = partial;
    trace.push({
      ...rest,
      index: trace.length,
      time,
      globals: globalsNow,
      changedGlobals,
      boxes: snapshotBoxes(dropped),
      activations: records.map((r) => ({ ...r })),
      callStack: partial.pid === undefined ? [] : [...(callStacks.get(partial.pid) ?? [])],
      log: log.map((l) => ({ ...l })),
      choice: pendingChoice,
    });
    pendingChoice = undefined;
  }

  /* ---------- variables ---------- */

  function bindingOf(ctx: Ctx, name: string): Binding {
    if (ctx.act) {
      const ref = ctx.act.refs.get(name);
      if (ref) return ref;
      if (ctx.act.own.has(name)) return { store: ctx.act.own, name, label: name };
      if (ctx.act.shared.has(name)) return { store: ctx.act.shared, name, label: name };
    }
    if (globals.has(name)) return { store: globals, name, label: name };
    throw new ModelError(`Bench ${bench.id}: unknown variable ${name}`);
  }

  const readVar = (ctx: Ctx, name: string): Value => {
    const b = bindingOf(ctx, name);
    return (b.store.get(b.name) as Slot).value;
  };

  /** Writes through a binding; returns the old value and whether a watched global changed. */
  function store(binding: Binding, value: Value): { old: Value; stored: Value; changed: boolean } {
    const slot = binding.store.get(binding.name) as Slot;
    const stored = coerce(value, slot.type);
    const old = slot.value;
    slot.value = stored;
    return { old, stored, changed: old !== stored };
  }

  function fireWatcher(binding: Binding, changed: boolean, ctx: Ctx): void {
    if (binding.store !== globals || !changed) return;
    const watcher = watchers.get(binding.name);
    if (!watcher) return;
    const value = (globals.get(binding.name) as Slot).value;
    const text = formatDisplay(watcher.format, [time, value]);
    log.push({ time, text, pid: -1 });
    emit({
      kind: "watch",
      pid: ctx.pid,
      activationId: ctx.act?.record.id,
      lineKey: watcher.key ?? `watch:${binding.name}`,
      what: `${binding.name} changed to ${formatValue(value)}, so always @(${binding.name}) wakes and prints "${text}".`,
      why: "An event control on a variable fires when the variable's value changes; the always block runs its statement in the same time slot.",
      clause: "§9.4.2",
    });
  }

  /* ---------- expressions ---------- */

  function evalExpr(expr: Expr, ctx: Ctx, lineKey?: string): Value {
    switch (expr.kind) {
      case "const":
        return expr.value;
      case "var":
        return readVar(ctx, expr.name);
      case "time":
        return time;
      case "bin": {
        const l = evalExpr(expr.left, ctx, lineKey);
        const r = evalExpr(expr.right, ctx, lineKey);
        if (typeof l !== "number" || typeof r !== "number") return "X";
        switch (expr.op) {
          case "+":
            return l + r;
          case "-":
            return l - r;
          case "*":
            return l * r;
          case "<=":
            return l <= r ? 1 : 0;
          case "<":
            return l < r ? 1 : 0;
          case "==":
            return l === r ? 1 : 0;
          case ">":
            return l > r ? 1 : 0;
        }
        return "X";
      }
      case "popcount":
        return popcount(evalExpr(expr.operand, ctx, lineKey));
      case "fcall": {
        const def = subs.get(expr.fn);
        if (!def) throw new ModelError(`Bench ${bench.id}: unknown function ${expr.fn}`);
        if (def.kind !== "function") throw new ModelError(`Bench ${bench.id}: ${expr.fn} is a task and cannot be called inside an expression`);
        return callFunction(def, expr.args, ctx, lineKey);
      }
    }
  }

  const hasCall = (expr: Expr) => [...walkExprs(expr)].some((e) => e.kind === "fcall");

  /** `rest * n = 1 * 1 = 1`: the expression with its operand values, for narration. Never re-runs a function call. */
  function explain(expr: Expr, ctx: Ctx, result: Value): string {
    const text = exprToSource(expr);
    if (expr.kind === "const") return formatValue(result);
    if (expr.kind === "bin" && !hasCall(expr)) {
      const l = evalExpr(expr.left, ctx);
      const r = evalExpr(expr.right, ctx);
      return `${text} = ${formatValue(l)} ${expr.op} ${formatValue(r)} = ${formatValue(result)}`;
    }
    return `${text} = ${formatValue(result)}`;
  }

  /** `n = 4, rest = 0`: the variables an expression reads, with their values. */
  function operands(expr: Expr, ctx: Ctx): string {
    const names = [...new Set([...walkExprs(expr)].filter((e): e is { kind: "var"; name: string } => e.kind === "var").map((e) => e.name))];
    return names.map((n) => `${n} = ${formatValue(readVar(ctx, n))}`).join(", ");
  }

  /* ---------- activations ---------- */

  const ordinals = new Map<string, number>();

  function enter(def: SubroutineDef, args: Expr[], ctx: Ctx, lineKey?: string): Activation {
    const actuals = args.map((a) => ({ expr: a, value: a.kind === "var" ? readVar(ctx, a.name) : evalExpr(a, ctx, lineKey) }));
    const ordinal = (ordinals.get(def.name) ?? 0) + 1;
    ordinals.set(def.name, ordinal);
    const record: ActivationRecord = {
      id: records.length + 1,
      sub: def.name,
      kind: def.kind,
      lifetime: def.lifetime,
      label: `${def.name}(${actuals.map((a) => (a.expr.kind === "var" ? a.expr.name : a.expr.kind === "const" ? exprToSource(a.expr) : formatValue(a.value))).join(", ")})`,
      ordinal,
      pid: ctx.pid,
      depth: (callStacks.get(ctx.pid) ?? []).length,
      startTime: time,
    };
    records.push(record);
    const act: Activation = { record, def, own: new Map(), shared: shared.get(def.name) as Store, refs: new Map(), copyOuts: [] };
    const notes: string[] = [];
    // §13.3.2: automatic items (outputs included) start at their defaults on every entry.
    if (def.lifetime === "automatic") {
      def.formals.forEach((f) => {
        if (f.direction !== "ref" && f.direction !== "const ref") act.own.set(f.name, { value: defaultValue(f.type), type: f.type, role: "formal", direction: f.direction });
      });
    }
    def.locals.forEach((l) => {
      if ((l.qualifier ?? def.lifetime) === "automatic") act.own.set(l.name, { value: l.init ? coerce(evalExpr(l.init, { pid: ctx.pid, act }, lineKey), l.type) : defaultValue(l.type), type: l.type, role: "local" });
    });
    def.formals.forEach((f, i) => {
      const actual = actuals[i];
      const slotStore = def.lifetime === "automatic" ? act.own : act.shared;
      if (f.direction === "ref" || f.direction === "const ref") {
        const target = bindingOf(ctx, (actual.expr as { kind: "var"; name: string }).name);
        act.refs.set(f.name, target);
        notes.push(`${f.name} is bound to ${target.label} (${f.direction}: no copy)`);
        return;
      }
      const slot = slotStore.get(f.name) as Slot;
      if (f.direction === "input" || f.direction === "inout") {
        const old = slot.value;
        slot.value = coerce(actual.value, f.type);
        const overwrote = def.lifetime === "static" && old !== defaultValue(f.type) && old !== slot.value ? `, overwriting ${formatValue(old)}` : "";
        notes.push(`${f.name} ← ${formatValue(slot.value)} (${f.direction}: copied in${overwrote})`);
      } else {
        notes.push(
          def.lifetime === "automatic"
            ? `${f.name} starts at ${formatValue(slot.value)} (output: not copied in; the ${f.type} default)`
            : `${f.name} keeps ${formatValue(slot.value)} (output: not copied in; static storage is not re-initialized)`,
        );
      }
      if (f.direction === "output" || f.direction === "inout") {
        act.copyOuts.push({ formal: f.name, target: bindingOf(ctx, (actual.expr as { kind: "var"; name: string }).name), direction: f.direction });
      }
    });
    const localNotes = def.locals
      .filter((l) => (l.qualifier ?? def.lifetime) === "automatic")
      .map((l) => `${l.name} starts at ${formatValue((act.own.get(l.name) as Slot).value)} (automatic local${l.init ? ", initialized on entry" : `, the ${l.type} default`})`);
    live.set(record.id, act);
    const stack = callStacks.get(ctx.pid) ?? [];
    stack.push(record.id);
    callStacks.set(ctx.pid, stack);
    const ownNames = [...act.own.keys()];
    const sharedNames = [...act.shared.keys()];
    const mixed = ownNames.length > 0 && sharedNames.length > 0;
    const storageText = mixed ? `uses the one shared copy of ${sharedNames.join(", ")} and gets its own ${ownNames.join(", ")}` : def.lifetime === "automatic" ? "gets its own storage" : "uses the one shared copy";
    const sharedNotes = def.locals
      .filter((l) => (l.qualifier ?? def.lifetime) === "static")
      .map((l) => `${l.name} is static: it keeps ${formatValue((act.shared.get(l.name) as Slot).value)} across calls`);
    let enterWhy: string;
    let enterClause: string;
    if (mixed) {
      enterWhy = `${def.name} is a ${def.lifetime} ${def.kind}, but a local can override that lifetime. ${sharedNames.join(", ")} ${isAre(sharedNames)} one shared copy that keeps its value between calls; ${ownNames.join(", ")} ${ownNames.length === 1 ? "belongs" : "belong"} to this activation and ${isAre(ownNames)} initialized on each entry to the call.`;
      enterClause = storageClause(def, [...ownNames, ...sharedNames]);
    } else if (def.kind === "function") {
      enterWhy =
        def.lifetime === "automatic"
          ? "An automatic function allocates its variables for this call and initializes them to their defaults on each entry to the call; inputs and inouts then take the values passed. Nothing another activation does can reach them."
          : "A static function's variables are statically allocated and shared across all its uses executing concurrently; a copy-in writes that one copy, so an activation still in progress sees the new value too.";
      enterClause = def.lifetime === "automatic" ? "§13.4.2, §6.21" : "§13.4.2";
    } else {
      enterWhy =
        def.lifetime === "automatic"
          ? "An automatic task allocates its variables for this activation and initializes them, outputs included, to their defaults when execution enters it; inputs and inouts then take the values passed. Nothing another activation does can reach them."
          : "A static task has one copy of each variable per module instance, shared by every activation; a copy-in writes that one copy, so a concurrent activation sees the new value too.";
      enterClause = def.lifetime === "automatic" ? "§13.3.2, §13.3" : "§13.3.2, §13.3.1";
    }
    emit({
      kind: "enter",
      pid: ctx.pid,
      activationId: record.id,
      lineKey: `sub:${def.name}`,
      what: `${record.label} starts (call ${ordinal}${record.depth > 0 ? `, depth ${record.depth + 1}` : ""}) and ${storageText}: ${[...notes, ...localNotes, ...sharedNotes].join("; ")}.`,
      why: enterWhy,
      clause: enterClause,
    });
    return act;
  }

  function finish(act: Activation, ctx: Ctx, lineKey: string | undefined, returned?: { expr?: Expr; value: Value }): void {
    const notes: string[] = [];
    const copied = act.copyOuts.map((co) => {
      const value = ((act.def.lifetime === "automatic" ? act.own : act.shared).get(co.formal) as Slot).value;
      const result = store(co.target, value);
      let note = `${co.target.label} ← ${formatValue(result.stored)} (${co.direction}: copied out)`;
      if (co.target.store === globals && watchers.has(co.target.name) && !result.changed) {
        note += `; ${co.target.label} was already ${formatValue(result.old)}, so nothing changes and always @(${co.target.label}) does not wake`;
      }
      notes.push(note);
      return { co, result };
    });
    if (act.copyOuts.length === 0) notes.push("nothing is copied out");
    const ownNames = [...act.own.keys()];
    const kept = [...act.shared.entries()].map(([n, s]) => `${n} = ${formatValue(s.value)}`).join(", ");
    if (ownNames.length) notes.push(kept ? `its own ${ownNames.join(", ")} ${ownNames.length === 1 ? "is" : "are"} dropped` : "its storage is dropped");
    else if (act.def.lifetime === "automatic" && !kept) notes.push("its bindings end");
    if (kept) notes.push(`the shared storage keeps ${kept}`);
    else if (act.def.lifetime === "static" && !ownNames.length) notes.push("the shared storage stays");
    act.record.endTime = time;
    if (returned) {
      const resolved = resolveReturnType(act.def.returnType).type;
      act.record.returnValue = resolved === "void" ? undefined : coerce(returned.value, resolved);
    }
    live.delete(act.record.id);
    const stack = callStacks.get(ctx.pid) ?? [];
    stack.pop();
    const returnText = returned ? ` returns ${returned.expr ? explain(returned.expr, { pid: ctx.pid, act }, act.record.returnValue ?? returned.value) : formatValue(act.record.returnValue)}` : " returns";
    const recursed = records.some((r) => r.sub === act.def.name && r.depth === act.record.depth + 1 && r.id > act.record.id);
    const nonReentrant =
      act.def.kind === "function" && act.def.lifetime === "static" && returned?.expr && recursed
        ? " The operands are read now, after the inner calls overwrote the shared copies: a static function is not reentrant."
        : "";
    const hasOwn = ownNames.length > 0 || act.def.lifetime === "automatic";
    const hasShared = act.shared.size > 0 || act.def.lifetime === "static";
    emit({
      kind: "return",
      pid: ctx.pid,
      activationId: act.record.id,
      lineKey,
      what: `${act.record.label}${returnText} at t = ${time} ns: ${notes.join("; ")}.`,
      why: `Output and inout values reach the caller's variables once, at the return.${nonReentrant}${hasOwn ? " Automatic storage is deallocated at the end of the invocation." : ""}${hasShared ? " Static variables retain their values between invocations." : ""}`,
      clause: `§13.3, ${storageClause(act.def, act.def.locals.map((l) => l.name))}`,
      dropped: act,
    });
    copied.forEach(({ co, result }) => fireWatcher(co.target, result.changed, { pid: ctx.pid }));
  }

  /* ---------- functions run synchronously (§13.4: no time controls) ---------- */

  function callFunction(def: SubroutineDef, args: Expr[], ctx: Ctx, lineKey?: string): Value {
    const act = enter(def, args, ctx, lineKey);
    const inner: Ctx = { pid: ctx.pid, act };
    const outcome = runSync(def.body, inner);
    const resolved = resolveReturnType(def.returnType).type;
    const value = outcome.returned ? outcome.value : defaultValue(resolved === "void" ? "int" : resolved);
    finish(act, ctx, outcome.returnKey ?? lineKey, { expr: outcome.expr, value });
    return act.record.returnValue ?? value;
  }

  function runSync(stmts: Stmt[], ctx: Ctx): { returned: boolean; value: Value; expr?: Expr; returnKey?: string } {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case "assign":
          execAssign(stmt, ctx);
          break;
        case "display":
          execDisplay(stmt, ctx);
          break;
        case "if": {
          const taken = execIf(stmt, ctx);
          if (taken) {
            const r = runSync(stmt.then, ctx);
            if (r.returned) return r;
          }
          break;
        }
        case "return": {
          const value = stmt.expr ? evalExpr(stmt.expr, ctx, stmt.key) : ("X" as Value);
          return { returned: true, value, expr: stmt.expr, returnKey: stmt.key };
        }
        case "call": {
          const callee = subs.get(stmt.sub);
          if (!callee || callee.kind !== "function") throw new ModelError(`Bench ${bench.id}: a function may not enable a task (${stmt.sub})`);
          callFunction(callee, stmt.args, ctx, stmt.key);
          break;
        }
        default:
          throw new ModelError(`Bench ${bench.id}: ${stmt.kind} is not allowed in a function`);
      }
    }
    return { returned: false, value: "X" };
  }

  /* ---------- statements ---------- */

  const actLabel = (ctx: Ctx) => ctx.act?.record.label ?? procs[ctx.pid]?.label ?? `process ${ctx.pid}`;

  function execAssign(stmt: Extract<Stmt, { kind: "assign" }>, ctx: Ctx): void {
    const value = evalExpr(stmt.expr, ctx, stmt.key);
    const binding = bindingOf(ctx, stmt.target);
    const isRef = ctx.act?.refs.has(stmt.target) ?? false;
    const slot = binding.store.get(binding.name) as Slot;
    if (stmt.nba) {
      nbaQueue.push({ binding, value, pid: ctx.pid, lineKey: stmt.key, act: ctx.act });
      emit({
        kind: "exec",
        pid: ctx.pid,
        activationId: ctx.act?.record.id,
        lineKey: stmt.key,
        what: `${actLabel(ctx)}: ${stmt.target} <= ${explain(stmt.expr, ctx, value)} is scheduled for the NBA region of this time slot.`,
        why: "A nonblocking assignment evaluates its right-hand side now and updates the variable after every process at this time has blocked or finished.",
        clause: "§10.4.2",
      });
      return;
    }
    // The operands are read before the write, or a self-assignment would narrate its own result as its left operand.
    const narrated = explain(stmt.expr, ctx, coerce(value, slot.type));
    const result = store(binding, value);
    const where = isRef ? ` ${stmt.target} is ${binding.label} itself, so the caller sees ${formatValue(result.stored)} at once.` : "";
    let why = "A blocking assignment updates the variable before the next statement runs.";
    let clause = "§10.4.1";
    if (isRef) {
      why = "A ref formal is a reference to the caller's variable: changes are visible outside before the subroutine returns.";
      clause = "§13.5.2";
    } else if (ctx.act && binding.store === ctx.act.own) {
      why =
        slot.role === "local"
          ? "A blocking assignment updates this activation's own copy at once; no other activation can see or change it."
          : slot.direction === "input"
            ? "A blocking assignment updates this activation's own copy at once; an input is never copied back, so the caller's variable is untouched."
            : "A blocking assignment updates this activation's own copy at once; the caller's variable is untouched until the copy-out at the return.";
      clause = storageClause(ctx.act.def, [stmt.target]);
    } else if (ctx.act && binding.store === ctx.act.shared) {
      why = `A blocking assignment updates the one shared copy at once; every activation of ${ctx.act.def.name} reads the new value.`;
      clause = storageClause(ctx.act.def, [stmt.target]);
    }
    emit({
      kind: "exec",
      pid: ctx.pid,
      activationId: ctx.act?.record.id,
      lineKey: stmt.key,
      what: `${actLabel(ctx)}: ${stmt.target} = ${narrated}.${where}`,
      why,
      clause,
    });
    fireWatcher(binding, result.changed, ctx);
  }

  function execDisplay(stmt: Extract<Stmt, { kind: "display" }>, ctx: Ctx): void {
    const values = stmt.args.map((a) => evalExpr(a, ctx, stmt.key));
    const text = formatDisplay(stmt.format, values);
    log.push({ time, text, pid: ctx.pid, activationId: ctx.act?.record.id, lineKey: stmt.key });
    const reads = stmt.args
      .filter((a) => a.kind === "var")
      .map((a) => `${(a as { name: string }).name} = ${formatValue(evalExpr(a, ctx))}`)
      .join(", ");
    const act = ctx.act;
    const printedNames = [...new Set(stmt.args.flatMap((a) => [...walkExprs(a)]).flatMap((e) => (e.kind === "var" ? [e.name] : [])))];
    const ownReads = act ? printedNames.filter((n) => !act.refs.has(n) && act.own.has(n)) : [];
    const sharedReads = act ? printedNames.filter((n) => !act.refs.has(n) && !act.own.has(n) && act.shared.has(n)) : [];
    let why = "$display prints the values as they are at this point of the time slot.";
    if (ownReads.length && sharedReads.length) {
      why = `${sharedReads.join(", ")} ${isAre(sharedReads)} read from the shared copy, which another activation may have written since this call started; ${ownReads.join(", ")} ${isAre(ownReads)} this activation's own copy, which only it has written.`;
    } else if (sharedReads.length) {
      why = "The value printed is whatever the shared copy holds now, which may have been written by another activation since this call started.";
    } else if (ownReads.length) {
      why = "The value printed is this activation's own copy, which only this activation has written.";
    }
    emit({
      kind: "print",
      pid: ctx.pid,
      activationId: act?.record.id,
      lineKey: stmt.key,
      what: `${actLabel(ctx)} prints "${text}"${reads ? ` (reads ${reads})` : ""}.`,
      why,
      clause: act && (ownReads.length || sharedReads.length) ? storageClause(act.def, printedNames) : "§21.2.1",
    });
  }

  function execIf(stmt: Extract<Stmt, { kind: "if" }>, ctx: Ctx): boolean {
    const cond = evalExpr(stmt.cond, ctx, stmt.key);
    const taken = cond !== "X" && cond !== 0;
    emit({
      kind: "exec",
      pid: ctx.pid,
      activationId: ctx.act?.record.id,
      lineKey: stmt.key,
      what: `${actLabel(ctx)}: if (${exprToSource(stmt.cond)}) is ${taken ? "true" : "false"} with ${operands(stmt.cond, ctx)}${taken ? "" : ", so it goes on"}.`,
      why: taken ? "The condition holds, so the guarded statement runs." : "The condition is false, so the guarded statement is skipped.",
      clause: "§12.4",
    });
    return taken;
  }

  function innermostAct(p: Proc): Activation | undefined {
    for (let i = p.frames.length - 1; i >= 0; i -= 1) if (p.frames[i].act) return p.frames[i].act;
    return undefined;
  }

  function popActivationFrame(p: Proc, ctx: Ctx, lineKey?: string): void {
    let idx = -1;
    p.frames.forEach((f, i) => {
      if (f.act) idx = i;
    });
    if (idx < 0) return;
    const act = p.frames[idx].act as Activation;
    p.frames.splice(idx);
    finish(act, ctx, lineKey);
  }

  function spawn(label: string, stmts: Stmt[], parent?: number, forkKey?: string): Proc {
    const proc: Proc = { pid: procs.length, label, frames: [{ stmts, pc: 0 }], state: "ready", parent, forkKey };
    procs.push(proc);
    return proc;
  }

  const branchLabel = (branch: Stmt[]) => (branch.length ? stmtToSource(branch[0]).replace(/;$/, "") : "empty branch");

  function completeProcess(p: Proc): void {
    p.state = "done";
    if (p.parent === undefined) return;
    const parent = procs[p.parent];
    if (parent.state !== "blocked" || !parent.joinWait) return;
    if (parent.joinWait.every((pid) => procs[pid].state === "done")) {
      parent.joinWait = undefined;
      parent.state = "ready";
      emit({
        kind: "join",
        pid: p.pid,
        lineKey: p.forkKey ? `${p.forkKey}:join` : undefined,
        what: `${p.label} finished; every branch of the fork is done, so join lets ${parent.label} continue at t = ${time} ns.`,
        why: "join waits for all the processes it spawned to finish.",
        clause: "§9.3.2",
      });
    }
  }

  function step(p: Proc): void {
    const frame = p.frames[p.frames.length - 1];
    if (!frame) {
      completeProcess(p);
      return;
    }
    if (frame.pc >= frame.stmts.length) {
      p.frames.pop();
      if (frame.act) finish(frame.act, { pid: p.pid, act: frame.act }, undefined);
      if (p.frames.length === 0) completeProcess(p);
      return;
    }
    const stmt = frame.stmts[frame.pc];
    const ctx: Ctx = { pid: p.pid, act: innermostAct(p) };
    switch (stmt.kind) {
      case "delay": {
        frame.pc += 1;
        const amount = evalExpr(stmt.amount, ctx, stmt.key);
        const until = time + (typeof amount === "number" ? amount : 0);
        p.state = "blocked";
        p.wakeAt = until;
        if (stmt.then) p.frames.push({ stmts: [stmt.then], pc: 0 });
        emit({
          kind: "wait",
          pid: p.pid,
          activationId: ctx.act?.record.id,
          lineKey: stmt.key,
          what: `${actLabel(ctx)} waits #${formatValue(amount)} until t = ${until} ns.`,
          why: ctx.act
            ? "The delay suspends only this process; other processes keep running, and another activation of the same subroutine may start meanwhile."
            : "The delay suspends only this process; other processes keep running.",
          clause: "§9.4.1",
        });
        return;
      }
      case "display":
        frame.pc += 1;
        execDisplay(stmt, ctx);
        return;
      case "assign":
        frame.pc += 1;
        execAssign(stmt, ctx);
        return;
      case "if": {
        frame.pc += 1;
        if (execIf(stmt, ctx)) p.frames.push({ stmts: stmt.then, pc: 0 });
        return;
      }
      case "call": {
        frame.pc += 1;
        const callee = subs.get(stmt.sub);
        if (!callee) throw new ModelError(`Bench ${bench.id}: unknown subroutine ${stmt.sub}`);
        if (callee.kind === "function") {
          callFunction(callee, stmt.args, ctx, stmt.key);
          return;
        }
        const act = enter(callee, stmt.args, ctx, stmt.key);
        p.frames.push({ stmts: callee.body, pc: 0, act });
        return;
      }
      case "return":
        frame.pc += 1;
        popActivationFrame(p, ctx, stmt.key);
        if (p.frames.length === 0) completeProcess(p);
        return;
      case "fork": {
        frame.pc += 1;
        const children = stmt.branches.map((branch) => spawn(branchLabel(branch), branch, p.pid, stmt.key));
        p.state = "blocked";
        p.joinWait = children.map((ch) => ch.pid);
        emit({
          kind: "fork",
          pid: p.pid,
          lineKey: stmt.key,
          what: `${p.label} forks ${children.length} branches (${children.map((ch) => ch.label).join("; ")}) and waits at join.`,
          why: "Each branch of a fork is its own process; join blocks the parent until all of them finish.",
          clause: "§9.3.2",
        });
        return;
      }
    }
  }

  /* ---------- scheduler ---------- */

  bench.processes.forEach((p) => spawn(p.label, p.body));
  emit({
    kind: "start",
    what: `t = 0 ns: ${bench.globals.length ? `${bench.globals.map((g) => `${g.name} = ${formatValue((globals.get(g.name) as Slot).value)}`).join(", ")}; ` : ""}${
      [...shared.values()].some((store) => store.size > 0) ? "static subroutine storage exists from time 0 at its default values" : "every subroutine is automatic: no storage exists until a call"
    }.`,
    why: "Static variables are allocated once per module instance and initialized to their type defaults before any call; automatic variables exist only while an activation is running.",
    clause: bench.subs.some((s) => s.kind === "task") ? "§13.3.2, §6.8" : "§13.4.2, §6.8",
  });

  let choiceIndex = 0;
  for (;;) {
    const ready = procs.filter((p) => p.state === "ready");
    if (ready.length === 0) {
      if (nbaQueue.length) {
        const updates = nbaQueue.splice(0);
        updates.forEach((u) => {
          const result = store(u.binding, u.value);
          emit({
            kind: "nba",
            pid: u.pid,
            activationId: u.act?.record.id,
            lineKey: u.lineKey,
            what: `NBA region at t = ${time} ns: ${u.binding.label} ← ${formatValue(result.stored)}.`,
            why: "Nonblocking updates run after the active processes of this time slot have blocked or finished.",
            clause: "§4.4.2.4",
          });
          fireWatcher(u.binding, result.changed, { pid: u.pid });
        });
        continue;
      }
      const sleeping = procs.filter((p) => p.state === "blocked" && p.wakeAt !== undefined);
      if (sleeping.length === 0) break;
      const next = Math.min(...sleeping.map((p) => p.wakeAt as number));
      time = next;
      const woken = sleeping.filter((p) => p.wakeAt === next);
      woken.forEach((p) => {
        p.state = "ready";
        p.wakeAt = undefined;
      });
      emit({
        kind: "advance",
        what: `Time advances to t = ${time} ns: ${woken.map((p) => (innermostAct(p)?.record.label ?? p.label)).join(" and ")} wake${woken.length === 1 ? "s" : ""}.`,
        why: "No process can run at the current time, so the simulator moves to the next scheduled wake-up.",
        clause: "§4.5",
      });
      continue;
    }
    let pick = 0;
    if (ready.length > 1) {
      pick = Math.min(options.choices?.[choiceIndex] ?? 0, ready.length - 1);
      choices.push(pick);
      choiceWidths.push(ready.length);
      choiceIndex += 1;
      const labelOf = (p: Proc) => innermostAct(p)?.record.label ?? p.label;
      pendingChoice = { options: ready.map(labelOf), picked: labelOf(ready[pick]) };
    }
    const p = ready[pick];
    while (p.state === "ready") step(p);
  }
  emit({
    kind: "end",
    what: `Nothing is left to run at t = ${time} ns. Output: ${log.length ? log.map((l) => `"${l.text}"`).join(", ") : "none"}.`,
    why: "Every process has finished or is blocked forever, so simulation ends.",
    clause: "§4.5",
  });

  const finalGlobals: Record<string, Value> = {};
  globals.forEach((slot, name) => {
    finalGlobals[name] = slot.value;
  });
  return { benchId: bench.id, trace, log, endTime: time, globals: finalGlobals, activations: records, choices, choiceWidths };
}

/* ========================================================================= */
/* Exhaustive exploration (§4.7)                                              */
/* ========================================================================= */

export interface BenchOutcome {
  signature: string;
  result: SubroutineRun;
  /** The choice vectors that led here. */
  runs: number[][];
}

export interface BenchExploration {
  outcomes: BenchOutcome[];
  runCount: number;
  deterministic: boolean;
}

const runSignature = (run: SubroutineRun) =>
  `${run.log.map((l) => `${l.time}:${l.text}`).join("|")}#${Object.entries(run.globals)
    .map(([n, val]) => `${n}=${formatValue(val)}`)
    .join(",")}`;

/** Runs every order of the simultaneously ready processes and groups the distinct outcomes. */
export function exploreBench(bench: Bench, maxRuns = 64): BenchExploration {
  const groups = new Map<string, BenchOutcome>();
  const stack: number[][] = [[]];
  let runCount = 0;
  while (stack.length) {
    const prefix = stack.pop() as number[];
    const result = simulateBench(bench, { choices: prefix });
    runCount += 1;
    if (runCount > maxRuns) throw new ModelError(`Bench ${bench.id} exceeded ${maxRuns} orders`);
    for (let i = result.choices.length - 1; i >= prefix.length; i -= 1) {
      for (let alt = 1; alt < result.choiceWidths[i]; alt += 1) stack.push([...result.choices.slice(0, i), alt]);
    }
    const signature = runSignature(result);
    const group = groups.get(signature);
    if (group) group.runs.push(result.choices);
    else groups.set(signature, { signature, result, runs: [result.choices] });
  }
  const outcomes = [...groups.values()];
  return { outcomes, runCount, deterministic: outcomes.length === 1 };
}

/* ========================================================================= */
/* Lesson benches                                                             */
/* ========================================================================= */

const display = (format: string, ...args: Expr[]): Stmt => ({ kind: "display", format, args });
const delay = (amount: number | Expr, then?: Stmt): Stmt => ({ kind: "delay", amount: typeof amount === "number" ? c(amount) : amount, then });
const assign = (target: string, expr: Expr, nba = false): Stmt => ({ kind: "assign", target, expr, nba });
const call = (sub: string, ...args: Expr[]): Stmt => ({ kind: "call", sub, args });

export type SecondCallAt = 2 | 10 | 12;
export const SECOND_CALL_OPTIONS: readonly SecondCallAt[] = [2, 10, 12];

export interface SendBenchOptions {
  lifetime: Lifetime;
  /** When the second call starts: #2 overlaps call 1, #10 lands in call 1's print slot, #12 does not overlap. */
  secondCallAt: SecondCallAt;
  /** The lesson's enter/use debug prints. */
  debugPrints?: boolean;
}

/** The lesson's "Two callers, one shared variable" bench. */
export function sendBench({ lifetime, secondCallAt, debugPrints = false }: SendBenchOptions): Bench {
  const body: Stmt[] = debugPrints
    ? [
        { ...display("t=%0d enter id=%0d", now, v("id")), key: "send-enter" },
        { ...delay(10, display("t=%0d use   id=%0d", now, v("id"))), key: "send-print", comment: lifetime === "static" ? "if this differs from enter: shared storage" : "same as enter: own storage" },
      ]
    : [{ ...delay(10, display("t=%0d id=%0d", now, v("id"))), key: "send-print" }];
  return {
    id: `send:${lifetime}:${secondCallAt}${debugPrints ? ":debug" : ""}`,
    title: "Two callers, one shared variable",
    globals: [],
    subs: [{ name: "send", kind: "task", lifetime, formals: [{ name: "id", direction: "input", type: "int" }], locals: [], body }],
    processes: [
      {
        id: "main",
        label: "initial",
        body: [
          {
            kind: "fork",
            key: "fork",
            branches: [
              [{ ...call("send", c(1)), key: "call-1", comment: "call 1 starts at t=0 and waits until t=10" }],
              [{ ...delay(secondCallAt, call("send", c(2))), key: "call-2", comment: `call 2 starts at t=${secondCallAt}${secondCallAt < 10 ? ", while call 1 is still waiting" : secondCallAt === 10 ? ", as call 1 wakes" : ", after call 1 returned"}` }],
            ],
          },
        ],
      },
    ],
  };
}

/** The activation of send(1), the first call. */
export function callOneActivation(run: SubroutineRun): ActivationRecord | undefined {
  return run.activations.find((a) => a.sub === "send" && a.ordinal === 1);
}

/** What call 1 printed in this run, read from call 1's own print line: at t = 10 ns another call's line may come first. */
export function callOnePrint(run: SubroutineRun): "id=1" | "id=2" {
  const callOne = callOneActivation(run);
  const line = run.log.find((l) => l.activationId === callOne?.id && l.lineKey === "send-print");
  return line?.text.includes("id=2") ? "id=2" : "id=1";
}

/** What call 1 prints at t = 10 ns, across every order: "id=1", "id=2" or "either". */
export function sendVerdict(exploration: BenchExploration): "id=1" | "id=2" | "either" {
  const printed = new Set(exploration.outcomes.map((o) => callOnePrint(o.result)));
  if (printed.size > 1) return "either";
  return printed.has("id=2") ? "id=2" : "id=1";
}

/** The lesson's count_ones trap: a static local keeps its value between calls (§13.4.2, §6.21). */
export function countOnesBench(lifetime: Lifetime): Bench {
  return {
    id: `count-ones:${lifetime}`,
    title: "count_ones called twice",
    globals: [],
    subs: [
      {
        name: "count_ones",
        kind: "function",
        lifetime,
        returnType: "int",
        formals: [{ name: "v", direction: "input", type: "logic [7:0]" }],
        locals: [{ name: "n", type: "int", comment: lifetime === "static" ? "static: set to 0 once, at time 0, never again" : "automatic: a fresh 0 on every call" }],
        body: [
          { ...assign("n", bin("+", v("n"), { kind: "popcount", operand: v("v") })), key: "count-loop", source: "foreach (v[i]) if (v[i]) n++;" },
          { kind: "return", expr: v("n"), key: "count-return" },
        ],
      },
    ],
    processes: [
      {
        id: "main",
        label: "initial",
        body: [
          { ...display("count_ones(8'hFF) = %0d", fcall("count_ones", c(0xff, "8'hFF"))), key: "call-ff" },
          { ...display("count_ones(8'h01) = %0d", fcall("count_ones", c(0x01, "8'h01"))), key: "call-01" },
        ],
      },
    ],
  };
}

/** The lesson's count_calls task: a static total beside an automatic this_call, called three times. */
export function countCallsBench(): Bench {
  return {
    id: "count-calls",
    title: "count_calls called three times",
    globals: [],
    subs: [
      {
        name: "count_calls",
        kind: "task",
        lifetime: "static",
        formals: [],
        locals: [
          { name: "total", type: "int", qualifier: "static", init: c(0), comment: "initialized once, at time 0; keeps counting" },
          { name: "this_call", type: "int", qualifier: "automatic", init: c(0), comment: "initialized again at the start of every call" },
        ],
        body: [
          { ...assign("total", bin("+", v("total"), c(1))), source: "total++;", key: "total-inc" },
          { ...assign("this_call", bin("+", v("this_call"), c(1))), source: "this_call++;", key: "this-inc" },
          { ...display("total=%0d this_call=%0d", v("total"), v("this_call")), key: "count-print" },
        ],
      },
    ],
    processes: [{ id: "main", label: "initial", body: [{ ...call("count_calls"), key: "cc-1" }, { ...call("count_calls"), key: "cc-2" }, { ...call("count_calls"), key: "cc-3" }] }],
  };
}

export interface RecursionOptions {
  lifetime: Lifetime;
  n: number;
}

/** The lesson's factorial, named fact_static or fact_auto after its lifetime. */
export function factBench({ lifetime, n }: RecursionOptions): Bench {
  const name = lifetime === "static" ? "fact_static" : "fact_auto";
  return {
    id: `fact:${lifetime}:${n}`,
    title: `${name}(${n})`,
    globals: [],
    subs: [
      {
        name,
        kind: "function",
        lifetime,
        returnType: "int",
        comment: lifetime === "static" ? "Static (module default): every activation shares one n and one rest." : "Automatic: each activation gets its own n and rest.",
        formals: [{ name: "n", direction: "input", type: "int" }],
        locals: [{ name: "rest", type: "int" }],
        body: [
          { kind: "if", cond: bin("<=", v("n"), c(1)), then: [{ kind: "return", expr: c(1), key: "fact-base-return" }], key: "fact-base" },
          { ...assign("rest", fcall(name, bin("-", v("n"), c(1)))), key: "fact-recurse", comment: lifetime === "static" ? "the inner call copies a new value into n" : undefined },
          { kind: "return", expr: bin("*", v("rest"), v("n")), key: "fact-return", comment: lifetime === "static" ? "reads n after the call: it is now 1" : undefined },
        ],
      },
    ],
    processes: [{ id: "main", label: "initial", body: [{ ...display(`${name}(${n}) = %0d`, fcall(name, c(n))), key: "fact-call" }] }],
  };
}

/** The kata's sum_to: 1 + 2 + ... + n, which a static function turns into 0. */
export function sumToBench({ lifetime, n }: RecursionOptions): Bench {
  return {
    id: `sum-to:${lifetime}:${n}`,
    title: `sum_to(${n})`,
    globals: [],
    subs: [sumToDef(lifetime, "sum-to")],
    processes: [{ id: "main", label: "initial", body: [{ ...display(`sum_to(${n}) = %0d`, fcall("sum_to", c(n))), key: "sum-call" }] }],
  };
}

function sumToDef(lifetime: Lifetime, prefix: string, nba = false): SubroutineDef {
  return {
    name: "sum_to",
    kind: "function",
    lifetime,
    returnType: "int",
    comment: "Returns 1 + 2 + ... + n.",
    formals: [{ name: "n", direction: "input", type: "int" }],
    locals: [{ name: "partial", type: "int" }],
    body: [
      { kind: "if", cond: bin("<=", v("n"), c(0)), then: [{ kind: "return", expr: c(0), key: `${prefix}-base-return` }], key: `${prefix}-base` },
      { ...assign("partial", fcall("sum_to", bin("-", v("n"), c(1))), nba), key: `${prefix}-recurse` },
      { kind: "return", expr: bin("+", v("partial"), v("n")), key: `${prefix}-return` },
    ],
  };
}

export function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/** The outermost activation's return value (the one the initial block printed). */
export function outerReturnValue(run: SubroutineRun): Value | undefined {
  return run.activations.find((a) => a.depth === 0)?.returnValue;
}

export interface RecursionRow {
  step: number;
  running: string;
  does: string;
  nAfter: string;
  restAfter: string;
  /** Trace index this row describes; the row is current while the scrubber is at or past it and before the next row's index. */
  traceIndex: number;
}

/** The lesson's trace table, generated from a run: one row per entry and per return of a recursive activation. */
export function recursionTable(run: SubroutineRun): RecursionRow[] {
  const rows: RecursionRow[] = [];
  const sub = run.activations[0]?.sub;
  if (!sub) return rows;
  const localName = run.trace.flatMap((s) => s.boxes).flatMap((b) => b.vars).find((x) => x.role === "local")?.name ?? "rest";
  const valueIn = (step: SubStep, name: string, actId: number) => {
    const box = step.boxes.find((b) => (b.owner === actId || b.owner === "static") && b.vars.some((x) => x.name === name));
    return formatValue(box?.vars.find((x) => x.name === name)?.value);
  };
  run.trace.forEach((step) => {
    if (step.kind !== "enter" && step.kind !== "return") return;
    if (step.activationId === undefined) return;
    const act = run.activations.find((a) => a.id === step.activationId) as ActivationRecord;
    const n = valueIn(step, "n", act.id);
    const rest = valueIn(step, localName, act.id);
    if (step.kind === "enter") {
      const recurses = run.activations.some((a) => a.id === act.id + 1 && a.depth === act.depth + 1);
      const callArg = act.label.match(/\((\d+)\)/)?.[1] ?? n;
      rows.push({
        step: rows.length + 1,
        running: act.label,
        does: recurses ? `copies ${callArg} into n, calls ${sub}(${Number(callArg) - 1})` : `copies ${callArg} into n; the base case returns ${formatValue(act.returnValue)}`,
        nAfter: n,
        restAfter: rest,
        traceIndex: step.index,
      });
      return;
    }
    const inner = run.activations.find((a) => a.id === act.id + 1 && a.depth === act.depth + 1);
    if (!inner) return;
    rows.push({
      step: rows.length + 1,
      running: act.label,
      does: `${localName} = ${formatValue(inner.returnValue)}, returns ${step.what.match(/returns (.*?) at t/)?.[1] ?? formatValue(act.returnValue)}`,
      nAfter: n,
      restAfter: rest,
      traceIndex: step.index,
    });
  });
  return rows;
}

export type DirName = "a" | "b" | "c" | "d";
export const DIR_FORMALS: readonly DirName[] = ["a", "b", "c", "d"];
export const DIR_ACTUALS: Record<DirName, string> = { a: "v_in", b: "v_out", c: "v_io", d: "v_ref" };
export const DEFAULT_DIRECTIONS: Record<DirName, Direction> = { a: "input", b: "output", c: "inout", d: "ref" };
/** Every caller variable of the show_dirs bench starts at 5. */
export const DIR_INITIAL = 5;
/** `a = a + 10; b = b + 20; c = c + 30; d = d + 40;` */
export const DIR_ADDS: Record<DirName, number> = { a: 10, b: 20, c: 30, d: 40 };

export interface ShowDirsOptions {
  lifetime: Lifetime;
  directions: Record<DirName, Direction>;
  /** `b <= b + 20` instead of `b = b + 20`. */
  nbaOnB?: boolean;
  /** Call show_dirs a second time after the first join, with a second "after" print. */
  calls?: 1 | 2;
}

/** The lesson's show_dirs bench, with every direction and the lifetime as data. */
export function showDirsBench({ lifetime, directions, nbaOnB = false, calls = 1 }: ShowDirsOptions): Bench {
  const comments: Record<DirName, string> = {
    a: "a is a local copy: the caller never sees this",
    b:
      calls === 1
        ? "b starts at 0, the int default, not at the caller's 5"
        : lifetime === "automatic"
          ? "b starts at 0 on each call, the int default, not at the caller's value"
          : "b starts at 0, the int default, on the first call only: static storage keeps its value",
    c: calls === 1 ? "c is a copy of the caller's 5, copied back at the return" : "c is a copy of the caller's value, copied back at the return",
    d: "d IS the caller's variable: it changes at once",
  };
  const callStmt = (key: string): Stmt => ({ ...call("show_dirs", v("v_in"), v("v_out"), v("v_io"), v("v_ref")), key });
  const after = (key: string): Stmt => ({ ...display("t=%0d after:  v_in=%0d v_out=%0d v_io=%0d v_ref=%0d", now, v("v_in"), v("v_out"), v("v_io"), v("v_ref")), key });
  return {
    id: `show-dirs:${lifetime}:${DIR_FORMALS.map((f) => directions[f]).join(",")}${nbaOnB ? ":nba" : ""}:${calls}`,
    title: "Argument directions: when the caller sees a change",
    globals: [
      { name: "v_in", type: "int", init: DIR_INITIAL, key: "globals" },
      { name: "v_out", type: "int", init: DIR_INITIAL, sharesLine: true },
      { name: "v_io", type: "int", init: DIR_INITIAL, sharesLine: true },
      { name: "v_ref", type: "int", init: DIR_INITIAL, sharesLine: true },
    ],
    subs: [
      {
        name: "show_dirs",
        kind: "task",
        lifetime,
        formalsOnLines: true,
        formals: DIR_FORMALS.map((f) => ({ name: f, direction: directions[f], type: "int" as DataType })),
        locals: [],
        body: [
          ...DIR_FORMALS.map((f) => ({ ...assign(f, bin("+", v(f), c(DIR_ADDS[f])), f === "b" && nbaOnB), key: `dir-${f}`, comment: directions[f] === DEFAULT_DIRECTIONS[f] ? comments[f] : undefined })),
          { ...delay(10), key: "dir-wait", comment: calls === 1 ? "the caller is blocked here, from t=0 to t=10" : "the caller is blocked here for 10 ns, on each call" },
        ],
      },
    ],
    processes: [
      {
        id: "main",
        label: "initial",
        body: [
          {
            kind: "fork",
            key: "dir-fork",
            branches: [[callStmt("dir-call")], [{ ...delay(5, display("t=%0d  during: v_in=%0d v_out=%0d v_io=%0d v_ref=%0d", now, v("v_in"), v("v_out"), v("v_io"), v("v_ref"))), key: "dir-during" }]],
          },
          after("dir-after"),
          ...(calls === 2 ? [callStmt("dir-call-2"), after("dir-after-2")] : []),
        ],
      },
    ],
  };
}

export interface DirectionsSummary {
  /** The caller's four variables at the "during" print (t = 5 ns). */
  during: Record<string, Value>;
  /** The caller's four variables at the first "after" print (t = 10 ns). */
  after: Record<string, Value>;
  /** After the second call, when the bench makes one. */
  afterSecond?: Record<string, Value>;
}

const pickGlobals = (step: SubStep | undefined, names: string[]) => Object.fromEntries(names.map((n) => [n, step?.globals[n] ?? "X"]));

/** The caller's values at the lesson's two prints, read from the trace. */
export function directionsSummary(run: SubroutineRun): DirectionsSummary {
  const names = Object.values(DIR_ACTUALS);
  const prints = run.trace.filter((s) => s.kind === "print");
  const during = prints.find((s) => s.lineKey === "dir-during");
  const after = prints.find((s) => s.lineKey === "dir-after");
  const afterSecond = prints.find((s) => s.lineKey === "dir-after-2");
  return { during: pickGlobals(during, names), after: pickGlobals(after, names), afterSecond: afterSecond ? pickGlobals(afterSecond, names) : undefined };
}

export interface PulseOptions {
  lifetime: Lifetime;
  direction: Direction;
  nba?: boolean;
}

/** The kata's pulse(busy) on its own: output versus ref seen through `always @(busy)`. */
export function pulseBench({ lifetime, direction, nba = false }: PulseOptions): Bench {
  return {
    id: `pulse:${lifetime}:${direction}${nba ? ":nba" : ""}`,
    title: "pulse(busy): output versus ref",
    globals: [{ name: "busy", type: "logic", init: 0, initLabel: "1'b0", key: "busy-decl" }],
    subs: [pulseDef(lifetime, direction, nba)],
    watchers: [{ variable: "busy", format: "t=%0d busy=%b", key: "busy-watch" }],
    processes: [{ id: "main", label: "initial", body: [{ ...delay(13, call("pulse", v("busy"))), key: "pulse-call" }] }],
  };
}

function pulseDef(lifetime: Lifetime, direction: Direction, nba: boolean): SubroutineDef {
  return {
    name: "pulse",
    kind: "task",
    lifetime,
    comment: "Raises flag for 10 ns.",
    formals: [{ name: "flag", direction, type: "logic" }],
    locals: [],
    body: [
      { ...assign("flag", c(1, "1'b1"), nba), key: "pulse-high" },
      { ...delay(10, assign("flag", c(0, "1'b0"), nba)), key: "pulse-low" },
    ],
  };
}

/* ---------- the kata ---------- */

export type KataSub = "log_after" | "sum_to" | "pulse";
export type KataFix = "none" | "automatic" | "ref" | "nba" | "return-type";
export type KataFixes = Record<KataSub, KataFix>;

export const KATA_SUBS: readonly KataSub[] = ["log_after", "sum_to", "pulse"];
export const KATA_FIXES: readonly KataFix[] = ["none", "automatic", "ref", "nba", "return-type"];
export const KATA_FIX_LABELS: Record<KataFix, string> = {
  none: "no change",
  automatic: "add automatic",
  ref: "ref instead of output",
  nba: "use <= for the write",
  "return-type": "add a return type",
};
export const NO_KATA_FIXES: KataFixes = { log_after: "none", sum_to: "none", pulse: "none" };
export const KATA_SOLUTION: KataFixes = { log_after: "automatic", sum_to: "automatic", pulse: "ref" };

export const KATA_BUGGY_LOG: readonly string[] = ["t=10 second", "t=12 second", "sum_to(3) = 0"];
export const KATA_EXPECTED_LOG: readonly string[] = ["t=10 first", "t=12 second", "sum_to(3) = 6", "t=13 busy=1", "t=23 busy=0"];

export interface KataSymptom {
  id: string;
  /** What the log shows. */
  observed: string;
  expected: string;
  /** Line key of the declaration at fault. */
  suspect: string;
  sub: KataSub;
  why: string;
  clause: string;
}

export const KATA_SYMPTOMS: readonly KataSymptom[] = [
  {
    id: "second-twice",
    observed: "t=10 second",
    expected: "t=10 first",
    suspect: "sub:log_after",
    sub: "log_after",
    why: "log_after has no lifetime keyword, so it is static: one msg shared by both calls. Call 2 copies \"second\" into it at t = 2 ns while call 1 is still waiting, so call 1 prints \"second\" at t = 10 ns.",
    clause: "§13.3.2",
  },
  {
    id: "sum-zero",
    observed: "sum_to(3) = 0",
    expected: "sum_to(3) = 6",
    suspect: "sub:sum_to",
    sub: "sum_to",
    why: "sum_to is static and recursive. Each level reads n after its recursive call returned, and by then the innermost call has set the shared n to 0, so every level returns 0 + 0.",
    clause: "§13.4.2",
  },
  {
    id: "no-busy",
    observed: "(no busy lines)",
    expected: "t=13 busy=1, t=23 busy=0",
    suspect: "sub:pulse",
    sub: "pulse",
    why: "pulse writes an output. An output reaches the caller once, at the return at t = 23 ns, and copies 0 into a busy that already holds 0: no change, so always @(busy) never wakes.",
    clause: "§13.3, §9.4.2",
  },
];

export interface KataSuspectLine {
  key: string;
  label: string;
  /** Diagnostic for picking this line as the cause of `symptomId`; undefined when it is the right line. */
  feedback: Record<string, string>;
}

/** Lines the learner may accuse, with a diagnosis for each wrong pairing. */
export const KATA_SUSPECTS: readonly KataSuspectLine[] = [
  {
    key: "sub:log_after",
    label: "task log_after(input int delay_ns, input string msg);",
    feedback: {
      "sum-zero": "log_after prints strings; it never touches sum_to's n or partial. The 0 comes from inside sum_to.",
      "no-busy": "log_after does not write busy. Look at the task that is supposed to.",
    },
  },
  {
    key: "log-print",
    label: "#(delay_ns) $display(\"t=%0d %s\", $time, msg);",
    feedback: {
      "second-twice": "This line prints whatever msg holds when it wakes. It is correct code; the question is why msg changed while it waited. Look at the declaration above it.",
      "sum-zero": "This line prints log_after's message; sum_to's result is printed elsewhere.",
      "no-busy": "This line never writes busy.",
    },
  },
  {
    key: "sub:sum_to",
    label: "function int sum_to(input int n);",
    feedback: {
      "second-twice": "sum_to runs at t = 12 ns, after both prints. It cannot change what log_after printed.",
      "no-busy": "sum_to returns an int and never writes busy.",
    },
  },
  {
    key: "sum-recurse",
    label: "partial = sum_to(n - 1);",
    feedback: {
      "second-twice": "This recursive call has nothing to do with log_after.",
      "sum-zero": "The recursive call is written correctly. The bug is that n is read after it, from storage the inner call overwrote: that is a lifetime problem on the declaration.",
      "no-busy": "This line never writes busy.",
    },
  },
  {
    key: "sub:pulse",
    label: "task automatic pulse(output logic flag);",
    feedback: {
      "second-twice": "pulse is automatic and runs at t = 13 ns, after both log_after prints.",
      "sum-zero": "pulse never calls sum_to.",
    },
  },
  {
    key: "busy-watch",
    label: "always @(busy) $display(\"t=%0d busy=%b\", $time, busy);",
    feedback: {
      "second-twice": "The monitor only prints busy; it does not run log_after.",
      "sum-zero": "The monitor only prints busy; it never calls sum_to.",
      "no-busy": "The monitor is correct: it wakes on every change of busy. It never printed because busy never changed. Look at how pulse delivers flag.",
    },
  },
  {
    key: "pulse-call",
    label: "#1 pulse(busy);",
    feedback: {
      "second-twice": "This call happens at t = 13 ns, after both prints.",
      "sum-zero": "This call does not involve sum_to.",
      "no-busy": "The call passes busy, which is a variable and a legal actual. The direction it is received with is the problem, and that is in the declaration.",
    },
  },
];

/** A decoy fix that changes nothing on this subroutine, explained; undefined when the fix changes the code. */
export function kataFixNote(sub: KataSub, fix: KataFix): string | undefined {
  if (fix === "none") return undefined;
  if (sub === "log_after" && fix === "nba") return "log_after assigns nothing, so there is no write to turn into <=. Nothing changes.";
  if (sub === "log_after" && fix === "return-type") return "A task has no return type. Nothing changes.";
  if (sub === "sum_to" && fix === "return-type") return "sum_to already returns int; the declared type was never the problem. Nothing changes.";
  if (sub === "pulse" && fix === "automatic") return "pulse is already automatic. Nothing changes.";
  if (sub === "pulse" && fix === "return-type") return "A task has no return type. Nothing changes.";
  return undefined;
}

/** The kata bench with the chosen fix applied to each subroutine. */
export function kataBench(fixes: KataFixes = NO_KATA_FIXES): Bench {
  const logAfter: SubroutineDef = {
    name: "log_after",
    kind: "task",
    lifetime: fixes.log_after === "automatic" ? "automatic" : "static",
    comment: "Prints msg after delay_ns.",
    formals: [
      { name: "delay_ns", direction: "input", type: "int" },
      { name: "msg", direction: fixes.log_after === "ref" ? "ref" : "input", type: "string" },
    ],
    locals: [],
    body: [{ ...delay(v("delay_ns"), display("t=%0d %s", now, v("msg"))), key: "log-print" }],
  };
  const sumTo: SubroutineDef = {
    ...sumToDef(fixes.sum_to === "automatic" ? "automatic" : "static", "sum", fixes.sum_to === "nba"),
    formals: [{ name: "n", direction: fixes.sum_to === "ref" ? "ref" : "input", type: "int" }],
  };
  const pulse = pulseDef("automatic", fixes.pulse === "ref" ? "ref" : "output", fixes.pulse === "nba");
  return {
    id: `kata:${KATA_SUBS.map((s) => fixes[s]).join(",")}`,
    title: "Kata: fix the bench that lies",
    globals: [{ name: "busy", type: "logic", init: 0, initLabel: "1'b0", key: "busy-decl" }],
    subs: [logAfter, sumTo, pulse],
    watchers: [{ variable: "busy", format: "t=%0d busy=%b", key: "busy-watch" }],
    processes: [
      {
        id: "main",
        label: "initial",
        body: [
          {
            kind: "fork",
            key: "kata-fork",
            branches: [[{ ...call("log_after", c(10), c("first")), key: "kata-first" }], [{ ...delay(2, call("log_after", c(10), c("second"))), key: "kata-second" }]],
          },
          { ...display("sum_to(3) = %0d", fcall("sum_to", c(3))), key: "kata-sum" },
          { ...delay(1, call("pulse", v("busy"))), key: "pulse-call" },
        ],
      },
    ],
  };
}

export interface KataGradeLine {
  expected?: string;
  actual?: string;
  match: boolean;
}

export interface KataGrade {
  issues: CompileIssue[];
  lines: KataGradeLine[];
  log: string[];
  passed: boolean;
  /** Decoy notes for fixes that changed nothing. */
  notes: string[];
}

/** Reruns the kata with the fixes and compares its log, line by line, with the corrected log. */
export function gradeKata(fixes: KataFixes): KataGrade {
  const bench = kataBench(fixes);
  const notes = KATA_SUBS.map((s) => kataFixNote(s, fixes[s])).filter((n): n is string => Boolean(n));
  const issues = compileBench(bench);
  if (issues.length) {
    return { issues, lines: KATA_EXPECTED_LOG.map((expected) => ({ expected, match: false })), log: [], passed: false, notes };
  }
  const run = simulateBench(bench);
  const log = run.log.map((l) => l.text);
  const count = Math.max(log.length, KATA_EXPECTED_LOG.length);
  const lines: KataGradeLine[] = [];
  for (let i = 0; i < count; i += 1) {
    const expected = KATA_EXPECTED_LOG[i];
    const actual = log[i];
    lines.push({ expected, actual, match: expected !== undefined && expected === actual });
  }
  return { issues, lines, log, passed: lines.every((l) => l.match), notes };
}
