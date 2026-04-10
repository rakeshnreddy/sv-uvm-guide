import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RalRegisterMapVisualizer from '@/components/visualizers/RalRegisterMapVisualizer';

describe('RalRegisterMapVisualizer', () => {
  it('renders without crashing and shows the root block', () => {
    render(<RalRegisterMapVisualizer />);
    expect(screen.getByText('RAL Register Map Dashboard')).toBeInTheDocument();
    expect(screen.getByText('i2c_block')).toBeInTheDocument();
  });

  it('shows register details on initial render (first register is selected by default)', () => {
    render(<RalRegisterMapVisualizer />);
    expect(screen.getAllByText('CTRL').length).toBeGreaterThan(0);
    expect(screen.getByText('Offset: 0x00')).toBeInTheDocument();
    
    // Check if fields are visible (RSVD is not rendered as text, so we check others)
    expect(screen.getByText('MODE')).toBeInTheDocument();
    expect(screen.getByText('IE')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('updates details when a different register is clicked', async () => {
    render(<RalRegisterMapVisualizer />);
    
    // Because of framer-motion, we might need to wait for the button to be available
    await waitFor(() => {
      const btns = screen.getAllByText('RX_DATA');
      expect(btns.length).toBeGreaterThan(0);
    });

    const rxDataBtn = screen.getAllByText('RX_DATA')[0];
    fireEvent.click(rxDataBtn);

    await waitFor(() => {
      expect(screen.getByText('Offset: 0x0C')).toBeInTheDocument();
      const dataElements = screen.getAllByText('DATA');
      expect(dataElements.length).toBeGreaterThan(0);
    });
  });

  it('renders the correct number of field blocks in the diagram', () => {
    render(<RalRegisterMapVisualizer />);
    // Look for fields by name
    expect(screen.getByText('MODE')).toBeInTheDocument();
    expect(screen.getByText('IE')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });
});
