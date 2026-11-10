"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { BitStrip } from "@/components/visual-system/BitStrip";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { comparisonStyles } from "@/components/visual-system/visual-language";
import {
  bitsOf,
  buildEnv,
  declToSource,
  declType,
  evaluateAssignment,
  expressionIdentifiers,
  formatCompact,
  formatDecimal,
  formatTargetValue,
  intendedValue,
  isKnown,
  numericInit,
  predictionVerdict,
  reinterpret,
  stepBadges,
  toBigInt,
  trapPredictionOptions,
  trapScenarios,
  typeToSource,
  valueRange,
  type ExprStep,
  type OperandInfo,
  type StepBadge,
  type SvDecl,
  type SvValue,
  type TrapScenario,
} from "@/lib/sv-expression-model";
import { cn } from "@/lib/utils";

export const EXPRESSION_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §11.6–11.8 (expression size and type), §10.7 (assignment truncation), §6.24.1 and §11.7 (casts, $signed/$unsigned) and the §11.4 operator rules.",
  "Integral operands only: no real, string, enum or struct operands. The unbased unsized literals '0 '1 'x 'z fill their context and are 1 bit on their own (§5.7.1).",
  "Unsized literals are exactly 32 bits, except that an x/z-led unsized literal such as 'hx pads to a wider context (§5.7.1). The LRM says 'at least 32'; mainstream simulators use 32.",
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
// Bit strip: the shared visual-system BitStrip fed with a model value.
// Sign bit (S), extension bits (+), discarded bits (✕), x hatched, z dashed,
// and a bar under the bits a shift filled in.
// ---------------------------------------------------------------------------

interface ValueStripProps {
  value: SvValue;
  label: string;
  /** Bits at this index and above were added by extension. */
  extendedFrom?: number;
  /** Index of the operand's own sign bit (signed operands only). */
  signBit?: number;
  /** Bits at this index and above are discarded by the assignment. */
  droppedFrom?: number;
  /** Bits to mark with a bar, e.g. the positions a shift filled. */
  highlight?: number[];
  highlightLabel?: string;
}

function ValueStrip({ value, label, extendedFrom, signBit, droppedFrom, highlight, highlightLabel }: ValueStripProps) {
  return (
    <BitStrip
      bits={bitsOf(value)}
      label={label}
      valueText={formatCompact(reinterpret(value, false))}
      extendedFrom={extendedFrom}
      signBit={signBit}
      droppedFrom={droppedFrom}
      highlight={highlight}
      highlightLabel={highlightLabel}
    />
  );
}

const SHIFT_OPS = new Set(["<<", ">>", "<<<", ">>>"]);

/** For a shift step, the bit numbers the shift filled in (vacated positions). */
function filledBits(step: ExprStep & { kind: "op" }): number[] {
  if (!SHIFT_OPS.has(step.op) || step.inputs.length < 2) return [];
  const count = toBigInt(step.inputs[1], false);
  if (count === null) return [];
  const W = step.result.width;
  const s = Math.min(Number(count), W);
  const right = step.op === ">>" || step.op === ">>>";
  return Array.from({ length: s }, (_, i) => (right ? W - 1 - i : i));
}

/** A size or type cast narrower than its operand: the MSBs it discards are drawn on the operand (§6.24.1). */
const isNarrowingCast = (step: ExprStep) => step.kind === "op" && step.op === "cast" && step.inputs[0].width > step.result.width;

// ---------------------------------------------------------------------------
// Number field that accepts partial input ("-") and commits valid values
// ---------------------------------------------------------------------------

function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const id = useId();
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

/** `badge` marks a step that decides the result (`stepBadges`): the trap in a trap variant, the cure or the point in any other. */
function StepCard({ index, title, why, clause, badge, children }: { index: number; title: React.ReactNode; why: string; clause: string; badge?: StepBadge | null; children?: React.ReactNode }) {
  const trap = badge === "trap";
  return (
    <li className={cn("rounded-xl border bg-background/50 p-3", !badge ? "border-border/70" : trap ? "border-amber-500/60" : "border-cyan-500/60")}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {index}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              trap ? "bg-amber-500/20 text-amber-900 dark:text-amber-100" : "bg-cyan-500/15 text-cyan-900 dark:text-cyan-100",
            )}
          >
            {trap ? "⚠ trap" : "key step"}
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
            <ValueStrip value={o.value} label={o.text} signBit={o.signed ? o.width - 1 : undefined} />
            <span className="font-mono text-xs text-foreground [font-variant-ligatures:none]">= {isKnown(o.value) ? formatDecimal(o.value) : "x"}</span>
          </li>
        ))}
      </ul>
    </StepCard>
  );
}

function TraceStep({ step, index, badge }: { step: ExprStep; index: number; badge: StepBadge | null }) {
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
          badge={badge}
        />
      );
    case "extend":
      return (
        <StepCard
          index={index}
          title={
            <>
              {step.mode === "sign" ? "Sign-extend" : step.mode === "zero" ? "Zero-extend" : step.mode === "fill" ? "Fill with" : "Read"} <Code>{step.text}</Code>
              {step.mode !== "same" ? ` ${step.from.width} → ${step.to.width} bits` : ""}
            </>
          }
          why={step.why}
          clause={step.clause}
          badge={badge}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ValueStrip value={step.from} label={`${step.text} before`} signBit={step.from.signed ? step.from.width - 1 : undefined} />
            {step.mode !== "same" || step.from.signed !== step.to.signed ? (
              <>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <ValueStrip value={step.to} label={`${step.text} in context`} extendedFrom={step.to.width > step.from.width ? step.from.width : undefined} />
              </>
            ) : null}
            <span className="font-mono text-xs [font-variant-ligatures:none]">= {formatDecimal(step.to)}</span>
          </div>
        </StepCard>
      );
    case "op": {
      const filled = filledBits(step);
      const narrowed = isNarrowingCast(step);
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
          badge={badge}
        >
          <div className="flex flex-wrap items-center gap-2">
            {narrowed ? (
              <>
                <ValueStrip value={step.inputs[0]} label="value inside the cast" droppedFrom={step.result.width} />
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
              </>
            ) : null}
            <ValueStrip value={step.result} label={`${step.text} result`} highlight={filled.length ? filled : undefined} highlightLabel="filled by the shift" />
            <span className="font-mono text-xs [font-variant-ligatures:none]">= {formatDecimal(step.result)}</span>
            {filled.length ? (
              <span className="text-xs text-muted-foreground">
                fill bit{filled.length === 1 ? "" : "s"} (bar): {filled.map((i) => `bit ${i} = ${bitsOf(step.result)[step.result.width - 1 - i]}`).join(", ")}
                {step.op === ">>>" ? (step.result.signed ? ", a copy of the sign bit because the expression is signed" : ", a 0 because the expression is unsigned") : ""}
              </span>
            ) : null}
          </div>
        </StepCard>
      );
    }
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
          badge={badge}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ValueStrip value={step.from} label="value before storing" droppedFrom={step.dropped > 0 ? step.to.width : undefined} />
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <ValueStrip value={step.to} label="stored value" extendedFrom={step.to.width > step.from.width ? step.from.width : undefined} />
          </div>
        </StepCard>
      );
  }
}

// ---------------------------------------------------------------------------
// Reveal announcements
// ---------------------------------------------------------------------------

/**
 * Mounted only while the reveal shows. PredictionPrompt unmounts the focused
 * button when the learner commits and mounts its feedback together with its
 * live region, so this moves focus to that feedback and fills a live region that
 * is always mounted. Both belong in PredictionPrompt; drop this once it does them.
 */
function RevealAnnouncer({ prompt, text, onAnnounce }: { prompt: React.RefObject<HTMLDivElement>; text: string; onAnnounce: (text: string) => void }) {
  useEffect(() => {
    const feedback = prompt.current?.querySelector<HTMLElement>("[aria-live]");
    if (!feedback) return;
    feedback.tabIndex = -1;
    feedback.focus();
  }, [prompt]);
  useEffect(() => {
    onAnnounce(text);
    return () => onAnnounce("");
  }, [text, onAnnounce]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SignednessVisualizerProps {
  /** A `trapScenarios` id, e.g. "lost-carry". */
  scenario?: string;
  /** The code variant to open on, e.g. "size-cast" for the lost-carry scenario. */
  initialVariant?: string;
}

export default function SignednessVisualizer({ scenario: initialScenario, initialVariant }: SignednessVisualizerProps) {
  // A lesson that names its scenario keeps the other traps one click away, so the question stays near the top on a phone.
  const pinned = initialScenario !== undefined;
  const [scenarioId, setScenarioId] = useState(initialScenario ?? "mixed-add");
  const scenario = trapScenarios.find((s) => s.id === scenarioId) ?? trapScenarios[0];
  const [variantId, setVariantId] = useState(() => (scenario.variants.find((v) => v.id === initialVariant) ?? scenario.variants[0]).id);
  const [edits, setEdits] = useState<Edits>({});

  const variant = scenario.variants.find((v) => v.id === variantId) ?? scenario.variants[0];
  const target = variant.target ?? scenario.target;
  const decls = useMemo(() => applyEdits(scenario, edits), [scenario, edits]);
  const result = useMemo(() => evaluateAssignment(decls, target, variant.expr), [decls, target, variant.expr]);
  const labelBits = scenario.labelBits ?? false;
  const options = useMemo(() => trapPredictionOptions(decls, target, variant.expr, variant.takeaway, { labelBits }), [decls, target, variant.expr, variant.takeaway, labelBits]);
  const contrast = scenario.variants.find((v) => v.id === variant.contrast);
  const contrastResult = useMemo(() => (contrast ? evaluateAssignment(decls, contrast.target ?? scenario.target, contrast.expr) : null), [contrast, decls, scenario.target]);
  const intent = useMemo(() => (scenario.intent ? intendedValue(decls, variant.expr) : null), [scenario.intent, decls, variant.expr]);
  // Only the operands this code variant reads get an editor: a field that changes nothing reads as broken.
  const referenced = useMemo(() => expressionIdentifiers(variant.expr), [variant.expr]);
  const editors = scenario.editable.filter((ed) => referenced.has(ed.name));

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
  const hasShift = result.ok && result.steps.some((s) => s.kind === "op" && SHIFT_OPS.has(s.op));
  const hasFill = result.ok && result.steps.some((s) => s.kind === "extend" && s.mode === "fill");
  const hasNarrowCast = result.ok && result.steps.some(isNarrowingCast);
  const matchesIntent = result.ok && intent !== null && toBigInt(result.final) === intent;
  const badges = result.ok ? stepBadges(variant, result.steps, matchesIntent) : [];
  const promptRef = useRef<HTMLDivElement>(null);
  const [verdict, setVerdict] = useState("");

  const nextVariant = scenario.variants[(scenario.variants.indexOf(variant) + 1) % scenario.variants.length];
  // The Next variant button unmounts with the reveal it sits in, so focus moves to the new question after the commit.
  const questionFocusPending = useRef(false);
  useEffect(() => {
    if (!questionFocusPending.current) return;
    questionFocusPending.current = false;
    const question = promptRef.current?.querySelector<HTMLElement>("legend, [role='alert']");
    if (!question) return;
    question.tabIndex = -1;
    question.focus();
  }, [variant.id]);

  const scenarioPicker = <SegmentedControl label="Trap scenario" options={trapScenarios.map((s) => ({ value: s.id, label: s.title }))} value={scenario.id} onChange={switchScenario} mono />;

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
      {pinned ? (
        <details>
          <summary className="cursor-pointer py-3 text-xs font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300">
            More traps
          </summary>
          <div className="mt-2">{scenarioPicker}</div>
        </details>
      ) : (
        scenarioPicker
      )}
      <p className="text-sm text-muted-foreground">{scenario.summary}</p>

      {scenario.variants.length > 1 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Code variant</p>
          <SegmentedControl label="Code variant" options={scenario.variants.map((v) => ({ value: v.id, label: v.label }))} value={variant.id} onChange={setVariantId} mono />
        </div>
      ) : null}

      {editors.length > 0 ? (
        <fieldset className="grid gap-3 rounded-xl border border-border/70 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operands</legend>
          {editors.map((ed) => {
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

      <div>
        <p role="status" aria-label="Prediction verdict" className="sr-only">
          {verdict}
        </p>
        <div ref={promptRef}>
          {!result.ok ? (
            <p role="alert" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              ✕ {plain(result.error.message)} ({result.error.clause})
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
              {({ committed }) => (
                <div className="space-y-4">
                  <RevealAnnouncer prompt={promptRef} text={predictionVerdict(options, committed)} onAnnounce={setVerdict} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
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
                          const style = matchesIntent ? comparisonStyles.match : comparisonStyles.mismatch;
                          return (
                            <span className={cn("text-xs font-medium", style.className)}>
                              {style.glyph} {matchesIntent ? "Matches" : "Differs from"} what the author meant ({scenario.intent})
                            </span>
                          );
                        })()}
                      </>
                    ) : null}
                  </div>

                  {contrast && contrastResult?.ok ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>Without the fix:</span>
                      <Code>{contrast.label}</Code>
                      <span className={cn("rounded-md border px-2 py-1 font-mono [font-variant-ligatures:none]", comparisonStyles.actual.className)}>
                        {comparisonStyles.actual.tag} {formatTargetValue(contrastResult.target.name, contrastResult.final, labelBits)}
                      </span>
                    </p>
                  ) : null}

                  {scenario.rule ? (
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Rule: </strong>
                      {scenario.rule}
                    </p>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    Legend: <span className="font-semibold text-foreground">S</span> = the operand's sign bit (violet ring) · <span className="font-semibold text-foreground">+</span> = bit
                    added by extension{hasFill ? " or by a fill literal" : ""} (dashed) · <span className="font-semibold text-foreground">✕</span> = bit discarded by the store{hasNarrowCast ? " or a narrowing cast" : ""}
                    {hasShift ? (
                      <>
                        {" "}
                        · <span className="font-semibold text-foreground">bar</span> = bit filled in by the shift
                      </>
                    ) : null}{" "}
                    · hatched = x · dashed amber = z.
                  </p>

                  <ol className="space-y-3" aria-label="Evaluation steps">
                    <OperandsStep operands={result.operands} />
                    {result.steps.map((step, i) => (
                      <TraceStep key={`${step.kind}-${i}`} step={step} index={i + 2} badge={badges[i]} />
                    ))}
                  </ol>

                  {scenario.variants.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          questionFocusPending.current = true;
                          setVariantId(nextVariant.id);
                        }}
                        className="min-h-10 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Next variant: <span className="font-mono [font-variant-ligatures:none]">{nextVariant.label}</span>
                      </button>
                      <span className="text-xs text-muted-foreground">Predict again: the trace shows which single rule changes the answer.</span>
                    </div>
                  ) : null}
                </div>
              )}
            </PredictionPrompt>
          )}
        </div>
      </div>
    </VisualFrame>
  );
}
