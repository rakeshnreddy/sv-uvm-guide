"use client";
import React from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { inlineLink, secondaryAction } from '@/components/curriculum/overview-ui';
import type { RouteSummary } from '@/lib/learning-paths';
import { PLACEMENT_QUIZ_HREF, START_HERE_HREF } from '@/lib/site-links';

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
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
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
        </motion.div>

        <ul className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {routes.map((route, index) => (
            <motion.li
              key={route.id}
              className="min-w-0"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <LearningPathCard route={route} />
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <p className="mb-4 text-lg text-muted-foreground">Not sure which route fits?</p>
          <Link href={PLACEMENT_QUIZ_HREF} className={secondaryAction}>
            <HelpCircle aria-hidden="true" className="h-5 w-5" />
            Take the placement quiz
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default LearningPathsSection;
