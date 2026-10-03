"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { RegionLadder } from "@/components/visuals/scheduler/RegionLadder";
import { TraceNarration } from "@/components/visuals/scheduler/TraceNarration";
import { regionGuideById } from "@/components/visuals/scheduler/region-guide";
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot, type RegionId } from "@/lib/sv-scheduler-model";
import { getRegionMapPreset, regionMapScenarioPresets, type RegionMapScenarioId } from "@/lib/sv-scheduler-scenarios";
import { REGION_CLAUSES, groupLandingsByRegion, regionLandings, regionMapPrediction, regionMapSource, type RegionLanding } from "@/lib/sv-region-map-model";
import { cn } from "@/lib/utils";

export const REGION_MAP_ASSUMPTIONS = [
  "One time slot at a rising clock edge (t = 10 ns), following the region loop of IEEE 1800-2023 §4.5. Steps and Δ count scheduler work, not nanoseconds.",
  "Each event is filed under the region it was scheduled in (§4.4.2). Events from Inactive, NBA, Re-Inactive and Re-NBA are moved to Active or Reactive and executed there, as §4.5 describes.",
  "Continuous assignments are modelled as processes sensitive to their right-hand side (§4.9.1); always_comb likewise (§9.2.2.2).",
  "Program-block code runs in the reactive region set and its `<=` updates land in Re-NBA (§24.3.1). The program/endprogram lines are generated from the model's context flag.",
  "Processes are small structured programs generated from the code shown, not parsed SystemVerilog. These three scenarios have one legal order each, so no scheduler choice appears.",
];

/** Calls `onReveal` once, when the prediction prompt renders its revealed content. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
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
}: {
  grouped: Record<RegionId, RegionLanding[]>;
  currentStep: number;
  onSeek: (index: number) => void;
}) {
  return (
    <ol aria-label="Where each event landed" className="space-y-1.5">
      {REGION_ORDER.map((region) => {
        const items = grouped[region];
        const guide = regionGuideById[region];
        const readOnly = guide.family === "readOnly";
        return (
          <li
            key={region}
            aria-label={`${REGION_LABELS[region]}: ${items.length ? items.map((l) => l.label).join("; ") : "nothing landed here"}`}
            className={cn(
              "flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-2",
              readOnly ? "border-dashed border-slate-400/60" : "border-border/70",
              items.length === 0 && "opacity-70",
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
                <span className="text-xs text-muted-foreground">—</span>
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
                        "inline-flex min-h-8 max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left font-mono text-[11px] transition-colors motion-reduce:transition-none [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

interface SVSchedulerRegionVisualizerProps {
  scenario?: RegionMapScenarioId;
  /** Restrict the scenario picker; defaults to every region-map preset. */
  scenarios?: RegionMapScenarioId[];
}

/**
 * F3B region map: for one time slot, which events land in which region.
 * Everything shown is read from `simulateTimeSlot`; the learner predicts
 * before the trace and the map are revealed.
 */
export const SVSchedulerRegionVisualizer = ({ scenario: initial = "comb-after-nba", scenarios }: SVSchedulerRegionVisualizerProps) => {
  const presets = scenarios ? regionMapScenarioPresets.filter((p) => scenarios.includes(p.id)) : regionMapScenarioPresets;
  const [scenarioId, setScenarioId] = useState<RegionMapScenarioId>(initial);
  const [revealed, setRevealed] = useState(false);
  const preset = getRegionMapPreset(scenarioId);
  const scenario = useMemo(() => preset.build(), [preset]);
  const run = useMemo(() => simulateTimeSlot(scenario), [scenario]);
  const landings = useMemo(() => regionLandings(scenario, run), [scenario, run]);
  const grouped = useMemo(() => groupLandingsByRegion(landings), [landings]);
  const prediction = useMemo(() => regionMapPrediction(scenario, run), [scenario, run]);
  const source = useMemo(() => regionMapSource(scenario), [scenario]);
  const lines: CodeTraceLine[] = useMemo(() => source.map((l) => ({ text: l.text, key: l.key, owner: l.owner })), [source]);
  const playback = usePlayback(run.trace.length, scenarioId);
  const step = run.trace[Math.min(playback.index, run.trace.length - 1)];
  const onReveal = useCallback(() => setRevealed(true), []);

  const changeScenario = (id: RegionMapScenarioId) => {
    setScenarioId(id);
    setRevealed(false);
  };

  const counts = useMemo(() => {
    const out: Partial<Record<RegionId, number>> = {};
    REGION_ORDER.forEach((r) => (out[r] = step.queues[r].length));
    return out;
  }, [step]);

  const contextKeys = revealed && step.processId ? source.filter((l) => l.processId === step.processId && l.key).map((l) => l.key as string) : [];
  const currentRegion: RegionId | undefined = !revealed
    ? undefined
    : step.kind === "slot-start"
      ? "preponed"
      : step.kind === "slot-end"
        ? "postponed"
        : step.region;
  const deltaPasses = Math.max(...run.trace.map((s) => s.delta));

  return (
    <VisualFrame
      label="Scheduler region map"
      eyebrow="Mental picture · experiment"
      title="Where does each event land in one time slot?"
      summary={
        <>
          Read the code, predict, then step through the slot. Every event is filed under the region it was <em>scheduled</em> in; watch the ladder return to Active whenever a
          later region creates new work.
        </>
      }
      fidelity="model"
      assumptions={REGION_MAP_ASSUMPTIONS}
    >
      <div data-testid="scheduler-visualizer" className="space-y-4">
        <SegmentedControl
          label="Scenario"
          mono
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
          value={scenarioId}
          onChange={changeScenario}
        />
        <p className="text-sm text-muted-foreground">{preset.summary}</p>

        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <div className="min-w-0 space-y-3">
            <CodeTrace label={scenario.title} lines={lines} activeKey={revealed ? step.stmtId : undefined} contextKeys={contextKeys} />
            {revealed ? (
              <>
                <TraceNarration step={step} simTimeLabel="t = 10 ns (fixed)" />
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Values after this step</p>
                  <div className="flex flex-wrap gap-2">
                    {scenario.watch.map((s) => (
                      <ValueChip key={s} name={s} value={step.values[s]} changed={step.changed.includes(s)} />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
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
          </div>
        </div>

        <PredictionPrompt resetKey={scenarioId} question={prediction.question} options={prediction.options}>
          <RevealSignal onReveal={onReveal} />
          <p className="text-sm text-muted-foreground">
            Step through below. This slot needed {deltaPasses} return{deltaPasses === 1 ? "" : "s"} to an earlier region (Δ {deltaPasses}) before Postponed.
          </p>
        </PredictionPrompt>

        {revealed ? (
          <div className="space-y-4">
            {run.log.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
                {step.log.length === 0 ? <span className="text-slate-400">(no output yet)</span> : step.log.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            ) : null}
            <PlaybackControls playback={playback} stepCount={run.trace.length} stepNoun="Scheduler step" describeStep={(i) => run.trace[i]?.what ?? ""} />
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Region map of this slot</p>
              <LandingMap grouped={grouped} currentStep={playback.index} onSeek={playback.seek} />
              <p className="mt-2 text-xs text-muted-foreground">
                Δ counts how many times the scheduler went back to an earlier region in the same time slot. Select an entry to jump to that step; dashed entries have not executed yet.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </VisualFrame>
  );
};

export default SVSchedulerRegionVisualizer;
