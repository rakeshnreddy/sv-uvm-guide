import { describe, expect, it } from "vitest";

import {
  BUILDERR_LOG,
  analysisCallOrder,
  analysisExport,
  analysisFifoEndpoints,
  analysisImp,
  analysisPort,
  blockingGetPort,
  broadcastTrace,
  checkConnect,
  connectStatement,
  elaborate,
  endpointFullName,
  findEndpoint,
  getPeekImp,
  pullModelRun,
  resolveBindings,
  seqItemPullImp,
  seqItemPullPort,
  simulateAnalysisFifo,
  slowSubscriberVerdict,
  TLM_BUILDER_SCENARIOS,
  declarationSource,
  goalStatus,
  type TlmTopology,
} from "@/lib/uvm-tlm-model";

// Sources: uvm-core 2020.3.1 src/base/uvm_port_base.svh, src/tlm1/uvm_analysis_port.svh,
// src/tlm1/uvm_tlm_imps.svh, src/tlm1/uvm_tlm_fifos.svh, src/tlm1/uvm_tlm_fifo_base.svh,
// src/base/uvm_root.svh, src/comps/uvm_subscriber.svh.

const topo: TlmTopology = {
  components: [
    { id: "test", name: "uvm_test_top", parent: null, kind: "test", cls: "bus_test" },
    { id: "env", name: "env", parent: "test", kind: "env", cls: "bus_env" },
    { id: "agt", name: "agt", parent: "env", kind: "agent", cls: "bus_agent" },
    { id: "sqr", name: "sqr", parent: "agt", kind: "sequencer", cls: "bus_sequencer" },
    { id: "drv", name: "drv", parent: "agt", kind: "driver", cls: "bus_driver" },
    { id: "mon", name: "mon", parent: "agt", kind: "monitor", cls: "bus_monitor" },
    { id: "chk_env", name: "chk_env", parent: "env", kind: "env", cls: "check_env" },
    { id: "scb", name: "scb", parent: "chk_env", kind: "scoreboard", cls: "bus_scoreboard" },
    { id: "fifo", name: "fifo", parent: "env", kind: "fifo", cls: "uvm_tlm_analysis_fifo #(bus_item)" },
    { id: "chk", name: "chk", parent: "env", kind: "scoreboard", cls: "bus_checker" },
    { id: "cov", name: "cov", parent: "env", kind: "subscriber", cls: "bus_coverage" },
    { id: "log", name: "log", parent: "env", kind: "subscriber", cls: "txn_logger" },
    { id: "pkt_cov", name: "pkt_cov", parent: "env", kind: "subscriber", cls: "pkt_coverage" },
  ],
  endpoints: [
    seqItemPullPort("drv", "bus_item"),
    seqItemPullImp("sqr", "bus_item"),
    analysisPort("mon", "ap", "bus_item"),
    analysisPort("agt", "ap", "bus_item"),
    analysisExport("chk_env", "analysis_export", "bus_item"),
    analysisImp("scb", "item_imp", "bus_item"),
    ...analysisFifoEndpoints("fifo", "bus_item"),
    blockingGetPort("chk", "get_port", "bus_item"),
    analysisImp("cov", "analysis_export", "bus_item", { objName: "analysis_imp" }),
    analysisImp("log", "analysis_export", "bus_item", { objName: "analysis_imp" }),
    analysisImp("pkt_cov", "analysis_export", "pkt_item", { objName: "analysis_imp" }),
  ],
};

describe("uvm-tlm-model: connect() direction (uvm_port_base::connect)", () => {
  it("port.connect(imp) between siblings is accepted (drv.seq_item_port → sqr.seq_item_export)", () => {
    const r = checkConnect(topo, [], "drv.seq_item_port", "sqr.seq_item_export");
    expect(r.kind).toBe("ok");
    expect(r.accepted).toBe(true);
    expect(r.statement.code).toBe("drv.seq_item_port.connect(sqr.seq_item_export);");
    expect(r.statement.writer).toBe("agt");
  });

  it("imp.connect(anything) is a UVM_ERROR with uvm-core's exact text, and records nothing", () => {
    const r = checkConnect(topo, [], "sqr.seq_item_export", "drv.seq_item_port");
    expect(r.kind).toBe("uvm_error");
    expect(r.accepted).toBe(false);
    expect(r.reportId).toBe("Connection Error");
    expect(r.message).toBe(
      "Cannot call an imp port's connect method. An imp is connected only to the component passed in its constructor. (You attempted to bind this imp to uvm_test_top.env.agt.drv.seq_item_port)",
    );
    expect(r.log).toBe(`UVM_ERROR @ 0: uvm_test_top.env.agt.sqr.seq_item_export [Connection Error] ${r.message}`);
  });

  it("export.connect(port) is a UVM_ERROR telling you to call port.connect(export) instead", () => {
    const r = checkConnect(topo, [], "chk_env.analysis_export", "agt.ap");
    expect(r.rule).toBe("export-to-port");
    expect(r.message).toMatch(/^Cannot connect exports to ports Try calling port\.connect\(export\) instead\./);
  });

  it("an analysis_port may connect to an analysis_export (the 2B lesson's old claim was wrong)", () => {
    const r = checkConnect(topo, [], "agt.ap", "chk_env.analysis_export");
    expect(r.kind).toBe("ok");
    expect(r.statement.code).toBe("agt.ap.connect(chk_env.analysis_export);");
  });

  it("hierarchical promotion: child port → parent port (up) and parent export → child imp (down) are accepted", () => {
    const up = checkConnect(topo, [], "mon.ap", "agt.ap");
    expect(up.kind).toBe("ok");
    expect(up.statement).toMatchObject({ writer: "agt", code: "mon.ap.connect(ap);" });
    const down = checkConnect(topo, [], "chk_env.analysis_export", "scb.item_imp");
    expect(down.kind).toBe("ok");
    expect(down.statement).toMatchObject({ writer: "chk_env", code: "analysis_export.connect(scb.item_imp);" });
  });

  it("self-connection is an error; a repeated connection is a no-op", () => {
    expect(checkConnect(topo, [], "agt.ap", "agt.ap").rule).toBe("self");
    const dup = checkConnect(topo, [{ from: "mon.ap", to: "agt.ap" }], "mon.ap", "agt.ap");
    expect(dup.kind).toBe("duplicate");
    expect(dup.accepted).toBe(false);
  });

  it("connect() at or after end_of_elaboration is ignored with a Late Connection warning", () => {
    const r = checkConnect(topo, [], "mon.ap", "agt.ap", { phase: "run" });
    expect(r).toMatchObject({ kind: "uvm_warning", reportId: "Late Connection", accepted: false });
    expect(r.message).toContain("at or after end_of_elaboration phase.  Ignoring.");
  });
});

describe("uvm-tlm-model: interface compatibility", () => {
  it("blocking_get_port → get_peek_imp passes the mask check (provider mask covers the requirer's)", () => {
    expect(checkConnect(topo, [], "chk.get_port", "fifo.get_export").kind).toBe("ok");
  });

  it("blocking_get_port → put_imp fails the mask check with 'does not provide the complete interface'", () => {
    const r = checkConnect(topo, [], "chk.get_port", "fifo.put_export");
    expect(r.rule).toBe("interface-mask");
    expect(r.message).toBe(
      "uvm_test_top.env.fifo.put_export (of type uvm_put_imp) does not provide the complete interface required of this port (type uvm_blocking_get_port)",
    );
  });

  it("the mask check runs before the imp check, so an analysis port can never reach put_export either", () => {
    expect(checkConnect(topo, [], "agt.ap", "fifo.put_export").rule).toBe("interface-mask");
  });

  it("different interface families or transaction types are compile errors, not UVM messages", () => {
    const fam = checkConnect(topo, [], "drv.seq_item_port", "scb.item_imp");
    expect(fam.kind).toBe("compile_error");
    expect(fam.log).toBeNull();
    const txn = checkConnect(topo, [], "agt.ap", "pkt_cov.analysis_export");
    expect(txn.kind).toBe("compile_error");
    expect(txn.why).toMatch(/bus_item vs pkt_item/);
  });

  it("FIFO get_export is an alias: its full name is the get_peek_export imp", () => {
    expect(endpointFullName(topo, findEndpoint(topo, "fifo.get_export"))).toBe("uvm_test_top.env.fifo.get_peek_export");
    expect(findEndpoint(topo, "fifo.analysis_export").role).toBe("imp");
  });
});

describe("uvm-tlm-model: relationship check (m_check_relationship)", () => {
  it("port → imp across a hierarchy level is silent by default and warns only when check_connection_relationships is set", () => {
    const t2: TlmTopology = { ...topo, endpoints: [...topo.endpoints, getPeekImp("scb", "get_imp", "bus_item")] };
    const quiet = checkConnect(t2, [], "chk.get_port", "scb.get_imp");
    expect(quiet.kind).toBe("ok");
    expect(quiet.relationship.ok).toBe(false);
    const loud = checkConnect(t2, [], "chk.get_port", "scb.get_imp", { checkRelationships: true });
    expect(loud.kind).toBe("uvm_warning");
    expect(loud.accepted).toBe(true);
    expect(loud.message).toContain("is not at the same level of hierarchy as this port");
    expect(checkConnect(topo, [], "drv.seq_item_port", "sqr.seq_item_export", { checkRelationships: true }).kind).toBe("ok");
  });

  it("port → port that is not up one level warns (when enabled) but still connects", () => {
    const t3: TlmTopology = {
      components: topo.components,
      endpoints: [blockingGetPort("drv", "gp", "bus_item"), blockingGetPort("env", "gp", "bus_item"), blockingGetPort("agt", "gp", "bus_item")],
    };
    const skip = checkConnect(t3, [], "drv.gp", "env.gp", { checkRelationships: true });
    expect(skip.kind).toBe("uvm_warning");
    expect(skip.accepted).toBe(true);
    expect(skip.message).toContain("is not up one level of hierarchy from this port");
    expect(checkConnect(t3, [], "drv.gp", "env.gp").kind).toBe("ok");
    expect(checkConnect(t3, [], "drv.gp", "agt.gp", { checkRelationships: true }).kind).toBe("ok");
  });

  it("uvm_analysis_port skips the relationship check entirely", () => {
    const r = checkConnect(topo, [], "mon.ap", "scb.item_imp", { checkRelationships: true });
    expect(r.kind).toBe("ok");
    expect(r.relationship.checked).toBe(false);
    expect(connectStatement(topo, "mon.ap", "scb.item_imp").reachesInside.sort()).toEqual(["agt", "chk_env"]);
  });
});

describe("uvm-tlm-model: resolve_bindings() min/max checks and BUILDERR", () => {
  it("an unconnected blocking_get_port (min_size 1) errors at end_of_elaboration, then BUILDERR fatal", () => {
    const e = elaborate(topo, [{ from: "mon.ap", to: "agt.ap" }]);
    const r = e.resolutions.get("chk.get_port");
    expect(r?.status).toBe("below-min");
    expect(r?.log).toBe("UVM_ERROR @ 0: uvm_test_top.env.chk.get_port [Connection Error] connection count of 0 does not meet required minimum of 1");
    expect(e.log[e.log.length - 1]).toBe(BUILDERR_LOG);
    expect(e.runStarts).toBe(false);
  });

  it("an unconnected analysis_port (min 0) and seq_item_port (min 0) are fine; an analysis_export (min 1) is not", () => {
    const res = resolveBindings(topo, []);
    expect(res.get("mon.ap")?.status).toBe("ok");
    expect(res.get("drv.seq_item_port")?.status).toBe("ok");
    expect(res.get("chk_env.analysis_export")?.message).toBe("connection count of 0 does not meet required minimum of 1");
  });

  it("a port with max_size 1 connected to two imps exceeds the maximum", () => {
    const t4: TlmTopology = {
      components: [...topo.components, { id: "fifo2", name: "fifo2", parent: "env", kind: "fifo", cls: "uvm_tlm_analysis_fifo #(bus_item)" }],
      endpoints: [...topo.endpoints, ...analysisFifoEndpoints("fifo2", "bus_item")],
    };
    const res = resolveBindings(t4, [
      { from: "chk.get_port", to: "fifo.get_export" },
      { from: "chk.get_port", to: "fifo2.get_export" },
    ]);
    expect(res.get("chk.get_port")?.message).toBe("connection count of 2 exceeds maximum of 1");
  });

  it("promotion chains resolve to the terminal imp: mon.ap → agt.ap → chk_env.analysis_export → scb.item_imp", () => {
    const e = elaborate(topo, [
      { from: "mon.ap", to: "agt.ap" },
      { from: "agt.ap", to: "chk_env.analysis_export" },
      { from: "chk_env.analysis_export", to: "scb.item_imp" },
      { from: "chk.get_port", to: "fifo.get_export" },
    ]);
    expect(e.resolutions.get("mon.ap")?.imps).toEqual(["scb.item_imp"]);
    expect(e.errorCount).toBe(0);
    expect(e.runStarts).toBe(true);
  });

  it("a connect() error alone is enough for BUILDERR even if every size check passes", () => {
    const e = elaborate(topo, [
      { from: "chk_env.analysis_export", to: "scb.item_imp" },
      { from: "chk.get_port", to: "fifo.get_export" },
      { from: "sqr.seq_item_export", to: "drv.seq_item_port" },
    ]);
    expect(e.errorCount).toBe(1);
    expect(e.buildErrorFatal).toBe(true);
  });

  it("a compile error means the run never starts and no UVM log is produced", () => {
    const e = elaborate(topo, [{ from: "drv.seq_item_port", to: "scb.item_imp" }]);
    expect(e.compiles).toBe(false);
    expect(e.runStarts).toBe(false);
    expect(e.log[0]).toMatch(/^Compile error:/);
  });
});

describe("uvm-tlm-model: analysis write() broadcast (uvm_analysis_port::write)", () => {
  const subs = ["scb.item_imp", "cov.analysis_export", "log.analysis_export"];

  it("calls imps in lexicographic full-name order (m_imp_list[string]), not connect() order", () => {
    const order = analysisCallOrder(
      topo,
      subs.map((to) => ({ from: "agt.ap", to })),
      "agt.ap",
    );
    // uvm_test_top.env.chk_env.scb.item_imp < uvm_test_top.env.cov.analysis_imp < uvm_test_top.env.log.analysis_imp
    expect(order).toEqual(["scb.item_imp", "cov.analysis_export", "log.analysis_export"]);
    const reversed = analysisCallOrder(
      topo,
      [...subs].reverse().map((to) => ({ from: "agt.ap", to })),
      "agt.ap",
    );
    expect(reversed).toEqual(order);
  });

  it("deduplicates an imp reached through two paths: it is written once", () => {
    const order = analysisCallOrder(
      topo,
      [
        { from: "mon.ap", to: "agt.ap" },
        { from: "mon.ap", to: "scb.item_imp" },
        { from: "agt.ap", to: "scb.item_imp" },
      ],
      "mon.ap",
    );
    expect(order).toEqual(["scb.item_imp"]);
  });

  it("all calls happen at the write time in one process; a mutating subscriber changes what later ones see", () => {
    const trace = broadcastTrace({
      topo,
      portId: "agt.ap",
      connectOrder: ["log.analysis_export", "cov.analysis_export"],
      txn: { addr: 16, data: 165 },
      time: 10,
      mutation: { impId: "cov.analysis_export", field: "data", to: 0 },
    });
    expect(trace.order).toEqual(["cov.analysis_export", "log.analysis_export"]);
    expect(new Set(trace.steps.map((s) => s.time))).toEqual(new Set([10]));
    const last = trace.steps[trace.steps.length - 1];
    expect(last.seen["cov.analysis_export"].data).toBe(165);
    expect(last.seen["log.analysis_export"].data).toBe(0);
    expect(trace.connectCode).toEqual(["agt.ap.connect(log.analysis_export);", "agt.ap.connect(cov.analysis_export);"]);
  });

  it("write() with zero subscribers is legal and does nothing", () => {
    const trace = broadcastTrace({ topo, portId: "agt.ap", connectOrder: [], txn: { data: 1 }, time: 10 });
    expect(trace.order).toEqual([]);
    expect(trace.steps).toHaveLength(2);
  });
});

describe("uvm-tlm-model: slow subscribers and the analysis FIFO", () => {
  it("a delay or a task call inside write() is a compile error (IEEE 1800-2023 §13.4 a/b)", () => {
    expect(slowSubscriberVerdict("delay-in-write")).toMatchObject({ compiles: false });
    expect(slowSubscriberVerdict("delay-in-write").rule).toContain("§13.4 (a)");
    expect(slowSubscriberVerdict("task-in-write").rule).toContain("§13.4 (b)");
    expect(slowSubscriberVerdict("analysis-fifo").compiles).toBe(true);
  });

  it("the unbounded analysis FIFO absorbs the backlog; the monitor never waits", () => {
    const sim = simulateAnalysisFifo({ writeTimes: [10, 20, 30, 40], serviceTime: 25, endOfTest: 45 });
    expect(sim.monitorWaitNs).toBe(0);
    expect(sim.items.map((i) => [i.startedAt, i.doneAt])).toEqual([
      [10, 35],
      [35, 60],
      [60, 85],
      [85, 110],
    ]);
    expect(sim.maxUsed).toBe(2);
    expect(sim.occupancy.find((o) => o.t === 30)?.used).toBe(2);
    expect(sim.occupancy.find((o) => o.t === 10)?.used).toBe(0);
    // Ending the test at 45 ns leaves items 2..4 unchecked.
    expect(sim.uncheckedAtEnd).toEqual([2, 3, 4]);
  });
});

describe("uvm-tlm-model: pull model (driver ↔ sequencer)", () => {
  it("port-to-imp completes the handshake; the item travels sequencer → driver", () => {
    const run = pullModelRun("port-to-imp");
    expect(run.ending).toBe("handshake-completes");
    const item = run.steps.find((s) => s.id === "item");
    expect(item?.edge).toBe("item");
    expect(run.steps.findIndex((s) => s.id === "gni")).toBeLessThan(run.steps.findIndex((s) => s.id === "item"));
  });

  it("reversed connect is a Connection Error and BUILDERR stops the run before run_phase", () => {
    const run = pullModelRun("imp-to-port");
    expect(run.ending).toBe("build-error-fatal");
    expect(run.elaboration.log).toContain(BUILDERR_LOG);
    expect(run.steps.some((s) => s.phase === "run_phase")).toBe(false);
  });

  it("a missing connect passes end_of_elaboration (seq_item_port min_size 0) and fails at the first get_next_item", () => {
    const run = pullModelRun("missing");
    expect(run.elaboration.errorCount).toBe(0);
    expect(run.ending).toBe("null-handle-at-get_next_item");
  });
});

describe("uvm-tlm-model: builder scenarios", () => {
  it.each(TLM_BUILDER_SCENARIOS.map((s) => [s.id, s] as const))("%s: the reference solution elaborates cleanly and meets every goal", (_id, s) => {
    const e = elaborate(s.topo, s.solution);
    expect(e.errorCount).toBe(0);
    expect(e.runStarts).toBe(true);
    expect(goalStatus(s.topo, e.connections, s.goals).every((g) => g.met)).toBe(true);
  });

  it("each broken preset fails the way its debug question claims", () => {
    const byId = Object.fromEntries(TLM_BUILDER_SCENARIOS.map((s) => [s.id, s]));
    const agent = elaborate(byId.agent.topo, byId.agent.broken);
    expect(agent.results[0].rule).toBe("imp-connect");
    expect(agent.buildErrorFatal).toBe(true);
    const fifo = elaborate(byId.fifo.topo, byId.fifo.broken);
    expect(fifo.resolutions.get("scb.get_port")?.status).toBe("below-min");
    expect(fifo.buildErrorFatal).toBe(true);
    const promo = elaborate(byId.promotion.topo, byId.promotion.broken);
    expect(promo.results.every((r) => r.accepted)).toBe(true);
    expect(promo.resolutions.get("chk_env.analysis_export")?.status).toBe("below-min");
    const crossed = elaborate(byId.imp_decl.topo, byId.imp_decl.broken);
    expect(crossed.compiles).toBe(false);
    expect(crossed.results.every((r) => r.kind === "compile_error")).toBe(true);
  });

  it("declarations include the imp_decl macros and the write_<suffix> methods", () => {
    const decl = declarationSource(TLM_BUILDER_SCENARIOS.find((s) => s.id === "imp_decl")!.topo);
    const scb = decl.find((d) => d.owner === "scb")!;
    expect(scb.lines[0]).toContain("`uvm_analysis_imp_decl(_exp)");
    expect(scb.lines.join("\n")).toContain("function void write_act(pkt_item t);");
  });
});
