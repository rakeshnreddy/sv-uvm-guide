"use client";

import React from "react";

import { REGION_LABELS, REGION_ORDER, type RegionId } from "@/lib/sv-scheduler-model";
import { cn } from "@/lib/utils";

import { regionGuideById } from "./region-guide";

interface RegionLadderProps {
  /** Region whose events are executing now. */
  currentRegion?: RegionId;
  /** Region the executing event was originally scheduled in. */
  sourceRegion?: RegionId;
  /** Queued events per region (shown as badges). */
  counts?: Partial<Record<RegionId, number>>;
  selectedRegion?: RegionId;
  onSelectRegion?: (region: RegionId) => void;
  title?: string;
  className?: string;
}

const RUNG_H = 40;
const GAP = 5;
const SET_GAP = 16;
const X0 = 74;
const RUNG_W = 286;
const WIDTH = X0 + RUNG_W + 8;

type Layout = { id: RegionId; y: number };

function layoutRungs(): { rungs: Layout[]; height: number } {
  const rungs: Layout[] = [];
  let y = 8;
  REGION_ORDER.forEach((id) => {
    if (id === "active" || id === "reactive" || id === "postponed") y += SET_GAP - GAP;
    rungs.push({ id, y });
    y += RUNG_H + GAP;
  });
  return { rungs, height: y + 4 };
}

const { rungs, height: HEIGHT } = layoutRungs();
const yOf = (id: RegionId) => rungs.find((r) => r.id === id)?.y ?? 0;

const familyClass = {
  readOnly: { rung: "fill-slate-500/10 stroke-slate-400", dash: "5 4", text: "fill-slate-600 dark:fill-slate-300" },
  activeSet: { rung: "fill-cyan-500/10 stroke-cyan-600/70 dark:stroke-cyan-400/70", dash: undefined, text: "fill-cyan-900 dark:fill-cyan-100" },
  observed: { rung: "fill-sky-500/10 stroke-sky-600/70 dark:stroke-sky-400/70", dash: undefined, text: "fill-sky-900 dark:fill-sky-100" },
  reactiveSet: { rung: "fill-violet-500/10 stroke-violet-600/70 dark:stroke-violet-400/70", dash: undefined, text: "fill-violet-900 dark:fill-violet-100" },
} as const;

/**
 * The time-slot "ladder": one simulation time, nine regions, two loops.
 * The first loop drains the active region set and then Observed (§4.5);
 * Observed itself belongs to neither region set (§4.4.1).
 * Visual anchor for every scheduling lesson. Solid rungs iterate; dashed
 * rungs are read-only. Dashed arrows are execution order (causal), per the
 * shared visual language.
 */
export function RegionLadder({ currentRegion, sourceRegion, counts = {}, selectedRegion, onSelectRegion, title = "One time slot", className }: RegionLadderProps) {
  const activeTop = yOf("active");
  const activeBottom = yOf("observed") + RUNG_H;
  const reactiveTop = yOf("reactive");
  const reactiveBottom = yOf("reNba") + RUNG_H;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("block h-auto w-full min-w-[300px] max-w-[420px]", className)}
      role="group"
      aria-label={`${title}: scheduler regions in order. ${currentRegion ? `Executing ${REGION_LABELS[currentRegion]}.` : ""}`}
    >
      <defs>
        <marker id="ladder-open-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1,1 L9,5 L1,9" fill="none" className="stroke-muted-foreground" strokeWidth="1.6" />
        </marker>
      </defs>

      {/* Active-set loop */}
      <path
        d={`M${X0 - 4},${activeBottom - 10} C${X0 - 34},${activeBottom - 10} ${X0 - 34},${activeTop + 12} ${X0 - 4},${activeTop + 12}`}
        fill="none"
        className="stroke-cyan-600/70 dark:stroke-cyan-400/70"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        markerEnd="url(#ladder-open-arrow)"
      />
      <text x={X0 - 36} y={(activeTop + activeBottom) / 2} textAnchor="middle" className="fill-cyan-800 text-[9px] font-semibold dark:fill-cyan-200" transform={`rotate(-90 ${X0 - 36} ${(activeTop + activeBottom) / 2})`}>
        active set + Observed · loop
      </text>

      {/* Reactive-set loop */}
      <path
        d={`M${X0 - 4},${reactiveBottom - 10} C${X0 - 34},${reactiveBottom - 10} ${X0 - 34},${reactiveTop + 12} ${X0 - 4},${reactiveTop + 12}`}
        fill="none"
        className="stroke-violet-600/70 dark:stroke-violet-400/70"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        markerEnd="url(#ladder-open-arrow)"
      />
      <text x={X0 - 36} y={(reactiveTop + reactiveBottom) / 2} textAnchor="middle" className="fill-violet-800 text-[9px] font-semibold dark:fill-violet-200" transform={`rotate(-90 ${X0 - 36} ${(reactiveTop + reactiveBottom) / 2})`}>
        reactive set · repeat
      </text>

      {/* Outer loop: reactive writes can restart the active set */}
      <path
        d={`M${X0 - 4},${reactiveBottom - 4} C${6},${reactiveBottom + 6} ${6},${activeTop - 6} ${X0 - 4},${activeTop + 4}`}
        fill="none"
        className="stroke-muted-foreground/70"
        strokeWidth={1.2}
        strokeDasharray="3 4"
        markerEnd="url(#ladder-open-arrow)"
      />
      <text x={10} y={(activeBottom + reactiveTop) / 2 + 3} className="fill-muted-foreground text-[8.5px]" transform={`rotate(-90 10 ${(activeBottom + reactiveTop) / 2 + 3})`} textAnchor="middle">
        new design events → Active
      </text>

      {rungs.map(({ id, y }) => {
        const guide = regionGuideById[id];
        const fam = familyClass[guide.family];
        const isCurrent = currentRegion === id;
        const isSource = sourceRegion === id && sourceRegion !== currentRegion;
        const isSelected = selectedRegion === id;
        const count = counts[id] ?? 0;
        const interactive = Boolean(onSelectRegion);
        return (
          <g
            key={id}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? isSelected : undefined}
            aria-label={`${REGION_LABELS[id]}: ${guide.tag}${count ? `, ${count} queued` : ""}${isCurrent ? ", executing now" : ""}${isSource ? ", events came from here" : ""}`}
            onClick={interactive ? () => onSelectRegion?.(id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectRegion?.(id);
                    }
                  }
                : undefined
            }
            className={cn(interactive && "cursor-pointer focus:outline-none [&:focus-visible>rect:first-child]:stroke-amber-400")}
          >
            <rect
              x={X0}
              y={y}
              width={RUNG_W}
              height={RUNG_H}
              rx={guide.family === "readOnly" ? 4 : 9}
              className={cn(fam.rung, "transition-all duration-300 motion-reduce:transition-none", isCurrent && "fill-cyan-400/25 stroke-cyan-400", isSelected && !isCurrent && "stroke-amber-400")}
              strokeWidth={isCurrent || isSelected ? 2.5 : 1.2}
              strokeDasharray={fam.dash}
            />
            {isCurrent ? (
              <text x={X0 + 8} y={y + 16} className="fill-cyan-500 text-[11px] font-bold">
                ▶
              </text>
            ) : null}
            <text x={X0 + 22} y={y + 16} className={cn(fam.text, "text-[12px] font-semibold")}>
              {REGION_LABELS[id]}
            </text>
            <text x={X0 + 22} y={y + 31} className="fill-muted-foreground text-[10px]">
              {guide.tag}
            </text>
            {isSource ? (
              <text x={X0 + RUNG_W - 8} y={y + 16} textAnchor="end" className="fill-amber-600 text-[9.5px] font-semibold dark:fill-amber-300">
                ↺ came from here
              </text>
            ) : null}
            {count > 0 ? (
              <g>
                <rect x={X0 + RUNG_W - 58} y={y + 21} width={50} height={14} rx={7} className="fill-background stroke-border" strokeWidth={1} />
                <text x={X0 + RUNG_W - 33} y={y + 31} textAnchor="middle" className="fill-foreground font-mono text-[9.5px]">
                  {count} queued
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
