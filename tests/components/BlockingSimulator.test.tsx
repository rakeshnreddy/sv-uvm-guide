import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BlockingSimulator from '@/components/animations/BlockingSimulator';

describe('BlockingSimulator', () => {
  it('shows blocking code by default and advances timeline', () => {
    render(<BlockingSimulator />);

    const codeBlock = screen.getByTestId('blocking-code');
    expect(codeBlock.textContent).toContain('out = shared');

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    const timelinePanel = screen.getByTestId('timeline-panel');
    expect(timelinePanel.textContent).toContain('Step 2');

    const statePanel = screen.getByTestId('state-panel');
    expect(statePanel.textContent).toContain('out');
  });

  it('switches to non-blocking mode', () => {
    render(<BlockingSimulator />);

    const nonBlockingButton = screen.getByRole('button', { name: /non-blocking mode/i });
    fireEvent.click(nonBlockingButton);

    const codeBlock = screen.getByTestId('blocking-code');
    expect(codeBlock.textContent).toContain('out <= shared');

    const timelinePanel = screen.getByTestId('timeline-panel');
    expect(timelinePanel.textContent).toContain('Both blocks sample right-hand sides');
  });
});
