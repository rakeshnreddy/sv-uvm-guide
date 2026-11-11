/**
 * Class names shared by the curriculum overview components. Theme tokens only
 * (`text-foreground`, `bg-card`, `border-border`, `text-primary`, …), so every
 * theme keeps its own WCAG AA contrast in light and dark.
 */

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Labels and eyebrows: sentence case, 12/16 at weight 500, no tracking (DESIGN.md
 * section 4). Spelled `text-xs font-medium` (the same metrics as `text-label`)
 * because these strings go through cn(), whose tailwind-merge reads `text-label`
 * as a colour and drops it beside `text-subtle`.
 */
export const eyebrow = 'text-xs font-medium text-subtle';

/** A link that stands on its own (lists, cards). */
export const textLink = `rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-150 ease-bench hover:underline motion-reduce:transition-none ${focusRing}`;

/** A link inside running text: underlined, so it never relies on colour alone. */
export const inlineLink = `rounded-sm font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`;

/**
 * The one filled accent action per view. The transparent border keeps a visible
 * boundary in Windows forced-colours mode (gap-6).
 */
export const primaryAction = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 ease-bench hover:bg-primary/90 forced-colors:border-[ButtonText] motion-reduce:transition-none ${focusRing}`;

/** Every other action: the raised surface, a hairline and primary text, like Button's secondary variant. */
export const secondaryAction = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 ease-bench hover:bg-border/70 motion-reduce:transition-none ${focusRing}`;

/** A tag (4 px radius); `text-xs font-medium` for the reason given on `eyebrow`. */
export const chip = 'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium';

/**
 * A link whose visible content is a SignalTag (a code such as "I-SV-1"): the
 * link gives a 40 px target around the small tag, and the tag shows the accent
 * on hover and keyboard focus (DESIGN.md section 8). Put `tagInLink` on the
 * SignalTag inside.
 */
export const tagLink = 'group inline-flex min-h-[40px] items-center rounded px-0.5 focus-visible:outline-none';

/** Classes for the SignalTag inside a `tagLink`. */
export const tagInLink =
  'transition-colors duration-150 ease-bench motion-reduce:transition-none group-hover:border-primary group-hover:text-primary group-focus-visible:border-primary group-focus-visible:text-primary group-focus-visible:ring-2 group-focus-visible:ring-ring';
