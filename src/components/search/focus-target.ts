/**
 * Focus helpers for the skip link and for navigation started from a dialog
 * (search, the outline drawer). The dialog closes before the next page
 * renders, so focus would otherwise return to the button that opened it;
 * moving it to the page heading or the chosen section keeps keyboard and
 * screen reader users in the content they asked for.
 */

/** The element a skip link or a lesson navigation lands on: the page's H1, else the main landmark. */
export const MAIN_CONTENT_ID = "main-content";

function isNativelyFocusable(element: HTMLElement): boolean {
  return element.matches("a[href], button, input, select, textarea, [tabindex]");
}

/** Focuses an element, making it programmatically focusable first if it is not. */
export function focusElement(element: HTMLElement, options: FocusOptions = { preventScroll: true }): void {
  if (!isNativelyFocusable(element)) element.setAttribute("tabindex", "-1");
  element.focus(options);
}

/** The page's main heading, or the main landmark when the page has no H1. */
export function mainContentTarget(doc: Document = document): HTMLElement | null {
  const main = doc.getElementById(MAIN_CONTENT_ID);
  return main?.querySelector<HTMLElement>("h1") ?? main;
}

export interface FocusAfterNavigationOptions {
  /** Give up after this long, for example when the anchor does not exist on the page. */
  timeoutMs?: number;
  intervalMs?: number;
}

/**
 * After a client-side navigation to `href`, focuses the `#anchor` element, or
 * the new page's H1 when there is no anchor. Waits until the URL shows the
 * new path (the new page has committed) and the element exists. Gives up if
 * the learner moves focus somewhere else in the meantime.
 */
export function focusAfterNavigation(href: string, options: FocusAfterNavigationOptions = {}): () => void {
  const { timeoutMs = 8000, intervalMs = 50 } = options;
  if (typeof window === "undefined") return () => {};
  const url = new URL(href, window.location.href);
  const anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
  const started = Date.now();
  let timer: number | undefined;
  let cancelled = false;
  // Where focus sits once the dialog that started the navigation has closed.
  let baseline: Element | null | undefined;

  const attempt = () => {
    if (cancelled) return;
    const active = document.activeElement;
    if (baseline === undefined) baseline = active;
    else if (active && active !== baseline && active !== document.body) return;
    if (window.location.pathname === url.pathname) {
      const target = anchor ? document.getElementById(anchor) : mainContentTarget();
      if (target) {
        focusElement(target);
        return;
      }
    }
    if (Date.now() - started < timeoutMs) timer = window.setTimeout(attempt, intervalMs);
  };
  timer = window.setTimeout(attempt, 0);

  return () => {
    cancelled = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };
}

/**
 * Moves focus into the lesson's "On this page" list (the "t" shortcut): the
 * entry for the section being read, else the first entry. Below xl the list
 * is a disclosure, so it is opened first. Returns false when the page has no
 * such list.
 */
export function focusLessonToc(doc: Document = document): boolean {
  const toc = doc.querySelector<HTMLElement>('nav[aria-label="On this page"]');
  if (!toc) return false;
  const focusEntry = () => {
    const entry =
      toc.querySelector<HTMLElement>('a[aria-current="location"]') ?? toc.querySelector<HTMLElement>("a[href]");
    entry?.focus();
  };
  const toggle = toc.querySelector<HTMLButtonElement>("button[aria-controls]");
  if (toggle && toggle.getClientRects().length > 0 && toggle.getAttribute("aria-expanded") !== "true") {
    toggle.click();
    window.requestAnimationFrame(focusEntry);
  } else {
    focusEntry();
  }
  return true;
}
