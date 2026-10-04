import { describe, expect, it } from "vitest";

import {
  BIT4_VALUES,
  add,
  assignToIntegral,
  bitwiseBit,
  bitwiseVec,
  caseItemMatches,
  checkDrivers,
  compare,
  conditionalOp,
  defaultNetValue,
  defaultVariableValue,
  diagnoseBitwiseGuess,
  diagnoseEqualityGuess,
  diagnoseNetGuess,
  driverAssignSource,
  explainBitwise,
  formatLiteral,
  ifBranch,
  logicalAnd,
  logicalNot,
  logicalOr,
  netDeclarationSource,
  notBit,
  parseBits,
  reduce,
  resolveNet,
  resolveNetOverTime,
  selectCaseItem,
  strengthLabel,
  toSigned,
  truthOf,
  type Bit4,
  type NetDriver,
  type NetResolution,
} from "@/lib/sv-four-state-model";

const b = parseBits;
const row = (fn: (a: Bit4, c: Bit4) => Bit4, a: Bit4) => BIT4_VALUES.map((c) => fn(a, c)).join("");
const drv = (id: string, value: Bit4, strength: NetDriver["strength"] = "strong"): NetDriver => ({ id, value, strength });
function ok(r: NetResolution) {
  if (!r.ok) throw new Error(`expected a resolved net, got ${r.errorClass}`);
  return r;
}

describe("values", () => {
  it("parses literals MSB first, with ? as z", () => {
    expect(b("1X0?")).toEqual(["1", "x", "0", "z"]);
    expect(formatLiteral(b("10_zx"))).toBe("4'b10zx");
    expect(() => b("12")).toThrow();
  });

  it("reads known vectors as two's complement", () => {
    expect(toSigned(b("11111111"))).toBe(BigInt(-1));
    expect(toSigned(b("1x"))).toBeNull();
  });
});

describe("bitwise operators: IEEE 1800-2023 Tables 11-11 to 11-15", () => {
  it("& matches Table 11-11 row by row (0 is controlling)", () => {
    const and = (a: Bit4, c: Bit4) => bitwiseBit("&", a, c);
    expect(row(and, "0")).toBe("0000");
    expect(row(and, "1")).toBe("01xx");
    expect(row(and, "x")).toBe("0xxx");
    expect(row(and, "z")).toBe("0xxx");
  });

  it("| matches Table 11-12 (1 is controlling)", () => {
    const or = (a: Bit4, c: Bit4) => bitwiseBit("|", a, c);
    expect(row(or, "0")).toBe("01xx");
    expect(row(or, "1")).toBe("1111");
    expect(row(or, "x")).toBe("x1xx");
    expect(row(or, "z")).toBe("x1xx");
  });

  it("^ and ~^ match Tables 11-13 and 11-14: any x or z input gives x", () => {
    const xor = (a: Bit4, c: Bit4) => bitwiseBit("^", a, c);
    const xnor = (a: Bit4, c: Bit4) => bitwiseBit("~^", a, c);
    expect(BIT4_VALUES.map((a) => row(xor, a))).toEqual(["01xx", "10xx", "xxxx", "xxxx"]);
    expect(BIT4_VALUES.map((a) => row(xnor, a))).toEqual(["10xx", "01xx", "xxxx", "xxxx"]);
  });

  it("~ maps z to x, never to z (Table 11-15)", () => {
    expect(BIT4_VALUES.map(notBit).join("")).toBe("10xx");
  });

  it("vector operators work bit by bit and zero-extend the shorter unsigned operand (§11.4.8)", () => {
    expect(bitwiseVec("&", b("1x0z"), b("1111"))).toEqual(b("1x0x"));
    expect(bitwiseVec("|", b("1"), b("0x00"))).toEqual(b("0x01"));
  });

  it("explains controlling values and diagnoses the 'any x gives x' misconception", () => {
    expect(explainBitwise("&", "x", "0")).toMatch(/controlling value of &/);
    expect(diagnoseBitwiseGuess("&", "x", "0", "x")).toMatch(/decides the result on its own/);
    expect(diagnoseBitwiseGuess("|", "z", "0", "z")).toMatch(/never produce z/);
    expect(diagnoseBitwiseGuess("^", "1", "x", "1")).toMatch(/could be 0 or 1/);
  });
});

describe("reduction and logical operators (§11.4.9, §11.4.7)", () => {
  it("reductions apply the binary table left to right; NAND/NOR/XNOR invert (§11.4.9)", () => {
    expect(reduce("&", b("1101"))).toBe("0");
    expect(reduce("&", b("11x1"))).toBe("x");
    expect(reduce("&", b("0x11"))).toBe("0");
    expect(reduce("|", b("00x1"))).toBe("1");
    expect(reduce("|", b("00z0"))).toBe("x");
    expect(reduce("^", b("0110"))).toBe("0");
    expect(reduce("~^", b("0111"))).toBe("0");
    expect(reduce("~&", b("1111"))).toBe("0");
    // Table 11-19 rows.
    expect(reduce("~|", b("0000"))).toBe("1");
  });

  it("a value is true only when known nonzero; all-zero is false; otherwise ambiguous (§11.4.7, §12.4)", () => {
    expect(truthOf(b("0010"))).toBe("true");
    expect(truthOf(b("x010"))).toBe("true");
    expect(truthOf(b("0000"))).toBe("false");
    expect(truthOf(b("00x0"))).toBe("unknown");
    expect(truthOf(b("z"))).toBe("unknown");
  });

  it("&&, || and ! return 1'bx only when the truth value is ambiguous (§11.4.7)", () => {
    expect(logicalAnd(b("x"), b("0"))).toBe("0");
    expect(logicalAnd(b("x"), b("1"))).toBe("x");
    expect(logicalOr(b("x"), b("1"))).toBe("1");
    expect(logicalOr(b("x"), b("0"))).toBe("x");
    expect(logicalNot(b("x"))).toBe("x");
    expect(logicalNot(b("0"))).toBe("1");
  });

  it("arithmetic with any x or z operand bit is entirely x (§11.4.3)", () => {
    expect(add(b("0001"), b("0001"))).toEqual(b("0010"));
    expect(add(b("000x"), b("0001"))).toEqual(b("xxxx"));
  });
});

describe("equality: == is x only when ambiguous; === never is (§11.4.5, §11.4.6)", () => {
  it("a known differing bit makes == a definite 0 even with x elsewhere (§11.4.5)", () => {
    const r = compare("==", b("1x00"), b("0000"));
    expect(r.result).toBe("0");
    expect(r.why).toMatch(/Bit 3 is known in both operands and differs/);
    expect(r.bits.map((c) => c.outcome)).toEqual(["mismatch", "ambiguous", "match", "match"]);
  });

  it("== is x when every known bit matches but some bit is x or z", () => {
    expect(compare("==", b("1x00"), b("1x00")).result).toBe("x");
    expect(compare("==", b("10z1"), b("1001")).result).toBe("x");
    expect(compare("!=", b("1x00"), b("1x00")).result).toBe("x");
    expect(compare("==", b("1001"), b("1001")).result).toBe("1");
  });

  it("=== and !== compare x and z literally and always return a known value", () => {
    expect(compare("===", b("1x00"), b("1x00")).result).toBe("1");
    expect(compare("===", b("1x00"), b("1z00")).result).toBe("0");
    expect(compare("!==", b("10z1"), b("1001")).result).toBe("1");
    for (const [l, r] of [["xx", "xz"], ["z0", "z0"], ["01", "0x"]]) {
      expect(["0", "1"]).toContain(compare("===", b(l), b(r)).result);
    }
  });

  it("==? treats x/z in the right operand as wildcards but not in the left (§11.4.6)", () => {
    expect(compare("==?", b("1011"), b("1x1z")).result).toBe("1");
    expect(compare("==?", b("1x11"), b("1011")).result).toBe("x");
    expect(compare("==?", b("0x11"), b("1x11")).result).toBe("0");
    expect(compare("!=?", b("1011"), b("10xx")).result).toBe("0");
  });

  it("diagnoses the two classic == misconceptions", () => {
    expect(diagnoseEqualityGuess(b("1x00"), b("0000"), "x")).toMatch(/does not automatically poison/);
    expect(diagnoseEqualityGuess(b("1x00"), b("1x00"), "1")).toMatch(/That literal match is what === is for/);
  });
});

describe("control flow with x (§12.4, §12.5, §12.5.1, §11.4.11)", () => {
  it("if (x) and if (!x) BOTH take the else branch: x is not true and !x is still x (§12.4, §11.4.7)", () => {
    expect(ifBranch(b("x"))).toBe("else");
    expect(ifBranch([logicalNot(b("x"))])).toBe("else");
    expect(ifBranch(b("z"))).toBe("else");
    expect(ifBranch(b("1"))).toBe("then");
    expect(ifBranch(b("0"))).toBe("else");
  });

  it("if (a == b) with an ambiguous == also takes else", () => {
    expect(ifBranch([compare("==", b("x"), b("1")).result])).toBe("else");
  });

  it("case matches 0/1/x/z exactly, like === (§12.5)", () => {
    expect(caseItemMatches("case", b("x0"), b("x0"))).toBe(true);
    expect(caseItemMatches("case", b("x0"), b("00"))).toBe(false);
    expect(caseItemMatches("case", b("1z"), b("1?"))).toBe(true);
  });

  it("casez ignores z/? in either operand but still compares x exactly (§12.5.1)", () => {
    expect(caseItemMatches("casez", b("10"), b("1?"))).toBe(true);
    expect(caseItemMatches("casez", b("z0"), b("10"))).toBe(true);
    expect(caseItemMatches("casez", b("x0"), b("00"))).toBe(false);
  });

  it("casex is X-optimistic: an x in the case expression matches any item bit (§12.5.1)", () => {
    expect(caseItemMatches("casex", b("x0"), b("00"))).toBe(true);
    const items = [b("00"), b("1?"), b("x1")];
    expect(selectCaseItem("casex", b("x0"), items)).toBe(0);
    expect(selectCaseItem("casez", b("x0"), items)).toBe("default");
    expect(selectCaseItem("case", b("x0"), items)).toBe("default");
    // First match in source order wins (§12.5).
    expect(selectCaseItem("casex", b("11"), items)).toBe(1);
  });

  it("?: with an ambiguous condition merges both results bit by bit (Table 11-20)", () => {
    expect(conditionalOp(b("x"), b("1"), b("0"))).toEqual(b("x"));
    expect(conditionalOp(b("x"), b("1100"), b("1010"))).toEqual(b("1xx0"));
    expect(conditionalOp(b("x"), b("11"), b("11"))).toEqual(b("11"));
    expect(conditionalOp(b("1"), b("01"), b("10"))).toEqual(b("01"));
  });
});

describe("types, defaults and 2-state conversion (Table 6-7, Table 6-8, §6.11.2)", () => {
  it("4-state variables start at x, 2-state at 0; int is 32 bits (Table 6-7, Table 6-8)", () => {
    expect(defaultVariableValue("logic", 4)).toEqual(b("xxxx"));
    expect(defaultVariableValue("integer")).toHaveLength(32);
    expect(defaultVariableValue("integer").every((x) => x === "x")).toBe(true);
    expect(defaultVariableValue("int")).toHaveLength(32);
    expect(defaultVariableValue("int").every((x) => x === "0")).toBe(true);
    expect(defaultVariableValue("byte")).toHaveLength(8);
  });

  it("nets start at z, except trireg which starts at x (§6.7.1)", () => {
    expect(defaultNetValue("wire")).toEqual(b("z"));
    expect(defaultNetValue("trireg")).toEqual(b("x"));
  });

  it("x and z bits become 0 in a 2-state target; known bits are kept (§6.11.2)", () => {
    const r = assignToIntegral(b("1x0z"), { states: 2, width: 4 });
    expect(r.bits).toEqual(b("1000"));
    expect(r.zeroed).toEqual([2, 0]);
    expect(assignToIntegral(b("1x0z"), { states: 4, width: 4 }).bits).toEqual(b("1x0z"));
  });

  it("a narrower unsigned value is zero-extended before the 2-state conversion", () => {
    const r = assignToIntegral(b("1x0z"), { states: 2, width: 32 });
    expect(r.bits).toHaveLength(32);
    expect(r.bits.slice(-4)).toEqual(b("1000"));
    expect(r.bits.slice(0, 28).every((x) => x === "0")).toBe(true);
  });
});

describe("net resolution (§6.6, §28.12)", () => {
  it("wire/tri follow Table 6-2 at equal strength: 0 vs 1 is x, z is the identity", () => {
    const wire = (a: Bit4, c: Bit4) => ok(resolveNet("wire", [drv("a", a), drv("b", c)])).value;
    expect(BIT4_VALUES.map((a) => row(wire, a))).toEqual(["0xx0", "x1x1", "xxxx", "01xz"]);
    expect(ok(resolveNet("tri", [drv("a", "0"), drv("b", "1")])).value).toBe("x");
  });

  it("equal-strength conflict on a wire is StX (§28.12.2)", () => {
    const r = ok(resolveNet("wire", [drv("a", "0"), drv("b", "1")]));
    expect(r.label).toBe("StX");
    expect(r.rule).toBe("equal-conflict");
    expect(r.why).toMatch(/same strength/);
  });

  it("the stronger driver wins outright; the weaker opposing driver cannot make x (§28.12.1)", () => {
    const r = ok(resolveNet("wire", [drv("a", "0", "strong"), drv("b", "1", "weak")]));
    expect(r.value).toBe("0");
    expect(r.label).toBe("St0");
    expect(r.dominated).toEqual(["b"]);
    expect(ok(resolveNet("wire", [drv("a", "1", "pull"), drv("b", "0", "supply")])).label).toBe("Su0");
  });

  it("an x driver loses to a stronger known driver but wins against weaker ones (§28.12.3)", () => {
    expect(ok(resolveNet("wire", [drv("a", "x", "weak"), drv("b", "1", "pull")])).label).toBe("Pu1");
    expect(ok(resolveNet("wire", [drv("a", "x", "strong"), drv("b", "1", "pull")])).label).toBe("StX");
  });

  it("like values combine with the greatest strength (§28.12.1)", () => {
    const r = ok(resolveNet("wire", [drv("a", "1", "weak"), drv("b", "1", "pull"), drv("c", "1", "pull")]));
    expect(r.label).toBe("Pu1");
    expect(r.rule).toBe("like-values");
  });

  it("no driver on: the net floats at z (HiZ)", () => {
    const r = ok(resolveNet("wire", [drv("a", "z"), drv("b", "z")]));
    expect(r.value).toBe("z");
    expect(r.label).toBe("HiZ");
  });

  it("wand/triand AND equal-strength drivers (Table 6-3); wor/trior OR them (Table 6-4)", () => {
    const wand = (a: Bit4, c: Bit4) => ok(resolveNet("wand", [drv("a", a), drv("b", c)])).value;
    const wor = (a: Bit4, c: Bit4) => ok(resolveNet("trior", [drv("a", a), drv("b", c)])).value;
    expect(BIT4_VALUES.map((a) => row(wand, a))).toEqual(["0000", "01x1", "0xxx", "01xz"]);
    expect(BIT4_VALUES.map((a) => row(wor, a))).toEqual(["01x0", "1111", "x1xx", "01xz"]);
  });

  it("wired logic only combines drivers of the SAME strength: a strong 0 beats a weak 1 on wor (§28.12.4, §28.12.1)", () => {
    const r = ok(resolveNet("wor", [drv("a", "0", "strong"), drv("b", "1", "weak")]));
    expect(r.value).toBe("0");
    expect(r.rule).toBe("stronger-wins");
  });

  it("tri0/tri1: undriven reads 0/1 at pull strength (§6.6.5, Tables 6-5 and 6-6)", () => {
    expect(ok(resolveNet("tri0", [drv("a", "z")])).label).toBe("Pu0");
    expect(ok(resolveNet("tri1", [])).label).toBe("Pu1");
    // With strong drivers the tables match wire, and the result is strong.
    expect(ok(resolveNet("tri1", [drv("a", "0"), drv("b", "z")])).label).toBe("St0");
    expect(ok(resolveNet("tri0", [drv("a", "0"), drv("b", "1")])).value).toBe("x");
  });

  it("a weak driver cannot overcome the tri0 pull-down (§6.6.5 with §28.12.1)", () => {
    const r = ok(resolveNet("tri0", [drv("a", "1", "weak")]));
    expect(r.label).toBe("Pu0");
    expect(r.rule).toBe("pull-default");
    expect(diagnoseNetGuess("tri0", [drv("a", "1", "weak")], "1")).toMatch(/Strength decides before value/);
  });

  it("a pull driver against the tri1 pull-up at equal strength gives PuX", () => {
    expect(ok(resolveNet("tri1", [drv("a", "0", "pull")])).label).toBe("PuX");
  });

  it("trireg holds its last driven value at its charge strength when all drivers are z (§6.6.4, §28.15.2)", () => {
    const steps = [[drv("a", "1"), drv("b", "z")], [drv("a", "z"), drv("b", "z")], [drv("a", "z"), drv("b", "0", "weak")]];
    const [t0, t10, t20] = resolveNetOverTime("trireg", steps, { charge: "medium" }).map(ok);
    expect(t0.label).toBe("St1");
    expect(t10.label).toBe("Me1");
    expect(t10.rule).toBe("trireg-hold");
    expect(t20.label).toBe("We0");
    // The same sequence on a wire floats at t = 10.
    expect(ok(resolveNetOverTime("wire", steps)[1]).value).toBe("z");
  });

  it("an undriven trireg starts at x with its declared charge strength (§6.7.1)", () => {
    const r = ok(resolveNet("trireg", [drv("a", "z")], { charge: "large" }));
    expect(r.label).toBe("LaX");
    expect(r.rule).toBe("trireg-initial");
  });

  it("uwire with two drivers is an elaboration error (§6.6.2)", () => {
    const r = resolveNet("uwire", [drv("a", "1"), drv("b", "1")]);
    expect(r.ok).toBe(false);
    expect(resolveNet("uwire", [drv("a", "1")]).ok).toBe(true);
  });

  it("diagnoses net guesses by the rule actually applied", () => {
    expect(diagnoseNetGuess("wire", [drv("a", "0", "strong"), drv("b", "1", "weak")], "x")).toMatch(/not at the same strength/);
    expect(diagnoseNetGuess("wire", [drv("a", "0"), drv("b", "1")], "0")).toMatch(/cannot choose/);
    expect(diagnoseNetGuess("wand", [drv("a", "0"), drv("b", "1")], "x")).toMatch(/wired AND/);
    expect(diagnoseNetGuess("trireg", [drv("a", "z")], "z", { stored: "1" })).toMatch(/never floats to z/);
  });

  it("formats %v-style strength labels", () => {
    expect(strengthLabel("1", "supply")).toBe("Su1");
    expect(strengthLabel("x", "weak")).toBe("WeX");
    expect(strengthLabel("z", "highz")).toBe("HiZ");
  });
});

describe("driver legality: variables vs nets (§6.5, §6.6.2, §9.2.2.2, §10.3.2)", () => {
  const assigns = [
    { id: "assign #1", kind: "assign" as const },
    { id: "assign #2", kind: "assign" as const },
  ];

  it("two continuous assignments to a variable are a compile error, not an x (§6.5, §10.3.2)", () => {
    const r = checkDrivers("variable", assigns);
    expect(r.legal).toBe(false);
    expect(r.errorClass).toBe("multiple-continuous-on-variable");
    expect(r.message).toMatch(/multiple continuous drivers on a variable/);
  });

  it("the same two assignments to a wire are legal and resolved by the net", () => {
    const r = checkDrivers("wire", assigns);
    expect(r.legal).toBe(true);
    expect(r.outcome).toBe("net-resolves");
  });

  it("several procedural writers to a variable are legal: the last write wins (§6.5)", () => {
    const r = checkDrivers("variable", [
      { id: "always A", kind: "procedural" },
      { id: "always B", kind: "procedural" },
    ]);
    expect(r.legal).toBe(true);
    expect(r.outcome).toBe("last-write-wins");
  });

  it("mixing a continuous assignment with a procedural write to a variable is an error (§6.5)", () => {
    expect(checkDrivers("variable", [assigns[0], { id: "initial", kind: "procedural" }]).errorClass).toBe("mixed-continuous-procedural");
  });

  it("a net cannot be procedurally assigned (§6.5)", () => {
    expect(checkDrivers("wire", [{ id: "initial", kind: "procedural" }]).errorClass).toBe("procedural-on-net");
  });

  it("a variable written in always_comb shall not be written by another process (§9.2.2.2)", () => {
    const r = checkDrivers("variable", [
      { id: "always_comb", kind: "always_comb" },
      { id: "initial", kind: "procedural" },
    ]);
    expect(r.errorClass).toBe("always-block-shared");
    expect(r.clause).toBe("§9.2.2.2");
  });

  it("uwire rejects a second continuous driver (§6.6.2)", () => {
    expect(checkDrivers("uwire", assigns).errorClass).toBe("uwire-multiple-drivers");
  });
});

describe("code generation", () => {
  it("emits declarations and strength-qualified assigns (§10.3.4)", () => {
    expect(netDeclarationSource("wire")).toBe("wire y;");
    expect(netDeclarationSource("trireg", "y", "small")).toBe("trireg (small) y;");
    expect(driverAssignSource(drv("a", "1", "pull"))).toBe("assign (pull0, pull1) y = a;");
  });
});
