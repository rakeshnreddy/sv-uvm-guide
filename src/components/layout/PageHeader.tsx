import Link from "next/link";
import React from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { cn } from "@/lib/utils";

/*
 * The page header (SPEC-phases-2-4.md, "Primitives"): breadcrumbs, an eyebrow,
 * the one h1, a lead, a meta row, actions on the right and an optional tab
 * strip, closed by a hairline. No card and no background. No hooks, so it
 * renders as a server component.
 */

/** The eyebrow row: signal tags or a short label, 12/16 at 500 in the secondary colour, sentence case. */
export const PAGE_HEADER_EYEBROW_CLASS = "mb-3 flex flex-wrap items-center gap-2 text-label text-muted-foreground";

/** The title: the h1 token (32/40, 28/36 on phones) in primary text; a long unbroken word wraps rather than overflowing. */
export const PAGE_HEADER_TITLE_CLASS = "break-words text-h1 text-foreground";

/**
 * The lead: 18/28 in the secondary colour, at most 65 characters a line. The
 * cap is in em for the reason given at PROSE_MEASURE_CLASS (about 0.43 to 0.45em a
 * character in IBM Plex Sans; 65ch allowed about 86 in the browser).
 */
export const PAGE_HEADER_LEAD_CLASS = "mt-3 max-w-[27.5em] text-lead text-muted-foreground";

/** The meta row: 14/20 meta text with tabular figures, wrapping onto a second line on phones. */
export const PAGE_HEADER_META_CLASS = "mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-ui tabular-nums text-subtle";

/**
 * A quiet text-link action in the header: 40 px tall, primary text with a 2 px accent underline. The
 * header sits on the colour field's peak, where the light accent as text falls below 4.5:1 (DESIGN.md
 * section 11), so the accent marks the link only as its underline (3:1 there, a unit test checks it).
 */
export const PAGE_HEADER_ACTION_LINK_CLASS =
  "inline-flex min-h-10 items-center rounded-sm text-ui font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 transition-colors duration-150 ease-bench hover:decoration-foreground motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The actions: under the text on phones, top right from 640 px. */
export const PAGE_HEADER_ACTIONS_CLASS = "flex shrink-0 flex-wrap items-center gap-2 sm:justify-end";

/** The header box: the hairline that closes it, and the space before the page body. */
export function pageHeaderClass({ tabs = false }: { tabs?: boolean } = {}): string {
  // With a tab strip the strip sits on the hairline, so there is no padding under it.
  return cn("mb-8 border-b border-border", tabs ? "pb-0" : "pb-6");
}

export interface PageHeaderProps {
  title: React.ReactNode;
  /** The trail above the title, for every page below the top level. The last item is the current page. */
  breadcrumbs?: readonly BreadcrumbItem[];
  /** Signal tags (module, tier) or a short sentence-case label above the title. */
  eyebrow?: React.ReactNode;
  /** One short paragraph introducing the page. */
  lead?: React.ReactNode;
  /** Meta items (reading time, "Lesson 3 of 12", counts); each child is spaced as one item. */
  meta?: React.ReactNode;
  /** Buttons or links on the right. At most one filled accent button per view. */
  actions?: React.ReactNode;
  /** A tab strip under the text, sitting on the closing hairline: PageTabs, or your own using pageTabClass. */
  tabs?: React.ReactNode;
  /** Anything else that belongs to the header, after the meta row in the text column (a lesson's "Before you start"). */
  children?: React.ReactNode;
  /** The h1's id, for aria-labelledby on the page's landmark. */
  titleId?: string;
  className?: string;
  /** data-testid for the header element. */
  "data-testid"?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  eyebrow,
  lead,
  meta,
  actions,
  tabs,
  children,
  titleId,
  className,
  "data-testid": testId,
}: PageHeaderProps) {
  return (
    <header data-page-header="" data-testid={testId} className={cn(pageHeaderClass({ tabs: Boolean(tabs) }), className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} className="-ml-1 mb-4" /> : null}
      <div className={cn("flex flex-col gap-4", actions && "sm:flex-row sm:items-start sm:justify-between sm:gap-8")}>
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div data-page-header-eyebrow="" className={PAGE_HEADER_EYEBROW_CLASS}>
              {eyebrow}
            </div>
          ) : null}
          <h1 id={titleId} className={PAGE_HEADER_TITLE_CLASS}>
            {title}
          </h1>
          {lead ? (
            <p data-page-header-lead="" className={PAGE_HEADER_LEAD_CLASS}>
              {lead}
            </p>
          ) : null}
          {meta ? (
            <div data-page-header-meta="" className={PAGE_HEADER_META_CLASS}>
              {meta}
            </div>
          ) : null}
          {children}
        </div>
        {actions ? (
          <div data-page-header-actions="" className={PAGE_HEADER_ACTIONS_CLASS}>
            {actions}
          </div>
        ) : null}
      </div>
      {tabs ? <div className="mt-6">{tabs}</div> : null}
    </header>
  );
}

/**
 * A tab: a 40 px row item on the header's hairline, no side padding (give the
 * row a 24 px gap). The current tab is marked
 * like the navbar's current item: primary text and a 2 px accent underline that
 * sits on the hairline. Use it on a Link (navigation) or on a button with
 * role="tab" (in-page tabs).
 */
export function pageTabClass(current: boolean): string {
  return cn(
    "inline-flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 text-ui font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

export interface PageTabItem {
  label: string;
  href: string;
  current?: boolean;
}

export interface PageTabsProps {
  items: readonly PageTabItem[];
  /** The nav's accessible name, for example "Practice sections". */
  label: string;
  className?: string;
}

/**
 * Link tabs for PageHeader's tab strip: a nav that scrolls sideways on phones
 * rather than wrapping. Tabs have no side padding and sit 24 px apart, so the
 * first label and its underline start at the title's edge.
 */
export function PageTabs({ items, label, className }: PageTabsProps) {
  return (
    <nav aria-label={label} className={cn("overflow-x-auto", className)}>
      <ul className="flex min-w-max gap-6">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.current ? "page" : undefined} className={pageTabClass(Boolean(item.current))}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default PageHeader;
