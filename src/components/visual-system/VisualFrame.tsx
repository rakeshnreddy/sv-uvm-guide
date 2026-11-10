import React from "react";

import { cn } from "@/lib/utils";

import { FidelityBadge } from "./FidelityBadge";
import type { Fidelity } from "./visual-language";

interface VisualFrameProps {
  /** Accessible name of the whole visual (also used as the section label). */
  label: string;
  /** Short label above the title in sentence case, e.g. "Experiment", "Mental picture". */
  eyebrow: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  fidelity: Fidelity;
  assumptions?: string[];
  children: React.ReactNode;
  className?: string;
}

/** The label style shared by eyebrows and section labels around every visual. */
export const VISUAL_LABEL_CLASS = "text-label text-subtle";

/**
 * Renders a label in sentence case when it was authored in all lower case or
 * all capitals ("experiment", "MENTAL PICTURE"). Mixed case is kept as written,
 * and a single all-capital word ("AXI") is treated as an acronym and kept.
 */
export function toSentenceCaseLabel(text: string): string {
  const trimmed = text.trim();
  if (!/[a-z]/i.test(trimmed)) return text;
  const isLower = trimmed === trimmed.toLowerCase();
  const isUpper = trimmed === trimmed.toUpperCase();
  if (isUpper && !/\s/.test(trimmed)) return text;
  if (!isLower && !isUpper) return text;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Standard shell for every curriculum visual: header, fidelity declaration,
 * and consistent spacing that stays compact on phones.
 */
export function VisualFrame({ label, eyebrow, title, summary, fidelity, assumptions, children, className }: VisualFrameProps) {
  return (
    <section
      aria-label={label}
      className={cn("not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className={VISUAL_LABEL_CLASS}>{toSentenceCaseLabel(eyebrow)}</p>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {summary ? <div className="mt-1 text-sm text-muted-foreground">{summary}</div> : null}
        </div>
        <FidelityBadge fidelity={fidelity} assumptions={assumptions} />
      </header>
      {children}
    </section>
  );
}
