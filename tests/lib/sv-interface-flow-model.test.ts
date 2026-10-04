import { describe, expect, it } from "vitest";

import { SIMPLE_BUS_IF, type InterfaceDecl } from "@/lib/sv-interface-model";
import {
  FLOW_PRESETS,
  FLOW_STATEMENTS,
  HANDLE_MODPORTS,
  checkVifAccess,
  checkVifAssignment,
  flowSource,
  modportDeclarationErrors,
} from "@/lib/sv-interface-flow-model";

const decl = SIMPLE_BUS_IF;

describe("sv-interface-flow-model: null virtual interface (IEEE 1800-2023 §25.9)", () => {
  it("a legal statement through an unassigned handle compiles, then is a fatal run-time error", () => {
    const v = checkVifAccess(decl, { modport: "drv", assigned: false, path: "cb.valid", op: "drive" });
    expect(v.outcome).toBe("fatal-runtime");
    expect(v.clause).toBe("§25.9");
    expect(v.steps.find((s) => s.id === "handle")?.status).toBe("error");
    expect(v.steps.find((s) => s.id === "signal")?.status).toBe("not-reached");
  });

  it("a static error wins over a null handle: the design never reaches time 0", () => {
    const v = checkVifAccess(decl, { modport: "drv", assigned: false, path: "valid", op: "drive" });
    expect(v.outcome).toBe("compile-error");
    expect(v.steps.find((s) => s.id === "handle")?.status).toBe("not-reached");
  });
});

describe("sv-interface-flow-model: the modport is part of the handle's type (§25.9, §25.5)", () => {
  it("a .drv handle sees only the clocking block: cb.valid drive is legal, a direct valid drive is not (§25.5.5)", () => {
    expect(checkVifAccess(decl, { modport: "drv", assigned: true, path: "cb.valid", op: "drive" })).toMatchObject({ outcome: "legal", clause: "§14.16", statement: "vif.cb.valid <= 1;" });
    expect(checkVifAccess(decl, { modport: "drv", assigned: true, path: "valid", op: "drive" }).outcome).toBe("compile-error");
  });

  it("a .monitor handle cannot drive (inputs only, §23.3.3.2)", () => {
    const v = checkVifAccess(decl, { modport: "monitor", assigned: true, path: "valid", op: "drive" });
    expect(v.outcome).toBe("compile-error");
    expect(v.clause).toContain("§23.3.3.2");
    expect(v.rule).not.toContain("bus.");
  });

  it("clockvar directions hold with or without a modport (§14.3)", () => {
    for (const modport of [null, "drv"]) {
      expect(checkVifAccess(decl, { modport, assigned: true, path: "cb.valid", op: "read" })).toMatchObject({ outcome: "compile-error", clause: "§14.3" });
      expect(checkVifAccess(decl, { modport, assigned: true, path: "cb.ready", op: "read" })).toMatchObject({ outcome: "legal", clause: "§14.13" });
    }
  });

  it("with no modport, direct writes compile, and writing a DUT-owned signal is flagged as a fight", () => {
    expect(checkVifAccess(decl, { modport: null, assigned: true, path: "valid", op: "drive" }).outcome).toBe("legal");
    const ready = checkVifAccess(decl, { modport: null, assigned: true, path: "ready", op: "drive" });
    expect(ready.outcome).toBe("legal");
    expect(ready.rule).toMatch(/belongs to the DUT/);
  });

  it("every handle type has at least one legal and one illegal offered statement", () => {
    for (const modport of HANDLE_MODPORTS) {
      const outcomes = FLOW_STATEMENTS.map((s) => checkVifAccess(decl, { modport, assigned: true, ...s }).outcome);
      expect(outcomes, String(modport)).toContain("legal");
      expect(outcomes, String(modport)).toContain("compile-error");
    }
  });
});

describe("sv-interface-flow-model: handle assignment (§25.9)", () => {
  it("an instance or a no-modport handle may be assigned to a modport handle; not the reverse", () => {
    expect(checkVifAssignment("drv", { kind: "instance" }).legal).toBe(true);
    expect(checkVifAssignment("drv", { kind: "vif", modport: null }).legal).toBe(true);
    expect(checkVifAssignment(null, { kind: "vif", modport: "drv" }).legal).toBe(false);
    expect(checkVifAssignment("master", { kind: "vif", modport: "drv" }).legal).toBe(false);
    expect(checkVifAssignment("drv", { kind: "vif", modport: "drv" }).legal).toBe(true);
  });
});

describe("sv-interface-flow-model: declarations and code", () => {
  it("the shared interface has no inout on a variable; adding one is flagged (§6.5, §23.3.3)", () => {
    expect(modportDeclarationErrors(decl)).toEqual([]);
    const bad: InterfaceDecl = { ...decl, modports: [...decl.modports, { name: "tb", user: "tb", ports: [{ signal: "data", dir: "inout" }] }] };
    expect(modportDeclarationErrors(bad)).toEqual(["tb.data"]);
  });

  it("generated code follows the setup: handle type, wait, statement and the (missing) assignment", () => {
    const working = flowSource(decl, FLOW_PRESETS[0].setup).map((l) => l.text);
    expect(working).toContain("  virtual simple_bus_if.drv vif;");
    expect(working).toContain("    @(vif.cb);");
    expect(working).toContain("    vif.cb.valid <= 1;");
    expect(working).toContain("    drv.vif = bus_if;");
    const nullVif = flowSource(decl, FLOW_PRESETS.find((p) => p.id === "null-vif")!.setup).map((l) => l.text);
    expect(nullVif).toContain("    // drv.vif = bus_if;   (missing)");
    const monitor = flowSource(decl, { modport: "monitor", assigned: true, path: "data", op: "read" }).map((l) => l.text);
    expect(monitor).toContain("    @(posedge vif.clk);");
  });

  it("every debug preset produces the outcome its symptom describes", () => {
    const outcome = (id: string) => checkVifAccess(decl, FLOW_PRESETS.find((p) => p.id === id)!.setup).outcome;
    expect(outcome("working")).toBe("legal");
    expect(outcome("null-vif")).toBe("fatal-runtime");
    expect(outcome("bypass-cb")).toBe("compile-error");
    expect(outcome("monitor-drives")).toBe("compile-error");
    expect(outcome("read-output")).toBe("compile-error");
  });
});
