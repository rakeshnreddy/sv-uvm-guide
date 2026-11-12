import React from 'react';

import { SignalTag } from '@/components/ui/SignalTag';
import { tierDataAttribute, tierOfModuleCode } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

import type { LabPreview, QuestionPreview, ReadPreview, StepPreviews, StepThroughPreview } from './step-previews';

/*
 * The previews on the "How you learn here" cards: static server markup,
 * hidden from assistive technology (the card's heading, line and link say what
 * it is), drawn from the data in step-previews.ts. Tier colours come from the
 * module code through data-tier (DESIGN.md section 11); the scheduler preview
 * keeps the protected encodings (the active region set cyan, the executing
 * region filled). Every preview sits in the same small frame, a plain surface
 * inside the quiet-glass card.
 */

export type StepPreviewKind = keyof StepPreviews;

/** The frame: 112 px tall in every card, so the four cards' text starts on one line. */
const FRAME_CLASS = 'relative mb-4 h-28 overflow-hidden rounded-lg border border-border bg-background/70 p-3';

const ROW_CLASS = 'flex h-[22px] min-w-0 items-center gap-2';

/**
 * Text in a preview: one line high, wrapping normally and clipped, so if a
 * label ever outgrows its row the words that do not fit drop out whole; never
 * an ellipsis and never a cut word. The data is chosen to fit (step-previews.ts).
 */
export const CLIP_CLASS = 'block h-4 min-w-0 overflow-hidden text-label leading-4';

/** Lesson 1's four layers, each with a bar as long as its share of the text, in the lesson's tier colour. */
function ReadDrawing({ data }: { data: ReadPreview }) {
  return (
    <ol data-tier={tierDataAttribute(tierOfModuleCode(data.code))} className="flex h-full flex-col justify-between">
      {data.layers.map((layer) => (
        <li key={layer.name} className="min-w-0">
          <span className={cn(CLIP_CLASS, 'text-foreground')}>{layer.name}</span>
          <span className="mt-0.5 block h-1 rounded-full bg-muted-foreground/20">
            <span className="block h-1 rounded-full bg-tier-current" style={{ width: `${Math.max(8, Math.round(layer.share * 100))}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One frame of the scheduler model: the regions in order, the statement and the model's narration. */
function StepThroughDrawing({ data }: { data: StepThroughPreview }) {
  return (
    <div className="flex h-full flex-col gap-1.5">
      <ul className="flex min-w-0 flex-wrap gap-1 overflow-hidden" style={{ maxHeight: 20 }}>
        {data.regions.map((region) => (
          <li
            key={region.id}
            data-region={region.id}
            data-executing={region.executing ? '' : undefined}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-label leading-none',
              region.executing
                ? 'border-cyan-600 bg-cyan-500/20 text-foreground dark:border-cyan-400'
                : 'border-cyan-600/40 text-muted-foreground dark:border-cyan-400/40',
            )}
          >
            {region.label}
            {region.queued ? <span className="tabular-nums text-muted-foreground">{region.queued}</span> : null}
          </li>
        ))}
      </ul>
      <code className={cn(CLIP_CLASS, 'mt-1 font-mono text-foreground')}>{data.line}</code>
      <p className="h-8 min-w-0 overflow-hidden text-label leading-4 text-muted-foreground">{data.narration}</p>
    </div>
  );
}

function BuildDrawing({ data }: { data: LabPreview }) {
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

/** A question row as the bank page lists it: the level and category, the prompt and the closed model answer. */
function RehearseDrawing({ data }: { data: QuestionPreview }) {
  return (
    <div data-tier={tierDataAttribute(tierOfModuleCode(data.code))} className="flex h-full flex-col border-l-2 border-tier-current-border pl-2">
      <span className={cn(CLIP_CLASS, 'font-medium text-tier-current')}>
        {data.levelLabel} · {data.categoryLabel}
      </span>
      <p className="mt-1 h-12 min-w-0 overflow-hidden text-label leading-4 text-foreground">{data.prompt}</p>
      <span className={cn(CLIP_CLASS, 'mt-auto text-muted-foreground')}>▸ Model answer</span>
    </div>
  );
}

/** One card's preview, or nothing when its data is missing (no placeholder art). */
export default function StepPreview({ kind, previews }: { kind: StepPreviewKind; previews: StepPreviews }) {
  let drawing: React.ReactNode = null;
  if (kind === 'read' && previews.read) drawing = <ReadDrawing data={previews.read} />;
  else if (kind === 'stepThrough') drawing = <StepThroughDrawing data={previews.stepThrough} />;
  else if (kind === 'build' && previews.build) drawing = <BuildDrawing data={previews.build} />;
  else if (kind === 'rehearse' && previews.rehearse) drawing = <RehearseDrawing data={previews.rehearse} />;
  if (!drawing) return null;
  return (
    <div aria-hidden="true" data-preview={kind} className={FRAME_CLASS}>
      {drawing}
    </div>
  );
}
