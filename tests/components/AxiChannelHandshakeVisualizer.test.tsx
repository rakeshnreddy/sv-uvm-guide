import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AxiChannelHandshakeVisualizer from '../../src/components/visualizers/AxiChannelHandshakeVisualizer';

vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="icon-play" />,
  Pause: () => <div data-testid="icon-pause" />,
  SkipBack: () => <div data-testid="icon-skip-back" />,
  SkipForward: () => <div data-testid="icon-skip-forward" />,
  RotateCcw: () => <div data-testid="icon-rotate-ccw" />
}));

describe('AxiChannelHandshakeVisualizer', () => {
  it('renders without crashing and shows default scenario', () => {
    render(<AxiChannelHandshakeVisualizer />);
    expect(screen.getByText('AXI Channel Handshake Visualizer')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('basic_write');
  });

  it('renders all five channel labels', () => {
    render(<AxiChannelHandshakeVisualizer />);
    expect(screen.getByText('AW')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('changes scenario when dropdown is used', () => {
    render(<AxiChannelHandshakeVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'backpressure' } });
    expect(select).toHaveValue('backpressure');
    expect(screen.getByText(/slave stalls/)).toBeInTheDocument();
  });

  it('steps forward through cycles', () => {
    render(<AxiChannelHandshakeVisualizer />);
    expect(screen.getByText(/IDLE/)).toBeInTheDocument();

    const stepForward = screen.getByTitle('Step Forward');
    fireEvent.click(stepForward);
    expect(screen.getByText(/AW handshake/)).toBeInTheDocument();
  });

  it('steps backward through cycles', () => {
    render(<AxiChannelHandshakeVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    const stepBackward = screen.getByTitle('Step Backward');

    fireEvent.click(stepForward);
    expect(screen.getByText(/AW handshake/)).toBeInTheDocument();

    fireEvent.click(stepBackward);
    expect(screen.getByText(/IDLE/)).toBeInTheDocument();
  });

  it('resets to cycle 0', () => {
    render(<AxiChannelHandshakeVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    const resetBtn = screen.getByTitle('Reset');

    fireEvent.click(stepForward);
    fireEvent.click(stepForward);
    fireEvent.click(resetBtn);
    expect(screen.getByText(/IDLE/)).toBeInTheDocument();
  });

  it('shows WAIT indicator during backpressure', () => {
    render(<AxiChannelHandshakeVisualizer />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'backpressure' } });

    const stepForward = screen.getByTitle('Step Forward');
    fireEvent.click(stepForward); // Cycle 1: AW + AR
    fireEvent.click(stepForward); // Cycle 2: W stalled

    expect(screen.getByText('WAIT')).toBeInTheDocument();
    expect(screen.getByText('✓ XFER')).toBeInTheDocument(); // R channel transfers
  });

  it('shows transfer indicator on successful handshake', () => {
    render(<AxiChannelHandshakeVisualizer />);
    const stepForward = screen.getByTitle('Step Forward');
    fireEvent.click(stepForward); // Cycle 1: AW handshake

    expect(screen.getByText('✓ XFER')).toBeInTheDocument();
  });
});
