import { ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import ModuleJumpMenu from "@/components/curriculum/ModuleJumpMenu";
import { getLessonContext, lessonBreadcrumbs } from "@/lib/curriculum/lesson-context";
import { cn } from "@/lib/utils";

type BreadcrumbsProps = {
  /** The lesson's slug in any accepted form; the trail always uses canonical links. */
  slug: readonly string[];
  className?: string;
};

/**
 * Curriculum › Tier › Module › Lesson (G30-PAGE-05..08, G30-PAGE-14, G30-PAGE-V14):
 * an ordered list in a named navigation landmark, with aria-current="page" on
 * the last crumb and canonical links throughout. No progress icons: there is no
 * learner progress data to show yet. "Jump to" lists the module's lessons.
 */
export default function Breadcrumbs({ slug, className }: BreadcrumbsProps) {
  const crumbs = lessonBreadcrumbs(slug);
  const context = getLessonContext(slug);
  if (crumbs.length === 0 || !context) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-1 text-sm text-muted-foreground print:hidden sm:px-4",
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0">
          {crumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
              <Link
                href={crumb.href}
                aria-current={crumb.current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[2.5rem] max-w-[15rem] items-center rounded-md px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[20rem]",
                  crumb.current && "font-semibold text-foreground",
                )}
              >
                <span className="truncate">{crumb.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {context.lessons.length > 1 ? (
        <ModuleJumpMenu
          moduleLabel={context.module.label}
          lessons={context.lessons.map((lesson) => ({ href: lesson.href, title: lesson.title, current: lesson.current }))}
        />
      ) : null}
    </div>
  );
}
