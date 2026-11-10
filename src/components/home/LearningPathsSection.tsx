import React from 'react';
import Link from 'next/link';

import { inlineLink } from '@/components/curriculum/overview-ui';
import type { RouteSummary } from '@/lib/learning-paths';
import { START_HERE_HREF } from '@/lib/site-links';

import LearningPathCard from './LearningPathCard';

interface LearningPathsSectionProps {
  /** The learner routes (src/lib/learning-paths.ts), summarised on the server by the home page. */
  routes: readonly RouteSummary[];
}

/**
 * The home page's route cards, aligned with the curriculum overview's route
 * chooser (G30-PATH-05; NB2 request 3): Junior starts at F1A, Practitioner
 * at the placement quiz, Expert at the expert index.
 */
const LearningPathsSection = ({ routes }: LearningPathsSectionProps) => {
  return (
    <section aria-labelledby="learning-paths-heading" className="w-full bg-background py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 id="learning-paths-heading" className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            Choose your route
          </h2>
          <p className="text-lg text-muted-foreground">
            Three ordered routes through the same lessons, from your first testbench to staff-level depth. Every module
            stays one click away, and you can{' '}
            <Link href={START_HERE_HREF} className={inlineLink}>
              compare the routes on the curriculum overview
            </Link>
            .
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {routes.map((route) => (
            <li key={route.id} className="min-w-0">
              <LearningPathCard route={route} />
            </li>
          ))}
        </ul>

      </div>
    </section>
  );
};

export default LearningPathsSection;
