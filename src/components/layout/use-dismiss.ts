"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover while it is open: on Escape (returning focus to its button)
 * or on a pointer press outside `containerRef`. The navbar's disclosures, the
 * account menu and the notification feed share it.
 */
export function useDismiss(open: boolean, containerRef: RefObject<HTMLElement>, buttonRef: RefObject<HTMLElement>, close: () => void) {
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
