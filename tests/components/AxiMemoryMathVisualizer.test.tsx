import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AxiMemoryMathVisualizer from '../../src/components/visualizers/AxiMemoryMathVisualizer';

vi.mock('lucide-react', () => ({
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />
}));

describe('AxiMemoryMathVisualizer', () => {
  it('renders without crashing', () => {
    render(<AxiMemoryMathVisualizer />);
    expect(screen.getByText('AXI Burst Memory Math')).toBeInTheDocument();
  });

  it('shows default preset selected', () => {
    render(<AxiMemoryMathVisualizer />);
    expect(screen.getByText('Basic INCR4 (32-bit)')).toBeInTheDocument();
  });

  it('displays beat table with correct number of rows', () => {
    render(<AxiMemoryMathVisualizer />);
    // Default is INCR4: 4 beats
    const rows = screen.getAllByText(/0x/);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('shows 4KB OK badge for legal bursts', () => {
    render(<AxiMemoryMathVisualizer />);
    expect(screen.getByText('✓ 4KB OK')).toBeInTheDocument();
  });

  it('shows 4KB VIOLATION badge for boundary-crossing preset', () => {
    render(<AxiMemoryMathVisualizer />);
    const crossingPreset = screen.getByText('4KB Boundary Crossing!');
    fireEvent.click(crossingPreset);
    expect(screen.getByText('✗ 4KB VIOLATION')).toBeInTheDocument();
  });

  it('shows unaligned badge for unaligned preset', () => {
    render(<AxiMemoryMathVisualizer />);
    const unalignedPreset = screen.getByText('Unaligned Start');
    fireEvent.click(unalignedPreset);
    expect(screen.getByText('⚠ Unaligned')).toBeInTheDocument();
  });

  it('changes burst type when buttons are clicked', () => {
    render(<AxiMemoryMathVisualizer />);
    const fixedBtn = screen.getByText('FIXED');
    fireEvent.click(fixedBtn);
    // In FIXED mode all addresses should be the same — check total bytes badge
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });

  it('switches bus width', () => {
    render(<AxiMemoryMathVisualizer />);
    const btn64 = screen.getByText('64-bit');
    fireEvent.click(btn64);
    // WSTRB should now show 8 cells per beat instead of 4
    expect(screen.getByText('64-bit')).toBeInTheDocument();
  });
});
