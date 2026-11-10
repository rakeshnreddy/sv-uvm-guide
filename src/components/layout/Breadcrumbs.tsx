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
 * A crumb's list item. The current crumb grows from its own width into the
 * room that is free (flex 1 1 auto, no width cap): it stays on the row when it
 * fits, moves to its own line when it does not, and truncates only when even
 * a full line is too short. The crumbs before it keep their own width, capped
 * by crumbLinkClass.
 */
export function crumbItemClass(current: boolean): string {
  return cn("flex min-w-0 items-center gap-1", current && "flex-auto");
}

/** A crumb's link: a 40 px target. Ancestors are capped at 15rem (20rem from 640 px); the current crumb is not. */
export function crumbLinkClass(current: boolean): string {
  return cn(
    "inline-flex min-h-[2.5rem] min-w-0 items-center rounded px-1 transition-colors duration-150 ease-bench hover:text-foreground motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    current ? "max-w-full font-medium text-foreground" : "max-w-[15rem] text-muted-foreground sm:max-w-[20rem]",
  );
}

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
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-1 text-sm text-muted-foreground print:hidden sm:px-4",
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0">
          {crumbs.map((crumb, index) => (
            <li key={crumb.href} className={crumbItemClass(crumb.current)}>
              {index > 0 ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
              <Link href={crumb.href} aria-current={crumb.current ? "page" : undefined} className={crumbLinkClass(crumb.current)}>
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
