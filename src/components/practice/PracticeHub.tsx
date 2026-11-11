import React from 'react';
import Link from 'next/link';

import { getInterviewPracticeItems, loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { PageHeader, pageTabClass } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SECTION_CLASS, Section } from '@/components/layout/Section';
import { siteLabel } from '@/lib/nav-labels';
import { getAllLabs, labBadgeProps } from '@/lib/lab-registry';
import { getPracticeLabItems, getPracticePages, practiceSectionLink, type PracticeItem, type PracticeKind } from '@/lib/practice-links';
import { INTERVIEW_PREP_HREF, PRACTICE_HREF, type PracticeSection } from '@/lib/site-links';
import { cn } from '@/lib/utils';

import { LabProgressBadge } from './LabProgressBadge';
import { focusRing } from './LearnInLesson';
import { countLabel, groupByTier, labRowMeta, topicsLine, type PracticeTierGroup as TierGroupData } from './practice-hub-data';
import { PracticeRowList, PracticeRowPanel, PracticeTierGroup, PracticeTileGrid } from './PracticeRows';

export { practiceItemTier } from './practice-hub-data';

const textLink = cn('rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing);

/**
 * How many cards at the top of the hub get real glass. None: the hub's panels
 * and tiles are all quiet glass, so with the header and one menu the page stays
 * within three blurred layers (DESIGN.md section 11).
 */
export const PRACTICE_GLASS_CARDS = 0;

/** A section with at most this many items shows tiles; a longer one shows rows. */
export const PRACTICE_TILE_LIMIT = 4;

/**
 * The sections after Labs, in page order. Each section's id and title come
 * from src/lib/site-links.ts (PRACTICE_SECTION_ID and the nav labels), so
 * /practice#exercises and the other anchors match the navigation and the
 * redirects from the old index pages.
 */
const PAGE_SECTIONS: readonly { kind: PracticeKind; section: PracticeSection; intro: string }[] = [
  {
    kind: 'exercise',
    section: 'exercises',
    intro: 'Short drills that check your answer straight away and explain what is wrong. Your best score is kept in this browser.',
  },
  { kind: 'interactive', section: 'interactiveModels', intro: 'Predict, then run a tested model of the language or methodology rule.' },
  { kind: 'diagram', section: 'diagrams', intro: 'Explorable pictures of how UVM testbenches are built and run.' },
  { kind: 'chart', section: 'charts', intro: 'Side-by-side comparisons to check your recall.' },
  { kind: 'tool', section: 'tools', intro: 'Free-form workbenches for protocol timing.' },
];

export interface PracticeHubSection {
  section: PracticeSection;
  id: string;
  label: string;
  intro: string;
  items: PracticeItem[];
}

export interface PracticeHubData {
  labs: PracticeItem[];
  labGroups: TierGroupData<PracticeItem>[];
  /** The state column of each lab row: its progress badge (client) and step count. */
  labStates: Record<string, React.ReactNode>;
  /** The sections between Labs and Interview prep that have items, in page order. */
  sections: PracticeHubSection[];
  interview: PracticeItem[];
  interviewStates: Record<string, React.ReactNode>;
  /** Each bank's topics, without the lead-in every bank shares. */
  interviewOutcomes: Record<string, string>;
  jumpLinks: PracticeSectionJumpLink[];
}

/** Everything the hub lists, from the registries: every lab, practice page and interview bank. */
export function getPracticeHubData(): PracticeHubData {
  const labManifests = getAllLabs();
  const labs = getPracticeLabItems(labManifests);
  const labStates: Record<string, React.ReactNode> = Object.fromEntries(
    labManifests.map((lab) => [
      `lab:${lab.id}`,
      <>
        {/* Renders nothing until this browser holds progress on the lab, so prerender and hydration match. */}
        <LabProgressBadge {...labBadgeProps(lab)} />
        <span className="whitespace-nowrap tabular-nums">{labRowMeta(lab)}</span>
      </>,
    ]),
  );

  const pages = getPracticePages();
  const sections = PAGE_SECTIONS.map((section) => {
    const { id, label } = practiceSectionLink(section.section);
    return { section: section.section, id, label, intro: section.intro, items: pages.filter((page) => page.kind === section.kind) };
  }).filter((entry) => entry.items.length > 0);

  const banks = loadInterviewBanks();
  const interview = getInterviewPracticeItems(banks);
  const interviewStates: Record<string, React.ReactNode> = Object.fromEntries(
    banks.map((bank) => [
      `interview:${bank.topic}`,
      <span key={bank.topic} className="whitespace-nowrap tabular-nums">
        {countLabel(bank.questionCount, 'question')}
      </span>,
    ]),
  );

  const interviewOutcomes = Object.fromEntries(interview.map((item) => [item.id, topicsLine(item.description)]));

  const labsSection = practiceSectionLink('labs');
  const interviewSection = practiceSectionLink('interviewPrep');
  const jumpLinks = [
    { href: `#${labsSection.id}`, label: labsSection.label, count: labs.length },
    ...sections.map((section) => ({ href: `#${section.id}`, label: section.label, count: section.items.length })),
    { href: `#${interviewSection.id}`, label: interviewSection.label, count: interview.length },
  ];

  return { labs, labGroups: groupByTier(labs), labStates, sections, interview, interviewStates, interviewOutcomes, jumpLinks };
}

/**
 * Consecutive sections with one item each go side by side from 768 px (Charts
 * and Tools today), so a lone tile never sits in a row of empty columns.
 */
export function pairSingleItemSections<T extends { items: readonly unknown[] }>(sections: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (const section of sections) {
    const last = rows[rows.length - 1];
    if (section.items.length === 1 && last?.length === 1 && last[0].items.length === 1) last.push(section);
    else rows.push([section]);
  }
  return rows;
}

export interface PracticeSectionJumpLink {
  href: string;
  label: string;
  count: number;
}

/**
 * The jump links to the hub's sections, as PageHeader's tab strip: one 40 px
 * item per section with its item count in the mono face. None is current; they
 * are in-page anchors. Scrolls sideways on phones rather than wrapping.
 */
export function PracticeSectionNav({ links }: { links: readonly PracticeSectionJumpLink[] }) {
  return (
    <nav aria-label="Practice sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-6">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className={cn(pageTabClass(false), 'gap-2')}>
              {link.label}
              <span className="font-mono text-label tabular-nums text-subtle">{link.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A section's list: tiles for a few items, rows on one panel for a longer list. */
function SectionItems({ items, single }: { items: readonly PracticeItem[]; single: boolean }) {
  return items.length > PRACTICE_TILE_LIMIT ? <PracticeRowPanel items={items} /> : <PracticeTileGrid items={items} single={single} />;
}

const PracticeHub = () => {
  const { labGroups, labStates, labs, sections, interview, interviewStates, interviewOutcomes, jumpLinks } = getPracticeHubData();
  const labsSection = practiceSectionLink('labs');
  const interviewSection = practiceSectionLink('interviewPrep');

  return (
    <PageShell width="content">
      <PageHeader
        title={siteLabel(PRACTICE_HREF)}
        lead="Labs, exercises, interactive models, tools and interview questions, in curriculum order. Each one names the lesson that teaches it."
        tabs={<PracticeSectionNav links={jumpLinks} />}
      />

      <Section
        id={labsSection.id}
        anchor="heading"
        title={labsSection.label}
        description="Starter code, guided steps and reference solutions, grouped by tier. Your progress is saved in this browser."
      >
        <div className="space-y-6" data-lab-count={labs.length}>
          {labGroups.map((group) => (
            <PracticeTierGroup
              key={group.tier ?? 'none'}
              tier={group.tier}
              title={group.title}
              count={countLabel(group.items.length, 'lab')}
            >
              <PracticeRowList items={group.items} states={labStates} />
            </PracticeTierGroup>
          ))}
        </div>
      </Section>

      {pairSingleItemSections(sections).map((row) => {
        const sectionNodes = row.map((section, index) => (
          <Section
            key={section.id}
            id={section.id}
            anchor="heading"
            title={section.label}
            description={section.intro}
            // Side by side, the second section must not take the 48 px gap between stacked sections.
            className={cn(row.length > 1 && index > 0 && 'md:!mt-0')}
          >
            <SectionItems items={section.items} single={row.length > 1} />
          </Section>
        ));
        return row.length > 1 ? (
          <div key={row[0].id} data-section="" className={cn(SECTION_CLASS, 'grid gap-x-8 md:grid-cols-2')}>
            {sectionNodes}
          </div>
        ) : (
          sectionNodes
        );
      })}

      <Section
        id={interviewSection.id}
        anchor="heading"
        title={interviewSection.label}
        description={
          <>
            Question banks from junior to senior staff. Answer first, then reveal the model answer on the{' '}
            <Link href={INTERVIEW_PREP_HREF} className={textLink}>
              {siteLabel(INTERVIEW_PREP_HREF)}
            </Link>{' '}
            page.
          </>
        }
      >
        <PracticeRowPanel items={interview} states={interviewStates} outcomes={interviewOutcomes} />
      </Section>
    </PageShell>
  );
};

export default PracticeHub;
