/**
 * Looks up a destination's one label in the navigation config
 * (src/lib/site-links.ts), so page titles, breadcrumbs and the learner tab
 * strip never type a label by hand. Plain data: safe in client components.
 */
import { FOOTER_NAV, LEGAL_LINKS, PRIMARY_NAV, PUBLIC_NAV, isNavGroup, type NavLink } from "@/lib/site-links";

/** Every link in the config, menus first, so /practice resolves to its menu label "Practice hub". */
const ALL_LINKS: readonly NavLink[] = [
  ...PRIMARY_NAV.flatMap((item) => (isNavGroup(item) ? item.children : [item])),
  ...FOOTER_NAV.flatMap((group) => group.children),
  ...PUBLIC_NAV,
  ...LEGAL_LINKS,
];

/** The nav link for `href`. Throws for an href that is not in the config, so a typo fails the build. */
export function siteLink(href: string): NavLink {
  const link = ALL_LINKS.find((entry) => entry.href === href);
  if (!link) throw new Error(`${href} is not a destination in src/lib/site-links.ts`);
  return { label: link.label, href: link.href };
}

/** The label of the destination at `href`. */
export function siteLabel(href: string): string {
  return siteLink(href).label;
}

