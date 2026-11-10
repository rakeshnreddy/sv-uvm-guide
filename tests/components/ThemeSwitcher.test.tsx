import React from 'react';
import { renderToString } from 'react-dom/server';
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

  it('renders a fixed-size, silent placeholder before it mounts, never "Loading..." (responsive-a11y-10)', () => {
    for (const [layout, size] of [
      ['bar', ['h-10', 'w-[132px]']],
      ['menu', ['h-11', 'w-full']],
    ] as const) {
      const container = document.createElement('div');
      container.innerHTML = renderToString(<ThemeSwitcher layout={layout} />);
      expect(container.textContent).toBe('');
      const placeholder = container.querySelector('[data-testid="theme-switcher-placeholder"]');
      expect(placeholder).not.toBeNull();
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
      expect(placeholder).toHaveClass(...size);
      expect(container.querySelector('select, button')).toBeNull();
    }
  });

  it('keeps its names and theme ids, with a 40 px select and 16 px text below md in the bar', async () => {
    render(<ThemeSwitcher />);
    const select = await screen.findByRole('combobox', { name: 'Select theme' });
    expect(select).toHaveClass('h-10', 'text-base', 'md:text-sm');
    expect(select).toHaveValue('ocean');
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      'default',
      'ocean',
      'sunset',
      'forest',
      'violet',
    ]);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveClass('h-10', 'w-10');
    expect(screen.queryByTestId('theme-switcher-placeholder')).not.toBeInTheDocument();
  });

  it('fills the row with 44 px controls in the phone menu, and the select sets the theme family', async () => {
    const user = userEvent.setup();
    const { container } = render(<ThemeSwitcher layout="menu" />);
    const select = await screen.findByRole('combobox', { name: 'Select theme' });
    expect(container.firstElementChild).toHaveClass('w-full');
    expect(select).toHaveClass('h-11', 'flex-1', 'text-base');
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveClass('h-11', 'w-11');
    await user.selectOptions(select, 'forest');
    expect(setTheme).toHaveBeenCalledWith('forest-dark');
  });

  it('stops the sun and moon animating when reduced motion is requested', async () => {
    render(<ThemeSwitcher />);
    const toggle = await screen.findByRole('button', { name: 'Toggle theme' });
    const icons = toggle.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon).toHaveClass('transition-all', 'motion-reduce:transition-none');
  });
});
