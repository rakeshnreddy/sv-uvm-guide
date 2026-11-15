"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

import { DiagramScrollFrame } from "./BlockDiagram";

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
  pass: { glyph: "✓", className: "fill-fig-emerald-text" },
  fail: { glyph: "✕", className: "fill-fig-rose-text" },
  vacuous: { glyph: "○", className: "fill-fig-slate-text" },
  pending: { glyph: "…", className: "fill-fig-amber-text" },
  // Sky ("the blue band" in captions) is the accent family, distinct from the cyan attempt band.
  info: { glyph: "●", className: "fill-info" },
  sample: { glyph: "▼", className: "fill-fig-violet-text" },
  drive: { glyph: "◆", className: "fill-fig-amber-text" },
};

/** Highlight bands keep their hues (captions name them: the cyan, green, red or rose and blue bands). */
const highlightFill: Record<NonNullable<CycleHighlight["tone"]>, string> = {
  attempt: "fill-fig-cyan-fill stroke-fig-cyan/40",
  fail: "fill-fig-rose-fill stroke-fig-rose/40",
  pass: "fill-fig-emerald-fill stroke-fig-emerald/40",
  info: "fill-sky-500/[0.13] stroke-sky-500/40",
};

const isHigh = (v: CycleValue) => v === 1 || v === "1";
const isUnknown = (v: CycleValue) => v === undefined || v === "X" || v === "x";
const isHighZ = (v: CycleValue) => v === "Z" || v === "z";
const show = (v: CycleValue) => (v === undefined ? "X" : String(v));

/** The X hatch: rose diagonal stripes on a faint rose fill (the visual language's non-colour cue for unknown). */
export function XHatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" className="fill-fig-rose-fill" />
      <line x1="0" y1="0" x2="0" y2="6" className="stroke-fig-rose" strokeWidth="2" />
    </pattern>
  );
}

/** [x0, x1] less every span in `cover`: the parts of a cell a cyan band or cursor does not already tint. */
export function uncoveredSpans(x0: number, x1: number, cover: [number, number][]): [number, number][] {
  let spans: [number, number][] = [[x0, x1]];
  for (const [c0, c1] of cover) {
    spans = spans.flatMap(([a, b]): [number, number][] => {
      if (c1 <= a || c0 >= b) return [[a, b]];
      const out: [number, number][] = [];
      if (c0 > a) out.push([a, c0]);
      if (c1 < b) out.push([c1, b]);
      return out;
    });
  }
  return spans;
}

/**
 * One cycle of a one-bit trace: slate where low, cyan where high with a faint
 * cyan fill under the high level, and the edge drawn in the new level's colour.
 * The fill is left out where a cyan band or the cursor already tints the cell
 * (`cover`), so the two cyans never stack into a second band. A clock
 * (`clock`) is the quiet neutral with no fill, so data stands out.
 */
export function BitCell({
  x0,
  x1,
  hi,
  lo,
  high,
  edgeFrom,
  y,
  cover = [],
  clock = false,
}: {
  x0: number;
  x1: number;
  hi: number;
  lo: number;
  high: boolean;
  edgeFrom: number | null;
  y: number;
  cover?: [number, number][];
  clock?: boolean;
}) {
  const stroke = clock ? "stroke-muted-foreground/80" : high ? "stroke-fig-cyan" : "stroke-fig-slate";
  return (
    <g fill="none" strokeWidth={clock ? 1.5 : 2} strokeLinecap="square">
      {high && !clock
        ? uncoveredSpans(x0, x1, cover).map(([a, b]) => <rect key={a} x={a} y={hi} width={b - a} height={lo - hi} className="fill-fig-cyan-fill" stroke="none" />)
        : null}
      {edgeFrom !== null ? <line x1={x0} x2={x0} y1={edgeFrom} y2={y} className={stroke} /> : null}
      <line x1={x0} x2={x1} y1={y} y2={y} className={stroke} />
    </g>
  );
}

/** One cycle of a bus: an indigo outline with a faint indigo fill, a crossing where the value changes, and the value in text. */
export function BusCell({ x0, x1, hi, lo, changed, label, notch = 3, textSize = "text-[10.5px]" }: { x0: number; x1: number; hi: number; lo: number; changed: boolean; label: string | null; notch?: number; textSize?: string }) {
  const mid = (hi + lo) / 2;
  const left = changed ? x0 + notch : x0;
  const outline = changed ? `M${x0},${mid} L${left},${hi} L${x1},${hi} M${x0},${mid} L${left},${lo} L${x1},${lo}` : `M${x0},${hi} L${x1},${hi} M${x0},${lo} L${x1},${lo}`;
  const area = changed ? `M${x0},${mid} L${left},${hi} L${x1},${hi} L${x1},${lo} L${left},${lo} Z` : `M${x0},${hi} L${x1},${hi} L${x1},${lo} L${x0},${lo} Z`;
  return (
    <g>
      <path d={area} className="fill-fig-indigo-fill" stroke="none" />
      <path d={outline} className="stroke-fig-indigo" strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      {label !== null ? (
        <text x={x0 + notch + 3} y={mid} dominantBaseline="middle" className={cn("fill-fig-indigo-text font-mono font-medium [font-variant-ligatures:none]", textSize)}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

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
  // Where a cyan (attempt) band already tints the rows, a high level draws no fill of its own.
  const cyanCover: [number, number][] = highlights
    .filter((h) => (h.tone ?? "attempt") === "attempt")
    .map((h) => [edgeX(h.from) - W * 0.35, edgeX(h.to) + W * 0.35]);

  return (
    <figure className={cn("glass-liquid p-2", className)} data-figure-kit="timing">
      <DiagramScrollFrame label={title} initiallyScrolls={false}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`${title}. ${edges} clock edges.`}
          className="block"
        >
          <defs>
            <XHatch id={`${id}-hatch`} />
          </defs>

          {/* The label column and the row rules, so the signal names line up like a waveform viewer's. */}
          <rect x={0} y={MARKER_H - 4} width={LABEL_W - 4} height={signals.length * ROW_H + 4} rx={6} className="fill-foreground/[0.035]" />
          {signals.map((signal, row) =>
            row === 0 ? null : (
              <line key={`rule-${signal.name}`} x1={4} x2={width - 4} y1={MARKER_H + row * ROW_H} y2={MARKER_H + row * ROW_H} className="stroke-border/70" strokeWidth={1} />
            ),
          )}

          {highlights.map((h, i) => (
            <rect
              key={`hl-${i}`}
              x={edgeX(h.from) - W * 0.35}
              y={MARKER_H - 4}
              width={edgeX(h.to) - edgeX(h.from) + W * 0.7}
              height={signals.length * ROW_H + 6}
              rx={6}
              className={cn("fig-band", highlightFill[h.tone ?? "attempt"])}
              strokeWidth={1}
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
              className={k === cursor ? "stroke-fig-cyan" : "stroke-muted-foreground/25"}
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
                    className="stroke-muted-foreground/80"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
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
                        return <line x1={x0} x2={x1} y1={mid} y2={mid} className="stroke-fig-amber" strokeWidth={2} strokeDasharray="4 3" />;
                      if (signal.kind === "bit") {
                        const high = isHigh(v);
                        const y = high ? hi : lo;
                        const py = isHigh(prev) ? hi : isUnknown(prev) || isHighZ(prev) ? mid : lo;
                        return <BitCell x0={x0} x1={x1} hi={hi} lo={lo} high={high} edgeFrom={changed ? py : null} y={y} cover={cyanCover} />;
                      }
                      return <BusCell x0={x0} x1={x1} hi={hi} lo={lo} changed={changed} label={changed || k === 0 ? show(v) : null} />;
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
                        className="cursor-pointer focus:outline-none [&:focus-visible>rect:first-child]:stroke-ring"
                      >
                        <rect
                          x={edgeX(k) - W / 2 + 2}
                          y={top + 2}
                          width={W - 4}
                          height={ROW_H - 4}
                          rx={4}
                          className="fill-transparent stroke-transparent hover:fill-fig-cyan/10"
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
                className="cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-ring"
              >
                <rect x={edgeX(k) - 12} y={height - AXIS_H + 2} width={24} height={AXIS_H - 4} rx={4} className={k === cursor ? "fill-fig-cyan-fill" : "fill-transparent"} strokeWidth={1.5} />
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
      </DiagramScrollFrame>
      <figcaption className="mt-1 text-xs text-muted-foreground">{caption}</figcaption>
      {/* sr-only on a wrapper: tables ignore the 1px width sr-only relies on and would overflow. */}
      <div className="sr-only">
      <table>
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
      </div>
    </figure>
  );
}
