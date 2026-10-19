import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLACEMENT_ASSESSMENT_VERSION, PLACEMENT_SCORING_VERSION } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getLabById } from '@/lib/lab-registry';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { DAY_MS, localDayKey } from '@/lib/learner-store/time';

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
  usePathname: () => '/dashboard',
}));

// Every flag off, as on the deployed site (GD6: both exports, agreeing).
vi.mock('@/tools/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tools/featureFlags')>();
  const featureFlags = Object.freeze(
    Object.fromEntries(Object.keys(actual.featureFlags).map((flag) => [flag, false])),
  ) as typeof actual.featureFlags;
  return { ...actual, isFeatureEnabled: () => false, featureFlags };
});

const persistence = vi.hoisted(() => ({ target: 'local' as 'local' | 'server' }));

vi.mock('@/lib/persistence/target', () => ({
  usePersistenceTarget: () => ({ target: persistence.target, ready: true }),
  useAccountSession: () => ({ status: 'disabled', userId: null }),
  useServerFeature: () => false,
}));

import DashboardPage, * as dashboardModule from '@/app/(learning)/dashboard/page';

const NOW = new Date(2026, 9, 18, 10, 0).getTime();
const HOUR = 60 * 60 * 1000;
const [tier1] = curriculumData;
const [f1a, f1b] = tier1.sections;
const F1A_PATH = `/curriculum/${tier1.slug}/${f1a.slug}/index`;
const F1B_PATH = `/curriculum/${tier1.slug}/${f1b.slug}/index`;
const TOTAL_LESSONS = curriculumData.reduce((sum, t) => sum + t.sections.reduce((n, s) => n + s.topics.length, 0), 0);
const TIER1_LESSONS = tier1.sections.reduce((n, s) => n + s.topics.length, 0);
const basics = getLabById('basics-1')!;

const FORBIDDEN = [/verification lead/i, /Community rank/i, /badges earned/i, /\/dashboard\/coverage/, /Generate new plan/i, /Coverage snapshot/i];

function envelope(data: unknown): string {
  return JSON.stringify({ v: 1, data });
}

function seedStore() {
  localStorage.setItem(
    'curriculumProgress',
    JSON.stringify({
      [f1a.slug]: { completedLessons: ['index'], completedAt: { index: NOW - HOUR }, lastVisitedAt: NOW - HOUR, lastVisitedLesson: 'index' },
      [f1b.slug]: { completedLessons: [], lastVisitedAt: NOW - 2 * HOUR, lastVisitedLesson: 'index' },
    }),
  );
  localStorage.setItem(
    'sv-uvm-guide:lessons',
    envelope({
      lessons: {
        [F1A_PATH]: { firstVisitedAt: NOW - DAY_MS, lastVisitedAt: NOW - HOUR, visits: 3 },
        [F1B_PATH]: { firstVisitedAt: NOW - 2 * HOUR, lastVisitedAt: NOW - 2 * HOUR, visits: 1 },
      },
    }),
  );
  localStorage.setItem(
    `sv-uvm-guide:lab:basics-1@${basics.version}`,
    envelope({
      labId: 'basics-1',
      labVersion: basics.version,
      currentStepId: basics.steps[1]?.id ?? null,
      completedSteps: [basics.steps[0].id],
      stepEvidence: {},
      fileBuffers: {},
      status: 'in_progress',
      startedAt: NOW - DAY_MS,
      updatedAt: NOW - HOUR,
    }),
  );
  const card = { deckId: 'deck-1', interval: 1, repetitions: 1, ease: 2.5, lastReviewedAt: NOW - DAY_MS, lapses: 0, reviews: 1 };
  localStorage.setItem(
    'sv-uvm-guide:flashcards',
    envelope({
      cards: { 'card-a': { ...card, dueAt: NOW - HOUR }, 'card-b': { ...card, dueAt: NOW + 5 * DAY_MS } },
      decks: { 'deck-1': { lessons: [], cardIds: ['card-a', 'card-b'], firstSeenAt: NOW - DAY_MS, lastSeenAt: NOW - DAY_MS } },
      positions: {},
    }),
  );
  localStorage.setItem(
    'sv-uvm-guide:notebook:note-1',
    envelope({ id: 'note-1', kind: 'note', title: 'Clocking blocks <b>', body: 'Sample at the edge.', createdAt: NOW - DAY_MS, updatedAt: NOW - HOUR }),
  );
  localStorage.setItem(
    'sv-uvm-guide:assessments',
    envelope({
      placement: [
        {
          assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
          scoringVersion: PLACEMENT_SCORING_VERSION,
          responses: [],
          tier: 3,
          routeId: 'practitioner',
          percent: 0.6,
          categories: [],
          completedAt: NOW - DAY_MS,
        },
      ],
      quizzes: {
        [`${F1A_PATH}#0badc0de`]: { lessonPath: F1A_PATH, best: 1, last: 1, total: 4, attempts: 2, lastAt: NOW - HOUR },
      },
    }),
  );
  localStorage.setItem(
    'sv-uvm-guide:activity',
    envelope({ days: { [localDayKey(NOW)]: { lesson: 2 }, [localDayKey(NOW - DAY_MS)]: { quiz: 1 }, [localDayKey(NOW - 3 * DAY_MS)]: { review: 4 } } }),
  );
  localStorage.setItem(
    'sv-uvm-guide:exercise:uvm-phase-sorter',
    JSON.stringify({ bestScore: 80, attempts: 2, lastPlayed: new Date(NOW - DAY_MS).toISOString() }),
  );
}

describe('/dashboard', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
    persistence.target = 'local';
    navigation.notFound.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no requests from the dashboard'))));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('renders a static shell with every flag off, never calling notFound or reading this browser on the server', () => {
    seedStore();
    expect(dashboardModule.dynamic).toBe('error');
    expect(dashboardModule.metadata.title).toBe('Your learning');

    const html = renderToStaticMarkup(<DashboardPage />);

    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(html).toMatch(/<h1[^>]*>Your learning<\/h1>/);
    expect(html).toContain('aria-label="Your learning"');
    expect(html).toContain('Stored only in this browser');
    expect(html).toContain('Reading what this browser has saved');
    // The server render shows none of the stored data, so hydration always matches.
    expect(html).not.toContain('Nothing recorded in this browser yet');
    expect(html).not.toContain('Clocking blocks');
    expect(html).not.toMatch(/<main[\s>]/);
    for (const pattern of FORBIDDEN) expect(html).not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the empty state when nothing is recorded in this browser', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your learning' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Your learning' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    const empty = screen.getByRole('region', { name: 'Nothing recorded in this browser yet' });
    expect(within(empty).getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    expect(within(empty).getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', '/curriculum#route-junior');
    expect(within(empty).getByRole('link', { name: 'Import a backup' })).toHaveAttribute('href', '/settings#data');
    expect(screen.queryByRole('region', { name: 'Lessons' })).not.toBeInTheDocument();
    expect(screen.getByText('Stored only in this browser')).toBeInTheDocument();
    for (const pattern of FORBIDDEN) expect(document.body.textContent ?? '').not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the real counts from a seeded store and links each area', () => {
    seedStore();
    localStorage.setItem('svuvm.learningRoute', 'junior');
    render(<DashboardPage />);

    const continueCard = screen.getByRole('region', { name: 'Continue' });
    expect(within(continueCard).getByRole('link', { name: /^Back to F1A: The Cost of Bugs/ })).toHaveAttribute('href', F1A_PATH);
    expect(within(continueCard).getByText('Next on your Junior route')).toBeInTheDocument();
    expect(within(continueCard).getByRole('link', { name: /^Continue with / }).getAttribute('href')).toMatch(/^\/curriculum\/T\d_/);

    const lessons = screen.getByRole('region', { name: 'Lessons' });
    expect(within(lessons).getByTestId('dashboard-lesson-totals')).toHaveTextContent(
      `1 done and 2 opened, of ${TOTAL_LESSONS} lessons.`,
    );
    expect(lessons).toHaveTextContent(`1 of ${TIER1_LESSONS} done (${Math.round((1 / TIER1_LESSONS) * 100)}%) · 2 opened`);
    expect(within(lessons).getByText('Modules you opened (2)')).toBeInTheDocument();
    expect(within(lessons).getByRole('link', { name: 'F1A: The Cost of Bugs' })).toHaveAttribute('href', F1A_PATH);

    const labs = screen.getByRole('region', { name: 'Labs' });
    const lab = within(labs).getByRole('link', { name: basics.title.replace(/\s+/g, ' ').trim() });
    expect(lab).toHaveAttribute('href', '/practice/lab/basics-1');
    expect(labs).toHaveTextContent(`In progress (1)`);
    expect(labs).toHaveTextContent(`1 of ${basics.steps.length} steps done`);

    const review = screen.getByRole('region', { name: 'Review' });
    expect(review).toHaveTextContent('1 card due today');
    expect(review).toHaveTextContent('2 cards in your review queue.');
    expect(within(review).getByRole('link', { name: 'Open the review queue' })).toHaveAttribute('href', '/dashboard/review');

    const notebook = screen.getByRole('region', { name: 'Notebook' });
    expect(notebook).toHaveTextContent('1 note');
    // Learner text is plain text, never markup.
    expect(within(notebook).getByText('Clocking blocks <b>')).toBeInTheDocument();
    expect(within(notebook).getByRole('link', { name: 'Open your notebook' })).toHaveAttribute('href', '/dashboard/notebook');

    const placement = screen.getByRole('region', { name: 'Placement' });
    expect(placement).toHaveTextContent('Start in Tier 3 on the Practitioner route, 60%');
    expect(within(placement).getByRole('link', { name: 'See the Practitioner route' })).toHaveAttribute(
      'href',
      '/curriculum#route-practitioner',
    );
    expect(placement).not.toHaveTextContent('The quiz has changed');

    const quizzes = screen.getByRole('region', { name: 'Quizzes' });
    expect(quizzes).toHaveTextContent('1 lesson quiz taken.');
    expect(within(quizzes).getByRole('link', { name: 'F1A: The Cost of Bugs' })).toHaveAttribute('href', F1A_PATH);
    expect(quizzes).toHaveTextContent('best 1 of 4 (25%)');

    const exercises = screen.getByRole('region', { name: 'Exercises' });
    expect(within(exercises).getByRole('link', { name: 'UVM Phase Sorter' })).toHaveAttribute('href', '/exercises/uvm-phase-sorter');
    expect(exercises).toHaveTextContent('best 80% · 2 attempts');

    const streak = screen.getByRole('region', { name: 'Streak and the last 7 days' });
    expect(streak).toHaveTextContent('2 days in a row');
    const week = within(streak).getByRole('list', { name: 'Activity in the last 7 days' });
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    expect(within(week).getAllByRole('listitem')[6]).toHaveTextContent(/2 activities/);
    expect(within(week).getAllByRole('listitem')[3]).toHaveTextContent(/4 activities/);

    const data = screen.getByRole('region', { name: 'Your data' });
    expect(within(data).getByRole('link', { name: 'Back up or reset your data' })).toHaveAttribute('href', '/settings#data');
    expect(data).toHaveTextContent("You haven't downloaded a backup yet.");
    expect(data).toHaveTextContent("Some browsers clear site data for sites they haven't seen for a while.");

    for (const pattern of FORBIDDEN) expect(document.body.textContent ?? '').not.toMatch(pattern);
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops the backup reminder after a recent export and marks a placement attempt from an older quiz', () => {
    seedStore();
    localStorage.setItem('sv-uvm-guide:meta', envelope({ schemaVersion: 1, createdAt: NOW - 30 * DAY_MS, lastExportAt: NOW - 2 * DAY_MS }));
    const assessments = JSON.parse(localStorage.getItem('sv-uvm-guide:assessments')!);
    assessments.data.placement[0].assessmentVersion = 'placement-v1';
    localStorage.setItem('sv-uvm-guide:assessments', JSON.stringify(assessments));
    render(<DashboardPage />);

    const data = screen.getByRole('region', { name: 'Your data' });
    expect(data).not.toHaveTextContent("You haven't downloaded a backup yet.");
    expect(data).toHaveTextContent('Last backup:');
    expect(screen.getByRole('region', { name: 'Placement' })).toHaveTextContent('The quiz has changed since this attempt.');
    // No route chosen: Continue offers the route chooser.
    expect(within(screen.getByRole('region', { name: 'Continue' })).getByRole('link', { name: 'Choose a route' })).toHaveAttribute(
      'href',
      '/curriculum#routes',
    );
  });

  it('never links a stored quiz path that is not a lesson, such as a javascript: URL from an edited backup', () => {
    seedStore();
    const assessments = JSON.parse(localStorage.getItem('sv-uvm-guide:assessments')!);
    const hostile = ['javascript:alert(document.domain)', '//evil.example/curriculum/x', '/curriculum/T9_Gone/Removed/index'];
    for (const lessonPath of hostile) {
      assessments.data.quizzes[`${lessonPath}#deadbeef`] = { lessonPath, best: 0, last: 0, total: 1, attempts: 1, lastAt: NOW };
    }
    localStorage.setItem('sv-uvm-guide:assessments', JSON.stringify(assessments));
    render(<DashboardPage />);

    const quizzes = screen.getByRole('region', { name: 'Quizzes' });
    // Only the real lesson is counted and listed, linked from the curriculum index.
    expect(quizzes).toHaveTextContent('1 lesson quiz taken.');
    expect(within(quizzes).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([F1A_PATH]);
    for (const lessonPath of hostile) expect(quizzes).not.toHaveTextContent(lessonPath);
    for (const anchor of Array.from(document.querySelectorAll('a'))) {
      const href = anchor.getAttribute('href') ?? '';
      expect(href).not.toMatch(/^\s*javascript:/i);
      expect(href.startsWith('//')).toBe(false);
    }
  });

  it('offers placement and lab entry points when those areas are empty', () => {
    localStorage.setItem('sv-uvm-guide:activity', envelope({ days: { [localDayKey(NOW)]: { lesson: 1 } } }));
    render(<DashboardPage />);

    expect(within(screen.getByRole('region', { name: 'Placement' })).getByRole('link', { name: 'Find your level' })).toHaveAttribute(
      'href',
      '/quiz/placement',
    );
    expect(within(screen.getByRole('region', { name: 'Labs' })).getByRole('link', { name: 'Browse the labs' })).toHaveAttribute(
      'href',
      '/practice#labs',
    );
    expect(screen.getByRole('region', { name: 'Review' })).toHaveTextContent('0 cards due today');
    expect(screen.getByRole('region', { name: 'Streak and the last 7 days' })).toHaveTextContent('1 day in a row');
  });

  it('does not present local data as the learner’s progress while records live on the server', () => {
    persistence.target = 'server';
    seedStore();
    render(<DashboardPage />);

    expect(screen.getByRole('region', { name: 'Your progress is saved to your account' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lessons' })).not.toBeInTheDocument();
    expect(screen.queryByText('Clocking blocks <b>')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
