"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

import { DiagramScrollFrame } from "./BlockDiagram";
import { BitCell, BusCell, XHatch } from "./CycleWaveform";
import { FigureDepthDefs } from "./figure-depth";

type WaveValue = number | string | undefined;

interface StepWaveformProps {
  signals: string[];
  /** One value snapshot per step. */
  snapshots: Record<string, WaveValue>[];
  currentIndex: number;
  onSelect?: (index: number) => void;
  /** Caption that states what the horizontal axis means. */
  axisLabel: string;
  /** Signals treated as single-bit (drawn as digital lines rather than buses). */
  bitSignals?: string[];
  className?: string;
}

const ROW_H = 30;
const LABEL_W = 56;
const STEP_W = 26;
const PAD = 6;

const isUnknown = (v: WaveValue) => v === undefined || v === "X" || v === "x";

/** A clock row ("clk", "clock", "sys_clk"…) is drawn in the quiet neutral, as CycleWaveform draws its clock. */
export const isClockName = (name: string) => /(^|_)clk$|^clock$/i.test(name);

/**
 * Compact waveform whose x-axis is model steps. It doubles as a scrub target:
 * clicking a column seeks there (the range input in PlaybackControls is the
 * keyboard-accessible equivalent).
 */
export function StepWaveform({ signals, snapshots, currentIndex, onSelect, axisLabel, bitSignals = [], className }: StepWaveformProps) {
  const id = useId();
  const hatch = `${id}-x-hatch`;
  const cursor: [number, number][] = [[LABEL_W + currentIndex * STEP_W, LABEL_W + (currentIndex + 1) * STEP_W]];
  const width = LABEL_W + snapshots.length * STEP_W + PAD;
  const height = signals.length * ROW_H + 18;

  return (
    <figure className={cn("glass-liquid fig-panel", className)} data-figure-kit="timing">
      <DiagramScrollFrame label={"Waveform"} initiallyScrolls={false} className="fig-stage">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Waveform of ${signals.join(", ")} across ${snapshots.length} steps. Current step ${currentIndex + 1}.`}
          className="block"
        >
          <defs>
            <XHatch id={hatch} />
            <FigureDepthDefs id={id} hues={["indigo"]} width={width} height={height} level />
          </defs>
          {/* The screen the traces are drawn on sits lower than the panel. */}
          <rect aria-hidden x={LABEL_W - 2} y={0} width={snapshots.length * STEP_W + 4} height={signals.length * ROW_H} rx={6} className="fig-fx fig-well" stroke="none" />
          {/* The label column and the row rules, so the signal names line up. */}
          <rect x={0} y={0} width={LABEL_W - 4} height={signals.length * ROW_H} rx={6} className="fill-foreground/[0.035]" />
          {signals.map((signal, row) =>
            row === 0 ? null : <line key={`rule-${signal}`} x1={4} x2={width - 4} y1={row * ROW_H} y2={row * ROW_H} className="stroke-border/70" strokeWidth={1} />,
          )}
          {/* Current-step cursor */}
          <rect
            x={LABEL_W + currentIndex * STEP_W}
            y={0}
            width={STEP_W}
            height={signals.length * ROW_H}
            className="fill-fig-cyan-fill stroke-fig-cyan/70"
            strokeWidth={1}
          />
          {signals.map((signal, row) => {
            const top = row * ROW_H + 6;
            const hi = top + 2;
            const lo = top + ROW_H - 10;
            const isBit = bitSignals.includes(signal);
            return (
              <g key={signal}>
                <text x={4} y={top + ROW_H / 2} className="fill-muted-foreground font-mono text-[11px]" dominantBaseline="middle">
                  {signal}
                </text>
                {snapshots.map((snap, i) => {
                  const v = snap[signal];
                  const prev = i > 0 ? snapshots[i - 1][signal] : v;
                  const x0 = LABEL_W + i * STEP_W;
                  const x1 = x0 + STEP_W;
                  const changed = i > 0 && prev !== v;
                  if (isUnknown(v)) {
                    return <rect key={i} x={x0} y={hi} width={STEP_W} height={lo - hi} fill={`url(#${hatch})`} />;
                  }
                  if (isBit) {
                    const high = v === 1 || v === "1";
                    const y = high ? hi : lo;
                    const py = prev === 1 || prev === "1" ? hi : lo;
                    return <BitCell key={i} x0={x0} x1={x1} hi={hi} lo={lo} high={high} edgeFrom={changed && !isUnknown(prev) ? py : null} y={y} cover={cursor} clock={isClockName(signal)} depthId={id} />;
                  }
                  return <BusCell key={i} x0={x0} x1={x1} hi={hi} lo={lo} changed={changed} notch={4} textSize="text-[11px]" label={changed || i === 0 ? String(v) : null} depthId={id} />;
                })}
              </g>
            );
          })}
          {onSelect
            ? snapshots.map((_, i) => (
                <rect
                  key={`hit-${i}`}
                  x={LABEL_W + i * STEP_W}
                  y={0}
                  width={STEP_W}
                  height={signals.length * ROW_H}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onSelect(i)}
                  aria-hidden
                />
              ))
            : null}
          <text x={LABEL_W} y={height - 4} className="fill-muted-foreground text-[10px]">
            step 1
          </text>
          <text x={width - PAD} y={height - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            step {snapshots.length}
          </text>
        </svg>
      </DiagramScrollFrame>
      <figcaption className="fig-caption text-xs text-muted-foreground">{axisLabel}</figcaption>
    </figure>
  );
}
