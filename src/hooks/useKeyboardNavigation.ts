"use client";

import { useEffect } from "react";

/**
 * Enables arrow key navigation between elements marked with `data-focusable` within the container.
 */
export const useKeyboardNavigation = (
  containerRef: React.RefObject<HTMLElement | SVGSVGElement>
) => {
  useEffect(() => {
    const container = containerRef.current as HTMLElement | SVGSVGElement | null;
    if (!container) return;

    const getItems = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>("[data-focusable]")
      );

    const handleKey = (e: KeyboardEvent) => {
      const items = getItems();
      const current = document.activeElement as HTMLElement;
      const index = items.indexOf(current);
      if (index === -1) return;

      let next: HTMLElement | undefined;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = items[(index + 1) % items.length];
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = items[(index - 1 + items.length) % items.length];
      }
      next?.focus();
    };

    container.addEventListener("keydown", handleKey as EventListener);
    return () => container.removeEventListener("keydown", handleKey as EventListener);
  }, [containerRef]);
};

export default useKeyboardNavigation;
