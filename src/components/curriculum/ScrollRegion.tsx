import React from "react";

import { cn } from "@/lib/utils";

import { ScrollRegionFrame } from "./ScrollRegionFrame";

/**
 * Lesson tables (and other wide content) can be wider than a phone screen. Each one sits
 * in its own horizontal scroll box that keyboard users can focus and scroll with
 * the arrow keys, and that screen readers announce by name. The page itself
 * never scrolls sideways.
 */
const regionClass =
  "my-6 max-w-full overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A box that scrolls its content sideways. While the content overflows it is a
 * focusable, labelled region; when the content fits it is a plain box.
 */
export function ScrollRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollRegionFrame label={label} className={regionClass}>
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
};
