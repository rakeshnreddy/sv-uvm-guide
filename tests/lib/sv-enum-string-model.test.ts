import { describe, expect, it } from "vitest";

import {
  DEFAULT_ENUM_BASE,
  ENUM_DECL_PRESETS,
  OPCODE_DECL,
  assignIntToEnum,
  callEnumMethod,
  castEnumLiteral,
  enumDeclPreset,
  enumDeclaration,
  enumDefault,
  enumBaseText,
  enumNumberLine,
  enumPredictionChoices,
  enumSpecText,
  enumTypeFromDeclaration,
  formatEnumValue,
  gradeEnumDeclPrediction,
  isMember,
  literalText,
  nextStepQuestion,
  resolveEnumDeclaration,
  vectorBase,
  writeEnumThroughPackedStruct,
  type EnumTypeModel,
} from "@/lib/sv-enum-string-model";
import { callStringMethod } from "@/lib/sv-enum-string-model";

const intEnum: EnumTypeModel = { name: "state_e", baseDecl: "", states: 2, members: ["IDLE", "START", "BUSY", "ERROR"] };
const logicEnum: EnumTypeModel = { ...intEnum, baseDecl: "logic [1:0]", states: 4 };

describe("enum methods (§6.19.5)", () => {
  it("next/prev wrap around the member list and accept a step count N (§6.19.5.3–4)", () => {
    expect(callEnumMethod(intEnum, 3, "next").returns).toEqual({ kind: "enum", value: 0 });
    expect(callEnumMethod(intEnum, 1, "next", 2).returns).toEqual({ kind: "enum", value: 3 });
    expect(callEnumMethod(intEnum, 2, "next", 3).returns).toEqual({ kind: "enum", value: 1 });
    expect(callEnumMethod(intEnum, 0, "prev").returns).toEqual({ kind: "enum", value: 3 });
    expect(callEnumMethod(intEnum, 1, "prev", 3).returns).toEqual({ kind: "enum", value: 2 });
  });

  it("next/prev of a value that is not a member return the default initial value (§6.19.5.3, Table 6-7)", () => {
    expect(callEnumMethod(intEnum, 7, "next").returns).toEqual({ kind: "enum", value: 0 });
    expect(callEnumMethod(intEnum, 7, "prev", 2).returns).toEqual({ kind: "enum", value: 0 });
    expect(callEnumMethod(logicEnum, "x", "next").returns).toEqual({ kind: "enum", value: "x" });
  });

  it("name() of a value that is not a member is the empty string (§6.19.5.6)", () => {
    expect(callEnumMethod(intEnum, 7, "name").returns).toEqual({ kind: "string", value: "" });
    expect(callEnumMethod(logicEnum, "x", "name").returns).toEqual({ kind: "string", value: "" });
    expect(callEnumMethod(intEnum, 2, "name").returns).toEqual({ kind: "string", value: "BUSY" });
  });

  it("num() counts members; first()/last() ignore the current value", () => {
    expect(callEnumMethod(intEnum, 7, "num").returns).toEqual({ kind: "int", value: 4 });
    expect(callEnumMethod(intEnum, 7, "first").returns).toEqual({ kind: "enum", value: 0 });
    expect(callEnumMethod(intEnum, 7, "last").returns).toEqual({ kind: "enum", value: 3 });
  });

  it("the default int base starts at 0 (the first member here); a 4-state base starts at x (Table 6-7)", () => {
    expect(enumDefault(intEnum)).toBe(0);
    expect(enumDefault(logicEnum)).toBe("x");
  });

  it("int to enum: plain assignment is illegal, a static cast skips the check, $cast checks (§6.19.4, §6.24.2)", () => {
    expect(assignIntToEnum(intEnum, 0, 7, "plain").compiles).toBe(false);
    expect(assignIntToEnum(intEnum, 0, 7, "static-cast").after).toBe(7);
    const dyn = assignIntToEnum(intEnum, 1, 7, "dynamic-cast");
    expect(dyn.castReturn).toBe(0);
    expect(dyn.after).toBe(1);
    expect(assignIntToEnum(intEnum, 1, 2, "dynamic-cast")).toMatchObject({ castReturn: 1, after: 2 });
  });
});

const resolve = (id: string) => resolveEnumDeclaration(enumDeclPreset(id).spec);
const valuesOf = (id: string) => Object.fromEntries(resolve(id).members.map((m) => [m.name, m.value]));
const kinds = (id: string) => resolve(id).issues.map((i) => i.kind);

describe("enum declarations: how the values are assigned (§6.19, §6.19.2)", () => {
  it("an unassigned first name is 0 and each later one is the previous value + 1 (§6.19)", () => {
    expect(valuesOf("implicit")).toEqual({ IDLE: 0, RUN: 1, DONE: 2 });
    expect(resolve("implicit").ok).toBe(true);
    expect(resolve("implicit").members.map((m) => m.rule)).toEqual(["the first name, with no value: 0 (§6.19)", "IDLE + 1 = 1 (§6.19)", "RUN + 1 = 2 (§6.19)"]);
  });

  it("the standard's own override examples: {bronze = 3, silver, gold} is 3, 4, 5 and {a = 3, b = 7, c} gives c = 8 (§6.19)", () => {
    const medal = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "bronze", value: { kind: "unsized", value: 3 } }, { name: "silver" }, { name: "gold" }] });
    expect(medal.ok).toBe(true);
    expect(medal.members.map((m) => m.value)).toEqual([3, 4, 5]);
    const abc = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "a", value: { kind: "unsized", value: 3 } }, { name: "b", value: { kind: "unsized", value: 7 } }, { name: "c" }] });
    expect(abc.ok).toBe(true);
    expect(abc.members.map((m) => m.value)).toEqual([3, 7, 8]);
  });

  it("every rule carries its clause: an explicit value says 'set to', an unset one names the previous value + 1 (§6.19)", () => {
    expect(resolve("sparse").members.map((m) => m.rule)).toEqual(["set to 3 (§6.19)", "A + 1 = 4 (§6.19)", "set to 7 (§6.19)", "C + 1 = 8 (§6.19)"]);
    expect(resolve("ranges").members[0].rule).toBe("set to 10 (§6.19)");
    for (const p of ENUM_DECL_PRESETS) for (const m of resolveEnumDeclaration(p.spec).members) expect(m.rule).toMatch(/§6\.19/);
  });

  it("the base type in words: the default int holds -2147483648 to 2147483647; bit [0:0] is 1 bit (§6.19, §6.11 Table 6-8)", () => {
    expect(enumBaseText(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "a" }] }))).toBe("int (the default): 32 bits, signed, 2-state, holds -2147483648 to 2147483647");
    expect(enumBaseText(resolveEnumDeclaration({ base: vectorBase("bit", 1), names: [{ name: "a" }] }))).toBe("bit [0:0]: 1 bit, unsigned, 2-state, holds 0 to 1");
  });

  it("some names may be set and others not: {A = 3, B, C = 7, D} is 3, 4, 7, 8 (§6.19)", () => {
    expect(valuesOf("sparse")).toEqual({ A: 3, B: 4, C: 7, D: 8 });
    expect(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "a" }, { name: "b", value: { kind: "unsized", value: 7 } }, { name: "c" }] }).members.map((m) => m.value)).toEqual([0, 7, 8]);
  });

  it("name[N] makes name0..nameN-1 and name[N:M] counts from N to M, continuing the values (§6.19.2, Table 6-10)", () => {
    expect(valuesOf("ranges")).toEqual({ add: 10, sub0: 11, sub1: 12, sub2: 13, jmp6: 14, jmp7: 15, jmp8: 16 });
    // The standard's own examples: sub[5] gives 11..15 and jmp[6:8] 16..18; register[2] = 1, register[2:4] = 10.
    const e1 = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "add", value: { kind: "unsized", value: 10 } }, { name: "sub", range: { count: 5 } }, { name: "jmp", range: { from: 6, to: 8 } }] });
    expect(e1.members.map((m) => `${m.name}=${m.value}`).join(" ")).toBe("add=10 sub0=11 sub1=12 sub2=13 sub3=14 sub4=15 jmp6=16 jmp7=17 jmp8=18");
    const vr = resolveEnumDeclaration({
      base: DEFAULT_ENUM_BASE,
      names: [
        { name: "register", range: { count: 2 }, value: { kind: "unsized", value: 1 } },
        { name: "register", range: { from: 2, to: 4 }, value: { kind: "unsized", value: 10 } },
      ],
    });
    expect(vr.ok).toBe(true);
    expect(vr.members.map((m) => `${m.name}=${m.value}`).join(" ")).toBe("register0=1 register1=2 register2=10 register3=11 register4=12");
    // A decrementing range.
    expect(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "r", range: { from: 3, to: 1 } }] }).members.map((m) => m.name)).toEqual(["r3", "r2", "r1"]);
  });

  it("name[N] needs a positive N and name[N:M] non-negative bounds (§6.19.2, Table 6-10)", () => {
    expect(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "r", range: { count: 0 } }] }).issues[0].kind).toBe("range-bounds");
    expect(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "r", range: { from: -1, to: 2 } }] }).issues[0].kind).toBe("range-bounds");
    const frac = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "r", range: { count: 1.5 } }] }).issues[0];
    expect(frac).toMatchObject({ kind: "range-bounds", clause: "§6.19.2, Table 6-10" });
    expect(frac.message).toContain("(§6.19.2, Table 6-10)");
    const negTo = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "r", range: { from: 2, to: -1 } }] }).issues[0];
    expect(negTo).toMatchObject({ kind: "range-bounds", clause: "§6.19.2, Table 6-10" });
    expect(negTo.message).toContain("(§6.19.2, Table 6-10)");
  });

  it("values shall be unique, set explicitly or by incrementing: {A = 0, B = 7, C, D = 8} is an error (§6.19)", () => {
    const r = resolve("duplicate");
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ kind: "duplicate-value", member: "D", other: "C" });
    expect(r.issues[0].message).toContain("C and D are both 8");
    expect(r.members.filter((m) => m.inError).map((m) => m.name)).toEqual(["C", "D"]);
  });

  it("names shall be unique too (§6.19)", () => {
    const r = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "sub0" }, { name: "sub", range: { count: 2 } }] });
    expect(r.issues.map((i) => i.kind)).toEqual(["duplicate-name"]);
  });

  it("automatically incrementing the largest value the base holds is an error: bit [1:0] with five names (§6.19)", () => {
    const r = resolve("overflow");
    expect(kinds("overflow")).toEqual(["increment-overflow"]);
    expect(r.members.map((m) => m.value)).toEqual([0, 1, 2, 3, null]);
    expect(r.issues[0].message).toContain("S4 is an error: it would be S3 + 1 = 4");
    // The error is on S4 only; S3 = 3 is legal.
    expect(r.members.filter((m) => m.inError).map((m) => m.name)).toEqual(["S4"]);
    // The standard's own example: enum bit [0:0] {a, b, c} needs at least 2 bits ("Error in c declaration").
    const abc = resolveEnumDeclaration({ base: vectorBase("bit", 1), names: [{ name: "a" }, { name: "b" }, { name: "c" }] });
    expect(abc.issues[0]).toMatchObject({ kind: "increment-overflow", member: "c" });
    expect(abc.members.filter((m) => m.inError).map((m) => m.name)).toEqual(["c"]);
    // The default int: incrementing 2147483647 is an error; incrementing a negative value is not.
    const intMax = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "a", value: { kind: "unsized", value: 2 ** 31 - 1 } }, { name: "b" }] });
    expect(intMax.issues.map((i) => `${i.kind}:${i.member}`)).toEqual(["increment-overflow:b"]);
    const neg = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "a", value: { kind: "unsized", value: -5 } }, { name: "b" }] });
    expect(neg.ok).toBe(true);
    expect(neg.members.map((m) => m.value)).toEqual([-5, -4]);
  });

  it("a value outside the base type's range is an error, for unsigned and signed bases (§6.19)", () => {
    const u = resolveEnumDeclaration({ base: vectorBase("bit", 2), names: [{ name: "A", value: { kind: "unsized", value: 4 } }] });
    expect(u.issues.map((i) => i.kind)).toEqual(["out-of-range"]);
    expect(u.members[0].value).toBe(0); // the value after the cast (§6.19)
    const neg = resolveEnumDeclaration({ base: vectorBase("bit", 2), names: [{ name: "A", value: { kind: "unsized", value: -1 } }] });
    expect(neg.issues.map((i) => i.kind)).toEqual(["out-of-range"]);
    expect(neg.members[0].value).toBe(3);
    const signed = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "A", value: { kind: "unsized", value: -1 } }, { name: "B" }] });
    expect(signed.ok).toBe(true);
    expect(signed.members.map((m) => m.value)).toEqual([-1, 0]);
    expect([signed.min, signed.max]).toEqual([-(2 ** 31), 2 ** 31 - 1]);
  });

  it("the range check is the cast's discarded-bits rule, not a numeric comparison (§6.19)", () => {
    // -1 is a 32-bit signed int; the cast to a 32-bit unsigned base drops no bits, so it is legal and gives 32'hFFFFFFFF.
    const u32 = resolveEnumDeclaration({ base: vectorBase("bit", 32), names: [{ name: "A", value: { kind: "unsized", value: -1 } }] });
    expect(u32.ok).toBe(true);
    expect(u32.members[0].value).toBe(2 ** 32 - 1);
    expect(u32.members[0].rule).toBe("set to -1, which the cast to bit [31:0] makes 4294967295 (§6.19)");
    // 32'hFFFFFFFF on int drops no bits either, so it is legal and gives -1.
    const i32 = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "A", value: { kind: "sized", width: 32, value: 0xffffffff } }] });
    expect(i32.ok).toBe(true);
    expect(i32.members[0].value).toBe(-1);
    // -1 on bit [3:0]: the dropped bits are ones, so it is an error, and the cast value is 15.
    expect(castEnumLiteral({ kind: "unsized", value: -1 }, vectorBase("bit", 4))).toEqual({ value: 15, outOfRange: true });
    // A signed base: discarded bits must equal the sign bit of the result.
    const s8: Parameters<typeof castEnumLiteral>[1] = { decl: "byte", label: "byte", width: 8, signed: true, states: 2 };
    expect(castEnumLiteral({ kind: "unsized", value: -128 }, s8)).toEqual({ value: -128, outOfRange: false });
    expect(castEnumLiteral({ kind: "unsized", value: 128 }, s8)).toEqual({ value: -128, outOfRange: true });
    expect(castEnumLiteral({ kind: "unsized", value: -129 }, s8)).toEqual({ value: 127, outOfRange: true });
    // An unsized number wider than 32 bits: its width is the tool's, so the model says what it assumed.
    const wide = resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "A", value: { kind: "unsized", value: 2 ** 40 } }] });
    expect(wide.issues.map((i) => i.kind)).toEqual(["out-of-range"]);
    expect(wide.notes.join(" ")).toContain("up to the tool");
    expect(wide.notes.join(" ")).toContain("does not fit in a signed 32-bit integer");
  });

  it("a sized literal must have the base type's size, even when the value fits: bit [3:0] {LOW = 3'h1} (§6.19)", () => {
    expect(kinds("sized")).toEqual(["sized-width"]);
    // The standard's examples: 4'h3 and 4'h5 are redundant but legal; 5'h13 and 3'h5 are errors.
    const ok = resolveEnumDeclaration({ base: vectorBase("bit", 4), names: [{ name: "bronze", value: { kind: "sized", width: 4, value: 3 } }, { name: "silver" }, { name: "gold", value: { kind: "sized", width: 4, value: 5 } }] });
    expect(ok.ok).toBe(true);
    expect(ok.members.map((m) => m.value)).toEqual([3, 4, 5]);
    const medal4 = resolveEnumDeclaration({ base: vectorBase("bit", 4), names: [{ name: "bronze", value: { kind: "sized", width: 5, value: 0x13 } }, { name: "silver" }, { name: "gold", value: { kind: "sized", width: 3, value: 5 } }] });
    expect(medal4.issues.filter((i) => i.kind === "sized-width").map((i) => i.member)).toEqual(["bronze", "gold"]);
    // "Error in the bronze and gold member declarations": nothing on silver. 5'h13 casts to 3, so silver = 4 (§6.19).
    expect(medal4.issues.map((i) => `${i.kind}:${i.member}`)).toEqual(["out-of-range:bronze", "sized-width:bronze", "sized-width:gold"]);
    expect(medal4.members.map((m) => m.value)).toEqual([3, 4, 5]);
    expect(medal4.members[1]).toMatchObject({ name: "silver", rule: "bronze + 1 = 4 (§6.19)", inError: false });
    expect(medal4.members[0].rule).toBe("set to 5'h13, which the cast to bit [3:0] makes 3 (§6.19)");
    expect(enumNumberLine(medal4).slots.map((s) => s.from)).toEqual([3, 4, 5]);
  });

  it("x or z needs a 4-state base: logic [1:0] {OK, BAD = 'x} compiles, a bit or int base does not (§6.19)", () => {
    expect(resolve("xz").ok).toBe(true);
    expect(valuesOf("xz")).toEqual({ OK: 0, BAD: "x" });
    expect(resolveEnumDeclaration({ base: vectorBase("bit", 2), names: [{ name: "OK" }, { name: "BAD", value: { kind: "xz", bit: "x" } }] }).issues[0].kind).toBe("xz-2state");
    expect(resolveEnumDeclaration({ base: DEFAULT_ENUM_BASE, names: [{ name: "BAD", value: { kind: "xz", bit: "z" } }] }).issues[0].kind).toBe("xz-2state");
  });

  it("an unassigned name after a name with an x or z value is an error (§6.19)", () => {
    const r = resolveEnumDeclaration({ base: vectorBase("logic", 2), names: [{ name: "IDLE" }, { name: "XX", value: { kind: "xz", bit: "x" } }, { name: "S1" }, { name: "S2" }] });
    expect(r.issues.map((i) => i.kind)).toEqual(["unassigned-after-xz"]);
    expect(r.issues[0].member).toBe("S1");
    expect(r.members.map((m) => m.value)).toEqual([0, "x", null, null]);
    // XX = 'x is legal; the error is on S1, and S2 is part of the same error.
    expect(r.members.filter((m) => m.inError).map((m) => m.name)).toEqual(["S1"]);
    // S2 carries no error mark, so its rule says where the error is reported rather than calling S2 an error.
    expect(r.members[3].rule).toBe("no value: S1 has none to add one to (§6.19); the error is reported on an earlier name");
  });

  it("two x or z names: the model says it does not decide whether they collide", () => {
    const r = resolveEnumDeclaration({ base: vectorBase("logic", 2), names: [{ name: "A", value: { kind: "xz", bit: "x" } }, { name: "B", value: { kind: "xz", bit: "z" } }] });
    expect(r.ok).toBe(true);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toContain("does not decide");
  });

  it("a binary sized literal is padded to its width, as the standard writes it (2'b01)", () => {
    expect(literalText({ kind: "sized", width: 2, value: 1, radix: "b" })).toBe("2'b01");
    expect(literalText({ kind: "sized", width: 4, value: 0xf })).toBe("4'hF");
  });

  it("the declaration text is generated from the spec", () => {
    expect(ENUM_DECL_PRESETS.map((p) => enumSpecText(p.spec))).toEqual([
      "enum {IDLE, RUN, DONE}",
      "enum {A = 3, B, C = 7, D}",
      "enum {add = 10, sub[3], jmp[6:8]}",
      "enum {A = 0, B = 7, C, D = 8}",
      "enum bit [1:0] {S0, S1, S2, S3, S4}",
      "enum bit [3:0] {LOW = 3'h1}",
      "enum logic [1:0] {OK, BAD = 'x}",
    ]);
    expect(enumSpecText(OPCODE_DECL)).toBe("enum logic [3:0] {OP_NOP = 4'h0, OP_READ = 4'h1, OP_WRITE = 4'h2, OP_IRQ = 4'hF}");
  });

  it("the number line shows each value, the gaps, collisions and the names off the line", () => {
    const sparse = enumNumberLine(resolve("sparse"));
    expect(sparse.slots.map((s) => (s.kind === "gap" ? `(${s.from})` : `${s.from}:${s.members.join("")}`))).toEqual(["3:A", "4:B", "(5)", "(6)", "7:C", "8:D"]);
    const dup = enumNumberLine(resolve("duplicate"));
    expect(dup.slots.find((s) => s.from === 8)?.members).toEqual(["C", "D"]);
    expect(dup.slots.filter((s) => s.kind === "gap")).toEqual([{ kind: "gap", from: 1, to: 6, members: [] }]);
    expect(enumNumberLine(resolve("overflow")).offLine.map((m) => m.name)).toEqual(["S4"]);
    expect(enumNumberLine(resolve("xz")).offLine.map((m) => m.name)).toEqual(["BAD"]);
  });

  it("grading: an error declaration is right only as a compile error; a legal one needs every value", () => {
    expect(gradeEnumDeclPrediction(resolve("duplicate"), { compiles: false, values: {} }).correct).toBe(true);
    const wrong = gradeEnumDeclPrediction(resolve("duplicate"), { compiles: true, values: { A: 0, B: 7, C: 8, D: 8 } });
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback).toContain("does not compile");
    const sparse = resolve("sparse");
    expect(gradeEnumDeclPrediction(sparse, { compiles: true, values: { A: 3, B: 4, C: 7, D: 8 } }).correct).toBe(true);
    const plusOne = gradeEnumDeclPrediction(sparse, { compiles: true, values: { A: 3, B: 4, C: 7, D: 5 } });
    expect(plusOne.correct).toBe(false);
    expect(plusOne.feedback).toContain("D is 8, not 5");
    expect(plusOne.feedback).toContain("C + 1 = 8");
    expect(gradeEnumDeclPrediction(resolve("xz"), { compiles: false, values: {} }).feedback).toContain("Not quite: it compiles");
  });

  it("the prediction choices come from the declaration text, not from the answer", () => {
    expect(enumPredictionChoices(enumDeclPreset("sparse").spec)).toEqual(Array.from({ length: 13 }, (_, i) => i));
    const choices = enumPredictionChoices(enumDeclPreset("ranges").spec);
    for (const v of Object.values(valuesOf("ranges"))) expect(choices).toContain(v);
  });
});

describe("enum methods with explicit values (§6.19.5)", () => {
  const sparse = enumTypeFromDeclaration(resolve("sparse"), "abcd_e") as EnumTypeModel;

  it("a legal numeric declaration becomes a method model; an error or x value does not", () => {
    expect(sparse.values).toEqual([3, 4, 7, 8]);
    expect(enumTypeFromDeclaration(resolve("duplicate"), "e")).toBeNull();
    expect(enumTypeFromDeclaration(resolve("xz"), "e")).toBeNull();
    expect(enumDeclaration(sparse)).toBe("typedef enum { A = 3, B = 4, C = 7, D = 8 } abcd_e;");
  });

  it("next() follows declaration order across value gaps: from B (4) it returns C (7), not 5 (§6.19.5.3)", () => {
    const r = callEnumMethod(sparse, 4, "next");
    expect(r.returns).toEqual({ kind: "enum", value: 7 });
    expect(r.why).toContain("from 4 to 7: next() follows declaration order, not the value plus one");
    expect(callEnumMethod(sparse, 8, "next").returns).toEqual({ kind: "enum", value: 3 });
    expect(callEnumMethod(sparse, 7, "prev").returns).toEqual({ kind: "enum", value: 4 });
    expect(callEnumMethod(sparse, 3, "prev", 2).returns).toEqual({ kind: "enum", value: 7 });
  });

  it("5 is not a member, so next() of 5 returns the default 0, which is not a member either (§6.19.5.3, Table 6-7)", () => {
    expect(isMember(sparse, 5)).toBe(false);
    expect(callEnumMethod(sparse, 5, "next").returns).toEqual({ kind: "enum", value: 0 });
    expect(formatEnumValue(sparse, 0)).toBe("0 (not a member)");
  });

  it("a descending declaration still says next() is not the value plus one (§6.19.5.3)", () => {
    const down: EnumTypeModel = { name: "down_e", baseDecl: "", states: 2, members: ["A", "B", "C"], values: [2, 1, 0] };
    expect(callEnumMethod(down, 2, "next").why).toContain("from 2 to 1: next() follows declaration order, not the value plus one");
    expect(callEnumMethod(down, 1, "prev").why).toContain("from 1 to 2: prev() follows declaration order, not the value minus one");
    // A consecutive step says nothing extra.
    expect(callEnumMethod(sparse, 3, "next").why).not.toContain("follows declaration order");
  });

  it("nextStepQuestion: before a gap it offers the value plus one; at the end it offers 'stays' and the wrap is right (§6.19.5.3)", () => {
    const q = nextStepQuestion(sparse);
    expect(q.start).toBe(4);
    expect(q.options.map((o) => [o.id, o.label, o.correct])).toEqual([
      ["order", "C (7)", true],
      ["plus-one", "5, the value plus one", false],
      ["error", "A run-time error", false],
    ]);
    const implicit = enumTypeFromDeclaration(resolve("implicit"), "e") as EnumTypeModel;
    const wrap = nextStepQuestion(implicit);
    expect(wrap.start).toBe(2);
    expect(wrap.options.map((o) => [o.id, o.label, o.correct])).toEqual([
      ["order", "IDLE (0)", true],
      ["plus-one", "3, the value plus one", false],
      ["stays", "DONE again: next() stops at the last member", false],
      ["error", "A run-time error", false],
    ]);
    // One member: the wrap lands on the same member, so no wrong option names the right answer.
    const one = nextStepQuestion({ name: "one_e", baseDecl: "", states: 2, members: ["A"], values: [3] });
    expect(one.options.map((o) => o.id)).toEqual(["order", "plus-one", "error"]);
    expect(one.options.filter((o) => o.label === "A (3)")).toHaveLength(1);
  });

  it("first(), last() and name() use the encodings (§6.19.5.1, §6.19.5.2, §6.19.5.6)", () => {
    expect(callEnumMethod(sparse, 5, "first").returns).toEqual({ kind: "enum", value: 3 });
    expect(callEnumMethod(sparse, 5, "last").returns).toEqual({ kind: "enum", value: 8 });
    expect(callEnumMethod(sparse, 7, "name").returns).toEqual({ kind: "string", value: "C" });
    expect(formatEnumValue(sparse, 7)).toBe("C (7)");
  });
});

describe("putting a number into an enum (§6.19.3, §6.19.4, §6.24.2)", () => {
  const op = enumTypeFromDeclaration(resolveEnumDeclaration(OPCODE_DECL), "opcode_e") as EnumTypeModel;
  const run = (raw: number) =>
    (["plain", "static-cast", "dynamic-cast", "dynamic-cast-task"] as const).map((f) => assignIntToEnum(op, 0, raw, f, { varName: "op", sourceText: "raw" }));

  it("generates the lesson's four statements", () => {
    expect(run(2).map((r) => r.code)).toEqual(["op = raw;", "op = opcode_e'(raw);", "ok = $cast(op, raw);", "$cast(op, raw);"]);
  });

  it("every cast sentence carries its clause", () => {
    for (const raw of [2, 7]) for (const r of run(raw)) expect(r.why).toMatch(/§6\.(19\.[34]|24\.2)/);
    expect(run(2)[1].why).toBe("The static cast converts 2 to opcode_e; it is a member, so op is OP_WRITE (§6.19.4).");
  });

  it("raw = 2 (a member): compile error, then OP_WRITE three times, with ok = 1 for the function form", () => {
    expect(run(2).map((r) => [r.outcome, r.after])).toEqual([
      ["compile-error", 0],
      ["assigned", 2],
      ["assigned-ok-1", 2],
      ["assigned", 2],
    ]);
  });

  it("raw = 7 (not a member): the static cast stores 7 unchecked, $cast returns 0, the task form is a run-time error; op stays OP_NOP", () => {
    const rows = run(7);
    expect(rows.map((r) => [r.outcome, r.after])).toEqual([
      ["compile-error", 0],
      ["assigned", 7],
      ["unchanged-ok-0", 0],
      ["runtime-error", 0],
    ]);
    expect(rows[3].runtimeError).toBe(true);
    expect(rows[3].why).toContain("run-time error occurs and op is left unchanged (§6.24.2)");
    expect(rows[3].why).toContain("The compiler does no type checking for the task form (§6.24.2), so the failure shows only at run time.");
    expect(callEnumMethod(op, rows[1].after, "name").returns).toEqual({ kind: "string", value: "" });
  });

  it("the packed-struct back door takes any bits, unchecked (derived from §7.2.1 and §6.19.3)", () => {
    const w = writeEnumThroughPackedStruct(op, 7);
    expect(w).toMatchObject({ code: "c = vif.bus;", after: 7, outcome: "assigned", derived: true });
    expect(w.why).toContain('c.op.name() returns ""');
    expect(writeEnumThroughPackedStruct(op, 2).why).toContain("OP_WRITE (2)");
  });

  it("keeps the default variable name s for the methods tab", () => {
    expect(assignIntToEnum(intEnum, 0, 7, "plain").code).toBe("s = 7;");
    expect(assignIntToEnum(intEnum, 0, 7, "dynamic-cast-task").code).toBe("$cast(s, 7);");
  });
});

describe("string methods (§6.16)", () => {
  it("getc out of range returns 0, without an error (§6.16.3)", () => {
    expect(callStringMethod("abc", "getc", { i: 3 }).returns).toBe("0");
    expect(callStringMethod("abc", "getc", { i: -1 }).returns).toBe("0");
    expect(callStringMethod("", "getc", { i: 0 }).returns).toBe("0");
    expect(callStringMethod("abc", "getc", { i: 1 }).returns).toBe("98 ('b')");
  });

  it("putc out of range or with a zero character leaves the string unchanged (§6.16.2)", () => {
    expect(callStringMethod("abc", "putc", { i: 5, c: "X" }).after).toBe("abc");
    expect(callStringMethod("", "putc", { i: 0, c: "X" }).after).toBe("");
    expect(callStringMethod("abc", "putc", { i: 1, c: "" }).after).toBe("abc");
    expect(callStringMethod("abc", "putc", { i: 1, c: "X" }).after).toBe("aXc");
  });

  it("substr(i, j) is inclusive and returns \"\" for an invalid range (§6.16.8)", () => {
    expect(callStringMethod("SystemVerilog", "substr", { i: 0, j: 5 }).returns).toBe('"System"');
    expect(callStringMethod("abc", "substr", { i: 1, j: 3 }).returns).toBe('""');
    expect(callStringMethod("abc", "substr", { i: 2, j: 1 }).returns).toBe('""');
  });

  it("toupper/tolower return a new string and leave s unchanged (§6.16.4–5)", () => {
    const r = callStringMethod("Abc", "toupper");
    expect(r.returns).toBe('"ABC"');
    expect(r.after).toBe("Abc");
    expect(callStringMethod("", "len").returns).toBe("0");
  });
});
