/**
 * SystemVerilog reserved-keyword sets and the `begin_keywords / `end_keywords
 * directives, plus the standards lineage that each keyword table belongs to.
 *
 * Every rule is implemented from IEEE 1800-2023 and named where it is used:
 * - 22.14, Syntax 22-10: nine version specifiers. Only the identifiers listed as
 *   reserved in the specified version are reserved words. The directives change
 *   only which identifiers are reserved, never semantics or tokens.
 *   Implementations may add custom specifiers; it shall be an error if an
 *   implementation does not recognize the specifier.
 * - 22.14: the directives can only be specified outside a design element (3.2).
 *   `begin_keywords affects all source that follows, even across source file
 *   boundaries, until the matching `end_keywords. `resetall does not affect it.
 *   Pairs nest as a stack; `end_keywords returns to the specifier in effect
 *   before the matching `begin_keywords.
 * - 22.14: with no `begin_keywords, the reserved list is the implementation's
 *   default set, which is implementation dependent (invocation options and
 *   file name extensions are the standard's two example mechanisms).
 * - 22.14.1: examples, including the reverse case (interface and endinterface
 *   are not keywords under "1364-2005").
 * - 22.14.2 to 22.14.9, Tables 22-1 to 22-6: the cumulative sets.
 *   22.14.4: "1364-2001-noconfig" excludes ten configuration words of Table 22-2.
 *   22.14.9: "1800-2017" and "1800-2023" add no new reserved keywords.
 * - Annex B, Table B.1: the full current list, the union of all version tables.
 * - 5.6: a simple identifier is letters, digits, $ and _, not starting with a
 *   digit or $; identifiers are case sensitive; a keyword may not be used as a
 *   user-defined identifier; tools may limit length, but to no fewer than 1024
 *   characters.
 * - 5.6.1: an escaped identifier starts with \ and ends with white space, uses
 *   printable ASCII 33 to 126; \cpu3 is the same as cpu3; an escaped keyword is
 *   a user-defined identifier.
 * - 5.6.2: keywords are nonescaped and lowercase only.
 * - 3.2: design elements are module, program, interface, checker, package,
 *   primitive and config (23.2: macromodule is interchangeable with module).
 * - 22.3: `resetall shall not be specified within a design element.
 *
 * Lineage sources: IEEE 1800-2023 1.3 NOTE (1800-2005 relied on 1364-2005;
 * 1800-2009 merged them into one document), 1.4 (SystemVerilog 3.1a was a
 * precursor to 1800-2005); IEEE 1800.2-2020 front matter (revision of
 * 1800.2-2017; acknowledges the Accellera UVM Pre-IEEE Class Reference),
 * informative Introduction (built on OVM) and Clause 2 (IEEE 1800 is its
 * normative reference); uvm-core 2020.3.1 README (a library matching the
 * requirements of IEEE 1800.2-2020). Years come only from the designations.
 *
 * The keyword lists below are the reserved-word lists of Tables 22-1 to 22-6,
 * extracted once from the standard; nothing else of its text is copied.
 */

// ---------------------------------------------------------------------------
// Version specifiers (Syntax 22-10)
// ---------------------------------------------------------------------------

/** Syntax 22-10, in the order the syntax lists them. */
export const VERSION_SPECIFIERS = [
  "1800-2023",
  "1800-2017",
  "1800-2012",
  "1800-2009",
  "1800-2005",
  "1364-2005",
  "1364-2001",
  "1364-2001-noconfig",
  "1364-1995",
] as const;

export type VersionSpecifier = (typeof VERSION_SPECIFIERS)[number];

/** Oldest first: the order in which the sets grew (noconfig is the 2001 variant). */
export const CHRONOLOGICAL_SPECIFIERS: readonly VersionSpecifier[] = [
  "1364-1995",
  "1364-2001",
  "1364-2001-noconfig",
  "1364-2005",
  "1800-2005",
  "1800-2009",
  "1800-2012",
  "1800-2017",
  "1800-2023",
];

export const isVersionSpecifier = (text: string): text is VersionSpecifier =>
  (VERSION_SPECIFIERS as readonly string[]).includes(text);

// ---------------------------------------------------------------------------
// Keyword tables 22-1 to 22-6
// ---------------------------------------------------------------------------

export type TableId = "22-1" | "22-2" | "22-3" | "22-4" | "22-5" | "22-6";

export interface KeywordTable {
  id: TableId;
  /** The version specifier whose revision added this table. */
  revision: VersionSpecifier;
  /** The subclause that defines the table. */
  clause: string;
  words: readonly string[];
}

const words = (list: string): readonly string[] => Object.freeze(list.trim().split(/\s+/));

/** Tables 22-1 to 22-6 (22.14.2 to 22.14.8). Table 22-1 is the base list; the others are additions. */
export const KEYWORD_TABLES: readonly KeywordTable[] = [
  {
    id: "22-1",
    revision: "1364-1995",
    clause: "22.14.2",
    words: words(`
      always and assign begin buf bufif0 bufif1 case casex casez cmos deassign default defparam disable edge else end
      endcase endfunction endmodule endprimitive endspecify endtable endtask event for force forever fork function
      highz0 highz1 if ifnone initial inout input integer join large macromodule medium module nand negedge nmos nor
      not notif0 notif1 or output parameter pmos posedge primitive pull0 pull1 pulldown pullup rcmos real realtime reg
      release repeat rnmos rpmos rtran rtranif0 rtranif1 scalared small specify specparam strong0 strong1 supply0
      supply1 table task time tran tranif0 tranif1 tri tri0 tri1 triand trior trireg vectored wait wand weak0 weak1
      while wire wor xnor xor`),
  },
  {
    id: "22-2",
    revision: "1364-2001",
    clause: "22.14.3",
    words: words(`
      automatic cell config design endconfig endgenerate generate genvar incdir include instance liblist library
      localparam noshowcancelled pulsestyle_ondetect pulsestyle_onevent showcancelled signed unsigned use`),
  },
  { id: "22-3", revision: "1364-2005", clause: "22.14.5", words: words("uwire") },
  {
    id: "22-4",
    revision: "1800-2005",
    clause: "22.14.6",
    words: words(`
      alias always_comb always_ff always_latch assert assume before bind bins binsof bit break byte chandle class
      clocking const constraint context continue cover covergroup coverpoint cross dist do endclass endclocking
      endgroup endinterface endpackage endprogram endproperty endsequence enum expect export extends extern final
      first_match foreach forkjoin iff ignore_bins illegal_bins import inside int interface intersect join_any
      join_none local logic longint matches modport new null package packed priority program property protected pure
      rand randc randcase randsequence ref return sequence shortint shortreal solve static string struct super tagged
      this throughout timeprecision timeunit type typedef union unique var virtual void wait_order wildcard with
      within`),
  },
  {
    id: "22-5",
    revision: "1800-2009",
    clause: "22.14.7",
    words: words(`
      accept_on checker endchecker eventually global implies let nexttime reject_on restrict s_always s_eventually
      s_nexttime s_until s_until_with strong sync_accept_on sync_reject_on unique0 until until_with untyped weak`),
  },
  { id: "22-6", revision: "1800-2012", clause: "22.14.8", words: words("implements interconnect nettype soft") },
];

export const tableById = (id: TableId): KeywordTable => {
  const table = KEYWORD_TABLES.find((t) => t.id === id);
  if (!table) throw new Error(`Unknown keyword table ${id}`);
  return table;
};

/** 22.14.4: the identifiers "1364-2001-noconfig" excludes from Table 22-2. */
export const NOCONFIG_EXCLUDED: readonly string[] = words("cell config design endconfig incdir include instance liblist library use");

export interface SpecifierInfo {
  specifier: VersionSpecifier;
  /** The subclause that defines this specifier's set. */
  clause: string;
  /** The tables whose union the set starts from. */
  tables: readonly TableId[];
  /** Words removed from that union. */
  excludes: readonly string[];
  /** The table this revision added, if any. */
  adds: TableId | null;
  /** The family of the standard named by the specifier. */
  family: "IEEE 1364" | "IEEE 1800";
}

const upTo = (last: TableId): TableId[] => {
  const ids = KEYWORD_TABLES.map((t) => t.id);
  return ids.slice(0, ids.indexOf(last) + 1);
};

/** 22.14.2 to 22.14.9: each set includes all earlier ones (except the noconfig variant's exclusions). */
export const SPECIFIER_INFO: Record<VersionSpecifier, SpecifierInfo> = {
  "1364-1995": { specifier: "1364-1995", clause: "22.14.2", tables: upTo("22-1"), excludes: [], adds: "22-1", family: "IEEE 1364" },
  "1364-2001": { specifier: "1364-2001", clause: "22.14.3", tables: upTo("22-2"), excludes: [], adds: "22-2", family: "IEEE 1364" },
  "1364-2001-noconfig": {
    specifier: "1364-2001-noconfig",
    clause: "22.14.4",
    tables: upTo("22-2"),
    excludes: NOCONFIG_EXCLUDED,
    adds: null,
    family: "IEEE 1364",
  },
  "1364-2005": { specifier: "1364-2005", clause: "22.14.5", tables: upTo("22-3"), excludes: [], adds: "22-3", family: "IEEE 1364" },
  "1800-2005": { specifier: "1800-2005", clause: "22.14.6", tables: upTo("22-4"), excludes: [], adds: "22-4", family: "IEEE 1800" },
  "1800-2009": { specifier: "1800-2009", clause: "22.14.7", tables: upTo("22-5"), excludes: [], adds: "22-5", family: "IEEE 1800" },
  "1800-2012": { specifier: "1800-2012", clause: "22.14.8", tables: upTo("22-6"), excludes: [], adds: "22-6", family: "IEEE 1800" },
  "1800-2017": { specifier: "1800-2017", clause: "22.14.9", tables: upTo("22-6"), excludes: [], adds: null, family: "IEEE 1800" },
  "1800-2023": { specifier: "1800-2023", clause: "22.14.9", tables: upTo("22-6"), excludes: [], adds: null, family: "IEEE 1800" },
};

const reservedCache = new Map<VersionSpecifier, ReadonlySet<string>>();

/** 22.14: only the identifiers listed as reserved in the specified version are reserved words. */
export function reservedWords(specifier: VersionSpecifier): ReadonlySet<string> {
  const cached = reservedCache.get(specifier);
  if (cached) return cached;
  const info = SPECIFIER_INFO[specifier];
  const set = new Set<string>();
  for (const id of info.tables) for (const word of tableById(id).words) set.add(word);
  for (const word of info.excludes) set.delete(word);
  reservedCache.set(specifier, set);
  return set;
}

/** Annex B, Table B.1: the combination of all version tables. */
export const ANNEX_B_KEYWORDS: ReadonlySet<string> = new Set(KEYWORD_TABLES.flatMap((t) => [...t.words]));

/** The table that first listed this exact (lowercase, nonescaped) word, or null. */
export function tableIntroducing(word: string): KeywordTable | null {
  return KEYWORD_TABLES.find((t) => t.words.includes(word)) ?? null;
}

/** Plain-language name of a setting, e.g. `begin_keywords "1364-2001"`. */
export const specifierLabel = (specifier: VersionSpecifier) => `"${specifier}"`;

// ---------------------------------------------------------------------------
// Parsing a `begin_keywords string (22.14)
// ---------------------------------------------------------------------------

export type SpecifierParse =
  | { ok: true; specifier: VersionSpecifier }
  | { ok: false; text: string; reason: "empty" | "unrecognized"; message: string };

/**
 * 22.14: a `begin_keywords string must name a version the implementation
 * recognizes. Surrounding quotes and white space are ignored; the comparison is
 * exact (the specifiers are written exactly as in Syntax 22-10).
 */
export function parseVersionSpecifier(raw: string): SpecifierParse {
  const text = raw.trim().replace(/^"(.*)"$/, "$1").trim();
  if (text === "") {
    return { ok: false, text, reason: "empty", message: "No version specifier given: `begin_keywords needs one of the nine strings of Syntax 22-10 (22.14)." };
  }
  if (isVersionSpecifier(text)) return { ok: true, specifier: text };
  return {
    ok: false,
    text,
    reason: "unrecognized",
    message: `"${text}" is not one of the nine version specifiers of Syntax 22-10. It shall be an error if an implementation does not recognize the specifier; implementations are permitted to add custom specifiers, so only a tool that defines "${text}" would accept it (22.14).`,
  };
}

// ---------------------------------------------------------------------------
// Identifiers (5.6, 5.6.1, 5.6.2)
// ---------------------------------------------------------------------------

/** 5.6: implementations may limit identifier length, but the limit shall be at least this. */
export const MIN_IDENTIFIER_LENGTH_LIMIT = 1024;

export type TokenAnalysis =
  | { form: "simple"; text: string; name: string }
  | { form: "escaped"; text: string; name: string }
  | { form: "invalid"; text: string; reason: string };

const SIMPLE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/**
 * White space (5.3): spaces, tabs, newlines and formfeeds. Carriage return is
 * counted here as part of a CR LF newline; 5.3 does not name it separately.
 * Other control characters (such as U+0001 or DEL) are not white space: 5.6.1
 * rules them out because they fall outside printable ASCII 33 to 126.
 */
const WHITE_SPACE_CODES: ReadonlySet<number> = new Set([32, 9, 10, 12, 13]);
export const isWhiteSpaceCode = (code: number): boolean => WHITE_SPACE_CODES.has(code);

/**
 * Words where an example comment in the LRM disagrees with the keyword tables.
 * The 5.6.1 example comment calls "net" a keyword, yet net is in none of
 * Tables 22-1 to 22-6 nor Annex B. The tables decide.
 */
export const LRM_EXAMPLE_CONFLICTS: Readonly<Record<string, string>> = {
  net: 'The 5.6.1 example\'s comment calls "net" a keyword, but net is in none of Tables 22-1 to 22-6 and not in Annex B. That comment conflicts with the tables, and the tables decide (22.14, Annex B).',
};

/**
 * 5.6 and 5.6.1. Leading and trailing white space is dropped first: the white
 * space that ends an escaped identifier is not part of it (5.6.1).
 */
export function analyzeToken(raw: string): TokenAnalysis {
  const text = raw.trim();
  if (text === "") return { form: "invalid", text, reason: "Empty: there is no identifier to check." };
  if (text.startsWith("\\")) {
    const name = text.slice(1);
    if (name === "") return { form: "invalid", text, reason: "A lone backslash: an escaped identifier needs at least one character before the white space that ends it (5.6.1)." };
    for (const ch of name) {
      const code = ch.codePointAt(0) ?? 0;
      if (isWhiteSpaceCode(code)) {
        return { form: "invalid", text, reason: "An escaped identifier ends at the first white space, so this is more than one token (5.6.1)." };
      }
      if (code < 33 || code > 126) {
        return { form: "invalid", text, reason: "An escaped identifier may use only printable ASCII characters, decimal 33 to 126 (5.6.1)." };
      }
    }
    return { form: "escaped", text, name };
  }
  if (!SIMPLE_IDENTIFIER.test(text)) {
    return {
      form: "invalid",
      text,
      reason: /^[0-9$]/.test(text)
        ? "A simple identifier cannot start with a digit or $ (5.6)."
        : "A simple identifier is letters, digits, $ and _ only (5.6). Escape it with a backslash to use other printable characters (5.6.1).",
    };
  }
  return { form: "simple", text, name: text };
}

// ---------------------------------------------------------------------------
// Settings and verdicts
// ---------------------------------------------------------------------------

/**
 * The keyword set in effect: either an explicit directive, or the tool's default
 * (22.14: implementation dependent). `assumed` lets a scenario state an
 * assumption about that default; null means unknown.
 */
export type KeywordSetting =
  | { kind: "directive"; specifier: VersionSpecifier }
  | { kind: "default"; assumed: VersionSpecifier | null };

export const DEFAULT_UNKNOWN: KeywordSetting = { kind: "default", assumed: null };
export const directive = (specifier: VersionSpecifier): KeywordSetting => ({ kind: "directive", specifier });

/** The set the model can evaluate, or null when the tool default is unknown. */
export const evaluatedSpecifier = (setting: KeywordSetting): VersionSpecifier | null =>
  setting.kind === "directive" ? setting.specifier : setting.assumed;

export function settingLabel(setting: KeywordSetting): string {
  if (setting.kind === "directive") return `\`begin_keywords "${setting.specifier}"`;
  return setting.assumed ? `tool default (assumed "${setting.assumed}")` : "tool default (implementation dependent)";
}

export type Verdict = "keyword" | "identifier" | "implementation-dependent" | "not-an-identifier";

export interface KeywordVerdict {
  token: TokenAnalysis;
  setting: KeywordSetting;
  verdict: Verdict;
  /** True when the verdict rests on an assumed tool default rather than a directive. */
  assumed: boolean;
  /** The table that listed the bare (nonescaped) name, if any. */
  enteredIn: KeywordTable | null;
  /** The name is in Table 22-2 but the set is "1364-2001-noconfig" (22.14.4). */
  excludedByNoconfig: boolean;
  /** Standard specifiers (oldest first) that reserve the bare name as written. */
  reservedBy: VersionSpecifier[];
  /** Standard specifiers (oldest first) under which this token is a usable name. */
  acceptedBy: VersionSpecifier[];
  /** The newest standard specifier under which this token is a usable name. */
  newestAccepting: VersionSpecifier | null;
  /** The keyword a differently-cased name matches (5.6.2: keywords are lowercase only). */
  caseVariantOf: string | null;
  /** Keywords that this name contains as an underscore-separated part, e.g. rand in rand_en. */
  containsKeywords: string[];
  /** 5.6 length-limit note, when the name is longer than the minimum limit. */
  lengthNote: string | null;
  headline: string;
  /** Why, one sentence each, every one naming its clause. */
  reasons: string[];
}

const chronoIndex = (s: VersionSpecifier) => CHRONOLOGICAL_SPECIFIERS.indexOf(s);

/** Lists specifiers as "1364-1995", "1364-2001" and "1364-2005". */
export function listSpecifiers(specs: readonly VersionSpecifier[]): string {
  const quoted = specs.map((s) => `"${s}"`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}

/** Classifies one token under a keyword setting (22.14, 5.6, 5.6.1, 5.6.2). */
export function classifyToken(raw: string, setting: KeywordSetting): KeywordVerdict {
  const token = analyzeToken(raw);
  const evaluated = evaluatedSpecifier(setting);
  const assumed = setting.kind === "default" && setting.assumed !== null;

  const base = {
    token,
    setting,
    assumed,
    enteredIn: null as KeywordTable | null,
    excludedByNoconfig: false,
    reservedBy: [] as VersionSpecifier[],
    acceptedBy: [] as VersionSpecifier[],
    newestAccepting: null as VersionSpecifier | null,
    caseVariantOf: null as string | null,
    containsKeywords: [] as string[],
    lengthNote: null as string | null,
  };

  if (token.form === "invalid") {
    return { ...base, verdict: "not-an-identifier", headline: `${token.text || "(empty)"} is not a single identifier`, reasons: [token.reason] };
  }

  const name = token.name;
  const enteredIn = tableIntroducing(name);
  const reservedBy = token.form === "escaped" ? [] : CHRONOLOGICAL_SPECIFIERS.filter((s) => reservedWords(s).has(name));
  const acceptedBy = CHRONOLOGICAL_SPECIFIERS.filter((s) => !reservedBy.includes(s));
  const newestAccepting = acceptedBy.length ? acceptedBy[acceptedBy.length - 1] : null;
  const lower = name.toLowerCase();
  const caseVariantOf = token.form === "simple" && lower !== name && ANNEX_B_KEYWORDS.has(lower) ? lower : null;
  const parts = name.split("_").filter(Boolean);
  const containsKeywords = parts.length > 1 ? [...new Set(parts.filter((p) => ANNEX_B_KEYWORDS.has(p)))] : [];
  const lengthNote =
    name.length > MIN_IDENTIFIER_LENGTH_LIMIT
      ? `It is ${name.length} characters long. Tools may limit identifier length to as few as ${MIN_IDENTIFIER_LENGTH_LIMIT} characters and shall report an error past their limit (5.6).`
      : null;
  const excludedByNoconfig = evaluated === "1364-2001-noconfig" && token.form === "simple" && NOCONFIG_EXCLUDED.includes(name);

  const common = { ...base, enteredIn, reservedBy, acceptedBy, newestAccepting, caseVariantOf, containsKeywords, lengthNote, excludedByNoconfig };
  const reasons: string[] = [];
  const display = token.text;

  if (token.form === "escaped") {
    if (enteredIn) {
      reasons.push(`${display} is an escaped keyword: a keyword preceded by a backslash is not interpreted as a keyword, so it is a user-defined identifier (5.6.1, 5.6.2).`);
      reasons.push(`Without the backslash, ${name} is listed in Table ${enteredIn.id} ("${enteredIn.revision}", ${enteredIn.clause}), so the escape is what makes it a name under the sets that reserve ${name}.`);
      const plainSets = CHRONOLOGICAL_SPECIFIERS.filter((s) => !reservedWords(s).has(name));
      reasons.push(
        plainSets.length
          ? `Neither the leading backslash nor the terminating white space is part of the identifier (5.6.1), so ${display} names the identifier ${name}. Whether a plain ${name} declared under a set that does not reserve it, such as "${plainSets[plainSets.length - 1]}", refers to the same name across \`begin_keywords regions is not spelled out by 22.14 or 5.6.1, so treat it as simulator dependent.`
          : `Every standard set reserves ${name}, so only an escaped declaration can create a name spelled ${name}.`,
      );
    } else {
      reasons.push(`${display} is an escaped identifier, treated the same as ${name} written without the backslash (5.6.1). ${name} is in no keyword table, so it is a name either way.`);
    }
    if (LRM_EXAMPLE_CONFLICTS[name]) reasons.push(LRM_EXAMPLE_CONFLICTS[name]);
    if (lengthNote) reasons.push(lengthNote);
    return {
      ...common,
      verdict: "identifier",
      headline: `${display} is an ordinary identifier under every keyword set`,
      reasons,
    };
  }

  if (evaluated === null) {
    reasons.push("With no `begin_keywords directive, the reserved list is the implementation's default set, and that default is implementation dependent (22.14).");
    if (reservedBy.length === CHRONOLOGICAL_SPECIFIERS.length) {
      reasons.push(`All nine standard sets reserve ${name} (it is in Table ${enteredIn?.id}), so a default based on any IEEE 1364 or IEEE 1800 revision would reserve it.`);
    } else if (reservedBy.length === 0) {
      reasons.push(`None of the nine standard sets reserves ${name}; only a tool-specific default could.`);
      if (LRM_EXAMPLE_CONFLICTS[name]) reasons.push(LRM_EXAMPLE_CONFLICTS[name]);
    } else {
      reasons.push(`Of the nine standard sets, ${listSpecifiers(reservedBy)} reserve it; ${listSpecifiers(acceptedBy)} do not.`);
    }
    reasons.push("Invocation options and source file name extensions are two possible ways a tool may choose its default (22.14); check your tool, or add a `begin_keywords pair.");
    if (caseVariantOf) reasons.push(`Keywords are lowercase only (5.6.2), so ${name} is not the keyword ${caseVariantOf} under any set.`);
    if (lengthNote) reasons.push(lengthNote);
    return { ...common, verdict: "implementation-dependent", headline: `${name}: depends on the tool's default keyword set`, reasons };
  }

  const info = SPECIFIER_INFO[evaluated];
  const inSet = reservedWords(evaluated).has(name);
  const where = assumed ? `the assumed default "${evaluated}"` : `"${evaluated}"`;

  if (inSet && enteredIn) {
    reasons.push(
      `${name} is listed in Table ${enteredIn.id}, added by "${enteredIn.revision}" (${enteredIn.clause}), and ${where} includes that table (${info.clause}), so ${name} is reserved.`,
    );
    reasons.push(`A keyword may not be used as a user-defined identifier (5.6), so code that declares ${name} as a name is a syntax error under this set.`);
  } else if (excludedByNoconfig && enteredIn) {
    reasons.push(`${name} is in Table ${enteredIn.id}, but "1364-2001-noconfig" excludes it with the other configuration words (22.14.4), so it is an ordinary identifier here.`);
  } else if (enteredIn) {
    reasons.push(
      `${name} entered in Table ${enteredIn.id} ("${enteredIn.revision}", ${enteredIn.clause}), which ${where} does not include (${info.clause}), so ${name} is an ordinary identifier here.`,
    );
    reasons.push(
      `The reverse also holds: code that uses ${name} as a keyword does not compile under this set. 22.14.1 shows this for interface and endinterface under "1364-2005".`,
    );
  } else if (caseVariantOf) {
    reasons.push(`Keywords are lowercase only (5.6.2), and identifiers are case sensitive (5.6), so ${name} is not the keyword ${caseVariantOf}.`);
  } else {
    reasons.push(`${name} is not in any of Tables 22-1 to 22-6, whose union is Annex B, so no standard set reserves it.`);
    if (LRM_EXAMPLE_CONFLICTS[name]) reasons.push(LRM_EXAMPLE_CONFLICTS[name]);
  }
  if (!inSet && containsKeywords.length > 0) {
    reasons.push(`It contains ${containsKeywords.join(" and ")}, but ${name} is one identifier, different from the keyword${containsKeywords.length > 1 ? "s" : ""} ${containsKeywords.join(" and ")} (5.6).`);
  }
  if (assumed) reasons.push("This rests on an assumption: with no directive the set is the implementation's default, which is implementation dependent (22.14).");
  if (lengthNote) reasons.push(lengthNote);

  return {
    ...common,
    verdict: inSet ? "keyword" : "identifier",
    headline: inSet ? `${name} is a reserved keyword under ${where}` : `${name} is an ordinary identifier under ${where}`,
    reasons,
  };
}

/**
 * Feedback for the wrong one of the two checker predictions ("reserved keyword"
 * or "ordinary identifier"), naming the misconception behind it.
 */
export function wrongChoiceFeedback(result: KeywordVerdict): string {
  const spec = evaluatedSpecifier(result.setting);
  if (result.token.form !== "simple" && result.token.form !== "escaped") return result.reasons[0] ?? "";
  const name = result.token.name;
  if (result.verdict === "keyword" && result.enteredIn) {
    return `${name} has been reserved since "${result.enteredIn.revision}" (Table ${result.enteredIn.id}), and every later set keeps the earlier tables (22.14.2 to 22.14.9), so "${spec}" still reserves it.`;
  }
  if (result.token.form === "escaped") {
    return result.enteredIn
      ? `The backslash matters: an escaped keyword is a user-defined identifier, whatever the set (5.6.1).`
      : `${result.token.text} is an escaped identifier, the same as ${name} without the backslash (5.6.1), and ${name} is in no keyword table (Tables 22-1 to 22-6, Annex B), so it is a name under every set.`;
  }
  if (result.excludedByNoconfig) return `"1364-2001-noconfig" drops ${name} and the other configuration words from Table 22-2 (22.14.4).`;
  if (result.caseVariantOf) return `Keywords are lowercase only (5.6.2); ${name} differs from ${result.caseVariantOf} in case, and identifiers are case sensitive (5.6).`;
  if (result.enteredIn) {
    return `${name} arrived later, in Table ${result.enteredIn.id} ("${result.enteredIn.revision}"). A set reserves only the words of its own version (22.14), so "${spec}" does not.`;
  }
  return `${name} is in none of Tables 22-1 to 22-6 (Annex B)${result.containsKeywords.length ? `; containing ${result.containsKeywords.join(" and ")} does not make it one` : ""}.`;
}

/** One sentence on which sets accept the token as a name, for the drill's "newest set that accepts it". */
export function acceptanceSentence(result: KeywordVerdict): string {
  if (result.verdict === "not-an-identifier") return "It is not an identifier, so no keyword set makes it a name.";
  if (result.token.form === "escaped") return "Every keyword set accepts it as a name, because it is escaped (5.6.1).";
  if (result.acceptedBy.length === CHRONOLOGICAL_SPECIFIERS.length) return "Every one of the nine standard sets accepts it as a name.";
  if (result.acceptedBy.length === 0) return "None of the nine standard sets accepts it as a name; rename it or escape it (5.6.1).";
  return `Sets that accept it as a name: ${listSpecifiers(result.acceptedBy)}. ${newestRevisionSentence(result.acceptedBy)}`;
}

/**
 * "1364-2001-noconfig" is a variant of the 1364-2001 revision (22.14.4), not a
 * newer revision, so the newest accepting revision treats the two as one.
 */
export function newestRevisionSentence(acceptedBy: readonly VersionSpecifier[]): string {
  const newest = acceptedBy[acceptedBy.length - 1];
  if (!newest) return "";
  if (newest === "1364-2001-noconfig") {
    return acceptedBy.includes("1364-2001")
      ? 'The newest revision is 1364-2001: both "1364-2001" and its "1364-2001-noconfig" variant accept it (22.14.3, 22.14.4).'
      : 'The newest is "1364-2001-noconfig", a variant of the 1364-2001 revision that drops the configuration words (22.14.4); plain "1364-2001" reserves it.';
  }
  return `The newest is "${newest}".`;
}

/** Checker identifiers named by the lesson (the drill and the 22.14.1 cases). */
export const CHECKER_IDENTIFIERS: readonly string[] = [
  "logic",
  "bit",
  "final",
  "int",
  "until",
  "weak",
  "soft",
  "interface",
  "config",
  "uwire",
  "rand_en",
  "\\logic",
];

export interface CheckerPreset {
  id: string;
  title: string;
  setting: KeywordSetting;
  token: string;
}

export const CHECKER_PRESETS: Record<string, CheckerPreset> = {
  drill: { id: "drill", title: "Drill: logic under \"1800-2023\"", setting: directive("1800-2023"), token: "logic" },
  reverse: { id: "reverse", title: "Reverse case: interface under \"1364-2005\" (22.14.1)", setting: directive("1364-2005"), token: "interface" },
  noconfig: { id: "noconfig", title: "config under \"1364-2001-noconfig\" (22.14.4)", setting: directive("1364-2001-noconfig"), token: "config" },
  escaped: { id: "escaped", title: "An escaped keyword: \\logic (5.6.1)", setting: directive("1800-2023"), token: "\\logic" },
  "no-directive": { id: "no-directive", title: "No directive: the tool default (22.14)", setting: DEFAULT_UNKNOWN, token: "logic" },
};

// ---------------------------------------------------------------------------
// Regions: the keyword-set stack over source files (22.14, 22.3, 3.2)
// ---------------------------------------------------------------------------

export interface SourceFile {
  name: string;
  lines: readonly string[];
}

export interface TaggedToken {
  /** Token text as written, e.g. logic or \logic. */
  text: string;
  /** Column (0-based) where the token starts in the line. */
  start: number;
  result: KeywordVerdict;
}

export type RegionEventKind = "line" | "push" | "pop" | "resetall" | "file-boundary" | "error";

export interface RegionStep {
  index: number;
  file: string;
  /** 1-based line number, or null for the boundary between two files. */
  lineNumber: number | null;
  text: string;
  event: RegionEventKind;
  /** The specifiers pushed by open pairs, bottom first, after this step. */
  stack: VersionSpecifier[];
  /** The set in effect for this line's code (after any directive on it). */
  effective: KeywordSetting;
  /** Watched identifiers on the line, tagged by the set in effect. */
  tokens: TaggedToken[];
  /** What happened, generated from the stack. */
  note: string;
}

const DESIGN_ELEMENT_OPEN: Record<string, string> = {
  module: "endmodule",
  macromodule: "endmodule",
  program: "endprogram",
  interface: "endinterface",
  checker: "endchecker",
  package: "endpackage",
  primitive: "endprimitive",
  config: "endconfig",
};

/** Blanks out string literals and // comments so only code is tokenized; columns are kept. */
function codeOnly(line: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (!inString && ch === "/" && line[i + 1] === "/") {
      out += " ".repeat(line.length - i);
      break;
    }
    if (ch === '"' && line[i - 1] !== "\\") {
      inString = !inString;
      out += " ";
      continue;
    }
    out += inString ? " " : ch;
  }
  return out;
}

const TOKEN_PATTERN = /`[A-Za-z_][A-Za-z0-9_$]*|\\[\x21-\x7e]+|[A-Za-z_][A-Za-z0-9_$]*/g;

interface RawToken {
  text: string;
  start: number;
}

function tokensOf(line: string): RawToken[] {
  const code = codeOnly(line);
  const found: RawToken[] = [];
  for (const match of code.matchAll(TOKEN_PATTERN)) {
    if (match[0].startsWith("`")) continue;
    // A token right after a digit and quote is a number's base letter, e.g. 8'd1.
    const start = match.index ?? 0;
    if (start > 0 && code[start - 1] === "'") continue;
    found.push({ text: match[0], start });
  }
  return found;
}

const effectiveOf = (stack: readonly VersionSpecifier[], base: KeywordSetting): KeywordSetting =>
  stack.length ? directive(stack[stack.length - 1]) : base;

/**
 * Walks the files in order, one step per line plus one per file boundary.
 * 22.14: a push lasts across file boundaries until its `end_keywords; each
 * `end_keywords restores the set in effect before its matching `begin_keywords;
 * `resetall does not affect the stack. The directives are errors inside a design
 * element (22.14, 22.3, 3.2) and an unrecognized specifier is an error (22.14).
 * `base` is the tool default for every file (22.14: implementation dependent).
 */
export function walkRegions(files: readonly SourceFile[], base: KeywordSetting, watch: readonly string[]): RegionStep[] {
  const steps: RegionStep[] = [];
  const stack: VersionSpecifier[] = [];
  const openElements: string[] = [];
  const describe = (setting: KeywordSetting) => settingLabel(setting);

  files.forEach((file, fileIndex) => {
    if (fileIndex > 0) {
      const effective = effectiveOf(stack, base);
      steps.push({
        index: steps.length,
        file: file.name,
        lineNumber: null,
        text: `end of ${files[fileIndex - 1].name} · start of ${file.name}`,
        event: "file-boundary",
        stack: [...stack],
        effective,
        tokens: [],
        note: stack.length
          ? `A new file, but ${stack.length === 1 ? "an open pair" : `${stack.length} open pairs`} carries on: a \`begin_keywords affects all source that follows, even across file boundaries, until its \`end_keywords (22.14). In effect: ${describe(effective)}.`
          : `A new file. No pair is open, so ${describe(effective)} is in effect (22.14).`,
      });
    }

    file.lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      let event: RegionEventKind = "line";
      let note = "";
      const insideElement = openElements.length > 0;
      const begin = /^`begin_keywords\b\s*(.*)$/.exec(trimmed);
      const end = /^`end_keywords\b/.test(trimmed);
      const resetall = /^`resetall\b/.test(trimmed);

      if (begin) {
        const literal = /^"([^"]*)"/.exec(begin[1].trim());
        const parsed = parseVersionSpecifier(literal ? literal[1] : begin[1].replace(/\/\/.*$/, ""));
        if (insideElement) {
          event = "error";
          note = "Error: `begin_keywords can only be specified outside a design element (22.14). The stack is unchanged.";
        } else if (!parsed.ok) {
          event = "error";
          note = `Error: ${parsed.message} The stack is unchanged.`;
        } else {
          const before = effectiveOf(stack, base);
          stack.push(parsed.specifier);
          event = "push";
          note = `Push "${parsed.specifier}": only the identifiers reserved in that version are keywords from here on (22.14). It replaces ${describe(before)}${stack.length > 1 ? " while nested; the outer pair stays on the stack" : ""}.`;
        }
      } else if (end) {
        if (insideElement) {
          event = "error";
          note = "Error: `end_keywords can only be specified outside a design element (22.14). The stack is unchanged.";
        } else if (!stack.length) {
          event = "error";
          note = "Error: this `end_keywords has no matching `begin_keywords; the directives shall be used in a pair, `begin_keywords first (22.14).";
        } else {
          const popped = stack.pop() as VersionSpecifier;
          event = "pop";
          note = `Pop "${popped}": back to the set in effect before its matching \`begin_keywords, ${describe(effectiveOf(stack, base))} (22.14).`;
        }
      } else if (resetall) {
        if (insideElement) {
          event = "error";
          note = "Error: `resetall shall not be specified within a design element (22.3).";
        } else {
          event = "resetall";
          note = `\`resetall resets compiler directives to their defaults (22.3), but the results of \`begin_keywords and \`end_keywords are not affected by it (22.14). Still in effect: ${describe(effectiveOf(stack, base))}.`;
        }
      }

      const effective = effectiveOf(stack, base);
      const raw = event === "line" ? tokensOf(line) : [];
      const tokens: TaggedToken[] = [];
      for (const t of raw) {
        const result = classifyToken(t.text, effective);
        const bare = t.text.startsWith("\\") ? t.text.slice(1) : t.text;
        if (watch.includes(bare)) tokens.push({ text: t.text, start: t.start, result });
        // Track design elements by their keywords under the set in effect (3.2).
        if (result.verdict === "keyword" || (result.verdict === "implementation-dependent" && result.reservedBy.length === CHRONOLOGICAL_SPECIFIERS.length)) {
          if (DESIGN_ELEMENT_OPEN[t.text]) openElements.push(DESIGN_ELEMENT_OPEN[t.text]);
          else if (openElements.length && openElements[openElements.length - 1] === t.text) openElements.pop();
        }
      }
      if (event === "line") {
        note = tokens.length
          ? tokens.map((tok) => `${tok.text}: ${verdictWord(tok.result)}`).join("; ") + ` (in effect: ${describe(effective)}).`
          : `In effect: ${describe(effective)}.`;
      }

      steps.push({ index: steps.length, file: file.name, lineNumber: lineIndex + 1, text: line, event, stack: [...stack], effective, tokens, note });
    });
  });
  return steps;
}

/** A short tag for a token verdict. */
export function verdictWord(result: KeywordVerdict): string {
  switch (result.verdict) {
    case "keyword":
      return "keyword";
    case "identifier":
      return result.token.form === "escaped" ? "escaped identifier" : "identifier";
    case "implementation-dependent":
      return "depends on the tool default";
    default:
      return "not an identifier";
  }
}

/** Open pairs left at the end of the last file: the standard requires each to be matched (22.14). */
export function unmatchedAtEnd(steps: readonly RegionStep[]): VersionSpecifier[] {
  return steps.length ? [...steps[steps.length - 1].stack] : [];
}

export type PortVerdict = "compiles" | "error" | "implementation-dependent";

/**
 * Would a named port connection `.name(sig)` parse? The port name must be an
 * identifier, and a keyword may not be used as one (5.6).
 */
export function namedPortConnection(name: string, setting: KeywordSetting): { verdict: PortVerdict; result: KeywordVerdict; explanation: string } {
  const result = classifyToken(name, setting);
  if (result.verdict === "keyword") {
    return {
      verdict: "error",
      result,
      explanation: `.${name}(q) is a syntax error: under ${settingLabel(setting)} ${name} is a keyword (Table ${result.enteredIn?.id}), and a keyword may not be used as an identifier (5.6). The legacy file's pair ended at its \`end_keywords, so it does not cover this file (22.14). Escape the name, .\\${name} (q), to reach the port: an escaped keyword is a user-defined identifier (5.6.1).`,
    };
  }
  if (result.verdict === "identifier") {
    return {
      verdict: "compiles",
      result,
      explanation: `.${name}(q) parses: under ${settingLabel(setting)} ${name} is an ordinary identifier, so it names the legacy port directly.`,
    };
  }
  if (result.verdict === "implementation-dependent") {
    return {
      verdict: "implementation-dependent",
      result,
      explanation: `It depends on the tool: no directive is in effect, so the set is the implementation's default, which is implementation dependent (22.14). ${listSpecifiers(result.reservedBy)} reserve ${name}. The escaped form .\\${name} (q) works under every set (5.6.1).`,
    };
  }
  return { verdict: "error", result, explanation: result.reasons.join(" ") };
}

export interface RegionGate {
  /** Steps after this index stay hidden until the learner predicts. */
  stepIndex: number;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
}

export interface RegionScenario {
  id: string;
  title: string;
  summary: string;
  files: readonly SourceFile[];
  watch: readonly string[];
  /** The tool default this scenario assumes, stated on screen (22.14: implementation dependent). */
  defaultAssumption: VersionSpecifier | null;
  /** Statement shown with the scenario about which parts are illustrative. */
  notes: readonly string[];
}

/** The F1C worked example, condensed: the legacy file unchanged, the testbench's key lines. */
export const LEGACY_CNT_SCENARIO: RegionScenario = {
  id: "legacy_cnt",
  title: "legacy_cnt.v, then tb_top.sv",
  summary: "The worked example: a Verilog-2001 counter with a port named logic, and a SystemVerilog testbench that connects to it.",
  files: [
    {
      name: "legacy_cnt.v",
      lines: [
        "// legacy_cnt.v: legal IEEE 1364-2001 Verilog.",
        "`timescale 1ns/1ps",
        '`begin_keywords "1364-2001"',
        "module legacy_cnt (clk, rst, logic);",
        "  input        clk;",
        "  input        rst;",
        "  output [7:0] logic;",
        "  reg    [7:0] logic;",
        "  always @(posedge clk)",
        "    if (rst) logic <= 8'd0;",
        "    else     logic <= logic + 8'd1;",
        "endmodule",
        "`end_keywords",
      ],
    },
    {
      name: "tb_top.sv",
      lines: [
        "// tb_top.sv: no directive in this file.",
        "`timescale 1ns/1ps",
        "module tb_top;",
        "  logic       clk = 1'b0;",
        "  logic       rst = 1'b1;",
        "  logic [7:0] q;",
        "  legacy_cnt u_cnt (.clk(clk), .rst(rst), .\\logic (q));",
        "  // clock, reset and the q == 3 check as in the worked example",
        "endmodule",
      ],
    },
  ],
  watch: ["logic"],
  defaultAssumption: "1800-2023",
  notes: [
    "tb_top.sv is shortened to the lines that use logic; the clock and the check are as in the worked example.",
    "Files are read in the order shown, in one compilation.",
  ],
};

/** The Push Further stack: a pair left open across a file boundary, a nested pair, `resetall, and an unknown specifier. */
export const NESTED_STACK_SCENARIO: RegionScenario = {
  id: "nested_stack",
  title: "legacy_a.v, then legacy_b.v",
  summary: "A pair left open at the end of one file, a nested pair in the next, a `resetall, and a specifier no standard defines.",
  files: [
    {
      name: "legacy_a.v",
      lines: [
        '`begin_keywords "1364-2001"',
        "module legacy_a (d);",
        "  input signed [7:0] d;",
        "endmodule",
        "// no `end_keywords in this file",
      ],
    },
    {
      name: "legacy_b.v",
      lines: [
        '`begin_keywords "1364-1995"',
        "`resetall",
        "module legacy_b;",
        "  wire signed;",
        "endmodule",
        "`end_keywords",
        "`end_keywords",
        '`begin_keywords "1364-2000"',
      ],
    },
  ],
  watch: ["signed"],
  defaultAssumption: null,
  notes: [
    "The specifiers 1364-1995 and 1364-2000 are chosen for the illustration; 1364-2000 is not in Syntax 22-10.",
    "Files are read in the order shown, in one compilation.",
  ],
};

export const REGION_SCENARIOS: Record<string, RegionScenario> = {
  legacy_cnt: LEGACY_CNT_SCENARIO,
  nested_stack: NESTED_STACK_SCENARIO,
};

/** The steps of a scenario under a tool-default assumption (null: unknown). */
export const scenarioSteps = (scenario: RegionScenario, assumption: VersionSpecifier | null = scenario.defaultAssumption) =>
  walkRegions(scenario.files, { kind: "default", assumed: assumption }, scenario.watch);

/**
 * The prediction for a scenario, computed from its steps.
 * legacy_cnt: before tb_top.sv, would .logic(q) compile there?
 * nested_stack: before the `resetall, which set is in effect after it?
 */
export function regionGate(scenario: RegionScenario, steps: readonly RegionStep[]): RegionGate | null {
  if (scenario.id === "legacy_cnt") {
    const boundary = steps.find((s) => s.event === "file-boundary");
    if (!boundary) return null;
    const port = namedPortConnection("logic", boundary.effective);
    const options = [
      {
        id: "compiles",
        label: "It compiles: the legacy file's \"1364-2001\" pair still applies",
        correct: port.verdict === "compiles",
        feedback:
          port.verdict === "compiles"
            ? port.explanation
            : "The pair ended at legacy_cnt.v's `end_keywords, which restored the set in effect before it (22.14). Nothing carries into tb_top.sv.",
      },
      {
        id: "error",
        label: "Syntax error: logic is a keyword in tb_top.sv",
        correct: port.verdict === "error",
        feedback:
          port.verdict === "error"
            ? port.explanation
            : port.verdict === "compiles"
              ? port.explanation
              : "Only if the tool's default set reserves logic. With no directive in the file, that default is implementation dependent (22.14).",
      },
      {
        id: "depends",
        label: "It depends on the tool's default keyword set",
        correct: port.verdict === "implementation-dependent",
        feedback:
          port.verdict === "implementation-dependent"
            ? port.explanation
            : `Not under this scenario: it assumes the tool default is "${scenario.defaultAssumption}". With no assumption, it would depend on the tool (22.14).`,
      },
    ];
    return {
      stepIndex: boundary.index - 1,
      question: "tb_top.sv comes next, with no directive in it. Would .logic(q) compile there?",
      options,
    };
  }
  if (scenario.id === "nested_stack") {
    const resetStep = steps.find((s) => s.event === "resetall");
    if (!resetStep) return null;
    const after = resetStep.effective;
    const before = steps[resetStep.index - 1]?.effective;
    const label = (s: KeywordSetting) => settingLabel(s);
    const outer = resetStep.stack.length > 1 ? directive(resetStep.stack[resetStep.stack.length - 2]) : null;
    const candidates: { id: string; setting: KeywordSetting }[] = [
      { id: "same", setting: after },
      { id: "default", setting: { kind: "default", assumed: scenario.defaultAssumption } },
      ...(outer ? [{ id: "outer", setting: outer }] : []),
    ];
    const options = candidates.map((c) => {
      const correct = c.id === "same";
      return {
        id: c.id,
        label: c.id === "same" ? `${label(after)}: unchanged` : c.id === "default" ? `${label(c.setting)}: the stack is cleared` : `${label(c.setting)}: only the inner pair is dropped`,
        correct,
        feedback: correct
          ? `The results of \`begin_keywords and \`end_keywords are not affected by \`resetall (22.14), so ${label(after)} stays in effect, as before it${before ? ` (${label(before)})` : ""}.`
          : "`resetall resets other compiler directives to their defaults (22.3), but 22.14 says the keyword directives' results are not affected by it.",
      };
    });
    return { stepIndex: resetStep.index - 1, question: "legacy_b.v is about to run `resetall. Which keyword set is in effect after it?", options };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lineage: two lanes of standards and the keyword table each added
// ---------------------------------------------------------------------------

export type Lane = "systemverilog" | "uvm";

export interface LineageStop {
  id: string;
  lane: Lane;
  label: string;
  /** True for an IEEE standard; pre-IEEE names are placed in order only. */
  ieee: boolean;
  /** For a 1364 or 1800 standard, the specifier naming its keyword set. */
  specifier: VersionSpecifier | null;
  /** The answer to "which document(s) define the whole language here?" */
  documents: readonly string[];
  /** Plain explanation of that answer, with its source. */
  definesNote: string;
  /** Another document this one relied on for the base language. */
  reliesOn: string | null;
  /** Things attached to this stop, such as a library implementing it. */
  attachments: readonly string[];
  /** Where the facts on this stop come from. */
  source: string;
}

/** The year in a standard designation such as IEEE 1800-2009 or IEEE 1800.2-2020; null for pre-IEEE names. */
export function designationYear(stop: Pick<LineageStop, "label" | "ieee">): number | null {
  if (!stop.ieee) return null;
  const m = /-(\d{4})$/.exec(stop.label);
  return m ? Number(m[1]) : null;
}

const verilogStop = (spec: "1364-1995" | "1364-2001" | "1364-2005"): LineageStop => ({
  id: spec,
  lane: "systemverilog",
  label: `IEEE ${spec}`,
  ieee: true,
  specifier: spec,
  documents: [`IEEE ${spec}`],
  definesNote:
    spec === "1364-2005"
      ? "Verilog, a self-contained standard (IEEE 1800-2023 1.3 NOTE)."
      : `The Verilog standard of this revision; its keyword set is "${spec}" (22.14).`,
  reliesOn: null,
  attachments: [],
  source: spec === "1364-2005" ? "IEEE 1800-2023 1.3 NOTE, 22.14" : "IEEE 1800-2023 22.14",
});

const svStop = (spec: "1800-2005" | "1800-2009" | "1800-2012" | "1800-2017" | "1800-2023"): LineageStop => {
  if (spec === "1800-2005") {
    return {
      id: spec,
      lane: "systemverilog",
      label: "IEEE 1800-2005",
      ieee: true,
      specifier: spec,
      documents: ["IEEE 1800-2005", "IEEE 1364-2005"],
      definesNote: "Two documents: IEEE 1800-2005 held only the extensions and referred to, and relied on, IEEE 1364-2005 for the base Verilog language (IEEE 1800-2023 1.3 NOTE, 1.4 NOTE).",
      reliesOn: "IEEE 1364-2005",
      attachments: [],
      source: "IEEE 1800-2023 1.3 NOTE, 1.4 NOTE, 22.14.6",
    };
  }
  return {
    id: spec,
    lane: "systemverilog",
    label: `IEEE ${spec}`,
    ieee: true,
    specifier: spec,
    documents: [`IEEE ${spec}`],
    definesNote:
      spec === "1800-2009"
        ? "One document: IEEE 1800-2009 merged IEEE 1364-2005 and IEEE 1800-2005, so all syntax and semantics are in a single standard (IEEE 1800-2023 1.3 NOTE)."
        : `One document: since the 2009 merger, IEEE 1800 alone defines the whole language (IEEE 1800-2023 1.3 NOTE).`,
    reliesOn: null,
    attachments: [],
    source: `IEEE 1800-2023 1.3 NOTE, ${SPECIFIER_INFO[spec].clause}`,
  };
};

/** Stops in reading order; pre-IEEE names sit just before the standard they led to and carry no date. */
export const LINEAGE_STOPS: readonly LineageStop[] = [
  verilogStop("1364-1995"),
  verilogStop("1364-2001"),
  verilogStop("1364-2005"),
  {
    id: "sv31a",
    lane: "systemverilog",
    label: "SystemVerilog 3.1a",
    ieee: false,
    specifier: null,
    documents: ["SystemVerilog 3.1a (the extensions, Accellera)", "IEEE 1364 (the base Verilog)"],
    definesNote:
      "Two parts: Accellera's SystemVerilog 3.1a extensions to the Verilog HDL (IEEE 1800-2023 Introduction, informative), on top of IEEE 1364 for the base Verilog. 3.1a is a precursor to IEEE 1800-2005 (IEEE 1800-2023 1.4). It is not an IEEE standard and has no keyword table in 22.14.",
    reliesOn: "IEEE 1364",
    attachments: [],
    source: "IEEE 1800-2023 Introduction (informative), 1.4",
  },
  svStop("1800-2005"),
  svStop("1800-2009"),
  svStop("1800-2012"),
  svStop("1800-2017"),
  svStop("1800-2023"),
  {
    id: "ovm",
    lane: "uvm",
    label: "OVM",
    ieee: false,
    specifier: null,
    documents: ["Not a language standard; see IEEE 1800 for the language"],
    definesNote:
      "The Open Verification Methodology, which UVM is built on (IEEE 1800.2-2020 informative Introduction). A methodology, not a language. No source checked here states which language revision OVM was written against, so no document is named for it.",
    reliesOn: null,
    attachments: [],
    source: "IEEE 1800.2-2020 Introduction (informative)",
  },
  {
    id: "accellera-uvm",
    lane: "uvm",
    label: "Accellera UVM Pre-IEEE Class Reference",
    ieee: false,
    specifier: null,
    documents: ["Not a language standard; see IEEE 1800 for the language"],
    definesNote:
      "Acknowledged as source material by IEEE 1800.2-2020's front matter. A class reference, not a language. No source checked here states which language revision it was written against, so no document is named for it.",
    reliesOn: null,
    attachments: [],
    source: "IEEE 1800.2-2020 front matter",
  },
  {
    id: "1800.2-2017",
    lane: "uvm",
    label: "IEEE 1800.2-2017",
    ieee: true,
    specifier: null,
    documents: ["IEEE 1800 (the language)", "IEEE 1800.2-2017 (the UVM API)"],
    definesNote:
      "The UVM standard that IEEE 1800.2-2020 revises (1800.2-2020 front matter). UVM is a set of APIs defining a base class library, based on IEEE 1800, not a language (scope as stated in IEEE 1800.2-2020 1.1), and adds no keyword table to 22.14. The 2017 edition's own normative references are not among the sources checked here, so no reliance is recorded for it.",
    reliesOn: null,
    attachments: [],
    source: "IEEE 1800.2-2020 front matter and 1.1 Scope",
  },
  {
    id: "1800.2-2020",
    lane: "uvm",
    label: "IEEE 1800.2-2020",
    ieee: true,
    specifier: null,
    documents: ["IEEE 1800 (the language)", "IEEE 1800.2-2020 (the UVM API)"],
    definesNote:
      "UVM is a set of APIs defining a base class library based on IEEE 1800, not a language (1800.2 1.1 Scope), and IEEE 1800.2-2020 names IEEE 1800 as its normative reference (1800.2 Clause 2). It adds no keyword table to 22.14.",
    reliesOn: "IEEE 1800",
    attachments: ["uvm-core 2020.3.1: Accellera's library matching the requirements of IEEE 1800.2-2020 (uvm-core README)"],
    source: "IEEE 1800.2-2020 front matter, 1.1 Scope and Clause 2; uvm-core 2020.3.1 README",
  },
];

/** The keyword table a stop's revision added, if any (22.14.2 to 22.14.9). */
export function tableAddedBy(stop: LineageStop): KeywordTable | null {
  if (!stop.specifier) return null;
  const adds = SPECIFIER_INFO[stop.specifier].adds;
  return adds ? tableById(adds) : null;
}

/** A sentence about the stop's keyword table, generated from the model. */
export function tableSentence(stop: LineageStop): string {
  const table = tableAddedBy(stop);
  if (table) {
    const base = table.id === "22-1";
    const noun = table.words.length === 1 ? "reserved word" : "reserved words";
    return `Table ${table.id} (${table.clause}): ${table.words.length} ${noun}${base ? ", the base list" : " added"}. The "${stop.specifier}" set holds ${reservedWords(stop.specifier as VersionSpecifier).size} words in all.`;
  }
  if (stop.specifier) {
    return `No new table: "${stop.specifier}" adds no reserved keywords (22.14.9). Its set holds ${reservedWords(stop.specifier).size} words, the Annex B list.`;
  }
  return "No keyword table: 22.14 lists tables only for IEEE 1364 and IEEE 1800 revisions.";
}

/** The years placed on the axis: only those in IEEE designations. */
export const LINEAGE_YEARS: readonly number[] = [...new Set(LINEAGE_STOPS.map(designationYear).filter((y): y is number => y !== null))].sort((a, b) => a - b);

/**
 * In a given year, which document defined the base Verilog language (such as
 * always @(posedge clk))? The newest IEEE 1800 stop whose designation year is
 * at or before it; if that one relied on another document for the base
 * language, that document. Before IEEE 1800, the newest IEEE 1364.
 * Years are from the designations only.
 */
export function baseLanguageDocument(year: number): string | null {
  const dated = LINEAGE_STOPS.filter((s) => s.lane === "systemverilog" && s.ieee && (designationYear(s) ?? Infinity) <= year);
  const sv = dated.filter((s) => s.label.startsWith("IEEE 1800")).pop();
  if (sv) return sv.reliesOn ?? sv.label;
  const verilog = dated.pop();
  return verilog ? verilog.label : null;
}

/** Words of a construct and the table that introduced each (used to show always @(posedge clk) is base Verilog). */
export function constructTables(construct: string): { word: string; table: KeywordTable | null }[] {
  const names = construct.match(/[A-Za-z_][A-Za-z0-9_$]*/g) ?? [];
  return [...new Set(names)].map((word) => ({ word, table: tableIntroducing(word) }));
}

/** Among the tables that add to an earlier list (22-2 to 22-6), the largest. Table 22-1 is the base list. */
export function largestAddition(): KeywordTable {
  const additions = KEYWORD_TABLES.filter((t) => t.id !== "22-1");
  return additions.reduce((best, t) => (t.words.length > best.words.length ? t : best));
}

export interface LineagePrediction {
  id: string;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
}

/** The two lineage predictions, with answers and feedback computed from the model. */
export function lineagePredictions(): LineagePrediction[] {
  const year = 2006;
  const construct = "always @(posedge clk)";
  const answer = baseLanguageDocument(year);
  const parts = constructTables(construct).filter((p) => p.table);
  const partText = parts.map((p) => `${p.word} (Table ${p.table?.id})`).join(" and ");
  const svIn = LINEAGE_STOPS.filter((s) => s.label.startsWith("IEEE 1800-") && (designationYear(s) ?? Infinity) <= year).pop();
  const why = `${partText} are base Verilog keywords. In ${year} the newest SystemVerilog standard was ${svIn?.label}, which held only the extensions and relied on ${svIn?.reliesOn} for the base language (IEEE 1800-2023 1.3 NOTE). So ${answer} defines it.`;
  const q1Options = ["IEEE 1364-2005", "IEEE 1800-2005", "IEEE 1800-2009", "SystemVerilog 3.1a"].map((label) => ({
    id: label,
    label,
    correct: label === answer,
    feedback:
      label === answer
        ? why
        : label === "IEEE 1800-2005"
          ? `IEEE 1800-2005 was not self-contained: it relied on IEEE 1364-2005 for the base language (1.3 NOTE). ${construct} is base Verilog.`
          : label === "IEEE 1800-2009"
            ? `Its designation year, 2009, is after ${year}. It is the revision that merged the two documents (1.3 NOTE).`
            : "SystemVerilog 3.1a is an Accellera manual, a precursor to IEEE 1800-2005 (1.4), not an IEEE standard.",
  }));

  const largest = largestAddition();
  const sizes = KEYWORD_TABLES.filter((t) => t.id !== "22-1")
    .map((t) => `${t.revision} ${t.words.length}`)
    .join(", ");
  const base = tableById("22-1");
  const q2Labels: VersionSpecifier[] = ["1364-2001", "1800-2005", "1800-2009", "1800-2012"];
  const q2Options = q2Labels.map((spec) => {
    const table = tableById(SPECIFIER_INFO[spec].adds as TableId);
    const correct = table.id === largest.id;
    return {
      id: spec,
      label: `IEEE ${spec}`,
      correct,
      feedback: correct
        ? `Table ${largest.id} adds ${largest.words.length} words, the most of any addition (${sizes}). Table 22-1, the 1364-1995 base list, has ${base.words.length}.`
        : `Table ${table.id} adds ${table.words.length} words; Table ${largest.id} (${largest.revision}) adds ${largest.words.length}.`,
    };
  });

  return [
    { id: "base-language", question: `In ${year}, which document defines ${construct}?`, options: q1Options },
    {
      id: "most-words",
      question: "Which revision added the most reserved words to the list before it (Tables 22-2 to 22-6)?",
      options: q2Options,
    },
  ];
}
