import { describe, expect, it } from "vitest";

import {
  CAST_DESTS,
  CAST_PRESETS,
  ERROR_LABEL,
  FILL_ORIGIN,
  NONEXISTENT_ORIGIN,
  CAST_DEST_IDS,
  CAST_SOURCE_IDS,
  STREAM_OPS,
  STREAM_PRESETS,
  STREAM_TARGETS,
  SUBJECT_OPS,
  SUBJECT_TARGETS,
  arrangeOptions,
  binBits,
  bitRuns,
  bitStreamCast,
  castCompareRows,
  castSource,
  castValueText,
  fitToTarget,
  flatten,
  formatBits,
  hexBits,
  packStream,
  reorder,
  reorderPermutation,
  runCast,
  runStream,
  segmentWords,
  signedValue,
  sliceFromRight,
  sliceSizeError,
  streamCode,
  streamFourState,
  unpackStream,
  type Bit,
  type StreamConfig,
  type StreamExpr,
  type StreamTarget,
  type TaggedBit,
  type UnpackItem,
} from "@/lib/sv-stream-model";

const v = (bits: readonly TaggedBit[]) => bits.map((b) => b.v).join("");
/** A packed operand; 4-state unless said otherwise, as an integer literal is logic (§5.7.1). */
const packed = (name: string, bits: Bit[], twoState = false): StreamExpr => ({ kind: "packed", name, tag: name, bits, twoState });
const lit = (bin: string) => packed(bin, binBits(bin));
const fixed = (name: string, width: number, twoState = true): StreamTarget => ({ kind: "fixed", name, width, twoState, decl: "" });
/** A byte as bits, from a character, as a string literal stores it (§5.9). */
const charBits = (c: string) => hexBits(c.charCodeAt(0).toString(16).padStart(2, "0"), 8);
const hexOf = (bits: readonly TaggedBit[]) => formatBits(bits.map((b) => b.v));
const preset = (id: string) => {
  const p = STREAM_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return runStream(p.config);
};

describe("formatting", () => {
  it("writes hex with an underscore every four digits from the right, as the lesson does", () => {
    expect(formatBits(hexBits("04BEEF01", 32))).toBe("32'h04BE_EF01");
    expect(formatBits(hexBits("04BEEF0100", 40))).toBe("40'h04_BEEF_0100");
    expect(formatBits(hexBits("04", 8))).toBe("8'h04");
  });
  it("§5.7.1: an all-x nibble is one x digit; a width that is not a multiple of 4 is written in binary", () => {
    expect(formatBits(hexBits("BEEx", 16))).toBe("16'hBEEx");
    expect(formatBits(binBits("010111"))).toBe("6'b01_0111");
    expect(formatBits(binBits("1x01"))).toBe("4'b1x01");
  });
  it("§6.11: an int reads as two's complement", () => {
    expect(signedValue(hexBits("FFFFFFFF", 32))).toBe(BigInt(-1));
    expect(signedValue(hexBits("04BEE001", 32))).toBe(BigInt(0x04bee001));
    expect(signedValue(hexBits("0x00", 16))).toBeNull();
  });
});

describe("§11.4.14.1 concatenation of stream expressions", () => {
  it("§11.4.14.1: operands are appended leftmost first", () => {
    expect(v(flatten({ kind: "stream", op: { dir: ">>" }, operands: [lit("1100"), lit("01")] }))).toBe("110001");
  });
  it("§11.4.14.1: a struct streams its members in declaration order", () => {
    const run = preset("big-endian");
    expect(hexOf(run.pack!.packed)).toBe("32'h04BE_EF01");
    expect(bitRuns(run.pack!.packed).map((r) => r.label)).toEqual(["len[7:0]", "addr[15:0]", "kind[7:0]"]);
  });
  it("§11.4.14.1, §12.7.3: an unpacked array streams in foreach order; up[3:0] gives up[3] first", () => {
    // logic [10:0] up [3:0]; foreach visits 3, 2, 1, 0, so the elements are listed in that order.
    const els = [3, 2, 1, 0].map((n) => binBits(n.toString(2).padStart(11, "0")));
    const up: StreamExpr = { kind: "array", name: "up", elements: els, elementWidth: 11, elementTwoState: false };
    const items: UnpackItem[] = ["p1", "p2", "p3", "p4"].map((name) => ({ kind: "fixed", name, width: 11, twoState: false }));
    const u = unpackStream({ dir: ">>" }, items, up, "up");
    expect(u.status).toBe("ok");
    // { >> {p1, p2, p3, p4}} = up; gives p1 = up[3], p2 = up[2], p3 = up[1], p4 = up[0] (§11.4.14.3 example).
    expect(["p1", "p2", "p3", "p4"].map((n) => parseInt(v(u.values[n]), 2))).toEqual([3, 2, 1, 0]);
  });
  it("§11.4.14.1: a queue streams element 0 first", () => {
    const q: StreamExpr = { kind: "array", name: "q", elements: [hexBits("12", 8), hexBits("34", 8)], elementWidth: 8, elementTwoState: true };
    expect(hexOf(flatten(q))).toBe("16'h1234");
    expect(bitRuns(flatten(q)).map((r) => r.label)).toEqual(["q[0][7:0]", "q[1][7:0]"]);
  });
  it("§11.4.14.1: a nested streaming concatenation contributes its own re-ordered result", () => {
    // { << 2 { { << { 4'b1101 }} }} generates 'b1110 (§11.4.14.2 example).
    const inner: StreamExpr = { kind: "stream", op: { dir: "<<" }, operands: [lit("1101")] };
    expect(v(flatten({ kind: "stream", op: { dir: "<<", slice: 2 }, operands: [inner] }))).toBe("1110");
  });
  it("§11.4.14: hdr has logic members, so its pack is a 4-state stream even with no x in it", () => {
    const run = preset("wide-target");
    expect(run.config.xInAddr).toBe(false);
    expect(run.pack!.fourState).toBe(true);
    expect(run.pack!.steps[0].text).toMatch(/hdr has logic \(4-state\) members, so the stream is 4-state \(§11\.4\.14\), whatever values its bits hold\./);
    expect(run.pack!.steps[0].text).not.toMatch(/carry x or z/);
    for (const id of ["big-endian", "little-endian", "narrow-target", "whole-vs-field", "remainder"]) expect(preset(id).pack!.fourState, id).toBe(true);
  });
  it("§11.4.14: an injected x does not decide the state; it can appear only because the stream is 4-state", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "wide-target")!;
    const run = runStream({ ...p.config, xInAddr: true });
    expect(run.pack!.fourState).toBe(true);
    expect(run.pack!.steps[0].text).toMatch(/hdr has logic \(4-state\) members, so the stream is 4-state \(§11\.4\.14\).*Only a 4-state stream can carry x or z bits/);
  });
  it("§11.4.14: a pack of only 2-state operands, a byte unsigned queue, is a 2-state stream", () => {
    const q: StreamExpr = { kind: "array", name: "bq", elements: [hexBits("12", 8), hexBits("34", 8)], elementWidth: 8, elementTwoState: true };
    const r = packStream({ dir: "<<", slice: 8 }, [q], STREAM_TARGETS.byteq);
    expect(r.fourState).toBe(false);
    expect(r.steps[0].text).toMatch(/Every operand is of a 2-state type, so the stream is 2-state \(§11\.4\.14\)\./);
    expect(r.steps[3].text).not.toMatch(/implicitly cast/);
  });
  it("§11.4.14, §11.4.14.1: one 4-state operand among 2-state ones makes the whole stream 4-state", () => {
    const mixed = [packed("b8", hexBits("AA", 8), true), packed("l8", hexBits("55", 8))];
    expect(packStream({ dir: ">>" }, mixed, fixed("w", 16)).fourState).toBe(true);
    expect(streamFourState({ kind: "stream", op: { dir: "<<" }, operands: [packed("b8", hexBits("AA", 8), true)] })).toBe(false);
    expect(streamFourState({ kind: "struct", name: "s", members: mixed })).toBe(true);
  });
  it("§5.7.1, §11.4.14: an integer literal is of type logic, so {<< 4 {6'b11_0101}} is a 4-state stream", () => {
    const run = preset("remainder");
    expect(run.pack!.fourState).toBe(true);
    expect(run.pack!.steps[0].text).toMatch(/6'b11_0101 is an integer literal, of type logic \(4-state\) \(§5\.7\.1\), so the stream is 4-state \(§11\.4\.14\)/);
  });
  it("§11.4.14: the per-field streams name every 4-state field once", () => {
    expect(preset("whole-vs-field").pack!.steps[0].text).toMatch(/hdr\.len, hdr\.addr and hdr\.kind are logic \(4-state\), so the stream is 4-state/);
  });
  it("§11.4.14: the 4-state hdr stream is implicitly cast to the 2-state byte queue even with no x", () => {
    const text = preset("big-endian").pack!.steps[3].text;
    expect(text).toMatch(/q is 2-state, so the 4-state stream is implicitly cast to its type \(§11\.4\.14\); it holds no x or z bits, so no bit changes\./);
  });
});

describe("§11.4.14.2 re-ordering of the generic stream", () => {
  const abcd = () => packed("j", ["A", "B", "C", "D"].flatMap(charBits));
  const chars = (bits: readonly TaggedBit[]) => {
    let out = "";
    for (let i = 0; i < bits.length; i += 8) out += String.fromCharCode(parseInt(v(bits.slice(i, i + 8)), 2));
    return out;
  };
  it('§11.4.14.2 example: { >> {j}} generates "A" "B" "C" "D"', () => {
    expect(chars(flatten({ kind: "stream", op: { dir: ">>" }, operands: [abcd()] }))).toBe("ABCD");
  });
  it('§11.4.14.2 example: { << byte {j}} generates "D" "C" "B" "A"', () => {
    expect(chars(flatten({ kind: "stream", op: { dir: "<<", slice: 8 }, operands: [abcd()] }))).toBe("DCBA");
  });
  it('§11.4.14.2 example: { << 16 {j}} generates "C" "D" "A" "B"', () => {
    expect(chars(flatten({ kind: "stream", op: { dir: "<<", slice: 16 }, operands: [abcd()] }))).toBe("CDAB");
  });
  it("§11.4.14.2 example: { << { 8'b0011_0101 }} generates 'b1010_1100 (default slice 1)", () => {
    expect(v(flatten({ kind: "stream", op: { dir: "<<" }, operands: [lit("00110101")] }))).toBe("10101100");
  });
  it("§11.4.14.2 example: { << 4 { 6'b11_0101 }} generates 'b0101_11: the left-most slice is short", () => {
    expect(sliceFromRight(6, 4)).toEqual([
      { start: 0, end: 1, width: 2, number: 1 },
      { start: 2, end: 5, width: 4, number: 0 },
    ]);
    const run = preset("remainder");
    expect(run.answer).toBe("6'b01_0111");
    expect(v(run.pack!.reordered)).toBe("010111");
    expect(run.pack!.steps[1].text).toMatch(/left-most slice, slice 1, keeps the remaining 2 bits, with no padding or truncation/);
  });
  it("§11.4.14.2 example: { >> 4 { 6'b11_0101 }} generates 'b1101_01: >> ignores the slice size", () => {
    expect(v(flatten({ kind: "stream", op: { dir: ">>", slice: 4 }, operands: [lit("110101")] }))).toBe("110101");
    const p = STREAM_PRESETS.find((x) => x.id === "remainder")!;
    expect(runStream({ ...p.config, op: ">>4" }).pack!.steps[1].text).toMatch(/slice size 4 is ignored/);
  });
  it("§11.4.14.2: << keeps the bit order inside each slice", () => {
    const r = reorder(flatten(lit("11110000_10100101")), { dir: "<<", slice: 8 });
    expect(v(r.out)).toBe("1010010111110000");
  });
  it("§11.4.14.2: a slice size of zero or less is an error", () => {
    expect(sliceSizeError({ dir: "<<", slice: 0 })).toMatch(/must be positive \(§11\.4\.14\.2\)/);
    expect(sliceSizeError({ dir: "<<", slice: -2 })).toMatch(/error/);
    expect(sliceSizeError({ dir: "<<" })).toBeNull();
    expect(packStream({ dir: "<<", slice: 0 }, [lit("1010")], fixed("r", 4)).ok).toBe(false);
  });
  it("§11.4.14.2: the lesson's 32'h1234_5678 byte, nibble and bit reversals", () => {
    const w = packed("w", hexBits("12345678", 32));
    const r = (slice?: number) => hexOf(flatten({ kind: "stream", op: { dir: "<<", slice }, operands: [w] }));
    expect(r(8)).toBe("32'h7856_3412");
    expect(r(4)).toBe("32'h8765_4321");
    expect(r()).toBe("32'h1E6A_2C48");
  });
  it("§11.4.14.2: bit-reversed fields show reversed bit numbers", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "big-endian")!;
    const run = runStream({ ...p.config, op: "<<", target: "w32" });
    expect(bitRuns(run.pack!.reordered).map((r) => r.label)).toEqual(["kind[0:7]", "addr[0:15]", "len[0:7]"]);
  });
});

describe("§11.4.14 the stream as an assignment source", () => {
  const stream32 = () => flatten(packed("s", hexBits("04BEEF01", 32)));
  it("§11.4.14 rule, §11.4.14.3 example: bit [96:1] y = {>>{a, b, c}} is OK and int j = {>>{a, b, c}} is an error", () => {
    const abc = [packed("a", hexBits("00000000", 32)), packed("b", hexBits("00000000", 32)), packed("c", hexBits("00000001", 32))];
    expect(packStream({ dir: ">>" }, abc, fixed("y", 96)).ok).toBe(true);
    const j = packStream({ dir: ">>" }, abc, fixed("j", 32));
    expect(j.ok).toBe(false);
    expect(j.error).toMatch(/narrower than the 96-bit stream: the standard requires an error \(§11\.4\.14\)/);
  });
  it("§11.4.14 rule, §11.4.14.3 example: bit [99:0] d = {>>{a, b, c}} is padded with 4 zero bits on the right", () => {
    const abc = [packed("a", hexBits("FFFFFFFF", 32)), packed("b", hexBits("FFFFFFFF", 32)), packed("c", hexBits("FFFFFFFF", 32))];
    const d = packStream({ dir: ">>" }, abc, fixed("d", 100));
    expect(d.fit!.zeroFill).toBe(4);
    expect(v(d.fit!.bits).slice(96)).toBe("0000");
    expect(d.fit!.bits.slice(96).every((b) => b.origin === FILL_ORIGIN)).toBe(true);
  });
  it("§11.4.14: a wider fixed target is left-aligned and zero-filled on the right", () => {
    const run = preset("wide-target");
    expect(run.answer).toBe("40'h04_BEEF_0100");
    expect(run.pack!.steps[3].text).toMatch(/left-aligned and 8 zero bits are filled on the right/);
  });
  it("§11.4.14: a narrower fixed target is an error, not a truncation", () => {
    const run = preset("narrow-target");
    expect(run.answer).toBe(ERROR_LABEL);
    expect(run.answerIsError).toBe(true);
    expect(run.pack!.steps[3].error).toBe(true);
    expect(run.options.find((o) => o.id === "truncated")?.label).toBe("24'hBE_EF01");
  });
  it("§11.4.14: a queue is resized to the fewest elements that hold the stream, element 0 the MSB end", () => {
    const fit = fitToTarget(stream32(), STREAM_TARGETS.byteq);
    expect(fit.elements!.map((e) => hexOf(e))).toEqual(["8'h04", "8'hBE", "8'hEF", "8'h01"]);
    expect(preset("big-endian").answer).toBe("8'h04");
    expect(preset("little-endian").answer).toBe("8'h01");
  });
  it("§11.4.14: a resized queue wider than the stream is zero-filled on the right", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "remainder")!;
    const run = runStream({ ...p.config, target: "byteq" });
    expect(run.answer).toBe("8'h5C");
    expect(run.pack!.fit!.zeroFill).toBe(2);
    expect(run.pack!.steps[3].text).toMatch(/resized to the smallest number of 8-bit elements that holds 6 bits: 1, and the last 2 bits are zeros filled on the right/);
  });
  it("§11.4.14, §6.11.2: the stream is cast to the target type, so a 2-state queue gets 0 for x", () => {
    const stream = flatten(packed("s", hexBits("0x", 8)));
    const fit = fitToTarget(stream, STREAM_TARGETS.byteq);
    expect(hexOf(fit.elements![0])).toBe("8'h00");
    expect(fit.converted).toBe(4);
    expect(fit.text).toMatch(/2-state.*x and z bits into 0 \(§11\.4\.14, §6\.11\.2\)/);
    expect(hexOf(fitToTarget(stream, STREAM_TARGETS.w32).bits)).toBe("32'h0x00_0000");
  });
  it("§11.4.14: a stream with no bits leaves a queue with 0 elements", () => {
    expect(fitToTarget([], STREAM_TARGETS.byteq).elements).toEqual([]);
  });
});

describe("§11.4.14.3 the stream as an assignment target (unpack)", () => {
  const abcItems: UnpackItem[] = ["a", "b", "c"].map((name) => ({ kind: "fixed", name, width: 32, twoState: true }));
  it("§11.4.14.3 example: {>>{a, b, c}} = 23'b1 is an error: too few bits", () => {
    const u = unpackStream({ dir: ">>" }, abcItems, packed("s", binBits("1".padStart(23, "0"))), "23'b1");
    expect(u.status).toBe("error");
    expect(u.message).toMatch(/more bits are needed than the source provides, which is an error \(§11\.4\.14\.3\)/);
  });
  it("§11.4.14.3 example: {>>{a, b, c}} = 96'b1 unpacks a = 0, b = 0, c = 1", () => {
    const u = unpackStream({ dir: ">>" }, abcItems, packed("s", binBits("1".padStart(96, "0"))), "96'b1");
    expect(["a", "b", "c"].map((n) => parseInt(v(u.values[n]), 2))).toEqual([0, 0, 1]);
  });
  it("§11.4.14.3 example: {>>{a, b, c}} = 100'b11111 unpacks the 96 MSBs; the 4 LSBs are ignored", () => {
    const u = unpackStream({ dir: ">>" }, abcItems, packed("s", binBits("11111".padStart(100, "0"))), "100'b11111");
    expect(["a", "b", "c"].map((n) => parseInt(v(u.values[n]), 2))).toEqual([0, 0, 1]);
    expect(u.ignored).toBe(4);
  });
  it("§11.4.14.3: the lab's unpack consumes the left end and ignores the low bits", () => {
    const run = preset("unpack");
    expect(run.answer).toBe("16'hBEEF");
    expect(run.unpack!.steps[0].text).toMatch(/32 bits at its left \(most significant\) end are consumed and the 8 low bits are ignored/);
    expect(run.options.find((o) => o.id === "low-end")?.label).toBe("16'hEF01");
  });
  it("§11.4.14.3: a 24-bit source for the 32-bit hdr is an error", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "unpack")!;
    const run = runStream({ ...p.config, target: "w24" });
    expect(run.answer).toBe(ERROR_LABEL);
    expect(run.unpack!.steps).toHaveLength(1);
    expect(run.options.some((o) => o.id === "zero-padded")).toBe(true);
  });
  it("§11.4.14.3: unpack is the reverse of pack, so {<< 8 {hdr}} = w swaps the bytes back", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "unpack")!;
    const run = runStream({ ...p.config, op: "<<8", target: "w32" });
    expect(run.answer).toBe("16'hEFBE");
    expect(hexOf(run.unpack!.values["hdr.len"])).toBe("8'h01");
    expect(hexOf(run.unpack!.values["hdr.kind"])).toBe("8'h04");
  });
  it("§11.4.14.3: unpacking a pack gives the operands back, a short slice included", () => {
    const pk = packStream({ dir: "<<", slice: 4 }, [lit("110101")], fixed("r6", 6));
    const back = unpackStream({ dir: "<<", slice: 4 }, [{ kind: "fixed", name: "r6", width: 6, twoState: false }], packed("s", pk.fit!.bits.map((b) => b.v)), "s");
    expect(v(back.values.r6)).toBe("110101");
    expect(reorderPermutation(6, { dir: "<<", slice: 4 })).toEqual([2, 3, 4, 5, 0, 1]);
  });
  it("§11.4.14.3: a 4-state stream unpacked into a 2-state target is cast to 2-state", () => {
    const u = unpackStream({ dir: ">>" }, [{ kind: "fixed", name: "b", width: 8, twoState: true }], packed("s", hexBits("x1", 8)), "s");
    expect(hexOf(u.values.b)).toBe("8'h01");
  });
});

describe("§11.4.14.4 streaming dynamically sized data", () => {
  it("§11.4.14.4: with [0 +: hdr.len] reads hdr.len filled earlier by the same unpack", () => {
    const run = preset("with-payload");
    expect(run.answer).toBe("4");
    expect(run.unpack!.values.payload.length).toBe(32);
    expect(run.unpack!.steps[3].text).toMatch(/evaluated just before payload is unpacked, after hdr\.len was filled, so it reads hdr\.len = 4 \(§11\.4\.14\.4\)/);
    expect(run.unpack!.ignored).toBe(16);
  });
  it("§11.4.14.4: without a with range the first dynamic item is greedy", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "with-payload")!;
    const run = runStream({ ...p.config, withRange: false });
    expect(run.answer).toBe("6");
    expect(run.code.at(-1)).toBe("{>> {hdr, payload}} = rx;");
  });
  it("§11.4.14.4, §11.4.14.3: a with range that needs more bits than the source has is an error", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "with-payload")!;
    const run = runStream({ ...p.config, lenByte: 8 });
    expect(run.answer).toBe(ERROR_LABEL);
    expect(run.unpack!.message).toMatch(/need 96 bits but rx provides only 80/);
    expect(runStream({ ...p.config, lenByte: 8, withRange: false }).answer).toBe("6");
  });
  it("§11.4.14.4: the greedy item stops before later fixed-size items; later dynamic items stay empty", () => {
    const items: UnpackItem[] = [
      { kind: "dynamic", name: "d1", elementWidth: 8, twoState: true },
      { kind: "dynamic", name: "d2", elementWidth: 8, twoState: true },
      { kind: "fixed", name: "crc", width: 8, twoState: true },
    ];
    const u = unpackStream({ dir: ">>" }, items, packed("s", hexBits("11223344", 32)), "s");
    expect(u.sizes).toEqual({ d1: 3, d2: 0 });
    expect(hexOf(u.values.crc)).toBe("8'h44");
  });
  it("§11.4.14.4: a with count that depends on a field unpacked under << is left unmodelled, not guessed", () => {
    const items: UnpackItem[] = [
      { kind: "fixed", name: "len", width: 8, twoState: true },
      { kind: "dynamic", name: "payload", elementWidth: 8, twoState: true, withRange: { countFrom: "len" } },
    ];
    expect(unpackStream({ dir: "<<", slice: 8 }, items, packed("s", hexBits("02AABB", 24)), "s").status).toBe("not-modelled");
  });
  it("§11.4.14.4: a greedy share that is not whole elements is left unmodelled", () => {
    const items: UnpackItem[] = [{ kind: "dynamic", name: "d", elementWidth: 8, twoState: true }];
    expect(unpackStream({ dir: ">>" }, items, packed("s", binBits("101")), "s").status).toBe("not-modelled");
  });
  it("§11.4.14.4, Table 7-1: on the pack side a range past the end streams nonexistent entries ('0 or 'x)", () => {
    const two: StreamExpr = { kind: "array", name: "p", elements: [hexBits("AA", 8)], elementWidth: 8, elementTwoState: true, withCount: 2 };
    expect(hexOf(flatten(two))).toBe("16'hAA00");
    expect(flatten(two).slice(8).every((b) => b.origin === NONEXISTENT_ORIGIN)).toBe(true);
    const four: StreamExpr = { ...two, elementTwoState: false };
    expect(hexOf(flatten(four))).toBe("16'hAAxx");
    const short: StreamExpr = { kind: "array", name: "p", elements: [hexBits("AA", 8), hexBits("BB", 8)], elementWidth: 8, elementTwoState: true, withCount: 1 };
    expect(hexOf(flatten(short))).toBe("8'hAA");
  });
});

describe("whole-struct reversal vs per-field swap (§11.4.14.1, §11.4.14.2)", () => {
  it("§11.4.14.2: {<< 8 {hdr}} reverses every byte, so the fields swap order", () => {
    const run = preset("whole-vs-field");
    const whole = run.compare.find((r) => r.code === "w = {<< 8 {hdr}};");
    expect(whole?.result).toBe("32'h01EF_BE04");
  });
  it("§11.4.14.1: streaming each field on its own swaps only the bytes inside addr", () => {
    const run = preset("whole-vs-field");
    expect(run.answer).toBe("32'h04EF_BE01");
    expect(run.code.at(-1)).toBe("w = {>> {{<< 8 {hdr.len}}, {<< 8 {hdr.addr}}, {<< 8 {hdr.kind}}}};");
    expect(bitRuns(run.pack!.packed).map((r) => r.label)).toEqual(["len[7:0]", "addr[7:0]", "addr[15:8]", "kind[7:0]"]);
    expect(run.options.map((o) => o.label)).toEqual(expect.arrayContaining(["32'h01EF_BE04", "32'h04BE_EF01"]));
  });
});

describe("§6.24.1 and §6.24.3 bit-stream casting", () => {
  it("§6.24.3: word_t'(rec) keeps the order: 32'h04BE_EF01, first member in the MSBs", () => {
    const r = bitStreamCast(castSource("rec"), CAST_DESTS.word_t);
    expect(r.compiles).toBe(true);
    expect(hexOf(r.value!)).toBe("32'h04BE_EF01");
  });
  it("§6.24.3: data are extracted into the destination left to right, so a cast back to the struct is exact", () => {
    // Cutting from the left is the same flatten in reverse; casting rec to word_t and back gives the members again.
    const r = bitStreamCast(castSource("rec"), CAST_DESTS.word_t);
    const bits = r.value!.map((b) => b.v);
    expect([bits.slice(0, 8), bits.slice(8, 24), bits.slice(24)].map(formatBits)).toEqual(["8'h04", "16'hBEEF", "8'h01"]);
  });
  it("§6.24.3 example: a 24-bit struct {bit[7:0] a; shortint b;} cast to int is a compile-time error", () => {
    const r = bitStreamCast(castSource("rec24"), CAST_DESTS.int);
    expect(r.compiles).toBe(false);
    expect(r.failure).toBe("size");
    expect(r.message).toMatch(/compile-time error.*either type is unpacked \(§6\.24\.3\)/);
  });
  it("§6.24.3: equal sizes compile, so the 24-bit record casts to a 24-bit typedef", () => {
    const r = bitStreamCast(castSource("rec24"), CAST_DESTS.bits24_t);
    expect(r.compiles).toBe(true);
    expect(hexOf(r.value!)).toBe("24'h04_BEEF");
  });
  it("§6.24.3: a 40-bit destination for the 32-bit rec is a compile-time error", () => {
    expect(bitStreamCast(castSource("rec"), CAST_DESTS.wide_t).failure).toBe("size");
  });
  it("§6.24.1 Syntax 6-7: logic [31:0]'(rec) does not parse: the casting type must be a single type name", () => {
    const r = bitStreamCast(castSource("rec"), CAST_DESTS.inline);
    expect(r.failure).toBe("type-name");
    expect(r.message).toMatch(/does not parse.*Syntax 6-7.*\(§6\.24\.1\)/);
  });
  it("§6.24.3 b, §6.11.2: an x in addr arrives in an int as 0", () => {
    const run = runCast({ source: "rec", dest: "int", xInAddr: true });
    expect(hexOf(run.result.generic)).toBe("32'h04BE_Ex01");
    expect(run.result.genericFourState).toBe(true);
    expect(run.result.converted).toBe(4);
    expect(run.valueText).toBe(`32'h04BE_E001 (${0x04bee001})`);
    expect(run.result.steps[2]).toMatch(/x and z bits become 0 \(§6\.24\.3 b, §6\.11\.2\)/);
  });
  it("§6.24.3: a 4-state destination (word_t is logic) keeps the x", () => {
    const r = bitStreamCast(castSource("rec", true), CAST_DESTS.word_t);
    expect(hexOf(r.value!)).toBe("32'h04BE_Ex01");
    expect(castValueText(r, CAST_DESTS.word_t)).toBe("32'h04BE_Ex01");
  });
  it("the lesson's three-row table: word_t'(rec), {>> {rec}} and {<< 8 {rec}}", () => {
    expect(castCompareRows(castSource("rec")).map((r) => r.result)).toEqual(["32'h04BE_EF01", "32'h04BE_EF01", "32'h01EF_BE04"]);
  });
  it("§11.4.14, §6.24.3: with the 24-bit record the cast fails and the streams left-align with a zero fill", () => {
    const rows = castCompareRows(castSource("rec24"));
    expect(rows.map((r) => r.result)).toEqual(["compile-time error", "32'h04BE_EF00", "32'hEFBE_0400"]);
    expect(rows[1].why).toMatch(/8 zero bits on the right/);
  });
});

describe("prediction options", () => {
  const allStream = () => STREAM_PRESETS.map((p) => ({ id: p.id, run: runStream(p.config) }));
  it("every stream preset has exactly one correct option, equal to the model's answer, and unique labels", () => {
    for (const { id, run } of allStream()) {
      const correct = run.options.filter((o) => o.correct);
      expect(correct, id).toHaveLength(1);
      expect(correct[0].label, id).toBe(run.answer);
      expect(new Set(run.options.map((o) => o.label)).size, id).toBe(run.options.length);
      expect(run.options.length, id).toBeGreaterThanOrEqual(2);
      run.options.forEach((o) => expect(o.feedback.length, `${id} ${o.id}`).toBeGreaterThan(20));
    }
  });
  it("the code a learner reads before predicting holds no result", () => {
    for (const { id, run } of allStream()) {
      const code = run.code.join("\n");
      // A sized literal answer (not a count such as payload.size(), not a q[0] byte read straight from a field).
      if (!run.answerIsError && run.answer.includes("'") && run.pack?.fit?.elements === undefined) expect(code, id).not.toContain(run.answer);
      // A >> row reproduces the source as written (the remainder literal is its own {>> 4} result), so it is no leak.
      run.compare.filter((row) => !row.code.includes("{>>")).forEach((row) => expect(code, id).not.toContain(row.result));
    }
  });
  it("preset labels name the situation, never its outcome", () => {
    for (const p of STREAM_PRESETS) {
      const run = runStream(p.config);
      expect(p.label, p.id).not.toMatch(/error|zero fill|swap|ignored|endian/i);
      if (run.answer.includes("'")) expect(p.label, p.id).not.toContain(run.answer);
    }
    for (const p of CAST_PRESETS) expect(p.label, p.id).not.toMatch(/error|compile|type name|order kept|becomes/i);
  });
  it("preset sections, shown before the prediction, name the lesson heading and never the outcome", () => {
    for (const p of STREAM_PRESETS) {
      const run = runStream(p.config);
      expect(p.section, p.id).not.toMatch(/error|zero fill|swap|ignored|endian/i);
      if (run.answer.includes("'")) expect(p.section, p.id).not.toContain(run.answer);
    }
    for (const p of CAST_PRESETS) {
      expect(p.section, p.id).not.toMatch(/error|compile|type name|order kept|becomes/i);
      expect(p.section, p.id).not.toMatch(/must be|size|name/i);
    }
    expect(STREAM_PRESETS.filter((p) => p.config.subject === "fieldswap" || p.config.subject === "payload" || p.id === "little-endian").map((p) => p.section)).toEqual(
      Array(3).fill("Expert: Streaming aggregates and byte order at scale"),
    );
  });
  it("every reachable stream config has exactly one correct option, equal to the answer, with unique labels", () => {
    const configs: StreamConfig[] = [];
    for (const subject of Object.keys(SUBJECT_OPS) as (keyof typeof SUBJECT_OPS)[])
      for (const direction of ["pack", "unpack"] as const)
        for (const op of SUBJECT_OPS[subject])
          for (const target of SUBJECT_TARGETS[subject])
            for (const xInAddr of [false, true])
              for (const withRange of [false, true])
                for (const lenByte of [0, 1, 4, 5, 8, 9, 200]) configs.push({ subject, direction, op, target, xInAddr, withRange, lenByte });
    expect(configs.length).toBeGreaterThan(1000);
    for (const c of configs) {
      const run = runStream(c);
      const key = JSON.stringify(c);
      const correct = run.options.filter((o) => o.correct);
      expect(correct, key).toHaveLength(1);
      expect(correct[0].label, key).toBe(run.answer);
      expect(new Set(run.options.map((o) => o.label)).size, key).toBe(run.options.length);
    }
    expect(Object.keys(STREAM_OPS).length).toBe(6);
  });
  it("every cast config has one correct compile option and, when it compiles, one correct value", () => {
    for (const source of CAST_SOURCE_IDS)
      for (const dest of CAST_DEST_IDS)
        for (const xInAddr of [false, true]) {
          const run = runCast({ source, dest, xInAddr });
          const key = `${source} ${dest} ${xInAddr}`;
          expect(run.compileOptions.filter((o) => o.correct), key).toHaveLength(1);
          if (run.result.compiles) {
            expect(run.valueOptions.filter((o) => o.correct), key).toHaveLength(1);
            expect(new Set(run.valueOptions.map((o) => o.label)).size, key).toBe(run.valueOptions.length);
          }
        }
  });
  it("the correct option's feedback is the deciding rule in a sentence or two, not the whole step chain", () => {
    for (const p of STREAM_PRESETS) {
      const run = runStream(p.config);
      const fb = run.options.find((o) => o.correct)!.feedback;
      const steps = run.pack?.steps ?? run.unpack?.steps ?? [];
      expect(fb.match(/[.!?](\s|$)/g)?.length ?? 0, `${p.id}: ${fb}`).toBeLessThanOrEqual(2);
      if (run.pack) steps.forEach((s) => expect(fb, p.id).not.toContain(s.text));
      expect(fb, p.id).toMatch(/§/);
    }
    expect(preset("wide-target").options.find((o) => o.correct)!.feedback).toBe(">> keeps the stream in order (§11.4.14.2). The stream is left-aligned in w40, with 8 zero bits filled on the right (§11.4.14).");
    expect(preset("remainder").options.find((o) => o.correct)!.feedback).toMatch(/^<< 4 cuts 4-bit slices from the right, the left-most one short, and reverses their order \(§11\.4\.14\.2\)\./);
    expect(preset("with-payload").options.find((o) => o.correct)!.feedback).toBe(
      "The with range reads hdr.len = 4, filled just before by the same unpack, so payload is resized to 4 elements (§11.4.14.4).",
    );
    expect(preset("unpack").options.find((o) => o.correct)!.feedback).toBe("The 32 bits at the left (most significant) end of the source fill hdr, left field first (§11.4.14.3).");
    const x = runCast({ source: "rec", dest: "int", xInAddr: true });
    expect(x.valueOptions.find((o) => o.correct)!.feedback).toBe(
      "A bit-stream cast keeps the bit order: rec's first member lands in the most significant bits of int (§6.24.3). int is 2-state, so the 4 x and z bits become 0 (§6.24.3 b, §6.11.2).",
    );
  });
  it("segment labels name a field's own bits in words, so they never read as a second bracketed range", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "big-endian")!;
    const run = runStream({ ...p.config, op: "<<", target: "w32" });
    expect(bitRuns(run.pack!.reordered).map(segmentWords)).toEqual(["kind bits 0..7", "addr bits 0..15", "len bits 0..7"]);
    expect(bitRuns(preset("wide-target").pack!.fit!.bits).map(segmentWords)).toEqual(["len bits 7..0", "addr bits 15..0", "kind bits 7..0", "zero fill"]);
    expect(segmentWords(bitRuns(flatten(packed("k", binBits("1"))))[0])).toBe("k bit 0");
  });
  it("every operator of a subject is compared on the same target", () => {
    const run = preset("big-endian");
    expect(run.compare.map((r) => r.code)).toEqual(SUBJECT_OPS.hdr.map((id) => runStream({ ...run.config, op: id }).code.at(-1)));
  });
  it("every cast preset has one correct compile option and, when it compiles, one correct value", () => {
    for (const p of CAST_PRESETS) {
      const run = runCast(p.config);
      expect(run.compileOptions.filter((o) => o.correct), p.id).toHaveLength(1);
      if (run.result.compiles) {
        expect(run.valueOptions.filter((o) => o.correct), p.id).toHaveLength(1);
        expect(new Set(run.valueOptions.map((o) => o.label)).size).toBe(run.valueOptions.length);
      } else expect(run.valueOptions).toEqual([]);
      expect(run.code.join("\n")).not.toMatch(/04BE_E001|01EF_BE04/);
    }
  });
  it("in a 2-state destination only the x-kept distractor still holds an x", () => {
    const run = runCast({ source: "rec", dest: "int", xInAddr: true });
    const withX = run.valueOptions.filter((o) => o.label.includes("x"));
    expect(withX.map((o) => o.id)).toEqual(["x-kept"]);
  });
  it("arrangeOptions is a stable permutation", () => {
    const opts = [
      { id: "a", label: "a", correct: true },
      { id: "b", label: "b", correct: false },
      { id: "c", label: "c", correct: false },
    ];
    const once = arrangeOptions(opts, "s");
    expect(arrangeOptions(opts, "s")).toEqual(once);
    expect(once.map((o) => o.id).sort()).toEqual(["a", "b", "c"]);
  });
  it("the stream code starts from the lesson's hdr and writes x as a hex digit when injected", () => {
    const p = STREAM_PRESETS.find((x) => x.id === "wide-target")!;
    expect(streamCode(p.config)).toContain("hdr_rec_t hdr = '{len: 8'h04, addr: 16'hBEEF, kind: 8'h01};");
    expect(streamCode({ ...p.config, xInAddr: true })).toContain("hdr_rec_t hdr = '{len: 8'h04, addr: 16'hBEEx, kind: 8'h01};");
  });
});
