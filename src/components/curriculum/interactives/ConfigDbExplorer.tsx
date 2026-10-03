"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  CONFIG_PRESETS,
  CONFIG_TYPES,
  NO_VALUE,
  PHASE_LABELS,
  STANDARD_CFG_TREE,
  TOP_MODULE,
  configSource,
  depthOf,
  diagnoseGetCandidate,
  explainGet,
  getCandidates,
  opToSource,
  reachAt,
  resolveScope,
  runConfigDb,
  scheduleConfigOps,
  shortName,
  type CfgGetOp,
  type CfgOp,
  type CfgPhase,
  type CfgSetOp,
  type ConfigRun,
} from "@/lib/uvm-config-db-model";
import { cn } from "@/lib/utils";

export const CONFIG_DB_MODEL_ASSUMPTIONS = [
  "Implements uvm_config_db from uvm-core 2020.3.1 (IEEE 1800.2-2020 Annex C.4.2.2): scope = {cntxt.get_full_name(), \".\", inst_name}; a null cntxt means uvm_root (full name \"\").",
  "During build_phase a set's precedence is 1000 minus the depth of its cntxt (uvm_root 0, uvm_test_top 1, …); at any other time it is 1000. Equal precedence: the most recent set() wins.",
  "get() needs the exact field name, the exact type parameter T, and a scope glob that matches its own path. Otherwise it returns 0 and prints nothing (unless +UVM_CONFIG_DB_TRACE is on).",
  "Build calls run top-down by component; run_phase calls run in list order, 10 ns apart. Not modelled: /regex/ scopes, uvm_resource_db, wait_modified.",
];

const SET_CALLERS = [TOP_MODULE, "uvm_test_top", "uvm_test_top.env", "uvm_test_top.env.agt0"];

const debugHints: Record<string, string[]> = {
  "type-mismatch": [
    "There is no error message. Turn on the trace below: what does the GET line say?",
    "Compare the #( ) parameter of the set() with the #( ) parameter of the get().",
    "virtual apb_if and virtual apb_if.drv_mp are different types, so they live in different databases. Make both sides use the same type.",
  ],
  "field-typo": [
    "The scope and the type both match. What else must match exactly?",
    "Compare the third argument of set() and get() character by character.",
    "Field names are looked up by exact string; spell-checking is off for get().",
  ],
};

const inputClass =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-[11.5px] text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const smallButton =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 px-2 text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

function RevealSignal({ id, onReveal }: { id: string; onReveal: (id: string) => void }) {
  useEffect(() => {
    onReveal(id);
  }, [id, onReveal]);
  return null;
}

const cloneOps = (ops: CfgOp[]): CfgOp[] => ops.map((o) => ({ ...o }));

function SetRow({
  op,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  op: CfgSetOp;
  index: number;
  count: number;
  onChange: (next: CfgSetOp) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const n = index + 1;
  return (
    <li className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 font-mono text-[11px] font-bold">set #{n}</span>
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground [font-variant-ligatures:none]">{opToSource(op)}</code>
      </div>
      <div className="grid gap-2 text-[11px] text-muted-foreground grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))]">
        <label htmlFor={`${id}-caller`} className="flex flex-col gap-0.5">
          Called from
          <select
            id={`${id}-caller`}
            className={inputClass}
            value={op.caller}
            onChange={(e) => {
              const caller = e.target.value;
              const isTop = caller === TOP_MODULE;
              onChange({ ...op, caller, cntxt: isTop ? null : caller, phase: isTop ? "pre_run_test" : op.phase === "pre_run_test" ? "build" : op.phase });
            }}
          >
            {SET_CALLERS.map((c) => (
              <option key={c} value={c}>
                {c === TOP_MODULE ? "tb_top (cntxt null)" : `${shortName(c)} (this)`}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-phase`} className="flex flex-col gap-0.5">
          When
          <select
            id={`${id}-phase`}
            className={inputClass}
            value={op.phase}
            disabled={op.caller === TOP_MODULE}
            onChange={(e) => onChange({ ...op, phase: e.target.value as CfgPhase })}
          >
            {op.caller === TOP_MODULE ? <option value="pre_run_test">{PHASE_LABELS.pre_run_test}</option> : null}
            <option value="build">{PHASE_LABELS.build}</option>
            <option value="run">{PHASE_LABELS.run}</option>
          </select>
        </label>
        <label htmlFor={`${id}-inst`} className="flex flex-col gap-0.5">
          inst_name
          <input id={`${id}-inst`} className={inputClass} value={op.instName} spellCheck={false} onChange={(e) => onChange({ ...op, instName: e.target.value })} />
        </label>
        <label htmlFor={`${id}-field`} className="flex flex-col gap-0.5">
          field_name
          <input id={`${id}-field`} className={inputClass} value={op.field} spellCheck={false} onChange={(e) => onChange({ ...op, field: e.target.value })} />
        </label>
        <label htmlFor={`${id}-type`} className="flex flex-col gap-0.5">
          type T
          <select id={`${id}-type`} className={inputClass} value={op.type} onChange={(e) => onChange({ ...op, type: e.target.value })}>
            {CONFIG_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-value`} className="flex flex-col gap-0.5">
          value
          <input id={`${id}-value`} className={inputClass} value={op.value} spellCheck={false} onChange={(e) => onChange({ ...op, value: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="mr-auto">
          scope <code className="font-mono text-foreground">&quot;{resolveScope(op.cntxt, op.instName)}&quot;</code>
        </span>
        <button type="button" className={smallButton} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move set #${n} earlier in the code`}>
          ↑
        </button>
        <button type="button" className={smallButton} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move set #${n} later in the code`}>
          ↓
        </button>
        <button type="button" className={smallButton} onClick={onRemove} aria-label={`Remove set #${n}`}>
          ✕
        </button>
      </div>
    </li>
  );
}

function GetRow({ op, onChange }: { op: CfgGetOp; onChange: (next: CfgGetOp) => void }) {
  const id = useId();
  return (
    <div className="space-y-2 rounded-lg border border-sky-500/50 bg-sky-500/[0.05] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-sky-500/20 px-1.5 font-mono text-[11px] font-bold">get</span>
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground [font-variant-ligatures:none]">{opToSource(op)}</code>
      </div>
      <div className="grid gap-2 text-[11px] text-muted-foreground grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))]">
        <label htmlFor={`${id}-caller`} className="flex flex-col gap-0.5">
          Called in (this)
          <select id={`${id}-caller`} className={inputClass} value={op.caller} onChange={(e) => onChange({ ...op, caller: e.target.value, cntxt: e.target.value })}>
            {STANDARD_CFG_TREE.paths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-phase`} className="flex flex-col gap-0.5">
          When
          <select id={`${id}-phase`} className={inputClass} value={op.phase} onChange={(e) => onChange({ ...op, phase: e.target.value as CfgPhase })}>
            <option value="build">{PHASE_LABELS.build}</option>
            <option value="run">{PHASE_LABELS.run}</option>
          </select>
        </label>
        <label htmlFor={`${id}-field`} className="flex flex-col gap-0.5">
          field_name
          <input id={`${id}-field`} className={inputClass} value={op.field} spellCheck={false} onChange={(e) => onChange({ ...op, field: e.target.value })} />
        </label>
        <label htmlFor={`${id}-type`} className="flex flex-col gap-0.5">
          type T
          <select id={`${id}-type`} className={inputClass} value={op.type} onChange={(e) => onChange({ ...op, type: e.target.value })}>
            {CONFIG_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Mark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("rounded border px-1 text-[10px] font-semibold", ok ? "border-emerald-500/60 text-emerald-800 dark:text-emerald-200" : "border-rose-500/60 text-rose-700 dark:text-rose-200")}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

function Resolution({ ops, run, getId }: { ops: CfgOp[]; run: ConfigRun; getId: string }) {
  const g = run.gets[getId];
  const sets = ops.filter((o): o is CfgSetOp => o.kind === "set");
  const label = (setId: string) => `set #${sets.findIndex((s) => s.id === setId) + 1}`;
  const rows = [...g.candidates].sort((a, b) => Number(b.fieldMatches) - Number(a.fieldMatches) || a.queuePos - b.queuePos);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Database at the moment of get(): lookup path <code className="font-mono normal-case tracking-normal">&quot;{g.lookupPath}&quot;</code>
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">The database is empty when get() runs.</p> : null}
      <ul className="space-y-1.5" aria-label="Database entries considered by get">
        {rows.map((c) => (
          <li
            key={c.resource.key}
            className={cn(
              "rounded-lg border p-2 text-xs",
              c.winner ? "border-emerald-500 bg-emerald-500/10" : c.eligible ? "border-amber-500/60 bg-amber-500/[0.06]" : "border-border/60 opacity-80",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-foreground">{c.resource.setIds.map(label).join(" + ")}</span>
              {c.winner ? <span className="font-bold text-emerald-800 dark:text-emerald-200">★ returned</span> : c.eligible ? <span className="font-semibold text-amber-800 dark:text-amber-200">matches, loses</span> : null}
              <span className="ml-auto font-mono text-[11px] [font-variant-ligatures:none]">
                precedence {c.resource.precedence} · queue position {c.queuePos + 1}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Mark ok={c.fieldMatches} label={`field '${c.resource.field}'`} />
              <Mark ok={c.typeMatches} label={`type ${c.resource.type}`} />
              <Mark ok={c.scopeMatches} label={`scope "${c.resource.scope}"`} />
              <span className="font-mono text-[11px] text-foreground [font-variant-ligatures:none]">= {c.resource.value}</span>
            </div>
          </li>
        ))}
      </ul>
      {g.laterSetIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">Not in the database yet (they run after this get): {g.laterSetIds.map(label).join(", ")}.</p>
      ) : null}
    </div>
  );
}

function ReachTree({ ops, getId }: { ops: CfgOp[]; getId: string }) {
  const reach = useMemo(() => reachAt(ops, getId), [ops, getId]);
  const g = ops.find((o) => o.id === getId) as CfgGetOp | undefined;
  const sets = ops.filter((o) => o.kind === "set");
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        What every component would read for &apos;{g?.field}&apos; ({g?.type}) at the same moment
      </p>
      <ul className="space-y-1 font-mono text-[12px] [font-variant-ligatures:none]" aria-label="Reach of the configuration in the hierarchy">
        {STANDARD_CFG_TREE.paths.map((p) => {
          const r = reach[p];
          const depth = depthOf(p) - 1;
          return (
            <li key={p} style={{ paddingLeft: `${depth * 14}px` }} className="flex flex-wrap items-center gap-2 border-l border-border/60 pl-2">
              <span className={cn("text-foreground", g?.caller === p && "font-bold")}>
                {g?.caller === p ? "▶ " : ""}
                {shortName(p)}
              </span>
              {r?.found ? (
                <span className="rounded border border-emerald-500/60 px-1 text-[10px] text-emerald-800 dark:text-emerald-200">
                  ✓ {r.value} (set #{sets.findIndex((s) => s.id === r.setId) + 1})
                </span>
              ) : (
                <span className="rounded border border-dashed border-slate-400/70 px-1 text-[10px] text-muted-foreground">— get returns 0</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Prediction-first explorer for uvm_config_db precedence, scope matching and exact type/field lookup. */
export default function ConfigDbExplorer() {
  const [presetId, setPresetId] = useState(CONFIG_PRESETS[0].id);
  const preset = CONFIG_PRESETS.find((p) => p.id === presetId) ?? CONFIG_PRESETS[0];
  const [ops, setOps] = useState<CfgOp[]>(() => cloneOps(CONFIG_PRESETS[0].ops));
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [nextId, setNextId] = useState(1);
  const onReveal = useCallback((k: string) => setRevealedKey(k), []);

  const getId = preset.getId;
  const run = useMemo(() => runConfigDb(ops), [ops]);
  const schedule = useMemo(() => scheduleConfigOps(ops), [ops]);
  const key = useMemo(() => JSON.stringify(ops), [ops]);
  const revealed = revealedKey === key;
  const g = run.gets[getId];
  const getOp = ops.find((o) => o.id === getId) as CfgGetOp;
  const setCalls = ops.filter((o): o is CfgSetOp => o.kind === "set");
  const variable = getOp.variable ?? getOp.field;

  const options: PredictionOption[] = useMemo(
    () =>
      getCandidates(ops, run, getId).map((v) => ({
        id: `v:${v}`,
        label:
          v === NO_VALUE ? (
            <span>
              get returns 0; <code className="font-mono">{variable}</code> keeps its old value
            </span>
          ) : (
            <span>
              returns 1, <code className="font-mono [font-variant-ligatures:none]">{`${variable} = ${v}`}</code>
            </span>
          ),
        correct: v === (g.found ? g.value : NO_VALUE),
        feedback: diagnoseGetCandidate(ops, run, getId, v),
      })),
    [ops, run, getId, g, variable],
  );

  const loadPreset = (id: string) => {
    const next = CONFIG_PRESETS.find((p) => p.id === id) ?? CONFIG_PRESETS[0];
    setPresetId(next.id);
    setOps(cloneOps(next.ops));
  };
  const replaceOp = (opId: string, next: CfgOp) => setOps((list) => list.map((o) => (o.id === opId ? next : o)));
  const moveSet = (opId: string, d: -1 | 1) =>
    setOps((list) => {
      const setIdx = list.map((o, i) => (o.kind === "set" ? i : -1)).filter((i) => i >= 0);
      const pos = setIdx.findIndex((i) => list[i].id === opId);
      const other = setIdx[pos + d];
      if (other === undefined) return list;
      const copy = [...list];
      [copy[setIdx[pos]], copy[other]] = [copy[other], copy[setIdx[pos]]];
      return copy;
    });
  const addSet = () => {
    const op: CfgSetOp = { kind: "set", id: `n${nextId}`, caller: "uvm_test_top", cntxt: "uvm_test_top", instName: "env.agt0", field: getOp.field, type: getOp.type, value: "7", phase: "build" };
    setNextId((n) => n + 1);
    setOps((list) => [...list.filter((o) => o.kind === "set"), op, ...list.filter((o) => o.kind === "get")]);
  };

  return (
    <VisualFrame
      label="uvm_config_db precedence and matching explorer"
      eyebrow="Experiment · config_db"
      title="Which value does get() return?"
      summary={
        <>
          Several <code className="font-mono">set()</code> calls compete for one <code className="font-mono">get()</code>. Predict the result, then see every
          database entry the lookup considered and why one wins.
        </>
      }
      fidelity="model"
      assumptions={CONFIG_DB_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl label="Scenario" options={CONFIG_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={loadPreset} />
      <p className="text-sm text-foreground">{preset.summary}</p>
      {debugHints[preset.id] ? <HintLadder hints={debugHints[preset.id]} resetKey={preset.id} /> : null}

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Calls (edit any field)</p>
          <ol className="space-y-2" aria-label="set() calls">
            {setCalls.map((op, i) => (
              <SetRow
                key={op.id}
                op={op}
                index={i}
                count={setCalls.length}
                onChange={(next) => replaceOp(op.id, next)}
                onMove={(d) => moveSet(op.id, d)}
                onRemove={() => setOps((list) => list.filter((o) => o.id !== op.id))}
              />
            ))}
          </ol>
          <button type="button" className={cn(smallButton, "h-9")} disabled={setCalls.length >= 5} onClick={addSet}>
            + Add set(){setCalls.length >= 5 ? " (limit 5)" : ""}
          </button>
          <GetRow op={getOp} onChange={(next) => replaceOp(getId, next)} />
        </div>
        <div className="min-w-0 space-y-3">
          <CodeTrace
            label="Generated code, in execution order"
            lines={configSource(ops).map((l) => ({ ...l, owner: l.text.startsWith("//") ? undefined : ("testbench" as const) }))}
            activeKey={revealed && g.winner ? g.winner.setId : undefined}
          />
          <ol className="space-y-1 text-xs" aria-label="Execution order">
            {schedule.map((s) => (
              <li key={s.op.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="font-semibold text-foreground">{s.order}.</span>
                <span>{s.op.kind === "set" ? `set #${setCalls.findIndex((o) => o.id === s.op.id) + 1}` : "get"}</span>
                <span>· {s.when}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <PredictionPrompt
        question={
          <>
            What does the <code className="font-mono">get()</code> in <code className="font-mono">{getOp.caller}</code> return?
          </>
        }
        options={options}
        resetKey={key}
      >
        <div className="space-y-3">
          <RevealSignal id={key} onReveal={onReveal} />
          <p aria-live="polite" className="text-sm text-foreground">
            <strong>{g.found ? `get returns 1: ${variable} = ${g.value}.` : `get returns 0: ${variable} is unchanged.`}</strong> {explainGet(ops, run, getId)}
          </p>
          <Resolution ops={ops} run={run} getId={getId} />
          <details className="rounded-lg border border-border/70 p-2 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Log with +UVM_CONFIG_DB_TRACE (abbreviated)</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11px] leading-5 text-slate-100 [font-variant-ligatures:none]">{run.trace.join("\n")}</pre>
          </details>
        </div>
      </PredictionPrompt>

      {revealed ? <ReachTree ops={ops} getId={getId} /> : null}
    </VisualFrame>
  );
}
