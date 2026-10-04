import { describe, expect, it } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import index from '@/generated/search-index.json';
import {
  DEFAULT_RESULT_LIMIT,
  describeResult,
  headingAnchor,
  lessonHref,
  prepareSearchDocuments,
  resultKindLabel,
  searchCurriculum,
  type SearchIndexData,
} from '@/components/search/search-engine';
import { curriculumData, normalizeSlug } from '@/lib/curriculum-data';
import { headingSlug } from '@/lib/heading-slug';

const data = index as unknown as SearchIndexData;
const docs = prepareSearchDocuments(data);
const lessonDocs = docs.filter((doc) => doc.kind === 'lesson');

const manifestLessonHrefs = manifest.tiers.flatMap((tier) =>
  tier.modules.flatMap((mod) => mod.lessons.map((lesson) => lessonHref(tier.id, mod.id, lesson))),
);

function lessonOf(href: string): string {
  return href.split('#')[0];
}

function topLessons(query: string, count = 3): string[] {
  return searchCurriculum(docs, query)
    .slice(0, count)
    .map((result) => lessonOf(result.doc.href));
}

describe('generated search index', () => {
  it('has one lesson entry per manifest lesson, in manifest order (108 lessons today)', () => {
    expect(lessonDocs.map((doc) => doc.href)).toEqual(manifestLessonHrefs);
    expect(lessonDocs).toHaveLength(108);
    expect(data.tiers.map((tier) => tier.title)).toEqual(manifest.tiers.map((tier) => tier.title));
  });

  it('uses the same titles and descriptions as the generated curriculum data', () => {
    const fromCurriculum = curriculumData.flatMap((tier) =>
      tier.sections.flatMap((section) =>
        section.topics.map((topic) => ({
          href: lessonHref(tier.slug, section.slug, topic.slug),
          title: topic.title,
          description: topic.description,
        })),
      ),
    );
    const fromIndex = data.tiers.flatMap((tier) =>
      tier.modules.flatMap((mod) =>
        mod.lessons.map((lesson) => ({
          href: lessonHref(tier.id, mod.id, lesson.slug),
          title: lesson.title,
          description: lesson.description,
        })),
      ),
    );
    expect(fromIndex).toEqual(fromCurriculum);
  });

  it('records each module track from the manifest', () => {
    const tracks = Object.fromEntries(
      manifest.tiers.flatMap((tier) => tier.modules.map((mod) => [mod.id, mod.track])),
    );
    for (const tier of data.tiers) {
      for (const mod of tier.modules) expect(mod.track).toBe(tracks[mod.id]);
    }
  });

  it('links every lesson to its canonical URL', () => {
    for (const doc of lessonDocs) {
      const segments = doc.href.replace(/^\/curriculum\//, '').split('/');
      expect(normalizeSlug(segments)).toEqual(segments);
    }
  });

  it('indexes only H2 and H3 headings, with anchors unique within a lesson', () => {
    for (const tier of data.tiers) {
      for (const mod of tier.modules) {
        for (const lesson of mod.lessons) {
          const anchors = lesson.headings.map(headingAnchor);
          expect(new Set(anchors).size, `${mod.id}/${lesson.slug}`).toBe(anchors.length);
          for (const heading of lesson.headings) {
            expect([2, 3]).toContain(heading[1]);
            // An explicit anchor is stored only when the slug of the text cannot rebuild it.
            if (heading.length === 3) expect(heading[2]).not.toBe(headingSlug(heading[0]));
          }
        }
      }
    }
  });

  it('gives a repeated heading the numbered anchor the shared slugger assigns', () => {
    const deadlocks = data.tiers
      .flatMap((tier) => tier.modules)
      .find((mod) => mod.id === 'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks');
    const anchors = deadlocks?.lessons[0].headings
      .filter(([text]) => text === 'The Pitfall')
      .map(headingAnchor);
    expect(anchors).toEqual(['the-pitfall', 'the-pitfall-1']);
  });

  it('holds no lesson body text', () => {
    const fieldsPerLesson = new Set(
      data.tiers.flatMap((tier) => tier.modules.flatMap((mod) => mod.lessons.flatMap((lesson) => Object.keys(lesson)))),
    );
    expect([...fieldsPerLesson].sort()).toEqual(['description', 'headings', 'slug', 'title']);
  });
});

describe('searchCurriculum ranking (G30-SRCH acceptance)', () => {
  it('ranks I-SV-5 Mailboxes in the top 3 for "mailbox"', () => {
    expect(topLessons('mailbox')).toContain(
      '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes',
    );
  });

  it('ranks B-AXI-2 in the top 3 for "WSTRB"', () => {
    expect(topLessons('WSTRB')).toContain('/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index');
  });

  it('ranks I-UVM-2C in the top 3 for "uvm_config_db", "config_db" and "config db"', () => {
    const configLesson = '/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index';
    expect(topLessons('uvm_config_db')).toContain(configLesson);
    expect(topLessons('config_db')).toContain(configLesson);
    expect(topLessons('config db')).toContain(configLesson);
  });

  it('puts the module index first for its code', () => {
    expect(searchCurriculum(docs, 'I-SV-5')[0].doc.href).toBe(
      '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index',
    );
    expect(searchCurriculum(docs, 'b-axi-2')[0].doc.href).toBe('/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index');
  });

  it('matches plural and singular forms', () => {
    expect(topLessons('mailboxes')).toContain('/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes');
    expect(topLessons('semaphore')).toContain('/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/semaphores');
  });

  it('requires every meaningful word to match and ignores stop words', () => {
    const results = searchCurriculum(docs, 'the mailbox failure modes');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].doc.href).toBe(
      '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes#failure-modes-leaks-and-backpressure',
    );
    expect(searchCurriculum(docs, 'mailbox zzzzqqq')).toEqual([]);
  });

  it('ignores queries shorter than two characters', () => {
    expect(searchCurriculum(docs, '')).toEqual([]);
    expect(searchCurriculum(docs, 'a')).toEqual([]);
    expect(searchCurriculum(docs, '  ')).toEqual([]);
  });

  it('does not let one lesson fill the list', () => {
    const results = searchCurriculum(docs, 'axi', 50);
    const perLesson = new Map<string, number>();
    for (const { doc } of results) perLesson.set(doc.lessonHref, (perLesson.get(doc.lessonHref) ?? 0) + 1);
    expect(Math.max(...perLesson.values())).toBeLessThanOrEqual(3);
    expect(searchCurriculum(docs, 'axi').length).toBeLessThanOrEqual(DEFAULT_RESULT_LIMIT);
  });

  it('only returns a section whose own heading matches the query', () => {
    for (const { doc } of searchCurriculum(docs, 'mailbox', 50)) {
      if (doc.kind === 'section') {
        expect(`${doc.title} ${doc.code}`.toLowerCase()).toMatch(/mailbox/);
      }
    }
  });
});

describe('search result deep links', () => {
  it('links sections to the canonical lesson URL plus the heading anchor', () => {
    const results = searchCurriculum(docs, 'WSTRB write strobe');
    const section = results.find((result) => result.doc.kind === 'section');
    expect(section?.doc.href).toBe('/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index#3-wstrb--write-strobe-generation');
    expect(section?.doc.href).toBe(`${section?.doc.lessonHref}#${headingSlug('3. WSTRB — Write Strobe Generation')}`);
  });

  it('resolves every result to a real lesson', () => {
    for (const query of ['mailbox', 'factory', 'covergroup', 'objection', 'scoreboard', 'expert']) {
      for (const { doc } of searchCurriculum(docs, query)) {
        const segments = lessonOf(doc.href).replace(/^\/curriculum\//, '').split('/');
        expect(normalizeSlug(segments), doc.href).toEqual(segments);
      }
    }
  });

  it('describes where a result lives, in text', () => {
    const lesson = searchCurriculum(docs, 'mailbox')[0].doc;
    expect(describeResult(lesson)).toBe('I-SV-5: Synchronization and IPC · Tier 2: Intermediate');
    expect(resultKindLabel(lesson)).toBe('Lesson');

    const elective = searchCurriculum(docs, 'upf')[0].doc;
    expect(elective.track).toBe('elective');
    expect(describeResult(elective)).toMatch(/Elective$/);
  });
});
