import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExclusiveAccessVisualizer from '../../src/components/visualizers/ExclusiveAccessVisualizer';

vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="icon-play" />,
  Pause: () => <div data-testid="icon-pause" />,
  SkipBack: () => <div data-testid="icon-skip-back" />,
  SkipForward: () => <div data-testid="icon-skip-forward" />,
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />
}));

describe('ExclusiveAccessVisualizer', () => {
  it('renders without crashing', () => {
    render(<ExclusiveAccessVisualizer />);
    expect(screen.getByText('AXI Exclusive Access Monitor')).toBeInTheDocument();
  });

  it('shows default scenario selected', () => {
    render(<ExclusiveAccessVisualizer />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('success');
  });

  it('displays the monitor state', () => {
    render(<ExclusiveAccessVisualizer />);
    expect(screen.getByText('Global Exclusive Monitor')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('steps forward to show events and updates monitor', () => {
    render(<ExclusiveAccessVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    fireEvent.click(stepForward);
    expect(screen.getByText(/ARLOCK=1/)).toBeInTheDocument();
    expect(screen.getByText('RESERVED')).toBeInTheDocument();
    expect(screen.getByText('0x1000')).toBeInTheDocument();
  });

  it('changes scenario when dropdown is used', () => {
    render(<ExclusiveAccessVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'failed_normal_write' } });
    expect(screen.getByText(/Failed by Normal Write/)).toBeInTheDocument();
  });

  it('shows write failing in failed scenario', () => {
    render(<ExclusiveAccessVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'failed_normal_write' } });

    const stepForward = screen.getByTitle('Step Forward');
    // Step through to failure
    for (let i = 0; i < 7; i++) fireEvent.click(stepForward);
    expect(screen.getByText(/Write Response B returns OKAY/)).toBeInTheDocument();
  });

  it('resets to cycle 0', () => {
    render(<ExclusiveAccessVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    const resetBtn = screen.getByTitle('Reset');
    fireEvent.click(stepForward);
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Press Play/)).toBeInTheDocument();
  });
});
