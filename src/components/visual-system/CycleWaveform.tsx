"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

export type CycleValue = number | string | undefined;

export interface CycleSignal {
  name: string;
  kind: "clock" | "bit" | "bus";
  /**
   * `values[k]` is the value *sampled at rising edge k*. It is drawn as
   * changing just after edge k-1 (like a flop output), so the value is stable
   * across edge k. Ignored for `clock`.
   */
  values?: CycleValue[];
  /** Bit signals only: each cell becomes a keyboard-operable toggle. */
  editable?: boolean;
}

export type MarkerTone = "pass" | "fail" | "vacuous" | "pending" | "info" | "sample" | "drive";

export interface CycleMarker {
  /** Edge index the marker belongs to. */
  edge: number;
  tone: MarkerTone;
  /** Accessible description, e.g. "attempt 3 fails: ack low". */
  label: string;
  glyph?: string;
  /** Optional short text drawn under the glyph (e.g. "A3"). */
  short?: string;
}

export interface CycleHighlight {
  from: number;
  to: number;
  tone?: "attempt" | "fail" | "pass" | "info";
  label?: string;
}

interface CycleWaveformProps {
  signals: CycleSignal[];
  edges: number;
  markers?: CycleMarker[];
  highlights?: CycleHighlight[];
  /** Edge shown with a strong cursor line. */
  cursor?: number;
  onToggle?: (signal: string, edge: number) => void;
  onSelectEdge?: (edge: number) => void;
  /** Caption describing the time axis and the sampling convention. */
  caption: string;
  title: string;
  /** Width of one cycle in px (default 44). */
  cycleWidth?: number;
  className?: string;
}

const LABEL_W = 76;
const ROW_H = 34;
const MARKER_H = 30;
const AXIS_H = 22;

const toneStyles: Record<MarkerTone, { glyph: string; className: string }> = {
  pass: { glyph: "✓", className: "fill-emerald-600 dark:fill-emerald-400" },
  fail: { glyph: "✕", className: "fill-rose-600 dark:fill-rose-400" },
  vacuous: { glyph: "○", className: "fill-slate-500 dark:fill-slate-400" },
  pending: { glyph: "…", className: "fill-amber-600 dark:fill-amber-300" },
  info: { glyph: "●", className: "fill-sky-600 dark:fill-sky-400" },
  sample: { glyph: "▼", className: "fill-violet-600 dark:fill-violet-300" },
  drive: { glyph: "◆", className: "fill-amber-600 dark:fill-amber-300" },
};

const highlightFill: Record<NonNullable<CycleHighlight["tone"]>, string> = {
  attempt: "fill-cyan-400/10",
  fail: "fill-rose-500/15",
  pass: "fill-emerald-500/12",
  info: "fill-sky-500/10",
};

const isHigh = (v: CycleValue) => v === 1 || v === "1";
const isUnknown = (v: CycleValue) => v === undefined || v === "X" || v === "x";
const isHighZ = (v: CycleValue) => v === "Z" || v === "z";
const show = (v: CycleValue) => (v === undefined ? "X" : String(v));

/**
 * Cycle-based waveform used by assertion, clocking, protocol and coverage
 * visuals. Edge k sits in the middle of column k; dashed guides mark the
 * sampling instant. A screen-reader table repeats the sampled values.
 */
export function CycleWaveform({
  signals,
  edges,
  markers = [],
  highlights = [],
  cursor,
  onToggle,
  onSelectEdge,
  caption,
  title,
  cycleWidth = 44,
  className,
}: CycleWaveformProps) {
  const id = useId();
  const W = cycleWidth;
  const width = LABEL_W + edges * W + 8;
  const height = MARKER_H + signals.length * ROW_H + AXIS_H;
  const edgeX = (k: number) => LABEL_W + k * W + W / 2;
  // value[k] spans from just after edge k-1 to just after edge k.
  const segStart = (k: number) => (k === 0 ? LABEL_W : edgeX(k - 1) + W * 0.2);
  const segEnd = (k: number) => (k === edges - 1 ? LABEL_W + edges * W : edgeX(k) + W * 0.2);

  return (
    <figure className={cn("rounded-xl border border-border/70 bg-background/40 p-2", className)}>
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`${title}. ${edges} clock edges.`}
          className="block"
        >
          <defs>
            <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(244,63,94,0.12)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.7)" strokeWidth="2" />
            </pattern>
          </defs>

          {highlights.map((h, i) => (
            <rect
              key={`hl-${i}`}
              x={edgeX(h.from) - W * 0.35}
              y={MARKER_H - 4}
              width={edgeX(h.to) - edgeX(h.from) + W * 0.7}
              height={signals.length * ROW_H + 6}
              rx={6}
              className={highlightFill[h.tone ?? "attempt"]}
            >
              {h.label ? <title>{h.label}</title> : null}
            </rect>
          ))}

          {/* Sampling guides at every rising edge */}
          {Array.from({ length: edges }, (_, k) => (
            <line
              key={`edge-${k}`}
              x1={edgeX(k)}
              x2={edgeX(k)}
              y1={MARKER_H - 4}
              y2={MARKER_H + signals.length * ROW_H}
              className={k === cursor ? "stroke-cyan-400" : "stroke-muted-foreground/25"}
              strokeWidth={k === cursor ? 2 : 1}
              strokeDasharray={k === cursor ? undefined : "3 3"}
            />
          ))}

          {/* Markers */}
          {markers.map((m, i) => {
            const style = toneStyles[m.tone];
            return (
              <g key={`mk-${i}`}>
                <title>{m.label}</title>
                <text x={edgeX(m.edge)} y={14} textAnchor="middle" className={cn("text-[13px] font-bold", style.className)}>
                  {m.glyph ?? style.glyph}
                </text>
                {m.short ? (
                  <text x={edgeX(m.edge)} y={26} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                    {m.short}
                  </text>
                ) : null}
              </g>
            );
          })}

          {signals.map((signal, row) => {
            const top = MARKER_H + row * ROW_H;
            const hi = top + 6;
            const lo = top + ROW_H - 8;
            const mid = (hi + lo) / 2;
            return (
              <g key={signal.name}>
                <text x={6} y={mid} dominantBaseline="middle" className="fill-foreground font-mono text-[11px] [font-variant-ligatures:none]">
                  {signal.name}
                </text>
                {signal.kind === "clock" ? (
                  <path
                    d={Array.from({ length: edges }, (_, k) => {
                      const x0 = LABEL_W + k * W;
                      const xe = edgeX(k);
                      const x1 = x0 + W;
                      return `${k === 0 ? `M${x0},${lo}` : `L${x0},${lo}`} L${xe},${lo} L${xe},${hi} L${x1},${hi} L${x1},${lo}`;
                    }).join(" ")}
                    fill="none"
                    className="stroke-slate-400"
                    strokeWidth={1.5}
                  />
                ) : (
                  (signal.values ?? []).slice(0, edges).map((v, k) => {
                    const x0 = segStart(k);
                    const x1 = segEnd(k);
                    const prev = k > 0 ? signal.values?.[k - 1] : v;
                    const changed = k > 0 && prev !== v;
                    const cell = (() => {
                      if (isUnknown(v)) return <rect x={x0} y={hi} width={x1 - x0} height={lo - hi} fill={`url(#${id}-hatch)`} />;
                      if (isHighZ(v))
                        return <line x1={x0} x2={x1} y1={mid} y2={mid} className="stroke-amber-500" strokeWidth={2} strokeDasharray="4 3" />;
                      if (signal.kind === "bit") {
                        const y = isHigh(v) ? hi : lo;
                        const py = isHigh(prev) ? hi : isUnknown(prev) || isHighZ(prev) ? mid : lo;
                        return (
                          <g className="stroke-cyan-500" strokeWidth={2} fill="none">
                            {changed ? <line x1={x0} x2={x0} y1={py} y2={y} /> : null}
                            <line x1={x0} x2={x1} y1={y} y2={y} />
                          </g>
                        );
                      }
                      return (
                        <g>
                          <path
                            d={`M${x0 + (changed ? 3 : 0)},${hi} L${x1},${hi} M${x0 + (changed ? 3 : 0)},${lo} L${x1},${lo}${changed ? ` M${x0},${mid} L${x0 + 3},${hi} M${x0},${mid} L${x0 + 3},${lo}` : ""}`}
                            className="stroke-indigo-400"
                            strokeWidth={1.5}
                            fill="none"
                          />
                          {changed || k === 0 ? (
                            <text x={x0 + 6} y={mid} dominantBaseline="middle" className="fill-foreground font-mono text-[10.5px]">
                              {show(v)}
                            </text>
                          ) : null}
                        </g>
                      );
                    })();
                    if (!signal.editable || signal.kind !== "bit" || !onToggle) return <g key={k}>{cell}</g>;
                    return (
                      <g
                        key={k}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isHigh(v)}
                        aria-label={`${signal.name} at edge ${k}: ${show(v)}. Toggle.`}
                        onClick={() => onToggle(signal.name, k)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onToggle(signal.name, k);
                          }
                        }}
                        className="cursor-pointer focus:outline-none [&:focus-visible>rect:first-child]:stroke-amber-400"
                      >
                        <rect
                          x={edgeX(k) - W / 2 + 2}
                          y={top + 2}
                          width={W - 4}
                          height={ROW_H - 4}
                          rx={4}
                          className="fill-transparent stroke-transparent hover:fill-cyan-400/10"
                          strokeWidth={2}
                        />
                        {cell}
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}

          {/* Edge axis */}
          {Array.from({ length: edges }, (_, k) =>
            onSelectEdge ? (
              <g
                key={`ax-${k}`}
                role="button"
                tabIndex={0}
                aria-label={`Select edge ${k}`}
                aria-pressed={k === cursor}
                onClick={() => onSelectEdge(k)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectEdge(k);
                  }
                }}
                className="cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-amber-400"
              >
                <rect x={edgeX(k) - 12} y={height - AXIS_H + 2} width={24} height={AXIS_H - 4} rx={4} className={k === cursor ? "fill-cyan-500/20" : "fill-transparent"} strokeWidth={1.5} />
                <text x={edgeX(k)} y={height - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                  {k}
                </text>
              </g>
            ) : (
              <text key={`ax-${k}`} x={edgeX(k)} y={height - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                {k}
              </text>
            ),
          )}
        </svg>
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">{caption}</figcaption>
      <table className="sr-only">
        <caption>{title}: value sampled at each edge</caption>
        <thead>
          <tr>
            <th scope="col">Signal</th>
            {Array.from({ length: edges }, (_, k) => (
              <th key={k} scope="col">
                edge {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals
            .filter((s) => s.kind !== "clock")
            .map((s) => (
              <tr key={s.name}>
                <th scope="row">{s.name}</th>
                {Array.from({ length: edges }, (_, k) => (
                  <td key={k}>{show(s.values?.[k])}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </figure>
  );
}
