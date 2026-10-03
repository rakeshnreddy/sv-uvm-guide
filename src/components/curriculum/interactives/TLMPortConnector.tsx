"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort, type DiagramToken } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { pullModelRun, type PullConnectChoice, type PullEdge, type PullRun } from "@/lib/uvm-tlm-model";
import { cn } from "@/lib/utils";

/** Long code labels get <wbr> break points so the pills wrap on phones; ariaLabel keeps the plain text. */
const breakable = (code: string) =>
  code.replace(/([.(])/g, "$1\u0000").split("\u0000").map((part, i) => (
    <React.Fragment key={i}>
      {i > 0 ? <wbr /> : null}
      {part}
    </React.Fragment>
  ));

const CHOICES: { value: PullConnectChoice; label: React.ReactNode; ariaLabel: string }[] = [
  "drv.seq_item_port.connect(sqr.seq_item_export);",
  "sqr.seq_item_export.connect(drv.seq_item_port);",
  "// connect line deleted",
].map((text, i) => ({
  value: (["port-to-imp", "imp-to-port", "missing"] as const)[i],
  label: breakable(text),
  ariaLabel: text,
}));

const PREDICTIONS: Record<PullConnectChoice, { question: string; options: PredictionOption[] }> = {
  "port-to-imp": {
    question: "The driver calls seq_item_port.get_next_item(req). Which way does req travel?",
    options: [
      {
        id: "drv-to-sqr",
        label: "Driver → sequencer: ports send, exports receive.",
        correct: false,
        feedback: "The port is where the call starts, not where the data starts. get_next_item() is a task with an output argument, so the item comes back to the caller.",
      },
      {
        id: "sqr-to-drv",
        label: "Sequencer → driver, as get_next_item()'s output argument.",
        correct: true,
        feedback: "The call travels driver → sequencer through the port-to-imp binding, and the granted item returns the other way. Connection direction is not data direction.",
      },
      {
        id: "seq-to-drv",
        label: "Sequence → driver directly; the sequencer only counts items.",
        correct: false,
        feedback: "The sequence hands req to the sequencer in finish_item(), and the sequencer gives it to the driver only when the driver asks.",
      },
      {
        id: "both",
        label: "Both ways at once, like a wire.",
        correct: false,
        feedback: "TLM is method calls on objects, not signals: one call goes out, one handle comes back.",
      },
    ],
  },
  "imp-to-port": {
    question: "This agent's connect_phase calls sqr.seq_item_export.connect(drv.seq_item_port). What happens?",
    options: [
      {
        id: "same",
        label: "It works the same: connect() is symmetric.",
        correct: false,
        feedback: "connect() is requirer.connect(provider). seq_item_export is a uvm_seq_item_pull_imp, and uvm_port_base::connect() refuses any call made on an imp.",
      },
      {
        id: "builderr",
        label: "UVM_ERROR [Connection Error] during connect_phase, then UVM_FATAL [BUILDERR] when end_of_elaboration starts.",
        correct: true,
        feedback: "The error is reported immediately and nothing is bound. uvm_root checks the error count at the start of end_of_elaboration and stops the run.",
      },
      {
        id: "runtime",
        label: "The run starts, and the driver fails at its first get_next_item().",
        correct: false,
        feedback: "The run never gets that far: an error was already reported, so BUILDERR stops it before run_phase.",
      },
      {
        id: "compile",
        label: "A compile error.",
        correct: false,
        feedback: "Both ends use the same interface class and transaction type, so it compiles. The check is inside connect(), at run time.",
      },
    ],
  },
  missing: {
    question: "Someone deleted the connect() line. When does the test fail?",
    options: [
      {
        id: "eoe",
        label: "At end_of_elaboration: \"connection count of 0 does not meet required minimum of 1\".",
        correct: false,
        feedback: "That is the rule for most ports, but uvm_seq_item_pull_port is constructed with min_size 0, so resolve_bindings() reports nothing.",
      },
      {
        id: "null",
        label: "At the driver's first get_next_item(): a null object access reported by the simulator.",
        correct: true,
        feedback: "Nothing is bound, so the port's interface handle is still null when the driver calls through it. The message comes from the simulator, not from UVM, and never mentions connect().",
      },
      {
        id: "hang",
        label: "Never: the driver just waits forever for an item.",
        correct: false,
        feedback: "Waiting needs a sequencer to wait on. There is none: the call has nowhere to go.",
      },
      {
        id: "compile",
        label: "At compile time.",
        correct: false,
        feedback: "A missing statement is legal code. Only run-time behaviour reveals it.",
      },
    ],
  },
};

const NODES: DiagramNode[] = [
  { id: "agt", label: "agt", kind: "agent", x: 10, y: 10, w: 540, h: 150, container: true },
  { id: "sqr", label: "sqr", sublabel: "bus_sequencer", kind: "sequencer", x: 40, y: 60, w: 150, h: 60 },
  { id: "drv", label: "drv", sublabel: "bus_driver", kind: "driver", x: 370, y: 60, w: 150, h: 60 },
  { id: "seq", label: "seq", sublabel: "bus_seq (an object)", kind: "sequence", x: 40, y: 185, w: 150, h: 46 },
  { id: "vif", label: "vif", sublabel: "bus_if → DUT pins", kind: "interface", x: 370, y: 185, w: 150, h: 46 },
];

const PORTS: DiagramPort[] = [
  { id: "sqr.seq_item_export", nodeId: "sqr", side: "right", offset: 0.5, kind: "imp", label: "seq_item_export" },
  { id: "drv.seq_item_port", nodeId: "drv", side: "left", offset: 0.5, kind: "port", label: "seq_item_port" },
];

const EDGE_IDS: Record<PullEdge, string> = { call: "e-call", item: "e-item", pins: "e-pins", sequence: "e-seq" };

function codeLines(run: PullRun): CodeTraceLine[] {
  return [
    { text: "// bus_agent::connect_phase", owner: "testbench" },
    { text: run.connectLine, key: "connect", owner: "testbench" },
    { text: "" },
    { text: "// bus_seq::body", owner: "testbench" },
    { text: "start_item(req);", key: "seq-start", owner: "testbench" },
    { text: 'if (!req.randomize()) `uvm_error("SEQ", "randomize failed")', owner: "testbench" },
    { text: "finish_item(req);", key: "seq-finish", owner: "testbench" },
    { text: "" },
    { text: "// bus_driver::run_phase", owner: "testbench" },
    { text: "forever begin", owner: "testbench" },
    { text: "  seq_item_port.get_next_item(req);", key: "gni", owner: "testbench" },
    { text: "  drive(req);   // wiggle pins through vif", key: "drive", owner: "testbench" },
    { text: "  seq_item_port.item_done();", key: "done", owner: "testbench" },
    { text: "end", owner: "testbench" },
  ];
}

const ENDINGS: Record<PullRun["ending"], string> = {
  "handshake-completes": "✓ One item completed the round trip. The driver loops back to get_next_item() for the next one.",
  "build-error-fatal": "✕ UVM_FATAL [BUILDERR] at the start of end_of_elaboration. run_phase never starts.",
  "null-handle-at-get_next_item": "✕ The simulator stops at the first get_next_item() with a null object access. No UVM message names the missing connect().",
};

/** Pull model: the driver's port calls into the sequencer's imp; the item comes back. */
export default function TLMPortConnector() {
  const [choice, setChoice] = useState<PullConnectChoice>("port-to-imp");
  const run = useMemo(() => pullModelRun(choice), [choice]);
  const playback = usePlayback(run.steps.length, choice);
  const step = run.steps[Math.min(playback.index, run.steps.length - 1)];
  const bound = run.elaboration.connections.length > 0;
  const prediction = PREDICTIONS[choice];

  const edges = (): DiagramEdge[] => {
    const list: DiagramEdge[] = [];
    if (bound) list.push({ id: "e-call", from: "drv.seq_item_port", to: "sqr.seq_item_export", style: "causal", label: "calls", state: step?.edge === "call" ? "active" : "normal" });
    if (choice === "port-to-imp") {
      list.push(
        { id: "e-item", from: "sqr", to: "drv", style: "data", label: "req", points: [[115, 40], [445, 40]], state: step?.edge === "item" ? "active" : "normal" },
        { id: "e-seq", from: "seq", to: "sqr", style: "causal", label: "start/finish_item", state: step?.edge === "sequence" ? "active" : "normal" },
        { id: "e-pins", from: "drv", to: "vif", style: "data", label: "pins", state: step?.edge === "pins" ? "active" : "normal" },
      );
    }
    if (choice === "missing" && step?.edge === "call") {
      list.push({ id: "e-call", from: "drv.seq_item_port", to: "sqr.seq_item_export", style: "causal", label: "nothing bound: null", state: "error" });
    }
    return list;
  };

  const tokens = (): DiagramToken[] => {
    if (!step?.edge || !step.token) return [];
    return [{ edgeId: EDGE_IDS[step.edge], t: 0.5, label: step.token.label, tone: step.token.tone }];
  };

  const ports: DiagramPort[] = PORTS.map((p) => ({
    ...p,
    state:
      step?.outcome === "error" || step?.outcome === "fatal"
        ? "error"
        : step?.edge === "call" && p.id === "drv.seq_item_port"
          ? "active"
          : "normal",
  }));

  return (
    <VisualFrame
      label="Pull connection between driver and sequencer"
      eyebrow="Mental picture"
      title="Who calls whom, and which way the item travels"
      summary="The driver's seq_item_port (■ port) calls into the sequencer's seq_item_export (● imp, despite its name). Choose the connect_phase line, predict, then step through."
      fidelity="model"
      assumptions={[
        "Connection checks follow uvm-core 2020.3.1 uvm_port_base::connect() and resolve_bindings(); seq_item_port has min_size 0 (uvm_sqr_connections.svh).",
        "One sequence and one item. Arbitration, responses and lock/grab are in the sequencer handshake visual.",
        "The null-object message is simulator-specific.",
      ]}
    >
      <SegmentedControl label="connect_phase line" mono value={choice} onChange={setChoice} options={CHOICES} />

      <CodeTrace label="Code for this run" lines={codeLines(run)} activeKey={step?.codeKey} />

      <PredictionPrompt
        resetKey={choice}
        question={prediction.question}
        options={prediction.options}
      >
        <div className="space-y-4">
          <BlockDiagram
            title={`Driver and sequencer. ${bound ? "seq_item_port is bound to seq_item_export." : "seq_item_port is not bound."} ${step ? `Step: ${step.what}` : ""}`}
            width={560}
            height={240}
            nodes={NODES}
            ports={ports}
            edges={edges()}
            tokens={tokens()}
            showLegend
          />
          <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Step" describeStep={(i) => run.steps[i]?.what ?? ""} />
          {step ? (
            <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-[15px]" aria-live="polite">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{step.phase}</p>
              <p className="text-foreground">
                <strong>What: </strong>
                {step.what}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">Why: </strong>
                {step.why}
              </p>
            </div>
          ) : null}
          {playback.isLast ? (
            <p
              className={cn(
                "text-sm font-medium",
                run.ending === "handshake-completes" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
              )}
            >
              {ENDINGS[run.ending]}
            </p>
          ) : null}
          {run.elaboration.log.length > 0 ? (
            <pre aria-label="Simulation log" className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
              {run.elaboration.log.join("\n")}
            </pre>
          ) : null}
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
