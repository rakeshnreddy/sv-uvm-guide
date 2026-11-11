import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import { SignalTag } from "@/components/ui/SignalTag";
import { PRACTICE_KIND_LABELS, type PracticePagerData, type PracticePagerLink } from "@/lib/practice-links";
import { cn } from "@/lib/utils";

/*
 * The end of every practice tool page (SPEC-phases-2-4.md, "Practice pager"):
 * "Back to Practice: <section>", then the previous and next item of the same
 * kind in curriculum order, drawn like the lesson pager (LessonPager.tsx).
 * Presentational: the data comes from getPracticePager() in
 * src/lib/practice-links.ts, which is server-side data: render this in server
 * components only (a client page can take it as a prop or child).
 */

const cardClass =
  "group flex min-h-[5.5rem] min-w-0 flex-col justify-center rounded-xl border border-border bg-card p-5 transition-colors duration-150 ease-bench hover:border-input hover:bg-muted motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const backLinkClass =
  "inline-flex min-h-[2.5rem] items-center gap-1.5 rounded px-1 text-ui font-medium text-primary underline-offset-4 transition-colors duration-150 ease-bench hover:underline motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One column on phones, two from 640 px; the cards may shrink below their content (min-w-0) so long titles wrap. */
export const PAGER_GRID_CLASS = "mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2";

/** "Previous exercise", "Next interactive model": the kind's singular label in sentence case. */
export function pagerEyebrow(direction: "prev" | "next", kind: PracticePagerData["kind"]): string {
  return `${direction === "next" ? "Next" : "Previous"} ${PRACTICE_KIND_LABELS[kind].toLowerCase()}`;
}

function PagerCard({ link, direction, kind }: { link: PracticePagerLink; direction: "prev" | "next"; kind: PracticePagerData["kind"] }) {
  const isNext = direction === "next";
  return (
    <Link
      href={link.href}
      rel={isNext ? "next" : "prev"}
      className={cn(cardClass, isNext ? "sm:col-start-2 sm:text-right" : "sm:col-start-1")}
    >
      <span className={cn("flex items-center gap-2 text-xs font-medium text-subtle", isNext && "sm:justify-end")}>
        {isNext ? null : <ArrowLeft aria-hidden="true" className="h-4 w-4" />}
        {pagerEyebrow(direction, kind)}
        {isNext ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
      </span>{" "}
      <span className="mt-2 break-words text-sm font-semibold text-foreground transition-colors duration-150 ease-bench group-hover:text-primary motion-reduce:transition-none">
        {link.title}
      </span>{" "}
      {link.lesson ? (
        <span className={cn("mt-1 flex min-w-0 items-center gap-2 text-xs text-subtle", isNext && "sm:justify-end")}>
          <SignalTag code={link.lesson.code} />
          <span className="min-w-0 truncate">{link.lesson.title}</span>
        </span>
      ) : null}
    </Link>
  );
}

export interface PracticePagerProps {
  pager: PracticePagerData;
  className?: string;
}

export function PracticePager({ pager, className }: PracticePagerProps) {
  const { section, kind, prev, next } = pager;
  return (
    <nav
      aria-label={`More in ${section.label}`}
      data-testid="practice-pager"
      className={cn("not-prose border-t border-border pt-6 print:hidden", className)}
    >
      <Link href={section.href} className={backLinkClass}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>Back to Practice: {section.label}</span>
      </Link>
      {prev || next ? (
        <div data-testid="practice-pager-cards" className={PAGER_GRID_CLASS}>
          {prev ? <PagerCard link={prev} direction="prev" kind={kind} /> : null}
          {next ? <PagerCard link={next} direction="next" kind={kind} /> : null}
        </div>
      ) : null}
    </nav>
  );
}

export default PracticePager;
