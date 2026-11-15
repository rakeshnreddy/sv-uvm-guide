import { describe, expect, it } from "vitest";

import {
  FORMAT_PRESETS,
  HEX_LETTER_CASE_SENTENCE,
  RULE_CHAR,
  SPECIFIERS,
  XZ_CASE_SENTENCE,
  autoColumns,
  bitsFromNumber,
  digitRule,
  findFormatPreset,
  formatNumber,
  formatValue,
  formatWith,
  gradeGuess,
  largestValue,
  literalText,
  nextBit,
  normalizeGuess,
  parseBits,
  resizeBits,
} from "@/lib/sv-format-model";

describe("sv-format-model · §21.2.1.2 size of displayed data", () => {
  it("§21.2.1.2: a 12-bit expression gets 4 decimal columns (4095) and 3 hex columns (FFF)", () => {
    expect(largestValue(12, "d")).toBe("4095");
    expect(largestValue(12, "h")).toBe("FFF");
    expect(autoColumns(12, "d")).toBe(4);
    expect(autoColumns(12, "h")).toBe(3);
  });

  it("§21.2.1.2: the printval example prints %d as 4 columns (two spaces, then 10) and %h as 00a, and with %0, 10 and a", () => {
    const r1 = bitsFromNumber(10, 12);
    expect(formatWith(r1, "%d").text).toBe("  10");
    expect(formatWith(r1, "%h").text).toBe("00a");
    expect(formatWith(r1, "%0d").text).toBe("10");
    expect(formatWith(r1, "%0h").text).toBe("a");
  });

  it("§21.2.1.2 examples table: %d of 32'd10 fills the 10 columns of 4294967295, %h keeps 8 digits", () => {
    const v = bitsFromNumber(10, 32);
    expect(formatWith(v, "%d").text).toBe(" ".repeat(8) + "10");
    expect(formatWith(v, "%h").text).toBe("0000000a");
    expect(formatWith(v, "%0h").text).toBe("a");
  });

  it("§21.2.1.2: decimal pads with spaces, octal and binary keep leading zeros", () => {
    const v = bitsFromNumber(5, 9);
    const d = formatWith(v, "%d");
    expect(d.text).toBe("  5");
    expect(d.padSpaces).toBe(2);
    const o = formatWith(v, "%o");
    expect(o.text).toBe("005");
    expect(o.leadingZerosKept).toBe(2);
    expect(formatWith(v, "%b").text).toBe("000000101");
  });

  it("§21.2.1.2: zero prints one digit, never an empty field", () => {
    const zero = bitsFromNumber(0, 12);
    expect(formatWith(zero, "%0h").text).toBe("0");
    expect(formatWith(zero, "%0d").text).toBe("0");
    expect(formatWith(zero, "%d").text).toBe("   0");
  });

  it("§21.2.1.2: the largest value fills the field exactly", () => {
    const max = parseBits("111111111111");
    expect(formatWith(max, "%d").text).toBe("4095");
    expect(formatWith(max, "%h").text).toBe("fff");
    expect(formatWith(max, "%o").text).toBe("7777");
  });

  it("§21.2.1.2: the width sentence names the largest value and the columns", () => {
    expect(formatWith(bitsFromNumber(10, 12), "%d").widthSentence).toContain("4095, which needs 4 columns");
    expect(formatWith(bitsFromNumber(10, 12), "%h").widthSentence).toContain("FFF in hexadecimal, which needs 3 columns");
    expect(formatWith(bitsFromNumber(10, 12), "%0h").widthSentence).toContain("2 removed");
    const d0 = formatWith(bitsFromNumber(10, 12), "%0d").widthSentence;
    expect(d0).toContain("minimum width, with no leading spaces");
    expect(d0).toContain("2 columns");
    expect(formatWith(bitsFromNumber(5, 9), "%o").widthSentence).toContain("as large as 777 in octal, which needs 3 columns, and the 2 leading zeros stay");
    expect(formatWith(bitsFromNumber(5, 4), "%b").widthSentence).toContain("as large as 1111 in binary, which needs 4 columns, and the 1 leading zero stays");
  });

  it("§21.2.1.2: for an all-zero value the kept zeros are counted before the value's own 0", () => {
    const zero = formatWith(bitsFromNumber(0, 12), "%h");
    expect(zero.text).toBe("000");
    expect(zero.widthSentence).toContain("the 2 leading zeros stay before the value's own 0");
    expect(formatWith(bitsFromNumber(10, 12), "%h").widthSentence).not.toContain("own 0");
  });

  it("rejects widths outside the model and signed values", () => {
    expect(() => formatValue([], SPECIFIERS["%d"])).toThrow();
    expect(() => bitsFromNumber(-1, 4)).toThrow();
    expect(() => bitsFromNumber(16, 4)).toThrow();
  });

  it("handles 64-bit values exactly", () => {
    expect(formatNumber(BigInt("18446744073709551615"), 64, "%d")).toBe("18446744073709551615");
    expect(formatNumber(40, 64, "%0d")).toBe("40");
  });
});

describe("sv-format-model · §21.2.1.3 unknown and high-impedance values", () => {
  it("§21.2.1.3 row: all bits x prints a lowercase x", () => {
    expect(digitRule(parseBits("xxxx"))).toBe("all-x");
    expect(RULE_CHAR["all-x"]).toBe("x");
  });
  it("§21.2.1.3 row: all bits z prints a lowercase z", () => {
    expect(digitRule(parseBits("zzz"))).toBe("all-z");
    expect(RULE_CHAR["all-z"]).toBe("z");
  });
  it("§21.2.1.3 row: some but not all bits x prints an uppercase X", () => {
    expect(digitRule(parseBits("10x1"))).toBe("some-x");
    expect(RULE_CHAR["some-x"]).toBe("X");
  });
  it("§21.2.1.3 row: some bits z and none x prints an uppercase Z", () => {
    expect(digitRule(parseBits("0z10"))).toBe("some-z");
    expect(RULE_CHAR["some-z"]).toBe("Z");
  });
  it("§21.2.1.3 row: some bits z and some x prints an uppercase X", () => {
    expect(digitRule(parseBits("1xz0"))).toBe("some-z-and-x");
    expect(digitRule(parseBits("xz"))).toBe("some-z-and-x");
    expect(RULE_CHAR["some-z-and-x"]).toBe("X");
  });
  it("§21.2.1.3: a group of 0s and 1s prints its numeral", () => {
    expect(digitRule(parseBits("1010"))).toBe("known");
  });

  it("§21.2.1.3 examples: %d of 1'bx is x, %h of 14'bx01010 is xxXa, 12'b001xxx101x01 is XXX in %h and 1x5X in %o", () => {
    expect(formatWith(parseBits("x"), "%d").text).toBe("x");
    // 14'bx01010: the leftmost x extends to fill the 14 bits (§5.7.1).
    expect(formatWith(parseBits("xxxxxxxxx01010"), "%h").text).toBe("xxXa");
    expect(formatWith(parseBits("001xxx101x01"), "%h").text).toBe("XXX");
    expect(formatWith(parseBits("001xxx101x01"), "%o").text).toBe("1x5X");
  });

  it("§21.2.1.3: hex groups are 4 bits and octal groups 3, counted from bit 0, so a 9-bit top hex digit is one bit", () => {
    const h = formatWith(parseBits("z_0000_1010"), "%h");
    expect(h.groups.map((g) => [g.hi, g.lo])).toEqual([
      [8, 8],
      [7, 4],
      [3, 0],
    ]);
    expect(h.text).toBe("z0a");
    expect(h.ruleSentences.some((s) => s.includes("top digit covers only bits [8:8]"))).toBe(true);
    // The clause's prose does not say "from bit 0"; its example xxXa does.
    expect(h.ruleSentences.some((s) => s.includes("as the §21.2.1.3 example xxXa (14 bits in hex) shows"))).toBe(true);
    expect(formatWith(parseBits("z_0000_1010"), "%o").groups).toHaveLength(3);
  });

  it("§21.2.1.3: %b prints each bit as 0, 1, x or z", () => {
    expect(formatWith(parseBits("10x1"), "%b").text).toBe("10x1");
    expect(formatWith(parseBits("z01x"), "%b").text).toBe("z01x");
  });

  it("§21.2.1.3: decimal with x or z is one character, right-justified in the fixed-width field", () => {
    const d = formatWith(parseBits("10x1"), "%d");
    expect(d.text).toBe(" X");
    expect(d.decimalRule).toBe("some-x");
    expect(formatWith(parseBits("10x1"), "%0d").text).toBe("X");
    expect(formatWith(parseBits("zzzzzzzzz"), "%d").text).toBe("  z");
    expect(formatWith(parseBits("0000z0000001"), "%d").text).toBe("   Z");
    expect(formatWith(parseBits("0000z000x001"), "%0d").text).toBe("X");
  });

  it("§21.2.1.2 with §21.2.1.3: %0h removes only leading zero digits, never an x or z digit", () => {
    expect(formatWith(parseBits("0000_x000_0001"), "%0h").text).toBe("X1");
    expect(formatWith(parseBits("xxxx_0000_0001"), "%0h").text).toBe("x01");
  });
});

describe("sv-format-model · presets, bits and grading", () => {
  it("the presets compute the lesson's values: r1 '  10', 4'b10x1 'X', all z '  z', x and z in one digit '3X5'", () => {
    const text = (id: string) => {
      const p = findFormatPreset(id);
      return formatWith(p.bits, p.specifier).text;
    };
    expect(text("r1")).toBe("  10");
    expect(text("10x1")).toBe("X");
    expect(text("all-z")).toBe("  z");
    expect(text("xz-digit")).toBe("3X5");
    expect(FORMAT_PRESETS.map((p) => p.id)).toEqual(["r1", "10x1", "all-z", "xz-digit"]);
    expect(findFormatPreset("nope").id).toBe("r1");
  });

  it("the lesson line bin=%b hex=%h dec=%0d on 4'b10x1 prints bin=10x1 hex=X dec=X", () => {
    const n = parseBits("10x1");
    expect(`bin=${formatWith(n, "%b").text} hex=${formatWith(n, "%h").text} dec=${formatWith(n, "%0d").text}`).toBe("bin=10x1 hex=X dec=X");
  });

  it("bit helpers: toggle order, resize and literal", () => {
    expect(["0", "1", "x", "z"].map((b) => nextBit(b as "0"))).toEqual(["1", "x", "z", "0"]);
    expect(resizeBits(parseBits("10x1"), 9).join("")).toBe("0000010x1");
    expect(resizeBits(parseBits("0011xz100101"), 4).join("")).toBe("0101");
    expect(literalText(parseBits("000000001010"))).toBe("12'b0000_0000_1010");
    expect(() => parseBits("10a1")).toThrow();
  });

  it("grading: an exact answer is correct; · counts as a space", () => {
    const r = formatWith(bitsFromNumber(10, 12), "%d");
    expect(normalizeGuess("··10")).toBe("  10");
    expect(gradeGuess(r, "··10").correct).toBe(true);
    expect(gradeGuess(r, "  10").reason).toBe("exact");
  });

  it("grading §21.2.1.2: missing padding in decimal is diagnosed as padding", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%d"), "10");
    expect(g.reason).toBe("padding");
    expect(g.sentence).toContain("4 columns");
    expect(g.sentence).not.toContain("Decimal suppresses leading zeros");
  });

  it("grading §21.2.1.2: zeros where decimal needs spaces name the decimal rule", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%d"), "0010");
    expect(g.reason).toBe("padding");
    expect(g.sentence).toContain("Decimal suppresses leading zeros and replaces them with spaces (§21.2.1.2).");
  });

  it("grading §21.2.1.2: dropped hex zeros are diagnosed", () => {
    expect(gradeGuess(formatWith(bitsFromNumber(10, 12), "%h"), "a").reason).toBe("dropped-zeros");
  });

  it("grading §21.2.1.3: the wrong case of x is diagnosed, and a number for an x value is a partial number", () => {
    expect(gradeGuess(formatWith(parseBits("10x1"), "%h"), "x").reason).toBe("case");
    expect(gradeGuess(formatWith(parseBits("10x1"), "%d"), " 9").reason).toBe("partial-number");
    expect(gradeGuess(formatWith(parseBits("10x1"), "%d"), "").reason).toBe("empty");
  });

  it("grading §21.2.1.2: the dropped-zeros sentence starts with a capital and names the %0 form", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%h"), "a");
    expect(g.sentence).toContain("Hexadecimal keeps its leading zeros unless you write %0h.");
    expect(gradeGuess(formatWith(bitsFromNumber(2, 4), "%b"), "10").sentence).toContain("Binary keeps its leading zeros unless you write %0b.");
  });

  it("grading §21.2.1.2: too many hex zeros is extra-zeros", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%h"), "000a");
    expect(g.reason).toBe("extra-zeros");
    expect(g.sentence).toContain("1 leading zero more than the field holds");
    expect(g.sentence).toContain("3 columns");
  });

  it("grading §21.2.1.2: spaces where hex needs zeros is its own reason", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%h"), "  a");
    expect(g.reason).toBe("spaces-for-zeros");
    expect(g.sentence).toContain("Hexadecimal pads with leading zeros, not spaces");
    expect(g.sentence).toContain("§21.2.1.2");
    expect(gradeGuess(formatWith(bitsFromNumber(10, 12), "%0h"), " a").sentence).toContain("%0h pads with neither spaces nor zeros.");
    const o = gradeGuess(formatWith(bitsFromNumber(5, 9), "%o"), "  5");
    expect(o.reason).toBe("spaces-for-zeros");
    expect(o.sentence).toContain("Octal pads with leading zeros, not spaces");
    expect(gradeGuess(formatWith(bitsFromNumber(2, 4), "%b"), "  10").reason).toBe("spaces-for-zeros");
  });

  it("grading: an uppercase hex letter a to f is accepted, with the note that the standard only shows lowercase", () => {
    const r = formatWith(bitsFromNumber(10, 12), "%h");
    const g = gradeGuess(r, "00A");
    expect(g.correct).toBe(true);
    expect(g.reason).toBe("hex-letter-case");
    expect(g.sentence).toContain(HEX_LETTER_CASE_SENTENCE);
    expect(g.sentence).not.toContain(XZ_CASE_SENTENCE);
    expect(g.cells.map((c) => c.match)).toEqual([true, true, true]);
    // A wrong answer with an uppercase letter is graded on its real error.
    expect(gradeGuess(r, "A").reason).toBe("dropped-zeros");
    expect(gradeGuess(r, "A").sentence).toContain(HEX_LETTER_CASE_SENTENCE);
    expect(gradeGuess(r, "a").sentence).not.toContain(HEX_LETTER_CASE_SENTENCE);
  });

  it("grading §21.2.1.3: the x/z case sentence appears only when x or z has the wrong case", () => {
    const g = gradeGuess(formatWith(parseBits("10x1"), "%h"), "x");
    expect(g.reason).toBe("case");
    expect(g.sentence).toContain(XZ_CASE_SENTENCE);
    expect(g.sentence).toContain("some but not all bits are x");
  });

  it("grading §21.2.1.3 with §21.2.1.2: wrong case and missing pad space in decimal names both", () => {
    const r = formatWith(parseBits("10x1"), "%d");
    expect(r.text).toBe(" X");
    const g = gradeGuess(r, "x");
    expect(g.reason).toBe("case");
    expect(g.sentence).toContain(XZ_CASE_SENTENCE);
    expect(g.sentence).toContain(r.widthSentence);
    expect(gradeGuess(r, " x").sentence).not.toContain(r.widthSentence);
  });

  it("grading §21.2.1.3: Z for a digit with x and z is other, with the x-wins-over-z sentence", () => {
    const g = gradeGuess(formatWith(parseBits("0011_xz10_0101"), "%h"), "3Z5");
    expect(g.reason).toBe("other");
    expect(g.sentence).toContain("x wins over z");
  });

  it("grading: an exact answer explains every x/z digit group", () => {
    const r = formatWith(parseBits("xxxx_x000_zzzz"), "%h");
    expect(r.text).toBe("xXz");
    const g = gradeGuess(r, "xXz");
    expect(g.reason).toBe("exact");
    r.ruleSentences.forEach((s) => expect(g.sentence).toContain(s));
  });

  it("grading compares cells right-aligned", () => {
    const g = gradeGuess(formatWith(bitsFromNumber(10, 12), "%d"), "10");
    expect(g.cells.map((c) => c.guessed)).toEqual([null, null, "1", "0"]);
    expect(g.cells.map((c) => c.match)).toEqual([false, false, true, true]);
  });
});
