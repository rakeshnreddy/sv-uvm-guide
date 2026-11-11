'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/Button';
import { SignalTag } from '@/components/ui/SignalTag';

import { START_LESSON_LABEL, continueAccessibleName, type LandingLesson } from './landing-resume';
import { useLandingResume } from './use-landing-resume';

interface HeroPrimaryActionProps {
  /** Every lesson in course order; the first is lesson 1. */
  lessons: readonly LandingLesson[];
}

/**
 * The view's one filled accent button (DESIGN.md section 2 rule 2): "Start
 * lesson 1", which becomes "Continue: <tag> <lesson title>" (for example
 * "Continue: F3C Delta Cycles and Race Conditions") once this browser holds a
 * lesson position (section 10; the rule is continueLesson). A small client
 * island. Its width is fixed from 640 px (full width on phones): 256 px, or
 * 384 px for a returning learner, set before first paint by the inline script's
 * attribute on <html> (RETURNING_ATTRIBUTE in landing-resume), so the secondary action beside it
 * never moves when the stored position appears after hydration. A long title
 * ends in an ellipsis; the accessible name keeps the full title. The server
 * HTML is always "Start lesson 1".
 */
/**
 * From 640 px the button widens for a returning learner, before first paint, so the title has room;
 * after a client-side navigation (no inline script) data-state does it. Literal, so Tailwind sees it;
 * the attribute is RETURNING_ATTRIBUTE (a test keeps them equal).
 */
export const HERO_RETURNING_WIDTH_CLASS = 'sm:[html[data-home-returning]_&]:w-96 sm:data-[state=continue]:w-96';

/** The signal tag on the accent fill: the fill's text colour and a faint border of it. */
export const HERO_TAG_CLASS = 'border-primary-foreground/40 text-primary-foreground';

export default function HeroPrimaryAction({ lessons }: HeroPrimaryActionProps) {
  const { lesson } = useLandingResume(lessons);
  const first = lessons[0];
  return (
    <Button asChild size="lg" className={`w-full justify-between px-5 sm:w-64 ${HERO_RETURNING_WIDTH_CLASS}`}>
      <Link
        href={lesson?.href ?? first?.href ?? '/curriculum'}
        data-testid="hero-primary-action"
        data-state={lesson ? 'continue' : 'start'}
        aria-label={lesson ? continueAccessibleName(lesson) : undefined}
      >
        {/* Left-aligned in a fixed box, so the text starts at the same point whichever label shows. */}
        {lesson ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="shrink-0">Continue:</span>
            {/* On the accent fill the tag takes the button's own text colour, not a tier or secondary colour. */}
            <SignalTag code={lesson.code} neutral className={HERO_TAG_CLASS} />
            <span className="min-w-0 truncate" data-hero-lesson-title="">
              {lesson.title}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">{START_LESSON_LABEL}</span>
        )}
        <ArrowRight aria-hidden="true" className="ml-3 h-4 w-4 shrink-0" />
      </Link>
    </Button>
  );
}
