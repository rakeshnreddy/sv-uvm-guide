import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import KeyboardShortcuts, { lessonNeighbourHref } from '@/components/layout/KeyboardShortcuts';
import { shellStore } from '@/components/search/shell-store';
import { findPrevNextTopics } from '@/lib/curriculum-data';

const { push, setTheme, nav } = vi.hoisted(() => ({
  push: vi.fn(),
  setTheme: vi.fn(),
  nav: { pathname: '/curriculum' as string },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'ocean-dark', resolvedTheme: 'ocean-dark', setTheme }),
}));

vi.mock('@/tools/featureFlags', () => ({
  featureFlags: { community: false, tracking: false, personalization: false, fakeComments: false, accountUI: false },
}));

const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

function press(init: KeyboardEventInit & { key: string }, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  nav.pathname = '/curriculum';
  push.mockReset();
  setTheme.mockReset();
  shellStore.reset();
});

afterEach(() => {
  cleanup();
  shellStore.reset();
  document.body.innerHTML = '';
});

describe('KeyboardShortcuts', () => {
  it('navigates with Option+1 and Option+2 on macOS (event.key is "¡" and "™")', () => {
    render(<KeyboardShortcuts />);
    const first = press({ key: '¡', code: 'Digit1', altKey: true });
    expect(push).toHaveBeenLastCalledWith('/curriculum');
    expect(first.defaultPrevented).toBe(true);
    press({ key: '™', code: 'Digit2', altKey: true });
    expect(push).toHaveBeenLastCalledWith('/practice');
  });

  it('navigates with Alt+1 on other platforms', () => {
    render(<KeyboardShortcuts />);
    press({ key: '1', code: 'Digit1', altKey: true });
    expect(push).toHaveBeenCalledWith('/curriculum');
  });

  it('ignores shortcuts to sections whose feature flag is off, and leaves the key alone', () => {
    render(<KeyboardShortcuts />);
    const event = press({ key: '£', code: 'Digit3', altKey: true });
    expect(push).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('opens the outline drawer with Ctrl/Cmd+B off lesson pages, and closes it again', () => {
    render(<KeyboardShortcuts />);
    press({ key: 'b', code: 'KeyB', metaKey: true });
    expect(shellStore.getState().outlineOpen).toBe(true);
    press({ key: 'b', code: 'KeyB', ctrlKey: true });
    expect(shellStore.getState().outlineOpen).toBe(false);
  });

  it('opens the search dialog with Ctrl/Cmd+K or "/" when the navbar field is not on screen', () => {
    render(<KeyboardShortcuts />);
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(shellStore.getState().searchOpen).toBe(true);
    act(() => shellStore.closeSearch());
    press({ key: '/', code: 'Slash' });
    expect(shellStore.getState().searchOpen).toBe(true);
  });

  it('focuses and selects the navbar search field when it is on screen', () => {
    render(
      <>
        <input data-command-target="global-search" defaultValue="old query" aria-label="Search" />
        <KeyboardShortcuts />
      </>,
    );
    const field = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;
    field.getClientRects = () => [{} as DOMRect] as unknown as DOMRectList;
    press({ key: 'k', code: 'KeyK', metaKey: true });
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('old query'.length);
    expect(shellStore.getState().searchOpen).toBe(false);
  });

  it('keeps single-key and Alt shortcuts out of the way while typing, but not Ctrl/Cmd+K', () => {
    render(
      <>
        <input aria-label="Notes" />
        <KeyboardShortcuts />
      </>,
    );
    const field = screen.getByRole('textbox', { name: 'Notes' });
    field.focus();
    const typedQuestion = press({ key: '?', code: 'Slash', shiftKey: true }, field);
    expect(typedQuestion.defaultPrevented).toBe(false);
    expect(shellStore.getState().helpOpen).toBe(false);
    press({ key: '¡', code: 'Digit1', altKey: true }, field);
    expect(push).not.toHaveBeenCalled();
    press({ key: 'k', code: 'KeyK', ctrlKey: true }, field);
    expect(shellStore.getState().searchOpen).toBe(true);
  });

  it('ignores auto-repeat and keys another control already handled', () => {
    render(<KeyboardShortcuts />);
    press({ key: '¡', code: 'Digit1', altKey: true, repeat: true });
    expect(push).not.toHaveBeenCalled();
    const handled = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
    handled.preventDefault();
    act(() => {
      window.dispatchEvent(handled);
    });
    expect(shellStore.getState().helpOpen).toBe(false);
  });

  it('moves to the previous and next lesson with "[" and "]" on a lesson page', () => {
    nav.pathname = MAILBOXES;
    render(<KeyboardShortcuts />);
    const { prev, next } = findPrevNextTopics(['T2_Intermediate', 'I-SV-5_Synchronization_and_IPC', 'mailboxes']);
    press({ key: ']', code: 'BracketRight' });
    expect(push).toHaveBeenLastCalledWith(`/curriculum/${next?.slug}`);
    press({ key: '[', code: 'BracketLeft' });
    expect(push).toHaveBeenLastCalledWith(`/curriculum/${prev?.slug}`);
    expect(lessonNeighbourHref(MAILBOXES, 'next')).toBe(
      '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/semaphores',
    );
  });

  it('does nothing with "[" and "]" off lesson pages', () => {
    render(<KeyboardShortcuts />);
    const event = press({ key: ']', code: 'BracketRight' });
    expect(push).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(lessonNeighbourHref('/practice', 'next')).toBeUndefined();
  });

  it('jumps to the lesson\'s "On this page" list with "t" (G30-SRCH-06)', () => {
    nav.pathname = MAILBOXES;
    render(
      <>
        <nav aria-label="On this page">
          <ol>
            <li>
              <a href="#quick-take">Quick Take</a>
            </li>
            <li>
              <a href="#basic-operations" aria-current="location">
                Basic Operations
              </a>
            </li>
          </ol>
        </nav>
        <KeyboardShortcuts />
      </>,
    );
    const event = press({ key: 't', code: 'KeyT' });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Basic Operations' }));
  });

  it('opens the collapsed "On this page" list before focusing it', () => {
    nav.pathname = MAILBOXES;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    function Toc() {
      const [open, setOpen] = React.useState(false);
      return (
        <nav aria-label="On this page">
          <button type="button" aria-expanded={open} aria-controls="toc-list" onClick={() => setOpen(true)}>
            On this page
          </button>
          <ol id="toc-list" hidden={!open}>
            <li>
              <a href="#quick-take">Quick Take</a>
            </li>
          </ol>
        </nav>
      );
    }
    render(
      <>
        <Toc />
        <KeyboardShortcuts />
      </>,
    );
    const toggle = screen.getByRole('button', { name: 'On this page' });
    toggle.getClientRects = () => [{} as DOMRect] as unknown as DOMRectList;
    press({ key: 't', code: 'KeyT' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Quick Take' }));
    vi.restoreAllMocks();
  });

  it('leaves "t" alone off lesson pages and on lessons without the list', () => {
    render(<KeyboardShortcuts />);
    expect(press({ key: 't', code: 'KeyT' }).defaultPrevented).toBe(false);
    cleanup();
    nav.pathname = MAILBOXES;
    render(<KeyboardShortcuts />);
    expect(press({ key: 't', code: 'KeyT' }).defaultPrevented).toBe(false);
  });

  it('switches light and dark with Option+T on macOS and leaves Alt+T elsewhere to ThemeSwitcher', () => {
    render(<KeyboardShortcuts />);
    press({ key: '†', code: 'KeyT', altKey: true });
    expect(setTheme).toHaveBeenCalledWith('ocean-light');
    setTheme.mockReset();
    const elsewhere = press({ key: 't', code: 'KeyT', altKey: true });
    expect(setTheme).not.toHaveBeenCalled();
    expect(elsewhere.defaultPrevented).toBe(false);
  });

  it('closes open dialogs when the route changes', () => {
    const { rerender } = render(<KeyboardShortcuts />);
    act(() => shellStore.openSearch());
    nav.pathname = '/practice';
    rerender(<KeyboardShortcuts />);
    expect(shellStore.getState().searchOpen).toBe(false);
  });
});

describe('keyboard shortcuts help', () => {
  it('opens with "?" as a labelled modal dialog that lists every available shortcut', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Somewhere</button>
        <KeyboardShortcuts />
      </>,
    );
    const somewhere = screen.getByRole('button', { name: 'Somewhere' });
    somewhere.focus();
    press({ key: '?', code: 'Slash', shiftKey: true }, somewhere);

    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    const tables = within(dialog).getAllByRole('table');
    expect(tables.map((table) => table.querySelector('caption')?.textContent)).toEqual([
      'Anywhere',
      'On a lesson page',
      'In search',
    ]);
    for (const action of [
      'Search lessons and sections',
      'Show or hide the course outline',
      'Go to the curriculum',
      'Go to practice',
      'Switch between light and dark mode',
      'Show this list of shortcuts',
      'Previous lesson',
      'Next lesson',
      'Jump to “On this page”, the lesson’s list of sections',
    ]) {
      expect(within(dialog).getByRole('cell', { name: action })).toBeInTheDocument();
    }
    // Sections behind flags that are off are not offered.
    expect(within(dialog).queryByRole('cell', { name: 'Go to your dashboard' })).not.toBeInTheDocument();
    // Keys are text, not glyphs alone.
    expect(within(dialog).getAllByText('Question mark').length).toBeGreaterThan(0);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(somewhere);
  });

  it('closes from its close button and from the backdrop', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);
    act(() => shellStore.openHelp());
    await user.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => shellStore.openHelp());
    const backdrop = screen.getByRole('dialog').parentElement?.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
