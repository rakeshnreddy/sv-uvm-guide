import { describe, expect, it } from "vitest";

import {
  SIMPLE_BUS_IF,
  TRY_STATEMENTS,
  checkAccess,
  interfaceToSource,
  moduleHeader,
  dereferenceVirtualInterface,
  viewOf,
  type InterfaceDecl,
} from "@/lib/sv-interface-model";

const decl = SIMPLE_BUS_IF;

describe("sv-interface-model: directions are seen from the module using the modport (§25.5)", () => {
  it("master sees ready as an input (into the module) and addr as an output (out of the module)", () => {
    const view = viewOf(decl, "master");
    expect(view.find((s) => s.signal === "ready")).toMatchObject({ dir: "input", flow: "into-module" });
    expect(view.find((s) => s.signal === "addr")).toMatchObject({ dir: "output", flow: "out-of-module" });
  });

  it("slave is the mirror image: ready flows out, valid flows in", () => {
    const view = viewOf(decl, "slave");
    expect(view.find((s) => s.signal === "ready")?.flow).toBe("out-of-module");
    expect(view.find((s) => s.signal === "valid")?.flow).toBe("into-module");
  });

  it("monitor sees every signal as an input", () => {
    expect(viewOf(decl, "monitor").every((s) => s.dir === "input")).toBe(true);
  });

  it("a clocking modport exposes the clockvars with the clocking block's directions (§25.5.5)", () => {
    const view = viewOf(decl, "drv");
    expect(view.map((s) => s.path)).toContain("bus.cb.valid");
    expect(view.find((s) => s.signal === "ready")).toMatchObject({ path: "bus.cb.ready", dir: "input" });
  });
});

describe("sv-interface-model: access legality", () => {
  it("driving an input through a modport is a compile-time error (§25.5, §23.3.3.2)", () => {
    const v = checkAccess(decl, "master", "ready", "drive");
    expect(v.outcome).toBe("compile-error");
    expect(v.clause).toContain("§23.3.3.2");
    expect(v.statement).toBe("bus.ready <= 1;");
  });

  it("driving an output and reading an input are legal", () => {
    expect(checkAccess(decl, "master", "addr", "drive").outcome).toBe("legal");
    expect(checkAccess(decl, "master", "ready", "read").outcome).toBe("legal");
    expect(checkAccess(decl, "slave", "ready", "drive").outcome).toBe("legal");
  });

  it("a monitor cannot drive anything", () => {
    expect(checkAccess(decl, "monitor", "valid", "drive").outcome).toBe("compile-error");
  });

  it("names not listed in the modport are not accessible through it (§25.5)", () => {
    expect(checkAccess(decl, "master", "cb.valid", "drive").outcome).toBe("compile-error");
    expect(checkAccess(decl, "drv", "valid", "drive").outcome).toBe("compile-error");
  });

  it("through a clocking modport: synchronous drive of an output clockvar is legal (§14.16)", () => {
    expect(checkAccess(decl, "drv", "cb.valid", "drive")).toMatchObject({ outcome: "legal", clause: "§14.16" });
  });

  it("writing an input clockvar or reading an output clockvar is illegal (§14.3)", () => {
    expect(checkAccess(decl, "drv", "cb.ready", "drive")).toMatchObject({ outcome: "compile-error", clause: "§14.3" });
    expect(checkAccess(decl, "drv", "cb.valid", "read")).toMatchObject({ outcome: "compile-error", clause: "§14.3" });
    expect(checkAccess(decl, "drv", "cb.ready", "read").outcome).toBe("legal");
  });

  it("an inout modport item on a variable is illegal: inout needs a net (§6.5, §23.3.3)", () => {
    const withInout: InterfaceDecl = {
      ...decl,
      modports: [...decl.modports, { name: "tb", user: "tb", ports: [{ signal: "data", dir: "inout" }] }],
    };
    expect(checkAccess(withInout, "tb", "data", "drive")).toMatchObject({ outcome: "compile-error", clause: "§6.5, §23.3.3" });
    const asNet: InterfaceDecl = { ...withInout, signals: withInout.signals.map((s) => (s.name === "data" ? { ...s, kind: "net" } : s)) };
    expect(checkAccess(asNet, "tb", "data", "drive").outcome).toBe("legal");
  });

  it("every offered statement has a verdict, and each view offers at least one illegal attempt", () => {
    for (const [view, statements] of Object.entries(TRY_STATEMENTS)) {
      const verdicts = statements.map((s) => checkAccess(decl, view, s.path, s.op));
      expect(verdicts.some((v) => v.outcome === "compile-error")).toBe(true);
    }
  });
});

describe("sv-interface-model: generated code and virtual interfaces", () => {
  it("emits the modports and the clocking modport", () => {
    const text = interfaceToSource(decl).map((l) => l.text).join("\n");
    expect(text).toContain("modport master (");
    expect(text).toContain("    input  clk, ready,");
    expect(text).toContain("    output addr, data, rw, valid");
    expect(text).toContain("modport drv (clocking cb);");
    expect(text).toContain("clocking cb @(posedge clk);");
    expect(moduleHeader(decl, decl.modports[0])).toBe("module master_driver (simple_bus_if.master bus);");
  });

  it("using a virtual interface that was never assigned is a fatal run-time error (§25.9)", () => {
    expect(dereferenceVirtualInterface(false).outcome).toBe("fatal-runtime");
    expect(dereferenceVirtualInterface(true).outcome).toBe("ok");
  });
});
