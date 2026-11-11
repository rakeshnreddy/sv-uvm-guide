import React from 'react';
import { Check } from 'lucide-react';

import type { InterviewLevelOption } from '@/app/(learning)/interview-prep/interview-banks';
import { cn } from '@/lib/utils';

import {
  ALL_LEVELS,
  ALL_LEVELS_LABEL,
  LEVEL_COUNT_ATTRIBUTE,
  LEVEL_FILTER_ATTRIBUTE,
  LEVEL_STATUS_ATTRIBUTE,
  NOSCRIPT_CSS,
  REQUIRES_SCRIPT_ATTRIBUTE,
  levelBootScript,
  levelCountText,
  levelFilterCss,
  levelRadioSyncScript,
} from './level-filter';

/*
 * Server markup for the level filter: a labelled radio group, the CSS that
 * applies a level from <html data-interview-level>, the inline script that
 * restores this browser's choice before first paint, and the polite live
 * region the controller writes the new count into.
 */

const RADIO_NAME = 'interview-level';

/**
 * The rules and the pre-paint script. Put it before anything level-aware (the
 * first child of the page), so no count or row paints at the wrong level.
 */
export function LevelFilterSetup({ levels }: { levels: readonly InterviewLevelOption[] }) {
  const values = levels.map((level) => level.value);
  return (
    <>
      <style data-interview-level-css="" dangerouslySetInnerHTML={{ __html: levelFilterCss(values) }} />
      <script data-interview-level-boot="" dangerouslySetInnerHTML={{ __html: levelBootScript(values) }} />
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} />
      </noscript>
    </>
  );
}

const chipClass = cn(
  // border-input: the 3:1 control boundary, so each chip reads as a control.
  'relative inline-flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-lg border border-input px-3 text-ui font-medium text-muted-foreground',
  'transition-colors duration-150 ease-bench hover:bg-muted hover:text-foreground motion-reduce:transition-none',
  // The checked chip: an accent tint, an accent boundary drawn 2 px (inset, so nothing moves), foreground text and a check mark.
  'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-foreground has-[:checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary))]',
  'forced-colors:has-[:checked]:border-[Highlight]',
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
);

export interface LevelFilterProps {
  levels: readonly InterviewLevelOption[];
  className?: string;
}

/** The radio group. It needs scripts, so a noscript rule hides it (every level then shows). */
export function LevelFilter({ levels, className }: LevelFilterProps) {
  const options = [{ value: ALL_LEVELS, label: ALL_LEVELS_LABEL }, ...levels];
  const values = levels.map((level) => level.value);
  return (
    <div {...{ [REQUIRES_SCRIPT_ATTRIBUTE]: '' }} className={className}>
      <fieldset {...{ [LEVEL_FILTER_ATTRIBUTE]: '' }} className="min-w-0 border-0 p-0">
        <legend className="mb-2 text-ui font-medium text-foreground">Level</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <label key={option.value} className={chipClass}>
              <input
                type="radio"
                name={RADIO_NAME}
                value={option.value}
                defaultChecked={option.value === ALL_LEVELS}
                className="peer sr-only"
              />
              <Check aria-hidden="true" strokeWidth={3} className="hidden h-3.5 w-3.5 shrink-0 text-primary peer-checked:block" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {/* Restores the radio before first paint; the CSS rules already follow <html>. */}
      <script dangerouslySetInnerHTML={{ __html: levelRadioSyncScript(values) }} />
      <p className="sr-only" aria-live="polite" {...{ [LEVEL_STATUS_ATTRIBUTE]: '' }} />
    </div>
  );
}

export interface LevelCountProps {
  /** Count per level, plus `all`. */
  counts: Readonly<Record<string, number>>;
  levels: readonly InterviewLevelOption[];
  /** `phrase`: "48 questions", "16 junior questions". `number`: "48", with "questions" for screen readers. */
  format?: 'phrase' | 'number';
  className?: string;
}

/** Every variant of a count; the filter's CSS shows the one for the chosen level. */
export function LevelCount({ counts, levels, format = 'phrase', className }: LevelCountProps) {
  const variants = [{ value: ALL_LEVELS, label: undefined as string | undefined }, ...levels];
  return (
    <span className={cn('tabular-nums', className)}>
      {variants.map((variant) => {
        const count = counts[variant.value] ?? 0;
        return (
          <span key={variant.value} {...{ [LEVEL_COUNT_ATTRIBUTE]: variant.value }}>
            {format === 'number' ? (
              <>
                {count}
                <span className="sr-only">
                  {' '}
                  {variant.label ? `${variant.label.toLowerCase()} ` : ''}
                  {count === 1 ? 'question' : 'questions'}
                </span>
              </>
            ) : (
              levelCountText(count, variant.label)
            )}
          </span>
        );
      })}
    </span>
  );
}

/** "Expand all" and "Collapse all": they need scripts, so a noscript rule hides them when scripts are off. */
export function DisclosureTools({ expandLabel, className }: { expandLabel: string; className?: string }) {
  const button = cn(
    'inline-flex min-h-10 items-center rounded-lg border border-border bg-muted px-3 text-ui font-medium text-foreground',
    'transition-colors duration-150 ease-bench hover:bg-card motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  );
  return (
    <div {...{ [REQUIRES_SCRIPT_ATTRIBUTE]: '' }} className={cn('flex flex-wrap gap-2', className)}>
      <button type="button" data-interview-action="expand" className={button}>
        {expandLabel}
      </button>
      <button type="button" data-interview-action="collapse" className={button}>
        Collapse all
      </button>
    </div>
  );
}
