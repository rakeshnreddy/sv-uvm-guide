import { describe, expect, it } from "vitest";

import {
  BIT4_VALUES,
  INOUT_VARIABLE_WHY,
  STRENGTH_LEVEL,
  add,
  assignToIntegral,
  bitwiseBit,
  bitwiseVec,
  caseItemMatches,
  bitConflictTag,
  checkDrivers,
  undrivenValue,
  checkStrengthPair,
  describeOpenDrainDevice,
  effectiveDriver,
  openDrainAssignSource,
  openDrainSummary,
  openDrainTruthTable,
  portKind,
  resolveOpenDrain,
  selectText,
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
  type Writer,
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

describe("driver rule per bit of a packed variable (§6.5, §11.5.3)", () => {
  const W = (id: string, kind: Writer["kind"], bits?: [number, number]): Writer => ({ id, kind, bits });
  const v0 = W("assign v[0] = a", "assign", [0, 0]);
  const v1 = W("assign v[1] = b", "assign", [1, 1]);
  const whole = W("assign v = c", "assign", [1, 0]);
  const comb1 = W("always_comb v[1] = b & c", "always_comb", [1, 1]);
  const init = W("logic [1:0] v = 2'b00", "initializer", [1, 0]);
  const port = W("sub u_sub (.q(v))", "port", [1, 0]);

  it("§6.5 'Each bit in a packed type is also an independent element': assign v[0] and assign v[1] are legal", () => {
    const r = checkDrivers("variable", [v0, v1], { width: 2 });
    expect(r.legal).toBe(true);
    expect(r.outcome).toBe("single-driver");
    expect(r.flaggedBits).toEqual([]);
    expect(r.bits?.map((b) => [b.index, b.writers])).toEqual([
      [1, ["assign v[1] = b"]],
      [0, ["assign v[0] = a"]],
    ]);
    expect(r.why).toMatch(/Each bit of a packed variable is its own element/);
  });

  it("§6.5 'multiple continuous assignments ... to any term in the expansion of the longest static prefix': assign v plus assign v[1] flags bit 1 only", () => {
    const r = checkDrivers("variable", [whole, v1], { width: 2 });
    expect(r.legal).toBe(false);
    expect(r.errorClass).toBe("multiple-continuous-on-variable");
    expect(r.flaggedBits).toEqual([1]);
    expect(r.bits?.[1].check?.outcome).toBe("single-driver");
    expect(r.why).toMatch(/^v\[1\] is written by assign v = c and assign v\[1\] = b\./);
    expect(r.clause).toBe("§6.5, §10.3.2");
    expect(r.errorBits).toEqual([1]);
    expect(r.openBits).toEqual([]);
  });

  it("§9.2.2.2 'longest static prefixes do not overlap': always_comb v[1] with assign v[0] is legal", () => {
    const r = checkDrivers("variable", [v0, comb1], { width: 2 });
    expect(r.legal).toBe(true);
    expect(r.why).toMatch(/always_comb owns only the bits written there/);
    expect(r.why).toMatch(/§9\.2\.2\.2/);
  });

  it("§9.2.2.2: always_comb v[1] with assign v is an error on bit 1 (continuous mixed with procedural, §6.5)", () => {
    const r = checkDrivers("variable", [whole, comb1], { width: 2 });
    expect(r.errorClass).toBe("mixed-continuous-procedural");
    expect(r.flaggedBits).toEqual([1]);
  });

  it("§6.5 'a declared variable initialization ... is considered a procedural assignment': initializer plus assign is an error on every bit", () => {
    const r = checkDrivers("variable", [init, whole], { width: 2 });
    expect(r.errorClass).toBe("mixed-continuous-procedural");
    expect(r.flaggedBits).toEqual([1, 0]);
    expect(r.why).toMatch(/initializer counts as a procedural assignment/);
    expect(r.why).toMatch(/The same applies to v\[0\]/);
  });

  it("§6.5 'A continuous assignment shall be implied when a variable is connected to the output port of an instance': port plus assign v[0] is an error on bit 0", () => {
    const r = checkDrivers("variable", [port, v0], { width: 2 });
    expect(r.errorClass).toBe("multiple-continuous-on-variable");
    expect(r.flaggedBits).toEqual([0]);
  });

  it("§6.5: the initializer alone, or with a plain always procedure, is legal (procedural writes only)", () => {
    expect(checkDrivers("variable", [init], { width: 2 }).legal).toBe(true);
    const r = checkDrivers("variable", [init, W("always @(b) v[1] = b", "procedural", [1, 1])], { width: 2 });
    expect(r.outcome).toBe("last-write-wins");
    expect(r.bits?.find((b) => b.index === 0)?.check?.why).toMatch(/Only the initializer writes it/);
  });

  it("§6.5 with §9.2.2.2: initializer plus always_comb on the same bit is reported as not settled by the standard", () => {
    const r = checkDrivers("variable", [init, comb1], { width: 2 });
    expect(r.outcome).toBe("tool-dependent");
    expect(r.legal).toBe(false);
    expect(r.errorClass).toBeUndefined();
    expect(r.flaggedBits).toEqual([1]);
    expect(r.why).toMatch(/no clause says whether §9\.2\.2\.2 applies to it/);
    expect(r.why).toMatch(/§4\.3 counts procedural assignment statements among its examples of processes/);
    expect(r.why).toMatch(/A static variable's initializer also runs before any procedure starts \(§6\.8, §10\.5\)/);
    expect(r.openBits).toEqual([1]);
    expect(r.errorBits).toEqual([]);
  });

  it("a compile error on one bit does not hide a bit the standard leaves open (initializer + always_comb v[1] + assign v[0])", () => {
    const r = checkDrivers("variable", [comb1, init, v0], { width: 2 });
    expect(r.outcome).toBe("compile-error");
    expect(r.errorClass).toBe("mixed-continuous-procedural");
    expect(r.bits?.map((b) => [b.index, b.check?.outcome])).toEqual([
      [1, "tool-dependent"],
      [0, "compile-error"],
    ]);
    expect(r.errorBits).toEqual([0]);
    expect(r.openBits).toEqual([1]);
    expect(r.flaggedBits).toEqual([1, 0]);
    expect(r.why).toMatch(/^v\[0\] is written by/);
    expect(r.why).toMatch(/v\[1\] is left to the tool: v\[1\] is written by always_comb v\[1\] = b & c and logic \[1:0\] v = 2'b00, which the standard does not settle \(§6\.5, §9\.2\.2\.2\)\./);
    expect(bitConflictTag(r.bits?.[0].check ?? null)).toBe("open (§6.5, §9.2.2.2)");
    expect(bitConflictTag(r.bits?.[1].check ?? null)).toBe("continuous + procedural (§6.5, §10.3.2)");
  });

  it("§10.3.2 'an error for a variable driven by a continuous assignment or output to have an initializer': the initializer branch cites §6.5 and §10.3.2", () => {
    const r = checkDrivers("variable", [init, v0], { width: 2 });
    expect(r.clause).toBe("§6.5, §10.3.2");
    expect(r.why).toMatch(/§10\.3\.2 states it directly/);
    expect(r.flaggedBits).toEqual([0]);
  });

  it("bitConflictTag names the conflict from the error class, not a generic 'overlap'", () => {
    expect(bitConflictTag(checkDrivers("variable", [whole, v1], { width: 2 }).bits?.[0].check ?? null)).toBe("two continuous (§6.5, §10.3.2)");
    expect(bitConflictTag(checkDrivers("variable", [init, whole], { width: 2 }).bits?.[0].check ?? null)).toBe("continuous + procedural (§6.5, §10.3.2)");
    expect(bitConflictTag(checkDrivers("variable", [W("always_ff A", "always_ff", [0, 0]), W("always B", "procedural", [0, 0])], { width: 1 }).bits?.[0].check ?? null)).toBe(
      "two processes (§9.2.2.4)",
    );
    expect(bitConflictTag(checkDrivers("variable", [v0, v1], { width: 2 }).bits?.[0].check ?? null)).toBeNull();
    expect(bitConflictTag(null)).toBeNull();
  });

  it("§9.2.2.4: always_comb plus always_ff on the same bit is an error (always-block-shared)", () => {
    const r = checkDrivers("variable", [comb1, W("always_ff v[1]", "always_ff", [1, 1])], { width: 2 });
    expect(r.errorClass).toBe("always-block-shared");
    expect(r.flaggedBits).toEqual([1]);
    expect(r.clause).toBe("§9.2.2.2, §9.2.2.4");
    expect(r.why).toMatch(/always_comb or always_ff shall not be written by any other process/);
    // The order of the writers does not change the citation.
    expect(checkDrivers("variable", [W("always_ff v[1]", "always_ff", [1, 1]), comb1], { width: 2 }).clause).toBe("§9.2.2.2, §9.2.2.4");
  });

  it("§6.5 with §9.2.2.4: initializer plus always_ff on the same bit is reported as not settled by the standard", () => {
    const r = checkDrivers("variable", [init, W("always_ff v[1]", "always_ff", [1, 1])], { width: 2 });
    expect(r.outcome).toBe("tool-dependent");
    expect(r.clause).toBe("§6.5, §9.2.2.4");
    expect(r.openBits).toEqual([1]);
  });

  it("§9.2.2.4: always_ff on v[1] with a plain always on v[0] is legal, and the note cites §9.2.2.4", () => {
    const r = checkDrivers("variable", [W("always_ff v[1]", "always_ff", [1, 1]), W("always @(a) v[0] = a", "procedural", [0, 0])], { width: 2 });
    expect(r.legal).toBe(true);
    expect(r.why).toMatch(/always_ff owns only the bits written there/);
    expect(r.why).toMatch(/§9\.2\.2\.4/);
  });

  describe("§6.5 example: struct { bit [7:0] A; bit [7:0] B; byte C; } abc", () => {
    // Each member is checked on its own; a gate output (not) is a continuous driver of the variable (§10.3.2: "one primitive output").
    const nots = [0, 1, 2, 3].map((i) => W(`not (abc.A[${i}], abc.B[${i}])`, "assign", [i, i]));
    const assignC1 = W("assign abc.C = sel ? 8'hBE : 8'hEF", "assign", [7, 0]);
    const assignC2 = W("assign abc.C = sel ? 8'hDE : 8'hED", "assign", [7, 0]);

    it("the legal statements: assign abc.C, the not gates on abc.A[3:0], always abc.B <= abc.B + 1", () => {
      expect(checkDrivers("variable", [assignC1], { width: 8, name: "abc.C" }).legal).toBe(true);
      expect(checkDrivers("variable", nots, { width: 8, name: "abc.A" }).legal).toBe(true);
      expect(checkDrivers("variable", [W("always @(posedge clk) abc.B <= abc.B + 1", "procedural", [7, 0])], { width: 8, name: "abc.B" }).legal).toBe(true);
    });

    it("illegal: 'Mixing continuous and procedural assignments to abc.A[3]' flags bit 3 only", () => {
      const r = checkDrivers("variable", [...nots, W("always @(posedge clk) abc.A[7:3] <= !abc.B[7:3]", "procedural", [7, 3])], { width: 8, name: "abc.A" });
      expect(r.legal).toBe(false);
      expect(r.errorClass).toBe("mixed-continuous-procedural");
      expect(r.flaggedBits).toEqual([3]);
      expect(r.why).toMatch(/^abc\.A\[3\] is written by not \(abc\.A\[3\], abc\.B\[3\]\) and always @\(posedge clk\) abc\.A\[7:3\]/);
    });

    it("illegal: 'Multiple continuous assignments to abc.C' flags all eight bits", () => {
      const r = checkDrivers("variable", [assignC1, assignC2], { width: 8, name: "abc.C" });
      expect(r.errorClass).toBe("multiple-continuous-on-variable");
      expect(r.flaggedBits).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    });
  });

  it("§9.2.2.4: two always_ff writing the same bit is an error", () => {
    const r = checkDrivers("variable", [W("always_ff A", "always_ff", [0, 0]), W("always_ff B", "always_ff", [1, 0])], { width: 2 });
    expect(r.errorClass).toBe("always-block-shared");
    expect(r.clause).toBe("§9.2.2.4");
    expect(r.flaggedBits).toEqual([0]);
  });

  it("§10.3.1: on a net the declaration assignment is continuous, so it resolves with another assign", () => {
    expect(checkDrivers("wire", [W("wire v = c", "initializer"), W("assign v = d", "assign")]).outcome).toBe("net-resolves");
  });

  it("§6.6 'If no driver is connected to a net, its value shall be high-impedance (z) unless the net is a trireg': each undriven net type has its own text", () => {
    for (const t of ["wire", "tri", "wand", "triand", "wor", "trior", "uwire"] as const) {
      const r = checkDrivers(t, [], { width: 2 });
      expect(r.outcome).toBe("no-writer");
      expect(r.why).toBe(`No driver covers it, so the ${t} net is high impedance, z (§6.6).`);
      expect(r.clause).toBe("§6.6");
      expect(undrivenValue(t).value).toBe("z");
    }
    const trireg = checkDrivers("trireg", [], { width: 2 });
    expect(trireg.why).toMatch(/holds its previously driven value \(§6\.6, §6\.6\.4\)/);
    expect(trireg.why).not.toMatch(/is high impedance/);
    expect(trireg.clause).toBe("§6.6, §6.6.4, §6.7.1");
    expect(undrivenValue("trireg").value).toBe("held");
  });

  it("§6.6.5 'When no driver drives a tri0 net, its value is 0 with strength pull' (and 1 for tri1)", () => {
    expect(checkDrivers("tri0", [], { width: 2 }).why).toMatch(/tri0 net reads 0 at pull strength/);
    expect(checkDrivers("tri1", [], { width: 2 }).why).toMatch(/tri1 net reads 1 at pull strength/);
    expect(checkDrivers("tri1", [], { width: 2 }).clause).toBe("§6.6.5");
    expect(undrivenValue("tri0").value).toBe("0");
    expect(undrivenValue("tri1").value).toBe("1");
  });

  it("§6.6.6, §28.15.3: supply0 models ground and supply1 power, at supply strength", () => {
    const s0 = checkDrivers("supply0", [], { width: 2 });
    expect(s0.why).toMatch(/ground connection and has supply strength, so with no other driver it reads 0/);
    expect(s0.clause).toBe("§6.6.6, §28.15.3");
    expect(checkDrivers("supply1", []).why).toMatch(/power supply and has supply strength, so with no other driver it reads 1/);
    expect(undrivenValue("supply0").value).toBe("0");
    expect(undrivenValue("supply1").value).toBe("1");
  });

  it("no writers: nothing to check, the variable keeps its default (Table 6-7)", () => {
    const r = checkDrivers("variable", [], { width: 2 });
    expect(r.outcome).toBe("no-writer");
    expect(r.legal).toBe(true);
    expect(checkDrivers("variable", [v1], { width: 2 }).bits?.[1].check).toBeNull();
  });

  it("writers without ranges keep the whole-variable behaviour", () => {
    const r = checkDrivers("variable", [{ id: "a", kind: "assign" }, { id: "b", kind: "assign" }]);
    expect(r.bits).toHaveLength(1);
    expect(r.why).not.toMatch(/is written by/);
  });

  it("rejects a bit range outside the declaration", () => {
    expect(() => checkDrivers("variable", [W("x", "assign", [2, 0])], { width: 2 })).toThrow(/outside v\[1:0\]/);
  });

  it("selectText names the longest static prefix of each writer", () => {
    expect(selectText("v", [1, 0], 2)).toBe("v");
    expect(selectText("v", [1, 1], 2)).toBe("v[1]");
    expect(selectText("v", [3, 2], 4)).toBe("v[3:2]");
    expect(selectText("v", undefined, 2)).toBe("v");
  });
});

describe("ANSI port kinds (§23.2.2.3, §6.5)", () => {
  it("§23.2.2.3 'For input and inout ports, the port shall default to a net': input logic a is input wire logic a", () => {
    const r = portKind("input", "explicit", "none");
    expect(r.kind).toBe("net");
    expect(r.declared).toBe("input logic a");
    expect(r.expanded).toBe("input wire logic a");
  });

  it("§23.2.2.3: an output with an explicit data type defaults to a variable", () => {
    const r = portKind("output", "explicit", "none");
    expect(r.kind).toBe("variable");
    expect(r.expanded).toBe("output var logic y");
  });

  it("§23.2.2.3: an output with an omitted or implicit data type defaults to a net", () => {
    expect(portKind("output", "omitted", "none").expanded).toBe("output wire logic y");
    expect(portKind("output", "implicit", "none")).toMatchObject({ kind: "net", declared: "output [7:0] y", expanded: "output wire logic [7:0] y" });
  });

  it("§23.2.2.3: inout defaults to a net, and the reveal explains why it cannot be a variable (§6.5)", () => {
    const r = portKind("inout", "explicit", "none");
    expect(r.kind).toBe("net");
    expect(r.why).toContain(INOUT_VARIABLE_WHY);
    expect(INOUT_VARIABLE_WHY).toMatch(/cannot be connected to either side of an inout port/);
  });

  it("§23.2.2.3 example mh4: inout var is an error", () => {
    const r = portKind("inout", "explicit", "var");
    expect(r.kind).toBe("illegal");
    expect(r.expanded).toBeNull();
    expect(r.clause).toBe("§23.2.2, §23.2.2.3, §6.5");
    expect(r.why).toMatch(/^An inout port shall not be of a variable type \(§23\.2\.2\)/);
    expect(r.why).toMatch(/Example mh4 in §23\.2\.2\.3 is the related error case/);
  });

  it("§23.2.2.3 example mh6 'input var x' (type omitted) expands to input var logic", () => {
    expect(portKind("input", "omitted", "var")).toMatchObject({ kind: "variable", declared: "input var a", expanded: "input var logic a" });
  });

  it("§23.2.2.3: a ref port with the type omitted is a variable; an input or inout with only a range is a net (mh3, mh5)", () => {
    expect(portKind("ref", "omitted", "var").kind).toBe("variable");
    expect(portKind("ref", "omitted", "var").expanded).toBe("ref var logic r");
    expect(portKind("input", "implicit", "none").expanded).toBe("input wire logic [7:0] a");
    expect(portKind("inout", "implicit", "none").expanded).toBe("inout wire logic [7:0] z");
    expect(portKind("inout", "omitted", "none").expanded).toBe("inout wire logic z");
  });

  it("§6.5: the output-variable note does not claim a one-always-block limit", () => {
    const r = portKind("output", "explicit", "none");
    expect(r.why).not.toMatch(/one always block/);
    expect(r.why).toMatch(/either one continuous assignment \(or one port\) or any number of procedural writes, never a mix \(§6\.5\)/);
    expect(r.why).toMatch(/always_comb and always_ff further limit it to one process \(§9\.2\.2\.2, §9\.2\.2\.4\)/);
  });

  it("§23.2.2.3: var names the kind for input and output (examples mh6, mh9)", () => {
    expect(portKind("input", "explicit", "var").expanded).toBe("input var logic a");
    expect(portKind("output", "omitted", "var").expanded).toBe("output var logic y");
  });

  it("§23.2.2.3 'A ref port is always a variable'", () => {
    expect(portKind("ref", "implicit", "none").expanded).toBe("ref var logic [7:0] r");
    expect(portKind("ref", "explicit", "net").kind).toBe("illegal");
    expect(portKind("ref", "explicit", "net").why).toMatch(/^A ref port shall be of a variable type \(§23\.2\.2\)/);
    expect(portKind("ref", "explicit", "net").clause).toBe("§23.2.2, §23.2.2.3");
  });

  it("an explicit wire keyword always gives a net", () => {
    expect(portKind("output", "explicit", "net").expanded).toBe("output wire logic y");
  });
});

describe("per-value drive strengths and open-drain on tri1 (§10.3.4, §6.6.5, Table 28-7)", () => {
  const dev = (id: string, pullLow: boolean) => ({ id, pullLow });

  it("§10.3.4: (highz0, highz1) is an illegal strength pair; other pairs are legal", () => {
    expect(checkStrengthPair("highz", "highz").legal).toBe(false);
    expect(checkStrengthPair("strong", "highz").legal).toBe(true);
    expect(() => effectiveDriver({ id: "a", value: "0", strength: "strong", strength0: "highz", strength1: "highz" })).toThrow(/illegal/);
  });

  it("§10.3.4 with Table 28-7: a 1 driven at highz1 is high impedance; a 0 at strong0 is St0", () => {
    const base = { id: "a", strength: "strong" as const, strength0: "strong" as const, strength1: "highz" as const };
    expect(effectiveDriver({ ...base, value: "1" }).value).toBe("z");
    expect(effectiveDriver({ ...base, value: "0" })).toMatchObject({ value: "0", strength: "strong" });
    expect(() => effectiveDriver({ ...base, value: "x" })).toThrow(/Not modelled/);
  });

  it("§10.3.4: driverAssignSource emits the per-value pair", () => {
    expect(openDrainAssignSource(dev("dev_a", false))).toBe("assign (strong0, highz1) sda = dev_a_drive_low ? 1'b0 : 1'b1;");
  });

  it("§6.6.5: with every device letting go, the tri1 pull-up gives Pu1", () => {
    const r = resolveOpenDrain([dev("dev_a", false), dev("dev_b", false)]);
    expect(r.ok && r.label).toBe("Pu1");
    expect(r.ok && r.rule).toBe("pull-default");
  });

  it("Table 28-7: one device pulling low wins St0 over the pull-up", () => {
    const r = resolveOpenDrain([dev("dev_a", true), dev("dev_b", false)]);
    expect(r.ok && r.label).toBe("St0");
    expect(r.ok && r.dominated).toEqual(["pull"]);
    expect(r.ok && r.why).toMatch(/The built-in pull-up \(1 at pull\) is weaker/);
  });

  it("the four combinations: the pull-up wins only when every device lets go (wired AND)", () => {
    const rows = openDrainTruthTable(["dev_a", "dev_b"]);
    expect(rows.map((r) => r.pullLow)).toEqual([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]);
    expect(rows.map((r) => (r.result.ok ? r.result.label : "err"))).toEqual(["Pu1", "St0", "St0", "St0"]);
    expect(openDrainSummary(rows)).toBe(
      `sda reads 1 (Pu1) only when every device lets go. Whenever any device pulls low, sda reads 0 (St0): strong (level ${STRENGTH_LEVEL.strong}) beats the pull-up's pull (level ${STRENGTH_LEVEL.pull}), and the released devices drive nothing (Table 28-7, §6.6.5).`,
    );
  });

  it("on a plain wire with no pull-up, released devices leave the line floating at z", () => {
    const rows = openDrainTruthTable(["dev_a", "dev_b"], "wire");
    expect(rows[0].result.ok && rows[0].result.value).toBe("z");
    expect(openDrainSummary(rows)).toMatch(/do not follow the wired-AND pattern/);
  });

  it("describes each device from its effective drive", () => {
    expect(describeOpenDrainDevice(dev("dev_b", false))).toMatch(/dev_b lets go of the line/);
    expect(describeOpenDrainDevice(dev("dev_a", true))).toMatch(/strong0 \(level 6\)/);
  });
});
