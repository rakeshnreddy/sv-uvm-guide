"use client";

import React, { useRef } from "react";

import { cn } from "@/lib/utils";

import { useReadingProgress } from "./useLessonReading";

/** The lesson article's id: what the progress lines measure. */
export const LESSON_ARTICLE_ID = "lesson-content";

export interface ReadingProgressLineProps {
  /** The element whose reading progress the line shows. */
  targetId?: string;
  className?: string;
}

/**
 * A 2 px accent line that grows from the left as the reader moves through the
 * article. Decorative (the "On this page" entry carries the position in
 * words), so it is hidden from assistive technology. It only ever changes its
 * transform, never its size, and it has no transition, so reduced motion is
 * respected and nothing around it moves.
 */
export function ReadingProgressLine({ targetId = LESSON_ARTICLE_ID, className }: ReadingProgressLineProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useReadingProgress(targetId, ref);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-reading-progress=""
      className={cn("pointer-events-none block h-0.5 origin-left scale-x-0 bg-primary", className)}
    />
  );
}

/**
 * The line along the bottom edge of the sticky site header (h-16), from 1280
 * px. Below that the contents bar under the header carries the same line.
 * It sits over the header's own hairline and is fixed, so it takes no space.
 */
export function HeaderReadingProgress({ targetId = LESSON_ARTICLE_ID }: { targetId?: string }) {
  return (
    <ReadingProgressLine
      targetId={targetId}
      className="fixed inset-x-0 top-[3.875rem] z-40 hidden xl:block print:hidden"
    />
  );
}

export default HeaderReadingProgress;
