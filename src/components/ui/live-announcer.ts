/**
 * One polite live region for the whole page, created on first use. Components
 * that confirm a small action ("Code copied to clipboard") call `announce`
 * instead of each rendering an empty `role="status"` element of their own.
 */

export const LIVE_ANNOUNCER_ATTRIBUTE = "data-live-announcer";

/** Delay between clearing the region and writing the message, so a repeated message is announced again. */
export const ANNOUNCE_DELAY_MS = 50;

let pending: ReturnType<typeof setTimeout> | undefined;

function announcerElement(): HTMLElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  let region = document.querySelector<HTMLElement>(`[${LIVE_ANNOUNCER_ATTRIBUTE}]`);
  if (!region) {
    region = document.createElement("div");
    region.setAttribute(LIVE_ANNOUNCER_ATTRIBUTE, "");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  return region;
}

/** Reads `message` out once through the shared polite live region. */
export function announce(message: string): void {
  const region = announcerElement();
  if (!region) return;
  clearTimeout(pending);
  region.textContent = "";
  pending = setTimeout(() => {
    region.textContent = message;
  }, ANNOUNCE_DELAY_MS);
}
