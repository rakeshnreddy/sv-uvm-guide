'use client';

import React, { useState } from 'react';

import { InteractiveBoundary } from '@/components/mdx/InteractiveBoundary';
import { createLazyComponentCache, type InteractiveComponent } from '@/components/mdx/InteractiveSlot';
import type { TraceScenarioId } from '@/lib/sv-scheduler-scenarios';

import { InViewMount } from './InViewMount';

/**
 * The in-view boundary for the live scheduler model. The visualizer's code
 * (and everything it imports) is reached only through this dynamic import,
 * which runs the first time the slot scrolls into view, so it is a separate
 * chunk that the landing page's initial JavaScript never includes.
 * tests/app/home-page.test.tsx holds that line.
 */
export const LIVE_SCHEDULER_LOADER = () => import('@/components/visuals/TimeSlotTraceVisualizer');

const cache = createLazyComponentCache({
  scheduler: () => LIVE_SCHEDULER_LOADER().then((module) => ({ default: module.default as InteractiveComponent })),
});

/**
 * The slot's min-height in each width range: the live visualizer's tallest
 * opening height for the shift-nba scenario across the widths in that range,
 * measured in the browser (320 to 639 px: 1878; 640 to 819: 1631, one
 * column; 820 to 1023: 1194, the ladder beside the code; from 1024: 1140),
 * rounded up, so mounting moves nothing. The visualizer goes to two columns
 * at about 792 px; the step is at 820 so a 15 px classic scrollbar cannot put
 * the one-column layout under the two-column reservation.
 */
export const SEE_IT_RUN_SLOT_HEIGHTS = { base: 1880, sm: 1640, two: 1200, lg: 1150 } as const;

/**
 * The reservation applies only where scripts run: without JavaScript the
 * fallback stays for good and needs no empty space under it. Literal, so
 * Tailwind sees every class; a unit test keeps it equal to the heights above.
 */
export const SEE_IT_RUN_SLOT_CLASS =
  '[--slot-h:1880px] sm:[--slot-h:1640px] min-[820px]:[--slot-h:1200px] lg:[--slot-h:1150px] [@media(scripting:enabled)]:min-h-[var(--slot-h)]';

export interface SeeItRunLiveProps {
  /** The scenario the visualizer opens on, and the only one it offers. */
  scenario: TraceScenarioId;
  /** The static frame, in the server HTML: shown before the slot is in view, while the code loads and without JavaScript. */
  fallback: React.ReactNode;
  /** Named in the error state. */
  title: string;
}

export default function SeeItRunLive({ scenario, fallback, title }: SeeItRunLiveProps) {
  const [, setAttempt] = useState(0);
  const Visualizer = cache.get('scheduler');
  const retry = () => {
    cache.reset('scheduler');
    setAttempt((count) => count + 1);
  };
  return (
    <InViewMount
      fallback={fallback}
      rootMargin="0px 0px 160px 0px"
      data-testid="see-it-run-slot"
      // The visualizer's own vertical margin would collapse out of the slot; the section spaces it instead.
      className={`${SEE_IT_RUN_SLOT_CLASS} [&>section]:my-0`}
    >
      <InteractiveBoundary title={title} onRetry={retry}>
        {/* The controls first, so "Press Play or use the step arrows" points at something in view. */}
        <Visualizer scenario={scenario} scenarios={[scenario]} controlsPlacement="top" />
      </InteractiveBoundary>
    </InViewMount>
  );
}
