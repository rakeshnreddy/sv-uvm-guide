import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BankTabs, bankCounts, bankSummaryLine } from '@/components/interview/BankNav';
import { InterviewPageController } from '@/components/interview/InterviewPageController';
import { DisclosureTools, LevelCount, LevelFilter, LevelFilterSetup } from '@/components/interview/LevelFilter';
import { HidePractisedToggle, PractisedAllHiddenNote, PractisedCount, PractisedSetup } from '@/components/interview/PractisedMarkup';
import { PractisedController } from '@/components/interview/PractisedController';
import { QuestionList } from '@/components/interview/QuestionList';
import { QUESTION_LIST_CLASS } from '@/components/interview/question-styles';
import { LEVEL_GROUP_ATTRIBUTE } from '@/components/interview/level-filter';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { LessonChipLink } from '@/components/practice/LearnInLesson';
import { siteLink } from '@/lib/nav-labels';
import { cn } from '@/lib/utils';
import { INTERVIEW_PREP_HREF } from '@/lib/site-links';

import { getInterviewBank, interviewLevelOptions, loadInterviewBanks } from '../interview-banks';

/** One static page per bank; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { bank: string }[] {
  return loadInterviewBanks().map((bank) => ({ bank: bank.slug }));
}

/** The bank page's title: "SystemVerilog interview questions". */
function bankPageTitle(name: string): string {
  return `${name} interview questions`;
}

export function generateMetadata({ params }: { params: { bank: string } }): Metadata {
  const bank = getInterviewBank(params.bank);
  if (!bank) return {};
  return { title: bankPageTitle(bank.name), description: bank.description };
}

/**
 * One bank's questions, by level, as native disclosures: collapsed until
 * opened, readable with scripts off. The level filter is shared with the
 * index and remembered in this browser.
 */
export default function InterviewBankPage({ params }: { params: { bank: string } }) {
  const banks = loadInterviewBanks();
  const bank = getInterviewBank(params.bank, banks);
  if (!bank) notFound();

  const levels = interviewLevelOptions(banks);
  const counts = bankCounts(bank);
  const labels = Object.fromEntries(levels.map((level) => [level.value, level.label]));
  const [teaching, ...related] = bank.lessons;

  return (
    <PageShell width="reading">
      <LevelFilterSetup levels={levels} />
      <PractisedSetup levels={levels} scope={bank.slug} />
      <PageHeader
        breadcrumbs={[siteLink(INTERVIEW_PREP_HREF), { label: bank.name }]}
        eyebrow={
          teaching ? (
            <>
              <span>Learn it in</span>
              <LessonChipLink lesson={teaching} />
            </>
          ) : undefined
        }
        title={bankPageTitle(bank.name)}
        lead={bank.description ? bankSummaryLine(bank.description) : undefined}
        meta={
          <>
            <LevelCount counts={counts} levels={levels} />
            <PractisedCount scope={bank.slug} counts={counts} levels={levels} />
          </>
        }
        tabs={<BankTabs banks={banks} current={bank.slug} levels={levels} />}
      >
        <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
          <LevelFilter levels={levels} />
          <HidePractisedToggle />
        </div>
      </PageHeader>

      <DisclosureTools expandLabel="Expand all in this bank" className="mb-8" />
      <PractisedAllHiddenNote className="mb-8" />

      <div className={cn("flex flex-col gap-12", QUESTION_LIST_CLASS)} data-question-list="">
        {bank.levels.map((group) => (
          <div key={group.level} {...{ [LEVEL_GROUP_ATTRIBUTE]: group.level }}>
            <Section
              id={group.anchor}
              anchor="heading"
              title={group.label}
              action={
                <span className="tabular-nums text-muted-foreground">
                  {group.questions.length} {group.questions.length === 1 ? 'question' : 'questions'}
                </span>
              }
            >
              <QuestionList questions={group.questions} />
            </Section>
          </div>
        ))}
      </div>

      {related.length > 0 ? (
        <Section id="related-lessons" title="Related lessons" className="mt-12">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {related.map((lesson) => (
              <li key={lesson.ref} className="min-w-0 max-w-full">
                <LessonChipLink lesson={lesson} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <PractisedController scope={bank.slug} />
      <InterviewPageController counts={counts} labels={labels} />
    </PageShell>
  );
}
