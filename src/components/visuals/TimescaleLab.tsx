"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { ReorderList } from "@/components/visual-system/ReorderList";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ALL_SCALES,
  CALL_FORM_TEXT,
  CROSS_SCOPE_DEFAULT,
  CROSS_SCOPE_HINTS,
  PRECEDENCE_TEXT,
  READ_TIME_PRESETS,
  ROUNDING_PRESETS,
  WHICH_UNIT_DEFAULT_ORDER,
  WHICH_UNIT_FILES,
  TB_TOP_SCOPE,
  U_SLOW_SCOPE,
  argumentFs,
  arrangeOptions,
  axisForWakes,
  binaryRemark,
  checkScalePair,
  crossScopeCode,
  crossScopeOptions,
  customReadTimeCaller,
  defaultUnitsOptions,
  displayCode,
  effectiveFormat,
  explainLine,
  formatFsAuto,
  formatPercentT,
  formatScale,
  fsToDecimal,
  globalPrecisionDesign,
  globalPrecisionOptions,
  globalPrecisionReport,
  gradeCrossScopeFixes,
  gradeCrossScopeSuspects,
  linesChangedFromPreset,
  percentTArgMatters,
  presetChangeText,
  rationalToDecimal,
  readTimeCode,
  readTimeOptions,
  repeatedWakes,
  resolveTimeScopes,
  roundDelayText,
  roundingOptions,
  runReadTime,
  scale,
  scaleFromExponent,
  scaleText,
  scaleToFs,
  setsFormatBeforeFirstPrint,
  splitPadding,
  thenEveryText,
  tickCount,
  timeunitLine,
  traceCrossScope,
  twoModulesGlobalPrecision,
  unitChipText,
  unitSentence,
  usesPercentT,
  wakeSequenceOptions,
  wakeText,
  whichUnitOptions,
  withPercentTArg,
  type Build,
  type CallForm,
  type Grouping,
  type LabOption,
  type ReadTimeCaller,
  type ReadTimeSnapshot,
  type RoundedDelay,
  type SourceFile,
  type TimeFormat,
  type TimeScale,
  type UnitState,
} from "@/lib/sv-timescale-model";
import { cn } from "@/lib/utils";

export type TimescaleLabMode = "rounding" | "two-modules" | "read-time" | "which-unit" | "global-precision" | "cross-scope";

export interface TimescaleLabProps {
  mode?: TimescaleLabMode;
  /** A preset id of the chosen mode (see the preset lists in sv-timescale-model). */
  preset?: string;
}

export const TIMESCALE_ASSUMPTIONS = [
  "Every value is computed by the sv-timescale-model from IEEE 1800-2023 §3.12.1 (compilation units), §3.14 (units, precision, rounding, precedence, global precision and 1step), §5.6 (identifiers), §5.7.1 and §5.7.2 (integer and real literals), §5.8 (time literals), §6.8 (variable initializers: the clock starts before any procedure), §6.11 (time is an integer type), §6.12 (real and realtime), §6.12.1 (real to integer), §9.4 (delay control), §9.4.1 (x/z and negative delays), §9.4.2 (edge events), §10.8 (passing an argument is assignment-like), §12.7.2 (the repeat loop), §20.3 ($time, $stime, $realtime), §20.4.1 (Table 20-2), §20.4.2 ($printtimescale), §20.4.3 ($timeformat, Table 20-3), §21.2.1 (format specifications), §22.3 (`resetall), §22.7 (`timescale) and Annex A (A.2.2.3 delay values, A.6.5 delay control, A.8.4 primaries, A.8.7 numbers, A.9.3 identifiers).",
  "Arithmetic is exact: delays are decimal strings turned into integer femtoseconds (BigInt), so a half tick is detected exactly. §3.14.1 states no tie rule, so at an exact half tick both round-half-away-from-zero and round-half-to-even are computed and both values are shown when they disagree.",
  "Reading: the model scales a delay by the unit and rounds it to the precision's ticks; §22.7 lists the steps as round, then scale. Neither §3.14.1 nor §22.7 makes an order a rule, and because the precision is relative to the unit (§3.14.1) both orders give the same wake time, which the steps show side by side.",
  "The lab's reasoning, not a rule of the standard: a real literal is held as an IEEE 754 double (§5.7.2), and a time literal is a realtime value (§5.8), which is a real too (§6.12), so a decimal such as 2.85 has no exact binary form. The standard does not say whether rounding to the precision sees the written decimal or the double; the lab rounds the written decimal, and says where a simulator that rounds the double may not see a half tick.",
  "Assumption: a run is shown only while its wake times stay below 2^64 of the element's units. time is a 64-bit unsigned integer (§6.11, Table 6-8), and $time returns a 64-bit time scaled to the calling module's unit (§20.3.1), which is why the limit is counted in the element's own units. §9.4.1 sizes a negative delay like a time variable, and the sources give no rule for time at or beyond 2^64 units, whatever the sign of the delay as written.",
  "The implementation default unit and precision (§3.14.2.3 rule d) are always shown as 'implementation-specific', never as a number.",
  "Assumption: %0t drops the padding. §20.4.3 and §21.2.1.2 do not settle how a %0t field width interacts with $timeformat's minimum_field_width.",
  "Assumption: $stime keeps the low 32 bits of the value already scaled to the caller's unit. §20.3.2 says the low 32 bits of the current simulation time, without saying whether that means scaled or unscaled time.",
  "Assumption: printed digits (%.Nf and %t) come from the exact decimal value, and an exact decimal tie rounds up. A real number is held in binary and the text of §20.4.3 and §21.2.1 states no rounding rule, so a tool may print the last digit differently at such a tie.",
  "Assumption: with no `timescale anywhere in the source, the lab calls the default %t units tool-dependent. Table 20-3 names only the smallest `timescale precision and does not define this case.",
  "Reading: after a `resetall, a compilation-unit timeunit still decides by rule (c). §3.14.2.3 does not mention `resetall, and §22.7 treats it like having no `timescale specified, where rule (c) applies.",
];

const selectClass = "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputClass =
  "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 motion-reduce:transition-none";
const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
/** The shared primitives size some buttons below 40 px (text links, min-h-9 segments): size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const promptClass = touchButtons;
const checkLabelClass = "flex items-center gap-2 text-xs text-foreground [@media(pointer:coarse)]:min-h-10";
const scrubberClass = "h-2 min-w-[120px] flex-1 cursor-pointer accent-cyan-500 [@media(pointer:coarse)]:h-10";
const textButtonClass = "inline-flex items-center text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-10";
/**
 * The frame's "Assumptions and limits" disclosure is a one-line text-xs summary
 * inside the shared FidelityBadge: give it a 40 px target on touch screens from
 * here. Padding rather than flex keeps the summary a list item, so its marker stays.
 */
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

const toPredictionOptions = (options: LabOption[], seed: string): PredictionOption[] => arrangeOptions(options, seed).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }));

const showToolDependent = (text: string) => text.replace(/<tool-dependent>/g, "⟨tool-dependent⟩");

const PADDING_GLYPH = "·";

/**
 * A printed line with its %t padding drawn as glyphs. A screen reader does not
 * speak a run of spaces, and at 390 px a wrapped run hangs off the line end, so
 * two lines that differ only in padding would otherwise read the same.
 */
function OutputText({ text, template }: { text: string; template: string }) {
  return (
    <>
      {splitPadding(showToolDependent(text), template).map((part, i) =>
        part.padding > 0 ? (
          <React.Fragment key={i}>
            <span aria-hidden className="text-muted-foreground">
              {PADDING_GLYPH.repeat(part.padding)}
            </span>
            <span className="sr-only">padded with {part.padding} spaces, then </span>
          </React.Fragment>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

const hasPadding = (text: string, template: string) => splitPadding(text, template).some((part) => part.padding > 0);

function PaddingKey() {
  return (
    <span aria-hidden className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">
      ({PADDING_GLYPH} is one padding space)
    </span>
  );
}

/** Options that are program output: code font, with the %t padding drawn and named. */
const toOutputOptions = (options: LabOption[], seed: string, template: string): PredictionOption[] =>
  arrangeOptions(options, seed).map((o) => ({
    id: o.id,
    label: (
      <span className={cn(mono, "whitespace-pre-wrap break-words text-xs")}>
        <OutputText text={o.label} template={template} />
      </span>
    ),
    correct: o.correct,
    feedback: o.feedback,
  }));

/**
 * One persistent polite live region per lab. It is mounted from the first
 * render, so what is written into it (the first verdict included) is announced;
 * a region that mounts together with its text is silent in most screen readers.
 */
function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="lab-live">
      {text}
    </p>
  );
}

const verdictText = (options: PredictionOption[], committed: string | null): string => {
  const chosen = options.find((o) => o.id === committed);
  const correct = options.find((o) => o.correct);
  if (!chosen) return correct ? `Revealed. ${correct.feedback}` : "";
  if (chosen.correct || !correct) return `${chosen.correct ? "Correct." : "Not quite."} ${chosen.feedback}`;
  return `Not quite. ${chosen.feedback} Why the answer holds: ${correct.feedback}`;
};

/** Mounted inside a prompt's reveal: writes the verdict into the lab's persistent live region, and clears it when the prompt re-arms. */
function VerdictSignal({ options, committed, onSay }: { options: PredictionOption[]; committed: string | null; onSay: (text: string) => void }) {
  useEffect(() => {
    onSay(verdictText(options, committed));
    return () => onSay("");
  }, [options, committed, onSay]);
  return null;
}

/** Mounted only inside the revealed part of a PredictionPrompt, so the parent knows when to show answers. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

/** Takes the focus when it mounts, which is when a reveal opens: the button that had the focus has just gone. */
function RevealHeading({ children, testId = "reveal-heading" }: { children: React.ReactNode; testId?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h4 ref={ref} tabIndex={-1} data-testid={testId} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </h4>
  );
}

/** A panel that scrolls sideways at 390 px. Focusable and named, so a keyboard alone can scroll it in every browser. */
function ScrollRegion({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </div>
  );
}

/** ← or → of a scrubber. At the end it stays focusable and does nothing: a button that disables itself drops the focus out of the lab. */
function StepButton({ label, atEnd, onClick, children }: { label: string; atEnd: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={buttonClass} aria-label={label} aria-disabled={atEnd || undefined} onClick={atEnd ? undefined : onClick}>
      {children}
    </button>
  );
}

/**
 * The shared HintLadder removes its button with the last hint, and the focus
 * would fall to the page body in the middle of the hunt. Until the primitive
 * keeps the focus itself, this wrapper takes it when that happens: after a click
 * inside, once the ladder has no button left and nothing else holds the focus.
 */
function HintFocusKeeper({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const keepFocus = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    // After React has committed the click's update, which may have removed the button.
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const el = ref.current;
      if (!el || el.querySelector("button")) return;
      const active = document.activeElement;
      if (active === null || active === document.body) el.focus();
    }, 0);
  };
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-label="Hints" data-testid="hint-focus" onClick={keepFocus} className={cn("rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </div>
  );
}

/** Back to this lab's first state, with the prediction armed again. Stays mounted, so the focus does not fall out of the lab. */
function StartOver({ onClick }: { onClick: () => void }) {
  return (
    <div>
      <button type="button" className={buttonClass} onClick={onClick}>
        Start over
      </button>
    </div>
  );
}

/** Plain text while the learner is still typing ("#2." is not an error yet); an alert once they leave the field. */
function InputError({ id, settled, children }: { id: string; settled: boolean; children: React.ReactNode }) {
  return (
    <div key={settled ? "settled" : "typing"} id={id} role={settled ? "alert" : undefined} data-testid="input-error" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
      {children}
    </div>
  );
}

function DelayField({ label, value, onChange, invalid, errorId, onEditing }: { label: string; value: string; onChange: (text: string) => void; invalid: boolean; errorId: string; onEditing: (editing: boolean) => void }) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        value={value}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(e) => {
          onEditing(true);
          onChange(e.target.value);
        }}
        onBlur={() => onEditing(false)}
      />
    </Field>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

function ScaleSelect({ label, value, onChange, className }: { label: string; value: TimeScale; onChange: (s: TimeScale) => void; className?: string }) {
  return (
    <Field label={label} className={className}>
      <select
        className={cn(selectClass, mono)}
        value={formatScale(value)}
        onChange={(e) => {
          const next = ALL_SCALES.find((s) => formatScale(s) === e.target.value);
          if (next) onChange(next);
        }}
      >
        {ALL_SCALES.map((s) => (
          <option key={formatScale(s)} value={formatScale(s)}>
            {formatScale(s)}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Layout-only float: the exact BigInt values stay in the model; pixels may be approximate. */
const ratio = (num: bigint, den: bigint): number => Number((num * BigInt(100000)) / den) / 100000;

// ---------------------------------------------------------------------------
// Rounding: a ruler of precision ticks with the scaled delay snapping to a tick
// ---------------------------------------------------------------------------

function TickRuler({ rounded }: { rounded: RoundedDelay }) {
  if (!rounded.scaledFs || !rounded.ticks || rounded.input.kind === "negative") return null;
  const precFs = scaleToFs(rounded.precision);
  const unit = rounded.unit.unit;
  const firstTick = rounded.ticks.down >= BigInt(2) ? rounded.ticks.down - BigInt(2) : BigInt(0);
  const tickCount = 6;
  const W = 360;
  const pad = 30;
  const step = (W - 2 * pad) / (tickCount - 1);
  const xOfTick = (k: bigint) => pad + Number(k - firstTick) * step;
  // The offset from the first drawn tick is taken in BigInt first, so a delay past 2^53 ticks still lands between the right ticks.
  const tickDen = rounded.scaledFs.den * precFs;
  const scaledPos = pad + ratio(rounded.scaledFs.num - firstTick * tickDen, tickDen) * step;
  const targets = rounded.candidatesFs.map((fs) => fs / precFs);
  const isXz = rounded.input.kind === "xz";
  const stays = !rounded.ticks.exactHalf && rounded.ticks.down === rounded.ticks.up;
  const movement = isXz
    ? `An x or z delay is interpreted as zero, so the statement wakes at ${wakeText(rounded)}.`
    : stays
      ? `The scaled delay ${rounded.scaledText} is already on a tick, so it stays at ${wakeText(rounded)}.`
      : `The scaled delay ${rounded.scaledText} sits ${rounded.ticks.exactHalf ? "exactly half way between two ticks" : "between ticks"} and snaps to ${wakeText(rounded)}.`;
  const label = `Ruler of ${formatScale(rounded.precision)} ticks. ${movement}`;
  const caption = rounded.ticks.exactHalf
    ? rounded.toolDependent
      ? "exact half tick: both rules shown (tool-dependent)"
      : "exact half tick: both rules agree"
    : isXz
      ? "x/z is interpreted as zero (§9.4.1)"
      : stays
        ? "already on a tick: nothing to round (§3.14.1)"
        : "rounds to the nearest tick (§3.14.1, §22.7)";
  return (
    <ScrollRegion label="Tick ruler">
      <svg viewBox={`0 0 ${W} 126`} role="img" aria-label={label} className="h-auto min-w-[360px] w-full max-w-[520px] text-foreground">
        <line x1={pad} y1={78} x2={W - pad} y2={78} stroke="currentColor" strokeOpacity="0.7" />
        {Array.from({ length: tickCount }, (_, i) => firstTick + BigInt(i)).map((k) => {
          const x = xOfTick(k);
          const hit = targets.includes(k);
          return (
            <g key={k.toString()}>
              <line x1={x} y1={70} x2={x} y2={86} stroke="currentColor" strokeOpacity={hit ? 1 : 0.6} strokeWidth={hit ? 2 : 1} />
              <text x={x} y={100} fontSize="9" textAnchor="middle" fill="currentColor" fontWeight={hit ? 700 : 400}>
                {fsToDecimal(k * precFs, scale(1, unit))} {unit}
              </text>
              {hit ? <circle cx={x} cy={78} r={5} fill="rgb(16,185,129)" stroke="currentColor" /> : null}
            </g>
          );
        })}
        {targets.map((k) => (
          <line key={`a${k.toString()}`} x1={scaledPos} y1={40} x2={xOfTick(k)} y2={72} stroke="currentColor" strokeOpacity="0.6" strokeDasharray="4 3" />
        ))}
        <circle cx={scaledPos} cy={34} r={5.5} fill="rgb(245,158,11)" stroke="currentColor" />
        <text x={Math.min(Math.max(scaledPos, 70), W - 70)} y={20} fontSize="9.5" textAnchor="middle" fill="currentColor">
          {isXz ? "x/z is treated as 0" : `scaled: ${rounded.scaledText}`}
        </text>
        <text x={W / 2} y={116} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.85">
          {caption}
        </text>
      </svg>
    </ScrollRegion>
  );
}

function RoundingLab({ preset }: { preset?: string }) {
  const initial = ROUNDING_PRESETS.find((p) => p.id === preset) ?? ROUNDING_PRESETS[0];
  const [presetId, setPresetId] = useState(initial.id);
  const [delayText, setDelayText] = useState(initial.delay);
  const [unit, setUnit] = useState<TimeScale>(initial.unit);
  const [precision, setPrecision] = useState<TimeScale>(initial.precision);
  const rounded = useMemo(() => roundDelayText(delayText, unit, precision), [delayText, unit, precision]);
  const binaryNote = binaryRemark(rounded);
  const [attempt, setAttempt] = useState(0);
  const resetKey = `${attempt}|${delayText}|${formatScale(unit)}|${formatScale(precision)}`;
  const options = useMemo(() => toPredictionOptions(roundingOptions(rounded), resetKey), [rounded, resetKey]);
  const current = ROUNDING_PRESETS.find((p) => p.id === presetId);
  const [said, setSaid] = useState("");
  const [editingDelay, setEditingDelay] = useState(false);
  const errorId = useId();

  const applyPreset = (id: string) => {
    const p = ROUNDING_PRESETS.find((x) => x.id === id);
    setPresetId(id);
    if (!p) return;
    setDelayText(p.delay);
    setUnit(p.unit);
    setPrecision(p.precision);
  };
  const custom = <T,>(setter: (v: T) => void) => (v: T) => {
    setPresetId("custom");
    setter(v);
  };

  return (
    <VisualFrame
      label="Timescale lab: rounding a delay"
      eyebrow="Experiment · predict then reveal"
      title="From #d to a wake time"
      summary="The time unit sets the size of a delay and the element's own precision sets the grid it lands on (IEEE 1800-2023 §3.14, §3.14.1). §22.7 lists the steps as round, then scale, and either order gives the same wake time. Pick a unit and precision, write a delay, and predict when the statement runs."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <Field label="Preset" className="col-span-full">
          <select className={selectClass} value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {ROUNDING_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </Field>
        <ScaleSelect label="Time unit" value={unit} onChange={custom(setUnit)} />
        <ScaleSelect label="Time precision" value={precision} onChange={custom(setPrecision)} />
        <DelayField label="Delay (#d or a time literal)" value={delayText} onChange={custom(setDelayText)} invalid={Boolean(rounded.error) && !checkScalePair(unit, precision)} errorId={errorId} onEditing={setEditingDelay} />
      </div>
      {current ? <p className="text-xs text-muted-foreground">{current.source}</p> : null}

      <LiveAnnouncement text={said} />

      {rounded.error ? (
        <InputError id={errorId} settled={!editingDelay}>
          <span aria-hidden>✕ </span>
          {rounded.error}
        </InputError>
      ) : (
        <PredictionPrompt
          className={promptClass}
          resetKey={resetKey}
          question={
            <>
              The element declares <code className={mono}>timeunit {formatScale(unit)}; timeprecision {formatScale(precision)};</code> and runs <code className={mono}>#{delayText.replace(/^#/, "")}</code> at t = 0. When does the next statement run?
            </>
          }
          options={options}
        >
          {({ committed }) => (
            <div className="space-y-3" data-testid="rounding-reveal">
              <VerdictSignal options={options} committed={committed} onSay={setSaid} />
              <RevealHeading>From the written delay to the wake time</RevealHeading>
              {current ? <p className="text-sm text-foreground" data-testid="rounding-note">{current.note}</p> : null}
              <TickRuler rounded={rounded} />
              <dl className={cn("grid gap-2 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]", panel)}>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Written</dt>
                  <dd className={mono}>#{delayText.replace(/^#/, "")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{rounded.input.kind === "xz" ? "Interpreted as zero" : rounded.input.kind === "literal" ? "Converted to the current unit" : "Exact size: number × unit"}</dt>
                  <dd className={mono}>{rounded.scaledText}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{rounded.ticks && rounded.ticks.down !== rounded.ticks.up ? "On the precision grid" : "Wake time"}</dt>
                  <dd className={cn(mono, "font-semibold")}>{wakeText(rounded)}</dd>
                </div>
              </dl>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground" aria-label="How the wake time was computed">
                {rounded.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {rounded.toolDependent ? (
                <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Tool-dependent</span>
                  §3.14.1 states no tie rule. Half away from zero gives {rounded.tie ? tickCount(rounded.tie.awayFromZero) : ""} and half to even gives {rounded.tie ? tickCount(rounded.tie.toEven) : ""}. Keep delays clear of half ticks when two simulators must agree.
                  {binaryNote ? <span className="mt-1 block" data-testid="binary-remark">{binaryNote}</span> : null}
                </p>
              ) : null}
            </div>
          )}
        </PredictionPrompt>
      )}
      <StartOver
        onClick={() => {
          applyPreset(initial.id);
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Two modules: one delay, two units, one absolute axis
// ---------------------------------------------------------------------------

/**
 * Marker labels for one row of the axis (about 4.7 units per character at font
 * size 9). A label that would touch the one before it is dropped: the Wake times
 * list and the figure's name carry every value.
 */
function placeMarkerLabels(marks: { key: string; x: number; text: string }[], W: number) {
  let lastRight = -Infinity;
  return marks.map((m) => {
    const width = m.text.length * 4.7;
    const labelX = Math.min(Math.max(m.x, width / 2), W - width / 2);
    const show = labelX - width / 2 >= lastRight + 3;
    if (show) lastRight = labelX + width / 2;
    return { ...m, labelX, show };
  });
}

const TB_TOP = TB_TOP_SCOPE;
const U_SLOW = U_SLOW_SCOPE;
const scopeText = (s: { unit: TimeScale; precision: TimeScale }) => `${formatScale(s.unit)}/${formatScale(s.precision)}`;

function AbsoluteAxis({ fast, slow, showMarkers }: { fast: { k: number; candidatesFs: bigint[] }[]; slow: { k: number; candidatesFs: bigint[] }[]; showMarkers: boolean }) {
  const all = [...fast, ...slow].flatMap((w) => w.candidatesFs);
  const maxFs = all.reduce((m, v) => (v > m ? v : m), BigInt(0));
  const axis = axisForWakes(maxFs);
  const axisUnit = scale(1, axis.unit);
  const endText = `${fsToDecimal(axis.endFs, axisUnit)} ${axis.unit}`;
  /** The scale grows with the wake times, so before both predictions it would give them away: #5 would end at u_slow's wake. */
  const majors = showMarkers ? axis.majorsFs : [];
  const W = 360;
  const pad = 24;
  const xOf = (fs: bigint) => pad + ratio(fs, axis.endFs) * (W - 2 * pad);
  const describe = (ws: { k: number; candidatesFs: bigint[] }[]) => ws.map((w) => w.candidatesFs.map((c) => formatFsAuto(c)).join(" or ")).join(", then ");
  const label = showMarkers
    ? `Time axis 0 to ${endText}. ${TB_TOP.name} (${scopeText(TB_TOP)}) wakes at ${describe(fast)}; ${U_SLOW.name} (${scopeText(U_SLOW)}) wakes at ${describe(slow)}.`
    : "Time axis; its scale and the wake markers appear after both predictions.";
  const marks = (ws: { k: number; candidatesFs: bigint[] }[], prefix: string) =>
    placeMarkerLabels(
      ws.flatMap((w) => w.candidatesFs.map((fs, ci) => ({ key: `${prefix}${w.k}-${ci}`, x: xOf(fs), text: formatFsAuto(fs) }))),
      W,
    );
  return (
    <ScrollRegion label="Absolute time axis">
      <svg viewBox={`0 0 ${W} 154`} role="img" aria-label={label} className="h-auto min-w-[360px] w-full max-w-[560px] text-foreground">
        <text x={pad} y={14} fontSize="10" fontWeight="600" fill="currentColor">
          ● {TB_TOP.name}: {timeunitLine(TB_TOP)}
        </text>
        <line x1={pad} y1={36} x2={W - pad} y2={36} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
        <text x={pad} y={64} fontSize="10" fontWeight="600" fill="currentColor">
          ◆ {U_SLOW.name}: {timeunitLine(U_SLOW)}
        </text>
        <line x1={pad} y1={86} x2={W - pad} y2={86} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
        {showMarkers
          ? marks(fast, "f").map((m) => (
              <g key={m.key}>
                <line x1={m.x} y1={42} x2={m.x} y2={118} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
                <circle cx={m.x} cy={36} r={5.5} fill="rgb(6,182,212)" stroke="currentColor" />
                {m.show ? (
                  <text x={m.labelX} y={28} fontSize="9" textAnchor="middle" fill="currentColor" data-testid="tb-top-label">
                    {m.text}
                  </text>
                ) : null}
              </g>
            ))
          : null}
        {showMarkers
          ? marks(slow, "s").map((m) => (
              <g key={m.key}>
                <line x1={m.x} y1={93} x2={m.x} y2={118} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
                <path d={`M${m.x},79 L${m.x + 7},86 L${m.x},93 L${m.x - 7},86 Z`} fill="rgb(139,92,246)" stroke="currentColor" />
                {m.show ? (
                  <text x={m.labelX} y={74} fontSize="9" textAnchor="middle" fill="currentColor" data-testid="u-slow-label">
                    {m.text}
                  </text>
                ) : null}
              </g>
            ))
          : null}
        <line x1={pad} y1={122} x2={W - pad} y2={122} stroke="currentColor" strokeOpacity="0.7" />
        {majors.map((m) => (
          <g key={m.toString()}>
            <line x1={xOf(m)} y1={118} x2={xOf(m)} y2={126} stroke="currentColor" strokeOpacity="0.7" />
            <text x={xOf(m)} y={138} fontSize="9.5" textAnchor="middle" fill="currentColor">
              {fsToDecimal(m, axisUnit)}
            </text>
          </g>
        ))}
        <text x={W / 2} y={149} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.85">
          {showMarkers ? `simulation time (${axis.unit})${axis.unit !== "ns" ? ": the axis grew to fit the wake times" : ""}` : "simulation time"}
        </text>
      </svg>
    </ScrollRegion>
  );
}

function TwoModulesLab() {
  const [delayText, setDelayText] = useState("#1.26");
  const [fastRepeats, setFastRepeats] = useState(1);
  const [slowRepeats, setSlowRepeats] = useState(2);
  const [fastRevealed, setFastRevealed] = useState(false);
  const [slowRevealed, setSlowRevealed] = useState(false);
  const onFast = useCallback((v: boolean) => setFastRevealed(v), []);
  const onSlow = useCallback((v: boolean) => setSlowRevealed(v), []);
  const fast = useMemo(() => roundDelayText(delayText, TB_TOP.unit, TB_TOP.precision), [delayText]);
  const slow = useMemo(() => roundDelayText(delayText, U_SLOW.unit, U_SLOW.precision), [delayText]);
  const fastWakes = useMemo(() => repeatedWakes(fast, fastRepeats), [fast, fastRepeats]);
  const slowWakes = useMemo(() => repeatedWakes(slow, slowRepeats), [slow, slowRepeats]);
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}|${delayText}|${fastRepeats}|${slowRepeats}`;
  const fastOptions = useMemo(() => toPredictionOptions(wakeSequenceOptions(fast, fastRepeats, U_SLOW), `fast|${key}`), [fast, fastRepeats, key]);
  const slowOptions = useMemo(() => toPredictionOptions(wakeSequenceOptions(slow, slowRepeats, TB_TOP), `slow|${key}`), [slow, slowRepeats, key]);
  const global = useMemo(() => twoModulesGlobalPrecision(), []);
  const [said, setSaid] = useState("");
  const d = delayText.replace(/^#/, "");
  const [editingDelay, setEditingDelay] = useState(false);
  const errorId = useId();
  const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
  const bothRevealed = fastRevealed && slowRevealed;
  /** x/z and negative delays get no rounding, so the summary names no rule that would hint at the answer. */
  const summary =
    fast.input.kind === "literal"
      ? `${TB_TOP.name} and ${U_SLOW.name} run the same #d from t = 0. A time literal is the same value before rounding in both (§5.8), and each module's own precision rounds it (§3.14.1).`
      : fast.input.kind === "xz" || fast.input.kind === "negative"
        ? `${TB_TOP.name} and ${U_SLOW.name} run the same #d from t = 0. Predict when each one wakes.`
        : `${TB_TOP.name} and ${U_SLOW.name} run the same #d from t = 0. Each module's unit sets the size of the delay, and its own precision sets the grid it lands on (§3.14, §3.14.1).`;
  /** Fewer wakes than runs: a later copy would pass 2^64 units (the model's wakesBelow64Bits). */
  const cutAt64Bits = fastWakes.length < fastRepeats || slowWakes.length < slowRepeats;

  return (
    <VisualFrame
      label="Timescale lab: one delay, two modules"
      eyebrow="Experiment · predict then reveal"
      title="One delay, two modules"
      summary={summary}
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <DelayField label="Delay (#d, run in both modules)" value={delayText} onChange={setDelayText} invalid={Boolean(fast.error)} errorId={errorId} onEditing={setEditingDelay} />
        <Field label="tb_top runs it">
          <select className={selectClass} value={fastRepeats} onChange={(e) => setFastRepeats(Number(e.target.value))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {times(n)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="u_slow runs it">
          <select className={selectClass} value={slowRepeats} onChange={(e) => setSlowRepeats(Number(e.target.value))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {times(n)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <LiveAnnouncement text={said} />
      {fast.error ? (
        <InputError id={errorId} settled={!editingDelay}>
          <span aria-hidden>✕ </span>
          {fast.error}
        </InputError>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            <PredictionPrompt
              className={promptClass}
              resetKey={`fast|${key}`}
              question={
                <>
                  <span aria-hidden>● </span>{TB_TOP.name} (<code className={mono}>{timeunitLine(TB_TOP)}</code>) runs <code className={mono}>#{d}</code> {times(fastRepeats)}. When does it wake?
                </>
              }
              options={fastOptions}
            >
              {({ committed }) => (
                <>
                  <RevealSignal onChange={onFast} />
                  <VerdictSignal options={fastOptions} committed={committed} onSay={setSaid} />
                  <RevealHeading>tb_top&apos;s wake time</RevealHeading>
                  <p className="mt-1 text-sm text-foreground">
                    {fast.scaledText} → <strong>{wakeText(fast)}</strong>
                    {thenEveryText(fast, fastRepeats)} ({fast.special ? "§9.4.1" : "§3.14.1"}).
                  </p>
                </>
              )}
            </PredictionPrompt>
            <PredictionPrompt
              className={promptClass}
              resetKey={`slow|${key}`}
              question={
                <>
                  <span aria-hidden>◆ </span>{U_SLOW.name} (<code className={mono}>{timeunitLine(U_SLOW)}</code>) runs the same <code className={mono}>#{d}</code> {times(slowRepeats)}. When does it wake?
                </>
              }
              options={slowOptions}
            >
              {({ committed }) => (
                <>
                  <RevealSignal onChange={onSlow} />
                  <VerdictSignal options={slowOptions} committed={committed} onSay={setSaid} />
                  <RevealHeading>u_slow&apos;s wake time</RevealHeading>
                  <p className="mt-1 text-sm text-foreground">
                    {slow.scaledText} → <strong>{wakeText(slow)}</strong>
                    {thenEveryText(slow, slowRepeats)} ({slow.special ? "§9.4.1" : "§3.14.1"}).
                  </p>
                </>
              )}
            </PredictionPrompt>
          </div>
          <div className={panel} data-testid="two-modules-axis">
            {!bothRevealed ? <p className="mb-2 text-xs text-muted-foreground">Lock in both predictions to reveal the axis scale and the wake markers.</p> : null}
            <AbsoluteAxis fast={fastWakes} slow={slowWakes} showMarkers={bothRevealed} />
            {bothRevealed ? (
              <ul className="mt-2 space-y-1 text-sm" aria-label="Wake times">
                <li>
                  <span aria-hidden>● </span>tb_top: {fastWakes.map((w) => w.candidatesFs.map((c) => formatFsAuto(c)).join(" or ")).join(", then ")}
                </li>
                <li>
                  <span aria-hidden>◆ </span>u_slow: {slowWakes.map((w) => w.candidatesFs.map((c) => formatFsAuto(c)).join(" or ")).join(", then ")}
                </li>
              </ul>
            ) : null}
          </div>
          {bothRevealed ? (
            <p className="text-xs text-muted-foreground">
              The design&apos;s global precision is <strong>{global ? `${global.magnitude} ${global.unit}` : "implementation-specific"}</strong>, the finer of the two (§3.14.3). It does not help u_slow: each module rounds with its own precision (§3.14.1).
              {cutAt64Bits ? " Only the wakes below 2^64 time units are shown: a later copy of this delay would pass the 64 bits of a time variable, and the sources give no rule for that." : ""}
            </p>
          ) : null}
        </>
      )}
      <StartOver
        onClick={() => {
          setDelayText("#1.26");
          setFastRepeats(1);
          setSlowRepeats(2);
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Reading the time: three aligned rulers, $timeformat controls, %t of $time vs $realtime
// ---------------------------------------------------------------------------

function TripleRuler({ absFs, unit, precision, time }: { absFs: bigint; unit: TimeScale; precision: TimeScale; time: bigint }) {
  const unitFs = scaleToFs(unit);
  const precFs = scaleToFs(precision);
  const unitsSpan = Number(absFs / unitFs) + 2;
  if (unitsSpan > 400) {
    return (
      <p className="text-sm text-muted-foreground">
        {formatFsAuto(absFs)} is {rationalToDecimal({ num: absFs, den: unitFs })} of the caller&apos;s {formatScale(unit)} units: too many to draw as a ruler. $time rounds it to {time.toString()}.
      </p>
    );
  }
  const W = 420;
  const pad = 28;
  const xOfUnits = (u: number) => pad + (u / unitsSpan) * (W - 2 * pad);
  const marker = xOfUnits(ratio(absFs, unitFs));
  const unitStep = Math.max(1, Math.ceil(unitsSpan / 10));
  const precTicksPerUnit = Number(unitFs / precFs);
  const showMinor = precTicksPerUnit * unitsSpan <= 80;
  const baseUnit = unit.unit;
  const label = `Three rulers. Absolute time ${formatFsAuto(absFs)}; in ${formatScale(unit)} units that is ${rationalToDecimal({ num: absFs, den: unitFs })}; $time rounds it to ${time.toString()}.`;
  const rows = [
    { y: 28, name: `absolute time (${baseUnit})`, labelOf: (u: number) => fsToDecimal(BigInt(u) * unitFs, scale(1, baseUnit)) },
    { y: 74, name: `caller units (${formatScale(unit)})`, labelOf: (u: number) => String(u) },
  ];
  const pastMiddle = marker > W / 2;
  return (
    <ScrollRegion label="Three time rulers">
      <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={label} className="h-auto min-w-[420px] w-full max-w-[640px] text-foreground">
        {rows.map((row) => (
          <g key={row.name}>
            <text x={pad} y={row.y - 14} fontSize="9" fill="currentColor" fillOpacity="0.85">
              {row.name}
            </text>
            <line x1={pad} y1={row.y} x2={W - pad} y2={row.y} stroke="currentColor" strokeOpacity="0.7" />
            {Array.from({ length: unitsSpan + 1 }, (_, u) => u).map((u) => (
              <g key={u}>
                <line x1={xOfUnits(u)} y1={row.y - 5} x2={xOfUnits(u)} y2={row.y + 5} stroke="currentColor" strokeOpacity="0.7" />
                {u % unitStep === 0 ? (
                  <text x={xOfUnits(u)} y={row.y + 15} fontSize="9" textAnchor="middle" fill="currentColor">
                    {row.labelOf(u)}
                  </text>
                ) : null}
              </g>
            ))}
            {showMinor && row.y === 28
              ? Array.from({ length: unitsSpan * precTicksPerUnit }, (_, i) => i).map((i) =>
                  i % precTicksPerUnit === 0 ? null : <line key={`m${i}`} x1={xOfUnits(i / precTicksPerUnit)} y1={row.y - 2} x2={xOfUnits(i / precTicksPerUnit)} y2={row.y + 2} stroke="currentColor" strokeOpacity="0.4" />,
                )
              : null}
          </g>
        ))}
        <text x={pad} y={106} fontSize="9" fill="currentColor" fillOpacity="0.85">
          $time (integer, rounded)
        </text>
        {Array.from({ length: unitsSpan + 1 }, (_, k) => k).map((k) => {
          const x0 = xOfUnits(Math.max(0, k - 0.5));
          const x1 = xOfUnits(Math.min(unitsSpan, k + 0.5));
          const hit = BigInt(k) === time;
          return (
            <g key={`b${k}`}>
              <rect x={x0} y={112} width={Math.max(0, x1 - x0)} height={14} fill={hit ? "rgb(16,185,129)" : "currentColor"} fillOpacity={hit ? 0.55 : k % 2 ? 0.14 : 0.06} stroke="currentColor" strokeOpacity="0.3" />
              {k % unitStep === 0 ? (
                <text x={(x0 + x1) / 2} y={138} fontSize="9" textAnchor="middle" fill="currentColor" fontWeight={hit ? 700 : 400}>
                  {k}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={marker} y1={10} x2={marker} y2={128} stroke="rgb(245,158,11)" strokeWidth={2} />
        <circle cx={marker} cy={28} r={4} fill="rgb(245,158,11)" stroke="currentColor" />
        <circle cx={marker} cy={74} r={4} fill="rgb(245,158,11)" stroke="currentColor" />
        <text x={marker} y={8} fontSize="9" textAnchor={pastMiddle ? "end" : "start"} fill="currentColor" fontWeight="600" data-testid="now-label">
          now: {formatFsAuto(absFs)} = {rationalToDecimal({ num: absFs, den: unitFs })} units → $time {time.toString()}
        </text>
      </svg>
    </ScrollRegion>
  );
}

const UNITS_OPTIONS = Array.from({ length: 18 }, (_, i) => 2 - i);

type FormatMode = "default" | "called";

function TimeFormatControls({ mode, setMode, format, setFormat, build, showDefaults }: { mode: FormatMode; setMode: (m: FormatMode) => void; format: TimeFormat; setFormat: (f: TimeFormat) => void; build: Build; showDefaults: boolean }) {
  const def = effectiveFormat(null, build);
  return (
    <div className={cn(panel, "space-y-2")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">$timeformat in force before the code runs</p>
      <SegmentedControl<FormatMode>
        label="$timeformat before the code runs"
        className={touchButtons}
        value={mode}
        onChange={setMode}
        options={[
          { value: "default", label: "not called (Table 20-3 defaults)" },
          { value: "called", label: "called with…" },
        ]}
      />
      {mode === "default" && !showDefaults ? (
        <p className="text-xs text-muted-foreground">The Table 20-3 defaults apply. Predict this moment to see what they are here.</p>
      ) : mode === "default" ? (
        <p className="text-xs text-muted-foreground">
          Table 20-3: units = the smallest `timescale precision in the source, 0 digits, no suffix, minimum width 20. Default units here:{" "}
          {def ? <strong className={mono}>{formatScale(scaleFromExponent(def.units) as TimeScale)}</strong> : <strong>tool-dependent</strong>}
          {def ? "" : " (the source has no `timescale, only timeunit, so Table 20-3 gives no answer)"}.
        </p>
      ) : (
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))]">
          <Field label="units_number">
            <select className={cn(selectClass, mono)} value={format.units} onChange={(e) => setFormat({ ...format, units: Number(e.target.value) })}>
              {UNITS_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u} ({formatScale(scaleFromExponent(u) as TimeScale)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="precision_number">
            <input type="number" min={0} max={9} className={inputClass} value={format.precision} onChange={(e) => setFormat({ ...format, precision: Math.max(0, Math.min(9, Number(e.target.value) || 0)) })} />
          </Field>
          <Field label="suffix_string">
            <input className={inputClass} value={format.suffix} onChange={(e) => setFormat({ ...format, suffix: e.target.value })} />
          </Field>
          <Field label="minimum_field_width">
            <input type="number" min={0} max={40} className={inputClass} value={format.minWidth} onChange={(e) => setFormat({ ...format, minWidth: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
          </Field>
        </div>
      )}
    </div>
  );
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** What the learner did at one moment, kept as it was then: the %t toggle later changes the code. */
interface MomentAnswer {
  /** Null for "revealed without predicting". */
  optionId: string | null;
  correct: boolean | null;
  feedback: string | null;
  /** The $display the learner was asked about. */
  asked: string;
}

/** "tb_top prints after its 1st delay", for the scrubber. */
const momentName = (s: ReadTimeSnapshot) => `${s.caller} prints ${s.delayOrdinal > 0 ? `after its ${ordinal(s.delayOrdinal)} delay` : "before any delay"}`;

/** What the custom caller starts with, and what Start over returns to. */
const CUSTOM_DEFAULT = { unit: scale(10, "ns"), precision: scale(1, "ns"), delays: "#1.55, #1.55" };
const INITIAL_FORMAT: TimeFormat = { units: -9, precision: 3, suffix: " ns", minWidth: 0 };

function ReadTimeLab({ preset }: { preset?: string }) {
  const initial = READ_TIME_PRESETS.find((p) => p.id === preset) ?? READ_TIME_PRESETS[0];
  const [presetId, setPresetId] = useState<string>(initial.id);
  const [unit, setUnit] = useState<TimeScale>(CUSTOM_DEFAULT.unit);
  const [precision, setPrecision] = useState<TimeScale>(CUSTOM_DEFAULT.precision);
  const [delaysText, setDelaysText] = useState(CUSTOM_DEFAULT.delays);
  const [customTimescale, setCustomTimescale] = useState(false);
  const [formatMode, setFormatMode] = useState<FormatMode>("default");
  const [format, setFormat] = useState<TimeFormat>(INITIAL_FORMAT);
  const [arg, setArg] = useState<"realtime" | "time">(initial.arg);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, MomentAnswer>>({});
  const [editingDelays, setEditingDelays] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** The learner has moved between moments, so the live region names the one they landed on. */
  const [moved, setMoved] = useState(false);
  const errorId = useId();
  const advancedId = useId();
  const revealHeading = useRef<HTMLHeadingElement>(null);
  const promptArea = useRef<HTMLDivElement>(null);
  const pendingPromptFocus = useRef(false);
  /** Set by the three actions that open a reveal, so scrubbing back to an answered moment leaves the focus on the scrubber. */
  const pendingRevealFocus = useRef(false);

  const current = READ_TIME_PRESETS.find((p) => p.id === presetId);
  const delayTokens = useMemo(() => delaysText.split(/[,\s]+/).filter(Boolean), [delaysText]);
  const presetCallers: readonly ReadTimeCaller[] = useMemo(() => (current ? current.callers : [customReadTimeCaller(unit, precision, delayTokens)]), [current, unit, precision, delayTokens]);
  const build: Build = useMemo(() => (current ? current.build : { timescalePrecisions: customTimescale ? [precision] : [] }), [current, customTimescale, precision]);
  /** The code's own call before its first print replaces anything set beforehand (§20.4.3), so the control would do nothing. */
  const formatControlDead = useMemo(() => setsFormatBeforeFirstPrint(presetCallers, build), [presetCallers, build]);
  const initialFormat = formatMode === "called" && !formatControlDead ? format : null;
  const callers = useMemo(() => withPercentTArg(presetCallers, arg), [presetCallers, arg]);
  const trace = useMemo(() => runReadTime(callers, build, initialFormat), [callers, build, initialFormat]);
  const code = useMemo(() => readTimeCode(callers, build, initialFormat), [callers, build, initialFormat]);
  const hasPercentT = useMemo(() => usesPercentT(presetCallers), [presetCallers]);
  const argMatters = useMemo(() => percentTArgMatters(presetCallers, build, initialFormat), [presetCallers, build, initialFormat]);
  /** A preset's summary and outcome describe its own code: while this is set they would contradict the code on screen. */
  const changeText = useMemo(() => (current ? presetChangeText(current, arg, initialFormat) : null), [current, arg, initialFormat]);
  // Any change to the code or its $timeformat changes the answers: forget the predictions and return to the first moment. The %t toggle is a comparison, so it keeps them.
  const experimentKey = `${attempt}|${presetId}|${formatScale(unit)}|${formatScale(precision)}|${delaysText}|${customTimescale}|${JSON.stringify(initialFormat)}`;
  const [lastExperimentKey, setLastExperimentKey] = useState(experimentKey);
  if (experimentKey !== lastExperimentKey) {
    setLastExperimentKey(experimentKey);
    setAnswers({});
    setSnapshotIndex(0);
    setMoved(false);
  }
  /** The %t toggle shows where the two arguments print differently, or while it is away from the preset's own argument, so it can be undone. */
  const toggleWanted = hasPercentT && (argMatters || arg !== (current?.arg ?? "realtime"));
  /**
   * Once shown, it stays for the rest of this experiment: pressing it back to the
   * preset's argument where the two print alike would otherwise remove the very
   * control that holds the focus.
   */
  const [toggleShownFor, setToggleShownFor] = useState<string | null>(null);
  if (toggleWanted && toggleShownFor !== experimentKey) setToggleShownFor(experimentKey);
  const showToggle = hasPercentT && (toggleWanted || toggleShownFor === experimentKey);

  const count = trace.snapshots.length;
  const idx = count ? Math.min(snapshotIndex, count - 1) : 0;
  const snapshot: ReadTimeSnapshot | undefined = trace.snapshots[idx];
  const isRevealed = (i: number) => Boolean(answers[i]);
  const promptKey = `${experimentKey}|${idx}|${arg}`;
  const options = useMemo(() => (snapshot ? readTimeOptions(snapshot, build) : []), [snapshot, build]);
  const template = snapshot?.template ?? "";
  const predictionOptions = useMemo(() => toOutputOptions(options, promptKey, template), [options, promptKey, template]);
  const answer = answers[idx];
  /** What this moment prints now: the log's own line, so the two can never differ. */
  const printedLine = trace.lines.find((l) => l.momentIndex === idx);
  const explanation = useMemo(() => (snapshot ? explainLine(snapshot, build) : null), [snapshot, build]);
  const allRevealed = trace.snapshots.every((_, i) => isRevealed(i));
  const announcement =
    snapshot && answer
      ? [
          answer.optionId ? `${answer.correct ? "Correct." : "Not quite."} ${answer.feedback}` : "Revealed without predicting.",
          printedLine ? `Prints ${showToolDependent(printedLine.text)}.` : "",
          explanation?.what ?? "",
          explanation?.why ?? "",
        ].join(" ")
      : snapshot && moved
        ? `Moment ${idx + 1} of ${count}: predict what ${snapshot.caller} prints.`
        : "";
  const askedNow = snapshot ? displayCode(snapshot.template, snapshot.args) : "";

  const record = useCallback(
    (optionId: string | null) => {
      pendingRevealFocus.current = true;
      const option = options.find((o) => o.id === optionId);
      setAnswers((a) => (a[idx] ? a : { ...a, [idx]: { optionId, correct: option?.correct ?? null, feedback: option?.feedback ?? null, asked: askedNow } }));
    },
    [idx, options, askedNow],
  );
  const onSkip = useCallback(
    (revealed: boolean) => {
      if (revealed) record(null);
    },
    [record],
  );
  const revealAll = () => {
    pendingRevealFocus.current = true;
    setAnswers((a) =>
      Object.fromEntries(trace.snapshots.map((s, i) => [i, a[i] ?? { optionId: null, correct: null, feedback: null, asked: displayCode(s.template, s.args) }])),
    );
  };
  useEffect(() => {
    if (pendingRevealFocus.current && revealHeading.current) {
      pendingRevealFocus.current = false;
      revealHeading.current.focus();
    }
  }, [answers]);
  const goToMoment = (i: number) => {
    setSnapshotIndex(i);
    setMoved(true);
  };
  /** The next moment still to predict, after this one first. */
  const nextToPredict = useMemo(() => {
    const unanswered = trace.snapshots.map((_, i) => i).filter((i) => !answers[i]);
    return unanswered.find((i) => i > idx) ?? unanswered[0] ?? null;
  }, [trace.snapshots, answers, idx]);
  useEffect(() => {
    if (pendingPromptFocus.current && promptArea.current) {
      pendingPromptFocus.current = false;
      promptArea.current.focus();
    }
  }, [idx]);

  const choosePreset = (id: string) => {
    setPresetId(id);
    setFormatMode("default");
    const p = READ_TIME_PRESETS.find((x) => x.id === id);
    if (p) setArg(p.arg);
  };

  const questionFor = (s: ReadTimeSnapshot, statement: string, withKey = false) => (
    <>
      <code className={mono}>{s.caller}</code> (<code className={mono}>{formatScale(s.unit)}</code> unit, <code className={mono}>{formatScale(s.precision)}</code> precision){s.afterDelay ? (
        <>
          , after its {ordinal(s.delayOrdinal)} delay, <code className={mono}>#{s.afterDelay.input.text.replace(/^#/, "")}</code>,
        </>
      ) : null}{" "}
      runs <code className={cn(mono, "break-words")}>{statement}</code> What does it print?
      {withKey && paddedOption ? <PaddingKey /> : null}
    </>
  );
  const delaysInvalid = !current && !checkScalePair(unit, precision) && delayTokens.some((d) => roundDelayText(d, unit, precision).error);
  const paddedOption = options.some((o) => hasPadding(o.label, template));

  return (
    <VisualFrame
      label="Timescale lab: reading the time"
      eyebrow="Experiment · predict then reveal"
      title="$time, $stime, $realtime and %t"
      summary="All three functions report in the caller's time unit (§20.3). %t converts to the $timeformat units (§20.4.3). Predict each line of the code, one print at a time; the log fills in as you go."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <Field label="Preset" className="col-span-full">
          <select className={selectClass} value={presetId} onChange={(e) => choosePreset(e.target.value)}>
            {READ_TIME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom caller</option>
          </select>
        </Field>
        {!current ? (
          <>
            <ScaleSelect label="Caller's time unit" value={unit} onChange={setUnit} />
            <ScaleSelect label="Caller's time precision" value={precision} onChange={setPrecision} />
            <DelayField label="Delay sequence" value={delaysText} onChange={setDelaysText} invalid={delaysInvalid} errorId={errorId} onEditing={setEditingDelays} />
            <label className={cn(checkLabelClass, "self-end")}>
              <input type="checkbox" checked={customTimescale} onChange={(e) => setCustomTimescale(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
              the build has a `timescale with this precision
            </label>
          </>
        ) : null}
      </div>
      {current ? (
        <p className="text-xs text-muted-foreground" data-testid="preset-summary">
          {changeText ?? current.summary}
        </p>
      ) : null}

      {snapshot ? <CodeTrace label="The code this run executes" lines={code} activeKey={snapshot.lineKey} contextKeys={snapshot.delayKey ? [snapshot.delayKey] : []} /> : null}
      {!snapshot && trace.errors.length ? <CodeTrace label="The code, which cannot run" lines={code} /> : null}

      {!current && delayTokens.length === 0 ? (
        <p className={cn(panel, "text-sm text-muted-foreground")} data-testid="empty-delays">
          Type at least one delay above, such as <code className={mono}>#1.55</code>, to give the code something to run.
        </p>
      ) : null}

      {!formatControlDead && !trace.errors.length ? (
        <div className="space-y-2">
          <button type="button" className={textButtonClass} aria-expanded={showAdvanced} aria-controls={advancedId} onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide advanced" : "Show advanced"}: set $timeformat before the code runs
          </button>
          <div id={advancedId} hidden={!showAdvanced}>
            {showAdvanced ? <TimeFormatControls mode={formatMode} setMode={setFormatMode} format={format} setFormat={setFormat} build={build} showDefaults={isRevealed(idx)} /> : null}
          </div>
        </div>
      ) : null}

      {trace.errors.length ? (
        <InputError id={errorId} settled={!editingDelays}>
          <ul className="space-y-1">
            {trace.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </InputError>
      ) : null}

      <LiveAnnouncement text={announcement} />

      {snapshot ? (
        <>
          <div role="group" aria-label="Moment scrubber" className="flex flex-wrap items-center gap-2">
            <StepButton label="Previous moment" atEnd={idx <= 0} onClick={() => goToMoment(idx - 1)}>
              ←
            </StepButton>
            <input
              type="range"
              min={0}
              max={Math.max(0, count - 1)}
              value={idx}
              onChange={(e) => goToMoment(Number(e.target.value))}
              aria-label="Moment"
              aria-valuetext={`Moment ${idx + 1} of ${count}: ${momentName(snapshot)}${isRevealed(idx) ? `, at ${formatFsAuto(snapshot.readings.absFs)}` : ", not yet predicted"}`}
              className={scrubberClass}
            />
            <StepButton label="Next moment" atEnd={idx >= count - 1} onClick={() => goToMoment(idx + 1)}>
              →
            </StepButton>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
              {idx + 1}/{count}
            </span>
            {!allRevealed ? (
              <button type="button" onClick={revealAll} className={textButtonClass}>
                Reveal every moment
              </button>
            ) : null}
          </div>

          {!isRevealed(idx) ? (
            <div ref={promptArea} tabIndex={-1} data-testid="moment-prompt" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PredictionPrompt
                key={promptKey}
                resetKey={promptKey}
                className={promptClass}
                question={questionFor(snapshot, askedNow, true)}
                options={predictionOptions}
                onCommit={(optionId) => record(optionId)}
              >
                <RevealSignal onChange={onSkip} />
              </PredictionPrompt>
            </div>
          ) : null}

          {isRevealed(idx) ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.05] p-4" data-testid="read-time-reveal">
              <>
                <h4 ref={revealHeading} tabIndex={-1} data-testid="reveal-heading" className="text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="mr-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">Moment {idx + 1}</span>
                  {/* The question the verdict below answers, even after the %t argument is toggled. */}
                  {questionFor(snapshot, answer?.asked ?? askedNow)}
                </h4>
                {answer?.optionId ? (
                  <p className={cn("text-sm", answer.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    <strong>{answer.correct ? "Correct." : "Not quite. "}</strong>
                    {answer.correct ? null : answer.feedback}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Revealed without predicting.</p>
                )}
                {answer && answer.asked !== askedNow ? (
                  <p className="text-sm text-muted-foreground" data-testid="asked-changed">
                    Your answer was for the statement above. The %t toggle has changed the code since, so this line now prints:
                  </p>
                ) : null}
                {printedLine ? (
                  <p className={cn("text-sm text-foreground", mono, "whitespace-pre-wrap break-words")} data-testid="moment-prints" data-line={printedLine.text}>
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prints </span>
                    <OutputText text={printedLine.text} template={snapshot.template} />
                    {hasPadding(printedLine.text, snapshot.template) ? <PaddingKey /> : null}
                  </p>
                ) : null}
                <TripleRuler absFs={snapshot.readings.absFs} unit={snapshot.unit} precision={snapshot.precision} time={snapshot.readings.time} />
                {explanation ? (
                  <div className="space-y-1 text-sm" data-testid="moment-explanation">
                    <p className="text-foreground">
                      <strong>What: </strong>
                      {explanation.what}
                    </p>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">Why: </strong>
                      {explanation.why}
                    </p>
                  </div>
                ) : null}
                {snapshot.notes.length ? (
                  <ul className="space-y-1 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100" aria-label="Notes on this run" data-testid="run-notes">
                    {snapshot.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
                {nextToPredict !== null ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      pendingPromptFocus.current = true;
                      goToMoment(nextToPredict);
                    }}
                  >
                    Predict moment {nextToPredict + 1}
                  </button>
                ) : null}
              </>
            </div>
          ) : null}

          <ScrollRegion label="Time readings of every moment">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Every moment with its time readings, %t shown without its padding; moments you have not predicted yet are hidden</caption>
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Moment</th>
                  <th className="py-1 pr-2">Caller</th>
                  <th className="py-1 pr-2">Absolute</th>
                  <th className="py-1 pr-2">$time</th>
                  <th className="py-1 pr-2">$stime</th>
                  <th className="py-1 pr-2">$realtime</th>
                  {hasPercentT ? (
                    <>
                      <th className={cn("py-1 pr-2", arg === "time" && "text-foreground")}>%t of $time</th>
                      <th className={cn("py-1 pr-2", arg === "realtime" && "text-foreground")}>%t of $realtime</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className={mono}>
                {trace.snapshots.map((s, i) => {
                  const fmt = effectiveFormat(s.format, build);
                  const t = (which: "time" | "realtime") => (fmt ? formatPercentT(argumentFs(s.readings, which, s.unit), fmt, true) : "tool-dependent");
                  return (
                    <tr key={i} aria-current={i === idx ? "true" : undefined} className={cn("border-t border-border/50", i === idx && "bg-cyan-500/10")}>
                      <td className="py-1 pr-2">
                        {i === idx ? <span aria-hidden>▶ </span> : null}
                        {i + 1}
                      </td>
                      <td className="py-1 pr-2">{s.caller}</td>
                      {isRevealed(i) ? (
                        <>
                          <td className="py-1 pr-2">{formatFsAuto(s.readings.absFs)}</td>
                          <td className="py-1 pr-2">{s.readings.time.toString()}</td>
                          <td className="py-1 pr-2">
                            {s.readings.stime.toString()}
                            {s.readings.stimeWrapped ? " (wrapped)" : ""}
                          </td>
                          <td className="py-1 pr-2">{rationalToDecimal(s.readings.realtime)}</td>
                          {hasPercentT ? (
                            <>
                              <td className={cn("py-1 pr-2", arg === "time" && "font-semibold")}>{t("time")}</td>
                              <td className={cn("py-1 pr-2", arg === "realtime" && "font-semibold")}>{t("realtime")}</td>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <td colSpan={hasPercentT ? 6 : 4} className="py-1 pr-2 font-sans text-muted-foreground">
                          predict moment {i + 1} to reveal it
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollRegion>
          {hasPercentT ? <p className="text-xs text-muted-foreground">The %t columns leave out any padding; the log below shows it.</p> : null}
          {showToggle ? (
            <div className="space-y-2">
              <SegmentedControl<"realtime" | "time">
                label="%t argument"
                mono
                className={touchButtons}
                value={arg}
                onChange={setArg}
                options={[
                  { value: "realtime", label: "%t of $realtime" },
                  { value: "time", label: "%t of $time" },
                ]}
              />
              {isRevealed(idx) ? (
                <p className="text-xs text-muted-foreground" data-testid="percent-t-note">
                  {argMatters
                    ? "%t of $time has already lost the fraction (§20.3.1); %t of $realtime keeps it (§20.3.3). The toggle rewrites the code and the log, and the last two columns compare both."
                    : trace.lines.some((l) => l.toolDependent)
                      ? "%t of $time and %t of $realtime print the same text here, because the %t units are tool-dependent either way. The toggle still rewrites the code."
                      : "%t of $time and %t of $realtime print the same text at this format: every %t line runs at a whole number of the caller's units, or the format's digits hide the fraction. The toggle still rewrites the code."}
                </p>
              ) : null}
            </div>
          ) : hasPercentT && isRevealed(idx) ? (
            <p className="text-xs text-muted-foreground" data-testid="percent-t-note">
              {trace.lines.some((l) => l.toolDependent)
                ? "%t of $time and %t of $realtime print the same text here, because the %t units are tool-dependent either way, so there is nothing to toggle."
                : "%t of $time and %t of $realtime print the same text here, so there is nothing to toggle: every %t line runs at a whole number of the caller's units, or its format's digits hide the fraction."}
            </p>
          ) : null}
          <figure className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
            <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Log, as the code prints it</figcaption>
            <pre role="region" tabIndex={0} aria-label="Printed log" className={cn("overflow-x-auto p-3 text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", mono)}>
              {trace.lines.map((l, i) =>
                isRevealed(l.momentIndex) ? (
                  <div key={i}>
                    <span className="text-slate-400">{`t = ${formatFsAuto(l.absFs)}`.padEnd(14)}</span>
                    {showToolDependent(l.text)}
                  </div>
                ) : (
                  <div key={i} className="text-slate-400">
                    {`t = ?`.padEnd(14)}⟨{l.caller}: predict moment {l.momentIndex + 1} to reveal this line⟩
                  </div>
                ),
              )}
            </pre>
          </figure>
          {trace.lines.some((l) => l.toolDependent && isRevealed(l.momentIndex)) ? (
            <p className="text-xs text-amber-900 dark:text-amber-100">
              ⟨tool-dependent⟩: no $timeformat was called and the source has no `timescale, so Table 20-3 gives no default units. Call $timeformat once at time 0.
            </p>
          ) : null}
          {current && allRevealed && !changeText ? (
            <p className="text-sm text-foreground" data-testid="preset-outcome">
              {current.outcome}
            </p>
          ) : null}
          {current && allRevealed && changeText ? (
            <p className="text-sm text-foreground" data-testid="preset-changed">
              {linesChangedFromPreset(current, trace.lines)} of {trace.lines.length} log lines print differently from the preset&apos;s own code.
            </p>
          ) : null}
        </>
      ) : null}
      <StartOver
        onClick={() => {
          setAttempt((n) => n + 1);
          setArg(initial.arg);
          setFormatMode("default");
          setFormat(INITIAL_FORMAT);
          setShowAdvanced(false);
          setUnit(CUSTOM_DEFAULT.unit);
          setPrecision(CUSTOM_DEFAULT.precision);
          setDelaysText(CUSTOM_DEFAULT.delays);
          setCustomTimescale(false);
          setMoved(false);
          setPresetId(initial.id);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Which unit applies: compilation units, `timescale, `resetall, precedence
// ---------------------------------------------------------------------------

function WhichUnitLab() {
  const [order, setOrder] = useState<string[]>([...WHICH_UNIT_DEFAULT_ORDER]);
  const [grouping, setGrouping] = useState<Grouping>("one");
  const [revealed, setRevealed] = useState(false);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);
  const includeCu = order.includes("cu");
  const includeReset = order.includes("reset");
  const files = useMemo(() => order.map((id) => WHICH_UNIT_FILES.find((f) => f.id === id)).filter((f): f is SourceFile => Boolean(f)), [order]);
  const resolution = useMemo(() => resolveTimeScopes(files, grouping), [files, grouping]);
  const [attempt, setAttempt] = useState(0);
  const resetKey = `${attempt}|${order.join(",")}|${grouping}`;
  const options = useMemo(() => toPredictionOptions(whichUnitOptions(resolution), resetKey), [resolution, resetKey]);
  const [said, setSaid] = useState("");
  const items = files.map((f) => ({
    id: f.id,
    label: f.label,
    description: (
      <pre className={cn("whitespace-pre-wrap text-[11px] leading-5", mono)}>{f.code.join("\n")}</pre>
    ),
  }));

  const toggleCu = (on: boolean) => setOrder((o) => (on ? ["cu", ...o.filter((id) => id !== "cu")] : o.filter((id) => id !== "cu")));
  const toggleReset = (on: boolean) =>
    setOrder((o) => {
      if (!on) return o.filter((id) => id !== "reset");
      const without = o.filter((id) => id !== "reset");
      const at = without.indexOf("a") + 1;
      return [...without.slice(0, at), "reset", ...without.slice(at)];
    });

  return (
    <VisualFrame
      label="Timescale lab: which unit applies"
      eyebrow="Experiment · predict then reveal"
      title="Which time unit applies to b.sv?"
      summary="Reorder the files, choose how the tool groups them into compilation units (§3.12.1), and predict b's unit. The model applies the precedence rules of §3.14.2.3 to every design element."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl<Grouping>
          label="Compilation units"
          className={touchButtons}
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: "one", label: "one compilation unit" },
            { value: "each", label: "each file its own" },
          ]}
        />
        <label className={checkLabelClass}>
          <input type="checkbox" checked={includeReset} onChange={(e) => toggleReset(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          include a `resetall file
        </label>
        <label className={checkLabelClass}>
          <input type="checkbox" checked={includeCu} onChange={(e) => toggleCu(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          include a compilation-unit timeunit (kept first: §3.14.2.2)
        </label>
      </div>
      <ReorderList items={items} order={order} onChange={setOrder} label="Compile order of the source files" lockedIds={includeCu ? ["cu"] : []} />
      <PredictionPrompt
        className={promptClass}
        resetKey={resetKey}
        question={
          <>
            Compiled in this order as {grouping === "one" ? "one compilation unit" : "separate compilation units, one per file"}: which time unit does <code className={mono}>module b</code> get?
          </>
        }
        options={options}
      >
        {({ committed }) => (
          <>
            <RevealSignal onChange={onReveal} />
            <VerdictSignal options={options} committed={committed} onSay={setSaid} />
          </>
        )}
      </PredictionPrompt>
      <LiveAnnouncement text={said} />
      {revealed ? (
        <div className="space-y-3" data-testid="which-unit-reveal">
          <RevealHeading>The unit of every design element</RevealHeading>
          <ScrollRegion label="Resolved unit and precision of every design element">
            <table className="w-full min-w-[640px] text-left text-xs">
              <caption className="sr-only">Resolved unit and precision of every design element</caption>
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Element</th>
                  <th className="py-1 pr-2">Unit</th>
                  <th className="py-1 pr-2">Precision</th>
                  <th className="py-1 pr-2">Decided by</th>
                  <th className="py-1 pr-2">Compilation unit</th>
                </tr>
              </thead>
              <tbody>
                {resolution.elements.map((e) => (
                  <tr key={e.id} aria-current={e.path === "b" ? "true" : undefined} className={cn("border-t border-border/50 align-top", e.path === "b" && "bg-cyan-500/10")}>
                    <td className={cn("py-1 pr-2", mono)}>
                      {e.path === "b" ? <span aria-hidden>▶ </span> : null}
                      {e.elementKind} {e.path}
                    </td>
                    <td className={cn("py-1 pr-2", mono, !e.unit && "text-amber-800 dark:text-amber-200")}>{scaleText(e.unit)}</td>
                    <td className={cn("py-1 pr-2", mono, !e.precision && "text-amber-800 dark:text-amber-200")}>{scaleText(e.precision)}</td>
                    <td className="py-1 pr-2">
                      <div>unit: {PRECEDENCE_TEXT[e.unitRule]}</div>
                      <div className="text-muted-foreground">{e.unitSource}</div>
                      {e.precisionRule !== e.unitRule || e.precisionSource !== e.unitSource ? (
                        <>
                          <div>precision: {PRECEDENCE_TEXT[e.precisionRule]}</div>
                          <div className="text-muted-foreground">{e.precisionSource}</div>
                        </>
                      ) : null}
                    </td>
                    <td className="py-1 pr-2">{grouping === "one" ? "1 (all files)" : String(e.compilationUnit + 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          {resolution.errors.length ? (
            <ul className="space-y-1" aria-label="Errors">
              {resolution.errors.map((err, i) => (
                <li key={i} className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-900 dark:text-rose-100">
                  <span aria-hidden>✕ </span>
                  {err.message} <span className="text-xs">({err.clause}: {err.toolNote})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              <span aria-hidden>✓ </span>No mixed specification: every design element has a unit and a precision (§3.14.2.3).
            </p>
          )}
          <p className="text-sm text-foreground">
            Global precision (§3.14.3): <strong className={mono}>{resolution.globalPrecision ? formatScale(resolution.globalPrecision) : "implementation-specific"}</strong>
            {resolution.globalPrecisionSources.length ? <span className="text-muted-foreground"> from {resolution.globalPrecisionSources.join("; ")}</span> : null}. Elements on the implementation default contribute nothing the standard can name.
          </p>
        </div>
      ) : null}
      <StartOver
        onClick={() => {
          setOrder([...WHICH_UNIT_DEFAULT_ORDER]);
          setGrouping("one");
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Global precision and 1step
// ---------------------------------------------------------------------------

function GlobalPrecisionLab() {
  const [withVendor, setWithVendor] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [unitsRevealed, setUnitsRevealed] = useState(false);
  /** The vendor column answers both predictions, so it stays hidden until both are made; toggling back does not hide it again. */
  const [vendorRevealed, setVendorRevealed] = useState(false);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);
  const onUnitsReveal = useCallback(
    (v: boolean) => {
      setUnitsRevealed(v);
      if (v && withVendor) setVendorRevealed(true);
    },
    [withVendor],
  );
  const before = useMemo(() => globalPrecisionReport(false), []);
  const after = useMemo(() => globalPrecisionReport(true), []);
  const report = withVendor ? after : before;
  const [attempt, setAttempt] = useState(0);
  const resetKey = `${attempt}|${withVendor}`;
  const options = useMemo(() => toPredictionOptions(globalPrecisionOptions(withVendor), resetKey), [withVendor, resetKey]);
  const unitsOptions = useMemo(() => toPredictionOptions(defaultUnitsOptions(withVendor), `units|${resetKey}`), [withVendor, resetKey]);
  const design = useMemo(() => globalPrecisionDesign(withVendor), [withVendor]);
  const tbFile = design.find((f) => f.id === "tb");
  const vendorFile = design.find((f) => f.id === "vendor");
  const [said, setSaid] = useState("");
  const unitsText = (s: TimeScale | null) => (s ? formatScale(s) : "tool-dependent: Table 20-3 does not define it with no `timescale in the source");
  const rows: { label: string; clause: string; before: string; after: string }[] = [
    { label: "$printtimescale($root)", clause: "§20.4.2", before: before.printtimescaleRoot, after: after.printtimescaleRoot },
    { label: "1step", clause: "§3.14.3", before: before.oneStep, after: after.oneStep },
    { label: "default %t units", clause: "Table 20-3", before: unitsText(before.defaultPercentTUnits), after: unitsText(after.defaultPercentTUnits) },
    ...before.moduleRounding.map((m, i) => ({ label: `${m.name} runs #1.26 (${formatScale(m.unit)}/${formatScale(m.precision)})`, clause: "§3.14.1", before: m.wake, after: after.moduleRounding[i]?.wake ?? m.wake })),
  ];

  return (
    <VisualFrame
      label="Timescale lab: global precision and 1step"
      eyebrow="Experiment · predict then reveal"
      title="One file changes the global precision"
      summary="The global precision is the minimum over every timeprecision, every timeunit precision argument and the smallest `timescale precision in the design (§3.14.3). Add one vendor model and predict what moves."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <CodeTrace label="tb.sv (timeunit and timeprecision, no `timescale)" lines={(tbFile?.code ?? []).map((text) => ({ text }))} />
        <div className="space-y-2">
          <label className={cn(panel, "flex cursor-pointer items-start gap-2 text-sm text-foreground")}>
            <input type="checkbox" checked={withVendor} onChange={(e) => setWithVendor(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-500" />
            <span>
              Add <code className={mono}>vendor_model.sv</code>, compiled under <code className={mono}>`timescale 1ns/1fs</code>. slow_gen and tb_top keep their own timeunit and timeprecision; vendor_model takes both from the directive.
            </span>
          </label>
          <CodeTrace label="vendor_model.sv" lines={vendorFile ? vendorFile.code.map((text) => ({ text })) : [{ text: "// not in the build" }]} />
        </div>
      </div>
      <PredictionPrompt
        className={promptClass}
        resetKey={resetKey}
        question={<>{withVendor ? "With the vendor model in the build" : "Without the vendor model"}, what does <code className={mono}>$printtimescale($root)</code> print?</>}
        options={options}
      >
        {({ committed }) => (
          <>
            <RevealSignal onChange={onReveal} />
            <VerdictSignal options={options} committed={committed} onSay={setSaid} />
          </>
        )}
      </PredictionPrompt>
      <LiveAnnouncement text={said} />
      {revealed ? (
        <div className="space-y-2">
          <RevealHeading>Now the default %t units</RevealHeading>
          <PredictionPrompt
            className={promptClass}
            resetKey={`units|${resetKey}`}
            question={<>Nobody calls <code className={mono}>$timeformat</code>. {withVendor ? "With the vendor model in the build" : "Without the vendor model"}, which units does <code className={mono}>%t</code> default to?</>}
            options={unitsOptions}
          >
            {({ committed }) => (
              <>
                <RevealSignal onChange={onUnitsReveal} />
                <VerdictSignal options={unitsOptions} committed={committed} onSay={setSaid} />
              </>
            )}
          </PredictionPrompt>
        </div>
      ) : null}
      {revealed && unitsRevealed ? (
        <div className="space-y-2" data-testid="global-precision-reveal">
          <RevealHeading testId="comparison-heading">{vendorRevealed ? "What the vendor model changes" : "The design without the vendor model"}</RevealHeading>
          <ScrollRegion label={vendorRevealed ? "What the vendor model changes" : "The design without the vendor model"}>
            <table className="w-full min-w-[520px] text-left text-xs">
              <caption className="sr-only">{vendorRevealed ? "What the vendor model changes" : "The design without the vendor model"}</caption>
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Quantity</th>
                  <th className={cn("py-1 pr-2", !withVendor && "text-foreground")}>Without vendor model</th>
                  {vendorRevealed ? (
                    <>
                      <th className={cn("py-1 pr-2", withVendor && "text-foreground")}>With `timescale 1ns/1fs</th>
                      <th className="py-1 pr-2">Changed?</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-border/50">
                    <td className="py-1 pr-2">
                      {r.label} <span className="text-muted-foreground">({r.clause})</span>
                    </td>
                    <td className={cn("py-1 pr-2", mono, !withVendor && "font-semibold")}>{r.before}</td>
                    {vendorRevealed ? (
                      <>
                        <td className={cn("py-1 pr-2", mono, withVendor && "font-semibold")}>{r.after}</td>
                        <td className="py-1 pr-2">{r.before === r.after ? <span className="text-emerald-800 dark:text-emerald-200">unchanged</span> : <span className="text-amber-900 dark:text-amber-100">▲ changed</span>}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          {vendorRevealed ? (
            <p className="text-xs text-muted-foreground">
              The directive counts toward the global precision even though tb.sv&apos;s modules do not use it (they declare their own timeunit and timeprecision). Only vendor_model does (§3.14.3). 1step equals the global precision (§3.14.3), so it moves with it. Each module still rounds to its own precision (§3.14.1), and an explicit $timeformat still fixes %t (§20.4.3). {report.resolution.errors.length ? "" : "No mixed specification: vendor_model takes its unit and precision from the directive (rule b)."}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Now add the vendor model above and predict again: the comparison opens once you have made both predictions.</p>
          )}
        </div>
      ) : null}
      <StartOver
        onClick={() => {
          setWithVendor(false);
          setVendorRevealed(false);
          setAttempt((n) => n + 1);
        }}
      />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Cross-scope: the 1000× debug challenge
// ---------------------------------------------------------------------------

const SCOPE_ORDER = ["caller", "boundary", "callee", "log"] as const;

const CHIP_CAPTION_CLASS: Readonly<Record<UnitState, string>> = {
  tagged: "text-amber-900 dark:text-amber-100",
  count: "text-amber-900 dark:text-amber-100",
  dropped: "text-rose-800 dark:text-rose-200",
  "never-had": "text-muted-foreground",
  "resolved-time": "text-emerald-800 dark:text-emerald-200",
};

const codeOnly = (text: string) => text.replace(/\s*\/\/.*$/, "").trim();

/** The first form of the debug challenge, and what Start over returns to. */
const FIRST_FORM: CallForm = "wait_t_5ns";

function CrossScopeLab() {
  const reduced = usePrefersReducedMotion();
  const [form, setForm] = useState<CallForm>(FIRST_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suspectId, setSuspectId] = useState<string | null>(null);
  /** Latched when the culprit is first found or the hunt is skipped, so reading a decoy's verdict afterwards takes nothing away. */
  const [huntDone, setHuntDone] = useState(false);
  const [fixId, setFixId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** What the persistent live region should read next: the last thing the learner changed. */
  const [lastAction, setLastAction] = useState<"step" | "suspect" | "fix" | null>(null);
  const [said, setSaid] = useState("");
  const suspectVerdictId = useId();
  const traceHeading = useRef<HTMLHeadingElement>(null);
  const focusTraceHeading = useRef(false);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);
  const promptKey = `${attempt}|${form}`;
  const trace = useMemo(() => traceCrossScope(form), [form]);
  const options = useMemo(() => toPredictionOptions(crossScopeOptions(form), promptKey), [form, promptKey]);
  const suspects = useMemo(() => gradeCrossScopeSuspects(), []);
  const fixes = useMemo(() => gradeCrossScopeFixes(), []);
  const stepNumber = Math.min(stepIndex, trace.steps.length - 1);
  const step = trace.steps[stepNumber];
  const suspect = suspects.find((s) => s.id === suspectId) ?? null;
  const fix = fixes.find((f) => f.id === fixId) ?? null;
  const hasHunt = form === FIRST_FORM;
  /** The hunt comes first: the trace, the highlighted line and the fixes would all answer it. */
  const hunting = hasHunt && !huntDone;
  const goToStep = (i: number) => {
    setStepIndex(Math.max(0, Math.min(trace.steps.length - 1, i)));
    setLastAction("step");
  };
  const suspectVerdictWord = (verdict: "culprit" | "contributes" | "decoy") => (verdict === "culprit" ? "Found it." : verdict === "contributes" ? "Close." : "A decoy.");
  const fixVerdictWord = (f: { robust: boolean; correctHere: boolean }) => (f.robust ? "Robust:" : f.correctHere ? "Fragile:" : "Rejected:");
  const announcement =
    !revealed || !step
      ? ""
      : lastAction === "suspect" && suspect
        ? `${suspectVerdictWord(suspect.verdict)} ${suspect.label}. ${suspect.feedback} Model check: ${suspect.evidence}`
        : lastAction === "fix" && fix
          ? `${fixVerdictWord(fix)} ${fix.label}. ${fix.review} ${fix.results.map((r) => `Caller in ${formatScale(r.callerUnit)} wakes at ${r.wake}${r.ok ? "" : ", not 5 ns"}`).join("; ")}.`
          : lastAction === "step"
            ? `Step ${stepNumber + 1} of ${trace.steps.length}: ${step.title}. ${unitSentence(step)}. ${step.what} ${step.why}`
            : said;
  /** A comment that explains the result waits for the prediction, and in wait_t(5ns) for the hunt too. */
  const lines = useMemo(() => crossScopeCode(form, hunting || !revealed).map((l) => ({ key: l.key, owner: l.owner, text: l.text })), [form, hunting, revealed]);
  const activeLineNumber = step ? lines.findIndex((l) => l.key === step.lineKey) : -1;
  const suspectRows = useMemo(
    () =>
      suspects
        .map((s) => {
          const lineNumber = lines.findIndex((l) => l.key === s.lineKey);
          return { suspect: s, lineNumber: lineNumber + 1, code: codeOnly(lines[lineNumber]?.text ?? ""), scope: lines[lineNumber]?.owner ? "tb_top" : "util_pkg" };
        })
        .sort((a, b) => a.lineNumber - b.lineNumber),
    [suspects, lines],
  );
  const chooseForm = (f: CallForm) => {
    setForm(f);
    setStepIndex(0);
    setLastAction(null);
  };
  const skipHunt = () => {
    focusTraceHeading.current = true;
    setHuntDone(true);
    setStepIndex(0);
  };
  const chooseSuspect = (id: string, verdict: "culprit" | "contributes" | "decoy") => {
    setSuspectId(id);
    setLastAction("suspect");
    if (verdict === "culprit") setHuntDone(true);
  };
  useEffect(() => {
    if (focusTraceHeading.current && traceHeading.current) {
      focusTraceHeading.current = false;
      traceHeading.current.focus();
    }
  }, [huntDone]);
  const startOver = () => {
    setAttempt((n) => n + 1);
    setForm(FIRST_FORM);
    setStepIndex(0);
    setSuspectId(null);
    setHuntDone(false);
    setFixId(null);
    setLastAction(null);
  };
  /** The lane titles come from the model's configuration, as the code panel does. */
  const lanes: { id: (typeof SCOPE_ORDER)[number]; title: string }[] = [
    { id: "caller", title: `tb_top (${formatScale(CROSS_SCOPE_DEFAULT.callerUnit)})` },
    { id: "boundary", title: "call boundary" },
    { id: "callee", title: `util_pkg (${formatScale(CROSS_SCOPE_DEFAULT.calleeUnit)})` },
    { id: "log", title: "wake / log" },
  ];
  const laneIndex = step ? SCOPE_ORDER.indexOf(step.scope) : 0;
  const logLine = <p className={cn("rounded-lg border border-border/70 bg-slate-950/90 px-3 py-2 text-xs text-slate-100", mono)}>{trace.printed}</p>;

  const followTheValue =
    step && !hunting ? (
      <div className="space-y-3">
        <div role="group" aria-label="Crossing step controls" className="flex flex-wrap items-center gap-2">
          <StepButton label="Previous step" atEnd={stepNumber <= 0} onClick={() => goToStep(stepNumber - 1)}>
            ←
          </StepButton>
          <input
            type="range"
            min={0}
            max={trace.steps.length - 1}
            value={stepNumber}
            onChange={(e) => goToStep(Number(e.target.value))}
            aria-label="Crossing step"
            aria-valuetext={`Step ${stepNumber + 1} of ${trace.steps.length}: ${step.title}`}
            className={scrubberClass}
          />
          <StepButton label="Next step" atEnd={stepNumber >= trace.steps.length - 1} onClick={() => goToStep(stepNumber + 1)}>
            →
          </StepButton>
          <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
            {stepNumber + 1}/{trace.steps.length}
          </span>
        </div>
        <ScrollRegion label="The value moving through the scopes" className={panel}>
          <p className="sr-only" data-testid="lane-state">
            Now in {lanes[laneIndex].title}: {unitSentence(step)}.
          </p>
          <div className="relative min-w-[360px]" aria-hidden>
            <div className="grid grid-cols-4 gap-2">
              {lanes.map((lane, i) => (
                <div
                  key={lane.id}
                  className={cn(
                    "min-h-[110px] rounded-lg border p-2 text-[11px] font-semibold uppercase tracking-wider",
                    lane.id === "boundary" ? "border-dashed border-border" : "border-border/70",
                    i === laneIndex ? "bg-cyan-500/10 text-foreground" : "text-muted-foreground",
                  )}
                >
                  {lane.title}
                </div>
              ))}
            </div>
            <div
              data-testid="crossing-chip"
              data-lane={step.scope}
              data-unit-state={step.unitState}
              className={cn("pointer-events-none absolute top-11 w-1/4 px-2", reduced ? "" : "transition-[left] duration-300 motion-reduce:transition-none")}
              style={{ left: `${laneIndex * 25}%` }}
            >
              <div className="mx-auto w-fit max-w-full rounded-lg border border-amber-500/70 bg-amber-500/15 px-2 py-1 text-center">
                <div className={cn("text-sm font-semibold text-foreground", mono)}>{step.value}</div>
                <div className={cn("text-[10px]", CHIP_CAPTION_CLASS[step.unitState])}>
                  {step.unitState === "dropped" && step.lostTag ? (
                    <>
                      <span className="text-muted-foreground line-through">{step.lostTag}</span>{" "}
                    </>
                  ) : null}
                  {unitChipText(step)}
                </div>
              </div>
            </div>
          </div>
        </ScrollRegion>
        <div className="space-y-1 text-sm" data-testid="crossing-step">
          <p className="font-semibold text-foreground">
            Step {stepNumber + 1}: {step.title} — {unitSentence(step)}
          </p>
          {activeLineNumber >= 0 ? (
            <p className={cn("text-xs text-muted-foreground", mono)} data-testid="crossing-line">
              Line {activeLineNumber + 1}: {codeOnly(lines[activeLineNumber].text)}
            </p>
          ) : null}
          <p className="text-foreground">
            <strong>What: </strong>
            {step.what}
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Why: </strong>
            {step.why}
          </p>
        </div>
      </div>
    ) : null;

  return (
    <VisualFrame
      label="Timescale lab: a time value crosses a scope"
      eyebrow="Debug it · predict, find, fix"
      title="A time value crosses a scope"
      summary="A package written in picoseconds exports wait_t(time t). A nanosecond bench calls it. Predict the wake time, then find the line responsible, follow the value across the boundary and choose a fix."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
      className={frameClass}
    >
      <SegmentedControl<CallForm>
        label="Call form"
        mono
        className={touchButtons}
        value={form}
        onChange={chooseForm}
        options={(Object.keys(CALL_FORM_TEXT) as CallForm[]).map((f) => ({ value: f, label: CALL_FORM_TEXT[f] }))}
      />
      <CodeTrace label="util_pkg and tb_top" lines={lines} activeKey={revealed && step && !hunting ? step.lineKey : undefined} />
      <PredictionPrompt
        className={promptClass}
        resetKey={promptKey}
        question={
          <>
            tb_top runs <code className={mono}>{CALL_FORM_TEXT[form]}</code> at t = 0. When does the process wake?
          </>
        }
        options={options}
      >
        {({ committed }) => (
          <>
            <RevealSignal onChange={onReveal} />
            <VerdictSignal options={options} committed={committed} onSay={setSaid} />
          </>
        )}
      </PredictionPrompt>

      <LiveAnnouncement text={announcement} />

      {revealed && step ? (
        <div className="space-y-3" data-testid="cross-scope-reveal">
          {hasHunt ? (
            <>
              <RevealHeading>The 1000× delay: find the line</RevealHeading>
              {logLine}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Which line turns 5 ns into 5 ps?</p>
                <ul className="space-y-2" aria-label="Suspect lines">
                  {suspectRows.map((row) => {
                    const pressed = suspectId === row.suspect.id;
                    return (
                      <li key={row.suspect.id}>
                        <button
                          type="button"
                          onClick={() => chooseSuspect(row.suspect.id, row.suspect.verdict)}
                          aria-pressed={pressed}
                          aria-label={`Suspect line: ${row.code}`}
                          aria-describedby={pressed ? suspectVerdictId : undefined}
                          className={cn(buttonClass, "w-full justify-between gap-3", pressed && "border-amber-500 bg-amber-500/15")}
                        >
                          <span className="min-w-0">
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              line {row.lineNumber}, {row.scope}
                            </span>
                            <code className={cn("block break-words text-xs", mono)}>{row.code}</code>
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden>
                            {pressed ? "Suspected" : "Suspect"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {suspect ? (
                  <div
                    id={suspectVerdictId}
                    data-testid="suspect-verdict"
                    className={cn(
                      "space-y-1 rounded-lg border p-3 text-sm",
                      suspect.verdict === "culprit" ? "border-emerald-500/50 bg-emerald-500/10" : suspect.verdict === "contributes" ? "border-amber-500/50 bg-amber-500/10" : "border-rose-500/50 bg-rose-500/10",
                    )}
                  >
                    <p className="font-semibold text-foreground">
                      {suspectVerdictWord(suspect.verdict)} <code className={mono}>{suspect.label}</code>
                    </p>
                    <p className="text-foreground">{suspect.feedback}</p>
                    <p className="text-xs text-muted-foreground">Model check: {suspect.evidence}</p>
                  </div>
                ) : null}
                {hunting ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <HintFocusKeeper className="min-w-0 flex-1">
                      <HintLadder hints={[...CROSS_SCOPE_HINTS]} resetKey={promptKey} className={touchButtons} />
                    </HintFocusKeeper>
                    <button type="button" className={textButtonClass} onClick={skipHunt}>
                      Skip the hunt and show the trace
                    </button>
                  </div>
                ) : null}
              </div>
              {followTheValue ? (
                <>
                  <h4 ref={traceHeading} tabIndex={-1} data-testid="trace-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Follow the value across the scope
                  </h4>
                  {followTheValue}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Choose a fix. The model recomputes the wake time for callers in 1 ns, 1 ps and 10 ns.</p>
                    <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]" role="group" aria-label="Fixes">
                      {fixes.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFixId(f.id);
                            setLastAction("fix");
                          }}
                          aria-pressed={fixId === f.id}
                          className={cn(buttonClass, "flex-wrap justify-between gap-2", fixId === f.id && "border-cyan-500 bg-cyan-500/10")}
                        >
                          <span className="min-w-0">{f.label}</span>
                          {fixId === f.id ? <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chosen</span> : null}
                        </button>
                      ))}
                    </div>
                    {fix ? (
                      <div data-testid="fix-verdict" className={cn("space-y-2 rounded-lg border p-3 text-sm", fix.robust ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
                        <p className="font-semibold text-foreground">Chosen fix: {fix.label}</p>
                        <pre role="region" tabIndex={0} aria-label="Code of this fix" className={cn("overflow-x-auto rounded bg-slate-950/90 p-2 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mono)}>{fix.code}</pre>
                        <table className="w-full text-left text-xs">
                          <caption className="sr-only">Wake time by caller unit</caption>
                          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-2">Caller unit</th>
                              <th className="py-1 pr-2">Wakes at</th>
                              <th className="py-1 pr-2">5 ns?</th>
                            </tr>
                          </thead>
                          <tbody className={mono}>
                            {fix.results.map((r) => (
                              <tr key={formatScale(r.callerUnit)} className="border-t border-border/50">
                                <td className="py-1 pr-2">{formatScale(r.callerUnit)}</td>
                                <td className="py-1 pr-2">{r.wake}</td>
                                <td className={cn("py-1 pr-2", r.ok ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200")}>{r.ok ? "✓" : "✕"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-foreground">
                          <strong>{fixVerdictWord(fix)} </strong>
                          {fix.review}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <RevealHeading>Follow the value across the scope</RevealHeading>
              {followTheValue}
              {logLine}
              <p className="text-xs text-muted-foreground">Switch the call form back to {CALL_FORM_TEXT.wait_t_5ns} to hunt for the suspect line and grade the fixes.</p>
            </>
          )}
        </div>
      ) : null}
      <StartOver onClick={startOver} />
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------

export default function TimescaleLab({ mode = "rounding", preset }: TimescaleLabProps) {
  switch (mode) {
    case "two-modules":
      return <TwoModulesLab />;
    case "read-time":
      return <ReadTimeLab preset={preset} />;
    case "which-unit":
      return <WhichUnitLab />;
    case "global-precision":
      return <GlobalPrecisionLab />;
    case "cross-scope":
      return <CrossScopeLab />;
    case "rounding":
    default:
      return <RoundingLab preset={preset} />;
  }
}
