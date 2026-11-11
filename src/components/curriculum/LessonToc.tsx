"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { focusElement } from "@/components/search/focus-target";
import { MODAL_LAYER } from "@/components/search/shell-store";
import { useModalDialog } from "@/components/search/useModalDialog";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { cn } from "@/lib/utils";

import { groupHolding, groupTocEntries, isGroupOpen, scrollTopToReveal, type TocGroup } from "./lesson-reading";
import { ReadingProgressLine } from "./ReadingProgress";
import { useActiveHeading } from "./useLessonReading";

export interface LessonTocProps {
  entries: readonly TocEntry[];
  className?: string;
}

const EXPERT_PREFIX = /^expert:\s*/i;

/** The heading text without an "Expert:" prefix; the prefix becomes the quiet tag. */
export function tocLabel(entry: TocEntry): string {
  return entry.text.replace(EXPERT_PREFIX, "");
}

/** "14 sections, 3 expert": what the contents bar says before the reader reaches the first heading. */
export function tocSummary(entries: readonly TocEntry[]): string {
  const expert = entries.filter((entry) => entry.expert).length;
  return `${entries.length} ${entries.length === 1 ? "section" : "sections"}${expert > 0 ? `, ${expert} expert` : ""}`;
}

/**
 * Below 1280 px the nav is the contents bar: sticky under the 64 px site
 * header, running edge to edge of the main column (the page frame's 16, 24
 * and 32 px gutters, PAGE_FRAME_CLASS), 44 px tall. From 1280 px it is the
 * sticky right-hand column.
 */
export const LESSON_TOC_NAV_CLASS =
  "sticky top-16 z-30 -mx-4 min-w-0 sm:-mx-6 lg:-mx-8 xl:top-24 xl:z-auto xl:mx-0 print:hidden";

function isModifiedClick(event: React.MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function TocLink({
  entry,
  active,
  roomy,
  onNavigate,
}: {
  entry: TocEntry;
  active: boolean;
  /** 40 px rows (the sheet); compact rows in the column. */
  roomy: boolean;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, entry: TocEntry) => void;
}) {
  const label = tocLabel(entry);
  return (
    <a
      href={`#${entry.id}`}
      onClick={onNavigate ? (event) => onNavigate(event, entry) : undefined}
      aria-current={active ? "location" : undefined}
      // One name in every browser: "Expert: <topic>", matching the heading text.
      aria-label={entry.expert ? `Expert: ${label}` : undefined}
      data-depth={entry.depth}
      className={cn(
        "flex min-w-0 flex-1 items-start gap-2 rounded-lg border-l-2 px-2 text-sm leading-snug transition-colors duration-150 ease-bench motion-reduce:transition-none",
        roomy ? "min-h-[2.5rem] py-2.5" : "py-1.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-muted font-medium text-foreground"
          : cn(
              "border-transparent hover:bg-muted hover:text-foreground",
              entry.depth === 2 ? "text-foreground" : "text-muted-foreground",
            ),
      )}
    >
      {entry.expert ? (
        <span className="mt-0.5 shrink-0 rounded border border-border px-1.5 py-px text-label text-muted-foreground">
          Expert
        </span>
      ) : null}{" "}
      <span className="min-w-0 break-words">{label}</span>
    </a>
  );
}

interface TocListProps {
  groups: readonly TocGroup[];
  activeId: string | null;
  holdingId: string | null;
  choices: Readonly<Record<string, boolean>>;
  onToggleGroup: (groupId: string, open: boolean) => void;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, entry: TocEntry) => void;
  /** Keeps the child-list ids of the column and the sheet apart. */
  idPrefix: string;
  roomy: boolean;
}

/**
 * The entries: one row per layer (H2), its sections (H3) nested in a list that
 * collapses. A group is open while it holds the section being read, or when
 * the reader opened it.
 */
function TocList({ groups, activeId, holdingId, choices, onToggleGroup, onNavigate, idPrefix, roomy }: TocListProps) {
  return (
    <ol className="space-y-0.5">
      {groups.map(({ entry, children }) => {
        const open = isGroupOpen(entry.id, holdingId, choices);
        const childListId = `${idPrefix}-${entry.id}`;
        return (
          <li key={entry.id} data-toc-group={entry.id}>
            <div className="flex items-start gap-1">
              <TocLink entry={entry} active={activeId === entry.id} roomy={roomy} onNavigate={onNavigate} />
              {children.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={childListId}
                  aria-label={`Sections in ${tocLabel(entry)}`}
                  onClick={() => onToggleGroup(entry.id, !open)}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 ease-bench hover:bg-muted hover:text-foreground motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    roomy ? "h-10 w-10" : "h-8 w-8",
                  )}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn("h-4 w-4 transition-transform duration-150 ease-bench motion-reduce:transition-none", open && "rotate-90")}
                  />
                </button>
              ) : null}
            </div>
            {children.length > 0 ? (
              <ol id={childListId} hidden={!open} className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <TocLink entry={child} active={activeId === child.id} roomy={roomy} onNavigate={onNavigate} />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Scrolls the current entry into view inside `box` (never the page) when it is out of sight. */
function revealActiveEntry(box: HTMLElement | null): void {
  const row = box?.querySelector<HTMLElement>('a[aria-current="location"]');
  if (!box || !row || row.getClientRects().length === 0) return;
  const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  const next = scrollTopToReveal({ top, height: row.offsetHeight }, box);
  if (next !== null) box.scrollTop = next;
}

interface ContentsSheetProps {
  id: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * "On this page" as a bottom sheet below 1280 px: a modal dialog (focus moves
 * to the current entry and stays inside, Escape and the backdrop close it,
 * focus returns to the bar). Mounted only while open.
 */
function ContentsSheet({ id, onClose, children }: ContentsSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  useModalDialog(panelRef, {
    onClose,
    initialFocus: () =>
      panelRef.current?.querySelector<HTMLElement>('a[aria-current="location"]') ??
      panelRef.current?.querySelector<HTMLElement>("a[href]"),
  });

  useEffect(() => {
    revealActiveEntry(scrollRef.current);
  }, []);

  return (
    <div className="fixed inset-0 xl:hidden" data-testid="lesson-contents-sheet">
      <div aria-hidden="true" className="absolute inset-0 bg-background/80" onClick={onClose} />
      <motion.div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] max-w-3xl flex-col rounded-t-2xl border border-b-0 border-border bg-popover text-popover-foreground shadow-card focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border py-2 pl-4 pr-2">
          <h2 id={titleId} className="text-h4 text-foreground">
            On this page
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 ease-bench hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6 pt-2">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * "On this page" (G30-PAGE-02; SPEC-phases-2-4.md, "Lesson page"): the
 * lesson's H2 layers and H3 sections as anchor links. It follows the reader:
 * the entry for the section being read carries aria-current="location" and is
 * scrolled into view inside the panel, and only the layer holding it is open
 * (the reader can open or close any layer). Expert entries carry a quiet
 * "Expert" tag, text rather than colour.
 *
 * Below 1280 px it is a 44 px sticky bar under the header, "On this page:
 * <current section>" with the reading progress line on its bottom edge, that
 * opens the entries as a sheet. From 1280 px it is the sticky right-hand
 * column. The shell's "t" shortcut (focusLessonToc) relies on the nav's name,
 * on the bar's button being the first button with aria-controls, and on
 * aria-current.
 */
export default function LessonToc({ entries, className }: LessonTocProps) {
  const groups = useMemo(() => groupTocEntries(entries), [entries]);
  const ids = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const activeId = useActiveHeading(ids);
  const holdingId = groupHolding(groups, activeId);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const idBase = useId();
  const sheetId = `${idBase}-sheet`;

  // When the reader moves into another layer, the list follows them again.
  const lastHolding = useRef(holdingId);
  useEffect(() => {
    if (lastHolding.current === holdingId) return;
    lastHolding.current = holdingId;
    setChoices({});
  }, [holdingId]);

  useEffect(() => {
    revealActiveEntry(columnRef.current);
  }, [activeId, holdingId]);

  // The sheet exists below 1280 px only: close it if the window grows past that.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(min-width: 1280px)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [open]);

  const toggleGroup = useCallback((groupId: string, value: boolean) => {
    setChoices((previous) => ({ ...previous, [groupId]: value }));
  }, []);

  const openSheet = () => {
    // Focus the bar first, so it is where focus returns when the sheet closes
    // (the "t" shortcut opens the sheet with a scripted click).
    buttonRef.current?.focus();
    setOpen(true);
  };
  const closeSheet = useCallback(() => setOpen(false), []);

  // A link in the sheet closes the sheet first, then moves to the heading and
  // gives it focus, so keyboard and screen reader users land in that section.
  const navigateFromSheet = useCallback((event: React.MouseEvent<HTMLAnchorElement>, entry: TocEntry) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    setOpen(false);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(entry.id);
      if (!target) return;
      window.history.pushState(null, "", `#${entry.id}`);
      target.scrollIntoView({ block: "start" });
      focusElement(target);
    });
  }, []);

  if (entries.length === 0) return null;

  const current = activeId ? entries.find((entry) => entry.id === activeId) : undefined;
  const listProps = { groups, activeId, holdingId, choices, onToggleGroup: toggleGroup };

  return (
    <nav aria-label="On this page" data-lesson-toc="" className={cn(LESSON_TOC_NAV_CLASS, open && MODAL_LAYER, className)}>
      <div className="relative flex h-11 items-stretch border-b border-border bg-background px-4 sm:px-6 lg:px-8 xl:hidden" data-testid="lesson-contents-bar">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={sheetId}
          onClick={openSheet}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-lg text-left text-ui transition-colors duration-150 ease-bench hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
        >
          <span className="shrink-0 font-medium text-foreground">{current ? "On this page:" : "On this page"}</span>
          <span data-testid="lesson-contents-current" className="min-w-0 flex-1 truncate text-muted-foreground">
            {current ? (current.expert ? `Expert: ${tocLabel(current)}` : tocLabel(current)) : tocSummary(entries)}
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <ReadingProgressLine className="absolute inset-x-0 -bottom-px" />
      </div>

      {open ? (
        <ContentsSheet id={sheetId} onClose={closeSheet}>
          <TocList {...listProps} idPrefix={`${idBase}-sheet`} roomy onNavigate={navigateFromSheet} />
        </ContentsSheet>
      ) : null}

      <div className="hidden xl:block" data-testid="lesson-toc-column">
        <p aria-hidden="true" className="px-2 pb-2 text-label text-subtle">
          On this page
        </p>
        <div ref={columnRef} className="max-h-[calc(100vh-8.5rem)] overflow-y-auto overscroll-contain pb-4 pr-1">
          <TocList {...listProps} idPrefix={`${idBase}-column`} roomy={false} />
        </div>
      </div>
    </nav>
  );
}
