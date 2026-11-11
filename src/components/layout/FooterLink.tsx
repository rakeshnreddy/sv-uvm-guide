"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import type { NavLink } from "@/lib/site-links";
import { cn } from "@/lib/utils";

import { navLinkCurrent } from "./nav-current";

/** A footer link: secondary text, a 40 px target, the accent ring on keyboard focus. */
export const FOOTER_LINK_CLASS = cn(
  "inline-flex min-h-10 items-center rounded px-1 text-ui text-muted-foreground underline-offset-4 transition-colors duration-150 ease-bench hover:text-foreground hover:underline motion-reduce:transition-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

/** "page" when `href` is exactly the page open at `pathname`; a link to part of a page never is. */
export function footerLinkCurrent(pathname: string | null | undefined, href: string): "page" | undefined {
  return navLinkCurrent(pathname, href) === "page" ? "page" : undefined;
}

/**
 * One footer link, marked aria-current="page" on its own page. The only client
 * part of the footer: it reads the path, so the rest stays a server component.
 */
export default function FooterLink({ link }: { link: NavLink }) {
  const pathname = usePathname();
  return (
    <Link href={link.href} aria-current={footerLinkCurrent(pathname, link.href)} className={FOOTER_LINK_CLASS}>
      {link.label}
    </Link>
  );
}
