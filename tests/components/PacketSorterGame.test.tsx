import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PacketSorterGame from '@/components/curriculum/f2/PacketSorterGame';

describe('PacketSorterGame', () => {
  it('progresses through challenges and rewards success', async () => {
    render(<PacketSorterGame />);

    const flow = [
      { prompt: /100 packets/i, option: 'packet-option-queue' },
      { prompt: /error packets/i, option: 'packet-option-associative-array' },
      { prompt: /packet lengths/i, option: 'packet-option-dynamic-array' },
      { prompt: /register mirror/i, option: 'packet-option-packed-array' },
      { prompt: /diagnostics bursts/i, option: 'packet-option-queue' },
    ];

    for (const step of flow) {
      expect(screen.getByTestId('packet-sorter-prompt').textContent).toMatch(step.prompt);
      fireEvent.click(screen.getByTestId(step.option));
      expect((await screen.findByTestId('packet-sorter-feedback')).textContent).toMatch(/correct/i);
      fireEvent.click(screen.getByTestId('packet-next'));
    }

    const modal = await screen.findByTestId('packet-sorter-modal');
    expect(modal.textContent).toMatch(/\+150 xp/i);
    fireEvent.click(screen.getByTestId('packet-modal-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('packet-sorter-modal')).toBeNull();
    });
  });
});
