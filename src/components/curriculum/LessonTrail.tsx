import React from "react";

import ModuleJumpMenu from "@/components/curriculum/ModuleJumpMenu";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { getLessonContext } from "@/lib/curriculum/lesson-context";
import { CURRICULUM_HREF, PRIMARY_NAV, isNavGroup, tierSectionHref } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { withoutCode } from "./CodedLabel";

/** The curriculum's label from the one navigation config ("Curriculum"). */
const CURRICULUM_LABEL =
  PRIMARY_NAV.find((item) => !isNavGroup(item) && item.href === CURRICULUM_HREF)?.label ?? "Curriculum";

/**
 * The trail above a lesson or module page: Curriculum, the tier (its section
 * of /curriculum), the module with its code as a signal tag, then the lesson.
 * On a module's first page the module is the current (last) item. Every item
 * has a canonical href, so the current one stays a link with
 * aria-current="page". Empty for a slug that is not a lesson.
 */
export function lessonTrailItems(slug: readonly string[]): BreadcrumbItem[] {
  const context = getLessonContext(slug);
  if (!context) return [];
  const { tier, module, lesson } = context;
  const items: BreadcrumbItem[] = [
    { label: CURRICULUM_LABEL, href: CURRICULUM_HREF },
    { label: tier.title, href: tierSectionHref(tier.id) },
    { label: withoutCode(module.label, module.code), code: module.code, href: module.href },
  ];
  if (!lesson.isModulePage) items.push({ label: lesson.title, href: lesson.href });
  return items;
}

export interface LessonTrailProps {
  /** The lesson's slug in any accepted form; the trail always uses canonical links. */
  slug: readonly string[];
  className?: string;
}

/**
 * The shared breadcrumb trail for lessons, with "Jump to" listing the module's
 * lessons beside it. No card: a plain row. Below 640 px the trail is one back
 * link to the parent.
 */
export default function LessonTrail({ slug, className }: LessonTrailProps) {
  const items = lessonTrailItems(slug);
  const context = getLessonContext(slug);
  if (items.length === 0 || !context) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 print:hidden", className)}>
      {/* -ml-1 cancels the crumb links' own padding, so the trail's text starts at the title's edge. */}
      <Breadcrumbs items={items} className="-ml-1 min-w-0 flex-1" />
      {context.lessons.length > 1 ? (
        <ModuleJumpMenu
          moduleLabel={context.module.label}
          lessons={context.lessons.map((entry) => ({ href: entry.href, title: entry.title, current: entry.current }))}
        />
      ) : null}
    </div>
  );
}
