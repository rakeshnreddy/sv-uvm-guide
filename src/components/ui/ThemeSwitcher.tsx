"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/Button";
import { useLocale } from "@/hooks/useLocale";
import { getString } from "@/lib/strings";

const themeOptions = [
  { key: "default", label: "Default" },
  { key: "ocean", label: "Ocean" },
  { key: "sunset", label: "Sunset" },
  { key: "forest", label: "Forest" },
  { key: "violet", label: "Violet" },
];

export function ThemeSwitcher() {
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

  const toggleMode = useCallback(() => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
    setTheme(`${currentTheme}-${newMode}`);
  }, [mode, currentTheme, setTheme]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleMode]);

  const label = getString(locale as any, "toggleTheme");

  if (!mounted) {
    return <span>{getString(locale as any, "loading")}</span>;
  }

  return (
    <div className="flex items-center space-x-2">
      <select
        value={currentTheme}
        onChange={handleSelect}
        className="rounded-md border border-input bg-background p-2 text-sm"
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
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">{label}</span>
      </Button>
    </div>
  );
}
