/**
 * Keyboard shortcuts for the learning layout: what each key does, how a
 * keydown event maps to a shortcut, and the list the help dialog shows.
 * Pure functions, so the matching rules are unit-tested without a browser.
 *
 * Why `event.code`: on macOS, Option changes the character a key produces
 * (Option+1 is "¡", Option+C is "ç"), so comparing `event.key` never fires
 * Alt shortcuts there (G30-SRCH-04). Letters and digits are matched by
 * `event.key` when it is a plain letter or digit (so Dvorak and AZERTY users
 * get the key printed on their keyboard) and by `event.code` otherwise.
 */

export type ShortcutId =
  | "search"
  | "outline"
  | "go-curriculum"
  | "go-practice"
  | "go-dashboard"
  | "go-community"
  | "toggle-theme"
  | "prev-lesson"
  | "next-lesson"
  | "toc"
  | "help";

/** The parts of a KeyboardEvent the matcher reads. */
export interface ShortcutKeyEvent {
  key: string;
  code?: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface ShortcutMatch {
  id: ShortcutId;
  /** Fires even while the learner is typing in a field (only Ctrl/Cmd+K). */
  allowWhileTyping: boolean;
}

/** Routes behind feature flags are only reachable by shortcut when the flag is on. */
export interface ShortcutFlags {
  tracking: boolean;
  community: boolean;
}

export const SHORTCUT_ROUTES: Partial<Record<ShortcutId, string>> = {
  "go-curriculum": "/curriculum",
  "go-practice": "/practice",
  "go-dashboard": "/dashboard",
  "go-community": "/community",
};

const ALT_SHORTCUTS: Record<string, ShortcutId> = {
  "1": "go-curriculum",
  "2": "go-practice",
  "3": "go-dashboard",
  c: "go-community",
  t: "toggle-theme",
};

/** The letter or digit a key stands for, whatever Option or the layout turned it into. */
export function baseKey(event: Pick<ShortcutKeyEvent, "key" | "code">): string {
  if (/^[a-z0-9]$/i.test(event.key)) return event.key.toLowerCase();
  const code = event.code ?? "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return event.key;
}

/** Maps a keydown to a shortcut, or null. */
export function matchShortcut(event: ShortcutKeyEvent): ShortcutMatch | null {
  const { altKey, ctrlKey, metaKey, shiftKey } = event;
  const key = baseKey(event);

  if ((metaKey || ctrlKey) && !altKey && !shiftKey) {
    if (key === "k") return { id: "search", allowWhileTyping: true };
    if (key === "b") return { id: "outline", allowWhileTyping: false };
    return null;
  }

  if (altKey && !ctrlKey && !metaKey && !shiftKey) {
    const id = ALT_SHORTCUTS[key];
    if (id) return { id, allowWhileTyping: false };
  }

  // Single printable keys. Shift is part of "?" on most layouts, Option makes
  // "[" on some Mac layouts, and Ctrl+Alt is AltGr on Windows; Ctrl or Cmd
  // alone means the learner wants a browser shortcut.
  if (metaKey || (ctrlKey && !altKey)) return null;
  switch (event.key) {
    case "?":
      return { id: "help", allowWhileTyping: false };
    case "/":
      return { id: "search", allowWhileTyping: false };
    case "[":
      return { id: "prev-lesson", allowWhileTyping: false };
    case "]":
      return { id: "next-lesson", allowWhileTyping: false };
    case "t":
      return altKey ? null : { id: "toc", allowWhileTyping: false };
    default:
      return null;
  }
}

const NON_TEXT_INPUT_TYPES = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/** True when keys typed at `target` produce text, so single-key shortcuts must stay out of the way. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]') !== null;
}

/** "default-dark" → "default-light", "ocean-light" → "ocean-dark". */
export function toggledThemeName(theme: string | undefined): string {
  const current = theme && /-(light|dark)$/.test(theme) ? theme : "default-dark";
  const base = current.replace(/-(light|dark)$/, "");
  return current.endsWith("-dark") ? `${base}-light` : `${base}-dark`;
}

/** A shortcut route is available only when its feature flag is on. */
export function shortcutRoute(id: ShortcutId, flags: ShortcutFlags): string | undefined {
  if (id === "go-dashboard" && !flags.tracking) return undefined;
  if (id === "go-community" && !flags.community) return undefined;
  return SHORTCUT_ROUTES[id];
}

export interface ShortcutHelpItem {
  id: ShortcutId | "escape" | "results-move" | "results-open";
  /** Alternatives; each is the keys pressed together. */
  keys: string[][];
  description: string;
}

export interface ShortcutHelpGroup {
  title: string;
  items: ShortcutHelpItem[];
}

/** What the help dialog lists: every shortcut that works on this page, with this platform's key names. */
export function shortcutHelp({ apple, flags }: { apple: boolean; flags: ShortcutFlags }): ShortcutHelpGroup[] {
  const mod = apple ? "Cmd" : "Ctrl";
  const alt = apple ? "Option" : "Alt";
  const anywhere: ShortcutHelpItem[] = [
    { id: "search", keys: [[mod, "K"], ["/"]], description: "Search lessons and sections" },
    { id: "outline", keys: [[mod, "B"]], description: "Show or hide the course outline" },
    { id: "go-curriculum", keys: [[alt, "1"]], description: "Go to the curriculum" },
    { id: "go-practice", keys: [[alt, "2"]], description: "Go to practice" },
  ];
  if (flags.tracking) anywhere.push({ id: "go-dashboard", keys: [[alt, "3"]], description: "Go to your dashboard" });
  if (flags.community) anywhere.push({ id: "go-community", keys: [[alt, "C"]], description: "Go to the community" });
  anywhere.push(
    { id: "toggle-theme", keys: [[alt, "T"]], description: "Switch between light and dark mode" },
    { id: "help", keys: [["?"]], description: "Show this list of shortcuts" },
    { id: "escape", keys: [["Esc"]], description: "Close a dialog, the course outline drawer or the search results" },
  );

  return [
    { title: "Anywhere", items: anywhere },
    {
      title: "On a lesson page",
      items: [
        { id: "prev-lesson", keys: [["["]], description: "Previous lesson" },
        { id: "next-lesson", keys: [["]"]], description: "Next lesson" },
        { id: "toc", keys: [["T"]], description: "Jump to “On this page”, the lesson’s list of sections" },
      ],
    },
    {
      title: "In search",
      items: [
        { id: "results-move", keys: [["↑"], ["↓"]], description: "Move through the results" },
        { id: "results-open", keys: [["Enter"]], description: "Open the highlighted result" },
      ],
    },
  ];
}

/** Spoken names for key glyphs a screen reader would otherwise misread. */
export const SPOKEN_KEY_NAMES: Record<string, string> = {
  "↑": "Up arrow",
  "↓": "Down arrow",
  "[": "Left bracket",
  "]": "Right bracket",
  "/": "Slash",
  "?": "Question mark",
  Esc: "Escape",
};
