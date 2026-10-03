"use client";

import React, { useId } from "react";

import { VisualFrame } from "@/components/visual-system/VisualFrame";

const W = 320;
const H = 200;
const PLOT = { left: 34, right: 300, top: 18, bottom: 168 };

// Shape only: no data. Design complexity climbs steeply; verification capability climbs slowly.
const designPoints: [number, number][] = [
  [0, 0.04],
  [0.2, 0.14],
  [0.4, 0.3],
  [0.6, 0.52],
  [0.8, 0.76],
  [1, 0.96],
];
const verificationPoints: [number, number][] = [
  [0, 0.04],
  [0.2, 0.09],
  [0.4, 0.15],
  [0.6, 0.22],
  [0.8, 0.29],
  [1, 0.36],
];

const px = ([x, y]: [number, number]) => [PLOT.left + x * (PLOT.right - PLOT.left), PLOT.bottom - y * (PLOT.bottom - PLOT.top)] as const;
const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(p).join(",")}`).join(" ");

/** F1A: the design–verification gap, drawn as an honest illustration (no data, no units). */
export default function DesignGapChart() {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const gapPath = `${toPath(designPoints)} ${[...verificationPoints]
    .reverse()
    .map((p) => `L${px(p).join(",")}`)
    .join(" ")} Z`;
  const [gx, gy] = px([0.78, 0.52]);

  return (
    <VisualFrame
      label="Design versus verification gap"
      eyebrow="Design vs. Verification"
      title="The verification gap"
      summary="What we can build grows faster than what we can check, unless verification methods improve."
      fidelity="illustration"
      assumptions={["Shape only. No data is plotted, and the axes have no units or scale.", "The point is the trend: the gap widens over time."]}
    >
      <figure className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} aria-describedby={descId} className="mx-auto h-auto w-full max-w-[560px]">
          <title id={titleId}>Illustration: design complexity versus verification capability over time</title>
          <desc id={descId}>
            Both curves rise over time. The solid design-complexity curve rises much faster than the dashed verification-capability curve, so the
            hatched gap between them widens. Illustrative shape, not data.
          </desc>
          <defs>
            <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-rose-500/40" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Axes */}
          <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right + 8} y2={PLOT.bottom} className="stroke-muted-foreground" strokeWidth={1} />
          <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.left} y2={PLOT.top - 8} className="stroke-muted-foreground" strokeWidth={1} />
          <text x={(PLOT.left + PLOT.right) / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            Time (process generations) →
          </text>
          <text
            x={12}
            y={(PLOT.top + PLOT.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}
            className="fill-muted-foreground text-[10px]"
          >
            Capability (no scale) →
          </text>

          {/* Gap */}
          <path d={gapPath} fill={`url(#${id}-hatch)`} />
          <text x={gx} y={gy} textAnchor="middle" className="fill-rose-700 text-[10px] font-semibold dark:fill-rose-300">
            gap
          </text>

          {/* Curves: solid = design, dashed = verification (shape, not colour, carries the meaning) */}
          <path d={toPath(designPoints)} fill="none" className="stroke-violet-600 dark:stroke-violet-300" strokeWidth={3} strokeLinecap="round" />
          <path
            d={toPath(verificationPoints)}
            fill="none"
            className="stroke-amber-600 dark:stroke-amber-300"
            strokeWidth={3}
            strokeDasharray="7 5"
            strokeLinecap="round"
          />
          <text x={PLOT.left + 6} y={PLOT.top} className="fill-muted-foreground text-[9px] uppercase tracking-wider">
            Illustrative
          </text>
        </svg>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <svg width="28" height="8" aria-hidden>
              <line x1="2" y1="4" x2="26" y2="4" className="stroke-violet-600 dark:stroke-violet-300" strokeWidth={3} strokeLinecap="round" />
            </svg>
            Solid: design complexity (what we can build)
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="28" height="8" aria-hidden>
              <line x1="2" y1="4" x2="26" y2="4" className="stroke-amber-600 dark:stroke-amber-300" strokeWidth={3} strokeDasharray="7 5" />
            </svg>
            Dashed: verification capability (what we can check)
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="16" height="12" aria-hidden>
              <rect width="16" height="12" fill={`url(#${id}-hatch)`} />
            </svg>
            Hatched: the gap
          </li>
        </ul>
        <figcaption className="mt-2 text-xs text-muted-foreground">
          Illustrative shape, not plotted data. Closing the gap takes better methods (reuse, constrained-random stimulus, coverage, formal and emulation),
          not just more hours.
        </figcaption>
      </figure>
    </VisualFrame>
  );
}
