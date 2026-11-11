import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLACEMENT_ASSESSMENT_VERSION, PLACEMENT_SCORING_VERSION } from '@/components/assessment/placementQuizData';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData } from '@/lib/curriculum-data';
import { getLabById } from '@/lib/lab-registry';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { DAY_MS, localDayKey } from '@/lib/learner-store/time';

// Page modules use the automatic JSX runtime; the test transform expects a global React.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', async () => {
  const { forwardRef } = await import('react');
  // Like next/link, the mock forwards its ref (the progress trace moves focus between its links).
  const MockLink = forwardRef<HTMLAnchorElement, MockNextLinkProps>(({ href, children, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

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
import { DASHBOARD_BODY_MIN_HEIGHT_CLASS, DASHBOARD_TOP_MIN_HEIGHT_CLASS, continuePrimary } from '@/app/(learning)/dashboard/DashboardPageClient';

const NOW = new Date(2026, 9, 18, 10, 0).getTime();
const HOUR = 60 * 60 * 1000;
const [tier1] = curriculumData;
const [f1a, f1b] = tier1.sections;
const F1A_PATH = `/curriculum/${tier1.slug}/${f1a.slug}/index`;
const F1B_PATH = `/curriculum/${tier1.slug}/${f1b.slug}/index`;
// F1A is marked done and opened last in the seeded store, so Continue goes to the lesson after it.
const AFTER_F1A = continueLessons().find((lesson) => lesson.href === continueLessons().find((l) => l.href === F1A_PATH)?.nextHref)!;
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
    expect(dashboardModule.metadata.title).toBe('Dashboard');

    const html = renderToStaticMarkup(<DashboardPage />);

    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(html).toMatch(/<h1[^>]*>Dashboard<\/h1>/);
    expect(html).toContain('aria-label="Your learning"');
    expect(html).toContain('Stored only in this browser');
    expect(html).toContain('Reading what this browser has saved');
    // The body reaches below the fold in every state, so the footer does not jump when the cards arrive after hydration.
    expect(html).toContain(`<div data-testid="dashboard-body" aria-busy="true" class="${DASHBOARD_BODY_MIN_HEIGHT_CLASS}">`);
    expect(DASHBOARD_BODY_MIN_HEIGHT_CLASS).toContain('calc(100svh-20rem)');
    // The server render shows none of the stored data, so hydration always matches.
    expect(html).not.toContain('Nothing recorded in this browser yet');
    // The traces render on the server, every module not started, under a top slot of reserved height.
    expect(html).toContain(`<div data-testid="dashboard-top" class="flex flex-col ${DASHBOARD_TOP_MIN_HEIGHT_CLASS}">`);
    expect(html.match(/data-testid="progress-trace"/g)).toHaveLength(curriculumData.length);
    expect(html).not.toContain('data-state="done"');
    expect(html).not.toContain('data-state="opened"');
    expect(html).toContain('Tier 1: Foundations');
    expect(html).not.toContain('Clocking blocks');
    expect(html).not.toMatch(/<main[\s>]/);
    for (const pattern of FORBIDDEN) expect(html).not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the empty state when nothing is recorded in this browser', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Your learning' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    const empty = screen.getByRole('region', { name: 'Nothing recorded in this browser yet' });
    expect(within(empty).getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    expect(within(empty).getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', '/curriculum#route-junior');
    expect(within(empty).getByRole('link', { name: 'Import a backup' })).toHaveAttribute('href', '/settings#data');
    // A new visitor still sees every tier's trace, every module not started, linking to its module.
    const progress = screen.getByRole('region', { name: 'Progress' });
    expect(within(progress).getAllByTestId('progress-trace')).toHaveLength(curriculumData.length);
    expect(within(progress).getByRole('link', { name: 'F1A: The Cost of Bugs, not started' })).toHaveAttribute('href', F1A_PATH);
    expect(screen.queryByRole('region', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByText('Stored only in this browser')).toBeInTheDocument();
    for (const pattern of FORBIDDEN) expect(document.body.textContent ?? '').not.toMatch(pattern);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives Continue the accent when no route is chosen, and nothing else', () => {
    seedStore();
    render(<DashboardPage />);
    const continueCard = screen.getByRole('region', { name: 'Continue' });
    const resume = within(continueCard).getByTestId('dashboard-continue');
    expect(resume).toHaveClass('bg-primary');
    expect(resume).toHaveAccessibleName(`Continue ${AFTER_F1A.code}: ${AFTER_F1A.title}`);
    expect(document.querySelectorAll('a.bg-primary, button.bg-primary')).toHaveLength(1);
  });

  it('picks the lesson to continue, then the next route lesson, for the accent', () => {
    expect(continuePrimary(true, true)).toBe('continue');
    expect(continuePrimary(false, true)).toBe('next');
    expect(continuePrimary(true, false)).toBe('continue');
    expect(continuePrimary(false, false)).toBeNull();
  });

  it('shows the real counts from a seeded store and links each area', () => {
    seedStore();
    localStorage.setItem('svuvm.learningRoute', 'junior');
    render(<DashboardPage />);

    const continueCard = screen.getByRole('region', { name: 'Continue' });
    // F1A, opened last, is marked done: Continue names the lesson after it and says why.
    expect(within(continueCard).getByTestId('dashboard-continue')).toHaveAttribute('href', AFTER_F1A.href);
    expect(within(continueCard).getByText('Next after F1A, which you marked done')).toBeInTheDocument();
    expect(within(continueCard).getByText('Next on your Junior route')).toBeInTheDocument();
    expect(within(continueCard).getByRole('link', { name: /^Continue with / }).getAttribute('href')).toMatch(/^\/curriculum\/T\d_/);

    const lessons = screen.getByRole('region', { name: 'Progress' });
    expect(within(lessons).getByTestId('dashboard-lesson-totals')).toHaveTextContent(
      `1 done and 2 opened, of ${TOTAL_LESSONS} lessons.`,
    );
    // Tier names come from the navigation config, as everywhere else on the site.
    expect(within(lessons).getByRole('link', { name: 'Tier 1: Foundations' })).toHaveAttribute('href', '/curriculum#t1');
    expect(lessons).not.toHaveTextContent('Tier 1: Foundational');
    expect(within(lessons).getAllByTestId('dashboard-tier-totals')[0]).toHaveTextContent(
      `1 of ${tier1.sections.length} modules · 1 of ${TIER1_LESSONS} lessons done · 1 more opened`,
    );
    const trace1 = within(lessons).getByRole('list', { name: 'Tier 1: Foundations modules' });
    expect(within(trace1).getByRole('link', { name: 'F1A: The Cost of Bugs, done' })).toHaveAttribute('href', F1A_PATH);
    expect(within(trace1).getByRole('link', { name: /^F1B: .*, opened/ })).toHaveAttribute('href', F1B_PATH);
    // The cursor sits on the module of the lesson to continue.
    // (Searched in the traces only: the phone list of each tier's modules says it too.)
    const [cursor, ...others] = within(lessons)
      .getAllByRole('list', { name: / modules$/ })
      .flatMap((trace) => within(trace).queryAllByRole('link', { name: /, where you are$/ }));
    expect(others).toHaveLength(0);
    expect(cursor.getAttribute('aria-label')).toMatch(new RegExp(`^${AFTER_F1A.code}: `));
    expect(within(lessons).getByText('Modules you opened (2)')).toBeInTheDocument();
    expect(within(lessons).getByRole('link', { name: 'F1A: The Cost of Bugs' })).toHaveAttribute('href', F1A_PATH);

    const labs = screen.getByRole('region', { name: 'Labs' });
    const lab = within(labs).getByRole('link', { name: basics.title.replace(/\s+/g, ' ').trim() });
    expect(lab).toHaveAttribute('href', '/practice/lab/basics-1');
    expect(labs).toHaveTextContent(`In progress (1)`);
    expect(labs).toHaveTextContent(`1 of ${basics.steps.length} steps done`);

    const review = screen.getByRole('region', { name: 'Reviews due' });
    expect(review).toHaveTextContent('1 flashcard is due today.');
    expect(review).toHaveTextContent('2 cards in your review queue.');
    expect(within(review).getByRole('link', { name: 'Open the review queue' })).toHaveAttribute('href', '/dashboard/review');

    const notebook = screen.getByRole('region', { name: 'Notebook' });
    expect(notebook).toHaveTextContent('1 note');
    // Learner text is plain text, never markup.
    expect(within(notebook).getByText('Clocking blocks <b>')).toBeInTheDocument();
    expect(within(notebook).getByRole('link', { name: 'Open your notebook' })).toHaveAttribute('href', '/dashboard/notebook');

    // The interview tile sits in the same group as the other activity cards, with its total from the bank data.
    const interview = screen.getByRole('region', { name: 'Interview questions practised' });
    expect(interview.parentElement).toBe(notebook.parentElement);
    expect(interview).toHaveTextContent(/^Interview questions practised0 of \d+/);
    expect(within(interview).getByRole('link', { name: 'Open interview prep' })).toHaveAttribute('href', '/interview-prep');

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
    expect(within(exercises).getByRole('link', { name: 'UVM phase sorter' })).toHaveAttribute('href', '/exercises/uvm-phase-sorter');
    expect(exercises).toHaveTextContent('best 80% · 2 attempts');

    const streak = screen.getByRole('region', { name: 'Streak and the last 7 days' });
    expect(streak).toHaveTextContent('2 days in a row');
    const week = within(streak).getByRole('list', { name: 'Activity in the last 7 days' });
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    expect(within(week).getAllByRole('listitem')[6]).toHaveTextContent(/2 activities/);
    expect(within(week).getAllByRole('listitem')[3]).toHaveTextContent(/4 activities/);

    const data = screen.getByRole('region', { name: 'Your data' });
    expect(within(data).getByRole('link', { name: 'Back up or reset your data' })).toHaveAttribute('href', '/settings#data');
    // One filled accent action per view: Continue; backup and the route's next lesson are secondary.
    expect(within(data).getByRole('link', { name: 'Back up or reset your data' })).not.toHaveClass('bg-primary');
    expect(within(continueCard).getByTestId('dashboard-continue')).toHaveClass('bg-primary');
    expect(within(continueCard).getByRole('link', { name: /^Continue with / })).not.toHaveClass('bg-primary');
    expect(document.querySelectorAll('a.bg-primary, button.bg-primary')).toHaveLength(1);
    expect(data).toHaveTextContent("You haven't downloaded a backup yet.");
    expect(data).toHaveTextContent("Some browsers clear site data for sites they haven't seen for a while.");

    // Order (DESIGN.md section 10): Continue, reviews due, progress, then the rest.
    const order = ['Continue', 'Reviews due', 'Progress', 'Labs'].map((name) => screen.getByRole('region', { name }));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // No card inside the Continue block.
    expect(continueCard.querySelectorAll('[class*="glass"], [data-card]')).toHaveLength(0);

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
    expect(screen.getByRole('region', { name: 'Reviews due' })).toHaveTextContent('No flashcards are due today.');
    expect(screen.getByRole('region', { name: 'Streak and the last 7 days' })).toHaveTextContent('1 day in a row');
  });

  it('does not present local data as the learner’s progress while records live on the server', () => {
    persistence.target = 'server';
    seedStore();
    render(<DashboardPage />);

    expect(screen.getByRole('region', { name: 'Your progress is saved to your account' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Progress' })).not.toBeInTheDocument();
    expect(screen.queryByText('Clocking blocks <b>')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
