import Link from "next/link";
import React from "react";

import { getLessonContext, type NeighbourLesson } from "@/lib/curriculum/lesson-context";
import { lessonSegments } from "@/lib/curriculum/lesson-urls";
import { cn } from "@/lib/utils";

export interface NextLessonProps {
  /**
   * The lesson whose successor to show, as segments or a `/curriculum/…` URL.
   * Leave it out in lessons: the lesson page passes the current lesson, so
   * authors write `<NextLesson />` on its own line in References & Next Topics.
   */
  lesson?: string | readonly string[];
  className?: string;
}

function stepNote(next: NeighbourLesson): string {
  if (next.step === "tier") return `starts ${next.tierTitle}`;
  if (next.returnsToCore) return "back on the core path";
  if (next.step === "module") return next.track === "elective" ? "next module, an elective" : "next module";
  return `lesson ${next.position} of ${next.count} in this module`;
}

/**
 * The "Next:" line of References & Next Topics, generated from the same data
 * as the page's Next card (the core path skips electives; an elective returns
 * to the path), so the two always agree (G30-LINK-02, spine §5.9).
 *
 * Renders a block-level <span> so it is valid both on its own line and inside
 * a paragraph.
 */
export function NextLesson({ lesson, className }: NextLessonProps) {
  const segments = lessonSegments(lesson);
  const context = segments ? getLessonContext(segments) : undefined;
  if (!context) return null;
  const { next } = context;

  return (
    <span className={cn("my-[1.25em] block", className)} data-testid="next-lesson">
      <strong>Next:</strong>{" "}
      {next ? (
        <>
          <Link href={next.href}>{next.label}</Link> ({stepNote(next)}).
        </>
      ) : (
        <>
          {context.lesson.track === "core"
            ? "this is the last lesson on the core path. "
            : "this is the last lesson in the curriculum. "}
          Choose an elective or a module to review on the <Link href="/curriculum">curriculum overview</Link>.
        </>
      )}
    </span>
  );
}

export default NextLesson;
