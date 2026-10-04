import React from "react";

import { cn } from "@/lib/utils";

import { classifyValue, valueStyles } from "./visual-language";

interface ValueChipProps {
  name?: string;
  value: number | string | undefined;
  /** Highlights a value that changed in the current step. */
  changed?: boolean;
  className?: string;
}

/** Four-state aware value display. Changed values get a ring and a ▲ cue. */
export function ValueChip({ name, value, changed = false, className }: ValueChipProps) {
  const kind = classifyValue(value);
  const style = valueStyles[kind];
  const shown = value === undefined ? "X" : String(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-sm tabular-nums transition-shadow duration-200 motion-reduce:transition-none",
        style.className,
        changed && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-background",
        className,
      )}
      aria-label={`${name ? `${name} = ` : ""}${shown}${kind === "unknown" || kind === "highz" ? `, ${style.cue}` : ""}${changed ? ", just changed" : ""}`}
    >
      {name ? <span className="text-xs opacity-90">{name}</span> : null}
      <span className="font-semibold">{shown}</span>
      {changed ? (
        <span aria-hidden className="text-[10px] text-cyan-600 dark:text-cyan-300">
          ▲
        </span>
      ) : null}
    </span>
  );
}
