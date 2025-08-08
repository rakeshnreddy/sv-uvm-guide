import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIAssistantWidget from '../../src/components/widgets/AIAssistantWidget';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Tester' } }),
}));

describe('AIAssistantWidget page context', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ reply: 'ok' }) }) as any,
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('includes page title, route, and selected text in request', async () => {
    document.title = 'Test Title';
    window.history.pushState({}, '', '/test-route');
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected text' } as any);
    (window.HTMLElement as any).prototype.scrollIntoView = vi.fn();

    render(<AIAssistantWidget />);

    const openButton = screen.getByRole('button', { name: /open ai assistant/i });
    await userEvent.click(openButton);

    const textarea = await screen.findByPlaceholderText(/ask about systemverilog, uvm/i);
    await userEvent.type(textarea, 'Hello there');

    const sendButton = screen.getByRole('button', { name: /send message/i });
    await userEvent.click(sendButton);

    const fetchMock = fetch as unknown as vi.Mock;
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.context).toEqual({
      pageTitle: 'Test Title',
      route: '/test-route',
      selectedText: 'selected text',
    });
  });
});
