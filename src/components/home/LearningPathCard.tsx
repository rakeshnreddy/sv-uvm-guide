"use client";
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Crown, Wrench, type LucideIcon } from 'lucide-react';

import { eyebrow, primaryAction, secondaryAction } from '@/components/curriculum/overview-ui';
import type { RouteId, RouteSummary } from '@/lib/learning-paths';

const ROUTE_ICONS: Readonly<Record<RouteId, LucideIcon>> = {
  junior: Compass,
  practitioner: Wrench,
  expert: Crown,
};

interface LearningPathCardProps {
  route: RouteSummary;
}

/**
 * One learner route on the home page, as the curriculum overview's route
 * chooser shows it: who it is for, its steps, and its call to action (F1A,
 * the placement quiz or the expert index). Theme tokens only, so every theme
 * keeps AA contrast.
 */
const LearningPathCard: React.FC<LearningPathCardProps> = ({ route }) => {
  const Icon = ROUTE_ICONS[route.id];
  const headingId = `home-route-${route.id}`;

  return (
    <motion.article
      aria-labelledby={headingId}
      data-testid={`home-route-${route.id}`}
      className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm transition-colors hover:border-primary/60 motion-reduce:transition-none"
      whileHover={{ y: -4 }}
    >
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="h-7 w-7 shrink-0 text-primary" />
        <p className={eyebrow}>{route.name} route</p>
      </div>
      <h3 id={headingId} className="mt-3 text-2xl font-bold text-foreground">
        {route.tagline}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{route.audience}</p>

      <p className="mt-5 text-sm font-semibold text-foreground">
        {route.steps.length} steps · {route.lessonCount} lessons
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
        {route.steps.map((title) => (
          <li key={title} className="[overflow-wrap:anywhere]">
            {title}
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        <Link href={route.cta.href} className={primaryAction}>
          {route.cta.label}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <Link href={route.overviewHref} className={secondaryAction}>
          See the {route.name} route
        </Link>
      </div>
    </motion.article>
  );
};

export default LearningPathCard;
