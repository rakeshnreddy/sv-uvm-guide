"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ACCESS_STATEMENTS,
  DELETE_WALK_CODE,
  DELETE_WALK_DECL,
  X_INDEX_DECL,
  X_INDEX_STATEMENTS,
  accessOp,
  accessSemanticsQuestions,
  applyAssocOp,
  applyQueueOp,
  deleteWalkStart,
  deleteWalkSteps,
  formatElemList,
  formatQueueIndex,
  refPeekDecl,
  type AccessQuestion,
  type AccessStatement,
  type DeleteWalkStep,
  type DeleteWalkStrategy,
  type QueueIndexExpr,
  type QueueOp,
  applyContainerOp,
  createAssocArray,
  createDynamicArray,
  createQueue,
  declarationWithContents,
  formatAssocKey,
  formatElem,
  formatElemLiteral,
  predictContainerOp,
  queueCapacity,
  type ArrayDiagnostic,
  type ArrayOpResult,
  type AssocArrayState,
  type AssocKey,
  type AssocKeyType,
  type ContainerOp,
  type ContainerPrediction,
  type ContainerState,
  type SvElem,
  type SvElemTypeId,
} from "@/lib/systemverilog-array-model";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared views: also used by QueueOperationLab and SystemVerilog3DVisualizer. */
/* -------------------------------------------------------------------------- */

const diagnosticStyle: Record<ArrayDiagnostic["level"], { glyph: string; tag: string; className: string }> = {
  warning: {
    glyph: "⚠",
    tag: "Warning (required)",
    className: "border-amber-500/70 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  },
  "may-warn": {
    glyph: "⚠",
    tag: "May warn (tool-dependent)",
    className: "border-dashed border-amber-500/70 bg-amber-500/[0.07] text-amber-900 dark:text-amber-100",
  },
  error: {
    glyph: "✕",
    tag: "Error",
    className: "border-rose-500/70 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  },
};

/** Amber ⚠ chips for warnings, rose ✕ chips for compile errors; each cites its clause. */
export function DiagnosticChips({ diagnostics, className }: { diagnostics: ArrayDiagnostic[]; className?: string }) {
  if (diagnostics.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Diagnostics">
      {diagnostics.map((d) => {
        const style = diagnosticStyle[d.level];
        return (
          <li key={`${d.level}-${d.text}`} className={cn("inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", style.className)}>
            <span aria-hidden>{style.glyph}</span>
            <span className="font-semibold">{style.tag}:</span>
            <span className="font-mono [font-variant-ligatures:none]">{d.text}</span>
            <span className="opacity-75">{d.clause}</span>
          </li>
        );
      })}
    </ul>
  );
}

const chipValue = (v: SvElem) => (v === "X" ? "X" : v);

interface ElementStripProps {
  name: string;
  values: SvElem[];
  changed?: number[];
  /** Declared bound N of a `[$:N]` queue. Draws the remaining legal positions and the bound marker. */
  bound?: number | null;
  discarded?: SvElem[];
  className?: string;
}

/** Elements left to right by index. X is hatched; ▲ marks elements this step wrote. */
export function ElementStrip({ name, values, changed = [], bound = null, discarded = [], className }: ElementStripProps) {
  const free = bound === null ? 0 : Math.max(0, bound + 1 - values.length);
  const summary = values.length === 0 ? "empty" : values.map((v, i) => `[${i}] ${formatElem(v)}`).join(", ");
  return (
    <div
      role="group"
      aria-label={`${name}: ${summary}${bound !== null ? `; bound $:${bound}, room for ${free} more` : ""}${discarded.length ? `; discarded ${discarded.map(formatElem).join(", ")}` : ""}`}
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      <span className="mr-1 font-mono text-xs font-semibold text-muted-foreground [font-variant-ligatures:none]">{name}</span>
      {values.length === 0 && free === 0 ? <span className="text-xs italic text-muted-foreground">empty · size() = 0</span> : null}
      {values.map((v, i) => (
        <ValueChip key={i} name={`[${i}]`} value={chipValue(v)} changed={changed.includes(i)} />
      ))}
      {Array.from({ length: free }, (_, i) => (
        <span
          key={`free-${i}`}
          aria-hidden
          className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-dashed border-border px-1.5 font-mono text-[10px] text-muted-foreground/70"
        >
          [{values.length + i}]
        </span>
      ))}
      {bound !== null ? (
        <span aria-hidden className="inline-flex h-7 items-center gap-1 border-l-2 border-amber-500 pl-1.5 font-mono text-[10px] font-semibold text-amber-800 dark:text-amber-200">
          $:{bound}
        </span>
      ) : null}
      {discarded.length > 0 ? (
        <span aria-hidden className="ml-1 inline-flex flex-wrap items-center gap-1 rounded-md border border-rose-500/50 bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-800 dark:text-rose-200">
          ✕ discarded
          {discarded.map((v, i) => (
            <span key={i} className="font-mono line-through">
              {formatElem(v)}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Associative array entries in index order, with the `key` iterator marked ▶. */
export function AssocStrip({ state, changedKeys = [] }: { state: AssocArrayState; changedKeys?: AssocKey[] }) {
  const iterOnEntry = state.entries.some((e) => e.key === state.iter);
  return (
    <div className="min-w-0 space-y-2">
      <div
        role="group"
        aria-label={`${state.name} in index order: ${state.entries.length === 0 ? "empty" : state.entries.map((e) => `${formatAssocKey(e.key)} = ${formatElem(e.value)}`).join(", ")}`}
        className="flex min-w-0 flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 font-mono text-xs font-semibold text-muted-foreground [font-variant-ligatures:none]">{state.name}</span>
        {state.entries.length === 0 ? <span className="text-xs italic text-muted-foreground">no entries · num() = 0</span> : null}
        {state.entries.map((e) => (
          <span key={String(e.key)} className="inline-flex items-center gap-1">
            {e.key === state.iter ? (
              <span className="text-xs text-cyan-700 dark:text-cyan-300">
                <span aria-hidden>▶</span>
                <span className="sr-only">key points here:</span>
              </span>
            ) : null}
            <ValueChip name={formatAssocKey(e.key)} value={chipValue(e.value)} changed={changedKeys.includes(e.key)} />
          </span>
        ))}
        {state.entries.length > 1 ? <span aria-hidden className="text-[10px] text-muted-foreground">index order →</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono [font-variant-ligatures:none]">key = {formatAssocKey(state.iter)}</span>
        {!iterOnEntry ? " (not an existing index)" : ""}
        {state.writeOrder.length > 1 ? (
          <>
            {" · "}written in the order <span className="font-mono [font-variant-ligatures:none]">{state.writeOrder.map(formatAssocKey).join(", ")}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/** The current contents of any container, highlighting what `result` changed. */
export function ContainerStateView({ state, result }: { state: ContainerState; result?: ArrayOpResult | null }) {
  if (state.kind === "assoc") return <AssocStrip state={state} changedKeys={result?.changedKeys} />;
  return (
    <ElementStrip
      name={state.name}
      values={state.values}
      changed={result?.changedIndices}
      bound={state.kind === "queue" ? state.bound : null}
      discarded={result?.discarded}
    />
  );
}

type Tone = "write" | "read" | "danger" | "illegal";

const toneClass: Record<Tone, string> = {
  write: "border-cyan-500/50 hover:bg-cyan-500/10",
  read: "border-border/70 hover:bg-muted",
  danger: "border-rose-500/40 hover:bg-rose-500/10",
  illegal: "border-dashed border-rose-500/60 text-rose-800 hover:bg-rose-500/10 dark:text-rose-200",
};

const inputClass =
  "h-10 w-20 rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        className={inputClass}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(Math.trunc(n));
        }}
      />
    </label>
  );
}

/** Operation buttons for a container. Each button's text is the exact statement the model will run. */
export function ContainerControls({ state, onRun, disabled = false }: { state: ContainerState; onRun: (op: ContainerOp) => void; disabled?: boolean }) {
  const [value, setValue] = useState(5);
  const [index, setIndex] = useState(1);
  const [size, setSize] = useState(6);
  const [keyText, setKeyText] = useState(state.kind === "assoc" && state.keyType === "int" ? "7" : "eve");

  const parsedKey: AssocKey | null = useMemo(() => {
    if (state.kind !== "assoc") return null;
    if (state.keyType === "int") {
      const n = Number(keyText);
      return keyText.trim() !== "" && Number.isInteger(n) ? n : null;
    }
    return keyText.replace(/[^\x20-\x7e]/g, "").replace(/"/g, "").slice(0, 12);
  }, [keyText, state]);

  let ops: Array<{ op: ContainerOp; tone: Tone }> = [];
  if (state.kind === "dynamic") {
    ops = [
      { op: { op: "new", size }, tone: "danger" },
      { op: { op: "new-copy", size }, tone: "write" },
      { op: { op: "write", index, value }, tone: "write" },
      { op: { op: "read", index }, tone: "read" },
      { op: { op: "size" }, tone: "read" },
      { op: { op: "delete" }, tone: "danger" },
      { op: { op: "push_back", value }, tone: "illegal" },
    ];
  } else if (state.kind === "queue") {
    ops = [
      { op: { op: "push_back", value }, tone: "write" },
      { op: { op: "push_front", value }, tone: "write" },
      { op: { op: "insert", index, value }, tone: "write" },
      { op: { op: "pop_front" }, tone: "read" },
      { op: { op: "pop_back" }, tone: "read" },
      { op: { op: "read", index }, tone: "read" },
      { op: { op: "delete-index", index }, tone: "danger" },
      { op: { op: "size" }, tone: "read" },
      { op: { op: "delete" }, tone: "danger" },
    ];
  } else if (parsedKey !== null) {
    ops = [
      { op: { op: "write", key: parsedKey, value }, tone: "write" },
      { op: { op: "read", key: parsedKey }, tone: "read" },
      { op: { op: "exists", key: parsedKey }, tone: "read" },
      { op: { op: "delete-key", key: parsedKey }, tone: "danger" },
      { op: { op: "first" }, tone: "read" },
      { op: { op: "next" }, tone: "read" },
      { op: { op: "last" }, tone: "read" },
      { op: { op: "prev" }, tone: "read" },
      { op: { op: "foreach" }, tone: "read" },
      { op: { op: "num" }, tone: "read" },
      { op: { op: "delete" }, tone: "danger" },
    ];
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {state.kind === "dynamic" ? <NumberField label="N" value={size} min={0} max={16} onChange={(n) => setSize(Math.max(-1, Math.min(16, n)))} /> : null}
        {state.kind !== "assoc" ? <NumberField label="index" value={index} min={-1} max={20} onChange={(n) => setIndex(Math.max(-1, Math.min(20, n)))} /> : null}
        {state.kind === "assoc" ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            key ({state.keyType})
            <input type="text" className={cn(inputClass, "w-28")} value={keyText} onChange={(e) => setKeyText(e.target.value)} aria-invalid={parsedKey === null} />
          </label>
        ) : null}
        <NumberField label="value" value={value} min={-999} max={999} onChange={(n) => setValue(Math.max(-999, Math.min(999, n)))} />
      </div>
      {state.kind === "assoc" && parsedKey === null ? <p className="text-xs text-rose-700 dark:text-rose-300">✕ Enter an integer key for an int-indexed array.</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Operations">
        {ops.map(({ op, tone }) => {
          const code = applyContainerOp(state, op).code.replace(/;$/, "");
          return (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => onRun(op)}
              className={cn(
                "min-h-10 rounded-lg border bg-background/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
                toneClass[tone],
              )}
            >
              {code}
              {tone === "illegal" ? <span className="ml-1 font-sans">(try it)</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Renders `code` spans written with backticks in model sentences. */
export function InlineCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]">
            {part}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/** "Why" sentence, returned value and diagnostics for one operation. */
export function OpResultPanel({ result, elemType }: { result: ArrayOpResult; elemType: SvElemTypeId }) {
  const r = result.returned;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-mono text-xs text-foreground [font-variant-ligatures:none]">{result.code}</p>
      {r ? (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          Returned:
          {typeof r.value === "string" && r.value !== "X" ? (
            <span className="font-mono text-foreground">{r.label} = {formatAssocKey(r.value)}</span>
          ) : (
            <ValueChip name={r.label} value={r.value === "X" ? "X" : (r.value as number)} />
          )}
          {r.value === "X" ? <span className="font-mono text-xs">({formatElemLiteral("X", elemType)})</span> : null}
        </p>
      ) : null}
      {result.visited ? (
        <p className="text-muted-foreground">
          Visit order: <span className="font-mono text-foreground [font-variant-ligatures:none]">{result.visited.map(formatAssocKey).join(" → ") || "(none)"}</span>
        </p>
      ) : null}
      {result.returnedQueue ? (
        <p className="text-muted-foreground">
          Returned: <span className="font-mono text-foreground [font-variant-ligatures:none]">s = {formatElemList(result.returnedQueue)}</span>
        </p>
      ) : null}
      <DiagnosticChips diagnostics={result.diagnostics} />
      <p className="text-foreground">
        <strong>Why: </strong>
        {result.why} <span className="text-xs text-muted-foreground">({result.clause})</span>
      </p>
      {result.caveat ? (
        <p className="rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
          <strong className="text-foreground">Note: </strong>
          {result.caveat}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Container lab                                                               */
/* -------------------------------------------------------------------------- */

type Kind = "dynamic" | "queue" | "assoc";

interface LabConfig {
  dynamicType: "logic8" | "int";
  queueBound: "none" | "3";
  assocKey: AssocKeyType;
}

function initialState(kind: Kind, config: LabConfig): ContainerState {
  if (kind === "dynamic") return createDynamicArray("buffer", config.dynamicType, [0, 10, 20, 30]);
  if (kind === "queue") return createQueue("q", "int", config.queueBound === "none" ? null : 3, [10, 20, 30]);
  return config.assocKey === "string"
    ? createAssocArray("scores", "int", "string", [["beta", 3], ["alpha", 7], ["Gamma", 1]])
    : createAssocArray("scores", "int", "int", [[10, 3], [-5, 7], [3, 1]]);
}

const LAB_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §7.5 (dynamic arrays), §7.10 (queues), §7.8–§7.9 (associative arrays) and the invalid-index rules of §7.4.5.",
  "“Warning (required)” means the LRM says a warning shall be issued; “May warn” means the operation has no effect and a tool may or may not warn.",
  "Memory layout, hashing and performance are not modelled: the LRM specifies behaviour, not storage.",
  "Values are limited to small integers and at most 32 elements so the picture stays readable.",
];

const kindOptions = [
  { value: "dynamic" as const, label: "Dynamic array" },
  { value: "queue" as const, label: "Queue" },
  { value: "assoc" as const, label: "Associative array" },
];

interface Pending {
  id: number;
  result: ArrayOpResult;
  prediction: ContainerPrediction;
}

function ContainerLab({ initialKind = "dynamic" }: { initialKind?: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [config, setConfig] = useState<LabConfig>({ dynamicType: "logic8", queueBound: "3", assocKey: "string" });
  const [history, setHistory] = useState<ArrayOpResult[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [predictFirst, setPredictFirst] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const start = useMemo(() => initialState(kind, config), [kind, config]);
  const current = history.length > 0 ? history[history.length - 1].after : start;
  const last = history.length > 0 ? history[history.length - 1] : null;

  const resetWith = (nextKind: Kind, nextConfig: LabConfig) => {
    setKind(nextKind);
    setConfig(nextConfig);
    setHistory([]);
    setPending(null);
  };

  const run = (op: ContainerOp) => {
    const result = applyContainerOp(current, op);
    const prediction = predictFirst ? predictContainerOp(current, op) : null;
    if (prediction) {
      setPendingCount((n) => n + 1);
      setPending({ id: pendingCount + 1, result, prediction });
      return;
    }
    setHistory((h) => [...h, result]);
  };

  const applyPending = () => {
    if (!pending) return;
    setHistory((h) => [...h, pending.result]);
    setPending(null);
  };

  const codeLines: CodeTraceLine[] = [
    { text: declarationWithContents(start), key: "decl", owner: "testbench" },
    ...(current.kind === "assoc" ? [{ text: `${current.keyType} key;  // the ref index used by first/next/last/prev`, key: "keyvar" }] : []),
    ...history.slice(-8).map((r, i) => {
      const n = history.length - Math.min(8, history.length) + i;
      const notes = [
        r.returned ? `${r.returned.label} = ${typeof r.returned.value === "string" && r.returned.value !== "X" ? formatAssocKey(r.returned.value) : formatElem(r.returned.value as SvElem)}` : "",
        r.diagnostics.some((d) => d.level === "error") ? "✕ error" : "",
        r.diagnostics.some((d) => d.level === "warning") ? "⚠ warning" : "",
        r.diagnostics.some((d) => d.level === "may-warn") ? "⚠ may warn" : "",
      ].filter(Boolean);
      return { text: `${r.code}${notes.length ? `  // ${notes.join(", ")}` : ""}`, key: `op-${n}`, owner: "testbench" as const };
    }),
  ];

  const elemType = current.elemType;

  return (
    <VisualFrame
      label="Container lab"
      eyebrow="Experiment"
      title="Container lab: dynamic array, queue, associative array"
      summary="Run operations as buttons. Each one writes the SystemVerilog line it executes, updates the strip, and flags warnings. Tricky operations ask for your prediction first."
      fidelity="model"
      assumptions={LAB_ASSUMPTIONS}
    >
      <div data-testid="container-lab" className="space-y-4">
        <SegmentedControl label="Structure" options={kindOptions} value={kind} onChange={(k) => resetWith(k, config)} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {kind === "dynamic" ? (
            <SegmentedControl
              label="Element type"
              mono
              options={[
                { value: "logic8", label: "logic [7:0] (4-state)" },
                { value: "int", label: "int (2-state)" },
              ]}
              value={config.dynamicType}
              onChange={(t) => resetWith(kind, { ...config, dynamicType: t })}
            />
          ) : null}
          {kind === "queue" ? (
            <SegmentedControl
              label="Queue declaration"
              mono
              options={[
                { value: "none", label: "int q[$]" },
                { value: "3", label: "int q[$:3]" },
              ]}
              value={config.queueBound}
              onChange={(b) => resetWith(kind, { ...config, queueBound: b })}
            />
          ) : null}
          {kind === "assoc" ? (
            <SegmentedControl
              label="Index type"
              mono
              options={[
                { value: "string", label: "int scores[string]" },
                { value: "int", label: "int scores[int]" },
              ]}
              value={config.assocKey}
              onChange={(k) => resetWith(kind, { ...config, assocKey: k })}
            />
          ) : null}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={predictFirst} onChange={(e) => setPredictFirst(e.target.checked)} />
            Predict before tricky operations
          </label>
        </div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          <div className="min-w-0" data-testid="container-code">
            <CodeTrace label="Code you have run" lines={codeLines} activeKey={last ? `op-${history.length - 1}` : undefined} />
          </div>
          <div className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-background/50 p-3" data-testid="container-state">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {current.kind === "assoc" ? `Entries · num() = ${current.entries.length}` : `Elements · size() = ${current.values.length}`}
              {current.kind === "queue" && current.bound !== null ? ` of at most ${queueCapacity(current)}` : ""}
            </p>
            <ContainerStateView state={current} result={last} />
            {current.kind === "dynamic" ? (
              <p className="text-xs text-muted-foreground">No capacity, no push or pop: the size changes only through new[], delete() or assigning another array.</p>
            ) : null}
          </div>
        </div>

        <ContainerControls key={`${kind}-${JSON.stringify(config)}`} state={current} onRun={run} disabled={pending !== null} />

        {pending ? (
          <PredictionPrompt
            resetKey={String(pending.id)}
            question={<InlineCode text={pending.prediction.question} />}
            options={pending.prediction.options}
          >
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3">
              <ContainerStateView state={pending.result.after} result={pending.result} />
              <OpResultPanel result={pending.result} elemType={elemType} />
              <button
                type="button"
                onClick={applyPending}
                className="inline-flex h-10 items-center rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Apply and continue ▸
              </button>
            </div>
          </PredictionPrompt>
        ) : (
          <div aria-live="polite" data-testid="container-result" className="rounded-xl border border-border/70 bg-background/50 p-3">
            {last ? <OpResultPanel result={last} elemType={elemType} /> : <p className="text-sm text-muted-foreground">Pick an operation. The ones whose outcome often surprises people ask for your prediction first.</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={history.length === 0 || pending !== null}
            onClick={() => setHistory((h) => h.slice(0, -1))}
            className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            ◀ Undo last operation
          </button>
          <button
            type="button"
            onClick={() => resetWith(kind, config)}
            className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reset
          </button>
        </div>
      </div>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Lesson presets                                                              */
/* -------------------------------------------------------------------------- */

export type DynamicStructurePreset = "access-semantics" | "slices" | "delete-walk";

const PRESETS: Array<{ value: DynamicStructurePreset; label: string }> = [
  { value: "access-semantics", label: "Reads, defaults, allocation" },
  { value: "slices", label: "Queue slices and writes" },
  { value: "delete-walk", label: "Delete while walking" },
];

const isPreset = (value: string | undefined): value is DynamicStructurePreset => PRESETS.some((p) => p.value === value);

const smallButton =
  "min-h-10 rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

/** Calls `onReveal` once when mounted: placed inside a PredictionPrompt's revealed content. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    onReveal();
  }, [onReveal]);
  return null;
}

/* ---- Multi-question predict-then-reveal --------------------------------- */

const ASPECT_TITLE: Record<AccessQuestion["aspect"], string> = {
  value: "1. Value",
  warning: "2. Warning",
  num: "3. num() afterwards",
};

/**
 * Several predictions committed together. Nothing about the outcome renders until the
 * learner locks in every answer (or skips); then each answer gets the model's reason.
 */
function MultiPrediction({ questions, resetKey, children }: { questions: AccessQuestion[]; resetKey: string; children: React.ReactNode }) {
  const groupId = useId();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPicked({});
    setRevealed(false);
  }
  const complete = questions.every((q) => picked[q.aspect]);
  const score = questions.filter((q) => q.options.find((o) => o.id === picked[q.aspect])?.correct).length;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3 sm:p-4" data-testid="access-prediction">
      <p className="text-sm font-semibold text-foreground">
        <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
        Commit to all {questions.length} answers, then reveal.
      </p>
      {questions.map((q) => {
        const chosen = q.options.find((o) => o.id === picked[q.aspect]);
        const correct = q.options.find((o) => o.correct);
        return (
          <fieldset key={q.aspect} disabled={revealed} className="min-w-0 space-y-2">
            <legend className="mb-1 text-sm text-foreground">
              <span className="mr-1 font-semibold">{ASPECT_TITLE[q.aspect]}:</span>
              <InlineCode text={q.question} />
            </legend>
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-2 text-sm",
                    picked[q.aspect] === o.id && !revealed && "border-amber-500/70 bg-amber-500/10",
                    revealed && o.correct && "border-emerald-500/70 bg-emerald-500/10",
                    revealed && picked[q.aspect] === o.id && !o.correct && "border-rose-500/70 bg-rose-500/10",
                    revealed && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name={`${groupId}-${q.aspect}`}
                    checked={picked[q.aspect] === o.id}
                    onChange={() => setPicked((p) => ({ ...p, [q.aspect]: o.id }))}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="flex-1 break-words font-mono text-xs [font-variant-ligatures:none]">{o.label}</span>
                  {revealed && o.correct ? <span aria-label="correct answer">✓</span> : null}
                  {revealed && picked[q.aspect] === o.id && !o.correct ? <span aria-label="your answer, incorrect">✕</span> : null}
                </label>
              ))}
            </div>
            {revealed ? (
              <p className={cn("text-sm", !chosen ? "text-muted-foreground" : chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                {chosen ? <strong>{chosen.correct ? "Correct. " : "Not quite. "}</strong> : null}
                {(chosen && !chosen.correct ? chosen : correct)?.feedback}
              </p>
            ) : null}
          </fieldset>
        );
      })}
      {/* Mounted before the reveal, so screen readers announce the score when it is filled in. */}
      <div aria-live="polite" role="status" data-testid="access-score">
        {revealed && complete ? <p className="text-sm font-semibold text-foreground">{score} of {questions.length} right.</p> : null}
      </div>
      {!revealed ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!complete}
            onClick={() => setRevealed(true)}
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock in predictions
          </button>
          <button type="button" onClick={() => setRevealed(true)} className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Reveal without predicting
          </button>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

/* ---- Preset: reads, defaults and allocation ------------------------------ */

const STATEMENT_LABEL: Record<AccessStatement, string> = {
  read: "v = a[k]",
  write: "a[k] = 5",
  increment: "a[k]++",
  "add-assign": "a[k] += 2",
  "ref-arg": "v = peek(a[k])",
  exists: "a.exists(k)",
  "delete-key": "a.delete(k)",
};

type KeyChoice = "missing" | "written" | "x";

const MISSING_KEY = 1;
const WRITTEN_KEY = 3;
const WRITTEN_VALUE = 7;
const DECLARED_DEFAULT = 1;

function AccessSemanticsPanel() {
  const [statement, setStatement] = useState<AccessStatement>("read");
  const [keyChoice, setKeyChoice] = useState<KeyChoice>("missing");
  const [declares, setDeclares] = useState(false);
  const [elemType, setElemType] = useState<"int" | "logic8">("int");
  const [startsWithEntry, setStartsWithEntry] = useState(true);

  const xAllowed = X_INDEX_STATEMENTS.includes(statement) && !declares;
  // Without the a[3] = 7 entry, key 3 would just be a second missing key, so that option is turned off.
  const effectiveKey: KeyChoice = (keyChoice === "x" && !xAllowed) || (keyChoice === "written" && !startsWithEntry) ? "missing" : keyChoice;
  const state = useMemo(
    () => createAssocArray("a", elemType, "int", startsWithEntry ? [[WRITTEN_KEY, WRITTEN_VALUE]] : [], declares ? DECLARED_DEFAULT : null),
    [elemType, startsWithEntry, declares],
  );
  const op = accessOp(statement, effectiveKey === "written" ? WRITTEN_KEY : MISSING_KEY, effectiveKey === "x");
  const result = applyAssocOp(state, op);
  const questions = accessSemanticsQuestions(state, op);
  const resetKey = `${statement}|${effectiveKey}|${declares}|${elemType}|${startsWithEntry}`;
  const allocated = result.after.entries.length > state.entries.length;
  const removed = result.after.entries.length < state.entries.length;

  const loadStandardExample = () => {
    setStatement("increment");
    setKeyChoice("missing");
    setDeclares(true);
    setElemType("int");
    setStartsWithEntry(false);
  };

  const codeLines: CodeTraceLine[] = [
    ...(effectiveKey === "x" ? [{ text: X_INDEX_DECL, key: "kx" }] : []),
    ...(statement === "ref-arg" ? [{ text: refPeekDecl(elemType), key: "peek" }] : []),
    { text: declarationWithContents(state), key: "decl", owner: "testbench" as const },
    { text: result.code, key: "stmt", owner: "testbench" as const },
  ];


  return (
    <div className="space-y-4" data-testid="access-semantics">
      <SegmentedControl
        label="Statement"
        mono
        options={ACCESS_STATEMENTS.map((st) => ({ value: st, label: STATEMENT_LABEL[st] }))}
        value={statement}
        onChange={setStatement}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SegmentedControl
          label="Key k"
          mono
          options={[
            { value: "missing" as const, label: `${MISSING_KEY} (never written)` },
            { value: "written" as const, label: startsWithEntry ? `${WRITTEN_KEY} (written: ${WRITTEN_VALUE})` : `${WRITTEN_KEY} (needs a[${WRITTEN_KEY}] = ${WRITTEN_VALUE})`, disabled: !startsWithEntry },
            { value: "x" as const, label: "kx = 'x", disabled: !xAllowed },
          ]}
          value={effectiveKey}
          onChange={setKeyChoice}
        />
        <SegmentedControl
          label="Element type"
          mono
          options={[
            { value: "int" as const, label: "int (2-state)" },
            { value: "logic8" as const, label: "logic [7:0] (4-state)" },
          ]}
          value={elemType}
          onChange={setElemType}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={declares} onChange={(e) => setDeclares(e.target.checked)} />
          Declares <code className="font-mono [font-variant-ligatures:none]">default:{DECLARED_DEFAULT}</code>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={startsWithEntry} onChange={(e) => setStartsWithEntry(e.target.checked)} />
          Starts with <code className="font-mono [font-variant-ligatures:none]">a[{WRITTEN_KEY}] = {WRITTEN_VALUE}</code>
        </label>
        <button type="button" className={smallButton} onClick={loadStandardExample}>
          Load the standard&apos;s example (§7.8.7)
        </button>
      </div>
      {!xAllowed ? (
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">kx = &apos;x is off here.</strong>{" "}
          {declares
            ? "§7.8.6 does not say whether a declared default covers an x/z index as well as a missing key, so the lab does not guess."
            : "§7.8.6 states the x/z-index rule for reads and writes only; it does not spell it out for this statement, so the lab does not model it."}
        </p>
      ) : null}

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <CodeTrace label="Statement under test" lines={codeLines} activeKey="stmt" />
        </div>
        <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Before · num() = {state.entries.length}</p>
          <AssocStrip state={state} />
        </div>
      </div>

      <MultiPrediction questions={questions} resetKey={resetKey}>
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3" data-testid="access-result">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">After · num() = {result.after.entries.length}</p>
          <AssocStrip state={result.after} changedKeys={result.changedKeys} />
          <p className={cn("text-sm", allocated ? "text-cyan-800 dark:text-cyan-200" : "text-muted-foreground")}>
            <strong className="text-foreground">{allocated ? "An entry appeared. " : removed ? "An entry was removed. " : "No entry appeared. "}</strong>
            <span className="text-xs">({result.clause})</span>
          </p>
          <OpResultPanel result={result} elemType={elemType} />
        </div>
      </MultiPrediction>
    </div>
  );
}

/* ---- Preset: queue slices and indexed writes ----------------------------- */

const SLICE_BASE = [10, 20, 30, 40];
/** The visible index track. Phones get fewer, wider columns; values beyond either end get an edge marker. */
interface TrackRange {
  min: number;
  max: number;
}
const WIDE_TRACK: TrackRange = { min: -3, max: 9 };
const NARROW_TRACK: TrackRange = { min: -2, max: 6 };
const NARROW_QUERY = "(max-width: 479px)";

function subscribeNarrow(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
const narrowSnapshot = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW_QUERY).matches;

function useTrackRange(): TrackRange {
  const narrow = useSyncExternalStore(subscribeNarrow, narrowSnapshot, () => false);
  return narrow ? NARROW_TRACK : WIDE_TRACK;
}

const trackColumns = (t: TrackRange) => Array.from({ length: t.max - t.min + 1 }, (_, i) => t.min + i);
const clampTo = (t: TrackRange, n: number) => Math.max(t.min, Math.min(t.max, n));
/** Columns an off-track edge marker spans, so its label fits. */
const EDGE_SPAN = 4;

const SLICE_EXAMPLES: Array<[QueueIndexExpr, QueueIndexExpr]> = [[1, 2], [2, 1], [-1, 1], [2, 9], [0, 0], [7, 7], ["X", 2]];
const WRITE_EXAMPLES: QueueIndexExpr[] = [4, 7, 1, -1, "X"];

function parseIndexExpr(text: string): QueueIndexExpr | null {
  const t = text.trim().toLowerCase();
  if (t === "x" || t === "'x" || t === "kx") return "X";
  if (!/^-?\d{1,3}$/.test(t)) return null;
  return Number(t);
}

interface HandleProps {
  name: string;
  value: QueueIndexExpr;
  onChange: (v: QueueIndexExpr) => void;
  trackRef: React.RefObject<HTMLDivElement>;
  track: TrackRange;
}

/**
 * A slider handle on the index track: arrow keys move it one index, Home/End jump, or drag it.
 * A typed value beyond the track is pinned to that edge with an arrow; aria-valuenow stays on the
 * track and aria-valuetext carries the real value.
 */
function TrackHandle({ name, value, onChange, trackRef, track }: HandleProps) {
  const dragging = useRef(false);
  const pos = value === "X" ? null : value;
  const cols = track.max - track.min + 1;
  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const col = Math.floor(((clientX - rect.left) / rect.width) * cols);
    onChange(clampTo(track, track.min + col));
  };
  const off = pos === null ? null : pos < track.min ? "below" : pos > track.max ? "above" : null;
  const span = Math.min(EDGE_SPAN, cols);
  const startCol = pos === null ? 1 : off === "below" ? 1 : off === "above" ? cols - span + 1 : pos - track.min + 1;
  return (
    <div className="grid min-w-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {pos === null ? (
        <span className="col-span-full font-mono text-[11px] text-rose-700 [font-variant-ligatures:none] dark:text-rose-300">{name} = kx (&apos;x): off the track</span>
      ) : (
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Index ${name}`}
          aria-valuemin={track.min}
          aria-valuemax={track.max}
          aria-valuenow={clampTo(track, pos)}
          aria-valuetext={off === null ? `${name} = ${pos}` : `${name} = ${pos}, off the track ${off === "below" ? `before ${track.min}` : `past ${track.max}`}`}
          data-track-column={startCol}
          data-off-track={off ?? undefined}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
            if (step !== 0) {
              e.preventDefault();
              onChange(clampTo(track, pos + step));
            } else if (e.key === "Home") {
              e.preventDefault();
              onChange(track.min);
            } else if (e.key === "End") {
              e.preventDefault();
              onChange(track.max);
            }
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragging.current) fromPointer(e.clientX);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          style={{ gridColumnStart: startCol, gridColumnEnd: off === null ? undefined : `span ${span}` }}
          className={cn(
            "flex h-11 min-w-0 cursor-grab touch-none items-center justify-center rounded-md border-2 font-mono text-xs font-bold [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:h-8",
            off === null
              ? "border-cyan-600 bg-cyan-500/20 text-cyan-900 dark:text-cyan-100"
              : "border-dashed border-rose-600 bg-rose-500/10 text-rose-800 dark:text-rose-200",
          )}
        >
          {off === "below" ? `◀ ${name} = ${pos}` : off === "above" ? `${name} = ${pos} ▶` : name}
        </div>
      )}
    </div>
  );
}

function IndexField({ label, value, onChange }: { label: string; value: QueueIndexExpr; onChange: (v: QueueIndexExpr) => void }) {
  const [text, setText] = useState(formatQueueIndex(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(value === "X" ? "x" : String(value));
  }
  const parsed = parseIndexExpr(text);
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <input
        type="text"
        inputMode="text"
        className={cn(inputClass, "w-16")}
        value={text}
        aria-invalid={parsed === null}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseIndexExpr(e.target.value);
          if (p !== null) onChange(p === "X" ? "X" : Math.max(-99, Math.min(99, p)));
        }}
      />
    </label>
  );
}

function SlicePanel() {
  const [mode, setMode] = useState<"slice" | "write">("slice");
  const [from, setFrom] = useState<QueueIndexExpr>(1);
  const [to, setTo] = useState<QueueIndexExpr>(2);
  const [wIndex, setWIndex] = useState<QueueIndexExpr>(4);
  const [wValue, setWValue] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);
  const track = useTrackRange();
  const columns = trackColumns(track);

  const q = useMemo(() => createQueue("q", "int", null, SLICE_BASE), []);
  const op: QueueOp = mode === "slice" ? { op: "slice", from, to } : { op: "write", index: wIndex, value: wValue };
  const result = applyQueueOp(q, op);
  const prediction = predictContainerOp(q, op);
  const usesX = mode === "slice" ? from === "X" || to === "X" : wIndex === "X";
  const range = result.sliceRange;

  const codeLines: CodeTraceLine[] = [
    { text: declarationWithContents(q), key: "decl", owner: "testbench" },
    ...(usesX ? [{ text: X_INDEX_DECL, key: "kx" }] : []),
    ...(mode === "slice" ? [{ text: "int s[$];", key: "s" }] : []),
    { text: result.code, key: "stmt", owner: "testbench" as const },
  ];

  return (
    <div className="space-y-4" data-testid="queue-slices">
      <SegmentedControl
        label="Mode"
        options={[
          { value: "slice" as const, label: "Slice q[a:b]" },
          { value: "write" as const, label: "Write q[i] = v" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="space-y-1 rounded-xl border border-border/70 bg-background/50 p-2 sm:p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          q = {formatElemList(q.values)} · $ = {q.values.length - 1}
        </p>
        {mode === "slice" ? (
          <>
            <TrackHandle name="a" value={from} onChange={setFrom} trackRef={trackRef} track={track} />
            <TrackHandle name="b" value={to} onChange={setTo} trackRef={trackRef} track={track} />
          </>
        ) : (
          <TrackHandle name="i" value={wIndex} onChange={setWIndex} trackRef={trackRef} track={track} />
        )}
        <div ref={trackRef} aria-hidden className="grid min-w-0 gap-px" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((i) => {
            const inside = i >= 0 && i < q.values.length;
            return (
              <div key={i} className="flex min-w-0 flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-sm font-mono text-[11px] tabular-nums",
                    inside ? "border border-cyan-500/50 bg-cyan-500/10 text-foreground" : "border border-dashed border-border text-muted-foreground/60",
                  )}
                >
                  {inside ? formatElem(q.values[i]) : i === q.values.length ? "$+1" : "·"}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{i}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Tab to a handle, then use the arrow keys, or drag it. Dashed cells lie outside 0..$.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {mode === "slice" ? (
          <>
            <IndexField label="a" value={from} onChange={setFrom} />
            <IndexField label="b" value={to} onChange={setTo} />
          </>
        ) : (
          <>
            <IndexField label="i" value={wIndex} onChange={setWIndex} />
            <NumberField label="v" value={wValue} min={-999} max={999} onChange={(n) => setWValue(Math.max(-999, Math.min(999, n)))} />
          </>
        )}
        <span className="text-[11px] text-muted-foreground">Type an integer, or x for an index with x bits.</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lesson examples">
        {mode === "slice"
          ? SLICE_EXAMPLES.map(([a, b]) => (
              <button key={`${a}:${b}`} type="button" className={cn(smallButton, "font-mono [font-variant-ligatures:none]")} onClick={() => { setFrom(a); setTo(b); }}>
                q[{formatQueueIndex(a)}:{formatQueueIndex(b)}]
              </button>
            ))
          : WRITE_EXAMPLES.map((i) => (
              <button key={String(i)} type="button" className={cn(smallButton, "font-mono [font-variant-ligatures:none]")} onClick={() => setWIndex(i)}>
                q[{i === q.values.length ? "$+1" : formatQueueIndex(i)}] = {wValue}
              </button>
            ))}
      </div>

      <CodeTrace label="Statement under test" lines={codeLines} activeKey="stmt" />

      {prediction ? (
        <PredictionPrompt resetKey={result.code} question={<InlineCode text={prediction.question} />} options={prediction.options}>
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3" data-testid="slice-result">
            {mode === "slice" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {range ? `Selected positions ${range.from} to ${range.to} of q.` : "No position of q is selected."}
                </p>
                <ElementStrip name="s" values={result.returnedQueue ?? []} />
              </>
            ) : (
              <ElementStrip name="q" values={result.after.values} changed={result.changedIndices} />
            )}
            <OpResultPanel result={result} elemType="int" />
          </div>
        </PredictionPrompt>
      ) : null}
    </div>
  );
}

/* ---- Preset: deleting while walking an associative array ----------------- */

const STRATEGY_OPTIONS: Array<{ value: DeleteWalkStrategy; label: string }> = [
  { value: "foreach", label: "foreach + delete" },
  { value: "find-index", label: "find_index, then delete" },
  { value: "first-next", label: "first()/next() walk" },
];

interface WalkFrame {
  step: DeleteWalkStep | null;
  state: AssocArrayState;
}

function WalkStrip({ state, changedKeys = [], emptyIds }: { state: AssocArrayState; changedKeys?: AssocKey[]; emptyIds?: AssocKey[] }) {
  const idIsKey = state.entries.some((e) => e.key === state.iter);
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={`exp_by_id keys: ${state.entries.length === 0 ? "none" : state.entries.map((e) => `${formatAssocKey(e.key)} (size ${formatElem(e.value)})`).join(", ")}`}
        className="flex min-w-0 flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 font-mono text-xs font-semibold text-muted-foreground [font-variant-ligatures:none]">exp_by_id</span>
        {state.entries.length === 0 ? <span className="text-xs italic text-muted-foreground">no keys</span> : null}
        {state.entries.map((e) => (
          <span key={String(e.key)} className="inline-flex items-center gap-1">
            {e.key === state.iter ? <span aria-hidden className="text-xs text-cyan-700 dark:text-cyan-300">▶</span> : null}
            <ValueChip name={`[${formatAssocKey(e.key)}] size`} value={chipValue(e.value)} changed={changedKeys.includes(e.key)} />
          </span>
        ))}
      </div>
      <p className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
        id = {formatAssocKey(state.iter)}
        {idIsKey ? "" : " (not a key)"}
        {emptyIds ? ` · empty_ids = ${emptyIds.length ? `'{${emptyIds.map(formatAssocKey).join(", ")}}` : "'{}"}` : ""}
      </p>
    </div>
  );
}

function FrameResult({ frame }: { frame: WalkFrame }) {
  const step = frame.step;
  if (!step) return <WalkStrip state={frame.state} />;
  if (step.undefinedOutcome) {
    return (
      <div className="space-y-2 rounded-xl border-2 border-dashed border-rose-500/60 bg-rose-500/[0.06] p-3" data-testid="undefined-panel">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Undefined ({step.clause})</p>
        <p className="text-sm text-foreground">{step.why}</p>
        <p className="text-xs text-muted-foreground">Last defined state, before the next iteration:</p>
        <WalkStrip state={step.before} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <WalkStrip state={step.after} changedKeys={step.changedKeys} emptyIds={step.emptyIds} />
      {step.found !== undefined ? <p className="font-mono text-xs text-foreground [font-variant-ligatures:none]">found = {step.found}</p> : null}
      <p className="text-sm text-foreground">
        <strong>Why: </strong>
        {step.why} <span className="text-xs text-muted-foreground">({step.clause})</span>
      </p>
    </div>
  );
}

/** What the learner predicted at a walk step, kept so scrubbing back shows it instead of re-asking. */
function PredictionRecap({ prediction, chosenId }: { prediction: ContainerPrediction; chosenId: string }) {
  const chosen = prediction.options.find((o) => o.id === chosenId);
  const correct = prediction.options.find((o) => o.correct);
  return (
    <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-2 text-sm" data-testid="prediction-recap">
      <p className="text-foreground">
        <InlineCode text={prediction.question} />
      </p>
      {chosen ? (
        <p className={chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
          <strong>{chosen.correct ? "Correct. " : "Not quite. "}</strong>
          You predicted <span className="font-mono [font-variant-ligatures:none]">{chosen.label}</span>. {chosen.feedback}
        </p>
      ) : null}
      {correct && (!chosen || !chosen.correct) ? (
        <p className="text-muted-foreground">
          <strong className="text-foreground">Answer: </strong>
          <span className="font-mono [font-variant-ligatures:none]">{correct.label}</span>. {correct.feedback}
        </p>
      ) : null}
    </div>
  );
}

function DeleteWalkPanel() {
  const [strategy, setStrategy] = useState<DeleteWalkStrategy>("first-next");
  /** Step key → chosen option id, or "skipped". */
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const frames = useMemo<WalkFrame[]>(() => {
    const start = deleteWalkStart();
    return [{ step: null, state: start }, ...deleteWalkSteps(strategy, start).map((step) => ({ step, state: step.after }))];
  }, [strategy]);
  const playback = usePlayback(frames.length, strategy);
  const keyFor = (i: number) => `${strategy}-${i}`;
  const gate = frames.findIndex((f, i) => f.step?.prediction && !answered[keyFor(i)]);
  const shown = gate >= 0 ? Math.min(playback.index, gate) : playback.index;
  const frame = frames[Math.min(shown, frames.length - 1)];
  const step = frame.step;
  const awaiting = Boolean(step?.prediction && !answered[keyFor(shown)]);

  useEffect(() => {
    if (gate >= 0 && playback.index > gate) playback.seek(gate);
  }, [gate, playback]);

  const markAnswered = React.useCallback((key: string, choice = "skipped") => setAnswered((a) => (a[key] ? a : { ...a, [key]: choice })), []);

  const codeLines: CodeTraceLine[] = [
    { text: DELETE_WALK_DECL, key: "decl0", owner: "testbench" },
    // foreach declares its own loop variable id (§12.7.3), and find_index uses neither id nor found.
    ...(strategy === "first-next" ? [{ text: "int id, found;  // id starts at 0", key: "decl1" }] : []),
    ...DELETE_WALK_CODE[strategy].map((l) => ({ text: l.text, key: l.key, owner: "testbench" as const })),
  ];
  const describe = (i: number) => (frames[i]?.step ? frames[i].step!.code : "start: keys 1, 4, 9");
  const liveText = !step
    ? `Start: keys ${frame.state.entries.map((e) => formatAssocKey(e.key)).join(", ")}; keys 4 and 9 hold empty queues.`
    : awaiting
      ? `Step ${shown}: ${step.code}. Predict before the result is shown.`
      : step.undefinedOutcome
        ? `Step ${shown}: undefined (${step.clause}).`
        : `Step ${shown}: ${step.code}. Keys now ${step.after.entries.map((e) => formatAssocKey(e.key)).join(", ") || "none"}; id = ${formatAssocKey(step.after.iter)}.`;

  return (
    <div className="space-y-4" data-testid="delete-walk">
      <SegmentedControl label="Cleanup strategy" options={STRATEGY_OPTIONS} value={strategy} onChange={setStrategy} />
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <CodeTrace label="Cleanup code" lines={codeLines} activeKey={step?.line} />
        </div>
        <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {step ? <span className="font-mono normal-case tracking-normal [font-variant-ligatures:none]">{step.code}</span> : "Start"}
          </p>
          {step?.prediction && awaiting ? <WalkStrip state={step.before} /> : null}
          {step?.prediction ? (
            answered[keyFor(shown)] ? (
              <>
                <PredictionRecap prediction={step.prediction} chosenId={answered[keyFor(shown)]} />
                <FrameResult frame={frame} />
              </>
            ) : (
              <PredictionPrompt
                resetKey={keyFor(shown)}
                question={<InlineCode text={step.prediction.question} />}
                options={step.prediction.options}
                onCommit={(id) => markAnswered(keyFor(shown), id)}
              >
                <RevealSignal onReveal={() => markAnswered(keyFor(shown))} />
              </PredictionPrompt>
            )
          ) : (
            <FrameResult frame={frame} />
          )}
        </div>
      </div>
      <PlaybackControls playback={playback} stepCount={frames.length} stepNoun="Cleanup step" describeStep={describe} />
      {awaiting ? <p className="text-xs text-amber-800 dark:text-amber-200">Answer the prediction to step further.</p> : null}
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
    </div>
  );
}

const PRESET_ASSUMPTIONS: Record<DynamicStructurePreset, string[]> = {
  "access-semantics": [
    "Implements IEEE 1800-2023 §7.8.6 (invalid reads and writes), §7.8.7 (allocation), §7.9.11 (defaults), §7.9.2 and §7.9.3.",
    "The x/z index is offered only for reads and writes without a declared default: those are the cases §7.8.6 states.",
    "For a ref actual, §7.8.7 says the entry is allocated; the initial value shown is the one it states for read-modify-write.",
  ],
  slices: [
    "Implements the queue-operator rules of IEEE 1800-2023 §7.10.1. Every line starts from the same four items.",
    `Indices on the track run from ${WIDE_TRACK.min} to ${WIDE_TRACK.max} (${NARROW_TRACK.min} to ${NARROW_TRACK.max} on a phone). Type a value to go further: a handle beyond the track is pinned to that edge with an arrow. Type x for an index with x bits.`,
  ],
  "delete-walk": [
    "exp_by_id is bit [31:0] exp_by_id [int][$]; each key shows its queue's size() instead of the items.",
    "first()/next() follow §7.9.4 and §7.9.6. The foreach strategy stops where §12.7.3 makes the result undefined.",
    "find_index traverses in an unspecified order (§7.12.1); the lab lists empty_ids in index order.",
  ],
};

const PRESET_SUMMARY: Record<DynamicStructurePreset, string> = {
  "access-semantics": "Pick a statement and a key. Predict the value, whether a warning is required, and num() afterwards; then see whether an entry appeared.",
  slices: "Move the handles, or type the bounds, and predict the slice. In write mode, predict whether the write updates, appends or is ignored.",
  "delete-walk": "Step through three ways to delete the empty IDs from exp_by_id. Predict what next(id) does after the current key is deleted.",
};

function PresetLab({ initialPreset }: { initialPreset: DynamicStructurePreset }) {
  const [preset, setPreset] = useState<DynamicStructurePreset>(initialPreset);
  return (
    <VisualFrame
      label="Container lab"
      eyebrow="Predict, then check"
      title={PRESETS.find((p) => p.value === preset)?.label ?? "Container lab"}
      summary={PRESET_SUMMARY[preset]}
      fidelity="model"
      assumptions={PRESET_ASSUMPTIONS[preset]}
    >
      <div className="space-y-4" data-testid="container-preset">
        <SegmentedControl label="Experiment" options={PRESETS} value={preset} onChange={setPreset} />
        {preset === "access-semantics" ? <AccessSemanticsPanel /> : preset === "slices" ? <SlicePanel /> : <DeleteWalkPanel />}
      </div>
    </VisualFrame>
  );
}

export interface DynamicStructureVisualizerProps {
  /** Structure the free lab opens on. */
  initialKind?: Kind;
  /** A lesson preset: "access-semantics", "slices" or "delete-walk". Unknown values open the free lab. */
  initialPreset?: string;
}

export function DynamicStructureVisualizer({ initialKind = "dynamic", initialPreset }: DynamicStructureVisualizerProps) {
  if (isPreset(initialPreset)) return <PresetLab initialPreset={initialPreset} />;
  return <ContainerLab initialKind={initialKind} />;
}

export default DynamicStructureVisualizer;
