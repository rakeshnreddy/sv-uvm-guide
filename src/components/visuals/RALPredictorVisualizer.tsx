"use client";

import React, { useMemo, useState } from "react";

import {
  RAL_MODEL_ASSUMPTIONS,
  RegisterValueTable,
  StepCard,
  UvmLog,
} from "@/components/visualizers/RalRegisterMapVisualizer";
import {
  BlockDiagram,
  type DiagramEdge,
  type DiagramNode,
  type DiagramPort,
  type DiagramToken,
} from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  EXPLICIT_ENV,
  I2C_BLOCK,
  PREDICTION_MODES,
  TRAFFIC,
  TRAFFIC_KINDS,
  applyOp,
  initialState,
  mirroredChoices,
  predictionPath,
  runOps,
  runPredictionProbes,
  showHex,
  type PathBeat,
  type PathEdge,
  type PredictorWiring,
  type RalEnv,
  type RalOp,
  type TrafficKind,
} from "@/lib/ral-model";
import { cn } from "@/lib/utils";

const B = I2C_BLOCK;

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

type DiagramEdgeId = "test-reg" | "reg-map" | "map-adapter" | "adapter-drv" | "drv-dut" | "cpu-dut" | "dut-mon" | "mon-pred" | "pred-reg" | "bd";

/** Which drawn edge carries each step of the model's path. */
const EDGE_FOR: Record<PathEdge, DiagramEdgeId> = {
  "test-ral": "test-reg",
  "ral-adapter": "map-adapter",
  "adapter-sqr": "adapter-drv",
  "sqr-drv": "adapter-drv",
  "drv-dut": "drv-dut",
  "cpu-dut": "cpu-dut",
  "dut-mon": "dut-mon",
  "mon-pred": "mon-pred",
  "pred-ral": "pred-reg",
  auto: "reg-map",
  "ral-dut-backdoor": "bd",
};

const NODE_FOR: Record<PathBeat["node"], string> = {
  test: "test",
  ral: "reg",
  adapter: "adapter",
  sqr: "drv",
  drv: "drv",
  dut: "dut",
  mon: "mon",
  pred: "pred",
  cpu: "cpu",
};

function PathDiagram({ env, regName, beat }: { env: RalEnv; regName: string; beat: PathBeat | null }) {
  const activeNode = beat ? NODE_FOR[beat.node] : null;
  const activeEdge = beat?.edge ? EDGE_FOR[beat.edge] : null;
  const predAbsent = env.predictor === "absent";
  const unconnected = env.predictor === "unconnected";

  const nodeState = (id: string): DiagramNode["state"] => {
    if (id === "pred" && predAbsent) return "dim";
    if (id === activeNode) return beat?.tone === "error" ? "error" : beat?.tone === "skip" ? "dim" : "active";
    return "normal";
  };
  const nodes: DiagramNode[] = [
    { id: "test", label: "test", kind: "test", x: 10, y: 30, w: 110, h: 46, state: nodeState("test") },
    { id: "reg", label: `ral.${regName}`, sublabel: "desired · mirrored", kind: "reg", x: 160, y: 30, w: 150, h: 46, state: nodeState("reg") },
    { id: "map", label: "default_map", sublabel: `auto_predict = ${env.autoPredict ? 1 : 0}`, kind: "generic", x: 350, y: 30, w: 140, h: 46, state: nodeState("map") },
    { id: "cpu", label: "firmware", sublabel: "other initiator", kind: "generic", x: 520, y: 30, w: 130, h: 46, state: nodeState("cpu") },
    { id: "pred", label: "predictor", sublabel: predAbsent ? "not built" : "uvm_reg_predictor", kind: "predictor", x: 165, y: 104, w: 140, h: 40, state: nodeState("pred") },
    { id: "adapter", label: "adapter", sublabel: "reg2bus · bus2reg", kind: "generic", x: 350, y: 104, w: 140, h: 40, state: nodeState("adapter") },
    { id: "agent", label: "apb_agent", kind: "agent", x: 20, y: 160, w: 490, h: 72, container: true },
    { id: "mon", label: "mon", kind: "monitor", x: 165, y: 180, w: 140, h: 40, state: nodeState("mon") },
    { id: "drv", label: "sqr → drv", kind: "driver", x: 350, y: 180, w: 140, h: 40, state: nodeState("drv") },
    { id: "dut", label: "DUT registers", kind: "dut", x: 160, y: 264, w: 490, h: 56, state: nodeState("dut") },
  ];
  const ports: DiagramPort[] = [
    { id: "mon.ap", nodeId: "mon", side: "top", offset: 0.5, kind: "analysis_port" },
    { id: "pred.bus_in", nodeId: "pred", side: "bottom", offset: 0.5, kind: "analysis_imp" },
    { id: "pin-drv", nodeId: "dut", side: "top", offset: (420 - 160) / 490, kind: "port" },
    { id: "pin-mon", nodeId: "dut", side: "top", offset: (235 - 160) / 490, kind: "port" },
    { id: "pin-cpu", nodeId: "dut", side: "top", offset: (585 - 160) / 490, kind: "port" },
    { id: "pin-bd", nodeId: "dut", side: "right", offset: 0.5, kind: "port" },
  ];
  const edgeState = (id: DiagramEdgeId): DiagramEdge["state"] => {
    if (id === "mon-pred" && unconnected) return "error";
    if ((id === "mon-pred" || id === "pred-reg") && (predAbsent || unconnected)) return "dim";
    if (id === activeEdge) return beat?.tone === "error" ? "error" : "active";
    return "normal";
  };
  const edges: DiagramEdge[] = [
    { id: "test-reg", from: "test", to: "reg", style: "data", label: "call" },
    { id: "reg-map", from: "reg", to: "map", style: "data", label: "rw" },
    { id: "map-adapter", from: "map", to: "adapter", style: "data", label: "reg2bus" },
    { id: "adapter-drv", from: "adapter", to: "drv", style: "data", label: "item" },
    { id: "drv-dut", from: "drv", to: "pin-drv", style: "data", label: "bus" },
    { id: "cpu-dut", from: "cpu", to: "pin-cpu", style: "data", label: "bus" },
    { id: "dut-mon", from: "pin-mon", to: "mon", style: "data", label: "observe" },
    { id: "mon-pred", from: "mon.ap", to: "pred.bus_in", style: "data", label: unconnected ? "✕ not connected" : "write(tr)" },
    { id: "pred-reg", from: "pred", to: "reg", style: "causal", label: "do_predict" },
    { id: "bd", from: "reg", to: "pin-bd", style: "control", label: "backdoor (HDL)", points: [[235, 10], [655, 10], [655, 292]] },
  ].map((e) => ({ ...e, state: edgeState(e.id as DiagramEdgeId) }) as DiagramEdge);
  const tokens: DiagramToken[] =
    beat?.edge && beat.token
      ? [{ edgeId: EDGE_FOR[beat.edge], t: 0.5, label: beat.token, tone: beat.tone === "error" ? "error" : beat.edge === "auto" || beat.edge === "pred-ral" ? "control" : "data" }]
      : [];
  // The token names the payload, so the edge's own label steps aside while it is there.
  const shownEdges = edges.map((e) => (tokens.some((t) => t.edgeId === e.id) ? { ...e, label: undefined } : e));

  return (
    <div>
      <BlockDiagram
        title={`Register access path. ${beat ? `Now: ${beat.what}` : ""}`}
        width={660}
        height={330}
        nodes={nodes}
        ports={ports}
        edges={shownEdges}
        tokens={tokens}
        minWidth={300}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        ◆ analysis port (mon.ap) · ● analysis imp (predictor.bus_in) · ■ DUT pin · solid arrow = data · dashed = call (do_predict) · dotted = backdoor
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

function envCode(env: RalEnv): CodeTraceLine[] {
  const lines: CodeTraceLine[] = [
    { text: "function void my_env::connect_phase(uvm_phase phase);", key: "fn" },
    { text: "  ral.default_map.set_sequencer(agent.sqr, adapter);", key: "seqr", owner: "testbench" },
    { text: `  ral.default_map.set_auto_predict(${env.autoPredict ? 1 : 0});${env.autoPredict ? "  // implicit prediction" : "  // 0 is the default"}`, key: "auto", owner: "testbench" },
  ];
  if (env.predictor === "absent") {
    lines.push({ text: "  // no uvm_reg_predictor in this env", key: "nopred" });
  } else {
    lines.push({ text: "  predictor.map     = ral.default_map;", key: "map", owner: "testbench" });
    lines.push({ text: "  predictor.adapter = adapter;", key: "adapter", owner: "testbench" });
    lines.push(
      env.predictor === "connected"
        ? { text: "  agent.mon.ap.connect(predictor.bus_in);  // explicit prediction", key: "connect", owner: "testbench" }
        : { text: "  // agent.mon.ap.connect(predictor.bus_in);  // missing", key: "connect", owner: "testbench" },
    );
  }
  lines.push({ text: "endfunction", key: "end" });
  return lines;
}

function PathExperiment() {
  const [auto, setAuto] = useState<"0" | "1">("0");
  const [predictor, setPredictor] = useState<PredictorWiring>("connected");
  const [traffic, setTraffic] = useState<TrafficKind>("ral-write");
  const env: RalEnv = useMemo(() => ({ ...EXPLICIT_ENV, autoPredict: auto === "1", predictor }), [auto, predictor]);
  const op = TRAFFIC[traffic].op;
  const step = useMemo(() => applyOp(B, env, initialState(B), op), [env, op]);
  const beats = useMemo(() => predictionPath(B, env, step), [env, step]);
  const choices = useMemo(() => mirroredChoices(B, step), [step]);
  const key = `${auto}-${predictor}-${traffic}`;
  const playback = usePlayback(beats.length, key);
  const beat = beats[Math.min(playback.index, beats.length - 1)] ?? null;
  const regName = "reg" in op ? op.reg : "CTRL";

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[300px] border-collapse text-left text-xs">
          <caption className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Three ways the mirror gets updated</caption>
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-1.5">Mode</th>
              <th scope="col" className="px-2 py-1.5">Turn it on</th>
              <th scope="col" className="px-2 py-1.5">Who predicts</th>
              <th scope="col" className="px-2 py-1.5">Sees firmware / DMA writes?</th>
              <th scope="col" className="px-2 py-1.5">Failure mode</th>
            </tr>
          </thead>
          <tbody>
            {PREDICTION_MODES.map((m) => (
              <tr key={m.id} className="border-t border-border/60 align-top">
                <th scope="row" className="px-2 py-1.5 font-semibold text-foreground">{m.name}</th>
                <td className="px-2 py-1.5 font-mono text-[11px] [font-variant-ligatures:none]">{m.code}</td>
                <td className="px-2 py-1.5">{m.updates}</td>
                <td className="px-2 py-1.5">{m.seesOtherTraffic ? "✓ yes" : "✕ no"}</td>
                <td className="px-2 py-1.5">{m.failure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Implicit: map.set_auto_predict()</p>
          <SegmentedControl
            label="Auto-predict"
            mono
            value={auto}
            onChange={setAuto}
            options={[
              { value: "0", label: "0 (default)" },
              { value: "1", label: "1" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Explicit: uvm_reg_predictor</p>
          <SegmentedControl
            label="Predictor"
            value={predictor}
            onChange={setPredictor}
            options={[
              { value: "connected", label: "connected" },
              { value: "unconnected", label: "built, not connected" },
              { value: "absent", label: "none" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Access</p>
          <SegmentedControl label="Access" mono value={traffic} onChange={setTraffic} options={TRAFFIC_KINDS.map((k) => ({ value: k, label: TRAFFIC[k].label }))} />
        </div>
      </div>

      <CodeTrace label="Generated env wiring" lines={envCode(env)} />

      <PredictionPrompt
        resetKey={key}
        question={
          <>
            Start from reset (mirror and DUT all 0). After <span className="font-mono [font-variant-ligatures:none]">{TRAFFIC[traffic].label}</span>, what does{" "}
            <span className="font-mono [font-variant-ligatures:none]">ral.{regName}.get_mirrored_value()</span> return?
          </>
        }
        options={choices.map((c) => ({ id: c.id, label: <span className="font-mono">{c.label}</span>, correct: c.correct, feedback: c.feedback }))}
      >
        <div className="space-y-3">
          <PathDiagram env={env} regName={regName} beat={beat} />
          <PlaybackControls playback={playback} stepCount={beats.length} stepNoun="Path step" describeStep={(i) => beats[i]?.what ?? ""} />
          {beat ? (
            <div
              aria-live="polite"
              className={cn(
                "rounded-xl border p-3 text-sm",
                beat.tone === "error" ? "border-rose-500/50 bg-rose-500/10" : beat.tone === "skip" ? "border-border/70 bg-muted/20" : "border-cyan-500/40 bg-cyan-500/[0.06]",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Step {Math.min(playback.index, beats.length - 1) + 1} of {beats.length}
                {beat.tone === "error" ? " · ✕ broken" : beat.tone === "skip" ? " · — not involved" : ""}
              </p>
              <p className="mt-1 text-foreground">
                <strong>What: </strong>
                {beat.what}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">Why: </strong>
                {beat.why}
              </p>
            </div>
          ) : null}
          <RegisterValueTable block={B} regName={regName} state={step.after} previous={step.before} caption={`ral.${regName} after the access`} />
          <StepCard step={step} block={B} />
        </div>
      </PredictionPrompt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debug: the mirror never updates
// ---------------------------------------------------------------------------

const BUGGY_ENV: RalEnv = { ...EXPLICIT_ENV, predictor: "unconnected" };

const SUSPECTS: Record<string, { culprit: boolean; feedback: string }> = {
  seqr: { culprit: false, feedback: "Without set_sequencer() the write could not reach the bus at all. The DUT did change, so the frontdoor path works." },
  auto: { culprit: false, feedback: "0 is the default and is right for explicit prediction. Setting it to 1 would hide the bug for RAL traffic only." },
  map: { culprit: false, feedback: "A null predictor.map would stop the simulation with a null-handle error at the first observed transfer. This run ends cleanly." },
  adapter: { culprit: false, feedback: "A null predictor.adapter gives UVM_FATAL REG/WRITE/NULL at the first observed transfer. Nothing like that is in the log." },
  connect: {
    culprit: true,
    feedback:
      "Found it. The connect() is commented out, so mon.ap has no subscriber. An analysis port may legally have zero connections, so UVM stays silent while the predictor never runs.",
  },
};

const DEBUG_CODE: CodeTraceLine[] = [
  { text: "function void my_env::connect_phase(uvm_phase phase);", key: "fn" },
  { text: "  ral.default_map.set_sequencer(agent.sqr, adapter);", key: "seqr", owner: "testbench" },
  { text: "  ral.default_map.set_auto_predict(0);", key: "auto", owner: "testbench" },
  { text: "  predictor.map     = ral.default_map;", key: "map", owner: "testbench" },
  { text: "  predictor.adapter = adapter;", key: "adapter", owner: "testbench" },
  { text: "  // agent.mon.ap.connect(predictor.bus_in);  // disabled during bring-up", key: "connect", owner: "testbench" },
  { text: "endfunction", key: "end" },
];

interface ConnectionFix {
  id: string;
  label: string;
  env: RalEnv;
  extra?: (reg: string) => RalOp[];
  review: string;
  reviewOk: boolean;
}

const FIXES: ConnectionFix[] = [
  {
    id: "connect",
    label: "Restore agent.mon.ap.connect(predictor.bus_in);",
    env: EXPLICIT_ENV,
    review: "Accepted. Explicit prediction now sees every transfer on the bus, including firmware traffic.",
    reviewOk: true,
  },
  {
    id: "auto",
    label: "Leave it commented; call set_auto_predict(1) instead",
    env: { ...BUGGY_ENV, autoPredict: true },
    review: "Passes the RAL-only test, fails as soon as another initiator writes a register. Use auto-predict only when the RAL is the only master.",
    reviewOk: false,
  },
  {
    id: "both",
    label: "Restore connect() and also set_auto_predict(1)",
    env: { ...EXPLICIT_ENV, autoPredict: true },
    review: "Rejected. Every RAL write is now predicted twice. Idempotent fields hide it; the W1T LED toggles back in the mirror.",
    reviewOk: false,
  },
  {
    id: "mirror",
    label: "Call ral.<reg>.mirror(status, UVM_NO_CHECK) after every write",
    env: BUGGY_ENV,
    extra: (reg) => [{ kind: "mirror", reg, check: false }],
    review: "Rejected. A frontdoor mirror() refreshes the mirror only through a predictor or auto-predict. With neither, it reads the DUT and changes nothing.",
    reviewOk: false,
  },
];

function ConnectionDebug() {
  const symptom = useMemo(
    () =>
      runOps(B, BUGGY_ENV, [
        { kind: "write", reg: "CTRL", value: 0x5 },
        { kind: "mirror", reg: "CTRL", check: true },
      ]),
    [],
  );
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const found = suspect ? SUSPECTS[suspect]?.culprit === true : false;
  const fix = FIXES.find((f) => f.id === fixId);
  const probes = useMemo(() => (fix ? runPredictionProbes(B, fix.env, fix.extra) : null), [fix]);
  const allOk = probes?.every((p) => p.ok) ?? false;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A test writes CTRL and then checks it. The DUT holds the new value, but the mirror stays at reset and the check fails. No warning, no fatal. Find the line in the
        env that breaks prediction.
      </p>
      <UvmLog messages={symptom.steps.flatMap((s) => s.messages).filter((m) => m.verbosity !== "UVM_HIGH")} label="Test log" />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <CodeTrace
            label="Env connect_phase"
            lines={DEBUG_CODE}
            activeKey={suspect ?? undefined}
            renderLineControl={(line) =>
              line.key && SUSPECTS[line.key] ? (
                <button
                  type="button"
                  aria-pressed={suspect === line.key}
                  aria-label={`Suspect line: ${line.text.trim()}`}
                  onClick={() => setSuspect(line.key as string)}
                  className={cn(
                    "min-h-8 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                    suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                  )}
                >
                  {suspect === line.key ? "suspected" : "suspect"}
                </button>
              ) : null
            }
          />
        </div>
        <div className="min-w-0">
          <RegisterValueTable block={B} regName="CTRL" state={symptom.final} caption="CTRL after write + mirror" />
        </div>
      </div>
      {suspect ? (
        <p aria-live="polite" className={cn("text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          <strong>{found ? "✓ " : "✕ Not this one. "}</strong>
          {SUSPECTS[suspect].feedback}
        </p>
      ) : null}
      {!found ? (
        <HintLadder
          hints={[
            "The DUT has the value, so the frontdoor path (sequencer, adapter.reg2bus, driver) works.",
            "With auto-predict at 0, which component is the only thing that can update the mirror?",
            "How does a transfer reach predictor.bus_in?",
          ]}
        />
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Choose a fix; the model reruns three probes from reset</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {FIXES.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="ral-predictor-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                <span className="min-w-0 break-words font-mono text-[12px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          {fix && probes ? (
            <div
              aria-live="polite"
              className={cn("mt-3 space-y-2 rounded-xl border p-3 text-sm", allOk && fix.reviewOk ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}
            >
              <ul className="space-y-1">
                {probes.map((p) => (
                  <li key={p.id} className="font-mono text-[12px] [font-variant-ligatures:none]">
                    <span className={p.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>{p.ok ? "✓" : "✕"}</span> {p.label}: mirror{" "}
                    {showHex(p.mirrored)} · DUT {showHex(p.dut)} — {p.note}
                  </li>
                ))}
              </ul>
              <p className="text-foreground/90">
                <strong>Review: </strong>
                {fix.reviewOk ? "✓ " : "✕ "}
                {fix.review}
              </p>
            </div>
          ) : null}
        </fieldset>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual
// ---------------------------------------------------------------------------

export default function RALPredictorVisualizer() {
  const [mode, setMode] = useState<"experiment" | "debug">("experiment");
  return (
    <VisualFrame
      label="RAL prediction paths"
      eyebrow="Experiment"
      title="Who updates the mirror?"
      summary={
        <>
          <strong>Implicit</strong> prediction is <code>set_auto_predict(1)</code>: the map predicts the accesses the register model starts. <strong>Explicit</strong>{" "}
          prediction is a <code>uvm_reg_predictor</code> fed by the bus monitor: it predicts every transfer on the bus. Pick a wiring and an access, predict the
          mirror, then step through the path.
        </>
      }
      fidelity="model"
      assumptions={[...RAL_MODEL_ASSUMPTIONS, "Firmware shares the bus the monitor watches. The predictor runs before auto-predict; the order does not change any result."]}
    >
      <SegmentedControl
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "experiment", label: "Experiment" },
          { value: "debug", label: "Debug: the mirror never updates" },
        ]}
      />
      {mode === "experiment" ? <PathExperiment /> : <ConnectionDebug />}
    </VisualFrame>
  );
}
