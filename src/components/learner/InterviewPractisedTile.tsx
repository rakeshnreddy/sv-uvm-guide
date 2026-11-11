'use client';

import React from 'react';
import Link from 'next/link';

import { textLink } from '@/components/curriculum/overview-ui';
import { cardClass } from '@/components/ui/Card';
import { useRecord } from '@/lib/learner-store/react';
import { interviewPractisedRecord, practisedCount } from '@/lib/learner-store/repositories/interview';
import { siteLabel } from '@/lib/nav-labels';
import { INTERVIEW_PREP_HREF } from '@/lib/site-links';
import { cn } from '@/lib/utils';

export interface InterviewPractisedTileProps {
  /** Questions in every bank, counted on the server from the bank data (the dashboard page passes it). */
  total: number;
  className?: string;
}

/**
 * The dashboard's "Interview questions practised: N of 166" tile, one quiet
 * card in the "Labs, quizzes and notes" grid, with the way to interview prep.
 * The marks are the ones the learner set on the bank pages, in this browser.
 */
export function InterviewPractisedTile({ total, className }: InterviewPractisedTileProps) {
  const practised = Math.min(practisedCount(useRecord(interviewPractisedRecord)), total);
  const label = siteLabel(INTERVIEW_PREP_HREF);
  return (
    <section
      aria-labelledby="dashboard-interview-heading"
      data-testid="dashboard-interview-practised"
      className={cardClass({ variant: 'glassQuiet', padding: 'default', className: cn('min-w-0', className) })}
    >
      <h3 id="dashboard-interview-heading" className="text-h4 text-foreground">
        Interview questions practised
      </h3>
      <div className="mt-3">
        <p className="text-sm text-foreground">
          <strong className="font-mono text-xl font-medium tabular-nums">{practised}</strong> of{' '}
          <span className="tabular-nums">{total}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {practised === 0
            ? 'Mark a question as practised once you can answer it without the model answer.'
            : practised === total
              ? 'Every question is marked as practised.'
              : `${total - practised} left to practise.`}
        </p>
        <Link href={INTERVIEW_PREP_HREF} className={cn(textLink, 'mt-2 inline-flex min-h-10 items-center text-sm')}>
          Open {label.toLowerCase()}
        </Link>
      </div>
    </section>
  );
}

export default InterviewPractisedTile;
