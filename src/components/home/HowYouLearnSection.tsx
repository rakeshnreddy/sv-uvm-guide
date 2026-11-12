import Link from 'next/link';
import React from 'react';

import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { siteLabel } from '@/lib/nav-labels';
import { INTERVIEW_PREP_HREF, LABS_HREF, PRACTICE_HREF } from '@/lib/site-links';

import { countWord, plural, type LandingFacts } from './home-stats';
import StepPreview, { type StepPreviewKind } from './StepPreview';
import type { StepPreviews } from './step-previews';

/** A lesson the cards link to: lesson 1, or the lesson that holds the live scheduler model. */
export interface StepLesson {
  code: string;
  title: string;
  href: string;
}

export interface HowYouLearnProps {
  facts: LandingFacts;
  previews: StepPreviews;
  /** Lesson 1. */
  firstLesson: StepLesson;
  /** The lesson that holds the live model, its href opening the model on the scenario the preview shows. */
  modelLesson: StepLesson;
  /** Interview levels across the banks (step-previews.ts, interviewLevelCount). */
  interviewLevelCount: number;
}

export interface LearnStep {
  kind: StepPreviewKind;
  heading: string;
  line: string;
  /** The link's text names its destination. */
  linkLabel: string;
  href: string;
  /** A small mono meta under the line: the lesson, or the counts from the data. */
  meta: string;
}

export const HOW_YOU_LEARN_TITLE = 'How you learn here';

export function howYouLearnLine(stepCount: number): string {
  return `Every topic goes through the same ${countWord(stepCount)} steps.`;
}

/** The four steps, every count and destination from the data and src/lib/site-links.ts. */
export function learnSteps({ facts, firstLesson, modelLesson, interviewLevelCount }: Omit<HowYouLearnProps, 'previews'>): LearnStep[] {
  return [
    {
      kind: 'read',
      heading: 'Read',
      line: 'Each lesson starts with a short summary and goes as deep as you choose.',
      linkLabel: 'Open lesson 1',
      href: firstLesson.href,
      meta: `${firstLesson.code} ${firstLesson.title}`,
    },
    {
      kind: 'stepThrough',
      heading: 'Step through',
      line: 'Interactive models show what the simulator does, one step at a time.',
      linkLabel: 'Open the scheduler model',
      href: modelLesson.href,
      meta: `${modelLesson.code} ${modelLesson.title}`,
    },
    {
      kind: 'build',
      heading: 'Build',
      line: 'Guided labs with starter code, step-by-step tasks and a reference solution.',
      linkLabel: `${siteLabel(LABS_HREF)} on the ${siteLabel(PRACTICE_HREF)}`,
      href: LABS_HREF,
      meta: `${plural(facts.labCount, 'lab', 'labs')} · ${plural(facts.exerciseCount, 'exercise', 'exercises')}`,
    },
    {
      kind: 'rehearse',
      heading: 'Rehearse',
      line: `Interview questions at ${countWord(interviewLevelCount)} levels, from junior up, each with a model answer.`,
      linkLabel: siteLabel(INTERVIEW_PREP_HREF),
      href: INTERVIEW_PREP_HREF,
      meta: `${plural(facts.interviewQuestionCount, 'question', 'questions')} in ${plural(facts.interviewBankCount, 'bank', 'banks')}`,
    },
  ];
}

/**
 * "How you learn here": four quiet-glass cards, one per step every topic goes
 * through. Each has a small preview drawn from the product's own data
 * (StepPreview, hidden from assistive technology), a heading, one sentence, a
 * link named by its destination and a small mono meta. A server component: it
 * ships no client code and takes its counts and previews as props, so it never
 * imports the lab registry.
 */
export default function HowYouLearnSection({ previews, ...rest }: HowYouLearnProps) {
  const steps = learnSteps(rest);
  return (
    <Section id="how-you-learn" title={HOW_YOU_LEARN_TITLE} description={howYouLearnLine(steps.length)}>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <Card key={step.kind} as="li" variant="glassQuiet" padding="default" data-step={step.kind} className="flex min-w-0 flex-col">
            <StepPreview kind={step.kind} previews={previews} />
            <h3 className="text-h4 text-foreground">{step.heading}</h3>
            <p className="mt-1 flex-1 text-ui text-muted-foreground">{step.line}</p>
            <p data-testid="step-meta" title={step.meta} className="mt-3 truncate font-mono text-label tabular-nums text-muted-foreground">
              {step.meta}
            </p>
            <Link
              href={step.href}
              data-testid={`step-link-${step.kind}`}
              className="mt-2 inline-flex min-h-10 items-center self-start rounded-sm text-ui font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {step.linkLabel}
            </Link>
          </Card>
        ))}
      </ol>
    </Section>
  );
}
