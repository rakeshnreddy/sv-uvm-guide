import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CodeReviewAssistant from '../../src/components/ui/CodeReviewAssistant';

describe('CodeReviewAssistant component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve('') }) as any,
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('shows commit id after typing', async () => {
    render(<CodeReviewAssistant />);
    const input = screen.getByPlaceholderText(/commit id/i);
    await userEvent.type(input, 'abc123');
    const message = await screen.findByText(/reviewing commit/i);
    expect(message).toHaveTextContent('abc123');
  });

  it('adds trimmed comments and toggles approval', async () => {
    render(<CodeReviewAssistant />);

    const commitInput = screen.getByPlaceholderText(/commit id/i);
    await userEvent.type(commitInput, 'abc1234');

    const textarea = screen.getByPlaceholderText(/leave a comment/i);
    const addButton = screen.getByRole('button', { name: /add comment/i });

    await userEvent.type(textarea, '  first comment  ');
    await userEvent.click(addButton);
    const list = screen.getByText('first comment').closest('ul')!;
    expect(within(list).getByText('first comment')).toBeInTheDocument();

    await userEvent.type(textarea, 'second comment');
    await userEvent.click(addButton);
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['first comment', 'second comment']);

    const approveButton = screen.getByRole('button', { name: /approve/i });
    await userEvent.click(approveButton);
    expect(approveButton).toHaveTextContent('Approved');
    expect(screen.getByText(/review approved/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
