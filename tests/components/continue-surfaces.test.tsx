/**
 * One "continue" rule everywhere (DESIGN.md section 10): the landing hero and
 * its returning-learner strip, the public header, the curriculum page's "Pick
 * up where you left off" and the dashboard's Continue card all resolve the
 * same lesson from the same browser state, and name it the same way
 * ("Continue <code>", with the full title in the accessible name).
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/(learning)/dashboard/page';
import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import HeroPrimaryAction from '@/components/home/HeroPrimaryAction';
import ReturningLearnerStrip from '@/components/home/ReturningLearnerStrip';
import PublicHeader, { FIRST_LESSON_HREF } from '@/components/layout/PublicHeader';
import { continueAccessibleName, continueLabel, type ContinueLessonEntry } from '@/lib/continue-lesson';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { PLANNED_MODULES, buildCurriculumOverview, type LessonPosition } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { CURRICULUM_PROGRESS_KEY, LESSONS_KEY } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';

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

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  usePathname: () => '/',
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', systemTheme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('@/components/search/SearchDialog', () => ({ __esModule: true, default: () => null }));

vi.mock('@/lib/persistence/target', () => ({
  usePersistenceTarget: () => ({ target: 'local', ready: true }),
  useAccountSession: () => ({ status: 'disabled', userId: null }),
  useServerFeature: () => false,
}));

const LESSONS = continueLessons();
const byHref = (href: string | undefined): ContinueLessonEntry => LESSONS.find((lesson) => lesson.href === href)!;

const labs = getAllLabs();
const tiers = buildCurriculumOverview({
  data: curriculumData,
  tiers: readManifestTiers(),
  minutesByLesson: readLessonMinutes(curriculumData),
  labs,
  nextOf: (lesson: LessonPosition) => {
    const next = findPrevNextTopics([lesson.tierId, lesson.moduleId, lesson.lessonSlug]).next;
    if (!next) return undefined;
    const [tierId, moduleId, lessonSlug] = next.slug.split('/');
    return { tierId, moduleId, lessonSlug };
  },
});
const routes = resolveRoutes(curriculumData, { labs });
const milestones = resolveMilestones(labs);

/** A lesson in the middle of tier 1 with a next lesson, and the course's final lesson. */
const MIDDLE = LESSONS[5];
const OLDER = LESSONS[2];
const FINAL = LESSONS[LESSONS.length - 1];
const GONE = '/curriculum/T1_Foundational/F0Z_Retired_Module/index';

const moduleOf = (href: string) => href.split('/').slice(-2) as [string, string];

interface StoredVisit {
  href: string;
  at: number;
  done?: boolean;
}

/** Seeds both lesson records the way a lesson page writes them: the lesson log and the legacy per-module record. */
function seed(visits: readonly StoredVisit[]) {
  const log: Record<string, { firstVisitedAt: number; lastVisitedAt: number; visits: number }> = {};
  const progress: Record<string, { completedLessons: string[]; lastVisitedAt: number; lastVisitedLesson: string }> = {};
  for (const { href, at, done } of visits) {
    log[href] = { firstVisitedAt: at, lastVisitedAt: at, visits: 1 };
    const [moduleId, slug] = moduleOf(href);
    const existing = progress[moduleId];
    progress[moduleId] = {
      completedLessons: [...(existing?.completedLessons ?? []), ...(done ? [slug] : [])],
      lastVisitedAt: Math.max(existing?.lastVisitedAt ?? 0, at),
      lastVisitedLesson: existing && existing.lastVisitedAt > at ? existing.lastVisitedLesson : slug,
    };
  }
  localStorage.setItem(LESSONS_KEY, JSON.stringify({ v: 1, data: { lessons: log } }));
  localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify(progress));
}

/** Where each surface's continue action points, or null when it offers no continue. */
function resolvedTargets() {
  const surfaces: Record<string, string | null> = {};

  const landing = render(
    <>
      <HeroPrimaryAction lessons={LESSONS} />
      <ReturningLearnerStrip lessons={LESSONS} />
    </>,
  );
  const hero = screen.getByTestId('hero-primary-action');
  surfaces.landing = hero.getAttribute('data-state') === 'continue' ? hero.getAttribute('href') : null;
  const strip = screen.queryByTestId('returning-continue');
  surfaces.strip = strip && surfaces.landing ? strip.getAttribute('href') : null;
  if (surfaces.landing) expect(hero).toHaveAccessibleName(continueAccessibleName(byHref(surfaces.landing)));
  landing.unmount();

  const header = render(<PublicHeader />);
  const resume = screen.getAllByTestId('public-header-resume')[0];
  surfaces.header = resume.getAttribute('data-state') === 'continue' ? resume.getAttribute('href') : null;
  if (surfaces.header) {
    expect(resume).toHaveAccessibleName(continueAccessibleName(byHref(surfaces.header)));
    expect(resume).toHaveTextContent(continueLabel(byHref(surfaces.header)));
  } else {
    expect(resume).toHaveAttribute('href', FIRST_LESSON_HREF);
  }
  header.unmount();

  const curriculum = render(
    <CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} continueLessons={LESSONS} />,
  );
  const curriculumAction = screen.queryByTestId('curriculum-continue');
  surfaces.curriculum = curriculumAction?.getAttribute('href') ?? null;
  if (curriculumAction) expect(curriculumAction).toHaveAccessibleName(continueAccessibleName(byHref(surfaces.curriculum!)));
  curriculum.unmount();

  const dashboard = render(<DashboardPage />);
  const dashboardAction = screen.queryByTestId('dashboard-continue');
  surfaces.dashboard = dashboardAction?.getAttribute('href') ?? null;
  if (dashboardAction) expect(dashboardAction).toHaveAccessibleName(continueAccessibleName(byHref(surfaces.dashboard!)));
  dashboard.unmount();

  return surfaces;
}

const everywhere = (href: string | null) => ({
  landing: href,
  strip: href,
  header: href,
  curriculum: href,
  dashboard: href,
});

describe('one continue rule on every surface', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('picks lessons that exercise every case', () => {
    expect(MIDDLE.nextHref).toBeDefined();
    expect(byHref(MIDDLE.nextHref)).toBeDefined();
    expect(FINAL.nextHref).toBeUndefined();
    expect(LESSONS.some((lesson) => lesson.href === GONE)).toBe(false);
  });

  it('nothing stored: no surface offers a continue', () => {
    expect(resolvedTargets()).toEqual(everywhere(null));
  });

  it('one lesson opened, not done: every surface continues that lesson', () => {
    seed([{ href: MIDDLE.href, at: 1_000 }]);
    expect(resolvedTargets()).toEqual(everywhere(MIDDLE.href));
  });

  it('the last opened lesson marked done: every surface continues the next lesson on the path', () => {
    seed([
      { href: OLDER.href, at: 1_000 },
      { href: MIDDLE.href, at: 2_000, done: true },
    ]);
    expect(resolvedTargets()).toEqual(everywhere(MIDDLE.nextHref!));
  });

  it('the last opened lesson no longer exists: every surface falls back to the newest lesson that does', () => {
    seed([
      { href: OLDER.href, at: 1_000 },
      { href: GONE, at: 2_000 },
    ]);
    expect(resolvedTargets()).toEqual(everywhere(OLDER.href));
  });

  it('only a lesson that no longer exists: no surface offers a continue', () => {
    seed([{ href: GONE, at: 2_000 }]);
    expect(resolvedTargets()).toEqual(everywhere(null));
  });

  it('the last lesson of the course marked done: every surface stays on it', () => {
    seed([
      { href: MIDDLE.href, at: 1_000 },
      { href: FINAL.href, at: 2_000, done: true },
    ]);
    expect(resolvedTargets()).toEqual(everywhere(FINAL.href));
  });
});
