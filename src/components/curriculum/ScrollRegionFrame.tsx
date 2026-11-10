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
      aria-label={overflows ? label : undefined}
      className={className}
      data-scroll-region={overflows ? "scrolls" : "fits"}
    >
      {children}
    </div>
  );
}
