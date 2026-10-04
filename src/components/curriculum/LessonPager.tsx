import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { LessonContext, NeighbourLesson } from "@/lib/curriculum/lesson-context";
import { cn } from "@/lib/utils";

const cardClass =
  "group flex min-h-[5.5rem] flex-col justify-center rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PagerLink({ lesson, direction }: { lesson: NeighbourLesson; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  return (
    <Link
      href={lesson.href}
      rel={isNext ? "next" : "prev"}
      className={cn(cardClass, isNext ? "sm:col-start-2 sm:text-right" : "sm:col-start-1")}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          isNext && "sm:justify-end",
        )}
      >
        {isNext ? null : <ArrowLeft aria-hidden="true" className="h-4 w-4" />}
        {isNext ? "Next lesson" : "Previous lesson"}
        {isNext ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
      </span>{" "}
      <span className="mt-2 text-sm font-semibold text-foreground group-hover:text-primary">{lesson.label}</span>{" "}
      <span className="mt-1 text-xs text-muted-foreground">{lesson.boundary}</span>
    </Link>
  );
}

/**
 * Previous and next lessons on the learning path (G30-PAGE-10): each card says
 * where the step goes ("Next module: I-SV-2A", "Starts Tier 3: Advanced").
 * After the last lesson the card points back to the overview, so the page is
 * never a dead end.
 */
export default function LessonPager({ context, className }: { context: LessonContext; className?: string }) {
  const { prev, next, lesson } = context;
  return (
    <nav aria-label="Previous and next lesson" className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {prev ? <PagerLink lesson={prev} direction="prev" /> : null}
      {next ? (
        <PagerLink lesson={next} direction="next" />
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 text-sm shadow-sm sm:col-start-2" data-testid="end-of-path">
          <p className="font-semibold text-foreground">
            {lesson.track === "core" ? "You have reached the end of the core path." : "This is the last lesson in the curriculum."}
          </p>
          <p className="mt-1 text-muted-foreground">
            Choose an elective, review a module, or practise on the{" "}
            <Link href="/curriculum" className="font-semibold text-foreground underline underline-offset-2">
              curriculum overview
            </Link>{" "}
            and in the{" "}
            <Link href="/practice" className="font-semibold text-foreground underline underline-offset-2">
              practice hub
            </Link>
            .
          </p>
        </div>
      )}
    </nav>
  );
}
