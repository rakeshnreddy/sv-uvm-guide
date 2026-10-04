"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Open/closed state shared by the navbar, the course outline, the search
 * dialog and the keyboard shortcuts. A tiny external store, so components in
 * different parts of the layout tree can open each other's dialogs without a
 * provider. Opening one modal closes the others: only one is ever open.
 */
export interface ShellState {
  /** Search dialog (phones, and Ctrl/Cmd+K when the navbar field is hidden). */
  searchOpen: boolean;
  /** Keyboard shortcuts help dialog. */
  helpOpen: boolean;
  /** Course outline drawer: below lg, and on pages without the docked outline. */
  outlineOpen: boolean;
  /** Mobile navigation menu. */
  menuOpen: boolean;
  /** The learner hid the docked outline (lg and wider, lesson pages). Remembered per browser. */
  outlineCollapsed: boolean;
}

const COLLAPSED_KEY = "sv-uvm:outline-collapsed";

const defaults: ShellState = {
  searchOpen: false,
  helpOpen: false,
  outlineOpen: false,
  menuOpen: false,
  outlineCollapsed: false,
};

const closedModals = { searchOpen: false, helpOpen: false, outlineOpen: false, menuOpen: false } as const;

function readCollapsedPreference(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedPreference(collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(COLLAPSED_KEY, "1");
    else window.localStorage.removeItem(COLLAPSED_KEY);
  } catch {
    // Private windows and blocked storage: the preference just is not remembered.
  }
}

let state: ShellState = { ...defaults, outlineCollapsed: readCollapsedPreference() };
const listeners = new Set<() => void>();

function update(partial: Partial<ShellState>): void {
  const next = { ...state, ...partial };
  const changed = (Object.keys(next) as (keyof ShellState)[]).some((key) => next[key] !== state[key]);
  if (!changed) return;
  if (next.outlineCollapsed !== state.outlineCollapsed) writeCollapsedPreference(next.outlineCollapsed);
  state = next;
  listeners.forEach((listener) => listener());
}

export const shellStore = {
  getState: (): ShellState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  openSearch: () => update({ ...closedModals, searchOpen: true }),
  closeSearch: () => update({ searchOpen: false }),
  openHelp: () => update({ ...closedModals, helpOpen: true }),
  closeHelp: () => update({ helpOpen: false }),
  toggleHelp: () => (state.helpOpen ? update({ helpOpen: false }) : update({ ...closedModals, helpOpen: true })),
  openOutline: () => update({ ...closedModals, outlineOpen: true }),
  closeOutline: () => update({ outlineOpen: false }),
  openMenu: () => update({ ...closedModals, menuOpen: true }),
  closeMenu: () => update({ menuOpen: false }),
  setOutlineCollapsed: (collapsed: boolean) => update({ outlineCollapsed: collapsed }),
  /**
   * The navbar outline button and Ctrl/Cmd+B. Where the outline is docked
   * (lesson pages, lg and wider) it shows or hides the docked column;
   * elsewhere it opens or closes the drawer.
   */
  toggleOutline(docked: boolean): void {
    if (docked) update({ outlineCollapsed: !state.outlineCollapsed, outlineOpen: false });
    else if (state.outlineOpen) update({ outlineOpen: false });
    else update({ ...closedModals, outlineOpen: true });
  },
  /** Closes every modal, for example after a route change. */
  closeAll: () => update({ ...closedModals }),
  /** True while any modal from this store is open. */
  anyModalOpen: (): boolean => state.searchOpen || state.helpOpen || state.outlineOpen || state.menuOpen,
  /** Test hook. */
  reset(partial: Partial<ShellState> = {}): void {
    state = { ...defaults, ...partial };
    listeners.forEach((listener) => listener());
  },
};

export function useShellState<T>(selector: (snapshot: ShellState) => T): T {
  return useSyncExternalStore(
    shellStore.subscribe,
    () => selector(state),
    () => selector(defaults),
  );
}

/**
 * Stacking layer for the shell's modals (outline drawer, search, shortcuts
 * help, phone menu): above the floating AI assistant button (z-[9998]), so
 * nothing behind an open modal stays clickable.
 */
export const MODAL_LAYER = "z-[9999]";

/** Tailwind's `lg` breakpoint: the docked outline starts here. */
export const LG_MIN_WIDTH = 1024;

/** True when the viewport is at least `minWidth` px wide right now. */
export function viewportAtLeast(minWidth: number): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(`(min-width: ${minWidth}px)`).matches
    : false;
}

/** True while the viewport is at least `minWidth` px wide. False during server rendering and the first client render. */
export function useMinWidth(minWidth: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const sync = () => setMatches(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, [minWidth]);
  return matches;
}
