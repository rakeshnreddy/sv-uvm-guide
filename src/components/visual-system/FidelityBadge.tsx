import React from "react";

import { cn } from "@/lib/utils";

import { fidelityLabels, type Fidelity } from "./visual-language";

interface FidelityBadgeProps {
  fidelity: Fidelity;
  /** Assumptions and limitations shown near the experience. */
  assumptions?: string[];
  className?: string;
}

/** Declares what kind of experience the learner is looking at, with its limits. */
export function FidelityBadge({ fidelity, assumptions = [], className }: FidelityBadgeProps) {
  const label = fidelityLabels[fidelity];
  return (
    <div className={cn("text-xs", className)}>
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold", label.className)}>
        <span aria-hidden>{fidelity === "illustration" ? "◇" : fidelity === "model" ? "◆" : "▶"}</span>
        {label.title}
      </span>
      {assumptions.length > 0 ? (
        <details className="mt-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Assumptions and limits</summary>
          <p className="mt-1">{label.description}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
