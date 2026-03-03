import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MailboxSemaphoreGame from '@/components/visuals/MailboxSemaphoreGame';

describe('MailboxSemaphoreGame', () => {
  it('supports both semaphore and mailbox flows', () => {
    render(<MailboxSemaphoreGame />);

    const visualizer = screen.getByTestId('mailbox-semaphore-game');
    expect(visualizer).toHaveTextContent('Semaphore (Shared Resource)');

    fireEvent.click(screen.getAllByRole('button', { name: 'Get Key' })[0]);
    expect(visualizer).toHaveTextContent('Process A got key');

    fireEvent.click(screen.getByRole('button', { name: 'Mailbox' }));
    expect(visualizer).toHaveTextContent('Mailbox (Data Flow)');

    fireEvent.click(screen.getByRole('button', { name: 'Put()' }));
    expect(visualizer.textContent).toMatch(/Producer put data:/);

    fireEvent.click(screen.getByRole('button', { name: 'Get()' }));
    expect(visualizer.textContent).toMatch(/Consumer got data:/);
  });
});
