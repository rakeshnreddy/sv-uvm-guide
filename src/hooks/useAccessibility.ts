"use client";

import { useEffect } from "react";
import useKeyboardNavigation from "./useKeyboardNavigation";
import useZoomPan from "./useZoomPan";

export const useAccessibility = (
  ref: React.RefObject<HTMLElement | SVGSVGElement>,
  label: string,
  { svg = true } = {}
) => {
  useKeyboardNavigation(ref as React.RefObject<HTMLElement>);
  if (svg) {
    useZoomPan(ref as React.RefObject<SVGSVGElement>);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", svg ? "img" : "group");
    el.setAttribute("aria-label", label);
    (el as HTMLElement).style.touchAction = "none";
  }, [ref, label, svg]);
};

export default useAccessibility;
