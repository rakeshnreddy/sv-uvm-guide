import { describe, expect, it } from "vitest";

import {
  PASS_MESSAGE,
  SCB_GIVEN,
  SCB_GOALS,
  SCB_SOLUTION,
  SCB_TOPOLOGY,
  attemptConnection,
  callOrderPrediction,
  classifyConnection,
  connectPhaseSource,
  endpointRef,
  gradeWiring,
  writeCallOrder,
} from "@/lib/scoreboard-connector-exercise";
import { endpointFullName, findEndpoint } from "@/lib/uvm-tlm-model";

// UVM rules come from the shared TLM model (uvm-core 2020.3.1): uvm_port_base::connect(),
// resolve_bindings(), uvm_analysis_port::write(), uvm_subscriber, uvm_tlm_analysis_fifo.

const without = (key: string) => SCB_SOLUTION.filter((c) => `${c.from}->${c.to}` !== key);

describe("scoreboard-connector-exercise: topology", () => {
  it("analysis_export of uvm_subscriber and of uvm_tlm_analysis_fifo are imps (uvm_subscriber names it 'analysis_imp')", () => {
    const prd = findEndpoint(SCB_TOPOLOGY, "prd.analysis_export");
    expect(prd.role).toBe("imp");
    expect(endpointFullName(SCB_TOPOLOGY, prd)).toBe("uvm_test_top.env.prd.analysis_imp");
    const fifo = findEndpoint(SCB_TOPOLOGY, "expected_fifo.analysis_export");
    expect(fifo.role).toBe("imp");
    expect(endpointFullName(SCB_TOPOLOGY, fifo)).toBe("uvm_test_top.env.scb.expected_fifo.analysis_export");
  });

  it("endpoints are referenced as bus_env writes them", () => {
    expect(endpointRef("mon.ap")).toBe("agt.mon.ap");
    expect(endpointRef("actual_fifo.analysis_export")).toBe("scb.actual_fifo.analysis_export");
    expect(endpointRef("prd.ap")).toBe("prd.ap");
  });
});

describe("scoreboard-connector-exercise: one connect() attempt", () => {
  it("port.connect(imp) is accepted and written in bus_env", () => {
    const a = attemptConnection([], "mon.ap", "prd.analysis_export");
    expect(a.outcome).toBe("connected");
    expect(a.recorded).toBe(true);
    expect(a.code).toBe("agt.mon.ap.connect(prd.analysis_export);");
    expect(a.result.statement.writer).toBe("env");
  });

  it("wrong direction: fifo.analysis_export.connect(mon.ap) is uvm-core's imp-connect UVM_ERROR, with the reversed call as the fix", () => {
    const a = attemptConnection([], "actual_fifo.analysis_export", "mon.ap");
    expect(a.outcome).toBe("rejected");
    expect(a.recorded).toBe(false);
    expect(a.mistake).toBe("wrong-direction");
    expect(a.result.rule).toBe("imp-connect");
    expect(a.result.log).toContain("[Connection Error] Cannot call an imp port's connect method");
    expect(a.code).toBe("scb.actual_fifo.analysis_export.connect(agt.mon.ap);");
    expect(a.fix).toBe("agt.mon.ap.connect(scb.actual_fifo.analysis_export);");
    expect(a.why).toMatch(/named like an export, but its type is uvm_analysis_imp/);
    expect(a.why).toMatch(/^Wrong direction: /);
  });

  it("wrong direction on the given pair still points at the correct call", () => {
    const a = attemptConnection([], "sqr.seq_item_export", "drv.seq_item_port");
    expect(a.mistake).toBe("wrong-direction");
    expect(a.fix).toBe("drv.seq_item_port.connect(sqr.seq_item_export);");
  });

  it("analysis to a seq_item export is a compile error: different interface classes (uvm_tlm_if_base vs uvm_sqr_if_base)", () => {
    const a = attemptConnection([], "mon.ap", "sqr.seq_item_export");
    expect(a.outcome).toBe("rejected");
    expect(a.result.kind).toBe("compile_error");
    expect(a.mistake).toBe("seq-item-mismatch");
    expect(a.why).toMatch(/different interface classes/);
    expect(a.why).toMatch(/agt\.sqr\.seq_item_export carries the sequencer pull interface/);
    expect(attemptConnection([], "drv.seq_item_port", "cov.analysis_export").mistake).toBe("seq-item-mismatch");
  });

  it("monitor ap straight into expected_fifo: UVM accepts it (analysis ports skip the hierarchy check) but the exercise flags it", () => {
    const a = attemptConnection([], "mon.ap", "expected_fifo.analysis_export");
    expect(a.result.accepted).toBe(true);
    expect(a.result.relationship.checked).toBe(false);
    expect(a.outcome).toBe("flagged");
    expect(a.recorded).toBe(true);
    expect(a.mistake).toBe("raw-to-expected");
    expect(a.why).toMatch(/^UVM accepts this connect\(\)/);
    expect(a.why).toMatch(/compares the DUT with itself/);
  });

  it("port.connect(port) between unrelated analysis ports merges streams and names where they would go", () => {
    const a = attemptConnection([{ from: "prd.ap", to: "expected_fifo.analysis_export" }], "mon.ap", "prd.ap");
    expect(a.result.accepted).toBe(true);
    expect(a.mistake).toBe("port-to-port");
    expect(a.why).toContain("agt.mon.ap's items would also reach scb.expected_fifo.analysis_export");
  });

  it("predictions into actual_fifo, coverage or the predictor itself are flagged", () => {
    expect(attemptConnection([], "prd.ap", "actual_fifo.analysis_export").mistake).toBe("prediction-to-actual");
    expect(attemptConnection([], "prd.ap", "cov.analysis_export").mistake).toBe("prediction-to-coverage");
    expect(attemptConnection([], "prd.ap", "prd.analysis_export").mistake).toBe("feedback-loop");
  });

  it("repeating the agent's given connect() is a no-op duplicate", () => {
    const a = attemptConnection([], "drv.seq_item_port", "sqr.seq_item_export");
    expect(a.outcome).toBe("duplicate");
    expect(a.recorded).toBe(false);
    expect(a.why).toMatch(/bus_agent::connect_phase already makes this call/);
  });
});

describe("scoreboard-connector-exercise: grading", () => {
  it("the reference solution passes every goal with score 100, and UVM agrees", () => {
    const g = gradeWiring(SCB_SOLUTION);
    expect(g.passed).toBe(true);
    expect(g.score).toBe(100);
    expect(g.goals.every((x) => x.met)).toBe(true);
    expect(g.connections.map((c) => c.status)).toEqual(["serves", "serves", "serves", "serves"]);
    expect(g.elaboration.runStarts).toBe(true);
    expect(g.message).toBe(PASS_MESSAGE);
  });

  it("an unconnected goal fails the check although UVM is silent (uvm_analysis_port min_size 0)", () => {
    const g = gradeWiring(without("prd.ap->expected_fifo.analysis_export"));
    expect(g.passed).toBe(false);
    expect(g.score).toBe(75);
    expect(g.goals.find((x) => x.id === "expected")?.met).toBe(false);
    expect(g.elaboration.runStarts).toBe(true);
    expect(g.elaboration.resolutions.get("prd.ap")).toMatchObject({ size: 0, status: "ok" });
    expect(g.uvmVerdict).toMatch(/without a single message/);
  });

  it("a wrong stream fails the check even when every goal is met", () => {
    const g = gradeWiring([...SCB_SOLUTION, { from: "mon.ap", to: "expected_fifo.analysis_export" }]);
    expect(g.goals.every((x) => x.met)).toBe(true);
    expect(g.passed).toBe(false);
    expect(g.score).toBe(75);
    expect(g.wrongCount).toBe(1);
    expect(g.forbiddenReached.map((f) => f.mistake)).toEqual(["raw-to-expected"]);
    expect(g.message).toBe("Not yet: 1 connect() call feeds the wrong stream.");
  });

  it("a port-to-port merge is caught by reach too: mon.ap reaches expected_fifo through prd.ap", () => {
    const g = gradeWiring([...SCB_SOLUTION, { from: "mon.ap", to: "prd.ap" }]);
    expect(g.passed).toBe(false);
    expect(g.forbiddenReached.map((f) => f.mistake)).toContain("raw-to-expected");
    expect(g.connections.find((c) => c.to === "prd.ap")?.mistake).toBe("port-to-port");
    // The legitimate prd.ap → expected_fifo call is not blamed for the merge.
    expect(g.connections.find((c) => c.from === "prd.ap")?.status).toBe("serves");
  });

  it("empty wiring scores 0 and names each missing goal", () => {
    const g = gradeWiring([]);
    expect(g.score).toBe(0);
    expect(g.goals.filter((x) => !x.met)).toHaveLength(SCB_GOALS.length);
  });

  it("the given driver-sequencer connection is classified as given, not graded", () => {
    expect(classifyConnection(SCB_GIVEN, SCB_GIVEN[0]).status).toBe("given");
  });
});

describe("scoreboard-connector-exercise: generated code and call order", () => {
  it("connect_phase lines are generated per class, bus_env first, in connect() order", () => {
    const lines = connectPhaseSource(SCB_SOLUTION).map((l) => l.text);
    expect(lines).toEqual([
      "// bus_env::connect_phase",
      "agt.mon.ap.connect(prd.analysis_export);",
      "agt.mon.ap.connect(scb.actual_fifo.analysis_export);",
      "agt.mon.ap.connect(cov.analysis_export);",
      "prd.ap.connect(scb.expected_fifo.analysis_export);",
      "// bus_agent::connect_phase (already written)",
      "drv.seq_item_port.connect(sqr.seq_item_export);",
    ]);
    expect(connectPhaseSource([]).map((l) => l.text).slice(0, 2)).toEqual(["// bus_env::connect_phase", "// (no connect() calls yet)"]);
  });

  it("write() order is by full name (cov < prd < scb), not connect() order, with the predictor's write nested", () => {
    const calls = writeCallOrder(SCB_SOLUTION);
    expect(calls.map((c) => [c.index, c.call])).toEqual([
      ["1", "cov.write(t)"],
      ["2", "prd.write(t)"],
      ["2.1", "scb.expected_fifo.write(exp)"],
      ["3", "scb.actual_fifo.write(t)"],
    ]);
    const reversed = writeCallOrder([...SCB_SOLUTION].reverse());
    expect(reversed.map((c) => c.imp)).toEqual(calls.map((c) => c.imp));
  });

  it("a predictor feedback loop does not make the call-order walk recurse forever", () => {
    const calls = writeCallOrder([...SCB_SOLUTION, { from: "prd.ap", to: "prd.analysis_export" }]);
    expect(calls.length).toBeLessThan(10);
  });

  it("the call-order prediction marks cov first as the only correct option", () => {
    const options = callOrderPrediction(SCB_SOLUTION);
    expect(options.filter((o) => o.correct).map((o) => o.id)).toEqual(["cov"]);
  });
});
