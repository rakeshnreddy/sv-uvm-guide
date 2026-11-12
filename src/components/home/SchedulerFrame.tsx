import Link from 'next/link';
import React from 'react';

import { Card } from '@/components/ui/Card';
import { classifyValue, fidelityLabels, ownerStyles, valueStyles } from '@/components/visual-system/visual-language';
import { formatValue, type SvValue } from '@/lib/sv-scheduler-model';
import { cn } from '@/lib/utils';

import { liveModelLink, type FrameRegion, type FrameRegionGroup, type FrameSignal, type SchedulerFrame as Frame } from './scheduler-frame';

/*
 * The hero's frame of the scheduler model (DESIGN.md section 11: the one
 * real-glass card on a hub page). Static server markup, no hooks and no
 * client code. Colours follow the protected encodings in
 * src/components/visual-system/visual-language.ts and the live RegionLadder:
 * read-only regions dashed slate, the active region set cyan, Observed sky,
 * the reactive set violet, the executing region cyan with a ▶ marker; logic 1
 * is cyan, 0 slate; design code carries the violet DUT tag. Code sits on the
 * solid code surface, never on glass.
 */

/** Rung borders and fills per region family, as the live ladder draws them. */
const FAMILY_ROW_CLASS: Record<FrameRegion['family'], string> = {
  readOnly: 'border-dashed border-slate-400/80 bg-slate-500/10',
  activeSet: 'border-cyan-600/50 bg-cyan-500/10 dark:border-cyan-400/50',
  observed: 'border-sky-600/50 bg-sky-500/10 dark:border-sky-400/50',
  reactiveSet: 'border-violet-600/50 bg-violet-500/10 dark:border-violet-400/50',
};

const EXECUTING_ROW_CLASS = 'border-cyan-500 bg-cyan-400/25 ring-1 ring-inset ring-cyan-500';

/** The loop rail beside each iterative group: the active set (with Observed) repeats, then the reactive set. */
const GROUP_RAIL_CLASS: Record<FrameRegionGroup['id'], string> = {
  preponed: 'border-transparent',
  activeSet: 'border-cyan-600/60 dark:border-cyan-400/60',
  reactiveSet: 'border-violet-600/60 dark:border-violet-400/60',
  postponed: 'border-transparent',
};

const GROUP_LABEL: Record<FrameRegionGroup['id'], string> = {
  preponed: 'Read-only: sample values',
  activeSet: 'Active region set and Observed, repeated until empty',
  reactiveSet: 'Reactive region set, repeated until empty',
  postponed: 'Read-only: final values',
};

function regionStatus(region: FrameRegion): string {
  if (region.executing) return 'executing';
  return region.queued.length ? `${region.queued.length} queued` : '';
}

export function RegionLadderFrame({ groups }: { groups: readonly FrameRegionGroup[] }) {
  return (
    <div data-frame-part="ladder" className="flex flex-col gap-2">
      {groups.map((group) => (
        <ul key={group.id} aria-label={GROUP_LABEL[group.id]} className={cn('flex flex-col gap-1 border-l-2 pl-2', GROUP_RAIL_CLASS[group.id])}>
          {group.regions.map((region) => {
            const status = regionStatus(region);
            return (
              <li
                key={region.id}
                data-region={region.id}
                aria-current={region.executing ? 'step' : undefined}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md border px-2 text-ui',
                  region.executing ? EXECUTING_ROW_CLASS : FAMILY_ROW_CLASS[region.family],
                )}
              >
                <span aria-hidden="true" className="w-3 shrink-0 text-label text-cyan-700 dark:text-cyan-300">
                  {region.executing ? '▶' : ''}
                </span>
                <span className="font-medium text-foreground">{region.label}</span>
                {status ? (
                  <span className="ml-auto whitespace-nowrap font-mono text-label tabular-nums text-muted-foreground">{status}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

export function CodeFrame({ frame }: { frame: Frame }) {
  return (
    <figure data-frame-part="code" className="overflow-hidden rounded-lg border border-code-border bg-code-surface text-code-foreground">
      <figcaption className="flex items-center justify-between gap-3 border-b border-code-border px-3 py-2 text-label text-code-muted">
        <span>Code under simulation</span>
        <span className="font-mono tabular-nums">{frame.timeLabel}</span>
      </figcaption>
      <ol aria-label="Code under simulation" className="py-2 font-mono text-[0.75rem] leading-[1.375rem] [font-variant-ligatures:none] sm:text-code">
        {frame.code.map((line) => {
          const owner = line.owner ? ownerStyles[line.owner] : undefined;
          return (
            <li
              key={line.number}
              aria-current={line.current ? 'step' : undefined}
              className={cn('flex min-h-[22px] items-start gap-2 border-l-2 pr-3', line.current ? 'border-cyan-400 bg-cyan-400/15' : 'border-transparent')}
            >
              <span aria-hidden="true" className="w-6 shrink-0 select-none text-right text-code-muted">
                {line.number}
              </span>
              <span aria-hidden="true" className="w-9 shrink-0">
                {owner && line.text ? <span className={cn('inline-block border px-1 text-label leading-4', owner.panelClassName)}>{owner.tag}</span> : null}
              </span>
              <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {line.current ? <span className="sr-only">Executing: </span> : null}
                {line.text || ' '}
              </code>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-code-border px-3 py-2 font-mono text-label text-code-foreground">
        <span className="text-code-muted">
          step {frame.stepIndex + 1} of {frame.stepCount}:
        </span>{' '}
        {frame.narration}
      </p>
    </figure>
  );
}

const STEP_W = 10;
/** Row height and the two levels: 8 px between one row's low and the next row's high, so traces read as separate signals. */
const ROW_H = 28;
const HI = 6;
const LO = 20;

const isUnknown = (value: SvValue | undefined) => value === undefined || value === 'X';

/** The path of one single-bit trace across the steps (x in step units, y within its row). */
export function bitTracePath(values: readonly SvValue[], top = 0): string {
  const level = (value: SvValue) => top + (value === 1 ? HI : LO);
  let d = '';
  values.forEach((value, index) => {
    if (isUnknown(value)) return;
    const x0 = index * STEP_W;
    const y = level(value);
    const prev = values[index - 1];
    if (index > 0 && !isUnknown(prev) && prev !== value) d += `M${x0},${level(prev)} L${x0},${y} `;
    d += `M${x0},${y} L${x0 + STEP_W},${y} `;
  });
  return d.trim();
}

export function WaveformFrame({ signals, currentIndex, timeLabel }: { signals: readonly FrameSignal[]; currentIndex: number; timeLabel: string }) {
  const steps = signals[0]?.values.length ?? 0;
  const width = steps * STEP_W;
  const height = signals.length * ROW_H;
  const cursorLeft = `${(currentIndex / steps) * 100}%`;
  const cursorWidth = `${(1 / steps) * 100}%`;
  return (
    <figure data-frame-part="waveform" className="min-w-0">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
        <ul aria-hidden="true" className="font-mono text-label text-muted-foreground">
          {signals.map((signal) => (
            <li key={signal.name} className="flex h-7 items-center">
              {signal.name}
            </li>
          ))}
        </ul>
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-y-0 rounded-sm border border-cyan-500/60 bg-cyan-400/15" style={{ left: cursorLeft, width: cursorWidth }} />
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="relative block w-full"
            style={{ height }}
            role="img"
            aria-label={`Waveform of ${signals.map((s) => s.name).join(', ')} across ${steps} scheduler steps; the cursor is on step ${currentIndex + 1}.`}
          >
            <defs>
              <pattern id="hero-wave-x" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" className="stroke-rose-500/70" strokeWidth="1.5" />
              </pattern>
            </defs>
            {signals.map((signal, row) => (
              <g key={signal.name}>
                {row > 0 ? (
                  <line x1={0} x2={width} y1={row * ROW_H} y2={row * ROW_H} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ) : null}
                {signal.values.map((value, index) =>
                  isUnknown(value) ? <rect key={index} x={index * STEP_W} y={row * ROW_H + HI} width={STEP_W} height={LO - HI} fill="url(#hero-wave-x)" /> : null,
                )}
                <path
                  d={bitTracePath(signal.values, row * ROW_H)}
                  fill="none"
                  className="stroke-cyan-600 dark:stroke-cyan-400"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="square"
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <figcaption className="mt-2 text-label text-muted-foreground">Scheduler steps inside {timeLabel}. A waveform viewer draws all of this at one instant.</figcaption>
    </figure>
  );
}

function ValueChips({ values }: { values: Frame['values'] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map(({ name, value }) => {
        const style = valueStyles[classifyValue(value)];
        return (
          <li key={name} className={cn('rounded border px-1.5 py-0.5 font-mono text-label tabular-nums', style.className)} title={style.cue}>
            {name} = {formatValue(value)}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The frame itself: the glass card with the code, the ladder and (from 640
 * px) the waveform, values and the NBA queue; then the caption and the link to
 * the live model. On phones only the code and the ladder show.
 */
export default function SchedulerFrame({ frame }: { frame: Frame }) {
  const nbaQueue = frame.groups.flatMap((group) => group.regions).find((region) => region.id === 'nba')?.queued ?? [];
  return (
    <figure aria-labelledby="hero-frame-title" data-testid="hero-frame" className="min-w-0">
      <Card variant="glass" padding="default" className="flex flex-col gap-4 p-4 sm:p-6" data-testid="home-hero-card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-ui font-medium text-foreground">{frame.title}</p>
          <p className="text-label text-muted-foreground">{fidelityLabels.model.title}</p>
        </div>
        <CodeFrame frame={frame} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
          <RegionLadderFrame groups={frame.groups} />
          <div data-frame-part="state" className="hidden min-w-0 flex-col gap-4 sm:flex">
            <WaveformFrame signals={frame.signals} currentIndex={frame.stepIndex} timeLabel={frame.timeLabel} />
            <div>
              <p className="mb-1.5 text-label text-muted-foreground">Values after this step</p>
              <ValueChips values={frame.values} />
            </div>
            {nbaQueue.length ? (
              <div>
                <p className="mb-1.5 text-label text-muted-foreground">Waiting in NBA</p>
                <ul className="flex flex-wrap gap-1.5">
                  {nbaQueue.map((label) => (
                    <li key={label} className="rounded border border-cyan-600/50 px-1.5 py-0.5 font-mono text-label text-foreground dark:border-cyan-400/50">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-ui">
        <span id="hero-frame-title" className="text-muted-foreground">
          One time slot, region by region
        </span>
        <span className="text-muted-foreground">
          <Link
            href={liveModelLink()}
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open the live model
          </Link>
          {" "}on <span className="whitespace-nowrap font-mono text-foreground">{frame.scenarioLabel}</span>
        </span>
      </figcaption>
    </figure>
  );
}
