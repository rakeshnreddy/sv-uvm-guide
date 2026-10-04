import React from "react";

import { REGION_LABELS, type TraceStep } from "@/lib/sv-scheduler-model";
import { cn } from "@/lib/utils";

const kindLabels: Record<TraceStep["kind"], string> = {
  "slot-start": "Initial state",
  sample: "Sample",
  update: "Value changes",
  statement: "Executes",
  suspend: "Suspends",
  wake: "Wakes",
  move: "Region advance",
  choice: "Scheduler choice",
  print: "Output",
  "slot-end": "Result",
};

/** What happened / why / where, for the current trace step. */
export function TraceNarration({ step, simTimeLabel }: { step: TraceStep; simTimeLabel: string }) {
  const regionText = step.sourceRegion
    ? `${REGION_LABELS[step.sourceRegion]} event, executing in ${REGION_LABELS[step.region]}`
    : REGION_LABELS[step.region];
  return (
    <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-bold uppercase tracking-wider",
            step.kind === "choice" ? "bg-amber-500/20 text-amber-800 dark:text-amber-200" : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
          )}
        >
          {kindLabels[step.kind]}
        </span>
        <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">{regionText}</span>
        <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-muted-foreground">Δ {step.delta}</span>
        <span className="ml-auto font-mono text-muted-foreground">{simTimeLabel}</span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-snug text-foreground [font-variant-ligatures:none]">{step.what}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground [font-variant-ligatures:none]">
        <strong className="text-foreground">Why: </strong>
        {step.why}
      </p>
    </div>
  );
}
