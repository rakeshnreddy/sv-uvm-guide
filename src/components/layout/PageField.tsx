"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { lessonTierFromPathname, tierDataAttribute, type TierNumber } from "@/lib/tier-colors";

/**
 * The colour field (DESIGN.md section 11): a static, decorative layer behind
 * the top of a page. The look lives in globals.css ([data-page-field]); this
 * renders the one empty element, aria-hidden, with no pointer events, no
 * animation and no effect. It is absolutely positioned at z-index -1, so its
 * parent must be `relative isolate` (MainLayout and the public layout are).
 *
 * - variant "all": the four tier colours, up to 820 px tall (600 on phones).
 * - variant "tier": the given tier's colour leads, a neighbour is faint.
 *   size "header" keeps it to the page header (24rem, faded by its end), for
 *   lesson pages, so it is gone before the article's first paragraph.
 */
export type PageFieldVariant = "all" | "tier";
export type PageFieldSize = "hub" | "header";

export interface PageFieldProps {
  variant?: PageFieldVariant;
  /** Required for variant "tier"; without it the field falls back to "all". */
  tier?: TierNumber;
  size?: PageFieldSize;
}

export function PageField({ variant = "all", tier, size = "hub" }: PageFieldProps) {
  const tiered = variant === "tier" && tier !== undefined;
  return (
    <div
      aria-hidden="true"
      data-page-field={tiered ? "tier" : "all"}
      data-tier={tiered ? tierDataAttribute(tier) : undefined}
      data-field-size={size === "header" ? "header" : undefined}
    />
  );
}

/** The field a route gets: a lesson page gets its tier's field at header size; every other page the full "all" field. */
export function pageFieldForPath(pathname: string | null | undefined): Required<Pick<PageFieldProps, "variant" | "size">> & { tier?: TierNumber } {
  const tier = lessonTierFromPathname(pathname);
  return tier ? { variant: "tier", tier, size: "header" } : { variant: "all", size: "hub" };
}

/**
 * The learning layout's field: reads the route (usePathname, which is known
 * during server rendering, so the server HTML already has the right field and
 * nothing changes on hydration) and takes the tier from the
 * /curriculum/<tier>/… segment.
 */
export function RoutePageField() {
  const pathname = usePathname();
  return <PageField {...pageFieldForPath(pathname)} />;
}

export default PageField;
