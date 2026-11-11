import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { cva } from 'class-variance-authority';

import { tierDataAttribute, type TierNumber } from '@/lib/tier-colors';

/*
 * Card (SPEC-phases-2-4.md, "Primitives"; DESIGN.md section 5): radius 12,
 * hairline border, one surface step above the page. Never put a card inside a
 * card: inside a surface card use `inset`, or plain rows with hairlines.
 *
 * - surface: the card background and a hairline (the default, as before)
 * - interactive: surface, and on hover the raised background and the stronger
 *   control border; the focus ring shows when a link or button inside it has
 *   keyboard focus (stretch that link over the card for a whole-card target)
 * - inset: the raised background, no border, no shadow; for a group inside a
 *   page section or inside a surface card
 * - callout: a 2 px leading border in the tone's colour over the tone's subtle
 *   fill; tone is info (default), success, warning or danger
 * - glass: real glass with the backdrop blur (DESIGN.md section 11), only for
 *   cards that overlap the colour field at the top of a hub page; at most
 *   three blurred layers on screen, and never inside another glass layer
 * - glassQuiet: the glass fill, hairline and highlight without the blur, for
 *   cards further down a hub page
 * - glassQuietInteractive: quiet glass for a card that is one link (stretch the
 *   link over the card): the interactive variant's hover and focus ring
 *
 * `tier` (1 to 4) puts data-tier on the card and draws the 2 px tier top edge
 * (the tier colour fading to transparent); it works with every variant.
 *
 * No hooks, so it renders as a server component.
 */

export type CardVariant = 'surface' | 'interactive' | 'inset' | 'callout' | 'glass' | 'glassQuiet' | 'glassQuietInteractive';
export type CardTone = 'info' | 'success' | 'warning' | 'danger';
export type CardPadding = 'none' | 'compact' | 'default';

export const cardVariants = cva('rounded-xl text-card-foreground', {
  variants: {
    variant: {
      surface: 'border border-border bg-card shadow-card',
      interactive:
        'relative border border-border bg-card shadow-card transition-colors duration-150 ease-bench hover:border-input hover:bg-muted motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
      inset: 'bg-muted',
      callout: 'rounded-l-none border-l-2 text-foreground',
      // The glass and glass-quiet classes (globals.css) carry their own border, fill and shadow.
      glass: 'glass',
      glassQuiet: 'glass-quiet',
      glassQuietInteractive:
        'relative glass-quiet transition-colors duration-150 ease-bench hover:border-input hover:bg-muted motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
    },
    tone: {
      info: '',
      success: '',
      warning: '',
      danger: '',
    },
    // Cards pad 20 to 24 px, compact panels 16 (DESIGN.md section 5). The default
    // is none, so CardHeader, CardContent and CardFooter keep their own padding.
    padding: {
      none: '',
      compact: 'p-4',
      default: 'p-5 sm:p-6',
    },
  },
  compoundVariants: [
    { variant: 'callout', tone: 'info', className: 'border-l-info bg-info-subtle' },
    { variant: 'callout', tone: 'success', className: 'border-l-success bg-success-subtle' },
    { variant: 'callout', tone: 'warning', className: 'border-l-warning bg-warning-subtle' },
    { variant: 'callout', tone: 'danger', className: 'border-l-danger bg-danger-subtle' },
  ],
  defaultVariants: {
    variant: 'surface',
    tone: 'info',
    padding: 'none',
  },
});

/** The classes for a card, for an element that cannot be a Card itself (a Link, a summary row). */
/** The class that draws the tier top edge; the element also needs data-tier (cardTierProps gives both). */
export const CARD_TIER_EDGE_CLASS = 'tier-edge';

/**
 * data-tier for an element styled with cardClass({ tier }) that cannot be a Card
 * (a Link card): `<Link {...cardTierProps(2)} className={cardClass({ variant: 'glassQuiet', tier: 2 })}>`.
 */
export function cardTierProps(tier: TierNumber | undefined): { 'data-tier'?: `${TierNumber}` } {
  const value = tierDataAttribute(tier);
  return value ? { 'data-tier': value } : {};
}

export function cardClass({
  variant = 'surface',
  tone = 'info',
  padding = 'none',
  tier,
  className,
}: { variant?: CardVariant; tone?: CardTone; padding?: CardPadding; tier?: TierNumber; className?: string } = {}): string {
  return twMerge(clsx(cardVariants({ variant, tone, padding }), tier && CARD_TIER_EDGE_CLASS, className));
}

type CardElement = 'div' | 'article' | 'section' | 'li' | 'aside';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  /** The callout's role colour. Ignored by the other variants. */
  tone?: CardTone;
  padding?: CardPadding;
  /** The element; `li` in a list of cards, `article` for a self-contained item, `aside` for a callout. */
  as?: CardElement;
  /** The tier the card belongs to: sets data-tier (so tier-coloured children follow it) and draws the 2 px top edge. */
  tier?: TierNumber;
}

const Card: React.FC<CardProps> = ({ children, className, variant = 'surface', tone = 'info', padding = 'none', as = 'div', tier, ...props }) => {
  const Element = as;
  return (
    <Element
      data-card={variant}
      data-tone={variant === 'callout' ? tone : undefined}
      data-tier={tierDataAttribute(tier)}
      className={cardClass({ variant, tone, padding, tier, className })}
      {...props}
    >
      {children}
    </Element>
  );
};

type CardPartProps = React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string };

const CardHeader: React.FC<CardPartProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("p-6 flex flex-col space-y-1.5", className))} {...props}>
    {children}
  </div>
);
CardHeader.displayName = "CardHeader";

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className, ...props }) => (
  // The size token sits outside twMerge, which reads text-h3 as a colour and would drop it beside text-foreground.
  <h3 className={`text-h3 ${twMerge(clsx("text-foreground", className))}`} {...props}>
    {children}
  </h3>
);
CardTitle.displayName = "CardTitle";

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={`text-ui ${twMerge(clsx("text-muted-foreground", className))}`} {...props}>
    {children}
  </p>
);
CardDescription.displayName = "CardDescription";


const CardContent: React.FC<CardPartProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("p-6 pt-0", className))} {...props}>
    {children}
  </div>
);
CardContent.displayName = "CardContent";

const CardFooter: React.FC<CardPartProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("flex items-center p-6 pt-0", className))} {...props}>
    {children}
  </div>
);
CardFooter.displayName = "CardFooter";


export type { CardProps };
export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription };
