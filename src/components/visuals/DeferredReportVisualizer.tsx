"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { OutcomeGroups, type OutcomeGroup } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback, usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { ownerStyles } from "@/components/visual-system/visual-language";
import {
  ASSERT_FORM_LABELS,
  DEFERRED_ASSUMPTIONS,
  DEFERRED_PRESETS,
  STRIP_LABELS,
  STRIP_SHORT_LABELS,
  STRIP_STAGES,
  buildDeferredScenario,
  buildPrediction,
  countLines,
  countText,
  exploreDeferred,
  findPresetMeta,
  reportCount,
  richestRun,
  runSummary,
  valueText,
  type DeferredPresetId,
  type DeferredRun,
  type DeferredScenario,
  type ReportStep,
  type StripStage,
  type TicketStatus,
  type TicketView,
} from "@/lib/sv-deferred-report-model";
import { slotTimeLabel } from "@/lib/sv-scheduler-model";
import { cn } from "@/lib/utils";

export interface DeferredReportVisualizerProps {
  /** The lesson use: one preset per embed. */
  preset?: DeferredPresetId;
  /** Presets offered in the scenario picker. Default: the presets of the same lesson as `preset`. Pass one id to hide the picker. */
  presets?: DeferredPresetId[];
  className?: string;
}

const TICKET_STYLES: Record<TicketStatus, { glyph: string; word: string; className: string }> = {
  queued: { glyph: "＋", word: "queued", className: "border-dashed border-amber-500/80 bg-amber-500/10 text-amber-900 dark:text-amber-100" },
  pending: { glyph: "⏳", word: "pending", className: "border-amber-500/70 bg-amber-500/10 text-amber-900 dark:text-amber-100" },
  flushed: { glyph: "✕", word: "flushed", className: "border-slate-400/70 bg-slate-500/10 text-slate-700 line-through decoration-2 dark:text-slate-300" },
  killed: { glyph: "✕", word: "flushed by Kill", className: "border-rose-500/70 bg-rose-500/10 text-rose-800 line-through decoration-2 dark:text-rose-200" },
  matured: { glyph: "✓", word: "matured", className: "border-2 border-emerald-600/80 bg-emerald-500/15 font-semibold text-emerald-900 dark:text-emerald-100" },
  maybe: { glyph: "?", word: "may still mature", className: "border-dotted border-2 border-amber-500/80 bg-amber-500/10 text-amber-900 dark:text-amber-100" },
  blocked: { glyph: "⊘", word: "not queued", className: "border-dashed border-slate-400/70 text-slate-600 dark:text-slate-300" },
};

/** The testbench variant the toggle selects: a program's initial writes a with = (Reactive, §24.3.1) instead of a module's a <= 1'b1. */
const REACTIVE_TOGGLE_LABEL = "Program writes a (Reactive) instead of <=";

const ASSERTION_FOCI = ["a1", "a2", "a3"] as const;
const FORM_SHORT = { immediate: "immediate", observed: "#0", final: "final" } as const;
type AssertionFocus = (typeof ASSERTION_FOCI)[number];

function TicketChip({ ticket, reduced }: { ticket: TicketView; reduced: boolean }) {
  const style = TICKET_STYLES[ticket.status];
  return (
    <li
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-1.5 rounded-md border px-2 py-1 text-xs [font-variant-ligatures:none]",
        !reduced && "transition-colors duration-300",
        style.className,
      )}
      data-status={ticket.status}
    >
      <span aria-hidden className="font-bold">
        {style.glyph}
      </span>
      <span className="font-mono">{ticket.label}</span>
      <span className="sr-only">, </span>
      <span className="opacity-80">{ticket.detail}</span>
      <span className="sr-only">: </span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider no-underline">{style.word}</span>
    </li>
  );
}

function RegionStrip({ stage, reported }: { stage: StripStage | null; reported: Set<StripStage> }) {
  return (
    <ol aria-label="Regions of the time slot" className="grid grid-cols-5 gap-1">
      {STRIP_STAGES.map((s) => {
        const current = s === stage;
        return (
          <li
            key={s}
            aria-current={current ? "step" : undefined}
            className={cn(
              "min-w-0 rounded-md border px-1 py-1.5 text-center text-[10px] sm:text-xs",
              s === "postponed" ? "border-dashed" : "",
              current ? "border-2 border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground",
            )}
          >
            <span className="block truncate" title={STRIP_LABELS[s]}>
              {/* The border and aria-current mark the current region; the glyph is extra room only from sm up. */}
              {current ? (
                <span aria-hidden className="hidden sm:inline">
                  ▶{" "}
                </span>
              ) : null}
              <span aria-hidden className="sm:hidden">
                {STRIP_SHORT_LABELS[s]}
              </span>
              <span className="sr-only sm:not-sr-only">{STRIP_LABELS[s]}</span>
            </span>
            {reported.has(s) ? (
              <span className="block text-[10px] text-rose-700 dark:text-rose-300">
                <span aria-hidden>✉ </span>report
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Lanes({ scenario, step, reduced }: { scenario: DeferredScenario; step: ReportStep; reduced: boolean }) {
  return (
    <ul aria-label="Processes and their pending-report trays" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
      {scenario.procedures.map((proc) => {
        const running = step.procedureId === proc.id;
        const tray = step.trays[proc.id] ?? [];
        const owner = ownerStyles[proc.owner];
        const hasChecks = proc.schedulerIds.some((id) => scenario.scheduler.processes.find((p) => p.id === id)?.body.some((s) => s.kind === "check"));
        return (
          <li
            key={proc.id}
            data-procedure={proc.id}
            className={cn("min-w-0 rounded-lg border bg-background/50 p-2", running ? "border-2 border-cyan-500" : "border-border/70")}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("border px-1 text-[9px] font-bold leading-4", owner.className)}>{owner.tag}</span>
              <span className="font-mono text-sm font-semibold text-foreground">{proc.label}</span>
              {running ? (
                <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                  <span aria-hidden>▶ </span>
                  <span className="sr-only">, </span>running now
                </span>
              ) : null}
            </div>
            {hasChecks ? (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending reports</p>
                {tray.length ? (
                  <ul className="mt-1 space-y-1" aria-label={`${proc.label}'s report queue`}>
                    {tray.map((t) => (
                      <TicketChip key={t.id} ticket={t} reduced={reduced} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 rounded-md border border-dashed border-border/70 px-2 py-1 text-xs text-muted-foreground">empty</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No checks: no report queue to show.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Stepper({ scenario, run, onStep }: { scenario: DeferredScenario; run: DeferredRun; onStep: (step: ReportStep) => void }) {
  const reduced = usePrefersReducedMotion();
  const playback = usePlayback(run.steps.length, run);
  const step = run.steps[Math.min(playback.index, run.steps.length - 1)];
  useEffect(() => onStep(step), [onStep, step]);
  const reported = new Set(step.reports.map((r) => r.stage));
  const changed = (name: string) => {
    const prev = run.steps[step.index - 1];
    return Boolean(prev) && prev.values[name] !== step.values[name];
  };
  const shownReports = step.reports;

  return (
    <div className="space-y-3">
      <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Step" describeStep={(i) => run.steps[i]?.text ?? ""} />
      <RegionStrip stage={step.stage} reported={reported} />
      <p aria-live="polite" data-testid="deferred-narration" className="min-h-[3rem] rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
        {step.text}
        {step.clauses.length ? <span className="ml-1 text-xs text-muted-foreground">[{step.clauses.join(", ")}]</span> : null}
      </p>
      <div role="group" aria-label="Values now" className="flex flex-wrap gap-1.5">
        {scenario.watch.map((name) => (
          <ValueChip key={name} name={name} value={valueText(scenario, name, step.values[name])} changed={changed(name)} />
        ))}
      </div>
      <Lanes scenario={scenario} step={step} reduced={reduced} />
      <div className="rounded-lg border border-border/70 bg-background/50 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Printed so far</p>
        {shownReports.length ? (
          <ul aria-label="Reports printed so far" className="mt-1 space-y-1 font-mono text-xs [font-variant-ligatures:none]">
            {shownReports.map((r) => (
              <li key={r.id} className={cn("break-words", r.certain ? "text-rose-800 dark:text-rose-200" : "text-amber-800 dark:text-amber-200")}>
                <span aria-hidden>{r.certain ? "✉ " : "? "}</span>
                {r.certain ? null : <span className="sr-only">possibly: </span>}
                [{STRIP_LABELS[r.stage]}] {r.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Nothing printed yet.</p>
        )}
      </div>
    </div>
  );
}

/** Mounted only inside the revealed part of a prompt, so the parent knows when the answer is on screen. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

export default function DeferredReportVisualizer({ preset = "reset-nba-flush", presets, className }: DeferredReportVisualizerProps) {
  const lesson = findPresetMeta(preset).lesson;
  const offered = presets ?? DEFERRED_PRESETS.filter((p) => p.lesson === lesson).map((p) => p.id);
  const [presetId, setPresetId] = useState<DeferredPresetId>(preset);
  const [controlType, setControlType] = useState<4 | 5>(4);
  const [reactive, setReactive] = useState(false);
  const [focus, setFocus] = useState<AssertionFocus>("a2");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [order, setOrder] = useState<string | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [current, setCurrent] = useState<ReportStep | null>(null);
  const onReveal = useCallback((v: boolean) => setRevealed(v), []);
  const onStep = useCallback((s: ReportStep) => setCurrent(s), []);

  const meta = findPresetMeta(presetId);
  const scenario = useMemo(() => buildDeferredScenario(presetId, { controlType, reactiveWritesA: reactive }), [presetId, controlType, reactive]);
  const exploration = useMemo(() => exploreDeferred(scenario), [scenario]);
  const isForms = presetId === "assert-forms-glitch";
  const focusId = isForms ? focus : undefined;
  const prediction = useMemo(() => buildPrediction(scenario, exploration, focusId), [scenario, exploration, focusId]);
  const resetKey = `${presetId}|${controlType}|${reactive}|${focusId ?? ""}`;

  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setSelected(undefined);
    setOrder(undefined);
    setCurrent(null);
  }

  const outcome = exploration.outcomes.find((o) => o.id === selected) ?? exploration.outcomes[0];
  const orderKey = (r: DeferredRun) => r.choices.join(",") || "only";
  const run = outcome.runs.find((r) => orderKey(r) === order) ?? richestRun(outcome.runs, focusId);
  const noun = focusId ? "failure report" : "violation report";

  const groups: OutcomeGroup[] = exploration.outcomes.map((o) => {
    const r = richestRun(o.runs, focusId);
    const lines = isForms ? countLines(scenario, r).map((l) => ({ text: l.text })) : r.reports.length ? r.reports.map((rep) => ({ text: `${rep.certain ? "" : "may print: "}${rep.text}` })) : [{ text: "No report printed" }];
    return {
      id: o.id,
      title: countText(reportCount(scenario, r, focusId), noun),
      runCount: o.runs.length,
      lines: [...lines, { text: `Order: ${r.picks.join("; ") || "only one order"}` }],
    };
  });

  const codeLines: CodeTraceLine[] = scenario.source.map((l) => ({ text: l.text, key: l.key, owner: l.owner }));
  const activeProc = current && revealed ? scenario.procedures.find((p) => p.id === current.procedureId) : undefined;

  const options: PredictionOption[] = prediction.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }));
  const eyebrow = lesson === "F2C" ? "F3B preview · Deferred reports" : "Experiment · Deferred reports";

  return (
    <VisualFrame
      label="Deferred report visualizer: when a violation or assertion report is printed"
      eyebrow={eyebrow}
      title={scenario.title}
      summary={meta.summary}
      fidelity="model"
      assumptions={[...DEFERRED_ASSUMPTIONS, ...scenario.notes]}
      className={className}
    >
      {offered.length > 1 ? (
        <SegmentedControl
          label="Scenario"
          value={presetId}
          onChange={(v) => setPresetId(v)}
          options={offered.map((id) => ({ value: id, label: findPresetMeta(id).label }))}
        />
      ) : null}

      {presetId === "assertcontrol-race" ? (
        <SegmentedControl
          label="control_type of the $assertcontrol call"
          mono
          value={String(controlType) as "4" | "5"}
          onChange={(v) => setControlType(v === "5" ? 5 : 4)}
          options={[
            { value: "4", label: "4 · Off" },
            { value: "5", label: "5 · Kill" },
          ]}
        />
      ) : null}

      {isForms ? (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Assertion to predict"
            mono
            value={focus}
            onChange={(v) => setFocus(v)}
            options={ASSERTION_FOCI.map((id) => {
              const check = scenario.checks[id];
              const form = check.kind === "assertion" ? check.form : "immediate";
              return { value: id, label: `${id} · ${FORM_SHORT[form]}`, ariaLabel: `${id}: ${ASSERT_FORM_LABELS[form]}` };
            })}
          />
          <button
            type="button"
            aria-pressed={reactive}
            onClick={() => setReactive((r) => !r)}
            className={cn(
              "min-h-9 rounded-full border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              reactive ? "border-violet-500 bg-violet-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
          >
            <span aria-hidden>{reactive ? "☑" : "☐"} </span>
            {REACTIVE_TOGGLE_LABEL}
          </button>
        </div>
      ) : null}

      <CodeTrace
        label={`Source · time slot ${slotTimeLabel(scenario.scheduler)}`}
        lines={codeLines}
        activeKey={revealed ? current?.lineKey : undefined}
        contextKeys={activeProc?.lineKeys ?? []}
      />

      <PredictionPrompt question={prediction.question} options={options} resetKey={resetKey}>
        <RevealSignal onChange={onReveal} />
        <div className="space-y-4">
          {exploration.outcomes.length > 1 ? <p className="text-sm text-muted-foreground">Choose an outcome below to step through one of its orders.</p> : null}
          {outcome.runs.length > 1 ? (
            <SegmentedControl
              label="Order to step through"
              value={orderKey(run)}
              onChange={(v) => setOrder(v)}
              options={outcome.runs.map((r) => ({ value: orderKey(r), label: r.picks.join("; ") }))}
            />
          ) : null}
          <Stepper key={`${resetKey}|${outcome.id}|${orderKey(run)}`} scenario={scenario} run={run} onStep={onStep} />
          <p className="text-sm text-muted-foreground" data-testid="deferred-run-summary">
            {runSummary(scenario, run, focusId)}
          </p>
          <OutcomeGroups
            groups={groups}
            runCount={exploration.runCount}
            capped={exploration.capped}
            onSelect={(id) => {
              setSelected(id);
              setOrder(undefined);
            }}
            selectedId={outcome.id}
            label="Outcomes across the orders the model ran"
          />
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
