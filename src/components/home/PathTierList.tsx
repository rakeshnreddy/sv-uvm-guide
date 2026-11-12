'use client';

import Link from 'next/link';
import React from 'react';

import { tierDataAttribute, tierOfModuleCode } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

import { plural } from './home-stats';
import type { LandingLesson } from './landing-resume';
import type { PathTier } from './path-tiers';
import { useLandingResume } from './use-landing-resume';

export const START_HERE_TAG = 'Start here';
export const YOU_ARE_HERE_TAG = 'You are here';

/** The tag's box: the same size in every row and in both states, so nothing moves when it fills or empties. */
export const TAG_SLOT_CLASS = 'inline-flex h-5 w-24 shrink-0 items-center';

/**
 * "Start here" is in the server HTML on Tier 1. For a returning learner the
 * inline script marks <html> before first paint (RETURNING_ATTRIBUTE), which
 * hides it at once; after hydration "You are here" fills the slot of the tier
 * of the continue lesson. Literal, so Tailwind sees it.
 */
export const START_TAG_CLASS = '[html[data-home-returning]_&]:invisible';

const TAG_CLASS = 'rounded border border-tier-current-border bg-tier-current-subtle px-1.5 text-label font-medium leading-[18px] text-tier-current';

/**
 * The rows of "The path": the tier step mark and the tier's name in its
 * colour, the line on what it covers and its lesson count in the mono face.
 * Each name links to the tier's section of the curriculum page, stretched over
 * the row. A client island only for the tag: the shared continue rule decides
 * which tier is "You are here".
 */
export default function PathTierList({ tiers, lessons }: { tiers: readonly PathTier[]; lessons: readonly LandingLesson[] }) {
  const { lesson } = useLandingResume(lessons);
  const hereTier = lesson ? tierOfModuleCode(lesson.code) : undefined;
  return (
    <ol className="divide-y divide-border border-t border-border">
      {tiers.map((tier, index) => {
        const tag = lesson ? (hereTier === tier.number ? YOU_ARE_HERE_TAG : null) : index === 0 ? START_HERE_TAG : null;
        return (
          <li
            key={tier.id}
            data-tier={tierDataAttribute(tier.number)}
            data-testid={`path-tier-${tier.number}`}
            className="relative grid grid-cols-[1.125rem_minmax(0,1fr)_auto] gap-x-3 py-3"
          >
            <span aria-hidden="true" className="tier-step col-start-1 row-start-1 mt-[7px]" />
            {/*
              On phones the name's wrapper dissolves (display: contents) and the tag's
              slot sits under the lesson count, so an empty slot never leaves a blank
              line under the name; from sm up the tag sits beside the name.
            */}
            <p className="contents sm:col-start-2 sm:row-start-1 sm:flex sm:min-w-0 sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
              <Link
                href={tier.href}
                className="col-start-2 row-start-1 min-w-0 font-semibold text-tier-current after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {tier.label}
              </Link>
              <span data-path-tag="" className={cn(TAG_SLOT_CLASS, 'col-start-3 row-start-2 mt-1 justify-end sm:mt-0 sm:justify-start')}>
                {tag ? <span className={cn(TAG_CLASS, tag === START_HERE_TAG && !lesson && START_TAG_CLASS)}>{tag}</span> : null}
              </span>
            </p>
            <p className="col-start-2 row-start-2 mt-0.5 min-w-0 text-ui text-muted-foreground">{tier.covers}</p>
            <span className="col-start-3 row-start-1 mt-0.5 whitespace-nowrap text-right font-mono text-label tabular-nums text-muted-foreground">
              {plural(tier.lessonCount, 'lesson', 'lessons')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
