import { describe, expect, it } from "vitest";

import {
  ANNEX_B_KEYWORDS,
  CHECKER_IDENTIFIERS,
  CHECKER_PRESETS,
  CHRONOLOGICAL_SPECIFIERS,
  DEFAULT_UNKNOWN,
  KEYWORD_TABLES,
  LEGACY_CNT_SCENARIO,
  LINEAGE_STOPS,
  LINEAGE_YEARS,
  NESTED_STACK_SCENARIO,
  NOCONFIG_EXCLUDED,
  SPECIFIER_INFO,
  VERSION_SPECIFIERS,
  acceptanceSentence,
  analyzeToken,
  baseLanguageDocument,
  classifyToken,
  constructTables,
  designationYear,
  directive,
  largestAddition,
  lineagePredictions,
  namedPortConnection,
  parseVersionSpecifier,
  regionGate,
  reservedWords,
  scenarioSteps,
  tableAddedBy,
  tableById,
  tableIntroducing,
  tableSentence,
  unmatchedAtEnd,
  walkRegions,
  wrongChoiceFeedback,
} from "@/lib/sv-keyword-model";

describe("version specifiers (22.14, Syntax 22-10)", () => {
  it("Syntax 22-10 lists exactly nine version specifiers", () => {
    expect(VERSION_SPECIFIERS).toEqual([
      "1800-2023",
      "1800-2017",
      "1800-2012",
      "1800-2009",
      "1800-2005",
      "1364-2005",
      "1364-2001",
      "1364-2001-noconfig",
      "1364-1995",
    ]);
    expect(new Set(CHRONOLOGICAL_SPECIFIERS)).toEqual(new Set(VERSION_SPECIFIERS));
  });

  it("22.14: an unrecognized specifier is an error, and the message allows custom tool specifiers", () => {
    const parsed = parseVersionSpecifier('"1364-2000"');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe("unrecognized");
      expect(parsed.message).toMatch(/shall be an error if an implementation does not recognize/);
      expect(parsed.message).toMatch(/custom specifiers/);
    }
  });

  it("22.14: quotes and white space around a standard specifier are accepted; case and spelling are exact", () => {
    expect(parseVersionSpecifier('  "1800-2009" ')).toEqual({ ok: true, specifier: "1800-2009" });
    expect(parseVersionSpecifier("1364-2001-noconfig")).toEqual({ ok: true, specifier: "1364-2001-noconfig" });
    expect(parseVersionSpecifier("1364-2001-NOCONFIG").ok).toBe(false);
    expect(parseVersionSpecifier("1800-2020").ok).toBe(false);
    const empty = parseVersionSpecifier('""');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe("empty");
  });
});

describe("keyword tables (22.14.2 to 22.14.9, Annex B)", () => {
  it("each table has the size the standard lists: 22-1 102, 22-2 21, 22-3 1, 22-4 97, 22-5 23, 22-6 4", () => {
    const sizes = Object.fromEntries(KEYWORD_TABLES.map((t) => [t.id, t.words.length]));
    expect(sizes).toEqual({ "22-1": 102, "22-2": 21, "22-3": 1, "22-4": 97, "22-5": 23, "22-6": 4 });
  });

  it("no word appears in two tables, every word is lowercase (5.6.2), and the union is Annex B's 248 keywords", () => {
    const all = KEYWORD_TABLES.flatMap((t) => [...t.words]);
    expect(new Set(all).size).toBe(all.length);
    for (const w of all) expect(w).toBe(w.toLowerCase());
    expect(ANNEX_B_KEYWORDS.size).toBe(248);
  });

  it("22.14.6 Table 22-4 holds the SystemVerilog 2005 words; 22.14.8 Table 22-6 is exactly implements, interconnect, nettype, soft", () => {
    for (const w of ["bit", "logic", "class", "final", "int", "interface", "endinterface", "rand"]) expect(tableIntroducing(w)?.id).toBe("22-4");
    expect([...tableById("22-6").words]).toEqual(["implements", "interconnect", "nettype", "soft"]);
    expect([...tableById("22-3").words]).toEqual(["uwire"]);
    for (const w of ["until", "weak", "checker", "let"]) expect(tableIntroducing(w)?.id).toBe("22-5");
  });

  it("22.14.2 to 22.14.8: the sets are cumulative", () => {
    const sizes = CHRONOLOGICAL_SPECIFIERS.map((s) => reservedWords(s).size);
    expect(sizes).toEqual([102, 123, 113, 124, 221, 244, 248, 248, 248]);
    expect([...reservedWords("1364-2001")].every((w) => reservedWords("1364-2005").has(w))).toBe(true);
    expect([...reservedWords("1800-2005")].every((w) => reservedWords("1800-2009").has(w))).toBe(true);
  });

  it("22.14.4: 1364-2001-noconfig removes exactly the ten configuration words of Table 22-2", () => {
    expect(NOCONFIG_EXCLUDED).toHaveLength(10);
    for (const w of NOCONFIG_EXCLUDED) {
      expect(tableIntroducing(w)?.id).toBe("22-2");
      expect(reservedWords("1364-2001").has(w)).toBe(true);
      expect(reservedWords("1364-2001-noconfig").has(w)).toBe(false);
    }
    expect(reservedWords("1364-2001-noconfig").has("generate")).toBe(true);
  });

  it("22.14.9: 1800-2017 and 1800-2023 add no new reserved keywords; their set is Annex B", () => {
    expect(SPECIFIER_INFO["1800-2017"].adds).toBeNull();
    expect(SPECIFIER_INFO["1800-2023"].adds).toBeNull();
    expect(reservedWords("1800-2023")).toEqual(reservedWords("1800-2012"));
    expect(reservedWords("1800-2023")).toEqual(ANNEX_B_KEYWORDS);
  });
});

describe("identifiers (5.6, 5.6.1, 5.6.2)", () => {
  it("5.6: a simple identifier cannot start with a digit or $", () => {
    expect(analyzeToken("8bit").form).toBe("invalid");
    expect(analyzeToken("$x").form).toBe("invalid");
    expect(analyzeToken("n$657").form).toBe("simple");
    expect(analyzeToken("_bus3").form).toBe("simple");
    expect(analyzeToken("").form).toBe("invalid");
  });

  it("5.6.1: an escaped identifier ends at white space and uses printable ASCII only", () => {
    expect(analyzeToken("\\logic ")).toMatchObject({ form: "escaped", name: "logic" });
    expect(analyzeToken("\\a b").form).toBe("invalid");
    expect(analyzeToken("\\").form).toBe("invalid");
    expect(analyzeToken("\\bus+index")).toMatchObject({ form: "escaped", name: "bus+index" });
    expect(analyzeToken("\\café").form).toBe("invalid");
  });

  it("5.3 and 5.6.1: white space ends the token; other control characters are outside printable ASCII 33 to 126", () => {
    for (const ws of [" ", "\t", "\n", "\f"]) {
      const t = analyzeToken(`\\a${ws}b`);
      expect(t.form).toBe("invalid");
      if (t.form === "invalid") expect(t.reason).toMatch(/ends at the first white space/);
    }
    for (const ctrl of ["\u0001", "\u007f", "\u000b"]) {
      const t = analyzeToken(`\\a${ctrl}b`);
      expect(t.form).toBe("invalid");
      if (t.form === "invalid") {
        expect(t.reason).toMatch(/printable ASCII characters, decimal 33 to 126 \(5\.6\.1\)/);
        expect(t.reason).not.toMatch(/white space/);
      }
    }
  });

  it("5.6.1: an escaped keyword is a user-defined identifier under every set", () => {
    for (const spec of VERSION_SPECIFIERS) expect(classifyToken("\\logic", directive(spec)).verdict).toBe("identifier");
    const r = classifyToken("\\logic", directive("1800-2023"));
    expect(r.enteredIn?.id).toBe("22-4");
    expect(r.reasons.join(" ")).toMatch(/5\.6\.1/);
    expect(classifyToken("\\logic", DEFAULT_UNKNOWN).verdict).toBe("identifier");
  });

  it("5.6.1: the backslash is not part of the identifier, so \\logic names logic; cross-region matching is flagged as simulator dependent", () => {
    const r = classifyToken("\\logic", directive("1800-2023"));
    expect(r.reasons[2]).toBe(
      'Neither the leading backslash nor the terminating white space is part of the identifier (5.6.1), so \\logic names the identifier logic. Whether a plain logic declared under a set that does not reserve it, such as "1364-2005", refers to the same name across `begin_keywords regions is not spelled out by 22.14 or 5.6.1, so treat it as simulator dependent.',
    );
    expect(r.reasons.join(" ")).not.toMatch(/cpu3/);
  });

  it("5.6.1 example vs the tables: net is in no table, and the note says the example comment conflicts (Annex B)", () => {
    expect(tableIntroducing("net")).toBeNull();
    for (const tok of ["\\net", "net"]) {
      const r = classifyToken(tok, directive("1800-2023"));
      expect(r.verdict).toBe("identifier");
      expect(r.reasons.join(" ")).toMatch(/example's comment calls "net" a keyword.*tables decide/);
    }
    expect(classifyToken("net", DEFAULT_UNKNOWN).reasons.join(" ")).toMatch(/tables decide/);
    expect(classifyToken("wire", directive("1800-2023")).reasons.join(" ")).not.toMatch(/example's comment/);
  });

  it("5.6.2: keywords are lowercase only, so Logic is an identifier", () => {
    const r = classifyToken("Logic", directive("1800-2023"));
    expect(r.verdict).toBe("identifier");
    expect(r.caseVariantOf).toBe("logic");
  });

  it("5.6: a name longer than 1024 characters carries the tool-limit note", () => {
    expect(classifyToken("a".repeat(1025), directive("1800-2023")).lengthNote).toMatch(/1024/);
    expect(classifyToken("a".repeat(1024), directive("1800-2023")).lengthNote).toBeNull();
  });
});

describe("classification under a directive (22.14, 22.14.1)", () => {
  it("22.14.1: logic is an ordinary name under 1364-2001, 1364-1995 and 1364-2005, and an error under 1800-2005", () => {
    for (const s of ["1364-1995", "1364-2001", "1364-2005"] as const) expect(classifyToken("logic", directive(s)).verdict).toBe("identifier");
    expect(classifyToken("logic", directive("1800-2005")).verdict).toBe("keyword");
  });

  it("22.14.1 reverse case: interface and endinterface are not keywords under 1364-2005", () => {
    for (const w of ["interface", "endinterface"]) {
      const r = classifyToken(w, directive("1364-2005"));
      expect(r.verdict).toBe("identifier");
      expect(r.reasons.join(" ")).toMatch(/reverse/);
    }
  });

  it("the F1C drill: every checker word under 1800-2023, with the newest set that accepts it (Tables 22-3 to 22-6)", () => {
    const expected: Record<string, { verdict: string; table: string | null; newest: string | null }> = {
      logic: { verdict: "keyword", table: "22-4", newest: "1364-2005" },
      bit: { verdict: "keyword", table: "22-4", newest: "1364-2005" },
      final: { verdict: "keyword", table: "22-4", newest: "1364-2005" },
      int: { verdict: "keyword", table: "22-4", newest: "1364-2005" },
      until: { verdict: "keyword", table: "22-5", newest: "1800-2005" },
      weak: { verdict: "keyword", table: "22-5", newest: "1800-2005" },
      soft: { verdict: "keyword", table: "22-6", newest: "1800-2009" },
      interface: { verdict: "keyword", table: "22-4", newest: "1364-2005" },
      config: { verdict: "keyword", table: "22-2", newest: "1364-2001-noconfig" },
      uwire: { verdict: "keyword", table: "22-3", newest: "1364-2001-noconfig" },
      rand_en: { verdict: "identifier", table: null, newest: "1800-2023" },
      "\\logic": { verdict: "identifier", table: "22-4", newest: "1800-2023" },
    };
    expect(Object.keys(expected)).toEqual([...CHECKER_IDENTIFIERS]);
    for (const [word, e] of Object.entries(expected)) {
      const r = classifyToken(word, directive("1800-2023"));
      expect({ word, verdict: r.verdict, table: r.enteredIn?.id ?? null, newest: r.newestAccepting }).toEqual({ word, ...e });
    }
  });

  it("rand_en contains rand but is a different identifier (5.6)", () => {
    const r = classifyToken("rand_en", directive("1800-2023"));
    expect(r.containsKeywords).toEqual(["rand"]);
    expect(acceptanceSentence(r)).toMatch(/Every one of the nine/);
  });

  it("22.14.4: config is an identifier under 1364-2001-noconfig but a keyword under 1364-2001 and 1364-2005", () => {
    const r = classifyToken("config", directive("1364-2001-noconfig"));
    expect(r.verdict).toBe("identifier");
    expect(r.excludedByNoconfig).toBe(true);
    expect(r.reasons[0]).toMatch(/22\.14\.4/);
    expect(classifyToken("config", directive("1364-2001")).verdict).toBe("keyword");
    expect(classifyToken("config", directive("1364-2005")).verdict).toBe("keyword");
  });

  it("module (Table 22-1) is accepted by no standard set", () => {
    const r = classifyToken("module", directive("1364-1995"));
    expect(r.acceptedBy).toEqual([]);
    expect(acceptanceSentence(r)).toMatch(/None of the nine/);
    expect(classifyToken("\\module", directive("1364-1995")).reasons.join(" ")).toMatch(/only an escaped declaration/);
  });

  it("every reason sentence names a clause", () => {
    for (const w of [...CHECKER_IDENTIFIERS, "Logic", "8bit"]) {
      for (const s of [...VERSION_SPECIFIERS]) {
        for (const reason of classifyToken(w, directive(s)).reasons) expect(reason).toMatch(/\d+\.\d+|Annex B|Table 22-/);
      }
    }
  });
});

describe("no directive: the implementation's default set (22.14)", () => {
  it("22.14: with no directive the verdict is implementation dependent, never a guess", () => {
    const r = classifyToken("logic", DEFAULT_UNKNOWN);
    expect(r.verdict).toBe("implementation-dependent");
    expect(r.reasons[0]).toMatch(/implementation dependent \(22\.14\)/);
    expect(r.reservedBy).toEqual(["1800-2005", "1800-2009", "1800-2012", "1800-2017", "1800-2023"]);
  });

  it("22.14: an assumed default is evaluated but flagged as an assumption", () => {
    const r = classifyToken("logic", { kind: "default", assumed: "1800-2023" });
    expect(r.verdict).toBe("keyword");
    expect(r.assumed).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/assumption/);
  });

  it("the checker presets use the settings and words the lesson names", () => {
    expect(CHECKER_PRESETS.reverse.setting).toEqual(directive("1364-2005"));
    expect(CHECKER_PRESETS["no-directive"].setting).toEqual(DEFAULT_UNKNOWN);
  });
});

describe("regions: the keyword-set stack (22.14, 22.3, 3.2)", () => {
  it("22.14: legacy_cnt pushes 1364-2001, pops at `end_keywords, and tb_top.sv starts in the tool default", () => {
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO);
    const push = steps.find((s) => s.event === "push");
    const pop = steps.find((s) => s.event === "pop");
    const boundary = steps.find((s) => s.event === "file-boundary");
    expect(push?.stack).toEqual(["1364-2001"]);
    expect(pop?.stack).toEqual([]);
    expect(boundary?.effective).toEqual({ kind: "default", assumed: "1800-2023" });
    expect(unmatchedAtEnd(steps)).toEqual([]);
  });

  it("legacy_cnt: logic is an identifier in the legacy file, a keyword in tb_top.sv, and \\logic is an escaped identifier (5.6.1)", () => {
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO);
    const legacyTokens = steps.filter((s) => s.file === "legacy_cnt.v").flatMap((s) => s.tokens);
    expect(legacyTokens.length).toBe(6);
    expect(legacyTokens.every((t) => t.result.verdict === "identifier")).toBe(true);
    const tbTokens = steps.filter((s) => s.file === "tb_top.sv").flatMap((s) => s.tokens);
    expect(tbTokens.map((t) => [t.text, t.result.verdict])).toEqual([
      ["logic", "keyword"],
      ["logic", "keyword"],
      ["logic", "keyword"],
      ["\\logic", "identifier"],
    ]);
  });

  it("legacy_cnt with an unknown default: tb_top.sv's plain logic is implementation dependent (22.14)", () => {
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO, null);
    const tb = steps.filter((s) => s.file === "tb_top.sv").flatMap((s) => s.tokens);
    expect(tb[0].result.verdict).toBe("implementation-dependent");
    expect(tb[3].result.verdict).toBe("identifier");
  });

  it("22.14: a pair reaches across a file boundary, nests, ignores `resetall, and pops back in order", () => {
    const steps = scenarioSteps(NESTED_STACK_SCENARIO);
    const boundary = steps.find((s) => s.event === "file-boundary");
    expect(boundary?.stack).toEqual(["1364-2001"]);
    expect(boundary?.note).toMatch(/even across file boundaries/);
    const reset = steps.find((s) => s.event === "resetall");
    expect(reset?.stack).toEqual(["1364-2001", "1364-1995"]);
    const pops = steps.filter((s) => s.event === "pop").map((s) => s.stack);
    expect(pops).toEqual([["1364-2001"], []]);
  });

  it("nested_stack: signed is a keyword under 1364-2001 (Table 22-2) and a name under 1364-1995", () => {
    const steps = scenarioSteps(NESTED_STACK_SCENARIO);
    const verdicts = steps.flatMap((s) => s.tokens.map((t) => [s.file, t.result.verdict]));
    expect(verdicts).toEqual([
      ["legacy_a.v", "keyword"],
      ["legacy_b.v", "identifier"],
    ]);
  });

  it("22.14: an unrecognized specifier is an error and leaves the stack unchanged", () => {
    const steps = scenarioSteps(NESTED_STACK_SCENARIO);
    const last = steps[steps.length - 1];
    expect(last.event).toBe("error");
    expect(last.note).toMatch(/1364-2000/);
    expect(last.stack).toEqual([]);
  });

  it("22.14: `end_keywords with no open pair is an error", () => {
    const steps = walkRegions([{ name: "a.v", lines: ["`end_keywords"] }], DEFAULT_UNKNOWN, []);
    expect(steps[0].event).toBe("error");
    expect(steps[0].note).toMatch(/no matching/);
  });

  it("22.14 and 22.3: the directives and `resetall inside a design element are errors (3.2)", () => {
    const steps = walkRegions(
      [{ name: "a.v", lines: ["module m;", '`begin_keywords "1364-2001"', "`resetall", "`end_keywords", "endmodule", '`begin_keywords "1364-2001"'] }],
      directive("1800-2023"),
      [],
    );
    expect(steps.map((s) => s.event)).toEqual(["line", "error", "error", "error", "line", "push"]);
    expect(steps[2].note).toMatch(/22\.3/);
  });

  it("22.14: an unclosed pair at the end is reported", () => {
    const steps = walkRegions([{ name: "a.v", lines: ['`begin_keywords "1800-2009"'] }], DEFAULT_UNKNOWN, []);
    expect(unmatchedAtEnd(steps)).toEqual(["1800-2009"]);
  });

  it("comments, strings and number bases are not tagged", () => {
    const steps = walkRegions([{ name: "a.v", lines: ['x = 8\'d1; // logic here', '$display("logic");'] }], directive("1800-2023"), ["logic", "d1"]);
    expect(steps.flatMap((s) => s.tokens)).toEqual([]);
  });
});

describe("region predictions (5.6, 5.6.1, 22.14)", () => {
  it("legacy_cnt gate: .logic(q) is a syntax error in tb_top.sv when the default is an IEEE 1800 set", () => {
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO);
    const gate = regionGate(LEGACY_CNT_SCENARIO, steps);
    expect(gate?.stepIndex).toBe(steps.find((s) => s.event === "file-boundary")!.index - 1);
    expect(steps[gate!.stepIndex].event).toBe("pop");
    expect(gate?.options.find((o) => o.correct)?.id).toBe("error");
    expect(namedPortConnection("logic", directive("1800-2023")).explanation).toMatch(/\.\\logic \(q\)/);
  });

  it("legacy_cnt gate with an unknown default: the answer is that it depends on the tool (22.14)", () => {
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO, null);
    expect(regionGate(LEGACY_CNT_SCENARIO, steps)?.options.find((o) => o.correct)?.id).toBe("depends");
    expect(namedPortConnection("logic", directive("1364-2001")).verdict).toBe("compiles");
  });

  it("nested_stack gate: `resetall leaves 1364-1995 in effect (22.14)", () => {
    const steps = scenarioSteps(NESTED_STACK_SCENARIO);
    const gate = regionGate(NESTED_STACK_SCENARIO, steps)!;
    const correct = gate.options.filter((o) => o.correct);
    expect(correct).toHaveLength(1);
    expect(correct[0].label).toMatch(/1364-1995/);
    expect(steps[gate.stepIndex + 1].event).toBe("resetall");
  });
});

describe("lineage (IEEE 1800-2023 1.3 NOTE, 1.4; IEEE 1800.2-2020 Clause 2)", () => {
  it("only designation years are on the axis; pre-IEEE names carry no year", () => {
    expect(LINEAGE_YEARS).toEqual([1995, 2001, 2005, 2009, 2012, 2017, 2020, 2023]);
    for (const stop of LINEAGE_STOPS.filter((s) => !s.ieee)) expect(designationYear(stop)).toBeNull();
    expect(LINEAGE_STOPS.map((s) => s.label)).toContain("IEEE 1800.2-2017");
  });

  it("1.3 NOTE: 1800-2005 relied on 1364-2005; from 1800-2009 on, IEEE 1800 alone", () => {
    const stop = (id: string) => LINEAGE_STOPS.find((s) => s.id === id)!;
    expect(stop("1800-2005").documents).toEqual(["IEEE 1800-2005", "IEEE 1364-2005"]);
    for (const id of ["1800-2009", "1800-2012", "1800-2017", "1800-2023"]) expect(stop(id).documents).toEqual([`IEEE ${id}`]);
  });

  it("1800.2 Clause 2: IEEE 1800.2-2020 names IEEE 1800, and uvm-core 2020.3.1 is attached to it", () => {
    const u = LINEAGE_STOPS.find((s) => s.id === "1800.2-2020")!;
    expect(u.reliesOn).toBe("IEEE 1800");
    expect(u.attachments.join(" ")).toMatch(/uvm-core 2020\.3\.1/);
    expect(tableAddedBy(u)).toBeNull();
    expect(tableSentence(u)).toMatch(/No keyword table/);
    expect(u.definesNote).toMatch(/1\.1 Scope/);
    expect(u.source).toMatch(/1\.1 Scope/);
  });

  it("IEEE 1800.2-2017 names its own UVM API document, like 1800.2-2020, and cites 1.1 Scope", () => {
    const u = LINEAGE_STOPS.find((s) => s.id === "1800.2-2017")!;
    expect(u.documents).toEqual(["IEEE 1800 (the language)", "IEEE 1800.2-2017 (the UVM API)"]);
    expect(u.reliesOn).toBeNull();
    expect(u.definesNote).toMatch(/normative references are not among the sources/);
    expect(u.source).toMatch(/1\.1 Scope/);
  });

  it("1.4 and the Introduction: SystemVerilog 3.1a is the extensions on top of IEEE 1364, with no date", () => {
    const sv = LINEAGE_STOPS.find((s) => s.id === "sv31a")!;
    expect(sv.documents).toEqual(["SystemVerilog 3.1a (the extensions, Accellera)", "IEEE 1364 (the base Verilog)"]);
    expect(sv.source).toMatch(/Introduction/);
    expect(sv.source).toMatch(/1\.4/);
    expect(sv.definesNote).toMatch(/precursor to IEEE 1800-2005 \(IEEE 1800-2023 1\.4\)/);
    expect(designationYear(sv)).toBeNull();
    expect(tableAddedBy(sv)).toBeNull();
  });

  it("pre-IEEE stops sit in order: sv31a before 1800-2005; OVM and the Accellera reference before 1800.2-2017", () => {
    const ids = LINEAGE_STOPS.map((s) => s.id);
    expect(ids.indexOf("1364-2005")).toBeLessThan(ids.indexOf("sv31a"));
    expect(ids.indexOf("sv31a") + 1).toBe(ids.indexOf("1800-2005"));
    expect(ids.indexOf("ovm") + 1).toBe(ids.indexOf("accellera-uvm"));
    expect(ids.indexOf("accellera-uvm") + 1).toBe(ids.indexOf("1800.2-2017"));
    for (const id of ["ovm", "accellera-uvm"]) {
      const s = LINEAGE_STOPS.find((x) => x.id === id)!;
      expect(s.lane).toBe("uvm");
      expect(s.documents).toEqual(["Not a language standard; see IEEE 1800 for the language"]);
      expect(s.definesNote).toMatch(/No source checked here states/);
    }
    expect(LINEAGE_STOPS.find((s) => s.id === "ovm")!.source).toMatch(/Introduction/);
  });

  it("Table 22-3 has one word, and the sentence uses the singular noun", () => {
    const s = tableSentence(LINEAGE_STOPS.find((x) => x.id === "1364-2005")!);
    expect(s).toMatch(/^Table 22-3 \(22\.14\.5\): 1 reserved word added\./);
    expect(tableSentence(LINEAGE_STOPS.find((x) => x.id === "1800-2009")!)).toMatch(/23 reserved words added/);
  });

  it("22.14.2 to 22.14.9: each standard stop lights the table its revision added", () => {
    const added = Object.fromEntries(LINEAGE_STOPS.filter((s) => s.specifier).map((s) => [s.id, tableAddedBy(s)?.id ?? null]));
    expect(added).toEqual({
      "1364-1995": "22-1",
      "1364-2001": "22-2",
      "1364-2005": "22-3",
      "1800-2005": "22-4",
      "1800-2009": "22-5",
      "1800-2012": "22-6",
      "1800-2017": null,
      "1800-2023": null,
    });
    expect(tableSentence(LINEAGE_STOPS.find((s) => s.id === "1800-2023")!)).toMatch(/22\.14\.9/);
  });

  it("1.3 NOTE: in 2006, always @(posedge clk) is defined by IEEE 1364-2005 (always and posedge are Table 22-1)", () => {
    expect(baseLanguageDocument(2006)).toBe("IEEE 1364-2005");
    expect(baseLanguageDocument(2010)).toBe("IEEE 1800-2009");
    expect(baseLanguageDocument(2002)).toBe("IEEE 1364-2001");
    expect(baseLanguageDocument(1990)).toBeNull();
    expect(constructTables("always @(posedge clk)").map((p) => p.table?.id ?? null)).toEqual(["22-1", "22-1", null]);
    const [q1] = lineagePredictions();
    expect(q1.options.find((o) => o.correct)?.label).toBe("IEEE 1364-2005");
  });

  it("Tables 22-2 to 22-6: 1800-2005 (Table 22-4) added the most words, computed from the table sizes", () => {
    expect(largestAddition().id).toBe("22-4");
    const [, q2] = lineagePredictions();
    const correct = q2.options.find((o) => o.correct)!;
    expect(correct.label).toBe("IEEE 1800-2005");
    expect(correct.feedback).toMatch(/97/);
    expect(correct.feedback).toMatch(/102/);
  });
});

describe("wrong-prediction feedback (22.14, 22.14.4, 5.6.1, 5.6.2)", () => {
  it("names the rule behind each misconception, with its clause", () => {
    expect(wrongChoiceFeedback(classifyToken("logic", directive("1800-2023")))).toMatch(/reserved since "1800-2005".*22\.14\.2 to 22\.14\.9/);
    expect(wrongChoiceFeedback(classifyToken("\\logic", directive("1800-2023")))).toMatch(/5\.6\.1/);
    expect(wrongChoiceFeedback(classifyToken("config", directive("1364-2001-noconfig")))).toMatch(/22\.14\.4/);
    expect(wrongChoiceFeedback(classifyToken("Logic", directive("1800-2023")))).toMatch(/5\.6\.2/);
    expect(wrongChoiceFeedback(classifyToken("soft", directive("1800-2009")))).toMatch(/Table 22-6.*22\.14/);
    expect(wrongChoiceFeedback(classifyToken("rand_en", directive("1800-2023")))).toMatch(/containing rand/);
  });

  it("5.6.1: an escaped non-keyword is called an escaped identifier, not an escaped keyword", () => {
    for (const tok of ["\\cpu3", "\\bus+index"]) {
      const fb = wrongChoiceFeedback(classifyToken(tok, directive("1800-2023")));
      expect(fb).not.toMatch(/escaped keyword/);
      expect(fb).toMatch(/is an escaped identifier, the same as .* without the backslash \(5\.6\.1\).*no keyword table/);
    }
    expect(wrongChoiceFeedback(classifyToken("\\logic", directive("1800-2023")))).toMatch(/escaped keyword is a user-defined identifier/);
  });
});

describe("newest accepting revision (22.14.3, 22.14.4)", () => {
  it("uwire: 1364-2001-noconfig is a variant of 1364-2001, so the newest revision is 1364-2001", () => {
    const s = acceptanceSentence(classifyToken("uwire", directive("1800-2023")));
    expect(s).toMatch(/The newest revision is 1364-2001: both "1364-2001" and its "1364-2001-noconfig" variant/);
    expect(s).not.toMatch(/The newest is "1364-2001-noconfig"\./);
  });

  it("config: only the noconfig variant accepts it, and the sentence says it is a variant (22.14.4)", () => {
    expect(acceptanceSentence(classifyToken("config", directive("1800-2023")))).toMatch(/variant of the 1364-2001 revision.*22\.14\.4/);
    expect(acceptanceSentence(classifyToken("logic", directive("1800-2023")))).toMatch(/The newest is "1364-2005"\./);
  });
});
