import React from "react";

import { InfoPage } from "@/components/templates/InfoPage";
import { practiceBreadcrumbs, requirePracticePage, requirePracticePager } from "@/lib/practice-links";

import { PracticePager } from "./PracticePager";

type InfoPageProps = React.ComponentProps<typeof InfoPage>;

export interface PracticeInfoPageProps extends Omit<InfoPageProps, "breadcrumbs" | "pager" | "gutter"> {
  /** The page's route, as listed in PRACTICE_PAGES (src/lib/practice-links.ts). */
  href: string;
}

/**
 * The InfoPage template for an exercise, interactive model, diagram, chart or
 * tool page: the trail Practice › <section> › <item> above the title, and the
 * practice pager at the end, both derived from the route. Inside the app
 * shell, so it adds no gutter of its own. A server component.
 */
export function PracticeInfoPage({ href, ...props }: PracticeInfoPageProps) {
  const item = requirePracticePage(href);
  return (
    <InfoPage
      {...props}
      gutter={false}
      breadcrumbs={practiceBreadcrumbs(item)}
      pager={<PracticePager pager={requirePracticePager(href)} />}
    />
  );
}

export default PracticeInfoPage;
