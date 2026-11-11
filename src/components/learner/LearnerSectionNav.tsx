import React from "react";

import { PageHeader, PageTabs } from "@/components/layout/PageHeader";
import { siteLink } from "@/lib/nav-labels";
import { DASHBOARD_HREF, NOTEBOOK_HREF, REVIEW_HREF, SELF_ASSESSMENT_HREF, SETTINGS_HREF } from "@/lib/site-links";

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

/** The tab strip's accessible name. */
/**
 * The least height of a learner page's body (dashboard, self-assessment,
 * review). These pages show a one-line "Reading what this browser has
 * saved" placeholder until hydration and then the empty state or the cards;
 * reserving the empty state's height (about 350 px on phones, 250 px from
 * 640 px) keeps the footer from jumping down when the swap happens.
 */
export const LEARNER_BODY_MIN_HEIGHT_CLASS = "min-h-[22rem] sm:min-h-[16rem]";

export const LEARNER_SECTION_NAV_LABEL = "Your learning";

/**
 * The breadcrumb trail of a learner page below the dashboard: Dashboard › <page>.
 * The dashboard itself is top level and has none.
 */
export function learnerBreadcrumbs(section: Exclude<LearnerSection, "dashboard">): { label: string; href?: string }[] {
  const dashboard = siteLink(LEARNER_SECTION_HREFS.dashboard);
  return [dashboard, { label: siteLink(LEARNER_SECTION_HREFS[section]).label }];
}

export interface LearnerSectionNavProps {
  /** The page this nav is on; its link gets aria-current="page". */
  current: LearnerSection;
  className?: string;
}

/**
 * The tabs between the learner pages (dashboard, review queue, notebook,
 * self-assessment and settings): PageHeader's tab strip, so the current page
 * is marked by primary text and the 2 px accent underline on the header's
 * hairline. It scrolls sideways on phones rather than wrapping. Server-safe:
 * no hooks and no browser APIs.
 */
export function LearnerSectionNav({ current, className }: LearnerSectionNavProps) {
  return (
    <PageTabs
      label={LEARNER_SECTION_NAV_LABEL}
      className={className}
      items={LEARNER_SECTION_LINKS.map((link) => ({ label: link.label, href: link.href, current: link.id === current }))}
    />
  );
}

export interface LearnerPageHeaderProps {
  /** The page the header is on: it picks the breadcrumbs (none on the dashboard) and the current tab. */
  current: LearnerSection;
  /** The h1. It starts with the page's navigation label. */
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Meta items under the lead, for example the storage status note. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The header every learner page shares (Dashboard, Review, Notebook,
 * Self-assessment, Settings): breadcrumbs below the dashboard, the h1, the
 * lead, and the learner tabs on the closing hairline.
 */
export function LearnerPageHeader({ current, title, lead, meta, actions, className }: LearnerPageHeaderProps) {
  return (
    <PageHeader
      data-testid="learner-page-header"
      breadcrumbs={current === "dashboard" ? undefined : learnerBreadcrumbs(current)}
      title={title}
      lead={lead}
      meta={meta}
      actions={actions}
      className={className}
      tabs={<LearnerSectionNav current={current} />}
    />
  );
}

export default LearnerSectionNav;
