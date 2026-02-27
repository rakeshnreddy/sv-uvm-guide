import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConstraintSolverExplorer } from '@/components/visuals/ConstraintSolverExplorer';

const getRenderedPoints = (container: HTMLElement) =>
  container.querySelectorAll('div.absolute.h-3.w-3.-ml-1\\.5.-mb-1\\.5.rounded-full');

const getInvalidRenderedPoints = (container: HTMLElement) =>
  container.querySelectorAll('div.absolute.h-3.w-3.-ml-1\\.5.-mb-1\\.5.rounded-full.bg-red-500');

describe('ConstraintSolverExplorer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders an empty state before a mode is selected', () => {
    const { container } = render(<ConstraintSolverExplorer />);

    expect(screen.getByText('Constraint Solver Space Explorer')).toBeInTheDocument();
    expect(screen.getByText('Select a constraint mode to visualize')).toBeInTheDocument();
    expect(getRenderedPoints(container)).toHaveLength(0);
  });

  it('shows full solution space in base mode, including pruned invalid points', () => {
    const { container } = render(<ConstraintSolverExplorer />);

    fireEvent.click(screen.getByRole('button', { name: 'Base Constraints' }));
    expect(container.querySelector('div.animate-spin')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const points = getRenderedPoints(container);
    const invalidPoints = getInvalidRenderedPoints(container);

    expect(points).toHaveLength(256);
    expect(invalidPoints.length).toBeGreaterThan(0);
    expect(screen.getByText(/base constraints prune illegal states/i)).toBeInTheDocument();
  });

  it('applies dist weighting and keeps only valid constrained points', () => {
    const { container } = render(<ConstraintSolverExplorer />);

    fireEvent.click(screen.getByRole('button', { name: 'dist (Weights)' }));

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const points = getRenderedPoints(container);
    const invalidPoints = getInvalidRenderedPoints(container);

    expect(points).toHaveLength(13);
    expect(invalidPoints).toHaveLength(0);
    expect(screen.getByText(/clause 18\.5\.4/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dist (Weights)' })).toHaveClass('bg-purple-500');
  });
});
