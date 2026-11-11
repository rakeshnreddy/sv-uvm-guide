import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/Button';
import { PLACEMENT_QUIZ_HREF } from '@/lib/site-links';

import HeroPrimaryAction from './HeroPrimaryAction';
import { heroParagraph, plural, type HomeStats } from './home-stats';
import type { LandingLesson } from './landing-resume';
import SchedulerFrame from './SchedulerFrame';
import type { SchedulerFrame as Frame } from './scheduler-frame';

export interface HeroSectionProps {
  stats: HomeStats;
  /** Every lesson in course order, for the primary action. */
  lessons: readonly LandingLesson[];
  /** Questions in the placement quiz, for the note under the actions. */
  placementQuestionCount: number;
  frame: Frame;
}

/** The quiet note under the actions, its count from the placement quiz's own data. */
export function placementNote(questionCount: number): string {
  return `Placement quiz: ${plural(questionCount, 'question', 'questions')}, suggests where to start`;
}

/** The headline, as the owner approved it (SPEC-phases-2-4.md, phase 4). */
export const HERO_HEADLINE = 'SystemVerilog and UVM, one clock edge at a time';

/**
 * The landing hero: an asymmetric split on the colour field, with no eyebrow
 * and no background of its own. Left, the headline, one paragraph of counts
 * and two actions; right (at least half the width from 1024 px), one frame of
 * the scheduler model. On phones the frame follows the actions. Server markup,
 * so it is complete before and without JavaScript; only the primary action is
 * a client island, at a fixed width.
 */
export default function HeroSection({ stats, lessons, placementQuestionCount, frame }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-heading" data-testid="home-hero" className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:py-20">
      <div className="min-w-0">
        <h1 id="hero-heading" className="text-display text-foreground [text-wrap:balance]">
          {HERO_HEADLINE}
        </h1>
        <p className="mt-6 max-w-[34em] text-lead text-muted-foreground">{heroParagraph(stats)}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <HeroPrimaryAction lessons={lessons} />
          {/* On phones both buttons are full width with a left label and an arrow, so they line up. */}
          <Button asChild size="lg" variant="secondary" className="w-full justify-between px-5 sm:w-auto sm:justify-center">
            <Link href={PLACEMENT_QUIZ_HREF} data-testid="hero-find-level">
              Find your level
              <ArrowRight aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 sm:hidden" />
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-ui text-muted-foreground [text-wrap:pretty]">{placementNote(placementQuestionCount)}</p>
      </div>
      <SchedulerFrame frame={frame} />
    </section>
  );
}
