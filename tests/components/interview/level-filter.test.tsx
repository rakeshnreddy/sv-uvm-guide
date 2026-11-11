import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InterviewPageController } from '@/components/interview/InterviewPageController';
import { DisclosureTools, LevelCount, LevelFilter } from '@/components/interview/LevelFilter';
import {
  ALL_LEVELS,
  LEVEL_ATTRIBUTE,
  LEVEL_STORAGE_KEY,
  assertSafeLevels,
  levelBootScript,
  levelCountText,
  levelFilterCss,
  levelRadioSyncScript,
  levelStatusText,
  readStoredLevel,
  resolveLevel,
  writeStoredLevel,
} from '@/components/interview/level-filter';
import { applyLevel, collapseAll, expandAll, idFromHash, openQuestionFromHash } from '@/components/interview/level-filter-dom';

const LEVELS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior-staff', label: 'Senior staff' },
];
const VALUES = LEVELS.map((level) => level.value);
const LABELS = Object.fromEntries(LEVELS.map((level) => [level.value, level.label]));
const COUNTS = { all: 4, junior: 2, mid: 1, 'senior-staff': 1 };

/** A filter and four question rows, as a bank page renders them. */
function Fixture() {
  return (
    <div>
      <LevelFilter levels={LEVELS} />
      <DisclosureTools expandLabel="Expand all in this bank" />
      <LevelCount counts={COUNTS} levels={LEVELS} />
      <details id="q-a" data-question-level="junior">
        <summary>A</summary>
        answer A
      </details>
      <details id="q-b" data-question-level="junior">
        <summary>B</summary>
      </details>
      <details id="q-c" data-question-level="mid">
        <summary>C</summary>
      </details>
      <details id="q-d" data-question-level="senior-staff">
        <summary>D</summary>
      </details>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(LEVEL_ATTRIBUTE);
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  document.documentElement.removeAttribute(LEVEL_ATTRIBUTE);
});

describe('level filter values', () => {
  it('accepts only stored values that name a level', () => {
    expect(resolveLevel('mid', VALUES)).toBe('mid');
    expect(resolveLevel('principal', VALUES)).toBe(ALL_LEVELS);
    expect(resolveLevel(null, VALUES)).toBe(ALL_LEVELS);
  });

  it('survives storage that throws, and clears the key for "all"', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredLevel(throwing, VALUES)).toBe(ALL_LEVELS);
    expect(() => writeStoredLevel(throwing, 'mid')).not.toThrow();
    writeStoredLevel(localStorage, 'mid');
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('mid');
    writeStoredLevel(localStorage, ALL_LEVELS);
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBeNull();
  });

  it('words counts and announcements from the data', () => {
    expect(levelCountText(48)).toBe('48 questions');
    expect(levelCountText(1, 'Senior staff')).toBe('1 senior staff question');
    expect(levelCountText(0, 'Staff')).toBe('No staff questions');
    expect(levelStatusText(ALL_LEVELS, COUNTS, LABELS)).toBe('Showing all 4 questions.');
    expect(levelStatusText('junior', COUNTS, LABELS)).toBe('Showing 2 junior questions.');
    expect(levelStatusText('senior-staff', { ...COUNTS, 'senior-staff': 0 }, LABELS)).toBe('No senior staff questions.');
  });

  it('refuses level values that are not plain slugs or that clash with "all"', () => {
    expect(() => assertSafeLevels(['junior', 'senior-staff'])).not.toThrow();
    expect(() => assertSafeLevels(['a"]{}'])).toThrow();
    expect(() => assertSafeLevels(['all'])).toThrow();
    expect(() => levelFilterCss(['bad value'])).toThrow();
  });

  it('builds CSS that hides other levels and count variants from the <html> attribute', () => {
    const css = levelFilterCss(VALUES);
    expect(css).toContain('[data-level-count]:not([data-level-count="all"]){display:none}');
    expect(css).toContain('html[data-interview-level="mid"] [data-question-level]:not([data-question-level="mid"]){display:none}');
    expect(css).toContain('html[data-interview-level="mid"] [data-level-count="mid"]{display:inline}');
    expect(css).toContain('html[data-interview-level="mid"] [data-level-group]:not([data-level-group="mid"]){display:none}');
  });
});

describe('pre-paint scripts', () => {
  it('copies a valid stored level onto <html> and ignores anything else', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, 'mid');
    new Function(levelBootScript(VALUES))();
    expect(document.documentElement.getAttribute(LEVEL_ATTRIBUTE)).toBe('mid');
    localStorage.setItem(LEVEL_STORAGE_KEY, 'nonsense');
    new Function(levelBootScript(VALUES))();
    expect(document.documentElement.hasAttribute(LEVEL_ATTRIBUTE)).toBe(false);
  });

  it('checks the radio for the level on <html>', () => {
    render(<LevelFilter levels={LEVELS} />);
    document.documentElement.setAttribute(LEVEL_ATTRIBUTE, 'senior-staff');
    new Function(levelRadioSyncScript(VALUES))();
    expect(screen.getByRole('radio', { name: 'Senior staff' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'All levels' })).not.toBeChecked();
  });
});

describe('filter markup', () => {
  it('is a labelled radio group with "All levels" first and a polite live region', () => {
    render(<LevelFilter levels={LEVELS} />);
    const group = screen.getByRole('group', { name: 'Level' });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(LEVELS.length + 1);
    expect(screen.getByRole('radio', { name: 'All levels' })).toBeChecked();
    expect(document.querySelector('[data-level-status]')).toHaveAttribute('aria-live', 'polite');
  });

  it('marks the expand and collapse buttons as needing scripts', () => {
    render(<DisclosureTools expandLabel="Expand all in this bank" />);
    expect(screen.getByRole('button', { name: 'Collapse all' }).closest('[data-requires-script]')).not.toBeNull();
  });

  it('marks the level filter as needing scripts too, so it is hidden (every level shows) with scripts off', () => {
    render(<LevelFilter levels={LEVELS} />);
    expect(screen.getByRole('group', { name: 'Level' }).closest('[data-requires-script]')).not.toBeNull();
  });

  it('draws a check mark in each chip, shown only for the chosen level, with the 3:1 control boundary', () => {
    render(<LevelFilter levels={LEVELS} />);
    const chip = screen.getByRole('radio', { name: 'Junior' }).closest('label')!;
    expect(chip).toHaveClass('border-input');
    const mark = chip.querySelector('svg')!;
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveClass('hidden', 'peer-checked:block');
  });
});

describe('DOM helpers', () => {
  it('applies a level to <html> and the radios', () => {
    render(<Fixture />);
    expect(applyLevel(document, 'mid')).toBe('mid');
    expect(document.documentElement.getAttribute(LEVEL_ATTRIBUTE)).toBe('mid');
    expect(screen.getByRole('radio', { name: 'Mid-level' })).toBeChecked();
    expect(applyLevel(document, 'unknown')).toBe(ALL_LEVELS);
    expect(document.documentElement.hasAttribute(LEVEL_ATTRIBUTE)).toBe(false);
  });

  it('expands only the questions the filter shows, and collapses all', () => {
    render(<Fixture />);
    applyLevel(document, 'junior');
    expect(expandAll(document)).toBe(2);
    expect((document.getElementById('q-a') as HTMLDetailsElement).open).toBe(true);
    expect((document.getElementById('q-c') as HTMLDetailsElement).open).toBe(false);
    collapseAll(document);
    expect(document.querySelectorAll('details[open]')).toHaveLength(0);
  });

  it('opens the question a hash names, widening a filter that hides it', () => {
    render(<Fixture />);
    applyLevel(document, 'junior');
    const result = openQuestionFromHash(document, '#q-c');
    expect(result).toMatchObject({ kind: 'opened', widened: true });
    expect((document.getElementById('q-c') as HTMLDetailsElement).open).toBe(true);
    expect(document.documentElement.hasAttribute(LEVEL_ATTRIBUTE)).toBe(false);
    expect(openQuestionFromHash(document, '#q-a')).toMatchObject({ kind: 'opened', widened: false });
  });

  it('sends a question that lives elsewhere to its page, and ignores other hashes', () => {
    render(<Fixture />);
    expect(openQuestionFromHash(document, '#q-elsewhere', { 'q-elsewhere': '/interview-prep/uvm' })).toEqual({
      kind: 'redirect',
      href: '/interview-prep/uvm#q-elsewhere',
    });
    expect(openQuestionFromHash(document, '#q-missing')).toEqual({ kind: 'none' });
    expect(openQuestionFromHash(document, '')).toEqual({ kind: 'none' });
    expect(idFromHash('#%E0%A4%A')).toBeUndefined();
  });
});

describe('InterviewPageController', () => {
  it('stores the chosen level, applies it and announces the count', () => {
    render(
      <>
        <Fixture />
        <InterviewPageController counts={COUNTS} labels={LABELS} />
      </>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Junior' }));
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('junior');
    expect(document.documentElement.getAttribute(LEVEL_ATTRIBUTE)).toBe('junior');
    expect(document.querySelector('[data-level-status]')).toHaveTextContent('Showing 2 junior questions.');
    fireEvent.click(screen.getByRole('radio', { name: 'All levels' }));
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBeNull();
    expect(document.querySelector('[data-level-status]')).toHaveTextContent('Showing all 4 questions.');
  });

  it('restores the stored level on mount (a client-side navigation runs no inline script)', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, 'mid');
    render(
      <>
        <Fixture />
        <InterviewPageController counts={COUNTS} labels={LABELS} />
      </>,
    );
    expect(document.documentElement.getAttribute(LEVEL_ATTRIBUTE)).toBe('mid');
    expect(screen.getByRole('radio', { name: 'Mid-level' })).toBeChecked();
  });

  it('wires expand all, collapse all and the hash', () => {
    window.history.replaceState(null, '', '/#q-d');
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
    render(
      <>
        <Fixture />
        <InterviewPageController counts={COUNTS} labels={LABELS} />
      </>,
    );
    expect((document.getElementById('q-d') as HTMLDetailsElement).open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all in this bank' }));
    expect(document.querySelectorAll('details[open]')).toHaveLength(4);
    expect(document.querySelector('[data-level-status]')).toHaveTextContent('4 questions open.');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(document.querySelectorAll('details[open]')).toHaveLength(0);
    act(() => {
      window.history.replaceState(null, '', '/#q-b');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect((document.getElementById('q-b') as HTMLDetailsElement).open).toBe(true);
  });
});
