"use client";

import React, { useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort } from "@/components/visual-system/BlockDiagram";
import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { agentClassSource, buildTestbench, testConfigSource, type ActiveMode, type AgentBuild, type AgentSetup } from "@/lib/uvm-agent-model";
import { cn } from "@/lib/utils";

const PREDICTION: PredictionOption[] = [
  {
    id: "mon",
    label: "Only mon. out_agt has no sqr and no drv.",
    correct: true,
    feedback: "uvm_agent::build_phase reads is_active = UVM_PASSIVE, so get_is_active() is UVM_PASSIVE and the agent's own build_phase skips creating sqr and drv.",
  },
  {
    id: "idle",
    label: "sqr, drv and mon. The driver exists but stays idle.",
    correct: false,
    feedback: "Passive means not built, not built-and-idle. An idle driver still runs run_phase and usually drives idle values onto signals the DUT owns.",
  },
  {
    id: "mon-sqr",
    label: "mon and sqr. Only the driver is removed.",
    correct: false,
    feedback: "A sequencer without a driver would accept sequences that can never complete. A passive agent builds neither.",
  },
  {
    id: "empty",
    label: "Nothing. A passive agent is an empty shell.",
    correct: false,
    feedback: "The monitor is the reason a passive agent exists: it still observes the interface and publishes items on the agent's ap.",
  },
];

interface AgentGeom {
  x: number;
}
const AGENT_GEOM: Record<"in_agt" | "out_agt", AgentGeom> = { in_agt: { x: 24 }, out_agt: { x: 336 } };

function agentNodes(a: AgentBuild, g: AgentGeom): DiagramNode[] {
  const notBuilt = (built: boolean) => (built ? undefined : "not built");
  const passiveBadge = a.effectiveMode === "UVM_PASSIVE" ? "passive" : "active";
  return [
    { id: a.name, label: a.name, kind: "agent", x: g.x, y: 34, w: 300, h: 176, container: true, badge: passiveBadge },
    {
      id: `${a.name}.sqr`,
      label: "sqr",
      sublabel: notBuilt(a.built.sqr) ?? "bus_sequencer",
      kind: "sequencer",
      x: g.x + 14,
      y: 62,
      w: 120,
      h: 50,
      state: a.built.sqr ? "normal" : "dim",
    },
    {
      id: `${a.name}.drv`,
      label: "drv",
      sublabel: notBuilt(a.built.drv) ?? "bus_driver",
      kind: "driver",
      x: g.x + 166,
      y: 62,
      w: 120,
      h: 50,
      state: a.built.drv ? "normal" : "dim",
    },
    { id: `${a.name}.mon`, label: "mon", sublabel: "bus_monitor", kind: "monitor", x: g.x + 14, y: 140, w: 120, h: 50 },
  ];
}

function agentPorts(a: AgentBuild): DiagramPort[] {
  const ports: DiagramPort[] = [
    { id: `${a.name}.mon.ap`, nodeId: `${a.name}.mon`, side: "right", offset: 0.5, kind: "analysis_port" },
    { id: `${a.name}.ap`, nodeId: a.name, side: "bottom", offset: 0.6, kind: "analysis_port", label: "ap" },
  ];
  if (a.built.sqr) ports.push({ id: `${a.name}.sqr.export`, nodeId: `${a.name}.sqr`, side: "right", offset: 0.5, kind: "imp" });
  if (a.built.drv)
    ports.push({ id: `${a.name}.drv.port`, nodeId: `${a.name}.drv`, side: "left", offset: 0.5, kind: "port", state: a.connectFailure ? "error" : "normal" });
  return ports;
}

function agentEdges(a: AgentBuild, g: AgentGeom): DiagramEdge[] {
  const edges: DiagramEdge[] = [
    { id: `${a.name}-mon-ap`, from: `${a.name}.mon.ap`, to: `${a.name}.ap`, style: "data", label: "item", points: [[g.x + 180, 165]] },
  ];
  if (a.connects.some((c) => c.startsWith("drv.")) && a.built.drv && a.built.sqr) {
    edges.push({ id: `${a.name}-drv-sqr`, from: `${a.name}.drv.port`, to: `${a.name}.sqr.export`, style: "causal", label: "calls" });
  }
  return edges;
}

/** env topology with an input-side and an output-side agent: what exists in active vs passive mode. */
export default function AnimatedUvmTestbenchDiagram() {
  const [inMode, setInMode] = useState<ActiveMode>("UVM_ACTIVE");
  const [outMode, setOutMode] = useState<ActiveMode>("UVM_PASSIVE");
  const [skipSuper, setSkipSuper] = useState(false);
  const [noGuard, setNoGuard] = useState(false);

  const inSetup: AgentSetup = { name: "in_agt", configured: inMode === "UVM_ACTIVE" ? null : inMode, callsSuperBuild: !skipSuper, guardsConnect: !noGuard };
  const outSetup: AgentSetup = { name: "out_agt", configured: outMode, callsSuperBuild: !skipSuper, guardsConnect: !noGuard };
  const tb = buildTestbench(inSetup, outSetup);
  const [inAgt, outAgt] = tb.agents;

  const nodes: DiagramNode[] = [
    { id: "env", label: "env", kind: "env", x: 10, y: 10, w: 640, h: 330, container: true },
    ...agentNodes(inAgt, AGENT_GEOM.in_agt),
    ...agentNodes(outAgt, AGENT_GEOM.out_agt),
    { id: "scb", label: "scb", sublabel: "bus_scoreboard", kind: "scoreboard", x: 230, y: 262, w: 200, h: 60 },
  ];
  const ports: DiagramPort[] = [
    ...agentPorts(inAgt),
    ...agentPorts(outAgt),
    { id: "scb.exp_imp", nodeId: "scb", side: "top", offset: 0.2, kind: "analysis_imp", label: "exp_imp" },
    { id: "scb.act_imp", nodeId: "scb", side: "top", offset: 0.8, kind: "analysis_imp", label: "act_imp" },
  ];
  const edges: DiagramEdge[] = [...agentEdges(inAgt, AGENT_GEOM.in_agt), ...agentEdges(outAgt, AGENT_GEOM.out_agt)];
  if (tb.envConnects.length > 0) {
    edges.push(
      { id: "in-scb", from: "in_agt.ap", to: "scb.exp_imp", style: "data", label: "write()" },
      { id: "out-scb", from: "out_agt.ap", to: "scb.act_imp", style: "data", label: "write()" },
    );
  }
  const describe = (a: AgentBuild) =>
    `${a.name} ${a.effectiveMode === "UVM_ACTIVE" ? "active" : "passive"}: ${(["sqr", "drv", "mon"] as const).filter((c) => a.built[c]).join(", ")}`;

  return (
    <VisualFrame
      label="Agent topology in active and passive mode"
      eyebrow="Mental picture"
      title="What an agent builds: active vs passive"
      summary="in_agt drives the DUT's input bus; out_agt only watches the DUT's output bus. One config_db setting decides which children each agent creates."
      fidelity="model"
      assumptions={[
        "Follows uvm-core 2020.3.1 uvm_agent: is_active defaults to UVM_ACTIVE and is read from the config database inside uvm_agent::build_phase().",
        "Both agents use the same bus_agent class (shown below); the env connects each agent's ap to a two-input scoreboard.",
        "The null-handle and contention outcomes are summarised; real messages are tool-specific.",
      ]}
    >
      <CodeTrace label="bus_test::build_phase" lines={testConfigSource(inSetup, outSetup).map((text) => ({ text, owner: "testbench" as const }))} />

      <PredictionPrompt resetKey="topology" question="The test sets out_agt's is_active to UVM_PASSIVE. Which children does out_agt build?" options={PREDICTION}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">in_agt is_active</p>
              <SegmentedControl
                label="in_agt is_active"
                mono
                value={inMode}
                onChange={setInMode}
                options={[
                  { value: "UVM_ACTIVE", label: "UVM_ACTIVE" },
                  { value: "UVM_PASSIVE", label: "UVM_PASSIVE" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">out_agt is_active</p>
              <SegmentedControl
                label="out_agt is_active"
                mono
                value={outMode}
                onChange={setOutMode}
                options={[
                  { value: "UVM_ACTIVE", label: "UVM_ACTIVE" },
                  { value: "UVM_PASSIVE", label: "UVM_PASSIVE" },
                ]}
              />
            </div>
          </div>
          <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inject a bug into bus_agent</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skipSuper} onChange={(e) => setSkipSuper(e.target.checked)} className="h-4 w-4 accent-rose-500" />
              build_phase skips <code className="font-mono">super.build_phase(phase)</code>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={noGuard} onChange={(e) => setNoGuard(e.target.checked)} className="h-4 w-4 accent-rose-500" />
              connect_phase has no <code className="font-mono">get_is_active()</code> guard
            </label>
          </fieldset>

          <BlockDiagram
            title={`Testbench topology. ${describe(inAgt)}. ${describe(outAgt)}. ${tb.verdict}`}
            width={660}
            height={350}
            nodes={nodes}
            ports={ports}
            edges={edges}
            showLegend
          />

          <div
            aria-live="polite"
            className={cn(
              "rounded-xl border p-3 text-sm",
              tb.outcome === "ok" ? "border-emerald-500/50 bg-emerald-500/5" : tb.outcome === "warning" ? "border-amber-500/50 bg-amber-500/5" : "border-rose-500/50 bg-rose-500/5",
            )}
          >
            <p
              className={cn(
                "font-semibold",
                tb.outcome === "ok" ? "text-emerald-700 dark:text-emerald-300" : tb.outcome === "warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300",
              )}
            >
              {tb.outcome === "ok" ? "✓ " : tb.outcome === "warning" ? "! " : "✕ "}
              {tb.verdict}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {tb.agents.map((a) => (
                <li key={a.name}>
                  <strong className="text-foreground">{a.name}:</strong> {a.modeReason}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Build log: [CFG] and [BUILD] lines are what a `uvm_info in the test and agent would print; a null-object line comes from the simulator itself.
          </p>
          <pre aria-label="Build log" className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
            {tb.log.join("\n")}
          </pre>
          <CodeTrace
            label="bus_agent (used for both agents)"
            lines={agentClassSource(outSetup).map((l) => ({ text: l.text, key: l.key || undefined, owner: "testbench" as const }))}
            activeKey={skipSuper ? "build-super" : noGuard ? "connect-drv" : undefined}
          />
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
