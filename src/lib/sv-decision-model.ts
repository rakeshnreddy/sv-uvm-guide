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
 * - A violation is reported as a ticket. At run time a simulator holds the
 *   report until the Observed region and words it in its own way (§12.4.2.1,
 *   §12.5.3.1). §12.5.3 also allows a case violation to be reported at compile
 *   time when it can be determined then; the lab shows the run-time path.
 * - One execution of the statement is modelled. A pending report is discarded
 *   if the procedure reaches a flush point before the Observed region of that
 *   time step, for example when an always_comb runs again (§12.4.2.1,
 *   §12.5.3.1); that case is declared to learners, not simulated.
 */

import {
  bitsToString,
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
 * (no final else); unique0 does not (§12.5.3; §12.4.2 for if chains). A default
 * or else does not match anything: no item matches, the catch-all runs, and the
 * report is not issued (see `noMatchClause` for what each clause says).
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

/**
 * What to cite for "a catch-all removes the no-match report". §12.4.2 states
 * the exception in words. §12.5.3 only says "if no case_item matches": for a
 * case the exception follows from §12.5 (the default is not part of the search,
 * and runs when all comparisons fail) together with the grammar, where default
 * is a form of case_item. So a case cites both clauses.
 */
export const noMatchClause = (form: DecisionForm): string => (isIfChain(form) ? "§12.4.2" : "§12.5, §12.5.3");

/** The catch-all with its article: "a default", "an else". */
const catchAllPhrase = (form: DecisionForm): string => (isIfChain(form) ? "an else" : "a default");

/** Names the form in a sentence that compare mode could show in both columns. An if chain never appears there. */
const underForm = (form: DecisionForm): string => (isIfChain(form) ? "" : ` under ${FORM_LABELS[form]}`);

/**
 * `case`, as against casez and casex. Not "a plain case": the lab uses plain for
 * the unqualified statement, and this rule holds under every qualifier (§12.5).
 */
const LITERAL_CASE = "case (not casez or casex)";

/** The word for one alternative in this form. */
export const itemWord = (form: DecisionForm): "case item" | "condition" => (isIfChain(form) ? "condition" : "case item");

/** The word for what executes. In an if chain conditions match and branches run (§12.4). */
export const branchWord = (form: DecisionForm): "case item" | "branch" => (isIfChain(form) ? "branch" : "case item");

/** The column headers of the outcome grid, in this form's vocabulary. */
export function matchColumnLabel(column: MatchColumn, form: DecisionForm): string {
  const word = itemWord(form);
  return column === "none" ? `no ${word} matches` : column === "one" ? `one ${word} matches` : "two or more match";
}

/**
 * Where the timing rule lives. §12.4.2.1 holds it (the check is evaluated when
 * the statement executes, the report is deferred to the Observed region) and
 * covers if chains only; §12.5.3.1 applies it to a case and points back to
 * §12.4.2.1. So an if chain cites one clause and a case both.
 */
export const deferredClauses = (form: DecisionForm): string => (isIfChain(form) ? "§12.4.2.1" : "§12.4.2.1, §12.5.3.1");

/** The ticket's timing line, in this form's clauses. */
export const deferredReportNote = (form: DecisionForm): string => `checked now, reported in the Observed region (${deferredClauses(form)})`;

/** The timing line of a case-statement ticket. */
export const DEFERRED_REPORT_NOTE = deferredReportNote("case");

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

/** True when an if chain writes this term with ==? (a literal holding x, z or ?); any other literal is written with ==. */
export const usesWildcardEquality = (term: Term): boolean => term.kind === "literal" && /[xXzZ?]/.test(term.text);

/** How a term is written as an if condition. */
export function conditionText(term: Term, selectName: string): string {
  if (term.kind === "literal") return `${selectName} ${usesWildcardEquality(term) ? "==?" : "=="} ${term.text}`;
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
  const illegal = (item: DecisionItem) => (isCaseFamily(form) && item.terms.some((t) => t.kind === "range") ? " // not legal here: a range needs case inside (§12.5, §12.5.4)" : "");
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
   * case-family statement that cannot be listed as plain items (§12.5, §12.5.4).
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

/**
 * Names the select's skipped bits by their value. x and z are different values
 * to these statements: casez skips only z, casex skips both (§12.5.1).
 */
function skippedSelectClause(kind: CaseKind, skipped: readonly BitChip[]): string {
  const fromSelect = skipped.filter((c) => (kind === "casex" ? isUnknownBit(c.left) : c.left === "z"));
  if (fromSelect.length === 0) return "";
  const values = (["x", "z"] as const).filter((value) => fromSelect.some((c) => c.left === value));
  return `, including the ${values.join(" and ")} bit${fromSelect.length > 1 ? "s" : ""} of the select itself`;
}

function describeCaseChips(kind: CaseKind, chips: BitChip[], literal: string, matched: boolean): string {
  if (matched) {
    const skipped = chips.filter((c) => c.verdict === "skip");
    if (skipped.length === 0) return `${literal} matches bit for bit (§12.5).`;
    return `${literal} matches: ${kind} skips bit${skipped.length > 1 ? "s" : ""} ${bitList(skipped)}${skippedSelectClause(kind, skipped)} (§12.5.1).`;
  }
  const bad = chips.find((c) => c.verdict === "0");
  if (!bad) return `${literal} does not match.`;
  const note =
    kind === "case" && (isUnknownBit(bad.left) || isUnknownBit(bad.right))
      ? ` ${LITERAL_CASE} compares x and z literally (§12.5).`
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
      // The restriction is the grammar of §12.5 (Syntax 12-3: case_item_expression is an expression, case_inside_item a range_list); §12.5.4 defines the range_list comparison.
      why: `Not comparable: a range is legal only in case inside (§12.5, §12.5.4), and ${text} cannot be written as plain ${kind} items because ${problem}. This item is left out of the decision.`,
    };
  }
  const right = term.kind === "literal" ? parseLiteral(term.text, expr.length) : [bitAt(config.select, term.index)];
  const matched = caseItemMatches(kind, expr, right);
  const chips = caseBitChips(kind, expr, right);
  // A bit-select listed beside literals is compared with the select itself, like a literal: the case expression is 1'b1 only when every item is a bit-select.
  if (term.kind === "literal" || !usesConstantExpression(config.items)) return { term, text, result: matched ? "1" : "0", chips, why: describeCaseChips(kind, chips, text, matched) };
  // A bit-select item against the constant case expression 1'b1 (§12.5.2).
  const b = right[0];
  let why: string;
  if (matched && chips[0].verdict === "skip") why = `${text} is ${b}: ${kind} treats it as a don't-care, so it matches the case expression 1'b1 (§12.5.1).`;
  else if (matched) why = `${text} is 1, which matches the case expression 1'b1 (§12.5.2).`;
  else {
    const note = isUnknownBit(b) ? (kind === "case" ? `; ${LITERAL_CASE} compares x and z literally (§12.5)` : "; casez skips only z, so x must match exactly (§12.5.1)") : "";
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
      ? `${text} is ${b}; as the right operand of ==? ${b === "x" ? "an x" : "a z"} bit is a wildcard, so the constant 1'b1 matches (§11.4.6). ${LITERAL_CASE} would compare the ${b} literally and not match (§12.5).`
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
 * case inside (§12.5, §12.5.4), so the case family lists its values as plain items
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
  /** Timing of the report: `deferredReportNote(form)` (§12.4.2.1; §12.5.3.1 for a case). */
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
  /** Text alternative for the whole outcome, for the live line. */
  summary: string;
  /** Only what ran, for the visible outcome line: the ticket and the feedback carry the rest. */
  ranLine: string;
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

/**
 * Whether the reveal draws this term's chip table: every term of a plain miss
 * (inside its fold), otherwise only a term that matched or gave x.
 */
export const drawsChips = (v: ItemVerdict, t: TermVerdict): boolean => t.chips !== null && (isPlainMiss(v) || t.result !== "0");

/** The marks the reveal's chip tables draw, beyond 1 and 0, so the legend lists only those (visual-language: a legend lists only what the figure draws). */
export interface ChipMarks {
  /** – : a casez or casex do-not-care bit (§12.5.1). case and the ==? forms never skip. */
  skip: boolean;
  /** x : an ambiguous ==, ==? or inside bit (§11.4.5, §11.4.6). The case family never gives x (§12.5). */
  unknown: boolean;
  /** ? : an x or z in the right operand of ==? (§11.4.6). The case family has no wildcard mark: casez and casex skip instead. */
  wildcard: boolean;
  /** A ? written in a compared literal, which its chips show as z. */
  questionMark: boolean;
}

/** The chip marks drawn for one result, or for the two columns of compare mode together. */
export function chipMarks(...results: readonly DecisionResult[]): ChipMarks {
  const terms = results.flatMap((r) => r.items.flatMap((v) => v.terms.filter((t) => drawsChips(v, t))));
  const chips = terms.flatMap((t) => t.chips ?? []);
  return {
    skip: chips.some((c) => c.verdict === "skip"),
    unknown: chips.some((c) => c.verdict === "x"),
    wildcard: chips.some((c) => c.wildcard),
    questionMark: terms.some((t) => t.term.kind === "literal" && t.term.text.includes("?")),
  };
}

/** One line on why a plain miss fails, for the folded view of its item card. */
export function itemMissLine(v: ItemVerdict): string {
  if (v.terms.length > 1) return `all ${v.terms.length} comparisons fail`;
  const t = v.terms[0];
  if (t.term.kind === "bit") return `${t.text} is ${t.chips ? t.chips[t.chips.length - 1].right : "0"}`;
  const bad = t.chips?.find((c) => c.verdict === "0");
  if (bad) return `fails at bit ${bad.index}`;
  return t.term.kind === "range" ? "outside the range" : "does not match";
}

/** Why one match stays silent, in terms of the checks this qualifier has (§12.5.3, §12.4.2). */
function oneMatchSilence(qualifier: Qualifier, word: string, formWord: string, plainClause: string, clause: string): string {
  if (qualifier === "plain") return `Exactly one ${word} matches, and a plain ${formWord} has no checks, so nothing is reported (${plainClause}).`;
  const missing = reportsNoMatch(qualifier);
  const overlap = reportsOverlap(qualifier);
  const nothingToReport = missing && overlap ? "neither a missing match nor an overlap" : missing ? "no missing match" : "no overlap";
  return `Exactly one ${word} matches, so ${qualifier} has ${nothingToReport} to report (${clause}).`;
}

/** "both" for two items, "all" for more. */
const allOf = (count: number): string => (count === 2 ? "both" : "all");

/**
 * The verb for several items that fit the select. unique and unique0 keep
 * comparing after the first match (§12.5.3, §12.4.2), so the later items do
 * match. A plain or priority statement stops at the first match (§12.5,
 * §12.4.1) and never compares them: they only fit the select (in an if chain,
 * the conditions hold), which is what `laterMatchBadge` says on their cards.
 */
const fitVerb = (form: DecisionForm, qualifier: Qualifier): string => (reportsOverlap(qualifier) ? "match" : isIfChain(form) ? "hold" : "fit the select");

/**
 * Why a statement that fell through to its catch-all reports nothing. The
 * catch-all does not match anything (§12.5, §12.4.2); only a qualifier with a
 * missing-match check loses something to it.
 */
function catchAllSilence(qualifier: Qualifier, form: DecisionForm): string {
  const catchWord = catchAllWord(form);
  if (reportsNoMatch(qualifier)) return `No ${itemWord(form)} matches, but there is ${catchAllPhrase(form)}: it runs, and ${qualifier} reports a missing match only when there is no ${catchWord} (${noMatchClause(form)}).`;
  if (qualifier === "unique0") return `The ${catchWord} runs, and unique0 has no check for a missing match (${qualifierClause(form)}).`;
  return `The ${catchWord} runs, and a plain ${isIfChain(form) ? "if" : FORM_LABELS[form]} has no check for a missing match (${isIfChain(form) ? "§12.4" : "§12.5"}).`;
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
    if (catchAll) silentBecause = catchAllSilence(qualifier, form);
    else if (reportsNoMatch(qualifier)) {
      report = {
        kind: "no-match",
        clause,
        title: `${qualifier} ${formWord}: no ${word} matches`,
        detail: `${qualifier} reports when no ${word} matches and there is no ${catchWord} (${noMatchClause(form)}).`,
        deferred: deferredReportNote(form),
      };
    } else if (qualifier === "unique0") silentBecause = `unique0 does not report a missing match; it checks only for overlap (${clause}).`;
    else silentBecause = isIfChain(form) ? "No condition is true and there is no else, so nothing runs and nothing is reported (§12.4)." : "No item matches and there is no default, so nothing runs and nothing is reported (§12.5).";
  } else if (column === "many") {
    const names = matching.map((v) => v.text).join(", ");
    if (reportsOverlap(qualifier)) {
      report = {
        kind: "overlap",
        clause,
        title: `${qualifier} ${formWord}: ${matchCount} ${word}s match`,
        detail: `${qualifier} asserts that the ${word}s do not overlap (${clause}). ${names} ${allOf(matchCount)} match, so it reports a violation.`,
        deferred: deferredReportNote(form),
      };
    } else if (qualifier === "priority") silentBecause = `priority allows overlap: it acts on the first match only, ${verdicts[firstIndex].text}, and reports nothing (${clause}).`;
    else silentBecause = `A plain ${formWord} has no check: ${names} ${allOf(matchCount)} ${fitVerb(form, qualifier)}, the first one, ${verdicts[firstIndex].text}, runs, and nothing is reported (${isIfChain(form) ? "§12.4.1" : "§12.5"}).`;
  } else {
    silentBecause = oneMatchSilence(qualifier, word, formWord, isIfChain(form) ? "§12.4" : "§12.5", clause);
  }

  const runsSentence =
    runs.kind === "item"
      ? `${capitalize(itemRef(verdicts[runs.index], form))} runs${matchCount > 1 ? `: it is the ${ordinal(runs.index + 1)} ${word} and the first match wins` : ""}.`
      : runs.kind === "catch-all"
        ? `No ${word} matches, so the ${catchWord} runs.`
        : `No ${word} matches and there is no ${catchWord}, so nothing runs.`;
  const matchSentence = matchCount > 1 ? `${matchCount} ${word}s ${fitVerb(form, qualifier)} (${matching.map((v) => v.text).join(", ")}).` : "";
  const reportSentence = report ? `${report.title}. Violation reported in the Observed region (${report.clause}, ${deferredClauses(form)}).` : "Nothing is reported.";
  const unsupported = verdicts.flatMap((v) => v.terms.filter((t) => t.unsupported).map((t) => t.why));
  const caveat = unsupported.length > 0 ? `Caveat: ${unsupported.length} ${word}${unsupported.length > 1 ? "s" : ""} could not be compared in this form and ${unsupported.length > 1 ? "were" : "was"} left out of the decision.` : "";
  const summary = [runsSentence, matchSentence, reportSentence, caveat].filter(Boolean).join(" ");
  const ranLine = runs.kind === "item" ? `${capitalize(itemRef(verdicts[runs.index], form))} runs.` : runs.kind === "catch-all" ? `The ${catchWord} runs.` : "Nothing runs.";

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
    ranLine,
  };
}

/**
 * The badge of a later item that also fits the select. unique and unique0 keep
 * comparing after the first match (§12.5.3, §12.4.2), so they do find it. A plain
 * or priority statement stops at the first match (§12.5, §12.4.1), so it never
 * compares that item.
 */
export function laterMatchBadge(form: DecisionForm, qualifier: Qualifier): string {
  if (reportsOverlap(qualifier)) return "matches, not run (the first match wins)";
  return isIfChain(form) ? "would also match; the chain ended at the first match (§12.4.1)" : "would also match; the search stopped at the first match (§12.5)";
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
  /** What runs: "nothing runs", "default runs", "else runs", "runs it" or "runs first". */
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
  return literal ? `Every case item fails: ${LITERAL_CASE} compares x and z literally (§12.5), so nothing runs.` : "Every case item fails: none equals the case expression bit for bit (§12.5), so nothing runs.";
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
  const whyFirst = first ? distinctSentences(first.terms.filter((t) => t.result === "1").map((t) => t.why)) : "";
  const orderClause = isIfChain(form) ? "§12.4.1" : "§12.5";
  // unique and unique0 may compare in any order, so "the first in source order runs" is their own clause's rule (§12.5.3, §12.4.2), not the linear search's.
  const firstWinsClause = reportsOverlap(qualifier) ? `${orderClause}, ${qualifierClause(form)}` : orderClause;

  if (sameOutcome(choice, result.runs)) {
    if (first) {
      // The outcome is qualifier-independent on purpose: no qualifier ever changes which item runs (§12.5.3, §12.4.2).
      // Names the form, because compare mode shows this sentence for both columns.
      const also = result.matchCount > 1 ? ` ${result.matchCount} ${isIfChain(form) ? "conditions" : `${FORM_LABELS[form]} items`} ${fitVerb(form, qualifier)}, and the first one in source order wins (${firstWinsClause}); no qualifier changes that.` : "";
      return { correct: true, feedback: `${whyFirst}${also}`.trim() || `${first.text} matches first (${orderClause}).` };
    }
    if (choice.kind === "catch-all") return { correct: true, feedback: `No ${isIfChain(form) ? word : `${FORM_LABELS[form]} item`} matches, so the ${catchWord} runs (${orderClause}).` };
    return { correct: true, feedback: nothingRunsRule(result) };
  }

  if (choice.kind === "item") {
    const v = result.items[choice.index];
    if (!v.matches) {
      // A bare bit or an == condition already says in its own explanation that x is false; ==? and a range explain only why the result is x.
      const ifRuleTold = v.terms.some((t) => t.result === "x" && (t.term.kind === "bit" || (t.term.kind === "literal" && !usesWildcardEquality(t.term))));
      const stamp = v.result !== "x" ? "" : form === "case-inside" ? " An inside result of x is no match (§12.5.4)." : ifRuleTold ? "" : " An x condition is false (§12.4).";
      return { correct: false, feedback: distinctSentences([`${v.text} does not match${underForm(form)}.`, ...v.terms.map((t) => t.why), stamp]) };
    }
    // §12.5.3 / §12.4.2: the first match executes under every qualifier. A plain statement has no qualifier to ask about, and compare mode is always plain.
    const next = qualifier === "plain" ? "" : "; the next question asks what it reports";
    return {
      correct: false,
      feedback: `${v.text} does match${underForm(form)}, but ${first?.text} matches earlier in source order${next}.`,
    };
  }
  // The correct option's feedback is always shown beside a wrong one, so a wrong one only names the misconception.
  // Each names the form: compare mode can show the same wrong pick in both columns' prompts.
  if (choice.kind === "catch-all") return { correct: false, feedback: `The ${catchWord} runs only when no ${isIfChain(form) ? word : `${FORM_LABELS[form]} item`} matches, and one does here.` };
  if (first) return { correct: false, feedback: `Something does run${underForm(form)}, because ${first.text} matches.` };
  return { correct: false, feedback: `With ${catchAllPhrase(form)} in place, ${isIfChain(form) ? "an if chain" : `a ${FORM_LABELS[form]} statement`} always runs something.` };
}

export function reportChoiceLabel(kind: ReportKind): string {
  return kind === "nothing" ? "nothing is reported" : kind === "no-match" ? "a no-match violation" : "an overlap violation";
}

/** Per-option feedback for "what is reported?". */
export function explainReportChoice(result: DecisionResult, choice: ReportKind): { correct: boolean; feedback: string } {
  const { form, qualifier, catchAll } = result.config;
  const clause = qualifierClause(form);
  const word = itemWord(form);
  const actual = result.reportKind;

  // The correct option's feedback is always on screen, and the ticket carries the clause and the timing. A wrong option only names the misconception.
  if (choice === actual) return { correct: true, feedback: result.report ? result.report.detail : (result.silentBecause ?? "Nothing is reported.") };

  if (choice === "no-match") {
    if (result.matchCount > 0) return { correct: false, feedback: `${result.items[result.runs.kind === "item" ? result.runs.index : 0].text} matches, so there is no missing match to report.${actual === "overlap" ? " The problem is the opposite one." : ""}` };
    if (catchAll) {
      // Only a qualifier that has the check can lose it to a catch-all (§12.5.3, §12.4.2).
      if (reportsNoMatch(qualifier)) return { correct: false, feedback: `${capitalize(catchAllPhrase(form))} silences the missing-match check, which may be the check you wanted.` };
      const who = qualifier === "unique0" ? "unique0" : `A plain ${isIfChain(form) ? "if chain" : FORM_LABELS[form]}`;
      return { correct: false, feedback: `${who} reports no missing match, with or without ${catchAllPhrase(form)}.` };
    }
    if (qualifier === "unique0") return { correct: false, feedback: "unique0 has no check for a missing match." };
    return { correct: false, feedback: `A plain ${isIfChain(form) ? "if chain" : FORM_LABELS[form]} has no check, so a missing match goes unreported.` };
  }

  if (choice === "overlap") {
    if (result.matchCount <= 1) return { correct: false, feedback: `${result.matchCount === 0 ? `No ${word} matches` : `Exactly one ${word} matches`}, so there is no overlap.${actual === "no-match" ? " The problem is the opposite one." : ""}` };
    if (qualifier === "priority") return { correct: false, feedback: "priority has no check for overlap." };
    return { correct: false, feedback: `A plain ${isIfChain(form) ? "if chain" : FORM_LABELS[form]} has no check for overlap.` };
  }

  // choice === "nothing", but something is reported
  if (actual === "no-match") return { correct: false, feedback: `The miss is not silent: ${qualifier} checks for it.` };
  return { correct: false, feedback: `${qualifier} checks for this: ${result.matchCount} ${word}s match, and running the first one (${clause}) does not hide the overlap.` };
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export interface DecisionPreset {
  id: string;
  title: string;
  /** Shown before the learner commits: what the statement is and which values to try. Never an outcome. */
  summary: string;
  /**
   * Shown inside the reveal while the statement is still the preset's: what this
   * one select value demonstrates, by literal body. A line never states the
   * outcome of another listed value, because the learner has yet to predict it.
   */
  valueNotes: Readonly<Record<string, string>>;
  /** The whole preset's lesson, shown only once every listed value has been revealed. */
  wrapUp: string;
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

const preset = (id: string, title: string, summary: string, valueNotes: Record<string, string>, wrapUp: string, config: Omit<DecisionConfig, "select"> & { select?: Bit4[] }, selectOptions: string[]): DecisionPreset => ({
  id,
  title,
  summary,
  valueNotes,
  wrapUp,
  config: { ...config, select: parseBits(selectOptions[0]) },
  selectOptions,
});

export const DECISION_PRESETS: readonly DecisionPreset[] = [
  preset(
    "lesson-decoder",
    "Lesson decoder: unique case (sel), no default",
    "The traced decoder. Try sel = 01, 11 and xx, then try each qualifier and the default under Change the statement.",
    {
      "01": "The decoder's normal path: a known value with its own item.",
      "11": "A known value the decoder never listed: this is a real hole in the decoder, and the report is how you find it.",
      "xx": "The report is your early warning of an unknown select: without it, the x would pass unseen.",
      "00": "Another known value with its own item. Next, try a qualifier or the default under Change the statement.",
      "10": "Another known value with its own item. Next, try a qualifier or the default under Change the statement.",
    },
    "A value with its own item runs silently. A value with no item runs nothing: unique and priority report that, unique0 and plain do not, and a default removes the report (§12.5, §12.5.3).",
    { form: "case", qualifier: "unique", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: LESSON_DECODER_ITEMS },
    ["01", "11", "xx", "00", "10"],
  ),
  preset(
    "casez-overlap",
    "Two wildcard items: casez 2'b1? and 2'b?1",
    "Each item leaves one bit as a don't-care. Try sel = 11, 10, 01 and 00 under each qualifier.",
    {
      "11": "Each pattern's fixed bit agrees with this value, so the don't-care bit lets both through.",
      "10": "Bit 0 rules out 2'b?1, so 2'b1? is alone here.",
      "01": "Bit 1 rules out 2'b1?, so a later item runs with no overlap to report.",
      "00": "Each pattern fixes one bit to 1, and this value has neither.",
    },
    "When both patterns accept a value, every qualifier runs the first; only unique and unique0 report the overlap (§12.5.3).",
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
    {
      "10": "One true condition: the result does not depend on the order, and unique may evaluate its conditions in any order (§12.4.2).",
      "11": "unique says the conditions are mutually exclusive, and this value breaks that promise (§12.4.2).",
      "00": "A final else would catch this value and remove the report (§12.4.2). Try it under Change the statement.",
      "01": "Only the first condition holds, so the chain has one branch to take.",
    },
    "With both conditions true, the first branch runs, and unique and unique0 report the overlap. With neither true, unique and priority report that unless a final else is added (§12.4.2).",
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
    {
      "011": "Two grant bits are set, which a one-hot select must never allow: this is the bug the qualifier guards against.",
      "010": "Properly one-hot: one bit set, one item chosen.",
      "100": "Properly one-hot, so the order of the items makes no difference.",
      "000": "No grant at all. If an idle gnt were legal, unique0 or a default would keep this quiet (§12.5, §12.5.3).",
      "0x1": "gnt[1] is compared literally with 1'b1 and fails (§12.5), so the unknown grant bit goes unnoticed.",
    },
    "A one-hot case (1'b1) checks the grant vector: two bits set light two items, the first runs, and unique reports the overlap (§12.5.3).",
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
    {
      "0110": "The items overlap on purpose: source order is the priority order, and the lowest set bit wins.",
      "0000": "No bit is set, so no item can accept it: this is the bug this qualifier catches (§12.5.3).",
      "1000": "Only bit 3 is set, so the search reaches the last item.",
      "1111": "Every item accepts this value, and priority acts on the first match only (§12.5.3).",
    },
    "priority lets the items overlap and reports when no item matches (§12.5.3). Here that is the thing this encoder must not do: see a request with no bit set.",
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
    {
      "011": "The standard names this value among those that cause a violation report (§12.5.3).",
      "101": "The standard names this value among those that cause a violation report (§12.5.3).",
      "110": "The standard names this value among those that cause a violation report (§12.5.3).",
      "111": "The standard names this value among those that cause a violation report (§12.5.3).",
      "000": "The first item lists two expressions. A single item with two expressions is not an overlap (§12.5.3).",
      "001": "The first item lists two expressions. A single item with two expressions is not an overlap (§12.5.3).",
      "010": "One item holds this value, so the check has nothing to report.",
      "100": "One item holds this value, so the check has nothing to report.",
    },
    "IEEE 1800-2023 §12.5.3: values 3, 5, 6 and 7 cause a violation report.",
    { form: "case", qualifier: "unique", catchAll: false, selectName: "a", items: LRM_A_ITEMS },
    ["011", "101", "110", "111", "000", "001", "010", "100"],
  ),
  preset(
    "lrm-priority-casez",
    "Standard example: priority casez (a) with 3'b00? / 3'b0??",
    `From IEEE 1800-2023 §12.5.3. ${LOGIC_NOTE} Try each value of a.`,
    {
      "100": "Both items need bit 2 to be 0. The standard names this value among those that cause a violation report (§12.5.3).",
      "111": "Both items need bit 2 to be 0. The standard names this value among those that cause a violation report (§12.5.3).",
      "000": "Both items accept this value, and priority acts on the first match only (§12.5.3).",
      "011": "3'b00? needs bit 1 to be 0, so 3'b0?? is the only item left.",
    },
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
    {
      "011": "The same statement under unique would report this value; the standard says unique0 does not (§12.5.3).",
      "101": "The same statement under unique would report this value; the standard says unique0 does not (§12.5.3).",
      "110": "The same statement under unique would report this value; the standard says unique0 does not (§12.5.3).",
      "111": "The same statement under unique would report this value; the standard says unique0 does not (§12.5.3).",
      "000": "One item accepts this value, and unique0 is still watching for overlap (§12.5.3).",
    },
    "IEEE 1800-2023 §12.5.3: values 3, 5, 6 and 7 do not cause a violation report.",
    { form: "case", qualifier: "unique0", catchAll: false, selectName: "a", items: LRM_A_ITEMS },
    ["011", "101", "110", "111", "000"],
  ),
  preset(
    "kata-c-1",
    "Kata C step 1: unique case (sel) at t = 0, sel = xx",
    "always_comb runs once at time 0 while sel is still x. Predict both answers.",
    {
      "xx": "In the kata this happens at time 0, before anything has driven sel.",
      "01": "By t = 10 ns sel is known, and one item covers it.",
    },
    "case compares x literally, so an unknown select matches no item, and unique turns the miss into a report (§12.5, §12.5.3).",
    { form: "case", qualifier: "unique", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-2",
    "Kata C step 2: add default",
    "Same decoder with default: y = 4'b0000. Predict what the default changes.",
    {
      "xx": "The report is gone, and so is your detector for an unknown select (§12.5, §12.5.3).",
      "01": "With a known select that has its own item, the default is not reached.",
    },
    "A quiet statement is not proof that the select was known: the default takes the x and says nothing.",
    { form: "case", qualifier: "unique", catchAll: true, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-3",
    "Kata C step 3: unique0, no default",
    "Remove the default and change unique to unique0.",
    {
      "xx": "The unknown select passes unseen here: nothing tells you it happened.",
      "01": "One item accepts this value, so there is no overlap for unique0 to see.",
    },
    "unique0 gives up the no-match check and keeps the overlap check, so an unknown select needs another detector (§12.5.3).",
    { form: "case", qualifier: "unique0", catchAll: false, catchAllAction: "y = 4'b0000;", selectName: "sel", items: KATA_ITEMS },
    ["xx", "01"],
  ),
  preset(
    "kata-c-4",
    "Kata C step 4: unique case (sel) inside with 2'b0? / 2'b1?",
    "sel = 1x at 10 ns, then x1 at 20 ns. Predict both answers for each value.",
    {
      "1x": "The item's ? makes bit 0 a wildcard, so the select's x there is accepted, silently (§11.4.6).",
      "x1": "Bit 1 is x against a fixed bit in both items: both give x, and x is no match (§11.4.6, §12.5.4).",
      "xx": "The wildcards cover bit 0, but bit 1 is x against a fixed bit in both items (§11.4.6).",
      "01": "A known select falls under one pattern; its ? accepts whatever bit 0 holds.",
    },
    "An x under an item's wildcard is accepted silently. An x against a fixed bit gives x, x is no match, and unique reports the miss (§11.4.6, §12.5.4).",
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
    {
      "0x0": "The standard lists this value under 3'b0?0: the ? covers the x (§12.5.4).",
      "00x": "The x sits at bit 0, which 3'b0?0 fixes, so no comparison succeeds. The standard lists this value as a failure (§12.5.4).",
      "xxx": "The standard's own failing example: an all-unknown select gives x from the range and from every literal (§11.4.4, §11.4.6, §12.5.4).",
      "0z0": "The standard lists this value under 3'b0?0: the ? covers a z in the select as well (§12.5.4).",
      "001": "This value equals the first expression of the first item (§12.5.4).",
      "011": "This value equals the second expression of the first item: one item can list several (§12.5.4).",
      "010": "The ? in 3'b0?0 covers bit 1, so this known value is accepted too (§12.5.4).",
      "101": "The range [4:7] holds this value: it is compared with <= and >= (§11.4.13).",
    },
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

/** An MDX typo must not pass unseen: the fallback content would look like the right content. */
function warnUnknownId(kind: string, id: string, ids: readonly string[]) {
  if (process.env.NODE_ENV !== "production") console.warn(`DecisionLab: unknown ${kind} "${id}", using "${ids[0]}". Known: ${ids.join(", ")}.`);
}

export function findPreset(id: string | undefined): DecisionPreset {
  const found = DECISION_PRESETS.find((p) => p.id === id);
  if (!found && id !== undefined) warnUnknownId("preset", id, DECISION_PRESETS.map((p) => p.id));
  return found ?? DECISION_PRESETS[0];
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

/** For a value the learner built bit by bit: it is on no list, so no list's line applies. */
export const OWN_VALUE_NOTE = "This value is not on the list, so it does not count toward the values to try. Everything here is computed from the statement shown.";

/** The note for one select value under the preset's own statement. */
export const presetValueNote = (preset: DecisionPreset, body: string): string => preset.valueNotes[body] ?? OWN_VALUE_NOTE;

/* ------------------------------------------------------------------ */
/* The walk through a preset's values                                  */
/* ------------------------------------------------------------------ */

export interface TriedProgress {
  count: number;
  total: number;
  complete: boolean;
}

/** How many listed values have been revealed. A value on no list does not count. */
export function triedProgress(options: readonly string[], tried: readonly string[]): TriedProgress {
  const count = options.filter((body) => tried.includes(body)).length;
  return { count, total: options.length, complete: count === options.length };
}

/** The value after `current` in list order, preferring one not yet tried. A value on no list starts from the top. */
export function nextSelectValue(options: readonly string[], current: string, tried: readonly string[] = []): string {
  const at = options.indexOf(current);
  const order = [...options.slice(at + 1), ...options.slice(0, at + 1)].filter((body) => body !== current);
  return order.find((body) => !tried.includes(body)) ?? order[0] ?? current;
}

/* ------------------------------------------------------------------ */
/* One statement of each fact                                          */
/* ------------------------------------------------------------------ */

/** Splits prose into sentences. Clause numbers survive: the dots in §12.5.3 have no space after them. A ? is an operand or the ==? operator here, never an ending. */
export const splitSentences = (text: string): string[] =>
  text
    .replace(/\.\s+/g, ".\u0000")
    .split("\u0000")
    .map((t) => t.trim())
    .filter(Boolean);

/** Joins explanations into one paragraph, keeping each sentence once: several terms of one item can give the same reason. */
export const distinctSentences = (texts: readonly string[]): string => Array.from(new Set(texts.flatMap(splitSentences))).join(" ");

/**
 * Each term's explanation without the sentences already on screen: the prompts'
 * feedback, the caveat line and earlier cards. Returned per item, per term; a
 * term whose explanation was fully told gets "".
 */
export function freshWhys(result: DecisionResult, told: readonly string[]): string[][] {
  const seen = new Set([...told, ...result.unsupported].flatMap(splitSentences));
  return result.items.map((v) =>
    v.terms.map((t) => {
      const fresh = splitSentences(t.why).filter((sentence) => !seen.has(sentence));
      fresh.forEach((sentence) => seen.add(sentence));
      return fresh.join(" ");
    }),
  );
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
  /** Lines for the casex column at one select value, by literal body. Any other case is computed by compareValueNote. Never an outcome for another listed value. */
  valueNotes: Readonly<Record<string, string>>;
  /** What the set shows under casex, once every listed value has been revealed. compareWrapUp computes the casez line. */
  wrapUp: string;
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
    summary: "The table from the Flow Control lesson. Try sel = 1x, x1 and xx in both columns.",
    valueNotes: {
      "1x": "A row of the Flow Control table: under casex both items accept this value, and the first one runs.",
      x1: "A row of the Flow Control table: under casex the x is skipped, so bit 0 alone picks the item.",
      xx: "A row of the Flow Control table: under casex both items accept this value, and the first one runs.",
    },
    wrapUp: "In the Flow Control table, sel = 1x, x1 and xx run a real branch under casex and match nothing under case inside.",
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
    valueNotes: {
      "1x": "The select's x sits under the item's ?, the one place where both forms accept it.",
      x1: "casex skips a select x at every bit, even against the item's fixed 1 (§12.5.1).",
    },
    wrapUp: "The don't-care now sits in the item, where both forms accept it, and casex alone goes further.",
    selectName: "sel",
    items: [{ terms: [lit("2'b1?")], action: "branch = 1;" }],
    catchAll: false,
    selectOptions: ["1x", "10", "x1", "xx"],
  },
  {
    id: "opcode-decoder",
    title: "Opcode decoder (operators lesson)",
    summary: "The operators lesson's case (op) inside decoder beside the same items written for casex. A range is legal only in case inside, so casex lists its three values.",
    valueNotes: {
      "0x0": "This is the operators lesson's hazard value: a corrupted opcode quietly takes a real branch under casex (§12.5.1).",
    },
    wrapUp: "An unknown opcode can take a real branch under casex; under case inside it reaches default unless an item's wildcard covers it, and a testbench can report that (§12.5.1, §12.5.4).",
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
  const found = COMPARE_SETS.find((s) => s.id === id);
  if (!found && id !== undefined) warnUnknownId("compare set", id, COMPARE_SETS.map((s) => s.id));
  return found ?? COMPARE_SETS[0];
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

/**
 * What one select value shows across the two columns. Computed from the two
 * results, so it holds for a value built bit by bit and under the casez toggle,
 * and it can only speak about this value. A set's own line replaces it for casex.
 */
export function compareValueNote(set: CompareSet, select: Bit4[], leftKind: CompareLeftKind): string {
  const own = leftKind === "casex" ? set.valueNotes[bitsToString(select)] : undefined;
  if (own) return own;
  const value = formatLiteral(select);
  if (!hasUnknown(select)) return `Every bit of ${value} is known, so both columns reach the same outcome.`;
  const { left, right } = compareDecisions(set, select, leftKind);
  if (runOutcomeId(left.runs) !== runOutcomeId(right.runs)) {
    // The rule for case inside follows in WILDCARD_ASYMMETRY_NOTE, in the same paragraph.
    return `The columns differ on ${value}: ${leftKind} skips every ${leftKind === "casez" ? "z" : "x or z"} bit of the select, at every item.`;
  }
  if (right.runs.kind === "item") return `Both columns run the same item for ${value}: its unknown bit sits under the item's own wildcard.`;
  return `Neither column finds a matching item for ${value}.`;
}

/** The set's closing line for the left column in use, once every listed value has been revealed. */
export function compareWrapUp(set: CompareSet, leftKind: CompareLeftKind): string {
  if (leftKind === "casex") return set.wrapUp;
  const differ = set.selectOptions.filter((body) => {
    const { left, right } = compareDecisions(set, parseBits(body), "casez");
    return runOutcomeId(left.runs) !== runOutcomeId(right.runs);
  });
  if (differ.length === 0) return "Under casez every listed value lands in the same place in both columns: casez skips only z, and no listed value has a z in the select (§12.5.1).";
  // Scoped to the list, like the branch above: an unlisted value with a z can make the columns differ too (in the Flow Control set, z0, z1 and zz do; 0z, xz and zx do not), and the bit editor can build one (§12.5.1).
  return `Of the listed values, under casez the columns differ only for ${differ.map((body) => `${set.selectName} = ${formatLiteral(parseBits(body))}`).join(" and ")}: casez skips a z in the case expression too (§12.5.1).`;
}
