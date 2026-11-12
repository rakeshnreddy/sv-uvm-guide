import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CURRICULUM_HREF, PLACEMENT_QUIZ_HREF } from '@/lib/site-links';

import HeroPrimaryAction from './HeroPrimaryAction';
import { COURSE_SPAN, countWord, heroParagraph, type LandingFacts } from './home-stats';
import type { LandingLesson } from './landing-resume';
import PathTierList from './PathTierList';
import type { PathTier } from './path-tiers';

export interface HeroSectionProps {
  facts: LandingFacts;
  /** Every lesson in course order, for the primary action and the path's "You are here". */
  lessons: readonly LandingLesson[];
  /** The four tiers, from the navigation config and the curriculum totals (path-tiers.ts). */
  tiers: readonly PathTier[];
}

/** The headline, as the owner approved it (landing rework, 2026-11-12). */
export const HERO_HEADLINE = `Learn SystemVerilog and UVM verification, ${COURSE_SPAN}`;

/** The secondary action's label; its href is the curriculum page. */
export const BROWSE_CURRICULUM_LABEL = 'Browse the curriculum';

/** The line at the top of "The path". */
export function pathLine(tierCount: number): string {
  const word = countWord(tierCount);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} tiers, in the order each lesson needs the last.`;
}

/**
 * The landing hero: a split on the colour field, with no background of its
 * own. Left, the headline, one paragraph of counts, the one filled action
 * with "Browse the curriculum" beside it and a quiet line to the placement
 * quiz. Right, "The path": the page's one real-glass card, one row per tier.
 * On phones the card follows the actions. Server markup, so it is complete
 * before and without JavaScript; the primary action and the path's tag are
 * small client islands with reserved sizes.
 */
export default function HeroSection({ facts, lessons, tiers }: HeroSectionProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      data-testid="home-hero"
      className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[minmax(0,8fr)_minmax(0,7fr)] lg:gap-12 lg:py-20"
    >
      <div className="min-w-0">
        <h1 id="hero-heading" className="text-display text-foreground [text-wrap:balance]">
          {HERO_HEADLINE}
        </h1>
        <p className="mt-6 max-w-[34em] text-lead text-muted-foreground">{heroParagraph(facts)}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <HeroPrimaryAction lessons={lessons} />
          {/* On phones both buttons are full width with a left label and an arrow, so they line up. */}
          <Button asChild size="lg" variant="secondary" className="w-full justify-between px-5 sm:w-auto sm:justify-center">
            <Link href={CURRICULUM_HREF} data-testid="hero-browse-curriculum">
              {BROWSE_CURRICULUM_LABEL}
              <ArrowRight aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 sm:hidden" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-ui text-muted-foreground [text-wrap:pretty]">
          Not a beginner?{' '}
          <Link
            href={PLACEMENT_QUIZ_HREF}
            data-testid="hero-find-level"
            className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Find your level
          </Link>{' '}
          with a {facts.placementQuestionCount}-question placement quiz.
        </p>
      </div>
      <Card as="section" variant="glass" padding="none" aria-labelledby="hero-path-heading" data-testid="home-hero-card" className="min-w-0 rounded-2xl px-5 pb-2 pt-5 sm:px-6">
        <h2 id="hero-path-heading" className="text-h4 text-foreground">
          The path
        </h2>
        <p className="mb-3 mt-1 text-ui text-muted-foreground">{pathLine(tiers.length)}</p>
        <PathTierList tiers={tiers} lessons={lessons} />
      </Card>
    </section>
  );
}
