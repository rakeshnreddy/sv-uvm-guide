import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import { SignalTag } from "@/components/ui/SignalTag";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Ancestors with an href are links. The last item is the current page; it is a link only when given an href. */
  href?: string;
  /** A module code, milestone id or lesson reference, shown as a SignalTag before the label. */
  code?: string;
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

/**
 * A crumb's list item. The current crumb grows from its own width into the
 * room that is free (flex 1 1 auto): it stays on the row when it fits, moves to
 * its own line when it does not, and truncates only when even a full line is
 * too short. Ancestors keep their own width and have no cap, so they too
 * truncate only when a line cannot hold them.
 */
export function crumbItemClass(current: boolean): string {
  return cn("flex min-w-0 items-center gap-1", current && "flex-auto");
}

/** A crumb's link or text: a 40 px target, secondary text with the accent on hover; the current crumb in primary text at 500. */
export function crumbLinkClass(current: boolean): string {
  return cn(
    "inline-flex min-h-[2.5rem] min-w-0 max-w-full items-center gap-1.5 rounded px-1",
    current
      ? "font-medium text-foreground"
      : "text-muted-foreground transition-colors duration-150 ease-bench hover:text-primary motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
}

/**
 * The phone back link: a 40 px minimum target whose label wraps onto a second
 * line rather than cutting a long module name off.
 */
export const BACK_LINK_CLASS =
  "inline-flex min-h-[2.5rem] max-w-full items-center gap-1 rounded px-1 py-2 text-muted-foreground transition-colors duration-150 ease-bench hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:hidden";

/** The back link's label: wraps (breaking an overlong word if it must), never truncates. */
export const BACK_LABEL_CLASS = "min-w-0 break-words";

/** The nearest ancestor of the current (last) item that has an href: the target of the phone back link. */
export function breadcrumbParent(items: readonly BreadcrumbItem[]): (BreadcrumbItem & { href: string }) | undefined {
  for (let index = items.length - 2; index >= 0; index -= 1) {
    const item = items[index];
    if (item.href) return item as BreadcrumbItem & { href: string };
  }
  return undefined;
}

function CrumbContent({ item }: { item: BreadcrumbItem }) {
  return (
    <>
      {item.code ? <SignalTag code={item.code} /> : null}
      {/* A coded crumb reads "I-SV-5: Synchronization and IPC", like CodedLabel. */}
      {item.code ? <span className="sr-only">: </span> : null}
      <span className="min-w-0 truncate" title={item.label}>
        {item.label}
      </span>
    </>
  );
}

/**
 * The breadcrumb trail for every page below the top level (SPEC-phases-2-4.md,
 * "Breadcrumbs"): a plain text row with chevrons in nav[aria-label="Breadcrumb"],
 * no card. From 640 px it shows the whole trail; below that, one back link to
 * the nearest ancestor with an href, switched by CSS alone so it renders as a
 * server component. The back link comes after the list in the DOM, so tests
 * and tools that take the first matching link get the visible trail on desktop.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  const parent = breadcrumbParent(items);
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 text-ui print:hidden", className)}>
      <ol className={cn("flex-wrap items-center gap-x-1 gap-y-0", parent ? "hidden sm:flex" : "flex")}>
        {items.map((item, index) => {
          const current = index === lastIndex;
          return (
            <li key={`${index}:${item.href ?? item.label}`} className={crumbItemClass(current)}>
              {index > 0 ? <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle" /> : null}
              {item.href ? (
                <Link href={item.href} aria-current={current ? "page" : undefined} className={crumbLinkClass(current)}>
                  <CrumbContent item={item} />
                </Link>
              ) : (
                <span aria-current={current ? "page" : undefined} className={crumbLinkClass(current)}>
                  <CrumbContent item={item} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {parent ? (
        <Link
          href={parent.href}
          data-breadcrumb-back=""
          className={BACK_LINK_CLASS}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span data-breadcrumb-back-label="" className={BACK_LABEL_CLASS}>
            {parent.label}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
