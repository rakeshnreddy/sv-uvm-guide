'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { labelWithCode, lessonKey, type IndexedLesson } from '@/lib/curriculum-overview';
import type { ResolvedRoute } from '@/lib/learning-paths';
import { nextOnRoute, recentVisits, type ProgressLike, type RouteId } from '@/lib/learning-route-state';
import { eyebrow, inlineLink, primaryAction, textLink } from './overview-ui';

export interface RecommendationsProps {
  routes: ResolvedRoute[];
  selectedRoute: RouteId | null;
  /** Lesson visits stored in this browser. */
  progress: ProgressLike;
  /** Every lesson by key, with the next lesson on the learning path. */
  lessons: ReadonlyMap<string, IndexedLesson>;
  /** False until stored visits have loaded; nothing renders before then. */
  ready: boolean;
}

/**
 * "Pick up where you left off": the next lesson on the route the learner
 * follows, the lesson after the one they opened last, and their recent
 * lessons. Every suggestion says where it comes from; nothing is presented as
 * a recommendation the site cannot back up.
 */
export function Recommendations({ routes, selectedRoute, progress, lessons, ready }: RecommendationsProps) {
  if (!ready) return null;

  const route = routes.find((r) => r.id === selectedRoute) ?? null;
  const visits = recentVisits(progress, 4).filter((v) => lessons.has(lessonKey(v.moduleId, v.lessonSlug)));
  if (!route && visits.length === 0) return null;

  const routePosition = route ? nextOnRoute(route.sequence, progress) : null;
  const routeLesson =
    route && routePosition && routePosition.status !== 'complete' ? route.sequence[routePosition.index] : undefined;
  const routeStep = route && routeLesson ? route.steps[routeLesson.stepIndex] : undefined;

  const last = visits[0] ? lessons.get(lessonKey(visits[0].moduleId, visits[0].lessonSlug)) : undefined;
  const courseNext = last?.next ? lessons.get(last.next) : undefined;
  const showCourseNext = Boolean(last) && courseNext?.key !== routeLesson?.key;

  return (
    <section
      aria-labelledby="resume-heading"
      className="mb-12 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6"
    >
      <h2 id="resume-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
        Pick up where you left off
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Based on the lessons you opened in this browser.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {route && (
          <div className="min-w-0 rounded-2xl border border-border bg-background p-4">
            <p className={eyebrow}>Next on your {route.name} route</p>
            {routeLesson && routeStep ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Step {routeStep.number} of {route.steps.length}: {routeStep.title}
                </p>
                <Link href={routeLesson.href} className={`${primaryAction} mt-3 max-w-full`}>
                  <span className="[overflow-wrap:anywhere]">
                    {routePosition?.status === 'not-started' ? 'Start with ' : 'Continue with '}
                    {labelWithCode(routeLesson.moduleCode, routeLesson.title)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
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

        {showCourseNext && last && (
          <div className="min-w-0 rounded-2xl border border-border bg-background p-4">
            <p className={eyebrow}>Continue the course</p>
            {courseNext ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  The lesson after {labelWithCode(last.moduleCode, last.title)}, which you opened last.
                </p>
                <Link href={courseNext.href} className={`${primaryAction} mt-3 max-w-full`}>
                  <span className="[overflow-wrap:anywhere]">
                    Continue with {labelWithCode(courseNext.moduleCode, courseNext.title)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
                You last opened {labelWithCode(last.moduleCode, last.title)}, the final lesson of the curriculum.
              </p>
            )}
          </div>
        )}
      </div>

      {visits.length > 0 && (
        <div className="mt-5">
          <h3 id="recent-lessons-heading" className="text-sm font-semibold text-foreground">
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
