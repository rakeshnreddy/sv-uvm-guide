import Link from "next/link";
import React from "react";

import { siteLink } from "@/lib/nav-labels";
import { DASHBOARD_HREF, NOTEBOOK_HREF, REVIEW_HREF, SELF_ASSESSMENT_HREF, SETTINGS_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

export type LearnerSection = "dashboard" | "review" | "notebook" | "assessment" | "settings";

export interface LearnerSectionLink {
  id: LearnerSection;
  label: string;
  href: string;
}

const LEARNER_SECTION_HREFS: Readonly<Record<LearnerSection, string>> = {
  dashboard: DASHBOARD_HREF,
  review: REVIEW_HREF,
  notebook: NOTEBOOK_HREF,
  assessment: SELF_ASSESSMENT_HREF,
  settings: SETTINGS_HREF,
};

/** The tab strip, in order. Labels and hrefs come from the navigation config (src/lib/site-links.ts). */
export const LEARNER_SECTION_LINKS: readonly LearnerSectionLink[] = Object.freeze(
  (Object.keys(LEARNER_SECTION_HREFS) as LearnerSection[]).map((id) => ({ id, ...siteLink(LEARNER_SECTION_HREFS[id]) })),
);

/**
 * The breadcrumb trail of a learner page below the dashboard: Dashboard › <page>.
 * The dashboard itself is top level and has none.
 */
export function learnerBreadcrumbs(section: Exclude<LearnerSection, "dashboard">): { label: string; href?: string }[] {
  const dashboard = siteLink(LEARNER_SECTION_HREFS.dashboard);
  return [dashboard, { label: siteLink(LEARNER_SECTION_HREFS[section]).label }];
}

const linkBase =
  "inline-flex min-h-[2.75rem] items-center rounded-lg border px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-bench motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export interface LearnerSectionNavProps {
  /** The page this nav is on; its link gets aria-current="page". */
  current: LearnerSection;
  className?: string;
}

/**
 * Links between the learner pages (dashboard, review queue, notebook,
 * self-assessment and settings). Server-safe: no hooks and no browser APIs. Wraps onto several
 * lines on narrow screens.
 */
export function LearnerSectionNav({ current, className }: LearnerSectionNavProps) {
  return (
    <nav aria-label="Your learning" className={cn("min-w-0", className)}>
      <ul className="flex flex-wrap gap-2">
        {LEARNER_SECTION_LINKS.map((link) => {
          const isCurrent = link.id === current;
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  linkBase,
                  isCurrent
                    ? // DESIGN.md section 2 rule 3: the current item is the raised surface with an accent marker, not a fill.
                      "border-border border-b-2 border-b-primary bg-muted"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default LearnerSectionNav;
