"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { outlineDockedNow } from "@/components/layout/Sidebar";
import { currentLessonSlug } from "@/components/search/course-outline";
import { focusLessonToc } from "@/components/search/focus-target";
import { shellStore } from "@/components/search/shell-store";
import {
  isEditableTarget,
  matchShortcut,
  shortcutRoute,
  themeShortcutHandledByThemeSwitcher,
  toggledThemeName,
  type ShortcutId,
} from "@/components/search/shortcuts";
import ShortcutsHelpDialog from "@/components/search/ShortcutsHelpDialog";
import { findPrevNextTopics } from "@/lib/curriculum-data";
import { featureFlags } from "@/tools/featureFlags";

let activeShortcutIslands = 0;

/** Focuses the navbar search field when it is on screen; otherwise opens the search dialog. */
export function focusGlobalSearch(): void {
  const field = document.querySelector<HTMLInputElement>('[data-command-target="global-search"]');
  if (field && field.getClientRects().length > 0) {
    const focusField = () => {
      field.focus();
      field.select();
    };
    if (shellStore.anyModalOpen()) {
      // Let the open dialog close (and hand focus back) first.
      shellStore.closeAll();
      window.requestAnimationFrame(focusField);
    } else {
      focusField();
    }
    return;
  }
  shellStore.openSearch();
}

/** The previous or next lesson on the learning path, as the lesson page's own Prev/Next links compute it. */
export function lessonNeighbourHref(pathname: string | null, direction: "prev" | "next"): string | undefined {
  const slug = currentLessonSlug(pathname);
  if (!slug) return undefined;
  const target = findPrevNextTopics(slug)[direction];
  return target ? `/curriculum/${target.slug}` : undefined;
}

/**
 * The learning layout's keyboard shortcuts (listed in the "?" dialog):
 * Ctrl/Cmd+K and "/" search, Ctrl/Cmd+B the course outline, Alt/Option+1, 2,
 * 3 and C go to a section, Alt/Option+T switches light and dark, "[" and "]"
 * move between lessons, "t" jumps to the lesson's "On this page" list, "?"
 * shows the list of shortcuts. Mounted once, in the layout.
 */
export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Navigating closes the search, help, outline drawer and menu.
  useEffect(() => {
    shellStore.closeAll();
  }, [pathname]);

  useEffect(() => {
    const run = (id: ShortcutId, event: KeyboardEvent): boolean => {
      switch (id) {
        case "search":
          focusGlobalSearch();
          return true;
        case "outline":
          shellStore.toggleOutline(outlineDockedNow(pathname));
          return true;
        case "help":
          shellStore.toggleHelp();
          return true;
        case "toggle-theme":
          if (themeShortcutHandledByThemeSwitcher(event)) return false;
          setTheme(toggledThemeName(theme ?? resolvedTheme));
          return true;
        case "toc":
          return currentLessonSlug(pathname) !== null && focusLessonToc();
        case "prev-lesson":
        case "next-lesson": {
          const href = lessonNeighbourHref(pathname, id === "prev-lesson" ? "prev" : "next");
          if (!href) return false;
          router.push(href);
          return true;
        }
        default: {
          const href = shortcutRoute(id, featureFlags);
          if (!href) return false;
          router.push(href);
          return true;
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.isComposing) return;
      const match = matchShortcut(event);
      if (!match) return;
      if (!match.allowWhileTyping && isEditableTarget(event.target)) return;
      if (run(match.id, event)) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    // Lets end-to-end tests wait until the shortcuts are live instead of racing hydration.
    document.documentElement.setAttribute("data-shortcuts-ready", "");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.removeAttribute("data-shortcuts-ready");
    };
  }, [pathname, router, theme, resolvedTheme, setTheme]);

  useEffect(() => {
    activeShortcutIslands += 1;
    if (process.env.NODE_ENV !== "production" && activeShortcutIslands > 1) {
      console.error("KeyboardShortcuts must be mounted only once in the learning layout.");
    }
    return () => {
      activeShortcutIslands -= 1;
    };
  }, []);

  return <ShortcutsHelpDialog />;
}
