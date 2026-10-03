import { describe, expect, it } from "vitest";

import { DPI_SCENARIOS, DPI_TYPES, allowedAsResult, cParameter, checkDpi, cPrototype, findType } from "@/lib/sv-dpi-model";

const scenario = (id: string) => {
  const s = DPI_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return checkDpi(s.decl);
};

describe("sv-dpi-model: type mapping (Table H.1, H.8)", () => {
  it("basic types map per Table H.1 and small inputs pass by value (H.8.7)", () => {
    expect(cParameter(findType("byte"), "input")).toBe("char x");
    expect(cParameter(findType("shortint"), "input")).toBe("short int x");
    expect(cParameter(findType("int"), "input")).toBe("int x");
    expect(cParameter(findType("longint"), "input")).toBe("long long x");
    expect(cParameter(findType("real"), "input")).toBe("double x");
    expect(cParameter(findType("shortreal"), "input")).toBe("float x");
    expect(cParameter(findType("chandle"), "input")).toBe("void* x");
    expect(cParameter(findType("string"), "input")).toBe("const char* x");
    expect(cParameter(findType("bit"), "input")).toBe("svBit x");
    expect(cParameter(findType("logic"), "input")).toBe("svLogic x");
  });

  it("int is never marshalled as svLogicVecVal (the old visual's error)", () => {
    expect(findType("int").cInput).not.toMatch(/svLogicVecVal/);
  });

  it("output arguments always arrive by reference; an output string is const char** (H.8.8, H.8.10)", () => {
    expect(cParameter(findType("int"), "output")).toBe("int* x");
    expect(cParameter(findType("string"), "output")).toBe("const char** x");
    expect(cParameter(findType("logicvec"), "output")).toBe("svLogicVecVal* x");
  });

  it("packed vectors are not small: inputs arrive as const pointers to canonical chunks (H.7.7, H.8.7)", () => {
    expect(cParameter(findType("bitvec"), "input")).toBe("const svBitVecVal* x");
    expect(cParameter(findType("logicvec"), "input")).toBe("const svLogicVecVal* x");
    expect(findType("bitvec").small).toBe(false);
  });

  it("open arrays arrive as const svOpenArrayHandle in every direction and use real svdpi accessors (H.8.6, H.12)", () => {
    for (const id of ["openint", "openbitvec", "openlogicvec"]) {
      expect(cParameter(findType(id), "input")).toBe("const svOpenArrayHandle x");
      expect(cParameter(findType(id), "output")).toBe("const svOpenArrayHandle x");
    }
    expect(findType("openint").access).toMatch(/svLow\(x, 1\).*svHigh\(x, 1\).*svGetArrElemPtr1/);
    expect(DPI_TYPES.map((t) => t.access).join(" ")).not.toMatch(/svGetIntElement/);
  });

  it("only small types may be function results (§35.5.5)", () => {
    expect(allowedAsResult("int")).toBe(true);
    expect(allowedAsResult("string")).toBe(true);
    expect(allowedAsResult("logic")).toBe(true);
    expect(allowedAsResult("void")).toBe(true);
    expect(allowedAsResult("logic [31:0]")).toBe(false);
    expect(allowedAsResult("bit [7:0]")).toBe(false);
  });

  it("every type offers distractors that differ from the right answer", () => {
    for (const t of DPI_TYPES) {
      expect(t.misconceptions.length).toBeGreaterThan(0);
      for (const m of t.misconceptions) expect(m.c).not.toBe(t.cInput);
    }
    expect(cPrototype(findType("int"), "input")).toBe("void c_use(int x);");
  });
});

describe("sv-dpi-model: import/export legality (§35)", () => {
  it("a pure function of its inputs is legal", () => {
    expect(scenario("pure-ok").verdict).toBe("legal");
  });

  it("an imported task can never be pure (§35.5.1.3)", () => {
    const r = scenario("pure-task");
    expect(r.verdict).toBe("compile-error");
    expect(r.reasons[0].clause).toBe("§35.5.1.3");
  });

  it("pure requires a non-void result and no output arguments (§35.5.2)", () => {
    expect(checkDpi({ direction: "import", kind: "function", property: "pure", result: "void" }).verdict).toBe("compile-error");
    expect(checkDpi({ direction: "import", kind: "function", property: "pure", result: "int", hasOutputArgs: true }).verdict).toBe("compile-error");
  });

  it("a packed-vector function result is a compile error (§35.5.5)", () => {
    expect(scenario("vector-result")).toMatchObject({ verdict: "compile-error" });
  });

  it("calling an exported function needs a context import (§35.5.1.3)", () => {
    expect(scenario("export-no-context").verdict).toBe("runtime-undefined");
    expect(scenario("export-context").verdict).toBe("legal");
  });

  it("an imported function may never call an exported task, even with context (§35.8)", () => {
    const r = scenario("function-calls-task");
    expect(r.verdict).toBe("runtime-undefined");
    expect(r.reasons[0].clause).toBe("§35.8");
  });

  it("a context imported task may call an exported task, and time passes only inside SV (§35.8, §35.5.1.5)", () => {
    const r = scenario("task-calls-task");
    expect(r.verdict).toBe("legal");
    expect(r.time).toMatch(/only inside the exported SV task/);
    expect(checkDpi({ direction: "import", kind: "task", callsExport: "task" }).verdict).toBe("runtime-undefined");
  });

  it("a pure function with side effects is undefined: calls may be eliminated (§35.5.2)", () => {
    expect(scenario("pure-side-effect").verdict).toBe("runtime-undefined");
  });

  it("an imported task that blocks on I/O is legal but freezes the simulator: being a task does not help", () => {
    const r = scenario("blocking-io");
    expect(r.verdict).toBe("legal");
    expect(r.reasons.map((x) => x.text).join(" ")).toMatch(/freezes the whole simulator/);
    expect(r.time).toMatch(/does not let other SV processes run/);
  });

  it("imported functions take zero simulation time (§35.5.1.1)", () => {
    expect(scenario("pure-ok").time).toMatch(/^Zero simulation time/);
  });

  it("class methods cannot be exported and exports cannot take open arrays (§35.7, H.8.2)", () => {
    expect(checkDpi({ direction: "export", kind: "function", exportsClassMethod: true }).verdict).toBe("compile-error");
    expect(checkDpi({ direction: "export", kind: "function", exportHasOpenArray: true }).reasons[0].clause).toBe("H.8.2");
  });
});
