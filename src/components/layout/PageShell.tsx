import React from "react";

import { cn } from "@/lib/utils";

/**
 * The three page widths (DESIGN.md section 5). A page uses one.
 * - reading: 768 px, for an article or a form
 * - content: 1152 px, for indexes, hubs and dashboards
 * - wide: 1280 px, the whole page frame
 */
export type PageWidth = "reading" | "content" | "wide";

/** The cap on the content, aligned to the frame's left edge (never centred inside the frame). */
export const PAGE_WIDTH_CLASS: Record<PageWidth, string> = {
  reading: "max-w-3xl",
  content: "max-w-6xl",
  wide: "max-w-7xl",
};

/**
 * The frame PageShell draws only when no page frame is around it (the public
 * layout: landing, privacy, terms). It is the public header's container
 * (PUBLIC_CONTAINER: 1152 px with the 16, 24 and 32 px gutters), so the page
 * starts under the wordmark at every width. A wide page there is therefore
 * held to that container too; the public header would have to widen first.
 */
export const STANDALONE_FRAME_CLASS = "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8";

/**
 * Inside MainLayout's [data-page-frame] the frame already gives the centring,
 * the gutters and the 32 px above and below, so these undo the standalone
 * frame: no second centred container, no doubled gutter.
 */
export const IN_FRAME_RESET_CLASS =
  "[[data-page-frame]_&]:mx-0 [[data-page-frame]_&]:max-w-none [[data-page-frame]_&]:px-0 [[data-page-frame]_&]:py-0";

/** The outer box's classes: the standalone frame, undone inside a page frame. */
export const PAGE_SHELL_CLASS = cn(STANDALONE_FRAME_CLASS, IN_FRAME_RESET_CLASS);

type ShellElement = "div" | "article" | "section";

export interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  width?: PageWidth;
  /** The element for the shell; `article` for a single document such as a lesson or a policy. */
  as?: ShellElement;
  /** Classes for the inner, width-capped box (the outer box is the frame). */
  innerClassName?: string;
  children?: React.ReactNode;
}

/**
 * One page's outer box. Safe in both layouts:
 * - in the learning layout (MainLayout) it adds no container of its own; the
 *   content keeps the frame's left edge, the header wordmark's edge, and is
 *   capped at the chosen width;
 * - in the public layout it draws the frame itself.
 * No hooks, so it renders as a server component.
 */
export function PageShell({ width = "content", as = "div", className, innerClassName, children, ...rest }: PageShellProps) {
  const Outer = as;
  return (
    <Outer data-page-shell="" data-width={width} className={cn(PAGE_SHELL_CLASS, className)} {...rest}>
      <div data-page-shell-inner="" className={cn("w-full min-w-0", PAGE_WIDTH_CLASS[width], innerClassName)}>
        {children}
      </div>
    </Outer>
  );
}

export default PageShell;
