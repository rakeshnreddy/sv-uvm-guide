import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AhbPipelineBurstVisualizer from '../../src/components/visualizers/AhbPipelineBurstVisualizer';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="icon-play" />,
  Pause: () => <div data-testid="icon-pause" />,
  SkipBack: () => <div data-testid="icon-skip-back" />,
  SkipForward: () => <div data-testid="icon-skip-forward" />,
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />
}));

describe('AhbPipelineBurstVisualizer', () => {
  it('renders without crashing and shows default scenario', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    // Check title
    expect(screen.getByText('AHB Timing Visualizer')).toBeInTheDocument();
    
    // Check default scenario is "pipeline"
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('pipeline');
    expect(screen.getByText('Two back-to-back transfers showing Address/Data phase overlap.')).toBeInTheDocument();
  });

  it('changes scenario when dropdown is used', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wait_state' } });
    
    expect(select).toHaveValue('wait_state');
    expect(screen.getByText('The slave inserts a wait state (HREADY=0), stalling the pipeline.')).toBeInTheDocument();
  });

  it('steps forward through clock cycles', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    // Initial state: Cycle 0
    expect(screen.getByText('Cycle 0 Status')).toBeInTheDocument();
    expect(screen.getByText('IDLE')).toBeInTheDocument(); // Address bus IDLE
    
    const stepForwardBtn = screen.getByTitle('Step Forward');
    
    // Step to Cycle 1
    fireEvent.click(stepForwardBtn);
    expect(screen.getByText('Cycle 1 Status')).toBeInTheDocument();
    
    // Address phase for transfer A should be active in Cycle 1
    expect(screen.getByText(/Broadcasting/)).toBeInTheDocument();
    expect(screen.getAllByText('0x1000').length).toBeGreaterThan(0); // Transfer A's address
  });

  it('steps backward through clock cycles', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    const stepForwardBtn = screen.getByTitle('Step Forward');
    const stepBackwardBtn = screen.getByTitle('Step Backward');
    
    fireEvent.click(stepForwardBtn); // To Cycle 1
    expect(screen.getByText('Cycle 1 Status')).toBeInTheDocument();
    
    fireEvent.click(stepBackwardBtn); // Back to Cycle 0
    expect(screen.getByText('Cycle 0 Status')).toBeInTheDocument();
  });

  it('resets to cycle 0 when reset button is clicked', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    const stepForwardBtn = screen.getByTitle('Step Forward');
    const resetBtn = screen.getByTitle('Reset');
    
    fireEvent.click(stepForwardBtn);
    fireEvent.click(stepForwardBtn);
    expect(screen.getByText('Cycle 2 Status')).toBeInTheDocument();
    
    fireEvent.click(resetBtn);
    expect(screen.getByText('Cycle 0 Status')).toBeInTheDocument();
  });

  it('wait state scenario correctly models HREADY=0', () => {
    render(<AhbPipelineBurstVisualizer />);
    
    // Switch to wait state scenario
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wait_state' } });
    
    const stepForwardBtn = screen.getByTitle('Step Forward');
    
    // Cycle 0: IDLE
    fireEvent.click(stepForwardBtn); // Cycle 1: Addr A
    fireEvent.click(stepForwardBtn); // Cycle 2: Data A (Wait state)
    
    expect(screen.getByText('Cycle 2 Status')).toBeInTheDocument();
    // HREADY=0 message
    expect(screen.getByText('Slave needs more time (HREADY=0).')).toBeInTheDocument();
    // Addr B should be held
    expect(screen.getAllByText('0x2000').length).toBeGreaterThan(0);
    
    fireEvent.click(stepForwardBtn); // Cycle 3: Data A (Finishes)
    expect(screen.getByText('Cycle 3 Status')).toBeInTheDocument();
    // HREADY=1 message
    expect(screen.getByText('Data sampled (HREADY=1).')).toBeInTheDocument();
    // Addr B should STILL be held because previous cycle had wait state
    expect(screen.getAllByText('0x2000').length).toBeGreaterThan(0);
  });
});
