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
  CROSS_SCOPE_HINTS,
  PRECEDENCE_TEXT,
  READ_TIME_PRESETS,
  ROUNDING_PRESETS,
  WHICH_UNIT_DEFAULT_ORDER,
  WHICH_UNIT_FILES,
  argumentFs,
  arrangeOptions,
  axisForWakes,
  crossScopeCode,
  crossScopeOptions,
  customReadTimeCaller,
  effectiveFormat,
  formatFsAuto,
  formatPercentT,
  formatScale,
  fsToDecimal,
  globalPrecisionOptions,
  globalPrecisionReport,
  gradeCrossScopeFixes,
  gradeCrossScopeSuspects,
  parseDelay,
  rationalToDecimal,
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
  traceCrossScope,
  wakeSequenceOptions,
  wakeText,
  whichUnitOptions,
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
} from "@/lib/sv-timescale-model";
import { cn } from "@/lib/utils";

export type TimescaleLabMode = "rounding" | "two-modules" | "read-time" | "which-unit" | "global-precision" | "cross-scope";

export interface TimescaleLabProps {
  mode?: TimescaleLabMode;
  /** A preset id of the chosen mode (see the preset lists in sv-timescale-model). */
  preset?: string;
}

export const TIMESCALE_ASSUMPTIONS = [
  "Every value is computed by the sv-timescale-model from IEEE 1800-2023 §3.14 (units, precision, rounding, precedence, global precision), §5.8 (time literals), §6.12.1 (real to integer), §9.4.1 (x/z and negative delays), §20.3 ($time, $stime, $realtime) and §20.4.3 ($timeformat, Tables 20-2 and 20-3).",
  "Arithmetic is exact: delays are decimal strings turned into integer femtoseconds (BigInt), so a half tick is detected exactly. §3.14.1 states no tie rule, so at an exact half tick both round-half-away-from-zero and round-half-to-even are computed and both values are shown when they disagree.",
  "The implementation default unit and precision (§3.14.2.3 rule d) are always shown as 'implementation-specific', never as a number.",
  "Assumption: %0t drops the padding. §20.4.3 and §21.2.1.2 do not settle how a %0t field width interacts with $timeformat's minimum_field_width.",
];

const selectClass = "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputClass =
  "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
/** The shared prompt's "Reveal without predicting" is bare text: size its buttons for touch from here. */
const promptClass = "[@media(pointer:coarse)]:[&_button]:min-h-10";

const toPredictionOptions = (options: LabOption[]): PredictionOption[] => arrangeOptions(options).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }));

const showToolDependent = (text: string) => text.replace(/<tool-dependent>/g, "⟨tool-dependent⟩");

/** Options that are program output: code font, and runs of spaces (a padded %t) kept visible. */
const toOutputOptions = (options: LabOption[]): PredictionOption[] =>
  arrangeOptions(options).map((o) => ({
    id: o.id,
    label: <span className={cn(mono, "whitespace-pre-wrap break-words text-xs")}>{showToolDependent(o.label)}</span>,
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
function RevealHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h4 ref={ref} tabIndex={-1} data-testid="reveal-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
  const scaledPos = pad + (ratio(rounded.scaledFs.num, rounded.scaledFs.den * precFs) - Number(firstTick)) * step;
  const targets = rounded.candidatesFs.map((fs) => fs / precFs);
  const label = `Ruler of ${formatScale(rounded.precision)} ticks. The written delay ${rounded.scaledText} sits ${rounded.ticks.exactHalf ? "exactly half way between two ticks" : "between ticks"} and snaps to ${wakeText(rounded)}.`;
  return (
    <ScrollRegion label="Tick ruler">
      <svg viewBox={`0 0 ${W} 112`} role="img" aria-label={label} className="h-auto min-w-[320px] w-full max-w-[520px] text-foreground">
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
          written: {rounded.scaledText}
        </text>
        <text x={W / 2} y={60} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.85">
          {rounded.ticks.exactHalf ? (rounded.toolDependent ? "exact half tick: both rules shown (tool-dependent)" : "exact half tick: both rules agree") : rounded.input.kind === "xz" ? "x/z delay is zero (§9.4.1)" : "rounds to the nearest tick (§3.14.1)"}
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
  const options = useMemo(() => toPredictionOptions(roundingOptions(rounded)), [rounded]);
  const resetKey = `${delayText}|${formatScale(unit)}|${formatScale(precision)}`;
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
      summary="The time unit scales the number, then the element's own precision rounds it (IEEE 1800-2023 §3.14.1). Pick a unit and precision, write a delay, and predict when the statement runs."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
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
        <DelayField label="Delay (#d or a time literal)" value={delayText} onChange={custom(setDelayText)} invalid={rounded.input.kind === "invalid"} errorId={errorId} onEditing={setEditingDelay} />
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
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scaled by the unit</dt>
                  <dd className={mono}>{rounded.scaledText}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rounded to the precision</dt>
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
                  §3.14.1 states no tie rule. Half away from zero gives {rounded.tie?.awayFromZero.toString()} ticks and half to even gives {rounded.tie?.toEven.toString()}; decimal delays are also not exact in binary, so the last bit depends on each simulator&apos;s arithmetic. Keep delays clear of half ticks when two simulators must agree.
                </p>
              ) : null}
            </div>
          )}
        </PredictionPrompt>
      )}
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

const TB_TOP = { name: "tb_top", unit: scale(1, "ns"), precision: scale(100, "ps") };
const U_SLOW = { name: "u_slow", unit: scale(10, "ns"), precision: scale(1, "ns") };

function AbsoluteAxis({ fast, slow, showMarkers }: { fast: { k: number; candidatesFs: bigint[] }[]; slow: { k: number; candidatesFs: bigint[] }[]; showMarkers: boolean }) {
  const all = [...fast, ...slow].flatMap((w) => w.candidatesFs);
  const maxFs = all.reduce((m, v) => (v > m ? v : m), BigInt(0));
  const axis = axisForWakes(maxFs);
  const axisUnit = scale(1, axis.unit);
  const endText = `${fsToDecimal(axis.endFs, axisUnit)} ${axis.unit}`;
  const W = 360;
  const pad = 24;
  const xOf = (fs: bigint) => pad + ratio(fs, axis.endFs) * (W - 2 * pad);
  const describe = (ws: { k: number; candidatesFs: bigint[] }[]) => ws.map((w) => w.candidatesFs.map((c) => formatFsAuto(c)).join(" or ")).join(", then ");
  const label = showMarkers
    ? `Time axis 0 to ${endText}. tb_top (1ns/100ps) wakes at ${describe(fast)}; u_slow (10ns/1ns) wakes at ${describe(slow)}.`
    : `Time axis 0 to ${endText}; the wake markers appear after both predictions.`;
  const marks = (ws: { k: number; candidatesFs: bigint[] }[], prefix: string) =>
    placeMarkerLabels(
      ws.flatMap((w) => w.candidatesFs.map((fs, ci) => ({ key: `${prefix}${w.k}-${ci}`, x: xOf(fs), text: formatFsAuto(fs) }))),
      W,
    );
  return (
    <ScrollRegion label="Absolute time axis">
      <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={label} className="h-auto min-w-[340px] w-full max-w-[560px] text-foreground">
        <text x={pad} y={14} fontSize="10" fontWeight="600" fill="currentColor">
          ● tb_top: timeunit 1ns; timeprecision 100ps;
        </text>
        <line x1={pad} y1={36} x2={W - pad} y2={36} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
        <text x={pad} y={64} fontSize="10" fontWeight="600" fill="currentColor">
          ◆ u_slow: timeunit 10ns; timeprecision 1ns;
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
        {axis.majorsFs.map((m) => (
          <g key={m.toString()}>
            <line x1={xOf(m)} y1={118} x2={xOf(m)} y2={126} stroke="currentColor" strokeOpacity="0.7" />
            <text x={xOf(m)} y={138} fontSize="9.5" textAnchor="middle" fill="currentColor">
              {fsToDecimal(m, axisUnit)}
            </text>
          </g>
        ))}
        <text x={W / 2} y={149} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.85">
          simulation time ({axis.unit}){axis.unit !== "ns" ? ": the axis grew to fit the wake times" : ""}
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
  const fastOptions = useMemo(() => toPredictionOptions(wakeSequenceOptions(fast, fastRepeats, U_SLOW)), [fast, fastRepeats]);
  const slowOptions = useMemo(() => toPredictionOptions(wakeSequenceOptions(slow, slowRepeats, TB_TOP)), [slow, slowRepeats]);
  const global = useMemo(() => resolveTimeScopes([{ id: "d", label: "design", code: [], items: [{ kind: "element", name: "tb_top", elementKind: "module", timeunit: TB_TOP.unit, timeprecision: TB_TOP.precision }, { kind: "element", name: "slow_gen", elementKind: "module", timeunit: U_SLOW.unit, timeprecision: U_SLOW.precision }] }], "one").globalPrecision, []);
  const key = `${delayText}|${fastRepeats}|${slowRepeats}`;
  const [said, setSaid] = useState("");
  const d = delayText.replace(/^#/, "");
  const [editingDelay, setEditingDelay] = useState(false);
  const errorId = useId();
  const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

  return (
    <VisualFrame
      label="Timescale lab: one delay, two modules"
      eyebrow="Experiment · predict then reveal"
      title="One delay, two modules"
      summary="tb_top and u_slow run the same #d from t = 0. The unit scales it differently and each module's own precision rounds it (§3.14.1)."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <DelayField label="Delay (#d, run in both modules)" value={delayText} onChange={setDelayText} invalid={fast.input.kind === "invalid"} errorId={errorId} onEditing={setEditingDelay} />
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
                  <span aria-hidden>● </span>tb_top (<code className={mono}>timeunit 1ns; timeprecision 100ps;</code>) runs <code className={mono}>#{d}</code> {times(fastRepeats)}. When does it wake?
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
                    {fastRepeats > 1 ? `, then every ${wakeText(fast)} more` : ""} (§3.14.1).
                  </p>
                </>
              )}
            </PredictionPrompt>
            <PredictionPrompt
              className={promptClass}
              resetKey={`slow|${key}`}
              question={
                <>
                  <span aria-hidden>◆ </span>u_slow (<code className={mono}>timeunit 10ns; timeprecision 1ns;</code>) runs the same <code className={mono}>#{d}</code> {times(slowRepeats)}. When does it wake?
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
                    {slowRepeats > 1 ? `, then every ${wakeText(slow)} more` : ""} (§3.14.1).
                  </p>
                </>
              )}
            </PredictionPrompt>
          </div>
          <div className={panel} data-testid="two-modules-axis">
            {!(fastRevealed && slowRevealed) ? <p className="mb-2 text-xs text-muted-foreground">Lock in both predictions to reveal the wake markers.</p> : null}
            <AbsoluteAxis fast={fastWakes} slow={slowWakes} showMarkers={fastRevealed && slowRevealed} />
            {fastRevealed && slowRevealed ? (
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
          <p className="text-xs text-muted-foreground">
            The design&apos;s global precision is <strong>{global ? `${global.magnitude} ${global.unit}` : "implementation-specific"}</strong>, the finer of the two (§3.14.3). It does not help u_slow: each module rounds with its own precision (§3.14.1).
          </p>
        </>
      )}
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
      <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={label} className="h-auto min-w-[380px] w-full max-w-[640px] text-foreground">
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
                  <text x={xOfUnits(u)} y={row.y + 15} fontSize="8.5" textAnchor="middle" fill="currentColor">
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
                <text x={(x0 + x1) / 2} y={138} fontSize="8.5" textAnchor="middle" fill="currentColor" fontWeight={hit ? 700 : 400}>
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

function TimeFormatControls({ mode, setMode, format, setFormat, build, overriddenAtZero }: { mode: FormatMode; setMode: (m: FormatMode) => void; format: TimeFormat; setFormat: (f: TimeFormat) => void; build: Build; overriddenAtZero: boolean }) {
  const def = effectiveFormat(null, build);
  return (
    <div className={cn(panel, "space-y-2")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">$timeformat in force before the code runs</p>
      <SegmentedControl<FormatMode>
        label="$timeformat before the code runs"
        value={mode}
        onChange={setMode}
        options={[
          { value: "default", label: "not called (Table 20-3 defaults)" },
          { value: "called", label: "called with…" },
        ]}
      />
      {mode === "default" ? (
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
      {overriddenAtZero ? <p className="text-xs text-muted-foreground">This code calls $timeformat itself at time 0, which replaces whatever was in force (§20.4.3).</p> : null}
    </div>
  );
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** What the learner did at one moment: the option they locked in, or null for "revealed without predicting". */
interface MomentAnswer {
  optionId: string | null;
  arg: "time" | "realtime";
}

function momentSentence(snapshot: ReadTimeSnapshot): string {
  const realtime = rationalToDecimal(snapshot.readings.realtime);
  return `${snapshot.caller} at t = ${formatFsAuto(snapshot.readings.absFs)}: in its ${formatScale(snapshot.unit)} unit that is ${realtime}, so $realtime = ${realtime} and $time = ${snapshot.readings.time.toString()}${
    snapshot.readings.timeExactHalf ? " (an exact half: §20.3.1 states no tie rule; the §6.12.1 real-to-integer rule rounds it away from zero)" : ""
  }.`;
}

function ReadTimeLab({ preset }: { preset?: string }) {
  const initial = READ_TIME_PRESETS.find((p) => p.id === preset) ?? READ_TIME_PRESETS[0];
  const [presetId, setPresetId] = useState<string>(initial.id);
  const [unit, setUnit] = useState<TimeScale>(scale(10, "ns"));
  const [precision, setPrecision] = useState<TimeScale>(scale(1, "ns"));
  const [delaysText, setDelaysText] = useState("#1.55, #1.55");
  const [customTimescale, setCustomTimescale] = useState(false);
  const [formatMode, setFormatMode] = useState<FormatMode>("default");
  const [format, setFormat] = useState<TimeFormat>({ units: -9, precision: 3, suffix: " ns", minWidth: 0 });
  const [arg, setArg] = useState<"realtime" | "time">(initial.arg);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, MomentAnswer>>({});
  const [editingDelays, setEditingDelays] = useState(false);
  const errorId = useId();
  const revealHeading = useRef<HTMLHeadingElement>(null);
  /** Set by the three actions that open a reveal, so scrubbing back to an answered moment leaves the focus on the scrubber. */
  const pendingRevealFocus = useRef(false);

  const current = READ_TIME_PRESETS.find((p) => p.id === presetId);
  const callers: readonly ReadTimeCaller[] = useMemo(() => (current ? current.callers : [customReadTimeCaller(unit, precision, delaysText.split(/[,\s]+/).filter(Boolean))]), [current, unit, precision, delaysText]);
  const build: Build = useMemo(() => (current ? current.build : { timescalePrecisions: customTimescale ? [precision] : [] }), [current, customTimescale, precision]);
  const trace = useMemo(() => runReadTime(callers, build, formatMode === "called" ? format : null), [callers, build, formatMode, format]);

  // Any change to the code or its $timeformat changes the answers: forget the predictions and return to the first moment.
  const experimentKey = `${presetId}|${formatScale(unit)}|${formatScale(precision)}|${delaysText}|${customTimescale}|${formatMode}|${JSON.stringify(format)}`;
  const [lastExperimentKey, setLastExperimentKey] = useState(experimentKey);
  if (experimentKey !== lastExperimentKey) {
    setLastExperimentKey(experimentKey);
    setAnswers({});
    setSnapshotIndex(0);
  }

  const count = trace.snapshots.length;
  const idx = count ? Math.min(snapshotIndex, count - 1) : 0;
  const snapshot: ReadTimeSnapshot | undefined = trace.snapshots[idx];
  const isRevealed = (i: number) => Boolean(answers[i]);
  const options = useMemo(() => (snapshot ? readTimeOptions(snapshot, build, arg) : []), [snapshot, build, arg]);
  const answer = answers[idx];
  const recorded = useMemo(() => (snapshot && answer ? readTimeOptions(snapshot, build, answer.arg) : options), [snapshot, answer, build, options]);
  const chosen = answer?.optionId ? recorded.find((o) => o.id === answer.optionId) : undefined;
  const correctOption = recorded.find((o) => o.correct);
  /** What this moment prints for the %t argument selected now: toggling it after the reveal shows the fraction disappear. */
  const printsOption = options.find((o) => o.correct);
  const scriptCallsFormat = callers.some((c) => c.steps.some((s) => s.kind === "timeformat"));
  const allRevealed = trace.snapshots.every((_, i) => isRevealed(i));
  const announcement =
    snapshot && isRevealed(idx)
      ? [
          chosen ? `${chosen.correct ? "Correct." : "Not quite."} ${chosen.feedback}` : "Revealed without predicting.",
          printsOption ? `Prints ${showToolDependent(printsOption.label)}.` : "",
          momentSentence(snapshot),
        ].join(" ")
      : "";

  const record = useCallback(
    (optionId: string | null) => {
      pendingRevealFocus.current = true;
      setAnswers((a) => (a[idx] ? a : { ...a, [idx]: { optionId, arg } }));
    },
    [idx, arg],
  );
  const onSkip = useCallback(
    (revealed: boolean) => {
      if (revealed) record(null);
    },
    [record],
  );
  const revealAll = () => {
    pendingRevealFocus.current = true;
    setAnswers((a) => Object.fromEntries(trace.snapshots.map((_, i) => [i, a[i] ?? { optionId: null, arg }])));
  };
  useEffect(() => {
    if (pendingRevealFocus.current && revealHeading.current) {
      pendingRevealFocus.current = false;
      revealHeading.current.focus();
    }
  }, [answers]);

  const choosePreset = (id: string) => {
    setPresetId(id);
    const p = READ_TIME_PRESETS.find((x) => x.id === id);
    if (p) setArg(p.arg);
  };

  const questionFor = (asked: "time" | "realtime") => (snapshot ? (
    <>
      <code className={mono}>{snapshot.caller}</code> (<code className={mono}>{formatScale(snapshot.unit)}</code> unit, <code className={mono}>{formatScale(snapshot.afterDelay.precision)}</code> precision) wakes from its {ordinal(snapshot.delayOrdinal)} delay,{" "}
      <code className={mono}>#{snapshot.afterDelay.input.text.replace(/^#/, "")}</code>, and prints. What do $time, $realtime and %0t of {asked === "time" ? "$time" : "$realtime"} show?
    </>
  ) : null);
  const delaysInvalid = !current && delaysText.split(/[,\s]+/).filter(Boolean).some((d) => parseDelay(d).kind === "invalid");

  return (
    <VisualFrame
      label="Timescale lab: reading the time"
      eyebrow="Experiment · predict then reveal"
      title="$time, $stime, $realtime and %t"
      summary="All three functions report in the caller's time unit (§20.3). %t converts to the $timeformat units (§20.4.3). Predict each print, moment by moment; the log fills in as you go."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
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
            <label className="flex items-center gap-2 self-end text-xs text-foreground">
              <input type="checkbox" checked={customTimescale} onChange={(e) => setCustomTimescale(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
              the build has a `timescale with this precision
            </label>
          </>
        ) : null}
      </div>
      {current ? <p className="text-xs text-muted-foreground">{current.summary}</p> : null}

      <TimeFormatControls mode={formatMode} setMode={setFormatMode} format={format} setFormat={setFormat} build={build} overriddenAtZero={scriptCallsFormat} />

      <SegmentedControl<"realtime" | "time">
        label="%t argument"
        mono
        value={arg}
        onChange={setArg}
        options={[
          { value: "realtime", label: "%t of $realtime" },
          { value: "time", label: "%t of $time" },
        ]}
      />

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
            <button type="button" className={buttonClass} disabled={idx <= 0} onClick={() => setSnapshotIndex(Math.max(0, idx - 1))} aria-label="Previous moment">
              ←
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, count - 1)}
              value={idx}
              onChange={(e) => setSnapshotIndex(Number(e.target.value))}
              aria-label="Moment"
              aria-valuetext={`Moment ${idx + 1} of ${count}: ${snapshot.caller} wakes from its ${ordinal(snapshot.delayOrdinal)} delay${isRevealed(idx) ? `, at ${formatFsAuto(snapshot.readings.absFs)}` : ", not yet predicted"}`}
              className="h-2 min-w-[120px] flex-1 cursor-pointer accent-cyan-500"
            />
            <button type="button" className={buttonClass} disabled={idx >= count - 1} onClick={() => setSnapshotIndex(Math.min(count - 1, idx + 1))} aria-label="Next moment">
              →
            </button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
              {idx + 1}/{count}
            </span>
            {!allRevealed ? (
              <button type="button" onClick={revealAll} className="inline-flex items-center text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-10">
                Reveal every moment
              </button>
            ) : null}
          </div>

          {!isRevealed(idx) ? (
            <PredictionPrompt
              key={`${experimentKey}|${idx}|${arg}`}
              resetKey={`${experimentKey}|${idx}|${arg}`}
              className={promptClass}
              question={questionFor(arg)}
              options={toOutputOptions(options)}
              onCommit={(optionId) => {
                pendingRevealFocus.current = true;
                setAnswers((a) => ({ ...a, [idx]: { optionId, arg } }));
              }}
            >
              <RevealSignal onChange={onSkip} />
            </PredictionPrompt>
          ) : null}

          {isRevealed(idx) ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.05] p-4" data-testid="read-time-reveal">
              <>
                <h4 ref={revealHeading} tabIndex={-1} data-testid="reveal-heading" className="text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="mr-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">Moment {idx + 1}</span>
                  {/* The question the verdict below answers, even after the %t argument is toggled. */}
                  {questionFor(answer?.arg ?? arg)}
                </h4>
                {chosen ? (
                  <p className={cn("text-sm", chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    <strong>{chosen.correct ? "Correct. " : "Not quite. "}</strong>
                    {chosen.feedback}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Revealed without predicting.</p>
                )}
                {correctOption && (!chosen || !chosen.correct) ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Why the answer holds: </strong>
                    {correctOption.feedback}
                  </p>
                ) : null}
                {printsOption ? (
                  <p className={cn("text-sm text-foreground", mono, "whitespace-pre-wrap break-words")}>
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prints </span>
                    {showToolDependent(printsOption.label)}
                  </p>
                ) : null}
                <TripleRuler absFs={snapshot.readings.absFs} unit={snapshot.unit} precision={snapshot.afterDelay.precision} time={snapshot.readings.time} />
                <p className="text-sm text-foreground">{momentSentence(snapshot)}</p>
              </>
            </div>
          ) : null}

          <ScrollRegion label="Time readings of every moment">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Every moment with its time readings; moments you have not predicted yet are hidden</caption>
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Moment</th>
                  <th className="py-1 pr-2">Caller</th>
                  <th className="py-1 pr-2">Absolute</th>
                  <th className="py-1 pr-2">$time</th>
                  <th className="py-1 pr-2">$stime</th>
                  <th className="py-1 pr-2">$realtime</th>
                  <th className={cn("py-1 pr-2", arg === "time" && "text-foreground")}>%0t of $time</th>
                  <th className={cn("py-1 pr-2", arg === "realtime" && "text-foreground")}>%0t of $realtime</th>
                </tr>
              </thead>
              <tbody className={mono}>
                {trace.snapshots.map((s, i) => {
                  const fmt = effectiveFormat(s.format, build);
                  const t = (which: "time" | "realtime") => (fmt ? formatPercentT(argumentFs(s.readings, which, s.unit), fmt, true) : "tool-dependent");
                  return (
                    <tr key={i} className={cn("border-t border-border/50", i === idx && "bg-cyan-500/10")}>
                      <td className="py-1 pr-2">{i + 1}</td>
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
                          <td className={cn("py-1 pr-2", arg === "time" && "font-semibold")}>{t("time")}</td>
                          <td className={cn("py-1 pr-2", arg === "realtime" && "font-semibold")}>{t("realtime")}</td>
                        </>
                      ) : (
                        <td colSpan={6} className="py-1 pr-2 font-sans text-muted-foreground">
                          predict moment {i + 1} to reveal it
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollRegion>
          <p className="text-xs text-muted-foreground">
            %t of $time has already lost the fraction (§20.3.1); %t of $realtime keeps it (§20.3.3). Compare the last two columns.
          </p>
          <figure className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
            <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Log, as the code prints it</figcaption>
            <pre role="region" tabIndex={0} aria-label="Printed log" className={cn("overflow-x-auto p-3 text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", mono)}>
              {trace.lines.map((l, i) =>
                l.momentIndex === null || isRevealed(l.momentIndex) ? (
                  <div key={i}>
                    <span className="text-slate-500">{`t = ${formatFsAuto(l.absFs)}`.padEnd(14)}</span>
                    {showToolDependent(l.text)}
                  </div>
                ) : (
                  <div key={i} className="text-slate-500">
                    {`t = ?`.padEnd(14)}⟨{l.caller}: predict moment {(l.momentIndex as number) + 1} to reveal this line⟩
                  </div>
                ),
              )}
            </pre>
          </figure>
          {trace.lines.some((l) => l.toolDependent && (l.momentIndex === null || isRevealed(l.momentIndex))) ? (
            <p className="text-xs text-amber-900 dark:text-amber-100">
              ⟨tool-dependent⟩: no $timeformat was called and the source has no `timescale, so Table 20-3 gives no default units. Call $timeformat once at time 0.
            </p>
          ) : null}
          {current && allRevealed ? (
            <p className="text-sm text-foreground" data-testid="preset-outcome">
              {current.outcome}
            </p>
          ) : null}
        </>
      ) : null}
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
  const options = useMemo(() => toPredictionOptions(whichUnitOptions(resolution)), [resolution]);
  const resetKey = `${order.join(",")}|${grouping}`;
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
    >
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl<Grouping>
          label="Compilation units"
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: "one", label: "one compilation unit" },
            { value: "each", label: "each file its own" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={includeReset} onChange={(e) => toggleReset(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          include a `resetall file
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
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
                  <tr key={e.id} className={cn("border-t border-border/50 align-top", e.path === "b" && "bg-cyan-500/10")}>
                    <td className={cn("py-1 pr-2", mono)}>
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
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Global precision and 1step
// ---------------------------------------------------------------------------

const TB_SOURCE = ["module slow_gen;", "  timeunit 10ns; timeprecision 1ns;", "endmodule", "module tb_top;", "  timeunit 1ns; timeprecision 100ps;", "  slow_gen u_slow ();", "endmodule"];

function GlobalPrecisionLab() {
  const [withVendor, setWithVendor] = useState(false);
  const [revealed, setRevealed] = useState(false);
  /** The vendor column answers the headline prediction, so it stays hidden until that prediction is made; toggling back does not hide it again. */
  const [vendorRevealed, setVendorRevealed] = useState(false);
  const onReveal = useCallback(
    (v: boolean) => {
      setRevealed(v);
      if (v && withVendor) setVendorRevealed(true);
    },
    [withVendor],
  );
  const before = useMemo(() => globalPrecisionReport(false), []);
  const after = useMemo(() => globalPrecisionReport(true), []);
  const report = withVendor ? after : before;
  const options = useMemo(() => toPredictionOptions(globalPrecisionOptions(withVendor)), [withVendor]);
  const [said, setSaid] = useState("");
  const unitsText = (s: TimeScale | null) => (s ? formatScale(s) : "tool-dependent (no `timescale in the source)");
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
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <CodeTrace label="tb.sv (timeunit only)" lines={TB_SOURCE.map((text) => ({ text }))} />
        <div className="space-y-2">
          <label className={cn(panel, "flex cursor-pointer items-start gap-2 text-sm text-foreground")}>
            <input type="checkbox" checked={withVendor} onChange={(e) => setWithVendor(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-500" />
            <span>
              Add <code className={mono}>vendor_model.sv</code>, compiled under <code className={mono}>`timescale 1ns/1fs</code>. Every module keeps its own timeunit.
            </span>
          </label>
          <CodeTrace label="vendor_model.sv" lines={withVendor ? [{ text: "`timescale 1ns/1fs" }, { text: "module vendor_model; endmodule" }] : [{ text: "// not in the build" }]} />
        </div>
      </div>
      <PredictionPrompt
        className={promptClass}
        resetKey={String(withVendor)}
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
        <div className="space-y-2" data-testid="global-precision-reveal">
          <RevealHeading>{vendorRevealed ? "What the vendor model changes" : "The design without the vendor model"}</RevealHeading>
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
              The directive counts toward the global precision even though no module uses it (§3.14.3). Each module still rounds to its own precision (§3.14.1), and an explicit $timeformat still fixes %t (§20.4.3). {report.resolution.errors.length ? "" : "No mixed specification: vendor_model takes its unit from the directive (rule b)."}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Now add the vendor model above and predict again: the comparison opens once you have.</p>
          )}
        </div>
      ) : null}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Cross-scope: the 1000× debug challenge
// ---------------------------------------------------------------------------

const SCOPE_ORDER = ["caller", "boundary", "callee", "log"] as const;

function CrossScopeLab() {
  const reduced = usePrefersReducedMotion();
  const [form, setForm] = useState<CallForm>("wait_t_5ns");
  const [stepIndex, setStepIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suspectId, setSuspectId] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  /** What the persistent live region should read next: the last thing the learner changed. */
  const [lastAction, setLastAction] = useState<"step" | "suspect" | "fix" | null>(null);
  const [said, setSaid] = useState("");
  const suspectVerdictId = useId();
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);
  const trace = useMemo(() => traceCrossScope(form), [form]);
  const options = useMemo(() => toPredictionOptions(crossScopeOptions(form)), [form]);
  const suspects = useMemo(() => gradeCrossScopeSuspects(), []);
  const fixes = useMemo(() => gradeCrossScopeFixes(), []);
  const stepNumber = Math.min(stepIndex, trace.steps.length - 1);
  const step = trace.steps[stepNumber];
  const suspect = suspects.find((s) => s.id === suspectId) ?? null;
  const fix = fixes.find((f) => f.id === fixId) ?? null;
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
            ? `Step ${stepNumber + 1} of ${trace.steps.length}: ${step.title}. Value ${step.value} ${step.unitTag ? `understood in ${step.unitTag}` : "with no unit"}. ${step.what} ${step.why}`
            : said;
  const lines = useMemo(() => crossScopeCode(form).map((l) => ({ key: l.key, owner: l.owner, text: l.text })), [form]);
  const chooseForm = (f: CallForm) => {
    setForm(f);
    setStepIndex(0);
    setLastAction(null);
  };
  const lanes: { id: (typeof SCOPE_ORDER)[number]; title: string }[] = [
    { id: "caller", title: "tb_top (1ns)" },
    { id: "boundary", title: "call boundary" },
    { id: "callee", title: "util_pkg (1ps)" },
    { id: "log", title: "wake / log" },
  ];
  const laneIndex = step ? SCOPE_ORDER.indexOf(step.scope) : 0;

  return (
    <VisualFrame
      label="Timescale lab: a time value crosses a scope"
      eyebrow="Debug it · predict, trace, fix"
      title="The 1000× delay"
      summary="A package written in picoseconds exports wait_t(time t). A nanosecond bench calls it. Predict the wake time, watch the value cross the boundary, then find the line and the fix."
      fidelity="model"
      assumptions={TIMESCALE_ASSUMPTIONS}
    >
      <SegmentedControl<CallForm>
        label="Call form"
        mono
        value={form}
        onChange={chooseForm}
        options={(Object.keys(CALL_FORM_TEXT) as CallForm[]).map((f) => ({ value: f, label: CALL_FORM_TEXT[f] }))}
      />
      <CodeTrace
        label="util_pkg and tb_top"
        lines={lines}
        activeKey={revealed && step ? step.lineKey : undefined}
        renderLineControl={(line) => {
          // Suspects and their verdicts belong to the buggy wait_t(5ns) form only.
          if (form !== "wait_t_5ns") return null;
          const s = suspects.find((x) => x.lineKey === line.key);
          if (!s || !revealed) return null;
          const pressed = suspectId === s.id;
          return (
            <button
              type="button"
              onClick={() => {
                setSuspectId(s.id);
                setLastAction("suspect");
              }}
              aria-pressed={pressed}
              aria-label={`Suspect line: ${line.text.replace(/\s*\/\/.*$/, "").trim()}`}
              aria-describedby={pressed ? suspectVerdictId : undefined}
              className={cn(
                "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-10",
                pressed ? "border-amber-400 bg-amber-500/30 text-amber-100" : "border-white/20 text-slate-300 hover:bg-white/10",
              )}
            >
              {pressed ? "Suspected" : "Suspect"}
            </button>
          );
        }}
      />
      <PredictionPrompt
        className={promptClass}
        resetKey={form}
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
          <RevealHeading>Follow the value across the scope</RevealHeading>
          <div role="group" aria-label="Crossing step controls" className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} disabled={stepNumber <= 0} onClick={() => goToStep(stepNumber - 1)} aria-label="Previous step">
              ←
            </button>
            <input
              type="range"
              min={0}
              max={trace.steps.length - 1}
              value={stepNumber}
              onChange={(e) => goToStep(Number(e.target.value))}
              aria-label="Crossing step"
              aria-valuetext={`Step ${stepNumber + 1} of ${trace.steps.length}: ${step.title}`}
              className="h-2 min-w-[120px] flex-1 cursor-pointer accent-cyan-500"
            />
            <button type="button" className={buttonClass} disabled={stepNumber >= trace.steps.length - 1} onClick={() => goToStep(stepNumber + 1)} aria-label="Next step">
              →
            </button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
              {Math.min(stepIndex, trace.steps.length - 1) + 1}/{trace.steps.length}
            </span>
          </div>
          <ScrollRegion label="The value moving through the scopes" className={panel}>
            <div className="relative min-w-[360px]">
              <div className="grid grid-cols-4 gap-2" aria-hidden>
                {lanes.map((lane, i) => (
                  <div
                    key={lane.id}
                    className={cn(
                      "min-h-[88px] rounded-lg border p-2 text-[11px] font-semibold uppercase tracking-wider",
                      lane.id === "boundary" ? "border-dashed border-border" : "border-border/70",
                      i === laneIndex ? "bg-cyan-500/10 text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {lane.title}
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                data-testid="crossing-chip"
                data-lane={step.scope}
                className={cn("pointer-events-none absolute top-8 w-1/4 px-2", reduced ? "" : "transition-[left] duration-300 motion-reduce:transition-none")}
                style={{ left: `${laneIndex * 25}%` }}
              >
                <div className="mx-auto w-fit max-w-full rounded-lg border border-amber-500/70 bg-amber-500/15 px-2 py-1 text-center">
                  <div className={cn("text-sm font-semibold text-foreground", mono)}>{step.value}</div>
                  <div className={cn("text-[10px]", step.unitTag ? "text-amber-900 dark:text-amber-100" : "text-muted-foreground line-through")}>{step.unitTag ?? "unit tag dropped"}</div>
                </div>
              </div>
            </div>
          </ScrollRegion>
          <div className="space-y-1 text-sm" data-testid="crossing-step">
            <p className="font-semibold text-foreground">
              Step {stepNumber + 1}: {step.title} — value <code className={mono}>{step.value}</code> {step.unitTag ? `understood in ${step.unitTag}` : "with no unit"}
            </p>
            <p className="text-foreground">
              <strong>What: </strong>
              {step.what}
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Why: </strong>
              {step.why}
            </p>
          </div>
          <p className={cn("rounded-lg border border-border/70 bg-slate-950/90 px-3 py-2 text-xs text-slate-100", mono)}>{trace.printed}</p>

          {form === "wait_t_5ns" ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Step 1 — which line turns 5 ns into 5 ps? Press Suspect beside a line in the code above.</p>
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
                <HintLadder hints={[...CROSS_SCOPE_HINTS]} resetKey={form} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Step 2 — choose a fix. The model recomputes the wake time for callers in 1 ns, 1 ps and 10 ns.</p>
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
                      className={cn(buttonClass, fixId === f.id && "border-cyan-500 bg-cyan-500/10")}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {fix ? (
                  <div data-testid="fix-verdict" className={cn("space-y-2 rounded-lg border p-3 text-sm", fix.robust ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
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
          ) : (
            <p className="text-xs text-muted-foreground">Switch the call form back to {CALL_FORM_TEXT.wait_t_5ns} to hunt for the suspect line and grade the fixes.</p>
          )}
        </div>
      ) : null}
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
