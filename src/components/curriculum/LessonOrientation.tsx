import Link from "next/link";
import React from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { LevelBadge } from "@/components/ui/Badge";
import { SignalTag } from "@/components/ui/SignalTag";
import type { LessonContext } from "@/lib/curriculum/lesson-context";
import { cn } from "@/lib/utils";

import { CodedLabel, withoutCode } from "./CodedLabel";
import { tagInLink } from "./overview-ui";

export interface LessonOrientationProps {
  context: LessonContext;
  /** The H1: the lesson title as authored. */
  title: string;
  summary?: string;
  readingMinutes: number;
  className?: string;
}

/** The "Before you start" label: 14/20 at 500 in the secondary colour. */
const ROW_LABEL_CLASS = "shrink-0 text-ui font-medium text-muted-foreground";

/** A prerequisite: a 40 px link row, the module code as a signal tag that takes the accent on hover and focus. */
const PREREQUISITE_LINK_CLASS =
  "group inline-flex min-h-[2.5rem] max-w-full items-center rounded text-ui text-foreground underline-offset-4 transition-colors duration-150 ease-bench hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The tier and module as signal tags, the eyebrow over the title. The trail
 * above already names both, so the eyebrow carries only the codes. The module
 * tag shows only on phones, where the trail collapses to its back-link to the
 * tier; from sm up the trail's last crumb shows it. It is left out entirely
 * when the title already starts with the code (a module's first page,
 * "I-UVM-1B: The UVM Factory"). An elective says so as quiet text.
 */
function LessonEyebrow({ context, title }: { context: LessonContext; title: string }) {
  const { tier, module, lesson } = context;
  const titleHasCode = title.startsWith(`${module.code}:`) || title.startsWith(`${module.code} `);
  return (
    <>
      <SignalTag code={tier.code} title={tier.title} />
      <span className="sr-only">{tier.title}</span>
      {titleHasCode ? null : (
        <span className="contents sm:hidden" data-testid="lesson-eyebrow-module">
          <SignalTag code={module.code} title={module.label} />
          <span className="sr-only">, module {module.label}</span>
        </span>
      )}
      {lesson.track === "elective" ? <LevelBadge level="elective">Elective, optional</LevelBadge> : null}
    </>
  );
}

/**
 * "Before you start" (G30-PAGE-01): one inline row when the lesson is a
 * starting point, a short list of links when there is something to read first
 * (the previous page of the module, then the manifest prerequisites).
 */
function BeforeYouStartRow({ context }: { context: LessonContext }) {
  const { prerequisites } = context;
  if (prerequisites.length === 0) {
    return (
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-ui" data-testid="before-you-start-chips">
        <span className={ROW_LABEL_CLASS}>Before you start</span>{" "}
        <span className="text-muted-foreground">No prerequisites: this lesson is a starting point.</span>
      </p>
    );
  }
  return (
    <div className="mt-4 text-ui" data-testid="before-you-start-chips">
      <p id="before-you-start-label" className={ROW_LABEL_CLASS}>
        Before you start
      </p>
      <ul aria-labelledby="before-you-start-label" className="mt-1 flex flex-col">
        {prerequisites.map((item) => (
          <li key={item.href} className="min-w-0 max-w-full">
            <Link href={item.href} className={PREREQUISITE_LINK_CLASS}>
              {item.kind === "lesson" ? (
                <span className="min-w-0 break-words">
                  <span className="text-muted-foreground">Previous lesson: </span>
                  {item.label}
                </span>
              ) : (
                <CodedLabel
                  code={item.moduleCode}
                  title={withoutCode(item.label, item.moduleCode)}
                  tagClassName={cn(tagInLink, "group-focus-visible:ring-0")}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The lesson header (G30-PAGE-01, G30-PAGE-V01; SPEC-phases-2-4.md, "Lesson
 * page"), unboxed on PageHeader: the tier and module tags, the title, the
 * lead, one meta row (reading time, "Lesson k of n", "Builds toward" with the
 * module's milestones as signal tags), then "Before you start". A hairline
 * closes it. The trail sits above it (LessonTrail).
 */
export default function LessonOrientation({ context, title, summary, readingMinutes, className }: LessonOrientationProps) {
  const { lesson, module, milestones } = context;

  const meta = (
    <>
      {readingMinutes > 0 ? <span>{readingMinutes} min read</span> : null}
      <span data-testid="lesson-position">
        Lesson {lesson.position} of {lesson.count}
        <span className="sr-only"> in {module.label}</span>
      </span>
      {milestones.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1" data-testid="lesson-milestones">
          Builds toward
          {milestones.map((milestone) => (
            <React.Fragment key={milestone.id}>
              <SignalTag code={milestone.id} title={milestone.label} />
              <span className="sr-only">: {milestone.label};</span>
            </React.Fragment>
          ))}
        </span>
      ) : null}
    </>
  );

  return (
    <PageHeader
      data-testid="lesson-header"
      className={cn("min-w-0", className)}
      eyebrow={<LessonEyebrow context={context} title={title} />}
      title={title}
      lead={summary}
      meta={meta}
    >
      <BeforeYouStartRow context={context} />
    </PageHeader>
  );
}
