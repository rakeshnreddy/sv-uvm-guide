import React from 'react';

import type { InterviewLevelOption } from '@/app/(learning)/interview-prep/interview-banks';
import { cn } from '@/lib/utils';

import { ALL_LEVELS, LEVEL_COUNT_ATTRIBUTE, REQUIRES_SCRIPT_ATTRIBUTE } from './level-filter';
import {
  CHECK_SYMBOL_ID,
  HIDE_PRACTISED_INPUT_ATTRIBUTE,
  PRACTISED_ALL_HIDDEN_ATTRIBUTE,
  PRACTISED_COUNT_ATTRIBUTE,
  PRACTISED_EMPTY_ATTRIBUTE,
  PRACTISED_SCOPE_ATTRIBUTE,
  QUESTION_TOTAL_ATTRIBUTE,
  SHOW_PRACTISED_ACTION_ATTRIBUTE,
  practisedBootScript,
  practisedCss,
} from './practised-marks';

/*
 * Server markup for the practised marks (practised-marks.ts): the CSS and the
 * pre-paint script, the count variants the script fills, the "Hide practised"
 * box and the note shown when everything on view is practised and hidden.
 */

/** The rules and the pre-paint script. Put it after LevelFilterSetup and before anything it paints. */
export function PractisedSetup({ levels, scope }: { levels: readonly InterviewLevelOption[]; scope: string }) {
  return (
    <>
      <style data-practised-css="" dangerouslySetInnerHTML={{ __html: practisedCss(levels.map((level) => level.value)) }} />
      <script data-practised-boot="" dangerouslySetInnerHTML={{ __html: practisedBootScript(scope) }} />
      {/* The check mark the rows and toggles use by reference. */}
      <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute" data-practised-symbols="">
        <symbol id={CHECK_SYMBOL_ID} viewBox="0 0 16 16">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      </svg>
    </>
  );
}

export interface PractisedCountProps {
  /** A bank's slug, or ALL_BANKS for every bank. */
  scope: string;
  /** Question count per level, plus `all`: the "of M". */
  counts: Readonly<Record<string, number>>;
  levels: readonly InterviewLevelOption[];
  className?: string;
}

/**
 * "3 of 48 practised", one variant per level like LevelCount, so the level
 * filter's CSS shows the one for the chosen level. Every variant starts empty
 * and hidden; the script fills it from this browser's marks. Its text is the
 * script's alone, so React leaves it (dangerouslySetInnerHTML, no children).
 */
export function PractisedCount({ scope, counts, levels, className }: PractisedCountProps) {
  // A level with no questions here never has a count to show, so it gets no variant.
  const variants = [ALL_LEVELS, ...levels.map((level) => level.value)].filter((value) => (counts[value] ?? 0) > 0);
  return (
    <span className={cn('tabular-nums', className)} data-practised-counts="">
      {variants.map((value) => (
        <span
          key={value}
          {...{
            [PRACTISED_COUNT_ATTRIBUTE]: '',
            [PRACTISED_SCOPE_ATTRIBUTE]: scope,
            [LEVEL_COUNT_ATTRIBUTE]: value,
            [QUESTION_TOTAL_ATTRIBUTE]: String(counts[value] ?? 0),
            [PRACTISED_EMPTY_ATTRIBUTE]: '',
          }}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: '' }}
        />
      ))}
    </span>
  );
}

/** "Hide practised": a checkbox styled like the level chips. It needs scripts, so a noscript rule hides it. */
export function HidePractisedToggle({ className }: { className?: string }) {
  return (
    <div {...{ [REQUIRES_SCRIPT_ATTRIBUTE]: '' }} className={className}>
      <label
        className={cn(
          'inline-flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg border border-input px-3 text-ui font-medium text-muted-foreground',
          'transition-colors duration-150 ease-bench hover:bg-muted hover:text-foreground motion-reduce:transition-none',
          'has-[:checked]:text-foreground',
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
        )}
      >
        <input
          type="checkbox"
          {...{ [HIDE_PRACTISED_INPUT_ATTRIBUTE]: '' }}
          className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none"
        />
        Hide practised
      </label>
    </div>
  );
}

/** Shown (by the CSS) when "Hide practised" leaves nothing on view, with the way back. */
export function PractisedAllHiddenNote({ className }: { className?: string }) {
  return (
    <div
      {...{ [PRACTISED_ALL_HIDDEN_ATTRIBUTE]: '', [REQUIRES_SCRIPT_ATTRIBUTE]: '' }}
      className={cn('rounded-lg border border-border bg-card px-4 py-4', className)}
    >
      <p className="text-body text-foreground">Every question shown here is practised.</p>
      <button
        type="button"
        {...{ [SHOW_PRACTISED_ACTION_ATTRIBUTE]: '' }}
        className={cn(
          'mt-3 inline-flex min-h-10 items-center rounded-lg border border-border bg-muted px-3 text-ui font-medium text-foreground',
          'transition-colors duration-150 ease-bench hover:bg-background motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        Show practised questions
      </button>
    </div>
  );
}
