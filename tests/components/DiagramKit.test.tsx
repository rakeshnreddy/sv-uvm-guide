import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ArchitectureDiagram, SequenceDiagram, TimingDiagram } from '@/components/mdx/DiagramKit';
import { legendItems } from '@/components/visual-system/BlockDiagram';
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
    // The legend lists only what the diagram draws: an analysis port and a data line.
    expect(within(screen.getByTestId('diagram-legend')).getAllByText(/./).map((n) => n.textContent)).toEqual(['◆ analysis port', '── data flow →']);
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
    expect(within(screen.getByTestId('diagram-legend')).getAllByText(/./).map((n) => n.textContent)).toEqual(['··· control →', '── connection (no direction)']);
    expect(screen.queryByText('■ port')).not.toBeInTheDocument();
    expect(screen.queryByText(/causal/)).not.toBeInTheDocument();
    unmount();
    render(<ArchitectureDiagram title="AHB-Lite" caption="c" nodes={nodes} edges={edges} legend={false} />);
    expect(screen.queryByTestId('diagram-legend')).not.toBeInTheDocument();
    expect(legendItems([{ kind: 'port' }, { kind: 'analysis_imp' }], [{ style: 'causal' }])).toEqual(['■ port', '● imp', '- - causal / call order →']);
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
