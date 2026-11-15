"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { BitStrip, BitStripLegend, type BitLegendItem } from "@/components/visual-system/BitStrip";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl, type SegmentOption } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";
import {
  LITERAL_PRESETS,
  LITERAL_TARGETS,
  MAX_DECODER_BITS,
  bitsText,
  decodeLiteral,
  literalCode,
  literalPredictionOptions,
  literalPreset,
  predictionQuestion,
  syntaxErrorCards,
  type LiteralDecode,
  type LiteralError,
  type LiteralPresetId,
  type LiteralStep,
  type LiteralTargetId,
} from "@/lib/sv-literal-model";

/** Shown in the frame's "Assumptions and limits" disclosure. */
export const LITERAL_ASSUMPTIONS: string[] = [
  "The stored bits come from the site's expression model (parseLiteral and evaluateAssignment), which implements IEEE 1800-2023 §5.7.1 and §10.7; this decoder only explains the steps between them.",
  "An unsized literal has at least 32 bits, or at least the width its value needs (§5.7.1), not an exact width. The decoder uses 32, or the bits the digits spell when there are more than 32 (for an unsized 's decimal literal, the bits its positive value needs plus a 0 sign bit), and says so wherever the choice could show.",
  "Whether a tool warns about a truncated literal or a truncating assignment is the tool's choice: §5.7.1 asks for no warning and §10.7 allows one without requiring it.",
  `The decoder takes one literal at a time, up to ${MAX_DECODER_BITS} bits. A leading + or - is a unary operator (§5.7.1), not part of the literal, so it is not decoded here.`,
];

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border bg-card p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-40 motion-reduce:transition-none";
const inputClass =
  "h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono [font-variant-ligatures:none]";
/** The shared primitives size some buttons below 40 px: size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";
const scrubberClass = "h-2 min-w-0 flex-1 cursor-pointer accent-cyan-500 [@media(pointer:coarse)]:h-10";

export interface LiteralDecoderProps {
  /** The preset shown first; each lesson use has one (see LITERAL_PRESETS). */
  preset?: LiteralPresetId;
  /** Overrides the preset's own target. */
  target?: LiteralTargetId;
  /** Limit the preset buttons to these (default: all). */
  presets?: LiteralPresetId[];
  /** Let the learner type a literal (default true). */
  allowInput?: boolean;
  /** Show the two syntax-error cards (default true). */
  showSyntaxErrors?: boolean;
  className?: string;
}

type Selection = LiteralPresetId | "custom";

/**
 * With focusOnMount, takes the focus when it mounts, which is when a reveal opens:
 * the button that had the focus has just gone. Without a reveal (nothing to
 * predict) it leaves the focus where the learner put it.
 */
function RevealHeading({ children, focusOnMount }: { children: React.ReactNode; focusOnMount: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <h4 ref={ref} tabIndex={-1} className="text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </h4>
  );
}

function ErrorCard({ error, testId }: { error: LiteralError; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-border bg-muted p-3 text-sm">
      {/* A cross in the danger colour only for what the standard makes illegal; a neutral mark otherwise. */}
      <p data-illegal={error.illegal} className={cn("font-semibold", error.illegal ? "text-danger" : "text-foreground")}>
        <span aria-hidden>{error.illegal ? "✕ " : "ⓘ "}</span>
        {error.illegal ? "Illegal syntax" : "Not decoded here"} <span className="font-normal text-muted-foreground">({error.clause})</span>
      </p>
      <p className="mt-1 break-words text-foreground">{error.message}</p>
      {error.fix ? (
        <p className="mt-1 text-muted-foreground">
          Legal form: <code className={cn("break-all rounded bg-code-surface px-1.5 py-0.5 text-code-foreground", mono)}>{error.fix}</code>
        </p>
      ) : null}
    </div>
  );
}

function legendFor(steps: LiteralStep[]): BitLegendItem[] {
  const items: BitLegendItem[] = [];
  const bits = steps.flatMap((s) => s.shown ?? []);
  if (bits.includes("x")) items.push("x");
  if (bits.includes("z")) items.push("z");
  if (steps.some((s) => s.signBit !== undefined)) items.push("sign");
  if (steps.some((s) => s.extendedFrom !== undefined)) items.push("extended");
  if (steps.some((s) => s.droppedFrom !== undefined)) items.push("dropped");
  if (steps.some((s) => (s.changed ?? []).length > 0)) items.push("changed");
  return items;
}

function StepBody({ step, decode }: { step: LiteralStep; decode: LiteralDecode }) {
  return (
    <>
      <p className="text-sm text-foreground">{step.text}</p>
      {step.id === "tokens" ? (
        <ul aria-label="Parts of the literal" className="mt-2 flex flex-wrap gap-2">
          {decode.parts.map((part) => (
            <li key={part.role} className="rounded-lg border border-border bg-muted px-2 py-1">
              <span className={cn("block text-sm font-medium text-foreground", mono)}>{part.text}</span>
              <span className="block text-xs text-muted-foreground">{part.note}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {step.shown ? (
        <div className="mt-2 max-w-full">
          <BitStrip
            bits={step.shown}
            label={`${step.title}: ${bitsText(step.shown)}`}
            extendedFrom={step.extendedFrom}
            droppedFrom={step.droppedFrom}
            signBit={step.signBit}
            changed={step.changed}
            segments={step.segments}
          />
        </div>
      ) : null}
    </>
  );
}

function StepThrough({ decode, focusOnMount }: { decode: LiteralDecode; focusOnMount: boolean }) {
  const steps = decode.steps;
  const [index, setIndex] = useState(0);
  const sliderId = useId();
  const current = steps[index];
  const atStart = index === 0;
  const atEnd = index === steps.length - 1;
  const visible = steps.slice(0, index + 1);
  const legend = legendFor(visible);

  return (
    <div className="space-y-3" data-testid="literal-reveal">
      <RevealHeading focusOnMount={focusOnMount}>Step through the decoding</RevealHeading>
      <div className={cn("flex flex-wrap items-center gap-2", touchButtons)}>
        <button type="button" className={buttonClass} aria-label="Previous step" aria-disabled={atStart || undefined} onClick={atStart ? undefined : () => setIndex(index - 1)}>
          ←
        </button>
        <label htmlFor={sliderId} className="sr-only">
          Step
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          aria-valuetext={`Step ${index + 1} of ${steps.length}: ${current.title}`}
          onChange={(e) => setIndex(Number(e.target.value))}
          className={scrubberClass}
        />
        <button type="button" className={buttonClass} aria-label="Next step" aria-disabled={atEnd || undefined} onClick={atEnd ? undefined : () => setIndex(index + 1)}>
          →
        </button>
        <button type="button" className={buttonClass} aria-disabled={atEnd || undefined} onClick={atEnd ? undefined : () => setIndex(steps.length - 1)}>
          Show every step
        </button>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Step {index + 1} of {steps.length}: {current.title}
      </p>
      <ol className="space-y-2" aria-label="Decoding steps">
        {visible.map((step, i) => {
          const isCurrent = i === index;
          return (
            <li
              key={step.id}
              data-testid={`step-${step.id}`}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("rounded-lg border p-3", isCurrent ? "border-border border-l-2 border-l-primary bg-muted" : "border-border bg-card")}
            >
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {i + 1}. {step.title}
                </span>{" "}
                · {step.clause}
              </p>
              <div className="mt-1">
                <StepBody step={step} decode={decode} />
              </div>
            </li>
          );
        })}
      </ol>
      {legend.length ? <BitStripLegend items={legend} /> : null}
      {atEnd ? (
        <p data-testid="literal-summary" className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground">
          {decode.summary}
        </p>
      ) : null}
      {decode.notes.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Model notes">
          {decode.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only" aria-live="polite" data-testid="step-announcement">
        {`Step ${index + 1} of ${steps.length}, ${current.title}. ${current.text}${atEnd ? ` ${decode.summary}` : ""}`}
      </p>
    </div>
  );
}

function SyntaxErrors() {
  const cards = useMemo(() => syntaxErrorCards(), []);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <section aria-labelledby="literal-syntax-heading" className="space-y-2">
      <h4 id="literal-syntax-heading" className="text-sm font-semibold text-foreground">
        Two classic syntax errors
      </h4>
      <p className="text-xs text-muted-foreground">Decide whether each line compiles before you open it.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => {
          const isOpen = Boolean(open[card.id]);
          const bodyId = `literal-syntax-${card.id}`;
          return (
            <div key={card.id} className={cn(panel, "space-y-2")}>
              <pre className={cn("overflow-x-auto rounded-lg border border-code-border bg-code-surface px-3 py-2 text-sm text-code-foreground", mono)}>{card.code}</pre>
              <button
                type="button"
                className={buttonClass}
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setOpen((o) => ({ ...o, [card.id]: !isOpen }))}
              >
                {isOpen ? `Hide why for ${card.code}` : `Show why for ${card.code}`}
              </button>
              <div id={bodyId} hidden={!isOpen}>
                {isOpen ? <ErrorCard error={card.error} testId={`syntax-card-${card.id}`} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * How an integer literal becomes bits: size, base, s, x/z digits, padding and
 * truncation, then the target. Predict the stored strip first; the steps and
 * the answer stay hidden until the learner commits.
 */
export default function LiteralDecoder({ preset = "hex-ff", target, presets, allowInput = true, showSyntaxErrors = true, className }: LiteralDecoderProps) {
  const start = literalPreset(preset);
  const [selection, setSelection] = useState<Selection>(start.id);
  const [literal, setLiteral] = useState(start.literal);
  const [targetId, setTargetId] = useState<LiteralTargetId>(target ?? start.target);
  const [draft, setDraft] = useState(start.literal);
  const [custom, setCustom] = useState<string | null>(null);
  const inputId = useId();

  const shownPresets = useMemo(() => (presets ? LITERAL_PRESETS.filter((p) => presets.includes(p.id)) : LITERAL_PRESETS), [presets]);
  const decode = useMemo(() => decodeLiteral(literal, targetId), [literal, targetId]);
  const options = useMemo(() => (decode.ok ? literalPredictionOptions(decode) : []), [decode]);
  const predictionOptions: PredictionOption[] = options.map((o) => ({
    id: o.id,
    correct: o.correct,
    feedback: o.feedback,
    label: (
      <span className="block min-w-0 space-y-1">
        <span className={cn("block break-all text-sm text-foreground", mono)}>{o.label}</span>
        <span aria-hidden className="block">
          <BitStrip bits={o.bits} label={o.label} />
        </span>
      </span>
    ),
  }));

  const presetOptions: SegmentOption<Selection>[] = [
    ...shownPresets.map((p) => ({ value: p.id as Selection, label: p.label })),
    ...(allowInput ? [{
            value: "custom" as Selection,
            label: custom ? `Yours: ${custom.length > 20 ? `${custom.slice(0, 19)}…` : custom}` : "Yours",
            ariaLabel: custom ? `Yours: ${custom}` : "Yours",
            disabled: custom === null,
          }] : []),
  ];

  const choose = (value: Selection) => {
    setSelection(value);
    if (value === "custom") {
      if (custom !== null) setLiteral(custom);
      return;
    }
    const p = literalPreset(value);
    setLiteral(p.literal);
    setDraft(p.literal);
    setTargetId(p.target);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    setCustom(text);
    setSelection("custom");
    setLiteral(text);
  };

  const code = decode.ok ? literalCode(decode.text, targetId) : null;

  return (
    <VisualFrame
      label="Literal decoder: how a literal becomes bits"
      eyebrow="Experiment · predict then reveal"
      title="From a literal to stored bits"
      summary="A literal's size, base, s flag and digits decide its own bits (IEEE 1800-2023 §5.7.1); the target then extends or truncates them (§10.7). Pick a literal and a target, predict the bits, then step through the decoding."
      fidelity="model"
      assumptions={LITERAL_ASSUMPTIONS}
      className={cn(frameClass, className)}
    >
      <div className={cn(panel, "space-y-3", touchButtons)}>
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Literal</p>
          <SegmentedControl label="Literal" options={presetOptions} value={selection} onChange={choose} mono />
        </div>
        {allowInput ? (
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor={inputId} className="text-xs font-medium text-foreground">
                Type a literal
              </label>
              <input id={inputId} className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} autoComplete="off" />
            </div>
            <button type="submit" className={buttonClass}>
              Decode this literal
            </button>
          </form>
        ) : null}
        {/* Always mounted, so a screen reader hears the error when a typed literal fails to decode. */}
        <p className="sr-only" aria-live="polite" data-testid="literal-error-announcement">
          {decode.ok ? "" : `${decode.error.illegal ? "Illegal syntax" : "Not decoded here"} (${decode.error.clause}): ${decode.error.message}`}
        </p>
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Target</p>
          <SegmentedControl
            label="Target"
            options={LITERAL_TARGETS.map((t) => ({ value: t.id, label: t.label }))}
            value={targetId}
            onChange={setTargetId}
            mono
          />
        </div>
      </div>

      {code ? (
        <figure className="overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground">
          <figcaption className="border-b border-code-border px-3 py-2 text-xs text-code-muted">Code</figcaption>
          <pre className={cn("overflow-x-auto p-3 text-sm leading-6", mono)} data-testid="literal-code">
            {code.join("\n")}
          </pre>
        </figure>
      ) : null}

      {!decode.ok ? (
        <ErrorCard error={decode.error} testId="literal-error" />
      ) : options.length >= 2 ? (
        <PredictionPrompt key={`${decode.text}@${targetId}`} question={predictionQuestion(decode.text, targetId)} options={predictionOptions} resetKey={`${decode.text}@${targetId}`} className={touchButtons}>
          <StepThrough key={`${decode.text}@${targetId}`} decode={decode} focusOnMount />
        </PredictionPrompt>
      ) : (
        <div className={cn(panel, "space-y-3")}>
          <p className="text-xs text-muted-foreground">No common misreading gives a different strip for this literal here, so there is nothing to predict.</p>
          <StepThrough key={`${decode.text}@${targetId}`} decode={decode} focusOnMount={false} />
        </div>
      )}

      {showSyntaxErrors ? <SyntaxErrors /> : null}
    </VisualFrame>
  );
}
