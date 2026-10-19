import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotebookPage, { metadata } from '@/app/(learning)/dashboard/notebook/page';
import NotebookPageClient, {
  matchesNotebookQuery,
  sortNotebookEntries,
} from '@/app/(learning)/dashboard/notebook/NotebookPageClient';
import { NOTEBOOK_KEY_PREFIX } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { notebookEntries, teachBackEntryId, type NotebookEntry } from '@/lib/learner-store/repositories/notebook';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const mocks = vi.hoisted(() => ({
  aiTutor: false,
  downloadText: vi.fn((..._args: [string, string, string?]) => true),
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

vi.mock('@/lib/download', () => ({
  downloadText: mocks.downloadText,
  downloadBlob: vi.fn(() => true),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound() must not be called');
  },
  usePathname: () => '/dashboard/notebook',
}));

vi.mock('@/lib/persistence/target', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/persistence/target')>();
  return {
    ...actual,
    useServerFeature: (feature: Parameters<typeof actual.useServerFeature>[0]) =>
      (feature === 'aiTutor' && mocks.aiTutor) || actual.useServerFeature(feature),
  };
});

const UVM_LESSON = '/curriculum/T2_Intermediate/I-UVM-2A_Components_and_Phasing/index';
const TLM_LESSON = '/curriculum/T2_Intermediate/I-UVM-4_TLM/index';
const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date(2026, 9, 10, 9, 0).getTime();

function seed(entry: NotebookEntry): NotebookEntry {
  window.localStorage.setItem(`${NOTEBOOK_KEY_PREFIX}${entry.id}`, JSON.stringify({ v: 1, data: entry }));
  return entry;
}

function teachBack(lessonPath: string, lessonTitle: string, body: string, updatedAt: number): NotebookEntry {
  return {
    id: teachBackEntryId(lessonPath),
    kind: 'teach-back',
    lessonPath,
    lessonTitle,
    title: lessonTitle,
    body,
    createdAt: updatedAt - DAY,
    updatedAt,
  };
}

function note(id: string, title: string, body: string, updatedAt: number): NotebookEntry {
  return { id, kind: 'note', title, body, createdAt: updatedAt, updatedAt };
}

function seedThree() {
  seed(teachBack(UVM_LESSON, 'UVM phases', 'build_phase runs top-down; connect_phase bottom-up.', BASE));
  seed(note('note-fifo', 'TLM FIFO', 'uvm_tlm_analysis_fifo buffers transactions.', BASE + 2 * DAY));
  seed(teachBack(TLM_LESSON, 'TLM ports', 'A port calls an implementation through an export.', BASE + DAY));
}

const entriesRegion = () => screen.getByRole('region', { name: 'Entries' });
const listedTitles = () =>
  within(entriesRegion())
    .queryAllByRole('listitem')
    .map((item) => within(item).getAllByRole('button')[0].textContent);
const openEntry = (title: string) => fireEvent.click(within(entriesRegion()).getByRole('button', { name: title }));
const notebookWrites = (setItem: ReturnType<typeof vi.spyOn>) =>
  setItem.mock.calls.filter(([key]) => String(key).startsWith(NOTEBOOK_KEY_PREFIX));

describe('/dashboard/notebook', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    window.localStorage.clear();
    mocks.aiTutor = false;
    mocks.downloadText.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  describe('the static page shell', () => {
    it('renders without a feature gate, with the h1 and the learner navigation', () => {
      seedThree();
      const html = renderToStaticMarkup(<NotebookPage />);

      expect(metadata.title).toBe('Notebook');
      expect(html).toMatch(/<h1[^>]*>Notebook<\/h1>/);
      expect(html).toMatch(/<nav aria-label="Your learning"/);
      const notebookLink = /<a [^>]*>Notebook<\/a>/.exec(html)?.[0] ?? '';
      expect(notebookLink).toContain('href="/dashboard/notebook"');
      expect(notebookLink).toContain('aria-current="page"');
      // Nothing is read from storage during the server render.
      expect(html).toContain('Loading the entries saved in this browser');
      expect(html).not.toContain('TLM FIFO');
    });
  });

  it('shows the empty state with a link to the curriculum', () => {
    render(<NotebookPageClient />);

    expect(screen.getByText("Explanations you save in a lesson's “Teach it back” section appear here.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(screen.getByRole('button', { name: 'Download as Markdown' })).toBeDisabled();
    expect(screen.getByText('Stored only in this browser')).toBeInTheDocument();
    expect(screen.getByText('0 of 300 entries · up to 8,000 characters each')).toBeInTheDocument();
  });

  it('lists seeded entries newest first, with lesson links to Teach it back', () => {
    seedThree();
    render(<NotebookPageClient />);

    expect(listedTitles()).toEqual(['TLM FIFO', 'TLM ports', 'UVM phases']);
    expect(within(entriesRegion()).getByRole('link', { name: 'UVM phases' })).toHaveAttribute(
      'href',
      `${UVM_LESSON}#teach-it-back`,
    );
    expect(within(entriesRegion()).getByRole('link', { name: 'TLM ports' })).toHaveAttribute('href', `${TLM_LESSON}#teach-it-back`);
    expect(screen.getByText('Choose an entry to read or edit it, or add a new note.')).toBeInTheDocument();
  });

  it('searches titles, bodies and lesson titles', async () => {
    seedThree();
    const user = userEvent.setup();
    render(<NotebookPageClient />);
    const search = screen.getByRole('searchbox', { name: 'Search notes' });

    await user.type(search, 'fifo');
    expect(listedTitles()).toEqual(['TLM FIFO']);

    await user.clear(search);
    await user.type(search, 'TOP-DOWN');
    expect(listedTitles()).toEqual(['UVM phases']);

    await user.clear(search);
    await user.type(search, 'ports');
    expect(listedTitles()).toEqual(['TLM ports']);

    await user.clear(search);
    await user.type(search, 'scoreboard');
    expect(listedTitles()).toEqual([]);
    expect(screen.getByText('No entries match “scoreboard”.')).toBeInTheDocument();
  });

  it('autosaves an edit after the debounce, and only after an edit', async () => {
    seedThree();
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { unmount } = render(<NotebookPageClient />);
    openEntry('UVM phases');

    const body = screen.getByRole('textbox', { name: 'Explanation' });
    expect(body).toHaveValue('build_phase runs top-down; connect_phase bottom-up.');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    expect(notebookWrites(setItem)).toHaveLength(0);

    fireEvent.change(body, { target: { value: 'build_phase is top-down.' } });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(notebookWrites(setItem)).toHaveLength(0);

    await waitFor(() => expect(screen.getByText('Saved in this browser')).toBeInTheDocument());
    expect(notebookEntries.get(teachBackEntryId(UVM_LESSON))?.body).toBe('build_phase is top-down.');
    expect(notebookWrites(setItem)).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Phases, rewritten' } });
    unmount();
    // Closing the editor saves the pending edit straight away.
    expect(notebookEntries.get(teachBackEntryId(UVM_LESSON))?.title).toBe('Phases, rewritten');

    render(<NotebookPageClient />);
    expect(listedTitles()[0]).toBe('Phases, rewritten');
    openEntry('Phases, rewritten');
    expect(screen.getByRole('textbox', { name: 'Explanation' })).toHaveValue('build_phase is top-down.');
  });

  it('shows a visible message when an edit is over the entry limit', async () => {
    seedThree();
    render(<NotebookPageClient />);
    openEntry('TLM FIFO');

    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'y'.repeat(8_050) } });

    expect(
      await screen.findByText('Not saved: an entry can hold up to 8,000 characters and this one has 8,050. Shorten it and try again.'),
    ).toBeInTheDocument();
    expect(notebookEntries.get('note-fifo')?.body).toBe('uvm_tlm_analysis_fifo buffers transactions.');
  });

  it('deletes an entry only after a two-step inline confirm', async () => {
    seedThree();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<NotebookPageClient />);
    openEntry('TLM FIFO');

    fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(screen.getByText("Delete “TLM FIFO” from this browser? This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(notebookEntries.get('note-fifo')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete entry' })).toHaveFocus();
    expect(notebookEntries.get('note-fifo')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete entry' }));

    expect(notebookEntries.get('note-fifo')).toBeNull();
    expect(listedTitles()).toEqual(['TLM ports', 'UVM phases']);
    expect(screen.getByText('Deleted “TLM FIFO”.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entries' })).toHaveFocus();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not bring a deleted entry back from a pending edit', async () => {
    seedThree();
    render(<NotebookPageClient />);
    openEntry('TLM FIFO');
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'typed just before deleting' } });

    fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete entry' }));
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(notebookEntries.get('note-fifo')).toBeNull();
  });

  it('opens a new note with its title focused, and stores it on the first edit', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    render(<NotebookPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));

    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveFocus();
    expect(screen.getByText('New note opened. It saves in this browser as you type.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Untitled note' })).toBeInTheDocument();
    // Nothing is stored until the learner types.
    expect(notebookWrites(setItem)).toHaveLength(0);
    expect(notebookEntries.list()).toHaveLength(0);

    fireEvent.change(title, { target: { value: 'Clocking blocks' } });
    await waitFor(() => expect(notebookEntries.list()).toHaveLength(1));
    expect(notebookEntries.list()[0].value).toMatchObject({ kind: 'note', title: 'Clocking blocks', body: '' });
    expect(listedTitles()).toEqual(['Clocking blocks']);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();

    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'Sample on the clock edge.' } });
    await waitFor(() => expect(notebookEntries.list()[0].value.body).toBe('Sample on the clock edge.'));
    expect(notebookEntries.list()).toHaveLength(1);
  });

  it('leaves no blank entries behind from untouched new notes', async () => {
    seedThree();
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { unmount } = render(<NotebookPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    openEntry('TLM FIFO');
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    // Typed, then erased before the autosave: still nothing worth keeping.
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'x' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '' } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
    expect(screen.getByText('Changes save automatically in this browser.')).toBeInTheDocument();
    unmount();

    expect(notebookWrites(setItem)).toHaveLength(0);
    expect(notebookEntries.list()).toHaveLength(3);
  });

  it('stores a typed new note when another one is opened before the autosave', () => {
    render(<NotebookPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'Typed, then New note again.' } });

    fireEvent.click(screen.getByRole('button', { name: 'New note' }));

    expect(notebookEntries.list().map((item) => item.value.body)).toEqual(['Typed, then New note again.']);
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('');
  });

  it('explains why a new note was not stored when the notebook filled up meanwhile', async () => {
    for (let index = 0; index < 299; index += 1) {
      seed(note(`note-${String(index).padStart(3, '0')}`, `Note ${index}`, '', BASE + index));
    }
    render(<NotebookPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    // Another tab takes the last free entry.
    seed(note('note-other-tab', 'From another tab', '', BASE + 400));

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'One too many' } });

    expect(
      await screen.findByText(
        'Not saved: the notebook in this browser holds the most entries it can (300). Delete entries you no longer need in your notebook, then try again.',
      ),
    ).toBeInTheDocument();
  });

  it('downloads the notebook as Markdown, newest first', () => {
    seedThree();
    render(<NotebookPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Download as Markdown' }));

    expect(mocks.downloadText).toHaveBeenCalledTimes(1);
    const [markdown, fileName, mime] = mocks.downloadText.mock.calls[0];
    expect(fileName).toMatch(/^sv-uvm-guide-notebook-\d{4}-\d{2}-\d{2}\.md$/);
    expect(mime).toBe('text/markdown');
    expect(markdown).toContain('3 entries.');
    expect(markdown.indexOf('## TLM FIFO')).toBeLessThan(markdown.indexOf('## TLM ports'));
    expect(markdown.indexOf('## TLM ports')).toBeLessThan(markdown.indexOf('## UVM phases'));
    expect(markdown).toContain(`- Lesson: [UVM phases](${window.location.origin}${UVM_LESSON}#teach-it-back)`);
    expect(markdown).toContain('```text\nuvm_tlm_analysis_fifo buffers transactions.\n```');
    expect(screen.getByText(`Downloaded ${fileName}.`)).toBeInTheDocument();
  });

  it('offers no AI feedback while the AI tutor is off', () => {
    seedThree();
    render(<NotebookPageClient />);
    openEntry('UVM phases');

    expect(screen.queryByRole('button', { name: /AI feedback/i })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers AI feedback in the editor when the AI tutor is on and a learner is signed in', () => {
    mocks.aiTutor = true;
    seedThree();
    render(<NotebookPageClient />);
    openEntry('UVM phases');

    expect(screen.getByRole('button', { name: 'Get AI feedback' })).toBeEnabled();
  });

  it('renders learner-written HTML as plain text', () => {
    seed(note('note-html', '<img src=x onerror="alert(1)">', '<script>alert(1)</script>\n<b>bold</b>', BASE));
    const { container } = render(<NotebookPageClient />);

    expect(within(entriesRegion()).getByRole('button', { name: '<img src=x onerror="alert(1)">' })).toBeInTheDocument();
    expect(container.querySelector('img, script, b')).toBeNull();
    openEntry('<img src=x onerror="alert(1)">');
    expect(screen.getByRole('heading', { name: '<img src=x onerror="alert(1)">' })).toBeInTheDocument();
    expect(container.querySelector('img, script, b')).toBeNull();
    const preview = within(entriesRegion()).getByText(/<script>alert\(1\)<\/script>/);
    expect(preview).toHaveClass('whitespace-pre-wrap');
  });

  it('explains the entry limit and disables New note at it', () => {
    for (let index = 0; index < 300; index += 1) {
      seed(note(`note-${String(index).padStart(3, '0')}`, `Note ${index}`, '', BASE + index));
    }
    render(<NotebookPageClient />);

    expect(screen.getByRole('button', { name: 'New note' })).toBeDisabled();
    expect(
      screen.getByText('Your notebook holds the most entries it can (300). Delete entries you no longer need to add new ones.'),
    ).toBeInTheDocument();
  });
});

describe('notebook list helpers', () => {
  it('sorts newest updatedAt first with a stable tie-break', () => {
    const a = note('a', 'A', '', 1);
    const b = note('b', 'B', '', 2);
    const c = note('c', 'C', '', 2);
    expect(sortNotebookEntries([a, c, b]).map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('matches title, body and lesson title, ignoring case and surrounding spaces', () => {
    const entry = teachBack(UVM_LESSON, 'UVM Phases', 'Run phase is a task.', 1);
    expect(matchesNotebookQuery(entry, '  phases ')).toBe(true);
    expect(matchesNotebookQuery(entry, 'TASK')).toBe(true);
    expect(matchesNotebookQuery({ ...entry, title: 'Renamed' }, 'phases')).toBe(true);
    expect(matchesNotebookQuery(entry, 'factory')).toBe(false);
    expect(matchesNotebookQuery(entry, '')).toBe(true);
  });
});
