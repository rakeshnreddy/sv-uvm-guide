"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

import { THEME_MODES, THEME_VALUE_MAP } from "@/lib/theme-modes";

/**
 * next-themes 0.3.0 builds its pre-paint script without the attribute call
 * when a value map is passed, so a stored "light", "dark" or legacy name would
 * only reach html[data-theme] after hydration (a flash). This script runs right
 * after it, before the page below paints, and applies the stored choice through
 * the same map. "system" and an empty store are left to next-themes, which
 * already handles them.
 */
export const themeAttributeScript = `!function(){try{var d=document.documentElement,e=localStorage.getItem('theme'),x=${JSON.stringify(
  THEME_VALUE_MAP,
)};if(e&&e!=='system'&&Object.prototype.hasOwnProperty.call(x,e)){d.setAttribute('data-theme',x[e]);d.style.colorScheme=x[e]}}catch(_){}}()`;

/**
 * Two modes on html[data-theme] ("light" and "dark"), following the device
 * until the learner picks one. The attribute is written before first paint,
 * and Tailwind's dark variant keys on it, so no client effect adds a class.
 * Stored names from the old theme set ("ocean-dark" and the rest) resolve to
 * their mode through the value map; the stored value itself is left alone.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      themes={THEME_MODES as string[]}
      value={THEME_VALUE_MAP as Record<string, string>}
      enableSystem
      defaultTheme="system"
      disableTransitionOnChange
      {...props}
    >
      <script dangerouslySetInnerHTML={{ __html: themeAttributeScript }} />
      {children}
    </NextThemesProvider>
  );
}
