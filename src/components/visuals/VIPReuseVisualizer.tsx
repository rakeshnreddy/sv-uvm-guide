"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { DEFAULT_AGENT_CONFIG, agentSource, buildAgent, type AgentBuildConfig, type AgentBuildResult, type Level } from "@/lib/vip-agent-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "uvm_agent::build_phase reads an \"is_active\" config_db entry into is_active (default UVM_ACTIVE), and get_is_active() returns it (uvm-core src/comps/uvm_agent.svh, IEEE 1800.2-2020 §13.4).",
  "The agent code on the right builds the driver and sequencer only when get_is_active() == UVM_ACTIVE; nothing is built and then disabled.",
  "A VIP that keeps the mode in its own config object should copy cfg.is_active into is_active so get_is_active() stays the one answer.",
  "Bus contention is shown as a fact (two drivers on one bus), not simulated at the pin level.",
];

const passiveOptions: PredictionOption[] = [
  {
    id: "mon-cov",
    label: "Monitor and coverage only; driver and sequencer are never created",
    correct: true,
    feedback:
      "The if (get_is_active() == UVM_ACTIVE) branch is skipped, so create() is never called for the driver or sequencer. Their handles stay null; there is no object to disable.",
  },
  {
    id: "all-disabled",
    label: "All four are built; the driver is just switched off",
    correct: false,
    feedback:
      "Passive does not mean built-but-idle. The driver and sequencer are never constructed, which is why anything that touches agent.sequencer in passive mode hits a null handle.",
  },
  {
    id: "sqr-only",
    label: "Monitor, coverage and an idle sequencer; no driver",
    correct: false,
    feedback: "The sequencer only exists to feed a driver, and the standard agent code creates both inside the same active-only branch.",
  },
  {
    id: "none",
    label: "Nothing: a passive agent is skipped entirely",
    correct: false,
    feedback: "The agent itself is still built. Its monitor keeps turning bus activity into transactions for scoreboards and coverage; that is the whole point of reuse.",
  },
];

function AgentDiagram({ result }: { result: AgentBuildResult }) {
  const soc = result.config.level === "soc";
  const exists = (p: string) => result.parts.find((x) => x.part === p)?.exists ?? false;
  const nodes: DiagramNode[] = [
    { id: "env", label: soc ? "soc_env" : "block_env", kind: "env", x: 6, y: 6, w: 438, h: 228, container: true },
    { id: "agent", label: "spi_agent", kind: "agent", x: 20, y: 34, w: 300, h: 190, container: true, badge: result.isActive === "UVM_ACTIVE" ? "active" : "passive" },
    { id: "mon", label: "monitor", kind: "monitor", x: 36, y: 160, w: 120, h: 48 },
    { id: "cov", label: "coverage", kind: "subscriber", x: 184, y: 160, w: 120, h: 48 },
    { id: "scb", label: "scoreboard", kind: "scoreboard", x: 336, y: 160, w: 98, h: 48 },
    { id: "dut", label: soc ? "SoC: CPU + SPI" : "SPI block", kind: "dut", x: 470, y: 60, w: 160, h: 150, state: result.busDriver === "contention" ? "error" : "normal" },
  ];
  if (exists("sequencer")) nodes.push({ id: "sqr", label: "sequencer", kind: "sequencer", x: 36, y: 64, w: 120, h: 48 });
  if (exists("driver")) nodes.push({ id: "drv", label: "driver", kind: "driver", x: 184, y: 64, w: 120, h: 48, state: result.busDriver === "contention" ? "error" : "normal" });
  const ports: DiagramPort[] = [{ id: "mon_ap", nodeId: "mon", side: "bottom", offset: 0.5, kind: "analysis_port" }];
  const edges: DiagramEdge[] = [
    { id: "mon-cov", from: "mon", to: "cov", style: "data", label: "item" },
    { id: "mon-scb", from: "mon_ap", to: "scb", style: "data", label: "item", points: [[96, 222], [385, 222]] },
    { id: "pins-mon", from: "dut", to: "mon", style: "structural", label: "observe pins", points: [[470, 140], [96, 140]] },
  ];
  if (exists("sequencer") && exists("driver")) edges.push({ id: "sqr-drv", from: "sqr", to: "drv", style: "data", label: "req" });
  if (exists("driver")) edges.push({ id: "drv-dut", from: "drv", to: "dut", style: "data", label: "drive pins", state: result.busDriver === "contention" ? "error" : "normal", points: [[400, 88]] });
  const missing = result.parts.filter((p) => !p.exists).map((p) => p.part);
  return (
    <div className="space-y-1">
      <BlockDiagram
        title={`spi_agent after build_phase: ${result.parts.filter((p) => p.exists).map((p) => p.part).join(", ")} exist${missing.length ? `; ${missing.join(" and ")} handles are null` : ""}.`}
        width={640}
        minWidth={480}
        height={240}
        nodes={nodes}
        ports={ports}
        edges={edges}
        showLegend
      />
      {missing.length ? (
        <p className="text-xs text-muted-foreground">
          Not drawn because they do not exist: <code className="font-mono">driver = null</code>, <code className="font-mono">sequencer = null</code>.
        </p>
      ) : null}
    </div>
  );
}

/** Active vs passive reuse of one agent, with a prediction about what exists in passive mode. */
export default function VIPReuseVisualizer() {
  const [config, setConfig] = useState<AgentBuildConfig>({ ...DEFAULT_AGENT_CONFIG, level: "soc" });
  const [advanced, setAdvanced] = useState(false);
  const result = useMemo(() => buildAgent(config), [config]);
  const lines: CodeTraceLine[] = agentSource(config).map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));
  const activeKeys = result.isActive === "UVM_ACTIVE" ? "driver" : "if";

  return (
    <VisualFrame
      label="VIP reuse: active and passive agent"
      eyebrow="Experiment"
      title="One agent, two personalities"
      summary="At block level the agent drives the SPI block. At SoC level the CPU's firmware drives the same bus, so the agent must only watch. Predict what exists in passive mode, then switch levels."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <PredictionPrompt question="At SoC level the test sets is_active = UVM_PASSIVE. After build_phase, which components exist inside spi_agent?" options={passiveOptions}>
        <div className="space-y-4">
          <SegmentedControl<Level>
            label="Integration level"
            value={config.level}
            onChange={(v) => setConfig((c) => ({ ...c, level: v }))}
            options={[
              { value: "block", label: "Block level: agent drives (UVM_ACTIVE)" },
              { value: "soc", label: "SoC level: firmware drives (UVM_PASSIVE)" },
            ]}
          />
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <div className="min-w-0 space-y-3">
              <AgentDiagram result={result} />
              <ul className="space-y-1 text-sm" aria-label="Components after build_phase">
                {result.parts.map((p) => (
                  <li key={p.part} className="flex flex-wrap gap-x-2">
                    <span className={cn("min-w-[6.5rem] font-mono", p.exists ? "text-foreground" : "text-rose-700 dark:text-rose-300")}>
                      <span aria-hidden className="mr-1">
                        {p.exists ? "✓" : "∅"}
                      </span>
                      {p.part}
                    </span>
                    <span className="text-muted-foreground">{p.exists ? "exists. " : "null. "}{p.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <CodeTrace label="Test setting and agent code (generated from the model)" lines={lines} activeKey={activeKeys} className="min-w-0" />
          </div>
          <div
            aria-live="polite"
            className={cn(
              "rounded-xl border p-3 text-sm",
              !result.connect.ok || result.busDriver === "contention" ? "border-rose-500/50 bg-rose-500/10" : "border-emerald-500/50 bg-emerald-500/10",
            )}
          >
            <p className="font-semibold text-foreground">{result.summary}</p>
            <ul className="mt-1 space-y-0.5 text-foreground/90">
              <li>
                <strong>Bus driven by: </strong>
                {result.busDriver === "uvm-driver" ? "the UVM driver" : result.busDriver === "cpu" ? "the CPU running firmware" : "both the UVM driver and the CPU (contention)"}
              </li>
              <li>
                <strong>connect_phase: </strong>
                {result.connect.message}
              </li>
              <li>
                <strong>seq.start(spi_agent.sequencer): </strong>
                {result.sequenceStart.message}
              </li>
            </ul>
          </div>
          <div>
            <button
              type="button"
              aria-expanded={advanced}
              onClick={() => setAdvanced((a) => !a)}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {advanced ? "Hide: break the agent" : "Show: break the agent"}
            </button>
            {advanced ? (
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={!config.callsSuperBuild}
                    onChange={(e) => setConfig((c) => ({ ...c, callsSuperBuild: !e.target.checked }))}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  Forget super.build_phase(phase)
                </label>
                <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={!config.guardedConnect}
                    onChange={(e) => setConfig((c) => ({ ...c, guardedConnect: !e.target.checked }))}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  Drop the is_active guard in connect_phase
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
