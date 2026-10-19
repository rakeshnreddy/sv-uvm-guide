import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import FeynmanPromptWidget, {
  AI_FEEDBACK_ERROR_MESSAGES,
  TEACH_BACK_SELF_CHECK,
  aiFeedbackErrorMessage,
  notebookWriteErrorMessage,
  parseFeynmanFeedback,
} from '@/components/widgets/FeynmanPromptWidget';
import { NOTEBOOK_KEY_PREFIX } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { activityRecord } from '@/lib/learner-store/repositories/activity';
import {
  NOTEBOOK_BODY_MAX_CHARS,
  NOTEBOOK_ENTRY_MAX_CHARS,
  NOTEBOOK_MAX_ENTRIES,
  NOTEBOOK_TOTAL_MAX_CHARS,
  notebookEntries,
  teachBackEntryId,
  type NotebookEntry,
} from '@/lib/learner-store/repositories/notebook';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { localDayKey } from '@/lib/learner-store/time';

const mocks = vi.hoisted(() => ({
  pathname: null as string | null,
  aiTutor: false,
}));

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

// Next's Link schedules prefetch state updates outside act(); a plain anchor is enough here.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

// The real hooks (accounts off) unless a test switches the AI tutor on for a signed-in learner.
vi.mock('@/lib/persistence/target', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/persistence/target')>();
  return {
    ...actual,
    useServerFeature: (feature: Parameters<typeof actual.useServerFeature>[0]) =>
      (feature === 'aiTutor' && mocks.aiTutor) || actual.useServerFeature(feature),
  };
});

const LESSON = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const OTHER_LESSON = '/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index';
const EXPLANATION = 'A bug found after tape-out costs far more than one found in simulation.';

const textbox = () => screen.getByRole('textbox', { name: 'Your explanation' });
const saveButton = () => screen.getByRole('button', { name: 'Save to notebook' });
/** Nothing new to save: aria-disabled rather than disabled, so the button keeps keyboard focus after a save. */
const expectNothingToSave = () => {
  expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  expect(saveButton()).not.toBeDisabled();
};
const expectCanSave = () => {
  expect(saveButton()).not.toHaveAttribute('aria-disabled');
  expect(saveButton()).toBeEnabled();
};

const formatCount = (value: number) => value.toLocaleString('en-US');

function seedNote(id: string, body: string, updatedAt = 1): void {
  const entry: NotebookEntry = { id, kind: 'note', title: id, body, createdAt: updatedAt, updatedAt };
  window.localStorage.setItem(`${NOTEBOOK_KEY_PREFIX}${id}`, JSON.stringify({ v: 1, data: entry }));
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

describe('FeynmanPromptWidget (Teach it back)', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    window.localStorage.clear();
    mocks.pathname = LESSON;
    mocks.aiTutor = false;
    fetchMock = vi.fn(() => jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('shows a labelled textarea and the static self-check', () => {
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);

    expect(textbox()).toHaveValue('');
    expect(screen.getByRole('list', { name: 'Check your explanation:' })).toBeInTheDocument();
    for (const item of TEACH_BACK_SELF_CHECK) expect(screen.getByText(item)).toBeInTheDocument();
    expect(TEACH_BACK_SELF_CHECK).toEqual([
      'Define it in one sentence',
      'Give a concrete SV/UVM example',
      'Say when it goes wrong',
      "Avoid words you couldn't define",
    ]);
    expect(screen.getByText(/Explain "The Cost of Bugs" in your own simple words/)).toBeInTheDocument();
  });

  it('saves a teach-back entry for the lesson and records the activity', async () => {
    const user = userEvent.setup();
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);

    expectNothingToSave();
    await user.type(textbox(), EXPLANATION);
    expectCanSave();
    await user.click(saveButton());

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Saved in this browser · Open notebook');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('link', { name: 'Open notebook' })).toHaveAttribute('href', '/dashboard/notebook');

    const entry = notebookEntries.get(teachBackEntryId(LESSON));
    expect(entry).toMatchObject({
      kind: 'teach-back',
      lessonPath: LESSON,
      lessonTitle: 'The Cost of Bugs',
      title: 'The Cost of Bugs',
      body: EXPLANATION,
    });
    expect(activityRecord.read().days[localDayKey()]).toEqual({ note: 1 });
    // Saved text is unchanged, so saving again is not offered until the next edit, and focus stays on the button.
    expectNothingToSave();
    expect(saveButton()).toHaveFocus();
  });

  it('keeps focus on Save to notebook after a keyboard save, and ignores it until the next edit', async () => {
    const user = userEvent.setup();
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    await user.type(textbox(), EXPLANATION);
    await user.tab();
    expect(saveButton()).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
    expect(saveButton()).toHaveFocus();
    expectNothingToSave();

    const setItem = vi.spyOn(window.localStorage, 'setItem');
    await user.keyboard('{Enter}');
    await user.click(saveButton());
    expect(setItem).not.toHaveBeenCalled();
    expect(activityRecord.read().days[localDayKey()]).toEqual({ note: 1 });
  });

  it('restores the saved explanation after mount, per lesson', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    await user.type(textbox(), EXPLANATION);
    await user.click(saveButton());
    unmount();

    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    await waitFor(() => expect(textbox()).toHaveValue(EXPLANATION));
    expectNothingToSave();
    cleanup();

    mocks.pathname = OTHER_LESSON;
    render(<FeynmanPromptWidget conceptTitle="The Verification Mindset" />);
    expect(textbox()).toHaveValue('');
    cleanup();

    // An explicit lessonPath wins over the pathname; a trailing slash is ignored.
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" lessonPath={`${LESSON}/`} />);
    await waitFor(() => expect(textbox()).toHaveValue(EXPLANATION));
  });

  it('drops an unsaved draft when the widget moves to another lesson', () => {
    const { rerender } = render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" lessonPath={LESSON} />);
    fireEvent.change(textbox(), { target: { value: 'Unsaved draft for the first lesson.' } });

    rerender(<FeynmanPromptWidget conceptTitle="The Verification Mindset" lessonPath={OTHER_LESSON} />);

    expect(textbox()).toHaveValue('');
    expectNothingToSave();
    expect(notebookEntries.list()).toHaveLength(0);
  });

  it('writes nothing until the learner saves, and updates the same entry on a second save', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: 'First version of the explanation.' } });
    expect(setItem.mock.calls.filter(([key]) => String(key).startsWith(NOTEBOOK_KEY_PREFIX))).toHaveLength(0);

    fireEvent.click(saveButton());
    fireEvent.change(textbox(), { target: { value: 'Second version of the explanation.' } });
    expect(screen.getByRole('status')).toHaveTextContent('');
    fireEvent.click(saveButton());

    expect(notebookEntries.list()).toHaveLength(1);
    expect(notebookEntries.get(teachBackEntryId(LESSON))?.body).toBe('Second version of the explanation.');
  });

  it('shows a visible message when the explanation is over the entry limit', () => {
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: 'x'.repeat(8_001) } });
    expect(screen.getByText('8,001 / 8,000 characters')).toBeInTheDocument();

    fireEvent.click(saveButton());

    expect(screen.getByRole('status')).toHaveTextContent(
      'Not saved: an entry can hold up to 8,000 characters and this one has 8,001. Shorten it and try again.',
    );
    expect(notebookEntries.get(teachBackEntryId(LESSON))).toBeNull();
    expectCanSave();
  });

  it('says the notebook is full when it holds the most entries it can', () => {
    for (let index = 0; index < NOTEBOOK_MAX_ENTRIES; index += 1) seedNote(`note-${index}`, '');
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: EXPLANATION } });

    fireEvent.click(saveButton());

    expect(screen.getByRole('status')).toHaveTextContent(
      `Not saved: the notebook in this browser holds the most entries it can (${formatCount(NOTEBOOK_MAX_ENTRIES)}).`,
    );
    expect(notebookEntries.get(teachBackEntryId(LESSON))).toBeNull();
  });

  it('says the notebook is full when its entries hold the most characters they can', () => {
    // Full-size entries until the next one would not fit in NOTEBOOK_TOTAL_MAX_CHARS.
    const count = Math.floor(NOTEBOOK_TOTAL_MAX_CHARS / (NOTEBOOK_BODY_MAX_CHARS + 100));
    for (let index = 0; index < count; index += 1) seedNote(`note-${index}`, 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS));
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: 'y'.repeat(NOTEBOOK_BODY_MAX_CHARS) } });

    fireEvent.click(saveButton());

    expect(screen.getByRole('status')).toHaveTextContent(
      `Not saved: the notebook in this browser is full (it can hold ${formatCount(NOTEBOOK_TOTAL_MAX_CHARS)} characters in all).`,
    );
  });

  it('says one entry is too large to store when escaping takes it over the per-entry limit', () => {
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    // 8,000 characters, each stored as a six-character JSON escape.
    fireEvent.change(textbox(), { target: { value: '\u0001'.repeat(NOTEBOOK_BODY_MAX_CHARS) } });

    fireEvent.click(saveButton());

    expect(screen.getByRole('status')).toHaveTextContent(
      `Not saved: this entry is too large to store. Quotes, backslashes and other special characters take extra room, and a stored entry can take up to ${formatCount(NOTEBOOK_ENTRY_MAX_CHARS)} characters.`,
    );
    expect(notebookEntries.get(teachBackEntryId(LESSON))).toBeNull();
  });

  it('says so when the browser keeps the explanation for this visit only', () => {
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: EXPLANATION } });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    fireEvent.click(saveButton());

    expect(screen.getByRole('status')).toHaveTextContent(/Kept for this visit only/);
    expect(screen.getByRole('link', { name: 'Back up your data' })).toHaveAttribute('href', '/settings#data');
  });

  it('disables saving without a lesson path', () => {
    mocks.pathname = null;
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    fireEvent.change(textbox(), { target: { value: EXPLANATION } });

    expect(saveButton()).toBeDisabled();
  });

  it('sends no request and offers no AI feedback while the AI tutor is off', async () => {
    const user = userEvent.setup();
    render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
    await user.type(textbox(), EXPLANATION);
    await user.click(saveButton());

    expect(screen.queryByRole('button', { name: /AI feedback/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders under renderToStaticMarkup with no <section> and nothing account-only', () => {
    mocks.pathname = null;
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(<FeynmanPromptWidget conceptTitle="Lesson" />);
    }).not.toThrow();

    expect(html).not.toMatch(/<section/);
    expect(html).toContain('Your explanation');
    expect(html).toContain('Define it in one sentence');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Save to notebook<\/button>/);
    expect(html).not.toContain('AI feedback');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('with the AI tutor on and a learner signed in', () => {
    beforeEach(() => {
      mocks.aiTutor = true;
    });

    it('shows Get AI feedback and maps a 401 to a visible message', async () => {
      fetchMock.mockImplementation(() => jsonResponse(401, { error: 'UNAUTHORIZED' }));
      const user = userEvent.setup();
      render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
      await user.type(textbox(), EXPLANATION);
      await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

      expect(await screen.findByText(AI_FEEDBACK_ERROR_MESSAGES[401])).toBeVisible();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/ai/feynman-feedback');
      expect(JSON.parse(String(init.body))).toEqual({ content: `Topic: The Cost of Bugs\n\nExplanation: ${EXPLANATION}` });
    });

    it('maps a 503 to a visible message', async () => {
      fetchMock.mockImplementation(() => jsonResponse(503, { error: 'AI_NOT_CONFIGURED' }));
      const user = userEvent.setup();
      render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
      await user.type(textbox(), EXPLANATION);
      await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

      expect(await screen.findByText(AI_FEEDBACK_ERROR_MESSAGES[503])).toBeVisible();
    });

    it('renders the score, feedback and missing concepts as plain text', async () => {
      fetchMock.mockImplementation(() =>
        jsonResponse(200, { score: 84, feedback: 'Clear. <b>Add</b> the cost curve.', missingConcepts: ['<i>escape cost</i>'] }),
      );
      const user = userEvent.setup();
      const { container } = render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
      await user.type(textbox(), EXPLANATION);
      await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

      expect(await screen.findByText('AI feedback · score 84 / 100')).toBeVisible();
      expect(screen.getByText('Clear. <b>Add</b> the cost curve.')).toBeVisible();
      expect(screen.getByText('<i>escape cost</i>')).toBeVisible();
      expect(container.querySelector('b, i')).toBeNull();
    });

    it('asks for a longer explanation before sending a short one, and drops the message on the next edit', async () => {
      const user = userEvent.setup();
      render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
      await user.type(textbox(), 'Too short');
      await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

      expect(screen.getByText('Write at least 20 characters before asking for feedback.')).toBeVisible();
      expect(fetchMock).not.toHaveBeenCalled();

      await user.type(textbox(), ', but longer now.');
      expect(screen.queryByText('Write at least 20 characters before asking for feedback.')).toBeNull();
    });

    it('marks feedback as outdated once the explanation changes, and clears that when asked again', async () => {
      fetchMock.mockImplementation(() => jsonResponse(200, { score: 70, feedback: 'Add the cost curve.', missingConcepts: [] }));
      const user = userEvent.setup();
      render(<FeynmanPromptWidget conceptTitle="The Cost of Bugs" />);
      await user.type(textbox(), EXPLANATION);
      const feedbackButton = screen.getByRole('button', { name: 'Get AI feedback' });
      await user.click(feedbackButton);

      expect(await screen.findByText('AI feedback · score 70 / 100')).toBeVisible();
      expect(feedbackButton).toHaveFocus();
      expect(screen.queryByText(/^Outdated:/)).toBeNull();

      await user.type(textbox(), ' The cost grows tenfold per stage.');
      expect(screen.getByText(/^Outdated: this feedback is for an earlier version of your explanation/)).toBeVisible();
      // The earlier feedback stays readable while the learner revises.
      expect(screen.getByText('Add the cost curve.')).toBeVisible();

      await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));
      await waitFor(() => expect(screen.queryByText(/^Outdated:/)).toBeNull());
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('notebookWriteErrorMessage', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('builds the limits into the copy and tells a full notebook from an oversized entry', () => {
    expect(notebookWriteErrorMessage('too-large', { entryId: null, body: 'x'.repeat(NOTEBOOK_BODY_MAX_CHARS + 1) })).toBe(
      `Not saved: an entry can hold up to ${formatCount(NOTEBOOK_BODY_MAX_CHARS)} characters and this one has ${formatCount(NOTEBOOK_BODY_MAX_CHARS + 1)}. Shorten it and try again.`,
    );
    expect(notebookWriteErrorMessage('too-large', { entryId: null, body: '"'.repeat(10) })).toMatch(
      /^Not saved: this entry is too large to store\./,
    );

    for (let index = 0; index < NOTEBOOK_MAX_ENTRIES; index += 1) seedNote(`note-${index}`, '');
    expect(notebookWriteErrorMessage('too-large', { entryId: null, title: '', body: '' })).toMatch(
      new RegExp(`holds the most entries it can \\(${formatCount(NOTEBOOK_MAX_ENTRIES)}\\)`),
    );
    // An existing entry does not count against the entry limit.
    expect(notebookWriteErrorMessage('too-large', { entryId: 'note-0', body: '"'.repeat(10) })).toMatch(
      /^Not saved: this entry is too large to store\./,
    );
  });

  it('uses the shared message for every other outcome', () => {
    expect(notebookWriteErrorMessage('memory-only', { entryId: null, body: '' })).toMatch(/Kept for this visit only/);
    expect(notebookWriteErrorMessage('not-in-browser', { entryId: null, body: '' })).toMatch(/^Not saved/);
  });
});

describe('AI feedback helpers', () => {
  it('maps every documented status, and anything else to a generic message', () => {
    for (const status of [400, 401, 429, 503, 504] as const) {
      expect(aiFeedbackErrorMessage(status)).toBe(AI_FEEDBACK_ERROR_MESSAGES[status]);
    }
    expect(aiFeedbackErrorMessage(500)).toBe(AI_FEEDBACK_ERROR_MESSAGES.unavailable);
  });

  it('accepts only the route result shape', () => {
    expect(parseFeynmanFeedback({ score: 101.4, feedback: 'ok', missingConcepts: ['a', 3, ' '] })).toEqual({
      score: 100,
      feedback: 'ok',
      missingConcepts: ['a'],
    });
    expect(parseFeynmanFeedback({ error: 'UNAUTHORIZED' })).toBeNull();
    expect(parseFeynmanFeedback({ score: '80', feedback: 'ok' })).toBeNull();
    expect(parseFeynmanFeedback(null)).toBeNull();
  });
});
