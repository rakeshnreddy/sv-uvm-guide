/**
 * Pure layout for the MDX diagram kit. Lesson authors describe diagrams as
 * data (grid cells, ordered messages); these functions turn that data into the
 * geometry the SVG primitives draw, and report data errors instead of drawing
 * something silently wrong. No React.
 */
import type { DiagramEdge, DiagramNode, DiagramNodeKind, DiagramPort, EdgeStyle, NodeState, PortKind } from "./BlockDiagram";

// ---------------------------------------------------------------------------
// Grid block diagrams
// ---------------------------------------------------------------------------

export interface GridNode {
  id: string;
  label: string;
  sublabel?: string;
  kind?: DiagramNodeKind;
  /** Zero-based grid column and row of the top-left cell. */
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  /** Containers (env, agent, top) are drawn around the cells they span. */
  container?: boolean;
  state?: NodeState;
  badge?: string;
}

export interface GridPort {
  id: string;
  node: string;
  side: "left" | "right" | "top" | "bottom";
  /** Position along the side, 0..1 (default 0.5). */
  at?: number;
  kind: PortKind;
  label?: string;
}

export interface GridEdge {
  id?: string;
  /** Node id or port id. */
  from: string;
  to: string;
  style?: EdgeStyle;
  label?: string;
  /** Bend points in grid units (cell centres; fractions allowed, e.g. 1.5). */
  via?: [number, number][];
}

export interface GridDiagramSpec {
  nodes: GridNode[];
  ports?: GridPort[];
  edges?: GridEdge[];
  cellWidth?: number;
  cellHeight?: number;
  gapX?: number;
  gapY?: number;
}

export interface GridLayout {
  width: number;
  height: number;
  nodes: DiagramNode[];
  ports: DiagramPort[];
  edges: DiagramEdge[];
  problems: string[];
}

const CONTAINER_MARGIN = 12;
const CONTAINER_LABEL = 18;
const OUTER_MARGIN = 16;

function spanOf(n: GridNode) {
  return { c0: n.col, r0: n.row, c1: n.col + (n.colSpan ?? 1), r1: n.row + (n.rowSpan ?? 1) };
}

function strictlyInside(inner: GridNode, outer: GridNode) {
  const a = spanOf(inner);
  const b = spanOf(outer);
  const within = a.c0 >= b.c0 && a.r0 >= b.r0 && a.c1 <= b.c1 && a.r1 <= b.r1;
  const same = a.c0 === b.c0 && a.r0 === b.r0 && a.c1 === b.c1 && a.r1 === b.r1;
  return within && !same;
}

/** Nesting depth of containers strictly inside `c` (0 when it holds none). */
function innerContainerDepth(c: GridNode, containers: GridNode[], memo: Map<string, number>): number {
  const hit = memo.get(c.id);
  if (hit !== undefined) return hit;
  const inside = containers.filter((o) => o.id !== c.id && strictlyInside(o, c));
  const depth = inside.length ? 1 + Math.max(...inside.map((o) => innerContainerDepth(o, containers, memo))) : 0;
  memo.set(c.id, depth);
  return depth;
}

export function layoutGridDiagram(spec: GridDiagramSpec): GridLayout {
  const cellW = spec.cellWidth ?? 150;
  const cellH = spec.cellHeight ?? 60;
  const gapX = spec.gapX ?? 64;
  const gapY = spec.gapY ?? 76;
  const problems: string[] = [];

  const ids = new Set<string>();
  for (const n of spec.nodes) {
    if (ids.has(n.id)) problems.push(`Duplicate node id "${n.id}".`);
    ids.add(n.id);
    if (n.col < 0 || n.row < 0) problems.push(`Node "${n.id}" has a negative col or row.`);
  }

  const containers = spec.nodes.filter((n) => n.container);
  const memo = new Map<string, number>();
  const x0 = (c: number) => c * (cellW + gapX);
  const y0 = (r: number) => r * (cellH + gapY);

  // Draw containers first and in outer-to-inner order (the primitive also sorts containers first).
  const raw: DiagramNode[] = spec.nodes.map((n) => {
    const s = spanOf(n);
    let x = x0(s.c0);
    let y = y0(s.r0);
    let w = x0(s.c1) - gapX - x;
    let h = y0(s.r1) - gapY - y;
    if (n.container) {
      const m = CONTAINER_MARGIN * (1 + innerContainerDepth(n, containers, memo));
      x -= m;
      w += 2 * m;
      y -= m + CONTAINER_LABEL;
      h += 2 * m + CONTAINER_LABEL;
    }
    return {
      id: n.id,
      label: n.label,
      sublabel: n.sublabel,
      kind: n.kind ?? (n.container ? "generic" : "generic"),
      x,
      y,
      w,
      h,
      container: n.container,
      state: n.state,
      badge: n.badge,
    };
  });

  // Overlapping leaf nodes are almost always an authoring mistake.
  const leaves = spec.nodes.filter((n) => !n.container);
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const a = spanOf(leaves[i]);
      const b = spanOf(leaves[j]);
      if (a.c0 < b.c1 && b.c0 < a.c1 && a.r0 < b.r1 && b.r0 < a.r1) {
        problems.push(`Nodes "${leaves[i].id}" and "${leaves[j].id}" overlap.`);
      }
    }
  }

  // Shift everything so the drawing starts at OUTER_MARGIN.
  const minX = Math.min(...raw.map((n) => n.x));
  const minY = Math.min(...raw.map((n) => n.y));
  const dx = OUTER_MARGIN - minX;
  const dy = OUTER_MARGIN - minY;
  const nodes = raw.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const width = Math.max(...nodes.map((n) => n.x + n.w)) + OUTER_MARGIN;
  const height = Math.max(...nodes.map((n) => n.y + n.h)) + OUTER_MARGIN;

  const ports: DiagramPort[] = (spec.ports ?? []).map((p) => {
    if (!ids.has(p.node)) problems.push(`Port "${p.id}" refers to unknown node "${p.node}".`);
    if (ids.has(p.id)) problems.push(`Port id "${p.id}" clashes with a node id.`);
    return { id: p.id, nodeId: p.node, side: p.side, offset: p.at ?? 0.5, kind: p.kind, label: p.label };
  });
  const refs = new Set([...ids, ...ports.map((p) => p.id)]);

  const centre = (c: number, r: number): [number, number] => [x0(c) + cellW / 2 + dx, y0(r) + cellH / 2 + dy];
  const edges: DiagramEdge[] = (spec.edges ?? []).map((e, i) => {
    if (!refs.has(e.from)) problems.push(`Edge ${e.id ?? i + 1} starts at unknown node or port "${e.from}".`);
    if (!refs.has(e.to)) problems.push(`Edge ${e.id ?? i + 1} ends at unknown node or port "${e.to}".`);
    return {
      id: e.id ?? `edge-${i + 1}`,
      from: e.from,
      to: e.to,
      style: e.style ?? "data",
      label: e.label,
      points: e.via ? e.via.map(([c, r]) => centre(c, r)) : undefined,
    };
  });

  return { width, height, nodes, ports, edges, problems };
}

// ---------------------------------------------------------------------------
// Sequence diagrams
// ---------------------------------------------------------------------------

export interface SequenceParticipant {
  id: string;
  label: string;
  sublabel?: string;
  kind?: DiagramNodeKind;
}

export type SequenceMessageKind = "call" | "return" | "async" | "self" | "note" | "divider";

export interface SequenceMessage {
  kind?: SequenceMessageKind;
  /** Sender lifeline (calls, returns, async, self). For notes: the first lifeline covered. */
  from?: string;
  /** Receiver lifeline. For notes: the last lifeline covered (optional). */
  to?: string;
  label: string;
  tone?: "normal" | "active" | "error";
}

export interface SequenceSpec {
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  columnWidth?: number;
}

export interface PlacedMessage {
  index: number;
  /** 1-based step number for numbered kinds; null for notes and dividers. */
  step: number | null;
  kind: SequenceMessageKind;
  label: string;
  lines: string[];
  tone: "normal" | "active" | "error";
  y: number;
  x1: number;
  x2: number;
  height: number;
  /** Text equivalent used for the accessible step list. */
  text: string;
}

export interface SequenceLayout {
  width: number;
  height: number;
  headerHeight: number;
  lifelineX: Record<string, number>;
  participants: SequenceParticipant[];
  messages: PlacedMessage[];
  problems: string[];
}

const SEQ_PAD_X = 20;
const SEQ_HEADER_H = 46;
const SEQ_BOX_W = 130;

/** Splits text into at most `maxLines` lines of roughly `maxChars` characters. */
export function wrapLabel(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`;
    return kept;
  }
  return lines.length ? lines : [""];
}

export function layoutSequence(spec: SequenceSpec): SequenceLayout {
  const colW = spec.columnWidth ?? 160;
  const problems: string[] = [];
  const lifelineX: Record<string, number> = {};
  spec.participants.forEach((p, i) => {
    if (lifelineX[p.id] !== undefined) problems.push(`Duplicate participant id "${p.id}".`);
    lifelineX[p.id] = SEQ_PAD_X + SEQ_BOX_W / 2 + i * colW;
  });
  const nameOf = (id?: string) => spec.participants.find((p) => p.id === id)?.label ?? id ?? "?";
  const xOf = (id: string | undefined, i: number, role: string) => {
    if (!id || lifelineX[id] === undefined) {
      problems.push(`Message ${i + 1} has an unknown ${role} "${id ?? ""}".`);
      return SEQ_PAD_X;
    }
    return lifelineX[id];
  };

  let y = SEQ_HEADER_H + 22;
  let step = 0;
  const messages: PlacedMessage[] = spec.messages.map((m, i) => {
    const kind = m.kind ?? "call";
    const tone = m.tone ?? "normal";
    if (kind === "divider") {
      const placed: PlacedMessage = { index: i, step: null, kind, label: m.label, lines: [m.label], tone, y: y + 6, x1: 0, x2: 0, height: 30, text: `— ${m.label} —` };
      y += 30;
      return placed;
    }
    if (kind === "note") {
      const a = xOf(m.from, i, "note start");
      const b = m.to ? xOf(m.to, i, "note end") : a;
      const lo = Math.min(a, b) - SEQ_BOX_W / 2 + 6;
      const hi = Math.max(a, b) + SEQ_BOX_W / 2 - 6;
      const lines = wrapLabel(m.label, Math.max(14, Math.floor((hi - lo - 16) / 6.2)), 4);
      const height = 14 * lines.length + 12;
      const over = m.to && m.to !== m.from ? `${nameOf(m.from)} to ${nameOf(m.to)}` : nameOf(m.from);
      const placed: PlacedMessage = { index: i, step: null, kind, label: m.label, lines, tone, y, x1: lo, x2: hi, height, text: `Note over ${over}: ${m.label}` };
      y += height + 12;
      return placed;
    }
    step += 1;
    const x1 = xOf(m.from, i, "sender");
    if (kind === "self") {
      const lines = wrapLabel(m.label, 24, 3);
      const height = Math.max(34, 14 * lines.length + 16);
      const placed: PlacedMessage = { index: i, step, kind, label: m.label, lines, tone, y, x1, x2: x1, height, text: `${step}. ${nameOf(m.from)} calls itself: ${m.label}` };
      y += height + 10;
      return placed;
    }
    const x2 = xOf(m.to, i, "receiver");
    if (m.to === m.from) problems.push(`Message ${i + 1} goes from "${m.from}" to itself; use kind "self".`);
    const span = Math.max(Math.abs(x2 - x1) - 16, 60);
    const lines = wrapLabel(m.label, Math.max(10, Math.floor(span / 6.4)), 3);
    const height = 14 * lines.length + 14;
    const verb = kind === "return" ? "returns to" : kind === "async" ? "sends (no wait) to" : "calls";
    // `y` of a placed arrow is the arrow line itself; its label lines sit above it.
    const placed: PlacedMessage = { index: i, step, kind, label: m.label, lines, tone, y: y + 20 + 14 * (lines.length - 1), x1, x2, height, text: `${step}. ${nameOf(m.from)} ${verb} ${nameOf(m.to)}: ${m.label}` };
    y += height + 6;
    return placed;
  });

  const width = SEQ_PAD_X * 2 + SEQ_BOX_W + Math.max(0, spec.participants.length - 1) * colW;
  return { width, height: y + 16, headerHeight: SEQ_HEADER_H, lifelineX, participants: spec.participants, messages, problems };
}
