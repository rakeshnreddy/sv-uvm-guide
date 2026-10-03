import React from "react";

import { cn } from "@/lib/utils";

import { FidelityBadge } from "./FidelityBadge";
import type { Fidelity } from "./visual-language";

interface VisualFrameProps {
  /** Accessible name of the whole visual (also used as the section label). */
  label: string;
  /** Small uppercase line above the title, e.g. "Experiment", "Mental picture". */
  eyebrow: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  fidelity: Fidelity;
  assumptions?: string[];
  children: React.ReactNode;
  className?: string;
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {summary ? <div className="mt-1 text-sm text-muted-foreground">{summary}</div> : null}
        </div>
        <FidelityBadge fidelity={fidelity} assumptions={assumptions} />
      </header>
      {children}
    </section>
  );
}
