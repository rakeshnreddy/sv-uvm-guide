import { describe, expect, it } from "vitest";

import {
  FACTORY_CLASSES,
  applyOverride,
  candidateOutcomes,
  diagnoseCandidate,
  emptyFactory,
  explainNode,
  factoryPrintout,
  findOverrideByType,
  fullInstPath,
  lookupLog,
  nodeResult,
  outcomeOf,
  proxyOf,
  runFactoryProgram,
  scheduleProgram,
  standardTree,
  testSource,
  type FactoryProgram,
  type PlacedOverride,
} from "@/lib/uvm-factory-model";
import { factoryPathMatches, uvmIsMatch } from "@/lib/uvm-glob-model";

const T = FACTORY_CLASSES;
const DRV0 = "uvm_test_top.env.agt0.drv";
const DRV1 = "uvm_test_top.env.agt1.drv";

const typeOv = (id: string, original: string, override: string, extra: Partial<PlacedOverride> = {}): PlacedOverride =>
  ({ id, kind: "type", original, override, replace: true, placement: "test-build-before", ...extra }) as PlacedOverride;
const instOv = (id: string, original: string, override: string, pathArg: string, withThis = true, extra: Partial<PlacedOverride> = {}): PlacedOverride =>
  ({ id, kind: "inst", original, override, pathArg, parentPath: withThis ? "uvm_test_top" : null, placement: "test-build-before", ...extra }) as PlacedOverride;

const program = (overrides: PlacedOverride[], tree = standardTree()): FactoryProgram => ({ classes: T, root: tree, overrides });
const built = (p: FactoryProgram, path: string) => outcomeOf(nodeResult(runFactoryProgram(p), path)!);

describe("uvm glob (uvm_regex.cc uvm_glob_to_re, uvm_globals.svh uvm_is_match)", () => {
  it("* matches any characters including dots; the glob is anchored", () => {
    expect(uvmIsMatch("*.drv", DRV0)).toBe(true);
    expect(uvmIsMatch("uvm_test_top.env.agt*", DRV0)).toBe(true);
    expect(uvmIsMatch("env.agt0.drv", DRV0)).toBe(false);
  });
  it("? matches exactly one character", () => {
    expect(uvmIsMatch("uvm_test_top.env.agt?.drv", DRV1)).toBe(true);
    expect(uvmIsMatch("uvm_test_top.env.agt?.drv", "uvm_test_top.env.agt10.drv")).toBe(false);
  });
  it("dots are literal, not regex wildcards", () => {
    expect(uvmIsMatch("uvm_test_top.env", "uvm_test_topXenv")).toBe(false);
  });
  it("an empty glob matches only the empty string", () => {
    expect(uvmIsMatch("", "")).toBe(true);
    expect(uvmIsMatch("", "uvm_test_top")).toBe(false);
  });
  it("factory paths without * or ? are compared exactly (m_has_wildcard), so + is not a wildcard there", () => {
    expect(uvmIsMatch("uvm_test_top.env.agt+", "uvm_test_top.env.agt0")).toBe(true);
    expect(factoryPathMatches("uvm_test_top.env.agt+", "uvm_test_top.env.agt0")).toBe(false);
    expect(factoryPathMatches("*", "anything.at.all")).toBe(true);
  });
});

describe("uvm_default_factory::find_override_by_type (IEEE 1800.2-2020 §8.3.1.7.1)", () => {
  it("two instance overrides match the same path: the first registered wins, not the most specific", () => {
    const p = program([instOv("a", "base_driver", "mock_driver", "*.drv", false), instOv("b", "base_driver", "err_driver", "env.agt0.drv")]);
    expect(built(p, DRV0)).toBe("mock_driver");
    // Registering the specific one first flips the answer.
    const flipped = program([instOv("b", "base_driver", "err_driver", "env.agt0.drv"), instOv("a", "base_driver", "mock_driver", "*.drv", false)]);
    expect(built(flipped, DRV0)).toBe("err_driver");
    expect(built(flipped, DRV1)).toBe("mock_driver");
  });

  it("instance overrides are checked before type overrides, even when the type override was registered first", () => {
    const p = program([typeOv("t", "base_driver", "err_driver"), instOv("i", "base_driver", "mock_driver", "env.agt1.*")]);
    expect(built(p, DRV1)).toBe("mock_driver");
    expect(built(p, DRV0)).toBe("err_driver");
  });

  it("set_type_override with replace=1 replaces the existing entry for that original type (TPREGR)", () => {
    const r1 = applyOverride(T, emptyFactory(), typeOv("1", "base_driver", "mock_driver"));
    const r2 = applyOverride(T, r1.state, typeOv("2", "base_driver", "err_driver"));
    expect(r2.effect).toBe("replaced");
    expect(r2.state.type).toHaveLength(1);
    expect(r2.messages[0].id).toBe("TPREGR");
    expect(findOverrideByType(r2.state, "base_driver", DRV0).result).toBe("err_driver");
  });

  it("set_type_override with replace=0 keeps the existing entry (TPREGD)", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver"), typeOv("2", "base_driver", "err_driver", { replace: false } as Partial<PlacedOverride>)]);
    const run = runFactoryProgram(p);
    expect(run.effects["2"]).toBe("kept-existing");
    expect(run.messages.some((m) => m.id === "TPREGD")).toBe(true);
    expect(built(p, DRV0)).toBe("mock_driver");
  });

  it("overrides chain: A→B then B→C makes a request for A build C", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver"), typeOv("2", "mock_driver", "err_driver")]);
    const node = nodeResult(runFactoryProgram(p), DRV0)!;
    expect(node.built).toBe("err_driver");
    expect(node.lookup?.hops.map((h) => h.requested)).toEqual(["base_driver", "mock_driver", "err_driver"]);
  });

  it("chaining re-checks instance overrides for the new type at the same path", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver"), instOv("2", "mock_driver", "err_driver", "env.agt1.drv")]);
    expect(built(p, DRV1)).toBe("err_driver");
    expect(built(p, DRV0)).toBe("mock_driver");
  });

  it("instance overrides are skipped for an empty path (object created with no context)", () => {
    const state = applyOverride(T, emptyFactory(), instOv("i", "my_txn", "err_txn", "*", false)).state;
    expect(findOverrideByType(state, "my_txn", "").result).toBe("my_txn");
    expect(findOverrideByType(state, "my_txn", "tr").result).toBe("err_txn");
  });

  it("a cyclic chain stops instead of looping forever", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver"), typeOv("2", "mock_driver", "base_driver")]);
    const node = nodeResult(runFactoryProgram(p), DRV0)!;
    expect(node.lookup?.loop).toBe(true);
  });
});

describe("set_inst_override path construction (uvm_registry_common::set_inst_override, §8.3.1.4.1)", () => {
  it("with a parent, the path is {parent.get_full_name(), '.', inst_path}", () => {
    expect(fullInstPath({ id: "x", kind: "inst", original: "a", override: "b", pathArg: "env.agt0.drv", parentPath: "uvm_test_top" })).toBe(DRV0);
  });
  it("without a parent, a relative-looking path is taken as absolute and never matches", () => {
    const p = program([instOv("i", "base_driver", "mock_driver", "env.agt0.drv", false)]);
    expect(built(p, DRV0)).toBe("base_driver");
  });
  it("a misspelled path matches nothing", () => {
    const p = program([instOv("i", "base_driver", "mock_driver", "env.agent0.drv")]);
    expect(built(p, DRV0)).toBe("base_driver");
    const run = runFactoryProgram(p);
    expect(diagnoseCandidate(p, run, DRV0, "mock_driver")).toMatch(/uvm_test_top\.env\.agent0\.drv/);
  });
  it("an identical instance override is ignored (DUPOVRD)", () => {
    const s1 = applyOverride(T, emptyFactory(), instOv("1", "base_driver", "mock_driver", "env.agt0.drv"));
    const s2 = applyOverride(T, s1.state, instOv("2", "base_driver", "mock_driver", "env.agt0.drv"));
    expect(s2.effect).toBe("duplicate");
    expect(s2.state.inst).toHaveLength(1);
  });
});

describe("type_id::create (uvm_registry_common::create, §8.2.3.2.4)", () => {
  it("$casts the factory's result: an incompatible override is UVM_FATAL FCTTYP and stops the build", () => {
    const p = program([typeOv("1", "base_driver", "my_monitor")]);
    const run = runFactoryProgram(p);
    expect(run.fatal?.id).toBe("FCTTYP");
    expect(run.fatal?.text).toContain("Factory did not return a component of type 'base_driver'");
    expect(outcomeOf(nodeResult(run, DRV0)!)).toBe("FATAL");
    // agt1 was already created by env's build_phase; its children never are.
    expect(nodeResult(run, "uvm_test_top.env.agt1")?.status).toBe("built");
    expect(nodeResult(run, "uvm_test_top.env.agt0.mon")?.status).toBe("not-built");
    expect(nodeResult(run, DRV1)?.status).toBe("not-built");
  });

  it("new() bypasses the factory", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver")], standardTree({ driverConstruct: "new" }));
    expect(built(p, DRV0)).toBe("base_driver");
    expect(built(p, "uvm_test_top.env.agt0.mon")).toBe("my_monitor");
  });

  it("a class without `uvm_component_utils resolves get_type() to its registered parent: the override is a no-op with TYPDUP", () => {
    expect(proxyOf(T, "quiet_driver")).toBe("base_driver");
    const p = program([typeOv("1", "base_driver", "quiet_driver")]);
    const run = runFactoryProgram(p);
    expect(run.messages.find((m) => m.id === "TYPDUP")?.severity).toBe("WARNING");
    expect(built(p, DRV0)).toBe("base_driver");
    expect(diagnoseCandidate(p, run, DRV0, "quiet_driver")).toMatch(/TYPDUP/);
  });
});

describe("override timing: only later create() calls see an override", () => {
  it("an override registered after env is created still reaches the drivers (built later, top-down)", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver", { placement: "test-build-after" } as Partial<PlacedOverride>)]);
    expect(built(p, DRV0)).toBe("mock_driver");
  });
  it("but it cannot change env itself", () => {
    const p = program([typeOv("1", "my_env", "dbg_env", { placement: "test-build-after" } as Partial<PlacedOverride>)]);
    expect(built(p, "uvm_test_top.env")).toBe("my_env");
  });
  it("an override registered in connect_phase changes nothing that was built", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver", { placement: "test-connect" } as Partial<PlacedOverride>)]);
    const run = runFactoryProgram(p);
    expect(built(p, DRV0)).toBe("base_driver");
    expect(diagnoseCandidate(p, run, DRV0, "mock_driver")).toMatch(/after this create\(\) already ran/);
  });
  it("build order is top-down and depth-first: env creates both agents before agt0 creates its driver", () => {
    const events = scheduleProgram(program([])).filter((e) => e.kind === "create").map((e) => (e.kind === "create" ? e.path : ""));
    expect(events).toEqual([
      "uvm_test_top.env",
      "uvm_test_top.env.agt0",
      "uvm_test_top.env.agt1",
      DRV0,
      "uvm_test_top.env.agt0.mon",
      DRV1,
      "uvm_test_top.env.agt1.mon",
    ]);
  });
});

describe("explanations and generated code", () => {
  it("diagnoses the shadowed instance override as a registration-order mistake", () => {
    const p = program([instOv("a", "base_driver", "mock_driver", "*.drv", false), instOv("b", "base_driver", "err_driver", "env.agt0.drv")]);
    const run = runFactoryProgram(p);
    expect(diagnoseCandidate(p, run, DRV0, "err_driver")).toMatch(/registered first/);
    expect(explainNode(p, run, DRV0)).toMatch(/first registered match wins/);
  });
  it("diagnoses a type override beaten by an instance override", () => {
    const p = program([typeOv("t", "base_driver", "err_driver"), instOv("i", "base_driver", "mock_driver", "env.agt1.*")]);
    const run = runFactoryProgram(p);
    expect(diagnoseCandidate(p, run, DRV1, "err_driver")).toMatch(/checked before type overrides/);
  });
  it("diagnoses an intermediate chain hop", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver"), typeOv("2", "mock_driver", "err_driver")]);
    expect(diagnoseCandidate(p, runFactoryProgram(p), DRV0, "mock_driver")).toMatch(/intermediate hop/);
  });
  it("offers FATAL as a candidate when an incompatible override exists", () => {
    const p = program([typeOv("1", "base_driver", "my_monitor")]);
    expect(candidateOutcomes(p, runFactoryProgram(p), DRV0)).toEqual(["base_driver", "my_monitor", "FATAL"]);
  });
  it("generates the override calls with the right arguments", () => {
    const p = program([typeOv("1", "base_driver", "mock_driver", { replace: false } as Partial<PlacedOverride>), instOv("2", "my_monitor", "cov_monitor", "env.agt0.mon")]);
    const text = testSource(p).map((l) => l.text).join("\n");
    expect(text).toContain("base_driver::type_id::set_type_override(mock_driver::get_type(), 0);");
    expect(text).toContain('my_monitor::type_id::set_inst_override(cov_monitor::get_type(), "env.agt0.mon", this);');
  });
  it("prints instance overrides in queue order and the log marks the first match", () => {
    const p = program([instOv("a", "base_driver", "mock_driver", "*.drv", false), instOv("b", "base_driver", "err_driver", "env.agt0.drv")]);
    const run = runFactoryProgram(p);
    const printout = factoryPrintout(run.state).join("\n");
    expect(printout.indexOf("*.drv")).toBeLessThan(printout.indexOf(DRV0));
    const log = lookupLog(p, nodeResult(run, DRV0)!).join("\n");
    expect(log).toMatch(/#1 "\*\.drv" vs "uvm_test_top\.env\.agt0\.drv": ✓ match/);
    expect(log).toMatch(/#2 .*never reached/);
  });
});
