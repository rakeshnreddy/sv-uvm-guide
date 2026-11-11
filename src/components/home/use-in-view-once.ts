'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface InViewOptions {
  /** Grows the viewport for the test, as IntersectionObserver's rootMargin does ("0px 0px 160px 0px"). */
  rootMargin?: string;
}

/**
 * True from the first time the element comes within the (grown) viewport, and
 * from then on: it never goes back to false, so whatever mounts on it stays.
 * False in the server render and the hydrating render. Where the browser has
 * no IntersectionObserver it turns true straight after hydration, so the
 * content still arrives (only the deferral is lost).
 */
export function useInViewOnce(ref: RefObject<Element>, { rootMargin = '0px' }: InViewOptions = {}): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return undefined;
    const element = ref.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, inView]);

  return inView;
}
