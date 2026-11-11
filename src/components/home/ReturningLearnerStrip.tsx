'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';

import { tierProgressText } from '@/components/curriculum/tier-trace';
import { ProgressTraceView, useTierTrace } from '@/components/learner/ProgressTrace';
import { SECTION_HEADING_CLASS } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { SignalTag } from '@/components/ui/SignalTag';
import type { StaticModule, StaticTier } from '@/lib/learner-stats';
import { useHydrated, useRecord } from '@/lib/learner-store/react';
import { countDueCards, flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { tierName } from '@/lib/progress-trace';
import { REVIEW_HREF } from '@/lib/site-links';
import { tierNumber } from '@/lib/curriculum-overview';
import { cn } from '@/lib/utils';

import type { ContinueReason, LandingLesson } from './landing-resume';
import { useLandingResume } from './use-landing-resume';

interface ReturningLearnerStripProps {
  lessons: readonly LandingLesson[];
}

/**
 * "Pick up where you left off" (DESIGN.md section 10), shown only when this
 * browser holds a lesson visit: the lesson to continue and the reviews due.
 *
 * Zero layout shift: the box is in the server HTML but hidden. The inline
 * script (returningLearnerScript) marks <html> before first paint when the
 * browser holds a visit, which shows the box at its final size; the two
 * cards have fixed heights, so the content that arrives after hydration fills
 * them without moving anything. A first-time visitor never sees it. After a
 * client-side navigation (no inline script), data-ready shows it.
 */
/** Literal, so Tailwind sees it; the attribute is RETURNING_ATTRIBUTE (a test keeps them equal). */
export const STRIP_CLASS = 'hidden [html[data-home-returning]_&]:block data-[ready]:block';

/**
 * The trace line. Below 640 px, two fixed rows of 20 px: the tier's name and
 * the count on the first (each whole), the miniature trace on the second.
 * From 640 px, one row of 20 px: name, trace, count.
 */
export const TRACE_LINE_CLASS =
  'grid h-11 min-w-0 basis-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[20px_20px] items-center gap-x-3 gap-y-1 text-ui text-muted-foreground sm:flex sm:h-5 lg:basis-auto';

const linkClass =
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatDay(at: number): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(at);
}

/** "/curriculum/<Tier>/<Module>/<lesson>" -> its three parts, or null for any other path. */
function lessonParts(href: string): { tierId: string; moduleId: string; slug: string } | null {
  const [, root, tierId, moduleId, slug] = href.split('/');
  return root === 'curriculum' && tierId && moduleId && slug ? { tierId, moduleId, slug } : null;
}

/**
 * The tier that holds the lesson at `href`, built from the landing page's
 * lesson list (every lesson in course order, continueLessons()), in the shape
 * the progress trace reads: the same modules and lessons, in the same order,
 * as buildCurriculumTotals gives the dashboard (a unit test holds them equal).
 * A module's title is its index lesson's title (the lesson list names an index
 * lesson by its module). Null for a path outside the curriculum.
 */
export function tierOfLesson(lessons: readonly LandingLesson[], href: string): StaticTier | null {
  const target = lessonParts(href);
  if (!target) return null;
  const modules = new Map<string, StaticModule>();
  for (const lesson of lessons) {
    const parts = lessonParts(lesson.href);
    if (!parts || parts.tierId !== target.tierId) continue;
    let mod = modules.get(parts.moduleId);
    if (!mod) {
      mod = { id: parts.moduleId, code: lesson.code, title: lesson.title, tierId: parts.tierId, lessons: [] };
      modules.set(parts.moduleId, mod);
    }
    if (parts.slug === 'index') mod.title = lesson.title;
    mod.lessons.push({ slug: parts.slug, title: lesson.title, href: lesson.href });
  }
  if (modules.size === 0) return null;
  return {
    id: target.tierId,
    number: tierNumber(target.tierId),
    label: tierName(target.tierId),
    modules: [...modules.values()],
  };
}

/** The line above the lesson: why it is the one to continue, and when it was last opened. */
export function continueNote(
  lesson: LandingLesson | null,
  lastOpened: LandingLesson | null,
  reason: ContinueReason | null,
  lastVisitedAt: number | null,
): string {
  if (!lesson || !lastOpened) return 'Your saved lesson has moved. Start from lesson 1';
  if (reason === 'next-after-done') return `Next after ${lastOpened.code}, which you marked done`;
  return lastVisitedAt ? `Last opened on ${formatDay(lastVisitedAt)}` : 'Last opened';
}

export default function ReturningLearnerStrip({ lessons }: ReturningLearnerStripProps) {
  const hydrated = useHydrated();
  const { lesson, lastOpened, reason, hasPosition, lastVisitedAt } = useLandingResume(lessons);
  const flashcards = useRecord(flashcardRecord);
  const due = useMemo(() => (hydrated ? countDueCards(flashcards, Date.now()) : null), [hydrated, flashcards]);
  const target = lesson ?? lessons[0];
  // The miniature trace for the tier of the lesson to continue (DESIGN.md section 10).
  const tier = useMemo(
    () => (hydrated && hasPosition && target ? tierOfLesson(lessons, target.href) : null),
    [hydrated, hasPosition, target, lessons],
  );
  // The same trace the curriculum index draws for this tier, so the miniature and the count in words agree.
  const trace = useTierTrace(tier, lesson?.href ?? null);
  const traceText = trace ? tierProgressText(trace) : null;

  return (
    <section
      aria-labelledby="returning-heading"
      data-testid="returning-learner"
      data-ready={hydrated && hasPosition ? '' : undefined}
      className={cn(STRIP_CLASS, 'mt-16 lg:mt-20', hydrated && !hasPosition && '!hidden')}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="returning-heading" className={SECTION_HEADING_CLASS}>
          Pick up where you left off
        </h2>
        {/*
         * Always in the box at a fixed height (its own line below 1024 px), so the trace arriving after hydration moves
         * nothing. Below 640 px it is two rows (TRACE_LINE_CLASS), so the tier's name and the count both fit whole.
         */}
        <p data-testid="returning-trace" className={TRACE_LINE_CLASS}>
          {tier && trace ? (
            <>
              <span aria-hidden="true" data-part="tier" className="min-w-0 truncate">
                {tier.label}
              </span>
              <ProgressTraceView trace={trace} size="mini" className="col-span-2 row-start-2 justify-self-start" />
              {/* The trace's totals in words; hidden from assistive technology, since the trace's name says it. */}
              {traceText ? (
                <span aria-hidden="true" data-testid="returning-trace-count" className="col-start-2 row-start-1 shrink-0 whitespace-nowrap tabular-nums">
                  {traceText}
                </span>
              ) : null}
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card variant="glassQuietInteractive" padding="default" className="flex h-32 flex-col gap-3 overflow-hidden">
          {hydrated && target ? (
            <>
              <p className="text-label text-muted-foreground">{continueNote(lesson, lastOpened, reason, lastVisitedAt)}</p>
              <div className="flex min-w-0 items-start gap-2">
                <SignalTag code={target.code} className="mt-1 shrink-0" />
                {/* The full title, up to two lines: the hero's button names only the code. */}
                <Link
                  href={target.href}
                  data-testid="returning-continue"
                  className="line-clamp-2 min-w-0 text-h4 text-foreground after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {target.title}
                </Link>
              </div>
            </>
          ) : null}
        </Card>
        <Card variant="glassQuiet" padding="default" className="flex h-32 flex-col justify-between overflow-hidden">
          {due !== null ? (
            <>
              <p className="text-ui text-foreground">
                <span data-testid="returning-due" className="mr-2 font-mono text-h2 tabular-nums">
                  {due}
                </span>
                {due === 1 ? 'review due today' : 'reviews due today'}
              </p>
              <Link href={REVIEW_HREF} className={cn(linkClass, 'self-start text-ui')}>
                Open the review queue
              </Link>
            </>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
