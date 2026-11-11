'use client';

import React, { Suspense, useRef } from 'react';

import { useInViewOnce } from './use-in-view-once';

export interface InViewMountProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * What the slot shows before its content mounts, while the content's code
   * loads, and without JavaScript. It is in the server HTML.
   */
  fallback: React.ReactNode;
  /**
   * Rendered only once the slot has come into view. A React.lazy component
   * here does not start loading its code until then.
   */
  children: React.ReactNode;
  /** Grows the viewport for the in-view test (IntersectionObserver rootMargin). */
  rootMargin?: string;
}

/**
 * A slot that mounts its children when it scrolls into view, and shows the
 * fallback until then. The box is the caller's: give it a reserved height
 * (className or style) so the swap moves nothing. data-state says which
 * content is in it: "waiting" (the fallback, before it is in view) or
 * "mounted" (from the moment it is; the fallback stays as the Suspense
 * fallback while the code loads).
 */
export function InViewMount({ fallback, children, rootMargin, ...rest }: InViewMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref, { rootMargin });
  return (
    <div ref={ref} data-state={inView ? 'mounted' : 'waiting'} {...rest}>
      {inView ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}

export default InViewMount;
