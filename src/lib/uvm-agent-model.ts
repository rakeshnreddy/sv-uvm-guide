/**
 * Deterministic model of UVM agent topology: what an agent builds in active vs passive
 * mode, and which agent-construction mistakes break the build.
 *
 * Verified against uvm-core 2020.3.1 (github.com/accellera-official/uvm-core, tag 2020.3.1):
 * - src/comps/uvm_agent.svh (IEEE 1800.2-2020 §13.4 per the source's @uvm-ieee annotation):
 *   - `uvm_active_passive_enum is_active = UVM_ACTIVE;` — the default is ACTIVE.
 *   - uvm_agent::build_phase() (§13.4.2.1) looks up "is_active" for get_full_name() in the
 *     resource pool and stores it. A subclass that overrides build_phase without calling
 *     super.build_phase() never performs that lookup, so a config_db setting is ignored.
 *   - get_is_active() (§13.4.2.2) returns is_active.
 * - src/macros/uvm_resource_defines.svh: `uvm_resource_enum_read accepts the setting as the
 *   enum type, as its name string, or as an integral value.
 * - src/comps/uvm_driver.svh (§13.7.1): seq_item_port is a uvm_seq_item_pull_port.
 * - A connect_phase that dereferences a handle that was never created (drv is null in a
 *   passive agent) is a null object access: a simulator runtime error (IEEE 1800-2023 §8.4),
 *   whose message is tool-specific.
 */

export type ActiveMode = "UVM_ACTIVE" | "UVM_PASSIVE";

export interface AgentSetup {
  /** Instance name, e.g. "in_agt". */
  name: string;
  /** What the test sets through uvm_config_db; null means nothing is set. */
  configured: ActiveMode | null;
  /** Does the agent's build_phase call super.build_phase(phase)? */
  callsSuperBuild: boolean;
  /** Does connect_phase guard the driver connection with get_is_active()? */
  guardsConnect: boolean;
}

export type AgentChild = "sqr" | "drv" | "mon";

export interface AgentBuild {
  name: string;
  /** Value get_is_active() returns. */
  effectiveMode: ActiveMode;
  /** True when the configured mode (if any) took effect. */
  configHonored: boolean;
  built: Record<AgentChild, boolean>;
  /** connect() calls the agent makes, as code. */
  connects: string[];
  /** Set when connect_phase dereferences a null handle. */
  connectFailure: string | null;
  /** Why the agent ended up in its mode. */
  modeReason: string;
}

export function buildAgent(setup: AgentSetup): AgentBuild {
  const configHonored = setup.configured === null || setup.callsSuperBuild;
  const effectiveMode: ActiveMode = setup.callsSuperBuild && setup.configured ? setup.configured : "UVM_ACTIVE";
  const active = effectiveMode === "UVM_ACTIVE";
  const built: Record<AgentChild, boolean> = { mon: true, sqr: active, drv: active };

  const connects = ["mon.ap.connect(ap);"];
  let connectFailure: string | null = null;
  if (active || !setup.guardsConnect) {
    connects.push("drv.seq_item_port.connect(sqr.seq_item_export);");
    if (!active) {
      connectFailure = `${setup.name}.connect_phase: drv is null (never created in a passive agent). The simulator stops on a null object access; the message text is tool-specific.`;
    }
  }

  let modeReason: string;
  if (setup.configured === null) {
    modeReason = "Nothing was set, so is_active keeps uvm_agent's default, UVM_ACTIVE.";
  } else if (!setup.callsSuperBuild) {
    modeReason = `The test set ${setup.configured}, but build_phase skips super.build_phase(), so uvm_agent never looks it up. is_active keeps its default, UVM_ACTIVE.`;
  } else {
    modeReason = `super.build_phase() read "is_active" = ${setup.configured} from the config database before the children were created.`;
  }

  return { name: setup.name, effectiveMode, configHonored, built, connects, connectFailure, modeReason };
}

export interface TestbenchBuild {
  agents: AgentBuild[];
  /** env-level connections that are made. */
  envConnects: string[];
  /** UVM-style log, build through connect. */
  log: string[];
  outcome: "ok" | "warning" | "fatal";
  /** Short verdict sentence. */
  verdict: string;
}

/**
 * env with an input-side agent (in_agt) and an output-side agent (out_agt) feeding a
 * two-input scoreboard. out_agt watches signals the DUT drives, so it must be passive.
 */
export function buildTestbench(inAgt: AgentSetup, outAgt: AgentSetup): TestbenchBuild {
  const agents = [buildAgent(inAgt), buildAgent(outAgt)];
  const log: string[] = [];
  for (const [setup, a] of [
    [inAgt, agents[0]],
    [outAgt, agents[1]],
  ] as const) {
    if (setup.configured) {
      log.push(`UVM_INFO @ 0: uvm_test_top [CFG] set ${a.name}.is_active = ${setup.configured}`);
    }
    const children = (["sqr", "drv", "mon"] as AgentChild[]).filter((c) => a.built[c]);
    log.push(`UVM_INFO @ 0: uvm_test_top.env.${a.name} [BUILD] get_is_active() = ${a.effectiveMode}; built ${children.join(", ")}`);
  }
  const failure = agents.find((a) => a.connectFailure);
  if (failure) {
    log.push(`Fatal (simulator): null object access in uvm_test_top.env.${failure.name}.connect_phase`);
    return {
      agents,
      envConnects: [],
      log,
      outcome: "fatal",
      verdict: failure.connectFailure ?? "",
    };
  }
  const envConnects = ["in_agt.ap.connect(scb.exp_imp);", "out_agt.ap.connect(scb.act_imp);"];
  const outActive = agents[1].effectiveMode === "UVM_ACTIVE";
  if (outActive) {
    log.push(
      "UVM_WARNING @ 0: uvm_test_top.env.out_agt [TOPOLOGY] out_agt is active: its driver starts in run_phase on signals the DUT drives (model check, not a UVM message)",
    );
    return {
      agents,
      envConnects,
      log,
      outcome: "warning",
      verdict: agents[1].configHonored
        ? "out_agt is active, so it builds a driver for an interface the DUT drives. A driver there usually drives idle values onto the DUT's outputs: contention or X."
        : "out_agt was configured passive but still built a driver, because super.build_phase() was skipped. A driver there usually drives idle values onto the DUT's outputs: contention or X.",
    };
  }
  return {
    agents,
    envConnects,
    log,
    outcome: "ok",
    verdict: "Both agents publish through their ap; only in_agt can generate stimulus.",
  };
}

/** Agent class source generated from the setup, so the code matches what the model ran. */
export function agentClassSource(setup: AgentSetup): { key: string; text: string }[] {
  return [
    { key: "class", text: "class bus_agent extends uvm_agent;" },
    { key: "utils", text: "  `uvm_component_utils(bus_agent)" },
    { key: "decl-sqr", text: "  bus_sequencer sqr;" },
    { key: "decl-drv", text: "  bus_driver    drv;" },
    { key: "decl-mon", text: "  bus_monitor   mon;" },
    { key: "decl-ap", text: "  uvm_analysis_port #(bus_item) ap;" },
    { key: "", text: "" },
    { key: "new", text: "  function new(string name, uvm_component parent);" },
    { key: "new-super", text: "    super.new(name, parent);" },
    { key: "new-end", text: "  endfunction" },
    { key: "", text: "" },
    { key: "build", text: "  function void build_phase(uvm_phase phase);" },
    {
      key: "build-super",
      text: setup.callsSuperBuild
        ? "    super.build_phase(phase);   // reads is_active from config_db"
        : "    // super.build_phase(phase);   <- missing",
    },
    { key: "build-ap", text: '    ap  = new("ap", this);' },
    { key: "build-mon", text: '    mon = bus_monitor::type_id::create("mon", this);' },
    { key: "build-if", text: "    if (get_is_active() == UVM_ACTIVE) begin" },
    { key: "build-sqr", text: '      sqr = bus_sequencer::type_id::create("sqr", this);' },
    { key: "build-drv", text: '      drv = bus_driver::type_id::create("drv", this);' },
    { key: "build-endif", text: "    end" },
    { key: "build-end", text: "  endfunction" },
    { key: "", text: "" },
    { key: "connect", text: "  function void connect_phase(uvm_phase phase);" },
    { key: "connect-mon", text: "    mon.ap.connect(ap);   // promote the monitor's port" },
    ...(setup.guardsConnect
      ? [
          { key: "connect-if", text: "    if (get_is_active() == UVM_ACTIVE)" },
          { key: "connect-drv", text: "      drv.seq_item_port.connect(sqr.seq_item_export);" },
        ]
      : [{ key: "connect-drv", text: "    drv.seq_item_port.connect(sqr.seq_item_export);   // no guard" }]),
    { key: "connect-end", text: "  endfunction" },
    { key: "endclass", text: "endclass" },
  ];
}

export function testConfigSource(inAgt: AgentSetup, outAgt: AgentSetup): string[] {
  const lines = ["// bus_test::build_phase, before env is created"];
  for (const s of [inAgt, outAgt]) {
    if (s.configured) {
      lines.push(`uvm_config_db#(uvm_active_passive_enum)::set(this, "env.${s.name}", "is_active", ${s.configured});`);
    }
  }
  if (lines.length === 1) lines.push("// no is_active settings: every agent defaults to UVM_ACTIVE");
  lines.push('env = bus_env::type_id::create("env", this);');
  return lines;
}

// ── Agent membership exercise ───────────────────────────────────────────────

export type AgentPaletteId =
  | "sequencer"
  | "driver"
  | "monitor"
  | "config"
  | "coverage"
  | "scoreboard"
  | "virtual_sequencer"
  | "sequence";

export interface PaletteItem {
  id: AgentPaletteId;
  name: string;
  cls: string;
}

export const AGENT_PALETTE: PaletteItem[] = [
  { id: "sequencer", name: "Sequencer", cls: "uvm_sequencer #(bus_item)" },
  { id: "driver", name: "Driver", cls: "uvm_driver #(bus_item)" },
  { id: "monitor", name: "Monitor", cls: "uvm_monitor" },
  { id: "config", name: "Agent config object", cls: "bus_agent_cfg (uvm_object)" },
  { id: "coverage", name: "Coverage subscriber", cls: "uvm_subscriber #(bus_item)" },
  { id: "scoreboard", name: "Scoreboard", cls: "uvm_scoreboard" },
  { id: "virtual_sequencer", name: "Virtual sequencer", cls: "uvm_sequencer (virtual)" },
  { id: "sequence", name: "Sequence", cls: "uvm_sequence #(bus_item)" },
];

export type Expectation = "required" | "forbidden" | "optional";

function expectationFor(id: AgentPaletteId, mode: ActiveMode): { expect: Expectation; reason: string } {
  switch (id) {
    case "monitor":
      return { expect: "required", reason: "Every agent observes its interface, active or passive. The monitor feeds the agent's analysis port." };
    case "sequencer":
      return mode === "UVM_ACTIVE"
        ? { expect: "required", reason: "An active agent needs a sequencer: sequences run on it and it arbitrates their items." }
        : { expect: "forbidden", reason: "A passive agent only observes. It builds no sequencer, so no sequence can run on it." };
    case "driver":
      return mode === "UVM_ACTIVE"
        ? { expect: "required", reason: "An active agent needs a driver to pull items with get_next_item() and drive the pins." }
        : { expect: "forbidden", reason: "A passive agent must not build a driver: the interface is driven by someone else (often the DUT)." };
    case "config":
      return { expect: "optional", reason: "A config object (is_active, vif, coverage enable) is common but optional. It is a uvm_object the agent holds, not a child component." };
    case "coverage":
      return { expect: "optional", reason: "Many VIPs put a coverage subscriber inside the agent, enabled by a config bit. Placing it in the env is equally valid." };
    case "scoreboard":
      return { expect: "forbidden", reason: "A scoreboard compares streams from several agents or a reference model, so it lives in the env. Agents stay reusable on their own." };
    case "virtual_sequencer":
      return { expect: "forbidden", reason: "A virtual sequencer coordinates several agents' sequencers, so it lives in the env (or test)." };
    case "sequence":
      return { expect: "forbidden", reason: "A sequence is a transient object started on a sequencer by the test or a virtual sequence. It is not a child component." };
  }
}

export interface AgentVerdict {
  id: AgentPaletteId;
  name: string;
  placedInAgent: boolean;
  expectation: Expectation;
  correct: boolean;
  reason: string;
}

export interface AgentGrade {
  mode: ActiveMode;
  /** Percentage of palette items placed correctly (in or out). Order is never graded. */
  score: number;
  passed: boolean;
  verdicts: AgentVerdict[];
  missing: string[];
  misplaced: string[];
}

/** Grades membership only. UVM imposes no order on an agent's children. */
export function gradeAgentMembership(selected: readonly string[], mode: ActiveMode): AgentGrade {
  const chosen = new Set(selected);
  const verdicts: AgentVerdict[] = AGENT_PALETTE.map((item) => {
    const { expect, reason } = expectationFor(item.id, mode);
    const placedInAgent = chosen.has(item.id);
    const correct = expect === "optional" || (expect === "required" ? placedInAgent : !placedInAgent);
    return { id: item.id, name: item.name, placedInAgent, expectation: expect, correct, reason };
  });
  const correctCount = verdicts.filter((v) => v.correct).length;
  return {
    mode,
    score: Math.round((correctCount / verdicts.length) * 100),
    passed: correctCount === verdicts.length,
    verdicts,
    missing: verdicts.filter((v) => v.expectation === "required" && !v.placedInAgent).map((v) => v.name),
    misplaced: verdicts.filter((v) => v.expectation === "forbidden" && v.placedInAgent).map((v) => v.name),
  };
}
