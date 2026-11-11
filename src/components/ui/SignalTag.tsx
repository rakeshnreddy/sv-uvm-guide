import Link from "next/link";
import React from "react";

import { tierDataAttribute, tierOfModuleCode, type TierNumber } from "@/lib/tier-colors";
import { cn } from "@/lib/utils";

/**
 * The signal tag (DESIGN.md section 8): every module code, milestone id and
 * lesson reference (F1A, I-UVM-1C, M3, B-AXI-1) renders through this one
 * component, like the signal names down the left of a waveform viewer.
 *
 * JetBrains Mono 12/16 at weight 500 (the `label` size), radius 4, a 1 px
 * border, 2 px by 6 px padding. A module code is tinted by its tier (DESIGN.md
 * section 11): tier-coloured text, the tier's 14% fill and its 38% border,
 * through data-tier on the tag itself. The tier comes from the curriculum
 * manifest (src/lib/tier-colors.ts). Milestones, unknown codes and `neutral`
 * tags keep the neutral look: secondary text and the hairline, no background
 * in lists and a raised background when standalone. As a link it shows the
 * accent on hover and keyboard focus only. No hooks, so it renders in server
 * components.
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
  /** Force the neutral look even when the code belongs to a tier. */
  neutral?: boolean;
  /** Set the tier by hand, for a code the manifest does not know. Ignored when `neutral` is set. */
  tier?: TierNumber;
}

const BASE_CLASS =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-label font-medium";

const NEUTRAL_CLASS = "border-border text-muted-foreground";

/** Reads the tag's own data-tier scope (globals.css), so one class list serves every tier. */
const TINTED_CLASS = "border-tier-current-border bg-tier-current-subtle text-tier-current";

const LINK_CLASS =
  "transition-colors duration-150 ease-bench motion-reduce:transition-none hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The tag's classes, for the rare element that cannot be a SignalTag itself.
 * With `tinted`, the element must carry data-tier (signalTagTier gives the value).
 */
export function signalTagClass({
  standalone = false,
  link = false,
  tinted = false,
}: { standalone?: boolean; link?: boolean; tinted?: boolean } = {}): string {
  return cn(BASE_CLASS, tinted ? TINTED_CLASS : NEUTRAL_CLASS, !tinted && standalone && "bg-muted", link && LINK_CLASS);
}

/** The tier a tag shows: the given tier, else the code's tier from the manifest; undefined when neutral. */
export function signalTagTier(code: string, { neutral = false, tier }: { neutral?: boolean; tier?: TierNumber } = {}): TierNumber | undefined {
  if (neutral) return undefined;
  return tier ?? tierOfModuleCode(code);
}

export function SignalTag({ code, href, standalone = false, label, title, className, neutral = false, tier }: SignalTagProps) {
  const tagTier = signalTagTier(code, { neutral, tier });
  const shared = {
    className: cn(signalTagClass({ standalone, link: Boolean(href), tinted: tagTier !== undefined }), className),
    "data-tier": tierDataAttribute(tagTier),
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
