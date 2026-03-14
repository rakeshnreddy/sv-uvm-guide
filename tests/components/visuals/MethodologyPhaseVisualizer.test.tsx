import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MethodologyPhaseVisualizer from '@/components/visuals/MethodologyPhaseVisualizer';

describe('MethodologyPhaseVisualizer', () => {
  it('renders with default UVM phases', () => {
    render(<MethodologyPhaseVisualizer />);
    expect(screen.getByText('UVM Phase Schedule Explorer')).toBeInTheDocument();
    // Phase names appear in both timeline cards and the insert-after dropdown
    expect(screen.getAllByText('build_phase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('reset_phase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('main_phase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('report_phase').length).toBeGreaterThanOrEqual(1);
  });

  it('inserts a custom phase when Insert Phase is clicked', () => {
    render(<MethodologyPhaseVisualizer />);

    const insertBtn = screen.getByRole('button', { name: /Insert Phase/i });
    fireEvent.click(insertBtn);

    // The default template is load_fw_phase and default insert-after is reset
    // load_fw_phase appears in both the dropdown and the inserted phase card
    const matches = screen.getAllByText('load_fw_phase');
    expect(matches.length).toBeGreaterThanOrEqual(2); // dropdown option + phase card
    // Phase count should now be 13 (12 standard + 1 custom)
    expect(screen.getByText(/13 phases.*1 custom/)).toBeInTheDocument();
  });

  it('shows a conflict warning for duplicate phase names', () => {
    render(<MethodologyPhaseVisualizer />);

    const insertBtn = screen.getByRole('button', { name: /Insert Phase/i });
    // Insert once
    fireEvent.click(insertBtn);
    // Insert same again — should show duplicate warning
    fireEvent.click(insertBtn);

    expect(screen.getByText(/already exists in the schedule/)).toBeInTheDocument();
  });

  it('resets to standard phases', () => {
    render(<MethodologyPhaseVisualizer />);

    const insertBtn = screen.getByRole('button', { name: /Insert Phase/i });
    fireEvent.click(insertBtn);
    expect(screen.getByText(/13 phases/)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);
    expect(screen.getByText(/12 phases/)).toBeInTheDocument();
  });
});
