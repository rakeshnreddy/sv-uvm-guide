"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

const themeNames = [
  "default-light",
  "default-dark",
  "ocean-light",
  "ocean-dark",
  "sunset-light",
  "sunset-dark",
  "forest-light",
  "forest-dark",
  "violet-light",
  "violet-dark",
] as const;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      themes={themeNames as unknown as string[]}
      value={{
        "default-light": "default-light",
        "default-dark": "default-dark dark",
        "ocean-light": "ocean-light",
        "ocean-dark": "ocean-dark dark",
        "sunset-light": "sunset-light",
        "sunset-dark": "sunset-dark dark",
        "forest-light": "forest-light",
        "forest-dark": "forest-dark dark",
        "violet-light": "violet-light",
        "violet-dark": "violet-dark dark",
      }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
