"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { EDGE_STYLES, edgeLabelBox, nodeKindTags, PHONE_FIT_WIDTH, pointAlong, portPosition, routeEdges, type Point } from "./diagram-layout";
import { assignedRoleWords, edgeToneOf, edgeTones, effectiveRole, roleStyles, stateStyles, tagChipWidth, type AssignedRole, type EdgeTone, type FigureRole } from "./figure-colours";

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
  /**
   * A text-free colour role for a node of kind "generic" (design or
   * testbench): the role's fill, stroke and corner shape, with no tag chip and
   * no change to the text or geometry; the legend lists the role's term. On a
   * node whose kind has a role it must agree with that role, except on a
   * side-overridable kind (SIDE_OVERRIDABLE_KINDS: fifo, reg), where it may
   * set the side and the node keeps its tag.
   */
  role?: AssignedRole;
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
   * With no full legend, still draw the role terms alone when some part takes
   * its colour from a `role` (no tag says it), so every colour drawn can be
   * looked up (roleKeyEntries). The MDX kit sets it; visualizers leave it off.
   */
  showRoleKey?: boolean;
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

/** Legend entries in display order: node roles, TLM endpoint symbols, then line styles. */
const PORT_LEGEND: { kinds: PortKind[]; glyph: PortKind; text: string }[] = [
  { kinds: ["port"], glyph: "port", text: "port" },
  { kinds: ["export"], glyph: "export", text: "export" },
  { kinds: ["imp", "analysis_imp"], glyph: "imp", text: "imp" },
  { kinds: ["analysis_port"], glyph: "analysis_port", text: "analysis port" },
];
const EDGE_LEGEND: { style: EdgeStyle; text: string }[] = [
  { style: "data", text: "data flow" },
  { style: "control", text: "control" },
  { style: "causal", text: "causal / call order" },
  { style: "structural", text: "connection (no direction)" },
];
const ROLE_ORDER: FigureRole[] = ["design", "testbench", "interface", "register"];

export type LegendEntry =
  | { type: "role"; role: FigureRole; text: string }
  | { type: "port"; kind: PortKind; text: string }
  /** `tones`: the colours this line style takes in the figure (control can be amber, neutral or both). */
  | { type: "edge"; style: EdgeStyle; text: string; tones: EdgeTone[] };

type LegendNode = Pick<DiagramNode, "kind"> & Partial<Pick<DiagramNode, "id" | "role" | "state">>;
type LegendPort = Pick<DiagramPort, "kind"> & Partial<Pick<DiagramPort, "id" | "nodeId">>;
type LegendEdge = Pick<DiagramEdge, "style"> & Partial<Pick<DiagramEdge, "from" | "to">>;

/**
 * Whether an edge touches a testbench node at either end (an end is a node id
 * or a port id). An edge whose ends are unknown counts as touching one, so
 * control keeps its testbench amber when nothing says otherwise.
 */
export function edgeTouchesTestbench(edge: Partial<Pick<DiagramEdge, "from" | "to">>, nodes: LegendNode[], ports: LegendPort[]): boolean {
  if (edge.from === undefined || edge.to === undefined) return true;
  const nodeOf = (ref: string) => {
    const node = nodes.find((n) => n.id === ref);
    if (node) return node;
    const port = ports.find((p) => p.id === ref);
    return port ? nodes.find((n) => n.id === port.nodeId) : undefined;
  };
  return [edge.from, edge.to].some((ref) => {
    const node = nodeOf(ref);
    return effectiveRole(node?.kind, node?.role) === "testbench";
  });
}

/**
 * The legend lists only the roles, port symbols and line styles the diagram
 * actually draws; each entry is drawn with its colour and shape beside it.
 */
export function legendEntries(ports: LegendPort[], edges: LegendEdge[], nodes: LegendNode[] = []): LegendEntry[] {
  // Every colour in use has its term: a role term is listed when any part is
  // drawn in that role, whether from its kind or from a `role`. A part whose
  // side was overridden counts under the role it is drawn in only. The terms
  // are plain words true of every part they cover ("design", not "design
  // (DUT)": a dut node already says DUT on its tag). DESIGN.md section 13.
  // A node in a state (active, error, ok, dim) is drawn in the state's look,
  // not its role's, so it adds no role term.
  const roles = new Set(nodes.filter(drawnInRole).map((n) => effectiveRole(n.kind, n.role)));
  const kinds = new Set(ports.map((p) => p.kind));
  const tonesOf = (style: EdgeStyle): EdgeTone[] => {
    const tones = edges.filter((e) => e.style === style).map((e) => edgeToneOf(style, "normal", edgeTouchesTestbench(e, nodes, ports)));
    return [...new Set(tones)];
  };
  return [
    ...ROLE_ORDER.filter((role) => roles.has(role)).map((role) => ({ type: "role" as const, role, text: roleStyles[role].legend ?? role })),
    ...PORT_LEGEND.filter((item) => item.kinds.some((k) => kinds.has(k))).map((item) => ({ type: "port" as const, kind: item.glyph, text: item.text })),
    ...EDGE_LEGEND.map((item) => ({ type: "edge" as const, style: item.style, text: item.text, tones: tonesOf(item.style) })).filter((item) => item.tones.length > 0),
  ];
}

/** Whether a node is drawn in its role's colour: a state (active, error, ok, dim) wins over the role. */
function drawnInRole(node: LegendNode): boolean {
  return (node.state ?? "normal") === "normal";
}

/**
 * The role terms alone, for a figure that shows no full legend (legend off, or
 * no lines or ports): listed only when some part drawn in its role takes that
 * colour from a `role` rather than from a tag (a generic part with a role, or
 * a side-overridable kind moved to the other side), so that colour can still
 * be looked up. Tagged parts alone need no key: their tag names them. When
 * the key shows, it lists every role colour drawn, as the full legend does.
 */
export function roleKeyEntries(nodes: LegendNode[]): LegendEntry[] {
  const roleColoured = nodes.some((n) => drawnInRole(n) && assignedRoleWords(n.kind, n.role) !== null);
  return roleColoured ? legendEntries([], [], nodes) : [];
}

/** A row of legend entries, each term with its colour and shape drawn beside it. */
export function DiagramLegend({ entries, as: Tag = "figcaption", className }: { entries: LegendEntry[]; as?: "figcaption" | "div"; className?: string }) {
  if (!entries.length) return null;
  return (
    <Tag className={cn("flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground", className)} data-testid="diagram-legend">
      {entries.map((entry) => (
        <span key={`${entry.type}-${entry.text}`} className="inline-flex items-center gap-1.5">
          <LegendSwatch entry={entry} />
          <span>{entry.text}</span>
        </span>
      ))}
    </Tag>
  );
}

/** The legend's terms, in order. */
export function legendItems(ports: LegendPort[], edges: LegendEdge[], nodes: LegendNode[] = []): string[] {
  return legendEntries(ports, edges, nodes).map((entry) => entry.text);
}

/** The step number of a label that starts "N. " (a numbered step), or null. */
export function stepNumberOf(label: string): string | null {
  return /^(\d+)\.\s/.exec(label)?.[1] ?? null;
}

/**
 * A numbered label ("1. drive") drawn with its number on a filled badge. The
 * text stays exactly as written, so its width and the layout tests do not
 * change: the digits take the badge's contrast colour and the "." is
 * transparent. The badge is placed from the 0.6 em mono advance of the label's
 * font (`charW`), for text anchored at its middle (`cx`).
 */
export function StepLabelBadge({ label, cx, baseline, charW, height, className }: { label: string; cx: number; baseline: number; charW: number; height: number; className: string }) {
  const step = stepNumberOf(label);
  if (!step) return null;
  const startX = cx - (label.length * charW) / 2;
  const w = Math.max(height, step.length * charW + 7);
  const centre = startX + (step.length * charW) / 2;
  return <rect data-step-badge={step} x={centre - w / 2} y={baseline - height + 3.5} width={w} height={height} rx={height / 2} className={className} />;
}

function StepLabelText({ label, digitsClass }: { label: string; digitsClass: string }) {
  const step = stepNumberOf(label);
  if (!step) return <>{label}</>;
  return (
    <>
      <tspan className={digitsClass}>{step}</tspan>
      <tspan fillOpacity={0}>.</tspan>
      {label.slice(step.length + 1)}
    </>
  );
}

/** The colour and shape drawn beside a legend term (decorative: the term is the text). */
function LegendSwatch({ entry }: { entry: LegendEntry }) {
  if (entry.type === "role") {
    return <span aria-hidden className={cn("inline-block h-3 w-4 shrink-0 border-[1.5px]", roleStyles[entry.role].swatch)} />;
  }
  if (entry.type === "port") {
    return (
      <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
        <PortGlyph port={{ id: "legend", nodeId: "legend", side: "left", offset: 0, kind: entry.kind }} at={[7, 7]} />
      </svg>
    );
  }
  const style = EDGE_STYLES[entry.style];
  return (
    <>
      {entry.tones.map((key) => {
        const tone = edgeTones[key];
        return (
          <svg key={key} aria-hidden width="30" height="10" viewBox="0 0 30 10" className="shrink-0" fill="none" data-legend-tone={key}>
            <path d="M1,5 H26" className={tone.stroke} strokeWidth={Math.max(1.5, style.width)} strokeDasharray={style.dash} />
            {style.marker === "filled" ? <path d="M22,1.5 L29,5 L22,8.5 Z" className={cn("fig-solid", tone.marker)} /> : null}
            {style.marker === "open" ? <path d="M23,1.5 L28.5,5 L23,8.5" className={tone.markerStroke} strokeWidth={1.5} /> : null}
          </svg>
        );
      })}
    </>
  );
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
    port.state === "error" ? "stroke-fig-rose" : port.state === "active" ? "stroke-fig-cyan" : "stroke-foreground/80",
  );
  const solid = port.state === "error" ? "fill-fig-rose" : port.state === "active" ? "fill-fig-cyan" : "fill-foreground/80";
  switch (port.kind) {
    case "port":
      return <rect x={x - 5} y={y - 5} width={10} height={10} rx={1.5} className={cn(cls, "fill-card")} />;
    case "export":
      return <circle cx={x} cy={y} r={5.5} className={cn(cls, "fill-card")} />;
    case "imp":
    case "analysis_imp":
      return <circle cx={x} cy={y} r={5.5} className={cn(cls, solid, "fig-solid")} />;
    case "analysis_port":
      return <path d={`M${x},${y - 6} L${x + 6},${y} L${x},${y + 6} L${x - 6},${y} Z`} className={cn(cls, "fill-card")} />;
  }
}

const MARKER_TONES = Object.keys(edgeTones) as EdgeTone[];

/** Advance of one character of a node label (11.5 px JetBrains Mono, 0.6 em) and of an edge label (10 px). */
const NODE_CHAR_W = 11.5 * 0.6;
const EDGE_CHAR_W = 10 * 0.6;

/**
 * A ✓ or ✕ on a small disc at the node's top-right corner, so ok and error
 * differ by shape as well as colour (emerald and rose are close under
 * deuteranopia). Kept inside the drawing.
 */
function StateMark({ node, state, width, height }: { node: DiagramNode; state: "ok" | "error"; width: number; height: number }) {
  const r = 6.5;
  const cx = Math.min(node.x + node.w, width - r - 1);
  const cy = Math.max(node.y, r + 1);
  const glyph = state === "ok" ? `M${cx - 3},${cy + 0.2} L${cx - 0.8},${cy + 2.6} L${cx + 3.2},${cy - 2.6}` : `M${cx - 2.4},${cy - 2.4} L${cx + 2.4},${cy + 2.4} M${cx + 2.4},${cy - 2.4} L${cx - 2.4},${cy + 2.4}`;
  return (
    <g aria-hidden data-state-mark={state}>
      <circle cx={cx} cy={cy} r={r} className={cn("fig-solid", state === "ok" ? "fill-fig-emerald" : "fill-fig-rose")} />
      <path d={glyph} fill="none" className="stroke-card" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** One filled and one open arrowhead per edge colour, so each arrowhead takes its line's colour. */
export function EdgeMarkers({ id }: { id: string }) {
  return (
    <>
      {MARKER_TONES.map((tone) => (
        <React.Fragment key={tone}>
          <marker id={`${id}-filled-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" className={cn("fig-solid", edgeTones[tone].marker)} />
          </marker>
          <marker id={`${id}-open-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" fill="none" className={edgeTones[tone].markerStroke} strokeWidth="1.6" />
          </marker>
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Component/transaction diagram used by UVM and architecture visuals. Node
 * roles carry text tags (DRV, MON…) on a chip in the role colour (DESIGN.md
 * section 13): design violet and square, testbench amber and rounded, interface
 * indigo, register model teal, and nodes with no role a neutral tint of the
 * lesson's tier. States (active, error, ok, dim) win over the role colour. TLM
 * endpoints use the conventional UVM symbols (port ■, export ○, imp ●,
 * analysis port ◆), and each edge style has its own colour and dash.
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
  showRoleKey = false,
  role = "group",
  description,
  spreadAnchors = false,
  className,
}: BlockDiagramProps) {
  const id = useId();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const routes = routeEdges(nodes, ports, edges, { spreadAnchors });
  const legend = showLegend ? legendEntries(ports, edges, nodes) : showRoleKey ? roleKeyEntries(nodes) : [];

  // A container inside another container draws no fill, so nested tints (TEST, ENV, AGT) do not stack.
  const nestedContainers = new Set(
    nodes
      .filter((c) => c.container && nodes.some((d) => d !== c && d.container && d.x <= c.x && d.y <= c.y && d.x + d.w >= c.x + c.w && d.y + d.h >= c.y + c.h))
      .map((c) => c.id),
  );
  const ordered = [...nodes].sort((a, b) => Number(Boolean(b.container)) - Number(Boolean(a.container)));
  const a11y =
    role === "img"
      ? { role: "img", "aria-labelledby": `${id}-title`, "aria-describedby": description ? `${id}-desc` : undefined }
      : { role: "group", "aria-label": title };

  return (
    <figure className={cn("glass-liquid p-2", className)} data-figure-kit="block">
      <DiagramScrollFrame label={title} initiallyScrolls={minWidth > PHONE_FIT_WIDTH}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth }} className="block h-auto w-full" {...a11y}>
          {role === "img" ? <title id={`${id}-title`}>{title}</title> : null}
          {role === "img" && description ? <desc id={`${id}-desc`}>{description}</desc> : null}
          <defs>
            <EdgeMarkers id={id} />
          </defs>

          {ordered.map((node) => {
            const state = node.state ?? "normal";
            const selectable = Boolean(onSelect) && !node.container;
            const tag = nodeKindTags[node.kind];
            const nodeRole = effectiveRole(node.kind, node.role);
            const look = roleStyles[nodeRole];
            // A role given without a tag is said in words, so it is never carried by colour alone.
            const roleSaid = assignedRoleWords(node.kind, node.role);
            const stateLook = state === "normal" ? null : stateStyles[state];
            const radius = node.container ? look.containerRadius : look.radius;
            const selected = selectedId === node.id;
            const strong = state === "active" || state === "error";
            const body = (
              <>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={radius}
                  className={stateLook ? stateLook.box : node.container ? (nestedContainers.has(node.id) ? look.containerNested : look.container) : look.box}
                  strokeWidth={strong ? 2.2 : 1.5}
                  strokeDasharray={node.container ? "6 4" : undefined}
                />
                {node.container ? (
                  <>
                    {tag ? <rect x={node.x + 6} y={node.y + 5} width={tagChipWidth(tag, 9.5)} height={14} rx={3} className={stateLook?.chip ?? look.chip} /> : null}
                    <text x={node.x + 10} y={node.y + 16} className="fill-muted-foreground text-[11px] font-semibold">
                      {tag ? (
                        <>
                          <tspan className={cn("font-mono text-[9.5px] [font-variant-ligatures:none]", stateLook?.tagText ?? look.tagText)}>{tag}</tspan>
                          <tspan dx={4}>{" · "}</tspan>
                        </>
                      ) : null}
                      {node.label}
                    </text>
                  </>
                ) : (
                  <>
                    {tag ? (
                      <>
                        <rect x={node.x + 4} y={node.y + 5} width={tagChipWidth(tag)} height={12} rx={3} className={stateLook?.chip ?? look.chip} />
                        <text x={node.x + 8} y={node.y + 14} className={cn("font-mono text-[9px] font-semibold [font-variant-ligatures:none]", stateLook?.tagText ?? look.tagText)}>
                          {tag}
                        </text>
                      </>
                    ) : null}
                    <StepLabelBadge
                      label={node.label}
                      cx={node.x + node.w / 2}
                      baseline={node.y + node.h / 2 + (node.sublabel ? -2 : 4)}
                      charW={NODE_CHAR_W}
                      height={15}
                      className="fill-foreground/80"
                    />
                    <text
                      x={node.x + node.w / 2}
                      y={node.y + node.h / 2 + (node.sublabel ? -2 : 4)}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[11.5px] font-semibold [font-variant-ligatures:none]"
                    >
                      <StepLabelText label={node.label} digitsClass="fill-background" />
                    </text>
                    {node.sublabel ? (
                      <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 13} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">
                        {node.sublabel}
                      </text>
                    ) : null}
                  </>
                )}
                {node.badge ? (
                  <text x={node.x + node.w - 8} y={node.y + 14} textAnchor="end" className="fill-fig-amber-text text-[9px] font-bold">
                    {node.badge}
                  </text>
                ) : null}
                {state === "ok" || state === "error" ? <StateMark node={node} state={state} width={width} height={height} /> : null}
                {selectable || selected ? (
                  <>
                    {/* A neutral ring with a card-coloured gap inside it, so it never reads as a state colour. */}
                    <rect
                      x={node.x - 2}
                      y={node.y - 2}
                      width={node.w + 4}
                      height={node.h + 4}
                      rx={radius + 2}
                      className={cn("fig-ring fig-ring-gap pointer-events-none fill-none stroke-card", selected ? "opacity-100" : "opacity-0")}
                      strokeWidth={2}
                    />
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={node.w + 8}
                      height={node.h + 8}
                      rx={radius + 4}
                      className={cn("fig-ring pointer-events-none fill-none stroke-foreground", selected ? "opacity-100" : "opacity-0")}
                      strokeWidth={2}
                    />
                  </>
                ) : null}
              </>
            );
            if (!selectable) return <g key={node.id} data-fig-role={nodeRole}>{body}</g>;
            return (
              <g
                key={node.id}
                data-fig-role={nodeRole}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${tag ? `${tag} ` : ""}${node.label}${roleSaid ? `, ${roleSaid}` : ""}${node.sublabel ? `, ${node.sublabel}` : ""}${node.badge ? `, ${node.badge}` : ""}${state !== "normal" ? `, ${state}` : ""}`}
                onClick={() => onSelect?.(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(node.id);
                  }
                }}
                className="cursor-pointer focus:outline-none [&:focus-visible>.fig-ring]:opacity-100"
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
            const toneKey = edgeToneOf(edge.style, edge.state, edgeTouchesTestbench(edge, nodes, ports));
            const tone = edgeTones[toneKey];
            // Plain connections are drawn at 1.5 px; styles with an arrowhead keep the width the geometry measures.
            const baseWidth = style.marker ? style.width : Math.max(1.5, style.width);
            return (
              <g key={edge.id}>
                <polyline
                  points={pts.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  className={tone.stroke}
                  strokeWidth={edge.state === "active" ? baseWidth + 0.8 : baseWidth}
                  strokeDasharray={style.dash}
                  strokeLinejoin="round"
                  markerEnd={style.marker ? `url(#${id}-${style.marker}-${toneKey})` : undefined}
                />
                {labelBox ? (
                  <g>
                    <rect x={labelBox.x} y={labelBox.y} width={labelBox.w} height={labelBox.h} rx={4} className="fill-card" />
                    <rect x={labelBox.x} y={labelBox.y} width={labelBox.w} height={labelBox.h} rx={4} className={cn(tone.chip, tone.chipEdge)} strokeWidth={1} />
                    <StepLabelBadge label={edge.label ?? ""} cx={mid[0]} baseline={mid[1] + 3} charW={EDGE_CHAR_W} height={12} className={tone.text} />
                    <text x={mid[0]} y={mid[1] + 3} textAnchor="middle" className={cn("font-mono text-[10px] [font-variant-ligatures:none]", tone.text)}>
                      <StepLabelText label={edge.label ?? ""} digitsClass="fill-card font-semibold" />
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
      <DiagramLegend entries={legend} className="mt-2" />
    </figure>
  );
}
