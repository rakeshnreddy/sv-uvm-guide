"use client";

import React from "react";

import { cn } from "@/lib/utils";

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

/**
 * Compact waveform whose x-axis is model steps. It doubles as a scrub target:
 * clicking a column seeks there (the range input in PlaybackControls is the
 * keyboard-accessible equivalent).
 */
export function StepWaveform({ signals, snapshots, currentIndex, onSelect, axisLabel, bitSignals = [], className }: StepWaveformProps) {
  const width = LABEL_W + snapshots.length * STEP_W + PAD;
  const height = signals.length * ROW_H + 18;

  return (
    <figure className={cn("rounded-xl border border-border/70 bg-background/40 p-2", className)}>
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Waveform of ${signals.join(", ")} across ${snapshots.length} steps. Current step ${currentIndex + 1}.`}
          className="block"
        >
          <defs>
            <pattern id="wave-x-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(244,63,94,0.12)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.7)" strokeWidth="2" />
            </pattern>
          </defs>
          {/* Current-step cursor */}
          <rect
            x={LABEL_W + currentIndex * STEP_W}
            y={0}
            width={STEP_W}
            height={signals.length * ROW_H}
            className="fill-cyan-400/15 stroke-cyan-400/60"
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
                    return <rect key={i} x={x0} y={hi} width={STEP_W} height={lo - hi} fill="url(#wave-x-hatch)" />;
                  }
                  if (isBit) {
                    const y = v === 1 || v === "1" ? hi : lo;
                    const py = prev === 1 || prev === "1" ? hi : lo;
                    return (
                      <g key={i} className="stroke-cyan-500" strokeWidth={2} fill="none">
                        {changed && !isUnknown(prev) ? <line x1={x0} y1={py} x2={x0} y2={y} /> : null}
                        <line x1={x0} y1={y} x2={x1} y2={y} />
                      </g>
                    );
                  }
                  return (
                    <g key={i}>
                      <path
                        d={`M${x0 + (changed ? 4 : 0)},${hi} L${x1},${hi} M${x0 + (changed ? 4 : 0)},${lo} L${x1},${lo}${changed ? ` M${x0},${(hi + lo) / 2} L${x0 + 4},${hi} M${x0},${(hi + lo) / 2} L${x0 + 4},${lo}` : ""}`}
                        className="stroke-indigo-400"
                        strokeWidth={1.5}
                        fill="none"
                      />
                      {changed || i === 0 ? (
                        <text x={x0 + 7} y={(hi + lo) / 2} dominantBaseline="middle" className="fill-foreground font-mono text-[11px]">
                          {String(v)}
                        </text>
                      ) : null}
                    </g>
                  );
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
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">{axisLabel}</figcaption>
    </figure>
  );
}
