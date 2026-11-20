"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface SvgFontSizeOptions {
  /** The rendered size the text should have, in CSS px. */
  px?: number;
  /** Smallest font size in viewBox units (keeps text from shrinking on a wide chart). */
  min: number;
  /** Largest font size in viewBox units (keeps labels inside the margins on a narrow chart). */
  max: number;
}

/**
 * Font size, in viewBox units, that renders an SVG chart's labels at about `px`
 * CSS pixels whatever width the chart is drawn at. A viewBox scales its text with
 * the chart, so a fixed size is too small on a phone and oversized on a desktop.
 * Before the chart is measured (server render) it returns `max`.
 */
export function useSvgFontSize(ref: RefObject<SVGSVGElement | null>, viewBoxWidth: number, { px = 11.5, min, max }: SvgFontSizeOptions): number {
  const [size, setSize] = useState(max);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setSize(Math.min(max, Math.max(min, (px * viewBoxWidth) / width)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, viewBoxWidth, px, min, max]);
  return size;
}
