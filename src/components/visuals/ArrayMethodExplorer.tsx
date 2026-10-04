"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ARRAY_METHODS,
  createMethodArray,
  evaluateMethod,
  formatMethodResult,
  methodArrayDeclaration,
  methodDataPreset,
  predictMethod,
  WITH_CLAUSES,
  withChoicesFor,
  type ArrayMethodName,
  type MethodArray,
  type MethodArrayKind,
  type MethodElemTypeId,
  type MethodFamily,
  type WithClauseId,
} from "@/lib/sv-array-methods-model";
import { SV_ELEM_TYPES, wrapToWidth } from "@/lib/systemverilog-array-model";
import { cn } from "@/lib/utils";

const FAMILY_METHODS: Record<MethodFamily, ArrayMethodName[]> = {
  locator: ["find", "find_index", "find_first", "find_first_index", "find_last", "find_last_index", "min", "max", "unique", "unique_index"],
  ordering: ["sort", "rsort", "reverse", "shuffle"],
  reduction: ["sum", "product", "and", "or", "xor"],
};

const familyOptions = [
  { value: "locator" as const, label: "Locate (returns a queue)" },
  { value: "ordering" as const, label: "Reorder (void, in place)" },
  { value: "reduction" as const, label: "Reduce (one value)" },
];

const ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §7.12.1 (locator), §7.12.2 (ordering) and §7.12.3 (reduction) methods, including return types and result widths.",
  "Where the LRM leaves something unspecified (unique() order, which tied element min/max returns, sort stability, shuffle randomness) the model makes a fixed choice and says so.",
  "Integer elements only; struct elements and iterator/index arguments are not modelled.",
];

function DataStrip({ array, highlight, label }: { array: MethodArray; highlight: number[]; label: string }) {
  return (
    <div role="group" aria-label={`${label}: ${array.values.map((v, i) => `${array.kind === "assoc" ? `"${array.keys[i]}"` : `[${i}]`} ${v}`).join(", ")}`} className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {array.values.map((v, i) => (
        <span key={i} className={cn("rounded-md", highlight.includes(i) && "outline outline-2 outline-offset-1 outline-cyan-500")}>
          <ValueChip name={array.kind === "assoc" ? `"${array.keys[i]}"` : `[${i}]`} value={v} />
          {highlight.includes(i) ? <span className="sr-only"> (selected by the method)</span> : null}
        </span>
      ))}
    </div>
  );
}

export default function ArrayMethodExplorer() {
  const [kind, setKind] = useState<MethodArrayKind>("queue");
  const [elemType, setElemType] = useState<MethodElemTypeId>("bit8");
  const [values, setValues] = useState<number[]>(methodDataPreset("bit8"));
  const [family, setFamily] = useState<MethodFamily>("reduction");
  const [method, setMethod] = useState<ArrayMethodName>("sum");
  const [withId, setWithId] = useState<WithClauseId>("none");
  const [seed, setSeed] = useState(1);
  const [draft, setDraft] = useState(values.join(", "));
  const [draftError, setDraftError] = useState<string | null>(null);

  const array = useMemo(() => createMethodArray(kind, elemType, values), [kind, elemType, values]);
  const outcome = useMemo(() => evaluateMethod(array, method, withId, seed), [array, method, withId, seed]);
  const prediction = useMemo(() => predictMethod(array, method, withId, seed), [array, method, withId, seed]);
  const resetKey = `${kind}|${elemType}|${values.join(",")}|${method}|${withId}|${seed}`;

  const chooseType = (t: MethodElemTypeId) => {
    const preset = methodDataPreset(t);
    setElemType(t);
    setValues(preset);
    setDraft(preset.join(", "));
    setDraftError(null);
  };

  const chooseFamily = (f: MethodFamily) => {
    setFamily(f);
    const m = FAMILY_METHODS[f][0];
    setMethod(m);
    setWithId(withChoicesFor(m)[0]);
  };

  const chooseMethod = (m: ArrayMethodName) => {
    setMethod(m);
    if (!withChoicesFor(m).includes(withId)) setWithId(withChoicesFor(m)[0]);
  };

  const applyDraft = () => {
    const parts = draft.split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.length < 2 || parts.length > 8 || parts.some((n) => !Number.isInteger(n))) {
      setDraftError("Enter 2 to 8 integers separated by commas.");
      return;
    }
    const t = SV_ELEM_TYPES[elemType];
    const wrapped = parts.map((n) => wrapToWidth(n, t.width, t.signed));
    setValues(wrapped);
    setDraft(wrapped.join(", "));
    setDraftError(wrapped.some((v, i) => v !== parts[i]) ? `Values were wrapped to fit ${t.decl}.` : null);
  };

  const withOptions = withChoicesFor(method).map((w) => ({
    value: w,
    label: w === "none" ? "no with clause" : `with (${WITH_CLAUSES[w].text})`,
  }));

  const scalar = outcome.scalar;

  return (
    <VisualFrame
      label="Array method explorer"
      eyebrow="Experiment"
      title="Array method explorer: return types and result widths"
      summary="Pick an array, a method and a with clause. Predict the result before you see it: most bugs here are a wrong return type or a sum that silently wraps."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="space-y-4" data-testid="array-method-explorer">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedControl
            label="Array kind"
            mono
            options={[
              { value: "queue", label: "data[$]" },
              { value: "assoc", label: "data[string]" },
            ]}
            value={kind}
            onChange={setKind}
          />
          <SegmentedControl
            label="Element type"
            mono
            options={(["int", "byte", "bit8"] as const).map((t) => ({ value: t, label: SV_ELEM_TYPES[t].decl }))}
            value={elemType}
            onChange={chooseType}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Values (2–8 integers)
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={draftError !== null && !draftError.startsWith("Values were")}
              className="h-10 w-64 max-w-full rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button type="button" onClick={applyDraft} className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Use these values
          </button>
          {draftError ? <p className="w-full text-xs text-amber-800 dark:text-amber-200">⚠ {draftError}</p> : null}
        </div>

        <SegmentedControl label="Method family" options={familyOptions} value={family} onChange={chooseFamily} />
        <SegmentedControl
          label="Method"
          mono
          options={FAMILY_METHODS[family].map((m) => ({ value: m, label: `${m}()` }))}
          value={method}
          onChange={chooseMethod}
        />
        <SegmentedControl label="With clause" mono options={withOptions} value={withId} onChange={setWithId} />

        <CodeTrace
          label="Declaration and call"
          lines={[
            { text: methodArrayDeclaration(array), key: "decl" },
            { text: outcome.statement, key: "call" },
          ]}
          activeKey="call"
        />
        <DataStrip array={array} highlight={[]} label="data" />

        <PredictionPrompt
          resetKey={resetKey}
          question={<span className="[font-variant-ligatures:none]">{prediction.question.replace(/`/g, "")}</span>}
          options={prediction.options}
        >
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3 text-sm" aria-live="polite">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Returns</span>
              <code className="rounded-md border border-indigo-400/60 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs text-indigo-800 [font-variant-ligatures:none] dark:text-indigo-100">
                {outcome.returnType}
              </code>
            </p>
            {outcome.kind === "error" ? (
              <p className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-rose-500/70 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-800 dark:text-rose-200">
                <span aria-hidden>✕</span> {outcome.error?.text} <span className="opacity-75">{outcome.error?.clause}</span>
              </p>
            ) : (
              <p className="font-mono text-base text-foreground [font-variant-ligatures:none]" data-testid="array-method-result">
                {formatMethodResult(outcome)}
              </p>
            )}
            {scalar ? (
              <p className={cn("text-xs", scalar.overflow ? "text-rose-800 dark:text-rose-200" : "text-muted-foreground")}>
                {scalar.overflow ? "✕ Overflow, silently: " : "✓ "}exact value {scalar.exact}, result type {scalar.typeText} ({scalar.width} bit{scalar.width === 1 ? "" : "s"}
                {scalar.signed ? ", signed" : ", unsigned"}){scalar.overflow ? ` → ${scalar.value}. No warning is issued.` : "."}
              </p>
            ) : null}
            {outcome.kind === "void" ? <DataStrip array={{ ...array, values: outcome.after }} highlight={[]} label="data after" /> : null}
            {outcome.kind === "queue" || outcome.kind === "scalar" ? <DataStrip array={array} highlight={outcome.highlight} label="selected" /> : null}
            <p className="text-foreground">
              <strong>Why: </strong>
              {outcome.why} <span className="text-xs text-muted-foreground">({outcome.clause})</span>
            </p>
            {outcome.notes.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {outcome.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {outcome.kind === "void" ? (
                <button
                  type="button"
                  onClick={() => {
                    setValues(outcome.after);
                    setDraft(outcome.after.join(", "));
                  }}
                  className="min-h-10 rounded-lg border border-cyan-500/50 px-3 text-xs hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Keep this order in data
                </button>
              ) : null}
              {method === "shuffle" && outcome.kind === "void" ? (
                <button type="button" onClick={() => setSeed((s) => s + 1)} className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Next seed ({seed + 1})
                </button>
              ) : null}
            </div>
          </div>
        </PredictionPrompt>
        <p className="text-xs text-muted-foreground">
          Rule of thumb: {ARRAY_METHODS[method].family === "locator" ? "capture locator results in a queue, e.g. int r[$] = data.max();" : ARRAY_METHODS[method].family === "ordering" ? "ordering methods return nothing; call them as statements." : "cast inside the with clause, e.g. data.sum() with (int'(item)), whenever the total can outgrow the element type."}
        </p>
      </div>
    </VisualFrame>
  );
}
