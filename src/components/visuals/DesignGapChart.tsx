"use client";

import React, { useId } from "react";

import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { FigureDepthDefs, depthFill, rimStroke, shadowFilter, glowFilter } from "@/components/visual-system/figure-depth";

/*
 * Art direction (DESIGN.md section 14). The one idea: what can be built climbs
 * much faster than what can be checked, so the unchecked gap between them
 * widens every generation. The gap is the focal part: the only glowing,
 * full-strength mark, measured by a rose dimension bracket at its widest point.
 * The two curves keep their protected roles (violet design, amber testbench) as
 * lit traces on a recessed screen; the time axis stays neutral, because a ramp
 * and a rose mark do not share a figure.
 *
 * One drawing serves every width. Its text is set larger in drawing units below
 * the sm breakpoint, where the drawing is narrow, so it stays at 11 px or more
 * at 390 wide. From sm up the drawing fills its panel (up to 720 px), with its
 * text at about 15 px on a desktop.
 */
const W = 400;
const H = 224;
const PLOT = { left: 40, right: 340, top: 18, bottom: 196 };
/** The recessed screen behind the curves. */
const SCREEN = { x: PLOT.left, y: 8, w: PLOT.right - PLOT.left + 10, h: PLOT.bottom - 8 };

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

/** Axis labels: 14.5 units on a phone (11.4 px at 390 wide), 8.5 units from sm up (about 15 px on a desktop, 13.9 px at 768). */
const AXIS_TEXT = "fill-muted-foreground text-[14.5px] sm:text-[8.5px]";

/** F1A: the design–verification gap, drawn as an honest illustration (no data, no units). */
export default function DesignGapChart() {
  const id = useId();
  const fx = id.replace(/:/g, "");
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const gapPath = `${toPath(designPoints)} ${[...verificationPoints]
    .reverse()
    .map((p) => `L${px(p).join(",")}`)
    .join(" ")} Z`;
  const [endX, designEndY] = px(designPoints[designPoints.length - 1]);
  const [, verifEndY] = px(verificationPoints[verificationPoints.length - 1]);
  const [startX, startY] = px(designPoints[0]);
  const bracketX = endX + 12;
  const gapMidY = (designEndY + verifEndY) / 2;

  return (
    <VisualFrame
      label="Design versus verification gap"
      eyebrow="Design vs. Verification"
      title="The verification gap"
      summary="What we can build grows faster than what we can check, unless verification methods improve."
      fidelity="illustration"
      assumptions={["Shape only. No data is plotted, and the axes have no units or scale.", "The point is the trend: the gap widens over time."]}
      className="fig-panel"
    >
      <figure className="fig-panel min-w-0 rounded-xl border border-border bg-card">
        <div className="fig-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} aria-describedby={descId} className="mx-auto block h-auto w-full max-w-[720px]">
            <title id={titleId}>Illustration: design complexity versus verification capability over time</title>
            <desc id={descId}>
              Both curves rise over time. The solid design-complexity curve rises much faster than the dashed verification-capability curve, so the
              hatched gap between them widens. Illustrative shape, not data.
            </desc>
            <defs>
              <FigureDepthDefs id={fx} hues={["violet", "amber", "rose", "tier"]} width={W} height={H} />
              <pattern id={`${fx}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" className="stroke-fig-rose" strokeWidth="1.6" />
              </pattern>
              {/* The gap deepens toward the right, where it is widest: one hue, from nothing to the rose body. */}
              <linearGradient id={`${fx}-gapfill`} x1={startX} y1="0" x2={endX} y2="0" gradientUnits="userSpaceOnUse" className="text-fig-rose-body">
                <stop offset="0" className="fig-stop-none" />
                <stop offset="1" className="fig-stop-top" />
              </linearGradient>
              {/* The screen is recessed: a shade under its top edge. */}
              <linearGradient id={`${fx}-inset`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="fig-stop-shade" />
                <stop offset="0.08" className="fig-stop-none" />
              </linearGradient>
            </defs>

            {/* The screen: a well with graticule lines, one per process generation (no scale). */}
            <g aria-hidden className="fig-fx">
              <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={8} className="fig-well" stroke="none" />
              <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={8} fill={`url(#${fx}-inset)`} stroke="none" />
              <rect
                x={SCREEN.x + 0.5}
                y={SCREEN.y + 0.5}
                width={SCREEN.w - 1}
                height={SCREEN.h - 1}
                rx={7.5}
                fill="none"
                className="stroke-fig-generic"
                strokeOpacity={0.3}
                strokeWidth={1}
              />
              {[0.2, 0.4, 0.6, 0.8, 1].map((x) => {
                const [gx] = px([x, 0]);
                return <line key={x} x1={gx} x2={gx} y1={SCREEN.y + 6} y2={PLOT.bottom} className="stroke-fig-generic" strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 4" />;
              })}
            </g>

            {/* Axes */}
            <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right + 14} y2={PLOT.bottom} className="stroke-fig-generic" strokeWidth={1.5} />
            <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.left} y2={SCREEN.y + 2} className="stroke-fig-generic" strokeWidth={1.5} />
            <g aria-hidden>
              <path d={`M${PLOT.right + 20},${PLOT.bottom} l-7,-3.5 v7 Z`} className="fig-solid fill-fig-generic" stroke="none" />
              <path d={`M${PLOT.left},${SCREEN.y - 4} l-3.5,7 h7 Z`} className="fig-solid fill-fig-generic" stroke="none" />
            </g>
            <text x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 20} textAnchor="middle" className={AXIS_TEXT}>
              Time (process generations) →
            </text>
            <text
              x={20}
              y={(PLOT.top + PLOT.bottom) / 2}
              textAnchor="middle"
              transform={`rotate(-90 20 ${(PLOT.top + PLOT.bottom) / 2})`}
              className={AXIS_TEXT}
            >
              Capability (no scale) →
            </text>

            {/* The gap, the focal part: a soft rose glow under it, its body deepening to the right, and the hatch at full strength.
                The figure's one glow pass also lights the dimension bracket that measures the gap. */}
            <g aria-hidden className="fig-fx fig-fx-blur" filter={glowFilter(fx)}>
              <path d={gapPath} className="fill-fig-rose fig-glow-soft" stroke="none" />
              <rect x={bracketX - 2} y={designEndY} width={4} height={verifEndY - designEndY} rx={2} className="fill-fig-rose fig-glow" />
            </g>
            <path d={gapPath} fill={`url(#${fx}-gapfill)`} stroke="none" className="fig-fx" aria-hidden />
            <path d={gapPath} fill={`url(#${fx}-hatch)`} />

            {/* Lit traces: a band in each curve's colour under its line. */}
            <g aria-hidden className="fig-fx">
              <path d={toPath(designPoints)} className="fig-trace stroke-fig-violet" strokeWidth={8} />
              <path d={toPath(verificationPoints)} className="fig-trace stroke-fig-amber" strokeWidth={6} />
            </g>

            {/* Curves: solid = design, dashed = verification (shape, not colour, carries the meaning) */}
            <path d={toPath(designPoints)} fill="none" className="stroke-fig-violet" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={toPath(verificationPoints)}
              fill="none"
              className="stroke-fig-amber"
              strokeWidth={3}
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Lit end points: where both curves start together, and where each one has got to.
                The figure's one shadow pass: under the three end points and under the raised label chip. */}
            <g aria-hidden className="fig-fx fig-fx-blur" filter={shadowFilter(fx)}>
              <circle cx={endX} cy={designEndY + 2.5} r={5} className="fig-shadow" />
              <circle cx={endX} cy={verifEndY + 2.5} r={5} className="fig-shadow" />
              <circle cx={startX} cy={startY + 2.5} r={4} className="fig-shadow" />
              <rect x={bracketX + 6} y={gapMidY - 8 + 5} width={27} height={16} rx={5} className="fig-shadow" />
            </g>
            <g aria-hidden className="fig-fx">
              <circle cx={startX} cy={startY} r={4} className="fill-card" />
              <circle cx={startX} cy={startY} r={4} fill={depthFill(fx, "tier")} className="stroke-fig-generic" strokeWidth={1.25} />
              <circle cx={endX} cy={designEndY} r={5} className="fill-card" />
              <circle cx={endX} cy={designEndY} r={5} fill={depthFill(fx, "violet")} className="stroke-fig-violet" strokeWidth={2} />
              <circle cx={endX} cy={designEndY} r={3.6} fill="none" stroke={rimStroke(fx)} strokeWidth={1} />
              <circle cx={endX} cy={verifEndY} r={5} className="fill-card" />
              <circle cx={endX} cy={verifEndY} r={5} fill={depthFill(fx, "amber")} className="stroke-fig-amber" strokeWidth={2} />
              <circle cx={endX} cy={verifEndY} r={3.6} fill="none" stroke={rimStroke(fx)} strokeWidth={1} />
            </g>

            {/* The width of the gap where it is widest: a rose dimension bracket from one curve's end to the other's, with the label beside it. */}
            <g aria-hidden>
              <line x1={endX + 7} x2={bracketX + 4} y1={designEndY} y2={designEndY} className="stroke-fig-rose" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={endX + 7} x2={bracketX + 4} y1={verifEndY} y2={verifEndY} className="stroke-fig-rose" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={bracketX} x2={bracketX} y1={designEndY} y2={verifEndY} className="stroke-fig-rose" strokeWidth={2.5} strokeLinecap="round" />
            </g>
            {/* The label sits on a raised chip, the one lifted object of the figure. Two sizes: the text is larger on a phone. */}
            <g aria-hidden className="fig-fx">
              <g className="sm:hidden">
                <rect x={bracketX + 5} y={gapMidY - 12.5} width={39} height={25} rx={6.5} className="fill-card" />
                <rect x={bracketX + 5} y={gapMidY - 12.5} width={39} height={25} rx={6.5} className="fill-fig-rose-fill stroke-fig-rose" strokeWidth={1.5} />
                <rect x={bracketX + 6.25} y={gapMidY - 11.25} width={36.5} height={22.5} rx={5.5} fill="none" stroke={rimStroke(fx)} strokeWidth={1} />
              </g>
              <g className="hidden sm:inline">
                <rect x={bracketX + 6} y={gapMidY - 8} width={27} height={16} rx={5} className="fill-card" />
                <rect x={bracketX + 6} y={gapMidY - 8} width={27} height={16} rx={5} className="fill-fig-rose-fill stroke-fig-rose" strokeWidth={1.25} />
                <rect x={bracketX + 7} y={gapMidY - 7} width={25} height={14} rx={4} fill="none" stroke={rimStroke(fx)} strokeWidth={0.75} />
              </g>
            </g>
            <text
              x={bracketX + 24.5}
              y={gapMidY + 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-fig-rose-text text-[15px] font-semibold sm:-translate-x-[5px] sm:text-[10px]"
            >
              gap
            </text>

            <text x={PLOT.left + 8} y={SCREEN.y + 15} className="fill-muted-foreground text-[14.5px] sm:text-[8.5px]">
              Illustrative
            </text>
          </svg>
        </div>
        <ul className="fig-legend text-xs text-foreground" aria-label="Legend">
          <li className="fig-chip">
            <svg width="28" height="10" aria-hidden className="flex-none">
              <line x1="3" y1="5" x2="25" y2="5" className="stroke-fig-violet" strokeWidth={3} strokeLinecap="round" />
            </svg>
            Solid: design complexity (what we can build)
          </li>
          <li className="fig-chip">
            <svg width="28" height="10" aria-hidden className="flex-none">
              <line x1="2" y1="5" x2="26" y2="5" className="stroke-fig-amber" strokeWidth={3} strokeDasharray="7 5" />
            </svg>
            Dashed: verification capability (what we can check)
          </li>
          <li className="fig-chip">
            <svg width="16" height="12" aria-hidden className="flex-none">
              <rect width="16" height="12" rx="2" fill={`url(#${fx}-hatch)`} />
            </svg>
            Hatched: the gap
          </li>
        </ul>
        <figcaption className="fig-caption pt-2 text-xs text-muted-foreground">
          Illustrative shape, not plotted data. Closing the gap takes better methods (reuse, constrained-random stimulus, coverage, formal and emulation),
          not just more hours.
        </figcaption>
      </figure>
    </VisualFrame>
  );
}
