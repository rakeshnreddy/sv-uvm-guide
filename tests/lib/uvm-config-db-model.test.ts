import { describe, expect, it } from "vitest";

import {
  CONFIG_PRESETS,
  NO_VALUE,
  TOP_MODULE,
  configSource,
  depthOf,
  diagnoseGetCandidate,
  explainGet,
  getCandidates,
  precedenceFor,
  reachAt,
  resolveScope,
  runConfigDb,
  scheduleConfigOps,
  type CfgGetOp,
  type CfgOp,
  type CfgPhase,
  type CfgSetOp,
} from "@/lib/uvm-config-db-model";

const TEST = "uvm_test_top";
const ENV = "uvm_test_top.env";
const AGT0 = "uvm_test_top.env.agt0";
const DRV0 = "uvm_test_top.env.agt0.drv";

const set = (id: string, caller: string, instName: string, value: string, phase: CfgPhase = "build", extra: Partial<CfgSetOp> = {}): CfgSetOp => ({
  kind: "set",
  id,
  caller,
  cntxt: caller === TOP_MODULE ? null : caller,
  instName,
  field: "num_pkts",
  type: "int",
  value,
  phase,
  ...extra,
});
const get = (caller: string, phase: CfgPhase = "build", extra: Partial<CfgGetOp> = {}): CfgGetOp => ({
  kind: "get",
  id: "g",
  caller,
  cntxt: caller,
  instName: "",
  field: "num_pkts",
  type: "int",
  phase,
  ...extra,
});
const valueOf = (ops: CfgOp[]) => {
  const g = runConfigDb(ops).gets.g;
  return g.found ? g.value : NO_VALUE;
};
const preset = (id: string) => CONFIG_PRESETS.find((p) => p.id === id)!;

describe("scope and precedence (uvm_config_db_default_implementation_t::set, IEEE 1800.2-2020 C.4.2.2.1)", () => {
  it("scope is {cntxt.get_full_name(), '.', inst_name}; a null cntxt (uvm_root, full name '') uses inst_name alone", () => {
    expect(resolveScope(TEST, "env.agt0")).toBe(AGT0);
    expect(resolveScope(null, "uvm_test_top.env.agt0")).toBe(AGT0);
    expect(resolveScope(AGT0, "")).toBe(AGT0);
  });
  it("depth follows uvm_component::get_depth: uvm_root 0, uvm_test_top 1", () => {
    expect(depthOf(null)).toBe(0);
    expect(depthOf(TEST)).toBe(1);
    expect(depthOf(AGT0)).toBe(3);
  });
  it("during build, precedence is 1000 minus the cntxt depth; otherwise 1000", () => {
    expect(precedenceFor(set("a", TEST, "env", "1"))).toBe(999);
    expect(precedenceFor(set("a", ENV, "agt0", "1"))).toBe(998);
    expect(precedenceFor(set("a", ENV, "agt0", "1", "run"))).toBe(1000);
    expect(precedenceFor(set("a", TOP_MODULE, "x", "1", "pre_run_test"))).toBe(1000);
  });
});

describe("get resolution (uvm_resource_pool::lookup_name C.2.4.4.1, get_highest_precedence C.2.4.4.2)", () => {
  it("during build a set from a higher context wins even though the lower context's set ran later", () => {
    expect(valueOf(preset("build-hierarchy").ops)).toBe("10");
  });
  it("path specificity is not a factor: a broad wildcard from the test beats an exact path from the env", () => {
    expect(valueOf(preset("specificity").ops)).toBe("5");
  });
  it("the top module's set (cntxt null, precedence 1000) outranks the test's build-time set (999)", () => {
    expect(valueOf(preset("top-vs-test").ops)).toBe("1");
  });
  it("after build all sets have precedence 1000, so the last set wins regardless of hierarchy", () => {
    expect(valueOf(preset("after-build").ops)).toBe("30");
    const swapped = [set("s2", ENV, "agt0", "30", "run"), set("s1", TEST, "env.agt0", "40", "run"), get(AGT0, "run")];
    expect(valueOf(swapped)).toBe("40");
  });
  it("two sets from the same context during build: the last one wins (the resource is overwritten)", () => {
    const ops = [set("a", TEST, "env.agt0", "1"), set("b", TEST, "env.agt0", "2"), get(AGT0)];
    expect(valueOf(ops)).toBe("2");
    const run = runConfigDb(ops);
    expect(run.sets.b.reused).toBe(true);
  });
  it("the test's build-time set loses to a later run-phase set from any context (1000 > 999)", () => {
    const ops: CfgOp[] = [set("a", TEST, "env.agt0", "1"), set("b", AGT0, "", "2", "run"), get(AGT0, "run")];
    expect(valueOf(ops)).toBe("2");
  });
  it("a get from a non-component passes cntxt null and its full path as inst_name", () => {
    const ops: CfgOp[] = [set("a", TEST, "env.agt0.sqr.*", "7"), get(AGT0, "run", { cntxt: null, instName: "uvm_test_top.env.agt0.sqr.seq" })];
    expect(valueOf(ops)).toBe("7");
  });
  it("a set that runs after the get is not seen: config_db is not reactive", () => {
    expect(valueOf(preset("late-set").ops)).toBe("10");
    const run = runConfigDb(preset("late-set").ops);
    expect(diagnoseGetCandidate(preset("late-set").ops, run, "g", "50")).toMatch(/runs after this get/);
    // The explanation describes the database as it was at the get, not after the later overwrite.
    expect(explainGet(preset("late-set").ops, run, "g")).toMatch(/set #1 .* returns 1 with 10/);
  });
  it("type must match exactly: virtual apb_if vs virtual apb_if.drv_mp → get returns 0 silently", () => {
    const ops = preset("type-mismatch").ops;
    expect(valueOf(ops)).toBe(NO_VALUE);
    const run = runConfigDb(ops);
    expect(explainGet(ops, run, "g")).toMatch(/exactly type T/);
    expect(run.trace.at(-1)).toContain("null (failed lookup)");
  });
  it("int vs bit [31:0] is also a mismatch", () => {
    expect(valueOf([set("a", TEST, "*", "3"), get(AGT0, "build", { type: "bit [31:0]" })])).toBe(NO_VALUE);
  });
  it("field names match exactly: 'viif' does not find 'vif'", () => {
    const ops = preset("field-typo").ops;
    expect(valueOf(ops)).toBe(NO_VALUE);
    expect(explainGet(ops, runConfigDb(ops), "g")).toMatch(/Field names must match exactly/);
  });
  it("a scope glob with * reaches every descendant whose full path matches, including drivers inside agents", () => {
    const ops = preset("wildcard-reach").ops;
    expect(valueOf(ops)).toBe("UVM_PASSIVE");
    const reach = reachAt(ops, "g");
    expect(reach[AGT0].found).toBe(true);
    expect(reach[DRV0].found).toBe(true);
    expect(reach[ENV].found).toBe(false);
    expect(reach[TEST].found).toBe(false);
  });
});

describe("time order", () => {
  it("build calls run top-down by caller, whatever order they are listed in", () => {
    const ops = [set("env", ENV, "agt0", "20"), set("test", TEST, "env.agt0", "10"), get(AGT0)];
    expect(scheduleConfigOps(ops).map((s) => s.op.id)).toEqual(["test", "env", "g"]);
  });
  it("tb_top's sets come before build, run_phase calls after build", () => {
    const ops = [set("r", TEST, "x", "1", "run"), set("b", TEST, "x", "1"), set("t", TOP_MODULE, "x", "1", "pre_run_test")];
    expect(scheduleConfigOps(ops).map((s) => s.op.id)).toEqual(["t", "b", "r"]);
  });
});

describe("diagnostics and generated code", () => {
  it("explains a lower-precedence build set that ran later", () => {
    const ops = preset("build-hierarchy").ops;
    const fb = diagnoseGetCandidate(ops, runConfigDb(ops), "g", "20");
    expect(fb).toMatch(/998/);
    expect(fb).toMatch(/higher context wins/);
  });
  it("names the specificity misconception when the losing set has the more specific path", () => {
    const ops = preset("specificity").ops;
    expect(diagnoseGetCandidate(ops, runConfigDb(ops), "g", "20")).toMatch(/more specific path does not help/);
  });
  it("explains a tie broken by recency after build", () => {
    const ops = preset("after-build").ops;
    expect(diagnoseGetCandidate(ops, runConfigDb(ops), "g", "40")).toMatch(/most recent set wins/);
  });
  it("offers each set value plus 'returns 0'", () => {
    const ops = preset("build-hierarchy").ops;
    expect(getCandidates(ops, runConfigDb(ops), "g")).toEqual(["10", "20", NO_VALUE]);
  });
  it("generates set/get calls with this or null as cntxt", () => {
    const text = configSource(preset("top-vs-test").ops).map((l) => l.text).join("\n");
    expect(text).toContain('uvm_config_db#(int)::set(null, "uvm_test_top.env.agt0", "num_pkts", 1);');
    expect(text).toContain('uvm_config_db#(int)::set(this, "env.agt0", "num_pkts", 99);');
    expect(text).toContain('if (!uvm_config_db#(int)::get(this, "", "num_pkts", num_pkts))');
  });
});
