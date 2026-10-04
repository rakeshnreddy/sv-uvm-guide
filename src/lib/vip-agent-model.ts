/**
 * What an agent builds in active and passive mode, checked against uvm-core
 * 2020.3.1 src/comps/uvm_agent.svh (IEEE 1800.2-2020 §13.4):
 * - `uvm_agent::is_active` defaults to UVM_ACTIVE.
 * - `uvm_agent::build_phase` looks up an "is_active" resource for the agent
 *   (what `uvm_config_db#(uvm_active_passive_enum)::set(…, "is_active", …)`
 *   creates) and copies it into `is_active`. A derived agent that does not call
 *   super.build_phase never reads that setting.
 * - `get_is_active()` (§13.4.2.2) returns `is_active`.
 *
 * The agent code below builds the monitor and coverage collector always, and
 * the driver and sequencer only when get_is_active() == UVM_ACTIVE, so in
 * passive mode their handles stay null. Consequences that are modelled:
 * - connect_phase reading driver.seq_item_port while driver is null is a
 *   null-handle access (IEEE 1800-2023 §8.4);
 * - starting a sequence on the null sequencer fails at its first start_item()
 *   with UVM_FATAL [SEQ] (uvm-core src/seq/uvm_sequence_base.svh).
 */

export type ActiveMode = "UVM_ACTIVE" | "UVM_PASSIVE";
export type Level = "block" | "soc";

export interface AgentBuildConfig {
  level: Level;
  /** The agent's build_phase calls super.build_phase(phase). */
  callsSuperBuild: boolean;
  /** connect_phase connects driver and sequencer only when active. */
  guardedConnect: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentBuildConfig = { level: "block", callsSuperBuild: true, guardedConnect: true };

export type AgentPart = "monitor" | "coverage" | "driver" | "sequencer";

export interface AgentPartResult {
  part: AgentPart;
  exists: boolean;
  why: string;
}

export interface AgentBuildResult {
  config: AgentBuildConfig;
  /** What the test asked for through config_db. */
  requested: ActiveMode;
  /** What get_is_active() returns after build_phase. */
  isActive: ActiveMode;
  parts: AgentPartResult[];
  connect: { ok: boolean; message: string };
  /** Who drives the SPI-side APB bus during run_phase. */
  busDriver: "uvm-driver" | "cpu" | "contention";
  /** Result of starting a sequence on spi_agent.sequencer. */
  sequenceStart: { ok: boolean; message: string };
  summary: string;
}

export function buildAgent(config: AgentBuildConfig): AgentBuildResult {
  const requested: ActiveMode = config.level === "soc" ? "UVM_PASSIVE" : "UVM_ACTIVE";
  // Without super.build_phase the "is_active" setting is never read: the field keeps its default.
  const isActive: ActiveMode = config.callsSuperBuild ? requested : "UVM_ACTIVE";
  const active = isActive === "UVM_ACTIVE";
  const parts: AgentPartResult[] = [
    { part: "monitor", exists: true, why: "Built in every mode: it only watches the pins and publishes items." },
    { part: "coverage", exists: true, why: "Built in every mode: it subscribes to the monitor." },
    {
      part: "driver",
      exists: active,
      why: active ? "get_is_active() is UVM_ACTIVE, so the driver is created." : "Never constructed: the handle stays null. It is not a disabled driver; there is no object.",
    },
    {
      part: "sequencer",
      exists: active,
      why: active ? "Created with the driver." : "Never constructed: spi_agent.sequencer is null.",
    },
  ];
  const connect = active || config.guardedConnect
    ? { ok: true, message: active ? "driver.seq_item_port.connect(sequencer.seq_item_export)" : "Skipped: the if (get_is_active() == UVM_ACTIVE) guard is false." }
    : { ok: false, message: "Null object access in connect_phase: driver is null, so driver.seq_item_port cannot be read (IEEE 1800-2023 §8.4)." };
  const busDriver = config.level === "block" ? "uvm-driver" : active ? "contention" : "cpu";
  const sequenceStart = active
    ? { ok: true, message: "seq.start(spi_agent.sequencer) runs: the driver pulls items from it." }
    : {
        ok: false,
        message:
          "UVM_FATAL [SEQ] neither the item's sequencer nor dedicated sequencer has been supplied to start item: the sequencer handle is null.",
      };
  let summary: string;
  if (!connect.ok) summary = "Elaboration stops in connect_phase: an unguarded connect reads a member of the null driver handle.";
  else if (config.level === "soc" && active)
    summary = "The agent stayed ACTIVE: without super.build_phase(), uvm_agent never read the is_active setting. Its driver and the CPU now both drive the bus.";
  else if (config.level === "soc") summary = "Passive: only the monitor and coverage exist. The CPU drives the bus; the monitor still turns its traffic into items for checks and coverage.";
  else summary = "Active: the sequencer feeds the driver, the driver wiggles the pins, and the monitor reports what really happened.";
  return { config, requested, isActive, parts, connect, busDriver, sequenceStart, summary };
}

/** Test and agent code for the configuration, generated from the same data. */
export function agentSource(config: AgentBuildConfig): { text: string; key?: string }[] {
  const mode = config.level === "soc" ? "UVM_PASSIVE" : "UVM_ACTIVE";
  const lines: { text: string; key?: string }[] = [
    { text: `// ${config.level === "soc" ? "soc_test" : "block_test"}::build_phase` },
    { text: `uvm_config_db#(uvm_active_passive_enum)::set(this, "env.spi_agent", "is_active", ${mode});`, key: "set" },
    { text: "" },
    { text: "class spi_agent extends uvm_agent;" },
    { text: "  function void build_phase(uvm_phase phase);" },
    config.callsSuperBuild
      ? { text: "    super.build_phase(phase);   // uvm_agent reads \"is_active\" here", key: "super" }
      : { text: "    // super.build_phase(phase) missing: \"is_active\" is never read", key: "super" },
    { text: '    monitor  = spi_monitor::type_id::create("monitor", this);', key: "monitor" },
    { text: '    coverage = spi_coverage::type_id::create("coverage", this);', key: "coverage" },
    { text: "    if (get_is_active() == UVM_ACTIVE) begin", key: "if" },
    { text: '      driver    = spi_driver::type_id::create("driver", this);', key: "driver" },
    { text: '      sequencer = spi_sequencer::type_id::create("sequencer", this);', key: "driver" },
    { text: "    end" },
    { text: "  endfunction" },
    { text: "  function void connect_phase(uvm_phase phase);" },
    { text: "    monitor.ap.connect(coverage.analysis_export);" },
  ];
  if (config.guardedConnect) {
    lines.push({ text: "    if (get_is_active() == UVM_ACTIVE)", key: "connect" });
    lines.push({ text: "      driver.seq_item_port.connect(sequencer.seq_item_export);", key: "connect" });
  } else {
    lines.push({ text: "    driver.seq_item_port.connect(sequencer.seq_item_export);   // no guard", key: "connect" });
  }
  lines.push({ text: "  endfunction" }, { text: "endclass" });
  return lines;
}
