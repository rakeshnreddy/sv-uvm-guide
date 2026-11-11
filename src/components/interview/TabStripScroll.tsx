'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Which edges of a sideways scroller hide more tabs: "start", "end", "both", or undefined when everything fits. */
export function hiddenEdges(scrollLeft: number, scrollWidth: number, clientWidth: number): 'start' | 'end' | 'both' | undefined {
  const start = scrollLeft > 1;
  const end = scrollLeft + clientWidth < scrollWidth - 1;
  if (start && end) return 'both';
  if (start) return 'start';
  if (end) return 'end';
  return undefined;
}

/**
 * The left scroll position that brings `item` fully into view inside a
 * scroller, centred when it was cut off, unchanged when it was already visible.
 */
export function scrollLeftToShow(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  itemLeft: number,
  itemWidth: number,
): number {
  if (itemLeft >= scrollLeft && itemLeft + itemWidth <= scrollLeft + clientWidth) return scrollLeft;
  const centred = itemLeft - (clientWidth - itemWidth) / 2;
  return Math.max(0, Math.min(scrollWidth - clientWidth, centred));
}

/**
 * A sideways-scrolling tab strip that shows when it hides tabs: the hidden
 * edge fades out (data-fade, styled by the mask classes below), and the
 * current tab (aria-current) is scrolled into view on mount, before paint.
 * Everything else is the server markup passed as children.
 */
export function TabStripScroll({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useBeforePaint(() => {
    const nav = ref.current;
    if (!nav) return;
    const update = () => {
      const edges = hiddenEdges(nav.scrollLeft, nav.scrollWidth, nav.clientWidth);
      if (edges) nav.setAttribute('data-fade', edges);
      else nav.removeAttribute('data-fade');
    };
    const current = nav.querySelector<HTMLElement>('[aria-current]');
    if (current) {
      const navBox = nav.getBoundingClientRect();
      const box = current.getBoundingClientRect();
      nav.scrollLeft = scrollLeftToShow(nav.scrollLeft, nav.clientWidth, nav.scrollWidth, box.left - navBox.left + nav.scrollLeft, box.width);
    }
    update();
    nav.setAttribute('data-measured', '');
    nav.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      nav.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label={label}
      className={cn(
        'relative overflow-x-auto',
        // Before it is measured (the server HTML), a phone-width strip is taken to hide tabs past its end.
        'max-sm:[&:not([data-measured])]:[mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]',
        'data-[fade=end]:[mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]',
        'data-[fade=start]:[mask-image:linear-gradient(to_left,black_calc(100%-3rem),transparent)]',
        'data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)]',
        className,
      )}
    >
      {children}
    </nav>
  );
}

export default TabStripScroll;
