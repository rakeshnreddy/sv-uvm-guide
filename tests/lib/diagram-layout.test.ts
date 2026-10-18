import { describe, expect, it } from 'vitest';
import {
  edgeLabelBox,
  edgeLabelWarnings,
  layoutGridDiagram,
  layoutSequence,
  lengthInside,
  MIN_RENDER_SCALE,
  readableMinWidth,
  routeEdges,
  SEQ_CHAR_W,
  SEQ_SELF_TEXT_DX,
  wrapLabel,
  type GridNode,
} from '@/components/visual-system/diagram-layout';
import type { DiagramNode } from '@/components/visual-system/BlockDiagram';

describe('layoutGridDiagram', () => {
  const agent = {
    nodes: [
      { id: 'env', label: 'env', kind: 'env' as const, col: 0, row: 0, colSpan: 3, rowSpan: 2, container: true },
      { id: 'agt', label: 'agent', kind: 'agent' as const, col: 0, row: 0, colSpan: 2, rowSpan: 2, container: true },
      { id: 'sqr', label: 'sqr', kind: 'sequencer' as const, col: 0, row: 0 },
      { id: 'drv', label: 'drv', kind: 'driver' as const, col: 0, row: 1 },
      { id: 'mon', label: 'mon', kind: 'monitor' as const, col: 1, row: 1 },
      { id: 'scb', label: 'scb', kind: 'scoreboard' as const, col: 2, row: 1 },
    ],
    ports: [
      { id: 'mon.ap', node: 'mon', side: 'right' as const, kind: 'analysis_port' as const, label: 'ap' },
      { id: 'scb.imp', node: 'scb', side: 'left' as const, kind: 'analysis_imp' as const },
    ],
    edges: [{ from: 'mon.ap', to: 'scb.imp', label: 'write(t)' }],
  };

  it('places leaf nodes on the grid and keeps every container around the cells it spans', () => {
    const l = layoutGridDiagram(agent);
    const n = Object.fromEntries(l.nodes.map((x) => [x.id, x]));
    expect(l.problems).toEqual([]);
    // Same column -> same x; next row -> larger y.
    expect(n.sqr.x).toBe(n.drv.x);
    expect(n.drv.y).toBeGreaterThan(n.sqr.y);
    // Containers enclose their children, and the outer one encloses the inner one with a larger margin.
    for (const child of [n.sqr, n.drv, n.mon]) {
      expect(child.x).toBeGreaterThan(n.agt.x);
      expect(child.y).toBeGreaterThan(n.agt.y);
      expect(child.x + child.w).toBeLessThan(n.agt.x + n.agt.w);
      expect(child.y + child.h).toBeLessThan(n.agt.y + n.agt.h);
    }
    expect(n.env.x).toBeLessThan(n.agt.x);
    expect(n.env.y).toBeLessThan(n.agt.y);
    expect(n.scb.x + n.scb.w).toBeLessThan(n.env.x + n.env.w);
    // Everything is inside the canvas with a margin.
    for (const node of l.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(16);
      expect(node.y).toBeGreaterThanOrEqual(16);
      expect(node.x + node.w).toBeLessThanOrEqual(l.width);
      expect(node.y + node.h).toBeLessThanOrEqual(l.height);
    }
  });

  it('maps ports and edges, and converts via points from grid units', () => {
    const l = layoutGridDiagram({ ...agent, edges: [{ id: 'e', from: 'sqr', to: 'scb', via: [[1, 0]] }] });
    expect(l.ports[0]).toMatchObject({ id: 'mon.ap', nodeId: 'mon', side: 'right', offset: 0.5 });
    const sqr = l.nodes.find((x) => x.id === 'sqr')!;
    const mon = l.nodes.find((x) => x.id === 'mon')!;
    // via [1,0] is the centre of column 1, row 0.
    expect(l.edges[0].points![0][0]).toBe(mon.x + mon.w / 2);
    expect(l.edges[0].points![0][1]).toBe(sqr.y + sqr.h / 2);
    expect(l.edges[0].style).toBe('data');
  });

  it('reports authoring mistakes instead of drawing silently', () => {
    const l = layoutGridDiagram({
      nodes: [
        { id: 'a', label: 'a', col: 0, row: 0 },
        { id: 'a', label: 'dup', col: 1, row: 0 },
        { id: 'b', label: 'b', col: 0, row: 0 },
      ],
      ports: [{ id: 'p', node: 'nope', side: 'left', kind: 'port' }],
      edges: [{ from: 'a', to: 'ghost' }],
    });
    expect(l.problems.join(' | ')).toMatch(/Duplicate node id "a"/);
    expect(l.problems.join(' | ')).toMatch(/overlap/);
    expect(l.problems.join(' | ')).toMatch(/unknown node "nope"/);
    expect(l.problems.join(' | ')).toMatch(/unknown node or port "ghost"/);
  });
});

describe('layoutSequence', () => {
  const participants = [
    { id: 'seq', label: 'seq', kind: 'sequence' as const },
    { id: 'sqr', label: 'sequencer', kind: 'sequencer' as const },
    { id: 'drv', label: 'driver', kind: 'driver' as const },
  ];

  it('numbers calls, async sends and returns in order; notes and dividers are not numbered', () => {
    const l = layoutSequence({
      participants,
      messages: [
        { from: 'drv', to: 'sqr', label: 'get_next_item(req)' },
        { from: 'seq', to: 'sqr', label: 'start_item(req)' },
        { kind: 'note', from: 'seq', to: 'drv', label: 'the sequencer grants the sequence' },
        { kind: 'return', from: 'sqr', to: 'drv', label: 'req' },
        { kind: 'divider', label: '@(posedge vif.clk)' },
        { kind: 'self', from: 'drv', label: 'drive the pins' },
        { kind: 'async', from: 'drv', to: 'sqr', label: 'item_done()' },
      ],
    });
    expect(l.problems).toEqual([]);
    expect(l.messages.map((m) => m.step)).toEqual([1, 2, null, 3, null, 4, 5]);
    expect(l.messages[0].text).toBe('1. driver calls sequencer: get_next_item(req)');
    expect(l.messages[3].text).toBe('3. sequencer returns to driver: req');
    expect(l.messages[2].text).toBe('Note over seq to driver: the sequencer grants the sequence');
    // Rows go down the page in order.
    const ys = l.messages.map((m) => m.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // Lifelines are evenly spaced, left to right in participant order.
    expect(l.lifelineX.sqr - l.lifelineX.seq).toBe(l.lifelineX.drv - l.lifelineX.sqr);
    expect(l.height).toBeGreaterThan(ys[ys.length - 1]);
  });

  it('reports unknown lifelines and self-addressed calls', () => {
    const l = layoutSequence({ participants, messages: [{ from: 'drv', to: 'mon', label: 'x' }, { from: 'drv', to: 'drv', label: 'y' }] });
    expect(l.problems.join(' | ')).toMatch(/unknown receiver "mon"/);
    expect(l.problems.join(' | ')).toMatch(/use kind "self"/);
  });
});

describe('wrapLabel', () => {
  it('wraps on words and folds overflow into the last line', () => {
    expect(wrapLabel('one two three four', 8)).toEqual(['one two', 'three', 'four']);
    expect(wrapLabel('a b c d e f', 1, 2)).toEqual(['a', 'b c d e f']);
  });
});

// Default grid: cells 150x60, gapX 64, gapY 76, a 16 px outer margin. Column c starts at x = 16 + 214c, row r at y = 16 + 136r.
const cell = (id: string, col: number, row: number, extra: Partial<GridNode> = {}): GridNode => ({ id, label: id, col, row, ...extra });
const codes = (l: { warnings: { code: string }[] }) => l.warnings.map((w) => w.code);

describe('layoutGridDiagram geometry warnings', () => {
  it('flags an edge label that hides its line and arrowhead, and accepts one that leaves them visible', () => {
    const nodes = [cell('a', 0, 0), cell('b', 1, 0)];
    // The a -> b line is the 64 px column gap; "try_get(t)" draws a 70 px chip over it.
    const hidden = layoutGridDiagram({ nodes, edges: [{ from: 'a', to: 'b', label: 'try_get(t)' }] });
    expect(hidden.problems).toEqual([]);
    expect(hidden.warnings).toHaveLength(1);
    expect(hidden.warnings[0]).toMatchObject({ code: 'label-hides-edge', subject: 'edge "try_get(t)" (a → b)' });
    expect(hidden.warnings[0].message).toMatch(/covers 64 px of its 64 px line, hiding the line and its arrowhead/);
    // A plain (structural) line has no arrowhead but must still show some line.
    expect(codes(layoutGridDiagram({ nodes, edges: [{ from: 'a', to: 'b', style: 'structural', label: 'implements' }] }))).toEqual(['label-hides-edge']);
    expect(layoutGridDiagram({ nodes, edges: [{ from: 'a', to: 'b', label: 'get' }] }).warnings).toEqual([]);
    // Vertical edges cross only the chip's 16 px height.
    expect(layoutGridDiagram({ nodes: [cell('a', 0, 0), cell('b', 0, 1)], edges: [{ from: 'a', to: 'b', label: 'get_next_item(req)' }] }).warnings).toEqual([]);
    // A wider gap fixes it.
    expect(layoutGridDiagram({ nodes, gapX: 110, edges: [{ from: 'a', to: 'b', label: 'try_get(t)' }] }).warnings).toEqual([]);
  });

  it('flags labels centred on the same point (crossing diagonals)', () => {
    // a -> b and c -> d cross in the middle of a 2x2 grid; both midpoints are (198, 114).
    const l = layoutGridDiagram({
      nodes: [cell('a', 0, 0), cell('b', 1, 1), cell('c', 1, 0), cell('d', 0, 1)],
      edges: [
        { from: 'a', to: 'b', label: 'HSEL_1' },
        { from: 'c', to: 'd', label: 'HRDATA_1' },
      ],
    });
    expect(codes(l)).toEqual(['label-same-point']);
    expect(l.warnings[0].subject).toBe('edge "HSEL_1" (a → b) / edge "HRDATA_1" (c → d)');
  });

  it('flags overlapping labels that are not at the same point', () => {
    // Two port-to-port lines 12 px apart: their 16 px chips overlap by 4 px.
    const l = layoutGridDiagram({
      nodes: [cell('a', 0, 0), cell('b', 1, 0)],
      ports: [
        { id: 'a.p1', node: 'a', side: 'right', at: 0.4, kind: 'port' },
        { id: 'a.p2', node: 'a', side: 'right', at: 0.6, kind: 'port' },
        { id: 'b.x1', node: 'b', side: 'left', at: 0.4, kind: 'export' },
        { id: 'b.x2', node: 'b', side: 'left', at: 0.6, kind: 'export' },
      ],
      edges: [
        { from: 'a.p1', to: 'b.x1', label: 'x1' },
        { from: 'a.p2', to: 'b.x2', label: 'x2' },
      ],
    });
    expect(codes(l)).toEqual(['label-overlap']);
    // Spaced 0.25 and 0.75 (30 px apart) they clear each other.
    const spaced = layoutGridDiagram({
      nodes: [cell('a', 0, 0), cell('b', 1, 0)],
      ports: [
        { id: 'a.p1', node: 'a', side: 'right', at: 0.25, kind: 'port' },
        { id: 'a.p2', node: 'a', side: 'right', at: 0.75, kind: 'port' },
        { id: 'b.x1', node: 'b', side: 'left', at: 0.25, kind: 'export' },
        { id: 'b.x2', node: 'b', side: 'left', at: 0.75, kind: 'export' },
      ],
      edges: [
        { from: 'a.p1', to: 'b.x1', label: 'x1' },
        { from: 'a.p2', to: 'b.x2', label: 'x2' },
      ],
    });
    expect(spaced.warnings).toEqual([]);
  });

  it('flags a label drawn on a node it does not connect', () => {
    // a -> c skips over b; the midpoint (305, 46) is inside b.
    const l = layoutGridDiagram({ nodes: [cell('a', 0, 0), cell('b', 1, 0), cell('c', 2, 0)], edges: [{ from: 'a', to: 'c', label: 'x' }] });
    expect(l.warnings).toEqual([expect.objectContaining({ code: 'label-on-node', subject: 'edge "x" (a → c) / node "b"' })]);
  });

  it('flags a label over a container name, using the "TAG · label" text box BlockDiagram draws', () => {
    const nodes: DiagramNode[] = [{ id: 'env', label: 'env', kind: 'env', x: 16, y: 16, w: 400, h: 200, container: true }];
    // "ENV · env" is 9 characters from (26, 21): about 56 px wide.
    const on = edgeLabelWarnings(nodes, [], [{ id: 'e', from: 'p', to: 'q', style: 'data', label: 'x' }], [[[20, 28], [80, 28]]]);
    expect(on).toEqual([expect.objectContaining({ code: 'label-on-node', subject: 'edge "x" (p → q) / container "env"' })]);
    const clear = edgeLabelWarnings(nodes, [], [{ id: 'e', from: 'p', to: 'q', style: 'data', label: 'x' }], [[[100, 28], [200, 28]]]);
    expect(clear).toEqual([]);
  });

  it('flags containers drawn on the same rectangle', () => {
    const l = layoutGridDiagram({
      nodes: [
        cell('test', 0, 0, { colSpan: 2, container: true, kind: 'test' }),
        cell('env', 0, 0, { colSpan: 2, container: true, kind: 'env' }),
        cell('a', 0, 0),
        cell('b', 1, 0),
      ],
    });
    expect(codes(l)).toEqual(['container-same-span']);
  });

  it('measures labels with the same chip BlockDiagram draws, and clips lines against it', () => {
    expect(edgeLabelBox('write(t)', [100, 50])).toEqual({ x: 100 - 8 * 3.1 - 4, y: 41, w: 8 * 6.2 + 8, h: 16 });
    const box = { x: 10, y: 0, w: 20, h: 10 };
    expect(lengthInside([[0, 5], [100, 5]], box)).toBeCloseTo(20);
    expect(lengthInside([[0, 50], [100, 50]], box)).toBe(0);
    expect(lengthInside([[20, -10], [20, 20]], box)).toBeCloseTo(10);
    expect(lengthInside([[0, 5], [15, 5], [15, 100]], box)).toBeCloseTo(5 + 5);
  });
});

describe('routeEdges', () => {
  const nodes = [cell('a', 0, 0), cell('b', 1, 0), cell('c', 2, 0), cell('t', 1, 1)];
  const edges = [
    { from: 'c', to: 't' },
    { from: 'a', to: 't' },
    { from: 'b', to: 't' },
  ];

  it('attaches node ends at the centre of the facing side by default', () => {
    const l = layoutGridDiagram({ nodes, edges });
    const t = l.nodes.find((n) => n.id === 't')!;
    for (const route of l.routes) expect(route[route.length - 1]).toEqual([t.x + t.w / 2, t.y]);
  });

  it('spreads ends that share a side when asked, ordered by where each edge comes from', () => {
    const l = layoutGridDiagram({ nodes, edges, spreadAnchors: true });
    const t = l.nodes.find((n) => n.id === 't')!;
    const ends = l.routes.map((r) => r[r.length - 1]);
    // c (right), a (left), b (middle) -> 3/4, 1/4 and 2/4 along t's top side.
    expect(ends).toEqual([
      [t.x + t.w * 0.75, t.y],
      [t.x + t.w * 0.25, t.y],
      [t.x + t.w * 0.5, t.y],
    ]);
    // Each source has one edge on its bottom side, so it keeps the centre.
    const a = l.nodes.find((n) => n.id === 'a')!;
    expect(l.routes[1][0]).toEqual([a.x + a.w / 2, a.y + a.h]);
    expect(routeEdges(l.nodes, l.ports, l.edges, { spreadAnchors: true })).toEqual(l.routes);
  });
});

describe('readableMinWidth (phone width)', () => {
  it('keeps diagrams up to 400 units exactly as before: min(width, 360)', () => {
    for (const w of [182, 300, 360, 380, 400]) expect(readableMinWidth(w)).toBe(Math.min(w, 360));
  });

  it('never lets a wider diagram draw below MIN_RENDER_SCALE, so it scrolls instead', () => {
    expect(MIN_RENDER_SCALE).toBe(0.9);
    expect(readableMinWidth(610)).toBe(549);
    expect(readableMinWidth(850)).toBe(765);
    // 11.5 px node labels and 10 px edge labels at the floor.
    expect(11.5 * MIN_RENDER_SCALE).toBeGreaterThanOrEqual(10);
    expect(10 * MIN_RENDER_SCALE).toBeGreaterThanOrEqual(9);
  });
});

describe('layoutSequence self-message width', () => {
  const participants = [
    { id: 'sqr', label: 'sequencer' },
    { id: 'drv', label: 'driver' },
  ];

  it('widens the canvas so self-message text on the last lifeline stays inside the viewBox', () => {
    const l = layoutSequence({ participants, messages: [{ kind: 'self', from: 'drv', label: 'drive req on the pins' }] });
    expect(l.columnsWidth).toBe(330);
    const textRight = l.lifelineX.drv + SEQ_SELF_TEXT_DX + '1. drive req on the pins'.length * SEQ_CHAR_W;
    expect(l.width).toBeGreaterThan(textRight);
    expect(l.width).toBeGreaterThan(l.columnsWidth);
    // Without the step prefix the text is shorter.
    expect(layoutSequence({ participants, numbered: false, messages: [{ kind: 'self', from: 'drv', label: 'drive req on the pins' }] }).width).toBeLessThan(l.width);
  });

  it('keeps the column width when no self message needs more room', () => {
    const l = layoutSequence({ participants, messages: [{ from: 'drv', to: 'sqr', label: 'get_next_item(req)' }, { kind: 'self', from: 'sqr', label: 'arbitrate' }] });
    expect(l.width).toBe(l.columnsWidth);
  });
});
