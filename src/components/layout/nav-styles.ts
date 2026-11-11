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
export const OUTLINE_SLOT_CLASS = "flex shrink-0 items-center gap-2 pl-4 sm:pl-6 lg:w-64 lg:pl-5 lg:pr-3 xl:w-72";

/** The frame beside that slot: the page frame, with the left gutter given to the slot below lg. */
export const FRAME_BESIDE_SLOT_CLASS = "mx-auto w-full max-w-7xl pl-2 pr-4 sm:pr-6 lg:px-8";

// ---------------------------------------------------------------------------
// Glass on the layers that float (DESIGN.md section 11)
// ---------------------------------------------------------------------------

/**
 * The light-mode fill of the chrome's glass: white at 82%. The section 11
 * token (white at 62%) is right over the colour field, but lessons scroll
 * code blocks (the always-dark code surface) under the header, the contents
 * bar and the menus, and secondary text needs 4.5:1 over that too. Dark mode
 * keeps the token: the page it floats over is dark as well. A unit test
 * composites both against their worst case.
 */
export const CHROME_GLASS_LIGHT_ALPHA = 0.82;

/**
 * Real glass for a floating layer that carries text: the header bar, menus,
 * popovers, dialogs, sheets and the contents bar. The `glass` utility carries
 * the border, highlight, shadow and blur, and its fallbacks (no
 * backdrop-filter, reduced transparency, forced colours) paint the solid card
 * surface; this only sets the denser light fill through --glass-bg, which
 * the fallbacks do not read. Text on it uses foreground or muted-foreground,
 * never the subtle role.
 */
export const CHROME_GLASS_CLASS = "glass [[data-theme=light]_&]:[--glass-bg:0_0%_100%_/_0.82]";

/**
 * The backdrop behind a modal dialog, sheet or drawer: it dims the page in
 * both modes (no blur, so it never counts as a blurred layer). The panel on
 * it is glass.
 */
export const DIALOG_BACKDROP_CLASS = "bg-black/40 dark:bg-black/55 forced-colors:bg-[Canvas]";

/** The glass bar itself: rounded 16, filling its frame. */
export const HEADER_BAR_CLASS = cn(CHROME_GLASS_CLASS, "h-full w-full rounded-2xl");

/**
 * Where the header's glass bar sits, as a background layer inside the 64 px
 * header (never a layout wrapper): 8 px in from the top and bottom (4 px on
 * the public header's 56 px phone row). With the outline docked the bar spans
 * the viewport less 8 px each side; elsewhere it is the page frame's content
 * box plus 16 px each side, and the viewport less 8 px on phones and tablets
 * (16 px gutters less 8, 24 less 16).
 */
export function headerBarFrameClass(layout: "docked" | "frame" | "public"): string {
  if (layout === "docked") return "absolute inset-x-2 inset-y-2";
  if (layout === "public") return "absolute inset-x-0 inset-y-1 mx-auto max-w-6xl px-2 sm:inset-y-2 lg:px-4";
  return "absolute inset-x-0 inset-y-2 mx-auto max-w-7xl px-2 lg:px-4";
}

/**
 * The sticky header's own box: transparent, so content scrolls under the
 * glass bar; Canvas in forced colours, where the glass is solid anyway.
 */
export const GLASS_HEADER_CLASS = "forced-colors:bg-[Canvas]";

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

/**
 * The surface of every floating menu and popover (Practice, Reference, theme,
 * account, notifications, Jump to, search results): glass, radius 12.
 */
export const MENU_SURFACE_CLASS = cn(CHROME_GLASS_CLASS, "rounded-xl text-popover-foreground");

/** A disclosure's panel: the glass menu surface, faded in over 200 ms. */
export function menuPanelClass(open: boolean): string {
  return cn(
    MENU_SURFACE_CLASS,
    "absolute left-0 top-full z-50 mt-3 w-56 p-1.5 transition-[opacity,visibility] duration-200 ease-bench motion-reduce:transition-none",
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
