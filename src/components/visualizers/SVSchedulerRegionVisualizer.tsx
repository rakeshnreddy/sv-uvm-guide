"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback, type PlaybackApi } from "@/components/visual-system/usePlayback";
import { RegionLadder } from "@/components/visuals/scheduler/RegionLadder";
import { TraceNarration } from "@/components/visuals/scheduler/TraceNarration";
import { regionGuideById } from "@/components/visuals/scheduler/region-guide";
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot, slotTimeLabel, type RegionId, type TraceStep } from "@/lib/sv-scheduler-model";
import {
  DELTA_DEFINITION,
  REGION_CLAUSES,
  decisionDeltaSummary,
  decisionFeedback,
  decisionQuestion,
  decisionRecap,
  groupLandingsByRegion,
  isDecisionAnswer,
  nextRegionOptions,
  regionDecisions,
  regionLandings,
  regionMapSource,
  type RegionLanding,
} from "@/lib/sv-region-map-model";
import { allRegionMapScenarioPresets, getAnyRegionMapPreset, type AnyRegionMapScenarioId } from "@/lib/sv-region-map-scenarios-extra";
import { cn } from "@/lib/utils";

export const REGION_MAP_ASSUMPTIONS = [
  `One time slot at a rising clock edge (t = 10 ns unless the scenario states another slot time), following the region loop of IEEE 1800-2023 §4.5. Steps count scheduler work, not nanoseconds; Δ is ${DELTA_DEFINITION} (the standard defines no delta count).`,
  "Each event is filed under the region it was scheduled in (§4.4.2). Events from Inactive, NBA, Observed, Re-Inactive and Re-NBA are moved to Active or Reactive and executed there, as §4.5 describes.",
  "Continuous assignments are modelled as processes sensitive to their right-hand side (§4.9.1); always_comb likewise (§9.2.2.2).",
  "Program-block code runs in the reactive region set and its `<=` updates land in Re-NBA (§24.3.1). The program/endprogram lines are generated from the model's context flag.",
  "Clocking blocks use the defaults (§14.3): #1step input skew samples in Preponed (§14.13), the @(cb) event triggers in Observed (§14.10) and #0 output skew drives in Re-NBA (§14.16).",
  "Clocking limits: the model treats every cb.sig <= v as coincident with its clocking event and every cb.sig read as this slot's Preponed sample. A drive away from the clocking event acts at the next one (§14.16), and a read after @(posedge clk) rather than @(cb) may see the old or the new sample (§14.13); no scenario here does either.",
  "Processes are small structured programs generated from the code shown, not parsed SystemVerilog. These scenarios have one legal order each, so no scheduler choice appears.",
  "Next-region mode pauses whenever the executing region runs dry, and when Active and Reactive both hold work, and asks where the loop goes; the answer is read from the same trace, and the explanation paraphrases §4.5.",
];

export type SchedulerRegionMode = "log" | "next-region";

/** Calls `onReveal(index)` once, when the prediction prompt renders its revealed content. */
function RevealSignal({ index, onReveal }: { index: number; onReveal: (index: number) => void }) {
  useEffect(() => {
    onReveal(index);
  }, [index, onReveal]);
  return null;
}

/** Tells the parent whether the open gate has been answered: mounted only inside PredictionPrompt's revealed content. */
function GateRevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

/** Shown instead of the step's explanation while a decision is open, because the explanation can name the answer. */
const GATE_HIDDEN_WHY = "Answer the decision below first; the explanation of this step appears once you commit.";

/** At 390 px the nine options sit in two compact columns, so the queues and the question stay on one screen. */
const COMPACT_GATE_OPTIONS = "max-sm:p-3 max-sm:[&_fieldset>div]:grid-cols-2 max-sm:[&_fieldset>div]:gap-1.5 max-sm:[&_label]:min-h-10 max-sm:[&_label]:p-2 max-sm:[&_label]:text-xs";

/** Renders `code` spans of a prompt as inline code. */
function PromptText({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]">
            {part}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

const familyCue: Record<string, string> = {
  readOnly: "read-only",
  activeSet: "active set",
  observed: "between the sets",
  reactiveSet: "reactive set",
};

function LandingMap({
  grouped,
  currentStep,
  onSeek,
  shownThrough,
}: {
  grouped: Record<RegionId, RegionLanding[]>;
  currentStep: number;
  onSeek: (index: number) => void;
  /** While a next-region decision is pending, landings after this step stay hidden: they would give the answer away. */
  shownThrough?: number;
}) {
  return (
    <ol aria-label="Where each event landed" className="space-y-1.5">
      {REGION_ORDER.map((region) => {
        const items = shownThrough === undefined ? grouped[region] : grouped[region].filter((l) => l.stepIndex <= shownThrough);
        const guide = regionGuideById[region];
        const readOnly = guide.family === "readOnly";
        return (
          <li
            key={region}
            className={cn(
              "flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-2",
              readOnly ? "border-dashed border-slate-400/60" : items.length === 0 ? "border-border/40" : "border-border/70",
            )}
          >
            <div className="w-32 shrink-0">
              <p className="text-sm font-semibold text-foreground">{REGION_LABELS[region]}</p>
              <p className="text-[11px] text-muted-foreground">
                {familyCue[guide.family]} · {REGION_CLAUSES[region]}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 basis-40 flex-wrap items-start gap-1.5">
              {items.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  <span aria-hidden>—</span>
                  <span className="sr-only">{shownThrough === undefined ? "nothing landed here" : "nothing landed here yet"}</span>
                </span>
              ) : (
                items.map((l) => {
                  const isCurrent = l.stepIndex === currentStep;
                  const isFuture = l.stepIndex > currentStep;
                  return (
                    <button
                      key={l.stepIndex}
                      type="button"
                      onClick={() => onSeek(l.stepIndex)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Go to step ${l.stepIndex + 1}: ${l.label}, delta ${l.delta}${isFuture ? ", not executed yet" : ""}`}
                      className={cn(
                        "inline-flex min-h-10 max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left font-mono text-[11px] transition-colors motion-reduce:transition-none [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isCurrent
                          ? "border-cyan-500 bg-cyan-500/15 text-foreground"
                          : isFuture
                            ? "border-dashed border-border/70 text-muted-foreground"
                            : "border-border/70 bg-background/60 text-foreground hover:bg-muted",
                      )}
                    >
                      {isCurrent ? <span aria-hidden>▶</span> : null}
                      <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">Δ{l.delta}</span>
                      <span className="min-w-0 break-words">{l.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** What is queued on every rung at the current step: the facts a learner needs to say where the loop goes next. */
function QueueChips({ step }: { step: TraceStep }) {
  return (
    <ol aria-label="Queued events by region" className="space-y-1 rounded-lg border border-border/70 bg-background/40 p-2 text-[11px]">
      {REGION_ORDER.filter((r) => r !== "preponed").map((region) => {
        const items = step.queues[region];
        return (
          <li key={region} className="flex flex-wrap items-center gap-1">
            <span className="w-20 shrink-0 font-semibold text-muted-foreground">
              {REGION_LABELS[region]}
              <span className="sr-only"> queue:</span>
            </span>
            {items.length === 0 ? (
              <span className="text-muted-foreground">
                <span aria-hidden>—</span>
                <span className="sr-only">empty</span>
              </span>
            ) : (
              items.map((q, i) => (
                <span key={`${i}-${q.label}`} className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-foreground [font-variant-ligatures:none]">
                  {q.label}
                </span>
              ))
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface SVSchedulerRegionVisualizerProps {
  scenario?: AnyRegionMapScenarioId;
  /** Restrict the scenario picker; defaults to every region-map preset. */
  scenarios?: AnyRegionMapScenarioId[];
  /**
   * 'log' (default): predict, then step through the slot and its log.
   * 'next-region': playback also pauses whenever the executing region runs
   * dry and asks where the loop of §4.5 goes next.
   */
  mode?: SchedulerRegionMode;
}

/**
 * F3B region map: for one time slot, which events land in which region.
 * Everything shown is read from `simulateTimeSlot`; the learner predicts
 * before the trace and the map are revealed. In next-region mode the trace
 * also stops at every point where the loop had to pick its next region.
 */
export const SVSchedulerRegionVisualizer = ({ scenario: initial = "comb-after-nba", scenarios, mode = "log" }: SVSchedulerRegionVisualizerProps) => {
  const presets = scenarios ? allRegionMapScenarioPresets.filter((p) => scenarios.includes(p.id)) : allRegionMapScenarioPresets;
  const [scenarioId, setScenarioId] = useState<AnyRegionMapScenarioId>(initial);
  const [committed, setCommitted] = useState<number[]>([]);
  const [answered, setAnswered] = useState(0);
  /** First answer given at each decision, by decision number. "Reveal without predicting" records nothing. */
  const [decisionResults, setDecisionResults] = useState<Record<number, boolean>>({});
  const [gateRevealed, setGateRevealed] = useState(false);
  const [showLockedPredictions, setShowLockedPredictions] = useState(false);
  const preset = getAnyRegionMapPreset(scenarioId);
  const scenario = useMemo(() => preset.build(), [preset]);
  const run = useMemo(() => simulateTimeSlot(scenario), [scenario]);
  const landings = useMemo(() => regionLandings(scenario, run), [scenario, run]);
  const grouped = useMemo(() => groupLandingsByRegion(landings), [landings]);
  const predictions = useMemo(() => preset.predictions(scenario, run), [preset, scenario, run]);
  const source = useMemo(() => regionMapSource(scenario), [scenario]);
  const lines: CodeTraceLine[] = useMemo(() => source.map((l) => ({ text: l.text, key: l.key, owner: l.owner })), [source]);
  const decisions = useMemo(() => (mode === "next-region" ? regionDecisions(run) : []), [mode, run]);
  const revealed = committed.length >= predictions.length;

  // Next-region gate: playback may not pass the step before the pending decision.
  const pending = decisions[answered];
  const limit = pending ? Math.max(0, pending.index - 1) : run.trace.length - 1;
  const playback = usePlayback(run.trace.length, scenarioId);
  const shownIndex = Math.min(playback.index, limit);
  const step = run.trace[shownIndex];
  const atGate = Boolean(pending) && playback.index >= limit;

  useEffect(() => {
    if (playback.index > limit) {
      playback.pause();
      playback.seek(limit);
    } else if (playback.isPlaying && playback.index >= limit) {
      playback.pause();
    }
  }, [playback, limit]);

  // A decision disables the Next button the learner just used, and Continue
  // unmounts itself, so both moves take keyboard focus somewhere useful.
  const gateRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<HTMLDivElement>(null);
  const focusAfterContinue = useRef(false);
  const gateQuestionId = useId();
  const predictionsId = useId();
  const openGateKey = revealed && atGate && pending ? `${scenarioId}:${answered}` : null;

  useEffect(() => {
    if (openGateKey !== null) gateRef.current?.focus();
  }, [openGateKey]);

  useEffect(() => {
    if (!focusAfterContinue.current) return;
    focusAfterContinue.current = false;
    if (gateRef.current) return;
    const group = playbackRef.current;
    const nextButton = group?.querySelector<HTMLButtonElement>('button[aria-label^="Next"]');
    (nextButton && !nextButton.disabled ? nextButton : group?.querySelector<HTMLInputElement>('input[type="range"]'))?.focus();
  }, [answered]);

  const onReveal = useCallback((index: number) => setCommitted((prev) => (prev.includes(index) ? prev : [...prev, index])), []);

  // Locking in an answer (or revealing without one) unmounts the button that had focus. Continue mounts in the same commit, so it takes over.
  const focusOnMount = useCallback((button: HTMLButtonElement | null) => button?.focus(), []);

  const recordDecision = (decision: number, correct: boolean) => setDecisionResults((prev) => (decision in prev ? prev : { ...prev, [decision]: correct }));

  const changeScenario = (id: AnyRegionMapScenarioId) => {
    setScenarioId(id);
    setCommitted([]);
    setAnswered(0);
    setDecisionResults({});
    setShowLockedPredictions(false);
    // In the same batch as the scenario, or the clamp above would seek the new scenario to the old index.
    playback.reset();
  };

  const retryDecisions = () => {
    focusAfterContinue.current = true;
    setAnswered(0);
    setDecisionResults({});
    playback.reset();
  };

  const continueStepping = () => {
    const next = decisions[answered + 1];
    const nextLimit = next ? Math.max(0, next.index - 1) : run.trace.length - 1;
    focusAfterContinue.current = true;
    setAnswered((a) => a + 1);
    if (nextLimit > playback.index) playback.stepForward();
  };

  const gated: PlaybackApi = {
    ...playback,
    index: shownIndex,
    isLast: playback.index >= limit,
    stepForward: () => {
      if (playback.index < limit) playback.stepForward();
    },
    seek: (index: number) => playback.seek(Math.min(index, limit)),
    play: () => {
      if (playback.index < limit) playback.play();
    },
    toggle: () => {
      if (playback.isPlaying) playback.pause();
      else if (playback.index < limit) playback.play();
    },
  };

  const counts = useMemo(() => {
    const out: Partial<Record<RegionId, number>> = {};
    REGION_ORDER.forEach((r) => (out[r] = step.queues[r].length));
    return out;
  }, [step]);

  const contextKeys = revealed && step.processId ? source.filter((l) => l.processId === step.processId && l.key).map((l) => l.key as string) : [];
  const currentRegion: RegionId | undefined = !revealed
    ? undefined
    : step.kind === "slot-start" || step.kind === "sample"
      ? "preponed"
      : step.kind === "slot-end"
        ? step.endedBy
          ? step.region
          : "postponed"
        : step.region;
  const deltaPasses = Math.max(...run.trace.map((s) => s.delta));
  const timeLabel = slotTimeLabel(scenario);
  const nextRegion = mode === "next-region";
  const gateOpen = revealed && atGate && Boolean(pending);
  const narratedStep = gateOpen && !gateRevealed ? { ...step, why: GATE_HIDDEN_WHY } : step;
  const decisionsDone = nextRegion && revealed && decisions.length > 0 && !pending;
  const correctDecisions = Object.values(decisionResults).filter(Boolean).length;
  const predictionWord = predictions.length === 1 ? "prediction" : "predictions";
  // The locked cards step aside once the learner has moved on; before that they hold the feedback being read.
  const movedOn = revealed && (playback.index > 0 || gateOpen);
  const predictionsCollapsed = movedOn && !showLockedPredictions;

  const decisionOptions = pending
    ? nextRegionOptions(run).map((o) => ({ id: o.id, label: o.label, correct: isDecisionAnswer(pending, o.id), feedback: decisionFeedback(pending, o.id, run) }))
    : [];

  return (
    <VisualFrame
      label="Scheduler region map"
      eyebrow={nextRegion ? "Mental picture · the loop of §4.5" : "Mental picture · experiment"}
      title={nextRegion ? "Where does the scheduler loop go next?" : "Where does each event land in one time slot?"}
      summary={
        nextRegion ? (
          <>
            Read the code, predict, then step through the slot. Whenever the executing region runs dry, playback pauses: read the queues on every rung and say where the loop
            goes before it moves.
          </>
        ) : (
          <>
            Read the code, predict, then step through the slot. Every event is filed under the region it was <em>scheduled</em> in; watch the ladder return to Active whenever a
            later region creates new work.
          </>
        )
      }
      fidelity="model"
      assumptions={REGION_MAP_ASSUMPTIONS}
    >
      <div data-testid="scheduler-visualizer" className="space-y-4">
        {presets.length > 1 ? (
          <SegmentedControl
            label="Scenario"
            mono
            options={presets.map((p) => ({ value: p.id, label: p.label }))}
            value={scenarioId}
            onChange={changeScenario}
          />
        ) : null}
        <p className="text-sm text-muted-foreground">{preset.summary}</p>

        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <div className="min-w-0">
            <CodeTrace label={scenario.title} lines={lines} activeKey={revealed ? step.stmtId : undefined} contextKeys={contextKeys} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="w-full overflow-x-auto">
              <RegionLadder currentRegion={currentRegion} sourceRegion={revealed ? step.sourceRegion : undefined} counts={revealed ? counts : {}} className="mx-auto" />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              {revealed
                ? `Badges count queued events. ▶ marks the region executing now${step.sourceRegion ? `; ↺ marks ${REGION_LABELS[step.sourceRegion]}, where this event was scheduled` : ""}.`
                : "Solid rungs repeat until empty; dashed rungs are read-only. Predict first, then step through."}
            </p>
            {revealed && nextRegion && !gateOpen ? <QueueChips step={step} /> : null}
          </div>
        </div>

        {/* Narration, values and the transport stay together under the ladder, so Next never changes content out of view. */}
        {revealed ? (
          <div className="space-y-3">
            <TraceNarration step={narratedStep} simTimeLabel={`${timeLabel} (fixed)`} />
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Values after this step</p>
              <div className="flex flex-wrap gap-2">
                {scenario.watch.map((s) => (
                  <ValueChip key={s} name={s} value={step.values[s]} changed={step.changed.includes(s)} />
                ))}
              </div>
            </div>
            <div ref={playbackRef}>
              <PlaybackControls playback={gated} stepCount={run.trace.length} stepNoun="Scheduler step" describeStep={(i) => run.trace[i]?.what ?? ""} />
            </div>
            {!nextRegion ? (
              <p className="text-sm text-muted-foreground">{`In this slot a later region's events moved up into Active or Reactive ${deltaPasses} time${deltaPasses === 1 ? "" : "s"} (Δ ${deltaPasses}) before Postponed.`}</p>
            ) : pending && !gateOpen ? (
              <p className="text-sm text-muted-foreground">{`Playback pauses at each point where the loop has to choose its next region (${decisions.length} decision${decisions.length === 1 ? "" : "s"} in this slot); predict where it goes, then continue.`}</p>
            ) : null}
            {nextRegion ? (
              <div role="status">{decisionsDone ? <p className="text-sm font-medium text-foreground">{decisionRecap(decisions, correctDecisions)}</p> : null}</div>
            ) : null}
            {decisionsDone ? (
              <button
                type="button"
                onClick={retryDecisions}
                className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                Try the decisions again
              </button>
            ) : null}
          </div>
        ) : null}

        {gateOpen && pending ? (
          <div
            ref={gateRef}
            data-testid="next-region-gate"
            role="region"
            aria-labelledby={gateQuestionId}
            tabIndex={-1}
            className="space-y-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <QueueChips step={step} />
            <PredictionPrompt
              resetKey={`${scenarioId}:decision:${answered}`}
              className={COMPACT_GATE_OPTIONS}
              question={<span id={gateQuestionId}>{`Decision ${answered + 1} of ${decisions.length}: ${decisionQuestion(pending, run)}`}</span>}
              options={decisionOptions}
              onCommit={(_, correct) => recordDecision(answered, correct)}
            >
              <GateRevealSignal onChange={setGateRevealed} />
              <p className="text-sm text-muted-foreground">
                Δ <span className="font-mono text-foreground">{pending.delta}</span>: {decisionDeltaSummary(pending)}.
              </p>
              <button
                ref={focusOnMount}
                type="button"
                onClick={continueStepping}
                className="mt-2 inline-flex h-10 items-center rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                Continue stepping
              </button>
            </PredictionPrompt>
          </div>
        ) : null}

        {revealed && run.log.length > 0 ? (
          <div role="group" className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
            {step.log.length === 0 ? <span className="text-slate-400">(no output yet)</span> : step.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        ) : null}

        {movedOn ? (
          <button
            type="button"
            aria-expanded={!predictionsCollapsed}
            aria-controls={predictionsId}
            onClick={() => setShowLockedPredictions((shown) => !shown)}
            className="inline-flex min-h-10 items-center text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {predictionsCollapsed ? `Show your ${predictionWord}` : `Hide your ${predictionWord}`}
          </button>
        ) : null}
        <div id={predictionsId} hidden={predictionsCollapsed} className="space-y-4">
          {predictions.map((prediction, i) => (
            <PredictionPrompt key={`${scenarioId}:${i}`} resetKey={`${scenarioId}:${i}`} question={<PromptText text={prediction.question} />} options={prediction.options}>
              <RevealSignal index={i} onReveal={onReveal} />
            </PredictionPrompt>
          ))}
        </div>

        {revealed ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Region map of this slot</p>
            <LandingMap grouped={grouped} currentStep={shownIndex} onSeek={gated.seek} shownThrough={pending ? limit : undefined} />
            <p className="mt-2 text-xs text-muted-foreground">
              Δ is {DELTA_DEFINITION}, within this time slot (IEEE 1800-2023 defines no delta count). Select an entry to jump to that step; dashed entries have not executed
              yet.{pending ? " Later landings stay hidden until you answer the pending decision." : ""}
            </p>
          </div>
        ) : null}
      </div>
    </VisualFrame>
  );
};

export default SVSchedulerRegionVisualizer;
