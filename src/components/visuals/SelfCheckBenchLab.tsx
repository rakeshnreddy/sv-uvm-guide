"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramToken } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { layoutGridDiagram } from "@/components/visual-system/diagram-layout";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { MutationMatrix, cellKey, type MutationCell, type MutationPrediction } from "@/components/visual-system/MutationMatrix";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ALL_TEST_IDS,
  ANATOMY_EDGES,
  ANATOMY_NODES,
  CLINIC_CASES,
  MATRIX_MUTANTS,
  PRESETS,
  TESTS,
  benchSource,
  buildMatrix,
  clinicCase,
  columnId,
  diagnoseSuspect,
  dutSource,
  edgePrediction,
  explainEscape,
  formatDec,
  formatLogLine,
  formatTime,
  gradeFix,
  mutantInfo,
  presetConfig,
  queuePrediction,
  runBench,
  suspectKeys,
  waveValue,
  type Bug1Outcome,
  type ClinicCaseId,
  type ClinicFix,
  type EdgeStep,
  type Expectation,
  type LogLine,
  type MutantId,
  type PresetId,
  type RunResult,
  type Step,
  type TestId,
} from "@/lib/selfcheck-bench-model";
import { cn } from "@/lib/utils";

export const SELFCHECK_MODEL_ASSUMPTIONS = [
  "Edge k is the rising edge at 5 + 10k ns. Every value shown at edge k is the one sampled there: what the flops and the checker read before that edge's nonblocking updates land (IEEE 1800-2023 §4.9.4, §10.4.2).",
  "The checker, the DUT and the bench tasks all read pre-edge values. The model runs them in a fixed order (checker, DUT, tasks); the lesson's bench does not depend on that order, because its only shared blocking state is exp_q, pushed and popped at opposite ends.",
  "Rules implemented: pop_front on an empty queue (§7.10.2.4), != and if with x (§11.4.5, §12.4), immediate assertions (§16.3), 2-state copies (§6.11.2), $error/$fatal/$finish/$stop (§20.10, §20.2), a run with no activity (§9.6.1), join_any and disable fork (§9.3.2, §9.6.3), uninitialised logic (§6.8) and ~x (§11.4.8).",
  "Error lines use [error @ t] for the simulator's own prefix. Lines marked (model @ t) and 'still running at the horizon' are this model's notes, not simulator messages.",
];

type Mode = "step" | "matrix" | "debug";

interface Props {
  /** "step": one run edge by edge; "matrix": tests × mutants; "debug": broken-bench clinic. */
  mode?: Mode;
  /** `+TEST=` of the first run shown in step mode. */
  preset?: PresetId;
  /** The DUT of the first run shown in step mode (0, 1, 2, 3, "extra-stage", "swap-ab"). */
  bug?: MutantId | string | number;
  /** "anatomy": step mode shows only the anatomy pane, the narration and the code. */
  focus?: "anatomy";
}

const MUTANT_OPTIONS: { value: string; mutant: MutantId; label: string; advanced?: boolean }[] = [
  { value: "0", mutant: 0, label: "BUG=0" },
  { value: "1", mutant: 1, label: "BUG=1" },
  { value: "2", mutant: 2, label: "BUG=2" },
  { value: "3", mutant: 3, label: "BUG=3", advanced: true },
  { value: "extra-stage", mutant: "extra-stage", label: "extra stage", advanced: true },
  { value: "swap-ab", mutant: "swap-ab", label: "a/b swapped", advanced: true },
];

function normalizeMutant(bug: Props["bug"]): MutantId {
  const text = String(bug ?? "0");
  const found = MUTANT_OPTIONS.find((o) => o.value === text);
  if (found) return found.mutant;
  return text === "x-carry" ? "x-carry" : 0;
}

const isPreset = (p: unknown): p is PresetId => typeof p === "string" && (PRESETS as readonly string[]).includes(p);

/**
 * Mounted only inside a PredictionPrompt's revealed area, so the parent knows
 * which run the gate was opened for. The parent compares that key with the
 * current one, so no render shows a new run through a gate opened for an old one.
 */
function RevealSignal({ gateKey, onChange }: { gateKey: string; onChange: (key: string | null) => void }) {
  useEffect(() => {
    onChange(gateKey);
    return () => onChange(null);
  }, [gateKey, onChange]);
  return null;
}

const toOptions = (spec: { options: { id: string; label: string; correct: boolean; feedback: string }[] } | null): PredictionOption[] =>
  spec ? spec.options.map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.correct, feedback: o.feedback })) : [];

const shortLabel = (step: Step): string =>
  step.kind === "edge" ? `Edge ${step.edge} (${formatTime(step.time)})` : step.kind === "end" ? `Run ends (${formatTime(step.time)})` : step.kind === "wdog" ? `Watchdog (${formatTime(step.time)})` : step.kind === "stop" ? `$stop (${formatTime(step.time)})` : `Still running (${formatTime(step.time)})`;

/* ------------------------------------------------------------------ */
/* Waveform                                                             */
/* ------------------------------------------------------------------ */

function waveSignals(run: RunResult, showOutputs: boolean): CycleSignal[] {
  const bit = (name: keyof RunResult["signals"]): CycleSignal => ({ name, kind: "bit", values: run.signals[name].map(waveValue) });
  const bus = (name: keyof RunResult["signals"]): CycleSignal => ({ name, kind: "bus", values: run.signals[name].map(waveValue) });
  const out: CycleSignal[] = [{ name: "clk", kind: "clock" }, bit("rst_n"), bit("in_valid"), bus("a"), bus("b")];
  if (showOutputs) out.push(bit("out_valid"), bus("sum"));
  return out;
}

function waveMarkers(run: RunResult, showOutputs: boolean, showQueue: boolean): CycleMarker[] {
  const markers: CycleMarker[] = [];
  for (const step of run.steps) {
    if (step.kind !== "edge") continue;
    const c = step.checker;
    const t = formatTime(step.time);
    if (showOutputs && (c.kind === "pass" || c.kind === "x-pass")) {
      markers.push({
        edge: step.edge,
        tone: c.kind === "pass" ? "pass" : "vacuous",
        label: `Edge ${step.edge} (${t}): ${c.kind === "pass" ? `checker matches sum = ${formatDec(c.actual)}` : `an X result (${formatDec(c.actual)}) counted as a pass by !=`}`,
        short: formatDec(c.actual),
      });
    } else if (showOutputs && (c.kind === "fail" || c.kind === "unexpected" || c.kind === "hold-fail" || c.kind === "x-out-valid")) {
      markers.push({ edge: step.edge, tone: "fail", label: `Edge ${step.edge} (${t}): ${showQueue ? step.narration.checker : step.narration.checkerNoQueue}`, short: "CHK" });
    } else if (step.events.some((e) => e.kind === "send" || e.kind === "send_invalid")) {
      markers.push({ edge: step.edge, tone: "drive", label: `Edge ${step.edge} (${t}): ${showQueue ? step.narration.bench : step.narration.benchNoQueue}`, short: step.events.some((e) => e.kind === "send") ? "send" : "inv" });
    } else if (showOutputs && /samples in_valid = 1/.test(step.dutNote)) {
      markers.push({ edge: step.edge, tone: "sample", label: `Edge ${step.edge} (${t}): the DUT ${step.dutNote}`, short: "DUT" });
    } else if (step.events.some((e) => e.kind === "reset-release")) {
      markers.push({ edge: step.edge, tone: "drive", label: `Edge ${step.edge} (${t}): reset released with rst_n <= 1`, short: "rst" });
    }
  }
  return markers;
}

/** CycleWaveform's geometry at the cycle width used here: edge k sits at 76 + 40k + 20 px. */
const WAVE_LABEL_W = 76;
const WAVE_CYCLE_W = 40;

function BenchWaveform({
  run,
  cursor,
  showOutputs,
  showQueue = true,
  onSelectEdge,
  explainCause = true,
}: {
  run: RunResult;
  cursor?: number;
  showOutputs: boolean;
  showQueue?: boolean;
  onSelectEdge?: (edge: number) => void;
  /** The dead clock's explanation names its cause, so the clinic holds it back until the culprit is found. */
  explainCause?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the cursor in view by scrolling the waveform's own box; scrollIntoView would also move the page.
    const box = ref.current?.querySelector<HTMLElement>(".overflow-x-auto");
    if (!box || cursor === undefined || box.clientWidth === 0) return;
    const x = WAVE_LABEL_W + WAVE_CYCLE_W * cursor + WAVE_CYCLE_W / 2;
    const left = box.scrollLeft + WAVE_LABEL_W;
    const right = box.scrollLeft + box.clientWidth - WAVE_CYCLE_W;
    if (x < left || x > right) box.scrollLeft = Math.max(0, x - box.clientWidth / 2);
  }, [cursor, run.edges]);
  if (run.clock === "x" || run.edges === 0) {
    return (
      <div role="img" aria-label="Waveform: clk stays x, so there is no rising edge to sample at" className="rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-3 text-sm">
        <p className="font-semibold text-foreground">
          <span aria-hidden>✕ </span>No waveform: <span className="font-mono">clk</span> stays x from 0 ns to the watchdog&apos;s {formatTime(run.endTime)}.
        </p>
        {explainCause ? (
          <p className="mt-1 text-xs text-muted-foreground">
            A posedge needs a transition toward 1 (Table 9-2). <span className="font-mono">logic clk;</span> starts at x (§6.8) and <span className="font-mono">~x</span> is x (§11.4.8), so nothing clocked ever runs.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div ref={ref} className="min-w-0">
      <CycleWaveform
        title={`tb_top waveform, +TEST=${run.config.testName}, ${mutantInfo(run.config.mutant).label}`}
        signals={waveSignals(run, showOutputs)}
        edges={run.edges}
        markers={waveMarkers(run, showOutputs, showQueue)}
        cursor={cursor}
        onSelectEdge={onSelectEdge}
        cycleWidth={WAVE_CYCLE_W}
        caption={`x-axis: rising edges of clk; edge k is at ${formatTime(5)} + 10k ns and each value is the one sampled at that edge. ◆ a drive by the bench, ▼ the DUT sampling a valid input, ✓/✕ the checker's verdict, ○ an X result that != counted as a pass.${
          showOutputs ? "" : " out_valid and sum are hidden until you predict."
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Queue strip, counters, log                                           */
/* ------------------------------------------------------------------ */

function ExpChip({ exp, state }: { exp: Expectation; state: "held" | "pushed" | "popped-pass" | "popped-fail" }) {
  const label = `${formatDec(exp.a)} + ${formatDec(exp.b)} → ${formatDec(exp.sum)}`;
  const tag = state === "pushed" ? "push_back" : state === "popped-pass" ? "pop_front ✓" : state === "popped-fail" ? "pop_front ✕" : "EXP";
  return (
    <li
      className={cn(
        "flex shrink-0 flex-col rounded-lg border px-2 py-1 font-mono text-xs transition-all duration-300 motion-reduce:transition-none [font-variant-ligatures:none]",
        state === "held" && "border-dashed border-teal-500/70 text-teal-800 dark:text-teal-200",
        state === "pushed" && "border-teal-500 bg-teal-500/10 text-teal-900 ring-2 ring-cyan-400 dark:text-teal-100",
        state === "popped-pass" && "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 opacity-80 dark:text-emerald-200",
        state === "popped-fail" && "border-rose-500/60 bg-rose-500/10 text-rose-800 opacity-80 dark:text-rose-200",
      )}
      aria-label={`${label}${state === "pushed" ? ", just pushed" : state === "popped-pass" ? ", popped and matched" : state === "popped-fail" ? ", popped, mismatch" : ""}`}
    >
      <span className="text-[11px] font-sans font-bold uppercase tracking-wider opacity-80">
        {tag}
        {state === "pushed" ? <span aria-hidden> ▲</span> : null}
      </span>
      <span className="font-semibold">{formatDec(exp.sum)}</span>
      <span className="text-[11px] opacity-80">
        {formatDec(exp.a)}+{formatDec(exp.b)}
      </span>
    </li>
  );
}

function QueueStrip({ step }: { step: Step }) {
  const edge = step.kind === "edge" ? step : null;
  const popped = edge?.popped ?? null;
  const poppedState = edge && popped ? (edge.checker.kind === "pass" || edge.checker.kind === "x-pass" ? "popped-pass" : "popped-fail") : null;
  const pushedIds = new Set(edge?.pushed.map((e) => e.id) ?? []);
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        exp_q[$] <span className="normal-case tracking-normal">· oldest first · {step.queueAfter.length} waiting</span>
      </p>
      <ol aria-label={`exp_q after this step, oldest first: ${step.queueAfter.length ? step.queueAfter.map((e) => formatDec(e.sum)).join(", ") : "empty"}`} className="flex min-h-12 items-stretch gap-2 overflow-x-auto pb-1">
        {popped && poppedState ? <ExpChip exp={popped} state={poppedState} /> : null}
        {popped ? <li aria-hidden className="self-center text-muted-foreground">│</li> : null}
        {step.queueAfter.length === 0 ? <li className="self-center text-xs text-muted-foreground">{"{}"} empty</li> : null}
        {step.queueAfter.map((e) => (
          <ExpChip key={e.id} exp={e} state={pushedIds.has(e.id) ? "pushed" : "held"} />
        ))}
      </ol>
    </div>
  );
}

function Counters({ step }: { step: Step }) {
  return (
    <dl className="flex flex-wrap gap-2 font-mono text-sm [font-variant-ligatures:none]">
      <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-200">
        <dt className="text-xs">pass_cnt</dt>
        <dd className="font-semibold">{step.passCnt}</dd>
      </div>
      <div className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1", step.failCnt > 0 ? "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200" : "border-border/70 text-muted-foreground")}>
        <dt className="text-xs">fail_cnt</dt>
        <dd className="font-semibold">{step.failCnt}</dd>
      </div>
    </dl>
  );
}

function LogPanel({ lines, label = "Simulation log" }: { lines: LogLine[]; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = lines.length;
  useEffect(() => {
    // Follow the newest line inside this panel only: wrapped errors would otherwise push the summary below the fold.
    const box = ref.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count]);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <p className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div
        ref={ref}
        role="region"
        tabIndex={0}
        aria-label={`Scrollable log: ${label}`}
        className="max-h-56 overflow-auto px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        <ol aria-label={label} className="font-mono text-[12px] leading-6 [font-variant-ligatures:none]">
          {lines.length === 0 ? <li className="text-slate-400">(nothing printed yet)</li> : null}
          {lines.map((l, i) => (
            <li
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words",
                l.kind === "error" && "text-rose-300",
                l.kind === "fatal" && "font-semibold text-rose-200",
                l.kind === "summary" && "font-semibold text-cyan-200",
                l.kind === "note" && "italic text-slate-400",
              )}
            >
              {formatLogLine(l)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code and anatomy                                                     */
/* ------------------------------------------------------------------ */

function BenchCode({
  run,
  activeKey,
  contextKeys,
  renderLineControl,
  label = "tb_top (generated from the model's data)",
}: {
  run: RunResult;
  activeKey?: string;
  contextKeys?: string[];
  renderLineControl?: (line: CodeTraceLine) => React.ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo<CodeTraceLine[]>(() => {
    const dut = dutSource(run.config.mutant).map((l) => ({ text: l.text, key: l.key, owner: l.owner }));
    const tb = benchSource(run.config).map((l) => ({ text: l.text, key: l.key, owner: l.owner }));
    return [...dut, { text: "" }, ...tb];
  }, [run.config]);
  useEffect(() => {
    // Scroll only this panel. scrollIntoView would also move every ancestor scroll box, the page included,
    // and at phone widths the code sits below the controls the learner is pressing.
    const box = ref.current;
    const line = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!box || !line) return;
    const boxRect = box.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    if (lineRect.top >= boxRect.top && lineRect.bottom <= boxRect.bottom) return; // already in view
    box.scrollTop += lineRect.top - boxRect.top - (box.clientHeight - lineRect.height) / 2;
  }, [activeKey]);
  return (
    <div
      ref={ref}
      className="min-w-0 max-h-[30rem] overflow-y-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      // With no line controls nothing inside takes focus, so the scroller itself must, for keyboard users.
      {...(renderLineControl ? {} : { role: "region", tabIndex: 0, "aria-label": `Scrollable code: ${label}` })}
    >
      <CodeTrace label={label} lines={lines} activeKey={activeKey} contextKeys={contextKeys} renderLineControl={renderLineControl} />
    </div>
  );
}

const ANATOMY_LAYOUT = layoutGridDiagram({
  nodes: ANATOMY_NODES.map((n) => ({ id: n.id, label: n.label, sublabel: n.sublabel, kind: n.kind, col: n.col, row: n.row, colSpan: n.colSpan, rowSpan: n.rowSpan, container: n.container })),
  edges: ANATOMY_EDGES.map((e) => ({ id: e.id, from: e.from, to: e.to, style: e.style, label: e.label })),
  cellWidth: 150,
  cellHeight: 56,
  gapX: 110,
  gapY: 46,
});

/* Gating a step before the predictions are locked in. */

/** tb_top lines the bench side executes; the checker's and the DUT's lines stay unlit until the first reveal. */
const BENCH_ACTIVE_KEYS: readonly string[] = ["reset-release", "send-drive", "send-invalid", "idle", "run-display", "main-finish"];
const BENCH_CONTEXT_KEYS = new Set<string>(["reset-task", "reset-release", "send-drive", "send-push", "send-invalid", "idle", "run-display", "drain", "main-disable", "main-report", "main-finish"]);
const BENCH_NODE_OF: Record<string, string> = { "reset-release": "gen", "send-drive": "stim", "send-invalid": "stim", idle: "stim", "run-display": "tests", "main-finish": "rpt" };
/** Anatomy edges whose tokens carry the queue's contents. */
const QUEUE_EDGE_IDS = new Set(["model-q", "q-chk"]);

/**
 * The step as the panes may show it while a prediction is pending. Before the
 * edge question is answered only the bench's part remains: a bench node, a
 * bench line, no verdict and no tokens. Before the exp_q question is answered
 * the tokens travelling into or out of exp_q are dropped, since together they
 * spell out the queue.
 */
function gateStep(step: Step, showOutputs: boolean, showQueue: boolean): Step {
  if (showOutputs && showQueue) return step;
  if (showOutputs) return { ...step, tokens: step.tokens.filter((t) => !QUEUE_EDGE_IDS.has(t.edgeId)) };
  const keys = [step.activeKey, ...step.contextKeys];
  const activeKey = keys.find((k) => BENCH_ACTIVE_KEYS.includes(k)) ?? "";
  const contextKeys = keys.filter((k) => k !== activeKey && (BENCH_CONTEXT_KEYS.has(k) || k.startsWith("test-")));
  const node = BENCH_NODE_OF[activeKey] ?? "";
  if (step.kind === "edge") return { ...step, tokens: [], activeKey, contextKeys, node, checker: { kind: "absent" } };
  return { ...step, tokens: [], activeKey, contextKeys, node };
}

/** Narration of a non-edge step while the first gate is closed: the ending without report()'s counters. */
function gatedMomentNarration(step: Step): string {
  const ending = step.kind === "end" ? "report() printed the summary and $finish ended the run" : step.kind === "wdog" ? "the watchdog printed the summary and ended the run with $fatal" : step.kind === "stop" ? "report() printed the summary and $stop suspended the run" : "report() printed the summary and the run keeps going";
  return `${formatTime(step.time)}: ${ending}. (The counters are hidden until you predict.)`;
}

/** The status line for a step, with only what the open gates allow. */
function stepNarration(step: Step, showOutputs: boolean, showQueue: boolean): string {
  if (step.kind !== "edge") return showOutputs ? step.what : gatedMomentNarration(step);
  if (showOutputs) return showQueue ? step.what : step.narration.queueHidden;
  return `${showQueue ? step.narration.bench : step.narration.benchNoQueue} (The DUT's and the checker's part of this edge is hidden until you predict.)`;
}

function AnatomyDiagram({ step, selectedId, onSelect, hidden }: { step: Step; selectedId?: string; onSelect: (nodeId: string) => void; hidden?: "outputs" | "queue" }) {
  const failing = step.kind === "edge" && (step.checker.kind === "fail" || step.checker.kind === "unexpected" || step.checker.kind === "hold-fail" || step.checker.kind === "x-out-valid");
  const passing = step.kind === "edge" && (step.checker.kind === "pass" || step.checker.kind === "x-pass");
  const activeEdges = new Set(step.tokens.map((t) => t.edgeId));
  const nodes: DiagramNode[] = ANATOMY_LAYOUT.nodes.map((n) => ({
    ...n,
    state: n.id === step.node ? (n.id === "chk" && failing ? "error" : n.id === "chk" && passing ? "ok" : "active") : "normal",
  }));
  const edges: DiagramEdge[] = ANATOMY_LAYOUT.edges.map((e) => ({ ...e, state: activeEdges.has(e.id) ? "active" : "normal" }));
  const tokens: DiagramToken[] = step.tokens.map((t) => ({ edgeId: t.edgeId, t: t.t, label: t.label, tone: "data" }));
  const nodeLabel = step.node ? (ANATOMY_NODES.find((n) => n.id === step.node)?.label ?? step.node) : "";
  const activity = nodeLabel ? `${nodeLabel} is active` : "the bench is waiting on this edge; the DUT and the checker are hidden until you predict";
  return (
    <div className="min-w-0 space-y-1">
      <BlockDiagram
        title={`Anatomy of tb_top at ${shortLabel(step)}: ${activity}${step.tokens.length ? `; ${step.tokens.length} token${step.tokens.length === 1 ? "" : "s"} in flight` : ""}`}
        width={ANATOMY_LAYOUT.width}
        height={ANATOMY_LAYOUT.height}
        nodes={nodes}
        edges={edges}
        tokens={tokens}
        selectedId={selectedId}
        onSelect={onSelect}
        minWidth={420}
        spreadAnchors
      />
      <p className="text-[11px] text-muted-foreground">
        {hidden === "outputs"
          ? "The lit block is the part of the bench acting at this step. The DUT's and the checker's blocks, and the tokens, open when you predict. Select a block to jump to its code."
          : hidden === "queue"
            ? "The lit block is the part of tb_top acting at this step. Tokens carry each transaction's a+b to the DUT; the expected sums travelling through exp_q open with the second prediction. Select a block to jump to its code."
            : "The lit block is the part of tb_top acting at this step. Tokens carry each transaction along both paths: a+b to the DUT and the expected sum through model_add() into exp_q. Select a block to jump to its code."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One run, stepped                                                     */
/* ------------------------------------------------------------------ */

interface StepViewProps {
  run: RunResult;
  /** Step to show when the run changes (e.g. the first failing edge). */
  initialIndex?: number;
  showOutputs: boolean;
  showQueue: boolean;
  focus?: "anatomy";
}

function StepView({ run, initialIndex = 0, showOutputs, showQueue, focus }: StepViewProps) {
  const runKey = JSON.stringify(run.config);
  const playback = usePlayback(run.steps.length, runKey);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [pinnedNode, setPinnedNode] = useState<string | null>(null);
  const seek = playback.seek;
  useEffect(() => {
    seek(initialIndex);
  }, [runKey, initialIndex, seek]);
  useEffect(() => {
    setPinnedKey(null);
    setPinnedNode(null);
  }, [playback.index]);

  const fullStep = run.steps[Math.min(playback.index, run.steps.length - 1)];
  // The anatomy and the code panes see only what the open gates allow (the waveform, log and narration gate themselves).
  const step = gateStep(fullStep, showOutputs, showQueue);
  const hidden = !showOutputs ? "outputs" : !showQueue ? "queue" : undefined;
  const cursor = step.kind === "edge" ? step.edge : undefined;
  const visibleLog = run.log.slice(0, step.logCount).filter((l) => showOutputs || l.kind === "test");
  const narration = stepNarration(fullStep, showOutputs, showQueue);
  const onSelectNode = useCallback((nodeId: string) => {
    const spec = ANATOMY_NODES.find((n) => n.id === nodeId);
    setPinnedNode(nodeId);
    setPinnedKey(spec?.codeKey ?? null);
  }, []);
  const onSelectEdge = useCallback(
    (edge: number) => {
      // Step index and edge number differ once a moment step (e.g. the horizon) sits between edges.
      const index = run.steps.findIndex((s) => s.kind === "edge" && s.edge === edge);
      seek(index >= 0 ? index : Math.min(edge, run.steps.length - 1));
    },
    [run.steps, seek],
  );
  const anatomy = focus === "anatomy";

  return (
    <div className="space-y-3">
      <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Step" describeStep={(i) => (run.steps[i] ? shortLabel(run.steps[i]) : "")} />
      <div role="status" aria-live="polite" className="rounded-lg border border-border/60 bg-background/50 p-3 text-sm">
        <p className="font-semibold text-foreground">{shortLabel(step)}</p>
        <p className="mt-1 text-foreground/90">{narration}</p>
        {showOutputs ? (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Why: </span>
            {step.why}
          </p>
        ) : null}
      </div>

      {anatomy ? (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]">
          <AnatomyDiagram step={step} selectedId={pinnedNode ?? undefined} onSelect={onSelectNode} hidden={hidden} />
          <BenchCode run={run} activeKey={pinnedKey ?? (step.activeKey || undefined)} contextKeys={pinnedKey ? [] : step.contextKeys} />
        </div>
      ) : (
        <>
          <BenchWaveform run={run} cursor={cursor} showOutputs={showOutputs} showQueue={showQueue} onSelectEdge={onSelectEdge} />
          {showQueue && showOutputs && run.config.checkStyle === "queue" ? <QueueStrip step={step} /> : null}
          {showOutputs ? (
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]">
              <div className="min-w-0 space-y-2">
                <Counters step={step} />
                <LogPanel lines={visibleLog} />
              </div>
              <AnatomyDiagram step={step} selectedId={pinnedNode ?? undefined} onSelect={onSelectNode} hidden={hidden} />
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]">
              <LogPanel lines={visibleLog} label="Simulation log (TEST lines only until you predict)" />
              <AnatomyDiagram step={step} selectedId={pinnedNode ?? undefined} onSelect={onSelectNode} hidden={hidden} />
            </div>
          )}
          <BenchCode run={run} activeKey={pinnedKey ?? (step.activeKey || undefined)} contextKeys={pinnedKey ? [] : step.contextKeys} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step mode                                                            */
/* ------------------------------------------------------------------ */

function StepLab({ preset: initialPreset, bug, focus }: { preset: PresetId; bug: MutantId; focus?: "anatomy" }) {
  const [preset, setPreset] = useState<PresetId>(initialPreset);
  const [mutant, setMutant] = useState<MutantId>(bug);
  const [showAdvanced, setShowAdvanced] = useState(() => MUTANT_OPTIONS.some((o) => o.mutant === bug && o.advanced) || initialPreset === "hold");
  const [holdCheck, setHoldCheck] = useState(initialPreset === "hold");
  const [edgeRevealedKey, setEdgeRevealedKey] = useState<string | null>(null);
  const [queueRevealedKey, setQueueRevealedKey] = useState<string | null>(null);

  const effectiveHold = holdCheck || preset === "hold";
  const run = useMemo(() => runBench(presetConfig(preset, mutant, effectiveHold)), [preset, mutant, effectiveHold]);
  const key = `${preset}|${String(mutant)}|${effectiveHold}`;
  const edgeQ = useMemo(() => edgePrediction(run), [run]);
  const queueQ = useMemo(() => queuePrediction(run), [run]);
  const anatomy = focus === "anatomy";
  const showOutputs = anatomy || edgeRevealedKey === key || !edgeQ;
  const showQueue = anatomy || queueRevealedKey === key || !queueQ;
  const mutantOptions = MUTANT_OPTIONS.filter((o) => showAdvanced || !o.advanced || o.mutant === mutant);

  return (
    <VisualFrame
      label={anatomy ? "Anatomy of the self-checking testbench, step by step" : "The self-checking loop, edge by edge"}
      eyebrow={anatomy ? "Mental picture" : "Predict, then step"}
      title={anatomy ? "Which part of tb_top acts on each edge?" : "Send, sample, check: where does each result go?"}
      summary={
        anatomy ? (
          <>Step through one run and watch a transaction travel from send() through the DUT and through model_add() into exp_q, until the checker pops it. Select a block to see its code.</>
        ) : (
          <>
            send() drives with <span className="font-mono">&lt;=</span>, the DUT samples one edge later, and the checker reads the registered result one edge after that. Predict first; the outputs, the queue and the log open when you commit.
          </>
        )
      }
      fidelity="model"
      assumptions={SELFCHECK_MODEL_ASSUMPTIONS}
    >
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">+TEST=</p>
          <SegmentedControl label="Test" mono options={PRESETS.map((p) => ({ value: p, label: p }))} value={preset} onChange={setPreset} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">DUT</p>
          <SegmentedControl
            label="DUT"
            mono
            options={mutantOptions.map((o) => ({ value: o.value, label: o.label }))}
            value={MUTANT_OPTIONS.find((o) => o.mutant === mutant)?.value ?? "0"}
            onChange={(v) => setMutant(MUTANT_OPTIONS.find((o) => o.value === v)?.mutant ?? 0)}
          />
        </div>
        <div className="space-y-1 self-end">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((s) => !s)}
            className="inline-flex min-h-10 items-center text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
          {showAdvanced ? (
            <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={effectiveHold} disabled={preset === "hold"} onChange={(e) => setHoldCheck(e.target.checked)} className="accent-cyan-500" />
              kata hold check (registers <span className="font-mono">test_hold</span>){preset === "hold" ? " — required by +TEST=hold" : ""}
            </label>
          ) : null}
        </div>
      </div>
      {preset === "hold" ? (
        <p role="note" className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] px-3 py-2 text-xs text-foreground">
          +TEST=hold runs the kata&apos;s bench: the hold check is on. <span className="font-mono">last_sum</span>, <span className="font-mono">send_invalid()</span> and <span className="font-mono">test_hold</span> appear in tb_top below.
        </p>
      ) : null}
      {!showAdvanced && effectiveHold && preset !== "hold" ? (
        <p role="note" className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] px-3 py-2 text-xs text-foreground">
          The kata&apos;s hold check is still on. Open Show advanced to turn it off.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{mutantInfo(mutant).label}:</span> {mutantInfo(mutant).change}. {TESTS[preset === "all" ? "smoke" : preset].rule}
        {preset === "all" ? ", then corners and gaps" : ""}.
      </p>

      {!anatomy && edgeQ ? (
        <PredictionPrompt question={edgeQ.question} options={toOptions(edgeQ)} resetKey={key}>
          <RevealSignal gateKey={key} onChange={setEdgeRevealedKey} />
          <p className="text-sm text-muted-foreground">out_valid, sum, the checker&apos;s verdicts and the log are now shown. Step to the edges the options named and read the narration.</p>
        </PredictionPrompt>
      ) : null}
      {!anatomy && queueQ ? (
        <PredictionPrompt question={queueQ.question} options={toOptions(queueQ)} resetKey={key}>
          <RevealSignal gateKey={key} onChange={setQueueRevealedKey} />
          <p className="text-sm text-muted-foreground">The exp_q strip is now shown: a chip is pushed on every send() and the oldest one is popped on every result.</p>
        </PredictionPrompt>
      ) : null}

      <StepView run={run} showOutputs={showOutputs} showQueue={showQueue} focus={focus} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Matrix mode                                                          */
/* ------------------------------------------------------------------ */

function MatrixLab() {
  const [holdCheck, setHoldCheck] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, MutationPrediction>>({});
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<{ test: TestId; mutant: MutantId } | null>(null);
  const [selectCount, setSelectCount] = useState(0);
  const holdToggleRef = useRef<HTMLInputElement>(null);
  const detailHeadingRef = useRef<HTMLParagraphElement>(null);
  const escapeId = useId();

  // The reveal button unmounts when pressed: hand focus to the control that replaces it.
  useEffect(() => {
    if (revealed) holdToggleRef.current?.focus();
  }, [revealed]);
  // The detail panel opens below the matrix, usually off-screen at phone width: focus also scrolls it into view.
  useEffect(() => {
    if (selectCount > 0) detailHeadingRef.current?.focus();
  }, [selectCount]);

  const matrix = useMemo(() => buildMatrix(holdCheck), [holdCheck]);
  const rows = ALL_TEST_IDS.map((t) => ({ id: t, label: `+TEST=${t}` }));
  const columns = MATRIX_MUTANTS.map((m) => ({ id: columnId(m), label: mutantInfo(m).label }));
  const cells = useMemo(() => {
    const out: Record<string, MutationCell> = {};
    ALL_TEST_IDS.forEach((t) =>
      MATRIX_MUTANTS.forEach((m) => {
        const c = matrix.cells[t][columnId(m)];
        out[cellKey(t, columnId(m))] = { state: c.state, summary: c.summary };
      }),
    );
    return out;
  }, [matrix]);

  const selectedCell = selected ? matrix.cells[selected.test][columnId(selected.mutant)] : null;
  const selectedKey = selected ? cellKey(selected.test, columnId(selected.mutant)) : undefined;
  const swapId = columnId("swap-ab");
  const bug3Caught = ALL_TEST_IDS.filter((t) => matrix.cells[t][columnId(3)].state === "caught");

  return (
    <VisualFrame
      label="Directed tests against mutants"
      eyebrow="Predict, then reveal"
      title="Which test kills which mutant?"
      summary={
        <>
          Each cell is one run of the Make It Work bench by the model. Predict every cell, reveal, then select a cell to step through the first failing edge or read why the mutant escaped.
        </>
      }
      fidelity="model"
      assumptions={SELFCHECK_MODEL_ASSUMPTIONS}
    >
      <ul className="grid gap-1 text-xs text-muted-foreground grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {MATRIX_MUTANTS.map((m) => (
          <li key={String(m)}>
            <span className="font-semibold text-foreground">{mutantInfo(m).label}:</span> {mutantInfo(m).change}
            {mutantInfo(m).equivalent ? " (equivalent: behaviour unchanged)" : ""}.
          </li>
        ))}
      </ul>
      <MutationMatrix
        label={`Tests against mutants${holdCheck ? ", with the kata's hold check" : ""}`}
        rows={rows}
        columns={columns}
        cells={cells}
        predictions={holdCheck ? {} : predictions}
        onPredict={holdCheck ? undefined : (r, c, v) => setPredictions((p) => ({ ...p, [cellKey(r, c)]: v }))}
        revealed={revealed}
        onCellSelect={(r, c) => {
          setSelected({ test: r as TestId, mutant: MATRIX_MUTANTS.find((m) => columnId(m) === c) ?? 1 });
          setSelectCount((n) => n + 1);
        }}
        selectedCell={selectedKey}
        columnTotals
      />
      <div className="flex flex-wrap items-center gap-3">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reveal the runs
          </button>
        ) : (
          <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
            <input ref={holdToggleRef} type="checkbox" checked={holdCheck} onChange={(e) => setHoldCheck(e.target.checked)} className="accent-cyan-500" />
            Add the kata&apos;s hold check to the checker (and register <span className="font-mono">test_hold</span>)
          </label>
        )}
      </div>
      <div aria-live="polite" className="space-y-2 text-sm empty:!mt-0">
        {revealed ? (
          <>
            <p className="text-foreground">
              <span className="font-semibold">BUG=3: </span>
              {holdCheck
                ? `with the hold check, ${bug3Caught.length ? bug3Caught.map((t) => `+TEST=${t}`).join(", ") : "no test"} catches it: only the hold test changes a and b on idle cycles. The mutant needs both the new stimulus and the new check.`
                : "no test catches it, however the stimulus looks: the checker never looks at sum while out_valid is 0. The hold row is the kata's stimulus against the original checker: send_invalid() changes a and b on idle cycles, and nothing reads sum there. Add the hold check to see what changes."}
            </p>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{mutantInfo("swap-ab").label}: </span>
              {explainEscape("smoke", "swap-ab", holdCheck, matrix.cells.smoke[swapId].run)}
            </p>
          </>
        ) : null}
      </div>

      {revealed && selected && selectedCell ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
          <p
            ref={detailHeadingRef}
            tabIndex={-1}
            aria-describedby={selectedCell.state === "survived" ? escapeId : undefined}
            className="scroll-mt-4 rounded text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +TEST={selected.test} against {mutantInfo(selected.mutant).label}: <span className="font-mono [font-variant-ligatures:none]">{selectedCell.summary}</span>
            {selectedCell.state === "caught" ? " — caught" : " — survived"}
          </p>
          {selectedCell.state === "caught" ? (
            <>
              <p className="text-sm text-muted-foreground">
                First failing edge: {selectedCell.run.firstFailEdge} ({formatTime(selectedCell.run.steps[selectedCell.run.firstFailEdge ?? 0]?.time ?? 0)}). The stepper opens there.
              </p>
              <StepView run={selectedCell.run} initialIndex={selectedCell.run.firstFailEdge ?? 0} showOutputs showQueue />
            </>
          ) : (
            <>
              <p id={escapeId} className="rounded-lg border border-rose-500/40 bg-rose-500/[0.06] p-3 text-sm text-foreground">
                <span className="font-semibold">Why it escaped: </span>
                {explainEscape(selected.test, selected.mutant, holdCheck, selectedCell.run)}
              </p>
              <LogPanel lines={selectedCell.run.log} label={`Log of +TEST=${selected.test}`} />
            </>
          )}
        </div>
      ) : null}
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Debug clinic                                                         */
/* ------------------------------------------------------------------ */

const BUG1_GLYPH: Record<Bug1Outcome, string> = { caught: "✓", "caught-no-end": "△", hung: "△", escaped: "✕" };
const BUG1_TONE: Record<Bug1Outcome, string> = {
  caught: "text-emerald-700 dark:text-emerald-300",
  "caught-no-end": "text-amber-800 dark:text-amber-200",
  hung: "text-amber-800 dark:text-amber-200",
  escaped: "text-rose-700 dark:text-rose-300",
};

function DebugClinic() {
  const [caseId, setCaseId] = useState<ClinicCaseId>(CLINIC_CASES[0].id);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const [solved, setSolved] = useState<ReadonlySet<ClinicCaseId>>(() => new Set());
  const [waveMount, setWaveMount] = useState(0);
  const caseHeadingRef = useRef<HTMLParagraphElement>(null);

  const kase = clinicCase(caseId);
  const run = useMemo(() => runBench(kase.config), [kase]);
  const source = useMemo(() => benchSource(kase.config), [kase]);
  const suspects = useMemo(() => new Set(suspectKeys(source, kase)), [source, kase]);
  const diagnosis = suspect ? diagnoseSuspect(kase, suspect) : null;
  const found = diagnosis?.culprit ?? false;
  const fix = kase.fixes.find((f) => f.id === fixId) ?? null;
  const grade = useMemo(() => (fix ? gradeFix(kase, fix) : null), [kase, fix]);
  const caseIndex = CLINIC_CASES.findIndex((c) => c.id === caseId);

  // The next case still to solve, after this one and wrapping around; none once all are solved.
  const nextCase = [...CLINIC_CASES.slice(caseIndex + 1), ...CLINIC_CASES.slice(0, caseIndex)].find((c) => !solved.has(c.id)) ?? null;

  const pick = (id: ClinicCaseId) => {
    setCaseId(id);
    setSuspect(null);
    setFixId(null);
  };
  const chooseFix = (f: ClinicFix) => {
    setFixId(f.id);
    if (gradeFix(kase, f).accepted) setSolved((s) => new Set(s).add(kase.id));
  };

  return (
    <VisualFrame
      label="Broken bench clinic"
      eyebrow="Debug it"
      title="Read the log back to its cause"
      summary={<>Seven benches, each with one fault. Read the log (and the waveform if you need it), select the tb_top line you suspect, then choose a fix: the model reruns the bench and grades it.</>}
      fidelity="model"
      assumptions={SELFCHECK_MODEL_ASSUMPTIONS}
    >
      <div className="space-y-1">
        <SegmentedControl
          label="Case"
          options={CLINIC_CASES.map((c, i) => ({
            value: c.id,
            label: solved.has(c.id) ? (
              <>
                Case {i + 1}
                <span aria-hidden> ✓</span>
              </>
            ) : (
              `Case ${i + 1}`
            ),
            ariaLabel: `Case ${i + 1}: ${c.symptom}${solved.has(c.id) ? " (solved)" : ""}`,
          }))}
          value={caseId}
          onChange={pick}
        />
        <p className="text-xs text-muted-foreground">
          {solved.size} of {CLINIC_CASES.length} solved
        </p>
      </div>
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-3 text-sm">
        <p ref={caseHeadingRef} tabIndex={-1} className="scroll-mt-4 rounded font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Case {caseIndex + 1}: {kase.symptom}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Run: {kase.command}. DUT: {mutantInfo(kase.config.mutant).label}.
        </p>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <LogPanel lines={run.log} />
        <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Run ends: </span>
            {run.endReason === "finish" ? `${formatTime(run.endTime)} with $finish` : run.endReason === "fatal" ? `${formatTime(run.endTime)} with $fatal` : run.endReason === "stop" ? `suspended by $stop at ${formatTime(run.endTime)}` : "never (still running at the horizon)"}.
          </p>
          <p>
            <span className="font-semibold text-foreground">Counters when report() ran, before its guards: </span>
            <span className="font-mono [font-variant-ligatures:none]">
              PASS={run.rawPass} FAIL={run.rawFail}
            </span>
          </p>
          {/* Remounted on each opening: a closed panel has no width, so the waveform can only scroll to its cursor once open. */}
          <details className="rounded-lg border border-border/60 p-2" onToggle={() => setWaveMount((n) => n + 1)}>
            <summary className="cursor-pointer py-3 font-medium text-foreground">Waveform of this run</summary>
            <div className="mt-2">
              <BenchWaveform key={waveMount} run={run} cursor={run.firstFailEdge ?? undefined} showOutputs explainCause={found} />
            </div>
          </details>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1 — select the tb_top line that causes the symptom</p>
        <BenchCode
          run={run}
          label="The broken bench (tb_top, generated from the model's data)"
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            line.key && suspects.has(line.key) ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => {
                  setSuspect(line.key as string);
                  setFixId(null);
                }}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-md border px-2 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-0 sm:py-0.5",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        <div aria-live="polite" className="mt-2 text-sm">
          {diagnosis ? (
            <p className={found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
              <strong>{found ? "" : "Not this one. "}</strong>
              {diagnosis.text}
            </p>
          ) : null}
        </div>
        {!found ? <HintLadder hints={[...kase.hints]} resetKey={caseId} className="mt-2" /> : null}
      </div>

      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2 — choose a fix; the model reruns the bench</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {kase.fixes.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name={`fix-${caseId}`} checked={fixId === f.id} onChange={() => chooseFix(f)} className="mt-1 accent-cyan-500" />
                <span className="font-mono text-[13px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          <div aria-live="polite">
            {grade && fix ? (
              <div className={cn("mt-3 space-y-2 rounded-xl border p-3 text-sm", grade.accepted ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
                <p className="font-semibold text-foreground">{grade.accepted ? "✓ Fix accepted" : grade.modelOk ? "△ Passes the model, rejected in review" : "✕ Fix rejected by the model"}</p>
                <ul className="space-y-1 font-mono text-xs [font-variant-ligatures:none]">
                  <li className={grade.clean ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                    {grade.clean ? "✓" : "✕"} correct DUT, {kase.runArgs}: {grade.cleanRun.summary || "(no summary)"}
                    {grade.cleanRun.ended ? ` — ends at ${formatTime(grade.cleanRun.endTime)}${grade.cleanRun.endReason === "fatal" ? " with $fatal" : ""}` : grade.cleanRun.endReason === "stop" ? " — suspended by $stop" : " — never ends"}
                    {grade.clean ? "" : ` (needs PASS=${grade.expectedPass} FAIL=0 and $finish)`}
                  </li>
                  <li className={BUG1_TONE[grade.bug1Outcome]}>
                    {BUG1_GLYPH[grade.bug1Outcome]} BUG=1 on +TEST=corners: {grade.bug1Run.summary || "(no summary)"} — {grade.bug1Text}
                  </li>
                  {grade.xRun ? (
                    <li className={grade.xCaught ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                      {grade.xCaught ? "✓" : "✕"} x on the carry bit: {grade.xRun.summary} {grade.xCaught ? "— every X result fails" : `— ${grade.xRun.passCnt} X result(s) still pass`}
                    </li>
                  ) : null}
                </ul>
                <p className="text-foreground/90">
                  <strong>Review: </strong>
                  {grade.review}
                </p>
                {!grade.clean && grade.cleanRun.log.some((l) => l.kind === "error" || l.kind === "fatal") ? <LogPanel lines={grade.cleanRun.log} label="Log of the fixed bench, correct DUT" /> : null}
                {grade.accepted ? (
                  nextCase ? (
                    <button
                      type="button"
                      onClick={() => {
                        pick(nextCase.id);
                        caseHeadingRef.current?.focus();
                      }}
                      className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Next case
                    </button>
                  ) : (
                    <p className="font-semibold text-foreground">All {CLINIC_CASES.length} cases solved.</p>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                                */
/* ------------------------------------------------------------------ */

/**
 * The F2E self-checking bench, run by a cycle model: step mode follows one run
 * edge by edge (with the anatomy diagram), matrix mode runs every directed test
 * against every mutant, and debug mode reads broken benches' logs back to their
 * cause.
 */
export default function SelfCheckBenchLab({ mode = "step", preset, bug, focus }: Props) {
  // The lesson's trace and both its Predict prompts use +TEST=gaps; the anatomy embed reads best on the shorter smoke run.
  const initialPreset: PresetId = isPreset(preset) ? preset : focus === "anatomy" ? "smoke" : "gaps";
  if (mode === "matrix") return <MatrixLab />;
  if (mode === "debug") return <DebugClinic />;
  return <StepLab preset={initialPreset} bug={normalizeMutant(bug)} focus={focus === "anatomy" ? "anatomy" : undefined} />;
}
