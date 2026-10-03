"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ASSERTION_OPTIONS,
  BUGGY_COUNTER,
  COUNTER_MAX,
  DEFAULT_STIMULUS,
  FIXED_COUNTER,
  compareWithSpec,
  counterSourceLines,
  describeEvaluation,
  diagnoseEdgePick,
  evaluateAssertion,
  gradeAssertion,
  lineSuspects,
  simulateCounter,
  type AssertionEvaluation,
  type CounterTrace,
} from "@/lib/counter-bug-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Cycle-based model of the RTL shown: each waveform value is the one sampled at a rising clk edge (IEEE 1800-2023 §16.5.1). The flop's update at edge k shows up at edge k + 1.",
  "rst is synchronous and changes away from clock edges, so disable iff sees the same value the waveform shows.",
  "The assertion checker handles only the four properties offered here. It is not a general SVA engine.",
];

const ASSERTION_FEEDBACK: Record<string, string> = {
  catch:
    "The antecedent matches at edge 7 (count = 6), and |=> checks edge 8, where count is 0 instead of 7. It fails at exactly the edge you found in step 1, and it stays silent on the fixed counter.",
  "wrap-vacuous":
    "This is valid SVA and a real spec rule, but on this counter count never reaches 7. The antecedent never matches, so every attempt passes vacuously (§16.14.8). A check that never triggers proves nothing. Pair it with cover property (@(posedge clk) count == 3'd7); so you notice when it never fires.",
  tautology:
    "A 3-bit count is always at most 7, so this property can never fail. It only restates what the type already guarantees.",
  "same-cycle":
    "|-> checks the consequent in the same cycle as the antecedent. count cannot be 6 and 7 at once, so this fails at edge 7 even on a correct counter: a false alarm. Use |=> to mean \"on the next edge\". It also lacks disable iff (rst).",
};

const EDGE_HINTS = [
  "Write the expected sequence under the waveform. rst is high at edge 0, so count should read 0 at edge 1, then go up by 1 per edge.",
  `Count along the edges: edge 1 → 0, edge 2 → 1, … Which edge should show ${COUNTER_MAX}?`,
  `Edge 8 should show ${COUNTER_MAX}. What does the waveform show there?`,
];

const LINE_HINTS = [
  "Which value never appears in the waveform?",
  "Find the line that decides what happens when count reaches its largest value.",
  "Compare the constant in that line with the largest value in the spec.",
];

function counterSignals(trace: CounterTrace, withSpec: boolean): CycleSignal[] {
  const signals: CycleSignal[] = [
    { name: "clk", kind: "clock" },
    { name: "rst", kind: "bit", values: trace.stimulus.rst },
    { name: "count", kind: "bus", values: trace.count.map((v) => (v === "X" ? "X" : v)) },
  ];
  if (withSpec) {
    const { expected } = compareWithSpec(trace);
    signals.push({ name: "spec", kind: "bus", values: expected.map((e) => (e === null ? "–" : e)) });
  }
  return signals;
}

function specMarkers(trace: CounterTrace): CycleMarker[] {
  const cmp = compareWithSpec(trace);
  return cmp.checks.flatMap((check, edge) => {
    if (check === "unspecified") return [];
    const actual = trace.count[edge];
    const expected = cmp.expected[edge];
    return [
      check === "match"
        ? { edge, tone: "pass" as const, label: `edge ${edge}: count = ${actual} matches the spec` }
        : {
            edge,
            tone: "fail" as const,
            label: `edge ${edge}: count = ${actual}, spec expects ${expected}${edge === cmp.firstMismatch ? " (first mismatch)" : ""}`,
            short: edge === cmp.firstMismatch ? "1st" : undefined,
          },
    ];
  });
}

const STATUS_PRIORITY = { fail: 5, pass: 4, open: 3, pending: 3, disabled: 2, vacuous: 1 } as const;

/** One marker per edge: the most important attempt event that resolves (or is open) there. */
function assertionMarkers(evaluation: AssertionEvaluation): CycleMarker[] {
  const byEdge = new Map<number, { rank: number; marker: CycleMarker }>();
  const offer = (edge: number, rank: number, marker: CycleMarker) => {
    const current = byEdge.get(edge);
    if (!current || rank > current.rank) byEdge.set(edge, { rank, marker });
  };
  for (const attempt of evaluation.attempts) {
    const { start, decidedAt, status } = attempt;
    if (status === "fail") offer(decidedAt, STATUS_PRIORITY.fail, { edge: decidedAt, tone: "fail", label: `attempt from edge ${start} fails at edge ${decidedAt}` });
    else if (status === "pass") offer(decidedAt, STATUS_PRIORITY.pass, { edge: decidedAt, tone: "pass", label: `attempt from edge ${start} passes at edge ${decidedAt}` });
    else if (status === "pending") offer(start, STATUS_PRIORITY.pending, { edge: start, tone: "pending", label: `attempt from edge ${start} is still waiting for its next edge` });
    else if (status === "disabled") offer(decidedAt, STATUS_PRIORITY.disabled, { edge: decidedAt, tone: "info", glyph: "⊘", label: `attempt from edge ${start} disabled by rst` });
    else offer(decidedAt, STATUS_PRIORITY.vacuous, { edge: decidedAt, tone: "vacuous", label: `attempt from edge ${start} passes vacuously: antecedent false` });
    if ((status === "pass" || status === "fail") && decidedAt > start) {
      offer(start, STATUS_PRIORITY.open, { edge: start, tone: "pending", label: `attempt from edge ${start}: antecedent matched, consequent checked at edge ${decidedAt}` });
    }
  }
  return Array.from(byEdge.values())
    .map((v) => v.marker)
    .sort((a, b) => a.edge - b.edge);
}

function toCodeLines(design = BUGGY_COUNTER): CodeTraceLine[] {
  return counterSourceLines(design).map((l) => ({ key: l.key, text: l.text, owner: "design" as const }));
}

function StepHeading({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Step {n}</span>
      {title}
      {done ? (
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span aria-hidden>✓ </span>done
        </span>
      ) : null}
    </h4>
  );
}

/**
 * F1B bug hunt: spec vs waveform → first failing edge → offending line →
 * the assertion that would have caught it. Every value comes from
 * `counter-bug-model`, so the code, waveform and assertion results agree.
 */
const FirstBugHuntGame = () => {
  const [round, setRound] = useState(0);
  const [edgePick, setEdgePick] = useState<number | null>(null);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixApplied, setFixApplied] = useState(false);

  const buggy = useMemo(() => simulateCounter(BUGGY_COUNTER, DEFAULT_STIMULUS), []);
  const fixed = useMemo(() => simulateCounter(FIXED_COUNTER, DEFAULT_STIMULUS), []);
  const fixedCmp = useMemo(() => compareWithSpec(fixed), [fixed]);
  const suspects = useMemo(() => lineSuspects(BUGGY_COUNTER), []);
  const grades = useMemo(() => ASSERTION_OPTIONS.map((a) => gradeAssertion(a, DEFAULT_STIMULUS)), []);

  const edgeDiagnosis = edgePick === null ? null : diagnoseEdgePick(buggy, edgePick);
  const edgeFound = Boolean(edgeDiagnosis?.correct);
  const suspectInfo = suspects.find((s) => s.key === suspect);
  const lineFound = Boolean(suspectInfo?.culprit);

  const startOver = () => {
    setRound((r) => r + 1);
    setEdgePick(null);
    setSuspect(null);
    setFixApplied(false);
  };

  const assertionOptions: PredictionOption[] = ASSERTION_OPTIONS.map((a) => ({
    id: a.id,
    correct: gradeAssertion(a).catchesBug,
    feedback: ASSERTION_FEEDBACK[a.id] ?? "",
    label: <code className="block whitespace-pre-wrap break-words font-mono text-[12px] [font-variant-ligatures:none]">{a.source}</code>,
  }));

  return (
    <div data-testid="first-bug-hunt-game">
      <VisualFrame
        label="First bug hunt: a 3-bit counter"
        eyebrow="Debug it"
        title="Your first bug hunt: the counter that skips a number"
        summary="Compare the spec with the waveform, find the first edge that breaks it, find the line responsible, then choose the assertion that would have caught it."
        fidelity="model"
        assumptions={ASSUMPTIONS}
      >
        <div className="rounded-xl border border-teal-500/50 border-dashed bg-teal-500/[0.05] p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800 dark:text-teal-200">Spec</p>
          <p className="mt-1 text-foreground">
            After <code className="font-mono [font-variant-ligatures:none]">rst</code> is released,{" "}
            <code className="font-mono [font-variant-ligatures:none]">count</code> increases by 1 on every rising{" "}
            <code className="font-mono [font-variant-ligatures:none]">clk</code> edge: 0, 1, 2, …, {COUNTER_MAX}, then wraps to 0.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">The testbench holds rst high at edge 0 only. Each value below is the one sampled at that edge.</p>
        </div>

        {/* Step 1 */}
        <div className="space-y-2">
          <StepHeading n={1} title="Select the first edge where the sampled count breaks the spec" done={edgeFound} />
          <CycleWaveform
            title={edgeFound ? "Counter waveform with the spec row and check marks" : "Counter waveform from the design under test"}
            caption={`x-axis: rising clk edges 0 to ${DEFAULT_STIMULUS.edges - 1}. Select an edge number to check it.${edgeFound ? " Spec row added: ✓ match, ✕ mismatch, – unspecified before reset." : ""}`}
            signals={counterSignals(buggy, edgeFound)}
            edges={DEFAULT_STIMULUS.edges}
            cycleWidth={40}
            cursor={edgePick ?? undefined}
            onSelectEdge={edgeFound ? undefined : setEdgePick}
            markers={edgeFound ? specMarkers(buggy) : []}
          />
          {edgeDiagnosis ? (
            <p aria-live="polite" className={cn("text-sm", edgeDiagnosis.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
              <strong>
                Edge {edgeDiagnosis.edge}: {edgeDiagnosis.correct ? "Found it. " : "Not this one. "}
              </strong>
              {edgeDiagnosis.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Use the edge numbers under the waveform. They are buttons: Tab to one, then press Enter or Space.</p>
          )}
          {!edgeFound ? <HintLadder hints={EDGE_HINTS} resetKey={String(round)} /> : null}
        </div>

        {/* Step 2 */}
        {edgeFound ? (
          <div className="space-y-2">
            <StepHeading n={2} title="Which line makes the counter skip 7?" done={lineFound} />
            <CodeTrace
              label="up_counter.sv (design under test)"
              lines={toCodeLines(BUGGY_COUNTER)}
              activeKey={suspect ?? undefined}
              renderLineControl={(line) =>
                suspects.some((s) => s.key === line.key) ? (
                  <button
                    type="button"
                    aria-pressed={suspect === line.key}
                    aria-label={`Suspect line: ${line.text.trim()}`}
                    onClick={() => setSuspect(line.key as string)}
                    disabled={lineFound}
                    className={cn(
                      "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default",
                      suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                    )}
                  >
                    {suspect === line.key ? "suspected" : "suspect"}
                  </button>
                ) : null
              }
            />
            {suspectInfo ? (
              <p aria-live="polite" className={cn("text-sm", lineFound ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                <strong>{lineFound ? "Found it. " : "Not this line. "}</strong>
                {suspectInfo.feedback}
              </p>
            ) : null}
            {!lineFound ? <HintLadder hints={LINE_HINTS} resetKey={String(round)} /> : null}

            {lineFound ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                <button
                  type="button"
                  aria-pressed={fixApplied}
                  onClick={() => setFixApplied((v) => !v)}
                  className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 text-sm font-medium text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {fixApplied ? "Hide the fixed design" : "Apply the fix (3'd6 → 3'd7) and rerun the model"}
                </button>
                {fixApplied ? (
                  <div className="space-y-2">
                    <CodeTrace
                      label="Fixed RTL"
                      lines={toCodeLines(FIXED_COUNTER).filter((l) => ["always", "reset", "wrap", "incr", "end"].includes(l.key ?? ""))}
                      activeKey="wrap"
                    />
                    <CycleWaveform
                      title="Fixed counter waveform with the spec row"
                      caption={`x-axis: rising clk edges 0 to ${DEFAULT_STIMULUS.edges - 1}. ✓ marks a sample that matches the spec.`}
                      signals={counterSignals(fixed, true)}
                      edges={DEFAULT_STIMULUS.edges}
                      cycleWidth={40}
                      markers={specMarkers(fixed)}
                    />
                    <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-300">
                      <span aria-hidden>✓ </span>
                      Model rerun: {fixedCmp.firstMismatch === null ? `all ${fixedCmp.checkedEdges} checked edges match the spec, including 7 at edge 8 and the wrap to 0 at edge 9.` : `still mismatches at edge ${fixedCmp.firstMismatch}.`}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Step 2 (find the line) unlocks when you find the first failing edge.</p>
        )}

        {/* Step 3 */}
        {lineFound ? (
          <div className="space-y-2">
            <StepHeading n={3} title="Transfer: choose the assertion that would have caught it" done={false} />
            <PredictionPrompt
              resetKey={String(round)}
              question="Which concurrent assertion would have failed in simulation at the moment this bug happened, without false alarms on a correct counter?"
              options={assertionOptions}
            >
              {({ committed }) => {
                const shownId = committed && ASSERTION_OPTIONS.some((a) => a.id === committed) ? committed : "catch";
                const shown = ASSERTION_OPTIONS.find((a) => a.id === shownId) ?? ASSERTION_OPTIONS[0];
                const evaluation = evaluateAssertion(shown, buggy);
                return (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[300px] border-collapse text-left text-xs">
                        <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Model result for every option
                        </caption>
                        <thead>
                          <tr className="border-b border-border/70 text-muted-foreground">
                            <th scope="col" className="py-1 pr-2 font-medium">Assertion</th>
                            <th scope="col" className="py-1 pr-2 font-medium">Buggy counter</th>
                            <th scope="col" className="py-1 font-medium">Fixed counter</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grades.map((g) => (
                            <tr key={g.assertion.id} className="border-b border-border/40 align-top">
                              <th scope="row" className="py-1.5 pr-2 font-mono font-normal text-foreground [font-variant-ligatures:none]">
                                {g.assertion.source}
                              </th>
                              <td className={cn("py-1.5 pr-2", g.onBuggy.verdict === "fails" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                                <span aria-hidden>{g.onBuggy.verdict === "fails" ? "✕ " : g.onBuggy.verdict === "vacuous" ? "○ " : "✓ "}</span>
                                {describeEvaluation(g.onBuggy)}
                                {g.onBuggy.verdict !== "fails" ? " (misses the bug)" : " (catches the bug)"}
                              </td>
                              <td className={cn("py-1.5", g.falseAlarm ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>
                                <span aria-hidden>{g.onFixed.verdict === "fails" ? "✕ " : "✓ "}</span>
                                {describeEvaluation(g.onFixed)}
                                {g.falseAlarm ? " (false alarm)" : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <CycleWaveform
                      title="Assertion attempts on the buggy counter"
                      caption="x-axis: rising clk edges. ✕ fail, ✓ pass, ○ vacuous pass (antecedent false), ⊘ disabled by rst, … attempt still open. One marker per edge, the most important event wins."
                      signals={counterSignals(buggy, false)}
                      edges={DEFAULT_STIMULUS.edges}
                      cycleWidth={40}
                      markers={assertionMarkers(evaluation)}
                    />
                    <p className="text-sm text-foreground">
                      <span className="font-mono text-[12px] [font-variant-ligatures:none]">{shown.source}</span> on the buggy counter: {describeEvaluation(evaluation)}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The workflow you just used is the job: spec → first divergent sample → the line that decided it → a check that fires at that edge on every future run.
                    </p>
                  </div>
                );
              }}
            </PredictionPrompt>
          </div>
        ) : edgeFound ? (
          <p className="text-xs text-muted-foreground">Step 3 (write the check) unlocks when you find the line.</p>
        ) : null}

        <div>
          <button
            type="button"
            onClick={startOver}
            className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start over
          </button>
        </div>
      </VisualFrame>
    </div>
  );
};

export default FirstBugHuntGame;
