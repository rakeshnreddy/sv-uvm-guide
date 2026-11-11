"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The surface a field sits on (DESIGN.md sections 2 and 5): `page` for a field
 * on the page or in a raised strip, `card` for a field inside a card, menu or
 * dialog. Never glass: form fields stay on a solid surface (section 11).
 */
export type TextareaSurface = "page" | "card";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Rows shown before the learner types; the field then grows with its text. */
  minRows?: number;
  /** The surface under the field; `page` by default. */
  surface?: TextareaSurface;
}

const SURFACE_CLASS: Record<TextareaSurface, string> = {
  page: "bg-background",
  card: "bg-card",
};

/**
 * The field's look, from the contract's field tokens: the 3:1 control boundary
 * (border-input), a solid page or card surface, primary text, a secondary
 * placeholder, the control radius (8 px) and the shared focus ring.
 */
export function textareaClass(surface: TextareaSurface = "page"): string {
  return cn(
    "flex min-h-10 w-full rounded-lg border border-input px-3 py-2 text-base text-foreground md:text-sm",
    SURFACE_CLASS[surface],
    "placeholder:text-muted-foreground",
    "transition-colors duration-150 ease-bench motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "forced-colors:border-[ButtonText]",
  );
}

/** Sets the field's height to its content, so it grows as the learner types and shrinks when text is removed. */
function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, minRows = 2, surface = "page", onChange, style, value, defaultValue, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      fitToContent(internalRef.current);
      onChange?.(event);
    };

    // Fit a value set from outside (a controlled value, or a default value) as well as typed text.
    React.useEffect(() => {
      if (value || defaultValue) fitToContent(internalRef.current);
    }, [value, defaultValue]);

    return (
      <textarea
        rows={minRows}
        {...props}
        ref={internalRef}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        // The field grows with its text; a scroll bar appears only when a caller's max height stops it.
        style={{ overflowY: "auto", ...style }}
        className={cn(textareaClass(surface), className)}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
