"use client";

import { type RefObject, useEffect, useState } from "react";

import { activeHeadingIndex, readingProgress } from "./lesson-reading";

/** Runs `measure` now, then at most once a frame while the page scrolls or resizes. */
function useFrameMeasure(measure: () => void, deps: readonly unknown[]): void {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let frame = 0;
    const run = () => {
      frame = 0;
      measure();
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(run);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
    // The caller lists what `measure` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * The id of the heading being read (activeHeadingIndex), or null above the
 * first one. Reads the headings' positions once a frame while the page
 * scrolls, so it also follows the reader upwards.
 */
export function useActiveHeading(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("\n");

  useFrameMeasure(() => {
    const list = key ? key.split("\n") : [];
    if (list.length === 0) return;
    const tops = list.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
    const root = document.documentElement;
    const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    const index = activeHeadingIndex(tops, { viewportHeight: window.innerHeight, atBottom });
    setActive(index >= 0 ? list[index] : null);
  }, [key]);

  return active;
}

/**
 * Draws reading progress through the element `targetId` on `lineRef`: a
 * transform on the line itself (scaleX from its left edge), written once a
 * frame without a React render, so the bar never causes a layout shift. The
 * value is also left in `data-progress` (0 to 1) for tests.
 */
export function useReadingProgress(targetId: string, lineRef: RefObject<HTMLElement>): void {
  useFrameMeasure(() => {
    const target = document.getElementById(targetId);
    const line = lineRef.current;
    if (!target || !line) return;
    const value = readingProgress(target.getBoundingClientRect(), window.innerHeight);
    line.style.transform = `scaleX(${value})`;
    line.dataset.progress = value.toFixed(3);
  }, [targetId, lineRef]);
}
