import React from 'react';
import Link from 'next/link';

import { getInterviewPracticeItems, loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { createSlugger } from '@/lib/heading-slug';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs } from '@/lib/lab-registry';
import {
  PRACTICE_KIND_LABELS,
  getLabPrerequisites,
  getPracticeLabItems,
  getPracticePages,
  type LabPrerequisites,
  type PracticeItem,
  type PracticeKind,
} from '@/lib/practice-links';
import { cn } from '@/lib/utils';

import { LabPrerequisiteList, LessonChipLink, focusRing } from './LearnInLesson';

const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
const textLink = cn('rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing);

/** Extra lines for a card: lab prerequisites and sign-in notes, interview question counts. */
export interface PracticeCardDetails {
  notes?: string[];
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
    <li className="relative flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <Heading className="min-w-0 text-lg font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {item.href ? (
            <Link
              href={item.href}
              className="rounded-sm underline-offset-4 after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </Heading>
        <span className="shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {statusLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
      {details?.notes?.map((note) => (
        <p key={note} className="mt-2 text-xs text-muted-foreground">
          {note}
        </p>
      ))}
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

/** A responsive grid of practice cards, used by the hub and the /exercises index. */
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
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

const PAGE_SECTIONS: readonly { kind: PracticeKind; title: string; intro: React.ReactNode }[] = [
  {
    kind: 'exercise',
    title: 'Exercises',
    intro: (
      <>
        Short, graded drills with instant feedback. Your best score is kept in this browser. They are also listed on the{' '}
        <Link href="/exercises" className={textLink}>
          exercises page
        </Link>
        .
      </>
    ),
  },
  { kind: 'interactive', title: 'Interactive models', intro: 'Predict, then run a tested model of the language or methodology rule.' },
  { kind: 'diagram', title: 'Diagrams', intro: 'Explorable pictures of how UVM testbenches are built and run.' },
  { kind: 'chart', title: 'Charts', intro: 'Side-by-side comparisons to check your recall.' },
  { kind: 'tool', title: 'Tools', intro: 'Free-form workbenches for protocol timing.' },
];

function labNotes(lab: LabManifest): string[] {
  const graded = Boolean(lab.graderId) && lab.steps.some((step) => step.completion === 'graded');
  return [`${graded ? 'Auto-graded steps' : 'Self-checked steps: you mark each one complete'}. Sign in to open.`];
}

const PracticeHub = () => {
  const labs = getAllLabs();
  const labItems = getPracticeLabItems(labs);
  const availableLabs = labItems.filter((item) => item.status === 'available');
  const comingSoonLabs = labItems.filter((item) => item.status !== 'available');
  const labDetails: Record<string, PracticeCardDetails> = Object.fromEntries(
    labs.map((lab) => {
      const { items, doAfter } = getLabPrerequisites(lab);
      return [`lab:${lab.id}`, { notes: labNotes(lab), prerequisites: { items, doAfter } }];
    }),
  );

  const pages = getPracticePages();
  const sections = PAGE_SECTIONS.map((section) => ({
    ...section,
    items: pages.filter((page) => page.kind === section.kind),
  })).filter((section) => section.items.length > 0);

  const banks = loadInterviewBanks();
  const interviewItems = getInterviewPracticeItems(banks);
  const interviewDetails: Record<string, PracticeCardDetails> = Object.fromEntries(
    banks.map((bank) => [`interview:${bank.topic}`, { notes: [`${bank.questionCount} questions with model answers`] }]),
  );

  // Section anchors use the shared heading slugger, so /practice#labs and friends stay stable.
  const slug = createSlugger();
  const labsAnchor = slug('Labs');
  const comingSoonAnchor = slug('Coming soon');
  const sectionAnchors = sections.map((section) => slug(section.title));
  const interviewAnchor = slug('Interview prep');

  const jumpLinks = [
    { href: `#${labsAnchor}`, label: 'Labs', count: labItems.length },
    ...sections.map((section, index) => ({ href: `#${sectionAnchors[index]}`, label: section.title, count: section.items.length })),
    { href: `#${interviewAnchor}`, label: 'Interview prep', count: interviewItems.length },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <header className="rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Practice Hub</h1>
        <p className="mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
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
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted',
                    focusRing,
                  )}
                >
                  {link.label}
                  <span className="text-xs text-muted-foreground">{link.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section aria-labelledby={labsAnchor} className="mt-12">
        <h2 id={labsAnchor} className="scroll-mt-24 text-2xl font-semibold text-foreground">
          Labs
        </h2>
        <p className="mt-1 text-muted-foreground">
          Guided labs with starter code, step-by-step instructions and reference solutions. Labs open after you sign in.
        </p>
        <div className="mt-5">
          <PracticeCardGrid items={availableLabs} details={labDetails} />
        </div>
        {comingSoonLabs.length > 0 ? (
          <section aria-labelledby={comingSoonAnchor} className="mt-8">
            <h3 id={comingSoonAnchor} className="scroll-mt-24 text-lg font-semibold text-foreground">
              Coming soon
            </h3>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Planned labs, listed where they will sit in the curriculum.</p>
            <ComingSoonList items={comingSoonLabs} />
          </section>
        ) : null}
      </section>

      {sections.map((section, index) => (
        <section key={section.kind} aria-labelledby={sectionAnchors[index]} className="mt-12">
          <h2 id={sectionAnchors[index]} className="scroll-mt-24 text-2xl font-semibold text-foreground">
            {section.title}
          </h2>
          <p className="mt-1 text-muted-foreground">{section.intro}</p>
          <div className="mt-5">
            <PracticeCardGrid items={section.items} />
          </div>
        </section>
      ))}

      <section aria-labelledby={interviewAnchor} className="mt-12">
        <h2 id={interviewAnchor} className="scroll-mt-24 text-2xl font-semibold text-foreground">
          Interview prep
        </h2>
        <p className="mt-1 text-muted-foreground">
          Question banks from junior to senior staff. Answer first, then reveal the model answer on the{' '}
          <Link href="/interview-prep" className={textLink}>
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
