/**
 * Bit-level model of SystemVerilog aggregate types: packed structs, packed
 * (hard, soft and tagged) unions, and the enum rules that bite inside them.
 *
 * Pure and deterministic (no React). Every rule names the IEEE 1800-2023 clause
 * it implements; tests in tests/lib/sv-aggregate-layout-model.test.ts pin each one.
 *
 * Structs
 * - §7.2.1  a packed struct is one vector: the first member is the most
 *           significant, members are contiguous, the whole can be sliced
 *           [n-1:0] and used with operators; unsigned unless declared signed;
 *           4-state if any member is 4-state (2-state members convert on
 *           read and write). An unpacked struct has an implementation-dependent
 *           packing, normally matching the C compiler (§7.2.1), so it has no
 *           bit numbering; §6.22.3 defines no implicit cast from an integral
 *           value to it (an explicit bit-stream cast, §6.24.3, is the route).
 * - §20.6.2 $bits is the total width.
 * - §6.22.3, §10.7  an integral value assigned to a packed struct is extended
 *           or truncated with no required warning; an unsigned narrower
 *           source is zero-extended.
 * - §7.2, Syntax 7-1 footnote 20  random_qualifier only within unpacked structs.
 * - §6.22.1, §6.22.2  type matching and equivalence: two local typedefs of an
 *           unpacked struct are different types (§6.22.1 d) and no rule of
 *           §6.22.2 makes them equivalent; a typedef in a package matches itself
 *           wherever it is imported (§6.22.1 h); packed structs of equal width,
 *           state-ness and signedness are equivalent (§6.22.2 c). Any two
 *           packed types are assignment compatible (§6.22.3). Two unpacked
 *           structs that are not equivalent are not assignment compatible; they
 *           are still cast compatible, not type incompatible, because a
 *           bit-stream cast is defined for them (§6.22.4, §6.22.5, §6.24.3).
 * - Table 6-7  a variable with no initializer starts at 'x when 4-state and at
 *           '0 when 2-state, which sets the starting value of a struct or union.
 *
 * Unions
 * - §7.3.1  packed untagged members name the same bits; a write through one
 *           member and a read through another is defined and independent of
 *           host byte order. Hard packed (`union packed`) needs equal sizes.
 *           Soft packed (`union soft`) is as wide as its widest member,
 *           right-justifies members (recursively) and leaves the bits above a
 *           narrower written member unaffected. A 2-state member plus a
 *           4-state member makes the union 4-state, with an implicit conversion
 *           when reading and writing that member; the conversion to 2-state
 *           turns x/z into 0 (§6.11.2).
 * - §7.4.1  a packed array `[3:0][7:0]` is one contiguous vector. Element 3
 *           at the most significant end is derived from the range; the §7.3.1
 *           example shows it, where u1.byte_slice[51] is u1.bit_slice[415:408].
 * - §7.3.2  packed tagged layout: tag bits left-justified, the minimum number
 *           that codes every member; each member right-justified; the bits
 *           between undefined; a void member leaves only the tag significant.
 *           It fixes the tag's width and position, not its code values: those
 *           follow Figures 7-2 and 7-3 (0, then 1), and a third member's code
 *           is our own extension of that numbering.
 *           The tag changes only through a tagged expression.
 * - §11.9   reading a member that does not match the tag is a run-time error;
 *           an uninitialized tagged union, tag included, is undefined. That
 *           such a read has no defined result, and that %p has no defined
 *           output, are derived from this and labelled so.
 * - §21.2.1.6  %p prints tag:value for a tagged union. It states that, and the
 *           first-declared-member rule for untagged unions, in its paragraph on
 *           aggregates, while its rules for singular values name only packed
 *           structures. A packed union, tagged or not, is a singular integral
 *           value (§6.4, §6.11.1), so the model shows the same reading there and
 *           labels the output tool-dependent. It says nothing about the value
 *           part for a void member, so the bare tag is labelled derived.
 *           §21.2.1.3 x/z digits in %h and %d.
 *
 * Enums
 * - Table 6-7  an enum variable starts at its base type's default: 0 for a
 *           2-state base (int, bit), x for a 4-state base (logic).
 * - §6.19.3  enums are strongly typed, "unless the enum variable is a member
 *           of a union": a write through another union member can leave the
 *           enum holding a non-member value. The same back door through a
 *           packed struct written as a whole vector is derived from §7.2.1
 *           (the struct is one vector) and is labelled "derived".
 * - §6.19.4  a static cast converts without checking validity; §6.24.2 $cast
 *           as a function checks, returns 0 and leaves the target unchanged.
 * - §6.19.5.3  next() steps in declaration order and wraps; a non-member
 *           gives the default initial value. §6.19.5.6 name() of a
 *           non-member is "".
 *
 * Values are SvValue from sv-expression-model (VPI aval/bval planes).
 */

import { enumDefault, type EnumTypeModel } from "@/lib/sv-enum-string-model";
import {
  allX,
  bitAt,
  bitsOf,
  fromBigInt,
  fromBits,
  isKnown,
  makeValue,
  maskOf,
  resize,
  toBigInt,
  toTwoState,
  type Bit4,
  type SvValue,
} from "@/lib/sv-expression-model";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const big = (n: number) => BigInt(n);

// ---------------------------------------------------------------------------
// Literals and formatting
// ---------------------------------------------------------------------------

/**
 * A sized hex literal such as `svHex(32, "5ABC_0042")`. Underscores are
 * ignored; a digit `x` or `z` fills its nibble with x or z. Digits narrower than
 * the size are padded on the left with 0, or with x or z when the leftmost digit
 * is x or z; digits wider than the size are truncated from the left (§5.7.1).
 */
export function svHex(width: number, digits: string): SvValue {
  const clean = digits.replace(/_/g, "").toLowerCase();
  let aval = ZERO;
  let bval = ZERO;
  for (const ch of clean) {
    aval <<= big(4);
    bval <<= big(4);
    if (ch === "x") {
      aval |= big(0xf);
      bval |= big(0xf);
    } else if (ch === "z") {
      bval |= big(0xf);
    } else {
      const d = parseInt(ch, 16);
      if (Number.isNaN(d)) throw new Error(`svHex: "${ch}" is not a hex digit`);
      aval |= big(d);
    }
  }
  const given = clean.length * 4;
  if (given < width && (clean[0] === "x" || clean[0] === "z")) {
    const pad = maskOf(width) & ~maskOf(given);
    bval |= pad;
    if (clean[0] === "x") aval |= pad;
  }
  return makeValue(width, false, aval, bval);
}

/** A sized unsigned decimal value such as `svDec(8, 100)`. */
export const svDec = (width: number, n: number): SvValue => fromBigInt(big(n), width, false);

/** Bits of `v` from `hi` down to `lo` as a new unsigned value (a part-select, §11.5.1). */
export function slice(v: SvValue, hi: number, lo: number): SvValue {
  const width = hi - lo + 1;
  const m = maskOf(width);
  return makeValue(width, false, (v.aval >> big(lo)) & m, (v.bval >> big(lo)) & m);
}

/** `v` with bits `hi:lo` replaced by `src` resized to that range (§10.7). The other bits are untouched. */
export function splice(v: SvValue, hi: number, lo: number, src: SvValue): SvValue {
  const width = hi - lo + 1;
  const fitted = resize(src, width, src.signed, false);
  const hole = maskOf(width) << big(lo);
  const aval = (v.aval & ~hole) | (fitted.aval << big(lo));
  const bval = (v.bval & ~hole) | (fitted.bval << big(lo));
  return makeValue(v.width, v.signed, aval, bval);
}

/** The bit numbers `hi` down to `lo`. */
export function bitRange(hi: number, lo: number): number[] {
  const out: number[] = [];
  for (let i = hi; i >= lo; i -= 1) out.push(i);
  return out;
}

/** Bit numbers of `v` whose value differs from `before`. */
export function changedBits(before: SvValue, after: SvValue): number[] {
  const out: number[] = [];
  for (let i = after.width - 1; i >= 0; i -= 1) if (i >= before.width || bitAt(before, i) !== bitAt(after, i)) out.push(i);
  return out;
}

/**
 * One `%h` digit for a group of bits (§21.2.1.3): x/z when the whole group is,
 * X/Z when only some bits are. The top group of a width that is not a multiple
 * of 4 has fewer bits, and the rule applies to the bits it has.
 */
function hexDigit(nib: Bit4[]): string {
  const xs = nib.filter((b) => b === "x").length;
  const zs = nib.filter((b) => b === "z").length;
  if (xs === nib.length) return "x";
  if (zs === nib.length) return "z";
  if (xs > 0) return "X";
  if (zs > 0) return "Z";
  return parseInt(nib.join(""), 2).toString(16);
}

/** `%h`: lower-case hex, one digit per nibble, width/4 digits rounded up (§21.2.1.3). */
export function formatH(v: SvValue): string {
  const bits = bitsOf(v);
  const top = bits.length % 4;
  let out = top > 0 ? hexDigit(bits.slice(0, top)) : "";
  for (let i = top; i < bits.length; i += 4) out += hexDigit(bits.slice(i, i + 4));
  return out;
}

/** `%b`: one character per bit, most significant first. */
export const formatB = (v: SvValue): string => bitsOf(v).join("");

/** `%0d`: decimal, negative for a signed value with its top bit set, or x / X for all / some unknown bits (§21.2.1.3). */
export function formatD(v: SvValue): string {
  if (isKnown(v)) return (toBigInt(v) ?? ZERO).toString();
  const bits = bitsOf(v);
  if (bits.every((b) => b === "x")) return "x";
  if (bits.every((b) => b === "z")) return "z";
  return bits.some((b) => b === "x") ? "X" : "Z";
}

/** A `%h` digit the way the lessons write it: A to F in upper case; x, X, z and Z keep their `%h` case (§21.2.1.3). */
export const lessonHexDigits = (hex: string): string => hex.replace(/[a-f]/g, (d) => d.toUpperCase());

const groupFromRight = (text: string): string => text.replace(/\B(?=(.{4})+(?!.))/g, "_");

/** Hex with an underscore every four digits, e.g. `5ABC_0042`; x, X, z and Z digits as in `%h` (§21.2.1.3). */
export const formatHexGroups = (v: SvValue): string => groupFromRight(lessonHexDigits(formatH(v)));

/**
 * A sized literal written the way the lessons write them: `32'h5ABC_0042`, or
 * `32'hxxxx_xxxx` when whole digits are unknown. In a literal an x digit means
 * all four bits are x (§5.7.1), so a value with a partly unknown digit has no
 * hex literal: it is written in binary, `8'bxx00_0101`.
 */
export function formatSizedHex(v: SvValue): string {
  const hex = formatH(v);
  return /[XZ]/.test(hex) ? `${v.width}'b${groupFromRight(formatB(v))}` : `${v.width}'h${groupFromRight(lessonHexDigits(hex))}`;
}

// ---------------------------------------------------------------------------
// Enums with explicit member values (the lesson's opcode_e has OP_IRQ = 4'hF)
// ---------------------------------------------------------------------------

export interface EnumMemberSpec {
  name: string;
  value: number;
}

export interface EnumSpec {
  name: string;
  /** Base type as written, e.g. "logic [3:0]"; "" means the default int. */
  baseDecl: string;
  /** 4 for a logic/reg/integer base, 2 for bit/byte/int and the default int (Table 6-7). */
  states: 2 | 4;
  width: number;
  members: readonly EnumMemberSpec[];
}

/** The shape sv-enum-string-model uses, so its Table 6-7 default applies here too. */
export const enumTypeModel = (spec: EnumSpec): EnumTypeModel => ({
  name: spec.name,
  baseDecl: spec.baseDecl,
  states: spec.states,
  members: spec.members.map((m) => m.name),
});

/** Declaration text, with explicit values where the spec gives them. */
export const enumDeclarationText = (spec: EnumSpec): string =>
  `typedef enum ${spec.baseDecl ? `${spec.baseDecl} ` : ""}{ ${spec.members.map((m) => `${m.name} = ${spec.width}'h${m.value.toString(16).toUpperCase()}`).join(", ")} } ${spec.name};`;

/** Default initial value of a variable of this enum: x for a 4-state base, 0 for a 2-state base (Table 6-7). */
export function enumInitialValue(spec: EnumSpec): SvValue {
  return enumDefault(enumTypeModel(spec)) === "x" ? allX(spec.width) : fromBigInt(ZERO, spec.width);
}

/** Index of the member whose value `v` holds, or null when `v` has x/z bits or is not a member. */
export function enumMemberIndex(spec: EnumSpec, v: SvValue): number | null {
  const n = toBigInt(v, false);
  if (n === null) return null;
  const idx = spec.members.findIndex((m) => big(m.value) === n);
  return idx < 0 ? null : idx;
}

/** `name()`: the member's name, or "" when the value is not a member (§6.19.5.6). */
export function enumName(spec: EnumSpec, v: SvValue): string {
  const idx = enumMemberIndex(spec, v);
  return idx === null ? "" : spec.members[idx].name;
}

/** `num()`: the member count (§6.19.5.5). */
export const enumNum = (spec: EnumSpec): number => spec.members.length;

/** `first()` and `last()` (§6.19.5.1–2). */
export const enumFirst = (spec: EnumSpec): SvValue => svDec(spec.width, spec.members[0].value);
export const enumLast = (spec: EnumSpec): SvValue => svDec(spec.width, spec.members[spec.members.length - 1].value);

/**
 * `next()`: the following member in declaration order, wrapping from the last
 * to the first; a value that is not a member gives the default initial value
 * (§6.19.5.3, Table 6-7).
 */
export function enumNext(spec: EnumSpec, v: SvValue): SvValue {
  const idx = enumMemberIndex(spec, v);
  if (idx === null) return enumInitialValue(spec);
  return svDec(spec.width, spec.members[(idx + 1) % spec.members.length].value);
}

export interface EnumCastResult {
  code: string;
  /** The enum variable afterwards (unchanged when a $cast fails). */
  after: SvValue;
  /** $cast's return value when called as a function. */
  castReturn?: 0 | 1;
  why: string;
}

/**
 * Integer into an enum. A static cast `opcode_e'(n)` converts without checking
 * validity (§6.19.4), and the result is held in the base type's width, so an
 * `n` too wide for it loses its upper bits. `$cast(op, n)` as a function tests
 * the value `n` itself, before any narrowing: it assigns only a member value,
 * otherwise it returns 0 and leaves `op` unchanged (§6.24.2).
 */
export function enumCast(spec: EnumSpec, before: SvValue, n: number, form: "static" | "dynamic"): EnumCastResult {
  const value = svDec(spec.width, n);
  if (form === "static") {
    const member = enumMemberIndex(spec, value) !== null;
    const held = formatD(value);
    const narrowed = held === String(n) ? "" : ` ${n} does not fit the ${spec.width}-bit base type, so ${held} is what is held.`;
    return {
      code: `op = ${spec.name}'(${n});`,
      after: value,
      why: member
        ? `The static cast converts ${n} to ${spec.name}; it is the member ${enumName(spec, value)}.${narrowed}`
        : `A static cast converts without checking validity (§6.19.4), so op now holds ${held}, which is not a member: name() returns "" (§6.19.5.6).${narrowed}`,
    };
  }
  const member = spec.members.find((m) => m.value === n);
  return {
    code: `cast_ok = $cast(op, ${n});`,
    after: member ? value : before,
    castReturn: member ? 1 : 0,
    why: member ? `$cast finds the member ${member.name}, assigns it and returns 1 (§6.24.2).` : `$cast finds no member with value ${n}, leaves op unchanged and returns 0 (§6.24.2).`,
  };
}

// ---------------------------------------------------------------------------
// Packed structs (§7.2.1)
// ---------------------------------------------------------------------------

export type MemberType = { kind: "logic" } | { kind: "bit" } | { kind: "enum"; spec: EnumSpec };

export interface PackedMember {
  /** Stable id for reordering. Must not contain ":" (MutationMatrix keys) or ".". */
  id: string;
  name: string;
  width: number;
  type: MemberType;
}

export interface MemberRange {
  id: string;
  name: string;
  hi: number;
  lo: number;
  width: number;
}

export const MIN_MEMBER_WIDTH = 1;
export const MAX_MEMBER_WIDTH = 16;

/** How a member is written in the typedef. */
export function memberTypeText(m: PackedMember): string {
  if (m.type.kind === "enum") return m.type.spec.name;
  return m.width === 1 ? m.type.kind : `${m.type.kind} [${m.width - 1}:0]`;
}

/** 4 for logic and for an enum with a 4-state base; 2 for bit and 2-state enums (§6.11, Table 6-8). */
export function memberStates(m: PackedMember): 2 | 4 {
  if (m.type.kind === "enum") return m.type.spec.states;
  return m.type.kind === "logic" ? 4 : 2;
}

/** `$bits` of the struct: the sum of the member widths (§20.6.2). */
export const structBits = (members: readonly PackedMember[]): number => members.reduce((n, m) => n + m.width, 0);

/** The struct is a 4-state vector if any member is 4-state, else 2-state (§7.2.1). */
export const structStates = (members: readonly PackedMember[]): 2 | 4 => (members.some((m) => memberStates(m) === 4) ? 4 : 2);

/**
 * Bit numbers of every member: the first member is the most significant and
 * the members are contiguous down to bit 0 (§7.2.1).
 */
export function memberRanges(members: readonly PackedMember[]): MemberRange[] {
  let hi = structBits(members) - 1;
  return members.map((m) => {
    const range = { id: m.id, name: m.name, hi, lo: hi - m.width + 1, width: m.width };
    hi -= m.width;
    return range;
  });
}

/** The range of one member by name; throws when the name is unknown. */
export function memberRange(members: readonly PackedMember[], name: string): MemberRange {
  const r = memberRanges(members).find((x) => x.name === name);
  if (!r) throw new Error(`no member "${name}"`);
  return r;
}

/** `[hi:lo]`, or `[n]` for a single bit. */
export const rangeText = (r: { hi: number; lo: number }): string => (r.hi === r.lo ? `[${r.hi}]` : `[${r.hi}:${r.lo}]`);

/** Members in the order of `order` (ids), unknown ids dropped, missing members appended. */
export function reorderMembers(members: readonly PackedMember[], order: readonly string[]): PackedMember[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out: PackedMember[] = [];
  for (const id of order) {
    const m = byId.get(id);
    if (m && !seen.has(id)) {
      seen.add(id);
      out.push(m);
    }
  }
  for (const m of members) if (!seen.has(m.id)) out.push(m);
  return out;
}

/** One member's width changed, clamped to [MIN_MEMBER_WIDTH, max]. Enum members keep their base width. */
export function setMemberWidth(members: readonly PackedMember[], id: string, width: number, max = MAX_MEMBER_WIDTH): PackedMember[] {
  return members.map((m) => {
    if (m.id !== id || m.type.kind === "enum") return m;
    const clamped = Math.min(Math.max(Math.round(width), MIN_MEMBER_WIDTH), Math.max(max, MIN_MEMBER_WIDTH));
    return { ...m, width: clamped };
  });
}

/** The struct's declaration as source text; `showRanges` false leaves out the bit-range comments while a prediction about them is open. */
export function structTypedef(name: string, members: readonly PackedMember[], packed = true, showRanges = true): string {
  const ranges = memberRanges(members);
  const typeCol = Math.max(...members.map((m) => memberTypeText(m).length));
  const lines = members.map((m, i) => `  ${memberTypeText(m).padEnd(typeCol)} ${m.name};${packed && showRanges ? `  // ${rangeText(ranges[i])}` : ""}`);
  return [`typedef struct${packed ? " packed" : ""} {`, ...lines, `} ${name};${packed ? `  // $bits(${name}) == ${structBits(members)}` : ""}`].join("\n");
}

/** An all-zero vector of the struct's width. */
export const zeroStruct = (members: readonly PackedMember[]): SvValue => fromBigInt(ZERO, structBits(members));

/** What a vector of this width holds before anything assigns it: 'x when 4-state, '0 when 2-state (Table 6-7). */
export const defaultVector = (width: number, states: 2 | 4): SvValue => (states === 4 ? allX(width) : fromBigInt(ZERO, width));

/** A struct variable with no initializer: all x when any member is 4-state, else all 0 (Table 6-7, §7.2.1). */
export const structInitialValue = (members: readonly PackedMember[]): SvValue => defaultVector(structBits(members), structStates(members));

/**
 * The vector after a typedef edit changes its width. The low bits stay where
 * they are, the top bits go when it shrinks, and bits that are new when it
 * grows have never been assigned, so they hold the default (Table 6-7).
 */
export function rewidthVector(value: SvValue, width: number, states: 2 | 4): SvValue {
  if (value.width === width) return value;
  if (width < value.width) return slice(value, width - 1, 0);
  return splice(defaultVector(width, states), value.width - 1, 0, value);
}

/**
 * Read one member: its bits of the vector (§7.2.1). A 2-state member of a
 * 4-state struct converts x/z to 0 on read (§7.2.1, §6.11.2).
 */
export function readMember(members: readonly PackedMember[], value: SvValue, name: string): SvValue {
  const r = memberRange(members, name);
  const raw = slice(value, r.hi, r.lo);
  const m = members.find((x) => x.name === name)!;
  return memberStates(m) === 2 ? toTwoState(raw) : raw;
}

/** How §10.7 pads a source narrower than its target: a signed one is sign-extended, an unsigned one zero-extended. */
const extensionWord = (src: SvValue): "sign" | "zero" => (src.signed ? "sign" : "zero");

export interface MemberWrite {
  value: SvValue;
  /** The member's bits: the only bits a member write may touch (§7.2.1). */
  written: number[];
  /** Bits whose value actually changed. */
  changed: number[];
  note: string;
}

/**
 * Write one member: `src` is resized to the member's width (§10.7) and placed
 * in the member's bits; every other bit keeps its value (§7.2.1). Assigning to a
 * 2-state member turns x/z into 0 (§6.11.2) before it is stored in the 4-state
 * vector (§7.2.1).
 */
export function writeMember(members: readonly PackedMember[], value: SvValue, name: string, src: SvValue): MemberWrite {
  const r = memberRange(members, name);
  const m = members.find((x) => x.name === name)!;
  const fitted = memberStates(m) === 2 ? toTwoState(src) : src;
  const next = splice(value, r.hi, r.lo, fitted);
  const sized = src.width === r.width ? "" : src.width < r.width ? ` The ${src.width}-bit source is ${extensionWord(src)}-extended to ${r.width} bits (§10.7).` : ` The ${src.width}-bit source is truncated to ${r.width} bits; its upper bits are discarded (§10.7).`;
  return {
    value: next,
    written: bitRange(r.hi, r.lo),
    changed: changedBits(value, next),
    note: `${name} is bits ${rangeText(r)}, so only those bits can change (§7.2.1).${sized}`,
  };
}

export interface WholeAssign {
  value: SvValue;
  /** First bit added by extension (this bit and above), when the source was narrower. */
  extendedFrom?: number;
  /** First bit of the source that was discarded, when the source was wider. */
  droppedFrom?: number;
  note: string;
}

/**
 * Assign an integral value to the whole struct. A packed struct is assignment
 * compatible with every integral type (§6.22.3); a narrower source is
 * zero-extended, or sign-extended when it is signed, a wider one loses its most
 * significant bits, and no warning is required (§10.7).
 */
export function assignWhole(members: readonly PackedMember[], src: SvValue): WholeAssign {
  const width = structBits(members);
  const value = resize(src, width, src.signed, false);
  if (src.width < width) {
    return {
      value,
      extendedFrom: src.width,
      note: `The ${src.width}-bit value is ${extensionWord(src)}-extended to ${width} bits: bits [${width - 1}:${src.width}] are filled with ${src.signed ? "the sign bit" : "0"}. No warning is required (§10.7, §6.22.3).`,
    };
  }
  if (src.width > width) {
    return {
      value,
      droppedFrom: width,
      note: `The ${src.width}-bit value is truncated to ${width} bits: bits [${src.width - 1}:${width}] of the source are discarded. No warning is required (§10.7).`,
    };
  }
  return { value, note: `The ${width}-bit value fills the struct exactly: every member is written at once (§7.2.1).` };
}

/**
 * `'0` assigned to the whole struct: an unsized fill literal sets every bit and
 * takes its size from the assignment context (§5.7.1), so nothing is extended
 * or truncated, whatever the struct's width.
 */
export function fillWhole(members: readonly PackedMember[]): WholeAssign {
  const width = structBits(members);
  return { value: zeroStruct(members), note: `'0 is a fill literal: it takes its size from the assignment, so all ${width} bits become 0 and nothing is extended or truncated (§5.7.1).` };
}

/** A member write to a struct in the shape `'{op: OP_WRITE, addr: 12'h123, data: 16'hBEEF}` (§10.9.2): each named member is written. */
export function assignPattern(members: readonly PackedMember[], fields: Readonly<Record<string, SvValue>>): SvValue {
  let v = zeroStruct(members);
  for (const [name, src] of Object.entries(fields)) v = writeMember(members, v, name, src).value;
  return v;
}

/**
 * How the explorer offers an x write. A logic member takes `c.addr = 'x`. An
 * enum member does not: 'x is no member of the enum and needs a cast to compile
 * (§6.19.3), so the same bits are written as a part-select of the struct, which
 * has no enum check (§7.2.1).
 */
export function xWriteOffer(varName: string, members: readonly PackedMember[], name: string): { label: string; partSelect: boolean } {
  const m = members.find((x) => x.name === name);
  if (m?.type.kind !== "enum") return { label: `Write x into ${name}`, partSelect: false };
  const r = memberRange(members, name);
  return { label: `${varName}${rangeText(r)} = ${r.width}'bx;`, partSelect: true };
}

/**
 * `v` with the named member set to all x. The declared types decide state-ness:
 * a struct with any 4-state member was a 4-state vector before this write
 * (§7.2.1), and assigning x to a 2-state member gives 0 (§6.11.2).
 *
 * An enum member is written through a part-select (`xWriteOffer`), not as the
 * member. So a 2-state enum in a 4-state struct stores the x in the vector, and
 * only a read through the member converts it (derived from §7.2.1, which treats
 * the struct as one 4-state vector and describes conversion for member accesses).
 */
export function writeXInMember(members: readonly PackedMember[], value: SvValue, name: string): MemberWrite & { structStates: 2 | 4 } {
  const r = memberRange(members, name);
  const m = members.find((x) => x.name === name)!;
  if (m.type.kind === "enum" && memberStates(m) === 2 && structStates(members) === 4) {
    const next = splice(value, r.hi, r.lo, allX(r.width));
    return {
      value: next,
      written: bitRange(r.hi, r.lo),
      changed: changedBits(value, next),
      note: `A part-select of bits ${rangeText(r)} writes them as a plain vector, with no enum check, and the struct is a 4-state vector, so the bits hold x; a read through the 2-state member ${name} converts them to 0 (derived from §7.2.1, §6.11.2).`,
      structStates: 4,
    };
  }
  const w = writeMember(members, value, name, allX(r.width));
  const note =
    memberStates(m) === 2
      ? `${name} is a 2-state member: x converts to 0 on the way in (§6.11.2), so it cannot hold x.`
      : `${m.type.kind === "enum" ? `A part-select of bits ${rangeText(r)} writes them as a plain vector, with no enum check (derived from §7.2.1). ` : ""}${name} is a 4-state member, so the struct is a 4-state vector whether or not any bit is x (§7.2.1); read as one vector it now shows x in bits ${rangeText(r)}.`;
  return { ...w, note, structStates: structStates(members) };
}

export interface NibbleInfo {
  /** Hex digit position, 0 = least significant. */
  index: number;
  hi: number;
  lo: number;
  /** Members that own at least one bit of this nibble, most significant first. */
  members: string[];
  /** The hex digit of `value`, when given. */
  digit?: string;
}

/**
 * Which members each hex digit covers. A member can be read straight off the
 * hex only when both its ends fall on a 4-bit boundary; two members sharing a
 * digit is why `kind` and `seq` of the kata header cannot (§7.2.1 layout).
 */
export function nibbleOverlay(members: readonly PackedMember[], value?: SvValue): NibbleInfo[] {
  const ranges = memberRanges(members);
  const width = structBits(members);
  const count = Math.ceil(width / 4);
  const digits = value ? formatH(value) : undefined;
  const out: NibbleInfo[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const lo = i * 4;
    const hi = Math.min(lo + 3, width - 1);
    out.push({
      index: i,
      hi,
      lo,
      members: ranges.filter((r) => r.lo <= hi && r.hi >= lo).map((r) => r.name),
      digit: digits ? digits[count - 1 - i] : undefined,
    });
  }
  return out;
}

/** True when every hex digit that covers the member belongs to it alone, so it reads straight off the hex. */
export const hexAligned = (members: readonly PackedMember[], name: string): boolean =>
  nibbleOverlay(members)
    .filter((n) => n.members.includes(name))
    .every((n) => n.members.length === 1);

export interface RuleCard {
  code: string;
  legal: boolean;
  clause: string;
  message: string;
}

/**
 * What a packed/unpacked toggle changes. A packed struct is a vector: it can
 * be part-selected and compared with a number (§7.2.1). An unpacked struct has
 * an implementation-dependent packing (§7.2.1) and no bit numbering, so
 * neither expression compiles; its members are still read by name.
 *
 * The comparison is written with a known literal, whatever the struct holds:
 * x bits of the struct become 0 in the literal, since a literal full of x says
 * nothing useful. With x or z in an operand the relation can be ambiguous, and
 * then `==` gives 1'bx (§11.4.5), so the card says so while the struct holds them.
 */
export function structVectorCards(name: string, members: readonly PackedMember[], packed: boolean, value: SvValue): RuleCard[] {
  const width = structBits(members);
  const first = memberRanges(members)[0];
  const selectText = `${name}[${first.hi}:${first.lo}]`;
  const compareText = `${name} == ${formatSizedHex(toTwoState(value))}`;
  const ambiguous = isKnown(value) ? "" : ` While ${name} holds x or z bits the relation can be ambiguous, and then == gives 1'bx; === compares x and z exactly (§11.4.5).`;
  if (packed) {
    return [
      { code: selectText, legal: true, clause: "§7.2.1", message: `Legal: a packed struct can be selected as if it were a packed array [${width - 1}:0]; this reads ${first.name}.` },
      { code: compareText, legal: true, clause: "§7.2.1", message: `Legal: as a primary, a packed struct is a single vector, so it compares with an integral value bit for bit (§11.4.5).${ambiguous}` },
    ];
  }
  return [
    { code: selectText, legal: false, clause: "§7.2.1", message: "Compile error: only a packed struct is treated as a single vector with bits [n-1:0]. An unpacked struct's packing is implementation-dependent, normally matching the C compiler (§7.2.1), so it has no bit numbering to select." },
    { code: compareText, legal: false, clause: "§7.2.1, §6.22.3", message: `Compile error: an unpacked struct is not an integral value, so there is nothing to compare with a ${value.width}-bit literal. Compare member by member, or use a packed struct for anything with a bit layout.` },
  ];
}

/** `rand` on a member, written with its declared type: legal only inside an unpacked struct (§7.2, Syntax 7-1, footnote 20). */
export function randMemberCard(packed: boolean, memberName: string, typeText = "logic [3:0]"): RuleCard {
  const code = `rand ${typeText} ${memberName};`;
  return packed
    ? { code, legal: false, clause: "§7.2, Syntax 7-1 footnote 20", message: "Compile error: a random_qualifier is legal only within an unpacked structure. Declare the whole packed struct rand in a class instead." }
    : { code, legal: true, clause: "§7.2, Syntax 7-1 footnote 20", message: "Legal: members of an unpacked struct may be rand or randc." };
}

/**
 * A whole-vector statement such as `c = 32'h5ABC_0042;` or `ctrl = '0;` on an
 * unpacked struct. An unpacked struct is not an integral type and §6.22.3
 * defines no implicit cast from an integral value to it, so the statement
 * does not compile; the legal routes are member writes, an assignment pattern
 * (§10.9.2) or an explicit bit-stream cast (§6.24.3).
 */
export function unpackedWholeAssignCard(typeName: string, code: string): RuleCard {
  return {
    code,
    legal: false,
    clause: "§6.22.3",
    message: `Compile error: an unpacked struct is not an integral type, and there is no implicit cast from an integral value to it (§6.22.3). Write the members by name, use an assignment pattern such as '{default: '0} (§10.9.2), or spell out a bit-stream cast, ${typeName}'(word), with word exactly $bits(${typeName}) bits (§6.24.3).`,
  };
}

export interface EnumReadout {
  value: SvValue;
  name: string;
  isMember: boolean;
  /** Where the back door is written down: §6.19.3 names unions; for a packed struct it is derived from §7.2.1. */
  basis: "§6.19.3" | "derived from §7.2.1";
  /** What the view cites for this result: §6.19.5.6 for name(), plus the back door's basis only when a non-member really came through it. */
  citation: string;
  note: string;
}

/** How the value in an enum member got there, which decides how the readout explains a non-member. */
export type EnumArrival = "never-assigned" | "whole-vector" | "part-select" | "layout-edit" | "member-write";

/**
 * Read an enum member of a packed struct. A vector write is not type-checked
 * against the enum, so the member may hold a value that is not a member and
 * name() returns "" (§6.19.5.6). §6.19.3 states the back door for unions; for a
 * packed struct it follows from §7.2.1 (the struct is one vector) and is
 * labelled derived. A never-assigned member is not a back door at all: it holds
 * its base type's default (Table 6-7).
 */
export function enumMemberReadout(members: readonly PackedMember[], value: SvValue, name: string, via: "struct" | "union" = "struct", arrival: EnumArrival = "whole-vector"): EnumReadout {
  const m = members.find((x) => x.name === name);
  if (!m || m.type.kind !== "enum") throw new Error(`"${name}" is not an enum member`);
  const v = readMember(members, value, name);
  const label = enumName(m.type.spec, v);
  const isMember = label !== "";
  const basis = via === "union" ? "§6.19.3" : "derived from §7.2.1";
  const held = isKnown(v) ? formatSizedHex(v) : `${v.width}'b${formatB(v)}`;
  const causes: Record<Exclude<EnumArrival, "never-assigned">, string> = {
    "whole-vector": `The whole-vector write was not type-checked (${basis}).`,
    "part-select": `The part-select wrote these bits as a plain vector, with no enum check (${basis}).`,
    "layout-edit": `The typedef edit moved ${name} over other bits, and no assignment to the enum put them there (${basis}).`,
    "member-write": `No assignment to the enum itself stored this value (${basis}).`,
  };
  const cause = via === "union" ? `A write through another member of the union was not type-checked (${basis}).` : arrival === "never-assigned" ? "" : causes[arrival];
  return {
    value: v,
    name: label,
    isMember,
    basis,
    citation: isMember ? "§6.19.5.6" : arrival === "never-assigned" ? "Table 6-7, §6.19.5.6" : `${basis}, §6.19.5.6`,
    note: isMember
      ? `${name} holds ${formatSizedHex(v)}, the member ${label}; name() returns "${label}" (§6.19.5.6).`
      : arrival === "never-assigned"
        ? `${name} was never assigned, so it holds its base type's default, ${held} (Table 6-7). That is not a member of ${m.type.spec.name}, so name() returns "" (§6.19.5.6).`
        : `${name} holds ${held}, which is not a member of ${m.type.spec.name}, so name() returns "" (§6.19.5.6). ${cause}`,
  };
}

/** One named read, before and after a write. */
export interface NamedRead {
  name: string;
  before: SvValue;
  after: SvValue;
}

const sameBits = (a: SvValue, b: SvValue): boolean => a.width === b.width && a.aval === b.aval && a.bval === b.bval;

/**
 * What a write changed, short enough for a live region: the reads whose value
 * differs, or the whole value when more than `listed` of them did. An empty
 * string means nothing changed.
 */
export function changedReadsText(reads: readonly NamedRead[], whole: { name: string; value: SvValue }, listed = 3): string {
  const changed = reads.filter((r) => !sameBits(r.before, r.after));
  if (changed.length === 0) return "";
  if (changed.length > listed) return `${whole.name} = ${formatSizedHex(whole.value)}`;
  return changed.map((r) => `${r.name} = ${formatSizedHex(r.after)}`).join(", ");
}

// ---------------------------------------------------------------------------
// Type matching and equivalence (§6.22)
// ---------------------------------------------------------------------------

export interface TypeRef {
  /** Identity of the declaration: two typedef statements are two ids. */
  declId: string;
  display: string;
  packed: boolean;
  bits: number;
  states: 2 | 4;
  signed: boolean;
}

export interface AssignLegality {
  legal: boolean;
  /**
   * "not-assignment-compatible" is deliberately not the standard's "type
   * incompatible": §6.22.5 keeps that for types with no implicit or explicit
   * casting rule, and an unpacked struct has one, the bit-stream cast (§6.24.3).
   */
  relation: "matching" | "equivalent" | "assignment-compatible" | "not-assignment-compatible";
  clause: string;
  message: string;
}

/**
 * Whether `dst = src` compiles. The same typedef matches itself (§6.22.1 d, and
 * §6.22.1 h when it is declared in a package and imported).
 * Packed structs of equal total bits, state-ness and signedness are equivalent
 * even from different typedefs (§6.22.2 c). Any other packed pair is still
 * assignment compatible, because all integral types are (§6.22.3). Two separate
 * typedefs of an unpacked struct do not match (§6.22.1 d) and no rule of §6.22.2
 * makes them equivalent ((c) covers only packed types), so the assignment is a
 * compile error, as is one between a packed and an unpacked struct.
 */
export function assignmentLegality(dst: TypeRef, src: TypeRef): AssignLegality {
  if (dst.declId === src.declId) {
    return { legal: true, relation: "matching", clause: "§6.22.1", message: `${dst.display} and ${src.display} come from the same typedef, so the types match.` };
  }
  if (dst.packed && src.packed && dst.bits === src.bits && dst.states === src.states && dst.signed === src.signed) {
    return {
      legal: true,
      relation: "equivalent",
      clause: "§6.22.2 (c)",
      message: `Different typedefs, but both are packed, ${dst.bits} bits, ${dst.states}-state and ${dst.signed ? "signed" : "unsigned"}, so the types are equivalent and the assignment compiles.`,
    };
  }
  if (dst.packed && src.packed) {
    return {
      legal: true,
      relation: "assignment-compatible",
      clause: "§6.22.3, §10.7",
      message: `${dst.display} and ${src.display} are not equivalent, but both are packed, and all integral types are assignment compatible. The assignment compiles, and the value is extended or truncated with no required warning.`,
    };
  }
  if (dst.packed !== src.packed) {
    return {
      legal: false,
      relation: "not-assignment-compatible",
      clause: "§6.22.3",
      message: `Compile error: only one of ${dst.display} and ${src.display} is packed. An unpacked struct is not an integral type, and there is no implicit cast between it and a packed one.`,
    };
  }
  return {
    legal: false,
    relation: "not-assignment-compatible",
    clause: "§6.22.3; no match under §6.22.1 (d), not equivalent under §6.22.2",
    message: `Compile error: ${dst.display} and ${src.display} are two separate declarations of an unpacked struct. Each typedef matches only itself (§6.22.1 d), and no rule of §6.22.2 makes them equivalent ((c) covers only packed types), so there is no implicit conversion.`,
  };
}

// ---------------------------------------------------------------------------
// Packed untagged unions (§7.3.1)
// ---------------------------------------------------------------------------

export type UnionPacking = "packed" | "soft";

export type UnionMemberShape =
  | { kind: "vector" }
  | { kind: "struct"; typeName: string; members: readonly PackedMember[] }
  | { kind: "lanes"; laneWidth: number; count: number }
  | { kind: "union"; packing: UnionPacking; members: readonly UnionMember[] };

export interface UnionMember {
  id: string;
  name: string;
  /** Width for a vector member; derived for the other shapes. */
  width: number;
  states: 2 | 4;
  shape: UnionMemberShape;
}

export interface UnionType {
  name: string;
  packing: UnionPacking;
  members: readonly UnionMember[];
}

export const unionMemberWidth = (m: UnionMember): number => {
  switch (m.shape.kind) {
    case "vector":
      return m.width;
    case "struct":
      return structBits(m.shape.members);
    case "lanes":
      return m.shape.laneWidth * m.shape.count;
    case "union":
      return unionWidth({ name: m.name, packing: m.shape.packing, members: m.shape.members });
  }
};

export const unionMemberStates = (m: UnionMember): 2 | 4 => {
  switch (m.shape.kind) {
    case "struct":
      return structStates(m.shape.members);
    case "union":
      return unionStates({ name: m.name, packing: m.shape.packing, members: m.shape.members });
    default:
      return m.states;
  }
};

/**
 * The union's width: a hard packed union's common member size, or, for a soft
 * packed union, the widest member (§7.3.1). With unequal hard members the
 * widest is returned so a picture can still be drawn; `unionProblems` reports
 * the error.
 */
export const unionWidth = (u: UnionType): number => Math.max(0, ...u.members.map(unionMemberWidth));

/** A 2-state member plus a 4-state member makes the whole union 4-state (§7.3.1). */
export const unionStates = (u: UnionType): 2 | 4 => (u.members.some((m) => unionMemberStates(m) === 4) ? 4 : 2);

/** A union variable with no initializer: all x when any member is 4-state, else all 0 (Table 6-7, §7.3.1). */
export const unionInitialValue = (u: UnionType): SvValue => defaultVector(unionWidth(u), unionStates(u));

/** Compile errors in the declaration: hard packed members of different sizes (§7.3.1). */
export function unionProblems(u: UnionType): RuleCard[] {
  const problems: RuleCard[] = [];
  if (u.packing === "packed") {
    const widths = u.members.map((m) => ({ name: m.name, width: unionMemberWidth(m) }));
    const distinct = new Set(widths.map((w) => w.width));
    if (distinct.size > 1) {
      problems.push({
        code: `typedef union packed { ... } ${u.name};`,
        legal: false,
        clause: "§7.3.1",
        message: `Compile error: members of a hard packed union shall all be the same size, but ${widths.map((w) => `${w.name} is ${w.width} bits`).join(", ")}. Make the widths equal, or declare the union soft to allow different sizes.`,
      });
    }
  }
  return problems;
}

export interface UnionPiece {
  /** Path such as "f.addr" or "bytes[3]". */
  path: string;
  label: string;
  hi: number;
  lo: number;
  /** A 2-state member, field or lane reads and is written through an implicit conversion (§7.3.1, §7.2.1), which turns x/z into 0 (§6.11.2). */
  states: 2 | 4;
}

export interface UnionRow {
  /** Path of the member this row shows, e.g. "f", "raw", "bytes", "inner.b8". */
  path: string;
  label: string;
  hi: number;
  lo: number;
  width: number;
  states: 2 | 4;
  /** Nesting depth: 0 for a direct member. */
  depth: number;
  /** Packing of the union that directly holds this member: a soft row is right-justified and a write through it leaves the bits above unaffected (§7.3.1). */
  packing: UnionPacking;
  /** The member's shape, so a piece can be told apart as a struct field or an array lane. */
  shape: UnionMemberShape["kind"];
  /** The bits the row is drawn from: one piece for a vector, one per field for a struct, one per lane for a packed array. */
  pieces: UnionPiece[];
  /** Bits of the union above this member, which a write through it leaves unaffected (soft packed, §7.3.1). */
  unaffectedAbove: number[];
}

/**
 * One row per member, flattened. Every member is right-justified at bit 0
 * (§7.3.1; in a hard packed union all members share the full width anyway),
 * and the rule applies recursively to a nested soft union, so its members sit
 * at bit 0 too. A struct member's fields and a packed array's lanes are the
 * row's pieces. `[3:0][7:0]` has element 3 at the top: derived from the range,
 * as the §7.3.1 example shows, where u1.byte_slice[51] is u1.bit_slice[415:408].
 */
export function unionRows(u: UnionType): UnionRow[] {
  const width = unionWidth(u);
  const rows: UnionRow[] = [];
  const visit = (members: readonly UnionMember[], prefix: string, depth: number, packing: UnionPacking) => {
    for (const m of members) {
      const w = unionMemberWidth(m);
      const path = prefix ? `${prefix}.${m.name}` : m.name;
      const hi = w - 1;
      const states = unionMemberStates(m);
      let pieces: UnionPiece[];
      switch (m.shape.kind) {
        case "vector":
          pieces = [{ path, label: m.name, hi, lo: 0, states }];
          break;
        case "struct": {
          const fields = m.shape.members;
          pieces = memberRanges(fields).map((r, i) => ({ path: `${path}.${r.name}`, label: r.name, hi: r.hi, lo: r.lo, states: memberStates(fields[i]) }));
          break;
        }
        case "lanes": {
          const { laneWidth, count } = m.shape;
          pieces = [];
          for (let k = count - 1; k >= 0; k -= 1) pieces.push({ path: `${path}[${k}]`, label: `${m.name}[${k}]`, hi: k * laneWidth + laneWidth - 1, lo: k * laneWidth, states });
          break;
        }
        case "union":
          pieces = [{ path, label: m.name, hi, lo: 0, states }];
          break;
      }
      rows.push({ path, label: path, hi, lo: 0, width: w, states, depth, packing, shape: m.shape.kind, pieces, unaffectedAbove: w < width ? bitRange(width - 1, w) : [] });
      if (m.shape.kind === "union") visit(m.shape.members, path, depth + 1, m.shape.packing);
    }
  };
  visit(u.members, "", 0, u.packing);
  return rows;
}

/** The bit range a path names: a member, a struct field of a member, or a lane. */
export function unionPathRange(u: UnionType, path: string): { hi: number; lo: number } {
  for (const row of unionRows(u)) {
    if (row.path === path) return { hi: row.hi, lo: row.lo };
    const piece = row.pieces.find((p) => p.path === path);
    if (piece) return { hi: piece.hi, lo: piece.lo };
  }
  throw new Error(`no union member "${path}"`);
}

/** Whether a member path is 2-state or 4-state in its own declared type. */
export function unionPathStates(u: UnionType, path: string): 2 | 4 {
  for (const row of unionRows(u)) {
    if (row.path === path) return row.states;
    const piece = row.pieces.find((p) => p.path === path);
    if (piece) return piece.states;
  }
  throw new Error(`no union member "${path}"`);
}

/**
 * Read through any member path: the bits that path names. A 2-state member of a
 * union that also has a 4-state member is read through a conversion to 2-state
 * (§7.3.1), which turns x/z into 0 (§6.11.2).
 */
export function readUnionPath(u: UnionType, value: SvValue, path: string): SvValue {
  const r = unionPathRange(u, path);
  const raw = slice(value, r.hi, r.lo);
  return unionPathStates(u, path) === 2 ? toTwoState(raw) : raw;
}

export interface UnionWrite {
  value: SvValue;
  written: number[];
  changed: number[];
  /** Bits above the written member that keep their value (§7.3.1, soft packed). */
  unaffected: number[];
  note: string;
  /**
   * The note to show while a later prediction about where narrower members sit
   * is still open: it says what this write names and nothing about other rows.
   */
  openNote: string;
}

/** "a", "a and b", "a, b and c". */
const andList = (items: readonly string[]): string => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/**
 * Write through one member path. The source is resized to the path's width
 * (§10.7) and placed in its bits; every other row reads the new bits at once,
 * because all members name the same storage (§7.3.1). Assigning to a 2-state
 * member turns x/z in the source into 0 (§6.11.2) before it is stored in the
 * 4-state union (§7.3.1).
 *
 * A soft packed member is sized and right-justified on its own (§7.3.1), so "every
 * other member reads the same bits" holds only when every row has this row's
 * width, and a part-select's "every view" only when every row contains its bits;
 * otherwise the note names the narrower rows.
 *
 * Only a member of a soft packed union is right-justified with the bits above
 * it unaffected (§7.3.1, last paragraph), so that wording, and the
 * `unaffected` set the view highlights, are emitted only for a direct member
 * row of a soft union narrower than the union. A struct field (§7.2.1) or an
 * array lane (§7.4.5) of any member is a part-select write: it touches its own
 * bits and nothing else, and `unaffected` is empty.
 */
export function writeUnionPath(u: UnionType, value: SvValue, path: string, src: SvValue): UnionWrite {
  const r = unionPathRange(u, path);
  const next = splice(value, r.hi, r.lo, unionPathStates(u, path) === 2 ? toTwoState(src) : src);
  const width = unionWidth(u);
  const w = r.hi - r.lo + 1;
  const sized = src.width === w ? "" : src.width < w ? ` The ${src.width}-bit source is ${extensionWord(src)}-extended to ${w} bits (§10.7).` : ` The ${src.width}-bit source is truncated to ${w} bits (§10.7).`;
  const rows = unionRows(u);
  const row = rows.find((x) => x.path === path);
  let unaffected: number[] = [];
  let note: string;
  if (row) {
    if (row.packing === "soft" && row.unaffectedAbove.length > 0) {
      unaffected = [...row.unaffectedAbove];
      note = `${path} is right-justified in bits ${rangeText(r)}; bits [${width - 1}:${r.hi + 1}] are unaffected by the write (§7.3.1).${sized}`;
    } else {
      const narrower = rows.filter((x) => x.path !== path && x.width < w).map((x) => x.path);
      const one = narrower.length === 1;
      const reach = rows.every((x) => x.width === w)
        ? "; every other member reads the same bits (§7.3.1)"
        : narrower.length > 0
          ? `; ${andList(narrower)} ${one ? "is" : "are"} narrower and read${one ? "s" : ""} only ${one ? "its" : "their"} own low bits (§7.3.1)`
          : "";
      note = `${path} names bits ${rangeText(r)}${reach}.${sized}`;
    }
  } else {
    const owner = rows.find((x) => x.pieces.some((p) => p.path === path))!;
    const clause = owner.shape === "lanes" ? "§7.4.5" : "§7.2.1";
    const short = rows.filter((x) => x.hi < r.hi).map((x) => `${x.path} ${rangeText(x)}`);
    const one = short.length === 1;
    const reach = short.length === 0 ? "every view reads the same bits" : `${andList(short)} ${one ? "is" : "are"} narrower and ${one ? "does" : "do"} not read all of those bits`;
    note = `${path} is bits ${rangeText(r)} of ${owner.path}, so only those bits change (${clause}); ${reach} (§7.3.1).${sized}`;
  }
  const openNote = w === width ? `${path} names bits ${rangeText(r)}.${sized}` : `${path} is written.${sized}`;
  return { value: next, written: bitRange(r.hi, r.lo), changed: changedBits(value, next), unaffected, note, openNote };
}

/**
 * `%p` of an untagged union under the first-declared-member reading of
 * §21.2.1.6. The standard states that rule in its paragraph on aggregates and
 * its rules for singular values name only packed structures, so for a packed
 * union, a singular integral value, the output is tool-dependent; callers
 * label it so.
 */
export function formatUnionP(u: UnionType, value: SvValue): { text: string; member: string } {
  const first = u.members[0];
  const v = readUnionPath(u, value, first.name);
  if (first.shape.kind === "struct") {
    const inner = first.shape.members
      .map((m) => {
        const mv = readMember(first.shape.kind === "struct" ? first.shape.members : [], v, m.name);
        return `${m.name}:${m.type.kind === "enum" ? enumName(m.type.spec, mv) || formatD(mv) : formatD(mv)}`;
      })
      .join(", ");
    return { text: `'{${first.name}:'{${inner}}}`, member: first.name };
  }
  return { text: `'{${first.name}:${formatD(v)}}`, member: first.name };
}

/** The declaration text of a union. */
export function unionTypedef(u: UnionType): string {
  const lines = u.members.map((m) => {
    const w = unionMemberWidth(m);
    switch (m.shape.kind) {
      case "vector":
        return `  logic [${w - 1}:0] ${m.name};`;
      case "struct":
        return `  ${m.shape.typeName} ${m.name};  // packed struct, ${w} bits`;
      case "lanes":
        return `  logic [${m.shape.count - 1}:0][${m.shape.laneWidth - 1}:0] ${m.name};`;
      case "union":
        return `  union ${m.shape.packing === "soft" ? "soft" : "packed"} { ... } ${m.name};  // ${w} bits`;
    }
  });
  return [`typedef union ${u.packing === "soft" ? "soft" : "packed"} {`, ...lines, `} ${u.name};  // ${unionProblems(u).length > 0 ? "does not compile" : `${unionWidth(u)} bits, ${unionStates(u)}-state`}`].join("\n");
}

// ---------------------------------------------------------------------------
// Tagged unions (§7.3.2, §11.9)
// ---------------------------------------------------------------------------

export interface TaggedMember {
  name: string;
  /** Member width in bits, or null for a void member. */
  width: number | null;
  /** How the member type is written. */
  typeText: string;
  /** Whether the member's type is signed, so a read prints the right number: int is, bit [7:0] is not (§6.11, Table 6-8). False for a void member. */
  signed: boolean;
}

export interface TaggedUnionType {
  name: string;
  members: readonly TaggedMember[];
}

/** An undefined (never assigned) tagged union value has an undefined tag (§11.9). */
export interface TaggedValue {
  tagIndex: number | null;
  value: SvValue | null;
}

export const UNDEFINED_TAGGED: TaggedValue = { tagIndex: null, value: null };

/** Tag width: the minimum number of bits that codes every member name, e.g. 5 to 8 members need 3 (§7.3.2). */
export const tagWidth = (memberCount: number): number => (memberCount <= 1 ? 0 : Math.ceil(Math.log2(memberCount)));

export interface TaggedLayout {
  width: number;
  tagBits: number;
  tagHi: number;
  tagLo: number;
  members: { name: string; hi: number | null; lo: number | null; code: number }[];
}

/**
 * Packed tagged layout (§7.3.2): width = tag bits + widest member; the tag is
 * left-justified; each member right-justified; the bits between undefined; a
 * void member has only the tag. §7.3.2 fixes only the tag's width and position.
 * `code` numbers members in declaration order from 0, which matches Figures 7-2
 * and 7-3 for their two-member unions; past that it is our own extension.
 */
export function taggedPackedLayout(t: TaggedUnionType): TaggedLayout {
  const tagBits = tagWidth(t.members.length);
  const widest = Math.max(0, ...t.members.map((m) => m.width ?? 0));
  const width = tagBits + widest;
  return {
    width,
    tagBits,
    tagHi: width - 1,
    tagLo: width - tagBits,
    members: t.members.map((m, i) => ({ name: m.name, hi: m.width === null ? null : m.width - 1, lo: m.width === null ? null : 0, code: i })),
  };
}

/** `v = tagged Member (value)`: tag and value change together (§7.3.2), in the member's own signedness; a number wraps to its width (§10.7). A void member takes no value. */
export function makeTagged(t: TaggedUnionType, memberName: string, value?: SvValue | number): TaggedValue {
  const idx = t.members.findIndex((m) => m.name === memberName);
  if (idx < 0) throw new Error(`no tagged member "${memberName}"`);
  const m = t.members[idx];
  if (m.width === null) return { tagIndex: idx, value: null };
  if (value === undefined) throw new Error(`member ${memberName} needs a value`);
  const v = typeof value === "number" ? fromBigInt(big(value), m.width, m.signed) : resize(value, m.width, value.signed, m.signed);
  return { tagIndex: idx, value: v };
}

export type TaggedRead = { ok: true; value: SvValue; note: string } | { ok: false; error: string };

/**
 * `v.Member`: legal only when the tag is that member; otherwise a run-time
 * error (§11.9). A void member yields no value. An uninitialized variable's tag
 * bits are undefined (§11.9); that whether the check fires is therefore not
 * defined is derived from this, not stated there.
 */
export function readTagged(t: TaggedUnionType, v: TaggedValue, memberName: string): TaggedRead {
  const idx = t.members.findIndex((m) => m.name === memberName);
  if (idx < 0) return { ok: false, error: `Compile error: ${t.name} has no member ${memberName}.` };
  if (v.tagIndex === null) return { ok: false, error: `Undefined: the variable was never assigned, so its tag bits are undefined (§11.9). Derived from that, whether the check fires is not defined, and the read has no defined result. Assign a tagged expression first.` };
  const current = t.members[v.tagIndex];
  if (v.tagIndex !== idx) return { ok: false, error: `Run-time error: the tag is ${current.name}, so reading .${memberName} is inconsistent with the tag (§11.9).` };
  if (current.width === null || !v.value) return { ok: true, value: fromBigInt(ZERO, 0), note: `${memberName} is a void member: the tag carries the whole message and there is no value to read (§7.3.2).` };
  return { ok: true, value: v.value, note: `The tag is ${memberName}, so the read is consistent with it and returns ${formatD(v.value)} (§11.9).` };
}

export interface TaggedPackedPicture {
  bits: Bit4[];
  undefinedBits: number[];
  segments: { hi: number; lo: number; label: string }[];
  note: string;
}

/** The bits of `v` under the packed layout: tag at the top, the member at bit 0, undefined bits between (§7.3.2). */
export function taggedPackedBits(t: TaggedUnionType, v: TaggedValue): TaggedPackedPicture {
  const layout = taggedPackedLayout(t);
  let vec = fromBigInt(ZERO, layout.width);
  const undefinedBits: number[] = [];
  const segments: { hi: number; lo: number; label: string }[] = [];
  if (layout.tagBits > 0) segments.push({ hi: layout.tagHi, lo: layout.tagLo, label: "tag" });
  if (v.tagIndex === null) {
    for (let i = layout.width - 1; i >= 0; i -= 1) undefinedBits.push(i);
    return { bits: bitsOf(vec), undefinedBits, segments, note: "Never assigned: every bit, the tag included, is undefined (§11.9)." };
  }
  if (layout.tagBits > 0) vec = splice(vec, layout.tagHi, layout.tagLo, fromBigInt(big(v.tagIndex), layout.tagBits));
  const m = layout.members[v.tagIndex];
  const memberName = t.members[v.tagIndex].name;
  if (m.hi === null || m.lo === null || !v.value) {
    if (layout.tagLo > 0) undefinedBits.push(...bitRange(layout.tagLo - 1, 0));
    return { bits: bitsOf(vec), undefinedBits, segments, note: `${memberName} is void: only the tag is significant and all remaining bits are undefined (§7.3.2).` };
  }
  vec = splice(vec, m.hi, m.lo, v.value);
  segments.push({ hi: m.hi, lo: m.lo, label: memberName });
  if (layout.tagLo - 1 > m.hi) undefinedBits.push(...bitRange(layout.tagLo - 1, m.hi + 1));
  const between = layout.tagLo - 1 - m.hi;
  return {
    bits: bitsOf(vec),
    undefinedBits,
    segments,
    note: `Tag ${rangeText({ hi: layout.tagHi, lo: layout.tagLo })} = ${v.tagIndex} (${memberName}): the code follows the numbering of Figures 7-2 and 7-3${v.tagIndex >= 2 ? `, and code ${v.tagIndex} for a third member is our own extension of it` : ""}. ${memberName} is right-justified in ${rangeText({ hi: m.hi, lo: m.lo })}${between > 0 ? `; the ${between} bit${between === 1 ? "" : "s"} between are undefined` : ""} (§7.3.2).`,
  };
}

/**
 * `%p` of a tagged union: tag:value for the valid member; white space is
 * implementation dependent (§21.2.1.6). Null when no output is defined, because a
 * never-assigned variable is undefined, its tag bits included (§11.9).
 */
export function formatTaggedP(t: TaggedUnionType, v: TaggedValue): string | null {
  if (v.tagIndex === null) return null;
  const m = t.members[v.tagIndex];
  return m.width === null || !v.value ? `${m.name}` : `${m.name}:${formatD(v.value)}`;
}

export interface TaggedPReading {
  /** The printed text, or null when no output is defined. */
  text: string | null;
  /** "stated": §21.2.1.6 says it. "derived": our inference from the cited rules. "tool-dependent": a reading that tools can implement differently. */
  basis: "stated" | "derived" | "tool-dependent";
  /** Shown beside the output. */
  citation: string;
  /** One sentence for the status line. */
  sentence: string;
}

/**
 * What `$display("%p", v)` can honestly be said to print. An unpacked tagged union
 * is the case §21.2.1.6 states. A packed one is a singular integral value (§6.4,
 * §6.11.1), and the tag:value sentence sits in the paragraph on aggregates, so
 * there it is a reading. A void member has no value (§7.3.2) and §21.2.1.6 is silent
 * on what stands for it, so the bare tag is derived. A never-assigned variable
 * has no defined output, which is itself derived from §11.9.
 */
export function taggedPReading(t: TaggedUnionType, v: TaggedValue, packed: boolean): TaggedPReading {
  const text = formatTaggedP(t, v);
  if (text === null) {
    return {
      text,
      basis: "derived",
      citation: "derived from §11.9",
      sentence: "%p output is not defined: the variable was never assigned, so its value, tag bits included, is undefined (derived from §11.9).",
    };
  }
  const isVoid = v.tagIndex !== null && t.members[v.tagIndex].width === null;
  const basis: TaggedPReading["basis"] = packed ? "tool-dependent" : isVoid ? "derived" : "stated";
  const citation = packed
    ? "a reading of §21.2.1.6 that tools can implement differently"
    : isVoid
      ? "derived: §21.2.1.6 gives tag:value, and a void member has no value, §7.3.2"
      : "tag:value, §21.2.1.6";
  return { text, basis, citation, sentence: `%p prints ${text} (${citation}).` };
}

/** The declaration text. */
export const taggedTypedef = (t: TaggedUnionType, packed = false): string =>
  [`typedef union tagged${packed ? " packed" : ""} {`, ...t.members.map((m) => `  ${m.typeText.padEnd(5)} ${m.name};`), `} ${t.name};`].join("\n");

// ---------------------------------------------------------------------------
// Mutation board: the lesson's tb_top, run against three mutations
// ---------------------------------------------------------------------------

export const OPCODE_E: EnumSpec = {
  name: "opcode_e",
  baseDecl: "logic [3:0]",
  states: 4,
  width: 4,
  members: [
    { name: "OP_NOP", value: 0x0 },
    { name: "OP_READ", value: 0x1 },
    { name: "OP_WRITE", value: 0x2 },
    { name: "OP_IRQ", value: 0xf },
  ],
};

/** The lesson's cmd_t with the enum opcode. */
export const CMD_T_ENUM: readonly PackedMember[] = [
  { id: "op", name: "op", width: 4, type: { kind: "enum", spec: OPCODE_E } },
  { id: "addr", name: "addr", width: 12, type: { kind: "logic" } },
  { id: "data", name: "data", width: 16, type: { kind: "logic" } },
];

export interface TbConfig {
  cmd: readonly PackedMember[];
  opcode: EnumSpec;
}

export const BASE_TB: TbConfig = { cmd: CMD_T_ENUM, opcode: OPCODE_E };

export type MutationId = "reverse-addr-data" | "bit-base" | "op-sync";

export interface MutationSpec {
  id: MutationId;
  label: string;
  /** The edit to tb_top, as the lesson phrases it. */
  description: string;
  /** The declaration lines before and after. */
  before: string;
  after: string;
}

export const MUTATIONS: readonly MutationSpec[] = [
  {
    id: "reverse-addr-data",
    label: "Reverse addr and data",
    description: "Swap the order of addr and data in cmd_t (lesson step 3).",
    before: "  logic [11:0] addr;  // [27:16]\n  logic [15:0] data;  // [15:0]",
    after: "  logic [15:0] data;  // [27:12]\n  logic [11:0] addr;  // [11:0]",
  },
  {
    id: "bit-base",
    label: "opcode_e base to bit [3:0]",
    description: "Change the base type of opcode_e from logic [3:0] to bit [3:0] (lesson step 4).",
    before: "typedef enum logic [3:0] {",
    after: "typedef enum bit [3:0] {",
  },
  {
    id: "op-sync",
    label: "Append OP_SYNC = 4'h3",
    description: "Add a fifth opcode, OP_SYNC = 4'h3, at the end of the list (lesson step 5).",
    before: "  OP_IRQ   = 4'hF\n} opcode_e;",
    after: "  OP_IRQ   = 4'hF,\n  OP_SYNC  = 4'h3\n} opcode_e;",
  },
];

/** The tb_top with one mutation applied (or none). */
export function mutate(cfg: TbConfig, id: MutationId | null): TbConfig {
  switch (id) {
    case null:
      return cfg;
    case "reverse-addr-data": {
      const cmd = reorderMembers(cfg.cmd, ["op", "data", "addr"]);
      return { ...cfg, cmd };
    }
    case "bit-base": {
      const opcode: EnumSpec = { ...cfg.opcode, baseDecl: "bit [3:0]", states: 2 };
      return { cmd: cfg.cmd.map((m) => (m.type.kind === "enum" ? { ...m, type: { kind: "enum", spec: opcode } } : m)), opcode };
    }
    case "op-sync": {
      const opcode: EnumSpec = { ...cfg.opcode, members: [...cfg.opcode.members, { name: "OP_SYNC", value: 0x3 }] };
      return { cmd: cfg.cmd.map((m) => (m.type.kind === "enum" ? { ...m, type: { kind: "enum", spec: opcode } } : m)), opcode };
    }
  }
}

export interface TbCheckSpec {
  /** Stable id without ":" (MutationMatrix row id). */
  id: string;
  /** The name passed to check(), as in the lesson. */
  label: string;
}

/** The eleven named self-checks of the lesson's tb_top, in program order. */
export const TB_CHECKS: readonly TbCheckSpec[] = [
  { id: "layout", label: "layout" },
  { id: "bits", label: "$bits" },
  { id: "addr-write", label: "addr write" },
  { id: "op-field", label: "op field" },
  { id: "addr-field", label: "addr field" },
  { id: "byte-3", label: "byte 3" },
  { id: "num", label: "num()" },
  { id: "wrap", label: "wrap" },
  { id: "no-name", label: "no name" },
  { id: "cast-accepts-2", label: "$cast accepts 2" },
  { id: "cast-rejects-7", label: "$cast rejects 7" },
];

export interface TbCheckResult extends TbCheckSpec {
  ok: boolean;
  /** The expression as the lesson writes it. */
  expr: string;
  /** What the left-hand side evaluated to. */
  actual: string;
}

export interface TbRun {
  log: string[];
  checks: TbCheckResult[];
  pass: number;
  fail: number;
}

/**
 * Run the lesson's tb_top (structs-unions-enums.mdx, Make It Work) on a
 * configuration. Every line is computed by the model functions above, so a
 * mutation changes exactly the lines the standard says it changes.
 */
export function runTbTop(cfg: TbConfig): TbRun {
  const { cmd, opcode } = cfg;
  const log: string[] = [];
  const checks: TbCheckResult[] = [];
  let pass = 0;
  let fail = 0;
  const check = (id: string, ok: boolean, expr: string, actual: string) => {
    const spec = TB_CHECKS.find((c) => c.id === id)!;
    checks.push({ ...spec, ok, expr, actual });
    if (ok) pass += 1;
    else {
      fail += 1;
      log.push(`FAIL: ${spec.label}`);
    }
  };
  const same = (a: SvValue, b: SvValue) => a.aval === b.aval && a.bval === b.bval && a.width === b.width;
  const member = (name: string) => svDec(opcode.width, opcode.members.find((m) => m.name === name)!.value);

  // Union cmd_u: f (cmd_t), raw, bytes.
  const cmdU: UnionType = {
    name: "cmd_u",
    packing: "packed",
    members: [
      { id: "f", name: "f", width: 32, states: 4, shape: { kind: "struct", typeName: "cmd_t", members: cmd } },
      { id: "raw", name: "raw", width: 32, states: 4, shape: { kind: "vector" } },
      { id: "bytes", name: "bytes", width: 32, states: 4, shape: { kind: "lanes", laneWidth: 8, count: 4 } },
    ],
  };

  // 1. Build a command by member name, then use it as one vector.
  let c = assignPattern(cmd, { op: member("OP_WRITE"), addr: svHex(12, "123"), data: svHex(16, "BEEF") });
  log.push(`c = ${formatH(c)}, $bits(cmd_t) = ${structBits(cmd)}`);
  check("layout", same(c, svHex(32, "2123_BEEF")), "c === 32'h2123_BEEF", `c = ${formatSizedHex(c)}`);
  check("bits", structBits(cmd) === 32, "$bits(cmd_t) == 32", `$bits(cmd_t) = ${structBits(cmd)}`);

  // 2. Write one member: only bits [27:16] change.
  c = writeMember(cmd, c, "addr", svHex(12, "0FF")).value;
  check("addr-write", same(c, svHex(32, "20FF_BEEF")), "c === 32'h20FF_BEEF", `c = ${formatSizedHex(c)}`);

  // 3. Decode a raw bus word through the union.
  let u = fromBigInt(ZERO, 32);
  u = writeUnionPath(cmdU, u, "raw", svHex(32, "1ABC_0042")).value;
  let op = readMember(cmd, readUnionPath(cmdU, u, "f"), "op");
  const fAddr = readMember(cmd, readUnionPath(cmdU, u, "f"), "addr");
  const byte3 = readUnionPath(cmdU, u, "bytes[3]");
  log.push(`op = ${enumName(opcode, op)}, addr = ${formatH(fAddr)}, bytes[3] = ${formatH(byte3)}`);
  check("op-field", same(op, member("OP_READ")), "op === OP_READ", `op = ${enumName(opcode, op) || formatSizedHex(op)}`);
  check("addr-field", same(fAddr, svHex(12, "ABC")), "u.f.addr === 12'hABC", `u.f.addr = ${formatSizedHex(fAddr)}`);
  check("byte-3", same(byte3, svHex(8, "1A")), "u.bytes[3] === 8'h1A", `u.bytes[3] = ${formatSizedHex(byte3)}`);

  // 4. An unpacked record: %p prints member names, the enum by name, other integral values in decimal (§21.2.1.6).
  const recCmd = cmd
    .map((m) => {
      const v = readMember(cmd, c, m.name);
      return `${m.name}:${m.type.kind === "enum" ? enumName(m.type.spec, v) || formatD(v) : formatD(v)}`;
    })
    .join(", ");
  log.push(`rec = '{cmd:'{${recCmd}}, tag:"first write", beat:0}`);

  // 5. Visit every member in declaration order.
  let names = "";
  let n = 0;
  let cur = enumFirst(opcode);
  for (;;) {
    names += ` ${enumName(opcode, cur)}`;
    n += 1;
    if (same(cur, enumLast(opcode))) break;
    cur = enumNext(opcode, cur);
  }
  log.push(`members:${names} (num() = ${enumNum(opcode)})`);
  check("num", n === enumNum(opcode), "n == op.num()", `n = ${n}, num() = ${enumNum(opcode)}`);

  // 6. next() wraps; a value that is not a member has no name.
  op = member("OP_IRQ");
  const wrapped = enumNext(opcode, op);
  check("wrap", same(wrapped, member("OP_NOP")), "op.next() === OP_NOP", `op.next() = ${enumName(opcode, wrapped) || formatSizedHex(wrapped)}`);
  const neverSet = enumInitialValue(opcode);
  log.push(`never_set = ${formatB(neverSet)}, name() = "${enumName(opcode, neverSet)}"`);
  check("no-name", enumName(opcode, neverSet) === "", 'never_set.name() == ""', `never_set.name() = "${enumName(opcode, neverSet)}"`);

  // 7. Integers into the enum: a static cast never checks, $cast does.
  op = enumCast(opcode, op, 7, "static").after;
  log.push(`static cast: op = ${formatD(op)}, name() = "${enumName(opcode, op)}"`);
  const cast2 = enumCast(opcode, op, 2, "dynamic");
  op = cast2.after;
  check("cast-accepts-2", cast2.castReturn === 1 && same(op, member("OP_WRITE")), "cast_ok == 1 && op === OP_WRITE", `cast_ok = ${cast2.castReturn}, op = ${enumName(opcode, op) || formatSizedHex(op)}`);
  const cast7 = enumCast(opcode, op, 7, "dynamic");
  op = cast7.after;
  check("cast-rejects-7", cast7.castReturn === 0 && same(op, member("OP_WRITE")), "cast_ok == 0 && op === OP_WRITE", `cast_ok = ${cast7.castReturn}, op = ${enumName(opcode, op) || formatSizedHex(op)}`);

  log.push(`PASS=${pass} FAIL=${fail}`);
  return { log, checks, pass, fail };
}

export type MutationCellState = "caught" | "survived";

export interface MutationBoardCell {
  state: MutationCellState;
  summary: string;
}

/**
 * The board: for every check (row) and mutation (column), whether the check
 * fails with the mutation in place (caught) or still passes (survived). Keys
 * are `${checkId}:${mutationId}`, the MutationMatrix convention.
 */
export function mutationBoard(base: TbConfig = BASE_TB): { cells: Record<string, MutationBoardCell>; runs: Record<MutationId, TbRun>; baseline: TbRun } {
  const baseline = runTbTop(base);
  const runs = {} as Record<MutationId, TbRun>;
  const cells: Record<string, MutationBoardCell> = {};
  for (const m of MUTATIONS) {
    const run = runTbTop(mutate(base, m.id));
    runs[m.id] = run;
    for (const check of run.checks) {
      cells[`${check.id}:${m.id}`] = { state: check.ok ? "survived" : "caught", summary: check.actual };
    }
  }
  return { cells, runs, baseline };
}

/** The ids of the checks that fail under a mutation. */
export const failingChecks = (run: TbRun): string[] => run.checks.filter((c) => !c.ok).map((c) => c.id);

export interface LogDiff {
  index: number;
  before: string | undefined;
  after: string | undefined;
}

/** The $display lines a mutation changed, by position (FAIL lines shift the rest, so compare by content order). */
export function changedLogLines(baseline: TbRun, mutant: TbRun): LogDiff[] {
  const before = baseline.log.filter((l) => !l.startsWith("FAIL:"));
  const after = mutant.log.filter((l) => !l.startsWith("FAIL:"));
  const out: LogDiff[] = [];
  const n = Math.max(before.length, after.length);
  for (let i = 0; i < n; i += 1) if (before[i] !== after[i]) out.push({ index: i, before: before[i], after: after[i] });
  return out;
}

/**
 * The lesson's own claims (structs-unions-enums.mdx, "How to work through it",
 * steps 3 to 5): reversing addr and data breaks layout, addr write and addr
 * field; the bit base breaks only "no name"; OP_SYNC breaks only "wrap". A
 * test pins `runTbTop` against this table; a disagreement is reported to the
 * integrator, never patched here.
 */
export const LESSON_EXPECTED_FAILURES: Readonly<Record<MutationId, readonly string[]>> = {
  "reverse-addr-data": ["layout", "addr-write", "addr-field"],
  "bit-base": ["no-name"],
  "op-sync": ["wrap"],
};

// ---------------------------------------------------------------------------
// Convenience: values from bits
// ---------------------------------------------------------------------------

/** Re-export for callers that build values bit by bit (most significant first). */
export const valueFromBits = (bits: Bit4[]): SvValue => fromBits(bits);
