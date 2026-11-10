import { BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { LessonContext } from "@/lib/curriculum/lesson-context";
import { cn } from "@/lib/utils";

export interface LessonOrientationProps {
  context: LessonContext;
  /** The H1: the lesson title as authored. */
  title: string;
  summary?: string;
  readingMinutes: number;
  className?: string;
}

const badgeClass =
  "inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-label text-muted-foreground";

/**
 * The lesson header (G30-PAGE-01, G30-PAGE-V01): tier and module, the title,
 * track and tier badges, the milestones the module builds, "Lesson k of N in
 * <module>" in manifest order, and "Before you start" links to the manifest
 * prerequisites. Badges are text, never colour alone.
 */
export default function LessonOrientation({ context, title, summary, readingMinutes, className }: LessonOrientationProps) {
  const { lesson, tier, module, milestones, prerequisites } = context;
  const isElective = lesson.track === "elective";

  return (
    <header className={cn("min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6", className)}>
      <p className="text-label text-subtle">
        {tier.title}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        {module.label}
      </p>
      <h1 className="mt-2 break-words text-h1 text-foreground">{title}</h1>
      {summary ? <p className="mt-3 text-lead text-muted-foreground">{summary}</p> : null}

      <ul aria-label="About this lesson" className="mt-5 flex flex-wrap items-center gap-2">
        <li className={badgeClass}>{isElective ? "Elective (optional)" : "Core path"}</li>
        <li className={badgeClass}>
          {tier.code}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          {tier.title.replace(/^Tier \d+:\s*/, "")}
        </li>
        {readingMinutes > 0 ? (
          <li className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock aria-hidden="true" className="h-4 w-4" />
            {readingMinutes}-minute read
          </li>
        ) : null}
      </ul>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground" data-testid="lesson-position">
        <BookOpen aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <span className="font-semibold text-foreground">
            Lesson {lesson.position} of {lesson.count}
          </span>{" "}
          in {module.label}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          module {module.position} of {module.count} in {tier.title}
        </span>
      </p>

      {milestones.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Builds toward:</span>{" "}
          {milestones.map((milestone, index) => (
            <React.Fragment key={milestone.id}>
              {index > 0 ? "; " : null}
              <span className="font-semibold text-foreground">{milestone.id}</span> ({milestone.label})
            </React.Fragment>
          ))}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl border border-border bg-muted p-4" data-testid="before-you-start-chips">
        <p id="before-you-start-label" className="text-sm font-semibold text-foreground">
          Before you start
        </p>
        {prerequisites.length > 0 ? (
          <ul aria-labelledby="before-you-start-label" className="mt-2 flex flex-wrap gap-2">
            {prerequisites.map((item) => (
              <li key={item.href} className="min-w-0 max-w-full">
                <Link
                  href={item.href}
                  className="inline-flex min-h-[2.5rem] max-w-full items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground underline-offset-2 transition-colors duration-150 ease-bench hover:border-input hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 break-words">
                    {item.kind === "lesson" ? <span className="text-muted-foreground">Previous lesson: </span> : null}
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No prerequisites: this lesson is a starting point.</p>
        )}
      </div>
    </header>
  );
}
