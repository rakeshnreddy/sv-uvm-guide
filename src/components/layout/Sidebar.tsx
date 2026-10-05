"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, PanelLeftClose, X } from "lucide-react";
import React, { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";

import {
  buildCourseOutline,
  currentLessonSlug,
  defaultExpansion,
  isLessonPath,
  manifestTierMeta,
  type OutlineModule,
  type OutlineTier,
} from "@/components/search/course-outline";
import { focusAfterNavigation } from "@/components/search/focus-target";
import {
  LG_MIN_WIDTH,
  MODAL_LAYER,
  shellStore,
  useMinWidth,
  useShellState,
  viewportAtLeast,
} from "@/components/search/shell-store";
import { useModalDialog } from "@/components/search/useModalDialog";
import { curriculumData } from "@/lib/curriculum-data";
import { INTERVIEW_PREP_HREF, LABS_HREF, START_HERE_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

/** The id the navbar's outline button points at (aria-controls) while the drawer is open. */
export const OUTLINE_DRAWER_ID = "course-outline-drawer";
/** The id of the docked outline column on lesson pages. */
export const DOCKED_OUTLINE_ID = "course-outline-docked";

/**
 * Quick links under the outline, in the drawer and in the docked column
 * (G30-SIDE-04, G30-SIDE-05, G30-PATH-07): the route chooser, the overview,
 * the practice hub, its labs and the interview banks. The navbar shows Labs
 * and Interview prep only from xl, so on narrower windows these are their
 * links in the shell.
 */
export const OUTLINE_QUICK_LINKS: readonly { label: string; href: string }[] = [
  { label: "Start here", href: START_HERE_HREF },
  { label: "Curriculum overview", href: "/curriculum" },
  { label: "Practice hub", href: "/practice" },
  { label: "Labs", href: LABS_HREF },
  { label: "Interview prep", href: INTERVIEW_PREP_HREF },
];

type Density = "compact" | "comfortable";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function linkClass(current: boolean, density: Density): string {
  return cn(
    "flex w-full min-w-0 items-start gap-2 rounded-lg border-l-4 px-2 text-left text-sm transition-colors motion-reduce:transition-none",
    density === "compact" ? "min-h-8 py-1.5" : "min-h-10 py-2",
    current
      ? "border-primary bg-primary/10 font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    focusRing,
  );
}

interface TreeProps {
  outline: OutlineTier[];
  density: Density;
  /** Runs when a lesson link is followed (the drawer closes itself). */
  onNavigate?: (href: string) => void;
}

function useExpansion(outline: OutlineTier[]) {
  const initial = useMemo(() => defaultExpansion(outline), [outline]);
  const [tiers, setTiers] = useState<Set<string>>(() => new Set(initial.tiers));
  const [modules, setModules] = useState<Set<string>>(() => new Set(initial.modules));

  // Moving to a lesson elsewhere in the course opens its tier and module.
  useEffect(() => {
    setTiers((open) => (initial.tiers.every((id) => open.has(id)) ? open : new Set([...open, ...initial.tiers])));
    setModules((open) => (initial.modules.every((id) => open.has(id)) ? open : new Set([...open, ...initial.modules])));
  }, [initial]);

  const toggle = (setter: typeof setTiers, id: string) =>
    setter((open) => {
      const next = new Set(open);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return {
    tierOpen: (id: string) => tiers.has(id),
    moduleOpen: (id: string) => modules.has(id),
    toggleTier: (id: string) => toggle(setTiers, id),
    toggleModule: (id: string) => toggle(setModules, id),
  };
}

function ModuleItem({
  mod,
  density,
  open,
  onToggle,
  idPrefix,
  onNavigate,
}: {
  mod: OutlineModule;
  density: Density;
  open: boolean;
  onToggle: () => void;
  idPrefix: string;
  onNavigate?: (href: string) => void;
}) {
  const [first, ...rest] = mod.lessons;
  const lessonsId = `${idPrefix}-${mod.code}-lessons`;
  const follow = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isModifiedClick(event)) onNavigate?.(href);
  };

  return (
    <li>
      <div className="flex items-start gap-1">
        <Link
          href={first.href}
          aria-current={first.current ? "page" : undefined}
          // One name in every browser ("F1A: The Cost of Bugs"); the visible code and title, in order.
          aria-label={`${mod.code}: ${mod.title}`}
          onClick={(event) => follow(event, first.href)}
          className={linkClass(first.current, density)}
        >
          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">{mod.code}</span>
          <span className={cn("min-w-0 break-words", mod.current && !first.current && "font-medium text-foreground")}>
            {mod.title}
          </span>
        </Link>
        {rest.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={lessonsId}
            onClick={onToggle}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
              density === "compact" ? "h-8 w-8" : "h-10 w-10",
              focusRing,
            )}
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            />
            <span className="sr-only">{`${mod.code} lessons (${rest.length})`}</span>
          </button>
        )}
      </div>
      {rest.length > 0 && (
        <ul id={lessonsId} hidden={!open} className="ml-3 mt-1 space-y-0.5 border-l border-border pl-2">
          {rest.map((lesson) => (
            <li key={lesson.slug}>
              <Link
                href={lesson.href}
                aria-current={lesson.current ? "page" : undefined}
                onClick={(event) => follow(event, lesson.href)}
                className={linkClass(lesson.current, density)}
              >
                <span className="min-w-0 break-words">{lesson.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Tiers → modules → lessons, each tier and multi-lesson module a disclosure. */
export function CourseOutlineTree({ outline, density, onNavigate }: TreeProps) {
  const idPrefix = useId().replace(/:/g, "");
  const { tierOpen, moduleOpen, toggleTier, toggleModule } = useExpansion(outline);

  return (
    <ul className="space-y-1">
      {outline.map((tier) => {
        const open = tierOpen(tier.id);
        const panelId = `${idPrefix}-${tier.code}`;
        return (
          <li key={tier.id}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggleTier(tier.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted",
                density === "compact" ? "min-h-9" : "min-h-11",
                focusRing,
              )}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                  !open && "-rotate-90",
                )}
              />
              <span className="min-w-0">
                <span className={cn("block text-sm text-foreground", tier.current ? "font-bold" : "font-semibold")}>
                  {tier.title}
                </span>
                <span className="sr-only">, </span>
                <span className="block text-xs text-muted-foreground">
                  {tier.moduleCount} modules · {tier.lessonCount} lessons
                </span>
              </span>
            </button>
            <div id={panelId} hidden={!open}>
              {tier.audience && <p className="px-2 pb-2 pl-8 text-xs text-muted-foreground">{tier.audience}</p>}
              {tier.groups.map((group, groupIndex) => {
                const items = group.modules.map((mod) => (
                  <ModuleItem
                    key={mod.id}
                    mod={mod}
                    density={density}
                    open={moduleOpen(mod.id)}
                    onToggle={() => toggleModule(mod.id)}
                    idPrefix={idPrefix}
                    onNavigate={onNavigate}
                  />
                ));
                if (group.track === "core") {
                  return (
                    <ul key={`core-${groupIndex}`} className="space-y-0.5 pl-4">
                      {items}
                    </ul>
                  );
                }
                const labelId = `${panelId}-electives-${groupIndex}`;
                return (
                  <div
                    key={`elective-${groupIndex}`}
                    role="group"
                    aria-labelledby={labelId}
                    className="mb-1 ml-4 mt-2 rounded-lg border border-dashed border-border p-1"
                  >
                    <p id={labelId} className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Electives
                      <span className="ml-1 font-normal normal-case tracking-normal">(optional: the core path skips them)</span>
                    </p>
                    <ul className="space-y-0.5">{items}</ul>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** OUTLINE_QUICK_LINKS as a labelled list. `onNavigate` runs when a link is followed (the drawer closes itself). */
function OutlineQuickLinks({ density, onNavigate }: { density: Density; onNavigate?: (href: string) => void }) {
  return (
    <ul
      aria-label="Quick links"
      className={cn(
        "flex shrink-0 flex-wrap gap-x-4 border-t border-border text-sm",
        density === "compact" ? "px-3 py-1.5" : "gap-y-1 px-4 py-2",
      )}
    >
      {OUTLINE_QUICK_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={(event) => {
              if (!isModifiedClick(event)) onNavigate?.(link.href);
            }}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded font-medium text-foreground underline-offset-4 hover:underline",
              density === "compact" ? "min-h-8" : "min-h-10",
              focusRing,
            )}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function useCourseOutline() {
  const pathname = usePathname();
  const current = useMemo(() => currentLessonSlug(pathname), [pathname]);
  const outline = useMemo(() => buildCourseOutline(curriculumData, manifestTierMeta, current), [current]);
  return { outline, isLessonPage: current !== null };
}

/** The outline docked beside the lesson at lg and wider; hidden below lg, where the drawer takes over. */
function DockedOutline({ outline }: { outline: OutlineTier[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current lesson in view inside the column, without scrolling the page.
  // The container is `relative`, so offsetTop is measured from its top edge.
  useEffect(() => {
    const container = scrollRef.current;
    const currentLink = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !currentLink) return;
    const top = currentLink.offsetTop;
    if (top < container.scrollTop || top > container.scrollTop + container.clientHeight - currentLink.offsetHeight) {
      container.scrollTop = Math.max(0, top - container.clientHeight / 3);
    }
  }, [outline]);

  const hide = () => {
    shellStore.setOutlineCollapsed(true);
    document.querySelector<HTMLElement>("[data-outline-toggle]")?.focus();
  };

  return (
    <div id={DOCKED_OUTLINE_ID} className="hidden w-64 shrink-0 border-r border-border lg:block xl:w-72">
      <nav aria-label="Course outline" className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course outline</p>
          <button
            type="button"
            onClick={hide}
            aria-label="Hide course outline"
            title="Hide course outline"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
              focusRing,
            )}
          >
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          <CourseOutlineTree outline={outline} density="compact" />
        </div>
        <OutlineQuickLinks density="compact" />
      </nav>
    </div>
  );
}

/** The outline as a modal drawer (G30-SIDE-V08): below lg, and on pages without the docked column. */
function OutlineDrawer({ outline }: { outline: OutlineTier[] }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalDialog(panelRef, {
    onClose: shellStore.closeOutline,
    initialFocus: () =>
      panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      panelRef.current?.querySelector<HTMLElement>("[data-outline-close]"),
  });

  const onNavigate = (href: string) => {
    shellStore.closeOutline();
    focusAfterNavigation(href);
  };

  return (
    <div className={cn("fixed inset-0", MODAL_LAYER)}>
      <div
        aria-hidden="true"
        data-testid="course-outline-backdrop"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={shellStore.closeOutline}
      />
      <motion.div
        ref={panelRef}
        id={OUTLINE_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col border-r border-border bg-background text-foreground shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            Course outline
          </h2>
          <button
            type="button"
            data-outline-close
            onClick={shellStore.closeOutline}
            aria-label="Close course outline"
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted",
              focusRing,
            )}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Course outline" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          <CourseOutlineTree outline={outline} density="comfortable" onNavigate={onNavigate} />
        </nav>
        <OutlineQuickLinks density="comfortable" onNavigate={onNavigate} />
      </motion.div>
    </div>
  );
}

/** True when the outline is docked right now: a lesson page at lg or wider. */
export function outlineDockedNow(pathname: string | null): boolean {
  return isLessonPath(pathname) && viewportAtLeast(LG_MIN_WIDTH);
}

/**
 * State and action for the navbar's outline button (and Ctrl/Cmd+B): where the
 * outline is docked it shows or hides the column, elsewhere it opens or
 * closes the drawer. Both cases report aria-expanded the same way.
 */
export function useOutlineToggle() {
  const pathname = usePathname();
  const wide = useMinWidth(LG_MIN_WIDTH);
  const drawerOpen = useShellState((state) => state.outlineOpen);
  const collapsed = useShellState((state) => state.outlineCollapsed);
  const docked = wide && isLessonPath(pathname);
  const expanded = docked ? !collapsed : drawerOpen;
  return {
    expanded,
    controls: expanded ? (docked ? DOCKED_OUTLINE_ID : OUTLINE_DRAWER_ID) : undefined,
    toggle: () => shellStore.toggleOutline(outlineDockedNow(pathname)),
  };
}

/**
 * The course outline (G30-SIDE-01): tiers → modules → lessons in manifest
 * order, the current lesson marked with aria-current="page", electives
 * grouped and labelled, each tier collapsible. On lesson pages at lg and
 * wider it is docked beside the lesson (hideable, remembered per browser);
 * below lg, and on other pages, the navbar button and Ctrl/Cmd+B open it as a
 * modal drawer.
 */
export default function Sidebar() {
  const { outline, isLessonPage } = useCourseOutline();
  const drawerOpen = useShellState((state) => state.outlineOpen);
  const collapsed = useShellState((state) => state.outlineCollapsed);
  const wide = useMinWidth(LG_MIN_WIDTH);

  // Growing the window past lg on a lesson page hands over from the drawer to the docked column.
  useEffect(() => {
    if (drawerOpen && isLessonPage && wide) shellStore.closeOutline();
  }, [drawerOpen, isLessonPage, wide]);

  return (
    <>
      {isLessonPage && !collapsed && <DockedOutline outline={outline} />}
      {drawerOpen && <OutlineDrawer outline={outline} />}
    </>
  );
}
