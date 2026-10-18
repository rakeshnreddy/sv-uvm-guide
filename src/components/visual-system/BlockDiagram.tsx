"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { EDGE_STYLES, edgeLabelBox, nodeKindTags, PHONE_FIT_WIDTH, pointAlong, portPosition, routeEdges, type Point } from "./diagram-layout";

export { nodeKindTags, pointAlong };

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
  /**
   * Accessible role of the SVG. "img" (static pictures: the MDX kit) names it
   * with <title> and describes it with <desc>; "group" (the default, for
   * visualizers with live state or selectable nodes) uses aria-label and keeps
   * its children in the accessibility tree.
   */
  role?: "img" | "group";
  /** Text equivalent rendered as <desc> when role is "img". */
  description?: string;
  /** Spread edge ends that share a node side along that side (see routeEdges). */
  spreadAnchors?: boolean;
  className?: string;
}

const nodeStateClass: Record<NodeState, string> = {
  normal: "fill-card stroke-border",
  active: "fill-cyan-500/15 stroke-cyan-500",
  dim: "fill-card/40 stroke-border/40 opacity-50",
  error: "fill-rose-500/10 stroke-rose-500",
  ok: "fill-emerald-500/10 stroke-emerald-500",
};

/** Legend entries in display order: TLM endpoint symbols, then line styles. */
const PORT_LEGEND: { kinds: PortKind[]; text: string }[] = [
  { kinds: ["port"], text: "■ port" },
  { kinds: ["export"], text: "○ export" },
  { kinds: ["imp", "analysis_imp"], text: "● imp" },
  { kinds: ["analysis_port"], text: "◆ analysis port" },
];
const EDGE_LEGEND: { style: EdgeStyle; text: string }[] = [
  { style: "data", text: "── data flow →" },
  { style: "control", text: "··· control →" },
  { style: "causal", text: "- - causal / call order →" },
  { style: "structural", text: "── connection (no direction)" },
];

/** The legend lists only the port symbols and line styles the diagram actually draws. */
export function legendItems(ports: Pick<DiagramPort, "kind">[], edges: Pick<DiagramEdge, "style">[]): string[] {
  const kinds = new Set(ports.map((p) => p.kind));
  const styles = new Set(edges.map((e) => e.style));
  return [
    ...PORT_LEGEND.filter((item) => item.kinds.some((k) => kinds.has(k))).map((item) => item.text),
    ...EDGE_LEGEND.filter((item) => styles.has(item.style)).map((item) => item.text),
  ];
}

/**
 * Horizontal scroll frame for a diagram that may be wider than the screen.
 * While its content overflows it is a named, focusable region, so keyboard
 * users can scroll it with the arrow keys. Before the first measurement (and
 * without ResizeObserver) it trusts `initiallyScrolls`.
 */
export function DiagramScrollFrame({
  label,
  initiallyScrolls,
  className,
  children,
}: {
  label: string;
  initiallyScrolls: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(initiallyScrolls);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn("overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      data-diagram-scroll={scrolls ? "true" : undefined}
      {...(scrolls ? { role: "region", tabIndex: 0, "aria-label": `Scrollable diagram: ${label}` } : {})}
    >
      {children}
    </div>
  );
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
  role = "group",
  description,
  spreadAnchors = false,
  className,
}: BlockDiagramProps) {
  const id = useId();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const routes = routeEdges(nodes, ports, edges, { spreadAnchors });
  const legend = showLegend ? legendItems(ports, edges) : [];

  const ordered = [...nodes].sort((a, b) => Number(Boolean(b.container)) - Number(Boolean(a.container)));
  const a11y =
    role === "img"
      ? { role: "img", "aria-labelledby": `${id}-title`, "aria-describedby": description ? `${id}-desc` : undefined }
      : { role: "group", "aria-label": title };

  return (
    <figure className={cn("rounded-xl border border-border/70 bg-background/40 p-2", className)}>
      <DiagramScrollFrame label={title} initiallyScrolls={minWidth > PHONE_FIT_WIDTH}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth }} className="block h-auto w-full" {...a11y}>
          {role === "img" ? <title id={`${id}-title`}>{title}</title> : null}
          {role === "img" && description ? <desc id={`${id}-desc`}>{description}</desc> : null}
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

          {edges.map((edge, i) => {
            const pts = routes[i];
            const style = EDGE_STYLES[edge.style];
            const mid = pointAlong(pts, 0.5);
            const labelBox = edge.label ? edgeLabelBox(edge.label, mid) : null;
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
                {labelBox ? (
                  <g>
                    <rect x={labelBox.x} y={labelBox.y} width={labelBox.w} height={labelBox.h} rx={4} className="fill-background/90" />
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
            const index = edges.findIndex((e) => e.id === token.edgeId);
            if (index < 0) return null;
            const edge = edges[index];
            const [x, y] = pointAlong(routes[index], token.t);
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
      </DiagramScrollFrame>
      {legend.length ? (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" data-testid="diagram-legend">
          {legend.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
