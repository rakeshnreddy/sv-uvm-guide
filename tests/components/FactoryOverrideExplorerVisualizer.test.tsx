import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FactoryOverrideExplorerVisualizer } from '@/components/visualizers/FactoryOverrideExplorerVisualizer';

describe('FactoryOverrideExplorerVisualizer', () => {
  it('renders without crashing', () => {
    render(<FactoryOverrideExplorerVisualizer />);
    expect(screen.getByTestId('factory-explorer')).toBeInTheDocument();
    expect(screen.getByText('Factory Override Explorer')).toBeInTheDocument();
  });

  it('renders the default component tree with all 4 levels', () => {
    render(<FactoryOverrideExplorerVisualizer />);
    expect(screen.getByTestId('tree-node-test')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-env')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-agent')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-drv')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-mon')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-sqr')).toBeInTheDocument();
  });

  it('renders the factory registry with all registered types', () => {
    render(<FactoryOverrideExplorerVisualizer />);
    const registry = screen.getByTestId('factory-registry');
    expect(registry).toBeInTheDocument();
    expect(registry).toHaveTextContent('base_driver');
    expect(registry).toHaveTextContent('mock_driver');
    expect(registry).toHaveTextContent('base_txn');
  });

  it('applies a type override and updates all matching tree nodes', () => {
    render(<FactoryOverrideExplorerVisualizer />);

    // Default: base_driver → base_driver (select defaults to base_driver/mock_driver)
    // Apply type override
    fireEvent.click(screen.getByTestId('btn-apply'));

    // Driver node should now show the override badge
    expect(screen.getByTestId('badge-drv')).toBeInTheDocument();
    expect(screen.getByTestId('badge-drv')).toHaveTextContent(/TYPE OVERRIDE/);

    // Override should appear in the list
    expect(screen.getByTestId('override-list')).toBeInTheDocument();
    expect(screen.getByTestId('override-0')).toHaveTextContent('base_driver');
    expect(screen.getByTestId('override-0')).toHaveTextContent('mock_driver');
  });

  it('applies an instance override that targets only the specified path', () => {
    render(<FactoryOverrideExplorerVisualizer />);

    // Switch to instance override
    fireEvent.change(screen.getByTestId('select-kind'), { target: { value: 'instance' } });

    // Set base type to my_monitor, override to fast_monitor
    fireEvent.change(screen.getByTestId('select-base'), { target: { value: 'my_monitor' } });
    fireEvent.change(screen.getByTestId('select-override'), { target: { value: 'fast_monitor' } });
    fireEvent.change(screen.getByTestId('input-path'), { target: { value: 'uvm_test_top.env.agent.mon' } });

    fireEvent.click(screen.getByTestId('btn-apply'));

    // Monitor should have instance override badge
    expect(screen.getByTestId('badge-mon')).toBeInTheDocument();
    expect(screen.getByTestId('badge-mon')).toHaveTextContent(/INST OVERRIDE/);

    // Driver and sequencer should NOT have badges
    expect(screen.queryByTestId('badge-drv')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-sqr')).not.toBeInTheDocument();
  });

  it('simulate create() shows the factory lookup log', () => {
    render(<FactoryOverrideExplorerVisualizer />);

    // Apply a type override first
    fireEvent.click(screen.getByTestId('btn-apply'));

    // Simulate create() on the driver
    fireEvent.click(screen.getByTestId('simulate-drv'));

    // Simulation log should appear
    expect(screen.getByTestId('sim-log')).toBeInTheDocument();
    expect(screen.getByTestId('log-line-0')).toHaveTextContent(/factory.create/);
  });

  it('reset clears all overrides and simulation log', () => {
    render(<FactoryOverrideExplorerVisualizer />);

    // Apply override
    fireEvent.click(screen.getByTestId('btn-apply'));
    expect(screen.getByTestId('badge-drv')).toBeInTheDocument();

    // Reset
    fireEvent.click(screen.getByTestId('btn-reset'));

    // Badge should be gone
    expect(screen.queryByTestId('badge-drv')).not.toBeInTheDocument();
    // Override list should be gone
    expect(screen.queryByTestId('override-list')).not.toBeInTheDocument();
  });
});
