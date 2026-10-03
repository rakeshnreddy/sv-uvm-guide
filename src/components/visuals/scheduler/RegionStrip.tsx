import React from "react";

import { REGION_LABELS, REGION_ORDER, type RegionId } from "@/lib/sv-scheduler-model";
import { cn } from "@/lib/utils";

const SHORT: Record<RegionId, string> = {
  preponed: "Prep",
  active: "Act",
  inactive: "Inact",
  nba: "NBA",
  observed: "Obs",
  reactive: "React",
  reInactive: "ReIn",
  reNba: "ReNBA",
  postponed: "Post",
};

export interface RegionMark {
  region: RegionId;
  kind: "read" | "write";
  label: string;
}

/**
 * Horizontal ladder in miniature: where a read (▼) and a write (◆) land
 * within one time slot. Same-region read and write means order decides.
 */
export function RegionStrip({ marks, className }: { marks: RegionMark[]; className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <ol className="grid grid-cols-9 gap-0.5" aria-label="Where reads and writes land in the time slot">
        {REGION_ORDER.map((region) => {
          const here = marks.filter((m) => m.region === region);
          const collide = here.some((m) => m.kind === "read") && here.some((m) => m.kind === "write");
          return (
            <li
              key={region}
              className={cn(
                "flex min-h-[64px] flex-col items-center justify-start rounded-md border px-0.5 pt-1 text-center",
                region === "preponed" || region === "postponed" ? "border-dashed border-slate-400/50" : "border-border/60",
                collide && "border-rose-500 bg-rose-500/10",
              )}
              aria-label={`${REGION_LABELS[region]}${here.length ? `: ${here.map((m) => `${m.kind} ${m.label}`).join(", ")}` : ""}${collide ? " — read and write in the same region" : ""}`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-tight text-muted-foreground" aria-hidden>
                {SHORT[region]}
              </span>
              {here.map((m) => (
                <span
                  key={`${m.kind}-${m.label}`}
                  aria-hidden
                  className={cn(
                    "mt-1 text-[10px] font-semibold leading-tight [font-variant-ligatures:none]",
                    m.kind === "read" ? "text-violet-700 dark:text-violet-300" : "text-amber-700 dark:text-amber-300",
                  )}
                >
                  {m.kind === "read" ? "▼" : "◆"}
                  <br />
                  {m.label}
                </span>
              ))}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-[10px] text-muted-foreground">▼ DUT reads din · ◆ testbench write of din lands</p>
    </div>
  );
}
