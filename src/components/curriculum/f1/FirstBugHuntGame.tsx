"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ASSERTION_OPTIONS,
  BUGGY_COUNTER,
  COUNTER_MAX,
  DEFAULT_STIMULUS,
  FIXED_COUNTER,
  NONVACUOUS_PREDICTION_IDS,
  antecedentCover,
  bugCatchOutcome,
  compareWithSpec,
  counterSourceLines,
  coverHits,
  describeEvaluation,
  diagnoseEdgePick,
  evaluateAssertion,
  gradeAssertion,
  lineSuspects,
  nonvacuousPredictionHolds,
  simulateCounter,
  tallyAttempts,
  type AssertionEvaluation,
  type AttemptTally,
  type BugCatchOutcome,
  type CounterAssertion,
  type CounterTrace,
  type NonvacuousPredictionId,
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
    "This is valid SVA and a real spec rule, but on this counter count never reaches 7. The antecedent never matches, so each attempt that rst does not disable ends as a vacuous success: not a pass or a failure (§16.14.8). A check that never triggers proves nothing. Pair it with cover property (@(posedge clk) count == 3'd7); so you notice when it never fires.",
  tautology:
    "Every known 3-bit value is at most 7, and disable iff (rst) masks the X before reset, so this property can never fail here. A counter that skips 7 still satisfies it.",
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
    else offer(decidedAt, STATUS_PRIORITY.vacuous, { edge: decidedAt, tone: "vacuous", label: `attempt from edge ${start} (antecedent false) is a vacuous success: not a pass or a failure (§16.14.8)` });
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

/**
 * Step 3 gives only the verdict of a check that never failed and never
 * completed a real check. Its tally stays hidden until the learner predicts
 * it in step 4.
 */
function verdictBeforeTally(e: AssertionEvaluation): string {
  return e.verdict === "vacuous" ? "never fails. Did it ever check anything? Step 4 counts its attempts" : describeEvaluation(e);
}

/** Suffix for the buggy-counter cell of the step-3 table. Only "catches" is good news. */
function bugCatchSuffix(o: BugCatchOutcome): string {
  switch (o.kind) {
    case "catches":
      return " (catches the bug)";
    case "misses":
      return " (misses the bug)";
    case "fires-off-bug":
      return o.check === "match"
        ? ` (at edge ${o.edge} the sample, ${o.sample}, still matches the spec: not the bug)`
        : ` (edge ${o.edge} is before reset, where the spec says nothing: not the bug)`;
    case "fires-on-both":
      return " (it fails on the fixed counter too: not specific to the bug)";
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const edgeList = (edges: number[]) => (edges.length === 1 ? `edge ${edges[0]}` : `edges ${edges.join(", ")}`);

type CounterView = "buggy" | "fixed";

const COUNTER_LABEL: Record<CounterView, string> = { buggy: "Buggy counter", fixed: "Fixed counter" };

interface TallyRow {
  key: keyof AttemptTally;
  glyph: string;
  label: string;
  /** Segment colours for the tally bar; each segment also carries its glyph and count. */
  barClassName: string;
}

/** Order and wording of the tally. Glyphs match the waveform markers. */
const TALLY_ROWS: TallyRow[] = [
  { key: "nonvacuous", glyph: "✓", label: "Nonvacuous successes (a real check that held)", barClassName: "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100" },
  { key: "failures", glyph: "✕", label: "Failures", barClassName: "bg-rose-500/25 text-rose-900 dark:text-rose-100" },
  { key: "vacuous", glyph: "○", label: "Vacuous successes: not a pass or a failure (§16.14.8)", barClassName: "bg-slate-400/25 text-slate-800 dark:text-slate-200" },
  { key: "disabled", glyph: "⊘", label: "Disabled by rst", barClassName: "bg-sky-500/20 text-sky-900 dark:text-sky-100" },
  { key: "pending", glyph: "…", label: "Still open when the run ends", barClassName: "bg-amber-500/25 text-amber-900 dark:text-amber-100" },
];

/** Proportional picture of one tally. The table beside it carries the same numbers for screen readers. */
function TallyBar({ label, tally }: { label: string; tally: AttemptTally }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="w-12 shrink-0 text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="flex h-7 min-w-0 flex-1 overflow-hidden rounded-md border border-border/70">
        {TALLY_ROWS.filter((row) => tally[row.key] > 0).map((row) => (
          <div
            key={row.key}
            style={{ flexGrow: tally[row.key], flexBasis: 0 }}
            className={cn("flex min-w-[2rem] items-center justify-center border-r border-border/40 font-mono text-[11px] last:border-r-0", row.barClassName)}
          >
            {row.glyph} {tally[row.key]}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Renders nothing; tells the parent that a PredictionPrompt has revealed its answer (committed or skipped). */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

interface VacuityTallyProps {
  assertion: CounterAssertion;
  buggy: CounterTrace;
  fixed: CounterTrace;
  /** The learner chose this assertion in step 3. */
  chosenInStep3: boolean;
}

/**
 * Step 4: predict the nonvacuous successes of a check that never fails, then
 * reveal its attempt tally beside the cover on its antecedent. Every number
 * comes from `tallyAttempts` and `coverHits`.
 */
function VacuityTally({ assertion, buggy, fixed, chosenInStep3 }: VacuityTallyProps) {
  const [view, setView] = useState<CounterView>("buggy");
  const cover = useMemo(() => antecedentCover(assertion), [assertion]);
  const runs = useMemo(() => {
    const run = (trace: CounterTrace) => {
      const evaluation = evaluateAssertion(assertion, trace);
      return { trace, evaluation, tally: tallyAttempts(evaluation), hits: cover ? coverHits(trace, cover.predicate) : [] };
    };
    return { buggy: run(buggy), fixed: run(fixed) };
  }, [assertion, buggy, fixed, cover]);

  const b = runs.buggy.tally;
  const f = runs.fixed.tally;
  const edges = buggy.stimulus.edges;
  const consequent = `count ${assertion.consequent.op} 3'd${assertion.consequent.value}`;
  const fixedFirstCheck = runs.fixed.evaluation.attempts.find((a) => a.status === "pass");
  const fixedCheckText = fixedFirstCheck
    ? `The fixed counter matches the antecedent at edge ${fixedFirstCheck.start}, so that attempt checks ${consequent} at edge ${fixedFirstCheck.decidedAt} and succeeds nonvacuously`
    : "The fixed counter never completes a real check either";

  const feedback: Record<NonvacuousPredictionId, string> = {
    zero: `On the buggy counter ${cover && runs.buggy.hits.length === 0 ? "the antecedent never matches" : "no matched antecedent leads to a check that holds"}. ${plural(b.vacuous, "attempt is a vacuous success", "attempts are vacuous successes")} and ${plural(b.disabled, "attempt is", "attempts are")} disabled by rst, which leaves ${b.nonvacuous} nonvacuous successes.${b.failures === 0 ? " No failure, and no real check either: silence here proves nothing." : ""}`,
    "same-as-fixed": `The tally depends on the run, not only on the assertion text. ${fixedCheckText} (${f.nonvacuous} in all). The buggy counter never samples ${COUNTER_MAX}, so it gets ${b.nonvacuous}.`,
    "every-attempt": `No failures does not mean every attempt passed. ${b.vacuous} of the ${b.attempts} attempts are vacuous successes: the antecedent was false, so ${consequent} was never evaluated, and §16.14.8 counts such an attempt as neither a pass nor a failure. ${plural(b.disabled, "attempt is", "attempts are")} disabled by rst. Nonvacuous successes: ${b.nonvacuous}.`,
  };
  const labels: Record<NonvacuousPredictionId, string> = {
    zero: "None. No attempt on the buggy counter ever completes a real check.",
    "same-as-fixed": "The same number as on the fixed counter. The assertion is identical, so its tally is too.",
    "every-attempt": `Every attempt. It never fails, so all ${edges} attempts succeeded.`,
  };
  const options: PredictionOption[] = NONVACUOUS_PREDICTION_IDS.map((id) => ({
    id,
    label: labels[id],
    correct: nonvacuousPredictionHolds(id, b, f),
    feedback: feedback[id],
  }));

  const shown = runs[view];
  const shownMarkers = assertionMarkers(shown.evaluation);
  // One marker per edge, so a ✓ or … can sit where a vacuous attempt also starts.
  const vacuousMarkers = shownMarkers.filter((m) => m.tone === "vacuous").length;
  const hiddenVacuous = shown.tally.vacuous - vacuousMarkers;
  const markerNote =
    hiddenVacuous > 0
      ? ` One marker per edge, the most important event wins: this run shows ${vacuousMarkers} ○ markers for ${shown.tally.vacuous} vacuous successes, because ${hiddenVacuous === 1 ? "one shares its edge" : `${hiddenVacuous} share their edges`} with a more important marker. The tally counts every attempt.`
      : " One marker per edge, the most important event wins. The tally counts every attempt.";
  const neverRan = shown.tally.nonvacuous + shown.tally.failures === 0;
  const coverSentence = cover
    ? `${cover.source} hits ${plural(shown.hits.length, "time", "times")}${shown.hits.length > 0 ? ` (${edgeList(shown.hits)})` : ""}.`
    : "";

  return (
    <div className="space-y-3">
      <div className="space-y-2 text-sm text-foreground">
        <p>{chosenInStep3 ? "You chose this rule in step 3. It never fails on the buggy counter:" : "Step 3 also offered this rule. It never fails on the buggy counter:"}</p>
        <code className="block whitespace-pre-wrap break-words rounded-lg bg-slate-950 px-3 py-2 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">
          {assertion.source}
        </code>
        <p className="text-muted-foreground">
          A log that reports 0 failures looks the same whether a check held or never ran. Count how each attempt ended instead (one attempt starts at every clk edge).
        </p>
      </div>
      <PredictionPrompt
        question={
          <>
            On the buggy counter, how many <strong>nonvacuous successes</strong> does it collect in this {edges}-edge run?
          </>
        }
        options={options}
      >
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Attempt tally, {edges} edges per run
              </caption>
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">How the attempt ended</th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">Buggy</th>
                  <th scope="col" className="py-1 text-right font-medium">Fixed</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <th scope="row" className="py-1.5 pr-2 font-medium text-foreground">Attempts (one per clk edge)</th>
                  <td className="py-1.5 pr-2 text-right font-mono">{b.attempts}</td>
                  <td className="py-1.5 text-right font-mono">{f.attempts}</td>
                </tr>
                {TALLY_ROWS.filter((row) => row.key !== "pending" || b.pending + f.pending > 0).map((row) => (
                  <tr key={row.key} className="border-b border-border/40">
                    <th scope="row" className="py-1.5 pr-2 font-normal text-foreground">
                      <span aria-hidden>{row.glyph} </span>
                      {row.label}
                    </th>
                    <td className={cn("py-1.5 pr-2 text-right font-mono", row.key === "nonvacuous" && b.nonvacuous === 0 && "font-bold text-rose-700 dark:text-rose-300")}>{b[row.key]}</td>
                    <td className="py-1.5 text-right font-mono">{f[row.key]}</td>
                  </tr>
                ))}
              </tbody>
              {cover ? (
                <tbody>
                  <tr className="border-t-2 border-border/70 align-top">
                    <th scope="row" className="py-1.5 pr-2 font-normal text-foreground">
                      <code className="block whitespace-pre-wrap break-words font-mono text-[11px] [font-variant-ligatures:none]">{cover.source}</code>
                      <span className="text-muted-foreground">hits (the companion cover on the antecedent)</span>
                    </th>
                    <td className={cn("py-1.5 pr-2 text-right font-mono", runs.buggy.hits.length === 0 && "font-bold text-rose-700 dark:text-rose-300")}>
                      {runs.buggy.hits.length}
                      {runs.buggy.hits.length > 0 ? <span className="block text-[10px] text-muted-foreground">{edgeList(runs.buggy.hits)}</span> : null}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {runs.fixed.hits.length}
                      {runs.fixed.hits.length > 0 ? <span className="block text-[10px] text-muted-foreground">{edgeList(runs.fixed.hits)}</span> : null}
                    </td>
                  </tr>
                </tbody>
              ) : null}
            </table>
          </div>

          <div className="space-y-1.5">
            <TallyBar label="Buggy" tally={b} />
            <TallyBar label="Fixed" tally={f} />
          </div>

          <SegmentedControl<CounterView>
            label="Show the run on"
            value={view}
            onChange={setView}
            options={[
              { value: "buggy", label: COUNTER_LABEL.buggy },
              { value: "fixed", label: COUNTER_LABEL.fixed },
            ]}
          />
          <CycleWaveform
            title={`${COUNTER_LABEL[view]}: attempts of the rule and hits of its cover`}
            caption={`x-axis: rising clk edges 0 to ${edges - 1}. The cover row is 1 at each edge where the cover property succeeds, and that column is shaded. Markers: ✓ nonvacuous success, ○ vacuous success: not a pass or a failure (§16.14.8), ⊘ disabled by rst, … antecedent matched, consequent checked at the next edge.${markerNote}`}
            signals={[
              ...counterSignals(shown.trace, false),
              { name: "cover", kind: "bit", values: Array.from({ length: edges }, (_, k) => (shown.hits.includes(k) ? 1 : 0)) },
            ]}
            edges={edges}
            cycleWidth={40}
            markers={shownMarkers}
            highlights={shown.hits.map((k) => ({ from: k, to: k, tone: "pass" as const, label: `cover hit at edge ${k}` }))}
          />
          <p aria-live="polite" className={cn("text-sm", neverRan ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
            <strong>{COUNTER_LABEL[view]}: </strong>
            {describeEvaluation(shown.evaluation)}. {coverSentence}{" "}
            {neverRan ? "The check never ran." : `The check ran ${plural(shown.tally.nonvacuous + shown.tally.failures, "time", "times")}.`}
          </p>
          <p className="text-sm text-muted-foreground">
            Read a quiet assertion together with its tally. 0 failures and 0 nonvacuous successes, beside a cover count of 0 on the antecedent, means the check never ran. Cover results are reported as counts (§16.14.3), so review the covers that never hit before you trust the silence.
          </p>
        </div>
      </PredictionPrompt>
    </div>
  );
}

export type FirstBugHuntPreset = "f1b-verification-mindset";

export interface FirstBugHuntGameProps {
  /** Lesson use. F1B "A test must be able to fail" is the only one, and the default. */
  preset?: FirstBugHuntPreset;
}

/** One entry per lesson use: which step-3 assertion step 4 tallies. */
const PRESETS: Record<FirstBugHuntPreset, { tallyAssertionId: string }> = {
  "f1b-verification-mindset": { tallyAssertionId: "wrap-vacuous" },
};

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
const FirstBugHuntGame = ({ preset = "f1b-verification-mindset" }: FirstBugHuntGameProps) => {
  const [round, setRound] = useState(0);
  const [edgePick, setEdgePick] = useState<number | null>(null);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixApplied, setFixApplied] = useState(false);
  const [assertionRevealed, setAssertionRevealed] = useState(false);
  const [assertionPick, setAssertionPick] = useState<string | null>(null);
  const markAssertionRevealed = useCallback(() => setAssertionRevealed(true), []);
  const tallyAssertion = ASSERTION_OPTIONS.find((a) => a.id === PRESETS[preset].tallyAssertionId) ?? ASSERTION_OPTIONS[1];

  const buggy = useMemo(() => simulateCounter(BUGGY_COUNTER, DEFAULT_STIMULUS), []);
  const fixed = useMemo(() => simulateCounter(FIXED_COUNTER, DEFAULT_STIMULUS), []);
  const fixedCmp = useMemo(() => compareWithSpec(fixed), [fixed]);
  const suspects = useMemo(() => lineSuspects(BUGGY_COUNTER), []);
  const grades = useMemo(
    () =>
      ASSERTION_OPTIONS.map((a) => {
        const grade = gradeAssertion(a, DEFAULT_STIMULUS);
        return { ...grade, outcome: bugCatchOutcome(grade, DEFAULT_STIMULUS) };
      }),
    [],
  );

  const edgeDiagnosis = edgePick === null ? null : diagnoseEdgePick(buggy, edgePick);
  const edgeFound = Boolean(edgeDiagnosis?.correct);
  const suspectInfo = suspects.find((s) => s.key === suspect);
  const lineFound = Boolean(suspectInfo?.culprit);

  const startOver = () => {
    setRound((r) => r + 1);
    setEdgePick(null);
    setSuspect(null);
    setFixApplied(false);
    setAssertionRevealed(false);
    setAssertionPick(null);
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
              onCommit={(id) => setAssertionPick(id)}
            >
              {({ committed }) => {
                const shownId = committed && ASSERTION_OPTIONS.some((a) => a.id === committed) ? committed : "catch";
                const shown = ASSERTION_OPTIONS.find((a) => a.id === shownId) ?? ASSERTION_OPTIONS[0];
                const evaluation = evaluateAssertion(shown, buggy);
                return (
                  <div className="space-y-3">
                    <RevealSignal onReveal={markAssertionRevealed} />
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
                              <td
                                data-testid={`bug-catch-${g.assertion.id}`}
                                className={cn("py-1.5 pr-2", g.catchesBug ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}
                              >
                                <span aria-hidden>{g.onBuggy.verdict === "fails" ? "✕ " : g.onBuggy.verdict === "vacuous" ? "○ " : "✓ "}</span>
                                {verdictBeforeTally(g.onBuggy)}
                                {bugCatchSuffix(g.outcome)}
                              </td>
                              <td className={cn("py-1.5", g.falseAlarm ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>
                                <span aria-hidden>{g.onFixed.verdict === "fails" ? "✕ " : "✓ "}</span>
                                {verdictBeforeTally(g.onFixed)}
                                {g.falseAlarm ? " (false alarm)" : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <CycleWaveform
                      title="Assertion attempts on the buggy counter"
                      caption="x-axis: rising clk edges. ✕ fail, ✓ pass, ○ vacuous success: not a pass or a failure (§16.14.8), ⊘ disabled by rst, … attempt still open. One marker per edge, the most important event wins."
                      signals={counterSignals(buggy, false)}
                      edges={DEFAULT_STIMULUS.edges}
                      cycleWidth={40}
                      markers={assertionMarkers(evaluation)}
                    />
                    <p className="text-sm text-foreground">
                      <span className="font-mono text-[12px] [font-variant-ligatures:none]">{shown.source}</span> on the buggy counter: {verdictBeforeTally(evaluation)}.
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

        {/* Step 4 */}
        {lineFound && assertionRevealed ? (
          <div className="space-y-2" data-testid="first-bug-hunt-tally">
            <StepHeading n={4} title="Did the check ever run? Tally the attempts" done={false} />
            <VacuityTally key={round} assertion={tallyAssertion} buggy={buggy} fixed={fixed} chosenInStep3={assertionPick === tallyAssertion.id} />
          </div>
        ) : lineFound ? (
          <p className="text-xs text-muted-foreground">Step 4 (did the check ever run?) unlocks when you lock in or reveal step 3.</p>
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
