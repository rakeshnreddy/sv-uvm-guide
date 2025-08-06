import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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
    await userEvent.type(input, 'abcdef1');
    const message = await screen.findByText(/reviewing commit/i);
    expect(message).toHaveTextContent('abcdef1');
  });

  it('adds trimmed comments and toggles approval', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);
    vi.stubGlobal('fetch', fetchMock);

    render(<CodeReviewAssistant />);
    const input = screen.getByPlaceholderText(/commit id/i);
    await userEvent.type(input, 'abcdef1');

    const textarea = screen.getByPlaceholderText(/leave a comment/i);
    const addButton = screen.getByRole('button', { name: /add comment/i });

    await userEvent.type(textarea, '  first comment  ');
    await userEvent.click(addButton);
    await screen.findByText('first comment');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ commitId: 'abcdef1', comment: 'first comment' }),
      }),
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    await userEvent.click(approveButton);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ commitId: 'abcdef1', approved: true }),
      }),
    );
    expect(approveButton).toHaveTextContent('Approved');
    expect(screen.getByText(/review approved/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('shows validation and server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Server error',
    } as any);
    vi.stubGlobal('fetch', fetchMock);

    render(<CodeReviewAssistant />);

    const input = screen.getByPlaceholderText(/commit id/i);
    const textarea = screen.getByPlaceholderText(/leave a comment/i);
    const addButton = screen.getByRole('button', { name: /add comment/i });

    await userEvent.type(input, 'badsha');
    await userEvent.type(textarea, 'comment');
    await userEvent.click(addButton);
    expect(await screen.findByText(/invalid commit sha/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, 'abcdef1');
    await userEvent.click(addButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Server error')).toBeInTheDocument();

    vi.restoreAllMocks();

  });

  it('sanitizes control chars and enforces 500 character limit', async () => {
    render(<CodeReviewAssistant />);
    const commitInput = screen.getByPlaceholderText(/commit id/i);
    await userEvent.type(commitInput, 'deadbeef');

    const textarea = screen.getByPlaceholderText(/leave a comment/i);
    const addButton = screen.getByRole('button', { name: /add comment/i });

    await userEvent.type(textarea, 'hello\u0007world');
    await userEvent.click(addButton);
    const list = screen.getByText('helloworld').closest('ul')!;
    expect(within(list).getByText('helloworld')).toBeInTheDocument();

    const longComment = 'a'.repeat(501);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, longComment);
    await userEvent.click(addButton);
    expect(screen.getByText(/500 characters or less/i)).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });
});

