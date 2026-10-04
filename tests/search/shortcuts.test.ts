import { describe, expect, it } from 'vitest';

import {
  baseKey,
  isEditableTarget,
  matchShortcut,
  shortcutHelp,
  shortcutRoute,
  themeShortcutHandledByThemeSwitcher,
  toggledThemeName,
  type ShortcutId,
  type ShortcutKeyEvent,
} from '@/components/search/shortcuts';

function key(partial: Partial<ShortcutKeyEvent> & { key: string }): ShortcutKeyEvent {
  return { code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...partial };
}

const id = (event: ShortcutKeyEvent): ShortcutId | undefined => matchShortcut(event)?.id;

describe('matchShortcut', () => {
  it('opens search with Ctrl+K or Cmd+K, even while typing', () => {
    expect(matchShortcut(key({ key: 'k', code: 'KeyK', ctrlKey: true }))).toEqual({ id: 'search', allowWhileTyping: true });
    expect(matchShortcut(key({ key: 'k', code: 'KeyK', metaKey: true }))).toEqual({ id: 'search', allowWhileTyping: true });
    expect(id(key({ key: 'K', code: 'KeyK', ctrlKey: true }))).toBe('search');
    // A Cyrillic layout reports the letter it types; the physical key still counts.
    expect(id(key({ key: 'л', code: 'KeyK', ctrlKey: true }))).toBe('search');
    expect(id(key({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true }))).toBeUndefined();
    expect(id(key({ key: 'k', code: 'KeyK' }))).toBeUndefined();
  });

  it('toggles the outline with Ctrl+B or Cmd+B, but not while typing', () => {
    expect(matchShortcut(key({ key: 'b', code: 'KeyB', metaKey: true }))).toEqual({ id: 'outline', allowWhileTyping: false });
    expect(id(key({ key: 'b', code: 'KeyB', ctrlKey: true }))).toBe('outline');
  });

  it('fires the Alt shortcuts on macOS, where Option changes event.key (G30-SRCH-04)', () => {
    expect(id(key({ key: '¡', code: 'Digit1', altKey: true }))).toBe('go-curriculum');
    expect(id(key({ key: '™', code: 'Digit2', altKey: true }))).toBe('go-practice');
    expect(id(key({ key: '£', code: 'Digit3', altKey: true }))).toBe('go-dashboard');
    expect(id(key({ key: 'ç', code: 'KeyC', altKey: true }))).toBe('go-community');
    expect(id(key({ key: '†', code: 'KeyT', altKey: true }))).toBe('toggle-theme');
  });

  it('fires the Alt shortcuts on Windows and Linux layouts', () => {
    expect(id(key({ key: '1', code: 'Digit1', altKey: true }))).toBe('go-curriculum');
    expect(id(key({ key: '2', code: 'Digit2', altKey: true }))).toBe('go-practice');
    expect(id(key({ key: 'c', code: 'KeyC', altKey: true }))).toBe('go-community');
    // AZERTY: the 1 key types "&" unshifted.
    expect(id(key({ key: '&', code: 'Digit1', altKey: true }))).toBe('go-curriculum');
  });

  it('leaves AltGr (Ctrl+Alt) characters alone', () => {
    expect(id(key({ key: '1', code: 'Digit1', altKey: true, ctrlKey: true }))).toBeUndefined();
    expect(id(key({ key: '@', code: 'KeyQ', altKey: true, ctrlKey: true }))).toBeUndefined();
  });

  it('maps the single-key shortcuts by the character typed', () => {
    expect(id(key({ key: '?', code: 'Slash', shiftKey: true }))).toBe('help');
    expect(matchShortcut(key({ key: '/', code: 'Slash' }))).toEqual({ id: 'search', allowWhileTyping: false });
    expect(id(key({ key: '[', code: 'BracketLeft' }))).toBe('prev-lesson');
    expect(id(key({ key: ']', code: 'BracketRight' }))).toBe('next-lesson');
    expect(id(key({ key: 't', code: 'KeyT' }))).toBe('toc');
    expect(id(key({ key: 'T', code: 'KeyT', shiftKey: true }))).toBeUndefined();
    expect(id(key({ key: 't', code: 'KeyT', altKey: true }))).toBe('toggle-theme');
    expect(id(key({ key: 't', code: 'KeyT', altKey: true, ctrlKey: true }))).toBeUndefined();
    // German Mac layout: Option+5 types "[". German Windows layout: AltGr+8.
    expect(id(key({ key: '[', code: 'Digit5', altKey: true }))).toBe('prev-lesson');
    expect(id(key({ key: '[', code: 'Digit8', altKey: true, ctrlKey: true }))).toBe('prev-lesson');
  });

  it('never takes over browser shortcuts', () => {
    expect(id(key({ key: '[', code: 'BracketLeft', ctrlKey: true }))).toBeUndefined();
    expect(id(key({ key: '[', code: 'BracketLeft', metaKey: true }))).toBeUndefined();
    expect(id(key({ key: '1', code: 'Digit1', metaKey: true }))).toBeUndefined();
    expect(id(key({ key: 'l', code: 'KeyL', ctrlKey: true }))).toBeUndefined();
  });
});

describe('baseKey', () => {
  it('prefers the typed letter, and falls back to the physical key', () => {
    expect(baseKey({ key: 'k', code: 'KeyT' })).toBe('k'); // Dvorak: the printed letter wins
    expect(baseKey({ key: '¡', code: 'Digit1' })).toBe('1');
    expect(baseKey({ key: 'Dead', code: 'KeyE' })).toBe('e');
    expect(baseKey({ key: '[', code: 'BracketLeft' })).toBe('[');
  });
});

describe('isEditableTarget', () => {
  it('treats text fields as typing, and buttons, checkboxes and plain elements as not', () => {
    const make = (html: string) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      return wrapper.firstElementChild as HTMLElement;
    };
    expect(isEditableTarget(make('<input type="text" />'))).toBe(true);
    expect(isEditableTarget(make('<input type="search" />'))).toBe(true);
    expect(isEditableTarget(make('<input />'))).toBe(true);
    expect(isEditableTarget(make('<textarea></textarea>'))).toBe(true);
    expect(isEditableTarget(make('<select><option>a</option></select>'))).toBe(true);
    expect(isEditableTarget(make('<div contenteditable="true"></div>'))).toBe(true);
    expect(isEditableTarget(make('<div role="textbox"><span>x</span></div>').firstElementChild)).toBe(true);
    expect(isEditableTarget(make('<input type="checkbox" />'))).toBe(false);
    expect(isEditableTarget(make('<button type="button">Go</button>'))).toBe(false);
    expect(isEditableTarget(make('<a href="/x">x</a>'))).toBe(false);
    expect(isEditableTarget(make('<div contenteditable="false"></div>'))).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    document.body.innerHTML = '';
  });
});

describe('theme and route helpers', () => {
  it('leaves Alt+T to ThemeSwitcher except where macOS turns it into "†"', () => {
    expect(themeShortcutHandledByThemeSwitcher({ key: 't' })).toBe(true);
    expect(themeShortcutHandledByThemeSwitcher({ key: 'T' })).toBe(true);
    expect(themeShortcutHandledByThemeSwitcher({ key: '†' })).toBe(false);
  });

  it('switches light and dark within the current theme family', () => {
    expect(toggledThemeName('default-dark')).toBe('default-light');
    expect(toggledThemeName('ocean-light')).toBe('ocean-dark');
    expect(toggledThemeName(undefined)).toBe('default-light');
    expect(toggledThemeName('system')).toBe('default-light');
  });

  it('only routes to flagged sections when their flag is on', () => {
    const off = { tracking: false, community: false };
    const on = { tracking: true, community: true };
    expect(shortcutRoute('go-curriculum', off)).toBe('/curriculum');
    expect(shortcutRoute('go-practice', off)).toBe('/practice');
    expect(shortcutRoute('go-dashboard', off)).toBeUndefined();
    expect(shortcutRoute('go-community', off)).toBeUndefined();
    expect(shortcutRoute('go-dashboard', on)).toBe('/dashboard');
    expect(shortcutRoute('go-community', on)).toBe('/community');
    expect(shortcutRoute('help', on)).toBeUndefined();
  });
});

describe('shortcutHelp', () => {
  const allIds: ShortcutId[] = [
    'search',
    'outline',
    'go-curriculum',
    'go-practice',
    'go-dashboard',
    'go-community',
    'toggle-theme',
    'prev-lesson',
    'next-lesson',
    'toc',
    'help',
  ];

  it('lists every shortcut the matcher knows when every flag is on', () => {
    const listed = shortcutHelp({ apple: false, flags: { tracking: true, community: true } }).flatMap((group) =>
      group.items.map((item) => item.id),
    );
    for (const shortcut of allIds) expect(listed).toContain(shortcut);
  });

  it('hides shortcuts to sections that are switched off', () => {
    const listed = shortcutHelp({ apple: false, flags: { tracking: false, community: false } }).flatMap((group) =>
      group.items.map((item) => item.id),
    );
    expect(listed).not.toContain('go-dashboard');
    expect(listed).not.toContain('go-community');
  });

  it('names the modifier keys the way each platform prints them', () => {
    const items = (apple: boolean) =>
      shortcutHelp({ apple, flags: { tracking: false, community: false } }).flatMap((group) => group.items);
    expect(items(true).find((item) => item.id === 'search')?.keys).toEqual([['Cmd', 'K'], ['/']]);
    expect(items(true).find((item) => item.id === 'go-curriculum')?.keys).toEqual([['Option', '1']]);
    expect(items(false).find((item) => item.id === 'search')?.keys).toEqual([['Ctrl', 'K'], ['/']]);
    expect(items(false).find((item) => item.id === 'go-curriculum')?.keys).toEqual([['Alt', '1']]);
  });
});
