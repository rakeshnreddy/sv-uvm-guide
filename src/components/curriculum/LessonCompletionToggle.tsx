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

/**
 * "Mark this lesson as done": a toggle button saved in this browser
 * (completedLessons in 'curriculumProgress'). The server render and the
 * hydrating render always show the neutral, unpressed state; the stored state
 * appears right after hydration. A write that is not saved says why in the
 * status line below the button.
 */
export function LessonCompletionToggle({ moduleId, lessonSlug, className }: LessonCompletionToggleProps) {
  const { progress, isLoaded } = useCurriculumProgress();
  const [outcome, setOutcome] = useState<WriteOutcome | null>(null);

  const done = isLoaded && (progress[moduleId]?.completedLessons.includes(lessonSlug) ?? false);
  const message = outcome ? writeOutcomeMessage(outcome) : null;

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
        {done ? (
          <span className="[overflow-wrap:anywhere]">
            Done <span aria-hidden="true">✓</span> (saved in this browser)
          </span>
        ) : (
          <span className="[overflow-wrap:anywhere]">Mark this lesson as done</span>
        )}
      </button>
      <p role="status" aria-live="polite" className="text-sm font-medium text-amber-800 dark:text-amber-200">
        {message ? <span className="mt-2 block">{message}</span> : null}
      </p>
    </div>
  );
}

export default LessonCompletionToggle;
