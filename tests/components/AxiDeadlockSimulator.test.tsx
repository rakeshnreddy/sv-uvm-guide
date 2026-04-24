import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AxiDeadlockSimulator from '../../src/components/visualizers/AxiDeadlockSimulator';

vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="icon-play" />,
  Pause: () => <div data-testid="icon-pause" />,
  SkipBack: () => <div data-testid="icon-skip-back" />,
  SkipForward: () => <div data-testid="icon-skip-forward" />,
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />,
  AlertTriangle: () => <div data-testid="icon-alert" />
}));

describe('AxiDeadlockSimulator', () => {
  it('renders without crashing', () => {
    render(<AxiDeadlockSimulator />);
    expect(screen.getByText('AXI Deadlock Simulator')).toBeInTheDocument();
  });

  it('shows default scenario selected', () => {
    render(<AxiDeadlockSimulator />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('channel_dependency');
  });

  it('displays the master and slave nodes', () => {
    render(<AxiDeadlockSimulator />);
    expect(screen.getByText('Master AW Channel')).toBeInTheDocument();
    expect(screen.getByText('Slave W Channel')).toBeInTheDocument();
  });

  it('steps forward to show deadlock', () => {
    render(<AxiDeadlockSimulator />);
    const stepForward = screen.getByTitle('Step Forward');
    // Step to deadlock state (cycle 3)
    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    
    expect(screen.getByText('DEADLOCK DETECTED')).toBeInTheDocument();
    expect(screen.getByText(/Circular dependency formed/)).toBeInTheDocument();
  });

  it('changes scenario when dropdown is used', () => {
    render(<AxiDeadlockSimulator />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'legal_flow' } });
    expect(screen.getByText(/Legal Channel Independence/)).toBeInTheDocument();
  });

  it('shows success in legal flow', () => {
    render(<AxiDeadlockSimulator />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'legal_flow' } });

    const stepForward = screen.getByTitle('Step Forward');
    // Step through to success
    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    expect(screen.getByText(/Success!/)).toBeInTheDocument();
    expect(screen.queryByText('DEADLOCK DETECTED')).not.toBeInTheDocument();
  });

  it('resets to cycle 0', () => {
    render(<AxiDeadlockSimulator />);
    const stepForward = screen.getByTitle('Step Forward');
    const resetBtn = screen.getByTitle('Reset');
    fireEvent.click(stepForward);
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Initial state/)).toBeInTheDocument();
  });
});
