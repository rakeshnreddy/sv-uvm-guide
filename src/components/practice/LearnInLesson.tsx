import React from 'react';
import Link from 'next/link';

import type { LabPrerequisites, LessonLink, PracticeItem } from '@/lib/practice-links';
import { cn } from '@/lib/utils';

/*
 * Presentational only: everything arrives as props (plain data from
 * src/lib/practice-links.ts), so client components such as the lab workspace
 * can render these links without bundling the curriculum.
 */

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
const textLink = cn('rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing);

interface LessonChipLinkProps {
  lesson: LessonLink;
  className?: string;
}

/** A link to a lesson: the module code as a tag, then the lesson title. Electives say so in text. */
export function LessonChipLink({ lesson, className }: LessonChipLinkProps) {
  return (
    <Link
      href={lesson.href}
      className={cn(
        'inline-flex max-w-full items-baseline gap-2 rounded-sm py-1 text-sm font-medium text-primary underline-offset-4 hover:underline',
        focusRing,
        className,
      )}
    >
      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground [font-variant-ligatures:none]">
        {lesson.code}
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {lesson.title}
        {lesson.track === 'elective' ? <span className="text-muted-foreground"> (elective)</span> : null}
      </span>
    </Link>
  );
}

interface LessonLinkListProps {
  lessons: readonly LessonLink[];
  /** Visible label before the links, for example "Learn it in". */
  label: string;
  className?: string;
  /** Classes for each link (for example `relative z-10` inside a card with a stretched link). */
  linkClassName?: string;
}

/** A labelled, wrapping list of lesson links. Renders nothing when there are no lessons. */
export function LessonLinkList({ lessons, label, className, linkClassName }: LessonLinkListProps) {
  if (lessons.length === 0) return null;
  return (
    <div className={cn('text-sm', className)}>
      <p className={eyebrow}>{label}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {lessons.map((lesson) => (
          <li key={lesson.ref} className="min-w-0 max-w-full">
            <LessonChipLink lesson={lesson} className={linkClassName} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LabPrerequisiteListProps {
  prerequisites: Pick<LabPrerequisites, 'items' | 'doAfter'>;
  className?: string;
  /** Classes for each link (for example `relative z-10` inside a card with a stretched link). */
  linkClassName?: string;
}

/**
 * "Before you start" for a lab: prerequisite lessons and labs as links (a lab
 * that is not available yet is plain text), and "Do this after <lesson>" when a
 * prerequisite is taught later than the lab's own lesson.
 */
export function LabPrerequisiteList({ prerequisites, className, linkClassName }: LabPrerequisiteListProps) {
  const { items, doAfter } = prerequisites;
  if (items.length === 0 && !doAfter) return null;
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      {items.length > 0 ? (
        <div>
          <p className={eyebrow}>Before you start</p>
          <ul className="mt-1 space-y-1">
            {items.map((item) => (
              <li key={`${item.kind}:${item.id}`} className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                {item.kind === 'lesson' && item.lesson ? (
                  <LessonChipLink lesson={item.lesson} className={linkClassName} />
                ) : item.href ? (
                  <Link href={item.href} className={cn('inline-block py-1', textLink, linkClassName)}>
                    Lab: {item.title}
                  </Link>
                ) : (
                  <span className="inline-block py-1">
                    Lab: {item.title} <span className="whitespace-nowrap">(planned, not available yet)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {doAfter ? (
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">Do this lab after </span>
          <LessonChipLink lesson={doAfter} className={linkClassName} />
          <span>. A prerequisite comes from that later lesson.</span>
        </p>
      ) : null}
    </div>
  );
}

interface LearnInLessonProps {
  /** The practice item, from `requirePracticePage(<route>)` in src/lib/practice-links.ts. */
  item: Pick<PracticeItem, 'title' | 'lessons'>;
  className?: string;
}

/**
 * "Learn this in": the back link from a practice page to the lesson that
 * teaches it, plus related lessons. The data comes from the practice map, so
 * the page and the Practice Hub always agree.
 */
export default function LearnInLesson({ item, className }: LearnInLessonProps) {
  if (item.lessons.length === 0) return null;
  const [teacher, ...related] = item.lessons;

  return (
    <nav
      aria-label={`Lessons for ${item.title}`}
      className={cn(
        'not-prose mb-8 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5',
        className,
      )}
    >
      <p className={eyebrow}>Learn this in</p>
      <p className="mt-1">
        <LessonChipLink lesson={teacher} className="text-base" />
      </p>
      <LessonLinkList lessons={related} label="Related lessons" className="mt-3" />
    </nav>
  );
}
