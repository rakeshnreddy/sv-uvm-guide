import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FormalVsSimulationVisualizer from '@/components/visuals/FormalVsSimulationVisualizer';

describe('FormalVsSimulationVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with both panels visible', () => {
    render(<FormalVsSimulationVisualizer />);
    expect(screen.getByText('Formal vs Simulation Explorer')).toBeInTheDocument();
    expect(screen.getByText('Simulation')).toBeInTheDocument();
    expect(screen.getByText('Formal Proof')).toBeInTheDocument();
  });

  it('displays the property list', () => {
    render(<FormalVsSimulationVisualizer />);
    expect(screen.getByText('p_full_is_correct')).toBeInTheDocument();
    expect(screen.getByText('p_no_overflow')).toBeInTheDocument();
    expect(screen.getByText('p_no_underflow')).toBeInTheDocument();
    expect(screen.getByText('p_cover_fill_drain')).toBeInTheDocument();
  });

  it('shows "All Properties Proven" when formal runs with all assumptions', () => {
    render(<FormalVsSimulationVisualizer />);
    const runFormalBtn = screen.getByRole('button', { name: /Run Proofs/i });
    fireEvent.click(runFormalBtn);
    expect(screen.getByText('All Properties Proven')).toBeInTheDocument();
  });

  it('shows counterexample when an assumption is disabled and formal runs', () => {
    render(<FormalVsSimulationVisualizer />);
    // Disable p_no_overflow assumption — the shield toggle buttons
    const toggleButtons = screen.getAllByTitle(/Disable assumption/i);
    fireEvent.click(toggleButtons[0]); // disable p_no_overflow

    const runFormalBtn = screen.getByRole('button', { name: /Run Proofs/i });
    fireEvent.click(runFormalBtn);

    expect(screen.getByText('Counterexample Found')).toBeInTheDocument();
    expect(screen.getByText(/push fires while full/i)).toBeInTheDocument();
  });

  it('shows "Replay as UVM Seed" button when counterexample is found', () => {
    render(<FormalVsSimulationVisualizer />);
    const toggleButtons = screen.getAllByTitle(/Disable assumption/i);
    fireEvent.click(toggleButtons[0]);

    const runFormalBtn = screen.getByRole('button', { name: /Run Proofs/i });
    fireEvent.click(runFormalBtn);

    expect(screen.getByRole('button', { name: /Replay as UVM Seed/i })).toBeInTheDocument();
  });

  it('resets to initial state on Reset click', () => {
    render(<FormalVsSimulationVisualizer />);

    // Run formal
    const runFormalBtn = screen.getByRole('button', { name: /Run Proofs/i });
    fireEvent.click(runFormalBtn);
    expect(screen.getByText('All Properties Proven')).toBeInTheDocument();

    // Reset
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    // "All Properties Proven" should be gone
    expect(screen.queryByText('All Properties Proven')).not.toBeInTheDocument();
    expect(screen.queryByText('Counterexample Found')).not.toBeInTheDocument();
  });

  it('starts simulation on Run UVM Test click', () => {
    render(<FormalVsSimulationVisualizer />);
    const runSimBtn = screen.getByRole('button', { name: /Run UVM Test/i });
    fireEvent.click(runSimBtn);

    // Advance timers to see cycles progress
    act(() => {
      vi.advanceTimersByTime(1600); // 4 cycles at 400ms each
    });

    // Count should show progress
    const countElements = screen.getAllByText('4');
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });
});
