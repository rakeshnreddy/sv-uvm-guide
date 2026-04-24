import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AxiIdOrderingVisualizer from '../../src/components/visualizers/AxiIdOrderingVisualizer';

vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="icon-play" />,
  Pause: () => <div data-testid="icon-pause" />,
  SkipBack: () => <div data-testid="icon-skip-back" />,
  SkipForward: () => <div data-testid="icon-skip-forward" />,
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />
}));

describe('AxiIdOrderingVisualizer', () => {
  it('renders without crashing', () => {
    render(<AxiIdOrderingVisualizer />);
    expect(screen.getByText('AXI ID Ordering Visualizer')).toBeInTheDocument();
  });

  it('shows default scenario selected', () => {
    render(<AxiIdOrderingVisualizer />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('same_id_order');
  });

  it('displays outstanding transactions', () => {
    render(<AxiIdOrderingVisualizer />);
    expect(screen.getByText('Read A')).toBeInTheDocument();
    expect(screen.getByText('Read B')).toBeInTheDocument();
  });

  it('steps forward to show events', () => {
    render(<AxiIdOrderingVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    fireEvent.click(stepForward);
    expect(screen.getByText(/Issue Read A/)).toBeInTheDocument();
  });

  it('changes scenario when dropdown is used', () => {
    render(<AxiIdOrderingVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'diff_id_reorder' } });
    expect(screen.getByText(/different IDs/)).toBeInTheDocument();
  });

  it('shows reordering in different-ID scenario', () => {
    render(<AxiIdOrderingVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'diff_id_reorder' } });

    const stepForward = screen.getByTitle('Step Forward');
    // Step through all events
    for (let i = 0; i < 4; i++) fireEvent.click(stepForward);
    expect(screen.getByText(/reordered/)).toBeInTheDocument();
  });

  it('resets to cycle 0', () => {
    render(<AxiIdOrderingVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    const resetBtn = screen.getByTitle('Reset');
    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Press Play/)).toBeInTheDocument();
  });

  it('shows interconnect ID prepend scenario', () => {
    render(<AxiIdOrderingVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'id_prepend' } });
    expect(screen.getByText('M0: Read')).toBeInTheDocument();
    expect(screen.getByText('M1: Read')).toBeInTheDocument();
  });
});
