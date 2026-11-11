import React, { ReactNode } from "react";

import type { BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell, type PageWidth } from "@/components/layout/PageShell";
import { Section } from "@/components/layout/Section";
import { PROSE_CLASS } from "@/components/ui/Prose";

/*
 * The template for reference, guide, legal and practice tool pages, built on
 * the shared page primitives: PageShell (one width, aligned to the page
 * frame's left edge), PageHeader (breadcrumbs, the one h1, the lead, a meta
 * row, a hairline below) and Prose for the body. It is unboxed: no card wraps
 * the header or the content.
 *
 * Running text (direct paragraphs, lists, quotes and headings of the body) is
 * held to the measure by Prose. Anything else, and every chart and diagram
 * slot, uses the full column.
 */

/** The body's prose recipe: the shared Prose classes (running text at the 68-character measure). */
export const infoPageProseClass = PROSE_CLASS;

/** The id of the charts and diagrams sections, for their headings and anchors. */
export const INFO_PAGE_CHARTS_ID = "charts";
export const INFO_PAGE_DIAGRAMS_ID = "diagrams";

/** A section anchor from its heading: "Cookies and third parties" -> "cookies-and-third-parties". */
export function infoSectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface InfoPageProps {
  /**
   * The trail above the title, for every page below the top level. The last
   * item is the current page. Build it from src/lib/site-links.ts labels.
   */
  breadcrumbs?: readonly BreadcrumbItem[];
  /** The one h1. It starts with the page's navigation label (src/lib/site-links.ts). */
  title?: string;
  /** The lead under the title: one short paragraph. */
  description?: ReactNode;
  /** A short sentence-case label or signal tags above the title. */
  eyebrow?: ReactNode;
  /** Meta items under the lead ("Last updated: October 2026", counts). */
  meta?: ReactNode;
  /** Links or buttons on the header's right. */
  actions?: ReactNode;
  /** reading (768 px) for long text, content (1152 px, the default) for pages with figures or tools, wide (1280 px) for dense tools. */
  width?: PageWidth;
  /**
   * Wrap the children in the prose styles (the default). Pass false when the
   * body is made of Section blocks that carry their own Prose, so section
   * headings sit outside the prose styles. The blocks are stacked 48 px apart.
   */
  prose?: boolean;
  children?: ReactNode;
  /** Charts, rendered after the body at full width under "Charts and visualizations". */
  charts?: ReactNode[];
  /** Diagrams and interactives, rendered after the body at full width under "Diagrams and illustrations". */
  diagrams?: ReactNode[];
  /** The end of the page, after every other slot: the practice pager on practice tool pages. */
  pager?: ReactNode;
}

function SlotSection({ id, title, items }: { id: string; title: string; items: ReactNode[] }) {
  return (
    <Section id={id} title={title} className="not-prose">
      <div className="space-y-8">
        {items.map((item, index) => (
          <div key={`${id}-${index}`} className="min-w-0">
            {item}
          </div>
        ))}
      </div>
    </Section>
  );
}

export const InfoPage: React.FC<InfoPageProps> = ({
  breadcrumbs,
  title,
  description,
  eyebrow,
  meta,
  actions,
  width = "content",
  prose = true,
  children,
  charts,
  diagrams,
  pager,
}) => {
  const hasCharts = Boolean(charts && charts.length > 0);
  const hasDiagrams = Boolean(diagrams && diagrams.length > 0);
  return (
    <PageShell data-testid="info-page" width={width}>
      <article>
        {title ? (
          <PageHeader
            breadcrumbs={breadcrumbs}
            eyebrow={eyebrow}
            title={title}
            lead={description}
            meta={meta}
            actions={actions}
          />
        ) : null}

        {/* One stack, 48 px between the body and each slot. */}
        <div data-info-page-body="" className="space-y-12">
          {children ? (
            prose ? (
              <div data-prose="" className={infoPageProseClass}>
                {children}
              </div>
            ) : (
              <div className="min-w-0 space-y-12">{children}</div>
            )
          ) : null}
          {hasCharts ? <SlotSection id={INFO_PAGE_CHARTS_ID} title="Charts and visualizations" items={charts!} /> : null}
          {hasDiagrams ? <SlotSection id={INFO_PAGE_DIAGRAMS_ID} title="Diagrams and illustrations" items={diagrams!} /> : null}
        </div>
      </article>
      {pager ? <div className="mt-12">{pager}</div> : null}
    </PageShell>
  );
};

export default InfoPage;
