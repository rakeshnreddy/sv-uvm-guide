import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VIPReuseVisualizer from '@/components/visuals/VIPReuseVisualizer';

describe('VIPReuseVisualizer', () => {
  it('renders default visualizer in active mode', () => {
    render(<VIPReuseVisualizer />);
    
    expect(screen.getByText('UVM VIP Re-use Topology')).toBeInTheDocument();
    
    // In active mode, Driver and Sequencer names should be visible
    expect(screen.getAllByText('Driver').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sequencer')).toBeInTheDocument();
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    
    // Check config DB code hint for UVM_ACTIVE
    expect(screen.getByText('UVM_ACTIVE')).toBeInTheDocument();
  });

  it('toggles to passive SoC mode correctly', () => {
    render(<VIPReuseVisualizer />);
    
    // Click SoC passive button
    const passiveBtn = screen.getByRole('button', { name: /SoC Level \(Passive\)/i });
    fireEvent.click(passiveBtn);

    // Config DB code hint should shift to UVM_PASSIVE
    expect(screen.getByText('UVM_PASSIVE')).toBeInTheDocument();

    // Look for the "Disabled" badge on the driver area
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    // Firmware processor should be visible traversing APB Bus
    expect(screen.getByText('RISC-V Core')).toBeInTheDocument();
    expect(screen.getByText('Processor')).toBeInTheDocument(); // Bus driver changes from UVM Driver to Processor
  });

  it('toggles back to active mode correctly', () => {
    render(<VIPReuseVisualizer />);
    
    // Go passive first
    const passiveBtn = screen.getByRole('button', { name: /SoC Level \(Passive\)/i });
    fireEvent.click(passiveBtn);
    
    // Toggle back to active
    const activeBtn = screen.getByRole('button', { name: /Block Level \(Active\)/i });
    fireEvent.click(activeBtn);

    expect(screen.getByText('UVM_ACTIVE')).toBeInTheDocument();
    
    // Check if "Disabled" badge is gone
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument();
  });
});
