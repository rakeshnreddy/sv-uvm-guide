import Link from "next/link";
import React from "react";

import { cn } from "@/lib/utils";

export type LearnerSection = "dashboard" | "review" | "notebook" | "settings";

export interface LearnerSectionLink {
  id: LearnerSection;
  label: string;
  href: string;
}

export const LEARNER_SECTION_LINKS: readonly LearnerSectionLink[] = Object.freeze([
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "review", label: "Review", href: "/dashboard/review" },
  { id: "notebook", label: "Notebook", href: "/dashboard/notebook" },
  { id: "settings", label: "Settings", href: "/settings" },
]);

const linkBase =
  "inline-flex min-h-[2.75rem] items-center rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export interface LearnerSectionNavProps {
  /** The page this nav is on; its link gets aria-current="page". */
  current: LearnerSection;
  className?: string;
}

/**
 * Links between the learner pages (dashboard, review queue, notebook and
 * settings). Server-safe: no hooks and no browser APIs. Wraps onto several
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
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
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
