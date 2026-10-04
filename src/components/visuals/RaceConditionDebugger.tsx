"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { StepWaveform } from "@/components/visual-system/StepWaveform";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { comparisonStyles } from "@/components/visual-system/visual-language";
import {
  exploreOrderings,
  findRaceHazards,
  formatValue,
  simulateTimeSlot,
  withAssignmentOp,
  withZeroDelay,
  type SvScenario,
  type SvValue,
  type TraceStep,
} from "@/lib/sv-scheduler-model";
import { shiftRegisterScenario, testbenchDriveScenario } from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

import { codeLinesFor } from "./scheduler/scheduler-view-helpers";
import { SCHEDULER_MODEL_ASSUMPTIONS } from "./TimeSlotTraceVisualizer";

type BenchId = "shift" | "handoff";

interface Bench {
  id: BenchId;
  label: string;
  base: () => SvScenario;
  /** What a real flip-flop circuit would produce (the hardware-faithful answer). */
  expected: Record<string, SvValue>;
  expectedWhy: string;
  question: string;
}

const benches: Bench[] = [
  {
    id: "shift",
    label: "Two-flop shift register",
    base: () => shiftRegisterScenario("blocking"),
    expected: { q1: 1, q2: 0 },
    expectedWhy: "Real flops all sample on the same edge, so q2 captures q1's old value (0).",
    question: "With the operators below, will every legal process order give the same q1 and q2?",
  },
  {
    id: "handoff",
    label: "TB drives the DUT input",
    base: () => testbenchDriveScenario("blocking"),
    expected: { q: 3 },
    expectedWhy: "A real flop captures din as it was just before the edge (3); the testbench's new value belongs to the next cycle.",
    question: "With the operators below, will every legal process order give the same q?",
  },
];

const configKey = (scenario: SvScenario) =>
  scenario.processes.map((p) => p.body.map((s) => (s.kind === "assign" ? `${s.id}${s.op === "nba" ? "<=" : "="}` : s.kind)).join(",")).join("|");

/** Index of the first step whose values or description differ between two runs. */
function firstDivergence(a: TraceStep[], b: TraceStep[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i].what !== b[i].what || JSON.stringify(a[i].values) !== JSON.stringify(b[i].values)) return i;
  }
  return n;
}

export default function RaceConditionDebugger({ bench: initialBench = "shift" }: { bench?: BenchId }) {
  const [benchId, setBenchId] = useState<BenchId>(initialBench);
  const bench = benches.find((b) => b.id === benchId) ?? benches[0];
  const [scenario, setScenario] = useState<SvScenario>(() => bench.base());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const switchBench = (id: BenchId) => {
    const next = benches.find((b) => b.id === id) ?? benches[0];
    setBenchId(id);
    setScenario(next.base());
  };

  const exploration = useMemo(() => exploreOrderings(scenario), [scenario]);
  const hazards = useMemo(() => findRaceHazards(scenario), [scenario]);
  const lines = useMemo(() => codeLinesFor(scenario), [scenario]);
  const key = configKey(scenario);

  const runs = useMemo(() => {
    const [g1, g2] = exploration.outcomes;
    if (!g2) return null;
    const r1 = simulateTimeSlot(scenario, g1.runs[0].choices);
    const r2 = simulateTimeSlot(scenario, g2.runs[0].choices);
    return { r1, r2, diverge: firstDivergence(r1.trace, r2.trace) };
  }, [exploration, scenario]);

  const labelOf = (id: string) => scenario.processes.find((p) => p.id === id)?.label ?? id;
  const assignIds = new Set(scenario.processes.flatMap((p) => p.body.filter((s) => s.kind === "assign" && s.target !== "seen").map((s) => s.id)));
  const opOf = (stmtId: string) => {
    for (const p of scenario.processes) {
      const s = p.body.find((x) => x.id === stmtId);
      if (s && s.kind === "assign") return s.op;
    }
    return undefined;
  };

  const renderLineControl = (line: CodeTraceLine) => {
    if (!line.key || !assignIds.has(line.key)) return null;
    const op = opOf(line.key);
    return (
      <button
        type="button"
        onClick={() => setScenario((s) => withAssignmentOp(s, line.key as string, op === "nba" ? "blocking" : "nba"))}
        aria-label={`Change ${line.text.trim()} to ${op === "nba" ? "a blocking (=)" : "a nonblocking (<=)"} assignment`}
        className="rounded-md border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [font-variant-ligatures:none]"
      >
        use {op === "nba" ? "=" : "<="}
      </button>
    );
  };

  const hazardKeys = hazards.flatMap((h) => [h.writer.stmtId, h.reader.stmtId]);
  const correctIsDeterministic = exploration.deterministic;
  const outcomeMatchesExpected = (values: Record<string, SvValue>) => Object.entries(bench.expected).every(([k, v]) => values[k] === v);

  return (
    <section aria-label="Race condition debugger" className="not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Experiment</p>
          <h3 className="text-lg font-semibold text-foreground">Race Condition Debugger</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Flip operators, predict, then let the model run <em>every</em> order the standard allows. A race is code whose result changes with that order.
          </p>
        </div>
        <FidelityBadge fidelity="model" assumptions={SCHEDULER_MODEL_ASSUMPTIONS} />
      </header>

      <div role="tablist" aria-label="Bench" className="flex flex-wrap gap-2">
        {benches.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={b.id === benchId}
            onClick={() => switchBench(b.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              b.id === benchId ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <CodeTrace
        label="Edit the code — every assignment can be switched"
        lines={lines}
        contextKeys={[]}
        renderLineControl={renderLineControl}
      />

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showAdvanced ? "Hide" : "Show"} advanced experiment: #0 delays
        </button>
        {showAdvanced ? (
          <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-border/70 p-3 text-sm">
            {scenario.processes.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  checked={p.body[0]?.kind === "delay0"}
                  onChange={(e) => setScenario((s) => withZeroDelay(s, p.id, e.target.checked))}
                />
                <span className="font-mono [font-variant-ligatures:none]">#0</span> at start of {p.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <PredictionPrompt
        resetKey={`${benchId}:${key}`}
        question={bench.question}
        options={[
          {
            id: "same",
            label: "Yes — the result is the same in every order",
            correct: correctIsDeterministic,
            feedback: correctIsDeterministic
              ? "No process reads a value another process writes with = on the same event, so order cannot leak into the result."
              : `Not here: ${hazards[0]?.explanation ?? "one process can observe another's update depending on order."}`,
          },
          {
            id: "differs",
            label: "No — some orders give a different result",
            correct: !correctIsDeterministic,
            feedback: !correctIsDeterministic
              ? hazards[0]?.explanation ?? "The result depends on which ready process runs first."
              : "Reads happen in Active before any <= update lands in NBA (or Re-NBA for clocking drives), so every order reads the same values.",
          },
        ]}
      >
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              exploration.deterministic
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
            )}
          >
            {exploration.deterministic
              ? `✓ Deterministic: all ${exploration.runCount} legal orderings agree.`
              : `⚠ Race: ${exploration.outcomes.length} different results from ${exploration.runCount} legal orderings.`}
          </div>

          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {exploration.outcomes.map((o, i) => {
              const faithful = outcomeMatchesExpected(o.finalValues);
              return (
                <div key={o.signature} className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome {i + 1}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {o.runs.map((r) => r.executionOrder.map(labelOf).join(" → ")).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {scenario.watch.filter((s) => s !== "clk").map((s) => (
                      <ValueChip key={s} name={s} value={o.finalValues[s]} />
                    ))}
                  </div>
                  <p className={cn("mt-2 text-xs font-medium", faithful ? comparisonStyles.match.className : comparisonStyles.mismatch.className)}>
                    {faithful ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph}{" "}
                    {faithful ? "Matches real flip-flop hardware" : "Differs from real flip-flop hardware"} ({comparisonStyles.expected.tag}{" "}
                    {Object.entries(bench.expected).map(([k, v]) => `${k}=${formatValue(v)}`).join(", ")})
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Hardware reference: </strong>
            {bench.expectedWhy}
          </p>

          {hazards.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Where the race lives</p>
              <CodeTrace label="Racing write → read" lines={lines} contextKeys={hazardKeys} activeKey={hazards[0].reader.stmtId} />
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {hazards.map((h) => (
                  <li key={`${h.writer.stmtId}-${h.reader.stmtId}`}>{h.explanation}</li>
                ))}
              </ul>
            </div>
          ) : exploration.deterministic && !exploration.outcomes.every((o) => outcomeMatchesExpected(o.finalValues)) ? (
            <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              Deterministic is not the same as correct: every order agrees, but the result does not match what real flops would do. #0 changed <em>when</em> a process
              reads, not whether the code models hardware.
            </p>
          ) : null}

          {runs ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Compare two executions — they split at step {runs.diverge + 1}</p>
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
                {[runs.r1, runs.r2].map((r, idx) => (
                  <div key={idx} className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Run {idx + 1}: {r.executionOrder.map(labelOf).join(" → ")}
                    </p>
                    <ol className="space-y-1 text-xs">
                      {r.trace.slice(runs.diverge, runs.diverge + 3).map((s) => (
                        <li key={s.index} className={cn("rounded px-2 py-1 [font-variant-ligatures:none]", s.index === runs.diverge ? "bg-amber-500/15 text-foreground" : "text-muted-foreground")}>
                          <span className="font-mono">#{s.index + 1}</span> {s.what}
                        </li>
                      ))}
                    </ol>
                    <StepWaveform
                      signals={scenario.watch.filter((s) => s !== "clk")}
                      bitSignals={["d", "q1", "q2"]}
                      snapshots={r.trace.map((s) => s.values)}
                      currentIndex={runs.diverge}
                      axisLabel="Cursor marks the first step where the runs differ. All steps are at t = 10 ns."
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </PredictionPrompt>
    </section>
  );
}
