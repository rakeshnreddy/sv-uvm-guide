"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  ARG_MODES,
  ARG_MODE_NAMES,
  ADDRESS_DIGITS_NOTE,
  QUESTION_MARK_NOTE,
  READMEM_PRESETS,
  START_ONLY_RANGE_NOTE,
  VERDICT_TEXT,
  argModeLabel,
  callText,
  declarationText,
  getReadmemPreset,
  gradePrediction,
  hexAddress,
  memorySummary,
  runPreset,
  whyItLands,
  type CellVerdict,
  type FileToken,
  type MemoryCell,
  type ReadmemArgMode,
  type ReadmemDiagnostic,
  type ReadmemRun,
} from "@/lib/sv-readmem-model";
import { cn } from "@/lib/utils";

export interface ReadmemLoaderProps {
  /** Preset id: rom-hex, at4, at10, data-hex, short, sized or out-of-range. */
  preset?: string;
  /** Start and finish arguments to begin with; defaults to the preset's own. */
  mode?: ReadmemArgMode;
  /** Show the file picker so the learner can try the other presets. */
  showPresetPicker?: boolean;
}

export const READMEM_ASSUMPTIONS = [
  "Every placement is computed by the sv-readmem-model from IEEE 1800-2023 §21.4 (loading memory array data from a file), with §5.7.1 for the digits of a number and §6.8, Table 6-7 for the x that a logic word holds before anything writes it.",
  "The memory is a one-dimensional unpacked array of logic words indexed from 0, and the call is $readmemh. Multidimensional arrays (§21.4.3), 2-state words (§21.4.2), dynamic and associative arrays (§21.4.1) and $readmemb are not modelled.",
  "Where the file breaks the format (a sized or based number, a bad @ line, any other character), §21.4 says the file shall not hold it but not how a tool reacts. The model stops loading at that token, so later cells keep their old values.",
  "Where loading runs past the highest address or past the finish address, or an @ address lies outside the memory with no range in the call, §21.4 does not say what a tool does with the words left over. The model stops and marks the note as the model's, not the standard's.",
  START_ONLY_RANGE_NOTE,
  ADDRESS_DIGITS_NOTE,
  QUESTION_MARK_NOTE,
  "When an @ outside the call's range terminates the load, §21.4 does not say whether the words already loaded stay; the model keeps them.",
  "Padding a short number and dropping extra digits follow the sized-literal rule of §5.7.1; §21.4 only says x, z and _ work as in source text, so this is the model's reading.",
];

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border bg-card p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-40 motion-reduce:transition-none";
/** A scroll container a keyboard can reach and scroll (it overflows at 390 px). */
const scrollPre = "overflow-x-auto px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";
const selectClass =
  "h-10 min-w-0 max-w-full rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** SegmentedControl and the frame's disclosure size below 40 px: give them a touch target from here. */
const touchTargets = "[@media(pointer:coarse)]:[&_button]:min-h-10 [@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

const verdictHeadingClass = "rounded-sm text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SEVERITY_LABEL: Record<ReadmemDiagnostic["severity"], { glyph: string; text: string; className: string }> = {
  error: { glyph: "✕", text: "Error", className: "text-danger" },
  warning: { glyph: "▲", text: "Warning", className: "text-warning" },
  note: { glyph: "ⓘ", text: "Note", className: "text-muted-foreground" },
};

function DiagnosticLine({ diagnostic }: { diagnostic: ReadmemDiagnostic }) {
  const s = SEVERITY_LABEL[diagnostic.severity];
  return (
    <p className="text-sm text-foreground">
      <span className={cn("mr-1.5 font-medium", s.className)}>
        <span aria-hidden>{s.glyph} </span>
        {s.text}
        {diagnostic.basis === "model" ? " (the model's reading: the standard does not settle this)" : ""}:
      </span>
      {diagnostic.message} <span className="text-muted-foreground">({diagnostic.clause})</span>
    </p>
  );
}

/** X is the rose hatch and Z the amber dash of the visual language; a word holding both reads as X. */
export function cellTone(cell: MemoryCell): "known" | "unknown" | "highz" {
  if (!cell.written || /[xX]/.test(cell.digits)) return "unknown";
  if (/[zZ]/.test(cell.digits)) return "highz";
  return "known";
}

const VERDICT_CLASS: Record<CellVerdict, string> = {
  hit: comparisonStyles.match.className,
  missed: comparisonStyles.mismatch.className,
  extra: comparisonStyles.mismatch.className,
  quiet: "",
};

function FilePane({ run, text, fileName, currentToken, revealed, reachedTokens }: { run: ReadmemRun; text: string; fileName: string; currentToken: number | null; revealed: boolean; reachedTokens: number }) {
  const file = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let at = 0;
    run.tokens.forEach((t: FileToken) => {
      if (t.from > at) parts.push(text.slice(at, t.from));
      const isCurrent = revealed && currentToken === t.index;
      const notReached = revealed && t.index >= reachedTokens && !isCurrent;
      parts.push(
        <span
          key={t.index}
          data-token={t.index}
          data-current={isCurrent ? "true" : undefined}
          className={cn(
            "rounded-sm",
            t.kind === "comment" || notReached ? "text-code-muted" : "text-code-foreground",
            isCurrent && "bg-code-border underline decoration-2 underline-offset-4",
          )}
        >
          {t.text}
        </span>,
      );
      at = t.to;
    });
    if (at < text.length) parts.push(text.slice(at));
    return parts;
  }, [run, text, currentToken, revealed, reachedTokens]);

  return (
    <div className="min-w-0 rounded-xl border border-code-border bg-code-surface">
      <p className="border-b border-code-border px-3 py-1.5 text-xs text-code-muted">{fileName}</p>
      <pre role="region" tabIndex={0} className={cn(scrollPre, mono)} aria-label={`Contents of ${fileName}`} data-testid="readmem-file">
        {file}
      </pre>
    </div>
  );
}

export default function ReadmemLoader({ preset: presetProp, mode: modeProp, showPresetPicker = true }: ReadmemLoaderProps) {
  const headingId = useId();
  const initial = getReadmemPreset(presetProp);
  const [presetId, setPresetId] = useState(initial.id);
  const [mode, setMode] = useState<ReadmemArgMode>(modeProp ?? initial.defaultMode);
  const [picks, setPicks] = useState<Set<number>>(() => new Set());
  const [phase, setPhase] = useState<"predict" | "checked" | "skipped">("predict");
  const [stepIndex, setStepIndex] = useState(0);
  /**
   * Set by the buttons that swap the prediction area for the verdict or back.
   * The button that had the focus unmounts, so the focus moves to what replaces it
   * instead of falling to the page. Changing the file or the arguments leaves the
   * focus where it is, on a control that stays mounted.
   */
  const pendingFocus = useRef<"verdict" | "prompt" | null>(null);
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);

  const preset = getReadmemPreset(presetId);
  const run = useMemo(() => runPreset(preset, mode), [preset, mode]);
  const revealed = phase !== "predict";
  const grade = useMemo(() => gradePrediction(run, picks), [run, picks]);
  const step = run.steps[Math.min(stepIndex, run.steps.length - 1)];
  const lastStep = run.steps.length - 1;
  const reachedTokens = step.tokenIndex !== null ? step.tokenIndex : step.kind === "start" ? 0 : run.tokens.length;

  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "verdict" && phase !== "predict") verdictRef.current?.focus();
    if (target === "prompt" && phase === "predict") promptRef.current?.focus();
  }, [phase]);

  const resetPrediction = () => {
    setPicks(new Set());
    setPhase("predict");
    setStepIndex(0);
  };

  const reveal = (next: "checked" | "skipped") => {
    pendingFocus.current = "verdict";
    setPhase(next);
  };

  const predictAgain = () => {
    pendingFocus.current = "prompt";
    resetPrediction();
  };

  /** A step button at the end of its range stays focusable and does nothing, so the focus never drops out of the frame. */
  const stepTo = (target: number) => () => setStepIndex(Math.max(0, Math.min(lastStep, target)));

  const choosePreset = (id: string) => {
    const next = getReadmemPreset(id);
    setPresetId(next.id);
    setMode(next.defaultMode);
    resetPrediction();
  };

  const chooseMode = (m: ReadmemArgMode) => {
    setMode(m);
    resetPrediction();
  };

  const togglePick = (address: number) => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  const pickedList = [...picks].sort((a, b) => a - b);
  const call = callText(preset.fileName, preset.memory, run.call);
  const pointerText =
    step.pointer >= 0 && step.pointer < run.memory.depth
      ? `Pointer: address ${step.pointer} (@${hexAddress(step.pointer)})`
      : `Pointer: ${step.pointer}, outside ${run.memory.name} [0:${run.memory.depth - 1}]`;

  const liveText = !revealed
    ? `${picks.size === 0 ? "No cells picked" : `Picked: ${pickedList.join(", ")}`}.`
    : // The focused verdict heading already reads the verdict, so the live region carries only the step.
      `Step ${stepIndex + 1} of ${run.steps.length}: ${step.message}`;

  return (
    <VisualFrame
      label="Readmem loader: where $readmemh puts each number"
      eyebrow="Experiment · predict then reveal"
      title="Where $readmemh puts each number"
      summary="The call's start and finish set where the load pointer begins and which way it moves, and an @ line in the file moves the pointer without changing that direction (IEEE 1800-2023 §21.4). Click the cells you think the file will write, then step through the file one token at a time."
      fidelity="model"
      assumptions={READMEM_ASSUMPTIONS}
      className={touchTargets}
    >
      <p role="status" aria-live="polite" className="sr-only" data-testid="readmem-live">
        {liveText}
      </p>

      <div className="grid gap-3">
        {showPresetPicker ? (
          <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <span className="font-medium">File</span>
            <select className={selectClass} value={presetId} onChange={(e) => choosePreset(e.target.value)}>
              {READMEM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="grid gap-1.5">
          <p className="text-sm font-medium text-foreground">Start and finish arguments</p>
          <SegmentedControl
            label="Start and finish arguments"
            value={mode}
            onChange={chooseMode}
            options={ARG_MODES.map((m) => ({
              value: m,
              label: (
                <span>
                  {ARG_MODE_NAMES[m]} <span className={mono}>({argModeLabel(preset, m)})</span>
                </span>
              ),
              ariaLabel: `${ARG_MODE_NAMES[m]}: ${argModeLabel(preset, m)}`,
            }))}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid min-w-0 content-start gap-3">
          <div className="min-w-0 rounded-xl border border-code-border bg-code-surface">
            <p className="border-b border-code-border px-3 py-1.5 text-xs text-code-muted">The call</p>
            <pre role="region" tabIndex={0} aria-label="The call" className={cn(scrollPre, "text-code-foreground", mono)} data-testid="readmem-call">
              {declarationText(preset.memory)}
              {"\n"}
              {call}
            </pre>
          </div>
          <FilePane run={run} text={preset.file} fileName={preset.fileName} currentToken={step.tokenIndex} revealed={revealed} reachedTokens={reachedTokens} />
        </div>

        <div className="grid min-w-0 content-start gap-2">
          <h4 id={headingId} className="text-sm font-semibold text-foreground">
            {preset.memory.name} [0:{preset.memory.depth - 1}]
            {revealed ? ` after step ${stepIndex + 1} of ${run.steps.length}` : ": click where values will land"}
          </h4>
          <ul aria-labelledby={headingId} className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {step.cells.map((cell: MemoryCell) => {
              const a = cell.address;
              const picked = picks.has(a);
              const isPointer = revealed && step.pointer === a;
              // Only a checked prediction is graded: a reveal without predicting shows no verdict marks.
              const verdict = phase === "checked" ? grade.verdicts[a] : "quiet";
              const tone = cellTone(cell);
              const cellBody = (
                <>
                  <span className={cn("block text-xs text-muted-foreground", mono)}>
                    {isPointer ? <span aria-hidden>▸ </span> : null}[{a}] @{hexAddress(a)}
                  </span>
                  <span className={cn("block text-sm", mono)}>{cell.digits}</span>
                  {!revealed && picked ? <span className="block text-xs font-medium text-foreground">● Picked</span> : null}
                  {verdict !== "quiet" ? <span className={cn("block text-xs font-medium", VERDICT_CLASS[verdict])}>{VERDICT_TEXT[verdict]}</span> : null}
                </>
              );
              const cellClass = cn(
                "block w-full min-h-10 rounded-md border px-1.5 py-1 text-left",
                tone === "known" ? "border-border bg-card text-foreground" : valueStyles[tone].className,
                (isPointer || (!revealed && picked)) && "border-l-2 border-l-primary",
              );
              const describe = `Address ${a}, @${hexAddress(a)}: ${cell.written ? `written, ${cell.digits}` : `not written, ${cell.digits}`}${isPointer ? ", load pointer here" : ""}${verdict !== "quiet" ? `, ${VERDICT_TEXT[verdict].slice(2)}` : ""}`;
              return (
                <li key={a} className="min-w-0">
                  {!revealed ? (
                    <button
                      type="button"
                      aria-pressed={picked}
                      aria-label={`Address ${a}, @${hexAddress(a)}`}
                      onClick={() => togglePick(a)}
                      className={cn(cellClass, "transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none")}
                    >
                      {cellBody}
                    </button>
                  ) : (
                    <div className={cellClass} aria-label={describe} role="group" data-testid={`cell-${a}`}>
                      {cellBody}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground" data-testid="readmem-legend">
            Hatched cells hold x bits: {run.steps[0].cells[0].digits} for a logic word that nothing has written (IEEE 1800-2023 §6.8, Table 6-7), or a number written from the file with x digits (IEEE 1800-2023 §21.4). Dashed cells hold a number from the file with z digits and no x. Solid cells hold a fully known number from the file.
          </p>
          {revealed ? (
            <p className="text-sm text-foreground" data-testid="readmem-memory-summary">
              In words: {memorySummary(run, stepIndex)}
            </p>
          ) : null}
        </div>
      </div>

      {!revealed ? (
        <div className={cn(panel, "grid gap-2")}>
          <p ref={promptRef} tabIndex={-1} className="rounded-sm text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="readmem-prompt">
            Predict: which cells will the file write? Click each one ({picks.size === 0 ? "none picked; that is a valid answer" : `picked: ${pickedList.join(", ")}`}).
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={() => reveal("checked")}>
              Check my prediction
            </button>
            <button type="button" className={buttonClass} onClick={() => setPicks(new Set())} aria-disabled={picks.size === 0}>
              Clear picks
            </button>
            <button type="button" className={buttonClass} onClick={() => reveal("skipped")}>
              Reveal without predicting
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={cn(panel, "grid gap-2")} data-testid="readmem-verdict">
            {phase === "checked" ? (
              <>
                <p ref={verdictRef} tabIndex={-1} className={verdictHeadingClass} data-testid="readmem-verdict-heading">
                  <span aria-hidden className={grade.correct ? comparisonStyles.match.className : comparisonStyles.mismatch.className}>
                    {grade.correct ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph}{" "}
                  </span>
                  {grade.headline}
                </p>
                <ul className="grid gap-1 text-sm text-foreground">
                  {grade.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p ref={verdictRef} tabIndex={-1} className={verdictHeadingClass} data-testid="readmem-verdict-heading">
                  Revealed without a prediction.
                </p>
                <p className="text-sm text-foreground">{whyItLands(run)}</p>
              </>
            )}
            <div>
              <button type="button" className={buttonClass} onClick={predictAgain}>
                Predict again
              </button>
            </div>
          </div>

          <div className={cn(panel, "grid gap-3")}>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Step through the file">
              <button type="button" className={buttonClass} onClick={stepTo(0)} aria-disabled={stepIndex === 0}>
                Back to the start
              </button>
              <button type="button" className={buttonClass} onClick={stepTo(stepIndex - 1)} aria-disabled={stepIndex === 0}>
                Previous token
              </button>
              <button type="button" className={buttonClass} onClick={stepTo(stepIndex + 1)} aria-disabled={stepIndex === lastStep}>
                Next token
              </button>
              <button type="button" className={buttonClass} onClick={stepTo(lastStep)} aria-disabled={stepIndex === lastStep}>
                Jump to the end
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={lastStep}
                value={stepIndex}
                onChange={(e) => setStepIndex(Number(e.target.value))}
                aria-label="Load step"
                aria-valuetext={`Step ${stepIndex + 1} of ${run.steps.length}`}
                className="h-10 min-w-0 flex-1 cursor-pointer accent-primary"
              />
              <span className={cn("whitespace-nowrap text-xs tabular-nums text-muted-foreground", mono)} aria-hidden>
                {stepIndex + 1}/{run.steps.length}
              </span>
            </div>
            <div className="grid gap-1" data-testid="readmem-step">
              <p className="text-xs text-muted-foreground">
                Step {stepIndex + 1} of {run.steps.length} · {pointerText}
              </p>
              <p className="text-sm text-foreground">{step.message}</p>
              {step.diagnostics.map((d, i) => (
                <DiagnosticLine key={`${i}-${d.basis}`} diagnostic={d} />
              ))}
            </div>
          </div>

          <div className={cn(panel, "grid gap-1.5")} data-testid="readmem-diagnostics">
            <p className="text-sm font-semibold text-foreground">What the load reports</p>
            {run.diagnostics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No error, warning or note for this file and call.</p>
            ) : (
              run.diagnostics.map((d, i) => <DiagnosticLine key={`${i}-${d.basis}`} diagnostic={d} />)
            )}
          </div>
        </>
      )}
    </VisualFrame>
  );
}
