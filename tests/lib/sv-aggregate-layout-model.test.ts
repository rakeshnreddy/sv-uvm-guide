import { describe, expect, it } from "vitest";

import {
  BASE_TB,
  CMD_T_ENUM,
  LESSON_EXPECTED_FAILURES,
  MUTATIONS,
  OPCODE_E,
  TB_CHECKS,
  UNDEFINED_TAGGED,
  assignPattern,
  assignWhole,
  assignmentLegality,
  changedLogLines,
  changedReadsText,
  enumCast,
  enumInitialValue,
  enumMemberReadout,
  enumName,
  enumNext,
  failingChecks,
  fillWhole,
  formatB,
  formatD,
  formatH,
  formatHexGroups,
  formatSizedHex,
  formatTaggedP,
  formatUnionP,
  hexAligned,
  makeTagged,
  memberRanges,
  mutate,
  mutationBoard,
  nibbleOverlay,
  randMemberCard,
  readMember,
  readTagged,
  readUnionPath,
  reorderMembers,
  rewidthVector,
  runTbTop,
  setMemberWidth,
  structBits,
  structInitialValue,
  structStates,
  structTypedef,
  structVectorCards,
  svHex,
  tagWidth,
  taggedPReading,
  taggedPackedBits,
  taggedPackedLayout,
  taggedTypedef,
  unionInitialValue,
  unionPathStates,
  unionProblems,
  unionRows,
  unionStates,
  unionTypedef,
  unionWidth,
  unpackedWholeAssignCard,
  writeMember,
  writeUnionPath,
  writeXInMember,
  xWriteOffer,
  type EnumSpec,
  type PackedMember,
  type TaggedUnionType,
  type TypeRef,
  type UnionType,
} from "@/lib/sv-aggregate-layout-model";
import { callEnumMethod, type EnumTypeModel } from "@/lib/sv-enum-string-model";
import { bitsOf, fromBigInt } from "@/lib/sv-expression-model";

const PKT_LIKE: PackedMember[] = [
  { id: "kind", name: "kind", width: 2, type: { kind: "logic" } },
  { id: "seq", name: "seq", width: 6, type: { kind: "logic" } },
  { id: "len", name: "len", width: 8, type: { kind: "logic" } },
  { id: "crc", name: "crc", width: 16, type: { kind: "logic" } },
];

const cmdT: PackedMember[] = [
  { id: "op", name: "op", width: 4, type: { kind: "logic" } },
  { id: "addr", name: "addr", width: 12, type: { kind: "logic" } },
  { id: "data", name: "data", width: 16, type: { kind: "logic" } },
];

describe("packed struct layout (§7.2.1, §20.6.2)", () => {
  it("the first member is the most significant and members are contiguous down to bit 0 (§7.2.1)", () => {
    expect(memberRanges(cmdT)).toEqual([
      { id: "op", name: "op", hi: 31, lo: 28, width: 4 },
      { id: "addr", name: "addr", hi: 27, lo: 16, width: 12 },
      { id: "data", name: "data", hi: 15, lo: 0, width: 16 },
    ]);
  });

  it("$bits is the sum of the member widths (§20.6.2)", () => {
    expect(structBits(cmdT)).toBe(32);
    expect(structBits(setMemberWidth(cmdT, "data", 8))).toBe(24);
  });

  it("reading members splits 32'h5ABC_0042 along the layout: op = 5, not 2 (the C bit-field habit)", () => {
    const c = svHex(32, "5ABC_0042");
    expect(formatSizedHex(readMember(cmdT, c, "op"))).toBe("4'h5");
    expect(formatSizedHex(readMember(cmdT, c, "addr"))).toBe("12'hABC");
    expect(formatSizedHex(readMember(cmdT, c, "data"))).toBe("16'h0042");
  });

  it("writing one member touches only its bits [27:16] (§7.2.1)", () => {
    const c = svHex(32, "5ABC_0042");
    const w = writeMember(cmdT, c, "addr", svHex(12, "0FF"));
    expect(formatSizedHex(w.value)).toBe("32'h50FF_0042");
    expect(w.written[0]).toBe(27);
    expect(w.written[w.written.length - 1]).toBe(16);
    expect(w.changed.every((b) => b >= 16 && b <= 27)).toBe(true);
  });

  it("a narrower unsigned value assigned to the whole struct is zero-extended with no required warning (§6.22.3, §10.7)", () => {
    const a = assignWhole(cmdT, svHex(16, "BEEF"));
    expect(formatSizedHex(a.value)).toBe("32'h0000_BEEF");
    expect(a.extendedFrom).toBe(16);
    expect(a.note).toMatch(/No warning is required/);
    expect(formatSizedHex(readMember(cmdT, a.value, "op"))).toBe("4'h0");
    expect(formatSizedHex(readMember(cmdT, a.value, "addr"))).toBe("12'h000");
  });

  it("a wider value loses its most significant bits (§10.7)", () => {
    const a = assignWhole(cmdT, svHex(36, "F_5ABC_0042"));
    expect(formatSizedHex(a.value)).toBe("32'h5ABC_0042");
    expect(a.droppedFrom).toBe(32);
  });

  it("reversing addr and data re-slices the same vector (the lesson's step 3)", () => {
    const reversed = reorderMembers(cmdT, ["op", "data", "addr"]);
    expect(memberRanges(reversed).map((r) => `${r.name}${r.hi}:${r.lo}`)).toEqual(["op31:28", "data27:12", "addr11:0"]);
    const c = svHex(32, "5ABC_0042");
    expect(formatSizedHex(readMember(reversed, c, "addr"))).toBe("12'h042");
    expect(formatSizedHex(readMember(reversed, c, "data"))).toBe("16'hABC0");
  });

  it("width edits are clamped to 1..16 bits and never change an enum member", () => {
    expect(setMemberWidth(cmdT, "op", 40)[0].width).toBe(16);
    expect(setMemberWidth(cmdT, "op", 0)[0].width).toBe(1);
    expect(setMemberWidth(CMD_T_ENUM, "op", 9)[0].width).toBe(4);
  });

  it("the struct is 4-state when any member is 4-state; a 2-state member converts x to 0 on write (§6.11.2)", () => {
    expect(structStates(cmdT)).toBe(4);
    const mixed: PackedMember[] = [{ id: "a", name: "a", width: 4, type: { kind: "bit" } }, { id: "b", name: "b", width: 4, type: { kind: "logic" } }];
    expect(structStates(mixed)).toBe(4);
    const allBit: PackedMember[] = [{ id: "a", name: "a", width: 4, type: { kind: "bit" } }];
    expect(structStates(allBit)).toBe(2);
    const x = writeXInMember(cmdT, svHex(32, "5ABC_0042"), "op");
    expect(bitsOf(x.value).slice(0, 4)).toEqual(["x", "x", "x", "x"]);
    expect(x.structStates).toBe(4);
    // State-ness comes from the declared types, so the note must not say the x made the struct 4-state, or that every member can carry x.
    expect(x.note).toBe("op is a 4-state member, so the struct is a 4-state vector whether or not any bit is x (§7.2.1); read as one vector it now shows x in bits [31:28].");
    const twoState = writeXInMember(mixed, svHex(8, "00"), "a");
    expect(bitsOf(twoState.value)).toEqual(["0", "0", "0", "0", "0", "0", "0", "0"]);
    expect(twoState.note).toMatch(/2-state member/);
    // §7.2.1 only says a conversion happens; x becoming 0 is §6.11.2.
    expect(twoState.note).toMatch(/x converts to 0 on the way in \(§6\.11\.2\)/);
    expect(twoState.note).not.toMatch(/§7\.2\.1/);
  });

  it("a signed source is sign-extended, in the value and in the note, for a member and for the whole struct (§10.7)", () => {
    const signed8 = fromBigInt(BigInt(-128), 8, true);
    const member = writeMember(cmdT, svHex(32, "0000_0000"), "data", signed8);
    expect(formatSizedHex(member.value)).toBe("32'h0000_FF80");
    expect(member.note).toMatch(/The 8-bit source is sign-extended to 16 bits \(§10\.7\)\.$/);
    const unsigned = writeMember(cmdT, svHex(32, "0000_0000"), "data", svHex(8, "80"));
    expect(formatSizedHex(unsigned.value)).toBe("32'h0000_0080");
    expect(unsigned.note).toMatch(/The 8-bit source is zero-extended to 16 bits \(§10\.7\)\.$/);
    const whole = assignWhole(cmdT, signed8);
    expect(formatSizedHex(whole.value)).toBe("32'hFFFF_FF80");
    expect(whole.note).toMatch(/sign-extended to 32 bits: bits \[31:8\] are filled with the sign bit/);
  });

  it("a 2-state enum in a 4-state struct: the part-select the explorer offers stores x, and only a read through the member gives 0 (derived from §7.2.1, §6.11.2)", () => {
    const bitOp: EnumSpec = { ...OPCODE_E, baseDecl: "bit [3:0]", states: 2 };
    const members: PackedMember[] = [{ id: "op", name: "op", width: 4, type: { kind: "enum", spec: bitOp } }, ...cmdT.slice(1)];
    expect(xWriteOffer("c", members, "op")).toEqual({ label: "c[31:28] = 4'bx;", partSelect: true });
    const w = writeXInMember(members, svHex(32, "2ABC_0042"), "op");
    expect(formatSizedHex(w.value)).toBe("32'hxABC_0042");
    expect(formatSizedHex(readMember(members, w.value, "op"))).toBe("4'h0");
    expect(w.note).toMatch(/the bits hold x; a read through the 2-state member op converts them to 0 \(derived from §7\.2\.1, §6\.11\.2\)/);
    // With no 4-state member the struct is a 2-state vector, so even the part-select cannot store x.
    const allTwoState: PackedMember[] = [{ id: "op", name: "op", width: 4, type: { kind: "enum", spec: bitOp } }, { id: "d", name: "d", width: 4, type: { kind: "bit" } }];
    expect(bitsOf(writeXInMember(allTwoState, svHex(8, "2A"), "op").value).slice(0, 4)).toEqual(["0", "0", "0", "0"]);
  });

  it("hex overlay: only members on 4-bit boundaries read straight off the hex; kind and seq of pkt_hdr_t share digit 7", () => {
    const ranges = memberRanges(cmdT);
    expect(ranges.map((r) => hexAligned(cmdT, r.name))).toEqual([true, true, true]);
    const pkt: PackedMember[] = [
      { id: "kind", name: "kind", width: 2, type: { kind: "logic" } },
      { id: "seq", name: "seq", width: 6, type: { kind: "logic" } },
      { id: "len", name: "len", width: 8, type: { kind: "logic" } },
      { id: "crc", name: "crc", width: 16, type: { kind: "logic" } },
    ];
    expect(memberRanges(pkt).map((r) => hexAligned(pkt, r.name))).toEqual([false, false, true, true]);
    const overlay = nibbleOverlay(pkt, svHex(32, "C1FF_0000"));
    expect(overlay[0]).toMatchObject({ index: 7, hi: 31, lo: 28, members: ["kind", "seq"], digit: "c" });
    expect(overlay[1]).toMatchObject({ index: 6, members: ["seq"], digit: "1" });
    expect(overlay.slice(2, 4).map((n) => n.members)).toEqual([["len"], ["len"]]);
  });

  it("hexAligned decides from the digits a member owns: a top member of a 31-bit struct has its short top digit to itself", () => {
    const m31: PackedMember[] = [
      { id: "top", name: "top", width: 3, type: { kind: "logic" } },
      { id: "mid", name: "mid", width: 12, type: { kind: "logic" } },
      { id: "low", name: "low", width: 16, type: { kind: "logic" } },
    ];
    expect(memberRanges(m31)[0]).toMatchObject({ hi: 30, lo: 28 });
    expect(m31.map((m) => hexAligned(m31, m.name))).toEqual([true, true, true]);
    const shifted: PackedMember[] = [
      { id: "top", name: "top", width: 5, type: { kind: "logic" } },
      { id: "low", name: "low", width: 11, type: { kind: "logic" } },
    ];
    expect(shifted.map((m) => hexAligned(shifted, m.name))).toEqual([false, false]);
  });

  it("a never-assigned struct is all x when any member is 4-state and all 0 when none is (Table 6-7, §7.2.1)", () => {
    expect(formatSizedHex(structInitialValue(cmdT))).toBe("32'hxxxx_xxxx");
    expect(formatSizedHex(structInitialValue(CMD_T_ENUM))).toBe("32'hxxxx_xxxx");
    const allBit: PackedMember[] = [{ id: "a", name: "a", width: 8, type: { kind: "bit" } }];
    expect(formatSizedHex(structInitialValue(allBit))).toBe("8'h00");
  });

  it("a width edit keeps the low bits; the new top bits of a 4-state vector are x, and of a 2-state vector 0 (Table 6-7)", () => {
    expect(formatSizedHex(rewidthVector(svHex(8, "AB"), 4, 4))).toBe("4'hB");
    expect(formatSizedHex(rewidthVector(svHex(8, "AB"), 12, 4))).toBe("12'hxAB");
    expect(formatSizedHex(rewidthVector(svHex(8, "AB"), 12, 2))).toBe("12'h0AB");
    expect(formatSizedHex(rewidthVector(structInitialValue(cmdT), 36, 4))).toBe("36'hx_xxxx_xxxx");
  });

  it("'0 is a fill literal sized by its assignment context, so it is never extended or truncated (§5.7.1)", () => {
    const narrow = setMemberWidth(cmdT, "data", 8);
    const a = fillWhole(narrow);
    expect(formatSizedHex(a.value)).toBe("24'h00_0000");
    expect(a.extendedFrom).toBeUndefined();
    expect(a.droppedFrom).toBeUndefined();
    expect(a.note).toMatch(/all 24 bits become 0 and nothing is extended or truncated \(§5\.7\.1\)/);
  });

  it("structTypedef leaves out the range comments on request, and keeps the type and $bits lines", () => {
    expect(structTypedef("cmd_t", cmdT)).toMatch(/op;\s+\/\/ \[31:28\]/);
    const hidden = structTypedef("cmd_t", cmdT, true, false);
    expect(hidden).not.toMatch(/\[31:28\]/);
    expect(hidden).toMatch(/\$bits\(cmd_t\) == 32/);
  });

  it("an unpacked struct has no bit numbering: part-select and comparison with a literal become compile errors (§7.2.1)", () => {
    const c = svHex(32, "50FF_0042");
    const packed = structVectorCards("c", cmdT, true, c);
    expect(packed.map((k) => k.legal)).toEqual([true, true]);
    expect(packed[0].code).toBe("c[31:28]");
    const unpacked = structVectorCards("c", cmdT, false, c);
    expect(unpacked.map((k) => k.legal)).toEqual([false, false]);
    expect(unpacked[1].code).toBe("c == 32'h50FF_0042");
    // The implementation-dependent-packing sentence is §7.2.1's, so that is the clause cited.
    expect(unpacked[0].clause).toBe("§7.2.1");
    expect(unpacked[0].message).toMatch(/normally matching the C compiler \(§7\.2\.1\)/);
  });

  it("the comparison card uses a known literal of the struct's live width, and warns about x only while the struct holds it (§11.4.5)", () => {
    const known = structVectorCards("c", cmdT, true, svHex(32, "5ABC_0042"));
    expect(known[1].message).not.toMatch(/1'bx/);
    const allX = structVectorCards("c", cmdT, true, structInitialValue(cmdT));
    expect(allX[1].code).toBe("c == 32'h0000_0000");
    expect(allX[1].message).toMatch(/== gives 1'bx; === compares x and z exactly \(§11\.4\.5\)/);
    const partly = structVectorCards("c", cmdT, true, svHex(32, "xABC_0042"));
    expect(partly[1].code).toBe("c == 32'h0ABC_0042");

    const wide = setMemberWidth(cmdT, "op", 8);
    const unpacked = structVectorCards("c", wide, false, svHex(36, "0_5ABC_0042"));
    expect(unpacked[1].code).toBe("c == 36'h0_5ABC_0042");
    expect(unpacked[1].message).toMatch(/a 36-bit literal/);
    expect(unpacked[1].message).not.toMatch(/32-bit/);
  });

  it("a whole-vector statement on an unpacked struct is a compile error: no implicit cast from an integral value (§6.22.3)", () => {
    const card = unpackedWholeAssignCard("cmd_t", "c = 32'h5ABC_0042;");
    expect(card).toMatchObject({ legal: false, clause: "§6.22.3", code: "c = 32'h5ABC_0042;" });
    expect(card.message).toMatch(/'\{default: '0\} \(§10\.9\.2\)/);
    // §6.24.3 converts through a packed value of the source's own bit count, so the source must have the struct's bits.
    expect(card.message).toMatch(/cmd_t'\(word\), with word exactly \$bits\(cmd_t\) bits \(§6\.24\.3\)/);
  });

  it("rand on a packed member does not compile; on an unpacked member it does (§7.2, Syntax 7-1 footnote 20)", () => {
    expect(randMemberCard(true, "op").legal).toBe(false);
    expect(randMemberCard(true, "op").clause).toMatch(/footnote 20/);
    expect(randMemberCard(false, "op").legal).toBe(true);
    // The card shows the member as declared.
    expect(randMemberCard(true, "op").code).toBe("rand logic [3:0] op;");
    expect(randMemberCard(true, "op", "opcode_e")).toMatchObject({ code: "rand opcode_e op;", legal: false });
  });

  it("an assignment pattern by name writes each member whatever the declaration order (§10.9.2)", () => {
    const fields = { op: svHex(4, "2"), addr: svHex(12, "123"), data: svHex(16, "BEEF") };
    expect(formatSizedHex(assignPattern(cmdT, fields))).toBe("32'h2123_BEEF");
    expect(formatSizedHex(assignPattern(reorderMembers(cmdT, ["op", "data", "addr"]), fields))).toBe("32'h2BEE_F123");
  });
});

describe("enums with explicit values (Table 6-7, §6.19.3–§6.19.5, §6.24.2)", () => {
  it("a 4-state base starts at x and a 2-state base at 0 (Table 6-7), even when 0 is OP_NOP", () => {
    expect(bitsOf(enumInitialValue(OPCODE_E))).toEqual(["x", "x", "x", "x"]);
    const bitBase: EnumSpec = { ...OPCODE_E, baseDecl: "bit [3:0]", states: 2 };
    expect(formatSizedHex(enumInitialValue(bitBase))).toBe("4'h0");
    expect(enumName(bitBase, enumInitialValue(bitBase))).toBe("OP_NOP");
    expect(enumName(OPCODE_E, enumInitialValue(OPCODE_E))).toBe("");
  });

  it("name() of a non-member (7, or x) is the empty string (§6.19.5.6)", () => {
    expect(enumName(OPCODE_E, svHex(4, "7"))).toBe("");
    expect(enumName(OPCODE_E, svHex(4, "F"))).toBe("OP_IRQ");
  });

  it("next() follows declaration order and wraps from the last member to the first; a non-member gives the default (§6.19.5.3)", () => {
    expect(enumName(OPCODE_E, enumNext(OPCODE_E, svHex(4, "F")))).toBe("OP_NOP");
    expect(enumName(OPCODE_E, enumNext(OPCODE_E, svHex(4, "2")))).toBe("OP_IRQ");
    expect(bitsOf(enumNext(OPCODE_E, svHex(4, "7")))).toEqual(["x", "x", "x", "x"]);
    // The 2-state branch: the default is 0, which here is OP_NOP (Table 6-7).
    const bitBase = mutate(BASE_TB, "bit-base").opcode;
    expect(formatSizedHex(enumNext(bitBase, svHex(4, "7")))).toBe("4'h0");
    expect(enumName(bitBase, enumNext(bitBase, svHex(4, "7")))).toBe("OP_NOP");
    const withSync = mutate(BASE_TB, "op-sync").opcode;
    expect(enumName(withSync, enumNext(withSync, svHex(4, "F")))).toBe("OP_SYNC");
  });

  it("a 2-state base holds a non-member just the same: name() is \"\" whatever the base (§6.19.4, §6.19.5.6)", () => {
    const bitBase = mutate(BASE_TB, "bit-base").opcode;
    const cast = enumCast(bitBase, enumInitialValue(bitBase), 7, "static");
    expect(formatSizedHex(cast.after)).toBe("4'h7");
    expect(enumName(bitBase, cast.after)).toBe("");
    const members = mutate(BASE_TB, "bit-base").cmd;
    expect(enumMemberReadout(members, svHex(32, "7ABC_0042"), "op").name).toBe("");
  });

  it("agrees with sv-enum-string-model for an enum with consecutive values", () => {
    const spec: EnumSpec = {
      name: "st_e",
      baseDecl: "",
      states: 2,
      width: 32,
      members: [{ name: "IDLE", value: 0 }, { name: "RUN", value: 1 }, { name: "DONE", value: 2 }],
    };
    const model: EnumTypeModel = { name: "st_e", baseDecl: "", states: 2, members: ["IDLE", "RUN", "DONE"] };
    for (const v of [0, 1, 2]) {
      const next = callEnumMethod(model, v, "next").returns;
      expect(formatD(enumNext(spec, svHex(32, v.toString(16))))).toBe(String(next.kind === "enum" ? next.value : ""));
      const name = callEnumMethod(model, v, "name").returns;
      expect(enumName(spec, svHex(32, v.toString(16)))).toBe(name.kind === "string" ? name.value : "");
    }
    expect(enumName(spec, svHex(32, "7"))).toBe("");
  });

  it("a static cast stores 7 without a check; $cast as a function rejects it and leaves op unchanged (§6.19.4, §6.24.2)", () => {
    const before = svHex(4, "2");
    const s = enumCast(OPCODE_E, before, 7, "static");
    expect(formatD(s.after)).toBe("7");
    expect(enumName(OPCODE_E, s.after)).toBe("");
    const d = enumCast(OPCODE_E, before, 7, "dynamic");
    expect(d.castReturn).toBe(0);
    expect(formatD(d.after)).toBe("2");
    expect(enumCast(OPCODE_E, before, 2, "dynamic")).toMatchObject({ castReturn: 1 });
  });

  it("$cast tests the value itself, so an integer too wide for the base does not pass as the member it would wrap to (§6.24.2)", () => {
    const before = svHex(4, "1");
    const d = enumCast(OPCODE_E, before, 18, "dynamic");
    expect(d.castReturn).toBe(0);
    expect(formatSizedHex(d.after)).toBe("4'h1");
    expect(d.why).toMatch(/no member with value 18/);
    // A static cast has no check, so it keeps what fits the 4-bit base, and says that it did.
    const s = enumCast(OPCODE_E, before, 18, "static");
    expect(enumName(OPCODE_E, s.after)).toBe("OP_WRITE");
    expect(s.why).toMatch(/18 does not fit the 4-bit base type, so 2 is what is held/);
    const s7 = enumCast(OPCODE_E, before, 23, "static");
    expect(s7.why).toMatch(/op now holds 7, which is not a member/);
  });

  it("the readout cites §6.19.5.6 for name(), and the back door's basis only for a non-member", () => {
    expect(enumMemberReadout(CMD_T_ENUM, svHex(32, "2ABC_0042"), "op", "struct", "member-write").citation).toBe("§6.19.5.6");
    expect(enumMemberReadout(CMD_T_ENUM, svHex(32, "2ABC_0042"), "op", "struct", "member-write").note).not.toMatch(/derived/);
    expect(enumMemberReadout(CMD_T_ENUM, svHex(32, "7ABC_0042"), "op").citation).toBe("derived from §7.2.1, §6.19.5.6");
    expect(enumMemberReadout(CMD_T_ENUM, svHex(32, "7ABC_0042"), "op", "union").citation).toBe("§6.19.3, §6.19.5.6");
    expect(enumMemberReadout(CMD_T_ENUM, structInitialValue(CMD_T_ENUM), "op", "struct", "never-assigned").citation).toBe("Table 6-7, §6.19.5.6");
  });

  it("a whole-vector write into a struct stores a non-member opcode, so name() returns \"\" (derived from §7.2.1, §6.19.5.6)", () => {
    const c = svHex(32, "7ABC_0042");
    const r = enumMemberReadout(CMD_T_ENUM, c, "op");
    expect(r.isMember).toBe(false);
    expect(r.name).toBe("");
    expect(r.basis).toBe("derived from §7.2.1");
    const ok = enumMemberReadout(CMD_T_ENUM, svHex(32, "2ABC_0042"), "op");
    expect(ok).toMatchObject({ isMember: true, name: "OP_WRITE" });
    expect(enumMemberReadout(CMD_T_ENUM, c, "op", "union").basis).toBe("§6.19.3");
  });

  it("the readout's note names how the value arrived, not always a whole-vector write", () => {
    const c = svHex(32, "7ABC_0042");
    expect(enumMemberReadout(CMD_T_ENUM, c, "op").note).toMatch(/whole-vector write was not type-checked \(derived from §7\.2\.1\)/);
    expect(enumMemberReadout(CMD_T_ENUM, c, "op", "union").note).toMatch(/write through another member of the union was not type-checked \(§6\.19\.3\)/);
    const partSelect = enumMemberReadout(CMD_T_ENUM, writeXInMember(CMD_T_ENUM, c, "op").value, "op", "struct", "part-select");
    expect(partSelect.note).toMatch(/holds 4'bxxxx.*part-select wrote these bits as a plain vector, with no enum check/);
    expect(partSelect.note).not.toMatch(/whole-vector/);
    expect(enumMemberReadout(CMD_T_ENUM, c, "op", "struct", "layout-edit").note).toMatch(/typedef edit moved op over other bits/);
    const never = enumMemberReadout(CMD_T_ENUM, structInitialValue(CMD_T_ENUM), "op", "struct", "never-assigned");
    expect(never.note).toMatch(/never assigned, so it holds its base type's default, 4'bxxxx \(Table 6-7\)/);
    expect(never.note).not.toMatch(/write/);
    expect(never.name).toBe("");
  });

  it("an enum member's x is offered as a part-select: a direct 'x would need a cast (§6.19.3)", () => {
    expect(xWriteOffer("c", CMD_T_ENUM, "op")).toEqual({ label: "c[31:28] = 4'bx;", partSelect: true });
    expect(xWriteOffer("c", CMD_T_ENUM, "addr")).toEqual({ label: "Write x into addr", partSelect: false });
    expect(writeXInMember(CMD_T_ENUM, svHex(32, "2ABC_0042"), "op").note).toMatch(/^A part-select of bits \[31:28\] writes them as a plain vector, with no enum check/);
    expect(writeXInMember(CMD_T_ENUM, svHex(32, "2ABC_0042"), "addr").note).not.toMatch(/part-select/);
  });
});

describe("type matching and equivalence (§6.22.1, §6.22.2)", () => {
  const unpackedA: TypeRef = { declId: "mon.cmd_rec_t", display: "mon.cmd_rec_t", packed: false, bits: 0, states: 4, signed: false };
  const unpackedB: TypeRef = { ...unpackedA, declId: "scb.cmd_rec_t", display: "scb.cmd_rec_t" };

  it("two local typedefs of an unpacked struct are different, non-matching types: the assignment is a compile error (§6.22.1 d; no rule of §6.22.2 applies)", () => {
    const r = assignmentLegality(unpackedA, unpackedB);
    expect(r.legal).toBe(false);
    // Not the standard's "type incompatible": §6.22.5 keeps that for types with no casting rule, and these have the bit-stream cast (§6.24.3).
    expect(r.relation).toBe("not-assignment-compatible");
    // §6.22.2 (b) covers only anonymous types, so it is not the rule that excludes two named typedefs.
    expect(r.clause).toBe("§6.22.3; no match under §6.22.1 (d), not equivalent under §6.22.2");
    expect(r.clause).not.toMatch(/\(b\)/);
    expect(r.message).toMatch(/\(c\) covers only packed types/);
  });

  it("one typedef in a package matches itself wherever it is imported (§6.22.1 h)", () => {
    const pkg: TypeRef = { ...unpackedA, declId: "bus_pkg.cmd_rec_t", display: "bus_pkg::cmd_rec_t" };
    expect(assignmentLegality(pkg, pkg)).toMatchObject({ legal: true, relation: "matching" });
  });

  it("two packed struct typedefs of equal width, state-ness and signedness are equivalent (§6.22.2 c)", () => {
    const a: TypeRef = { declId: "a", display: "a_t", packed: true, bits: 32, states: 4, signed: false };
    const b: TypeRef = { ...a, declId: "b", display: "b_t" };
    expect(assignmentLegality(a, b)).toMatchObject({ legal: true, relation: "equivalent" });
  });

  it("packed structs that are not equivalent still assign: all integral types are assignment compatible (§6.22.3)", () => {
    const a: TypeRef = { declId: "a", display: "a_t", packed: true, bits: 32, states: 4, signed: false };
    expect(assignmentLegality(a, { ...a, declId: "b", display: "b_t", states: 2 })).toMatchObject({ legal: true, relation: "assignment-compatible", clause: "§6.22.3, §10.7" });
    expect(assignmentLegality(a, { ...a, declId: "c", display: "c_t", bits: 16 })).toMatchObject({ legal: true, relation: "assignment-compatible" });
  });

  it("a packed and an unpacked struct do not assign, and the message does not call both unpacked (§6.22.3)", () => {
    const a: TypeRef = { declId: "a", display: "a_t", packed: true, bits: 32, states: 4, signed: false };
    const r = assignmentLegality(a, unpackedA);
    expect(r).toMatchObject({ legal: false, relation: "not-assignment-compatible", clause: "§6.22.3" });
    expect(r.message).toMatch(/only one of a_t and mon\.cmd_rec_t is packed/);
  });
});

const cmdU: UnionType = {
  name: "cmd_u",
  packing: "packed",
  members: [
    { id: "f", name: "f", width: 32, states: 4, shape: { kind: "struct", typeName: "cmd_t", members: cmdT } },
    { id: "raw", name: "raw", width: 32, states: 4, shape: { kind: "vector" } },
    { id: "bytes", name: "bytes", width: 32, states: 4, shape: { kind: "lanes", laneWidth: 8, count: 4 } },
  ],
};

const wordU: UnionType = {
  name: "word_u",
  packing: "soft",
  members: [
    { id: "word", name: "word", width: 32, states: 4, shape: { kind: "vector" } },
    { id: "half", name: "half", width: 16, states: 4, shape: { kind: "vector" } },
  ],
};

describe("packed untagged unions (§7.3.1, §7.4.1)", () => {
  it("every member names the same bits: a write through raw is read through f and bytes (§7.3.1)", () => {
    const u = writeUnionPath(cmdU, svHex(32, "0"), "raw", svHex(32, "1ABC_0042")).value;
    expect(formatSizedHex(readUnionPath(cmdU, u, "f.addr"))).toBe("12'hABC");
    expect(formatSizedHex(readUnionPath(cmdU, u, "f.op"))).toBe("4'h1");
    expect(formatSizedHex(readUnionPath(cmdU, u, "bytes[3]"))).toBe("8'h1A");
    expect(formatSizedHex(readUnionPath(cmdU, u, "bytes[0]"))).toBe("8'h42");
  });

  it("a write through a struct field or a byte lane updates the raw view (§7.3.1)", () => {
    let u = svHex(32, "1ABC_0042");
    u = writeUnionPath(cmdU, u, "f.op", svHex(4, "F")).value;
    expect(formatSizedHex(readUnionPath(cmdU, u, "raw"))).toBe("32'hFABC_0042");
    u = writeUnionPath(cmdU, u, "bytes[0]", svHex(8, "99")).value;
    expect(formatSizedHex(readUnionPath(cmdU, u, "raw"))).toBe("32'hFABC_0099");
  });

  it("the bytes row lays element 3 at the top: [3:0][7:0] is one vector with bytes[3] = [31:24] (§7.4.1; derived from the range, as in the §7.3.1 example)", () => {
    const row = unionRows(cmdU).find((r) => r.path === "bytes")!;
    expect(row.pieces.map((p) => `${p.label}${p.hi}:${p.lo}`)).toEqual(["bytes[3]31:24", "bytes[2]23:16", "bytes[1]15:8", "bytes[0]7:0"]);
    expect(unionRows(cmdU).map((r) => [r.packing, r.shape])).toEqual([
      ["packed", "struct"],
      ["packed", "vector"],
      ["packed", "lanes"],
    ]);
  });

  it("a field or lane write in a hard packed union is a part-select write: nothing is right-justified or 'unaffected' (§7.2.1, §7.4.5, §7.3.1)", () => {
    const u = svHex(32, "1ABC_0042");
    const field = writeUnionPath(cmdU, u, "f.addr", svHex(12, "FFF"));
    expect(field.unaffected).toEqual([]);
    expect(field.note).toBe("f.addr is bits [27:16] of f, so only those bits change (§7.2.1); every view reads the same bits (§7.3.1).");
    const lane = writeUnionPath(cmdU, u, "bytes[0]", svHex(8, "99"));
    expect(lane.unaffected).toEqual([]);
    expect(lane.note).toBe("bytes[0] is bits [7:0] of bytes, so only those bits change (§7.4.5); every view reads the same bits (§7.3.1).");
    const whole = writeUnionPath(cmdU, u, "raw", svHex(32, "0"));
    expect(whole.unaffected).toEqual([]);
    expect(whole.note).toBe("raw names bits [31:0]; every other member reads the same bits (§7.3.1).");
    // A narrowed member of a HARD union is a declaration error, not a right-justified member: only the soft form earns the §7.3.1 wording.
    const narrow: UnionType = { ...cmdU, members: cmdU.members.map((m) => (m.name === "raw" ? { ...m, width: 16 } : m)) };
    expect(writeUnionPath(narrow, u, "raw", svHex(16, "1234")).unaffected).toEqual([]);
    expect(writeUnionPath(narrow, u, "raw", svHex(16, "1234")).note).not.toMatch(/right-justified/);
    const soft = writeUnionPath({ ...narrow, packing: "soft" }, u, "raw", svHex(16, "1234"));
    expect(soft.unaffected[0]).toBe(31);
    expect(soft.note).toMatch(/^raw is right-justified in bits \[15:0\]; bits \[31:16\] are unaffected by the write \(§7\.3\.1\)\.$/);
  });

  it("a full-width member of a soft union says which rows are narrower: only equal widths earn 'every other member' (§7.3.1)", () => {
    const word = writeUnionPath(wordU, svHex(32, "0"), "word", svHex(32, "AAAA_BBBB"));
    expect(word.note).toBe("word names bits [31:0]; half is narrower and reads only its own low bits (§7.3.1).");
    expect(word.note).not.toMatch(/every other/);
    const nested: UnionType = {
      name: "nest_u",
      packing: "soft",
      members: [
        { id: "a", name: "a", width: 12, states: 4, shape: { kind: "vector" } },
        {
          id: "inner",
          name: "inner",
          width: 8,
          states: 4,
          shape: {
            kind: "union",
            packing: "soft",
            members: [
              { id: "b8", name: "b8", width: 8, states: 4, shape: { kind: "vector" } },
              { id: "b4", name: "b4", width: 4, states: 4, shape: { kind: "vector" } },
            ],
          },
        },
      ],
    };
    expect(writeUnionPath(nested, svHex(12, "0"), "a", svHex(12, "ABC")).note).toBe("a names bits [11:0]; inner, inner.b8 and inner.b4 are narrower and read only their own low bits (§7.3.1).");
    // A soft union whose members all have one width is the case the old sentence was true of.
    const equal: UnionType = { ...cmdU, packing: "soft" };
    expect(writeUnionPath(equal, svHex(32, "0"), "raw", svHex(32, "1")).note).toBe("raw names bits [31:0]; every other member reads the same bits (§7.3.1).");
  });

  it("a part-select names the rows that cannot read all of its bits; 'every view' only when every row contains them (§7.3.1)", () => {
    const narrow: UnionType = { ...cmdU, packing: "soft", members: cmdU.members.map((m) => (m.name === "raw" ? { ...m, width: 16 } : m)) };
    const u = svHex(32, "1ABC_0042");
    const op = writeUnionPath(narrow, u, "f.op", svHex(4, "F"));
    expect(op.note).toBe("f.op is bits [31:28] of f, so only those bits change (§7.2.1); raw [15:0] is narrower and does not read all of those bits (§7.3.1).");
    expect(formatSizedHex(readUnionPath(narrow, op.value, "raw"))).toBe("16'h0042");
    expect(writeUnionPath(narrow, u, "bytes[3]", svHex(8, "99")).note).toBe("bytes[3] is bits [31:24] of bytes, so only those bits change (§7.4.5); raw [15:0] is narrower and does not read all of those bits (§7.3.1).");
    // Bits every row contains: the sentence holds again, soft or not.
    expect(writeUnionPath(narrow, u, "bytes[0]", svHex(8, "99")).note).toBe("bytes[0] is bits [7:0] of bytes, so only those bits change (§7.4.5); every view reads the same bits (§7.3.1).");
    expect(writeUnionPath(narrow, u, "f.data", svHex(16, "1")).note).toMatch(/every view reads the same bits/);
    // Part of a field out of a row's reach: raw 20 bits wide reads [19:16] of addr but not [27:20].
    const twenty: UnionType = { ...narrow, members: cmdU.members.map((m) => (m.name === "raw" ? { ...m, width: 20 } : m)) };
    expect(writeUnionPath(twenty, u, "f.addr", svHex(12, "1")).note).toMatch(/raw \[19:0\] is narrower and does not read all of those bits/);
  });

  it("openNote, shown while a prediction about the narrower rows is open, says nothing about them", () => {
    const word = writeUnionPath(wordU, svHex(32, "0"), "word", svHex(32, "AAAA_BBBB"));
    expect(word.openNote).toBe("word names bits [31:0].");
    expect(writeUnionPath(wordU, svHex(32, "0"), "word", svHex(16, "BBBB")).openNote).toBe("word names bits [31:0]. The 16-bit source is zero-extended to 32 bits (§10.7).");
    // A narrower row's position is the very thing being asked.
    expect(writeUnionPath(wordU, svHex(32, "0"), "half", svHex(16, "1234")).openNote).toBe("half is written.");
    expect(writeUnionPath(cmdU, svHex(32, "0"), "f.op", svHex(4, "F")).openNote).toBe("f.op is written.");
  });

  it("a signed source is sign-extended when written through a union path, and the note says so (§10.7)", () => {
    const w = writeUnionPath(wordU, svHex(32, "AAAA_BBBB"), "half", fromBigInt(BigInt(-128), 8, true));
    expect(formatSizedHex(readUnionPath(wordU, w.value, "word"))).toBe("32'hAAAA_FF80");
    expect(w.note).toMatch(/The 8-bit source is sign-extended to 16 bits \(§10\.7\)\.$/);
  });

  it("the typedef of a declaration that does not compile claims no width or state-ness (§7.3.1)", () => {
    const narrow: UnionType = { ...cmdU, members: cmdU.members.map((m) => (m.name === "raw" ? { ...m, width: 16 } : m)) };
    expect(unionTypedef(narrow)).toMatch(/} cmd_u;  \/\/ does not compile$/);
    expect(unionTypedef({ ...narrow, packing: "soft" })).toMatch(/} cmd_u;  \/\/ 32 bits, 4-state$/);
  });

  it("a short source is zero-extended and a long one truncated to the path's width; the note says by how much (§10.7)", () => {
    const w = writeUnionPath(wordU, svHex(32, "AAAA_BBBB"), "half", svHex(8, "12"));
    expect(formatSizedHex(readUnionPath(wordU, w.value, "word"))).toBe("32'hAAAA_0012");
    expect(w.note).toMatch(/The 8-bit source is zero-extended to 16 bits \(§10\.7\)\.$/);
    const t = writeUnionPath(wordU, svHex(32, "AAAA_BBBB"), "half", svHex(20, "F1234"));
    expect(formatSizedHex(readUnionPath(wordU, t.value, "word"))).toBe("32'hAAAA_1234");
    expect(t.note).toMatch(/The 20-bit source is truncated to 16 bits \(§10\.7\)\.$/);
  });

  it("the typedef names a struct member by its own type (cmd_t f), never an invented f_t", () => {
    const text = unionTypedef(cmdU);
    expect(text).toContain("  cmd_t f;  // packed struct, 32 bits");
    expect(text).not.toContain("f_t");
  });

  it("hard packed members must be the same size, else a compile error (§7.3.1)", () => {
    expect(unionProblems(cmdU)).toEqual([]);
    const narrow: UnionType = { ...cmdU, members: cmdU.members.map((m) => (m.name === "raw" ? { ...m, width: 16 } : m)) };
    const problems = unionProblems(narrow);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ legal: false, clause: "§7.3.1" });
    expect(problems[0].message).toMatch(/raw is 16 bits/);
    expect(unionProblems({ ...narrow, packing: "soft" })).toEqual([]);
  });

  it("soft packed: width is the widest member, members are right-justified and a narrower write leaves the upper bits unaffected (§7.3.1)", () => {
    expect(unionWidth(wordU)).toBe(32);
    const half = unionRows(wordU).find((r) => r.path === "half")!;
    expect([half.hi, half.lo]).toEqual([15, 0]);
    expect(half.unaffectedAbove[0]).toBe(31);
    expect(half.unaffectedAbove[half.unaffectedAbove.length - 1]).toBe(16);
    let w = writeUnionPath(wordU, svHex(32, "0"), "word", svHex(32, "AAAA_BBBB")).value;
    const write = writeUnionPath(wordU, w, "half", svHex(16, "1234"));
    w = write.value;
    expect(formatSizedHex(readUnionPath(wordU, w, "word"))).toBe("32'hAAAA_1234");
    expect(write.unaffected[0]).toBe(31);
    expect(write.note).toBe("half is right-justified in bits [15:0]; bits [31:16] are unaffected by the write (§7.3.1).");
    expect(unionRows(wordU).map((r) => r.packing)).toEqual(["soft", "soft"]);
  });

  it("the right-justification rule applies recursively to a nested soft union (§7.3.1)", () => {
    const nested: UnionType = {
      name: "nest_u",
      packing: "soft",
      members: [
        { id: "a", name: "a", width: 12, states: 4, shape: { kind: "vector" } },
        {
          id: "inner",
          name: "inner",
          width: 8,
          states: 4,
          shape: {
            kind: "union",
            packing: "soft",
            members: [
              { id: "b8", name: "b8", width: 8, states: 4, shape: { kind: "vector" } },
              { id: "b4", name: "b4", width: 4, states: 4, shape: { kind: "vector" } },
            ],
          },
        },
      ],
    };
    expect(unionWidth(nested)).toBe(12);
    const rows = unionRows(nested);
    expect(rows.map((r) => [r.path, r.hi, r.lo, r.depth])).toEqual([
      ["a", 11, 0, 0],
      ["inner", 7, 0, 0],
      ["inner.b8", 7, 0, 1],
      ["inner.b4", 3, 0, 1],
    ]);
    const inner = writeUnionPath(nested, svHex(12, "ABC"), "inner.b4", svHex(4, "F"));
    expect(formatSizedHex(readUnionPath(nested, inner.value, "a"))).toBe("12'hABF");
    // b4 is a direct member of the nested soft union, so the soft wording applies to it too, relative to the whole union.
    expect(inner.unaffected).toEqual([11, 10, 9, 8, 7, 6, 5, 4]);
    expect(inner.note).toMatch(/^inner\.b4 is right-justified in bits \[3:0\]; bits \[11:4\] are unaffected/);
    expect(rows.map((r) => r.packing)).toEqual(["soft", "soft", "soft", "soft"]);
  });

  it("a 2-state member reads and writes x as 0 (§6.11.2), while the union's 4-state view keeps the x (§7.3.1)", () => {
    const mixed: UnionType = {
      name: "mix_u",
      packing: "packed",
      members: [
        { id: "l", name: "l", width: 8, states: 4, shape: { kind: "vector" } },
        { id: "b", name: "b", width: 8, states: 2, shape: { kind: "vector" } },
      ],
    };
    expect(unionPathStates(mixed, "b")).toBe(2);
    const v = svHex(8, "xF");
    expect(formatSizedHex(readUnionPath(mixed, v, "l"))).toBe("8'hxF");
    expect(formatSizedHex(readUnionPath(mixed, v, "b"))).toBe("8'h0F");
    const written = writeUnionPath(mixed, svHex(8, "00"), "b", svHex(8, "x1")).value;
    expect(formatSizedHex(written)).toBe("8'h01");
    expect(formatSizedHex(writeUnionPath(mixed, svHex(8, "00"), "l", svHex(8, "x1")).value)).toBe("8'hx1");
  });

  it("a 2-state field of a struct member converts on read too, and a 4-state one does not (§7.2.1, §7.3.1)", () => {
    const withBit: UnionType = {
      name: "fld_u",
      packing: "packed",
      members: [
        {
          id: "f",
          name: "f",
          width: 8,
          states: 4,
          shape: {
            kind: "struct",
            typeName: "fld_t",
            members: [
              { id: "hi", name: "hi", width: 4, type: { kind: "bit" } },
              { id: "lo", name: "lo", width: 4, type: { kind: "logic" } },
            ],
          },
        },
        { id: "raw", name: "raw", width: 8, states: 4, shape: { kind: "vector" } },
      ],
    };
    const v = svHex(8, "xx");
    expect(formatSizedHex(readUnionPath(withBit, v, "f.hi"))).toBe("4'h0");
    expect(formatSizedHex(readUnionPath(withBit, v, "f.lo"))).toBe("4'hx");
    expect(formatSizedHex(readUnionPath(withBit, v, "raw"))).toBe("8'hxx");
  });

  it("a 2-state member plus a 4-state member makes the union 4-state (§7.3.1)", () => {
    const mixed: UnionType = {
      name: "m_u",
      packing: "packed",
      members: [
        { id: "b", name: "b", width: 8, states: 2, shape: { kind: "vector" } },
        { id: "l", name: "l", width: 8, states: 4, shape: { kind: "vector" } },
      ],
    };
    expect(unionStates(mixed)).toBe(4);
    expect(unionStates({ ...mixed, members: [mixed.members[0]] })).toBe(2);
  });

  it("%p under the first-declared-member reading of §21.2.1.6 prints only the first member (tool-dependent for a packed union)", () => {
    const u = svHex(32, "1ABC_0042");
    expect(formatUnionP(cmdU, u)).toEqual({ text: "'{f:'{op:1, addr:2748, data:66}}", member: "f" });
    const rawFirst: UnionType = { ...cmdU, members: [cmdU.members[1], cmdU.members[0], cmdU.members[2]] };
    expect(formatUnionP(rawFirst, u).text).toBe("'{raw:448528450}");
  });
});

describe("defaults of unions (Table 6-7, §7.3.1)", () => {
  it("a union with a 4-state member starts all x; an all 2-state union starts all 0", () => {
    expect(formatSizedHex(unionInitialValue(cmdU))).toBe("32'hxxxx_xxxx");
    const twoState: UnionType = { name: "b_u", packing: "packed", members: [{ id: "b", name: "b", width: 8, states: 2, shape: { kind: "vector" } }] };
    expect(formatSizedHex(unionInitialValue(twoState))).toBe("8'h00");
    expect(formatUnionP(wordU, unionInitialValue(wordU)).text).toBe("'{word:x}");
  });
});

const vint: TaggedUnionType = {
  name: "VInt",
  members: [
    { name: "Invalid", width: null, typeText: "void", signed: false },
    { name: "Valid", width: 32, typeText: "int", signed: true },
  ],
};

describe("tagged unions (§7.3.2, §11.9, §21.2.1.6)", () => {
  it("a tagged expression sets the tag and the value together (§7.3.2); reading the matching member is legal (§11.9)", () => {
    const invalid = makeTagged(vint, "Invalid");
    expect(invalid).toEqual({ tagIndex: 0, value: null });
    const v = makeTagged(vint, "Valid", 23);
    expect(v.tagIndex).toBe(1);
    expect(formatD(v.value!)).toBe("23");
    const read = readTagged(vint, v, "Valid");
    expect(read.ok).toBe(true);
    if (read.ok) expect(formatD(read.value)).toBe("23");
  });

  it("a member's signedness comes from its type: int prints -1, bit [7:0] prints 255 (§6.11, Table 6-8)", () => {
    const minusOne = makeTagged(vint, "Valid", -1);
    const read = readTagged(vint, minusOne, "Valid");
    expect(read.ok && formatD(read.value)).toBe("-1");
    expect(read.ok && read.note).toMatch(/returns -1 \(§11\.9\)/);
    expect(formatTaggedP(vint, minusOne)).toBe("Valid:-1");
    const three: TaggedUnionType = { ...vint, members: [...vint.members, { name: "Small", width: 8, typeText: "bit [7:0]", signed: false }] };
    const small = makeTagged(three, "Small", -1);
    expect(small.value?.signed).toBe(false);
    expect(formatTaggedP(three, small)).toBe("Small:255");
    // An SvValue source takes the member's signedness too.
    expect(makeTagged(vint, "Valid", fromBigInt(BigInt(-1), 8, true)).value?.signed).toBe(true);
    expect(formatD(makeTagged(vint, "Valid", fromBigInt(BigInt(-1), 8, true)).value!)).toBe("-1");
    expect(formatD(makeTagged(vint, "Valid", svHex(8, "FF")).value!)).toBe("255");
  });

  it("the typedef text follows Syntax 7-2 and the §7.3.2 VInt example, unpacked and packed", () => {
    expect(taggedTypedef(vint)).toBe("typedef union tagged {\n  void  Invalid;\n  int   Valid;\n} VInt;");
    expect(taggedTypedef(vint, true)).toBe("typedef union tagged packed {\n  void  Invalid;\n  int   Valid;\n} VInt;");
  });

  it("reading a member that does not match the tag is a run-time error (§11.9)", () => {
    const v = makeTagged(vint, "Invalid");
    const read = readTagged(vint, v, "Valid");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error).toMatch(/Run-time error.*tag is Invalid/);
  });

  it("an uninitialized tagged union is undefined, tag included (§11.9)", () => {
    const read = readTagged(vint, UNDEFINED_TAGGED, "Valid");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error).toMatch(/never assigned/);
    expect(taggedPackedBits(vint, UNDEFINED_TAGGED).undefinedBits).toHaveLength(33);
  });

  it("packed layout: 1 tag bit left-justified plus 32 value bits; Invalid leaves everything but the tag undefined (§7.3.2, Figure 7-2)", () => {
    expect(tagWidth(2)).toBe(1);
    const layout = taggedPackedLayout(vint);
    expect(layout).toMatchObject({ width: 33, tagBits: 1, tagHi: 32, tagLo: 32 });
    expect(layout.members.map((m) => m.code)).toEqual([0, 1]);
    const valid = taggedPackedBits(vint, makeTagged(vint, "Valid", 23));
    expect(valid.bits[0]).toBe("1");
    expect(valid.undefinedBits).toEqual([]);
    expect(valid.segments).toEqual([
      { hi: 32, lo: 32, label: "tag" },
      { hi: 31, lo: 0, label: "Valid" },
    ]);
    const invalid = taggedPackedBits(vint, makeTagged(vint, "Invalid"));
    expect(invalid.bits[0]).toBe("0");
    expect(invalid.undefinedBits).toHaveLength(32);
    expect(invalid.undefinedBits[0]).toBe(31);
  });

  it("a third member grows the tag to 2 bits and leaves the bits between tag and a narrower member undefined (§7.3.2)", () => {
    const three: TaggedUnionType = { ...vint, members: [...vint.members, { name: "Small", width: 8, typeText: "bit [7:0]", signed: false }] };
    expect(tagWidth(3)).toBe(2);
    expect(tagWidth(5)).toBe(3);
    expect(tagWidth(8)).toBe(3);
    const layout = taggedPackedLayout(three);
    expect(layout).toMatchObject({ width: 34, tagBits: 2, tagHi: 33, tagLo: 32 });
    const small = taggedPackedBits(three, makeTagged(three, "Small", 0xa5));
    expect(small.bits.slice(0, 2)).toEqual(["1", "0"]);
    expect(small.undefinedBits[0]).toBe(31);
    expect(small.undefinedBits[small.undefinedBits.length - 1]).toBe(8);
    expect(small.undefinedBits).toHaveLength(24);
  });

  it("the note credits the tag's code to Figures 7-2 and 7-3, not §7.3.2, and calls a third member's code our own extension", () => {
    const two = taggedPackedBits(vint, makeTagged(vint, "Valid", 23)).note;
    expect(two).toMatch(/Tag \[32\] = 1 \(Valid\): the code follows the numbering of Figures 7-2 and 7-3\. Valid is right-justified in \[31:0\] \(§7\.3\.2\)\./);
    expect(two).not.toMatch(/extension/);
    const three: TaggedUnionType = { name: "VInt", members: [...vint.members, { name: "Small", width: 8, typeText: "bit [7:0]", signed: false }] };
    const small = taggedPackedBits(three, makeTagged(three, "Small", 0x5a)).note;
    expect(small).toMatch(/Tag \[33:32\] = 2 \(Small\): the code follows the numbering of Figures 7-2 and 7-3, and code 2 for a third member is our own extension of it\./);
    expect(small).toMatch(/the 24 bits between are undefined \(§7\.3\.2\)/);
  });

  it("a read of a never-assigned tagged union labels 'no defined result' as derived (§11.9)", () => {
    const r = readTagged(vint, UNDEFINED_TAGGED, "Valid");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/tag bits are undefined \(§11\.9\)/);
      expect(r.error).toMatch(/Derived from that, whether the check fires is not defined/);
    }
  });

  it("%p prints tag:value for the valid member (§21.2.1.6)", () => {
    expect(formatTaggedP(vint, makeTagged(vint, "Valid", 23))).toBe("Valid:23");
    expect(formatTaggedP(vint, makeTagged(vint, "Invalid"))).toBe("Invalid");
  });

  it("%p of a never-assigned variable states no printed string; 'not defined' is labelled derived from §11.9", () => {
    expect(formatTaggedP(vint, UNDEFINED_TAGGED)).toBeNull();
    for (const packed of [false, true]) {
      const r = taggedPReading(vint, UNDEFINED_TAGGED, packed);
      expect(r).toMatchObject({ text: null, basis: "derived", citation: "derived from §11.9" });
      expect(r.sentence).toMatch(/not defined.*tag bits included.*derived from §11\.9/);
      expect(r.sentence).not.toMatch(/21\.2\.1\.6|prints/);
    }
  });

  it("%p when packed is a reading that tools can differ on, void or not: a packed union is singular (§6.4, §6.11.1)", () => {
    for (const member of ["Valid", "Invalid"] as const) {
      const r = taggedPReading(vint, makeTagged(vint, member, member === "Valid" ? 23 : undefined), true);
      expect(r.basis, member).toBe("tool-dependent");
      expect(r.citation, member).toBe("a reading of §21.2.1.6 that tools can implement differently");
    }
    expect(taggedPReading(vint, makeTagged(vint, "Valid", 23), true).sentence).toBe("%p prints Valid:23 (a reading of §21.2.1.6 that tools can implement differently).");
  });

  it("%p when unpacked is stated for a member with a value, and derived for a void one, on which §21.2.1.6 is silent", () => {
    expect(taggedPReading(vint, makeTagged(vint, "Valid", 23), false)).toEqual({ text: "Valid:23", basis: "stated", citation: "tag:value, §21.2.1.6", sentence: "%p prints Valid:23 (tag:value, §21.2.1.6)." });
    const v = taggedPReading(vint, makeTagged(vint, "Invalid"), false);
    expect(v).toMatchObject({ text: "Invalid", basis: "derived" });
    expect(v.citation).toMatch(/^derived: .*§21\.2\.1\.6.*§7\.3\.2$/);
  });
});

describe("formatting (§21.2.1.3, §5.7.1)", () => {
  it("hex groups keep the %h case of unknown digits; known digits use the lessons' capitals", () => {
    expect(formatHexGroups(svHex(32, "5ABC_0042"))).toBe("5ABC_0042");
    expect(formatHexGroups(svHex(8, "xa"))).toBe("xA");
    const mixed = writeXInMember([{ id: "a", name: "a", width: 2, type: { kind: "logic" } }, { id: "b", name: "b", width: 6, type: { kind: "logic" } }], svHex(8, "45"), "a").value;
    expect(formatHexGroups(mixed)).toBe("X5");
  });

  it("a sized literal with a partly-x digit is written in binary, because an x digit in a hex literal means all four bits (§5.7.1)", () => {
    expect(formatSizedHex(svHex(8, "x5"))).toBe("8'hx5");
    const kindX = writeXInMember(PKT_LIKE, svHex(32, "4540_CAFE"), "kind").value;
    expect(formatH(kindX)).toBe("X540cafe");
    expect(formatSizedHex(kindX)).toBe("32'bxx00_0101_0100_0000_1100_1010_1111_1110");
  });

  it("the short top digit of an all-x value is x, not X: the rule applies to the group's own bits (§21.2.1.3)", () => {
    const m31: PackedMember[] = [{ id: "a", name: "a", width: 3, type: { kind: "logic" } }, { id: "b", name: "b", width: 28, type: { kind: "logic" } }];
    expect(formatH(structInitialValue(m31))).toBe("xxxxxxxx");
    expect(formatSizedHex(structInitialValue(m31))).toBe("31'hxxxx_xxxx");
    expect(formatH(svHex(5, "1F"))).toBe("1f");
  });

  it("a literal narrower than its size pads with 0, or with x or z when its leftmost digit is x or z; a wider one truncates from the left (§5.7.1)", () => {
    expect(formatB(svHex(8, "1"))).toBe("00000001");
    expect(formatB(svHex(8, "x"))).toBe("xxxxxxxx");
    expect(formatB(svHex(8, "z"))).toBe("zzzzzzzz");
    expect(formatB(svHex(8, "x1"))).toBe("xxxx0001");
    expect(formatB(svHex(12, "x1"))).toBe("xxxxxxxx0001");
    expect(formatB(svHex(12, "z1"))).toBe("zzzzzzzz0001");
    expect(formatB(svHex(12, "1x"))).toBe("00000001xxxx");
    expect(formatB(svHex(4, "1F"))).toBe("1111");
  });

  it("changedReadsText names only what changed, and the whole value when too many reads did", () => {
    const whole = { name: "c", value: svHex(32, "50FF_0042") };
    const read = (name: string, before: string, after: string, width = 4) => ({ name, before: svHex(width, before), after: svHex(width, after) });
    expect(changedReadsText([read("op", "5", "5"), read("addr", "ABC", "0FF", 12)], whole)).toBe("addr = 12'h0FF");
    expect(changedReadsText([read("op", "5", "5")], whole)).toBe("");
    expect(changedReadsText([read("a", "1", "2"), read("b", "1", "2"), read("c", "1", "2"), read("d", "1", "2")], whole)).toBe("c = 32'h50FF_0042");
    // x is a change, though both read as "not a number".
    expect(changedReadsText([read("op", "5", "x")], whole)).toBe("op = 4'hx");
  });

  it("%h prints one lower-case digit per nibble, x for an all-x nibble and X for a mixed one", () => {
    expect(formatH(svHex(32, "2123_BEEF"))).toBe("2123beef");
    expect(formatH(svHex(12, "042"))).toBe("042");
    expect(formatH(svHex(8, "x1"))).toBe("x1");
    const mixed = writeXInMember([{ id: "a", name: "a", width: 2, type: { kind: "logic" } }, { id: "b", name: "b", width: 6, type: { kind: "logic" } }], svHex(8, "00"), "a").value;
    expect(formatH(mixed)).toBe("X0");
  });

  it("%0d of a signed value prints it as signed (§21.2.1.3)", () => {
    expect(formatD(fromBigInt(BigInt(-1), 32, true))).toBe("-1");
    expect(formatD(fromBigInt(BigInt(-1), 32, false))).toBe("4294967295");
  });

  it("%0d prints decimal, or x when every bit is unknown", () => {
    expect(formatD(svHex(16, "BEEF"))).toBe("48879");
    expect(formatD(svHex(4, "x"))).toBe("x");
  });
});

describe("mutation board: the lesson's tb_top (Make It Work, steps 3 to 5)", () => {
  it("the unmodified tb_top passes all eleven checks and prints the lesson's lines", () => {
    const run = runTbTop(BASE_TB);
    expect(run.checks).toHaveLength(TB_CHECKS.length);
    expect(run.fail).toBe(0);
    expect(run.pass).toBe(11);
    expect(run.log).toEqual([
      "c = 2123beef, $bits(cmd_t) = 32",
      "op = OP_READ, addr = abc, bytes[3] = 1a",
      "rec = '{cmd:'{op:OP_WRITE, addr:255, data:48879}, tag:\"first write\", beat:0}",
      "members: OP_NOP OP_READ OP_WRITE OP_IRQ (num() = 4)",
      'never_set = xxxx, name() = ""',
      'static cast: op = 7, name() = ""',
      "PASS=11 FAIL=0",
    ]);
  });

  it("agrees with the lesson: reversing breaks layout, addr write and addr field; the bit base only 'no name'; OP_SYNC only 'wrap'", () => {
    for (const m of MUTATIONS) {
      const run = runTbTop(mutate(BASE_TB, m.id));
      expect(failingChecks(run), m.id).toEqual([...LESSON_EXPECTED_FAILURES[m.id]]);
      expect(run.log[run.log.length - 1]).toBe(`PASS=${11 - LESSON_EXPECTED_FAILURES[m.id].length} FAIL=${LESSON_EXPECTED_FAILURES[m.id].length}`);
    }
  });

  it("the bit base changes the never_set line as the lesson predicts (Table 6-7)", () => {
    const run = runTbTop(mutate(BASE_TB, "bit-base"));
    expect(run.log).toContain('never_set = 0000, name() = "OP_NOP"');
    expect(run.log).toContain("FAIL: no name");
  });

  it("OP_SYNC changes the members line and num(), and next() from OP_IRQ returns OP_SYNC", () => {
    const run = runTbTop(mutate(BASE_TB, "op-sync"));
    expect(run.log).toContain("members: OP_NOP OP_READ OP_WRITE OP_IRQ OP_SYNC (num() = 5)");
    expect(run.checks.find((c) => c.id === "wrap")).toMatchObject({ ok: false, actual: "op.next() = OP_SYNC" });
    expect(run.checks.find((c) => c.id === "num")?.ok).toBe(true);
  });

  it("reversing changes the c line, the addr field and the %p record, but not bytes[3]", () => {
    const base = runTbTop(BASE_TB);
    const run = runTbTop(mutate(BASE_TB, "reverse-addr-data"));
    expect(run.log[0]).toBe("c = 2beef123, $bits(cmd_t) = 32");
    expect(run.log).toContain("op = OP_READ, addr = 042, bytes[3] = 1a");
    expect(run.log).toContain("rec = '{cmd:'{op:OP_WRITE, data:48879, addr:255}, tag:\"first write\", beat:0}");
    const diff = changedLogLines(base, run);
    expect(diff.map((d) => d.index)).toEqual([0, 1, 2, 6]);
  });

  it("the board marks a check as caught when it fails under the mutation, keyed row:column", () => {
    const { cells } = mutationBoard();
    expect(cells["layout:reverse-addr-data"]).toMatchObject({ state: "caught" });
    expect(cells["bits:reverse-addr-data"]).toMatchObject({ state: "survived" });
    expect(cells["no-name:bit-base"]).toMatchObject({ state: "caught", summary: 'never_set.name() = "OP_NOP"' });
    expect(cells["wrap:op-sync"]).toMatchObject({ state: "caught" });
    expect(Object.keys(cells)).toHaveLength(TB_CHECKS.length * MUTATIONS.length);
    for (const id of TB_CHECKS.map((c) => c.id)) expect(id).not.toContain(":");
  });
});
