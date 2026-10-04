/**
 * Heading anchors shared by the lesson table of contents, in-lesson links and
 * the expert index. GitHub-style: lowercase, punctuation removed, spaces to
 * hyphens, and a numeric suffix for repeats within one page ("-1", "-2", …).
 * Keep this stable: links in lessons and the expert index depend on it.
 */
export function headingSlug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[`*~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Stateful slugger for one page: repeated headings get -1, -2, … suffixes. */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = headingSlug(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/** True for expert-layer headings ("Expert: <topic>"), which feed the expert index. */
export function isExpertHeading(text: string): boolean {
  return /^expert:\s*\S/i.test(text.trim());
}
