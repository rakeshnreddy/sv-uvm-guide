import Link from 'next/link';
import React from 'react';

import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { siteLink } from '@/lib/nav-labels';
import { INTERVIEW_PREP_HREF, LABS_HREF, PRACTICE_SECTION_HREF } from '@/lib/site-links';

import type { LandingFacts } from './home-stats';

export interface PractiseItem {
  /** The destination's label and href, from src/lib/site-links.ts. */
  label: string;
  href: string;
  count: number;
  /** What the count counts ("labs"). */
  unit: string;
  line: string;
}

/** The four kinds of practice, each with its real count. */
export function practiseItems(facts: LandingFacts): PractiseItem[] {
  return [
    {
      ...siteLink(LABS_HREF),
      count: facts.labCount,
      unit: facts.labCount === 1 ? 'lab' : 'labs',
      line: 'Build a testbench step by step from starter code. Your progress is saved in this browser.',
    },
    {
      ...siteLink(PRACTICE_SECTION_HREF.exercises),
      count: facts.exerciseCount,
      unit: facts.exerciseCount === 1 ? 'exercise' : 'exercises',
      line: 'Short graded drills that check your answer straight away and explain what is wrong.',
    },
    {
      ...siteLink(PRACTICE_SECTION_HREF.interactiveModels),
      count: facts.interactiveModelCount,
      unit: facts.interactiveModelCount === 1 ? 'model' : 'models',
      line: 'Predict, then run a tested model of the language or methodology rule.',
    },
    {
      ...siteLink(INTERVIEW_PREP_HREF),
      count: facts.interviewQuestionCount,
      unit: facts.interviewQuestionCount === 1 ? 'question' : 'questions',
      line: `${facts.interviewBankCount} banks of questions from junior to senior staff level, each with a model answer.`,
    },
  ];
}

/**
 * "What you can practise": four quiet-glass cards, each one link named by the
 * destination's label in src/lib/site-links.ts, one plain line and its count
 * from the data as a small mono meta. A server component: it ships no client code and takes
 * its counts as props, so it never imports the lab registry.
 */
export default function InteractiveFeaturesSection({ facts }: { facts: LandingFacts }) {
  return (
    <Section id="what-you-can-practise" title="What you can practise">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {practiseItems(facts).map((item) => (
          <Card key={item.href} as="li" variant="glassQuietInteractive" padding="default" className="flex min-w-0 flex-col">
            <h3 className="text-h4">
              <Link href={item.href} className="text-foreground after:absolute after:inset-0 focus-visible:outline-none">
                {item.label}
              </Link>
            </h3>
            <p className="mt-1 flex-1 text-ui text-muted-foreground">{item.line}</p>
            {/* A small meta, not a headline figure: the proof strip is the one place for those. */}
            <p data-testid="practise-count" className="mt-4 font-mono text-label tabular-nums text-muted-foreground">
              {item.count} {item.unit}
            </p>
          </Card>
        ))}
      </ul>
    </Section>
  );
}
