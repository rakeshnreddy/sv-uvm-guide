"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ancestry,
  castLines,
  castOutcome,
  dispatchCallLines,
  dispatchClassLines,
  findDeclaringClass,
  isSubclassOf,
  isVirtualFrom,
  resolveCall,
  TXN_HIERARCHY,
  withVirtualOrigin,
  type CallConfig,
  type CallResult,
  type CastConfig,
  type CastForm,
  type CastResult,
  type ClassTable,
} from "@/lib/sv-object-model";
import { cn } from "@/lib/utils";

export const DISPATCH_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §8.14 (a base-class handle sees only base-class members), §8.15 (super calls the version one level up), §8.20 (a virtual call binds to the object's class; once virtual, always virtual) and §8.16 with §6.24.2 ($cast).",
  "Single inheritance and argument-free methods. Default argument values in overrides are not modelled: §8.20 only requires the presence of a default to match, and the standard does not say which default a call through a base handle uses.",
  "Casting a handle variable that currently holds null is not modelled.",
];

const CLASSES = ["base_txn", "crc_txn", "bad_crc_txn"] as const;
type ClassName = (typeof CLASSES)[number];
type MethodName = "describe" | "print" | "corrupt";
type VirtualOrigin = "base_txn" | "none" | "crc_txn";

const toLines = (lines: { text: string; key?: string }[]): CodeTraceLine[] => lines.map((l) => ({ ...l, owner: "testbench" }));

function RevealSignal({ id, onReveal }: { id: string; onReveal: (id: string) => void }) {
  useEffect(() => {
    onReveal(id);
  }, [id, onReveal]);
  return null;
}

// ---------------------------------------------------------------------------
// Prediction options generated from the model, each with a diagnosis
// ---------------------------------------------------------------------------

function implementationOptions(table: ClassTable, config: CallConfig, result: CallResult): PredictionOption[] {
  const { handleType, objectType, method } = config;
  const correctId = result.kind === "ok" ? `impl:${result.implementation}` : "compile";
  const feedbackFor = (cls: string): string => {
    if (result.kind === "compile-error") {
      return result.stage === "assignment"
        ? `No body runs: h = ${objectType}::new() does not compile, because a ${handleType} handle cannot refer to a ${objectType} (§8.16).`
        : `No body runs: the compiler rejects h.${method}() because ${handleType} has no ${method}() (§8.14).`;
    }
    if (`impl:${cls}` === correctId) return result.why;
    const objectImpl = findDeclaringClass(table, objectType, method);
    if (cls === result.declaredIn && result.binding === "dynamic") {
      return `${cls} is the class the handle sees. Because ${method}() is virtual, the object's class decides at run time (§8.20).`;
    }
    if (cls === objectImpl && result.binding === "static") {
      return `That needs virtual dispatch. Seen from ${handleType}, ${method}() is not virtual, so the compiler binds it to ${result.declaredIn}::${method}() (§8.14).`;
    }
    if (!ancestry(table, objectType).includes(cls)) return `The object is a ${objectType}. ${cls}'s body is not part of that object, so it can never run here.`;
    return `${cls} is neither the class the handle sees (${result.declaredIn}) nor the object's latest override (${objectImpl}).`;
  };
  const options: PredictionOption[] = CLASSES.filter((c) => findDeclaringClass(table, c, method) === c).map((c) => ({
    id: `impl:${c}`,
    label: <code className="font-mono text-[13px] [font-variant-ligatures:none]">{`${c}::${method}()`}</code>,
    correct: `impl:${c}` === correctId,
    feedback: feedbackFor(c),
  }));
  options.push({
    id: "compile",
    label: "Compile error",
    correct: correctId === "compile",
    feedback:
      result.kind === "compile-error"
        ? result.reason
        : `The call compiles: ${method}() is declared in ${result.declaredIn}, which ${result.declaredIn === handleType ? "is" : "is an ancestor of"} the handle's class.`,
  });
  return options;
}

function printOptions(table: ClassTable, config: CallConfig, result: CallResult): PredictionOption[] {
  const chainOf = (cls: string) => {
    const r = resolveCall(table, { handleType: cls, objectType: cls, method: "print" });
    return r.kind === "ok" ? r.output : [];
  };
  const actual = result.kind === "ok" ? result.output.join(" / ") : "compile";
  const seen = new Set<string>();
  const options: PredictionOption[] = [];
  const add = (id: string, lines: string[], feedback: string) => {
    const key = lines.join(" / ");
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      id,
      label: <span className="font-mono text-[12.5px] [font-variant-ligatures:none]">{lines.join(" → ")}</span>,
      correct: key === actual,
      feedback: key === actual && result.kind === "ok" ? result.why : feedback,
    });
  };
  for (const c of CLASSES) {
    if (!isSubclassOf(table, config.objectType, c) && result.kind === "ok") continue;
    add(
      `chain:${c}`,
      chainOf(c),
      result.kind === "compile-error"
        ? `Nothing prints: the program does not compile. ${result.reason}`
        : `That is what print() prints when it binds to ${c}. print() is virtual, so it binds to the object's class (${config.objectType}), and every super.print() runs the level above first (§8.15, §8.20).`,
    );
  }
  const own = table.find((c) => c.name === config.objectType)?.methods.find((m) => m.name === "print");
  if (own) add("own", [own.output], "super.print() is an ordinary call to the parent's body, made before this class prints its own line, so the parent's lines come first (§8.15).");
  options.push({
    id: "compile",
    label: "Compile error",
    correct: result.kind === "compile-error",
    feedback: result.kind === "compile-error" ? result.reason : "print() is declared in base_txn, so every handle type in this hierarchy can call it.",
  });
  return options;
}

// ---------------------------------------------------------------------------
// Class hierarchy picture
// ---------------------------------------------------------------------------

function HierarchyCards({ table, config, result, revealed }: { table: ClassTable; config: CallConfig; result: CallResult; revealed: boolean }) {
  const visible = ancestry(table, config.handleType);
  const executed = revealed && result.kind === "ok" ? result.executed : [];
  return (
    <ol className="space-y-1" aria-label="Class hierarchy">
      {table.map((c, i) => {
        const isHandle = c.name === config.handleType;
        const isObject = c.name === config.objectType;
        const runs = executed.includes(c.name);
        const isBinding = revealed && result.kind === "ok" && result.implementation === c.name;
        return (
          <li key={c.name}>
            {i > 0 ? (
              <p className="ml-5 border-l border-border pl-3 font-mono text-[10px] leading-5 text-muted-foreground [font-variant-ligatures:none]">extends {c.extends}</p>
            ) : null}
            <div
              className={cn(
                "rounded-lg border p-2 transition-colors duration-200 motion-reduce:transition-none",
                isBinding ? "border-cyan-500 bg-cyan-500/10" : runs ? "border-cyan-500/50 bg-cyan-500/[0.05]" : "border-border/70 bg-background/60",
                !visible.includes(c.name) && "border-dashed",
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{c.name}</span>
                {isHandle ? <span className="rounded-full border border-amber-500/70 bg-amber-500/15 px-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">handle type</span> : null}
                {isObject ? <span className="rounded-sm border border-indigo-500/70 bg-indigo-500/15 px-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-100">object</span> : null}
                {isBinding ? <span className="rounded-sm bg-cyan-500/20 px-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-900 dark:text-cyan-100">▶ call binds here</span> : null}
                {!isBinding && runs ? <span className="text-[10px] font-semibold text-cyan-800 dark:text-cyan-200">▶ runs via super</span> : null}
                {!visible.includes(c.name) ? <span className="text-[10px] text-muted-foreground">(members hidden from h)</span> : null}
              </div>
              <ul className="mt-1 space-y-0.5 font-mono text-[11.5px] text-foreground [font-variant-ligatures:none]">
                {c.methods.map((m) => {
                  const inherited = !m.isVirtual && c.extends ? isVirtualFrom(table, c.extends, m.name) : false;
                  return (
                    <li key={m.name}>
                      {m.isVirtual ? <span className="text-violet-700 dark:text-violet-300">virtual </span> : null}
                      {m.name}()
                      {inherited ? <span className="text-muted-foreground"> · virtual (inherited)</span> : null}
                      {m.callsSuper ? <span className="text-muted-foreground"> · calls super.{m.name}()</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Dispatch explorer
// ---------------------------------------------------------------------------

function DispatchExplorer() {
  const [handleType, setHandleType] = useState<ClassName>("base_txn");
  const [objectType, setObjectType] = useState<ClassName>("bad_crc_txn");
  const [origin, setOrigin] = useState<VirtualOrigin>("base_txn");
  const [method, setMethod] = useState<MethodName>("describe");
  const [advanced, setAdvanced] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((id: string) => setRevealedKey(id), []);

  const table = useMemo(() => withVirtualOrigin(TXN_HIERARCHY, "describe", origin === "none" ? null : origin), [origin]);
  const config: CallConfig = { handleType, objectType, method };
  const configKey = `${handleType}|${objectType}|${origin}|${method}`;
  const result = useMemo(() => resolveCall(table, { handleType, objectType, method }), [table, handleType, objectType, method]);
  const options = useMemo(
    () => (method === "print" ? printOptions(table, { handleType, objectType, method }, result) : implementationOptions(table, { handleType, objectType, method }, result)),
    [table, handleType, objectType, method, result],
  );
  const revealed = revealedKey === configKey;

  const code = useMemo(() => toLines([...dispatchClassLines(table), ...dispatchCallLines({ handleType, objectType, method })]), [table, handleType, objectType, method]);
  const activeKey = !revealed ? undefined : result.kind === "ok" ? `cls:${result.implementation}:${method}` : result.stage === "assignment" ? "call:new" : "call:call";
  const contextKeys = revealed && result.kind === "ok" ? result.executed.flatMap((c) => [`cls:${c}:${method}`, `cls:${c}:${method}:super`, `cls:${c}:${method}:body`]) : [];

  const question =
    method === "print" ? (
      <>
        What does <code className="font-mono [font-variant-ligatures:none]">h.print()</code> display, in order?
      </>
    ) : (
      <>
        Which body runs for <code className="font-mono [font-variant-ligatures:none]">h.{method}()</code>?
      </>
    );

  return (
    <VisualFrame
      label="Polymorphism dispatch explorer"
      eyebrow="Experiment: which method runs?"
      title="Handle type, object type, and the virtual keyword"
      summary="Pick the handle's declared class, the class of the object it holds, and whether describe() is virtual. Predict which body runs, then reveal the rule."
      fidelity="model"
      assumptions={DISPATCH_MODEL_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Handle declared as</p>
          <SegmentedControl label="Handle type" mono options={CLASSES.map((c) => ({ value: c, label: c }))} value={handleType} onChange={setHandleType} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Object created with new</p>
          <SegmentedControl label="Object type" mono options={CLASSES.map((c) => ({ value: c, label: c }))} value={objectType} onChange={setObjectType} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <code className="font-mono normal-case tracking-normal [font-variant-ligatures:none]">describe()</code> is
          </p>
          <SegmentedControl
            label="Where describe() is first declared virtual"
            options={[
              { value: "base_txn" as const, label: "virtual in base_txn" },
              { value: "none" as const, label: "never virtual" },
              ...(advanced ? [{ value: "crc_txn" as const, label: "first virtual in crc_txn" }] : []),
            ]}
            value={origin}
            onChange={setOrigin}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Call</p>
          <SegmentedControl
            label="Method call"
            mono
            options={[
              { value: "describe" as const, label: "h.describe()" },
              { value: "print" as const, label: "h.print()" },
              { value: "corrupt" as const, label: "h.corrupt()" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </div>
      </div>
      <button
        type="button"
        aria-expanded={advanced}
        onClick={() => {
          if (advanced && origin === "crc_txn") setOrigin("base_txn");
          setAdvanced((a) => !a);
        }}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {advanced ? "Hide advanced" : "Show advanced: virtual added mid-hierarchy"}
      </button>

      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <HierarchyCards table={table} config={config} result={result} revealed={revealed} />
        <div className="min-w-0">
          <PredictionPrompt question={question} options={options} resetKey={configKey}>
            {() => (
              <div className="space-y-2 text-sm" aria-live="polite">
                <RevealSignal id={configKey} onReveal={onReveal} />
                {result.kind === "ok" ? (
                  <>
                    <p className="font-medium text-foreground">
                      <span aria-hidden>▶ </span>
                      The call binds to <code className="font-mono [font-variant-ligatures:none]">{`${result.implementation}::${method}()`}</code>{" "}
                      <span className={cn("ml-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", result.binding === "dynamic" ? "bg-violet-500/15 text-violet-800 dark:text-violet-200" : "bg-slate-500/15 text-slate-800 dark:text-slate-200")}>
                        {result.binding === "dynamic" ? "dynamic: object's class" : "static: handle's class"}
                      </span>
                    </p>
                    <div className="rounded-lg bg-slate-950/90 p-2 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Output">
                      {result.output.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">Rule ({result.rule}): </strong>
                      {result.why}
                    </p>
                  </>
                ) : (
                  <p className="text-rose-800 dark:text-rose-200">
                    <strong>✕ Compile error ({result.rule}). </strong>
                    {result.reason}
                  </p>
                )}
              </div>
            )}
          </PredictionPrompt>
        </div>
      </div>
      <CodeTrace label="Generated code" lines={code} activeKey={activeKey} contextKeys={contextKeys} />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// $cast explorer
// ---------------------------------------------------------------------------

const CAST_CHOICES = [
  { id: "assigned", label: "dst now refers to the object" },
  { id: "returns0", label: "No assignment; $cast returns 0 and the test continues" },
  { id: "runtime", label: "No assignment; run-time error" },
  { id: "compile", label: "Compile error" },
] as const;

function castCorrectId(r: CastResult) {
  if (!r.compiles) return "compile";
  if (r.assigned) return "assigned";
  if (r.runtimeError) return "runtime";
  return "returns0";
}

function castFeedback(id: string, cfg: CastConfig, r: CastResult): string {
  if (id === castCorrectId(r)) return r.why;
  const fits = r.assigned || (r.compiles && !r.runtimeError && r.returns === 1);
  switch (id) {
    case "assigned":
      return cfg.form === "assign"
        ? "The compiler never looks at the object. A superclass handle cannot be assigned directly to a subclass variable (§8.16)."
        : `The run-time check fails: a ${cfg.objectType} object is not a ${cfg.dstType}.`;
    case "returns0":
      if (cfg.form === "assign") return "Plain assignment has no return value; the compiler decides legality before the test runs.";
      if (cfg.form === "task") return "That is the function form. Called as a task there is no return value to test, so a failed cast is a run-time error (§6.24.2).";
      return fits ? "The object passes the check, so the assignment happens and $cast returns 1." : r.why;
    case "runtime":
      if (cfg.form === "function") return "Called as a function, $cast never reports an error: it returns 0 and leaves dst unchanged (§6.24.2).";
      if (cfg.form === "assign") return "Plain assignment is checked at compile time, not run time.";
      return "The object passes the check, so the task form assigns without error.";
    default:
      return cfg.form === "assign" ? "Assigning a subclass handle to a superclass variable is always legal (§8.16)." : "$cast is checked at run time; the compiler does not reject it (§6.24.2).";
  }
}

function CastExplorer() {
  const [srcType, setSrcType] = useState<ClassName>("base_txn");
  const [objectType, setObjectType] = useState<ClassName>("crc_txn");
  const [dstType, setDstType] = useState<ClassName>("bad_crc_txn");
  const [form, setForm] = useState<CastForm>("function");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((id: string) => setRevealedKey(id), []);

  const cfg: CastConfig = { srcType, objectType, dstType, form };
  const key = `${srcType}|${objectType}|${dstType}|${form}`;
  const result = useMemo(() => castOutcome(TXN_HIERARCHY, { srcType, objectType, dstType, form }), [srcType, objectType, dstType, form]);
  const revealed = revealedKey === key;
  const options: PredictionOption[] = CAST_CHOICES.map((c) => ({ id: c.id, label: c.label, correct: c.id === castCorrectId(result), feedback: castFeedback(c.id, cfg, result) }));
  const code = toLines(castLines(cfg));
  const directionLabel = { same: "same class", up: "upcast: subclass → superclass", down: "downcast: superclass → subclass", unrelated: "unrelated classes" }[result.direction];

  const changeSrc = (next: ClassName) => {
    setSrcType(next);
    if (!isSubclassOf(TXN_HIERARCHY, objectType, next)) setObjectType(next);
  };

  return (
    <VisualFrame
      label="Cast explorer"
      eyebrow="Experiment: $cast"
      title="Upcasts are implicit; downcasts need $cast"
      summary="src is declared as one class and holds an object of that class or a subclass. Choose the destination type and how you assign it, then predict."
      fidelity="model"
      assumptions={DISPATCH_MODEL_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">src declared as</p>
          <SegmentedControl label="Source handle type" mono options={CLASSES.map((c) => ({ value: c, label: c }))} value={srcType} onChange={changeSrc} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">src holds an object of</p>
          <SegmentedControl
            label="Object type"
            mono
            options={CLASSES.map((c) => ({ value: c, label: c, disabled: !isSubclassOf(TXN_HIERARCHY, c, srcType) }))}
            value={objectType}
            onChange={setObjectType}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">dst declared as</p>
          <SegmentedControl label="Destination type" mono options={CLASSES.map((c) => ({ value: c, label: c }))} value={dstType} onChange={setDstType} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assign with</p>
          <SegmentedControl
            label="Assignment form"
            mono
            options={[
              { value: "function" as const, label: "if ($cast(dst, src))" },
              { value: "task" as const, label: "$cast(dst, src);" },
              { value: "assign" as const, label: "dst = src;" },
            ]}
            value={form}
            onChange={setForm}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Direction: <strong className="text-foreground">{directionLabel}</strong>. Object classes that a {srcType} variable cannot hold are disabled.
      </p>
      <PredictionPrompt question="What happens?" options={options} resetKey={key}>
          {() => (
            <div className="space-y-2 text-sm" aria-live="polite">
              <RevealSignal id={key} onReveal={onReveal} />
              <p className="font-medium text-foreground">
                {!result.compiles
                  ? "✕ Compile error."
                  : result.assigned
                    ? `✓ dst → ${objectType} object${form === "function" ? " ($cast returned 1)" : ""}.`
                    : result.runtimeError
                      ? "✕ Run-time error; dst stays null."
                      : "$cast returned 0; dst stays null and the test continues."}
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Rule ({result.rule}): </strong>
                {result.why}
              </p>
            </div>
          )}
      </PredictionPrompt>
      <CodeTrace
        label="Generated code"
        lines={code}
        activeKey={revealed ? "cast:op" : undefined}
        contextKeys={revealed && form === "function" ? [result.assigned ? "cast:ok" : "cast:fail"] : []}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------

interface PolymorphismDispatchVisualizerProps {
  /** Which explorer to show; both by default. */
  section?: "all" | "dispatch" | "cast";
}

/**
 * Model-driven explorer for method dispatch (static vs virtual, super chains,
 * hidden subclass members) and $cast, over base_txn → crc_txn → bad_crc_txn.
 */
export default function PolymorphismDispatchVisualizer({ section = "all" }: PolymorphismDispatchVisualizerProps) {
  return (
    <>
      {section !== "cast" ? <DispatchExplorer /> : null}
      {section !== "dispatch" ? <CastExplorer /> : null}
    </>
  );
}
