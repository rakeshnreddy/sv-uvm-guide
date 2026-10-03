import { describe, expect, it } from "vitest";

import { DEFAULT_AGENT_CONFIG, agentSource, buildAgent } from "@/lib/vip-agent-model";

describe("vip-agent-model (uvm-core src/comps/uvm_agent.svh)", () => {
  it("active: monitor, coverage, driver and sequencer all exist", () => {
    const r = buildAgent(DEFAULT_AGENT_CONFIG);
    expect(r.isActive).toBe("UVM_ACTIVE");
    expect(r.parts.every((p) => p.exists)).toBe(true);
  });

  it("passive: driver and sequencer are never constructed (null handles), monitor and coverage remain", () => {
    const r = buildAgent({ ...DEFAULT_AGENT_CONFIG, level: "soc" });
    expect(r.isActive).toBe("UVM_PASSIVE");
    expect(r.parts.filter((p) => p.exists).map((p) => p.part)).toEqual(["monitor", "coverage"]);
    expect(r.busDriver).toBe("cpu");
    expect(r.sequenceStart.message).toMatch(/UVM_FATAL \[SEQ\]/);
  });

  it("uvm_agent::build_phase reads is_active; skipping super.build_phase leaves the default UVM_ACTIVE", () => {
    const r = buildAgent({ ...DEFAULT_AGENT_CONFIG, level: "soc", callsSuperBuild: false });
    expect(r.isActive).toBe("UVM_ACTIVE");
    expect(r.busDriver).toBe("contention");
  });

  it("an unguarded driver/sequencer connect is a null-handle access in passive mode", () => {
    const r = buildAgent({ ...DEFAULT_AGENT_CONFIG, level: "soc", guardedConnect: false });
    expect(r.connect.ok).toBe(false);
    expect(r.connect.message).toMatch(/Null object access/);
    expect(buildAgent({ ...DEFAULT_AGENT_CONFIG, guardedConnect: false }).connect.ok).toBe(true);
  });

  it("generated code sets is_active through config_db and branches on get_is_active()", () => {
    const text = agentSource({ ...DEFAULT_AGENT_CONFIG, level: "soc" }).map((l) => l.text).join("\n");
    expect(text).toContain('uvm_config_db#(uvm_active_passive_enum)::set(this, "env.spi_agent", "is_active", UVM_PASSIVE);');
    expect(text).toContain("if (get_is_active() == UVM_ACTIVE) begin");
  });
});
