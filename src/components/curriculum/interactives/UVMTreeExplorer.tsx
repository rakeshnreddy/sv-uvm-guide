"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  AGENT_NUM_TXNS_DEFAULT,
  EXAMPLE_TREE,
  agentBuild,
  childrenInVisitOrder,
  phaseCallOrder,
  type AgentBuildOutcome,
  type ComponentNode,
  type PhaseOrder,
} from "@/lib/uvm-phase-model";
import { cn } from "@/lib/utils";

export const TREE_EXPLORER_ASSUMPTIONS = [
  "Model of uvm-core 2020.3.1 (IEEE 1800.2-2020): uvm_topdown_phase / uvm_bottomup_phase traversal, uvm_component::build_phase, uvm_agent::build_phase.",
  "uvm_root is the traversal root and is not numbered. Siblings are visited in instance-name order (uvm-core stores children in m_children[string]).",
  "use_automatic_config() keeps its default (1).",
];

type TreePhase = "build" | "connect" | "run";

const PHASE_INFO: Record<TreePhase, { method: string; order: PhaseOrder; rule: string }> = {
  build: {
    method: "build_phase",
    order: "top-down",
    rule: "Top-down, depth-first: a parent runs before its children, because the parent's build_phase is what creates them.",
  },
  connect: {
    method: "connect_phase",
    order: "bottom-up",
    rule: "Bottom-up, depth-first: every child runs before its parent. Every component already exists, so any order would work; bottom-up is the rule.",
  },
  run: {
    method: "run_phase",
    order: "parallel",
    rule: "A task: the phasing engine forks every component's run_phase in the same time step. They run in parallel, so do not rely on which starts first.",
  },
};

function NumberedTree({ node, prefix, numbers, parallel }: { node: ComponentNode; prefix: string; numbers: Map<string, number>; parallel: boolean }) {
  const path = prefix ? `${prefix}.${node.name}` : node.name;
  const n = numbers.get(path);
  return (
    <li>
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-0.5 font-mono text-[12px] text-foreground [font-variant-ligatures:none]">
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-sans text-[10px] font-bold",
            parallel ? "bg-amber-500/20 text-amber-900 dark:text-amber-100" : "bg-cyan-500/20 text-cyan-900 dark:text-cyan-100",
          )}
          aria-label={parallel ? "runs in parallel" : `call ${n}`}
        >
          {parallel ? "∥" : n}
        </span>
        {node.name}
        <span className="text-[10px] text-muted-foreground">{node.type}</span>
      </span>
      {node.children?.length ? (
        <ul className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-3">
          {childrenInVisitOrder(node).map((c) => (
            <NumberedTree key={c.name} node={c} prefix={path} numbers={numbers} parallel={parallel} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PhaseOrderPicture() {
  const [phase, setPhase] = useState<TreePhase>("build");
  const info = PHASE_INFO[phase];
  const order = useMemo(() => phaseCallOrder(phase), [phase]);
  const numbers = new Map(order.calls.map((c, i) => [c.path, i + 1]));
  const parallel = info.order === "parallel";
  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Phase"
        mono
        value={phase}
        onChange={setPhase}
        options={[
          { value: "build", label: "↓ build_phase", ariaLabel: "build_phase, top-down" },
          { value: "connect", label: "↑ connect_phase", ariaLabel: "connect_phase, bottom-up" },
          { value: "run", label: "∥ run_phase", ariaLabel: "run_phase, parallel" },
        ]}
      />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="mb-2 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">uvm_root (traversal root)</p>
          <ul className="space-y-1" aria-label={`Component tree numbered in ${info.method} call order`}>
            <NumberedTree node={EXAMPLE_TREE} prefix="" numbers={numbers} parallel={parallel} />
          </ul>
        </div>
        <div className="space-y-2 text-sm" aria-live="polite">
          <p>
            <strong>Rule: </strong>
            {info.rule}
          </p>
          {parallel ? null : (
            <ol className="list-decimal space-y-0.5 pl-5 font-mono text-[12px] [font-variant-ligatures:none]">
              {order.calls.map((c) => (
                <li key={c.path}>{c.path.replace(/^uvm_test_top\.?/, "") || "uvm_test_top"}</li>
              ))}
            </ol>
          )}
          <p className="text-muted-foreground">
            env creates <code>scb</code> before <code>agt</code>, yet <code>agt</code> is visited first: siblings go in name order, not creation order.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// super.build_phase experiment
// ---------------------------------------------------------------------------

const CONFIG = { configuredIsActive: "UVM_PASSIVE" as const, configuredNumTxns: 50 };

function agentCode(callsSuper: boolean): CodeTraceLine[] {
  return [
    { text: "// my_test::build_phase", owner: "testbench" },
    { text: 'uvm_config_db#(uvm_active_passive_enum)::set(this, "env.agt", "is_active", UVM_PASSIVE);', owner: "testbench" },
    { text: `uvm_config_db#(int)::set(this, "env.agt", "num_txns", ${CONFIG.configuredNumTxns});`, owner: "testbench" },
    { text: "" },
    { text: "class my_agent extends uvm_agent;", owner: "testbench" },
    { text: `  int num_txns = ${AGENT_NUM_TXNS_DEFAULT};`, owner: "testbench" },
    { text: "  my_monitor mon;  my_driver drv;  my_sequencer sqr;", owner: "testbench" },
    { text: "  `uvm_component_utils_begin(my_agent)", owner: "testbench" },
    { text: "    `uvm_field_int(num_txns, UVM_DEFAULT)", owner: "testbench" },
    { text: "  `uvm_component_utils_end", owner: "testbench" },
    { text: "  function new(string name, uvm_component parent);", owner: "testbench" },
    { text: "    super.new(name, parent);", owner: "testbench" },
    { text: "  endfunction", owner: "testbench" },
    { text: "  function void build_phase(uvm_phase phase);", owner: "testbench" },
    { key: "super", owner: "testbench", text: callsSuper ? "    super.build_phase(phase);" : "    // super.build_phase(phase);   <- forgotten" },
    { text: '    mon = my_monitor::type_id::create("mon", this);', owner: "testbench" },
    { text: "    if (get_is_active() == UVM_ACTIVE) begin", owner: "testbench" },
    { text: '      drv = my_driver::type_id::create("drv", this);', owner: "testbench" },
    { text: '      sqr = my_sequencer::type_id::create("sqr", this);', owner: "testbench" },
    { text: "    end", owner: "testbench" },
    { text: "  endfunction", owner: "testbench" },
    { text: "endclass", owner: "testbench" },
  ];
}

type BuildAnswer = "nothing" | "passive" | "active" | "error";

const BUILD_OPTIONS: { id: BuildAnswer; label: string; feedback: string }[] = [
  {
    id: "nothing",
    label: "No children: without super.build_phase the tree stops growing at the agent.",
    feedback:
      "Children are created only by your own type_id::create calls. uvm_component::build_phase creates nothing; the phasing engine then calls each new child's build_phase.",
  },
  {
    id: "passive",
    label: "Only mon, with num_txns = 50, as configured.",
    feedback:
      "uvm_agent::build_phase reads is_active from the configuration database, and uvm_component::build_phase applies `uvm_field_* settings (apply_config_settings). Both run only through super.build_phase.",
  },
  {
    id: "active",
    label: "mon, drv and sqr, with num_txns = 10: both settings are ignored.",
    feedback:
      "Without super.build_phase the is_active lookup and auto-config are skipped. is_active keeps its default UVM_ACTIVE and num_txns keeps 10. Children are still created by your own create calls.",
  },
  {
    id: "error",
    label: "A compile or elaboration error.",
    feedback: "Leaving out super.build_phase is legal and UVM reports nothing. The failure is silent, which is what makes it dangerous.",
  },
];

const answerFor = (o: AgentBuildOutcome): BuildAnswer => (o.isActive === "UVM_PASSIVE" ? "passive" : "active");

function SuperBuildExperiment() {
  const [callsSuper, setCallsSuper] = useState(false);
  const outcome = agentBuild({ callsSuper, ...CONFIG });
  const correct = answerFor(outcome);
  const options: PredictionOption[] = BUILD_OPTIONS.map((o) => ({ ...o, correct: o.id === correct }));
  return (
    <div className="space-y-3">
      <CodeTrace
        label="The test configures the agent as passive"
        lines={agentCode(callsSuper)}
        renderLineControl={(line) =>
          line.key === "super" ? (
            <button
              type="button"
              onClick={() => setCallsSuper((v) => !v)}
              aria-label={callsSuper ? "Remove the super.build_phase call" : "Restore the super.build_phase call"}
              className="min-h-7 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [font-variant-ligatures:none]"
            >
              {callsSuper ? "remove super" : "restore super"}
            </button>
          ) : null
        }
      />
      <PredictionPrompt
        question={`With super.build_phase ${callsSuper ? "called" : "forgotten"}, what does uvm_test_top.env.agt end up with?`}
        options={options}
        resetKey={String(callsSuper)}
      >
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]" aria-live="polite">
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
            <p className="mb-2 font-mono text-[12px] [font-variant-ligatures:none]">uvm_test_top.env.agt</p>
            <ul className="space-y-1 font-mono text-[12px] [font-variant-ligatures:none]">
              {["mon", "drv", "sqr"].map((c) => {
                const built = outcome.children.includes(c);
                return (
                  <li key={c} className={built ? "text-foreground" : "text-muted-foreground line-through"}>
                    {built ? "✓" : "✕"} {c} {built ? "(built; its own build_phase still runs)" : "(not built)"}
                  </li>
                );
              })}
            </ul>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">is_active</dt>
              <dd className="font-mono [font-variant-ligatures:none]">
                {outcome.isActive} {outcome.isActiveSource === "config_db" ? "(from config_db)" : "(default; the config_db setting was never read)"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">num_txns</dt>
              <dd className="font-mono [font-variant-ligatures:none]">
                {outcome.numTxns} {outcome.numTxnsSource === "config_db" ? "(auto-config applied)" : "(default; apply_config_settings never ran)"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Why</dt>
              <dd>
                {callsSuper
                  ? "super.build_phase ran apply_config_settings for this agent's `uvm_field_* members and uvm_agent's is_active lookup."
                  : "Nothing in the agent's own build_phase reads the configuration, so both settings are silently ignored. The children are created regardless, by the create calls."}
              </dd>
            </div>
          </dl>
        </div>
      </PredictionPrompt>
    </div>
  );
}

type Section = "order" | "super";

export default function UVMTreeExplorer() {
  const [section, setSection] = useState<Section>("order");
  return (
    <VisualFrame
      label="UVM component tree explorer"
      eyebrow="Mental picture · experiment"
      title="The component tree, phase order, and what super.build_phase really does"
      summary="Components form a tree rooted at uvm_test_top. Phases walk it depth-first; your build_phase code grows it."
      fidelity="model"
      assumptions={TREE_EXPLORER_ASSUMPTIONS}
    >
      <SegmentedControl
        label="View"
        value={section}
        onChange={setSection}
        options={[
          { value: "order", label: "Phase order in the tree" },
          { value: "super", label: "Forgotten super.build_phase" },
        ]}
      />
      {section === "order" ? <PhaseOrderPicture /> : <SuperBuildExperiment />}
    </VisualFrame>
  );
}
