import React from "react";

import { cn } from "@/lib/utils";

/*
 * Prose: lesson and article text (SPEC-phases-2-4.md, "Primitives"). It is a
 * class recipe on the existing typography plugin setup (tailwind.config.ts sets
 * the sizes, weights and colour roles; globals.css the phone sizes), and a thin
 * wrapper component that applies it.
 *
 * The column itself is not capped (max-w-none). Its direct text children,
 * paragraphs, lists, quotes, definition lists and headings, are capped at the
 * measure, 68 characters (PROSE_MEASURE_CLASS). Everything else, figures,
 * tables, code blocks, interactives and any wrapper div, uses the full column. A text child can opt
 * out with the not-prose class or a data-full-width attribute.
 */

/**
 * The measure for running text (DESIGN.md section 4: about 65 characters a
 * line on average, never more than 75). It is set in em, not ch: ch is the
 * width of the digit 0, and IBM Plex Sans sets ordinary English at about
 * 0.45em a character, so 68ch measured 90 characters a line in the browser
 * (17 px body). 30em measured 64 to 68 on most pages. The lesson article sets
 * its own cap, 31em, in globals.css ([data-lesson-article]).
 */
export const PROSE_MEASURE_CLASS = "max-w-[30em]";

/** Caps the direct text children at the measure; not-prose and data-full-width children are exempt. */
export const PROSE_MEASURE_CHILDREN_CLASS = [
  "[&>p]:max-w-[30em]",
  "[&>ul]:max-w-[30em]",
  "[&>ol]:max-w-[30em]",
  "[&>dl]:max-w-[30em]",
  "[&>blockquote]:max-w-[30em]",
  "[&>h1]:max-w-[30em]",
  "[&>h2]:max-w-[30em]",
  "[&>h3]:max-w-[30em]",
  "[&>h4]:max-w-[30em]",
  "[&>h5]:max-w-[30em]",
  "[&>h6]:max-w-[30em]",
  // An attribute or class selector outranks the element selectors above.
  "[&>.not-prose]:max-w-none",
  "[&>[data-full-width]]:max-w-none",
].join(" ");

/**
 * The full recipe: the plugin's prose styles (17/29 body, 16/27 on phones; the
 * h1 to h4 tokens; colour roles in both modes), the column uncapped, the text
 * children at the measure, and no backticks around inline code. Put it on the
 * element that directly holds the MDX or article content.
 */
export const PROSE_CLASS = cn(
  "prose max-w-none min-w-0 prose-code:before:content-none prose-code:after:content-none",
  PROSE_MEASURE_CHILDREN_CLASS,
);

type ProseElement = "div" | "article" | "section";

export interface ProseProps extends React.HTMLAttributes<HTMLElement> {
  /** The element; `article` when the prose is the page's whole document. */
  as?: ProseElement;
  children?: React.ReactNode;
}

/** A wrapper that applies PROSE_CLASS. No hooks, so it renders as a server component. */
export function Prose({ as = "div", className, children, ...rest }: ProseProps) {
  const Element = as;
  return (
    <Element data-prose="" className={cn(PROSE_CLASS, className)} {...rest}>
      {children}
    </Element>
  );
}

export default Prose;
