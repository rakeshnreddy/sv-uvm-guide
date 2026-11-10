import Link from "next/link";
import React from "react";

import SkipLink from "@/components/search/SkipLink";
import { headerFocusRing } from "@/components/ui/icon-button-class";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { INTERVIEW_PREP_HREF } from "@/lib/site-links";
import { cn } from "@/lib/utils";

interface PublicHeaderLink {
  label: string;
  href: string;
  /** Shown from 640 px only; below it the row keeps the wordmark, Curriculum and the theme control. */
  wideOnly?: boolean;
}

/** The public header's links, in order. */
export const PUBLIC_HEADER_LINKS: readonly PublicHeaderLink[] = [
  { label: "Curriculum", href: "/curriculum" },
  { label: "Practice", href: "/practice", wideOnly: true },
  { label: "Interview prep", href: INTERVIEW_PREP_HREF, wideOnly: true },
];

/**
 * The container the landing sections use (HeroSection: max-w-6xl, 24 px
 * gutters from 640 px), so the wordmark lines up with the hero's left edge.
 */
export const PUBLIC_HEADER_CONTAINER = "mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6";

const linkClass = cn(
  "h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-2 text-ui font-medium text-muted-foreground transition-colors duration-150 ease-bench hover:text-foreground motion-reduce:transition-none",
  headerFocusRing,
);

/**
 * The slim header for the landing, privacy and terms pages (route group
 * (public)): skip link, wordmark home, three plain links and the theme menu
 * button. One opaque row, 64 px tall (56 px on phones), with a hairline below.
 * A server component; the theme button server-renders at its final 40 px
 * size, so nothing shifts on hydration.
 */
export default function PublicHeader() {
  return (
    <>
      <SkipLink />
      <header data-testid="public-header" className="w-full border-b border-border bg-background text-foreground print:hidden">
        <div className={PUBLIC_HEADER_CONTAINER}>
          <Link href="/" aria-label="SV/UVM Hub home" className={cn("block shrink-0 rounded-lg", headerFocusRing)}>
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-auto">
            <ul className="flex items-center gap-1">
              {PUBLIC_HEADER_LINKS.map((link) => (
                <li key={link.href} className={link.wideOnly ? "hidden sm:block" : undefined}>
                  <Link href={link.href} className={cn("inline-flex", linkClass)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* The 40 px box is reserved on the server render, so the row does not move when the control hydrates. */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <ThemeSwitcher />
          </div>
        </div>
      </header>
    </>
  );
}
