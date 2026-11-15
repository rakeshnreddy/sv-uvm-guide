/**
 * Literal decoder model: how an integer literal becomes bits, step by step.
 *
 * Pure and deterministic (no React). The values never come from this file:
 * the literal's own bits come from `parseLiteral` and the stored value from
 * `evaluateAssignment` (src/lib/sv-expression-model.ts). This model only
 * explains the steps between them, and tests/lib/sv-literal-model.test.ts
 * pins every step's bits to those two functions.
 *
 * IEEE 1800-2023 rules explained here:
 * - §5.7.1  simple decimal numbers and based literals: size, the s designator,
 *           base letters, x/z/? digits (4 bits per hex digit, 3 per octal, 1 per
 *           binary), left padding with 0 or with x/z when the leftmost bit is x/z,
 *           truncation from the left, unsized numbers of at least 32 bits (more when
 *           the value needs it: 'h7_0000_0000 has at least 35), unsized x/z-led
 *           literals extending to their containing expression, the fill literals
 *           '0 '1 'x 'z (1 bit when self-determined), underscores, and the illegal
 *           sign between base and digits (8'd-6, in the clause's own Example 3)
 * - §6.11.2 a 4-state value converted to 2-state: x and z bits become 0
 * - §10.7   assignment: the RHS is extended (sign-extended when signed) or its
 *           MSBs are discarded; a tool may, but need not, warn
 * - §11.4.12 unsized constants are illegal in a concatenation
 * - §11.6.1 Table 11-21: an unsized constant number is at least 32 bits
 * - §11.8.1 decimal numbers are signed, based numbers unsigned unless they use s;
 *           the expression type does not depend on the left-hand side
 */

import {
  buildEnv,
  bitsOf,
  evaluateAssignment,
  evaluateExpression,
  expressionIdentifiers,
  formatHexLiteral,
  formatLiteral,
  fromBits,
  parseLiteral,
  resize,
  toBigInt,
  toTwoState,
  typeToSource,
  SvExpressionError,
  type AssignmentEvaluation,
  type Bit4,
  type ParsedLiteral,
  type SvDecl,
  type SvValue,
} from "./sv-expression-model";

// ---------------------------------------------------------------------------
// Targets and presets
// ---------------------------------------------------------------------------

export type LiteralTargetId = "logic16" | "bit16" | "logic40" | "self";

export interface LiteralTarget {
  id: LiteralTargetId;
  /** Control label, sentence case. */
  label: string;
  /** The declaration, or null when the literal is self-determined. */
  decl: SvDecl | null;
}

export const LITERAL_TARGETS: readonly LiteralTarget[] = [
  { id: "logic16", label: "logic [15:0] v", decl: { name: "v", type: "logic", width: 16 } },
  { id: "bit16", label: "bit [15:0] v", decl: { name: "v", type: "bit", width: 16 } },
  { id: "logic40", label: "logic [39:0] v", decl: { name: "v", type: "logic", width: 40 } },
  { id: "self", label: "On its own ($display)", decl: null },
];

export function literalTarget(id: LiteralTargetId): LiteralTarget {
  return LITERAL_TARGETS.find((t) => t.id === id) ?? LITERAL_TARGETS[0];
}

export type LiteralPresetId =
  | "decimal-12"
  | "hex-ff"
  | "signed-hex-ff"
  | "binary-10x1"
  | "binary-x"
  | "hex-3x"
  | "unsized-x"
  | "unsized-x-40"
  | "sized-x"
  | "fill-ones"
  | "decimal-1"
  | "truncated-hex"
  | "wide-unsized"
  | "fill-display";

export interface LiteralPreset {
  id: LiteralPresetId;
  /** Button label: the literal as written (the $display preset names its context). */
  label: string;
  literal: string;
  target: LiteralTargetId;
  /** The lesson passage the preset serves. */
  lesson: "literals" | "expert";
}

/** The rows of the lesson's literal table, plus the expert section's corner cases. */
export const LITERAL_PRESETS: readonly LiteralPreset[] = [
  { id: "decimal-12", label: "12", literal: "12", target: "logic16", lesson: "literals" },
  { id: "hex-ff", label: "8'hFF", literal: "8'hFF", target: "logic16", lesson: "literals" },
  { id: "signed-hex-ff", label: "8'shFF", literal: "8'shFF", target: "logic16", lesson: "literals" },
  { id: "binary-10x1", label: "4'b10x1", literal: "4'b10x1", target: "logic16", lesson: "literals" },
  { id: "binary-x", label: "8'bx", literal: "8'bx", target: "logic16", lesson: "literals" },
  { id: "hex-3x", label: "12'h3x", literal: "12'h3x", target: "logic16", lesson: "literals" },
  { id: "unsized-x", label: "'hx", literal: "'hx", target: "logic16", lesson: "literals" },
  { id: "sized-x", label: "4'bx", literal: "4'bx", target: "logic16", lesson: "literals" },
  { id: "fill-ones", label: "'1", literal: "'1", target: "logic16", lesson: "literals" },
  { id: "decimal-1", label: "1", literal: "1", target: "logic16", lesson: "literals" },
  { id: "truncated-hex", label: "4'hFF", literal: "4'hFF", target: "logic16", lesson: "expert" },
  { id: "unsized-x-40", label: "'hx into 40 bits", literal: "'hx", target: "logic40", lesson: "expert" },
  { id: "wide-unsized", label: "'h7_0000_0000", literal: "'h7_0000_0000", target: "logic40", lesson: "expert" },
  { id: "fill-display", label: "$display('1)", literal: "'1", target: "self", lesson: "expert" },
];

export function literalPreset(id: LiteralPresetId): LiteralPreset {
  return LITERAL_PRESETS.find((p) => p.id === id) ?? LITERAL_PRESETS[0];
}

/** The widest literal or digit string the decoder draws (a drawing limit, not a rule of the standard). */
export const MAX_DECODER_BITS = 64;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type LiteralErrorCode =
  | "empty"
  | "unary-operator"
  | "sign-after-base"
  | "space-in-base"
  | "zero-size"
  | "bad-base"
  | "no-digits"
  | "leading-underscore"
  | "space-in-digits"
  | "illegal-digit"
  | "decimal-xz"
  | "not-a-literal"
  | "unsized-in-concatenation"
  | "concatenation-legal"
  | "real-literal"
  | "too-wide";

export interface LiteralError {
  code: LiteralErrorCode;
  /** True when the standard makes it illegal; false for what this decoder does not draw. */
  illegal: boolean;
  message: string;
  clause: string;
  /** A legal way to write it, when there is one. */
  fix?: string;
}

export interface LiteralFailure {
  ok: false;
  text: string;
  error: LiteralError;
}

// ---------------------------------------------------------------------------
// Tokens and digit groups (§5.7.1)
// ---------------------------------------------------------------------------

export type LiteralForm = "decimal" | "based" | "fill";
export type LiteralBase = "b" | "o" | "d" | "h";

export const BASE_NAMES: Record<LiteralBase, string> = { b: "binary", o: "octal", d: "decimal", h: "hexadecimal" };
/** §5.7.1: an x or z sets 4 bits in hex, 3 in octal, 1 in binary. */
export const BITS_PER_DIGIT: Record<"b" | "o" | "h", number> = { b: 1, o: 3, h: 4 };

export interface LiteralTokens {
  form: LiteralForm;
  /** The size as written, or null when the literal is unsized. */
  size: number | null;
  signedFlag: boolean;
  base: LiteralBase | null;
  /** Digits as written, underscores kept. */
  digits: string;
  /** Digits with the underscores removed. */
  cleanDigits: string;
}

export interface LiteralPart {
  role: "size" | "apostrophe" | "signed" | "base" | "digits";
  text: string;
  note: string;
}

export interface DigitGroup {
  digit: string;
  bits: Bit4[];
}

const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);

function bitLength(n: bigint): number {
  let len = 0;
  let m = n;
  while (m > BIG_ZERO) {
    len += 1;
    m >>= BIG_ONE;
  }
  return len;
}

/** Fewest bits that hold a non-negative number (at least 1). */
function minimalBinary(n: bigint): Bit4[] {
  const len = Math.max(1, bitLength(n));
  const out: Bit4[] = [];
  for (let i = len - 1; i >= 0; i -= 1) out.push(((n >> BigInt(i)) & BIG_ONE) === BIG_ONE ? "1" : "0");
  return out;
}

const unknownOf = (c: string): Bit4 | null => {
  const l = c.toLowerCase();
  if (l === "x") return "x";
  if (l === "z" || l === "?") return "z";
  return null;
};

/**
 * §5.7.1: each digit's bits. Hex digits give 4 bits, octal 3, binary 1; an x
 * sets that many bits to x, a z or ? that many to z. Decimal digits name one
 * number (its fewest bits), or a single x/z/? digit gives one x or z bit.
 */
export function digitGroups(tokens: LiteralTokens): DigitGroup[] {
  const { form, base, cleanDigits } = tokens;
  if (form === "fill") return [{ digit: cleanDigits, bits: [cleanDigits.toLowerCase() as Bit4] }];
  if (form === "decimal" || base === "d") {
    const u = cleanDigits.length === 1 ? unknownOf(cleanDigits) : null;
    if (u) return [{ digit: cleanDigits, bits: [u] }];
    return [{ digit: cleanDigits, bits: minimalBinary(BigInt(cleanDigits)) }];
  }
  const per = BITS_PER_DIGIT[base as "b" | "o" | "h"];
  return Array.from(cleanDigits).map((ch) => {
    const u = unknownOf(ch);
    if (u) return { digit: ch, bits: Array<Bit4>(per).fill(u) };
    const d = parseInt(ch, 16);
    return { digit: ch, bits: d.toString(2).padStart(per, "0").split("") as Bit4[] };
  });
}

// ---------------------------------------------------------------------------
// Lexing a typed literal
// ---------------------------------------------------------------------------

const fail = (text: string, error: LiteralError): LiteralFailure => ({ ok: false, text, error });

const LEGAL_DIGITS: Record<LiteralBase, RegExp> = {
  b: /^[01xXzZ?]$/,
  o: /^[0-7xXzZ?]$/,
  d: /^[0-9xXzZ?]$/,
  h: /^[0-9a-fA-FxXzZ?]$/,
};

/** An unbased unsized literal operand: '0, '1, 'x or 'z (§5.7.1). */
const FILL_OPERAND = /^'([01xXzZ])$/;

/**
 * A sized spelling of an unsized operand: a decimal in its fewest bits, a fill
 * literal as the 1 bit it is when self-determined (§5.7.1), and an unsized based
 * literal at the width this model gives it (32, or the bits its digits spell).
 * Null when there is none.
 */
function sizedOperand(unsized: string): string | null {
  if (/^\d[\d_]*$/.test(unsized)) {
    const bits = minimalBinary(BigInt(unsized.replace(/_/g, "")));
    return `${bits.length}'b${bits.join("")}`;
  }
  const f = FILL_OPERAND.exec(unsized);
  if (f) return `1'b${f[1].toLowerCase()}`;
  const lex = lexLiteral(unsized);
  if (!lex.ok || lex.tokens.form !== "based" || lex.tokens.size !== null) return null;
  try {
    const width = positiveDecimalWidth(lex.tokens) ?? parseLiteral(unsized).value.width;
    return canonical(lex.tokens, { size: width });
  } catch {
    return null;
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** An unsized literal: a simple decimal number, an unsized based literal, or a fill literal (§5.7.1). */
const UNSIZED_LITERAL = String.raw`(?:\d[\d_]*|'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ?_]+|'[01xXzZ])`;

/** A concatenation operand that is an unsized literal behind a unary plus or minus and/or parentheses. */
interface WrappedUnsized {
  /** Where the operand starts in the source. */
  index: number;
  text: string;
  open: string;
  sign: string;
  literal: string;
  close: string;
}

/**
 * Operands such as -1, +'hF or (1): the expression model sizes these like any
 * expression, but the number inside them is still unsized. §5.7.1 says a simple
 * decimal number may start with a plus or minus unary operator, while the
 * formal syntax (Syntax 5-2) parses -1 as a unary operator applied to the
 * number 1, so tools may differ on these operands.
 */
function wrappedUnsizedOperands(src: string): WrappedUnsized[] {
  const re = new RegExp(String.raw`(?<=[{,]\s*)((?:\(\s*)*)([+-]\s*)?(${UNSIZED_LITERAL})((?:\s*\))*)(?=\s*[,}])`, "g");
  const out: WrappedUnsized[] = [];
  for (const m of Array.from(src.matchAll(re))) {
    const [text, open, sign = "", literal, close] = m;
    const opens = (open.match(/\(/g) ?? []).length;
    const closes = (close.match(/\)/g) ?? []).length;
    // Plain unsized operands are the expression model's case; this one needs a sign or balanced parentheses.
    if ((sign === "" && opens === 0) || opens !== closes) continue;
    out.push({ index: m.index ?? 0, text, open, sign: sign.trim(), literal, close });
  }
  return out;
}

/** §11.4.12: check a concatenation for unsized constants. Identifiers are declared logic [7:0]; their width does not change legality. */
export function checkConcatenation(src: string): LiteralFailure {
  let ids: Set<string>;
  try {
    ids = expressionIdentifiers(src);
  } catch {
    ids = new Set<string>();
  }
  const decls: SvDecl[] = Array.from(ids).map((name) => ({ name, type: "logic", width: 8 }));
  const env = buildEnv(decls);
  const result = evaluateExpression(src, env);
  const wrapped = wrappedUnsizedOperands(src);
  if (result.ok && wrapped.length === 0) {
    return fail(src, {
      code: "concatenation-legal",
      illegal: false,
      message: `${src} is a legal ${result.width}-bit concatenation (with each name read as an 8-bit logic). This decoder takes one literal at a time.`,
      clause: "§11.4.12",
    });
  }
  if (result.ok || result.error.code === "unsized-in-concatenation") {
    const unsizedOf = (message: string) => /`([^`]+)`/.exec(message)?.[1];
    // Size every unsized operand in turn, the wrapped ones (-1, (1)) first, and
    // offer the result only when the expression model then accepts the whole
    // concatenation and no wrapped unsized operand is left.
    let fix: string | undefined;
    // Replace each wrapped operand where it was matched, last first so the
    // earlier indexes still hold (a string search could hit the -1 inside b-1).
    let candidate: string | null = src;
    for (const w of [...wrapped].sort((p, q) => q.index - p.index)) {
      const sized = sizedOperand(w.literal);
      if (!sized || candidate === null) {
        candidate = null;
        break;
      }
      candidate = `${candidate.slice(0, w.index)}${w.open}${w.sign}${sized}${w.close}${candidate.slice(w.index + w.text.length)}`;
    }
    for (let i = 0; i < 16 && candidate !== null; i += 1) {
      const again = evaluateExpression(candidate, env);
      if (again.ok) {
        if (wrappedUnsizedOperands(candidate).length === 0) fix = candidate;
        break;
      }
      const current = again.error.code === "unsized-in-concatenation" ? unsizedOf(again.error.message) : undefined;
      const sized = current ? sizedOperand(current) : null;
      if (!current || !sized) break;
      candidate = candidate.replace(new RegExp(`(?<![\\w'])${escapeRegExp(current)}(?![\\w'])`, "g"), sized);
    }
    if (result.ok) {
      const w = wrapped[0];
      const signedDecimal = w.sign !== "" && w.open === "" && /^\d/.test(w.literal);
      const wrapping = [w.sign ? `a unary ${w.sign}` : "", w.open ? "parentheses" : ""].filter(Boolean).join(" and ");
      const message = signedDecimal
        ? `${w.text.trim()} is an unsized number: §5.7.1 lets a simple decimal number start with a plus or minus unary operator, and unsized constant numbers shall not be allowed in concatenations (§11.4.12). The formal syntax reads ${w.text.trim()} as a unary ${w.sign} applied to ${w.literal}, so tools may differ on whether they accept it.${fix ? ` Give it a size: ${fix} is legal.` : ""}`
        : `${w.text.trim()} applies ${wrapping} to the unsized ${w.literal}. Unsized constant numbers shall not be allowed in concatenations (§11.4.12), because each operand's size is needed; whether that covers ${w.text.trim()} is not settled by the text, so tools differ on whether they accept it.${fix ? ` ${fix} is legal in every tool.` : ""}`;
      return fail(src, {
        code: "unsized-in-concatenation",
        // Only a signed simple decimal number is named an unsized number by §5.7.1's own text.
        illegal: signedDecimal,
        message,
        clause: "§11.4.12, §5.7.1",
        ...(fix ? { fix } : {}),
      });
    }
    const first = unsizedOf(result.error.message);
    const lead = result.error.message.replace(/\s*Write e\.g\. [^\s]+\.$/, "");
    const fillOperand = first !== undefined && FILL_OPERAND.test(first);
    const message = fillOperand
      ? `${lead} Whether §11.4.12's "unsized constant numbers" includes ${first} is not settled: §5.7.1 makes ${first} 1 bit wide in a self-determined context, and concatenation operands are self-determined, so tools differ on whether they accept it.${fix ? ` ${fix} is legal in every tool.` : ""}`
      : `${lead}${fix ? ` Give it a size: ${fix} is legal.` : ""}`;
    return fail(src, {
      code: "unsized-in-concatenation",
      // A fill literal operand is a case the standard does not clearly settle.
      illegal: !fillOperand,
      message,
      clause: fillOperand ? "§11.4.12, §5.7.1" : result.error.clause,
      ...(fix ? { fix } : {}),
    });
  }
  return fail(src, { code: "not-a-literal", illegal: true, message: result.error.message, clause: result.error.clause });
}

/**
 * §5.7.2, Syntax 5-2: real_number ::= fixed_point_number
 *   | unsigned_number [ . unsigned_number ] exp [ sign ] unsigned_number.
 */
const REAL_NUMBER = /^(?:\d[\d_]*(?:\.\d[\d_]*)?[eE][+-]?\d[\d_]*|\d[\d_]*\.\d[\d_]*)$/;

export type LexResult = { ok: true; text: string; tokens: LiteralTokens } | LiteralFailure;

/** Split a typed literal into its tokens, or say which rule of §5.7.1 it breaks. */
export function lexLiteral(raw: string): LexResult {
  const text = raw.trim();
  if (text === "") return fail(text, { code: "empty", illegal: false, message: "Type a literal such as 8'hFF, 12 or '1.", clause: "§5.7.1" });
  if (text.startsWith("{")) return checkConcatenation(text);
  if (/^[+-]/.test(text)) {
    if (text.slice(1).trim() === "") {
      return fail(text, { code: "not-a-literal", illegal: true, message: `${text} on its own is a unary operator with nothing to apply to. Type a literal such as 8'hFF, 12 or '1.`, clause: "§5.7.1" });
    }
    const operand = text.slice(1).trim();
    return fail(text, {
      code: "unary-operator",
      illegal: false,
      message: `A plus or minus before the ${REAL_NUMBER.test(operand) ? "number" : "size"} is a unary operator, not part of the literal (§5.7.1): ${text} applies ${text[0]} to ${text.slice(1).trim()}. This decoder shows the literal itself; decode ${text.slice(1).trim()}.`,
      clause: "§5.7.1",
    });
  }
  const fillMatch = /^'([01xXzZ])$/.exec(text);
  if (fillMatch) {
    return { ok: true, text, tokens: { form: "fill", size: null, signedFlag: false, base: null, digits: fillMatch[1], cleanDigits: fillMatch[1] } };
  }
  if (/^\d[\d_]*$/.test(text)) {
    const clean = text.replace(/_/g, "");
    if (bitLength(BigInt(clean)) + 1 > MAX_DECODER_BITS) return tooWide(text);
    return { ok: true, text, tokens: { form: "decimal", size: null, signedFlag: false, base: null, digits: text, cleanDigits: clean } };
  }
  // Checked before the hex test, because 23E10 and 39e8 are also hex digits.
  if (REAL_NUMBER.test(text)) {
    return fail(text, {
      code: "real-literal",
      illegal: false,
      message: `${text} is a real literal (§5.7.2), a double-precision floating-point number. This decoder shows integer literals.`,
      clause: "§5.7.2",
    });
  }
  if (/^(?:\d[\d_]*)?\.(?:\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?$/.test(text) && /\d/.test(text)) {
    // §5.7.2 lists .12, 9., 4.E3 and .2e-7 as invalid real numbers.
    return fail(text, {
      code: "not-a-literal",
      illegal: true,
      message: `${text} is not a literal: a real number written with a decimal point needs at least one digit on each side of the point (§5.7.2).`,
      clause: "§5.7.2",
    });
  }
  const m = /^(\d[\d_]*)?\s*'([\s\S]*)$/.exec(text);
  if (!m) {
    // Digits then letters reads as a hex literal missing its 'h only when every
    // character is legal in hex (§5.7.1); 'h12g would be illegal too.
    const hexy = /^\d[\d_]*[a-zA-Z?]/.test(text) && /^[0-9a-fA-F_xXzZ?]+$/.test(text);
    return fail(text, {
      code: "not-a-literal",
      illegal: true,
      message: hexy
        ? `${text} is not a literal: hex digits need a base, an apostrophe and h (§5.7.1 lists 4af as illegal for this reason).`
        : `${text} is not an integer literal. A literal is a simple decimal number such as 12, a based literal such as 8'hFF, or one of '0 '1 'x 'z (§5.7.1).`,
      clause: "§5.7.1",
      ...(hexy ? { fix: `'h${text}` } : {}),
    });
  }
  const sizeText = m[1];
  let rest = m[2];
  const ws1 = /^\s*/.exec(rest)?.[0] ?? "";
  rest = rest.slice(ws1.length);
  let signedFlag = false;
  let ws2 = "";
  if (/^[sS]/.test(rest)) {
    signedFlag = true;
    rest = rest.slice(1);
    ws2 = /^\s*/.exec(rest)?.[0] ?? "";
    rest = rest.slice(ws2.length);
  }
  const baseChar = rest.charAt(0);
  if (sizeText === undefined && !signedFlag && ws1 && /^[01xXzZ]$/.test(rest)) {
    // Syntax 5-2, footnote 53: the apostrophe in an unbased unsized literal shall not be followed by white space.
    return fail(text, {
      code: "space-in-base",
      illegal: true,
      message: `The apostrophe in an unbased unsized literal shall not be followed by white space (§5.7, Syntax 5-2, footnote 53).`,
      clause: "§5.7 (Syntax 5-2)",
      fix: `'${rest}`,
    });
  }
  if (!/^[bBoOdDhH]$/.test(baseChar)) {
    return fail(text, {
      code: "bad-base",
      illegal: true,
      message: baseChar
        ? `"${baseChar}" is not a base letter. After the apostrophe comes b, o, d or h (in either case), optionally after s (§5.7.1).`
        : "The apostrophe must be followed by a base letter b, o, d or h (optionally after s), or be one of '0 '1 'x 'z (§5.7.1).",
      clause: "§5.7.1",
    });
  }
  if (ws1 || ws2) {
    const fixed = `${sizeText ?? ""}'${signedFlag ? "s" : ""}${rest}`;
    return fail(text, {
      code: "space-in-base",
      illegal: true,
      message: "The apostrophe and the base letter shall not be separated by any white space (§5.7.1).",
      clause: "§5.7.1",
      fix: fixed,
    });
  }
  const base = baseChar.toLowerCase() as LiteralBase;
  const digits = rest.slice(1).replace(/^\s+/, "");
  if (sizeText !== undefined && Number(sizeText.replace(/_/g, "")) === 0) {
    return fail(text, { code: "zero-size", illegal: true, message: "The size shall be a nonzero unsigned decimal number (§5.7.1).", clause: "§5.7.1" });
  }
  if (/^[+-]/.test(digits)) {
    const after = digits.slice(1).trim();
    return fail(text, {
      code: "sign-after-base",
      illegal: true,
      message: `A plus or minus between the base and the digits is illegal syntax (§5.7.1, which lists 8 'd -6 among its examples). For a negative value, put the minus in front: ${digits[0]}${sizeText ?? ""}'${signedFlag ? "s" : ""}${base}${after} applies a unary ${digits[0]} to the literal.`,
      clause: "§5.7.1",
      fix: `${digits[0]}${sizeText ?? ""}'${signedFlag ? "s" : ""}${base}${after}`,
    });
  }
  if (digits === "") return fail(text, { code: "no-digits", illegal: true, message: `The base letter ${baseChar} must be followed by digits (§5.7.1).`, clause: "§5.7.1" });
  if (/\s/.test(digits)) {
    return fail(text, {
      code: "space-in-digits",
      illegal: true,
      message: "The digits form one token (§5.7.1), so a space inside them splits the literal. Use _ to group digits.",
      clause: "§5.7.1",
      fix: `${sizeText ?? ""}'${signedFlag ? "s" : ""}${base}${digits.replace(/\s+/g, "_")}`,
    });
  }
  if (digits.startsWith("_")) {
    return fail(text, { code: "leading-underscore", illegal: true, message: "An underscore is legal anywhere in a number except as the first character (§5.7.1).", clause: "§5.7.1", fix: `${sizeText ?? ""}'${signedFlag ? "s" : ""}${base}${digits.replace(/^_+/, "")}` });
  }
  const cleanDigits = digits.replace(/_/g, "");
  const bad = Array.from(cleanDigits).find((c) => !LEGAL_DIGITS[base].test(c));
  if (bad !== undefined) {
    return fail(text, { code: "illegal-digit", illegal: true, message: `"${bad}" is not a legal ${BASE_NAMES[base]} digit (§5.7.1).`, clause: "§5.7.1" });
  }
  if (base === "d" && cleanDigits.length > 1 && /[xXzZ?]/.test(cleanDigits)) {
    return fail(text, {
      code: "decimal-xz",
      illegal: true,
      message: "A decimal literal may use x, z or ? only as its one and only digit, which makes every bit x or z (§5.7.1).",
      clause: "§5.7.1",
    });
  }
  const size = sizeText === undefined ? null : Number(sizeText.replace(/_/g, ""));
  const tokens: LiteralTokens = { form: "based", size, signedFlag, base, digits, cleanDigits };
  const digitBitCount = digitGroups(tokens).reduce((n, g) => n + g.bits.length, 0);
  // An unsized signed 'sd literal may need one more bit, its 0 sign bit (see positiveDecimalWidth).
  const extraSignBit = size === null && signedFlag && base === "d" ? 1 : 0;
  if ((size ?? 0) > MAX_DECODER_BITS || digitBitCount + extraSignBit > MAX_DECODER_BITS) return tooWide(text);
  return { ok: true, text, tokens };
}

function tooWide(text: string): LiteralFailure {
  return fail(text, { code: "too-wide", illegal: false, message: `This decoder draws literals of up to ${MAX_DECODER_BITS} bits. ${text} is legal, but wider than that.`, clause: "§5.7.1" });
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

export type LiteralStepId = "tokens" | "groups" | "size" | "sign" | "target" | "two-state";

export interface LiteralStep {
  id: LiteralStepId;
  title: string;
  clause: string;
  text: string;
  /** The bits after this step (most significant first), or null for the tokens step. */
  bits: Bit4[] | null;
  /** The bits drawn for this step, with the markers below in their numbering. */
  shown: Bit4[] | null;
  extendedFrom?: number;
  droppedFrom?: number;
  signBit?: number;
  changed?: number[];
  segments?: { hi: number; lo: number; label: string }[];
  /** Part of the explanation of the answer (the correct option's feedback). */
  key: boolean;
}

export type TargetMode = "fill" | "pad" | "sign" | "zero" | "truncate" | "same" | "self";

export interface LiteralDecode {
  ok: true;
  text: string;
  target: LiteralTarget;
  tokens: LiteralTokens;
  parts: LiteralPart[];
  groups: DigitGroup[];
  /** The digits' bits before padding or truncation. */
  digitBits: Bit4[];
  parsed: ParsedLiteral;
  /** Least width the standard allows for an unsized number (§5.7.1), or null when sized or a fill literal. */
  minWidth: number | null;
  /**
   * A signed hex, octal or binary unsized literal whose digits fill 32 bits or more
   * with a top bit of 1: whether that bit is a sign bit depends on the width a tool
   * gives it, which §5.7.1 does not settle. The result is the model's reading. (With
   * an x or z top bit the literal pads with x or z at any width, so it is not flagged.)
   */
  signAmbiguous: boolean;
  mode: TargetMode;
  steps: LiteralStep[];
  /** The assignment, from evaluateAssignment (null when self-determined). */
  assignment: AssignmentEvaluation | null;
  /** For a 2-state target: the value before x/z became 0 (the same assignment into a logic). */
  beforeTwoState: SvValue | null;
  final: SvValue;
  summary: string;
  /** Model limits and tool choices to show beside the result. */
  notes: string[];
}

export type LiteralResult = LiteralDecode | LiteralFailure;

/** Readable bits: binary up to 8 bits, hex when every nibble allows, otherwise binary. */
export function bitsText(bits: readonly Bit4[]): string {
  const v = fromBits([...bits], false);
  return bits.length > 8 ? formatHexLiteral(v) : formatLiteral(v);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isXz = (b: Bit4) => b === "x" || b === "z";

/** The canonical spelling of a based literal's tokens (no white space). */
function canonical(t: LiteralTokens, over: Partial<LiteralTokens> = {}): string {
  const k = { ...t, ...over };
  return `${k.size ?? ""}'${k.signedFlag ? "s" : ""}${k.base}${k.cleanDigits}`;
}

/** The base letter as the learner typed it (§5.7.1 allows either case). */
function typedBase(text: string, t: LiteralTokens): string {
  return /'[sS]?([bBoOdDhH])/.exec(text)?.[1] ?? (t.base as string);
}

function partsOf(t: LiteralTokens, underscores: boolean, base: string): LiteralPart[] {
  if (t.form === "fill") {
    return [
      { role: "apostrophe", text: "'", note: "apostrophe, no base letter" },
      { role: "digits", text: t.cleanDigits, note: `one ${t.cleanDigits.toLowerCase()}: the value of every bit` },
    ];
  }
  if (t.form === "decimal") return [{ role: "digits", text: t.digits, note: "a simple decimal number: no size, no base" }];
  return [
    { role: "size", text: t.size === null ? "none" : String(t.size), note: t.size === null ? "no size: at least 32 bits" : `exactly ${plural(t.size, "bit")}` },
    { role: "apostrophe", text: "'", note: "apostrophe" },
    { role: "signed", text: t.signedFlag ? "s" : "none", note: t.signedFlag ? "s: signed" : "no s: unsigned" },
    { role: "base", text: base, note: BASE_NAMES[t.base as LiteralBase] },
    { role: "digits", text: t.digits, note: underscores ? "digits; the underscores are ignored" : "digits" },
  ];
}

function reading(v: SvValue): string {
  const bits = bitsOf(v);
  if (bits.some(isXz)) return " It has x or z bits, so it has no single number value.";
  const asSigned = toBigInt(v, true) as bigint;
  const asUnsigned = toBigInt(v, false) as bigint;
  if (v.signed && bits[0] === "1") return ` ${bitsText(bits)} reads as ${asSigned}; read unsigned, the same bits would be ${asUnsigned}.`;
  if (!v.signed && bits[0] === "1" && v.width > 1) return ` ${bitsText(bits)} reads as ${asUnsigned}, not ${asSigned}.`;
  return ` ${bitsText(bits)} reads as ${v.signed ? asSigned : asUnsigned}.`;
}

/**
 * §5.7.1: an unsized signed decimal-base literal ('sd...) whose value needs more
 * than 32 bits with its sign bit: that least width (its value's bits plus a 0
 * sign bit), or null when parseLiteral's own width already holds the value.
 */
export function positiveDecimalWidth(tokens: LiteralTokens): number | null {
  if (tokens.form !== "based" || tokens.base !== "d" || tokens.size !== null || !tokens.signedFlag) return null;
  if (!/^\d+$/.test(tokens.cleanDigits)) return null;
  const valueBits = bitLength(BigInt(tokens.cleanDigits)) + 1;
  return valueBits > 32 ? valueBits : null;
}

/** Decode a literal into a target, explaining each step; the values come from parseLiteral and evaluateAssignment. */
export function decodeLiteral(raw: string, targetId: LiteralTargetId): LiteralResult {
  const lex = lexLiteral(raw);
  if (!lex.ok) return lex;
  const { text, tokens } = lex;
  // §5.7.1: decimal digits name a positive number, so an unsized 'sd literal that
  // needs more than 32 bits has at least its value's bits plus a 0 sign bit.
  // parseLiteral gives it only the digits' bits, so the model reads it as the
  // sized literal of that least width, which has the same value at any width above.
  const posWidth = positiveDecimalWidth(tokens);
  const evalText = posWidth ? `${posWidth}'sd${tokens.cleanDigits}` : text;
  let parsed: ParsedLiteral;
  try {
    parsed = parseLiteral(evalText);
  } catch (e) {
    if (e instanceof SvExpressionError) return fail(text, { code: "not-a-literal", illegal: true, message: e.message, clause: e.clause });
    throw e;
  }
  const target = literalTarget(targetId);
  const groups = digitGroups(tokens);
  const digitBits = groups.flatMap((g) => g.bits);
  const litBits = bitsOf(parsed.value);
  const W = parsed.value.width;
  const L = digitBits.length;
  const leftXz = isXz(digitBits[0]) ? digitBits[0] : null;
  const padBit: Bit4 = leftXz ?? "0";
  const steps: LiteralStep[] = [];
  const notes: string[] = [];

  // 1. Tokens (§5.7.1).
  const underscores = tokens.digits.includes("_");
  let tokensText: string;
  if (tokens.form === "fill") tokensText = `${text} is an unbased unsized literal: an apostrophe and a single ${tokens.cleanDigits}, with no size and no base letter (§5.7.1).`;
  else if (tokens.form === "decimal") tokensText = `${text} is a simple decimal number: no size and no base letter, so it is unsized (§5.7.1).${underscores ? " The underscores are ignored." : ""}`;
  else {
    tokensText =
      `${text}: ${tokens.size === null ? "no size" : `size ${tokens.size}`}, ${tokens.signedFlag ? "s (signed)" : "no s"}, base ${typedBase(text, tokens)} (${BASE_NAMES[tokens.base as LiteralBase]}), digits ${tokens.cleanDigits}` +
      `${underscores ? "; the underscores are ignored" : ""} (§5.7.1).`;
  }
  steps.push({ id: "tokens", title: "Read the parts", clause: "§5.7.1", text: tokensText, bits: null, shown: null, key: false });

  // 2. Digits to bits (§5.7.1).
  let groupsText: string;
  let segments: LiteralStep["segments"];
  if (tokens.form === "fill") groupsText = `On its own the literal is one ${tokens.cleanDigits.toLowerCase()} bit.`;
  else if (tokens.form === "decimal" || tokens.base === "d") {
    const u = groups[0].bits.length === 1 && isXz(groups[0].bits[0]) && unknownOf(tokens.cleanDigits) ? groups[0].bits[0] : null;
    groupsText = u
      ? `A decimal literal may use x, z or ? only as its single digit, and then every bit of the literal is ${u} (§5.7.1). This model draws it as one ${u} bit first; the next step fills every other bit with ${u}.`
      : `Decimal digits name one number, not groups of bits: ${tokens.cleanDigits} is ${digitBits.join("")} in binary, ${plural(L, "bit")}.`;
  } else {
    const per = BITS_PER_DIGIT[tokens.base as "b" | "o" | "h"];
    const name = BASE_NAMES[tokens.base as LiteralBase];
    const hasX = groups.some((g) => unknownOf(g.digit) === "x");
    const hasZ = groups.some((g) => unknownOf(g.digit) === "z");
    const hasQ = groups.some((g) => g.digit === "?");
    const unknownNotes = [
      hasX ? `an x sets ${plural(per, "bit")} to x` : null,
      hasZ ? `a z${hasQ ? " or ?" : ""} sets ${plural(per, "bit")} to z${hasQ ? " (? is another way to write z)" : ""}` : null,
    ].filter(Boolean);
    groupsText =
      per === 1
        ? `Each binary digit is one bit: ${digitBits.join("")}.`
        : `Each ${name} digit becomes ${per} bits: ${groups.map((g) => `${g.digit} → ${g.bits.join("")}`).join(", ")}.`;
    if (unknownNotes.length) groupsText += ` In ${name}, ${unknownNotes.join(", and ")} (§5.7.1).`;
    if (per > 1) {
      let hi = L - 1;
      segments = groups.map((g) => {
        const seg = { hi, lo: hi - g.bits.length + 1, label: g.digit };
        hi -= g.bits.length;
        return seg;
      });
    }
  }
  steps.push({ id: "groups", title: "Digits to bits", clause: "§5.7.1", text: groupsText, bits: digitBits, shown: digitBits, segments, key: false });

  // 3. Pad or truncate to the literal's own size (§5.7.1).
  let minWidth: number | null = null;
  let ambiguous = false;
  /** Ambiguous and the top digit bit is 1: only then can the width change the result. */
  let hedged = false;
  let sizeText: string;
  const sizeStep: LiteralStep = { id: "size", title: "Fit to the size", clause: "§5.7.1", text: "", bits: litBits, shown: litBits, key: false };
  const padPhrase = leftXz ? `${leftXz}, because the leftmost bit of the digits is ${leftXz}` : "0, because the leftmost bit of the digits is known";
  if (tokens.form === "fill") {
    sizeText = `An unbased unsized literal has no size of its own: in a context, every bit takes the value ${tokens.cleanDigits.toLowerCase()}; on its own it is 1 bit (§5.7.1).`;
    sizeStep.key = true;
  } else if (tokens.size !== null) {
    const N = tokens.size;
    if (L < N) {
      sizeText = `The digits give ${plural(L, "bit")} and the size is ${N}, so the literal is padded on the left with ${padPhrase} (§5.7.1).`;
      sizeStep.extendedFrom = L;
      sizeStep.key = leftXz !== null;
    } else if (L > N) {
      sizeText = `The digits give ${L} bits but the size is ${N}, so they are truncated from the left: the leftmost ${plural(L - N, "bit")} ${L - N === 1 ? "is" : "are"} cut off, leaving ${bitsText(litBits)} (§5.7.1). The cut is legal; §5.7.1 does not require a warning, though a tool may give one.`;
      sizeStep.shown = digitBits;
      sizeStep.droppedFrom = N;
      sizeStep.key = true;
    } else {
      sizeText = `The digits give exactly ${plural(N, "bit")}, the size.`;
    }
  } else {
    // Unsized: at least 32 bits, more when the value needs it (a sign bit too when signed).
    const signed = parsed.value.signed;
    const firstNonZero = digitBits.findIndex((b) => b !== "0");
    const significant = firstNonZero < 0 ? 1 : L - firstNonZero;
    // A signed hex, octal or binary literal whose digits fill 32 bits or more with a
    // top bit that is not 0: how many bits "represent the value" depends on whether
    // the digits are read as negative, which §5.7.1 does not settle (see the note
    // below). Decimal digits name a positive number, so 'sd is never in doubt.
    ambiguous = tokens.form === "based" && signed && tokens.base !== "d" && L >= 32 && digitBits[0] !== "0";
    // With an x or z top bit the literal pads with x or z at any width, so the doubt cannot change the bits.
    hedged = ambiguous && digitBits[0] === "1";
    const valueBits = significant + (signed && !ambiguous ? 1 : 0);
    minWidth = ambiguous ? W : Math.max(32, valueBits);
    // x and z digits have no single number value, so it is the digits that need the bits.
    const needer = digitBits.some(isXz) ? "its digits need" : "its value needs";
    sizeText = `No size, so the literal has at least 32 bits (§5.7.1)`;
    if (ambiguous) {
      sizeText += W > 32 ? `; its digits need more, and this model uses ${W}, the bits they spell` : `; its digits spell exactly 32, and this model uses those 32`;
      if (hedged) sizeText += `. Its top bit is ${digitBits[0]}, and whether that is a sign bit depends on the width a tool gives it, which §5.7.1 leaves open (see the note)`;
    } else if (valueBits > 32) sizeText += `; ${needer} more, so it has at least ${minWidth} bits${signed ? ", sign bit included" : ""}`;
    if (!ambiguous && W !== minWidth) sizeText += `. This model uses ${W}, the bits its digits spell`;
    if (posWidth) sizeText += `. Decimal digits name a positive number, so the sign bit is 0, and this model uses those ${posWidth} bits`;
    sizeText += W > L ? `. It is padded on the left with ${padPhrase}.` : ". No padding is needed.";
    if (parsed.pad) {
      // §5.7.1 states the extension rule for unsized unsigned literals; a signed one gets the same bits by sign extension.
      sizeText += parsed.value.signed
        ? ` Its leftmost bit, ${parsed.pad}, is also its sign bit, so when it is assigned to a wider variable, sign extension copies ${parsed.pad} into every added bit (§10.7).`
        : ` Because it is unsized and unsigned and its leftmost bit is ${parsed.pad}, it also extends with ${parsed.pad} to the size of any wider expression that contains it (§5.7.1).`;
      sizeStep.key = true;
    }
    if (W > L) sizeStep.extendedFrom = L;
  }
  sizeStep.text = sizeText;
  steps.push(sizeStep);

  // 4. Signedness (§5.7.1, §11.8.1).
  let signText: string;
  if (tokens.form === "fill") signText = "It is unsigned: §5.7.1 calls it an unsized unsigned single-bit value.";
  else if (tokens.form === "decimal") signText = `A simple decimal number is signed (§5.7.1, §11.8.1).${reading(parsed.value)}`;
  else if (tokens.signedFlag) signText = `The s makes it signed. The s does not change the bits, only how they are read (§5.7.1).${reading(parsed.value)}`;
  else signText = `Without s a based literal is unsigned (§5.7.1, §11.8.1).${reading(parsed.value)}`;
  if (hedged && !litBits.some(isXz) && litBits[0] === "1") {
    signText += ` That is this model's reading at ${plural(W, "bit")}: a tool that gives it more bits would read the same digits as ${toBigInt(parsed.value, false)} (see the note).`;
  }
  steps.push({
    id: "sign",
    title: "Signed or unsigned",
    clause: "§5.7.1, §11.8.1",
    text: signText,
    bits: litBits,
    shown: litBits,
    ...(parsed.value.signed ? { signBit: W - 1 } : {}),
    key: target.decl === null || (parsed.value.signed && litBits[0] !== "0") || (!parsed.value.signed && tokens.form === "based" && litBits[0] === "1"),
  });

  // 5. Into the target (§10.7, §5.7.1), then 2-state storage (§6.11.2).
  let assignment: AssignmentEvaluation | null = null;
  let beforeTwoState: SvValue | null = null;
  let final: SvValue;
  let mode: TargetMode;
  if (!target.decl) {
    mode = "self";
    final = parsed.value;
    let t = `Self-determined, as a $display argument is (the example in §11.6.3 prints its arguments at their own size), nothing widens or narrows it: `;
    t += tokens.form === "fill" ? `${text} is 1 bit wide (§5.7.1).` : `it stays ${plural(W, "bit")}.`;
    if (tokens.form !== "fill" && tokens.size === null) {
      t += ` §5.7.1 gives this unsized number at least ${minWidth} bits, not an exact width; this model uses ${W}.`;
      notes.push(`An unsized literal on its own: the standard sets a least width (${minWidth} bits here), not an exact one, so the printed width can differ between tools. This model uses ${W}.`);
    }
    steps.push({ id: "target", title: "On its own", clause: tokens.form === "fill" ? "§5.7.1" : "§5.7.1, §11.6.3", text: t, bits: litBits, shown: litBits, key: true });
  } else {
    const decl = target.decl;
    const name = decl.name;
    const tw = decl.width ?? 1;
    const ev = evaluateAssignment([decl], decl, evalText);
    if (!ev.ok) return fail(text, { code: "not-a-literal", illegal: true, message: ev.error.message, clause: ev.error.clause });
    assignment = ev;
    final = ev.final;
    const twoState = decl.type === "bit";
    let pre: SvValue = ev.final;
    if (twoState) {
      const asLogic: SvDecl = { ...decl, type: "logic" };
      const lv = evaluateAssignment([asLogic], asLogic, evalText);
      if (lv.ok) pre = lv.final;
    }
    const preBits = bitsOf(pre);
    const ctxBits = bitsOf(ev.rhsValue);
    const step: LiteralStep = { id: "target", title: `Into ${typeToSource(decl)} ${name}`, clause: "§10.7", text: "", bits: preBits, shown: preBits, key: true };
    if ((parsed.fill || parsed.pad) && tw > W) {
      mode = parsed.fill ? "fill" : "pad";
      const d = (parsed.fill ?? parsed.pad) as Bit4;
      step.clause = parsed.pad && parsed.value.signed ? "§10.7" : "§5.7.1";
      step.text = parsed.fill
        ? `Assigned to the ${tw}-bit ${name}, every bit takes the value ${d} (§5.7.1).`
        : parsed.value.signed
          ? `It is signed and its sign bit is ${d}, so sign extension fills the ${plural(tw - W, "added bit")} of the ${tw}-bit ${name} with ${d}, not with 0 (§10.7).`
          : `It is unsized and unsigned and its leftmost bit is ${d}, so it extends with ${d} to the ${tw}-bit ${name}, not with 0 (§5.7.1)${tw > 32 ? `, even past 32 bits: the clause's own example fills an 85-bit variable with 'hx` : ""}.`;
      step.extendedFrom = W;
    } else if (tw > W) {
      const signed = parsed.value.signed;
      mode = signed ? "sign" : "zero";
      step.extendedFrom = W;
      if (signed) {
        step.text = `The literal is signed, so it is sign-extended: copies of its sign bit (${litBits[0]}) fill bits ${tw - 1} to ${W} (§10.7).`;
        if (hedged) step.text += ` That follows this model's ${W}-bit reading; a tool that gives the literal more bits would have a 0 sign bit and fill with 0 (see the note).`;
        if (!(decl.signed ?? false)) {
          step.text += ` ${name} being unsigned does not change this: an expression's type depends only on its operands, not on the left-hand side (§11.8.1)${decl.type === "logic" && tokens.size !== null ? ", and §5.7.1 says sized signed literals are sign-extended when assigned to a logic, signed or not" : ""}.`;
          step.clause = "§10.7, §11.8.1";
        }
      } else {
        step.text = `The literal is unsigned, so it is zero-extended to ${tw} bits (§10.7, §6.11.2).`;
        if (tokens.size !== null && litBits.some(isXz)) step.text += ` Only its own ${plural(W, "bit")} can be x or z; the ${tw - W} new bits are 0.`;
      }
    } else if (ctxBits.length > tw) {
      mode = "truncate";
      const discarded = ctxBits.slice(0, ctxBits.length - tw);
      step.shown = ctxBits;
      step.droppedFrom = tw;
      step.text = `${name} has ${tw} bits, so the assignment keeps the low ${tw} and discards the top ${discarded.length} (§10.7)${discarded.some((b) => b !== "0") ? (discarded.every((b) => b === discarded[0]) ? `; the discarded bits are all ${discarded[0]}` : "; not all the discarded bits are 0") : ""}. §10.7 lets a tool warn about this but does not require it.${tokens.form !== "fill" && tokens.size === null ? ` The count follows this model's ${W}-bit reading of the unsized literal; §5.7.1 sets only a least width (${minWidth} bits), so a tool that gives it more bits discards more.` : ""}`;
    } else {
      mode = "same";
      step.text = `${name} has the same ${plural(tw, "bit")}, so the value is stored as it is (§10.7).`;
    }
    steps.push(step);
    if (twoState && preBits.some(isXz)) {
      beforeTwoState = pre;
      const finalBits = bitsOf(final);
      const changed = preBits.map((b, p) => (isXz(b) ? tw - 1 - p : -1)).filter((i) => i >= 0);
      steps.push({
        id: "two-state",
        title: "2-state storage",
        clause: "§6.11.2",
        text: `bit is a 2-state type, so each x or z bit becomes 0 when the 4-state value is converted (§6.11.2): ${plural(changed.length, "bit")} change.`,
        bits: finalBits,
        shown: finalBits,
        changed,
        key: true,
      });
    }
  }

  if (hedged) {
    notes.push(`Whether the top digit bit of ${text} is a sign bit depends on the width a tool gives it; §5.7.1 sets only a least width, so treat this result as the model's reading.`);
  }
  if (posWidth) {
    notes.push(`${text} is decoded as ${evalText}: §5.7.1 gives an unsized signed number that needs more than 32 bits at least the bits its value needs plus a sign bit, and decimal digits name a positive number, so the value is the same at any width a tool picks from ${posWidth} up.`);
  }

  const finalBits = bitsOf(final);
  const known = !finalBits.some(isXz);
  const summary = target.decl
    ? `After ${target.decl.name} = ${text};, ${target.decl.name} holds ${bitsText(finalBits)}${known ? `, which is ${toBigInt(final, target.decl.signed ?? false)}` : ""}.`
    : `On its own, ${text} is ${plural(final.width, "bit")}: ${bitsText(finalBits)}.`;

  return { ok: true, text, target, tokens, parts: partsOf(tokens, underscores, typedBase(text, tokens)), groups, digitBits, parsed, minWidth, signAmbiguous: hedged, mode, steps, assignment, beforeTwoState, final, summary, notes };
}

/** The code the decoder shows for a decode, one line each. */
export function literalCode(text: string, targetId: LiteralTargetId): string[] {
  const t = literalTarget(targetId);
  if (!t.decl) return [`$display("%b", ${text});`];
  return [`${typeToSource(t.decl)} ${t.decl.name};`, `${t.decl.name} = ${text};`];
}

// ---------------------------------------------------------------------------
// Predict the stored bit strip
// ---------------------------------------------------------------------------

export type MisconceptionId =
  | "two-state-keeps-x"
  | "every-bit"
  | "fill-one-bit"
  | "fill-32-bits"
  | "fill-is-int-1"
  | "target-sign"
  | "based-signed"
  | "size-ignored"
  | "pad-zero"
  | "one-x-bit"
  | "unsized-32"
  | "x-digit-one-bit"
  | "x-spreads"
  | "decimal-as-hex"
  | "keep-left"
  | "lands-high";

export interface LiteralOption {
  id: "correct" | MisconceptionId;
  bits: Bit4[];
  label: string;
  correct: boolean;
  feedback: string;
}

/** Priority order: the misconceptions the lesson names first, generic ones last. */
const MISCONCEPTION_ORDER: readonly MisconceptionId[] = [
  "two-state-keeps-x",
  "every-bit",
  "fill-one-bit",
  "fill-32-bits",
  "fill-is-int-1",
  "target-sign",
  "based-signed",
  "size-ignored",
  "pad-zero",
  "one-x-bit",
  "unsized-32",
  "x-digit-one-bit",
  "x-spreads",
  "decimal-as-hex",
  "keep-left",
  "lands-high",
];

/** Deterministic order so the correct strip is not always first. */
function arrange<T extends { id: string }>(options: T[], seed: string): T[] {
  const out = [...options];
  let h = 2166136261;
  const key = `${out.map((o) => o.id).join("|")}#${seed}`;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sameBits = (a: readonly Bit4[], b: readonly Bit4[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The strip options: the true stored bits and up to three strips that a named
 * misconception would predict, each computed by applying that wrong rule, with
 * feedback that names the rule the standard actually sets.
 */
export function literalPredictionOptions(d: LiteralDecode): LiteralOption[] {
  const { text, tokens, parsed, target, digitBits, mode } = d;
  const decl = target.decl;
  const tw = decl ? (decl.width ?? 1) : 0;
  const name = decl?.name ?? "";
  const twoState = decl?.type === "bit";
  const W = parsed.value.width;
  const litBits = bitsOf(parsed.value);
  const L = digitBits.length;
  const leftXz = isXz(digitBits[0]) ? digitBits[0] : null;
  const finalBits = bitsOf(d.final);
  const fillDigit = parsed.fill ?? null;

  /** A value placed into the target with the given extension, then stored (2-state when the target is bit). */
  const place = (v: SvValue, signExtend: boolean): Bit4[] => {
    if (!decl) return bitsOf(v);
    const r = resize(v, tw, signExtend, false);
    return bitsOf(twoState ? toTwoState(r) : r);
  };
  const store = (bits: Bit4[]): Bit4[] => (twoState ? bitsOf(toTwoState(fromBits(bits))) : bits);
  /** Another literal, through the same decoder: its stored bits. */
  const through = (alt: string): Bit4[] | null => {
    const r = decodeLiteral(alt, target.id);
    return r.ok ? bitsOf(r.final) : null;
  };
  const extensionPhrase = (): string => {
    switch (mode) {
      case "sign":
        return `it is sign-extended to ${tw} bits (§10.7)`;
      case "zero":
        return `it is zero-extended to ${tw} bits (§10.7, §6.11.2)`;
      case "truncate":
        return `${name} keeps its low ${tw} bits (§10.7)`;
      default:
        return `it is stored as it is`;
    }
  };

  const make: Record<MisconceptionId, () => { bits: Bit4[]; feedback: string } | null> = {
    "two-state-keeps-x": () => {
      if (!twoState || !d.beforeTwoState) return null;
      return { bits: bitsOf(d.beforeTwoState), feedback: "bit is a 2-state type: it cannot hold x or z, so each x or z bit becomes 0 when the 4-state value is converted (§6.11.2)." };
    },
    "every-bit": () => {
      if (!decl || tokens.form === "fill" || tokens.cleanDigits.length !== 1 || !/^[01xXzZ?]$/.test(tokens.cleanDigits)) return null;
      const b = (unknownOf(tokens.cleanDigits) ?? tokens.cleanDigits) as Bit4;
      return {
        bits: store(Array<Bit4>(tw).fill(b)),
        feedback: `Only the unbased unsized literals '0, '1, 'x and 'z fill every bit of their context, and unsized unsigned literals led by x or z extend that x or z to the width of their context (§5.7.1). ${text} has its own ${plural(W, "bit")}${tokens.size === null ? " (at least 32, because it is unsized)" : ""}, so ${extensionPhrase()}.`,
      };
    },
    "fill-one-bit": () => {
      if (!decl || !fillDigit || tw <= 1) return null;
      return { bits: place(parsed.value, false), feedback: `${text} has no size of its own: every bit of its context takes the value ${fillDigit}, here all ${tw} bits (§5.7.1). It is 1 bit only where nothing around it sets a width.` };
    },
    "fill-32-bits": () => {
      if (decl || !fillDigit) return null;
      return { bits: Array<Bit4>(32).fill(fillDigit), feedback: `In a self-determined context, such as a $display argument, ${text} is 1 bit wide (§5.7.1). It is not 32 bits like an unsized number.` };
    },
    "fill-is-int-1": () => {
      if (decl || fillDigit !== "1") return null;
      return { bits: bitsOf(parseLiteral("32'd1").value), feedback: "'1 is not the number 1: on its own it is a single 1 bit, and in a wider context every bit would be 1 (§5.7.1)." };
    },
    "target-sign": () => {
      if (!decl || mode !== "sign" || (decl.signed ?? false)) return null;
      return {
        bits: place(parsed.value, false),
        feedback: `The literal's own type picks the extension, not ${name}'s: an expression's type depends only on its operands (§11.8.1), and a signed right-hand side is sign-extended (§10.7).${decl.type === "logic" && tokens.size !== null ? " §5.7.1 says the same of a sized signed literal assigned to a logic." : ""}`,
      };
    },
    "based-signed": () => {
      if (tokens.form !== "based" || tokens.signedFlag) return null;
      const alt = canonical(tokens, { signedFlag: true });
      const bits = through(alt);
      if (!bits) return null;
      return { bits, feedback: `Without s a based literal is unsigned (§5.7.1, §11.8.1), so its top bit is not copied into new bits. This strip is what ${alt} would give.` };
    },
    "size-ignored": () => {
      if (tokens.size === null || L <= tokens.size) return null;
      const bits = through(canonical(tokens, { size: null }));
      if (!bits) return null;
      return { bits, feedback: `The size is exact (§5.7.1): ${text} holds only ${plural(tokens.size, "bit")}, so its digits are truncated from the left to ${bitsText(litBits)} before the value goes anywhere.` };
    },
    "pad-zero": () => {
      if (!leftXz || tokens.form === "fill" || (W <= L && !parsed.pad)) return null;
      const zeroPadded = fromBits([...Array<Bit4>(Math.max(0, W - L)).fill("0"), ...digitBits.slice(Math.max(0, L - W))]);
      const feedback =
        tokens.size !== null
          ? `When the leftmost bit of the digits is ${leftXz}, the padding is ${leftXz}, not 0 (§5.7.1): ${text} pads its ${plural(L, "digit bit")} with ${leftXz} to ${tokens.size} bits.`
          : `${text} is unsized and its leftmost bit is ${leftXz}, so it is padded with ${leftXz}, not 0, and §5.7.1 extends it with ${leftXz} to the size of the expression around it${decl ? `, here ${tw} bits` : ""}.`;
      return { bits: place(zeroPadded, false), feedback };
    },
    "one-x-bit": () => {
      if (!parsed.pad) return null;
      return {
        bits: place(fromBits([...Array<Bit4>(W - 1).fill("0"), parsed.pad]), false),
        feedback: `${text} is not one ${parsed.pad} bit with zeros above it: it is unsized and led by ${parsed.pad}, so it extends with ${parsed.pad} to ${decl ? `all ${tw} bits of ${name}` : "its full width"} (§5.7.1).`,
      };
    },
    "unsized-32": () => {
      if (tokens.form === "fill" || tokens.size !== null) return null;
      if (parsed.pad) {
        if (!decl || tw <= 32) return null;
        return { bits: place(fromBits(Array<Bit4>(32).fill(parsed.pad)), false), feedback: `An unsized literal led by ${parsed.pad} extends with ${parsed.pad} to the size of its context, even past 32 bits: the example in §5.7.1 fills an 85-bit variable with 'hx.` };
      }
      if (W <= 32 || (decl && tw <= 32)) return null;
      const low32 = fromBits(litBits.slice(W - 32), parsed.value.signed);
      return {
        bits: place(low32, parsed.value.signed),
        feedback: `An unsized number has at least 32 bits, and one whose value needs more has at least the width it needs (§5.7.1): ${text} has at least ${d.minWidth} bits, so nothing is cut at 32.`,
      };
    },
    "x-digit-one-bit": () => {
      if (tokens.form !== "based" || (tokens.base !== "h" && tokens.base !== "o")) return null;
      const unk = Array.from(tokens.cleanDigits).find((c) => unknownOf(c));
      if (!unk) return null;
      const per = BITS_PER_DIGIT[tokens.base];
      const binDigits = digitGroups(tokens)
        .map((g) => (unknownOf(g.digit) ? g.digit.toLowerCase() : g.bits.join("")))
        .join("");
      const bits = through(canonical(tokens, { base: "b", cleanDigits: binDigits, digits: binDigits }));
      if (!bits) return null;
      return { bits, feedback: `${unk === "?" ? "A ?" : unk.toLowerCase() === "x" ? "An x" : "A z"} digit sets ${per} bits in ${BASE_NAMES[tokens.base]}, not 1 (§5.7.1).` };
    },
    "x-spreads": () => {
      if (!finalBits.some(isXz) || finalBits.every(isXz)) return null;
      const u: Bit4 = finalBits.includes("x") ? "x" : "z";
      const lead = `${u === "x" ? "An x" : "A z"} does not spread to the other bits: `;
      const reachesTarget = Boolean(parsed.pad) && decl !== null && tw > W;
      const xzPadded = leftXz !== null && (W > L || reachesTarget);
      // §10.7, §6.11.2: sign extension copies the literal's sign bit, so an x or z sign bit makes every added bit x or z.
      const xzSignCopied = decl !== null && mode === "sign" && isXz(litBits[0]);
      const added =
        decl && mode === "zero"
          ? ` and the ${plural(tw - W, "bit")} the assignment adds are 0 (§10.7)`
          : decl && mode === "sign"
            ? ` and the ${plural(tw - W, "bit")} the assignment adds copy its sign bit, ${litBits[0]} (§10.7)`
            : "";
      if (!xzPadded && !xzSignCopied) {
        return { bits: Array<Bit4>(finalBits.length).fill(u), feedback: `${lead}only the bits its digit sets are ${u}, and the padding and the known digits keep their values (§5.7.1).` };
      }
      if (!xzPadded) {
        return {
          bits: Array<Bit4>(finalBits.length).fill(u),
          feedback: `${lead}${L > W ? `truncation from the left leaves ${bitsText(litBits)} (§5.7.1), whose x or z bits stay as written` : "the digit bits written as x or z stay as written"}, and the known digits keep their values. ${text} is signed, so the ${plural(tw - W, "bit")} the assignment adds copy its sign bit, ${litBits[0]} (§10.7).`,
        };
      }
      // §5.7.1: when the leftmost digit bit is x or z, the padding is x or z too.
      const reach = reachesTarget
        ? `up to all ${tw} bits of ${name}, because it is unsized (§5.7.1)`
        : `up to the literal's ${plural(W, "bit")} (§5.7.1)`;
      return {
        bits: Array<Bit4>(finalBits.length).fill(u),
        feedback: `${lead}the digit bits written as x or z stay as written, and because the leftmost digit bit is ${leftXz} the padding is ${leftXz} too, ${reach}. The known digits keep their values${added}.`,
      };
    },
    "decimal-as-hex": () => {
      const decimalDigits = tokens.form === "decimal" || tokens.base === "d";
      if (!decimalDigits || tokens.cleanDigits.length < 2 || unknownOf(tokens.cleanDigits)) return null;
      const alt = tokens.form === "decimal" ? `'h${tokens.cleanDigits}` : canonical(tokens, { base: "h" });
      const bits = through(alt);
      if (!bits) return null;
      return { bits, feedback: `Decimal digits name one number; they are not groups of bits like hex digits: ${tokens.cleanDigits} is ${digitBits.join("")} in binary (§5.7.1). This strip reads them as ${alt}.` };
    },
    "keep-left": () => {
      if (decl && mode === "truncate") {
        const ctx = bitsOf((d.assignment as AssignmentEvaluation).rhsValue);
        return { bits: store(ctx.slice(0, tw)), feedback: `Truncation keeps the low bits and discards the most significant ones (§10.7).` };
      }
      if (tokens.size !== null && L > tokens.size) {
        return { bits: place(fromBits(digitBits.slice(0, tokens.size), parsed.value.signed), parsed.value.signed), feedback: "A literal's digits are truncated from the left: the low bits stay and the leftmost are cut off (§5.7.1)." };
      }
      return null;
    },
    "lands-high": () => {
      if (!decl || tw <= W) return null;
      return {
        bits: store([...litBits, ...Array<Bit4>(tw - W).fill("0")]),
        // A fill literal is not a narrow value that gets extended (§10.7 does not
        // apply): it sets every bit of its context (§5.7.1).
        feedback: fillDigit
          ? `${text} is not a single ${fillDigit} placed in one bit of ${name}, at the top or at the bottom: every bit of its context takes the value ${fillDigit}, here all ${tw} bits (§5.7.1).`
          : parsed.pad
          ? `Extension adds bits on the left: bit 0 of the literal stays bit 0 of ${name}, and because ${text} is unsized and led by ${parsed.pad}, the new bits are ${parsed.pad} (§5.7.1).`
          : `Extension adds bits on the left: bit 0 of the literal stays bit 0 of ${name} (§10.7).`,
      };
    },
  };

  const positiveReading = d.signAmbiguous ? place(fromBits(["0", ...litBits], true), true) : null;
  const keyText = d.steps.filter((s) => s.key).map((s) => s.text).join(" ");
  const correct: LiteralOption = { id: "correct", bits: finalBits, label: bitsText(finalBits), correct: true, feedback: `${d.summary} ${keyText}` };
  const chosen: LiteralOption[] = [];
  for (const id of MISCONCEPTION_ORDER) {
    if (chosen.length >= 3) break;
    const alt = make[id]();
    if (!alt) continue;
    if (sameBits(alt.bits, finalBits) || chosen.some((c) => sameBits(c.bits, alt.bits))) continue;
    // Where §5.7.1 leaves the sign bit open, the reading with a 0 sign bit is not a mistake.
    if (positiveReading && sameBits(alt.bits, positiveReading)) continue;
    chosen.push({ id, bits: alt.bits, label: bitsText(alt.bits), correct: false, feedback: alt.feedback });
  }
  return arrange([correct, ...chosen], `${text}@${target.id}`);
}

/** The question the prediction asks. */
export function predictionQuestion(text: string, targetId: LiteralTargetId): string {
  const t = literalTarget(targetId);
  return t.decl ? `After ${t.decl.name} = ${text}, which bits does ${t.decl.name} hold?` : `As a $display argument, how many bits is ${text}, and which?`;
}

// ---------------------------------------------------------------------------
// The classic syntax errors
// ---------------------------------------------------------------------------

export interface SyntaxErrorCard {
  id: "sign-after-base" | "unsized-in-concatenation";
  code: string;
  error: LiteralError;
}

/** 8'd-6 (§5.7.1's own example of illegal syntax) and {a, 1} (§11.4.12). The text comes from the decoder itself. */
export function syntaxErrorCards(): SyntaxErrorCard[] {
  const signAfter = lexLiteral("8'd-6") as LiteralFailure;
  const concat = checkConcatenation("{a, 1}");
  return [
    { id: "sign-after-base", code: "v = 8'd-6;", error: signAfter.error },
    { id: "unsized-in-concatenation", code: "v = {a, 1};", error: concat.error },
  ];
}
