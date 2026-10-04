"use client";

import { MotionConfig } from "framer-motion";

/**
 * Makes every framer-motion animation honour the operating system's
 * "reduce motion" setting: transforms and layout animations are skipped,
 * while opacity changes still apply.
 */
export function ReducedMotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
