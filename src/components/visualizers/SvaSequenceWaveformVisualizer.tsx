"use client";

import React, { useEffect, useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal, type MarkerTone } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  assertionCode,
  attemptStatusPhrase,
  diagnoseAttempt,
  evaluateSva,
  evaluateSamplingLab,
  findTracePreset,
  flopOutputLowPreset,
  gradeEarlyGrantChallenge,
  gradeSamplingPrediction,
  normalizeModes,
  parseSva,
  regionMarkers,
  renameTracePresets,
  reqGnt2Scenario,
  SAMPLING_ASSUMPTIONS,
  SAMPLING_PRESET_ID,
  plainText,
  scenarioTrace,
  splitInlineCode,
  statusGlyph,
  statusText,
  summarize,
  summarizeSampling,
  type AttemptStatus,
  type BitRow,
  type LogicBit,
  type SamplingEdge,
  type SamplingPrediction,
  type SamplingVerdict,
  type SvaAttempt,
  type SvaLabMode,
  type SvaLessonScenario,
  type SvaSpec,
  type SvaStep,
} from "@/lib/sva-model";
import { cn } from "@/lib/utils";

type Mode = "learn" | "debug" | "custom";

const modeOf: Record<SvaLabMode, Mode> = { learn: "learn", debug: "debug", write: "custom" };

export interface SvaSequenceWaveformVisualizerProps {
  /**
   * Preset to open: an id from `svaLearnScenarios`, `"req-gnt-2"` (F1C preview,
   * shown alone) or `"flop-output-low"` (F3B sampling-and-regions lab).
   */
  initialPreset?: string;
  /** Tabs to show; the others are hidden. Default: all three. */
  modes?: SvaLabMode[];
  /** Rename signals in every preset, e.g. `{ ack: "gnt" }`. */
  signalNames?: Record<string, string>;
}

export const SVA_MODEL_ASSUMPTIONS = [
  "One clock: each column is one posedge clk tick (cycle time, not ns). The value in column k is the value sampled at edge k, its Preponed value (§16.5.1).",
  "Signals are logic: before edge 0 their default sampled value is X, which $rose, $fell and $past see at edge 0 (§16.5.1, §16.9.3).",
  "A new attempt starts at every edge (§16.14.5). Sequences are weak, as in assert property, so an attempt still running when the trace ends is pending, not failed (§16.12.2).",
  "disable iff is checked only at sampling points, using the value shown at that edge. A simulator uses the current value (§16.12), so a reset that changes between edges, or one driven by a flop on an edge, cancels attempts up to one edge earlier.",
  "Subset: Boolean operators, $rose/$fell/$stable/$changed/$past, ##, [*], [->], [=], and/or/intersect/throughout/within, |->, |=>, not. No local variables, multiclock, first_match or liveness operators. Unsupported syntax is reported, never treated as false.",
];

const statusTone: Record<AttemptStatus, MarkerTone> = { PASS: "pass", FAIL: "fail", VACUOUS: "vacuous", PENDING: "pending", DISABLED: "info" };

const statusClass: Record<AttemptStatus, string> = {
  PASS: "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  FAIL: "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  VACUOUS: "border-dashed border-slate-400/70 bg-slate-500/5 text-slate-700 dark:text-slate-300",
  PENDING: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  DISABLED: "border-sky-500/60 bg-sky-500/10 text-sky-800 dark:text-sky-200",
};

const stepGlyph: Record<SvaStep["kind"], string> = { match: "✓", fail: "✕", wait: "…", note: "→" };

const edgeLabel = (s: SvaStep) => (s.toEdge !== undefined && s.toEdge !== s.edge ? `edges ${s.edge}–${s.toEdge}` : `edge ${s.edge}`);

/** Renders model sentences, turning `code` spans into code elements. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, i) =>
        part.code ? (
          <code key={i} className="font-mono text-[0.92em] [font-variant-ligatures:none]">
            {part.text}
          </code>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

function cloneRows(rows: Record<string, BitRow>): Record<string, BitRow> {
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, [...v]]));
}

/**
 * SVA trace lab: a learner-editable cycle trace evaluated by `sva-model`, with
 * per-attempt prediction, diagnostic diff feedback, step-by-step match
 * explanations and four debug cases. With `initialPreset="flop-output-low"` it
 * shows the sampling-and-regions lab instead.
 */
export function SvaSequenceWaveformVisualizer({ initialPreset, modes, signalNames }: SvaSequenceWaveformVisualizerProps = {}) {
  if (initialPreset === SAMPLING_PRESET_ID) return <SvaSamplingLab />;
  return <SvaTraceLab initialPreset={initialPreset} modes={modes} signalNames={signalNames} />;
}

export default SvaSequenceWaveformVisualizer;

function SvaTraceLab({ initialPreset, modes, signalNames }: SvaSequenceWaveformVisualizerProps) {
  const inputId = useId();
  const allowed = useMemo(() => normalizeModes(modes).map((m) => modeOf[m]), [modes]);
  const renameKey = JSON.stringify(signalNames ?? {});
  // One map, checked against every preset at once, so all presets agree on names.
  const renamed = useMemo(() => renameTracePresets(JSON.parse(renameKey) as Record<string, string>), [renameKey]);
  const learnList: SvaLessonScenario[] = useMemo(
    () => (initialPreset === reqGnt2Scenario.id ? [renamed.reqGnt2] : renamed.learn),
    [initialPreset, renamed],
  );
  const debugList = renamed.debug;
  const ignoredRenames = renamed.ignored;
  useEffect(() => {
    if (ignoredRenames.length && process.env.NODE_ENV !== "production") {
      console.warn(`SvaSequenceWaveformVisualizer: signalNames entries ignored: ${ignoredRenames.join(", ")}`);
    }
  }, [ignoredRenames]);
  const [mode, setMode] = useState<Mode>(() => allowed[0]);
  const [learnId, setLearnId] = useState(() => findTracePreset(initialPreset)?.id ?? learnList[0].id);
  const [debugId, setDebugId] = useState(debugList[0].id);
  const [initialScenario] = useState(() => (allowed[0] === "debug" ? debugList[0] : (learnList.find((s) => s.id === learnId) ?? learnList[0])));
  const [signals, setSignals] = useState<string[]>(initialScenario.signals);
  const [rows, setRows] = useState<Record<string, BitRow>>(() => cloneRows(initialScenario.rows));
  const [baseRows, setBaseRows] = useState<Record<string, BitRow>>(() => cloneRows(initialScenario.rows));
  const [draft, setDraft] = useState(initialScenario.property);
  const [customSource, setCustomSource] = useState(initialScenario.property);
  const [showFix, setShowFix] = useState(false);
  const [predictions, setPredictions] = useState<Record<number, AttemptStatus>>({});
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const learn = learnList.find((s) => s.id === learnId) ?? learnList[0];
  const debugCase = debugList.find((c) => c.id === debugId) ?? debugList[0];

  const property = mode === "learn" ? learn.property : mode === "debug" ? (showFix ? debugCase.fixedProperty : debugCase.property) : customSource;
  const trace = useMemo(() => scenarioTrace({ rows }), [rows]);
  const parsed = useMemo(() => parseSva(property, signals), [property, signals]);
  const evaluation = useMemo(() => (parsed.ok ? evaluateSva(parsed.spec, trace) : null), [parsed, trace]);
  const buggyEvaluation = useMemo(() => {
    const p = parseSva(debugCase.property, signals);
    return mode === "debug" && p.ok ? evaluateSva(p.spec, trace) : null;
  }, [debugCase, signals, trace, mode]);

  const resultsVisible = mode === "debug" || revealed;
  const predictionCount = Object.keys(predictions).length;
  const cycle: (AttemptStatus | undefined)[] = [undefined, "PASS", "FAIL", "VACUOUS", "PENDING", ...(parsed.ok && parsed.spec.disable ? (["DISABLED"] as const) : [])];

  const resetRun = () => {
    setPredictions({});
    setRevealed(false);
    setSelected(null);
  };

  const loadRows = (nextSignals: string[], nextRows: Record<string, BitRow>) => {
    setSignals(nextSignals);
    setRows(cloneRows(nextRows));
    setBaseRows(cloneRows(nextRows));
    resetRun();
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "custom") {
      setDraft(property);
      setCustomSource(property);
    } else if (next === "learn") {
      loadRows(learn.signals, learn.rows);
    } else {
      setShowFix(false);
      loadRows(debugCase.signals, debugCase.rows);
    }
    setMode(next);
    resetRun();
  };

  const toggle = (signal: string, edge: number) => {
    setRows((prev) => ({ ...prev, [signal]: prev[signal].map((v, k) => (k === edge ? (v ? 0 : 1) : v)) as BitRow }));
    resetRun();
  };

  const cyclePrediction = (k: number) => {
    setPredictions((prev) => {
      const index = cycle.indexOf(prev[k]);
      const nextStatus = cycle[(index + 1) % cycle.length];
      const next = { ...prev };
      if (nextStatus) next[k] = nextStatus;
      else delete next[k];
      return next;
    });
  };

  const evaluate = () => {
    setRevealed(true);
    if (!evaluation) return;
    const firstWrong = evaluation.attempts.find((a) => predictions[a.start] && predictions[a.start] !== a.status);
    const firstInteresting = evaluation.attempts.find((a) => a.status !== "VACUOUS");
    setSelected((firstWrong ?? firstInteresting ?? evaluation.attempts[0]).start);
  };

  const selectedAttempt: SvaAttempt | null = evaluation && selected !== null ? (evaluation.attempts[selected] ?? null) : null;

  const markers: CycleMarker[] = useMemo(() => {
    if (resultsVisible && evaluation) {
      return evaluation.attempts.map((a) => ({
        edge: a.start,
        tone: statusTone[a.status],
        glyph: statusGlyph[a.status],
        short: a.status === "VACUOUS" ? undefined : a.status === "PENDING" ? "…end" : `→${a.end}`,
        label: `Attempt A${a.start}: ${attemptStatusPhrase(a)}. ${plainText(a.reason)}`,
      }));
    }
    return Object.entries(predictions).map(([k, status]) => ({
      edge: Number(k),
      tone: "info" as const,
      glyph: statusGlyph[status],
      short: "you",
      label: `Your prediction for attempt A${k}: ${statusText[status]}`,
    }));
  }, [resultsVisible, evaluation, predictions]);

  const highlights: CycleHighlight[] = useMemo(() => {
    if (!resultsVisible || !selectedAttempt) return [];
    const a = selectedAttempt;
    const list: CycleHighlight[] = [{ from: a.start, to: Math.max(a.start, a.end), tone: "attempt", label: `Window of attempt A${a.start}` }];
    if (a.status === "FAIL" || a.status === "PASS") list.push({ from: a.end, to: a.end, tone: a.status === "FAIL" ? "fail" : "pass", label: `Decided at edge ${a.end}` });
    return list;
  }, [resultsVisible, selectedAttempt]);

  const waveSignals: CycleSignal[] = [
    { name: "clk", kind: "clock" },
    ...signals.map((name) => ({ name, kind: "bit" as const, values: rows[name], editable: true })),
  ];

  const codeLines = (parsed.ok ? assertionCode(parsed.spec) : [`// does not parse:`, `${property}`]).map((text, i) => ({ text, key: `l${i}` }));
  const correctCount = evaluation ? evaluation.attempts.filter((a) => predictions[a.start] === a.status).length : 0;

  return (
    <VisualFrame
      label="SVA trace lab"
      eyebrow="Experiment"
      title="SVA trace lab: one attempt per clock edge"
      summary={
        <>
          Every edge of <code>clk</code> starts a new attempt of the property. Edit the trace, predict what each attempt reports, then evaluate. Select an attempt to see which edge matched which element.
        </>
      }
      fidelity="model"
      assumptions={SVA_MODEL_ASSUMPTIONS}
    >
      <div data-testid="sva-waveform-visualizer" data-ignored-signal-names={ignoredRenames.length ? ignoredRenames.join(", ") : undefined} className="space-y-4">
        {allowed.length > 1 ? (
          <SegmentedControl<Mode>
            label="Mode"
            value={mode}
            onChange={changeMode}
            options={(
              [
                { value: "learn", label: "Learn: presets" },
                { value: "debug", label: "Debug: spot the bug" },
                { value: "custom", label: "Write your own" },
              ] as const
            ).filter((o) => allowed.includes(o.value))}
          />
        ) : null}

        {mode === "learn" && learnList.length > 1 ? (
          <SegmentedControl<string>
            label="Property preset"
            mono
            value={learnId}
            onChange={(id) => {
              const next = learnList.find((s) => s.id === id);
              if (!next) return;
              setLearnId(id);
              loadRows(next.signals, next.rows);
            }}
            options={learnList.map((s) => ({ value: s.id, label: s.label }))}
          />
        ) : null}

        {mode === "debug" ? (
          <SegmentedControl<string>
            label="Debug case"
            value={debugId}
            onChange={(id) => {
              const next = debugList.find((c) => c.id === id);
              if (!next) return;
              setDebugId(id);
              setShowFix(false);
              loadRows(next.signals, next.rows);
            }}
            options={debugList.map((c) => ({ value: c.id, label: c.label }))}
          />
        ) : null}

        {mode === "custom" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setCustomSource(draft);
              resetRun();
            }}
          >
            <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
              Property (signals in this trace: {signals.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 ? ", " : ""}
                  <code>{s}</code>
                </React.Fragment>
              ))})
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={inputId}
                type="text"
                value={draft}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-10 min-w-0 flex-1 basis-56 rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500/60 bg-cyan-500/15 px-4 text-sm font-semibold text-foreground hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Check property
              </button>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Supported syntax</summary>
              <p className="mt-1 font-mono [font-variant-ligatures:none]">
                {"! && || == != $rose() $fell() $stable() $changed() $past(e,N) ##N ##[m:n] ##[m:$] [*N] [*m:n] [->N] [=N] and or intersect throughout within not |-> |=> disable iff (e)"}
              </p>
            </details>
          </form>
        ) : null}

        {!parsed.ok ? (
          <div role="alert" className="rounded-lg border border-rose-500/60 bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-200">
            <p className="font-semibold">
              ✕ Parse error: <Rich text={parsed.error.message} />
            </p>
            <pre className="mt-2 overflow-x-auto font-mono text-[12.5px] leading-5 [font-variant-ligatures:none]" aria-hidden>
              {`${property}\n${" ".repeat(parsed.error.position)}${"^".repeat(Math.max(1, Math.min(parsed.error.length, property.length - parsed.error.position || 1)))}`}
            </pre>
          </div>
        ) : null}

        {mode === "debug" ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
            <p>
              <strong>Spec:</strong> <Rich text={debugCase.spec} />
            </p>
            {buggyEvaluation ? (
              <p className="font-mono text-[12.5px] text-rose-700 [font-variant-ligatures:none] dark:text-rose-300">
                assertion log, a_check: {summarize(buggyEvaluation)}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <Rich text={debugCase.focus} />
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <CodeTrace label={mode === "debug" && showFix ? "Fixed assertion (generated)" : "Assertion under test (generated)"} lines={codeLines} className="min-w-0" />
          <div className="min-w-0 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Legend: <span aria-hidden>✓</span> pass · <span aria-hidden>✕</span> fail · <span aria-hidden>○</span> vacuous success (not a pass or a failure) · <span aria-hidden>…</span> pending · <span aria-hidden>⊘</span> disabled. The marker sits on the attempt&apos;s start edge; <code>→5</code> means the result is decided at edge 5.
            </p>
            <button
              type="button"
              onClick={() => loadRows(signals, baseRows)}
              className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset the trace
            </button>
          </div>
        </div>

        <CycleWaveform
          title={`Trace for ${property}`}
          signals={waveSignals}
          edges={trace.length}
          cycleWidth={trace.length <= 8 ? 28 : undefined}
          markers={markers}
          highlights={highlights}
          cursor={resultsVisible && selectedAttempt ? selectedAttempt.start : undefined}
          onToggle={toggle}
          onSelectEdge={(k) => setSelected(k)}
          caption={`x-axis: posedge clk edges 0–${trace.length - 1} (cycle time, not ns). A level drawn changing just after edge k−1 is the value sampled at edge k (Preponed, §16.5.1), so a change "at" an edge is seen one edge later. Toggle a cell to change the value sampled at that edge; select an edge number to inspect that attempt.`}
          className="min-w-0"
        />

        {mode === "learn" && learn.challenge && !revealed ? (
          <p className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-sm text-foreground">
            <strong>Challenge:</strong> {learn.challenge.prompt} Toggle cells, predict, then evaluate to check.
          </p>
        ) : null}

        {mode !== "debug" && !revealed && parsed.ok ? (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
            <p className="text-sm font-semibold text-foreground">
              <span className="mr-2 rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning">Predict</span>
              Mark what each attempt reports. Each button cycles ? → ✓ {statusText.PASS} → ✕ {statusText.FAIL} → ○ {statusText.VACUOUS} → … {statusText.PENDING}
              {parsed.spec.disable ? ` → ⊘ ${statusText.DISABLED}` : ""}.
            </p>
            <div role="group" aria-label="Your predictions, one per attempt" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,96px),1fr))]">
              {Array.from({ length: trace.length }, (_, k) => {
                const p = predictions[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => cyclePrediction(k)}
                    aria-label={`Attempt starting at edge ${k}: your prediction is ${p ? statusText[p] : "not set"}. Activate to change.`}
                    className={cn(
                      "min-h-10 rounded-lg border px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      p ? statusClass[p] : "border-border/70 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="font-mono">A{k}</span> <span aria-hidden>{p ? `${statusGlyph[p]} ${statusText[p]}` : "?"}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={predictionCount === 0}
                onClick={evaluate}
                className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                Evaluate ({predictionCount} predicted)
              </button>
              <button
                type="button"
                onClick={evaluate}
                className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reveal without predicting
              </button>
            </div>
          </div>
        ) : null}

        {resultsVisible && evaluation ? (
          <div className="space-y-3">
            <p aria-live="polite" className="text-sm text-foreground">
              <strong>Result:</strong> {summarize(evaluation)}.
              {mode !== "debug" && predictionCount > 0 ? ` You predicted ${predictionCount} attempt${predictionCount === 1 ? "" : "s"}; ${correctCount} correct.` : ""}
            </p>
            {mode === "learn" ? (
              <p className="text-sm text-muted-foreground">
                What to notice: <Rich text={learn.focus} />
              </p>
            ) : null}
            {mode === "learn" && learn.challenge && learn.property === property ? (
              <ChallengeResult result={gradeEarlyGrantChallenge(evaluation, trace, learn.challenge)} />
            ) : null}
            <div role="group" aria-label="Attempts" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,132px),1fr))]">
              {evaluation.attempts.map((a) => {
                const p = predictions[a.start];
                const mismatch = p !== undefined && p !== a.status;
                return (
                  <button
                    key={a.start}
                    type="button"
                    aria-pressed={selected === a.start}
                    onClick={() => setSelected(a.start)}
                    aria-label={`Attempt A${a.start}: ${attemptStatusPhrase(a)}${p ? `; you predicted ${statusText[p]}, ${mismatch ? "mismatch" : "match"}` : ""}. Show explanation.`}
                    className={cn(
                      "min-h-10 rounded-lg border px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      statusClass[a.status],
                      selected === a.start && "ring-2 ring-cyan-500",
                    )}
                  >
                    <span className="font-mono">A{a.start}</span> <span aria-hidden>{statusGlyph[a.status]}</span> {statusText[a.status]}
                    {a.status !== "VACUOUS" && a.status !== "PENDING" ? <span className="font-mono"> →{a.end}</span> : null}
                    {p ? (
                      <span className={cn("block", mismatch ? "font-semibold text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
                        you said {statusGlyph[p]} {statusText[p]}: {mismatch ? "✕ wrong" : "✓ right"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedAttempt && parsed.ok ? (
              <AttemptExplanation attempt={selectedAttempt} predicted={predictions[selectedAttempt.start]} spec={parsed.spec} />
            ) : (
              <p className="text-sm text-muted-foreground">Select an attempt (or an edge number under the waveform) to see why it got its result.</p>
            )}
          </div>
        ) : null}

        {mode === "debug" ? (
          <PredictionPrompt
            resetKey={debugCase.id}
            question={debugCase.question}
            options={debugCase.options.map((o) => ({ id: o.id, label: <Rich text={o.label} />, correct: o.correct, feedback: plainText(o.feedback) }))}
          >
            <div className="space-y-2 text-sm">
              <button
                type="button"
                aria-pressed={showFix}
                onClick={() => {
                  setShowFix((v) => !v);
                  setSelected(null);
                }}
                className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500/60 bg-cyan-500/15 px-4 font-semibold text-foreground hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showFix ? "Show the buggy property again" : "Apply the fix"}
              </button>
              <p>
                Fix: <code className="font-mono [font-variant-ligatures:none]">{debugCase.fixedProperty}</code>. <Rich text={debugCase.fixNote} />
              </p>
              {showFix && evaluation ? (
                <p aria-live="polite" className="font-mono text-[12.5px] text-emerald-700 [font-variant-ligatures:none] dark:text-emerald-300">
                  after the fix, a_check: {summarize(evaluation)}
                </p>
              ) : null}
            </div>
          </PredictionPrompt>
        ) : null}
      </div>
    </VisualFrame>
  );
}

function AttemptExplanation({ attempt, predicted, spec }: { attempt: SvaAttempt; predicted?: AttemptStatus; spec: SvaSpec }) {
  const diagnosis = predicted ? diagnoseAttempt(spec, attempt, predicted) : null;
  return (
    <div aria-live="polite" className={cn("rounded-xl border p-3 text-sm", statusClass[attempt.status])}>
      <p className="font-semibold">
        <span aria-hidden>{statusGlyph[attempt.status]} </span>
        Attempt A{attempt.start} starts at edge {attempt.start}:{" "}
        {attempt.status === "PENDING" ? `${statusText.PENDING} when the trace ends` : attemptStatusPhrase(attempt)}
      </p>
      <p className="mt-1 text-foreground">
        Why: <Rich text={attempt.reason} />.
      </p>
      {diagnosis ? (
        <p className={cn("mt-2", diagnosis.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          <strong>{diagnosis.correct ? "Your prediction ✓ " : `Your prediction (${statusText[predicted!]}) ✕ `}</strong>
          <Rich text={diagnosis.message} />
        </p>
      ) : null}
      {attempt.steps.length > 0 ? (
        <ol className="mt-2 space-y-1 text-foreground" aria-label={`Step-by-step match for attempt A${attempt.start}`}>
          {attempt.steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{edgeLabel(s)}</span>
              <span aria-hidden className={s.kind === "fail" ? "text-rose-600 dark:text-rose-400" : s.kind === "match" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                {stepGlyph[s.kind]}
              </span>
              <span className="sr-only">{s.kind === "match" ? "matched" : s.kind === "fail" ? "failed" : s.kind === "wait" ? "waiting" : "note"}:</span>
              <code className="font-mono text-[12.5px] [font-variant-ligatures:none]">{s.element}</code>
              <span className="min-w-0 text-muted-foreground">{s.detail}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}


function ChallengeResult({ result }: { result: { met: boolean; message: string } }) {
  return (
    <p
      data-testid="sva-challenge-result"
      className={cn(
        "rounded-lg border p-3 text-sm",
        result.met ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-border/70 bg-background/40 text-foreground",
      )}
    >
      <strong>{result.met ? "Challenge met. " : "Challenge: not yet. "}</strong>
      <Rich text={result.message} />
    </p>
  );
}

/* ------------------------------------------------------------------------ */
/* Sampling lab (F3B): sample in Preponed, evaluate in Observed, act in      */
/* Reactive. Every sentence comes from evaluateSamplingLab / grading.        */
/* ------------------------------------------------------------------------ */

const verdictClass: Record<SamplingVerdict, string> = {
  PASS: statusClass.PASS,
  FAIL: statusClass.FAIL,
  DISABLED: statusClass.DISABLED,
};
const verdictGlyph: Record<SamplingVerdict, string> = { PASS: "✓", FAIL: "✕", DISABLED: "⊘" };
const verdictTone: Record<SamplingVerdict, MarkerTone> = { PASS: "pass", FAIL: "fail", DISABLED: "info" };
const LOGIC_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "x", label: "x" },
];
const toLogic = (v: string): LogicBit => (v === "x" ? "x" : v === "1" ? 1 : 0);

/** Lane geometry matches CycleWaveform (label column 76 px) so markers sit under their edges. */
const LANE_LABEL_W = 76;
const LANE_CYCLE_W = 38;
const LANE_ROW_H = 22;

function RegionLane({ edges, revealed, cursor }: { edges: SamplingEdge[]; revealed: Set<number>; cursor: number }) {
  const width = LANE_LABEL_W + edges.length * LANE_CYCLE_W + 8;
  const rows = ["Preponed", "Observed", "Reactive"] as const;
  const x = (k: number) => LANE_LABEL_W + k * LANE_CYCLE_W + LANE_CYCLE_W / 2;
  return (
    <svg
      width={width}
      height={rows.length * LANE_ROW_H + 4}
      viewBox={`0 0 ${width} ${rows.length * LANE_ROW_H + 4}`}
      aria-hidden
      className="block"
      data-testid="sva-region-lane"
    >
      {rows.map((name, r) => (
        <text key={name} x={6} y={r * LANE_ROW_H + 15} className="fill-muted-foreground text-[10px]">
          {name}
        </text>
      ))}
      {edges.map((e) => {
        const shown = revealed.has(e.edge);
        const cx = x(e.edge);
        const reactive = e.verdict === "PASS" ? `${e.sampledQ}|${e.currentQ}` : e.verdict === "FAIL" ? "err" : "–";
        return (
          <g key={e.edge}>
            {e.edge === cursor ? (
              <rect x={cx - LANE_CYCLE_W / 2 + 1} y={1} width={LANE_CYCLE_W - 2} height={rows.length * LANE_ROW_H + 2} rx={4} className="fill-cyan-400/10 stroke-cyan-400" />
            ) : null}
            <text x={cx} y={15} textAnchor="middle" className={cn("text-[11px] font-semibold", shown ? "fill-violet-600 dark:fill-violet-300" : "fill-muted-foreground/60")}>
              {shown ? `▼${e.sampledQ}` : "?"}
            </text>
            <text
              x={cx}
              y={LANE_ROW_H + 15}
              textAnchor="middle"
              className={cn(
                "text-[12px] font-bold",
                !shown
                  ? "fill-muted-foreground/60"
                  : e.verdict === "PASS"
                    ? "fill-emerald-600 dark:fill-emerald-400"
                    : e.verdict === "FAIL"
                      ? "fill-rose-600 dark:fill-rose-400"
                      : "fill-sky-600 dark:fill-sky-400",
              )}
            >
              {shown ? verdictGlyph[e.verdict] : "?"}
            </text>
            <text
              x={cx}
              y={2 * LANE_ROW_H + 15}
              textAnchor="middle"
              className={cn("font-mono text-[10px]", !shown ? "fill-muted-foreground/60" : e.disagree ? "fill-amber-600 font-bold dark:fill-amber-300" : "fill-foreground")}
            >
              {shown ? reactive : "?"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LogicRadios({ legend, name, value, onChange }: { legend: string; name: string; value?: LogicBit; onChange: (v: LogicBit) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 font-mono text-xs text-foreground [font-variant-ligatures:none]">{legend}</legend>
      <div className="flex gap-2">
        {LOGIC_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-10 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border/70 px-2 font-mono text-sm",
              value !== undefined && String(value) === o.value && "border-amber-500/70 bg-amber-500/10",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              aria-label={`${legend} ${o.label}`}
              checked={value !== undefined && String(value) === o.value}
              onChange={() => onChange(toLogic(o.value))}
              className="size-5 shrink-0 accent-amber-500"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SvaSamplingLab() {
  const preset = flopOutputLowPreset;
  const groupName = useId();
  const [d, setD] = useState<BitRow>(() => [...preset.d]);
  const [rst, setRst] = useState<BitRow>(() => [...preset.rst]);
  const [qInit, setQInit] = useState<LogicBit>(preset.qInit);
  const [disableOnRst, setDisableOnRst] = useState(preset.disableOnRst);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [predictions, setPredictions] = useState<Record<number, SamplingPrediction>>({});
  const [draft, setDraft] = useState<{ verdict?: SamplingVerdict; sampled?: LogicBit; current?: LogicBit }>({});

  const result = useMemo(() => evaluateSamplingLab({ d, rst, qInit, disableOnRst }), [d, rst, qInit, disableOnRst]);
  const n = result.edges.length;
  const edge = result.edges[cursor];
  const isRevealed = revealed.has(cursor);
  const allRevealed = revealed.size === n;

  const resetRun = () => {
    setRevealed(new Set());
    setPredictions({});
    setDraft({});
  };
  const goTo = (k: number) => {
    setCursor(Math.max(0, Math.min(n - 1, k)));
    setDraft({});
  };
  const toggle = (signal: string, k: number) => {
    const flip = (row: BitRow) => row.map((v, i) => (i === k ? (v ? 0 : 1) : v)) as BitRow;
    if (signal === "d") setD(flip);
    else if (signal === "rst") setRst(flip);
    else return;
    resetRun();
  };
  const reveal = (withPrediction: boolean) => {
    if (withPrediction && draft.verdict) {
      setPredictions((p) => ({ ...p, [cursor]: { verdict: draft.verdict!, sampled: draft.sampled, current: draft.current } }));
    }
    setRevealed((r) => new Set(r).add(cursor));
  };

  const canLock = draft.verdict !== undefined && (draft.verdict !== "PASS" || (draft.sampled !== undefined && draft.current !== undefined));
  const prediction = predictions[cursor];
  const grade = isRevealed && prediction ? gradeSamplingPrediction(edge, prediction) : null;
  const markersText = regionMarkers(edge, disableOnRst);
  const verdictOptions: SamplingVerdict[] = disableOnRst ? ["PASS", "FAIL", "DISABLED"] : ["PASS", "FAIL"];

  const markers: CycleMarker[] = result.edges
    .filter((e) => revealed.has(e.edge))
    .map((e) => ({
      edge: e.edge,
      tone: verdictTone[e.verdict],
      glyph: verdictGlyph[e.verdict],
      short: e.disagree ? "q≠" : undefined,
      label: `Edge ${e.edge}: ${e.verdict}. ${plainText(e.reason)}`,
    }));

  return (
    <VisualFrame
      label="Sampling and regions lab"
      eyebrow="Experiment"
      title="Sample in Preponed, evaluate in Observed, act in Reactive"
      summary={
        <>
          A flop drives <code>q</code>, and an assertion checks <code>q == 1&apos;b0</code> on every edge. At each edge, predict the verdict and what the pass message prints, then reveal the three steps of that time slot.
        </>
      }
      fidelity="model"
      assumptions={SAMPLING_ASSUMPTIONS}
    >
      <div data-testid="sva-sampling-lab" className="space-y-4">
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <CodeTrace label="Flop and assertion (generated)" lines={result.code.map((text, i) => ({ text, key: `s${i}` }))} className="min-w-0" />
          <div className="min-w-0 space-y-3 text-sm">
            <button
              type="button"
              aria-pressed={disableOnRst}
              onClick={() => {
                setDisableOnRst((v) => !v);
                resetRun();
              }}
              className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500/60 bg-cyan-500/15 px-3 font-semibold text-foreground hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {disableOnRst ? "Remove disable iff (rst)" : "Add disable iff (rst)"}
            </button>
            <SegmentedControl<string>
              label="q before edge 0"
              mono
              value={String(qInit)}
              onChange={(v) => {
                setQInit(toLogic(v));
                resetRun();
              }}
              options={LOGIC_OPTIONS}
            />
            <button
              type="button"
              onClick={() => {
                setD([...preset.d]);
                setRst([...preset.rst]);
                setQInit(preset.qInit);
                resetRun();
              }}
              className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset the trace
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <CycleWaveform
            title="Trace for a_q_was_low"
            signals={[
              { name: "clk", kind: "clock" },
              { name: "d", kind: "bit", values: d, editable: true },
              { name: "rst", kind: "bit", values: rst, editable: true },
              { name: "q", kind: "bit", values: result.qRow.map((v) => (v === "x" ? "X" : v)) },
            ]}
            edges={n}
            cycleWidth={LANE_CYCLE_W}
            markers={markers}
            cursor={cursor}
            onToggle={toggle}
            onSelectEdge={goTo}
            caption={`x-axis: posedge clk edges 0–${n - 1}. A level drawn changing just after edge k−1 is the value sampled at edge k (Preponed, §16.5.1). Toggle d or rst; q follows the flop, one edge later.`}
          />
          <div className="overflow-x-auto px-2">
            <RegionLane edges={result.edges} revealed={revealed} cursor={cursor} />
          </div>
          <p className="px-2 text-xs text-muted-foreground">
            Lanes: <span aria-hidden>▼</span> the sample of q (Preponed) · <span aria-hidden>✓ ✕ ⊘</span> the verdict (Observed) · the pass message as <code>$sampled(q)|q</code>, or <code>err</code> for <code>$error</code> (Reactive). Amber: the two printed values differ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(cursor - 1)}
            disabled={cursor === 0}
            className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            ← Previous edge
          </button>
          <label className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm text-foreground">
            <span className="shrink-0 font-mono">edge {cursor}</span>
            <input
              type="range"
              min={0}
              max={n - 1}
              step={1}
              value={cursor}
              aria-label="Edge"
              aria-valuetext={`edge ${cursor} of ${n - 1}`}
              onChange={(e) => goTo(Number(e.target.value))}
              className="min-w-0 flex-1 accent-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() => goTo(cursor + 1)}
            disabled={cursor === n - 1}
            className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            Next edge →
          </button>
        </div>

        {!isRevealed ? (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">
                <span className="mr-2 rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning">Predict</span>
                Edge {cursor}: what does <code>a_q_was_low</code> report?
              </legend>
              <div className="flex flex-wrap gap-2">
                {verdictOptions.map((v) => (
                  <label
                    key={v}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 text-sm",
                      draft.verdict === v && "border-amber-500/70 bg-amber-500/10",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${groupName}-verdict`}
                      value={v}
                      checked={draft.verdict === v}
                      onChange={() => setDraft((p) => ({ ...p, verdict: v }))}
                      className="size-5 shrink-0 accent-amber-500"
                    />
                    {v === "PASS" ? "pass" : v === "FAIL" ? "fail" : "disabled"}
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.verdict === "PASS" ? (
              <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <LogicRadios legend="The pass message prints $sampled(q) =" name={`${groupName}-sampled`} value={draft.sampled} onChange={(v) => setDraft((p) => ({ ...p, sampled: v }))} />
                <LogicRadios legend="The pass message prints q =" name={`${groupName}-current`} value={draft.current} onChange={(v) => setDraft((p) => ({ ...p, current: v }))} />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canLock}
                onClick={() => reveal(true)}
                className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lock in edge {cursor}
              </button>
              <button
                type="button"
                onClick={() => reveal(false)}
                className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reveal without predicting
              </button>
              <button
                type="button"
                onClick={() => setRevealed(new Set(result.edges.map((e) => e.edge)))}
                className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reveal every edge
              </button>
            </div>
          </div>
        ) : null}

        <div aria-live="polite" className="space-y-2">
          {isRevealed ? (
            <div data-testid="sva-sampling-reveal" className={cn("rounded-xl border p-3 text-sm", verdictClass[edge.verdict])}>
              <p className="font-semibold">
                <span aria-hidden>{verdictGlyph[edge.verdict]} </span>
                Edge {cursor}: {edge.verdict}
              </p>
              {grade ? (
                <p className={cn("mt-1", grade.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                  <strong>{grade.correct ? "Your prediction ✓ " : "Your prediction ✕ "}</strong>
                  <Rich text={grade.message} />
                </p>
              ) : null}
              <ol className="mt-2 space-y-1 text-foreground" aria-label={`Time slot of edge ${cursor}, region by region`}>
                <li>
                  <Rich text={markersText.preponed} />
                </li>
                <li>
                  <Rich text={markersText.observed} />
                </li>
                <li>
                  <Rich text={markersText.reactive} />
                </li>
              </ol>
              <p className="mt-2 text-foreground">
                Why: <Rich text={edge.reason} />
              </p>
            </div>
          ) : null}
          {allRevealed ? (
            <p className="text-sm text-foreground">
              <strong>All edges:</strong> {summarizeSampling(result)}.
            </p>
          ) : null}
        </div>
      </div>
    </VisualFrame>
  );
}
