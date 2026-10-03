/**
 * SystemVerilog expression model: bit lengths, signedness, extension,
 * truncation, casts and four-state operators.
 *
 * Pure and deterministic (no React, no randomness). Every rule cites the
 * IEEE 1800-2023 clause it implements; tests in
 * tests/lib/sv-expression-model.test.ts pin each one.
 *
 * - §5.7.1  integer literals: sized/unsized, the `s` designator, x/z/? digits, padding
 * - §6.11.2 4-state → 2-state conversion turns x/z into 0
 * - §6.24.1 size casts `N'(e)`, sign casts `signed'(e)`, type casts `int'(e)`
 * - §10.7   assignment extension and truncation (MSBs discarded)
 * - §11.4   operator semantics, including the 4-state truth tables
 * - §11.6.1 Table 11-21: context-determined vs self-determined bit lengths
 * - §11.7   `$signed` / `$unsigned`
 * - §11.8.1 expression type; §11.8.2 evaluation steps; §11.8.3 assignment;
 *           §11.8.4 x/z in signed expressions
 *
 * Values are BigInt pairs in the VPI aval/bval encoding:
 * 0 = (0,0), 1 = (1,0), z = (0,1), x = (1,1).
 */

// ---------------------------------------------------------------------------
// Four-state values
// ---------------------------------------------------------------------------

export type Bit4 = "0" | "1" | "x" | "z";

export interface SvValue {
  readonly width: number;
  readonly signed: boolean;
  /** Value plane: 1 for logic 1 and for x. */
  readonly aval: bigint;
  /** Unknown plane: 1 for x and z. */
  readonly bval: bigint;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const big = (n: number) => BigInt(n);

export function maskOf(width: number): bigint {
  return (ONE << big(width)) - ONE;
}

export function makeValue(width: number, signed: boolean, aval: bigint, bval: bigint = ZERO): SvValue {
  const m = maskOf(width);
  return { width, signed, aval: aval & m, bval: bval & m };
}

/** Two's-complement wrap of an integer into `width` bits. */
export function fromBigInt(n: bigint, width: number, signed = false): SvValue {
  return makeValue(width, signed, BigInt.asUintN(width, n), ZERO);
}

export function allX(width: number, signed = false): SvValue {
  const m = maskOf(width);
  return { width, signed, aval: m, bval: m };
}

/** Bit `i` (0 = LSB). */
export function bitAt(v: SvValue, i: number): Bit4 {
  const a = (v.aval >> big(i)) & ONE;
  const b = (v.bval >> big(i)) & ONE;
  if (b === ZERO) return a === ONE ? "1" : "0";
  return a === ONE ? "x" : "z";
}

/** Bits, most significant first. */
export function bitsOf(v: SvValue): Bit4[] {
  const out: Bit4[] = [];
  for (let i = v.width - 1; i >= 0; i -= 1) out.push(bitAt(v, i));
  return out;
}

/** Build a value from bits given most significant first. */
export function fromBits(bits: Bit4[], signed = false): SvValue {
  let aval = ZERO;
  let bval = ZERO;
  for (const bit of bits) {
    aval <<= ONE;
    bval <<= ONE;
    if (bit === "1" || bit === "x") aval |= ONE;
    if (bit === "x" || bit === "z") bval |= ONE;
  }
  return { width: bits.length, signed, aval, bval };
}

export function isKnown(v: SvValue): boolean {
  return v.bval === ZERO;
}

/** Integer value, or null when any bit is x/z. */
export function toBigInt(v: SvValue, asSigned: boolean = v.signed): bigint | null {
  if (!isKnown(v)) return null;
  return asSigned ? BigInt.asIntN(v.width, v.aval) : v.aval;
}

export function reinterpret(v: SvValue, signed: boolean): SvValue {
  return { ...v, signed };
}

export function sameValue(a: SvValue, b: SvValue): boolean {
  return a.width === b.width && a.signed === b.signed && a.aval === b.aval && a.bval === b.bval;
}

/** Every x/z bit becomes 0 (§6.11.2). */
export function toTwoState(v: SvValue): SvValue {
  return { ...v, aval: v.aval & ~v.bval & maskOf(v.width), bval: ZERO };
}

/**
 * Resize to `width`. Narrowing discards MSBs (§10.7). Widening fills with
 * the MSB (including x/z, §11.8.4) when `signExtend`, otherwise with 0.
 */
export function resize(v: SvValue, width: number, signExtend: boolean, signed: boolean): SvValue {
  if (width <= v.width) return makeValue(width, signed, v.aval, v.bval);
  const extra = maskOf(width) & ~maskOf(v.width);
  const msb = bitAt(v, v.width - 1);
  let aval = v.aval;
  let bval = v.bval;
  if (signExtend && (msb === "1" || msb === "x")) aval |= extra;
  if (signExtend && (msb === "x" || msb === "z")) bval |= extra;
  return { width, signed, aval, bval };
}

/** Bits with `_` every four positions from the right, e.g. `0001_0110`. */
export function formatBits(v: SvValue, group = 4): string {
  const bits = bitsOf(v);
  let out = "";
  bits.forEach((b, i) => {
    const fromRight = bits.length - i;
    out += b;
    if (fromRight > 1 && (fromRight - 1) % group === 0) out += "_";
  });
  return out;
}

/** Sized binary literal, e.g. `8'b0001_0110` or `4'sb1100`. */
export function formatLiteral(v: SvValue): string {
  return `${v.width}'${v.signed ? "s" : ""}b${formatBits(v)}`;
}

/** Sized hex literal when every nibble is fully known or fully x/z; otherwise binary. */
export function formatHexLiteral(v: SvValue): string {
  const bits = bitsOf(v);
  const pad = (4 - (bits.length % 4)) % 4;
  const padded: Bit4[] = [...Array<Bit4>(pad).fill(bits[0] === "x" || bits[0] === "z" ? bits[0] : "0"), ...bits];
  let hex = "";
  for (let i = 0; i < padded.length; i += 4) {
    const nib = padded.slice(i, i + 4);
    if (nib.every((b) => b === "x")) hex += "x";
    else if (nib.every((b) => b === "z")) hex += "z";
    else if (nib.some((b) => b === "x" || b === "z")) return formatLiteral(v);
    else hex += parseInt(nib.join(""), 2).toString(16).toUpperCase();
  }
  const grouped = hex.replace(/\B(?=(.{4})+(?!.))/g, "_");
  return `${v.width}'${v.signed ? "s" : ""}h${grouped}`;
}

/** Decimal reading under the value's own signedness, or "x" if any bit is x/z. */
export function formatDecimal(v: SvValue): string {
  const n = toBigInt(v);
  return n === null ? "x" : n.toString();
}

/** Decimal when known, otherwise the sized binary literal (shows where the x/z bits are). */
export function formatValue(v: SvValue): string {
  return isKnown(v) ? formatDecimal(v) : formatLiteral(v);
}

// ---------------------------------------------------------------------------
// Literals (§5.7.1)
// ---------------------------------------------------------------------------

export interface ParsedLiteral {
  value: SvValue;
  /** False for unsized numbers such as `12` or `'hF` (at least 32 bits). */
  sized: boolean;
}

const BITS_PER_DIGIT: Record<string, number> = { b: 1, o: 3, h: 4 };

function bitLength(n: bigint): number {
  let len = 0;
  let m = n < ZERO ? -n : n;
  while (m > ZERO) {
    len += 1;
    m >>= ONE;
  }
  return len;
}

export function parseLiteral(raw: string): ParsedLiteral {
  const text = raw.replace(/\s+/g, "");
  if (/^\d[\d_]*$/.test(text)) {
    // Simple decimal number: signed, at least 32 bits (§5.7.1).
    const n = BigInt(text.replace(/_/g, ""));
    const width = Math.max(32, bitLength(n) + 1);
    return { value: fromBigInt(n, width, true), sized: false };
  }
  const m = /^(\d[\d_]*)?'([sS])?([bBoOdDhH])([0-9a-fA-FxXzZ?_]+)$/.exec(text);
  if (!m) throw new SvExpressionError("syntax", `"${raw}" is not an integer literal.`, "§5.7.1");
  const sized = m[1] !== undefined;
  const signed = m[2] !== undefined;
  const base = m[3].toLowerCase();
  const digits = m[4].replace(/_/g, "");
  if (sized && Number(m[1].replace(/_/g, "")) === 0) {
    throw new SvExpressionError("syntax", "A literal size must be a nonzero number.", "§5.7.1");
  }

  let bits: Bit4[];
  if (base === "d") {
    if (/^[xXzZ?]$/.test(digits)) {
      bits = [/[xX]/.test(digits) ? "x" : "z"];
    } else if (/^\d+$/.test(digits)) {
      const n = BigInt(digits);
      bits = bitsOf(fromBigInt(n, Math.max(1, bitLength(n))));
    } else {
      throw new SvExpressionError("syntax", `"${raw}" has digits that are illegal in decimal.`, "§5.7.1");
    }
  } else {
    const per = BITS_PER_DIGIT[base];
    bits = [];
    for (const ch of digits) {
      const c = ch.toLowerCase();
      if (c === "x") bits.push(...Array<Bit4>(per).fill("x"));
      else if (c === "z" || c === "?") bits.push(...Array<Bit4>(per).fill("z"));
      else {
        const d = parseInt(c, 16);
        if (Number.isNaN(d) || d >= 1 << per) {
          throw new SvExpressionError("syntax", `"${raw}" has a digit that is illegal in base ${base}.`, "§5.7.1");
        }
        bits.push(...(d.toString(2).padStart(per, "0").split("") as Bit4[]));
      }
    }
  }

  const width = sized ? Number(m[1].replace(/_/g, "")) : Math.max(32, bits.length);
  if (bits.length > width) {
    bits = bits.slice(bits.length - width); // truncated from the left
  } else if (bits.length < width) {
    // Pad left with 0, or with x/z when the leftmost digit is x/z (§5.7.1).
    const fill: Bit4 = bits[0] === "x" || bits[0] === "z" ? bits[0] : "0";
    bits = [...Array<Bit4>(width - bits.length).fill(fill), ...bits];
  }
  return { value: fromBits(bits, signed), sized };
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export type SvTypeKeyword = "logic" | "reg" | "bit" | "byte" | "shortint" | "int" | "longint" | "integer";

export interface SvDecl {
  name: string;
  type: SvTypeKeyword;
  /** For logic/reg/bit: explicit `signed`. For the integer types: `false` means `int unsigned` etc. */
  signed?: boolean;
  /** Packed width for logic/reg/bit (default 1). Ignored for the fixed-size integer types. */
  width?: number;
  /** Initial value as SV source (any expression of this model), e.g. `-4` or `4'b10x1`. */
  init?: string;
}

export interface SvVarType {
  width: number;
  signed: boolean;
  fourState: boolean;
}

/** Fixed-size integer types (§6.11, Table 6-8). */
const INTEGER_TYPES: Record<string, SvVarType> = {
  byte: { width: 8, signed: true, fourState: false },
  shortint: { width: 16, signed: true, fourState: false },
  int: { width: 32, signed: true, fourState: false },
  longint: { width: 64, signed: true, fourState: false },
  integer: { width: 32, signed: true, fourState: true },
};

export function declType(d: SvDecl): SvVarType {
  const fixed = INTEGER_TYPES[d.type];
  if (fixed) return { ...fixed, signed: d.signed ?? fixed.signed };
  return { width: d.width ?? 1, signed: d.signed ?? false, fourState: d.type !== "bit" };
}

export function typeToSource(d: SvDecl): string {
  if (INTEGER_TYPES[d.type]) return d.signed === false ? `${d.type} unsigned` : d.type;
  const w = d.width ?? 1;
  return `${d.type}${d.signed ? " signed" : ""}${w > 1 ? ` [${w - 1}:0]` : ""}`;
}

export function declToSource(d: SvDecl, typeColumn = 0): string {
  const type = typeToSource(d).padEnd(typeColumn, " ");
  return `${type} ${d.name}${d.init !== undefined ? ` = ${d.init}` : ""};`;
}

/** Range of values a declaration can hold (widths up to 52 bits). */
export function valueRange(d: SvDecl): { min: number; max: number } {
  const t = declType(d);
  if (t.signed) return { min: -(2 ** (t.width - 1)), max: 2 ** (t.width - 1) - 1 };
  return { min: 0, max: 2 ** t.width - 1 };
}

/** The SV literal used to initialise a declaration with a plain number. */
export function numericInit(d: SvDecl, value: number): string {
  const t = declType(d);
  if (t.signed || INTEGER_TYPES[d.type]) return String(value);
  return `${t.width}'d${value}`;
}

export interface SvVariable {
  decl: SvDecl;
  type: SvVarType;
  value: SvValue;
}

export type SvEnv = Record<string, SvVariable>;

/** Elaborate declarations in order; each initialiser is evaluated as an assignment. */
export function buildEnv(decls: SvDecl[]): SvEnv {
  const env: SvEnv = {};
  for (const d of decls) {
    const type = declType(d);
    let value: SvValue;
    if (d.init === undefined) {
      // Default initial values (Table 6-7): 4-state → x, 2-state → 0.
      value = type.fourState ? allX(type.width, type.signed) : fromBigInt(ZERO, type.width, type.signed);
    } else {
      const ev = new Evaluator(env, {});
      value = ev.assign(d.name, type, parseExpression(d.init)).final;
    }
    env[d.name] = { decl: d, type, value };
  }
  return env;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SvErrorCode =
  | "syntax"
  | "binary-reduction-operator"
  | "unknown-identifier"
  | "unsized-in-concatenation"
  | "stream-in-expression"
  | "stream-wider-than-target"
  | "select-out-of-range"
  | "unsupported";

export class SvExpressionError extends Error {
  constructor(
    public readonly code: SvErrorCode,
    message: string,
    public readonly clause: string,
  ) {
    super(message);
    this.name = "SvExpressionError";
  }
}

// ---------------------------------------------------------------------------
// Expression AST and parser
// ---------------------------------------------------------------------------

export type UnaryOp = "+" | "-" | "~" | "!" | "&" | "~&" | "|" | "~|" | "^" | "~^";
export type BinaryOp =
  | "+" | "-" | "*" | "/" | "%" | "**"
  | "&" | "|" | "^" | "~^"
  | "==" | "!=" | "===" | "!==" | "==?" | "!=?"
  | "<" | "<=" | ">" | ">="
  | "&&" | "||"
  | "<<" | ">>" | "<<<" | ">>>";

export type CastKind = { kind: "size"; width: number } | { kind: "sign"; signed: boolean } | { kind: "type"; type: SvTypeKeyword };

export type InsideItem = { kind: "value"; expr: ExprNode } | { kind: "range"; lo: ExprNode; hi: ExprNode };

export type ExprNode = { text: string } & (
  | { kind: "num"; value: SvValue; sized: boolean }
  | { kind: "ref"; name: string }
  | { kind: "select"; name: string; msb: number; lsb: number }
  | { kind: "paren"; inner: ExprNode }
  | { kind: "unary"; op: UnaryOp; arg: ExprNode }
  | { kind: "binary"; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { kind: "cond"; cond: ExprNode; then: ExprNode; otherwise: ExprNode }
  | { kind: "concat"; parts: ExprNode[] }
  | { kind: "repl"; count: number; parts: ExprNode[] }
  | { kind: "stream"; dir: "<<" | ">>"; slice: number; parts: ExprNode[] }
  | { kind: "sysfn"; fn: "$signed" | "$unsigned"; arg: ExprNode }
  | { kind: "cast"; cast: CastKind; arg: ExprNode }
  | { kind: "inside"; left: ExprNode; items: InsideItem[] }
);

const ARITH = new Set<BinaryOp>(["+", "-", "*", "/", "%"]);
const BITWISE = new Set<BinaryOp>(["&", "|", "^", "~^"]);
const SHIFTS = new Set<BinaryOp>(["<<", ">>", "<<<", ">>>"]);
const RELATIONAL = new Set<BinaryOp>(["<", "<=", ">", ">="]);
const EQUALITY = new Set<BinaryOp>(["==", "!=", "===", "!==", "==?", "!=?"]);
const LOGICAL = new Set<BinaryOp>(["&&", "||"]);
const REDUCTIONS = new Set<UnaryOp>(["&", "~&", "|", "~|", "^", "~^"]);

/** Binding powers follow Table 11-2 (higher binds tighter). */
const BINARY_BP: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "~^": 4,
  "^~": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "===": 6,
  "!==": 6,
  "==?": 6,
  "!=?": 6,
  "<": 7,
  "<=": 7,
  ">": 7,
  ">=": 7,
  inside: 7,
  "<<": 8,
  ">>": 8,
  "<<<": 8,
  ">>>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
  "**": 11,
};
const UNARY_BP = 12;
const UNARY_OPS = new Set(["+", "-", "!", "~", "&", "~&", "|", "~|", "^", "~^", "^~"]);
const TYPE_SIZES: Record<string, number> = { byte: 8, shortint: 16, int: 32, longint: 64, integer: 32 };

const OPERATORS = [
  "<<<", ">>>", "===", "!==", "==?", "!=?",
  "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", "~&", "~|", "~^", "^~", "**",
  "+", "-", "*", "/", "%", "&", "|", "^", "~", "!", "<", ">", "?", ":", "(", ")", "{", "}", "[", "]", ",", "'",
];

interface Token {
  kind: "num" | "id" | "sys" | "op" | "eof";
  text: string;
  start: number;
  end: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const based = /\d[\d_]*\s*'[sS]?[bBoOdDhH]\s*[0-9a-fA-FxXzZ?_]+|'[sS]?[bBoOdDhH]\s*[0-9a-fA-FxXzZ?_]+/y;
  const decimal = /\d[\d_]*/y;
  const sys = /\$[A-Za-z_][A-Za-z0-9_$]*/y;
  const id = /[A-Za-z_][A-Za-z0-9_$]*/y;
  let i = 0;
  const tryRe = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m ? m[0] : null;
  };
  while (i < src.length) {
    if (/\s/.test(src[i])) {
      i += 1;
      continue;
    }
    let text: string | null;
    if ((text = tryRe(based))) tokens.push({ kind: "num", text, start: i, end: i + text.length });
    else if ((text = tryRe(decimal))) tokens.push({ kind: "num", text, start: i, end: i + text.length });
    else if ((text = tryRe(sys))) tokens.push({ kind: "sys", text, start: i, end: i + text.length });
    else if ((text = tryRe(id))) tokens.push({ kind: "id", text, start: i, end: i + text.length });
    else {
      const op = OPERATORS.find((o) => src.startsWith(o, i));
      if (!op) throw new SvExpressionError("syntax", `Unexpected character "${src[i]}".`, "Annex A");
      text = op;
      tokens.push({ kind: "op", text, start: i, end: i + text.length });
    }
    i += text.length;
  }
  tokens.push({ kind: "eof", text: "", start: src.length, end: src.length });
  return tokens;
}

class Parser {
  private i = 0;
  private readonly tokens: Token[];

  constructor(private readonly src: string) {
    this.tokens = tokenize(src);
  }

  parse(): ExprNode {
    const node = this.expr(0);
    const t = this.peek();
    if (t.kind !== "eof") this.unexpected(t);
    return node;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const t = this.tokens[this.i];
    this.i = Math.min(this.i + 1, this.tokens.length - 1);
    return t;
  }

  private isOp(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === "op" && t.text === text;
  }

  private expectOp(text: string): void {
    if (!this.isOp(text)) this.unexpected(this.peek(), `expected "${text}"`);
    this.next();
  }

  private unexpected(t: Token, detail?: string): never {
    const what = t.kind === "eof" ? "end of expression" : `"${t.text}"`;
    throw new SvExpressionError("syntax", `Syntax error at ${what}${detail ? `: ${detail}` : ""}.`, "Annex A");
  }

  private textFrom(start: number): string {
    return this.src.slice(start, this.tokens[this.i - 1]?.end ?? start).trim();
  }

  private expr(minBp: number): ExprNode {
    const start = this.peek().start;
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      if (t.kind === "op" && (t.text === "~&" || t.text === "~|")) {
        throw new SvExpressionError(
          "binary-reduction-operator",
          `SystemVerilog has no binary ${t.text} operator. ${t.text} is the unary reduction ${t.text === "~&" ? "NAND" : "NOR"}; for a bitwise ${t.text === "~&" ? "NAND" : "NOR"} write ~(a ${t.text[1]} b).`,
          "§11.4.9, Table 11-1",
        );
      }
      if (t.kind === "op" && t.text === "?") {
        if (minBp > 0) break;
        this.next();
        const then = this.expr(0);
        this.expectOp(":");
        const otherwise = this.expr(0);
        left = { kind: "cond", cond: left, then, otherwise, text: this.textFrom(start) };
        continue;
      }
      if (t.kind === "id" && t.text === "inside") {
        if (BINARY_BP.inside <= minBp) break;
        this.next();
        left = { kind: "inside", left, items: this.insideItems(), text: this.textFrom(start) };
        continue;
      }
      if (t.kind !== "op") break;
      const bp = BINARY_BP[t.text];
      if (bp === undefined || bp <= minBp) break;
      this.next();
      const right = this.expr(bp);
      const op = (t.text === "^~" ? "~^" : t.text) as BinaryOp;
      left = { kind: "binary", op, left, right, text: this.textFrom(start) };
    }
    return left;
  }

  private prefix(): ExprNode {
    const t = this.peek();
    if (t.kind === "op" && UNARY_OPS.has(t.text)) {
      this.next();
      const arg = this.expr(UNARY_BP);
      const op = (t.text === "^~" ? "~^" : t.text) as UnaryOp;
      return { kind: "unary", op, arg, text: this.textFrom(t.start) };
    }
    return this.primary();
  }

  private primary(): ExprNode {
    const t = this.peek();
    const start = t.start;
    if (t.kind === "num") {
      this.next();
      if (this.isOp("'") && this.isOp("(", 1)) {
        if (!/^\d[\d_]*$/.test(t.text)) this.unexpected(this.peek());
        this.next();
        this.next();
        const arg = this.expr(0);
        this.expectOp(")");
        const width = Number(t.text.replace(/_/g, ""));
        if (width <= 0) throw new SvExpressionError("syntax", "A size cast must be positive.", "§6.24.1");
        return { kind: "cast", cast: { kind: "size", width }, arg, text: this.textFrom(start) };
      }
      const lit = parseLiteral(t.text);
      return { kind: "num", value: lit.value, sized: lit.sized, text: t.text };
    }
    if (t.kind === "sys") {
      this.next();
      if (t.text !== "$signed" && t.text !== "$unsigned") {
        throw new SvExpressionError("unsupported", `${t.text} is not part of this model (only $signed and $unsigned).`, "§11.7");
      }
      this.expectOp("(");
      const arg = this.expr(0);
      this.expectOp(")");
      return { kind: "sysfn", fn: t.text, arg, text: this.textFrom(start) };
    }
    if (t.kind === "id") {
      this.next();
      const castFollows = this.isOp("'") && this.isOp("(", 1);
      if ((t.text === "signed" || t.text === "unsigned") && castFollows) {
        this.next();
        this.next();
        const arg = this.expr(0);
        this.expectOp(")");
        return { kind: "cast", cast: { kind: "sign", signed: t.text === "signed" }, arg, text: this.textFrom(start) };
      }
      if (TYPE_SIZES[t.text] !== undefined && castFollows) {
        this.next();
        this.next();
        const arg = this.expr(0);
        this.expectOp(")");
        return { kind: "cast", cast: { kind: "type", type: t.text as SvTypeKeyword }, arg, text: this.textFrom(start) };
      }
      if (this.isOp("[")) {
        this.next();
        const msb = this.constInt();
        let lsb = msb;
        if (this.isOp(":")) {
          this.next();
          lsb = this.constInt();
        }
        this.expectOp("]");
        if (lsb > msb) throw new SvExpressionError("unsupported", "This model only supports [msb:lsb] part-selects with msb >= lsb.", "§11.5.1");
        return { kind: "select", name: t.text, msb, lsb, text: this.textFrom(start) };
      }
      return { kind: "ref", name: t.text, text: t.text };
    }
    if (t.kind === "op" && t.text === "(") {
      this.next();
      const inner = this.expr(0);
      this.expectOp(")");
      return { kind: "paren", inner, text: this.textFrom(start) };
    }
    if (t.kind === "op" && t.text === "{") return this.brace();
    return this.unexpected(t);
  }

  private constInt(): number {
    const t = this.next();
    if (t.kind !== "num" || !/^\d[\d_]*$/.test(t.text)) this.unexpected(t, "this model needs a constant decimal index");
    return Number(t.text.replace(/_/g, ""));
  }

  private list(): ExprNode[] {
    const parts = [this.expr(0)];
    while (this.isOp(",")) {
      this.next();
      parts.push(this.expr(0));
    }
    return parts;
  }

  private brace(): ExprNode {
    const start = this.next().start; // {
    if (this.isOp("<<") || this.isOp(">>")) {
      const dir = this.next().text as "<<" | ">>";
      let slice = 1;
      const s = this.peek();
      if (s.kind === "num") {
        this.next();
        slice = Number(parseLiteral(s.text).value.aval);
        if (slice <= 0) throw new SvExpressionError("syntax", "A slice size must be positive.", "§11.4.14.2");
      } else if (s.kind === "id" && TYPE_SIZES[s.text] !== undefined) {
        this.next();
        slice = TYPE_SIZES[s.text];
      }
      this.expectOp("{");
      const parts = this.list();
      this.expectOp("}");
      this.expectOp("}");
      return { kind: "stream", dir, slice, parts, text: this.textFrom(start) };
    }
    const first = this.expr(0);
    if (this.isOp("{")) {
      if (first.kind !== "num" || !isKnown(first.value)) {
        throw new SvExpressionError("unsupported", "This model needs a constant number as the replication multiplier.", "§11.4.12.1");
      }
      this.next();
      const parts = this.list();
      this.expectOp("}");
      this.expectOp("}");
      return { kind: "repl", count: Number(first.value.aval), parts, text: this.textFrom(start) };
    }
    const parts = [first];
    while (this.isOp(",")) {
      this.next();
      parts.push(this.expr(0));
    }
    this.expectOp("}");
    return { kind: "concat", parts, text: this.textFrom(start) };
  }

  private insideItems(): InsideItem[] {
    this.expectOp("{");
    const items: InsideItem[] = [];
    do {
      if (items.length > 0) this.next(); // ,
      if (this.isOp("[")) {
        this.next();
        const lo = this.expr(0);
        this.expectOp(":");
        const hi = this.expr(0);
        this.expectOp("]");
        items.push({ kind: "range", lo, hi });
      } else {
        items.push({ kind: "value", expr: this.expr(0) });
      }
    } while (this.isOp(","));
    this.expectOp("}");
    return items;
  }
}

export function parseExpression(src: string): ExprNode {
  const node = new Parser(src).parse();
  checkStreams(node, true);
  return node;
}

/** A streaming concatenation may only be an assignment source or nested in another stream (§11.4.14). */
function checkStreams(n: ExprNode, allowed: boolean): void {
  const kids = children(n);
  if (n.kind === "stream") {
    if (!allowed) {
      throw new SvExpressionError(
        "stream-in-expression",
        "A streaming concatenation cannot be an operand of another operator without a cast; use it as the source of an assignment.",
        "§11.4.14",
      );
    }
    n.parts.forEach((p) => checkStreams(p, true));
    return;
  }
  kids.forEach((k) => checkStreams(k, n.kind === "paren" && allowed));
}

function children(n: ExprNode): ExprNode[] {
  switch (n.kind) {
    case "paren":
      return [n.inner];
    case "unary":
    case "sysfn":
    case "cast":
      return [n.arg];
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

const unwrap = (n: ExprNode): ExprNode => (n.kind === "paren" ? unwrap(n.inner) : n);

// ---------------------------------------------------------------------------
// Four-state operator primitives (§11.4)
// ---------------------------------------------------------------------------

const isUnknownBit = (b: Bit4) => b === "x" || b === "z";

/** Tables 11-11 … 11-14 (z behaves as x on input). */
export function bitwiseBit(op: "&" | "|" | "^" | "~^", a: Bit4, b: Bit4): Bit4 {
  if (op === "&") {
    if (a === "0" || b === "0") return "0";
    if (a === "1" && b === "1") return "1";
    return "x";
  }
  if (op === "|") {
    if (a === "1" || b === "1") return "1";
    if (a === "0" && b === "0") return "0";
    return "x";
  }
  if (isUnknownBit(a) || isUnknownBit(b)) return "x";
  const xor = a !== b;
  return (op === "^" ? xor : !xor) ? "1" : "0";
}

/** Table 11-15. */
export function notBit(a: Bit4): Bit4 {
  return a === "0" ? "1" : a === "1" ? "0" : "x";
}

function mapBits(width: number, signed: boolean, f: (i: number) => Bit4): SvValue {
  const bits: Bit4[] = [];
  for (let i = width - 1; i >= 0; i -= 1) bits.push(f(i));
  return fromBits(bits, signed);
}

/** Reduction operators (§11.4.9, Tables 11-16 … 11-18). Result is 1 bit, unsigned. */
export function reduce(op: UnaryOp, v: SvValue): Bit4 {
  const bits = bitsOf(v);
  let r: Bit4;
  if (op === "&" || op === "~&") r = bits.reduce<Bit4>((acc, b) => bitwiseBit("&", acc, b), "1");
  else if (op === "|" || op === "~|") r = bits.reduce<Bit4>((acc, b) => bitwiseBit("|", acc, b), "0");
  else r = bits.reduce<Bit4>((acc, b) => bitwiseBit("^", acc, b), "0");
  return op.startsWith("~") ? notBit(r) : r;
}

/** Truth value of an operand for !, && and || (§11.4.7): 1 if any bit is 1, 0 if all bits are 0, else x. */
export function truthOf(v: SvValue): Bit4 {
  if ((v.aval & ~v.bval) !== ZERO) return "1";
  if (v.bval !== ZERO) return "x";
  return "0";
}

/** == / != on equal-width operands (§11.4.5): a known mismatch decides; otherwise any x/z gives x. */
export function logicalEquality(l: SvValue, r: SvValue): Bit4 {
  const known = maskOf(l.width) & ~(l.bval | r.bval);
  if (((l.aval ^ r.aval) & known) !== ZERO) return "0";
  if ((l.bval | r.bval) !== ZERO) return "x";
  return "1";
}

/** === / !== (§11.4.5): x and z compared as values; never x. */
export function caseEquality(l: SvValue, r: SvValue): Bit4 {
  return l.aval === r.aval && l.bval === r.bval ? "1" : "0";
}

/** ==? / !=? (§11.4.6): x/z bits of the RIGHT operand are wildcards; x/z on the left are not. */
export function wildcardEquality(l: SvValue, r: SvValue): Bit4 {
  const considered = maskOf(l.width) & ~r.bval;
  const bothKnown = considered & ~l.bval;
  if (((l.aval ^ r.aval) & bothKnown) !== ZERO) return "0";
  if ((l.bval & considered) !== ZERO) return "x";
  return "1";
}

/** Generic stream re-ordering (§11.4.14.2). Bits are MSB first. */
export function streamBlocks(bits: Bit4[], dir: "<<" | ">>", slice: number): { input: Bit4[][]; output: Bit4[][] } {
  if (dir === ">>") return { input: [bits], output: [bits] };
  const input: Bit4[][] = [];
  // Slice from the right-most bit; the last (left-most) block may be shorter.
  for (let end = bits.length; end > 0; end -= slice) input.unshift(bits.slice(Math.max(0, end - slice), end));
  return { input, output: [...input].reverse() };
}

const not1 = (b: Bit4) => notBit(b);
const oneBit = (b: Bit4) => fromBits([b], false);

// ---------------------------------------------------------------------------
// Evaluation trace
// ---------------------------------------------------------------------------

export type ExprStep =
  | {
      kind: "context";
      /** Which context: the whole assignment, a comparison's operands, or a cast. */
      scope: "assignment" | "comparison" | "cast";
      text: string;
      width: number;
      signed: boolean;
      why: string;
      clause: string;
      surprising: boolean;
    }
  | {
      kind: "extend";
      text: string;
      from: SvValue;
      to: SvValue;
      mode: "sign" | "zero" | "same";
      why: string;
      clause: string;
      surprising: boolean;
    }
  | { kind: "op"; text: string; op: string; inputs: SvValue[]; result: SvValue; why: string; clause: string; surprising: boolean }
  | {
      kind: "assign";
      text: string;
      from: SvValue;
      to: SvValue;
      dropped: number;
      xToZero: boolean;
      why: string;
      clause: string;
      surprising: boolean;
    };

export interface EvalOptions {
  /** Misconception model: evaluate the RHS at its own width, ignoring the LHS. */
  ignoreLhsWidth?: boolean;
  /** Misconception model: `>>` behaves like `>>>` and vice versa. */
  swapRightShifts?: boolean;
  /** Misconception model: x/z operand bits are read as 0. */
  xAsZero?: boolean;
}

const signWord = (s: boolean) => (s ? "signed" : "unsigned");
const isLeaf = (n: ExprNode) => n.kind === "num" || n.kind === "ref" || n.kind === "select";

/** True for nodes whose operands inherit the surrounding context (Table 11-21). */
function isContextNode(n: ExprNode): boolean {
  switch (n.kind) {
    case "paren":
    case "cond":
      return true;
    case "unary":
      return n.op === "+" || n.op === "-" || n.op === "~";
    case "binary":
      return ARITH.has(n.op) || BITWISE.has(n.op) || SHIFTS.has(n.op) || n.op === "**";
    default:
      return false;
  }
}

/** Binary up to 8 bits, hex (when the nibbles allow) for wider values. */
export function formatCompact(v: SvValue): string {
  return v.width > 8 ? formatHexLiteral(v) : formatLiteral(v);
}

/** Describe a value for prose: `4'sb1100 (-4)`. */
function describe(v: SvValue): string {
  return isKnown(v) ? `${formatCompact(v)} (${formatDecimal(v)})` : formatCompact(v);
}

const bitsWord = (n: number) => `${n} bit${n === 1 ? "" : "s"}`;

const OP_NAMES: Record<string, string> = {
  "+": "Addition",
  "-": "Subtraction",
  "*": "Multiplication",
  "/": "Division",
  "%": "Modulus",
  "**": "Power",
};

class Evaluator {
  readonly steps: ExprStep[] = [];

  constructor(
    private readonly env: SvEnv,
    private readonly opts: EvalOptions,
  ) {}

  private lookup(name: string): SvVariable {
    const v = this.env[name];
    if (!v) throw new SvExpressionError("unknown-identifier", `"${name}" is not declared.`, "§6");
    return v;
  }

  private push(step: ExprStep): void {
    this.steps.push(step);
  }

  size(n: ExprNode): number {
    switch (n.kind) {
      case "num":
        return n.value.width;
      case "ref":
        return this.lookup(n.name).type.width;
      case "select":
        return n.msb - n.lsb + 1;
      case "paren":
        return this.size(n.inner);
      case "unary":
        return REDUCTIONS.has(n.op) || n.op === "!" ? 1 : this.size(n.arg);
      case "binary":
        if (ARITH.has(n.op) || BITWISE.has(n.op)) return Math.max(this.size(n.left), this.size(n.right));
        if (SHIFTS.has(n.op) || n.op === "**") return this.size(n.left);
        return 1;
      case "cond":
        return Math.max(this.size(n.then), this.size(n.otherwise));
      case "concat":
      case "stream":
        return n.parts.reduce((s, p) => s + this.size(p), 0);
      case "repl":
        return n.count * n.parts.reduce((s, p) => s + this.size(p), 0);
      case "sysfn":
        return this.size(n.arg);
      case "cast":
        if (n.cast.kind === "size") return n.cast.width;
        if (n.cast.kind === "type") return TYPE_SIZES[n.cast.type];
        return this.size(n.arg);
      case "inside":
        return 1;
    }
  }

  /** Expression type (§11.8.1). */
  sign(n: ExprNode): boolean {
    switch (n.kind) {
      case "num":
        return n.value.signed;
      case "ref":
        return this.lookup(n.name).type.signed;
      case "select":
        return false; // bit- and part-selects are unsigned
      case "paren":
        return this.sign(n.inner);
      case "unary":
        return REDUCTIONS.has(n.op) || n.op === "!" ? false : this.sign(n.arg);
      case "binary":
        if (ARITH.has(n.op) || BITWISE.has(n.op)) return this.sign(n.left) && this.sign(n.right);
        if (SHIFTS.has(n.op) || n.op === "**") return this.sign(n.left);
        return false; // comparisons and logical operators
      case "cond":
        return this.sign(n.then) && this.sign(n.otherwise);
      case "concat":
      case "repl":
      case "stream":
        return false;
      case "sysfn":
        return n.fn === "$signed";
      case "cast":
        if (n.cast.kind === "sign") return n.cast.signed;
        if (n.cast.kind === "type") return INTEGER_TYPES[n.cast.type].signed;
        return this.sign(n.arg);
      case "inside":
        return false;
    }
  }

  /** Simple operands reached by propagating a context down from `n` (§11.8.2). */
  contextOperands(n: ExprNode): ExprNode[] {
    if (!isContextNode(n)) return [n];
    switch (n.kind) {
      case "paren":
        return this.contextOperands(n.inner);
      case "unary":
        return this.contextOperands(n.arg);
      case "binary":
        return SHIFTS.has(n.op) || n.op === "**"
          ? this.contextOperands(n.left)
          : [...this.contextOperands(n.left), ...this.contextOperands(n.right)];
      case "cond":
        return [...this.contextOperands(n.then), ...this.contextOperands(n.otherwise)];
      default:
        return [n];
    }
  }

  private typeReason(nodes: ExprNode[], signed: boolean): string {
    if (signed) return nodes.length > 1 ? "every operand is signed" : `\`${nodes[0].text}\` is signed`;
    if (nodes.length === 1 && !isLeaf(nodes[0]) && !isContextNode(nodes[0])) {
      return `\`${nodes[0].text}\` produces an unsigned result`;
    }
    const culprits = Array.from(new Set(nodes.filter((o) => !this.sign(o)).map((o) => o.text)));
    const list = culprits.map((c) => `\`${c}\``).join(", ");
    const mixed = nodes.some((o) => this.sign(o));
    return `${list} ${culprits.length > 1 ? "are" : "is"} unsigned${mixed ? ", and one unsigned operand makes the whole expression unsigned" : ""}`;
  }

  private readLeaf(v: SvValue): SvValue {
    return this.opts.xAsZero ? toTwoState(v) : v;
  }

  evalSelf(n: ExprNode): SvValue {
    return isContextNode(n) ? this.evalCtx(n, this.size(n), this.sign(n)) : this.evalPrimary(n);
  }

  evalCtx(n: ExprNode, W: number, S: boolean): SvValue {
    switch (n.kind) {
      case "paren":
        return this.evalCtx(n.inner, W, S);
      case "unary": {
        if (!isContextNode(n)) break;
        const v = this.evalCtx(n.arg, W, S);
        let r: SvValue;
        let why: string;
        if (n.op === "~") {
          r = mapBits(W, S, (i) => notBit(bitAt(v, i)));
          why = `Bitwise NOT in ${W} bits: each 0↔1, and x or z becomes x (Table 11-15).`;
        } else if (!isKnown(v)) {
          r = allX(W, S);
          why = `The operand has an x/z bit, so the entire ${W}-bit result is x (§11.4.3).`;
        } else {
          const a = toBigInt(v, S) as bigint;
          r = fromBigInt(n.op === "-" ? -a : a, W, S);
          why = `Unary ${n.op} in ${W} bits, ${signWord(S)}: ${describe(v)} → ${describe(r)}.`;
        }
        this.push({ kind: "op", text: n.text, op: n.op, inputs: [v], result: r, why, clause: n.op === "~" ? "§11.4.8" : "§11.4.3", surprising: !isKnown(v) && n.op !== "~" });
        return r;
      }
      case "binary": {
        if (ARITH.has(n.op) || BITWISE.has(n.op)) {
          const l = this.evalCtx(n.left, W, S);
          const r = this.evalCtx(n.right, W, S);
          return BITWISE.has(n.op) ? this.bitwise(n, l, r, W, S) : this.arith(n, l, r, W, S);
        }
        if (SHIFTS.has(n.op) || n.op === "**") {
          const l = this.evalCtx(n.left, W, S);
          const count = this.evalSelf(n.right);
          return n.op === "**" ? this.power(n, l, count, W, S) : this.shift(n, l, count, W, S);
        }
        break;
      }
      case "cond": {
        const c = truthOf(this.evalSelf(n.cond));
        const t = this.evalCtx(n.then, W, S);
        const e = this.evalCtx(n.otherwise, W, S);
        const r =
          c === "1" ? t : c === "0" ? e : mapBits(W, S, (i) => (bitAt(t, i) === bitAt(e, i) && !isUnknownBit(bitAt(t, i)) ? bitAt(t, i) : "x"));
        const why =
          c === "x"
            ? "The condition is unknown, so both branches are combined bit by bit: equal known bits survive, the rest become x (Table 11-20)."
            : `The condition is ${c}, so the ${c === "1" ? "first" : "second"} branch is the result, already sized to ${W} bits.`;
        this.push({ kind: "op", text: n.text, op: "?:", inputs: [t, e], result: r, why, clause: "§11.4.11", surprising: c === "x" });
        return r;
      }
      default:
        break;
    }
    return this.convert(n, this.evalPrimary(n), W, S);
  }

  /** A simple operand meets its context: extend (sign only if the propagated type is signed). */
  private convert(n: ExprNode, v: SvValue, W: number, S: boolean): SvValue {
    const to = resize(v, W, S, S);
    const leaf = isLeaf(n);
    if (!leaf && v.width === W && v.signed === S) return to;
    const ownSigned = v.signed;
    const msb = bitAt(v, v.width - 1);
    let mode: "sign" | "zero" | "same" = "same";
    let why: string;
    let surprising = false;
    if (W > v.width && S) {
      mode = "sign";
      why = `\`${n.text}\` is sign-extended from ${v.width} to ${W} bits: the expression is signed, so copies of its sign bit (${msb}) fill the new positions.`;
    } else if (W > v.width) {
      mode = "zero";
      if (ownSigned && msb !== "0") {
        surprising = true;
        why = `\`${n.text}\` ${leaf ? "is declared" : "is"} signed, but the expression is unsigned, so it is zero-extended: ${formatCompact(v)} becomes ${formatCompact(to)}, which is ${formatValue(to)}, not ${formatValue(v)}.`;
      } else {
        why = `\`${n.text}\` is zero-extended from ${v.width} to ${W} bits (unsigned expression).`;
      }
    } else if (ownSigned && !S && msb !== "0") {
      surprising = true;
      why = `\`${n.text}\` keeps its ${W} bits, but the unsigned context reads ${formatCompact(v)} as ${formatValue(to)}, not ${formatValue(v)}.`;
    } else {
      why = `\`${n.text}\` is already ${bitsWord(W)}; nothing to extend.`;
    }
    this.push({ kind: "extend", text: n.text, from: v, to, mode, why, clause: "§11.8.2", surprising });
    return to;
  }

  private arith(n: ExprNode & { kind: "binary" }, l: SvValue, r: SvValue, W: number, S: boolean): SvValue {
    let res: SvValue;
    let why: string;
    let surprising = false;
    if (!isKnown(l) || !isKnown(r)) {
      res = allX(W, S);
      surprising = true;
      why = `An operand has an x or z bit, so the entire ${W}-bit result of ${n.op} is x (§11.4.3).`;
    } else {
      const a = toBigInt(l, S) as bigint;
      const b = toBigInt(r, S) as bigint;
      if ((n.op === "/" || n.op === "%") && b === ZERO) {
        res = allX(W, S);
        surprising = true;
        why = `Division or modulus by zero gives x (§11.4.3).`;
      } else {
        const exact = n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : a % b;
        res = fromBigInt(exact, W, S);
        const kept = toBigInt(res, S) as bigint;
        why = `${OP_NAMES[n.op]} in ${W} bits, ${signWord(S)}: ${a} ${n.op} ${b} = ${exact}.`;
        if (kept !== exact) {
          surprising = true;
          why += ` That needs more than ${W} bits, so only the low ${W} bits survive: ${describe(res)}.`;
        }
      }
    }
    this.push({ kind: "op", text: n.text, op: n.op, inputs: [l, r], result: res, why, clause: "§11.4.3, §11.6.1", surprising });
    return res;
  }

  private bitwise(n: ExprNode & { kind: "binary" }, l: SvValue, r: SvValue, W: number, S: boolean): SvValue {
    const op = n.op as "&" | "|" | "^" | "~^";
    const res = mapBits(W, S, (i) => bitwiseBit(op, bitAt(l, i), bitAt(r, i)));
    const why = `Bitwise ${op} combines bit i of each operand using its truth table; an x/z input bit only makes that output bit x when the other input does not decide it.`;
    this.push({ kind: "op", text: n.text, op, inputs: [l, r], result: res, why, clause: "§11.4.8, Tables 11-11–11-14", surprising: false });
    return res;
  }

  private shift(n: ExprNode & { kind: "binary" }, l: SvValue, count: SvValue, W: number, S: boolean): SvValue {
    let op = n.op;
    if (this.opts.swapRightShifts && (op === ">>" || op === ">>>")) op = op === ">>" ? ">>>" : ">>";
    const k = toBigInt(count, false);
    let res: SvValue;
    let why: string;
    let surprising = false;
    if (k === null) {
      res = allX(W, S);
      surprising = true;
      why = "The shift count has an x or z bit, so the result is unknown (§11.4.10).";
    } else {
      const s = Number(k > big(W) ? big(W) : k);
      if (op === "<<" || op === "<<<") {
        res = makeValue(W, S, l.aval << big(s), l.bval << big(s));
        why = `Left shift by ${s}: vacated low bits fill with 0 (${op} and ${op === "<<" ? "<<<" : "<<"} behave the same).`;
      } else {
        const msb = bitAt(l, W - 1);
        const fill: Bit4 = op === ">>>" && S ? msb : "0";
        res = mapBits(W, S, (i) => (i + s < W ? bitAt(l, i + s) : fill));
        if (op === ">>") {
          why = `Logical right shift by ${s}: vacated high bits fill with 0${S && msb !== "0" ? ", even though the expression is signed" : ""}.`;
          surprising = S && msb !== "0" && s > 0;
        } else if (S) {
          why = `Arithmetic right shift by ${s}: the expression is signed, so vacated bits copy the sign bit (${msb}).`;
        } else {
          why = `>>> on an unsigned expression fills with 0, exactly like >>; only a signed expression gets sign fill.`;
          surprising = msb !== "0" && s > 0;
        }
      }
      why += ` The count is self-determined and read as unsigned.`;
    }
    this.push({ kind: "op", text: n.text, op, inputs: [l, count], result: res, why: `${why}`, clause: "§11.4.10", surprising });
    return res;
  }

  private power(n: ExprNode & { kind: "binary" }, l: SvValue, e: SvValue, W: number, S: boolean): SvValue {
    let res: SvValue;
    if (!isKnown(l) || !isKnown(e)) res = allX(W, S);
    else {
      const base = toBigInt(l, S) as bigint;
      const exp = toBigInt(e) as bigint;
      if (exp < ZERO) {
        // Table 11-4
        if (base === ZERO) res = allX(W, S);
        else if (base === ONE) res = fromBigInt(ONE, W, S);
        else if (base === -ONE) res = fromBigInt(exp % big(2) === ZERO ? ONE : -ONE, W, S);
        else res = fromBigInt(ZERO, W, S);
      } else {
        let acc = ONE;
        let b = BigInt.asUintN(W, base);
        let x = exp;
        while (x > ZERO) {
          if (x & ONE) acc = BigInt.asUintN(W, acc * b);
          b = BigInt.asUintN(W, b * b);
          x >>= ONE;
        }
        res = fromBigInt(acc, W, S);
      }
    }
    const why = `Power in ${W} bits (the size of the left operand and the context); the exponent is self-determined: ${describe(res)}.`;
    this.push({ kind: "op", text: n.text, op: "**", inputs: [l, e], result: res, why, clause: "§11.4.3, Table 11-4", surprising: false });
    return res;
  }

  private compare(n: ExprNode, op: BinaryOp, left: ExprNode, right: ExprNode): SvValue {
    const W = Math.max(this.size(left), this.size(right));
    const S = this.sign(left) && this.sign(right);
    const mixed = !S && (this.sign(left) || this.sign(right));
    this.push({
      kind: "context",
      scope: "comparison",
      text: n.text,
      width: W,
      signed: S,
      why: `The operands of ${op} are sized to each other: max(${this.size(left)}, ${this.size(right)}) = ${W} bits, compared as ${signWord(S)} because ${this.typeReason([left, right], S)}. The result is 1 bit, unsigned.`,
      clause: RELATIONAL.has(op) ? "§11.8.2, §11.4.4" : "§11.8.2, §11.4.5",
      surprising: mixed,
    });
    const l = this.evalCtx(left, W, S);
    const r = this.evalCtx(right, W, S);
    let bit: Bit4;
    let why: string;
    if (RELATIONAL.has(op)) {
      if (!isKnown(l) || !isKnown(r)) {
        bit = "x";
        why = "An operand has an x or z bit, so the relation is 1'bx (§11.4.4).";
      } else {
        const a = toBigInt(l, S) as bigint;
        const b = toBigInt(r, S) as bigint;
        const t = op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
        bit = t ? "1" : "0";
        why = `${signWord(S)[0].toUpperCase()}${signWord(S).slice(1)} comparison: ${a} ${op} ${b} is ${t ? "true" : "false"}.`;
      }
    } else if (op === "==" || op === "!=") {
      const eq = logicalEquality(l, r);
      bit = op === "==" ? eq : not1(eq);
      why =
        eq === "x"
          ? `Every known bit matches but an x/z bit makes the relation ambiguous, so ${op} gives 1'bx.`
          : `Bit-by-bit comparison: ${eq === "1" ? "all bits match" : "a known bit differs, which decides the answer even with x/z elsewhere"}.`;
    } else if (op === "===" || op === "!==") {
      const eq = caseEquality(l, r);
      bit = op === "===" ? eq : not1(eq);
      why = `Case equality compares x and z as values, so the result is always 0 or 1.`;
    } else {
      const eq = wildcardEquality(l, r);
      bit = op === "==?" ? eq : not1(eq);
      why = `Wildcard equality: x/z bits in the right operand match anything; x/z bits in the left operand are not wildcards.`;
    }
    const res = oneBit(bit);
    this.push({ kind: "op", text: n.text, op, inputs: [l, r], result: res, why, clause: RELATIONAL.has(op) ? "§11.4.4" : op.endsWith("?") ? "§11.4.6" : "§11.4.5", surprising: false });
    return res;
  }

  evalPrimary(n: ExprNode): SvValue {
    switch (n.kind) {
      case "num":
        return this.readLeaf(n.value);
      case "ref": {
        const v = this.lookup(n.name);
        return this.readLeaf(reinterpret(v.value, v.type.signed));
      }
      case "select": {
        const v = this.lookup(n.name);
        if (n.msb >= v.type.width) {
          throw new SvExpressionError("select-out-of-range", `${n.text} is outside ${n.name}[${v.type.width - 1}:0].`, "§11.5.1");
        }
        const w = n.msb - n.lsb + 1;
        const base = this.readLeaf(v.value);
        return makeValue(w, false, base.aval >> big(n.lsb), base.bval >> big(n.lsb));
      }
      case "unary": {
        // Reductions and logical NOT: operand self-determined, 1-bit unsigned result.
        const v = this.evalSelf(n.arg);
        const bit = n.op === "!" ? not1(truthOf(v)) : reduce(n.op, v);
        const res = oneBit(bit);
        const why =
          n.op === "!"
            ? `Logical NOT of the operand's truth value (${truthOf(v)}).`
            : `Reduction ${n.op} folds all ${v.width} bits of the self-determined operand into one bit.`;
        this.push({ kind: "op", text: n.text, op: n.op, inputs: [v], result: res, why, clause: n.op === "!" ? "§11.4.7" : "§11.4.9", surprising: false });
        return res;
      }
      case "binary": {
        if (RELATIONAL.has(n.op) || EQUALITY.has(n.op)) return this.compare(n, n.op, n.left, n.right);
        if (LOGICAL.has(n.op)) {
          const l = truthOf(this.evalSelf(n.left));
          const r = truthOf(this.evalSelf(n.right));
          const bit: Bit4 =
            n.op === "&&"
              ? l === "0" || r === "0"
                ? "0"
                : l === "1" && r === "1"
                  ? "1"
                  : "x"
              : l === "1" || r === "1"
                ? "1"
                : l === "0" && r === "0"
                  ? "0"
                  : "x";
          const res = oneBit(bit);
          this.push({ kind: "op", text: n.text, op: n.op, inputs: [oneBit(l), oneBit(r)], result: res, why: `Each operand is reduced to a truth value (${l} and ${r}) and then combined.`, clause: "§11.4.7", surprising: false });
          return res;
        }
        break;
      }
      case "concat":
      case "repl": {
        const vals = n.parts.map((p) => {
          if (p.kind === "num" && !p.sized) {
            throw new SvExpressionError(
              "unsized-in-concatenation",
              `\`${p.text}\` is an unsized number; concatenation operands must be sized (write e.g. 1'b1).`,
              "§11.4.12",
            );
          }
          return this.evalSelf(p);
        });
        let res = vals.reduce((acc, v) => makeValue(acc.width + v.width, false, (acc.aval << big(v.width)) | v.aval, (acc.bval << big(v.width)) | v.bval), makeValue(0, false, ZERO));
        if (n.kind === "repl") {
          const one = res;
          res = makeValue(0, false, ZERO);
          for (let i = 0; i < n.count; i += 1) {
            res = makeValue(res.width + one.width, false, (res.aval << big(one.width)) | one.aval, (res.bval << big(one.width)) | one.bval);
          }
        }
        this.push({
          kind: "op",
          text: n.text,
          op: n.kind === "repl" ? "{n{}}" : "{}",
          inputs: vals,
          result: res,
          why: `Each operand keeps its own (self-determined) size; the ${res.width}-bit result is unsigned.`,
          clause: n.kind === "repl" ? "§11.4.12.1, §11.8.1" : "§11.4.12, §11.8.1",
          surprising: false,
        });
        return res;
      }
      case "stream": {
        const vals = n.parts.map((p) => this.evalSelf(p));
        const bits = vals.flatMap((v) => bitsOf(v));
        const { output } = streamBlocks(bits, n.dir, n.slice);
        const res = fromBits(output.flat(), false);
        this.push({
          kind: "op",
          text: n.text,
          op: n.dir,
          inputs: vals,
          result: res,
          why:
            n.dir === ">>"
              ? "{>>{}} streams blocks left to right: the order is unchanged."
              : `{<<${n.slice > 1 ? ` ${n.slice}` : ""}{}} cuts the stream into ${n.slice}-bit blocks from the right and reverses the block order, keeping bits inside each block.`,
          clause: "§11.4.14.2",
          surprising: false,
        });
        return res;
      }
      case "sysfn": {
        const v = this.evalSelf(n.arg);
        const res = reinterpret(v, n.fn === "$signed");
        this.push({
          kind: "op",
          text: n.text,
          op: n.fn,
          inputs: [v],
          result: res,
          why: `${n.fn} returns the same ${bitsWord(v.width)}, now ${signWord(res.signed)}: ${formatCompact(reinterpret(v, false))} reads as ${formatValue(res)}.`,
          clause: "§11.7",
          surprising: false,
        });
        return res;
      }
      case "cast": {
        if (n.cast.kind === "sign") {
          const v = this.evalSelf(n.arg);
          const res = reinterpret(v, n.cast.signed);
          this.push({ kind: "op", text: n.text, op: `${signWord(n.cast.signed)}'`, inputs: [v], result: res, why: `A sign cast keeps all ${bitsWord(v.width)} and changes only the type: ${formatCompact(reinterpret(v, false))} reads as ${formatValue(res)}.`, clause: "§6.24.1", surprising: false });
          return res;
        }
        const N = n.cast.kind === "size" ? n.cast.width : TYPE_SIZES[n.cast.type];
        const S = n.cast.kind === "size" ? this.sign(n.arg) : INTEGER_TYPES[n.cast.type].signed;
        const inner = this.sign(n.arg);
        const W = Math.max(N, this.size(n.arg));
        this.push({
          kind: "context",
          scope: "cast",
          text: n.text,
          width: W,
          signed: inner,
          why: `A cast returns what a ${N}-bit variable would hold after being assigned the expression, so \`${n.arg.text}\` is evaluated in max(${N}, ${this.size(n.arg)}) = ${W} bits.`,
          clause: "§6.24.1",
          surprising: N > this.size(n.arg),
        });
        const v = this.evalCtx(n.arg, W, inner);
        let res = resize(v, N, inner, S);
        if (n.cast.kind === "type" && !INTEGER_TYPES[n.cast.type].fourState) res = toTwoState(res);
        this.push({ kind: "op", text: n.text, op: "cast", inputs: [v], result: res, why: `The cast result is ${N} bits, ${signWord(S)}: ${describe(res)}.`, clause: "§6.24.1", surprising: false });
        return res;
      }
      case "inside": {
        const results = n.items.map((it) => this.insideMatch(n.left, it));
        const bit: Bit4 = results.includes("1") ? "1" : results.includes("x") ? "x" : "0";
        const res = oneBit(bit);
        this.push({ kind: "op", text: n.text, op: "inside", inputs: results.map(oneBit), result: res, why: "Each set member is compared with ==? (x/z in the member are wildcards); the result is the OR of those comparisons.", clause: "§11.4.13", surprising: false });
        return res;
      }
      default:
        break;
    }
    throw new SvExpressionError("unsupported", `\`${n.text}\` is not supported by this model.`, "—");
  }

  private insideMatch(left: ExprNode, item: InsideItem): Bit4 {
    if (item.kind === "value") {
      const W = Math.max(this.size(left), this.size(item.expr));
      const S = this.sign(left) && this.sign(item.expr);
      return wildcardEquality(this.evalCtx(left, W, S), this.evalCtx(item.expr, W, S));
    }
    const rel = (op: "<=" | ">=", bound: ExprNode): Bit4 => {
      const W = Math.max(this.size(left), this.size(bound));
      const S = this.sign(left) && this.sign(bound);
      const l = this.evalCtx(left, W, S);
      const b = this.evalCtx(bound, W, S);
      if (!isKnown(l) || !isKnown(b)) return "x";
      const x = toBigInt(l, S) as bigint;
      const y = toBigInt(b, S) as bigint;
      return (op === ">=" ? x >= y : x <= y) ? "1" : "0";
    };
    return bitwiseBit("&", rel(">=", item.lo), rel("<=", item.hi));
  }

  /** Assignment: §11.8.3 / §10.7, with streams left-aligned (§11.4.14). */
  assign(name: string, target: SvVarType, rhs: ExprNode): { final: SvValue; rhsValue: SvValue; contextWidth: number } {
    const root = unwrap(rhs);
    const tw = target.width;
    if (root.kind === "stream") {
      const v = this.evalPrimary(root);
      if (v.width > tw) {
        throw new SvExpressionError("stream-wider-than-target", `The ${v.width}-bit stream does not fit in the ${tw}-bit target ${name}.`, "§11.4.14");
      }
      let final = makeValue(tw, target.signed, v.aval << big(tw - v.width), v.bval << big(tw - v.width));
      const xToZero = !target.fourState && !isKnown(final);
      if (!target.fourState) final = toTwoState(final);
      this.push({
        kind: "assign",
        text: `${name} = ${rhs.text}`,
        from: v,
        to: final,
        dropped: 0,
        xToZero,
        why:
          tw > v.width
            ? `A stream is left-aligned in a wider target: ${tw - v.width} zero bits are added on the RIGHT, not the left.`
            : `The stream exactly fills ${name}.`,
        clause: "§11.4.14",
        surprising: tw > v.width,
      });
      return { final, rhsValue: v, contextWidth: v.width };
    }

    const rw = this.size(rhs);
    const rs = this.sign(rhs);
    const W = this.opts.ignoreLhsWidth ? rw : Math.max(tw, rw);
    this.push({
      kind: "context",
      scope: "assignment",
      text: `${name} = ${rhs.text}`,
      width: W,
      signed: rs,
      why: isContextNode(rhs)
        ? `${name} is ${bitsWord(tw)} and \`${rhs.text}\` is ${bitsWord(rw)} on its own, so the right-hand side is evaluated in max(${tw}, ${rw}) = ${bitsWord(W)}` +
          `${tw > rw ? ": the LHS widens the context, so operands are extended BEFORE the operation" : ""}. ` +
          `Its type is ${signWord(rs)} because ${this.typeReason(this.contextOperands(rhs), rs)}; the LHS never changes the type.`
        : `\`${rhs.text}\` is a self-determined ${rw}-bit ${signWord(rs)} result (its own operands are sized separately), stored into the ${tw}-bit ${name}.`,
      clause: "§11.6.1, §11.8.1",
      surprising: (tw > rw && isContextNode(rhs)) || (!rs && this.contextOperands(rhs).some((o) => this.sign(o))),
    });
    const v = this.evalCtx(rhs, W, rs);
    let final = resize(v, tw, rs, target.signed);
    const dropped = Math.max(0, W - tw);
    const xToZero = !target.fourState && !isKnown(final);
    if (!target.fourState) final = toTwoState(final);
    const exact = toBigInt(v, rs);
    const kept = toBigInt(final, target.signed);
    const changed = exact !== null && kept !== null && exact !== kept;
    let why: string;
    if (dropped > 0) {
      why = `The value is ${bitsWord(W)} but ${name} holds ${tw}, so the ${dropped} MSB${dropped === 1 ? " is" : "s are"} discarded: ${formatCompact(reinterpret(v, false))} → ${formatCompact(reinterpret(final, false))}.`;
    } else if (W < tw) {
      why = `The ${W}-bit value is ${rs ? "sign" : "zero"}-extended to ${tw} bits because the right-hand side is ${signWord(rs)}.`;
    } else {
      why = `Widths match: the bits are copied into ${name} unchanged.`;
    }
    if (xToZero) why += ` ${name} is a 2-state type, so every x/z bit becomes 0.`;
    why += isKnown(final)
      ? ` ${name} is ${signWord(target.signed)}, so it reads ${formatCompact(reinterpret(final, false))} as ${formatDecimal(final)}.`
      : ` ${name} now holds ${formatCompact(reinterpret(final, false))}.`;
    this.push({
      kind: "assign",
      text: `${name} = ${rhs.text}`,
      from: v,
      to: final,
      dropped,
      xToZero,
      why,
      clause: xToZero ? "§10.7, §6.11.2" : "§10.7, §11.8.3",
      surprising: xToZero || changed,
    });
    return { final, rhsValue: v, contextWidth: W };
  }
}

// ---------------------------------------------------------------------------
// Public evaluation API
// ---------------------------------------------------------------------------

export type OperandRole = "context" | "self" | "compare" | "cast";

export interface OperandInfo {
  text: string;
  kind: "variable" | "literal" | "select";
  width: number;
  signed: boolean;
  value: SvValue;
  role: OperandRole;
  /** The declaration for variables, e.g. `logic signed [3:0] a`. */
  declaration?: string;
}

export interface EvalError {
  code: SvErrorCode;
  message: string;
  clause: string;
}

export interface ExpressionEvaluation {
  ok: true;
  source: string;
  /** Self-determined size and type (Table 11-21, §11.8.1). */
  width: number;
  signed: boolean;
  value: SvValue;
  operands: OperandInfo[];
  steps: ExprStep[];
  insight: string;
}

export interface AssignmentEvaluation {
  ok: true;
  source: string;
  target: { name: string; declaration: string; type: SvVarType };
  rhsWidth: number;
  rhsSigned: boolean;
  contextWidth: number;
  operands: OperandInfo[];
  steps: ExprStep[];
  /** RHS value at the context width, before the assignment resizes it. */
  rhsValue: SvValue;
  final: SvValue;
  insight: string;
}

export interface EvaluationFailure {
  ok: false;
  source: string;
  error: EvalError;
}

function toFailure(source: string, e: unknown): EvaluationFailure {
  if (e instanceof SvExpressionError) return { ok: false, source, error: { code: e.code, message: e.message, clause: e.clause } };
  throw e;
}

function collectOperands(n: ExprNode, env: SvEnv, role: OperandRole, ev: Evaluator, out: OperandInfo[]): void {
  const add = (info: OperandInfo) => {
    if (!out.some((o) => o.text === info.text && o.role === info.role)) out.push(info);
  };
  switch (n.kind) {
    case "num":
      add({ text: n.text, kind: "literal", width: n.value.width, signed: n.value.signed, value: n.value, role });
      return;
    case "ref": {
      const v = env[n.name];
      if (!v) return;
      add({ text: n.text, kind: "variable", width: v.type.width, signed: v.type.signed, value: v.value, role, declaration: `${typeToSource(v.decl)} ${n.name}` });
      return;
    }
    case "select": {
      const v = env[n.name];
      if (!v) return;
      add({ text: n.text, kind: "select", width: n.msb - n.lsb + 1, signed: false, value: ev.evalPrimary(n), role });
      return;
    }
    case "paren":
      collectOperands(n.inner, env, role, ev, out);
      return;
    case "unary":
      collectOperands(n.arg, env, isContextNode(n) ? role : "self", ev, out);
      return;
    case "binary":
      if (ARITH.has(n.op) || BITWISE.has(n.op)) {
        collectOperands(n.left, env, role, ev, out);
        collectOperands(n.right, env, role, ev, out);
      } else if (SHIFTS.has(n.op) || n.op === "**") {
        collectOperands(n.left, env, role, ev, out);
        collectOperands(n.right, env, "self", ev, out);
      } else {
        const r: OperandRole = LOGICAL.has(n.op) ? "self" : "compare";
        collectOperands(n.left, env, r, ev, out);
        collectOperands(n.right, env, r, ev, out);
      }
      return;
    case "cond":
      collectOperands(n.cond, env, "self", ev, out);
      collectOperands(n.then, env, role, ev, out);
      collectOperands(n.otherwise, env, role, ev, out);
      return;
    case "concat":
    case "repl":
    case "stream":
      n.parts.forEach((p) => collectOperands(p, env, "self", ev, out));
      return;
    case "sysfn":
      collectOperands(n.arg, env, "self", ev, out);
      return;
    case "cast":
      collectOperands(n.arg, env, n.cast.kind === "sign" ? "self" : "cast", ev, out);
      return;
    case "inside":
      children(n).forEach((c) => collectOperands(c, env, "compare", ev, out));
      return;
  }
}

/** The sentence(s) that explain the outcome: the surprising steps, or else the deciding context and operation. */
function insightOf(steps: ExprStep[]): string {
  const surprising = steps.filter((s) => s.surprising);
  if (surprising.length > 0) {
    return surprising
      .slice(0, 2)
      .map((s) => s.why)
      .join(" ");
  }
  const contexts = steps.filter((s) => s.kind === "context");
  const ctx = contexts.find((s) => s.kind === "context" && s.scope === "comparison") ?? contexts[0];
  const op = [...steps].reverse().find((s) => s.kind === "op");
  return [ctx?.why, op?.why].filter(Boolean).join(" ");
}

/** Evaluate an expression on its own (self-determined: no LHS context). */
export function evaluateExpression(source: string, env: SvEnv, opts: EvalOptions = {}): ExpressionEvaluation | EvaluationFailure {
  try {
    const node = parseExpression(source);
    const ev = new Evaluator(env, opts);
    const root = unwrap(node);
    const width = root.kind === "stream" ? ev.size(root) : ev.size(node);
    const signed = ev.sign(node);
    const operands: OperandInfo[] = [];
    collectOperands(node, env, "context", new Evaluator(env, opts), operands);
    const value = root.kind === "stream" ? ev.evalPrimary(root) : ev.evalSelf(node);
    return { ok: true, source, width, signed, value, operands, steps: ev.steps, insight: insightOf(ev.steps) };
  } catch (e) {
    return toFailure(source, e);
  }
}

/** Evaluate `target = expr;` with declarations elaborated first. */
export function evaluateAssignment(decls: SvDecl[], target: SvDecl, expr: string, opts: EvalOptions = {}): AssignmentEvaluation | EvaluationFailure {
  const source = `${target.name} = ${expr};`;
  try {
    const env = buildEnv(decls);
    const node = parseExpression(expr);
    const type = declType(target);
    const ev = new Evaluator(env, opts);
    const operands: OperandInfo[] = [];
    collectOperands(node, env, "context", new Evaluator(env, opts), operands);
    const rhsWidth = ev.size(node);
    const rhsSigned = ev.sign(node);
    const { final, rhsValue, contextWidth } = ev.assign(target.name, type, node);
    return {
      ok: true,
      source,
      target: { name: target.name, declaration: `${typeToSource(target)} ${target.name}`, type },
      rhsWidth,
      rhsSigned,
      contextWidth,
      operands,
      steps: ev.steps,
      rhsValue,
      final,
      insight: insightOf(ev.steps),
    };
  } catch (e) {
    return toFailure(source, e);
  }
}

// ---------------------------------------------------------------------------
// Misconception models (used to build diagnostic prediction options)
// ---------------------------------------------------------------------------

/**
 * "Ordinary integer math": every operand keeps its declared sign, nothing is
 * ever truncated, and x/z bits are read as 0. Returns null where that
 * intuition has no answer (division by zero).
 */
export function mathIntuition(expr: string, env: SvEnv): bigint | null {
  const node = parseExpression(expr);
  const ev = new Evaluator(env, { xAsZero: true });
  const go = (n: ExprNode): bigint | null => {
    switch (n.kind) {
      case "num":
      case "ref":
      case "select": {
        const v = ev.evalPrimary(n);
        return toBigInt(v) as bigint;
      }
      case "paren":
        return go(n.inner);
      case "unary": {
        if (n.op === "+" || n.op === "-") {
          const a = go(n.arg);
          return a === null ? null : n.op === "-" ? -a : a;
        }
        break;
      }
      case "binary": {
        const a = go(n.left);
        const b = go(n.right);
        if (a === null || b === null) return null;
        switch (n.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return b === ZERO ? null : a / b;
          case "%":
            return b === ZERO ? null : a % b;
          case "<":
            return a < b ? ONE : ZERO;
          case "<=":
            return a <= b ? ONE : ZERO;
          case ">":
            return a > b ? ONE : ZERO;
          case ">=":
            return a >= b ? ONE : ZERO;
          case "==":
          case "===":
            return a === b ? ONE : ZERO;
          case "!=":
          case "!==":
            return a !== b ? ONE : ZERO;
          case "<<":
          case "<<<":
            return a << b;
          case ">>":
          case ">>>":
            return a >> b; // floor division: what C programmers expect of a signed shift
          default:
            break;
        }
        break;
      }
      default:
        break;
    }
    const v = ev.evalSelf(n);
    return toBigInt(v);
  };
  try {
    return go(node);
  } catch (e) {
    if (e instanceof SvExpressionError) return null;
    throw e;
  }
}

/**
 * "Optimistic X": try every 0/1 combination for the x/z bits of the
 * variables (up to 8 unknown bits) and keep only the result bits that never
 * change. This is what one might expect from real gates; the LRM is more
 * pessimistic for arithmetic (§11.4.3).
 */
export function optimisticX(decls: SvDecl[], target: SvDecl, expr: string): SvValue | null {
  const env = buildEnv(decls);
  const unknown: { name: string; bit: number }[] = [];
  Object.values(env).forEach((v) => {
    for (let i = 0; i < v.type.width; i += 1) if (isUnknownBit(bitAt(v.value, i))) unknown.push({ name: v.decl.name, bit: i });
  });
  if (unknown.length === 0 || unknown.length > 8) return null;
  let merged: SvValue | null = null;
  for (let combo = 0; combo < 1 << unknown.length; combo += 1) {
    const trial: SvEnv = {};
    Object.entries(env).forEach(([k, v]) => {
      trial[k] = { ...v, value: toTwoState(v.value) };
    });
    unknown.forEach((u, j) => {
      if ((combo >> j) & 1) {
        const cur = trial[u.name].value;
        trial[u.name] = { ...trial[u.name], value: { ...cur, aval: cur.aval | (ONE << big(u.bit)) } };
      }
    });
    const ev = new Evaluator(trial, {});
    const { final } = ev.assign(target.name, declType(target), parseExpression(expr));
    const prev: SvValue | null = merged;
    merged = prev === null ? final : mapBits(final.width, final.signed, (i) => (bitAt(prev, i) === bitAt(final, i) ? bitAt(final, i) : "x"));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Expression-trap scenarios (SignednessVisualizer)
// ---------------------------------------------------------------------------

export interface TrapVariant {
  id: string;
  label: string;
  expr: string;
  /** Overrides the scenario's target declaration (e.g. a 9-bit LHS). */
  target?: SvDecl;
  role: "trap" | "fix" | "contrast";
}

export interface EditableOperand {
  name: string;
  widths?: number[];
  min?: number;
  max?: number;
}

export interface TrapScenario {
  id: string;
  title: string;
  summary: string;
  decls: SvDecl[];
  target: SvDecl;
  variants: TrapVariant[];
  editable: EditableOperand[];
  /** What the author of the code meant; compared with the real result. */
  intent?: string;
}

export const trapScenarios: TrapScenario[] = [
  {
    id: "mixed-add",
    title: "signed + unsigned",
    summary: "A signed and an unsigned operand meet in one addition, and the result goes into a signed variable.",
    decls: [
      { name: "a", type: "logic", signed: true, width: 4, init: "-4" },
      { name: "u", type: "logic", width: 8, init: "8'd10" },
    ],
    target: { name: "r", type: "logic", signed: true, width: 8 },
    variants: [
      { id: "trap", label: "a + u", expr: "a + u", role: "trap" },
      { id: "half-fix", label: "$signed(a) + u", expr: "$signed(a) + u", role: "trap" },
      { id: "fix", label: "a + $signed(u)", expr: "a + $signed(u)", role: "fix" },
    ],
    editable: [
      { name: "a", widths: [4, 8] },
      { name: "u", min: 0, max: 127 },
    ],
    intent: "ordinary signed math",
  },
  {
    id: "signed-compare",
    title: "signed vs unsigned compare",
    summary: "A signed value is compared with a constant. The constant's type decides how a's bits are read.",
    decls: [{ name: "a", type: "logic", signed: true, width: 4, init: "-4" }],
    target: { name: "pos", type: "bit" },
    variants: [
      { id: "trap", label: "a > 4'd0", expr: "a > 4'd0", role: "trap" },
      { id: "fix-unsized", label: "a > 0", expr: "a > 0", role: "fix" },
      { id: "fix-signed", label: "a > 4'sd0", expr: "a > 4'sd0", role: "fix" },
    ],
    editable: [{ name: "a", widths: [4, 8] }],
    intent: "a compared as a signed number",
  },
  {
    id: "shift-fill",
    title: ">> vs >>>",
    summary: "Halving a negative number with a right shift. Which shift keeps the sign, and how wide is the context?",
    decls: [],
    target: { name: "r", type: "logic", signed: true, width: 4 },
    variants: [
      { id: "logical", label: "-4'sd1 >> 1", expr: "-4'sd1 >> 1", role: "trap" },
      { id: "arith", label: "-4'sd1 >>> 1", expr: "-4'sd1 >>> 1", role: "fix" },
      { id: "int-target", label: "int r = -4'sd1 >> 1", expr: "-4'sd1 >> 1", target: { name: "r", type: "int" }, role: "contrast" },
    ],
    editable: [],
    intent: "halve -1 and keep the sign",
  },
  {
    id: "lost-carry",
    title: "the lost carry",
    summary: "Two 8-bit values are added. Does the carry survive? The LHS width is part of the context.",
    decls: [
      { name: "a8", type: "logic", width: 8, init: "8'd200" },
      { name: "b8", type: "logic", width: 8, init: "8'd100" },
    ],
    target: { name: "s", type: "logic", width: 8 },
    variants: [
      { id: "sum8", label: "8-bit s = a8 + b8", expr: "a8 + b8", role: "trap" },
      { id: "sum9", label: "9-bit s = a8 + b8", expr: "a8 + b8", target: { name: "s", type: "logic", width: 9 }, role: "fix" },
      { id: "avg8", label: "s = (a8 + b8) >> 1", expr: "(a8 + b8) >> 1", role: "trap" },
      { id: "avg-fix", label: "s = (a8 + b8 + 0) >> 1", expr: "(a8 + b8 + 0) >> 1", role: "fix" },
    ],
    editable: [
      { name: "a8", min: 0, max: 255 },
      { name: "b8", min: 0, max: 255 },
    ],
    intent: "the true sum or average",
  },
  {
    id: "int-vs-logic",
    title: "int vs logic [31:0]",
    summary: "Both operands are 32 bits, but int is signed and logic [31:0] is not.",
    decls: [
      { name: "i", type: "int", init: "-1" },
      { name: "w", type: "logic", width: 32, init: "32'd1" },
    ],
    target: { name: "lt", type: "bit" },
    variants: [
      { id: "trap", label: "i < w", expr: "i < w", role: "trap" },
      { id: "fix", label: "i < $signed(w)", expr: "i < $signed(w)", role: "fix" },
      { id: "fix-cast", label: "i < int'(w)", expr: "i < int'(w)", role: "fix" },
    ],
    editable: [
      { name: "i", min: -1000, max: 1000 },
      { name: "w", min: 0, max: 1000 },
    ],
    intent: "i compared as a signed number",
  },
  {
    id: "x-arith",
    title: "x in arithmetic",
    summary: "One bit of p is unknown. How much of the sum does it poison, and what does a 2-state target keep?",
    decls: [
      { name: "p", type: "logic", width: 4, init: "4'b10x1" },
      { name: "q", type: "logic", width: 4, init: "4'd1" },
    ],
    target: { name: "r", type: "logic", width: 4 },
    variants: [
      { id: "add", label: "logic r = p + q", expr: "p + q", role: "trap" },
      { id: "add-2state", label: "bit r = p + q", expr: "p + q", target: { name: "r", type: "bit", width: 4 }, role: "trap" },
      { id: "or", label: "logic r = p | q", expr: "p | q", role: "contrast" },
    ],
    editable: [],
  },
];

export interface TrapPredictionOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
  misconception: "model" | "math" | "saturate" | "ignore-lhs" | "swap-shift" | "optimistic-x" | "opposite-sign" | "plain";
}

/** How the learner sees a value of the target type in an option. */
export function formatTargetValue(name: string, v: SvValue): string {
  return `${name} = ${isKnown(v) ? formatDecimal(v) : formatLiteral(reinterpret(v, false))}`;
}

/**
 * Prediction options for `target = expr;`: the model's answer plus the
 * answers produced by named misconceptions, each with diagnostic feedback.
 * Options with the same label are merged (the correct one wins).
 */
export function trapPredictionOptions(decls: SvDecl[], target: SvDecl, expr: string): TrapPredictionOption[] {
  const real = evaluateAssignment(decls, target, expr);
  if (!real.ok) return [];
  const type = declType(target);
  const name = target.name;
  const env = buildEnv(decls);
  const cands: TrapPredictionOption[] = [];
  const add = (label: string, misconception: TrapPredictionOption["misconception"], feedback: string) => {
    if (cands.some((c) => c.label === label)) return;
    cands.push({ id: `${misconception}-${cands.length}`, label, correct: false, feedback, misconception });
  };
  const correctLabel = formatTargetValue(name, real.final);
  cands.push({ id: "model", label: correctLabel, correct: true, feedback: real.insight, misconception: "model" });

  const math = mathIntuition(expr, env);
  if (math !== null) {
    const fits = fromBigInt(math, type.width, type.signed);
    const representable = toBigInt(fits) === math;
    const readsXasZero = real.operands.some((o) => !isKnown(o.value));
    add(
      `${name} = ${math.toString()}`,
      "math",
      `${readsXasZero ? "That reads the x bit as 0 and then does ordinary integer math." : "That is ordinary integer math: each operand keeps its declared sign and no bit is lost."} ${
        representable ? "" : `It cannot even fit: ${name} holds ${type.width} bits. `
      }SystemVerilog does not evaluate that way here. ${real.insight}`,
    );
    if (!representable && type.width > 1) {
      const { min, max } = valueRange(target);
      add(
        `${name} = ${math > BigInt(max) ? max : min}`,
        "saturate",
        `SystemVerilog never saturates. Bits that do not fit are discarded (§10.7). ${real.insight}`,
      );
    }
  }

  const narrow = evaluateAssignment(decls, target, expr, { ignoreLhsWidth: true });
  if (narrow.ok) {
    add(
      formatTargetValue(name, narrow.final),
      "ignore-lhs",
      `That evaluates \`${expr}\` in only ${real.rhsWidth} bits. The LHS is part of the context (§11.6.1), so the operands are first extended to ${real.contextWidth} bits and nothing is lost before the assignment.`,
    );
  }

  if (/>>/.test(expr)) {
    const swapped = evaluateAssignment(decls, target, expr, { swapRightShifts: true });
    if (swapped.ok) {
      add(
        formatTargetValue(name, swapped.final),
        "swap-shift",
        "That is the other right shift. >> always fills the vacated bits with 0; >>> copies the sign bit, and only when the expression is signed (§11.4.10).",
      );
    }
  }

  const optimistic = type.fourState ? optimisticX(decls, target, expr) : null;
  if (optimistic) {
    add(
      formatTargetValue(name, optimistic),
      "optimistic-x",
      "That marks only the bits the unknown input can reach, which is what real gates might do. The LRM is pessimistic for arithmetic: any x/z operand bit makes the ENTIRE result x (§11.4.3).",
    );
  }

  if (!type.fourState && !isKnown(resize(real.rhsValue, type.width, real.rhsSigned, type.signed))) {
    add(
      formatTargetValue(name, resize(real.rhsValue, type.width, real.rhsSigned, type.signed)),
      "plain",
      `${name} is a 2-state type: it cannot hold x or z. Every x/z bit becomes 0 when the value is stored (§6.11.2).`,
    );
  }

  if (type.width > 1 && isKnown(real.final)) {
    add(
      formatTargetValue(name, reinterpret(real.final, !type.signed)),
      "opposite-sign",
      `Right bits, wrong reading: ${name} is declared ${signWord(type.signed)}, so ${formatLiteral(reinterpret(real.final, false))} reads as ${formatDecimal(real.final)}.`,
    );
  }

  if (type.width === 1) {
    (["0", "1"] as Bit4[]).forEach((b) =>
      add(`${name} = ${b}`, "plain", `Not here. ${real.insight}`),
    );
    if (type.fourState) add(`${name} = 1'bx`, "plain", `No operand bit is x or z here, so the comparison has a known answer. ${real.insight}`);
  }

  if (cands.length < 3 && isKnown(real.final) && type.width > 1) {
    add(
      `${name} = x`,
      "plain",
      `Every operand bit is a known 0 or 1, so the result is known. Mixing widths and signedness is legal and fully defined; it only changes how the bits are extended and read (§11.8). ${real.insight}`,
    );
  }

  // Stable, value-sorted order so the correct answer is not always first.
  const key = (label: string) => {
    const m = /= (-?\d+)$/.exec(label);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };
  return cands.sort((a, b) => key(a.label) - key(b.label) || a.label.localeCompare(b.label));
}

/** The value the author of a scenario meant (ordinary integer math), for the EXP/ACT comparison. */
export function intendedValue(decls: SvDecl[], expr: string): bigint | null {
  return mathIntuition(expr, buildEnv(decls));
}

// ---------------------------------------------------------------------------
// Operator explorer catalog and details (OperatorExplorer)
// ---------------------------------------------------------------------------

export type OperatorFamily = "bitwise" | "reduction" | "logical" | "equality" | "inside" | "shift" | "concat" | "stream";
export type OperandSlot = "a" | "b" | "c" | "n";

export interface OperatorSpec {
  id: string;
  family: OperatorFamily;
  /** SV source evaluated by the model, using operands a, b, c, n. */
  template: string;
  operands: OperandSlot[];
  rule: string;
  clause: string;
  /** Code that looks plausible but is illegal or means something else. */
  trap?: string;
}

export const operatorFamilies: { id: OperatorFamily; label: string }[] = [
  { id: "bitwise", label: "Bitwise" },
  { id: "reduction", label: "Reduction" },
  { id: "logical", label: "Logical" },
  { id: "equality", label: "Equality" },
  { id: "inside", label: "inside" },
  { id: "shift", label: "Shift" },
  { id: "concat", label: "Concat" },
  { id: "stream", label: "Streaming" },
];

export const operatorCatalog: OperatorSpec[] = [
  { id: "and", family: "bitwise", template: "a & b", operands: ["a", "b"], rule: "Bit by bit: a 0 on either side forces 0.", clause: "§11.4.8, Table 11-11" },
  { id: "or", family: "bitwise", template: "a | b", operands: ["a", "b"], rule: "Bit by bit: a 1 on either side forces 1.", clause: "§11.4.8, Table 11-12" },
  { id: "xor", family: "bitwise", template: "a ^ b", operands: ["a", "b"], rule: "Bit by bit: any x/z input bit gives x.", clause: "§11.4.8, Table 11-13" },
  { id: "xnor", family: "bitwise", template: "a ~^ b", operands: ["a", "b"], rule: "Bit by bit XNOR: any x/z input bit gives x.", clause: "§11.4.8, Table 11-14" },
  { id: "not", family: "bitwise", template: "~a", operands: ["a"], rule: "Each bit inverts; x and z both become x.", clause: "§11.4.8, Table 11-15" },
  {
    id: "binary-nand",
    family: "bitwise",
    template: "a ~& b",
    operands: ["a", "b"],
    rule: "~& exists only as the unary reduction NAND. Bitwise NAND is ~(a & b).",
    clause: "§11.4.9, Table 11-1",
    trap: "binary ~&",
  },
  { id: "red-and", family: "reduction", template: "&a", operands: ["a"], rule: "AND of all bits: one 0 decides 0.", clause: "§11.4.9, Table 11-16" },
  { id: "red-nand", family: "reduction", template: "~&a", operands: ["a"], rule: "Inverted reduction AND.", clause: "§11.4.9" },
  { id: "red-or", family: "reduction", template: "|a", operands: ["a"], rule: "OR of all bits: one 1 decides 1.", clause: "§11.4.9, Table 11-17" },
  { id: "red-nor", family: "reduction", template: "~|a", operands: ["a"], rule: "Inverted reduction OR.", clause: "§11.4.9" },
  { id: "red-xor", family: "reduction", template: "^a", operands: ["a"], rule: "Parity of all bits: any x/z gives x.", clause: "§11.4.9, Table 11-18" },
  { id: "red-xnor", family: "reduction", template: "~^a", operands: ["a"], rule: "Inverted parity.", clause: "§11.4.9" },
  { id: "land", family: "logical", template: "a && b", operands: ["a", "b"], rule: "Each side becomes a truth value (any 1 bit → true); false && anything is false.", clause: "§11.4.7" },
  { id: "lor", family: "logical", template: "a || b", operands: ["a", "b"], rule: "Each side becomes a truth value; true || anything is true.", clause: "§11.4.7" },
  { id: "lnot", family: "logical", template: "!a", operands: ["a"], rule: "Invert the truth value; unknown stays x.", clause: "§11.4.7" },
  { id: "eq", family: "equality", template: "a == b", operands: ["a", "b"], rule: "x if x/z make it ambiguous; a known mismatch still gives 0.", clause: "§11.4.5" },
  { id: "ceq", family: "equality", template: "a === b", operands: ["a", "b"], rule: "x and z compared as values; always 0 or 1.", clause: "§11.4.5" },
  { id: "weq", family: "equality", template: "a ==? b", operands: ["a", "b"], rule: "x/z in the RIGHT operand are wildcards.", clause: "§11.4.6" },
  { id: "neq", family: "equality", template: "a != b", operands: ["a", "b"], rule: "Inverse of ==, still x when ambiguous.", clause: "§11.4.5" },
  { id: "cneq", family: "equality", template: "a !== b", operands: ["a", "b"], rule: "Inverse of ===.", clause: "§11.4.5" },
  { id: "wneq", family: "equality", template: "a !=? b", operands: ["a", "b"], rule: "Inverse of ==?.", clause: "§11.4.6" },
  {
    id: "inside",
    family: "inside",
    template: "a inside {b, c}",
    operands: ["a", "b", "c"],
    rule: "Each member is compared with ==?, so x/z bits in a member are don't-cares. It is NOT case equality (===).",
    clause: "§11.4.13",
    trap: "inside is not ===",
  },
  { id: "shl", family: "shift", template: "a << n", operands: ["a", "n"], rule: "Shift left, fill with 0.", clause: "§11.4.10" },
  { id: "shr", family: "shift", template: "a >> n", operands: ["a", "n"], rule: "Logical right shift: always fill with 0.", clause: "§11.4.10" },
  { id: "ashl", family: "shift", template: "a <<< n", operands: ["a", "n"], rule: "Same as <<.", clause: "§11.4.10" },
  { id: "ashr", family: "shift", template: "a >>> n", operands: ["a", "n"], rule: "Fill with the sign bit only if the expression is signed.", clause: "§11.4.10" },
  { id: "concat", family: "concat", template: "{a, b}", operands: ["a", "b"], rule: "Operands are self-determined and joined MSB first; the result is unsigned.", clause: "§11.4.12" },
  { id: "repl", family: "concat", template: "{2{a}}", operands: ["a"], rule: "Copies the concatenation; the multiplier is a constant.", clause: "§11.4.12.1" },
  {
    id: "concat-unsized",
    family: "concat",
    template: "{a, 1}",
    operands: ["a"],
    rule: "Unsized numbers are not allowed in a concatenation because their size is unknown.",
    clause: "§11.4.12",
    trap: "unsized literal in {}",
  },
  { id: "stream-bits", family: "stream", template: "{<< {a}}", operands: ["a"], rule: "Reverse the order of 1-bit slices: a bit reversal.", clause: "§11.4.14.2" },
  { id: "stream-nibble", family: "stream", template: "{<< 4 {a}}", operands: ["a"], rule: "Reverse the order of 4-bit slices; bits inside a slice keep their order.", clause: "§11.4.14.2" },
  { id: "stream-byte", family: "stream", template: "{<< 8 {a}}", operands: ["a"], rule: "Reverse the byte order (endian swap).", clause: "§11.4.14.2" },
  { id: "stream-ltr", family: "stream", template: "{>> {a}}", operands: ["a"], rule: ">> streams left to right: no re-ordering.", clause: "§11.4.14.2" },
];

export interface OperatorInputs {
  a: Bit4[];
  b: Bit4[];
  c: Bit4[];
  n: Bit4[];
  /** Declare `a` as `logic signed`. */
  signedA: boolean;
}

/** Declarations for the operands a spec uses, with literal initialisers. */
export function operatorDecls(spec: OperatorSpec, inputs: OperatorInputs): SvDecl[] {
  // Hex from 8 bits up when every nibble allows it (keeps code lines short), binary otherwise.
  const lit = (bits: Bit4[]) => (bits.length >= 8 ? formatHexLiteral(fromBits(bits)) : `${bits.length}'b${formatBits(fromBits(bits))}`);
  return spec.operands.map((slot) => ({
    name: slot,
    type: "logic" as const,
    signed: slot === "a" ? inputs.signedA : undefined,
    width: inputs[slot].length,
    init: lit(inputs[slot]),
  }));
}

export function runOperator(spec: OperatorSpec, inputs: OperatorInputs): ExpressionEvaluation | EvaluationFailure {
  let env: SvEnv;
  try {
    env = buildEnv(operatorDecls(spec, inputs));
  } catch (e) {
    return toFailure(spec.template, e);
  }
  return evaluateExpression(spec.template, env);
}

export interface BitwiseRow {
  index: number;
  a: Bit4;
  b?: Bit4;
  result: Bit4;
  note: string;
}

/** Per-bit table for bitwise operators (MSB first). */
export function bitwiseRows(op: "&" | "|" | "^" | "~^" | "~", a: SvValue, b?: SvValue): BitwiseRow[] {
  const rows: BitwiseRow[] = [];
  for (let i = a.width - 1; i >= 0; i -= 1) {
    const x = bitAt(a, i);
    if (op === "~" || !b) {
      const r = notBit(x);
      rows.push({ index: i, a: x, result: r, note: `~${x} = ${r}` });
    } else {
      const y = bitAt(b, i);
      const r = bitwiseBit(op, x, y);
      rows.push({ index: i, a: x, b: y, result: r, note: `${x} ${op} ${y} = ${r}` });
    }
  }
  return rows;
}

export interface FoldStep {
  acc: Bit4;
  bit: Bit4;
  index: number;
  result: Bit4;
}

/** The step-by-step fold of a reduction (§11.4.9: first bit with second, then the result with each next bit). */
export function reductionFold(op: UnaryOp, v: SvValue): { steps: FoldStep[]; base: Bit4; inverted: boolean; result: Bit4 } {
  const bits = bitsOf(v);
  const core = op === "&" || op === "~&" ? "&" : op === "|" || op === "~|" ? "|" : "^";
  const steps: FoldStep[] = [];
  let acc = bits[0];
  for (let k = 1; k < bits.length; k += 1) {
    const r = bitwiseBit(core, acc, bits[k]);
    steps.push({ acc, bit: bits[k], index: bits.length - 1 - k, result: r });
    acc = r;
  }
  const inverted = op.startsWith("~");
  return { steps, base: acc, inverted, result: inverted ? notBit(acc) : acc };
}

export interface EqualityFamily {
  logical: Bit4;
  caseEq: Bit4;
  wildcard: Bit4;
  /** Per bit, MSB first. `known` is how == sees the pair; `wildcard` marks an x/z bit in b (a don't-care for ==?). */
  bits: { index: number; a: Bit4; b: Bit4; known: "match" | "mismatch" | "unknown"; wildcard: boolean }[];
}

/** ==, === and ==? on the same operands, with a per-bit classification for ==. */
export function equalityFamily(a: SvValue, b: SvValue): EqualityFamily {
  const W = Math.max(a.width, b.width);
  const S = a.signed && b.signed;
  const l = resize(a, W, S, S);
  const r = resize(b, W, S, S);
  const bits: EqualityFamily["bits"] = [];
  for (let i = W - 1; i >= 0; i -= 1) {
    const x = bitAt(l, i);
    const y = bitAt(r, i);
    const known = isUnknownBit(x) || isUnknownBit(y) ? "unknown" : x === y ? "match" : "mismatch";
    bits.push({ index: i, a: x, b: y, known, wildcard: isUnknownBit(y) });
  }
  return { logical: logicalEquality(l, r), caseEq: caseEquality(l, r), wildcard: wildcardEquality(l, r), bits };
}

/** inside, member by member: the real ==? comparison next to the === a learner might expect. */
export function insideDetail(a: SvValue, members: SvValue[]): { members: { value: SvValue; wildcard: Bit4; caseEq: Bit4 }[]; result: Bit4; ifCaseEquality: Bit4 } {
  const rows = members.map((m) => {
    const fam = equalityFamily(a, m);
    return { value: m, wildcard: fam.wildcard, caseEq: fam.caseEq };
  });
  const any = (k: "wildcard" | "caseEq"): Bit4 => (rows.some((r) => r[k] === "1") ? "1" : rows.some((r) => r[k] === "x") ? "x" : "0");
  return { members: rows, result: any("wildcard"), ifCaseEquality: any("caseEq") };
}

/** Distinct, deterministic wrong answers for vector-valued operators. */
export interface OperatorOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Option label for a vector result: hex from 8 bits up (when nibbles allow), else binary. */
export function vectorLabel(v: SvValue): string {
  const u = reinterpret(v, false);
  return v.width >= 8 ? formatHexLiteral(u) : formatLiteral(u);
}

/**
 * Prediction options for an operator case. Wrong options come from named
 * misconceptions and say which rule they break.
 */
export function operatorPredictionOptions(spec: OperatorSpec, inputs: OperatorInputs): OperatorOption[] {
  const real = runOperator(spec, inputs);
  const opts: OperatorOption[] = [];
  const add = (label: string, correct: boolean, feedback: string) => {
    if (opts.some((o) => o.label === label)) return;
    opts.push({ id: `opt-${opts.length}`, label, correct, feedback });
  };
  const env = buildEnv(operatorDecls(spec, inputs));
  const val = (src: string) => {
    const r = evaluateExpression(src, env);
    return r.ok ? r.value : null;
  };

  if (!real.ok) {
    add("Compile error", true, `${real.error.message} (${real.error.clause})`);
    if (spec.id === "binary-nand") {
      const nand = val("~(a & b)");
      const red = val("~&a");
      if (nand) add(`${vectorLabel(nand)} (bitwise NAND)`, false, `That is ~(a & b). SystemVerilog has no binary ~&: ${spec.rule}`);
      if (red) add(`${vectorLabel(red)} (reduction NAND of a)`, false, "~& only exists as a unary operator; with an operand on its left the parser has no binary ~& to apply, so this does not compile.");
    }
    if (spec.id === "concat-unsized") {
      const ok1 = val("{a, 1'b1}");
      const ok32 = val("{a, 32'd1}");
      if (ok1) add(`${vectorLabel(ok1)} (1 treated as 1'b1)`, false, "An unsized 1 is at least 32 bits, so its size in the concatenation would be ambiguous. The LRM forbids it; write 1'b1.");
      if (ok32) add(`${ok32.width}-bit value (1 treated as 32'd1)`, false, "Unsized numbers are not allowed in concatenations at all (§11.4.12), so there is no 36-bit result.");
    }
    return opts;
  }

  const value = real.value;
  if (value.width === 1) {
    const truth = bitAt(value, 0);
    (["0", "1", "x"] as Bit4[]).forEach((b) => add(`1'b${b}`, b === truth, oneBitFeedback(spec, inputs, b, truth)));
    return opts;
  }

  const a = fromBits(inputs.a, inputs.signedA);
  let because = "";
  if (spec.family === "bitwise") {
    const node = parseExpression(spec.template);
    const op = node.kind === "binary" ? (node.op as "&" | "|" | "^" | "~^") : "~";
    const unknownRows = bitwiseRows(op, a, op === "~" ? undefined : fromBits(inputs.b)).filter((r) => isUnknownBit(r.a) || (r.b !== undefined && isUnknownBit(r.b)));
    if (unknownRows.length > 0) because = ` Bits with x/z inputs: ${unknownRows.map((r) => `bit ${r.index}: ${r.note}`).join("; ")}.`;
  }
  add(vectorLabel(value), true, `${spec.rule}${because} (${spec.clause})`);
  if (spec.family === "bitwise") {
    const zeroed = evaluateExpression(spec.template, buildEnv(operatorDecls(spec, inputs)), { xAsZero: true });
    if (zeroed.ok) add(vectorLabel(zeroed.value), false, "That reads x and z as 0. An unknown input bit stays hidden only when the other input already decides the output (0 for &, 1 for |); otherwise that output bit is x.");
    const anyUnknown = real.operands.some((o) => !isKnown(o.value));
    if (anyUnknown) add(vectorLabel(allX(value.width)), false, "That is the arithmetic rule (§11.4.3). Bitwise operators work bit by bit, so only the positions an x/z bit actually reaches become x.");
    if (spec.id === "not" && inputs.a.includes("z")) {
      add(vectorLabel(fromBits(inputs.a.map((b) => (b === "z" ? "z" : notBit(b))))), false, "~z is x, not z: every bitwise operator turns a z input into an x output (Table 11-15).");
    }
  } else if (spec.family === "shift") {
    const k = toBigInt(fromBits(inputs.n), false);
    if (k === null) {
      add(vectorLabel(a), false, "An unknown shift count does not mean 'no shift': the whole result is x (§11.4.10).");
    } else {
      const s = Number(k);
      const rot = (bits: Bit4[], right: boolean) => {
        const m = s % bits.length;
        return right ? [...bits.slice(bits.length - m), ...bits.slice(0, bits.length - m)] : [...bits.slice(m), ...bits.slice(0, m)];
      };
      const isRight = spec.id === "shr" || spec.id === "ashr";
      add(vectorLabel(fromBits(rot(inputs.a, isRight))), false, "Shifts do not rotate: bits shifted out are lost and the vacated positions are filled (§11.4.10).");
      if (isRight) {
        const zero = val("a >> n");
        const sign = val("$signed(a) >>> n");
        if (zero) add(vectorLabel(zero), false, inputs.signedA && spec.id === "ashr" ? "That is a logical shift. With a declared signed, >>> copies the sign bit into the vacated positions." : ">> fills with 0. Here the fill comes from the sign bit.");
        if (sign) add(vectorLabel(sign), false, spec.id === "shr" ? ">> is always logical: it fills with 0 even when a is signed. Only >>> sign-fills." : "a is unsigned, so the expression is unsigned and >>> fills with 0, just like >>.");
      } else {
        add(vectorLabel(fromBits(inputs.a.map((b, i) => (i === 0 ? b : (inputs.a[i + s] ?? "0"))))), false, "<<< does not preserve the sign bit; it is identical to << (§11.4.10).");
      }
    }
  } else if (spec.family === "concat") {
    const rev = spec.id === "concat" ? val("{b, a}") : null;
    if (rev) add(vectorLabel(rev), false, "The first operand lands in the most significant bits: {a, b} puts a on the left.");
    if (spec.id === "repl") {
      const dbl = val("a + a");
      if (dbl) add(vectorLabel(dbl), false, "Replication copies bits side by side; it does not multiply. {2{a}} is 2 × width(a) bits wide.");
    }
  } else if (spec.family === "stream") {
    const same = val("{>> {a}}");
    const bitRev = val("{<< {a}}");
    const byteSwap = val("{<< 8 {a}}");
    const nib = val("{<< 4 {a}}");
    if (same) add(vectorLabel(same), false, "{>>{}} leaves the order unchanged, but << reverses the order of the slices (§11.4.14.2).");
    if (bitRev) add(vectorLabel(bitRev), false, "That reverses every bit (slice size 1). With a slice size, only whole slices move; bits inside a slice keep their order.");
    if (byteSwap) add(vectorLabel(byteSwap), false, "That swaps bytes (slice size 8). The slice size after << decides the block that moves.");
    if (nib) add(vectorLabel(nib), false, "That reverses 4-bit nibbles (slice size 4).");
  }
  return opts.sort((x, y) => x.label.localeCompare(y.label));
}

function oneBitFeedback(spec: OperatorSpec, inputs: OperatorInputs, chosen: Bit4, truth: Bit4): string {
  const a = fromBits(inputs.a, inputs.signedA);
  const b = fromBits(inputs.b);
  const right = chosen === truth;
  const lead = right ? "" : "Not this one. ";
  switch (spec.family) {
    case "reduction": {
      const fold = reductionFold(spec.template.replace("a", "") as UnaryOp, a);
      const core = spec.template.replace("a", "").replace("~", "") || "&";
      const decider = core === "&" ? "0" : "1";
      const bits = bitsOf(a);
      const reason =
        core === "^"
          ? bits.some(isUnknownBit)
            ? "Parity needs every bit, so any x or z makes the result x."
            : `There are ${bits.filter((x) => x === "1").length} ones, so the parity is ${fold.base}.`
          : bits.includes(decider)
            ? `A single ${decider} decides a reduction ${core === "&" ? "AND" : "OR"} (${core === "&" ? "0 & x = 0" : "1 | x = 1"}), so unknown bits do not matter.`
            : bits.some(isUnknownBit)
              ? `No bit is ${decider}, and an x/z bit could still be ${decider}, so the reduction is x.`
              : `Every bit is ${core === "&" ? "1" : "0"}, so the reduction is ${core === "&" ? "1" : "0"}.`;
      return `${lead}${reason}${fold.inverted ? ` Then ~ inverts it: ${fold.base} → ${fold.result}.` : ""}`;
    }
    case "logical": {
      const ta = truthOf(a);
      const tb = truthOf(b);
      const parts = `a is ${ta === "1" ? "true" : ta === "0" ? "false" : "unknown"} (${ta === "1" ? "it has a 1 bit" : ta === "0" ? "all bits 0" : "no 1 bit, some x/z"})`;
      const second = spec.operands.includes("b") ? `, b is ${tb === "1" ? "true" : tb === "0" ? "false" : "unknown"}` : "";
      return `${lead}${parts}${second}, so ${spec.template} is ${truth}. A logical operator first turns each operand into one truth bit (§11.4.7).`;
    }
    case "equality": {
      const fam = equalityFamily(a, b);
      if (spec.id === "ceq" || spec.id === "cneq") {
        return `${lead}=== compares x and z literally and never returns x${chosen === "x" && !right ? " — 1'bx is impossible here" : ""}. ${fam.caseEq === "1" ? "Every bit, including x/z, matches." : "Some bit differs (x only matches x, z only matches z)."}`;
      }
      if (spec.id === "weq" || spec.id === "wneq") {
        return `${lead}x/z bits in b are wildcards; x/z bits in a are not. ${fam.wildcard === "x" ? "a has an x/z where b has a definite bit, so the answer is x." : fam.wildcard === "1" ? "All non-wildcard bits match." : "A non-wildcard bit differs."}`;
      }
      const mism = fam.bits.some((x) => x.known === "mismatch");
      return `${lead}${mism ? "A known bit differs, so == is 0 no matter what the x/z bits are." : fam.logical === "x" ? "Every known bit matches, but x/z makes the comparison ambiguous, so == gives x. Use === to compare x literally." : "Every bit is known and equal."}`;
    }
    case "inside": {
      const members = [b, fromBits(inputs.c)];
      const det = insideDetail(a, members);
      const caseNote = det.ifCaseEquality !== det.result ? ` With === you would get ${det.ifCaseEquality}: inside is not case equality.` : "";
      return `${lead}inside compares a with each member using ==?, so x/z bits in a member are don't-cares; the result is 1 if any member matches, x if none match but some comparison is x (§11.4.13).${caseNote}`;
    }
    default:
      return `${lead}${spec.rule}`;
  }
}
