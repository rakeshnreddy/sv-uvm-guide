"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { OutcomeGroups, type OutcomeGroup } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { IpcPanel, linesFor, ProcessLanes, ProcessLog, ProcessNarration } from "@/components/visuals/ForkJoinVisualizer";
import { WaitForGraph } from "@/components/visuals/ipc/WaitForGraph";
import {
  buildTriageRound,
  DEADLOCK_VERDICT_LABELS,
  deadlockFeedback,
  deadlockStory,
  describeWaitCycle,
  nextOrderSeed,
  KATA_STARTER,
  KATA_VERDICT_LABELS,
  kataEndState,
  kataFeedback,
  kataStory,
  QUIET_END_RULE,
  repairSummary,
  REPORT_LINE,
  runEvidence,
  waitingAlwaysAtEnd,
  shuffledSmells,
  SMELL_IDS,
  SMELLS,
  triageFeedback,
  waitForGraph,
  type AcquireOrder,
  type CircularWaitConfig,
  type DeadlockVerdict,
  type KataFixes,
  type KataStory,
  type StartDelay,
  type TriageRound,
} from "@/lib/sv-ipc-smell-scenarios";
import { prepareScenario, type ProcessExploration, type SimResult } from "@/lib/sv-process-model";
import { cn } from "@/lib/utils";

export type IpcSmellClinicMode = "triage" | "deadlock" | "kata";

export interface IpcSmellClinicProps {
  /** triage: name the five shapes from the log; deadlock: the wait-for graph; kata: repair the hand-off. */
  mode?: IpcSmellClinicMode;
  className?: string;
}

export const IPC_SMELL_ASSUMPTIONS = [
  "Every log, end time and blocked call comes from the process model (IEEE 1800-2023 §15.3 semaphores, §15.4 mailboxes, §15.5 events; delays in ns).",
  "Processes ready at the same time may run in any order (§4.7). The model runs each order of the ready processes, each process until it blocks or ends; §4.7 interleaving is not explored.",
  "A run whose live processes are all blocked ends quietly: simulation terminates when there is no further activity (§9.6.1). With a free-running clock the same bug hangs instead.",
  "A zero-delay loop is stopped after a statement budget. A simulator keeps executing that time step, or stops at its own iteration limit (tool-dependent).",
  "“Held by” edges are model bookkeeping: a semaphore does not track owners (§15.3).",
  "The model has no localparam: the shared count N appears as its value 3 with a comment, and mon sends $time (10, 20, 30) where the lesson sends i * 10.",
];

const sectionTitle = "text-label text-muted-foreground";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Compact log: time and text, wrapping at phone width. */
function RunLog({ result, label }: { result: SimResult; label: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-code-surface p-3 font-mono text-xs text-code-foreground [font-variant-ligatures:none]">
      <p className="mb-1 font-sans text-label text-code-muted">{label}</p>
      {result.log.length === 0 ? (
        <span className="text-code-muted">(nothing printed)</span>
      ) : (
        <ol className="space-y-0.5" aria-label={label}>
          {result.log.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-12 shrink-0 text-right text-slate-400">{l.time} ns</span>
              <span className="min-w-0 break-words">{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** End time, how the run ended, and the call each blocked process is stuck in. */
function EvidenceCard({ result, heading }: { result: SimResult; heading: string }) {
  const evidence = runEvidence(result);
  const waitingAlways = waitingAlwaysAtEnd(result);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className={sectionTitle}>{heading}</p>
      <dl className="grid gap-x-3 gap-y-1 grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">End time</dt>
        <dd className="font-mono text-foreground">t = {evidence.endTime} ns</dd>
        <dt className="text-muted-foreground">Ending</dt>
        <dd className="text-foreground">{evidence.ending === "time-stopped" ? "Time stopped advancing (zero-delay loop)" : evidence.ending === "quiet" ? "Ended quietly" : evidence.ending}</dd>
        <dt className="text-muted-foreground">Blocked</dt>
        <dd className="min-w-0">
          {evidence.blocked.length === 0 ? (
            <span className="text-foreground">nobody</span>
          ) : (
            <ul className="space-y-0.5">
              {evidence.blocked.map((b) => (
                <li key={b.label} className="font-mono text-xs text-foreground [font-variant-ligatures:none]">
                  {b.label} <span className="text-muted-foreground">in</span> {b.call}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">{evidence.endingText}</p>
      {waitingAlways.length ? (
        <p className="text-xs text-muted-foreground">
          {waitingAlways.map((b) => `${b.label} (an always procedure) waits in ${b.on} for its next trigger`).join("; ")}, which is normal at the end of a run.
        </p>
      ) : null}
    </div>
  );
}

function explorationGroups(exploration: ProcessExploration, title: (r: SimResult) => string, endState: (r: SimResult) => string, badge?: (r: SimResult) => string | undefined): OutcomeGroup[] {
  return exploration.outcomes.map((g, i) => ({
    id: `o${i}`,
    title: title(g.result),
    runCount: g.runs.length,
    lines: g.result.log.map((l) => ({ time: `t = ${l.time} ns`, text: `${l.label}: ${l.text}` })),
    endState: endState(g.result),
    badge: badge?.(g.result),
  }));
}

const blockedSummary = (r: SimResult) =>
  r.blockedAtEnd.length ? `${r.blockedAtEnd.map((b) => `${b.label} blocked in ${b.on.split(" — ")[0]}`).join("; ")}; ended at t = ${r.endTime} ns` : `nobody blocked; ended at t = ${r.endTime} ns`;

/* ========================================================================= */
/* Triage                                                                    */
/* ========================================================================= */

function TriageMode() {
  const [seed, setSeed] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [scores, setScores] = useState<Record<number, boolean>>({});
  const [fixed, setFixed] = useState<Record<number, boolean>>({});
  const order = useMemo(() => shuffledSmells(seed), [seed]);
  const smell = order[roundIndex];
  const round: TriageRound = useMemo(() => buildTriageRound(smell), [smell]);
  const roundKey = `${seed}-${roundIndex}`;
  const answered = Object.keys(scores).length;
  const correct = Object.values(scores).filter(Boolean).length;
  const info = SMELLS[smell];
  const lines = useMemo(() => linesFor(prepareScenario(round.scenario)), [round.scenario]);
  const fixedLines = useMemo(() => linesFor(prepareScenario(round.fixedScenario)), [round.fixedScenario]);
  const last = round.result.trace[round.result.trace.length - 1];
  const stuckKeys = last.procs.filter((p) => p.state === "blocked" && p.lineKey).map((p) => p.lineKey as string);
  const graph = waitForGraph(last);
  const semaphoreShape = smell === "leaked-key" || smell === "circular-wait";
  const others = round.exploration.runCount - round.ordersWithSmell;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">
          Round {roundIndex + 1} of {order.length}
        </p>
        <p className="text-sm text-muted-foreground">
          Score: {correct} of {answered} named
        </p>
      </div>

      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <EvidenceCard result={round.result} heading="What the run shows" />
        <RunLog result={round.result} label="Log (one legal order: declaration order)" />
      </div>
      <p className="text-xs text-muted-foreground">The code stays hidden until you name the shape. No line in this log is an error message.</p>

      <HintLadder hints={info.hints} resetKey={roundKey} />

      <PredictionPrompt
        question="Which failure shape is this?"
        resetKey={roundKey}
        options={SMELL_IDS.map((id) => ({ id, label: SMELLS[id].name, correct: id === smell, feedback: triageFeedback(id, round) }))}
        onCommit={(_, ok) => setScores((s) => ({ ...s, [roundIndex]: ok }))}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            <p className={sectionTitle}>{info.clause}</p>
            <p className="mt-1 text-foreground">{info.rule}</p>
            {round.evidence.ending === "quiet" ? <p className="mt-1 text-xs text-muted-foreground">{QUIET_END_RULE}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {others === 0
                ? `Every one of the ${plural(round.exploration.runCount, "order")} of the ready processes the model ran shows this shape.`
                : `${round.ordersWithSmell} of the ${plural(round.exploration.runCount, "order")} of the ready processes the model ran show this shape; in the other ${others} the scheduler happened to pick the order that works (§4.7). A bug that depends on the order is still a bug.`}
            </p>
          </div>
          <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <CodeTrace label="The code (where each blocked process is stuck)" lines={lines} contextKeys={stuckKeys} />
            <div className="min-w-0 space-y-3">
              <ProcessLanes result={round.result} index={round.result.trace.length - 1} />
              {semaphoreShape ? (
                <div className="space-y-1">
                  <WaitForGraph graph={graph} label={`Wait-for graph at the end, t = ${round.result.endTime} ns`} />
                  {graph.cycles.length ? <p className="text-xs text-muted-foreground">{describeWaitCycle(graph.cycles[0])}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] p-3 text-sm">
            <p className={sectionTitle}>Fix</p>
            <p className="mt-1 text-foreground">{info.fix}</p>
            {!fixed[roundIndex] ? (
              <button type="button" className={cn(buttonClass, "mt-2")} onClick={() => setFixed((f) => ({ ...f, [roundIndex]: true }))}>
                Apply fix and rerun
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium text-foreground" role="status">
                  {repairSummary(round)}
                </p>
                <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
                  <CodeTrace label="Fixed code" lines={fixedLines} />
                  <div className="min-w-0 space-y-3">
                    <EvidenceCard result={round.fixedResult} heading="The rerun" />
                    <RunLog result={round.fixedResult} label="Log after the fix" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PredictionPrompt>

      <div className="flex flex-wrap gap-2">
        {roundIndex < order.length - 1 ? (
          <button type="button" className={buttonClass} onClick={() => setRoundIndex((i) => i + 1)}>
            Next round
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setSeed((s) => nextOrderSeed(s));
              setRoundIndex(0);
              setScores({});
              setFixed({});
            }}
          >
            Play again in a new order
          </button>
        )}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Deadlock                                                                  */
/* ========================================================================= */

function DeadlockStepper({ story }: { story: ReturnType<typeof deadlockStory> }) {
  const { result } = story;
  const playback = usePlayback(result.trace.length, story.scenario.id);
  const index = Math.min(playback.index, result.trace.length - 1);
  const step = result.trace[index];
  const graph = useMemo(() => waitForGraph(step), [step]);
  const cycle = graph.multiProcessCycles[0];
  return (
    <div className="space-y-4">
      <ProcessNarration step={step} />
      <PlaybackControls playback={playback} stepCount={result.trace.length} stepNoun="Process step" describeStep={(i) => result.trace[i]?.what ?? ""} />
      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-2">
          <WaitForGraph graph={graph} label={`Wait-for graph at t = ${step.time} ns`} />
          <p role="status" aria-live="polite" className={cn("text-sm", cycle ? "font-semibold text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
            {cycle ? `Cycle closed at t = ${step.time} ns: ${describeWaitCycle(cycle)}` : `No cycle in the wait-for graph at t = ${step.time} ns.`}
          </p>
        </div>
        <IpcPanel step={step} />
      </div>
      <ProcessLanes result={result} index={index} />
      <ProcessLog step={step} />
    </div>
  );
}

function DeadlockMode() {
  const [order, setOrder] = useState<AcquireOrder>("opposite");
  const [delay, setDelay] = useState<StartDelay>(0);
  const config: CircularWaitConfig = { order, startDelay: delay };
  const story = useMemo(() => deadlockStory({ order, startDelay: delay }), [order, delay]);
  const lines = useMemo(() => linesFor(prepareScenario(story.scenario)), [story.scenario]);
  const key = story.scenario.id;
  const verdicts: DeadlockVerdict[] = ["hang", "finish", "depends"];
  const groups = explorationGroups(story.exploration, (r) => (r.blockedAtEnd.length ? "Both stay blocked" : "Both finish"), blockedSummary);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className={sectionTitle}>proc_b takes</p>
          <SegmentedControl
            label="proc_b acquisition order"
            mono
            value={order}
            onChange={setOrder}
            options={[
              { value: "opposite", label: "s2, then s1" },
              { value: "same", label: "s1, then s2" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <p className={sectionTitle}>proc_b starts at</p>
          <SegmentedControl
            label="proc_b start delay"
            value={String(delay) as "0" | "10"}
            onChange={(value) => setDelay(Number(value) as StartDelay)}
            options={[
              { value: "0", label: "0 ns" },
              { value: "10", label: "10 ns" },
            ]}
          />
        </div>
      </div>
      <CodeTrace label={`Code: proc_b takes ${config.order === "opposite" ? "s2 then s1" : "s1 then s2"}, starting at ${config.startDelay} ns`} lines={lines} />
      <PredictionPrompt
        question="What does this run do?"
        resetKey={key}
        options={verdicts.map((id) => ({ id, label: DEADLOCK_VERDICT_LABELS[id], correct: id === story.verdict, feedback: deadlockFeedback(id, story) }))}
      >
        <div className="space-y-4">
          <DeadlockStepper key={key} story={story} />
          <OutcomeGroups groups={groups} runCount={story.exploration.runCount} capped={story.exploration.capped} label="Outcomes across every order of the ready processes" />
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ========================================================================= */
/* Kata                                                                      */
/* ========================================================================= */

function kataGroups(story: KataStory): OutcomeGroup[] {
  return story.groups.map((g) => ({
    id: g.id,
    title: g.reportPrinted ? `"${REPORT_LINE}" printed` : `"${REPORT_LINE}" not printed`,
    runCount: g.runCount,
    lines: g.result.log.map((l) => ({ time: `t = ${l.time} ns`, text: l.text })),
    endState: kataEndState(g),
    badge: g.smells.length ? g.smells.map((s) => SMELLS[s].name).join(" + ") : "✓ no smell left",
  }));
}

function SmellStatus({ story }: { story: KataStory }) {
  const total = story.exploration.runCount;
  const rows: { id: "starved-consumer" | "missed-trigger"; detail: string }[] = [
    {
      id: "starved-consumer",
      detail: (() => {
        const g = story.groups.find((x) => x.chkBlocked);
        return g ? `chk blocked in get() #${g.chkGets + 1} after ${plural(g.chkGets, "value")} (§15.4.5)` : "chk gets exactly the values mon sends";
      })(),
    },
    {
      id: "missed-trigger",
      detail: story.smellOrders["missed-trigger"] ? "report left waiting in @(mon_done): the trigger ran first (§15.5.2)" : "report is already waiting when mon triggers mon_done",
    },
  ];
  return (
    <ul className="space-y-1 text-sm" aria-label="Smells in this version">
      {rows.map((r) => {
        const n = story.smellOrders[r.id];
        return (
          <li key={r.id} className={cn("rounded-lg border px-3 py-2", n ? "border-rose-500/50 bg-rose-500/[0.06]" : "border-emerald-500/50 bg-emerald-500/[0.06]")}>
            <span className="font-semibold text-foreground">
              <span aria-hidden>{n ? "✕ " : "✓ "}</span>
              {SMELLS[r.id].name}: {n ? `present in ${n} of ${plural(total, "order")}` : `gone in all ${plural(total, "order")}`}
            </span>
            <span className="block text-xs text-muted-foreground">{r.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}

function KataMode() {
  const starter = useMemo(() => kataStory(KATA_STARTER), []);
  const [fixes, setFixes] = useState<KataFixes>(KATA_STARTER);
  const story = useMemo(() => kataStory(fixes), [fixes]);
  const starterLines = useMemo(() => linesFor(prepareScenario(starter.scenario)), [starter.scenario]);
  const lines = useMemo(() => linesFor(prepareScenario(story.scenario)), [story.scenario]);
  const verdicts: KataStory["reportVerdict"][] = ["always", "never", "depends"];
  const clean = story.smellOrders["starved-consumer"] === 0 && story.smellOrders["missed-trigger"] === 0;
  const toggles: { key: keyof KataFixes; label: string }[] = [
    { key: "sharedN", label: "N shared: chk expects exactly the 3 values mon sends" },
    { key: "waitFromZero", label: "@(mon_done) waited from 0 ns" },
  ];

  return (
    <div className="space-y-4">
      <CodeTrace label="Starter bench (as in the kata, run in the model)" lines={starterLines} />
      <PredictionPrompt
        question={<>At t = 30 ns, does &ldquo;{REPORT_LINE}&rdquo; print?</>}
        options={verdicts.map((id) => ({ id, label: KATA_VERDICT_LABELS[id], correct: id === starter.reportVerdict, feedback: kataFeedback(id, starter) }))}
      >
        <div className="space-y-5">
          <OutcomeGroups groups={kataGroups(starter)} runCount={starter.exploration.runCount} capped={starter.exploration.capped} label="Starter outcomes across every order of the ready processes" />

          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <p className={sectionTitle}>Repair it: each fix on its own</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">Fixes</legend>
              {toggles.map((t) => (
                <label key={t.key} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <input type="checkbox" className="size-5 shrink-0 accent-cyan-600" checked={fixes[t.key]} onChange={(e) => setFixes((f) => ({ ...f, [t.key]: e.target.checked }))} />
                  <span>{t.label}</span>
                </label>
              ))}
            </fieldset>
            <div role="status" aria-live="polite" className="space-y-2">
              <SmellStatus story={story} />
              {clean ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Both smells are gone: every one of the {plural(story.exploration.runCount, "order")} prints all {story.groups[0]?.result.log.length ?? 0} lines and leaves nobody blocked.
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <CodeTrace label="Your version" lines={lines} />
            <OutcomeGroups groups={kataGroups(story)} runCount={story.exploration.runCount} capped={story.exploration.capped} label="Your version across every order of the ready processes" />
          </div>
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ========================================================================= */

const FRAME: Record<IpcSmellClinicMode, { label: string; eyebrow: string; title: string; summary: string }> = {
  triage: {
    label: "IPC smell clinic: name the failure shape from the log",
    eyebrow: "Triage",
    title: "Five silent failures",
    summary: "Each round shows only what a run leaves behind: its end time, how it ended, and the call each blocked process is stuck in. None of them prints an error. Name the shape, then see the code and the fix.",
  },
  deadlock: {
    label: "IPC smell clinic: circular wait on a wait-for graph",
    eyebrow: "Experiment",
    title: "When opposite orders deadlock",
    summary: "Change the order in which proc_b takes the two keys, and when it starts. Predict, then step the wait-for graph and watch whether its cycle closes.",
  },
  kata: {
    label: "IPC smell clinic: repair the hand-off kata",
    eyebrow: "Kata",
    title: "Two smells, two fixes",
    summary: "The kata's starter, run in the model across every order of the ready processes. Predict the report line, then switch each fix on and watch its smell disappear on its own.",
  },
};

export default function IpcSmellClinic({ mode = "triage", className }: IpcSmellClinicProps) {
  const frame = FRAME[mode];
  return (
    <VisualFrame label={frame.label} eyebrow={frame.eyebrow} title={frame.title} summary={frame.summary} fidelity="model" assumptions={IPC_SMELL_ASSUMPTIONS} className={className}>
      {mode === "deadlock" ? <DeadlockMode /> : mode === "kata" ? <KataMode /> : <TriageMode />}
    </VisualFrame>
  );
}

