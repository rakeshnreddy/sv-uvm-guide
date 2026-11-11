import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadInterviewBanks, type InterviewQuestion } from '@/app/(learning)/interview-prep/interview-banks';
import { LevelFilter } from '@/components/interview/LevelFilter';
import { HidePractisedToggle, PractisedAllHiddenNote, PractisedCount, PractisedSetup } from '@/components/interview/PractisedMarkup';
import { PractisedController } from '@/components/interview/PractisedController';
import { LEVEL_ATTRIBUTE, LEVEL_GROUP_ATTRIBUTE } from '@/components/interview/level-filter';
import {
  ALL_BANKS,
  HIDE_PRACTISED_ATTRIBUTE,
  INTERVIEW_HIDE_PRACTISED_KEY,
  INTERVIEW_PRACTISED_KEY,
  PRACTISED_ATTRIBUTE,
  PRACTISED_DONE_ATTRIBUTE,
  PRACTISED_RECENT_ATTRIBUTE,
  compactSource,
  paintPractised,
  practisedBootScript,
  practisedCountText,
  practisedCss,
  practisedStatusText,
  readHidePractised,
  writeHidePractised,
} from '@/components/interview/practised-marks';
import { questionListHtml } from '@/components/interview/question-html';
import { __resetRecordsForTests, __resetStorageForTests } from '@/lib/learner-store';

const LEVELS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
];
const COUNTS = { all: 3, junior: 2, mid: 1 };

function question(id: string, level: 'junior' | 'mid'): InterviewQuestion {
  return {
    id,
    level,
    levelLabel: level === 'junior' ? 'Junior' : 'Mid-level',
    category: 'concept',
    categoryLabel: 'Concept',
    prompt: `Question ${id}?`,
    rubric: '',
    modelAnswer: `Answer ${id}.`,
    followUps: [],
    commonMistakes: [],
    sources: [],
    lessons: [],
  };
}

/** A bank page in miniature: the counts, the filter, the box, the note and two level sections of real question rows. */
function BankFixture({ withController = true }: { withController?: boolean }) {
  return (
    <div>
      <p data-page-header-meta="">
        <PractisedCount scope="bank-a" counts={COUNTS} levels={LEVELS} />
      </p>
      <LevelFilter levels={LEVELS} />
      <HidePractisedToggle />
      <PractisedAllHiddenNote />
      <div {...{ [LEVEL_GROUP_ATTRIBUTE]: 'junior' }}>
        <div dangerouslySetInnerHTML={{ __html: questionListHtml([question('a-1', 'junior'), question('a-2', 'junior')]) }} />
      </div>
      <div {...{ [LEVEL_GROUP_ATTRIBUTE]: 'mid' }}>
        <div dangerouslySetInnerHTML={{ __html: questionListHtml([question('a-3', 'mid')]) }} />
      </div>
      {withController ? <PractisedController scope="bank-a" /> : null}
    </div>
  );
}

function store(questions: Record<string, { at: number; bank: string; level: string }>): void {
  localStorage.setItem(INTERVIEW_PRACTISED_KEY, JSON.stringify({ v: 1, data: { questions } }));
}

function countText(level = 'all', scope = 'bank-a'): string | null {
  const element = document.querySelector(`[data-practised-count][data-practised-scope="${scope}"][data-level-count="${level}"]`);
  return element?.hasAttribute('data-empty') ? null : (element?.textContent ?? null);
}

function row(id: string): HTMLDetailsElement {
  return document.getElementById(`q-${id}`) as HTMLDetailsElement;
}

function toggleOf(id: string): HTMLButtonElement {
  return row(id).querySelector('[data-practised-toggle]') as HTMLButtonElement;
}

beforeEach(() => {
  localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  for (const name of [LEVEL_ATTRIBUTE, HIDE_PRACTISED_ATTRIBUTE, PRACTISED_DONE_ATTRIBUTE, PRACTISED_RECENT_ATTRIBUTE]) {
    document.documentElement.removeAttribute(name);
  }
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  localStorage.clear();
});

describe('practised words', () => {
  it('says "N of M practised", and nothing when none is', () => {
    expect(practisedCountText(3, 48)).toBe('3 of 48 practised');
    expect(practisedCountText(0, 48)).toBe('');
    expect(practisedCountText(60, 48)).toBe('48 of 48 practised');
    expect(practisedStatusText(true, 4, 16)).toBe('Marked as practised. 4 of 16 practised.');
    expect(practisedStatusText(false, 0, 16)).toBe('Practised mark cleared. 0 of 16 practised.');
  });

  it('remembers "Hide practised" in this browser and survives storage that throws', () => {
    writeHidePractised(localStorage, true);
    expect(localStorage.getItem(INTERVIEW_HIDE_PRACTISED_KEY)).toBe('1');
    expect(readHidePractised(localStorage)).toBe(true);
    writeHidePractised(localStorage, false);
    expect(localStorage.getItem(INTERVIEW_HIDE_PRACTISED_KEY)).toBeNull();
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
    expect(readHidePractised(throwing)).toBe(false);
    expect(() => writeHidePractised(throwing, true)).not.toThrow();
  });

  it('keeps question ids unique across banks and safe as attribute values', () => {
    const ids = loadInterviewBanks().flatMap((bank) => bank.levels.flatMap((group) => group.questions.map((item) => item.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9][a-z0-9-]*$/.test(id))).toBe(true);
  });
});

describe('practised CSS', () => {
  it('shows the state from attributes and, while hiding, hides practised rows and fully practised levels', () => {
    const css = practisedCss(['junior', 'mid']);
    expect(css).toContain('details[data-practised] [data-practised-mark],details[data-practised] [data-practised-on]{display:inline}');
    expect(css).toContain('html[data-interview-hide-practised] [data-question-rows]>li[data-practised]:not([data-practised-recent]){display:none}');
    expect(css).toContain(
      'html[data-interview-hide-practised][data-practised-done~="junior"] [data-level-group="junior"]:not([data-practised-recent]){display:none}',
    );
    expect(css).toContain(
      'html[data-interview-hide-practised][data-interview-level="mid"][data-practised-done~="mid"]:not([data-practised-recent]) [data-practised-all-hidden]{display:block}',
    );
    expect(css).not.toContain(':has(');
    expect(() => practisedCss(['bad level'])).toThrow();
  });
});

describe('paintPractised', () => {
  it('marks rows and their toggles, fills the counts and lists fully practised levels', () => {
    render(<BankFixture withController={false} />);
    const tally = paintPractised(document, {
      marks: {
        'a-1': { at: 1, bank: 'bank-a', level: 'junior' },
        'a-2': { at: 1, bank: 'bank-a', level: 'junior' },
        'b-1': { at: 1, bank: 'bank-b', level: 'mid' },
      },
      hide: true,
      scope: 'bank-a',
      complete: true,
    });
    expect(row('a-1')).toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(row('a-1').parentElement).toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(toggleOf('a-1')).toHaveAttribute('aria-pressed', 'true');
    expect(row('a-3')).not.toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(toggleOf('a-3')).toHaveAttribute('aria-pressed', 'false');
    expect(countText('all')).toBe('2 of 3 practised');
    expect(countText('junior')).toBe('2 of 2 practised');
    expect(countText('mid')).toBeNull();
    expect(document.documentElement.getAttribute(PRACTISED_DONE_ATTRIBUTE)).toBe('junior');
    expect(document.documentElement).toHaveAttribute(HIDE_PRACTISED_ATTRIBUTE);
    expect(screen.getByRole('checkbox', { name: 'Hide practised' })).toBeChecked();
    expect(tally).toEqual({ all: { all: 3, junior: 2, mid: 1 }, 'bank-a': { all: 2, junior: 2 }, 'bank-b': { all: 1, mid: 1 } });
  });

  it("takes this bank's rows as the truth once the page is parsed: their level, and no count for a mark with no row", () => {
    render(<BankFixture withController={false} />);
    const marks = {
      'a-3': { at: 1, bank: 'bank-a', level: 'junior' },
      'a-gone': { at: 1, bank: 'bank-a', level: 'junior' },
    };
    paintPractised(document, { marks, hide: false, scope: 'bank-a', complete: false });
    expect(countText('all')).toBe('2 of 3 practised');
    paintPractised(document, { marks, hide: false, scope: 'bank-a', complete: true });
    expect(countText('all')).toBe('1 of 3 practised');
    expect(countText('mid')).toBe('1 of 1 practised');
    expect(countText('junior')).toBeNull();
  });

  it('survives malformed stored marks', () => {
    render(<BankFixture withController={false} />);
    expect(() =>
      paintPractised(document, { marks: { 'a-1': null, 'a-2': 'yes', 'a-3': { bank: 1 } }, hide: false, scope: 'bank-a', complete: true }),
    ).not.toThrow();
    expect(countText('all')).toBeNull();
  });
});

describe('the pre-paint script', () => {
  it('is the same function, compacted, and paints the stored marks and the box from storage', () => {
    const script = practisedBootScript('bank-a');
    expect(script).not.toMatch(/\n/);
    expect(script).toContain(compactSource(paintPractised.toString()));
    render(<BankFixture withController={false} />);
    store({ 'a-2': { at: 1, bank: 'bank-a', level: 'junior' }, 'x-1': { at: 1, bank: 'bank-b', level: 'junior' } });
    localStorage.setItem(INTERVIEW_HIDE_PRACTISED_KEY, '1');
    new Function(script)();
    expect(row('a-2')).toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(toggleOf('a-2')).toHaveAttribute('aria-pressed', 'true');
    expect(countText('junior')).toBe('1 of 2 practised');
    expect(document.documentElement).toHaveAttribute(HIDE_PRACTISED_ATTRIBUTE);
    expect(screen.getByRole('checkbox', { name: 'Hide practised' })).toBeChecked();
  });

  it('ignores unreadable or newer stored data, and refuses a scope that is not a slug', () => {
    render(<BankFixture withController={false} />);
    localStorage.setItem(INTERVIEW_PRACTISED_KEY, '{not json');
    expect(() => new Function(practisedBootScript('bank-a'))()).not.toThrow();
    localStorage.setItem(INTERVIEW_PRACTISED_KEY, JSON.stringify({ v: 2, data: { questions: { 'a-1': { at: 1, bank: 'bank-a', level: 'junior' } } } }));
    new Function(practisedBootScript('bank-a'))();
    expect(row('a-1')).not.toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(() => practisedBootScript('</script>')).toThrow();
    expect(() => practisedBootScript(ALL_BANKS)).not.toThrow();
  });
});

describe('PractisedController', () => {
  it('sets and clears a mark only from the toggle, and announces the count politely', () => {
    render(<BankFixture />);
    // Opening a question never marks it.
    act(() => {
      row('a-1').open = true;
      row('a-1').dispatchEvent(new Event('toggle'));
    });
    fireEvent.click(row('a-1').querySelector('summary') as HTMLElement);
    expect(localStorage.getItem(INTERVIEW_PRACTISED_KEY)).toBeNull();
    expect(row('a-1')).not.toHaveAttribute(PRACTISED_ATTRIBUTE);

    fireEvent.click(toggleOf('a-1'));
    expect(JSON.parse(localStorage.getItem(INTERVIEW_PRACTISED_KEY) ?? 'null').data.questions['a-1']).toMatchObject({
      bank: 'bank-a',
      level: 'junior',
    });
    expect(row('a-1')).toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(toggleOf('a-1')).toHaveAttribute('aria-pressed', 'true');
    expect(countText('all')).toBe('1 of 3 practised');
    const status = document.querySelector('[data-level-status]') as HTMLElement;
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Marked as practised. 1 of 3 practised.');

    fireEvent.click(toggleOf('a-1'));
    expect(row('a-1')).not.toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(countText('all')).toBeNull();
    expect(status).toHaveTextContent('Practised mark cleared. 0 of 3 practised.');
  });

  it('paints stored marks on mount (a client-side navigation runs no inline script)', () => {
    store({ 'a-3': { at: 1, bank: 'bank-a', level: 'mid' } });
    render(<BankFixture />);
    expect(row('a-3')).toHaveAttribute(PRACTISED_ATTRIBUTE);
    expect(countText('mid')).toBe('1 of 1 practised');
  });

  it('hides practised rows, keeps one just marked in view until the box changes, and offers the way back', () => {
    store({ 'a-1': { at: 1, bank: 'bank-a', level: 'junior' } });
    render(<BankFixture />);
    const box = screen.getByRole('checkbox', { name: 'Hide practised' });
    fireEvent.click(box);
    expect(localStorage.getItem(INTERVIEW_HIDE_PRACTISED_KEY)).toBe('1');
    expect(document.documentElement).toHaveAttribute(HIDE_PRACTISED_ATTRIBUTE);
    expect(document.querySelector('[data-level-status]')).toHaveTextContent('Practised questions hidden. 2 left to practise.');

    fireEvent.click(toggleOf('a-2'));
    expect(document.documentElement.getAttribute(PRACTISED_DONE_ATTRIBUTE)).toBe('junior');
    expect(row('a-2').parentElement).toHaveAttribute(PRACTISED_RECENT_ATTRIBUTE);
    expect(row('a-2').closest(`[${LEVEL_GROUP_ATTRIBUTE}]`)).toHaveAttribute(PRACTISED_RECENT_ATTRIBUTE);

    fireEvent.click(box);
    fireEvent.click(box);
    expect(document.querySelectorAll(`[${PRACTISED_RECENT_ATTRIBUTE}]`)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show practised questions' }));
    expect(localStorage.getItem(INTERVIEW_HIDE_PRACTISED_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute(HIDE_PRACTISED_ATTRIBUTE);
    expect(box).not.toBeChecked();
    expect(box).toHaveFocus();
  });

  it('keeps a practised question a link names in view while practised rows are hidden', () => {
    store({ 'a-3': { at: 1, bank: 'bank-a', level: 'mid' } });
    localStorage.setItem(INTERVIEW_HIDE_PRACTISED_KEY, '1');
    window.history.replaceState(null, '', '/#q-a-3');
    render(<BankFixture />);
    expect(row('a-3').parentElement).toHaveAttribute(PRACTISED_RECENT_ATTRIBUTE);
  });

  it('repaints when the marks change elsewhere (another tab, an import or a reset)', () => {
    render(<BankFixture />);
    act(() => {
      store({ 'a-3': { at: 1, bank: 'bank-a', level: 'mid' } });
      window.dispatchEvent(new StorageEvent('storage', { key: INTERVIEW_PRACTISED_KEY }));
    });
    expect(row('a-3')).toHaveAttribute(PRACTISED_ATTRIBUTE);
  });
});

describe('server markup', () => {
  it('renders the setup, empty hidden count variants for levels that have questions, and script-only controls', () => {
    const { container } = render(
      <>
        <PractisedSetup levels={LEVELS} scope="bank-a" />
        <PractisedCount scope="bank-a" counts={{ all: 2, junior: 2, mid: 0 }} levels={LEVELS} />
        <HidePractisedToggle />
        <PractisedAllHiddenNote />
      </>,
    );
    expect(container.querySelector('style[data-practised-css]')).not.toBeNull();
    expect(container.querySelector('script[data-practised-boot]')).not.toBeNull();
    expect(container.querySelector('symbol#practised-check')).not.toBeNull();
    const variants = Array.from(container.querySelectorAll('[data-practised-count]'));
    expect(variants.map((node) => node.getAttribute('data-level-count'))).toEqual(['all', 'junior']);
    expect(variants.every((node) => node.hasAttribute('data-empty') && node.textContent === '')).toBe(true);
    expect(container.querySelector('input[data-practised-hide]')?.closest('[data-requires-script]')).not.toBeNull();
    expect(container.querySelector('[data-practised-all-hidden]')).toHaveAttribute('data-requires-script');
  });

  it('puts a real toggle button inside each opened question, needing scripts, and the mark in the row', () => {
    const host = document.createElement('div');
    host.innerHTML = questionListHtml([question('z-1', 'junior')]);
    const toggle = host.querySelector('[data-answer] button[data-practised-toggle]');
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle?.closest('[data-requires-script]')).not.toBeNull();
    expect(toggle?.querySelector('[data-practised-off]')).toHaveTextContent('Mark as practised');
    expect(toggle?.querySelector('[data-practised-on]')).toHaveTextContent('Practised');
    expect(host.querySelector('summary [data-practised-mark]')).toHaveTextContent('Practised');
  });
});
