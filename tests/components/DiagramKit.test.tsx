import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ArchitectureDiagram, SequenceDiagram, TimingDiagram } from '@/components/mdx/DiagramKit';
import { BlockDiagram, legendEntries, legendItems } from '@/components/visual-system/BlockDiagram';
import { StepWaveform } from '@/components/visual-system/StepWaveform';
import { layoutGridDiagram, readableMinWidth } from '@/components/visual-system/diagram-layout';
import { mdxComponents } from '@/generated/mdx-component-registry';

describe('MDX diagram kit', () => {
  it('is registered for lessons', () => {
    expect(mdxComponents).toHaveProperty('ArchitectureDiagram');
    expect(mdxComponents).toHaveProperty('TimingDiagram');
    expect(mdxComponents).toHaveProperty('SequenceDiagram');
  });

  it('ArchitectureDiagram draws a labelled figure with role tags, a legend and a caption', () => {
    render(
      <ArchitectureDiagram
        title="Agent and scoreboard"
        caption="The monitor broadcasts every observed transaction."
        nodes={[
          { id: 'mon', label: 'mon', kind: 'monitor', col: 0, row: 0 },
          { id: 'scb', label: 'scb', kind: 'scoreboard', col: 1, row: 0 },
        ]}
        ports={[{ id: 'ap', node: 'mon', side: 'right', kind: 'analysis_port', label: 'ap' }]}
        edges={[{ from: 'ap', to: 'scb', label: 'write(t)' }]}
      />,
    );
    // A static picture: role="img", named by <title>, described by a generated <desc>.
    const fig = screen.getByRole('img', { name: 'Agent and scoreboard' });
    expect(fig).toHaveAccessibleDescription('Components: MON mon, SCB scb. Connections: mon ap to scb (write(t)).');
    expect(within(fig).getByText('MON')).toBeInTheDocument();
    expect(within(fig).getByText('write(t)')).toBeInTheDocument();
    // The legend lists only what the diagram draws: testbench components, an analysis port and a data line,
    // each with its colour and shape drawn beside the term.
    expect(within(screen.getByTestId('diagram-legend')).getAllByText(/./).map((n) => n.textContent)).toEqual(['testbench', 'analysis port', 'data flow']);
    expect(screen.getByTestId('diagram-legend').querySelectorAll('[aria-hidden]')).toHaveLength(3);
    expect(screen.getByText('The monitor broadcasts every observed transaction.')).toBeInTheDocument();
    expect(screen.queryByTestId('diagram-data-error')).not.toBeInTheDocument();
    // "write(t)" (58 px) over the 64 px column gap hides the arrowhead: an author-facing layout warning, not a data error.
    expect(screen.getByTestId('diagram-layout-warning')).toHaveTextContent(/Edge label "write\(t\)" \(ap → scb\) covers/);
  });

  it('ArchitectureDiagram legend: protocol diagrams show no UVM port symbols, and legend={false} hides it', () => {
    const nodes = [
      { id: 'm', label: 'master', col: 0, row: 0 },
      { id: 'dec', label: 'decoder', col: 1, row: 0 },
      { id: 's', label: 'slave', col: 1, row: 1 },
    ];
    const edges = [
      { from: 'm', to: 'dec', style: 'structural' as const },
      { from: 'dec', to: 's', style: 'control' as const, label: 'HSEL' },
    ];
    const { unmount } = render(<ArchitectureDiagram title="AHB-Lite" caption="c" nodes={nodes} edges={edges} />);
    expect(within(screen.getByTestId('diagram-legend')).getAllByText(/./).map((n) => n.textContent)).toEqual(['control', 'connection (no direction)']);
    expect(screen.queryByText('port')).not.toBeInTheDocument();
    // Nodes with no role carry no meaning, so they add no legend term.
    expect(screen.queryByText('testbench')).not.toBeInTheDocument();
    expect(screen.queryByText(/causal/)).not.toBeInTheDocument();
    unmount();
    render(<ArchitectureDiagram title="AHB-Lite" caption="c" nodes={nodes} edges={edges} legend={false} />);
    expect(screen.queryByTestId('diagram-legend')).not.toBeInTheDocument();
    expect(legendItems([{ kind: 'port' }, { kind: 'analysis_imp' }], [{ style: 'causal' }])).toEqual(['port', 'imp', 'causal / call order']);
    expect(legendItems([], [], [{ kind: 'dut' }, { kind: 'driver' }, { kind: 'interface' }, { kind: 'reg' }, { kind: 'generic' }])).toEqual([
      'design (DUT)',
      'testbench',
      'interface',
      'register model',
    ]);
  });

  it('ArchitectureDiagram draws exactly the edge routes the geometry checks measure', () => {
    const spec = {
      nodes: [
        { id: 'a', label: 'a', col: 0, row: 0 },
        { id: 'b', label: 'b', col: 1, row: 0 },
        { id: 'c', label: 'c', col: 2, row: 0 },
        { id: 't', label: 't', col: 1, row: 1 },
      ],
      edges: [
        { from: 'a', to: 't' },
        { from: 'b', to: 't', via: [[1, 0.5]] as [number, number][] },
        { from: 'c', to: 't', label: 'x' },
      ],
    };
    for (const spreadAnchors of [false, true]) {
      const { container, unmount } = render(<ArchitectureDiagram title="Routes" caption="c" {...spec} spreadAnchors={spreadAnchors} />);
      const drawn = [...container.querySelectorAll('polyline')].map((p) => p.getAttribute('points'));
      const measured = layoutGridDiagram({ ...spec, spreadAnchors }).routes.map((r) => r.map((p) => p.join(',')).join(' '));
      expect(drawn).toEqual(measured);
      unmount();
    }
  });

  it('ArchitectureDiagram keeps narrow diagrams as before and lets wide ones scroll at a readable scale', () => {
    const narrow = [{ id: 'a', label: 'a', col: 0, row: 0 }];
    const { container, unmount } = render(<ArchitectureDiagram title="Narrow" caption="c" nodes={narrow} />);
    // 16 + 150 + 16 = 182 units: min(width, 360) as always, and no scroll region.
    expect(container.querySelector('svg')).toHaveStyle({ minWidth: '182px' });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    unmount();

    const wide = [0, 1, 2, 3].map((col) => ({ id: `n${col}`, label: `n${col}`, col, row: 0 }));
    const layout = layoutGridDiagram({ nodes: wide });
    expect(layout.width).toBe(824);
    render(<ArchitectureDiagram title="Wide" caption="c" nodes={wide} />);
    const region = screen.getByRole('region', { name: 'Scrollable diagram: Wide' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.querySelector('svg')).toHaveStyle({ minWidth: `${readableMinWidth(824)}px` });
    expect(readableMinWidth(824)).toBe(742);
  });

  describe('scroll frame measurement', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('becomes a focusable region only while its content actually overflows', () => {
      class FakeResizeObserver {
        observe() {}
        disconnect() {}
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
      const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(360);
      const { unmount } = render(<ArchitectureDiagram title="Narrow but overflowing" caption="c" nodes={[{ id: 'a', label: 'a', col: 0, row: 0 }]} />);
      expect(screen.getByRole('region', { name: 'Scrollable diagram: Narrow but overflowing' })).toHaveAttribute('tabindex', '0');
      unmount();
      // A wide diagram on a wide screen does not overflow: no extra tab stop.
      scrollWidth.mockReturnValue(300);
      render(<ArchitectureDiagram title="Wide on desktop" caption="c" nodes={[0, 1, 2, 3].map((col) => ({ id: `n${col}`, label: 'n', col, row: 0 }))} />);
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });
  });

  it('ArchitectureDiagram shows data errors on the page', () => {
    render(<ArchitectureDiagram title="Broken" caption="c" nodes={[{ id: 'a', label: 'a', col: 0, row: 0 }]} edges={[{ from: 'a', to: 'missing' }]} />);
    expect(screen.getByTestId('diagram-data-error')).toHaveTextContent(/unknown node or port "missing"/);
  });

  it('SequenceDiagram has an accessible name, numbered steps and a text version', () => {
    render(
      <SequenceDiagram
        title="Sequencer-driver handshake"
        caption="The driver pulls; the sequence waits for the grant."
        participants={[
          { id: 'sqr', label: 'sequencer', kind: 'sequencer' },
          { id: 'drv', label: 'driver', kind: 'driver' },
        ]}
        messages={[
          { from: 'drv', to: 'sqr', label: 'get_next_item(req)' },
          { kind: 'return', from: 'sqr', to: 'drv', label: 'req' },
          { kind: 'async', from: 'drv', to: 'sqr', label: 'item_done()' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Sequencer-driver handshake' })).toBeInTheDocument();
    expect(screen.getByText('1. driver calls sequencer: get_next_item(req)')).toBeInTheDocument();
    expect(screen.getByText('2. sequencer returns to driver: req')).toBeInTheDocument();
    expect(screen.getByText('3. driver sends (no wait) to sequencer: item_done()')).toBeInTheDocument();
    expect(screen.getByText('The driver pulls; the sequence waits for the grant.')).toBeInTheDocument();
  });

  it('SequenceDiagram widens for self-message text on the last lifeline without shrinking the lifelines on a phone', () => {
    const participants = [
      { id: 'sqr', label: 'sequencer' },
      { id: 'drv', label: 'driver' },
    ];
    const { container } = render(
      <SequenceDiagram title="Drive" caption="c" participants={participants} messages={[{ kind: 'self', from: 'drv', label: 'drive req on the pins' }]} />,
    );
    const svg = container.querySelector('svg')!;
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    expect(width).toBeGreaterThan(330);
    // Same scale as the 330-unit, 320-px floor it had before; the extra width scrolls.
    expect(svg).toHaveStyle({ minWidth: `${Math.round((320 * width) / 330)}px` });
  });

  it('TimingDiagram renders signals and flags values that do not fit the edge count', () => {
    render(
      <TimingDiagram
        title="Valid/ready"
        caption="A transfer happens at an edge where VALID and READY are both 1."
        edges={4}
        signals={[
          { name: 'clk', kind: 'clock' },
          { name: 'valid', kind: 'bit', values: [0, 1, 1, 0] },
          { name: 'ready', kind: 'bit', values: [0, 0, 1, 0, 1] },
        ]}
        markers={[{ edge: 2, tone: 'pass', label: 'transfer at edge 2' }]}
      />,
    );
    expect(screen.getAllByText('valid').length).toBeGreaterThan(0);
    expect(screen.getByTestId('diagram-data-error')).toHaveTextContent(/"ready" has 5 values but the diagram has 4 edges/);
  });
});

describe('figure colours and marks (DESIGN.md section 13)', () => {
  const box = { x: 10, y: 10, w: 120, h: 40 };

  it('draws a numbered step on a filled badge without changing the label text', () => {
    const { container } = render(
      <BlockDiagram
        title="Loop"
        width={300}
        height={120}
        nodes={[
          { id: 'a', label: '1. drive', kind: 'generic', ...box },
          { id: 'b', label: 'plain', kind: 'generic', ...box, x: 160 },
        ]}
        edges={[{ id: 'e', from: 'a', to: 'b', style: 'data', label: '12. go' }]}
      />,
    );
    const badges = [...container.querySelectorAll('[data-step-badge]')].map((b) => b.getAttribute('data-step-badge'));
    expect(badges).toEqual(['1', '12']);
    // The text is exactly the label, so its measured width is unchanged.
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual(expect.arrayContaining(['1. drive', 'plain', '12. go']));
    // Badge centred on the digits of the middle-anchored 11.5 px mono label (0.6 em per character).
    const badge = container.querySelector('[data-step-badge="1"]')!;
    const start = 70 - (8 * 6.9) / 2;
    expect(Number(badge.getAttribute('x')) + Number(badge.getAttribute('width')) / 2).toBeCloseTo(start + 6.9 / 2);
  });

  it('draws control amber only where it touches a testbench node', () => {
    const nodes = [
      { id: 'dec', label: 'decoder', kind: 'generic' as const, ...box },
      { id: 's', label: 'slave', kind: 'generic' as const, ...box, x: 160 },
      { id: 'drv', label: 'drv', kind: 'driver' as const, ...box, y: 70 },
    ];
    const ports = [{ id: 'drv.p', nodeId: 'drv', side: 'right' as const, offset: 0.5, kind: 'port' as const }];
    const edges = [
      { id: 'sel', from: 'dec', to: 's', style: 'control' as const },
      { id: 'pull', from: 'drv.p', to: 's', style: 'control' as const },
    ];
    const { container } = render(<BlockDiagram title="C" width={300} height={130} nodes={nodes} ports={ports} edges={edges} showLegend />);
    const lines = [...container.querySelectorAll('polyline')];
    expect(lines[0].getAttribute('class')).toContain('stroke-foreground/75');
    expect(lines[0].getAttribute('marker-end')).toMatch(/-open-controlPlain\)$/);
    expect(lines[1].getAttribute('class')).toContain('stroke-fig-amber');
    // The legend shows both colours the control line takes in this figure.
    expect(legendEntries(ports, edges, nodes).find((e) => e.type === 'edge')).toMatchObject({ style: 'control', tones: ['controlPlain', 'control'] });
    expect(container.querySelectorAll('[data-legend-tone]')).toHaveLength(2);
    expect(legendEntries([], [{ style: 'control' }])).toEqual([{ type: 'edge', style: 'control', text: 'control', tones: ['control'] }]);
  });

  it('marks ok and error with a check and a cross, rings a selection in the neutral, and leaves nested containers unfilled', () => {
    const { container } = render(
      <BlockDiagram
        title="S"
        width={400}
        height={200}
        selectedId="ok"
        onSelect={() => {}}
        nodes={[
          { id: 'env', label: 'env', kind: 'env', x: 5, y: 5, w: 390, h: 190, container: true },
          { id: 'agt', label: 'agt', kind: 'agent', x: 15, y: 30, w: 200, h: 150, container: true },
          { id: 'ok', label: 'read', kind: 'generic', x: 30, y: 60, w: 100, h: 40, state: 'ok' },
          { id: 'bad', label: 'trap', kind: 'generic', x: 250, y: 60, w: 100, h: 40, state: 'error' },
        ]}
      />,
    );
    expect([...container.querySelectorAll('[data-state-mark]')].map((m) => m.getAttribute('data-state-mark'))).toEqual(['ok', 'error']);
    const rings = [...container.querySelectorAll('rect.fig-ring')];
    expect(rings.some((r) => r.getAttribute('class')!.includes('stroke-foreground') && r.getAttribute('class')!.includes('opacity-100'))).toBe(true);
    expect(rings.every((r) => !r.getAttribute('class')!.includes('stroke-ring'))).toBe(true);
    const containerBoxes = [...container.querySelectorAll('rect[stroke-dasharray="6 4"]')].map((r) => r.getAttribute('class'));
    expect(containerBoxes[0]).toContain('fill-fig-amber/[0.04]');
    expect(containerBoxes[1]).toContain('fill-none');
  });

  it('StepWaveform: unique hatch ids, a quiet clock, and no cyan fill stacked under the cursor', () => {
    const snaps = [
      { clk: 0, d: 1 },
      { clk: 1, d: 'X' },
      { clk: 0, d: 1 },
    ];
    const { container } = render(
      <>
        <StepWaveform signals={['clk', 'd']} bitSignals={['clk', 'd']} snapshots={snaps} currentIndex={0} axisLabel="a" />
        <StepWaveform signals={['clk', 'd']} bitSignals={['clk', 'd']} snapshots={snaps} currentIndex={2} axisLabel="b" />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    const first = container.querySelectorAll('svg')[0];
    // clk is never cyan; d is high at steps 1 and 3, but step 1 sits under the cursor.
    expect(first.querySelectorAll('line.stroke-muted-foreground\\/80').length).toBeGreaterThan(0);
    expect(first.querySelectorAll('rect.fill-fig-cyan-fill:not([class*="stroke"])')).toHaveLength(1);
  });
});

describe('diagram frames are quiet liquid glass (DESIGN.md section 12)', () => {
  const nodes = [
    { id: 'm', label: 'master', col: 0, row: 0 },
    { id: 's', label: 'slave', col: 1, row: 0 },
  ];
  it.each([
    ['ArchitectureDiagram', () => <ArchitectureDiagram title="A" caption="c" nodes={nodes} edges={[{ from: 'm', to: 's' }]} />],
    ['TimingDiagram', () => <TimingDiagram title="T" caption="c" edges={2} signals={[{ name: 'clk', kind: 'clock' }]} />],
    [
      'SequenceDiagram',
      () => (
        <SequenceDiagram
          title="S"
          caption="c"
          participants={[{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }]}
          messages={[{ from: 'a', to: 'b', label: 'go' }]}
        />
      ),
    ],
  ])('%s', (_name, draw) => {
    const { container } = render(draw());
    const frame = container.querySelector('.glass-liquid');
    expect(frame).not.toBeNull();
    expect(frame).toContainElement(container.querySelector('svg'));
    expect(container.innerHTML).not.toContain('bg-background/40');
  });
});
