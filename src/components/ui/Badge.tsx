import React from "react";
import { Check } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { SignalTag } from "@/components/ui/SignalTag";
import { cn } from "@/lib/utils";

/*
 * Badge (SPEC-phases-2-4.md, "Primitives"). The original three variants
 * (default, secondary, outline) are unchanged. The page-structure variants:
 *
 * - code: a module code, milestone id or lesson reference; renders SignalTag
 * - status: a 6 px dot in the tone's colour and a label (the label carries the
 *   meaning, the dot only repeats it)
 * - level: Core, Elective or Expert as quiet outlined text
 * - count: a number in mono with tabular figures, as quiet text
 * - filter: a toggle chip, a button with aria-pressed
 *
 * No hooks, so every variant renders in a server component; a filter chip
 * needs an onClick, so it lives inside a client component.
 */

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium tabular-nums transition-colors duration-150 ease-bench",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        secondary: "border-border bg-card text-muted-foreground",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export { badgeVariants };

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export type Level = "core" | "elective" | "expert";

/** The words for each level, in sentence case. */
export const LEVEL_LABEL: Record<Level, string> = {
  core: "Core",
  elective: "Elective",
  expert: "Expert",
};

/** The status dot's colour per tone; neutral is the meta colour (not started, not applicable). */
export const STATUS_DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-subtle",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** status: the dot and the label, 12/16 at 500 in the secondary colour. */
export const STATUS_BADGE_CLASS = "inline-flex items-center gap-1.5 whitespace-nowrap text-label text-muted-foreground";

/** level: quiet outlined text, radius 4, hairline, 2 x 6 px padding like the signal tag but in the sans face. */
export const LEVEL_BADGE_CLASS =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded border border-border px-1.5 py-0.5 text-label text-muted-foreground";

/** count: mono 12/16 with tabular figures, secondary text, no box. */
export const COUNT_BADGE_CLASS = "inline-flex items-center font-mono text-label tabular-nums text-muted-foreground";

/**
 * filter: a 40 px toggle chip (a pill: chips are true toggles). Off: hairline
 * and secondary text, raised surface on hover. On: the raised surface, the
 * accent border and primary text, with a check so the state does not rest on
 * colour alone.
 */
export function filterChipClass(pressed: boolean): string {
  return cn(
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-ui font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    pressed
      ? "border-primary bg-muted text-foreground"
      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

type SpanAttributes = React.HTMLAttributes<HTMLSpanElement>;

/** The original variants: default, secondary, outline. */
export interface BasicBadgeProps extends SpanAttributes, VariantProps<typeof badgeVariants> {}

export interface CodeBadgeProps {
  variant: "code";
  code: string;
  href?: string;
  standalone?: boolean;
  label?: string;
  title?: string;
  className?: string;
}

export interface StatusBadgeProps extends SpanAttributes {
  variant: "status";
  /** Default neutral. */
  tone?: StatusTone;
}

export interface LevelBadgeProps extends SpanAttributes {
  variant: "level";
  /** Sets the words (Core, Elective, Expert); children override them. */
  level?: Level;
}

export interface CountBadgeProps extends SpanAttributes {
  variant: "count";
}

export interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  variant: "filter";
  pressed: boolean;
}

export type BadgeProps = BasicBadgeProps | CodeBadgeProps | StatusBadgeProps | LevelBadgeProps | CountBadgeProps | FilterChipProps;

export const StatusBadge = React.forwardRef<HTMLSpanElement, Omit<StatusBadgeProps, "variant">>(
  ({ tone = "neutral", className, children, ...props }, ref) => (
    <span ref={ref} data-badge="status" data-tone={tone} className={cn(STATUS_BADGE_CLASS, className)} {...props}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[tone])} />
      {children}
    </span>
  ),
);
StatusBadge.displayName = "StatusBadge";

export const LevelBadge = React.forwardRef<HTMLSpanElement, Omit<LevelBadgeProps, "variant">>(
  ({ level, className, children, ...props }, ref) => (
    <span ref={ref} data-badge="level" data-level={level} className={cn(LEVEL_BADGE_CLASS, className)} {...props}>
      {children ?? (level ? LEVEL_LABEL[level] : null)}
    </span>
  ),
);
LevelBadge.displayName = "LevelBadge";

export const CountBadge = React.forwardRef<HTMLSpanElement, Omit<CountBadgeProps, "variant">>(
  ({ className, ...props }, ref) => <span ref={ref} data-badge="count" className={cn(COUNT_BADGE_CLASS, className)} {...props} />,
);
CountBadge.displayName = "CountBadge";

export const FilterChip = React.forwardRef<HTMLButtonElement, Omit<FilterChipProps, "variant">>(
  ({ pressed, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      data-badge="filter"
      className={cn(filterChipClass(pressed), className)}
      {...props}
    >
      {pressed ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      {children}
    </button>
  ),
);
FilterChip.displayName = "FilterChip";

export const Badge = React.forwardRef<HTMLElement, BadgeProps>((props, ref) => {
  switch (props.variant) {
    case "code": {
      // SignalTag takes no ref; the tag itself is the badge.
      const { code, href, standalone, label, title, className } = props;
      return <SignalTag code={code} href={href} standalone={standalone} label={label} title={title} className={className} />;
    }
    case "status": {
      const { variant: _variant, ...rest } = props;
      return <StatusBadge ref={ref as React.Ref<HTMLSpanElement>} {...rest} />;
    }
    case "level": {
      const { variant: _variant, ...rest } = props;
      return <LevelBadge ref={ref as React.Ref<HTMLSpanElement>} {...rest} />;
    }
    case "count": {
      const { variant: _variant, ...rest } = props;
      return <CountBadge ref={ref as React.Ref<HTMLSpanElement>} {...rest} />;
    }
    case "filter": {
      const { variant: _variant, ...rest } = props;
      return <FilterChip ref={ref as React.Ref<HTMLButtonElement>} {...rest} />;
    }
    default: {
      const { className, variant, ...rest } = props;
      return <span ref={ref as React.Ref<HTMLSpanElement>} className={cn(badgeVariants({ variant, className }))} {...rest} />;
    }
  }
});

Badge.displayName = "Badge";

export default Badge;
