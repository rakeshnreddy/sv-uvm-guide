"use client";

import React, { useId, useState, type ReactNode } from "react";

interface RevealAnswerProps {
  /** Server-rendered model answer, rubric and sources. Present in the page but hidden until revealed. */
  children: ReactNode;
}

/**
 * Attempt-first reveal: the answer stays hidden until the learner asks for it,
 * and can be hidden again to retry. A real button with aria-expanded, not a
 * <details> element.
 */
export default function RevealAnswer({ children }: RevealAnswerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        {open ? "Hide model answer" : "Reveal model answer"}
      </button>
      <div id={panelId} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}
