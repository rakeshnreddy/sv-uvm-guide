"use client";

import React from "react";
import { Keyboard } from "lucide-react";

import { cn } from "@/lib/utils";

import { shellStore, useShellState } from "./shell-store";

/** Opens the keyboard shortcuts dialog; the footer's visible way to discover the "?" shortcut. */
export default function ShortcutsHelpButton({ className }: { className?: string }) {
  const open = useShellState((state) => state.helpOpen);
  return (
    <button
      type="button"
      onClick={shellStore.openHelp}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="?"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Keyboard aria-hidden="true" className="h-4 w-4" />
      Keyboard shortcuts
    </button>
  );
}
