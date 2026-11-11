import Link from 'next/link';
import React from 'react';

import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import type { RouteSummary } from '@/lib/learning-paths';
import { START_HERE_HREF } from '@/lib/site-links';
import { cn } from '@/lib/utils';

import { plural } from './home-stats';

interface RoutesStripProps {
  /** The learner routes (src/lib/learning-paths.ts), summarised on the server by the landing page. */
  routes: readonly RouteSummary[];
}

/**
 * The three routes as one compact strip (SPEC-phases-2-4.md, phase 4): one
 * quiet-glass panel split by hairlines, each route its name, who it is for,
 * its lesson count and one action. Each route is an article named by its
 * tagline, with the call to action from the route data: Junior to the first
 * lesson, Practitioner to the placement quiz, Expert to the expert index
 * (tests/e2e/navigation-entry-points.spec.ts). Every action is the secondary
 * style: the hero holds the view's one filled button.
 */
export default function RoutesStrip({ routes }: RoutesStripProps) {
  return (
    <Section
      id="choose-your-route"
      title="Choose your route"
      description="Three ordered routes through the same lessons. Every module stays one click away."
      action={
        <Link
          href={START_HERE_HREF}
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Compare the routes
        </Link>
      }
    >
      <ul className={cn(cardClass({ variant: 'glassQuiet' }), 'grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0')}>
        {routes.map((route) => {
          const headingId = `home-route-${route.id}`;
          return (
            <li key={route.id} className="min-w-0">
              <article aria-labelledby={headingId} data-testid={headingId} className="flex h-full flex-col p-5 sm:p-6">
                <p className="text-label text-muted-foreground">{route.name} route</p>
                <h3 id={headingId} className="mt-1 text-h3 text-foreground">
                  {route.tagline}
                </h3>
                <p className="mt-2 text-ui text-muted-foreground">{route.audience}</p>
                <p className="mt-4 font-mono text-label tabular-nums text-muted-foreground">{plural(route.lessonCount, 'lesson', 'lessons')}</p>
                <div className="mt-auto pt-5">
                  <Button asChild variant="secondary">
                    <Link href={route.cta.href}>{route.cta.label}</Link>
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
