"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  bitsOf,
  buildEnv,
  declToSource,
  declType,
  evaluateAssignment,
  formatCompact,
  formatDecimal,
  intendedValue,
  isKnown,
  numericInit,
  reinterpret,
  toBigInt,
  trapPredictionOptions,
  trapScenarios,
  typeToSource,
  valueRange,
  type Bit4,
  type ExprStep,
  type OperandInfo,
  type SvDecl,
  type SvValue,
  type TrapScenario,
} from "@/lib/sv-expression-model";
import { cn } from "@/lib/utils";

export const EXPRESSION_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §11.6–11.8 (expression size and type), §10.7 (assignment truncation), §6.24.1 and §11.7 (casts, $signed/$unsigned) and the §11.4 operator rules.",
  "Integral operands only: no real, string, enum or struct operands, and no unbased unsized literals such as '1.",
  "Unsized literals are exactly 32 bits. The LRM says 'at least 32'; mainstream simulators use 32.",
  "x/z in arithmetic follows the LRM's pessimistic rule: the whole result is x. Real gates can be less pessimistic.",
];

type Edits = Record<string, { value?: number; width?: number }>;

/** Apply the learner's value/width edits to a scenario's declarations. */
function applyEdits(scenario: TrapScenario, edits: Edits): SvDecl[] {
  return scenario.decls.map((d) => {
    const e = edits[d.name];
    if (!e) return d;
    const width = e.width ?? d.width;
    const sized: SvDecl = { ...d, width };
    const value = e.value ?? currentValue(scenario.decls, d.name);
    return { ...sized, init: numericInit(sized, clampTo(sized, value, scenario)) };
  });
}

function currentValue(decls: SvDecl[], name: string): number {
  const v = buildEnv(decls)[name]?.value;
  const n = v ? toBigInt(v) : null;
  return n === null ? 0 : Number(n);
}

function limitsFor(decl: SvDecl, scenario: TrapScenario): { min: number; max: number } {
  const range = valueRange(decl);
  const ed = scenario.editable.find((e) => e.name === decl.name);
  return { min: Math.max(range.min, ed?.min ?? range.min), max: Math.min(range.max, ed?.max ?? range.max) };
}

function clampTo(decl: SvDecl, value: number, scenario: TrapScenario): number {
  const { min, max } = limitsFor(decl, scenario);
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Bit strip: sign bit (S), extension bits (+), discarded bits (✕), x hatched, z dashed
// ---------------------------------------------------------------------------

interface BitStripProps {
  value: SvValue;
  label: string;
  /** Bits at this index and above were added by extension. */
  extendedFrom?: number;
  /** Index of the operand's own sign bit (signed operands only). */
  signBit?: number;
  /** Bits at this index and above are discarded by the assignment. */
  droppedFrom?: number;
}

function bitClass(b: Bit4): string {
  if (b === "x") return valueStyles.unknown.className;
  if (b === "z") return valueStyles.highz.className;
  if (b === "1") return valueStyles.one.className;
  return valueStyles.zero.className;
}

export function BitStrip({ value, label, extendedFrom, signBit, droppedFrom }: BitStripProps) {
  const bits = bitsOf(value);
  const w = value.width;
  const groups: { bit: Bit4; index: number }[][] = [];
  bits.forEach((bit, k) => {
    const index = w - 1 - k;
    const fromRight = index;
    if (groups.length === 0 || (fromRight + 1) % 4 === 0) groups.push([]);
    groups[groups.length - 1].push({ bit, index });
  });
  const notes: string[] = [];
  if (extendedFrom !== undefined && extendedFrom < w) notes.push(`bits ${w - 1} to ${extendedFrom} added by extension`);
  if (signBit !== undefined) notes.push(`sign bit is bit ${signBit}`);
  if (droppedFrom !== undefined && droppedFrom < w) notes.push(`bits ${w - 1} to ${droppedFrom} discarded`);
  const aria = `${label}: ${w}-bit value ${formatCompact(reinterpret(value, false))}${notes.length ? `; ${notes.join("; ")}` : ""}`;

  return (
    <div role="img" aria-label={aria} className="flex flex-wrap items-start gap-x-1.5 gap-y-1 font-mono [font-variant-ligatures:none]">
      {groups.map((g) => (
        <span key={g[0].index} className="inline-flex gap-px">
          {g.map(({ bit, index }) => {
            const ext = extendedFrom !== undefined && index >= extendedFrom;
            const dropped = droppedFrom !== undefined && index >= droppedFrom;
            const sign = signBit === index;
            return (
              <span key={index} className="flex w-4 flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-4 items-center justify-center rounded-[3px] border text-[11px] font-semibold",
                    bitClass(bit),
                    ext && "border-dashed",
                    sign && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background",
                    dropped && "line-through opacity-50",
                  )}
                >
                  {bit}
                </span>
                <span aria-hidden className="h-3 text-[9px] leading-3 text-muted-foreground">
                  {dropped ? "✕" : sign ? "S" : ext ? "+" : ""}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number field that accepts partial input ("-") and commits valid values
// ---------------------------------------------------------------------------

function NumberField({ id, label, value, min, max, onCommit }: { id: string; label: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(String(value));
  }
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        {label} <span className="font-mono [font-variant-ligatures:none]">({min} … {max})</span>
      </span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max) onCommit(n);
        }}
        onBlur={() => setDraft(String(value))}
        className="h-10 w-full max-w-[12rem] rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Trace steps
// ---------------------------------------------------------------------------

function StepCard({ index, title, why, clause, surprising, children }: { index: number; title: React.ReactNode; why: string; clause: string; surprising?: boolean; children?: React.ReactNode }) {
  return (
    <li className={cn("rounded-xl border bg-background/50 p-3", surprising ? "border-amber-500/60" : "border-border/70")}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {index}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {surprising ? (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
            ⚠ trap
          </span>
        ) : null}
        <span className="ml-auto rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{clause}</span>
      </div>
      {children ? <div className="mt-2 space-y-2 overflow-x-auto">{children}</div> : null}
      <p className="mt-2 text-sm text-muted-foreground">
        <strong className="text-foreground">Why: </strong>
        <Prose text={why} />
      </p>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1 font-mono text-[0.92em] [font-variant-ligatures:none]">{children}</code>
);

/** Model prose marks code with backticks; render those spans as code. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) => (i % 2 === 1 ? <Code key={i}>{part}</Code> : <React.Fragment key={i}>{part}</React.Fragment>))}
    </>
  );
}

/** PredictionPrompt feedback is plain text: drop the backtick markers. */
const plain = (text: string) => text.replace(/`/g, "");

function OperandsStep({ operands }: { operands: OperandInfo[] }) {
  return (
    <StepCard
      index={1}
      title="Operand sizes and types"
      why="Each operand's width and sign come from its declaration or literal. Operands marked self-determined keep their own size; the others will be resized to the context."
      clause="§11.6.1, §11.8.1"
    >
      <ul className="space-y-2">
        {operands.map((o) => (
          <li key={`${o.text}-${o.role}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Code>{o.declaration ?? o.text}</Code>
            <span className="text-xs text-muted-foreground">
              {o.width} bit{o.width === 1 ? "" : "s"}, {o.signed ? "signed" : "unsigned"}
              {o.role === "self" ? ", self-determined" : o.role === "compare" ? ", sized against the other compare operand" : o.role === "cast" ? ", sized by the cast" : ""}
            </span>
            <BitStrip value={o.value} label={o.text} signBit={o.signed ? o.width - 1 : undefined} />
            <span className="font-mono text-xs text-foreground [font-variant-ligatures:none]">= {isKnown(o.value) ? formatDecimal(o.value) : "x"}</span>
          </li>
        ))}
      </ul>
    </StepCard>
  );
}

function TraceStep({ step, index }: { step: ExprStep; index: number }) {
  switch (step.kind) {
    case "context":
      return (
        <StepCard
          index={index}
          title={
            <>
              {step.scope === "assignment" ? "Context" : step.scope === "comparison" ? "Comparison context" : "Cast context"}: {step.width} bit{step.width === 1 ? "" : "s"},{" "}
              {step.signed ? "signed" : "unsigned"}
            </>
          }
          why={step.why}
          clause={step.clause}
          surprising={step.surprising}
        />
      );
    case "extend":
      return (
        <StepCard
          index={index}
          title={
            <>
              {step.mode === "sign" ? "Sign-extend" : step.mode === "zero" ? "Zero-extend" : "Read"} <Code>{step.text}</Code>
              {step.mode !== "same" ? ` ${step.from.width} → ${step.to.width} bits` : ""}
            </>
          }
          why={step.why}
          clause={step.clause}
          surprising={step.surprising}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BitStrip value={step.from} label={`${step.text} before`} signBit={step.from.signed ? step.from.width - 1 : undefined} />
            {step.mode !== "same" || step.from.signed !== step.to.signed ? (
              <>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <BitStrip value={step.to} label={`${step.text} in context`} extendedFrom={step.to.width > step.from.width ? step.from.width : undefined} />
              </>
            ) : null}
            <span className="font-mono text-xs [font-variant-ligatures:none]">= {formatDecimal(step.to)}</span>
          </div>
        </StepCard>
      );
    case "op":
      return (
        <StepCard
          index={index}
          title={
            <>
              Evaluate <Code>{step.text}</Code>
            </>
          }
          why={step.why}
          clause={step.clause}
          surprising={step.surprising}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BitStrip value={step.result} label={`${step.text} result`} />
            <span className="font-mono text-xs [font-variant-ligatures:none]">= {formatDecimal(step.result)}</span>
          </div>
        </StepCard>
      );
    case "assign":
      return (
        <StepCard
          index={index}
          title={
            <>
              Store: <Code>{step.text}</Code>
            </>
          }
          why={step.why}
          clause={step.clause}
          surprising={step.surprising}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BitStrip value={step.from} label="value before storing" droppedFrom={step.dropped > 0 ? step.to.width : undefined} />
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <BitStrip value={step.to} label="stored value" extendedFrom={step.to.width > step.from.width ? step.from.width : undefined} />
          </div>
        </StepCard>
      );
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SignednessVisualizer({ scenario: initialScenario = "mixed-add" }: { scenario?: string }) {
  const [scenarioId, setScenarioId] = useState(initialScenario);
  const scenario = trapScenarios.find((s) => s.id === scenarioId) ?? trapScenarios[0];
  const [variantId, setVariantId] = useState(scenario.variants[0].id);
  const [edits, setEdits] = useState<Edits>({});

  const variant = scenario.variants.find((v) => v.id === variantId) ?? scenario.variants[0];
  const target = variant.target ?? scenario.target;
  const decls = useMemo(() => applyEdits(scenario, edits), [scenario, edits]);
  const result = useMemo(() => evaluateAssignment(decls, target, variant.expr), [decls, target, variant.expr]);
  const options = useMemo(() => trapPredictionOptions(decls, target, variant.expr), [decls, target, variant.expr]);
  const intent = useMemo(() => (scenario.intent ? intendedValue(decls, variant.expr) : null), [scenario.intent, decls, variant.expr]);

  const switchScenario = (id: string) => {
    const next = trapScenarios.find((s) => s.id === id) ?? trapScenarios[0];
    setScenarioId(next.id);
    setVariantId(next.variants[0].id);
    setEdits({});
  };

  const typeColumn = Math.max(...[...decls, target].map((d) => typeToSource(d).length));
  const lines: CodeTraceLine[] = [
    ...decls.map((d) => ({ text: declToSource(d, typeColumn), key: `decl-${d.name}` })),
    { text: declToSource({ ...target, init: undefined }, typeColumn), key: "decl-target" },
    { text: `${target.name} = ${variant.expr};`, key: "assign" },
  ];
  const configKey = JSON.stringify([scenario.id, variant.id, decls.map((d) => [d.width, d.init])]);
  const env = useMemo(() => buildEnv(decls), [decls]);

  return (
    <VisualFrame
      label="Expression trap lab"
      eyebrow="Experiment"
      title="Expression trap lab: width and sign"
      summary={
        <>
          Pick a trap, change the operands, and predict what the variable holds. The reveal walks the LRM's steps: operand sizes, the context width and type, how each
          operand is extended, the operation, and the store.
        </>
      }
      fidelity="model"
      assumptions={EXPRESSION_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Trap scenario"
        options={trapScenarios.map((s) => ({ value: s.id, label: s.title }))}
        value={scenario.id}
        onChange={switchScenario}
        mono
      />
      <p className="text-sm text-muted-foreground">{scenario.summary}</p>

      {scenario.variants.length > 1 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Code variant</p>
          <SegmentedControl label="Code variant" options={scenario.variants.map((v) => ({ value: v.id, label: v.label }))} value={variant.id} onChange={setVariantId} mono />
        </div>
      ) : null}

      {scenario.editable.length > 0 ? (
        <fieldset className="grid gap-3 rounded-xl border border-border/70 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operands</legend>
          {scenario.editable.map((ed) => {
            const decl = decls.find((d) => d.name === ed.name);
            if (!decl) return null;
            const { min, max } = limitsFor(decl, scenario);
            const value = Number(toBigInt(env[ed.name].value) ?? 0);
            return (
              <div key={ed.name} className="min-w-0 space-y-2">
                {ed.widths ? (
                  <SegmentedControl
                    label={`Width of ${ed.name}`}
                    options={ed.widths.map((w) => ({ value: String(w), label: `${w}-bit ${ed.name}` }))}
                    value={String(declType(decl).width)}
                    onChange={(w) => setEdits((prev) => ({ ...prev, [ed.name]: { ...prev[ed.name], value, width: Number(w) } }))}
                    mono
                  />
                ) : null}
                <NumberField
                  id={`sv-trap-${scenario.id}-${ed.name}`}
                  label={`Value of ${ed.name}`}
                  value={value}
                  min={min}
                  max={max}
                  onCommit={(n) => setEdits((prev) => ({ ...prev, [ed.name]: { ...prev[ed.name], value: n } }))}
                />
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <CodeTrace label="The code" lines={lines} />

      {!result.ok ? (
        <p role="alert" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
          ✕ {result.error.message} ({result.error.clause})
        </p>
      ) : (
        <PredictionPrompt
          resetKey={configKey}
          question={
            <>
              After <Code>{`${target.name} = ${variant.expr};`}</Code>, what does <Code>{target.name}</Code> hold?
            </>
          }
          options={options.map((o) => ({
            id: o.id,
            label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>,
            correct: o.correct,
            feedback: plain(o.feedback),
          }))}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
              <span className={cn("rounded-md border px-2 py-1 font-mono [font-variant-ligatures:none]", comparisonStyles.actual.className)}>
                {comparisonStyles.actual.tag} {target.name} = {isKnown(result.final) ? formatDecimal(result.final) : formatCompact(reinterpret(result.final, false))}
                <span className="ml-2 text-xs opacity-75">{formatCompact(reinterpret(result.final, false))}</span>
              </span>
              {intent !== null && scenario.intent ? (
                <>
                  <span className={cn("rounded-md border px-2 py-1 font-mono [font-variant-ligatures:none]", comparisonStyles.expected.className)}>
                    {comparisonStyles.expected.tag} {target.name} = {intent.toString()}
                  </span>
                  {(() => {
                    const actual = toBigInt(result.final);
                    const match = actual !== null && actual === intent;
                    const style = match ? comparisonStyles.match : comparisonStyles.mismatch;
                    return (
                      <span className={cn("text-xs font-medium", style.className)}>
                        {style.glyph} {match ? "Matches" : "Differs from"} what the author meant ({scenario.intent})
                      </span>
                    );
                  })()}
                </>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Legend: <span className="font-semibold text-foreground">S</span> = the operand's sign bit (violet ring) · <span className="font-semibold text-foreground">+</span> = bit
              added by extension (dashed) · <span className="font-semibold text-foreground">✕</span> = bit discarded by the store · hatched = x · dashed amber = z.
            </p>

            <ol className="space-y-3" aria-label="Evaluation steps">
              <OperandsStep operands={result.operands} />
              {result.steps.map((step, i) => (
                <TraceStep key={`${step.kind}-${i}`} step={step} index={i + 2} />
              ))}
            </ol>

            <p className="text-sm text-muted-foreground">
              Now switch to another code variant above and predict again: the trace shows which single rule changes the answer.
            </p>
          </div>
        </PredictionPrompt>
      )}
    </VisualFrame>
  );
}
