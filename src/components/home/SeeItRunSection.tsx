import Link from 'next/link';
import React from 'react';

import { Section } from '@/components/layout/Section';
import { SignalTag } from '@/components/ui/SignalTag';
import { cn } from '@/lib/utils';
import type { TraceScenarioId } from '@/lib/sv-scheduler-scenarios';

import { CodeFrame } from './SchedulerFrame';
import { liveModelLink, type SchedulerFrame as Frame } from './scheduler-frame';
import SeeItRunLive from './SeeItRunLive';

/** The lesson that teaches the model, as the landing page resolves it from the lesson list. */
export interface SeeItRunLesson {
  code: string;
  title: string;
  /** The lesson, at the heading above its copy of the visualizer. */
  href: string;
}

export interface SeeItRunSectionProps {
  scenario: TraceScenarioId;
  /** The scenario's first step, the one the live visualizer opens on. */
  frame: Frame;
  lesson: SeeItRunLesson;
}

export const SEE_IT_RUN_TITLE = 'See it run';

/** The one line of instruction, with the step count from the model's own run. */
export function seeItRunInstruction(stepCount: number): string {
  return `Press Play or use the step arrows to walk through the ${stepCount} scheduler steps of one clock edge: both flops read in Active, and both writes wait for NBA.`;
}

/** The "Taught in" line: wraps, and never wider than the viewport less its 16 px gutters. */
export const SEE_IT_RUN_ACTION_CLASS =
  'inline-flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted-foreground';

/** On phones the target grows to 40 px by padding that negative margins cancel, so the line does not move. */
const linkClass =
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:inline-block max-sm:-my-2.5 max-sm:py-2.5';

/**
 * The live visualizer's box (its own border, fill, radius and padding), so the
 * fallback sits where the model will. It fills the slot's reserved height
 * (min-height inherit) where scripts run, and fits its content where they do not.
 */
const FALLBACK_BOX_CLASS = 'flex min-h-[inherit] flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6';

/** What the slot shows before the model mounts, while its code loads and without JavaScript: the opening frame and the lesson link. */
export function SeeItRunFallback({ frame, lesson }: Pick<SeeItRunSectionProps, 'frame' | 'lesson'>) {
  return (
    <div data-testid="see-it-run-fallback" className={FALLBACK_BOX_CLASS}>
      <div>
        <p className="text-label text-muted-foreground">Step through one clock edge</p>
        <h3 className="text-h4 text-foreground">{frame.title}</h3>
      </div>
      <div className="max-w-2xl">
        <CodeFrame frame={frame} />
      </div>
      <p className="text-ui text-muted-foreground">
        The same model runs in the lesson that teaches it.{' '}
        <Link href={liveModelLink(lesson.href)} className={linkClass}>
          Step through it in {lesson.code}
        </Link>
      </p>
    </div>
  );
}

/**
 * "See it run" (SPEC-phases-2-4.md, phase 4, item 5): the live scheduler model
 * a visitor steps through themselves, on the scenario the hero's frame shows.
 * A server section: the heading, the instruction, the lesson link and the
 * fallback are in the server HTML; the visualizer mounts only when its slot
 * scrolls into view (SeeItRunLive), in a box whose height is reserved. The
 * visualizer is an interactive with controls, so it sits on its own solid
 * surface, never on glass.
 */
export default function SeeItRunSection({ scenario, frame, lesson }: SeeItRunSectionProps) {
  return (
    <Section
      id="see-it-run"
      title={SEE_IT_RUN_TITLE}
      description={seeItRunInstruction(frame.stepCount)}
      action={
        // Section keeps its action from shrinking; the cap lets this line wrap under the instruction on a
        // 320 px phone instead of pushing the page sideways (WCAG 1.4.10 reflow).
        <span className={SEE_IT_RUN_ACTION_CLASS}>
          Taught in
          <SignalTag code={lesson.code} />
          <Link href={lesson.href} data-testid="see-it-run-lesson" className={cn(linkClass, 'min-w-0')}>
            {lesson.title}
          </Link>
        </span>
      }
    >
      <SeeItRunLive scenario={scenario} title={frame.title} fallback={<SeeItRunFallback frame={frame} lesson={lesson} />} />
    </Section>
  );
}
