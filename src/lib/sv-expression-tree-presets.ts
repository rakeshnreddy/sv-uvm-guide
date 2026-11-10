/**
 * ExpressionTreeExplorer model: how an expression written without parentheses
 * is grouped, and how its operands are sized ("the bowl").
 *
 * Pure and deterministic (no React). Parsing, values, widths and operand roles
 * come from sv-expression-model (parseExpression, annotateTree,
 * evaluateAssignment); this file never evaluates an operator itself. It adds:
 *
 * - IEEE 1800-2023 §11.3.2, Table 11-2: the operator rows, used to explain WHY
 *   the parser grouped an expression the way it did (rank and associativity).
 *   Tests check every pair of rows against parseExpression.
 * - §11.6.1, Table 11-21 and §11.8.2: the partition of a parsed tree into
 *   "bowls" (this course's picture of a context): one context-determined region
 *   joined to the assignment target, separate bowls for self-determined
 *   operands, and a shared bowl for the two operands of a comparison.
 * - §11.6.2: the lost-carry example, as width presets taken from the lesson's
 *   trace table.
 * - §12.4: an `if` condition that is 0, x or z does not run the branch.
 *
 * Every sentence the component shows about a preset is built here from the
 * model's results, so text and model cannot disagree.
 */

import {
  annotateTree,
  bitsOf,
  buildEnv,
  declToSource,
  evaluateAssignment,
  formatCompact,
  formatDecimal,
  isKnown,
  mathIntuition,
  parseExpression,
  splitConcatTarget,
  SvExpressionError,
  toBigInt,
  truthOf,
  type AssignmentEvaluation,
  type ExprNode,
  type ExprStep,
  type NodeAnnotation,
  type SvDecl,
  type SvEnv,
  type SvValue,
} from "@/lib/sv-expression-model";

// ---------------------------------------------------------------------------
// Table 11-2 (§11.3.2): operator rows, highest precedence first
// ---------------------------------------------------------------------------

export interface PrecedenceRow {
  /** 1 = binds tightest among the rows this explorer supports. Table 11-2 itself has no numbers. */
  rank: number;
  /** The operators of the row as Table 11-2 lists them. */
  label: string;
  associativity: "left" | "right" | "none";
  operators: string[];
}

/**
 * The rows of Table 11-2 that parseExpression supports (§11.3.2). The `()`
 * row, `->`/`<->`, `dist`, the assignment operators and `{}` are not part of
 * the explorer; EXCLUDED_NOTE says so to the learner.
 */
export const PRECEDENCE_ROWS: PrecedenceRow[] = [
  { rank: 1, label: "unary + - ! ~ & ~& | ~| ^ ~^ ^~", associativity: "none", operators: ["u+", "u-", "u!", "u~", "u&", "u~&", "u|", "u~|", "u^", "u~^"] },
  { rank: 2, label: "**", associativity: "left", operators: ["**"] },
  { rank: 3, label: "* / %", associativity: "left", operators: ["*", "/", "%"] },
  { rank: 4, label: "+ - (binary)", associativity: "left", operators: ["+", "-"] },
  { rank: 5, label: "<< >> <<< >>>", associativity: "left", operators: ["<<", ">>", "<<<", ">>>"] },
  { rank: 6, label: "< <= > >= inside dist", associativity: "left", operators: ["<", "<=", ">", ">=", "inside"] },
  { rank: 7, label: "== != === !== ==? !=?", associativity: "left", operators: ["==", "!=", "===", "!==", "==?", "!=?"] },
  { rank: 8, label: "& (binary)", associativity: "left", operators: ["&"] },
  { rank: 9, label: "^ ~^ ^~ (binary)", associativity: "left", operators: ["^", "~^"] },
  { rank: 10, label: "| (binary)", associativity: "left", operators: ["|"] },
  { rank: 11, label: "&&", associativity: "left", operators: ["&&"] },
  { rank: 12, label: "||", associativity: "left", operators: ["||"] },
  { rank: 13, label: "?: (conditional operator)", associativity: "right", operators: ["?:"] },
];

export const EXCLUDED_NOTE =
  "Table 11-2 also lists ->, <-> and dist, the assignment operators and ++ / --; this explorer does not parse them.";

/**
 * Inputs the explorer refuses with EXCLUDED_NOTE. `++` and `--` are the
 * increment and decrement operators (§11.4.2, unary row of Table 11-2), not
 * two signs, so `--a` is a pre-decrement and `a--b` is not `a - (-b)`. With a
 * space between the signs (`- -a`, `a - -b`) they are two operators and parse.
 */
export const EXCLUDED_PATTERN = /->|<->|\bdist\b|\+\+|--/;

/** Key into PRECEDENCE_ROWS for a node: unary operators are prefixed "u". */
function opKey(n: ExprNode): string | null {
  if (n.kind === "binary") return n.op;
  if (n.kind === "unary") return `u${n.op}`;
  if (n.kind === "cond") return "?:";
  if (n.kind === "inside") return "inside";
  return null;
}

export function rowOf(n: ExprNode): PrecedenceRow | null {
  const key = opKey(n);
  return key ? (PRECEDENCE_ROWS.find((r) => r.operators.includes(key)) ?? null) : null;
}

export function rowOfOperator(op: string, unary = false): PrecedenceRow | null {
  const key = unary ? `u${op === "^~" ? "~^" : op}` : op === "^~" ? "~^" : op;
  return PRECEDENCE_ROWS.find((r) => r.operators.includes(key)) ?? null;
}

/** Spellings the source may use for a model operator (Table 11-2 lists ~^ and ^~ as one operator). */
const SPELLINGS: Record<string, string[]> = { "~^": ["~^", "^~"] };

/**
 * The operator of a binary or unary node as the source spells it. The parser
 * stores `^~` as `~^`; the learner sees back the spelling they typed.
 */
export function spelledOp(n: ExprNode): string {
  if (n.kind === "binary") {
    const rest = n.text.slice(n.left.text.length).trimStart();
    return (SPELLINGS[n.op] ?? [n.op]).find((sp) => rest.startsWith(sp)) ?? n.op;
  }
  if (n.kind === "unary") return (SPELLINGS[n.op] ?? [n.op]).find((sp) => n.text.startsWith(sp)) ?? n.op;
  return "";
}

/** The symbol shown for an operator node, in the source's spelling. */
export function operatorSymbol(n: ExprNode): string {
  switch (n.kind) {
    case "binary":
    case "unary":
      return spelledOp(n);
    case "cond":
      return "?:";
    case "inside":
      return "inside";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/** Children in the order annotateTree numbers them ("r.0", "r.1", ...). */
export function astChildren(n: ExprNode): ExprNode[] {
  switch (n.kind) {
    case "paren":
      return [n.inner];
    case "unary":
    case "cast":
      return [n.arg];
    case "sysfn":
      return [n.arg, ...(n.controls ?? [])];
    case "binary":
      return [n.left, n.right];
    case "cond":
      return [n.cond, n.then, n.otherwise];
    case "concat":
    case "repl":
    case "stream":
      return n.parts;
    case "inside":
      return [n.left, ...n.items.flatMap((it) => (it.kind === "value" ? [it.expr] : [it.lo, it.hi]))];
    default:
      return [];
  }
}

const isLeaf = (n: ExprNode) => n.kind === "num" || n.kind === "ref" || n.kind === "select";
const unwrap = (n: ExprNode): ExprNode => (n.kind === "paren" ? unwrap(n.inner) : n);

/** Index the AST by annotateTree's path ids. */
export function astById(ast: ExprNode): Map<string, ExprNode> {
  const out = new Map<string, ExprNode>();
  const walk = (n: ExprNode, id: string) => {
    out.set(id, n);
    astChildren(n).forEach((c, i) => walk(c, `${id}.${i}`));
  };
  walk(ast, "r");
  return out;
}

/**
 * The grouping the parser built, with every operator's operands made explicit:
 * `flags & mask == 0` → `flags & (mask == 0)`, `a < b inside {c}` →
 * `(a < b) inside {c}`. Parentheses already in the source are kept; constructs
 * with their own delimiters are shown as written. Operators keep the source's
 * spelling (`^~` stays `^~`).
 */
export function fullGrouping(n: ExprNode): string {
  const g = (c: ExprNode): string => {
    if (isLeaf(c)) return c.text;
    if (c.kind === "paren") return `(${fullGrouping(c.inner)})`;
    if (c.kind === "concat" || c.kind === "repl" || c.kind === "stream" || c.kind === "sysfn" || c.kind === "cast") return fullGrouping(c);
    return `(${fullGrouping(c)})`;
  };
  switch (n.kind) {
    case "paren":
      return `(${fullGrouping(n.inner)})`;
    case "binary":
      return `${g(n.left)} ${spelledOp(n)} ${g(n.right)}`;
    case "unary":
      return `${spelledOp(n)}${g(n.arg)}`;
    case "cond":
      return `${g(n.cond)} ? ${g(n.then)} : ${g(n.otherwise)}`;
    case "concat":
      return `{${n.parts.map(fullGrouping).join(", ")}}`;
    case "inside":
      // The left operand is grouped by Table 11-2 (inside shares the row of < <= > >=);
      // the members are delimited by the braces of the open_range_list (§11.4.13).
      return `${g(n.left)} inside {${n.items.map((it) => (it.kind === "value" ? fullGrouping(it.expr) : `[${fullGrouping(it.lo)}:${fullGrouping(it.hi)}]`)).join(", ")}}`;
    default:
      return n.text;
  }
}

/** fullGrouping with one spelling per operator (`^~` written `~^`), for comparing trees. */
function canonicalGrouping(n: ExprNode): string {
  // fullGrouping parenthesizes every unary operand, so "^~" can only be the operator itself.
  return fullGrouping(n).replace(/\^~/g, "~^");
}

/**
 * Lexical tokens of an expression, without parentheses or whitespace, with
 * one spelling per operator. Maximal munch, like the parser, so `a ^ ~b` and
 * `a ^~ b`, or `~(&a)` and `~&a`, are different token sequences.
 */
function canonicalTokens(s: string): string[] {
  const re = /\s+|[A-Za-z0-9_$']+|<<<|>>>|===|!==|==\?|!=\?|==|!=|<=|>=|&&|\|\||<<|>>|~&|~\||~\^|\^~|\*\*|[^\s]/g;
  return (s.match(re) ?? []).filter((t) => !/^\s+$/.test(t) && t !== "(" && t !== ")").map((t) => (t === "^~" ? "~^" : t));
}

/** True when `b` is `a` with parentheses added or moved: the same tokens in the same order. */
export function isParenthesization(a: string, b: string): boolean {
  const ta = canonicalTokens(a);
  const tb = canonicalTokens(b);
  return ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

/** Structural identity of two groupings (parentheses around the whole expression ignored). */
export function sameGrouping(a: ExprNode, b: ExprNode): boolean {
  return canonicalGrouping(unwrap(a)) === canonicalGrouping(unwrap(b));
}

// ---------------------------------------------------------------------------
// Operator tokens in the source (for "tap the operator applied last")
// ---------------------------------------------------------------------------

export interface OperatorToken {
  /** Path id of the operator's node (annotateTree numbering). */
  nodeId: string;
  symbol: string;
  start: number;
  end: number;
}

/** Locate every binary, unary and ?: operator of `ast` in `src`, in source order. */
export function operatorTokens(src: string, ast: ExprNode): OperatorToken[] {
  const tokens: OperatorToken[] = [];
  const skipWs = (i: number) => {
    let j = i;
    while (j < src.length && /\s/.test(src[j])) j += 1;
    return j;
  };
  /** Where operator `op` starts at or after `i`, and the spelling found there. */
  const readOp = (i: number, op: string): { at: number; spelling: string } => {
    const at = skipWs(i);
    const spelling = (SPELLINGS[op] ?? [op]).find((s) => src.startsWith(s, at));
    return spelling ? { at, spelling } : { at: -1, spelling: op };
  };
  const walk = (n: ExprNode, id: string, start: number) => {
    switch (n.kind) {
      case "binary": {
        walk(n.left, `${id}.0`, start);
        const { at, spelling } = readOp(start + n.left.text.length, n.op);
        if (at >= 0) {
          tokens.push({ nodeId: id, symbol: spelling, start: at, end: at + spelling.length });
          walk(n.right, `${id}.1`, src.indexOf(n.right.text, at + spelling.length));
        }
        return;
      }
      case "unary": {
        const spelling = (SPELLINGS[n.op] ?? [n.op]).find((s) => src.startsWith(s, start)) ?? n.op;
        tokens.push({ nodeId: id, symbol: spelling, start, end: start + spelling.length });
        walk(n.arg, `${id}.0`, src.indexOf(n.arg.text, start + spelling.length));
        return;
      }
      case "cond": {
        walk(n.cond, `${id}.0`, start);
        const q = readOp(start + n.cond.text.length, "?").at;
        if (q < 0) return;
        tokens.push({ nodeId: id, symbol: "?", start: q, end: q + 1 });
        const thenAt = src.indexOf(n.then.text, q + 1);
        walk(n.then, `${id}.1`, thenAt);
        const c = readOp(thenAt + n.then.text.length, ":").at;
        if (c < 0) return;
        tokens.push({ nodeId: id, symbol: ":", start: c, end: c + 1 });
        walk(n.otherwise, `${id}.2`, src.indexOf(n.otherwise.text, c + 1));
        return;
      }
      default: {
        let cursor = start;
        astChildren(n).forEach((c, i) => {
          const at = src.indexOf(c.text, cursor);
          if (at < 0) return;
          walk(c, `${id}.${i}`, at);
          cursor = at + c.text.length;
        });
      }
    }
  };
  walk(ast, "r", src.indexOf(ast.text));
  return tokens.sort((a, b) => a.start - b.start);
}

/** The id of the operator applied last: the root, looking through outer parentheses. */
export function rootOperatorId(ast: ExprNode): string | null {
  let n = ast;
  let id = "r";
  while (n.kind === "paren") {
    n = n.inner;
    id = `${id}.0`;
  }
  return opKey(n) ? id : null;
}

// ---------------------------------------------------------------------------
// Why the parser grouped it this way (§11.3.2, Table 11-2)
// ---------------------------------------------------------------------------

const code = (s: string) => `\`${s}\``;

export type OperandSide = "left" | "right" | "cond" | "member";

/**
 * Which kind of operand child `index` of `parent` is: an operand placed by
 * Table 11-2 ("left", "right", "cond") or one fixed by delimiters ("member":
 * the then-branch between ? and :, the members of an inside list, the parts
 * of a concatenation, the argument of a cast or system function).
 */
export function operandSide(parent: ExprNode, index: number): OperandSide {
  switch (parent.kind) {
    case "binary":
      return index === 0 ? "left" : "right";
    case "unary":
      return "right";
    case "cond":
      return index === 0 ? "cond" : index === 1 ? "member" : "right";
    case "inside":
      return index === 0 ? "left" : "member";
    default:
      return "member";
  }
}

/**
 * Why `inner`, an operand of `outer`, is applied before `outer`. Generated from
 * the rows of Table 11-2, so it can only say what the table says.
 */
export function bindingReason(inner: ExprNode, outer: ExprNode, side: OperandSide): string {
  if (inner.kind === "paren") return `${code(inner.text)} is in parentheses, which make it one operand: §11.3.2 says parentheses can change the grouping that precedence gives.`;
  const ri = rowOf(inner);
  const ro = rowOf(outer);
  const si = operatorSymbol(inner);
  const so = operatorSymbol(outer);
  if (!ri || !ro) return `${code(inner.text)} is a complete operand of ${code(outer.text)}.`;
  if (side === "member") return `${code(inner.text)} sits inside the delimiters of ${code(outer.text)}.`;
  if (outer.kind === "unary") {
    return `unary ${code(so)} is written before its operand, so it applies to the whole of ${code(inner.text)}, which is built first.`;
  }
  if (inner.kind === "unary") {
    return `unary ${code(si)} binds tighter than every binary operator (in Table 11-2 the unary row is directly below the () [] :: . row, above every binary row), so it takes ${code(inner.arg.text)} first.`;
  }
  if (outer.kind === "cond" && side === "cond") {
    return `${code(si)} is in the condition of ?:, and ?: has the lowest precedence of the rows here (Table 11-2), so the whole condition is evaluated as one operand.`;
  }
  if (ri.rank < ro.rank) {
    return `${code(si)} binds tighter than ${code(so)}: in Table 11-2 the row "${ri.label}" sits above the row "${ro.label}".`;
  }
  if (ri.rank === ro.rank) {
    if (ri.associativity === "right") {
      return `${code(si)} and ${code(so)} share the row "${ri.label}", which groups right to left (§11.3.2), so the later ${code(si)} becomes the ${outer.kind === "cond" ? "else" : "right"} operand of the earlier one.`;
    }
    return `${code(si)} and ${code(so)} share the row "${ri.label}", which groups left to right (§11.3.2), so the left one is applied first.`;
  }
  return `${code(inner.text)} is a complete operand of ${code(outer.text)}.`;
}

/** Sentence explaining the root of a parsed expression: which operands its operator received, and why. */
export function rootExplanation(ast: ExprNode): string {
  const root = unwrap(ast);
  const sym = operatorSymbol(root);
  if (!sym) return `${code(root.text)} has no operator outside parentheses or braces, so there is nothing to group.`;
  const parts: string[] = [];
  const kids = astChildren(root);
  kids.forEach((k, i) => {
    if (isLeaf(k) || (rowOf(k) === null && k.kind !== "paren")) return;
    const side = operandSide(root, i);
    if (root.kind === "cond" && i === 1) return; // the then-branch is delimited by ? and :
    parts.push(bindingReason(k, root, side));
  });
  const lead = `${code(sym)} is applied last: the parser builds ${code(fullGrouping(root))}.`;
  return [lead, ...parts].join(" ");
}

// ---------------------------------------------------------------------------
// Tree layout (pure, for the SVG)
// ---------------------------------------------------------------------------

export interface TreeNodeView {
  /** annotateTree id of the shown node (a paren node is collapsed into its inner node). */
  id: string;
  label: string;
  text: string;
  kind: ExprNode["kind"];
  /** True when the source wrapped this node in parentheses. */
  parenthesized: boolean;
  annotation: NodeAnnotation;
  children: TreeNodeView[];
  depth: number;
  /** Horizontal slot (leaves are 0, 1, 2, ...; a parent sits at the mean of its children). */
  x: number;
  /** Bottom-up order: every child comes before its parent. */
  order: number;
}

function nodeLabel(n: ExprNode): string {
  switch (n.kind) {
    case "binary":
    case "unary":
      return spelledOp(n);
    case "cond":
      return "?:";
    case "concat":
      return "{ }";
    case "repl":
      return `{${n.count}{ }}`;
    case "stream":
      return `{${n.dir} }`;
    case "sysfn":
      return n.fn;
    case "cast":
      return n.cast.kind === "size" ? `${n.cast.width}'( )` : n.cast.kind === "sign" ? `${n.cast.signed ? "signed" : "unsigned"}'( )` : `${n.cast.type}'( )`;
    case "inside":
      return "inside";
    default:
      return n.text;
  }
}

export interface TreeLayout {
  root: TreeNodeView;
  nodes: TreeNodeView[];
  /** Number of leaf slots (the drawing width in slots). */
  slots: number;
  /** Number of levels. */
  levels: number;
}

/** Collapse parentheses, place leaves in source order and parents over their children. */
export function layoutTree(ast: ExprNode, ann: NodeAnnotation): TreeLayout {
  let slot = 0;
  let order = 0;
  const nodes: TreeNodeView[] = [];
  const build = (n: ExprNode, a: NodeAnnotation, depth: number, parenthesized: boolean): TreeNodeView => {
    if (n.kind === "paren") return build(n.inner, a.children[0], depth, true);
    const kids = astChildren(n).map((c, i) => build(c, a.children[i], depth + 1, false));
    const x = kids.length === 0 ? slot++ : (kids[0].x + kids[kids.length - 1].x) / 2;
    const view: TreeNodeView = { id: a.id, label: nodeLabel(n), text: n.text, kind: n.kind, parenthesized, annotation: a, children: kids, depth, x, order: order++ };
    nodes.push(view);
    return view;
  };
  const root = build(ast, ann, 0, false);
  return { root, nodes, slots: Math.max(1, slot), levels: Math.max(...nodes.map((n) => n.depth)) + 1 };
}

// ---------------------------------------------------------------------------
// Values in prose
// ---------------------------------------------------------------------------

export function valueText(v: SvValue): string {
  return isKnown(v) ? `${formatCompact(v)} (${formatDecimal(v)})` : formatCompact(v);
}

const bits = (n: number) => `${n} bit${n === 1 ? "" : "s"}`;

/** One line of the text outline for a node: what it is, its width and its value. */
export function nodeSummary(v: TreeNodeView): string {
  const a = v.annotation;
  const what = v.children.length === 0 ? code(v.text) : `${code(v.label)} on ${code(v.text)}`;
  const width = a.width === a.selfWidth ? bits(a.width) : `${bits(a.selfWidth)} on its own, ${bits(a.width)} in its context`;
  return `${what}: ${width}, ${a.signed ? "signed" : "unsigned"}, value ${valueText(a.value)}`;
}

/**
 * §12.4: a condition that is 0, x or z does not run the if branch.
 * A value with a known 1 bit counts as true even if other bits are x or z
 * (truthOf); EXPRESSION_TREE_ASSUMPTIONS records that as simulator practice.
 */
export function ifOutcome(v: SvValue): { runs: boolean; text: string } {
  const t = truthOf(v);
  if (t === "1") return { runs: true, text: "the if branch runs" };
  if (t === "0") return { runs: false, text: "the if branch does not run" };
  const b = bitsOf(v);
  const kinds = [b.includes("x") ? "x" : "", b.includes("z") ? "z" : ""].filter(Boolean).join(" and ");
  return { runs: false, text: `the condition has no bit known to be 1 and has ${kinds} bits, so it is ambiguous (x or z), which if treats as false: the branch does not run (§12.4)` };
}

// ---------------------------------------------------------------------------
// Precedence presets
// ---------------------------------------------------------------------------

export interface PrecedencePreset {
  id: string;
  /** The expression as written, without parentheses. */
  source: string;
  decls: SvDecl[];
  /** What the author meant, as SV source. */
  intended: string;
  /** "if": the expression is an if condition; "value": its value is used. */
  use: "if" | "value";
  /** Table 11-2 rows this preset exercises (labels of PRECEDENCE_ROWS). */
  rows: string[];
}

const lg = (name: string, width: number, init?: string): SvDecl => ({ name, type: "logic", width, ...(init !== undefined ? { init } : {}) });

export const precedencePresets: PrecedencePreset[] = [
  {
    id: "flags-mask",
    source: "flags & mask == 0",
    decls: [lg("flags", 4, "4'b0101"), lg("mask", 4, "4'b0010")],
    intended: "(flags & mask) == 0",
    use: "if",
    rows: ["== != === !== ==? !=?", "& (binary)"],
  },
  {
    id: "shift-plus",
    source: "x << 1 + y",
    decls: [lg("x", 8, "8'd3"), lg("y", 8, "8'd2")],
    intended: "(x << 1) + y",
    use: "value",
    rows: ["+ - (binary)", "<< >> <<< >>>"],
  },
  {
    id: "not-equal",
    source: "!a == b",
    decls: [lg("a", 4, "4'd2"), lg("b", 4, "4'd1")],
    intended: "!(a == b)",
    use: "if",
    rows: ["unary + - ! ~ & ~& | ~| ^ ~^ ^~", "== != === !== ==? !=?"],
  },
  {
    id: "chained-compare",
    source: "a < b < c",
    decls: [lg("a", 4, "4'd3"), lg("b", 4, "4'd5"), lg("c", 4, "4'd4")],
    intended: "(a < b) && (b < c)",
    use: "if",
    rows: ["< <= > >= inside dist"],
  },
  {
    id: "or-and",
    source: "a || b && c",
    decls: [lg("a", 1, "1'b1"), lg("b", 1, "1'b0"), lg("c", 1, "1'b0")],
    intended: "(a || b) && c",
    use: "if",
    rows: ["&&", "||"],
  },
  {
    id: "conditional-chain",
    source: "s ? x : t ? y : z",
    decls: [lg("s", 1, "1'b1"), lg("t", 1, "1'b0"), lg("x", 8, "8'd1"), lg("y", 8, "8'd2"), lg("z", 8, "8'd3")],
    intended: "s ? x : (t ? y : z)",
    use: "value",
    rows: ["?: (conditional operator)"],
  },
  {
    id: "power-chain",
    source: "2 ** 3 ** 2",
    decls: [],
    intended: "2 ** (3 ** 2)",
    use: "value",
    rows: ["**"],
  },
  {
    id: "unary-power",
    source: "-2 ** 2",
    decls: [],
    intended: "-(2 ** 2)",
    use: "value",
    rows: ["unary + - ! ~ & ~& | ~| ^ ~^ ^~", "**"],
  },
];

/** Declarations for typed expressions. */
export const PLAYGROUND_DECLS: SvDecl[] = [
  lg("a", 4, "4'd3"),
  lg("b", 4, "4'd5"),
  lg("c", 4, "4'd4"),
  lg("flags", 4, "4'b0101"),
  lg("mask", 4, "4'b0010"),
  lg("u", 4, "4'b1x01"),
  lg("x", 8, "8'd3"),
  lg("y", 8, "8'd2"),
  lg("s", 1, "1'b1"),
  lg("t", 1, "1'b0"),
];

export const MAX_SOURCE_LENGTH = 80;

export interface ExpressionResult {
  ok: true;
  source: string;
  ast: ExprNode;
  annotation: NodeAnnotation;
  layout: TreeLayout;
  grouping: string;
  value: SvValue;
}

export interface ExpressionError {
  ok: false;
  source: string;
  message: string;
  clause: string;
}

/** Parse and annotate an expression (no assignment target). */
export function analyzeExpression(source: string, decls: SvDecl[]): ExpressionResult | ExpressionError {
  const src = source.trim();
  if (src.length === 0) return { ok: false, source, message: "Type an expression.", clause: "Annex A" };
  if (src.length > MAX_SOURCE_LENGTH) return { ok: false, source, message: `Keep the expression to ${MAX_SOURCE_LENGTH} characters so the tree stays readable.`, clause: "" };
  if (EXCLUDED_PATTERN.test(src)) return { ok: false, source, message: EXCLUDED_NOTE, clause: /\+\+|--/.test(src) ? "§11.3.2, §11.4.2" : "§11.3.2" };
  try {
    const env: SvEnv = buildEnv(decls);
    const ast = parseExpression(src);
    const annotation = annotateTree(ast, env);
    return { ok: true, source: src, ast, annotation, layout: layoutTree(ast, annotation), grouping: fullGrouping(ast), value: annotation.value };
  } catch (e) {
    if (e instanceof SvExpressionError) return { ok: false, source, message: e.message, clause: e.clause };
    throw e;
  }
}

export interface GroupingOption {
  id: string;
  /** The candidate written with explicit parentheses. */
  source: string;
  grouping: string;
  correct: boolean;
  /** The value this grouping produces (computed by the model). */
  value: SvValue;
  feedback: string;
}

/**
 * The operand a node leaves open on its right, which an operator written after
 * it could take instead: a binary operator's right operand, a unary operator's
 * operand and the else operand of ?:. `inside` is closed by its braces, and
 * parentheses, concatenations and calls by their own delimiters (§11.3.2).
 */
function openRight(n: ExprNode): ExprNode | null {
  if (n.kind === "binary") return n.right;
  if (n.kind === "unary") return n.arg;
  if (n.kind === "cond") return n.otherwise;
  return null;
}

/**
 * The operand a node leaves open on its left, which an operator written before
 * it could take instead: a binary operator's left operand, the condition of ?:
 * and the left operand of `inside`.
 */
function openLeft(n: ExprNode): ExprNode | null {
  if (n.kind === "binary") return n.left;
  if (n.kind === "cond") return n.cond;
  if (n.kind === "inside") return n.left;
  return null;
}

/**
 * Alternative groupings of the same tokens, made by moving the root one
 * level. Node texts are exact slices of the source, so each candidate is the
 * source with one pair of parentheses added:
 * - the root's leftmost operand L is open on its right (operand T):
 *   `(A op1 B) op2 C` → `A op1 (B op2 C)`, `-a ** b` → `-(a ** b)`,
 *   `s & t ? x : y` → `s & (t ? x : y)`, `a < b inside {c}` → `a < (b inside {c})`;
 * - the root's rightmost operand O is open on its left (operand H):
 *   `A op1 (B op2 C)` → `(A op1 B) op2 C`, `a ? b : c + a` → `(a ? b : c) + a`,
 *   `s ? x : t ? y : z` → `(s ? x : t) ? y : z`, `a == b inside {c}` → `(a == b) inside {c}`.
 * groupingOptions keeps only candidates that parse, use the same tokens and
 * build a different tree.
 */
export function alternativeSources(ast: ExprNode): string[] {
  const root = unwrap(ast);
  const text = root.text;
  const out: string[] = [];
  const first = openLeft(root);
  const T = first ? openRight(first) : null;
  if (first && T && text.startsWith(first.text) && first.text.endsWith(T.text)) {
    const head = first.text.slice(0, first.text.length - T.text.length);
    out.push(`${head}(${T.text}${text.slice(first.text.length)})`);
  }
  const last = openRight(root);
  const H = last ? openLeft(last) : null;
  if (last && H && text.endsWith(last.text) && last.text.startsWith(H.text)) {
    const head = text.slice(0, text.length - last.text.length);
    out.push(`(${head}${H.text})${last.text.slice(H.text.length)}`);
  }
  return out;
}

/** Fewer options than this and "Choose the grouping" has nothing to choose between. */
export const MIN_GROUPING_OPTIONS = 2;
export const MAX_GROUPING_OPTIONS = 3;

export const GROUPING_UNAVAILABLE =
  "Choose the grouping is off for this expression: this explorer has no other grouping of these tokens to offer, so tap the operator applied last instead.";

/**
 * Two or three parenthesizations to choose from: the parser's, the rotations
 * of the root, and the author's intended version when it uses the same
 * tokens. Sorted by text so the position never gives the answer away.
 * Returns fewer than MIN_GROUPING_OPTIONS when moving the root finds no other
 * grouping (for example `(a + b) * c`); the component then turns the grouping
 * method off and says so (GROUPING_UNAVAILABLE), without claiming that no
 * other grouping of the tokens exists.
 */
export function groupingOptions(source: string, decls: SvDecl[], intended?: string): GroupingOption[] {
  const actual = analyzeExpression(source, decls);
  if (!actual.ok) return [];
  const candidates = [actual.grouping, ...alternativeSources(actual.ast), ...(intended ? [intended] : [])];
  const seen = new Set<string>();
  const options: GroupingOption[] = [];
  for (const cand of candidates) {
    if (!isParenthesization(source, cand)) continue;
    const r = analyzeExpression(cand, decls);
    if (!r.ok) continue;
    const grouping = fullGrouping(unwrap(r.ast));
    const key = canonicalGrouping(unwrap(r.ast));
    if (seen.has(key)) continue;
    seen.add(key);
    const correct = key === canonicalGrouping(unwrap(actual.ast));
    if (!correct && options.filter((o) => !o.correct).length >= MAX_GROUPING_OPTIONS - 1) continue;
    options.push({ id: `g${options.length}`, source: cand, grouping, correct, value: r.value, feedback: "" });
  }
  const explanation = rootExplanation(actual.ast);
  for (const o of options) {
    o.feedback = o.correct
      ? explanation
      : `${code(o.grouping)} is a different tree, worth ${valueText(o.value)} here. ${explanation}`;
  }
  return options.sort((a, b) => a.grouping.localeCompare(b.grouping)).map((o, i) => ({ ...o, id: `g${i}` }));
}

/** Feedback for tapping operator `nodeId` as the one applied last. */
export function tapFeedback(source: string, decls: SvDecl[], nodeId: string): { correct: boolean; text: string } {
  const r = analyzeExpression(source, decls);
  if (!r.ok) return { correct: false, text: r.message };
  const rootId = rootOperatorId(r.ast);
  const explanation = rootExplanation(r.ast);
  if (nodeId === rootId) return { correct: true, text: explanation };
  const byId = astById(r.ast);
  const tapped = byId.get(nodeId);
  const parentId = nodeId.split(".").slice(0, -1).join(".");
  let parent = byId.get(parentId);
  let child = tapped;
  let childId = nodeId;
  let pid = parentId;
  // Look through parentheses for the operator that consumes the tapped one.
  while (parent && parent.kind === "paren") {
    child = parent;
    childId = pid;
    pid = pid.split(".").slice(0, -1).join(".");
    parent = byId.get(pid);
  }
  if (!tapped || !parent || !child) return { correct: false, text: explanation };
  const side = operandSide(parent, Number(childId.split(".").pop()));
  return {
    correct: false,
    text: `${code(operatorSymbol(tapped))} is applied before ${code(operatorSymbol(parent) || parent.text)}, which takes it as an operand.${pid === rootId ? "" : ` ${bindingReason(child, parent, side)}`} ${explanation}`,
  };
}

export interface PrecedenceAnalysis {
  preset: PrecedencePreset;
  actual: ExpressionResult;
  intended: ExpressionResult;
  /** True when the author's version and the parser's grouping differ. */
  differs: boolean;
  options: GroupingOption[];
  tokens: OperatorToken[];
  rootId: string | null;
  /** Generated sentence for "Add parentheses": what changes and why. */
  flip: string;
}

/** Everything the precedence view shows for a preset. Throws if a preset does not parse (pinned by tests). */
export function analyzePrecedence(preset: PrecedencePreset): PrecedenceAnalysis {
  const actual = analyzeExpression(preset.source, preset.decls);
  const intended = analyzeExpression(preset.intended, preset.decls);
  if (!actual.ok || !intended.ok) throw new Error(`Preset ${preset.id} does not parse`);
  const differs = !sameGrouping(actual.ast, intended.ast);
  return {
    preset,
    actual,
    intended,
    differs,
    options: groupingOptions(preset.source, preset.decls, preset.intended),
    tokens: operatorTokens(actual.source, actual.ast),
    rootId: rootOperatorId(actual.ast),
    flip: flipText(preset, actual, intended),
  };
}

function outcome(use: "if" | "value", v: SvValue): string {
  return use === "if" ? `${valueText(v)}: ${ifOutcome(v).text}` : valueText(v);
}

/** The before/after sentence for rewriting the source as the author meant it. */
export function flipText(preset: Pick<PrecedencePreset, "use">, actual: ExpressionResult, intended: ExpressionResult): string {
  const before = `As written, ${code(actual.source)} is ${outcome(preset.use, actual.value)}.`;
  const after = `Rewritten as ${code(intended.source)}, it is ${outcome(preset.use, intended.value)}.`;
  const sameValue = formatCompact(actual.value) === formatCompact(intended.value);
  if (sameGrouping(actual.ast, intended.ast)) return `${before} ${after} No flip: the parser's grouping already is the one meant, and the parentheses only make it visible.`;
  if (preset.use === "if") {
    const a = ifOutcome(actual.value).runs;
    const b = ifOutcome(intended.value).runs;
    if (a !== b) return `${before} ${after} The answer flips: ${b ? "the if branch now runs" : "the if branch no longer runs"}.`;
  }
  if (sameValue) return `${before} ${after} Same value for these operands, but a different tree: other values can tell the two apart.`;
  return `${before} ${after} The answer flips.`;
}

// ---------------------------------------------------------------------------
// Width: bowls (§11.6.1 Table 11-21, §11.8.2)
// ---------------------------------------------------------------------------

export type BowlKind = "context" | "self" | "compare" | "cast";

export interface BowlMember {
  text: string;
  /** Self-determined width of the member (Table 11-21). */
  width: number;
}

export interface Bowl {
  id: string;
  kind: BowlKind;
  /** The width every node in the bowl is evaluated at (from annotateTree). */
  width: number;
  /** Shown node ids (paren nodes collapsed) inside this bowl. */
  nodeIds: string[];
  /** The operands that size the bowl: nodes in the bowl with no child in the same bowl. */
  members: BowlMember[];
  /** The assignment target, for the root bowl of an assignment. */
  target?: BowlMember;
  /** A size or type cast's width, for a cast bowl (§6.24.1). */
  castWidth?: number;
  /** Why this bowl is separate from its parent (generated), or "" for the root. */
  reason: string;
  parent: string | null;
  children: string[];
}

/** Why a child of `parent` (at `index`) starts a bowl of its own, or null when it shares the parent's bowl. */
export function separation(parent: ExprNode, index: number): { kind: BowlKind; reason: string; shared?: boolean } | null {
  switch (parent.kind) {
    case "paren":
      return null;
    case "unary":
      if (parent.op === "+" || parent.op === "-" || parent.op === "~") return null;
      return { kind: "self", reason: parent.op === "!" ? `operand of ! (self-determined, Table 11-21)` : `operand of the reduction ${parent.op} (self-determined, Table 11-21)` };
    case "binary":
      if (["+", "-", "*", "/", "%", "&", "|", "^", "~^"].includes(parent.op)) return null;
      if (["<<", ">>", "<<<", ">>>"].includes(parent.op)) return index === 0 ? null : { kind: "self", reason: "shift amount (self-determined, Table 11-21)" };
      if (parent.op === "**") return index === 0 ? null : { kind: "self", reason: "exponent of ** (self-determined, Table 11-21)" };
      if (parent.op === "&&" || parent.op === "||") return { kind: "self", reason: `operand of ${parent.op} (self-determined, Table 11-21)` };
      return { kind: "compare", reason: `operands of ${parent.op}: sized to each other, 1-bit result (§11.8.2)`, shared: true };
    case "cond":
      return index === 0 ? { kind: "self", reason: "condition of ?: (self-determined, Table 11-21)" } : null;
    case "concat":
    case "repl":
    case "stream":
      return { kind: "self", reason: "concatenation member (self-determined, Table 11-21)" };
    case "sysfn":
      return { kind: "self", reason: `argument of ${parent.fn} (self-determined)` };
    case "cast":
      return parent.cast.kind === "sign" ? { kind: "self", reason: "argument of a sign cast (self-determined, §6.24.1)" } : { kind: "cast", reason: "argument of a size or type cast (§6.24.1)" };
    case "inside":
      return { kind: "compare", reason: "operand of inside, compared with each member (§11.4.13)" };
    default:
      return null;
  }
}

export interface BowlMap {
  bowls: Bowl[];
  /** Shown node id → bowl id. */
  bowlOf: Record<string, string>;
}

/**
 * Partition a tree into bowls. The root bowl holds the root and every node
 * reached through context-determined operands; the target (if any) joins it.
 */
export function bowlsOf(ast: ExprNode, ann: NodeAnnotation, target?: BowlMember): BowlMap {
  const bowls: Bowl[] = [];
  const bowlOf: Record<string, string> = {};
  const newBowl = (kind: BowlKind, width: number, reason: string, parent: string | null): Bowl => {
    const b: Bowl = { id: `B${bowls.length + 1}`, kind, width, nodeIds: [], members: [], reason, parent, children: [] };
    bowls.push(b);
    if (parent) bowls.find((p) => p.id === parent)?.children.push(b.id);
    return b;
  };
  /** Place a node in `bowl` (parentheses collapse into their inner node) and its children in theirs. */
  const visit = (n: ExprNode, a: NodeAnnotation, bowl: Bowl): void => {
    if (n.kind === "paren") {
      visit(n.inner, a.children[0], bowl);
      return;
    }
    const id = a.id;
    bowl.nodeIds.push(id);
    bowlOf[id] = bowl.id;
    const kids = astChildren(n);
    let sharedBowl: Bowl | null = null;
    let inBowl = 0;
    kids.forEach((c, i) => {
      const sep = separation(n, i);
      const ca = a.children[i];
      if (!sep) {
        inBowl += 1;
        visit(c, ca, bowl);
        return;
      }
      let b: Bowl;
      if (sep.shared && sharedBowl) b = sharedBowl;
      else {
        b = newBowl(sep.kind, ca.width, sep.reason, bowl.id);
        if (sep.kind === "cast" && n.kind === "cast") b.castWidth = n.cast.kind === "size" ? n.cast.width : ca.width;
        if (sep.shared) sharedBowl = b;
      }
      visit(c, ca, b);
    });
    if (inBowl === 0) bowl.members.push({ text: n.text, width: a.selfWidth });
  };
  const root = newBowl("context", ann.width, "", null);
  if (target) root.target = target;
  visit(ast, ann, root);
  return { bowls, bowlOf };
}

// ---------------------------------------------------------------------------
// Width presets (the lesson's trace table, §11.6.2)
// ---------------------------------------------------------------------------

export interface WidthTarget {
  /** As written on the left-hand side. */
  name: string;
  /** For `{carry, s8}`: the members, MSB first. */
  members?: { name: string; width: number }[];
  width: number;
}

export interface WidthPreset {
  id: string;
  target: WidthTarget;
  expr: string;
  /** The subexpression whose bowl the learner predicts. */
  focus: string;
  /** Another preset that differs in one detail. */
  contrast?: string;
}

export const WIDTH_OPERANDS: SvDecl[] = [lg("a", 8, "8'd200"), lg("b", 8, "8'd100")];

const s9: WidthTarget = { name: "s9", width: 9 };
const s8: WidthTarget = { name: "s8", width: 8 };
const flag: WidthTarget = { name: "flag", width: 1 };

export const widthPresets: WidthPreset[] = [
  { id: "s9-sum", target: s9, expr: "a + b", focus: "a + b", contrast: "s9-concat" },
  { id: "s9-concat", target: s9, expr: "{a + b}", focus: "a + b", contrast: "s9-sum" },
  { id: "carry-s8", target: { name: "{carry, s8}", width: 9, members: [{ name: "carry", width: 1 }, { name: "s8", width: 8 }] }, expr: "a + b", focus: "a + b", contrast: "s9-sum" },
  { id: "s8-shift", target: s8, expr: "(a + b) >> 1", focus: "a + b", contrast: "s8-plus-0" },
  { id: "s8-plus-0", target: s8, expr: "(a + b + 0) >> 1", focus: "a + b", contrast: "s8-plus-1b0" },
  { id: "s8-plus-1b0", target: s8, expr: "(a + b + 1'b0) >> 1", focus: "a + b", contrast: "s8-plus-0" },
  { id: "flag-255", target: flag, expr: "(a + b > 255)", focus: "a + b", contrast: "flag-8d255" },
  { id: "flag-8d255", target: flag, expr: "(a + b > 8'd255)", focus: "a + b", contrast: "flag-255" },
];

export const WIDTH_CHOICES = [8, 9, 32] as const;

export interface WidthCandidate {
  /** The bowl width this candidate assumes. */
  width: number;
  stored: string;
}

export interface WidthAnalysis {
  preset: WidthPreset;
  statement: string;
  declarations: string[];
  evaluation: AssignmentEvaluation;
  ast: ExprNode;
  annotation: NodeAnnotation;
  layout: TreeLayout;
  bowls: BowlMap;
  /** The bowl holding the focus subexpression. */
  focusBowl: Bowl;
  focusNode: TreeNodeView;
  /** The focus value at its bowl width and its exact integer value. */
  focusValue: SvValue;
  exact: bigint | null;
  carryKept: boolean;
  carryText: string;
  /** What the target holds, written per target member. */
  stored: string;
  /** Stored values the target would hold if the focus bowl were 8, 9 or 32 bits (computed with size casts). */
  candidates: WidthCandidate[];
  steps: ExprStep[];
  bowlExplanation: string;
}

function storedText(target: WidthTarget, v: SvValue): string {
  if (target.members) {
    const split = splitConcatTarget(target.members, v);
    return split.parts.map((p) => `${p.name} = ${formatDecimal(p.value)}`).join(", ");
  }
  return `${target.name} = ${isKnown(v) ? formatDecimal(v) : formatCompact(v)}`;
}

function targetDecl(t: WidthTarget): SvDecl {
  return lg(t.name, t.width);
}

/** Minimum bits for a non-negative integer. */
const bitLength = (n: bigint) => (n <= BigInt(0) ? 1 : n.toString(2).length);

function bowlExplanation(b: Bowl, focus: string): string {
  const list = [...b.members.map((m) => `${code(m.text)} (${m.width})`), ...(b.target ? [`the target ${b.target.text} (${b.target.width})`] : [])];
  const largest = `The largest is ${b.width}, so ${code(focus)} is evaluated in ${bits(b.width)}`;
  if (b.kind === "context" && b.parent === null) {
    return `${code(focus)} is in the context-determined region joined to the target. Sized together: ${list.join(", ")}. ${largest} (§11.6.1, §11.8.2).`;
  }
  if (b.kind === "compare") {
    return `${code(focus)} is in the bowl of a comparison: ${b.reason}. Sized together: ${list.join(", ")}. ${largest}; the target sees only the 1-bit result (§11.8.2).`;
  }
  return `${code(focus)} is in its own bowl as a ${b.reason}, so the target cannot reach it. Sized together: ${list.join(", ")}. ${largest} (§11.6.1).`;
}

/** Everything the width view shows for a preset. Throws if a preset fails to evaluate (pinned by tests). */
export function analyzeWidth(preset: WidthPreset): WidthAnalysis {
  const tdecl = targetDecl(preset.target);
  const evaluation = evaluateAssignment(WIDTH_OPERANDS, tdecl, preset.expr);
  if (!evaluation.ok) throw new Error(`Preset ${preset.id}: ${evaluation.error.message}`);
  const env = buildEnv(WIDTH_OPERANDS);
  const ast = parseExpression(preset.expr);
  const annotation = annotateTree(ast, env, preset.target.width);
  const layout = layoutTree(ast, annotation);
  const bowls = bowlsOf(ast, annotation, { text: preset.target.name, width: preset.target.width });
  const focusNode = layout.nodes.find((n) => n.text === preset.focus);
  if (!focusNode) throw new Error(`Preset ${preset.id}: no node ${preset.focus}`);
  const focusBowl = bowls.bowls.find((b) => b.id === bowls.bowlOf[focusNode.id])!;
  const focusValue = focusNode.annotation.value;
  const exact = mathIntuition(preset.focus, env);
  const got = toBigInt(focusValue);
  const carryKept = exact !== null && got === exact;
  const carryText =
    exact === null || got === null
      ? `${code(preset.focus)} is ${valueText(focusValue)}.`
      : carryKept
        ? `Carry kept: ${code(preset.focus)} = ${exact} needs ${bits(bitLength(exact))} and the ${focusBowl.width}-bit bowl holds it.`
        : `Carry dropped: ${code(preset.focus)} = ${exact} needs ${bits(bitLength(exact))}, the ${focusBowl.width}-bit bowl keeps only ${got}.`;
  const candidates: WidthCandidate[] = WIDTH_CHOICES.map((w) => {
    const swapped = preset.expr.replace(preset.focus, `${w}'(${preset.focus})`);
    const r = evaluateAssignment(WIDTH_OPERANDS, tdecl, swapped);
    return { width: w, stored: r.ok ? storedText(preset.target, r.final) : "" };
  });
  return {
    preset,
    statement: `${preset.target.name} = ${preset.expr};`,
    declarations: [
      ...WIDTH_OPERANDS.map((d) => declToSource(d)),
      ...(preset.target.members ? preset.target.members.map((m) => declToSource(lg(m.name, m.width))) : [declToSource(tdecl)]),
    ],
    evaluation,
    ast,
    annotation,
    layout,
    bowls,
    focusBowl,
    focusNode,
    focusValue,
    exact,
    carryKept,
    carryText,
    stored: storedText(preset.target, evaluation.final),
    candidates,
    steps: evaluation.steps,
    bowlExplanation: bowlExplanation(focusBowl, preset.focus),
  };
}

export interface WidthOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Bowl-width options (8, 9, 32) with feedback generated from the bowl. */
export function widthOptions(w: WidthAnalysis): WidthOption[] {
  const b = w.focusBowl;
  const memberWidths = [...b.members.map((m) => m.width), ...(b.target ? [b.target.width] : [])];
  return WIDTH_CHOICES.map((choice) => {
    const correct = choice === b.width;
    let feedback: string;
    if (correct) feedback = w.bowlExplanation;
    else if (b.target && b.target.width > choice && choice === Math.max(...b.members.map((m) => m.width))) {
      feedback = `${choice} bits is the widest operand, but the ${b.target.width}-bit target ${b.target.text} is in this bowl too. ${w.bowlExplanation}`;
    } else if (choice === w.preset.target.width && !b.target) {
      feedback = `The ${choice}-bit target ${w.preset.target.name} is outside this bowl. ${w.bowlExplanation}`;
    } else if (!memberWidths.includes(choice)) {
      feedback = `Nothing in this bowl is ${choice} bits wide. ${w.bowlExplanation}`;
    } else {
      feedback = w.bowlExplanation;
    }
    return { id: `w${choice}`, label: `${choice} bits`, correct, feedback };
  });
}

/** Stored-value options: the distinct values a bowl of 8, 9 or 32 bits would give. */
export function storedOptions(w: WidthAnalysis): WidthOption[] {
  const distinct: WidthCandidate[] = [];
  for (const c of w.candidates) if (c.stored && !distinct.some((d) => d.stored === c.stored)) distinct.push(c);
  return distinct.map((c, i) => {
    const correct = c.stored === w.stored;
    const widths = w.candidates.filter((x) => x.stored === c.stored).map((x) => x.width);
    const what = `${c.stored} is what a bowl of ${widths.join(" or ")} bits for ${code(w.preset.focus)} gives.`;
    return {
      id: `v${i}`,
      label: c.stored,
      correct,
      feedback: correct ? `${what} ${w.carryText}` : `${what} This bowl is ${bits(w.focusBowl.width)}. ${w.carryText}`,
    };
  });
}

/** Short label of a step for the scrubber. */
export function stepLabel(s: ExprStep): string {
  switch (s.kind) {
    case "context":
      return `context: ${s.text} in ${bits(s.width)}`;
    case "extend":
      return `extend: ${s.text} to ${bits(s.to.width)}`;
    case "op":
      return `op: ${s.text} = ${valueText(s.result)}`;
    case "assign":
      return `assign: ${s.text}`;
  }
}

export function findPrecedencePreset(id?: string): PrecedencePreset {
  return precedencePresets.find((p) => p.id === id) ?? precedencePresets[0];
}

export function findWidthPreset(id?: string): WidthPreset {
  return widthPresets.find((p) => p.id === id) ?? widthPresets[0];
}
