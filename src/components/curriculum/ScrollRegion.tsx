import React from "react";

import { LessonCheckbox, LessonTableHeader } from "@/components/mdx/LessonGfm";
import { cn } from "@/lib/utils";

import { ScrollRegionFrame } from "./ScrollRegionFrame";

/**
 * Lesson tables (and other wide content) can be wider than a phone screen. Each one sits
 * in its own horizontal scroll box that keyboard users can focus and scroll with
 * the arrow keys, and that screen readers announce by name. The page itself
 * never scrolls sideways. The box is a liquid glass panel (DESIGN.md section
 * 12), radius 16; globals.css styles the table inside it.
 */
export const SCROLL_REGION_CLASS =
  "glass-liquid my-6 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A box that scrolls its content sideways. While the content overflows it is a
 * focusable, labelled region; when the content fits it is a plain box.
 */
export function ScrollRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollRegionFrame label={label} className={SCROLL_REGION_CLASS}>
      {children}
    </ScrollRegionFrame>
  );
}

/**
 * A Markdown table. It keeps `display: table`, so assistive technology still
 * reads its rows and cells; the region around it does the scrolling.
 */
export function LessonTable({ className, ...props }: React.ComponentPropsWithoutRef<"table">) {
  return (
    <ScrollRegion label="Table">
      <table {...props} className={cn("my-0", className)} />
    </ScrollRegion>
  );
}

/**
 * MDX overrides for the lesson page: spread after the component registry.
 * Fenced code is not here: the registry's `pre` (MdxCodeBlock) draws the
 * CodeBlock, whose frame is its own focusable, labelled scroll region.
 */
export const lessonScrollRegionComponents = {
  table: LessonTable,
  // GFM task-list marks and an empty corner header cell, made accessible (LessonGfm).
  input: LessonCheckbox,
  th: LessonTableHeader,
};
