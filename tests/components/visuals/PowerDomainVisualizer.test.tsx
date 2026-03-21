import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PowerDomainVisualizer from '../../../src/components/curriculum/interactives/visuals/PowerDomainVisualizer';

describe('PowerDomainVisualizer', () => {
  it('renders the initial state correctly', () => {
    render(<PowerDomainVisualizer />);
    
    expect(screen.getByText('Interactive Power Domain Sequence')).toBeInTheDocument();
    expect(screen.getByText(/PD_TOP \(Always ON\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PD_CPU \(Switchable\)/i)).toBeInTheDocument();
    
    // Initial state is FULL_ON, so action should lead to SAVE_CONTEXT
    expect(screen.getByText(/Save Context/i)).toBeInTheDocument();
  });

  it('cycles through all power states', () => {
    render(<PowerDomainVisualizer />);
    
    const actionButton = screen.getByRole('button');
    
    // 1. FULL_ON -> SAVE_CONTEXT
    fireEvent.click(actionButton);
    expect(screen.getByText(/Assert Isolation/i)).toBeInTheDocument();
    
    // 2. SAVE_CONTEXT -> ISOLATED
    fireEvent.click(actionButton);
    expect(screen.getByText(/Drop Power/i)).toBeInTheDocument();
    
    // 3. ISOLATED -> POWER_OFF
    fireEvent.click(actionButton);
    expect(screen.getByText(/Wake Up & Restore/i)).toBeInTheDocument();
    
    // 4. POWER_OFF -> RESTORE_CONTEXT
    fireEvent.click(actionButton);
    expect(screen.getByText(/Resume Traffic/i)).toBeInTheDocument();
    
    // 5. RESTORE_CONTEXT -> FULL_ON
    fireEvent.click(actionButton);
    expect(screen.getByText(/Save Context/i)).toBeInTheDocument();
  });
});
