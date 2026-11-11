import Link from "next/link";
import React from "react";

import { FLASHCARDS_SECTION } from "@/lib/curriculum/lesson-mdx";
import type { LessonContext } from "@/lib/curriculum/lesson-context";
import type { LessonPracticeEntry } from "@/lib/practice-links";
import { cn } from "@/lib/utils";

import { LessonCompletionToggle } from "./LessonCompletionToggle";
import LessonPager from "./LessonPager";
import { secondaryAction } from "./overview-ui";

export interface LessonLabLink {
  href: string;
  title: string;
}

/**
 * The lab to suggest at the end of a lesson: the module's first lab that can
 * be opened now. A lab taught by a later lesson ("Do this after …") is left
 * for that lesson.
 */
export function lessonLab(practice: readonly LessonPracticeEntry[]): LessonLabLink | null {
  const entry = practice.find(
    ({ item, after }) => item.kind === "lab" && item.status === "available" && Boolean(item.href) && !after,
  );
  return entry?.item.href ? { href: entry.item.href, title: entry.item.title } : null;
}

export interface LessonNextBlockProps {
  context: LessonContext;
  /** The module's section slug and the lesson slug, the keys "Lesson done" is saved under. */
  moduleId: string;
  lessonSlug: string;
  /** The module's lab, from lessonLab(). */
  lab?: LessonLabLink | null;
  /** True when the lesson has a flashcard deck with cards: "Review flashcards" goes to it. */
  hasFlashcards?: boolean;
  className?: string;
}

/** The Next block: a liquid glass panel (DESIGN.md section 12), radius 16, padded 20 to 24. */
export const LESSON_NEXT_PANEL_CLASS = "glass-liquid mt-16 p-5 sm:p-6 print:hidden";

const QUIET_ACTION_CLASS = cn(secondaryAction, "w-full justify-start text-left sm:w-auto");

/**
 * The end of a lesson (SPEC-phases-2-4.md, "Lesson page"; DESIGN.md section
 * 10, "Next step at the end of every lesson"): a liquid glass panel with
 * "Lesson done", then the next lesson as the one accent action and, beside it
 * and quieter, the module's lab and "Review flashcards" when the lesson has a
 * deck. The previous lesson is a text link under the next one.
 */
export default function LessonNextBlock({ context, moduleId, lessonSlug, lab, hasFlashcards = false, className }: LessonNextBlockProps) {
  const reinforce = Boolean(lab) || hasFlashcards;
  return (
    <section
      aria-labelledby="lesson-next-heading"
      data-testid="lesson-next"
      className={cn(LESSON_NEXT_PANEL_CLASS, className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <h2 id="lesson-next-heading" className="text-h2 text-foreground">
          Next
        </h2>
        <LessonCompletionToggle moduleId={moduleId} lessonSlug={lessonSlug} />
      </div>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <LessonPager context={context} className="md:w-[26rem] md:shrink-0" />
        {reinforce ? (
          <ul aria-label="Practise this lesson" className="flex min-w-0 flex-col gap-3" data-testid="lesson-reinforce">
            {lab ? (
              <li className="min-w-0">
                <Link href={lab.href} className={QUIET_ACTION_CLASS}>
                  <span className="min-w-0 break-words">Lab: {lab.title}</span>
                </Link>
              </li>
            ) : null}
            {hasFlashcards ? (
              <li className="min-w-0">
                <a href={`#${FLASHCARDS_SECTION.id}`} className={QUIET_ACTION_CLASS}>
                  Review flashcards
                </a>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
