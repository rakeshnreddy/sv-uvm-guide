import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { valueStyles } from "./visual-language";

/**
 * A row of bit cells, most significant first. Model-agnostic: the caller
 * passes plain bits and bit numbers; nothing here knows SystemVerilog rules.
 *
 * Encodings (docs/visual-learning/visual-language.md §2):
 * - x: rose diagonal hatch, aria "unknown (X)"
 * - z: amber dashed border, aria "high impedance (Z)"
 * - undefined: grey dotted texture and "–", never the X hatch; the default
 *   accessible value leaves these bits out of the literal, so no x, z or
 *   definite bit is announced for a bit that has no defined value
 * - S under the sign bit (violet ring), + under extension bits (dashed),
 *   ✕ under discarded bits (struck through), ▲ under changed bits (cyan ring),
 *   a bar under highlighted bits.
 *
 * Every index prop is a bit number in the strip's own numbering:
 * `[w-1:0]` by default, `[0:w-1]` with `ascending`, or anchored at `msbIndex`.
 * A marker the strip cannot draw is reported on the page as a data error and
 * left out of both the drawing and the description, so the two always agree.
 */

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type BitValue = "0" | "1" | "x" | "z";

export type BitTone = "cyan" | "violet" | "amber" | "emerald" | "sky" | "slate";

export interface BitSegment {
  /** Bit number of the segment's most significant end. */
  hi: number;
  /** Bit number of the segment's least significant end. */
  lo: number;
  label: string;
  tone?: BitTone;
}

export type BitIndexSet = readonly number[] | ReadonlySet<number>;

export interface BitStripProps {
  /** Bits, most significant first. */
  bits: readonly BitValue[];
  /** Names the strip in its accessible description, e.g. "a in context". */
  label: string;
  /**
   * How the value reads to a screen reader. Defaults to a binary literal such
   * as 8'b0000_1100; with `undefinedBits`, the default names the undefined bits
   * and gives a literal only for the defined runs (see `bitValueText`).
   */
  valueText?: string;
  /**
   * This bit and every more significant bit were added by extension (dashed, +).
   * A bit number beyond the most significant end marks nothing (e.g. the source
   * width when nothing was added); one beyond the least significant end is a
   * data error.
   */
  extendedFrom?: number;
  /** Bit number of the sign bit (violet ring, S). Outside the strip it is a data error. */
  signBit?: number;
  /** This bit and every more significant bit are discarded (struck through, ✕). Range rules as `extendedFrom`. */
  droppedFrom?: number;
  /**
   * Named ranges such as struct members or byte lanes, drawn as labelled
   * brackets. `hi` must be the more significant end, as in a part-select
   * (IEEE 1800-2023 §11.5.1); a reversed, out-of-range or overlapping segment is
   * reported as a data error and not drawn.
   */
  segments?: readonly BitSegment[];
  /** Bits to emphasise, e.g. the ones a part-select reads (bar under the cell). */
  highlight?: BitIndexSet;
  /** Screen-reader word for highlighted bits. Default "highlighted". */
  highlightLabel?: string;
  /** Bits that just changed (cyan ring, ▲). */
  changed?: BitIndexSet;
  /** Bits with no defined value: dotted texture and "–", distinct from x. */
  undefinedBits?: BitIndexSet;
  /** Show each bit's number above it. */
  bitNumbers?: boolean;
  /** Ascending numbering, as in a [0:15] declaration: the leftmost bit is bit 0. */
  ascending?: boolean;
  /** Bit number of the leftmost bit, for ranges such as [15:8]. */
  msbIndex?: number;
  className?: string;
}

const toneClasses: Record<BitTone, string> = {
  cyan: "border-cyan-500 text-cyan-800 dark:text-cyan-200",
  violet: "border-violet-500 text-violet-800 dark:text-violet-200",
  amber: "border-amber-500 text-amber-900 dark:text-amber-200",
  emerald: "border-emerald-500 text-emerald-800 dark:text-emerald-200",
  sky: "border-sky-500 text-sky-800 dark:text-sky-200",
  slate: "border-slate-400 text-slate-700 dark:text-slate-200",
};

const toneCycle: BitTone[] = ["cyan", "violet", "amber", "emerald", "sky", "slate"];

/** Undefined bits: dotted border and a dot texture, never the rose X hatch. */
export const undefinedBitClassName =
  "border-dotted border-slate-400/80 text-slate-500 dark:text-slate-300 bg-[radial-gradient(circle,rgba(100,116,139,0.4)_1px,transparent_1.5px)] bg-[length:4px_4px]";

export function bitClassName(bit: BitValue): string {
  if (bit === "x") return valueStyles.unknown.className;
  if (bit === "z") return valueStyles.highz.className;
  if (bit === "1") return valueStyles.one.className;
  return valueStyles.zero.className;
}

function toSet(indices: BitIndexSet | undefined): ReadonlySet<number> {
  if (!indices) return new Set<number>();
  return indices instanceof Set ? indices : new Set(indices as readonly number[]);
}

/**
 * A binary literal with an underscore every four bits from the right: 8'b0000_1100.
 * With no bits it returns "no bits": a literal's size must be nonzero
 * (IEEE 1800-2023 §5.7.1), so there is no literal to write.
 */
export function binaryText(bits: readonly BitValue[]): string {
  const w = bits.length;
  if (w === 0) return "no bits";
  let out = "";
  bits.forEach((b, k) => {
    if (k > 0 && (w - k) % 4 === 0) out += "_";
    out += b;
  });
  return `${w}'b${out}`;
}

/**
 * The default accessible value. With no undefined bits it is `binaryText(bits)`.
 * Otherwise the undefined bits are named and left out of every literal, and each
 * run of defined bits gets its own literal, most significant first:
 * "bit 3 undefined (no defined value), bits 2 to 0 = 3'b010". `?` is never used:
 * in a literal it means z (IEEE 1800-2023 §5.7.1).
 */
export function bitValueText(
  bits: readonly BitValue[],
  undefinedPositions: readonly number[],
  indexAt: (position: number) => number,
): string {
  const undef = new Set(undefinedPositions.filter((p) => p >= 0 && p < bits.length));
  if (undef.size === 0) return binaryText(bits);
  const runs: { start: number; end: number; undefined: boolean }[] = [];
  bits.forEach((_, p) => {
    const isUndefined = undef.has(p);
    const last = runs[runs.length - 1];
    if (last && last.undefined === isUndefined) last.end = p;
    else runs.push({ start: p, end: p, undefined: isUndefined });
  });
  return runs
    .map((r) => {
      const where = r.start === r.end ? `bit ${indexAt(r.start)}` : `bits ${indexAt(r.start)} to ${indexAt(r.end)}`;
      return r.undefined ? `${where} undefined (no defined value)` : `${where} = ${binaryText(bits.slice(r.start, r.end + 1))}`;
    })
    .join(", ");
}

interface Numbering {
  width: number;
  indexAt: (position: number) => number;
  positionOf: (index: number) => number;
}

function numbering(width: number, ascending: boolean, msbIndex: number | undefined): Numbering {
  const msb = msbIndex ?? (ascending ? 0 : width - 1);
  return {
    width,
    indexAt: (p) => (ascending ? msb + p : msb - p),
    positionOf: (i) => (ascending ? i - msb : msb - i),
  };
}

/** "bit 3", "bits 7 to 4", "bits 7 to 4 and 1", listed most significant first. */
export function describeBits(positions: readonly number[], indexAt: (position: number) => number): string {
  const sorted = Array.from(new Set(positions)).sort((a, b) => a - b);
  const runs: [number, number][] = [];
  sorted.forEach((p) => {
    const last = runs[runs.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else runs.push([p, p]);
  });
  const parts = runs.map(([a, b]) => (a === b ? `${indexAt(a)}` : `${indexAt(a)} to ${indexAt(b)}`));
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "");
  return `${sorted.length === 1 ? "bit" : "bits"} ${joined}`;
}

interface Run {
  start: number;
  end: number;
  segment: number;
}

export function BitStrip({
  bits,
  label,
  valueText,
  extendedFrom,
  signBit,
  droppedFrom,
  segments,
  highlight,
  highlightLabel = "highlighted",
  changed,
  undefinedBits,
  bitNumbers = false,
  ascending = false,
  msbIndex,
  className,
}: BitStripProps) {
  const w = bits.length;
  const { indexAt, positionOf } = numbering(w, ascending, msbIndex);
  const inStrip = (p: number) => p >= 0 && p < w;
  const problems: string[] = [];
  if (w === 0) problems.push("bits is empty, so there is no value to draw");
  const range = `[${indexAt(0)}:${indexAt(w - 1)}]`;

  /**
   * Position of the least significant marked bit for a "this bit and every more
   * significant bit" marker. Beyond the most significant end nothing is marked
   * (undefined). Beyond the least significant end the marker is reported and not
   * drawn, so no cell is dashed or struck through without a matching description.
   */
  const fromPosition = (bit: number | undefined, prop: string): number | undefined => {
    if (bit === undefined) return undefined;
    const p = positionOf(bit);
    if (p < 0) return undefined;
    if (p >= w) {
      if (w > 0) problems.push(`${prop} ${bit} is beyond the least significant end of the strip ${range}`);
      return undefined;
    }
    return p;
  };
  const extPos = fromPosition(extendedFrom, "extendedFrom");
  const dropPos = fromPosition(droppedFrom, "droppedFrom");
  const signInStrip = signBit !== undefined && inStrip(positionOf(signBit));
  if (signBit !== undefined && !signInStrip && w > 0) problems.push(`signBit ${signBit} is outside the strip ${range}`);
  const highlightSet = toSet(highlight);
  const changedSet = toSet(changed);
  const undefinedSet = toSet(undefinedBits);
  const showHighlightBar = highlightSet.size > 0;

  // Segments: validate, then assign each position to at most one segment.
  const segmentAt: number[] = new Array(w).fill(-1);
  (segments ?? []).forEach((s, si) => {
    const from = positionOf(s.hi);
    const to = positionOf(s.lo);
    if (!inStrip(from) || !inStrip(to)) {
      problems.push(`segment "${s.label}" [${s.hi}:${s.lo}] is outside the strip`);
      return;
    }
    if (from > to) {
      problems.push(
        `segment "${s.label}" [${s.hi}:${s.lo}] names its less significant bit first; a range names the more significant bit first (IEEE 1800-2023 §11.5.1), so write [${s.lo}:${s.hi}]`,
      );
      return;
    }
    for (let p = from; p <= to; p += 1) {
      if (segmentAt[p] !== -1) {
        problems.push(`segment "${s.label}" overlaps "${(segments ?? [])[segmentAt[p]].label}"`);
        return;
      }
    }
    for (let p = from; p <= to; p += 1) segmentAt[p] = si;
  });
  const hasSegments = (segments ?? []).length > 0;

  // Accessible description: same order and wording as the original SignednessVisualizer strip.
  const notes: string[] = [];
  const msbNumber = indexAt(0);
  if (extPos !== undefined) notes.push(`${extPos === 0 ? `bit ${msbNumber}` : `bits ${msbNumber} to ${indexAt(extPos)}`} added by extension`);
  if (signInStrip) notes.push(`sign bit is bit ${signBit}`);
  if (dropPos !== undefined) notes.push(`${dropPos === 0 ? `bit ${msbNumber}` : `bits ${msbNumber} to ${indexAt(dropPos)}`} discarded`);
  if (hasSegments) {
    (segments ?? []).forEach((s, si) => {
      if (segmentAt.includes(si)) notes.push(`${s.label} is ${s.hi === s.lo ? `bit ${s.hi}` : `bits ${s.hi} to ${s.lo}`}`);
    });
  }
  const positionsWhere = (pred: (p: number) => boolean) => bits.map((_, p) => p).filter(pred);
  const undefinedPositions = positionsWhere((p) => undefinedSet.has(indexAt(p)));
  const xPositions = positionsWhere((p) => bits[p] === "x" && !undefinedSet.has(indexAt(p)));
  const zPositions = positionsWhere((p) => bits[p] === "z" && !undefinedSet.has(indexAt(p)));
  const changedPositions = positionsWhere((p) => changedSet.has(indexAt(p)));
  const highlightPositions = positionsWhere((p) => highlightSet.has(indexAt(p)));
  // Without a caller valueText, undefined bits are described inside the value
  // itself (and left out of its literals), so they get no separate note.
  const undefinedInValue = valueText === undefined && undefinedPositions.length > 0;
  if (xPositions.length) notes.push(`${describeBits(xPositions, indexAt)} ${valueStyles.unknown.cue}`);
  if (zPositions.length) notes.push(`${describeBits(zPositions, indexAt)} ${valueStyles.highz.cue}`);
  if (undefinedPositions.length && !undefinedInValue) notes.push(`${describeBits(undefinedPositions, indexAt)} undefined (no defined value)`);
  if (changedPositions.length) notes.push(`${describeBits(changedPositions, indexAt)} just changed`);
  if (highlightPositions.length) notes.push(`${describeBits(highlightPositions, indexAt)} ${highlightLabel}`);
  const value =
    valueText !== undefined ? ` ${valueText}` : undefinedInValue ? `, ${bitValueText(bits, undefinedPositions, indexAt)}` : ` ${binaryText(bits)}`;
  const aria = w === 0 ? `${label}: no bits` : `${label}: ${w}-bit value${value}${notes.length ? `; ${notes.join("; ")}` : ""}`;

  const renderBit = (p: number) => {
    const bit = bits[p];
    const index = indexAt(p);
    const ext = extPos !== undefined && p <= extPos;
    const dropped = dropPos !== undefined && p <= dropPos;
    const sign = signBit === index;
    const isUndefined = undefinedSet.has(index);
    const isChanged = changedSet.has(index);
    const isHighlighted = highlightSet.has(index);
    const glyph = (dropped ? "✕" : sign ? "S" : ext ? "+" : "") + (isChanged ? "▲" : "");
    return (
      <span key={index} className="flex w-4 flex-col items-center">
        {bitNumbers ? (
          <span aria-hidden className="h-3 text-[9px] leading-3 tabular-nums text-muted-foreground">
            {index}
          </span>
        ) : null}
        <span
          className={cn(
            "flex h-6 w-4 items-center justify-center rounded-[3px] border text-[11px] font-semibold",
            isUndefined ? undefinedBitClassName : bitClassName(bit),
            // The dotted undefined texture wins over the extension dash; the + glyph still marks extension.
            ext && !isUndefined && "border-dashed",
            sign && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background",
            isChanged && !sign && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-background",
            dropped && "line-through opacity-50",
          )}
        >
          {isUndefined ? "–" : bit}
        </span>
        {showHighlightBar ? <span aria-hidden className={cn("mt-0.5 h-[3px] w-full rounded-full", isHighlighted ? "bg-sky-500" : "bg-transparent")} /> : null}
        <span aria-hidden className={cn("h-3 text-[9px] leading-3 text-muted-foreground", isChanged && "text-cyan-700 dark:text-cyan-300")}>
          {glyph}
        </span>
      </span>
    );
  };

  /** Split positions [start, end] into nibbles counted from the least significant bit. */
  const nibbles = (start: number, end: number) => {
    const groups: number[][] = [];
    for (let p = start; p <= end; p += 1) {
      const fromRight = w - 1 - p;
      if (groups.length === 0 || (fromRight + 1) % 4 === 0) groups.push([]);
      groups[groups.length - 1].push(p);
    }
    return groups.filter((g) => g.length > 0);
  };

  const renderNibbles = (start: number, end: number) =>
    nibbles(start, end).map((g) => (
      <span key={g[0]} className="inline-flex gap-px">
        {g.map(renderBit)}
      </span>
    ));

  let body: React.ReactNode;
  if (!hasSegments) {
    body = renderNibbles(0, w - 1);
  } else {
    const runs: Run[] = [];
    for (let p = 0; p < w; p += 1) {
      const last = runs[runs.length - 1];
      if (last && last.segment === segmentAt[p]) last.end = p;
      else runs.push({ start: p, end: p, segment: segmentAt[p] });
    }
    body = runs.map((run) => {
      const seg = run.segment >= 0 ? (segments ?? [])[run.segment] : undefined;
      const tone = seg ? (seg.tone ?? toneCycle[run.segment % toneCycle.length]) : undefined;
      return (
        <span key={run.start} className="inline-flex max-w-full flex-col gap-0.5">
          <span className="flex flex-wrap gap-x-1 gap-y-1">{renderNibbles(run.start, run.end)}</span>
          {seg && tone ? (
            <span aria-hidden className={cn("border-t-2 pt-0.5 text-center font-sans text-[10px] font-medium leading-3", toneClasses[tone])}>
              {seg.label} <span className="font-mono opacity-80">[{seg.hi === seg.lo ? seg.hi : `${seg.hi}:${seg.lo}`}]</span>
            </span>
          ) : null}
        </span>
      );
    });
  }

  const strip = (
    <div
      role="img"
      aria-label={aria}
      className={cn("flex flex-wrap items-start gap-x-1.5 gap-y-1 font-mono [font-variant-ligatures:none]", hasSegments && "gap-x-2", className)}
    >
      {body}
    </div>
  );

  if (problems.length === 0) return strip;
  return (
    <div className="space-y-1">
      {strip}
      <p role="note" className="text-xs text-rose-700 dark:text-rose-300">
        <span aria-hidden>✕ </span>Bit strip data error: {problems.join("; ")}.
      </p>
    </div>
  );
}

export type BitLegendItem = "x" | "z" | "undefined" | "sign" | "extended" | "dropped" | "changed" | "highlight";

const legendText: Record<BitLegendItem, string> = {
  x: "x = unknown (hatched)",
  z: "z = high impedance (dashed amber)",
  undefined: "– = no defined value (dotted)",
  sign: "S = sign bit (violet ring)",
  extended: "+ = added by extension (dashed)",
  dropped: "✕ = discarded (struck through)",
  changed: "▲ = just changed (cyan ring)",
  highlight: "bar = highlighted bit",
};

/** A one-line key for the encodings a strip uses. List only the ones on screen. */
export function BitStripLegend({ items, className }: { items: readonly BitLegendItem[]; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">Legend: </span>
      {items.map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 ? " · " : null}
          {legendText[item]}
        </React.Fragment>
      ))}
    </p>
  );
}

export default BitStrip;
