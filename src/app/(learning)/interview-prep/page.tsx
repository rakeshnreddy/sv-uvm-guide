import React from 'react';
import type { Metadata } from 'next';

import { BankRows } from '@/components/interview/BankNav';
import { InterviewPageController } from '@/components/interview/InterviewPageController';
import { LevelCount, LevelFilter, LevelFilterSetup } from '@/components/interview/LevelFilter';
import { PractisedCount, PractisedSetup } from '@/components/interview/PractisedMarkup';
import { PractisedController } from '@/components/interview/PractisedController';
import { ALL_BANKS } from '@/components/interview/practised-marks';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { siteLabel } from '@/lib/nav-labels';
import { INTERVIEW_PREP_HREF } from '@/lib/site-links';

import { interviewLevelOptions, loadInterviewBanks, questionPages, totalLevelCounts } from './interview-banks';

export const metadata: Metadata = {
  title: siteLabel(INTERVIEW_PREP_HREF),
  description:
    'Interview questions on SystemVerilog, SVA and formal, UVM, AMBA, debug and SoC verification, from junior to senior staff, with model answers and links to the lessons that teach each topic.',
};

/**
 * The interview prep index: the level filter and one row per bank. The
 * questions themselves are on one static page per bank
 * (/interview-prep/<bank>), so this page stays small.
 */
export default function InterviewPrepPage() {
  const banks = loadInterviewBanks();
  const levels = interviewLevelOptions(banks);
  const counts = totalLevelCounts(banks);
  const labels = Object.fromEntries(levels.map((level) => [level.value, level.label]));

  return (
    <PageShell width="reading">
      <LevelFilterSetup levels={levels} />
      <PractisedSetup levels={levels} scope={ALL_BANKS} />
      <PageHeader
        title={siteLabel(INTERVIEW_PREP_HREF)}
        lead="Questions from junior to senior staff, with model answers and the lessons that teach each topic. Answer each one out loud or on paper first, then open the model answer."
        meta={
          <>
            <span>
              <LevelCount counts={counts} levels={levels} /> in {banks.length} banks
            </span>
            <PractisedCount scope={ALL_BANKS} counts={counts} levels={levels} />
          </>
        }
      >
        <p className="mt-4 max-w-[30em] text-ui text-muted-foreground">
          The banks are being reviewed against the standards. Where a model answer disagrees with a lesson, follow the lesson
          and the clause it cites.
        </p>
        <LevelFilter levels={levels} className="mt-6" />
      </PageHeader>

      <Section
        id="question-banks"
        title="Question banks"
        description="Each bank opens on its own page. The tag names the lesson that teaches it."
      >
        <BankRows banks={banks} levels={levels} />
      </Section>

      <PractisedController scope={ALL_BANKS} />
      <InterviewPageController counts={counts} labels={labels} elsewhere={questionPages(banks)} />
    </PageShell>
  );
}
