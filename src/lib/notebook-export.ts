/**
 * The notebook as a Markdown file ("Download as Markdown" on /dashboard/notebook).
 *
 * Pure: no storage, no DOM. Titles, lesson titles and bodies are learner-authored
 * (or imported from a backup), so they are treated as untrusted text:
 * - Titles and lesson titles are written on one line and escaped for an
 *   inline context: Markdown control characters are backslash-escaped and &,
 *   < and > become entities, so they cannot add headings, lists, links,
 *   images, code or raw HTML.
 * - Bodies are always fenced in a code block whose fence is longer than any
 *   backtick run inside, so they come out verbatim (line breaks included) and
 *   nothing in them is read as Markdown or HTML.
 * - Lesson links are written only for site paths ('/curriculum/...'), never
 *   for other schemes.
 */
import type { NotebookEntry } from '@/lib/learner-store/repositories/notebook';

/** The id of a lesson's "Teach it back" heading (TEACH_BACK_SECTION.id in src/lib/curriculum/lesson-mdx.ts). */
export const TEACH_BACK_ANCHOR = 'teach-it-back';

/** Shown for an entry with no title, here and on the notebook page. */
export const UNTITLED_NOTE = 'Untitled note';

/** Labels for the two entry kinds. */
export const NOTEBOOK_KIND_LABELS: Readonly<Record<NotebookEntry['kind'], string>> = Object.freeze({
  'teach-back': 'Teach it back',
  note: 'Note',
});

const SITE_PATH = /^\/(?!\/)[A-Za-z0-9/_.~-]*$/;
const SAFE_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?$/;

/**
 * The link for an entry's lesson: '<lessonPath>#teach-it-back' for a
 * teach-back entry, the lesson itself for a note. Null when the entry has no
 * lesson or its path is not a plain site path (an imported backup could hold
 * anything).
 */
export function notebookEntryLessonHref(entry: Pick<NotebookEntry, 'kind' | 'lessonPath'>): string | null {
  const { lessonPath } = entry;
  if (!lessonPath || !SITE_PATH.test(lessonPath)) return null;
  return entry.kind === 'teach-back' ? `${lessonPath}#${TEACH_BACK_ANCHOR}` : lessonPath;
}

/** The title to show for an entry: its own title, or "Untitled note". */
export function notebookEntryTitle(entry: Pick<NotebookEntry, 'title'>): string {
  return entry.title.trim() || UNTITLED_NOTE;
}

/**
 * Escapes text for an inline Markdown context (a heading or a link label):
 * one line (so it cannot start a block such as a heading or a list), the
 * inline control characters backslash-escaped (code spans, emphasis,
 * strikethrough, links and images, and the # of a heading's closing
 * sequence), and &, < and > written as entities so no raw HTML, autolink or
 * entity gets through.
 */
export function escapeMarkdownInline(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]#~|]/g, (char) => `\\${char}`)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Wraps text in a fenced code block that it cannot close or escape: the fence
 * is one backtick longer than the longest backtick run in the text (at least
 * three).
 */
export function fenceMarkdownBlock(text: string, info = 'text'): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const body = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  return `${fence}${info}\n${body}\n${fence}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 'YYYY-MM-DD HH:MM' in the learner's local time zone. */
export function formatLocalDateTime(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 'YYYY-MM-DD' in the learner's local time zone. */
function formatLocalDate(ms: number): string {
  return formatLocalDateTime(ms).slice(0, 10);
}

export interface NotebookMarkdownOptions {
  /** The site origin, for absolute lesson links (for example 'https://example.com'). Relative links without it. */
  origin?: string;
  /** Export time, epoch ms. Defaults to now. */
  now?: number;
}

function entryToMarkdown(entry: NotebookEntry, origin: string): string {
  const lines = [`## ${escapeMarkdownInline(notebookEntryTitle(entry))}`, ''];
  const details = [`- ${NOTEBOOK_KIND_LABELS[entry.kind]}`];
  const href = notebookEntryLessonHref(entry);
  if (href) {
    const label = escapeMarkdownInline(entry.lessonTitle?.trim() || entry.lessonPath || '') || 'Lesson';
    details.push(`- Lesson: [${label}](${origin}${href})`);
  }
  details.push(`- Created: ${formatLocalDateTime(entry.createdAt)}`);
  details.push(`- Updated: ${formatLocalDateTime(entry.updatedAt)}`);
  lines.push(...details, '');
  lines.push(entry.body.trim() ? fenceMarkdownBlock(entry.body) : '*No text yet.*');
  return lines.join('\n');
}

/**
 * The entries as one Markdown document, in the order given: a level-1
 * heading, then per entry a level-2 heading with its kind, lesson link, dates
 * and fenced body.
 */
export function entriesToMarkdown(entries: readonly NotebookEntry[], options: NotebookMarkdownOptions = {}): string {
  const origin = options.origin && SAFE_ORIGIN.test(options.origin) ? options.origin : '';
  const now = options.now ?? Date.now();
  const count = entries.length === 1 ? '1 entry' : `${entries.length} entries`;
  const parts = ['# Notebook', '', `Exported on ${formatLocalDate(now)} · ${count}.`];
  for (const entry of entries) {
    parts.push('', entryToMarkdown(entry, origin));
  }
  return `${parts.join('\n')}\n`;
}

/** The download name, 'sv-uvm-guide-notebook-YYYY-MM-DD.md' (local date). */
export function notebookMarkdownFileName(now: number = Date.now()): string {
  return `sv-uvm-guide-notebook-${formatLocalDate(now)}.md`;
}
