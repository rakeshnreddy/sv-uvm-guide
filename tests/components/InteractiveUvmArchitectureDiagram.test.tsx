import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import InteractiveUvmArchitectureDiagram from '@/components/diagrams/InteractiveUvmArchitectureDiagram';

type MockNextImageProps = React.ComponentProps<'img'> & { priority?: boolean };
type MockNextLinkProps = React.PropsWithChildren<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>;

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, priority: _priority, ...props }: MockNextImageProps) => (
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

let mockPathname = '/curriculum/T2_Intermediate/I-SV-9_Why_UVM/index';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('InteractiveUvmArchitectureDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/curriculum/T2_Intermediate/I-SV-9_Why_UVM/index';
  });

  it('syncs the node detail panel with quick summary selections', () => {
    render(<InteractiveUvmArchitectureDiagram />);

    const detail = screen.getByTestId('uvm-node-detail');
    expect(detail).toHaveTextContent('UVM Test & Component Basics');

    const summary = screen.getByTestId('uvm-quick-summary');
    const agentButton = within(summary).getByRole('button', { name: /Agents, Sequencers & Drivers/i });

    fireEvent.click(agentButton);

    expect(detail).toHaveTextContent('Agents, Sequencers & Drivers');
    expect(detail).toHaveTextContent('Agents bridge stimulus generation and DUT interaction');

    const flowList = screen.getByTestId('uvm-flow-list');
    const agentFlowButton = within(flowList).getByRole('button', { name: /Agents, Sequencers & Drivers/i });
    expect(agentFlowButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the lesson CTA aligned with the active node', () => {
    render(<InteractiveUvmArchitectureDiagram />);

    const flowList = screen.getByTestId('uvm-flow-list');
    const coverageButton = within(flowList).getByRole('button', { name: /Functional Coverage/i });
    fireEvent.click(coverageButton);

    const cta = screen.getByRole('link', { name: /Open lesson/i });
    expect(cta.getAttribute('href')).toBe('/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index#core-constructs-in-action');
  });

  it('never makes the full-page link a selectable layer (no silent fallback to the first node)', () => {
    render(<InteractiveUvmArchitectureDiagram />);
    const summary = screen.getByTestId('uvm-quick-summary');
    fireEvent.click(within(summary).getByRole('button', { name: /Functional Coverage/i }));
    expect(within(summary).queryByRole('button', { name: /See the full visualization/i })).not.toBeInTheDocument();
    const link = within(summary).getByRole('link', { name: /See the full visualization/i });
    expect(link).toHaveAttribute('href', '/practice/visualizations/uvm-architecture');
    expect(screen.getByTestId('uvm-node-detail')).toHaveTextContent('Functional Coverage');
  });

  it('hides the full-page link when already on the full-page route', () => {
    mockPathname = '/practice/visualizations/uvm-architecture';
    render(<InteractiveUvmArchitectureDiagram />);
    expect(screen.queryByTestId('uvm-full-view-link')).not.toBeInTheDocument();
  });

  it('places analysis connections in the env/agent connect_phase, not in the test', () => {
    render(<InteractiveUvmArchitectureDiagram />);
    const detail = screen.getByTestId('uvm-node-detail');
    expect(detail).toHaveTextContent(/env and agents make analysis connections in connect_phase/);
    expect(detail).not.toHaveTextContent(/Sets factory overrides and analysis connections/);
  });
});
