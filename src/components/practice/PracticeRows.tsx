import React from 'react';
import Link from 'next/link';

import { Card, cardClass } from '@/components/ui/Card';
import { SignalTag } from '@/components/ui/SignalTag';
import type { LessonLink, PracticeItem } from '@/lib/practice-links';
import { tierDataAttribute, type TierNumber } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';

import { focusRing } from './LearnInLesson';
import { outcomeLine, practiceItemTier } from './practice-hub-data';

/*
 * The Practice hub's two list shapes (SPEC-phases-2-4.md, "Other pages"):
 * compact rows for long lists, and small quiet-glass tiles for sections with
 * only a few items. Both show the same things: the signal tag of the module
 * that teaches the item (a link to that lesson), the title as the link to the
 * item, and one line saying what it lets you do. Server components.
 */

/** Text that says the item is planned and cannot be opened yet. */
export const COMING_SOON_LABEL = 'Coming soon';

/**
 * The teaching lesson's signal tag, as a link to the lesson. The tag keeps its
 * tier tint and turns to the accent on hover and focus, like a linked
 * SignalTag; the link around it has a 32 px hit area and sits above the row's
 * stretched link.
 */
export function LessonTagLink({ lesson, className }: { lesson: LessonLink; className?: string }) {
  return (
    <Link
      href={lesson.href}
      aria-label={`${lesson.code}: learn it in ${lesson.title}`}
      title={`Learn it in ${lesson.title}`}
      data-lesson-tag=""
      className={cn('group/tag relative z-10 -my-1.5 inline-flex min-h-8 items-center rounded', focusRing, className)}
    >
      <SignalTag
        code={lesson.code}
        className="[font-variant-ligatures:none] group-hover/tag:border-primary group-hover/tag:text-primary"
      />
    </Link>
  );
}

/** The item title: a link stretched over its row or tile, or plain text when the item cannot be opened yet. */
function ItemTitle({ item, stretchClass }: { item: PracticeItem; stretchClass: string }) {
  if (!item.href || item.status !== 'available') {
    return <span className="text-foreground">{item.title}</span>;
  }
  return (
    <Link
      href={item.href}
      className={cn(
        'text-foreground underline-offset-4 transition-colors duration-150 ease-bench group-hover:text-primary group-hover:underline motion-reduce:transition-none',
        'after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring',
        stretchClass,
      )}
    >
      {item.title}
    </Link>
  );
}

export interface PracticeRowProps {
  item: PracticeItem;
  /** The state column: a lab's progress badge and step count, a bank's question count. Never interactive. */
  state?: React.ReactNode;
  /** The one-line outcome; defaults to outcomeLine(item.description). */
  outcome?: string;
}

/**
 * One compact row: tag, title and outcome, state. On a phone the tag and the
 * state share the first line and the title and outcome run full width under
 * them; from 640 px the three sit in columns. The whole row is the item's link
 * (at least 44 px tall) with a raised surface on hover and a ring on focus.
 */
export function PracticeRow({ item, state, outcome = outcomeLine(item.description) }: PracticeRowProps) {
  const [lesson] = item.lessons;
  return (
    <li
      data-practice-row={item.id}
      className={cn(
        'group relative grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-lg px-3 py-3',
        'sm:grid-cols-[6rem_minmax(0,1fr)_auto]',
        'transition-colors duration-150 ease-bench hover:bg-muted motion-reduce:transition-none',
      )}
    >
      <div className="col-start-1 row-start-1 flex min-h-6 items-center">
        {lesson ? <LessonTagLink lesson={lesson} /> : null}
      </div>
      <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <p className="text-ui font-medium [overflow-wrap:anywhere]">
          <ItemTitle item={item} stretchClass="after:rounded-lg" />
        </p>
        {/* Two lines at most at any width; the clamp falls at a line end, so between words. */}
        <p className="mt-0.5 line-clamp-2 text-ui text-muted-foreground">{outcome}</p>
      </div>
      <div className="col-start-2 row-start-1 flex min-h-6 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right text-label text-muted-foreground sm:col-start-3 sm:flex-col sm:flex-nowrap sm:items-end">
        {item.status === 'available' ? state : <span className="font-medium">{COMING_SOON_LABEL}</span>}
      </div>
    </li>
  );
}

export interface PracticeRowListProps {
  items: readonly PracticeItem[];
  /** The state column per item id. */
  states?: Readonly<Record<string, React.ReactNode>>;
  /** Outcome lines per item id, where the default (outcomeLine) does not fit. */
  outcomes?: Readonly<Record<string, string>>;
  className?: string;
}

/** Rows divided by hairlines. Put it in a panel (PracticeRowPanel) or a tier group, never in a card. */
export function PracticeRowList({ items, states, outcomes, className }: PracticeRowListProps) {
  return (
    <ul role="list" className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <PracticeRow key={item.id} item={item} state={states?.[item.id]} outcome={outcomes?.[item.id]} />
      ))}
    </ul>
  );
}

/** A long list on one quiet-glass panel: the rows inset by 8 px so their hover surface keeps its radius. */
export function PracticeRowPanel(props: PracticeRowListProps) {
  return (
    <Card variant="glassQuiet" className="p-2" data-practice-panel="">
      <PracticeRowList {...props} />
    </Card>
  );
}

export interface PracticeTierGroupProps {
  tier: TierNumber | undefined;
  /** "Tier 1: Foundations", from the curriculum manifest. */
  title: string;
  /** "4 labs". */
  count: string;
  children: React.ReactNode;
}

/**
 * A tier's panel: quiet glass with the tier's 2 px top edge, the tier step
 * mark and the tier's name as an h3, the count, then the rows. data-tier
 * scopes the colour for the mark and the edge.
 */
export function PracticeTierGroup({ tier, title, count, children }: PracticeTierGroupProps) {
  return (
    <Card variant="glassQuiet" tier={tier} className="p-2" data-practice-tier-group={tier ?? ''}>
      <div className="flex items-baseline justify-between gap-3 px-3 pb-1 pt-2">
        <h3 className="flex items-center gap-3 text-h4 text-foreground">
          {tier ? <span className="tier-step" aria-hidden="true" data-testid="tier-step" /> : null}
          {title}
        </h3>
        <span className="shrink-0 font-mono text-label tabular-nums text-muted-foreground">{count}</span>
      </div>
      {children}
    </Card>
  );
}

/**
 * A small quiet-glass tile for a section with few items: tag, title (an h3
 * stretched over the tile) and the outcome line. No empty footer: the tile is
 * as tall as its text, and tiles in a row match the tallest.
 */
export function PracticeTile({ item }: { item: PracticeItem }) {
  const [lesson] = item.lessons;
  const tier = practiceItemTier(item);
  return (
    <li
      data-tier={tierDataAttribute(tier)}
      data-practice-tile={item.id}
      className={cn('group min-w-0', cardClass({ variant: 'glassQuietInteractive', padding: 'compact', tier }))}
    >
      {lesson ? <LessonTagLink lesson={lesson} /> : null}
      <h3 className="mt-2 text-h4 [overflow-wrap:anywhere]">
        <ItemTitle item={item} stretchClass="after:rounded-xl" />
      </h3>
      <p className="mt-1 line-clamp-3 text-ui text-muted-foreground">{outcomeLine(item.description)}</p>
    </li>
  );
}

/**
 * Tiles in a grid: as many 15rem columns as fit, stretched so a short list
 * fills the width (auto-fit), or one column (`single`) for a section with one item.
 */
export function PracticeTileGrid({ items, single = false }: { items: readonly PracticeItem[]; single?: boolean }) {
  return (
    <ul
      role="list"
      className={cn('grid gap-4', single ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]')}
    >
      {items.map((item) => (
        <PracticeTile key={item.id} item={item} />
      ))}
    </ul>
  );
}
