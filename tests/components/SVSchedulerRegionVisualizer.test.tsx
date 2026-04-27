import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SVSchedulerRegionVisualizer } from '@/components/visualizers/SVSchedulerRegionVisualizer';

describe('SVSchedulerRegionVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders without crashing and displays the default scenario', () => {
    render(<SVSchedulerRegionVisualizer />);
    expect(screen.getByTestId('scheduler-visualizer')).toBeInTheDocument();
    
    // Default scenario is Normal Flip-Flop
    expect(screen.getByText(/Sample inputs before clock edge/i)).toBeInTheDocument();
  });

  it('navigates forward using next button', () => {
    render(<SVSchedulerRegionVisualizer />);
    
    const nextBtn = screen.getByTestId('btn-next');
    
    // Initial step is 0 (Pre-Active)
    expect(screen.getByText('Cycle Step: 0/6')).toBeInTheDocument();
    expect(screen.getByText('Preponed Phase')).toBeInTheDocument();
    
    // Click Next -> step 1 (Active)
    fireEvent.click(nextBtn);
    expect(screen.getByText('Cycle Step: 1/6')).toBeInTheDocument();
    expect(screen.getByText('Active Phase')).toBeInTheDocument();
  });

  it('resets to step 0 when reset is clicked', () => {
    render(<SVSchedulerRegionVisualizer />);
    
    const nextBtn = screen.getByTestId('btn-next');
    const resetBtn = screen.getByTestId('btn-reset');
    
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    
    expect(screen.getByText('Cycle Step: 2/6')).toBeInTheDocument();
    
    // Click Reset
    fireEvent.click(resetBtn);
    expect(screen.getByText('Cycle Step: 0/6')).toBeInTheDocument();
  });

  it('changes scenario when race condition mode is selected', () => {
    render(<SVSchedulerRegionVisualizer />);
    
    const raceBtn = screen.getByTestId('mode-race');
    
    fireEvent.click(raceBtn);
    
    // "Process A" text should appear
    expect(screen.getByText(/Initial state before clock edge/i)).toBeInTheDocument();
    
    const nextBtn = screen.getByTestId('btn-next');
    fireEvent.click(nextBtn);
    
    // Step 1 of Race Condition
    expect(screen.getByText(/Process A executes/i)).toBeInTheDocument();
  });
  
  it('auto-plays when play button is clicked', () => {
    render(<SVSchedulerRegionVisualizer />);
    
    const playBtn = screen.getByTestId('btn-play');
    
    fireEvent.click(playBtn);
    
    // Advance timers by 1200ms
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    
    expect(screen.getByText('Cycle Step: 1/6')).toBeInTheDocument();
  });
});
