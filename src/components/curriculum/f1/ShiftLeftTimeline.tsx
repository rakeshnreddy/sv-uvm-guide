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

/*
 * The figure (DESIGN.md section 14): the lanes are recessed trays on one time
 * axis, each capped with its step of the fuchsia cost ramp; the tape-out line
 * is the dashed tier-coloured line of the lesson's "Shift left" figure; each
 * placed token is a lit object in its protected colour (emerald match, amber
 * moved, rose error), and the token of the current step is the one focal part:
 * full strength, raised and glowing. Every other token rests at 40%. All of it
 * is paint: gradients and shadows drop in forced colours (box-shadow is forced
 * off there, and each gradient carries forced-colors:bg-none) and the glows in
 * print, where the borders, dashes and glyphs carry every meaning.
 */
const LIT = "shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_3px_6px_-3px_hsl(var(--fig-obj-shadow))]";
const QUIET_BODY =
  "bg-card bg-[linear-gradient(180deg,hsl(var(--foreground)/var(--fig-quiet-top)),hsl(var(--foreground)/var(--fig-quiet-bottom)))] forced-colors:bg-none";

/** Body gradients and the focal glow per state hue, written out in full so Tailwind finds them. */
const tokenHue = {
  emerald: {
    full: "bg-[linear-gradient(180deg,hsl(var(--fig-emerald-body)/var(--fig-obj-top)),hsl(var(--fig-emerald-body)/var(--fig-obj-bottom)))]",
    rest: "bg-[linear-gradient(180deg,hsl(var(--fig-emerald-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-emerald-body)/calc(var(--fig-obj-bottom)*0.4)))]",
    glow: "shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_7px_14px_-5px_hsl(var(--fig-obj-shadow)),0_0_14px_-3px_hsl(var(--fig-emerald)/calc(var(--fig-glow)*0.6))]",
  },
  amber: {
    full: "bg-[linear-gradient(180deg,hsl(var(--fig-amber-body)/var(--fig-obj-top)),hsl(var(--fig-amber-body)/var(--fig-obj-bottom)))]",
    rest: "bg-[linear-gradient(180deg,hsl(var(--fig-amber-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-amber-body)/calc(var(--fig-obj-bottom)*0.4)))]",
    glow: "shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_7px_14px_-5px_hsl(var(--fig-obj-shadow)),0_0_14px_-3px_hsl(var(--fig-amber)/calc(var(--fig-glow)*0.6))]",
  },
  rose: {
    full: "bg-[linear-gradient(180deg,hsl(var(--fig-rose-body)/var(--fig-obj-top)),hsl(var(--fig-rose-body)/var(--fig-obj-bottom)))]",
    rest: "bg-[linear-gradient(180deg,hsl(var(--fig-rose-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-rose-body)/calc(var(--fig-obj-bottom)*0.4)))]",
    glow: "shadow-[inset_0_1px_0_hsl(var(--fig-obj-highlight)),0_7px_14px_-5px_hsl(var(--fig-obj-shadow)),0_0_14px_-3px_hsl(var(--fig-rose)/calc(var(--fig-glow)*0.6))]",
  },
} as const;

const kindCue: Record<PlacementKind, { glyph: string; text: string; hue: keyof typeof tokenHue; className: string; cueClass: string }> = {
  earliest: { glyph: "✓", text: "earliest catcher", hue: "emerald", className: "border-fig-emerald", cueClass: "text-fig-emerald-text" },
  moved: { glyph: "→", text: "moved right", hue: "amber", className: "border-dashed border-fig-amber", cueClass: "text-fig-amber-text" },
  escaped: { glyph: "✕", text: "passed tape-out", hue: "rose", className: "border-fig-rose", cueClass: "text-fig-rose-text" },
};

/** The fuchsia cost ramp, one step per lane; the lane after tape-out spans the lab (step 4) and the field (step 5). */
const laneRamp: Record<TimelineStageId, string[]> = {
  spec: ["bg-fig-ramp-1"],
  rtl: ["bg-fig-ramp-2"],
  integration: ["bg-fig-ramp-3"],
  "after-tape-out": ["bg-fig-ramp-4", "bg-fig-ramp-5"],
};

/** A lane: a recessed tray (a well) with an inner shadow; the lanes carry the well outline of the lesson's "Shift left" figure. */
const TRAY = "bg-[hsl(var(--fig-well))] shadow-[inset_0_2px_8px_-2px_hsl(var(--fig-obj-shadow))]";

const toggleClass =
  "flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/** Mounted only inside a revealed prompt, so the parent knows the answer is on screen. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

const glyphDisc = "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 font-mono text-xs font-semibold";

/**
 * A token. Waiting in the tray it is a neutral glass pill. Placed, it is a lit
 * card in the colour of its kind: the glyph and the cost on the top line, the
 * name below (so a narrow lane never breaks a word). `focal` marks the token of
 * the current step: full strength, raised, glowing; the others rest at 40%.
 */
function Token({ placement, glyph, short, focal = false }: { placement?: Placement; glyph: string; short: string; focal?: boolean }) {
  if (!placement) {
    return (
      <span
        data-testid="token-waiting"
        className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs text-foreground", QUIET_BODY, LIT)}
      >
        <span aria-hidden className={glyphDisc}>
          {glyph}
        </span>
        <span className="min-w-0 break-words">{short}</span>
      </span>
    );
  }
  const cue = kindCue[placement.kind];
  const hue = tokenHue[cue.hue];
  return (
    <span
      data-testid={`token-${placement.bug.id}`}
      data-focal={focal || undefined}
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border-[1.5px] bg-card px-2 py-1.5 text-xs text-foreground transition-colors motion-reduce:transition-none forced-colors:bg-none print:shadow-none",
        cue.className,
        focal ? hue.full : hue.rest,
        focal ? hue.glow : LIT,
      )}
    >
      {/*
       * One line where the lane is full width (below md: the wrapper is `contents`,
       * so glyph, name and cost share the token's row). From md the glyph and the
       * cost are one row that never splits (the cost wraps beside the glyph, not
       * under it), and the name sits below. The cost is in the foreground colour
       * and only its glyph in the kind's hue, so every multiplier reads as one family.
       */}
      <span className="contents md:flex md:w-full md:min-w-0 md:items-start md:justify-between md:gap-0.5">
        <span aria-hidden className={glyphDisc}>
          {glyph}
        </span>
        <span className="order-3 ml-auto shrink-0 break-normal text-right font-mono text-xs font-semibold leading-5 text-foreground md:order-none md:min-w-0 md:shrink">
          <span aria-hidden className={cue.cueClass}>
            {cue.glyph}{" "}
          </span>
          {placement.multiplierText}
        </span>
      </span>
      <span className={cn("order-2 min-w-0 flex-1 leading-snug md:basis-full", focal ? "font-semibold" : null)}>{short}</span>
    </span>
  );
}

/**
 * The project timeline. Vertical below md (390 px phones), horizontal from md.
 * `placed` holds the tokens revealed so far; the rest wait in the tray.
 */
function Timeline({ enabled, placed, current }: { enabled: ReadonlySet<ActivityId>; placed: Placement[]; current?: Placement }) {
  const placedIds = new Set(placed.map((p) => p.bug.id));
  const waiting = BUGS.filter((b) => !placedIds.has(b.id));
  // The current token, when it moved or escaped, leaves a dashed empty slot in the lane of its earliest catcher.
  const ghostStage = current && current.kind !== "earliest" && current.earliest.stage !== current.stage ? current.earliest.stage : null;
  const lane = (id: TimelineStageId) => {
    const stage = TIMELINE.find((s) => s.id === id)!;
    const tokens = placed.filter((p) => p.stage === id);
    const acts = ACTIVITIES.filter((a) => a.stage === id);
    return (
      <div key={id} data-testid={`lane-${id}`} className={cn("relative min-w-0 overflow-hidden rounded-xl border border-fig-generic/55 p-2.5", TRAY)}>
        {/* The lane's step of the cost ramp: a solid cap along the top edge, labelled by the multiplier beside the lane name. */}
        <span aria-hidden className="absolute inset-x-0 top-0 flex h-[5px]">
          {laneRamp[id].map((c) => (
            <span key={c} className={cn("flex-1 [forced-color-adjust:none] forced-colors:bg-[CanvasText]", c)} />
          ))}
        </span>
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold text-foreground">
          <span>{stage.label}</span>
          <span className="font-mono text-xs font-semibold text-fig-ramp-text">{laneMultiplierText(id)}</span>
        </p>
        {acts.length > 0 ? (
          <ul aria-label={`Activities ${stage.phrase}`} className="mt-1.5 flex flex-wrap gap-1">
            {acts.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-xs",
                  enabled.has(a.id)
                    ? cn(
                        "border-fig-cyan bg-card bg-[linear-gradient(180deg,hsl(var(--fig-cyan-body)/calc(var(--fig-obj-top)*0.4)),hsl(var(--fig-cyan-body)/calc(var(--fig-obj-bottom)*0.4)))] text-foreground forced-colors:bg-none",
                        LIT,
                      )
                    : "border-dashed border-fig-generic text-muted-foreground line-through",
                )}
              >
                {a.short}
                <span className="sr-only">{enabled.has(a.id) ? " (on)" : " (off)"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Post-silicon validation (always runs)</p>
        )}
        <div className="mt-2 flex min-h-8 flex-col items-start gap-1.5" aria-hidden>
          {/* The slot the current token left: an empty outline of a token holding only its number, so it borrows no legend cue. */}
          {ghostStage === id && current ? (
            <span
              data-testid="token-ghost"
              className="flex w-full items-center rounded-lg border-[1.5px] border-dashed border-fig-generic px-2 py-1.5"
            >
              <span className={cn(glyphDisc, "bg-transparent text-muted-foreground ring-1 ring-inset ring-fig-generic")}>{current.bug.glyph}</span>
            </span>
          ) : null}
          {tokens.map((p) => (
            <Token key={p.bug.id} placement={p} glyph={p.bug.glyph} short={p.bug.short} focal={p.bug.id === current?.bug.id} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_1.25fr]">
        {lane("spec")}
        {lane("rtl")}
        {lane("integration")}
        {/* The tape-out line of the lesson's "Shift left" figure: dashed, in the tier colour, with its halo at half strength so the tokens lead. */}
        <div aria-hidden className="relative flex items-center gap-2 md:flex-col md:justify-center md:px-1">
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-tier-current/25 blur-[4px] forced-colors:hidden print:hidden md:inset-x-auto md:inset-y-0 md:left-1/2 md:h-auto md:w-[7px] md:-translate-x-1/2 md:translate-y-0" />
          <span className="relative h-0 flex-1 border-t-[2.5px] border-dashed border-tier-current md:h-auto md:w-0 md:border-l-[2.5px] md:border-t-0" />
          <span className="relative rounded-md border-[1.5px] border-tier-current bg-card px-2 py-0 text-label leading-[13px] text-foreground shadow-[inset_0_0_0_999px_hsl(var(--tier-current)/0.16)]">
            tape-out
          </span>
          <span className="relative h-0 flex-1 border-t-[2.5px] border-dashed border-tier-current md:h-auto md:w-0 md:border-l-[2.5px] md:border-t-0" />
        </div>
        {lane("after-tape-out")}
        {/* One time axis under the lanes (from md, where the lanes run left to right), as in the lesson's figure. */}
        <span aria-hidden className="pointer-events-none absolute -bottom-[6px] left-0 right-2.5 hidden h-[3px] rounded-full bg-fig-generic forced-colors:bg-[CanvasText] md:block">
          <span className="absolute -right-2 top-1/2 -translate-y-1/2 border-y-[4px] border-l-[8px] border-y-transparent border-l-fig-generic [forced-color-adjust:none] forced-colors:border-l-[CanvasText]" />
        </span>
      </div>
      {waiting.length > 0 ? (
        <div data-testid="token-tray" className={cn("rounded-xl border border-dashed border-fig-generic p-2.5", TRAY)} aria-hidden>
          <p className="text-xs text-muted-foreground">Not placed yet</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {waiting.map((b) => (
              <Token key={b.id} glyph={b.glyph} short={b.short} />
            ))}
          </div>
        </div>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        <span className="fig-chip !border-fig-emerald !py-0 leading-[13px]">
          <span aria-hidden className="font-semibold text-fig-emerald-text">✓</span> earliest catcher
        </span>{" "}
        {/* Each separator travels with the chip after it, so a line never ends on "·". */}
        <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
          ·{" "}
          <span className="fig-chip !border-dashed !border-fig-amber !py-0 leading-[13px]">
            <span aria-hidden className="font-semibold text-fig-amber-text">→</span> moved right (dashed)
          </span>
        </span>{" "}
        <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
          ·{" "}
          <span className="fig-chip !border-fig-rose !py-0 leading-[13px]">
            <span aria-hidden className="font-semibold text-fig-rose-text">✕</span> passed tape-out
          </span>
        </span>
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

const sectionHeadingClass = "text-label text-muted-foreground";

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
      <Timeline enabled={enabled} placed={placed} current={current} />
      <PositionList placed={placed} />
      {complete ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          data-testid="shift-left-summary"
          className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      className={cn("fig-panel", className)}
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
