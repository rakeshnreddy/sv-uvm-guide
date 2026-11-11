"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * The box behind a lesson ScrollRegion. It is a focusable, labelled region only
 * while its content is wider than the box, so a code block or table that fits
 * adds no extra Tab stop. Server markup assumes it overflows, so the content
 * stays reachable by keyboard before (or without) JavaScript.
 */
export function ScrollRegionFrame({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(true);
  const [ordinal, setOrdinal] = useState<number | null>(null);

  // Several boxes with the same name on one page ("Table") are numbered in page
  // order ("Table 2"), so every region landmark has its own name.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const same = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-region-label]")).filter(
      (node) => node.dataset.scrollRegionLabel === label,
    );
    setOrdinal(same.length > 1 ? same.indexOf(el) + 1 : null);
  }, [label]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      role={overflows ? "region" : undefined}
      tabIndex={overflows ? 0 : undefined}
      aria-label={overflows ? (ordinal ? `${label} ${ordinal}` : label) : undefined}
      data-scroll-region-label={label}
      className={className}
      data-scroll-region={overflows ? "scrolls" : "fits"}
    >
      {children}
    </div>
  );
}
