import { afterEach, describe, expect, it } from 'vitest';

import { themeAttributeScript } from '@/components/providers/ThemeProvider';
import { oppositeMode, THEME_MODES, THEME_VALUE_MAP, themeMode } from '@/lib/theme-modes';

const LEGACY = ['default', 'ocean', 'sunset', 'forest', 'violet'];

describe('theme modes', () => {
  it('has two modes, and maps every old stored name to its mode', () => {
    expect(THEME_MODES).toEqual(['light', 'dark']);
    expect(THEME_VALUE_MAP.light).toBe('light');
    expect(THEME_VALUE_MAP.dark).toBe('dark');
    for (const palette of LEGACY) {
      expect(THEME_VALUE_MAP[`${palette}-light`]).toBe('light');
      expect(THEME_VALUE_MAP[`${palette}-dark`]).toBe('dark');
    }
    expect(Object.keys(THEME_VALUE_MAP)).toHaveLength(12);
    expect(new Set(Object.values(THEME_VALUE_MAP))).toEqual(new Set(['light', 'dark']));
  });

  it('resolves names to a mode, with dark for anything unknown', () => {
    expect(themeMode('ocean-light')).toBe('light');
    expect(themeMode('violet-dark')).toBe('dark');
    expect(themeMode('system')).toBe('dark');
    expect(themeMode(undefined)).toBe('dark');
    expect(themeMode('neon')).toBe('dark');
    expect(themeMode(undefined, 'light')).toBe('light');
    expect(oppositeMode('dark')).toBe('light');
    expect(oppositeMode('light')).toBe('dark');
  });
});

describe('pre-paint theme script', () => {
  const run = (stored: string | null) => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    if (stored === null) window.localStorage.removeItem('theme');
    else window.localStorage.setItem('theme', stored);
    new Function(themeAttributeScript)();
    return document.documentElement.getAttribute('data-theme');
  };

  afterEach(() => {
    window.localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies a stored mode or old name through the value map, and leaves the stored value alone', () => {
    expect(run('light')).toBe('light');
    expect(run('dark')).toBe('dark');
    expect(run('ocean-dark')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(run('forest-light')).toBe('light');
    expect(window.localStorage.getItem('theme')).toBe('forest-light');
  });

  it('leaves "system", an empty store and unknown names to next-themes and the CSS defaults', () => {
    expect(run('system')).toBeNull();
    expect(run(null)).toBeNull();
    expect(run('neon')).toBeNull();
    expect(run('constructor')).toBeNull();
  });
});
