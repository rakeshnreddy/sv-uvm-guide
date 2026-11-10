"use client";

import * as React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
// clsx, not cn, where a class list holds a type token (text-ui): tailwind-merge reads it as a colour and drops it.
import { clsx } from "clsx";

import {
  iconButtonClass,
  iconButtonIconClass,
} from "@/components/ui/icon-button-class";
import { themeMode, type ThemeMode } from "@/lib/theme-modes";
import { cn } from "@/lib/utils";

/**
 * Where the control sits. "bar": the header (and Settings), a 40 px icon
 * button that opens a menu. "menu": the phone menu, a full-width segmented
 * radio group with 44 px targets.
 */
export type ThemeSwitcherLayout = "bar" | "menu";

/** What the learner can choose: one of the two modes, or follow the device. */
export type ThemeChoice = ThemeMode | "system";

interface ChoiceOption {
  value: ThemeChoice;
  label: string;
  Icon: LucideIcon;
}

export const THEME_CHOICES: readonly ChoiceOption[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** The control's accessible name, in the header, Settings and the phone menu. */
export const THEME_CONTROL_LABEL = "Theme";

/**
 * The stored choice as one of the three options. Unset and "system" follow the
 * device; old stored names ("ocean-dark" and the rest) count as their mode.
 */
export function themeChoice(theme: string | undefined | null): ThemeChoice {
  if (!theme || theme === "system") return "system";
  return themeMode(theme);
}

/** "System (dark)": the System option names the mode the device gives. */
function optionLabel(
  option: ChoiceOption,
  systemTheme: string | undefined,
): string {
  if (option.value !== "system" || !systemTheme) return option.label;
  return `${option.label} (${themeMode(systemTheme)})`;
}

/** The stored choice is known only in the browser, so it is read once mounted. */
function useThemeChoice() {
  const { theme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return {
    choice: mounted ? themeChoice(theme) : undefined,
    systemTheme: mounted ? systemTheme : undefined,
    setTheme,
  };
}

/**
 * The icon for the current choice. Before mount the choice is unknown, so the
 * sun and moon follow html[data-theme] through the dark: variant (set before
 * first paint); once mounted a "system" choice shows the monitor. The box
 * never changes size, so nothing in the header moves.
 */
function ChoiceIcon({ choice }: { choice: ThemeChoice | undefined }) {
  if (choice === "system")
    return (
      <Monitor
        aria-hidden="true"
        data-icon="system"
        className={iconButtonIconClass}
      />
    );
  return (
    <>
      <Sun
        aria-hidden="true"
        data-icon="light"
        className={cn(iconButtonIconClass, "dark:hidden")}
      />
      <Moon
        aria-hidden="true"
        data-icon="dark"
        className={cn(iconButtonIconClass, "hidden dark:block")}
      />
    </>
  );
}

const MENU_WIDTH_PX = 192;

/**
 * A theme menu item. The checked one is the raised surface with a 2 px accent
 * marker on its leading edge (DESIGN.md section 2, rule 3), beside the check
 * icon; the others carry a transparent 2 px border, so nothing shifts.
 */
export function menuItemClass(checked: boolean): string {
  return clsx(
    "flex h-10 w-full items-center gap-3 rounded-lg border-l-2 px-3 text-left text-ui text-foreground transition-colors duration-150 ease-bench hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
    checked ? "border-primary bg-muted font-medium" : "border-transparent",
  );
}

/**
 * A phone-menu segment. The icon is hidden below 400 px, so "System" keeps
 * room inside its segment on a 320 px phone; the target stays 44 px tall.
 */
export function segmentClass(checked: boolean): string {
  return clsx(
    "relative flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border-b-2 px-1 text-ui text-muted-foreground transition-colors duration-150 ease-bench hover:text-foreground motion-reduce:transition-none",
    "has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
    checked ? "border-primary bg-muted font-medium text-foreground" : "border-transparent",
  );
}

/** The segment icon: shown from 400 px, where the three segments have room for it. */
export const SEGMENT_ICON_CLASS = "hidden shrink-0 min-[400px]:block";

/**
 * The header control: a menu button with Light, Dark and System as radio
 * items (WAI-ARIA menu button). Enter, Space or the arrow keys open it on the
 * checked item; the arrow keys, Home and End move; Enter or Space chooses;
 * Escape closes and returns focus to the button; Tab or a press outside closes.
 */
function ThemeMenu() {
  const { choice, systemTheme, setTheme } = useThemeChoice();
  const [open, setOpen] = useState(false);
  const [alignStart, setAlignStart] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = Math.max(
    0,
    THEME_CHOICES.findIndex((option) => option.value === choice),
  );

  const openMenu = useCallback((index: number) => {
    // Open towards the side with room: in the header the button sits at the end of the bar, in Settings at the start of a line.
    const rect = buttonRef.current?.getBoundingClientRect();
    setAlignStart(Boolean(rect && rect.left + rect.width / 2 < window.innerWidth / 2));
    setInitialIndex(index);
    setOpen(true);
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open) itemRefs.current[initialIndex]?.focus();
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (value: ThemeChoice) => {
    setTheme(value);
    close(true);
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(
        event.key === "ArrowDown" ? checkedIndex : THEME_CHOICES.length - 1,
      );
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current;
    const current = items.findIndex((item) => item === document.activeElement);
    const last = THEME_CHOICES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = current >= last ? 0 : current + 1;
    else if (event.key === "ArrowUp") next = current <= 0 ? last : current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={THEME_CONTROL_LABEL}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid="theme-switcher"
        data-layout="bar"
        data-choice={choice}
        onClick={() => (open ? close(false) : openMenu(checkedIndex))}
        onKeyDown={onButtonKeyDown}
        className={iconButtonClass}
      >
        <ChoiceIcon choice={choice} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={THEME_CONTROL_LABEL}
          data-testid="theme-menu"
          onKeyDown={onMenuKeyDown}
          style={{ width: MENU_WIDTH_PX }}
          className={cn(
            "absolute top-full z-50 mt-2 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-card",
            alignStart ? "left-0" : "right-0",
          )}
        >
          {THEME_CHOICES.map((option, index) => {
            const checked = option.value === choice;
            const { Icon } = option;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => choose(option.value)}
                className={menuItemClass(checked)}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    iconButtonIconClass,
                    "shrink-0 text-muted-foreground",
                  )}
                />
                <span className="flex-1">
                  {optionLabel(option, systemTheme)}
                </span>
                <Check
                  aria-hidden="true"
                  className={cn(
                    iconButtonIconClass,
                    "shrink-0 text-primary",
                    !checked && "invisible",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The phone menu's control: the same three choices as a segmented radio group
 * of native radios (arrow keys move and choose), each a 44 px target. The
 * checked segment is the raised surface with a 2 px accent underline.
 */
function ThemeSegments() {
  const { choice, systemTheme, setTheme } = useThemeChoice();
  const name = useId();

  return (
    <div className="w-full">
      <div
        role="radiogroup"
        aria-label={THEME_CONTROL_LABEL}
        data-testid="theme-switcher"
        data-layout="menu"
        data-choice={choice}
        className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1"
      >
        {THEME_CHOICES.map((option) => {
          const { Icon } = option;
          const checked = option.value === choice;
          return (
            <label
              key={option.value}
              className={segmentClass(checked)}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => setTheme(option.value)}
                className="sr-only"
              />
              <Icon
                aria-hidden="true"
                className={cn(iconButtonIconClass, SEGMENT_ICON_CLASS)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          );
        })}
      </div>
      <p
        aria-live="polite"
        data-testid="theme-system-note"
        className="mt-1 min-h-4 px-1 text-label text-subtle"
      >
        {choice === "system" && systemTheme
          ? `Following this device: ${themeMode(systemTheme)} mode`
          : ""}
      </p>
    </div>
  );
}

/**
 * The one theme control (DESIGN.md section 7): Light, Dark or System, saved
 * by next-themes in this browser. Alt/Option+T, which switches between light
 * and dark, is handled once, by the learning layout's KeyboardShortcuts.
 */
export function ThemeSwitcher({
  layout = "bar",
}: { layout?: ThemeSwitcherLayout } = {}) {
  return layout === "menu" ? <ThemeSegments /> : <ThemeMenu />;
}
