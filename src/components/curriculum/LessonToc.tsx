"use client";

import { ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { cn } from "@/lib/utils";

export interface LessonTocProps {
  entries: readonly TocEntry[];
  className?: string;
}

interface TocGroup {
  entry: TocEntry;
  children: TocEntry[];
}

/** H3 entries nest under the H2 before them; an H3 before any H2 stands alone. */
function groupEntries(entries: readonly TocEntry[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (entry.depth === 3 && last && last.entry.depth === 2) last.children.push(entry);
    else groups.push({ entry, children: [] });
  }
  return groups;
}

const EXPERT_PREFIX = /^expert:\s*/i;

function TocLink({
  entry,
  active,
  onNavigate,
}: {
  entry: TocEntry;
  active: boolean;
  onNavigate: () => void;
}) {
  const hasPrefix = EXPERT_PREFIX.test(entry.text);
  const label = hasPrefix ? entry.text.replace(EXPERT_PREFIX, "") : entry.text;
  return (
    <a
      href={`#${entry.id}`}
      onClick={onNavigate}
      aria-current={active ? "location" : undefined}
      // One name in every browser: "Expert: <topic>", matching the heading text.
      aria-label={entry.expert ? `Expert: ${label}` : undefined}
      className={cn(
        "flex min-h-[2.5rem] items-start gap-2 rounded-lg px-2 py-2 text-sm leading-snug transition-colors motion-reduce:transition-none xl:min-h-0 xl:py-1.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {active ? (
        <span aria-hidden="true" className="mt-0.5 font-bold text-primary">
          ›
        </span>
      ) : null}
      {entry.expert ? (
        <span className="mt-px shrink-0 rounded border border-border px-1.5 py-px text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
          Expert
        </span>
      ) : null}{" "}
      <span className="min-w-0 break-words">{label}</span>
    </a>
  );
}

/**
 * "On this page": the lesson's H2 and H3 headings as anchor links (G30-PAGE-02),
 * with the expert layer badged as text, not colour. Always expanded in the
 * sidebar at xl and wider; a collapsed disclosure above the lesson below xl,
 * where the course outline takes the side column (Escape closes it and returns
 * focus to its button). The entry for the section being read carries
 * aria-current="location"; the shell's "t" shortcut relies on that and on the
 * nav's name.
 */
export default function LessonToc({ entries, className }: LessonTocProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const groups = useMemo(() => groupEntries(entries), [entries]);
  const expertCount = useMemo(() => entries.filter((entry) => entry.expert).length, [entries]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return undefined;
    const targets = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return undefined;

    const visible = new Set<string>();
    const observer = new window.IntersectionObserver(
      (observations) => {
        for (const observation of observations) {
          if (observation.isIntersecting) visible.add(observation.target.id);
          else visible.delete(observation.target.id);
        }
        const first = entries.find((entry) => visible.has(entry.id));
        if (first) setActiveId(first.id);
      },
      // The band just below the sticky navbar: the heading being read.
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [entries]);

  const close = useCallback(() => setOpen(false), []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className={cn("min-w-0", className)} onKeyDown={onKeyDown}>
      <p aria-hidden="true" className="hidden px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:block">
        On this page
      </p>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2 text-left text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
      >
        <span>
          On this page{" "}
          <span className="ml-1 font-normal text-muted-foreground">
            {entries.length} {entries.length === 1 ? "section" : "sections"}
            {expertCount > 0 ? `, ${expertCount} expert` : ""}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      <ol
        id={listId}
        className={cn(
          "mt-2 space-y-0.5 rounded-2xl border border-border/60 bg-card/80 p-2 xl:block xl:border-0 xl:bg-transparent xl:p-0",
          open ? "block" : "hidden",
        )}
      >
        {groups.map(({ entry, children }) => (
          <li key={entry.id}>
            <TocLink entry={entry} active={activeId === entry.id} onNavigate={close} />
            {children.length > 0 ? (
              <ol className="ml-3 space-y-0.5 border-l border-border/60 pl-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <TocLink entry={child} active={activeId === child.id} onNavigate={close} />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
