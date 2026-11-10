"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/Button";
import { useLocale } from "@/hooks/useLocale";
import { getString } from "@/lib/strings";
import { cn } from "@/lib/utils";

const themeOptions = [
  { key: "default", label: "Default" },
  { key: "ocean", label: "Ocean" },
  { key: "sunset", label: "Sunset" },
  { key: "forest", label: "Forest" },
  { key: "violet", label: "Violet" },
];

/**
 * Where the switcher sits. "bar": the md-and-up header group. "menu": the phone
 * menu, where the select fills the row and both controls are 44 px tall.
 */
export type ThemeSwitcherLayout = "bar" | "menu";

const layoutClasses: Record<ThemeSwitcherLayout, { root: string; select: string; button: string; placeholder: string }> = {
  // Below md the select is 40 px tall with 16 px text (iOS does not zoom a 16 px field); from md it keeps 14 px.
  bar: {
    root: "flex items-center gap-2",
    select: "h-10 px-2 text-base md:text-sm",
    button: "",
    // The select (84 px), the gap and the 40 px button, so the header does not shift on mount.
    placeholder: "inline-block h-10 w-[132px] shrink-0",
  },
  menu: {
    root: "flex w-full items-center gap-2",
    select: "h-11 min-w-0 flex-1 px-3 text-base",
    button: "h-11 w-11 shrink-0",
    placeholder: "block h-11 w-full",
  },
};

export function ThemeSwitcher({ layout = "bar" }: { layout?: ThemeSwitcherLayout } = {}) {
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();
  const [currentTheme, setCurrentTheme] = useState("default");
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!theme) return;
    const parts = theme.split("-");
    const m = parts.pop();
    if (m === "light" || m === "dark") {
      setMode(m);
      setCurrentTheme(parts.join("-"));
    }
  }, [theme]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setCurrentTheme(newTheme);
    setTheme(`${newTheme}-${mode}`);
  };

  // Alt/Option+T is handled once, by the learning layout's KeyboardShortcuts
  // (it matches event.code, so it also fires on macOS, and pauses while typing).
  const toggleMode = useCallback(() => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
    setTheme(`${currentTheme}-${newMode}`);
  }, [mode, currentTheme, setTheme]);

  const label = getString(locale as any, "toggleTheme");

  const classes = layoutClasses[layout];

  if (!mounted) {
    // Same size as the controls: no layout shift, and nothing for a screen reader to announce.
    return <span aria-hidden="true" data-testid="theme-switcher-placeholder" className={classes.placeholder} />;
  }

  return (
    <div className={classes.root}>
      <select
        value={currentTheme}
        onChange={handleSelect}
        aria-label="Select theme"
        className={cn(
          "rounded-md border border-input bg-background focus-visible:ring-2 focus-visible:ring-offset-2",
          classes.select,
        )}
      >
        {themeOptions.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        aria-label={label}
        title={label}
        aria-pressed={mode === "dark"}
        className={cn("relative focus-visible:ring-2 focus-visible:ring-offset-2", classes.button)}
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all motion-reduce:transition-none dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all motion-reduce:transition-none dark:rotate-0 dark:scale-100" />
        <span className="sr-only">{label}</span>
      </Button>
    </div>
  );
}
