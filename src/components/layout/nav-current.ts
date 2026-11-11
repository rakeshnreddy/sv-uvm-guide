/**
 * Which navigation item is current, and the link lists the navbar derives from
 * the one navigation config in src/lib/site-links.ts. Pure functions, so the
 * navbar, its disclosures and the phone menu agree and each rule is testable
 * on its own.
 */
import {
  DASHBOARD_HREF,
  FOOTER_NAV,
  NAV_SECTION_ROUTES,
  YOUR_LEARNING_NAV,
  activeNavLabel,
  isNavGroup,
  type NavItem,
  type NavLink,
} from "@/lib/site-links";

export type AriaCurrent = "page" | "true" | undefined;

/** The path without its query string, hash or trailing slash. */
function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * aria-current for one link: "page" on the page itself, "true" inside its
 * section. A link to a part of a page (/practice#labs) never marks the page;
 * that page's own link does.
 */
export function navLinkCurrent(pathname: string | null | undefined, href: string): AriaCurrent {
  if (!pathname || href.includes("#")) return undefined;
  const path = cleanPath(pathname);
  if (path === href) return "page";
  if (path.startsWith(`${href}/`)) return "true";
  return undefined;
}

/**
 * aria-current for a top-level item, following activeNavLabel(): "page" when
 * the item's own page is open, "true" anywhere else in its section (Dashboard
 * is current on /settings and /assessment too). A disclosure is never "page".
 */
export function topItemCurrent(pathname: string | null | undefined, item: NavItem): AriaCurrent {
  if (activeNavLabel(pathname) !== item.label) return undefined;
  if (!isNavGroup(item) && navLinkCurrent(pathname, item.href) === "page") return "page";
  return "true";
}

/** True when `path` is `base` or below it. */
function under(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/**
 * The longest route in `routes` (NAV_SECTION_ROUTES) that `pathname` is on, or
 * 0: how closely a link to a part of /practice fits the page.
 */
export function sectionRouteMatch(pathname: string | null | undefined, href: string, routes = NAV_SECTION_ROUTES): number {
  if (!pathname) return 0;
  const path = cleanPath(pathname);
  return (routes[href] ?? []).reduce((best, base) => (under(path, base) && base.length > best ? base.length : best), 0);
}

/**
 * The one child of a disclosure to mark on `pathname`: the exact page if it is
 * listed; otherwise the child whose section routes hold the page
 * (/practice/lab/x marks "Labs", /exercises/x "Exercises"); otherwise the
 * closest section above it. A link to a part of a page is never "page".
 */
export function currentChild(
  pathname: string | null | undefined,
  children: readonly NavLink[],
  routes = NAV_SECTION_ROUTES,
): { href: string; current: "page" | "true" } | undefined {
  let best: { href: string; current: "page" | "true" } | undefined;
  let section: { href: string; length: number } | undefined;
  for (const child of children) {
    const current = navLinkCurrent(pathname, child.href);
    if (current === "page") return { href: child.href, current };
    if (current === "true" && (!best || child.href.length > best.href.length)) best = { href: child.href, current };
    const length = sectionRouteMatch(pathname, child.href, routes);
    if (length > 0 && (!section || length > section.length)) section = { href: child.href, length };
  }
  return section ? { href: section.href, current: "true" } : best;
}

/**
 * The phone menu's "Your learning" rows: the footer's group of the same name,
 * less Dashboard, which is already a main item in the same menu.
 */
export function yourLearningLinks(groups = FOOTER_NAV): readonly NavLink[] {
  const group = groups.find((entry) => entry.label === YOUR_LEARNING_NAV.label);
  return (group?.children ?? []).filter((link) => link.href !== DASHBOARD_HREF);
}
