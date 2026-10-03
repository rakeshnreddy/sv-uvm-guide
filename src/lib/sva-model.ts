/**
 * Bounded, deterministic evaluator for a practical subset of SystemVerilog
 * Assertions (IEEE 1800-2023 clause 16) over a single-clock cycle trace.
 *
 * Trace convention (edge-sampled): `signals[name][k]` is the value *sampled*
 * at clock edge k, i.e. its Preponed value (§16.5.1). A waveform draws it as
 * changing just after edge k-1, so a change drawn "at" an edge is first seen
 * by an assertion one edge later.
 *
 * Supported subset:
 * - Boolean expressions over named signals: `!`, `&&`, `||`, `==`, `!=`,
 *   `===`, `!==`, parentheses and constants. X counts as false (§16.6).
 * - Sampled-value functions (§16.9.3): `$rose`, `$fell`, `$stable`,
 *   `$changed`, `$sampled`, `$past(expr[, N])`. Before the first clock tick
 *   they compare against the default sampled value: X for `logic` (§16.5.1).
 * - Sequences (§16.7, §16.9): `##N`, `##[m:n]`, `##[m:$]`, `##[*]`, `##[+]`,
 *   `[*N]`, `[*m:n]`, `[*m:$]`, `[*]`, `[+]`, goto `[->N]`, nonconsecutive
 *   `[=N]`, `and`, `or`, `intersect`, `throughout`, `within`.
 * - Properties: a sequence used as a property (weak in `assert property`,
 *   §16.12.2), `|->` / `|=>` (§16.12.7), `not` (§16.12.3), property
 *   `and` / `or`, and a top-level `disable iff (expr)` (§16.12).
 *
 * Bounded-trace rules: `$` ranges stop at the trace end; an attempt that still
 * has a live thread when the trace ends is PENDING, never FAIL.
 *
 * `disable iff` simplification: the disable condition is checked only at
 * sampling points, using the value shown at that edge. A simulator uses the
 * *current* value (not sampled, §16.12), so a reset that changes between edges,
 * or one driven by a flop at edge k, cancels attempts up to one edge earlier
 * than this synchronous view shows.
 *
 * No React, no randomness: the same inputs always give the same attempts.
 */

export type SvaValue = number | "X";

export interface SvaTrace {
  /** Number of clock ticks (edges) in the trace. */
  length: number;
  /** `signals[name][k]` is the value sampled at edge k (Preponed value, §16.5.1). */
  signals: Record<string, SvaValue[]>;
  /** Default sampled value before edge 0 (§16.5.1). Defaults to X (a `logic` variable). */
  defaults?: Record<string, SvaValue>;
}

export type AttemptStatus = "PASS" | "FAIL" | "VACUOUS" | "PENDING" | "DISABLED";

export const ATTEMPT_STATUSES: AttemptStatus[] = ["PASS", "FAIL", "VACUOUS", "PENDING", "DISABLED"];

export interface SvaStep {
  /** Edge the step happens at. */
  edge: number;
  /** Last edge of a compressed run of waiting steps. */
  toEdge?: number;
  kind: "match" | "fail" | "wait" | "note";
  /** Source text of the sequence element this step belongs to. */
  element: string;
  /** Values or rule behind the step. */
  detail: string;
}

export interface SvaAttempt {
  /** Edge where this evaluation attempt starts (§16.14.5: one attempt per clock tick). */
  start: number;
  status: AttemptStatus;
  /** Edge where the result is decided (for PENDING: the last edge of the trace). */
  end: number;
  /** One-sentence explanation. */
  reason: string;
  /** Chronological match explanation: which edge matched which element. */
  steps: SvaStep[];
}

type Range = { min: number; max: number };
type NodeType = "bool" | "seq" | "prop";
type SampledFn = "$rose" | "$fell" | "$stable" | "$changed" | "$past" | "$sampled";

interface BaseNode {
  id: number;
  pos: number;
  src: string;
  type?: NodeType;
}

export type SvaNode = BaseNode &
  (
    | { kind: "id"; name: string }
    | { kind: "const"; value: SvaValue }
    | { kind: "call"; fn: SampledFn; arg: SvaNode; ticks: number }
    | { kind: "unary"; arg: SvaNode }
    | { kind: "binary"; op: "&&" | "||" | "==" | "!=" | "===" | "!=="; left: SvaNode; right: SvaNode }
    | { kind: "repeat"; op: "*" | "->" | "="; range: Range; arg: SvaNode }
    | { kind: "delay"; left?: SvaNode; range: Range; right: SvaNode }
    | { kind: "and" | "or" | "intersect" | "within"; left: SvaNode; right: SvaNode }
    | { kind: "throughout"; cond: SvaNode; seq: SvaNode }
    | { kind: "not"; arg: SvaNode }
    | { kind: "implication"; overlapping: boolean; antecedent: SvaNode; consequent: SvaNode }
  );

type NodeOf<K extends SvaNode["kind"]> = SvaNode & { kind: K };
type PairNode = NodeOf<"and" | "or" | "intersect" | "within">;

export interface SvaSpec {
  source: string;
  clock: { edge: "posedge" | "negedge"; signal: string; explicit: boolean };
  disable?: SvaNode;
  body: SvaNode;
  /** Shape of the top-level property, used for diagnostics. */
  shape: "sequence" | "implication" | "other";
  overlapping?: boolean;
  /** Signals referenced anywhere in the property. */
  signals: string[];
  usesSampledFunctions: boolean;
}

export interface SvaParseError {
  message: string;
  /** Character offset in the source. */
  position: number;
  length: number;
}

export type SvaParseResult = { ok: true; spec: SvaSpec } | { ok: false; error: SvaParseError };

export interface SvaEvaluation {
  spec: SvaSpec;
  attempts: SvaAttempt[];
  counts: Record<AttemptStatus, number>;
}

/* ------------------------------------------------------------------------ */
/* Tokenizer                                                                 */
/* ------------------------------------------------------------------------ */

type TokKind = "id" | "sys" | "num" | "op" | "kw" | "eof";
interface Tok {
  kind: TokKind;
  text: string;
  pos: number;
  end: number;
  value?: SvaValue;
}

const KEYWORDS = new Set(["and", "or", "not", "intersect", "throughout", "within", "disable", "iff", "posedge", "negedge"]);

const UNSUPPORTED_KEYWORDS: Record<string, string> = {
  first_match: "`first_match` is not supported by this model.",
  until: "`until` is not supported by this model.",
  s_until: "`s_until` is not supported by this model.",
  until_with: "`until_with` is not supported by this model.",
  s_until_with: "`s_until_with` is not supported by this model.",
  implies: "`implies` is not supported by this model.",
  nexttime: "`nexttime` is not supported by this model; use `|=>` or `##1`.",
  s_nexttime: "`s_nexttime` is not supported by this model.",
  always: "`always` is not supported inside a property in this model.",
  s_always: "`s_always` is not supported by this model.",
  eventually: "`eventually` is not supported by this model.",
  s_eventually: "`s_eventually` is not supported by this model; a bounded trace cannot show liveness.",
  strong: "`strong(...)` is not supported by this model; sequences are evaluated as weak, as in `assert property` (§16.12.2).",
  weak: "`weak(...)` is not needed: sequences in `assert property` are already weak (§16.12.2).",
  accept_on: "`accept_on` is not supported by this model.",
  reject_on: "`reject_on` is not supported by this model.",
  sync_accept_on: "`sync_accept_on` is not supported by this model.",
  sync_reject_on: "`sync_reject_on` is not supported by this model.",
  if: "`if`/`else` properties are not supported by this model.",
  else: "`if`/`else` properties are not supported by this model.",
  case: "`case` properties are not supported by this model.",
  property: "Type only the property expression (for example `req |-> ##2 ack`), not a `property ... endproperty` declaration.",
  sequence: "Type only the expression, not a `sequence ... endsequence` declaration.",
  assert: "Type only the property expression; the model wraps it in `assert property (...)` for you.",
  assume: "Type only the property expression; the model evaluates it like `assert property (...)`.",
  cover: "Type only the property expression; the model evaluates it like `assert property (...)`.",
};

const SAMPLED_FUNCTIONS = new Set<SampledFn>(["$rose", "$fell", "$stable", "$changed", "$past", "$sampled"]);

class ParseFailure extends Error {
  constructor(
    message: string,
    public position: number,
    public length = 1,
  ) {
    super(message);
  }
}

function parseNumber(text: string): SvaValue {
  const unsized = /^'([01xXzZ])$/.exec(text);
  if (unsized) return /[xXzZ]/.test(unsized[1]) ? "X" : unsized[1] === "1" ? 1 : 0;
  const based = /^(\d*)'([sS]?)([bBoOdDhH])([0-9a-fA-FxXzZ_?]+)$/.exec(text);
  if (based) {
    const digits = based[4].replace(/_/g, "");
    if (/[xXzZ?]/.test(digits)) return "X";
    const radix = { b: 2, o: 8, d: 10, h: 16 }[based[3].toLowerCase() as "b" | "o" | "d" | "h"];
    return parseInt(digits, radix);
  }
  return parseInt(text.replace(/_/g, ""), 10);
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const push = (kind: TokKind, text: string, pos: number, value?: SvaValue) => toks.push({ kind, text, pos, end: pos + text.length, value });
  while (i < src.length) {
    const rest = src.slice(i);
    const ws = /^\s+/.exec(rest);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    if (rest.startsWith("//")) {
      const nl = rest.indexOf("\n");
      i += nl === -1 ? rest.length : nl;
      continue;
    }
    const sys = /^\$[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (sys) {
      push("sys", sys[0], i);
      i += sys[0].length;
      continue;
    }
    const num = /^(\d*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ_?]+|'[01xXzZ](?![0-9a-zA-Z_])|\d[\d_]*)/.exec(rest);
    if (num) {
      push("num", num[0], i, parseNumber(num[0]));
      i += num[0].length;
      continue;
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (ident) {
      const word = ident[0];
      if (Object.prototype.hasOwnProperty.call(UNSUPPORTED_KEYWORDS, word)) throw new ParseFailure(UNSUPPORTED_KEYWORDS[word], i, word.length);
      push(KEYWORDS.has(word) ? "kw" : "id", word, i);
      i += word.length;
      continue;
    }
    // Operators, longest first.
    const ops = ["|->", "|=>", "===", "!==", "==", "!=", "&&", "||", "##", "[*", "[->", "[=", "[+]", "[", "]", "(", ")", ":", ",", "@", "!", "$", ";"];
    const op = ops.find((candidate) => rest.startsWith(candidate));
    if (op) {
      push("op", op, i);
      i += op.length;
      continue;
    }
    if (/^\|[-=]{2,}>/.test(rest)) {
      const bad = /^\|[-=]{2,}>/.exec(rest)?.[0] ?? "|";
      throw new ParseFailure(`\`${bad}\` is not an SVA operator. Overlapping implication is \`|->\`; non-overlapping implication is \`|=>\`.`, i, bad.length);
    }
    if (rest.startsWith("->")) throw new ParseFailure("`->` is not an implication in a property. Use `|->` (same edge) or `|=>` (next edge).", i, 2);
    if (rest.startsWith("|")) throw new ParseFailure("Bitwise `|` is not supported by this model. Use `||` for a Boolean OR, or `or` to combine sequences.", i, 1);
    if (rest.startsWith("&")) throw new ParseFailure("Bitwise `&` is not supported by this model. Use `&&` for a Boolean AND, or `and` to combine sequences.", i, 1);
    if (rest.startsWith("=")) {
      throw new ParseFailure("`=` assigns a value. Compare with `==`. (Local-variable assignments are not supported by this model.)", i, 1);
    }
    throw new ParseFailure(`Unexpected character \`${rest[0]}\`; this operator is not supported by this model.`, i, 1);
  }
  toks.push({ kind: "eof", text: "", pos: src.length, end: src.length });
  return toks;
}

/* ------------------------------------------------------------------------ */
/* Parser (precedence from Table 16-3: repetition > ## > throughout > within  */
/* > intersect > not > and > or > |-> |=>; Table 11-2 operators bind tighter) */
/* ------------------------------------------------------------------------ */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NodeInit = DistributiveOmit<SvaNode, "id" | "pos" | "src" | "type">;

class Parser {
  private i = 0;
  private lastEnd = 0;
  private nextId = 1;
  readonly referenced = new Set<string>();
  usesSampled = false;

  constructor(
    private readonly src: string,
    private readonly toks: Tok[],
    private readonly known: Set<string> | null,
  ) {}

  private peek(offset = 0): Tok {
    return this.toks[Math.min(this.i + offset, this.toks.length - 1)];
  }

  private next(): Tok {
    const tok = this.peek();
    if (tok.kind !== "eof") this.i += 1;
    this.lastEnd = tok.end;
    return tok;
  }

  private isOp(text: string, offset = 0) {
    const tok = this.peek(offset);
    return tok.kind === "op" && tok.text === text;
  }

  private isKw(text: string) {
    const tok = this.peek();
    return tok.kind === "kw" && tok.text === text;
  }

  private expectOp(text: string, context: string) {
    const tok = this.peek();
    if (tok.kind === "op" && tok.text === text) return this.next();
    throw new ParseFailure(`Expected \`${text}\` ${context}${tok.kind === "eof" ? " but the property ended" : `, found \`${tok.text}\``}.`, tok.pos, Math.max(1, tok.text.length));
  }

  private make(start: number, init: NodeInit): SvaNode {
    return { ...init, id: this.nextId++, pos: start, src: this.src.slice(start, this.lastEnd).trim() } as SvaNode;
  }

  parseSpec(): { clock?: SvaSpec["clock"]; disable?: SvaNode; body: SvaNode } {
    let clock: SvaSpec["clock"] | undefined;
    let disable: SvaNode | undefined;
    if (this.isOp("@")) {
      this.next();
      this.expectOp("(", "after `@`");
      const edge = this.peek();
      if (edge.kind !== "kw" || (edge.text !== "posedge" && edge.text !== "negedge")) {
        throw new ParseFailure("Write the clocking event as `@(posedge clk)` or `@(negedge clk)`.", edge.pos, Math.max(1, edge.text.length));
      }
      this.next();
      const sig = this.peek();
      if (sig.kind !== "id") throw new ParseFailure("Expected a clock signal name after the edge keyword.", sig.pos, Math.max(1, sig.text.length));
      this.next();
      this.expectOp(")", "to close the clocking event");
      clock = { edge: edge.text as "posedge" | "negedge", signal: sig.text, explicit: true };
    }
    if (this.isKw("disable")) {
      const at = this.next();
      if (!this.isKw("iff")) throw new ParseFailure("Expected `iff` after `disable`.", at.pos, 7);
      this.next();
      this.expectOp("(", "after `disable iff`");
      const condStart = this.peek().pos;
      disable = this.parseOr();
      this.expectOp(")", "to close the disable condition");
      if (containsCall(disable)) {
        throw new ParseFailure(
          "A sampled-value function in a disable condition needs an explicit clocking event (§16.12, §16.9.3), which this model does not support. The disable condition uses current values; put `$past`/`$rose` guards in the antecedent instead.",
          condStart,
          Math.max(1, disable.src.length),
        );
      }
    }
    const body = this.parseProperty();
    if (this.isOp(";")) this.next();
    const tok = this.peek();
    if (tok.kind !== "eof") {
      if (tok.kind === "op" && tok.text === "@") {
        throw new ParseFailure("Multiclock properties (a second `@(...)` inside the property) are not supported by this model.", tok.pos, 1);
      }
      if (tok.kind === "kw" && tok.text === "disable") {
        throw new ParseFailure("`disable iff` must come first (after the clocking event) and cannot be nested (§16.12).", tok.pos, 7);
      }
      throw new ParseFailure(`Unexpected \`${tok.text}\` after the end of the property.`, tok.pos, Math.max(1, tok.text.length));
    }
    return { clock, disable, body };
  }

  parseProperty(): SvaNode {
    return this.parseImplication();
  }

  private parseImplication(): SvaNode {
    const start = this.peek().pos;
    const left = this.parsePropOr();
    if (this.isOp("|->") || this.isOp("|=>")) {
      const op = this.next().text;
      const right = this.parseImplication();
      return this.make(start, { kind: "implication", overlapping: op === "|->", antecedent: left, consequent: right });
    }
    return left;
  }

  private parsePropOr(): SvaNode {
    const start = this.peek().pos;
    let left = this.parsePropAnd();
    while (this.isKw("or")) {
      this.next();
      const right = this.parsePropAnd();
      left = this.make(start, { kind: "or", left, right });
    }
    return left;
  }

  private parsePropAnd(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseNot();
    while (this.isKw("and")) {
      this.next();
      const right = this.parseNot();
      left = this.make(start, { kind: "and", left, right });
    }
    return left;
  }

  private parseNot(): SvaNode {
    const start = this.peek().pos;
    if (this.isKw("not")) {
      this.next();
      const arg = this.parseNot();
      return this.make(start, { kind: "not", arg });
    }
    return this.parseIntersect();
  }

  private parseIntersect(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseWithin();
    while (this.isKw("intersect")) {
      this.next();
      const right = this.parseWithin();
      left = this.make(start, { kind: "intersect", left, right });
    }
    return left;
  }

  private parseWithin(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseThroughout();
    while (this.isKw("within")) {
      this.next();
      const right = this.parseThroughout();
      left = this.make(start, { kind: "within", left, right });
    }
    return left;
  }

  private parseThroughout(): SvaNode {
    const start = this.peek().pos;
    const left = this.parseConcat();
    if (this.isKw("throughout")) {
      this.next();
      const right = this.parseThroughout();
      return this.make(start, { kind: "throughout", cond: left, seq: right });
    }
    return left;
  }

  private parseConcat(): SvaNode {
    const start = this.peek().pos;
    let left: SvaNode;
    if (this.isOp("##")) {
      this.next();
      const range = this.parseDelayRange();
      const right = this.parseRepeated();
      left = this.make(start, { kind: "delay", range, right });
    } else {
      left = this.parseRepeated();
    }
    while (this.isOp("##")) {
      this.next();
      const range = this.parseDelayRange();
      const right = this.parseRepeated();
      left = this.make(start, { kind: "delay", left, range, right });
    }
    return left;
  }

  private parseInt(context: string): number {
    const tok = this.peek();
    if (tok.kind !== "num" || typeof tok.value !== "number" || !/^\d[\d_]*$/.test(tok.text)) {
      throw new ParseFailure(`${context} must be a non-negative integer constant in this model.`, tok.pos, Math.max(1, tok.text.length));
    }
    this.next();
    return tok.value;
  }

  private parseRangeBody(context: string, closing: string): Range {
    const minTok = this.peek();
    const min = this.parseInt(context);
    let max = min;
    if (this.isOp(":")) {
      this.next();
      if (this.isOp("$")) {
        this.next();
        max = Infinity;
      } else {
        max = this.parseInt(context);
      }
    }
    if (max < min) throw new ParseFailure(`Range [${min}:${max}] is empty: the lower bound must not exceed the upper bound.`, minTok.pos, 1);
    this.expectOp(closing, `to close the ${context.toLowerCase()}`);
    return { min, max };
  }

  private parseDelayRange(): Range {
    if (this.isOp("[*")) {
      this.next();
      this.expectOp("]", "in `##[*]`");
      return { min: 0, max: Infinity };
    }
    if (this.isOp("[+]")) {
      this.next();
      return { min: 1, max: Infinity };
    }
    if (this.isOp("[")) {
      this.next();
      return this.parseRangeBody("Delay range", "]");
    }
    const tok = this.peek();
    if (tok.kind === "num") return { min: this.parseInt("A `##` delay"), max: tok.value as number };
    throw new ParseFailure("A `##` delay must be a constant (`##2`) or a range (`##[1:3]`, `##[1:$]`) in this model.", tok.pos, Math.max(1, tok.text.length));
  }

  private parseRepeated(): SvaNode {
    const start = this.peek().pos;
    let node = this.parseOr();
    for (;;) {
      if (this.isOp("[*")) {
        this.next();
        if (this.isOp("]")) {
          this.next();
          node = this.make(start, { kind: "repeat", op: "*", range: { min: 0, max: Infinity }, arg: node });
        } else {
          node = this.make(start, { kind: "repeat", op: "*", range: this.parseRangeBody("Repetition count", "]"), arg: node });
        }
      } else if (this.isOp("[+]")) {
        this.next();
        node = this.make(start, { kind: "repeat", op: "*", range: { min: 1, max: Infinity }, arg: node });
      } else if (this.isOp("[->")) {
        this.next();
        node = this.make(start, { kind: "repeat", op: "->", range: this.parseRangeBody("Goto repetition count", "]"), arg: node });
      } else if (this.isOp("[=")) {
        this.next();
        node = this.make(start, { kind: "repeat", op: "=", range: this.parseRangeBody("Nonconsecutive repetition count", "]"), arg: node });
      } else if (this.isOp("[")) {
        const tok = this.peek();
        throw new ParseFailure("Bit-selects are not supported by this model. Repetition is written `[*N]`, `[->N]` or `[=N]`.", tok.pos, 1);
      } else {
        return node;
      }
    }
  }

  parseOr(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseAnd();
    while (this.isOp("||")) {
      this.next();
      const right = this.parseAnd();
      left = this.make(start, { kind: "binary", op: "||", left, right });
    }
    return left;
  }

  private parseAnd(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseEq();
    while (this.isOp("&&")) {
      this.next();
      const right = this.parseEq();
      left = this.make(start, { kind: "binary", op: "&&", left, right });
    }
    return left;
  }

  private parseEq(): SvaNode {
    const start = this.peek().pos;
    let left = this.parseUnary();
    while (this.isOp("==") || this.isOp("!=") || this.isOp("===") || this.isOp("!==")) {
      const op = this.next().text as "==" | "!=" | "===" | "!==";
      const right = this.parseUnary();
      left = this.make(start, { kind: "binary", op, left, right });
    }
    return left;
  }

  private parseUnary(): SvaNode {
    const start = this.peek().pos;
    if (this.isOp("!")) {
      this.next();
      const arg = this.parseUnary();
      return this.make(start, { kind: "unary", arg });
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SvaNode {
    const tok = this.peek();
    const start = tok.pos;
    if (tok.kind === "id") {
      this.next();
      if (this.known && !this.known.has(tok.text)) {
        const list = [...this.known].join(", ");
        throw new ParseFailure(`Unknown signal \`${tok.text}\`. Signals in this trace: ${list}.`, tok.pos, tok.text.length);
      }
      this.referenced.add(tok.text);
      return this.make(start, { kind: "id", name: tok.text });
    }
    if (tok.kind === "num") {
      this.next();
      return this.make(start, { kind: "const", value: tok.value ?? 0 });
    }
    if (tok.kind === "sys") {
      if (!SAMPLED_FUNCTIONS.has(tok.text as SampledFn)) {
        throw new ParseFailure(`\`${tok.text}\` is not supported by this model. Supported: $rose, $fell, $stable, $changed, $past, $sampled.`, tok.pos, tok.text.length);
      }
      this.next();
      this.usesSampled = true;
      this.expectOp("(", `after \`${tok.text}\``);
      const arg = this.parseOr();
      let ticks = 1;
      if (this.isOp(",")) {
        const comma = this.next();
        if (tok.text !== "$past") {
          throw new ParseFailure(`An explicit clocking event for \`${tok.text}\` is not supported by this model; the assertion clock is used.`, comma.pos, 1);
        }
        const tickTok = this.peek();
        ticks = this.parseInt("The number of ticks in `$past`");
        if (ticks < 1) throw new ParseFailure("`$past` number_of_ticks shall be 1 or greater (§16.9.3).", tickTok.pos, tickTok.text.length);
        if (this.isOp(",")) {
          throw new ParseFailure("`$past` with a gating expression or clocking event is not supported by this model.", this.peek().pos, 1);
        }
      }
      this.expectOp(")", `to close \`${tok.text}(...)\``);
      return this.make(start, { kind: "call", fn: tok.text as SampledFn, arg, ticks });
    }
    if (tok.kind === "op" && tok.text === "(") {
      this.next();
      const inner = this.parseProperty();
      this.expectOp(")", "to close the parenthesis");
      // Keep the parenthesised text as the element label.
      return { ...inner, pos: start, src: this.src.slice(start, this.lastEnd).trim() };
    }
    if (tok.kind === "op" && tok.text === "@") {
      throw new ParseFailure("Multiclock properties (a second `@(...)` inside the property) are not supported by this model.", tok.pos, 1);
    }
    if (tok.kind === "kw" && tok.text === "disable") {
      throw new ParseFailure("`disable iff` must come first (after the clocking event) and cannot be nested (§16.12).", tok.pos, 7);
    }
    if (tok.kind === "eof") throw new ParseFailure("The property ended early: expected a signal, constant or `(`.", tok.pos, 1);
    throw new ParseFailure(`Expected a signal, constant, \`$function(...)\` or \`(\`; found \`${tok.text}\`.`, tok.pos, Math.max(1, tok.text.length));
  }
}

function containsCall(node: SvaNode): boolean {
  switch (node.kind) {
    case "call":
      return true;
    case "unary":
    case "not":
      return containsCall(node.arg);
    case "binary":
      return containsCall(node.left) || containsCall(node.right);
    default:
      return false;
  }
}

/* ------------------------------------------------------------------------ */
/* Type checking                                                              */
/* ------------------------------------------------------------------------ */

const isSeqLike = (t: NodeType) => t === "bool" || t === "seq";

function typeCheck(node: SvaNode): NodeType {
  const fail = (message: string): never => {
    throw new ParseFailure(message, node.pos, Math.max(1, node.src.length));
  };
  let type: NodeType;
  switch (node.kind) {
    case "id":
    case "const":
      type = "bool";
      break;
    case "call":
      if (typeCheck(node.arg) !== "bool") fail(`\`${node.fn}\` takes a Boolean expression, not a sequence or property (§16.9.3).`);
      type = "bool";
      break;
    case "unary":
      if (typeCheck(node.arg) !== "bool") fail("`!` negates a Boolean expression. To negate a sequence or property, use `not`.");
      type = "bool";
      break;
    case "binary": {
      const l = typeCheck(node.left);
      const r = typeCheck(node.right);
      if (l !== "bool" || r !== "bool") {
        fail(
          node.op === "&&" || node.op === "||"
            ? `\`${node.op}\` combines Boolean expressions. To combine sequences, use \`${node.op === "&&" ? "and" : "or"}\`.`
            : `\`${node.op}\` compares Boolean expressions, not sequences or properties.`,
        );
      }
      type = "bool";
      break;
    }
    case "repeat": {
      const a = typeCheck(node.arg);
      if (node.op === "*" && !isSeqLike(a)) fail("`[*N]` repeats a sequence; it cannot repeat a property (`|->`, `not`).");
      if (node.op !== "*" && a !== "bool") fail(`\`[${node.op}N]\` repetition applies only to a Boolean expression (§16.9.2).`);
      type = "seq";
      break;
    }
    case "delay": {
      if (node.left && !isSeqLike(typeCheck(node.left))) fail("`##` joins sequences. A property (with `|->`, `|=>` or `not`) cannot appear inside a sequence.");
      if (!isSeqLike(typeCheck(node.right))) fail("`##` joins sequences. A property (with `|->`, `|=>` or `not`) cannot appear inside a sequence.");
      type = "seq";
      break;
    }
    case "throughout": {
      if (typeCheck(node.cond) !== "bool") fail("The left operand of `throughout` must be a Boolean expression (§16.9.9).");
      if (!isSeqLike(typeCheck(node.seq))) fail("The right operand of `throughout` must be a sequence.");
      type = "seq";
      break;
    }
    case "within":
    case "intersect": {
      if (!isSeqLike(typeCheck(node.left)) || !isSeqLike(typeCheck(node.right))) fail(`\`${node.kind}\` combines two sequences.`);
      type = "seq";
      break;
    }
    case "and":
    case "or": {
      const l = typeCheck(node.left);
      const r = typeCheck(node.right);
      type = isSeqLike(l) && isSeqLike(r) ? "seq" : "prop";
      break;
    }
    case "not":
      typeCheck(node.arg);
      type = "prop";
      break;
    case "implication": {
      if (!isSeqLike(typeCheck(node.antecedent))) fail("The antecedent (left of `|->`/`|=>`) must be a sequence, not a property (§16.12.7).");
      if (admitsEmpty(node.antecedent)) fail("An antecedent that can match empty (for example `a[*0:2]`) is not supported by this model.");
      typeCheck(node.consequent);
      type = "prop";
      break;
    }
  }
  node.type = type;
  return type;
}

function admitsEmpty(node: SvaNode): boolean {
  switch (node.kind) {
    case "repeat":
      return node.range.min === 0 || (node.op === "*" && admitsEmpty(node.arg));
    case "delay":
      return node.left ? admitsEmpty(node.left) && admitsEmpty(node.right) && node.range.min <= 1 : node.range.min === 0 && admitsEmpty(node.right);
    case "throughout":
      return admitsEmpty(node.seq);
    case "within":
      return admitsEmpty(node.right) && admitsEmpty(node.left);
    case "intersect":
    case "and":
      return node.type === "seq" && admitsEmpty(node.left) && admitsEmpty(node.right);
    case "or":
      return node.type === "seq" && (admitsEmpty(node.left) || admitsEmpty(node.right));
    default:
      return false;
  }
}

/** Sequences used as properties must not admit an empty match (§16.12.2). */
function checkPropertyPositions(node: SvaNode) {
  if (node.type !== "prop") {
    if (admitsEmpty(node)) {
      throw new ParseFailure(`\`${node.src}\` can match empty; a sequence used as a property shall not admit an empty match (§16.12.2).`, node.pos, Math.max(1, node.src.length));
    }
    return;
  }
  switch (node.kind) {
    case "not":
      checkPropertyPositions(node.arg);
      break;
    case "and":
    case "or":
      checkPropertyPositions(node.left);
      checkPropertyPositions(node.right);
      break;
    case "implication":
      checkPropertyPositions(node.consequent);
      break;
    default:
      break;
  }
}

/**
 * Parse a property. `knownSignals` restricts identifiers to the trace's
 * signals; unknown names, unsupported operators and type errors are reported,
 * never silently treated as false.
 */
export function parseSva(source: string, knownSignals?: string[]): SvaParseResult {
  try {
    if (!source.trim()) throw new ParseFailure("Type a property, for example `req |-> ##2 ack`.", 0, 1);
    const parser = new Parser(source, tokenize(source), knownSignals ? new Set(knownSignals) : null);
    const { clock, disable, body } = parser.parseSpec();
    if (disable && typeCheck(disable) !== "bool") throw new ParseFailure("The disable condition must be a Boolean expression.", disable.pos, disable.src.length);
    typeCheck(body);
    checkPropertyPositions(body);
    const shape: SvaSpec["shape"] = body.type !== "prop" ? "sequence" : body.kind === "implication" ? "implication" : "other";
    return {
      ok: true,
      spec: {
        source,
        clock: clock ?? { edge: "posedge", signal: "clk", explicit: false },
        disable,
        body,
        shape,
        overlapping: body.kind === "implication" ? body.overlapping : undefined,
        signals: [...parser.referenced],
        usesSampledFunctions: parser.usesSampled,
      },
    };
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, error: { message: error.message, position: error.position, length: error.length } };
    throw error;
  }
}

/* ------------------------------------------------------------------------ */
/* Evaluation                                                                 */
/* ------------------------------------------------------------------------ */

interface Dead {
  edge: number;
  reason: string;
  steps: SvaStep[];
}

interface SeqResult {
  /** Match end edge → explanation path. An end of `start - 1` is an empty match. */
  matches: Map<number, SvaStep[]>;
  /** A thread was still alive when the trace ended (more matches possible). */
  open: SvaStep[] | null;
  /** The thread that died latest, with its reason. */
  dead: Dead | null;
}

interface PropOutcome {
  status: Exclude<AttemptStatus, "DISABLED">;
  end: number;
  reason: string;
  steps: SvaStep[];
}

const furthest = (a: Dead | null, b: Dead | null): Dead | null => (!a ? b : !b ? a : b.edge > a.edge ? b : a);
const fmt = (v: SvaValue) => (v === "X" ? "X" : String(v));
const truthy = (v: SvaValue) => v !== "X" && v !== 0;
const lsb = (v: SvaValue): SvaValue => (v === "X" ? "X" : v & 1);
const rangeText = (r: Range) => (r.min === r.max ? `${r.min}` : `${r.min}:${r.max === Infinity ? "$" : r.max}`);
const byEdge = (steps: SvaStep[]) => [...steps].sort((a, b) => a.edge - b.edge);

function pushWait(path: SvaStep[], edge: number, element: string, detail: string) {
  const last = path[path.length - 1];
  if (last && last.kind === "wait" && last.element === element && (last.toEdge ?? last.edge) === edge - 1) {
    path[path.length - 1] = { ...last, toEdge: edge, detail };
  } else {
    path.push({ edge, kind: "wait", element, detail });
  }
}

class Evaluator {
  private readonly memo = new Map<string, SeqResult>();
  readonly T: number;

  constructor(private readonly trace: SvaTrace) {
    this.T = trace.length;
  }

  private sample(name: string, k: number): SvaValue {
    if (k < 0) return this.trace.defaults?.[name] ?? "X";
    const v = this.trace.signals[name]?.[k];
    return v === undefined ? "X" : v;
  }

  /** Value of a Boolean expression at edge k (k < 0 uses default sampled values, §16.5.1). */
  expr(node: SvaNode, k: number): SvaValue {
    switch (node.kind) {
      case "id":
        return this.sample(node.name, k);
      case "const":
        return node.value;
      case "unary": {
        const v = this.expr(node.arg, k);
        return v === "X" ? "X" : v === 0 ? 1 : 0;
      }
      case "binary": {
        const l = this.expr(node.left, k);
        const r = this.expr(node.right, k);
        switch (node.op) {
          case "&&":
            if (l === 0 || r === 0) return 0;
            return l === "X" || r === "X" ? "X" : 1;
          case "||":
            if (truthy(l) || truthy(r)) return 1;
            return l === "X" || r === "X" ? "X" : 0;
          case "==":
            return l === "X" || r === "X" ? "X" : l === r ? 1 : 0;
          case "!=":
            return l === "X" || r === "X" ? "X" : l !== r ? 1 : 0;
          case "===":
            return l === r ? 1 : 0;
          case "!==":
            return l !== r ? 1 : 0;
        }
        return "X";
      }
      case "call": {
        if (node.fn === "$sampled") return this.expr(node.arg, k);
        if (node.fn === "$past") return this.expr(node.arg, k - node.ticks);
        const cur = this.expr(node.arg, k);
        const prev = this.expr(node.arg, k - 1);
        switch (node.fn) {
          // §16.9.3: $rose/$fell look at the LSB; before the first tick the
          // previous value is the default sampled value (X for logic).
          case "$rose":
            return lsb(cur) === 1 && lsb(prev) !== 1 ? 1 : 0;
          case "$fell":
            return lsb(cur) === 0 && lsb(prev) !== 0 ? 1 : 0;
          case "$stable":
            return cur === prev ? 1 : 0;
          case "$changed":
            return cur !== prev ? 1 : 0;
        }
        return "X";
      }
      default:
        return "X";
    }
  }

  /** Human-readable values behind a Boolean expression at edge k. */
  describe(node: SvaNode, k: number): string {
    const parts: string[] = [];
    const walk = (n: SvaNode) => {
      switch (n.kind) {
        case "id":
          parts.push(`${n.name}=${fmt(this.sample(n.name, k))}`);
          break;
        case "call": {
          if (n.fn === "$sampled") {
            walk(n.arg);
            break;
          }
          if (n.fn === "$past") {
            const at = k - n.ticks;
            parts.push(`${n.src}=${fmt(this.expr(n, k))} (${at >= 0 ? `${n.arg.src} at edge ${at}` : `${n.arg.src} before edge 0: default value`})`);
            break;
          }
          const prevLabel = k - 1 >= 0 ? `at edge ${k - 1}` : "before edge 0 (default)";
          parts.push(`${n.arg.src} was ${fmt(this.expr(n.arg, k - 1))} ${prevLabel}, ${fmt(this.expr(n.arg, k))} at edge ${k}`);
          break;
        }
        case "unary":
          walk(n.arg);
          break;
        case "binary":
          walk(n.left);
          walk(n.right);
          break;
        default:
          break;
      }
    };
    walk(node);
    return [...new Set(parts)].join(", ");
  }

  seq(node: SvaNode, t: number): SeqResult {
    const key = `${node.id}@${t}`;
    const cached = this.memo.get(key);
    if (cached) return cached;
    const result = this.computeSeq(node, t);
    this.memo.set(key, result);
    return result;
  }

  private empty(): SeqResult {
    return { matches: new Map(), open: null, dead: null };
  }

  private leaf(node: SvaNode, t: number, element = node.src): SeqResult {
    const res = this.empty();
    if (t >= this.T) {
      res.open = [];
      return res;
    }
    const v = this.expr(node, t);
    const detail = this.describe(node, t);
    if (truthy(v)) {
      res.matches.set(t, [{ edge: t, kind: "match", element, detail }]);
    } else {
      const why = v === "X" ? "X (unknown counts as false, §16.6)" : "false";
      res.dead = {
        edge: t,
        reason: `\`${node.src}\` is ${why} at edge ${t}${detail ? ` (${detail})` : ""}`,
        steps: [{ edge: t, kind: "fail", element, detail: detail || "false" }],
      };
    }
    return res;
  }

  private computeSeq(node: SvaNode, t: number): SeqResult {
    if (node.type === "bool") return this.leaf(node, t);
    switch (node.kind) {
      case "delay":
        return this.delay(node, t);
      case "repeat":
        return node.op === "*" ? this.consecutive(node, t) : node.op === "->" ? this.goto(node, t) : this.nonconsecutive(node, t);
      case "throughout":
        return this.throughout(node, t);
      case "within":
        return this.within(node, t);
      case "intersect":
        return this.intersect(node, t);
      case "and":
        return this.seqAnd(node, t);
      case "or":
        return this.seqOr(node, t);
      default:
        return this.leaf(node, t);
    }
  }

  /** `R1 ##[m:n] R2` and prefix `##[m:n] R` (§16.7; derived forms in F.3.4.2.2). */
  private delay(node: NodeOf<"delay">, t: number): SeqResult {
    const res = this.empty();
    let lefts: [number, SvaStep[]][];
    if (node.left) {
      const rl = this.seq(node.left, t);
      res.open = rl.open;
      res.dead = rl.dead;
      lefts = [...rl.matches.entries()].sort((a, b) => a[0] - b[0]);
    } else {
      lefts = [[t, []]];
    }
    const { min, max } = node.range;
    const delayText = min === max ? `##${min}` : `##[${rangeText(node.range)}]`;
    // Label the right operand's first element with the delay that reached it, e.g. "##2 ack".
    const tag = (steps: SvaStep[]) => {
      const i = steps.findIndex((st) => st.element === node.right.src && st.kind !== "note");
      return i === -1 ? steps : steps.map((st, j) => (j === i ? { ...st, element: `${delayText} ${st.element}` } : st));
    };
    for (const [e, pathL] of lefts) {
      const leftEmpty = Boolean(node.left) && e < t;
      // Prefix `##d R` starts R d ticks after the attempt start; `R1 ##d R2` starts R2 d ticks after R1's end.
      const base = node.left ? e : t;
      let localMatched = false;
      let localOpen = false;
      let localDead: Dead | null = null;
      for (let d = min; d <= max && base + d <= this.T; d += 1) {
        // §16.9.2: an empty match joined with ##0 produces no match.
        if (d === 0 && leftEmpty) continue;
        const s = base + d;
        const rr = this.seq(node.right, s);
        for (const [e2, p2] of rr.matches) {
          if (d === 0 && e2 < s) continue;
          localMatched = true;
          if (!res.matches.has(e2)) res.matches.set(e2, [...pathL, ...tag(p2)]);
        }
        if (rr.open) {
          localOpen = true;
          if (!res.open) res.open = [...pathL, ...tag(rr.open)];
        }
        if (rr.dead) localDead = furthest(localDead, { ...rr.dead, steps: [...pathL, ...tag(rr.dead.steps)] });
      }
      if (base + max > this.T) {
        localOpen = true;
        if (!res.open) res.open = [...pathL];
      }
      if (localDead && !localMatched && !localOpen && max > min && node.right.type === "bool") {
        const from = base + min;
        const to = Math.min(base + max, this.T - 1);
        localDead = {
          edge: to,
          reason: `\`${node.right.src}\` was not true at any edge from ${from} to ${to} (the \`##[${rangeText(node.range)}]\` window closed)`,
          steps: [...pathL, { edge: from, toEdge: to, kind: "fail", element: `${delayText} ${node.right.src}`, detail: `never true in the window edges ${from}–${to}` }],
        };
      }
      res.dead = furthest(res.dead, localDead);
    }
    return res;
  }

  private relabel(steps: SvaStep[], node: SvaNode, k: number, total: string): SvaStep[] {
    return steps.map((s) => (s.kind === "match" || s.kind === "fail" ? { ...s, element: node.src, detail: `repetition ${k} of ${total}: ${s.detail}` } : s));
  }

  /** Consecutive repetition `R[*m:n]` (§16.9.2; F.3.4.2.1). */
  private consecutive(node: NodeOf<"repeat">, t: number): SeqResult {
    const res = this.empty();
    const { min, max } = node.range;
    const total = rangeText(node.range);
    const boolArg = node.arg.type === "bool";
    if (min === 0) res.matches.set(t - 1, []);
    let frontier = new Map<number, SvaStep[]>([[t - 1, []]]);
    const maxK = max === Infinity ? this.T - t + 1 : max;
    for (let k = 1; k <= maxK && frontier.size > 0; k += 1) {
      const next = new Map<number, SvaStep[]>();
      for (const [e, p] of frontier) {
        const s = e + 1;
        const rr = this.seq(node.arg, s);
        const label = (steps: SvaStep[]) =>
          boolArg ? this.relabel(steps, node, k, total) : [{ edge: s, kind: "note" as const, element: node.src, detail: `repetition ${k} of ${total} starts` }, ...steps];
        for (const [e2, p2] of rr.matches) {
          if (e2 < s) continue;
          if (!next.has(e2)) next.set(e2, [...p, ...label(p2)]);
        }
        if (rr.open && !res.open) res.open = [...p, ...label(rr.open)];
        if (rr.dead) {
          res.dead = furthest(res.dead, {
            edge: rr.dead.edge,
            reason: `${rr.dead.reason}; \`${node.src}\` needed repetition ${k} of ${total}`,
            steps: [...p, ...label(rr.dead.steps)],
          });
        }
      }
      if (k >= min) for (const [e2, p2] of next) if (!res.matches.has(e2)) res.matches.set(e2, p2);
      frontier = next;
    }
    return res;
  }

  /** Goto repetition `b[->m:n]` ≡ `(!b[*0:$] ##1 b)[*m:n]` (§16.9.2; F.3.4.2.3). */
  private goto(node: NodeOf<"repeat">, t: number): SeqResult {
    const res = this.empty();
    const { min, max } = node.range;
    if (min === 0) res.matches.set(t - 1, []);
    const path: SvaStep[] = [];
    let count = 0;
    for (let s = t; s < this.T; s += 1) {
      const v = this.expr(node.arg, s);
      const detail = this.describe(node.arg, s);
      if (truthy(v)) {
        count += 1;
        path.push({ edge: s, kind: "match", element: node.src, detail: `occurrence ${count}${max === Infinity ? "" : ` of ${max}`} of ${node.arg.src} (${detail})` });
        if (count >= min && count <= max) res.matches.set(s, [...path]);
        if (count >= max) break;
      } else {
        pushWait(path, s, node.src, `waiting for occurrence ${count + 1} of ${node.arg.src} (${detail})`);
      }
    }
    if (count < max) res.open = [...path];
    return res;
  }

  /** Nonconsecutive repetition `b[=m:n]` ≡ `b[->m:n] ##1 !b[*0:$]` (§16.9.2; F.3.4.2.3). */
  private nonconsecutive(node: NodeOf<"repeat">, t: number): SeqResult {
    const res = this.empty();
    const { min, max } = node.range;
    if (min === 0) res.matches.set(t - 1, []);
    const path: SvaStep[] = [];
    let count = 0;
    let exceeded = false;
    for (let s = t; s < this.T; s += 1) {
      const v = this.expr(node.arg, s);
      const detail = this.describe(node.arg, s);
      if (truthy(v)) {
        count += 1;
        if (count > max) {
          exceeded = true;
          break;
        }
        path.push({ edge: s, kind: "match", element: node.src, detail: `occurrence ${count}${max === Infinity ? "" : ` of ${max}`} of ${node.arg.src} (${detail})` });
      } else {
        pushWait(
          path,
          s,
          node.src,
          count >= min ? `${node.arg.src} stays false after occurrence ${count}; the match may end here (${detail})` : `waiting for occurrence ${count + 1} of ${node.arg.src} (${detail})`,
        );
      }
      if (count >= min && count <= max) res.matches.set(s, [...path]);
    }
    if (!exceeded) res.open = [...path];
    return res;
  }

  /** `e throughout R` ≡ `(e)[*0:$] intersect R` (§16.9.9). */
  private throughout(node: NodeOf<"throughout">, t: number): SeqResult {
    const res = this.empty();
    const rr = this.seq(node.seq, t);
    let f: number | undefined;
    for (let s = t; s < this.T; s += 1) {
      if (!truthy(this.expr(node.cond, s))) {
        f = s;
        break;
      }
    }
    const held = (to: number): SvaStep => ({
      edge: t,
      toEdge: to,
      kind: "note",
      element: `${node.cond.src} throughout`,
      detail: `${node.cond.src} must be true at every edge from ${t} to ${to}`,
    });
    for (const [e, p] of rr.matches) {
      if (f === undefined || e < f) res.matches.set(e, [held(Math.max(t, e)), ...p]);
    }
    if (rr.open && f === undefined) res.open = [held(this.T - 1), ...rr.open];
    if (rr.dead && (f === undefined || rr.dead.edge < f)) res.dead = rr.dead;
    if (f !== undefined) {
      const killedMatch = [...rr.matches.entries()].find(([e]) => e >= f!);
      const killed = killedMatch?.[1] ?? rr.open ?? (rr.dead && rr.dead.edge >= f ? rr.dead.steps : null);
      if (killed) {
        const cut = f;
        res.dead = furthest(res.dead, {
          edge: cut,
          reason: `\`${node.cond.src}\` is false at edge ${cut} (${this.describe(node.cond, cut)}) while \`${node.seq.src}\` was still in progress (throughout, §16.9.9)`,
          steps: [...killed.filter((s) => s.edge < cut), { edge: cut, kind: "fail", element: `${node.cond.src} throughout`, detail: this.describe(node.cond, cut) || "false" }],
        });
      }
    }
    return res;
  }

  /** `s1 within s2` ≡ `(1[*0:$] ##1 s1 ##1 1[*0:$]) intersect s2` (§16.9.10). */
  private within(node: PairNode, t: number): SeqResult {
    const res = this.empty();
    const r2 = this.seq(node.right, t);
    res.open = r2.open;
    res.dead = r2.dead;
    for (const [e2, p2] of [...r2.matches.entries()].sort((a, b) => a[0] - b[0])) {
      let found: SvaStep[] | null = null;
      for (let t1 = t; t1 <= e2 && !found; t1 += 1) {
        for (const [e1, p1] of this.seq(node.left, t1).matches) {
          if (e1 >= t1 && e1 <= e2) {
            found = p1;
            break;
          }
        }
      }
      if (found) {
        if (!res.matches.has(e2)) res.matches.set(e2, byEdge([...p2, ...found]));
      } else {
        res.dead = furthest(res.dead, {
          edge: e2,
          reason: `\`${node.left.src}\` did not occur inside \`${node.right.src}\` (edges ${t}–${e2}), as \`within\` requires (§16.9.10)`,
          steps: [...p2, { edge: t, toEdge: e2, kind: "fail", element: node.left.src, detail: `no match inside edges ${t}–${e2}` }],
        });
      }
    }
    return res;
  }

  /** `s1 intersect s2`: both match with the same length (§16.9.6). */
  private intersect(node: PairNode, t: number): SeqResult {
    const res = this.empty();
    const r1 = this.seq(node.left, t);
    const r2 = this.seq(node.right, t);
    for (const [e, p1] of r1.matches) {
      const p2 = r2.matches.get(e);
      if (p2) res.matches.set(e, byEdge([...p1, ...p2]));
    }
    if (r1.open && r2.open) res.open = r1.open;
    res.dead = furthest(r1.dead, r2.dead);
    if (res.matches.size === 0 && r1.matches.size > 0 && r2.matches.size > 0) {
      const edge = Math.max(...r1.matches.keys(), ...r2.matches.keys());
      res.dead = furthest(res.dead, {
        edge,
        reason: `\`${node.left.src}\` and \`${node.right.src}\` both match, but never ending on the same edge (\`intersect\` needs equal lengths, §16.9.6)`,
        steps: byEdge([...(r1.matches.values().next().value ?? []), ...(r2.matches.values().next().value ?? [])]),
      });
    }
    return res;
  }

  /** Sequence `and`: both match from the same start; the match ends when the later one ends (§16.9.5). */
  private seqAnd(node: PairNode, t: number): SeqResult {
    const res = this.empty();
    const r1 = this.seq(node.left, t);
    const r2 = this.seq(node.right, t);
    for (const [e1, p1] of r1.matches) {
      for (const [e2, p2] of r2.matches) {
        const e = Math.max(e1, e2);
        if (!res.matches.has(e)) res.matches.set(e, byEdge([...p1, ...p2]));
      }
    }
    if (r1.open && (r2.matches.size > 0 || r2.open)) res.open = r1.open;
    else if (r2.open && (r1.matches.size > 0 || r1.open)) res.open = r2.open;
    res.dead = furthest(r1.dead, r2.dead);
    return res;
  }

  /** Sequence `or`: a match of either operand (§16.9.7). */
  private seqOr(node: PairNode, t: number): SeqResult {
    const res = this.empty();
    const r1 = this.seq(node.left, t);
    const r2 = this.seq(node.right, t);
    for (const [e, p] of r1.matches) res.matches.set(e, p);
    for (const [e, p] of r2.matches) if (!res.matches.has(e)) res.matches.set(e, p);
    res.open = r1.open ?? r2.open;
    res.dead = furthest(r1.dead, r2.dead);
    return res;
  }

  /** Evaluate a property for the attempt starting at edge t. */
  prop(node: SvaNode, t: number): PropOutcome {
    if (node.type !== "prop") return this.sequenceProperty(node, t);
    switch (node.kind) {
      case "implication":
        return this.implication(node, t);
      case "not": {
        const o = this.prop(node.arg, t);
        if (o.status === "PENDING") return o;
        if (o.status === "FAIL") return { ...o, status: "PASS", reason: `\`not\` holds because \`${node.arg.src}\` failed: ${o.reason}` };
        if (o.status === "VACUOUS") {
          return { ...o, status: "FAIL", reason: `\`${node.arg.src}\` is vacuously true, so \`not\` of it is false (§16.12.3)` };
        }
        return { ...o, status: "FAIL", reason: `\`${node.arg.src}\` held, so \`not\` of it fails: ${o.reason}` };
      }
      case "and": {
        const a = this.prop(node.left, t);
        const b = this.prop(node.right, t);
        const fails = [a, b].filter((o) => o.status === "FAIL").sort((x, y) => x.end - y.end);
        if (fails.length) return fails[0];
        if (a.status === "PENDING") return a;
        if (b.status === "PENDING") return b;
        const end = Math.max(a.end, b.end);
        const steps = byEdge([...a.steps, ...b.steps]);
        if (a.status === "PASS" || b.status === "PASS") return { status: "PASS", end, reason: "both operands of `and` hold", steps };
        return { status: "VACUOUS", end, reason: "both operands of `and` are vacuously true (§16.14.8 f)", steps };
      }
      case "or": {
        const a = this.prop(node.left, t);
        const b = this.prop(node.right, t);
        const passes = [a, b].filter((o) => o.status === "PASS").sort((x, y) => x.end - y.end);
        if (passes.length) return passes[0];
        if (a.status === "PENDING") return a;
        if (b.status === "PENDING") return b;
        if (a.status === "VACUOUS" || b.status === "VACUOUS") {
          const other = a.status === "VACUOUS" ? b : a;
          return other.status === "FAIL"
            ? { status: "PASS", end: Math.max(a.end, b.end), reason: "one operand of `or` is (vacuously) true and the other was evaluated nonvacuously (§16.14.8 e)", steps: byEdge([...a.steps, ...b.steps]) }
            : { status: "VACUOUS", end: Math.max(a.end, b.end), reason: "both operands of `or` are vacuously true", steps: byEdge([...a.steps, ...b.steps]) };
        }
        return { status: "FAIL", end: Math.max(a.end, b.end), reason: `neither operand of \`or\` holds: ${a.reason}; ${b.reason}`, steps: byEdge([...a.steps, ...b.steps]) };
      }
      default:
        return this.sequenceProperty(node, t);
    }
  }

  /**
   * A sequence used as a property holds iff it has a match; in `assert property`
   * it is weak, so an unfinished attempt at the end of the trace is pending, not
   * failed (§16.12.2). It is never vacuous (§16.14.8 a).
   */
  private sequenceProperty(node: SvaNode, t: number): PropOutcome {
    const r = this.seq(node, t);
    const first = [...r.matches.entries()].filter(([e]) => e >= t).sort((a, b) => a[0] - b[0])[0];
    if (first) {
      return { status: "PASS", end: first[0], reason: `\`${node.src}\` matched from edge ${t} to edge ${first[0]}`, steps: first[1] };
    }
    if (r.open) {
      return {
        status: "PENDING",
        end: this.T - 1,
        reason: `the trace ended at edge ${this.T - 1} while \`${node.src}\` could still match`,
        steps: r.open,
      };
    }
    const dead = r.dead ?? { edge: t, reason: `\`${node.src}\` has no match`, steps: [] };
    return { status: "FAIL", end: dead.edge, reason: dead.reason, steps: dead.steps };
  }

  /** `s |-> p` and `s |=> p` (§16.12.7); vacuity per §16.14.8 h. */
  private implication(node: NodeOf<"implication">, t: number): PropOutcome {
    const op = node.overlapping ? "|->" : "|=>";
    const r = this.seq(node.antecedent, t);
    const ends = [...r.matches.entries()].filter(([e]) => e >= t).sort((a, b) => a[0] - b[0]);
    const outs = ends.map(([e, p]) => {
      const c = node.overlapping ? e : e + 1;
      const note: SvaStep = {
        edge: c,
        kind: "note",
        element: op,
        detail: node.overlapping ? `antecedent matched at edge ${e}; consequent starts at the same edge ${c}` : `antecedent matched at edge ${e}; consequent starts at the next edge ${c}`,
      };
      const out: PropOutcome =
        c >= this.T
          ? { status: "PENDING", end: this.T - 1, reason: `the consequent would start at edge ${c}, after the trace ends`, steps: [] }
          : this.prop(node.consequent, c);
      return { e, p, c, note, out };
    });
    const failed = outs.filter((o) => o.out.status === "FAIL").sort((a, b) => a.out.end - b.out.end)[0];
    if (failed) {
      return {
        status: "FAIL",
        end: failed.out.end,
        reason: `antecedent \`${node.antecedent.src}\` matched at edge ${failed.e}, then the consequent failed: ${failed.out.reason}`,
        steps: [...failed.p, failed.note, ...failed.out.steps],
      };
    }
    const pending = outs.find((o) => o.out.status === "PENDING");
    if (pending) {
      return {
        status: "PENDING",
        end: this.T - 1,
        reason: `antecedent matched at edge ${pending.e}, but ${pending.out.reason}`,
        steps: [...pending.p, pending.note, ...pending.out.steps],
      };
    }
    if (r.open) {
      return { status: "PENDING", end: this.T - 1, reason: `antecedent \`${node.antecedent.src}\` was still in progress when the trace ended`, steps: r.open };
    }
    if (outs.length === 0) {
      const dead = r.dead;
      return {
        status: "VACUOUS",
        end: dead?.edge ?? t,
        reason: `antecedent \`${node.antecedent.src}\` did not match${dead ? ` (${dead.reason})` : ""}, so nothing is checked: a vacuous success (§16.14.8)`,
        steps: dead?.steps ?? [],
      };
    }
    const end = Math.max(...outs.map((o) => o.out.end), r.dead?.edge ?? -1);
    const real = outs.find((o) => o.out.status === "PASS");
    if (real) {
      return {
        status: "PASS",
        end,
        reason: `antecedent \`${node.antecedent.src}\` matched at edge ${real.e} and the consequent held (edge ${real.out.end})`,
        steps: [...real.p, real.note, ...real.out.steps],
      };
    }
    const first = outs[0];
    return {
      status: "VACUOUS",
      end,
      reason: "the antecedent matched, but every consequent was itself vacuously true (§16.14.8 h)",
      steps: [...first.p, first.note, ...first.out.steps],
    };
  }

  attempt(spec: SvaSpec, t: number): SvaAttempt {
    const o = this.prop(spec.body, t);
    if (spec.disable) {
      const last = o.status === "PENDING" ? this.T - 1 : Math.min(o.end, this.T - 1);
      for (let k = t; k <= last; k += 1) {
        if (truthy(this.expr(spec.disable, k))) {
          const detail = this.describe(spec.disable, k);
          return {
            start: t,
            status: "DISABLED",
            end: k,
            reason: `\`disable iff (${spec.disable.src})\` is true at edge ${k}${detail ? ` (${detail})` : ""} while the attempt is in flight, so it is discarded: no pass, no fail (§16.12)`,
            steps: [...o.steps.filter((s) => s.edge < k), { edge: k, kind: "fail", element: `disable iff (${spec.disable.src})`, detail: detail || "true" }],
          };
        }
      }
    }
    return { start: t, ...o };
  }
}

/** Evaluate every attempt (one per clock tick, §16.14.5) of a parsed property on a trace. */
export function evaluateSva(spec: SvaSpec, trace: SvaTrace): SvaEvaluation {
  const evaluator = new Evaluator(trace);
  const attempts = Array.from({ length: trace.length }, (_, t) => evaluator.attempt(spec, t));
  const counts = { PASS: 0, FAIL: 0, VACUOUS: 0, PENDING: 0, DISABLED: 0 } as Record<AttemptStatus, number>;
  for (const a of attempts) counts[a.status] += 1;
  return { spec, attempts, counts };
}

/** Parse and evaluate in one call. */
export function evaluateProperty(source: string, trace: SvaTrace): { ok: true; evaluation: SvaEvaluation } | { ok: false; error: SvaParseError } {
  const parsed = parseSva(source, Object.keys(trace.signals));
  if (!parsed.ok) return parsed;
  return { ok: true, evaluation: evaluateSva(parsed.spec, trace) };
}

/* ------------------------------------------------------------------------ */
/* Learner-facing helpers                                                     */
/* ------------------------------------------------------------------------ */

export const statusGlyph: Record<AttemptStatus, string> = { PASS: "✓", FAIL: "✕", VACUOUS: "○", PENDING: "…", DISABLED: "⊘" };

export const statusText: Record<AttemptStatus, string> = {
  PASS: "pass",
  FAIL: "fail",
  VACUOUS: "vacuous pass",
  PENDING: "pending",
  DISABLED: "disabled",
};

/** SystemVerilog source for the property under test, generated from the parsed spec. */
export function assertionCode(spec: SvaSpec, name = "check"): string[] {
  const clock = `@(${spec.clock.edge} ${spec.clock.signal})`;
  const lines = [
    `property p_${name};`,
    `  ${clock}${spec.disable ? ` disable iff (${spec.disable.src})` : ""}`,
    `    ${spec.body.src};`,
    "endproperty",
    `a_${name}: assert property (p_${name})`,
    `  else $error("p_${name} failed");`,
  ];
  if (spec.body.kind === "implication") {
    lines.push("// vacuity guard: prove the trigger happens");
    lines.push(`c_${name}_trigger: cover property (`);
    lines.push(`  ${clock} ${spec.body.antecedent.src});`);
  }
  return lines;
}

/** One-line log-style summary, like a simulator's assertion report. */
export function summarize(evaluation: SvaEvaluation): string {
  const c = evaluation.counts;
  return `${c.PASS} real pass${c.PASS === 1 ? "" : "es"} · ${c.FAIL} fail${c.FAIL === 1 ? "" : "s"} · ${c.VACUOUS} vacuous · ${c.PENDING} pending · ${c.DISABLED} disabled`;
}

/**
 * Diagnostic feedback for a learner's per-attempt prediction. Wrong answers
 * name the misconception, not just the right answer.
 */
export function diagnoseAttempt(spec: SvaSpec, attempt: SvaAttempt, predicted: AttemptStatus): { correct: boolean; message: string } {
  const actual = attempt.status;
  if (predicted === actual) return { correct: true, message: "Correct." };
  const hints: string[] = [];
  if (spec.body.kind === "implication" && (predicted === "PASS" || predicted === "FAIL") && (actual === "PASS" || actual === "FAIL")) {
    hints.push(
      spec.overlapping
        ? "Check the timing: `|->` starts the consequent on the same edge where the antecedent matched."
        : "Check the timing: `|=>` starts the consequent one edge after the antecedent matched.",
    );
  }
  if (spec.usesSampledFunctions) hints.push("Sampled values: a change drawn just after edge k is first seen at edge k+1, and before edge 0 the previous value is X.");
  const tail = hints.length ? ` ${hints.join(" ")}` : "";
  const say = (message: string) => ({ correct: false, message });

  if (actual === "DISABLED") {
    return say(`The disable condition became true while the attempt was in flight. A disabled attempt is neither a pass nor a fail, and no action block runs (§16.12, §16.14.1).`);
  }
  if (predicted === "DISABLED") {
    return say(
      spec.disable
        ? `The disable condition stays false from edge ${attempt.start} to edge ${attempt.end}, so the attempt runs to completion.`
        : "This property has no `disable iff`, so no attempt can be disabled.",
    );
  }
  if (actual === "PENDING") {
    return say(
      "The trace ends before this attempt can finish. It is neither a pass nor a fail yet; in `assert property` a sequence is weak, so an unfinished attempt does not fail at the end of simulation (§16.12.2).",
    );
  }
  if (predicted === "PENDING") return say(`The trace has enough edges: the result is decided at edge ${attempt.end}.`);
  if (predicted === "VACUOUS" && actual === "FAIL") {
    return say(
      spec.shape === "sequence"
        ? "A property that is just a sequence has no antecedent, so it can never pass vacuously (§16.12.2, §16.14.8 a): a first element that does not match is a real failure. If the check should only start when a trigger is true, make the trigger an antecedent with `|->`."
        : `The antecedent did match, so the consequent was checked, and it failed.${tail}`,
    );
  }
  if (predicted === "VACUOUS" && actual === "PASS") {
    return say(spec.shape === "sequence" ? "A sequence used as a property is never vacuous; here it matched." : "The antecedent matched, so this is a real (nonvacuous) pass.");
  }
  if (actual === "VACUOUS") {
    return say(
      predicted === "PASS"
        ? "This is only a vacuous success: the antecedent did not match, so the consequent was never checked. Tools count it apart from real passes, and a property that is always vacuous checks nothing (§16.14.8)."
        : "Nothing was checked, because the antecedent did not match, so this attempt cannot fail.",
    );
  }
  if (predicted === "PASS" && actual === "FAIL") return say(`It fails at edge ${attempt.end}.${tail}`);
  return say(`It passes; the result is decided at edge ${attempt.end}.${tail}`);
}

function capitalize(text: string) {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

/* ------------------------------------------------------------------------ */
/* Scenarios (data used by the visuals and pinned by the tests)              */
/* ------------------------------------------------------------------------ */

export type BitRow = (0 | 1)[];

export interface SvaScenario {
  id: string;
  label: string;
  property: string;
  /** Signal names in display order. */
  signals: string[];
  rows: Record<string, BitRow>;
  /** What to notice. */
  focus: string;
}

export interface SvaDebugCase extends SvaScenario {
  spec: string;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
  fixedProperty: string;
  fixNote: string;
}

export const SVA_EDGES = 12;

export function scenarioTrace(scenario: Pick<SvaScenario, "rows">): SvaTrace {
  const signals: Record<string, SvaValue[]> = {};
  let length = 0;
  for (const [name, row] of Object.entries(scenario.rows)) {
    signals[name] = [...row];
    length = Math.max(length, row.length);
  }
  return { length, signals };
}

export const svaLearnScenarios: SvaScenario[] = [
  {
    id: "fixed-delay",
    label: "req |-> ##2 ack",
    property: "req |-> ##2 ack",
    signals: ["req", "ack"],
    rows: {
      req: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      ack: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    },
    focus: "Every edge starts an attempt. Edges where req is 0 are vacuous; the attempt at edge 6 fails because ack comes one edge late.",
  },
  {
    id: "window",
    label: "req |-> ##[1:3] ack",
    property: "req |-> ##[1:3] ack",
    signals: ["req", "ack"],
    rows: {
      req: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
      ack: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    },
    focus: "A range keeps the attempt alive until the window closes. The attempt at edge 10 runs off the end of the trace.",
  },
  {
    id: "next-cycle",
    label: "req |=> ack",
    property: "req |=> ack",
    signals: ["req", "ack"],
    rows: {
      req: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      ack: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    },
    focus: "With |=>, ack must be high one edge after req. At edge 2 ack is high on the same edge: too early for |=>.",
  },
  {
    id: "rose-repeat",
    label: "$rose(req) |=> ack[*2]",
    property: "$rose(req) |=> ack[*2]",
    signals: ["req", "ack"],
    rows: {
      req: [1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0],
      ack: [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1],
    },
    focus: "$rose compares the value sampled at this edge with the one at the previous edge. At edge 0 the previous value is X, so a req that starts high counts as a rise.",
  },
  {
    id: "goto-throughout",
    label: "req |=> busy throughout done[->1]",
    property: "req |=> busy throughout done[->1]",
    signals: ["req", "busy", "done"],
    rows: {
      req: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      busy: [0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1],
      done: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    },
    focus: "done[->1] waits any number of edges for done. busy must stay high at every edge until done arrives.",
  },
  {
    id: "disable",
    label: "disable iff (rst) req |-> ##[1:3] ack",
    property: "disable iff (rst) req |-> ##[1:3] ack",
    signals: ["rst", "req", "ack"],
    rows: {
      rst: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      req: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      ack: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    },
    focus: "Reset at edges 5–6 discards the attempt from edge 4 while it is waiting, and every attempt that starts during reset.",
  },
];

export const svaDebugCases: SvaDebugCase[] = [
  {
    id: "bare-sequence",
    label: "Bare sequence",
    spec: "After every req, ack must be high exactly two cycles later.",
    property: "req ##2 ack",
    fixedProperty: "req |-> ##2 ack",
    signals: ["req", "ack"],
    rows: {
      req: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      ack: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    },
    focus: "Every req is acknowledged on time, yet the log is full of failures.",
    question: "Every req in this waveform gets its ack on time. Why does the assertion fail on almost every edge?",
    options: [
      {
        id: "bare",
        label: "The property is a bare sequence: each attempt must see req at its own first edge, and there is no antecedent to make idle edges vacuous.",
        correct: true,
        feedback: "A sequence used as a property must match from every attempt's start (§16.12.2), and it is never vacuous (§16.14.8 a). `req |-> ##2 ack` only checks after req.",
      },
      {
        id: "sampling",
        label: "ack changes at the edge, so the assertion samples the old value.",
        correct: false,
        feedback: "Sampling is fine: ack is sampled high at edges 3 and 8, exactly two edges after req. The failures are on edges where req is 0.",
      },
      {
        id: "window",
        label: "##2 means 'within two cycles', so an ack at exactly +2 is outside the window.",
        correct: false,
        feedback: "##2 is an exact delay of two ticks; `##[1:2]` would be a window. The failing attempts never get past their first element, req.",
      },
      {
        id: "changes",
        label: "Concurrent assertions only start attempts on edges where a signal changes.",
        correct: false,
        feedback: "A new attempt starts at every tick of the assertion clock (§16.14.5), whether or not anything changed. That is exactly why idle edges fail here.",
      },
    ],
    fixNote: "With `|->`, idle edges become vacuous and only the two requests are checked.",
  },
  {
    id: "overlap-vs-next",
    label: "|-> where |=> was meant",
    spec: "ack must be high in the cycle after req.",
    property: "req |-> ack",
    fixedProperty: "req |=> ack",
    signals: ["req", "ack"],
    rows: {
      req: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      ack: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    },
    focus: "The DUT answers one cycle after each request, as specified, and the assertion fails at every request.",
    question: "The DUT meets the spec. What is wrong with the assertion?",
    options: [
      {
        id: "timing",
        label: "`|->` checks ack on the same edge where req matched; the spec needs the next edge, which is `|=>` (or `|-> ##1`).",
        correct: true,
        feedback: "Overlapping implication starts the consequent at the antecedent's end point; non-overlapping starts it one tick later (§16.12.7).",
      },
      {
        id: "rose",
        label: "ack should be written `$rose(ack)`.",
        correct: false,
        feedback: "Edge detection does not change which edge is checked. At edge 2, ack is still 0, so `$rose(ack)` is false there too.",
      },
      {
        id: "dut",
        label: "The DUT is late; the assertion is right.",
        correct: false,
        feedback: "The spec says 'the cycle after req', and ack is sampled high exactly one edge after req. The DUT meets it.",
      },
      {
        id: "prefix",
        label: "Put `##1` in front of req.",
        correct: false,
        feedback: "`##1 req |-> ack` only delays where the antecedent starts. It still checks ack on the edge where req matched.",
      },
    ],
    fixNote: "With `|=>`, each request is checked against ack one edge later.",
  },
  {
    id: "past-reset",
    label: "$past across reset",
    spec: "q is d delayed by one cycle: always_ff @(posedge clk) q <= rst ? 0 : d;",
    property: "disable iff (rst) q == $past(d)",
    fixedProperty: "disable iff (rst) !$past(rst) |-> q == $past(d)",
    signals: ["rst", "d", "q"],
    rows: {
      rst: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      d: [0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0],
      q: [0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0],
    },
    focus: "The flop is correct. One failure appears right after reset is released.",
    question: "Why does the attempt at edge 3, the first edge after reset, fail?",
    options: [
      {
        id: "past",
        label: "At edge 3, $past(d) is d sampled at edge 2, during reset, when the flop was forced to 0. Guard the check with `!$past(rst) |-> ...`.",
        correct: true,
        feedback: "$past looks back one tick regardless of reset. The first cycle after reset compares q against data that the flop was not allowed to capture.",
      },
      {
        id: "disable-past",
        label: "Write `disable iff (rst || $past(rst))`.",
        correct: false,
        feedback: "The disable condition uses current values, and a sampled-value function in it needs an explicit clocking event (§16.12). Put the guard in the antecedent, where sampled values apply.",
      },
      {
        id: "late",
        label: "disable iff is evaluated one cycle late.",
        correct: false,
        feedback: "At edge 3 reset is already 0, so nothing is disabled. The assertion does exactly what it says; the problem is what $past looks at.",
      },
      {
        id: "dut",
        label: "The flop is buggy: it should copy d while in reset.",
        correct: false,
        feedback: "Holding q at 0 during reset is the specified behavior. The check must not compare against data captured while reset was active.",
      },
    ],
    fixNote: "`!$past(rst)` makes the first edge after reset vacuous; every later edge is still checked.",
  },
  {
    id: "dead-antecedent",
    label: "Vacuous pass hides a dead antecedent",
    spec: "After reset (rst_n is active low), every req gets ack on the next cycle.",
    property: "req && !rst_n |=> ack",
    fixedProperty: "req && rst_n |=> ack",
    signals: ["rst_n", "req", "ack"],
    rows: {
      rst_n: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      req: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
      ack: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    },
    focus: "The regression is green: zero failures. Look at how many real passes there are.",
    question: "The assertion never fails, but the second req is never acknowledged. What happened?",
    options: [
      {
        id: "dead",
        label: "`req && !rst_n` can only match during reset, when req is never driven, so every attempt is vacuous and nothing is checked.",
        correct: true,
        feedback: "Zero failures and zero real passes means the check never ran. Fix the polarity, and add `cover property (req && rst_n)` so a dead antecedent shows up as an uncovered item.",
      },
      {
        id: "green",
        label: "Zero failures means the DUT is correct.",
        correct: false,
        feedback: "Vacuous successes are not evidence (§16.14.8). Read the vacuous count, or cover the antecedent, before trusting a green assertion.",
      },
      {
        id: "timing",
        label: "`|=>` should be `|->`.",
        correct: false,
        feedback: "Changing the timing does not help: the antecedent still never matches, so the consequent is never checked.",
      },
      {
        id: "window",
        label: "ack needs a window such as `##[1:$]`.",
        correct: false,
        feedback: "The consequent is never reached, so loosening it changes nothing.",
      },
    ],
    fixNote: "With the polarity fixed, the first request passes and the second fails at edge 8, which is the real DUT bug.",
  },
];

/* ------------------------------------------------------------------------ */
/* Operator families for the temporal-operator comparison                    */
/* ------------------------------------------------------------------------ */

export interface TemporalFamily {
  id: string;
  label: string;
  /** Signal whose first high edge is the attempt the learner predicts. */
  trigger: string;
  signals: string[];
  rows: Record<string, BitRow>;
  operators: { property: string; summary: string }[];
}

export const temporalFamilies: TemporalFamily[] = [
  {
    id: "implication",
    label: "Implication timing",
    trigger: "req",
    signals: ["req", "gnt"],
    rows: {
      req: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
      gnt: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    },
    operators: [
      { property: "req |-> gnt", summary: "gnt on the same edge as req" },
      { property: "req |=> gnt", summary: "gnt on the edge after req" },
      { property: "req |-> ##[1:2] gnt", summary: "gnt one or two edges after req" },
    ],
  },
  {
    id: "repetition",
    label: "Repetition",
    trigger: "start",
    signals: ["start", "ack", "done"],
    rows: {
      start: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      ack: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      done: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    },
    operators: [
      { property: "start |=> ack[*2] ##1 done", summary: "two acks back to back, then done" },
      { property: "start |=> ack[->2] ##1 done", summary: "the second ack, then done on the very next edge" },
      { property: "start |=> ack[=2] ##1 done", summary: "two acks, then done after any quiet gap" },
    ],
  },
  {
    id: "conditions",
    label: "Conditions over time",
    trigger: "req",
    signals: ["req", "busy", "done"],
    rows: {
      req: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      busy: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
      done: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    },
    operators: [
      { property: "req |=> done[->1]", summary: "done eventually (within the trace)" },
      { property: "req |=> busy throughout done[->1]", summary: "busy at every edge until done" },
      { property: "req |=> done[->1] within busy[*4]", summary: "done somewhere inside a four-edge busy window" },
    ],
  },
];

/** Edge of the attempt the learner predicts: the first edge where the trigger is high (or 0). */
export function focusEdge(family: Pick<TemporalFamily, "trigger">, trace: SvaTrace): number {
  const row = trace.signals[family.trigger] ?? [];
  const k = row.findIndex((v) => truthy(v));
  return k === -1 ? 0 : k;
}

/** Short label of an attempt outcome, used as a prediction option. */
export function outcomeLabel(attempt: Pick<SvaAttempt, "status" | "end">): string {
  switch (attempt.status) {
    case "PASS":
      return `PASS, decided at edge ${attempt.end}`;
    case "FAIL":
      return `FAIL at edge ${attempt.end}`;
    case "VACUOUS":
      return "VACUOUS: nothing is checked";
    case "PENDING":
      return "PENDING: the trace ends first";
    case "DISABLED":
      return `DISABLED at edge ${attempt.end}`;
  }
}

/** Split text with `inline code` spans so a view can render them as code. */
export function splitInlineCode(text: string): { code: boolean; text: string }[] {
  return text
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith("`") && part.endsWith("`") && part.length > 1 ? { code: true, text: part.slice(1, -1) } : { code: false, text: part }));
}

/** Plain-text version of a model sentence (backticks removed), for string-only props. */
export function plainText(text: string): string {
  return text.replace(/`([^`]+)`/g, "$1");
}
