import React from "react";

import { cn } from "@/lib/utils";

/*
 * A page section (SPEC-phases-2-4.md, "Primitives"): a heading in the h2 token
 * with an optional one-line description, and 48 px between one section and
 * the next. No card, no background. No hooks, so it renders as a server
 * component.
 */

/**
 * The section box. Only a section that directly follows another section gets
 * the 48 px top margin, so the first one sits on PageHeader's own spacing and
 * nothing doubles. scroll-mt-24 keeps the heading clear of the 64 px sticky
 * header when an anchor lands here.
 */
export const SECTION_CLASS = "scroll-mt-24 [[data-section]+&]:mt-12";

/** The heading: the h2 token (24/32 at 600) in primary text, whatever the heading level. */
export const SECTION_HEADING_CLASS = "text-h2 text-foreground";

/** The one-line description under the heading: 14/20 in the secondary colour. */
export const SECTION_DESCRIPTION_CLASS = "mt-1 max-w-[30em] text-ui text-muted-foreground";

/** The gap between the heading block and the body. */
export const SECTION_BODY_CLASS = "mt-6";

/** Where the anchor id goes: on the section (the default) or on its heading. */
export type SectionAnchor = "section" | "heading";

/** The heading's class when it carries the anchor: the h2 token, clear of the 64 px sticky header. */
export const SECTION_ANCHORED_HEADING_CLASS = cn("scroll-mt-24", SECTION_HEADING_CLASS);

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /**
   * The anchor id. By default it goes on the section and the heading gets
   * `${id}-heading`; with `anchor="heading"` the heading carries the id itself
   * (and the scroll margin), and the section is labelled by it.
   */
  id: string;
  /** Which element carries `id`. Default "section". */
  anchor?: SectionAnchor;
  title: React.ReactNode;
  /** One line under the heading. */
  description?: React.ReactNode;
  /** The heading element. Only the tag changes; the look stays the h2 token. Default 2. */
  level?: 2 | 3 | 4;
  /** A quiet link or button on the heading's right, for example "All labs". */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export function Section({
  id,
  anchor = "section",
  title,
  description,
  level = 2,
  action,
  className,
  children,
  ...rest
}: SectionProps) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  const onHeading = anchor === "heading";
  const headingId = onHeading ? id : `${id}-heading`;
  return (
    <section
      id={onHeading ? undefined : id}
      aria-labelledby={headingId}
      data-section=""
      className={cn(SECTION_CLASS, className)}
      {...rest}
    >
      <div className={cn(action && "flex flex-wrap items-end justify-between gap-x-6 gap-y-2")}>
        <div className="min-w-0">
          <Heading id={headingId} className={onHeading ? SECTION_ANCHORED_HEADING_CLASS : SECTION_HEADING_CLASS}>
            {title}
          </Heading>
          {description ? <p className={SECTION_DESCRIPTION_CLASS}>{description}</p> : null}
        </div>
        {action ? <div className="min-w-0 max-w-full text-ui sm:shrink-0">{action}</div> : null}
      </div>
      {children ? <div className={SECTION_BODY_CLASS}>{children}</div> : null}
    </section>
  );
}

export default Section;
