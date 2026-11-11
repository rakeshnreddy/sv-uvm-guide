'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { SignalTag } from '@/components/ui/SignalTag';
import type { ContinueLessonEntry } from '@/lib/continue-lesson';
import { useContinueLesson } from '@/hooks/useContinueLesson';
import type { StaticTier } from '@/lib/learner-stats';
import { useHydrated, useRecord } from '@/lib/learner-store/react';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import {
  TRACE_LEVEL,
  TRACE_STATE_LABEL,
  TRACE_STATES,
  initialTraceIndex,
  progressTraces,
  readoutIndex,
  tierTrace,
  traceKeyTarget,
  traceSegmentName,
  traceSummary,
  type TierTrace,
  type TraceSegment,
  type TraceState,
} from '@/lib/progress-trace';
import { tierDataAttribute } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

/*
 * The progress trace (SPEC-phases-2-4.md, "Progress trace"): one tier drawn as
 * a signal in the tier's colour, one segment per module. Low is not started,
 * half height with a dashed top is opened, high is done; a thin accent cursor
 * marks the module of the lesson to continue. The heights and the dashed top
 * carry the state, so colour is never the only cue.
 *
 * Two sizes from one component:
 * - full (the dashboard): every segment is a link to its module, named with
 *   the module code, title and state. One tab stop per trace (a roving
 *   tabindex): Left and Right move between segments, Home and End jump to the
 *   ends, Enter follows the link. A readout under the trace names the segment
 *   under the pointer or focus, like a waveform viewer's cursor value; at rest
 *   it names the cursor's module, and is empty in a tier without the cursor.
 *   The cursor is a shape as well as a colour: a small flag over the trace
 *   and a line with a halo, so it stands out on a trace of a similar hue.
 *   Below 640 px the segments are too narrow to tap (a 26-module tier gives
 *   14 px each), so they take no pointer input there; a disclosure under the
 *   readout lists every module as a 40 px row instead. The keyboard path
 *   through the segments stays at every width.
 * - mini (a tier heading): one line of text tall, not interactive, read as one
 *   image whose name gives the tier's totals. The modules it draws are listed
 *   as links right under the heading it sits in, and segments 8 px wide would
 *   be too small to click.
 *
 * Both have a fixed height, so the not-started trace the server renders keeps
 * its place when the browser's progress arrives. The only motion is a 150 ms
 * colour change on hover and a 200 ms move of the levels when progress loads,
 * both by colour or transform and both off under reduced motion.
 */

export type ProgressTraceSize = 'full' | 'mini';

const FILL_STYLE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, hsl(var(--tier-current) / 0.3), hsl(var(--tier-current) / 0.06))',
};

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/** Positions move by transform only, so a change of state is not a layout shift and can ease. */
const MOVE = 'transition-transform duration-200 ease-bench motion-reduce:transition-none';

/**
 * One segment's drawing: the level line (dashed when opened), the fill under
 * it, the edge from the previous segment's level and the grid tick at the
 * boundary. Every part spans the drawing area and is placed with a transform.
 * Decorative: the segment's name carries the state.
 */
function SegmentDrawing({
  state,
  previous,
  size,
  dash = size === 'full' ? 'dashed' : 'dotted',
}: {
  state: TraceState;
  previous: TraceState | undefined;
  size: ProgressTraceSize;
  /** The opened top: dashed at full size (and in the legend, which keys the full trace), dotted in the miniature. */
  dash?: 'dashed' | 'dotted';
}) {
  const level = TRACE_LEVEL[state];
  const previousLevel = previous === undefined ? level : TRACE_LEVEL[previous];
  const low = Math.min(level, previousLevel);
  const high = Math.max(level, previousLevel);
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0', size === 'full' ? 'inset-y-2' : 'inset-y-0.5')}>
      {size === 'full' && previous !== undefined ? <span className="absolute -inset-y-2 left-0 w-px bg-border" /> : null}
      <span
        data-trace-part="fill"
        className={cn('absolute inset-0 origin-bottom', MOVE)}
        style={{ ...FILL_STYLE, transform: `scaleY(${level})` }}
      />
      {/* A full-height box whose top edge is the level line, moved down from the top. */}
      <span data-trace-part="level" className={cn('absolute inset-0', MOVE)} style={{ transform: `translateY(${percent(1 - level)})` }}>
        <span
          className={cn(
            'absolute inset-x-0 -top-0.5 h-0 border-t-2 border-tier-current',
            state === 'opened' && (dash === 'dashed' ? 'border-dashed' : 'border-dotted'),
          )}
        />
      </span>
      {high > low ? (
        <span
          data-trace-part="edge"
          className="absolute inset-y-0 left-0 -ml-px origin-top border-l-2 border-tier-current"
          style={{ transform: `translateY(${percent(1 - high)}) scaleY(${high - low})` }}
        />
      ) : null}
    </span>
  );
}

/**
 * The cursor. Full size: a thin accent line through the module the learner is
 * in, with a 1 px halo in the surface colour so it separates from a level or
 * edge of a similar hue (the tier 2 blue sits close to the accent). Miniature:
 * a small accent tick under the segment, beside the drawing rather than over
 * it, since an 8 px segment has no room for a line and its level both.
 */
function Cursor({ size }: { size: ProgressTraceSize }) {
  return (
    <span
      aria-hidden="true"
      data-trace-part="cursor"
      className={cn(
        'pointer-events-none absolute left-1/2 -ml-px border-l-2 border-primary forced-colors:border-[Highlight]',
        size === 'full' ? 'inset-y-0.5 shadow-[0_0_0_1px_hsl(var(--card))]' : '-bottom-1 h-1',
      )}
    />
  );
}

/**
 * The cursor's flag: a small accent triangle above the full trace, pointing
 * down at the cursor's segment. A shape cue that does not depend on hue. It
 * sits in the padding over the trace's box, outside the box's clipping.
 */
function CursorFlag({ index, count }: { index: number; count: number }) {
  return (
    <span
      aria-hidden="true"
      data-trace-part="cursor-flag"
      className="pointer-events-none absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-primary forced-colors:border-t-[Highlight]"
      style={{ left: percent((index + 0.5) / count) }}
    />
  );
}

/**
 * Every module of a tier as a list of 40 px rows, for phones, where the
 * trace's segments are too narrow to tap. Closed by default, so the trace
 * stays the picture; hidden from 640 px, where the segments are wide enough.
 */
function TraceModuleList({ trace }: { trace: TierTrace }) {
  const count = trace.segments.length;
  return (
    <details data-testid="progress-trace-modules" className="sm:hidden">
      <summary className="flex min-h-10 cursor-pointer items-center rounded-sm text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        All {count} {count === 1 ? 'module' : 'modules'}
      </summary>
      <ul aria-label={`All modules in ${trace.label}`} className="divide-y divide-border">
        {trace.segments.map((segment) => (
          <li key={segment.id}>
            <Link
              href={segment.href}
              className="grid min-h-10 min-w-0 grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {/* A fixed tag column, so the titles line up whatever the code's length. */}
              <SignalTag code={segment.code} className="justify-self-start" />
              <span className="min-w-0 truncate text-foreground">{segment.title}</span>
              <span className="shrink-0 text-muted-foreground">
                {TRACE_STATE_LABEL[segment.state]}
                {segment.current ? ', where you are' : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The three states in words, each beside a small drawing of its level. */
export function ProgressTraceLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Trace key" className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 text-ui text-muted-foreground', className)}>
      {TRACE_STATES.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <span aria-hidden="true" className="relative inline-block h-3 w-6">
            <SegmentDrawing state={state} previous={undefined} size="mini" dash="dashed" />
          </span>
          {TRACE_STATE_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}

function FullTrace({ trace, className }: { trace: TierTrace; className?: string }) {
  const hintId = useId();
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const count = trace.segments.length;
  const initial = initialTraceIndex(trace);
  const [active, setActive] = useState(initial);
  const [moved, setMoved] = useState(false);
  const [shown, setShown] = useState<number | null>(null);

  // Until the learner moves the tab stop, it follows the cursor (which arrives with the browser's progress).
  useEffect(() => {
    if (!moved) setActive(initial);
  }, [initial, moved]);

  const focusSegment = useCallback((index: number) => {
    setActive(index);
    setMoved(true);
    links.current[index]?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = traceKeyTarget(event.key, active, count);
    if (target === null) return;
    event.preventDefault();
    focusSegment(target);
  };

  const readoutAt = readoutIndex(shown, trace.cursorIndex);
  const readout: TraceSegment | undefined = readoutAt === null ? undefined : trace.segments[readoutAt];

  return (
    <div data-testid="progress-trace" data-size="full" data-tier={tierDataAttribute(trace.tier)} className={cn('min-w-0', className)}>
      {/* pt-2 holds the cursor's flag above the box, outside its clipping; it is reserved with or without a cursor. */}
      <div className="relative pt-2">
        {trace.cursorIndex >= 0 ? <CursorFlag index={trace.cursorIndex} count={count} /> : null}
        <ol
          aria-label={`${trace.label} modules`}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setShown(null)}
          className="relative flex h-14 overflow-hidden rounded-lg border border-border bg-card"
        >
          {trace.segments.map((segment, index) => (
            <li key={segment.id} className="relative min-w-0 flex-1">
              <Link
                ref={(node) => {
                  links.current[index] = node;
                }}
                href={segment.href}
                tabIndex={index === active ? 0 : -1}
                aria-label={traceSegmentName(segment)}
                data-state={segment.state}
                data-current={segment.current ? '' : undefined}
                onFocus={() => {
                  setActive(index);
                  setShown(index);
                }}
                onBlur={() => setShown(null)}
                onMouseEnter={() => setShown(index)}
                className="absolute inset-0 block transition-colors duration-150 ease-bench hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground motion-reduce:transition-none max-sm:pointer-events-none"
              >
                <SegmentDrawing state={segment.state} previous={trace.segments[index - 1]?.state} size="full" />
                {segment.current ? <Cursor size="full" /> : null}
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <p aria-hidden="true" data-testid="progress-trace-readout" className="mt-2 flex h-6 min-w-0 items-center gap-2 text-ui text-muted-foreground">
        {readout ? (
          <>
            <SignalTag code={readout.code} />
            <span className="min-w-0 truncate text-foreground">{readout.title}</span>
            <span className="shrink-0">
              {TRACE_STATE_LABEL[readout.state]}
              {readout.current ? ', where you are' : ''}
            </span>
          </>
        ) : null}
      </p>
      <TraceModuleList trace={trace} />
      <p id={hintId} className="sr-only">
        {traceSummary(trace)}. Left and right arrow keys move between modules.
      </p>
    </div>
  );
}

function MiniTrace({ trace, className }: { trace: TierTrace; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${trace.label}: ${traceSummary(trace)}`}
      data-testid="progress-trace"
      data-size="mini"
      data-tier={tierDataAttribute(trace.tier)}
      className={cn('inline-flex h-3.5 shrink-0 align-middle', className)}
    >
      {trace.segments.map((segment, index) => (
        <span key={segment.id} data-state={segment.state} data-current={segment.current ? '' : undefined} className="relative h-full w-2">
          <SegmentDrawing state={segment.state} previous={trace.segments[index - 1]?.state} size="mini" />
          {segment.current ? <Cursor size="mini" /> : null}
        </span>
      ))}
    </span>
  );
}

export interface ProgressTraceViewProps {
  trace: TierTrace;
  size?: ProgressTraceSize;
  className?: string;
}

/** A trace from data already worked out (src/lib/progress-trace.ts). */
export function ProgressTraceView({ trace, size = 'full', className }: ProgressTraceViewProps) {
  return size === 'mini' ? <MiniTrace trace={trace} className={className} /> : <FullTrace trace={trace} className={className} />;
}

export interface ProgressTraceProps {
  /** The tier, built on the server (buildCurriculumTotals). */
  tier: StaticTier;
  /** Every lesson in course order (continueLessons()), for the cursor. */
  continueLessons: readonly ContinueLessonEntry[];
  size?: ProgressTraceSize;
  className?: string;
}

/**
 * A tier's trace that reads this browser's progress itself, for pages that do
 * not read the learner records already (the curriculum index and the landing
 * page). The server render and the hydrating render draw every module not
 * started, in the same box.
 */
/**
 * A tier's trace from this browser's progress, with the cursor on the lesson
 * at `cursorHref`. Before hydration (and on the server) every module is drawn
 * not started, so the first render matches the server HTML. Null for no tier.
 */
export function useTierTrace(tier: StaticTier, cursorHref: string | null): TierTrace;
export function useTierTrace(tier: StaticTier | null, cursorHref: string | null): TierTrace | null;
export function useTierTrace(tier: StaticTier | null, cursorHref: string | null): TierTrace | null {
  const hydrated = useHydrated();
  const progress = useRecord(curriculumProgressRecord);
  const lessonLog = useRecord(lessonLogRecord);
  return useMemo(() => {
    if (!tier) return null;
    return hydrated ? progressTraces([tier], progress, lessonLog, cursorHref)[0] : tierTrace(tier, null);
  }, [hydrated, tier, progress, lessonLog, cursorHref]);
}

export function ProgressTrace({ tier, continueLessons, size = 'full', className }: ProgressTraceProps) {
  const position = useContinueLesson(continueLessons);
  const trace = useTierTrace(tier, position?.lesson.href ?? null);
  return <ProgressTraceView trace={trace} size={size} className={className} />;
}

export default ProgressTrace;
