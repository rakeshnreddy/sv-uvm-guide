/**
 * Plusarg lookup model: $test$plusargs and $value$plusargs (IEEE 1800-2023 §21.6).
 *
 * Pure and deterministic. Every sentence the FileReadCursorVisualizer shows
 * about a plusarg lookup is generated here from the lookup's result.
 *
 * Rules implemented (§21.6 unless noted):
 * - The query string does not include the leading `+`.
 * - Plusargs are searched in the order provided on the command line; a plusarg
 *   matches when its prefix matches every character of the query, so the
 *   first such plusarg wins.
 * - $test$plusargs returns a nonzero integer on a match and 0 otherwise. The
 *   standard promises "nonzero", never a particular value, so the model
 *   returns the token "nonzero".
 * - $value$plusargs on a miss returns 0, leaves the variable unchanged and
 *   generates no warning.
 * - On a match, the remainder (the part after the matched prefix) is
 *   converted with the format and stored. An empty remainder stores zero or
 *   an empty string. A value too large for the variable is truncated.
 *   Characters illegal for the conversion write 'bx into the variable.
 * - 'bx written into a 2-state int becomes 0 (§6.11.2: x and z bits convert
 *   to zero in a 2-state type); a 4-state logic [31:0] keeps the X.
 *
 * Outside the model (it throws rather than guess): formats other than %d and
 * %s, and %d remainders with a sign, an underscore or a lone x/z/? character,
 * because §21.6 does not list which characters %d accepts.
 */

export type PlusargReturn = 0 | "nonzero";
export type PlusargVarType = "int" | "logic32" | "string";

export type PlusargValue =
  | { type: "int"; value: number }
  | { type: "logic32"; bits: string }
  | { type: "string"; value: string };

export interface PlusargScanStep {
  tokenIndex: number;
  token: string;
  /** The token without its leading `+`: the text that is compared. */
  body: string;
  /** How many leading characters of the query agree with the body. */
  matchedChars: number;
  matches: boolean;
  /** Index in the query of the first character that disagrees (or that the body lacks); null on a match. */
  mismatchAt: number | null;
}

export interface TestPlusargsResult {
  kind: "test";
  query: string;
  returns: PlusargReturn;
  matchIndex: number | null;
  scan: PlusargScanStep[];
}

export type PlusargConversion = "miss" | "number" | "truncated" | "empty" | "illegal" | "string";

export interface ValuePlusargsResult {
  kind: "value";
  userString: string;
  prefix: string;
  format: "d" | "s";
  returns: PlusargReturn;
  matchIndex: number | null;
  remainder: string | null;
  conversion: PlusargConversion;
  before: PlusargValue;
  after: PlusargValue;
  changed: boolean;
  scan: PlusargScanStep[];
}

export class PlusargOutsideModelError extends Error {}

/** §21.6: the query never includes the leading plus sign, and tokens on the command line start with one. */
function tokenBody(token: string): string {
  if (!token.startsWith("+")) throw new PlusargOutsideModelError(`plusarg "${token}" does not start with +`);
  return token.slice(1);
}

function compare(query: string, body: string): { matchedChars: number; matches: boolean; mismatchAt: number | null } {
  let i = 0;
  while (i < query.length && i < body.length && query[i] === body[i]) i += 1;
  const matches = i === query.length;
  return { matchedChars: i, matches, mismatchAt: matches ? null : i };
}

/** §21.6: search in command-line order; the first plusarg whose prefix matches every query character wins. */
export function scanPlusargs(tokens: string[], query: string): { matchIndex: number | null; scan: PlusargScanStep[] } {
  if (query.length === 0) throw new PlusargOutsideModelError("an empty query is outside the model");
  const scan: PlusargScanStep[] = [];
  for (let k = 0; k < tokens.length; k += 1) {
    const body = tokenBody(tokens[k]);
    const c = compare(query, body);
    scan.push({ tokenIndex: k, token: tokens[k], body, ...c });
    if (c.matches) return { matchIndex: k, scan };
  }
  return { matchIndex: null, scan };
}

/** §21.6 $test$plusargs: nonzero on a prefix match, 0 otherwise. */
export function testPlusargs(tokens: string[], query: string): TestPlusargsResult {
  const { matchIndex, scan } = scanPlusargs(tokens, query);
  return { kind: "test", query, returns: matchIndex === null ? 0 : "nonzero", matchIndex, scan };
}

/** §21.6: user_string is "plusarg_string format_string". */
export function parseUserString(userString: string): { prefix: string; format: "d" | "s" } {
  const at = userString.indexOf("%");
  if (at <= 0) throw new PlusargOutsideModelError(`"${userString}" has no plusarg string before its format`);
  const prefix = userString.slice(0, at);
  const spec = userString.slice(at + 1).replace(/^0+/, "");
  const code = spec.toLowerCase();
  if (code !== "d" && code !== "s") throw new PlusargOutsideModelError(`format %${spec} is outside the model (only %d and %s)`);
  return { prefix, format: code };
}

const TWO_32 = BigInt("4294967296");
const TWO_31 = BigInt("2147483648");
export const ALL_X_32 = "x".repeat(32);

export function initialValue(type: PlusargVarType, init: number | string): PlusargValue {
  if (type === "string") return { type, value: String(init) };
  const n = BigInt(Number(init));
  if (type === "int") return { type, value: Number(BigInt.asIntN(32, n)) };
  return { type, bits: BigInt.asUintN(32, n).toString(2).padStart(32, "0") };
}

function fromUnsigned32(type: "int" | "logic32", v: bigint): PlusargValue {
  if (type === "logic32") return { type, bits: v.toString(2).padStart(32, "0") };
  return { type, value: Number(v >= TWO_31 ? v - TWO_32 : v) };
}

/** 'bx: a 4-state variable reads X; a 2-state int converts x bits to 0 (§6.11.2). */
function allX(type: "int" | "logic32"): PlusargValue {
  return type === "logic32" ? { type, bits: ALL_X_32 } : { type, value: 0 };
}

/** §21.6 conversion of the remainder string with %d. */
export function convertDecimal(remainder: string, type: "int" | "logic32"): { value: PlusargValue; conversion: PlusargConversion } {
  if (remainder === "") return { value: fromUnsigned32(type, BigInt(0)), conversion: "empty" };
  if (/^[+-]/.test(remainder) || remainder.includes("_") || /^[xXzZ?]$/.test(remainder)) {
    throw new PlusargOutsideModelError(`remainder "${remainder}" is outside the model: §21.6 does not list the characters %d accepts`);
  }
  if (/^[0-9]+$/.test(remainder)) {
    const n = BigInt(remainder);
    return { value: fromUnsigned32(type, n % TWO_32), conversion: n >= TWO_32 ? "truncated" : "number" };
  }
  return { value: allX(type), conversion: "illegal" };
}

/** §21.6 $value$plusargs. */
export function valuePlusargs(tokens: string[], userString: string, before: PlusargValue): ValuePlusargsResult {
  const { prefix, format } = parseUserString(userString);
  const { matchIndex, scan } = scanPlusargs(tokens, prefix);
  if (matchIndex === null) {
    return { kind: "value", userString, prefix, format, returns: 0, matchIndex, remainder: null, conversion: "miss", before, after: before, changed: false, scan };
  }
  const remainder = scan[scan.length - 1].body.slice(prefix.length);
  let after: PlusargValue;
  let conversion: PlusargConversion;
  if (format === "s") {
    if (before.type !== "string") throw new PlusargOutsideModelError("%s is modelled only into a string variable");
    after = { type: "string", value: remainder };
    conversion = remainder === "" ? "empty" : "string";
  } else {
    if (before.type === "string") throw new PlusargOutsideModelError("%d is modelled only into int or logic [31:0]");
    ({ value: after, conversion } = convertDecimal(remainder, before.type));
  }
  return {
    kind: "value",
    userString,
    prefix,
    format,
    returns: "nonzero",
    matchIndex,
    remainder,
    conversion,
    before,
    after,
    changed: displayPlusargValue(after) !== displayPlusargValue(before),
    scan,
  };
}

/** How a value prints in the visual: X for an all-x logic, decimal otherwise, quotes for strings. */
export function displayPlusargValue(v: PlusargValue): string {
  if (v.type === "int") return String(v.value);
  if (v.type === "string") return `"${v.value}"`;
  if (/^[01]+$/.test(v.bits)) return BigInt(`0b${v.bits}`).toString(10);
  if (/^x+$/.test(v.bits)) return "X";
  return v.bits;
}

export function displayReturn(r: PlusargReturn): string {
  return r === 0 ? "0" : "nonzero";
}

export function typeKeyword(type: PlusargVarType): string {
  return type === "int" ? "int" : type === "logic32" ? "logic [31:0]" : "string";
}

// ---------------------------------------------------------------------------
// Scenario data for the visual: palette, presets and lookups.
// ---------------------------------------------------------------------------

/** Tokens the learner can place on the command line. Signed and lone-x remainders are excluded (outside the model). */
export const PLUSARG_PALETTE = [
  "+VECTORS=vectors_bad.txt",
  "+VERBOSE",
  "+SEED=1",
  "+SEED=2",
  "+SEED=7",
  "+SEED=12x",
  "+SEED=",
  "+TESTNAME=t1",
  "+TEST=5",
  "+DUMP",
] as const;

export type CmdlinePresetId = "prefix-trap" | "first-wins" | "testname" | "illegal" | "empty";

export const CMDLINE_PRESETS: { id: CmdlinePresetId; label: string; tokens: string[] }[] = [
  { id: "prefix-trap", label: "+VECTORS=vectors_bad.txt +VERBOSE", tokens: ["+VECTORS=vectors_bad.txt", "+VERBOSE"] },
  // Neither value is the default seed (1), so "first wins", "last wins" and "missed" give three different answers.
  { id: "first-wins", label: "+SEED=7 +SEED=2", tokens: ["+SEED=7", "+SEED=2"] },
  { id: "testname", label: "+TESTNAME=t1", tokens: ["+TESTNAME=t1"] },
  { id: "illegal", label: "+SEED=12x", tokens: ["+SEED=12x"] },
  { id: "empty", label: "+SEED=", tokens: ["+SEED="] },
];

export type LookupId = "vectors" | "seed" | "verbose" | "v" | "test" | "test-eq";

export interface LookupSpec {
  id: LookupId;
  /** Short label for the chooser. */
  label: string;
  kind: "test" | "value";
  /** Query for $test$plusargs, user_string for $value$plusargs. */
  arg: string;
  variable?: { name: string; numeric: boolean; init: number | string };
  /** The bit variable a $test$plusargs result is stored in. */
  flag?: string;
}

export const LOOKUPS: LookupSpec[] = [
  { id: "vectors", label: "VECTORS=%s", kind: "value", arg: "VECTORS=%s", variable: { name: "vec_file", numeric: false, init: "vectors.txt" } },
  { id: "seed", label: "SEED=%d", kind: "value", arg: "SEED=%d", variable: { name: "seed", numeric: true, init: 1 } },
  { id: "verbose", label: "VERBOSE", kind: "test", arg: "VERBOSE", flag: "verbose" },
  { id: "v", label: "V", kind: "test", arg: "V", flag: "v_found" },
  { id: "test", label: "TEST", kind: "test", arg: "TEST", flag: "test_found" },
  { id: "test-eq", label: "TEST=%d", kind: "value", arg: "TEST=%d", variable: { name: "test_num", numeric: true, init: 0 } },
];

export function lookupById(id: LookupId): LookupSpec {
  const l = LOOKUPS.find((x) => x.id === id);
  if (!l) throw new Error(`unknown lookup ${id}`);
  return l;
}

export function lookupVarType(spec: LookupSpec, numericType: "int" | "logic32"): PlusargVarType {
  return spec.variable?.numeric ? numericType : "string";
}

/** Generated source of the lookup panel; one line per lookup, keyed by its id. */
export function plusargSource(numericType: "int" | "logic32"): { key?: string; text: string }[] {
  const kw = typeKeyword(numericType);
  return [
    { text: `string ${"vec_file"} = "vectors.txt";` },
    { text: `${kw} seed = 1;` },
    { text: `${kw} test_num = 0;` },
    { text: "bit verbose, v_found, test_found;" },
    { text: "initial begin" },
    ...LOOKUPS.map((l) => ({
      key: l.id,
      text:
        l.kind === "test"
          ? `  ${l.flag} = ($test$plusargs("${l.arg}") != 0);`
          : `  void'($value$plusargs("${l.arg}", ${l.variable?.name}));`,
    })),
    { text: "end" },
  ];
}

export type LookupResult = TestPlusargsResult | ValuePlusargsResult;

export function runLookup(tokens: string[], id: LookupId, numericType: "int" | "logic32"): LookupResult {
  const spec = lookupById(id);
  if (spec.kind === "test") return testPlusargs(tokens, spec.arg);
  const v = spec.variable as NonNullable<LookupSpec["variable"]>;
  return valuePlusargs(tokens, spec.arg, initialValue(lookupVarType(spec, numericType), v.init));
}

/** The one sentence that explains a lookup's result, with its clause. */
export function explainLookup(r: LookupResult, varName?: string): string {
  if (r.kind === "test") {
    if (r.matchIndex === null) return `No plusarg begins with "${r.query}", so $test$plusargs returns 0 (§21.6).`;
    const tok = r.scan[r.scan.length - 1];
    const longer = tok.body !== r.query ? ` That is prefix matching: "${tok.token}" is longer than the query, and the query only has to match its beginning.` : "";
    return `"${tok.token}" begins with "${r.query}", so $test$plusargs returns a nonzero integer; the standard promises nonzero, not 1 (§21.6).${longer}`;
  }
  const name = varName ?? "the variable";
  if (r.matchIndex === null) {
    return `No plusarg begins with "${r.prefix}", so $value$plusargs returns 0, leaves ${name} at ${displayPlusargValue(r.before)} and prints no warning (§21.6).`;
  }
  const tok = r.scan[r.scan.length - 1];
  const head = `"${tok.token}" is the first plusarg that begins with "${r.prefix}", so it returns nonzero`;
  switch (r.conversion) {
    case "string":
      return `${head}, and the remainder "${r.remainder}" is stored in ${name} as a string (§21.6).`;
    case "empty":
      return `${head}. Nothing follows "${r.prefix}", so the stored value is ${r.format === "s" ? "an empty string" : "zero"} (§21.6).`;
    case "number":
      return `${head}, and %d converts the remainder "${r.remainder}" to ${displayPlusargValue(r.after)} (§21.6).`;
    case "truncated":
      return `${head}. The remainder "${r.remainder}" does not fit in 32 bits, so the value is truncated to ${displayPlusargValue(r.after)} (§21.6).`;
    case "illegal": {
      const tail =
        r.after.type === "int"
          ? "int is a 2-state type, so the x bits become 0 (§6.11.2) and the bad option goes unnoticed."
          : "logic [31:0] is 4-state, so it reads X, and $isunknown can catch the bad option.";
      return `${head}. The remainder "${r.remainder}" holds characters %d cannot convert, so ${name} is written with 'bx (§21.6). ${tail}`;
    }
    default:
      return head;
  }
}

/** Plain-text narration of one scan step (the "slide"). */
export function describeScanStep(step: PlusargScanStep, query: string): string {
  if (step.matches) {
    const rest = step.body.slice(query.length);
    return `"${step.token}": all ${query.length} characters of "${query}" match its beginning${rest ? `; the remainder is "${rest}"` : "; nothing remains after the match"}. First match: the search stops here.`;
  }
  const at = step.mismatchAt as number;
  const why = at >= step.body.length ? `the plusarg ends after ${step.body.length} characters` : `"${query[at]}" does not match "${step.body[at]}"`;
  return `"${step.token}": ${at === 0 ? "no characters match" : `the first ${at} character${at === 1 ? "" : "s"} match`}, then ${why}. No match; move right.`;
}

export interface PlusargOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Return-value options for any lookup. */
export function returnOptions(r: LookupResult): PlusargOption[] {
  const explanation = explainLookup(r);
  return [
    {
      id: "zero",
      label: "0",
      correct: r.returns === 0,
      feedback: r.returns === 0 ? explanation : `A plusarg matched, so the function does not return 0. ${explanation}`,
    },
    {
      id: "nonzero",
      label: "a nonzero integer",
      correct: r.returns === "nonzero",
      feedback:
        r.returns === "nonzero"
          ? explanation
          : `Nothing on this command line begins with the query; matching is by prefix of the plusarg, not by substring. ${explanation}`,
    },
  ];
}

/** Value options for a $value$plusargs lookup: the answer plus model-derived distractors, each with its diagnosis. */
export function valueOptions(r: ValuePlusargsResult, tokens: string[], varName: string): PlusargOption[] {
  const correct = displayPlusargValue(r.after);
  const explanation = explainLookup(r, varName);
  const options = new Map<string, string>();
  const add = (label: string, wrongWhy: string) => {
    if (!options.has(label)) options.set(label, wrongWhy);
  };
  add(correct, explanation);
  add(
    displayPlusargValue(r.before),
    `That is the default, which only a miss leaves in place. ${explanation}`,
  );
  tokens.forEach((t, k) => {
    const body = t.startsWith("+") ? t.slice(1) : t;
    if (!body.startsWith(r.prefix)) return;
    const rem = body.slice(r.prefix.length);
    if (r.format === "s") {
      add(`"${rem}"`, `That is the remainder of "${t}", a later plusarg. The search runs in command-line order and the first match is converted (§21.6).`);
      return;
    }
    if (/^[0-9]+$/.test(rem) && k !== r.matchIndex) {
      add(
        BigInt(rem).toString(),
        `That is the value in "${t}", a later plusarg. The search runs in command-line order and the first match is the one converted (§21.6).`,
      );
    }
    const lead = /^([0-9]+)[^0-9]/.exec(rem);
    if (lead) {
      add(BigInt(lead[1]).toString(), `%d does not stop at the first bad character here: when the remainder holds characters illegal for the conversion, §21.6 writes 'bx into the variable.`);
    }
  });
  if (r.format === "s") add('""', `An empty string is stored only when nothing follows "${r.prefix}" in the matching plusarg. ${explanation}`);
  if (r.format === "d") {
    add("0", r.after.type === "logic32" && correct === "X" ? `An int would read 0, because 2-state types turn x bits into 0 (§6.11.2). A logic [31:0] keeps the X.` : `Zero is stored only for an empty remainder or, in an int, for 'bx. ${explanation}`);
    if (r.after.type === "logic32") add("X", `X appears only when the remainder has characters %d cannot convert. ${explanation}`);
    else add("X", `An int is a 2-state type: it cannot hold X, so even 'bx is stored as 0 (§6.11.2). ${explanation}`);
  }
  return [...options.entries()].map(([label, why], i) => ({
    id: `v${i}`,
    label,
    correct: label === correct,
    feedback: label === correct ? explanation : why,
  }));
}
