import { describe, expect, it } from "vitest";

import { assignIntToEnum, callEnumMethod, enumDefault, type EnumTypeModel } from "@/lib/sv-enum-string-model";
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
