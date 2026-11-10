"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";
import { OutcomeGroups } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { StepWaveform } from "@/components/visual-system/StepWaveform";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { exploreOrderings, REGION_LABELS, REGION_ORDER, simulateTimeSlot, slotTimeLabel, type RegionId, type SvScenario } from "@/lib/sv-scheduler-model";
import {
  allTracePresets,
  choiceLabel,
  foldTimeSlot,
  getTracePreset,
  schedulerScenarioPresets,
  traceOutcomeGroups,
  type TraceScenarioId,
} from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

import { FoldedSlotView } from "./scheduler/FoldedSlotView";
import { RegionLadder } from "./scheduler/RegionLadder";
import { TraceNarration } from "./scheduler/TraceNarration";
import { codeLinesFor, orderingOptions } from "./scheduler/scheduler-view-helpers";

/** Model assumptions for a slot at `timeLabel` (default: the lessons' t = 10 ns). */
export function schedulerAssumptions(timeLabel = "t = 10 ns"): string[] {
  return [
    `Follows the region loop of the IEEE 1800-2023 reference algorithm (§4.5) for one time slot at a rising clock edge (${timeLabel}). Steps and Δ count scheduler work, not nanoseconds.`,
    "Processes are small structured programs generated from the code shown — not parsed SystemVerilog.",
    "Varies only the order of ready processes, which §4.7 leaves to the simulator. §4.7 also lets a simulator interleave statements of a process that has no time control; that only adds more orders, so a race shown here is always a real race.",
    "Update events apply in the order they were scheduled; NBAs are performed in execution order as §4.6 requires.",
    "Clocking blocks use the defaults: #1step input skew samples in Preponed (§14.13), #0 output skew drives in Re-NBA (§14.16), and the @(cb) event triggers in Observed (§14.10).",
  ];
}

export const SCHEDULER_MODEL_ASSUMPTIONS = schedulerAssumptions();

const INTERLEAVE_ASSUMPTION =
  "NBA interleaving is on: after each NBA update is applied, a process it woke may run before the remaining updates (§4.5 takes any event; §4.6 orders only the updates among themselves). Each such point is a further scheduler choice.";

const DELTA_ASSUMPTION = "Δ is the model's count of moves back to Active or Reactive. IEEE 1800-2023 never uses the term delta cycle, and tools count passes differently.";

const LEGACY_IDS = new Set<string>(schedulerScenarioPresets.map((p) => p.id));
const LEGACY_BIT_SIGNALS = ["clk", "d", "q1", "q2"];

/** Watched signals that only ever hold 0, 1 or X, drawn as single-bit lines. */
function bitSignalsFor(scenario: SvScenario, snapshots: Record<string, unknown>[]): string[] {
  if (LEGACY_IDS.has(scenario.id)) return LEGACY_BIT_SIGNALS.filter((s) => scenario.watch.includes(s));
  return scenario.watch.filter((s) => snapshots.every((v) => v[s] === 0 || v[s] === 1 || v[s] === "X"));
}

interface TimeSlotTraceVisualizerProps {
  scenario?: TraceScenarioId;
  /** Restrict the scenario picker; defaults to the original six presets plus `scenario`. */
  scenarios?: TraceScenarioId[];
  /** 'ladder' (default): the nine-region ladder. 'folded': one region-free box of ◆ update and ▶ evaluation events (§4.5). */
  regionView?: "ladder" | "folded";
}

/**
 * Synchronised view of one time slot: code, region ladder (or the folded
 * event box), values, waveform and narration all render the same model step.
 */
export default function TimeSlotTraceVisualizer({ scenario: initial = "shift-blocking", scenarios, regionView = "ladder" }: TimeSlotTraceVisualizerProps) {
  const presets = useMemo(() => {
    const ids: string[] = scenarios ?? [...schedulerScenarioPresets.map((p) => p.id), initial];
    return allTracePresets.filter((p) => ids.includes(p.id));
  }, [scenarios, initial]);
  const [scenarioId, setScenarioId] = useState<TraceScenarioId>(initial);
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(getTracePreset(initial).advanced));
  const preset = getTracePreset(scenarioId);
  const scenario = useMemo(() => getTracePreset(scenarioId).build(), [scenarioId]);
  const timeLabel = slotTimeLabel(scenario);
  const folded = regionView === "folded";

  const [orderKey, setOrderKey] = useState<string>("");
  const exploration = useMemo(() => exploreOrderings(scenario), [scenario]);
  const orderings = useMemo(() => {
    const options = orderingOptions(scenario, exploration);
    const byChoice = options.map((o) => ({ ...o, label: choiceLabel(simulateTimeSlot(scenario, o.choices)) }));
    // The folded view names orders by the choice made; the ladder keeps process-order labels unless two orders share one.
    return folded || new Set(options.map((o) => o.label)).size < options.length ? byChoice : options;
  }, [scenario, exploration, folded]);
  const ordering = orderings.find((o) => o.key === orderKey) ?? orderings[0];
  const run = useMemo(() => simulateTimeSlot(scenario, ordering?.choices ?? []), [scenario, ordering]);
  const slot = useMemo(() => foldTimeSlot(scenario, run), [scenario, run]);
  const lines = useMemo(() => codeLinesFor(scenario), [scenario]);
  const stepCount = folded ? slot.events.length : run.trace.length;
  const playback = usePlayback(stepCount, `${scenarioId}:${ordering?.key}:${regionView}`);
  const prediction = useMemo(() => preset.prediction?.(scenario), [preset, scenario]);
  const groups = useMemo(() => (preset.outcomeGroups ? traceOutcomeGroups(scenario, exploration) : []), [preset, scenario, exploration]);

  const event = slot.events[Math.min(playback.index, slot.events.length - 1)];
  const step = folded ? run.trace[event.steps[event.steps.length - 1]] : run.trace[Math.min(playback.index, run.trace.length - 1)];
  const activeKey = folded ? event.steps.map((i) => run.trace[i].stmtId).find(Boolean) : step.stmtId;
  const activeProcess = folded ? event.processId : step.processId;

  const counts = useMemo(() => {
    const out: Partial<Record<RegionId, number>> = {};
    REGION_ORDER.forEach((r) => (out[r] = step.queues[r].length));
    return out;
  }, [step]);

  const contextKeys = useMemo(
    () => lines.filter((l) => activeProcess && scenario.processes.find((p) => p.id === activeProcess)?.body.some((s) => s.id === l.key)).map((l) => l.key as string),
    [lines, activeProcess, scenario],
  );

  const assumptions = [...schedulerAssumptions(timeLabel), ...(scenario.options?.interleaveNba ? [INTERLEAVE_ASSUMPTION] : []), DELTA_ASSUMPTION];
  const raceVerdict = exploration.deterministic
    ? `Deterministic — all ${exploration.runCount} legal ordering${exploration.runCount === 1 ? "" : "s"} end the same way.`
    : `Race — ${exploration.outcomes.length} different results across ${exploration.runCount} legal orderings.`;
  const visiblePresets = presets.filter((p) => !p.advanced || showAdvanced || p.id === scenarioId);
  const hasAdvanced = presets.some((p) => p.advanced);
  const selectedGroup = groups.find((g) => g.choices.some((c) => c.join(".") === ordering?.choices.join(".")));
  const snapshots = folded ? slot.events.map((e) => e.values) : run.trace.map((s) => s.values);
  const modelNote = preset.modelNote?.(scenario);

  const selectScenario = (id: TraceScenarioId) => {
    setScenarioId(id);
    setOrderKey("");
  };

  const code = <CodeTrace label="Code under simulation" lines={lines} activeKey={activeKey} contextKeys={contextKeys} />;
  const values = (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Values after this step</p>
      <div className="flex flex-wrap gap-2">
        {scenario.watch.map((s) => (
          <ValueChip key={s} name={s} value={step.values[s]} changed={step.changed.includes(s)} />
        ))}
      </div>
    </div>
  );

  const orderChooser =
    orderings.length > 1 ? (
      folded ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-3">
          <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Scheduler choice: when processes are ready together, this simulator runs…</p>
          <SegmentedControl label="Scheduler choice" options={orderings.map((o) => ({ value: o.key, label: o.label }))} value={ordering?.key ?? ""} onChange={setOrderKey} />
        </div>
      ) : (
        <fieldset className="rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-3">
          <legend className="px-1 text-xs font-semibold text-amber-800 dark:text-amber-200">When processes are ready together, this simulator runs…</legend>
          <div className="flex flex-wrap gap-2">
            {orderings.map((o) => (
              <label
                key={o.key}
                className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", o.key === ordering?.key ? "border-amber-500 bg-amber-500/15" : "border-border/70")}
              >
                <input type="radio" name={`order-${scenarioId}`} checked={o.key === ordering?.key} onChange={() => setOrderKey(o.key)} className="accent-amber-500" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )
    ) : null;

  const body = (
    <div className="space-y-4">
      {modelNote ? <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-xs text-muted-foreground">Model limit: {modelNote}</p> : null}
      {orderChooser}

      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-sm font-medium",
          exploration.deterministic
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
        )}
      >
        <span aria-hidden>{exploration.deterministic ? "✓ " : "⚠ "}</span>
        {raceVerdict}
      </p>

      {groups.length ? (
        <OutcomeGroups
          groups={groups.map(({ id, title, runCount, lines: groupLines, endState }) => ({ id, title, runCount, lines: groupLines, endState }))}
          runCount={exploration.runCount}
          onSelect={(id) => {
            const group = groups.find((g) => g.id === id);
            const key = group?.choices[0]?.join(".") || "only";
            setOrderKey(key);
          }}
          selectedId={selectedGroup?.id}
          note={scenario.options?.interleaveNba ? INTERLEAVE_ASSUMPTION : undefined}
        />
      ) : null}

      {folded ? (
        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          {prediction ? null : code}
          <FoldedSlotView folded={slot} index={playback.index} watch={scenario.watch} onSelect={playback.seek} />
        </div>
      ) : (
        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <div className="space-y-4">
            <TraceNarration step={step} simTimeLabel={`${timeLabel} (fixed)`} />
            {prediction ? null : code}
            {values}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="w-full overflow-x-auto">
              <RegionLadder currentRegion={step.kind === "slot-start" ? "preponed" : step.kind === "slot-end" ? "postponed" : step.region} sourceRegion={step.sourceRegion} counts={counts} className="mx-auto" />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Badges count queued events. ▶ marks the region executing now{step.sourceRegion ? `; ↺ marks ${REGION_LABELS[step.sourceRegion]}, where this event was scheduled.` : "."}
            </p>
          </div>
        </div>
      )}

      <StepWaveform
        signals={scenario.watch}
        bitSignals={bitSignalsFor(scenario, snapshots)}
        snapshots={snapshots}
        currentIndex={playback.index}
        onSelect={playback.seek}
        axisLabel={
          folded
            ? `Horizontal axis: the events of one time slot. Simulation time stays at ${timeLabel} — a normal waveform viewer would draw all of this at a single instant.`
            : `Horizontal axis: scheduler steps inside one time slot. Simulation time stays at ${timeLabel} — a normal waveform viewer would draw all of this at a single instant.`
        }
      />

      {run.log.length > 0 ? (
        <div className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
          {step.log.length === 0 ? <span className="text-slate-400">(no output yet)</span> : step.log.map((l, i) => <div key={i} className="whitespace-pre-wrap break-words">{l}</div>)}
        </div>
      ) : null}

      <PlaybackControls
        playback={playback}
        stepCount={stepCount}
        stepNoun={folded ? "Event" : "Scheduler step"}
        describeStep={(i) => (folded ? `${slot.events[i]?.glyph ?? ""} ${slot.events[i]?.label ?? ""}`.trim() : (run.trace[i]?.what ?? ""))}
      />
    </div>
  );

  return (
    <section aria-label="Time slot trace" className="not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step through one clock edge</p>
          <h3 className="text-lg font-semibold text-foreground">{scenario.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{preset.summary}</p>
        </div>
        <FidelityBadge fidelity="model" assumptions={assumptions} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Scenario" className="flex flex-wrap gap-2">
          {visiblePresets.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={p.id === scenarioId}
              onClick={() => selectScenario(p.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                p.id === scenarioId ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasAdvanced ? (
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
        ) : null}
      </div>

      {prediction ? (
        <>
          {code}
          <PredictionPrompt resetKey={scenarioId} question={prediction.question} options={prediction.options}>
            {body}
          </PredictionPrompt>
        </>
      ) : (
        body
      )}
    </section>
  );
}
