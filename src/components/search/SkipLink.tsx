"use client";

import React, { type MouseEvent } from "react";

import { focusElement, MAIN_CONTENT_ID, mainContentTarget } from "./focus-target";

/**
 * The first focusable element on every learning page (G30-PAGE-V18). It skips
 * the navbar, the course outline and the breadcrumbs: focus lands on the
 * page's H1 (on a lesson, the start of the lesson body), or on the main
 * landmark when the page has no H1. Without JavaScript it is a plain
 * `#main-content` link.
 */
export default function SkipLink() {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = mainContentTarget();
    if (!target) return;
    event.preventDefault();
    focusElement(target);
    target.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-xl focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}
