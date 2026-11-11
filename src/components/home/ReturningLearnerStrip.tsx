'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';

import { SECTION_HEADING_CLASS } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { SignalTag } from '@/components/ui/SignalTag';
import { useHydrated, useRecord } from '@/lib/learner-store/react';
import { countDueCards, flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { REVIEW_HREF } from '@/lib/site-links';
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

const linkClass =
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatDay(at: number): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(at);
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

  return (
    <section
      aria-labelledby="returning-heading"
      data-testid="returning-learner"
      data-ready={hydrated && hasPosition ? '' : undefined}
      className={cn(STRIP_CLASS, 'mt-16 lg:mt-20', hydrated && !hasPosition && '!hidden')}
    >
      <h2 id="returning-heading" className={SECTION_HEADING_CLASS}>
        Pick up where you left off
      </h2>
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
