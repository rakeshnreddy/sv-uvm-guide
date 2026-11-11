import React from "react";

import FooterLink, { FOOTER_LINK_CLASS } from "@/components/layout/FooterLink";
import { PAGE_FRAME_CLASS } from "@/components/layout/nav-styles";
import ShortcutsHelpButton from "@/components/search/ShortcutsHelpButton";
import { FOOTER_NAV, LEGAL_LINKS, SITE_NAME } from "@/lib/site-links";
import { cn } from "@/lib/utils";

export { FOOTER_LINK_CLASS };

export const SOURCE_REPO_URL = "https://github.com/rakeshnreddy/sv-uvm-guide";

/** Group headings: h2 in the label size (12/16, weight 500), primary text, sentence case, no tracking. */
export const FOOTER_HEADING_CLASS = "px-1 text-label text-foreground";

/** The link groups: two columns on phones, four from 1024 px. The -mx-1 lines the text up with the container edge. */
export const FOOTER_GRID_CLASS =
  "-mx-1 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8";

/**
 * The footer's container: on learning pages the page frame the header and page
 * use (1280 px), so all three share their edges; on the public pages their own
 * 1152 px container (PUBLIC_CONTAINER in PublicHeader.tsx).
 */
export function footerContainerClass(frame: "learning" | "public"): string {
  return cn(frame === "learning" ? PAGE_FRAME_CLASS : "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", "py-10");
}

interface FooterProps {
  /** Show the "Keyboard shortcuts" button. Only the learning layout mounts the shortcuts dialog. */
  showShortcuts?: boolean;
  /** Which container to line up with: the learning page frame or the public pages' container. */
  frame?: "learning" | "public";
}

/**
 * The site footer (SPEC-phases-2-4.md, "Footer"): the four link groups from
 * FOOTER_NAV, so no page, the privacy and terms pages included, is a dead end,
 * then one closing line with the site name, the licence, the source and the
 * legal pages. Every label and href comes from src/lib/site-links.ts. The
 * link to the open page carries aria-current="page".
 */
const Footer = ({ showShortcuts = false, frame = "public" }: FooterProps) => {
  return (
    <footer className="border-t border-border bg-card text-ui text-muted-foreground print:hidden">
      <div className={footerContainerClass(frame)} data-footer-frame={frame}>
        <nav aria-label="Site map" className={FOOTER_GRID_CLASS}>
          {FOOTER_NAV.map((group) => (
            <div key={group.label} className="min-w-0">
              <h2 className={FOOTER_HEADING_CLASS}>{group.label}</h2>
              <ul className="mt-2">
                {group.children.map((link) => (
                  <li key={link.href}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-4">
          <ul
            data-testid="footer-closing-line"
            className="-mx-1 flex flex-wrap items-center gap-x-4"
          >
            <li className="px-1 text-ui font-medium text-foreground">
              {SITE_NAME}
            </li>
            <li className="px-1">MIT licensed</li>
            <li>
              <a href={SOURCE_REPO_URL} className={FOOTER_LINK_CLASS}>
                Source on GitHub
              </a>
            </li>
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLink link={link} />
              </li>
            ))}
            {showShortcuts && (
              <li>
                <ShortcutsHelpButton className="min-h-10 px-1 py-0 text-muted-foreground" />
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
