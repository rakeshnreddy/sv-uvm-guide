/**
 * SystemVerilog expression model: bit lengths, signedness, extension,
 * truncation, casts and four-state operators.
 *
 * Pure and deterministic (no React, no randomness). Every rule cites the
 * IEEE 1800-2023 clause it implements; tests in
 * tests/lib/sv-expression-model.test.ts pin each one.
 *
 * - §5.7.1  integer literals: sized/unsized, the `s` designator, x/z/? digits, padding,
 *           the fill literals '0 '1 'x 'z, and x/z-led unsized literals padding to their context
 * - §6.11.2 4-state → 2-state conversion turns x/z into 0
 * - §6.24.1 size casts `N'(e)`, sign casts `signed'(e)`, type casts `int'(e)`
 * - §10.7   assignment extension and truncation (MSBs discarded)
 * - §11.4   operator semantics, including the 4-state truth tables
 * - §11.4.11 the conditional operator and Table 11-20 (x/z condition merges the branches)
 * - §11.4.12 concatenation as an assignment target; §11.4.12.1 zero replication
 * - §11.6.1 Table 11-21: context-determined vs self-determined bit lengths
 * - §11.7   `$signed` / `$unsigned`
 * - §11.8.1 expression type; §11.8.2 evaluation steps; §11.8.3 assignment;
 *           §11.8.4 x/z in signed expressions
 * - §12.4   `if` treats an x/z condition as false (contrast with ?:)
 * - §20.9   bit vector system functions $countbits, $countones, $onehot, $onehot0, $isunknown
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
  /**
   * Set for the unbased unsized literals '0 '1 'x 'z (§5.7.1): every bit of the
   * containing expression takes this value; self-determined, the literal is 1 bit.
   */
  fill?: Bit4;
  /**
   * Set for an unsized based literal whose leftmost digit is x or z, such as 'hx
   * (§5.7.1): the literal is extended with this bit to the size of the containing
   * expression, even beyond 32 bits ('hx into an 85-bit variable gives 85 x bits).
   */
  pad?: Bit4;
}

const FILL_LITERAL = /^'([01xXzZ])$/;

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
  const fillMatch = FILL_LITERAL.exec(text);
  if (fillMatch) {
    // Unbased unsized literal (§5.7.1): all bits of the containing expression are
    // set to this value; in a self-determined context it is 1 bit wide. Unsigned.
    const fill = fillMatch[1].toLowerCase() as Bit4;
    return { value: fromBits([fill], false), sized: false, fill };
  }
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
  const leftXz: Bit4 | undefined = bits[0] === "x" || bits[0] === "z" ? bits[0] : undefined;
  if (bits.length > width) {
    bits = bits.slice(bits.length - width); // truncated from the left
  } else if (bits.length < width) {
    // Pad left with 0, or with x/z when the leftmost digit is x/z (§5.7.1).
    bits = [...Array<Bit4>(width - bits.length).fill(leftXz ?? "0"), ...bits];
  }
  // An unsized literal led by x or z keeps padding with that digit up to the size
  // of the expression that contains it (§5.7.1, example 4: 'hx → {85{1'hx}}).
  const pad = !sized && leftXz ? leftXz : undefined;
  return { value: fromBits(bits, signed), sized, ...(pad ? { pad } : {}) };
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
  | "zero-replication-alone"
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

/** System functions the model evaluates: §11.7 sign conversions and the §20.9 bit vector functions. */
export type SysFn = "$signed" | "$unsigned" | "$countbits" | "$countones" | "$onehot" | "$onehot0" | "$isunknown";

export const BIT_VECTOR_FUNCTIONS: readonly SysFn[] = ["$countbits", "$countones", "$onehot", "$onehot0", "$isunknown"];

export type ExprNode = { text: string } & (
  | { kind: "num"; value: SvValue; sized: boolean; fill?: Bit4; pad?: Bit4 }
  | { kind: "ref"; name: string }
  | { kind: "select"; name: string; msb: number; lsb: number }
  | { kind: "paren"; inner: ExprNode }
  | { kind: "unary"; op: UnaryOp; arg: ExprNode }
  | { kind: "binary"; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { kind: "cond"; cond: ExprNode; then: ExprNode; otherwise: ExprNode }
  | { kind: "concat"; parts: ExprNode[] }
  | { kind: "repl"; count: number; parts: ExprNode[] }
  | { kind: "stream"; dir: "<<" | ">>"; slice: number; parts: ExprNode[] }
  | { kind: "sysfn"; fn: SysFn; arg: ExprNode; /** $countbits control bits, each read at its LSB (§20.9). */ controls?: ExprNode[] }
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
  // Unbased unsized literal: '0 '1 'x 'z (§5.7.1). Not followed by another digit or letter.
  const fill = /'[01xXzZ](?![0-9A-Za-z_?])/y;
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
    else if ((text = tryRe(fill))) tokens.push({ kind: "num", text, start: i, end: i + text.length });
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
      return {
        kind: "num",
        value: lit.value,
        sized: lit.sized,
        text: t.text,
        ...(lit.fill ? { fill: lit.fill } : {}),
        ...(lit.pad ? { pad: lit.pad } : {}),
      };
    }
    if (t.kind === "sys") {
      this.next();
      const fn = t.text as SysFn;
      if (fn !== "$signed" && fn !== "$unsigned" && !BIT_VECTOR_FUNCTIONS.includes(fn)) {
        throw new SvExpressionError(
          "unsupported",
          `${t.text} is not part of this model (only $signed, $unsigned and the §20.9 bit vector functions $countbits, $countones, $onehot, $onehot0 and $isunknown).`,
          "§11.7, §20.9",
        );
      }
      this.expectOp("(");
      const arg = this.expr(0);
      const controls: ExprNode[] = [];
      while (this.isOp(",")) {
        if (fn !== "$countbits") this.unexpected(this.peek(), `${fn} takes one argument`);
        this.next();
        controls.push(this.expr(0));
      }
      this.expectOp(")");
      if (fn === "$countbits" && controls.length === 0) {
        throw new SvExpressionError("syntax", "$countbits needs at least one control bit, e.g. $countbits(e, '1).", "§20.9");
      }
      return { kind: "sysfn", fn, arg, text: this.textFrom(start), ...(controls.length ? { controls } : {}) };
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

const unwrap = (n: ExprNode): ExprNode => (n.kind === "paren" ? unwrap(n.inner) : n);

/**
 * The variables an expression reads (`ref` and `select` nodes), in source order:
 * `int'(w)` reads w, `8'(12'hABC)` reads nothing. Used to decide which operand
 * editors apply to a code variant. An expression that does not parse falls back
 * to a plain identifier scan, so an editor is shown rather than hidden.
 */
export function expressionIdentifiers(src: string): Set<string> {
  const out = new Set<string>();
  const walk = (n: ExprNode): void => {
    switch (n.kind) {
      case "ref":
      case "select":
        out.add(n.name);
        break;
      case "num":
        break;
      case "paren":
        walk(n.inner);
        break;
      case "unary":
      case "cast":
        walk(n.arg);
        break;
      case "binary":
        walk(n.left);
        walk(n.right);
        break;
      case "cond":
        walk(n.cond);
        walk(n.then);
        walk(n.otherwise);
        break;
      case "concat":
      case "repl":
      case "stream":
        n.parts.forEach(walk);
        break;
      case "sysfn":
        walk(n.arg);
        (n.controls ?? []).forEach(walk);
        break;
      case "inside":
        walk(n.left);
        n.items.forEach((it) => {
          if (it.kind === "value") walk(it.expr);
          else {
            walk(it.lo);
            walk(it.hi);
          }
        });
        break;
    }
  };
  try {
    walk(parseExpression(src));
  } catch {
    for (const m of src.matchAll(/(?<![\w$'])[A-Za-z_]\w*/g)) out.add(m[0]);
  }
  return out;
}

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

/**
 * Table 11-20 (§11.4.11): how one bit of each branch combines when the
 * condition of `?:` is x or z. A bit survives only where both branches hold
 * the same known value (0 with 0, 1 with 1); every other pair, including x
 * with x and z with z, is x.
 */
export function conditionalMergeBit(thenBit: Bit4, elseBit: Bit4): Bit4 {
  return thenBit === elseBit && !isUnknownBit(thenBit) ? thenBit : "x";
}

export interface ConditionalMergeRow {
  index: number;
  then: Bit4;
  otherwise: Bit4;
  /** The Table 11-20 cell for this pair (what the merge would give). */
  cell: Bit4;
  /** The bit the operator actually returns: the chosen branch's bit, or `cell` when the condition is ambiguous. */
  result: Bit4;
}

export interface ConditionalDetail {
  /** Truth value of the condition (§11.4.7): 1, 0, or x for an ambiguous condition. */
  truth: Bit4;
  /** `then == otherwise` (§11.4.5), the logical-equivalence test §11.4.11 applies first. */
  equivalent: Bit4;
  /** True when the condition is x/z and the branches were merged bit by bit. */
  merged: boolean;
  rows: ConditionalMergeRow[];
  /** `cond ? then : otherwise` at the common width (unsigned here: the caller supplies the sign). */
  result: SvValue;
  /** What `if (cond) y = then; else y = otherwise;` stores (§12.4: an x/z condition is false). */
  ifElse: SvValue;
  ifTakes: "then" | "else";
}

/**
 * The conditional operator on already-sized branches (§11.4.11), row by row,
 * next to the if/else statement on the same condition (§12.4).
 */
export function conditionalDetail(cond: SvValue, thenValue: SvValue, elseValue: SvValue): ConditionalDetail {
  const W = Math.max(thenValue.width, elseValue.width);
  const S = thenValue.signed && elseValue.signed;
  const t = resize(thenValue, W, S, S);
  const e = resize(elseValue, W, S, S);
  const truth = truthOf(cond);
  const equivalent = logicalEquality(t, e);
  const merged = truth === "x" && equivalent !== "1";
  const rows: ConditionalMergeRow[] = [];
  for (let i = W - 1; i >= 0; i -= 1) {
    const tb = bitAt(t, i);
    const eb = bitAt(e, i);
    const cell = conditionalMergeBit(tb, eb);
    rows.push({ index: i, then: tb, otherwise: eb, cell, result: truth === "1" ? tb : truth === "0" ? eb : cell });
  }
  const result = fromBits(rows.map((r) => r.result), S);
  const ifTakes = truth === "1" ? "then" : "else";
  return { truth, equivalent, merged, rows, result, ifElse: ifTakes === "then" ? t : e, ifTakes };
}

// ---------------------------------------------------------------------------
// Bit vector system functions (§20.9)
// ---------------------------------------------------------------------------

/**
 * $countbits(e, control bits): the number of bits of `e` whose value is one of
 * the control values. A control listed twice counts once. x and z bits never
 * match '1 or '0.
 */
export function countbits(v: SvValue, ...controls: Bit4[]): number {
  const wanted = new Set(controls);
  return bitsOf(v).filter((b) => wanted.has(b)).length;
}

/** $countones(e) = $countbits(e, '1); returns int. */
export function countones(v: SvValue): number {
  return countbits(v, "1");
}

/** $onehot(e): $countbits(e, '1) == 1; returns bit. */
export function onehot(v: SvValue): boolean {
  return countbits(v, "1") === 1;
}

/** $onehot0(e): $countbits(e, '1) <= 1; returns bit. */
export function onehot0(v: SvValue): boolean {
  return countbits(v, "1") <= 1;
}

/** $isunknown(e): $countbits(e, 'x, 'z) != 0; returns bit. */
export function isunknown(v: SvValue): boolean {
  return countbits(v, "x", "z") !== 0;
}

export interface BitVectorFnReport {
  fn: "$countones" | "$onehot" | "$onehot0" | "$isunknown";
  /** The $countbits identity the function is defined by (§20.9). */
  definition: string;
  /** The arithmetic on this vector, e.g. `$countbits(state, '1) = 1, and 1 == 1`. */
  arithmetic: string;
  /** Result as SV source: a decimal for int, 1'b0 / 1'b1 for bit. */
  result: string;
  returnType: "int" | "bit";
}

/** The four convenience functions of §20.9 on one vector, with their $countbits arithmetic. */
export function bitVectorReport(v: SvValue, name = "e"): BitVectorFnReport[] {
  const ones = countbits(v, "1");
  const xz = countbits(v, "x", "z");
  const bit = (b: boolean) => (b ? "1'b1" : "1'b0");
  return [
    {
      fn: "$countones",
      definition: `$countbits(${name}, '1)`,
      arithmetic: `$countbits(${name}, '1) = ${ones}`,
      result: String(ones),
      returnType: "int",
    },
    {
      fn: "$onehot",
      definition: `$countbits(${name}, '1) == 1`,
      arithmetic: `$countbits(${name}, '1) = ${ones}, and ${ones} == 1 is ${ones === 1 ? "true" : "false"}`,
      result: bit(ones === 1),
      returnType: "bit",
    },
    {
      fn: "$onehot0",
      definition: `$countbits(${name}, '1) <= 1`,
      arithmetic: `$countbits(${name}, '1) = ${ones}, and ${ones} <= 1 is ${ones <= 1 ? "true" : "false"}`,
      result: bit(ones <= 1),
      returnType: "bit",
    },
    {
      fn: "$isunknown",
      definition: `$countbits(${name}, 'x, 'z) != 0`,
      arithmetic: `$countbits(${name}, 'x, 'z) = ${xz}, and ${xz} != 0 is ${xz !== 0 ? "true" : "false"}`,
      result: bit(xz !== 0),
      returnType: "bit",
    },
  ];
}

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
      /** `fill`: a '0/'1/'x/'z literal, or an x/z-led unsized literal, fills the context (§5.7.1). */
      mode: "sign" | "zero" | "same" | "fill";
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
  /** Misconception model: casts, $signed and $unsigned are ignored (the operand passes through unchanged). */
  ignoreCasts?: boolean;
  /** Misconception model: a part-select inherits the signedness of its variable (the LRM says unsigned, §11.8.1). */
  selectKeepsSign?: boolean;
}

const signWord = (s: boolean) => (s ? "signed" : "unsigned");
const SELECT_UNSIGNED = "unsigned even when it covers the entire vector (§11.8.1)";
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

/**
 * The context sentence for an assignment whose RHS has no operands to resize: a
 * simple operand, or a node whose own operands are sized separately (a cast, a
 * concatenation, a comparison). Only the RHS as a whole meets the target (§11.8.3).
 */
function standaloneRhsWhy(rhs: ExprNode, name: string, tw: number, rw: number, rs: boolean): string {
  if (rhs.kind === "num" && (rhs.fill || rhs.pad) && tw > rw) {
    return `\`${rhs.text}\` is ${bitsWord(rw)} on its own, but §5.7.1 extends it with its own digit (${rhs.fill ?? rhs.pad}) to the ${tw}-bit ${name}.`;
  }
  const lead = isLeaf(rhs) ? `The RHS is ${bitsWord(rw)}, ${signWord(rs)}` : `\`${rhs.text}\` is ${bitsWord(rw)}, ${signWord(rs)} (its own operands are sized separately)`;
  if (tw > rw) return `${lead}; §11.8.3 extends it to the ${tw}-bit ${name}, with ${rs ? "copies of its sign bit" : "zeros"} because it is ${signWord(rs)}.`;
  if (tw < rw) return `${lead}; the ${tw}-bit ${name} keeps only its low ${bitsWord(tw)} (§10.7).`;
  return `${lead}, the same width as the ${tw}-bit ${name}.`;
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
/** The article before a spoken number: "an 8-bit", "an 11-bit", "an 18-bit", "a 9-bit". */
const articleFor = (n: number) => (/^(8|11$|18$)/.test(String(n)) ? "an" : "a");

const OP_NAMES: Record<string, string> = {
  "+": "Addition",
  "-": "Subtraction",
  "*": "Multiplication",
  "/": "Division",
  "%": "Modulus",
  "**": "Power",
};

/** The 1-bit result of a relational or equality operator on operands already sized to each other (§11.4.4–§11.4.6). */
function comparisonBit(op: BinaryOp, l: SvValue, r: SvValue, S: boolean): Bit4 {
  if (RELATIONAL.has(op)) {
    if (!isKnown(l) || !isKnown(r)) return "x";
    const a = toBigInt(l, S) as bigint;
    const b = toBigInt(r, S) as bigint;
    return (op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b) ? "1" : "0";
  }
  if (op === "==" || op === "!=") return op === "==" ? logicalEquality(l, r) : not1(logicalEquality(l, r));
  if (op === "===" || op === "!==") return op === "===" ? caseEquality(l, r) : not1(caseEquality(l, r));
  return op === "==?" ? wildcardEquality(l, r) : not1(wildcardEquality(l, r));
}

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
        // §20.9: $countbits/$countones return int (32 bits); $onehot/$onehot0/$isunknown return bit.
        if (n.fn === "$countbits" || n.fn === "$countones") return 32;
        if (n.fn === "$onehot" || n.fn === "$onehot0" || n.fn === "$isunknown") return 1;
        return this.size(n.arg);
      case "cast":
        if (this.opts.ignoreCasts) return this.size(n.arg);
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
        return this.opts.selectKeepsSign ? this.lookup(n.name).type.signed : false; // bit- and part-selects are unsigned
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
        if (this.opts.ignoreCasts && (n.fn === "$signed" || n.fn === "$unsigned")) return this.sign(n.arg);
        // int results are signed; bit results and $unsigned are unsigned.
        return n.fn === "$signed" || n.fn === "$countbits" || n.fn === "$countones";
      case "cast":
        if (this.opts.ignoreCasts) return this.sign(n.arg);
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

  /**
   * Why a context or a comparison has its type. `nodes` are the operands that
   * decide it, so a self-determined operand (a shift count, a ?: condition) is not
   * among them, and the sentence must not read as if it were (§11.8.1, Table 11-21).
   */
  private typeReason(nodes: ExprNode[], signed: boolean, scope: "context" | "comparison" = "context"): string {
    if (signed) return nodes.length > 1 ? (scope === "comparison" ? "both operands are signed" : "every context-determined operand is signed") : `\`${nodes[0].text}\` is signed`;
    if (nodes.length === 1 && !isLeaf(nodes[0]) && !isContextNode(nodes[0])) {
      return `\`${nodes[0].text}\` produces an unsigned result`;
    }
    const culprits = Array.from(new Set(nodes.filter((o) => !this.sign(o)).map((o) => o.text)));
    const list = culprits.map((c) => `\`${c}\``).join(", ");
    const mixed = nodes.some((o) => this.sign(o));
    return `${list} ${culprits.length > 1 ? "are" : "is"} unsigned${mixed ? (scope === "comparison" ? ", and one unsigned operand makes the comparison unsigned" : ", and one unsigned context-determined operand makes the whole expression unsigned") : ""}`;
  }

  /** Whether reading `n` as signed rather than unsigned changes its bits at this width: if not, the context's type decides nothing. */
  private signDecides(n: ExprNode, W: number): boolean {
    const probe = new Evaluator(this.env, this.opts);
    return !sameValue(reinterpret(probe.evalCtx(n, W, true), false), reinterpret(probe.evalCtx(n, W, false), false));
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
        // §11.4.11: a known condition evaluates only the branch it picks. The other branch still sizes the
        // context (W already counts it, §11.6.1), but none of its operations run, so they stay out of the trace.
        // It is still evaluated silently, so code that does not compile there is still reported.
        const silently = (branch: ExprNode) => new Evaluator(this.env, this.opts).evalCtx(branch, W, S);
        const t = c === "0" ? silently(n.then) : this.evalCtx(n.then, W, S);
        const e = c === "1" ? silently(n.otherwise) : this.evalCtx(n.otherwise, W, S);
        const r = c === "1" ? t : c === "0" ? e : mapBits(W, S, (i) => conditionalMergeBit(bitAt(t, i), bitAt(e, i)));
        const why =
          c === "x"
            ? `The condition is x/z, so both branches are evaluated and compared (§11.4.5): ${logicalEquality(t, e) === "1" ? "they are equal, so either one is the result" : "the comparison is not 1 (it is 0 or x), so they are combined bit by bit with Table 11-20: a bit survives only where the branches agree on 0 or 1; every other pair, including x with x and z with z, becomes x"}.`
            : `The condition is ${c}, so the ${c === "1" ? "first" : "second"} branch is the result, already sized to ${W} bits; the other branch is not evaluated${
                this.size(c === "1" ? n.otherwise : n.then) > this.size(c === "1" ? n.then : n.otherwise) ? ", but its size still counts toward the context (§11.6.1)" : ""
              }.`;
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
    if (n.kind === "num" && (n.fill || n.pad) && W > v.width) {
      // §5.7.1: a fill literal sets every bit of the containing expression; an
      // x/z-led unsized literal is extended with that digit to the expression size.
      const digit = (n.fill ?? n.pad) as Bit4;
      const to = fromBits([...Array<Bit4>(W - v.width).fill(digit), ...bitsOf(v)], S);
      const why = n.fill
        ? `\`${n.text}\` is an unbased unsized literal: every one of the ${W} bits of the containing expression becomes ${digit} (§5.7.1). On its own it would be 1 bit.`
        : `\`${n.text}\` is unsized and its leftmost digit is ${digit}, so it is padded with ${digit} to the ${W}-bit expression, not with 0 (§5.7.1).`;
      this.push({ kind: "extend", text: n.text, from: v, to, mode: "fill", why, clause: "§5.7.1", surprising: isUnknownBit(digit) });
      return to;
    }
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
      } else if (n.kind === "select" && this.lookup(n.name).type.signed) {
        // §11.8.1: the select is unsigned whatever its variable is, so a set top bit is not copied.
        surprising = msb !== "0";
        why =
          `\`${n.text}\` selects from the signed ${n.name}, but ${n.msb === n.lsb ? "a bit-select is unsigned (§11.8.1)" : `a part-select is ${SELECT_UNSIGNED}`}, so it is zero-extended from ${v.width} to ${W} bits` +
          `${surprising ? `: ${formatCompact(v)} becomes ${formatCompact(to)}, which is ${formatValue(to)}` : ""}.`;
      } else {
        why = `\`${n.text}\` is zero-extended from ${v.width} to ${W} bits (unsigned expression).`;
      }
    } else if (ownSigned && !S && msb !== "0") {
      surprising = true;
      why = `\`${n.text}\` keeps its ${W} bits, but the unsigned context reads ${formatCompact(v)} as ${formatValue(to)}, not ${formatValue(v)}.`;
    } else {
      why = `\`${n.text}\` is already ${bitsWord(W)}; nothing to extend.`;
    }
    // A sized decimal that does not read as its digits (truncated, or an s literal with bit N-1 set) decides the result before anything else happens (§5.7.1).
    const digits = n.kind === "num" ? faceValueRewrite(n.text) : null;
    if (digits !== null) {
      surprising = true;
      why = `\`${n.text}\` holds only its ${v.width} bits, ${formatCompact(reinterpret(v, false))}, which reads as ${formatDecimal(v)}, not ${digits} (§5.7.1, §11.3.3). ${why}`;
    }
    this.push({ kind: "extend", text: n.text, from: v, to, mode, why, clause: digits !== null ? "§5.7.1, §11.8.2" : "§11.8.2", surprising });
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
      if (s === 0) {
        res = l;
        why = `A shift by 0 vacates no bit, so the value is unchanged.`;
      } else if (op === "<<" || op === "<<<") {
        res = makeValue(W, S, l.aval << big(s), l.bval << big(s));
        why = `Left shift by ${k}: vacated low bits fill with 0 (${op} and ${op === "<<" ? "<<<" : "<<"} behave the same).`;
      } else {
        const msb = bitAt(l, W - 1);
        const fill: Bit4 = op === ">>>" && S ? msb : "0";
        res = mapBits(W, S, (i) => (i + s < W ? bitAt(l, i + s) : fill));
        if (op === ">>") {
          why = `Logical right shift by ${k}: vacated high bits fill with 0${S && msb !== "0" ? ", even though the expression is signed" : ""}.`;
          surprising = S && msb !== "0" && s > 0;
        } else if (S) {
          why = `Arithmetic right shift by ${k}: the expression is signed, so vacated bits copy the sign bit (${msb}).`;
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
    const probe = new Evaluator(this.env, this.opts);
    const relationAt = (signed: boolean) => comparisonBit(op, probe.evalCtx(left, W, signed), probe.evalCtx(right, W, signed), signed);
    this.push({
      kind: "context",
      scope: "comparison",
      text: n.text,
      width: W,
      signed: S,
      why: `The operands of ${op} are sized to each other: max(${this.size(left)}, ${this.size(right)}) = ${W} bits, compared as ${signWord(S)} because ${this.typeReason([left, right], S, "comparison")}. The result is 1 bit, unsigned.`,
      clause: RELATIONAL.has(op) ? "§11.8.2, §11.4.4" : "§11.8.2, §11.4.5",
      // Mixed operands decide the result only when the unsigned reading changes the answer.
      surprising: mixed && relationAt(true) !== relationAt(false),
    });
    const l = this.evalCtx(left, W, S);
    const r = this.evalCtx(right, W, S);
    const bit = comparisonBit(op, l, r, S);
    let why: string;
    if (RELATIONAL.has(op)) {
      why = !isKnown(l) || !isKnown(r)
        ? "An operand has an x or z bit, so the relation is 1'bx (§11.4.4)."
        : `${signWord(S)[0].toUpperCase()}${signWord(S).slice(1)} comparison: ${toBigInt(l, S)} ${op} ${toBigInt(r, S)} is ${bit === "1" ? "true" : "false"}.`;
    } else if (op === "==" || op === "!=") {
      const eq = logicalEquality(l, r);
      why =
        eq === "x"
          ? `Every known bit matches but an x/z bit makes the relation ambiguous, so ${op} gives 1'bx.`
          : `Bit-by-bit comparison: ${eq === "1" ? "all bits match" : "a known bit differs, which decides the answer even with x/z elsewhere"}.`;
    } else if (op === "===" || op === "!==") {
      why = `Case equality compares x and z as values, so the result is always 0 or 1.`;
    } else {
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
        return makeValue(w, this.opts.selectKeepsSign ? v.type.signed : false, base.aval >> big(n.lsb), base.bval >> big(n.lsb));
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
        if (n.kind === "repl" && n.count === 0) {
          // §11.4.12.1: a zero replication has size zero and is legal only inside a
          // concatenation with a positive-size operand; the concat case handles that.
          throw new SvExpressionError(
            "zero-replication-alone",
            `\`${n.text}\` replicates zero times, so it has no bits. A zero replication may only appear inside a concatenation that also has an operand of positive size.`,
            "§11.4.12.1",
          );
        }
        const vals = n.parts.map((p) => {
          if (p.kind === "num" && !p.sized) {
            throw new SvExpressionError(
              "unsized-in-concatenation",
              `\`${p.text}\` is an unsized number, and a concatenation needs the size of every operand to work out its own size. Write e.g. 1'b1.`,
              "§11.4.12",
            );
          }
          const inner = unwrap(p);
          if (inner.kind === "repl" && inner.count === 0) {
            const others = n.parts.filter((q) => q !== p);
            if (!others.some((q) => this.size(q) > 0)) {
              throw new SvExpressionError(
                "zero-replication-alone",
                `\`${p.text}\` has size zero, and no other operand of the concatenation has a positive size.`,
                "§11.4.12.1",
              );
            }
            return makeValue(0, false, ZERO);
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
        if (n.fn === "$signed" || n.fn === "$unsigned") {
          if (this.opts.ignoreCasts) return v;
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
        return this.bitVectorFn(n, v);
      }
      case "cast": {
        if (this.opts.ignoreCasts) return this.evalSelf(n.arg);
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
          why: `A cast returns what ${articleFor(N)} ${N}-bit variable would hold after being assigned the expression, so \`${n.arg.text}\` is evaluated in max(${N}, ${this.size(n.arg)}) = ${W} bits.${N > this.size(n.arg) ? ` \`${n.arg.text}\` is ${signWord(inner)}, so ${isContextNode(n.arg) ? "its operands extend" : "it extends"} with ${inner ? "copies of the sign bit" : "zeros"}.` : ""}`,
          clause: "§6.24.1",
          // A widening cast decides the result when its extension changes the bits.
          surprising: N > this.size(n.arg) && this.signDecides(n.arg, W),
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

  /** §20.9: the argument is self-determined; x/z bits never count as 1. */
  private bitVectorFn(n: ExprNode & { kind: "sysfn" }, v: SvValue): SvValue {
    const shown = formatCompact(reinterpret(v, false));
    let controls: Bit4[];
    let label: string;
    if (n.fn === "$countbits") {
      // Each control is a 1-bit logic value; a wider value contributes only its LSB.
      controls = Array.from(new Set((n.controls ?? []).map((c) => bitAt(this.evalSelf(c), 0))));
      label = controls.map((c) => `'${c}`).join(", ");
    } else if (n.fn === "$isunknown") {
      controls = ["x", "z"];
      label = "'x, 'z";
    } else {
      controls = ["1"];
      label = "'1";
    }
    const count = countbits(v, ...controls);
    const xz = countbits(v, "x", "z");
    // x and z bits that no control value names are left out of the count (not counted as 0 bits either: $countbits(e, '0) skips them too).
    const unmatched = bitsOf(v).filter((b) => isUnknownBit(b) && !controls.includes(b)).length;
    const unknownNote = unmatched > 0 ? ` The ${unmatched} x/z bit${unmatched === 1 ? "" : "s"} match${unmatched === 1 ? "es" : ""} none of the control values, so ${unmatched === 1 ? "it is" : "they are"} not counted.` : "";
    let res: SvValue;
    let why: string;
    if (n.fn === "$countbits" || n.fn === "$countones") {
      res = fromBigInt(big(count), 32, true);
      why = `${n.fn} counts the bits of ${shown} equal to ${label}: $countbits(${n.arg.text}, ${label}) = ${count}. It returns an int (32 bits, signed).${unknownNote}`;
    } else if (n.fn === "$onehot") {
      res = oneBit(count === 1 ? "1" : "0");
      why = `$onehot is $countbits(${n.arg.text}, '1) == 1: ${count} == 1 is ${count === 1 ? "true" : "false"}, so it returns 1'b${count === 1 ? "1" : "0"} (a bit, never x).${unknownNote}`;
    } else if (n.fn === "$onehot0") {
      res = oneBit(count <= 1 ? "1" : "0");
      why = `$onehot0 is $countbits(${n.arg.text}, '1) <= 1: ${count} <= 1 is ${count <= 1 ? "true" : "false"}, so it returns 1'b${count <= 1 ? "1" : "0"} (a bit, never x).${unknownNote}`;
    } else {
      res = oneBit(count !== 0 ? "1" : "0");
      why = `$isunknown is $countbits(${n.arg.text}, 'x, 'z) != 0: ${count} != 0 is ${count !== 0 ? "true" : "false"}, so it returns 1'b${count !== 0 ? "1" : "0"}.`;
    }
    this.push({ kind: "op", text: n.text, op: n.fn, inputs: [v], result: res, why, clause: "§20.9", surprising: xz > 0 && n.fn !== "$isunknown" && n.fn !== "$countbits" });
    return res;
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
        : standaloneRhsWhy(rhs, name, tw, rw, rs),
      clause: isContextNode(rhs) ? "§11.6.1, §11.8.1" : "§11.6.1, §11.8.1, §11.8.3",
      surprising: (tw > rw && isContextNode(rhs)) || (!rs && this.contextOperands(rhs).some((o) => this.sign(o)) && this.signDecides(rhs, W)),
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
      (n.controls ?? []).forEach((c) => collectOperands(c, env, "self", ev, out));
      return;
    case "cast":
      collectOperands(n.arg, env, n.cast.kind === "sign" ? "self" : "cast", ev, out);
      return;
    case "inside":
      children(n).forEach((c) => collectOperands(c, env, "compare", ev, out));
      return;
  }
}

/**
 * The sentence(s) that explain the outcome: the surprising steps, or else the
 * deciding context and operation. A right shift's fill is what `>>>` questions
 * ask about, so its step is never crowded out by the other steps, surprising or not.
 */
function insightOf(steps: ExprStep[]): string {
  const surprising = steps.filter((s) => s.surprising);
  if (surprising.length > 0) {
    const picked = surprising.slice(0, 2);
    const shift = surprising.find((s) => s.kind === "op" && SHIFTS.has(s.op as BinaryOp));
    if (shift && !picked.includes(shift)) picked[1] = shift;
    const fill = steps.find((s) => s.kind === "op" && s.op === ">>>");
    if (fill && !picked.includes(fill)) picked.push(fill);
    return steps.filter((s) => picked.includes(s)).map((s) => s.why).join(" ");
  }
  const contexts = steps.filter((s) => s.kind === "context");
  const ctx = contexts.find((s) => s.kind === "context" && s.scope === "comparison") ?? contexts[0];
  const op = [...steps].reverse().find((s) => s.kind === "op");
  const fill = steps.find((s) => s.kind === "op" && s.op === ">>>");
  return [ctx?.why, fill === op ? undefined : fill?.why, op?.why].filter(Boolean).join(" ");
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
// Per-node annotations (ExpressionTreeExplorer, LiteralDecoder)
// ---------------------------------------------------------------------------

export interface NodeAnnotation {
  /** Stable path id: "r" for the root, "r.0", "r.0.1" for children. */
  id: string;
  kind: ExprNode["kind"];
  text: string;
  /** Self-determined width and type (Table 11-21, §11.8.1). */
  selfWidth: number;
  selfSigned: boolean;
  /** The context the node is evaluated in (§11.8.2); the same as selfWidth/selfSigned for self-determined nodes. */
  width: number;
  signed: boolean;
  /** How the node reached its context: inherited (context), on its own (self), sized against a compare operand, or by a cast. */
  role: OperandRole;
  /** The node's value at its context width. */
  value: SvValue;
  /** For leaves: the same record `evaluateExpression` lists in `operands`. */
  operand?: OperandInfo;
  children: NodeAnnotation[];
}

/**
 * Annotate every node of a parsed expression with its value, width, signedness
 * and operand role. `targetWidth` is the LHS width when the expression is the
 * right-hand side of an assignment (§11.6.1: the LHS is part of the context).
 * Throws SvExpressionError for an undeclared identifier or an illegal construct.
 */
export function annotateTree(ast: ExprNode, env: SvEnv, targetWidth?: number): NodeAnnotation {
  const ev = new Evaluator(env, {});
  const operands: OperandInfo[] = [];
  collectOperands(ast, env, "context", new Evaluator(env, {}), operands);
  const leafInfo = (n: ExprNode, role: OperandRole) => operands.find((o) => o.text === n.text && o.role === role) ?? operands.find((o) => o.text === n.text);

  const annotate = (n: ExprNode, id: string, role: OperandRole, W: number, S: boolean): NodeAnnotation => {
    const selfWidth = ev.size(n);
    const selfSigned = ev.sign(n);
    const value = n.kind === "stream" ? ev.evalPrimary(n) : ev.evalCtx(n, W, S);
    const kids: NodeAnnotation[] = [];
    const child = (c: ExprNode, r: OperandRole, w: number, s: boolean) => kids.push(annotate(c, `${id}.${kids.length}`, r, w, s));
    const self = (c: ExprNode) => child(c, "self", ev.size(c), ev.sign(c));
    // §11.4.12.1: a zero replication has size zero and is ignored. Its parent's evaluation has
    // already checked that it is legal there; on its own it would throw, so it is not evaluated.
    const member = (c: ExprNode) => {
      const inner = unwrap(c);
      if (inner.kind === "repl" && inner.count === 0) {
        kids.push({ id: `${id}.${kids.length}`, kind: c.kind, text: c.text, selfWidth: 0, selfSigned: false, width: 0, signed: false, role: "self", value: makeValue(0, false, ZERO), children: [] });
      } else {
        self(c);
      }
    };
    const compare = (l: ExprNode, r: ExprNode) => {
      const w = Math.max(ev.size(l), ev.size(r));
      const s = ev.sign(l) && ev.sign(r);
      child(l, "compare", w, s);
      child(r, "compare", w, s);
    };
    switch (n.kind) {
      case "paren":
        child(n.inner, role, W, S);
        break;
      case "unary":
        if (isContextNode(n)) child(n.arg, role, W, S);
        else self(n.arg);
        break;
      case "binary":
        if (ARITH.has(n.op) || BITWISE.has(n.op)) {
          child(n.left, role, W, S);
          child(n.right, role, W, S);
        } else if (SHIFTS.has(n.op) || n.op === "**") {
          child(n.left, role, W, S);
          self(n.right);
        } else if (LOGICAL.has(n.op)) {
          self(n.left);
          self(n.right);
        } else {
          compare(n.left, n.right);
        }
        break;
      case "cond":
        self(n.cond);
        child(n.then, role, W, S);
        child(n.otherwise, role, W, S);
        break;
      case "concat":
      case "repl":
      case "stream":
        n.parts.forEach(member);
        break;
      case "sysfn":
        self(n.arg);
        (n.controls ?? []).forEach(self);
        break;
      case "cast": {
        if (n.cast.kind === "sign") {
          self(n.arg);
        } else {
          const N = n.cast.kind === "size" ? n.cast.width : TYPE_SIZES[n.cast.type];
          child(n.arg, "cast", Math.max(N, ev.size(n.arg)), ev.sign(n.arg));
        }
        break;
      }
      case "inside": {
        const items = n.items.flatMap((it) => (it.kind === "value" ? [it.expr] : [it.lo, it.hi]));
        const w = Math.max(ev.size(n.left), ...items.map((it) => ev.size(it)));
        child(n.left, "compare", w, ev.sign(n.left) && items.every((it) => ev.sign(it)));
        items.forEach((it) => child(it, "compare", Math.max(ev.size(n.left), ev.size(it)), ev.sign(n.left) && ev.sign(it)));
        break;
      }
      default:
        break;
    }
    const operand = isLeaf(n) ? leafInfo(n, role) : undefined;
    return { id, kind: n.kind, text: n.text, selfWidth, selfSigned, width: W, signed: S, role, value, ...(operand ? { operand } : {}), children: kids };
  };

  const root = unwrap(ast);
  const rootWidth = root.kind === "stream" ? ev.size(root) : Math.max(targetWidth ?? 0, ev.size(ast));
  return annotate(ast, "r", "context", rootWidth, ev.sign(ast));
}

// ---------------------------------------------------------------------------
// Concatenation as an assignment target (§11.4.12)
// ---------------------------------------------------------------------------

export interface ConcatTargetMember {
  name: string;
  width: number;
}

export interface ConcatTargetPart extends ConcatTargetMember {
  /** Bit numbers of this member inside the concatenation, [hi:lo], MSB first. */
  hi: number;
  lo: number;
  value: SvValue;
}

export interface ConcatTargetSplit {
  /** Sum of the member widths: the width of the concatenation as a packed vector. */
  total: number;
  /** The right-hand side after it is resized to `total` bits (§10.7 / §11.8.3). */
  resized: SvValue;
  /** Number of RHS MSBs discarded (RHS wider than the concatenation). */
  dropped: number;
  /** Number of bits added on the left (RHS narrower than the concatenation): sign bits when the RHS is signed, else 0. */
  extended: number;
  parts: ConcatTargetPart[];
}

/**
 * `{m0, m1, …} = rhs;` — the concatenation is a packed vector of the summed
 * widths; its first member takes the most significant bits (§11.4.12). The RHS
 * is resized to that vector exactly as for any assignment (§11.8.3, §10.7), then
 * cut by member width, MSB first. Replications may not be targets (§11.4.12.1).
 */
export function splitConcatTarget(members: ConcatTargetMember[], rhs: SvValue): ConcatTargetSplit {
  const total = members.reduce((s, m) => s + m.width, 0);
  const resized = resize(rhs, total, rhs.signed, false);
  const parts: ConcatTargetPart[] = [];
  let hi = total - 1;
  for (const m of members) {
    const lo = hi - m.width + 1;
    parts.push({ ...m, hi, lo, value: makeValue(m.width, false, resized.aval >> big(lo), resized.bval >> big(lo)) });
    hi = lo - 1;
  }
  return { total, resized, dropped: Math.max(0, rhs.width - total), extended: Math.max(0, total - rhs.width), parts };
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
  // In "ordinary math" a slice of a signed variable is still that signed number.
  const ev = new Evaluator(env, { xAsZero: true, selectKeepsSign: true });
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
  /**
   * A fix names the trap it cures: the id of that variant, shown beside the result in the
   * reveal. It comes earlier in the variant order, so the reveal never answers the next question.
   */
  contrast?: string;
  /** The step of a fix that cures the trap: the first step of this kind (and scope or op). It carries the key-step badge at every operand value. */
  keyStep?: { kind: "context"; scope: "assignment" | "comparison" | "cast" } | { kind: "op"; op: string };
  /** What this code does that the evaluator's steps do not say; true for every operand value, and added to the correct answer's feedback. */
  takeaway?: string;
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
  /** The rule the scenario teaches. It answers the prediction, so it is shown only in the reveal; `title` and `summary` must not state it. */
  rule?: string;
  /** Option labels show the bit pattern beside the number, e.g. `v = 188 (8'hBC)`, where the question is which bits survive. */
  labelBits?: boolean;
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
      { id: "fix", label: "a + $signed(u)", expr: "a + $signed(u)", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "assignment" } },
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
    summary: "A signed value is compared with a constant. How does the comparison read a's bits?",
    decls: [{ name: "a", type: "logic", signed: true, width: 4, init: "-4" }],
    target: { name: "pos", type: "bit" },
    variants: [
      { id: "trap", label: "a > 4'd0", expr: "a > 4'd0", role: "trap" },
      { id: "fix-unsized", label: "a > 0", expr: "a > 0", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "comparison" } },
      { id: "fix-signed", label: "a > 4'sd0", expr: "a > 4'sd0", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "comparison" } },
    ],
    editable: [{ name: "a", widths: [4, 8] }],
    intent: "a compared as a signed number",
    rule: "A comparison is signed only when both operands are signed: one unsigned operand makes it unsigned, so a negative a reads as a large positive number. A plain decimal and a literal with s are signed; 4'd0 is not (§11.4.4, §11.8.1).",
  },
  {
    id: "shift-fill",
    title: ">> vs >>>",
    summary: "Halving a negative number with a right shift. Which shift keeps the sign, and how wide is the context?",
    decls: [],
    target: { name: "r", type: "logic", signed: true, width: 4 },
    variants: [
      { id: "logical", label: "-4'sd1 >> 1", expr: "-4'sd1 >> 1", role: "trap" },
      { id: "arith", label: "-4'sd1 >>> 1", expr: "-4'sd1 >>> 1", role: "fix", contrast: "logical", keyStep: { kind: "op", op: ">>>" } },
      { id: "int-target", label: "int r = -4'sd1 >> 1", expr: "-4'sd1 >> 1", target: { name: "r", type: "int" }, role: "trap" },
    ],
    editable: [],
    intent: "halve -1 and keep the sign",
  },
  {
    id: "lost-carry",
    title: "carry out of 8 bits",
    summary: "Two 8-bit values are added. Does the carry survive?",
    decls: [
      { name: "a8", type: "logic", width: 8, init: "8'd200" },
      { name: "b8", type: "logic", width: 8, init: "8'd100" },
    ],
    target: { name: "s", type: "logic", width: 8 },
    variants: [
      { id: "sum8", label: "8-bit s = a8 + b8", expr: "a8 + b8", role: "trap" },
      { id: "sum9", label: "9-bit s = a8 + b8", expr: "a8 + b8", target: { name: "s", type: "logic", width: 9 }, role: "fix", contrast: "sum8", keyStep: { kind: "context", scope: "assignment" } },
      { id: "avg8", label: "s = (a8 + b8) >> 1", expr: "(a8 + b8) >> 1", role: "trap" },
      {
        id: "avg-fix",
        label: "s = (a8 + b8 + 0) >> 1",
        expr: "(a8 + b8 + 0) >> 1",
        role: "fix",
        contrast: "avg8",
        keyStep: { kind: "context", scope: "assignment" },
        takeaway: "The 32-bit context keeps any carry: the unsized 0 widens the sum to 32 bits, so the shift moves a carry back into the 8 bits s keeps (§11.6.1, §11.6.2).",
      },
      {
        id: "size-cast",
        label: "s = (9'(a8) + b8) >> 1",
        expr: "(9'(a8) + b8) >> 1",
        role: "fix",
        contrast: "avg8",
        keyStep: { kind: "context", scope: "cast" },
        takeaway: "The 9-bit context keeps any carry: the sum runs in 9 bits, so a carry into bit 8 survives the add and the shift moves it back into the 8 bits s keeps (§11.6.1).",
      },
    ],
    editable: [
      { name: "a8", min: 0, max: 255 },
      { name: "b8", min: 0, max: 255 },
    ],
    intent: "the true sum or average",
    rule: "The LHS width counts: the context is the widest of the LHS and the context-determined operands; a shift count is self-determined and does not count. Those operands are extended to the context before the operation. The carry survives only when the target, a cast or a wider context-determined operand makes the context wider than the sum's 8 bits (§11.6.1, Table 11-21).",
  },
  {
    id: "int-vs-logic",
    title: "int vs logic [31:0]",
    summary: "An int and a logic [31:0] are compared, both 32 bits wide. How does the comparison read i's bits?",
    decls: [
      { name: "i", type: "int", init: "-1" },
      { name: "w", type: "logic", width: 32, init: "32'd1" },
    ],
    target: { name: "lt", type: "bit" },
    variants: [
      { id: "trap", label: "i < w", expr: "i < w", role: "trap" },
      { id: "fix", label: "i < $signed(w)", expr: "i < $signed(w)", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "comparison" } },
      { id: "fix-cast", label: "i < int'(w)", expr: "i < int'(w)", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "comparison" } },
    ],
    editable: [
      { name: "i", min: -1000, max: 1000 },
      { name: "w", min: 0, max: 1000 },
    ],
    intent: "i compared as a signed number",
    rule: "int is signed and logic [31:0] is not, and a comparison with an unsigned operand is unsigned, so a negative i reads as a large positive number (§6.11, §11.4.4, §11.8.1).",
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
  {
    id: "casts",
    title: "size, sign and type casts",
    summary: "A few bit patterns go through a size cast, a sign cast and a type cast. Which bits survive each one, and how are they read afterwards?",
    decls: [{ name: "w", type: "logic", width: 8, init: "8'hF0" }],
    target: { name: "v", type: "logic", width: 8 },
    variants: [
      { id: "size-cast", label: "logic [7:0] v = 8'(12'hABC)", expr: "8'(12'hABC)", role: "contrast" },
      { id: "sign-cast", label: "logic signed [7:0] v = signed'(4'b1100)", expr: "signed'(4'b1100)", target: { name: "v", type: "logic", signed: true, width: 8 }, role: "contrast" },
      { id: "sysfn", label: "logic signed [7:0] v = $signed(4'b1100)", expr: "$signed(4'b1100)", target: { name: "v", type: "logic", signed: true, width: 8 }, role: "contrast" },
      {
        id: "type-cast",
        label: "int v = int'(w)",
        expr: "int'(w)",
        target: { name: "v", type: "int" },
        role: "trap",
        // Stands alone: at w < 128 the answer's insight does not mention the extension at all.
        takeaway: "w is unsigned, so int'(w) zero-extends it; int being signed does not change that: the extension follows the expression inside the cast, not the cast type (§6.24.1).",
      },
      {
        id: "type-cast-signed",
        label: "int v = int'(signed'(w))",
        expr: "int'(signed'(w))",
        target: { name: "v", type: "int" },
        role: "fix",
        contrast: "type-cast",
        keyStep: { kind: "context", scope: "cast" },
        takeaway: "signed'(w) is signed, so int'(signed'(w)) sign-extends it; the sign cast is what changes the extension: int'(w) alone always adds zeros (§6.24.1).",
      },
    ],
    editable: [{ name: "w", min: 0, max: 255 }],
    // Which bits survive a cast is the question, so each option shows its bit pattern next to the number.
    labelBits: true,
    rule: "A size cast pads or truncates and keeps the signedness; a sign cast keeps the bits and changes how they are read; a type cast behaves like an assignment to that type (§6.24.1).",
  },
  {
    id: "part-select",
    title: "whole-vector part-select",
    summary: "sb starts at -8. Does selecting all of its bits change what a wider signed w holds?",
    decls: [{ name: "sb", type: "logic", signed: true, width: 8, init: "-8" }],
    target: { name: "w", type: "logic", signed: true, width: 16 },
    variants: [
      { id: "whole", label: "w = sb", expr: "sb", role: "contrast" },
      { id: "select", label: "w = sb[7:0]", expr: "sb[7:0]", role: "trap" },
      { id: "fix", label: "w = $signed(sb[7:0])", expr: "$signed(sb[7:0])", role: "fix", contrast: "select", keyStep: { kind: "op", op: "$signed" } },
    ],
    editable: [{ name: "sb", min: -128, max: 127 }],
    intent: "sb copied as a signed number",
    // Worded apart from the trace's select sentence, which the answer's feedback quotes: the reveal shows both.
    rule: "A part-select gives an unsigned result whatever the sign of its variable, even when it selects every bit, so it is zero-extended into a wider target; the signed target does not help (§11.8.1).",
  },
  {
    id: "literal-sign",
    title: "literal signedness",
    summary: "Minus twelve divided by three, written four ways. Does the way the literal is written change the quotient?",
    decls: [],
    target: { name: "q", type: "int" },
    variants: [
      // Plain control, not a fix: it opens the scenario, so it must not show the based trap's result before the learner is asked it.
      { id: "decimal", label: "q = -12 / 3", expr: "-12 / 3", role: "contrast" },
      { id: "based", label: "q = -'d12 / 3", expr: "-'d12 / 3", role: "trap" },
      { id: "based-signed", label: "q = -'sd12 / 3", expr: "-'sd12 / 3", role: "fix", contrast: "based", keyStep: { kind: "context", scope: "assignment" } },
      {
        id: "sized-signed",
        label: "q = -4'sd12 / 3",
        expr: "-4'sd12 / 3",
        role: "trap",
        takeaway: "The minus then negates -4, so the division is 4 / 3, which is 1 (§11.3.3).",
      },
    ],
    editable: [],
    intent: "minus twelve divided by three",
    rule: "A simple decimal is signed; a based literal is unsigned unless it carries an s (§11.8.1). A sized literal holds only its declared bits, so with s the pattern is read as a two's-complement number (§5.7.1, §11.3.3).",
  },
  {
    id: "ashr-unsigned-context",
    title: ">>> in a mixed expression",
    summary: "s starts negative and is shifted with >>>. The result then meets u, or s is read through a part-select. Which bit fills the vacated position?",
    decls: [
      { name: "s", type: "logic", signed: true, width: 8, init: "-8" },
      { name: "u", type: "logic", width: 8, init: "8'd1" },
    ],
    target: { name: "r", type: "logic", signed: true, width: 8 },
    variants: [
      { id: "trap", label: "r = (s >>> 1) + u", expr: "(s >>> 1) + u", role: "trap" },
      { id: "fix", label: "r = (s >>> 1) + $signed(u)", expr: "(s >>> 1) + $signed(u)", role: "fix", contrast: "trap", keyStep: { kind: "context", scope: "assignment" } },
      {
        id: "select",
        label: "r = s[7:0] >>> 1",
        expr: "s[7:0] >>> 1",
        role: "trap",
        takeaway: `s[7:0] is a part-select, and a part-select is ${SELECT_UNSIGNED}, so this expression is unsigned.`,
      },
    ],
    editable: [
      { name: "s", min: -128, max: 127 },
      { name: "u", min: 0, max: 127 },
    ],
    intent: "halve s and keep its sign",
    rule: "An unsigned context-determined operand, including a bare part-select, makes the expression unsigned, so >>> fills with 0 (§11.4.10, §11.8.1). Self-determined operands do not count: the shift count and a ?: condition never affect the sign (Table 11-21). If the shifted value and every other context-determined operand are signed, >>> copies the sign bit.",
  },
];

export type StepBadge = "trap" | "key";

/**
 * The badge each trace step carries. A step is badged when it decides the result:
 * in a trap variant that is the trap; elsewhere it is the variant's cure or point.
 * A trap variant whose result matches what the author meant (`matchesIntent`) has
 * sprung no trap at these values, so it carries no badge.
 */
export function stepBadges(variant: TrapVariant, steps: ExprStep[], matchesIntent = false): (StepBadge | null)[] {
  if (variant.role === "trap" && matchesIntent) return steps.map(() => null);
  const want = variant.keyStep;
  const key = want
    ? steps.findIndex((s) => (want.kind === "context" ? s.kind === "context" && s.scope === want.scope : s.kind === "op" && s.op === want.op))
    : -1;
  return steps.map((s, i) => (i === key ? "key" : !s.surprising ? null : variant.role === "trap" ? "trap" : "key"));
}

export interface TrapPredictionOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
  misconception:
    | "model"
    | "math"
    | "saturate"
    | "ignore-lhs"
    | "swap-shift"
    | "optimistic-x"
    | "opposite-sign"
    | "cast-ignored"
    | "cast-extend"
    | "keep-msbs"
    | "select-signed"
    | "literal-face-value"
    | "plain";
}

const SIZED_DECIMAL = /(\d[\d_]*)\s*'([sS]?)[dD]\s*(\d[\d_]*)/g;

/** A sized decimal reads differently from its digits when they need more than N bits, or, with s, when they set bit N-1. */
const faceValueDiffers = (N: number, signed: boolean, n: bigint) => n >= (signed ? ONE << big(N - 1) : ONE << big(N));

/**
 * Sized decimal literals that do not read as their digits, rewritten as the
 * plain decimal the digits spell (the "face value" misconception): `4'sd12`
 * holds 1100, which reads as -4, but a learner may read it as twelve.
 */
function faceValueRewrite(expr: string): string | null {
  let changed = false;
  const out = expr.replace(SIZED_DECIMAL, (m, size: string, s: string, digits: string) => {
    if (!faceValueDiffers(Number(size.replace(/_/g, "")), s !== "", BigInt(digits.replace(/_/g, "")))) return m;
    changed = true;
    return digits.replace(/_/g, "");
  });
  return changed ? out : null;
}

/**
 * Why each sized decimal in `expr` does not hold its face value (§5.7.1). Only
 * digits that need more than N bits are truncated; digits that fit but set bit
 * N-1 of an s literal keep every bit, and only the reading changes.
 */
function faceValueSlips(expr: string): string[] {
  const out: string[] = [];
  for (const m of expr.matchAll(SIZED_DECIMAL)) {
    const N = Number(m[1].replace(/_/g, ""));
    const signed = m[2] !== "";
    const n = BigInt(m[3].replace(/_/g, ""));
    if (!faceValueDiffers(N, signed, n)) continue;
    const held = parseLiteral(m[0].replace(/\s+/g, "")).value;
    if (n >= ONE << big(N)) {
      out.push(
        `${n} needs more than ${N} bits, so the literal is truncated from the left to its size: the bits above bit ${N - 1} are dropped (§5.7.1).${signed ? ` The s then reads the ${N} bits that remain as two's complement (§11.3.3).` : ""}`,
      );
    } else {
      out.push(`${n} is ${formatCompact(reinterpret(held, false))}, which fits in ${N} bits; the s changes only how those bits are read: as two's complement, ${formatDecimal(held)} (§5.7.1, §11.3.3).`);
    }
  }
  return out;
}

/** The option label for code that does not compile. */
const COMPILE_ERROR = "Compile error";

/** The one sentence a live region reads after a reveal; the full feedback is read when focus lands on it. */
export function predictionVerdict(options: { id: string; label: string; correct: boolean }[], committed: string | null): string {
  const chosen = options.find((o) => o.id === committed);
  const answer = options.find((o) => o.correct)?.label;
  const lead = !chosen ? "Answer revealed without a prediction." : chosen.correct ? "Your prediction is right." : "Your prediction is wrong.";
  if (!answer) return lead;
  return `${lead} The answer is ${answer === COMPILE_ERROR ? "a compile error" : answer}.`;
}

/** How the learner sees a value of the target type in an option. `bits` adds the bit pattern of a known value, e.g. `v = 188 (8'hBC)`. */
export function formatTargetValue(name: string, v: SvValue, bits = false): string {
  if (!isKnown(v)) return `${name} = ${formatLiteral(reinterpret(v, false))}`;
  return `${name} = ${formatDecimal(v)}${bits ? ` (${vectorLabel(v)})` : ""}`;
}

/**
 * A comparison's result with its operands read the other way (signed for
 * unsigned and back), or null when `expr` is not a relational or equality
 * comparison. The operands are sized to each other as usual (§11.8.2).
 */
function otherSignComparison(expr: string, env: SvEnv): { bit: Bit4; signed: boolean } | null {
  const root = unwrap(parseExpression(expr));
  if (root.kind !== "binary" || !(RELATIONAL.has(root.op) || EQUALITY.has(root.op))) return null;
  const ev = new Evaluator(env, {});
  const W = Math.max(ev.size(root.left), ev.size(root.right));
  const S = !(ev.sign(root.left) && ev.sign(root.right));
  return { bit: comparisonBit(root.op, ev.evalCtx(root.left, W, S), ev.evalCtx(root.right, W, S), S), signed: S };
}

/**
 * Prediction options for `target = expr;`: the model's answer plus the
 * answers produced by named misconceptions, each with diagnostic feedback.
 * Options with the same label are merged (the correct one wins). `takeaway` is
 * a code variant's own sentence (`TrapVariant.takeaway`) for the correct answer.
 *
 * A reveal shows the chosen option's feedback and then the correct option's
 * feedback ("Why the answer holds"). The correct option carries the insight; a
 * wrong option names only what that choice assumed, so no reveal prints the
 * insight twice. `labelBits` adds the bit pattern to each label (`TrapScenario.labelBits`).
 */
export function trapPredictionOptions(decls: SvDecl[], target: SvDecl, expr: string, takeaway?: string, { labelBits = false }: { labelBits?: boolean } = {}): TrapPredictionOption[] {
  const real = evaluateAssignment(decls, target, expr);
  if (!real.ok) return [];
  const type = declType(target);
  const name = target.name;
  const env = buildEnv(decls);
  const cands: TrapPredictionOption[] = [];
  const show = (v: SvValue) => formatTargetValue(name, v, labelBits);
  const add = (label: string, misconception: TrapPredictionOption["misconception"], feedback: string) => {
    if (cands.some((c) => c.label === label)) return;
    cands.push({ id: `${misconception}-${cands.length}`, label, correct: false, feedback, misconception });
  };
  const answer = takeaway ? `${real.insight} ${takeaway}` : real.insight;
  cands.push({ id: "model", label: show(real.final), correct: true, feedback: answer, misconception: "model" });

  if (/\[\s*\d+\s*(:\s*\d+\s*)?\]/.test(expr)) {
    const signedSelect = evaluateAssignment(decls, target, expr, { selectKeepsSign: true });
    if (signedSelect.ok) {
      // The answer's feedback names the zero extension when one happens; add the rule (and the >>> fill, only when >>> is written) only where it does not.
      const rule = answer.includes(SELECT_UNSIGNED) ? "" : ` A part-select is ${SELECT_UNSIGNED}.`;
      const fill = expr.includes(">>>") && !answer.includes(">>>") ? " >>> in an unsigned expression fills with 0 (§11.4.10)." : "";
      add(show(signedSelect.final), "select-signed", `That treats the part-select as signed.${rule}${fill}`);
    }
  }

  // A number the target can hold is labelled like any value of the target; one it cannot hold has no bit pattern to show.
  const showNumber = (n: bigint) => {
    const v = fromBigInt(n, type.width, type.signed);
    return toBigInt(v) === n ? show(v) : `${name} = ${n.toString()}`;
  };

  const math = mathIntuition(expr, env);
  if (math !== null) {
    const representable = toBigInt(fromBigInt(math, type.width, type.signed)) === math;
    const readsXasZero = real.operands.some((o) => !isKnown(o.value));
    const { min, max } = valueRange(target);
    add(
      showNumber(math),
      "math",
      `${readsXasZero ? "That reads the x bit as 0 and then does ordinary integer math." : "That is ordinary integer math: each operand keeps its declared sign and no bit is lost."} ${
        representable ? "" : `It is not even in range: ${name} holds ${min} to ${max}. `
      }SystemVerilog does not evaluate that way here.`,
    );
    if (!representable && type.width > 1) {
      add(
        showNumber(BigInt(math > BigInt(max) ? max : min)),
        "saturate",
        `SystemVerilog never saturates. An assignment checks no range: ${name} keeps the low ${bitsWord(type.width)} and reads them as ${signWord(type.signed)} (§10.7).`,
      );
    }
  }

  const narrow = evaluateAssignment(decls, target, expr, { ignoreLhsWidth: true });
  if (narrow.ok) {
    add(
      show(narrow.final),
      "ignore-lhs",
      `That evaluates \`${expr}\` in only ${real.rhsWidth} bits. The LHS is part of the context (§11.6.1), so the context-determined operands are first extended to ${real.contextWidth} bits and nothing is lost before the assignment.`,
    );
  }

  if (/>>/.test(expr)) {
    const swapped = evaluateAssignment(decls, target, expr, { swapRightShifts: true });
    if (swapped.ok) {
      add(
        show(swapped.final),
        "swap-shift",
        "That is the other right shift. >> always fills the vacated bits with 0; >>> copies the sign bit, and only when the expression is signed (§11.4.10).",
      );
    }
  }

  const faceValue = faceValueRewrite(expr);
  if (faceValue !== null) {
    const face = mathIntuition(faceValue, env);
    const slips = faceValueSlips(expr);
    if (face !== null && slips.length > 0) {
      add(showNumber(face), "literal-face-value", `That reads ${slips.length === 1 ? "the sized literal by its digits" : "the sized literals by their digits"}. ${slips.join(" ")}`);
    }
  }

  if (/'\(|\$signed|\$unsigned/.test(expr)) {
    const stripped = evaluateAssignment(decls, target, expr, { ignoreCasts: true });
    if (stripped.ok) {
      add(
        show(stripped.final),
        "cast-ignored",
        // What each cast does is the scenario's rule and the answer's insight; this names the slip only.
        "That ignores the cast. A cast acts on its operand before the rest of the expression uses it (§6.24.1, §11.7).",
      );
    }
    // Casts the learner might expect to behave the other way round (§6.24.1).
    const root = unwrap(parseExpression(expr));
    if (root.kind === "cast" && root.cast.kind !== "sign") {
      const N = root.cast.kind === "size" ? root.cast.width : TYPE_SIZES[root.cast.type];
      const innerEval = evaluateExpression(root.arg.text, env);
      if (innerEval.ok) {
        const inner = innerEval.value;
        if (inner.width > N) {
          const kept = makeValue(N, inner.signed, inner.aval >> big(inner.width - N), inner.bval >> big(inner.width - N));
          add(
            show(resize(kept, type.width, kept.signed, type.signed)),
            "keep-msbs",
            `That keeps the top ${N} bits. A size cast returns what ${articleFor(N)} ${N}-bit variable would hold after assignment, so the LOW ${N} bits survive and the ${inner.width - N} MSBs are discarded (§6.24.1, §10.7).`,
          );
        } else if (inner.width < N) {
          const other = resize(inner, N, !inner.signed, root.cast.kind === "size" ? inner.signed : INTEGER_TYPES[root.cast.type].signed);
          add(
            show(resize(other, type.width, other.signed, type.signed)),
            "cast-extend",
            // The answer's takeaway says which sign decides the extension; these name the assumption only.
            inner.signed
              ? "That zero-extends, but the expression inside the cast is signed (§6.24.1)."
              : root.cast.kind === "type" && INTEGER_TYPES[root.cast.type].signed
                ? `That sign-extends because ${root.cast.type} is signed.`
                : "That sign-extends, but the expression inside the cast is unsigned (§6.24.1).",
          );
        }
      }
    }
  }

  const optimistic = type.fourState ? optimisticX(decls, target, expr) : null;
  if (optimistic) {
    add(
      show(optimistic),
      "optimistic-x",
      "That marks only the bits the unknown input can reach, which is what real gates might do. The LRM is pessimistic for arithmetic: any x/z operand bit makes the ENTIRE result x (§11.4.3).",
    );
  }

  if (!type.fourState && !isKnown(resize(real.rhsValue, type.width, real.rhsSigned, type.signed))) {
    add(
      show(resize(real.rhsValue, type.width, real.rhsSigned, type.signed)),
      "plain",
      // The store step, which the answer's feedback quotes, says what happens to the x/z bits; this names the slip.
      `That keeps x/z bits in ${name}, which cannot hold them (§6.11.2).`,
    );
  }

  if (type.width > 1 && isKnown(real.final)) {
    add(
      show(reinterpret(real.final, !type.signed)),
      "opposite-sign",
      `Right bits, wrong reading: ${name} is declared ${signWord(type.signed)}, so ${formatLiteral(reinterpret(real.final, false))} reads as ${formatDecimal(real.final)}.`,
    );
  }

  if (type.width === 1) {
    // A truth value the named misconceptions above did not produce: the comparison read with the other signedness, or no reading at all.
    const flipped = otherSignComparison(expr, env);
    (["0", "1"] as Bit4[]).forEach((b) =>
      add(
        `${name} = ${b}`,
        "plain",
        !flipped
          ? `${expr} does not give ${b} for these values.`
          : flipped.bit === b
            ? `That compares the operands as ${signWord(flipped.signed)} numbers.`
            : `Neither a signed nor an unsigned comparison of these values gives ${b}.`,
      ),
    );
    if (type.fourState) add(`${name} = 1'bx`, "plain", "No operand bit is x or z here, so the comparison has a known answer.");
  }

  if (cands.length < 3 && isKnown(real.final) && type.width > 1) {
    add(
      `${name} = x`,
      "plain",
      "Every operand bit is a known 0 or 1, so the result is known. Mixing widths and signedness is legal and fully defined; it only changes how the bits are extended and read (§11.8).",
    );
  }

  // Stable, value-sorted order so the correct answer is not always first.
  const key = (label: string) => {
    const m = /= (-?\d+)(?: \([^)]*\))?$/.exec(label);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };
  return cands.sort((a, b) => key(a.label) - key(b.label) || a.label.localeCompare(b.label));
}

/**
 * The value the author of a scenario meant, for the EXP/ACT comparison: ordinary
 * integer math on the literals as written, so `4'sd12` means twelve even though it
 * holds the pattern for -4.
 */
export function intendedValue(decls: SvDecl[], expr: string): bigint | null {
  return mathIntuition(faceValueRewrite(expr) ?? expr, buildEnv(decls));
}

// ---------------------------------------------------------------------------
// Operator explorer catalog and details (OperatorExplorer)
// ---------------------------------------------------------------------------

export type OperatorFamily = "bitwise" | "reduction" | "logical" | "equality" | "inside" | "conditional" | "shift" | "concat" | "bitcount" | "stream";
export type OperandSlot = "a" | "b" | "c" | "n";

export interface OperatorSpec {
  id: string;
  family: OperatorFamily;
  /**
   * SV source evaluated by the model, written with the operand display names
   * (`slotName`). `R` stands for the editable replication count
   * (`OperatorInputs.repl`); `operatorTemplate` resolves it.
   */
  template: string;
  operands: OperandSlot[];
  rule: string;
  clause: string;
  /** Code that looks plausible but is illegal or means something else. */
  trap?: string;
  /** The answer does not depend on the operand values, so the learner gets no editors: an edit would only reset the prediction. */
  fixedAnswer?: boolean;
  /** Display names for slots whose lesson spelling differs from the slot letter, e.g. `{ a: "state" }`. */
  names?: Partial<Record<OperandSlot, string>>;
  /** Operand values (and replication count) loaded when this operator is selected. */
  defaults?: Partial<OperatorInputs>;
  /**
   * The template is an assignment whose left-hand side is a concatenation of
   * the operands: this is its right-hand side (§11.4.12, a concatenation as a target).
   */
  targetRhs?: string;
  /** Default replication count for templates that contain `R`. */
  replDefault?: number;
}

export const operatorFamilies: { id: OperatorFamily; label: string }[] = [
  { id: "bitwise", label: "Bitwise" },
  { id: "reduction", label: "Reduction" },
  { id: "logical", label: "Logical" },
  { id: "equality", label: "Equality" },
  { id: "inside", label: "inside" },
  { id: "conditional", label: "?:" },
  { id: "shift", label: "Shift" },
  { id: "concat", label: "Concat" },
  { id: "bitcount", label: "$countbits" },
  { id: "stream", label: "Streaming" },
];

/** The replication count a template with `R` uses: the inputs' count, else the spec's default, else 2. */
export function replCount(spec: OperatorSpec, inputs: Pick<OperatorInputs, "repl">): number {
  return inputs.repl ?? spec.replDefault ?? 2;
}

/** The template with the replication placeholder `R` resolved to its count. */
export function operatorTemplate(spec: OperatorSpec, inputs: Pick<OperatorInputs, "repl">): string {
  return spec.template.replace(/\bR\b/g, String(replCount(spec, inputs)));
}

/** The name a slot is declared under for this operator (`a`, or e.g. `state`). */
export function slotName(spec: OperatorSpec, slot: OperandSlot): string {
  return spec.names?.[slot] ?? slot;
}

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
    fixedAnswer: true,
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
  {
    id: "cond",
    family: "conditional",
    template: "sel ? a : b",
    operands: ["c", "a", "b"],
    names: { c: "sel" },
    rule: "A known condition picks one branch. An x/z condition evaluates both and compares them with == (§11.4.5). If that gives 1, either one is returned. Otherwise they merge bit by bit: a bit survives only where the branches agree on 0 or 1; every other pair, including x with x and z with z, is x.",
    clause: "§11.4.11, Table 11-20",
    defaults: { c: ["x"], a: ["1", "1", "0", "0"], b: ["1", "0", "1", "0"] },
  },
  {
    id: "cond-z",
    family: "conditional",
    template: "en ? data : 'z",
    operands: ["c", "a"],
    names: { c: "en", a: "data" },
    rule: "A known en returns one branch: data, or all z, because 'z fills every bit of the else branch. With en unknown, each data bit merges with z, and Table 11-20 makes every such pair x.",
    clause: "§11.4.11, Table 11-20, §5.7.1",
    defaults: { c: ["x"], a: ["1", "0", "1", "0"] },
    trap: "a tri-state model drives x, not z, when en is unknown",
  },
  { id: "concat", family: "concat", template: "{a, b}", operands: ["a", "b"], rule: "Operands are self-determined and joined MSB first; the result is unsigned.", clause: "§11.4.12, §11.8.1" },
  {
    id: "repl-n",
    family: "concat",
    template: "{R{a}}",
    operands: ["a"],
    rule: "R copies of a, side by side. A zero replication on its own has no bits and is illegal; inside a concatenation with a positive-size operand it is legal and ignored.",
    clause: "§11.4.12.1",
    replDefault: 2,
    defaults: { repl: 2 },
  },
  {
    id: "concat-target",
    family: "concat",
    template: "{hi, lo} = 16'hBEEF",
    targetRhs: "16'hBEEF",
    fixedAnswer: true,
    operands: ["a", "b"],
    names: { a: "hi", b: "lo" },
    rule: "A concatenation may be an assignment target: the value is cut by member width, the first member taking the most significant bits, as in a source concatenation. A replication such as {2{hi}} may not be a target.",
    clause: "§11.4.12, §11.4.12.1",
    defaults: { a: bitsOf(parseLiteral("8'h12").value), b: bitsOf(parseLiteral("8'h34").value) },
  },
  {
    id: "sign-extend",
    family: "concat",
    template: "{{R{n[3]}}, n}",
    operands: ["a"],
    names: { a: "n" },
    rule: "Sign extension by hand: replicate the sign bit n[3] in front of n. The replication count is a constant; with 0 copies the replication has no bits and only n remains.",
    clause: "§11.4.12.1, §11.8.1",
    replDefault: 4,
    defaults: { a: ["1", "0", "1", "0"], repl: 4 },
  },
  {
    id: "concat-unsized",
    family: "concat",
    template: "{a, 1}",
    operands: ["a"],
    rule: "Unsized numbers are not allowed in a concatenation because their size is unknown.",
    clause: "§11.4.12",
    trap: "unsized literal in {}",
    fixedAnswer: true,
  },
  {
    id: "countones",
    family: "bitcount",
    template: "$countones(state)",
    operands: ["a"],
    names: { a: "state" },
    rule: "$countbits(state, '1): the number of bits that are exactly 1. x and z bits never count. Returns an int.",
    clause: "§20.9",
  },
  {
    id: "onehot",
    family: "bitcount",
    template: "$onehot(state)",
    operands: ["a"],
    names: { a: "state" },
    rule: "$countbits(state, '1) == 1: true when exactly one bit is 1. An x or z bit is not a 1, so 01x0 passes. Returns a bit, never x.",
    clause: "§20.9",
    trap: "passes with an x bit",
  },
  {
    id: "onehot0",
    family: "bitcount",
    template: "$onehot0(state)",
    operands: ["a"],
    names: { a: "state" },
    rule: "$countbits(state, '1) <= 1: zero or one bit set; x and z bits never count. Returns a bit.",
    clause: "§20.9",
  },
  {
    id: "isunknown",
    family: "bitcount",
    template: "$isunknown(state)",
    operands: ["a"],
    names: { a: "state" },
    rule: "$countbits(state, 'x, 'z) != 0: true when any bit is x or z. Returns a bit.",
    clause: "§20.9",
  },
  {
    id: "onehot-guarded",
    family: "bitcount",
    template: "$onehot(state) && !$isunknown(state)",
    operands: ["a"],
    names: { a: "state" },
    rule: "The guard an assertion needs: exactly one 1 AND no x/z. $onehot alone accepts 01x0.",
    clause: "§20.9, §11.4.7",
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
  /** Constant replication count for templates with `R` (0–8). */
  repl?: number;
}

/** A named starting point for one lesson use: an operator plus its operand values. */
export interface OperatorPreset {
  id: string;
  family: OperatorFamily;
  specId: string;
  label: string;
  /** What the learner should notice. */
  note: string;
  inputs: Partial<OperatorInputs>;
}

const B = (s: string) => s.split("") as Bit4[];

export const operatorPresets: OperatorPreset[] = [
  { id: "cond-x-sel", family: "conditional", specId: "cond", label: "sel = x: 1100 vs 1010", note: "The two middle bits differ, so they become x: 1xx0. if/else would give 1010.", inputs: { c: B("x"), a: B("1100"), b: B("1010") } },
  { id: "cond-equal", family: "conditional", specId: "cond", label: "sel = x: equal branches", note: "Both branches hold the same known bits, so no x appears.", inputs: { c: B("x"), a: B("1010"), b: B("1010") } },
  { id: "cond-tristate", family: "conditional", specId: "cond-z", label: "en = x: data vs 'z", note: "The bus drives x, not z.", inputs: { c: B("x"), a: B("1010") } },
  { id: "bitcount-legal", family: "bitcount", specId: "countones", label: "0100 (legal one-hot)", note: "One bit set, nothing unknown.", inputs: { a: B("0100") } },
  { id: "bitcount-two-hot", family: "bitcount", specId: "onehot", label: "0110 (two-hot)", note: "$onehot fails, $onehot0 fails too: two bits are set.", inputs: { a: B("0110") } },
  { id: "bitcount-x", family: "bitcount", specId: "onehot", label: "01x0 (one 1 and one x)", note: "Only $isunknown sees the x.", inputs: { a: B("01x0") } },
  { id: "bitcount-x-guarded", family: "bitcount", specId: "onehot-guarded", label: "01x0 with the guard", note: "The $isunknown term is what rejects this vector.", inputs: { a: B("01x0") } },
  { id: "bitcount-reset", family: "bitcount", specId: "onehot0", label: "xxxx (before reset)", note: "No bit is 1, so $onehot0 passes while every bit is unknown.", inputs: { a: B("xxxx") } },
  { id: "concat-target", family: "concat", specId: "concat-target", label: "{hi, lo} = 16'hBEEF", note: "hi takes the top byte, lo the bottom byte.", inputs: { a: bitsOf(parseLiteral("8'h12").value), b: bitsOf(parseLiteral("8'h34").value) } },
  { id: "concat-sign-extend", family: "concat", specId: "sign-extend", label: "{{4{n[3]}}, n} with n = 1010", note: "Set n[3] to 0 and the same braces add zeros.", inputs: { a: B("1010"), repl: 4 } },
  { id: "concat-unsized", family: "concat", specId: "concat-unsized", label: "{a, 1}: unsized constant", note: "The same 1 is legal in a + 1.", inputs: {} },
];

/** Declarations for the operands a spec uses, with literal initialisers. */
export function operatorDecls(spec: OperatorSpec, inputs: OperatorInputs): SvDecl[] {
  // Hex from 8 bits up when every nibble allows it (keeps code lines short), binary otherwise.
  const lit = (bits: Bit4[]) => (bits.length >= 8 ? formatHexLiteral(fromBits(bits)) : `${bits.length}'b${formatBits(fromBits(bits))}`);
  return spec.operands.map((slot) => ({
    name: slotName(spec, slot),
    type: "logic" as const,
    signed: slot === "a" ? inputs.signedA : undefined,
    width: inputs[slot].length,
    init: lit(inputs[slot]),
  }));
}

/**
 * Evaluate the spec's template. For a concatenation-target spec the evaluation
 * is of the right-hand side (self-determined); `concatTargetDetail` gives the split.
 */
export function runOperator(spec: OperatorSpec, inputs: OperatorInputs): ExpressionEvaluation | EvaluationFailure {
  const template = operatorTemplate(spec, inputs);
  let env: SvEnv;
  try {
    env = buildEnv(operatorDecls(spec, inputs));
  } catch (e) {
    return toFailure(template, e);
  }
  return evaluateExpression(spec.targetRhs ?? template, env);
}

export interface ConcatTargetEvaluation extends ConcatTargetSplit {
  ok: true;
  /** The right-hand side as evaluated on its own. */
  rhs: SvValue;
  /** Each member's value before the assignment. */
  before: { name: string; value: SvValue }[];
}

/** `{hi, lo} = rhs;` for a concatenation-target spec: each member's bits before and after. */
export function concatTargetDetail(spec: OperatorSpec, inputs: OperatorInputs): ConcatTargetEvaluation | EvaluationFailure {
  const rhs = runOperator(spec, inputs);
  if (!rhs.ok) return rhs;
  const members = spec.operands.map((slot) => ({ name: slotName(spec, slot), width: inputs[slot].length }));
  const before = spec.operands.map((slot) => ({ name: slotName(spec, slot), value: fromBits(inputs[slot]) }));
  return { ok: true, rhs: rhs.value, before, ...splitConcatTarget(members, rhs.value) };
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
 * A deterministic order that does not depend on how the options were built. A
 * label sort is not enough where the correct answer also sorts first ($countones
 * is rarely more than the other counts, >> always has the lowest bits), so the
 * order comes from a hash (FNV-1a).
 */
function stableOrder(opts: OperatorOption[], seed: string): OperatorOption[] {
  const hash = (text: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h ^ (h >>> 15)) >>> 0;
  };
  const rank = new Map(opts.map((o) => [o.id, hash(`${seed}|${o.label}`)]));
  return [...opts].sort((x, y) => (rank.get(x.id) as number) - (rank.get(y.id) as number) || x.label.localeCompare(y.label));
}

/** The ?: misconception that an x/z condition poisons the whole result. */
const allXAssumption = (width: number) => (width === 1 ? "That assumes an x/z condition always gives x." : "That assumes an x/z condition makes every bit x.");

/**
 * Prediction options for an operator case. Wrong options come from named
 * misconceptions.
 *
 * A reveal shows three texts at once: the chosen option's feedback, the correct
 * option's feedback (as "Why the answer holds") and the component's detail for
 * the run. Each says its own thing once: the correct option states the rule (for
 * code that does not compile, the compiler's message); a wrong option names only
 * what that choice assumed; the detail adds only the values of this run.
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
  const shuffled = () => stableOrder(opts, [spec.id, inputs.a.join(""), inputs.b.join(""), inputs.repl ?? ""].join("|"));

  if (!real.ok) {
    add(COMPILE_ERROR, true, `${real.error.message} (${real.error.clause})`);
    if (spec.id === "binary-nand") {
      const nand = val("~(a & b)");
      const red = val("~&a");
      if (nand) add(`${vectorLabel(nand)} (bitwise NAND)`, false, "That reads a ~& b as ~(a & b).");
      if (red) add(`${vectorLabel(red)} (reduction NAND of a)`, false, "That applies ~& to a alone and drops b.");
    }
    if (spec.id === "concat-unsized") {
      const ok1 = val("{a, 1'b1}");
      const ok32 = val("{a, 32'd1}");
      if (ok1) add(`${vectorLabel(ok1)} (1 treated as 1'b1)`, false, "That takes the unsized 1 as 1 bit wide, but an unsized number is at least 32 bits (§5.7.1).");
      if (ok32) add(`${ok32.width}-bit value (1 treated as 32'd1)`, false, `That takes the unsized 1 as exactly 32 bits, but §5.7.1 only promises at least 32: there is no ${ok32.width}-bit result.`);
    }
    if (spec.id === "repl-n" && real.error.code === "zero-replication-alone") {
      add("0-bit value (nothing)", false, "That expects $display to print an empty value, but with nothing else in the braces there is no value to print.");
      add(`${vectorLabel(fromBits(inputs.a))} (a unchanged)`, false, "Zero copies of a is not one copy.");
    }
    return shuffled();
  }

  if (spec.targetRhs) {
    const det = concatTargetDetail(spec, inputs);
    if (!det.ok) return opts;
    const label = (parts: { name: string; value: SvValue }[]) => parts.map((p) => `${p.name} = ${vectorLabel(p.value)}`).join(", ");
    const sizing =
      det.dropped > 0
        ? `The ${det.total}-bit concatenation keeps only the low ${det.total} bits of the ${det.rhs.width}-bit value; the ${det.dropped} MSB${det.dropped === 1 ? " is" : "s are"} discarded (§10.7). `
        : det.extended > 0
          ? `The ${det.rhs.width}-bit value is ${det.rhs.signed ? "sign" : "zero"}-extended to the ${det.total}-bit concatenation first (§11.8.3). `
          : "";
    add(label(det.parts), true, `${spec.rule} ${sizing}(${spec.clause})`);
    // The rule above says which member takes the MSBs and that a replication may not be a target, so these name only the slip.
    const reversed = [...det.parts].reverse();
    const swapped = reversed.map((p, i) => ({ name: det.parts[i].name, value: p.value }));
    if (det.parts.length > 1 && det.parts.every((p) => p.width === det.parts[0].width)) {
      add(label(swapped), false, `That is what {${reversed.map((p) => p.name).join(", ")}} = ${spec.targetRhs} would store.`);
    }
    add(COMPILE_ERROR, false, `It compiles: ${det.parts.map((p) => p.name).join(" and ")} are variables, and the concatenation is treated as one packed vector of the summed widths (§11.4.12).`);
    add(label(det.before), false, "Those are the old values. The assignment writes every bit of the concatenation, so it overwrites both members.");
    return shuffled();
  }

  const value = real.value;
  if (spec.family === "bitcount" && value.width === 32) {
    // $countones returns an int: options are decimal counts.
    const a = fromBits(inputs.a);
    const ones = countbits(a, "1");
    const xz = countbits(a, "x", "z");
    const report = bitVectorReport(a, slotName(spec, "a"));
    add(String(ones), true, `${report[0].arithmetic}. ${spec.rule} (${spec.clause})`);
    // The rule (the correct option) says which bits count and that the result is an int: these name only the slip.
    if (xz > 0) {
      add(String(ones + xz), false, `That counts the ${xz} x/z bit${xz === 1 ? "" : "s"} as 1.`);
      add("x (unknown)", false, "That expects x, but int is a 2-state type.");
    } else {
      add(String(a.width - ones), false, "That counts the 0 bits.");
      add(String(a.width), false, "That counts every bit.");
      add("x (unknown)", false, "That expects x, but every bit is known, and int is a 2-state type in any case.");
    }
    return shuffled();
  }

  if (value.width === 1) {
    const truth = bitAt(value, 0);
    // A 1-bit z result (a 1-bit `en ? data : 'z` with en = 0) needs its own option, or no answer is correct. A ?: branch
    // that holds z offers it too: with en = x, z is what if/else stores, the answer the tri-state trap is about.
    const zOption = truth === "z" || (spec.family === "conditional" && (spec.id === "cond-z" || inputs.a.includes("z") || inputs.b.includes("z")));
    ([...(["0", "1", "x"] as Bit4[]), ...(zOption ? (["z"] as Bit4[]) : [])]).forEach((b) => add(`1'b${b}`, b === truth, oneBitFeedback(spec, inputs, b, truth)));
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
      // The fill misconceptions go first: where a rotation gives the same bits, the diagnosis should name the fill.
      if (isRight) {
        const zero = val("a >> n");
        const sign = val("$signed(a) >>> n");
        // a >> n is the answer itself unless this is >>> on a signed a, so this option only ever appears there.
        if (zero) add(vectorLabel(zero), false, "That is a logical shift. With a declared signed, >>> copies the sign bit into the vacated positions.");
        if (sign) add(vectorLabel(sign), false, spec.id === "shr" ? ">> is always logical: it fills with 0 even when a is signed. Only >>> sign-fills." : "a is unsigned, so the expression is unsigned and >>> fills with 0, just like >>.");
      } else {
        add(vectorLabel(fromBits(inputs.a.map((b, i) => (i === 0 ? b : (inputs.a[i + s] ?? "0"))))), false, "<<< does not preserve the sign bit; it is identical to << (§11.4.10).");
      }
      add(vectorLabel(fromBits(rot(inputs.a, isRight))), false, "Shifts do not rotate: bits shifted out are lost and the vacated positions are filled (§11.4.10).");
    }
  } else if (spec.family === "concat") {
    const rev = spec.id === "concat" ? val("{b, a}") : null;
    if (rev) add(vectorLabel(rev), false, "The first operand lands in the most significant bits: {a, b} puts a on the left.");
    if (spec.id === "sign-extend") {
      const R = replCount(spec, inputs);
      const n = fromBits(inputs.a);
      const zeroExt = fromBits([...Array<Bit4>(R).fill("0"), ...inputs.a]);
      // The rule and the detail say what the copies are, why 0 copies is legal and how wide the result is: these name only the slip.
      if (!sameValue(reinterpret(zeroExt, false), reinterpret(value, false))) {
        add(vectorLabel(zeroExt), false, "That pads with 0 instead of copying n[3].");
      }
      if (R === 0) {
        add(COMPILE_ERROR, false, "That treats {0{n[3]}} as if it stood alone in braces.");
      } else {
        add(vectorLabel(n), false, `That leaves out the ${R} replicated bit${R === 1 ? "" : "s"}. Set the count to 0 to see the replication vanish.`);
      }
    }
    if (spec.id === "repl-n") {
      const R = replCount(spec, inputs);
      add(COMPILE_ERROR, false, `${R} cop${R === 1 ? "y" : "ies"} of a is legal: the multiplier is a non-negative constant without x or z (§11.4.12.1). Of the counts here, only 0 is illegal, because a zero replication alone in braces has no bits.`);
      const mul = fromBigInt((toBigInt(reinterpret(a, false)) ?? ZERO) * big(R), value.width);
      if (isKnown(a) && !sameValue(mul, reinterpret(value, false))) add(vectorLabel(mul), false, `Replication copies bits side by side; it does not multiply by ${R}.`);
    }
  } else if (spec.family === "conditional") {
    const c = fromBits(inputs.c);
    const truth = truthOf(c);
    const t = evaluateExpression(slotName(spec, "a"), buildEnv(operatorDecls(spec, inputs)));
    const thenValue = t.ok ? resize(t.value, value.width, false, false) : null;
    const elseSrc = spec.id === "cond-z" ? `${value.width}'bz` : slotName(spec, "b");
    const elseValue = val(elseSrc);
    const same = (v: SvValue | null) => v !== null && sameValue(reinterpret(v, false), reinterpret(value, false));
    // The rule (the correct option) gives the path, and the reveal's merge table and if/else row show this run, so each option names only its slip.
    if (truth === "x") {
      const zKept = elseValue ? mapBits(value.width, false, (i) => (bitAt(elseValue, i) === "z" ? "z" : bitAt(value, i))) : null;
      if (zKept && !same(zKept)) {
        add(vectorLabel(zKept), false, `Table 11-20 has no z result, not even for z with z.${elseValue && sameValue(zKept, elseValue) ? " An if/else would store this." : ""}`);
      }
      if (!same(elseValue) && elseValue) add(vectorLabel(elseValue), false, "That is what if/else stores.");
      if (!same(thenValue) && thenValue) add(vectorLabel(thenValue), false, "That treats the unknown condition as true.");
      if (!same(allX(value.width))) add(vectorLabel(allX(value.width)), false, allXAssumption(value.width));
    } else {
      const other = truth === "1" ? elseValue : thenValue;
      if (other && !same(other)) add(vectorLabel(other), false, "That is the other branch's value.");
      // What the same branches give when the condition is x/z (§11.4.11): either branch if they compare equal,
      // else the Table 11-20 merge. Only that value is "treating the condition as unknown"; all x is that value only
      // when the merge leaves no known bit, so otherwise all x makes no claim about the merge.
      const asUnknown = thenValue && elseValue ? conditionalDetail(fromBits(["x"]), thenValue, elseValue).result : null;
      const unknownSlip = `That treats the condition as unknown; it is ${truth}.`;
      if (asUnknown && !same(asUnknown)) add(vectorLabel(asUnknown), false, unknownSlip);
      const xs = allX(value.width);
      if (!same(xs)) add(vectorLabel(xs), false, asUnknown && bitsOf(asUnknown).every((b) => b === "x") ? unknownSlip : `Nothing here makes every bit x; the condition is ${truth}.`);
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
  // Editing can make every misconception coincide with the answer ({a, b} with a = b, a palindromic stream): keep a real choice.
  if (opts.length < 2) {
    add(vectorLabel(allX(value.width)), false, "Nothing here makes every bit x.");
    if (isKnown(value)) {
      add(vectorLabel(mapBits(value.width, false, (i) => notBit(bitAt(value, i)))), false, "That is the result with every bit inverted.");
    } else if (opts.length < 2) {
      add(vectorLabel(makeValue(value.width, false, ZERO)), false, "That reads the x bits as 0. An unknown bit stays unknown here.");
    }
  }
  return shuffled();
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
    // The two families below follow operatorPredictionOptions: the correct option states the rule, which the reveal
    // shows beside a wrong choice as "Why the answer holds", so a wrong option names only what it assumed.
    case "bitcount": {
      const name = slotName(spec, "a");
      const state = fromBits(inputs.a);
      const report = bitVectorReport(state, name);
      const xz = countbits(state, "x", "z");
      const ones = countbits(state, "1");
      const item = report.find((r) => r.fn === spec.template.slice(0, spec.template.indexOf("(")));
      if (right) {
        const oh = report[1];
        const unk = report[3];
        const computed =
          spec.id === "onehot-guarded"
            ? `$onehot(${name}) is ${oh.result} and $isunknown(${name}) is ${unk.result}, so the guard is ${truth === "1" ? "true" : "false"}.`
            : item
              ? `${item.arithmetic}, so ${item.fn}(${name}) returns ${item.result}.`
              : "";
        return `${computed} ${spec.rule} (${spec.clause})`.trim();
      }
      if (chosen === "x") {
        const twoState = spec.id === "onehot-guarded" ? "&& of two bit results is 1'b0 or 1'b1: neither operand can be x" : "a bit result is 2-state: 1'b0 or 1'b1";
        return `That expects x, but ${twoState}. Unknown bits either match the control value ('x, 'z for $isunknown) or they do not count (§20.9).`;
      }
      const bitsWordXz = `x/z bit${xz === 1 ? "" : "s"}`;
      if (spec.id === "onehot-guarded") {
        if (truth === "1") return "That rejects a legal one-hot vector.";
        return report[1].result === "1'b1" ? `That takes $onehot(${name}) alone.` : `That passes a vector $onehot(${name}) already rejects.`;
      }
      if (item?.fn === "$isunknown") return truth === "1" ? `That overlooks the ${bitsWordXz}.` : "That finds an unknown bit where every bit is 0 or 1.";
      // The x/z bits decide the test only if reading some of them as 1 gives the chosen value: the count then runs
      // from ones + 1 to ones + xz. With two 1 bits already, no x/z bit can make $onehot or $onehot0 pass.
      const test = (count: number) => (item?.fn === "$onehot" ? count === 1 : count <= 1);
      const xzDecides = Array.from({ length: xz }, (_, k) => ones + k + 1).some((count) => test(count) === (chosen === "1"));
      if (xzDecides) return `That lets the ${bitsWordXz} decide the test.`;
      if (ones === 0) return `That is what ${item?.fn === "$onehot" ? "$onehot0" : "$onehot"}(${name}) returns.`;
      return "That miscounts the 1 bits.";
    }
    case "conditional": {
      if (right) return `${spec.rule} (${spec.clause})`;
      const c = fromBits(inputs.c);
      const otherwise = spec.id === "cond-z" ? fromBits(Array<Bit4>(a.width).fill("z")) : b;
      const det = conditionalDetail(c, a, otherwise);
      const row = det.rows[det.rows.length - 1];
      if (det.truth !== "x") {
        if (chosen === (det.truth === "1" ? row.otherwise : row.then)) return "That is the other branch's value.";
        // At one bit the x/z-condition result is the Table 11-20 cell (equal known bits compare as 1 and give that bit).
        if (chosen === row.cell) return `That treats the condition as unknown; it is ${det.truth}.`;
        return `Neither branch holds ${chosen}.`;
      }
      if (chosen === "x") return allXAssumption(1);
      if (chosen === "z" && row.otherwise === "z") return "Table 11-20 has no z result, not even for z with z. An if/else would store this.";
      if (chosen === row.then) return "That treats the unknown condition as true.";
      if (chosen === row.otherwise) return "That is what if/else stores.";
      return `Neither branch holds ${chosen}.`;
    }
    default:
      // Why the answer holds shows beside a wrong choice, so the rule is stated by the correct option alone.
      return right ? spec.rule : "Not this one.";
  }
}
