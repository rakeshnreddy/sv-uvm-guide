import { describe, expect, it } from 'vitest';

import { TEACH_BACK_SECTION } from '@/lib/curriculum/lesson-mdx';
import type { NotebookEntry } from '@/lib/learner-store/repositories/notebook';
import {
  entriesToMarkdown,
  escapeMarkdownInline,
  fenceMarkdownBlock,
  formatLocalDateTime,
  notebookEntryLessonHref,
  notebookEntryTitle,
  notebookMarkdownFileName,
  TEACH_BACK_ANCHOR,
} from '@/lib/notebook-export';

const LESSON = '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences';
// Local times, so the expected strings hold in every time zone.
const CREATED = new Date(2026, 9, 1, 9, 5).getTime();
const UPDATED = new Date(2026, 9, 2, 17, 30).getTime();
const NOW = new Date(2026, 9, 18, 12, 0).getTime();

function entry(overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return {
    id: 'teach-back-1',
    kind: 'teach-back',
    lessonPath: LESSON,
    lessonTitle: 'Virtual sequences',
    title: 'Virtual sequences',
    body: 'A virtual sequence starts sequences on several sequencers.',
    createdAt: CREATED,
    updatedAt: UPDATED,
    ...overrides,
  };
}

/** The lines outside fenced blocks: where Markdown would interpret structure. */
function linesOutsideFences(markdown: string): string[] {
  const lines = markdown.split('\n');
  const outside: string[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const match = /^(`{3,})/.exec(line);
    if (fence) {
      if (match && match[1].length >= fence.length && line.trim() === match[1]) fence = null;
      continue;
    }
    if (match) {
      fence = match[1];
      continue;
    }
    outside.push(line);
  }
  return outside;
}

describe('entriesToMarkdown', () => {
  it('writes a title, an export line and a level-2 section per entry with its kind, lesson link and dates', () => {
    const markdown = entriesToMarkdown([entry()], { now: NOW });

    expect(markdown).toBe(
      [
        '# Notebook',
        '',
        'Exported on 2026-10-18 · 1 entry.',
        '',
        '## Virtual sequences',
        '',
        '- Teach it back',
        `- Lesson: [Virtual sequences](${LESSON}#teach-it-back)`,
        '- Created: 2026-10-01 09:05',
        '- Updated: 2026-10-02 17:30',
        '',
        '```text',
        'A virtual sequence starts sequences on several sequencers.',
        '```',
        '',
      ].join('\n'),
    );
  });

  it('keeps the given order, counts entries and writes absolute links with an origin', () => {
    const note = entry({ id: 'n1', kind: 'note', title: 'TLM FIFO', lessonPath: undefined, lessonTitle: undefined, body: 'put/get' });
    const markdown = entriesToMarkdown([entry(), note], { origin: 'https://sv-uvm.example', now: NOW });

    expect(markdown).toContain('Exported on 2026-10-18 · 2 entries.');
    expect(markdown).toContain(`- Lesson: [Virtual sequences](https://sv-uvm.example${LESSON}#teach-it-back)`);
    expect(markdown.indexOf('## Virtual sequences')).toBeLessThan(markdown.indexOf('## TLM FIFO'));
    // A note without a lesson has no lesson line.
    const noteSection = markdown.slice(markdown.indexOf('## TLM FIFO'));
    expect(noteSection).not.toContain('Lesson:');
    expect(noteSection).toContain('- Note');
  });

  it('links a note with a lesson to the lesson itself, and skips paths that are not site paths', () => {
    const note = entry({ kind: 'note', title: 'From a lesson' });
    expect(entriesToMarkdown([note], { now: NOW })).toContain(`(${LESSON})`);

    for (const lessonPath of ['javascript:alert(1)', '//evil.example/x', 'https://evil.example/', '/curriculum/a b']) {
      const markdown = entriesToMarkdown([entry({ lessonPath })], { now: NOW });
      expect(markdown, lessonPath).not.toContain('Lesson:');
      expect(markdown, lessonPath).not.toContain('evil');
      expect(markdown, lessonPath).not.toContain('javascript');
    }
  });

  it('ignores an origin that is not a plain http(s) origin', () => {
    const markdown = entriesToMarkdown([entry()], { origin: 'javascript:alert(1)//', now: NOW });
    expect(markdown).toContain(`](${LESSON}#teach-it-back)`);
    expect(markdown).not.toContain('javascript');
  });

  it('escapes titles so they cannot add headings, links, code or raw HTML', () => {
    const hostile = entry({
      title: '# Owned\n## Second <img src=x onerror=alert(1)> [link](https://evil.example) `code` *em* & #',
      lessonTitle: '](javascript:alert(1)) <b>',
    });
    const markdown = entriesToMarkdown([hostile], { now: NOW });
    const outside = linesOutsideFences(markdown);

    // One heading per entry plus the document title: the title stayed on its line.
    expect(outside.filter((line) => line.startsWith('#'))).toEqual([
      '# Notebook',
      '## \\# Owned \\#\\# Second &lt;img src=x onerror=alert(1)&gt; \\[link\\](https://evil.example) \\`code\\` \\*em\\* &amp; \\#',
    ]);
    expect(outside.join('\n')).not.toMatch(/<[a-z]/i);
    expect(markdown).toContain(`- Lesson: [\\](javascript:alert(1)) &lt;b&gt;](${LESSON}#teach-it-back)`);
  });

  it('fences bodies so headings, lists, quotes and HTML in them stay text', () => {
    const body = ['# Not a heading', '> not a quote', '- not a list', '<script>alert(1)</script>', '---', '```', 'after a fence'].join('\n');
    const markdown = entriesToMarkdown([entry({ body })], { now: NOW });

    expect(markdown).toContain(`\`\`\`\`text\n${body}\n\`\`\`\``);
    const outside = linesOutsideFences(markdown);
    expect(outside.some((line) => line.includes('script'))).toBe(false);
    expect(outside.some((line) => line.includes('Not a heading'))).toBe(false);
    expect(outside.filter((line) => /^#{1,6} /.test(line))).toHaveLength(2);
  });

  it('marks an empty body instead of writing an empty fence', () => {
    expect(entriesToMarkdown([entry({ body: '  \n' })], { now: NOW })).toContain('*No text yet.*');
  });

  it('names untitled entries', () => {
    expect(entriesToMarkdown([entry({ title: '   ' })], { now: NOW })).toContain('## Untitled note');
    expect(notebookEntryTitle({ title: '' })).toBe('Untitled note');
  });
});

describe('the Markdown helpers', () => {
  it('escapeMarkdownInline writes one line and escapes control characters and HTML', () => {
    expect(escapeMarkdownInline('a\n\n# b')).toBe('a \\# b');
    expect(escapeMarkdownInline('<i>&amp;</i>')).toBe('&lt;i&gt;&amp;amp;&lt;/i&gt;');
    expect(escapeMarkdownInline('uvm_component::get_type()')).toBe('uvm\\_component::get\\_type()');
    expect(escapeMarkdownInline('a \\ b | c ~~d~~')).toBe('a \\\\ b \\| c \\~\\~d\\~\\~');
  });

  it('fenceMarkdownBlock uses a fence longer than any backtick run', () => {
    expect(fenceMarkdownBlock('plain')).toBe('```text\nplain\n```');
    expect(fenceMarkdownBlock('a ````` b')).toBe('``````text\na ````` b\n``````');
    expect(fenceMarkdownBlock('line\r\nnext\n\n')).toBe('```text\nline\nnext\n```');
  });

  it('formats local dates and the download name', () => {
    expect(formatLocalDateTime(new Date(2026, 0, 5, 7, 3).getTime())).toBe('2026-01-05 07:03');
    expect(notebookMarkdownFileName(NOW)).toBe('sv-uvm-guide-notebook-2026-10-18.md');
  });

  it("links teach-back entries to the lesson's Teach it back heading", () => {
    expect(TEACH_BACK_ANCHOR).toBe(TEACH_BACK_SECTION.id);
    expect(notebookEntryLessonHref({ kind: 'teach-back', lessonPath: LESSON })).toBe(`${LESSON}#teach-it-back`);
    expect(notebookEntryLessonHref({ kind: 'note', lessonPath: LESSON })).toBe(LESSON);
    expect(notebookEntryLessonHref({ kind: 'note' })).toBeNull();
    expect(notebookEntryLessonHref({ kind: 'teach-back', lessonPath: 'javascript:alert(1)' })).toBeNull();
  });
});
