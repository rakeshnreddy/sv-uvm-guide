"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
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
      <DiagnosticChips diagnostics={result.diagnostics} />
      <p className="text-foreground">
        <strong>Why: </strong>
        {result.why} <span className="text-xs text-muted-foreground">({result.clause})</span>
      </p>
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

export function DynamicStructureVisualizer({ initialKind = "dynamic" }: { initialKind?: Kind }) {
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
                className="inline-flex h-10 items-center rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

export default DynamicStructureVisualizer;
