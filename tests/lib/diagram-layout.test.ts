import { describe, expect, it } from 'vitest';
import { layoutGridDiagram, layoutSequence, wrapLabel } from '@/components/visual-system/diagram-layout';

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
