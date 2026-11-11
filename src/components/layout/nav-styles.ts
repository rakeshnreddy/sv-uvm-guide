import { headerFocusRing } from "@/components/ui/icon-button-class";
import { cn } from "@/lib/utils";

/**
 * The page frame the learning pages and the header share, so the header lines
 * up with the page below it: at most 1280 px, centred, with the 16, 24 and 32
 * px gutters (DESIGN.md section 5). MainLayout wraps every page in it.
 */
export const PAGE_FRAME_CLASS = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * The header's left slot while the course outline is docked: exactly as wide
 * as the docked column (Sidebar's DockedOutline is w-64, w-72 from xl), so the
 * wordmark sits over the outline and the search field starts at the main
 * column's left edge. Below lg the outline is a drawer and the slot just holds
 * the toggle and wordmark at the page gutter.
 */
export const OUTLINE_SLOT_CLASS = "flex shrink-0 items-center gap-2 pl-4 sm:pl-6 lg:w-64 lg:px-3 xl:w-72";

/** The frame beside that slot: the page frame, with the left gutter given to the slot below lg. */
export const FRAME_BESIDE_SLOT_CLASS = "mx-auto w-full max-w-7xl pl-2 pr-4 sm:pr-6 lg:px-8";

/**
 * A top-level item in the bar, link or disclosure button. Every item is set at
 * weight 500, so the row never moves between pages; the current one is marked
 * by the primary text colour and the 2 px accent underline.
 */
export function barLinkClass(current: boolean): string {
  return cn(
    "inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none xl:px-3",
    current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    headerFocusRing,
  );
}

/** A disclosure's panel: the menu surface (popover, hairline, radius 12, shadow-card), faded in over 200 ms. */
export function menuPanelClass(open: boolean): string {
  return cn(
    "absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-card transition-[opacity,visibility] duration-200 ease-bench motion-reduce:transition-none",
    open ? "visible opacity-100" : "invisible opacity-0",
  );
}

/** A link inside a disclosure panel: a 40 px row; the current one is the raised surface with the 2 px accent marker. */
export function menuItemClass(current: boolean): string {
  return cn(
    "flex min-h-10 items-center rounded-lg border-l-2 px-3 text-sm font-medium text-foreground transition-colors duration-150 ease-bench motion-reduce:transition-none",
    current ? "border-primary bg-muted" : "border-transparent hover:bg-muted",
    headerFocusRing,
  );
}

/** A full-width, 44 px row in the phone menu, marked while it is current. */
export function mobileRowClass(current?: "page" | "true"): string {
  return cn(
    "flex min-h-11 items-center rounded-lg border-l-2 px-3 text-base font-medium text-foreground",
    current ? "border-primary bg-muted" : "border-transparent hover:bg-muted",
    headerFocusRing,
  );
}

/** Phone-menu group headings (Practice, Reference, Appearance, Your learning, Account): the label style, 12/16 at weight 500. */
export const MOBILE_GROUP_HEADING_CLASS = "px-3 text-label text-muted-foreground";
