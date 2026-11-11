/**
 * The curriculum index's "before first paint" marks: the inline scripts that
 * mark <html> (the followed route, the number of recent lessons, a lesson
 * continued after one marked done) and the server markup that uses them, so
 * the page paints at its final size for a returning learner.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CurriculumOverview from '@/components/curriculum/CurriculumOverview';
import { CONTINUE_COLUMN_CLASS, RECENT_COLUMN_BEFORE_READY, recentLessonsToList } from '@/components/curriculum/Recommendations';
import {
  RECENT_COUNT_ATTRIBUTE,
  RECENT_LIMIT,
  RESUME_DONE_ATTRIBUTE,
  lessonKeyOfHref,
  recentScriptLessons,
  resumeRecentScript,
} from '@/components/curriculum/resume-recent-script';
import { ROUTE_FOLLOWED_ATTRIBUTE, routeFollowedScript } from '@/components/curriculum/route-followed-script';
import { ROUTE_PRE_PAINT, routeStepsToggleLabel } from '@/components/curriculum/RouteChooser';
import { continueLesson } from '@/lib/continue-lesson';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import { PLANNED_MODULES, buildCurriculumOverview, indexOverviewLessons, lessonKey, type LessonPosition } from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { LESSONS_KEY } from '@/lib/learner-store/keys';
import { resolveMilestones, resolveRoutes } from '@/lib/learning-paths';
import { ROUTE_IDS, ROUTE_STORAGE_KEY, recentVisits } from '@/lib/learning-route-state';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
const lessons = continueLessons();
const indexLessons = indexOverviewLessons(tiers);
const MARKS = [ROUTE_FOLLOWED_ATTRIBUTE, RECENT_COUNT_ATTRIBUTE, RESUME_DONE_ATTRIBUTE];

const overview = () => (
  <CurriculumOverview tiers={tiers} routes={routes} milestones={milestones} planned={PLANNED_MODULES} continueLessons={lessons} />
);

function clearMarks() {
  for (const attribute of MARKS) document.documentElement.removeAttribute(attribute);
}

beforeEach(() => {
  localStorage.clear();
  clearMarks();
});
afterEach(clearMarks);

/** What "Recently visited" lists after hydration, by the component's own functions. */
function listedAfterHydration(progress: Record<string, { completedLessons: string[]; lastVisitedAt?: number; lastVisitedLesson?: string }>, log: Record<string, { firstVisitedAt: number; lastVisitedAt: number; visits: number }>) {
  const position = continueLesson({ lessons: log }, progress, lessons);
  const visited = recentVisits(progress, 4).filter((visit) => indexLessons.has(lessonKey(visit.moduleId, visit.lessonSlug)));
  return { count: recentLessonsToList(visited, indexLessons, position?.lesson.href ?? null).length, done: position?.reason === 'next-after-done' };
}

/** A small deterministic generator, so a failure names a state that can be replayed. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('the route-followed script', () => {
  it('marks <html> with the id of the followed route, and nothing for an unknown value', () => {
    for (const id of ROUTE_IDS) {
      clearMarks();
      localStorage.setItem(ROUTE_STORAGE_KEY, id);
      new Function(routeFollowedScript())();
      expect(document.documentElement.getAttribute(ROUTE_FOLLOWED_ATTRIBUTE)).toBe(id);
    }
    clearMarks();
    localStorage.setItem(ROUTE_STORAGE_KEY, 'not-a-route');
    new Function(routeFollowedScript())();
    expect(document.documentElement).not.toHaveAttribute(ROUTE_FOLLOWED_ATTRIBUTE);
  });

  it('draws the followed route as followed in the server HTML, from the attribute alone', () => {
    const html = renderToString(overview());
    for (const id of ROUTE_IDS) {
      const route = routes.find((candidate) => candidate.id === id)!;
      // The stand-in for "Steps on this route": the same words, hidden unless <html> names this route.
      expect(ROUTE_PRE_PAINT[id].toggle).toContain(`[html[${ROUTE_FOLLOWED_ATTRIBUTE}=${id}]_&]:inline-flex`);
      expect(ROUTE_PRE_PAINT[id].card).toContain(`[html[${ROUTE_FOLLOWED_ATTRIBUTE}=${id}]_&]:bg-muted`);
      expect(html).toContain(ROUTE_PRE_PAINT[id].toggle.replace(/&/g, '&amp;'));
      expect(html).toContain(routeStepsToggleLabel(route));
    }
    expect(html.match(/data-testid="route-steps-toggle-pre-paint"/g)).toHaveLength(ROUTE_IDS.length);
  });

  it('drops the stand-ins once React runs: the real toggle replaces them', () => {
    localStorage.setItem(ROUTE_STORAGE_KEY, 'junior');
    const { container } = render(overview());
    expect(container.querySelectorAll('[data-testid=route-steps-toggle-pre-paint]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid=route-steps-toggle]')).toHaveLength(1);
  });
});

describe('the resume-recent script', () => {
  const script = resumeRecentScript(recentScriptLessons(lessons));
  const run = () => {
    clearMarks();
    new Function(script)();
    return {
      count: document.documentElement.getAttribute(RECENT_COUNT_ATTRIBUTE),
      done: document.documentElement.hasAttribute(RESUME_DONE_ATTRIBUTE),
    };
  };

  it('keeps the lesson table small and in course order', () => {
    const table = recentScriptLessons(lessons);
    expect(table.keys).toEqual(lessons.map((lesson) => lessonKeyOfHref(lesson.href)));
    // The next lesson is almost always the following one, so only the exceptions are carried.
    expect(Object.keys(table.next).length).toBeLessThan(lessons.length / 4);
    expect(script.length).toBeLessThan(8_000);
    expect(script).not.toMatch(/<\/script/i);
  });

  it('counts what "Recently visited" will list, exactly as the page does after hydration', () => {
    const next = random(7);
    const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)];
    const moduleIds = [...new Set(lessons.map((lesson) => lessonKeyOfHref(lesson.href).split('/')[0]))];
    for (let trial = 0; trial < 300; trial++) {
      const progress: Record<string, { completedLessons: string[]; lastVisitedAt?: number; lastVisitedLesson?: string }> = {};
      const log: Record<string, { firstVisitedAt: number; lastVisitedAt: number; visits: number }> = {};
      const visits = Math.floor(next() * 7);
      for (let i = 0; i < visits; i++) {
        const lesson = pick(lessons);
        const [moduleId, slug] = lessonKeyOfHref(lesson.href).split('/');
        const at = 1_000 + Math.floor(next() * 10_000);
        progress[moduleId] = { completedLessons: next() < 0.3 ? [slug] : [], lastVisitedAt: at, lastVisitedLesson: slug };
        if (next() < 0.5) log[lesson.href] = { firstVisitedAt: at, lastVisitedAt: at + (next() < 0.5 ? 5 : -5), visits: 1 };
      }
      // Now and then a module or lesson the index no longer has.
      if (next() < 0.2) progress[pick(moduleIds)] = { completedLessons: [], lastVisitedAt: 20_000, lastVisitedLesson: 'gone' };
      if (next() < 0.1) progress.Gone_Module = { completedLessons: [], lastVisitedAt: 30_000, lastVisitedLesson: 'index' };
      localStorage.clear();
      localStorage.setItem('curriculumProgress', JSON.stringify(progress));
      localStorage.setItem(LESSONS_KEY, JSON.stringify({ version: 1, data: { lessons: log } }));
      const expected = listedAfterHydration(progress, log);
      expect(run(), JSON.stringify({ progress, log })).toEqual({ count: String(expected.count), done: expected.done });
    }
  });

  it('marks nothing when storage holds nothing readable', () => {
    localStorage.setItem('curriculumProgress', '{not json');
    expect(run()).toEqual({ count: null, done: false });
    localStorage.clear();
    expect(run()).toEqual({ count: '0', done: false });
  });

  it('is what the recent column and the Continue column reserve their height from', () => {
    expect(RECENT_LIMIT).toBe(3);
    expect(RECENT_COLUMN_BEFORE_READY).toContain(`[html[${RECENT_COUNT_ATTRIBUTE}="0"]_&]:hidden`);
    expect(RECENT_COLUMN_BEFORE_READY).toContain(`[html[${RECENT_COUNT_ATTRIBUTE}="1"]_&]:min-h-[2.75rem]`);
    expect(CONTINUE_COLUMN_CLASS).toContain(`[html[${RESUME_DONE_ATTRIBUTE}]_&]:min-h-[8.125rem]`);
  });
});

describe('recently visited after hydration', () => {
  it('leaves no empty column, and so no gap under Continue, when it lists nothing', async () => {
    localStorage.setItem(
      'curriculumProgress',
      JSON.stringify({ F2D_Reusable_Code_and_Parallelism: { completedLessons: [], lastVisitedAt: 1_000, lastVisitedLesson: 'ipc' } }),
    );
    const { findByTestId, queryByTestId } = render(overview());
    await findByTestId('curriculum-continue');
    expect(queryByTestId('curriculum-resume-recent')).toBeNull();
  });
});
