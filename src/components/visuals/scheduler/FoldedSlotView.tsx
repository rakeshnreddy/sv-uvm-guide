"use client";

import React from "react";

import { ValueChip } from "@/components/visual-system/ValueChip";
import { describeWoken, type FoldedEvent, type FoldedSlot } from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

interface FoldedSlotViewProps {
  folded: FoldedSlot;
  /** Index of the current event in `folded.events`. */
  index: number;
  watch: string[];
  onSelect?: (index: number) => void;
  className?: string;
}

const glyphStyle: Record<FoldedEvent["kind"], string> = {
  start: "border-border/70 text-muted-foreground",
  evaluate: "border-cyan-500/70 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  update: "border-amber-500/70 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  end: "border-border/70 text-muted-foreground",
};

const kindName: Record<FoldedEvent["kind"], string> = {
  start: "entering the slot",
  evaluate: "evaluation event",
  update: "update event",
  end: "end of the slot",
};

/** The Δ readout's explanation, shown as text and in the accessible name. */
export const DELTA_NOTE = "Δ is this model's count of moves back to Active or Reactive. IEEE 1800-2023 does not define the term, and tools count differently.";

/**
 * Region-free view of one time slot (IEEE 1800-2023 §4.5): the slot is a box
 * of alternating ◆ update and ▶ evaluation events, and $time does not move
 * while any event remains. Every label, value and count comes from
 * `foldTimeSlot`, which reads the model's trace.
 */
export function FoldedSlotView({ folded, index, watch, onSelect, className }: FoldedSlotViewProps) {
  const current = folded.events[Math.min(index, folded.events.length - 1)];
  const timeText = `${folded.slotTime} ${folded.timeUnit}`;
  const changed = current.kind === "update" && current.signal ? [current.signal] : [];

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <p className="rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 font-mono text-sm [font-variant-ligatures:none]" aria-label={`$time is ${timeText} for every event of this slot`}>
          <span className="text-muted-foreground">$time</span> <span className="font-semibold text-foreground">{timeText}</span>
        </p>
        <p
          className="rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 font-mono text-sm [font-variant-ligatures:none]"
          aria-label={`Δ ${current.delta}, model count. ${DELTA_NOTE}`}
          title={DELTA_NOTE}
        >
          <span className="font-semibold text-foreground">Δ {current.delta}</span> <span className="text-[11px] text-muted-foreground">model count</span>
        </p>
      </div>

      <section aria-label={`This time slot, t = ${timeText}`} className="rounded-xl border-2 border-dashed border-border/80 p-2 sm:p-3">
        <p className="mb-2 text-label text-muted-foreground">This time slot · t = {timeText}</p>
        <ol className="space-y-1">
          {folded.events.map((event) => {
            const isCurrent = event.index === current.index;
            const isFuture = event.index > current.index;
            const name = `${event.index === 0 ? "" : `Event ${event.index}: `}${event.glyph ? `${event.glyph} ` : ""}${event.label}, ${kindName[event.kind]}, Δ ${event.delta}${event.printed.length ? `, prints ${event.printed.join(" and ")}` : ""}`;
            return (
              <li key={event.index} className="min-w-0">
                {event.movedBefore ? (
                  <p className="my-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span aria-hidden className="h-px flex-1 bg-border" />
                    <span className="shrink-0">↺ events move back · Δ {event.delta}</span>
                    <span aria-hidden className="h-px flex-1 bg-border" />
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelect?.(event.index)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={name}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/60" : "border-border/60 hover:bg-muted/60",
                    isFuture && "opacity-55",
                  )}
                >
                  <span aria-hidden className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-xs", glyphStyle[event.kind])}>
                    {event.glyph || (event.kind === "start" ? "·" : "■")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-mono text-[13px] text-foreground [font-variant-ligatures:none]">{event.label}</span>
                    {event.choice ? (
                      <span className="mt-0.5 inline-block rounded bg-amber-500/20 px-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Scheduler choice</span>
                    ) : null}
                    {event.printed.map((line, i) => (
                      <span key={i} className="mt-0.5 block whitespace-pre-wrap break-words font-mono text-[12px] text-emerald-700 dark:text-emerald-300 [font-variant-ligatures:none]">
                        prints {line}
                      </span>
                    ))}
                  </span>
                  <span aria-hidden className="shrink-0 font-mono text-[11px] text-muted-foreground">Δ {event.delta}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-3">
        <p className="text-label text-muted-foreground">
          {current.index === 0 ? "Entering the slot" : `Event ${current.index} of ${folded.events.length - 1}`} · {kindName[current.kind]}
        </p>
        {current.movedBefore ? <p className="mt-2 text-sm text-muted-foreground [font-variant-ligatures:none]">↺ {current.movedBefore}</p> : null}
        {current.choice ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200 [font-variant-ligatures:none]">
            <strong>Scheduler choice: </strong>
            {current.choice.what}
          </p>
        ) : null}
        <ul className="mt-2 space-y-1 text-[15px] font-medium leading-snug text-foreground [font-variant-ligatures:none]">
          {current.detail.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {current.kind === "update" ? <p className="mt-1 text-sm font-medium text-foreground">{describeWoken(current)}</p> : null}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground [font-variant-ligatures:none]">
          <strong className="text-foreground">Why: </strong>
          {current.why}
        </p>
      </div>

      <div>
        <p className="mb-2 text-label text-muted-foreground">Values after this event</p>
        <div className="flex flex-wrap gap-2">
          {watch.map((s) => (
            <ValueChip key={s} name={s} value={current.values[s]} changed={changed.includes(s)} />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{DELTA_NOTE}</p>
    </div>
  );
}

export default FoldedSlotView;
