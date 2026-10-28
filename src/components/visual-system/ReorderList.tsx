"use client";

import React, { useEffect, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Accessible ordering control: every row has Move up and Move down buttons
 * (40 px touch targets, disabled where the row cannot move), and a polite live
 * region announces "X moved to position n of m". There is no drag-only path.
 *
 * Controlled: the caller owns `order` and decides when to reveal `marks`.
 * Locked rows keep their position; other rows move past them. The move is
 * announced, and focus follows the moved row, only when the caller applies it
 * in the same update as the press (its state setter called from `onChange`).
 * A move the caller rejects, or applies in a later update, is never announced,
 * so a later reset or shuffle that happens to give the same order cannot
 * announce a stale move or pull focus to its row.
 */

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export interface ReorderItem {
  id: string;
  /** Plain text: shown, and used in button names and announcements. */
  label: string;
  description?: React.ReactNode;
}

export type ReorderMark = "correct" | "wrong";

export type ReorderDirection = "up" | "down";

export interface ReorderListProps {
  items: readonly ReorderItem[];
  /** Item ids in their current order. Items missing from it are listed last. */
  order: readonly string[];
  onChange: (order: string[]) => void;
  /** Accessible name of the list, e.g. "Order the fix steps". */
  label: string;
  /** Rows that stay where they are. */
  lockedIds?: readonly string[];
  /** Per-row verdicts. Pass them only after the caller reveals the answer. */
  marks?: Readonly<Record<string, ReorderMark>>;
  /** Freeze every row, e.g. after the answer is revealed. */
  disabled?: boolean;
  /** Show labels in the code font (statements, directives). */
  mono?: boolean;
  className?: string;
}

/** The order with unknown and duplicate ids dropped and missing items appended. */
export function normalizeOrder(items: readonly { id: string }[], order: readonly string[]): string[] {
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const out: string[] = [];
  order.forEach((id) => {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  });
  items.forEach((i) => {
    if (!seen.has(i.id)) {
      seen.add(i.id);
      out.push(i.id);
    }
  });
  return out;
}

/**
 * Move `id` one place up or down, swapping with the nearest unlocked row and
 * leaving locked rows in place. Returns null when the row cannot move.
 */
export function moveInOrder(order: readonly string[], id: string, direction: ReorderDirection, lockedIds: readonly string[] = []): string[] | null {
  const locked = new Set(lockedIds);
  const from = order.indexOf(id);
  if (from < 0 || locked.has(id)) return null;
  const step = direction === "up" ? -1 : 1;
  let to = from + step;
  while (to >= 0 && to < order.length && locked.has(order[to])) to += step;
  if (to < 0 || to >= order.length) return null;
  const next = [...order];
  next[from] = order[to];
  next[to] = id;
  return next;
}

/** One string per order, joined with NUL (which item ids do not contain), so equal keys mean equal orders. */
const orderKeyOf = (ids: readonly string[]) => ids.join("\u0000");

const markStyles: Record<ReorderMark, { glyph: string; text: string; className: string; row: string }> = {
  correct: {
    glyph: "✓",
    text: "correct position",
    className: "text-emerald-700 dark:text-emerald-300",
    row: "border-emerald-500/60 bg-emerald-500/[0.06]",
  },
  wrong: {
    glyph: "✕",
    text: "wrong position",
    className: "text-rose-700 dark:text-rose-300",
    row: "border-rose-500/60 bg-rose-500/[0.06]",
  },
};

const moveButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background text-base text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none";

export function ReorderList({ items, order, onChange, label, lockedIds = [], marks, disabled = false, mono = false, className }: ReorderListProps) {
  const ids = normalizeOrder(items, order);
  const byId = new Map(items.map((i) => [i.id, i]));
  const locked = new Set(lockedIds);
  const [announcement, setAnnouncement] = useState("");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingMove = useRef<{ id: string; direction: ReorderDirection; expectedKey: string; message: string } | null>(null);
  // Bumped on every press, so the update that handles the press always
  // re-renders this list, even when the caller rejects the move and the order
  // does not change. That render is the only one that may settle the move.
  const [pressCount, setPressCount] = useState(0);
  const orderKey = orderKeyOf(ids);

  // After the render that handled the press, settle the pending move and clear
  // it whatever the outcome. If the caller applied it, announce it and keep
  // focus on the moved row so repeated presses keep moving it; if that button
  // is now disabled (the row reached an end), focus its other button. If the
  // caller rejected or altered it, nothing is announced and focus stays put.
  useEffect(() => {
    const pending = pendingMove.current;
    if (!pending) return;
    pendingMove.current = null;
    if (pending.expectedKey !== orderKey) return;
    setAnnouncement(pending.message);
    const same = buttons.current.get(`${pending.id}:${pending.direction}`);
    const other = buttons.current.get(`${pending.id}:${pending.direction === "up" ? "down" : "up"}`);
    if (same && !same.disabled) same.focus();
    else if (other && !other.disabled) other.focus();
  }, [orderKey, pressCount]);

  const move = (id: string, direction: ReorderDirection) => {
    const next = moveInOrder(ids, id, direction, lockedIds);
    if (!next) return;
    const item = byId.get(id);
    pendingMove.current = {
      id,
      direction,
      expectedKey: orderKeyOf(next),
      message: `${item?.label ?? id} moved to position ${next.indexOf(id) + 1} of ${next.length}`,
    };
    setPressCount((n) => n + 1);
    onChange(next);
  };

  const setRef = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(key, el);
    else buttons.current.delete(key);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <ol aria-label={label} className="space-y-2">
        {ids.map((id, position) => {
          const item = byId.get(id);
          if (!item) return null;
          const isLocked = locked.has(id);
          const mark = marks?.[id] ? markStyles[marks[id]] : undefined;
          const canUp = !disabled && !isLocked && moveInOrder(ids, id, "up", lockedIds) !== null;
          const canDown = !disabled && !isLocked && moveInOrder(ids, id, "down", lockedIds) !== null;
          return (
            <li
              key={id}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-background/50 p-2 transition-colors duration-200 motion-reduce:transition-none",
                mark ? mark.row : "border-border/70",
                isLocked && !mark && "border-dashed",
              )}
            >
              <span aria-hidden className="w-6 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground">
                {position + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("break-words text-sm text-foreground", mono && "font-mono [font-variant-ligatures:none]")}>{item.label}</p>
                {item.description ? <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div> : null}
                {mark ? (
                  <p className={cn("mt-1 text-xs font-medium", mark.className)}>
                    <span aria-hidden>{mark.glyph} </span>
                    {mark.text}
                  </p>
                ) : null}
              </div>
              {isLocked ? (
                <span className="shrink-0 rounded border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">Fixed position</span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button
                    ref={setRef(`${id}:up`)}
                    type="button"
                    aria-label={`Move up: ${item.label}`}
                    disabled={!canUp}
                    onClick={() => move(id, "up")}
                    className={moveButton}
                  >
                    <span aria-hidden>↑</span>
                  </button>
                  <button
                    ref={setRef(`${id}:down`)}
                    type="button"
                    aria-label={`Move down: ${item.label}`}
                    disabled={!canDown}
                    onClick={() => move(id, "down")}
                    className={moveButton}
                  >
                    <span aria-hidden>↓</span>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

export default ReorderList;
