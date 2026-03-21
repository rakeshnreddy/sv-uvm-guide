import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TlmConnectionBuilderVisualizer } from '@/components/visualizers/TlmConnectionBuilderVisualizer';

describe('TlmConnectionBuilderVisualizer', () => {
  it('renders without crashing and displays the builder', () => {
    render(<TlmConnectionBuilderVisualizer />);
    expect(screen.getByTestId('tlm-builder')).toBeInTheDocument();
    expect(screen.getByText('TLM Connection Builder')).toBeInTheDocument();
  });

  it('renders all component nodes for the default scenario (Basic Agent)', () => {
    render(<TlmConnectionBuilderVisualizer />);
    expect(screen.getByTestId('node-sequencer')).toBeInTheDocument();
    expect(screen.getByTestId('node-driver')).toBeInTheDocument();
    expect(screen.getByTestId('node-monitor')).toBeInTheDocument();
    expect(screen.getByTestId('node-scoreboard')).toBeInTheDocument();
  });

  it('accepts a valid connection (port → export)', () => {
    render(<TlmConnectionBuilderVisualizer />);
    // drv_port (port) → sqr_export (export) should be valid
    fireEvent.click(screen.getByTestId('port-drv_port'));
    fireEvent.click(screen.getByTestId('port-sqr_export'));

    // A connection line should appear
    expect(screen.getByTestId('connection-drv_port-sqr_export')).toBeInTheDocument();
    // No error message
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('rejects an incompatible connection (port → analysis_port) with error', () => {
    render(<TlmConnectionBuilderVisualizer />);
    // drv_port (port) → mon_ap (analysis_port) should be invalid
    fireEvent.click(screen.getByTestId('port-drv_port'));
    fireEvent.click(screen.getByTestId('port-mon_ap'));

    // Error message should appear
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    // No connection should be created
    expect(screen.queryByTestId('connection-drv_port-mon_ap')).not.toBeInTheDocument();
  });

  it('Check Connections button highlights missing connections', () => {
    render(<TlmConnectionBuilderVisualizer />);

    // Click Check without any connections made
    fireEvent.click(screen.getByTestId('btn-check'));

    // Validation result should show fail
    const result = screen.getByTestId('validation-result');
    expect(result).toBeInTheDocument();
    expect(result).toHaveTextContent(/Missing connections/);
  });

  it('Check Connections shows pass when all connections are correct', () => {
    render(<TlmConnectionBuilderVisualizer />);

    // Make both expected connections for Basic Agent scenario
    // 1. drv_port → sqr_export
    fireEvent.click(screen.getByTestId('port-drv_port'));
    fireEvent.click(screen.getByTestId('port-sqr_export'));
    // 2. mon_ap → sb_imp
    fireEvent.click(screen.getByTestId('port-mon_ap'));
    fireEvent.click(screen.getByTestId('port-sb_imp'));

    fireEvent.click(screen.getByTestId('btn-check'));

    const result = screen.getByTestId('validation-result');
    expect(result).toHaveTextContent(/All connections are correct/);
  });

  it('Show Solution button draws all expected connections', () => {
    render(<TlmConnectionBuilderVisualizer />);

    fireEvent.click(screen.getByTestId('btn-solution'));

    // Both expected connections for Basic Agent should appear
    expect(screen.getByTestId('connection-drv_port-sqr_export')).toBeInTheDocument();
    expect(screen.getByTestId('connection-mon_ap-sb_imp')).toBeInTheDocument();

    // Validation should show pass
    expect(screen.getByTestId('validation-result')).toHaveTextContent(/All connections are correct/);
  });

  it('scenario dropdown changes the displayed components', () => {
    render(<TlmConnectionBuilderVisualizer />);

    // Switch to "Scoreboard Checker" scenario (index 1)
    const select = screen.getByTestId('scenario-select');
    fireEvent.change(select, { target: { value: '1' } });

    // Should now show FIFO node instead of sequencer/driver
    expect(screen.getByTestId('node-fifo')).toBeInTheDocument();
    expect(screen.queryByTestId('node-sequencer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-driver')).not.toBeInTheDocument();

    // Description should update
    expect(screen.getByTestId('scenario-description')).toHaveTextContent(/FIFO/);
  });

  it('Reset button clears all connections and state', () => {
    render(<TlmConnectionBuilderVisualizer />);

    // Make a connection
    fireEvent.click(screen.getByTestId('port-drv_port'));
    fireEvent.click(screen.getByTestId('port-sqr_export'));
    expect(screen.getByTestId('connection-drv_port-sqr_export')).toBeInTheDocument();

    // Reset
    fireEvent.click(screen.getByTestId('btn-reset'));

    // Connection should be gone
    expect(screen.queryByTestId('connection-drv_port-sqr_export')).not.toBeInTheDocument();
  });
});
