"use client";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface JumpMenuLesson {
  href: string;
  title: string;
  current: boolean;
}

export interface ModuleJumpMenuProps {
  /** Module label, for example "I-UVM-3B: Advanced Sequencing and Layering". */
  moduleLabel: string;
  lessons: readonly JumpMenuLesson[];
  className?: string;
}

/**
 * "Jump to": a disclosure listing the module's lessons in manifest order
 * (G30-PAGE-09, G30-PAGE-14). A plain list of links, not an ARIA menu; the
 * current lesson carries aria-current="page" and a visible "Current" tag.
 * Escape or a click outside closes it; Escape returns focus to the button.
 */
export default function ModuleJumpMenu({ moduleLabel, lessons, className }: ModuleJumpMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;
  const labelId = `${id}-label`;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (lessons.length === 0) return null;

  return (
    <div ref={containerRef} className={cn("relative shrink-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[2.5rem] items-center gap-1 rounded-lg border border-border/60 px-3 text-xs font-semibold text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Jump to
        <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <p id={labelId} className="px-2 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
            Lessons in {moduleLabel}
          </p>
          <ol aria-labelledby={labelId} className="max-h-72 list-decimal space-y-0.5 overflow-y-auto pl-7 pr-1 text-sm marker:text-muted-foreground">
            {lessons.map((lesson) => (
              <li key={lesson.href}>
                <Link
                  href={lesson.href}
                  aria-current={lesson.current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-[2.5rem] items-center justify-between gap-2 rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    lesson.current ? "bg-muted font-semibold text-foreground" : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0">{lesson.title}</span>
                  {lesson.current ? (
                    <span aria-hidden="true" className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Current
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
