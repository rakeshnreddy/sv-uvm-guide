import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PssIntentMapVisualizer from '@/components/visualizers/PssIntentMapVisualizer';

describe('PssIntentMapVisualizer', () => {
  it('renders without crashing and shows the header', () => {
    render(<PssIntentMapVisualizer />);
    expect(screen.getByText(/PSS Intent Map/)).toBeInTheDocument();
  });

  it('renders all 3 graph nodes', () => {
    render(<PssIntentMapVisualizer />);
    expect(screen.getByTestId('graph-node-write_mem')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-read_mem')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-verify')).toBeInTheDocument();
  });

  it('defaults to UVM target and shows UVM generated code', () => {
    render(<PssIntentMapVisualizer />);
    const codePanel = screen.getByTestId('generated-code');
    expect(codePanel.textContent).toContain('uvm_sequence');
    expect(codePanel.textContent).toContain('mem_test_seq');
  });

  it('switches to C bare-metal target and updates generated code', async () => {
    render(<PssIntentMapVisualizer />);

    fireEvent.click(screen.getByTestId('target-c_bare_metal'));
    await waitFor(() => {
      const codePanel = screen.getByTestId('generated-code');
      expect(codePanel.textContent).toContain('void pss_mem_test');
      expect(codePanel.textContent).toContain('write_mem(addr, data)');
    });
  });

  it('switches to emulation target and updates generated code', async () => {
    render(<PssIntentMapVisualizer />);

    fireEvent.click(screen.getByTestId('target-emulation'));
    await waitFor(() => {
      const codePanel = screen.getByTestId('generated-code');
      expect(codePanel.textContent).toContain('emu_write_txn');
      expect(codePanel.textContent).toContain('Transaction-Based Acceleration');
    });
  });

  it('all 3 compile target buttons are rendered', () => {
    render(<PssIntentMapVisualizer />);
    expect(screen.getByTestId('target-uvm')).toBeInTheDocument();
    expect(screen.getByTestId('target-c_bare_metal')).toBeInTheDocument();
    expect(screen.getByTestId('target-emulation')).toBeInTheDocument();
  });

  it('displays the key concept footer', () => {
    render(<PssIntentMapVisualizer />);
    expect(screen.getByText(/Key concept:/)).toBeInTheDocument();
  });
});
