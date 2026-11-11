"use client";

import { Check, Copy } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { announce } from "./live-announcer";

/** Listings longer than this open in a 28 rem window with a "Show all N lines" control. */
export const CODE_BLOCK_COLLAPSE_LINES = 40;

/** How long the copy button says "Copied" before it goes back to "Copy". */
export const COPY_RESET_MS = 2000;

/** What the shared live region reads out after a copy. */
export const COPY_DONE_ANNOUNCEMENT = "Code copied to clipboard";
export const COPY_FAILED_ANNOUNCEMENT = "Copy failed, select the code instead";

/**
 * Class recipes for the chrome on the code surface. Code panels stay dark in
 * both modes (DESIGN.md section 3), so everything here uses the code-surface
 * roles, never slate classes or arbitrary hsl() values.
 */
export const CODE_BLOCK_FRAME_CLASS =
  "not-prose my-6 overflow-hidden rounded-xl border border-code-border bg-code-surface text-code-foreground";
export const CODE_BLOCK_BAR_CLASS = "flex h-10 items-center justify-between gap-3 border-b border-code-border pl-4 pr-1";
export const CODE_BLOCK_LABEL_CLASS = "min-w-0 truncate font-mono text-label text-code-muted";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-code-surface";
/** 32 px to the eye; the before: box makes the target 40 px tall. */
export const CODE_BLOCK_COPY_CLASS = cn(
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-label text-code-muted transition-colors duration-150 ease-bench",
  "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  "hover:bg-code-border hover:text-code-foreground",
  focusRing,
);
export const CODE_BLOCK_BODY_CLASS = cn(
  "overflow-auto overscroll-x-contain",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
);
/** The collapsed window: 28 rem, scrolling inside. */
export const CODE_BLOCK_COLLAPSED_CLASS = "max-h-[28rem]";
export const CODE_BLOCK_TOGGLE_CLASS = cn(
  "flex h-10 w-full items-center justify-center border-t border-code-border text-ui font-medium text-code-muted transition-colors duration-150 ease-bench",
  "hover:bg-code-border hover:text-code-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
);

export const showAllLinesLabel = (lineCount: number) => `Show all ${lineCount} lines`;
export const SHOW_FEWER_LINES_LABEL = "Show fewer lines";

type CopyState = "idle" | "copied" | "failed";

/** The text of a rendered listing, without line numbers (they are CSS counters, not text). */
function listingText(body: HTMLElement | null): string {
  const pre = body?.querySelector("pre");
  if (!pre) return "";
  // innerText keeps line breaks between block-level lines; jsdom has no innerText.
  return (typeof pre.innerText === "string" && pre.innerText) || pre.textContent || "";
}

function CopyButton({ getText }: { getText: () => string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(getText());
      setState("copied");
      announce(COPY_DONE_ANNOUNCEMENT);
    } catch {
      setState("failed");
      announce(COPY_FAILED_ANNOUNCEMENT);
    }
    timer.current = setTimeout(() => setState("idle"), COPY_RESET_MS);
  };

  // The accessible name is the visible word plus hidden context, so it always
  // contains what sighted users read: "Copy code to clipboard", then "Copied to clipboard".
  // The outcome is also read out once through the page's shared live region,
  // so the course does not carry one empty live region per code block.
  return (
    <button type="button" onClick={copy} className={CODE_BLOCK_COPY_CLASS} data-copy-state={state}>
      {state === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span>{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
      <span className="sr-only">{state === "idle" ? " code to clipboard" : state === "copied" ? " to clipboard" : ", select the code instead"}</span>
    </button>
  );
}

export interface CodeBlockFrameProps {
  /** The language label ("SystemVerilog"). */
  label: string;
  /** A file name shown before the label. */
  fileName?: string;
  /** Lines in the listing; above `collapseAfter` the block opens collapsed. */
  lineCount: number;
  collapseAfter?: number;
  /** The fence name, for `data-language`. */
  language?: string;
  className?: string;
  /** The rendered `pre`. */
  children: React.ReactNode;
}

/**
 * The interactive chrome around a highlighted listing: the label bar, the copy
 * button and, for long listings, the 28 rem window and its toggle. The listing
 * itself is rendered by the (server-safe) CodeBlock and passed in as children.
 *
 * The listing box is a focusable, labelled region while it scrolls, so keyboard
 * users can scroll it with the arrow keys; server markup assumes it scrolls, so
 * it is reachable before (or without) JavaScript.
 */
export function CodeBlockFrame({
  label,
  fileName,
  lineCount,
  collapseAfter = CODE_BLOCK_COLLAPSE_LINES,
  language,
  className,
  children,
}: CodeBlockFrameProps) {
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const collapsible = lineCount > collapseAfter;
  const [expanded, setExpanded] = useState(false);
  const [scrolls, setScrolls] = useState(true);
  const collapsed = collapsible && !expanded;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () =>
      setScrolls(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [collapsed]);

  const toggle = () => {
    const collapsing = expanded;
    setExpanded(!expanded);
    if (collapsing) {
      // The block shrinks by up to its full length: keep the control in view.
      requestAnimationFrame(() => toggleRef.current?.scrollIntoView?.({ block: "nearest" }));
    }
  };

  const getText = useCallback(() => listingText(bodyRef.current), []);
  // Over 40 lines always overflows the 28 rem window, so a collapsed block is always a Tab stop.
  const focusable = scrolls || collapsed;
  const regionLabel = `${fileName ?? label} code`;

  return (
    <div
      data-testid="code-block"
      data-code-block=""
      data-language={language || undefined}
      data-collapsed={collapsible ? String(collapsed) : undefined}
      className={cn(CODE_BLOCK_FRAME_CLASS, className)}
    >
      <div className={CODE_BLOCK_BAR_CLASS}>
        <span className="flex min-w-0 items-baseline gap-3">
          {fileName ? <span className={CODE_BLOCK_LABEL_CLASS}>{fileName}</span> : null}
          <span className={cn(CODE_BLOCK_LABEL_CLASS, "shrink-0")} data-code-language-label="">
            {label}
          </span>
        </span>
        <CopyButton getText={getText} />
      </div>
      <div
        id={bodyId}
        ref={bodyRef}
        role={focusable ? "region" : undefined}
        tabIndex={focusable ? 0 : undefined}
        aria-label={focusable ? regionLabel : undefined}
        data-scroll-region={focusable ? "scrolls" : "fits"}
        className={cn(CODE_BLOCK_BODY_CLASS, collapsed && CODE_BLOCK_COLLAPSED_CLASS)}
      >
        {children}
      </div>
      {collapsible ? (
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={toggle}
          className={CODE_BLOCK_TOGGLE_CLASS}
        >
          {expanded ? SHOW_FEWER_LINES_LABEL : showAllLinesLabel(lineCount)}
        </button>
      ) : null}
    </div>
  );
}

export default CodeBlockFrame;
