/**
 * Class names shared by the curriculum overview components. Theme tokens only
 * (`text-foreground`, `bg-card`, `border-border`, `text-primary`, …), so every
 * theme keeps its own WCAG AA contrast in light and dark.
 */

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/** A link that stands on its own (lists, cards). */
export const textLink = `rounded-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`;

/** A link inside running text: underlined, so it never relies on colour alone. */
export const inlineLink = `rounded-sm font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`;

export const primaryAction = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${focusRing}`;

export const secondaryAction = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-primary ${focusRing}`;

export const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium';
