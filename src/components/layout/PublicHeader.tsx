import Link from "next/link";
import React from "react";

import manifest from "../../../content/curriculum/curriculum.manifest.json";
import SkipLink from "@/components/search/SkipLink";
import { headerFocusRing } from "@/components/ui/icon-button-class";
import Logo from "@/components/ui/Logo";
import { PUBLIC_NAV, SITE_NAME } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { GLASS_HEADER_CLASS, HEADER_BAR_CLASS, headerBarFrameClass } from "./nav-styles";
import PublicHeaderControls from "./PublicHeaderControls";
import { lessonPathsFromManifest } from "./public-header-resume";

/**
 * The public pages' container: the content width (1152 px) with the page
 * gutters, 16 px on phones, 24 on tablets and 32 on desktop (DESIGN.md
 * section 5). InfoPage, which the privacy and terms pages use, has the same
 * box, so the wordmark lines up with the page heading below it.
 */
export const PUBLIC_CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/**
 * The header itself: 56 px on phones, 64 px from 640 px, as tall as the
 * learning header, so moving between the two never shifts the page. Sticky
 * and transparent: the page scrolls under its glass bar (DESIGN.md section 11).
 */
export const PUBLIC_HEADER_CLASS = cn("sticky top-0 z-40 h-14 w-full text-foreground sm:h-16 print:hidden", GLASS_HEADER_CLASS);

/** The row inside the header: the container, filling the header's height, above the glass bar. */
export const PUBLIC_HEADER_CONTAINER = cn(PUBLIC_CONTAINER, "relative flex h-full items-center gap-2 sm:gap-4");

/** The wordmark link: a 40 px target, like the learning header's. */
export const PUBLIC_WORDMARK_CLASS = cn("inline-flex h-10 shrink-0 items-center rounded-lg", headerFocusRing);

/** Every lesson in course order, for the accent action; the first is where "Start learning" goes. */
const LESSON_PATHS = lessonPathsFromManifest(manifest);
export const FIRST_LESSON_HREF = LESSON_PATHS[0] ?? "/curriculum";

const linkClass = cn(
  "inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-2 text-ui font-medium text-muted-foreground transition-colors duration-150 ease-bench hover:text-foreground motion-reduce:transition-none",
  headerFocusRing,
);

/**
 * The header for the landing, privacy and terms pages (route group (public)):
 * skip link, wordmark home, the three public links, a search button that
 * opens the site search, the theme menu button and one accent action, "Start
 * learning", which reads "Continue" once this browser holds a lesson position.
 * Below 768 px the row keeps the wordmark, search and a menu button; the menu
 * lists the same links, the accent action and the theme choices.
 *
 * A transparent sticky row over a rounded glass bar (a background layer, as
 * in the learning header). A server component: the controls are one small
 * client island that server-renders at its final size.
 */
export default function PublicHeader() {
  return (
    <>
      <SkipLink />
      <header data-testid="public-header" className={PUBLIC_HEADER_CLASS}>
        <div aria-hidden="true" data-header-glass="" className="pointer-events-none absolute inset-0">
          <div className={headerBarFrameClass("public")}>
            <div className={HEADER_BAR_CLASS} data-header-bar="" />
          </div>
        </div>
        <div className={PUBLIC_HEADER_CONTAINER}>
          <Link href="/" aria-label={`${SITE_NAME} home`} className={PUBLIC_WORDMARK_CLASS}>
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-auto hidden md:block">
            <ul className="flex items-center gap-1">
              {PUBLIC_NAV.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto md:ml-0">
            <PublicHeaderControls links={PUBLIC_NAV} firstLessonHref={FIRST_LESSON_HREF} lessonPaths={LESSON_PATHS} />
          </div>
        </div>
      </header>
    </>
  );
}
