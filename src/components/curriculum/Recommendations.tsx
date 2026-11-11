'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { continueAccessibleName, continueLabel, type ContinueLessonEntry, type ContinuePosition } from '@/lib/continue-lesson';
import { labelWithCode, lessonKey, type IndexedLesson } from '@/lib/curriculum-overview';
import type { ResolvedRoute } from '@/lib/learning-paths';
import { nextOnRoute, recentVisits, type ProgressLike, type RouteId } from '@/lib/learning-route-state';
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
  /** False until stored visits have loaded; nothing renders before then. */
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
 * "Pick up where you left off": first the lesson to continue (the one rule
 * every "Continue" on the site uses: the lesson opened last, or the next one
 * once it is marked done), then the next lesson on the route the learner
 * follows, and their recent lessons. Every suggestion says where it comes
 * from; nothing is presented as a recommendation the site cannot back up.
 */
export function Recommendations({ routes, selectedRoute, progress, lessons, position, ready }: RecommendationsProps) {
  if (!ready) return null;

  const route = routes.find((r) => r.id === selectedRoute) ?? null;
  const visits = recentVisits(progress, 4).filter((v) => lessons.has(lessonKey(v.moduleId, v.lessonSlug)));
  if (!route && !position && visits.length === 0) return null;

  const routePosition = route ? nextOnRoute(route.sequence, progress) : null;
  const routeLesson =
    route && routePosition && routePosition.status !== 'complete' ? route.sequence[routePosition.index] : undefined;
  const routeStep = route && routeLesson ? route.steps[routeLesson.stepIndex] : undefined;
  // The route's next lesson is the lesson to continue: one link, under "Continue the course".
  const routeIsContinue = Boolean(position && routeLesson && routeLesson.href === position.lesson.href);

  return (
    <section
      aria-labelledby="resume-heading"
      className="mb-12 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-card sm:p-6"
    >
      <h2 id="resume-heading" className="text-h2 text-foreground">
        Pick up where you left off
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Based on the lessons you opened in this browser.</p>

      {/* Plain columns inside the one card: no cards inside cards. */}
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        {position && (
          <div className="min-w-0">
            <p className={eyebrow}>Continue the course</p>
            <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{continueReasonNote(position)}</p>
            {/* The view's one filled action (DESIGN.md section 10: Continue comes first). */}
            <Link
              href={position.lesson.href}
              data-testid="curriculum-continue"
              aria-label={continueAccessibleName(position.lesson)}
              className={`${primaryAction} mt-3 max-w-full`}
            >
              <span className="[overflow-wrap:anywhere]">
                {continueLabel(position.lesson)}: {position.lesson.title}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        )}

        {route && (
          <div className="min-w-0">
            <p className={eyebrow}>Next on your {route.name} route</p>
            {routeLesson && routeStep ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Step {routeStep.number} of {route.steps.length}: {routeStep.title}
                  {routeIsContinue ? '. It is the lesson to continue.' : ''}
                </p>
                {!routeIsContinue && (
                  <Link href={routeLesson.href} className={`${position ? secondaryAction : primaryAction} mt-3 max-w-full`}>
                    <span className="[overflow-wrap:anywhere]">
                      {routePosition?.status === 'not-started' ? 'Start with ' : 'Continue with '}
                      {labelWithCode(routeLesson.moduleCode, routeLesson.title)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Link>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-foreground">
                You have opened every lesson on this route.{' '}
                <a href="#routes" className={inlineLink}>
                  Choose another route
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>

      {visits.length > 0 && (
        <div className="mt-5">
          <h3 id="recent-lessons-heading" className="text-h4 text-foreground">
            Recently visited
          </h3>
          <ul aria-labelledby="recent-lessons-heading" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {visits.map((visit) => {
              const lesson = lessons.get(lessonKey(visit.moduleId, visit.lessonSlug))!;
              return (
                <li key={lesson.key} className="min-w-0 [overflow-wrap:anywhere]">
                  <Link href={lesson.href} className={textLink}>
                    {labelWithCode(lesson.moduleCode, lesson.title)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default Recommendations;
