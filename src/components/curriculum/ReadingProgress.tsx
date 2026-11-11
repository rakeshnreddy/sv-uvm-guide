"use client";

import { usePathname } from "next/navigation";
import React, { useRef } from "react";

import { useShellState } from "@/components/search/shell-store";
import { lessonTierFromPathname, tierDataAttribute, type TierNumber } from "@/lib/tier-colors";
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
 * The line's fill (DESIGN.md section 11, gradient accents): the lesson's tier
 * colour running into the accent. With no tier (a page outside the four
 * tiers) it is the plain accent. The gradient scales with the line, so every
 * length shows both ends.
 */
export function readingProgressFill(tier: TierNumber | undefined): string {
  return tier ? "bg-gradient-to-r from-tier-current to-primary" : "bg-primary";
}

/**
 * A 2 px line that grows from the left as the reader moves through the
 * article. Decorative (the "On this page" entry carries the position in
 * words), so it is hidden from assistive technology. It only ever changes its
 * transform, never its size, and it has no transition, so reduced motion is
 * respected and nothing around it moves. It takes the tier from the lesson's
 * URL and carries it as data-tier, so it needs no tiered ancestor.
 */
export function ReadingProgressLine({ targetId = LESSON_ARTICLE_ID, className }: ReadingProgressLineProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const tier = lessonTierFromPathname(usePathname());
  useReadingProgress(targetId, ref);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-reading-progress=""
      data-tier={tierDataAttribute(tier)}
      className={cn("pointer-events-none block h-0.5 origin-left scale-x-0 rounded-full", readingProgressFill(tier), className)}
    />
  );
}

/**
 * Where the header's line sits: on the bottom edge of the glass bar (the bar
 * runs from 8 to 56 px inside the 64 px header), inset 24 px from the bar's
 * ends so it clears the 16 px corners. The bar spans the viewport less 8 px
 * while the outline is docked, and the page frame plus 16 px once the
 * learner hides it (nav-styles headerBarFrameClass).
 */
export function headerProgressFrameClass(outlineCollapsed: boolean): string {
  return cn(
    "pointer-events-none fixed inset-x-0 top-[3.375rem] z-40 hidden xl:block print:hidden",
    outlineCollapsed ? "mx-auto max-w-7xl px-10" : "px-8",
  );
}

/**
 * The line along the bottom edge of the header's glass bar, from 1280 px.
 * Below that the contents bar under the header carries the same line. It is
 * fixed, so it takes no space.
 */
export function HeaderReadingProgress({ targetId = LESSON_ARTICLE_ID }: { targetId?: string }) {
  const collapsed = useShellState((state) => state.outlineCollapsed);
  return (
    <div aria-hidden="true" data-header-progress="" className={headerProgressFrameClass(collapsed)}>
      <ReadingProgressLine targetId={targetId} />
    </div>
  );
}

export default HeaderReadingProgress;
