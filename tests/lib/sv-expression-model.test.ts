import { describe, expect, it } from "vitest";

import {
  bitwiseBit,
  bitsOf,
  buildEnv,
  equalityFamily,
  evaluateAssignment,
  evaluateExpression,
  formatHexLiteral,
  formatLiteral,
  fromBits,
  insideDetail,
  mathIntuition,
  notBit,
  operatorCatalog,
  operatorPredictionOptions,
  optimisticX,
  parseLiteral,
  reductionFold,
  runOperator,
  streamBlocks,
  toBigInt,
  trapPredictionOptions,
  trapScenarios,
  type Bit4,
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
