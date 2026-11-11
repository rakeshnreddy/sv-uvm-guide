"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { classifyValue, valueStyles } from "@/components/visual-system/visual-language";
import {
  AXIS_END,
  BIT4,
  EDGE_TABLE,
  EVENT_PRESETS,
  INTRA_FORMS,
  NO_REPEAT_NOTE,
  OFFERED_REPEAT_COUNTS,
  REPEAT_COUNTS,
  STIMULUS,
  TIME_CHOICES,
  WAIT_LOOP_CAUTION,
  WAKE_ARMING_NOTE,
  WAKE_INITIAL,
  WAKE_OUTCOME_LABELS,
  WAKE_WAITERS,
  controlText,
  drillControls,
  drillSummary,
  edgeCell,
  evaluateDrill,
  evaluateIntra,
  explainTimeChoice,
  explainValueChoice,
  explainWakeChoice,
  findEventPreset,
  findLessonPreset,
  formatValue,
  intraSummary,
  nextBit,
  outcomeChoices,
  posedgesOnAxis,
  scoreDrill,
  subjectName,
  subjectValues,
  timeText,
  timeChoiceLabel,
  valueChoiceLabel,
  valueChoices,
  wakeMatrix,
  wakeOutcome,
  wakeSteps,
  writeMarkers,
  writeOnAxis,
  writeText,
  type Bit4,
  type ControlId,
  type EventDrill,
  type ExplorerMode,
  type IntraFormId,
  type IntraResult,
  type RepeatCountId,
  type SubjectKind,
  type WaiterId,
  type WakeOutcome,
} from "@/lib/sv-intra-assignment-model";
import { cn } from "@/lib/utils";

export const TIMING_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §9.4.2 and Table 9-2 (edges, LSB only, no event without a value change), §9.4.2.1 (or and comma), §9.4.2.3 (iff, truth per §12.4), §9.4.3 (wait), §9.4.5 and Table 9-3 (intra-assignment timing and repeat), §10.4.1, §10.4.2 and §4.6 b).",
  "Every edge and change decision comes from the shared event-control model that the process model also uses, so the visuals cannot disagree.",
  "a & b uses the 4-state & of Table 11-11. The iff guard is one bit. A guard or bus that mixes known 1 bits with x or z bits is not modelled.",
  "The wake drill judges one write at a time, with the waiter freshly reached just before that write; it is not a forever loop (a true a would make forever wait (a); spin with no time advance). Which other processes run first in the same time slot is left open by the standard (§4.7) and is not shown.",
  "The intra drill runs one process from t = 0. No read falls at the instant b or d changes, so no same-time race appears.",
  "For a repeat count of 0, a negative signed value, x or z, the lab follows the clause's example: no edge is waited for. A count of 4294967293 is computed, not simulated; its time assumes clk keeps rising every 3 time units.",
];

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const code = (text: React.ReactNode) => <code className="rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]">{text}</code>;

const sectionLabel = "text-label text-muted-foreground";

function LiveLine({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="timing-live">
      {text}
    </p>
  );
}

/** Mounted only inside a revealed prompt, so the parent knows when the answer is on screen. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

/** Takes focus when it mounts: a locked-in prompt removes the button that had focus. */
function FocusOnMount({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-label={label} className="space-y-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </div>
  );
}

function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p role="note" aria-label={label} className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] px-3 py-2 text-sm text-foreground">
      {children}
    </p>
  );
}

function BitButton({ name, bit, onChange }: { name: string; bit: Bit4; onChange: (bit: Bit4) => void }) {
  const next = nextBit(bit);
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`${name} is ${bit}. Activate to change it to ${next}.`}
      className={cn(
        "h-10 w-10 rounded-md border font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        valueStyles[classifyValue(bit)].className,
      )}
    >
      {bit}
    </button>
  );
}

function Fold({ label, open, onOpenChange, children }: { label: string; open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        {label}
      </button>
      <div id={panelId} hidden={!open} className="mt-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

const primaryButton =
  "inline-flex min-h-10 items-center rounded-lg border border-cyan-500 bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/* ------------------------------------------------------------------ */
/* Table 9-2                                                           */
/* ------------------------------------------------------------------ */

function edgeGlyph(e: "posedge" | "negedge" | null) {
  const [glyph, word] = e === "posedge" ? ["↑", "posedge"] : e === "negedge" ? ["↓", "negedge"] : ["–", "no edge"];
  return (
    <>
      <span aria-hidden className="block">
        {glyph}
      </span>
      <span className="block break-words">{word}</span>
    </>
  );
}

function EdgeTable({ from, to }: { from: Bit4; to: Bit4 }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label="Table 9-2: edge by value before (rows) and after (columns)" className="w-full table-fixed border-collapse text-center text-xs leading-tight">
        <caption className="mb-1 text-left text-xs text-muted-foreground">Table 9-2 (IEEE 1800-2023 §9.4.2): rows are the LSB before, columns the LSB after.</caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-muted-foreground">
              from \ to
            </th>
            {BIT4.map((b) => (
              <th key={b} scope="col" className="p-1 font-mono">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BIT4.map((row) => (
            <tr key={row}>
              <th scope="row" className="p-1 font-mono">
                {row}
              </th>
              {BIT4.map((col) => {
                const current = row === from && col === to;
                const e = EDGE_TABLE[row][col];
                return (
                  <td
                    key={col}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "border border-border/60 p-1",
                      e === "posedge" && "text-cyan-800 dark:text-cyan-200",
                      e === "negedge" && "text-violet-800 dark:text-violet-200",
                      e === null && "text-muted-foreground",
                      current && "bg-amber-500/20 font-semibold ring-2 ring-inset ring-amber-500",
                    )}
                  >
                    {edgeGlyph(e)}
                    {current ? <span className="sr-only"> (this change)</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mode "events": the edge-detector drill                              */
/* ------------------------------------------------------------------ */

function DrillValues({ drill }: { drill: EventDrill }) {
  if (drill.subject === "and") {
    return (
      <p className="font-mono text-sm [font-variant-ligatures:none]">
        a: {formatValue(drill.a.before)} → {formatValue(drill.a.after)}, b: {formatValue(drill.b.before)} → {formatValue(drill.b.after)}, en = {drill.en}
      </p>
    );
  }
  const { before, after } = subjectValues(drill);
  return (
    <p className="font-mono text-sm [font-variant-ligatures:none]">
      {subjectName(drill)}: {formatValue(before)} → {formatValue(after)}, en = {drill.en}
    </p>
  );
}

function DrillEditor({ drill, onChange }: { drill: EventDrill; onChange: (d: EventDrill) => void }) {
  const setBit = (key: "s" | "a" | "b", side: "before" | "after", bit: Bit4) => onChange({ ...drill, [key]: { ...drill[key], [side]: bit } });
  const setBus = (side: "before" | "after", i: number, bit: Bit4) =>
    onChange({ ...drill, bus: { ...drill.bus, [side]: drill.bus[side].map((b, k) => (k === i ? bit : b)) } });
  const oneBit = (key: "s" | "a" | "b", name: string) => (
    <div role="group" aria-label={`${name} before and after`} className="flex flex-wrap items-center gap-2">
      <span className="w-14 font-mono text-sm">{name}</span>
      <BitButton name={`${name} before`} bit={drill[key].before} onChange={(b) => setBit(key, "before", b)} />
      <span aria-hidden>→</span>
      <BitButton name={`${name} after`} bit={drill[key].after} onChange={(b) => setBit(key, "after", b)} />
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className={sectionLabel}>Expression</p>
        <SegmentedControl<SubjectKind>
          label="Expression"
          mono
          value={drill.subject}
          onChange={(subject) => onChange({ ...drill, subject })}
          options={[
            { value: "signal", label: drill.signalName },
            { value: "bus", label: "bus[3:0]" },
            { value: "and", label: "a & b" },
          ]}
        />
      </div>
      {drill.subject === "signal" ? oneBit("s", drill.signalName) : null}
      {drill.subject === "and" ? (
        <>
          {oneBit("a", "a")}
          {oneBit("b", "b")}
        </>
      ) : null}
      {drill.subject === "bus"
        ? (["before", "after"] as const).map((side) => (
            <div key={side} role="group" aria-label={`bus ${side}, most significant bit first`} className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 font-mono text-sm">{side}</span>
              {drill.bus[side].map((bit, i) => (
                // Keyed by position so focus stays on the bit while its value cycles.
                <BitButton key={i} name={`bus[${drill.bus[side].length - 1 - i}] ${side}`} bit={bit} onChange={(b) => setBus(side, i, b)} />
              ))}
            </div>
          ))
        : null}
      <div role="group" aria-label="Guard en" className="flex flex-wrap items-center gap-2">
        <span className="w-14 font-mono text-sm">en</span>
        <BitButton name="en" bit={drill.en} onChange={(en) => onChange({ ...drill, en })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={drill.withIffOr} onChange={(e) => onChange({ ...drill, withIffOr: e.target.checked })} className="size-5 shrink-0 accent-cyan-500" />
        Add {code(controlText(drill, "iff-or"))}
      </label>
      <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z. Any change asks for a new prediction.</p>
    </div>
  );
}

function EventPrediction({ drill, resetKey, onReveal }: { drill: EventDrill; resetKey: string; onReveal: (revealed: boolean) => void }) {
  const ids = drillControls(drill);
  const [ticked, setTicked] = useState<ControlId[]>([]);
  const [committed, setCommitted] = useState<ControlId[] | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setTicked([]);
    setCommitted(null);
    setSkipped(false);
  }
  const revealed = committed !== null || skipped;
  useEffect(() => onReveal(revealed), [revealed, onReveal]);

  const verdicts = evaluateDrill(drill);
  const score = committed ? scoreDrill(drill, committed) : null;
  const cell = edgeCell(drill);
  const presetNote = EVENT_PRESETS.find((p) => JSON.stringify(p.drill) === JSON.stringify(drill));

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4">
      <fieldset disabled={revealed}>
        <legend className="mb-3 text-sm font-semibold text-foreground">
          <span className="mr-2 rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning">Predict</span>
          Tick every event control that wakes for this change.
        </legend>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {ids.map((id) => {
            const v = verdicts.find((x) => x.id === id)!;
            const isTicked = (committed ?? ticked).includes(id);
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-3 text-sm",
                  revealed && "cursor-default",
                  revealed && v.fires && "border-emerald-500/70 bg-emerald-500/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={isTicked}
                  onChange={() => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
                  className="mt-px size-5 shrink-0 accent-amber-500"
                />
                <span className="flex-1 font-mono [font-variant-ligatures:none]">{v.text}</span>
                {revealed ? <span className="text-xs font-semibold">{v.fires ? "wakes" : "no wake"}</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      {!revealed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCommitted(ticked)}
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            Lock in prediction
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reveal without predicting
          </button>
          <span className="text-xs text-muted-foreground">Ticking none means you predict that nothing wakes.</span>
        </div>
      ) : (
        <div className="mt-4">
          <FocusOnMount label="Event control outcome">
            {score ? (
              <p className={score.correct === score.total ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-300"}>
                <strong>{score.correct === score.total ? "Correct. " : "Not quite. "}</strong>
                {score.correct} of {score.total} controls predicted right.
              </p>
            ) : null}
            <ul aria-label="Why each control wakes or not" className="space-y-2 text-sm">
              {verdicts.map((v) => {
                const ok = score?.perControl[v.id];
                return (
                  <li key={v.id} className="rounded-lg border border-border/60 bg-background/60 p-2">
                    <span className="font-semibold">
                      {v.fires ? "● wakes" : "○ does not wake"}
                      {ok === undefined ? null : ok ? " · your tick ✓" : " · your tick ✕"}
                    </span>{" "}
                    <span className="text-foreground">{v.reason}</span>
                  </li>
                );
              })}
            </ul>
            <EdgeTable from={cell.from} to={cell.to} />
            {presetNote ? <Note label="What this preset shows">{presetNote.lesson}</Note> : null}
          </FocusOnMount>
        </div>
      )}
    </div>
  );
}

const CUSTOM_PRESET = "custom";

function EventsLab({ start }: { start?: string }) {
  const initial = findEventPreset(start) ?? EVENT_PRESETS[0];
  const [presetId, setPresetId] = useState<string>(initial.id);
  const [drill, setDrill] = useState<EventDrill>(initial.drill);
  const [revealed, setRevealed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const key = JSON.stringify(drill);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);

  const choosePreset = (id: string) => {
    if (id === CUSTOM_PRESET) {
      // Keeps the current values as the starting point and opens the editor.
      setPresetId(CUSTOM_PRESET);
      setEditorOpen(true);
      return;
    }
    const p = findEventPreset(id);
    if (!p) return;
    setPresetId(id);
    setDrill(p.drill);
  };

  return (
    <VisualFrame
      label="Timing control explorer: which value changes are events"
      eyebrow="Edge detector drill"
      title="Which event controls wake?"
      summary="Set a value change, predict which @ controls wake, then check the rule and the Table 9-2 cell."
      fidelity="model"
      assumptions={TIMING_ASSUMPTIONS}
    >
      <div className="space-y-1">
        <p className={sectionLabel}>Preset</p>
        <SegmentedControl
          label="Preset"
          value={presetId}
          onChange={choosePreset}
          options={[...EVENT_PRESETS.map((p) => ({ value: p.id, label: p.title })), { value: CUSTOM_PRESET, label: "Your own (edit the values)" }]}
        />
      </div>
      <div className="rounded-lg border border-border/70 bg-background/50 p-3">
        <p className={sectionLabel}>The change</p>
        <DrillValues drill={drill} />
      </div>
      <Fold label="Change the values" open={editorOpen} onOpenChange={setEditorOpen}>
        <DrillEditor
          drill={drill}
          onChange={(d) => {
            setDrill(d);
            const match = EVENT_PRESETS.find((p) => JSON.stringify(p.drill) === JSON.stringify(d));
            setPresetId(match ? match.id : CUSTOM_PRESET);
          }}
        />
      </Fold>
      <EventPrediction drill={drill} resetKey={key} onReveal={onReveal} />
      <LiveLine text={revealed ? drillSummary(drill) : ""} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Mode "wake": what wakes a waiting process                           */
/* ------------------------------------------------------------------ */

const outcomeGlyph: Record<WakeOutcome, string> = { wakes: "● wakes", asleep: "○ asleep", "passes-at-once": "⇥ passes at once" };

function WakeLab({ start }: { start?: string }) {
  const steps = useMemo(() => wakeSteps(), []);
  const initialWaiter = (WAKE_WAITERS.find((w) => w.id === start) ?? WAKE_WAITERS[0]).id;
  const [waiter, setWaiter] = useState<WaiterId>(initialWaiter);
  const [stepIndex, setStepIndex] = useState(0);
  /** Steps whose answer is on screen. */
  const [revealedSteps, setRevealedSteps] = useState<number[]>([]);
  const step = steps[stepIndex];
  const waiterCode = WAKE_WAITERS.find((w) => w.id === waiter)!.code;
  const currentRevealed = revealedSteps.includes(stepIndex);
  const finished = revealedSteps.includes(steps.length - 1);

  const onReveal = useCallback(
    (v: boolean) => {
      if (v) setRevealedSteps((r) => (r.includes(stepIndex) ? r : [...r, stepIndex]));
    },
    [stepIndex],
  );

  const chooseWaiter = (w: WaiterId) => {
    setWaiter(w);
    setStepIndex(0);
    setRevealedSteps([]);
  };

  const options: PredictionOption[] = outcomeChoices(waiter).map((c) => ({
    id: c,
    label: WAKE_OUTCOME_LABELS[c],
    ...explainWakeChoice(waiter, step, c),
  }));

  const verdict = wakeOutcome(waiter, step);
  const live = currentRevealed ? `Write ${stepIndex + 1}: ${writeText(step)}. ${waiterCode} ${WAKE_OUTCOME_LABELS[verdict.outcome]}. ${verdict.rule}` : "";

  return (
    <VisualFrame
      label="Timing control explorer: what wakes a waiting process"
      eyebrow="Wake rules"
      title="Does this write wake the waiter?"
      summary="Pick a waiter, then step through four writes. Before each one, predict whether the waiter wakes."
      fidelity="model"
      assumptions={TIMING_ASSUMPTIONS}
    >
      <div className="space-y-1">
        <p className={sectionLabel}>Waiter</p>
        <SegmentedControl<WaiterId> label="Waiter" mono value={waiter} onChange={chooseWaiter} options={WAKE_WAITERS.map((w) => ({ value: w.id, label: w.code }))} />
        <p className="text-xs text-muted-foreground" data-testid="wake-arming-note">
          {WAKE_ARMING_NOTE}
          {waiter === "wait-a" ? ` ${WAIT_LOOP_CAUTION}` : ""}
        </p>
      </div>

      <ol aria-label={`Lane for ${waiterCode}`} className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {steps.map((s) => {
          const shown = revealedSteps.includes(s.index);
          const outcome = wakeOutcome(waiter, s).outcome;
          return (
            <li
              key={s.index}
              aria-current={s.index === stepIndex ? "step" : undefined}
              className={cn(
                "rounded-lg border p-2 text-xs",
                s.index === stepIndex ? "border-cyan-500 bg-cyan-500/10" : "border-border/60",
                shown && outcome === "wakes" && "border-emerald-500/70",
              )}
            >
              <p className="font-semibold text-muted-foreground">Write {s.index + 1}</p>
              <p className="font-mono [font-variant-ligatures:none]">
                {s.signal}: {s.from} → {s.to}
              </p>
              <p className="mt-1 font-semibold">{shown ? outcomeGlyph[outcome] : s.index === stepIndex ? "your call" : "–"}</p>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
        <p className={sectionLabel}>Now</p>
        <p className="font-mono [font-variant-ligatures:none]">
          a = {step.before.a}, b = {step.before.b}; waiting on {waiterCode}
        </p>
        <p className="mt-1">
          Write {stepIndex + 1} of {steps.length}: {code(writeText(step))}
        </p>
      </div>

      <PredictionPrompt resetKey={`${waiter}-${stepIndex}`} question={<>Does {code(waiterCode)} wake on this write?</>} options={options}>
        <RevealSignal onChange={onReveal} />
        <FocusOnMount label="Wake outcome">
          {stepIndex < steps.length - 1 ? (
            <button type="button" className={primaryButton} onClick={() => setStepIndex((i) => i + 1)}>
              Next write: {code(writeText(steps[stepIndex + 1]))}
            </button>
          ) : (
            <button type="button" className={primaryButton} onClick={() => chooseWaiter(waiter)}>
              Start again from a = {WAKE_INITIAL.a}, b = {WAKE_INITIAL.b}
            </button>
          )}
        </FocusOnMount>
      </PredictionPrompt>

      {finished ? (
        <div className="overflow-x-auto">
          <table aria-label="Every waiter against every write" className="w-full border-collapse text-xs">
            <caption className="mb-1 text-left text-muted-foreground">All five waiters against the same four writes.</caption>
            <thead>
              <tr>
                <th scope="col" className="p-1 text-left">
                  Waiter
                </th>
                {steps.map((s) => (
                  <th key={s.index} scope="col" className="p-1 font-mono">
                    {s.signal} {s.from}→{s.to}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wakeMatrix().map((row) => (
                <tr key={row.waiter.id} className="border-t border-border/60">
                  <th scope="row" className="p-1 text-left font-mono">
                    {row.waiter.code}
                  </th>
                  {row.outcomes.map((o, i) => (
                    <td key={i} className="p-1 text-center">
                      {outcomeGlyph[o]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <LiveLine text={live} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Mode "intra": intra-assignment timing                               */
/* ------------------------------------------------------------------ */

const W = 340;
const X0 = 56;
const X1 = W - 14;
const xOf = (t: number) => X0 + (t * (X1 - X0)) / AXIS_END;

function stimulusText(signal: "b" | "d") {
  const [first, ...rest] = STIMULUS[signal];
  return `${signal} holds ${first.value}, then ${rest.map((e) => `${e.value} from ${timeText(e.time)}`).join(" and ")}`;
}

function Timeline({ result, revealed }: { result: IntraResult; revealed: boolean }) {
  const showClock = result.form === "nonblocking-repeat";
  const edges = posedgesOnAxis();
  const signal = result.rhs;
  const lastWrite = result.writes[result.writes.length - 1];
  const onAxis = writeOnAxis(result);
  const label = revealed
    ? intraSummary(result)
    : `${signal ? `${stimulusText(signal)}.` : "No signal is read."}${showClock ? ` clk rises at ${edges.map((t) => timeText(t)).join(", ")}.` : ""}`;
  const yClk = 18;
  const ySig = 46;
  const yProc = 80;
  const yA = 112;
  const ticks = Array.from({ length: AXIS_END + 1 }, (_, t) => t);

  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} 152`} role="img" aria-label={label} className="h-auto w-full max-w-[560px] text-foreground">
        {/* Axis */}
        <line x1={X0} x2={X1} y1={134} y2={134} stroke="currentColor" strokeOpacity={0.5} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xOf(t)} x2={xOf(t)} y1={131} y2={137} stroke="currentColor" strokeOpacity={0.5} />
            {t % 2 === 0 || t === 5 ? (
              <text x={xOf(t)} y={149} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
                {t}
              </text>
            ) : null}
          </g>
        ))}
        {/* Lane labels */}
        {showClock ? (
          <text x={4} y={yClk + 3} fontSize={11} fill="currentColor">
            clk ↑
          </text>
        ) : null}
        {signal ? (
          <text x={4} y={ySig + 3} fontSize={11} fill="currentColor">
            {signal}
          </text>
        ) : null}
        <text x={4} y={yProc + 3} fontSize={11} fill="currentColor">
          process
        </text>
        <text x={4} y={yA + 3} fontSize={11} fill="currentColor">
          a
        </text>
        {/* Clock edges */}
        {showClock
          ? edges.map((t, i) => (
              <g key={t}>
                <line x1={xOf(t)} x2={xOf(t)} y1={yClk - 8} y2={yClk + 8} className="stroke-slate-500" strokeWidth={1.5} />
                <text x={xOf(t) + 2} y={yClk - 2} fontSize={10} fill="currentColor" fillOpacity={0.7}>
                  {i + 1}
                </text>
              </g>
            ))
          : null}
        {/* Signal value segments */}
        {signal
          ? STIMULUS[signal].map((e, i, all) => {
              const end = i + 1 < all.length ? all[i + 1].time : AXIS_END;
              return (
                <g key={e.time}>
                  <rect x={xOf(e.time) + 1} y={ySig - 9} width={xOf(end) - xOf(e.time) - 2} height={18} rx={3} className="fill-indigo-500/10 stroke-indigo-500/60" />
                  <text x={(xOf(e.time) + xOf(end)) / 2} y={ySig + 3} fontSize={11} textAnchor="middle" fill="currentColor">
                    {e.value}
                  </text>
                </g>
              );
            })
          : null}
        {revealed ? (
          <g data-testid="timeline-reveal">
            {/* Process lane: solid while running, dashed while blocked */}
            {result.blocks ? (
              <>
                <line x1={xOf(0)} x2={xOf(result.nextStatementAt)} y1={yProc} y2={yProc} className="stroke-amber-500" strokeWidth={3} strokeDasharray="4 3" />
                <text x={(xOf(0) + xOf(result.nextStatementAt)) / 2} y={yProc - 6} fontSize={10} textAnchor="middle" fill="currentColor">
                  blocked
                </text>
                <line x1={xOf(result.nextStatementAt)} x2={X1} y1={yProc} y2={yProc} className="stroke-cyan-500" strokeWidth={3} />
              </>
            ) : (
              <>
                <line x1={xOf(0)} x2={X1} y1={yProc} y2={yProc} className="stroke-cyan-500" strokeWidth={3} />
                <text x={xOf(0) + 4} y={yProc - 6} fontSize={10} fill="currentColor">
                  runs on, no wait
                </text>
              </>
            )}
            <path d={`M${xOf(result.nextStatementAt)},${yProc + 4} l-4,7 h8 z`} className="fill-cyan-600 dark:fill-cyan-300" />
            <text x={xOf(result.nextStatementAt) + 6} y={yProc + 12} fontSize={10} fill="currentColor">
              next statement
            </text>
            {/* Read marker */}
            {result.readAt !== null && signal ? (
              <>
                <circle cx={xOf(result.readAt)} cy={ySig} r={4} className="fill-amber-400 stroke-amber-700" />
                <text x={xOf(result.readAt) + 6} y={ySig - 11} fontSize={10} fill="currentColor">
                  read {result.valueRead}
                </text>
              </>
            ) : null}
            {/* Write markers */}
            {onAxis ? (
              writeMarkers(result).map((m) => {
                const x = xOf(m.time);
                return (
                  <g key={m.time} data-testid="write-marker">
                    <path d={`M${x},${yA - 6} l6,6 l-6,6 l-6,-6 z`} className="fill-emerald-500/70 stroke-emerald-700" />
                    <text x={x + 8} y={yA + 4} fontSize={10} fill="currentColor">
                      {m.label}
                    </text>
                  </g>
                );
              })
            ) : (
              <text x={X1} y={yA + 3} fontSize={10} textAnchor="end" fill="currentColor">
                {`a = ${lastWrite.value} at ${timeText(lastWrite.time)} →`}
              </text>
            )}
          </g>
        ) : null}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {signal ? `${stimulusText(signal)}.` : "No right-hand side signal is read."}
        {showClock ? ` clk rises at ${edges.map((t) => timeText(t)).join(", ")}.` : ""}
        {revealed ? " Circle: right-hand side read. Diamond: a written. Triangle: the next statement starts. Dashed: the process is blocked." : ""}
      </figcaption>
    </figure>
  );
}

function IntraLab({ start }: { start?: string }) {
  const initialForm = (INTRA_FORMS.find((f) => f.id === start) ?? INTRA_FORMS[0]).id;
  const [form, setForm] = useState<IntraFormId>(initialForm);
  const [count, setCount] = useState<RepeatCountId>("three");
  const result = evaluateIntra(form, count);
  const key = `${form}-${count}`;
  const [firstKey, setFirstKey] = useState<string | null>(null);
  const [secondKey, setSecondKey] = useState<string | null>(null);
  const firstRevealed = firstKey === key;
  const bothRevealed = firstRevealed && secondKey === key;
  const onFirst = useCallback((v: boolean) => setFirstKey(v ? key : null), [key]);
  const onSecond = useCallback((v: boolean) => setSecondKey(v ? key : null), [key]);

  const lines: CodeTraceLine[] = [
    { text: "initial begin  // starts at t = 0", key: "begin" },
    ...result.code.map((t, i) => ({ text: `  ${t}`, key: `stmt-${i}` })),
    { text: '  $display("next statement at %0t", $time);', key: "next" },
    { text: "end", key: "end" },
  ];

  const valueOptions: PredictionOption[] = valueChoices(result).map((c) => ({ id: String(c), label: valueChoiceLabel(c), ...explainValueChoice(result, c) }));
  const timeOptions: PredictionOption[] = TIME_CHOICES.map((c) => ({ id: String(c), label: timeChoiceLabel(c), ...explainTimeChoice(result, c) }));
  const noRepeat = result.repeat !== undefined && result.repeat.waits === 0;
  const bigCount = result.repeat !== undefined && !writeOnAxis(result);

  return (
    <VisualFrame
      label="Timing control explorer: when an assignment reads and writes"
      eyebrow="Intra-assignment timing"
      title="When is b read, when is a written, and when does the process move on?"
      summary="Pick a form. Predict the value a ends with and when the next statement runs, then see the timeline."
      fidelity="model"
      assumptions={TIMING_ASSUMPTIONS}
    >
      <div className="space-y-1">
        <p className={sectionLabel}>Form</p>
        <SegmentedControl<IntraFormId> label="Form" mono value={form} onChange={setForm} options={INTRA_FORMS.map((f) => ({ value: f.id, label: f.code }))} />
      </div>
      {form === "nonblocking-repeat" ? (
        <div className="space-y-1">
          <p className={sectionLabel}>Repeat count n</p>
          <SegmentedControl<RepeatCountId>
            label="Repeat count n"
            mono
            value={count}
            onChange={setCount}
            options={OFFERED_REPEAT_COUNTS.map((id) => ({ value: id, label: REPEAT_COUNTS.find((c) => c.id === id)!.label }))}
          />
        </div>
      ) : null}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="The process" lines={lines} />
        <Timeline result={result} revealed={bothRevealed} />
      </div>

      <PredictionPrompt resetKey={key} question={<>At what time does the {code("$display")} line, the next statement, run?</>} options={timeOptions}>
        <RevealSignal onChange={onFirst} />
      </PredictionPrompt>
      {firstRevealed ? (
        <FocusOnMount label="Second prediction">
          <PredictionPrompt resetKey={key} question={<>What value does {code("a")} end up with?</>} options={valueOptions}>
            <RevealSignal onChange={onSecond} />
            <FocusOnMount label="Timing outcome">
              {result.equivalent.lines.length > 0 ? (
                <CodeTrace label="Table 9-3: the same timing without intra-assignment timing" lines={result.equivalent.lines.map((text) => ({ text }))} />
              ) : null}
              <p className="text-sm text-muted-foreground">{result.equivalent.note}</p>
              {noRepeat ? <Note label="About a count of zero or less, x or z">{NO_REPEAT_NOTE}</Note> : null}
              {bigCount ? (
                <Note label="Display cap">
                  {`The event control repeats ${result.repeat!.waits} times. The lab computes the count and the time (${timeText(result.writes[0].time)} if clk keeps rising every 3 units) and does not simulate the edges.`}
                </Note>
              ) : null}
            </FocusOnMount>
          </PredictionPrompt>
        </FocusOnMount>
      ) : null}
      <LiveLine text={bothRevealed ? intraSummary(result) : ""} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface TimingControlExplorerProps {
  /** "events": edge-detector drill. "intra": intra-assignment timing. "wake": what wakes a waiting process. */
  mode?: ExplorerMode;
  /**
   * A lesson preset (f2c-timing-controls, f2c-sensitivity-lists, f2c-intra-assignment,
   * f3a-wake-rules), which also sets the mode; or a starting drill preset, form or waiter id.
   */
  preset?: string;
}

export default function TimingControlExplorer({ mode = "events", preset }: TimingControlExplorerProps) {
  const lesson = findLessonPreset(preset);
  const activeMode = lesson?.mode ?? mode;
  const start = lesson?.start ?? preset;
  return (
    <div data-testid={`timing-control-explorer-${activeMode}`}>
      {activeMode === "intra" ? <IntraLab start={start} /> : activeMode === "wake" ? <WakeLab start={start} /> : <EventsLab start={start} />}
    </div>
  );
}
