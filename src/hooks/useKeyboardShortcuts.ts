"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useNavigation } from "@/contexts/NavigationContext";
import { featureFlags } from "@/tools/featureFlags";

type Command = "mod+b" | "mod+k" | "alt+1" | "alt+2" | "alt+3" | "alt+c";

function toCommand(event: KeyboardEvent): Command | null {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "b") return "mod+b";
  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "k") return "mod+k";
  if (event.altKey && !event.metaKey && !event.ctrlKey && key === "1") return "alt+1";
  if (event.altKey && !event.metaKey && !event.ctrlKey && key === "2") return "alt+2";
  if (event.altKey && !event.metaKey && !event.ctrlKey && key === "3") return "alt+3";
  if (event.altKey && !event.metaKey && !event.ctrlKey && key === "c") return "alt+c";
  return null;
}

export function useKeyboardShortcuts() {
  const { toggleSidebar } = useNavigation();
  const router = useRouter();

  useEffect(() => {
    const commandHandlers: Partial<Record<Command, () => void>> = {
      "mod+b": toggleSidebar,
      "mod+k": () =>
        document
          .querySelector<HTMLInputElement>('[data-command-target="global-search"]')
          ?.focus(),
      "alt+1": () => router.push("/curriculum"),
      "alt+2": () => router.push("/practice"),
      ...(featureFlags.tracking ? { "alt+3": () => router.push("/dashboard") } : {}),
      ...(featureFlags.community ? { "alt+c": () => router.push("/community") } : {}),
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const command = toCommand(event);
      if (!command) return;

      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable ||
        (target ? ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) : false);
      if (isTyping && command !== "mod+k") return;

      const handler = commandHandlers[command];
      if (!handler) return;
      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleSidebar]);
}
