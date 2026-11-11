import Link from "next/link";
import React from "react";

import { cn } from "@/lib/utils";

/**
 * The signal tag (DESIGN.md section 8): every module code, milestone id and
 * lesson reference (F1A, I-UVM-1C, M3, B-AXI-1) renders through this one
 * component, like the signal names down the left of a waveform viewer.
 *
 * JetBrains Mono 12/16 at weight 500 (the `label` size), secondary text, radius
 * 4, a 1 px hairline, 2 px by 6 px padding. No background in lists; a raised
 * background when it stands alone. As a link it shows the accent on hover and
 * keyboard focus only. No hooks, so it renders in server components.
 */
export interface SignalTagProps {
  /** Rendered exactly as given: no case change, no trimming. */
  code: string;
  /** Makes the tag a link. Leave it out inside another link. */
  href?: string;
  /** A tag on its own (not in a list or a row of text) gets the raised background. */
  standalone?: boolean;
  /** Accessible name when the code alone does not say enough, for example "Module I-UVM-1C". */
  label?: string;
  title?: string;
  className?: string;
}

const BASE_CLASS =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded border border-border px-1.5 py-0.5 font-mono text-label font-medium text-muted-foreground";

const LINK_CLASS =
  "transition-colors duration-150 ease-bench motion-reduce:transition-none hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The tag's classes, for the rare element that cannot be a SignalTag itself. */
export function signalTagClass({ standalone = false, link = false }: { standalone?: boolean; link?: boolean } = {}): string {
  return cn(BASE_CLASS, standalone && "bg-muted", link && LINK_CLASS);
}

export function SignalTag({ code, href, standalone = false, label, title, className }: SignalTagProps) {
  const shared = {
    className: cn(signalTagClass({ standalone, link: Boolean(href) }), className),
    "aria-label": label,
    title,
    translate: "no" as const,
    "data-signal-tag": "",
  };
  if (href) {
    return (
      <Link href={href} {...shared}>
        {code}
      </Link>
    );
  }
  return <span {...shared}>{code}</span>;
}

export default SignalTag;
