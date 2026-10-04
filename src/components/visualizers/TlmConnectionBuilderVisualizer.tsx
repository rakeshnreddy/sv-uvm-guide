"use client";

import React, { useMemo, useState } from "react";

import {
  BlockDiagram,
  type DiagramEdge,
  type DiagramNode,
  type DiagramNodeKind,
  type DiagramPort,
  type PortKind,
} from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  TLM_BUILDER_SCENARIOS,
  TLM_MASK,
  UNBOUNDED,
  ancestry,
  checkConnect,
  connectStatement,
  declarationSource,
  elaborate,
  endpointFullName,
  goalStatus,
  type BuilderScenarioId,
  type ConnectResult,
  type TlmConnection,
  type TlmEndpoint,
  type TlmTopology,
} from "@/lib/uvm-tlm-model";
import { cn } from "@/lib/utils";

// ── View geometry (the model owns semantics; this file owns pixels) ─────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  container?: boolean;
  sublabel?: string;
}
interface PortPlace {
  side: DiagramPort["side"];
  offset: number;
}
interface Layout {
  width: number;
  height: number;
  boxes: Record<string, Box>;
  ports: Record<string, PortPlace>;
}

const LAYOUTS: Record<BuilderScenarioId, Layout> = {
  agent: {
    width: 640,
    height: 300,
    boxes: {
      env: { x: 10, y: 10, w: 620, h: 280, container: true },
      agt: { x: 24, y: 34, w: 410, h: 236, container: true },
      sqr: { x: 44, y: 70, w: 130, h: 56 },
      drv: { x: 290, y: 70, w: 130, h: 56 },
      mon: { x: 44, y: 190, w: 130, h: 56 },
      scb: { x: 474, y: 190, w: 140, h: 56 },
    },
    ports: {
      "sqr.seq_item_export": { side: "right", offset: 0.5 },
      "drv.seq_item_port": { side: "left", offset: 0.5 },
      "mon.ap": { side: "right", offset: 0.5 },
      "agt.ap": { side: "right", offset: (218 - 34) / 236 },
      "scb.item_imp": { side: "left", offset: 0.5 },
    },
  },
  fifo: {
    width: 640,
    height: 290,
    boxes: {
      env: { x: 10, y: 10, w: 620, h: 270, container: true },
      agt: { x: 30, y: 120, w: 130, h: 60 },
      fifo: { x: 250, y: 40, w: 170, h: 110, sublabel: "uvm_tlm_analysis_fifo" },
      scb: { x: 480, y: 65, w: 130, h: 60 },
      cov: { x: 250, y: 200, w: 170, h: 60 },
    },
    ports: {
      "agt.ap": { side: "right", offset: 0.5 },
      "fifo.analysis_export": { side: "left", offset: 0.3 },
      "fifo.put_export": { side: "left", offset: 0.75 },
      "fifo.get_export": { side: "right", offset: 0.5 },
      "scb.get_port": { side: "left", offset: 0.5 },
      "cov.analysis_export": { side: "left", offset: 0.5 },
    },
  },
  promotion: {
    width: 640,
    height: 220,
    boxes: {
      env: { x: 10, y: 10, w: 620, h: 200, container: true },
      agt: { x: 24, y: 40, w: 260, h: 150, container: true },
      mon: { x: 44, y: 80, w: 130, h: 60 },
      chk_env: { x: 340, y: 40, w: 276, h: 150, container: true },
      scb: { x: 460, y: 80, w: 140, h: 60 },
    },
    ports: {
      "mon.ap": { side: "right", offset: 0.5 },
      "agt.ap": { side: "right", offset: 70 / 150 },
      "chk_env.analysis_export": { side: "left", offset: 70 / 150 },
      "scb.item_imp": { side: "left", offset: 0.5 },
    },
  },
  imp_decl: {
    width: 640,
    height: 280,
    boxes: {
      env: { x: 10, y: 10, w: 620, h: 260, container: true },
      in_agt: { x: 30, y: 50, w: 140, h: 60 },
      out_agt: { x: 30, y: 170, w: 140, h: 60 },
      scb: { x: 420, y: 60, w: 190, h: 160 },
    },
    ports: {
      "in_agt.ap": { side: "right", offset: 0.5 },
      "out_agt.ap": { side: "right", offset: 0.5 },
      "scb.exp_imp": { side: "left", offset: 0.2 },
      "scb.act_imp": { side: "left", offset: 0.8 },
    },
  },
};

const NODE_KIND: Record<string, DiagramNodeKind> = {
  test: "test",
  env: "env",
  agent: "agent",
  sequencer: "sequencer",
  driver: "driver",
  monitor: "monitor",
  scoreboard: "scoreboard",
  subscriber: "subscriber",
  fifo: "fifo",
  generic: "generic",
};

export function portKindOf(ep: TlmEndpoint): PortKind {
  if (ep.role === "port") return ep.typeName === "uvm_analysis_port" ? "analysis_port" : "port";
  if (ep.role === "export") return "export";
  return ep.mask === TLM_MASK.ANALYSIS ? "analysis_imp" : "imp";
}

const GLYPH: Record<PortKind, string> = { port: "■", export: "○", imp: "●", analysis_port: "◆", analysis_imp: "●" };

function methodLabel(ep: TlmEndpoint): string {
  if (ep.family === "sqr") return "get_next_item()";
  if (ep.mask === TLM_MASK.ANALYSIS) return "write()";
  if (ep.mask & TLM_MASK.BLOCKING_GET) return "get()";
  return "call";
}

const range = (min: number, max: number) => `${min}..${max === UNBOUNDED ? "∞" : max}`;

/** connect_phase code grouped by the class that contains each call (deepest class first). */
function connectCodeLines(topo: TlmTopology, connections: TlmConnection[]): CodeTraceLine[] {
  const groups = new Map<string, TlmConnection[]>();
  for (const c of connections) {
    const { writer } = connectStatement(topo, c.from, c.to);
    groups.set(writer, [...(groups.get(writer) ?? []), c]);
  }
  const writers = [...groups.keys()].sort((a, b) => ancestry(topo, b).length - ancestry(topo, a).length);
  const lines: CodeTraceLine[] = [];
  for (const w of writers) {
    const cls = topo.components.find((c) => c.id === w)?.cls ?? w;
    lines.push({ text: `// ${cls}::connect_phase`, owner: "testbench" });
    for (const c of groups.get(w) ?? []) {
      lines.push({ text: connectStatement(topo, c.from, c.to).code, key: `${c.from}->${c.to}`, owner: "testbench" });
    }
  }
  return lines;
}

// ── Debug presets: one prediction per scenario ─────────────────────────────

const DEBUG_QUESTIONS: Record<BuilderScenarioId, { question: string; options: PredictionOption[] }> = {
  agent: {
    question: "This connect_phase compiles. What does the run print before run_phase?",
    options: [
      {
        id: "either",
        label: "Nothing. connect() binds the two ends whichever one calls it.",
        correct: false,
        feedback: "connect() is directional: requirer.connect(provider). uvm_port_base::connect() rejects a call made on an imp.",
      },
      {
        id: "imp",
        label: "UVM_ERROR [Connection Error] \"Cannot call an imp port's connect method…\", then UVM_FATAL [BUILDERR].",
        correct: true,
        feedback: "seq_item_export is a uvm_seq_item_pull_imp, and an imp cannot call connect(). The error is counted, and uvm_root stops the run when end_of_elaboration starts.",
      },
      {
        id: "compile",
        label: "A compile error: the two ends have different types.",
        correct: false,
        feedback: "Both are uvm_port_base #(uvm_sqr_if_base #(bus_item, bus_item)), so the call type-checks. The check happens at run time, inside connect().",
      },
      {
        id: "hang",
        label: "The run starts and the driver blocks forever in get_next_item().",
        correct: false,
        feedback: "The binding is never recorded, but the run never reaches run_phase: the connect() error triggers BUILDERR first.",
      },
    ],
  },
  fifo: {
    question: "The scoreboard's run_phase loops on get_port.get(t), but nobody connected get_port. What happens?",
    options: [
      {
        id: "hang",
        label: "The scoreboard waits forever in get(); the test hangs.",
        correct: false,
        feedback: "That needs the run to start. uvm_blocking_get_port is built with min_size 1, so the missing connection is caught before run_phase.",
      },
      {
        id: "min",
        label: "UVM_ERROR on env.scb.get_port: \"connection count of 0 does not meet required minimum of 1\", then BUILDERR.",
        correct: true,
        feedback: "resolve_bindings() runs when end_of_elaboration starts. get_port reaches 0 imps but needs at least 1, so UVM reports it and uvm_root stops the run.",
      },
      {
        id: "push",
        label: "Nothing: the FIFO pushes items into the scoreboard automatically.",
        correct: false,
        feedback: "A FIFO never pushes. Its get_export is an imp the scoreboard must pull from with get().",
      },
      {
        id: "null",
        label: "A null-object fatal at the first get().",
        correct: false,
        feedback: "That is what an unconnected seq_item_port does, because its min_size is 0. A get port's min_size is 1, so UVM reports it at end_of_elaboration.",
      },
    ],
  },
  promotion: {
    question: "Every connect() call succeeds. What happens when end_of_elaboration starts?",
    options: [
      {
        id: "zero",
        label: "Nothing: analysis connections may have zero subscribers.",
        correct: false,
        feedback: "True for an analysis port (min_size 0). chk_env.analysis_export is a uvm_analysis_export, built with min_size 1: it must reach at least one imp.",
      },
      {
        id: "min",
        label: "UVM_ERROR on env.chk_env.analysis_export: \"connection count of 0 does not meet required minimum of 1\", then BUILDERR.",
        correct: true,
        feedback: "The export is a pass-through. Nothing connects it down to scb.item_imp, so it reaches no imp, and so neither do agt.ap and mon.ap.",
      },
      {
        id: "ntconn",
        label: "The monitor's first write() fatals with NTCONN.",
        correct: false,
        feedback: "write() never runs: the build error stops the test before run_phase. NTCONN fires only if get_if() returns null for an index below size().",
      },
      {
        id: "compile",
        label: "A compile error in check_env.",
        correct: false,
        feedback: "Leaving an export unconnected is legal SystemVerilog; only resolve_bindings() notices.",
      },
    ],
  },
  imp_decl: {
    question: "The env connects in_agt.ap to scb.act_imp and out_agt.ap to scb.exp_imp. What happens?",
    options: [
      {
        id: "mismatch",
        label: "It compiles and runs; every comparison mismatches.",
        correct: false,
        feedback: "That is what happens when both streams carry the same type. Here in_agt publishes bus_item and act_imp takes pkt_item.",
      },
      {
        id: "compile",
        label: "A compile error: the port's and the imp's transaction types differ.",
        correct: true,
        feedback: "connect() takes a uvm_port_base of the same specialization. uvm_analysis_port #(bus_item) and uvm_analysis_imp_act #(pkt_item, …) are different types, so the compiler rejects both lines.",
      },
      {
        id: "mask",
        label: "UVM_ERROR \"does not provide the complete interface\".",
        correct: false,
        feedback: "Both ends are analysis interfaces, so the mask check would pass. The type parameters differ, and that is checked first, at compile time.",
      },
      {
        id: "route",
        label: "It works: `uvm_analysis_imp_decl routes each item to the right input by its suffix.",
        correct: false,
        feedback: "The suffix only chooses which write_<suffix>() method the imp calls on the scoreboard. Your connect() calls decide which stream reaches which imp.",
      },
    ],
  },
};

const HINTS = [
  "Pick the caller first: the end that needs the interface (a port, or an export passing calls down).",
  "Imps are always the argument of connect(), never the caller. An export never calls connect() on a port.",
  "Promote one level at a time: child port → parent port going up, parent export → child export or imp going down.",
];

export const TLM_BUILDER_ASSUMPTIONS = [
  "Checks follow uvm-core 2020.3.1 uvm_port_base::connect() and resolve_bindings(); UVM messages use that source's text.",
  "Mismatched transaction or interface types are compile errors. Real compilers word them differently.",
  "Hierarchy (relationship) checks only warn when check_connection_relationships is set, and analysis ports skip them.",
  "Log lines omit file and line numbers and are all at time 0.",
];

// ── Component ───────────────────────────────────────────────────────────────

type Mode = "build" | "debug";

export function TlmConnectionBuilderVisualizer() {
  const [scenarioId, setScenarioId] = useState<BuilderScenarioId>("agent");
  const [mode, setMode] = useState<Mode>("build");
  const [connections, setConnections] = useState<TlmConnection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [last, setLast] = useState<ConnectResult | null>(null);
  const [ran, setRan] = useState(false);
  const [checkRelationships, setCheckRelationships] = useState(false);

  const scenario = TLM_BUILDER_SCENARIOS.find((s) => s.id === scenarioId) ?? TLM_BUILDER_SCENARIOS[0];
  const { topo } = scenario;
  const layout = LAYOUTS[scenario.id];

  const resetBoard = (next: TlmConnection[] = []) => {
    setConnections(next);
    setSelected(null);
    setLast(null);
    setRan(false);
  };

  const shownConnections = mode === "debug" ? scenario.broken : connections;
  const elaboration = useMemo(
    () => elaborate(topo, shownConnections, { checkRelationships }),
    [topo, shownConnections, checkRelationships],
  );
  const goals = useMemo(() => goalStatus(topo, elaboration.connections, scenario.goals), [topo, elaboration, scenario.goals]);

  const pick = (id: string) => {
    if (mode !== "build") return;
    if (!selected) {
      setSelected(id);
      setLast(null);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    const result = checkConnect(topo, connections, selected, id, { checkRelationships });
    setLast(result);
    setSelected(null);
    setRan(false);
    if (result.accepted) setConnections((cs) => [...cs, { from: selected, to: id }]);
  };

  const removeConnection = (key: string) => {
    setConnections((cs) => cs.filter((c) => `${c.from}->${c.to}` !== key));
    setRan(false);
    setLast(null);
  };

  // Diagram
  const errorEnds = last && !last.accepted ? [last.from, last.to] : [];
  const nodes: DiagramNode[] = topo.components
    .filter((c) => layout.boxes[c.id])
    .map((c) => {
      const box = layout.boxes[c.id];
      return {
        id: c.id,
        label: c.name,
        sublabel: box.container ? undefined : (box.sublabel ?? c.cls),
        kind: NODE_KIND[c.kind] ?? "generic",
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        container: box.container,
      };
    });
  const ports: DiagramPort[] = topo.endpoints.map((ep) => ({
    id: ep.id,
    nodeId: ep.owner,
    side: layout.ports[ep.id]?.side ?? "left",
    offset: layout.ports[ep.id]?.offset ?? 0.5,
    kind: portKindOf(ep),
    label: ep.handle,
    state: selected === ep.id ? "active" : errorEnds.includes(ep.id) ? "error" : "normal",
  }));
  const edges: DiagramEdge[] = elaboration.connections.map((c) => ({
    id: `${c.from}->${c.to}`,
    from: c.from,
    to: c.to,
    style: "causal",
    label: methodLabel(topo.endpoints.find((e) => e.id === c.from) as TlmEndpoint),
  }));
  const diagramTitle = `${scenario.title}: ${elaboration.connections.length} connection${elaboration.connections.length === 1 ? "" : "s"}. ${
    elaboration.connections.map((c) => connectStatement(topo, c.from, c.to).code).join(" ") || "No connections yet."
  }`;

  const codeLines = connectCodeLines(topo, mode === "debug" ? scenario.broken : connections);
  const declarations = declarationSource(topo);
  const debug = DEBUG_QUESTIONS[scenario.id];

  const resolutionRows = topo.endpoints.map((ep) => ({ ep, res: elaboration.resolutions.get(ep.id) }));

  const elaborationPanel = (
    <div className="space-y-3" aria-live="polite">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {elaboration.compiles ? "Log up to start of run_phase" : "Compiler output"}
        </p>
        <pre
          aria-label="Simulation log"
          className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]"
        >
          {elaboration.log.length > 0
            ? elaboration.log.join("\n")
            : "UVM_INFO @ 0: reporter [RNTST] Running test bus_test...\n(no connection errors: end_of_elaboration passes and run_phase starts)"}
        </pre>
      </div>
      <p className={cn("text-sm font-medium", elaboration.runStarts ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
        {elaboration.runStarts
          ? "✓ end_of_elaboration passes: every port and export reaches an allowed number of imps."
          : elaboration.compiles
            ? `✕ ${elaboration.errorCount} UVM_ERROR${elaboration.errorCount === 1 ? "" : "s"} before run_phase, so uvm_root issues UVM_FATAL [BUILDERR]. run_phase never starts.`
            : "✕ The code does not compile, so simulation never starts."}
      </p>
      {elaboration.compiles ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-xs">
            <caption className="sr-only">Connection counts after resolve_bindings()</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-semibold">Endpoint</th>
                <th className="py-1 pr-2 font-semibold">Imps reached</th>
                <th className="py-1 pr-2 font-semibold">Allowed</th>
                <th className="py-1 font-semibold">Check</th>
              </tr>
            </thead>
            <tbody className="font-mono [font-variant-ligatures:none]">
              {resolutionRows.map(({ ep, res }) => (
                <tr key={ep.id} className="border-t border-border/50">
                  <td className="py-1 pr-2">
                    {GLYPH[portKindOf(ep)]} {ep.id}
                  </td>
                  <td className="py-1 pr-2">{res?.size ?? 0}</td>
                  <td className="py-1 pr-2">{range(ep.minSize, ep.maxSize)}</td>
                  <td className={cn("py-1", res?.status === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    {res?.status === "ok" ? "✓ ok" : res?.status === "below-min" ? "✕ below min" : "✕ above max"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );

  return (
    <VisualFrame
      label="TLM connection builder"
      eyebrow="Build it"
      title="TLM connection builder"
      summary="Pick the caller, then the provider. Each attempt runs uvm_port_base::connect()'s checks; run to end_of_elaboration to see resolve_bindings() count what each port reaches."
      fidelity="model"
      assumptions={TLM_BUILDER_ASSUMPTIONS}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Scenario"
          value={scenario.id}
          onChange={(id) => {
            setScenarioId(id);
            resetBoard();
          }}
          options={TLM_BUILDER_SCENARIOS.map((s) => ({ value: s.id, label: s.title }))}
        />
        <SegmentedControl
          label="Mode"
          value={mode}
          onChange={(m) => {
            setMode(m);
            resetBoard();
          }}
          options={[
            { value: "build", label: "Build" },
            { value: "debug", label: "Spot the bug" },
          ]}
        />
      </div>

      <p className="text-sm text-foreground">
        <span className="font-semibold">Goal: </span>
        {scenario.goal}
      </p>

      <BlockDiagram
        title={diagramTitle}
        width={layout.width}
        height={layout.height}
        nodes={nodes}
        ports={ports}
        edges={edges}
        minWidth={320}
        showLegend
      />
      <p className="text-xs text-muted-foreground">
        Dashed arrows point from caller to provider (the direction of the method call), labelled with the call. In a get connection the item then travels back against the arrow.
      </p>

      {mode === "build" ? (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]" role="group" aria-label="Ports, exports and imps">
            {topo.components
              .filter((c) => topo.endpoints.some((e) => e.owner === c.id))
              .map((c) => (
                <fieldset key={c.id} className="min-w-0 rounded-lg border border-border/60 p-2">
                  <legend className="px-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">
                    {c.name} · {c.cls}
                  </legend>
                  <div className="flex flex-col gap-1">
                    {topo.endpoints
                      .filter((e) => e.owner === c.id)
                      .map((ep) => {
                        const kind = portKindOf(ep);
                        const isSel = selected === ep.id;
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            aria-pressed={isSel}
                            aria-label={`${ep.id} (${ep.role}, ${ep.typeName})`}
                            onClick={() => pick(ep.id)}
                            className={cn(
                              "flex min-h-10 items-center gap-2 rounded-md border px-2 py-1 text-left font-mono text-xs [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSel ? "border-cyan-500 bg-cyan-500/15" : "border-border/70 hover:bg-muted",
                            )}
                          >
                            <span aria-hidden className="w-3 text-center">
                              {GLYPH[kind]}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{ep.handle}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {ep.role} · {ep.typeName}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </fieldset>
              ))}
          </div>

          <div aria-live="polite" className="min-h-6 text-sm">
            {selected ? (
              <p>
                Caller: <code className="font-mono [font-variant-ligatures:none]">{selected}</code>. Now pick the provider, the argument of{" "}
                <code className="font-mono">connect()</code>.
              </p>
            ) : last ? (
              <ConnectVerdict result={last} topo={topo} />
            ) : (
              <p className="text-muted-foreground">Pick the endpoint that calls connect().</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRan(true)} className={buttonClass("primary")}>
              Run to end_of_elaboration
            </button>
            <button type="button" onClick={() => resetBoard(scenario.solution)} className={buttonClass()}>
              Show a solution
            </button>
            <button type="button" onClick={() => resetBoard()} className={buttonClass()}>
              Reset
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={checkRelationships}
                onChange={(e) => {
                  setCheckRelationships(e.target.checked);
                  setRan(false);
                }}
                className="h-4 w-4 accent-cyan-500"
              />
              check_connection_relationships = 1
            </label>
          </div>
          <HintLadder hints={HINTS} resetKey={scenario.id} />

          {ran ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
              {elaborationPanel}
              <ul className="space-y-1 text-sm" aria-label="Goals">
                {goals.map((g) => (
                  <li key={`${g.from}-${g.reaches}`} className={g.met ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                    {g.met ? "✓" : "✕"} <code className="font-mono [font-variant-ligatures:none]">{g.from}</code> reaches{" "}
                    <code className="font-mono [font-variant-ligatures:none]">{g.reaches}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <PredictionPrompt resetKey={scenario.id} question={debug.question} options={debug.options}>
          <div className="space-y-3">
            {elaborationPanel}
            <button
              type="button"
              onClick={() => {
                setMode("build");
                resetBoard(elaboration.connections);
              }}
              className={buttonClass("primary")}
            >
              Fix it in the builder
            </button>
          </div>
        </PredictionPrompt>
      )}

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace
          label={mode === "debug" ? "connect_phase under test" : "Generated connect_phase code"}
          lines={codeLines.length ? codeLines : [{ text: "// no connect() calls yet" }]}
          activeKey={last?.accepted ? `${last.from}->${last.to}` : undefined}
          renderLineControl={
            mode === "build"
              ? (line) =>
                  line.key ? (
                    <button
                      type="button"
                      onClick={() => removeConnection(line.key as string)}
                      aria-label={`Remove ${line.text}`}
                      className="rounded-md border border-slate-500 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      remove
                    </button>
                  ) : null
              : undefined
          }
        />
        <details className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Declarations behind these symbols</summary>
          <div className="mt-2 space-y-3">
            {declarations.map((d) => (
              <div key={d.owner}>
                <p className="font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">class {d.cls}</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-2 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                  {d.lines.join("\n")}
                </pre>
              </div>
            ))}
            {scenario.id === "fifo" ? (
              <p className="text-xs text-muted-foreground">
                In uvm_tlm_analysis_fifo, analysis_export is a uvm_analysis_imp and get_export is another handle to the uvm_get_peek_imp named
                get_peek_export. Names that end in &quot;export&quot; are often imps.
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </VisualFrame>
  );
}

function ConnectVerdict({ result, topo }: { result: ConnectResult; topo: TlmTopology }) {
  const from = topo.endpoints.find((e) => e.id === result.from);
  const tone =
    result.kind === "ok" || result.kind === "duplicate"
      ? "text-emerald-700 dark:text-emerald-300"
      : result.kind === "uvm_warning"
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300";
  const heading =
    result.kind === "ok"
      ? "✓ Connected."
      : result.kind === "duplicate"
        ? "= Already connected."
        : result.kind === "uvm_warning"
          ? "! Connected, with a warning."
          : result.kind === "compile_error"
            ? "✕ Compile error. Not connected."
            : "✕ UVM_ERROR. Not connected.";
  return (
    <div className="space-y-1" data-testid="connect-verdict">
      <p className={cn("font-semibold", tone)}>
        {heading} <code className="font-mono font-normal [font-variant-ligatures:none]">{result.statement.code}</code>
      </p>
      {result.log ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/90 p-2 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">{result.log}</pre>
      ) : result.kind === "compile_error" ? (
        <p className="font-mono text-xs [font-variant-ligatures:none]">{result.message}</p>
      ) : null}
      <p className="text-muted-foreground">
        <strong className="text-foreground">Why: </strong>
        {result.why}
      </p>
      {result.accepted && !result.relationship.checked && result.statement.reachesInside.length > 0 ? (
        <p className="text-amber-700 dark:text-amber-300">
          ! UVM accepts this silently (analysis ports skip the hierarchy check), but the call reaches inside {result.statement.reachesInside.join(" and ")}. Promote
          through that component&apos;s own port or export so it stays reusable.
        </p>
      ) : null}
      {result.accepted && result.relationship.checked && !result.relationship.ok && result.kind === "ok" ? (
        <p className="text-amber-700 dark:text-amber-300">
          ! This skips a hierarchy level. UVM stays silent by default; with check_connection_relationships set it would warn: {result.relationship.message}
        </p>
      ) : null}
      {from && result.kind === "ok" ? (
        <p className="sr-only">
          {endpointFullName(topo, from)} now calls through to {result.to}.
        </p>
      ) : null}
    </div>
  );
}

function buttonClass(variant: "primary" | "plain" = "plain") {
  return cn(
    "inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
    variant === "primary" ? "bg-cyan-700 text-white hover:bg-cyan-800" : "border border-border/70 bg-background/60 text-foreground hover:bg-muted",
  );
}

export default TlmConnectionBuilderVisualizer;
