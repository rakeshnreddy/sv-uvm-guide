"use client";

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { OutcomeGroups, type OutcomeGroup } from "@/components/visual-system/OutcomeGroups";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  EVENT_MEMORY_ASSUMPTIONS,
  EVENT_MEMORY_PRESETS,
  TRIGGER_TIME,
  VERDICT_ICONS,
  VERDICT_LABELS,
  WAIT_FORMS,
  WAIT_FORM_INFO,
  WAITER_STARTS,
  WAITER_START_LABELS,
  WAITER_START_SHORT,
  cellExplanation,
  cellTimeline,
  eventMemoryCellKey,
  eventMemoryMatrix,
  eventMemorySource,
  matrixTakeaway,
  nextSuggestedCell,
  predictionFeedback,
  runEndState,
  runTitle,
  timeStepOrder,
  type CellOutcome,
  type CellRun,
  type CellVerdict,
  type EventMemoryPreset,
  type WaitForm,
  type WaiterStart,
} from "@/lib/sv-event-memory-scenarios";
import { cn } from "@/lib/utils";

export interface EventMemoryMatrixProps {
  /** late-arrival: Push Further, opens the 50 ns column; named-event-mistakes: opens @(ev) at 20 ns. */
  preset?: EventMemoryPreset;
  className?: string;
}

type Reveal = CellVerdict | "skipped";

const VERDICTS: readonly CellVerdict[] = ["passes", "blocks", "depends"];

const cellKey = eventMemoryCellKey;

const mono = "font-mono [font-variant-ligatures:none]";
const sectionTitle = "text-label text-muted-foreground";
const panel = "rounded-xl border border-border bg-card p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
/** The shared primitives size some buttons below 40 px: size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10 [@media(pointer:coarse)]:[&_summary]:min-h-10";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * A heading that takes the focus when it mounts. Used only where a reveal has
 * just removed the control that had the focus (Lock in prediction, Reveal
 * without predicting, Reveal all): never when the learner merely selects a cell.
 */
function FocusOnMount({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h5 ref={ref} tabIndex={-1} className={cn("text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </h5>
  );
}

/** Records the reveal in the parent once the prediction prompt has opened its answer. */
function RevealMarker({ onReveal }: { onReveal: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onReveal();
  }, [onReveal]);
  return null;
}

/* ------------------------------------------------------------------------- */
/* Matrix                                                                     */
/* ------------------------------------------------------------------------- */

function cellStatusText(cell: CellOutcome, reveal: Reveal | undefined): string {
  if (!reveal) return "not revealed yet";
  const verdict = VERDICT_LABELS[cell.verdict].toLowerCase();
  if (reveal === "skipped") return `${verdict}, revealed without a prediction`;
  return reveal === cell.verdict ? `${verdict}, you predicted it` : `${verdict}, you predicted ${VERDICT_LABELS[reveal].toLowerCase()}`;
}

interface MatrixProps {
  matrix: CellOutcome[][];
  revealed: Record<string, Reveal>;
  selected: string;
  onSelect: (form: WaitForm, start: WaiterStart) => void;
  /** The cell buttons, so the parent can return the focus to one. */
  refs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
}

function Matrix({ matrix, revealed, selected, onSelect, refs }: MatrixProps) {
  /** Roving tabindex: the one tabbable cell is the last one focused, reset to the current cell when it changes. */
  const [active, setActive] = useState(selected);
  useEffect(() => setActive(selected), [selected]);
  const move = (row: number, col: number, e: React.KeyboardEvent) => {
    let r = row;
    let c = col;
    if (e.key === "ArrowRight") c = Math.min(WAITER_STARTS.length - 1, col + 1);
    else if (e.key === "ArrowLeft") c = Math.max(0, col - 1);
    else if (e.key === "ArrowDown") r = Math.min(WAIT_FORMS.length - 1, row + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, row - 1);
    else if (e.key === "Home") c = 0;
    else if (e.key === "End") c = WAITER_STARTS.length - 1;
    else return;
    e.preventDefault();
    refs.current[cellKey(WAIT_FORMS[r], WAITER_STARTS[c])]?.focus();
  };
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
      <caption className="sr-only">
        Event memory matrix: wait form by waiter start time, with the notification at {TRIGGER_TIME} ns. Choose a cell to predict and run it; Tab reaches the last cell you were on and arrow keys move between cells.
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-[34%] px-1 py-1 text-left text-label text-muted-foreground">
            Wait form
          </th>
          {WAITER_STARTS.map((start) => (
            <th key={start} scope="col" className="px-1 py-1 text-center text-label text-muted-foreground">
              <span aria-hidden>{WAITER_START_SHORT[start]}</span>
              <span className="sr-only">{WAITER_START_LABELS[start]}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {matrix.map((row, ri) => (
          <tr key={WAIT_FORMS[ri]}>
            <th scope="row" className={cn("px-1 py-1 text-left text-xs font-medium text-foreground", mono)}>
              {/* Break only at spaces, so "wait (ev.triggered)" never leaves ")" alone on a line. */}
              {WAIT_FORM_INFO[WAIT_FORMS[ri]].waitCode.split(" ").map((word, wi) => (
                <Fragment key={wi}>
                  {wi > 0 ? " " : null}
                  <span className="whitespace-nowrap">{word}</span>
                </Fragment>
              ))}
            </th>
            {row.map((cell, ci) => {
              const key = cellKey(cell.form, cell.waiterStart);
              const reveal = revealed[key];
              const isSelected = selected === key;
              const predicted = reveal && reveal !== "skipped" ? reveal : undefined;
              return (
                <td key={key} className="p-0">
                  <button
                    type="button"
                    ref={(el) => {
                      refs.current[key] = el;
                    }}
                    tabIndex={active === key ? 0 : -1}
                    onFocus={() => setActive(key)}
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`${WAIT_FORM_INFO[cell.form].waitCode}, ${WAITER_START_LABELS[cell.waiterStart]}: ${cellStatusText(cell, reveal)}`}
                    onClick={() => onSelect(cell.form, cell.waiterStart)}
                    onKeyDown={(e) => move(ri, ci, e)}
                    className={cn(
                      "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-1 py-1.5 text-center text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      // Revealed: a solid hairline; not revealed: a dashed one. Both on the card surface.
                      reveal ? "border-solid" : "border-dashed",
                      // The current cell: raised surface and a solid 2 px accent on the leading edge.
                      isSelected
                        ? "border-l-2 border-l-primary bg-muted text-foreground [border-left-style:solid]"
                        : cn("bg-card", reveal ? "text-foreground" : "text-muted-foreground"),
                    )}
                  >
                    {reveal ? (
                      <>
                        <span aria-hidden className="text-sm leading-none">
                          {VERDICT_ICONS[cell.verdict]}
                        </span>
                        <span className="leading-tight">{VERDICT_LABELS[cell.verdict]}</span>
                        {predicted ? (
                          <span
                            aria-hidden
                            className={cn("leading-tight", predicted === cell.verdict ? "text-success" : "text-danger")}
                          >
                            {predicted === cell.verdict ? "✓ predicted" : "✕ predicted"}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span aria-hidden className="text-sm leading-none">
                          ?
                        </span>
                        <span className="leading-tight">Predict</span>
                      </>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------------- */
/* Evidence: lanes, log and the outcome groups                                */
/* ------------------------------------------------------------------------- */

const pct = (t: number, end: number) => `${(Math.max(0, Math.min(t, end)) / end) * 100}%`;

function Lanes({ cell, run }: { cell: CellOutcome; run: CellRun }) {
  const tl = cellTimeline(cell, run);
  const info = WAIT_FORM_INFO[cell.form];
  const waitEnd = tl.passTime ?? tl.endTime;
  const memoryEnd = tl.memory.until ?? tl.endTime;
  const instant = tl.memory.until === tl.memory.from;
  const lanesText = [
    `reset_gen sleeps until ${tl.notifyTime ?? TRIGGER_TIME} ns, then runs ${info.notifyCode}.`,
    tl.waiterStart > 0 ? `waiter sleeps until ${tl.waiterStart} ns, then runs ${info.waitCode}.` : `waiter runs ${info.waitCode} at 0 ns.`,
    tl.passTime !== undefined ? `waiter passes at ${tl.passTime} ns.` : `waiter is still blocked when the run ends at ${tl.endTime} ns.`,
    tl.memory.text,
  ].join(" ");
  return (
    <figure className={cn(panel, "space-y-3 overflow-hidden")} aria-label="Process lanes for this run">
      <figcaption className={sectionTitle}>Lanes: simulation time in ns</figcaption>
      <p className="sr-only">{lanesText}</p>
      <div aria-hidden className="space-y-3">
        <Lane label="reset_gen" code>
          <Segment from={0} to={tl.notifyTime ?? TRIGGER_TIME} end={tl.axisEnd} kind="sleep" />
          <Mark at={tl.notifyTime ?? TRIGGER_TIME} end={tl.axisEnd} symbol="◆" text={info.notifyCode} />
        </Lane>
        <Lane label="waiter" code>
          {tl.waiterStart > 0 ? <Segment from={0} to={tl.waiterStart} end={tl.axisEnd} kind="sleep" /> : null}
          <Segment from={tl.waiterStart} to={waitEnd} end={tl.axisEnd} kind="wait" />
          {tl.passTime !== undefined ? (
            <Mark at={tl.passTime} end={tl.axisEnd} symbol="✓" text="passed" />
          ) : (
            <Mark at={tl.endTime} end={tl.axisEnd} symbol="✕" text="still blocked" />
          )}
        </Lane>
        <Lane label="Notification memory" detail={tl.memory.label}>
          {tl.memory.kind === "time-step" ? (
            // A time step has no width on the ns axis: draw it as a bracket around its tick.
            <span
              data-testid="memory-mark-time-step"
              className="absolute inset-y-0 w-6 rounded-sm border-x-2 border-foreground/70 bg-foreground/20"
              style={{ left: `calc(${pct(tl.memory.from, tl.axisEnd)} - 12px)` }}
            />
          ) : instant ? (
            <span data-testid="memory-mark-instant" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pct(tl.memory.from, tl.axisEnd) }} />
          ) : (
            <span
              data-testid="memory-mark-span"
              className="absolute inset-y-1 rounded-sm border border-foreground/50 bg-foreground/20"
              style={{ left: pct(tl.memory.from, tl.axisEnd), width: `calc(${pct(memoryEnd, tl.axisEnd)} - ${pct(tl.memory.from, tl.axisEnd)} + 4px)` }}
            />
          )}
        </Lane>
        <div className="relative mx-2 h-5 border-t border-border">
          {tl.ticks.map((t) => (
            <span key={t} className={cn("absolute top-1 -translate-x-1/2 text-xs text-muted-foreground tabular-nums", mono)} style={{ left: pct(t, tl.axisEnd) }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="memory-span">
        {tl.memory.text}
      </p>
      <p className="text-xs text-muted-foreground">
        <span aria-hidden>- - - </span>sleeping in a delay · <span aria-hidden>▬ </span>blocked in the wait · ◆ notification · ✓ passed · ✕ still blocked at the end
      </p>
    </figure>
  );
}

function Lane({ label, detail, code = false, children }: { label: string; detail?: string; code?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-foreground">
        <span className={cn(code && mono)}>{label}</span>
        {detail ? (
          <>
            : <span data-testid="memory-label" className={mono}>{detail}</span>
          </>
        ) : null}
      </p>
      <div className="relative mx-2 h-6">{children}</div>
    </div>
  );
}

function Segment({ from, to, end, kind }: { from: number; to: number; end: number; kind: "sleep" | "wait" }) {
  const width = `calc(${pct(to, end)} - ${pct(from, end)})`;
  return kind === "sleep" ? (
    <span className="absolute top-1/2 border-t-2 border-dashed border-muted-foreground" style={{ left: pct(from, end), width }} />
  ) : (
    <span className="absolute inset-y-1 rounded-sm border border-border bg-muted" style={{ left: pct(from, end), width: `calc(${width} + 4px)` }} />
  );
}

function Mark({ at, end, symbol, text }: { at: number; end: number; symbol: string; text: string }) {
  const left = (Math.min(at, end) / end) * 100;
  return (
    <span
      className={cn("absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap text-xs text-foreground", left > 60 ? "-translate-x-full flex-row-reverse" : "-translate-x-1")}
      style={{ left: `${left}%` }}
    >
      <span className="rounded-sm bg-card px-0.5 text-sm leading-none">{symbol}</span>
      <span className={cn("rounded-sm bg-card px-0.5", mono)}>{text}</span>
    </span>
  );
}

/** The steps inside the notification's time step, in the order this run took (§4.7 leaves it open). */
function TimeStepOrder({ run }: { run: CellRun }) {
  const steps = timeStepOrder(run.result);
  if (!steps.length) return null;
  return (
    <div className={cn(panel, "space-y-1")}>
      <p className={sectionTitle}>
        Inside the {TRIGGER_TIME} ns time step, in the order this run took
      </p>
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-foreground" aria-label={`Inside the ${TRIGGER_TIME} ns time step`}>
        {steps.map((s, i) => (
          <li key={i} className="break-words">
            {s}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">No simulation time passes between these steps; the standard leaves the order of ready processes open (§4.7).</p>
    </div>
  );
}

function RunLog({ run }: { run: CellRun }) {
  return (
    <div className="rounded-xl border border-code-border bg-code-surface p-3 text-xs text-code-foreground">
      <p className="mb-1 text-label text-code-muted">Log of this run</p>
      <ol className={cn("space-y-0.5", mono)} aria-label="Log of this run">
        {run.result.log.map((l, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-12 shrink-0 text-right text-code-muted tabular-nums">{l.time} ns</span>
            <span className="min-w-0 break-words">{l.text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 border-t border-code-border pt-2 text-code-muted">End: {runEndState(run)}</p>
    </div>
  );
}

function Evidence({ cell }: { cell: CellOutcome }) {
  const [runIndex, setRunIndex] = useState(0);
  const run = cell.runs[Math.min(runIndex, cell.runs.length - 1)];
  const groups: OutcomeGroup[] = cell.runs.map((r, i) => ({
    id: `run-${i}`,
    title: runTitle(r),
    runCount: r.runCount,
    lines: r.result.log.map((l) => ({ time: `t = ${l.time} ns`, text: l.text })),
    endState: runEndState(r),
  }));
  return (
    <div className="space-y-3">
      <OutcomeGroups
        groups={groups}
        runCount={cell.exploration.runCount}
        capped={cell.exploration.capped}
        onSelect={cell.runs.length > 1 ? (id) => setRunIndex(Number(id.replace("run-", ""))) : undefined}
        selectedId={cell.runs.length > 1 ? `run-${runIndex}` : undefined}
        selectLabel="Show this run in the lanes"
        label="Outcomes across every order of the ready processes"
      />
      <Lanes cell={cell} run={run} />
      <TimeStepOrder run={run} />
      <RunLog run={run} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The selected cell                                                          */
/* ------------------------------------------------------------------------- */

function predictionOptions(cell: CellOutcome): PredictionOption[] {
  return VERDICTS.map((v) => ({
    id: v,
    label: (
      <span>
        <span aria-hidden>{VERDICT_ICONS[v]} </span>
        {VERDICT_LABELS[v]}
      </span>
    ),
    correct: v === cell.verdict,
    feedback: predictionFeedback(cell, v),
  }));
}

function cellQuestion(cell: CellOutcome): string {
  const info = WAIT_FORM_INFO[cell.form];
  const when = cell.waiterStart === 0 ? "is waiting from 0 ns" : `starts ${info.waitCode} at ${cell.waiterStart} ns`;
  return `reset_gen runs ${info.notifyCode} at ${TRIGGER_TIME} ns and the waiter ${when}. Does ${info.waitCode} let the waiter through?`;
}

function RevealedCell({ cell, reveal }: { cell: CellOutcome; reveal: Reveal }) {
  const right = reveal === cell.verdict;
  return (
    <div className="space-y-3">
      <div className={cn(panel, "space-y-2 text-sm")}>
        <h5 className="text-sm font-semibold text-foreground">
          <span aria-hidden>{VERDICT_ICONS[cell.verdict]} </span>
          {VERDICT_LABELS[cell.verdict]}
        </h5>
        {reveal === "skipped" ? (
          <p className="text-muted-foreground">Revealed without a prediction.</p>
        ) : (
          <p className={right ? "text-success" : "text-danger"}>
            <span aria-hidden>{right ? "✓ " : "✕ "}</span>
            Your prediction: {VERDICT_LABELS[reveal]}.
            {right ? null : <> {predictionFeedback(cell, reveal)}</>}
          </p>
        )}
        <p className="text-foreground" data-testid="cell-explanation">
          {cellExplanation(cell)}
        </p>
      </div>
      <Evidence cell={cell} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The component                                                              */
/* ------------------------------------------------------------------------- */

export default function EventMemoryMatrix({ preset = "late-arrival", className }: EventMemoryMatrixProps) {
  const info = EVENT_MEMORY_PRESETS[preset] ?? EVENT_MEMORY_PRESETS["late-arrival"];
  const matrix = useMemo(() => eventMemoryMatrix(), []);
  const cells = useMemo(() => new Map(matrix.flat().map((cell) => [cellKey(cell.form, cell.waiterStart), cell])), [matrix]);
  const startKey = cellKey(info.form, info.waiterStart);
  const [selected, setSelected] = useState(startKey);
  const [promptKey, setPromptKey] = useState<string | null>(startKey);
  const [revealed, setRevealed] = useState<Record<string, Reveal>>({});
  const [announcement, setAnnouncement] = useState("");
  /** Bumped by "Clear the matrix": remounts the prompt even when the cell on screen is the start cell again. */
  const [epoch, setEpoch] = useState(0);
  /** A matrix cell to give the focus to after the control that had it goes away. */
  const [focusCell, setFocusCell] = useState<string | null>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!focusCell) return;
    cellRefs.current[focusCell]?.focus();
    setFocusCell(null);
  }, [focusCell]);

  const cell = cells.get(selected) as CellOutcome;
  const total = cells.size;
  const revealedCount = Object.keys(revealed).length;
  const complete = revealedCount === total;
  const suggestion = revealed[selected] && !complete ? nextSuggestedCell(Object.keys(revealed)) : undefined;

  const cellName = (c: CellOutcome) => `${WAIT_FORM_INFO[c.form].waitCode}, ${WAITER_START_LABELS[c.waiterStart]}`;

  const select = (form: WaitForm, start: WaiterStart) => {
    const key = cellKey(form, start);
    setSelected(key);
    setPromptKey(revealed[key] ? null : key);
    // Selecting a revealed cell leaves the focus on the matrix; the status line names its answer.
    const c = cells.get(key) as CellOutcome;
    setAnnouncement(revealed[key] ? `${cellName(c)}: ${VERDICT_LABELS[c.verdict]}.` : "");
  };

  const markRevealed = (key: string, committed: string | null) => {
    if (revealed[key]) return;
    const next: Record<string, Reveal> = { ...revealed, [key]: (committed as CellVerdict | null) ?? "skipped" };
    setRevealed(next);
    // The prompt's feedback block mounts together with its content and the focus moves to the run's
    // heading at the same moment, so a screen reader may not speak it. This status line is mounted
    // from the start, so the verdict (read from the model) is announced here.
    const c = cells.get(key) as CellOutcome;
    setAnnouncement(`${cellName(c)}: ${VERDICT_LABELS[c.verdict]}. ${Object.keys(next).length} of ${total} cells revealed.`);
  };

  const revealRest = () => {
    const next: Record<string, Reveal> = { ...revealed };
    cells.forEach((_, key) => {
      if (!next[key]) next[key] = "skipped";
    });
    setRevealed(next);
    setPromptKey(null);
    setAnnouncement(`All ${total} cells revealed.`);
  };

  const startOver = () => {
    setRevealed({});
    setSelected(startKey);
    setPromptKey(startKey);
    setEpoch((n) => n + 1);
    setAnnouncement("Matrix cleared.");
    setFocusCell(startKey);
  };

  const trySuggested = () => {
    if (!suggestion) return;
    select(suggestion.form, suggestion.waiterStart);
    setFocusCell(cellKey(suggestion.form, suggestion.waiterStart));
  };

  const formInfo = WAIT_FORM_INFO[cell.form];

  return (
    <VisualFrame
      label="Event memory matrix"
      eyebrow="Experiment"
      title="How long does each wait remember a notification?"
      summary={info.intro}
      fidelity="model"
      assumptions={[...EVENT_MEMORY_ASSUMPTIONS]}
      className={cn(touchButtons, className)}
    >
      <p role="status" aria-live="polite" className="sr-only" data-testid="matrix-status">
        {announcement}
      </p>

      <div className={cn(panel, "space-y-2 px-1 sm:px-3")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 sm:px-0">
          <p className={sectionTitle}>
            reset_gen notifies once, at {TRIGGER_TIME} ns. Pick a cell: a wait form and when the waiter starts.
          </p>
          <p className="text-xs text-muted-foreground tabular-nums" data-testid="matrix-progress">
            {revealedCount} of {total} revealed
          </p>
        </div>
        <Matrix matrix={matrix} revealed={revealed} selected={selected} onSelect={select} refs={cellRefs} />
        <p className="px-2 text-xs text-muted-foreground sm:px-0">
          {VERDICT_ICONS.passes} passes · {VERDICT_ICONS.blocks} blocks forever · {VERDICT_ICONS.depends} depends on the order of processes ready at the same time · ? not yet revealed
        </p>
      </div>

      <section aria-label={`Cell: ${formInfo.waitCode}, ${WAITER_START_LABELS[cell.waiterStart]}`} className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          <span className={mono}>{formInfo.waitCode}</span>, {WAITER_START_LABELS[cell.waiterStart].toLowerCase()}
        </h4>
        <CodeTrace lines={eventMemorySource(cell.form, cell.waiterStart)} label="The code this cell runs" />
        {promptKey === selected ? (
          <PredictionPrompt
            key={`${selected}:${epoch}`}
            question={cellQuestion(cell)}
            options={predictionOptions(cell)}
            resetKey={`${selected}:${epoch}`}
          >
            {({ committed }) => (
              <div className="space-y-3">
                <RevealMarker onReveal={() => markRevealed(selected, committed)} />
                <FocusOnMount>What the model ran</FocusOnMount>
                <Evidence key={selected} cell={cell} />
              </div>
            )}
          </PredictionPrompt>
        ) : revealed[selected] ? (
          <RevealedCell key={selected} cell={cell} reveal={revealed[selected]} />
        ) : null}
      </section>

      {suggestion ? (
        <p className="text-sm text-foreground" data-testid="try-next">
          <span className="text-muted-foreground">Try next: </span>
          <button
            type="button"
            onClick={trySuggested}
            className="inline-flex min-h-10 items-center rounded-md px-1 text-left font-medium text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={mono}>{suggestion.label}</span>
          </button>
          <span className="text-muted-foreground">: {suggestion.hint}.</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!complete ? (
          <button type="button" className={buttonClass} onClick={revealRest}>
            {revealedCount === 0 ? `Reveal all ${plural(total, "cell")}` : `Reveal the other ${plural(total - revealedCount, "cell")}`}
          </button>
        ) : null}
        {revealedCount > 0 ? (
          <button type="button" className={buttonClass} onClick={startOver}>
            Clear the matrix and start over
          </button>
        ) : null}
      </div>

      {complete ? (
        <div className={cn(panel, "space-y-1")} data-testid="matrix-takeaway">
          <FocusOnMount className="text-label font-medium text-muted-foreground">The completed matrix</FocusOnMount>
          <p className="text-sm text-foreground">{matrixTakeaway(matrix)}</p>
        </div>
      ) : null}
    </VisualFrame>
  );
}
