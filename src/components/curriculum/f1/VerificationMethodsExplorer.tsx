"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { CycleWaveform, type CycleMarker } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ASSUMPTIONS,
  BUCKET_LABELS,
  BUG_COUNT,
  BUG_HUNT_STEPS,
  COUNT_VALUES,
  CYCLE_BUDGETS,
  D_VALUES,
  FORMAL_SLICE_NOTE,
  LESSON_RANDOM,
  LESSON_TESTS,
  MAX_CUSTOM_STEPS,
  METHODS_ASSUMPTIONS,
  P_EN_CHOICES,
  P_LD_CHOICES,
  ROWS,
  ROW_LABELS,
  ROW_SHORT,
  UNKNOWN_COUNT_RULES,
  bucketOf,
  cellKey,
  cellShares,
  counterexampleWave,
  coverWarning,
  curveText,
  directedCellText,
  directedVerdict,
  excludedCells,
  findAssumption,
  formalCellText,
  formalCheck,
  formatFound,
  formatShare,
  foundProbabilities,
  gridSummary,
  isBugCell,
  maskedAtDZeroText,
  randomCellText,
  randomExplanation,
  runDirected,
  seededRunText,
  seededVisits,
  simulateRandom,
  stepsText,
  visitedCells,
  type AssumptionId,
  type CycleBudget,
  type DirectedStep,
  type NamedRun,
  type ProbabilityBucket,
  type RandomParams,
  type Row,
} from "@/lib/verification-methods-model";
import { cn } from "@/lib/utils";

export type VerificationMethodsTab = "directed" | "random" | "formal";
export type VerificationMethodsPreset = "f1b-methods" | "f1b-assumptions";

export interface VerificationMethodsExplorerProps {
  /** One preset per lesson use: "f1b-methods" (the methods section, default) or "f1b-assumptions" (the expert section on over-constraint). */
  preset?: VerificationMethodsPreset;
  /** Overrides the preset's starting tab. */
  initialTab?: VerificationMethodsTab;
}

export const VERIFICATION_METHODS_PRESETS: Record<VerificationMethodsPreset, { tab: VerificationMethodsTab; assumption: AssumptionId }> = {
  "f1b-methods": { tab: "directed", assumption: "none" },
  "f1b-assumptions": { tab: "formal", assumption: "noLdEn" },
};

export const CUSTOM_TEST_NAME = "Test 4: yours";

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const selectClass = "h-10 min-w-0 rounded-md border border-border/70 bg-background/60 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const touch = "[@media(pointer:coarse)]:[&_button]:min-h-10 [@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";

/**
 * Tells the parent that a PredictionPrompt has revealed for `revealKey` (it
 * renders children only after commit or skip), and withdraws the reveal when
 * the prompt hides its children again.
 */
function RevealSignal({ revealKey, onReveal }: { revealKey: string; onReveal: (key: string | null) => void }) {
  useEffect(() => {
    onReveal(revealKey);
    return () => onReveal(null);
  }, [revealKey, onReveal]);
  return null;
}

/**
 * Reveal state for one PredictionPrompt keyed by `key`. Any change of key
 * clears the reveal during render, the same way PredictionPrompt resets, so
 * going A -> B -> A never brings back A's old reveal.
 */
function useRevealGate(key: string): { revealed: boolean; signal: React.ReactNode } {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setRevealedKey(null);
  }
  return { revealed: revealedKey === key && lastKey === key, signal: <RevealSignal revealKey={key} onReveal={setRevealedKey} /> };
}

/* ------------------------------------------------------------------ */
/* The 8 x 4 grid                                                      */
/* ------------------------------------------------------------------ */

interface GridCell {
  /** Text drawn in the cell (short). */
  mark: string;
  /** 0 to 1: fill strength. */
  fill: number;
  excluded?: boolean;
  /** A seeded run or a trace cursor sits on this cell. */
  ring?: boolean;
  /** The bug fired in this cell. */
  hit?: boolean;
  /** Full sentence for the cell (button name and status). */
  text: string;
}

interface MethodsGridProps {
  caption: string;
  summary: string;
  dSlice: number | null;
  cell: (row: Row, count: number) => GridCell;
  testId: string;
}

function MethodsGrid({ caption, summary, dSlice, cell, testId }: MethodsGridProps) {
  const summaryId = useId();
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: ROWS.length - 1, c: BUG_COUNT });
  const [selected, setSelected] = useState<string | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(ROWS.length - 1, r));
    const nc = Math.max(0, Math.min(COUNT_VALUES.length - 1, c));
    setFocus({ r: nr, c: nc });
    refs.current[nr * COUNT_VALUES.length + nc]?.focus();
  };

  const selectedText = selected
    ? (() => {
        const [row, count] = selected.split(":");
        return cell(row as Row, Number(count)).text;
      })()
    : "Select a cell for its details. Arrow keys move between cells.";

  return (
    <div className="space-y-2" data-testid={testId}>
      <table className="w-full table-fixed border-separate border-spacing-[2px] text-center" aria-describedby={summaryId}>
        <caption className="mb-1 text-left text-xs text-muted-foreground">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[3.25rem] text-left text-[10px] font-medium text-muted-foreground">
              count
            </th>
            {COUNT_VALUES.map((c) => (
              <th key={c} scope="col" className={cn("text-[11px] font-semibold text-muted-foreground", mono)}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={row}>
              <th scope="row" className="truncate text-left text-[11px] font-medium text-foreground" title={ROW_LABELS[row]}>
                <abbr title={ROW_LABELS[row]} className="no-underline">
                  {ROW_SHORT[row]}
                </abbr>
              </th>
              {COUNT_VALUES.map((count, c) => {
                const g = cell(row, count);
                const bug = isBugCell(count, row);
                const masked = bug && dSlice === 0;
                const key = cellKey(row, count);
                return (
                  <td key={count} className="p-0">
                    <button
                      ref={(el) => {
                        refs.current[r * COUNT_VALUES.length + c] = el;
                      }}
                      type="button"
                      tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                      aria-label={g.text}
                      aria-pressed={selected === key}
                      data-cell={key}
                      data-excluded={g.excluded ? "true" : undefined}
                      onClick={() => {
                        setFocus({ r, c });
                        setSelected(key);
                      }}
                      onKeyDown={(e) => {
                        const k = e.key;
                        if (k === "ArrowRight") move(r, c + 1);
                        else if (k === "ArrowLeft") move(r, c - 1);
                        else if (k === "ArrowDown") move(r + 1, c);
                        else if (k === "ArrowUp") move(r - 1, c);
                        else if (k === "Home") move(r, 0);
                        else if (k === "End") move(r, COUNT_VALUES.length - 1);
                        else return;
                        e.preventDefault();
                      }}
                      className={cn(
                        "relative flex h-9 w-full min-w-0 items-center justify-center rounded-md border text-[10px] leading-none text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                        mono,
                        g.excluded ? "border-dashed border-slate-400/70 bg-slate-500/10 text-muted-foreground" : "border-border/60",
                        bug && !masked && "border-2 border-rose-500 dark:border-rose-400",
                        masked && "border-2 border-dashed border-amber-500",
                        selected === key && "ring-2 ring-cyan-500",
                        g.hit && "bg-rose-500/25",
                      )}
                      style={!g.excluded && !g.hit && g.fill > 0 ? { backgroundColor: `rgba(6, 182, 212, ${(0.12 + 0.55 * g.fill).toFixed(3)})` } : undefined}
                    >
                      <span aria-hidden="true">{g.mark}</span>
                      {g.ring ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-300" /> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p id={summaryId} className="text-xs text-muted-foreground">
        {summary}
      </p>
      {/* Visual echo of the selected cell. Not live: the cell button's own name already carries the sentence, so a live region would announce it twice. */}
      <p className="min-h-[2.5rem] rounded-lg bg-muted/30 px-2 py-1.5 text-xs text-foreground" data-testid={`${testId}-status`}>
        {selectedText}
      </p>
    </div>
  );
}

function DSliceControl({ value, onChange, tab }: { value: number | null; onChange: (d: number | null) => void; tab: VerificationMethodsTab }) {
  return (
    <div className="space-y-1">
      <SegmentedControl
        label="d slice"
        value={value === null ? "all" : String(value)}
        onChange={(v) => onChange(v === "all" ? null : Number(v))}
        options={[{ value: "all", label: "all d", ariaLabel: "all values of d" }, ...D_VALUES.map((d) => ({ value: String(d), label: `d=${d}`, ariaLabel: `d = ${d}` }))]}
        mono
      />
      {value === 0 ? <p className="text-xs text-amber-800 dark:text-amber-200">{maskedAtDZeroText()}</p> : null}
      {tab === "formal" ? (
        <p className="text-xs text-muted-foreground" data-testid="formal-slice-note">
          {FORMAL_SLICE_NOTE}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Directed                                                            */
/* ------------------------------------------------------------------ */

function DirectedTab({ dSlice }: { dSlice: number | null }) {
  const [selectedTests, setSelectedTests] = useState<string[]>(LESSON_TESTS.map((t) => t.id));
  const [custom, setCustom] = useState<DirectedStep[]>([]);
  const [useCustom, setUseCustom] = useState(false);
  const [stepD, setStepD] = useState(3);
  const [traceOf, setTraceOf] = useState(0);
  const [cursor, setCursor] = useState(1);

  const tests: NamedRun[] = useMemo(() => {
    const out: NamedRun[] = LESSON_TESTS.filter((t) => selectedTests.includes(t.id)).map((t) => ({ name: t.name, run: runDirected(t.steps) }));
    if (useCustom && custom.length > 0) out.push({ name: CUSTOM_TEST_NAME, run: runDirected(custom) });
    return out;
  }, [selectedTests, useCustom, custom]);

  const key = `${selectedTests.join(",")}|${useCustom && custom.length > 0 ? stepsText(custom) : ""}`;
  const { revealed, signal } = useRevealGate(key);
  const verdict = directedVerdict(tests);
  const visited = visitedCells(
    tests.map((t) => t.run),
    dSlice,
  );
  const traced = tests[Math.min(traceOf, tests.length - 1)];
  const traceRows = traced?.run.trace ?? [];
  const cursorRow = traceRows[Math.min(cursor, traceRows.length) - 1];

  const add = (step: DirectedStep) => {
    setCustom((s) => (s.length >= MAX_CUSTOM_STEPS ? s : [...s, step]));
    setUseCustom(true);
  };

  const options: PredictionOption[] = [
    {
      id: "found",
      label: "Found: some test drives the bug",
      correct: verdict.found,
      feedback: verdict.found ? verdict.text : `Visiting many cells is not visiting the bug cell. ${verdict.text}`,
    },
    {
      id: "missed",
      label: "Missed: the bug escapes",
      correct: !verdict.found,
      feedback: verdict.found ? `A test does reach it. ${verdict.text}` : verdict.text,
    },
  ];

  return (
    <div className="space-y-4">
      <fieldset className={cn(panel, "space-y-2")}>
        <legend className="px-1 text-sm font-semibold text-foreground">Tests to run</legend>
        {LESSON_TESTS.map((t) => (
          <label key={t.id} className="flex items-start gap-2 text-sm text-foreground [@media(pointer:coarse)]:min-h-10">
            <input
              type="checkbox"
              className="mt-1 accent-cyan-500"
              checked={selectedTests.includes(t.id)}
              onChange={(e) => setSelectedTests((s) => (e.target.checked ? LESSON_TESTS.map((x) => x.id).filter((id) => id === t.id || s.includes(id)) : s.filter((id) => id !== t.id)))}
            />
            <span>
              <span className="font-medium">{t.name}</span>
              <span className="block text-xs text-muted-foreground">
                {t.description}: <span className={mono}>{stepsText(t.steps)}</span>
              </span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-sm text-foreground [@media(pointer:coarse)]:min-h-10">
          <input type="checkbox" className="mt-1 accent-cyan-500" checked={useCustom} disabled={custom.length === 0} onChange={(e) => setUseCustom(e.target.checked)} />
          <span>
            <span className="font-medium">{CUSTOM_TEST_NAME}</span>
            <span className={cn("block text-xs text-muted-foreground", mono)} data-testid="custom-steps">
              {stepsText(custom)}
            </span>
          </span>
        </label>
        <details className="rounded-lg border border-border/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Build test 4 as a step list</summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass} onClick={() => add({ kind: "reset" })}>
                + reset
              </button>
              <button type="button" className={buttonClass} onClick={() => add({ kind: "hold" })}>
                + hold
              </button>
              <button type="button" className={buttonClass} onClick={() => add({ kind: "inc" })}>
                + increment
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                d
                <select className={selectClass} value={stepD} onChange={(e) => setStepD(Number(e.target.value))} aria-label="d for the next load step">
                  {D_VALUES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={buttonClass} onClick={() => add({ kind: "load", d: stepD })}>
                + load d
              </button>
              <button type="button" className={buttonClass} onClick={() => add({ kind: "loadInc", d: stepD })}>
                + ld+en d
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass} disabled={custom.length === 0} onClick={() => setCustom((s) => s.slice(0, -1))}>
                Remove last
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={custom.length === 0}
                onClick={() => {
                  setCustom([]);
                  setUseCustom(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setCustom([...BUG_HUNT_STEPS]);
                  setUseCustom(true);
                }}
              >
                Example: {stepsText(BUG_HUNT_STEPS)}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Up to {MAX_CUSTOM_STEPS} steps.</p>
            <p className="text-xs text-muted-foreground" data-testid="unknown-count-rules">
              {UNKNOWN_COUNT_RULES}
            </p>
          </div>
        </details>
      </fieldset>

      <MethodsGrid
        testId="directed-grid"
        caption={revealed ? "Directed: a filled cell is one the selected tests visit." : "Directed: which cells do the selected tests visit? Predict first."}
        summary={gridSummary("directed", dSlice)}
        dSlice={dSlice}
        cell={(row, count) => {
          const isVisited = revealed && visited.has(cellKey(row, count));
          const onCursor = revealed && cursorRow?.row === row && cursorRow?.count === count && (dSlice === null || cursorRow.d === null || cursorRow.d === dSlice);
          return {
            mark: isVisited ? "●" : isBugCell(count, row) && dSlice !== 0 ? "✕" : "",
            fill: isVisited ? 1 : 0,
            ring: onCursor,
            text: revealed ? directedCellText(tests, row, count, dSlice) : `${ROW_LABELS[row]} at count ${count}: hidden until you predict.`,
          };
        }}
      />

      <PredictionPrompt question="Does this selection of tests find the bug?" options={options} resetKey={key}>
        {signal}
        <div className="space-y-3" data-testid="directed-result">
          <p className={cn("text-sm font-semibold", verdict.found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>{verdict.text}</p>
          {tests.length > 0 ? (
            <div className={cn(panel, "space-y-2")}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-0 items-center gap-2 text-sm">
                  Trace of
                  <select
                    className={selectClass}
                    value={Math.min(traceOf, tests.length - 1)}
                    onChange={(e) => {
                      setTraceOf(Number(e.target.value));
                      setCursor(1);
                    }}
                  >
                    {tests.map((t, i) => (
                      <option key={t.name} value={i}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm">
                  Step
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, traceRows.length)}
                    value={Math.min(cursor, traceRows.length)}
                    onChange={(e) => setCursor(Number(e.target.value))}
                    aria-valuetext={cursorRow ? `step ${cursorRow.step}: ${cursorRow.text}` : "no steps"}
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-cyan-500 [@media(pointer:coarse)]:h-10"
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-0 text-left text-xs">
                  <caption className="sr-only">Step-by-step trace of {traced?.name}</caption>
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="pr-2 font-medium">
                        #
                      </th>
                      <th scope="col" className="pr-2 font-medium">
                        step
                      </th>
                      <th scope="col" className="pr-2 font-medium">
                        count
                      </th>
                      <th scope="col" className="pr-2 font-medium">
                        spec next
                      </th>
                      <th scope="col" className="font-medium">
                        RTL next
                      </th>
                    </tr>
                  </thead>
                  <tbody className={mono}>
                    {traceRows.map((t) => (
                      <tr key={t.step} className={cn(t.step === cursorRow?.step && "bg-cyan-500/10", t.diverges && "text-rose-700 dark:text-rose-300")} aria-current={t.step === cursorRow?.step ? "step" : undefined}>
                        <td className="pr-2">{t.step}</td>
                        <td className="pr-2">{t.text}</td>
                        <td className="pr-2">{t.text === "reset" ? "—" : t.count === null ? "X" : t.count}</td>
                        <td className="pr-2">{t.specNext ?? "X"}</td>
                        <td>
                          {t.rtlNext ?? "X"}
                          {t.codingDependent ? " (coding-dependent)" : ""}
                          {t.diverges ? " ✕" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Random                                                              */
/* ------------------------------------------------------------------ */

const PREDICT_BUDGET: CycleBudget = 20;

function ProbabilityCurve({ params, budget }: { params: RandomParams; budget: CycleBudget }) {
  const curve = useMemo(() => foundProbabilities(params, 1000), [params]);
  const W = 300;
  const H = 120;
  const L = 34;
  const B = 22;
  const x = (n: number) => L + ((W - L - 8) * Math.log10(n)) / 3;
  const y = (p: number) => 8 + (H - B - 8) * (1 - p);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const n = Math.max(1, Math.round(10 ** ((3 * i) / 60)));
    pts.push(`${x(n).toFixed(1)},${y(curve[n]).toFixed(1)}`);
  }
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[420px]" role="img" aria-label={curveText(params)}>
        <line x1={L} y1={y(0)} x2={W - 8} y2={y(0)} className="stroke-muted-foreground/50" />
        <line x1={L} y1={y(0)} x2={L} y2={y(1)} className="stroke-muted-foreground/50" />
        {[0, 0.5, 1].map((p) => (
          <text key={p} x={L - 4} y={y(p) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
            {p * 100}%
          </text>
        ))}
        {[1, 10, 100, 1000].map((n) => (
          <text key={n} x={x(n)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {n.toLocaleString("en-US")}
          </text>
        ))}
        <polyline points={pts.join(" ")} fill="none" className="stroke-cyan-600 dark:stroke-cyan-400" strokeWidth={2} />
        {CYCLE_BUDGETS.map((n) => (
          <circle key={n} cx={x(n)} cy={y(curve[n])} r={n === budget ? 4.5 : 3} className={n === budget ? "fill-rose-600 dark:fill-rose-400" : "fill-cyan-600 dark:fill-cyan-400"} />
        ))}
      </svg>
      <figcaption className="text-xs text-muted-foreground">x: cycles after reset (log scale). y: share of seeds that have reached the bug. Exact, from a Markov chain over count.</figcaption>
    </figure>
  );
}

function RandomTab({ dSlice }: { dSlice: number | null }) {
  const [params, setParams] = useState<RandomParams>(LESSON_RANDOM);
  const [budget, setBudget] = useState<CycleBudget>(PREDICT_BUDGET);
  const [seed, setSeed] = useState(1);
  const [seedDraft, setSeedDraft] = useState("1");
  const [cursor, setCursor] = useState<number>(PREDICT_BUDGET);
  const { revealed, signal } = useRevealGate("random");
  const seedId = useId();

  const shares = useMemo(() => cellShares(params, dSlice), [params, dSlice]);
  const maxShare = Math.max(...ROWS.flatMap((r) => shares[r]));
  const run = useMemo(() => simulateRandom(params, budget, seed), [params, budget, seed]);
  const upTo = Math.min(cursor, budget);
  const visits = useMemo(() => seededVisits(run, upTo, dSlice), [run, upTo, dSlice]);

  const changeSeed = (s: number) => {
    setSeed(s);
    setSeedDraft(String(s));
  };
  /** Commits the typed seed if it is an integer 1 to 99999; otherwise restores the current one. */
  const commitSeed = () => {
    const v = Number(seedDraft.trim());
    if (seedDraft.trim() !== "" && Number.isInteger(v) && v >= 1 && v <= 99999) changeSeed(v);
    else setSeedDraft(String(seed));
  };
  const hitKey = run.foundAtCycle !== null && run.foundAtCycle <= upTo ? cellKey("loadInc", BUG_COUNT) : null;
  const hitShown = hitKey !== null && (dSlice === null || dSlice === run.samples[(run.foundAtCycle as number) - 1].inputs.d);

  const lessonCurve = useMemo(() => foundProbabilities(LESSON_RANDOM, PREDICT_BUDGET), []);
  const lessonP = lessonCurve[PREDICT_BUDGET];
  const correctBucket = bucketOf(lessonP);
  const options: PredictionOption[] = (Object.keys(BUCKET_LABELS) as ProbabilityBucket[]).map((b) => ({
    id: b,
    label: BUCKET_LABELS[b],
    correct: b === correctBucket,
    feedback: b === correctBucket ? randomExplanation(LESSON_RANDOM, PREDICT_BUDGET) : `The exact figure is ${formatFound(LESSON_RANDOM, PREDICT_BUDGET)}. ${randomExplanation(LESSON_RANDOM, PREDICT_BUDGET)}`,
  }));

  const pct = (p: number) => `${Math.round(p * 100)}%`;

  return (
    <div className="space-y-4">
      <MethodsGrid
        testId="random-grid"
        caption={revealed ? "Random: the number is each cell's long-run share of cycles (%); a dot marks a cell the seeded run visits." : "Random: en 50%, ld 10%, d uniform. Predict first."}
        summary={gridSummary("random", dSlice)}
        dSlice={dSlice}
        cell={(row, count) => {
          const k = cellKey(row, count);
          if (!revealed) return { mark: isBugCell(count, row) && dSlice !== 0 ? "✕" : "", fill: 0, text: `${ROW_LABELS[row]} at count ${count}: hidden until you predict.` };
          return {
            mark: formatShare(shares[row][count]),
            fill: maxShare > 0 ? shares[row][count] / maxShare : 0,
            ring: visits.has(k),
            hit: hitShown && k === hitKey,
            text: randomCellText(params, row, count, dSlice, run, upTo, { shares, visits }),
          };
        }}
      />

      <PredictionPrompt
        question={
          <>
            With en high {pct(LESSON_RANDOM.pEn)} of cycles, ld {pct(LESSON_RANDOM.pLd)} and d uniform: how often does a {PREDICT_BUDGET}-cycle run after reset reach the bug?
          </>
        }
        options={options}
        resetKey="random"
      >
        {signal}
        <div className="space-y-3" data-testid="random-result">
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))]">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              P(en)
              <select className={selectClass} value={params.pEn} onChange={(e) => setParams((p) => ({ ...p, pEn: Number(e.target.value) }))}>
                {P_EN_CHOICES.map((p) => (
                  <option key={p} value={p}>
                    {pct(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              P(ld)
              <select className={selectClass} value={params.pLd} onChange={(e) => setParams((p) => ({ ...p, pLd: Number(e.target.value) }))}>
                {P_LD_CHOICES.map((p) => (
                  <option key={p} value={p}>
                    {pct(p)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <label htmlFor={seedId}>Seed</label>
              <span className="flex gap-1">
                <input
                  id={seedId}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  onBlur={commitSeed}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitSeed();
                    }
                  }}
                  aria-describedby={`${seedId}-hint`}
                  className={cn(selectClass, "w-full", mono)}
                />
                <button type="button" className={buttonClass} aria-label="Next seed" onClick={() => changeSeed(seed >= 99999 ? 1 : seed + 1)}>
                  Next
                </button>
              </span>
              <span id={`${seedId}-hint`} className="text-[10px]">
                1 to 99999; Enter or leave the field to apply.
              </span>
            </div>
          </div>
          <SegmentedControl
            label="Cycle budget"
            value={String(budget)}
            onChange={(v) => {
              const n = Number(v) as CycleBudget;
              setBudget(n);
              setCursor(n);
            }}
            options={CYCLE_BUDGETS.map((n) => ({ value: String(n), label: `${n.toLocaleString("en-US")} cycles` }))}
          />
          <p className="text-sm text-foreground" data-testid="random-explanation">
            {randomExplanation(params, budget)}
          </p>
          <ProbabilityCurve params={params} budget={budget} />
          <div className={cn(panel, "space-y-2")}>
            <label className="flex items-center gap-2 text-sm">
              Cycle
              <input
                type="range"
                min={0}
                max={budget}
                value={upTo}
                onChange={(e) => setCursor(Number(e.target.value))}
                aria-valuetext={`cycle ${upTo} of ${budget}`}
                className="h-2 min-w-0 flex-1 cursor-pointer accent-violet-500 [@media(pointer:coarse)]:h-10"
              />
              <span className={cn("w-12 text-right text-xs", mono)}>{upTo}</span>
            </label>
            <p className="text-sm text-foreground" data-testid="seeded-run">
              {seededRunText(run, upTo)}
            </p>
            <p className="text-xs text-muted-foreground">One seed is one sample path; the percentages above are the exact share of all seeds.</p>
          </div>
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formal                                                              */
/* ------------------------------------------------------------------ */

function FormalTab({ dSlice, initialAssumption }: { dSlice: number | null; initialAssumption: AssumptionId }) {
  const [assumption, setAssumption] = useState<AssumptionId>(initialAssumption);
  const { revealed, signal } = useRevealGate(assumption);
  const result = formalCheck(assumption, dSlice !== null && dSlice !== 0 ? dSlice : 3);
  const excluded = excludedCells(assumption, dSlice);
  const warning = coverWarning(assumption);
  const a = findAssumption(assumption);
  const condition = a.expr ? `under assume property (@(posedge clk) ${a.expr})` : "with no assumption";

  const options: PredictionOption[] = [
    {
      id: "cex",
      label: "A counterexample: the bug is reported",
      correct: result.kind === "counterexample",
      feedback:
        result.kind === "counterexample"
          ? `${result.text}${a.expr ? " An assumption that leaves the bug reachable changes the trace, not the verdict." : " With no assumption, every reachable state is explored."}`
          : `${result.text} The search never sees the bug because the assumption removed it.`,
    },
    {
      id: "proof",
      label: "The proof passes",
      correct: result.kind === "proof",
      feedback: result.kind === "proof" ? `${result.text} A passing proof is only as good as its assumptions.` : `Nothing in this assumption blocks the bug. ${result.text}`,
    },
    {
      id: "inconclusive",
      label: "Inconclusive: the search gives up",
      correct: false,
      feedback: `This model has ${COUNT_VALUES.length} states, so an exhaustive search always finishes. On a large design a real tool can stop with a bounded or inconclusive result; that is tool-dependent.`,
    },
  ];

  const wave = result.kind === "counterexample" ? counterexampleWave(result) : null;
  const markers: CycleMarker[] = wave
    ? [
        { edge: 0, tone: "info", glyph: "R", label: "edge 0: rst is 1" },
        { edge: wave.triggerEdge, tone: "info", label: `edge ${wave.triggerEdge}: count is ${BUG_COUNT} with ld and en both 1 and d ≠ 0` },
        { edge: wave.divergeEdge, tone: "fail", label: `edge ${wave.divergeEdge}: expected and count differ: the check fails` },
      ]
    : [];

  return (
    <div className="space-y-4">
      <SegmentedControl label="Assumption" value={assumption} onChange={setAssumption} options={ASSUMPTIONS.map((x) => ({ value: x.id, label: x.expr ? `assume ${x.expr}` : "no assumption" }))} mono />

      <MethodsGrid
        testId="formal-grid"
        caption={revealed ? "Formal: filled = reachable from reset under the assumption; dashed grey = excluded by it." : `Formal: what does an exhaustive search return ${condition}? Predict first.`}
        summary={gridSummary("formal", dSlice)}
        dSlice={dSlice}
        cell={(row, count) => {
          const k = cellKey(row, count);
          if (!revealed) return { mark: isBugCell(count, row) && dSlice !== 0 ? "✕" : "", fill: 0, text: `${ROW_LABELS[row]} at count ${count}: hidden until you predict.` };
          const ex = excluded.has(k);
          return { mark: ex ? "—" : isBugCell(count, row) && dSlice !== 0 ? "✕" : "", fill: ex ? 0 : 0.6, excluded: ex, text: formalCellText(assumption, row, count, dSlice) };
        }}
      />

      <PredictionPrompt question={<>What does an exhaustive search for the bug return {condition}?</>} options={options} resetKey={assumption}>
        {signal}
        <div className="space-y-3" data-testid="formal-result">
          <p className={cn("text-sm font-semibold", result.kind === "proof" ? "text-amber-800 dark:text-amber-200" : "text-rose-700 dark:text-rose-300")}>{result.text}</p>
          {warning ? (
            <p role="note" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              <span aria-hidden="true">⚠ </span>
              <span className={mono}>{warning}</span>
            </p>
          ) : null}
          {wave ? (
            <CycleWaveform
              title="Shortest counterexample"
              caption={`x-axis: rising edges 0 to ${wave.edges - 1} of clk; each value is the one sampled at that edge, so an update made at edge k shows at edge k + 1. expected is the spec (load wins); count is the buggy RTL.`}
              edges={wave.edges}
              signals={wave.signals}
              markers={markers}
              highlights={[{ from: wave.triggerEdge, to: wave.divergeEdge, tone: "fail", label: "the bug" }]}
              cycleWidth={42}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            Exhaustive reachability over this {COUNT_VALUES.length}-state model, not a tool run; bounded or inconclusive results on real designs are tool-dependent. IEEE 1800-2023 §16.2: assume specifies an assumption for the environment, which formal tools use to generate input
            stimulus; cover monitors a property for coverage.
          </p>
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const TAB_LABELS: Record<VerificationMethodsTab, string> = { directed: "Directed", random: "Random", formal: "Formal" };

export default function VerificationMethodsExplorer({ preset = "f1b-methods", initialTab }: VerificationMethodsExplorerProps) {
  const config = VERIFICATION_METHODS_PRESETS[preset] ?? VERIFICATION_METHODS_PRESETS["f1b-methods"];
  const [tab, setTab] = useState<VerificationMethodsTab>(initialTab ?? config.tab);
  const [dSlice, setDSlice] = useState<number | null>(null);
  // Nothing here animates on its own; the hook keeps motion-reduce users on instant state changes.
  const reduced = usePrefersReducedMotion();

  return (
    <VisualFrame
      label="Verification methods explorer"
      eyebrow="Experiment"
      title="Directed, random and formal on one bug"
      summary={
        <>
          One {COUNT_VALUES.length} × {ROWS.length} grid: count 0 to {COUNT_VALUES.length - 1} across; hold, increment, load and load + increment down. The bug lives in one cell: count {BUG_COUNT}, ld and en together, d ≠ 0.
        </>
      }
      fidelity="model"
      assumptions={[...METHODS_ASSUMPTIONS]}
      className={cn(touch, reduced && "[&_*]:!transition-none")}
    >
      <SegmentedControl label="Method" value={tab} onChange={setTab} options={(Object.keys(TAB_LABELS) as VerificationMethodsTab[]).map((t) => ({ value: t, label: TAB_LABELS[t] }))} />
      <DSliceControl value={dSlice} onChange={setDSlice} tab={tab} />
      <div hidden={tab !== "directed"}>
        <DirectedTab dSlice={dSlice} />
      </div>
      <div hidden={tab !== "random"}>
        <RandomTab dSlice={dSlice} />
      </div>
      <div hidden={tab !== "formal"}>
        <FormalTab dSlice={dSlice} initialAssumption={config.assumption} />
      </div>
    </VisualFrame>
  );
}
