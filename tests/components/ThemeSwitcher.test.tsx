import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'ocean-dark', resolvedTheme: 'ocean-dark', setTheme }),
}));

beforeEach(() => {
  setTheme.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ThemeSwitcher', () => {
  it('switches light and dark from its button, within the current theme family', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const toggle = await screen.findByRole('button', { name: 'Toggle theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(setTheme).toHaveBeenCalledWith('ocean-light');
  });

  it('leaves Alt/Option+T to the layout shortcuts, so the theme never toggles twice (NB3 request 4)', async () => {
    render(<ThemeSwitcher />);
    await screen.findByRole('button', { name: 'Toggle theme' });
    for (const init of [
      { key: 't', code: 'KeyT', altKey: true },
      { key: '†', code: 'KeyT', altKey: true },
    ]) {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      act(() => {
        window.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(setTheme).not.toHaveBeenCalled();
  });
});
