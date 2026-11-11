'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/Button';

import { START_LESSON_LABEL, continueAccessibleName, type LandingLesson } from './landing-resume';
import { useLandingResume } from './use-landing-resume';

interface HeroPrimaryActionProps {
  /** Every lesson in course order; the first is lesson 1. */
  lessons: readonly LandingLesson[];
}

/**
 * The view's one filled accent button (DESIGN.md section 2 rule 2): "Start
 * lesson 1", which becomes "Continue <code>" (for example "Continue F3C") once
 * this browser holds a lesson position (section 10; the rule is
 * continueLesson). A small client island. Its width is fixed from 640 px (full
 * width on phones) and the label is short enough to always fit, so the
 * secondary action beside it never moves when the stored position appears
 * after hydration. The accessible name adds the lesson's full title, and the
 * returning-learner strip shows it. The server HTML is always "Start lesson 1".
 */
export default function HeroPrimaryAction({ lessons }: HeroPrimaryActionProps) {
  const { lesson } = useLandingResume(lessons);
  const first = lessons[0];
  return (
    <Button asChild size="lg" className="w-full justify-between px-5 sm:w-64">
      <Link
        href={lesson?.href ?? first?.href ?? '/curriculum'}
        data-testid="hero-primary-action"
        data-state={lesson ? 'continue' : 'start'}
        aria-label={lesson ? continueAccessibleName(lesson) : undefined}
      >
        {/* Left-aligned in a fixed box, so the text starts at the same point whichever label shows. */}
        <span className="min-w-0 flex-1 truncate text-left">
          {lesson ? (
            <>
              Continue <span className="font-mono">{lesson.code}</span>
            </>
          ) : (
            START_LESSON_LABEL
          )}
        </span>
        <ArrowRight aria-hidden="true" className="ml-3 h-4 w-4 shrink-0" />
      </Link>
    </Button>
  );
}
