import Link from "next/link";
import React from "react";

import { lessonPrerequisites } from "@/lib/curriculum/lesson-context";
import { lessonSegments } from "@/lib/curriculum/lesson-urls";
import { cn } from "@/lib/utils";

export interface BeforeYouStartProps {
  /**
   * The lesson to describe, as segments or a `/curriculum/…` URL. Leave it out
   * in lessons: the lesson page passes the current lesson, so authors write
   * `<BeforeYouStart />` on its own line at the end of Quick Take.
   */
  lesson?: string | readonly string[];
  className?: string;
}

/**
 * The "Before you start:" line, generated from the curriculum manifest so it
 * cannot drift from the navigation (G30-PAGE-01, G30-LINK-02). A module's
 * first page lists the module's prerequisites; a later page lists the page
 * before it, then the module's prerequisites. Every link is canonical.
 *
 * Renders a block-level <span> so it is valid both on its own line and inside
 * a paragraph.
 */
export function BeforeYouStart({ lesson, className }: BeforeYouStartProps) {
  const segments = lessonSegments(lesson);
  const items = segments ? lessonPrerequisites(segments) : undefined;
  if (!items) return null;

  return (
    <span className={cn("my-[1.25em] block", className)} data-testid="before-you-start">
      <strong>Before you start:</strong>{" "}
      {items.length === 0 ? (
        "no prerequisites. This lesson is a starting point."
      ) : (
        <>
          {items.map((item, index) => (
            <React.Fragment key={item.href}>
              {index > 0 ? (index === items.length - 1 ? " and " : ", ") : null}
              <Link href={item.href}>{item.label}</Link>
              {item.kind === "lesson" ? " (the previous lesson in this module)" : null}
            </React.Fragment>
          ))}
          .
        </>
      )}
    </span>
  );
}

export default BeforeYouStart;
