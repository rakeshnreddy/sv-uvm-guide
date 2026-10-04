"use client";

import { useEffect, useState } from "react";

/** macOS, iPadOS and iOS name the modifier keys Command and Option. */
export function isApplePlatform(nav: Pick<Navigator, "platform" | "userAgent"> | undefined = globalThis.navigator): boolean {
  if (!nav) return false;
  return /Mac|iPhone|iPad|iPod/i.test(nav.platform || nav.userAgent || "");
}

/**
 * True on Apple platforms. False during server rendering and the first client
 * render, so server and client markup match; key labels update after mount.
 */
export function useIsApplePlatform(): boolean {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    setApple(isApplePlatform());
  }, []);
  return apple;
}
