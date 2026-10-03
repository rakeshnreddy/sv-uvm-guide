"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  FACTORY_CLASSES,
  OUTCOME_FATAL,
  OUTCOME_NOT_BUILT,
  PLACEMENT_LABELS,
  builderSource,
  candidateOutcomes,
  classDeclarations,
  diagnoseCandidate,
  explainNode,
  factoryPrintout,
  fullInstPath,
  lookupLog,
  nodeResult,
  outcomeOf,
  overrideToSource,
  runFactoryProgram,
  standardTree,
  testSource,
  type FactoryMessage,
  type FactoryProgram,
  type FactoryRun,
  type NodeResult,
  type PlacedOverride,
  type Placement,
  type SourceLine,
} from "@/lib/uvm-factory-model";
import { cn } from "@/lib/utils";

export const FACTORY_MODEL_ASSUMPTIONS = [
  "Implements uvm_default_factory from uvm-core 2020.3.1: instance overrides are checked before type overrides, in registration order, first match wins (IEEE 1800.2-2020 §8.3.1.4.1, §8.3.1.7.1).",
  "One type override per original type: replace=1 (default) replaces it, replace=0 keeps the old one (§8.3.1.4.2). Overrides chain: the lookup repeats for the new type.",
  "type_id::create $casts the result; a type that does not extend the requested class is UVM_FATAL FCTTYP, which ends the run (uvm_registry_common::create).",
  "Paths match as globs only when they contain * or ?; otherwise they must be equal. Build is top-down, depth-first.",
  "Not modelled: *_by_name overrides, aliases, /regex/ paths.",
];

const DRV0 = "uvm_test_top.env.agt0.drv";
const DRV1 = "uvm_test_top.env.agt1.drv";
const ROOT = "uvm_test_top";

const ORIGINALS = ["base_driver", "mock_driver", "my_monitor", "my_env"];
const OVERRIDES = ["mock_driver", "err_driver", "quiet_driver", "cov_monitor", "my_monitor", "dbg_env", "base_driver"];

type OvInput = Omit<PlacedOverride, "id">;

const typeOv = (original: string, override: string, placement: Placement = "test-build-before", replace = true): OvInput =>
  ({ kind: "type", original, override, replace, placement }) as OvInput;
const instOv = (original: string, override: string, pathArg: string, withThis = true, placement: Placement = "test-build-before"): OvInput =>
  ({ kind: "inst", original, override, pathArg, parentPath: withThis ? ROOT : null, placement }) as OvInput;

interface ExplorerPreset {
  id: string;
  label: string;
  summary: string;
  overrides: OvInput[];
  construct: "create" | "new";
  target: string;
  debug?: { hints: string[]; fixLabel: string; fix: OvInput[]; fixConstruct?: "create" | "new" };
}

const PRESETS: ExplorerPreset[] = [
  {
    id: "free",
    label: "Free play",
    summary: "One type override. Add, reorder and move overrides, then predict what each create() builds.",
    overrides: [typeOv("base_driver", "mock_driver")],
    construct: "create",
    target: DRV0,
  },
  {
    id: "two-inst",
    label: "Two instance overrides",
    summary: "A general instance override and a specific one both match agt0.drv. Reorder them and predict again.",
    overrides: [instOv("base_driver", "mock_driver", "uvm_test_top.env.*", false), instOv("base_driver", "err_driver", "env.agt0.drv")],
    construct: "create",
    target: DRV0,
  },
  {
    id: "too-late",
    label: "Debug: override ignored",
    summary: "The test overrides the driver, but every driver is still a base_driver. Why?",
    overrides: [typeOv("base_driver", "mock_driver", "test-connect")],
    construct: "create",
    target: DRV0,
    debug: {
      hints: [
        "An override only affects create() calls made after it is registered.",
        "When are the drivers created? Build runs top-down: test, env, agents, then drivers.",
        "connect_phase starts after the whole build_phase has finished.",
      ],
      fixLabel: "Move the override into build_phase, before env is created",
      fix: [typeOv("base_driver", "mock_driver", "test-build-before")],
    },
  },
  {
    id: "new",
    label: "Debug: new() in the agent",
    summary: "The type override is registered early, yet the drivers are base_driver. Look at how my_agent builds them.",
    overrides: [typeOv("base_driver", "mock_driver")],
    construct: "new",
    target: DRV0,
    debug: {
      hints: ["The override is registered in time. Is the factory ever asked?", "Read my_agent::build_phase line by line.", "new() calls the constructor directly; only type_id::create consults the factory."],
      fixLabel: "Build drv with base_driver::type_id::create",
      fix: [typeOv("base_driver", "mock_driver")],
      fixConstruct: "create",
    },
  },
  {
    id: "typo",
    label: "Debug: path typo",
    summary: "An instance override should make agt0's driver a mock_driver. Nothing changes and no error appears.",
    overrides: [instOv("base_driver", "mock_driver", "env.agent0.drv")],
    construct: "create",
    target: DRV0,
    debug: {
      hints: [
        "Open the create() log: which path does the factory compare against?",
        "With this as the parent, the registered path is uvm_test_top + '.' + your string.",
        "Compare the instance names character by character (and remember: without this, the string is taken as an absolute path).",
      ],
      fixLabel: 'Use the real instance name: "env.agt0.drv"',
      fix: [instOv("base_driver", "mock_driver", "env.agt0.drv")],
    },
  },
  {
    id: "incompatible",
    label: "Debug: FCTTYP fatal",
    summary: "The run dies during build with UVM_FATAL [FCTTYP]. Find the override that caused it.",
    overrides: [typeOv("base_driver", "my_monitor")],
    construct: "create",
    target: DRV0,
    debug: {
      hints: [
        "The factory itself never checks compatibility. Who does?",
        "base_driver::type_id::create ends with $cast(create, obj).",
        "An override type must extend the original type.",
      ],
      fixLabel: "Override base_driver with a class that extends it (mock_driver)",
      fix: [typeOv("base_driver", "mock_driver")],
    },
  },
];

let idCounter = 0;
const withIds = (list: OvInput[]): PlacedOverride[] =>
  list.map((o) => {
    idCounter += 1;
    return { ...o, id: `ov${idCounter}` } as PlacedOverride;
  });

const outcomeLabel = (o: string) => (o === OUTCOME_FATAL ? "UVM_FATAL [FCTTYP], the run stops" : o === OUTCOME_NOT_BUILT ? "Never created" : o);

// ---------------------------------------------------------------------------
// Shared view pieces (also used by FactoryOverrideVisualizer)
// ---------------------------------------------------------------------------

/** Renders children only after PredictionPrompt reveals; tells the parent which config was revealed. */
export function RevealSignal({ id, onReveal }: { id: string; onReveal: (id: string) => void }) {
  useEffect(() => {
    onReveal(id);
  }, [id, onReveal]);
  return null;
}

export function toCodeLines(lines: SourceLine[]): CodeTraceLine[] {
  return lines.map((l) => ({ ...l, owner: "testbench" as const }));
}

const severityStyle: Record<FactoryMessage["severity"], string> = {
  INFO: "border-slate-400/60 text-slate-700 dark:text-slate-200",
  WARNING: "border-amber-500/70 text-amber-800 dark:text-amber-200",
  ERROR: "border-rose-500/70 text-rose-700 dark:text-rose-200",
  FATAL: "border-rose-600 bg-rose-500/15 text-rose-800 dark:text-rose-100",
};

export function FactoryMessages({ messages }: { messages: FactoryMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="space-y-1" aria-label="UVM messages">
      {messages.map((m, i) => (
        <li key={`${m.id}-${i}`} className={cn("rounded-md border px-2 py-1 font-mono text-[11.5px] [font-variant-ligatures:none]", severityStyle[m.severity])}>
          <span className="font-bold">
            {m.severity === "FATAL" || m.severity === "ERROR" ? "✕ " : m.severity === "WARNING" ? "⚠ " : "ℹ "}UVM_{m.severity} [{m.id}]
          </span>{" "}
          {m.text}
        </li>
      ))}
    </ul>
  );
}

export function LookupLog({ program, node }: { program: FactoryProgram; node: NodeResult }) {
  return (
    <pre
      aria-label={`create() log for ${node.path}`}
      className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11.5px] leading-5 text-slate-100 [font-variant-ligatures:none]"
    >
      {lookupLog(program, node).join("\n")}
    </pre>
  );
}

function badgeFor(program: FactoryProgram, node: NodeResult): { text: string; className: string } {
  if (node.status === "not-built") return { text: "— not built", className: "border-dashed border-slate-400/70 text-muted-foreground" };
  if (node.status === "fatal") return { text: "✕ FCTTYP", className: "border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-100" };
  if (node.construct === "new") return { text: "new() · factory bypassed", className: "border-amber-500/70 bg-amber-500/10 text-amber-900 dark:text-amber-100" };
  const hops = node.lookup?.hops.filter((h) => h.chosen && h.chosen.override !== h.requested) ?? [];
  if (hops.length === 0) return { text: "= no override", className: "border-slate-400/60 text-muted-foreground" };
  const label = (callId?: string) => `#${program.overrides.findIndex((o) => o.id === callId) + 1}`;
  if (hops.length > 1) return { text: `⛓ chain ${hops.map((h) => label(h.chosen?.callId)).join("→")}`, className: "border-violet-500/70 bg-violet-500/10 text-violet-900 dark:text-violet-100" };
  const h = hops[0];
  return h.via === "inst"
    ? { text: `◎ INST ${label(h.chosen?.callId)}`, className: "border-cyan-500/70 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100" }
    : { text: `▣ TYPE ${label(h.chosen?.callId)}`, className: "border-indigo-500/70 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100" };
}

/** Component hierarchy with requested types; resolved types and badges appear once revealed. */
export function FactoryTree({
  program,
  run,
  revealed,
  target,
  onSelect,
}: {
  program: FactoryProgram;
  run: FactoryRun;
  revealed: boolean;
  target: string;
  onSelect?: (path: string) => void;
}) {
  const rows = run.nodes;
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Component hierarchy {revealed ? "· built types" : "· requested types (predict first)"}
      </p>
      <ul className="space-y-1 font-mono text-[12px] [font-variant-ligatures:none]" aria-label="Component hierarchy">
        <li className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="text-foreground">{ROOT}</span> : {program.root.requested} <span className="text-[11px]">(run_test)</span>
        </li>
        {rows.map((node) => {
          const depth = node.path.split(".").length - 1;
          const selected = node.path === target;
          const badge = badgeFor(program, node);
          const outcome = outcomeOf(node);
          const body = (
            <>
              <span className="text-foreground">{node.name}</span>
              <span className="text-muted-foreground">: {node.requested}</span>
              {revealed ? (
                <>
                  {outcome !== OUTCOME_NOT_BUILT && outcome !== node.requested ? (
                    <span className="font-semibold text-foreground">→ {outcome === OUTCOME_FATAL ? node.built : outcome}</span>
                  ) : null}
                  <span className={cn("rounded border px-1.5 text-[10px] font-semibold", badge.className)}>{badge.text}</span>
                </>
              ) : (
                <span className="text-muted-foreground" aria-label="hidden until you predict">
                  → ?
                </span>
              )}
            </>
          );
          return (
            <li key={node.path} style={{ paddingLeft: `${depth * 14}px` }} className="border-l border-border/60">
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${node.path}, requested ${node.requested}${revealed ? `, built ${outcomeLabel(outcome)}` : ""}${selected ? ", prediction target" : ""}`}
                  onClick={() => onSelect(node.path)}
                  className={cn(
                    "ml-1 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    selected ? "border-amber-500 bg-amber-500/10" : "border-transparent hover:bg-muted",
                  )}
                >
                  {selected ? <span aria-hidden>▶</span> : null}
                  {body}
                </button>
              ) : (
                <div className={cn("ml-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1", selected ? "border-amber-500 bg-amber-500/10" : "border-transparent")}>
                  {selected ? <span aria-hidden>▶</span> : null}
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function factoryOptions(program: FactoryProgram, run: FactoryRun, target: string): PredictionOption[] {
  const node = nodeResult(run, target);
  if (!node) return [];
  const actual = outcomeOf(node);
  return candidateOutcomes(program, run, target).map((c) => ({
    id: c,
    label: c === OUTCOME_FATAL || c === OUTCOME_NOT_BUILT ? outcomeLabel(c) : <code className="font-mono text-[13px] [font-variant-ligatures:none]">{c}</code>,
    correct: c === actual,
    feedback: diagnoseCandidate(program, run, target, c),
  }));
}

// ---------------------------------------------------------------------------
// Explorer
// ---------------------------------------------------------------------------

const selectClass =
  "h-9 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const smallButton =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 px-2 text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

function AddOverrideForm({ onAdd, disabled }: { onAdd: (o: OvInput) => void; disabled: boolean }) {
  const id = useId();
  const [kind, setKind] = useState<"type" | "inst">("inst");
  const [original, setOriginal] = useState("base_driver");
  const [override, setOverride] = useState("err_driver");
  const [pathArg, setPathArg] = useState("env.agt1.drv");
  const [withThis, setWithThis] = useState(true);
  const [replace, setReplace] = useState(true);
  const [placement, setPlacement] = useState<Placement>("test-build-before");
  return (
    <details className="rounded-lg border border-border/70 bg-background/40 p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Add an override</summary>
      <div className="mt-3 space-y-3 text-xs">
        <SegmentedControl
          label="Override kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "type", label: "Type override" },
            { value: "inst", label: "Instance override" },
          ]}
        />
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]">
          <label htmlFor={`${id}-orig`} className="flex flex-col gap-1 text-muted-foreground">
            Original type
            <select id={`${id}-orig`} className={selectClass} value={original} onChange={(e) => setOriginal(e.target.value)}>
              {ORIGINALS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-ovrd`} className="flex flex-col gap-1 text-muted-foreground">
            Override type
            <select id={`${id}-ovrd`} className={selectClass} value={override} onChange={(e) => setOverride(e.target.value)}>
              {OVERRIDES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-place`} className="flex flex-col gap-1 text-muted-foreground">
            Registered in
            <select id={`${id}-place`} className={selectClass} value={placement} onChange={(e) => setPlacement(e.target.value as Placement)}>
              {(Object.keys(PLACEMENT_LABELS) as Placement[]).map((p) => (
                <option key={p} value={p}>
                  {PLACEMENT_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {kind === "inst" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor={`${id}-path`} className="flex min-w-0 flex-1 flex-col gap-1 text-muted-foreground">
              inst_path (glob: * any characters, ? one character)
              <input id={`${id}-path`} className={cn(selectClass, "w-full")} value={pathArg} onChange={(e) => setPathArg(e.target.value)} spellCheck={false} />
            </label>
            <label className="flex min-h-9 items-center gap-2 text-foreground">
              <input type="checkbox" checked={withThis} onChange={(e) => setWithThis(e.target.checked)} />
              pass <code className="font-mono">this</code> as parent
            </label>
          </div>
        ) : (
          <label className="flex min-h-9 items-center gap-2 text-foreground">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            replace = {replace ? "1 (default)" : "0"}
          </label>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(kind === "type" ? typeOv(original, override, placement, replace) : instOv(original, override, pathArg, withThis, placement))}
          className="inline-flex h-9 items-center rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Add override{disabled ? " (limit 6)" : ""}
        </button>
      </div>
    </details>
  );
}

function OverrideList({
  overrides,
  effects,
  onMove,
  onRemove,
  onPlacement,
  onToggleReplace,
}: {
  overrides: PlacedOverride[];
  effects: FactoryRun["effects"];
  onMove: (i: number, d: -1 | 1) => void;
  onRemove: (i: number) => void;
  onPlacement: (i: number, p: Placement) => void;
  onToggleReplace: (i: number) => void;
}) {
  const id = useId();
  if (overrides.length === 0) return <p className="text-sm text-muted-foreground">No overrides registered. Every create() builds the requested type.</p>;
  return (
    <ol className="space-y-2" aria-label="Override calls in code order">
      {overrides.map((o, i) => {
        const effect = effects[o.id];
        return (
          <li key={o.id} className="rounded-lg border border-border/70 bg-background/60 p-2">
            <div className="flex flex-wrap items-start gap-2">
              <span className="rounded bg-muted px-1.5 font-mono text-[11px] font-bold">#{i + 1}</span>
              <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-foreground [font-variant-ligatures:none]">{overrideToSource(o)}</code>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {o.kind === "inst" ? (
                <span>
                  full path <code className="font-mono text-foreground">&quot;{fullInstPath(o)}&quot;</code>
                </span>
              ) : (
                <button type="button" className={smallButton} onClick={() => onToggleReplace(i)} aria-label={`Toggle replace for override #${i + 1}`}>
                  replace={o.replace ? "1" : "0"}
                </button>
              )}
              {effect && effect !== "added" ? <span className="font-semibold text-amber-700 dark:text-amber-300">⚠ {effect.replace("-", " ")}</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <label htmlFor={`${id}-p${i}`} className="sr-only">
                Where override #{i + 1} is registered
              </label>
              <select id={`${id}-p${i}`} className={cn(selectClass, "h-8 max-w-full flex-1 font-sans")} value={o.placement} onChange={(e) => onPlacement(i, e.target.value as Placement)}>
                {(Object.keys(PLACEMENT_LABELS) as Placement[]).map((p) => (
                  <option key={p} value={p}>
                    {PLACEMENT_LABELS[p]}
                  </option>
                ))}
              </select>
              <button type="button" className={smallButton} disabled={i === 0} onClick={() => onMove(i, -1)} aria-label={`Move override #${i + 1} earlier`}>
                ↑
              </button>
              <button type="button" className={smallButton} disabled={i === overrides.length - 1} onClick={() => onMove(i, 1)} aria-label={`Move override #${i + 1} later`}>
                ↓
              </button>
              <button type="button" className={smallButton} onClick={() => onRemove(i)} aria-label={`Remove override #${i + 1}`}>
                ✕
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FactoryOverrideExplorerVisualizer() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const [overrides, setOverrides] = useState<PlacedOverride[]>(() => withIds(PRESETS[0].overrides));
  const [construct, setConstruct] = useState<"create" | "new">(PRESETS[0].construct);
  const [target, setTarget] = useState(PRESETS[0].target);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((k: string) => setRevealedKey(k), []);

  const loadPreset = (id: string) => {
    const next = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
    setPresetId(next.id);
    setOverrides(withIds(next.overrides));
    setConstruct(next.construct);
    setTarget(next.target);
  };

  const program: FactoryProgram = useMemo(() => ({ classes: FACTORY_CLASSES, root: standardTree({ driverConstruct: construct }), overrides }), [overrides, construct]);
  const run = useMemo(() => runFactoryProgram(program), [program]);
  const configKey = useMemo(() => JSON.stringify([overrides.map((o) => `${overrideToSource(o)}@${o.placement}`), construct, target]), [overrides, construct, target]);
  const revealed = revealedKey === configKey;
  const node = nodeResult(run, target);
  const options = useMemo(() => factoryOptions(program, run, target), [program, run, target]);

  const decidingCall = revealed ? node?.lookup?.hops.find((h) => h.chosen)?.chosen?.callId : undefined;
  const env = program.root.children?.[0];
  const agentChildren = env?.children?.[0]?.children ?? [];
  const involved = Array.from(new Set(overrides.flatMap((o) => [o.original, o.override])));

  const update = (fn: (list: PlacedOverride[]) => PlacedOverride[]) => setOverrides((list) => fn([...list]));

  return (
    <VisualFrame
      label="UVM factory override explorer"
      eyebrow="Experiment · factory"
      title="Factory Override Explorer"
      summary={
        <>
          Register overrides in the test, then predict what each <code className="font-mono">type_id::create</code> builds. The model replays the build
          top-down and asks the factory exactly when each create() runs.
        </>
      }
      fidelity="model"
      assumptions={FACTORY_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl label="Scenario" options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={loadPreset} />
      <div className="space-y-2 text-sm">
        <p className="text-foreground">{preset.summary}</p>
        {preset.debug ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/[0.05] p-3">
            <HintLadder hints={preset.debug.hints} resetKey={preset.id} className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => {
                setOverrides(withIds(preset.debug?.fix ?? []));
                if (preset.debug?.fixConstruct) setConstruct(preset.debug.fixConstruct);
              }}
              className="inline-flex min-h-9 items-center rounded-lg border border-emerald-600/60 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-emerald-200"
            >
              Apply the fix: {preset.debug.fixLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Override calls, in code order</p>
          <OverrideList
            overrides={overrides}
            effects={run.effects}
            onMove={(i, d) =>
              update((list) => {
                const j = i + d;
                [list[i], list[j]] = [list[j], list[i]];
                return list;
              })
            }
            onRemove={(i) => update((list) => list.filter((_, k) => k !== i))}
            onPlacement={(i, p) => update((list) => list.map((o, k) => (k === i ? { ...o, placement: p } : o)))}
            onToggleReplace={(i) => update((list) => list.map((o, k) => (k === i && o.kind === "type" ? { ...o, replace: !o.replace } : o)))}
          />
          <AddOverrideForm disabled={overrides.length >= 6} onAdd={(o) => update((list) => [...list, ...withIds([o])])} />
          <label className="flex min-h-9 items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={construct === "new"} onChange={(e) => setConstruct(e.target.checked ? "new" : "create")} />
            my_agent builds <code className="font-mono">drv</code> with <code className="font-mono">new()</code>
          </label>
        </div>
        <div className="min-w-0 space-y-3">
          <CodeTrace label="my_test (generated from the override list)" lines={toCodeLines(testSource(program))} activeKey={decidingCall} />
          <CodeTrace label="my_agent (shared by agt0 and agt1)" lines={toCodeLines(builderSource("my_agent", agentChildren))} activeKey={revealed && target.endsWith(".drv") ? "create-drv" : undefined} />
          {involved.length > 0 ? <CodeTrace label="Classes involved" lines={toCodeLines(classDeclarations(FACTORY_CLASSES, involved))} /> : null}
        </div>
      </div>

      <FactoryTree program={program} run={run} revealed={revealed} target={target} onSelect={setTarget} />
      <p className="text-xs text-muted-foreground">Select any component to make it the prediction target. Overrides, order and timing all change the answer.</p>

      <PredictionPrompt
        question={
          <>
            Which class does create() build for <code className="font-mono text-[13px] [font-variant-ligatures:none]">{target}</code>?
          </>
        }
        options={options}
        resetKey={configKey}
      >
        {node ? (
          <div className="space-y-3">
            <RevealSignal id={configKey} onReveal={onReveal} />
            <p aria-live="polite" className="text-sm text-foreground">
              <strong>Result: {outcomeLabel(outcomeOf(node))}.</strong> {explainNode(program, run, target)}
            </p>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">What the factory checks, in order</p>
              <LookupLog program={program} node={node} />
            </div>
            <FactoryMessages messages={run.messages} />
            <details className="rounded-lg border border-border/70 p-2 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">uvm_factory::get().print() after the build</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                {factoryPrintout(run.state).join("\n")}
              </pre>
            </details>
          </div>
        ) : null}
      </PredictionPrompt>
      <p className="text-xs text-muted-foreground">
        Try: in “Two instance overrides”, move #2 above #1. Then select <code className="font-mono">{DRV1}</code> and predict again.
      </p>
    </VisualFrame>
  );
}

export default FactoryOverrideExplorerVisualizer;
