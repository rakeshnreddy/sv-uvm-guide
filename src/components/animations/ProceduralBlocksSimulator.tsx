"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { OutcomeGroups, type OutcomeGroup, type OutcomeLine } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { PROCESS_MODEL_ASSUMPTIONS, ProcessLanes, ProcessLog, ProcessTraceView, ThreadTable, linesFor } from "@/components/visuals/ForkJoinVisualizer";
import {
  alignedOutcomeRuns,
  divergenceFromBase,
  exploreProcessOrders,
  formatVarValue,
  prepareScenario,
  settledHistory,
  simulateProcesses,
  startOrder,
  stepNarrationBadges,
  type InitializerRule,
  type PreparedScenario,
  type ProcessExploration,
  type ProcessScenario,
  type SimOutcome,
  type SimResult,
  type ThreadState,
  type TraceStep,
  type VarDecl,
} from "@/lib/sv-process-model";
import { cn } from "@/lib/utils";

import {
  describeHistory,
  getProceduralScenario,
  getTimeZeroScenario,
  initialVariantOf,
  isTimeZeroScenario,
  outcomeTitle,
  pickerScenarios,
  scenarioLabel,
  TIMELINE_X0,
  TIMELINE_X1,
  timelineLayout,
  timeZeroExploreOptions,
  type AssignStyle,
  type ProceduralScenarioId,
  type TimeZeroConfig,
  type TimeZeroPreset,
  type TimeZeroVariant,
} from "./procedural-blocks-data";

interface ProceduralBlocksSimulatorProps {
  /** Program shown first. Defaults to the first program in the picker. */
  scenario?: ProceduralScenarioId;
  /**
   * Restricts the program picker to these programs, in this order. One program hides the picker.
   * Omitted: the four single-run programs (or only `scenario` when it is a time-zero program).
   */
  scenarios?: ProceduralScenarioId[];
  /** Variant of the first time-zero program to start on, e.g. "inputs-static" for comb-vs-star. */
  initialVariant?: string;
}

/**
 * initial, always and final procedures over simulation time, run on the
 * process model. The code is generated from the model data and is read-only:
 * learners change behaviour through the explicit controls, not by editing.
 * Time-zero programs are graded on every order of the ready processes.
 */
const ProceduralBlocksSimulator = ({ scenario: requested, scenarios, initialVariant }: ProceduralBlocksSimulatorProps) => {
  const list = useMemo(() => pickerScenarios(requested, scenarios), [requested, scenarios]);
  const first = requested && list.includes(requested) ? requested : list[0];
  const [scenarioId, setScenarioId] = useState<ProceduralScenarioId>(first);
  const timeZero = isTimeZeroScenario(scenarioId);
  const preset = timeZero ? getTimeZeroScenario(scenarioId) : undefined;

  return (
    <VisualFrame
      label="Procedural blocks simulator"
      eyebrow={timeZero ? "Time zero" : "Procedures over time"}
      title={timeZero ? "Who is already waiting when the first change happens?" : "initial, always and final across simulation time"}
      summary={
        timeZero
          ? "Choose a form inside the code, predict, then run every order. The standard starts procedures in no defined order (§9.2), so the model runs every order of the ready processes."
          : "Pick a program, predict its output, then step through it. Lanes show each procedure over simulation time; the region badge shows where in a time step each update lands."
      }
      fidelity="model"
      assumptions={[
        ...PROCESS_MODEL_ASSUMPTIONS,
        "Within one time step the model shows the Active, NBA and Postponed regions only; F3C's ladder covers all regions.",
        ...(preset
          ? [
              "Declaration initializers are set before any procedure starts (§6.8). That this produces no event is derived from §6.8: no procedure exists yet to see it.",
              ...preset.assumptions,
            ]
          : []),
      ]}
    >
      {list.length > 1 ? (
        <SegmentedControl label="Program" value={scenarioId} onChange={setScenarioId} options={list.map((id) => ({ value: id, label: scenarioLabel(id) }))} />
      ) : null}
      {preset ? (
        <TimeZeroLab key={preset.id} preset={preset} initialVariant={preset.id === first ? initialVariant : undefined} />
      ) : (
        <SingleRunLab key={scenarioId} scenarioId={scenarioId} />
      )}
    </VisualFrame>
  );
};

export default ProceduralBlocksSimulator;

/* ========================================================================= */
/* Single-run programs (procedures, nba-swap, fork-timing, edge-vs-level).   */
/* ========================================================================= */

function SingleRunLab({ scenarioId }: { scenarioId: ProceduralScenarioId }) {
  const [style, setStyle] = useState<AssignStyle>("nba");
  const preset = getProceduralScenario(scenarioId);
  const scenario = useMemo(() => preset.build(style), [preset, style]);
  const prepared = useMemo(() => prepareScenario(scenario), [scenario]);
  const result = useMemo(() => simulateProcesses(scenario), [scenario]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const resetKey = `${scenarioId}:${preset.styleToggle ? style : ""}`;

  return (
    <>
      <p className="text-sm text-muted-foreground">{preset.summary}</p>
      {preset.styleToggle ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assignments</span>
          <SegmentedControl
            label="Assignment style"
            mono
            value={style}
            onChange={setStyle}
            options={[
              { value: "nba", label: "a <= b; b <= a;", ariaLabel: "Nonblocking assignments" },
              { value: "blocking", label: "a = b; b = a;", ariaLabel: "Blocking assignments" },
            ]}
          />
        </div>
      ) : null}
      <CodeTrace label="Code (read-only, generated from the model)" lines={lines} />
      <PredictionPrompt
        resetKey={resetKey}
        question={preset.question}
        options={preset.options.map((o) => ({ id: o.id, label: o.label, correct: o.matches(result), feedback: o.feedback(style) }))}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>What to notice: </strong>
            {preset.notice}
          </p>
          <ProcessTraceView prepared={prepared} result={result} resetKey={resetKey} watch={scenario.vars?.map((d) => d.name)} />
        </div>
      </PredictionPrompt>
    </>
  );
}

/* ========================================================================= */
/* Time-zero programs: predict, then run every order of the ready processes. */
/* ========================================================================= */

/**
 * The model runs every order of the ready processes, each until it blocks or
 * ends; it does not interleave (§4.7 also allows that). So the texts never say
 * "every legal order" (see OutcomeGroups' "region-order" contract).
 */
const RUN_ORDERS_LABEL = "Run every order of the ready processes";

/**
 * For the CodeTrace that carries a CodeLineChoice: below sm the line holding the
 * radio group wraps, and the control's cell takes a full row under the code text,
 * indented past the line-number and owner gutters (w-7 + gap-2 + w-8 + gap-2 = 4.75rem).
 * At sm and up the control stays at the end of its line.
 */
const CODE_LINE_CHOICE_STACK =
  "max-sm:[&_li:has([role=radiogroup])]:flex-wrap max-sm:[&_li>span:has(>[role=radiogroup])]:ml-0 max-sm:[&_li>span:has(>[role=radiogroup])]:basis-full max-sm:[&_li>span:has(>[role=radiogroup])]:pl-[4.75rem]";

function TimeZeroLab({ preset, initialVariant }: { preset: TimeZeroPreset; initialVariant?: string }) {
  const [variant, setVariant] = useState(() => initialVariantOf(preset, initialVariant));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  // Set when the learner picks a variant inside the code line. The control can move to another
  // line (time0-reset's initializer form sits on the declaration), so the newly mounted control
  // takes focus back instead of leaving it on <body> (WCAG 2.4.3).
  const refocusVariant = useRef(false);
  const cfg = useMemo<TimeZeroConfig>(() => ({ variant, advanced }), [variant, advanced]);
  const scenario = useMemo(() => preset.build(cfg), [preset, cfg]);
  const prepared = useMemo(() => prepareScenario(scenario), [scenario]);
  const exploration = useMemo(() => exploreProcessOrders(scenario, timeZeroExploreOptions(preset)), [scenario, preset]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const controlKey = preset.variantLineKey(cfg);
  const current = preset.variants.find((o) => o.value === variant) ?? preset.variants[0];
  const resetKey = `${preset.id}:${variant}:${advanced ? "advanced" : "basic"}`;

  return (
    <>
      <p className="text-sm text-muted-foreground">{preset.summary}</p>
      <div className="space-y-2">
        <CodeTrace
          label="Code (read-only, generated from the model) · the choice sits in the code line"
          className={CODE_LINE_CHOICE_STACK}
          lines={lines}
          renderLineControl={(line) =>
            line.key === controlKey ? (
              <CodeLineChoice label={preset.variantLabel} options={preset.variants} value={variant} onChange={setVariant} refocus={refocusVariant} />
            ) : null
          }
        />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{preset.variantLabel}: </strong>
          {current.description}
          {advanced && preset.advanced ? ` · ${preset.advanced.on}` : ""}
        </p>
      </div>
      {preset.advanced ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setAdvancedOpen((open) => !open);
              if (advancedOpen) setAdvanced(false);
            }}
            aria-expanded={advancedOpen}
            className="min-h-10 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {advancedOpen ? "Hide advanced" : preset.advanced.label}
          </button>
          {advancedOpen ? (
            <div className="mt-2 rounded-xl border border-border/70 p-3">
              <SegmentedControl
                label="Where a gets its first value"
                mono
                value={advanced ? "on" : "off"}
                onChange={(value) => setAdvanced(value === "on")}
                options={[
                  { value: "off", label: "logic a = 1'b1;", ariaLabel: preset.advanced.off },
                  { value: "on", label: "initial a = 1'b1;", ariaLabel: preset.advanced.on },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">{advanced ? preset.advanced.on : preset.advanced.off}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <TimeZeroRun key={resetKey} preset={preset} cfg={cfg} scenario={scenario} prepared={prepared} exploration={exploration} resetKey={resetKey} />
    </>
  );
}

/** Prediction, verdict, outcome groups and the step-through, for one configuration. */
function TimeZeroRun({
  preset,
  cfg,
  scenario,
  prepared,
  exploration,
  resetKey,
}: {
  preset: TimeZeroPreset;
  cfg: TimeZeroConfig;
  /** The scenario as built (re-runs must use this object so their line keys match `prepared`). */
  scenario: ProcessScenario;
  prepared: PreparedScenario;
  exploration: ProcessExploration;
  resetKey: string;
}) {
  const [showGroups, setShowGroups] = useState(false);
  const [selected, setSelected] = useState(0);
  const aligned = useMemo(() => alignedOutcomeRuns(scenario, exploration), [scenario, exploration]);
  // Per card: where its run leaves the base run (outcome 1). One shared index is right only for two outcomes.
  const divergence = useMemo(() => divergenceFromBase(aligned), [aligned]);
  const decls = useMemo(() => new Map((scenario.vars ?? []).map((d) => [d.name, d])), [scenario]);
  const traced = aligned[selected] ?? aligned[0];
  const order = startOrder(traced).join(" → ");
  const tracedName = outcomeTitle(preset, traced, aligned[selected] ? selected : 0).inline;
  const options = preset.options(cfg).map((o) => ({ id: o.id, label: o.label, correct: o.matches(exploration), feedback: o.feedback(cfg) }));

  return (
    <PredictionPrompt resetKey={resetKey} question={preset.question(cfg)} options={options}>
      <div className="space-y-4">
        <Verdict exploration={exploration} />
        <p className="text-sm text-foreground">
          <strong>What to notice: </strong>
          {preset.notice(cfg)}
        </p>
        <div>
          <button
            type="button"
            onClick={() => setShowGroups((open) => !open)}
            aria-expanded={showGroups}
            className="inline-flex min-h-10 items-center rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            {showGroups ? "Hide the orders" : RUN_ORDERS_LABEL}
          </button>
        </div>
        {showGroups ? (
          <LegalOrderGroups preset={preset} exploration={exploration} runs={aligned} divergence={divergence} decls={decls} selected={selected} onSelect={setSelected} />
        ) : null}
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {exploration.runCount === 1
            ? `Stepping through the only possible order: ${order}.`
            : showGroups || selected > 0
              ? `Stepping through ${tracedName}: ${order} start in that order.`
              : `Stepping through the model's default order (ready procedures run in code order): ${order}. ${RUN_ORDERS_LABEL} to see the others.`}
        </p>
        <TimeZeroTrace key={`${resetKey}:${selected}`} prepared={prepared} result={traced} decls={decls} initializerRule={scenario.initializerRule} />
      </div>
    </PredictionPrompt>
  );
}

/** The verdict line above the outcome groups, scoped to what the model ran. */
function verdictText(exploration: Pick<ProcessExploration, "outcomes" | "runCount" | "deterministic" | "capped">): string {
  const count = exploration.outcomes.length;
  const runs = exploration.runCount;
  if (exploration.capped) return `Stopped after ${runs} order${runs === 1 ? "" : "s"} (a model cap): ${count} different outcome${count === 1 ? "" : "s"} so far.`;
  if (runs === 1) return "Only one order is possible: no two processes are ever ready at the same time, so there is no scheduler choice.";
  if (exploration.deterministic) return `Same outcome in all ${runs} orders of the ready processes the model ran.`;
  return `Race: ${count} different outcomes across ${runs} orders of the ready processes.`;
}

function Verdict({ exploration }: { exploration: ProcessExploration }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium",
        exploration.deterministic
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
      )}
    >
      <span aria-hidden>{exploration.deterministic ? "✓ " : "⚠ "}</span>
      {verdictText(exploration)}
    </p>
  );
}

/* ------------------------------------------------------------------------- */
/* Outcome groups, each drawn from the step where its run leaves the base run. */
/* ------------------------------------------------------------------------- */

function LegalOrderGroups({
  preset,
  exploration,
  runs,
  divergence,
  decls,
  selected,
  onSelect,
}: {
  preset: TimeZeroPreset;
  exploration: ProcessExploration;
  runs: SimResult[];
  /** Per run, the trace index where it leaves the base run (`divergenceFromBase`). */
  divergence: number[];
  decls: Map<string, VarDecl>;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const multi = exploration.outcomes.length > 1;
  const groups: OutcomeGroup[] = exploration.outcomes.map((group, i) => {
    const run = runs[i] ?? group.result;
    const order = startOrder(run).join(" → ");
    const from = divergence[i] ?? 0;
    const at = run.trace[from];
    return {
      id: `outcome-${i + 1}`,
      title: multi
        ? `${outcomeTitle(preset, run, i).title} · start order ${order}`
        : exploration.runCount === 1
          ? `The only possible order: ${order}`
          : `Start order in the model's default run: ${order}`,
      runCount: group.runs.length,
      // Multi: each card starts at the step where its run leaves the base run. Single: the result itself.
      lines: multi ? run.trace.slice(from, from + 4).map((s) => ({ time: `t = ${s.time} ns`, text: s.what })) : resultLines(preset, run, decls),
      endState: outcomeSummary(preset, run, decls),
      badge: multi && at?.choice ? `${at.choice.picked} runs next (of ${at.choice.options.join(", ")})` : undefined,
    };
  });
  const firstSplit = divergence[0] ?? 0;
  const split = runs[0]?.trace[firstSplit];
  const baseName = runs[0] ? outcomeTitle(preset, runs[0], 0).inline : "outcome 1";
  return (
    <div className="space-y-3">
      {multi && split ? (
        <p className="text-sm text-foreground">
          The runs are identical up to step {firstSplit} and {groups.length > 2 ? "first " : ""}split at step {firstSplit + 1}, still at t = {split.time} ns: a scheduler choice the standard leaves open (§9.2, §4.7).
        </p>
      ) : null}
      <OutcomeGroups
        label="Outcome groups"
        groups={groups}
        runCount={exploration.runCount}
        firstDivergentStep={multi ? 0 : undefined}
        capped={exploration.capped}
        onSelect={(id) => onSelect(Math.max(0, groups.findIndex((g) => g.id === id)))}
        selectedId={groups[selected]?.id}
        selectLabel="Step through this order"
        nondeterminism="region-order"
        note={`${preset.orderNote}${
          multi
            ? groups.length > 2
              ? ` Each card starts at the step where its run first differs from ${baseName}'s; ${baseName}'s card starts at the first split.`
              : " Each card starts at the first step where the runs differ."
            : ""
        }`}
      />
      {preset.watch.length ? (
        <div role="group" aria-label="Outcome waveforms" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {exploration.outcomes.map((group, i) => (
            <div key={group.signature} className="min-w-0 rounded-xl border border-border/70 bg-background/50 p-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {multi ? outcomeTitle(preset, runs[i] ?? group.result, i).title : "Every order"}
              </p>
              <ValueTimeline result={runs[i] ?? group.result} names={preset.watch} decls={decls} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** What one outcome looks like: watched values over time, or the lines it prints. */
function outcomeSummary(preset: TimeZeroPreset, run: SimResult, decls: Map<string, VarDecl>): string {
  if (preset.watch.length) return preset.watch.map((name) => describeHistory(run, name, decls.get(name))).join(" · ");
  if (run.log.length === 0) return "prints nothing";
  return `${run.log.length} line${run.log.length === 1 ? "" : "s"}: ${run.log.map((l) => l.text).join(" · ")}`;
}

function resultLines(preset: TimeZeroPreset, run: SimResult, decls: Map<string, VarDecl>): OutcomeLine[] {
  if (preset.watch.length)
    return preset.watch.flatMap((name) => settledHistory(run, name).map((h) => ({ time: `t = ${h.time} ns`, text: `${name} = ${formatVarValue(h.value, decls.get(name))}` })));
  if (run.log.length === 0) return [{ text: "No output." }];
  return run.log.map((l) => ({ time: `t = ${l.time} ns`, text: l.text }));
}

/**
 * Settled values over simulation time, one row per variable (x is hatched).
 * The axis runs past the run's last time step (dashed line), so a value that
 * changes at that step still gets a labelled bar (layout: `timelineLayout`).
 */
function ValueTimeline({ result, names, decls }: { result: SimResult; names: string[]; decls: Map<string, VarDecl> }) {
  const patternId = `x-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const layout = useMemo(() => timelineLayout(result, names, decls), [result, names, decls]);
  const rowH = 26;
  const top = 6;
  const height = top + names.length * rowH + 16;
  const label = names.map((n) => describeHistory(result, n, decls.get(n), { spoken: true })).join("; ");
  return (
    <figure className="min-w-0">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 300 ${height}`} role="img" aria-label={`Over simulation time: ${label}.`} className="w-full min-w-[240px] text-foreground">
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(244,63,94,0.12)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.7)" strokeWidth="2" />
            </pattern>
          </defs>
          {layout.rows.map((row, r) => {
            const y = top + r * rowH;
            return (
              <g key={row.name}>
                <text x={4} y={y + rowH / 2} fontSize={11} fill="currentColor" dominantBaseline="middle" className="font-mono">
                  {row.name}
                </text>
                {row.segments.map((seg, k) => (
                  <g key={k}>
                    <rect
                      x={seg.from}
                      y={y + 4}
                      width={Math.max(2, seg.to - seg.from)}
                      height={rowH - 8}
                      rx={2}
                      fill={seg.unknown ? `url(#${patternId})` : undefined}
                      className={seg.unknown ? "stroke-rose-500/80" : "fill-cyan-500/15 stroke-cyan-600 dark:stroke-cyan-300"}
                      strokeWidth={1}
                    />
                    {seg.labelFits ? (
                      <text x={seg.from + 4} y={y + rowH / 2} fontSize={10} fill="currentColor" dominantBaseline="middle" className="font-mono">
                        {seg.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            );
          })}
          <line x1={layout.endX} x2={layout.endX} y1={top} y2={top + names.length * rowH} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" />
          {layout.ticks.map((t) => (
            <text key={t.time} x={t.x} y={height - 3} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
              {t.time}
            </text>
          ))}
          <line x1={TIMELINE_X0} x2={TIMELINE_X1} y1={height - 13} y2={height - 13} stroke="currentColor" strokeOpacity={0.15} />
        </svg>
      </div>
      <figcaption className="text-[11px] text-muted-foreground">
        Horizontal axis: simulation time (ns), value at the end of each time step. The dashed line is the run&apos;s last time step; each last value is drawn on past it.
        Hatched = unknown (x).
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------- */
/* Step-through of one order.                                                 */
/* ------------------------------------------------------------------------- */

const stateGlyph: Record<ThreadState, string> = { pending: "◌", ready: "●", running: "▶", blocked: "⏸", done: "✓", killed: "✕" };
const alive = (state: ThreadState) => state !== "done" && state !== "killed";

/**
 * One step's narration. The badge texts come from the model's shared
 * `stepNarrationBadges` (kind and region labels, the pre-start step, the
 * horizon and model-assumption badges), so every process-model narrator says
 * the same thing; this adds only the layout.
 */
function StepNarration({ step, outcome, initializerRule }: { step: TraceStep; outcome: SimOutcome; initializerRule?: InitializerRule }) {
  const badges = stepNarrationBadges(step, { outcome, initializerRule });
  return (
    <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-bold uppercase tracking-wider",
            badges.tone === "kill" ? "bg-rose-500/15 text-rose-800 dark:text-rose-200" : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
          )}
        >
          {badges.kind}
        </span>
        <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">{badges.where}</span>
        {badges.choice ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200" title="The standard leaves this order open">
            {badges.choice}
          </span>
        ) : null}
        {badges.assumption ? <span className="rounded border border-dashed border-amber-500/70 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">Model assumption</span> : null}
        <span className="ml-auto font-mono text-muted-foreground">t = {step.time} ns</span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-snug text-foreground [font-variant-ligatures:none]">{step.what}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground [font-variant-ligatures:none]">
        <strong className="text-foreground">Why: </strong>
        {step.why}
      </p>
    </div>
  );
}

function TimeZeroTrace({
  prepared,
  result,
  decls,
  initializerRule,
}: {
  prepared: PreparedScenario;
  result: SimResult;
  decls: Map<string, VarDecl>;
  initializerRule?: InitializerRule;
}) {
  const playback = usePlayback(result.trace.length);
  const index = Math.min(playback.index, result.trace.length - 1);
  const step = result.trace[index];
  const previous = index > 0 ? result.trace[index - 1] : undefined;
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const contextKeys = step.procs.filter((p) => alive(p.state) && p.lineKey).map((p) => p.lineKey as string);
  const horizon = result.outcome.kind === "horizon" ? result.outcome.maxTime : undefined;

  const renderLineControl = (line: CodeTraceLine) => {
    if (!line.key) return null;
    const here = step.procs.filter((p) => alive(p.state) && p.lineKey === line.key);
    if (here.length === 0) return null;
    return (
      <span className="flex flex-wrap justify-end gap-1">
        {here.map((p) => (
          <span
            key={p.pid}
            className={cn(
              "rounded-full border px-1.5 font-sans text-[10px] leading-4",
              p.state === "running" ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-slate-500 text-slate-300",
            )}
          >
            <span aria-hidden>{stateGlyph[p.state]} </span>
            {p.label}
            <span className="sr-only"> is {p.state === "pending" ? "not started" : p.state} here</span>
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <StepNarration step={step} outcome={result.outcome} initializerRule={initializerRule} />
      <PlaybackControls playback={playback} stepCount={result.trace.length} stepNoun="Process step" describeStep={(i) => result.trace[i]?.what ?? ""} />
      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <CodeTrace label="Code under simulation" lines={lines} activeKey={step.lineKey} contextKeys={contextKeys} renderLineControl={renderLineControl} />
        <div className="min-w-0 space-y-3">
          <ThreadTable step={step} lines={lines} />
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Values after this step</p>
            <div className="flex flex-wrap gap-2">
              {[...decls.values()].map((d) => (
                <ValueChip
                  key={d.name}
                  name={d.name}
                  value={formatVarValue(step.vars[d.name], d)}
                  changed={previous !== undefined && previous.vars[d.name] !== step.vars[d.name]}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Booked delay wake-ups</p>
            {step.booked.length === 0 ? (
              <p className="text-xs text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {step.booked.map((b) => (
                  <li key={`${b.pid}-${b.time}`}>
                    <span className="font-mono text-foreground">{b.label}</span> at t = {b.time} ns
                    {horizon !== undefined && b.time > horizon ? " (past the model horizon)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <ProcessLanes result={result} index={index} />
      <ProcessLog step={step} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* A choice that sits inside a line of the (always dark) code panel.          */
/* ------------------------------------------------------------------------- */

/**
 * Radio group with roving tabindex (arrows, Home, End), styled for the dark code panel.
 * A choice can move the control to another code line, which unmounts this one; `refocus`
 * (owned by the parent, so it outlives this instance) makes the control that renders next,
 * here or on the new line, focus its checked radio.
 */
function CodeLineChoice({
  label,
  options,
  value,
  onChange,
  refocus,
}: {
  label: string;
  options: TimeZeroVariant[];
  value: string;
  onChange: (value: string) => void;
  refocus: React.MutableRefObject<boolean>;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    refs.current[current]?.focus();
  });
  const select = (index: number) => {
    const i = (index + options.length) % options.length;
    if (options[i].value === value) {
      refs.current[i]?.focus();
      return;
    }
    refocus.current = true;
    onChange(options[i].value);
  };
  return (
    // Below sm the code panel puts this on its own row under the code text (CODE_LINE_CHOICE_STACK),
    // so the line the learner is changing keeps the full width.
    <span role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap justify-start gap-1 font-sans sm:justify-end">
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.description}
            tabIndex={checked ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(event) => {
              const keys: Record<string, number> = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: options.length - 1 };
              if (!(event.key in keys)) return;
              event.preventDefault();
              select(keys[event.key]);
            }}
            className={cn(
              "min-h-10 rounded-full border px-2.5 font-mono text-[11px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none [font-variant-ligatures:none]",
              checked ? "border-cyan-300 bg-cyan-400/25 font-semibold text-cyan-50" : "border-slate-500 text-slate-300 hover:bg-white/10",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
