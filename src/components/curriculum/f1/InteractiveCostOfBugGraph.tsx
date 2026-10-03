"use client";

import React, { useId, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ANCHOR_OPTIONS,
  COST_STAGES,
  costRatio,
  formatMultiplier,
  formatUsd,
  illustrativeCost,
  type AnchorUsd,
} from "@/lib/bug-cost-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Commonly cited escalation: each later stage costs roughly ten times more. Actual costs vary by product, process node and team. This is a rule of thumb, not measured data.",
  "Dollar amounts are your chosen anchor multiplied by the rule-of-thumb factor.",
  "Post-silicon fixes range from a firmware workaround to a full mask respin, so real ratios can be far larger or smaller.",
];

const PREDICTION_OPTIONS: PredictionOption[] = [
  {
    id: "same",
    label: "About the same. The fix is the same few lines of RTL.",
    correct: false,
    feedback:
      "The RTL edit may be identical, but after tape-out it has to be built into new masks and wafers (or worked around in firmware), re-validated in the lab, and the product waits.",
  },
  {
    id: "x3",
    label: "About 2–3× more, for the extra debug time.",
    correct: false,
    feedback:
      "That covers the longer debug, but not the hardware: new masks, new wafers, and weeks to months of schedule. Those costs are orders of magnitude, not a small factor.",
  },
  {
    id: "x100",
    label: "Roughly 100× or more: orders of magnitude.",
    correct: true,
    feedback:
      "The rule of thumb adds about one order of magnitude per stage. Post-silicon is two stages after RTL, so about ×100. A full respin at an advanced node can cost far more than that.",
  },
  {
    id: "never",
    label: "Infinitely more. A post-silicon bug can never be fixed.",
    correct: false,
    feedback:
      "Many post-silicon bugs do get fixed: with a metal-only respin, a full respin, a firmware or microcode workaround, or by disabling a feature. It is costly, not impossible.",
  },
];

const SHORT_LABELS: Record<string, string> = {
  spec: "Spec",
  rtl: "RTL",
  system: "System",
  "post-silicon": "Silicon",
  field: "Field",
};

function CostExplorer() {
  const sliderId = useId();
  const [index, setIndex] = useState(1);
  const [anchor, setAnchor] = useState<AnchorUsd>(1_000);
  const stage = COST_STAGES[index];
  const vsRtl = costRatio("rtl", stage.id);

  // Bar chart geometry (log scale: one step per order of magnitude).
  const W = 320;
  const H = 170;
  const top = 26;
  const bottom = 26;
  const left = 8;
  const slot = (W - left * 2) / COST_STAGES.length;
  const maxLog = Math.log10(COST_STAGES[COST_STAGES.length - 1].multiplier) + 1;
  const barHeight = (m: number) => ((Math.log10(m) + 1) / maxLog) * (H - top - bottom);

  const chartLabel = `Relative cost to fix a bug, log scale, illustrative: ${COST_STAGES.map((s) => `${s.label} ${formatMultiplier(s.multiplier)}`).join(", ")}. Selected: ${stage.label}.`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={sliderId} className="block text-sm font-semibold text-foreground">
          Where is the bug found?
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={COST_STAGES.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${stage.label}: about ${formatMultiplier(stage.multiplier)} the spec-review cost (illustrative)`}
          className="h-2 w-full cursor-pointer accent-cyan-500"
        />
        <div className="grid gap-1.5 grid-cols-[repeat(auto-fit,minmax(min(100%,96px),1fr))]" role="group" aria-label="Discovery stages">
          {COST_STAGES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              onFocus={() => setIndex(i)}
              className={cn(
                "min-h-10 rounded-lg border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                i === index ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {i === index ? <span aria-hidden>▶ </span> : null}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <figure className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-3">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartLabel} className="h-auto w-full">
            {COST_STAGES.map((s, i) => {
              const h = barHeight(s.multiplier);
              const x = left + i * slot + slot * 0.18;
              const w = slot * 0.64;
              const y = H - bottom - h;
              const active = i === index;
              return (
                <g key={s.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={3}
                    className={cn(
                      "transition-colors motion-reduce:transition-none",
                      active ? "fill-cyan-500/70 stroke-cyan-600 dark:stroke-cyan-300" : "fill-muted-foreground/25 stroke-transparent",
                    )}
                    strokeWidth={2}
                  />
                  <text x={x + w / 2} y={y - 5} textAnchor="middle" className={cn("font-mono text-[10px]", active ? "fill-foreground font-bold" : "fill-muted-foreground")}>
                    {active ? "▼ " : ""}
                    {formatMultiplier(s.multiplier)}
                  </text>
                  <text x={x + w / 2} y={H - bottom + 14} textAnchor="middle" className={cn("text-[10px]", active ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                    {SHORT_LABELS[s.id]}
                  </text>
                </g>
              );
            })}
            <line x1={left} x2={W - left} y1={H - bottom} y2={H - bottom} className="stroke-border" strokeWidth={1} />
            <text x={left} y={12} className="fill-muted-foreground text-[10px]">
              Relative cost to fix (log scale, illustrative)
            </text>
          </svg>
          <figcaption className="mt-1 text-[11px] text-muted-foreground">
            Each bar is ten times the one before it. x-axis: the stage where the bug is found.
          </figcaption>
        </figure>

        <div className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-background/40 p-3 text-sm" aria-live="polite">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Found at</p>
            <p className="text-lg font-semibold text-foreground">{stage.label}</p>
          </div>
          <p className="text-foreground">
            About <strong>{formatMultiplier(stage.multiplier)}</strong> the cost of catching it at spec review
            {stage.id === "rtl" ? "." : vsRtl >= 1 ? `, and ${formatMultiplier(vsRtl)} an RTL-simulation fix.` : `, and about ${formatMultiplier(1 / vsRtl).replace("×", "1/")} of an RTL-simulation fix.`}
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">What has to be redone: </strong>
            {stage.redo}
          </p>
          <p className="rounded-lg border border-dashed border-border/80 p-2 text-xs text-muted-foreground">
            Illustrative only: if a spec-review fix costs {formatUsd(anchor)}, this one costs about{" "}
            <strong className="text-foreground">{formatUsd(illustrativeCost(stage, anchor))}</strong>.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Your assumption: fixing it at spec review costs</p>
        <SegmentedControl
          label="Assumed cost of a spec-review fix"
          options={ANCHOR_OPTIONS.map((a) => ({ value: String(a), label: formatUsd(a) }))}
          value={String(anchor)}
          onChange={(v) => setAnchor(Number(v) as AnchorUsd)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Commonly cited escalation; actual costs vary by product and node. Treat the multipliers as orders of magnitude, not measurements.
      </p>
    </div>
  );
}

/** F1A: predict the escalation, then explore the rule-of-thumb cost ladder. */
const InteractiveCostOfBugGraph = () => (
  <VisualFrame
    label="Cost of fixing a bug by discovery stage"
    eyebrow="Predict, then explore"
    title="How fast does the cost of a bug grow?"
    summary="A rule of thumb, not data: it shows the order of magnitude, which is what drives verification budgets."
    fidelity="illustration"
    assumptions={ASSUMPTIONS}
  >
    <PredictionPrompt
      question="A bug that RTL simulation could have caught escapes to post-silicon instead. Roughly how much more does fixing it cost?"
      options={PREDICTION_OPTIONS}
    >
      <CostExplorer />
    </PredictionPrompt>
  </VisualFrame>
);

export default InteractiveCostOfBugGraph;
