"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  classSourceLines,
  formatQueue,
  getHeapPreset,
  gradeMonitor,
  heapPresets,
  MONITOR_SAMPLES,
  monitorScenario,
  scenarioCodeLines,
  simulateHeap,
  type HeapObject,
  type HeapPreset,
  type HeapScenario,
  type HeapScenarioId,
  type HeapState,
  type MonitorVariant,
} from "@/lib/sv-object-model";
import { cn } from "@/lib/utils";

export const OBJECT_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 Clause 8: handles start null (§8.4); new initializes properties then runs the constructor (§8.7); h2 = h1 copies the handle and h2 = new h1 is a shallow copy that skips the constructor and shares nested objects (§8.12).",
  "A queue property is copied element by element by a shallow copy, so it is never shared (§7.6).",
  "copy() is the user-written deep copy shown in the class code. It is a convention, not a built-in method.",
  "Grey objects are unreachable: no handle in scope leads to them, so they are eligible for automatic reclamation (§8.29). When a simulator actually frees memory is not modelled.",
  "A null access stops the run, as simulators do. The standard calls it illegal with an indeterminate result (§8.4).",
  "Object names such as packet@1 mimic simulator handle names; real tools number objects differently.",
];

// ---------------------------------------------------------------------------
// Heap picture
// ---------------------------------------------------------------------------

const VAR_X = 4;
const VAR_W = 92;
const CHIP_H = 24;
const ROW_GAP = 8;
const COL_X: Record<number, number> = { 1: 128, 2: 302 };
const COL_W: Record<number, number> = { 1: 150, 2: 114 };
const TITLE_H = 22;
const FIELD_H = 16;
const BOX_GAP = 12;
const VIEW_W = 420;

interface VarSlot {
  key: string;
  label: string;
  ref: string | null;
  x: number;
  y: number;
  w: number;
  changed: boolean;
}

interface BoxSlot {
  object: HeapObject;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: { name: string; text: string; ref?: string | null; changed: boolean; y: number }[];
}

function fieldText(object: HeapObject, name: string) {
  const f = object.fields[name];
  if (f.kind === "int") return `${name} = ${f.value}`;
  if (f.kind === "intQueue") return `${name} = ${formatQueue(f.items)}`;
  return f.ref ? `${name}` : `${name} = null`;
}

function layoutHeap(scenario: HeapScenario, state: HeapState, changed: string[]) {
  const slots: VarSlot[] = [];
  const labels: { text: string; y: number; x: number }[] = [];
  let y = 8;
  let lastOwner: string | undefined;
  for (const v of scenario.vars) {
    if (v.owner && v.owner !== lastOwner) {
      labels.push({ text: v.owner.toUpperCase(), x: VAR_X, y: y + 9 });
      y += 14;
      lastOwner = v.owner;
    }
    const value = state.vars[v.name];
    const varChanged = changed.includes(`var:${v.name}`);
    if (value.kind === "handle") {
      slots.push({ key: v.name, label: v.name, ref: value.ref, x: VAR_X, y, w: VAR_W, changed: varChanged });
      y += CHIP_H + ROW_GAP;
    } else {
      labels.push({ text: `${v.name}[$]${value.refs.length ? "" : "  (empty)"}`, x: VAR_X, y: y + 12 });
      y += 18;
      value.refs.forEach((r, i) => {
        slots.push({ key: `${v.name}[${i}]`, label: `[${i}]`, ref: r, x: VAR_X + 14, y, w: VAR_W - 14, changed: varChanged && i === value.refs.length - 1 });
        y += CHIP_H + 4;
      });
      y += ROW_GAP - 4;
    }
  }
  const boxes: BoxSlot[] = [];
  const colY: Record<number, number> = { 1: 8, 2: 8 };
  for (const object of state.objects) {
    const decl = scenario.classes.find((c) => c.name === object.className);
    const column = decl?.column ?? 1;
    const names = Object.keys(object.fields);
    const x = COL_X[column] ?? COL_X[1];
    const w = COL_W[column] ?? COL_W[1];
    const top = colY[column] ?? 8;
    const h = TITLE_H + names.length * FIELD_H + 8;
    boxes.push({
      object,
      x,
      y: top,
      w,
      h,
      rows: names.map((name, i) => {
        const f = object.fields[name];
        return {
          name,
          text: fieldText(object, name),
          ref: f.kind === "handle" ? f.ref : undefined,
          changed: changed.includes(`field:${object.id}.${name}`),
          y: top + TITLE_H + i * FIELD_H + 11,
        };
      }),
    });
    colY[column] = top + h + BOX_GAP;
  }
  const height = Math.max(y, ...Object.values(colY)) + 6;
  return { slots, labels, boxes, height };
}

function arrowPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(24, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Text alternative: every handle and where it points, plus each object's reachability. */
export function describeHeap(scenario: HeapScenario, state: HeapState): string[] {
  const lines: string[] = [];
  for (const v of scenario.vars) {
    const value = state.vars[v.name];
    if (value.kind === "handle") lines.push(value.ref ? `${v.name} → ${value.ref}` : `${v.name} = null`);
    else if (value.refs.length === 0) lines.push(`${v.name} is an empty queue of handles`);
    else value.refs.forEach((r, i) => lines.push(`${v.name}[${i}] → ${r ?? "null"}`));
  }
  for (const o of state.objects) {
    const fields = Object.entries(o.fields).map(([name, f]) =>
      f.kind === "handle" ? (f.ref ? `${name} → ${f.ref}` : `${name} = null`) : f.kind === "int" ? `${name} = ${f.value}` : `${name} = ${formatQueue(f.items)}`,
    );
    lines.push(`${o.id}: ${fields.join(", ")}${o.reachable ? "" : " — unreachable, eligible for garbage collection"}`);
  }
  for (const [key, value] of Object.entries(state.statics)) lines.push(`${key} = ${value} (static: one per class)`);
  return lines;
}

interface HeapViewProps {
  scenario: HeapScenario;
  state: HeapState;
  changed?: string[];
  caption?: string;
  className?: string;
}

/** Handles are labelled chips; arrows point to object boxes; unreachable objects are dashed and grey. */
export function HeapView({ scenario, state, changed = [], caption, className }: HeapViewProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { slots, labels, boxes, height } = useMemo(() => layoutHeap(scenario, state, changed), [scenario, state, changed]);
  const boxById = new Map(boxes.map((b) => [b.object.id, b]));
  // Spread the arrowheads of several handles to one object along its left edge.
  const totals = new Map<string, number>();
  const count = (ref: string | null | undefined) => {
    if (ref) totals.set(ref, (totals.get(ref) ?? 0) + 1);
  };
  boxes.forEach((b) => b.rows.forEach((r) => count(r.ref)));
  slots.forEach((s) => count(s.ref));
  const incoming = new Map<string, number>();
  const target = (ref: string) => {
    const box = boxById.get(ref);
    if (!box) return null;
    const k = incoming.get(ref) ?? 0;
    incoming.set(ref, k + 1);
    const n = totals.get(ref) ?? 1;
    return { x: box.x, y: n === 1 ? box.y + 12 : box.y + 8 + (k * (box.h - 16)) / (n - 1) };
  };
  const unreachable = state.objects.filter((o) => !o.reachable).length;
  const summary = `Heap: ${slots.filter((s) => s.ref).length} non-null handle${slots.filter((s) => s.ref).length === 1 ? "" : "s"}, ${state.objects.length} object${state.objects.length === 1 ? "" : "s"}${unreachable ? `, ${unreachable} unreachable` : ""}.`;
  const lines = describeHeap(scenario, state);

  return (
    <figure className={cn("min-w-0 space-y-2", className)}>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/60">
        <svg viewBox={`0 0 ${VIEW_W} ${height}`} role="img" aria-label={summary} className="mx-auto block w-full min-w-[300px] max-w-[600px] text-foreground">
          <defs>
            <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-cyan-600 dark:fill-cyan-400" />
            </marker>
          </defs>
          <text x={VAR_X} y={height - 4} className="fill-muted-foreground text-[9px]">
            handles
          </text>
          <text x={COL_X[1]} y={height - 4} className="fill-muted-foreground text-[9px]">
            objects (heap)
          </text>

          {labels.map((l) => (
            <text key={`${l.text}-${l.y}`} x={l.x} y={l.y} className="fill-muted-foreground font-mono text-[10px] font-semibold [font-variant-ligatures:none]">
              {l.text}
            </text>
          ))}

          {boxes.map((b) => (
            <g key={b.object.id} opacity={b.object.reachable ? 1 : 0.55} className="transition-opacity duration-200 motion-reduce:transition-none">
              <title>{`${b.object.id}${b.object.reachable ? "" : ": unreachable, eligible for garbage collection"}`}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={4}
                strokeWidth={changed.includes(`obj:${b.object.id}`) ? 2.5 : 1.5}
                strokeDasharray={b.object.reachable ? undefined : "5 3"}
                className={b.object.reachable ? "fill-indigo-500/10 stroke-indigo-500" : "fill-transparent stroke-slate-400"}
              />
              <text x={b.x + 6} y={b.y + 15} className="fill-foreground font-mono text-[12px] font-semibold [font-variant-ligatures:none]">
                {changed.includes(`obj:${b.object.id}`) ? "▲ " : ""}
                {b.object.id}
                {b.object.reachable ? "" : "  ⊘ GC"}
              </text>
              {b.rows.map((r) => (
                <g key={r.name}>
                  <text
                    x={b.x + 8}
                    y={r.y}
                    className={cn("font-mono text-[11.5px] [font-variant-ligatures:none]", r.changed ? "fill-cyan-700 font-semibold dark:fill-cyan-300" : "fill-foreground")}
                  >
                    {r.changed ? "▲ " : ""}
                    {r.text}
                  </text>
                  {r.ref ? <circle cx={b.x + b.w - 8} cy={r.y - 3.5} r={3} className="fill-cyan-600 dark:fill-cyan-400" /> : null}
                </g>
              ))}
            </g>
          ))}

          {boxes.flatMap((b) =>
            b.rows
              .filter((r) => r.ref)
              .map((r) => {
                const t = target(r.ref as string);
                if (!t) return null;
                const x1 = b.x + b.w - 8;
                const y1 = r.y - 3.5;
                const d = t.x > x1 ? arrowPath(x1, y1, t.x, t.y) : `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x1 + 40} ${t.y}, ${t.x + 1} ${t.y}`;
                return (
                  <path
                    key={`${b.object.id}.${r.name}`}
                    d={d}
                    fill="none"
                    strokeWidth={1.5}
                    markerEnd={`url(#${uid}-arrow)`}
                    opacity={b.object.reachable ? 1 : 0.45}
                    className="stroke-cyan-600 dark:stroke-cyan-400"
                  >
                    <title>{`${b.object.id}.${r.name} refers to ${r.ref}`}</title>
                  </path>
                );
              }),
          )}

          {slots.map((s) => {
            const t = s.ref ? target(s.ref) : null;
            return (
              <g key={s.key}>
                <rect
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={CHIP_H}
                  rx={12}
                  strokeWidth={s.changed ? 2.5 : 1.25}
                  className={s.changed ? "fill-cyan-500/15 stroke-cyan-500" : "fill-amber-500/10 stroke-amber-500/80"}
                />
                <text x={s.x + 9} y={s.y + 16} className="fill-foreground font-mono text-[12.5px] font-semibold [font-variant-ligatures:none]">
                  {s.changed ? "▲ " : ""}
                  {s.label}
                </text>
                {s.ref ? (
                  <circle cx={s.x + s.w - 10} cy={s.y + CHIP_H / 2} r={3.5} className="fill-cyan-600 dark:fill-cyan-400" />
                ) : (
                  <text x={s.x + s.w - 8} y={s.y + 16} textAnchor="end" className="fill-muted-foreground font-mono text-[10px] [font-variant-ligatures:none]">
                    ∅ null
                  </text>
                )}
                {t ? (
                  <path d={arrowPath(s.x + s.w - 10, s.y + CHIP_H / 2, t.x, t.y)} fill="none" strokeWidth={s.changed ? 2.5 : 1.5} markerEnd={`url(#${uid}-arrow)`} className="stroke-cyan-600 dark:stroke-cyan-400">
                    <title>{`${s.key} refers to ${s.ref}`}</title>
                  </path>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="text-[11px] text-muted-foreground">
        {caption ?? "Amber pills are handle variables, boxes are objects, arrows are handles. ▲ marks what this step changed; dashed grey boxes marked ⊘ GC have no handle left."}
      </figcaption>
      <details className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs" open>
        <summary className="cursor-pointer font-medium text-foreground">Handles and targets, in words</summary>
        <ul className="mt-1 space-y-0.5 font-mono text-[11.5px] text-foreground [font-variant-ligatures:none]" aria-label="Handles and targets">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Trace mode
// ---------------------------------------------------------------------------

function RevealSignal({ id, onReveal }: { id: string; onReveal: (id: string) => void }) {
  useEffect(() => {
    onReveal(id);
  }, [id, onReveal]);
  return null;
}

const toLines = (lines: { text: string; key?: string }[], owner: CodeTraceLine["owner"] = "testbench"): CodeTraceLine[] => lines.map((l) => ({ ...l, owner }));

function HeapTrace({ preset }: { preset: HeapPreset }) {
  const scenario = useMemo(() => preset.build(), [preset]);
  const run = useMemo(() => simulateHeap(scenario), [scenario]);
  const codeLines = useMemo(() => toLines(scenarioCodeLines(scenario)), [scenario]);
  const classLines = useMemo(() => toLines(scenario.classes.flatMap(classSourceLines)), [scenario]);
  const playback = usePlayback(run.trace.length, scenario.id);
  const step = run.trace[Math.min(playback.index, run.trace.length - 1)];
  const [revealed, setRevealed] = useState<string[]>([]);
  const onReveal = useCallback((id: string) => setRevealed((prev) => (prev.includes(id) ? prev : [...prev, id])), []);

  const gates = useMemo(
    () =>
      preset.gates
        .map((g) => ({ gate: g, stepIndex: run.trace.findIndex((s) => s.stmtId === g.stmtId) }))
        .filter((g) => g.stepIndex > 0)
        .sort((a, b) => a.stepIndex - b.stepIndex),
    [preset, run],
  );
  const blocking = gates.find((g) => g.stepIndex <= playback.index && !revealed.includes(g.gate.id));
  // Show the gate that is masking the result; otherwise the latest gate whose ask point has been reached.
  const promptGate = blocking ?? [...gates].reverse().find((g) => playback.index >= g.stepIndex - 1);
  const masked = Boolean(blocking);

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="min-w-0 space-y-3">
          <CodeTrace label="Test code (generated from the model)" lines={codeLines} activeKey={step.stmtId} />
          <details className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Class declarations</summary>
            <CodeTrace label="Classes" lines={classLines} className="mt-2" />
          </details>
        </div>
        <div className="min-w-0 space-y-3">
          <div
            aria-live="polite"
            className={cn(
              "rounded-xl border p-3 text-sm",
              step.error && !masked ? "border-rose-500/60 bg-rose-500/10" : "border-border/70 bg-background/60",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Step {step.index + 1} of {run.trace.length}
              {step.iteration ? ` · loop iteration ${step.iteration}` : ""}
            </p>
            {masked ? (
              <p className="mt-1 text-foreground">
                <strong>Predict first. </strong>The result of this step is hidden until you lock in a prediction (or choose to reveal it).
              </p>
            ) : (
              <>
                <p className={cn("mt-1 font-medium", step.error ? "text-rose-800 dark:text-rose-200" : "text-foreground")}>
                  {step.error ? <span aria-hidden>✕ </span> : null}
                  <span className="sr-only">What: </span>
                  {step.what}
                </p>
                <p className="mt-1 text-muted-foreground">
                  <strong className="text-foreground">Why: </strong>
                  {step.why}
                </p>
              </>
            )}
          </div>
          {gates.map(({ gate }) => (
            <div key={gate.id} hidden={promptGate?.gate.id !== gate.id}>
              <PredictionPrompt question={gate.question} options={gate.options.map((o) => ({ ...o, label: <span className="[font-variant-ligatures:none]">{o.label}</span> }))}>
                {() => <RevealSignal id={gate.id} onReveal={onReveal} />}
              </PredictionPrompt>
            </div>
          ))}
          <div className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
            {masked ? (
              <span className="text-slate-400">(hidden until you predict)</span>
            ) : step.state.log.length === 0 ? (
              <span className="text-slate-400">(no output yet)</span>
            ) : (
              step.state.log.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </div>
      </div>

      <PlaybackControls playback={playback} stepCount={run.trace.length} stepNoun="Statement" describeStep={(i) => run.trace[i]?.source ?? "initial state"} />

      {masked ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-amber-500/60 bg-amber-500/[0.05] p-4 text-center text-sm text-muted-foreground">
          <p>
            The heap after <code className="mx-1 font-mono text-foreground [font-variant-ligatures:none]">{step.source}</code> is hidden until you answer the prediction.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.keys(step.state.statics).length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Static (one per class)</span>
              {Object.entries(step.state.statics).map(([key, value]) => {
                const changed = step.changed.includes(`static:${key}`);
                return (
                  <span
                    key={key}
                    className={cn(
                      "rounded-sm border px-2 py-0.5 font-mono [font-variant-ligatures:none]",
                      changed ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-slate-400/60 bg-slate-500/10 text-foreground",
                    )}
                  >
                    {changed ? "▲ " : ""}
                    {key} = {value}
                  </span>
                );
              })}
            </div>
          ) : null}
          <HeapView scenario={scenario} state={step.state} changed={step.changed} />
        </div>
      )}
    </div>
  );
}

function TraceMode({ scenario: initial, scenarios }: { scenario?: HeapScenarioId; scenarios?: HeapScenarioId[] }) {
  const presets = scenarios ? heapPresets.filter((p) => scenarios.includes(p.id)) : heapPresets;
  const [presetId, setPresetId] = useState<HeapScenarioId>(initial ?? presets[0]?.id ?? "aliasing");
  const preset = getHeapPreset(presetId);
  const scenario = useMemo(() => preset.build(), [preset]);

  return (
    <VisualFrame
      label="Object handle visualizer"
      eyebrow="A handle is an arrow, not the box"
      title={scenario.title}
      summary={<>{preset.summary} Step through the code and predict before each key statement.</>}
      fidelity="model"
      assumptions={OBJECT_MODEL_ASSUMPTIONS}
    >
      {presets.length > 1 ? (
        <SegmentedControl
          label="Scenario"
          mono
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
          value={presetId}
          onChange={(v) => setPresetId(v)}
        />
      ) : null}
      <HeapTrace key={presetId} preset={preset} />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Spot-the-bug mode: the scoreboard stores a handle the monitor reuses
// ---------------------------------------------------------------------------

const suspects: Record<string, { verdict: "culprit" | "close" | "innocent"; feedback: string }> = {
  m1: {
    verdict: "culprit",
    feedback:
      "new runs once, before the loop, so exactly one txn object exists. Every push_back stores another handle to that same object, and each bus_sample() overwrites the data all the stored handles point to.",
  },
  m2: { verdict: "innocent", feedback: "Writing the sample is right. The question is which object it writes into." },
  m3: {
    verdict: "close",
    feedback: "This line stores a handle, not a snapshot, so it is where the alias appears. It would be correct if t referred to a fresh object each time. How many txn objects does this code create?",
  },
};

const fixes: { id: MonitorVariant; label: string; review: string }[] = [
  {
    id: "new-in-loop",
    label: "Move t = new; inside the loop",
    review: "Accepted. Each iteration creates its own txn, so each stored handle refers to a different object. In a UVM monitor this is the usual pattern: create a new item for every observed transaction.",
  },
  {
    id: "copy-before-store",
    label: "Store a copy: c = new t; exp_q.push_back(c);",
    review: "Accepted. A shallow copy is enough here because txn holds only values. With nested objects you would need a deep copy (in UVM, clone()).",
  },
  {
    id: "alias-before-store",
    label: "Copy the handle first: c = t; exp_q.push_back(c);",
    review: "Rejected. c = t copies the arrow, not the box. Every entry still refers to txn@1.",
  },
  {
    id: "null-after-store",
    label: "Clear it after storing: t = null;",
    review: "Rejected. On the next iteration, t.data = … writes through a null handle: a run-time error (§8.4).",
  },
];

function StoredHandleBug() {
  const buggy = useMemo(() => monitorScenario("buggy"), []);
  const buggyGrade = useMemo(() => gradeMonitor("buggy"), []);
  const lines = useMemo(() => toLines(scenarioCodeLines(buggy)), [buggy]);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<MonitorVariant | null>(null);
  const found = suspect !== null && suspects[suspect]?.verdict === "culprit";
  const fix = fixes.find((f) => f.id === fixId);
  const result = useMemo(() => (fixId ? gradeMonitor(fixId) : null), [fixId]);
  const fixScenario = useMemo(() => (fixId ? monitorScenario(fixId) : null), [fixId]);

  return (
    <VisualFrame
      label="Stored handle debugging challenge"
      eyebrow="Spot the bug"
      title="The scoreboard's expected items changed after it stored them"
      summary={
        <>
          The monitor samples {MONITOR_SAMPLES.join(", ")} and stores each as an expected item. When the DUT's outputs arrive, the scoreboard reports two mismatches.
        </>
      }
      fidelity="model"
      assumptions={OBJECT_MODEL_ASSUMPTIONS}
    >
      <div className="rounded-xl border border-rose-500/50 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Scoreboard log">
        {MONITOR_SAMPLES.map((expected, i) => {
          const stored = buggyGrade.stored?.[i];
          const ok = stored === expected;
          return (
            <div key={i} className={ok ? "text-emerald-300" : "text-rose-300"}>
              {ok
                ? `UVM_INFO [SCB] item ${i}: DUT data=${expected} matches stored data=${stored}`
                : `UVM_ERROR [SCB] item ${i}: DUT data=${expected}, stored expected data=${stored}`}
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1: select the line that causes the mismatch</p>
        <CodeTrace
          label="Monitor and scoreboard code"
          lines={lines}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            line.key && suspects[line.key] ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {suspect ? (
          <p
            aria-live="polite"
            className={cn(
              "mt-2 text-sm",
              found ? "text-emerald-700 dark:text-emerald-300" : suspects[suspect]?.verdict === "close" ? "text-amber-800 dark:text-amber-200" : "text-rose-700 dark:text-rose-300",
            )}
          >
            <strong>{found ? "Found it. " : suspects[suspect]?.verdict === "close" ? "Close. " : "Not this one. "}</strong>
            {suspects[suspect]?.feedback}
          </p>
        ) : null}
        {!found ? (
          <HintLadder
            className="mt-2"
            hints={[
              "Count the objects: how many times does new run?",
              "exp_q holds three handles. Picture where each one points.",
              <div key="heap" className="mt-1">
                <p className="mb-1">The heap at the end of the run:</p>
                <HeapView scenario={buggy} state={buggyGrade.run.final} caption="Three stored handles, one object." />
              </div>,
            ]}
          />
        ) : null}
      </div>

      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2: choose a fix. The model reruns the monitor and the scoreboard reads the items back.</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {fixes.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="stored-handle-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                <span className="font-mono text-[13px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          {result && fix && fixScenario ? (
            <div className="mt-3 space-y-3">
              <div
                aria-live="polite"
                className={cn("space-y-1 rounded-xl border p-3 text-sm", result.pass ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10")}
              >
                <p className="font-medium text-foreground">
                  {result.stored
                    ? `Scoreboard reads back ${result.stored.join(", ")} from ${result.distinctObjects} distinct object${result.distinctObjects === 1 ? "" : "s"} `
                    : "Run-time error before the scoreboard runs "}
                  {result.pass ? "✓ matches the samples" : "✕ still wrong"}
                </p>
                {result.run.error ? <p className="text-rose-800 dark:text-rose-200">{result.run.error}</p> : null}
                <p className="text-foreground/90">
                  <strong>Review: </strong>
                  {fix.review}
                </p>
              </div>
              <div className="grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                <CodeTrace label="Your fixed code" lines={toLines(scenarioCodeLines(fixScenario))} activeKey={result.run.error ? result.run.trace.at(-1)?.stmtId : undefined} />
                <HeapView scenario={fixScenario} state={result.run.final} caption="Heap when the run ends." />
              </div>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------

interface ObjectHandleVisualizerProps {
  /** Initial scenario in trace mode. */
  scenario?: HeapScenarioId;
  /** Restrict the scenario picker; defaults to every preset. */
  scenarios?: HeapScenarioId[];
  /** "trace" steps through a script with predictions; "bug" is the stored-handle debugging challenge. */
  mode?: "trace" | "bug";
}

/**
 * Heap view of SystemVerilog class handles and objects, driven by
 * `sv-object-model`: handle chips with arrows to objects, nested references,
 * unreachable objects greyed, predictions before each key statement.
 */
export default function ObjectHandleVisualizer({ scenario, scenarios, mode = "trace" }: ObjectHandleVisualizerProps) {
  if (mode === "bug") return <StoredHandleBug />;
  return <TraceMode scenario={scenario} scenarios={scenarios} />;
}

