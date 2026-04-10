import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UvmSequenceHierarchyVisualizer from '@/components/visualizers/UvmSequenceHierarchyVisualizer';

describe('UvmSequenceHierarchyVisualizer', () => {
  it('renders without crashing and shows the header', () => {
    render(<UvmSequenceHierarchyVisualizer />);
    expect(screen.getByText('UVM Sequence Hierarchy Explorer')).toBeInTheDocument();
  });

  it('renders all nodes in the basic hierarchy tree', () => {
    render(<UvmSequenceHierarchyVisualizer />);
    expect(screen.getByText('top_sequence')).toBeInTheDocument();
    expect(screen.getByText('write_burst_sequence')).toBeInTheDocument();
    expect(screen.getByText('read_check_sequence')).toBeInTheDocument();
    // There should be two base_rw_sequence nodes
    expect(screen.getAllByText('base_rw_sequence').length).toBe(2);
  });

  it('step forward advances the execution log', async () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Initially no log entries
    expect(screen.queryAllByTestId('log-entry')).toHaveLength(0);

    // Click step
    fireEvent.click(screen.getByTestId('step-forward'));
    await waitFor(() => {
      expect(screen.getAllByTestId('log-entry').length).toBe(1);
    });

    // Step again
    fireEvent.click(screen.getByTestId('step-forward'));
    await waitFor(() => {
      expect(screen.getAllByTestId('log-entry').length).toBe(2);
    });
  });

  it('reset clears execution state', async () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Advance a few steps
    fireEvent.click(screen.getByTestId('step-forward'));
    fireEvent.click(screen.getByTestId('step-forward'));
    await waitFor(() => {
      expect(screen.getAllByTestId('log-entry').length).toBe(2);
    });

    // Reset
    fireEvent.click(screen.getByTestId('reset-btn'));
    await waitFor(() => {
      expect(screen.queryAllByTestId('log-entry')).toHaveLength(0);
    });
  });

  it('collapse and expand works on parent nodes', async () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Initially all nodes are visible
    expect(screen.getByText('write_burst_sequence')).toBeInTheDocument();

    // Click on top_sequence node to collapse it
    fireEvent.click(screen.getByTestId('seq-node-top'));

    // Children should animate out
    await waitFor(() => {
      expect(screen.queryByText('write_burst_sequence')).not.toBeInTheDocument();
    });

    // Click again to expand
    fireEvent.click(screen.getByTestId('seq-node-top'));
    await waitFor(() => {
      expect(screen.getByText('write_burst_sequence')).toBeInTheDocument();
    });
  });

  it('switches to virtual sequencer preset', () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Initially basic preset
    expect(screen.getByText('top_sequence')).toBeInTheDocument();

    // Switch to virtual
    fireEvent.click(screen.getByTestId('preset-virtual'));

    expect(screen.getByText('virtual_sequence')).toBeInTheDocument();
    expect(screen.getByText('axi_write_seq')).toBeInTheDocument();
    expect(screen.getByText('apb_config_seq')).toBeInTheDocument();
  });

  it('node status updates correctly during execution', async () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Initially all idle
    const topStatus = screen.getByTestId('status-top');
    expect(topStatus).toHaveTextContent('idle');

    // Step forward once — top should start
    fireEvent.click(screen.getByTestId('step-forward'));
    await waitFor(() => {
      expect(screen.getByTestId('status-top')).toHaveTextContent('running');
    });
  });

  it('displays the correct step counter', async () => {
    render(<UvmSequenceHierarchyVisualizer />);

    // Initially shows dash
    expect(screen.getByText(/Step:/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-forward'));
    await waitFor(() => {
      expect(screen.getByText(/Step: 1/)).toBeInTheDocument();
    });
  });
});
