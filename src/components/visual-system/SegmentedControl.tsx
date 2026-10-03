"use client";

import React, { useRef } from "react";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Plain-text name when `label` is not a string. */
  ariaLabel?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Render option labels in the code font (operators, API names). */
  mono?: boolean;
  className?: string;
}

/**
 * Accessible single-choice control (WAI-ARIA radio group with roving
 * tabindex): Tab enters the group, arrow keys move and select, Home/End jump.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, mono = false, className }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  const move = (delta: number | "first" | "last") => {
    const currentIndex = enabled.findIndex((o) => o.value === value);
    let nextIndex: number;
    if (delta === "first") nextIndex = 0;
    else if (delta === "last") nextIndex = enabled.length - 1;
    else nextIndex = (currentIndex + delta + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    if (!next) return;
    onChange(next.value);
    const domIndex = options.findIndex((o) => o.value === next.value);
    refs.current[domIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
              } else if (event.key === "Home") {
                event.preventDefault();
                move("first");
              } else if (event.key === "End") {
                event.preventDefault();
                move("last");
              }
            }}
            className={cn(
              "min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
              mono && "font-mono [font-variant-ligatures:none]",
              checked ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
