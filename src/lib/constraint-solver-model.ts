/**
 * Exact educational model of SystemVerilog constrained randomization
 * (IEEE 1800-2023, Clause 18) for small finite domains.
 *
 * The model enumerates every combination of the random variables, so every
 * probability it reports is exact for the rules below. All clause numbers
 * were checked against the IEEE 1800-2023 text.
 *
 * Rules implemented:
 * - §18.5.9 Variable ordering: with no ordering constraints, every legal value
 *   combination is equally likely (joint-uniform).
 * - §18.5.9 `solve a before b`: changes probabilities, never the legal set.
 *   Ordered variables are chosen first, uniformly over their legal values.
 *   Unordered variables are solved with the last ordered set ("as late as
 *   possible").
 * - §18.5.3 `dist`: membership is a hard constraint. Values outside every
 *   item, or whose total weight is zero, are illegal. Nonzero weights never
 *   change satisfiability. `:=` on a range weighs the item as
 *   weight × range size, where the size counts values that other constraints
 *   exclude. `:/` gives the whole range the weight. A value listed in several
 *   items collects the weight of each.
 * - §18.5.5 `a -> b` is the Boolean `!a || b`, and §18.5.6 if-else is the
 *   equivalent pair of implications. Both sides constrain each other.
 * - §18.5.13 `soft`: discarded only when it cannot hold together with the hard
 *   constraints and the higher-priority soft constraints. §18.5.13.1: later
 *   declarations win, and inline `with` constraints beat class constraints.
 *   §18.5.13.2 `disable soft`.
 * - §18.7 inline `randomize() with {…}` constraints are added to the class
 *   constraints.
 * - §18.8 `rand_mode(0)` turns the variable into a state variable that keeps
 *   its current value.
 * - §18.9 `constraint_mode(0)` makes the solver ignore the block.
 * - §18.5.7.1 an array's size constraints are solved before its iterative
 *   (element) constraints. If the element constraints cannot hold for the
 *   chosen size, randomize() fails.
 * - §18.6.3 randomize() fails only when the constraints are infeasible. The
 *   variables then keep their previous values.
 *
 * Assumptions (also shown to learners):
 * - If a dist variable is coupled to other random variables, IEEE 1800 only
 *   requires the constraints to hold (§18.5.3). The model picks a dist item by
 *   weight among the items that still contain a legal value, then solves the
 *   rest uniformly. Tools may differ in this coupled case.
 * - Expressions use unbounded integers. Every example compares against a
 *   32-bit literal, so SystemVerilog would not truncate either.
 * - randc, `default :/` dist items, and soft constraints on array elements are
 *   not modelled.
 */

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export type VarType =
  | { kind: "bits"; width: number; signed?: boolean }
  | { kind: "enum"; typeName: string; labels: string[] };

export interface RandVarDecl {
  name: string;
  type: VarType;
}

/** `rand <elem> name[];` Its size is the pseudo-variable `name.size()`. */
export interface RandArrayDecl {
  name: string;
  elem: VarType;
  /** Enumeration cap for the size (a model limit, not SystemVerilog). */
  maxSize: number;
}

export type BinaryOp = "+" | "-" | "*" | "/" | "%" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "&&" | "||" | "->";

export interface RangeItem {
  lo: number;
  hi: number;
  /** Source spelling of a single value, e.g. an enum label or `4'hF`. */
  text?: string;
}

export type Expr =
  | { op: "const"; value: number; text?: string }
  | { op: "var"; name: string }
  | { op: "size"; array: string }
  | { op: "elem"; array: string; index: Expr }
  | { op: "not"; a: Expr }
  | { op: "inside"; a: Expr; set: RangeItem[] }
  | { op: BinaryOp; a: Expr; b: Expr };

export interface DistItem {
  lo: number;
  hi: number;
  op: ":=" | ":/";
  weight: number;
  text?: string;
}

export type ConstraintItem =
  | { kind: "expr"; expr: Expr; soft?: boolean }
  | { kind: "dist"; target: Expr; items: DistItem[]; soft?: boolean }
  | { kind: "implies"; cond: Expr; body: ConstraintItem[] }
  | { kind: "ifElse"; cond: Expr; then: ConstraintItem[]; else?: ConstraintItem[] }
  | { kind: "foreach"; array: string; index: string; body: ConstraintItem[] }
  | { kind: "solveBefore"; before: string[]; after: string[] }
  | { kind: "disableSoft"; variable: string };

export interface ConstraintBlock {
  name: string;
  items: ConstraintItem[];
}

export interface ClassModel {
  className: string;
  vars: RandVarDecl[];
  arrays?: RandArrayDecl[];
  blocks: ConstraintBlock[];
}

export interface RandomizeCall {
  /** Blocks switched off with `obj.<block>.constraint_mode(0)` (§18.9). */
  disabledBlocks?: string[];
  /** Variables switched off with `obj.<var>.rand_mode(0)` and the value they hold (§18.8). */
  stateVars?: Record<string, number>;
  /** `obj.randomize() with { … }` (§18.7). */
  inline?: ConstraintItem[];
}

export interface SolveOptions {
  /** Ignore every `solve … before` (used to show the joint-uniform alternative). */
  ignoreSolveBefore?: boolean;
  /** Add ordering pairs as if `solve a before b` were written (what-if analysis). */
  extraSolveBefore?: Array<[string, string]>;
}

// ---------------------------------------------------------------------------
// Expression helpers and a small parser for the constraint subset
// ---------------------------------------------------------------------------

export const v = (name: string): Expr => ({ op: "var", name });
export const k = (value: number, text?: string): Expr => ({ op: "const", value, text });
export const bin = (op: BinaryOp, a: Expr, b: Expr): Expr => ({ op, a, b });

const PRECEDENCE: Record<BinaryOp | "inside", number> = {
  "->": 1,
  "||": 2,
  "&&": 3,
  "==": 5,
  "!=": 5,
  "<": 6,
  "<=": 6,
  ">": 6,
  ">=": 6,
  inside: 6,
  "+": 8,
  "-": 8,
  "*": 9,
  "/": 9,
  "%": 9,
};

type Token = { t: "num"; v: number; text: string } | { t: "id"; v: string } | { t: "op"; v: string };

const OPERATORS = ["->", "<=", ">=", "==", "!=", "&&", "||", ":=", ":/", "<", ">", "+", "-", "*", "/", "%", "!", "(", ")", "{", "}", "[", "]", ":", ",", ".", ";"];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const ws = /^\s+/.exec(rest);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    const sized = /^(\d+)'([bBdDhHoO])([0-9a-fA-F_]+)/.exec(rest);
    if (sized) {
      const base = { b: 2, d: 10, h: 16, o: 8 }[sized[2].toLowerCase() as "b" | "d" | "h" | "o"];
      out.push({ t: "num", v: parseInt(sized[3].replace(/_/g, ""), base), text: sized[0] });
      i += sized[0].length;
      continue;
    }
    const num = /^\d+/.exec(rest);
    if (num) {
      out.push({ t: "num", v: Number(num[0]), text: num[0] });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => rest.startsWith(o));
    if (!op) throw new Error(`Unexpected character '${rest[0]}' in "${src}"`);
    out.push({ t: "op", v: op });
    i += op.length;
  }
  return out;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly toks: Token[],
    private readonly labels: Record<string, number>,
    private readonly src: string,
  ) {}

  done() {
    return this.pos >= this.toks.length;
  }

  private peek(): Token | undefined {
    return this.toks[this.pos];
  }

  private isOp(value: string) {
    const t = this.peek();
    return t?.t === "op" && t.v === value;
  }

  private expectOp(value: string) {
    if (!this.isOp(value)) throw new Error(`Expected '${value}' in "${this.src}"`);
    this.pos += 1;
  }

  /** A constant: number, negative number, or enum label. */
  constant(): { value: number; text?: string } {
    const t = this.peek();
    if (t?.t === "op" && t.v === "-") {
      this.pos += 1;
      const n = this.constant();
      return { value: -n.value, text: n.text ? `-${n.text}` : undefined };
    }
    if (t?.t === "num") {
      this.pos += 1;
      return { value: t.v, text: t.text === String(t.v) ? undefined : t.text };
    }
    if (t?.t === "id" && t.v in this.labels) {
      this.pos += 1;
      return { value: this.labels[t.v], text: t.v };
    }
    throw new Error(`Expected a constant in "${this.src}"`);
  }

  /** `[lo:hi]` or a single constant. */
  rangeItem(): RangeItem {
    if (this.isOp("[")) {
      this.pos += 1;
      const lo = this.constant();
      this.expectOp(":");
      const hi = this.constant();
      this.expectOp("]");
      return { lo: lo.value, hi: hi.value };
    }
    const c = this.constant();
    return { lo: c.value, hi: c.value, text: c.text };
  }

  distItems(): DistItem[] {
    const items: DistItem[] = [];
    for (;;) {
      const r = this.rangeItem();
      let op: ":=" | ":/" = ":=";
      let weight = 1;
      if (this.isOp(":=") || this.isOp(":/")) {
        op = (this.peek() as { v: ":=" | ":/" }).v;
        this.pos += 1;
        weight = this.constant().value;
      }
      items.push({ lo: r.lo, hi: r.hi, op, weight, text: r.text });
      if (!this.isOp(",")) break;
      this.pos += 1;
    }
    return items;
  }

  private primary(): Expr {
    const t = this.peek();
    if (!t) throw new Error(`Unexpected end of "${this.src}"`);
    if (t.t === "op" && t.v === "(") {
      this.pos += 1;
      const e = this.expr(0);
      this.expectOp(")");
      return e;
    }
    if (t.t === "op" && t.v === "!") {
      this.pos += 1;
      return { op: "not", a: this.primary() };
    }
    if (t.t === "op" && t.v === "-") {
      const c = this.constant();
      return { op: "const", value: c.value, text: c.text };
    }
    if (t.t === "num") {
      const c = this.constant();
      return { op: "const", value: c.value, text: c.text };
    }
    if (t.t === "id") {
      if (t.v in this.labels) {
        const c = this.constant();
        return { op: "const", value: c.value, text: c.text };
      }
      this.pos += 1;
      if (this.isOp(".")) {
        this.pos += 1;
        const method = this.peek();
        if (method?.t !== "id" || method.v !== "size") throw new Error(`Only .size() is supported in "${this.src}"`);
        this.pos += 1;
        this.expectOp("(");
        this.expectOp(")");
        return { op: "size", array: t.v };
      }
      if (this.isOp("[")) {
        this.pos += 1;
        const index = this.expr(0);
        this.expectOp("]");
        return { op: "elem", array: t.v, index };
      }
      return { op: "var", name: t.v };
    }
    throw new Error(`Unexpected '${t.v}' in "${this.src}"`);
  }

  expr(minPrec: number): Expr {
    let left = this.primary();
    for (;;) {
      const t = this.peek();
      let opName: BinaryOp | "inside" | undefined;
      if (t?.t === "op" && t.v in PRECEDENCE) opName = t.v as BinaryOp;
      else if (t?.t === "id" && t.v === "inside") opName = "inside";
      if (!opName) break;
      const prec = PRECEDENCE[opName];
      if (prec < minPrec) break;
      this.pos += 1;
      if (opName === "inside") {
        this.expectOp("{");
        const set: RangeItem[] = [];
        for (;;) {
          set.push(this.rangeItem());
          if (!this.isOp(",")) break;
          this.pos += 1;
        }
        this.expectOp("}");
        left = { op: "inside", a: left, set };
        continue;
      }
      // `->` is right-associative; the others are left-associative.
      const right = this.expr(opName === "->" ? prec : prec + 1);
      left = { op: opName, a: left, b: right };
    }
    return left;
  }
}

/** Parse a constraint expression such as `x + y < 8` or `(x == 0) -> (y == 0)`. */
export function parseExpr(src: string, labels: Record<string, number> = {}): Expr {
  const p = new Parser(tokenize(src), labels, src);
  const e = p.expr(0);
  if (!p.done()) throw new Error(`Trailing input in "${src}"`);
  return e;
}

/** Parse dist items such as `0 := 4, [1:3] :/ 4`. */
export function parseDistItems(src: string, labels: Record<string, number> = {}): DistItem[] {
  const p = new Parser(tokenize(src), labels, src);
  const items = p.distItems();
  if (!p.done()) throw new Error(`Trailing input in dist list "${src}"`);
  return items;
}

/** Authoring helpers. */
export const hard = (src: string, labels?: Record<string, number>): ConstraintItem => ({ kind: "expr", expr: parseExpr(src, labels) });
export const soft = (src: string, labels?: Record<string, number>): ConstraintItem => ({ kind: "expr", expr: parseExpr(src, labels), soft: true });
export const dist = (target: string, items: string, opts: { soft?: boolean; labels?: Record<string, number> } = {}): ConstraintItem => ({
  kind: "dist",
  target: parseExpr(target, opts.labels),
  items: parseDistItems(items, opts.labels),
  soft: opts.soft,
});
export const solveBefore = (before: string[], after: string[]): ConstraintItem => ({ kind: "solveBefore", before, after });

/** Labels of every enum declared in a class, for the parser. */
export function enumLabels(cls: ClassModel): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of cls.vars) {
    if (d.type.kind === "enum") d.type.labels.forEach((label, i) => (out[label] = i));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pretty printing (code shown to learners is generated from the AST)
// ---------------------------------------------------------------------------

function rangeText(r: { lo: number; hi: number; text?: string }) {
  return r.lo === r.hi ? (r.text ?? String(r.lo)) : `[${r.lo}:${r.hi}]`;
}

export function exprToSource(e: Expr, parentPrec = 0): string {
  switch (e.op) {
    case "const":
      return e.text ?? String(e.value);
    case "var":
      return e.name;
    case "size":
      return `${e.array}.size()`;
    case "elem":
      return `${e.array}[${exprToSource(e.index)}]`;
    case "not": {
      const inner = exprToSource(e.a, 10);
      return `!${inner}`;
    }
    case "inside": {
      const s = `${exprToSource(e.a, PRECEDENCE.inside + 1)} inside {${e.set.map(rangeText).join(", ")}}`;
      return PRECEDENCE.inside < parentPrec ? `(${s})` : s;
    }
    default: {
      const prec = PRECEDENCE[e.op];
      let s: string;
      if (e.op === "->") {
        // Parenthesize compound operands for readability, as most testbenches do.
        const side = (x: Expr) => (x.op === "var" || x.op === "const" || x.op === "not" ? exprToSource(x) : `(${exprToSource(x)})`);
        s = `${side(e.a)} -> ${side(e.b)}`;
      } else {
        s = `${exprToSource(e.a, prec)} ${e.op} ${exprToSource(e.b, prec + 1)}`;
      }
      return prec < parentPrec ? `(${s})` : s;
    }
  }
}

function distItemText(item: DistItem) {
  return `${rangeText(item)} ${item.op} ${item.weight}`;
}

export function itemToSource(item: ConstraintItem): string {
  switch (item.kind) {
    case "expr":
      return `${item.soft ? "soft " : ""}${exprToSource(item.expr)};`;
    case "dist":
      return `${item.soft ? "soft " : ""}${exprToSource(item.target)} dist { ${item.items.map(distItemText).join(", ")} };`;
    case "implies": {
      const cond = item.cond.op === "var" || item.cond.op === "not" ? exprToSource(item.cond) : `(${exprToSource(item.cond)})`;
      if (item.body.length === 1) return `${cond} -> ${itemToSource(item.body[0])}`;
      return `${cond} -> { ${item.body.map(itemToSource).join(" ")} }`;
    }
    case "ifElse": {
      const set = (items: ConstraintItem[]) => (items.length === 1 ? itemToSource(items[0]) : `{ ${items.map(itemToSource).join(" ")} }`);
      return `if (${exprToSource(item.cond)}) ${set(item.then)}${item.else ? ` else ${set(item.else)}` : ""}`;
    }
    case "foreach": {
      const body = item.body.length === 1 ? itemToSource(item.body[0]) : `{ ${item.body.map(itemToSource).join(" ")} }`;
      return `foreach (${item.array}[${item.index}]) ${body}`;
    }
    case "solveBefore":
      return `solve ${item.before.join(", ")} before ${item.after.join(", ")};`;
    case "disableSoft":
      return `disable soft ${item.variable};`;
  }
}

export function typeToSource(t: VarType): string {
  if (t.kind === "enum") return t.typeName;
  if (t.signed) {
    if (t.width === 8) return "byte";
    if (t.width === 16) return "shortint";
    if (t.width === 32) return "int";
    return `bit signed [${t.width - 1}:0]`;
  }
  return t.width === 1 ? "bit" : `bit [${t.width - 1}:0]`;
}

export interface SourceLine {
  text: string;
  /**
   * Stable key: `var:<name>`, `<block>.<i>` for a constraint item (one-line
   * blocks use `<block>.0`), `block:<name>` for a block header,
   * `rand_mode:<var>`, `constraint_mode:<block>`, `with.<i>`, or `call`.
   */
  key?: string;
}

/** SystemVerilog source for a class and one randomize() call, generated from the model data. */
export function classToSource(cls: ClassModel, call: RandomizeCall = {}, objectName = "p"): SourceLine[] {
  const lines: SourceLine[] = [];
  const typedefs = new Set<string>();
  for (const d of cls.vars) {
    if (d.type.kind === "enum" && !typedefs.has(d.type.typeName)) {
      typedefs.add(d.type.typeName);
      lines.push({ text: `typedef enum {${d.type.labels.join(", ")}} ${d.type.typeName};`, key: `typedef:${d.type.typeName}` });
    }
  }
  lines.push({ text: `class ${cls.className};`, key: "class" });
  // Group consecutive variables of the same type: `rand bit [2:0] x, y;`
  let i = 0;
  while (i < cls.vars.length) {
    const type = typeToSource(cls.vars[i].type);
    const names = [cls.vars[i].name];
    let j = i + 1;
    while (j < cls.vars.length && typeToSource(cls.vars[j].type) === type) {
      names.push(cls.vars[j].name);
      j += 1;
    }
    lines.push({ text: `  rand ${type} ${names.join(", ")};`, key: `var:${names[0]}` });
    i = j;
  }
  for (const a of cls.arrays ?? []) lines.push({ text: `  rand ${typeToSource(a.elem)} ${a.name}[];`, key: `var:${a.name}` });
  for (const b of cls.blocks) {
    if (b.items.length === 1) {
      lines.push({ text: `  constraint ${b.name} { ${itemToSource(b.items[0])} }`, key: `${b.name}.0` });
    } else {
      lines.push({ text: `  constraint ${b.name} {`, key: `block:${b.name}` });
      b.items.forEach((item, n) => lines.push({ text: `    ${itemToSource(item)}`, key: `${b.name}.${n}` }));
      lines.push({ text: "  }" });
    }
  }
  lines.push({ text: "endclass" });
  lines.push({ text: "" });
  for (const [name, value] of Object.entries(call.stateVars ?? {})) {
    lines.push({ text: `${objectName}.${name} = ${valueText(cls, name, value)}; ${objectName}.${name}.rand_mode(0);`, key: `rand_mode:${name}` });
  }
  for (const b of call.disabledBlocks ?? []) {
    lines.push({ text: `${objectName}.${b}.constraint_mode(0);`, key: `constraint_mode:${b}` });
  }
  const inline = call.inline ?? [];
  if (inline.length === 0) {
    lines.push({ text: `ok = ${objectName}.randomize();`, key: "call" });
  } else if (inline.length === 1) {
    lines.push({ text: `ok = ${objectName}.randomize() with { ${itemToSource(inline[0])} };`, key: "with.0" });
  } else {
    lines.push({ text: `ok = ${objectName}.randomize() with {`, key: "call" });
    inline.forEach((item, n) => lines.push({ text: `  ${itemToSource(item)}`, key: `with.${n}` }));
    lines.push({ text: "};" });
  }
  return lines;
}

/** Display a variable's value: enum label when the variable is an enum. */
export function valueText(cls: ClassModel, name: string, value: number): string {
  const d = cls.vars.find((x) => x.name === name);
  if (d?.type.kind === "enum") return d.type.labels[value] ?? String(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

interface EvalCtx {
  vals: number[];
  elems: Record<string, number[]>;
  loop: Record<string, number>;
}

type Compiled = (ctx: EvalCtx) => number;

function truthy(x: number) {
  return x !== 0;
}

function compileExpr(e: Expr, slots: Map<string, number>, loopVars: Set<string>, arrays: Set<string>): Compiled {
  switch (e.op) {
    case "const": {
      const value = e.value;
      return () => value;
    }
    case "var": {
      if (loopVars.has(e.name)) {
        const name = e.name;
        return (ctx) => ctx.loop[name];
      }
      const slot = slots.get(e.name);
      if (slot === undefined) throw new Error(`Unknown variable '${e.name}'`);
      return (ctx) => ctx.vals[slot];
    }
    case "size": {
      const slot = slots.get(`${e.array}.size()`);
      if (slot === undefined) throw new Error(`Unknown array '${e.array}'`);
      return (ctx) => ctx.vals[slot];
    }
    case "elem": {
      if (!arrays.has(e.array)) throw new Error(`Unknown array '${e.array}'`);
      const index = compileExpr(e.index, slots, loopVars, arrays);
      const array = e.array;
      return (ctx) => {
        const values = ctx.elems[array];
        const i = index(ctx);
        // An out-of-bounds index has no element; the model treats it as a failed constraint value.
        return values && i >= 0 && i < values.length ? values[i] : Number.NaN;
      };
    }
    case "not": {
      const a = compileExpr(e.a, slots, loopVars, arrays);
      return (ctx) => (truthy(a(ctx)) ? 0 : 1);
    }
    case "inside": {
      const a = compileExpr(e.a, slots, loopVars, arrays);
      const set = e.set;
      return (ctx) => {
        const x = a(ctx);
        return set.some((r) => x >= r.lo && x <= r.hi) ? 1 : 0;
      };
    }
    default: {
      const a = compileExpr(e.a, slots, loopVars, arrays);
      const b = compileExpr(e.b, slots, loopVars, arrays);
      switch (e.op) {
        case "+":
          return (ctx) => a(ctx) + b(ctx);
        case "-":
          return (ctx) => a(ctx) - b(ctx);
        case "*":
          return (ctx) => a(ctx) * b(ctx);
        case "/":
          return (ctx) => {
            const d = b(ctx);
            return d === 0 ? Number.NaN : Math.trunc(a(ctx) / d);
          };
        case "%":
          return (ctx) => {
            const d = b(ctx);
            return d === 0 ? Number.NaN : a(ctx) % d;
          };
        case "<":
          return (ctx) => (a(ctx) < b(ctx) ? 1 : 0);
        case "<=":
          return (ctx) => (a(ctx) <= b(ctx) ? 1 : 0);
        case ">":
          return (ctx) => (a(ctx) > b(ctx) ? 1 : 0);
        case ">=":
          return (ctx) => (a(ctx) >= b(ctx) ? 1 : 0);
        case "==":
          return (ctx) => (a(ctx) === b(ctx) ? 1 : 0);
        case "!=":
          return (ctx) => (a(ctx) !== b(ctx) ? 1 : 0);
        case "&&":
          return (ctx) => (truthy(a(ctx)) && truthy(b(ctx)) ? 1 : 0);
        case "||":
          return (ctx) => (truthy(a(ctx)) || truthy(b(ctx)) ? 1 : 0);
        case "->":
          // §18.5.5: the Boolean equivalent of a -> b is (!a || b).
          return (ctx) => (!truthy(a(ctx)) || truthy(b(ctx)) ? 1 : 0);
      }
    }
  }
  throw new Error("Unsupported expression");
}

function exprVars(e: Expr, out: Set<string>, loopVars: Set<string>, elemRefs: Set<string>) {
  switch (e.op) {
    case "const":
      return;
    case "var":
      if (!loopVars.has(e.name)) out.add(e.name);
      return;
    case "size":
      out.add(`${e.array}.size()`);
      return;
    case "elem":
      elemRefs.add(e.array);
      exprVars(e.index, out, loopVars, elemRefs);
      return;
    case "not":
    case "inside":
      exprVars(e.a, out, loopVars, elemRefs);
      return;
    default:
      exprVars(e.a, out, loopVars, elemRefs);
      exprVars(e.b, out, loopVars, elemRefs);
  }
}

/** A constraint item that can be satisfied or not, after flattening the class. */
export interface ClauseInfo {
  id: string;
  /** Block name, `with` for inline constraints, or `rand_mode` for a held state variable. */
  block: string;
  /** SystemVerilog text of the constraint. */
  source: string;
  soft: boolean;
  /** Soft priority (§18.5.13.1): a larger number wins. */
  priority: number;
  kind: "constraint" | "dist" | "state";
  /** Variables the constraint mentions directly. */
  vars: string[];
}

interface CompiledDist {
  slot: number;
  items: Array<{ lo: number; hi: number; weight: number; text: string }>;
}

interface CompiledClause extends ClauseInfo {
  phase: 1 | 2;
  test: (ctx: EvalCtx) => boolean;
  dist?: CompiledDist;
}

/** Item weight per §18.5.3: `:=` on a range multiplies by the full range size; `:/` does not. */
export function distItemWeight(item: DistItem): number {
  return item.op === ":=" ? item.weight * (item.hi - item.lo + 1) : item.weight;
}

function isSoftItem(item: ConstraintItem): boolean | "mixed" {
  switch (item.kind) {
    case "expr":
    case "dist":
      return Boolean(item.soft);
    case "implies":
    case "foreach":
      return combineSoft(item.body);
    case "ifElse":
      return combineSoft([...item.then, ...(item.else ?? [])]);
    default:
      return false;
  }
}

function combineSoft(items: ConstraintItem[]): boolean | "mixed" {
  const flags = items.map(isSoftItem);
  if (flags.some((f) => f === "mixed")) return "mixed";
  if (flags.every((f) => f === true)) return true;
  if (flags.every((f) => f === false)) return false;
  return "mixed";
}

interface CompileEnv {
  slots: Map<string, number>;
  arrays: Set<string>;
}

function compileItemTest(item: ConstraintItem, env: CompileEnv, loopVars: Set<string>): (ctx: EvalCtx) => boolean {
  switch (item.kind) {
    case "expr": {
      const f = compileExpr(item.expr, env.slots, loopVars, env.arrays);
      return (ctx) => truthy(f(ctx));
    }
    case "dist":
      throw new Error("dist is only modelled at the top level of a constraint block");
    case "implies": {
      const cond = compileExpr(item.cond, env.slots, loopVars, env.arrays);
      const body = item.body.map((b) => compileItemTest(b, env, loopVars));
      // §18.5.5: a -> {b} is (!a || b).
      return (ctx) => !truthy(cond(ctx)) || body.every((t) => t(ctx));
    }
    case "ifElse": {
      const cond = compileExpr(item.cond, env.slots, loopVars, env.arrays);
      const thenTests = item.then.map((b) => compileItemTest(b, env, loopVars));
      const elseTests = (item.else ?? []).map((b) => compileItemTest(b, env, loopVars));
      // §18.5.6: if (c) A else B is (c -> A) && (!c -> B).
      return (ctx) => (truthy(cond(ctx)) ? thenTests.every((t) => t(ctx)) : elseTests.every((t) => t(ctx)));
    }
    case "foreach": {
      const sizeSlot = env.slots.get(`${item.array}.size()`);
      if (sizeSlot === undefined) throw new Error(`foreach over unknown array '${item.array}'`);
      const inner = new Set(loopVars);
      inner.add(item.index);
      const body = item.body.map((b) => compileItemTest(b, env, inner));
      const index = item.index;
      return (ctx) => {
        const n = ctx.vals[sizeSlot];
        for (let i = 0; i < n; i += 1) {
          ctx.loop[index] = i;
          if (!body.every((t) => t(ctx))) return false;
        }
        return true;
      };
    }
    default:
      throw new Error(`${item.kind} cannot appear inside another constraint`);
  }
}

function itemVars(item: ConstraintItem, loopVars: Set<string>, out: Set<string>, elemRefs: Set<string>, softOnly: boolean) {
  switch (item.kind) {
    case "expr":
      if (!softOnly || item.soft) exprVars(item.expr, out, loopVars, elemRefs);
      return;
    case "dist":
      exprVars(item.target, out, loopVars, elemRefs);
      return;
    case "implies":
      // §18.5.13.2: `p -> soft q` mentions q directly, not p.
      if (!softOnly) exprVars(item.cond, out, loopVars, elemRefs);
      item.body.forEach((b) => itemVars(b, loopVars, out, elemRefs, softOnly));
      return;
    case "ifElse":
      if (!softOnly) exprVars(item.cond, out, loopVars, elemRefs);
      [...item.then, ...(item.else ?? [])].forEach((b) => itemVars(b, loopVars, out, elemRefs, softOnly));
      return;
    case "foreach": {
      const inner = new Set(loopVars);
      inner.add(item.index);
      elemRefs.add(item.array);
      out.add(`${item.array}.size()`);
      item.body.forEach((b) => itemVars(b, inner, out, elemRefs, softOnly));
      return;
    }
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export function domainOf(t: VarType): number[] {
  if (t.kind === "enum") return t.labels.map((_, i) => i);
  if (t.width > 16) throw new Error("The enumeration model supports at most 16-bit variables");
  const n = 2 ** t.width;
  const lo = t.signed ? -(n / 2) : 0;
  return Array.from({ length: n }, (_, i) => lo + i);
}

const MAX_COMBINATIONS = 1 << 18;
const MAX_CLAUSES = 32;

// ---------------------------------------------------------------------------
// Solving
// ---------------------------------------------------------------------------

export interface Solution {
  key: string;
  values: Record<string, number>;
  /** Exact probability that randomize() returns this solution. */
  probability: number;
  /** Number of ways to fill the arrays for this size choice (when arrays exist). */
  elementCompletions?: number;
}

export interface DroppedSoft {
  clause: ClauseInfo;
  reason: "hard" | "higher-priority" | "disable-soft";
  /**
   * The constraints that rule it out: a minimal set of hard constraints
   * (reason "hard") or of higher-priority soft constraints ("higher-priority").
   */
  conflictsWith: string[];
}

export interface CoreMember {
  clause: ClauseInfo;
  /** True when switching off this constraint alone makes randomize() succeed. */
  removalFixes: boolean;
}

export interface SolveResult {
  status: "ok" | "unsat";
  /** Variable names in slot order (scalars, then `arr.size()`). */
  variables: string[];
  domains: Record<string, number[]>;
  totalCombinations: number;
  /** Combinations that satisfy every hard constraint. */
  hardLegalCount: number;
  /** Combinations that also satisfy the kept soft constraints: the final solution space. */
  solutions: Solution[];
  clauses: ClauseInfo[];
  keptSoft: ClauseInfo[];
  droppedSoft: DroppedSoft[];
  /** A minimal unsatisfiable subset of the hard constraints (§18.6.3 failure), when unsat. */
  core: CoreMember[];
  /** Probability that randomize() fails after the size was chosen (§18.5.7.1). */
  failureProbability: number;
  /** Variable groups in solving order (§18.5.9). One group means joint-uniform. */
  stages: string[][];
  /** dist constraints that shaped the probabilities. */
  appliedDists: ClauseInfo[];
}

/** Variable groups in solving order from `solve…before` pairs (§18.5.9, "as late as possible"). */
export function solveOrderStages(pairs: Array<[string, string]>, variables: string[]): string[][] {
  const succ = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    if (!succ.has(a)) succ.set(a, new Set());
    succ.get(a)?.add(b);
  }
  const height = new Map<string, number>();
  const visiting = new Set<string>();
  const h = (x: string): number => {
    const known = height.get(x);
    if (known !== undefined) return known;
    if (visiting.has(x)) throw new Error(`Circular solve…before ordering involving '${x}' (§18.5.9)`);
    visiting.add(x);
    let best = 0;
    for (const y of succ.get(x) ?? []) best = Math.max(best, h(y) + 1);
    visiting.delete(x);
    height.set(x, best);
    return best;
  };
  const top = variables.reduce((m, x) => Math.max(m, h(x)), 0);
  const layers: string[][] = Array.from({ length: top + 1 }, () => []);
  for (const x of variables) layers[top - h(x)].push(x);
  return layers.filter((l) => l.length > 0);
}

/** Exact solution space and probabilities for one randomize() call. */
export function solve(cls: ClassModel, call: RandomizeCall = {}, options: SolveOptions = {}): SolveResult {
  const arrays = cls.arrays ?? [];
  const variables = [...cls.vars.map((d) => d.name), ...arrays.map((a) => `${a.name}.size()`)];
  const slots = new Map(variables.map((name, i) => [name, i] as [string, number]));
  const domains: Record<string, number[]> = {};
  cls.vars.forEach((d) => (domains[d.name] = domainOf(d.type)));
  arrays.forEach((a) => (domains[`${a.name}.size()`] = Array.from({ length: a.maxSize + 1 }, (_, i) => i)));
  const env: CompileEnv = { slots, arrays: new Set(arrays.map((a) => a.name)) };

  const disabled = new Set(call.disabledBlocks ?? []);
  for (const b of disabled) {
    if (!cls.blocks.some((x) => x.name === b)) throw new Error(`constraint_mode on unknown block '${b}' (§18.9)`);
  }
  const stateVars = call.stateVars ?? {};
  for (const name of Object.keys(stateVars)) {
    if (!cls.vars.some((d) => d.name === name)) throw new Error(`rand_mode on unknown variable '${name}' (§18.8)`);
  }

  // Flatten blocks in priority order: class blocks in declaration order, then inline (§18.5.13.1).
  const sources: Array<{ block: string; id: string; item: ConstraintItem }> = [];
  for (const b of cls.blocks) {
    if (disabled.has(b.name)) continue;
    b.items.forEach((item, n) => sources.push({ block: b.name, id: `${b.name}.${n}`, item }));
  }
  (call.inline ?? []).forEach((item, n) => sources.push({ block: "with", id: `with.${n}`, item }));

  const clauses: CompiledClause[] = [];
  const orderPairs: Array<[string, string]> = [];
  const disableSofts: Array<{ variable: string; priority: number }> = [];

  // rand_mode(0): the variable keeps its value (§18.8). Modelled as a pin so it can appear in a conflict.
  for (const [name, value] of Object.entries(stateVars)) {
    const slot = slots.get(name) as number;
    clauses.push({
      id: `rand_mode:${name}`,
      block: "rand_mode",
      source: `${name} stays ${valueText(cls, name, value)} (${name}.rand_mode(0))`,
      soft: false,
      priority: -1,
      kind: "state",
      vars: [name],
      phase: 1,
      test: (ctx) => ctx.vals[slot] === value,
    });
  }

  sources.forEach(({ block, id, item }, priority) => {
    if (item.kind === "solveBefore") {
      for (const a of item.before) for (const b of item.after) orderPairs.push([a, b]);
      return;
    }
    if (item.kind === "disableSoft") {
      disableSofts.push({ variable: item.variable, priority });
      return;
    }
    const softFlag = isSoftItem(item);
    if (softFlag === "mixed") throw new Error(`Constraint ${id} mixes soft and hard parts; split it into separate items`);
    const vars = new Set<string>();
    const elemRefs = new Set<string>();
    itemVars(item, new Set(), vars, elemRefs, false);
    const directVars = new Set<string>();
    itemVars(item, new Set(), directVars, new Set(), softFlag);
    for (const name of vars) if (!slots.has(name)) throw new Error(`Unknown variable '${name}' in ${id}`);
    const phase: 1 | 2 = elemRefs.size > 0 ? 2 : 1;
    if (phase === 2 && softFlag) throw new Error(`Soft constraints on array elements are not modelled (${id})`);
    const base = {
      id,
      block,
      source: itemToSource(item),
      soft: softFlag,
      priority,
      vars: [...directVars],
      phase,
    };
    if (item.kind === "dist") {
      if (item.target.op !== "var" && item.target.op !== "size") throw new Error(`dist target must be a variable (${id})`);
      const targetName = item.target.op === "var" ? item.target.name : `${item.target.array}.size()`;
      const slot = slots.get(targetName) as number;
      // Membership (§18.5.3): legal values are those in an item whose accumulated weight is nonzero.
      const weighted = item.items.map((it) => ({ lo: it.lo, hi: it.hi, weight: distItemWeight(it), text: distItemText(it) }));
      const member = (x: number) => weighted.some((it) => it.weight > 0 && x >= it.lo && x <= it.hi);
      clauses.push({ ...base, kind: "dist", test: (ctx) => member(ctx.vals[slot]), dist: { slot, items: weighted } });
      return;
    }
    clauses.push({ ...base, kind: "constraint", test: compileItemTest(item, env, new Set()) });
  });

  const phase1 = clauses.filter((c) => c.phase === 1);
  const phase2 = clauses.filter((c) => c.phase === 2);
  if (phase1.length > MAX_CLAUSES) throw new Error(`The model handles at most ${MAX_CLAUSES} constraints`);

  // Enumerate every combination of the scalar variables and array sizes.
  const radices = variables.map((name) => domains[name].length);
  const total = radices.reduce((a, b) => a * b, 1);
  if (total > MAX_COMBINATIONS) throw new Error(`Too many combinations to enumerate (${total})`);
  const nv = variables.length;
  const tuples = new Int32Array(total * nv);
  const masks = new Int32Array(total);
  const ctx: EvalCtx = { vals: new Array(nv).fill(0), elems: {}, loop: {} };
  const digits = new Array(nv).fill(0);
  for (let t = 0; t < total; t += 1) {
    for (let s = 0; s < nv; s += 1) {
      const value = domains[variables[s]][digits[s]];
      ctx.vals[s] = value;
      tuples[t * nv + s] = value;
    }
    let mask = 0;
    for (let c = 0; c < phase1.length; c += 1) if (phase1[c].test(ctx)) mask |= 1 << c;
    masks[t] = mask;
    for (let s = nv - 1; s >= 0; s -= 1) {
      digits[s] += 1;
      if (digits[s] < radices[s]) break;
      digits[s] = 0;
    }
  }

  const bitOf = (id: string) => 1 << phase1.findIndex((c) => c.id === id);
  const satisfiable = (req: number) => {
    for (let t = 0; t < total; t += 1) if ((masks[t] & req) === req) return true;
    return false;
  };
  const maskOf = (list: CompiledClause[]) => list.reduce((m, c) => m | bitOf(c.id), 0);
  const info = (c: CompiledClause): ClauseInfo => ({
    id: c.id,
    block: c.block,
    source: c.source,
    soft: c.soft,
    priority: c.priority,
    kind: c.kind,
    vars: c.vars,
  });

  const hardClauses = phase1.filter((c) => !c.soft);
  const hardMask = maskOf(hardClauses);
  const baseResult = {
    variables,
    domains,
    totalCombinations: total,
    clauses: clauses.map(info),
  };

  if (!satisfiable(hardMask)) {
    // Deletion-based minimal unsatisfiable subset: drop each constraint the conflict does not need.
    let core = [...hardClauses];
    for (const c of hardClauses) {
      const without = core.filter((x) => x !== c);
      if (!satisfiable(maskOf(without))) core = without;
    }
    return {
      ...baseResult,
      status: "unsat",
      hardLegalCount: 0,
      solutions: [],
      keptSoft: [],
      droppedSoft: [],
      core: core.map((c) => ({ clause: info(c), removalFixes: satisfiable(hardMask & ~bitOf(c.id)) })),
      failureProbability: 1,
      stages: [],
      appliedDists: [],
    };
  }

  // Soft constraints (§18.5.13, §18.5.13.1): highest priority first, keep each one that still fits.
  const softs = phase1.filter((c) => c.soft);
  const dropped: DroppedSoft[] = [];
  const candidates = softs.filter((s) => {
    const killer = disableSofts.find((d) => d.priority > s.priority && s.vars.includes(d.variable));
    if (killer) dropped.push({ clause: info(s), reason: "disable-soft", conflictsWith: [] });
    return !killer;
  });
  candidates.sort((a, b) => b.priority - a.priority);
  const kept: CompiledClause[] = [];
  let keptMask = hardMask;
  for (const s of candidates) {
    if (satisfiable(keptMask | bitOf(s.id))) {
      kept.push(s);
      keptMask |= bitOf(s.id);
      continue;
    }
    if (!satisfiable(hardMask | bitOf(s.id))) {
      let hardBlockers = [...hardClauses];
      for (const x of hardClauses) {
        const without = hardBlockers.filter((y) => y !== x);
        if (!satisfiable(bitOf(s.id) | maskOf(without))) hardBlockers = without;
      }
      dropped.push({ clause: info(s), reason: "hard", conflictsWith: hardBlockers.map((b) => b.id) });
      continue;
    }
    let blockers = [...kept];
    for (const x of kept) {
      const without = blockers.filter((y) => y !== x);
      if (!satisfiable(hardMask | bitOf(s.id) | maskOf(without))) blockers = without;
    }
    dropped.push({ clause: info(s), reason: "higher-priority", conflictsWith: blockers.map((b) => b.id) });
  }

  const legal: number[] = [];
  let hardLegalCount = 0;
  for (let t = 0; t < total; t += 1) {
    if ((masks[t] & hardMask) === hardMask) hardLegalCount += 1;
    if ((masks[t] & keptMask) === keptMask) legal.push(t);
  }

  // Probability distribution over the final space.
  const ruling = [...hardClauses, ...kept].sort((a, b) => a.priority - b.priority);
  const dists = ruling.filter((c) => c.dist);
  const orderable = variables.filter((name) => !(name in stateVars));
  const pairs: Array<[string, string]> = options.ignoreSolveBefore ? [] : [...orderPairs, ...(options.extraSolveBefore ?? [])];
  for (const [a, b] of pairs) {
    for (const name of [a, b]) if (!slots.has(name)) throw new Error(`solve…before names unknown variable '${name}'`);
  }
  const usable = pairs.filter(([a, b]) => !(a in stateVars) && !(b in stateVars));
  const stages = solveOrderStages(usable, orderable);
  const lastStage = stages[stages.length - 1] ?? [];
  for (const name of variables) if (name in stateVars) lastStage.push(name);
  if (stages.length === 0) stages.push(lastStage);

  const probs = new Float64Array(total);
  const valueAt = (t: number, slot: number) => tuples[t * nv + slot];

  const run = (rows: number[], stageIndex: number, p: number) => {
    if (p === 0 || rows.length === 0) return;
    if (stageIndex === stages.length) {
      const share = p / rows.length;
      for (const t of rows) probs[t] += share;
      return;
    }
    const stageSlots = stages[stageIndex].map((name) => slots.get(name) as number);
    const stageDists = dists.filter((d) => stageSlots.includes((d.dist as CompiledDist).slot));
    applyDists(rows, stageDists, 0, p, (subset, q) => {
      const groups = new Map<string, number[]>();
      for (const t of subset) {
        const key = stageSlots.map((s) => valueAt(t, s)).join(",");
        const g = groups.get(key);
        if (g) g.push(t);
        else groups.set(key, [t]);
      }
      const share = q / groups.size;
      for (const g of groups.values()) run(g, stageIndex + 1, share);
    });
  };

  // §18.5.3: choose a dist item by weight among those that still contain a legal value.
  const applyDists = (rows: number[], list: CompiledClause[], index: number, p: number, next: (rows: number[], p: number) => void) => {
    if (index === list.length) {
      next(rows, p);
      return;
    }
    const d = list[index].dist as CompiledDist;
    const choices = d.items
      .filter((it) => it.weight > 0)
      .map((it) => ({ it, rows: rows.filter((t) => valueAt(t, d.slot) >= it.lo && valueAt(t, d.slot) <= it.hi) }))
      .filter((o) => o.rows.length > 0);
    const totalWeight = choices.reduce((sum, o) => sum + o.it.weight, 0);
    for (const o of choices) applyDists(o.rows, list, index + 1, (p * o.it.weight) / totalWeight, next);
  };

  run(legal, 0, 1);

  // §18.5.7.1: elements are solved after the size; count completions per chosen size.
  let failureProbability = 0;
  const completionsFor = (t: number): number | undefined => {
    if (arrays.length === 0) return undefined;
    const sizes = arrays.map((a) => valueAt(t, slots.get(`${a.name}.size()`) as number));
    if (phase2.length === 0) return arrays.reduce((prod, a, i) => prod * domainOf(a.elem).length ** sizes[i], 1);
    const cells = arrays.flatMap((a, i) => Array.from({ length: sizes[i] }, (_, j) => ({ array: a.name, j, dom: domainOf(a.elem) })));
    const count = cells.reduce((prod, c) => prod * c.dom.length, 1);
    if (count > MAX_COMBINATIONS) throw new Error("Too many array element combinations to enumerate");
    const local: EvalCtx = { vals: variables.map((_, s) => valueAt(t, s)), elems: {}, loop: {} };
    arrays.forEach((a, i) => (local.elems[a.name] = new Array(sizes[i]).fill(0)));
    let ok = 0;
    for (let n = 0; n < count; n += 1) {
      let rest = n;
      for (const c of cells) {
        local.elems[c.array][c.j] = c.dom[rest % c.dom.length];
        rest = Math.floor(rest / c.dom.length);
      }
      if (phase2.every((c) => c.test(local))) ok += 1;
    }
    return ok;
  };

  const solutions: Solution[] = legal.map((t) => {
    const values: Record<string, number> = {};
    variables.forEach((name, s) => (values[name] = valueAt(t, s)));
    const elementCompletions = completionsFor(t);
    let probability = probs[t];
    if (elementCompletions === 0) {
      failureProbability += probability;
      probability = 0;
    }
    return { key: variables.map((_, s) => valueAt(t, s)).join(","), values, probability, elementCompletions };
  });

  return {
    ...baseResult,
    status: "ok",
    hardLegalCount,
    solutions,
    keptSoft: kept.map(info),
    droppedSoft: dropped,
    core: [],
    failureProbability,
    stages: stages.map((s) => [...s]),
    appliedDists: dists.map(info),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** P(name = value) for every value of the variable's domain. */
export function marginal(result: SolveResult, name: string): Map<number, number> {
  const out = new Map<number, number>((result.domains[name] ?? []).map((x) => [x, 0] as [number, number]));
  for (const s of result.solutions) out.set(s.values[name], (out.get(s.values[name]) ?? 0) + s.probability);
  return out;
}

export function probabilityOf(result: SolveResult, predicate: (values: Record<string, number>) => boolean): number {
  return result.solutions.reduce((sum, s) => sum + (predicate(s.values) ? s.probability : 0), 0);
}

/** Values of `name` that appear in at least one legal solution. */
export function legalValues(result: SolveResult, name: string): number[] {
  return [...new Set(result.solutions.map((s) => s.values[name]))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Seeded sampling ("run randomize() N times")
// ---------------------------------------------------------------------------

/** mulberry32: a small deterministic PRNG so sampled histograms are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleResult {
  runs: number;
  /** Count per solution key. */
  counts: Map<string, number>;
  /** Calls that returned 0. */
  failures: number;
}

/** Draw `runs` outcomes from the exact distribution with a seeded PRNG. */
export function sampleRandomize(result: SolveResult, runs: number, seed: number): SampleResult {
  const rng = mulberry32(seed);
  const outcomes = result.solutions.filter((s) => s.probability > 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const s of outcomes) {
    acc += s.probability;
    cumulative.push(acc);
  }
  const counts = new Map<string, number>();
  let failures = 0;
  for (let i = 0; i < runs; i += 1) {
    const u = rng();
    if (outcomes.length === 0 || u >= acc) {
      failures += 1;
      continue;
    }
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (u < cumulative[mid]) hi = mid;
      else lo = mid + 1;
    }
    const key = outcomes[lo].key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { runs, counts, failures };
}

/** Sampled count per value of one variable. */
export function sampledMarginal(result: SolveResult, sample: SampleResult, name: string): Map<number, number> {
  const out = new Map<number, number>((result.domains[name] ?? []).map((x) => [x, 0] as [number, number]));
  for (const s of result.solutions) {
    const n = sample.counts.get(s.key) ?? 0;
    if (n > 0) out.set(s.values[name], (out.get(s.values[name]) ?? 0) + n);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Best rational approximation with a small denominator, e.g. 0.0769… → "1/13". */
export function toFraction(p: number, maxDenominator = 2000): string {
  if (p <= 0) return "0";
  if (p >= 1) return "1";
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = p;
  for (let i = 0; i < 32; i += 1) {
    const a = Math.floor(x);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDenominator) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(p - h1 / k1) < 1e-12) break;
    const frac = x - a;
    if (frac < 1e-12) break;
    x = 1 / frac;
  }
  return `${h1}/${k1}`;
}

/** "22.2%" with one decimal, "<0.1%" for tiny nonzero values. */
export function formatPercent(p: number, digits = 1): string {
  if (p > 0 && p < 0.5 * 10 ** -digits / 100) return `<${(10 ** -digits).toFixed(digits)}%`;
  return `${(p * 100).toFixed(digits)}%`;
}
