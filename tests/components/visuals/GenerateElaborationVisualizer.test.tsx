import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerateElaborationVisualizer from '@/components/visuals/GenerateElaborationVisualizer';

describe('GenerateElaborationVisualizer', () => {
  it('renders default state in generate mode', () => {
    render(<GenerateElaborationVisualizer />);

    expect(screen.getByText('Generate vs Runtime')).toBeInTheDocument();
    expect(screen.getByText('Elaborated Hardware (Compile Time)')).toBeInTheDocument();
  });

  it('switches to runtime mode on click', () => {
    render(<GenerateElaborationVisualizer />);

    const runtimeBtn = screen.getByRole('button', { name: /Runtime Loop/i });
    fireEvent.click(runtimeBtn);

    expect(screen.getByText('Runtime Execution (Simulation Time)')).toBeInTheDocument();
  });

  it('switches back to generate mode', () => {
    render(<GenerateElaborationVisualizer />);

    // Switch to runtime first
    const runtimeBtn = screen.getByRole('button', { name: /Runtime Loop/i });
    fireEvent.click(runtimeBtn);

    // Switch back
    const generateBtn = screen.getByRole('button', { name: /Generate \(Elaboration\)/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText('Elaborated Hardware (Compile Time)')).toBeInTheDocument();
  });

  it('increases channel count and shows new instance', () => {
    render(<GenerateElaborationVisualizer />);

    // Default is NUM_CH = 2, should show gen_chk[0] and gen_chk[1]
    expect(screen.getByText('gen_chk[0].chk_inst')).toBeInTheDocument();
    expect(screen.getByText('gen_chk[1].chk_inst')).toBeInTheDocument();
    expect(screen.queryByText('gen_chk[2].chk_inst')).not.toBeInTheDocument();

    const increaseBtn = screen.getByRole('button', { name: /Increase channels/i });
    fireEvent.click(increaseBtn);

    // Should now show 3 instances
    expect(screen.getByText('gen_chk[2].chk_inst')).toBeInTheDocument();
  });

  it('decreases channel count and removes instance', () => {
    render(<GenerateElaborationVisualizer />);

    const decreaseBtn = screen.getByRole('button', { name: /Decrease channels/i });
    fireEvent.click(decreaseBtn);

    // Now at 1 — gen_chk[1] should be gone
    expect(screen.getByText('gen_chk[0].chk_inst')).toBeInTheDocument();
    expect(screen.queryByText('gen_chk[1].chk_inst')).not.toBeInTheDocument();
  });

  it('disables decrease button at minimum', () => {
    render(<GenerateElaborationVisualizer />);

    const decreaseBtn = screen.getByRole('button', { name: /Decrease channels/i });
    fireEvent.click(decreaseBtn); // now at 1

    expect(decreaseBtn).toBeDisabled();
  });

  it('disables increase button at maximum', () => {
    render(<GenerateElaborationVisualizer />);

    const increaseBtn = screen.getByRole('button', { name: /Increase channels/i });
    fireEvent.click(increaseBtn); // 3
    fireEvent.click(increaseBtn); // 4

    expect(increaseBtn).toBeDisabled();
  });
});
