"use client";

import { useState } from "react";

/**
 * Why this exists. A lesson's interactives are React.lazy components inside
 * Suspense. The server renders them in full, but in the browser each one's
 * code arrives after hydration starts, so its Suspense boundary stays
 * dehydrated (server HTML, not yet owned by React) until the chunk loads. If a
 * context above the lesson changes in that window (the theme, reduced-motion
 * and auth providers all set state as they mount), React cannot hydrate the
 * boundary with the new context while the code is missing, so it throws the
 * server HTML away and shows the Suspense fallback until the chunk arrives.
 * On E-PSS-1 that removed five interactives for about 60 ms and shortened the
 * page by about 3,900 px.
 *
 * The fix: while the slot first renders during hydration, copy its server
 * HTML. If React does fall back, the fallback is that same HTML, so nothing
 * disappears and nothing moves; the live component replaces it when its code
 * arrives. Without server HTML (a client-side navigation) the caller uses a
 * placeholder of the expected height instead.
 */

/** The attribute that marks a slot; its value is the slot's useId(), which matches on server and client. */
export const SNAPSHOT_SLOT_ATTRIBUTE = "data-interactive-slot";

/** True when React already owns this element: it belongs to a page that hydrated earlier, not to this render. */
function isOwnedByReact(element: Element): boolean {
  return Object.keys(element).some((key) => key.startsWith("__reactFiber$"));
}

/**
 * The server HTML inside the slot `slotId` for interactive `name`, or null when
 * there is none to keep: not in a browser, no such slot (a client-side
 * render), a slot that React already owns, or content that has not streamed in.
 */
export function readServerMarkup(slotId: string, name: string): string | null {
  if (typeof document === "undefined") return null;
  const slot = Array.from(document.querySelectorAll(`[${SNAPSHOT_SLOT_ATTRIBUTE}]`)).find(
    (element) => element.getAttribute(SNAPSHOT_SLOT_ATTRIBUTE) === slotId,
  );
  if (!slot || slot.getAttribute("data-mdx-interactive") !== name || isOwnedByReact(slot)) return null;
  // A boundary still waiting for streamed content holds only a <template> marker.
  if (!slot.children.length || slot.querySelector(":scope > template")) return null;
  return slot.innerHTML;
}

/** The slot's server HTML, read once on the first render (during hydration) and kept. */
export function useServerMarkupSnapshot(slotId: string, name: string): string | null {
  const [snapshot] = useState(() => readServerMarkup(slotId, name));
  return snapshot;
}
