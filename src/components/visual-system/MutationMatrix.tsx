"use client";

import React, { useEffect, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tests × mutants grid with a prediction per cell (predict-then-reveal).
 *
 * Before `revealed`, no result reaches the DOM: each cell is a toggle the
 * learner sets to "will catch" or "will miss", and the live status names the
 * value the last pressed cell now holds. After `revealed`, each cell shows
 * ✕ caught or ○ survived, the caller's summary (e.g. "PASS=4 FAIL=3") and
 * whether the prediction was right; a predicted cell that did not run keeps
 * the prediction and says it was not graded. Glyph plus text, never colour alone.
 *
 * Model-agnostic: the caller runs the tests against the mutants and passes
 * the results in `cells`, keyed by `cellKey(rowId, columnId)`. Row and column
 * ids must not contain ":" (see `cellKey`); duplicate ids and keys that collide
 * are reported on the page as a data error.
 *
 * Colour: ✕ is the spec glyph for a caught mutant, but visual-language.md §2
 * also uses ✕ in rose for a mismatch (and a wrong prediction shows that ✕ in
 * the same cell), so the caught state is drawn in neutral slate, not emerald:
 * the glyph and the word carry the meaning.
 */

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type MutationCellState = "caught" | "survived" | "not-run";

export interface MutationCell {
  state: MutationCellState;
  /** Run summary shown after reveal, e.g. "PASS=4 FAIL=3". */
  summary?: string;
}

export type MutationPrediction = "catch" | "miss";

export interface MutationAxisItem {
  id: string;
  label: string;
}

export interface MutationMatrixProps {
  /** Table caption and accessible name. */
  label: string;
  /** Tests. */
  rows: readonly MutationAxisItem[];
  /** Mutants. */
  columns: readonly MutationAxisItem[];
  /** Results keyed by `cellKey(rowId, columnId)`. A missing cell counts as not run. */
  cells: Readonly<Record<string, MutationCell>>;
  /** The learner's predictions, keyed like `cells`. */
  predictions?: Readonly<Record<string, MutationPrediction>>;
  /** Called when the learner toggles a cell before reveal. */
  onPredict?: (rowId: string, columnId: string, value: MutationPrediction) => void;
  revealed: boolean;
  /** After reveal, cells become buttons that call this (e.g. to show that run's log). */
  onCellSelect?: (rowId: string, columnId: string) => void;
  /** Key of the cell the caller is showing; marked as pressed. */
  selectedCell?: string;
  /** Header of the row-label column. Default "Test". */
  rowHeader?: string;
  /** Word for a column in prose. Default "mutant". */
  columnNoun?: string;
  /** After reveal, add a row saying whether any test caught each mutant. */
  columnTotals?: boolean;
  className?: string;
}

/**
 * The key of one cell in `cells` and `predictions`: "row:col". Ids must not
 * contain ":", or two cells can share a key ("a:b" + "c" and "a" + "b:c" both
 * give "a:b:c"); `matrixProblems` reports any such collision.
 */
export const cellKey = (rowId: string, columnId: string) => `${rowId}:${columnId}`;

/** Duplicate row or column ids and cells whose keys collide. Empty when the axes are sound. */
export function matrixProblems(rows: readonly MutationAxisItem[], columns: readonly MutationAxisItem[]): string[] {
  const problems: string[] = [];
  const checkUnique = (items: readonly MutationAxisItem[], noun: string) => {
    const seen = new Set<string>();
    items.forEach((i) => {
      if (seen.has(i.id)) problems.push(`${noun} id "${i.id}" is used twice`);
      seen.add(i.id);
    });
  };
  checkUnique(rows, "row");
  checkUnique(columns, "column");
  const owner = new Map<string, string>();
  rows.forEach((r) =>
    columns.forEach((c) => {
      const key = cellKey(r.id, c.id);
      const where = `"${r.id}" × "${c.id}"`;
      const previous = owner.get(key);
      if (previous === undefined) owner.set(key, where);
      else if (previous !== where) problems.push(`cells ${previous} and ${where} share the key "${key}"; ids must not contain ":"`);
    }),
  );
  return problems;
}

const stateView: Record<MutationCellState, { glyph: string; text: string; className: string }> = {
  caught: { glyph: "✕", text: "caught", className: "border-slate-500/60 bg-slate-500/10 text-slate-900 dark:border-slate-400/60 dark:text-slate-100" },
  survived: { glyph: "○", text: "survived", className: "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200" },
  "not-run": { glyph: "–", text: "not run", className: "border-dashed border-border/70 text-muted-foreground" },
};

const predictionText: Record<MutationPrediction, string> = { catch: "will catch", miss: "will miss" };

/** The next value of the two-state toggle: the first press predicts "will catch". */
export function nextPrediction(current: MutationPrediction | undefined): MutationPrediction {
  return current === "catch" ? "miss" : "catch";
}

/** Whether a prediction matches a result; null when there is nothing to grade. */
export function gradePrediction(prediction: MutationPrediction | undefined, state: MutationCellState): boolean | null {
  if (!prediction || state === "not-run") return null;
  return prediction === "catch" ? state === "caught" : state === "survived";
}

export interface PredictionScore {
  /** Cells the learner predicted. */
  predicted: number;
  /** Predicted cells that ran, so they can be graded. */
  graded: number;
  correct: number;
  total: number;
}

export function scorePredictions(
  rows: readonly MutationAxisItem[],
  columns: readonly MutationAxisItem[],
  cells: Readonly<Record<string, MutationCell>>,
  predictions: Readonly<Record<string, MutationPrediction>> = {},
): PredictionScore {
  let predicted = 0;
  let graded = 0;
  let correct = 0;
  rows.forEach((r) =>
    columns.forEach((c) => {
      const key = cellKey(r.id, c.id);
      const p = predictions[key];
      if (p) predicted += 1;
      const g = gradePrediction(p, cells[key]?.state ?? "not-run");
      if (g !== null) {
        graded += 1;
        if (g) correct += 1;
      }
    }),
  );
  return { predicted, graded, correct, total: rows.length * columns.length };
}

/**
 * The live-region sentence before reveal. After a press it leads with the value
 * the pressed cell now holds, read back from `predictions` (so a press the
 * caller rejects is reported as it stands): "smoke_test against M1: will miss.
 * 2 of 4 cells predicted."
 */
export function predictionStatus(score: Pick<PredictionScore, "predicted" | "total">, last?: { where: string; prediction: MutationPrediction | undefined }): string {
  const count = `${score.predicted} of ${score.total} cells predicted.`;
  if (!last) return count;
  return `${last.where}: ${last.prediction ? predictionText[last.prediction] : "no prediction"}. ${count}`;
}

/** The text a predicted cell shows after reveal when it did not run. */
export const notGradedText = (prediction: MutationPrediction) => `you said ${predictionText[prediction]}, not graded (not run)`;

/** The live-region sentence after reveal. */
export function revealSummary(score: PredictionScore, caught: number, survived: number): string {
  if (score.predicted === 0) return `Revealed without predictions: ${caught} caught, ${survived} survived.`;
  const unpredicted = score.total - score.predicted;
  const noPrediction = unpredicted > 0 ? ` ${unpredicted} had no prediction.` : "";
  if (score.graded === 0) return `None of your predicted cells were run, so none could be graded.${noPrediction}`;
  const ungraded = score.predicted - score.graded;
  const notRun = ungraded > 0 ? ` ${ungraded} predicted cell${ungraded === 1 ? " was" : "s were"} not run.` : "";
  return `You predicted ${score.correct} of ${score.graded} cell${score.graded === 1 ? "" : "s"} right.${notRun}${noPrediction}`;
}

/**
 * The "Caught by any test" verdict for one column. A column with no caught cell
 * but some not-run cells says how many did not run, since a test that never ran
 * did not pass with the mutant in place.
 */
export function columnVerdict(states: readonly MutationCellState[]): { state: MutationCellState; notRun: number } {
  const notRun = states.filter((s) => s === "not-run").length;
  if (states.includes("caught")) return { state: "caught", notRun };
  if (states.includes("survived")) return { state: "survived", notRun };
  return { state: "not-run", notRun };
}

/** Whether a scroll container is wider than its box, so it should be a focusable region. */
function useHorizontalOverflow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return [ref, overflowing] as const;
}

const cellButton =
  "flex min-h-10 w-full flex-col items-start justify-center gap-0.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

export function MutationMatrix({
  label,
  rows,
  columns,
  cells,
  predictions = {},
  onPredict,
  revealed,
  onCellSelect,
  selectedCell,
  rowHeader = "Test",
  columnNoun = "mutant",
  columnTotals = false,
  className,
}: MutationMatrixProps) {
  const [scrollRef, overflowing] = useHorizontalOverflow<HTMLDivElement>();
  // The cell the learner pressed last, so the status can say what it now holds.
  const [lastPressed, setLastPressed] = useState<{ rowId: string; columnId: string } | null>(null);
  const score = scorePredictions(rows, columns, cells, predictions);
  const problems = matrixProblems(rows, columns);

  const lastRow = lastPressed ? rows.find((r) => r.id === lastPressed.rowId) : undefined;
  const lastColumn = lastPressed ? columns.find((c) => c.id === lastPressed.columnId) : undefined;
  const lastStatus =
    lastRow && lastColumn ? { where: `${lastRow.label} against ${lastColumn.label}`, prediction: predictions[cellKey(lastRow.id, lastColumn.id)] } : undefined;

  const status = revealed
    ? revealSummary(score, countCells(rows, columns, cells, "caught"), countCells(rows, columns, cells, "survived"))
    : onPredict
      ? predictionStatus(score, lastStatus)
      : "Results are hidden until the reveal.";

  const renderCell = (row: MutationAxisItem, col: MutationAxisItem) => {
    const key = cellKey(row.id, col.id);
    const prediction = predictions[key];
    const where = `${row.label} against ${col.label}`;

    if (!revealed) {
      if (!onPredict) {
        return (
          <span className={cn(cellButton, "border-dashed border-border/70 text-muted-foreground")}>
            <span aria-hidden>?</span>
            <span className="sr-only">{where}: result hidden</span>
          </span>
        );
      }
      return (
        <button
          type="button"
          aria-label={`${where}: ${prediction ? `predicted ${predictionText[prediction]}` : "no prediction yet"}`}
          onClick={() => {
            setLastPressed({ rowId: row.id, columnId: col.id });
            onPredict(row.id, col.id, nextPrediction(prediction));
          }}
          className={cn(
            cellButton,
            prediction ? "border-amber-500/70 bg-amber-500/10 text-amber-900 dark:text-amber-100" : "border-dashed border-border/70 text-muted-foreground hover:bg-muted",
          )}
        >
          <span aria-hidden className="text-[10px] font-bold uppercase tracking-wider">
            {prediction ? "Predict" : "?"}
          </span>
          <span aria-hidden className="font-medium">
            {prediction ? predictionText[prediction] : "press to predict"}
          </span>
        </button>
      );
    }

    const cell = cells[key] ?? { state: "not-run" as const };
    const view = stateView[cell.state];
    const grade = gradePrediction(prediction, cell.state);
    // A prediction on a cell that did not run stays visible, marked as not graded.
    const notGraded = prediction && grade === null ? notGradedText(prediction) : undefined;
    const verdict =
      grade !== null && prediction ? `you said ${predictionText[prediction]}, ${grade ? "prediction right" : "prediction wrong"}` : notGraded;
    const name = [`${where}: ${view.text}`, cell.summary, verdict].filter(Boolean).join(", ");
    const body = (
      <>
        <span className="font-semibold">
          <span aria-hidden>{view.glyph} </span>
          {view.text}
        </span>
        {cell.summary ? <span className="font-mono text-[11px] opacity-90 [font-variant-ligatures:none]">{cell.summary}</span> : null}
        {grade !== null ? (
          <span className={cn("text-[11px] font-medium", grade ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <span aria-hidden>{grade ? "✓" : "✕"} </span>
            {grade ? "prediction right" : "prediction wrong"}
          </span>
        ) : null}
        {notGraded ? <span className="text-[11px] font-medium text-muted-foreground">{notGraded}</span> : null}
      </>
    );
    if (onCellSelect) {
      const selected = selectedCell === key;
      return (
        <button
          type="button"
          aria-label={name}
          aria-pressed={selectedCell !== undefined ? selected : undefined}
          onClick={() => onCellSelect(row.id, col.id)}
          className={cn(cellButton, view.className, "hover:opacity-90", selected && "ring-2 ring-cyan-500")}
        >
          {body}
        </button>
      );
    }
    return (
      <span className={cn(cellButton, view.className)}>
        <span className="sr-only">{name}</span>
        <span aria-hidden className="contents">
          {body}
        </span>
      </span>
    );
  };

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div
        ref={scrollRef}
        role="region"
        aria-label={overflowing ? `${label} (scrolls sideways)` : label}
        tabIndex={overflowing ? 0 : undefined}
        className="max-w-full overflow-x-auto rounded-xl border border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">{label}</caption>
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card px-2 py-2 font-semibold">
                {rowHeader}
              </th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="min-w-[7.5rem] px-2 py-2 font-semibold normal-case tracking-normal text-foreground">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <th scope="row" className="sticky left-0 z-10 max-w-[9rem] bg-card px-2 py-2 align-middle text-xs font-semibold text-foreground">
                  <span className="break-words">{r.label}</span>
                </th>
                {columns.map((c) => (
                  <td key={c.id} className="px-1.5 py-1.5 align-top">
                    {renderCell(r, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {revealed && columnTotals ? (
            <tfoot>
              <tr className="border-t-2 border-border">
                <th scope="row" className="sticky left-0 z-10 bg-card px-2 py-2 text-xs font-semibold text-foreground">
                  Caught by any {rowHeader.toLowerCase()}
                </th>
                {columns.map((c) => {
                  const verdict = columnVerdict(rows.map((r) => cells[cellKey(r.id, c.id)]?.state ?? "not-run"));
                  const view = stateView[verdict.state];
                  return (
                    <td key={c.id} className="px-1.5 py-1.5">
                      <span className={cn(cellButton, view.className, "font-semibold")}>
                        <span>
                          <span aria-hidden>{view.glyph} </span>
                          {view.text}
                          {verdict.state === "survived" && verdict.notRun > 0 ? ` (${verdict.notRun} not run)` : null}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {revealed ? (
          <>
            <span className="font-semibold text-foreground">Legend: </span>✕ caught: this {rowHeader.toLowerCase()} detected the {columnNoun} · ○ survived: it passed with
            the {columnNoun} in place · – not run (a prediction there is not graded) · ✓/✕ under a result: your prediction was right/wrong.
            {columnTotals ? <> In the totals row, &quot;(n not run)&quot; counts the {rowHeader.toLowerCase()}s that never ran against that {columnNoun}.</> : null}
          </>
        ) : onPredict ? (
          <>Press a cell to predict. The first press predicts &quot;will catch&quot;; press again to switch to &quot;will miss&quot;.</>
        ) : null}
      </p>
      <p role="status" aria-live="polite" className="text-sm font-medium text-foreground">
        {status}
      </p>
      {problems.length ? (
        <p role="note" className="text-xs text-rose-700 dark:text-rose-300">
          <span aria-hidden>✕ </span>Mutation matrix data error: {problems.join("; ")}.
        </p>
      ) : null}
    </div>
  );
}

function countCells(
  rows: readonly MutationAxisItem[],
  columns: readonly MutationAxisItem[],
  cells: Readonly<Record<string, MutationCell>>,
  state: MutationCellState,
): number {
  let n = 0;
  rows.forEach((r) =>
    columns.forEach((c) => {
      if (cells[cellKey(r.id, c.id)]?.state === state) n += 1;
    }),
  );
  return n;
}

export default MutationMatrix;
