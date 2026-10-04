import { describe, expect, it } from "vitest";

import {
  AGENT_PALETTE,
  agentClassSource,
  buildAgent,
  buildTestbench,
  gradeAgentMembership,
  testConfigSource,
  type AgentSetup,
} from "@/lib/uvm-agent-model";

// Source: uvm-core 2020.3.1 src/comps/uvm_agent.svh — is_active defaults to UVM_ACTIVE and is
// read from the resource pool inside uvm_agent::build_phase(); get_is_active() returns it.

const good = (name: string, configured: AgentSetup["configured"]): AgentSetup => ({
  name,
  configured,
  callsSuperBuild: true,
  guardsConnect: true,
});

describe("uvm-agent-model: active vs passive (uvm_agent.svh)", () => {
  it("with nothing configured, is_active keeps the UVM_ACTIVE default and builds sqr, drv, mon", () => {
    const a = buildAgent(good("in_agt", null));
    expect(a.effectiveMode).toBe("UVM_ACTIVE");
    expect(a.built).toEqual({ sqr: true, drv: true, mon: true });
  });

  it("UVM_PASSIVE builds only the monitor, and the guarded connect_phase skips the driver", () => {
    const a = buildAgent(good("out_agt", "UVM_PASSIVE"));
    expect(a.built).toEqual({ sqr: false, drv: false, mon: true });
    expect(a.connects).toEqual(["mon.ap.connect(ap);"]);
    expect(a.connectFailure).toBeNull();
  });

  it("skipping super.build_phase() ignores the config: a 'passive' agent still builds a driver", () => {
    const a = buildAgent({ ...good("out_agt", "UVM_PASSIVE"), callsSuperBuild: false });
    expect(a.effectiveMode).toBe("UVM_ACTIVE");
    expect(a.configHonored).toBe(false);
    expect(a.built.drv).toBe(true);
    expect(a.modeReason).toMatch(/skips super\.build_phase/);
  });

  it("an unguarded connect_phase in a passive agent dereferences the null drv handle", () => {
    const a = buildAgent({ ...good("out_agt", "UVM_PASSIVE"), guardsConnect: false });
    expect(a.connectFailure).toMatch(/drv is null/);
    const tb = buildTestbench(good("in_agt", null), { ...good("out_agt", "UVM_PASSIVE"), guardsConnect: false });
    expect(tb.outcome).toBe("fatal");
    expect(tb.envConnects).toEqual([]);
  });

  it("an unguarded connect_phase is harmless while the agent is active", () => {
    expect(buildAgent({ ...good("in_agt", "UVM_ACTIVE"), guardsConnect: false }).connectFailure).toBeNull();
  });

  it("the clean testbench connects both agent ports to the two-input scoreboard", () => {
    const tb = buildTestbench(good("in_agt", null), good("out_agt", "UVM_PASSIVE"));
    expect(tb.outcome).toBe("ok");
    expect(tb.envConnects).toEqual(["in_agt.ap.connect(scb.exp_imp);", "out_agt.ap.connect(scb.act_imp);"]);
  });

  it("an active out_agt is flagged because it drives an interface the DUT owns", () => {
    const tb = buildTestbench(good("in_agt", null), good("out_agt", null));
    expect(tb.outcome).toBe("warning");
  });

  it("generated code follows the setup (super call, guard)", () => {
    const src = agentClassSource({ ...good("out_agt", "UVM_PASSIVE"), callsSuperBuild: false, guardsConnect: false }).map((l) => l.text);
    expect(src.join("\n")).toContain("// super.build_phase(phase);");
    expect(src.join("\n")).not.toContain("if (get_is_active() == UVM_ACTIVE)\n");
    expect(testConfigSource(good("in_agt", null), good("out_agt", "UVM_PASSIVE"))).toContain(
      'uvm_config_db#(uvm_active_passive_enum)::set(this, "env.out_agt", "is_active", UVM_PASSIVE);',
    );
  });
});

describe("uvm-agent-model: membership grading (order is never graded)", () => {
  it("sequencer + driver + monitor is a perfect active agent in any order", () => {
    expect(gradeAgentMembership(["sequencer", "driver", "monitor"], "UVM_ACTIVE").score).toBe(100);
    expect(gradeAgentMembership(["monitor", "driver", "sequencer"], "UVM_ACTIVE").passed).toBe(true);
  });

  it("a passive agent must not contain a driver or sequencer", () => {
    const g = gradeAgentMembership(["sequencer", "driver", "monitor"], "UVM_PASSIVE");
    expect(g.passed).toBe(false);
    expect(g.misplaced).toEqual(["Sequencer", "Driver"]);
    expect(gradeAgentMembership(["monitor"], "UVM_PASSIVE").passed).toBe(true);
  });

  it("config object and coverage subscriber are optional; scoreboard, virtual sequencer and sequence are not agent children", () => {
    expect(gradeAgentMembership(["sequencer", "driver", "monitor", "config", "coverage"], "UVM_ACTIVE").passed).toBe(true);
    const g = gradeAgentMembership(["sequencer", "driver", "monitor", "scoreboard", "sequence"], "UVM_ACTIVE");
    expect(g.misplaced).toEqual(["Scoreboard", "Sequence"]);
    expect(g.score).toBe(Math.round((6 / AGENT_PALETTE.length) * 100));
  });

  it("a missing monitor is reported in both modes", () => {
    expect(gradeAgentMembership(["sequencer", "driver"], "UVM_ACTIVE").missing).toEqual(["Monitor"]);
    expect(gradeAgentMembership([], "UVM_PASSIVE").missing).toEqual(["Monitor"]);
  });
});
