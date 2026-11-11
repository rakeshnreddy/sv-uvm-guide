import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { LessonContext, NeighbourLesson } from "@/lib/curriculum/lesson-context";
import { CURRICULUM_HREF, PRACTICE_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { focusRing, inlineLink } from "./overview-ui";

/**
 * The next lesson: the one filled accent action at the end of a lesson. The
 * link's text reads "Next lesson <title> <where the step goes>", so its name
 * starts with "Next lesson". The transparent border keeps a boundary in forced
 * colours.
 */
export const NEXT_LESSON_LINK_CLASS = cn(
  "flex min-w-0 items-center gap-4 rounded-xl border border-transparent bg-primary px-5 py-4 text-primary-foreground transition-colors duration-150 ease-bench hover:bg-primary/90 forced-colors:border-[ButtonText] motion-reduce:transition-none",
  focusRing,
);

/** The previous lesson: a quiet 40 px text link under the next one. */
export const PREVIOUS_LESSON_LINK_CLASS = cn(
  "group inline-flex min-h-[2.5rem] max-w-full items-center gap-2 self-start rounded text-ui text-muted-foreground transition-colors duration-150 ease-bench hover:text-foreground motion-reduce:transition-none",
  focusRing,
);

/**
 * The step line under the next lesson's title. A module step whose title
 * already starts with the module code ("I-UVM-1C: UVM Phasing ...") drops the
 * code, so "Next module: I-UVM-1C" reads "Next module". Every other step keeps
 * its words ("Starts Tier 3: Advanced", "Lesson 3 of 9 in I-UVM-3B").
 */
export function nextLessonBoundary(lesson: Pick<NeighbourLesson, "label" | "boundary" | "step" | "moduleCode">): string {
  if (lesson.step !== "module") return lesson.boundary;
  const code = lesson.moduleCode;
  const labelHasCode = lesson.label.startsWith(`${code}:`) || lesson.label.startsWith(`${code} `);
  if (!labelHasCode) return lesson.boundary;
  return lesson.boundary.replace(`Next module: ${code}`, "Next module");
}

function NextLessonLink({ lesson }: { lesson: NeighbourLesson }) {
  return (
    <Link href={lesson.href} rel="next" className={NEXT_LESSON_LINK_CLASS}>
      <span className="min-w-0 flex-1">
        <span className="block text-label">Next lesson</span>{" "}
        <span className="mt-1 block break-words text-h4">{lesson.label}</span>{" "}
        <span className="mt-1 block text-ui">{nextLessonBoundary(lesson)}</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
    </Link>
  );
}

function PreviousLessonLink({ lesson }: { lesson: NeighbourLesson }) {
  return (
    <Link href={lesson.href} rel="prev" className={PREVIOUS_LESSON_LINK_CLASS}>
      <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">
        Previous lesson: <span className="text-foreground group-hover:underline">{lesson.label}</span>
      </span>
    </Link>
  );
}

/**
 * Previous and next lessons on the learning path (G30-PAGE-10). The next
 * lesson is the filled action and says where the step goes ("Next module:
 * I-SV-2A", "Starts Tier 3: Advanced"); the previous lesson is a quiet link
 * under it. After the last lesson the block points back to the overview, so
 * the page is never a dead end.
 */
export default function LessonPager({ context, className }: { context: LessonContext; className?: string }) {
  const { prev, next, lesson } = context;
  return (
    <nav aria-label="Previous and next lesson" className={cn("flex min-w-0 flex-col gap-2", className)}>
      {next ? (
        <NextLessonLink lesson={next} />
      ) : (
        <div className="text-ui" data-testid="end-of-path">
          <p className="font-medium text-foreground">
            {lesson.track === "core" ? "You have reached the end of the core path." : "This is the last lesson in the curriculum."}
          </p>
          <p className="mt-1 max-w-[30em] text-muted-foreground">
            Choose an elective, review a module, or practise on the{" "}
            <Link href={CURRICULUM_HREF} className={inlineLink}>
              curriculum overview
            </Link>{" "}
            and in the{" "}
            <Link href={PRACTICE_HREF} className={inlineLink}>
              practice hub
            </Link>
            .
          </p>
        </div>
      )}
      {prev ? <PreviousLessonLink lesson={prev} /> : null}
    </nav>
  );
}
