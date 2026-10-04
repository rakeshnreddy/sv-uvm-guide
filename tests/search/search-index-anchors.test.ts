import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import index from '@/generated/search-index.json';
import { headingAnchor, type SearchIndexData } from '@/components/search/search-engine';
import { remarkHeadingIds, type TocEntry } from '@/lib/curriculum/remark-heading-ids';

const data = index as unknown as SearchIndexData;
const curriculumRoot = path.resolve(__dirname, '../../content/curriculum');

/**
 * Search results deep-link to `#anchor`. The lesson page gives headings their
 * ids with remarkHeadingIds; the index script computes the same ids on its
 * own. This runs the page's plugin over every lesson and checks the two agree,
 * so a search result never lands on a missing anchor. If it fails after a
 * lesson edit, regenerate the index: node scripts/generate-search-index.mjs
 */
describe('search index anchors match the lesson page heading ids', () => {
  const lessons = data.tiers.flatMap((tier) =>
    tier.modules.flatMap((mod) => mod.lessons.map((lesson) => ({ tier: tier.id, module: mod.id, lesson }))),
  );

  it.each(lessons.map((entry) => [`${entry.module}/${entry.lesson.slug}`, entry] as const))('%s', (_name, entry) => {
    const file = path.join(curriculumRoot, entry.tier, entry.module, `${entry.lesson.slug}.mdx`);
    const { content } = matter(fs.readFileSync(file, 'utf8'));
    const toc: TocEntry[] = [];
    const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkHeadingIds, { toc });
    processor.runSync(processor.parse(content));

    const fromPage = toc.map((entry) => [entry.text, entry.id]);
    const fromIndex = entry.lesson.headings.map((heading) => [heading[0], headingAnchor(heading)]);
    expect(fromIndex).toEqual(fromPage);
  });
});
