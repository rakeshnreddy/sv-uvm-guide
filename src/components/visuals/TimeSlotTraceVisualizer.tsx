"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { StepWaveform } from "@/components/visual-system/StepWaveform";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { exploreOrderings, REGION_LABELS, REGION_ORDER, simulateTimeSlot, type RegionId } from "@/lib/sv-scheduler-model";
import { getScenarioPreset, schedulerScenarioPresets, type SchedulerScenarioId } from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

import { RegionLadder } from "./scheduler/RegionLadder";
import { TraceNarration } from "./scheduler/TraceNarration";
import { codeLinesFor, orderingOptions } from "./scheduler/scheduler-view-helpers";

export const SCHEDULER_MODEL_ASSUMPTIONS = [
  "Follows the region loop of the IEEE 1800-2023 reference algorithm (§4.5) for one time slot at a rising clock edge (t = 10 ns). Steps and Δ count scheduler work, not nanoseconds.",
  "Processes are small structured programs generated from the code shown — not parsed SystemVerilog.",
  "Varies only the order of ready processes, which §4.7 leaves to the simulator. §4.7 also lets a simulator interleave statements of a process that has no time control; that only adds more orders, so a race shown here is always a real race.",
  "Update events apply in the order they were scheduled; NBAs are performed in execution order as §4.6 requires.",
  "Clocking blocks use the defaults: #1step input skew samples in Preponed (§14.13), #0 output skew drives in Re-NBA (§14.16), and the @(cb) event triggers in Observed (§14.10).",
];

interface TimeSlotTraceVisualizerProps {
  scenario?: SchedulerScenarioId;
  /** Restrict the scenario picker; defaults to every preset. */
  scenarios?: SchedulerScenarioId[];
}

/**
 * Synchronised view of one time slot: code, region ladder, values, waveform
 * and narration all render the same model step.
 */
export default function TimeSlotTraceVisualizer({ scenario: initial = "shift-blocking", scenarios }: TimeSlotTraceVisualizerProps) {
  const presets = scenarios ? schedulerScenarioPresets.filter((p) => scenarios.includes(p.id)) : schedulerScenarioPresets;
  const [scenarioId, setScenarioId] = useState<SchedulerScenarioId>(initial);
  const scenario = useMemo(() => getScenarioPreset(scenarioId).build(), [scenarioId]);
  const [orderKey, setOrderKey] = useState<string>("");
  const exploration = useMemo(() => exploreOrderings(scenario), [scenario]);
  const orderings = useMemo(() => orderingOptions(scenario, exploration), [scenario, exploration]);
  const ordering = orderings.find((o) => o.key === orderKey) ?? orderings[0];
  const run = useMemo(() => simulateTimeSlot(scenario, ordering?.choices ?? []), [scenario, ordering]);
  const lines = useMemo(() => codeLinesFor(scenario), [scenario]);
  const playback = usePlayback(run.trace.length, `${scenarioId}:${ordering?.key}`);
  const step = run.trace[Math.min(playback.index, run.trace.length - 1)];

  const counts = useMemo(() => {
    const out: Partial<Record<RegionId, number>> = {};
    REGION_ORDER.forEach((r) => (out[r] = step.queues[r].length));
    return out;
  }, [step]);

  const contextKeys = useMemo(
    () => lines.filter((l) => step.processId && scenario.processes.find((p) => p.id === step.processId)?.body.some((s) => s.id === l.key)).map((l) => l.key as string),
    [lines, step, scenario],
  );

  const preset = getScenarioPreset(scenarioId);
  const raceVerdict = exploration.deterministic
    ? `Deterministic — all ${exploration.runCount} legal ordering${exploration.runCount === 1 ? "" : "s"} end the same way.`
    : `Race — ${exploration.outcomes.length} different results across ${exploration.runCount} legal orderings.`;

  return (
    <section aria-label="Time slot trace" className="not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step through one clock edge</p>
          <h3 className="text-lg font-semibold text-foreground">{scenario.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{preset.summary}</p>
        </div>
        <FidelityBadge fidelity="model" assumptions={SCHEDULER_MODEL_ASSUMPTIONS} />
      </header>

      <div role="tablist" aria-label="Scenario" className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={p.id === scenarioId}
            onClick={() => {
              setScenarioId(p.id);
              setOrderKey("");
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]",
              p.id === scenarioId ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {orderings.length > 1 ? (
        <fieldset className="rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-3">
          <legend className="px-1 text-xs font-semibold text-amber-800 dark:text-amber-200">When processes are ready together, this simulator runs…</legend>
          <div className="flex flex-wrap gap-2">
            {orderings.map((o) => (
              <label
                key={o.key}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                  o.key === ordering?.key ? "border-amber-500 bg-amber-500/15" : "border-border/70",
                )}
              >
                <input type="radio" name={`order-${scenarioId}`} checked={o.key === ordering?.key} onChange={() => setOrderKey(o.key)} className="accent-amber-500" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

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

      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="space-y-4">
          <TraceNarration step={step} simTimeLabel="t = 10 ns (fixed)" />
          <CodeTrace label="Code under simulation" lines={lines} activeKey={step.stmtId} contextKeys={contextKeys} />
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Values after this step</p>
            <div className="flex flex-wrap gap-2">
              {scenario.watch.map((s) => (
                <ValueChip key={s} name={s} value={step.values[s]} changed={step.changed.includes(s)} />
              ))}
            </div>
          </div>
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

      <StepWaveform
        signals={scenario.watch}
        bitSignals={["clk", "d", "q1", "q2"].filter((s) => scenario.watch.includes(s))}
        snapshots={run.trace.map((s) => s.values)}
        currentIndex={playback.index}
        onSelect={playback.seek}
        axisLabel="Horizontal axis: scheduler steps inside one time slot. Simulation time stays at t = 10 ns — a normal waveform viewer would draw all of this at a single instant."
      />

      {run.log.length > 0 ? (
        <div className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
          {step.log.length === 0 ? <span className="text-slate-500">(no output yet)</span> : step.log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      ) : null}

      <PlaybackControls playback={playback} stepCount={run.trace.length} stepNoun="Scheduler step" describeStep={(i) => run.trace[i]?.what ?? ""} />
    </section>
  );
}
