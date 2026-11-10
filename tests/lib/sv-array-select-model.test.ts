import { describe, expect, it } from "vitest";

import {
  ARRAY_SELECT_PRESETS,
  INT_INDEX_MAX,
  PART_CASES,
  QUERY_FUNCTIONS,
  QUERY_TARGETS,
  SELECT_CASES,
  TWO_STATE_UNSTATED_TEXT,
  VECTOR_UP,
  VECTOR_V,
  evaluateCase,
  evaluatePartCase,
  evaluateSelect,
  findQueryTarget,
  findSelectCase,
  formatBits,
  indexedPartSelect,
  lessonDecl,
  memByte,
  memWord,
  orderedOptions,
  outcomeLabel,
  parseQueryAnswer,
  partOptions,
  queryArray,
  queryValueText,
  resolvePreset,
  selectOptions,
  selectQuestion,
  selectQuestionText,
  wordBits,
  type SelectCase,
} from "@/lib/sv-array-select-model";

const sel = (id: string) => findSelectCase(id) as SelectCase;
const run = (id: string, state: "logic" | "bit" = "logic") => evaluateCase(sel(id), state);
const target = (id: string) => findQueryTarget(id)!;

describe("formatting", () => {
  it("prints sized literals the way the lesson writes them", () => {
    expect(formatBits(wordBits(0xaabbccdd, 32))).toBe("32'hAABB_CCDD");
    expect(formatBits(["1"])).toBe("1'b1");
    expect(formatBits(["x", "x", "x", "x", "1", "0", "1", "0"])).toBe("8'hxA");
    expect(formatBits(["x", "1", "0", "1", "0", "1", "0", "1"])).toBe("8'bx101_0101");
  });
  it("encodes the lesson's arrays: mem[i][j] = 8'((i << 4) | j), so mem[5] = 32'h5352_5150", () => {
    expect(memByte(5, 2)).toBe(0x52);
    expect(formatBits(wordBits(memWord(5), 32))).toBe("32'h5352_5150");
  });
});

describe("§7.4.4 / §7.4.5: element selects and slices", () => {
  it("§7.4.4: a name with no index references the entire array; a packed array used as a primary is one vector (§7.4.1)", () => {
    const r = run("w");
    expect(r.kind).toBe("packed");
    expect(r.valueText).toBe("32'hAABB_CCDD");
    expect(r.typeText).toBe("logic [3:0][7:0]");
  });
  it("§7.4.5: w[2] selects element 2 of the leftmost packed dimension: bits 23:16, 8'hBB", () => {
    const r = run("w2");
    expect(r.valueText).toBe("8'hBB");
    expect(r.kind).toBe("packed");
    expect(r.typeText).toBe("logic [7:0]");
    expect(Math.max(...r.wordBits)).toBe(23);
    expect(Math.min(...r.wordBits)).toBe(16);
  });
  it("§7.4.5: a slice of a packed array is packed: w[3:2] = 16'hAABB", () => {
    const r = run("w3_2");
    expect(r.kind).toBe("packed");
    expect(r.valueText).toBe("16'hAABB");
    expect(r.typeText).toBe("logic [3:2][7:0]");
  });
  it("§7.4.4: the rightmost index varies fastest: w[2][3] is bit 2*8 + 3 = 19", () => {
    const r = run("w2_3");
    expect(r.kind).toBe("bit");
    expect(r.wordBits).toEqual([19]);
    expect(r.valueText).toBe("1'b1");
    expect(r.bitArithmetic).toBe("2×8 + 3 = 19");
  });
  it("§7.4.2 + §7.4.5: b[1] is the second element of [4] = [0:3]", () => {
    expect(run("b1").valueText).toBe("8'h22");
    expect(run("b1").rows).toEqual([[1]]);
  });
  it("§7.4.5: a slice of an unpacked array is unpacked: b[1:2] = '{8'h22, 8'h33}", () => {
    const r = run("b1_2");
    expect(r.kind).toBe("unpacked");
    expect(r.valueText).toBe("'{8'h22, 8'h33}");
    expect(r.typeText).toBe("unpacked array [1:2] of logic [7:0]");
  });
  it("§7.4.4: unpacked indices come first, then packed: mem[5], mem[5][2], mem[5][2][3]", () => {
    expect(run("mem5").valueText).toBe("32'h5352_5150");
    expect(run("mem5").typeText).toBe("logic [3:0][7:0]");
    expect(run("mem5_2").valueText).toBe("8'h52");
    const bit = run("mem5_2_3");
    expect(bit.valueText).toBe("1'b0");
    expect(bit.wordBits).toEqual([19]);
    expect(bit.rows).toEqual([[5]]);
    expect(bit.steps.join(" ")).toMatch(/Unpacked indices come first, then packed/);
  });
  it("§7.4.4: omitting the fastest-varying index references a subarray: grid[1] is row 1", () => {
    const r = run("grid1");
    expect(r.kind).toBe("unpacked");
    expect(r.valueText).toBe("'{10, 11, 12, 13, 14, 15, 16, 17}");
    expect(r.typeText).toBe("unpacked array [0:7] of int");
    expect(run("grid1_7").valueText).toBe("17");
    expect(run("grid1_7").typeText).toBe("int");
  });
  it("§7.4.5: a slice applies to one dimension, so the model rejects a slice before another select", () => {
    const r = evaluateSelect(lessonDecl("w"), [
      { kind: "range", left: 3, right: 2 },
      { kind: "index", value: 1 },
    ]);
    expect(r.error).toMatch(/one dimension/);
  });
  it("§11.5.1: a range must name the more significant end first", () => {
    const r = evaluateSelect(lessonDecl("w"), [{ kind: "range", left: 2, right: 3 }]);
    expect(r.error).toMatch(/more significant end/);
  });
});

describe("invalid reads: Table 7-1 for unpacked, §11.5.1 for packed", () => {
  it("§7.4.5 + Table 7-1: an out-of-bounds unpacked index reads 'x for 4-state and '0 for 2-state", () => {
    expect(run("b5").kind).toBe("invalid");
    expect(run("b5").valueText).toBe("8'hxx");
    expect(run("b5", "bit").valueText).toBe("8'h00");
    expect(run("b5").clauses).toEqual(expect.arrayContaining(["§7.4.5", "Table 7-1"]));
  });
  it("§7.4.5: an index with x bits is invalid: b[i] with i = 'x reads the Table 7-1 value", () => {
    expect(run("bi").valueText).toBe("8'hxx");
    expect(run("bi").invalid?.reason).toBe("x-index");
    expect(run("bi", "bit").valueText).toBe("8'h00");
  });
  it("Table 7-1: an invalid unpacked index keeps the shape of the select: grid[7][1] is one int that reads 0", () => {
    const r = evaluateSelect(lessonDecl("grid"), [
      { kind: "index", value: 7 },
      { kind: "index", value: 1 },
    ]);
    expect(r.kind).toBe("invalid");
    expect(r.valueText).toBe("0");
    expect(r.typeText).toBe("int");
  });
  it("§11.5.1: a part-select completely out of range reads x: w[23:16], with the compile-time note", () => {
    const r = run("w23_16");
    expect(r.kind).toBe("invalid");
    expect(r.valueText).toBe("64'hxxxx_xxxx_xxxx_xxxx");
    expect(r.missingElements).toEqual([23, 22, 21, 20, 19, 18, 17, 16]);
    expect(r.notes.join(" ")).toMatch(/many tools warn or reject this at compile time \(tool-dependent\)/);
  });
  it("§11.5.1: no separate 2-state value is stated for an out-of-range part-select, so the model does not invent one", () => {
    const r = run("w23_16", "bit");
    expect(r.twoStateUnstated).toBe(true);
    expect(r.valueText).toBe(TWO_STATE_UNSTATED_TEXT);
    expect(TWO_STATE_UNSTATED_TEXT).toBe("the standard gives no 2-state value (§11.5.1 gives x)");
    // The question asks what the standard states, so the meta answer is reachable by reasoning.
    expect(selectQuestion(sel("w23_16"), "bit").asks).toBe("standard");
    expect(selectQuestionText(selectQuestion(sel("w23_16"), "bit"))).toMatch(/What does IEEE 1800-2023 state that w\[23:16\] reads/);
    expect(selectQuestion(sel("w23_16"), "logic").asks).toBe("value");
    // The 0 distractor says a tool may return 0 without the standard stating it.
    expect(selectOptions(sel("w23_16"), "bit").find((o) => o.id === "zero")?.feedback).toMatch(/A tool may return 0 here, but that is the tool's choice/);
  });
  it("§11.5.1: an invalid bit-select of a packed array reads x for 4-state and 0 for 2-state", () => {
    const four = evaluateSelect(lessonDecl("w"), [
      { kind: "index", value: 2 },
      { kind: "index", value: 9 },
    ]);
    expect(four.valueText).toBe("1'bx");
    const two = evaluateSelect(lessonDecl("w", "bit"), [
      { kind: "index", value: 2 },
      { kind: "index", value: "x", name: "k" },
    ]);
    expect(two.valueText).toBe("1'b0");
  });
  it("§11.5.1: a partially out-of-range packed slice reads x only for the missing elements", () => {
    const r = evaluateSelect(lessonDecl("w"), [{ kind: "range", left: 4, right: 3 }]);
    expect(r.kind).toBe("packed");
    expect(r.valueText).toBe("16'hxxAA");
    expect(r.missingElements).toEqual([4]);
  });
});

describe("prediction options are computed by the model", () => {
  it("every case has a correct option equal to the model's outcome, plus at least two distinct distractors", () => {
    for (const c of SELECT_CASES) {
      for (const state of ["logic", "bit"] as const) {
        const opts = selectOptions(c, state);
        const correct = opts.filter((o) => o.correct);
        expect(correct).toHaveLength(1);
        expect(correct[0].label).toBe(outcomeLabel(evaluateCase(c, state)));
        expect(opts.length).toBeGreaterThanOrEqual(3);
        expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length);
        opts.forEach((o) => expect(o.feedback).toMatch(/§/));
      }
    }
  });
  it("no two options share what the question asks: value and kind, plus the bit number when the question asks for the bit", () => {
    for (const c of SELECT_CASES) {
      for (const state of ["logic", "bit"] as const) {
        const q = selectQuestion(c, state);
        const opts = selectOptions(c, state);
        const keys = opts.map((o) => `${o.valueText}|${o.kind}${q.asks === "bit" && o.kind === "bit" ? `|${o.bit}` : ""}`);
        expect(new Set(keys).size).toBe(opts.length);
        opts.forEach((o) => expect(o.valueText).toBeTruthy());
        if (q.asks === "bit") {
          expect(evaluateCase(c, state).kind).toBe("bit");
          // A single-bit option names its bit first, so equal values are told apart by the bit.
          opts.filter((o) => o.kind === "bit").forEach((o) => expect(o.label).toMatch(new RegExp(`^bit ${o.bit} of `)));
        }
      }
    }
  });
  it("§7.4.4: single-bit selects ask which bit; the from-left and swapped feedback name the bit", () => {
    for (const state of ["logic", "bit"] as const) {
      expect(selectQuestionText(selectQuestion(sel("w2_3"), state))).toBe("Which bit does w[2][3] read, and what is its value?");
      const w = selectOptions(sel("w2_3"), state);
      expect(w.find((o) => o.correct)?.label).toBe("bit 19 of w = 1'b1 · single bit");
      const fromLeft = w.find((o) => o.id === "from-left")!;
      expect(fromLeft.label).toBe("bit 11 of w = 1'b1 · single bit");
      expect(fromLeft.feedback).toMatch(/^Bit 11 of w, not bit 19, holding 1'b1, is what you get by counting/);
      expect(w.find((o) => o.id === "swapped")?.feedback).toMatch(/^w\[3\]\[2\] reads bit 26 of w, not bit 19/);
      const m = selectOptions(sel("mem5_2_3"), state);
      expect(m.find((o) => o.correct)?.label).toBe("bit 19 of mem[5] = 1'b0 · single bit");
      expect(m.find((o) => o.id === "from-left")?.feedback).toMatch(/^Bit 11 of mem\[5\], not bit 19/);
      expect(m.find((o) => o.id === "swapped")?.feedback).toMatch(/^mem\[5\]\[3\]\[2\] reads bit 26 of mem\[5\], not bit 19/);
    }
    // The question does not name the word, so it does not give away that [5] picks mem[5].
    expect(selectQuestionText(selectQuestion(sel("mem5_2_3"), "logic"))).toBe("Which bit does mem[5][2][3] read, and what is its value?");
    expect(selectQuestion(sel("w2"), "logic").asks).toBe("value");
  });
  it("w[23:16]: the bit-number misreading gives 8'hBB, which is what a one-dimensional vector would read", () => {
    const opt = selectOptions(sel("w23_16"), "logic").find((o) => o.id === "bit-number");
    expect(opt?.label).toBe("8'hBB · packed vector");
  });
  it("w[2]: counting lanes from the left gives 8'hCC", () => {
    expect(selectOptions(sel("w2"), "logic").find((o) => o.id === "from-left")?.label).toBe("8'hCC · packed vector");
  });
  it("orderedOptions is a stable rotation", () => {
    const opts = selectOptions(sel("w2"), "logic");
    expect(orderedOptions(opts, "w2-logic")).toEqual(orderedOptions(opts, "w2-logic"));
    expect([...orderedOptions(opts, "w2-logic")].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...opts].sort((a, b) => a.id.localeCompare(b.id)));
  });
});

describe("§11.5.1: indexed part-selects", () => {
  it("§11.5.1: a_vect[0 +: 8] == a_vect[7:0] and a_vect[15 -: 8] == a_vect[15:8] on a descending range", () => {
    expect(indexedPartSelect(VECTOR_V, 0, 8, "+:").equivalent).toBe("v[7:0]");
    expect(indexedPartSelect(VECTOR_V, 15, 8, "-:").equivalent).toBe("v[15:8]");
    expect(indexedPartSelect(VECTOR_V, 15, 8, "-:").valueText).toBe("8'hCC");
  });
  it("§11.5.1: b_vect[0 +: 8] == b_vect[0:7] and b_vect[15 -: 8] == b_vect[8:15] on an ascending range", () => {
    const up = indexedPartSelect(VECTOR_UP, 0, 8, "+:");
    expect(up.equivalent).toBe("up_vect[0:7]");
    expect(up.valueText).toBe("8'hC3");
    expect(up.place).toBe("the most significant byte");
    expect(up.explanation).toMatch(/msb_base_expr/);
    expect(indexedPartSelect(VECTOR_UP, 15, 8, "-:").equivalent).toBe("up_vect[8:15]");
    expect(indexedPartSelect(VECTOR_UP, 15, 8, "-:").place).toBe("the least significant byte");
  });
  it("§11.5.1: dword[8*sel +: 8] is a variable part-select with fixed width: the slider walks the bytes", () => {
    const c = PART_CASES.find((p) => p.id === "v-var")!;
    expect([0, 1, 2, 3].map((i) => evaluatePartCase(c, i).valueText)).toEqual(["8'hDD", "8'hCC", "8'hBB", "8'hAA"]);
    expect(evaluatePartCase(c, 4).status).toBe("out");
    expect(evaluatePartCase(c, 4).valueText).toBe("8'hxx");
  });
  it("§11.5.1: a partially out-of-range part-select reads x for the out-of-range bits only", () => {
    const r = indexedPartSelect(VECTOR_V, 28, 8, "+:");
    expect(r.status).toBe("partial");
    expect(r.valueText).toBe("8'hxA");
    expect(r.outOfRange).toEqual([35, 34, 33, 32]);
    const up = indexedPartSelect(VECTOR_UP, 12, 8, "+:");
    expect(up.valueText).toBe("8'h5x");
    const neg = indexedPartSelect(VECTOR_V, -4, 8, "+:");
    expect(neg.equivalent).toBe("v[3:-4]");
    expect(neg.valueText).toBe("8'hDx");
  });
  it("§11.5.1: a part-select whose base is x yields x; the width must be a positive constant", () => {
    expect(indexedPartSelect(VECTOR_V, "x", 8, "+:").valueText).toBe("8'hxx");
    expect(indexedPartSelect(VECTOR_V, 0, 0, "+:").status).toBe("error");
  });
  it("part-select options: one correct answer equal to the model, distinct labels", () => {
    for (const c of PART_CASES) {
      const max = typeof c.base === "object" ? c.base.slider.max : 0;
      for (let s = 0; s <= max; s += 1) {
        const opts = partOptions(c, s);
        expect(opts.filter((o) => o.correct)).toHaveLength(1);
        expect(opts.length).toBeGreaterThanOrEqual(2);
        expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length);
        expect(opts.find((o) => o.correct)!.label).toContain(evaluatePartCase(c, s).valueText);
      }
    }
  });
});

describe("§20.7 / §20.7.1 / §7.11: array query functions", () => {
  const vals = (id: string, d: number) => QUERY_FUNCTIONS.map((fn) => queryValueText(queryArray(target(id), d).values[fn]));
  it("§20.7: fixed-size int f[7:0]: $increment is 1 because $left >= $right; int adds a packed [31:0] dimension", () => {
    expect(vals("f", 1)).toEqual(["7", "0", "0", "7", "1", "8", "2", "1"]);
    expect(vals("f", 2)).toEqual(["31", "0", "0", "31", "1", "32", "2", "1"]);
  });
  it("§20.7: a queue: $left is 0, $right is size-1 (−1 when empty), $increment is −1", () => {
    expect(vals("q", 1)).toEqual(["0", "2", "0", "2", "−1", "3", "2", "1"]);
    expect(vals("q0", 1)).toEqual(["0", "−1", "0", "−1", "−1", "0", "2", "1"]);
  });
  it("§20.7: an int-keyed associative array: $right is the highest possible index, not the largest key", () => {
    expect(INT_INDEX_MAX).toBe(2147483647);
    expect(vals("aa", 1)).toEqual(["0", "2147483647", "5", "9", "−1", "2", "2", "1"]);
    expect(queryArray(target("aa"), 1).why.$right).toMatch(/not the largest key/);
  });
  it("§20.7: an empty associative array: $low and $high return 'x", () => {
    expect(vals("aa0", 1)).toEqual(["0", "2147483647", "'x", "'x", "−1", "0", "2", "1"]);
  });
  it("§20.7: dimensions are numbered from the slowest-varying (1), unpacked before packed: exp_by_id has 3, 2 of them unpacked", () => {
    expect(vals("exp", 1)).toEqual(["0", "2147483647", "5", "9", "−1", "2", "3", "2"]);
    expect(vals("exp", 3)).toEqual(["31", "0", "0", "31", "1", "32", "3", "2"]);
  });
  it("§20.7.1: $size(exp_by_id, 2) is an error because dimension 2 is variable-sized; $size(exp_by_id[5], 1) = 2 is legal", () => {
    const r = queryArray(target("exp"), 2);
    expect(r.status).toBe("illegal");
    expect(r.values.$size).toBe("error");
    expect(r.alternative).toEqual({ call: "$size(exp_by_id[5], 1)", value: 2 });
    expect(r.summary).toMatch(/§20\.7\.1/);
    expect(queryArray(target("exp5"), 1).values.$size).toBe(2);
  });
  it("§20.7: a dimension number out of range returns 'x; $dimensions takes no dimension argument", () => {
    const r = queryArray(target("f"), 3);
    expect(r.status).toBe("out-of-range");
    expect(r.values.$size).toBe("x");
    expect(r.values.$dimensions).toBe(2);
  });
  it("every target has a dimension 1 and a reason for every value", () => {
    for (const t of QUERY_TARGETS) {
      const r = queryArray(t, 1);
      QUERY_FUNCTIONS.forEach((fn) => expect(r.why[fn]).toMatch(/§20\.7/));
    }
  });
  it("parses typed predictions: integers with either minus sign, 'x, error", () => {
    expect(parseQueryAnswer(" 7 ")).toBe(7);
    expect(parseQueryAnswer("−1")).toBe(-1);
    expect(parseQueryAnswer("-1")).toBe(-1);
    expect(parseQueryAnswer("'x")).toBe("x");
    expect(parseQueryAnswer("X")).toBe("x");
    expect(parseQueryAnswer("Error")).toBe("error");
    expect(parseQueryAnswer("\u20131")).toBe(-1); // en dash
    expect(parseQueryAnswer("2**31-1")).toBe(INT_INDEX_MAX);
    expect(parseQueryAnswer("2^31 - 1")).toBe(INT_INDEX_MAX);
    expect(parseQueryAnswer("2**31\u22121")).toBe(INT_INDEX_MAX);
    expect(parseQueryAnswer("2**5")).toBe(32);
    expect(parseQueryAnswer("-2**31")).toBe(-(2 ** 31));
    expect(parseQueryAnswer("2**60")).toBeNull();
    expect(parseQueryAnswer("seven")).toBeNull();
    expect(parseQueryAnswer("")).toBeNull();
  });
});

describe("presets", () => {
  it("one preset per lesson use, each resolving to its own mode", () => {
    expect(ARRAY_SELECT_PRESETS.map((p) => p.id)).toEqual(["packed-unpacked", "mixed-dimensions", "indexed-part-select", "query-functions"]);
    expect(resolvePreset("select", "mixed-dimensions")).toMatchObject({ preset: { caseId: "mem5" }, unknown: false });
    expect(resolvePreset("query", "mixed-dimensions")).toMatchObject({ preset: { id: "query-functions" }, unknown: true });
    expect(resolvePreset("part-select")).toMatchObject({ preset: { id: "indexed-part-select" }, unknown: false });
    ARRAY_SELECT_PRESETS.forEach((p) => {
      if (p.caseId) expect(findSelectCase(p.caseId)).toBeDefined();
      if (p.partCaseId) expect(PART_CASES.some((c) => c.id === p.partCaseId)).toBe(true);
      if (p.targetId) expect(findQueryTarget(p.targetId)).toBeDefined();
    });
  });
});
