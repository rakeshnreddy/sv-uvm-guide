/**
 * Small deterministic model of SystemVerilog enum methods and string
 * methods, checked against IEEE 1800-2023 §6.16 and §6.19.
 *
 * Assumptions: enum members have consecutive implicit values starting at 0;
 * strings hold ASCII characters only.
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
}

export const enumDeclaration = (t: EnumTypeModel) => `typedef enum ${t.baseDecl ? `${t.baseDecl} ` : ""}{ ${t.members.join(", ")} } ${t.name};`;

/** Default initial value of an enum variable: the base type's default (Table 6-7). */
export const enumDefault = (t: EnumTypeModel): EnumValue => (t.states === 4 ? "x" : 0);

export const isMember = (t: EnumTypeModel, v: EnumValue) => typeof v === "number" && v >= 0 && v < t.members.length;

export const formatEnumValue = (t: EnumTypeModel, v: EnumValue) =>
  v === "x" ? "'x" : isMember(t, v) ? `${t.members[v]} (${v})` : `${v} (not a member)`;

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
 * step N members with wrap-around; on a value that is not a member they return
 * the enum's default initial value (§6.19.5.3–4). num returns the member
 * count (§6.19.5.5). name returns the member name, or "" for a value that is
 * not a member (§6.19.5.6).
 */
export function callEnumMethod(t: EnumTypeModel, current: EnumValue, method: EnumMethod, n = 1): EnumMethodResult {
  const count = t.members.length;
  const member = isMember(t, current);
  switch (method) {
    case "first":
      return { call: "s.first()", returns: { kind: "enum", value: 0 }, why: "first() returns the first member, whatever s holds (§6.19.5.1)." };
    case "last":
      return { call: "s.last()", returns: { kind: "enum", value: count - 1 }, why: "last() returns the last member, whatever s holds (§6.19.5.2)." };
    case "num":
      return { call: "s.num()", returns: { kind: "int", value: count }, why: `num() returns how many members the enum has: ${count} (§6.19.5.5).` };
    case "name":
      return member
        ? { call: "s.name()", returns: { kind: "string", value: t.members[current as number] }, why: "name() returns the member's name as a string (§6.19.5.6)." }
        : {
            call: "s.name()",
            returns: { kind: "string", value: "" },
            why: "s does not hold a member, so name() returns the empty string. A log that prints an empty state name is a clue (§6.19.5.6).",
          };
    case "next":
    case "prev": {
      const call = `s.${method}(${n === 1 ? "" : n})`;
      if (!member) {
        const def = enumDefault(t);
        return {
          call,
          returns: { kind: "enum", value: def },
          why: `s is not a member, so ${method}() returns the enum's default initial value, ${formatEnumValue(t, def)}, not a neighbour (§6.19.5.${method === "next" ? 3 : 4}, Table 6-7).`,
        };
      }
      const idx = current as number;
      const step = method === "next" ? n : -n;
      const target = (((idx + step) % count) + count) % count;
      const wrapped = method === "next" ? idx + n >= count : idx - n < 0;
      return {
        call,
        returns: { kind: "enum", value: target },
        why: `${method}(${n}) moves ${n} member${n === 1 ? "" : "s"} ${method === "next" ? "forward" : "back"}${wrapped ? ", wrapping around the end of the list" : ""} (§6.19.5.${method === "next" ? 3 : 4}). It returns a value; s itself only changes if you assign it.`,
      };
    }
  }
}

export type EnumAssignForm = "plain" | "static-cast" | "dynamic-cast";

export interface EnumAssignResult {
  code: string;
  compiles: boolean;
  /** Value s holds afterwards (unchanged on a failed $cast). */
  after: EnumValue;
  /** Return value of $cast, when used as a function. */
  castReturn?: 0 | 1;
  why: string;
}

/**
 * Assigning an int to an enum variable: without a cast it is illegal (§6.19.3,
 * §6.19.4); a static cast always succeeds without a range check (§6.19.4);
 * $cast as a function returns 0 and leaves the target unchanged when the value
 * is not a member (§6.24.2).
 */
export function assignIntToEnum(t: EnumTypeModel, before: EnumValue, value: number, form: EnumAssignForm): EnumAssignResult {
  const valid = isMember(t, value);
  if (form === "plain") {
    return {
      code: `s = ${value};`,
      compiles: false,
      after: before,
      why: "Compile error: an int is not an enum. Enums are strongly typed, so assigning an int needs a cast (§6.19.3, §6.19.4).",
    };
  }
  if (form === "static-cast") {
    return {
      code: `s = ${t.name}'(${value});`,
      compiles: true,
      after: value,
      why: valid
        ? `The static cast converts ${value} to ${t.name}; it is a member, so s is ${t.members[value]}.`
        : `A static cast always succeeds and does not check the range, so s now holds ${value}, which is not a member (§6.19.4).`,
    };
  }
  return {
    code: `ok = $cast(s, ${value});`,
    compiles: true,
    after: valid ? value : before,
    castReturn: valid ? 1 : 0,
    why: valid
      ? `$cast checks the value, finds a member, assigns it and returns 1 (§6.24.2).`
      : `$cast checks the value, finds no member, leaves s unchanged and returns 0 (§6.24.2). Test the return value.`,
  };
}

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
