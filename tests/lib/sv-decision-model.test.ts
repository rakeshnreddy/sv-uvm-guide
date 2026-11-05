import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BIT4_VALUES,
  caseItemMatches,
  compare,
  parseBits,
  type Bit4,
  type CaseKind,
} from "@/lib/sv-four-state-model";
import {
  COMPARE_SETS,
  DECISION_FORMS,
  DECISION_PRESETS,
  DEFERRED_REPORT_NOTE,
  CODE_LINE_FIT,
  MATCH_COLUMNS,
  OWN_VALUE_NOTE,
  QUALIFIERS,
  RANGE_LIST_LIMIT,
  REPORT_KINDS,
  WILDCARD_ASYMMETRY_NOTE,
  bitAt,
  branchWord,
  caseBitChips,
  chipMarks,
  compareDecisions,
  compareValueNote,
  compareWrapUp,
  decisionSource,
  deferredReportNote,
  drawsChips,
  editedPresetNote,
  evaluateDecision,
  expandRange,
  explainReportChoice,
  explainRunChoice,
  findCompareSet,
  findPreset,
  freshWhys,
  gridCell,
  isPlainMiss,
  isPresetEdited,
  itemMissLine,
  laterMatchBadge,
  matchColumnLabel,
  nextSelectValue,
  normalizeItems,
  orReduce,
  outcomeGrid,
  parseLiteral,
  presetValueNote,
  rangeContains,
  rangeListingProblem,
  reportsNoMatch,
  reportsOverlap,
  runChoices,
  runOutcomeId,
  runningLineKey,
  splitSentences,
  triedProgress,
  wildcardBitChips,
  withSelect,
  type DecisionConfig,
  type DecisionForm,
  type DecisionItem,
  type Qualifier,
  type ReportKind,
} from "@/lib/sv-decision-model";

const lit = (text: string): DecisionItem => ({ terms: [{ kind: "literal", text }] });
const bits = (s: string): Bit4[] => parseBits(s);

/** Shorthand: which item runs ("item-N" / "catch-all" / "nothing") and what is reported. */
function outcome(config: DecisionConfig, select: string): [string, ReportKind] {
  const r = evaluateDecision(withSelect(config, select));
  return [runOutcomeId(r.runs), r.reportKind];
}

const decoder = (qualifier: Qualifier, catchAll = false, form: DecisionForm = "case"): DecisionConfig => ({
  form,
  qualifier,
  catchAll,
  selectName: "sel",
  select: bits("01"),
  items: [lit("2'b00"), lit("2'b01"), lit("2'b10")],
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: literals and bit-selects", () => {
  it("parses sized binary, ?, decimal, hex and unsized decimals (§5.7.1)", () => {
    expect(parseLiteral("2'b1?", 2)).toEqual(["1", "z"]);
    expect(parseLiteral("3'b0?0", 3)).toEqual(["0", "z", "0"]);
    expect(parseLiteral("4'd7", 4)).toEqual(["0", "1", "1", "1"]);
    expect(parseLiteral("8'hF0", 8)).toEqual(bits("11110000"));
    expect(parseLiteral("3", 3)).toEqual(["0", "1", "1"]);
    expect(parseLiteral("1", 3)).toEqual(["0", "0", "1"]);
    // An unsized number wider than the select keeps its bits; comparisons zero-extend the select (§11.4.5).
    expect(parseLiteral("8", 3)).toEqual(["1", "0", "0", "0"]);
  });

  it("pads a short sized literal with 0, or with x / z when the leftmost written bit is x / z (§5.7.1)", () => {
    expect(parseLiteral("4'b1", 4)).toEqual(["0", "0", "0", "1"]);
    expect(parseLiteral("4'bx1", 4)).toEqual(["x", "x", "x", "1"]);
    expect(parseLiteral("4'bz", 4)).toEqual(["z", "z", "z", "z"]);
    expect(parseLiteral("2'b1011", 2)).toEqual(["1", "1"]);
  });

  it("rejects text that is not a literal", () => {
    expect(() => parseLiteral("abc", 3)).toThrow();
    expect(() => parseLiteral("3'd1x", 3)).toThrow();
  });

  it("bitAt reads bit 0 as the LSB and an out-of-range bit-select as x (§11.5.1)", () => {
    expect(bitAt(bits("011"), 0)).toBe("1");
    expect(bitAt(bits("011"), 2)).toBe("0");
    expect(bitAt(bits("011"), 3)).toBe("x");
    expect(bitAt(bits("011"), -1)).toBe("x");
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: comparison chips agree with the four-state model", () => {
  it("case / casez / casex chips: no 0-chip exactly when caseItemMatches says match (§12.5, §12.5.1)", () => {
    const kinds: CaseKind[] = ["case", "casez", "casex"];
    let checked = 0;
    for (const kind of kinds) {
      for (const a1 of BIT4_VALUES) for (const a0 of BIT4_VALUES) for (const b1 of BIT4_VALUES) for (const b0 of BIT4_VALUES) {
        const expr: Bit4[] = [a1, a0];
        const item: Bit4[] = [b1, b0];
        const chips = caseBitChips(kind, expr, item);
        expect(chips.map((c) => c.index)).toEqual([1, 0]);
        expect(chips.every((c) => c.verdict !== "0")).toBe(caseItemMatches(kind, expr, item));
        checked += 1;
      }
    }
    expect(checked).toBe(3 * 256);
  });

  it("casez skips z and ? in either operand; casex also skips x; case skips nothing (§12.5.1)", () => {
    expect(caseBitChips("case", bits("x1"), bits("x1")).map((c) => c.verdict)).toEqual(["1", "1"]);
    expect(caseBitChips("case", bits("x1"), bits("01")).map((c) => c.verdict)).toEqual(["0", "1"]);
    expect(caseBitChips("casez", bits("x1"), bits("01")).map((c) => c.verdict)).toEqual(["0", "1"]);
    expect(caseBitChips("casez", bits("z1"), bits("01")).map((c) => c.verdict)).toEqual(["skip", "1"]);
    expect(caseBitChips("casez", bits("01"), bits("?1")).map((c) => c.verdict)).toEqual(["skip", "1"]);
    expect(caseBitChips("casex", bits("x1"), bits("01")).map((c) => c.verdict)).toEqual(["skip", "1"]);
  });

  it("==? chips: x/z in the item are wildcards, x/z in the select are ambiguous, and the OR of the chips is compare's result (§11.4.6)", () => {
    for (const a1 of BIT4_VALUES) for (const a0 of BIT4_VALUES) for (const b1 of BIT4_VALUES) for (const b0 of BIT4_VALUES) {
      const left: Bit4[] = [a1, a0];
      const right: Bit4[] = [b1, b0];
      const chips = wildcardBitChips(left, right);
      const expected = compare("==?", left, right).result;
      const folded: Bit4 = chips.some((c) => c.verdict === "0") ? "0" : chips.some((c) => c.verdict === "x") ? "x" : "1";
      expect(folded).toBe(expected);
      for (const c of chips) {
        if (c.right === "x" || c.right === "z") expect(c).toMatchObject({ verdict: "1", wildcard: true });
        else if (c.left === "x" || c.left === "z") expect(c.verdict).toBe("x");
      }
    }
  });

  it("the lesson's bit table (flow-control): the asymmetric rows", () => {
    // select x against item 0: casex skips, case inside is unknown
    expect(caseBitChips("casex", ["x"], ["0"])[0].verdict).toBe("skip");
    expect(wildcardBitChips(["x"], ["0"])[0].verdict).toBe("x");
    // select z against item 1: casez and casex skip, case inside is unknown
    expect(caseBitChips("casez", ["z"], ["1"])[0].verdict).toBe("skip");
    expect(wildcardBitChips(["z"], ["1"])[0].verdict).toBe("x");
    // select 0 against item x: only casex and case inside accept it
    expect(caseBitChips("case", ["0"], ["x"])[0].verdict).toBe("0");
    expect(caseBitChips("casez", ["0"], ["x"])[0].verdict).toBe("0");
    expect(caseBitChips("casex", ["0"], ["x"])[0].verdict).toBe("skip");
    expect(wildcardBitChips(["0"], ["x"])[0]).toMatchObject({ verdict: "1", wildcard: true });
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: inside operator pieces (§11.4.13, §11.4.4)", () => {
  it("orReduce is 1 if any comparison is 1, 0 if all are 0, otherwise x (§11.4.13, §11.4.7)", () => {
    expect(orReduce(["0", "1", "x"])).toBe("1");
    expect(orReduce(["0", "0"])).toBe("0");
    expect(orReduce(["0", "x"])).toBe("x");
    expect(orReduce([])).toBe("x");
  });

  it("a range is inclusive, empty when lo > hi, and x when any operand holds x or z (§11.4.13, §11.4.4)", () => {
    expect(rangeContains(bits("100"), bits("100"), bits("110"))).toBe("1");
    expect(rangeContains(bits("110"), bits("100"), bits("110"))).toBe("1");
    expect(rangeContains(bits("111"), bits("100"), bits("110"))).toBe("0");
    expect(rangeContains(bits("011"), bits("100"), bits("110"))).toBe("0");
    expect(rangeContains(bits("101"), bits("110"), bits("100"))).toBe("0");
    expect(rangeContains(bits("1x0"), bits("100"), bits("110"))).toBe("x");
    expect(rangeContains(bits("101"), bits("1x0"), bits("110"))).toBe("x");
  });

  it("a reversed range with known bounds contains no values, so even an x select gives 0, not x (§11.4.13)", () => {
    expect(rangeContains(bits("1x0"), bits("110"), bits("100"))).toBe("0");
    expect(rangeContains(bits("xxx"), bits("110"), bits("100"))).toBe("0");
    // An unknown bound cannot be called reversed: the relational comparison stays x (§11.4.4).
    expect(rangeContains(bits("101"), bits("1x0"), bits("000"))).toBe("x");
    const r = evaluateDecision({ form: "case-inside", qualifier: "plain", catchAll: false, selectName: "op", select: bits("1x0"), items: [{ terms: [{ kind: "range", lo: "6", hi: "4" }] }] });
    expect(r.items[0].result).toBe("0");
    expect(r.items[0].terms[0].why).toMatch(/is empty: its low bound exceeds its high bound \(§11\.4\.13\)/);
  });

  it("the standard's example: 3'bz11 inside {3'b1?1, 3'b011} is x (§11.4.13)", () => {
    const r = evaluateDecision({
      form: "case-inside",
      qualifier: "plain",
      catchAll: false,
      selectName: "v",
      select: bits("z11"),
      items: [{ terms: [{ kind: "literal", text: "3'b1?1" }, { kind: "literal", text: "3'b011" }] }],
    });
    expect(r.items[0].result).toBe("x");
    expect(r.items[0].matches).toBe(false);
    expect(r.runs).toEqual({ kind: "nothing" });
  });

  it("expandRange lists a small known range and refuses unknown bounds, wide ranges and empty ranges", () => {
    expect(expandRange({ kind: "range", lo: "3'b100", hi: "3'b110" }, 3)).toEqual(["3'b100", "3'b101", "3'b110"]);
    expect(expandRange({ kind: "range", lo: "4", hi: "7" }, 3)).toEqual(["3'b100", "3'b101", "3'b110", "3'b111"]);
    expect(expandRange({ kind: "range", lo: "3'b1x0", hi: "3'b110" }, 3)).toBeNull();
    expect(expandRange({ kind: "range", lo: "0", hi: "100", }, 8)).toBeNull();
    expect(expandRange({ kind: "range", lo: "6", hi: "4" }, 3)).toBeNull();
    // The listing limit: 64 values fit, 65 do not.
    expect(RANGE_LIST_LIMIT).toBe(64);
    expect(expandRange({ kind: "range", lo: "0", hi: "63" }, 6)).toHaveLength(64);
    expect(expandRange({ kind: "range", lo: "0", hi: "64" }, 7)).toBeNull();
  });

  it("rangeListingProblem names the problem: an x/z bound, an empty range (§11.4.13) or too many values; null for a listable range", () => {
    expect(rangeListingProblem({ kind: "range", lo: "3'b100", hi: "3'b110" }, 3)).toBeNull();
    expect(rangeListingProblem({ kind: "range", lo: "3'b1x0", hi: "3'b110" }, 3)).toMatch(/x or z/);
    expect(rangeListingProblem({ kind: "range", lo: "6", hi: "4" }, 3)).toMatch(/empty \(§11\.4\.13\)/);
    expect(rangeListingProblem({ kind: "range", lo: "0", hi: "100" }, 8)).toMatch(/101 values, more than the 64/);
  });

  it("normalizeItems expands ranges for the case family only (§12.5, §12.5.4: a range is legal only in case inside)", () => {
    const items: DecisionItem[] = [{ terms: [{ kind: "range", lo: "3'b100", hi: "3'b110" }], label: "ALU" }];
    expect(normalizeItems("casex", items, 3)[0].terms.map((t) => (t.kind === "literal" ? t.text : t.kind))).toEqual(["3'b100", "3'b101", "3'b110"]);
    expect(normalizeItems("case-inside", items, 3)).toEqual(items);
    expect(normalizeItems("if-else-if", items, 3)).toEqual(items);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: the two qualifier predicates (§12.5.3, §12.4.2)", () => {
  it("unique and priority report a missing match; unique0 and plain do not", () => {
    expect(QUALIFIERS.filter(reportsNoMatch)).toEqual(["unique", "priority"]);
  });
  it("unique and unique0 report an overlap; priority and plain do not", () => {
    expect(QUALIFIERS.filter(reportsOverlap)).toEqual(["unique", "unique0"]);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: the lesson decoder table (flow-control, unique case with no default)", () => {
  // | sel | plain | unique | unique0 | priority | unique with default |
  it("sel = 2'b01: item 01 runs under every form, silently (§12.5)", () => {
    for (const q of QUALIFIERS) expect(outcome(decoder(q), "01")).toEqual(["item-1", "nothing"]);
    expect(outcome(decoder("unique", true), "01")).toEqual(["item-1", "nothing"]);
  });

  it("sel = 2'b11: nothing runs; unique and priority report, plain and unique0 are silent, a default runs silently (§12.5.3)", () => {
    expect(outcome(decoder("plain"), "11")).toEqual(["nothing", "nothing"]);
    expect(outcome(decoder("unique"), "11")).toEqual(["nothing", "no-match"]);
    expect(outcome(decoder("unique0"), "11")).toEqual(["nothing", "nothing"]);
    expect(outcome(decoder("priority"), "11")).toEqual(["nothing", "no-match"]);
    expect(outcome(decoder("unique", true), "11")).toEqual(["catch-all", "nothing"]);
  });

  it("sel = 2'bxx: a plain comparison treats x literally, so the row reads like 2'b11 (§12.5, §12.5.3)", () => {
    expect(outcome(decoder("plain"), "xx")).toEqual(["nothing", "nothing"]);
    expect(outcome(decoder("unique"), "xx")).toEqual(["nothing", "no-match"]);
    expect(outcome(decoder("unique0"), "xx")).toEqual(["nothing", "nothing"]);
    expect(outcome(decoder("priority"), "xx")).toEqual(["nothing", "no-match"]);
    expect(outcome(decoder("unique", true), "xx")).toEqual(["catch-all", "nothing"]);
  });

  it("a plain case with no default and no match reads 'nothing runs, nothing reported' (§12.5)", () => {
    const r = evaluateDecision(withSelect(decoder("plain"), "11"));
    expect(r.report).toBeNull();
    expect(r.summary).toMatch(/nothing runs/i);
    expect(r.summary).toMatch(/Nothing is reported/);
    expect(r.silentBecause).toMatch(/§12\.5/);
  });

  it("the no-match ticket names the clause and the deferred report (§12.5.3, §12.4.2.1, §12.5.3.1)", () => {
    const r = evaluateDecision(withSelect(decoder("unique"), "xx"));
    expect(r.report).toMatchObject({ kind: "no-match", clause: "§12.5.3", deferred: DEFERRED_REPORT_NOTE });
    expect(r.report?.title).toBe("unique case: no case item matches");
    expect(r.column).toBe("none");
    expect(r.items.map((v) => v.status)).toEqual(["no-match", "no-match", "no-match"]);
  });

  it("the timing line says both halves of §12.4.2.1: the check runs when the statement executes, the report waits for the Observed region", () => {
    // §12.5.3.1 applies the §12.4.2.1 mechanics to a case, so a case cites both clauses.
    expect(DEFERRED_REPORT_NOTE).toBe("checked now, reported in the Observed region (§12.4.2.1, §12.5.3.1)");
    expect(deferredReportNote("casez")).toBe(DEFERRED_REPORT_NOTE);
    expect(deferredReportNote("case-inside")).toBe(DEFERRED_REPORT_NOTE);
    // §12.5.3.1 covers only unique-case, unique0-case and priority-case: an if chain cites §12.4.2.1 alone.
    expect(deferredReportNote("if-else-if")).toBe("checked now, reported in the Observed region (§12.4.2.1)");
  });
});

describe("sv-decision-model: the lesson's casez overlap (2'b1? and 2'b?1 with sel = 11)", () => {
  const overlap = (qualifier: Qualifier): DecisionConfig => ({
    form: "casez",
    qualifier,
    catchAll: false,
    selectName: "sel",
    select: bits("11"),
    items: [lit("2'b1?"), lit("2'b?1")],
  });

  it("every form runs the first item, 2'b1?; unique and unique0 also report the overlap (§12.5.3)", () => {
    expect(outcome(overlap("plain"), "11")).toEqual(["item-0", "nothing"]);
    expect(outcome(overlap("unique"), "11")).toEqual(["item-0", "overlap"]);
    expect(outcome(overlap("unique0"), "11")).toEqual(["item-0", "overlap"]);
    expect(outcome(overlap("priority"), "11")).toEqual(["item-0", "nothing"]);
  });

  it("comparisons continue after the first match: the second item is marked 'matches, not run' (§12.5.3)", () => {
    const r = evaluateDecision(overlap("unique"));
    expect(r.items.map((v) => v.status)).toEqual(["runs", "matches-not-run"]);
    expect(r.matchCount).toBe(2);
    expect(r.column).toBe("many");
    expect(r.report?.title).toBe("unique casez: 2 case items match");
  });

  it("one case item that lists several matching expressions is not an overlap (§12.5.3)", () => {
    const r = evaluateDecision({
      form: "casez",
      qualifier: "unique",
      catchAll: false,
      selectName: "sel",
      select: bits("11"),
      items: [{ terms: [{ kind: "literal", text: "2'b1?" }, { kind: "literal", text: "2'b?1" }] }, lit("2'b00")],
    });
    expect(r.matchCount).toBe(1);
    expect(r.reportKind).toBe("nothing");
    expect(r.items[0].terms.map((t) => t.result)).toEqual(["1", "1"]);
  });
});

describe("sv-decision-model: the lesson's unique-if table (req 10, 11, 00) (§12.4.2)", () => {
  const chain = (qualifier: Qualifier, catchAll = false): DecisionConfig => ({
    form: "if-else-if",
    qualifier,
    catchAll,
    selectName: "req",
    select: bits("10"),
    items: [{ terms: [{ kind: "bit", index: 0 }] }, { terms: [{ kind: "bit", index: 1 }] }],
  });

  it("req = 2'b10: the second branch runs under every form", () => {
    for (const q of QUALIFIERS) expect(outcome(chain(q), "10")).toEqual(["item-1", "nothing"]);
  });

  it("req = 2'b11: the first branch runs; unique and unique0 report the overlap, plain and priority are silent", () => {
    expect(outcome(chain("plain"), "11")).toEqual(["item-0", "nothing"]);
    expect(outcome(chain("unique"), "11")).toEqual(["item-0", "overlap"]);
    expect(outcome(chain("unique0"), "11")).toEqual(["item-0", "overlap"]);
    expect(outcome(chain("priority"), "11")).toEqual(["item-0", "nothing"]);
  });

  it("req = 2'b00: nothing runs; unique and priority report, plain and unique0 are silent; a final else removes the report", () => {
    expect(outcome(chain("plain"), "00")).toEqual(["nothing", "nothing"]);
    expect(outcome(chain("unique"), "00")).toEqual(["nothing", "no-match"]);
    expect(outcome(chain("unique0"), "00")).toEqual(["nothing", "nothing"]);
    expect(outcome(chain("priority"), "00")).toEqual(["nothing", "no-match"]);
    expect(outcome(chain("unique", true), "00")).toEqual(["catch-all", "nothing"]);
    expect(evaluateDecision(withSelect(chain("unique"), "00")).report?.clause).toBe("§12.4.2");
  });

  it("an x condition is false (§12.4): req = 2'bx1 runs the first branch only", () => {
    const r = evaluateDecision(withSelect(chain("unique"), "x1"));
    expect(r.items.map((v) => v.result)).toEqual(["1", "x"]);
    expect(r.runs).toEqual({ kind: "item", index: 0 });
    expect(r.reportKind).toBe("nothing");
    expect(r.items[1].terms[0].why).toMatch(/counts as false/);
  });

  it("literal items in an if chain become `==` conditions, and `==` with an x select is x, so nothing runs (§11.4.5, §12.4)", () => {
    const r = evaluateDecision(withSelect(decoder("unique", false, "if-else-if"), "xx"));
    expect(r.items.every((v) => v.result === "x")).toBe(true);
    expect(r.runs).toEqual({ kind: "nothing" });
    expect(r.reportKind).toBe("no-match");
    expect(decisionSource(r.config).map((l) => l.text).join("\n")).toContain("unique if (sel == 2'b00)");
  });
});

describe("sv-decision-model: one-hot unique case (1'b1) and the priority casez encoder", () => {
  it("gnt = 3'b011 lights two items: the first runs and unique reports an overlap (§12.5.2, §12.5.3)", () => {
    const p = findPreset("one-hot");
    const r = evaluateDecision(p.config);
    expect(r.constantExpression).toBe(true);
    expect(r.expression).toEqual(["1"]);
    expect(r.items.map((v) => v.status)).toEqual(["runs", "matches-not-run", "no-match"]);
    expect(r.reportKind).toBe("overlap");
    expect(decisionSource(p.config)[1].text).toBe("unique case (1'b1)");
    expect(decisionSource(p.config)[2].text).toContain("gnt[0]:");
  });

  it("gnt = 3'b0x1 under case: x is not 1, so only gnt[0] matches; under casex the x bit is a don't-care and overlaps (§12.5.1)", () => {
    const p = findPreset("one-hot");
    expect(outcome(p.config, "0x1")).toEqual(["item-0", "nothing"]);
    expect(outcome({ ...p.config, form: "casex" }, "0x1")).toEqual(["item-0", "overlap"]);
  });

  it("a bit-select against 1'b1: casez treats a z as a don't-care but not an x, casex treats both as don't-cares (§12.5.1, §12.5.2)", () => {
    const p = findPreset("one-hot");
    const on = (form: DecisionForm, body: string) => evaluateDecision({ ...withSelect(p.config, body), form });
    const zUnderCasez = on("casez", "0z0");
    expect([runOutcomeId(zUnderCasez.runs), zUnderCasez.reportKind]).toEqual(["item-1", "nothing"]);
    expect(zUnderCasez.items[1].terms[0].why).toBe("gnt[1] is z: casez treats it as a don't-care, so it matches the case expression 1'b1 (§12.5.1).");
    const xUnderCasez = on("casez", "0x0");
    expect([runOutcomeId(xUnderCasez.runs), xUnderCasez.reportKind]).toEqual(["nothing", "no-match"]);
    expect(xUnderCasez.items[1].terms[0].why).toBe("gnt[1] is x, not 1, so it does not match the case expression 1'b1 (§12.5.2); casez skips only z, so x must match exactly (§12.5.1).");
    const xUnderCasex = on("casex", "0x0");
    expect([runOutcomeId(xUnderCasex.runs), xUnderCasex.reportKind]).toEqual(["item-1", "nothing"]);
    expect(xUnderCasex.items[1].terms[0].why).toBe("gnt[1] is x: casex treats it as a don't-care, so it matches the case expression 1'b1 (§12.5.1).");
    // case compares the x literally (§12.5).
    expect(on("case", "0x0").items[1].terms[0].why).toBe("gnt[1] is x, not 1, so it does not match the case expression 1'b1 (§12.5.2); case (not casez or casex) compares x and z literally (§12.5).");
  });

  it("req = 4'b0110 runs the 4'b??1? item (idx = 1) silently; req = 0 reports no match (§12.5.3)", () => {
    const p = findPreset("priority-encoder");
    expect(outcome(p.config, "0110")).toEqual(["item-1", "nothing"]);
    const r = evaluateDecision(withSelect(p.config, "0110"));
    expect(r.matchCount).toBe(2);
    expect(r.silentBecause).toMatch(/priority allows overlap/);
    expect(outcome(p.config, "0000")).toEqual(["nothing", "no-match"]);
  });
});

describe("sv-decision-model: the standard's bit [2:0] a examples (§12.5.3)", () => {
  it("unique case (a) with 0,1 / 2 / 4: values 3, 5, 6, 7 cause a violation report, the others do not", () => {
    const p = findPreset("lrm-unique-case");
    for (const v of ["011", "101", "110", "111"]) expect(outcome(p.config, v), v).toEqual(["nothing", "no-match"]);
    expect(outcome(p.config, "000")).toEqual(["item-0", "nothing"]);
    expect(outcome(p.config, "001")).toEqual(["item-0", "nothing"]);
    expect(outcome(p.config, "010")).toEqual(["item-1", "nothing"]);
    expect(outcome(p.config, "100")).toEqual(["item-2", "nothing"]);
  });

  it("priority casez (a) with 3'b00? / 3'b0??: values 4 to 7 cause a violation report; 0 and 1 match both and run the first", () => {
    const p = findPreset("lrm-priority-casez");
    for (const v of ["100", "101", "110", "111"]) expect(outcome(p.config, v), v).toEqual(["nothing", "no-match"]);
    expect(outcome(p.config, "000")).toEqual(["item-0", "nothing"]);
    expect(evaluateDecision(withSelect(p.config, "000")).matchCount).toBe(2);
    expect(outcome(p.config, "010")).toEqual(["item-1", "nothing"]);
  });

  it("unique0 case (a): values 3, 5, 6, 7 do not cause a violation report", () => {
    const p = findPreset("lrm-unique0-case");
    for (const v of ["011", "101", "110", "111"]) expect(outcome(p.config, v), v).toEqual(["nothing", "nothing"]);
    expect(evaluateDecision(withSelect(p.config, "011")).silentBecause).toMatch(/unique0 does not report a missing match/);
  });
});

describe("sv-decision-model: Kata C steps 1 to 4", () => {
  it("step 1: sel = xx at t = 0, unique case with no default: nothing runs and a no-match violation is queued", () => {
    expect(outcome(findPreset("kata-c-1").config, "xx")).toEqual(["nothing", "no-match"]);
    expect(outcome(findPreset("kata-c-1").config, "01")).toEqual(["item-1", "nothing"]);
  });
  it("step 2: with a default, the default runs, so the report disappears (§12.5, §12.5.3)", () => {
    expect(outcome(findPreset("kata-c-2").config, "xx")).toEqual(["catch-all", "nothing"]);
  });
  it("step 3: unique0 never reports a missing match", () => {
    expect(outcome(findPreset("kata-c-3").config, "xx")).toEqual(["nothing", "nothing"]);
  });
  it("step 4: case inside with 2'b0? / 2'b1?: 1x matches 2'b1? silently, x1 and xx match nothing and are reported (§12.5.4, §11.4.6)", () => {
    const p = findPreset("kata-c-4");
    expect(outcome(p.config, "1x")).toEqual(["item-1", "nothing"]);
    expect(outcome(p.config, "x1")).toEqual(["nothing", "no-match"]);
    expect(outcome(p.config, "xx")).toEqual(["nothing", "no-match"]);
    const r = evaluateDecision(withSelect(p.config, "x1"));
    expect(r.items.map((v) => v.result)).toEqual(["x", "x"]);
    expect(r.items[0].terms[0].why).toMatch(/not a wildcard/);
  });
});

describe("sv-decision-model: the standard's priority case (status) inside (§12.5.4)", () => {
  const p = findPreset("lrm-priority-inside");

  it("1 and 3 run task1; 0, 2, 0x0, 0z0 and 4 to 7 run task2", () => {
    expect(outcome(p.config, "001")).toEqual(["item-0", "nothing"]);
    expect(outcome(p.config, "011")).toEqual(["item-0", "nothing"]);
    for (const v of ["000", "010", "0x0", "0z0", "100", "101", "110", "111"]) expect(outcome(p.config, v), v).toEqual(["item-1", "nothing"]);
  });

  it("'b00x and 'bxxx match no item: the comparisons give x, x is no match, and priority reports", () => {
    for (const v of ["00x", "xxx", "01x"]) {
      const r = evaluateDecision(withSelect(p.config, v));
      expect(r.runs, v).toEqual({ kind: "nothing" });
      expect(r.reportKind, v).toBe("no-match");
      expect(r.items.every((item) => item.result !== "1"), v).toBe(true);
    }
    const r = evaluateDecision(withSelect(p.config, "00x"));
    // 1 → 3'b00x ==? 3'b001 is x; 3 → bit 1 differs → 0; 3'b0?0 → bit 0 x vs 0 → x; [4:7] → x (§11.4.4)
    expect(r.items[0].terms.map((t) => t.result)).toEqual(["x", "0"]);
    expect(r.items[1].terms.map((t) => t.result)).toEqual(["x", "x"]);
    expect(r.items[1].terms[1].why).toMatch(/§11\.4\.4/);
  });

  it("the range item [4:7] is kept as a range in case inside and its text is written with brackets", () => {
    const src = decisionSource(p.config).map((l) => l.text);
    expect(src[1]).toBe("priority case (status) inside");
    expect(src.some((l) => l.includes("3'b0?0, [4:7]:"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: the lesson's casex versus case inside table (flow-control)", () => {
  const two = findCompareSet("casex-vs-inside");
  const wild = findCompareSet("wildcard-item");

  it("sel = 2'b10: 2'b10 runs everywhere; 2'b1? runs", () => {
    const r = compareDecisions(two, bits("10"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(runOutcomeId(r.right.runs)).toBe("item-0");
    expect(runOutcomeId(compareDecisions(wild, bits("10"), "casex").right.runs)).toBe("item-0");
  });

  it("sel = 2'b1x: casex runs 2'b10 with both items matching; case inside matches nothing; the 2'b1? item matches", () => {
    const r = compareDecisions(two, bits("1x"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(r.left.matchCount).toBe(2);
    expect(r.right.runs).toEqual({ kind: "nothing" });
    expect(r.right.items.map((v) => v.result)).toEqual(["x", "x"]);
    expect(runOutcomeId(compareDecisions(wild, bits("1x"), "casex").right.runs)).toBe("item-0");
  });

  it("sel = 2'bx1: casex runs 2'b11; case inside matches nothing, even with the 2'b1? item", () => {
    const r = compareDecisions(two, bits("x1"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-1");
    expect(r.right.runs).toEqual({ kind: "nothing" });
    expect(compareDecisions(wild, bits("x1"), "casex").right.runs).toEqual({ kind: "nothing" });
  });

  it("sel = 2'bxx: casex runs 2'b10 (both match); case inside matches nothing in either item set", () => {
    const r = compareDecisions(two, bits("xx"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(r.left.matchCount).toBe(2);
    expect(r.right.runs).toEqual({ kind: "nothing" });
    expect(compareDecisions(wild, bits("xx"), "casex").right.runs).toEqual({ kind: "nothing" });
  });

  it("the casez toggle shows z don't-cares: sel = 2'b1z runs 2'b10 under casez but is no match under case inside (§12.5.1, §11.4.6)", () => {
    const r = compareDecisions(two, bits("1z"), "casez");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(r.left.items[0].terms[0].chips?.map((c) => c.verdict)).toEqual(["1", "skip"]);
    expect(r.right.runs).toEqual({ kind: "nothing" });
    expect(r.right.items[0].terms[0].chips?.map((c) => c.verdict)).toEqual(["1", "x"]);
    // casez does not skip x: 2'b1x is no match on the left either
    expect(compareDecisions(two, bits("1x"), "casez").left.runs).toEqual({ kind: "nothing" });
  });

  it("a casex column item that matches with an x in the select is marked skipped, the same bit is x under ==? (the asymmetry)", () => {
    const r = compareDecisions(two, bits("1x"), "casex");
    expect(r.left.items[0].terms[0].chips?.map((c) => c.verdict)).toEqual(["1", "skip"]);
    expect(r.right.items[0].terms[0].chips?.map((c) => c.verdict)).toEqual(["1", "x"]);
    expect(r.leftExpanded).toBe(false);
  });
});

describe("sv-decision-model: the operators lesson's opcode decoder (case (op) inside)", () => {
  const set = findCompareSet("opcode-decoder");
  const branch = (select: string, kind: "casex" | "casez" = "casex") => {
    const r = compareDecisions(set, bits(select), kind);
    const name = (res: typeof r.left) => (res.runs.kind === "item" ? res.items[res.runs.index].label : res.runs.kind === "catch-all" ? "ILLEGAL" : "nothing");
    return [name(r.left), name(r.right)];
  };

  it("the six trace values: 001 RW, 101 ALU, 110 ALU (first match wins), 111 JUMP, 011 ILLEGAL, 1x0 ILLEGAL under case inside", () => {
    expect(branch("001")).toEqual(["RW", "RW"]);
    expect(branch("101")).toEqual(["ALU", "ALU"]);
    expect(branch("110")).toEqual(["ALU", "ALU"]);
    expect(branch("111")).toEqual(["JUMP", "JUMP"]);
    expect(branch("011")).toEqual(["ILLEGAL", "ILLEGAL"]);
    expect(branch("1x0")[1]).toBe("ILLEGAL");
  });

  it("3'b110 matches both ALU and 3'b11?; the range comes first so ALU runs and JUMP is 'matches, not run' (§12.5)", () => {
    const r = compareDecisions(set, bits("110"), "casex");
    expect(r.right.items.map((v) => v.status)).toEqual(["no-match", "no-match", "runs", "matches-not-run"]);
    expect(r.right.matchCount).toBe(2);
    expect(r.right.reportKind).toBe("nothing");
  });

  it("3'b0x0 runs NOP under casex and reaches default under case inside (§12.5.1 versus §12.5.4)", () => {
    expect(branch("0x0")).toEqual(["NOP", "ILLEGAL"]);
    const r = compareDecisions(set, bits("0x0"), "casex");
    expect(r.right.items.map((v) => v.result)).toEqual(["x", "x", "x", "0"]);
  });

  it("3'b1x0 under casex runs ALU (3'b100 after expansion) and under case inside reaches default; the range gives x (§11.4.4)", () => {
    expect(branch("1x0")).toEqual(["ALU", "ILLEGAL"]);
    const r = compareDecisions(set, bits("1x0"), "casex");
    expect(r.right.items[2].terms[0].result).toBe("x");
    expect(r.right.items[3].terms[0].result).toBe("x");
  });

  it("the casex column lists the range as three plain items 3'b100, 3'b101, 3'b110 and is flagged as expanded", () => {
    const r = compareDecisions(set, bits("101"), "casex");
    expect(r.leftExpanded).toBe(true);
    expect(r.left.items[2].text).toBe("3'b100, 3'b101, 3'b110");
    expect(r.right.items[2].text).toBe("[3'b100:3'b110]");
    const src = decisionSource(r.left.config).map((l) => l.text);
    expect(src[1]).toBe("casex (op)");
    expect(src.some((l) => l.includes("[3'b100:3'b110]"))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: the outcome grid agrees with the decision", () => {
  const formsToCheck: DecisionForm[] = ["case", "if-else-if"];

  it("cells: none → report for unique/priority unless a default; one → silent; many → report for unique/unique0", () => {
    expect(gridCell("unique", "none", false, "case").text).toBe("nothing runs, report");
    expect(gridCell("unique", "none", true, "case").text).toBe("default runs, silent");
    expect(gridCell("unique", "none", true, "if-else-if").text).toBe("else runs, silent");
    expect(gridCell("unique0", "none", false, "case").text).toBe("nothing runs, silent");
    expect(gridCell("priority", "none", false, "case").text).toBe("nothing runs, report");
    expect(gridCell("plain", "none", false, "case").text).toBe("nothing runs, silent");
    for (const q of QUALIFIERS) expect(gridCell(q, "one", false, "case").text).toBe("runs it, silent");
    expect(gridCell("unique", "many", false, "case").text).toBe("runs first, report");
    expect(gridCell("unique0", "many", false, "case").text).toBe("runs first, report");
    expect(gridCell("priority", "many", false, "case").text).toBe("runs first, silent");
    expect(gridCell("plain", "many", false, "case").text).toBe("runs first, silent");
    expect(outcomeGrid(false, "case")).toHaveLength(4);
    expect(outcomeGrid(false, "case")[0]).toHaveLength(3);
  });

  it("for every qualifier × column × default × form, the highlighted cell reports exactly when the decision does", () => {
    // Items 2'b1? and 2'b?1: sel 00 → none, 10 → one, 11 → many.
    const selects: Record<(typeof MATCH_COLUMNS)[number], string> = { none: "00", one: "10", many: "11" };
    for (const form of formsToCheck) for (const q of QUALIFIERS) for (const catchAll of [false, true]) for (const column of MATCH_COLUMNS) {
      const config: DecisionConfig = {
        form: form === "case" ? "casez" : form,
        qualifier: q,
        catchAll,
        selectName: "sel",
        select: bits(selects[column]),
        items: [lit("2'b1?"), lit("2'b?1")],
      };
      const r = evaluateDecision(config);
      const cell = gridCell(q, r.column, catchAll, form);
      expect(r.column, `${form} ${q} ${catchAll} ${column}`).toBe(column);
      expect(r.report !== null, `${form} ${q} ${catchAll} ${column}`).toBe(cell.reports);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: generated source", () => {
  it("writes the qualifier, the form, the items in order, the default and endcase", () => {
    const src = decisionSource({ ...decoder("unique", true), catchAllAction: "y = 4'b0000;" }).map((l) => l.text);
    expect(src).toEqual(["logic [1:0] sel = 2'b01;", "unique case (sel)", "  2'b00:   branch = 1;", "  2'b01:   branch = 2;", "  2'b10:   branch = 3;", "  default: y = 4'b0000;", "endcase"]);
  });

  it("writes case inside, casez and a plain case without a qualifier word", () => {
    expect(decisionSource(decoder("plain", false, "case-inside"))[1].text).toBe("case (sel) inside");
    expect(decisionSource(decoder("priority", false, "casez"))[1].text).toBe("priority casez (sel)");
    expect(decisionSource(decoder("plain"))[1].text).toBe("case (sel)");
  });

  it("writes an if chain with else if and a final else, and keys the running line", () => {
    const p = findPreset("unique-if");
    const config = { ...p.config, catchAll: true };
    const src = decisionSource(config);
    // Exactly the lesson's lines.
    expect(src.map((l) => l.text)).toEqual(["logic [1:0] req = 2'b10;", "unique if (req[0]) grant = 2'b01;", "else if (req[1])   grant = 2'b10;", "else               grant = 2'b00;"]);
    expect(src.map((l) => l.key)).toEqual(["decl", "item-0", "item-1", "catch-all"]);
    expect(runningLineKey(evaluateDecision(config))).toBe("item-1");
    expect(runningLineKey(evaluateDecision(withSelect(config, "00")))).toBe("catch-all");
    expect(runningLineKey(evaluateDecision(withSelect(p.config, "00")))).toBeUndefined();
  });

  it("writes wildcard literals in an if chain with ==? and ranges with inside", () => {
    const src = decisionSource({
      form: "if-else-if",
      qualifier: "plain",
      catchAll: false,
      selectName: "op",
      select: bits("101"),
      items: [lit("3'b11?"), { terms: [{ kind: "range", lo: "3'b100", hi: "3'b110" }] }],
    }).map((l) => l.text);
    expect(src[1]).toContain("if (op ==? 3'b11?)");
    expect(src[2]).toContain("else if (op inside {[3'b100:3'b110]})");
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: prediction choices and feedback", () => {
  it("offers every item, the default when present, and 'nothing runs'", () => {
    const r = evaluateDecision(decoder("unique", true));
    expect(runChoices(r).map(runOutcomeId)).toEqual(["item-0", "item-1", "item-2", "catch-all", "nothing"]);
    expect(runChoices(evaluateDecision(decoder("unique"))).map(runOutcomeId)).toEqual(["item-0", "item-1", "item-2", "nothing"]);
  });

  it("which item runs: marks the running item correct and diagnoses the others", () => {
    const r = evaluateDecision(withSelect({ ...findPreset("casez-overlap").config }, "11"));
    expect(explainRunChoice(r, { kind: "item", index: 0 })).toMatchObject({ correct: true });
    expect(explainRunChoice(r, { kind: "item", index: 0 }).feedback).toMatch(/first one in source order wins \(§12\.5, §12\.5\.3\); no qualifier changes that\./);
    const second = explainRunChoice(r, { kind: "item", index: 1 });
    expect(second.correct).toBe(false);
    expect(second.feedback).toBe("2'b?1 does match under casez, but 2'b1? matches earlier in source order; the next question asks what it reports.");
    const nothing = explainRunChoice(r, { kind: "nothing" });
    expect(nothing.correct).toBe(false);
    expect(nothing.feedback).toBe("Something does run under casez, because 2'b1? matches.");
  });

  it("which item runs: an item that does not match is explained bit by bit; case inside stamps 'x is no match'", () => {
    const r = evaluateDecision(withSelect(findPreset("kata-c-4").config, "x1"));
    const choice = explainRunChoice(r, { kind: "item", index: 1 });
    expect(choice.correct).toBe(false);
    expect(choice.feedback).toMatch(/not a wildcard/);
    expect(choice.feedback).toMatch(/x is no match \(§12\.5\.4\)/);
    expect(explainRunChoice(r, { kind: "nothing" })).toMatchObject({ correct: true });
    expect(explainRunChoice(r, { kind: "nothing" }).feedback).toBe("Every case item fails: each result is 0 or x, and x is no match (§12.5.4), so nothing runs.");
  });

  it("which item runs: choosing default when an item matches, and choosing nothing when the default runs", () => {
    const hit = evaluateDecision(decoder("unique", true));
    expect(explainRunChoice(hit, { kind: "catch-all" }).feedback).toMatch(/default runs only when no case item matches/);
    const miss = evaluateDecision(withSelect(decoder("unique", true), "11"));
    expect(explainRunChoice(miss, { kind: "catch-all" })).toMatchObject({ correct: true });
    expect(explainRunChoice(miss, { kind: "nothing" }).feedback).toBe("With a default in place, a case statement always runs something.");
  });

  it("what is reported: correct answers restate the rule; wrong answers name the misconception", () => {
    const miss = evaluateDecision(withSelect(decoder("unique"), "11"));
    expect(explainReportChoice(miss, "no-match")).toMatchObject({ correct: true });
    expect(explainReportChoice(miss, "no-match").feedback).toBe("unique reports when no case item matches and there is no default (§12.5, §12.5.3).");
    expect(explainReportChoice(miss, "nothing").feedback).toMatch(/not silent/);
    expect(explainReportChoice(miss, "overlap").feedback).toMatch(/No case item matches, so there is no overlap/);

    const withDefault = evaluateDecision(withSelect(decoder("unique", true), "11"));
    expect(explainReportChoice(withDefault, "nothing")).toMatchObject({ correct: true });
    expect(explainReportChoice(withDefault, "no-match").feedback).toBe("A default silences the missing-match check, which may be the check you wanted.");

    const unique0 = evaluateDecision(withSelect(decoder("unique0"), "11"));
    expect(explainReportChoice(unique0, "no-match").feedback).toBe("unique0 has no check for a missing match.");

    const plain = evaluateDecision(withSelect(decoder("plain"), "11"));
    expect(explainReportChoice(plain, "no-match").feedback).toMatch(/has no check/);

    const overlap = evaluateDecision(findPreset("casez-overlap").config);
    expect(explainReportChoice(overlap, "overlap")).toMatchObject({ correct: true });
    expect(explainReportChoice(overlap, "nothing").feedback).toBe("unique checks for this: 2 case items match, and running the first one (§12.5.3) does not hide the overlap.");
    expect(explainReportChoice(overlap, "no-match").feedback).toMatch(/opposite one/);

    const priority = evaluateDecision({ ...findPreset("casez-overlap").config, qualifier: "priority" });
    expect(explainReportChoice(priority, "overlap").feedback).toBe("priority has no check for overlap.");
    expect(explainReportChoice(priority, "nothing").feedback).toMatch(/priority allows overlap: it acts on the first match only/);
    const plainMany = evaluateDecision({ ...findPreset("casez-overlap").config, qualifier: "plain" });
    expect(explainReportChoice(plainMany, "overlap").feedback).toMatch(/has no check/);
    const one = evaluateDecision(decoder("unique"));
    expect(explainReportChoice(one, "overlap").feedback).toMatch(/Exactly one case item matches/);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: presets are well-formed", () => {
  it("every preset evaluates for each of its select options without throwing, and starts on its first option", () => {
    for (const p of DECISION_PRESETS) {
      expect(p.config.select).toEqual(bits(p.selectOptions[0]));
      for (const body of p.selectOptions) {
        const r = evaluateDecision(withSelect(p.config, body));
        expect(r.summary.length, `${p.id} ${body}`).toBeGreaterThan(0);
        expect(decisionSource(r.config).length).toBeGreaterThan(2);
      }
    }
    expect(new Set(DECISION_PRESETS.map((p) => p.id)).size).toBe(DECISION_PRESETS.length);
    expect(findPreset(undefined).id).toBe("lesson-decoder");
  });

  it("every compare set evaluates under casex, casez and case inside for each select option", () => {
    for (const s of COMPARE_SETS) for (const body of s.selectOptions) {
      expect(() => compareDecisions(s, bits(body), "casex")).not.toThrow();
      expect(() => compareDecisions(s, bits(body), "casez")).not.toThrow();
    }
  });

  it("every preset's select options have the preset's width", () => {
    for (const p of DECISION_PRESETS) for (const body of p.selectOptions) expect(body.length, p.id).toBe(p.config.select.length);
    for (const s of COMPARE_SETS) {
      const width = s.selectOptions[0].length;
      for (const body of s.selectOptions) expect(body.length, s.id).toBe(width);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: feedback never claims a qualifier changes which item runs (§12.5.3, §12.4.2)", () => {
  // Every lesson scenario in which two or more items match.
  const overlaps: [string, DecisionConfig][] = [
    ["casez-overlap sel=11", findPreset("casez-overlap").config],
    ["unique-if req=11", withSelect(findPreset("unique-if").config, "11")],
    ["one-hot gnt=011", findPreset("one-hot").config],
    ["priority-encoder req=0110", findPreset("priority-encoder").config],
    ["lrm-priority-casez a=000", withSelect(findPreset("lrm-priority-casez").config, "000")],
  ];

  it("the correct pick ends 'the first one in source order wins; no qualifier changes that' under every qualifier", () => {
    for (const [name, base] of overlaps) for (const qualifier of QUALIFIERS) {
      const r = evaluateDecision({ ...base, qualifier });
      expect(r.matchCount, name).toBeGreaterThan(1);
      const { correct, feedback } = explainRunChoice(r, r.runs);
      expect(correct, `${name} ${qualifier}`).toBe(true);
      // plain and priority: the linear search (§12.5, §12.4.1). unique and unique0 may compare in any order,
      // and the rule that the first match in source order runs is in their own clause (§12.5.3, §12.4.2).
      const chain = r.config.form === "if-else-if";
      const clause = reportsOverlap(qualifier) ? (chain ? "§12.4.1, §12.4.2" : "§12.5, §12.5.3") : chain ? "§12.4.1" : "§12.5";
      expect(feedback, `${name} ${qualifier}`).toContain(`first one in source order wins (${clause}); no qualifier changes that.`);
      expect(feedback, `${name} ${qualifier}`).not.toMatch(/\b(unique|unique0|priority) changes that/);
    }
  });

  it("a later matching item says it comes later and leaves the report to the next question; the correct answer beside it carries 'no qualifier changes that'", () => {
    const base = findPreset("casez-overlap").config; // 2'b1? then 2'b?1, sel = 11
    const later = (qualifier: Qualifier) => explainRunChoice(evaluateDecision({ ...base, qualifier }), { kind: "item", index: 1 });
    for (const q of ["unique", "unique0", "priority"] as Qualifier[]) {
      expect(later(q).correct, q).toBe(false);
      expect(later(q).feedback, q).toBe("2'b?1 does match under casez, but 2'b1? matches earlier in source order; the next question asks what it reports.");
    }
    // A plain statement has no qualifier to ask about, and compare mode (always plain) has no report question at all.
    expect(later("plain").feedback).toBe("2'b?1 does match under casez, but 2'b1? matches earlier in source order.");
    // An if chain says conditions and cites §12.4.1 in the correct answer, with §12.4.2 under unique.
    const chain = evaluateDecision(withSelect(findPreset("unique-if").config, "11"));
    expect(explainRunChoice(chain, { kind: "item", index: 1 }).feedback).toMatch(/matches earlier in source order; the next question asks what it reports\.$/);
    expect(explainRunChoice(chain, chain.runs).feedback).toMatch(/first one in source order wins \(§12\.4\.1, §12\.4\.2\); no qualifier changes that\./);
    const priorityChain = evaluateDecision({ ...withSelect(findPreset("unique-if").config, "11"), qualifier: "priority" });
    expect(explainRunChoice(priorityChain, priorityChain.runs).feedback).toMatch(/first one in source order wins \(§12\.4\.1\); no qualifier changes that\./);
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: a range the case family cannot list is flagged, not silently treated as no match (§12.5.4)", () => {
  const wide: DecisionItem = { terms: [{ kind: "range", lo: "0", hi: "100" }], label: "WIDE" };
  const hit: DecisionItem = { terms: [{ kind: "literal", text: "8'b0000_0101" }], label: "HIT" };
  const config = (form: DecisionForm, items: DecisionItem[]): DecisionConfig => ({ form, qualifier: "plain", catchAll: true, selectName: "op", select: bits("00000101"), items });

  it("under casex the term is unsupported with result 0, the decision carries the caveat and the source line says the range is not legal here", () => {
    const r = evaluateDecision(config("casex", [wide, hit]));
    expect(r.items[0].terms[0].unsupported).toBe(true);
    expect(r.items[0].terms[0].result).toBe("0");
    expect(r.items[0].matches).toBe(false);
    // The restriction is Syntax 12-3 in §12.5 (case_item_expression ::= expression; case_inside_item ::= range_list).
    expect(r.items[0].terms[0].why).toMatch(/^Not comparable: a range is legal only in case inside \(§12\.5, §12\.5\.4\), and \[0:100\] cannot be written as plain casex items because it spans 101 values/);
    expect(r.unsupported).toHaveLength(1);
    expect(r.summary).toMatch(/Caveat: 1 case item could not be compared in this form and was left out of the decision\./);
    expect(runOutcomeId(r.runs)).toBe("item-1");
    const src = decisionSource(r.config).map((l) => l.text);
    expect(src.find((l) => l.includes("[0:100]:"))).toMatch(/\/\/ not legal here: a range needs case inside \(§12\.5, §12\.5\.4\)$/);
    expect(src.find((l) => l.includes("8'b0000_0101:"))).not.toMatch(/not legal here/);
  });

  it("an x bound and an empty range are flagged with their own reason under case and casez", () => {
    const unknown = evaluateDecision(config("case", [{ terms: [{ kind: "range", lo: "8'b0000_0x00", hi: "8'b0000_1000" }] }]));
    expect(unknown.items[0].terms[0].unsupported).toBe(true);
    expect(unknown.items[0].terms[0].why).toMatch(/because a bound holds an x or z bit/);
    const empty = evaluateDecision(config("casez", [{ terms: [{ kind: "range", lo: "9", hi: "4" }] }]));
    expect(empty.items[0].terms[0].unsupported).toBe(true);
    expect(empty.items[0].terms[0].why).toMatch(/because its low bound exceeds its high bound, so it is empty \(§11\.4\.13\)/);
    expect(empty.unsupported).toHaveLength(1);
  });

  it("the same range is compared normally under case inside and an if chain: nothing is flagged", () => {
    for (const form of ["case-inside", "if-else-if"] as DecisionForm[]) {
      const r = evaluateDecision(config(form, [wide]));
      expect(r.unsupported, form).toEqual([]);
      expect(r.items[0].terms[0].unsupported, form).toBeUndefined();
      expect(r.items[0].result, form).toBe("1");
      expect(r.summary, form).not.toMatch(/Caveat/);
      expect(decisionSource(r.config).some((l) => l.text.includes("not legal here")), form).toBe(false);
    }
  });

  it("no shipped preset or compare set has an unsupported term under any form or select value", () => {
    for (const p of DECISION_PRESETS) for (const form of DECISION_FORMS) for (const body of p.selectOptions) {
      expect(evaluateDecision({ ...withSelect(p.config, body), form }).unsupported, `${p.id} ${form} ${body}`).toEqual([]);
    }
    for (const s of COMPARE_SETS) for (const body of s.selectOptions) {
      const r = compareDecisions(s, bits(body), "casex");
      expect(r.left.unsupported, `${s.id} ${body}`).toEqual([]);
      expect(r.right.unsupported, `${s.id} ${body}`).toEqual([]);
      expect(compareDecisions(s, bits(body), "casez").left.unsupported, `${s.id} ${body}`).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: one-hot case (1'b1) inside words the bit-select as the right operand of ==? (§11.4.6)", () => {
  it("gnt = 3'b0x1: gnt[1] = x is a wildcard on the right, so 1'b1 matches; gnt[0] = 1 matches, gnt[2] = 0 does not; unique reports the overlap", () => {
    const r = evaluateDecision({ ...withSelect(findPreset("one-hot").config, "0x1"), form: "case-inside" });
    expect(r.items.map((v) => v.result)).toEqual(["1", "1", "0"]);
    expect(r.items[1].terms[0].why).toMatch(/^gnt\[1\] is x; as the right operand of ==\? an x bit is a wildcard, so the constant 1'b1 matches \(§11\.4\.6\)\. case \(not casez or casex\) would compare the x literally and not match \(§12\.5\)\./);
    expect(r.items[0].terms[0].why).toMatch(/^gnt\[0\] is 1, so 1'b1 ==\? gnt\[0\] is 1: the constant case expression matches \(§11\.4\.6, §12\.5\.2\)\./);
    expect(r.items[2].terms[0].why).toMatch(/^gnt\[2\] is 0, so 1'b1 ==\? gnt\[2\] is 0: the constant case expression does not match \(§11\.4\.6\)\./);
    expect(r.matchCount).toBe(2);
    expect(r.reportKind).toBe("overlap");
    // A z bit-select is a wildcard too, with "a z" in the sentence.
    const z = evaluateDecision({ ...withSelect(findPreset("one-hot").config, "0z0"), form: "case-inside" });
    expect(z.items[1].terms[0].why).toMatch(/gnt\[1\] is z; as the right operand of ==\? a z bit is a wildcard/);
    // The plain case on the same value compares the x literally (§12.5), as the one-hot tests already pin.
    expect(evaluateDecision(withSelect(findPreset("one-hot").config, "0x1")).items[1].matches).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

/** Every configuration a learner can reach from the shipped presets and item sets. */
function sweep(visit: (name: string, result: ReturnType<typeof evaluateDecision>) => void) {
  for (const p of DECISION_PRESETS) for (const form of DECISION_FORMS) for (const qualifier of QUALIFIERS) for (const catchAll of [false, true]) for (const body of p.selectOptions) {
    visit(`${p.id} ${form} ${qualifier} ${catchAll} ${body}`, evaluateDecision({ ...withSelect(p.config, body), form, qualifier, catchAll }));
  }
  for (const s of COMPARE_SETS) for (const body of s.selectOptions) for (const kind of ["casex", "casez"] as const) {
    const r = compareDecisions(s, bits(body), kind);
    visit(`${s.id} ${kind} ${body}`, r.left);
    visit(`${s.id} inside ${body}`, r.right);
  }
}

describe("sv-decision-model: nothing is given away before the reveal (visual-language rule 3)", () => {
  const OUTCOME_WORDS = /\b(reports?|reported|violations?|match(es|ed)?|overlaps?|wins|complain|silent|silently|disappears?|lights?|nothing)\b/i;

  it("no preset or item set states a report or match outcome in its title or pre-reveal summary", () => {
    for (const p of DECISION_PRESETS) {
      expect(p.summary, p.id).not.toMatch(OUTCOME_WORDS);
      expect(p.title, p.id).not.toMatch(OUTCOME_WORDS);
    }
    for (const s of COMPARE_SETS) {
      expect(s.summary, s.id).not.toMatch(OUTCOME_WORDS);
      expect(s.title, s.id).not.toMatch(OUTCOME_WORDS);
    }
  });

  it("every preset and item set has a closing line for the end of its walk", () => {
    for (const p of DECISION_PRESETS) expect(p.wrapUp.length, p.id).toBeGreaterThan(20);
    for (const s of COMPARE_SETS) expect(s.wrapUp.length, s.id).toBeGreaterThan(20);
  });

  it("the first prompt's feedback never answers the second prompt, for any option in any reachable configuration", () => {
    let checked = 0;
    sweep((name, r) => {
      for (const choice of runChoices(r)) {
        const { feedback } = explainRunChoice(r, choice);
        expect(feedback, name).not.toMatch(/reports the miss|only reports|allows the overlap and reports nothing/);
        expect(feedback.replace("the next question asks what it reports", ""), name).not.toMatch(/\breports?\b|\breported\b|\bviolation\b/);
        checked += 1;
      }
    });
    expect(checked).toBeGreaterThan(5000);
  });

  it("the no-match feedback is one rule sentence, not one explanation per term (Kata C step 1)", () => {
    const r = evaluateDecision(findPreset("kata-c-1").config);
    const { correct, feedback } = explainRunChoice(r, { kind: "nothing" });
    expect(correct).toBe(true);
    expect(feedback).toBe("Every case item fails: case (not casez or casex) compares x and z literally (§12.5), so nothing runs.");
    sweep((name, res) => {
      if (res.runs.kind !== "nothing") return;
      const text = explainRunChoice(res, { kind: "nothing" }).feedback;
      expect(text.match(/\.( |$)/g)?.length, `${name}: ${text}`).toBe(1);
      expect(text, name).toMatch(/so nothing runs\.$/);
    });
  });

  it("each form's rule sentence names that form's rule", () => {
    const rule = (form: DecisionForm, select: string) => explainRunChoice(evaluateDecision({ ...decoder("plain", false, form), select: bits(select) }), { kind: "nothing" }).feedback;
    expect(rule("case", "11")).toBe("Every case item fails: none equals the case expression bit for bit (§12.5), so nothing runs.");
    expect(rule("casez", "11")).toMatch(/casez skips only z and \? bits, .*\(§12\.5\.1\)/);
    expect(rule("casex", "11")).toMatch(/casex skips only x, z and \? bits, .*\(§12\.5\.1\)/);
    expect(rule("case-inside", "11")).toBe("Every case item fails: each result is 0 (§12.5.4), so nothing runs.");
    expect(rule("if-else-if", "11")).toBe("Every condition is false (§12.4), so nothing runs.");
    expect(rule("if-else-if", "xx")).toBe("Every condition is false or x, and an x condition counts as false (§12.4), so nothing runs.");
  });
});

describe("sv-decision-model: preset text stays true", () => {
  it("wildcard-item: the select's x is scoped to case inside, because casex skips it at any bit (§12.5.1, §11.4.6)", () => {
    const set = findCompareSet("wildcard-item");
    expect(compareValueNote(set, bits("x1"), "casex")).toBe("casex skips a select x at every bit, even against the item's fixed 1 (§12.5.1).");
    const r = compareDecisions(set, bits("x1"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(r.left.items[0].terms[0].chips?.[0]).toMatchObject({ left: "x", right: "1", verdict: "skip" });
    expect(r.right.runs).toEqual({ kind: "nothing" });
  });

  it("casez-overlap names qualifiers, not forms: a plain case compares the ? literally, so with sel = 11 nothing runs (§12.5)", () => {
    const p = findPreset("casez-overlap");
    expect(p.wrapUp).toMatch(/every qualifier runs the first/);
    for (const q of QUALIFIERS) expect(runOutcomeId(evaluateDecision({ ...p.config, qualifier: q }).runs), q).toBe("item-0");
    expect(outcome({ ...p.config, form: "case", qualifier: "unique" }, "11")).toEqual(["nothing", "no-match"]);
    expect(outcome({ ...p.config, form: "case", qualifier: "unique0" }, "11")).toEqual(["nothing", "nothing"]);
  });

  it("the §12.5.3 presets say that the lab uses logic where the standard declares bit, and the code panel shows logic", () => {
    for (const id of ["lrm-unique-case", "lrm-priority-casez", "lrm-unique0-case"]) {
      const p = findPreset(id);
      expect(p.summary, id).toMatch(/declares bit \[2:0\] a; the lab uses logic so x can be tried/);
      expect(decisionSource(p.config)[0].text, id).toMatch(/^logic \[2:0\] a = /);
    }
  });

  it("isPresetEdited looks at form, qualifier and catch-all; another select value is still the preset's statement", () => {
    const p = findPreset("lrm-unique0-case");
    expect(isPresetEdited(p.config, p)).toBe(false);
    expect(isPresetEdited(withSelect(p.config, "111"), p)).toBe(false);
    expect(isPresetEdited({ ...p.config, qualifier: "unique" }, p)).toBe(true);
    expect(isPresetEdited({ ...p.config, form: "casez" }, p)).toBe(true);
    expect(isPresetEdited({ ...p.config, catchAll: true }, p)).toBe(true);
    expect(editedPresetNote(p)).toBe(`Edited from: ${p.title}. The text below is computed from the statement shown.`);
  });
});

describe("sv-decision-model: readable prose", () => {
  it("the timing is told once, on the ticket: no feedback repeats it, and the live summary keeps it for a screen reader (§12.4.2.1, §12.5.3.1)", () => {
    const miss = evaluateDecision(withSelect(decoder("unique"), "11"));
    expect(miss.report?.deferred).toBe(DEFERRED_REPORT_NOTE);
    expect(miss.summary).toContain("unique case: no case item matches. Violation reported in the Observed region (§12.5.3, §12.4.2.1, §12.5.3.1).");
    expect(explainReportChoice(miss, "nothing").feedback).toMatch(/not silent/);
    sweep((name, r) => {
      expect(r.summary, name).not.toMatch(/, checked now/);
      for (const kind of ["nothing", "no-match", "overlap"] as ReportKind[]) expect(explainReportChoice(r, kind).feedback, name).not.toMatch(/Observed/);
    });
  });

  it("an if chain's ticket and live summary cite §12.4.2.1 only: §12.5.3.1 is about case statements", () => {
    const chain = evaluateDecision(withSelect(findPreset("unique-if").config, "11"));
    expect(chain.report?.deferred).toBe("checked now, reported in the Observed region (§12.4.2.1)");
    expect(chain.summary).toContain("unique if: 2 conditions match. Violation reported in the Observed region (§12.4.2, §12.4.2.1).");
    sweep((name, r) => {
      if (!r.report) return;
      const chain = r.config.form === "if-else-if";
      expect(r.report.deferred, name).toBe(deferredReportNote(r.config.form));
      if (chain) expect(`${r.report.deferred} ${r.summary}`, name).not.toContain("§12.5.3.1");
      else expect(r.summary, name).toContain(`(${r.report.clause}, §12.4.2.1, §12.5.3.1).`);
    });
  });

  it("if chains: conditions match and branches run, in the summary, the feedback and the grid headers (§12.4.2)", () => {
    const chain = findPreset("unique-if").config;
    const one = evaluateDecision(chain); // req = 10
    expect(one.summary).toMatch(/^Branch 2 \(req\[1\]\) runs\./);
    expect(explainReportChoice(one, "overlap").feedback).toMatch(/^Exactly one condition matches/);
    expect(branchWord("if-else-if")).toBe("branch");
    expect(branchWord("casez")).toBe("case item");
    expect(MATCH_COLUMNS.map((c) => matchColumnLabel(c, "if-else-if"))).toEqual(["no condition matches", "one condition matches", "two or more match"]);
    expect(MATCH_COLUMNS.map((c) => matchColumnLabel(c, "case"))).toEqual(["no case item matches", "one case item matches", "two or more match"]);
    sweep((name, r) => {
      if (r.config.form !== "if-else-if") return;
      expect(r.summary, name).not.toMatch(/\bitem\b/i);
      for (const choice of runChoices(r)) expect(explainRunChoice(r, choice).feedback, name).not.toMatch(/\bitem\b/i);
    });
  });

  it("a plain miss folds to one line: the failing bit, the bit-select's value, or the range", () => {
    const miss = evaluateDecision(withSelect(decoder("plain"), "xx")).items[0];
    expect(isPlainMiss(miss)).toBe(true);
    expect(itemMissLine(miss)).toBe("fails at bit 1");
    const oneHot = evaluateDecision(withSelect(findPreset("one-hot").config, "0x1"));
    expect(itemMissLine(oneHot.items[1])).toBe("gnt[1] is x");
    expect(itemMissLine(oneHot.items[2])).toBe("gnt[2] is 0");
    const op = compareDecisions(findCompareSet("opcode-decoder"), bits("000"), "casex").right;
    expect(itemMissLine(op.items[1])).toBe("all 2 comparisons fail");
    expect(itemMissLine(op.items[2])).toBe("outside the range");
    expect(itemMissLine(evaluateDecision(findPreset("unique-if").config).items[0])).toBe("req[0] is 0");
    // An x result and a match are never folded: that is what the chips are for.
    expect(isPlainMiss(compareDecisions(findCompareSet("casex-vs-inside"), bits("1x"), "casex").right.items[0])).toBe(false);
    expect(isPlainMiss(evaluateDecision(decoder("plain")).items[1])).toBe(false);
  });

  it("generated code lines up the actions only when every row fits the panel on a phone", () => {
    expect(CODE_LINE_FIT).toBe(34);
    // The lesson's lines fit and stay aligned (pinned above); these do not, so padding would only force a wrap.
    const casex = decisionSource(compareDecisions(findCompareSet("opcode-decoder"), bits("101"), "casex").left.config).map((l) => l.text);
    expect(casex).toContain("  3'b000: cls = NOP;");
    expect(casex).toContain("  3'b100, 3'b101, 3'b110: cls = ALU;");
    expect(casex).toContain("  default: cls = ILLEGAL;");
    const ifForm = decisionSource({ ...findPreset("lrm-priority-inside").config, form: "if-else-if" }).map((l) => l.text);
    expect(ifForm.find((l) => l.startsWith("priority if"))).toBe("priority if (status == 1 || status == 3) task1;");
    sweep((name, r) => {
      const rows = decisionSource(r.config).filter((l) => /^item-|catch-all/.test(l.key)).map((l) => l.text);
      // A row that does not fit means no row is padded: past the indent, no run of spaces is left.
      if (rows.some((l) => l.length > CODE_LINE_FIT)) for (const row of rows) expect(row.trimStart(), name).not.toMatch(/ {2}/);
    });
  });
});

/* ------------------------------------------------------------------ */

describe("sv-decision-model: an unknown id is not silent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("an unknown preset falls back to the first one and warns outside production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(findPreset("not-a-preset").id).toBe(DECISION_PRESETS[0].id);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/unknown preset "not-a-preset", using "lesson-decoder"/);
  });

  it("a qualifier id used in compare mode warns too; it names the compare sets", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(findCompareSet("one-hot").id).toBe("casex-vs-inside");
    expect(warn.mock.calls[0][0]).toMatch(/unknown compare set "one-hot", using "casex-vs-inside".*opcode-decoder/);
  });

  it("a known id and no id at all do not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    findPreset("one-hot");
    findPreset(undefined);
    findCompareSet("opcode-decoder");
    findCompareSet(undefined);
    expect(warn).not.toHaveBeenCalled();
  });

  it("production stays quiet", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(findPreset("not-a-preset").id).toBe(DECISION_PRESETS[0].id);
    vi.unstubAllEnvs();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("sv-decision-model: why one match stays silent is worded per qualifier (§12.5.3, §12.4.2)", () => {
  const one = (qualifier: Qualifier, form: DecisionForm = "case") => evaluateDecision({ ...decoder(qualifier, false, form) }).silentBecause;

  it("each qualifier names the checks it has, and a plain statement says it has none", () => {
    expect(one("plain")).toBe("Exactly one case item matches, and a plain case has no checks, so nothing is reported (§12.5).");
    expect(one("unique")).toBe("Exactly one case item matches, so unique has neither a missing match nor an overlap to report (§12.5.3).");
    expect(one("unique0")).toBe("Exactly one case item matches, so unique0 has no overlap to report (§12.5.3).");
    expect(one("priority")).toBe("Exactly one case item matches, so priority has no missing match to report (§12.5.3).");
    expect(one("plain", "if-else-if")).toBe("Exactly one condition matches, and a plain if has no checks, so nothing is reported (§12.4).");
    expect(one("unique", "if-else-if")).toMatch(/\(§12\.4\.2\)\.$/);
  });

  it("no reachable statement says a check fires when it has none", () => {
    sweep((name, r) => {
      expect(r.silentBecause ?? "", name).not.toMatch(/neither check fires/);
      if (r.config.qualifier === "plain" && r.column === "one") expect(r.silentBecause, name).toMatch(/has no checks/);
    });
  });
});

describe("sv-decision-model: each listed value gets its own note, and it speaks only about that value", () => {
  /** True when the note names `other`, as a body, a literal, or (from three bits up) its decimal value. */
  const naming = (note: string, other: string, width: number): boolean => {
    if (note.includes(`'b${other}`)) return true;
    const bare = note
      .replace(/§[\d.]+/g, "")
      .replace(/\d*'[bdh][\w?]+/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\bbit \d( to be \d)?/g, "")
      .replace(/t = \d+ ns/g, "");
    const escaped = other.replace(/[?]/g, "\\?");
    if (new RegExp(`(^|[^\\w'])${escaped}($|[^\\w])`).test(bare)) return true;
    return width >= 3 && /^[01]+$/.test(other) && new RegExp(`(^|[^\\w'])${Number.parseInt(other, 2)}($|[^\\w])`).test(bare);
  };

  it("the helper catches what it is there for", () => {
    expect(naming("sel = x1 has x against a fixed bit", "x1", 2)).toBe(true);
    expect(naming("values 3, 5, 6 and 7 cause a report", "101", 3)).toBe(true);
    expect(naming("it matches 'b00x and nothing else", "00x", 3)).toBe(true);
    expect(naming("3'b00? needs bit 1 to be 0 (§12.5.3)", "000", 3)).toBe(false);
    expect(naming("the item 2'b1? is listed", "11", 2)).toBe(false);
  });

  it("every preset has a line for each listed value and none for a value it does not list", () => {
    for (const p of DECISION_PRESETS) {
      expect(Object.keys(p.valueNotes).sort(), p.id).toEqual([...p.selectOptions].sort());
      for (const body of p.selectOptions) expect(presetValueNote(p, body), `${p.id} ${body}`).not.toBe(OWN_VALUE_NOTE);
    }
  });

  it("a value built bit by bit gets the generic line", () => {
    expect(presetValueNote(findPreset("lesson-decoder"), "zz")).toBe(OWN_VALUE_NOTE);
  });

  it("a preset's note at value V states no outcome for any other listed value", () => {
    for (const p of DECISION_PRESETS) for (const body of p.selectOptions) for (const other of p.selectOptions) {
      if (other === body) continue;
      expect(naming(presetValueNote(p, body), other, body.length), `${p.id}: the note for ${body} names ${other}: ${presetValueNote(p, body)}`).toBe(false);
    }
  });

  it("a compare note at value V states no outcome for any other listed value, under casex and under casez", () => {
    for (const s of COMPARE_SETS) for (const kind of ["casex", "casez"] as const) for (const body of s.selectOptions) for (const other of s.selectOptions) {
      if (other === body) continue;
      const note = compareValueNote(s, bits(body), kind);
      expect(naming(note, other, body.length), `${s.id} ${kind}: the note for ${body} names ${other}: ${note}`).toBe(false);
    }
  });

  it("the whole-preset line never repeats a sentence of a value's line, since both can be on screen", () => {
    for (const p of DECISION_PRESETS) for (const body of p.selectOptions) {
      const wrap = new Set(splitSentences(p.wrapUp));
      for (const sentence of splitSentences(presetValueNote(p, body))) expect(wrap.has(sentence), `${p.id} ${body}: ${sentence}`).toBe(false);
    }
    for (const s of COMPARE_SETS) for (const kind of ["casex", "casez"] as const) for (const body of s.selectOptions) {
      const wrap = new Set(splitSentences(compareWrapUp(s, kind)));
      for (const sentence of splitSentences(compareValueNote(s, bits(body), kind))) expect(wrap.has(sentence), `${s.id} ${kind} ${body}: ${sentence}`).toBe(false);
    }
  });

  it("the notes' claims hold in the model: each is checked against the value it is written for", () => {
    const on = (id: string, body: string) => evaluateDecision(withSelect(findPreset(id).config, body));
    // The standard's example comments (§12.5.3).
    for (const body of ["011", "101", "110", "111"]) {
      expect(presetValueNote(findPreset("lrm-unique-case"), body)).toMatch(/among those that cause a violation report/);
      expect(on("lrm-unique-case", body).reportKind, body).toBe("no-match");
      expect(presetValueNote(findPreset("lrm-unique0-case"), body)).toMatch(/unique0 does not/);
      expect(on("lrm-unique0-case", body).reportKind, body).toBe("nothing");
    }
    for (const body of ["100", "111"]) expect(on("lrm-priority-casez", body).reportKind, body).toBe("no-match");
    expect(on("lrm-priority-casez", "000").matchCount).toBe(2);
    expect(on("lrm-priority-casez", "011").items.map((v) => v.matches)).toEqual([false, true]);
    // One item listing two matching-candidate expressions is one match, not an overlap (§12.5.3).
    for (const body of ["000", "001"]) expect(on("lrm-unique-case", body).reportKind, body).toBe("nothing");
    // The standard's §12.5.4 comments, including 'b00x and 'bxxx failing.
    for (const body of ["0x0", "0z0", "010"]) expect(runOutcomeId(on("lrm-priority-inside", body).runs), body).toBe("item-1");
    for (const body of ["00x", "xxx"]) expect(on("lrm-priority-inside", body).reportKind, body).toBe("no-match");
    for (const body of ["001", "011"]) expect(runOutcomeId(on("lrm-priority-inside", body).runs), body).toBe("item-0");
    expect(runOutcomeId(on("lrm-priority-inside", "101").runs)).toBe("item-1");
    // Lesson and kata.
    expect(on("lesson-decoder", "11").reportKind).toBe("no-match");
    expect(on("lesson-decoder", "xx").reportKind).toBe("no-match");
    expect(on("kata-c-2", "xx").runs).toEqual({ kind: "catch-all" });
    expect(on("kata-c-2", "01").runs).toEqual({ kind: "item", index: 1 });
    expect(on("kata-c-3", "xx").reportKind).toBe("nothing");
    expect(runOutcomeId(on("kata-c-4", "1x").runs)).toBe("item-1");
    expect(on("kata-c-4", "x1").items.map((v) => v.result)).toEqual(["x", "x"]);
    expect(on("kata-c-4", "xx").items.map((v) => v.result)).toEqual(["x", "x"]);
    // Wildcards, one-hot and the encoder.
    expect(on("casez-overlap", "11").matchCount).toBe(2);
    expect(on("casez-overlap", "10").items.map((v) => v.matches)).toEqual([true, false]);
    expect(on("casez-overlap", "01").items.map((v) => v.matches)).toEqual([false, true]);
    expect(on("casez-overlap", "00").matchCount).toBe(0);
    expect(on("one-hot", "011").reportKind).toBe("overlap");
    expect(on("one-hot", "0x1").items[1].matches).toBe(false);
    expect(on("one-hot", "0x1").reportKind).toBe("nothing");
    expect(evaluateDecision({ ...withSelect(findPreset("one-hot").config, "000"), qualifier: "unique0" }).reportKind).toBe("nothing");
    expect(evaluateDecision({ ...withSelect(findPreset("one-hot").config, "000"), catchAll: true }).reportKind).toBe("nothing");
    expect(on("priority-encoder", "0110").reportKind).toBe("nothing");
    expect(on("priority-encoder", "0000").reportKind).toBe("no-match");
    expect(runOutcomeId(on("priority-encoder", "1000").runs)).toBe("item-3");
    expect(on("priority-encoder", "1111").matchCount).toBe(4);
    expect(evaluateDecision({ ...withSelect(findPreset("unique-if").config, "00"), catchAll: true }).reportKind).toBe("nothing");
    expect(on("unique-if", "11").reportKind).toBe("overlap");
    // The Flow Control table's casex column.
    const table = (body: string) => compareDecisions(findCompareSet("casex-vs-inside"), bits(body), "casex");
    expect(table("1x").left.matchCount).toBe(2);
    expect(table("xx").left.matchCount).toBe(2);
    expect(runOutcomeId(table("x1").left.runs)).toBe("item-1");
    for (const body of ["1x", "x1", "xx"]) expect(table(body).right.runs, body).toEqual({ kind: "nothing" });
    const hazard = compareDecisions(findCompareSet("opcode-decoder"), bits("0x0"), "casex");
    expect(runOutcomeId(hazard.left.runs)).toBe("item-0");
  });

  it("a computed compare note agrees with the two columns for every select value of every set", () => {
    for (const s of COMPARE_SETS) {
      const width = s.selectOptions[0].length;
      const values = Array.from({ length: BIT4_VALUES.length ** width }, (_, n) => Array.from({ length: width }, (_, i) => BIT4_VALUES[Math.floor(n / BIT4_VALUES.length ** i) % BIT4_VALUES.length]));
      for (const select of values) for (const kind of ["casex", "casez"] as const) {
        const { left, right } = compareDecisions(s, select, kind);
        const same = runOutcomeId(left.runs) === runOutcomeId(right.runs);
        const name = `${s.id} ${kind} ${select.join("")}`;
        if (s.valueNotes[select.join("")] && kind === "casex") continue;
        const note = compareValueNote(s, select, kind);
        if (select.every((b) => b === "0" || b === "1")) {
          expect(same, name).toBe(true);
          expect(note, name).toMatch(/is known, so both columns reach the same outcome/);
        } else if (!same) {
          expect(note, name).toMatch(/The columns differ on/);
          // Every disagreement comes from the left column skipping a select bit that case inside would not.
          expect(left.runs.kind, name).toBe("item");
        } else if (right.runs.kind === "item") {
          expect(note, name).toMatch(/under the item's own wildcard/);
          const v = right.items[right.runs.index];
          expect(v.terms.some((t) => t.chips?.every((c) => !(c.left === "x" || c.left === "z") || c.wildcard)), name).toBe(true);
        } else {
          expect(note, name).toMatch(/Neither column finds a matching item/);
          expect(left.matchCount, name).toBe(0);
          expect(right.matchCount, name).toBe(0);
        }
      }
    }
  });

  it("the casez closing line is computed: only 1z differs in the Flow Control set, and no listed value differs in the others", () => {
    expect(compareWrapUp(findCompareSet("casex-vs-inside"), "casez")).toBe("Of the listed values, under casez the columns differ only for sel = 2'b1z: casez skips a z in the case expression too (§12.5.1).");
    for (const id of ["wildcard-item", "opcode-decoder"]) {
      const s = findCompareSet(id);
      expect(compareWrapUp(s, "casez"), id).toMatch(/lands in the same place in both columns/);
      expect(s.selectOptions.every((b) => !b.includes("z")), id).toBe(true);
    }
    for (const s of COMPARE_SETS) expect(compareWrapUp(s, "casex"), s.id).toBe(s.wrapUp);
  });

  it("the sets offered on the operators page do not point at a table that page lacks", () => {
    for (const s of COMPARE_SETS) {
      const text = [s.summary, s.wrapUp, ...Object.values(s.valueNotes)].join(" ");
      expect(text, s.id).not.toMatch(/the lesson's/i);
    }
    expect(findCompareSet("casex-vs-inside").summary).toMatch(/Flow Control/);
    expect(findCompareSet("casex-vs-inside").wrapUp).toMatch(/Flow Control/);
  });
});

describe("sv-decision-model: the walk through a preset's values", () => {
  it("counts listed values only", () => {
    expect(triedProgress(["01", "11", "xx"], [])).toEqual({ count: 0, total: 3, complete: false });
    expect(triedProgress(["01", "11", "xx"], ["11", "zz"])).toEqual({ count: 1, total: 3, complete: false });
    expect(triedProgress(["01", "11", "xx"], ["xx", "01", "11"])).toEqual({ count: 3, total: 3, complete: true });
  });

  it("the next value follows list order, skips what has been tried, and wraps", () => {
    const options = ["01", "11", "xx"];
    expect(nextSelectValue(options, "01")).toBe("11");
    expect(nextSelectValue(options, "xx")).toBe("01");
    expect(nextSelectValue(options, "01", ["01", "11"])).toBe("xx");
    expect(nextSelectValue(options, "xx", ["01", "11", "xx"])).toBe("01");
    // A value on no list starts from the top of the list.
    expect(nextSelectValue(options, "zz")).toBe("01");
    expect(nextSelectValue(options, "zz", ["01"])).toBe("11");
    expect(nextSelectValue(["01"], "01")).toBe("01");
  });

  it("repeated Try next reaches every listed value of every preset and item set", () => {
    for (const options of [...DECISION_PRESETS.map((p) => p.selectOptions), ...COMPARE_SETS.map((s) => s.selectOptions)]) {
      const tried = [options[0]];
      let current = options[0];
      for (let i = 1; i < options.length; i += 1) {
        current = nextSelectValue(options, current, tried);
        tried.push(current);
      }
      expect(triedProgress(options, tried).complete, options.join()).toBe(true);
    }
  });
});

describe("sv-decision-model: one statement of each fact", () => {
  it("splitSentences keeps clause numbers whole", () => {
    expect(splitSentences("A matches (§12.5.3). B runs. ")).toEqual(["A matches (§12.5.3).", "B runs."]);
    expect(splitSentences("sel ==? 2'b1? is 1: it matches.")).toEqual(["sel ==? 2'b1? is 1: it matches."]);
    expect(splitSentences("")).toEqual([]);
  });

  it("freshWhys drops what the prompts told, and tells a repeated sentence once across the cards", () => {
    const r = evaluateDecision(withSelect(decoder("plain"), "xx"));
    const repeated = "case (not casez or casex) compares x and z literally (§12.5).";
    expect(r.items.every((v) => v.terms[0].why.endsWith(repeated))).toBe(true);
    const fresh = freshWhys(r, []);
    expect(fresh[0][0]).toContain(repeated);
    expect(fresh[1][0]).not.toContain(repeated);
    expect(fresh[2][0]).not.toContain(repeated);
    // A term the feedback already explained has nothing left to say.
    const hit = evaluateDecision(decoder("plain"));
    const told = explainRunChoice(hit, hit.runs).feedback;
    expect(freshWhys(hit, [told])[1][0]).toBe("");
    expect(freshWhys(hit, [])[1][0]).toBe(hit.items[1].terms[0].why);
  });

  it("the ran line says only what ran", () => {
    expect(evaluateDecision(decoder("unique")).ranLine).toBe("Item 2 (2'b01) runs.");
    expect(evaluateDecision(withSelect(decoder("unique"), "xx")).ranLine).toBe("Nothing runs.");
    expect(evaluateDecision(withSelect(decoder("unique", true), "xx")).ranLine).toBe("The default runs.");
    expect(evaluateDecision(findPreset("unique-if").config).ranLine).toBe("Branch 2 (req[1]) runs.");
    sweep((name, r) => expect(r.ranLine, name).not.toMatch(/report|violation|match/i));
  });

  it("the correct and the chosen feedback share no sentence, in any reachable configuration, for either prompt", () => {
    sweep((name, r) => {
      const runRight = explainRunChoice(r, r.runs).feedback;
      const reportRight = explainReportChoice(r, r.reportKind).feedback;
      const right = new Set([...splitSentences(runRight), ...splitSentences(reportRight), r.ranLine]);
      expect(right.size, `${name}: ${runRight} | ${reportRight} | ${r.ranLine}`).toBe(splitSentences(runRight).length + splitSentences(reportRight).length + 1);
      for (const choice of runChoices(r)) {
        if (runOutcomeId(choice) === runOutcomeId(r.runs)) continue;
        for (const sentence of splitSentences(explainRunChoice(r, choice).feedback)) expect(right.has(sentence), `${name} ${runOutcomeId(choice)}: ${sentence}`).toBe(false);
      }
      for (const kind of ["nothing", "no-match", "overlap"] as ReportKind[]) {
        if (kind === r.reportKind) continue;
        for (const sentence of splitSentences(explainReportChoice(r, kind).feedback)) expect(right.has(sentence), `${name} ${kind}: ${sentence}`).toBe(false);
      }
    });
  });

  it("a wrong run choice does not paste the correct answer's explanation", () => {
    sweep((name, r) => {
      const whyRight = r.runs.kind === "item" ? r.items[r.runs.index].terms.filter((t) => t.result === "1").map((t) => t.why) : [];
      for (const choice of runChoices(r)) {
        if (runOutcomeId(choice) === runOutcomeId(r.runs)) continue;
        const { feedback } = explainRunChoice(r, choice);
        for (const why of whyRight) expect(feedback.includes(why), `${name} ${runOutcomeId(choice)}`).toBe(false);
      }
    });
  });
});

/* ------------------------------------------------------------------ */

const allSelects = (width: number): Bit4[][] => Array.from({ length: BIT4_VALUES.length ** width }, (_, n) => Array.from({ length: width }, (_, i) => BIT4_VALUES[Math.floor(n / BIT4_VALUES.length ** i) % BIT4_VALUES.length]));

/** Every text a statement can show about its own outcome, for sweeps over the wording. */
const allTexts = (r: ReturnType<typeof evaluateDecision>): string[] => [
  r.silentBecause ?? "",
  r.report?.detail ?? "",
  r.summary,
  ...runChoices(r).map((c) => explainRunChoice(r, c).feedback),
  ...(["nothing", "no-match", "overlap"] as const).map((k) => explainReportChoice(r, k).feedback),
  ...r.items.flatMap((v) => v.terms.map((t) => t.why)),
];

describe("sv-decision-model: a skipped select bit is named by its value (§12.5.1)", () => {
  const whys = (form: "casez" | "casex", select: string, items: string[]) =>
    evaluateDecision({ form, qualifier: "plain", catchAll: false, selectName: "sel", select: bits(select), items: items.map(lit) }).items.map((v) => v.terms[0].why);

  it("casez skips z, so it says z", () => {
    expect(whys("casez", "1z", ["2'b10"])[0]).toBe("2'b10 matches: casez skips bit 0, including the z bit of the select itself (§12.5.1).");
    expect(whys("casez", "z1", ["2'b11"])[0]).toBe("2'b11 matches: casez skips bit 1, including the z bit of the select itself (§12.5.1).");
    expect(whys("casez", "zz", ["2'b11"])[0]).toBe("2'b11 matches: casez skips bits 1, 0, including the z bits of the select itself (§12.5.1).");
  });

  it("casex skips x and z, and says which one it met", () => {
    expect(whys("casex", "1x", ["2'b10"])[0]).toBe("2'b10 matches: casex skips bit 0, including the x bit of the select itself (§12.5.1).");
    expect(whys("casex", "1z", ["2'b10"])[0]).toBe("2'b10 matches: casex skips bit 0, including the z bit of the select itself (§12.5.1).");
    expect(whys("casex", "xz", ["2'b10"])[0]).toBe("2'b10 matches: casex skips bits 1, 0, including the x and z bits of the select itself (§12.5.1).");
  });

  it("a don't-care that sits only in the item says nothing about the select", () => {
    expect(whys("casez", "10", ["2'b1?"])[0]).toBe("2'b1? matches: casez skips bit 0 (§12.5.1).");
    // The select's x is not what casez skipped here: the item's ? is.
    expect(whys("casez", "1x", ["2'b1?"])[0]).toBe("2'b1? matches: casez skips bit 0 (§12.5.1).");
  });

  it("no skip explanation ever calls the skipped bit unknown, on any select of any preset", () => {
    for (const p of DECISION_PRESETS) for (const form of ["casez", "casex"] as const) for (const select of allSelects(p.config.select.length)) {
      const r = evaluateDecision({ ...p.config, form, select });
      for (const t of allTexts(r)) expect(t, `${p.id} ${form} ${select.join("")}`).not.toMatch(/unknown bit of the select/);
    }
  });
});

describe("sv-decision-model: a catch-all does not match; it runs when nothing else does (§12.4.2, §12.5)", () => {
  const miss = (qualifier: Qualifier, form: DecisionForm = "case") => evaluateDecision(withSelect(decoder(qualifier, true, form), "11"));

  it("the reason stated depends on whether the qualifier has a missing-match check", () => {
    expect(miss("unique").silentBecause).toBe("No case item matches, but there is a default: it runs, and unique reports a missing match only when there is no default (§12.5, §12.5.3).");
    expect(miss("priority").silentBecause).toBe("No case item matches, but there is a default: it runs, and priority reports a missing match only when there is no default (§12.5, §12.5.3).");
    expect(miss("unique0").silentBecause).toBe("The default runs, and unique0 has no check for a missing match (§12.5.3).");
    expect(miss("plain").silentBecause).toBe("The default runs, and a plain case has no check for a missing match (§12.5).");
    expect(miss("unique", "if-else-if").silentBecause).toBe("No condition matches, but there is an else: it runs, and unique reports a missing match only when there is no else (§12.4.2).");
    expect(miss("priority", "if-else-if").silentBecause).toBe("No condition matches, but there is an else: it runs, and priority reports a missing match only when there is no else (§12.4.2).");
    expect(miss("unique0", "if-else-if").silentBecause).toBe("The else runs, and unique0 has no check for a missing match (§12.4.2).");
    expect(miss("plain", "if-else-if").silentBecause).toBe("The else runs, and a plain if has no check for a missing match (§12.4).");
  });

  it("the wrong pick 'a no-match violation' says silences only where there is a check to silence", () => {
    const pick = (qualifier: Qualifier, form: DecisionForm = "case") => explainReportChoice(miss(qualifier, form), "no-match").feedback;
    expect(pick("unique")).toBe("A default silences the missing-match check, which may be the check you wanted.");
    expect(pick("priority", "if-else-if")).toBe("An else silences the missing-match check, which may be the check you wanted.");
    expect(pick("unique0")).toBe("unique0 reports no missing match, with or without a default.");
    expect(pick("unique0", "if-else-if")).toBe("unique0 reports no missing match, with or without an else.");
    expect(pick("plain")).toBe("A plain case reports no missing match, with or without a default.");
    expect(pick("plain", "if-else-if")).toBe("A plain if chain reports no missing match, with or without an else.");
  });

  it("a report's detail cites §12.5 with §12.5.3 for a case and §12.4.2 for an if chain; the ticket keeps the qualifier's own clause", () => {
    const report = (form: DecisionForm) => evaluateDecision(withSelect(decoder("unique", false, form), "11")).report;
    expect(report("case")?.clause).toBe("§12.5.3");
    expect(report("case")?.detail).toBe("unique reports when no case item matches and there is no default (§12.5, §12.5.3).");
    expect(report("if-else-if")?.clause).toBe("§12.4.2");
    expect(report("if-else-if")?.detail).toBe("unique reports when no condition matches and there is no else (§12.4.2).");
  });

  it("no reachable text says a catch-all matches, that no match cannot happen, or that a check it lacks was silenced", () => {
    sweep((name, r) => {
      const qualifierHasCheck = reportsNoMatch(r.config.qualifier);
      for (const t of allTexts(r)) {
        expect(t, name).not.toMatch(/matches every leftover|itself an alternative|cannot happen|can never happen|With a else|a else\b/);
        if (!qualifierHasCheck) expect(t, name).not.toMatch(/silences/);
      }
      // What the text says agrees with the numbers: the catch-all ran because nothing matched.
      if (r.runs.kind === "catch-all") expect(r.matchCount, name).toBe(0);
    });
  });
});

describe("sv-decision-model: a later fitting item, by qualifier (§12.5, §12.5.3, §12.4.1, §12.4.2)", () => {
  it("unique and unique0 keep comparing, so they find it; plain and priority stop at the first match", () => {
    expect(laterMatchBadge("casez", "unique")).toBe("matches, not run (the first match wins)");
    expect(laterMatchBadge("casez", "unique0")).toBe("matches, not run (the first match wins)");
    expect(laterMatchBadge("casez", "plain")).toBe("would also match; the search stopped at the first match (§12.5)");
    expect(laterMatchBadge("case-inside", "priority")).toBe("would also match; the search stopped at the first match (§12.5)");
    expect(laterMatchBadge("if-else-if", "priority")).toBe("would also match; the chain ended at the first match (§12.4.1)");
    expect(laterMatchBadge("if-else-if", "unique")).toBe("matches, not run (the first match wins)");
  });
});

describe("sv-decision-model: a bit-select listed beside literals (§12.5, §12.5.2)", () => {
  const mixed = (select: string): DecisionConfig => ({ form: "case", qualifier: "plain", catchAll: false, selectName: "s", select: bits(select), items: [{ terms: [{ kind: "bit", index: 0 }] }, { terms: [{ kind: "literal", text: "2'b01" }] }] });

  it("the expression is the select, and the text says what is compared", () => {
    const r = evaluateDecision(mixed("01"));
    expect(r.constantExpression).toBe(false);
    expect(r.expression).toEqual(bits("01"));
    expect(decisionSource(mixed("01")).map((l) => l.text)).toContain("case (s)");
    // s[0] is 1, extended to 2'b01, which equals s.
    expect(r.items[0].matches).toBe(true);
    expect(r.items[0].terms[0].why).toBe("s[0] matches bit for bit (§12.5).");
    for (const select of allSelects(2)) for (const form of ["case", "casez", "casex"] as const) {
      for (const v of evaluateDecision({ ...mixed("00"), form, select }).items) for (const t of v.terms) expect(t.why, `${form} ${select.join("")}`).not.toMatch(/case expression 1'b1/);
    }
  });

  it("when every item is a bit-select, the text still speaks of the constant 1'b1", () => {
    const r = evaluateDecision({ ...mixed("01"), items: [{ terms: [{ kind: "bit", index: 0 }] }, { terms: [{ kind: "bit", index: 1 }] }] });
    expect(r.constantExpression).toBe(true);
    expect(r.items[0].terms[0].why).toBe("s[0] is 1, which matches the case expression 1'b1 (§12.5.2).");
  });
});

describe("sv-decision-model: outcomes pinned one by one, independent of the report predicates", () => {
  const p = (id: string) => findPreset(id).config;

  it("preset values the sweeps only compare with each other", () => {
    expect(outcome(p("unique-if"), "01")).toEqual(["item-0", "nothing"]);
    expect(outcome(p("kata-c-3"), "01")).toEqual(["item-1", "nothing"]);
    expect(outcome(p("lesson-decoder"), "00")).toEqual(["item-0", "nothing"]);
    expect(outcome(p("lesson-decoder"), "10")).toEqual(["item-2", "nothing"]);
  });

  it("a default or else does not hide an overlap: it removes only the no-match report (§12.4.2, §12.5.3)", () => {
    expect(outcome({ ...p("unique-if"), catchAll: true }, "11")).toEqual(["item-0", "overlap"]);
    expect(outcome({ ...p("unique-if"), catchAll: true, qualifier: "unique0" }, "11")).toEqual(["item-0", "overlap"]);
    expect(outcome({ ...p("casez-overlap"), catchAll: true }, "11")).toEqual(["item-0", "overlap"]);
    expect(outcome({ ...p("casez-overlap"), catchAll: true, qualifier: "unique0" }, "11")).toEqual(["item-0", "overlap"]);
    expect(outcome({ ...p("unique-if"), catchAll: true }, "00")).toEqual(["catch-all", "nothing"]);
    expect(outcome({ ...p("lesson-decoder"), catchAll: true }, "11")).toEqual(["catch-all", "nothing"]);
  });

  it("the priority-encoder closing line keeps its design claim to this encoder, and uncited", () => {
    const { wrapUp } = findPreset("priority-encoder");
    expect(wrapUp).toBe("priority lets the items overlap and reports when no item matches (§12.5.3). Here that is the thing this encoder must not do: see a request with no bit set.");
    expect(outcome(p("priority-encoder"), "xxxx")).toEqual(["nothing", "no-match"]);
  });

  it("the literal rule is not worded as if it applied only without a qualifier", () => {
    const r = evaluateDecision(withSelect(findPreset("lesson-decoder").config, "xx"));
    expect(r.config.qualifier).toBe("unique");
    sweep((name, v) => {
      for (const t of allTexts(v)) expect(t, name).not.toMatch(/a plain case (compares|would compare)/i);
    });
    expect(explainRunChoice(r, { kind: "nothing" }).feedback).toMatch(/case \(not casez or casex\) compares x and z literally/);
  });
});

describe("sv-decision-model: compare notes hold beyond the listed values (§12.5.1)", () => {
  const differing = (id: string, kind: "casex" | "casez") => {
    const s = findCompareSet(id);
    return allSelects(s.selectOptions[0].length).filter((select) => {
      const { left, right } = compareDecisions(s, select, kind);
      return runOutcomeId(left.runs) !== runOutcomeId(right.runs);
    }).map((select) => select.join(""));
  };

  it("in the Flow Control set under casez the columns differ on exactly 1z, z0, z1 and zz", () => {
    expect(differing("casex-vs-inside", "casez").sort()).toEqual(["1z", "z0", "z1", "zz"]);
  });

  it("every select that differs under casez holds a z, and under casex an x or z, in all three sets", () => {
    for (const s of COMPARE_SETS) {
      for (const body of differing(s.id, "casez")) expect(body, s.id).toContain("z");
      for (const body of differing(s.id, "casex")) expect(body, s.id).toMatch(/[xz]/);
    }
  });

  it("the casez closing line never claims more than the listed values, so a value built by hand cannot contradict it", () => {
    for (const s of COMPARE_SETS) {
      const line = compareWrapUp(s, "casez");
      const unlisted = differing(s.id, "casez").filter((body) => !s.selectOptions.includes(body));
      if (unlisted.length > 0) expect(line, s.id).toMatch(/^(Of the listed values|Under casez every listed value)/);
    }
    expect(differing("casex-vs-inside", "casez")).toContain("z1");
    expect(compareValueNote(findCompareSet("casex-vs-inside"), bits("z1"), "casez")).toMatch(/^The columns differ on 2'bz1/);
  });

  it("the differ note counts the bits right and leaves the case inside rule to the asymmetry note", () => {
    const flow = findCompareSet("casex-vs-inside");
    const wild = findCompareSet("wildcard-item");
    expect(compareValueNote(flow, bits("1z"), "casez")).toBe("The columns differ on 2'b1z: casez skips every z bit of the select, at every item.");
    expect(compareValueNote(wild, bits("zx"), "casex")).toBe("The columns differ on 2'bzx: casex skips every x or z bit of the select, at every item.");
    for (const s of COMPARE_SETS) for (const select of allSelects(s.selectOptions[0].length)) for (const kind of ["casex", "casez"] as const) {
      expect(compareValueNote(s, select, kind), `${s.id} ${kind} ${select.join("")}`).not.toMatch(/accepts? (one|a select x) only under/);
    }
  });

  it("a known select's note holds where nothing runs in either column", () => {
    const flow = findCompareSet("casex-vs-inside");
    const { left, right } = compareDecisions(flow, bits("00"), "casex");
    expect([left.runs.kind, right.runs.kind]).toEqual(["nothing", "nothing"]);
    expect(compareValueNote(flow, bits("00"), "casex")).toBe("Every bit of 2'b00 is known, so both columns reach the same outcome.");
  });
});

describe("sv-decision-model: one paragraph says each thing once", () => {
  it("no feedback repeats a sentence, for every run choice and report choice", () => {
    sweep((name, r) => {
      const texts = [...runChoices(r).map((c) => explainRunChoice(r, c).feedback), ...(["nothing", "no-match", "overlap"] as const).map((k) => explainReportChoice(r, k).feedback)];
      for (const t of texts) {
        const sentences = splitSentences(t);
        expect(new Set(sentences).size, `${name}: ${t}`).toBe(sentences.length);
      }
    });
  });

  it("the multi-term repeats that used to reach the screen are gone", () => {
    const once = (text: string, sentence: string) => expect(text.split(sentence).length - 1, text).toBe(1);
    const inside = evaluateDecision(withSelect(findPreset("lrm-priority-inside").config, "xxx"));
    once(explainRunChoice(inside, { kind: "item", index: 0 }).feedback, "An x or z on the left is not a wildcard (§11.4.6).");
    const op = (body: string) => compareDecisions(findCompareSet("opcode-decoder"), bits(body), "casez").left;
    once(explainRunChoice(op("0x0"), { kind: "item", index: 1 }).feedback, "casez skips only z, so an x must match exactly (§12.5.1).");
    once(explainRunChoice(op("1x0"), { kind: "item", index: 2 }).feedback, "casez skips only z, so an x must match exactly (§12.5.1).");
  });

  it("the same pick in both compare columns never prints the same sentence in both prompts", () => {
    for (const s of COMPARE_SETS) for (const select of allSelects(s.selectOptions[0].length)) for (const kind of ["casex", "casez"] as const) {
      const { left, right } = compareDecisions(s, select, kind);
      const sentences = (r: typeof left) => new Set(runChoices(r).flatMap((c) => splitSentences(explainRunChoice(r, c).feedback)));
      const inRight = sentences(right);
      for (const sentence of sentences(left)) expect(inRight.has(sentence), `${s.id} ${kind} ${select.join("")}: ${sentence}`).toBe(false);
    }
  });

  it("a wrong pick on an x condition states the if rule once: a bit or == condition already says x is false (§12.4)", () => {
    const xx = evaluateDecision(withSelect(findPreset("unique-if").config, "xx"));
    expect(explainRunChoice(xx, { kind: "item", index: 0 }).feedback).toBe("req[0] does not match. req[0] is x. An x or z condition counts as false, so this branch does not run (§12.4).");
    const eq = evaluateDecision({ ...withSelect(findPreset("lesson-decoder").config, "xx"), form: "if-else-if" });
    expect(explainRunChoice(eq, { kind: "item", index: 0 }).feedback).toBe("sel == 2'b00 does not match. sel == 2'b00 is x: bit 1 is x in sel, so == cannot decide (§11.4.5). An if treats x as false (§12.4).");
    // A ==? condition and a range explain only why the result is x, so the rule is added once.
    const wild = evaluateDecision({ ...withSelect(findPreset("lrm-priority-inside").config, "xxx"), form: "if-else-if" });
    expect(wild.items[1].result).toBe("x");
    expect(explainRunChoice(wild, { kind: "item", index: 1 }).feedback).toMatch(/An x or z on the left is not a wildcard \(§11\.4\.6\)\..* An x condition is false \(§12\.4\)\.$/);
    const rule = /x or z condition counts as false|An if treats x as false|An x condition is false/;
    sweep((name, r) => {
      if (r.config.form !== "if-else-if") return;
      for (const v of r.items) {
        if (v.result !== "x") continue;
        const sentences = splitSentences(explainRunChoice(r, { kind: "item", index: v.index }).feedback);
        expect(sentences.filter((s) => rule.test(s)).length, `${name} branch ${v.index + 1}: ${sentences.join(" ")}`).toBe(1);
      }
    });
  });
});

describe("sv-decision-model: later fitting items under plain and priority are not called matches (§12.5, §12.4.1)", () => {
  it("plain and priority say the items fit the select (in an if chain, hold); unique and unique0 compare them all and say match (§12.5.3, §12.4.2)", () => {
    const encoder = evaluateDecision({ ...withSelect(findPreset("priority-encoder").config, "1111"), qualifier: "plain" });
    expect(encoder.silentBecause).toBe("A plain casez has no check: 4'b???1, 4'b??1?, 4'b?1??, 4'b1??? all fit the select, the first one, 4'b???1, runs, and nothing is reported (§12.5).");
    expect(encoder.summary).toContain("4 case items fit the select (4'b???1, 4'b??1?, 4'b?1??, 4'b1???).");
    const plainChain = evaluateDecision({ ...withSelect(findPreset("unique-if").config, "11"), qualifier: "plain" });
    expect(plainChain.silentBecause).toBe("A plain if has no check: req[0], req[1] both hold, the first one, req[0], runs, and nothing is reported (§12.4.1).");
    expect(plainChain.summary).toContain("2 conditions hold (req[0], req[1]).");
    const priority = evaluateDecision({ ...findPreset("casez-overlap").config, qualifier: "priority" });
    expect(priority.summary).toContain("2 case items fit the select (2'b1?, 2'b?1).");
    expect(explainRunChoice(priority, priority.runs).feedback).toContain("2 casez items fit the select, and the first one in source order wins (§12.5); no qualifier changes that.");
    // unique: every item is compared, and two of them match.
    const unique = evaluateDecision(withSelect(findPreset("unique-if").config, "11"));
    expect(unique.report?.detail).toBe("unique asserts that the conditions do not overlap (§12.4.2). req[0], req[1] both match, so it reports a violation.");
    expect(unique.summary).toContain("2 conditions match (req[0], req[1]).");
  });

  it("no reachable text calls the later items matches under plain or priority, and two items are 'both', not 'all'", () => {
    sweep((name, r) => {
      if (r.matchCount < 2) return;
      const said = allTexts(r).join(" ");
      if (!reportsOverlap(r.config.qualifier)) expect(said, name).not.toMatch(/\b(all|both) match\b|\d (case items|conditions) match \(| items match, and the first| conditions match, and the first/);
      if (r.matchCount === 2) expect(said, name).not.toMatch(/\ball (match|fit|hold)\b/);
    });
  });
});

describe("sv-decision-model: the chip legend lists only the marks the reveal draws (visual-language: legends)", () => {
  it("the case family never draws x or a wildcard, only casez and casex draw a skip, and the ==? forms never skip (§12.5, §12.5.1, §11.4.6)", () => {
    sweep((name, r) => {
      const marks = chipMarks(r);
      const { form } = r.config;
      if (form === "case" || form === "casez" || form === "casex") expect([marks.unknown, marks.wildcard], name).toEqual([false, false]);
      if (form === "case" || form === "case-inside" || form === "if-else-if") expect(marks.skip, name).toBe(false);
      // Every drawn chip's mark is in the legend.
      for (const v of r.items) for (const t of v.terms) if (drawsChips(v, t)) for (const c of t.chips ?? []) {
        if (c.verdict === "skip") expect(marks.skip, name).toBe(true);
        if (c.verdict === "x") expect(marks.unknown, name).toBe(true);
        if (c.wildcard) expect(marks.wildcard, name).toBe(true);
      }
    });
  });

  it("names each mark by what is drawn: a plain case, a casez with ?, case inside with an x select, and the two compare columns together", () => {
    expect(chipMarks(evaluateDecision(withSelect(findPreset("lesson-decoder").config, "xx")))).toEqual({ skip: false, unknown: false, wildcard: false, questionMark: false });
    expect(chipMarks(evaluateDecision(findPreset("casez-overlap").config))).toEqual({ skip: true, unknown: false, wildcard: false, questionMark: true });
    // The finding's case: casez-overlap edited to a plain case compares the ? (a z) literally, so nothing is a wildcard.
    expect(chipMarks(evaluateDecision({ ...findPreset("casez-overlap").config, form: "case" }))).toEqual({ skip: false, unknown: false, wildcard: false, questionMark: true });
    expect(chipMarks(evaluateDecision(withSelect(findPreset("kata-c-4").config, "x1")))).toEqual({ skip: false, unknown: true, wildcard: true, questionMark: true });
    const { left, right } = compareDecisions(findCompareSet("casex-vs-inside"), bits("1x"), "casex");
    expect(chipMarks(left, right)).toEqual({ skip: true, unknown: true, wildcard: false, questionMark: false });
    // An if chain of == conditions never draws a wildcard, for any select.
    for (const select of allSelects(2)) expect(chipMarks(evaluateDecision({ ...findPreset("lesson-decoder").config, form: "if-else-if", select })).wildcard, select.join("")).toBe(false);
  });
});

describe("sv-decision-model: compare-set notes cite the clause they describe", () => {
  it("the opcode decoder's 0x0 line describes casex only, so it cites §12.5.1 alone", () => {
    const set = findCompareSet("opcode-decoder");
    expect(compareValueNote(set, bits("0x0"), "casex")).toBe("This is the operators lesson's hazard value: a corrupted opcode quietly takes a real branch under casex (§12.5.1).");
    expect(compareDecisions(set, bits("0x0"), "casex").left.items[0].terms[0].chips?.map((c) => c.verdict)).toEqual(["1", "skip", "1"]);
  });
});

describe("sv-decision-model: the whole reveal says each sentence once, for every pick (model-level sweep)", () => {
  /** What one prompt shows once revealed: the chosen option's feedback and, unless the pick was right, the correct option's (PredictionPrompt). A skip shows the correct one. */
  const promptTexts = (chosen: { correct: boolean; feedback: string } | null, correct: string): string[] => (chosen === null ? [correct] : chosen.correct ? [chosen.feedback] : [chosen.feedback, correct]);
  /** What the cards are told not to repeat: the correct option's feedback and the chosen one's (DecisionLab's toldBy). */
  const toldBy = (chosen: { feedback: string } | null, correct: string): string[] => (chosen ? [correct, chosen.feedback] : [correct]);
  const repeats = (texts: readonly string[]): string[] => {
    const sentences = texts.flatMap(splitSentences);
    return sentences.filter((s, i) => sentences.indexOf(s) !== i);
  };

  it("qualifiers mode: both prompts, the outcome line, the caveat, the value note, the wrap-up and the cards", () => {
    let checked = 0;
    const visit = (p: (typeof DECISION_PRESETS)[number], config: DecisionConfig, label: string) => {
      const r = evaluateDecision(config);
      const edited = isPresetEdited(r.config, p);
      const body = r.config.select.join("");
      const runCorrect = explainRunChoice(r, r.runs).feedback;
      const reportCorrect = explainReportChoice(r, r.reportKind).feedback;
      // The wrap-up stays on screen once the walk is complete, whatever value is shown; the notes belong to the preset's own statement.
      const notes = edited ? [] : [presetValueNote(p, body), p.wrapUp];
      for (const runPick of [null, ...runChoices(r)]) for (const reportPick of [null, ...REPORT_KINDS]) {
        const run = runPick ? explainRunChoice(r, runPick) : null;
        const report = reportPick ? explainReportChoice(r, reportPick) : null;
        const told = [...toldBy(run, runCorrect), ...toldBy(report, reportCorrect)];
        const texts = [...promptTexts(run, runCorrect), ...promptTexts(report, reportCorrect), r.ranLine, ...r.unsupported, ...notes, ...freshWhys(r, told).flat()];
        expect(repeats(texts), `${label} run=${runPick ? runOutcomeId(runPick) : "skip"} report=${reportPick ?? "skip"}`).toEqual([]);
        checked += 1;
      }
    };
    // The preset's own statement at every select value the bit editor can build.
    for (const p of DECISION_PRESETS) for (const select of allSelects(p.config.select.length)) visit(p, { ...p.config, select }, `${p.id} ${select.join("")}`);
    const own = checked;
    // Every form, qualifier and catch-all edit at the listed values.
    for (const p of DECISION_PRESETS) for (const form of DECISION_FORMS) for (const qualifier of QUALIFIERS) for (const catchAll of [false, true]) for (const body of p.selectOptions) {
      visit(p, { ...withSelect(p.config, body), form, qualifier, catchAll }, `${p.id} ${form} ${qualifier} ${catchAll} ${body}`);
    }
    // At least the combinations the last review swept by hand (14,336), plus the edits.
    expect(own).toBeGreaterThanOrEqual(14336);
    expect(checked - own).toBeGreaterThan(40000);
  });

  it("compare mode: both prompts, the value note with the asymmetry rule, the wrap-up and both columns' cards", () => {
    let checked = 0;
    for (const s of COMPARE_SETS) for (const kind of ["casex", "casez"] as const) for (const select of allSelects(s.selectOptions[0].length)) {
      const { left, right } = compareDecisions(s, select, kind);
      const leftCorrect = explainRunChoice(left, left.runs).feedback;
      const rightCorrect = explainRunChoice(right, right.runs).feedback;
      const notes = [`${compareValueNote(s, select, kind)} ${WILDCARD_ASYMMETRY_NOTE}`, compareWrapUp(s, kind)];
      for (const leftPick of [null, ...runChoices(left)]) for (const rightPick of [null, ...runChoices(right)]) {
        const l = leftPick ? explainRunChoice(left, leftPick) : null;
        const rr = rightPick ? explainRunChoice(right, rightPick) : null;
        // Each column has its own Result line, so the two ran lines are not compared with each other.
        const texts = [
          ...promptTexts(l, leftCorrect),
          ...promptTexts(rr, rightCorrect),
          ...notes,
          ...left.unsupported,
          ...right.unsupported,
          ...freshWhys(left, toldBy(l, leftCorrect)).flat(),
          ...freshWhys(right, toldBy(rr, rightCorrect)).flat(),
        ];
        expect(repeats(texts), `${s.id} ${kind} ${select.join("")} left=${leftPick ? runOutcomeId(leftPick) : "skip"} right=${rightPick ? runOutcomeId(rightPick) : "skip"}`).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(7072);
  });
});
