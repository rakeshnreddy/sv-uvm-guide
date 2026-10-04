import React from 'react';
import Link from 'next/link';

import { LabPrerequisiteList, LessonLinkList, focusRing } from '@/components/practice/LearnInLesson';
import type { LabBackLink as LabBackLinkData, LabPrerequisites, LessonLink } from '@/lib/practice-links';
import { cn } from '@/lib/utils';

/*
 * Orientation for a lab page: where to go back to, which lessons teach the lab,
 * and what to finish first. Presentational only (the data comes from
 * src/lib/practice-links.ts on the server), so the client lab workspace can
 * render it without bundling the curriculum.
 */

interface LabBackLinkProps {
  backLink: LabBackLinkData;
  className?: string;
}

/** "Back to module: <code> <title>", derived from the lab and the manifest. */
export function LabBackLink({ backLink, className }: LabBackLinkProps) {
  const { lesson } = backLink;
  return (
    <Link
      href={backLink.href}
      className={cn(
        'inline-flex max-w-full items-baseline gap-1.5 rounded-sm py-1 text-sm font-medium text-primary underline-offset-4 hover:underline',
        focusRing,
        className,
      )}
    >
      <span aria-hidden="true">←</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {backLink.label}
        {lesson ? (
          <span className="font-normal text-muted-foreground">
            : {lesson.code} {lesson.title}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

interface LabLessonContextProps {
  /** Launching lesson first, then related lessons (capstone checkpoints, revisits). */
  lessons: readonly LessonLink[];
  prerequisites: Pick<LabPrerequisites, 'items' | 'doAfter'>;
  className?: string;
}

/** "Learn it in", "Related lessons", "Before you start" and "Do this lab after …" for one lab. */
export function LabLessonContext({ lessons, prerequisites, className }: LabLessonContextProps) {
  const [teacher, ...related] = lessons;
  const hasPrerequisites = prerequisites.items.length > 0 || Boolean(prerequisites.doAfter);
  if (!teacher && !hasPrerequisites) return null;
  return (
    <div className={cn('space-y-3', className)}>
      {teacher ? <LessonLinkList lessons={[teacher]} label="Learn it in" /> : null}
      <LessonLinkList lessons={related} label="Related lessons" />
      <LabPrerequisiteList prerequisites={prerequisites} />
    </div>
  );
}
