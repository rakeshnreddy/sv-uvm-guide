import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConstraintSolverHeatmapVisualizer } from '@/components/visualizers/ConstraintSolverHeatmapVisualizer';
import { describe, it, expect } from 'vitest';

describe('ConstraintSolverHeatmapVisualizer', () => {
  it('renders without crashing', () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    expect(screen.getByText('Constraint Editor')).toBeInTheDocument();
  });

  it('initially displays 4096 valid solutions', () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    expect(screen.getByText('4096')).toBeInTheDocument();
  });

  it('updates valid solutions when a constraint is toggled', () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    
    // Toggle the first constraint: addr inside {[0:3]}
    // This reduces valid addresses to 4 instead of 16. Valid count = 4 * 256 = 1024.
    const addrConstraintBtn = screen.getByText('addr inside {[0:3]}');
    fireEvent.click(addrConstraintBtn);
    
    expect(screen.getByText('1024')).toBeInTheDocument();
  });

  it('displays contradiction message when constraints conflict', () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    
    // Toggle addr + data < 100
    fireEvent.click(screen.getByText('addr + data < 100'));
    // Toggle data > 200 -> Contradiction since addr >= 0, so if data > 200, addr+data > 200, cannot be < 100.
    fireEvent.click(screen.getByText('data > 200'));
    
    expect(screen.getByText(/Constraint contradiction/i)).toBeInTheDocument();
  });
});
