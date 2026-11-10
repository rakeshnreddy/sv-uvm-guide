import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLACEMENT_ASSESSMENT_VERSION, PLACEMENT_SCORING_VERSION } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getLabById } from '@/lib/lab-registry';
import { buildCurriculumTotals, indexStaticLessons } from '@/lib/learner-stats';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { DAY_MS } from '@/lib/learner-store/time';

// Page modules use the automatic JSX runtime; the test transform expects a global React.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: navigation.notFound,
  usePathname: () => '/assessment',
}));

// SITE_FEATURES.assessmentCenter is always on; 'tracking' no longer changes it. Every other flag stays off.
const flags = vi.hoisted(() => ({ tracking: true }));

vi.mock('@/tools/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tools/featureFlags')>();
  const featureFlags = Object.freeze(
    Object.fromEntries(Object.keys(actual.featureFlags).map((flag) => [flag, false])),
  ) as typeof actual.featureFlags;
  return { ...actual, isFeatureEnabled: (flag: string) => flag === 'tracking' && flags.tracking, featureFlags };
});

const persistence = vi.hoisted(() => ({ target: 'local' as 'local' | 'server' }));

vi.mock('@/lib/persistence/target', () => ({
  usePersistenceTarget: () => ({ target: persistence.target, ready: true }),
  useAccountSession: () => ({ status: 'disabled', userId: null }),
  useServerFeature: () => false,
}));

import {
  buildAssessmentSummary,
  nextLessonInTrack,
  trackForModule,
  TRACKS,
} from '@/app/(learning)/assessment/assessment-model';

const NOW = new Date(2026, 10, 10, 10, 0).getTime();
const HOUR = 60 * 60 * 1000;
const STATIC = buildCurriculumTotals(curriculumData);
const LESSONS = indexStaticLessons(STATIC);

function lessonPath(moduleFolder: string, slug = 'index'): string {
  for (const lesson of LESSONS.values()) {
    if (lesson.moduleId === moduleFolder && lesson.slug === slug) return lesson.href;
  }
  throw new Error(`no lesson ${moduleFolder}/${slug}`);
}

const F1A = 'F1A_The_Cost_of_Bugs';
const SVA = 'I-SV-4A_SVA_Fundamentals';
const F1A_PATH = lessonPath(F1A);
const SVA_PATH = lessonPath(SVA);
const coverageLab = getLabById('coverage-advanced-1')!;
const SVA_DECK = 'I-SV-4A_Assertions_SVA_Fundamentals';

/** Words from the old mock assessment center that must never come back. */
const FORBIDDEN = [/certification/i, /\bcertified\b/i, /skill matrix/i, /adaptive test/i, /competency/i, /industry benchmark/i, /percentile/i];

function envelope(data: unknown): string {
  return JSON.stringify({ v: 1, data });
}

function seedStore() {
  localStorage.setItem(
    'curriculumProgress',
    JSON.stringify({
      [F1A]: { completedLessons: ['index'], completedAt: { index: NOW - DAY_MS }, lastVisitedAt: NOW - DAY_MS, lastVisitedLesson: 'index' },
    }),
  );
  localStorage.setItem(
    'sv-uvm-guide:lessons',
    envelope({
      lessons: {
        [F1A_PATH]: { firstVisitedAt: NOW - 2 * DAY_MS, lastVisitedAt: NOW - DAY_MS, visits: 2 },
        [SVA_PATH]: { firstVisitedAt: NOW - HOUR, lastVisitedAt: NOW - HOUR, visits: 1 },
      },
    }),
  );
  localStorage.setItem(
    `sv-uvm-guide:lab:${coverageLab.id}@${coverageLab.version}`,
    envelope({
      labId: coverageLab.id,
      labVersion: coverageLab.version,
      currentStepId: coverageLab.steps[1]?.id ?? null,
      completedSteps: [coverageLab.steps[0].id],
      stepEvidence: {},
      fileBuffers: {},
      status: 'in_progress',
      startedAt: NOW - DAY_MS,
      updatedAt: NOW - HOUR,
    }),
  );
  const card = { deckId: SVA_DECK, repetitions: 1, ease: 2.5, lastReviewedAt: NOW - DAY_MS, lapses: 0, reviews: 1 };
  localStorage.setItem(
    'sv-uvm-guide:flashcards',
    envelope({
      cards: {
        'sva-a': { ...card, interval: 1, dueAt: NOW - HOUR },
        'sva-b': { ...card, interval: 30, dueAt: NOW + 30 * DAY_MS },
      },
      decks: {
        [SVA_DECK]: { lessons: [], cardIds: ['sva-a', 'sva-b', 'sva-c'], firstSeenAt: NOW - DAY_MS, lastSeenAt: NOW - DAY_MS },
      },
      positions: {},
    }),
  );
  localStorage.setItem(
    'sv-uvm-guide:assessments',
    envelope({
      placement: [
        {
          assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
          scoringVersion: PLACEMENT_SCORING_VERSION,
          responses: [],
          tier: 2,
          routeId: 'junior',
          percent: 0.5,
          categories: [
            { id: 'foundations', percent: 0.75 },
            { id: 'methodology', percent: 0.5 },
            { id: 'debug', percent: 0 },
          ],
          completedAt: NOW - DAY_MS,
        },
      ],
      quizzes: {
        [`${SVA_PATH}#0badc0de`]: { lessonPath: SVA_PATH, best: 1, last: 1, total: 4, attempts: 2, lastAt: NOW - HOUR },
        [`${F1A_PATH}#00c0ffee`]: { lessonPath: F1A_PATH, best: 4, last: 4, total: 4, attempts: 1, lastAt: NOW - DAY_MS },
        // A result for a lesson that does not exist is never shown or linked.
        ['/curriculum/T9_Gone/X-1_Gone/index#12345678']: {
          lessonPath: '/curriculum/T9_Gone/X-1_Gone/index',
          best: 0,
          last: 0,
          total: 3,
          attempts: 1,
          lastAt: NOW,
        },
      },
    }),
  );
}

async function loadPage() {
  return (await import('@/app/(learning)/assessment/page')).default;
}

describe('trackForModule', () => {
  it('sorts module folders, codes and deck ids into the five tracks', () => {
    expect(trackForModule('F2A_Core_Data_Types')).toBe('systemverilog');
    expect(trackForModule('F2_Data_Types')).toBe('systemverilog');
    expect(trackForModule('I-SV-2A_Constrained_Randomization_Fundamentals')).toBe('systemverilog');
    expect(trackForModule('I-SV-8')).toBe('systemverilog');
    expect(trackForModule('I-SV-3B')).toBe('assertions-coverage');
    expect(trackForModule('I-SV-4C_Checkers')).toBe('assertions-coverage');
    expect(trackForModule('I-SV-9_Why_UVM')).toBe('uvm');
    expect(trackForModule('I-UVM-3B_Advanced_Sequencing_and_Layering')).toBe('uvm');
    expect(trackForModule('A-UVM-4A')).toBe('uvm');
    expect(trackForModule('B-AXI-2_AXI_Burst_Math')).toBe('amba');
    expect(trackForModule('B-AMBA-F1')).toBe('amba');
    expect(trackForModule('E-DBG-1')).toBe('expert');
    expect(trackForModule('deck-1')).toBeNull();
  });

  it('places every curriculum module in a track', () => {
    for (const tier of STATIC) {
      for (const mod of tier.modules) expect(trackForModule(mod.id), mod.id).not.toBeNull();
    }
  });
});

describe('nextLessonInTrack', () => {
  const lessons = [...LESSONS.values()].filter((lesson) => trackForModule(lesson.moduleId) === 'systemverilog');

  it('starts at the first lesson when nothing is recorded', () => {
    const next = nextLessonInTrack(lessons, new Set(), new Set());
    expect(next).toEqual({ lesson: lessons[0], continuing: false });
  });

  it('finishes an opened lesson before moving on, then goes past the furthest one', () => {
    const opened = new Set([lessons[3].href]);
    expect(nextLessonInTrack(lessons, new Set(), opened)).toEqual({ lesson: lessons[3], continuing: true });
    const done = new Set([lessons[3].href]);
    expect(nextLessonInTrack(lessons, done, done)?.lesson).toBe(lessons[4]);
  });

  it('returns null when every lesson is done', () => {
    const all = new Set(lessons.map((lesson) => lesson.href));
    expect(nextLessonInTrack(lessons, all, all)).toBeNull();
  });
});

describe('buildAssessmentSummary', () => {
  const empty = {
    curriculum: STATIC,
    labs: [],
    progress: {},
    lessonLog: { lessons: {} },
    labRecords: [],
    flashcards: { cards: {}, decks: {}, positions: {} },
    assessments: { placement: [], quizzes: {} },
    now: NOW,
  };

  it('reports no data, one summary per track and a first lesson for each', () => {
    const summary = buildAssessmentSummary(empty);
    expect(summary.hasData).toBe(false);
    expect(summary.tracks.map((track) => track.id)).toEqual(TRACKS.map((track) => track.id));
    const total = summary.tracks.reduce((sum, track) => sum + track.lessons.total, 0);
    expect(total).toBe(LESSONS.size);
    for (const track of summary.tracks) {
      expect(track.hasActivity).toBe(false);
      expect(track.recommendations).toHaveLength(1);
      expect(track.recommendations[0].kind).toBe('start-lesson');
    }
  });

  it('never gives AMBA or the expert topics a placement result', () => {
    const summary = buildAssessmentSummary({
      ...empty,
      assessments: {
        quizzes: {},
        placement: [
          {
            assessmentVersion: 'v',
            scoringVersion: 's',
            responses: [],
            tier: 1,
            routeId: 'junior',
            percent: 1,
            categories: [
              { id: 'foundations', percent: 1 },
              { id: 'methodology', percent: 1 },
              { id: 'debug', percent: 1 },
            ],
            completedAt: NOW,
          },
        ],
      },
    });
    expect(summary.hasData).toBe(true);
    const byId = new Map(summary.tracks.map((track) => [track.id, track]));
    expect(byId.get('systemverilog')?.placement).toEqual({ area: 'foundations', percent: 1 });
    expect(byId.get('assertions-coverage')?.placement).toEqual({
      area: 'debug',
      percent: 1,
      note: 'That area covers coverage and debug habits, not assertions.',
    });
    expect(byId.get('amba')?.placement).toBeNull();
    expect(byId.get('expert')?.placement).toBeNull();
  });
});

describe('/assessment', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
    flags.tracking = true;
    persistence.target = 'local';
    navigation.notFound.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no requests from the assessment page'))));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('renders whatever the tracking flag says: the self-assessment is always on', async () => {
    flags.tracking = false;
    vi.resetModules();
    const AssessmentPage = await loadPage();
    expect(() => AssessmentPage()).not.toThrow();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it('renders a static shell on the server with no stored data and no mock content', async () => {
    seedStore();
    const pageModule = await import('@/app/(learning)/assessment/page');
    expect(pageModule.dynamic).toBe('error');
    expect(pageModule.metadata.title).toBe('Self-assessment');
    const html = renderToStaticMarkup(<pageModule.default />);
    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(html).toMatch(/<h1[^>]*>Self-assessment<\/h1>/);
    expect(html).toContain('Reading what this browser has saved');
    expect(html).not.toContain('Nothing to assess yet');
    expect(html).not.toContain('Lessons by track');
    for (const pattern of FORBIDDEN) expect(html).not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the empty state when nothing is recorded', async () => {
    const AssessmentPage = await loadPage();
    render(<AssessmentPage />);
    const empty = screen.getByRole('region', { name: 'Nothing to assess yet' });
    expect(within(empty).getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    expect(within(empty).getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', '/curriculum#route-junior');
    expect(within(empty).getByRole('link', { name: 'Import a backup' })).toHaveAttribute('href', '/settings#data');
    expect(screen.queryByRole('region', { name: 'Lessons by track' })).not.toBeInTheDocument();
    for (const pattern of FORBIDDEN) expect(document.body.textContent ?? '').not.toMatch(pattern);
  });

  it('says progress is in the account while server sync is the target', async () => {
    seedStore();
    persistence.target = 'server';
    const AssessmentPage = await loadPage();
    render(<AssessmentPage />);
    expect(screen.getByRole('region', { name: 'Your progress is saved to your account' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lessons by track' })).not.toBeInTheDocument();
  });

  it('summarizes each track from the seeded store and recommends next steps', async () => {
    seedStore();
    const AssessmentPage = await loadPage();
    render(<AssessmentPage />);

    const overview = screen.getByRole('region', { name: 'Lessons by track' });
    const svTotal = [...LESSONS.values()].filter((lesson) => trackForModule(lesson.moduleId) === 'systemverilog').length;
    expect(overview).toHaveTextContent(`1 of ${svTotal} lessons done`);
    expect(within(overview).getAllByRole('listitem')).toHaveLength(5);
    expect(within(overview).getByRole('link', { name: 'AMBA' })).toHaveAttribute('href', '#track-amba');

    const placement = screen.getByRole('region', { name: 'Placement result' });
    expect(placement).toHaveTextContent('50% weighted score (harder questions count more), which places you in Tier 2 on the Junior route');
    const areas = within(placement).getByRole('list', { name: 'Score by area' });
    expect(within(areas).getAllByRole('listitem')).toHaveLength(3);
    expect(areas).toHaveTextContent('Debug & Coverage Habits0% correct, under 75%');
    expect(within(placement).getByRole('link', { name: /^Placement start: / }).getAttribute('href')).toMatch(/^\/curriculum\//);
    expect(placement).not.toHaveTextContent('The placement quiz has changed');

    const sva = screen.getByRole('region', { name: 'Assertions and coverage' });
    expect(sva).toHaveTextContent('0 of');
    expect(sva).toHaveTextContent('1 lesson opened');
    expect(sva).toHaveTextContent('0 of 1 at 75% or more');
    expect(sva).toHaveTextContent('Average best score 25%');
    expect(sva).toHaveTextContent('1 in progress');
    expect(sva).toHaveTextContent('1 of 3 well known');
    expect(sva).toHaveTextContent('2 rated, 1 due today');
    expect(sva).toHaveTextContent('Debug & Coverage Habits');
    const steps = within(sva).getByRole('list', { name: 'Next steps in Assertions and coverage' });
    const links = within(steps).getAllByRole('link');
    expect(links[0]).toHaveTextContent(/^Reread and retake the quiz in I-SV-4A/);
    expect(links[0]).toHaveAttribute('href', SVA_PATH);
    expect(steps).toHaveTextContent('Your best score is 1 of 4 (25%), under 75%.');
    expect(links[1]).toHaveAttribute('href', `/practice/lab/${coverageLab.id}`);
    expect(steps).toHaveTextContent(`1 of ${coverageLab.steps.length} steps done.`);
    // The lesson the retake points at is not listed a second time; due cards come next.
    expect(links[2]).toHaveAttribute('href', '/dashboard/review');
    expect(steps).toHaveTextContent('1 card is due today in this track.');
    expect(links).toHaveLength(3);

    const sv = screen.getByRole('region', { name: 'SystemVerilog' });
    expect(sv).toHaveTextContent('1 of 1 at 75% or more');
    expect(sv).toHaveTextContent('75% correct');
    expect(within(sv).getByRole('list', { name: 'Next steps in SystemVerilog' })).toHaveTextContent(/^Continue with F1B/);

    const amba = screen.getByRole('region', { name: 'AMBA' });
    expect(amba).toHaveTextContent('Nothing recorded in this track yet.');
    expect(amba).toHaveTextContent('The placement quiz does not cover this track.');
    expect(within(amba).getByRole('list', { name: 'Next steps in AMBA' })).toHaveTextContent(/^Start with B-/);

    // The quiz on a lesson that no longer exists is not linked anywhere.
    expect(document.querySelector('a[href*="T9_Gone"]')).toBeNull();
    for (const pattern of FORBIDDEN) expect(document.body.textContent ?? '').not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('marks an attempt from an earlier placement quiz', async () => {
    seedStore();
    const raw = JSON.parse(localStorage.getItem('sv-uvm-guide:assessments') as string);
    raw.data.placement[0].assessmentVersion = 'placement-v1';
    localStorage.setItem('sv-uvm-guide:assessments', JSON.stringify(raw));
    const AssessmentPage = await loadPage();
    render(<AssessmentPage />);
    expect(screen.getByRole('region', { name: 'Placement result' })).toHaveTextContent('The placement quiz has changed');
  });
});
