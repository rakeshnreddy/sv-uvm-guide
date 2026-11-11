import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSwitcher, themeChoice } from '@/components/ui/ThemeSwitcher';

const { setTheme, current } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  current: { theme: 'ocean-dark' as string | undefined, resolvedTheme: 'ocean-dark', systemTheme: 'dark' as string | undefined },
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ ...current, setTheme }),
}));

beforeEach(() => {
  setTheme.mockReset();
  // An old stored name: it must count as its mode (dark).
  current.theme = 'ocean-dark';
  current.resolvedTheme = 'ocean-dark';
  current.systemTheme = 'dark';
});

afterEach(() => {
  cleanup();
});

describe('themeChoice', () => {
  it('maps stored names to Light, Dark or System', () => {
    expect(themeChoice(undefined)).toBe('system');
    expect(themeChoice('system')).toBe('system');
    expect(themeChoice('light')).toBe('light');
    expect(themeChoice('dark')).toBe('dark');
    expect(themeChoice('ocean-dark')).toBe('dark');
    expect(themeChoice('violet-light')).toBe('light');
  });
});

describe('ThemeSwitcher in the header (menu button)', () => {
  it('is a 40 px icon button named "Theme" that opens a menu of three radio items, the current one checked', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const button = await screen.findByRole('button', { name: 'Theme' });
    expect(button).toHaveClass('h-10', 'w-10', 'rounded-lg', 'border', 'border-border', 'bg-card', 'hover:bg-muted');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Theme' });
    expect(button).toHaveAttribute('aria-controls', menu.id);
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual(['Light', 'Dark', 'System (dark)']);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    // Focus starts on the checked item.
    expect(document.activeElement).toBe(items[1]);
  });

  it('marks the checked item with the raised surface and a 2 px leading accent; the others keep a transparent 2 px border', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(await screen.findByRole('button', { name: 'Theme' }));
    const [light, dark, system] = screen.getAllByRole('menuitemradio');
    expect(dark).toHaveClass('border-l-2', 'border-primary', 'bg-muted', 'font-medium');
    for (const item of [light, system]) {
      expect(item).toHaveClass('border-l-2', 'border-transparent');
      expect(item).not.toHaveClass('bg-muted', 'border-primary');
    }
    // The check icon stays: visible only on the checked item.
    expect(dark.querySelector('svg:last-of-type')).not.toHaveClass('invisible');
    expect(light.querySelector('svg:last-of-type')).toHaveClass('invisible');
  });

  it('chooses with a click, closes and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const button = await screen.findByRole('button', { name: 'Theme' });
    for (const [name, value] of [
      ['Light', 'light'],
      ['Dark', 'dark'],
      ['System (dark)', 'system'],
    ] as const) {
      await user.click(button);
      await user.click(screen.getByRole('menuitemradio', { name }));
      expect(setTheme).toHaveBeenLastCalledWith(value);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(button);
    }
  });

  it('walks by keyboard: Enter opens, arrows move, Enter chooses, Escape closes to the button', async () => {
    const user = userEvent.setup();
    current.theme = 'light';
    current.systemTheme = 'light';
    render(<ThemeSwitcher />);
    const button = await screen.findByRole('button', { name: 'Theme' });
    button.focus();

    await user.keyboard('{Enter}');
    let items = screen.getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAccessibleName('System (light)');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
    expect(setTheme).not.toHaveBeenCalled();

    await user.keyboard(' ');
    items = screen.getAllByRole('menuitemradio');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);

    // ArrowDown on the closed button also opens it.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on a press outside, and on Tab', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSwitcher />
        <button type="button">elsewhere</button>
      </>,
    );
    const button = await screen.findByRole('button', { name: 'Theme' });
    await user.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('opens as a glass menu below the header bar', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(await screen.findByRole('button', { name: 'Theme' }));
    const menu = screen.getByRole('menu', { name: 'Theme' });
    expect(menu).toHaveClass('glass', 'rounded-xl', 'mt-3');
    expect(menu.className).not.toMatch(/\bbg-popover\b|shadow-(lg|xl|2xl)/);
  });

  it('closes when focus leaves it, so it never stays open under a dialog', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSwitcher />
        <input aria-label="Search field" />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'Theme' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    // Ctrl/Cmd+K moves focus into the search dialog's field without a press outside.
    act(() => screen.getByRole('textbox', { name: 'Search field' }).focus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the monitor once mounted when the choice is System, and the mode icon otherwise', async () => {
    current.theme = 'system';
    current.resolvedTheme = 'light';
    current.systemTheme = 'light';
    const { unmount } = render(<ThemeSwitcher />);
    let button = await screen.findByRole('button', { name: 'Theme' });
    expect(button).toHaveAttribute('data-choice', 'system');
    expect(button.querySelectorAll('svg')).toHaveLength(1);
    expect(button.querySelector('[data-icon="system"]')).not.toBeNull();
    unmount();

    current.theme = 'dark';
    render(<ThemeSwitcher />);
    button = await screen.findByRole('button', { name: 'Theme' });
    expect(button).toHaveAttribute('data-choice', 'dark');
    expect(button.querySelector('[data-icon="light"]')).toHaveClass('dark:hidden', 'h-[18px]', 'w-[18px]');
    expect(button.querySelector('[data-icon="dark"]')).toHaveClass('hidden', 'dark:block');
  });

  it('leaves Alt/Option+T to the layout shortcuts, so the theme never toggles twice (NB3 request 4)', async () => {
    render(<ThemeSwitcher />);
    await screen.findByRole('button', { name: 'Theme' });
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

  it('server-renders the same 40 px button with the mode shown by CSS, never "Loading" (responsive-a11y-10)', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<ThemeSwitcher />);
    expect(container.textContent).not.toMatch(/loading/i);
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('aria-label', 'Theme');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveClass('h-10', 'w-10');
    // The stored choice is not known on the server, so it is left out rather than guessed.
    expect(button).not.toHaveAttribute('data-choice');
    const icons = button!.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass('dark:hidden');
    expect(icons[1]).toHaveClass('hidden', 'dark:block');
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});

describe('ThemeSwitcher in the phone menu (segmented radio group)', () => {
  it('offers Light, Dark and System as 44 px radios, the current one checked', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher layout="menu" />);
    const group = await screen.findByRole('radiogroup', { name: 'Theme' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['light', 'dark', 'system']);
    expect(within(group).getByRole('radio', { name: 'Dark' })).toBeChecked();
    for (const radio of radios) expect(radio.closest('label')).toHaveClass('min-h-11');
    expect(within(group).getByRole('radio', { name: 'Dark' }).closest('label')).toHaveClass('border-primary', 'bg-muted', 'font-medium');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: 'Light' }));
    expect(setTheme).toHaveBeenCalledWith('light');
    await user.click(within(group).getByRole('radio', { name: 'System' }));
    expect(setTheme).toHaveBeenCalledWith('system');
  });

  it('hides the segment icons below 400 px, so "System" fits inside its segment on a 320 px phone', async () => {
    render(<ThemeSwitcher layout="menu" />);
    const group = await screen.findByRole('radiogroup', { name: 'Theme' });
    for (const label of group.querySelectorAll('label')) {
      expect(label).toHaveClass('min-h-11', 'min-w-0');
      expect(label.querySelector('svg')).toHaveClass('hidden', 'min-[400px]:block');
      expect(label.querySelector('span')).toHaveClass('truncate');
    }
  });

  it('says which mode System gives on this device', async () => {
    current.theme = 'system';
    current.systemTheme = 'light';
    render(<ThemeSwitcher layout="menu" />);
    expect(await screen.findByRole('radio', { name: 'System' })).toBeChecked();
    expect(screen.getByTestId('theme-system-note')).toHaveTextContent('Following this device: light mode');
  });

  it('server-renders with nothing checked and no text that changes size later', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<ThemeSwitcher layout="menu" />);
    expect(container.textContent).not.toMatch(/loading/i);
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(container.querySelector('input:checked')).toBeNull();
    expect(container.querySelector('[data-testid="theme-system-note"]')).toHaveClass('min-h-4');
  });
});
