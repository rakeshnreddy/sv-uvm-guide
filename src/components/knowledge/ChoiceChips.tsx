'use client';

import React, { useRef } from 'react';
import { Check } from 'lucide-react';

import { tierDataAttribute, type TierNumber } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

/*
 * A small set of exclusive choices drawn as chips: the site's pattern from the
 * interview level filter (40 px chips, the 3:1 control boundary, a check on the
 * chosen one). A chip that names a tier carries the tier's step mark, and when
 * chosen it takes the tier's fill and boundary instead of the accent
 * (DESIGN.md section 11: tier colour always travels with the tier's name).
 *
 * Semantics: a WAI-ARIA radio group with a roving tab stop. Tab enters on the
 * chosen chip, the arrow keys move and choose, Home and End jump to the ends.
 */

export interface ChoiceChipOption<T extends string> {
  value: T;
  label: string;
  /** The tier this chip names, if any: it adds the step mark and the tier-coloured chosen state. */
  tier?: TierNumber;
}

export interface ChoiceChipsProps<T extends string> {
  /** The group's accessible name. */
  label: string;
  options: readonly ChoiceChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'data-testid'?: string;
}

const CHIP_BASE =
  'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-ui font-medium transition-colors duration-150 ease-bench motion-reduce:transition-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Not chosen: the control boundary (border-input, 3:1), secondary text, a raised surface on hover. */
const CHIP_IDLE = 'border-input text-muted-foreground hover:bg-muted hover:text-foreground';

/** Chosen, no tier: the accent tint with a 2 px accent boundary drawn inset, so nothing moves. */
const CHIP_CHOSEN = 'border-primary bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary))] forced-colors:border-[Highlight]';

/** Chosen, a tier: the tier's subtle fill and a 2 px boundary in the tier colour. */
const CHIP_CHOSEN_TIER =
  'border-tier-current bg-tier-current-subtle text-foreground shadow-[inset_0_0_0_1px_hsl(var(--tier-current))] forced-colors:border-[Highlight]';

/** The classes for one chip; exported for tests. */
export function choiceChipClass(chosen: boolean, tiered: boolean): string {
  return cn(CHIP_BASE, chosen ? (tiered ? CHIP_CHOSEN_TIER : CHIP_CHOSEN) : CHIP_IDLE);
}

/** The index the arrow, Home and End keys move to, or null for any other key. */
export function nextChoiceIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function ChoiceChips<T extends string>({ label, options, value, onChange, className, 'data-testid': testId }: ChoiceChipsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosenIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextChoiceIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} data-testid={testId} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option, index) => {
        const chosen = option.value === value;
        const tiered = option.tier !== undefined;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={index === chosenIndex ? 0 : -1}
            data-tier={tierDataAttribute(option.tier)}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={choiceChipClass(chosen, tiered)}
          >
            {/* The chosen chip shows a check as well as its fill and 2 px boundary, so the state never rests on colour alone. */}
            {chosen && (
              <Check aria-hidden="true" strokeWidth={3} className={cn('-ml-0.5 h-3.5 w-3.5 shrink-0', tiered ? 'text-tier-current' : 'text-primary')} />
            )}
            {tiered && <span className="tier-step" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ChoiceChips;
