"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Bell, ChevronDown, Menu, PanelLeft, Search, UserCircle, X } from "lucide-react";

import { useOutlineToggle } from "@/components/layout/Sidebar";
import SearchCombobox from "@/components/search/SearchCombobox";
import SearchDialog from "@/components/search/SearchDialog";
import { MODAL_LAYER, shellStore, useMinWidth, useShellState } from "@/components/search/shell-store";
import { useModalDialog } from "@/components/search/useModalDialog";
import { headerFocusRing, iconButtonClass, iconButtonIconClass } from "@/components/ui/icon-button-class";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimestamp, NOTIFICATION_CATEGORY_META, type NotificationItem } from "@/lib/notifications";
import { useAccountSession, useServerFeature, type AccountSessionStatus } from "@/lib/persistence/target";
import { SITE_FEATURES, type SiteFeatureSwitches } from "@/lib/site-features";
import { INTERVIEW_PREP_HREF, LABS_HREF, PLACEMENT_QUIZ_HREF, START_HERE_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  /**
   * In the desktop bar only from xl (1280 px), where it fits beside the search
   * field. From md to xl the bar's "More" disclosure lists it and on phones the
   * phone menu does. Labs, Interview prep and Dashboard are also always in the
   * course outline's quick links.
   */
  wideOnly?: boolean;
}

/**
 * The main navigation, in order (G30-SIDE-05, G30-PATH-07). Dashboard is
 * always listed: it shows the progress kept in this browser, so it needs no
 * account. Community is listed only while SITE_FEATURES.community is on, which
 * also needs accounts. The switches are fixed at build time, so the server
 * render and hydration list the same links.
 */
export function mainNavLinks(features: Pick<SiteFeatureSwitches, "community"> = SITE_FEATURES): readonly NavLink[] {
  return [
    { label: "Start here", href: START_HERE_HREF },
    { label: "Curriculum", href: "/curriculum" },
    { label: "Practice", href: "/practice" },
    { label: "Labs", href: LABS_HREF, wideOnly: true },
    { label: "Interview prep", href: INTERVIEW_PREP_HREF, wideOnly: true },
    { label: "Dashboard", href: "/dashboard", wideOnly: true },
    ...(features.community ? [{ label: "Community", href: "/community", wideOnly: true }] : []),
  ];
}

/**
 * NextAuth's sign-in page, returning to `pathname` afterwards. Offered only while
 * accounts are on. The client cannot tell whether the server's persistence gate
 * is open: on a half-configured deploy (accounts on, isServerPersistenceConfigured()
 * false) this link answers 404 {error: "ACCOUNTS_DISABLED"}, so the runbook
 * (docs/deploy/cloudflare.md) has every account piece configured in one deploy.
 */
export function signInHref(pathname: string | null): string {
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`;
}

/**
 * The learner's own pages, listed in the phone menu under "Your learning"
 * whatever the accounts switch says: settings (theme, and export, import or
 * reset of the progress kept in this browser), the self-assessment and the
 * placement quiz. On wider windows the footer and the dashboard link to them.
 */
export const LEARNER_MENU_LINKS: readonly NavLink[] = [
  { label: "Settings", href: "/settings" },
  { label: "Self-assessment", href: "/assessment" },
  { label: "Find your level", href: PLACEMENT_QUIZ_HREF },
];

const MD_MIN_WIDTH = 768;

const focusRing = headerFocusRing;

/** Every header icon button (and the theme control) shares this style. */
const iconButton = iconButtonClass;

/** Phone-menu group headings (Appearance, Your learning, Account): the label style, 12/16 at weight 500. */
export const MOBILE_GROUP_HEADING_CLASS = "px-3 text-label text-muted-foreground";

/**
 * A main-nav link in the bar (and the "More" button). Every link is set at
 * weight 500, so the row never moves between pages; the current one is marked
 * only by the primary text colour and the 2 px accent underline.
 */
export function barLinkClass(current: boolean): string {
  return cn(
    "h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none lg:px-3",
    current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    focusRing,
  );
}

const popoverPanel =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-card";

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

/**
 * "More" for the links that join the desktop bar only from xl. Between md and
 * xl there is no room for them beside the search field, so this disclosure
 * lists them (WAI-ARIA disclosure navigation, not a menu).
 */
function MoreLinks({ pathname, links }: { pathname: string | null; links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, buttonRef, close);
  useEffect(() => close(), [pathname, close]);
  const active = links.some((link) => navLinkCurrent(pathname, link.href));

  return (
    <div ref={containerRef} className="relative xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn("inline-flex gap-1", barLinkClass(active))}
      >
        More
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div id={panelId} hidden={!open} className={cn(popoverPanel, "w-52 p-2")}>
        <ul className="space-y-0.5">
          {links.map((link) => {
            const current = navLinkCurrent(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current}
                  onClick={close}
                  className={cn(
                    "block rounded-lg border-l-2 px-3 py-2 text-sm text-foreground",
                    current ? "border-primary bg-muted font-medium" : "border-transparent hover:bg-muted",
                    focusRing,
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Account menu: shown only while accounts are on (SITE_FEATURES.accounts;
 * G30-SIDE-06, G30-SIDE-V07). Opens on click, Enter or Space. A signed-out
 * visitor is offered "Sign in", which comes back to this page; a signed-in
 * learner gets "Sign out".
 */
function UserMenu({ pathname }: { pathname: string | null }) {
  const { user, signOut } = useAuth();
  const { status } = useAccountSession();
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
        <UserCircle aria-hidden="true" className={iconButtonIconClass} />
      </button>
      {open && (
        <div id={panelId} className={cn(popoverPanel, "w-64 p-3")}>
          <p className="px-2 text-sm font-semibold text-foreground">
            {user ? user.displayName || "Signed in" : status === "loading" ? "Checking sign-in…" : "Not signed in"}
          </p>
          <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
            <li>
              <Link href="/dashboard" className={itemClass} onClick={() => setOpen(false)}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/settings" className={itemClass} onClick={() => setOpen(false)}>
                Settings
              </Link>
            </li>
            {!user && status === "unauthenticated" && (
              <li>
                {/* A plain link: NextAuth's sign-in page is not an app route, so it needs a full page load. */}
                <a href={signInHref(pathname)} className={itemClass} onClick={() => setOpen(false)}>
                  Sign in
                </a>
              </li>
            )}
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

/**
 * Notification feed: mounted, and so fetching /api/me/notifications, only for
 * a signed-in learner while accounts are on (useServerFeature("notifications");
 * G30-SIDE-V07). Signed-out visitors never request it.
 */
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
        <Bell aria-hidden="true" className={iconButtonIconClass} />
        {hasUnread && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
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
                <p className="text-label">We’ll nudge you when new activity arrives.</p>
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
                          <p className="mt-1 text-label text-muted-foreground">{notification.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-label text-muted-foreground">
                          {meta?.label ?? "Update"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-label text-muted-foreground">
                        <span>{formatTimestamp(notification.timestamp)}</span>
                        {notification.href && (
                          <Link href={notification.href} className="text-label text-foreground underline-offset-2 hover:underline">
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
            <Link href="/notifications" className="text-label text-foreground underline-offset-2 hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** A full-width, 44 px row in the phone menu, marked while it is the current page. */
function mobileRowClass(current?: "page" | "true") {
  return cn(
    "flex min-h-11 items-center rounded-lg border-l-2 px-3 text-lg font-medium text-foreground",
    current ? "border-primary bg-muted" : "border-transparent hover:bg-muted",
    focusRing,
  );
}

/** What the phone menu says about the session: the same states as UserMenu, in a sentence. */
function mobileAccountStatus(user: { displayName?: string | null } | null, status: AccountSessionStatus): string {
  if (user) return user.displayName ? `Signed in as ${user.displayName}` : "Signed in";
  return status === "loading" ? "Checking sign-in…" : "Not signed in";
}

/**
 * The account items on phones. The account menu and the notification bell sit
 * in the bar's md-and-up group, so below 768 px the phone menu carries them;
 * it renders this only while accounts are on (SITE_FEATURES.accounts). It
 * follows UserMenu: "Sign in", back to this page, once the session check says
 * nobody is signed in; "Sign out" for a signed-in learner; neither while the
 * check runs. Dashboard is already a main link and Settings is under "Your
 * learning" in the same menu, so neither is repeated here. Notifications is a link to /notifications, shown only to a
 * signed-in learner (useServerFeature), so this menu never fetches the feed.
 */
function MobileAccountItems({ pathname }: { pathname: string | null }) {
  const { user, signOut } = useAuth();
  const { status } = useAccountSession();
  const notificationsOn = useServerFeature("notifications");
  // Settings is in the menu's "Your learning" group for everyone, so it is not repeated here.
  const accountLinks = notificationsOn ? [{ label: "Notifications", href: "/notifications" }] : [];

  return (
    <div data-testid="mobile-account" className="mt-4 border-t border-border pt-4">
      <h3 className={MOBILE_GROUP_HEADING_CLASS}>Account</h3>
      <p aria-live="polite" className="mt-1 break-words px-3 text-sm text-foreground">
        {mobileAccountStatus(user, status)}
      </p>
      <ul className="mt-2 space-y-1 empty:hidden">
        {accountLinks.map((link) => {
          const current = navLinkCurrent(pathname, link.href);
          return (
            <li key={link.href}>
              <Link href={link.href} aria-current={current} onClick={shellStore.closeMenu} className={mobileRowClass(current)}>
                {link.label}
              </Link>
            </li>
          );
        })}
        {!user && status === "unauthenticated" && (
          <li>
            {/* A plain link: NextAuth's sign-in page is not an app route, so it needs a full page load. */}
            <a href={signInHref(pathname)} onClick={shellStore.closeMenu} className={mobileRowClass()}>
              Sign in
            </a>
          </li>
        )}
        {user && (
          <li>
            <button
              type="button"
              className={cn(mobileRowClass(), "w-full text-left")}
              onClick={async () => {
                shellStore.closeMenu();
                await signOut();
              }}
            >
              Sign out
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function MobileMenuPanel({ pathname, links }: { pathname: string | null; links: readonly NavLink[] }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const appearanceId = useId();
  const learningId = useId();
  useModalDialog(panelRef, { onClose: shellStore.closeMenu });

  return (
    <div className={cn("fixed inset-0 md:hidden", MODAL_LAYER)}>
      <div aria-hidden="true" data-testid="mobile-menu-backdrop" className="absolute inset-0 bg-background/80" onClick={shellStore.closeMenu} />
      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="mobile-menu"
        className="absolute inset-y-0 right-0 flex w-4/5 max-w-sm flex-col border-l border-border bg-background text-foreground shadow-card focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 id={titleId} className="text-lg font-semibold">
            Menu
          </h2>
          <button type="button" onClick={shellStore.closeMenu} className={iconButton} aria-label="Close menu">
            <X aria-hidden="true" className={iconButtonIconClass} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Below md the outline is always a drawer; opening it closes this menu (one modal at a time). */}
          <button
            type="button"
            onClick={shellStore.openOutline}
            aria-haspopup="dialog"
            data-testid="mobile-menu-outline"
            className={cn(mobileRowClass(), "mb-4 w-full gap-3 border border-border text-left")}
          >
            <PanelLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
            Course outline
          </button>
          <nav aria-label="Main">
            <ul className="space-y-1">
              {links.map((link) => {
                const current = navLinkCurrent(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link href={link.href} aria-current={current} onClick={shellStore.closeMenu} className={mobileRowClass(current)}>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <section aria-labelledby={appearanceId} data-testid="mobile-appearance" className="mt-4 border-t border-border pt-4">
            <h3 id={appearanceId} className={MOBILE_GROUP_HEADING_CLASS}>
              Appearance
            </h3>
            <div className="mt-2 px-3">
              <ThemeSwitcher layout="menu" />
            </div>
          </section>
          <nav aria-labelledby={learningId} data-testid="mobile-learning" className="mt-4 border-t border-border pt-4">
            <h3 id={learningId} className={MOBILE_GROUP_HEADING_CLASS}>
              Your learning
            </h3>
            <ul className="mt-2 space-y-1">
              {LEARNER_MENU_LINKS.map((link) => {
                const current = navLinkCurrent(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link href={link.href} aria-current={current} onClick={shellStore.closeMenu} className={mobileRowClass(current)}>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {SITE_FEATURES.accounts && <MobileAccountItems pathname={pathname} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Site header for the learning pages: the course outline button, the logo,
 * curriculum search (an inline field from lg, a dialog below it), the main
 * links, the theme switch, and, only while accounts are on, the account menu
 * and (for a signed-in learner) the notification feed. Below md the phone menu
 * holds a course outline row, the main links, the theme controls, the
 * learner's own pages and, while accounts are on, the account items.
 *
 * From md to lg the bar has 720 px of room at 768 px, so the links and the
 * controls are spaced more tightly there and the divider is hidden: the default
 * bar then needs about 700 px. With accounts on, the account menu (and, signed
 * in, the bell) add about 44 px each and do not fit yet at 768 px; check this layout
 * when accounts are turned on.
 */
const Navbar = () => {
  const pathname = usePathname();
  const navLinks = mainNavLinks();
  const wideLinks = navLinks.filter((link) => link.wideOnly);
  const notificationsOn = useServerFeature("notifications");
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
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background text-foreground">
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
            <PanelLeft aria-hidden="true" className={iconButtonIconClass} />
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
                  className={cn(link.wideOnly ? "hidden xl:inline-flex" : "inline-flex", barLinkClass(Boolean(current)))}
                >
                  {link.label}
                </Link>
              );
            })}
            {wideLinks.length > 0 && <MoreLinks pathname={pathname} links={wideLinks} />}
          </nav>

          <div className="hidden items-center gap-1 md:flex lg:gap-2">
            <button
              type="button"
              onClick={shellStore.openSearch}
              className={cn(iconButton, "lg:hidden")}
              aria-label="Search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <Search aria-hidden="true" className={iconButtonIconClass} />
            </button>
            <span aria-hidden="true" className="mx-1 hidden h-6 border-l border-border lg:block" />
            <ThemeSwitcher />
            {SITE_FEATURES.accounts && (
              <>
                {notificationsOn && <NotificationCenter />}
                <UserMenu pathname={pathname} />
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
              <Search aria-hidden="true" className={iconButtonIconClass} />
            </button>
            <button
              type="button"
              onClick={shellStore.openMenu}
              className={iconButton}
              aria-label="Open main menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Menu aria-hidden="true" className={iconButtonIconClass} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <MobileMenuPanel pathname={pathname} links={navLinks} />}
      <SearchDialog />
    </>
  );
};

export default Navbar;
