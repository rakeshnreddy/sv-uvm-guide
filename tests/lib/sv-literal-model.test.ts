import { describe, expect, it } from "vitest";

import { bitsOf, buildEnv, evaluateAssignment, evaluateExpression, parseLiteral, toTwoState, type SvDecl } from "@/lib/sv-expression-model";
import {
  LITERAL_PRESETS,
  LITERAL_TARGETS,
  bitsText,
  checkConcatenation,
  decodeLiteral,
  digitGroups,
  lexLiteral,
  literalCode,
  literalPredictionOptions,
  predictionQuestion,
  syntaxErrorCards,
  type LiteralDecode,
  type LiteralFailure,
  type LiteralTargetId,
} from "@/lib/sv-literal-model";

const ok = (text: string, target: LiteralTargetId = "self") => {
  const d = decodeLiteral(text, target);
  if (!d.ok) throw new Error(`${text}: ${d.error.message}`);
  return d;
};
const bad = (text: string) => {
  const d = decodeLiteral(text, "logic16");
  if (d.ok) throw new Error(`${text} decoded`);
  return (d as LiteralFailure).error;
};
const step = (d: LiteralDecode, id: string) => d.steps.find((s) => s.id === id)!;
const str = (bits: readonly string[] | null) => (bits ?? []).join("");
const v16: SvDecl = { name: "v", type: "logic", width: 16 };

describe("§5.7.1 digits to bits", () => {
  it("§5.7.1: a hex digit is 4 bits, an octal digit 3, a binary digit 1", () => {
    expect(str(step(ok("8'hA5"), "groups").bits)).toBe("10100101");
    expect(str(step(ok("6'o75"), "groups").bits)).toBe("111101");
    expect(str(step(ok("4'b1001"), "groups").bits)).toBe("1001");
  });

  it("§5.7.1: an x sets 4 bits in hex, 3 in octal, 1 in binary; z likewise, and ? is z", () => {
    expect(str(step(ok("12'h3x"), "groups").bits)).toBe("0011xxxx");
    expect(str(step(ok("6'o7z"), "groups").bits)).toBe("111zzz");
    expect(str(step(ok("4'b10x1"), "groups").bits)).toBe("10x1");
    expect(str(step(ok("8'h?1"), "groups").bits)).toBe("zzzz0001");
    expect(step(ok("8'h?1"), "groups").text).toContain("? is another way to write z");
  });

  it("§5.7.1: decimal digits name one number (its fewest bits); a single x/z/? digit makes every bit x or z", () => {
    expect(str(step(ok("12"), "groups").bits)).toBe("1100");
    expect(str(step(ok("4'd20"), "groups").bits)).toBe("10100");
    expect(str(ok("8'd?").final ? bitsOf(ok("8'd?").final) : [])).toBe("zzzzzzzz");
    // Example 3 of §5.7.1: 16'sd? is the same as 16'sbz.
    expect(bitsOf(ok("16'sd?").final)).toEqual(bitsOf(parseLiteral("16'sbz").value));
  });

  it("§5.7.1: underscores are ignored", () => {
    const d = ok("16'b0011_0101_0001_1111");
    expect(d.tokens.cleanDigits).toBe("0011010100011111");
    expect(step(d, "tokens").text).toContain("underscores are ignored");
  });

  it("digitGroups labels one segment per hex digit", () => {
    expect(digitGroups(ok("8'hA5").tokens).map((g) => g.digit)).toEqual(["A", "5"]);
    expect(step(ok("8'hA5"), "groups").segments).toEqual([
      { hi: 7, lo: 4, label: "A" },
      { hi: 3, lo: 0, label: "5" },
    ]);
  });
});

describe("§5.7.1 padding and truncation to the literal's size", () => {
  it("§5.7.1: digits narrower than the size pad on the left with 0", () => {
    const d = ok("12'h3x");
    expect(bitsText(step(d, "size").bits!)).toBe("12'h03x");
    expect(step(d, "size").extendedFrom).toBe(8);
    expect(step(d, "size").text).toContain("padded on the left with 0");
  });

  it("§5.7.1: a leftmost x or z bit pads with x or z (Example 4: 'h3x yields 03x, 'hz3 zz3, 'h0z3 0z3)", () => {
    expect(str(bitsOf(ok("8'bx").final))).toBe("xxxxxxxx");
    expect(step(ok("8'bx"), "size").text).toContain("padded on the left with x");
    const as12 = (t: string) => bitsText(bitsOf(ok(t, "logic16").assignment!.final).slice(4));
    expect(as12("'h3x")).toBe("12'h03x");
    expect(as12("'hz3")).toBe("12'hzz3");
    expect(as12("'h0z3")).toBe("12'h0z3");
  });

  it("§5.7.1: digits wider than the size are truncated from the left (4'hFF is 4'hF)", () => {
    const d = ok("4'hFF");
    const s = step(d, "size");
    expect(str(s.shown)).toBe("11111111");
    expect(s.droppedFrom).toBe(4);
    expect(bitsText(s.bits!)).toBe("4'b1111");
    expect(s.text).toContain("truncated from the left");
    expect(s.text).toContain("does not require a warning");
  });

  it("§5.7.1: an unsized number has at least 32 bits", () => {
    expect(ok("12").final.width).toBe(32);
    expect(ok("'hF").final.width).toBe(32);
    expect(ok("12").minWidth).toBe(32);
  });

  it("§5.7.1: an unsized number that needs more than 32 bits gets at least the width it needs ('h7_0000_0000: at least 35)", () => {
    const d = ok("'h7_0000_0000");
    expect(d.minWidth).toBe(35);
    expect(d.final.width).toBe(36);
    expect(step(d, "size").text).toContain("at least 35 bits. This model uses 36");
    expect(d.notes.join(" ")).toContain("least width (35 bits here)");
    // 4294967296 (2^32), a positive signed integer: at least 34 bits.
    expect(ok("4294967296").minWidth).toBe(34);
    expect(ok("4294967296").final.width).toBe(34);
  });

  it("§5.7.1: a signed unsized based literal whose top bit is set and needs more than 32 bits is flagged as the model's reading", () => {
    const d = ok("'shF_FFFF_FFFF");
    expect(d.minWidth).toBe(d.final.width);
    expect(d.notes.some((n) => n.includes("sign bit depends on the width"))).toBe(true);
  });

  it.each(["'shFFFF_FFFF", "'sh8000_0000"])("§5.7.1: %s fills exactly 32 bits with its top bit set: the model's reading, never a minimum above the width used", (lit) => {
    const d = ok(lit);
    expect(d.signAmbiguous).toBe(true);
    expect(d.minWidth).not.toBeNull();
    expect(d.minWidth!).toBeLessThanOrEqual(d.final.width);
    expect(d.minWidth).toBe(32);
    expect(step(d, "size").text).not.toContain("at least 33");
    expect(step(d, "size").text).toContain("whether that is a sign bit depends on the width a tool gives it");
    expect(step(d, "sign").text).toContain("That is this model's reading at 32 bits");
    expect(d.notes.some((n) => n.includes("sign bit depends on the width"))).toBe(true);
  });

  it("§5.7.1: 'sh8000_0000 into logic [39:0]: the sign extension is flagged as the model's reading, and the 0-sign-bit strip is not offered as a mistake", () => {
    const d = ok("'sh8000_0000", "logic40");
    expect(bitsText(bitsOf(d.final))).toBe("40'hFF_8000_0000");
    expect(step(d, "target").text).toContain("a tool that gives the literal more bits would have a 0 sign bit");
    expect(d.notes.some((n) => n.includes("model's reading"))).toBe(true);
    expect(literalPredictionOptions(d).map((o) => o.label)).not.toContain("40'h00_8000_0000");
  });

  it("§5.7.1: an unsigned 'h literal and a signed one with a 0 top bit are not flagged", () => {
    expect(ok("'hFFFF_FFFF").signAmbiguous).toBe(false);
    expect(ok("'sh7FFF_FFFF").signAmbiguous).toBe(false);
    expect(ok("'shFFFF").signAmbiguous).toBe(false);
  });

  it("§5.7.1: decimal digits name a positive number, so an unsized 'sd literal that needs more than 32 bits gets a 0 sign bit ('sd4294967296: at least 34)", () => {
    const big = ok("'sd4294967296", "logic40");
    expect(big.signAmbiguous).toBe(false);
    expect(big.minWidth).toBe(34);
    expect(big.parsed.value.width).toBe(34);
    expect(step(big, "size").text).toContain("at least 34 bits, sign bit included");
    expect(step(big, "sign").text).toContain("reads as 4294967296.");
    expect(bitsText(bitsOf(big.final))).toBe("40'h01_0000_0000");
    expect(big.notes.join(" ")).toContain("decoded as 34'sd4294967296");

    const max32 = ok("'sd4294967295");
    expect(max32.minWidth).toBe(33);
    expect(max32.final.width).toBe(33);
    expect(step(max32, "sign").text).toContain("reads as 4294967295.");
    expect(step(max32, "sign").text).not.toContain("-1");

    const half = ok("'sd2147483648", "logic40");
    expect(bitsText(bitsOf(half.final))).toBe("40'h00_8000_0000");
    expect(half.summary).toContain("which is 2147483648");
    expect(step(half, "target").text).toContain("sign bit (0)");
    // The pre-fix reading (sign-extending a 32-bit -2147483648) is offered only as the 'cut at 32' mistake.
    expect(literalPredictionOptions(half).find((o) => o.label === "40'hFF_8000_0000")?.id).toBe("unsized-32");

    // Small 'sd literals keep parseLiteral's own 32 bits.
    expect(ok("'sd5").final.width).toBe(32);
    expect(ok("'sd5", "logic16").notes).toEqual([]);
    // One more bit than the digits: a 64-bit 'sd value is past the drawing limit.
    expect(bad("'sd18446744073709551615").code).toBe("too-wide");
  });

  it("§5.7.1: an unsized literal led by x needs the bits of its digits, not of a value", () => {
    const d = ok("'hx_0000_0000");
    expect(d.minWidth).toBe(36);
    expect(step(d, "size").text).toContain("its digits need more, so it has at least 36 bits");
    expect(step(d, "size").text).not.toContain("its value needs");
  });
});

describe("§5.7.1, §11.8.1 signedness", () => {
  it("§5.7.1, §11.8.1: based literals are unsigned without s; s changes the reading, not the bits", () => {
    const u = ok("8'hFF");
    const s = ok("8'shFF");
    expect(bitsOf(u.final)).toEqual(bitsOf(s.final));
    expect(u.final.signed).toBe(false);
    expect(s.final.signed).toBe(true);
    expect(step(u, "sign").text).toContain("reads as 255, not -1");
    expect(step(s, "sign").text).toContain("reads as -1; read unsigned, the same bits would be 255");
    expect(step(s, "sign").signBit).toBe(7);
  });

  it("§5.7.1, §11.8.1: simple decimal numbers are signed; the fill literals are unsigned", () => {
    expect(ok("12").final.signed).toBe(true);
    expect(step(ok("12"), "sign").text).toContain("signed (§5.7.1, §11.8.1)");
    expect(ok("'1").final.signed).toBe(false);
    expect(step(ok("'1"), "sign").text).toBe("It is unsigned: §5.7.1 calls it an unsized unsigned single-bit value.");
    expect(step(ok("'1"), "sign").signBit).toBeUndefined();
  });

  it("§5.7.1: an x or z bit has no single number value; 1'sb1 reads as -1", () => {
    expect(step(ok("8'shx"), "sign").text).toContain("It has x or z bits, so it has no single number value.");
    expect(step(ok("1'sb1"), "sign").text).toContain("1'b1 reads as -1");
    expect(step(ok("1'sb1"), "sign").signBit).toBe(0);
  });
});

describe("§5.7.1 fill literals and x/z-led unsized literals", () => {
  it("§5.7.1: '0 '1 'x 'z set every bit of their context (Example 5) and are 1 bit when self-determined", () => {
    expect(bitsText(bitsOf(ok("'1", "logic16").final))).toBe("16'hFFFF");
    expect(bitsText(bitsOf(ok("'0", "logic16").final))).toBe("16'h0000");
    expect(bitsText(bitsOf(ok("'x", "logic16").final))).toBe("16'hxxxx");
    expect(bitsText(bitsOf(ok("'z", "logic16").final))).toBe("16'hzzzz");
    expect(ok("'1").final.width).toBe(1);
    expect(ok("'1", "logic16").mode).toBe("fill");
    expect(step(ok("'1"), "target").text).toContain("'1 is 1 bit wide (§5.7.1)");
  });

  it("§5.7.1: an unsized literal led by x extends with x to its context, even past 32 bits ('hx fills 40 bits)", () => {
    const d = ok("'hx", "logic40");
    expect(bitsOf(d.final).every((b) => b === "x")).toBe(true);
    expect(d.final.width).toBe(40);
    expect(d.mode).toBe("pad");
    expect(step(d, "target").text).toContain("85-bit");
  });

  it("§5.7.1 vs §10.7: a sized x literal is zero-extended (4'bx into 16 bits is 16'h000x)", () => {
    const d = ok("4'bx", "logic16");
    expect(bitsText(bitsOf(d.final))).toBe("16'h000x");
    expect(d.mode).toBe("zero");
    expect(step(d, "target").text).toContain("the 12 new bits are 0");
  });
});

describe("§10.7 into the target, §6.11.2 2-state storage", () => {
  it("§10.7: a signed literal is sign-extended even into an unsigned logic (8'shFF into 16 bits is 16'hFFFF)", () => {
    const d = ok("8'shFF", "logic16");
    expect(bitsText(bitsOf(d.final))).toBe("16'hFFFF");
    expect(d.mode).toBe("sign");
    expect(step(d, "target").text).toContain("§11.8.1");
    expect(step(d, "target").extendedFrom).toBe(8);
  });

  it("§10.7: an unsigned literal is zero-extended; a wider right-hand side loses its MSBs", () => {
    expect(bitsText(bitsOf(ok("8'hFF", "logic16").final))).toBe("16'h00FF");
    const one = ok("1", "logic16");
    expect(one.mode).toBe("truncate");
    expect(step(one, "target").droppedFrom).toBe(16);
    expect(step(one, "target").text).toContain("does not require it");
    expect(bitsText(bitsOf(ok("'h7_0000_0000", "logic16").final))).toBe("16'h0000");
    expect(bitsText(bitsOf(ok("'h7_0000_0000", "logic40").final))).toBe("40'h07_0000_0000");
  });

  it("§6.11.2: a bit target turns x and z into 0, in a separate step that marks the changed bits", () => {
    const d = ok("4'b10x1", "bit16");
    expect(bitsText(bitsOf(d.final))).toBe("16'h0009");
    const s = step(d, "two-state");
    expect(s.changed).toEqual([1]);
    expect(s.clause).toBe("§6.11.2");
    expect(str(bitsOf(d.beforeTwoState!))).toBe("00000000000010x1");
    expect(ok("8'hFF", "bit16").steps.some((x) => x.id === "two-state")).toBe(false);
  });
});

describe("pinned to parseLiteral and evaluateAssignment", () => {
  const cases = LITERAL_PRESETS.flatMap((p) => LITERAL_TARGETS.map((t) => [p.id, p.literal, t.id] as const));
  it.each(cases)("%s into %s: the steps end on parseLiteral's bits and evaluateAssignment's final value", (_id, literal, target) => {
    const d = ok(literal, target);
    const lit = bitsOf(parseLiteral(literal).value);
    expect(step(d, "size").bits).toEqual(lit);
    expect(step(d, "sign").bits).toEqual(lit);
    const decl = LITERAL_TARGETS.find((t) => t.id === target)!.decl;
    const expected = decl ? (evaluateAssignment([decl], decl, literal) as { final: Parameters<typeof bitsOf>[0] }).final : parseLiteral(literal).value;
    expect(bitsOf(d.final)).toEqual(bitsOf(expected));
    expect(d.steps[d.steps.length - 1].bits).toEqual(bitsOf(expected));
    if (decl?.type === "bit" && d.beforeTwoState) expect(bitsOf(toTwoState(d.beforeTwoState))).toEqual(bitsOf(expected));
    // The groups step pads or truncates to the literal's own bits.
    const digits = step(d, "groups").bits!;
    const W = lit.length;
    const padded = digits.length >= W ? digits.slice(digits.length - W) : [...Array(W - digits.length).fill(digits[0] === "x" || digits[0] === "z" ? digits[0] : "0"), ...digits];
    expect(padded).toEqual(lit);
    expect(d.summary).toContain(bitsText(bitsOf(expected)));
  });
});

describe("prediction options", () => {
  it.each(LITERAL_PRESETS.map((p) => [p.id, p.literal, p.target] as const))("%s: 3 or 4 distinct strips, one correct, equal to the stored value", (_id, literal, target) => {
    const d = ok(literal, target);
    const opts = literalPredictionOptions(d);
    expect(opts.length).toBeGreaterThanOrEqual(3);
    expect(opts.length).toBeLessThanOrEqual(4);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
    expect(opts.find((o) => o.correct)!.bits).toEqual(bitsOf(d.final));
    expect(new Set(opts.map((o) => o.bits.join(""))).size).toBe(opts.length);
    for (const o of opts) {
      expect(o.label).toBe(bitsText(o.bits));
      expect(o.feedback).toMatch(/§/);
    }
    expect(literalPredictionOptions(d)).toEqual(opts);
  });

  it("the correct strip is not always in the same place", () => {
    const places = new Set(LITERAL_PRESETS.map((p) => literalPredictionOptions(ok(p.literal, p.target)).findIndex((o) => o.correct)));
    expect(places.size).toBeGreaterThan(1);
  });

  it("§5.7.1: 'v = 1 sets every bit' and '4'bx fills 16 bits' are offered and explained", () => {
    const one = literalPredictionOptions(ok("1", "logic16")).find((o) => o.id === "every-bit")!;
    expect(bitsText(one.bits)).toBe("16'hFFFF");
    expect(one.feedback).toContain("Only the unbased unsized literals '0, '1, 'x and 'z fill every bit of their context, and unsized unsigned literals led by x or z extend that x or z to the width of their context (§5.7.1). 1 has its own 32 bits");
    expect(one.feedback).not.toContain("led by x or z, fill every bit");
    const x = literalPredictionOptions(ok("4'bx", "logic16")).find((o) => o.id === "every-bit")!;
    expect(bitsText(x.bits)).toBe("16'hxxxx");
  });

  it("§11.8.1: 'a based literal is signed' is the strip 8'shFF would give", () => {
    const o = literalPredictionOptions(ok("8'hFF", "logic16")).find((x) => x.id === "based-signed")!;
    expect(o.bits).toEqual(bitsOf(ok("8'shFF", "logic16").final));
    expect(o.feedback).toContain("8'shFF");
  });

  it("§6.11.2: on a bit target, 'bit keeps x' shows the 4-state value", () => {
    const o = literalPredictionOptions(ok("8'bx", "bit16")).find((x) => x.id === "two-state-keeps-x")!;
    expect(bitsText(o.bits)).toBe("16'h00xx");
  });

  it("§5.7.1: 'unsized means 32 bits' is offered for the 40-bit targets", () => {
    expect(literalPredictionOptions(ok("'hx", "logic40")).map((o) => o.id)).toContain("unsized-32");
    const wide = literalPredictionOptions(ok("'h7_0000_0000", "logic40")).find((o) => o.id === "unsized-32")!;
    expect(bitsText(wide.bits)).toBe("40'h00_0000_0000");
    expect(wide.feedback).toContain("at least 35 bits");
  });

  it("§5.7.1: '1 as a $display argument: 1 bit, not 32 ones and not the integer 1", () => {
    const ids = literalPredictionOptions(ok("'1", "self")).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["correct", "fill-32-bits", "fill-is-int-1"]));
  });

  const opt = (lit: string, target: LiteralTargetId, id: string) => {
    const o = literalPredictionOptions(ok(lit, target)).find((x) => x.id === id);
    if (!o) throw new Error(`${lit} into ${target}: no ${id} option`);
    return o;
  };

  it("each misconception's strip comes with the clause that corrects it", () => {
    expect(opt("4'b10x1", "logic16", "x-spreads").feedback).toBe("An x does not spread to the other bits: only the bits its digit sets are x, and the padding and the known digits keep their values (§5.7.1).");
    expect(opt("8'hFF", "logic16", "lands-high").feedback).toBe("Extension adds bits on the left: bit 0 of the literal stays bit 0 of v (§10.7).");
    expect(bitsText(opt("8'hFF", "logic16", "lands-high").bits)).toBe("16'hFF00");
    expect(opt("8'bx", "logic16", "pad-zero").feedback).toContain("the padding is x, not 0 (§5.7.1)");
    expect(opt("'hx", "logic16", "one-x-bit").feedback).toContain("is not one x bit with zeros above it");
    expect(bitsText(opt("'hx", "logic16", "one-x-bit").bits)).toBe("16'b0000_0000_0000_000x");
    expect(bitsText(opt("4'hA5", "logic16", "keep-left").bits)).toBe("16'h000A");
    expect(opt("1", "logic16", "keep-left").feedback).toBe("Truncation keeps the low bits and discards the most significant ones (§10.7).");
    expect(opt("4'hA5", "logic16", "keep-left").feedback).toBe("A literal's digits are truncated from the left: the low bits stay and the leftmost are cut off (§5.7.1).");
    expect(opt("4'hFF", "logic16", "size-ignored").feedback).toContain("The size is exact (§5.7.1): 4'hFF holds only 4 bits");
    expect(bitsText(opt("4'hFF", "logic16", "size-ignored").bits)).toBe("16'h00FF");
    expect(opt("12", "logic16", "decimal-as-hex").feedback).toContain("12 is 1100 in binary (§5.7.1). This strip reads them as 'h12");
    expect(bitsText(opt("12", "logic16", "decimal-as-hex").bits)).toBe("16'h0012");
    expect(opt("8'shFF", "logic16", "target-sign").feedback).toContain("The literal's own type picks the extension, not v's");
    expect(bitsText(opt("8'shFF", "logic16", "target-sign").bits)).toBe("16'h00FF");
  });

  it("§5.7.1: when the leftmost digit bit is x, the x-spreads feedback says the padding is x too (8'bx01)", () => {
    const d = ok("8'bx01", "logic16");
    expect(str(bitsOf(d.final))).toBe("00000000xxxxxx01");
    const o = opt("8'bx01", "logic16", "x-spreads");
    expect(o.feedback).toContain("because the leftmost digit bit is x the padding is x too, up to the literal's 8 bits (§5.7.1)");
    expect(o.feedback).toContain("the 8 bits the assignment adds are 0 (§10.7)");
    expect(o.feedback).not.toContain("the padding and the known digits keep their values");
  });

  it("§10.7: a signed literal whose sign bit is x or z: x-spreads says the added bits copy that sign bit (4'sbx001, 8'shx1, 4'sbz001)", () => {
    const o = opt("4'sbx001", "logic16", "x-spreads");
    expect(bitsText(bitsOf(ok("4'sbx001", "logic16").final))).toBe("16'bxxxx_xxxx_xxxx_x001");
    expect(o.feedback).toContain("the 12 bits the assignment adds copy its sign bit, x (§10.7)");
    expect(o.feedback).not.toContain("only the bits its digit sets are x");
    expect(opt("8'shx1", "logic16", "x-spreads").feedback).toContain("the 8 bits the assignment adds copy its sign bit, x (§10.7)");
    const z = opt("4'sbz001", "logic40", "x-spreads").feedback;
    expect(z).toContain("the 36 bits the assignment adds copy its sign bit, z (§10.7)");
    expect(z).not.toContain("only the bits its digit sets are z");
    // Truncated first, then sign-extended: the feedback names the bits truncation leaves.
    expect(opt("4'sbxx001", "logic16", "x-spreads").feedback).toContain("truncation from the left leaves 4'bx001 (§5.7.1)");
  });

  it("§5.7.1: '1 into 16 bits: the 'one bit' strips are explained by §5.7.1, not by §10.7 extension", () => {
    const high = opt("'1", "logic16", "lands-high");
    expect(bitsText(high.bits)).toBe("16'h8000");
    expect(high.feedback).toBe("'1 is not a single 1 placed in one bit of v, at the top or at the bottom: every bit of its context takes the value 1, here all 16 bits (§5.7.1).");
    expect(high.feedback).not.toContain("§10.7");
    expect(opt("'1", "logic16", "fill-one-bit").feedback).toContain("every bit of its context takes the value 1");
  });

  it("asks a question that names the target", () => {
    expect(predictionQuestion("8'hFF", "logic16")).toBe("After v = 8'hFF;, which bits does v hold?");
    expect(predictionQuestion("'1", "self")).toContain("$display");
  });
});

describe("§5.7.1 syntax errors", () => {
  it("§5.7.1: a sign between the base and the digits is illegal (8'd-6, 8 'd -6)", () => {
    const e = bad("8'd-6");
    expect(e.code).toBe("sign-after-base");
    expect(e.illegal).toBe(true);
    expect(e.fix).toBe("-8'd6");
    expect(bad("8 'd -6").code).toBe("sign-after-base");
  });

  it("§5.7.1: no white space between the apostrophe and the base letter; white space before the digits is legal", () => {
    expect(bad("8' hFF").code).toBe("space-in-base");
    expect(bad("8' hFF").fix).toBe("8'hFF");
    expect(bitsText(bitsOf(ok("5 'D 3").final))).toBe("5'b0_0011");
    expect(bitsText(bitsOf(ok("8'h FF").final))).toBe("8'b1111_1111");
  });

  it("§5.7.1: the size is nonzero, the digits are legal for the base, and _ is not first", () => {
    expect(bad("0'h1").code).toBe("zero-size");
    expect(bad("8'b2").code).toBe("illegal-digit");
    expect(bad("8'o8").code).toBe("illegal-digit");
    expect(bad("8'd1x").code).toBe("decimal-xz");
    expect(bad("8'h_F").code).toBe("leading-underscore");
    expect(bad("8'q1").code).toBe("bad-base");
    expect(bad("8'h").code).toBe("no-digits");
  });

  it("§5.7.1: 4af is illegal (hexadecimal format requires 'h)", () => {
    const e = bad("4af");
    expect(e.code).toBe("not-a-literal");
    expect(e.message).toContain("4af");
    expect(e.fix).toBe("'h4af");
  });

  it("§5.7.2: real literals are legal, not hex literals missing 'h (23E10, 39e8, 1_0e3, 1.2, 29E-2, 236.123_763_e-12)", () => {
    for (const t of ["23E10", "39e8", "1_0e3", "1.2", "29E-2", "236.123_763_e-12"]) {
      const e = bad(t);
      expect(e.code).toBe("real-literal");
      expect(e.illegal).toBe(false);
      expect(e.fix).toBeUndefined();
      expect(e.clause).toBe("§5.7.2");
    }
    expect(bad("4af").fix).toBe("'h4af");
  });

  it("§5.7.2: a decimal point needs a digit on each side (.12, 9., 4.E3, .2e-7 are invalid)", () => {
    for (const t of [".12", "9.", "4.E3", ".2e-7"]) {
      const e = bad(t);
      expect(e.illegal).toBe(true);
      expect(e.clause).toBe("§5.7.2");
      expect(e.message).toContain("at least one digit on each side of the point");
    }
  });

  it("Syntax 5-2 footnote 53: no white space after the apostrophe of '0 '1 'x 'z (' 1)", () => {
    const e = bad("' 1");
    expect(e.code).toBe("space-in-base");
    expect(e.illegal).toBe(true);
    expect(e.message).toContain("footnote 53");
    expect(e.message).not.toContain("is not a base letter");
    expect(e.fix).toBe("'1");
    expect(bad("' x").fix).toBe("'x");
    expect(lexLiteral(e.fix!).ok).toBe(true);
  });

  it("a lone sign is not a literal and gets no broken 'applies - to' text", () => {
    for (const t of ["-", "+", "- "]) {
      const e = bad(t);
      expect(e.code).toBe("not-a-literal");
      expect(e.message).not.toContain("applies");
      expect(e.message).toContain("Type a literal");
    }
  });

  it("§5.7.1: digits then a letter that is not a hex digit get no 'h fix (12g, 12s)", () => {
    for (const t of ["12g", "12s"]) {
      const e = bad(t);
      expect(e.code).toBe("not-a-literal");
      expect(e.fix).toBeUndefined();
      expect(e.message).not.toContain("hex digits");
    }
  });

  it("§5.7.1: white space inside the digits, a leading underscore, and white space after s each get a legal form", () => {
    expect(bad("8'hF F").code).toBe("space-in-digits");
    expect(bad("8'hF F").fix).toBe("8'hF_F");
    expect(bad("8'h_F").fix).toBe("8'hF");
    expect(bad("8's hFF").code).toBe("space-in-base");
    expect(bad("8's hFF").fix).toBe("8'shFF");
    for (const e of [bad("8'hF F"), bad("8'h_F"), bad("8's hFF"), bad("8' hFF"), bad("4af")]) expect(lexLiteral(e.fix!).ok).toBe(true);
  });

  it("§5.7.1: a single x, z or ? is a legal decimal digit ('dx, 16'sd?, Example 3)", () => {
    expect(lexLiteral("'dx").ok).toBe(true);
    expect(lexLiteral("16'sd?").ok).toBe(true);
    expect(bitsText(bitsOf(ok("16'sd?").final))).toBe("16'hzzzz");
  });

  it("§5.7.1: a leading minus is a unary operator, not part of the literal", () => {
    const e = bad("-8'd6");
    expect(e.code).toBe("unary-operator");
    expect(e.illegal).toBe(false);
  });

  it("§11.4.12: an unsized constant in a concatenation is illegal ({a, 1}); {a, 1'b1} is legal", () => {
    const e = checkConcatenation("{a, 1}").error;
    expect(e.code).toBe("unsized-in-concatenation");
    expect(e.clause).toBe("§11.4.12");
    expect(e.fix).toBe("{a, 1'b1}");
    expect(checkConcatenation("{a, 1'b1}").error.code).toBe("concatenation-legal");
    expect(lexLiteral("{a, 1}").ok).toBe(false);
  });

  it("§11.4.12: the legal form sizes every unsized operand, and the expression model accepts it ({a, 1, 2}, {a, 12})", () => {
    const env = buildEnv([{ name: "a", type: "logic", width: 8 }]);
    const two = checkConcatenation("{a, 1, 2}").error;
    expect(two.fix).toBe("{a, 1'b1, 2'b10}");
    expect(evaluateExpression(two.fix!, env).ok).toBe(true);
    const twelve = checkConcatenation("{a, 12}").error;
    expect(twelve.fix).toBe("{a, 4'b1100}");
    expect(twelve.message).toContain("Give it a size: {a, 4'b1100} is legal.");
    expect(twelve.message).not.toContain("e.g.");
    // An unsized based operand is sized at the width this model gives it (32 bits here).
    const hex = checkConcatenation("{a, 'hF}").error;
    expect(hex.fix).toBe("{a, 32'hF}");
    expect(evaluateExpression(hex.fix!, env).ok).toBe(true);
    expect(hex.message).toContain("Give it a size: {a, 32'hF} is legal.");
  });

  it("§11.4.12 with §5.7.1: a signed simple decimal number ({a, -1}) is still unsized, and the legal form re-checks", () => {
    const env = buildEnv([{ name: "a", type: "logic", width: 8 }]);
    const e = checkConcatenation("{a, -1}").error;
    expect(e.code).toBe("unsized-in-concatenation");
    expect(e.illegal).toBe(true);
    expect(e.clause).toBe("§11.4.12, §5.7.1");
    expect(e.message).not.toContain("legal 40-bit");
    expect(e.message).toContain("tools may differ");
    expect(e.fix).toBe("{a, -1'b1}");
    expect(evaluateExpression(e.fix!, env).ok).toBe(true);
    expect(checkConcatenation("{2{-1}}").error.fix).toBe("{2{-1'b1}}");
    // Every unsized operand is sized, wrapped or not.
    expect(checkConcatenation("{a, -12, 3}").error.fix).toBe("{a, -4'b1100, 2'b11}");
    // A sized operand behind a sign, or an expression with a name, stays legal.
    expect(checkConcatenation("{a, -8'd1}").error.code).toBe("concatenation-legal");
    expect(checkConcatenation("{a, b-1}").error.code).toBe("concatenation-legal");
  });

  it("§11.4.12: an unsized literal behind parentheses or a sign on a based or fill literal is reported as unsettled ({a, (1)}, {a, -'hF})", () => {
    const paren = checkConcatenation("{a, (1)}").error;
    expect(paren.code).toBe("unsized-in-concatenation");
    expect(paren.illegal).toBe(false);
    expect(paren.message).toContain("tools differ");
    expect(paren.fix).toBe("{a, (1'b1)}");
    const based = checkConcatenation("{a, -'hF}").error;
    expect(based.code).toBe("unsized-in-concatenation");
    expect(based.illegal).toBe(false);
    // A based operand is sized at the width this model gives it.
    expect(based.fix).toBe("{a, -32'hF}");
  });

  it("§11.4.12 vs §5.7.1: a fill literal in a concatenation is reported as unsettled, not as firmly illegal", () => {
    const e = checkConcatenation("{a, '1}").error;
    expect(e.code).toBe("unsized-in-concatenation");
    expect(e.illegal).toBe(false);
    expect(e.message).toContain("tools differ");
    expect(e.fix).toBe("{a, 1'b1}");
  });

  it("the syntax-error cards carry the decoder's own explanations", () => {
    const [sign, concat] = syntaxErrorCards();
    expect(sign.error).toEqual(bad("8'd-6"));
    expect(concat.error).toEqual(checkConcatenation("{a, 1}").error);
  });

  it("an empty input and a too-wide literal are not errors of the standard", () => {
    expect(bad("").illegal).toBe(false);
    expect(bad("100'h1").code).toBe("too-wide");
    expect(bad("100'h1").illegal).toBe(false);
  });
});

describe("polish: wording and rules pinned", () => {
  const env = buildEnv([
    { name: "a", type: "logic", width: 8 },
    { name: "b", type: "logic", width: 8 },
  ]);

  it("§5.7.1: a single decimal x/z/? digit may be followed by underscores ('dx_, 8'd?_); '? is not a literal", () => {
    expect(lexLiteral("'dx_").ok).toBe(true);
    expect(str(bitsOf(ok("8'd?_").final))).toBe("zzzzzzzz");
    expect(bad("'?").code).toBe("bad-base");
    expect(step(ok("'dx"), "groups").text).toContain("This model draws it as one x bit first; the next step fills every other bit with x.");
    expect(step(ok("'dx"), "groups").text).not.toContain("It starts as");
  });

  it("§5.7.1: the base letter is shown as typed (either case is legal)", () => {
    const d = ok("5 'D 3", "logic16");
    expect(d.tokens.base).toBe("d");
    expect(d.parts.find((p) => p.role === "base")!.text).toBe("D");
    expect(step(d, "tokens").text).toContain("base D (decimal)");
    expect(step(ok("8'hFF"), "tokens").text).toContain("base h (hexadecimal)");
  });

  it("§10.7: the same width stores the value as it is (16'hABCD into logic [15:0])", () => {
    const d = ok("16'hABCD", "logic16");
    expect(d.mode).toBe("same");
    expect(step(d, "target").text).toBe("v has the same 16 bits, so the value is stored as it is (§10.7).");
    expect(d.summary).toBe("After v = 16'hABCD;, v holds 16'hABCD, which is 43981.");
  });

  it("§5.7.1's 'sized signed literals ... logic' sentence appears only for a sized literal into a logic", () => {
    const sentence = "§5.7.1 says sized signed literals are sign-extended when assigned to a logic";
    expect(step(ok("8'shFF", "logic16"), "target").text).toContain(sentence);
    expect(step(ok("8'shFF", "bit16"), "target").text).not.toContain(sentence);
    const unsized = ok("'sh8000_0000", "logic40");
    expect(unsized.mode).toBe("sign");
    expect(step(unsized, "target").text).not.toContain(sentence);
    // The summary reads the stored bits as the target's own type: v is unsigned.
    expect(ok("8'shFF", "logic16").summary).toBe("After v = 8'shFF;, v holds 16'hFFFF, which is 65535.");
  });

  it("§6.11.2: zero extension of an unsigned value is cited alongside §10.7", () => {
    expect(step(ok("8'hFF", "logic16"), "target").text).toBe("The literal is unsigned, so it is zero-extended to 16 bits (§10.7, §6.11.2).");
  });

  it("§5.7.1 states the x/z extension for unsized unsigned literals; a signed one gets it by sign extension (§10.7)", () => {
    expect(step(ok("'hx"), "size").text).toContain("Because it is unsized and unsigned and its leftmost bit is x, it also extends with x");
    const s = step(ok("'shx"), "size").text;
    expect(s).toContain("Its leftmost bit, x, is also its sign bit, so when it is assigned to a wider variable, sign extension copies x into every added bit (§10.7).");
    expect(s).not.toContain("extends with x to the size of any wider expression");
    const into = ok("'shx", "logic40");
    expect(bitsText(bitsOf(into.final))).toBe(bitsText(bitsOf(ok("'hx", "logic40").final)));
    expect(step(into, "target").clause).toBe("§10.7");
    expect(step(into, "target").text).toBe("It is signed and its sign bit is x, so sign extension fills the 8 added bits of the 40-bit v with x, not with 0 (§10.7).");
    expect(step(ok("'hx", "logic40"), "target").text).toContain("It is unsized and unsigned and its leftmost bit is x");
  });

  it("§5.7.1: an x- or z-led signed literal of 32 digit bits is not hedged: it pads with x or z at any width", () => {
    for (const lit of ["'shx000_0000", "'shz000_0000"]) {
      const d = ok(lit, "logic40");
      expect(d.signAmbiguous).toBe(false);
      expect(d.minWidth).toBe(32);
      expect(step(d, "size").text).not.toContain("depends on the width");
      expect(d.notes.some((n) => n.includes("sign bit depends on the width"))).toBe(false);
    }
    expect(ok("'shF_FFFF_FFFF").signAmbiguous).toBe(true);
  });

  it("§5.7.1: truncating an unsized literal says the discarded count follows the model's width", () => {
    const t = step(ok("'hx", "logic16"), "target").text;
    expect(t).toContain("discards the top 16 (§10.7)");
    expect(t).toContain("The count follows this model's 32-bit reading of the unsized literal; §5.7.1 sets only a least width (32 bits)");
    expect(step(ok("20'hF_FFFF", "logic16"), "target").text).not.toContain("this model's");
  });

  it("§11.4.12: an unsized based operand gets a sized legal form ({4'hF, 'hx})", () => {
    const e = checkConcatenation("{4'hF, 'hx}").error;
    expect(e.code).toBe("unsized-in-concatenation");
    expect(e.fix).toBe("{4'hF, 32'hx}");
    expect(evaluateExpression(e.fix!, env).ok).toBe(true);
    expect(e.message).not.toContain("1'b1");
  });

  it("§11.4.12: a wrapped operand is sized where it was matched, not at the first equal text ({b-1, -1})", () => {
    const e = checkConcatenation("{b-1, -1}").error;
    expect(e.fix).toBe("{b-1, -1'b1}");
    expect(evaluateExpression(e.fix!, env).ok).toBe(true);
  });

  it("§5.7.1: a sign before a real literal is 'before the number', not 'before the size'", () => {
    expect(bad("-23E10").message).toContain("A plus or minus before the number is a unary operator");
    expect(bad("-8'd6").message).toContain("A plus or minus before the size is a unary operator");
  });
});

describe("code shown", () => {
  it("literalCode shows the declaration and assignment, or the $display call", () => {
    expect(literalCode("8'hFF", "logic16")).toEqual(["logic [15:0] v;", "v = 8'hFF;"]);
    expect(literalCode("8'hFF", "bit16")).toEqual(["bit [15:0] v;", "v = 8'hFF;"]);
    expect(literalCode("'1", "self")).toEqual([`$display("%b", '1);`]);
    expect(evaluateAssignment([v16], v16, "8'hFF").ok).toBe(true);
  });
});
