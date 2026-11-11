import { describe, expect, it } from 'vitest';

import {
  CONTINUE_LABEL,
  START_LEARNING_LABEL,
  lessonPathsFromManifest,
  longestContinueLabel,
  resumeLessonHref,
} from '@/components/layout/public-header-resume';
import { curriculumData, moduleHref } from '@/lib/curriculum-data';
import manifest from '../../content/curriculum/curriculum.manifest.json';

const paths = lessonPathsFromManifest(manifest);
const visit = (at: number) => ({ firstVisitedAt: at, lastVisitedAt: at, visits: 1 });

describe('lessonPathsFromManifest', () => {
  it('lists every lesson in the generated curriculum, once, with each module index first', () => {
    const generated = curriculumData.flatMap((tier) =>
      tier.sections.flatMap((section) => section.topics.map((topic) => `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`)),
    );
    expect(new Set(paths).size).toBe(paths.length);
    expect([...paths].sort()).toEqual([...generated].sort());
    for (const tier of manifest.tiers) {
      for (const module of tier.modules) {
        expect(paths.find((path) => path.includes(`/${module.id}/`))).toBe(moduleHref(module.id));
      }
    }
  });

  it('puts an index page first even when the manifest lists it later', () => {
    expect(
      lessonPathsFromManifest({ tiers: [{ id: 'T1', modules: [{ id: 'M', lessons: ['b', 'index'] }] }] }),
    ).toEqual(['/curriculum/T1/M/index', '/curriculum/T1/M/b']);
  });
});

describe('resumeLessonHref', () => {
  const [first, second, third] = paths;

  it('is null when the browser holds no lesson position', () => {
    expect(resumeLessonHref({ lessons: {} }, {}, paths)).toBeNull();
  });

  it('picks the most recently opened lesson from the lesson log', () => {
    expect(resumeLessonHref({ lessons: { [first]: visit(5), [second]: visit(9), [third]: visit(7) } }, {}, paths)).toBe(second);
  });

  it('ignores a stored lesson that no longer exists', () => {
    expect(resumeLessonHref({ lessons: { '/curriculum/T9/Gone/index': visit(99), [first]: visit(1) } }, {}, paths)).toBe(first);
    expect(resumeLessonHref({ lessons: {} }, { Gone_Module: { completedLessons: [], lastVisitedAt: 99 } }, paths)).toBeNull();
  });

  it('falls back to the legacy per-module record, and takes whichever visit is newer', () => {
    const tier = manifest.tiers[1];
    const module = tier.modules[0];
    const lesson = module.lessons[module.lessons.length - 1];
    const legacyPath = `/curriculum/${tier.id}/${module.id}/${lesson}`;
    const legacy = { [module.id]: { completedLessons: [], lastVisitedAt: 50, lastVisitedLesson: lesson } };
    expect(resumeLessonHref({ lessons: {} }, legacy, paths)).toBe(legacyPath);
    expect(resumeLessonHref({ lessons: { [first]: visit(10) } }, legacy, paths)).toBe(legacyPath);
    expect(resumeLessonHref({ lessons: { [first]: visit(60) } }, legacy, paths)).toBe(first);
  });

  it('reads a legacy entry without a lesson slug as the module index', () => {
    const module = manifest.tiers[0].modules[1];
    expect(resumeLessonHref({ lessons: {} }, { [module.id]: { completedLessons: [], lastVisitedAt: 3 } }, paths)).toBe(
      moduleHref(module.id),
    );
  });

  it('labels the two states in sentence case', () => {
    expect([START_LEARNING_LABEL, CONTINUE_LABEL]).toEqual(['Start learning', 'Continue']);
  });
});

describe('longestContinueLabel', () => {
  it('is the widest "Continue <code>" any lesson produces, so the header reserves its width', () => {
    expect(longestContinueLabel([{ code: 'F1A' }, { code: 'E-UVM-ML-1' }, { code: 'I-SV-1' }])).toBe('Continue E-UVM-ML-1');
    expect(longestContinueLabel([])).toBe('Continue');
  });
});
