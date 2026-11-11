import React from 'react';
import Link from 'next/link';

import { getInterviewPracticeItems, loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { siteLabel } from '@/lib/nav-labels';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs, labBadgeProps, labCheckSummary } from '@/lib/lab-registry';
import {
  PRACTICE_KIND_LABELS,
  getLabPrerequisites,
  getPracticeLabItems,
  getPracticePages,
  practiceSectionLink,
  type LabPrerequisites,
  type PracticeItem,
  type PracticeKind,
} from '@/lib/practice-links';
import { INTERVIEW_PREP_HREF, PRACTICE_HREF, type PracticeSection } from '@/lib/site-links';
import { cn } from '@/lib/utils';

import { LabProgressBadge } from './LabProgressBadge';
import { LabPrerequisiteList, LessonChipLink, focusRing } from './LearnInLesson';

const eyebrow = 'text-xs font-medium text-subtle';
const textLink = cn('rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing);

/** Extra lines for a card: lab check and progress notes, prerequisites and progress badge; interview question counts. */
export interface PracticeCardDetails {
  notes?: string[];
  /** A status node under the notes, such as a LabProgressBadge. It sits under the card's link layer and must not be interactive. */
  badge?: React.ReactNode;
  prerequisites?: Pick<LabPrerequisites, 'items' | 'doAfter'>;
}

interface PracticeCardProps {
  item: PracticeItem;
  details?: PracticeCardDetails;
  /** Heading level of the card title inside its section. */
  headingLevel?: 'h3' | 'h4';
}

/**
 * One practice item. The title links to the item and its hit area covers the
 * card; the lesson and prerequisite links sit above that layer. An item that
 * cannot be opened yet has no link at all.
 */
export function PracticeCard({ item, details, headingLevel = 'h3' }: PracticeCardProps) {
  const Heading = headingLevel;
  const [lesson] = item.lessons;
  const statusLabel =
    item.kind === 'lab' ? (item.status === 'available' ? 'Available' : 'Coming soon') : PRACTICE_KIND_LABELS[item.kind];
  return (
    <li className="relative flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card transition-colors duration-150 ease-bench hover:border-input motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <Heading className="min-w-0 text-h4 text-foreground [overflow-wrap:anywhere]">
          {item.href ? (
            <Link
              href={item.href}
              className="rounded-sm underline-offset-4 after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </Heading>
        <span className="shrink-0 pt-1 text-xs font-medium text-subtle">
          {statusLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
      {details?.notes?.map((note) => (
        <p key={note} className="mt-2 text-xs text-muted-foreground">
          {note}
        </p>
      ))}
      {details?.badge}
      {details?.prerequisites ? (
        <LabPrerequisiteList prerequisites={details.prerequisites} className="mt-3" linkClassName="relative z-10" />
      ) : null}
      <div className="mt-auto pt-4">
        <p className={eyebrow}>Learn it in</p>
        {lesson ? (
          <LessonChipLink lesson={lesson} className="relative z-10 mt-0.5" />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Lesson to be assigned</p>
        )}
      </div>
    </li>
  );
}

/** A responsive grid of practice cards, one per section of the Practice hub. */
export function PracticeCardGrid({
  items,
  details,
  headingLevel,
}: {
  items: readonly PracticeItem[];
  details?: Readonly<Record<string, PracticeCardDetails>>;
  headingLevel?: 'h3' | 'h4';
}) {
  return (
    <ul role="list" className="not-prose grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
      {items.map((item) => (
        <PracticeCard key={item.id} item={item} details={details?.[item.id]} headingLevel={headingLevel} />
      ))}
    </ul>
  );
}

/** Coming-soon items: plain text with the lesson they are planned for, never a link to the item. */
function ComingSoonList({ items }: { items: readonly PracticeItem[] }) {
  return (
    <ul role="list" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
      {items.map((item) => {
        const [lesson] = item.lessons;
        return (
          <li key={item.id} className="min-w-0 rounded-xl border border-dashed border-border p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <h4 className="min-w-0 font-semibold text-foreground [overflow-wrap:anywhere]">{item.title}</h4>
              <span className="shrink-0 text-xs font-medium text-subtle">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{item.description}</p>
            <p className={cn(eyebrow, 'mt-3')}>Planned for</p>
            {lesson ? (
              <LessonChipLink lesson={lesson} />
            ) : (
              <p className="mt-1 text-muted-foreground">Lesson to be assigned</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The sections after Labs, in page order. Each section's id and title come
 * from src/lib/site-links.ts (PRACTICE_SECTION_ID and the nav labels), so
 * /practice#exercises and the other anchors match the navigation and the
 * redirects from the old index pages.
 */
const PAGE_SECTIONS: readonly { kind: PracticeKind; section: PracticeSection; intro: React.ReactNode }[] = [
  {
    kind: 'exercise',
    section: 'exercises',
    intro:
      'Short, graded drills: each one checks your answer straight away and explains what is wrong. Your best score is kept in this browser.',
  },
  { kind: 'interactive', section: 'interactiveModels', intro: 'Predict, then run a tested model of the language or methodology rule.' },
  { kind: 'diagram', section: 'diagrams', intro: 'Explorable pictures of how UVM testbenches are built and run.' },
  { kind: 'chart', section: 'charts', intro: 'Side-by-side comparisons to check your recall.' },
  { kind: 'tool', section: 'tools', intro: 'Free-form workbenches for protocol timing.' },
];

/** Section headings sit under the 64 px sticky header when reached by an anchor. */
const sectionHeadingClass = 'scroll-mt-24 text-h2 text-foreground';

function labNotes(lab: LabManifest): string[] {
  return [`${labCheckSummary(lab)}. Progress is saved in this browser.`];
}

const PracticeHub = () => {
  const labs = getAllLabs();
  const labItems = getPracticeLabItems(labs);
  const availableLabs = labItems.filter((item) => item.status === 'available');
  const comingSoonLabs = labItems.filter((item) => item.status !== 'available');
  const labDetails: Record<string, PracticeCardDetails> = Object.fromEntries(
    labs.map((lab) => {
      const { items, doAfter } = getLabPrerequisites(lab);
      // The badge renders nothing until this browser holds progress on the lab, so the card keeps its layout.
      const badge =
        lab.status === 'available' ? <LabProgressBadge {...labBadgeProps(lab)} className="mt-2 self-start" /> : undefined;
      return [`lab:${lab.id}`, { notes: labNotes(lab), badge, prerequisites: { items, doAfter } }];
    }),
  );

  const pages = getPracticePages();
  const sections = PAGE_SECTIONS.map((section) => ({
    ...section,
    ...practiceSectionLink(section.section),
    items: pages.filter((page) => page.kind === section.kind),
  })).filter((entry) => entry.items.length > 0);

  const banks = loadInterviewBanks();
  const interviewItems = getInterviewPracticeItems(banks);
  const interviewDetails: Record<string, PracticeCardDetails> = Object.fromEntries(
    banks.map((bank) => [`interview:${bank.topic}`, { notes: [`${bank.questionCount} questions with model answers`] }]),
  );

  const labsSection = practiceSectionLink('labs');
  const interviewSection = practiceSectionLink('interviewPrep');
  const comingSoonAnchor = 'coming-soon';

  const jumpLinks = [
    { href: `#${labsSection.id}`, label: labsSection.label, count: labItems.length },
    ...sections.map((section) => ({ href: `#${section.id}`, label: section.label, count: section.items.length })),
    { href: `#${interviewSection.id}`, label: interviewSection.label, count: interviewItems.length },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <header className="border-b border-border pb-6">
        <h1 className="text-h1 text-foreground">{siteLabel(PRACTICE_HREF)}</h1>
        <p className="mt-3 max-w-3xl text-lead text-muted-foreground">
          Sharpen your SystemVerilog and UVM skills with labs, exercises, interactive models, tools and interview questions.
          Items are listed in curriculum order, and each one names the lesson that teaches it.
        </p>
        <nav aria-label="Practice sections" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {jumpLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 ease-bench hover:border-input hover:bg-card',
                    focusRing,
                  )}
                >
                  {link.label}
                  <span className="font-mono text-xs font-medium tabular-nums text-subtle">{link.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section aria-labelledby={labsSection.id} className="mt-12">
        <h2 id={labsSection.id} className={sectionHeadingClass}>
          {labsSection.label}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Guided labs with starter code, step-by-step instructions and reference solutions. Your progress is saved in this browser.
        </p>
        <div className="mt-5">
          <PracticeCardGrid items={availableLabs} details={labDetails} />
        </div>
        {comingSoonLabs.length > 0 ? (
          <section aria-labelledby={comingSoonAnchor} className="mt-8">
            <h3 id={comingSoonAnchor} className="scroll-mt-24 text-h3 text-foreground">
              Coming soon
            </h3>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Planned labs, listed where they will sit in the curriculum.</p>
            <ComingSoonList items={comingSoonLabs} />
          </section>
        ) : null}
      </section>

      {sections.map((section) => (
        <section key={section.kind} aria-labelledby={section.id} className="mt-12">
          <h2 id={section.id} className={sectionHeadingClass}>
            {section.label}
          </h2>
          <p className="mt-1 text-muted-foreground">{section.intro}</p>
          <div className="mt-5">
            <PracticeCardGrid items={section.items} />
          </div>
        </section>
      ))}

      <section aria-labelledby={interviewSection.id} className="mt-12">
        <h2 id={interviewSection.id} className={sectionHeadingClass}>
          {interviewSection.label}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Question banks from junior to senior staff. Answer first, then reveal the model answer on the{' '}
          <Link href={INTERVIEW_PREP_HREF} className={textLink}>
            interview prep page
          </Link>
          .
        </p>
        <div className="mt-5">
          <PracticeCardGrid items={interviewItems} details={interviewDetails} />
        </div>
      </section>
    </div>
  );
};

export default PracticeHub;
