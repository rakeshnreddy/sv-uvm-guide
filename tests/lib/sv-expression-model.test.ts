import { describe, expect, it } from "vitest";

import {
  annotateTree,
  bitVectorReport,
  bitwiseBit,
  bitsOf,
  buildEnv,
  concatTargetDetail,
  conditionalDetail,
  conditionalMergeBit,
  countbits,
  countones,
  equalityFamily,
  evaluateAssignment,
  evaluateExpression,
  expressionIdentifiers,
  formatHexLiteral,
  formatLiteral,
  fromBits,
  insideDetail,
  isunknown,
  mathIntuition,
  notBit,
  onehot,
  onehot0,
  operatorCatalog,
  operatorDecls,
  operatorFamilies,
  operatorPredictionOptions,
  operatorPresets,
  intendedValue,
  operatorTemplate,
  optimisticX,
  parseExpression,
  parseLiteral,
  reductionFold,
  replCount,
  runOperator,
  splitConcatTarget,
  streamBlocks,
  toBigInt,
  trapPredictionOptions,
  trapScenarios,
  type Bit4,
  type NodeAnnotation,
  type OperatorInputs,
  type SvDecl,
  type SvValue,
} from "@/lib/sv-expression-model";

// ---- helpers -------------------------------------------------------------

const d = (name: string, type: SvDecl["type"], width?: number, init?: string, signed?: boolean): SvDecl => ({ name, type, width, init, signed });

function assign(decls: SvDecl[], target: SvDecl, expr: string) {
  const r = evaluateAssignment(decls, target, expr);
  if (!r.ok) throw new Error(`${expr}: ${r.error.message}`);
  return r;
}

function expr(decls: SvDecl[], src: string) {
  const r = evaluateExpression(src, buildEnv(decls));
  if (!r.ok) throw new Error(`${src}: ${r.error.message}`);
  return r;
}

const dec = (v: SvValue) => toBigInt(v)?.toString() ?? "x";
const lit = (v: SvValue) => formatLiteral({ ...v, signed: false });

// The classic declarations used throughout the traps.
const a4 = d("a", "logic", 4, "-4", true); // logic signed [3:0] a = -4  → 4'b1100
const u8 = d("u", "logic", 8, "8'd10"); // logic [7:0] u = 10

// ---- literals ------------------------------------------------------------

describe("§5.7.1 integer literals", () => {
  it("unsized decimal numbers are 32-bit signed", () => {
    const { value, sized } = parseLiteral("12");
    expect(sized).toBe(false);
    expect(value.width).toBe(32);
    expect(value.signed).toBe(true);
  });

  it("based numbers are unsigned unless the s designator is used; s does not change the bits", () => {
    expect(parseLiteral("4'd12").value.signed).toBe(false);
    const s = parseLiteral("4'sd12").value;
    expect(s.signed).toBe(true);
    expect(lit(s)).toBe("4'b1100");
    expect(dec(s)).toBe("-4");
  });

  it("unsized based numbers are at least 32 bits", () => {
    const v = parseLiteral("'hF").value;
    expect(v.width).toBe(32);
    expect(v.signed).toBe(false);
  });

  it("pads with x or z when the leftmost digit is x or z, otherwise with 0", () => {
    expect(lit(parseLiteral("8'bx1").value)).toBe("8'bxxxx_xxx1");
    expect(lit(parseLiteral("8'bz0").value)).toBe("8'bzzzz_zzz0");
    expect(lit(parseLiteral("8'b11").value)).toBe("8'b0000_0011");
  });

  it("truncates from the left when the digits exceed the size", () => {
    expect(lit(parseLiteral("4'hFA").value)).toBe("4'b1010");
  });

  it("? is a z digit (A.8.7 z_digit)", () => {
    expect(bitsOf(parseLiteral("4'b1?0z").value)).toEqual(["1", "z", "0", "z"]);
  });
});

// ---- bit lengths and types -----------------------------------------------

describe("§11.6.1 Table 11-21 bit lengths", () => {
  const decls = [a4, u8, d("n", "logic", 3, "3'd1"), d("c", "logic", 1, "1'b1")];
  const width = (src: string) => expr(decls, src).width;

  it("i op j for + - * / % & | ^ ~^ is max(L(i), L(j))", () => {
    expect(width("a + u")).toBe(8);
    expect(width("a & u")).toBe(8);
  });
  it("comparisons and equality are 1 bit", () => {
    expect(width("a == u")).toBe(1);
    expect(width("a < u")).toBe(1);
  });
  it("reductions and logical operators are 1 bit", () => {
    expect(width("&u")).toBe(1);
    expect(width("a && u")).toBe(1);
  });
  it("shifts take the left operand's length; the count is self-determined", () => {
    expect(width("a << n")).toBe(4);
    expect(width("u >>> 32")).toBe(8);
  });
  it("concatenation sums lengths and replication multiplies them", () => {
    expect(width("{a, u}")).toBe(12);
    expect(width("{3{a}}")).toBe(12);
  });
  it("?: is max(L(j), L(k)) with a self-determined condition", () => {
    expect(width("c ? a : u")).toBe(8);
  });
});

describe("§11.8.1 expression type", () => {
  const decls = [a4, u8, d("b", "logic", 8, "-1", true)];
  const signed = (src: string) => expr(decls, src).signed;

  it("if any operand is unsigned, the result is unsigned", () => {
    expect(signed("a + u")).toBe(false);
    expect(signed("a + a")).toBe(true);
  });
  it("concatenation, comparison and part-select results are unsigned", () => {
    expect(signed("{a}")).toBe(false);
    expect(signed("a < a")).toBe(false);
    expect(signed("b[7:0]")).toBe(false);
  });
  it("$signed and signed' make the result signed (§11.7, §6.24.1)", () => {
    expect(signed("$signed(u)")).toBe(true);
    expect(signed("signed'(u)")).toBe(true);
    expect(signed("$unsigned(a)")).toBe(false);
  });
  it("part-select results are zero-extended even when the variable is signed (LRM example)", () => {
    const decl16 = d("w", "logic", 16);
    expect(formatHexLiteral(assign(decls, decl16, "b[7:0]").final)).toBe("16'h00FF");
    expect(formatHexLiteral(assign(decls, decl16, "b").final)).toBe("16'hFFFF");
  });
});

// ---- the classic traps ---------------------------------------------------

describe("§11.8.2 operands are extended to the context by the EXPRESSION type", () => {
  const r8 = d("r", "logic", 8, undefined, true);

  it("a + u: signed + unsigned is unsigned, so a = -4 is zero-extended to 12 and r = 22, not 6", () => {
    const res = assign([a4, u8], r8, "a + u");
    expect(res.rhsSigned).toBe(false);
    expect(res.contextWidth).toBe(8);
    const ext = res.steps.find((s) => s.kind === "extend" && s.text === "a");
    expect(ext && ext.kind === "extend" && ext.mode).toBe("zero");
    expect(ext && ext.kind === "extend" && lit(ext.to)).toBe("8'b0000_1100");
    expect(dec(res.final)).toBe("22");
  });

  it("$signed(a) + u is still unsigned: the cast cannot win against an unsigned operand", () => {
    expect(dec(assign([a4, u8], r8, "$signed(a) + u").final)).toBe("22");
  });

  it("a + $signed(u) makes every operand signed, so a is sign-extended and r = 6", () => {
    const res = assign([a4, u8], r8, "a + $signed(u)");
    const ext = res.steps.find((s) => s.kind === "extend" && s.text === "a");
    expect(ext && ext.kind === "extend" && ext.mode).toBe("sign");
    expect(dec(res.final)).toBe("6");
  });

  it("the LHS does not change the expression type (§11.8.1), only the width", () => {
    const res = assign([a4, u8], d("r", "int"), "a + u");
    expect(res.rhsSigned).toBe(false);
    expect(dec(res.final)).toBe("22");
  });
});

describe("§11.4.4 comparisons are evaluated at max(operand widths), unsigned if either is unsigned", () => {
  const pos = d("pos", "bit");

  it("a > 4'd0 is TRUE for a = -4: the bits 1100 are compared as 12", () => {
    const res = assign([a4], pos, "a > 4'd0");
    expect(dec(res.final)).toBe("1");
    const ctx = res.steps.find((s) => s.kind === "context" && s.text === "a > 4'd0");
    expect(ctx && ctx.kind === "context" && ctx.width).toBe(4);
    expect(ctx && ctx.kind === "context" && ctx.signed).toBe(false);
  });

  it("a > 0 compares as signed (0 is an unsized signed decimal), so a is sign-extended to 32 bits and the result is 0", () => {
    const res = assign([a4], pos, "a > 0");
    expect(dec(res.final)).toBe("0");
    const ext = res.steps.find((s) => s.kind === "extend" && s.text === "a");
    expect(ext && ext.kind === "extend" && ext.to.width).toBe(32);
    expect(ext && ext.kind === "extend" && ext.mode).toBe("sign");
  });

  it("a > 4'sd0 compares as signed at 4 bits", () => {
    expect(dec(assign([a4], pos, "a > 4'sd0").final)).toBe("0");
  });

  it("int vs logic [31:0]: i = -1 < w = 1 is FALSE because the comparison is unsigned", () => {
    const decls = [d("i", "int", undefined, "-1"), d("w", "logic", 32, "32'd1")];
    expect(dec(assign(decls, d("lt", "bit"), "i < w").final)).toBe("0");
    expect(dec(assign(decls, d("lt", "bit"), "i < $signed(w)").final)).toBe("1");
    expect(dec(assign(decls, d("lt", "bit"), "i < int'(w)").final)).toBe("1");
  });

  it("comparison results are 1 bit, unsigned (§11.8.1)", () => {
    const r = expr([a4], "a < 4'sd0");
    expect(r.width).toBe(1);
    expect(r.signed).toBe(false);
  });
});

describe("§11.4.10 shifts", () => {
  const r4 = d("r", "logic", 4, undefined, true);

  it("-4'sd1 >> 1 is a LOGICAL shift: 4'b1111 → 4'b0111 = 7", () => {
    expect(dec(assign([], r4, "-4'sd1 >> 1").final)).toBe("7");
  });

  it("-4'sd1 >>> 1 sign-fills because the expression is signed: -1", () => {
    expect(dec(assign([], r4, "-4'sd1 >>> 1").final)).toBe("-1");
  });

  it("with an int LHS the context is 32 bits, so >> shifts a 0 into bit 31: 2147483647", () => {
    expect(dec(assign([], d("r", "int"), "-4'sd1 >> 1").final)).toBe("2147483647");
    expect(dec(assign([], d("r", "int"), "-4'sd1 >>> 1").final)).toBe("-1");
  });

  it(">>> on an unsigned expression fills with 0", () => {
    expect(dec(assign([], r4, "$unsigned(-4'sd1) >>> 1").final)).toBe("7");
  });

  it("the shift count is self-determined and unsigned; an x count gives x", () => {
    const decls = [d("s", "logic", 4, "4'b1000", true), d("n", "logic", 2, "2'b1x")];
    expect(lit(expr(decls, "s >>> n").value)).toBe("4'bxxxx");
    // LRM Example 2: 4'b1000 >>> 2 = 4'b1110 for a signed operand.
    expect(lit(expr(decls, "s >>> 2").value)).toBe("4'b1110");
    // LRM Example 1: 4'b0001 << 2 = 4'b0100.
    expect(lit(expr([d("st", "logic", 4, "4'd1")], "st << 2").value)).toBe("4'b0100");
  });

  it("<<< is identical to <<", () => {
    const decls = [d("s", "logic", 4, "4'b1011", true)];
    expect(lit(expr(decls, "s <<< 1").value)).toBe(lit(expr(decls, "s << 1").value));
  });
});

describe("§11.6.1 / §11.6.2 the LHS is part of the context: carries", () => {
  const ops = [d("a8", "logic", 8, "8'd200"), d("b8", "logic", 8, "8'd100")];

  it("logic [7:0] s = a8 + b8 loses the carry: 300 → 44", () => {
    expect(dec(assign(ops, d("s", "logic", 8), "a8 + b8").final)).toBe("44");
  });

  it("logic [8:0] s = a8 + b8 keeps it: operands are extended to 9 bits BEFORE the add", () => {
    const res = assign(ops, d("s", "logic", 9), "a8 + b8");
    expect(res.contextWidth).toBe(9);
    expect(dec(res.final)).toBe("300");
  });

  it("LRM §11.6.2: (a + b) >> 1 in a same-width context loses the carry; (a + b + 0) >> 1 does not", () => {
    expect(dec(assign(ops, d("s", "logic", 8), "(a8 + b8) >> 1").final)).toBe("22");
    expect(dec(assign(ops, d("s", "logic", 8), "(a8 + b8 + 0) >> 1").final)).toBe("150");
  });

  it("LRM §11.6.1: sumA = a + b evaluates in 16 bits, sumB (17 bits) in 17 bits", () => {
    const ab = [d("a", "logic", 16, "16'hFFFF"), d("b", "logic", 16, "16'd1")];
    expect(dec(assign(ab, d("sumA", "logic", 16), "a + b").final)).toBe("0");
    expect(dec(assign(ab, d("sumB", "logic", 17), "a + b").final)).toBe("65536");
  });

  it("LRM §11.6.2: c ? (a&b) : d is evaluated at 5 bits → 01000", () => {
    const decls = [d("a", "logic", 4, "9"), d("b", "logic", 4, "8"), d("c", "logic", 4, "1"), d("dd", "logic", 5)];
    expect(lit(expr(decls, "c ? (a&b) : dd").value)).toBe("5'b0_1000");
  });

  it("LRM §11.6.3: a*b is self-determined (6 bits), {a**b} is 4 bits, c = a**b is 16 bits", () => {
    const decls = [d("a", "logic", 4, "4'hF"), d("b", "logic", 6, "6'hA")];
    expect(formatHexLiteral(expr(decls, "a*b").value)).toBe("6'h16");
    expect(dec(expr(decls, "{a**b}").value)).toBe("1");
    expect(formatHexLiteral(assign(decls, d("c", "logic", 16), "a**b").final)).toBe("16'hAC61");
  });

  it("concatenation operands are self-determined, so the carry is lost inside {} unless a size cast gives it a context", () => {
    expect(dec(assign(ops, d("y", "logic", 16), "{8'd0, a8 + b8}").final)).toBe("44");
    expect(dec(assign(ops, d("y", "logic", 16), "{7'd0, 9'(a8 + b8)}").final)).toBe("300");
  });
});

describe("§11.3.3 / §11.4.3.1 LRM division examples (literal sign and context)", () => {
  const intA = d("IntA", "int");
  it.each([
    ["-12 / 3", "-4"],
    ["-'d12 / 3", "1431655761"],
    ["-'sd12 / 3", "-4"],
    ["-4'sd12 / 3", "1"],
  ])("IntA = %s → %s", (src, want) => {
    expect(dec(assign([], intA, src).final)).toBe(want);
  });

  it("U = -4'd12 gives 65524 in a 16-bit unsigned U", () => {
    expect(dec(assign([], d("U", "logic", 16), "-4'd12").final)).toBe("65524");
  });
});

describe("§11.7 $signed / $unsigned and §6.24.1 casts (LRM examples)", () => {
  const regA = d("regA", "logic", 8);
  const regS = d("regS", "logic", 8, undefined, true);

  it("regA = $unsigned(-4) → 8'b11111100", () => {
    expect(lit(assign([], regA, "$unsigned(-4)").final)).toBe("8'b1111_1100");
  });
  it("regB = $unsigned(-4'sd4) → 8'b00001100", () => {
    expect(lit(assign([], regA, "$unsigned(-4'sd4)").final)).toBe("8'b0000_1100");
  });
  it("regS = $signed(4'b1100) → -4, and signed'(4'b1100) is the same", () => {
    expect(dec(assign([], regS, "$signed(4'b1100)").final)).toBe("-4");
    expect(dec(assign([], regS, "signed'(4'b1100)").final)).toBe("-4");
    expect(lit(assign([], regA, "unsigned'(-4)").final)).toBe("8'b1111_1100");
  });
  it("a size cast keeps the inner expression's signedness and pads/truncates to N bits", () => {
    const decls = [d("x", "logic", 8, "8'd1", true)];
    const r = expr(decls, "17'(x - 2)");
    expect(r.width).toBe(17);
    expect(r.signed).toBe(true);
    expect(dec(r.value)).toBe("-1");
  });
  it("byte'(regA) + byte'(regB) does signed addition (§11.7 example)", () => {
    const decls = [d("ra", "logic", 8, "8'hFF"), d("rb", "logic", 8, "8'hFF")];
    expect(dec(assign(decls, d("s", "logic", 16, undefined, true), "ra + rb").final)).toBe("510");
    expect(dec(assign(decls, d("s", "logic", 16, undefined, true), "byte'(ra) + byte'(rb)").final)).toBe("-2");
  });
});

describe("§10.7 / §11.8.3 assignment truncation and §6.11.2 2-state conversion", () => {
  it("discards the MSBs when the RHS is wider than the LHS", () => {
    const res = assign([], d("a", "logic", 6), "8'hff");
    expect(lit(res.final)).toBe("6'b11_1111");
    const step = res.steps.find((s) => s.kind === "assign");
    expect(step && step.kind === "assign" && step.dropped).toBe(2);
  });
  it("truncating the sign bit can change the sign: 8'sd200-ish to 5 bits", () => {
    expect(dec(assign([], d("b", "logic", 5, undefined, true), "8'hff").final)).toBe("-1");
    expect(dec(assign([], d("b", "logic", 5, undefined, true), "8'h0f").final)).toBe("15");
  });
  it("x/z bits become 0 in a 2-state target", () => {
    const p = [d("p", "logic", 4, "4'b10x1"), d("q", "logic", 4, "4'd1")];
    const res = assign(p, d("r", "bit", 4), "p + q");
    expect(lit(res.final)).toBe("4'b0000");
    const step = res.steps.find((s) => s.kind === "assign");
    expect(step && step.kind === "assign" && step.xToZero).toBe(true);
  });
});

// ---- four-state operators -------------------------------------------------

describe("§11.4.3 x/z in arithmetic poison the whole result", () => {
  const p = [d("p", "logic", 4, "4'b10x1"), d("q", "logic", 4, "4'd1")];

  it("p + q with one x bit is 4'bxxxx", () => {
    expect(lit(assign(p, d("r", "logic", 4), "p + q").final)).toBe("4'bxxxx");
  });
  it("division by zero is x", () => {
    expect(lit(expr([d("v", "logic", 4, "4'd8")], "v / 4'd0").value)).toBe("4'bxxxx");
  });
  it("bitwise operators are per bit, so only reachable bits become x (contrast)", () => {
    expect(lit(expr(p, "p | q").value)).toBe("4'b10x1");
    expect(lit(expr(p, "p & 4'b0000").value)).toBe("4'b0000");
  });
  it("§11.8.4: sign-extending a signed value whose sign bit is x fills with x", () => {
    const s = [d("s", "logic", 4, "4'bx001", true)];
    expect(lit(assign(s, d("w", "logic", 8, undefined, true), "s").final)).toBe("8'bxxxx_x001");
  });
});

describe("§11.4.8 bitwise truth tables (Tables 11-11 … 11-15)", () => {
  const B: Bit4[] = ["0", "1", "x", "z"];
  const table = (op: "&" | "|" | "^" | "~^") => B.map((a) => B.map((b) => bitwiseBit(op, a, b)).join("")).join(" ");
  it("AND", () => expect(table("&")).toBe("0000 01xx 0xxx 0xxx"));
  it("OR", () => expect(table("|")).toBe("01xx 1111 x1xx x1xx"));
  it("XOR", () => expect(table("^")).toBe("01xx 10xx xxxx xxxx"));
  it("XNOR", () => expect(table("~^")).toBe("10xx 01xx xxxx xxxx"));
  it("NOT", () => expect(B.map(notBit).join("")).toBe("10xx"));
});

describe("§11.4.9 reduction operators (Table 11-19 and x handling)", () => {
  const run = (bits: string, op: string) => dec(expr([d("v", "logic", 4, `4'b${bits}`)], `${op}v`).value);
  it.each([
    ["0000", ["0", "1", "0", "1", "0", "1"]],
    ["1111", ["1", "0", "1", "0", "0", "1"]],
    ["0110", ["0", "1", "1", "0", "0", "1"]],
    ["1000", ["0", "1", "1", "0", "1", "0"]],
  ])("Table 11-19 row %s", (bits, want) => {
    expect(["&", "~&", "|", "~|", "^", "~^"].map((op) => run(bits, op))).toEqual(want);
  });
  it("a single 0 decides reduction AND even with x elsewhere; otherwise x", () => {
    expect(run("0x11", "&")).toBe("0");
    expect(run("1x11", "&")).toBe("x");
    expect(run("1x00", "|")).toBe("1");
    expect(run("0x00", "|")).toBe("x");
    expect(run("1z00", "^")).toBe("x");
  });
  it("the fold applies the table bit by bit and ~ inverts at the end", () => {
    const fold = reductionFold("~&", fromBits(["1", "1", "0", "1"]));
    expect(fold.steps.map((s) => s.result)).toEqual(["1", "0", "0"]);
    expect(fold.base).toBe("0");
    expect(fold.result).toBe("1");
  });
  it("binary ~& does not exist (Table 11-1): a ~& b is a syntax error", () => {
    const r = evaluateExpression("a ~& b", buildEnv([d("a", "logic", 4, "4'd3"), d("b", "logic", 4, "4'd5")]));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("binary-reduction-operator");
    // The real bitwise NAND is ~(a & b), and the binary XNOR ~^ does exist.
    expect(evaluateExpression("~(a & b)", buildEnv([d("a", "logic", 4, "4'd3"), d("b", "logic", 4, "4'd5")])).ok).toBe(true);
    expect(evaluateExpression("a ~^ b", buildEnv([d("a", "logic", 4, "4'd3"), d("b", "logic", 4, "4'd5")])).ok).toBe(true);
  });
});

describe("§11.4.7 logical operators", () => {
  it("LRM example: alpha = 237, beta = 0 → && is 0, || is 1", () => {
    const decls = [d("alpha", "int", undefined, "237"), d("beta", "int", undefined, "0")];
    expect(dec(expr(decls, "alpha && beta").value)).toBe("0");
    expect(dec(expr(decls, "alpha || beta").value)).toBe("1");
  });
  it("an operand with no 1 bit but some x is unknown; a known 1 bit makes it true", () => {
    const decls = [d("v", "logic", 4, "4'b0x00"), d("t", "logic", 4, "4'b1x00"), d("z0", "logic", 4, "4'd0")];
    expect(dec(expr(decls, "!v").value)).toBe("x");
    expect(dec(expr(decls, "!t").value)).toBe("0");
    expect(dec(expr(decls, "v && z0").value)).toBe("0");
    expect(dec(expr(decls, "v || t").value)).toBe("1");
  });
});

describe("§11.4.5 / §11.4.6 equality: ==, === and ==?", () => {
  const v = (bits: string) => fromBits(bits.split("") as Bit4[]);
  it("== gives x when x/z make it ambiguous, 0 when a known bit differs", () => {
    expect(equalityFamily(v("1x00"), v("1x00")).logical).toBe("x");
    expect(equalityFamily(v("1x00"), v("0000")).logical).toBe("0");
  });
  it("=== compares x and z as values and never gives x", () => {
    expect(equalityFamily(v("1x00"), v("1x00")).caseEq).toBe("1");
    expect(equalityFamily(v("10z1"), v("10x1")).caseEq).toBe("0");
  });
  it("==? treats x/z in the RIGHT operand as wildcards, not those in the left", () => {
    expect(equalityFamily(v("1010"), v("1x1z")).wildcard).toBe("1");
    expect(equalityFamily(v("1x10"), v("1010")).wildcard).toBe("x");
    expect(equalityFamily(v("1x10"), v("0x1x")).wildcard).toBe("0");
  });
});

describe("§11.4.13 inside uses ==? (wildcards), not ===", () => {
  const env = (a: string) => buildEnv([d("val", "logic", 3, a)]);
  it("LRM: val inside {3'b1?1} matches 3'b101, 3'b111, 3'b1x1 and 3'b1z1", () => {
    for (const a of ["3'b101", "3'b111", "3'b1x1", "3'b1z1"]) {
      const r = evaluateExpression("val inside {3'b1?1}", env(a));
      expect(r.ok && dec(r.value)).toBe("1");
    }
  });
  it("LRM: 3'bz11 inside {3'b1?1, 3'b011} is 1'bx", () => {
    const r = evaluateExpression("val inside {3'b1?1, 3'b011}", env("3'bz11"));
    expect(r.ok && dec(r.value)).toBe("x");
  });
  it("a member with x bits matches where === would not", () => {
    const det = insideDetail(fromBits(["1", "0", "1", "0"]), [fromBits(["1", "x", "1", "x"])]);
    expect(det.result).toBe("1");
    expect(det.ifCaseEquality).toBe("0");
  });
  it("ranges are inclusive: bit ba = a inside {[16:23], [32:47]}", () => {
    const at = (n: number) => {
      const r = evaluateExpression("a inside {[16:23], [32:47]}", buildEnv([d("a", "int", undefined, String(n))]));
      return r.ok && dec(r.value);
    };
    expect([15, 16, 23, 24, 32, 47, 48].map(at)).toEqual(["0", "1", "1", "0", "1", "1", "0"]);
  });
});

describe("§11.4.12 concatenation and replication", () => {
  it("joins self-determined operands MSB first; the result is unsigned", () => {
    const r = expr([a4, d("b", "logic", 2, "2'b01")], "{a, b}");
    expect(lit(r.value)).toBe("6'b11_0001");
    expect(r.signed).toBe(false);
  });
  it("unsized numbers are illegal in a concatenation", () => {
    const r = evaluateExpression("{a, 1}", buildEnv([a4]));
    expect(!r.ok && r.error.code).toBe("unsized-in-concatenation");
  });
  it("§11.4.12.1: {b,{3{a,b}}} is {b,a,b,a,b,a,b}", () => {
    const decls = [d("a", "logic", 1, "1'b1"), d("b", "logic", 1, "1'b0")];
    expect(lit(expr(decls, "{b,{3{a,b}}}").value)).toBe("7'b010_1010");
  });
});

describe("§11.4.14 streaming operators", () => {
  const s = (src: string) => expr([], src).value;
  it("{<<{16'hA55A}} bit-reverses to 16'h5AA5", () => {
    expect(formatHexLiteral(s("{<<{16'hA55A}}"))).toBe("16'h5AA5");
  });
  it("LRM examples: bit reverse, slices of 4 with a short last block, >> unchanged, nested", () => {
    expect(lit(s("{ << { 8'b0011_0101 }}"))).toBe("8'b1010_1100");
    expect(lit(s("{ << 4 { 6'b11_0101 }}"))).toBe("6'b01_0111");
    expect(lit(s("{ >> 4 { 6'b11_0101 }}"))).toBe("6'b11_0101");
    expect(lit(s("{ << 2 { { << { 4'b1101 }} }}"))).toBe("4'b1110");
  });
  it("slice size distinguishes bit reversal, nibble reversal and byte swap", () => {
    expect(formatHexLiteral(s("{<<{16'h1234}}"))).toBe("16'h2C48");
    expect(formatHexLiteral(s("{<< 4 {16'h1234}}"))).toBe("16'h4321");
    expect(formatHexLiteral(s("{<< byte {16'h1234}}"))).toBe("16'h3412");
  });
  it("a wider target left-aligns the stream (zero fill on the RIGHT); a narrower one is an error", () => {
    expect(formatHexLiteral(assign([], d("y", "logic", 32), "{<<{16'hA55A}}").final)).toBe("32'h5AA5_0000");
    const narrow = evaluateAssignment([], d("y", "logic", 8), "{<<{16'hA55A}}");
    expect(!narrow.ok && narrow.error.code).toBe("stream-wider-than-target");
  });
  it("a stream cannot be an operand of another operator without a cast", () => {
    const r = evaluateExpression("{<<{4'b0001}} + 1", buildEnv([]));
    expect(!r.ok && r.error.code).toBe("stream-in-expression");
  });
  it("streamBlocks slices from the right and reverses block order", () => {
    const { input, output } = streamBlocks(["1", "1", "0", "1", "0", "1"], "<<", 4);
    expect(input.map((b) => b.join(""))).toEqual(["11", "0101"]);
    expect(output.map((b) => b.join(""))).toEqual(["0101", "11"]);
  });
});

describe("parser precedence (Table 11-2)", () => {
  const decls = [d("a", "logic", 4, "4'd1"), d("b", "logic", 4, "4'd2"), d("c", "logic", 4, "4'd3")];
  it("+ binds tighter than <<, which binds tighter than <", () => {
    expect(dec(expr(decls, "a + b << 1").value)).toBe("6");
    expect(dec(expr(decls, "a < b + c").value)).toBe("1");
  });
  it("& binds tighter than |, and ?: is lowest and right-associative", () => {
    expect(dec(expr(decls, "a | b & c").value)).toBe("3");
    expect(dec(expr(decls, "a ? b : c ? a : c").value)).toBe("2");
  });
});

// ---- misconception models and prediction options ---------------------------

describe("misconception models", () => {
  it("ordinary integer math gives the answer most learners expect (6 for a + u)", () => {
    expect(mathIntuition("a + u", buildEnv([a4, u8]))?.toString()).toBe("6");
    expect(mathIntuition("a > 4'd0", buildEnv([a4]))?.toString()).toBe("0");
  });
  it("optimistic X keeps the bits an x cannot reach (contrast with the LRM's all-x)", () => {
    const p = [d("p", "logic", 4, "4'b10x1"), d("q", "logic", 4, "4'd1")];
    const v = optimisticX(p, d("r", "logic", 4), "p + q");
    expect(v && lit(v)).toBe("4'b1xx0");
  });
  it("trap options contain exactly one correct answer, which matches the model", () => {
    for (const sc of trapScenarios) {
      for (const variant of sc.variants) {
        const target = variant.target ?? sc.target;
        const options = trapPredictionOptions(sc.decls, target, variant.expr);
        const res = assign(sc.decls, target, variant.expr);
        expect(options.filter((o) => o.correct)).toHaveLength(1);
        expect(options.length).toBeGreaterThanOrEqual(2);
        expect(options.find((o) => o.correct)?.label).toContain(res.final.width === 1 ? dec(res.final) : "=");
        expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
      }
    }
  });
  it("the a + u options diagnose the ordinary-math answer", () => {
    const options = trapPredictionOptions([a4, u8], d("r", "logic", 8, undefined, true), "a + u");
    const math = options.find((o) => o.label === "r = 6");
    expect(math?.correct).toBe(false);
    expect(math?.feedback).toMatch(/ordinary integer math/);
    expect(options.find((o) => o.correct)?.label).toBe("r = 22");
  });
  it("the 8-bit carry options include the unrepresentable 300 and a saturation guess", () => {
    const ops = [d("a8", "logic", 8, "8'd200"), d("b8", "logic", 8, "8'd100")];
    const labels = trapPredictionOptions(ops, d("s", "logic", 8), "a8 + b8").map((o) => o.label);
    expect(labels).toEqual(expect.arrayContaining(["s = 44", "s = 255", "s = 300"]));
  });
});

describe("operator explorer catalog", () => {
  const inputs = (a: string, b = "0000", c = "0000", n = "001", signedA = false): OperatorInputs => ({
    a: a.split("") as Bit4[],
    b: b.split("") as Bit4[],
    c: c.split("") as Bit4[],
    n: n.split("") as Bit4[],
    signedA,
  });
  const spec = (id: string) => operatorCatalog.find((s) => s.id === id)!;

  it("every catalog template parses and evaluates (except the deliberate traps)", () => {
    for (const s of operatorCatalog) {
      const width = s.family === "stream" ? 16 : 4;
      const r = runOperator(s, inputs("1010".padStart(width, "0"), "0110", "1x1x"));
      expect(r.ok).toBe(!s.id.match(/binary-nand|concat-unsized/));
    }
  });
  it("the binary ~& trap's correct option is the compile error", () => {
    const opts = operatorPredictionOptions(spec("binary-nand"), inputs("0011", "0101"));
    expect(opts.find((o) => o.correct)?.label).toBe("Compile error");
    expect(opts.length).toBeGreaterThanOrEqual(3);
  });
  it("inside with an x in the member matches, and the options call out case equality", () => {
    const opts = operatorPredictionOptions(spec("inside"), inputs("1010", "1x1x", "0000"));
    expect(opts.find((o) => o.correct)?.label).toBe("1'b1");
    expect(opts.find((o) => o.correct)?.feedback).toMatch(/With === you would get 0/);
  });
  it("streaming 16'hA55A: the correct option is 16'h5AA5 and 'unchanged' is a diagnosed distractor", () => {
    const a = parseLiteral("16'hA55A").value;
    const opts = operatorPredictionOptions(spec("stream-bits"), { ...inputs("0"), a: bitsOf(a) });
    expect(opts.find((o) => o.correct)?.label).toBe("16'h5AA5");
    expect(opts.find((o) => o.label === "16'hA55A")?.feedback).toMatch(/unchanged/);
  });
  it(">> on a signed operand: the sign-filled answer is a distractor", () => {
    const opts = operatorPredictionOptions(spec("shr"), inputs("1000", "0000", "0000", "010", true));
    expect(opts.find((o) => o.correct)?.label).toBe("4'b0010");
    expect(opts.find((o) => o.label === "4'b1110")?.correct).toBe(false);
  });
  it("bitwise & with an x: correct keeps the 0-decided bits, 'all x' is the arithmetic-rule distractor", () => {
    const opts = operatorPredictionOptions(spec("and"), inputs("1x10", "0110"));
    expect(opts.find((o) => o.correct)?.label).toBe("4'b0x10");
    expect(opts.find((o) => o.label === "4'bxxxx")?.feedback).toMatch(/arithmetic rule/);
  });
});

// ---- expression-lab extensions ------------------------------------------------

describe("§5.7.1 unbased unsized fill literals '0 '1 'x 'z", () => {
  it("fill every bit of the containing expression: '1 into a 16-bit variable is 16'hFFFF (LRM example 5)", () => {
    expect(formatHexLiteral({ ...assign([], d("w", "logic", 16), "'1").final, signed: false })).toBe("16'hFFFF");
    expect(lit(assign([], d("w", "logic", 4), "'z").final)).toBe("4'bzzzz");
    expect(lit(assign([], d("w", "logic", 4), "'x").final)).toBe("4'bxxxx");
    expect(dec(assign([], d("w", "logic", 8), "'0").final)).toBe("0");
  });
  it("are 1 bit wide and unsigned when self-determined", () => {
    const { value, sized, fill } = parseLiteral("'1");
    expect([value.width, value.signed, sized, fill]).toEqual([1, false, false, "1"]);
    expect(expr([], "'1").width).toBe(1);
    expect(expr([], "'z").value.width).toBe(1);
  });
  it("take the width of the other operand in a comparison: data == '1 compares against 4'b1111", () => {
    const data = d("data", "logic", 4, "4'b1010");
    expect(dec(expr([data], "data == '1").value)).toBe("0");
    expect(dec(expr([d("f", "logic", 4, "4'b1111")], "f == '1").value)).toBe("1");
  });
  it("are unsized, so they are illegal inside a concatenation (§11.4.12)", () => {
    const r = evaluateExpression("{data, '1}", buildEnv([d("data", "logic", 4, "4'b1010")]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsized-in-concatenation");
  });
  it("the ?: else branch 'z fills the context: en ? data : 'z with en = x is all x (Table 11-20)", () => {
    const env = [d("en", "logic", 1, "1'bx"), d("data", "logic", 4, "4'b1010")];
    expect(lit(assign(env, d("bus", "logic", 4), "en ? data : 'z").final)).toBe("4'bxxxx");
    expect(lit(assign([d("en", "logic", 1, "1'b0"), env[1]], d("bus", "logic", 4), "en ? data : 'z").final)).toBe("4'bzzzz");
  });
  it("records a fill step in the trace", () => {
    const r = assign([], d("w", "logic", 8), "'1");
    const fill = r.steps.find((s) => s.kind === "extend" && s.mode === "fill");
    expect(fill).toBeDefined();
    expect(fill?.clause).toBe("§5.7.1");
  });
});

describe("§5.7.1 x/z-led unsized literals pad to the containing expression (LRM example 4)", () => {
  it("'hx assigned to an 85-bit variable gives 85 x bits; 'hz gives 85 z bits", () => {
    const e = assign([], d("e", "logic", 85), "'hx").final;
    expect(e.width).toBe(85);
    expect(bitsOf(e).every((b) => b === "x")).toBe(true);
    expect(bitsOf(assign([], d("g", "logic", 85), "'hz").final).every((b) => b === "z")).toBe(true);
  });
  it("'h5 into 85 bits pads with 0 (only an x/z leftmost digit pads with x/z)", () => {
    expect(dec(assign([], d("e", "logic", 85), "'h5").final)).toBe("5");
  });
  it("'h3x into 12 bits is 03x and 'hz3 is zz3", () => {
    expect(formatHexLiteral({ ...assign([], d("b", "logic", 12), "'h3x").final, signed: false })).toBe("12'h03x");
    expect(formatHexLiteral({ ...assign([], d("c", "logic", 12), "'hz3").final, signed: false })).toBe("12'hzz3");
  });
  it("parseLiteral reports the padding digit for unsized x/z-led literals only", () => {
    expect(parseLiteral("'hx").pad).toBe("x");
    expect(parseLiteral("'hz3").pad).toBe("z");
    expect(parseLiteral("12'hx").pad).toBeUndefined();
    expect(parseLiteral("'h3x").pad).toBeUndefined();
  });
});

describe("§11.4.11 conditional operator: Table 11-20 merge for an x/z condition", () => {
  const B4: Bit4[] = ["0", "1", "x", "z"];
  it("Table 11-20: only 0?0 and 1?1 survive; every other pair, including x?x and z?z, is x", () => {
    const table = B4.map((t) => B4.map((e) => conditionalMergeBit(t, e)).join("")).join(" ");
    expect(table).toBe("0xxx x1xx xxxx xxxx");
  });
  it("sel = x: 4'b1100 vs 4'b1010 merges to 4'b1xx0; if/else stores 4'b1010 (§12.4)", () => {
    const det = conditionalDetail(fromBits(["x"]), parseLiteral("4'b1100").value, parseLiteral("4'b1010").value);
    expect(det.truth).toBe("x");
    expect(det.merged).toBe(true);
    expect(lit(det.result)).toBe("4'b1xx0");
    expect(lit(det.ifElse)).toBe("4'b1010");
    expect(det.ifTakes).toBe("else");
    expect(det.rows.map((r) => `${r.index}:${r.then}${r.otherwise}=${r.cell}`)).toEqual(["3:11=1", "2:10=x", "1:01=x", "0:00=0"]);
  });
  it("equal known branches are logically equivalent (§11.4.5), so no x appears", () => {
    const det = conditionalDetail(fromBits(["x"]), parseLiteral("4'b1010").value, parseLiteral("4'b1010").value);
    expect(det.equivalent).toBe("1");
    expect(det.merged).toBe(false);
    expect(lit(det.result)).toBe("4'b1010");
  });
  it("a known condition returns one branch unchanged, even with x bits in it", () => {
    const det = conditionalDetail(fromBits(["1"]), parseLiteral("4'b1x00").value, parseLiteral("4'b0000").value);
    expect(lit(det.result)).toBe("4'b1x00");
    expect(det.ifTakes).toBe("then");
  });
  it("the evaluator agrees and names the rule: agree on 0 or 1", () => {
    const env = [d("sel", "logic", 1, "1'bx"), d("a", "logic", 4, "4'b1100"), d("b", "logic", 4, "4'b1010")];
    const r = assign(env, d("y", "logic", 4), "sel ? a : b");
    expect(lit(r.final)).toBe("4'b1xx0");
    const op = r.steps.find((s) => s.kind === "op" && s.op === "?:");
    expect(op?.why).toMatch(/agree on 0 or 1/);
    expect(op?.clause).toBe("§11.4.11");
  });
});

describe("§20.9 bit vector system functions", () => {
  const v = (s: string) => fromBits(s.split("") as Bit4[]);
  it("$countbits counts the bits matching any control value; x and z never match '1", () => {
    expect(countbits(v("01x0"), "1")).toBe(1);
    expect(countbits(v("01x0"), "x", "z")).toBe(1);
    expect(countbits(v("01x0"), "1", "0")).toBe(3);
    expect(countbits(v("z1x0"), "1", "1", "x")).toBe(2); // a repeated control counts once
  });
  it("$countones, $onehot, $onehot0, $isunknown on the four presets", () => {
    const row = (s: string) => [countones(v(s)), onehot(v(s)), onehot0(v(s)), isunknown(v(s))];
    expect(row("0100")).toEqual([1, true, true, false]);
    expect(row("0110")).toEqual([2, false, false, false]);
    expect(row("01x0")).toEqual([1, true, true, true]); // $onehot passes with an x
    expect(row("xxxx")).toEqual([0, false, true, true]); // before reset: $onehot0 passes
  });
  it("return types: $countones is int (32 bits, signed); the three tests are bit (1 bit, unsigned, never x)", () => {
    const state = [d("state", "logic", 4, "4'b01x0")];
    const ones = expr(state, "$countones(state)");
    expect([ones.width, ones.signed, dec(ones.value)]).toEqual([32, true, "1"]);
    for (const fn of ["$onehot", "$onehot0", "$isunknown"]) {
      const r = expr(state, `${fn}(state)`);
      expect([r.width, r.signed]).toEqual([1, false]);
      expect(["0", "1"]).toContain(dec(r.value));
    }
    expect(dec(expr(state, "$countbits(state, 'x, 'z)").value)).toBe("1");
  });
  it("$countbits reads a wider control value at its LSB", () => {
    expect(dec(expr([d("state", "logic", 4, "4'b0110")], "$countbits(state, 2'b01)").value)).toBe("2");
  });
  it("$onehot(state) && !$isunknown(state) rejects 01x0, which $onehot alone accepts", () => {
    expect(dec(expr([d("state", "logic", 4, "4'b01x0")], "$onehot(state) && !$isunknown(state)").value)).toBe("0");
    expect(dec(expr([d("state", "logic", 4, "4'b0100")], "$onehot(state) && !$isunknown(state)").value)).toBe("1");
  });
  it("the report spells out the $countbits arithmetic for each function", () => {
    const rep = bitVectorReport(v("01x0"), "state");
    expect(rep.map((r) => `${r.fn}=${r.result}`)).toEqual(["$countones=1", "$onehot=1'b1", "$onehot0=1'b1", "$isunknown=1'b1"]);
    expect(rep[1].arithmetic).toBe("$countbits(state, '1) = 1, and 1 == 1 is true");
    expect(rep.map((r) => r.returnType)).toEqual(["int", "bit", "bit", "bit"]);
  });
});

describe("§11.4.12 concatenation as an assignment target and §11.4.12.1 replication", () => {
  it("{hi, lo} = 16'hBEEF splits by member width, MSB first: hi = 8'hBE, lo = 8'hEF", () => {
    const s = splitConcatTarget([{ name: "hi", width: 8 }, { name: "lo", width: 8 }], parseLiteral("16'hBEEF").value);
    expect(s.total).toBe(16);
    expect(s.parts.map((p) => `${p.name}[${p.hi}:${p.lo}]=${formatHexLiteral({ ...p.value, signed: false })}`)).toEqual(["hi[15:8]=8'hBE", "lo[7:0]=8'hEF"]);
    expect([s.dropped, s.extended]).toEqual([0, 0]);
  });
  it("a narrower unsigned RHS is zero-extended and a wider one loses its MSBs (§11.8.3, §10.7)", () => {
    const narrow = splitConcatTarget([{ name: "c", width: 1 }, { name: "s", width: 4 }], parseLiteral("4'b1111").value);
    expect(narrow.parts.map((p) => lit(p.value))).toEqual(["1'b0", "4'b1111"]);
    expect(narrow.extended).toBe(1);
    const wide = splitConcatTarget([{ name: "a", width: 4 }, { name: "b", width: 4 }], parseLiteral("16'hBEEF").value);
    expect(wide.parts.map((p) => lit(p.value))).toEqual(["4'b1110", "4'b1111"]);
    expect(wide.dropped).toBe(8);
  });
  it("hand sign-extension {{4{n[3]}}, n} with n = 4'b1010 is 8'hFA, still -6 when read as signed", () => {
    const r = expr([d("n", "logic", 4, "4'b1010")], "{{4{n[3]}}, n}");
    expect(formatHexLiteral(r.value)).toBe("8'hFA");
    expect(r.signed).toBe(false);
    expect(toBigInt({ ...r.value, signed: true })?.toString()).toBe("-6");
  });
  it("a zero replication alone is illegal; inside a concatenation with a positive-size operand it is ignored", () => {
    const n = [d("n", "logic", 4, "4'b1010")];
    const alone = evaluateExpression("{0{n}}", buildEnv(n));
    expect(alone.ok).toBe(false);
    if (!alone.ok) expect(alone.error.code).toBe("zero-replication-alone");
    expect(lit(expr(n, "{{0{n[3]}}, n}").value)).toBe("4'b1010");
    const twoZero = evaluateExpression("{{0{n}}, {0{n}}}", buildEnv(n));
    expect(twoZero.ok).toBe(false);
  });
  it("{a, 1} stays a compile error: unsized constants are not allowed in a concatenation", () => {
    const r = evaluateExpression("{a, 1}", buildEnv([d("a", "logic", 4, "4'b1100")]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsized-in-concatenation");
  });
});

describe("§6.24.1 cast scenarios", () => {
  const sc = trapScenarios.find((s) => s.id === "casts")!;
  const run = (id: string) => {
    const v = sc.variants.find((x) => x.id === id)!;
    return assign(sc.decls, v.target ?? sc.target, v.expr).final;
  };
  it("8'(12'hABC) keeps the low 8 bits: 8'hBC = 188", () => {
    expect(formatHexLiteral({ ...run("size-cast"), signed: false })).toBe("8'hBC");
    expect(dec(run("size-cast"))).toBe("188");
  });
  it("signed'(4'b1100) and $signed(4'b1100) keep the bits and read them as -4", () => {
    expect(dec(run("sign-cast"))).toBe("-4");
    expect(dec(run("sysfn"))).toBe("-4");
  });
  it("int'(w) zero-extends an unsigned w (240); int'(signed'(w)) sign-extends (-16)", () => {
    expect(dec(run("type-cast"))).toBe("240");
    expect(dec(run("type-cast-signed"))).toBe("-16");
  });
  it("the options diagnose keeping the MSBs (8'hAB) and ignoring the sign cast (12)", () => {
    const size = trapPredictionOptions(sc.decls, sc.target, "8'(12'hABC)");
    expect(size.find((o) => o.label === "v = 171")?.feedback).toMatch(/keeps the top 8 bits/);
    const signCast = sc.variants.find((x) => x.id === "sign-cast")!;
    const sign = trapPredictionOptions(sc.decls, signCast.target!, signCast.expr);
    expect(sign.find((o) => o.label === "v = 12")?.feedback).toMatch(/ignores the cast/);
    const typeCast = sc.variants.find((x) => x.id === "type-cast")!;
    const typed = trapPredictionOptions(sc.decls, typeCast.target!, typeCast.expr);
    expect(typed.find((o) => o.label === "v = -16")?.feedback).toMatch(/sign-extends/);
  });
});

describe("§11.6.1 lost carry: the size-cast fix", () => {
  it("(9'(a8) + b8) >> 1 is 150 because the cast widens the context to 9 bits before the add", () => {
    const sc = trapScenarios.find((s) => s.id === "lost-carry")!;
    const v = sc.variants.find((x) => x.id === "size-cast")!;
    expect(dec(assign(sc.decls, sc.target, v.expr).final)).toBe("150");
    const opts = trapPredictionOptions(sc.decls, sc.target, v.expr);
    expect(opts.find((o) => o.label === "s = 22")?.feedback).toMatch(/ignores the cast/);
  });
});

describe("§11.8.1 part-selects are unsigned", () => {
  const sc = trapScenarios.find((s) => s.id === "part-select")!;
  it("w = sb sign-extends -8; w = sb[7:0] zero-extends to 248; $signed restores -8", () => {
    const vals = sc.variants.map((v) => dec(assign(sc.decls, v.target ?? sc.target, v.expr).final));
    expect(vals).toEqual(["-8", "248", "-8"]);
  });
  it("the -8 distractor for sb[7:0] is diagnosed as treating the part-select as signed", () => {
    const opts = trapPredictionOptions(sc.decls, sc.target, "sb[7:0]");
    expect(opts.find((o) => o.correct)?.label).toBe("w = 248");
    expect(opts.find((o) => o.label === "w = -8")?.feedback).toMatch(/part-select as signed/);
  });
  it("the -8 distractor mentions only what the code does: no >>> on sb[7:0], zero extension only into a wider target", () => {
    const onSelect = trapPredictionOptions(sc.decls, sc.target, "sb[7:0]").find((o) => o.label === "w = -8")?.feedback;
    expect(onSelect).toMatch(/zero-extended/);
    expect(onSelect).not.toMatch(/>>>/);
    const ashr = trapScenarios.find((s) => s.id === "ashr-unsigned-context")!;
    const onShift = trapPredictionOptions(ashr.decls, ashr.target, "s[7:0] >>> 1").find((o) => o.label === "r = -4")?.feedback;
    expect(onShift).toMatch(/part-select as signed/);
    expect(onShift).toMatch(/>>>/);
    expect(onShift).not.toMatch(/zero-extended/);
  });
  it("the insight behind the answer states the §11.8.3 extension, without calling the RHS self-determined", () => {
    const select = assign(sc.decls, sc.target, "sb[7:0]");
    expect(select.insight).toMatch(/part-select is unsigned even when it covers the entire vector \(§11\.8\.1\), so it is zero-extended from 8 to 16 bits/);
    expect(select.insight).toMatch(/which is 248/);
    expect(select.steps.find((s) => s.kind === "extend")?.surprising).toBe(true);
    expect(select.steps.find((s) => s.kind === "context")?.why).toBe("The RHS is 8 bits, unsigned; §11.8.3 extends it to the 16-bit w, with zeros because it is unsigned.");
    const whole = assign(sc.decls, sc.target, "sb");
    expect(whole.insight).toBe("The RHS is 8 bits, signed; §11.8.3 extends it to the 16-bit w, with copies of its sign bit because it is signed.");
    expect(whole.insight).not.toMatch(/self-determined/);
    expect(assign(sc.decls, sc.target, "$signed(sb[7:0])").insight).toMatch(/§11\.8\.3 extends it to the 16-bit w, with copies of its sign bit/);
  });
  it("a select of a signed variable whose top bit is 0 is zero-extended without a trap, because the value does not change", () => {
    const decls = [d("sb", "logic", 8, "8'd5", true)];
    const r = assign(decls, sc.target, "sb[7:0]");
    expect(dec(r.final)).toBe("5");
    expect(r.steps.find((s) => s.kind === "extend")?.surprising).toBe(false);
  });
  it("the wording of a simple RHS follows its width: equal, truncated, and a fill literal", () => {
    const u = [d("u8", "logic", 8, "8'd5")];
    expect(assign(u, d("t", "logic", 8), "u8").steps.find((s) => s.kind === "context")?.why).toBe("The RHS is 8 bits, unsigned, the same width as the 8-bit t.");
    expect(assign(u, d("t", "logic", 4), "u8").steps.find((s) => s.kind === "context")?.why).toBe("The RHS is 8 bits, unsigned; the 4-bit t keeps only its low 4 bits (§10.7).");
    expect(assign(u, d("t", "logic", 8), "'1").steps.find((s) => s.kind === "context")?.why).toBe("`'1` is 1 bit on its own, but §5.7.1 extends it with its own digit (1) to the 8-bit t.");
  });
});

describe("scenario text never answers the prediction", () => {
  const leaks: Record<string, RegExp> = {
    casts: /pads|truncat|keeps the|changes how|behaves like/i,
    "part-select": /unsigned|zero-extend|does not help/i,
    "literal-sign": /unsigned|signed;|carries an s/i,
  };
  for (const [id, leak] of Object.entries(leaks)) {
    it(`${id}: the title and summary hold no rule; the rule field does`, () => {
      const sc = trapScenarios.find((s) => s.id === id)!;
      expect(sc.title).not.toMatch(leak);
      expect(sc.summary).not.toMatch(leak);
      expect(sc.rule).toMatch(/§/);
    });
  }
});

describe("§11.3.3 literal signedness scenario", () => {
  const sc = trapScenarios.find((s) => s.id === "literal-sign")!;
  it("reproduces the LRM's four results: -4, 1431655761, -4, 1", () => {
    expect(sc.variants.map((v) => dec(assign(sc.decls, sc.target, v.expr).final))).toEqual(["-4", "1431655761", "-4", "1"]);
  });
  it("-4'sd12 / 3: the -4 distractor is diagnosed as reading the sized literal by its digits", () => {
    const opts = trapPredictionOptions(sc.decls, sc.target, "-4'sd12 / 3");
    expect(opts.find((o) => o.correct)?.label).toBe("q = 1");
    expect(opts.find((o) => o.label === "q = -4")?.feedback).toMatch(/by its digits/);
  });
});

describe("expressionIdentifiers: the variables a code variant reads", () => {
  it("lists ref and select names once, in source order, and nothing for literal-only expressions", () => {
    expect([...expressionIdentifiers("int'(w)")]).toEqual(["w"]);
    expect([...expressionIdentifiers("int'(signed'(w))")]).toEqual(["w"]);
    expect([...expressionIdentifiers("8'(12'hABC)")]).toEqual([]);
    expect([...expressionIdentifiers("signed'(4'b1100)")]).toEqual([]);
    expect([...expressionIdentifiers("$signed(4'b1100)")]).toEqual([]);
    expect([...expressionIdentifiers("$signed(sb[7:0])")]).toEqual(["sb"]);
    expect([...expressionIdentifiers("(s >>> 1) + u")]).toEqual(["s", "u"]);
    expect([...expressionIdentifiers("s[7:0] >>> 1")]).toEqual(["s"]);
    expect([...expressionIdentifiers("c ? a : {2{b}}")]).toEqual(["c", "a", "b"]);
    expect([...expressionIdentifiers("a inside {b, [c:d]}")]).toEqual(["a", "b", "c", "d"]);
  });
  it("falls back to an identifier scan when the expression does not parse, so an editor is shown rather than hidden", () => {
    expect([...expressionIdentifiers("a ~& b")]).toEqual(["a", "b"]);
  });
});

describe("§11.4.10 >>> inside an unsigned context", () => {
  const sc = trapScenarios.find((s) => s.id === "ashr-unsigned-context")!;
  it("with the lesson's s = -8: (s >>> 1) + u fills with 0 (125); + $signed(u) keeps the sign (-3); s[7:0] >>> 1 is 8'h7C (124)", () => {
    expect(sc.decls.find((x) => x.name === "s")?.init).toBe("-8");
    expect(sc.variants.map((v) => dec(assign(sc.decls, v.target ?? sc.target, v.expr).final))).toEqual(["125", "-3", "124"]);
    const select = assign(sc.decls, sc.target, "s[7:0] >>> 1").final;
    expect(formatHexLiteral({ ...select, signed: false })).toBe("8'h7C");
  });
  it("the trace marks the >>> step as the surprise and names the zero fill", () => {
    const r = assign(sc.decls, sc.target, "(s >>> 1) + u");
    const shift = r.steps.find((s) => s.kind === "op" && s.op === ">>>");
    expect(shift?.surprising).toBe(true);
    expect(shift?.why).toMatch(/unsigned expression fills with 0/);
  });
});

describe("intendedValue reads a literal as written", () => {
  const sc = trapScenarios.find((s) => s.id === "literal-sign")!;
  it("-4'sd12 / 3 means -4 even though it evaluates to 1 (§11.3.3), so the variant is a mismatch", () => {
    expect(intendedValue(sc.decls, "-4'sd12 / 3")).toBe(BigInt(-4));
    expect(dec(assign(sc.decls, sc.target, "-4'sd12 / 3").final)).toBe("1");
  });
  it("the other spellings keep their ordinary-math intent", () => {
    for (const expr of ["-12 / 3", "-'d12 / 3", "-'sd12 / 3"]) expect(intendedValue(sc.decls, expr)).toBe(BigInt(-4));
  });
});

describe("annotateTree: per-node value, width, signedness and role", () => {
  const env = buildEnv([d("s", "logic", 8, "-16", true), d("u", "logic", 8, "8'd1")]);
  const flat = (n: NodeAnnotation): NodeAnnotation[] => [n, ...n.children.flatMap(flat)];
  it("(s >>> 1) + u into an 8-bit target: the context is 8 bits unsigned, the shift count is self-determined", () => {
    const root = annotateTree(parseExpression("(s >>> 1) + u"), env, 8);
    expect([root.width, root.signed, root.role, lit(root.value)]).toEqual([8, false, "context", "8'b0111_1001"]);
    const nodes = flat(root);
    const s = nodes.find((n) => n.text === "s")!;
    expect([s.selfWidth, s.selfSigned, s.width, s.signed, s.role]).toEqual([8, true, 8, false, "context"]);
    expect(s.operand?.kind).toBe("variable");
    const one = nodes.find((n) => n.text === "1")!;
    expect([one.selfWidth, one.selfSigned, one.role]).toEqual([32, true, "self"]);
    expect(one.operand?.kind).toBe("literal");
    expect(nodes.map((n) => n.id)).toEqual(["r", "r.0", "r.0.0", "r.0.0.0", "r.0.0.1", "r.1"]);
  });
  it("the LHS widens the context (§11.6.1): s + u into 16 bits evaluates the operands at 16 bits", () => {
    const root = annotateTree(parseExpression("s + u"), env, 16);
    expect(root.width).toBe(16);
    expect(root.children.every((c) => c.width === 16 && c.role === "context")).toBe(true);
  });
  it("comparison operands get the compare role at max(widths); a cast argument gets the cast role", () => {
    const cmp = annotateTree(parseExpression("s < u"), env);
    expect([cmp.width, cmp.signed]).toEqual([1, false]);
    expect(cmp.children.map((c) => [c.role, c.width, c.signed])).toEqual([["compare", 8, false], ["compare", 8, false]]);
    const cast = annotateTree(parseExpression("int'(s)"), env);
    expect([cast.width, cast.signed]).toEqual([32, true]);
    expect(cast.children[0].role).toBe("cast");
    expect(cast.children[0].width).toBe(32);
    expect(annotateTree(parseExpression("$signed(u)"), env).children[0].role).toBe("self");
  });
  it("a fill literal in a branch shows its context value", () => {
    const e = buildEnv([d("en", "logic", 1, "1'bx"), d("data", "logic", 4, "4'b1010")]);
    const root = annotateTree(parseExpression("en ? data : 'z"), e, 4);
    const z = flat(root).find((n) => n.text === "'z")!;
    expect([z.selfWidth, z.width, lit(z.value)]).toEqual([1, 4, "4'bzzzz"]);
    expect(flat(root).find((n) => n.text === "en")?.role).toBe("self");
  });
  it("throws for an undeclared identifier", () => {
    expect(() => annotateTree(parseExpression("q + 1"), env)).toThrow(/not declared/);
  });
  it("§11.4.12.1: a zero replication inside a concatenation is a zero-width node, not an error", () => {
    const e = buildEnv([d("a", "logic", 4, "4'b1010"), d("b", "logic", 4, "4'b0110")]);
    for (const src of ["{{0{a}}, b}", "{({0{a}}), b}"]) {
      const root = annotateTree(parseExpression(src), e);
      expect([root.width, lit(root.value)]).toEqual([4, "4'b0110"]);
      const zero = root.children[0];
      expect([zero.selfWidth, zero.width, zero.value.width, zero.role, zero.children]).toEqual([0, 0, 0, "self", []]);
      expect(lit(root.children[1].value)).toBe("4'b0110");
    }
    const hand = annotateTree(parseExpression("{{0{a[3]}}, a}"), e);
    expect(hand.children.map((c) => c.width)).toEqual([0, 4]);
  });
  it("a zero replication with no sized partner still throws, as it does when evaluated", () => {
    const e = buildEnv([d("a", "logic", 4, "4'b1010"), d("b", "logic", 4, "4'b0110")]);
    for (const src of ["{0{a}}", "{{0{a}}}", "{{0{a}}, {0{b}}}"]) expect(() => annotateTree(parseExpression(src), e)).toThrow(/size|zero/);
  });
});

describe("operator explorer: conditional, bitcount and concat additions", () => {
  const inputs = (a: string, b = "0000", c = "0000", n = "001", signedA = false): OperatorInputs => ({
    a: a.split("") as Bit4[],
    b: b.split("") as Bit4[],
    c: c.split("") as Bit4[],
    n: n.split("") as Bit4[],
    signedA,
  });
  const spec = (id: string) => operatorCatalog.find((s) => s.id === id)!;
  const withDefaults = (id: string, extra: Partial<OperatorInputs> = {}) => ({ ...inputs("1010", "0110", "x"), ...(spec(id).defaults ?? {}), ...extra }) as OperatorInputs;

  it("the family list keeps Streaming last and adds ?: and $countbits", () => {
    expect(operatorFamilies[operatorFamilies.length - 1].id).toBe("stream");
    expect(operatorFamilies.map((f) => f.id)).toEqual(expect.arrayContaining(["conditional", "bitcount"]));
  });
  it("every preset names an existing operator of its family", () => {
    for (const p of operatorPresets) {
      const s = spec(p.specId);
      expect(s).toBeDefined();
      expect(s.family).toBe(p.family);
      expect(runOperator(s, { ...withDefaults(p.specId), ...p.inputs }).ok).toBe(s.id !== "concat-unsized");
    }
  });
  it("the ?: condition is named sel in the template, the declarations and the presets", () => {
    expect(operatorTemplate(spec("cond"), {})).toBe("sel ? a : b");
    expect(operatorDecls(spec("cond"), withDefaults("cond")).map((x) => x.name)).toEqual(["sel", "a", "b"]);
    for (const p of operatorPresets.filter((x) => x.specId === "cond")) expect(p.label).toMatch(/^sel = /);
  });
  it("the concat family has five operators; {R{a}} with its editable count is the only replication", () => {
    const concat = operatorCatalog.filter((s) => s.family === "concat");
    expect(concat.map((s) => s.template)).toEqual(["{a, b}", "{R{a}}", "{hi, lo} = 16'hBEEF", "{{R{n[3]}}, n}", "{a, 1}"]);
    expect(concat.find((s) => s.template === "{R{a}}")?.defaults).toEqual({ repl: 2 });
  });
  it("sel ? a : b with sel = x: the correct option is 4'b1xx0 and the if/else answer 4'b1010 is diagnosed", () => {
    const opts = operatorPredictionOptions(spec("cond"), withDefaults("cond"));
    expect(opts.find((o) => o.correct)?.label).toBe("4'b1xx0");
    expect(opts.find((o) => o.label === "4'b1010")?.feedback).toMatch(/if\/else/);
    expect(opts.find((o) => o.label === "4'bxxxx")?.feedback).toMatch(/agree on 0 or 1/);
  });
  it("en ? data : 'z with en = x is all x; 4'bzzzz is diagnosed with Table 11-20", () => {
    const r = runOperator(spec("cond-z"), withDefaults("cond-z"));
    expect(r.ok && lit(r.value)).toBe("4'bxxxx");
    const opts = operatorPredictionOptions(spec("cond-z"), withDefaults("cond-z"));
    expect(opts.find((o) => o.label === "4'bzzzz")?.feedback).toMatch(/no z result/);
  });
  it("$countones on 01x0 is 1 with a decimal option list; the 'x counts as 1' answer is diagnosed", () => {
    const opts = operatorPredictionOptions(spec("countones"), inputs("01x0"));
    expect(opts.find((o) => o.correct)?.label).toBe("1");
    expect(opts.find((o) => o.label === "2")?.feedback).toMatch(/counts the 1 x\/z bit as 1/);
  });
  it("$onehot on 01x0 is 1'b1 and 1'bx is impossible (returns bit)", () => {
    const opts = operatorPredictionOptions(spec("onehot"), inputs("01x0"));
    expect(opts.find((o) => o.correct)?.label).toBe("1'b1");
    expect(opts.find((o) => o.label === "1'bx")?.feedback).toMatch(/never be x/);
    expect(operatorPredictionOptions(spec("onehot-guarded"), inputs("01x0")).find((o) => o.correct)?.label).toBe("1'b0");
  });
  it("operands can carry lesson names: $countones(state) declares state", () => {
    expect(operatorDecls(spec("countones"), inputs("0100")).map((x) => x.name)).toEqual(["state"]);
    expect(operatorDecls(spec("concat-target"), withDefaults("concat-target")).map((x) => x.name)).toEqual(["hi", "lo"]);
  });
  it("{hi, lo} = 16'hBEEF: the correct option names both members; the swapped order is diagnosed", () => {
    const det = concatTargetDetail(spec("concat-target"), withDefaults("concat-target"));
    expect(det.ok && det.parts.map((p) => formatHexLiteral({ ...p.value, signed: false }))).toEqual(["8'hBE", "8'hEF"]);
    const opts = operatorPredictionOptions(spec("concat-target"), withDefaults("concat-target"));
    expect(opts.find((o) => o.correct)?.label).toBe("hi = 8'hBE, lo = 8'hEF");
    expect(opts.find((o) => o.label === "hi = 8'hEF, lo = 8'hBE")?.feedback).toMatch(/most significant bits/);
    expect(opts.find((o) => o.label === "Compile error")?.feedback).toMatch(/replication/);
  });
  it("the replication count resolves R in the template, defaulting to the spec's count", () => {
    expect(operatorTemplate(spec("sign-extend"), { repl: undefined })).toBe("{{4{n[3]}}, n}");
    expect(operatorTemplate(spec("sign-extend"), { repl: 2 })).toBe("{{2{n[3]}}, n}");
    expect(replCount(spec("repl-n"), {})).toBe(2);
  });
  it("{{R{n[3]}}, n}: 4 copies give 8'hFA; 0 copies give n itself; the zero-extended 8'h0A is diagnosed", () => {
    const four = runOperator(spec("sign-extend"), withDefaults("sign-extend", { repl: 4 }));
    expect(four.ok && formatHexLiteral(four.value)).toBe("8'hFA");
    const zero = runOperator(spec("sign-extend"), withDefaults("sign-extend", { repl: 0 }));
    expect(zero.ok && lit(zero.value)).toBe("4'b1010");
    const opts = operatorPredictionOptions(spec("sign-extend"), withDefaults("sign-extend", { repl: 4 }));
    expect(opts.find((o) => o.label === "8'h0A")?.feedback).toMatch(/zero-extends/);
  });
  it("{R{a}} with R = 0 is a compile error (zero replication alone)", () => {
    const r = runOperator(spec("repl-n"), { ...inputs("1010"), repl: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("zero-replication-alone");
    expect(operatorPredictionOptions(spec("repl-n"), { ...inputs("1010"), repl: 0 }).find((o) => o.correct)?.label).toBe("Compile error");
    const three = runOperator(spec("repl-n"), { ...inputs("1010"), repl: 3 });
    expect(three.ok && three.value.width).toBe(12);
  });
});

describe("operator prediction options: order and a real choice", () => {
  const spec = (id: string) => operatorCatalog.find((s) => s.id === id)!;
  const B = (x: string) => x.split("") as Bit4[];
  const base = (id: string, extra: Partial<OperatorInputs> = {}): OperatorInputs => ({ a: B("1010"), b: B("0110"), c: B("0"), n: B("001"), signedA: false, ...(spec(id).defaults ?? {}), ...extra });
  const correctIndex = (id: string, extra: Partial<OperatorInputs> = {}) => operatorPredictionOptions(spec(id), base(id, extra)).findIndex((o) => o.correct);

  it("the correct answer is not listed first on the $countones and concat-target defaults", () => {
    expect(correctIndex("countones", { a: B("0100") })).toBeGreaterThan(0);
    expect(correctIndex("concat-target")).toBeGreaterThan(0);
  });
  it("across vectors the correct answer moves, and the same inputs always give the same order", () => {
    const vectors = ["0000", "0001", "0100", "0110", "0111", "1111", "01x0", "xxxx", "x1z0", "1x1x"];
    for (const id of ["countones", "shr", "binary-nand"]) {
      const positions = new Set(vectors.map((a) => correctIndex(id, { a: B(a) })));
      expect(positions.size, id).toBeGreaterThan(1);
    }
    const once = operatorPredictionOptions(spec("countones"), base("countones", { a: B("0110") })).map((o) => o.label);
    const again = operatorPredictionOptions(spec("countones"), base("countones", { a: B("0110") })).map((o) => o.label);
    expect(again).toEqual(once);
  });
  it("an edit that makes every misconception coincide with the answer still leaves a choice", () => {
    const cases: [string, Partial<OperatorInputs>][] = [
      ["concat", { a: B("1100"), b: B("1100") }],
      ["cond", { c: B("x"), a: B("xxxx"), b: B("xxxx") }],
      ["and", { a: B("0000"), b: B("0000") }],
      ["stream-bits", { a: B("1001") }],
    ];
    for (const [id, extra] of cases) {
      const opts = operatorPredictionOptions(spec(id), base(id, extra));
      expect(opts.length, id).toBeGreaterThanOrEqual(2);
      expect(opts.filter((o) => o.correct), id).toHaveLength(1);
    }
    expect(operatorPredictionOptions(spec("and"), base("and", { a: B("0000"), b: B("0000") })).find((o) => o.correct)?.label).toBe("4'b0000");
    expect(operatorPredictionOptions(spec("cond"), base("cond", { c: B("x"), a: B("xxxx"), b: B("xxxx") })).map((o) => o.label).sort()).toEqual(["4'b0000", "4'bxxxx"]);
  });
  it("the guarded $onehot on 01x0 has its own preset", () => {
    const p = operatorPresets.find((x) => x.id === "bitcount-x-guarded")!;
    expect(p.specId).toBe("onehot-guarded");
    expect(p.inputs.a?.join("")).toBe("01x0");
  });
});
