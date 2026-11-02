/**
 * Deterministic educational model of SystemVerilog decision statements:
 * the case family (case, casez, casex, case inside), if–else-if chains, and
 * the unique / unique0 / priority violation checks.
 *
 * Every rule below was checked against IEEE 1800-2023; the clause is cited
 * next to the code that implements it and in the test that pins it.
 *
 * Matching is delegated to the four-state model (`caseItemMatches` for the
 * case family, `compare("==?")` for `inside`), so this model and the F2A
 * explorer (LogicStateDiagram) cannot disagree about a comparison.
 *
 * Scope and assumptions (also surfaced to learners in the UI):
 * - One select, a vector written MSB first, compared with literal items,
 *   ranges `[lo:hi]` and bit-selects `sel[i]`. Everything is unsigned.
 * - `$` bounds, tolerance ranges, strings, unpacked arrays in a range list
 *   and side effects in item expressions are not modelled.
 * - A violation is reported as a ticket. A simulator holds the report until
 *   the Observed region and words it in its own way (§12.4.2.1, §12.5.3.1).
 * - One execution of the statement is modelled. A pending report is discarded
 *   if the procedure reaches a flush point before the Observed region of that
 *   time step, for example when an always_comb runs again (§12.4.2.1,
 *   §12.5.3.1); that case is declared to learners, not simulated.
 */

import {
  caseItemMatches,
  compare,
  formatLiteral,
  fromNumber,
  hasUnknown,
  isUnknownBit,
  parseBits,
  resize,
  toUnsigned,
  type Bit4,
  type BitOutcome,
  type CaseKind,
} from "@/lib/sv-four-state-model";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** The five statement forms the lab can write for one set of items. */
export type DecisionForm = CaseKind | "case-inside" | "if-else-if";

export const DECISION_FORMS: readonly DecisionForm[] = ["case", "casez", "casex", "case-inside", "if-else-if"];

export const FORM_LABELS: Record<DecisionForm, string> = {
  case: "case",
  casez: "casez",
  casex: "casex",
  "case-inside": "case inside",
  "if-else-if": "if-else-if",
};

/** `plain` is the unqualified statement (§12.4.2, §12.5.3). */
export type Qualifier = "plain" | "unique" | "unique0" | "priority";

export const QUALIFIERS: readonly Qualifier[] = ["plain", "unique", "unique0", "priority"];

/** Number of case items (or true conditions) that match: the columns of the lesson's outcome grid. */
export type MatchColumn = "none" | "one" | "many";

export const MATCH_COLUMNS: readonly MatchColumn[] = ["none", "one", "many"];

/** What the statement reports when it executes. Exactly one of the three applies. */
export type ReportKind = "nothing" | "no-match" | "overlap";

export const REPORT_KINDS: readonly ReportKind[] = ["nothing", "no-match", "overlap"];

/**
 * One case_item_expression, one value_range of a case-inside item, or one
 * bit-select (`sel[i]`, used by `case (1'b1)` one-hot decoders and by
 * if–else-if chains such as `if (req[0])`).
 */
export type Term = { kind: "literal"; text: string } | { kind: "range"; lo: string; hi: string } | { kind: "bit"; index: number };

/** A case_item (§12.5): one or more terms in front of one statement. */
export interface DecisionItem {
  terms: Term[];
  /** Statement text shown after the colon, e.g. `y = 4'b0001;`. */
  action?: string;
  /** Short name for prediction options (NOP, RW, …). Defaults to the item's pattern text. */
  label?: string;
}

export interface DecisionConfig {
  form: DecisionForm;
  qualifier: Qualifier;
  /** A `default` item (case forms) or a final `else` (if form). */
  catchAll: boolean;
  catchAllAction?: string;
  selectName: string;
  /** The select, MSB first. */
  select: Bit4[];
  /** Items in source order. */
  items: DecisionItem[];
}

/* ------------------------------------------------------------------ */
/* The two qualifier rules (§12.4.2, §12.5.3)                           */
/* ------------------------------------------------------------------ */

/**
 * unique and priority report when no item matches and there is no default
 * (no final else); unique0 does not (§12.5.3; §12.4.2 for if chains).
 */
export const reportsNoMatch = (qualifier: Qualifier): boolean => qualifier === "unique" || qualifier === "priority";

/**
 * unique and unique0 report when two or more items match; priority allows
 * overlap and acts on the first match only (§12.5.3; §12.4.2 for if chains).
 */
export const reportsOverlap = (qualifier: Qualifier): boolean => qualifier === "unique" || qualifier === "unique0";

export const isCaseFamily = (form: DecisionForm): form is CaseKind => form === "case" || form === "casez" || form === "casex";

export const isIfChain = (form: DecisionForm): boolean => form === "if-else-if";

/** `default` in a case statement, `else` at the end of an if chain (§12.4.2). */
export const catchAllWord = (form: DecisionForm): "default" | "else" => (isIfChain(form) ? "else" : "default");

/** The clause that defines the qualifier checks for this form. */
export const qualifierClause = (form: DecisionForm): string => (isIfChain(form) ? "§12.4.2" : "§12.5.3");

/** The word for one alternative in this form. */
export const itemWord = (form: DecisionForm): "case item" | "condition" => (isIfChain(form) ? "condition" : "case item");

/** The word for what executes. In an if chain conditions match and branches run (§12.4). */
export const branchWord = (form: DecisionForm): "case item" | "branch" => (isIfChain(form) ? "branch" : "case item");

/** The column headers of the outcome grid, in this form's vocabulary. */
export function matchColumnLabel(column: MatchColumn, form: DecisionForm): string {
  const word = itemWord(form);
  return column === "none" ? `no ${word} matches` : column === "one" ? `one ${word} matches` : "two or more match";
}

const DEFERRED_CLAUSES = "§12.4.2.1, §12.5.3.1";

/** The ticket's timing line. */
export const DEFERRED_REPORT_NOTE = `checked now, reported in the Observed region (${DEFERRED_CLAUSES})`;

/** The same fact as a full sentence, for feedback prose. */
const DEFERRED_SENTENCE = `The check runs now; the report waits for the Observed region (${DEFERRED_CLAUSES}).`;

/* ------------------------------------------------------------------ */
/* Literals and bit-selects                                            */
/* ------------------------------------------------------------------ */

const bitLength = (value: bigint): number => (value === BigInt(0) ? 1 : value.toString(2).length);

function hexDigitBits(digit: string): Bit4[] {
  const d = digit.toLowerCase();
  if (d === "x") return ["x", "x", "x", "x"];
  if (d === "z" || d === "?") return ["z", "z", "z", "z"];
  const n = Number.parseInt(d, 16);
  if (Number.isNaN(n)) throw new Error(`Not a hex digit: "${digit}"`);
  return fromNumber(n, 4);
}

/**
 * Pads or truncates a literal body to its declared size: zeros on the left,
 * or x / z when the leftmost written bit is x / z (§5.7.1).
 */
function sizeLiteral(bits: Bit4[], size: number): Bit4[] {
  if (bits.length >= size) return resize(bits, size);
  const pad: Bit4 = bits[0] === "x" ? "x" : bits[0] === "z" ? "z" : "0";
  return [...Array<Bit4>(size - bits.length).fill(pad), ...bits];
}

/**
 * Parses `2'b1?`, `3'b0?0`, `4'd7`, `8'hF0`, `'b01` and unsized decimals such
 * as `3`. An unsized number is given the width of the select, or more when the
 * value needs it; comparisons zero-extend the narrower operand (§11.4.5).
 */
export function parseLiteral(text: string, width: number): Bit4[] {
  const t = text.replace(/\s+/g, "");
  const sized = /^(\d+)?'([bBdDhH])([0-9a-fA-FxXzZ?_]+)$/.exec(t);
  if (sized) {
    const [, sizeText, baseText, body] = sized;
    const base = baseText.toLowerCase();
    const digits = body.replace(/_/g, "");
    let bits: Bit4[];
    if (base === "b") bits = parseBits(digits);
    else if (base === "h") bits = digits.split("").flatMap(hexDigitBits);
    else {
      if (!/^\d+$/.test(digits)) throw new Error(`Not a decimal literal: "${text}"`);
      const value = BigInt(digits);
      bits = fromNumber(value, Math.max(bitLength(value), sizeText ? Number(sizeText) : width));
    }
    return sizeLiteral(bits, sizeText ? Number(sizeText) : Math.max(width, bits.length));
  }
  if (/^\d+$/.test(t)) {
    const value = BigInt(t);
    return fromNumber(value, Math.max(width, bitLength(value)));
  }
  throw new Error(`Not a literal: "${text}"`);
}

/** `sel[index]` with bit 0 the LSB. An out-of-range bit-select reads x (§11.5.1). */
export function bitAt(bits: readonly Bit4[], index: number): Bit4 {
  const position = bits.length - 1 - index;
  return position < 0 || position >= bits.length ? "x" : bits[position];
}

/* ------------------------------------------------------------------ */
/* Source text                                                         */
/* ------------------------------------------------------------------ */

/** How a term is written in a case item. */
export function termText(term: Term, selectName: string): string {
  if (term.kind === "literal") return term.text;
  if (term.kind === "range") return `[${term.lo}:${term.hi}]`;
  return `${selectName}[${term.index}]`;
}

/** How a term is written as an if condition. */
export function conditionText(term: Term, selectName: string): string {
  if (term.kind === "literal") return `${selectName} ${/[xXzZ?]/.test(term.text) ? "==?" : "=="} ${term.text}`;
  if (term.kind === "range") return `${selectName} inside {[${term.lo}:${term.hi}]}`;
  return `${selectName}[${term.index}]`;
}

/** The item's pattern as written in the chosen form. */
export function itemText(item: DecisionItem, form: DecisionForm, selectName: string): string {
  return isIfChain(form) ? item.terms.map((t) => conditionText(t, selectName)).join(" || ") : item.terms.map((t) => termText(t, selectName)).join(", ");
}

/** Name used in prediction options: the given label, else the pattern. */
export function itemLabel(item: DecisionItem, form: DecisionForm, selectName: string): string {
  return item.label ?? itemText(item, form, selectName);
}

/**
 * `case (1'b1)`: when every item is a bit-select the case expression is the
 * constant 1'b1 and each item is tested for being 1 (§12.5.2). If chains
 * test the bit directly.
 */
export const usesConstantExpression = (items: readonly DecisionItem[]): boolean =>
  items.length > 0 && items.every((item) => item.terms.length > 0 && item.terms.every((t) => t.kind === "bit"));

export interface SourceLine {
  text: string;
  key: string;
}

export const itemKey = (index: number) => `item-${index}`;
export const CATCH_ALL_KEY = "catch-all";

/** Roughly how many characters of code fit on one line of the code panel at 390 px. */
export const CODE_LINE_FIT = 34;

/**
 * Lines the actions up like the lesson does, unless a padded row would not fit
 * the panel on a phone: padding then only pushes actions onto a wrapped line,
 * so the rows are written without it.
 */
function alignedRows(heads: readonly string[], actions: readonly string[]): string[] {
  const pad = Math.max(...heads.map((h) => h.length));
  const padded = heads.map((h, i) => `${h.padEnd(pad)} ${actions[i]}`);
  return padded.some((row) => row.length > CODE_LINE_FIT) ? heads.map((h, i) => `${h} ${actions[i]}`) : padded;
}

/**
 * The statement, generated from the same data the model executes (items are
 * normalized for the form first, so a casex column lists a range's values).
 */
export function decisionSource(config: DecisionConfig): SourceLine[] {
  const { form, qualifier, selectName, select } = config;
  const width = select.length;
  const items = normalizeItems(form, config.items, width);
  const prefix = qualifier === "plain" ? "" : `${qualifier} `;
  const action = (item: DecisionItem, i: number) => item.action ?? `branch = ${i + 1};`;
  const catchAllAction = config.catchAllAction ?? "branch = 0;";
  const lines: SourceLine[] = [{ text: `logic [${width - 1}:0] ${selectName} = ${formatLiteral(select)};`, key: "decl" }];

  if (isIfChain(form)) {
    // Padded like the lesson: the actions line up, the keywords do not move.
    const heads = items.map((item, i) => `${i === 0 ? `${prefix}if` : "else if"} (${itemText(item, form, selectName)})`);
    const rows = alignedRows([...heads, ...(config.catchAll ? ["else"] : [])], [...items.map(action), ...(config.catchAll ? [catchAllAction] : [])]);
    items.forEach((_, i) => lines.push({ text: rows[i], key: itemKey(i) }));
    if (config.catchAll) lines.push({ text: rows[items.length], key: CATCH_ALL_KEY });
    return lines;
  }

  const expr = usesConstantExpression(items) ? "1'b1" : selectName;
  const keyword = form === "case-inside" ? `case (${expr}) inside` : `${form} (${expr})`;
  lines.push({ text: `${prefix}${keyword}`, key: "head" });
  const patterns = items.map((item) => `  ${itemText(item, form, selectName)}:`);
  const rows = alignedRows([...patterns, ...(config.catchAll ? ["  default:"] : [])], [...items.map(action), ...(config.catchAll ? [catchAllAction] : [])]);
  // A range that could not be listed stays in brackets, which is not legal in case/casez/casex: say so on the line.
  const illegal = (item: DecisionItem) => (isCaseFamily(form) && item.terms.some((t) => t.kind === "range") ? " // not legal here: a range needs case inside (§12.5.4)" : "");
  items.forEach((item, i) => lines.push({ text: `${rows[i]}${illegal(item)}`, key: itemKey(i) }));
  if (config.catchAll) lines.push({ text: rows[items.length], key: CATCH_ALL_KEY });
  lines.push({ text: "endcase", key: "end" });
  return lines;
}

/* ------------------------------------------------------------------ */
/* Per-bit chips                                                       */
/* ------------------------------------------------------------------ */

/**
 * One bit of a comparison: 1 match, 0 mismatch, x ambiguous, skip for a
 * casez/casex do-not-care bit that is left out of the comparison (§12.5.1).
 */
export type ChipVerdict = "1" | "0" | "x" | "skip";

export interface BitChip {
  /** Bit index, LSB = 0. */
  index: number;
  /** The select's bit (left operand). */
  left: Bit4;
  /** The item's bit (right operand). */
  right: Bit4;
  verdict: ChipVerdict;
  /** True when the bit matched because the item's bit is an x/z wildcard (§11.4.6). */
  wildcard: boolean;
}

function extendPair(a: readonly Bit4[], b: readonly Bit4[]): [Bit4[], Bit4[]] {
  const width = Math.max(a.length, b.length);
  return [resize(a, width), resize(b, width)];
}

/**
 * Explains a case-family comparison bit by bit. The verdict itself comes from
 * `caseItemMatches`; the chips are consistent with it (pinned by a sweep test):
 * case compares every bit literally (§12.5); casez skips z (and ?) in either
 * operand, casex skips x and z in either operand (§12.5.1).
 */
export function caseBitChips(kind: CaseKind, expr: readonly Bit4[], item: readonly Bit4[]): BitChip[] {
  const [x, y] = extendPair(expr, item);
  return x.map((left, i) => {
    const right = y[i];
    const skipped = (kind === "casez" && (left === "z" || right === "z")) || (kind === "casex" && (isUnknownBit(left) || isUnknownBit(right)));
    return { index: x.length - 1 - i, left, right, verdict: skipped ? "skip" : left === right ? "1" : "0", wildcard: false };
  });
}

const outcomeVerdict: Record<BitOutcome, ChipVerdict> = { match: "1", wildcard: "1", mismatch: "0", ambiguous: "x" };

/**
 * `==?` bit by bit (§11.4.6): x/z in the item (right operand) are wildcards;
 * x/z in the select (left operand) are compared as for `==` and make the
 * result ambiguous.
 */
export function wildcardBitChips(left: readonly Bit4[], right: readonly Bit4[]): BitChip[] {
  return compare("==?", left, right).bits.map((c) => ({ index: c.index, left: c.a, right: c.b, verdict: outcomeVerdict[c.outcome], wildcard: c.outcome === "wildcard" }));
}

/* ------------------------------------------------------------------ */
/* Term and item evaluation                                            */
/* ------------------------------------------------------------------ */

export interface TermVerdict {
  term: Term;
  /** The term as written in the statement. */
  text: string;
  /** 1 match, 0 mismatch, x ambiguous. The case family never yields x. */
  result: Bit4;
  /** Per-bit chips, MSB first; null for ranges and bare bit conditions. */
  chips: BitChip[] | null;
  why: string;
  /**
   * Set when the lab could not compare the term in this form: a range in a
   * case-family statement that cannot be listed as plain items (§12.5.4).
   * The result is then "0" by construction and the UI marks it not comparable.
   */
  unsupported?: true;
}

export interface ItemVerdict {
  index: number;
  item: DecisionItem;
  text: string;
  label: string;
  terms: TermVerdict[];
  /** OR across the item's terms (§11.4.13 for inside, §11.4.7 for ||). */
  result: Bit4;
  matches: boolean;
  status: "runs" | "matches-not-run" | "no-match";
}

/**
 * The OR reduction that `inside` (§11.4.13) and `||` (§11.4.7) apply to
 * several 1-bit results: 1 if any is 1, 0 if all are 0, otherwise x.
 */
export function orReduce(results: readonly Bit4[]): Bit4 {
  if (results.some((r) => r === "1")) return "1";
  if (results.length > 0 && results.every((r) => r === "0")) return "0";
  return "x";
}

const bitList = (chips: readonly BitChip[]) => chips.map((c) => c.index).join(", ");

function describeCaseChips(kind: CaseKind, chips: BitChip[], literal: string, matched: boolean): string {
  if (matched) {
    const skipped = chips.filter((c) => c.verdict === "skip");
    if (skipped.length === 0) return `${literal} matches bit for bit (§12.5).`;
    const fromSelect = skipped.some((c) => (kind === "casex" ? isUnknownBit(c.left) : c.left === "z"));
    return `${literal} matches: ${kind} skips bit${skipped.length > 1 ? "s" : ""} ${bitList(skipped)}${fromSelect ? ", including the unknown bit of the select itself" : ""} (§12.5.1).`;
  }
  const bad = chips.find((c) => c.verdict === "0");
  if (!bad) return `${literal} does not match.`;
  const note =
    kind === "case" && (isUnknownBit(bad.left) || isUnknownBit(bad.right))
      ? " A plain case compares x and z literally (§12.5)."
      : kind === "casez" && bad.left === "x"
        ? " casez skips only z, so an x must match exactly (§12.5.1)."
        : "";
  return `${literal} fails at bit ${bad.index} (${bad.left} in the select, ${bad.right} in the item).${note}`;
}

function describeWildcardChips(chips: BitChip[], result: Bit4, literal: string, selectName: string, rightName: "item" | "literal" = "item"): string {
  if (result === "1") {
    const wild = chips.filter((c) => c.wildcard);
    return wild.length
      ? `${selectName} ==? ${literal} is 1: bit${wild.length > 1 ? "s" : ""} ${bitList(wild)} of the ${rightName} ${wild.length > 1 ? "are" : "is a"} wildcard${wild.length > 1 ? "s" : ""}, and every other bit matches (§11.4.6).`
      : `${selectName} ==? ${literal} is 1: every bit matches.`;
  }
  if (result === "0") {
    const bad = chips.find((c) => c.verdict === "0");
    return `${selectName} ==? ${literal} is 0: bit ${bad?.index} is ${bad?.left} in ${selectName} and ${bad?.right} in the ${rightName} (§11.4.6).`;
  }
  const amb = chips.find((c) => c.verdict === "x");
  return `${selectName} ==? ${literal} is x: bit ${amb?.index} is ${amb?.left} in ${selectName} against a fixed ${amb?.right} in the ${rightName}. An x or z on the left is not a wildcard (§11.4.6).`;
}

/**
 * `lo <= value && value <= hi` for a range in a range list (§11.4.13). A range
 * with known bounds whose low bound exceeds its high bound is empty and
 * contains no values, whatever the value is (§11.4.13). Otherwise any x or z
 * operand makes a relational comparison x (§11.4.4).
 */
export function rangeContains(value: readonly Bit4[], lo: readonly Bit4[], hi: readonly Bit4[]): Bit4 {
  const l = toUnsigned(lo);
  const h = toUnsigned(hi);
  if (l === null || h === null) return "x";
  if (l > h) return "0";
  const v = toUnsigned(value);
  if (v === null) return "x";
  return v >= l && v <= h ? "1" : "0";
}

function evaluateRange(value: readonly Bit4[], term: Extract<Term, { kind: "range" }>, selectName: string): TermVerdict {
  const width = value.length;
  const lo = parseLiteral(term.lo, width);
  const hi = parseLiteral(term.hi, width);
  const result = rangeContains(value, lo, hi);
  const text = `[${term.lo}:${term.hi}]`;
  let why: string;
  if (result === "x") {
    why = hasUnknown(value)
      ? `${selectName} holds an x or z bit, so ${term.lo} <= ${selectName} and ${selectName} <= ${term.hi} are both x (§11.4.4): the range gives x.`
      : `a bound of ${text} holds an x or z bit, so the relational comparison is x (§11.4.4).`;
  } else if (result === "1") {
    why = `${selectName} lies inclusively within ${text} (§11.4.13).`;
  } else {
    const l = toUnsigned(lo);
    const h = toUnsigned(hi);
    why = l !== null && h !== null && l > h ? `${text} is empty: its low bound exceeds its high bound (§11.4.13).` : `${selectName} lies outside ${text}.`;
  }
  return { term, text, result, chips: null, why };
}

function evaluateCaseTerm(kind: CaseKind, expr: readonly Bit4[], term: Term, config: DecisionConfig): TermVerdict {
  const text = termText(term, config.selectName);
  if (term.kind === "range") {
    // normalizeItems lists every range it can; one that reaches here could not be written as plain items.
    const problem = rangeListingProblem(term, config.select.length) ?? "it could not be listed";
    return {
      term,
      text,
      result: "0",
      chips: null,
      unsupported: true,
      why: `Not comparable: a range is legal only in case inside (§12.5.4), and ${text} cannot be written as plain ${kind} items because ${problem}. This item is left out of the decision.`,
    };
  }
  const right = term.kind === "literal" ? parseLiteral(term.text, expr.length) : [bitAt(config.select, term.index)];
  const matched = caseItemMatches(kind, expr, right);
  const chips = caseBitChips(kind, expr, right);
  if (term.kind === "literal") return { term, text, result: matched ? "1" : "0", chips, why: describeCaseChips(kind, chips, text, matched) };
  // A bit-select item against the constant case expression 1'b1 (§12.5.2).
  const b = right[0];
  let why: string;
  if (matched && chips[0].verdict === "skip") why = `${text} is ${b}: ${kind} treats it as a don't-care, so it matches the case expression 1'b1 (§12.5.1).`;
  else if (matched) why = `${text} is 1, which matches the case expression 1'b1 (§12.5.2).`;
  else {
    const note = isUnknownBit(b) ? (kind === "case" ? "; a plain case compares x and z literally (§12.5)" : "; casez skips only z, so x must match exactly (§12.5.1)") : "";
    why = `${text} is ${b}, not 1, so it does not match the case expression 1'b1 (§12.5.2)${note}.`;
  }
  return { term, text, result: matched ? "1" : "0", chips, why };
}

function evaluateInsideTerm(expr: readonly Bit4[], term: Term, config: DecisionConfig): TermVerdict {
  if (term.kind === "range") return evaluateRange(expr, term, config.selectName);
  const text = termText(term, config.selectName);
  const right = term.kind === "literal" ? parseLiteral(term.text, expr.length) : [bitAt(config.select, term.index)];
  const eq = compare("==?", expr, right);
  const chips = wildcardBitChips(expr, right);
  const constant = usesConstantExpression(config.items);
  const leftName = constant ? "1'b1" : config.selectName;
  if (term.kind === "bit" && constant) {
    // case (1'b1) inside: the item is the bit-select, so it is the RIGHT operand of ==? and its x or z is a wildcard (§11.4.6).
    const b = right[0];
    const why = isUnknownBit(b)
      ? `${text} is ${b}; as the right operand of ==? ${b === "x" ? "an x" : "a z"} bit is a wildcard, so the constant 1'b1 matches (§11.4.6). A plain case would compare the ${b} literally and not match (§12.5).`
      : b === "1"
        ? `${text} is 1, so 1'b1 ==? ${text} is 1: the constant case expression matches (§11.4.6, §12.5.2).`
        : `${text} is 0, so 1'b1 ==? ${text} is 0: the constant case expression does not match (§11.4.6).`;
    return { term, text, result: eq.result, chips, why };
  }
  const literal = term.kind === "bit" ? `${text} (${right[0]})` : text;
  return { term, text, result: eq.result, chips, why: describeWildcardChips(chips, eq.result, literal, leftName) };
}

function evaluateIfTerm(term: Term, config: DecisionConfig): TermVerdict {
  const { select, selectName } = config;
  const text = conditionText(term, selectName);
  if (term.kind === "range") return { ...evaluateRange(select, term, selectName), term, text };
  if (term.kind === "bit") {
    const b = bitAt(select, term.index);
    const result: Bit4 = b === "1" ? "1" : b === "0" ? "0" : "x";
    const why =
      result === "1"
        ? `${text} is 1, a known nonzero value, so the condition is true (§12.4).`
        : result === "0"
          ? `${text} is 0, so the condition is false (§12.4).`
          : `${text} is ${b}. An x or z condition counts as false, so this branch does not run (§12.4).`;
    return { term, text, result, chips: null, why };
  }
  const lit = parseLiteral(term.text, select.length);
  const wildcard = hasUnknown(lit);
  const eq = compare(wildcard ? "==?" : "==", select, lit);
  const chips = eq.bits.map((c) => ({ index: c.index, left: c.a, right: c.b, verdict: outcomeVerdict[c.outcome], wildcard: c.outcome === "wildcard" }));
  let why: string;
  if (wildcard) why = describeWildcardChips(chips, eq.result, term.text, selectName, "literal");
  else if (eq.result === "1") why = `${text} is 1: every bit is known and equal (§11.4.5).`;
  else if (eq.result === "0") {
    const bad = chips.find((c) => c.verdict === "0");
    why = `${text} is 0: bit ${bad?.index} is ${bad?.left} in ${selectName} and ${bad?.right} in the literal (§11.4.5).`;
  } else {
    const amb = chips.find((c) => c.verdict === "x");
    why = `${text} is x: bit ${amb?.index} is ${amb?.left} in ${selectName}, so == cannot decide (§11.4.5). An if treats x as false (§12.4).`;
  }
  return { term, text, result: eq.result, chips, why };
}

/** The most values a range is listed as when a case-family statement needs it written out item by item. */
export const RANGE_LIST_LIMIT = 64;

/**
 * Why `[lo:hi]` cannot be listed as plain case items, or null when it can:
 * a bound with x or z (§11.4.4 makes the range x anyway), an empty range
 * (lo > hi, §11.4.13) or more values than RANGE_LIST_LIMIT.
 */
export function rangeListingProblem(term: Extract<Term, { kind: "range" }>, width: number, limit = RANGE_LIST_LIMIT): string | null {
  const lo = toUnsigned(parseLiteral(term.lo, width));
  const hi = toUnsigned(parseLiteral(term.hi, width));
  if (lo === null || hi === null) return "a bound holds an x or z bit";
  if (lo > hi) return "its low bound exceeds its high bound, so it is empty (§11.4.13)";
  if (hi - lo >= BigInt(limit)) return `it spans ${(hi - lo + BigInt(1)).toString()} values, more than the ${limit} this lab lists`;
  return null;
}

/** Enumerates `[lo:hi]` as literals for a case-family statement, or null when `rangeListingProblem` finds a problem. */
export function expandRange(term: Extract<Term, { kind: "range" }>, width: number, limit = RANGE_LIST_LIMIT): string[] | null {
  if (rangeListingProblem(term, width, limit) !== null) return null;
  const lo = toUnsigned(parseLiteral(term.lo, width)) as bigint;
  const hi = toUnsigned(parseLiteral(term.hi, width)) as bigint;
  const out: string[] = [];
  for (let v = lo; v <= hi; v += BigInt(1)) out.push(formatLiteral(fromNumber(v, width)));
  return out;
}

/**
 * The items as the chosen form needs them. A range is legal only in
 * case inside (§12.5.4), so the case family lists its values as plain items
 * (the operators lesson's "written as casex with plain items"). A range that
 * cannot be listed (see `rangeListingProblem`) is kept, and `evaluateDecision`
 * then flags its term as unsupported instead of silently treating it as no match.
 */
export function normalizeItems(form: DecisionForm, items: readonly DecisionItem[], width: number): DecisionItem[] {
  if (!isCaseFamily(form)) return [...items];
  return items.map((item) => ({
    ...item,
    terms: item.terms.flatMap((t) => {
      if (t.kind !== "range") return [t];
      const values = expandRange(t, width);
      return values ? values.map((text) => ({ kind: "literal", text }) as Term) : [t];
    }),
  }));
}

/* ------------------------------------------------------------------ */
/* The decision                                                        */
/* ------------------------------------------------------------------ */

export type RunOutcome = { kind: "item"; index: number } | { kind: "catch-all" } | { kind: "nothing" };

export interface ViolationReport {
  kind: Exclude<ReportKind, "nothing">;
  clause: string;
  title: string;
  detail: string;
  /** Timing of the report (§12.4.2.1, §12.5.3.1). */
  deferred: string;
}

export interface DecisionResult {
  config: DecisionConfig;
  /** Items after range expansion, in source order. */
  items: ItemVerdict[];
  /** The case expression: the select, or 1'b1 for a one-hot `case (1'b1)`. */
  expression: Bit4[];
  constantExpression: boolean;
  matchCount: number;
  column: MatchColumn;
  runs: RunOutcome;
  reportKind: ReportKind;
  report: ViolationReport | null;
  /** Why nothing is reported, when nothing is. */
  silentBecause: string | null;
  /**
   * Terms the lab could not compare in this form (an unlistable range in a
   * case-family statement), one explanation each. Empty for every shipped
   * preset; when not empty the decision leaves those items out and says so.
   */
  unsupported: string[];
  /** Text alternative for the whole outcome. */
  summary: string;
}

function evaluateItem(config: DecisionConfig, expr: readonly Bit4[], item: DecisionItem, index: number): Omit<ItemVerdict, "status"> {
  const { form } = config;
  const terms = item.terms.map((term) =>
    isCaseFamily(form) ? evaluateCaseTerm(form, expr, term, config) : form === "case-inside" ? evaluateInsideTerm(expr, term, config) : evaluateIfTerm(term, config),
  );
  const result = orReduce(terms.map((t) => t.result));
  return {
    index,
    item,
    text: itemText(item, form, config.selectName),
    label: itemLabel(item, form, config.selectName),
    terms,
    result,
    // §12.5.4: a case-inside item matches only on 1'b1; 1'b0 and 1'bx are no match.
    // §12.4: an if branch runs only for a known nonzero condition.
    matches: result === "1",
  };
}

const ordinal = (n: number) => (n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`);

/** Short name used in prose: "item 2 (2'b01)", or "branch 2 (req[1])" in an if chain. */
export const itemRef = (v: ItemVerdict, form: DecisionForm) => `${isIfChain(form) ? "branch" : "item"} ${v.index + 1} (${v.label === v.text ? v.text : `${v.label}, ${v.text}`})`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** An item that simply fails: every comparison is 0 and all of them could be made. Its detail can stay folded. */
export const isPlainMiss = (v: ItemVerdict): boolean => v.result === "0" && !v.terms.some((t) => t.unsupported);

/** One line on why a plain miss fails, for the folded view of its item card. */
export function itemMissLine(v: ItemVerdict): string {
  if (v.terms.length > 1) return `all ${v.terms.length} comparisons fail`;
  const t = v.terms[0];
  if (t.term.kind === "bit") return `${t.text} is ${t.chips ? t.chips[t.chips.length - 1].right : "0"}`;
  const bad = t.chips?.find((c) => c.verdict === "0");
  if (bad) return `fails at bit ${bad.index}`;
  return t.term.kind === "range" ? "outside the range" : "does not match";
}

export function evaluateDecision(config: DecisionConfig): DecisionResult {
  const { form, qualifier, catchAll } = config;
  const items = normalizeItems(form, config.items, config.select.length);
  const constantExpression = !isIfChain(form) && usesConstantExpression(items);
  const expression: Bit4[] = constantExpression ? ["1"] : [...config.select];
  const effective: DecisionConfig = { ...config, items };
  const partial = items.map((item, i) => evaluateItem(effective, expression, item, i));
  const firstIndex = partial.findIndex((v) => v.matches);
  const verdicts: ItemVerdict[] = partial.map((v) => ({ ...v, status: v.matches ? (v.index === firstIndex ? "runs" : "matches-not-run") : "no-match" }));
  const matching = verdicts.filter((v) => v.matches);
  const matchCount = matching.length;
  const column: MatchColumn = matchCount === 0 ? "none" : matchCount === 1 ? "one" : "many";
  const runs: RunOutcome = firstIndex >= 0 ? { kind: "item", index: firstIndex } : catchAll ? { kind: "catch-all" } : { kind: "nothing" };

  const clause = qualifierClause(form);
  const word = itemWord(form);
  const formWord = isIfChain(form) ? "if" : FORM_LABELS[form];
  const catchWord = catchAllWord(form);
  let report: ViolationReport | null = null;
  let silentBecause: string | null = null;

  if (column === "none") {
    if (catchAll) silentBecause = `The ${catchWord} is itself an alternative that matches every leftover value, so "no match" cannot happen and nothing is reported (${clause}).`;
    else if (reportsNoMatch(qualifier)) {
      report = {
        kind: "no-match",
        clause,
        title: `${qualifier} ${formWord}: no ${word} matches`,
        detail: `${qualifier} reports when no ${word} matches and there is no ${catchWord} (${clause}). Nothing runs.`,
        deferred: DEFERRED_REPORT_NOTE,
      };
    } else if (qualifier === "unique0") silentBecause = `unique0 does not report a missing match; it checks only for overlap (${clause}). Nothing runs, silently.`;
    else silentBecause = isIfChain(form) ? "No condition is true and there is no else, so nothing runs and nothing is reported (§12.4)." : "No item matches and there is no default, so nothing runs and nothing is reported (§12.5).";
  } else if (column === "many") {
    const names = matching.map((v) => v.text).join(", ");
    if (reportsOverlap(qualifier)) {
      report = {
        kind: "overlap",
        clause,
        title: `${qualifier} ${formWord}: ${matchCount} ${word}s match`,
        detail: `${qualifier} asserts that the ${word}s do not overlap (${clause}). ${names} all match, so it reports a violation and still runs the first one, ${verdicts[firstIndex].text}.`,
        deferred: DEFERRED_REPORT_NOTE,
      };
    } else if (qualifier === "priority") silentBecause = `priority allows overlap: it acts on the first match only, ${verdicts[firstIndex].text}, and reports nothing (${clause}).`;
    else silentBecause = `A plain ${formWord} has no check: ${names} all match, the first one, ${verdicts[firstIndex].text}, runs, and nothing is reported (${isIfChain(form) ? "§12.4.1" : "§12.5"}).`;
  } else {
    silentBecause = `Exactly one ${word} matches, so neither check fires: ${verdicts[firstIndex].text} runs and nothing is reported.`;
  }

  const runsSentence =
    runs.kind === "item"
      ? `${capitalize(itemRef(verdicts[runs.index], form))} runs${matchCount > 1 ? `: it is the ${ordinal(runs.index + 1)} ${word} and the first match wins` : ""}.`
      : runs.kind === "catch-all"
        ? `No ${word} matches, so the ${catchWord} runs.`
        : `No ${word} matches and there is no ${catchWord}, so nothing runs.`;
  const matchSentence = matchCount > 1 ? `${matchCount} ${word}s match (${matching.map((v) => v.text).join(", ")}).` : "";
  const reportSentence = report ? `${report.title}. Violation reported in the Observed region (${report.clause}, ${DEFERRED_CLAUSES}).` : "Nothing is reported.";
  const unsupported = verdicts.flatMap((v) => v.terms.filter((t) => t.unsupported).map((t) => t.why));
  const caveat = unsupported.length > 0 ? `Caveat: ${unsupported.length} ${word}${unsupported.length > 1 ? "s" : ""} could not be compared in this form and ${unsupported.length > 1 ? "were" : "was"} left out of the decision.` : "";
  const summary = [runsSentence, matchSentence, reportSentence, caveat].filter(Boolean).join(" ");

  return {
    config,
    items: verdicts,
    expression,
    constantExpression,
    matchCount,
    column,
    runs,
    reportKind: report ? report.kind : "nothing",
    report,
    silentBecause,
    unsupported,
    summary,
  };
}

/** Key of the generated source line that runs, for highlighting. */
export function runningLineKey(result: DecisionResult): string | undefined {
  if (result.runs.kind === "item") return itemKey(result.runs.index);
  if (result.runs.kind === "catch-all") return CATCH_ALL_KEY;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* The outcome grid (the lesson's qualifier × matches figure, made live) */
/* ------------------------------------------------------------------ */

export interface GridCell {
  qualifier: Qualifier;
  column: MatchColumn;
  /** What runs: "nothing", "default", "else", "runs it", "runs first". */
  runs: string;
  reports: boolean;
  text: string;
}

/**
 * One cell of the grid, computed from the same two predicates the decision
 * uses, so the highlighted cell can never contradict the ticket.
 */
export function gridCell(qualifier: Qualifier, column: MatchColumn, catchAll: boolean, form: DecisionForm): GridCell {
  const catchWord = catchAllWord(form);
  if (column === "none") {
    const runs = catchAll ? `${catchWord} runs` : "nothing runs";
    const reports = !catchAll && reportsNoMatch(qualifier);
    return { qualifier, column, runs, reports, text: `${runs}, ${reports ? "report" : "silent"}` };
  }
  if (column === "one") return { qualifier, column, runs: "runs it", reports: false, text: "runs it, silent" };
  const reports = reportsOverlap(qualifier);
  return { qualifier, column, runs: "runs first", reports, text: `runs first, ${reports ? "report" : "silent"}` };
}

export function outcomeGrid(catchAll: boolean, form: DecisionForm): GridCell[][] {
  return QUALIFIERS.map((q) => MATCH_COLUMNS.map((c) => gridCell(q, c, catchAll, form)));
}

/* ------------------------------------------------------------------ */
/* Predictions                                                         */
/* ------------------------------------------------------------------ */

export const runOutcomeId = (o: RunOutcome): string => (o.kind === "item" ? itemKey(o.index) : o.kind);

const sameOutcome = (a: RunOutcome, b: RunOutcome) => runOutcomeId(a) === runOutcomeId(b);

/** The options for "which item runs?": every item, the default/else when present, and "nothing". */
export function runChoices(result: DecisionResult): RunOutcome[] {
  const out: RunOutcome[] = result.items.map((v) => ({ kind: "item", index: v.index }));
  if (result.config.catchAll) out.push({ kind: "catch-all" });
  out.push({ kind: "nothing" });
  return out;
}

export function runChoiceLabel(result: DecisionResult, choice: RunOutcome): string {
  const { form } = result.config;
  if (choice.kind === "item") {
    const v = result.items[choice.index];
    return isIfChain(form) ? `branch ${choice.index + 1}: ${v.label}` : `item ${choice.index + 1}: ${v.label}`;
  }
  if (choice.kind === "catch-all") return `the ${catchAllWord(form)} ${isIfChain(form) ? "branch" : "item"}`;
  return "nothing runs";
}

/**
 * The correct answer when nothing runs: one rule sentence for the whole
 * statement. The per-item detail belongs to the item cards in the reveal.
 */
function nothingRunsRule(result: DecisionResult): string {
  const { form } = result.config;
  const anyX = result.items.some((v) => v.result === "x");
  if (isIfChain(form)) return anyX ? "Every condition is false or x, and an x condition counts as false (§12.4), so nothing runs." : "Every condition is false (§12.4), so nothing runs.";
  if (form === "case-inside") return anyX ? "Every case item fails: each result is 0 or x, and x is no match (§12.5.4), so nothing runs." : "Every case item fails: each result is 0 (§12.5.4), so nothing runs.";
  if (form === "casez") return "Every case item fails: casez skips only z and ? bits, and each item still differs at another bit (§12.5.1), so nothing runs.";
  if (form === "casex") return "Every case item fails: casex skips only x, z and ? bits, and each item still differs at a known bit (§12.5.1), so nothing runs.";
  const literal = result.items.some((v) => v.terms.some((t) => (t.chips ?? []).some((c) => isUnknownBit(c.left) || isUnknownBit(c.right))));
  return literal ? "Every case item fails: a plain case compares x and z literally (§12.5), so nothing runs." : "Every case item fails: none equals the case expression bit for bit (§12.5), so nothing runs.";
}

/**
 * Per-option feedback for "which item runs?". It never says what a qualifier
 * reports: that is the second prediction, and explainReportChoice answers it.
 */
export function explainRunChoice(result: DecisionResult, choice: RunOutcome): { correct: boolean; feedback: string } {
  const { form, qualifier } = result.config;
  const word = itemWord(form);
  const catchWord = catchAllWord(form);
  const first = result.runs.kind === "item" ? result.items[result.runs.index] : null;
  const whyFirst = first ? first.terms.filter((t) => t.result === "1").map((t) => t.why).join(" ") : "";
  const orderClause = isIfChain(form) ? "§12.4.1" : "§12.5";

  if (sameOutcome(choice, result.runs)) {
    if (first) {
      // Qualifier-independent on purpose: no qualifier ever changes which item runs (§12.5.3, §12.4.2).
      const also = result.matchCount > 1 ? ` ${result.matchCount} ${word}s match, and the first one in source order wins (${orderClause}); no qualifier changes that.` : "";
      return { correct: true, feedback: `${whyFirst}${also}`.trim() || `${first.text} matches first (${orderClause}).` };
    }
    if (choice.kind === "catch-all") return { correct: true, feedback: `No ${word} matches, so the ${catchWord} runs (${orderClause}).` };
    return { correct: true, feedback: nothingRunsRule(result) };
  }

  if (choice.kind === "item") {
    const v = result.items[choice.index];
    if (!v.matches) {
      const stamp = v.result === "x" ? (form === "case-inside" ? " An inside result of x is no match (§12.5.4)." : " An x condition is false (§12.4).") : "";
      return { correct: false, feedback: `${v.text} does not match. ${v.terms.map((t) => t.why).join(" ")}${stamp}` };
    }
    // §12.5.3 / §12.4.2: the first match executes under every qualifier. A plain statement has no qualifier to ask about, and compare mode is always plain.
    const next = qualifier === "plain" ? "" : "; the next question asks what it reports";
    return {
      correct: false,
      feedback: `${v.text} does match, but ${first?.text} matches earlier in source order and the first match wins (${orderClause}). No qualifier ever changes which ${branchWord(form)} runs (${qualifierClause(form)})${next}.`,
    };
  }
  if (choice.kind === "catch-all") {
    return { correct: false, feedback: `The ${catchWord} runs only when no ${word} matches. Here ${first?.text} matches: ${whyFirst}` };
  }
  if (first) return { correct: false, feedback: `${first.text} matches, so it runs: ${whyFirst}` };
  return { correct: false, feedback: `No ${word} matches, but the ${catchWord} catches every leftover value, so it runs (${orderClause}).` };
}

export function reportChoiceLabel(kind: ReportKind): string {
  return kind === "nothing" ? "nothing is reported" : kind === "no-match" ? "a no-match violation" : "an overlap violation";
}

/** Per-option feedback for "what is reported?". */
export function explainReportChoice(result: DecisionResult, choice: ReportKind): { correct: boolean; feedback: string } {
  const { form, qualifier, catchAll } = result.config;
  const clause = qualifierClause(form);
  const word = itemWord(form);
  const catchWord = catchAllWord(form);
  const actual = result.reportKind;

  if (choice === actual) {
    if (result.report) return { correct: true, feedback: `${result.report.detail} ${DEFERRED_SENTENCE}` };
    return { correct: true, feedback: result.silentBecause ?? "Nothing is reported." };
  }

  if (choice === "no-match") {
    if (result.matchCount > 0) return { correct: false, feedback: `${result.items[result.runs.kind === "item" ? result.runs.index : 0].text} matches, so there is no missing match to report.${actual === "overlap" ? ` The problem is the opposite one: ${result.matchCount} ${word}s match, which ${qualifier} reports as an overlap (${clause}).` : ""}` };
    if (catchAll) return { correct: false, feedback: `A ${catchWord} is itself an alternative that matches every leftover value, so "no match" can never happen (${clause}). It also silences the check you may have wanted.` };
    if (qualifier === "unique0") return { correct: false, feedback: `unique0 reports overlaps only; a missing match is legal and silent (${clause}).` };
    return { correct: false, feedback: `A plain ${isIfChain(form) ? "if" : FORM_LABELS[form]} has no check. No ${word} matches, nothing runs, and nothing is reported (${isIfChain(form) ? "§12.4" : "§12.5"}).` };
  }

  if (choice === "overlap") {
    if (result.matchCount <= 1) return { correct: false, feedback: `${result.matchCount === 0 ? `No ${word} matches` : `Exactly one ${word} matches`}, so there is no overlap.${actual === "no-match" ? ` ${qualifier} reports the opposite problem: no ${word} matched and there is no ${catchWord} (${clause}).` : ""}` };
    if (qualifier === "priority") return { correct: false, feedback: `priority allows overlap: it acts on the first match only and reports nothing (${clause}).` };
    return { correct: false, feedback: `A plain ${isIfChain(form) ? "if chain" : FORM_LABELS[form]} has no check: the first match runs and nothing is reported (${isIfChain(form) ? "§12.4.1" : "§12.5"}).` };
  }

  // choice === "nothing", but something is reported
  if (actual === "no-match") return { correct: false, feedback: `${qualifier} reports when no ${word} matches and there is no ${catchWord} (${clause}). Nothing runs, but the miss is not silent. ${DEFERRED_SENTENCE}` };
  return { correct: false, feedback: `${qualifier} asserts that no two ${word}s match. ${result.matchCount} do, so it reports an overlap while still running the first one (${clause}). ${DEFERRED_SENTENCE}` };
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export interface DecisionPreset {
  id: string;
  title: string;
  /** Shown before the learner commits: what the statement is and which values to try. Never an outcome. */
  summary: string;
  /** Shown inside the reveal, and only while the statement is still the preset's: what the preset demonstrates. */
  afterReveal: string;
  config: DecisionConfig;
  /** Select values worth trying, as literal bodies (MSB first). The first is the preset's start value. */
  selectOptions: string[];
}

const lit = (text: string): Term => ({ kind: "literal", text });
const bit = (index: number): Term => ({ kind: "bit", index });
const range = (lo: string, hi: string): Term => ({ kind: "range", lo, hi });

const LESSON_DECODER_ITEMS: DecisionItem[] = [
  { terms: [lit("2'b00")], action: "y = 4'b0001;" },
  { terms: [lit("2'b01")], action: "y = 4'b0010;" },
  { terms: [lit("2'b10")], action: "y = 4'b0100;" },
];

const KATA_ITEMS: DecisionItem[] = [...LESSON_DECODER_ITEMS, { terms: [lit("2'b11")], action: "y = 4'b1000;" }];

const LRM_A_ITEMS: DecisionItem[] = [
  { terms: [lit("0"), lit("1")], action: '$display("0 or 1");' },
  { terms: [lit("2")], action: '$display("2");' },
  { terms: [lit("4")], action: '$display("4");' },
];

/** Added to the §12.5.3 presets: the standard declares `bit [2:0] a`, which cannot hold x. */
const LOGIC_NOTE = "The standard declares bit [2:0] a; the lab uses logic so x can be tried.";

const preset = (id: string, title: string, summary: string, afterReveal: string, config: Omit<DecisionConfig, "select"> & { select?: Bit4[] }, selectOptions: string[]): DecisionPreset => ({
  id,
  title,
  summary,
  afterReveal,
  config: { ...config, select: parseBits(selectOptions[0]) },
  selectOptions,
});

export const DECISION_PRESETS: readonly DecisionPreset[] = [
  preset(
    "lesson-decoder",
    "Lesson decoder: unique case (sel), no default",
    "The traced decoder. Try sel = 01, 11 and xx under each qualifier, then add the default.",
    "sel = 01 runs its item silently. 11 and xx match no item, so nothing runs: unique and priority report that, unique0 and plain do not, and a default removes the report (§12.5, §12.5.3).",
    { form: "case", qualifier: "unique", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: LESSON_DECODER_ITEMS },
    ["01", "11", "xx", "00", "10"],
  ),
  preset(
    "casez-overlap",
    "Two wildcard items: casez 2'b1? and 2'b?1",
    "Each item leaves one bit as a don't-care. Try sel = 11, 10, 01 and 00 under each qualifier.",
    "With sel = 11 both items match. Every qualifier runs the first; only unique and unique0 report the overlap (§12.5.3).",
    {
      form: "casez",
      qualifier: "unique",
      catchAll: false,
      selectName: "sel",
      items: [
        { terms: [lit("2'b1?")], action: "y = 4'b0001;" },
        { terms: [lit("2'b?1")], action: "y = 4'b0010;" },
      ],
    },
    ["11", "10", "01", "00"],
  ),
  preset(
    "unique-if",
    "unique if (req[0]) … else if (req[1])",
    "The same checks on an if chain, where a final else plays the part of default (§12.4.2).",
    "req = 11 makes both conditions true: the first branch runs, and unique and unique0 report the overlap. req = 00 makes neither true: unique and priority report that unless a final else is added (§12.4.2).",
    {
      form: "if-else-if",
      qualifier: "unique",
      catchAll: false,
      catchAllAction: "grant = 2'b00;",
      selectName: "req",
      items: [
        { terms: [bit(0)], action: "grant = 2'b01;" },
        { terms: [bit(1)], action: "grant = 2'b10;" },
      ],
    },
    ["10", "11", "00", "01"],
  ),
  preset(
    "one-hot",
    "One-hot select: unique case (1'b1)",
    "A constant case expression (§12.5.2): the items are the bits of gnt. Try gnt = 011, 010 and 000.",
    "gnt = 011 lights two items: the first runs and unique reports the overlap (§12.5.3).",
    {
      form: "case",
      qualifier: "unique",
      catchAll: false,
      catchAllAction: "data_out = '0;",
      selectName: "gnt",
      items: [
        { terms: [bit(0)], action: "data_out = data0;" },
        { terms: [bit(1)], action: "data_out = data1;" },
        { terms: [bit(2)], action: "data_out = data2;" },
      ],
    },
    ["011", "010", "100", "000", "0x1"],
  ),
  preset(
    "priority-encoder",
    "Priority encoder: priority casez (req)",
    "A priority encoder written with casez: each item tests one bit of req. Try req = 0110 and 0000.",
    "The items overlap on purpose and the lowest set bit wins, so priority stays quiet for 0110. req = 0000 matches no item: that is the bug this qualifier catches (§12.5.3).",
    {
      form: "casez",
      qualifier: "priority",
      catchAll: false,
      catchAllAction: "idx = '0;",
      selectName: "req",
      items: [
        { terms: [lit("4'b???1")], action: "idx = 2'd0;" },
        { terms: [lit("4'b??1?")], action: "idx = 2'd1;" },
        { terms: [lit("4'b?1??")], action: "idx = 2'd2;" },
        { terms: [lit("4'b1???")], action: "idx = 2'd3;" },
      ],
    },
    ["0110", "0000", "1000", "1111"],
  ),
  preset(
    "lrm-unique-case",
    "Standard example: unique case (a) with items 0,1 / 2 / 4",
    `From IEEE 1800-2023 §12.5.3. ${LOGIC_NOTE} Try each value of a.`,
    "IEEE 1800-2023 §12.5.3: values 3, 5, 6 and 7 cause a violation report.",
    { form: "case", qualifier: "unique", catchAll: false, selectName: "a", items: LRM_A_ITEMS },
    ["011", "101", "110", "111", "000", "001", "010", "100"],
  ),
  preset(
    "lrm-priority-casez",
    "Standard example: priority casez (a) with 3'b00? / 3'b0??",
    `From IEEE 1800-2023 §12.5.3. ${LOGIC_NOTE} Try each value of a.`,
    "IEEE 1800-2023 §12.5.3: values 4 to 7 cause a violation report; 0 and 1 match both items and run the first.",
    {
      form: "casez",
      qualifier: "priority",
      catchAll: false,
      selectName: "a",
      items: [
        { terms: [lit("3'b00?")], action: '$display("0 or 1");' },
        { terms: [lit("3'b0??")], action: '$display("2 or 3");' },
      ],
    },
    ["100", "000", "011", "111"],
  ),
  preset(
    "lrm-unique0-case",
    "Standard example: unique0 case (a) with items 0,1 / 2 / 4",
    `From IEEE 1800-2023 §12.5.3. ${LOGIC_NOTE} Try each value of a.`,
    "IEEE 1800-2023 §12.5.3: values 3, 5, 6 and 7 do not cause a violation report.",
    { form: "case", qualifier: "unique0", catchAll: false, selectName: "a", items: LRM_A_ITEMS },
    ["011", "101", "110", "111", "000"],
  ),
  preset(
    "kata-c-1",
    "Kata C step 1: unique case (sel) at t = 0, sel = xx",
    "always_comb runs once at time 0 while sel is still x. Predict both answers.",
    "A plain comparison treats x literally, so sel = xx matches no item: nothing runs and unique reports the miss (§12.5, §12.5.3).",
    { form: "case", qualifier: "unique", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-2",
    "Kata C step 2: add default",
    "Same decoder with default: y = 4'b0000. Predict what the default changes.",
    "With a default every value matches something, so there is no no-match violation. The report disappears, and so does your detector for an unknown select (§12.5.3).",
    { form: "case", qualifier: "unique", catchAll: true, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-3",
    "Kata C step 3: unique0, no default",
    "Remove the default and change unique to unique0.",
    "unique0 never reports a missing match, so sel = xx runs nothing and stays silent. It would still report an overlap (§12.5.3).",
    { form: "case", qualifier: "unique0", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-4",
    "Kata C step 4: unique case (sel) inside with 2'b0? / 2'b1?",
    "sel = 1x at 10 ns, then x1 at 20 ns. Predict both answers for each value.",
    "sel = 1x matches 2'b1?: the item's ? makes bit 0 a wildcard, so the select's x there is accepted, silently. sel = x1 has x against a fixed bit in both items: both give x, x is no match, and unique reports (§11.4.6, §12.5.4).",
    {
      form: "case-inside",
      qualifier: "unique",
      catchAll: false,
      catchAllAction: "y = 4'b0000;",
      selectName: "sel",
      items: [
        { terms: [lit("2'b0?")], action: "y = 4'b0011;" },
        { terms: [lit("2'b1?")], action: "y = 4'b1100;" },
      ],
    },
    ["1x", "x1", "xx", "01"],
  ),
  preset(
    "lrm-priority-inside",
    "Standard example: priority case (status) inside",
    "From IEEE 1800-2023 §12.5.4. Try status = 'b0x0, 'b00x and 'bxxx.",
    "IEEE 1800-2023 §12.5.4: 3'b0?0 matches 'b000, 'b010, 'b0x0 and 'b0z0; 'b00x and 'bxxx match nothing and are reported.",
    {
      form: "case-inside",
      qualifier: "priority",
      catchAll: false,
      selectName: "status",
      items: [
        { terms: [lit("1"), lit("3")], action: "task1;" },
        { terms: [lit("3'b0?0"), range("4", "7")], action: "task2;" },
      ],
    },
    ["0x0", "00x", "xxx", "0z0", "001", "011", "010", "101"],
  ),
];

export const DEFAULT_PRESET_ID = DECISION_PRESETS[0].id;

export function findPreset(id: string | undefined): DecisionPreset {
  return DECISION_PRESETS.find((p) => p.id === id) ?? DECISION_PRESETS[0];
}

/** True once the learner has changed what the preset's text describes. A different select value is still the preset's statement. */
export function isPresetEdited(config: DecisionConfig, preset: DecisionPreset): boolean {
  return config.form !== preset.config.form || config.qualifier !== preset.config.qualifier || config.catchAll !== preset.config.catchAll;
}

/** Replaces the preset's text once it is edited, so the page never attributes a claim to a statement no longer shown. */
export const editedPresetNote = (preset: DecisionPreset): string => `Edited from: ${preset.title}. The text below is computed from the statement shown.`;

/** The preset's configuration with another select value (a literal body such as "x1"). */
export function withSelect(config: DecisionConfig, body: string): DecisionConfig {
  return { ...config, select: parseBits(body) };
}

/* ------------------------------------------------------------------ */
/* Compare mode: casex (or casez) beside case inside                   */
/* ------------------------------------------------------------------ */

export type CompareLeftKind = "casex" | "casez";

export interface CompareSet {
  id: string;
  title: string;
  /** Shown before the learner commits. Never an outcome. */
  summary: string;
  /** Shown inside the reveal: what the set demonstrates. */
  afterReveal: string;
  selectName: string;
  items: DecisionItem[];
  catchAll: boolean;
  catchAllAction?: string;
  /** Select values worth trying, as literal bodies (MSB first). The first is the start value. */
  selectOptions: string[];
}

export const COMPARE_SETS: readonly CompareSet[] = [
  {
    id: "casex-vs-inside",
    title: "Items 2'b10 and 2'b11",
    summary: "The lesson's table. Try sel = 1x, x1 and xx in both columns.",
    afterReveal: "In the lesson's table, sel = 1x, x1 and xx run a real branch under casex and match nothing under case inside.",
    selectName: "sel",
    items: [
      { terms: [lit("2'b10")], action: "branch = 1;" },
      { terms: [lit("2'b11")], action: "branch = 2;" },
    ],
    catchAll: false,
    selectOptions: ["1x", "10", "x1", "xx", "1z"],
  },
  {
    id: "wildcard-item",
    title: "One item, 2'b1?",
    summary: "One item with a don't-care in bit 0. Try sel = 1x and x1 in both columns.",
    afterReveal: "The don't-care now sits in the item, where both forms accept it. case inside accepts a select x only there; casex accepts it at every bit (§12.5.1).",
    selectName: "sel",
    items: [{ terms: [lit("2'b1?")], action: "branch = 1;" }],
    catchAll: false,
    selectOptions: ["1x", "10", "x1", "xx"],
  },
  {
    id: "opcode-decoder",
    title: "Opcode decoder (operators lesson)",
    summary: "The lesson's case (op) inside decoder beside the same items written for casex. A range is legal only in case inside, so casex lists its three values.",
    afterReveal: "3'b0x0 is the hazard: it runs NOP under casex and reaches default under case inside, where a testbench can report it (§12.5.1, §12.5.4).",
    selectName: "op",
    items: [
      { terms: [lit("3'b000")], action: "cls = NOP;", label: "NOP" },
      { terms: [lit("3'b001"), lit("3'b010")], action: "cls = RW;", label: "RW" },
      { terms: [range("3'b100", "3'b110")], action: "cls = ALU;", label: "ALU" },
      { terms: [lit("3'b11?")], action: "cls = JUMP;", label: "JUMP" },
    ],
    catchAll: true,
    catchAllAction: "cls = ILLEGAL;",
    selectOptions: ["0x0", "001", "101", "110", "111", "011", "1x0"],
  },
];

export function findCompareSet(id: string | undefined): CompareSet {
  return COMPARE_SETS.find((s) => s.id === id) ?? COMPARE_SETS[0];
}

export interface CompareResult {
  left: DecisionResult;
  right: DecisionResult;
  /** True when a range had to be listed as plain items for the left column. */
  leftExpanded: boolean;
}

export function compareConfig(set: CompareSet, select: Bit4[], form: DecisionForm): DecisionConfig {
  return { form, qualifier: "plain", catchAll: set.catchAll, catchAllAction: set.catchAllAction, selectName: set.selectName, select, items: set.items };
}

/** The asymmetric wildcard rule (§11.4.6), which compare mode states inside the reveal. */
export const WILDCARD_ASYMMETRY_NOTE = "Wildcards are asymmetric in case inside: x, z and ? in an item match anything; an x or z in the select matches only a wildcard (§11.4.6).";

/** Runs the same items as `casex` (or `casez`) and as `case inside`, on one select. */
export function compareDecisions(set: CompareSet, select: Bit4[], leftKind: CompareLeftKind): CompareResult {
  return {
    left: evaluateDecision(compareConfig(set, select, leftKind)),
    right: evaluateDecision(compareConfig(set, select, "case-inside")),
    leftExpanded: set.items.some((item) => item.terms.some((t) => t.kind === "range")),
  };
}
