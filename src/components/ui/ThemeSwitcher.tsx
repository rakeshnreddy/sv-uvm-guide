"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/Button";

const themeOptions = [
  { key: "default", label: "Default" },
  { key: "ocean", label: "Ocean" },
  { key: "sunset", label: "Sunset" },
  { key: "forest", label: "Forest" },
  { key: "violet", label: "Violet" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState("default");
  const [mode, setMode] = useState<"light" | "dark">("dark");

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

  const toggleMode = () => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
    setTheme(`${currentTheme}-${newMode}`);
  };

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
      <Button variant="ghost" size="icon" onClick={toggleMode}>
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  );
}
