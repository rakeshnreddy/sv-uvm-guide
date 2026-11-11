"use client";

import React, { lazy, Suspense, useId, useState, type ComponentType, type LazyExoticComponent } from "react";

import { InteractiveBoundary, InteractivePlaceholder } from "./InteractiveBoundary";
import { SNAPSHOT_SLOT_ATTRIBUTE, useServerMarkupSnapshot } from "./server-markup-snapshot";

export type InteractiveProps = Record<string, unknown> & { children?: React.ReactNode };
export type InteractiveComponent = ComponentType<InteractiveProps>;
export type InteractiveModule = { default: InteractiveComponent };
export type InteractiveLoader = () => Promise<InteractiveModule>;

export interface LazyComponentCache<Name extends string> {
  /** One React.lazy component per name, shared by every slot that shows it. */
  get(name: Name): LazyExoticComponent<InteractiveComponent>;
  /** Forgets a name, so the next `get` calls its loader again (React.lazy keeps a failed import for good). */
  reset(name: Name): void;
}

export function createLazyComponentCache<Name extends string>(
  loaders: Record<Name, InteractiveLoader>,
): LazyComponentCache<Name> {
  const cache = new Map<Name, LazyExoticComponent<InteractiveComponent>>();
  return {
    get(name) {
      let component = cache.get(name);
      if (!component) {
        component = lazy(loaders[name]);
        cache.set(name, component);
      }
      return component;
    },
    reset(name) {
      cache.delete(name);
    },
  };
}

/** The server HTML kept as the Suspense fallback; `display: contents` so it lays out exactly as before. */
function ServerMarkup({ html }: { html: string }) {
  return <div className="contents" data-interactive-snapshot="" dangerouslySetInnerHTML={{ __html: html }} />;
}

export interface InteractiveSlotProps<Name extends string> {
  name: Name;
  title: string;
  /** Expected height in px (from 640 px up) for the placeholder. */
  height: number;
  /** Expected height in px on phones. */
  mobileHeight?: number;
  cache: LazyComponentCache<Name>;
  componentProps: InteractiveProps;
}

/**
 * One lazily loaded interactive: an error boundary with Retry, a Suspense
 * boundary whose fallback is the slot's own server HTML when there is some
 * (see server-markup-snapshot.ts) and otherwise a placeholder of the expected
 * height carrying the title. The wrapper is `display: contents`, so it adds no
 * box and the interactive's own margins still collapse with the prose around it.
 */
export function InteractiveSlot<Name extends string>({
  name,
  title,
  height,
  mobileHeight,
  cache,
  componentProps,
}: InteractiveSlotProps<Name>) {
  const slotId = useId();
  const snapshot = useServerMarkupSnapshot(slotId, name);
  const [attempt, setAttempt] = useState(0);
  const Component = cache.get(name);

  const retry = () => {
    cache.reset(name);
    setAttempt((count) => count + 1);
  };

  // After a retry the server HTML is stale (it may be the error state), so use the placeholder.
  const fallback =
    snapshot && attempt === 0 ? (
      <ServerMarkup html={snapshot} />
    ) : (
      <InteractivePlaceholder title={title} height={height} mobileHeight={mobileHeight} />
    );

  return (
    <div className="contents" data-mdx-interactive={name} {...{ [SNAPSHOT_SLOT_ATTRIBUTE]: slotId }}>
      <InteractiveBoundary title={title} onRetry={retry}>
        <Suspense fallback={fallback}>
          <Component {...componentProps} />
        </Suspense>
      </InteractiveBoundary>
    </div>
  );
}

export default InteractiveSlot;
