import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ArchitectureDiagram, SequenceDiagram, TimingDiagram } from '@/components/mdx/DiagramKit';
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
    const fig = screen.getByRole('group', { name: 'Agent and scoreboard' });
    expect(within(fig).getByText('MON')).toBeInTheDocument();
    expect(within(fig).getByText('write(t)')).toBeInTheDocument();
    expect(screen.getByText('◆ analysis port')).toBeInTheDocument();
    expect(screen.getByText('The monitor broadcasts every observed transaction.')).toBeInTheDocument();
    expect(screen.queryByTestId('diagram-data-error')).not.toBeInTheDocument();
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
