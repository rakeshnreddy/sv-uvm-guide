/**
 * Pure layout for the MDX diagram kit. Lesson authors describe diagrams as
 * data (grid cells, ordered messages); these functions turn that data into the
 * geometry the SVG primitives draw, and report problems instead of drawing
 * something silently wrong. No React.
 *
 * Two kinds of report:
 * - `problems`: data errors (unknown ids, overlapping cells). Always shown on
 *   the page as a "Diagram data error" notice.
 * - `warnings`: geometry that draws but reads badly (an edge label hiding its
 *   line, labels printing on top of each other or on a node). Shown on the page
 *   outside production builds and checked for every lesson by
 *   tests/lib/diagram-kit-content.test.ts.
 *
 * The edge geometry (anchors, polylines, label boxes) lives here so the
 * drawing (BlockDiagram) and the checks measure exactly the same thing.
 */
import type { DiagramEdge, DiagramNode, DiagramNodeKind, DiagramPort, EdgeStyle, NodeState, PortKind } from "./BlockDiagram";

// ---------------------------------------------------------------------------
// Shared edge geometry
// ---------------------------------------------------------------------------

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

export type Point = [number, number];
export type Side = "left" | "right" | "top" | "bottom";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Line conventions: stroke width, dash pattern and arrowhead per edge style. */
export const EDGE_STYLES: Record<EdgeStyle, { dash?: string; marker?: "filled" | "open"; width: number }> = {
  structural: { width: 1.2 },
  data: { marker: "filled", width: 1.8 },
  causal: { dash: "6 4", marker: "open", width: 1.5 },
  control: { dash: "2 3", marker: "open", width: 1.5 },
};

/**
 * Length of an edge's arrowhead along the line (px). The marker is 7 stroke
 * widths long (markerWidth 7, viewBox 10) and its refX of 9 puts 90% of it
 * behind the end point.
 */
export function arrowheadLength(style: EdgeStyle): number {
  const s = EDGE_STYLES[style];
  return s.marker ? 7 * s.width * 0.9 : 0;
}

/**
 * The background chip BlockDiagram draws behind an edge label: 6.2 px per
 * character (10 px monospace) plus 4 px padding on each side, 16 px tall,
 * centred on the midpoint of the edge's polyline.
 */
export function edgeLabelBox(label: string, mid: Point): Box {
  return { x: mid[0] - label.length * 3.1 - 4, y: mid[1] - 9, w: label.length * 6.2 + 8, h: 16 };
}

export function portPosition(port: Pick<DiagramPort, "side" | "offset">, node: Box): Point {
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

/** The side of `node` that faces `toward`. */
export function nodeAnchorSide(node: Box, toward: Point): Side {
  const dx = toward[0] - (node.x + node.w / 2);
  const dy = toward[1] - (node.y + node.h / 2);
  if (Math.abs(dx) * node.h > Math.abs(dy) * node.w) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

/** Where an edge attached to a node (not a port) meets it: the centre of the side facing `toward`. */
export function nodeAnchor(node: Box, toward: Point): Point {
  return portPosition({ side: nodeAnchorSide(node, toward), offset: 0.5 }, node);
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

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

/** Length of the part of a polyline that lies inside a box (Liang-Barsky clipping per segment). */
export function lengthInside(points: Point[], box: Box): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const p = [-dx, dx, -dy, dy];
    const q = [x0 - box.x, box.x + box.w - x0, y0 - box.y, box.y + box.h - y0];
    let t0 = 0;
    let t1 = 1;
    let inside = true;
    for (let k = 0; k < 4 && inside; k += 1) {
      if (p[k] === 0) {
        if (q[k] < 0) inside = false;
      } else {
        const r = q[k] / p[k];
        if (p[k] < 0) {
          if (r > t1) inside = false;
          else t0 = Math.max(t0, r);
        } else if (r < t0) inside = false;
        else t1 = Math.min(t1, r);
      }
    }
    if (inside && t1 > t0) total += (t1 - t0) * Math.hypot(dx, dy);
  }
  return total;
}

export interface RouteOptions {
  /**
   * Spread the ends of edges that meet the same side of a node (without a port)
   * evenly along that side, ordered by where each edge goes, instead of
   * attaching them all at the side's centre.
   */
  spreadAnchors?: boolean;
}

/**
 * The polyline BlockDiagram draws for each edge, in `edges` order. A port end
 * starts on its port; a node end starts at the centre of the side facing the
 * edge's first (or last) bend point, or the other end's centre.
 */
export function routeEdges(nodes: DiagramNode[], ports: DiagramPort[], edges: DiagramEdge[], options: RouteOptions = {}): Point[][] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const portById = new Map(ports.map((p) => [p.id, p]));
  const centerOf = (ref: string): Point => {
    const port = portById.get(ref);
    if (port) {
      const node = nodeById.get(port.nodeId);
      return node ? portPosition(port, node) : [0, 0];
    }
    const node = nodeById.get(ref);
    return node ? [node.x + node.w / 2, node.y + node.h / 2] : [0, 0];
  };
  // Node-anchored ends, recorded so they can be spread along their side.
  const anchored: { edge: number; end: 0 | 1; node: DiagramNode; side: Side; toward: Point }[] = [];
  const resolve = (ref: string, toward: Point, edge: number, end: 0 | 1): Point => {
    const port = portById.get(ref);
    if (port) {
      const node = nodeById.get(port.nodeId);
      return node ? portPosition(port, node) : toward;
    }
    const node = nodeById.get(ref);
    if (!node) return toward;
    const side = nodeAnchorSide(node, toward);
    anchored.push({ edge, end, node, side, toward });
    return portPosition({ side, offset: 0.5 }, node);
  };

  const routes = edges.map((edge, i): Point[] => {
    const via = edge.points ?? [];
    const start = resolve(edge.from, via[0] ?? centerOf(edge.to), i, 0);
    const end = resolve(edge.to, via[via.length - 1] ?? centerOf(edge.from), i, 1);
    return [start, ...via, end];
  });

  if (options.spreadAnchors) {
    const groups = new Map<string, typeof anchored>();
    for (const a of anchored) {
      const key = `${a.node.id}\u0000${a.side}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const along = (a: (typeof anchored)[number]) => (a.side === "top" || a.side === "bottom" ? a.toward[0] : a.toward[1]);
      group.sort((a, b) => along(a) - along(b) || a.edge - b.edge);
      group.forEach((a, k) => {
        const p = portPosition({ side: a.side, offset: (k + 1) / (group.length + 1) }, a.node);
        const route = routes[a.edge];
        route[a.end === 0 ? 0 : route.length - 1] = p;
      });
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Phone width
// ---------------------------------------------------------------------------

/** Diagrams up to this width shrink to fit a phone, exactly as they always have. */
export const PHONE_FIT_WIDTH = 360;
/**
 * Wider diagrams never draw below this scale; they scroll sideways inside their
 * own frame instead. At 0.9, 11.5 px node labels stay at 10.4 px and 10 px edge
 * labels at 9 px.
 */
export const MIN_RENDER_SCALE = 0.9;

/**
 * Minimum rendered width (px) of a diagram whose viewBox is `width` units wide.
 * Up to PHONE_FIT_WIDTH / MIN_RENDER_SCALE (400) units this is the old
 * min(width, 360); beyond it the diagram keeps MIN_RENDER_SCALE and scrolls.
 */
export function readableMinWidth(width: number): number {
  return Math.max(Math.min(width, PHONE_FIT_WIDTH), Math.ceil(width * MIN_RENDER_SCALE));
}

// ---------------------------------------------------------------------------
// Geometry warnings
// ---------------------------------------------------------------------------

export type DiagramWarningCode = "label-hides-edge" | "label-same-point" | "label-overlap" | "label-on-node" | "container-same-span";

export interface DiagramWarning {
  code: DiagramWarningCode;
  /** Stable name of what is wrong (edges and nodes by id and label, no pixel values). */
  subject: string;
  message: string;
}

/** Overlaps smaller than this (px, in both directions) are rounding, not a collision. */
const OVERLAP_EPSILON = 0.5;
/** A line with no arrowhead must keep at least this much visible beside its label (px). */
const MIN_VISIBLE_LINE = 6;
/** Label midpoints closer than this (px) count as the same point. */
const SAME_POINT = 2;

function overlaps(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > OVERLAP_EPSILON && h > OVERLAP_EPSILON;
}

const px = (n: number) => Math.round(n);

/**
 * Checks edge labels against the drawn geometry: a label that hides its own
 * line (and arrowhead), labels centred on the same point, labels that overlap,
 * and labels drawn over a node or a container's name.
 */
export function edgeLabelWarnings(nodes: DiagramNode[], ports: DiagramPort[], edges: DiagramEdge[], routes: Point[][]): DiagramWarning[] {
  const warnings: DiagramWarning[] = [];
  const portNode = new Map(ports.map((p) => [p.id, p.nodeId]));
  const name = (e: DiagramEdge) => `edge "${e.label}" (${e.from} → ${e.to})`;
  const labelled = edges
    .map((edge, i) => ({ edge, route: routes[i] }))
    .filter((x): x is { edge: DiagramEdge & { label: string }; route: Point[] } => Boolean(x.edge.label) && Boolean(x.route))
    .map(({ edge, route }) => {
      const mid = pointAlong(route, 0.5);
      return { edge, route, mid, box: edgeLabelBox(edge.label, mid), hidesLine: false };
    });

  for (const l of labelled) {
    const length = polylineLength(l.route);
    const covered = lengthInside(l.route, l.box);
    const arrow = arrowheadLength(l.edge.style);
    if (length - covered < Math.max(arrow, MIN_VISIBLE_LINE)) {
      l.hidesLine = true;
      warnings.push({
        code: "label-hides-edge",
        subject: name(l.edge),
        message: `Edge label "${l.edge.label}" (${l.edge.from} → ${l.edge.to}) covers ${px(covered)} px of its ${px(length)} px line, hiding the line${arrow ? " and its arrowhead" : ""}. Shorten the label, widen the gap (gapX, gapY, cellWidth), or name it in the caption.`,
      });
    }
  }

  for (let i = 0; i < labelled.length; i += 1) {
    for (let j = i + 1; j < labelled.length; j += 1) {
      const a = labelled[i];
      const b = labelled[j];
      if (Math.hypot(a.mid[0] - b.mid[0], a.mid[1] - b.mid[1]) < SAME_POINT) {
        warnings.push({
          code: "label-same-point",
          subject: `${name(a.edge)} / ${name(b.edge)}`,
          message: `Edge labels "${a.edge.label}" (${a.edge.from} → ${a.edge.to}) and "${b.edge.label}" (${b.edge.from} → ${b.edge.to}) are centred on the same point, so they print on top of each other. Move an edge end, add a via point, or set spreadAnchors.`,
        });
      } else if (overlaps(a.box, b.box)) {
        warnings.push({
          code: "label-overlap",
          subject: `${name(a.edge)} / ${name(b.edge)}`,
          message: `Edge labels "${a.edge.label}" (${a.edge.from} → ${a.edge.to}) and "${b.edge.label}" (${b.edge.from} → ${b.edge.to}) overlap.`,
        });
      }
    }
  }

  for (const l of labelled) {
    // A label that already hides its own line necessarily sits on its own end nodes; say it once.
    const ownEnds = new Set(l.hidesLine ? [l.edge.from, l.edge.to].map((ref) => portNode.get(ref) ?? ref) : []);
    for (const n of nodes) {
      if (n.container) {
        // BlockDiagram writes "TAG · label" at (x + 10, y + 16) in 11 px type.
        const tag = nodeKindTags[n.kind];
        const title = { x: n.x + 10, y: n.y + 5, w: ((tag ? tag.length + 3 : 0) + n.label.length) * 6.2, h: 15 };
        if (overlaps(l.box, title)) {
          warnings.push({ code: "label-on-node", subject: `${name(l.edge)} / container "${n.id}"`, message: `Edge label "${l.edge.label}" (${l.edge.from} → ${l.edge.to}) covers the name of container "${n.id}".` });
        }
      } else if (!ownEnds.has(n.id) && overlaps(l.box, n)) {
        warnings.push({ code: "label-on-node", subject: `${name(l.edge)} / node "${n.id}"`, message: `Edge label "${l.edge.label}" (${l.edge.from} → ${l.edge.to}) overlaps node "${n.id}".` });
      }
    }
  }
  return warnings;
}

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
  /** See RouteOptions.spreadAnchors (default false). */
  spreadAnchors?: boolean;
}

export interface GridLayout {
  width: number;
  height: number;
  nodes: DiagramNode[];
  ports: DiagramPort[];
  edges: DiagramEdge[];
  /** The polyline drawn for each edge, in `edges` order. */
  routes: Point[][];
  /** Data errors: always shown on the page. */
  problems: string[];
  /** Geometry that draws but reads badly: shown outside production, checked per lesson in tests. */
  warnings: DiagramWarning[];
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
  const warnings: DiagramWarning[] = [];
  // Containers with identical spans are drawn on the same rectangle, so their names overprint.
  for (let i = 0; i < containers.length; i += 1) {
    for (let j = i + 1; j < containers.length; j += 1) {
      const a = spanOf(containers[i]);
      const b = spanOf(containers[j]);
      if (a.c0 === b.c0 && a.r0 === b.r0 && a.c1 === b.c1 && a.r1 === b.r1) {
        warnings.push({
          code: "container-same-span",
          subject: `containers "${containers[i].id}" / "${containers[j].id}"`,
          message: `Containers "${containers[i].id}" and "${containers[j].id}" span the same cells, so they are drawn on one rectangle and their names print on top of each other. Drop one (a badge or sublabel can carry it) or make the outer one larger.`,
        });
      }
    }
  }
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

  const routes = routeEdges(nodes, ports, edges, { spreadAnchors: spec.spreadAnchors });
  warnings.push(...edgeLabelWarnings(nodes, ports, edges, routes));

  return { width, height, nodes, ports, edges, routes, problems, warnings };
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
  /** Whether the drawing prefixes steps with "N. " (default true); used to measure self-message text. */
  numbered?: boolean;
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
  /** Width the lifeline columns need; `width` is larger only when self-message text needs room on the right. */
  columnsWidth: number;
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
/** Self-message text starts this far right of its lifeline (after the loop). */
export const SEQ_SELF_TEXT_DX = 42;
/** Width of one character of message text (10.5 px monospace, 0.6 em). */
export const SEQ_CHAR_W = 6.3;

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
  // Rightmost self-message text, so the canvas can grow to hold it (the last lifeline has only SEQ_PAD_X + half a box to its right).
  let selfTextRight = 0;
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
      const prefix = spec.numbered === false ? 0 : `${step}. `.length;
      const chars = Math.max(...lines.map((line, k) => line.length + (k === 0 ? prefix : 0)));
      selfTextRight = Math.max(selfTextRight, x1 + SEQ_SELF_TEXT_DX + chars * SEQ_CHAR_W);
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

  const columnsWidth = SEQ_PAD_X * 2 + SEQ_BOX_W + Math.max(0, spec.participants.length - 1) * colW;
  const width = Math.max(columnsWidth, Math.ceil(selfTextRight + 8));
  return { width, columnsWidth, height: y + 16, headerHeight: SEQ_HEADER_H, lifelineX, participants: spec.participants, messages, problems };
}
