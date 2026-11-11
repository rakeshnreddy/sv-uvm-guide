import { describe, expect, it } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import index from '@/generated/search-index.json';
import {
  DEFAULT_RESULT_LIMIT,
  SEARCH_ITEM_KINDS,
  SEARCH_KIND_LABELS,
  describeResult,
  resultContext,
  headingAnchor,
  lessonHref,
  prepareSearchDocuments,
  resultKindLabel,
  resultTitle,
  searchCurriculum,
  stems,
  type SearchDocument,
  type SearchIndexData,
} from '@/components/search/search-engine';
import { getInterviewPracticeItems } from '@/app/(learning)/interview-prep/interview-banks';
import { getAllLabs } from '@/lib/lab-registry';
import { PRACTICE_PAGES } from '@/lib/practice-links';
import { REFERENCE_LINKS } from '@/lib/site-links';
import { curriculumData, normalizeSlug } from '@/lib/curriculum-data';
import { createSlugger, headingSlug } from '@/lib/heading-slug';

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
  it('has one lesson entry per manifest lesson, in manifest order (112 lessons today)', () => {
    expect(lessonDocs.map((doc) => doc.href)).toEqual(manifestLessonHrefs);
    expect(lessonDocs).toHaveLength(112);
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
    const slug = createSlugger();
    expect([slug('The Pitfall'), slug('The Pitfall')]).toEqual(['the-pitfall', 'the-pitfall-1']);
    // In the generated index a numbered anchor is stored explicitly and extends the text's own slug.
    for (const tier of data.tiers) {
      for (const mod of tier.modules) {
        for (const lesson of mod.lessons) {
          for (const heading of lesson.headings) {
            const explicit = heading[2];
            const numbered = explicit ? /^(.*)-(\d+)$/.exec(explicit) : null;
            if (numbered && numbered[1] === headingSlug(heading[0])) expect(headingAnchor(heading)).toBe(explicit);
          }
        }
      }
    }
  });

  it('holds no lesson body text', () => {
    const fieldsPerLesson = new Set(
      data.tiers.flatMap((tier) => tier.modules.flatMap((mod) => mod.lessons.flatMap((lesson) => Object.keys(lesson)))),
    );
    expect([...fieldsPerLesson].sort()).toEqual(['description', 'headings', 'slug', 'title']);
  });
});

describe('generated search index: labs, practice, interview banks and reference pages', () => {
  const items = data.items ?? [];
  const hrefsOf = (kind: string) => items.filter((item) => item.kind === kind).map((item) => item.href);

  it('gives every item a known kind, a title, one line of description, keywords and a unique href', () => {
    expect(items.length).toBeGreaterThan(40);
    for (const item of items) {
      expect(SEARCH_ITEM_KINDS as readonly string[]).toContain(item.kind);
      expect(item.title.trim(), item.href).not.toBe('');
      expect(item.description.trim(), item.href).not.toBe('');
      expect(item.description.length, item.href).toBeLessThanOrEqual(120);
      expect(item.description, item.href).not.toMatch(/\n/);
      expect(item.keywords.length, item.href).toBeGreaterThan(0);
    }
    expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
  });

  it('stores no body text: only kind, title, description, href, keywords and code', () => {
    const fields = new Set(items.flatMap((item) => Object.keys(item)));
    expect([...fields].sort()).toEqual(['code', 'description', 'href', 'keywords', 'kind', 'title']);
  });

  it('lists every available lab at its prerendered URL', () => {
    const available = getAllLabs().filter((lab) => lab.status === 'available');
    expect(hrefsOf('lab').sort()).toEqual(available.map((lab) => `/practice/lab/${lab.id}`).sort());
  });

  it('lists every exercise, interactive model and tool page from the practice map', () => {
    expect([...hrefsOf('exercise'), ...hrefsOf('model'), ...hrefsOf('tool')].sort()).toEqual(
      PRACTICE_PAGES.map((page) => page.href).sort(),
    );
    expect(hrefsOf('exercise').sort()).toEqual(PRACTICE_PAGES.filter((page) => page.kind === 'exercise').map((page) => page.href).sort());
    expect(hrefsOf('tool')).toContain('/practice/waveform-studio');
    for (const page of PRACTICE_PAGES) {
      expect(items.find((item) => item.href === page.href)?.title).toBe(page.title);
    }
  });

  it('links every interview bank to the anchor its section of /interview-prep renders', () => {
    expect(hrefsOf('interview').sort()).toEqual(getInterviewPracticeItems().map((item) => item.href).sort());
  });

  it('lists the reference pages under their navigation labels', () => {
    const references = items.filter((item) => item.kind === 'reference');
    expect(references.map((item) => [item.title, item.href])).toEqual(REFERENCE_LINKS.map((link) => [link.label, link.href]));
  });

  it('gives each item with a code a real module code', () => {
    const codes = new Set(lessonDocs.map((doc) => doc.code));
    for (const item of items) if (item.code) expect(codes, `${item.href}: ${item.code}`).toContain(item.code);
  });
});

describe('search result kinds', () => {
  const itemDocs = docs.filter((doc) => doc.kind !== 'lesson' && doc.kind !== 'section');

  it('labels every kind in text', () => {
    expect(Object.values(SEARCH_KIND_LABELS)).toEqual(['Lesson', 'Section', 'Lab', 'Exercise', 'Model', 'Tool', 'Interview', 'Reference']);
    for (const doc of docs) expect(resultKindLabel(doc)).toBe(SEARCH_KIND_LABELS[doc.kind]);
    const expert = docs.find((doc) => doc.kind === 'section' && doc.expert);
    expect(expert && resultKindLabel(expert)).toBe('Section');
  });

  it('finds labs, exercises, models, tools, interview banks and reference pages', () => {
    const kindOf = (query: string, href: string) => searchCurriculum(docs, query, 50).find((result) => result.doc.href === href)?.doc.kind;
    expect(kindOf('phase sorter', '/exercises/uvm-phase-sorter')).toBe('exercise');
    expect(kindOf('waveform studio', '/practice/waveform-studio')).toBe('tool');
    expect(kindOf('fork join', '/practice/visualizations/concurrency')).toBe('model');
    expect(kindOf('semaphore hangs', '/practice/lab/ipc-deadlock')).toBe('lab');
    expect(kindOf('uvm interview', '/interview-prep#uvm-interview-question-bank')).toBe('interview');
    expect(kindOf('learning strategies', '/learning-strategies')).toBe('reference');
  });

  it('shows an item\'s module code beside its one-line description', () => {
    const sorter = itemDocs.find((doc) => doc.href === '/exercises/uvm-phase-sorter') as SearchDocument;
    expect(resultContext(sorter)).toEqual({ code: 'I-UVM-1C', text: sorter.description });
    expect(describeResult(sorter)).toBe(`I-UVM-1C · ${sorter.description}`);
    const history = itemDocs.find((doc) => doc.href === '/history') as SearchDocument;
    expect(resultContext(history).code).toBe('');
    expect(describeResult(history)).toBe(history.description);
  });

  it('splits a lesson or section context into its code and the text after it', () => {
    const lesson = searchCurriculum(docs, 'mailbox')[0].doc;
    expect(resultContext(lesson)).toEqual({ code: 'I-SV-5', text: 'Synchronization and IPC · Tier 2: Intermediate' });
    const section = docs.find((doc) => doc.kind === 'section' && doc.code === 'I-SV-5') as SearchDocument;
    expect(section.lessonTitle).toBe('I-SV-5: Synchronization and IPC');
    expect(resultContext(section)).toEqual({ code: 'I-SV-5', text: 'Synchronization and IPC' });
  });

  it('shows titles without the module code the signal tag already shows, and keeps the code searchable', () => {
    const lesson = docs.find((doc) => doc.href === '/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index') as SearchDocument;
    expect(lesson.title).toBe('I-SV-3A: Functional Coverage Fundamentals');
    expect(resultTitle(lesson)).toBe('Functional Coverage Fundamentals');
    expect(resultContext(lesson).code).toBe('I-SV-3A');
    expect(searchCurriculum(docs, 'I-SV-3A')[0].doc.href).toBe(lesson.href);
    const plainLesson = docs.find((doc) => doc.href.endsWith('/I-SV-5_Synchronization_and_IPC/mailboxes')) as SearchDocument;
    expect(resultTitle(plainLesson)).toBe(plainLesson.title);
    const sorter = itemDocs.find((doc) => doc.href === '/exercises/uvm-phase-sorter') as SearchDocument;
    expect(resultTitle(sorter)).toBe('UVM phase sorter');
    for (const doc of docs) {
      if (doc.code) expect(resultTitle(doc).startsWith(`${doc.code}:`), doc.href).toBe(false);
      if (doc.kind === 'section') expect(resultContext(doc).text.startsWith(`${doc.code}:`), doc.href).toBe(false);
    }
  });
});

describe('ranking across kinds', () => {
  /** A minimal index: one lesson and one item with the same title and description. */
  const tie: SearchIndexData = {
    version: 3,
    tiers: [
      {
        id: 'T1_Foundational',
        title: 'Tier 1: Foundations',
        modules: [
          {
            id: 'F9Z_Widgets',
            title: 'F9Z: Widgets',
            track: 'core',
            lessons: [{ slug: 'index', title: 'Widget tuning', description: 'Tune a widget.', headings: [['Widget tuning tips', 3]] }],
          },
        ],
      },
    ],
    items: [
      { kind: 'lab', title: 'Widget tuning', description: 'Tune a widget.', href: '/practice/lab/widget', keywords: ['lab'] },
      { kind: 'reference', title: 'Widget tuning', description: 'Tune a widget.', href: '/widgets', keywords: ['reference'] },
    ],
  };

  it('ranks the lesson first for an equal match, then items, then sections', () => {
    const results = searchCurriculum(prepareSearchDocuments(tie), 'widget tuning');
    expect(results.map((result) => result.doc.kind)).toEqual(['lesson', 'lab', 'reference', 'section']);
  });

  it('still lets a clearly better item outrank a weaker lesson match', () => {
    const results = searchCurriculum(docs, 'waveform studio');
    expect(results[0].doc.href).toBe('/practice/waveform-studio');
  });

  it('keeps the module index first for its code, ahead of items that cite the module', () => {
    expect(searchCurriculum(docs, 'I-UVM-1C')[0].doc.href).toBe('/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index');
  });

  it('reads an index written before items existed', () => {
    const { items: _items, ...old } = tie;
    expect(prepareSearchDocuments(old).map((doc) => doc.kind)).toEqual(['lesson', 'section']);
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

  it('ranks the phasing lesson near the top for "phase" and first for "phasing"', () => {
    const phasing = '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index';
    const phase = searchCurriculum(docs, 'phase');
    expect(phase.slice(0, 3).map((result) => result.doc.href)).toContain(phasing);
    expect(phase.find((result) => result.doc.kind === 'lesson')?.doc.href).toBe(phasing);
    expect(searchCurriculum(docs, 'phasing')[0].doc.href).toBe(phasing);
    expect(searchCurriculum(docs, 'phases').slice(0, 3).map((result) => result.doc.href)).toContain(phasing);
  });

  it('keeps sensible first results for "axi", "coverage" and "factory"', () => {
    const axi = searchCurriculum(docs, 'axi');
    expect(axi[0].doc.kind).toBe('lesson');
    expect(axi[0].doc.title).toMatch(/AXI/);
    const coverage = searchCurriculum(docs, 'coverage');
    expect(coverage[0].doc.kind).toBe('lesson');
    expect(coverage[0].doc.title).toMatch(/Coverage/);
    expect(coverage.slice(0, 8).map((result) => result.doc.href)).toContain(
      '/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index',
    );
    expect(searchCurriculum(docs, 'factory')[0].doc.href).toBe('/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory/index');
  });

  it('returns nothing for a nonsense query', () => {
    expect(searchCurriculum(docs, 'zzzz')).toEqual([]);
    expect(searchCurriculum(docs, 'qqxqz')).toEqual([]);
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

describe('stems', () => {
  it('tries the form without a final "e" and without "-ing"', () => {
    expect(stems('phase')).toEqual(['phase', 'phas']);
    expect(stems('phasing')).toEqual(['phasing', 'phase', 'phas']);
    expect(stems('mailboxes')).toEqual(['mailboxes', 'mailboxe', 'mailbox']);
    expect(stems('entries')).toEqual(['entries', 'entrie', 'entri', 'entry']);
  });

  it('leaves short words alone so they do not match half the index', () => {
    expect(stems('case')).toEqual(['case']);
    expect(stems('string')).toEqual(['string']);
    expect(stems('ring')).toEqual(['ring']);
    expect(stems('bits')).toEqual(['bits', 'bit']);
  });
});

describe('search result deep links', () => {
  it('links sections to the canonical lesson URL plus the heading anchor', () => {
    const heading = 'WSTRB: any subset of the active lanes';
    const section = searchCurriculum(docs, 'WSTRB active lanes').find(
      (result) => result.doc.kind === 'section' && result.doc.href.includes('#'),
    );
    expect(section?.doc.lessonHref).toBe('/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index');
    expect(section?.doc.href).toBe(`/curriculum/T3_Advanced/B-AXI-2_AXI_Burst_Math/index#${headingSlug(heading)}`);
  });

  it('resolves every lesson and section result to a real lesson', () => {
    for (const query of ['mailbox', 'factory', 'covergroup', 'objection', 'scoreboard', 'expert']) {
      for (const { doc } of searchCurriculum(docs, query)) {
        if (doc.kind !== 'lesson' && doc.kind !== 'section') continue;
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
