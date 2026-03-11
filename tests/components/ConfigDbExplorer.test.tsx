import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfigDbExplorer from '@/components/curriculum/interactives/ConfigDbExplorer';

describe('ConfigDbExplorer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the component and defaults to targeting env drivers', () => {
    render(<ConfigDbExplorer />);
    
    // Initially, targets 'env.agent*.driver', with context 'uvm_test_top'.
    // Resulting glob: uvm_test_top.env.agent*.driver
    // This matches uvm_test_top.env.agent0.driver and uvm_test_top.env.agent1.driver
    expect(screen.getByText('2 components matched')).toBeInTheDocument();
  });

  it('updates path matching when the context changes', () => {
    render(<ConfigDbExplorer />);
    
    // Change context from uvm_test_top to uvm_test_top.env
    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: 'uvm_test_top.env' } });
    
    // Resulting glob: uvm_test_top.env.env.agent*.driver (because target is still env.agent*.driver)
    expect(screen.getByText('0 components matched')).toBeInTheDocument();
  });

  it('updates path matching when the target string changes', () => {
    render(<ConfigDbExplorer />);
    
    // Find the text input for inst_name
    const inputElem = screen.getByPlaceholderText('e.g. *, env.agent0, etc.');
    
    // Target everything
    fireEvent.change(inputElem, { target: { value: '*' } });
    
    // glob: uvm_test_top.* should match everything under uvm_test_top (8 descendants)
    expect(screen.getByText('8 components matched')).toBeInTheDocument();
  });
  
  it('triggers the set execution animation state', () => {
    render(<ConfigDbExplorer />);
    
    const setBtn = screen.getByText('Execute set()');
    
    act(() => {
      fireEvent.click(setBtn);
    });
    
    // Since default targets driver, there should be 2 'config received' badges
    const badges = screen.getAllByText('config received');
    expect(badges).toHaveLength(2);
    
    // Fast-forward timers to wait for animation state reset
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    
    expect(screen.queryByText('config received')).not.toBeInTheDocument();
  });
});
