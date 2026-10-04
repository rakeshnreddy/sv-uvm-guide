"use client";

import React, { useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort } from "@/components/visual-system/BlockDiagram";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";

type Variant = "vsqr" | "handles";

interface NodeInfo {
  title: string;
  text: string;
  code?: string;
}

const AGENT_NODES: DiagramNode[] = [
  { id: "env", label: "env", kind: "env", x: 8, y: 8, w: 624, h: 316, container: true },
  { id: "cfg_agt", label: "cfg_agt", kind: "agent", x: 250, y: 28, w: 370, h: 132, container: true, badge: "active" },
  { id: "cfg_sqr", label: "cfg_sqr", sublabel: "runs cfg_seq", kind: "sequencer", x: 270, y: 64, w: 120, h: 50 },
  { id: "cfg_drv", label: "cfg_drv", kind: "driver", x: 480, y: 64, w: 120, h: 50 },
  { id: "data_agt", label: "data_agt", kind: "agent", x: 250, y: 180, w: 370, h: 132, container: true, badge: "active" },
  { id: "data_sqr", label: "data_sqr", sublabel: "runs data_seq", kind: "sequencer", x: 270, y: 220, w: 120, h: 50 },
  { id: "data_drv", label: "data_drv", kind: "driver", x: 480, y: 220, w: 120, h: 50 },
];

const PORTS: DiagramPort[] = [
  { id: "cfg_sqr.exp", nodeId: "cfg_sqr", side: "right", offset: 0.5, kind: "export" },
  { id: "cfg_drv.port", nodeId: "cfg_drv", side: "left", offset: 0.5, kind: "port" },
  { id: "data_sqr.exp", nodeId: "data_sqr", side: "right", offset: 0.5, kind: "export" },
  { id: "data_drv.port", nodeId: "data_drv", side: "left", offset: 0.5, kind: "port" },
];

const COMMON_EDGES: DiagramEdge[] = [
  { id: "cfg-pull", from: "cfg_drv.port", to: "cfg_sqr.exp", style: "data", label: "seq_item" },
  { id: "data-pull", from: "data_drv.port", to: "data_sqr.exp", style: "data", label: "seq_item" },
];

const VARIANTS: Record<Variant, { nodes: DiagramNode[]; edges: DiagramEdge[]; info: Record<string, NodeInfo> }> = {
  vsqr: {
    nodes: [
      { id: "vseq", label: "soc_vseq", sublabel: "virtual sequence", kind: "sequence", x: 24, y: 40, w: 168, h: 48 },
      { id: "vsqr", label: "soc_vsqr", sublabel: "handles only, no driver", kind: "sequencer", x: 24, y: 170, w: 168, h: 52 },
      ...AGENT_NODES,
    ],
    edges: [
      { id: "vseq-on", from: "vseq", to: "vsqr", style: "causal", label: "runs on" },
      { id: "h-cfg", from: "vsqr", to: "cfg_sqr", style: "control", label: "handle", points: [[226, 186], [226, 89]] },
      { id: "h-data", from: "vsqr", to: "data_sqr", style: "control", label: "handle", points: [[226, 206], [226, 245]] },
      ...COMMON_EDGES,
    ],
    info: {
      vseq: {
        title: "soc_vseq: the virtual sequence",
        text: "Sends no items of its own. Its body() starts child sequences on the agent sequencers. `uvm_declare_p_sequencer gives it a typed p_sequencer handle to soc_vsqr.",
        code: "class soc_vseq extends uvm_sequence;\n  `uvm_object_utils(soc_vseq)\n  `uvm_declare_p_sequencer(soc_vsqr)\n  task body();\n    cfg_seq c = cfg_seq::type_id::create(\"c\");\n    c.start(p_sequencer.cfg_sqr);\n  endtask\nendclass",
      },
      vsqr: {
        title: "soc_vsqr: the virtual sequencer",
        text: "A uvm_sequencer with no driver. It exists so a virtual sequence has a place to run and a component that holds the agent sequencer handles. It is connected by handle assignment, not by TLM ports.",
        code: "class soc_vsqr extends uvm_sequencer;\n  `uvm_component_utils(soc_vsqr)\n  cfg_sequencer  cfg_sqr;\n  data_sequencer data_sqr;\n  function new(string name, uvm_component parent);\n    super.new(name, parent);\n  endfunction\nendclass",
      },
      env: {
        title: "env: assigns the handles",
        text: "The env builds the virtual sequencer next to the agents and points its handles at the agent sequencers in connect_phase. A forgotten line leaves a null handle.",
        code: "function void connect_phase(uvm_phase phase);\n  vsqr.cfg_sqr  = cfg_agt.sqr;\n  vsqr.data_sqr = data_agt.sqr;\nendfunction",
      },
    },
  },
  handles: {
    nodes: [
      { id: "vseq", label: "soc_vseq", sublabel: "start(null): no sequencer", kind: "sequence", x: 24, y: 120, w: 168, h: 52 },
      ...AGENT_NODES,
    ],
    edges: [
      { id: "h-cfg", from: "vseq", to: "cfg_sqr", style: "control", label: "handle", points: [[226, 136], [226, 89]] },
      { id: "h-data", from: "vseq", to: "data_sqr", style: "control", label: "handle", points: [[226, 156], [226, 245]] },
      ...COMMON_EDGES,
    ],
    info: {
      vseq: {
        title: "soc_vseq with its own handles",
        text: "No virtual sequencer: the test copies the agent sequencer handles into the sequence and starts it with start(null). This works because a virtual sequence sends no items itself.",
        code: "class soc_vseq extends uvm_sequence;\n  `uvm_object_utils(soc_vseq)\n  cfg_sequencer  cfg_sqr;\n  data_sequencer data_sqr;\n  task body();\n    cfg_seq c = cfg_seq::type_id::create(\"c\");\n    c.start(cfg_sqr);\n  endtask\nendclass\n\n// test.run_phase\nvseq.cfg_sqr  = env.cfg_agt.sqr;\nvseq.data_sqr = env.data_agt.sqr;\nvseq.start(null);",
      },
      env: {
        title: "env: no virtual sequencer",
        text: "Nothing extra to build or connect. The trade-off: every test that starts the virtual sequence must set its handles.",
      },
    },
  },
};

const SHARED_INFO: Record<string, NodeInfo> = {
  cfg_sqr: {
    title: "cfg_sqr: an agent sequencer",
    text: "cfg_seq runs here because the virtual sequence called c.start(<this handle>). The sequencer arbitrates its items for cfg_drv and does not know a virtual sequence exists.",
  },
  data_sqr: {
    title: "data_sqr: an agent sequencer",
    text: "data_seq runs here. Whether it runs before, after or alongside cfg_seq is decided only by the virtual sequence's body().",
  },
  cfg_drv: { title: "cfg_drv", text: "Pulls items with seq_item_port.get_next_item() through the port ■ → export ○ connection made in the agent." },
  data_drv: { title: "data_drv", text: "Pulls items with seq_item_port.get_next_item()." },
  cfg_agt: { title: "cfg_agt", text: "An active agent: sequencer, driver and (not drawn) monitor." },
  data_agt: { title: "data_agt", text: "An active agent: sequencer, driver and (not drawn) monitor." },
};

/** Picture of how a virtual sequence reaches agent sequencers, with and without a virtual sequencer. */
const UvmVirtualSequencerDiagram: React.FC = () => {
  const [variant, setVariant] = useState<Variant>("vsqr");
  const [selected, setSelected] = useState<string>("vseq");
  const v = VARIANTS[variant];
  const info = v.info[selected] ?? SHARED_INFO[selected] ?? v.info.vseq;

  return (
    <VisualFrame
      label="Virtual sequencer map"
      eyebrow="Mental picture"
      title="How a virtual sequence reaches the agents"
      summary="Select any block to see its role and code. Dotted lines are handles (plain class references); the solid arrows are the TLM pull connection inside each agent."
      fidelity="illustration"
      assumptions={["Structure only: nothing executes here. The timing of fork vs ordered starts is in the dispatch explorer."]}
    >
      <SegmentedControl
        label="Architecture"
        options={[
          { value: "vsqr", label: "With a virtual sequencer" },
          { value: "handles", label: "Handles in the sequence (start(null))" },
        ]}
        value={variant}
        onChange={(next) => {
          setVariant(next);
          setSelected("vseq");
        }}
      />
      <BlockDiagram
        title={
          variant === "vsqr"
            ? "soc_vseq runs on soc_vsqr, which holds handles to cfg_sqr and data_sqr; each child sequence runs on its agent sequencer, whose driver pulls items"
            : "soc_vseq is started with start(null) and holds handles to cfg_sqr and data_sqr itself"
        }
        width={640}
        height={332}
        minWidth={300}
        nodes={v.nodes.map((n) => ({ ...n, state: n.id === selected ? "active" : n.state }))}
        ports={PORTS}
        edges={v.edges}
        selectedId={selected}
        onSelect={setSelected}
        showLegend
      />
      <button
        type="button"
        onClick={() => setSelected("env")}
        aria-pressed={selected === "env"}
        className="min-h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Show the env wiring
      </button>
      <div className="rounded-xl border border-border/70 bg-background/60 p-3" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">{info.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{info.text}</p>
        {info.code ? (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
            <code>{info.code}</code>
          </pre>
        ) : null}
      </div>
      <PredictionPrompt
        question="soc_vseq calls c.start(p_sequencer.cfg_sqr). On which sequencer are cfg_seq's items arbitrated?"
        resetKey={variant}
        options={[
          {
            id: "cfg",
            label: "cfg_sqr, the agent sequencer passed to start()",
            correct: true,
            feedback: "start(sqr) sets the child's m_sequencer to the sequencer you pass. The virtual sequencer is only where soc_vseq itself runs; it never sees cfg_seq's items.",
          },
          {
            id: "vsqr",
            label: "soc_vsqr, because the parent sequence runs there",
            correct: false,
            feedback: "A child runs on the sequencer passed to its start(), not on its parent's sequencer. soc_vsqr has no driver, so items sent there would never be pulled.",
          },
          {
            id: "both",
            label: "Both: soc_vsqr forwards each item to cfg_sqr",
            correct: false,
            feedback: "A virtual sequencer has no TLM connection to the agents and forwards nothing. It only holds handles.",
          },
        ]}
      >
        <p className="text-sm text-muted-foreground">
          Next, try the timing: the dispatch explorer shows what happens when the two children are started in order, with fork…join, or with fork…join_none.
        </p>
      </PredictionPrompt>
    </VisualFrame>
  );
};

export default UvmVirtualSequencerDiagram;
