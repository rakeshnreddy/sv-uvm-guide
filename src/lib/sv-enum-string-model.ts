/**
 * Small deterministic model of SystemVerilog enum declarations, enum methods
 * and string methods, checked against IEEE 1800-2023 §6.16, §6.19 and §6.24.2.
 *
 * Assumptions: the method model takes the encodings in declaration order
 * (consecutive 0..n-1 unless `values` is given) and does not step through an
 * x or z encoding; strings hold ASCII characters only. Declaration values are
 * cast with plain double arithmetic, exact for base types up to 52 bits wide
 * (see castEnumLiteral); the presets use bases of at most 32 bits.
 */

/* ------------------------------------------------------------------ */
/* Enumerations (§6.19)                                                */
/* ------------------------------------------------------------------ */

/** An enum value: a number, or "x" for an all-x pattern of a 4-state base type. */
export type EnumValue = number | "x";

export interface EnumTypeModel {
  name: string;
  /** Base type text as written in the declaration; "" means the default int. */
  baseDecl: string;
  /** 4-state bases start at x; 2-state bases (including the default int) start at 0 (Table 6-7). */
  states: 2 | 4;
  members: string[];
  /**
   * Encoding of each member, in declaration order. Omitted means 0..n-1, the
   * values an all-implicit declaration gets (§6.19).
   */
  values?: readonly number[];
}

/** The members' encodings in declaration order (0..n-1 when `values` is omitted). */
export const enumValues = (t: EnumTypeModel): readonly number[] => t.values ?? t.members.map((_, i) => i);

/** Position of the member whose encoding is `v` in declaration order, or -1 when `v` is not a member. */
export const enumMemberIndex = (t: EnumTypeModel, v: EnumValue): number => (typeof v === "number" ? enumValues(t).indexOf(v) : -1);

export const enumDeclaration = (t: EnumTypeModel) => {
  const items = t.values ? t.members.map((m, i) => `${m} = ${t.values![i]}`) : t.members;
  return `typedef enum ${t.baseDecl ? `${t.baseDecl} ` : ""}{ ${items.join(", ")} } ${t.name};`;
};

/** Default initial value of an enum variable: the base type's default (Table 6-7). */
export const enumDefault = (t: EnumTypeModel): EnumValue => (t.states === 4 ? "x" : 0);

export const isMember = (t: EnumTypeModel, v: EnumValue) => enumMemberIndex(t, v) >= 0;

export const formatEnumValue = (t: EnumTypeModel, v: EnumValue) => {
  if (v === "x") return "'x";
  const idx = enumMemberIndex(t, v);
  return idx >= 0 ? `${t.members[idx]} (${v})` : `${v} (not a member)`;
};

export type EnumMethod = "first" | "last" | "next" | "prev" | "num" | "name";

export interface EnumMethodResult {
  /** Text of the call, e.g. `s.next(2)`. */
  call: string;
  /** Returned value: an enum value, a count (num) or a string (name). */
  returns: { kind: "enum"; value: EnumValue } | { kind: "int"; value: number } | { kind: "string"; value: string };
  why: string;
}

/**
 * first/last return the first/last member (§6.19.5.1–2). next(N)/prev(N)
 * step N members in declaration order with wrap-around, whatever the gaps
 * between the encodings; on a value that is not a member they return the
 * enum's default initial value (§6.19.5.3–4, Table 6-7). num returns the
 * member count (§6.19.5.5). name returns the member name, or "" for a value
 * that is not a member (§6.19.5.6).
 */
export function callEnumMethod(t: EnumTypeModel, current: EnumValue, method: EnumMethod, n = 1): EnumMethodResult {
  const values = enumValues(t);
  const count = t.members.length;
  const idx = enumMemberIndex(t, current);
  const member = idx >= 0;
  switch (method) {
    case "first":
      return { call: "s.first()", returns: { kind: "enum", value: values[0] }, why: "first() returns the first member, whatever s holds (§6.19.5.1)." };
    case "last":
      return { call: "s.last()", returns: { kind: "enum", value: values[count - 1] }, why: "last() returns the last member, whatever s holds (§6.19.5.2)." };
    case "num":
      return { call: "s.num()", returns: { kind: "int", value: count }, why: `num() returns how many members the enum has: ${count} (§6.19.5.5).` };
    case "name":
      return member
        ? { call: "s.name()", returns: { kind: "string", value: t.members[idx] }, why: "name() returns the member's name as a string (§6.19.5.6)." }
        : {
            call: "s.name()",
            returns: { kind: "string", value: "" },
            why: "s does not hold a member, so name() returns the empty string. A log that prints an empty state name is a clue (§6.19.5.6).",
          };
    case "next":
    case "prev": {
      const call = `s.${method}(${n === 1 ? "" : n})`;
      const sub = method === "next" ? 3 : 4;
      if (!member) {
        const def = enumDefault(t);
        return {
          call,
          returns: { kind: "enum", value: def },
          why: `s is not a member, so ${method}() returns the enum's default initial value, ${formatEnumValue(t, def)}, not a neighbour (§6.19.5.${sub}, Table 6-7).`,
        };
      }
      const step = method === "next" ? n : -n;
      const target = (((idx + step) % count) + count) % count;
      const wrapped = method === "next" ? idx + n >= count : idx - n < 0;
      const from = values[idx];
      const to = values[target];
      // Only an enum with explicit, non-consecutive encodings can jump over values: say so.
      const jump =
        !wrapped && t.values && to - from !== step
          ? ` The value goes from ${from} to ${to}: ${method}() follows declaration order, not the value ${method === "next" ? "plus" : "minus"} ${n === 1 ? "one" : n}.`
          : "";
      return {
        call,
        returns: { kind: "enum", value: to },
        why: `${method}(${n}) moves ${n} member${n === 1 ? "" : "s"} ${method === "next" ? "forward" : "back"}${wrapped ? ", wrapping around the end of the list" : ""} (§6.19.5.${sub}). It returns a value; s itself only changes if you assign it.${jump}`,
      };
    }
  }
}

export type EnumAssignForm = "plain" | "static-cast" | "dynamic-cast" | "dynamic-cast-task";

/** What a statement that puts an integer into an enum variable does. */
export type EnumAssignOutcome = "compile-error" | "assigned" | "assigned-ok-1" | "unchanged-ok-0" | "runtime-error";

export interface EnumAssignResult {
  code: string;
  compiles: boolean;
  /** Value s holds afterwards (unchanged on a failed $cast). */
  after: EnumValue;
  /** Return value of $cast, when used as a function. */
  castReturn?: 0 | 1;
  /** True when $cast, called as a task, fails: a run-time error (§6.24.2). */
  runtimeError?: boolean;
  outcome: EnumAssignOutcome;
  why: string;
}

export interface EnumAssignOptions {
  /** Name of the enum variable in the code text; default "s". */
  varName?: string;
  /** Source expression as written (e.g. "raw"); default the number itself. */
  sourceText?: string;
}

/**
 * Putting an integer into an enum variable:
 * - without a cast it is illegal (§6.19.3, §6.19.4);
 * - a static cast converts to the base type without checking membership (§6.19.4);
 * - $cast as a function returns 1 and assigns, or returns 0 and leaves the
 *   target unchanged, and never issues an error (§6.24.2);
 * - $cast as a task assigns, or on an invalid value causes a run-time error and
 *   leaves the target unchanged (§6.24.2).
 * The model takes `value` to fit the base type; a static cast of a wider value
 * would first truncate it to the base type (§6.19.4), which is not modelled.
 */
export function assignIntToEnum(t: EnumTypeModel, before: EnumValue, value: number, form: EnumAssignForm, opts: EnumAssignOptions = {}): EnumAssignResult {
  const v = opts.varName ?? "s";
  const src = opts.sourceText ?? String(value);
  const valid = isMember(t, value);
  const name = valid ? t.members[enumMemberIndex(t, value)] : "";
  if (form === "plain") {
    return {
      code: `${v} = ${src};`,
      compiles: false,
      after: before,
      outcome: "compile-error",
      why: "Compile error: an int is not an enum. Enums are strongly typed, so assigning an int needs a cast (§6.19.3, §6.19.4).",
    };
  }
  if (form === "static-cast") {
    return {
      code: `${v} = ${t.name}'(${src});`,
      compiles: true,
      after: value,
      outcome: "assigned",
      why: valid
        ? `The static cast converts ${value} to ${t.name}; it is a member, so ${v} is ${name} (§6.19.4).`
        : `A static cast always succeeds and does not check the range, so ${v} now holds ${value}, which is not a member (§6.19.4).`,
    };
  }
  if (form === "dynamic-cast") {
    return {
      code: `ok = $cast(${v}, ${src});`,
      compiles: true,
      after: valid ? value : before,
      castReturn: valid ? 1 : 0,
      outcome: valid ? "assigned-ok-1" : "unchanged-ok-0",
      why: valid
        ? `$cast checks the value, finds a member, assigns it and returns 1 (§6.24.2).`
        : `$cast checks the value, finds no member, leaves ${v} unchanged and returns 0 (§6.24.2). Test the return value.`,
    };
  }
  return {
    code: `$cast(${v}, ${src});`,
    compiles: true,
    after: valid ? value : before,
    runtimeError: !valid,
    outcome: valid ? "assigned" : "runtime-error",
    why: valid
      ? `$cast called as a task checks the value, finds a member and assigns it (§6.24.2).`
      : `$cast called as a task finds no member: a run-time error occurs and ${v} is left unchanged (§6.24.2). The compiler does no type checking for the task form (§6.24.2), so the failure shows only at run time.`,
  };
}

export interface PackedFieldWriteResult {
  code: string;
  after: EnumValue;
  outcome: EnumAssignOutcome;
  /** The rule is derived from §7.2.1 and §6.19.3, not stated for structs in one clause. */
  derived: true;
  why: string;
}

/**
 * The back door: a packed struct with an enum member, written as one vector.
 * Derived from §7.2.1 (a packed struct is one vector, and the whole struct is
 * written) and §6.19.3 (the type check applies to an assignment to the enum
 * variable; §6.19.3 itself names the union case). The bits arrive unchecked.
 */
export function writeEnumThroughPackedStruct(t: EnumTypeModel, value: number, opts: { structVar?: string; field?: string; sourceText?: string } = {}): PackedFieldWriteResult {
  const c = opts.structVar ?? "c";
  const f = opts.field ?? "op";
  const valid = isMember(t, value);
  return {
    code: `${c} = ${opts.sourceText ?? "vif.bus"};`,
    after: value,
    outcome: "assigned",
    derived: true,
    why: `The struct is written as one vector, so ${c}.${f} takes the bits that arrive with no enum check: ${c}.${f} holds ${formatEnumValue(t, value)}${valid ? "" : `, and ${c}.${f}.name() returns ""`} (derived from §7.2.1 and §6.19.3).`,
  };
}

export const ENUM_ASSIGN_OUTCOMES: readonly EnumAssignOutcome[] = ["compile-error", "assigned", "assigned-ok-1", "unchanged-ok-0", "runtime-error"];

/** Learner-facing label of an outcome, with the variable names of the drill. */
export function enumAssignOutcomeLabel(outcome: EnumAssignOutcome, varName = "s", source = "raw"): string {
  switch (outcome) {
    case "compile-error":
      return "Compile error";
    case "assigned":
      return `${varName} takes the value of ${source}`;
    case "assigned-ok-1":
      return `ok = 1, ${varName} takes the value of ${source}`;
    case "unchanged-ok-0":
      return `ok = 0, ${varName} unchanged`;
    case "runtime-error":
      return `Run-time error, ${varName} unchanged`;
  }
}

/* ------------------------------------------------------------------ */
/* Enum declarations: how the values are assigned (§6.19, §6.19.2)      */
/* ------------------------------------------------------------------ */

export interface EnumBase {
  /** As written: "" for the default int, or e.g. "bit [1:0]". */
  decl: string;
  /** Spoken name for sentences, e.g. "int (the default)". */
  label: string;
  width: number;
  signed: boolean;
  states: 2 | 4;
}

/** The default base type is int (§6.19): 32 bits, signed, 2-state (§6.11, Table 6-8). */
export const DEFAULT_ENUM_BASE: EnumBase = { decl: "", label: "int (the default)", width: 32, signed: true, states: 2 };

/** A packed-vector base type (unsigned unless declared signed; logic is 4-state, bit is 2-state). */
export const vectorBase = (kind: "bit" | "logic", width: number): EnumBase => ({
  decl: `${kind} [${width - 1}:0]`,
  label: `${kind} [${width - 1}:0]`,
  width,
  signed: false,
  states: kind === "logic" ? 4 : 2,
});

/** A value written after `=` in an enum declaration. */
export type EnumLiteral =
  | { kind: "unsized"; value: number }
  | { kind: "sized"; width: number; value: number; radix?: "h" | "d" | "b" }
  | { kind: "xz"; bit: "x" | "z"; width?: number };

export interface EnumNameDecl {
  name: string;
  /** name[N] (count) or name[N:M] (from..to) (§6.19.2, Table 6-10). */
  range?: { count: number } | { from: number; to: number };
  value?: EnumLiteral;
}

export interface EnumDeclarationSpec {
  base: EnumBase;
  names: readonly EnumNameDecl[];
}

export const literalText = (l: EnumLiteral): string => {
  if (l.kind === "unsized") return String(l.value);
  if (l.kind === "xz") return `${l.width ?? ""}'${l.width ? "b" : ""}${l.bit}`;
  const radix = l.radix ?? "h";
  const digits = radix === "h" ? l.value.toString(16).toUpperCase() : radix === "b" ? l.value.toString(2).padStart(l.width, "0") : String(l.value);
  return `${l.width}'${radix}${digits}`;
};

const nameDeclText = (d: EnumNameDecl): string => {
  const range = d.range ? ("count" in d.range ? `[${d.range.count}]` : `[${d.range.from}:${d.range.to}]`) : "";
  return `${d.name}${range}${d.value ? ` = ${literalText(d.value)}` : ""}`;
};

/** The declaration as written, e.g. `enum bit [1:0] {S0, S1}`. */
export const enumSpecText = (spec: EnumDeclarationSpec): string =>
  `enum ${spec.base.decl ? `${spec.base.decl} ` : ""}{${spec.names.map(nameDeclText).join(", ")}}`;

export type EnumDeclIssueKind =
  | "duplicate-name"
  | "duplicate-value"
  | "out-of-range"
  | "sized-width"
  | "xz-2state"
  | "unassigned-after-xz"
  | "increment-overflow"
  | "range-bounds";

export interface EnumDeclIssue {
  kind: EnumDeclIssueKind;
  /** The generated name the error is reported on. */
  member: string;
  /** Earlier member involved (the other name with the same value or name). */
  other?: string;
  clause: string;
  message: string;
}

export interface ResolvedEnumMember {
  name: string;
  /** Index of the declaration item it came from. */
  item: number;
  /** The encoding; null when an error leaves the name without one. */
  value: number | "x" | "z" | null;
  /** How the value was decided, with its clause. */
  rule: string;
  /** True when an issue names this member. */
  inError: boolean;
}

export interface ResolvedEnum {
  spec: EnumDeclarationSpec;
  text: string;
  members: ResolvedEnumMember[];
  issues: EnumDeclIssue[];
  ok: boolean;
  /** Largest and smallest values the base type can represent. */
  min: number;
  max: number;
  /** Things the model does not decide, said instead of guessed. */
  notes: string[];
}

const xzText = (b: "x" | "z") => `'${b}`;

export interface EnumCastResult {
  /** The value after the cast to the base type, as the base type reads it. */
  value: number;
  /** True when the cast truncates and a discarded bit is nonzero (unsigned base) or differs from the sign bit (signed base). */
  outOfRange: boolean;
  /** Set when the literal's own width is a tool choice the model had to assume. */
  assumedWidth?: string;
}

/**
 * Evaluates an enum value expression "in the context of a cast to the enum
 * base type" (§6.19). An unsized decimal is a signed 32-bit integer; a sized
 * literal is unsigned and its value is first truncated to its own width.
 * When the cast truncates, the value is out of range if any discarded bit is
 * nonzero (unsigned base) or not equal to the sign bit of the result (signed
 * base). When it widens, a signed expression is sign-extended. The value after
 * the cast is the one used for the name, uniqueness and incrementing (§6.19).
 * Limit: plain double arithmetic, exact for widths up to 52 bits.
 */
export function castEnumLiteral(l: { kind: "unsized"; value: number } | { kind: "sized"; width: number; value: number }, base: EnumBase): EnumCastResult {
  const bw = base.width;
  let ew: number;
  let signedExpr: boolean;
  let assumedWidth: string | undefined;
  if (l.kind === "unsized") {
    signedExpr = true;
    ew = 32;
    if (l.value < -(2 ** 31) || l.value > 2 ** 31 - 1) {
      // An unsized decimal wider than 32 bits: the standard requires at least 32 bits, so the width beyond that is the tool's.
      ew = Math.min(52, Math.ceil(Math.log2(Math.abs(l.value) + 1)) + 1);
      assumedWidth = `${l.value} does not fit in a signed 32-bit integer. An unsized number has at least 32 bits and its exact width is up to the tool; this model assumes ${ew} bits.`;
    }
  } else {
    signedExpr = false;
    ew = l.width;
  }
  const mod = 2 ** ew;
  let pattern = ((l.value % mod) + mod) % mod;
  let outOfRange = false;
  if (ew > bw) {
    const kept = pattern % 2 ** bw;
    const discarded = Math.floor(pattern / 2 ** bw);
    if (base.signed) {
      const sign = kept >= 2 ** (bw - 1);
      outOfRange = discarded !== (sign ? 2 ** (ew - bw) - 1 : 0);
    } else outOfRange = discarded !== 0;
    pattern = kept;
  } else if (signedExpr && pattern >= 2 ** (ew - 1)) {
    pattern += 2 ** bw - 2 ** ew;
  }
  const value = base.signed && pattern >= 2 ** (bw - 1) ? pattern - 2 ** bw : pattern;
  return assumedWidth ? { value, outOfRange, assumedWidth } : { value, outOfRange };
}

/** Generated names of one declaration item (§6.19.2, Table 6-10), or an issue when the bounds are illegal. */
function expandNames(d: EnumNameDecl): { names: string[]; issue?: string } {
  if (!d.range) return { names: [d.name] };
  if ("count" in d.range) {
    const n = d.range.count;
    if (!Number.isInteger(n) || n <= 0) return { names: [], issue: `${d.name}[${n}]: N shall be a positive integral number (§6.19.2, Table 6-10).` };
    return { names: Array.from({ length: n }, (_, i) => `${d.name}${i}`) };
  }
  const { from, to } = d.range;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0)
    return { names: [], issue: `${d.name}[${from}:${to}]: N and M shall be non-negative integral numbers (§6.19.2, Table 6-10).` };
  const dir = to >= from ? 1 : -1;
  return { names: Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => `${d.name}${from + dir * i}`) };
}

/**
 * Resolves the values of an enum declaration and reports the errors of §6.19:
 * - an unassigned first name is 0; a later unassigned name is the previous value + 1;
 * - automatically incrementing the maximum representable value is an error;
 * - names and values shall be unique, set explicitly or by incrementing;
 * - each value is evaluated as a cast to the base type, and a cast that drops
 *   bits other than zeros (unsigned base) or sign copies (signed base) is an
 *   out-of-range error; the value after the cast is the one used for the name,
 *   the uniqueness check and the next increment (see castEnumLiteral);
 * - a sized literal whose size differs from the base type is an error;
 * - x or z with the default or a 2-state base is a (syntax) error;
 * - an unassigned name after a name with an x or z value is a (syntax) error;
 * and the name[N] / name[N:M] ranges of §6.19.2 (Table 6-10).
 */
export function resolveEnumDeclaration(spec: EnumDeclarationSpec): ResolvedEnum {
  const { base } = spec;
  const min = base.signed ? -(2 ** (base.width - 1)) : 0;
  const max = base.signed ? 2 ** (base.width - 1) - 1 : 2 ** base.width - 1;
  const baseText = base.decl || "int";
  const members: ResolvedEnumMember[] = [];
  const issues: EnumDeclIssue[] = [];
  const notes: string[] = [];
  const flag = (issue: EnumDeclIssue) => {
    issues.push(issue);
    // The error is on the later name (§6.19: "Error in c declaration"); only a
    // duplicate name or value makes both names part of the error.
    const both = issue.kind === "duplicate-value" || issue.kind === "duplicate-name";
    for (const m of members) if (m.name === issue.member || (both && m.name === issue.other)) m.inError = true;
  };

  spec.names.forEach((d, item) => {
    const { names, issue } = expandNames(d);
    if (issue) {
      issues.push({ kind: "range-bounds", member: d.name, clause: "§6.19.2, Table 6-10", message: issue });
      return;
    }
    names.forEach((name, k) => {
      const prev = members[members.length - 1];
      let value: ResolvedEnumMember["value"];
      let rule: string;
      const pending: EnumDeclIssue[] = [];
      const explicit = k === 0 ? d.value : undefined;
      const inRange = d.range ? `generated by ${nameDeclText({ name: d.name, range: d.range })} (§6.19.2, Table 6-10)` : "";

      if (explicit) {
        if (explicit.kind === "xz") {
          value = explicit.bit;
          rule = `set to ${literalText(explicit)} (§6.19)${inRange ? `, ${inRange}` : ""}`;
          if (base.states === 2)
            pending.push({
              kind: "xz-2state",
              member: name,
              clause: "§6.19",
              message: `${name} = ${literalText(explicit)} is an error: x or z needs a 4-state base, and ${baseText} is 2-state (§6.19 calls it a syntax error).`,
            });
        } else {
          // The value expression is evaluated as a cast to the base type, and the
          // value after the cast is the one used for the name (§6.19).
          const cast = castEnumLiteral(explicit, base);
          value = cast.value;
          const castText = cast.value !== explicit.value ? `, which the cast to ${baseText} makes ${cast.value}` : "";
          rule = `set to ${literalText(explicit)}${castText} (§6.19)${inRange ? `, the first name ${inRange}` : ""}`;
          if (cast.assumedWidth) notes.push(cast.assumedWidth);
          if (cast.outOfRange)
            pending.push({
              kind: "out-of-range",
              member: name,
              clause: "§6.19",
              message: `${name} = ${literalText(explicit)} is an error: ${baseText} holds ${min} to ${max}, and the cast to it drops bits that are ${base.signed ? "not copies of the sign bit" : "not zero"}, so the value is outside the base type's range (§6.19). The value after the cast, ${cast.value}, is the one used for the next name and the uniqueness check.`,
            });
        }
        if (explicit.kind !== "unsized" && explicit.width !== undefined && explicit.width !== base.width)
          pending.push({
            kind: "sized-width",
            member: name,
            clause: "§6.19",
            message: `${name} = ${literalText(explicit)} is an error: the literal is ${explicit.width} bits and ${baseText} is ${base.width}. A sized literal must have the base type's size, even when the value fits (§6.19).`,
          });
      } else if (!prev) {
        value = 0;
        rule = inRange ? `the first name of the enum, no value: 0 (§6.19), ${inRange}` : "the first name, with no value: 0 (§6.19)";
      } else if (prev.value === "x" || prev.value === "z") {
        value = null;
        rule = `no value: it follows ${prev.name} = ${xzText(prev.value)} (§6.19)`;
        pending.push({
          kind: "unassigned-after-xz",
          member: name,
          other: prev.name,
          clause: "§6.19",
          message: `${name} is an error: an unassigned name cannot follow ${prev.name}, which has an x or z value (§6.19 calls it a syntax error).`,
        });
      } else if (prev.value === null) {
        value = null;
        rule = `no value: ${prev.name} has none to add one to (§6.19); the error is reported on an earlier name`;
      } else if (prev.value >= max) {
        value = null;
        rule = `no value: ${prev.name} = ${prev.value} is the largest value ${baseText} holds (§6.19)`;
        pending.push({
          kind: "increment-overflow",
          member: name,
          other: prev.name,
          clause: "§6.19",
          message: `${name} is an error: it would be ${prev.name} + 1 = ${prev.value + 1}, but ${prev.value} is the largest value ${baseText} holds, and it is an error to automatically increment the maximum representable value (§6.19).`,
        });
      } else {
        value = prev.value + 1;
        rule = `${prev.name} + 1 = ${value} (§6.19)${inRange ? `, ${inRange}` : ""}`;
      }

      const sameName = members.find((m) => m.name === name);
      if (sameName)
        pending.push({ kind: "duplicate-name", member: name, other: sameName.name, clause: "§6.19", message: `${name} is declared twice: enum names shall be unique (§6.19).` });
      if (typeof value === "number") {
        const sameValue = members.find((m) => m.value === value);
        if (sameValue)
          pending.push({
            kind: "duplicate-value",
            member: name,
            other: sameValue.name,
            clause: "§6.19",
            message: `${sameValue.name} and ${name} are both ${value}: values shall be unique, whether set explicitly or by incrementing (§6.19).`,
          });
      }
      members.push({ name, item, value, rule, inError: false });
      pending.forEach(flag);
    });
  });

  if (members.filter((m) => m.value === "x" || m.value === "z").length > 1)
    notes.push("More than one name has an x or z value. §6.19 states the uniqueness rule for integer values; this model does not decide whether two x or z encodings collide.");

  return { spec, text: enumSpecText(spec), members, issues, ok: issues.length === 0, min, max, notes };
}

/** The method model of a valid declaration with only numeric values; null otherwise. */
export function enumTypeFromDeclaration(r: ResolvedEnum, name: string): EnumTypeModel | null {
  if (!r.ok || r.members.some((m) => typeof m.value !== "number")) return null;
  return { name, baseDecl: r.spec.base.decl, states: r.spec.base.states, members: r.members.map((m) => m.name), values: r.members.map((m) => m.value as number) };
}

export interface NumberLineSlot {
  kind: "value" | "gap";
  /** For a value slot, the value; for a gap, the first value of the run. */
  from: number;
  to: number;
  /** Members encoded at this value, in declaration order. */
  members: string[];
}

export interface EnumNumberLine {
  slots: NumberLineSlot[];
  /** Members with an x or z value, or none, drawn beside the line. */
  offLine: ResolvedEnumMember[];
}

/**
 * The resolved values on a number line from the smallest to the largest
 * numeric value: every value gets a slot, runs of more than `maxGap` values
 * with no member collapse into one gap slot.
 */
export function enumNumberLine(r: ResolvedEnum, maxGap = 3): EnumNumberLine {
  const numeric = r.members.filter((m): m is ResolvedEnumMember & { value: number } => typeof m.value === "number");
  const offLine = r.members.filter((m) => typeof m.value !== "number");
  if (numeric.length === 0) return { slots: [], offLine };
  const lo = Math.min(...numeric.map((m) => m.value));
  const hi = Math.max(...numeric.map((m) => m.value));
  const slots: NumberLineSlot[] = [];
  let v = lo;
  while (v <= hi) {
    const at = numeric.filter((m) => m.value === v).map((m) => m.name);
    if (at.length) {
      slots.push({ kind: "value", from: v, to: v, members: at });
      v += 1;
      continue;
    }
    let end = v;
    while (end + 1 <= hi && !numeric.some((m) => m.value === end + 1)) end += 1;
    if (end - v + 1 > maxGap) slots.push({ kind: "gap", from: v, to: end, members: [] });
    else for (let g = v; g <= end; g += 1) slots.push({ kind: "gap", from: g, to: g, members: [] });
    v = end + 1;
  }
  return { slots, offLine };
}

/** A learner's prediction for a declaration. */
export interface EnumDeclPrediction {
  compiles: boolean;
  /** Predicted value per generated name: a number, "x", or null for no answer. */
  values: Record<string, number | "x" | "z" | null>;
}

export interface EnumDeclGrade {
  correct: boolean;
  perMember: { name: string; predicted: number | "x" | "z" | null; actual: ResolvedEnumMember["value"]; match: boolean }[];
  feedback: string;
}

const valueText = (v: number | "x" | "z" | null) => (v === null ? "no value" : typeof v === "number" ? String(v) : xzText(v));

/** Grades a declaration prediction against the model, with the reason. */
export function gradeEnumDeclPrediction(r: ResolvedEnum, p: EnumDeclPrediction): EnumDeclGrade {
  const perMember = r.members.map((m) => {
    const predicted = p.values[m.name] ?? null;
    return { name: m.name, predicted, actual: m.value, match: predicted === m.value };
  });
  if (!r.ok) {
    const why = r.issues.map((i) => i.message).join(" ");
    return { correct: !p.compiles, perMember, feedback: p.compiles ? `Not quite: it does not compile. ${why}` : `Correct: it does not compile. ${why}` };
  }
  if (!p.compiles) {
    return { correct: false, perMember, feedback: `Not quite: it compiles. Every name gets a unique value that fits ${r.spec.base.decl || "int"}: ${r.members.map((m) => `${m.name} = ${valueText(m.value)}`).join(", ")}.` };
  }
  const wrong = perMember.filter((m) => !m.match);
  if (wrong.length === 0) return { correct: true, perMember, feedback: `Correct: ${r.members.map((m) => `${m.name} = ${valueText(m.value)}`).join(", ")}.` };
  return {
    correct: false,
    perMember,
    feedback: `Not quite: ${wrong.map((w) => `${w.name} is ${valueText(w.actual)}, not ${valueText(w.predicted)}`).join("; ")}. ${wrong
      .map((w) => `${w.name}: ${r.members.find((m) => m.name === w.name)!.rule}.`)
      .join(" ")}`,
  };
}

/** Candidate values for a prediction picker, from the declaration text only (never from the answer). */
export function enumPredictionChoices(spec: EnumDeclarationSpec): number[] {
  const explicit = spec.names.flatMap((d) => (d.value && d.value.kind !== "xz" ? [d.value.value] : []));
  const total = spec.names.reduce((n, d) => n + (d.range ? ("count" in d.range ? Math.max(d.range.count, 0) : Math.abs(d.range.to - d.range.from) + 1) : 1), 0);
  const hi = Math.max(0, ...explicit) + total + 1;
  return Array.from({ length: hi + 1 }, (_, i) => i);
}

/* Presets: the declarations of the lesson's "How the values are assigned" section. */

export type EnumDeclPresetId = "implicit" | "sparse" | "ranges" | "duplicate" | "overflow" | "sized" | "xz";

export interface EnumDeclPreset {
  id: EnumDeclPresetId;
  label: string;
  spec: EnumDeclarationSpec;
}

export const ENUM_DECL_PRESETS: readonly EnumDeclPreset[] = [
  { id: "implicit", label: "{IDLE, RUN, DONE}", spec: { base: DEFAULT_ENUM_BASE, names: [{ name: "IDLE" }, { name: "RUN" }, { name: "DONE" }] } },
  {
    id: "sparse",
    label: "{A = 3, B, C = 7, D}",
    spec: { base: DEFAULT_ENUM_BASE, names: [{ name: "A", value: { kind: "unsized", value: 3 } }, { name: "B" }, { name: "C", value: { kind: "unsized", value: 7 } }, { name: "D" }] },
  },
  {
    id: "ranges",
    label: "{add = 10, sub[3], jmp[6:8]}",
    spec: { base: DEFAULT_ENUM_BASE, names: [{ name: "add", value: { kind: "unsized", value: 10 } }, { name: "sub", range: { count: 3 } }, { name: "jmp", range: { from: 6, to: 8 } }] },
  },
  {
    id: "duplicate",
    label: "{A = 0, B = 7, C, D = 8}",
    spec: {
      base: DEFAULT_ENUM_BASE,
      names: [{ name: "A", value: { kind: "unsized", value: 0 } }, { name: "B", value: { kind: "unsized", value: 7 } }, { name: "C" }, { name: "D", value: { kind: "unsized", value: 8 } }],
    },
  },
  { id: "overflow", label: "bit [1:0], five names", spec: { base: vectorBase("bit", 2), names: ["S0", "S1", "S2", "S3", "S4"].map((name) => ({ name })) } },
  { id: "sized", label: "bit [3:0] {LOW = 3'h1}", spec: { base: vectorBase("bit", 4), names: [{ name: "LOW", value: { kind: "sized", width: 3, value: 1 } }] } },
  { id: "xz", label: "logic [1:0] {OK, BAD = 'x}", spec: { base: vectorBase("logic", 2), names: [{ name: "OK" }, { name: "BAD", value: { kind: "xz", bit: "x" } }] } },
];

export const enumDeclPreset = (id?: string): EnumDeclPreset => ENUM_DECL_PRESETS.find((p) => p.id === id) ?? ENUM_DECL_PRESETS[1];

/** The opcode enum of the lesson's "Putting a number into an enum" section. */
export const OPCODE_DECL: EnumDeclarationSpec = {
  base: vectorBase("logic", 4),
  names: [
    { name: "OP_NOP", value: { kind: "sized", width: 4, value: 0x0 } },
    { name: "OP_READ", value: { kind: "sized", width: 4, value: 0x1 } },
    { name: "OP_WRITE", value: { kind: "sized", width: 4, value: 0x2 } },
    { name: "OP_IRQ", value: { kind: "sized", width: 4, value: 0xf } },
  ],
};

/* ------------------------------------------------------------------ */
/* Strings (§6.16)                                                     */
/* ------------------------------------------------------------------ */

export type StringMethod = "len" | "toupper" | "tolower" | "getc" | "putc" | "substr";

export interface StringMethodResult {
  call: string;
  /** What the call returns, formatted as SystemVerilog would show it. */
  returns?: string;
  /** The string after the call (only putc modifies it). */
  after: string;
  why: string;
}

const quote = (s: string) => `"${s}"`;

/**
 * len (§6.16.1), putc (§6.16.2: out-of-range index or a zero character leaves
 * the string unchanged), getc (§6.16.3: out of range returns 0),
 * toupper/tolower (§6.16.4–5: s is unchanged), substr (§6.16.8: i through j
 * inclusive; "" when i < 0, j < i or j >= len).
 */
export function callStringMethod(s: string, method: StringMethod, args: { i?: number; j?: number; c?: string } = {}): StringMethodResult {
  const i = args.i ?? 0;
  const j = args.j ?? 0;
  switch (method) {
    case "len":
      return { call: "s.len()", returns: String(s.length), after: s, why: `len() counts the characters: ${s.length}${s.length === 0 ? ' ("" has length 0)' : ""} (§6.16.1).` };
    case "toupper":
      return { call: "s.toupper()", returns: quote(s.toUpperCase()), after: s, why: "toupper() returns a new string; s itself is unchanged (§6.16.4)." };
    case "tolower":
      return { call: "s.tolower()", returns: quote(s.toLowerCase()), after: s, why: "tolower() returns a new string; s itself is unchanged (§6.16.5)." };
    case "getc": {
      if (i < 0 || i >= s.length) {
        return { call: `s.getc(${i})`, returns: "0", after: s, why: `Index ${i} is outside 0 to ${s.length - 1}, so getc returns 0. No error is raised (§6.16.3).` };
      }
      const code = s.charCodeAt(i);
      return { call: `s.getc(${i})`, returns: `${code} ('${s[i]}')`, after: s, why: `getc(${i}) returns the ASCII code of character ${i} (§6.16.3).` };
    }
    case "putc": {
      const c = args.c ?? "X";
      const code = c.length > 0 ? c.charCodeAt(0) : 0;
      const call = `s.putc(${i}, ${code === 0 ? "8'd0" : `"${c[0]}"`})`;
      if (i < 0 || i >= s.length) {
        return { call, after: s, why: `Index ${i} is outside 0 to ${s.length - 1}, so putc leaves s unchanged. It never grows the string and raises no error (§6.16.2).` };
      }
      if (code === 0) return { call, after: s, why: "putc ignores a zero character: s is unchanged (§6.16.2)." };
      const after = s.slice(0, i) + c[0] + s.slice(i + 1);
      return { call, after, why: `putc replaces character ${i} in place; the length stays ${s.length} (§6.16.2).` };
    }
    case "substr": {
      if (i < 0 || j < i || j >= s.length) {
        return {
          call: `s.substr(${i}, ${j})`,
          returns: '""',
          after: s,
          why: `substr returns "" when i < 0, j < i or j >= len(); here len() is ${s.length} (§6.16.8).`,
        };
      }
      return { call: `s.substr(${i}, ${j})`, returns: quote(s.slice(i, j + 1)), after: s, why: `substr(${i}, ${j}) returns characters ${i} through ${j}, both included (§6.16.8).` };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Drill text generated from the model                                 */
/* ------------------------------------------------------------------ */

export interface ModelOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface NextStepQuestion {
  /** The member s holds before the call. */
  start: number;
  question: string;
  options: ModelOption[];
}

/**
 * A next() prediction for a method model: s starts at the member just before
 * the first gap in the encodings (or at the last member when there is none,
 * so the call wraps). The answers come from callEnumMethod (§6.19.5.3).
 */
export function nextStepQuestion(t: EnumTypeModel): NextStepQuestion {
  const values = enumValues(t);
  let i = values.findIndex((v, k) => k < values.length - 1 && Math.abs(values[k + 1] - v) > 1);
  if (i < 0) i = values.length - 1;
  const from = values[i];
  const r = callEnumMethod(t, from, "next");
  const to = r.returns.kind === "enum" ? r.returns.value : from;
  const options: ModelOption[] = [
    { id: "order", label: formatEnumValue(t, to), correct: true, feedback: r.why },
  ];
  if (!isMember(t, from + 1))
    options.push({
      id: "plus-one",
      label: `${from + 1}, the value plus one`,
      correct: false,
      feedback: `${from + 1} is not a member. next() returns the next member in declaration order, not the value plus one (§6.19.5.3).`,
    });
  // With one member the wrap lands on the same member, so "stays" would name the right answer.
  if (i === values.length - 1 && values.length > 1)
    options.push({
      id: "stays",
      label: `${t.members[i]} again: next() stops at the last member`,
      correct: false,
      feedback: "next() does not stop at the end: a wrap to the start of the enumeration occurs when the end is reached (§6.19.5.3).",
    });
  options.push({
    id: "error",
    label: "A run-time error",
    correct: false,
    feedback: "next() raises no error. Even on a value that is not a member it returns the default initial value (§6.19.5.3, Table 6-7).",
  });
  return { start: from, question: `s holds ${formatEnumValue(t, from)}. What does s.next() return?`, options };
}

/** One line saying what a statement left behind, for the cast drill. */
export function enumAssignResultText(t: EnumTypeModel, r: { outcome: EnumAssignOutcome; after: EnumValue }, before: EnumValue, varName = "s"): string {
  const name = callEnumMethod(t, r.after, "name").returns;
  const nameNote = name.kind === "string" && name.value === "" ? `; ${varName}.name() is ""` : "";
  switch (r.outcome) {
    case "compile-error":
      return "Does not compile, so nothing runs.";
    case "assigned":
      return `${varName} = ${formatEnumValue(t, r.after)}${nameNote}.`;
    case "assigned-ok-1":
      return `ok = 1 and ${varName} = ${formatEnumValue(t, r.after)}.`;
    case "unchanged-ok-0":
      return `ok = 0 and ${varName} stays ${formatEnumValue(t, before)}.`;
    case "runtime-error":
      return `Run-time error; ${varName} stays ${formatEnumValue(t, before)}.`;
  }
}

/** The base type in words, e.g. "bit [1:0]: 2 bits, unsigned, 2-state, holds 0 to 3". */
export const enumBaseText = (r: ResolvedEnum): string => {
  const b = r.spec.base;
  return `${b.decl || "int (the default)"}: ${b.width} ${b.width === 1 ? "bit" : "bits"}, ${b.signed ? "signed" : "unsigned"}, ${b.states}-state, holds ${r.min} to ${r.max}`;
};
