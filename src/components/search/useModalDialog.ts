"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Open modal dialogs, topmost last: only the topmost one handles Tab and Escape. */
const openDialogs: HTMLElement[] = [];
/** The body's overflow before the first dialog opened; restored when the last one closes. */
let savedBodyOverflow: string | null = null;

/** Tabbable elements inside `container`, skipping collapsed (`hidden`) and aria-hidden parts. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest("[hidden]") && !element.closest("[inert]") && element.getAttribute("aria-hidden") !== "true",
  );
}

/** True while any modal dialog from this hook is open. */
export function isModalDialogOpen(): boolean {
  return openDialogs.length > 0;
}

export interface ModalDialogOptions {
  onClose: () => void;
  /** Element to focus when the dialog opens. Defaults to its first focusable element. */
  initialFocus?: () => HTMLElement | null | undefined;
}

/**
 * Modal dialog behaviour for an element with role="dialog" and aria-modal="true".
 * Mount the dialog only while it is open; this hook then:
 * - moves focus in on open;
 * - keeps Tab and Shift+Tab inside;
 * - closes on Escape (unless a control inside already handled the key);
 * - stops the page behind from scrolling;
 * - returns focus to the element that was focused before it opened.
 */
export function useModalDialog(ref: RefObject<HTMLElement>, options: ModalDialogOptions): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(node);
    if (openDialogs.length === 1) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const target = optionsRef.current.initialFocus?.() ?? focusableWithin(node)[0] ?? node;
    target.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== node || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        optionsRef.current.onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableWithin(node);
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && node.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openDialogs.lastIndexOf(node);
      if (index >= 0) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) {
        document.body.style.overflow = savedBodyOverflow ?? "";
        savedBodyOverflow = null;
      }
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [ref]);
}
