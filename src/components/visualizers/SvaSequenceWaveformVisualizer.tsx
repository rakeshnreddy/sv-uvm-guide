"use client";

import React, { useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal, type MarkerTone } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  assertionCode,
  diagnoseAttempt,
  evaluateSva,
  parseSva,
  plainText,
  scenarioTrace,
  splitInlineCode,
  statusGlyph,
  summarize,
  svaDebugCases,
  svaLearnScenarios,
  type AttemptStatus,
  type BitRow,
  type SvaAttempt,
  type SvaSpec,
  type SvaStep,
} from "@/lib/sva-model";
import { cn } from "@/lib/utils";

type Mode = "learn" | "debug" | "custom";

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
 * explanations and four debug cases.
 */
export function SvaSequenceWaveformVisualizer() {
  const inputId = useId();
  const [mode, setMode] = useState<Mode>("learn");
  const [learnId, setLearnId] = useState(svaLearnScenarios[0].id);
  const [debugId, setDebugId] = useState(svaDebugCases[0].id);
  const [signals, setSignals] = useState<string[]>(svaLearnScenarios[0].signals);
  const [rows, setRows] = useState<Record<string, BitRow>>(() => cloneRows(svaLearnScenarios[0].rows));
  const [baseRows, setBaseRows] = useState<Record<string, BitRow>>(() => cloneRows(svaLearnScenarios[0].rows));
  const [draft, setDraft] = useState(svaLearnScenarios[0].property);
  const [customSource, setCustomSource] = useState(svaLearnScenarios[0].property);
  const [showFix, setShowFix] = useState(false);
  const [predictions, setPredictions] = useState<Record<number, AttemptStatus>>({});
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const learn = svaLearnScenarios.find((s) => s.id === learnId) ?? svaLearnScenarios[0];
  const debugCase = svaDebugCases.find((c) => c.id === debugId) ?? svaDebugCases[0];

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
        label: `Attempt A${a.start}: ${a.status}${a.status === "VACUOUS" ? "" : ` at edge ${a.end}`}. ${plainText(a.reason)}`,
      }));
    }
    return Object.entries(predictions).map(([k, status]) => ({
      edge: Number(k),
      tone: "info" as const,
      glyph: statusGlyph[status],
      short: "you",
      label: `Your prediction for attempt A${k}: ${status}`,
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
      <div data-testid="sva-waveform-visualizer" className="space-y-4">
        <SegmentedControl<Mode>
          label="Mode"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "learn", label: "Learn: presets" },
            { value: "debug", label: "Debug: spot the bug" },
            { value: "custom", label: "Write your own" },
          ]}
        />

        {mode === "learn" ? (
          <SegmentedControl<string>
            label="Property preset"
            mono
            value={learnId}
            onChange={(id) => {
              const next = svaLearnScenarios.find((s) => s.id === id);
              if (!next) return;
              setLearnId(id);
              loadRows(next.signals, next.rows);
            }}
            options={svaLearnScenarios.map((s) => ({ value: s.id, label: s.label }))}
          />
        ) : null}

        {mode === "debug" ? (
          <SegmentedControl<string>
            label="Debug case"
            value={debugId}
            onChange={(id) => {
              const next = svaDebugCases.find((c) => c.id === id);
              if (!next) return;
              setDebugId(id);
              setShowFix(false);
              loadRows(next.signals, next.rows);
            }}
            options={svaDebugCases.map((c) => ({ value: c.id, label: c.label }))}
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
          <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
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
              Legend: <span aria-hidden>✓</span> pass · <span aria-hidden>✕</span> fail · <span aria-hidden>○</span> vacuous pass · <span aria-hidden>…</span> pending · <span aria-hidden>⊘</span> disabled. The marker sits on the attempt&apos;s start edge; <code>→5</code> means the result is decided at edge 5.
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
          markers={markers}
          highlights={highlights}
          cursor={resultsVisible && selectedAttempt ? selectedAttempt.start : undefined}
          onToggle={toggle}
          onSelectEdge={(k) => setSelected(k)}
          caption={`x-axis: posedge clk edges 0–${trace.length - 1} (cycle time, not ns). A level drawn changing just after edge k−1 is the value sampled at edge k (Preponed, §16.5.1), so a change "at" an edge is seen one edge later. Toggle a cell to change the value sampled at that edge; select an edge number to inspect that attempt.`}
          className="min-w-0"
        />

        {mode !== "debug" && !revealed && parsed.ok ? (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
            <p className="text-sm font-semibold text-foreground">
              <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
              Mark what each attempt reports. Each button cycles ? → ✓ pass → ✕ fail → ○ vacuous → … pending{parsed.spec.disable ? " → ⊘ disabled" : ""}.
            </p>
            <div role="group" aria-label="Your predictions, one per attempt" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,96px),1fr))]">
              {Array.from({ length: trace.length }, (_, k) => {
                const p = predictions[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => cyclePrediction(k)}
                    aria-label={`Attempt starting at edge ${k}: your prediction is ${p ?? "not set"}. Activate to change.`}
                    className={cn(
                      "min-h-10 rounded-lg border px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      p ? statusClass[p] : "border-border/70 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="font-mono">A{k}</span> <span aria-hidden>{p ? `${statusGlyph[p]} ${p.toLowerCase()}` : "?"}</span>
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
                className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    aria-label={`Attempt A${a.start}: ${a.status}${a.status === "VACUOUS" ? "" : ` at edge ${a.end}`}${p ? `; you predicted ${p}, ${mismatch ? "mismatch" : "match"}` : ""}. Show explanation.`}
                    className={cn(
                      "min-h-10 rounded-lg border px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      statusClass[a.status],
                      selected === a.start && "ring-2 ring-cyan-500",
                    )}
                  >
                    <span className="font-mono">A{a.start}</span> <span aria-hidden>{statusGlyph[a.status]}</span> {a.status.toLowerCase()}
                    {a.status !== "VACUOUS" && a.status !== "PENDING" ? <span className="font-mono"> →{a.end}</span> : null}
                    {p ? (
                      <span className={cn("block", mismatch ? "font-semibold text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
                        you said {statusGlyph[p]} {p.toLowerCase()}: {mismatch ? "✕ wrong" : "✓ right"}
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
        {attempt.status === "VACUOUS" ? "vacuous success" : attempt.status === "PENDING" ? "pending when the trace ends" : `${attempt.status} at edge ${attempt.end}`}
      </p>
      <p className="mt-1 text-foreground">
        Why: <Rich text={attempt.reason} />.
      </p>
      {diagnosis ? (
        <p className={cn("mt-2", diagnosis.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          <strong>{diagnosis.correct ? "Your prediction ✓ " : `Your prediction (${predicted}) ✕ `}</strong>
          <Rich text={diagnosis.message} />
        </p>
      ) : null}
      {attempt.steps.length > 0 ? (
        <ol className="mt-2 space-y-1 text-foreground" aria-label={`Step-by-step match for attempt A${attempt.start}`}>
          {attempt.steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{edgeLabel(s)}</span>
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

