"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  ACTIVITIES,
  BUGS,
  PRESETS,
  PUSH_FURTHER,
  TIMELINE,
  bug,
  configKey,
  findPreset,
  laneMultiplierText,
  lateStageNote,
  movedCaveat,
  predictionOptions,
  revealOrder,
  runTimeline,
  summarizeRun,
  type ActivityId,
  type BugId,
  type Placement,
  type PlacementKind,
  type ShiftLeftPresetId,
  type TimelineStageId,
} from "@/lib/shift-left-model";
import { cn } from "@/lib/utils";

export interface ShiftLeftTimelineProps {
  /** "shift-left" (default), "schedule-slipped", "late-stages" or "late-discovery". */
  preset?: ShiftLeftPresetId;
  className?: string;
}

export const SHIFT_LEFT_ASSUMPTIONS = [
  "A conceptual illustration. No standard defines shift left or what each activity catches; the bug kinds and their earliest catchers come from this lesson's shift-left table, quiz question 10 and its pitfall paragraph. Real projects differ.",
  "The multipliers are the lesson's rule of thumb from the cost graph (each later stage about ten times the one before), not measured data.",
  "One toggle stands for full-chip simulation and emulation, which share one row of the cost ladder (×100). The lesson gives bugs that only real software exposes to emulation or FPGA prototyping, which run fast enough for software.",
  `A token moves only to an activity that catches its kind reliably. The lesson's schedule-slip reveal moves the bugs lint and block simulation miss to full-chip simulation or emulation and, for the ones that only the lab or a customer will hit, past the tape-out line. A moved token shows the first, best case; its sentence and the summary add the second: "${movedCaveat()}"`,
  "For spec contradictions, control corner cases, boot hangs and block interactions no later pre-tape-out activity is modelled as a reliable catcher. Formal on blocks is not credited with one-block functional bugs either: the lesson's table lists those under block-level simulation only, so with it off they move to full-chip simulation or emulation.",
  "Post-silicon validation always runs and is not a toggle. After tape-out the model does not decide between the lab and the field, so it shows ×1,000 or more.",
  "Each token stands for one kind of bug, not a count of bugs.",
];

const kindCue: Record<PlacementKind, { glyph: string; text: string; className: string }> = {
  earliest: { glyph: "✓", text: "earliest catcher", className: "border-emerald-500/70 bg-emerald-500/10" },
  moved: { glyph: "→", text: "moved right", className: "border-dashed border-amber-500/80 bg-amber-500/10" },
  escaped: { glyph: "✕", text: "passed tape-out", className: "border-rose-500/70 bg-rose-500/10" },
};

const toggleClass =
  "flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/** Mounted only inside a revealed prompt, so the parent knows the answer is on screen. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

function Token({ placement, glyph, short }: { placement?: Placement; glyph: string; short: string }) {
  const cue = placement ? kindCue[placement.kind] : null;
  return (
    <span
      data-testid={`token-${placement?.bug.id ?? "waiting"}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-foreground transition-colors motion-reduce:transition-none",
        cue ? cue.className : "border-border/70 bg-background/60",
      )}
    >
      <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 font-mono text-[11px] font-semibold">
        {glyph}
      </span>
      <span className="min-w-0 break-words">{short}</span>
      {placement && cue ? (
        <span className="shrink-0 font-mono text-[11px] font-semibold">
          <span aria-hidden>{cue.glyph} </span>
          {placement.multiplierText}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The project timeline. Vertical below md (390 px phones), horizontal from md.
 * `placed` holds the tokens revealed so far; the rest wait in the tray.
 */
function Timeline({ enabled, placed }: { enabled: ReadonlySet<ActivityId>; placed: Placement[] }) {
  const placedIds = new Set(placed.map((p) => p.bug.id));
  const waiting = BUGS.filter((b) => !placedIds.has(b.id));
  const lane = (id: TimelineStageId) => {
    const stage = TIMELINE.find((s) => s.id === id)!;
    const tokens = placed.filter((p) => p.stage === id);
    const acts = ACTIVITIES.filter((a) => a.stage === id);
    return (
      <div
        key={id}
        data-testid={`lane-${id}`}
        className={cn(
          "min-w-0 rounded-xl border p-2.5",
          stage.afterTapeOut ? "border-rose-500/40 bg-rose-500/[0.04]" : "border-border/70 bg-background/40",
        )}
      >
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold text-foreground">
          <span>{stage.label}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">{laneMultiplierText(id)}</span>
        </p>
        {acts.length > 0 ? (
          <ul aria-label={`Activities ${stage.phrase}`} className="mt-1.5 flex flex-wrap gap-1">
            {acts.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[11px]",
                  enabled.has(a.id) ? "border-cyan-500/60 bg-cyan-500/10 text-foreground" : "border-dashed border-border/70 text-muted-foreground line-through",
                )}
              >
                {a.short}
                <span className="sr-only">{enabled.has(a.id) ? " (on)" : " (off)"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Post-silicon validation (always runs)</p>
        )}
        <div className="mt-2 flex min-h-8 flex-col items-start gap-1.5" aria-hidden>
          {tokens.map((p) => (
            <Token key={p.bug.id} placement={p} glyph={p.bug.glyph} short={p.bug.short} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_1.25fr]">
        {lane("spec")}
        {lane("rtl")}
        {lane("integration")}
        <div aria-hidden className="flex items-center gap-2 md:flex-col md:justify-center">
          <span className="h-0 flex-1 border-t-2 border-dashed border-foreground/50 md:h-auto md:w-0 md:border-l-2 md:border-t-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">tape-out</span>
          <span className="h-0 flex-1 border-t-2 border-dashed border-foreground/50 md:h-auto md:w-0 md:border-l-2 md:border-t-0" />
        </div>
        {lane("after-tape-out")}
      </div>
      {waiting.length > 0 ? (
        <div data-testid="token-tray" className="rounded-xl border border-dashed border-border/70 p-2.5" aria-hidden>
          <p className="text-xs text-muted-foreground">Not placed yet</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {waiting.map((b) => (
              <Token key={b.id} glyph={b.glyph} short={b.short} />
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <span aria-hidden>✓</span> earliest catcher · <span aria-hidden>→</span> moved right (dashed) · <span aria-hidden>✕</span> passed tape-out
      </p>
    </div>
  );
}

/** Text alternative: every token's position, in token order. */
function PositionList({ placed }: { placed: Placement[] }) {
  const byId = new Map(placed.map((p) => [p.bug.id, p]));
  return (
    <ol aria-label="Token positions" className="space-y-1 text-sm">
      {BUGS.map((b) => {
        const p = byId.get(b.id);
        return (
          <li key={b.id} className={cn("rounded-lg px-2 py-1", p ? "text-foreground" : "text-muted-foreground")}>
            <span className="mr-1.5 font-mono text-xs font-semibold">{b.glyph}</span>
            {p ? (
              <>
                {p.sentence} <span className="text-xs text-muted-foreground">({kindCue[p.kind].text})</span>
              </>
            ) : (
              `${b.short}: not placed yet.`
            )}
          </li>
        );
      })}
    </ol>
  );
}

const sectionHeadingClass = "text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground";

/**
 * The prediction prompt's feedback block (its polite live region), made
 * focusable so it is the first thing a screen reader reads after "Lock in".
 */
function findFeedback(prompt: HTMLElement | null): HTMLElement | null {
  const el = prompt?.querySelector<HTMLElement>('[aria-live="polite"]') ?? null;
  if (el && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  return el;
}

function RevealedRun({
  enabled,
  focus,
  getFeedback,
}: {
  enabled: ReadonlySet<ActivityId>;
  focus: BugId;
  /** The prediction feedback to move focus to when the pressed button unmounted. */
  getFeedback: () => HTMLElement | null;
}) {
  const run = useMemo(() => runTimeline(enabled), [enabled]);
  const order = useMemo(() => revealOrder(focus), [focus]);
  const playback = usePlayback(order.length);
  const shown = order.slice(0, playback.index + 1);
  const placed = run.filter((p) => shown.includes(p.bug.id));
  const current = run.find((p) => p.bug.id === order[playback.index])!;
  const summary = summarizeRun(run);
  const note = lateStageNote(enabled);
  const complete = playback.index === order.length - 1;

  // A live region announces changes, not the text it mounts with: start empty.
  const [announce, setAnnounce] = useState(false);
  useEffect(() => setAnnounce(true), []);

  // "Lock in prediction" and "Place every token" unmount when pressed; keep
  // keyboard and screen-reader users in place instead of dropping focus to <body>.
  // After "Lock in", focus goes to the prediction feedback (above this group, so
  // reading forward continues into the run); the group itself is the fallback.
  const rootRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [focusSummary, setFocusSummary] = useState(false);
  useEffect(() => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active && active !== document.body) return;
    const feedback = getFeedback();
    if (feedback) feedback.focus();
    else rootRef.current?.focus();
    // getFeedback is stable (useCallback with no deps), so this runs on mount
    // only; the run remounts (by key) for every new prediction.
  }, [getFeedback]);
  useEffect(() => {
    if (complete && focusSummary) {
      summaryRef.current?.focus();
      setFocusSummary(false);
    }
  }, [complete, focusSummary]);

  return (
    <div ref={rootRef} tabIndex={-1} data-testid="shift-left-result" aria-label="Run result" role="group" className="space-y-3 focus:outline-none">
      <PlaybackControls
        playback={playback}
        stepCount={order.length}
        stepNoun="Token"
        describeStep={(i) => bug(order[i]).short}
      />
      <p role="status" aria-live="polite" className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] p-2.5 text-sm text-foreground">
        {announce ? (
          <>
            <strong>
              Token {playback.index + 1} of {order.length}:
            </strong>{" "}
            {current.sentence}
          </>
        ) : null}
      </p>
      <Timeline enabled={enabled} placed={placed} />
      <PositionList placed={placed} />
      {complete ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          data-testid="shift-left-summary"
          className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p>{summary.sentence}</p>
          {note ? <p>{note}</p> : null}
          <p className="text-muted-foreground">{PUSH_FURTHER}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFocusSummary(true);
            playback.seek(order.length - 1);
          }}
          className="inline-flex min-h-10 items-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Place every token
        </button>
      )}
    </div>
  );
}

export default function ShiftLeftTimeline({ preset = "shift-left", className }: ShiftLeftTimelineProps) {
  const initial = findPreset(preset);
  const [presetId, setPresetId] = useState<ShiftLeftPresetId | null>(initial.id);
  const [enabled, setEnabled] = useState<ReadonlySet<ActivityId>>(() => new Set(initial.enabled));
  const [focus, setFocus] = useState<BugId>(initial.focus);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const key = configKey(enabled, focus);
  const revealed = revealedKey === key;
  const onReveal = useCallback(() => setRevealedKey(key), [key]);

  const applyPreset = (id: ShiftLeftPresetId) => {
    const p = findPreset(id);
    setPresetId(p.id);
    setEnabled(new Set(p.enabled));
    setFocus(p.focus);
  };

  const toggle = (id: ActivityId) => {
    setPresetId(null);
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const options: PredictionOption[] = predictionOptions(focus, enabled).map((o) => ({
    id: o.id,
    label: (
      <span>
        {TIMELINE.find((s) => s.id === o.id)!.label} <span className="font-mono text-xs text-muted-foreground">{laneMultiplierText(o.id)}</span>
      </span>
    ),
    correct: o.correct,
    feedback: o.feedback,
  }));
  const activePreset = presetId ? findPreset(presetId) : null;
  const focusBug = bug(focus);
  const presetsHeadingId = useId();
    const promptRef = useRef<HTMLDivElement>(null);
  const getFeedback = useCallback(() => findFeedback(promptRef.current), []);

  return (
    <VisualFrame
      label="Shift-left timeline"
      eyebrow="Experiment"
      title="Switch activities off and watch where the bugs go"
      summary="Six kinds of bug, one project timeline. Each kind has an earliest activity that catches it reliably. Predict where one bug is found, then place the tokens."
      fidelity="illustration"
      assumptions={SHIFT_LEFT_ASSUMPTIONS}
      className={className}
    >
      <div className="space-y-2">
        <h4 id={presetsHeadingId} className={sectionHeadingClass}>
          Presets
        </h4>
        <div role="group" aria-labelledby={presetsHeadingId} className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetId === p.id}
              onClick={() => applyPreset(p.id)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                presetId === p.id ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{activePreset ? activePreset.setup : "Your own mix of activities."}</p>
      </div>

      <fieldset className="space-y-2">
        <legend>
          <h4 className={sectionHeadingClass}>Activities before tape-out</h4>
        </legend>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
          {ACTIVITIES.map((a) => {
            const on = enabled.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(a.id)}
                className={cn(toggleClass, on ? "border-cyan-500/70 bg-cyan-500/10" : "border-dashed border-border/70 bg-background/40")}
              >
                <span aria-hidden className="mt-0.5 font-mono text-xs font-semibold">
                  {on ? "ON" : "OFF"}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{a.label}</span>
                  <span className="block text-xs text-muted-foreground">{a.when}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <h4 className={sectionHeadingClass}>
          Bug to predict
        </h4>
        <SegmentedControl
          label="Bug to predict"
          options={BUGS.map((b) => ({ value: b.id, label: `${b.glyph} · ${b.short}` }))}
          value={focus}
          onChange={(v) => setFocus(v)}
        />
      </div>

      <div ref={promptRef}>
        <PredictionPrompt
          resetKey={key}
          question={
            <>
              With these activities, where is <em>{focusBug.label.toLowerCase()}</em> found?
            </>
          }
          options={options}
        >
          <RevealSignal onReveal={onReveal} />
        </PredictionPrompt>
      </div>

      {revealed ? (
        <RevealedRun key={key} enabled={enabled} focus={focus} getFeedback={getFeedback} />
      ) : (
        <div className="space-y-3">
          <Timeline enabled={enabled} placed={[]} />
          <p className="text-sm text-muted-foreground">Lock in a prediction to place the tokens. Changing an activity or the bug starts a new run.</p>
        </div>
      )}
    </VisualFrame>
  );
}
