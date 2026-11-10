"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  LOOP_BOXES,
  LOOP_VARIANTS,
  RUN_ENDING_ASSUMPTIONS,
  bookedList,
  endDiagnosticNote,
  endingDetails,
  endingHeadline,
  jumpGates,
  jumpOptions,
  lessonSource,
  loopBoxNote,
  loopBoxOf,
  loopBoxPassed,
  loopEndOptions,
  runSchedulerLoop,
  runStepBadges,
  runStepWhy,
  severityPrefix,
  slotEvents,
  type LoopVariant,
} from "@/lib/run-ending-scenarios";
import type { PreparedScenario, SimResult, TraceStep } from "@/lib/sv-process-model";
import { cn } from "@/lib/utils";

/* ========================================================================= */
/* Pieces shared with RunEndingExplorer's lanes view.                         */
/* ========================================================================= */

/** Tells the parent that a PredictionPrompt has revealed its children. */
export function RevealSignal({ onReveal }: { onReveal: (revealed: boolean) => void }) {
  useEffect(() => {
    onReveal(true);
    return () => onReveal(false);
  }, [onReveal]);
  return null;
}

/** What happened and why at one step, with badges that never call a suspended or stuck run "ended". */
export function RunNarration({ step, result }: { step: TraceStep; result: SimResult }) {
  const badges = runStepBadges(step, result.outcome, result);
  return (
    <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-bold uppercase tracking-wider",
            badges.tone === "kill"
              ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
              : badges.tone === "horizon"
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
          )}
        >
          {badges.kind}
        </span>
        <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">{badges.where}</span>
        {badges.choice ? <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">{badges.choice}</span> : null}
        {badges.assumption ? <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">Model assumption</span> : null}
        <span className="ml-auto font-mono text-muted-foreground">t = {step.time} ns</span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-snug text-foreground [font-variant-ligatures:none]">{step.what}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground [font-variant-ligatures:none]">
        <strong className="text-foreground">Why: </strong>
        {runStepWhy(step, result)}
      </p>
    </div>
  );
}

/**
 * Output so far. Severity lines carry a placeholder for the tool's own prefix
 * (§20.10). From the step that ends or suspends the run, a note names the
 * $finish diagnostic the tool also prints (§20.2 Table 20-1).
 */
export function RunLog({ step, result, prepared, index }: { step: TraceStep; result: SimResult; prepared: PreparedScenario; index: number }) {
  const hasSeverity = step.log.some((l) => l.severity);
  const diagnostic = endDiagnosticNote(result, prepared);
  return (
    <div className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]">
      <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Simulation output</p>
      {step.log.length === 0 ? (
        <span className="text-slate-400">(no output yet)</span>
      ) : (
        <ol className="space-y-0.5" aria-label="Simulation output, oldest first">
          {step.log.map((l, i) => (
            <li key={i} className={cn("flex flex-wrap gap-x-3", i === step.log.length - 1 && step.kind === "print" && "text-cyan-200")}>
              <span className="w-12 shrink-0 text-right text-slate-400">{l.time} ns</span>
              <span className="min-w-0 flex-1 break-words">
                {l.severity ? <span className="text-amber-200/90">{severityPrefix(l.severity, l.time)} </span> : null}
                {l.text}
                {l.region === "final" ? <span className="text-slate-400"> (final)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
      {hasSeverity ? (
        <p className="mt-2 font-sans text-[11px] text-slate-400">
          ‹… prefix› is a placeholder: the tool prints its own text with the severity, file and line, scope and time. That layout is tool-specific (§20.10).
        </p>
      ) : null}
      {diagnostic && index >= diagnostic.index ? <p className="mt-2 font-sans text-[11px] text-slate-400">{diagnostic.text}</p> : null}
    </div>
  );
}

/** How the run ended: shown only at the last step. */
export function EndingPanel({ result }: { result: SimResult }) {
  const tone = result.outcome.kind === "finish" ? "emerald" : result.outcome.kind === "quiet" ? "sky" : "amber";
  return (
    <section
      aria-label="How the run ended"
      className={cn(
        "rounded-xl border p-4 text-sm",
        tone === "emerald" && "border-emerald-500/50 bg-emerald-500/[0.07]",
        tone === "sky" && "border-sky-500/50 bg-sky-500/[0.07]",
        tone === "amber" && "border-amber-500/50 bg-amber-500/[0.08]",
      )}
    >
      <p className="font-semibold text-foreground">{endingHeadline(result)}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {endingDetails(result).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export const codeLines = (lines: { text: string; key?: string; owner?: CodeTraceLine["owner"] }[]): CodeTraceLine[] =>
  lines.map((l) => ({ text: l.text, key: l.key, owner: l.owner }));

/* ========================================================================= */
/* The §4.5 loop view.                                                        */
/* ========================================================================= */

function LoopFlowchart({ result, index }: { result: SimResult; index: number }) {
  const active = loopBoxOf(result, index);
  const note = loopBoxNote(result, index);
  const passed = loopBoxPassed(result, index);
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-3">
      <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">The scheduler loop (§4.5, simplified)</figcaption>
      <ol className="space-y-1.5" aria-label="Scheduler loop boxes">
        {LOOP_BOXES.map((box, i) => {
          const isActive = box.id === active;
          const isPassed = passed?.box === box.id;
          return (
            <li key={box.id}>
              {i === 2 ? <p className="pl-3 text-[11px] text-muted-foreground" aria-hidden>↓ yes</p> : null}
              {i === 4 ? (
                <p className="pl-3 text-[11px] text-muted-foreground" aria-hidden>
                  ↺ slot empty: back to “Is any time slot nonempty?” · a process may call $finish instead ↓
                </p>
              ) : null}
              {i === 5 ? <p className="pl-3 text-[11px] text-muted-foreground" aria-hidden>↓ then the run is over</p> : null}
              <div
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-2 transition-colors duration-200 motion-reduce:transition-none",
                  box.id === "check" && "border-dashed",
                  isActive ? "border-cyan-500/70 bg-cyan-500/15" : isPassed ? "border-cyan-500/50 bg-cyan-500/[0.06]" : "border-border/70",
                )}
              >
                <p className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
                  <span aria-hidden className={cn("w-3 shrink-0", isActive ? "text-cyan-700 dark:text-cyan-300" : "text-transparent")}>
                    ▶
                  </span>
                  {isActive ? <span className="sr-only">Executing now: </span> : null}
                  {box.title}
                </p>
                <p className="pl-5 text-xs text-muted-foreground">{box.detail}</p>
                {isPassed && passed ? (
                  <p className="mt-1 pl-5 text-xs font-medium text-cyan-800 dark:text-cyan-200">
                    <span className="sr-only">Passed on the way here: </span>
                    <span aria-hidden>↳ passed just now · </span>
                    {passed.note}
                  </p>
                ) : null}
                {isActive && note ? <p className="mt-1 pl-5 text-xs font-medium text-amber-800 dark:text-amber-200">{note}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function SlotLists({ result, index, hideOrder }: { result: SimResult; index: number; hideOrder: boolean }) {
  const slot = slotEvents(result, index);
  const booked = bookedList(result, index, hideOrder ? "booking" : "due");
  const step = result.trace[index];
  return (
    <div className="grid min-w-0 gap-3">
      <section aria-label="This time slot" className="rounded-xl border border-border/70 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {slot.finalPhase ? "After the last time slot · final procedures" : `This time slot · t = ${slot.time} ns`}
        </h4>
        {slot.items.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs">
            {slot.items.map((item, i) => (
              <li
                key={i}
                className={cn(
                  "font-mono [font-variant-ligatures:none]",
                  item.status === "done" && "text-muted-foreground",
                  item.status === "now" && "font-semibold text-foreground",
                  item.status === "pending" && "text-sky-800 dark:text-sky-200",
                )}
              >
                <span aria-hidden>{item.kind === "update" ? "◆ " : item.kind === "final" ? "■ " : "▶ "}</span>
                <span className="sr-only">{item.kind === "update" ? "Update event: " : item.kind === "final" ? "Final procedure: " : "Evaluation event: "}</span>
                {item.text}
                {item.status === "pending" ? " (pending)" : item.status === "now" ? " (now)" : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          ◆ update event: a value changed · ▶ evaluation event: a process runs (§4.3)
          {slot.finalPhase ? " · ■ final procedure: runs after the last time slot, in zero time, not as a separate process (§9.2.3)" : ""}
        </p>
      </section>
      <section aria-label="Booked for later" className="rounded-xl border border-border/70 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Booked for later {hideOrder ? "· in booking order" : "· earliest first"}
        </h4>
        {booked.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Nothing booked at any later time.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 font-mono text-xs [font-variant-ligatures:none]">
            {booked.map((b) => (
              <li key={`${b.pid}@${b.time}`}>
                t = {b.time} ns · {b.label} <span className="text-muted-foreground">(#{b.time - step.time} from now)</span>
              </li>
            ))}
          </ul>
        )}
        {hideOrder ? <p className="mt-2 text-[11px] text-muted-foreground">Sorted by due time once you have predicted the jump.</p> : null}
      </section>
    </div>
  );
}

interface SchedulerLoopViewProps {
  initialVariant?: LoopVariant;
}

/** The §4.5 loop: a flowchart synced to a model run, with a prediction before every jump of time. */
export default function SchedulerLoopView({ initialVariant = "finish" }: SchedulerLoopViewProps) {
  const [variant, setVariant] = useState<LoopVariant>(initialVariant);
  const run = useMemo(() => runSchedulerLoop(variant), [variant]);
  const { result } = run;
  const lines = useMemo(() => codeLines(lessonSource(run.prepared)), [run]);
  const playback = usePlayback(result.trace.length, variant);
  const [revealed, setRevealed] = useState(false);
  const [passed, setPassed] = useState<{ key: string; gates: number[] }>({ key: variant, gates: [] });
  const passedGates = passed.key === variant ? passed.gates : [];
  const gates = useMemo(() => jumpGates(result), [result]);
  const gate = gates.find((g) => !passedGates.includes(g));
  const last = result.trace.length - 1;
  const maxIndex = gate === undefined ? last : gate - 1;
  const index = Math.min(playback.index, maxIndex, last);
  const step = result.trace[index];
  const atGate = gate !== undefined && index === gate - 1;
  const { seek } = playback;

  // A jump of time stays hidden until its prediction is made: clamp any step, play or scrub past it.
  useLayoutEffect(() => {
    if (playback.index > maxIndex) seek(maxIndex);
  }, [playback.index, maxIndex, seek]);

  const contextKeys = step.procs.filter((p) => p.state !== "done" && p.state !== "killed" && p.lineKey).map((p) => p.lineKey as string);
  const endOptions = loopEndOptions(run);

  return (
    <VisualFrame
      label="Run ending explorer: the scheduler loop"
      eyebrow="Experiment · predict then reveal"
      title="The scheduler loop: how time advances"
      summary="IEEE 1800-2023 §4.5 defines simulation as a loop: move to the first nonempty time slot, execute it, repeat while any slot is nonempty. Pick a program, predict how its run ends, then predict every jump of time before you take it."
      fidelity="model"
      assumptions={RUN_ENDING_ASSUMPTIONS}
    >
      <SegmentedControl label="Program" options={LOOP_VARIANTS} value={variant} onChange={setVariant} />
      <CodeTrace
        label="Code under simulation"
        lines={lines}
        activeKey={revealed ? step.lineKey : undefined}
        contextKeys={revealed ? contextKeys : []}
      />
      <PredictionPrompt
        resetKey={variant}
        question="How does this run end, and when?"
        options={endOptions.map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }))}
      >
        <div className="space-y-4">
          <RevealSignal onReveal={setRevealed} />
          <RunNarration step={step} result={result} />
          {atGate && gate !== undefined ? (
            <PredictionPrompt
              resetKey={`${variant}:${gate}`}
              question={`The slot at t = ${step.time} ns is empty. Which time does the loop visit next?`}
              options={jumpOptions(result, gate)}
            >
              <button
                type="button"
                onClick={() => {
                  setPassed({ key: variant, gates: [...passedGates, gate] });
                  playback.stepForward();
                }}
                className="inline-flex h-10 items-center rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 text-sm font-semibold text-foreground hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Jump to the next time slot
              </button>
            </PredictionPrompt>
          ) : null}
          <PlaybackControls playback={playback} stepCount={result.trace.length} stepNoun="Loop step" describeStep={(i) => result.trace[Math.min(i, maxIndex)]?.what ?? ""} />
          {gate !== undefined && !atGate ? (
            <p className="text-xs text-muted-foreground">Stepping pauses before each jump of time and asks where the loop goes next.</p>
          ) : null}
          <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <LoopFlowchart result={result} index={index} />
            <SlotLists result={result} index={index} hideOrder={atGate} />
          </div>
          <RunLog step={step} result={result} prepared={run.prepared} index={index} />
          {index === last ? <EndingPanel result={result} /> : null}
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
