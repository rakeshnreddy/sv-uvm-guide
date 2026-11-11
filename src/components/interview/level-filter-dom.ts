/**
 * The DOM side of the interview page: apply a level, expand or collapse the
 * questions on view, and open the question a URL hash names. Plain functions
 * over a Document, so tests run them in jsdom; the client controller wires
 * them to events.
 */
import {
  ALL_LEVELS,
  LEVEL_ATTRIBUTE,
  LEVEL_FILTER_ATTRIBUTE,
  LEVEL_STATUS_ATTRIBUTE,
  QUESTION_LEVEL_ATTRIBUTE,
  resolveLevel,
} from './level-filter';

/** The level <html> holds now ("all" when unset). */
export function currentLevel(doc: Document): string {
  return doc.documentElement.getAttribute(LEVEL_ATTRIBUTE) ?? ALL_LEVELS;
}

/** The level values the page's filter offers (its radios, without "all"). */
export function filterLevels(doc: Document): string[] {
  return Array.from(doc.querySelectorAll<HTMLInputElement>(`[${LEVEL_FILTER_ATTRIBUTE}] input[type="radio"]`))
    .map((radio) => radio.value)
    .filter((value) => value !== ALL_LEVELS);
}

/** Puts the level on <html> (the CSS does the hiding) and checks its radio. */
export function applyLevel(doc: Document, level: string): string {
  const resolved = resolveLevel(level, filterLevels(doc));
  if (resolved === ALL_LEVELS) doc.documentElement.removeAttribute(LEVEL_ATTRIBUTE);
  else doc.documentElement.setAttribute(LEVEL_ATTRIBUTE, resolved);
  doc.querySelectorAll<HTMLInputElement>(`[${LEVEL_FILTER_ATTRIBUTE}] input[type="radio"]`).forEach((radio) => {
    radio.checked = radio.value === resolved;
  });
  return resolved;
}

/** Says the new count in the polite live region. */
export function announce(doc: Document, text: string): void {
  const region = doc.querySelector<HTMLElement>(`[${LEVEL_STATUS_ATTRIBUTE}]`);
  if (region) region.textContent = text;
}

/** True when the question row matches the level on <html>. */
export function questionMatchesLevel(doc: Document, details: Element): boolean {
  const level = currentLevel(doc);
  return level === ALL_LEVELS || details.getAttribute(QUESTION_LEVEL_ATTRIBUTE) === level;
}

function questionRows(doc: Document): HTMLDetailsElement[] {
  return Array.from(doc.querySelectorAll<HTMLDetailsElement>(`details[${QUESTION_LEVEL_ATTRIBUTE}]`));
}

/** Opens every question the filter shows; returns how many are open. */
export function expandAll(doc: Document): number {
  const rows = questionRows(doc).filter((row) => questionMatchesLevel(doc, row));
  rows.forEach((row) => {
    row.open = true;
  });
  return rows.length;
}

/** Closes every question on the page. */
export function collapseAll(doc: Document): void {
  questionRows(doc).forEach((row) => {
    row.open = false;
  });
}

/** The element id a hash names, decoded; undefined for an empty or malformed hash. */
export function idFromHash(hash: string): string | undefined {
  const raw = hash.replace(/^#/, '');
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

export type HashResult =
  | { kind: 'opened'; element: HTMLDetailsElement; widened: boolean }
  | { kind: 'redirect'; href: string }
  | { kind: 'none' };

/**
 * Opens the question the hash names. When the filter hides it, the filter
 * widens to all levels for this visit (not stored), so the link always shows
 * its question. A question that lives on another page (the index keeps old
 * /interview-prep#q-<id> links working) gives its new address instead.
 */
export function openQuestionFromHash(
  doc: Document,
  hash: string,
  elsewhere: Readonly<Record<string, string>> = {},
): HashResult {
  const id = idFromHash(hash);
  if (!id) return { kind: 'none' };
  const element = doc.getElementById(id);
  if (element instanceof HTMLDetailsElement && element.hasAttribute(QUESTION_LEVEL_ATTRIBUTE)) {
    const widened = !questionMatchesLevel(doc, element);
    if (widened) applyLevel(doc, ALL_LEVELS);
    element.open = true;
    return { kind: 'opened', element, widened };
  }
  if (!element && elsewhere[id]) return { kind: 'redirect', href: `${elsewhere[id]}#${encodeURIComponent(id)}` };
  return { kind: 'none' };
}
