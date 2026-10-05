"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Bell, Menu, PanelLeft, Search, UserCircle, X } from "lucide-react";

import { useOutlineToggle } from "@/components/layout/Sidebar";
import SearchCombobox from "@/components/search/SearchCombobox";
import SearchDialog from "@/components/search/SearchDialog";
import { MODAL_LAYER, shellStore, useMinWidth, useShellState } from "@/components/search/shell-store";
import { useModalDialog } from "@/components/search/useModalDialog";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimestamp, NOTIFICATION_CATEGORY_META, type NotificationItem } from "@/lib/notifications";
import { INTERVIEW_PREP_HREF, LABS_HREF, START_HERE_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";
import { featureFlags } from "@/tools/featureFlags";

interface NavLink {
  label: string;
  href: string;
  /**
   * In the desktop bar only from xl (1280 px), where it fits beside the search
   * field. Below that it stays in the phone menu and in the course outline's
   * quick links.
   */
  wideOnly?: boolean;
}

/** The main navigation, in order (G30-SIDE-05, G30-PATH-07). */
const navLinks: readonly NavLink[] = [
  { label: "Start here", href: START_HERE_HREF },
  { label: "Curriculum", href: "/curriculum" },
  { label: "Practice", href: "/practice" },
  { label: "Labs", href: LABS_HREF, wideOnly: true },
  { label: "Interview prep", href: INTERVIEW_PREP_HREF, wideOnly: true },
  ...(featureFlags.tracking ? [{ label: "Dashboard", href: "/dashboard" }] : []),
  ...(featureFlags.community ? [{ label: "Community", href: "/community" }] : []),
];

const MD_MIN_WIDTH = 768;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const iconButton = cn(
  "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted motion-reduce:transition-none",
  focusRing,
);

const popoverPanel =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl";

/**
 * aria-current for a navbar link: "page" on the page itself, "true" inside its
 * section. A link to a part of a page (/curriculum#routes) never marks the
 * page; that page's own link does.
 */
export function navLinkCurrent(pathname: string | null, href: string): "page" | "true" | undefined {
  if (!pathname || href.includes("#")) return undefined;
  if (pathname === href) return "page";
  if (pathname.startsWith(`${href}/`)) return "true";
  return undefined;
}

/** Closes a popover on Escape (returning focus to its button) or on a pointer press outside it. */
function useDismiss(open: boolean, containerRef: RefObject<HTMLElement>, buttonRef: RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, containerRef, buttonRef, close]);
}

/** Account menu: shown only when the accountUI flag is on (G30-SIDE-06, G30-SIDE-V07). Opens on click, Enter or Space. */
function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, buttonRef, close);

  const itemClass = cn("block rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted", focusRing);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={iconButton}
        data-testid="user-profile-button"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <UserCircle aria-hidden="true" className="h-5 w-5" />
      </button>
      {open && (
        <div id={panelId} className={cn(popoverPanel, "w-64 p-3")}>
          <p className="px-2 text-sm font-semibold text-foreground">
            {user ? user.displayName || "Signed in" : "Not signed in"}
          </p>
          <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
            {featureFlags.tracking && (
              <li>
                <Link href="/dashboard" className={itemClass} onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
              </li>
            )}
            <li>
              <Link href="/settings" className={itemClass} onClick={() => setOpen(false)}>
                Settings
              </Link>
            </li>
            {user && (
              <li>
                <button
                  type="button"
                  className={cn(itemClass, "w-full text-left")}
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                  }}
                >
                  Sign out
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Notification feed: shown only when the accountUI flag is on (G30-SIDE-V07). */
function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, buttonRef, close);
  const hasUnread = items.some((notification) => notification.unread);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/me/notifications?limit=4", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load notifications");
        const payload = await response.json();
        if (isMounted) setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
      } catch (err) {
        if (!isMounted || (err as Error).name === "AbortError") return;
        setError("Unable to load notifications");
        setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNotifications();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={iconButton}
        data-testid="notification-button"
        aria-label={hasUnread ? "Notifications, unread items" : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {hasUnread && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
        )}
      </button>
      {open && (
        <div id={panelId} className={cn(popoverPanel, "w-80 max-w-[calc(100vw-2rem)]")}>
          <p className="border-b border-border p-3 text-sm font-semibold text-foreground">Notifications</p>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="p-4 text-sm text-muted-foreground">Loading notifications…</p>}
            {!loading && error && <p className="p-4 text-sm text-foreground">Error: {error}</p>}
            {!loading && !error && items.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">You’re all caught up</p>
                <p className="text-xs">We’ll nudge you when new activity arrives.</p>
              </div>
            )}
            {!loading && !error && items.length > 0 && (
              <ul className="divide-y divide-border">
                {items.map((notification) => {
                  const meta = NOTIFICATION_CATEGORY_META[notification.category];
                  return (
                    <li key={notification.id} className="p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {notification.unread && <span className="sr-only">Unread: </span>}
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {meta?.label ?? "Update"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatTimestamp(notification.timestamp)}</span>
                        {notification.href && (
                          <Link href={notification.href} className="text-xs font-medium text-foreground underline-offset-2 hover:underline">
                            Open
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-2 text-center">
            <Link href="/notifications" className="text-xs font-medium text-foreground underline-offset-2 hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMenuPanel({ pathname }: { pathname: string | null }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalDialog(panelRef, { onClose: shellStore.closeMenu });

  return (
    <div className={cn("fixed inset-0 md:hidden", MODAL_LAYER)}>
      <div aria-hidden="true" className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={shellStore.closeMenu} />
      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="mobile-menu"
        className="absolute inset-y-0 right-0 flex w-4/5 max-w-sm flex-col border-l border-border bg-background text-foreground shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 id={titleId} className="text-lg font-semibold">
            Menu
          </h2>
          <button type="button" onClick={shellStore.closeMenu} className={iconButton} aria-label="Close menu">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navLinks.map((link) => {
              const current = navLinkCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current}
                    onClick={shellStore.closeMenu}
                    className={cn(
                      "flex min-h-11 items-center rounded-xl border-l-4 px-3 text-lg",
                      current ? "border-primary bg-muted font-semibold text-foreground" : "border-transparent text-foreground hover:bg-muted",
                      focusRing,
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/**
 * Site header for the learning pages: the course outline button, the logo,
 * curriculum search (an inline field from md, a dialog on phones), the main
 * links, the theme switch, and, only when the accountUI flag is on, the
 * notification and account menus.
 */
const Navbar = () => {
  const pathname = usePathname();
  const outline = useOutlineToggle();
  const searchOpen = useShellState((state) => state.searchOpen);
  const menuOpen = useShellState((state) => state.menuOpen);
  const mdUp = useMinWidth(MD_MIN_WIDTH);

  // The phone menu is md:hidden; never leave it open (and trapping focus) on a wider window.
  useEffect(() => {
    if (mdUp && menuOpen) shellStore.closeMenu();
  }, [mdUp, menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={outline.toggle}
            className={iconButton}
            data-outline-toggle
            aria-label="Course outline"
            aria-expanded={outline.expanded}
            aria-controls={outline.controls}
            aria-keyshortcuts="Control+B Meta+B"
          >
            <PanelLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <Link href="/" aria-label="SV/UVM Hub home" className={cn("block w-32 shrink-0 rounded-lg sm:w-[150px]", focusRing)}>
            <Logo />
          </Link>

          <div role="search" aria-label="Curriculum" className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
            <div className="w-full max-w-md">
              <SearchCombobox variant="popup" commandTarget testId="main-search-input" />
            </div>
          </div>

          <nav aria-label="Main" className="hidden items-center gap-1 md:ml-auto md:flex lg:ml-0">
            {navLinks.map((link) => {
              const current = navLinkCurrent(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current}
                  className={cn(
                    link.wideOnly ? "hidden xl:inline-flex" : "inline-flex",
                    "h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors motion-reduce:transition-none",
                    current ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    focusRing,
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={shellStore.openSearch}
              className={cn(iconButton, "lg:hidden")}
              aria-label="Search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <Search aria-hidden="true" className="h-5 w-5" />
            </button>
            <span aria-hidden="true" className="mx-1 h-6 border-l border-border" />
            <ThemeSwitcher />
            {featureFlags.accountUI && (
              <>
                <NotificationCenter />
                <UserMenu />
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={shellStore.openSearch}
              className={iconButton}
              aria-label="Search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <Search aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={shellStore.openMenu}
              className={iconButton}
              aria-label="Open main menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <MobileMenuPanel pathname={pathname} />}
      <SearchDialog />
    </>
  );
};

export default Navbar;
