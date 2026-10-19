/**
 * The notebook: one key per entry, 'sv-uvm-guide:notebook:<entryId>', so a
 * full quota or a corrupt value affects one note rather than all of them.
 *
 * Titles and bodies are learner-authored text: always render them as plain
 * text, never as MDX, HTML or through dangerouslySetInnerHTML.
 */
import { createLearnerId, fnv1a32Hex, NOTEBOOK_KEY_PREFIX } from '../keys';
import {
  defineKeyedRecord,
  isNonEmptyString,
  isPlainObject,
  timestampOr,
  type WriteOutcome,
} from '../record';
import { safeStorage } from '../storage';

export const NOTEBOOK_TITLE_MAX_CHARS = 200;
export const NOTEBOOK_BODY_MAX_CHARS = 8_000;
export const NOTEBOOK_MAX_ENTRIES = 300;
/** Most characters all notebook entries together may hold (stored values). */
export const NOTEBOOK_TOTAL_MAX_CHARS = 600_000;
/** Longest serialized entry: a full title and body plus metadata and JSON escaping. */
export const NOTEBOOK_ENTRY_MAX_CHARS = 20_000;

export type NotebookEntryKind = 'teach-back' | 'note';

export interface NotebookEntry {
  id: string;
  kind: NotebookEntryKind;
  /** Canonical lesson pathname, '/curriculum/<Tier>/<Module>/<lesson>'. */
  lessonPath?: string;
  lessonTitle?: string;
  title: string;
  body: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

export function parseNotebookEntry(data: unknown, id?: string): NotebookEntry | null {
  if (!isPlainObject(data)) return null;
  if (!isNonEmptyString(data.id) || (id !== undefined && data.id !== id)) return null;
  if (data.kind !== 'teach-back' && data.kind !== 'note') return null;
  if (typeof data.body !== 'string' || data.body.length > NOTEBOOK_BODY_MAX_CHARS) return null;
  const title = typeof data.title === 'string' ? data.title.slice(0, NOTEBOOK_TITLE_MAX_CHARS) : '';
  const createdAt = timestampOr(data.createdAt, 0);
  const entry: NotebookEntry = {
    id: data.id,
    kind: data.kind,
    title,
    body: data.body,
    createdAt,
    updatedAt: timestampOr(data.updatedAt, createdAt),
  };
  if (isNonEmptyString(data.lessonPath)) entry.lessonPath = data.lessonPath;
  if (typeof data.lessonTitle === 'string') entry.lessonTitle = data.lessonTitle.slice(0, NOTEBOOK_TITLE_MAX_CHARS);
  return entry;
}

/** The entry edited most recently wins. */
export function mergeNotebookEntry(local: NotebookEntry, incoming: NotebookEntry): NotebookEntry {
  return incoming.updatedAt > local.updatedAt ? incoming : local;
}

export const notebookEntries = defineKeyedRecord<NotebookEntry>({
  prefix: NOTEBOOK_KEY_PREFIX,
  version: 1,
  parse: (data, id) => parseNotebookEntry(data, id),
  maxChars: NOTEBOOK_ENTRY_MAX_CHARS,
  merge: mergeNotebookEntry,
});

/**
 * The id of a lesson's teach-back entry: deterministic, so the widget finds
 * its entry again, and key-safe (lowercase letters, digits and hyphens).
 */
export function teachBackEntryId(lessonPath: string): string {
  const slug = lessonPath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
    .replace(/^-+/, '');
  return `teach-back-${slug ? `${slug}-` : ''}${fnv1a32Hex(lessonPath)}`;
}

/** Characters all stored entries take, optionally leaving one entry out. */
export function notebookTotalChars(exceptId?: string): number {
  const exceptKey = exceptId !== undefined ? notebookEntries.keyFor(exceptId) : null;
  let total = 0;
  for (const key of safeStorage.keys(NOTEBOOK_KEY_PREFIX)) {
    if (key === exceptKey) continue;
    total += safeStorage.get(key)?.length ?? 0;
  }
  return total;
}

/** How many notebook entries this browser holds (NOTEBOOK_MAX_ENTRIES is the cap). */
export function notebookEntryCount(): number {
  return safeStorage.keys(NOTEBOOK_KEY_PREFIX).filter((key) => key.length > NOTEBOOK_KEY_PREFIX.length).length;
}

function withinTextLimits(title: string, body: string): boolean {
  return title.length <= NOTEBOOK_TITLE_MAX_CHARS && body.length <= NOTEBOOK_BODY_MAX_CHARS;
}

function fitsTotal(entry: NotebookEntry): boolean {
  const serialized = JSON.stringify({ v: 1, data: entry });
  return notebookTotalChars(entry.id) + serialized.length <= NOTEBOOK_TOTAL_MAX_CHARS;
}

/**
 * Applies `build` to a fresh read of the entry (safe across tabs) and writes
 * the result after checking every notebook limit: 'too-large' past a limit,
 * and nothing is written when `build` returns the current entry.
 */
function writeEntry(id: string, build: (current: NotebookEntry | null) => NotebookEntry): WriteOutcome {
  let refused = false;
  const outcome = notebookEntries.update(id, (current) => {
    const next = build(current);
    if (next === current) return current;
    const fits =
      withinTextLimits(next.title, next.body) &&
      (current !== null || notebookEntryCount() < NOTEBOOK_MAX_ENTRIES) &&
      fitsTotal(next);
    if (!fits) {
      refused = true;
      return null;
    }
    return next;
  });
  return refused ? 'too-large' : outcome;
}

function sameText(entry: NotebookEntry, title: string, body: string): boolean {
  return entry.title === title && entry.body === body;
}

export interface TeachBackInput {
  lessonPath: string;
  lessonTitle: string;
  body: string;
  /**
   * Replaces the entry's title. When omitted, an existing entry keeps its title
   * (the learner may have renamed it in the notebook); a new entry, or one with
   * an empty title, gets the lesson title (cut to NOTEBOOK_TITLE_MAX_CHARS).
   */
  title?: string;
  now?: number;
}

/** Creates or updates a lesson's teach-back entry. Writes nothing when the text is unchanged. */
export function upsertTeachBack({ lessonPath, lessonTitle, body, title, now = Date.now() }: TeachBackInput): WriteOutcome {
  const id = teachBackEntryId(lessonPath);
  const entryLessonTitle = lessonTitle.slice(0, NOTEBOOK_TITLE_MAX_CHARS);
  return writeEntry(id, (current) => {
    // Decided on the fresh read, so a title changed in another tab is kept too.
    const entryTitle = title ?? (current?.title || entryLessonTitle);
    if (current) {
      if (sameText(current, entryTitle, body) && current.lessonTitle === entryLessonTitle && current.lessonPath === lessonPath) {
        return current;
      }
      return { ...current, title: entryTitle, body, lessonPath, lessonTitle: entryLessonTitle, updatedAt: now };
    }
    return {
      id,
      kind: 'teach-back',
      lessonPath,
      lessonTitle: entryLessonTitle,
      title: entryTitle,
      body,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export interface NoteInput {
  title: string;
  body: string;
  lessonPath?: string;
  lessonTitle?: string;
  now?: number;
}

/** Creates a free-form note. `id` is set only when the outcome is 'saved' or 'memory-only'. */
export function createNote({ title, body, lessonPath, lessonTitle, now = Date.now() }: NoteInput): {
  outcome: WriteOutcome;
  id: string | null;
} {
  const id = createLearnerId();
  const outcome = writeEntry(id, () => {
    const entry: NotebookEntry = { id, kind: 'note', title, body, createdAt: now, updatedAt: now };
    if (lessonPath) entry.lessonPath = lessonPath;
    if (lessonTitle !== undefined) entry.lessonTitle = lessonTitle.slice(0, NOTEBOOK_TITLE_MAX_CHARS);
    return entry;
  });
  return { outcome, id: outcome === 'saved' || outcome === 'memory-only' ? id : null };
}

/**
 * Changes an entry's title and/or body on a fresh read. 'too-large' past a
 * limit; nothing is written when the text is unchanged. When the entry is gone
 * (deleted in another tab, or unreadable) the edit is kept by saving it again
 * under the same id, so typed text is never dropped.
 */
export function updateEntry(
  id: string,
  patch: { title?: string; body?: string },
  now: number = Date.now(),
): WriteOutcome {
  return writeEntry(id, (current) => {
    if (!current) {
      return {
        id,
        kind: id.startsWith('teach-back-') ? 'teach-back' : 'note',
        title: patch.title ?? '',
        body: patch.body ?? '',
        createdAt: now,
        updatedAt: now,
      };
    }
    const title = patch.title ?? current.title;
    const body = patch.body ?? current.body;
    if (sameText(current, title, body)) return current;
    return { ...current, title, body, updatedAt: now };
  });
}

export function removeEntry(id: string): void {
  notebookEntries.remove(id);
}
