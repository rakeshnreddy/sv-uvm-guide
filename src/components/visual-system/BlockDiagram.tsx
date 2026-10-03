"use client";

import React, { useId } from "react";

import { cn } from "@/lib/utils";

export type DiagramNodeKind =
  | "test"
  | "env"
  | "agent"
  | "sequencer"
  | "driver"
  | "monitor"
  | "scoreboard"
  | "subscriber"
  | "predictor"
  | "model"
  | "fifo"
  | "sequence"
  | "dut"
  | "interface"
  | "reg"
  | "generic";

/** Short text tags: the non-colour cue for component role. */
export const nodeKindTags: Record<DiagramNodeKind, string> = {
  test: "TEST",
  env: "ENV",
  agent: "AGT",
  sequencer: "SQR",
  driver: "DRV",
  monitor: "MON",
  scoreboard: "SCB",
  subscriber: "SUB",
  predictor: "PRD",
  model: "REF",
  fifo: "FIFO",
  sequence: "SEQ",
  dut: "DUT",
  interface: "IF",
  reg: "REG",
  generic: "",
};

export type NodeState = "normal" | "active" | "dim" | "error" | "ok";

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: DiagramNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Containers (env, agent) are drawn dashed with the label in the corner. */
  container?: boolean;
  state?: NodeState;
  /** Small status text in the top-right corner (e.g. "passive"). */
  badge?: string;
}

export type PortKind = "port" | "export" | "imp" | "analysis_port" | "analysis_imp";

export interface DiagramPort {
  id: string;
  nodeId: string;
  side: "left" | "right" | "top" | "bottom";
  /** Position along the side, 0..1. */
  offset: number;
  kind: PortKind;
  label?: string;
  state?: "normal" | "error" | "active";
}

export type EdgeStyle = "structural" | "data" | "causal" | "control";

export interface DiagramEdge {
  id: string;
  /** Node id or port id. */
  from: string;
  to: string;
  style: EdgeStyle;
  label?: string;
  /** Intermediate waypoints for orthogonal routing. */
  points?: [number, number][];
  state?: "normal" | "active" | "error" | "dim";
}

export interface DiagramToken {
  edgeId: string;
  /** Position along the edge, 0..1. */
  t: number;
  label: string;
  tone?: "data" | "control" | "error";
}

interface BlockDiagramProps {
  title: string;
  width: number;
  height: number;
  nodes: DiagramNode[];
  ports?: DiagramPort[];
  edges?: DiagramEdge[];
  tokens?: DiagramToken[];
  selectedId?: string;
  onSelect?: (nodeId: string) => void;
  /** Minimum rendered width before the diagram scrolls horizontally (px). */
  minWidth?: number;
  showLegend?: boolean;
  className?: string;
}

type Point = [number, number];

const nodeStateClass: Record<NodeState, string> = {
  normal: "fill-card stroke-border",
  active: "fill-cyan-500/15 stroke-cyan-500",
  dim: "fill-card/40 stroke-border/40 opacity-50",
  error: "fill-rose-500/10 stroke-rose-500",
  ok: "fill-emerald-500/10 stroke-emerald-500",
};

const edgeStyleProps: Record<EdgeStyle, { dash?: string; marker?: "filled" | "open"; width: number }> = {
  structural: { width: 1.2 },
  data: { marker: "filled", width: 1.8 },
  causal: { dash: "6 4", marker: "open", width: 1.5 },
  control: { dash: "2 3", marker: "open", width: 1.5 },
};

function portPosition(port: DiagramPort, node: DiagramNode): Point {
  switch (port.side) {
    case "left":
      return [node.x, node.y + node.h * port.offset];
    case "right":
      return [node.x + node.w, node.y + node.h * port.offset];
    case "top":
      return [node.x + node.w * port.offset, node.y];
    case "bottom":
      return [node.x + node.w * port.offset, node.y + node.h];
  }
}

function nodeAnchor(node: DiagramNode, toward: Point): Point {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (Math.abs(dx) * node.h > Math.abs(dy) * node.w) {
    return [dx > 0 ? node.x + node.w : node.x, cy];
  }
  return [cx, dy > 0 ? node.y + node.h : node.y];
}

/** Interpolates a point at fraction t along a polyline. */
export function pointAlong(points: Point[], t: number): Point {
  const segments = points.slice(1).map((p, i) => {
    const a = points[i];
    return { a, b: p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) };
  });
  const total = segments.reduce((s, seg) => s + seg.len, 0);
  if (total === 0) return points[0];
  let remaining = Math.min(Math.max(t, 0), 1) * total;
  for (const seg of segments) {
    if (remaining <= seg.len) {
      const f = seg.len === 0 ? 0 : remaining / seg.len;
      return [seg.a[0] + (seg.b[0] - seg.a[0]) * f, seg.a[1] + (seg.b[1] - seg.a[1]) * f];
    }
    remaining -= seg.len;
  }
  return points[points.length - 1];
}

function PortGlyph({ port, at }: { port: DiagramPort; at: Point }) {
  const [x, y] = at;
  const cls = cn(
    "stroke-[1.5]",
    port.state === "error" ? "stroke-rose-500" : port.state === "active" ? "stroke-cyan-400" : "stroke-foreground/70",
  );
  switch (port.kind) {
    case "port":
      return <rect x={x - 5} y={y - 5} width={10} height={10} className={cn(cls, "fill-background")} />;
    case "export":
      return <circle cx={x} cy={y} r={5.5} className={cn(cls, "fill-background")} />;
    case "imp":
    case "analysis_imp":
      return <circle cx={x} cy={y} r={5.5} className={cn(cls, "fill-foreground/70")} />;
    case "analysis_port":
      return <path d={`M${x},${y - 6} L${x + 6},${y} L${x},${y + 6} L${x - 6},${y} Z`} className={cn(cls, "fill-background")} />;
  }
}

/**
 * Component/transaction diagram used by UVM and architecture visuals. Node
 * roles carry text tags (DRV, MON…), TLM endpoints use the conventional UVM
 * symbols (port ■, export ○, imp ●, analysis port ◆), and edge styles follow
 * the shared line conventions.
 */
export function BlockDiagram({
  title,
  width,
  height,
  nodes,
  ports = [],
  edges = [],
  tokens = [],
  selectedId,
  onSelect,
  minWidth = 320,
  showLegend = false,
  className,
}: BlockDiagramProps) {
  const id = useId();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const portById = new Map(ports.map((p) => [p.id, p]));

  const resolve = (ref: string, toward: Point): Point => {
    const port = portById.get(ref);
    if (port) {
      const node = nodeById.get(port.nodeId);
      return node ? portPosition(port, node) : toward;
    }
    const node = nodeById.get(ref);
    return node ? nodeAnchor(node, toward) : toward;
  };
  const centerOf = (ref: string): Point => {
    const port = portById.get(ref);
    if (port) {
      const node = nodeById.get(port.nodeId);
      return node ? portPosition(port, node) : [0, 0];
    }
    const node = nodeById.get(ref);
    return node ? [node.x + node.w / 2, node.y + node.h / 2] : [0, 0];
  };

  const edgePoints = (edge: DiagramEdge): Point[] => {
    const via = edge.points ?? [];
    const start = resolve(edge.from, via[0] ?? centerOf(edge.to));
    const end = resolve(edge.to, via[via.length - 1] ?? centerOf(edge.from));
    return [start, ...via, end];
  };

  const ordered = [...nodes].sort((a, b) => Number(Boolean(b.container)) - Number(Boolean(a.container)));

  return (
    <figure className={cn("rounded-xl border border-border/70 bg-background/40 p-2", className)}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth }} className="block h-auto w-full" role="group" aria-label={title}>
          <defs>
            <marker id={`${id}-filled`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className="fill-foreground/70" />
            </marker>
            <marker id={`${id}-open`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1,1 L9,5 L1,9" fill="none" className="stroke-foreground/70" strokeWidth="1.6" />
            </marker>
          </defs>

          {ordered.map((node) => {
            const state = node.state ?? "normal";
            const selectable = Boolean(onSelect) && !node.container;
            const tag = nodeKindTags[node.kind];
            const isDut = node.kind === "dut";
            const body = (
              <>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={node.container ? 14 : isDut ? 3 : 10}
                  className={cn(
                    node.container ? "fill-muted/20 stroke-border" : nodeStateClass[state],
                    isDut && !node.container && state === "normal" && "fill-violet-500/10 stroke-violet-500/60",
                    selectedId === node.id && "stroke-amber-400",
                  )}
                  strokeWidth={selectedId === node.id || state === "active" || state === "error" ? 2.2 : 1.2}
                  strokeDasharray={node.container ? "6 4" : undefined}
                />
                {node.container ? (
                  <text x={node.x + 10} y={node.y + 16} className="fill-muted-foreground text-[11px] font-semibold">
                    {tag ? `${tag} · ` : ""}
                    {node.label}
                  </text>
                ) : (
                  <>
                    {tag ? (
                      <text x={node.x + 8} y={node.y + 14} className="fill-muted-foreground text-[9px] font-bold tracking-wider">
                        {tag}
                      </text>
                    ) : null}
                    <text
                      x={node.x + node.w / 2}
                      y={node.y + node.h / 2 + (node.sublabel ? -2 : 4)}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[11.5px] font-semibold [font-variant-ligatures:none]"
                    >
                      {node.label}
                    </text>
                    {node.sublabel ? (
                      <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 13} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">
                        {node.sublabel}
                      </text>
                    ) : null}
                  </>
                )}
                {node.badge ? (
                  <text x={node.x + node.w - 8} y={node.y + 14} textAnchor="end" className="fill-amber-600 text-[9px] font-bold uppercase dark:fill-amber-300">
                    {node.badge}
                  </text>
                ) : null}
              </>
            );
            if (!selectable) return <g key={node.id}>{body}</g>;
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === node.id}
                aria-label={`${tag ? `${tag} ` : ""}${node.label}${node.sublabel ? `, ${node.sublabel}` : ""}${node.badge ? `, ${node.badge}` : ""}${state !== "normal" ? `, ${state}` : ""}`}
                onClick={() => onSelect?.(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(node.id);
                  }
                }}
                className="cursor-pointer focus:outline-none [&:focus-visible>rect:first-child]:stroke-amber-400"
              >
                {body}
              </g>
            );
          })}

          {edges.map((edge) => {
            const pts = edgePoints(edge);
            const style = edgeStyleProps[edge.style];
            const mid = pointAlong(pts, 0.5);
            const stateCls =
              edge.state === "error" ? "stroke-rose-500" : edge.state === "active" ? "stroke-cyan-400" : edge.state === "dim" ? "stroke-foreground/20" : "stroke-foreground/60";
            return (
              <g key={edge.id}>
                <polyline
                  points={pts.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  className={stateCls}
                  strokeWidth={edge.state === "active" ? style.width + 0.8 : style.width}
                  strokeDasharray={style.dash}
                  markerEnd={style.marker ? `url(#${id}-${style.marker})` : undefined}
                />
                {edge.label ? (
                  <g>
                    <rect x={mid[0] - edge.label.length * 3.1 - 4} y={mid[1] - 9} width={edge.label.length * 6.2 + 8} height={16} rx={4} className="fill-background/90" />
                    <text x={mid[0]} y={mid[1] + 3} textAnchor="middle" className="fill-foreground font-mono text-[10px] [font-variant-ligatures:none]">
                      {edge.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {ports.map((port) => {
            const node = nodeById.get(port.nodeId);
            if (!node) return null;
            const at = portPosition(port, node);
            const labelX = port.side === "left" ? at[0] + 9 : port.side === "right" ? at[0] - 9 : at[0];
            const labelY = port.side === "top" ? at[1] + 16 : port.side === "bottom" ? at[1] - 9 : at[1] + 3;
            const anchor = port.side === "left" ? "start" : port.side === "right" ? "end" : "middle";
            return (
              <g key={port.id}>
                <PortGlyph port={port} at={at} />
                {port.label ? (
                  <text x={labelX} y={labelY} textAnchor={anchor} className="fill-muted-foreground font-mono text-[9px]">
                    {port.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {tokens.map((token, i) => {
            const edge = edges.find((e) => e.id === token.edgeId);
            if (!edge) return null;
            const [x, y] = pointAlong(edgePoints(edge), token.t);
            const tone = token.tone ?? "data";
            return (
              <g key={`tok-${i}`} aria-label={`${token.label} on ${edge.label ?? edge.id}`}>
                <rect
                  x={x - token.label.length * 3.2 - 6}
                  y={y - 10}
                  width={token.label.length * 6.4 + 12}
                  height={20}
                  rx={10}
                  className={cn(
                    tone === "error" ? "fill-rose-500 stroke-rose-300" : tone === "control" ? "fill-amber-400 stroke-amber-200" : "fill-cyan-500 stroke-cyan-200",
                  )}
                  strokeWidth={1}
                />
                <text x={x} y={y + 4} textAnchor="middle" className="fill-slate-950 font-mono text-[10px] font-bold [font-variant-ligatures:none]">
                  {token.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {showLegend ? (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>■ port</span>
          <span>○ export</span>
          <span>● imp</span>
          <span>◆ analysis port</span>
          <span>── data flow →</span>
          <span>- - causal / call order</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
