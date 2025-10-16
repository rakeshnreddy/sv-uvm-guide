import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SystemVerilog3DVisualizer from '@/components/curriculum/f2/SystemVerilog3DVisualizer';

describe('SystemVerilog3DVisualizer', () => {
  it('renders the default dynamic array scene with capacity context', async () => {
    render(<SystemVerilog3DVisualizer />);

    fireEvent.click(screen.getByTestId('sv-3d-select-dynamic-array'));

    expect(await screen.findByTestId('sv-3d-summary')).toHaveTextContent(/dynamic array expands/i);
    expect(screen.getByTestId('sv-3d-context').textContent).toMatch(/capacity lives further down/i);
    expect(await screen.findByTestId('sv-3d-node-arr-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('sv-3d-suggested').textContent).toMatch(/memory hub/i);
  });

  it('switches to queue view and updates summary and active nodes', async () => {
    render(<SystemVerilog3DVisualizer />);

    fireEvent.click(screen.getByTestId('sv-3d-select-queue'));

    expect(await screen.findByTestId('sv-3d-summary')).toHaveTextContent(/head and tail/i);
    expect(await screen.findByTestId('sv-3d-node-queue-front')).toBeInTheDocument();
    expect(screen.getByTestId('sv-3d-context').textContent).toMatch(/front of queue/i);
  });

  it('highlights packed vs unpacked layering when switching to packed matrix', async () => {
    render(<SystemVerilog3DVisualizer />);

    fireEvent.click(screen.getByTestId('sv-3d-select-packed-matrix'));

    expect(await screen.findByTestId('sv-3d-summary')).toHaveTextContent(/packed vectors unfold/i);
    expect(await screen.findByTestId('sv-3d-node-matrix-ch0-bit7')).toBeInTheDocument();
  });
});
