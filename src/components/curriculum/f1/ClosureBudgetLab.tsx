"use client";

import React, { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  BUDGET_OPTIONS,
  COMMON_BIN_OPTIONS,
  FOLLOW_ON_LESSON,
  PLAN_GAP_ITEMS,
  RARE_PROBABILITY_OPTIONS,
  axisMax,
  axisTicks,
  binProbabilities,
  chartSummary,
  closureExpectations,
  closureTable,
  expectedCurve,
  formatPercent,
  formatProbability,
  formatSamples,
  getPreset,
  goFurtherText,
  initialLabView,
  labViewReducer,
  lastOutcome,
  predictionOptions,
  predictionQuestion,
  runSteps,
  summarize,
  waiverReasonProblem,
  workbenchConfig,
  workbenchIntro,
  type ActionId,
  type ClosureState,
  type ClosureSummary,
} from "@/lib/closure-budget-model";
import { cn } from "@/lib/utils";

export interface ClosureBudgetLabProps {
  /** Preset id: "f1b-closure-trap" (default) or "standalone". */
  preset?: string;
  className?: string;
}

export const CLOSURE_ASSUMPTIONS = [
  "Coverage is the share of bins covered, as IEEE 1800-2023 §19.11.1 computes it for user-defined bins (covered bins divided by all bins). The curve is the expected value of that share after n samples; the bins are disjoint, so each random sample lands in exactly one bin.",
  "Expected samples to close are the coupon-collector expectation for this model, computed numerically by the shared coverage model from the exact Poissonised integral, to within 0.01 samples of the closed form, and shown rounded to whole samples. A seeded run uses the shared seeded generator, so a seed always gives the same run.",
  "Waivers, live checks as evidence, and measuring against the plan are industry practice from this lesson's trap bullets, not rules of IEEE 1800-2023. How a waived bin counts in a report is a tool and project choice.",
  "The directed run stands for any targeted stimulus aimed at the rare scenario; formal tools can also show such a scenario is reachable. The lab shows no covergroup source: that is taught in I-SV-3A.",
];

const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const pressedClass = "border-cyan-500 bg-cyan-500/15";
const inputClass =
  "h-10 min-w-0 flex-1 rounded-md border border-border/70 bg-background/60 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** The shared primitives size some buttons below 40 px (segments, text links): size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";
/** Waived = striped, never solid: a decision, not coverage. */
const stripes = "bg-[repeating-linear-gradient(135deg,rgb(245_158_11/0.55)_0_4px,transparent_4px_8px)]";

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

const W = 340;
const H = 196;
const M = { left: 36, right: 10, top: 10, bottom: 34 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

function ClosureChart({ state, titleId, descId }: { state: ClosureState; titleId: string; descId: string }) {
  const { config } = state;
  const p = useMemo(() => binProbabilities(config.commonBins, config.rareP), [config.commonBins, config.rareP]);
  const expectations = useMemo(() => closureExpectations(config), [config]);
  const xMax = axisMax(expectations.all, state.samplesUsed);
  const decades = Math.log10(xMax);
  const x = (n: number) => M.left + (Math.log10(Math.max(1, n)) / decades) * PW;
  const y = (c: number) => M.top + (1 - c) * PH;
  const curve = useMemo(() => expectedCurve(p, xMax), [p, xMax]);
  const expectedPath = curve.map((pt, i) => `${i === 0 ? "M" : "L"}${x(pt.n).toFixed(1)} ${y(pt.coverage).toFixed(1)}`).join(" ");
  const steps = runSteps(state);
  const runPath = [`M${x(1).toFixed(1)} ${y(0).toFixed(1)}`]
    .concat(steps.flatMap((s, i) => [`H${x(s.n).toFixed(1)}`, i === steps.length - 1 ? "" : `V${y(s.coverage).toFixed(1)}`]))
    .filter(Boolean)
    .join(" ");
  const finalRun = steps[steps.length - 1];
  const ticks = axisTicks(xMax);
  const closeX = Number.isFinite(expectations.all) ? x(expectations.all) : null;
  const withDirected = summarize(state).coverageOfModel;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} aria-describedby={descId} className="block h-auto w-full max-w-[560px]">
      <title id={titleId}>Expected coverage and the seeded run against random samples, log scale</title>
      {[0, 0.5, 1].map((c) => (
        <g key={c}>
          <line x1={M.left} x2={W - M.right} y1={y(c)} y2={y(c)} stroke="currentColor" strokeOpacity={0.15} />
          <text x={M.left - 4} y={y(c) + 3.5} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.75}>
            {formatPercent(c)}
          </text>
        </g>
      ))}
      {ticks.map((tick) => (
        <g key={tick.n} data-tick={tick.n}>
          <line x1={x(tick.n)} x2={x(tick.n)} y1={M.top + PH} y2={M.top + PH + 4} stroke="currentColor" strokeOpacity={0.5} />
          {tick.label !== null ? (
            <text x={x(tick.n)} y={M.top + PH + 15} fontSize={10} textAnchor={tick.anchor} fill="currentColor" fillOpacity={0.75}>
              {tick.label}
            </text>
          ) : null}
        </g>
      ))}
      <text x={M.left + PW / 2} y={H - 4} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
        random samples (log scale)
      </text>
      {closeX !== null && closeX <= W - M.right ? (
        <g>
          <line x1={closeX} x2={closeX} y1={M.top} y2={M.top + PH} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
          <text x={Math.min(closeX, W - M.right) - 3} y={M.top + PH - 6} fontSize={9.5} textAnchor="end" fill="currentColor">
            {`close ≈ ${formatSamples(expectations.all)}`}
          </text>
        </g>
      ) : null}
      <path d={expectedPath} fill="none" strokeWidth={2.2} className="stroke-cyan-600 dark:stroke-cyan-400" />
      <path d={runPath} fill="none" strokeWidth={1.8} strokeDasharray="5 3" className="stroke-amber-600 dark:stroke-amber-400" />
      {state.directed ? (
        <g>
          <circle cx={x(state.samplesUsed)} cy={y(withDirected)} r={4} className="fill-emerald-600 dark:fill-emerald-400" />
          <text x={x(state.samplesUsed) - 6} y={y(withDirected) + 14} fontSize={9.5} textAnchor="end" fill="currentColor">
            directed
          </text>
        </g>
      ) : (
        <circle cx={x(finalRun.n)} cy={y(finalRun.coverage)} r={3} className="fill-amber-600 dark:fill-amber-400" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bins and bars
// ---------------------------------------------------------------------------

function binText(bin: ClosureSummary["bins"][number]): string {
  if (bin.status === "covered") return `${bin.label}: covered${bin.directed ? " by the directed run" : ` at sample ${formatSamples(bin.firstHit as number)}`}`;
  if (bin.status === "waived") return `${bin.label}: waived, not covered`;
  if (bin.status === "not-in-model") return `${bin.label}: not in the coverage model`;
  return `${bin.label}: hole`;
}

function BinGrid({ summary }: { summary: ClosureSummary }) {
  return (
    <ul aria-label="Bins" className="flex flex-wrap gap-1.5">
      {summary.bins.map((bin) => (
        <li
          key={bin.id}
          title={binText(bin)}
          data-status={bin.status}
          className={cn(
            "flex h-8 min-w-8 items-center justify-center rounded-md border px-1 text-[10px] font-semibold",
            bin.status === "covered" && "border-emerald-600/60 bg-emerald-500/25 text-foreground",
            bin.status === "waived" && cn("border-amber-600/70 text-foreground", stripes),
            bin.status === "hole" && "border-rose-500/70 bg-transparent text-rose-700 dark:text-rose-300",
            bin.status === "not-in-model" && "border-dashed border-slate-500/70 text-muted-foreground",
            bin.kind === "rare" && "ring-1 ring-offset-1 ring-offset-background ring-foreground/40",
          )}
        >
          <span aria-hidden>{bin.kind === "rare" ? "rare" : bin.kind === "plan" ? "plan" : bin.id.slice(1)}</span>
          <span className="sr-only">{binText(bin)}</span>
        </li>
      ))}
    </ul>
  );
}

function Bar({ label, value, waived = 0, text, animate }: { label: string; value: number; waived?: number; text: string; animate: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{text}</span>
      </div>
      <div aria-hidden className="mt-1 flex h-3 w-full overflow-hidden rounded-full border border-border/70 bg-muted/40">
        <div className={cn("h-full bg-emerald-500/80", animate && "transition-[width] duration-500 motion-reduce:transition-none")} style={{ width: `${value * 100}%` }} />
        {waived > 0 ? <div className={cn("h-full", stripes)} style={{ width: `${waived * 100}%` }} /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workbench (shown only after the prediction)
// ---------------------------------------------------------------------------

/**
 * The line under a button. The latest outcome is also in the live region, so
 * this copy is hidden from assistive technology to avoid hearing it twice;
 * earlier outcomes stay readable.
 */
function Consequence({ state, action, id }: { state: ClosureState; action: ActionId; id?: string }) {
  const outcome = lastOutcome(state, action);
  if (!outcome) return null;
  const isLatest = state.log[state.log.length - 1] === outcome;
  return (
    <p id={id} aria-hidden={isLatest || undefined} className={cn("text-xs", outcome.refused ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
      {outcome.text}
    </p>
  );
}

function Workbench({ initial, intro }: { initial: ClosureState["config"]; intro: string | null }) {
  const [view, dispatch] = useReducer(labViewReducer, initial, initialLabView);
  const state = view.lab;
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLInputElement>(null);
  const reduced = usePrefersReducedMotion();
  const baseId = useId();
  const titleId = `${baseId}-chart-title`;
  const descId = `${baseId}-chart-desc`;
  const reasonId = `${baseId}-reason`;
  const waiveMsgId = `${baseId}-waive-msg`;
  const { config } = state;
  const expectations = useMemo(() => closureExpectations(config), [config]);
  const summary = summarize(state);
  const table = closureTable(state);
  const k = config.commonBins + 1;
  const waiveOutcome = lastOutcome(state, "waive");
  const reasonInvalid = waiveOutcome?.field === "reason" && waiverReasonProblem(reason) !== null;
  const latest = state.log[state.log.length - 1];
  const reasonRefusedNow = latest !== undefined && latest.action === "waive" && latest.field === "reason";

  // A waiver refused for its reason sends focus back to the reason field.
  useEffect(() => {
    if (reasonRefusedNow) reasonRef.current?.focus();
  }, [reasonRefusedNow, view.notice.seq]);

  return (
    <div className={cn("space-y-4", touchButtons)}>
      {intro ? <p className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-foreground">{intro}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Common bins</p>
          <SegmentedControl
            label="Common bins"
            value={String(config.commonBins)}
            options={COMMON_BIN_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => dispatch({ type: "configure", config: { commonBins: Number(v) } })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Rare-bin probability</p>
          <SegmentedControl
            label="Rare-bin probability"
            value={String(config.rareP)}
            options={RARE_PROBABILITY_OPTIONS.map((p) => ({ value: String(p), label: formatProbability(p) }))}
            onChange={(v) => dispatch({ type: "configure", config: { rareP: Number(v) } })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Samples per run</p>
          <SegmentedControl
            label="Samples per run"
            value={String(config.budget)}
            options={BUDGET_OPTIONS.map((n) => ({ value: String(n), label: formatSamples(n) }))}
            onChange={(v) => dispatch({ type: "configure", config: { budget: Number(v) } })}
          />
        </div>
      </div>

      <dl className="grid gap-2 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <div className={panel}>
          <dt className="text-xs text-muted-foreground">{`Expected samples to close all ${k} bins`}</dt>
          <dd className="text-lg font-semibold text-foreground">{formatSamples(expectations.all)}</dd>
        </div>
        <div className={panel}>
          <dt className="text-xs text-muted-foreground">{`The ${config.commonBins} common bins only`}</dt>
          <dd className="text-lg font-semibold text-foreground">{formatSamples(expectations.common)}</dd>
        </div>
        <div className={panel}>
          <dt className="text-xs text-muted-foreground">{`The ${formatProbability(config.rareP)} bin alone (1/p)`}</dt>
          <dd className="text-lg font-semibold text-foreground">{formatSamples(expectations.rare)}</dd>
        </div>
      </dl>

      <figure className={cn(panel, "space-y-2")}>
        <ClosureChart state={state} titleId={titleId} descId={descId} />
        <figcaption className="space-y-1 text-xs text-muted-foreground">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <span aria-hidden className="mr-1 inline-block h-0.5 w-5 align-middle bg-cyan-600 dark:bg-cyan-400" />
              expected coverage
            </span>
            <span>
              <span aria-hidden className="mr-1 inline-block w-5 align-middle border-t-2 border-dashed border-amber-600 dark:border-amber-400" />
              {`seeded runs (${state.seedRuns} so far)`}
            </span>
          </span>
          <span id={descId} className="block">
            {chartSummary(state)}
          </span>
        </figcaption>
      </figure>

      <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-left text-xs">
          <caption className="mb-1 text-left text-xs font-semibold text-foreground">The chart as a table</caption>
          <thead>
            <tr className="border-b border-border/70 text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">Samples</th>
              <th scope="col" className="py-1 pr-2 font-medium">Expected coverage</th>
              <th scope="col" className="py-1 font-medium">Seeded runs</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.n} className="border-b border-border/40">
                <th scope="row" className="py-1 pr-2 font-normal">{formatSamples(row.n)}</th>
                <td className="py-1 pr-2">{formatPercent(row.expected)}</td>
                <td className="py-1">{row.run === null ? "not run yet" : formatPercent(row.run)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn(panel, "space-y-3")}>
        <BinGrid summary={summary} />
        <Bar
          label="Coverage"
          value={summary.coverage}
          waived={summary.waived / summary.denominator}
          animate={!reduced}
          text={`${summary.covered} of ${summary.denominator} covered (${formatPercent(summary.coverage)})${summary.waived ? `, ${summary.waived} waived` : ""}`}
        />
        <Bar label="Evidence (covered while checks were live)" value={summary.evidence} animate={!reduced} text={`${summary.evidenceBins} of ${summary.denominator} (${formatPercent(summary.evidence)})`} />
        <p className="text-xs text-muted-foreground">
          Key: solid = covered, striped = waived (not covered), red outline = hole, dashed = a plan item with no coverage item. The ringed bin is the rare one.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Try a closure move</p>
        <div className="space-y-1">
          <button type="button" className={buttonClass} onClick={() => dispatch({ type: "more-seeds" })}>
            {`More seeds (+${formatSamples(config.budget)} random samples)`}
          </button>
          <Consequence state={state} action="more-seeds" />
        </div>
        <div className="space-y-1">
          <button type="button" className={buttonClass} onClick={() => dispatch({ type: "directed" })}>
            Directed test for the rare bin
          </button>
          <Consequence state={state} action="directed" />
        </div>
        <form
          className="space-y-1"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: "waive", reason });
          }}
        >
          <label htmlFor={reasonId} className="block text-xs font-semibold text-foreground">
            Waiver reason
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={reasonRef}
              id={reasonId}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={reasonInvalid || undefined}
              aria-describedby={waiveOutcome ? waiveMsgId : undefined}
              className={inputClass}
              placeholder="Why is this hole acceptable?"
            />
            <button type="submit" className={buttonClass}>
              Waive the hole
            </button>
          </div>
          <Consequence state={state} action="waive" id={waiveMsgId} />
        </form>
        <div className="space-y-1">
          <button
            type="button"
            aria-pressed={state.checksOff}
            className={cn(buttonClass, state.checksOff && pressedClass)}
            onClick={() => dispatch({ type: "checks-off", on: !state.checksOff })}
          >
            Checks were off in these runs
          </button>
          <Consequence state={state} action="checks-off" />
        </div>
        <div className="space-y-1">
          <button
            type="button"
            aria-pressed={state.planGap}
            className={cn(buttonClass, state.planGap && pressedClass)}
            onClick={() => dispatch({ type: "plan-gap", on: !state.planGap })}
          >
            {`The plan has ${PLAN_GAP_ITEMS.length} items the model lacks`}
          </button>
          <Consequence state={state} action="plan-gap" />
        </div>
        <button type="button" className={buttonClass} onClick={() => dispatch({ type: "reset" })}>
          Start over with these settings
        </button>
        <p className="text-xs text-muted-foreground">
          {goFurtherText()}{" "}
          <a href={FOLLOW_ON_LESSON.href} className="font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:inline-block [@media(pointer:coarse)]:py-2">
            {`Open ${FOLLOW_ON_LESSON.id}: ${FOLLOW_ON_LESSON.title}`}
          </a>
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        <span key={view.notice.seq} data-seq={view.notice.seq}>
          {view.notice.text}
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lab
// ---------------------------------------------------------------------------

export default function ClosureBudgetLab({ preset, className }: ClosureBudgetLabProps) {
  const chosen = getPreset(preset);
  const { config } = chosen;
  const options: PredictionOption[] = useMemo(
    () => predictionOptions(config.commonBins, config.rareP).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback })),
    [config.commonBins, config.rareP],
  );

  return (
    <VisualFrame
      label="Closure budget lab"
      eyebrow="Experiment"
      title="Spend a sample budget on coverage closure"
      summary="Predict how long random stimulus takes to close every bin, then try five closure moves and watch what each one does to coverage and to evidence."
      fidelity="model"
      assumptions={CLOSURE_ASSUMPTIONS}
      className={cn(frameClass, className)}
    >
      <PredictionPrompt question={predictionQuestion(config.commonBins, config.rareP)} options={options} resetKey={chosen.id} className={touchButtons}>
        <Workbench key={chosen.id} initial={workbenchConfig(chosen)} intro={workbenchIntro(chosen)} />
      </PredictionPrompt>
    </VisualFrame>
  );
}
