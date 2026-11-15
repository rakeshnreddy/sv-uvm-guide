"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  eventRaceScenario,
  exploreProcessOrders,
  forkLoopScenario,
  formatVal,
  gradeTimeoutBench,
  joinVariantsScenario,
  prepareScenario,
  processLanes,
  simulateProcesses,
  timeoutBenchScenario,
  waitForkScenario,
  type CaptureVariant,
  type EventVariant,
  type JoinVariant,
  type PreparedScenario,
  type ProcessExploration,
  type ProcessScenario,
  type ProcessScenarioId,
  type SimResult,
  type StepKind,
  type StepRegion,
  type ThreadState,
  type TimeoutFix,
  type TraceStep,
} from "@/lib/sv-process-model";
import {
  CLEANUP_VARIANTS,
  FINISHED_CHILD_TIMES,
  WRAPPER_VARIANTS,
  checkpointAnswer,
  checkpointQuestion,
  findTreeCheckpoints,
  finishedChildScenario,
  gradeTreePrediction,
  isTreeScenarioId,
  nodeOutcome,
  processTree,
  wrapperScenario,
  type CleanupVariant,
  type ForkJoinScenarioId,
  type NodeVerdict,
  type TreeCheckpoint,
  type WrapperVariant,
} from "@/lib/sv-process-tree-scenarios";
import { cn } from "@/lib/utils";

import ProcessTreeView, { VERDICT_TEXT, type TreeMark } from "./fork-join/ProcessTreeView";

/* ========================================================================= */
/* Shared view pieces (also used by ProceduralBlocksSimulator and             */
/* MailboxSemaphoreGame). Everything renders a model TraceStep.               */
/* ========================================================================= */

export const PROCESS_MODEL_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §9.2 (procedures), §9.3.2 (fork-join), §9.6 (wait fork, disable, disable fork) and §15.3–§15.5 (semaphores, mailboxes, events). Delays are in ns.",
  "When several processes are ready at the same time, the standard leaves their order open (§4.7). The model runs them in declaration order unless you pick another order.",
  "A running process keeps running until it blocks or ends. Real simulators may interleave more, which only adds possible orders.",
  "Mailbox and semaphore waiters wake first-in first-out (§15.3.3, §15.4.5). A woken get/put completes at once, so no later caller can overtake it.",
  "Not modelled: #0 and the Inactive region, intra-assignment delays, process::kill/suspend, typed-mailbox mismatches.",
];

const stateMeta: Record<ThreadState, { glyph: string; text: string; className: string }> = {
  pending: { glyph: "◌", text: "not started", className: "text-muted-foreground" },
  ready: { glyph: "●", text: "ready", className: "text-sky-700 dark:text-sky-300" },
  running: { glyph: "▶", text: "running", className: "text-cyan-700 dark:text-cyan-300" },
  blocked: { glyph: "⏸", text: "blocked", className: "text-amber-700 dark:text-amber-300" },
  done: { glyph: "✓", text: "finished", className: "text-emerald-700 dark:text-emerald-300" },
  killed: { glyph: "✕", text: "killed", className: "text-rose-700 dark:text-rose-300" },
};

const kindLabels: Record<StepKind, string> = {
  start: "Start",
  exec: "Executes",
  block: "Blocks",
  wake: "Wakes",
  release: "Children start",
  kill: "Disable",
  unwind: "Disable",
  print: "Output",
  nba: "NBA update",
  advance: "Time advances",
  finish: "$finish",
  final: "final",
  end: "Result",
  loop: "Loop",
};

const regionLabels: Record<StepRegion, string> = {
  active: "Active region",
  nba: "NBA region",
  postponed: "Postponed region",
  advance: "Time advance",
  final: "End of simulation · final",
  end: "End of simulation",
};

export function linesFor(prepared: PreparedScenario): CodeTraceLine[] {
  return prepared.source.map((l) => ({ text: l.text, key: l.key, owner: l.owner }));
}

const alive = (state: ThreadState) => state !== "done" && state !== "killed";

/** What happened, why, where and when — for one model step. */
export function ProcessNarration({ step }: { step: TraceStep }) {
  return (
    <div aria-live="polite" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-semibold",
            step.kind === "kill" ? "bg-rose-500/15 text-rose-800 dark:text-rose-200" : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
          )}
        >
          {kindLabels[step.kind]}
        </span>
        <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">{regionLabels[step.region]}</span>
        {step.choice ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200" title="The standard leaves this order open">
            Scheduler choice: {step.choice.picked} of {step.choice.options.join(", ")}
          </span>
        ) : null}
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

/** Every process with its state and what it is waiting for. */
export function ThreadTable({ step, lines }: { step: TraceStep; lines: CodeTraceLine[] }) {
  const lineText = (key?: string) => lines.find((l) => l.key === key)?.text.trim();
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Process states at t = {step.time} ns</caption>
        <thead className="bg-muted/40 text-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Process
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              State
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Waiting on / at
            </th>
          </tr>
        </thead>
        <tbody>
          {step.procs.map((p) => {
            const meta = stateMeta[p.state];
            const where = p.blockedOn ?? (alive(p.state) ? lineText(p.lineKey) : undefined);
            return (
              <tr key={p.pid} className={cn("border-t border-border/50", step.pid === p.pid && "bg-cyan-500/10")}>
                <th scope="row" className="whitespace-nowrap px-2 py-1.5 font-mono font-medium text-foreground [font-variant-ligatures:none]">
                  <span style={{ paddingLeft: `${p.depth * 10}px` }}>
                    {p.depth > 0 ? <span aria-hidden className="mr-1 text-muted-foreground">└</span> : null}
                    {p.label}
                  </span>
                </th>
                <td className={cn("whitespace-nowrap px-2 py-1.5 font-medium", meta.className)}>
                  <span aria-hidden>{meta.glyph} </span>
                  {meta.text}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">{where ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const raw = max / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const stepSize = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += stepSize) ticks.push(Math.round(t));
  return ticks;
}

/** One lane per process over simulation time; lanes grow as playback advances. */
export function ProcessLanes({ result, index, className }: { result: SimResult; index: number; className?: string }) {
  const lanes = useMemo(() => processLanes(result, index), [result, index]);
  const step = result.trace[index];
  const maxTime = Math.max(result.endTime, 1);
  const x0 = 132;
  const x1 = 610;
  const rowH = 26;
  const top = 26;
  const xOf = (t: number) => x0 + (t / maxTime) * (x1 - x0);
  const height = top + lanes.length * rowH + 10;
  const stateOf = (pid: number) => step.procs.find((p) => p.pid === pid)?.state ?? "pending";
  const summary = lanes
    .map((l) => {
      const state = stateOf(l.pid);
      return `${l.label} ${stateMeta[state].text}${state === "done" || state === "killed" ? ` at t = ${l.end} ns` : ""}`;
    })
    .join("; ");
  return (
    <figure className={cn("rounded-xl border border-border bg-card p-2", className)}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 620 ${height}`}
          role="img"
          aria-label={`Process lanes up to t = ${step.time} ns: ${summary}.`}
          className="min-w-[300px] w-full text-foreground"
        >
          {niceTicks(maxTime).map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={top - 6} y2={height - 6} className="stroke-border" strokeWidth={1} />
              <text x={xOf(t)} y={top - 10} fontSize={12} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                {t}
              </text>
            </g>
          ))}
          <text x={8} y={top - 10} fontSize={12} fill="currentColor" fillOpacity={0.6}>
            t (ns) →
          </text>
          {lanes.map((lane, i) => {
            const y = top + i * rowH + rowH / 2;
            const state = stateOf(lane.pid);
            const started = lane.started;
            const barEnd = Math.max(lane.end, started ?? lane.end);
            const barClass =
              state === "killed" ? "fill-rose-500/70" : state === "done" ? "fill-emerald-500/60" : state === "blocked" ? "fill-amber-500/60" : "fill-cyan-500/70";
            const focused = step.pid === lane.pid;
            return (
              <g key={lane.pid}>
                <text
                  x={8 + lane.depth * 9}
                  y={y + 4}
                  fontSize={12}
                  fill="currentColor"
                  fontWeight={focused ? 600 : 400}
                  className="font-mono [font-variant-ligatures:none]"
                >
                  {lane.label.length > 15 ? `${lane.label.slice(0, 14)}…` : lane.label}
                </text>
                {started === undefined ? (
                  <line x1={xOf(lane.created)} x2={xOf(lane.end)} y1={y} y2={y} strokeDasharray="3 3" className="stroke-muted-foreground" strokeWidth={2} />
                ) : (
                  <>
                    {started > lane.created ? (
                      <line x1={xOf(lane.created)} x2={xOf(started)} y1={y} y2={y} strokeDasharray="3 3" className="stroke-muted-foreground" strokeWidth={2} />
                    ) : null}
                    <rect x={xOf(started)} y={y - 4} width={Math.max(3, xOf(barEnd) - xOf(started))} height={8} rx={3} className={barClass} />
                  </>
                )}
                {lane.marks
                  .filter((m) => m.kind === "print")
                  .map((m, k) => (
                    <circle key={k} cx={xOf(m.time)} cy={y} r={3} className="fill-background stroke-cyan-600 dark:stroke-cyan-300" strokeWidth={1.5} />
                  ))}
                {state === "done" ? (
                  <text x={xOf(lane.end) + 5} y={y + 4} fontSize={12} className="fill-emerald-700 dark:fill-emerald-300">
                    ✓
                  </text>
                ) : state === "killed" ? (
                  <text x={xOf(lane.end) + 5} y={y + 4} fontSize={12} className="fill-rose-700 dark:fill-rose-300">
                    ✕
                  </text>
                ) : state === "blocked" ? (
                  <text x={xOf(lane.end) + 5} y={y + 4} fontSize={12} className="fill-amber-700 dark:fill-amber-300">
                    ⏸
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={xOf(step.time)} x2={xOf(step.time)} y1={top - 4} y2={height - 4} strokeDasharray="4 3" className="stroke-cyan-600 dark:stroke-cyan-300" strokeWidth={1.5} />
        </svg>
      </div>
      <figcaption className="px-1 pt-1 text-xs text-muted-foreground">
        Horizontal axis: simulation time (ns). Dashed segment ◌ = spawned but not started; bar = alive (amber while blocked); ● = printed; ✓ finished; ✕ killed; ⏸
        still waiting. The dashed cursor marks the current step.
      </figcaption>
    </figure>
  );
}

/** $display / $strobe output so far. */
export function ProcessLog({ step, label = "Simulation output" }: { step: TraceStep; label?: string }) {
  const newest = step.kind === "print" ? step.log.length - 1 : -1;
  return (
    <div className="rounded-lg border border-border/70 bg-code-surface p-3 font-mono text-xs text-code-foreground [font-variant-ligatures:none]">
      <p className="mb-1 font-sans text-label text-code-muted">{label}</p>
      {step.log.length === 0 ? (
        <span className="text-code-muted">(no output yet)</span>
      ) : (
        <ol className="space-y-0.5">
          {step.log.map((l, i) => (
            <li key={i} className={cn("flex gap-3", i === newest && "text-cyan-200")}>
              <span className="w-14 shrink-0 text-right text-code-muted">{l.time} ns</span>
              <span className="w-20 shrink-0 truncate text-code-muted">{l.label}</span>
              <span>
                {l.text}
                {l.region === "postponed" ? <span className="text-code-muted"> ($strobe)</span> : l.region === "final" ? <span className="text-code-muted"> (final)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Mailbox slots, semaphore keys and their FIFO waiter queues. */
export function IpcPanel({ step }: { step: TraceStep }) {
  const mailboxes = Object.entries(step.mailboxes);
  const semaphores = Object.entries(step.semaphores);
  if (mailboxes.length === 0 && semaphores.length === 0) return null;
  return (
    <div className="space-y-3">
      {semaphores.map(([name, s]) => (
        <div key={name} className="rounded-xl border border-border/70 p-3 text-sm">
          <p className="font-mono text-xs font-semibold text-foreground [font-variant-ligatures:none]">
            semaphore {name} · new({s.initial})
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1" aria-label={`${s.keys} key${s.keys === 1 ? "" : "s"} free`}>
            <span className="text-xs text-muted-foreground">Keys free:</span>
            {s.keys === 0 ? <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">none</span> : null}
            {Array.from({ length: Math.min(s.keys, 8) }).map((_, i) => (
              <span key={i} aria-hidden className="rounded border border-amber-500/60 bg-amber-500/15 px-1 text-xs">
                ⚿
              </span>
            ))}
            {s.keys > 8 ? <span className="text-xs">+{s.keys - 8}</span> : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Waiting (FIFO): {s.waiters.length ? s.waiters.map((w, i) => `${i + 1}. ${w.label} needs ${w.keys}`).join(" · ") : "nobody"}
          </p>
          {Object.keys(s.held).length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Holding (model bookkeeping — SV does not track this): {Object.entries(s.held).map(([who, n]) => `${who} ${n}`).join(", ")}
            </p>
          ) : null}
        </div>
      ))}
      {mailboxes.map(([name, m]) => {
        const slots = m.bound === 0 ? Math.max(m.items.length, 1) : m.bound;
        return (
          <div key={name} className="rounded-xl border border-border/70 p-3 text-sm">
            <p className="font-mono text-xs font-semibold text-foreground [font-variant-ligatures:none]">
              mailbox {name} · new({m.bound === 0 ? "" : m.bound}) {m.bound === 0 ? "— unbounded" : ""}
            </p>
            <ol className="mt-2 flex flex-wrap gap-1" aria-label={`${m.items.length} message${m.items.length === 1 ? "" : "s"} queued, oldest first`}>
              {Array.from({ length: slots }).map((_, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded border px-1 font-mono text-xs",
                    i < m.items.length ? "border-indigo-400/70 bg-indigo-500/15 text-foreground" : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  {i < m.items.length ? formatVal(m.items[i]) : "·"}
                </li>
              ))}
            </ol>
            <p className="mt-1 text-xs text-muted-foreground">Oldest message on the left. {m.bound > 0 && m.items.length >= m.bound ? "Full." : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Blocked in get/peek: {m.getWaiters.length ? m.getWaiters.map((w, i) => `${i + 1}. ${w.label}${w.peek ? " (peek)" : ""}`).join(" · ") : "nobody"}
            </p>
            <p className="text-xs text-muted-foreground">
              Blocked in put: {m.putWaiters.length ? m.putWaiters.map((w, i) => `${i + 1}. ${w.label} (${formatVal(w.value)})`).join(" · ") : "nobody"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface ProcessTraceViewProps {
  prepared: PreparedScenario;
  result: SimResult;
  /** Playback resets whenever this key changes. */
  resetKey: string;
  /** Global variables to show as value chips. */
  watch?: string[];
  codeLabel?: string;
  /**
   * Draw the process tree beside the lanes, and pause playback before every
   * disable fork, wait fork and disable <name> so the learner can predict which
   * processes it reaches.
   */
  treeView?: boolean;
  /** Tree view only: a "what to notice" line, shown once every pause has been answered (it would give answers away). */
  notice?: string;
}

type CheckpointAnswer = { picked: number[]; skipped: boolean };

function marksFor(cp: TreeCheckpoint): Record<number, TreeMark> {
  const marks: Record<number, TreeMark> = {};
  cp.reached.forEach((pid) => {
    marks[pid] = cp.kind === "wait-fork" ? "waited" : cp.unwound.includes(pid) ? "forced-out" : "killed";
  });
  return marks;
}

const verdictClass: Record<NodeVerdict, string> = {
  hit: "text-success",
  missed: "text-danger",
  extra: "text-danger",
  clear: "text-muted-foreground",
};

const verdictGlyph: Record<NodeVerdict, string> = { hit: "✓", missed: "✕", extra: "✕", clear: "·" };

/** The pause before a process-control statement: pick the processes, then lock in. */
function TreeCheckpointPrompt({
  checkpoint,
  lineText,
  picked,
  onLock,
  onSkip,
}: {
  checkpoint: TreeCheckpoint;
  lineText?: string;
  picked: number[];
  onLock: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" role="group" aria-label="Predict before the statement runs">
      <p className="text-sm font-semibold text-foreground">
        <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-label text-foreground">Predict</span>
        Playback paused before <code className="font-mono [font-variant-ligatures:none]">{checkpoint.statement}</code>
      </p>
      <p className="mt-2 text-sm text-foreground">{checkpointQuestion(checkpoint)}</p>
      {lineText ? <p className="mt-1 font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">Next line: {lineText}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        Your prediction: {picked.length === 0 ? "no process" : `${picked.length} process${picked.length === 1 ? "" : "es"}`}. Tap the processes in the tree or with the buttons under it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onLock}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Lock in prediction
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex min-h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Reveal without predicting
        </button>
      </div>
    </div>
  );
}

/** The verdict line of the reveal, shared by the feedback heading and the live announcement. */
function feedbackHeadline(checkpoint: TreeCheckpoint, answer: CheckpointAnswer): { lead: string; text: string } {
  if (answer.skipped) return { lead: "Answer.", text: checkpointAnswer(checkpoint) };
  const grade = gradeTreePrediction(checkpoint, answer.picked);
  return { lead: grade.correct ? "Correct." : "Not quite.", text: grade.summary.replace(/^(Correct|Not quite)\. /, "") };
}

/**
 * After the reveal: the model's answer, then why each process was or was not
 * reached. The verdict is announced by ProcessTraceView's persistent live
 * region; when the learner has just locked in, focus moves to the verdict.
 */
function TreeCheckpointFeedback({
  checkpoint,
  answer,
  focusOnMount = false,
  onFocused,
}: {
  checkpoint: TreeCheckpoint;
  answer: CheckpointAnswer;
  focusOnMount?: boolean;
  onFocused?: () => void;
}) {
  const grade = gradeTreePrediction(checkpoint, answer.picked);
  const headline = feedbackHeadline(checkpoint, answer);
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    headingRef.current?.focus();
    onFocused?.();
  }, [focusOnMount, onFocused]);
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm" role="group" aria-label="Your prediction, revealed">
      <p ref={headingRef} tabIndex={-1} className={cn("rounded outline-none", answer.skipped ? "text-foreground" : grade.correct ? "text-success" : "text-danger")}>
        <strong>{headline.lead} </strong>
        {headline.text}
      </p>
      <ul className="mt-3 space-y-2">
        {grade.nodes.map((n) => {
          const verdict: NodeVerdict = answer.skipped ? (n.reached ? "hit" : "clear") : n.verdict;
          return (
            <li key={n.pid} className="flex gap-2">
              <span aria-hidden className={cn("w-4 shrink-0 text-center font-semibold", verdictClass[verdict])}>
                {verdictGlyph[verdict]}
              </span>
              <span className="min-w-0 text-muted-foreground">
                <span className="font-mono font-medium text-foreground [font-variant-ligatures:none]">{n.label}</span>
                <span className="text-foreground">
                  {" "}
                  · {nodeOutcome(checkpoint, n.pid)}
                  {answer.skipped ? "" : `, ${VERDICT_TEXT[n.verdict]}`}.
                </span>{" "}
                {n.why}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Synchronised code, narration, thread table, lanes, IPC state and output for one model run. */
export function ProcessTraceView({ prepared, result, resetKey, watch, codeLabel = "Code under simulation", treeView = false, notice }: ProcessTraceViewProps) {
  const playback = usePlayback(result.trace.length, resetKey);
  const checkpoints = useMemo(() => (treeView ? findTreeCheckpoints(result, prepared) : []), [treeView, result, prepared]);
  const [answers, setAnswers] = useState<Record<string, CheckpointAnswer>>({});
  const [picked, setPicked] = useState<number[]>([]);
  // The verdict to announce (one live region stays mounted across the prompt-to-feedback swap),
  // and the checkpoint whose feedback should take focus once, right after lock-in.
  const [announcement, setAnnouncement] = useState("");
  const [focusFeedbackId, setFocusFeedbackId] = useState<string | undefined>();
  const clearFeedbackFocus = React.useCallback(() => setFocusFeedbackId(undefined), []);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setAnswers({});
    setPicked([]);
    setAnnouncement("");
    setFocusFeedbackId(undefined);
  }

  // The first unanswered checkpoint: playback may not pass the step before it.
  const gate = checkpoints.find((cp) => !answers[cp.id]);
  const limit = gate ? gate.stepIndex - 1 : result.trace.length - 1;
  const index = Math.min(playback.index, result.trace.length - 1, limit);
  const { seek } = playback;
  useEffect(() => {
    if (gate && playback.index > limit) seek(limit);
  }, [gate, limit, playback.index, seek]);

  const gated = {
    ...playback,
    index,
    isLast: playback.isLast || index >= limit,
    stepForward: () => {
      if (index < limit) playback.stepForward();
    },
    seek: (target: number) => seek(Math.min(target, limit)),
  };

  const step = result.trace[index];
  const previous = index > 0 ? result.trace[index - 1] : undefined;
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const contextKeys = step.procs.filter((p) => alive(p.state) && p.lineKey).map((p) => p.lineKey as string);
  // The checkpoint the current step belongs to: the latest one whose pause point has been reached.
  const focus = [...checkpoints].reverse().find((cp) => cp.stepIndex - 1 <= index);
  const focusAnswer = focus ? answers[focus.id] : undefined;
  const predicting = focus !== undefined && focus === gate && index === limit ? focus : undefined;

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
              "rounded-full border px-1.5 font-sans text-xs leading-4",
              p.state === "running" ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-code-border text-code-muted",
            )}
          >
            <span aria-hidden>{stateMeta[p.state].glyph} </span>
            {p.label}
            <span className="sr-only"> is {stateMeta[p.state].text} here</span>
          </span>
        ))}
      </span>
    );
  };

  const lock = (skipped: boolean) => {
    if (!gate) return;
    const answer = { picked: skipped ? [] : picked, skipped };
    const headline = feedbackHeadline(gate, answer);
    setAnswers((a) => ({ ...a, [gate.id]: answer }));
    setPicked([]);
    setAnnouncement(`${headline.lead} ${headline.text}`);
    setFocusFeedbackId(gate.id);
  };

  const treePanel = treeView ? (
    <div className="min-w-0 space-y-3">
      <ProcessTreeView
        tree={processTree(step)}
        time={step.time}
        currentPid={step.pid}
        callerPid={focus?.callerPid}
        callerNote={focus ? `the caller, runs ${focus.statement}` : undefined}
        selectable={predicting?.candidates}
        selected={picked}
        onToggle={(pid) => setPicked((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : [...p, pid]))}
        marks={focus && focusAnswer ? marksFor(focus) : undefined}
        marksCaption={focus && focusAnswer ? `Marks: what ${focus.statement} reached at t = ${focus.time} ns.` : undefined}
      />
      {predicting ? (
        <TreeCheckpointPrompt
          checkpoint={predicting}
          lineText={lines.find((l) => l.key === predicting.lineKey)?.text.trim()}
          picked={picked}
          onLock={() => lock(false)}
          onSkip={() => lock(true)}
        />
      ) : focus && focusAnswer ? (
        <TreeCheckpointFeedback
          key={focus.id}
          checkpoint={focus}
          answer={focusAnswer}
          focusOnMount={focusFeedbackId === focus.id}
          onFocused={clearFeedbackFocus}
        />
      ) : null}
      <p className="sr-only" aria-live="polite" data-testid="tree-verdict-live">
        {announcement}
      </p>
      {notice && !gate && checkpoints.length > 0 ? (
        <p className="text-sm text-foreground">
          <strong>What to notice: </strong>
          {notice}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <ProcessNarration step={step} />
      <PlaybackControls
        playback={gated}
        stepCount={result.trace.length}
        stepNoun="Process step"
        describeStep={(i) => (i > limit ? "paused for your prediction" : (result.trace[i]?.what ?? ""))}
      />
      {treePanel ? (
        // Stacked at every width: side by side, a lesson column squeezes both SVGs below the 12 px text minimum.
        <div className="space-y-4">
          {treePanel}
          <ProcessLanes result={result} index={index} className="min-w-0" />
        </div>
      ) : null}
      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <CodeTrace label={codeLabel} lines={lines} activeKey={step.lineKey} contextKeys={contextKeys} renderLineControl={renderLineControl} />
        <div className="min-w-0 space-y-3">
          <ThreadTable step={step} lines={lines} />
          {watch && watch.length > 0 ? (
            <div>
              <p className="mb-2 text-label text-muted-foreground">Values after this step</p>
              <div className="flex flex-wrap gap-2">
                {watch.map((name) => (
                  <ValueChip key={name} name={name} value={step.vars[name]} changed={previous !== undefined && previous.vars[name] !== step.vars[name]} />
                ))}
              </div>
            </div>
          ) : null}
          <IpcPanel step={step} />
        </div>
      </div>
      {treePanel ? null : <ProcessLanes result={result} index={index} />}
      <ProcessLog step={step} />
    </div>
  );
}

/* ========================================================================= */
/* ForkJoinVisualizer                                                        */
/* ========================================================================= */

interface PredictOption {
  id: string;
  label: string;
  feedback: string;
  matches: boolean;
}

interface ExploreScenario {
  id: ForkJoinScenarioId;
  label: string;
  summary: string;
  notice: string;
  variants?: { value: string; label: string }[];
  build: (variant: string) => ProcessScenario;
  /** Explore every legal order (used where order changes the outcome). */
  explore?: boolean;
  question: string;
  options: (variant: string, result: SimResult, exploration?: ProcessExploration) => PredictOption[];
}

const firstKill = (r: SimResult) => r.trace.find((s) => s.kind === "kill");
const timeOf = (r: SimResult, text: string) => r.log.find((l) => l.text === text)?.time;

const exploreScenarios: ExploreScenario[] = [
  {
    id: "join-variants",
    label: "join · join_any · join_none",
    summary: "The parent forks A (#10), B (#30) and C (#20), then prints “parent continues”.",
    notice: "Watch when the parent's lane resumes, and when A, B and C actually start.",
    variants: [
      { value: "join", label: "join" },
      { value: "join_any", label: "join_any" },
      { value: "join_none", label: "join_none" },
    ],
    build: (variant) => joinVariantsScenario(variant as JoinVariant),
    question: "At what time does the parent print “parent continues”?",
    options: (variant, r) => {
      const t = timeOf(r, "parent continues");
      return [
        {
          id: "0",
          label: "t = 0 ns",
          matches: t === 0,
          feedback:
            variant === "join_none"
              ? "Right: join_none never waits. The parent even prints before A, B and C start — spawned processes run only once the parent blocks or ends (§9.3.2)."
              : `That is join_none. With ${variant} the parent waits at the ${variant} keyword.`,
        },
        {
          id: "10",
          label: "t = 10 ns",
          matches: t === 10,
          feedback:
            variant === "join_any"
              ? "Right: join_any resumes the parent when the first child (A, #10) ends. B and C keep running in the background."
              : "10 ns is when the first child (A) ends — that is join_any's rule.",
        },
        {
          id: "20",
          label: "t = 20 ns",
          matches: t === 20,
          feedback: "20 ns is C's delay, the last statement in the fork. Statement order inside fork does not matter; only the delays and the join keyword do.",
        },
        {
          id: "30",
          label: "t = 30 ns",
          matches: t === 30,
          feedback:
            variant === "join"
              ? "Right: join waits for every child, so the longest one (B, #30) decides."
              : "30 ns is when the last child ends — that is join's rule.",
        },
      ];
    },
  },
  {
    id: "timeout-disable-fork",
    label: "Timeout + disable fork",
    summary: "test forks a background monitor, then calls xfer: a response races a timer with join_any, and disable fork cleans up.",
    notice: "Watch the monitor lane at t = 15 ns, when disable fork runs.",
    variants: [
      { value: "none", label: "disable fork" },
      { value: "isolate", label: "isolation wrapper" },
    ],
    build: (variant) => timeoutBenchScenario(variant as TimeoutFix, false),
    question: "At t = 15 ns the response wins and disable fork runs. Which processes does it kill?",
    options: (variant, r) => {
      const killed = firstKill(r)?.killed ?? [];
      return [
        {
          id: "timer",
          label: "Only the timer",
          matches: killed.length === 1 && killed[0].startsWith("timer"),
          feedback:
            variant === "isolate"
              ? "Right: the wrapper (fork begin … end join) runs the race in a process of its own, so disable fork's only living descendant is the timer."
              : "disable fork is not limited to the last fork statement. It kills every descendant of test — including the monitor it forked earlier (§9.6.3).",
        },
        {
          id: "monitor",
          label: "The timer and the monitor",
          matches: killed.some((k) => k === "monitor"),
          feedback:
            variant === "none"
              ? "Right: disable fork kills every descendant of the calling process. test forked the monitor too, so it dies with the timer (§9.6.3)."
              : "Not with the wrapper: disable fork now runs inside the wrapper process, whose descendants are only the response and the timer.",
        },
        {
          id: "all",
          label: "Every other process, including the watchdog",
          matches: killed.includes("watchdog"),
          feedback: "The watchdog is a separate initial procedure, not a descendant of test. disable fork only follows the parent-child tree.",
        },
        {
          id: "none",
          label: "Nothing: join_any already ended the fork",
          matches: killed.length === 0,
          feedback: "join_any only resumes the parent. The timer is still running until something stops it.",
        },
      ];
    },
  },
  {
    id: "wait-fork",
    label: "wait fork",
    summary: "The parent forks A and B with join_none; B forks its own child G. Then the parent runs wait fork.",
    notice: "Compare B's lane with G's: one is the parent's child, the other only a grandchild.",
    build: () => waitForkScenario(),
    question: "When does the parent pass wait fork?",
    options: (_variant, r) => {
      const t = timeOf(r, "parent passes wait fork");
      return [
        { id: "10", label: "t = 10 ns", matches: t === 10, feedback: "A ends first, but wait fork waits for all immediate children, so B still holds it." },
        {
          id: "20",
          label: "t = 20 ns",
          matches: t === 20,
          feedback: "Right: B, the last immediate child, ends at 20 ns. G belongs to B, and wait fork does not wait for grandchildren (§9.6.1).",
        },
        { id: "50", label: "t = 50 ns", matches: t === 50, feedback: "50 ns is when the grandchild G ends. wait fork waits for immediate children only, not their descendants (§9.6.1)." },
        { id: "never", label: "Never", matches: t === undefined, feedback: "Both children end on their own, so wait fork does return." },
      ];
    },
  },
  {
    id: "fork-loop-capture",
    label: "fork in a loop",
    summary: "A for loop forks one join_none process per iteration; each prints the loop value.",
    notice: "Watch when the three children start, and what i holds by then.",
    variants: [
      { value: "bug", label: "$display(i)" },
      { value: "fork-automatic", label: "automatic k = i in fork" },
      { value: "begin-automatic", label: "automatic m = i in begin" },
    ],
    build: (variant) => forkLoopScenario(variant as CaptureVariant),
    question: "What values do the three spawned processes print?",
    options: (variant, r) => {
      const values = r.log.map((l) => l.text.split("= ")[1]).join(", ");
      return [
        {
          id: "012",
          label: "0, 1, 2",
          matches: values === "0, 1, 2",
          feedback:
            variant === "fork-automatic"
              ? "Right: k is declared in the fork itself, so a fresh k is set from i each time the fork statement executes — before its process is spawned (§9.3.2)."
              : variant === "bug"
                ? "The children do not run during the loop. join_none processes start only when the parent blocks or ends (§9.3.2); by then the one loop variable i is 3."
                : "m is declared inside the spawned begin-end, so it is initialized when the child starts running — after the loop has finished. This is the standard's own example (§9.3.2).",
        },
        {
          id: "333",
          label: "3, 3, 3",
          matches: values === "3, 3, 3",
          feedback:
            variant === "fork-automatic"
              ? "Not with automatic k declared in the fork: each child keeps the value i had when its fork executed."
              : "Right: all three children start after the loop ends, and they all read the single loop variable, which is now 3.",
        },
        { id: "222", label: "2, 2, 2", matches: values === "2, 2, 2", feedback: "The loop stops when i < 3 fails — at i = 3, not 2. The final increment happens before the test fails." },
        { id: "000", label: "0, 0, 0", matches: values === "0, 0, 0", feedback: "Nothing freezes i at its first value; every child shares the one loop variable." },
      ];
    },
  },
  {
    id: "named-disable",
    label: "disable by name",
    summary: "xfer names its race block guard and cleans up with disable guard. Try one call, then two concurrent calls.",
    notice: "With two calls, watch xfer(2)'s response lane at t = 15 ns.",
    variants: [
      { value: "one", label: "one call" },
      { value: "two", label: "two concurrent calls" },
    ],
    build: (variant) => timeoutBenchScenario("named", variant === "two"),
    question: "At t = 15 ns, xfer(1) runs disable guard. What does it end?",
    options: (variant, r) => {
      const step = firstKill(r);
      const killed = step?.killed ?? [];
      return [
        {
          id: "own",
          label: "Only xfer(1)'s own timer",
          matches: killed.length === 1 && killed[0] === "timer 1" && (step?.unwound ?? []).length === 0,
          feedback:
            variant === "one"
              ? "Right — but only because there is a single activation of guard. That is why this bug hides in simple tests."
              : "disable guard does not look at who called it. It ends every process executing guard, whichever call started it (§9.6.2).",
        },
        {
          id: "both",
          label: "xfer(1)'s timer and xfer(2)'s whole guard block — xfer 2's response never prints",
          matches: killed.includes("rsp 2"),
          feedback:
            variant === "two"
              ? "Right: disable uses the block's static name, so it ends every activation of guard — including xfer(2)'s, which loses its response (§9.6.2)."
              : "With one call there is no second activation to hit; only the timer dies.",
        },
        { id: "monitor", label: "Everything, including the monitor", matches: killed.includes("monitor"), feedback: "The monitor is not executing guard, so a disable by name never reaches it." },
        { id: "nothing", label: "Nothing: guard already completed", matches: killed.length === 0, feedback: "The fork's join_any returned, but the timer inside guard is still running." },
      ];
    },
  },
  {
    id: "event-race",
    label: "Events: -> vs ->>",
    summary: "At t = 10 ns the producer triggers done while the consumer starts waiting for it.",
    notice: "Flip the scheduler order: one variant gives a different answer depending on who runs first.",
    variants: [
      { value: "at-trigger", label: "-> with @(done)" },
      { value: "triggered", label: "-> with wait(done.triggered)" },
      { value: "nonblocking", label: "->> with @(done)" },
      { value: "triggered-loop", label: "forever wait(done.triggered)" },
    ],
    build: (variant) => eventRaceScenario(variant as EventVariant),
    explore: true,
    question: "Both processes wake at t = 10 ns. What happens to the consumer?",
    options: (variant, _r, exploration) => {
      const outcomes = exploration?.outcomes ?? [];
      const loops = outcomes.some((o) => o.result.outcome.kind === "zero-delay-loop");
      const woke = (o: { result: SimResult }) => o.result.log.some((l) => l.text === "consumer woke");
      return [
        {
          id: "always",
          label: "It always wakes, whichever process runs first",
          matches: Boolean(exploration?.deterministic) && !loops && outcomes.every(woke),
          feedback:
            variant === "triggered"
              ? "Right: done.triggered stays true for the rest of the time step, so the wait succeeds even if the trigger came first (§15.5.3)."
              : variant === "nonblocking"
                ? "Right: ->> triggers done in the NBA region, after every Active process — so the consumer is already waiting (§15.5.1)."
                : variant === "triggered-loop"
                  ? "It does wake — and then never stops. wait(done.triggered) stays true for the whole time step."
                  : "Only if the consumer happens to run first. If the producer runs first, its -> fires while nobody waits, and @(done) misses it (§15.5.2).",
        },
        {
          id: "never",
          label: "It never wakes: the trigger is missed",
          matches: Boolean(exploration?.deterministic) && !loops && !outcomes.some(woke),
          feedback: "A missed trigger needs the producer to run first, and the standard does not promise that order. In other orders the consumer wakes.",
        },
        {
          id: "depends",
          label: "It depends on which process the simulator runs first",
          matches: !exploration?.deterministic,
          feedback:
            variant === "at-trigger"
              ? "Right: this is a race. If the producer runs first, -> fires while nobody waits and @(done) blocks forever; if the consumer runs first, it wakes (§15.5.2)."
              : "Not for this variant: the model ran every legal order and they all agree.",
        },
        {
          id: "spin",
          label: "It spins forever at t = 10 ns",
          matches: loops,
          feedback:
            variant === "triggered-loop"
              ? "Right: done.triggered stays true until time advances, so wait() passes again and again and time never moves — a zero-delay loop. Use @(done) in loops."
              : "Only a loop around wait(done.triggered) does that; a single wait passes once and moves on.",
        },
      ];
    },
  },
];

/*
 * Process-tree scenarios (sv-process-tree-scenarios). They are offered only
 * when a lesson names them, so the full scenario picker keeps its six entries.
 */
const treeScenarios: ExploreScenario[] = [
  {
    id: "wrapper-begin-end",
    label: "Wrappers and disable fork",
    summary: "test forks a monitor, then races a response (#15) against a timer (#40) and cleans up with disable fork. Try three wrappers around the race.",
    notice: "Count the nodes under test when disable fork runs. Only one wrapper adds a process.",
    variants: WRAPPER_VARIANTS,
    build: (variant) => wrapperScenario(variant as WrapperVariant),
    question: "At t = 15 ns the response wins and disable fork runs. Does the monitor survive?",
    options: (variant, r) => {
      const killed = firstKill(r)?.killed ?? [];
      const own = variant === "fork-join";
      return [
        {
          id: "survives",
          label: variant === "none" ? "Yes: the monitor survives" : "Yes: the wrapper keeps the monitor out of reach",
          matches: !killed.includes("monitor"),
          feedback: own
            ? "Right: fork begin … end join runs the race in a process of its own (§9.5). disable fork now runs in that wrapper, whose only living descendant is the timer (§9.6.3)."
            : variant === "begin-end"
              ? "Not with begin … end. A begin-end block is not in §9.5's list of what creates a process, so the race and disable fork still run in test, and the monitor is test's child (§9.6.3)."
              : "With no wrapper, disable fork runs in test, and the monitor is one of test's children (§9.6.3).",
        },
        {
          id: "killed",
          label: "No: disable fork kills the monitor",
          matches: killed.includes("monitor"),
          feedback: own
            ? "Not with fork begin … end join: it creates a wrapper process (§9.5), so disable fork runs there and reaches only the wrapper's own descendants (§9.6.3)."
            : variant === "begin-end"
              ? "Right: a begin-end block is not in §9.5's list of what creates a process, so disable fork still runs in test and kills every descendant of test, the monitor included (§9.6.3)."
              : "Right: disable fork runs in test and kills every descendant of test, including the monitor it forked earlier (§9.6.3).",
        },
      ];
    },
  },
  {
    id: "finished-child-grandchild",
    label: "Finished child, running grandchild",
    summary: `parent forks C with join. C forks its own child G with join_none, then finishes at t = ${FINISHED_CHILD_TIMES.childEnds} ns. G runs on until t = ${FINISHED_CHILD_TIMES.grandchildEnds} ns unless something stops it.`,
    notice: "C has already finished when parent runs the cleanup statement. Watch G's node.",
    variants: CLEANUP_VARIANTS,
    build: (variant) => finishedChildScenario(variant as CleanupVariant),
    question: `At t = ${FINISHED_CHILD_TIMES.cleanupAt} ns parent runs the cleanup statement. What happens to G?`,
    options: (variant, r) => {
      const killedG = (firstKill(r)?.killed ?? []).includes("G");
      const passes = timeOf(r, "parent passes cleanup");
      const gDone = timeOf(r, "G done");
      const disable = variant === "disable-fork";
      return [
        {
          id: "killed",
          label: `G is killed at t = ${FINISHED_CHILD_TIMES.cleanupAt} ns`,
          matches: killedG,
          feedback: disable
            ? "Right: disable fork ends every descendant of parent, including descendants of a child that has already terminated (§9.6.3). G is reached through the finished C."
            : "wait fork never ends a process; it only waits (§9.6.1).",
        },
        {
          id: "runs-on",
          label: `G runs on to t = ${FINISHED_CHILD_TIMES.grandchildEnds} ns; parent passes at once`,
          matches: !killedG && gDone === FINISHED_CHILD_TIMES.grandchildEnds && passes === FINISHED_CHILD_TIMES.cleanupAt,
          feedback: disable
            ? "That is what wait fork does. disable fork reaches G even though G's parent C has finished (§9.6.3)."
            : "Right: wait fork waits for immediate children only, excluding their descendants (§9.6.1). parent's only child, C, has finished, so parent passes at once, and G, a grandchild, runs on.",
        },
        {
          id: "waits",
          label: `parent waits until G ends at t = ${FINISHED_CHILD_TIMES.grandchildEnds} ns`,
          matches: passes === FINISHED_CHILD_TIMES.grandchildEnds,
          feedback: "Neither statement does that. wait fork waits for immediate children only (§9.6.1), and G is parent's grandchild.",
        },
      ];
    },
  },
];

const allScenarios: ExploreScenario[] = [...exploreScenarios, ...treeScenarios];

function getExploreScenario(id: ForkJoinScenarioId): ExploreScenario {
  return allScenarios.find((s) => s.id === id) ?? exploreScenarios[0];
}

function ExploreMode({ scenarios, initial, treeView = false }: { scenarios: ExploreScenario[]; initial: ForkJoinScenarioId; treeView?: boolean }) {
  const [scenarioId, setScenarioId] = useState<ForkJoinScenarioId>(scenarios.some((s) => s.id === initial) ? initial : scenarios[0].id);
  const preset = getExploreScenario(scenarioId);
  const [variant, setVariant] = useState<string>(preset.variants?.[0]?.value ?? "");
  const [order, setOrder] = useState<"declaration" | "reverse">("declaration");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const scenario = useMemo(() => preset.build(variant), [preset, variant]);
  const prepared = useMemo(() => prepareScenario(scenario), [scenario]);
  const result = useMemo(() => simulateProcesses(scenario, { order }), [scenario, order]);
  const reference = useMemo(() => simulateProcesses(scenario), [scenario]);
  const exploration = useMemo(() => (preset.explore ? exploreProcessOrders(scenario) : undefined), [preset, scenario]);
  const options = useMemo(() => preset.options(variant, reference, exploration), [preset, variant, reference, exploration]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);

  const pickScenario = (id: ForkJoinScenarioId) => {
    const next = getExploreScenario(id);
    setScenarioId(id);
    setVariant(next.variants?.[0]?.value ?? "");
    setOrder("declaration");
  };

  const orderLabels = (() => {
    const tops = scenario.processes.filter((p) => p.kind !== "final").map((p) => p.label);
    return { declaration: tops.join(" first, then ") || "declaration order", reverse: [...tops].reverse().join(" first, then ") || "reverse order" };
  })();

  // With the tree, predictions happen at each disable fork / wait fork / disable <name>
  // pause instead of up front. A run with no such statement keeps the up-front question.
  const treeCheckpoints = useMemo(() => (treeView ? findTreeCheckpoints(result, prepared) : []), [treeView, result, prepared]);
  const treeMode = treeCheckpoints.length > 0;
  const treeStatements = [...new Set(treeCheckpoints.map((cp) => cp.statement))].join(" or ");

  const body = (
        <div className="space-y-4">
          {exploration ? (
            <p
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium",
                exploration.deterministic
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
              )}
            >
              <span aria-hidden>{exploration.deterministic ? "✓ " : "⚠ "}</span>
              {exploration.deterministic
                ? `Same outcome in all ${exploration.runCount} legal orders the model tried.`
                : `Race: ${exploration.outcomes.length} different outcomes across ${exploration.runCount} legal orders.`}
            </p>
          ) : null}
          {treeMode ? null : (
            <p className="text-sm text-foreground">
              <strong>What to notice: </strong>
              {preset.notice}
            </p>
          )}
          {preset.explore ? (
            <OrderPicker order={order} setOrder={setOrder} labels={orderLabels} name={`order-${scenarioId}-${variant}`} />
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                aria-expanded={showAdvanced}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showAdvanced ? "Hide" : "Show"} advanced: scheduler order
              </button>
              {showAdvanced ? (
                <div className="mt-2 space-y-2">
                  <OrderPicker order={order} setOrder={setOrder} labels={orderLabels} name={`order-${scenarioId}-${variant}`} />
                  <p className="text-xs text-muted-foreground">
                    The order of processes that are ready at the same time is up to the simulator (§4.7). Here it only changes the order of lines printed at the same
                    time, never the times.
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <ProcessTraceView
            prepared={prepared}
            result={result}
            resetKey={`${scenarioId}:${variant}:${order}`}
            watch={scenario.vars?.map((d) => d.name)}
            treeView={treeView}
            notice={treeMode ? preset.notice : undefined}
          />
        </div>
  );

  return (
    <div className="space-y-4">
      {scenarios.length > 1 ? (
        <SegmentedControl label="Scenario" value={scenarioId} onChange={pickScenario} options={scenarios.map((s) => ({ value: s.id, label: s.label }))} />
      ) : null}
      <p className="text-sm text-muted-foreground">{preset.summary}</p>
      {preset.variants ? (
        <SegmentedControl
          label="Variant"
          mono
          value={variant}
          onChange={(value) => {
            setVariant(value);
            setOrder("declaration");
          }}
          options={preset.variants}
        />
      ) : null}
      {treeMode ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Step through the run. Playback pauses before each {treeStatements}, so you can predict which processes it reaches before the model shows it.
        </p>
      ) : (
        <CodeTrace label="Code (generated from the model)" lines={lines} />
      )}
      {treeMode ? (
        body
      ) : (
        <PredictionPrompt
          resetKey={`${scenarioId}:${variant}`}
          question={preset.question}
          options={options.map((o) => ({ id: o.id, label: o.label, correct: o.matches, feedback: o.feedback }))}
        >
          {body}
        </PredictionPrompt>
      )}
    </div>
  );
}

function OrderPicker({
  order,
  setOrder,
  labels,
  name,
}: {
  order: "declaration" | "reverse";
  setOrder: (o: "declaration" | "reverse") => void;
  labels: { declaration: string; reverse: string };
  name: string;
}) {
  return (
    <fieldset className="rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-3">
      <legend className="px-1 text-xs font-semibold text-amber-800 dark:text-amber-200">When processes are ready together, this simulator runs…</legend>
      <div className="flex flex-wrap gap-2">
        {(["declaration", "reverse"] as const).map((o) => (
          <label key={o} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", order === o ? "border-amber-500 bg-amber-500/15" : "border-border/70")}>
            <input type="radio" name={name} checked={order === o} onChange={() => setOrder(o)} className="size-5 shrink-0 accent-amber-500" />
            {labels[o]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------------- */
/* Debug mode: "disable fork killed the wrong threads".                       */
/* ------------------------------------------------------------------------- */

const SUSPECTS: { key: string; culprit: boolean; feedback: string }[] = [
  {
    key: "spawn-monitor",
    culprit: false,
    feedback: "Forking the monitor with join_none is right: it runs in the background as a child of test. The question is who later kills that child.",
  },
  { key: "xfer-fork:join", culprit: false, feedback: "join_any only decides when xfer resumes. It never ends a process." },
  {
    key: "xfer-cleanup",
    culprit: true,
    feedback:
      "Yes. xfer runs inside the test process, so disable fork kills every descendant of test — the timer, and also the monitor test forked earlier (§9.6.3).",
  },
  { key: "test-wait", culprit: false, feedback: "A delay suspends test itself. It cannot end another process." },
];

const FIXES: { id: TimeoutFix; label: string; review: string }[] = [
  {
    id: "isolate",
    label: "Wrap the race and its cleanup: fork begin … disable fork; end join",
    review: "Accepted — the standard idiom. disable fork now runs in a wrapper process whose only descendants are the response and the timer.",
  },
  {
    id: "named",
    label: "Name the fork (fork : guard) and use disable guard",
    review: "Rejected in review. It passes the single-call test, but disable guard ends every activation of guard: run two transfers at once and xfer(2) silently loses its response (§9.6.2).",
  },
  {
    id: "wait-fork",
    label: "Replace disable fork with wait fork",
    review: "Rejected. wait fork waits for every child of test — including the monitor, which never ends — so the test hangs until the watchdog fires.",
  },
  {
    id: "remove",
    label: "Delete disable fork and let the timer expire",
    review: "Rejected. The timer survives and reports a TIMEOUT 25 ns after the transfer succeeded.",
  },
];

const criteria: { key: "monitorSurvives" | "noFalseTimeout" | "allResponses" | "testCompletes"; label: string }[] = [
  { key: "monitorSurvives", label: "monitor keeps running after xfer returns" },
  { key: "noFalseTimeout", label: "no false TIMEOUT" },
  { key: "allResponses", label: "every transfer gets its response" },
  { key: "testCompletes", label: "test reaches “test done”" },
];

function DebugMode() {
  const buggy = useMemo(() => timeoutBenchScenario("none", false), []);
  const buggyPrepared = useMemo(() => prepareScenario(buggy), [buggy]);
  const buggyRun = useMemo(() => simulateProcesses(buggy), [buggy]);
  const lines = useMemo(() => linesFor(buggyPrepared), [buggyPrepared]);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<TimeoutFix | null>(null);
  const found = SUSPECTS.find((s) => s.key === suspect)?.culprit ?? false;
  const suspectInfo = SUSPECTS.find((s) => s.key === suspect);

  const fixRuns = useMemo(() => {
    if (!fixId) return null;
    return [false, true].map((concurrent) => {
      const scenario = timeoutBenchScenario(fixId, concurrent);
      const result = simulateProcesses(scenario);
      return { concurrent, scenario, result, grade: gradeTimeoutBench(result, concurrent) };
    });
  }, [fixId]);
  const fix = FIXES.find((f) => f.id === fixId);
  const fixedPrepared = useMemo(() => (fixRuns ? prepareScenario(fixRuns[0].scenario) : null), [fixRuns]);

  const renderSuspect = (line: CodeTraceLine) => {
    const entry = SUSPECTS.find((s) => s.key === line.key);
    if (!entry) return null;
    const chosen = suspect === entry.key;
    return (
      <button
        type="button"
        onClick={() => setSuspect(entry.key)}
        aria-pressed={chosen}
        aria-label={`Suspect line: ${line.text.trim()}`}
        className={cn(
          "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 font-sans text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
          chosen ? (entry.culprit ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-rose-300 bg-rose-400/20 text-rose-100") : "border-cyan-400/50 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
        )}
      >
        {chosen ? (entry.culprit ? "✓ culprit" : "✕ not it") : "suspect"}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-3 text-sm">
        <p className="font-semibold text-foreground">Symptom</p>
        <p className="mt-1 text-muted-foreground">
          The coverage monitor should report every 10 ns until the test ends. After the first transfer it goes silent — and the test still passes.
        </p>
        <ol className="mt-2 space-y-0.5 font-mono text-xs [font-variant-ligatures:none]" aria-label="Log of the failing run">
          {buggyRun.log.map((l, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{l.time} ns</span> · {l.label}: {l.text}
            </li>
          ))}
        </ol>
      </div>

      <CodeTrace label="Find the line that kills the monitor" lines={lines} renderLineControl={renderSuspect} />
      <div aria-live="polite" className="text-sm">
        {suspectInfo ? (
          <p className={suspectInfo.culprit ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            <strong>{suspectInfo.culprit ? "Found it. " : "Not this one. "}</strong>
            {suspectInfo.feedback}
          </p>
        ) : null}
      </div>
      {!found ? (
        <HintLadder
          hints={[
            "List every process alive at t = 15 ns, and draw who forked whom.",
            "Which statement ends processes? Which processes does it choose?",
            "disable fork ends all descendants of the process that calls it. Which process calls it here?",
          ]}
        />
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">Choose a fix. The model runs it with one call and with two concurrent calls.</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {FIXES.map((f) => (
              <label
                key={f.id}
                className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}
              >
                <input type="radio" name="disable-fork-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="size-5 shrink-0 mt-px accent-cyan-500" />
                <span className="font-mono text-xs [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {found && fixRuns && fix && fixedPrepared ? (
        <div className="space-y-3" aria-live="polite">
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {fixRuns.map((run) => (
              <div key={String(run.concurrent)} className="rounded-xl border border-border/70 p-3">
                <p className="text-label text-muted-foreground">
                  {run.concurrent ? "Two concurrent calls: xfer(1, 15) ∥ xfer(2, 30)" : "One call: xfer(1, 15)"}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {criteria.map((cr) => {
                    const ok = run.grade[cr.key];
                    return (
                      <li key={cr.key} className={ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                        <span aria-hidden>{ok ? "✓ " : "✕ "}</span>
                        <span className="sr-only">{ok ? "passes: " : "fails: "}</span>
                        {cr.label}
                      </li>
                    );
                  })}
                </ul>
                <ol className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
                  {run.result.log.map((l, i) => (
                    <li key={i}>
                      {l.time} ns · {l.label}: {l.text}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              fixRuns.every((r) => r.grade.passed)
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )}
          >
            <strong>{fixRuns.every((r) => r.grade.passed) ? "Passes both runs. " : "Code review: "}</strong>
            {fix.review}
          </p>
          <CodeTrace label="Your fixed xfer (one-call bench)" lines={linesFor(fixedPrepared)} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * One preset per F2C lesson use of the process tree. Each sets the scenario,
 * the picker and treeView; explicit props still win.
 */
export const FORK_JOIN_TREE_PRESETS = {
  /** Blocks: begin-end and fork-join, "What creates a process". */
  "what-creates-a-process": { scenario: "wrapper-begin-end", scenarios: ["wrapper-begin-end"] },
  /** Waiting for and cleaning up threads. */
  cleanup: { scenario: "timeout-disable-fork", scenarios: ["timeout-disable-fork", "wrapper-begin-end", "finished-child-grandchild", "named-disable", "wait-fork"] },
  /** Pitfalls row: "Wrapping the race in begin … end isolates disable fork". */
  "begin-end-pitfall": { scenario: "wrapper-begin-end", scenarios: ["wrapper-begin-end"] },
  /** Push Further, Expert: disable in depth. */
  "disable-in-depth": { scenario: "finished-child-grandchild", scenarios: ["finished-child-grandchild", "named-disable", "wait-fork"] },
} satisfies Record<string, { scenario: ForkJoinScenarioId; scenarios: ForkJoinScenarioId[] }>;

export type ForkJoinTreePreset = keyof typeof FORK_JOIN_TREE_PRESETS;

interface ForkJoinVisualizerProps {
  /** Initial scenario in explore mode. */
  scenario?: ForkJoinScenarioId;
  /** Restrict the scenario picker; hides the debug tab. */
  scenarios?: ForkJoinScenarioId[];
  /** Start in the debug challenge. */
  mode?: "explore" | "debug";
  /**
   * Draw the process tree beside the lanes. Runs that contain disable fork,
   * wait fork or disable <name> then pause before each one for a tap-the-nodes
   * prediction instead of the up-front question.
   */
  treeView?: boolean;
  /** A lesson preset for the process tree; sets scenario, scenarios and treeView. */
  preset?: ForkJoinTreePreset;
}

/**
 * Processes over simulation time: fork-join variants, disable fork, wait
 * fork, the fork-in-loop capture bug, named-block disable and event races,
 * plus the process-tree scenarios. Every lane, node, line highlight and
 * printed value comes from sv-process-model; the tree reading and grading
 * come from sv-process-tree-scenarios.
 */
export default function ForkJoinVisualizer({ scenario: scenarioProp, scenarios: scenariosProp, mode = "explore", treeView: treeViewProp, preset }: ForkJoinVisualizerProps) {
  const presetConfig = preset ? FORK_JOIN_TREE_PRESETS[preset] : undefined;
  const scenario: ForkJoinScenarioId = scenarioProp ?? presetConfig?.scenario ?? "join-variants";
  const scenarios: ForkJoinScenarioId[] | undefined = scenariosProp ?? presetConfig?.scenarios;
  const treeView = treeViewProp ?? Boolean(presetConfig);
  const available = scenarios
    ? allScenarios.filter((s) => scenarios.includes(s.id))
    : isTreeScenarioId(scenario)
      ? [...exploreScenarios, getExploreScenario(scenario)]
      : exploreScenarios;
  const [tab, setTab] = useState<"explore" | "debug">(scenarios ? "explore" : mode);
  return (
    <VisualFrame
      label="Fork-join process visualizer"
      eyebrow={tab === "debug" ? "Debug it" : "Processes over time"}
      title={tab === "debug" ? "disable fork killed the wrong threads" : "Which processes run, wait and die — and when"}
      summary="Predict first, then step through simulation time. Each lane is one process; the code highlights where every process is waiting."
      fidelity="model"
      assumptions={PROCESS_MODEL_ASSUMPTIONS}
    >
      {!scenarios ? (
        <SegmentedControl
          label="Mode"
          value={tab}
          onChange={setTab}
          options={[
            { value: "explore", label: "Explore scenarios" },
            { value: "debug", label: "Debug: disable fork" },
          ]}
        />
      ) : null}
      {tab === "explore" ? <ExploreMode scenarios={available.length ? available : exploreScenarios} initial={scenario} treeView={treeView} /> : <DebugMode />}
    </VisualFrame>
  );
}
