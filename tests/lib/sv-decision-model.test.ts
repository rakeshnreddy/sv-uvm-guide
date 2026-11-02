import { describe, expect, it } from "vitest";

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
  QUALIFIERS,
  RANGE_LIST_LIMIT,
  bitAt,
  branchWord,
  caseBitChips,
  compareDecisions,
  decisionSource,
  editedPresetNote,
  evaluateDecision,
  expandRange,
  explainReportChoice,
  explainRunChoice,
  findCompareSet,
  findPreset,
  gridCell,
  isPlainMiss,
  isPresetEdited,
  itemMissLine,
  matchColumnLabel,
  normalizeItems,
  orReduce,
  outcomeGrid,
  parseLiteral,
  rangeContains,
  rangeListingProblem,
  reportsNoMatch,
  reportsOverlap,
  runChoices,
  runOutcomeId,
  runningLineKey,
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

  it("normalizeItems expands ranges for the case family only (§12.5.4: a range is legal only in case inside)", () => {
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
  it("step 2: with a default every value matches something, so the report disappears (§12.5.3)", () => {
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
    expect(explainRunChoice(r, { kind: "item", index: 0 }).feedback).toMatch(/first one in source order wins \(§12\.5\); no qualifier changes that\./);
    const second = explainRunChoice(r, { kind: "item", index: 1 });
    expect(second.correct).toBe(false);
    expect(second.feedback).toMatch(/first match wins/);
    expect(second.feedback).toMatch(/No qualifier ever changes which case item runs \(§12\.5\.3\); the next question asks what it reports\.$/);
    const nothing = explainRunChoice(r, { kind: "nothing" });
    expect(nothing.correct).toBe(false);
    expect(nothing.feedback).toMatch(/2'b1\? matches, so it runs/);
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
    expect(explainRunChoice(miss, { kind: "nothing" }).feedback).toMatch(/catches every leftover value/);
  });

  it("what is reported: correct answers restate the rule; wrong answers name the misconception", () => {
    const miss = evaluateDecision(withSelect(decoder("unique"), "11"));
    expect(explainReportChoice(miss, "no-match")).toMatchObject({ correct: true });
    expect(explainReportChoice(miss, "no-match").feedback).toMatch(/Observed region/);
    expect(explainReportChoice(miss, "nothing").feedback).toMatch(/not silent/);
    expect(explainReportChoice(miss, "overlap").feedback).toMatch(/No case item matches, so there is no overlap/);

    const withDefault = evaluateDecision(withSelect(decoder("unique", true), "11"));
    expect(explainReportChoice(withDefault, "nothing")).toMatchObject({ correct: true });
    expect(explainReportChoice(withDefault, "no-match").feedback).toMatch(/can never happen/);

    const unique0 = evaluateDecision(withSelect(decoder("unique0"), "11"));
    expect(explainReportChoice(unique0, "no-match").feedback).toMatch(/unique0 reports overlaps only/);

    const plain = evaluateDecision(withSelect(decoder("plain"), "11"));
    expect(explainReportChoice(plain, "no-match").feedback).toMatch(/has no check/);

    const overlap = evaluateDecision(findPreset("casez-overlap").config);
    expect(explainReportChoice(overlap, "overlap")).toMatchObject({ correct: true });
    expect(explainReportChoice(overlap, "nothing").feedback).toMatch(/reports an overlap while still running the first/);
    expect(explainReportChoice(overlap, "no-match").feedback).toMatch(/opposite one/);

    const priority = evaluateDecision({ ...findPreset("casez-overlap").config, qualifier: "priority" });
    expect(explainReportChoice(priority, "overlap").feedback).toMatch(/priority allows overlap: it acts on the first match only/);
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
    expect(findPreset("not-a-preset").id).toBe(DECISION_PRESETS[0].id);
    expect(findPreset(undefined).id).toBe("lesson-decoder");
  });

  it("every compare set evaluates under casex, casez and case inside for each select option", () => {
    for (const s of COMPARE_SETS) for (const body of s.selectOptions) {
      expect(() => compareDecisions(s, bits(body), "casex")).not.toThrow();
      expect(() => compareDecisions(s, bits(body), "casez")).not.toThrow();
    }
    expect(findCompareSet("missing").id).toBe("casex-vs-inside");
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
      expect(feedback, `${name} ${qualifier}`).toMatch(/first one in source order wins \(§12\.(5|4\.1)\); no qualifier changes that\./);
      expect(feedback, `${name} ${qualifier}`).not.toMatch(/\b(unique|unique0|priority) changes that/);
    }
  });

  it("a later matching item: 'No qualifier ever changes which case item runs', and the qualifier's report is left to the next question", () => {
    const base = findPreset("casez-overlap").config; // 2'b1? then 2'b?1, sel = 11
    const later = (qualifier: Qualifier) => explainRunChoice(evaluateDecision({ ...base, qualifier }), { kind: "item", index: 1 });
    for (const q of ["unique", "unique0", "priority"] as Qualifier[]) {
      expect(later(q).correct, q).toBe(false);
      expect(later(q).feedback, q).toMatch(/first match wins \(§12\.5\)\. No qualifier ever changes which case item runs \(§12\.5\.3\); the next question asks what it reports\.$/);
    }
    // A plain statement has no qualifier to ask about, and compare mode (always plain) has no report question at all.
    expect(later("plain").feedback).toMatch(/No qualifier ever changes which case item runs \(§12\.5\.3\)\.$/);
    // An if chain cites §12.4.1 and §12.4.2, and says that a branch runs.
    const ifLater = explainRunChoice(evaluateDecision(withSelect(findPreset("unique-if").config, "11")), { kind: "item", index: 1 });
    expect(ifLater.feedback).toMatch(/first match wins \(§12\.4\.1\)\. No qualifier ever changes which branch runs \(§12\.4\.2\); the next question asks what it reports\./);
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
    expect(r.items[0].terms[0].why).toMatch(/^Not comparable: a range is legal only in case inside \(§12\.5\.4\), and \[0:100\] cannot be written as plain casex items because it spans 101 values/);
    expect(r.unsupported).toHaveLength(1);
    expect(r.summary).toMatch(/Caveat: 1 case item could not be compared in this form and was left out of the decision\./);
    expect(runOutcomeId(r.runs)).toBe("item-1");
    const src = decisionSource(r.config).map((l) => l.text);
    expect(src.find((l) => l.includes("[0:100]:"))).toMatch(/\/\/ not legal here: a range needs case inside \(§12\.5\.4\)$/);
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
    expect(r.items[1].terms[0].why).toMatch(/^gnt\[1\] is x; as the right operand of ==\? an x bit is a wildcard, so the constant 1'b1 matches \(§11\.4\.6\)\. A plain case would compare the x literally and not match \(§12\.5\)\./);
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

  it("every preset and item set has an after-reveal line", () => {
    for (const p of DECISION_PRESETS) expect(p.afterReveal.length, p.id).toBeGreaterThan(20);
    for (const s of COMPARE_SETS) expect(s.afterReveal.length, s.id).toBeGreaterThan(20);
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
    expect(feedback).toBe("Every case item fails: a plain case compares x and z literally (§12.5), so nothing runs.");
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
    expect(set.afterReveal).toMatch(/case inside accepts a select x only there; casex accepts it at every bit \(§12\.5\.1\)/);
    const r = compareDecisions(set, bits("x1"), "casex");
    expect(runOutcomeId(r.left.runs)).toBe("item-0");
    expect(r.left.items[0].terms[0].chips?.[0]).toMatchObject({ left: "x", right: "1", verdict: "skip" });
    expect(r.right.runs).toEqual({ kind: "nothing" });
  });

  it("casez-overlap names qualifiers, not forms: a plain case compares the ? literally, so with sel = 11 nothing runs (§12.5)", () => {
    const p = findPreset("casez-overlap");
    expect(p.afterReveal).toMatch(/Every qualifier runs the first/);
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
  it("the report feedback and the outcome line read as sentences, not a spliced note (§12.4.2.1, §12.5.3.1)", () => {
    const miss = evaluateDecision(withSelect(decoder("unique"), "11"));
    expect(explainReportChoice(miss, "no-match").feedback).toMatch(/ The check runs now; the report waits for the Observed region \(§12\.4\.2\.1, §12\.5\.3\.1\)\.$/);
    expect(miss.summary).toContain("unique case: no case item matches. Violation reported in the Observed region (§12.5.3, §12.4.2.1, §12.5.3.1).");
    expect(explainReportChoice(miss, "nothing").feedback).toMatch(/not silent\. The check runs now/);
    sweep((name, r) => {
      expect(r.summary, name).not.toMatch(/, checked now/);
      for (const kind of ["nothing", "no-match", "overlap"] as ReportKind[]) expect(explainReportChoice(r, kind).feedback, name).not.toMatch(/the report is checked/);
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
