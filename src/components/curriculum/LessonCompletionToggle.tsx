"use client";

import React, { useState } from "react";

import { completeLesson, uncompleteLesson, useCurriculumProgress } from "@/hooks/useCurriculumProgress";
import { writeOutcomeMessage, type WriteOutcome } from "@/lib/learner-store/record";
import { cn } from "@/lib/utils";

export interface LessonCompletionToggleProps {
  /** The module's section slug, the key 'curriculumProgress' uses. */
  moduleId: string;
  lessonSlug: string;
  className?: string;
}

const buttonBase =
  "inline-flex min-h-[44px] max-w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-left text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The toggle's one accessible name; aria-pressed carries the state (WAI-ARIA APG toggle button). */
export const LESSON_DONE_LABEL = "Lesson done";
/** Status text while the lesson is marked done and the mark is stored. */
export const LESSON_DONE_SAVED_STATUS = "Marked done. Saved in this browser.";

/**
 * "Lesson done": a toggle button saved in this browser (completedLessons in
 * 'curriculumProgress'). Its label never changes; aria-pressed and the check
 * box show the state. The server render and the hydrating render always show
 * the neutral, unpressed state; the stored state appears right after
 * hydration. The status line below the button (a polite live region) says
 * the mark is saved in this browser, or why a write was not saved.
 */
export function LessonCompletionToggle({ moduleId, lessonSlug, className }: LessonCompletionToggleProps) {
  const { progress, isLoaded } = useCurriculumProgress();
  const [outcome, setOutcome] = useState<WriteOutcome | null>(null);

  const done = isLoaded && (progress[moduleId]?.completedLessons.includes(lessonSlug) ?? false);
  const message = outcome ? writeOutcomeMessage(outcome) : null;
  const status = message ?? (done ? LESSON_DONE_SAVED_STATUS : null);

  const toggle = () => {
    setOutcome(done ? uncompleteLesson(moduleId, lessonSlug) : completeLesson(moduleId, lessonSlug));
  };

  return (
    <div className={cn("min-w-0", className)} data-testid="lesson-completion">
      <button
        type="button"
        aria-pressed={done}
        onClick={toggle}
        className={cn(
          buttonBase,
          done
            ? "border-primary bg-primary/10 text-foreground hover:bg-primary/15"
            : "border-border bg-background text-foreground hover:border-primary",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs leading-none",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground bg-background",
          )}
        >
          {done ? "✓" : null}
        </span>
        <span className="[overflow-wrap:anywhere]">{LESSON_DONE_LABEL}</span>
      </button>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "text-sm font-medium",
          message ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground",
        )}
      >
        {status ? <span className="mt-2 block">{status}</span> : null}
      </p>
    </div>
  );
}

export default LessonCompletionToggle;
