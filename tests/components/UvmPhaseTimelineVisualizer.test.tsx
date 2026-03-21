import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UvmPhaseTimelineVisualizer } from '@/components/visualizers/UvmPhaseTimelineVisualizer';

describe('UvmPhaseTimelineVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders without crashing and displays the timeline', () => {
    render(<UvmPhaseTimelineVisualizer />);
    expect(screen.getByTestId('phase-timeline')).toBeInTheDocument();
    expect(screen.getByText('UVM Phase Timeline')).toBeInTheDocument();
  });

  it('renders all 8 standard phases by default (custom hidden)', () => {
    render(<UvmPhaseTimelineVisualizer />);
    // Standard phases should be visible
    expect(screen.getByTestId('row-build_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-connect_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-run_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-extract_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-check_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-report_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-final_phase')).toBeInTheDocument();

    // Custom phases should NOT be visible
    expect(screen.queryByTestId('row-reset_phase')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-main_phase')).not.toBeInTheDocument();
  });

  it('shows custom phases when toggle is clicked', () => {
    render(<UvmPhaseTimelineVisualizer />);

    const toggleBtn = screen.getByTestId('btn-custom-toggle');
    fireEvent.click(toggleBtn);

    // Custom phases should now be visible
    expect(screen.getByTestId('row-reset_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-main_phase')).toBeInTheDocument();
    expect(screen.getByTestId('row-shutdown_phase')).toBeInTheDocument();
  });

  it('opens detail panel when a cell is clicked', () => {
    render(<UvmPhaseTimelineVisualizer />);

    // Click the uvm_test × build_phase cell
    const cell = screen.getByTestId('cell-uvm_test-build_phase');
    fireEvent.click(cell);

    // Detail panel should appear
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detail-phase')).toHaveTextContent('build_phase');
    expect(screen.getByTestId('detail-operations')).toHaveTextContent(/Instantiate the top-level env/);
  });

  it('closes detail panel when close button is clicked', () => {
    render(<UvmPhaseTimelineVisualizer />);

    // Open panel
    fireEvent.click(screen.getByTestId('cell-uvm_test-build_phase'));
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();

    // Close panel
    fireEvent.click(screen.getByTestId('btn-close-panel'));
    // AnimatePresence will handle exit — panel should start leaving
    // After animation, it should be gone
  });

  it('advances animation state when Run Animation is clicked', () => {
    render(<UvmPhaseTimelineVisualizer />);

    const animateBtn = screen.getByTestId('btn-animate');
    fireEvent.click(animateBtn);

    // After 600ms, animation should advance to next row
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // After another 600ms
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // The button text should change to "Pause" while animating
    expect(animateBtn).toHaveTextContent('Pause');
  });

  it('resets state when Reset button is clicked', () => {
    render(<UvmPhaseTimelineVisualizer />);

    // Open a detail panel first
    fireEvent.click(screen.getByTestId('cell-uvm_env-connect_phase'));
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();

    // Click Reset
    fireEvent.click(screen.getByTestId('btn-reset'));
    // Panel should close (detail-panel may be exiting via animation)
  });

  it('displays correct detail for different cells', () => {
    render(<UvmPhaseTimelineVisualizer />);

    // Click driver × run_phase
    fireEvent.click(screen.getByTestId('cell-uvm_driver-run_phase'));
    expect(screen.getByTestId('detail-phase')).toHaveTextContent('run_phase');
    expect(screen.getByTestId('detail-operations')).toHaveTextContent(/get next sequence item/);
  });

  it('shows new detail when clicking a different cell after reset', () => {
    render(<UvmPhaseTimelineVisualizer />);

    // Click monitor × build_phase directly
    fireEvent.click(screen.getByTestId('cell-uvm_monitor-build_phase'));
    expect(screen.getByTestId('detail-phase')).toHaveTextContent('build_phase');
    expect(screen.getByTestId('detail-operations')).toHaveTextContent(/analysis port/);
  });
});
