import fs from 'node:fs';
import path from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { curriculumData } from '@/lib/curriculum-data';
import { loadExpertIndex, readLessonBody, readManifestTiers } from '@/lib/curriculum-scan';
import { buildExpertIndex, scanExpertLayer, scanLessonHeadings } from '@/lib/expert-index';
import { createSlugger, headingSlug } from '@/lib/heading-slug';
import { isCanonicalLessonHref } from '../fixtures/site-routes';

interface PageNode {
  type: string;
  children?: PageNode[];
  data?: { hProperties?: { id?: unknown } };
}

const lesson = [
  '## Quick Take',
  '',
  'Intro text.',
  '',
  '## Push Further',
  '',
  '### Expert: `uvm_config_db` precedence at scale',
  '',
  'Body.',
  '',
  '```systemverilog',
  '### Expert: this is code, not a heading',
  '```',
  '',
  '<Callout>',
  '',
  '### Expert: Race-free sampling with #0 skews',
  '',
  '</Callout>',
  '',
  '### Example',
  '',
  '### Example',
  '',
  '#### Expert: [Linked](/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index) topic',
  '',
  '### Expertise is not a topic',
  '',
  '## References & Next Topics',
].join('\n');

describe('scanLessonHeadings', () => {
  it('slugs every heading in document order with one slugger per page', () => {
    const { headings, parsed } = scanLessonHeadings(lesson);
    expect(parsed).toBe(true);
    const slug = createSlugger();
    expect(headings.map((h) => h.anchor)).toEqual(headings.map((h) => slug(h.text)));
    expect(headings.map((h) => h.text)).toEqual([
      'Quick Take',
      'Push Further',
      'Expert: uvm_config_db precedence at scale',
      'Expert: Race-free sampling with #0 skews',
      'Example',
      'Example',
      'Expert: Linked topic',
      'Expertise is not a topic',
      'References & Next Topics',
    ]);
    expect(headings.filter((h) => h.text === 'Example').map((h) => h.anchor)).toEqual(['example', 'example-1']);
  });

  it('falls back to a line scan when the MDX parser rejects the body', () => {
    const broken = '## Push Further\n\n<Unclosed>\n\n### Expert: still found\n\n```\n## not a heading\n```\n';
    const scan = scanLessonHeadings(broken);
    expect(scan.parsed).toBe(false);
    expect(scan.headings.map((h) => [h.depth, h.text, h.anchor])).toEqual([
      [2, 'Push Further', 'push-further'],
      [3, 'Expert: still found', 'expert-still-found'],
    ]);
  });
});

describe('scanExpertLayer', () => {
  it('finds expert topics with the anchors the lesson page assigns, and the Push Further section', () => {
    const layer = scanExpertLayer(lesson);
    expect(layer.pushFurtherAnchor).toBe('push-further');
    expect(layer.topics).toEqual([
      {
        topic: 'uvm_config_db precedence at scale',
        text: 'Expert: uvm_config_db precedence at scale',
        anchor: headingSlug('Expert: `uvm_config_db` precedence at scale'),
        depth: 3,
      },
      {
        topic: 'Race-free sampling with #0 skews',
        text: 'Expert: Race-free sampling with #0 skews',
        anchor: 'expert-race-free-sampling-with-0-skews',
        depth: 3,
      },
      { topic: 'Linked topic', text: 'Expert: Linked topic', anchor: 'expert-linked-topic', depth: 4 },
    ]);
  });

  it('numbers a repeated expert heading like the page does', () => {
    const layer = scanExpertLayer('### Expert: Reset\n\ntext\n\n### Expert: Reset\n');
    expect(layer.topics.map((t) => t.anchor)).toEqual(['expert-reset', 'expert-reset-1']);
  });
});

describe('buildExpertIndex', () => {
  const data = [
    {
      title: 'Foundational',
      slug: 'T1_Foundational',
      tier: 'T1',
      sections: [
        {
          title: 'F9A: Sample',
          slug: 'F9A_Sample',
          track: 'core' as const,
          topics: [
            { title: 'F9A: Sample', slug: 'index', description: '' },
            { title: 'Deep Dive | Old Series', slug: 'deep', description: '' },
          ],
        },
        { title: 'F9B: Empty', slug: 'F9B_Empty', track: 'elective' as const, topics: [{ title: 'F9B: Empty', slug: 'index', description: '' }] },
      ],
    },
  ];
  const bodies: Record<string, string> = {
    'F9A_Sample/index': '## Quick Take\n\n## Push Further\n\nNothing tagged yet.\n',
    'F9A_Sample/deep': '## Push Further\n\n### Expert: Corner case one\n\n### Expert: Corner case two\n',
  };

  it('groups topics by tier and module, links anchors, and keeps an honest empty state', () => {
    const index = buildExpertIndex({
      data,
      tiers: [{ id: 'T1_Foundational', title: 'Tier 1: Foundations', audience: 'New to verification.' }],
      readLesson: (_tier, moduleId, lessonSlug) => bodies[`${moduleId}/${lessonSlug}`] ?? null,
    });
    expect(index.topicCount).toBe(2);
    expect(index.taggedModuleCount).toBe(1);
    expect(index.moduleCount).toBe(2);
    const [tier] = index.tiers;
    expect(tier).toMatchObject({ anchor: 't1', title: 'Tier 1: Foundations', audience: 'New to verification.', topicCount: 2 });
    const [sample, empty] = tier.modules;
    expect(sample).toMatchObject({ code: 'F9A', displayTitle: 'Sample', topicCount: 2 });
    expect(sample.pushFurtherHref).toBe('/curriculum/T1_Foundational/F9A_Sample/index#push-further');
    expect(sample.lessons[1]).toEqual({
      slug: 'deep',
      title: 'Deep Dive',
      href: '/curriculum/T1_Foundational/F9A_Sample/deep',
      topics: [
        { topic: 'Corner case one', href: '/curriculum/T1_Foundational/F9A_Sample/deep#expert-corner-case-one' },
        { topic: 'Corner case two', href: '/curriculum/T1_Foundational/F9A_Sample/deep#expert-corner-case-two' },
      ],
      pushFurtherHref: '/curriculum/T1_Foundational/F9A_Sample/deep#push-further',
    });
    expect(empty).toMatchObject({ code: 'F9B', track: 'elective', topicCount: 0 });
    expect(empty.pushFurtherHref).toBeUndefined();
  });
});

const headingIdsPlugin = path.join(__dirname, '../../src/lib/curriculum/remark-heading-ids.ts');

describe.skipIf(!fs.existsSync(headingIdsPlugin))('anchors agree with the lesson page heading ids', () => {
  it('gives every heading of every lesson the id the lesson page renders', async () => {
    const { remarkHeadingIds } = await import('@/lib/curriculum/remark-heading-ids');
    const parser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
    let lessons = 0;
    for (const tier of curriculumData) {
      for (const section of tier.sections) {
        for (const topic of section.topics) {
          const body = readLessonBody(tier.slug, section.slug, topic.slug) ?? '';
          const tree = parser.parse(body) as unknown as PageNode;
          remarkHeadingIds()(tree as never);
          const pageIds: string[] = [];
          const walk = (node: PageNode) => {
            if (node.type === 'heading') pageIds.push(String(node.data?.hProperties?.id));
            else node.children?.forEach(walk);
          };
          walk(tree);
          expect(scanLessonHeadings(body).headings.map((h) => h.anchor), `${section.slug}/${topic.slug}`).toEqual(pageIds);
          lessons += 1;
        }
      }
    }
    expect(lessons).toBeGreaterThan(100);
  }, 30_000);
});

describe('the expert index over the real curriculum', () => {
  const index = loadExpertIndex(curriculumData);

  it('lists every tier and module of the manifest exactly once, in order', () => {
    const manifestTiers = readManifestTiers();
    expect(index.tiers.map((t) => t.title)).toEqual(manifestTiers.map((t) => t.title));
    expect(index.tiers.flatMap((t) => t.modules.map((m) => m.id))).toEqual(
      curriculumData.flatMap((t) => t.sections.map((s) => s.slug)),
    );
    expect(index.moduleCount).toBe(curriculumData.reduce((n, t) => n + t.sections.length, 0));
  });

  it('parses every lesson and links only canonical lesson URLs with anchors that exist on the page', () => {
    expect(index.unparsedLessons).toEqual([]);
    for (const tier of index.tiers) {
      for (const mod of tier.modules) {
        expect(isCanonicalLessonHref(mod.href), mod.href).toBe(true);
        for (const entry of mod.lessons) {
          const [tierId, moduleId, slug] = entry.href.replace('/curriculum/', '').split('/');
          const anchors = new Set(scanLessonHeadings(readLessonBody(tierId, moduleId, slug) ?? '').headings.map((h) => h.anchor));
          for (const href of [...entry.topics.map((t) => t.href), ...(entry.pushFurtherHref ? [entry.pushFurtherHref] : [])]) {
            const [pathname, anchor] = href.split('#');
            expect(isCanonicalLessonHref(pathname), href).toBe(true);
            expect(anchors.has(anchor), href).toBe(true);
          }
        }
      }
    }
  }, 30_000);

  it('counts consistently', () => {
    const topics = index.tiers.flatMap((t) => t.modules.flatMap((m) => m.lessons.flatMap((l) => l.topics)));
    expect(index.topicCount).toBe(topics.length);
    expect(index.tiers.reduce((n, t) => n + t.topicCount, 0)).toBe(topics.length);
    expect(index.taggedModuleCount).toBe(index.tiers.flatMap((t) => t.modules).filter((m) => m.topicCount > 0).length);
  });
});
