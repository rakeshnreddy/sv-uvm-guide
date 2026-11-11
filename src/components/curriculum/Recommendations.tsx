'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { continueAccessibleName, continueLabel, type ContinueLessonEntry, type ContinuePosition } from '@/lib/continue-lesson';
import { labelWithCode, lessonKey, type IndexedLesson } from '@/lib/curriculum-overview';
import type { ResolvedRoute } from '@/lib/learning-paths';
import { nextOnRoute, recentVisits, type ProgressLike, type RouteId } from '@/lib/learning-route-state';
import { cn } from '@/lib/utils';
import { eyebrow, inlineLink, primaryAction, secondaryAction, textLink } from './overview-ui';

export interface RecommendationsProps {
  routes: ResolvedRoute[];
  selectedRoute: RouteId | null;
  /** Lesson visits stored in this browser. */
  progress: ProgressLike;
  /** Every lesson by key, with the next lesson on the learning path. */
  lessons: ReadonlyMap<string, IndexedLesson>;
  /** The lesson to continue, by the one continue rule (src/lib/continue-lesson.ts); null without a position. */
  position: ContinuePosition<ContinueLessonEntry> | null;
  /** False until stored visits have loaded; the box is hidden (its space reserved for a returning learner) until then. */
  ready: boolean;
}

/** The line under "Continue the course": why this lesson is the one to continue. */
export function continueReasonNote(position: ContinuePosition<ContinueLessonEntry>): string {
  const { lastOpened } = position;
  return position.reason === 'next-after-done'
    ? `The lesson after ${labelWithCode(lastOpened.code, lastOpened.title)}, which you marked done.`
    : 'The lesson you opened last.';
}

/**
 * Literal, so Tailwind sees it. The section is in the server HTML but hidden;
 * inline scripts on the curriculum page mark <html> before first paint:
 * RETURNING_ATTRIBUTE (returningLearnerScript) when this browser holds a
 * lesson visit, ROUTE_FOLLOWED_ATTRIBUTE (routeFollowedScript) when it follows
 * a route. Either shows the box at its final size before React hydrates.
 * After a client-side navigation (no inline script) data-ready shows it. A
 * test keeps the attribute names equal.
 */
export const RESUME_BOX_CLASS =
  'hidden [html[data-home-returning]_&]:block [html[data-route-followed]_&]:block data-[ready]:block';

/** The Continue and Recently visited columns before hydration: reserved only for a browser that holds a lesson visit. */
const LESSON_COLUMNS_BEFORE_READY = 'hidden [html[data-home-returning]_&]:grid';
/** The route row before hydration: reserved only for a browser that follows a route. */
const ROUTE_ROW_BEFORE_READY = 'hidden [html[data-route-followed]_&]:block';
/** The route row's rule and spacing when the lesson columns sit above it. */
const ROUTE_ROW_UNDER_COLUMNS = 'mt-5 border-t border-border pt-4';
const ROUTE_ROW_UNDER_COLUMNS_BEFORE_READY =
  'mt-4 [html[data-home-returning]_&]:mt-5 [html[data-home-returning]_&]:border-t [html[data-home-returning]_&]:border-border [html[data-home-returning]_&]:pt-4';
/**
 * The "Recently visited" column before hydration (literal, so Tailwind sees it).
 * Below md it sits under Continue: a 16 px heading, 4 px, then one 24 px row
 * per lesson (two lessons to a row from sm). The resume-recent script sets
 * RECENT_COUNT_ATTRIBUTE to the number it will list, so the column holds
 * exactly that height, and none at all (no gap under Continue) for zero.
 * Without the attribute (storage blocked) it keeps room for three. From md it
 * sits beside Continue and reserves nothing. A test keeps the attribute name
 * equal to the script's.
 */
export const RECENT_COLUMN_BEFORE_READY = [
  'min-h-[5.75rem] sm:min-h-[4.25rem] md:min-h-0',
  '[html[data-resume-recent="0"]_&]:hidden',
  '[html[data-resume-recent="1"]_&]:min-h-[2.75rem] sm:[html[data-resume-recent="1"]_&]:min-h-[2.75rem]',
  '[html[data-resume-recent="2"]_&]:min-h-[4.25rem] sm:[html[data-resume-recent="2"]_&]:min-h-[2.75rem]',
  'md:[html[data-resume-recent]_&]:min-h-0',
].join(' ');

/**
 * The route row's content height, held before and after hydration so its
 * content fills it in place. It sits on an inner box, so the rule and padding
 * above it (when the lesson columns are there) add to it in both states alike.
 * Below sm: the 16 px label, 4 px, the step line, 8 px and the action at its
 * two-line height (106 px); from sm the step line and the action share a row (68 px).
 */
const ROUTE_ROW_HEIGHT = 'min-h-[6.625rem] sm:min-h-[4.25rem]';

/**
 * The actions in the box keep one height whatever their label: on a phone a
 * label may wrap to a second line (never a third), so below sm the action is
 * always two lines tall (58 px) and the box never changes height when the
 * labels arrive. From sm a label fits one line.
 */
const RESUME_ACTION_HEIGHT = 'min-h-[58px] sm:min-h-[44px]';
const RESUME_ACTION_LABEL = 'line-clamp-2 [overflow-wrap:anywhere]';

/**
 * The Continue column (literal, so Tailwind sees it): label, the reason note
 * and the action. The note is one line ("The lesson you opened last."), or two
 * when the lesson follows one marked done, which the resume-recent script marks
 * on <html> (RESUME_DONE_ATTRIBUTE) before first paint. Below sm: 110 px, or
 * 130 px; from sm: 96 px, or 116 px.
 */
export const CONTINUE_COLUMN_CLASS =
  'min-w-0 min-h-[6.875rem] sm:min-h-24 [html[data-resume-done]_&]:min-h-[8.125rem] sm:[html[data-resume-done]_&]:min-h-[7.25rem]';

export const RESUME_SUBTITLE_LESSONS = 'Based on the lessons you opened in this browser.';
export const RESUME_SUBTITLE_ROUTE = 'Based on the route you follow in this browser.';

/**
 * The recently visited lessons to list: the stored visits that are lessons of
 * the index, newest first, without the lesson the Continue action already
 * names, at most `limit`.
 */
export function recentLessonsToList(
  visits: ReadonlyArray<{ moduleId: string; lessonSlug: string }>,
  lessons: ReadonlyMap<string, IndexedLesson>,
  continueHref: string | null,
  limit = 3,
): IndexedLesson[] {
  return visits
    .flatMap((visit) => {
      const lesson = lessons.get(lessonKey(visit.moduleId, visit.lessonSlug));
      return lesson ? [lesson] : [];
    })
    .filter((lesson) => lesson.href !== continueHref)
    .slice(0, limit);
}

/**
 * "Pick up where you left off": first the lesson to continue (the one rule
 * every "Continue" on the site uses: the lesson opened last, or the next one
 * once it is marked done), then the next lesson on the route the learner
 * follows, and their recent lessons. Every suggestion says where it comes
 * from; nothing is presented as a recommendation the site cannot back up.
 *
 * No layout shift when progress loads: the inline scripts reserve exactly the
 * parts this browser will show (the lesson columns for a lesson visit, the
 * route row for a followed route), and the content that arrives after
 * hydration fills them in place. A first-time visitor never sees it (it stays
 * hidden, and out of the accessibility tree, once the browser is known to hold
 * nothing).
 */
export function Recommendations({ routes, selectedRoute, progress, lessons, position, ready }: RecommendationsProps) {
  const route = ready ? (routes.find((r) => r.id === selectedRoute) ?? null) : null;
  const visited = ready ? recentVisits(progress, 4).filter((v) => lessons.has(lessonKey(v.moduleId, v.lessonSlug))) : [];
  const recent = recentLessonsToList(visited, lessons, position?.lesson.href ?? null);
  const hasLessonVisit = Boolean(position || visited.length > 0);
  const shown = ready && Boolean(route || hasLessonVisit);

  const routePosition = route ? nextOnRoute(route.sequence, progress) : null;
  const routeLesson =
    route && routePosition && routePosition.status !== 'complete' ? route.sequence[routePosition.index] : undefined;
  const routeStep = route && routeLesson ? route.steps[routeLesson.stepIndex] : undefined;
  // The route's next lesson is the lesson to continue: one link, under "Continue the course".
  const routeIsContinue = Boolean(position && routeLesson && routeLesson.href === position.lesson.href);

  return (
    <section
      aria-labelledby="resume-heading"
      hidden={!shown}
      data-ready={shown ? '' : undefined}
      data-testid="curriculum-resume"
      className={cn(RESUME_BOX_CLASS, 'mb-12 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card sm:p-6', ready && !shown && '!hidden')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="resume-heading" className="text-h2 text-foreground">
          Pick up where you left off
        </h2>
        {ready ? (
          <p className="text-ui text-muted-foreground">{hasLessonVisit ? RESUME_SUBTITLE_LESSONS : RESUME_SUBTITLE_ROUTE}</p>
        ) : (
          <p className="text-ui text-muted-foreground">
            <span className="hidden [html[data-home-returning]_&]:inline">{RESUME_SUBTITLE_LESSONS}</span>
            <span className="hidden [html[data-route-followed]:not([data-home-returning])_&]:inline">{RESUME_SUBTITLE_ROUTE}</span>
          </p>
        )}
      </div>

      {/* Plain columns inside the one card: no cards inside cards. Shown only when the browser holds a lesson visit. */}
      {(!ready || hasLessonVisit) && (
        <div
          data-testid="curriculum-resume-lessons"
          className={cn(
            'mt-4 grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
            ready ? 'grid' : LESSON_COLUMNS_BEFORE_READY,
          )}
        >
          <div className={CONTINUE_COLUMN_CLASS} data-testid="curriculum-resume-continue">
            {position && (
              <>
                <p className={eyebrow}>Continue the course</p>
                <p className="mt-1 line-clamp-2 min-h-5 text-ui text-muted-foreground [overflow-wrap:anywhere]">{continueReasonNote(position)}</p>
                {/* The view's one filled action (DESIGN.md section 10: Continue comes first). */}
                <Link
                  href={position.lesson.href}
                  data-testid="curriculum-continue"
                  aria-label={continueAccessibleName(position.lesson)}
                  className={cn(primaryAction, RESUME_ACTION_HEIGHT, 'mt-3 max-w-full')}
                >
                  <span className={RESUME_ACTION_LABEL}>
                    {continueLabel(position.lesson)}: {position.lesson.title}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>

          {/* After hydration the column is there only when it lists a lesson: no reserved gap under Continue. */}
          {(!ready || recent.length > 0) && (
            <div data-testid="curriculum-resume-recent" className={cn('min-w-0', !ready && RECENT_COLUMN_BEFORE_READY)}>
              {recent.length > 0 && (
                <>
                  <h3 id="recent-lessons-heading" className={eyebrow}>
                    Recently visited
                  </h3>
                  <ul aria-labelledby="recent-lessons-heading" className="mt-1 grid grid-cols-1 gap-x-6 text-ui sm:grid-cols-2 md:grid-cols-1">
                    {recent.map((lesson) => (
                      <li key={lesson.key} className="flex min-h-6 min-w-0 items-center">
                        <Link href={lesson.href} className={cn(textLink, 'truncate')} title={labelWithCode(lesson.moduleCode, lesson.title)}>
                          {labelWithCode(lesson.moduleCode, lesson.title)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!ready && (
        <div aria-hidden="true" className={cn(ROUTE_ROW_BEFORE_READY, ROUTE_ROW_UNDER_COLUMNS_BEFORE_READY)}>
          <div className={ROUTE_ROW_HEIGHT} />
        </div>
      )}
      {route && (
        <div data-testid="curriculum-resume-route" className={hasLessonVisit ? ROUTE_ROW_UNDER_COLUMNS : 'mt-4'}>
          <div className={ROUTE_ROW_HEIGHT}>
            <p className={eyebrow}>Next on your {route.name} route</p>
            {routeLesson && routeStep ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-ui text-muted-foreground">
                  Step {routeStep.number} of {route.steps.length}: {routeStep.title}
                  {routeIsContinue ? '. It is the lesson to continue.' : ''}
                </p>
                {!routeIsContinue && (
                  <Link href={routeLesson.href} className={cn(position ? secondaryAction : primaryAction, RESUME_ACTION_HEIGHT, 'max-w-full')}>
                    <span className={RESUME_ACTION_LABEL}>
                      {routePosition?.status === 'not-started' ? 'Start with ' : 'Continue with '}
                      {labelWithCode(routeLesson.moduleCode, routeLesson.title)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-1 text-ui text-foreground">
                You have opened every lesson on this route.{' '}
                <a href="#routes" className={inlineLink}>
                  Choose another route
                </a>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Recommendations;
