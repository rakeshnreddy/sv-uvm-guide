import { cn } from "@/lib/utils";

/** The keyboard focus ring the header controls share. */
export const headerFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The header's icon buttons (course outline, search, menu, theme, account,
 * notifications): a 40 px square, rounded-lg, on the card surface with a
 * border, stepping to the raised surface on hover (DESIGN.md, chrome rules
 * R6 and R8).
 */
export const iconButtonClass = cn(
  "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 ease-bench hover:bg-muted motion-reduce:transition-none",
  headerFocusRing,
);

/** Icon size inside a header icon button: 18 px. */
export const iconButtonIconClass = "h-[18px] w-[18px]";
