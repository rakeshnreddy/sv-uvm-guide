import React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LESSON_DONE_LABEL,
  LESSON_DONE_SAVED_STATUS,
  LessonCompletionToggle,
} from '@/components/curriculum/LessonCompletionToggle';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const MODULE_ID = 'F1A_The_Cost_of_Bugs';
const LESSON = 'index';

function stored() {
  return JSON.parse(localStorage.getItem('curriculumProgress') ?? '{}') as Record<
    string,
    { completedLessons: string[]; completedAt?: Record<string, number> }
  >;
}

function seedDone() {
  localStorage.setItem(
    'curriculumProgress',
    JSON.stringify({ [MODULE_ID]: { completedLessons: [LESSON], completedAt: { [LESSON]: 1_000 } } }),
  );
}

describe('LessonCompletionToggle', () => {
  let roots: Root[] = [];

  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
    roots = [];
  });

  afterEach(() => {
    act(() => roots.forEach((root) => root.unmount()));
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('keeps one label whatever the state, as the APG toggle-button pattern requires', () => {
    expect(LESSON_DONE_LABEL).toBe('Lesson done');
    expect(LESSON_DONE_SAVED_STATUS).toMatch(/Saved in this browser/);
  });

  it('renders the neutral, unpressed state on the server even when the lesson is done', () => {
    seedDone();
    const html = renderToString(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);
    expect(html).toContain('Lesson done');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('Saved in this browser');
    expect(html).not.toContain('✓');
  });

  it('hydrates the server markup without a mismatch, then shows the stored state', async () => {
    seedDone();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = document.createElement('div');
    container.innerHTML = renderToString(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);
    document.body.appendChild(container);

    await act(async () => {
      roots.push(hydrateRoot(container, <LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />));
    });

    const button = screen.getByRole('button', { name: 'Lesson done' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    // The check mark is decoration; the state is aria-pressed, the "saved" note is the status line.
    expect(button).toHaveTextContent('✓Lesson done');
    expect(screen.getByRole('status')).toHaveTextContent(LESSON_DONE_SAVED_STATUS);
    expect(errors).not.toHaveBeenCalled();
  });

  it('marks the lesson done and back, saving each change in this browser', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    render(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);

    const button = screen.getByRole('button', { name: 'Lesson done' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleName('Lesson done');
    expect(stored()[MODULE_ID].completedLessons).toEqual([LESSON]);
    expect(stored()[MODULE_ID].completedAt).toEqual({ [LESSON]: 5_000 });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Marked done. Saved in this browser.');
    // The status is separate visible text, not part of the button's name.
    expect(button).not.toContainElement(status);

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleName('Lesson done');
    expect(stored()[MODULE_ID].completedLessons).toEqual([]);
    expect(stored()[MODULE_ID].completedAt).toBeUndefined();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('stays in sync with another toggle for the same lesson and survives a remount', () => {
    const first = render(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);
    render(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);
    const [a, b] = screen.getAllByRole('button');
    fireEvent.click(a);
    expect(b).toHaveAttribute('aria-pressed', 'true');

    first.unmount();
    cleanup();
    render(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so in a status message when this browser cannot save', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    });
    render(<LessonCompletionToggle moduleId={MODULE_ID} lessonSlug={LESSON} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lesson done' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Kept for this visit only/);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Saved in this browser/);
    // The toggle still reflects the learner's choice for this visit.
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
