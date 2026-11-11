"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, LayoutList, PanelLeftClose, X } from "lucide-react";
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
import { SignalTag } from "@/components/ui/SignalTag";
import { curriculumData } from "@/lib/curriculum-data";
import { CURRICULUM_HREF, tierSectionHref, type NavLink } from "@/lib/site-links";
import { cn } from "@/lib/utils";

/** The id the navbar's outline button points at (aria-controls) while the drawer is open. */
export const OUTLINE_DRAWER_ID = "course-outline-drawer";
/** The id of the docked outline column on lesson pages. */
export const DOCKED_OUTLINE_ID = "course-outline-docked";
/**
 * The docked column's width. The header's left slot uses the same classes, so
 * the wordmark sits over the outline and the search field starts at the main
 * column's edge (SPEC-phases-2-4.md, "Header layout").
 */
export const DOCKED_OUTLINE_WIDTH = "w-64 xl:w-72";

/**
 * The one site link in the outline, at the top of the phone drawer only
 * (SPEC-phases-2-4.md, "Course outline"). The docked column repeats no site
 * links: the navbar carries them.
 */
export const OUTLINE_OVERVIEW_LINK: NavLink = { label: "Curriculum overview", href: CURRICULUM_HREF };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const transition = "transition-colors duration-150 ease-bench motion-reduce:transition-none";

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * A row in the outline: 40 px tall at least. The current row is the raised
 * surface with a 2 px accent marker on its leading edge and primary text
 * (DESIGN.md section 2, rule 3).
 */
export function outlineRowClass(current: boolean): string {
  return cn(
    "flex min-h-10 w-full min-w-0 items-start gap-2 rounded-lg border-l-2 px-2 py-2 text-left text-sm",
    transition,
    current
      ? "border-primary bg-muted font-medium text-foreground"
      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    focusRing,
  );
}

const toggleClass = cn(
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
  transition,
  focusRing,
);

/**
 * Scrolls `container` so its current item (aria-current="page") is in view,
 * a third of the way down, without scrolling the page. Does nothing when the
 * item is already visible.
 */
export function revealCurrentItem(container: HTMLElement | null): void {
  const current = container?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!container || !current) return;
  const top = current.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const bottom = top + current.offsetHeight;
  if (top < container.scrollTop || bottom > container.scrollTop + container.clientHeight) {
    container.scrollTop = Math.max(0, top - container.clientHeight / 3);
  }
}

interface TreeProps {
  outline: OutlineTier[];
  /** Runs when a link is followed (the drawer closes itself). */
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
  open,
  onToggle,
  idPrefix,
  onNavigate,
}: {
  mod: OutlineModule;
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
          className={outlineRowClass(first.current)}
        >
          <SignalTag code={mod.code} className="-my-px" />
          <span className={cn("min-w-0 break-words", mod.current && !first.current && "font-medium text-foreground")}>
            {mod.title}
          </span>
        </Link>
        {rest.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={lessonsId} onClick={onToggle} className={toggleClass}>
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
                className={outlineRowClass(lesson.current)}
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

/**
 * Tiers → modules → lessons. Each tier heading is a link to that tier's
 * section of /curriculum, with a disclosure button beside it; each
 * multi-lesson module is a disclosure too.
 */
export function CourseOutlineTree({ outline, onNavigate }: TreeProps) {
  const idPrefix = useId().replace(/:/g, "");
  const { tierOpen, moduleOpen, toggleTier, toggleModule } = useExpansion(outline);

  return (
    <ul className="space-y-1">
      {outline.map((tier) => {
        const open = tierOpen(tier.id);
        const panelId = `${idPrefix}-${tier.code}`;
        const tierHref = tierSectionHref(tier.id);
        return (
          <li key={tier.id}>
            <div className="flex items-start gap-1">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggleTier(tier.id)}
                className={toggleClass}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", !open && "-rotate-90")}
                />
                <span className="sr-only">{`${tier.title} modules`}</span>
              </button>
              <Link
                href={tierHref}
                data-outline-tier={tier.code}
                onClick={(event) => {
                  if (!isModifiedClick(event)) onNavigate?.(tierHref);
                }}
                className={cn(
                  "flex min-h-10 min-w-0 flex-1 flex-col justify-center rounded-lg px-2 py-1.5 hover:bg-muted",
                  transition,
                  focusRing,
                )}
              >
                <span className={cn("text-sm text-foreground", tier.current ? "font-semibold" : "font-medium")}>
                  {tier.title}
                </span>
                <span className="sr-only">, </span>
                <span className="text-xs text-muted-foreground">
                  {tier.moduleCount} modules · {tier.lessonCount} lessons
                </span>
              </Link>
            </div>
            <div id={panelId} hidden={!open}>
              {tier.audience && <p className="px-2 pb-2 pl-12 text-xs text-muted-foreground">{tier.audience}</p>}
              {tier.groups.map((group, groupIndex) => {
                const items = group.modules.map((mod) => (
                  <ModuleItem
                    key={mod.id}
                    mod={mod}
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
                    <p id={labelId} className="px-2 pb-1 pt-1 text-label text-subtle">
                      Electives
                      <span className="ml-1 font-normal">(optional: the core path skips them)</span>
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

function useCourseOutline() {
  const pathname = usePathname();
  const current = useMemo(() => currentLessonSlug(pathname), [pathname]);
  const outline = useMemo(() => buildCourseOutline(curriculumData, manifestTierMeta, current), [current]);
  return { outline, isLessonPage: current !== null, pathname };
}

/** The outline docked beside the lesson at lg and wider; hidden below lg, where the drawer takes over. */
function DockedOutline({ outline }: { outline: OutlineTier[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current lesson in view inside the column, without scrolling the page.
  useEffect(() => {
    revealCurrentItem(scrollRef.current);
  }, [outline]);

  const hide = () => {
    shellStore.setOutlineCollapsed(true);
    document.querySelector<HTMLElement>("[data-outline-toggle]")?.focus();
  };

  return (
    <div id={DOCKED_OUTLINE_ID} className={cn("hidden shrink-0 border-r border-border lg:block", DOCKED_OUTLINE_WIDTH)}>
      <nav aria-label="Course outline" className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center justify-between gap-2 pb-1 pl-3 pr-2 pt-2">
          <p className="text-label text-subtle">Course outline</p>
          <button
            type="button"
            onClick={hide}
            aria-label="Hide course outline"
            title="Hide course outline"
            className={toggleClass}
          >
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          <CourseOutlineTree outline={outline} />
        </div>
      </nav>
    </div>
  );
}

/**
 * The outline as a modal drawer (G30-SIDE-V08): below lg, and on pages
 * without the docked column. One site link at the top, "Curriculum
 * overview", then the outline; the current lesson is scrolled into view and
 * takes focus.
 */
function OutlineDrawer({ outline, pathname }: { outline: OutlineTier[]; pathname: string | null }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  useModalDialog(panelRef, {
    onClose: shellStore.closeOutline,
    initialFocus: () =>
      panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      panelRef.current?.querySelector<HTMLElement>("[data-outline-close]"),
  });

  // After focus moves in: centre the current lesson inside the drawer's scroll area.
  useEffect(() => {
    revealCurrentItem(scrollRef.current);
  }, []);

  const onNavigate = (href: string) => {
    shellStore.closeOutline();
    focusAfterNavigation(href);
  };
  const overviewCurrent = pathname === OUTLINE_OVERVIEW_LINK.href;

  return (
    <div className={cn("fixed inset-0", MODAL_LAYER)}>
      <div
        aria-hidden="true"
        data-testid="course-outline-backdrop"
        className="absolute inset-0 bg-background/80"
        onClick={shellStore.closeOutline}
      />
      <motion.div
        ref={panelRef}
        id={OUTLINE_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduceMotion ? false : { x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col border-r border-border bg-card text-foreground shadow-card focus:outline-none"
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
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted",
              transition,
              focusRing,
            )}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <nav
          ref={scrollRef}
          aria-label="Course outline"
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
        >
          <Link
            href={OUTLINE_OVERVIEW_LINK.href}
            data-outline-overview=""
            aria-current={overviewCurrent ? "page" : undefined}
            onClick={(event) => {
              if (!isModifiedClick(event)) onNavigate(OUTLINE_OVERVIEW_LINK.href);
            }}
            className={cn(outlineRowClass(overviewCurrent), "mb-2 items-center font-medium text-foreground")}
          >
            <LayoutList aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            {OUTLINE_OVERVIEW_LINK.label}
          </Link>
          <CourseOutlineTree outline={outline} onNavigate={onNavigate} />
        </nav>
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
 * order, module codes as signal tags, the current lesson marked with
 * aria-current="page", electives grouped and labelled, each tier collapsible
 * and linked to its section of /curriculum. On lesson pages at lg and
 * wider it is docked beside the lesson (hideable, remembered per browser);
 * below lg, and on other pages, the navbar button and Ctrl/Cmd+B open it as a
 * modal drawer.
 */
export default function Sidebar() {
  const { outline, isLessonPage, pathname } = useCourseOutline();
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
      {drawerOpen && <OutlineDrawer outline={outline} pathname={pathname} />}
    </>
  );
}
