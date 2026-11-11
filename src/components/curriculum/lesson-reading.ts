/**
 * Pure helpers behind the lesson's reading aids (SPEC-phases-2-4.md, "Lesson
 * page"): which section the reader is in, how far through the article they
 * are, and how "On this page" groups its entries. No DOM access here, so each
 * rule is unit-tested on plain numbers; useLessonReading.ts feeds them from the
 * page.
 */
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

/**
 * Where a heading counts as "being read": this far below the top of the
 * viewport. The sticky site header is 64 px and the contents bar under it 44
 * px below 1280; headings scroll to 112 px (scroll-mt-28), so 120 px puts a
 * heading that was just jumped to inside the band.
 */
export const READING_LINE_PX = 120;

/** The sticky site header's height (h-16), the top edge the progress line and the contents bar sit under. */
export const SITE_HEADER_PX = 64;

/**
 * The index of the heading being read: the last one whose top has passed the
 * reading line. At the very bottom of the page the last heading that is on
 * screen wins, so a short final section can still become current. Returns -1
 * before the first heading reaches the line.
 */
export function activeHeadingIndex(
  tops: readonly number[],
  { line = READING_LINE_PX, viewportHeight, atBottom = false }: { line?: number; viewportHeight: number; atBottom?: boolean },
): number {
  let active = -1;
  for (let index = 0; index < tops.length; index += 1) {
    if (tops[index] <= line) active = index;
  }
  if (atBottom) {
    for (let index = tops.length - 1; index > active; index -= 1) {
      if (tops[index] < viewportHeight) return index;
    }
  }
  return active;
}

/**
 * Reading progress through the article, 0 to 1: 0 while its top is still
 * below the sticky chrome, 1 once its bottom reaches the bottom of the
 * viewport. An article shorter than the visible area counts as read once its
 * top has passed the chrome.
 */
export function readingProgress(
  rect: { top: number; height: number },
  viewportHeight: number,
  chromeHeight: number = SITE_HEADER_PX,
): number {
  const visible = viewportHeight - chromeHeight;
  const scrolled = chromeHeight - rect.top;
  const total = rect.height - visible;
  if (total <= 0) return scrolled > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, scrolled / total));
}

export interface TocGroup {
  entry: TocEntry;
  children: TocEntry[];
}

/** H3 entries nest under the H2 before them; an H3 before any H2 stands alone. */
export function groupTocEntries(entries: readonly TocEntry[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (entry.depth === 3 && last && last.entry.depth === 2) last.children.push(entry);
    else groups.push({ entry, children: [] });
  }
  return groups;
}

/** The id of the group that holds `activeId` (its own entry or one of its children), or null. */
export function groupHolding(groups: readonly TocGroup[], activeId: string | null): string | null {
  if (!activeId) return null;
  const group = groups.find(({ entry, children }) => entry.id === activeId || children.some((child) => child.id === activeId));
  return group ? group.entry.id : null;
}

/**
 * Whether a group's sections are shown: the reader's choice when they made
 * one, otherwise open only while it holds the section being read.
 */
export function isGroupOpen(groupId: string, holdingId: string | null, choices: Readonly<Record<string, boolean>>): boolean {
  return choices[groupId] ?? groupId === holdingId;
}

/**
 * The scrollTop that brings a row into view inside a scroll box, or null when
 * it is already fully visible. The row lands a third of the way down, so the
 * entries after it stay in sight. Offsets are relative to the box's content.
 */
export function scrollTopToReveal(
  row: { top: number; height: number },
  box: { scrollTop: number; clientHeight: number },
): number | null {
  const bottom = row.top + row.height;
  if (row.top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) return null;
  return Math.max(0, Math.round(row.top - box.clientHeight / 3));
}
