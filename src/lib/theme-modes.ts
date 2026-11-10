/**
 * The site has two colour modes, light and dark, plus "system" (follow the
 * device). next-themes stores the learner's choice in localStorage under
 * "theme" and writes the mode to html[data-theme] before first paint.
 *
 * Until 2026-11 the site had ten named themes ("default-dark", "ocean-light"
 * and so on). Browsers and learner-data backups still hold those names, so
 * each one maps to its mode here; nothing rewrites the stored value.
 */

export type ThemeMode = "light" | "dark";

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark"];

const LEGACY_PALETTES = ["default", "ocean", "sunset", "forest", "violet"] as const;

/** Every name a stored theme may hold, mapped to the data-theme value it shows. */
export const THEME_VALUE_MAP: Readonly<Record<string, ThemeMode>> = Object.freeze({
  light: "light",
  dark: "dark",
  ...Object.fromEntries(
    LEGACY_PALETTES.flatMap((palette) => [
      [`${palette}-light`, "light"],
      [`${palette}-dark`, "dark"],
    ]),
  ),
});

/**
 * The mode a theme name stands for. "system", unknown names and an unset value
 * resolve to `fallback` (dark, the site default when nothing else says).
 */
export function themeMode(name: string | undefined | null, fallback: ThemeMode = "dark"): ThemeMode {
  if (!name) return fallback;
  return THEME_VALUE_MAP[name] ?? fallback;
}

/** The other mode: what the toggle button and Alt/Option+T switch to. */
export function oppositeMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}
