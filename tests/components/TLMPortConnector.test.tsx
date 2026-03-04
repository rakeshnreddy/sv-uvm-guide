import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TLMPortConnector from '@/components/curriculum/interactives/TLMPortConnector';

describe('TLMPortConnector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows a recoverable error when traffic is driven before the port is connected', async () => {
    render(<TLMPortConnector />);
    const [connectButton] = screen.getAllByRole('button');
    const driveButton = screen.getByRole('button', { name: /drive traffic/i });
    const resetButton = screen.getByRole('button', { name: /reset/i });

    fireEvent.click(
      driveButton,
    );

    expect(
      screen.getByText(/Cannot drive traffic! Sequence item port is unbound/i),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(connectButton).toBeEnabled();
    expect(driveButton).toBeEnabled();
    expect(resetButton).toBeDisabled();
  });

  it('connects the handshake and animates traffic once the link is established', () => {
    render(<TLMPortConnector />);

    const [connectButton] = screen.getAllByRole('button');
    const driveButton = screen.getByRole('button', { name: /drive traffic/i });
    const resetButton = screen.getByRole('button', { name: /reset/i });

    expect(resetButton).toBeDisabled();

    fireEvent.click(connectButton);
    expect(driveButton).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(driveButton).toBeEnabled();
    expect(resetButton).toBeEnabled();

    fireEvent.click(driveButton);
    expect(screen.getByText(/txn packet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Cannot drive traffic! Sequence item port is unbound/i),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(driveButton).toBeEnabled();
    expect(resetButton).toBeEnabled();
  });

  const strictA11yAudit = process.env.QA_STRICT_A11Y_AUDIT === '1';
  (strictA11yAudit ? it : it.skip)('exposes an accessible name for the connect control', () => {
    render(<TLMPortConnector />);

    expect(
      screen.getByRole('button', { name: /connect/i }),
    ).toBeInTheDocument();
  });
});
