"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Menu, Search, X } from "lucide-react";

import { MODAL_LAYER, shellStore, useMinWidth, useShellState } from "@/components/search/shell-store";
import { isEditableTarget, matchShortcut } from "@/components/search/shortcuts";
import { useModalDialog } from "@/components/search/useModalDialog";
import { CHROME_GLASS_CLASS, DIALOG_BACKDROP_CLASS } from "@/components/layout/nav-styles";
import { headerFocusRing, iconButtonClass, iconButtonIconClass } from "@/components/ui/icon-button-class";
import { SignalTag } from "@/components/ui/SignalTag";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useContinueLesson } from "@/hooks/useContinueLesson";
import { continueAccessibleName, type ContinueLessonEntry } from "@/lib/continue-lesson";
import type { NavLink } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { CONTINUE_LABEL, START_LEARNING_LABEL, longestContinueCode } from "./public-header-resume";

/** Tailwind's `md`: below it the header shows the wordmark, search and the menu button. */
export const PUBLIC_MENU_MAX_WIDTH = 768;

/**
 * The search dialog, loaded on first use: the landing page does not download
 * the dialog, the combobox or the index until a visitor asks to search.
 */
const LazySearchDialog = dynamic(() => import("@/components/search/SearchDialog"), { ssr: false });

/** Starts downloading the dialog's chunk (hover or focus on the search button), so it opens without a wait. */
function preloadSearchDialog(): void {
  void import("@/components/search/SearchDialog").catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Start learning / Continue
// ---------------------------------------------------------------------------

/**
 * The accent action's style. In the bar it is the secondary style (raised
 * surface, hairline, primary text, no sheen), 40 px tall: the page below owns
 * the view's one filled accent button (the landing hero's "Find your level"),
 * DESIGN.md section 2 rule 2. In the phone menu, a sheet over the dimmed page,
 * it is the menu's one filled accent action, 44 px and full width.
 */
export function resumeLinkClass(layout: "bar" | "menu"): string {
  return cn(
    "inline-grid shrink-0 place-items-center whitespace-nowrap rounded-lg border px-4 text-ui font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none forced-colors:border-[ButtonText]",
    layout === "menu"
      ? "sheen-primary h-11 w-full border-transparent bg-primary text-primary-foreground"
      : "h-10 border-border bg-muted text-primary hover:bg-border/70",
    headerFocusRing,
  );
}

const CONTINUE_ROW_CLASS = "inline-flex items-center gap-1.5";

/**
 * "Continue" and the module code as a signal tag (DESIGN.md section 8). Its text reads exactly as
 * continueLabel ("Continue F2D"). In the bar the tag keeps its tier tint; on the phone menu's accent
 * fill it takes the fill's text colour.
 */
function ContinueWithTag({ code, layout }: { code: string; layout: "bar" | "menu" }) {
  return (
    <>
      {CONTINUE_LABEL}{" "}
      {layout === "menu" ? (
        <SignalTag code={code} neutral className="border-primary-foreground/40 text-primary-foreground" />
      ) : (
        <SignalTag code={code} />
      )}
    </>
  );
}

interface ResumeLinkProps {
  firstLessonHref: string;
  /** Every lesson in course order (continueLessons()), for the one continue rule. */
  lessons: readonly ContinueLessonEntry[];
  layout?: "bar" | "menu";
  onNavigate?: () => void;
}

/**
 * "Start learning" (to the first lesson), or "Continue <code>" (to the lesson
 * to continue, by the one rule in src/lib/continue-lesson.ts), with the
 * lesson's full title in the accessible name. The labels sit in one grid cell
 * beside an invisible copy of the longest continue label any lesson can
 * produce, so the link has the same width in every state and nothing in the
 * row shifts when the stored position appears after hydration. The server HTML
 * is always "Start learning".
 */
export function ResumeLink({ firstLessonHref, lessons, layout = "bar", onNavigate }: ResumeLinkProps) {
  const position = useContinueLesson(lessons);
  const lesson = position?.lesson ?? null;
  const sizer = useMemo(() => longestContinueCode(lessons), [lessons]);
  const cell = "col-start-1 row-start-1";

  return (
    <Link
      href={lesson?.href ?? firstLessonHref}
      onClick={onNavigate}
      data-testid="public-header-resume"
      data-state={lesson ? "continue" : "start"}
      aria-label={lesson ? continueAccessibleName(lesson) : undefined}
      className={resumeLinkClass(layout)}
    >
      <span className={cn(cell, lesson && "invisible")} aria-hidden={lesson ? true : undefined}>
        {START_LEARNING_LABEL}
      </span>
      <span className={cn(cell, CONTINUE_ROW_CLASS, !lesson && "invisible")} aria-hidden={lesson ? undefined : true}>
        {lesson ? <ContinueWithTag code={lesson.code} layout={layout} /> : null}
      </span>
      <span className={cn(cell, CONTINUE_ROW_CLASS, "invisible")} aria-hidden="true" data-resume-sizer="">
        <ContinueWithTag code={sizer} layout={layout} />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * The search button. The first press (or Ctrl/Cmd+K, or "/" outside a field)
 * loads the search dialog and opens it; the dialog then stays mounted and
 * opens and closes through the shell store, like the learning header's.
 */
export function PublicSearchButton() {
  const searchOpen = useShellState((state) => state.searchOpen);
  const [requested, setRequested] = useState(false);

  const open = useCallback(() => {
    setRequested(true);
    shellStore.openSearch();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || shellStore.anyModalOpen()) return;
      const match = matchShortcut(event);
      if (match?.id !== "search") return;
      if (!match.allowWhileTyping && isEditableTarget(event.target)) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        onPointerEnter={preloadSearchDialog}
        onFocus={preloadSearchDialog}
        className={iconButtonClass}
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        aria-keyshortcuts="Control+K Meta+K"
        data-testid="public-search-button"
      >
        <Search aria-hidden="true" className={iconButtonIconClass} />
      </button>
      {requested && <LazySearchDialog />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Phone menu
// ---------------------------------------------------------------------------

/** A full-width, 44 px row in the phone menu. */
const menuRowClass = cn(
  "flex min-h-11 items-center rounded-lg border-l-2 border-transparent px-3 text-lg font-medium text-foreground transition-colors duration-150 ease-bench hover:bg-muted motion-reduce:transition-none",
  headerFocusRing,
);

/** Phone-menu group headings: the label style, 12/16 at weight 500, sentence case. */
const menuHeadingClass = "px-3 text-label text-muted-foreground";

interface PublicMenuProps {
  links: readonly NavLink[];
  firstLessonHref: string;
  lessons: readonly ContinueLessonEntry[];
}

function PublicMenuPanel({ links, firstLessonHref, lessons }: PublicMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const appearanceId = useId();
  useModalDialog(panelRef, { onClose: shellStore.closeMenu });

  return (
    <div className={cn("fixed inset-0 md:hidden", MODAL_LAYER)}>
      <div aria-hidden="true" data-testid="public-menu-backdrop" className={cn("absolute inset-0", DIALOG_BACKDROP_CLASS)} onClick={shellStore.closeMenu} />
      <div
        ref={panelRef}
        id="public-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="public-menu"
        className={cn(
          CHROME_GLASS_CLASS,
          "absolute inset-y-2 right-2 flex w-[calc(80%-0.5rem)] max-w-sm flex-col rounded-2xl text-foreground focus:outline-none",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-glass-border p-4">
          <h2 id={titleId} className="text-h4 text-foreground">
            Menu
          </h2>
          <button type="button" onClick={shellStore.closeMenu} className={iconButtonClass} aria-label="Close menu">
            <X aria-hidden="true" className={iconButtonIconClass} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <nav aria-label="Main">
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={shellStore.closeMenu} className={menuRowClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-3">
            <ResumeLink
              firstLessonHref={firstLessonHref}
              lessons={lessons}
              layout="menu"
              onNavigate={shellStore.closeMenu}
            />
          </div>
          <section aria-labelledby={appearanceId} className="border-t border-glass-border pt-4">
            <h3 id={appearanceId} className={menuHeadingClass}>
              Appearance
            </h3>
            <div className="mt-2 px-3">
              <ThemeSwitcher layout="menu" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The phone menu button (below 768 px) and its dialog: the links, the accent action and the theme choices. */
export function PublicMenu(props: PublicMenuProps) {
  const menuOpen = useShellState((state) => state.menuOpen);
  const wide = useMinWidth(PUBLIC_MENU_MAX_WIDTH);
  const pathname = usePathname();

  // The menu is md:hidden: never leave it open, trapping focus, on a wider window or after a navigation.
  useEffect(() => {
    if (wide && menuOpen) shellStore.closeMenu();
  }, [wide, menuOpen]);
  useEffect(() => {
    shellStore.closeMenu();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={shellStore.openMenu}
        className={iconButtonClass}
        aria-label="Open main menu"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "public-menu" : undefined}
        data-testid="public-menu-button"
      >
        <Menu aria-hidden="true" className={iconButtonIconClass} />
      </button>
      {menuOpen && <PublicMenuPanel {...props} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The header's right-hand controls
// ---------------------------------------------------------------------------

/**
 * The public header's controls after its links. From 768 px: search, the
 * theme menu button and the accent action. Below 768 px: search and the menu
 * button. Every control server-renders at its final size, so the row does not
 * move on hydration.
 */
export default function PublicHeaderControls(props: PublicMenuProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <PublicSearchButton />
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center md:flex">
        <ThemeSwitcher />
      </div>
      <div className="hidden md:block">
        <ResumeLink firstLessonHref={props.firstLessonHref} lessons={props.lessons} />
      </div>
      <div className="md:hidden">
        <PublicMenu {...props} />
      </div>
    </div>
  );
}
