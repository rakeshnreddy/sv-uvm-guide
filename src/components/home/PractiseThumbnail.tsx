import React from 'react';

import { SignalTag } from '@/components/ui/SignalTag';
import { tierDataAttribute, tierOfModuleCode } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

import type { LabThumbnail, PractiseThumbnails, QuestionThumbnail, SorterThumbnail, WaveformThumbnail } from './practise-thumbnails';
import { bitTracePath } from './SchedulerFrame';

/*
 * The drawings on the "What you can practise" cards: static server markup,
 * hidden from assistive technology (the card's link and line say what it is),
 * drawn from the data in practise-thumbnails.ts. Tier colours come from the
 * module code through data-tier (DESIGN.md section 11); the waveform keeps the
 * protected encodings (logic 1 cyan, 0 slate, X rose hatching). Every drawing
 * sits in the same small frame, a plain surface inside the quiet-glass card.
 */

export type PractiseThumbnailKind = keyof PractiseThumbnails;

/** The frame: 112 px tall in every card, so the four cards' text starts on one line. */
const FRAME_CLASS = 'relative mb-4 h-28 overflow-hidden rounded-lg border border-border bg-background/70 p-3';

const ROW_CLASS = 'flex h-[22px] min-w-0 items-center gap-2';

/**
 * Text in a drawing: one line high, wrapping normally and clipped, so if a
 * label ever outgrows its row the words that do not fit drop out whole; never
 * an ellipsis and never a cut word. The data is chosen to fit (practise-thumbnails.ts).
 */
export const CLIP_CLASS = 'block h-4 min-w-0 overflow-hidden text-label leading-4';

function LabDrawing({ data }: { data: LabThumbnail }) {
  return (
    <div data-tier={tierDataAttribute(tierOfModuleCode(data.code))}>
      <div className={ROW_CLASS}>
        <SignalTag code={data.code} className="py-0 leading-4" />
        <span className={cn(CLIP_CLASS, 'font-medium text-foreground')}>{data.stepCount} steps</span>
      </div>
      <ol>
        {data.steps.map((step) => (
          <li key={step.number} className={ROW_CLASS}>
            <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-tier-current-border bg-tier-current-subtle font-mono text-label leading-none text-tier-current">
              {step.number}
            </span>
            <span className={cn(CLIP_CLASS, 'text-muted-foreground')}>{step.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ORDER_MARK: Record<string, string> = { 'top-down': '↓', 'bottom-up': '↑', parallel: '' };

function SorterDrawing({ data }: { data: SorterThumbnail }) {
  return (
    // Two equal lanes. The one-word names in the sans face fit the narrowest card (178 px wide at 1024 px,
    // where "configure" needs 52 of the 57 px a pill holds), so nothing is cut.
    <div data-tier={tierDataAttribute(tierOfModuleCode(data.code))} className="grid h-full grid-cols-2 gap-1.5">
      {data.lanes.map((lane) => (
        <div key={lane.id} data-lane={lane.id} className="min-w-0 border-l-2 border-tier-current-border pl-1.5">
          <p className="mb-1 text-label text-muted-foreground">{lane.label}</p>
          <ol className="flex flex-col gap-1">
            {lane.phases.map((phase) => (
              <li key={phase.name} className="flex h-[18px] min-w-0 items-center gap-0.5 rounded border border-border bg-card pl-1 pr-0.5">
                <span className={cn(CLIP_CLASS, 'text-foreground')}>{phase.name}</span>
                {ORDER_MARK[phase.order] ? (
                  <span className="ml-auto shrink-0 text-label leading-none text-tier-current">{ORDER_MARK[phase.order]}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** As the hero's waveform: 10 units a step, 28 a row (bitTracePath's levels). */
const STEP_W = 10;
const ROW_H = 28;

function WaveformDrawing({ data }: { data: WaveformThumbnail }) {
  const steps = data.signals[0]?.values.length ?? 0;
  const width = Math.max(1, steps) * STEP_W;
  const height = data.signals.length * ROW_H;
  return (
    <div className="grid h-full grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
      <ul className="flex flex-col justify-around font-mono text-label leading-none text-muted-foreground">
        {data.signals.map((signal) => (
          <li key={signal.name}>{signal.name}</li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-full w-full">
        <defs>
          <pattern id="practise-wave-x" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" className="stroke-rose-500/70" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect x={data.cursor * STEP_W} y={0} width={STEP_W} height={height} className="fill-cyan-400/15" />
        {data.signals.map((signal, row) => (
          <g key={signal.name}>
            {signal.values.map((value, index) =>
              value === undefined || value === 'X' ? <rect key={index} x={index * STEP_W} y={row * ROW_H + 6} width={STEP_W} height={14} fill="url(#practise-wave-x)" /> : null,
            )}
            <path
              d={bitTracePath(signal.values, row * ROW_H)}
              fill="none"
              className="stroke-cyan-600 dark:stroke-cyan-400"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="square"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * The width of a question's bar: longer prompts draw longer bars, from 45% to
 * 100% of the row, so the two rows read as two questions of different length.
 */
export function questionBarWidth(prompt: string): number {
  return Math.round(45 + 55 * Math.min(1, prompt.length / 240));
}

/** Each row: the level in the colour of the tier that teaches the question, and a bar standing for the question under it. */
function QuestionDrawing({ data }: { data: QuestionThumbnail }) {
  return (
    <ul className="flex h-full flex-col justify-between">
      {data.rows.map((row) => (
        <li
          key={row.level}
          data-level={row.level}
          data-tier={tierDataAttribute(tierOfModuleCode(row.code))}
          className="flex min-w-0 flex-col border-l-2 border-tier-current-border pl-2"
        >
          <span className="text-label font-medium text-tier-current">{row.levelLabel}</span>
          <span className="mt-1.5 block h-1.5 rounded-full bg-muted-foreground/35" style={{ width: `${questionBarWidth(row.prompt)}%` }} />
          <span className="mt-1 block h-1.5 w-2/5 rounded-full bg-muted-foreground/20" />
        </li>
      ))}
    </ul>
  );
}

/** One card's drawing, or nothing when its data is missing (no placeholder art). */
export default function PractiseThumbnail({ kind, thumbnails }: { kind: PractiseThumbnailKind; thumbnails: PractiseThumbnails }) {
  let drawing: React.ReactNode = null;
  if (kind === 'labs' && thumbnails.labs) drawing = <LabDrawing data={thumbnails.labs} />;
  else if (kind === 'exercises') drawing = <SorterDrawing data={thumbnails.exercises} />;
  else if (kind === 'interactiveModels') drawing = <WaveformDrawing data={thumbnails.interactiveModels} />;
  else if (kind === 'interviewPrep' && thumbnails.interviewPrep) drawing = <QuestionDrawing data={thumbnails.interviewPrep} />;
  if (!drawing) return null;
  return (
    <div aria-hidden="true" data-thumbnail={kind} className={cn(FRAME_CLASS)}>
      {drawing}
    </div>
  );
}
