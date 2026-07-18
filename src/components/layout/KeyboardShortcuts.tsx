"use client";

import { useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

let activeShortcutIslands = 0;

export default function KeyboardShortcuts() {
  useKeyboardShortcuts();
  useEffect(() => {
    activeShortcutIslands += 1;
    if (process.env.NODE_ENV !== "production" && activeShortcutIslands > 1) {
      console.error("KeyboardShortcuts must be mounted only once in the learning layout.");
    }
    return () => {
      activeShortcutIslands -= 1;
    };
  }, []);
  return null;
}
