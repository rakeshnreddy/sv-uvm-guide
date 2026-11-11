"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, Menu, PanelLeft, Search, UserCircle, X } from "lucide-react";

import NavDisclosure from "@/components/layout/NavDisclosure";
import { currentChild, navLinkCurrent, topItemCurrent, yourLearningLinks } from "@/components/layout/nav-current";
import {
  CHROME_GLASS_CLASS,
  DIALOG_BACKDROP_CLASS,
  FRAME_BESIDE_SLOT_CLASS,
  GLASS_HEADER_CLASS,
  HEADER_BAR_CLASS,
  MENU_SURFACE_CLASS,
  MOBILE_GROUP_HEADING_CLASS,
  OUTLINE_SLOT_CLASS,
  PAGE_FRAME_CLASS,
  barLinkClass,
  headerBarFrameClass,
  mobileRowClass,
} from "@/components/layout/nav-styles";
import { useDismiss } from "@/components/layout/use-dismiss";
import { useOutlineToggle } from "@/components/layout/Sidebar";
import { isLessonPath } from "@/components/search/course-outline";
import SearchCombobox from "@/components/search/SearchCombobox";
import SearchDialog from "@/components/search/SearchDialog";
import { LG_MIN_WIDTH, MODAL_LAYER, shellStore, useMinWidth, useShellState } from "@/components/search/shell-store";
import { useModalDialog } from "@/components/search/useModalDialog";
import { headerFocusRing, iconButtonClass, iconButtonIconClass } from "@/components/ui/icon-button-class";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimestamp, NOTIFICATION_CATEGORY_META, type NotificationItem } from "@/lib/notifications";
import { useAccountSession, useServerFeature, type AccountSessionStatus } from "@/lib/persistence/target";
import { SITE_FEATURES } from "@/lib/site-features";
import { DASHBOARD_HREF, PRIMARY_NAV, SETTINGS_HREF, SITE_NAME, isNavGroup, type NavLink } from "@/lib/site-links";
import { cn } from "@/lib/utils";

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

const focusRing = headerFocusRing;

/** Every header icon button (and the theme control) shares this style. */
const iconButton = iconButtonClass;

/** The account menu's and the notification feed's panels. */
const popoverPanel = cn(MENU_SURFACE_CLASS, "absolute right-0 top-full z-50 mt-3 overflow-hidden");

/** The accessible name of the wordmark link. */
export const HOME_LINK_LABEL = `${SITE_NAME} home`;

/**
 * Where the search field and its dialog button show. The field shows from md;
 * while the outline is docked (lesson pages, lg and wider) the main column is
 * too narrow for it beside the five items until xl, so the button stands in
 * for it from lg to xl.
 */
export function searchVisibility(docked: boolean): { field: string; button: string } {
  return docked
    ? { field: "hidden md:flex lg:hidden xl:flex", button: "md:hidden lg:inline-flex xl:hidden" }
    : { field: "hidden md:flex", button: "md:hidden" };
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
          <ul className="mt-2 space-y-0.5 border-t border-glass-border pt-2">
            <li>
              <Link href={DASHBOARD_HREF} className={itemClass} onClick={() => setOpen(false)}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href={SETTINGS_HREF} className={itemClass} onClick={() => setOpen(false)}>
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
          <p className="border-b border-glass-border p-3 text-sm font-semibold text-foreground">Notifications</p>
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
              <ul className="divide-y divide-glass-border">
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
          <div className="border-t border-glass-border p-2 text-center">
            <Link href="/notifications" className="text-label text-foreground underline-offset-2 hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
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
    <div data-testid="mobile-account" className="mt-4 border-t border-glass-border pt-4">
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
/** One link row in the phone menu, closing the menu when followed. */
function MobileLinkRow({ link, current }: { link: NavLink; current: "page" | "true" | undefined }) {
  return (
    <Link href={link.href} aria-current={current} onClick={shellStore.closeMenu} className={mobileRowClass(current)}>
      {link.label}
    </Link>
  );
}

/**
 * The phone menu's main items, from PRIMARY_NAV: plain items as rows, and each
 * disclosure's children listed under its group label.
 */
function MobileMainNav({ pathname }: { pathname: string | null }) {
  const groupId = useId();
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {PRIMARY_NAV.map((item, index) => {
          if (!isNavGroup(item)) {
            return (
              <li key={item.href}>
                <MobileLinkRow link={item} current={topItemCurrent(pathname, item)} />
              </li>
            );
          }
          const headingId = `${groupId}-${index}`;
          const marked = currentChild(pathname, item.children);
          return (
            <li key={item.label} className="pb-1 pt-3">
              <h3 id={headingId} className={MOBILE_GROUP_HEADING_CLASS}>
                {item.label}
              </h3>
              <ul aria-labelledby={headingId} className="mt-1 space-y-1">
                {item.children.map((link) => (
                  <li key={link.href}>
                    <MobileLinkRow link={link} current={marked?.href === link.href ? marked.current : undefined} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileMenuPanel({ pathname }: { pathname: string | null }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const appearanceId = useId();
  const learningId = useId();
  useModalDialog(panelRef, { onClose: shellStore.closeMenu });

  return (
    <div className={cn("fixed inset-0 lg:hidden", MODAL_LAYER)}>
      <div aria-hidden="true" data-testid="mobile-menu-backdrop" className={cn("absolute inset-0", DIALOG_BACKDROP_CLASS)} onClick={shellStore.closeMenu} />
      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="mobile-menu"
        className={cn(
          CHROME_GLASS_CLASS,
          "absolute inset-y-2 right-2 flex w-[calc(80%-0.5rem)] max-w-sm flex-col rounded-2xl text-foreground focus:outline-none",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-glass-border p-4">
          <h2 id={titleId} className="text-lg font-semibold">
            Menu
          </h2>
          <button type="button" onClick={shellStore.closeMenu} className={iconButton} aria-label="Close menu">
            <X aria-hidden="true" className={iconButtonIconClass} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Below lg the outline is always a drawer; opening it closes this menu (one modal at a time). */}
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
          <MobileMainNav pathname={pathname} />
          <section aria-labelledby={appearanceId} data-testid="mobile-appearance" className="mt-4 border-t border-glass-border pt-4">
            <h3 id={appearanceId} className={MOBILE_GROUP_HEADING_CLASS}>
              Appearance
            </h3>
            <div className="mt-2 px-3">
              <ThemeSwitcher layout="menu" />
            </div>
          </section>
          <nav aria-labelledby={learningId} data-testid="mobile-learning" className="mt-4 border-t border-glass-border pt-4">
            <h3 id={learningId} className={MOBILE_GROUP_HEADING_CLASS}>
              Your learning
            </h3>
            <ul className="mt-2 space-y-1">
              {yourLearningLinks().map((link) => (
                <li key={link.href}>
                  <MobileLinkRow link={link} current={navLinkCurrent(pathname, link.href)} />
                </li>
              ))}
            </ul>
          </nav>
          {SITE_FEATURES.accounts && <MobileAccountItems pathname={pathname} />}
        </div>
      </div>
    </div>
  );
}

/** The five top-level items from PRIMARY_NAV, in the bar from lg. */
function BarNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="hidden shrink-0 items-center gap-1 lg:flex">
      {PRIMARY_NAV.map((item) =>
        isNavGroup(item) ? (
          <NavDisclosure key={item.label} group={item} pathname={pathname} />
        ) : (
          <Link key={item.href} href={item.href} aria-current={topItemCurrent(pathname, item)} className={barLinkClass(Boolean(topItemCurrent(pathname, item)))}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/**
 * Site header for the learning pages: one opaque 64 px row with a hairline
 * below. Left, the course outline button (lesson pages, where the outline
 * exists) and the wordmark; then the search field (it grows to 420 px); then
 * the five main items from PRIMARY_NAV (from lg); the theme control on the
 * right; and, only while accounts are on, the account menu and (signed in)
 * the notification feed.
 *
 * The header lines up with the page. While the outline is docked, the left
 * slot is exactly as wide as the outline column and the rest of the row uses
 * the main column's frame, so the search field starts at the lesson's left
 * edge. Elsewhere the row uses the page frame MainLayout uses (PAGE_FRAME_CLASS).
 *
 * Below lg the five items do not fit, so the menu button opens the phone menu:
 * the same items, the Practice and Reference children under group labels,
 * then Appearance, Your learning and, while accounts are on, the account items.
 */
const Navbar = () => {
  const pathname = usePathname();
  const notificationsOn = useServerFeature("notifications");
  const outline = useOutlineToggle();
  const searchOpen = useShellState((state) => state.searchOpen);
  const menuOpen = useShellState((state) => state.menuOpen);
  const collapsed = useShellState((state) => state.outlineCollapsed);
  const lgUp = useMinWidth(LG_MIN_WIDTH);

  const hasOutline = isLessonPath(pathname);
  // Docked from lg on lesson pages unless the learner hid it; CSS handles the breakpoint.
  const docked = hasOutline && !collapsed;
  const search = searchVisibility(docked);

  // The phone menu is lg:hidden; never leave it open (and trapping focus) on a wider window.
  useEffect(() => {
    if (lgUp && menuOpen) shellStore.closeMenu();
  }, [lgUp, menuOpen]);

  const brand = (
    <>
      {hasOutline && (
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
      )}
      <Link href="/" aria-label={HOME_LINK_LABEL} className={cn("inline-flex h-10 shrink-0 items-center rounded-lg px-1", focusRing)}>
        <Logo />
      </Link>
    </>
  );

  const searchButton = (className: string) => (
    <button
      type="button"
      onClick={shellStore.openSearch}
      className={cn(iconButton, className)}
      aria-label="Search"
      aria-haspopup="dialog"
      aria-expanded={searchOpen}
    >
      <Search aria-hidden="true" className={iconButtonIconClass} />
    </button>
  );

  return (
    <>
      <header className={cn("sticky top-0 z-40 h-16 w-full text-foreground print:hidden", GLASS_HEADER_CLASS)}>
        {/* The glass bar: a background layer inside the 64 px row, never a wrapper around its controls. */}
        <div aria-hidden="true" data-header-glass="" className="pointer-events-none absolute inset-0">
          <div className={headerBarFrameClass(docked ? "docked" : "frame")}>
            <div className={HEADER_BAR_CLASS} data-header-bar="" />
          </div>
        </div>
        <div className="relative flex h-full w-full">
          {docked && (
            <div className={OUTLINE_SLOT_CLASS} data-header-slot="outline">
              {brand}
            </div>
          )}
          <div className={cn("flex min-w-0 items-center gap-2", docked ? FRAME_BESIDE_SLOT_CLASS : PAGE_FRAME_CLASS)} data-header-frame>
            {!docked && <div className="flex shrink-0 items-center gap-2">{brand}</div>}

            <div className="flex min-w-0 flex-1 items-center">
              <div role="search" aria-label="Curriculum" className={cn("w-full min-w-0 max-w-[420px]", search.field)}>
                <SearchCombobox variant="popup" commandTarget testId="main-search-input" />
              </div>
            </div>

            <BarNav pathname={pathname} />

            <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-2 lg:gap-2">
              {searchButton(search.button)}
              <span className="hidden md:inline-flex">
                <ThemeSwitcher />
              </span>
              {SITE_FEATURES.accounts && (
                <span className="hidden items-center gap-1 md:inline-flex lg:gap-2">
                  {notificationsOn && <NotificationCenter />}
                  <UserMenu pathname={pathname} />
                </span>
              )}
              <button
                type="button"
                onClick={shellStore.openMenu}
                className={cn(iconButton, "lg:hidden")}
                aria-label="Open main menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
              >
                <Menu aria-hidden="true" className={iconButtonIconClass} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && <MobileMenuPanel pathname={pathname} />}
      <SearchDialog />
    </>
  );
};

export default Navbar;
