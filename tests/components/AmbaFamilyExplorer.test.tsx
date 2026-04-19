import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmbaFamilyExplorer } from '@/components/visualizers/AmbaFamilyExplorer';

describe('AmbaFamilyExplorer', () => {
  it('renders correctly with default tab (AHB-Lite)', () => {
    render(<AmbaFamilyExplorer />);
    
    // AHB-Lite is default
    expect(screen.getByText('Simplified AHB for single masters')).toBeInTheDocument();
    expect(screen.getByText('Single Master')).toBeInTheDocument();
    expect(screen.getByText('Cortex-M microcontrollers, simple peripheral buses.')).toBeInTheDocument();
  });

  it('switches to AXI4 tab when clicked', async () => {
    render(<AmbaFamilyExplorer />);
    
    const axi4Tab = screen.getByRole('button', { name: 'AXI4' });
    fireEvent.click(axi4Tab);
    
    expect(await screen.findByText('Advanced eXtensible Interface')).toBeInTheDocument();
    expect(await screen.findByText('High-bandwidth memory controllers, multi-core SoCs, GPU/NPU interfaces.')).toBeInTheDocument();
    expect(await screen.findByText(/5 Independent Channels/)).toBeInTheDocument();
  });

  it('switches to AXI4-Stream tab when clicked', async () => {
    render(<AmbaFamilyExplorer />);
    
    const streamTab = screen.getByRole('button', { name: 'AXI4-Stream' });
    fireEvent.click(streamTab);
    
    expect(await screen.findByText('High-speed unidirectional data streaming')).toBeInTheDocument();
    expect(await screen.findByText('Source')).toBeInTheDocument();
    expect(await screen.findByText('Destination')).toBeInTheDocument();
    expect(await screen.findByText('Unidirectional Data Flow. No Addresses.')).toBeInTheDocument();
  });
});
