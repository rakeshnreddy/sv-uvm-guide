import React from 'react';
import Link from 'next/link';

import type { InterviewBank, InterviewLevelOption } from '@/app/(learning)/interview-prep/interview-banks';
import { pageTabClass } from '@/components/layout/PageHeader';
import { LessonTagLink } from '@/components/practice/PracticeRows';
import { getInterviewBankOutcome } from '@/lib/practice-links';
import { cn } from '@/lib/utils';

import { LevelCount } from './LevelFilter';
import { PractisedCount } from './PractisedMarkup';
import { TabStripScroll } from './TabStripScroll';

/*
 * The two ways to reach a bank: the tab strip on every bank page (PageHeader's
 * tabs slot) and the rows on the /interview-prep index. Both show the question
 * count for the chosen level. Server components.
 */

type BankSummary = Pick<
  InterviewBank,
  'slug' | 'href' | 'name' | 'shortName' | 'anchor' | 'description' | 'lessons' | 'levelCounts' | 'questionCount' | 'topic'
>;

export function bankCounts(bank: Pick<InterviewBank, 'levelCounts' | 'questionCount'>): Record<string, number> {
  return { all: bank.questionCount, ...bank.levelCounts };
}

/** One tab per bank, the current one marked; the count follows the level filter. */
export function BankTabs({
  banks,
  current,
  levels,
}: {
  banks: readonly BankSummary[];
  current: string;
  levels: readonly InterviewLevelOption[];
}) {
  // The strip scrolls sideways on a phone; TabStripScroll fades the edge that hides tabs and brings the current one
  // into view. It is position: relative, so the screen-reader-only text scrolls with the strip, not widening the page.
  return (
    <TabStripScroll label="Interview banks">
      <ul className="flex min-w-max gap-6">
        {banks.map((bank) => {
          const isCurrent = bank.slug === current;
          return (
            <li key={bank.slug}>
              <Link href={bank.href} aria-current={isCurrent ? 'page' : undefined} className={cn(pageTabClass(isCurrent), 'gap-2')}>
                {/* The short name on screen; screen readers hear the whole name. */}
                <span>
                  {bank.shortName}
                  {bank.name.startsWith(bank.shortName) && bank.name !== bank.shortName ? (
                    <span className="sr-only">{bank.name.slice(bank.shortName.length)}</span>
                  ) : null}
                </span>
                <LevelCount counts={bankCounts(bank)} levels={levels} format="number" className="font-mono text-label text-subtle" />
              </Link>
            </li>
          );
        })}
      </ul>
    </TabStripScroll>
  );
}

/**
 * A bank's topics for its index row: the description without the opener the
 * banks share ("Interview preparation from junior to senior staff: "), which
 * the page lead already says. A description without that opener is kept whole.
 */
export function bankSummaryLine(description: string): string {
  const topics = description.replace(/^Interview (?:preparation|questions)(?: on [^:]+?)?(?: from [^:]+?)?(?: (?:covering|on)\s|: | for )/i, '');
  return topics === description ? description : topics.charAt(0).toUpperCase() + topics.slice(1);
}

/**
 * The line under a bank's name on the index: its authored outcome line
 * (INTERVIEW_BANK_OUTCOMES, one short sentence written to fit the row whole),
 * or its topics from the description for a bank without one.
 */
export function bankRowLine(bank: Pick<InterviewBank, 'topic' | 'description'>): string {
  return getInterviewBankOutcome(bank.topic) ?? bankSummaryLine(bank.description);
}

/**
 * The index rows: the teaching lesson's signal tag (a link to it), the bank's
 * name stretched over the row as the link to its page, its topics, and the
 * count for the chosen level. Each row keeps the bank's old section id, so
 * /interview-prep#<bank> links still land on it.
 */
export function BankRows({ banks, levels }: { banks: readonly BankSummary[]; levels: readonly InterviewLevelOption[] }) {
  return (
    <ul role="list" className="divide-y divide-border" data-bank-rows="">
      {banks.map((bank) => {
        const [lesson] = bank.lessons;
        return (
          <li
            key={bank.slug}
            id={bank.anchor}
            data-bank-row={bank.slug}
            className={cn(
              'group relative grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-lg px-3 py-3.5',
              'sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]',
              'transition-colors duration-150 ease-bench hover:bg-muted motion-reduce:transition-none',
            )}
          >
            <div className="col-start-1 row-start-1 flex min-h-6 items-center">{lesson ? <LessonTagLink lesson={lesson} /> : null}</div>
            <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <h3 className="text-h4 [overflow-wrap:anywhere]">
                <Link
                  href={bank.href}
                  className={cn(
                    'text-foreground underline-offset-4 transition-colors duration-150 ease-bench group-hover:text-primary group-hover:underline motion-reduce:transition-none',
                    'after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring',
                  )}
                >
                  {bank.name}
                </Link>
              </h3>
              {/* Never clamped: the outcome lines are written short, so no row ends in an ellipsis. */}
              <p className="mt-1 text-ui text-muted-foreground" data-bank-outcome="">
                {bankRowLine(bank)}
              </p>
            </div>
            <div className="col-start-2 row-start-1 flex min-h-6 flex-col items-end justify-center text-right text-label text-muted-foreground sm:col-start-3">
              <LevelCount counts={bankCounts(bank)} levels={levels} />
              {/* "3 of 48 practised" under the count once this browser holds a mark for the bank; nothing before that. */}
              <PractisedCount scope={bank.slug} counts={bankCounts(bank)} levels={levels} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
