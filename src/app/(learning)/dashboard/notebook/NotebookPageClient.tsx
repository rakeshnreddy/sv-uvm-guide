"use client";

import Link from 'next/link';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { Button } from '@/components/ui/Button';
import { AiFeedbackPanel, notebookWriteErrorMessage } from '@/components/widgets/FeynmanPromptWidget';
import { downloadText } from '@/lib/download';
import { createLearnerId } from '@/lib/learner-store/keys';
import { useHydrated, useKeyedRecordList } from '@/lib/learner-store/react';
import { writeOutcomeMessage, type WriteOutcome } from '@/lib/learner-store/record';
import { recordActivity } from '@/lib/learner-store/repositories/activity';
import {
  NOTEBOOK_BODY_MAX_CHARS,
  NOTEBOOK_MAX_ENTRIES,
  NOTEBOOK_TITLE_MAX_CHARS,
  NOTEBOOK_TOTAL_MAX_CHARS,
  notebookEntries,
  removeEntry,
  updateEntry,
  type NotebookEntry,
} from '@/lib/learner-store/repositories/notebook';
import {
  entriesToMarkdown,
  NOTEBOOK_KIND_LABELS,
  notebookEntryLessonHref,
  notebookEntryTitle,
  notebookMarkdownFileName,
  UNTITLED_NOTE,
} from '@/lib/notebook-export';
import { cn } from '@/lib/utils';

/** Edits are saved this long after the learner stops typing. */
export const NOTEBOOK_AUTOSAVE_DELAY_MS = 600;
/** From this share of NOTEBOOK_TOTAL_MAX_CHARS the page warns that the notebook is nearly full. */
const NEARLY_FULL_SHARE = 0.9;
const PREVIEW_CHARS = 160;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const textLink = cn('rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80', focusRing);
const panelClass = 'min-w-0 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6';
const fieldClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const errorText = 'font-medium text-red-700 dark:text-red-300';
const warningText = 'font-medium text-amber-800 dark:text-amber-200';

const formatCount = (value: number) => value.toLocaleString('en-US');

/** Rendered only after hydration (the list is empty before), so the learner's locale is safe here. */
function formatDateTime(ms: number): string {
  if (!Number.isFinite(new Date(ms).getTime())) return 'an unknown time';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

/** Newest updatedAt first; ties by id, so the order is stable. */
export function sortNotebookEntries(entries: readonly NotebookEntry[]): NotebookEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/** Case-insensitive match on the title, the body and the lesson title. */
export function matchesNotebookQuery(entry: NotebookEntry, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [entry.title, entry.body, entry.lessonTitle ?? ''].some((text) => text.toLocaleLowerCase().includes(needle));
}

/** Characters the entries take in storage (the same measure as NOTEBOOK_TOTAL_MAX_CHARS). */
function storedChars(entries: readonly NotebookEntry[]): number {
  return entries.reduce((total, entry) => total + JSON.stringify({ v: 1, data: entry }).length, 0);
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saved'; outcome: 'saved' | 'memory-only' }
  | { kind: 'error'; message: string };

interface NoteEditorProps {
  entry: NotebookEntry;
  titleInputRef: React.RefObject<HTMLInputElement>;
  onDeleted: (title: string) => void;
}

/**
 * Edits one entry. Typing saves NOTEBOOK_AUTOSAVE_DELAY_MS after the last
 * keystroke, on a fresh read of the entry; nothing is written until the
 * learner edits. Pending edits are saved when the editor closes or the page
 * is hidden. While there are no unsaved edits, the fields follow the stored
 * entry (another tab, or the lesson's Teach it back).
 *
 * A new note is not stored yet: the first save creates it (updateEntry writes
 * a missing entry under its id), and a new note left with an empty title and
 * text is never written, so an untouched "New note" leaves nothing behind.
 */
function NoteEditor({ entry, titleInputRef, onDeleted }: NoteEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const latest = useRef({ title: entry.title, body: entry.body });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityRecorded = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;
  const bodyCountId = `${baseId}-body-count`;
  const confirmId = `${baseId}-confirm`;
  const entryId = entry.id;

  useEffect(() => {
    if (dirty.current) return;
    latest.current = { title: entry.title, body: entry.body };
    setTitle(entry.title);
    setBody(entry.body);
  }, [entry.title, entry.body]);

  const save = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    const { title: nextTitle, body: nextBody } = latest.current;
    if (!nextTitle.trim() && !nextBody.trim() && notebookEntries.get(entryId) === null) {
      // A new note (or one deleted elsewhere) with nothing in it: there is nothing to keep.
      dirty.current = false;
      setSaveState({ kind: 'idle' });
      return;
    }
    const outcome: WriteOutcome = updateEntry(entryId, { title: nextTitle, body: nextBody });
    if (outcome === 'saved' || outcome === 'memory-only') {
      dirty.current = false;
      if (!activityRecorded.current) {
        activityRecorded.current = true;
        recordActivity('note');
      }
      setSaveState({ kind: 'saved', outcome });
      return;
    }
    // Still dirty: the next edit, or closing the editor, tries again.
    setSaveState({
      kind: 'error',
      message: notebookWriteErrorMessage(outcome, { entryId, title: nextTitle, body: nextBody }),
    });
  }, [entryId]);

  // Save pending edits when the editor closes or the page is hidden.
  useEffect(() => {
    const flush = () => save();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [save]);

  // The confirm step takes focus on Cancel; cancelling returns it to "Delete entry".
  useEffect(() => {
    if (confirmingDelete) {
      cancelDeleteRef.current?.focus();
    } else if (restoreDeleteFocus.current) {
      restoreDeleteFocus.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [confirmingDelete]);

  const scheduleSave = (next: { title: string; body: string }) => {
    latest.current = next;
    dirty.current = true;
    setSaveState({ kind: 'pending' });
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(save, NOTEBOOK_AUTOSAVE_DELAY_MS);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setTitle(value);
    scheduleSave({ title: value, body: latest.current.body });
  };

  const handleBodyChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setBody(value);
    scheduleSave({ title: latest.current.title, body: value });
  };

  const cancelDelete = () => {
    restoreDeleteFocus.current = true;
    setConfirmingDelete(false);
  };

  const confirmDelete = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    dirty.current = false;
    removeEntry(entryId);
    onDeleted(notebookEntryTitle({ title }));
  };

  const lessonHref = notebookEntryLessonHref(entry);
  const bodyLabel = entry.kind === 'teach-back' ? 'Explanation' : 'Note text';
  const overLimit = body.length > NOTEBOOK_BODY_MAX_CHARS;

  return (
    <div aria-labelledby={headingId} role="region" className={panelClass}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {NOTEBOOK_KIND_LABELS[entry.kind]}
      </p>
      <h2 id={headingId} className="mt-1 text-xl font-semibold text-foreground [overflow-wrap:anywhere]">
        {title.trim() || UNTITLED_NOTE}
      </h2>
      {lessonHref ? (
        <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          From the lesson{' '}
          <Link href={lessonHref} className={textLink}>
            {entry.lessonTitle?.trim() || entry.lessonPath}
          </Link>
        </p>
      ) : null}

      <label htmlFor={titleId} className="mt-5 block text-sm font-semibold text-foreground">
        Title
      </label>
      <input
        id={titleId}
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={handleTitleChange}
        maxLength={NOTEBOOK_TITLE_MAX_CHARS}
        placeholder={UNTITLED_NOTE}
        className={cn(fieldClass, 'mt-2 h-10')}
      />

      <label htmlFor={bodyId} className="mt-4 block text-sm font-semibold text-foreground">
        {bodyLabel}
      </label>
      <textarea
        id={bodyId}
        value={body}
        onChange={handleBodyChange}
        aria-describedby={bodyCountId}
        rows={12}
        className={cn(fieldClass, 'mt-2 min-h-[12rem] resize-y whitespace-pre-wrap')}
      />
      <p id={bodyCountId} className={cn('mt-1 text-right text-xs', overLimit ? errorText : 'text-muted-foreground')}>
        {formatCount(body.length)} / {formatCount(NOTEBOOK_BODY_MAX_CHARS)} characters
      </p>

      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm text-muted-foreground">
        {saveState.kind === 'idle' ? 'Changes save automatically in this browser.' : null}
        {saveState.kind === 'pending' ? 'Saving…' : null}
        {saveState.kind === 'saved' && saveState.outcome === 'saved' ? 'Saved in this browser' : null}
        {saveState.kind === 'saved' && saveState.outcome === 'memory-only' ? (
          <span className={warningText}>{writeOutcomeMessage('memory-only')}</span>
        ) : null}
        {saveState.kind === 'error' ? <span className={errorText}>{saveState.message}</span> : null}
      </p>

      <AiFeedbackPanel topic={entry.lessonTitle?.trim() || title.trim() || UNTITLED_NOTE} explanation={body} className="mt-4" />

      <div className="mt-6 border-t border-border pt-4">
        {confirmingDelete ? (
          <div role="group" aria-labelledby={confirmId} className="flex flex-col gap-3">
            <p id={confirmId} className="text-sm font-medium text-foreground">
              Delete “{title.trim() || UNTITLED_NOTE}” from this browser? This can't be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={confirmDelete}
                className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
              >
                Yes, delete entry
              </Button>
              <Button ref={cancelDeleteRef} type="button" size="sm" variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button ref={deleteButtonRef} type="button" size="sm" variant="outline" onClick={() => setConfirmingDelete(true)}>
            Delete entry
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The notebook: Teach it back explanations (one per lesson) and free notes,
 * stored only in this browser. Every title and body is learner-authored text
 * and is rendered as plain text.
 */
export default function NotebookPageClient() {
  const hydrated = useHydrated();
  const stored = useKeyedRecordList(notebookEntries);
  const entries = useMemo(() => sortNotebookEntries(stored.map((item) => item.value)), [stored]);
  const totalChars = useMemo(() => storedChars(entries), [entries]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** A note opened with "New note" and not stored yet; its first edit stores it. */
  const [newNote, setNewNote] = useState<NotebookEntry | null>(null);
  const [pageStatus, setPageStatus] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const focusEditor = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const searchId = useId();
  const listHeadingId = useId();

  const visible = useMemo(() => entries.filter((entry) => matchesNotebookQuery(entry, query)), [entries, query]);
  const selected = selectedId
    ? entries.find((entry) => entry.id === selectedId) ?? (newNote?.id === selectedId ? newNote : null)
    : null;
  const atEntryLimit = entries.length >= NOTEBOOK_MAX_ENTRIES;
  const nearlyFull = totalChars >= NOTEBOOK_TOTAL_MAX_CHARS * NEARLY_FULL_SHARE;

  useEffect(() => {
    if (focusEditor.current && selected) {
      focusEditor.current = false;
      titleInputRef.current?.focus();
    }
  }, [selected]);

  /** Opens an entry in the editor and moves focus to its title (the editor sits below the list on narrow screens). */
  const openEntry = (id: string) => {
    if (id === selectedId) {
      titleInputRef.current?.focus();
      return;
    }
    focusEditor.current = true;
    setSelectedId(id);
  };

  /** Opens an empty note without storing it: nothing is written until the learner types. */
  const handleNewNote = () => {
    const now = Date.now();
    const note: NotebookEntry = { id: createLearnerId(), kind: 'note', title: '', body: '', createdAt: now, updatedAt: now };
    setNewNote(note);
    setQuery('');
    openEntry(note.id);
    setPageStatus({ text: 'New note opened. It saves in this browser as you type.', tone: 'info' });
  };

  const handleDownload = () => {
    const now = Date.now();
    const fileName = notebookMarkdownFileName(now);
    const markdown = entriesToMarkdown(entries, { origin: window.location.origin, now });
    const started = downloadText(markdown, fileName, 'text/markdown');
    setPageStatus(
      started
        ? { text: `Downloaded ${fileName}.`, tone: 'info' }
        : { text: "This browser couldn't start the download.", tone: 'error' },
    );
  };

  const handleDeleted = (title: string) => {
    setSelectedId(null);
    setNewNote(null);
    setPageStatus({ text: `Deleted “${title}”.`, tone: 'info' });
    listHeadingRef.current?.focus();
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleNewNote} disabled={!hydrated || atEntryLimit}>
            New note
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload} disabled={entries.length === 0}>
            Download as Markdown
          </Button>
        </div>
        <StorageStatusNote savedLabel="Stored only in this browser" />
        <p role="status" aria-live="polite" className="text-sm">
          {pageStatus ? (
            <span className={pageStatus.tone === 'error' ? errorText : 'text-foreground'}>{pageStatus.text}</span>
          ) : null}
        </p>
        {hydrated && (atEntryLimit || nearlyFull) ? (
          <p className={cn('text-sm', warningText)}>
            {atEntryLimit
              ? `Your notebook holds the most entries it can (${formatCount(NOTEBOOK_MAX_ENTRIES)}). Delete entries you no longer need to add new ones.`
              : `Your notebook is nearly full (it can hold ${formatCount(NOTEBOOK_TOTAL_MAX_CHARS)} characters in this browser). Download it as Markdown, then delete entries you no longer need.`}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div aria-labelledby={listHeadingId} role="region" className={panelClass}>
          <h2
            id={listHeadingId}
            ref={listHeadingRef}
            tabIndex={-1}
            className={cn('rounded-sm text-xl font-semibold text-foreground', focusRing)}
          >
            Entries
          </h2>
          {hydrated ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCount(entries.length)} of {formatCount(NOTEBOOK_MAX_ENTRIES)} entries · up to{' '}
              {formatCount(NOTEBOOK_BODY_MAX_CHARS)} characters each
            </p>
          ) : null}

          <label htmlFor={searchId} className="mt-4 block text-sm font-semibold text-foreground">
            Search notes
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, text or lesson"
            className={cn(fieldClass, 'mt-2 h-10')}
          />

          {!hydrated ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading the entries saved in this browser…</p>
          ) : entries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p>Explanations you save in a lesson's “Teach it back” section appear here.</p>
              <p className="mt-2">
                <Link href="/curriculum" className={textLink}>
                  Browse the curriculum
                </Link>
              </p>
            </div>
          ) : visible.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No entries match “{query.trim()}”.</p>
          ) : (
            <ul aria-labelledby={listHeadingId} className="mt-4 flex flex-col gap-3">
              {visible.map((entry) => {
                const isSelected = entry.id === selectedId;
                const lessonHref = notebookEntryLessonHref(entry);
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      'relative min-w-0 rounded-2xl border p-4 transition-colors motion-reduce:transition-none',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openEntry(entry.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className="block w-full rounded-sm text-left font-semibold text-foreground [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
                    >
                      {notebookEntryTitle(entry)}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {NOTEBOOK_KIND_LABELS[entry.kind]} · Updated {formatDateTime(entry.updatedAt)}
                    </p>
                    {entry.body.trim() ? (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {entry.body.slice(0, PREVIEW_CHARS)}
                      </p>
                    ) : null}
                    {lessonHref ? (
                      <p className="relative z-10 mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        Lesson:{' '}
                        <Link href={lessonHref} className={textLink}>
                          {entry.lessonTitle?.trim() || entry.lessonPath}
                        </Link>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <NoteEditor key={selected.id} entry={selected} titleInputRef={titleInputRef} onDeleted={handleDeleted} />
        ) : hydrated && entries.length > 0 ? (
          <div className={cn(panelClass, 'text-sm text-muted-foreground')}>
            <p>Choose an entry to read or edit it, or add a new note.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
