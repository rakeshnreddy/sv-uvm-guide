import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/Button';
import { CURRICULUM_HREF } from '@/lib/site-links';

import HeroPrimaryAction from './HeroPrimaryAction';
import { BROWSE_CURRICULUM_LABEL } from './HeroSection';
import { plural } from './home-stats';
import type { LandingLesson } from './landing-resume';

/**
 * The page's last row: the hero's two actions again, both in the secondary
 * style (the hero holds the view's one filled button). The first is the same
 * island as the hero's, so it reads "Start lesson 1" or the shared Continue.
 */
export default function ClosingRow({ lessons, lessonCount }: { lessons: readonly LandingLesson[]; lessonCount: number }) {
  return (
    <section aria-labelledby="closing-heading" data-testid="closing-row" className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 id="closing-heading" className="text-h3 text-foreground">
          Start the course
        </h2>
        <p className="mt-1 text-ui text-muted-foreground">{plural(lessonCount, 'lesson', 'lessons')}, free, with no sign-up.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <HeroPrimaryAction lessons={lessons} variant="secondary" testId="closing-primary-action" />
        <Button asChild size="lg" variant="secondary" className="w-full justify-between px-5 sm:w-auto sm:justify-center">
          <Link href={CURRICULUM_HREF} data-testid="closing-browse-curriculum">
            {BROWSE_CURRICULUM_LABEL}
          </Link>
        </Button>
      </div>
    </section>
  );
}
