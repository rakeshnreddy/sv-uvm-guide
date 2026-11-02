"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { OutcomeGroups } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { StepWaveform } from "@/components/visual-system/StepWaveform";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback, usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import {
  DEFAULT_DIRECTIONS,
  DIR_ACTUALS,
  DIR_ADDS,
  DIR_FORMALS,
  DIR_INITIAL,
  FORMAL_SIGNATURES,
  KATA_BUGGY_LOG,
  KATA_EXPECTED_LOG,
  KATA_FIXES,
  KATA_FIX_LABELS,
  KATA_SUBS,
  KATA_SUSPECTS,
  KATA_SYMPTOMS,
  NO_KATA_FIXES,
  SECOND_CALL_OPTIONS,
  addCall,
  benchSource,
  callOneActivation,
  callOnePrint,
  checkInitializer,
  compileBench,
  countCallsBench,
  countOnesBench,
  directionsSummary,
  exploreBench,
  factBench,
  factorial,
  formalRulesClause,
  formatValue,
  gradeKata,
  kataBench,
  literalCallIssues,
  outerReturnValue,
  pulseBench,
  recursionTable,
  resolveFormals,
  resolveReturnType,
  sendBench,
  sendVerdict,
  showDirsBench,
  signatureToSource,
  simulateBench,
  stableOptionOrder,
  sumToBench,
  waitCyclesEffect,
  type Bench,
  type BenchExploration,
  type CompileIssue,
  type DataType,
  type DirName,
  type Direction,
  type FormalSpec,
  type KataFix,
  type KataFixes,
  type KataSub,
  type Lifetime,
  type Qualifier,
  type ResolvedFormal,
  type SecondCallAt,
  type StorageBox,
  type SubStep,
  type SubroutineRun,
  type Value,
} from "@/lib/sv-subroutine-model";
import { cn } from "@/lib/utils";

/* ========================================================================= */
/* Props                                                                      */
/* ========================================================================= */

export type SubroutineLabMode = "lifetime" | "recursion" | "directions" | "formals" | "debug";

export interface SubroutineLabProps {
  /** Which part of the lesson the lab serves. */
  mode?: SubroutineLabMode;
  /**
   * lifetime: "send" (default) | "initializers"; recursion: "fact" (default) | "sum_to";
   * directions: "show_dirs" (default) | "pulse"; formals: "split" (default) | "wait_cycles" | "wait_cycles_ok" | "add".
   */
  preset?: string;
}

const ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §13.3 (copy-in at the call, copy-out at the return, default directions and types), §13.3.1/§13.3.2 and §13.4.2 (static versus automatic storage), §13.5.2 (ref), §13.4 (implicit return type) and §6.21 (initializers). Delays are in ns.",
  "Each process runs until it blocks or ends. When several are ready at the same time, §4.7 leaves the order open; the model runs every order of the ready processes and groups the outcomes. §4.7 also lets a simulator suspend a process between its statements; that interleaving is not explored, so a legal log order can be missing (at #10 with the debug prints, call 1's use line before call 2's enter line, both id=2), but no value call 1 can print is.",
  "always @(busy) is modelled as a monitor that prints whenever busy changes value (§9.4.2). Not modelled: class methods, default argument values, named binding, disable.",
];

const code = "rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]";
const button =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const lineControlClass =
  "min-h-10 rounded-md border border-border/70 bg-slate-900 px-1.5 font-mono text-[11px] sm:h-7 sm:min-h-0 text-slate-100 [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

/* ========================================================================= */
/* Line controls rendered inside the code                                     */
/* ========================================================================= */

function LifetimeSwitch({ sub, lifetime, onChange }: { sub: string; lifetime: Lifetime; onChange: (next: Lifetime) => void }) {
  const automatic = lifetime === "automatic";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={automatic}
      aria-label={`${sub} is automatic`}
      data-testid={`lifetime-${sub}`}
      onClick={() => onChange(automatic ? "static" : "automatic")}
      className={cn(lineControlClass, "inline-flex items-center gap-1", automatic ? "border-cyan-400/70 bg-cyan-500/20" : "border-amber-400/60 bg-amber-500/15")}
    >
      <span aria-hidden>{automatic ? "●" : "○"}</span>
      automatic
    </button>
  );
}

function LineSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  invalid = false,
  testId,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  invalid?: boolean;
  testId?: string;
}) {
  return (
    <select
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(lineControlClass, invalid && "border-rose-400 bg-rose-500/20 text-rose-100")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function OperatorSwitch({ nba, onChange, invalid, name }: { nba: boolean; onChange: (next: boolean) => void; invalid: boolean; name: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nba}
      aria-label={`${name} uses a nonblocking assignment`}
      aria-invalid={invalid || undefined}
      onClick={() => onChange(!nba)}
      className={cn(lineControlClass, invalid && "border-rose-400 bg-rose-500/20 text-rose-100")}
    >
      {nba ? "<=" : "="}
    </button>
  );
}

/* ========================================================================= */
/* Shared views: issues, narration, storage, lanes, log                       */
/* ========================================================================= */

function IssueList({ issues, testId = "issues" }: { issues: CompileIssue[]; testId?: string }) {
  if (!issues.length) return null;
  return (
    <div role="alert" data-testid={testId} className="rounded-xl border border-rose-500/60 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
      <ul className="space-y-1">
        {issues.map((issue, i) => (
          <li key={i} className="[font-variant-ligatures:none]">
            <span aria-hidden>✕ </span>
            <strong>Compile error ({issue.clause}):</strong> {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Keeps wide content scrollable inside its own frame. While the content overflows
 * the frame is a named, focusable region, so the arrow keys scroll it.
 */
function ScrollFrame({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} data-testid="scroll-frame" className={cn("overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...(scrolls ? { role: "region", tabIndex: 0, "aria-label": `Scrollable: ${label}` } : {})}>
      {children}
    </div>
  );
}

const kindLabels: Record<SubStep["kind"], string> = {
  start: "Start",
  enter: "Call starts",
  exec: "Executes",
  wait: "Waits",
  advance: "Time advances",
  print: "Output",
  return: "Returns",
  nba: "NBA update",
  watch: "always wakes",
  fork: "Fork",
  join: "Join",
  end: "End",
};

function Narration({ step }: { step: SubStep }) {
  return (
    <div data-testid="narration" className="rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-200">{kindLabels[step.kind]}</span>
        {step.clause ? <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">{step.clause}</span> : null}
        {step.choice ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200" title="The standard leaves this order open (§4.7)">
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

function boxTitle(box: StorageBox, run: SubroutineRun): string {
  if (box.owner === "static") return `${box.sub}: the one shared copy`;
  const act = run.activations.find((a) => a.id === box.owner);
  if (!act) return `activation ${box.owner}`;
  // A ref formal is not copied (§13.5.2), so a box holding only refs is bindings, not a copy.
  const holds = box.vars.length === 0 && box.refs.length > 0 ? "references" : "own copy";
  return `call ${act.ordinal}'s ${holds} (${act.label})`;
}

/** Where every variable of the subroutines lives right now. */
function StoragePanel({ step, run }: { step: SubStep; run: SubroutineRun }) {
  const summary = step.boxes.length
    ? step.boxes
        .map((b) => `${boxTitle(b, run)}${b.alive ? "" : " (dropped)"}: ${[...b.vars.map((x) => `${x.name} = ${formatValue(x.value)}`), ...b.refs.map((r) => `${r.name} is ${r.target}`)].join(", ")}`)
        .join("; ")
    : "no subroutine storage exists";
  return (
    <section aria-label="Subroutine storage" data-testid="storage" className="rounded-xl border border-border/70 bg-background/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Storage at t = {step.time} ns</p>
      <p className="sr-only">{summary}</p>
      {step.boxes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No activation is open and nothing is static: no subroutine storage exists right now.</p>
      ) : (
        <ul className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {step.boxes.map((box) => (
            <li
              key={box.id}
              data-testid={`box-${box.id}`}
              data-alive={box.alive}
              className={cn(
                "min-w-0 rounded-lg border p-2 transition-opacity duration-200 motion-reduce:transition-none",
                box.owner === "static" ? "border-amber-500/60 bg-amber-500/[0.07]" : "border-cyan-500/50 bg-cyan-500/[0.06]",
                !box.alive && "border-dashed opacity-50",
              )}
            >
              <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-foreground">
                <span aria-hidden>{box.owner === "static" ? "▣" : "▢"}</span>
                {boxTitle(box, run)}
                {!box.alive ? <span className="rounded bg-rose-500/15 px-1 text-[10px] uppercase tracking-wider text-rose-800 dark:text-rose-200">{box.vars.length ? "dropped at return" : "ended at return"}</span> : null}
              </p>
              {box.owner === "static" && box.activations.length > 1 ? (
                <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">shared by {box.activations.length} activations at once</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {box.vars.map((x) => (
                  <ValueChip key={x.name} name={x.name} value={x.type === "string" && x.value !== "X" ? `"${x.value}"` : x.value} changed={x.changed} />
                ))}
                {box.refs.map((r) => (
                  <span
                    key={r.name}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-500/60 bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-900 dark:text-violet-100"
                  >
                    <span aria-hidden className="inline-flex items-center gap-1">
                      {r.name} ≡ {r.target}
                      <span className="text-[10px] opacity-80">{r.direction}</span>
                    </span>
                    <span className="sr-only">
                      {r.name} is a {r.direction} to {r.target}: one variable, two names
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ticks(max: number): number[] {
  const stepSize = max <= 12 ? 2 : max <= 30 ? 5 : 10;
  const out: number[] = [];
  for (let t = 0; t <= max; t += stepSize) out.push(t);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** One lane per call over simulation time, grown up to the current step. */
function CallLanes({ run, step }: { run: SubroutineRun; step: SubStep }) {
  const reduced = usePrefersReducedMotion();
  const acts = step.activations.filter((a) => a.kind === "task");
  if (acts.length === 0) return null;
  // Ordinals count per subroutine, so a bench with several tasks names the task in the lane.
  const severalTasks = new Set(run.activations.filter((a) => a.kind === "task").map((a) => a.sub)).size > 1;
  const laneLabel = (a: (typeof acts)[number]) => (severalTasks ? `${a.sub} ${a.ordinal}` : `call ${a.ordinal}`);
  const maxTime = Math.max(run.endTime, 1);
  const x0 = 96;
  const x1 = 400;
  const rowH = 26;
  const top = 24;
  const xOf = (t: number) => x0 + (t / maxTime) * (x1 - x0);
  const height = top + acts.length * rowH + 8;
  const summary = acts
    .map((a) => `${laneLabel(a)}, ${a.label}, ${a.endTime !== undefined && a.endTime <= step.time ? `ran from ${a.startTime} to ${a.endTime} ns` : `started at ${a.startTime} ns and is still running`}`)
    .join("; ");
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <ScrollFrame label="call lanes">
        <svg viewBox={`0 0 ${x1 + 20} ${height}`} role="img" aria-label={`Call lanes up to t = ${step.time} ns: ${summary}.`} className="w-full min-w-[380px] text-foreground">
          {ticks(maxTime).map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={top - 6} y2={height - 4} className="stroke-border" strokeWidth={1} />
              <text x={xOf(t)} y={top - 10} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                {t}
              </text>
            </g>
          ))}
          <text x={6} y={top - 10} fontSize={10} fill="currentColor" fillOpacity={0.6}>
            t (ns) →
          </text>
          {acts.map((a, i) => {
            const y = top + i * rowH + rowH / 2;
            const end = a.endTime !== undefined && a.endTime <= step.time ? a.endTime : step.time;
            const started = a.startTime <= step.time;
            const prints = step.log.filter((l) => l.activationId === a.id);
            return (
              <g key={a.id}>
                <text x={6} y={y + 4} fontSize={11} fill="currentColor" className="font-mono [font-variant-ligatures:none]" fontWeight={step.activationId === a.id ? 700 : 400}>
                  {laneLabel(a)}
                </text>
                {started ? (
                  <rect
                    x={xOf(a.startTime)}
                    y={y - 5}
                    width={Math.max(3, xOf(end) - xOf(a.startTime))}
                    height={10}
                    rx={3}
                    className={cn(a.endTime !== undefined && a.endTime <= step.time ? "fill-emerald-500/60" : "fill-cyan-500/70", !reduced && "transition-all duration-200")}
                  />
                ) : null}
                {prints.map((l, k) => (
                  <circle key={k} cx={xOf(l.time)} cy={y} r={3.5} className="fill-background stroke-cyan-600 dark:stroke-cyan-300" strokeWidth={1.5} />
                ))}
                {a.endTime !== undefined && a.endTime <= step.time ? (
                  <text x={xOf(a.endTime) + 5} y={y + 4} fontSize={11} className="fill-emerald-700 dark:fill-emerald-300">
                    ✓
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={xOf(step.time)} x2={xOf(step.time)} y1={top - 4} y2={height - 4} strokeDasharray="4 3" className="stroke-cyan-600 dark:stroke-cyan-300" strokeWidth={1.5} />
        </svg>
      </ScrollFrame>
      <figcaption className="px-1 pt-1 text-[11px] text-muted-foreground">Horizontal axis: simulation time (ns). Bar = the call is active; ● = it printed; ✓ = it returned. The dashed cursor marks the current step.</figcaption>
    </figure>
  );
}

/** `emphasizeLast` tints the newest line of a log that grows; a finished log has no line to single out. */
function LogPanel({ lines, label = "Simulation output", testId = "log", emphasizeLast = true }: { lines: { time?: number; text: string }[]; label?: string; testId?: string; emphasizeLast?: boolean }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-border/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]">
      <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {lines.length === 0 ? (
        <span className="text-slate-400">(no output yet)</span>
      ) : (
        <ol className="space-y-0.5">
          {lines.map((l, i) => (
            <li key={i} className={cn("flex gap-3", emphasizeLast && i === lines.length - 1 && "text-cyan-200")}>
              {l.time !== undefined ? <span className="w-12 shrink-0 text-right text-slate-400">{l.time} ns</span> : null}
              <span className="whitespace-pre-wrap break-words">{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** A SegmentedControl names itself only to assistive technology, so this shows that name; hidden from them, or they would hear it twice. */
function ControlCaption({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span aria-hidden className="font-mono text-xs font-semibold text-muted-foreground [font-variant-ligatures:none]">
        {text}
      </span>
      {children}
    </div>
  );
}

/* ========================================================================= */
/* The synchronised trace view                                                */
/* ========================================================================= */

interface TracePrediction {
  question: React.ReactNode;
  options: PredictionOption[];
  /** Shown inside the reveal, above the playback (for example the outcome groups). */
  intro?: React.ReactNode;
  /** Re-asks the question when this changes. Defaults to the playback reset key; pass a coarser key so choosing a run to step through keeps the reveal open. */
  resetKey?: string;
}

interface TraceViewProps {
  bench: Bench;
  /** Absent when the bench does not compile: the code stays, and `issues` replace the run. */
  run?: SubroutineRun;
  issues?: CompileIssue[];
  issuesTestId?: string;
  resetKey: string;
  controls?: Record<string, React.ReactNode>;
  codeLabel?: string;
  stepNoun?: string;
  lanes?: boolean;
  storage?: boolean;
  /** Predict-then-reveal gate: the code (with its controls) stays visible; playback, narration, storage and output wait behind it. */
  prediction?: TracePrediction;
  /** A line key that changes with a control (`sub:fact_static`, `sub:fact_auto`), mapped to one stable key so the line and its focused control stay mounted. */
  keyAlias?: Record<string, string>;
  /** Extra views that read the same step. */
  children?: (step: SubStep, index: number) => React.ReactNode;
}

/** Rendered only inside a prompt's reveal, so it reports a commit and a skip alike, and clears when the prompt re-arms. */
function RevealSignal({ revealKey, onChange }: { revealKey: string; onChange: (key: string | null) => void }) {
  useEffect(() => {
    onChange(revealKey);
    return () => onChange(null);
  }, [revealKey, onChange]);
  return null;
}

function TraceView({ bench, run, issues = [], issuesTestId, resetKey, controls, codeLabel = "Code under simulation", stepNoun = "Step", lanes = false, storage = true, prediction, keyAlias, children }: TraceViewProps) {
  const stepCount = run?.trace.length ?? 1;
  const playback = usePlayback(stepCount, resetKey);
  const index = Math.min(playback.index, stepCount - 1);
  const step = run?.trace[index];
  const promptKey = prediction?.resetKey ?? resetKey;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  // Comments in the code can state a prediction's answer, so they wait for the reveal. Comparing keys keeps them hidden in the very render that re-arms the prompt.
  const revealed = Boolean(run) && (!prediction || revealedKey === promptKey);
  const lines = useMemo<CodeTraceLine[]>(() => benchSource(bench, { comments: revealed }).map((l) => ({ text: l.text, key: l.key === undefined ? undefined : keyAlias?.[l.key] ?? l.key })), [bench, revealed, keyAlias]);
  const alias = (key?: string) => (key === undefined ? undefined : keyAlias?.[key] ?? key);
  const contextKeys = step ? step.callStack.flatMap((id) => alias(`sub:${run?.activations.find((a) => a.id === id)?.sub}`) ?? []) : [];
  const activeKey = alias(step ? step.lineKey : issues[0]?.key);
  const body =
    run && step ? (
      <div className="space-y-3" data-testid="trace-body">
        <PlaybackControls playback={playback} stepCount={run.trace.length} stepNoun={stepNoun} describeStep={(i) => (run.trace[i] ? `${kindLabels[run.trace[i].kind]}, t = ${run.trace[i].time} ns` : "")} />
        <Narration step={step} />
        {lanes ? <CallLanes run={run} step={step} /> : null}
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {storage ? <StoragePanel step={step} run={run} /> : null}
          <LogPanel lines={step.log} />
        </div>
        {children ? children(step, index) : null}
      </div>
    ) : null;
  return (
    <div className="space-y-3" data-testid="trace-view">
      <CodeTrace label={codeLabel} lines={lines} activeKey={activeKey} contextKeys={contextKeys} renderLineControl={controls ? (line) => (line.key ? controls[line.key] ?? null : null) : undefined} />
      {!run ? (
        <IssueList issues={issues} testId={issuesTestId} />
      ) : prediction ? (
        <PredictionPrompt resetKey={promptKey} question={prediction.question} options={prediction.options}>
          <RevealSignal revealKey={promptKey} onChange={setRevealedKey} />
          {prediction.intro ? <div className="mb-3">{prediction.intro}</div> : null}
          {body}
        </PredictionPrompt>
      ) : (
        body
      )}
      {/* Mounted from the first render: Next, Previous and Play change the step without moving focus, and a region that mounts with its text is unreliable. */}
      <p role="status" aria-live="polite" data-testid="step-live" className="sr-only">
        {revealed && step ? (playback.isPlaying ? step.what : `${step.what} Why: ${step.why}`) : ""}
      </p>
    </div>
  );
}

/** Runs a bench, or reports why it does not compile. */
function useBench(bench: Bench): { issues: CompileIssue[]; run?: SubroutineRun } {
  return useMemo(() => {
    const issues = compileBench(bench);
    return issues.length ? { issues } : { issues, run: simulateBench(bench) };
  }, [bench]);
}

/* ========================================================================= */
/* Mode: lifetime                                                             */
/* ========================================================================= */

type SendVerdict = ReturnType<typeof sendVerdict>;

function sendOptions(lifetime: Lifetime, at: SecondCallAt, verdict: SendVerdict, debugPrints: boolean): PredictionOption[] {
  // The line the code on screen prints: the debug prints change its format, with three spaces after "use".
  const printLine = (id: number) => (debugPrints ? `t=10 use   id=${id}` : `t=10 id=${id}`);
  const staticOverlap = lifetime === "static" && at === 2;
  const staticNoOverlap = lifetime === "static" && at === 12;
  const tie = lifetime === "static" && at === 10;
  return [
    {
      id: "id1",
      label: (
        <>
          <code className={cn(code, "whitespace-pre")}>{printLine(1)}</code>: call 1 prints the value it was called with
        </>
      ),
      correct: verdict === "id=1",
      feedback:
        lifetime === "automatic"
          ? "An automatic task replicates id for every activation, so call 2's copy-in cannot touch call 1's copy (§13.3.2)."
          : staticNoOverlap
            ? "Call 2 starts at t = 12 ns, after call 1 returned, so nothing overwrote the shared id before t = 10. Here the overlap is what does the harm: send only reads id, and each call rewrites it at copy-in, so this bug comes and goes with timing. A static local that carries a value between calls still misbehaves without overlap (see count_ones) (§13.3.2)."
            : tie
              ? "Possible, but not certain: at t = 10 ns call 1's print and call 2's copy-in are both ready, and §4.7 leaves their order to the simulator."
              : "That needs each call to keep its own id. This task has no lifetime keyword, so in a module it is static: one shared id, and call 2 wrote 2 into it at t = 2 ns while call 1 was still waiting (§13.3.1, §13.3.2).",
    },
    {
      id: "id2",
      label: (
        <>
          <code className={cn(code, "whitespace-pre")}>{printLine(2)}</code>: call 1 prints the value call 2 passed
        </>
      ),
      correct: verdict === "id=2",
      feedback: staticOverlap
        ? "Call 2 copied 2 into the one shared id at t = 2 ns while call 1 waited at #10, so call 1 printed another call's argument (§13.3.2)."
        : lifetime === "automatic"
          ? "An automatic task gives every activation its own id; call 2's write lands in call 2's copy only (§13.3.2)."
          : staticNoOverlap
            ? "By t = 12 ns, when call 2 copies 2 in, call 1 has already printed. Here the overlap is what does the harm: send only reads id, and each call rewrites it at copy-in. A static local that carries a value between calls still misbehaves without overlap (see count_ones) (§13.3.2)."
            : "Possible, but only in one of the two orders §4.7 allows at t = 10 ns.",
    },
    {
      id: "either",
      label: "Either: it depends on the order the simulator picks at t = 10 ns",
      correct: verdict === "either",
      feedback: tie
        ? "At t = 10 ns two processes are ready at once: call 1 waking to print, and the forked branch calling send(2), which copies 2 into the shared id. §4.7 lets the simulator run them in any order, so id=1 and id=2 are both legal outputs."
        : lifetime === "automatic"
          ? at === 10
            ? "The order at t = 10 ns can change which log line comes first, but not what call 1 prints: call 1 prints its own copy, which only call 1 ever wrote (§13.3.2)."
            : "No tie here, and the order would not matter: call 1 prints its own copy, which only call 1 ever wrote (§13.3.2)."
          : staticOverlap
            ? "No tie here: the overwrite at t = 2 ns happens 8 ns before the print, in a different time slot."
            : "No tie here: call 2 starts 2 ns after call 1 printed.",
    },
    {
      id: "error",
      label: "A compile error: two calls of a static task may not overlap",
      correct: false,
      feedback: "The standard allows it: §13.3.2 describes concurrent activations of a static task and says they share one copy of each variable. The code is legal and does the wrong thing silently.",
    },
  ];
}

function LifetimeSendLab() {
  const [lifetime, setLifetime] = useState<Lifetime>("static");
  const [at, setAt] = useState<SecondCallAt>(2);
  const [debugPrints, setDebugPrints] = useState(false);
  const [selected, setSelected] = useState(0);
  const bench = useMemo(() => sendBench({ lifetime, secondCallAt: at, debugPrints }), [lifetime, at, debugPrints]);
  const exploration = useMemo<BenchExploration>(() => exploreBench(bench), [bench]);
  const verdict = sendVerdict(exploration);
  const resetKey = `${lifetime}:${at}:${debugPrints}`;
  const outcomes = exploration.outcomes;
  const outcome = outcomes[Math.min(selected, outcomes.length - 1)];
  const controls: Record<string, React.ReactNode> = {
    "sub:send": (
      <LifetimeSwitch
        sub="send"
        lifetime={lifetime}
        onChange={(next) => {
          setLifetime(next);
          setSelected(0);
        }}
      />
    ),
  };
  // Automatic outcomes can differ only in which line prints first; what call 1 prints never changes.
  const logOrderOnly = outcomes.length > 1 && verdict !== "either";
  const groups = outcomes.map((o) => {
    const firstAtTen = o.result.log.find((l) => l.time === 10);
    const callOneFirst = firstAtTen?.activationId === callOneActivation(o.result)?.id;
    return {
      id: o.signature,
      title: `call 1 prints ${callOnePrint(o.result)}${logOrderOnly ? ` (log order only: ${callOneFirst ? "call 1's line comes first" : "call 2's enter line comes first"})` : ""}`,
      runCount: o.runs.length,
      lines: o.result.log.map((l) => ({ time: `t = ${l.time} ns`, text: l.text })),
    };
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <ControlCaption text="Call 2 starts:">
          <SegmentedControl<`${SecondCallAt}`>
            label="When call 2 starts"
            mono
            options={SECOND_CALL_OPTIONS.map((t) => ({ value: `${t}` as `${SecondCallAt}`, label: `#${t} send(2)`, ariaLabel: `#${t}: call 2 starts at t = ${t} ns` }))}
            value={`${at}` as `${SecondCallAt}`}
            onChange={(value) => {
              setAt(Number(value) as SecondCallAt);
              setSelected(0);
            }}
          />
        </ControlCaption>
        <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={debugPrints}
            onChange={(e) => {
              setDebugPrints(e.target.checked);
              setSelected(0);
            }}
            className="h-4 w-4 accent-cyan-500"
          />
          Add the enter/use debug prints
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        The lifetime keyword is a switch on the <code className={code}>task send</code> line below. Changing it, the start time or the debug prints re-runs the model and asks the question again.
      </p>
      <TraceView
        bench={bench}
        run={outcome.result}
        resetKey={`${resetKey}:${outcome.signature}`}
        controls={controls}
        stepNoun="Simulation step"
        lanes
        prediction={{
          resetKey,
          question: "What does call 1 print at t = 10 ns?",
          options: sendOptions(lifetime, at, verdict, debugPrints),
          intro:
            outcomes.length > 1 || exploration.runCount > 1 ? (
              <OutcomeGroups
                label="Outcomes across orders"
                groups={groups}
                runCount={exploration.runCount}
                onSelect={(id) => setSelected(Math.max(0, outcomes.findIndex((o) => o.signature === id)))}
                selectedId={outcome.signature}
                selectLabel="Step through this order"
                nondeterminism="region-order"
                note={
                  logOrderOnly
                    ? "Only the order of the log lines differs. At t = 10 ns call 1 wakes to print and the second branch calls send(2): two processes, one time slot, order unspecified. send(2) writes only its own id, so call 1 prints id=1 in every order (§13.3.2)."
                    : outcomes.length > 1
                    ? "At t = 10 ns call 1 wakes to print and the second branch calls send(2), which copies 2 into the shared id: two processes, one time slot, order unspecified."
                    : at === 12 && lifetime === "static"
                      ? "The static task prints correctly here because the calls never overlap: the same code fails as soon as the timing brings them together."
                      : undefined
                }
              />
            ) : undefined,
        }}
      />
    </div>
  );
}

function countOnesOptions(lifetime: Lifetime): PredictionOption[] {
  return [
    {
      id: "one",
      label: "1: it counts the single set bit of 8'h01",
      correct: lifetime === "automatic",
      feedback:
        lifetime === "automatic"
          ? "Every call of an automatic function gets a fresh n at its default 0, so the second call counts only 8'h01's one bit (§13.4.2, §6.21, §6.8)."
          : "That needs n to start at 0 again. In a static function n is set to 0 once, at time 0, and keeps the 8 the first call left behind (§13.4.2, §6.21).",
    },
    {
      id: "nine",
      label: "9: the 8 from the first call, plus one",
      correct: lifetime === "static",
      feedback:
        lifetime === "static"
          ? "A static function's variables keep their values between calls: n still held 8 when the second call started, and one more bit made 9 (§13.4.2, §6.21)."
          : "That is the static result. With automatic, n is re-initialized to 0 on each entry to the call (§13.4.2, §6.21).",
    },
    { id: "eight", label: "8: the same as the first call", correct: false, feedback: "8 was the first call's result. The second call counts 8'h01, which has one bit set, on top of whatever n holds when it starts." },
    { id: "x", label: "X: n was never initialized", correct: false, feedback: "n is an int, a 2-state type: it starts at 0, never at x (§6.8, Table 6-7). The question is whether that 0 is restored for the second call." },
  ];
}

function LifetimeInitializersLab() {
  const [lifetime, setLifetime] = useState<Lifetime>("static");
  const [checkLifetime, setCheckLifetime] = useState<Lifetime>("static");
  const [qualifier, setQualifier] = useState<Qualifier | "none">("none");
  const onesBench = useMemo(() => countOnesBench(lifetime), [lifetime]);
  const onesRun = useMemo(() => simulateBench(onesBench), [onesBench]);
  const callsBench = useMemo(() => countCallsBench(), []);
  const callsRun = useMemo(() => simulateBench(callsBench), [callsBench]);
  const verdict = checkInitializer(checkLifetime, qualifier);
  const checkLines: CodeTraceLine[] = [
    { text: `task ${checkLifetime === "automatic" ? "automatic " : ""}count_calls();`, key: "check-task" },
    { text: `  ${verdict.source}`, key: "check-decl" },
    { text: "  calls++;" },
    { text: "endtask" },
  ];
  const checkControls: Record<string, React.ReactNode> = {
    "check-task": <LifetimeSwitch sub="count_calls" lifetime={checkLifetime} onChange={setCheckLifetime} />,
    "check-decl": (
      <LineSelect<Qualifier | "none">
        label="Lifetime qualifier of calls"
        testId="qualifier-select"
        value={qualifier}
        invalid={!verdict.ok}
        onChange={setQualifier}
        options={[
          { value: "none", label: "(none)" },
          { value: "static", label: "static" },
          { value: "automatic", label: "automatic" },
        ]}
      />
    ),
  };
  return (
    <div className="space-y-6">
      <section aria-label="count_ones called twice" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Two calls: count_ones(8'hFF), then count_ones(8'h01)</h4>
        <TraceView
          bench={onesBench}
          run={onesRun}
          resetKey={lifetime}
          controls={{ "sub:count_ones": <LifetimeSwitch sub="count_ones" lifetime={lifetime} onChange={setLifetime} /> }}
          stepNoun="Simulation step"
          prediction={{ question: "What does the second call, count_ones(8'h01), return?", options: countOnesOptions(lifetime) }}
        />
      </section>
      <section aria-label="count_calls called three times" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          <code className={code}>static int total = 0;</code> beside <code className={code}>automatic int this_call = 0;</code>
        </h4>
        <p className="text-sm text-muted-foreground">The static total is initialized once, at time 0, and keeps counting; the automatic this_call is initialized again at the start of every call. Watch the two boxes side by side.</p>
        <TraceView bench={callsBench} run={callsRun} resetKey="count-calls" stepNoun="Simulation step" />
      </section>
      <section aria-label="Initializer rule" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Pick the qualifier: which declarations compile?</h4>
        <CodeTrace label="A declaration with an initializer" lines={checkLines} activeKey={verdict.ok ? undefined : "check-decl"} renderLineControl={(line) => (line.key ? checkControls[line.key] ?? null : null)} />
        <p
          role="status"
          data-testid="initializer-verdict"
          className={cn("rounded-xl border p-3 text-sm [font-variant-ligatures:none]", verdict.ok ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "border-rose-500/60 bg-rose-500/10 text-rose-900 dark:text-rose-100")}
        >
          <span aria-hidden>{verdict.ok ? "✓ " : "✕ "}</span>
          <code className={code}>{verdict.source}</code> {verdict.message} <span className="text-muted-foreground">({verdict.clause})</span>
        </p>
      </section>
    </div>
  );
}

/* ========================================================================= */
/* Mode: recursion                                                            */
/* ========================================================================= */

type RecursionPreset = "fact" | "sum_to";

function recursionOptions(preset: RecursionPreset, lifetime: Lifetime, n: number, actual: Value | undefined): PredictionOption[] {
  const staticValue = preset === "fact" ? 1 : 0;
  const autoValue = preset === "fact" ? factorial(n) : (n * (n + 1)) / 2;
  const decoy = preset === "fact" ? 0 : n;
  const fn = preset === "fact" ? (lifetime === "static" ? "fact_static" : "fact_auto") : "sum_to";
  const local = preset === "fact" ? "rest" : "partial";
  // fact(1) is the base case: no inner call runs, so no n is overwritten and the two lifetimes agree. The merged option says so whichever lifetime is on.
  const agree = staticValue === autoValue;
  const baseCase = `n = ${n} is the base case (n <= 1): ${fn}(${n}) returns ${staticValue} without any recursive call, so no inner call can overwrite n and the lifetime makes no difference (§13.4.2).`;
  const sumLabel = n === 1 ? " (just 1)" : n === 2 ? " (1 + 2)" : ` (1 + … + ${n})`;
  const candidates: { id: string; value: number; label: string; feedbackWhenCorrect: string; feedbackWhenWrong: string }[] = [
    {
      id: "static",
      value: staticValue,
      label: `${staticValue}`,
      feedbackWhenCorrect: agree
        ? baseCase
        : preset === "fact"
          ? "Every level above the base case reads the shared n after its inner call returned, and by then the innermost call has set n to 1, so each of those returns is rest × 1 = 1 (§13.4.2)."
          : "Every level above the base case reads the shared n after its inner call returned, and by then the innermost call has set n to 0, so each of those returns is partial + 0 = 0 (§13.4.2).",
      feedbackWhenWrong: `That is the static result. An automatic function gives every activation its own n, so each level ${preset === "fact" ? "multiplies by" : "adds"} the n it was called with (§13.4.2).`,
    },
    {
      id: "auto",
      value: autoValue,
      label: `${autoValue}${preset === "fact" ? ` (${n}!)` : sumLabel}`,
      feedbackWhenCorrect: agree ? baseCase : `Each activation keeps its own n and ${local}, so the returns build up to ${autoValue} (§13.4.2).`,
      feedbackWhenWrong: `That needs one n per activation. ${fn} is static: one shared n, overwritten by every inner call before the outer level reads it (§13.4.2).`,
    },
    {
      id: "decoy",
      value: decoy,
      label: `${decoy}`,
      feedbackWhenCorrect: "",
      feedbackWhenWrong:
        preset === "fact"
          ? n <= 1
            ? "Nothing produces 0: n <= 1 is the base case, which returns 1 before rest is ever read or written."
            : "Nothing produces 0: rest starts at the int default 0 but is assigned from the inner call before it is read, and the base case returns 1."
          : "Only the outermost n would give that. Each level adds its n to the partial sum it received; the question is which n each level reads.",
    },
  ];
  const seen = new Set<number>();
  const options: PredictionOption[] = [];
  candidates.forEach((cand) => {
    if (seen.has(cand.value)) return;
    seen.add(cand.value);
    const correct = actual === cand.value;
    options.push({ id: cand.id, label: cand.label, correct, feedback: correct ? cand.feedbackWhenCorrect || cand.feedbackWhenWrong : cand.feedbackWhenWrong });
  });
  // Ascending by value: the order says nothing about which one is right.
  options.sort((x, y) => parseInt(String(x.label), 10) - parseInt(String(y.label), 10));
  // Each sentence is about the state on screen: only a static function that recursed returns a wrong value.
  const returned = formatValue(actual);
  options.push({
    id: "error",
    label: `A compile error: ${fn} may not call itself`,
    correct: false,
    feedback: agree
      ? `§13.4.2 does not forbid the recursive call, in either lifetime. n = ${n} reaches the base case, so it compiles and returns ${returned}, the correct value.`
      : lifetime === "automatic"
        ? `${fn} is automatic, so it is reentrant (§13.4.2). It compiles and returns ${returned}, the correct value.`
        : `§13.4.2 makes an automatic function reentrant and a static function's items shared across concurrent uses; it does not forbid the static call. The code compiles and returns the wrong value: ${returned}, not ${autoValue}.`,
  });
  return options;
}

function RecursionTable({ run, index }: { run: SubroutineRun; index: number }) {
  const rows = useMemo(() => recursionTable(run), [run]);
  if (!rows.length) return null;
  const current = rows.reduce((best, row) => (row.traceIndex <= index ? row : best), rows[0]);
  const active = rows[0].traceIndex <= index ? current : undefined;
  const sharedStatic = run.activations[0]?.lifetime === "static";
  const local = rows[0].restAfter !== undefined && run.benchId.startsWith("sum-to") ? "partial" : "rest";
  return (
    <ScrollFrame label="recursion trace table" className="rounded-xl border border-border/70">
      <table className="w-full text-left text-xs" data-testid="recursion-table">
        <caption className="sr-only">Trace of the recursion, one row per entry and per return; the base case's entry and return share one row</caption>
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Step
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Running
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              What it does
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              {sharedStatic ? "Shared n after" : "Its n after"}
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              {sharedStatic ? `Shared ${local} after` : `Its ${local} after`}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isCurrent = active?.step === row.step;
            return (
              <tr key={row.step} aria-current={isCurrent ? "step" : undefined} className={cn("border-t border-border/50 transition-colors motion-reduce:transition-none", isCurrent && "bg-cyan-500/15")}>
                <td className="px-2 py-1.5 font-mono">{row.step}</td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono [font-variant-ligatures:none]">{row.running}</td>
                <td className="px-2 py-1.5 [font-variant-ligatures:none]">{row.does}</td>
                <td className="px-2 py-1.5 font-mono">{row.nAfter}</td>
                <td className="px-2 py-1.5 font-mono">{row.restAfter}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollFrame>
  );
}

function RecursionLab({ preset }: { preset: RecursionPreset }) {
  const [lifetime, setLifetime] = useState<Lifetime>("static");
  const [n, setN] = useState(preset === "fact" ? 4 : 3);
  const bench = useMemo(() => (preset === "fact" ? factBench({ lifetime, n }) : sumToBench({ lifetime, n })), [preset, lifetime, n]);
  const run = useMemo(() => simulateBench(bench), [bench]);
  const actual = outerReturnValue(run);
  const fn = bench.subs[0].name;
  const resetKey = `${preset}:${lifetime}:${n}`;
  // fact_static and fact_auto are one line of code: the switch on it keeps its focus when the name changes.
  const keyAlias = useMemo(() => ({ [`sub:${fn}`]: "sub:recursive" }), [fn]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <ControlCaption text="n =">
          <SegmentedControl<string> label="n" mono options={[1, 2, 3, 4, 5].map((k) => ({ value: `${k}`, label: `${k}` }))} value={`${n}`} onChange={(value) => setN(Number(value))} />
        </ControlCaption>
        <p className="text-xs text-muted-foreground">The lifetime keyword is a switch on the function line below.</p>
      </div>
      <TraceView
        bench={bench}
        run={run}
        resetKey={resetKey}
        controls={{ "sub:recursive": <LifetimeSwitch sub={fn} lifetime={lifetime} onChange={setLifetime} /> }}
        keyAlias={keyAlias}
        stepNoun="Call step"
        prediction={{
          question: (
            <>
              What does <code className={code}>{`${fn}(${n})`}</code> return?
            </>
          ),
          options: recursionOptions(preset, lifetime, n, actual),
        }}
      >
        {(_step, index) => <RecursionTable run={run} index={index} />}
      </TraceView>
    </div>
  );
}

/* ========================================================================= */
/* Mode: directions                                                           */
/* ========================================================================= */

const DIRECTION_OPTIONS = ["input", "output", "inout", "ref", "const ref"].map((d) => ({ value: d as Direction, label: d }));

const valuesText = (values: Record<string, Value>) => Object.values(DIR_ACTUALS).map((name) => `${name}=${formatValue(values[name])}`).join(" ");

type DirValues = Record<string, Value>;
type DirSummary = ReturnType<typeof directionsSummary>;

/** What `f`'s current direction does to its actual, in one clause (§13.3, §13.3.2, §13.5.2). */
function explainDirection(f: DirName, d: Direction, summary: DirSummary): string {
  const actual = DIR_ACTUALS[f];
  switch (d) {
    case "input":
      return `${f} is input: ${actual} is copied into ${f} at the call and never copied back, so ${actual} stays ${DIR_INITIAL}`;
    case "output":
      return `${f} is output: it starts at the int default 0 (not at ${actual}'s ${DIR_INITIAL}) and is copied out at the return, so ${actual} becomes ${formatValue(summary.after[actual])} only at t = 10 ns`;
    case "inout":
      return `${f} is inout: copied in from ${actual} and copied back at the return, so ${actual} becomes ${formatValue(summary.after[actual])} at t = 10 ns`;
    case "ref":
      return `${f} is ref: ${f} is ${actual} itself, so ${actual} shows ${formatValue(summary.during[actual])} already at t = 5 ns`;
    default:
      return `${f} is a const ref: read-only`;
  }
}

/**
 * The correct answer plus one decoy per misconception, each derived from the
 * directions as they stand: the decoy's values are the ones the misconception
 * would predict for the formals it concerns, and its feedback explains those
 * same formals. A misconception that concerns no formal, or predicts the
 * actual values, is dropped.
 */
function directionOptions(summary: DirSummary, directions: Record<DirName, Direction>): PredictionOption[] {
  const candidates: { id: string; during: DirValues; after: DirValues; feedback: string }[] = [
    { id: "actual", during: summary.during, after: summary.after, feedback: `${DIR_FORMALS.map((f) => explainDirection(f, directions[f], summary)).join("; ")} (§13.3, §13.3.2, §13.5.2).` },
  ];
  const misconception = (id: string, concerns: (d: Direction) => boolean, predict: (f: DirName, during: DirValues, after: DirValues) => void, explain: (f: DirName) => string, preface: string) => {
    const hit = DIR_FORMALS.filter((f) => concerns(directions[f]));
    if (!hit.length) return;
    const during: DirValues = { ...summary.during };
    const after: DirValues = { ...summary.after };
    hit.forEach((f) => predict(f, during, after));
    candidates.push({ id, during, after, feedback: `${preface} ${hit.map(explain).join("; ")}.` });
  };
  misconception(
    "ref-late",
    (d) => d === "ref",
    (f, during) => {
      during[DIR_ACTUALS[f]] = DIR_INITIAL;
    },
    (f) => `${f} is ref, and a ref is not copied: ${f} is ${DIR_ACTUALS[f]} itself, so ${DIR_ACTUALS[f]} shows ${formatValue(summary.during[DIR_ACTUALS[f]])} already at t = 5 ns, while the task is still waiting (§13.5.2)`,
    "Only output and inout wait for the return.",
  );
  misconception(
    "output-copied-in",
    (d) => d === "output",
    (f, _during, after) => {
      after[DIR_ACTUALS[f]] = DIR_INITIAL + DIR_ADDS[f];
    },
    (f) =>
      `${f} is output, and an output is not copied in: ${f} starts at 0, the int default, not at ${DIR_ACTUALS[f]}'s ${DIR_INITIAL}, so ${f} + ${DIR_ADDS[f]} is ${DIR_ADDS[f]} and ${DIR_ACTUALS[f]} becomes ${DIR_ADDS[f]} at t = 10 ns, not ${DIR_INITIAL + DIR_ADDS[f]} (§13.3.2)`,
    "Never read an output before you write it.",
  );
  misconception(
    "input-copied-back",
    (d) => d === "input",
    (f, _during, after) => {
      after[DIR_ACTUALS[f]] = DIR_INITIAL + DIR_ADDS[f];
    },
    (f) => `${f} is input: ${DIR_ACTUALS[f]} is copied into ${f} at the call and never copied back, so ${DIR_ACTUALS[f]} stays ${DIR_INITIAL} after the return (§13.3)`,
    "An input is a one-way copy.",
  );
  misconception(
    "all-ref",
    (d) => d !== "ref",
    (f, during, after) => {
      during[DIR_ACTUALS[f]] = DIR_INITIAL + DIR_ADDS[f];
      after[DIR_ACTUALS[f]] = DIR_INITIAL + DIR_ADDS[f];
    },
    (f) => explainDirection(f, directions[f], summary),
    "Only ref aliases the caller's variable.",
  );
  const seen = new Set<string>();
  const options: { signature: string; option: PredictionOption }[] = [];
  candidates.forEach((cand) => {
    const signature = `${valuesText(cand.during)}|${valuesText(cand.after)}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    options.push({
      signature,
      option: {
        id: cand.id,
        correct: cand.id === "actual",
        label: (
          <span className="font-mono text-xs [font-variant-ligatures:none]">
            <span className="block">t=5 during: {valuesText(cand.during)}</span>
            <span className="block">t=10 after: {valuesText(cand.after)}</span>
          </span>
        ),
        feedback: cand.feedback,
      },
    });
  });
  // The candidates are built answer first; the order shown comes only from the values each option states.
  return stableOptionOrder(options, (entry) => entry.signature).map((entry) => entry.option);
}

/** Caller and task storage side by side with the copy arrows of the current step. */
function DirectionsDiagram({ step, directions, lifetime }: { step: SubStep; directions: Record<DirName, Direction>; lifetime: Lifetime }) {
  const rowH = 34;
  const top = 36;
  // 520 units drawn at 470 px or wider: never below 0.9 scale (visual-language.md), so the labels stay readable at 390 px and the frame scrolls.
  const width = 520;
  const height = top + DIR_FORMALS.length * rowH + 12;
  const callerX = 16;
  const taskX = 316;
  const boxW = 188;
  const box = step.boxes.find((b) => b.sub === "show_dirs" && b.alive) ?? step.boxes.find((b) => b.sub === "show_dirs");
  // The task's storage is drawn whenever this step has a box for it: a static task's box always exists, with its values.
  const hasStorage = Boolean(box);
  // Copies happen only at a call and at its return (§13.3), so arrows need an open activation. The return step still lists the activation it is closing.
  const running = (box?.activations.length ?? 0) > 0;
  const copyIn = step.kind === "enter";
  const copyOut = step.kind === "return";
  const uid = useId().replace(/:/g, "");
  const arrowQuiet = `sub-arrow-quiet-${uid}`;
  const arrowLit = `sub-arrow-lit-${uid}`;
  const taskTitle = running ? `Task: show_dirs (${lifetime})` : hasStorage ? `Task: no call open (${lifetime})` : "Task: not running";
  const formalSummary = (f: DirName) => {
    const dir = directions[f];
    if (dir === "ref" || dir === "const ref") return running ? `${f} (${dir}) is ${DIR_ACTUALS[f]}` : `${f} (${dir}): no call open`;
    return `${f} (${dir}) = ${box ? formatValue(box.vars.find((x) => x.name === f)?.value) : "no storage"}`;
  };
  const summary = DIR_FORMALS.map((f) => `${DIR_ACTUALS[f]} = ${formatValue(step.globals[DIR_ACTUALS[f]])}, ${formalSummary(f)}`).join("; ");
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <ScrollFrame label="caller and task storage">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Caller and task storage at t = ${step.time} ns: ${summary}.`} className="w-full min-w-[470px] text-foreground">
          <defs>
            {/* A marker takes its colour from where it is defined, not from the arrow using it, so each colour has its own. */}
            <marker id={arrowQuiet} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
            </marker>
            <marker id={arrowLit} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-cyan-600 dark:fill-cyan-300" />
            </marker>
          </defs>
          <text x={callerX} y={16} fontSize={12} fontWeight={700} fill="currentColor">
            Caller: initial block (module variables)
          </text>
          <text x={taskX} y={16} fontSize={12} fontWeight={700} fill="currentColor">
            {taskTitle}
          </text>
          <rect x={callerX} y={top - 8} width={boxW} height={DIR_FORMALS.length * rowH + 8} rx={8} className="fill-amber-500/[0.06] stroke-amber-500/60" />
          {hasStorage ? <rect x={taskX} y={top - 8} width={boxW} height={DIR_FORMALS.length * rowH + 8} rx={8} className={cn(lifetime === "static" ? "fill-amber-500/[0.08] stroke-amber-500/70" : "fill-cyan-500/[0.06] stroke-cyan-500/60")} /> : null}
          {DIR_FORMALS.map((f, i) => {
            const y = top + i * rowH + rowH / 2;
            const actual = DIR_ACTUALS[f];
            const dir = directions[f];
            const isRef = dir === "ref" || dir === "const ref";
            const formalValue = box?.vars.find((x) => x.name === f)?.value;
            const callerValue = step.globals[actual];
            const showIn = (dir === "input" || dir === "inout") && running;
            const showOut = (dir === "output" || dir === "inout") && running;
            return (
              <g key={f}>
                {isRef && running ? (
                  <>
                    <rect x={callerX + 8} y={y - 12} width={taskX + boxW - callerX - 16} height={24} rx={6} className="fill-violet-500/10 stroke-violet-500/70" strokeDasharray={dir === "const ref" ? "4 3" : undefined} />
                    <text x={callerX + 16} y={y + 4} fontSize={12} className="font-mono [font-variant-ligatures:none]" fill="currentColor">
                      {actual} = {formatValue(callerValue)}
                    </text>
                    <text x={(callerX + taskX + boxW) / 2} y={y + 4} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.75}>
                      one variable, two names ({dir})
                    </text>
                    <text x={taskX + boxW - 16} y={y + 4} fontSize={12} textAnchor="end" className="font-mono [font-variant-ligatures:none]" fill="currentColor">
                      {f}
                    </text>
                  </>
                ) : (
                  <>
                    <text x={callerX + 12} y={y + 4} fontSize={12} className="font-mono [font-variant-ligatures:none]" fill="currentColor">
                      {actual} = {formatValue(callerValue)}
                    </text>
                    {hasStorage && !isRef ? (
                      <text x={taskX + 12} y={y + 4} fontSize={12} className="font-mono [font-variant-ligatures:none]" fill="currentColor">
                        {dir} {f} = {formatValue(formalValue)}
                      </text>
                    ) : null}
                    {showIn ? (
                      <g className={cn(copyIn ? "text-cyan-600 dark:text-cyan-300" : "text-muted-foreground")} fill="currentColor" stroke="currentColor">
                        <line x1={callerX + boxW + 4} y1={y - 4} x2={taskX - 6} y2={y - 4} strokeWidth={copyIn ? 2 : 1} markerEnd={`url(#${copyIn ? arrowLit : arrowQuiet})`} />
                        <text x={(callerX + boxW + taskX) / 2} y={y - 8} fontSize={10} textAnchor="middle" stroke="none">
                          copy in at the call
                        </text>
                      </g>
                    ) : null}
                    {showOut && copyOut ? (
                      <g className="text-cyan-600 dark:text-cyan-300" fill="currentColor" stroke="currentColor">
                        <line x1={taskX - 4} y1={y + 6} x2={callerX + boxW + 6} y2={y + 6} strokeWidth={2} markerEnd={`url(#${arrowLit})`} />
                        <text x={(callerX + boxW + taskX) / 2} y={y + 17} fontSize={10} textAnchor="middle" stroke="none">
                          copy out at the return
                        </text>
                      </g>
                    ) : null}
                    {showOut && !copyOut ? (
                      <text x={(callerX + boxW + taskX) / 2} y={y + 17} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                        no copy out yet
                      </text>
                    ) : null}
                    {dir === "input" && running ? (
                      <text x={(callerX + boxW + taskX) / 2} y={y + 17} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                        never copied back
                      </text>
                    ) : null}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </ScrollFrame>
      {/* The diagram scrolls inside its frame below 470 px, so a phone also gets the task's values without scrolling. The svg's label already says this, so it is hidden from assistive technology. */}
      <ul aria-hidden data-testid="formal-values" className="mt-2 space-y-0.5 px-1 font-mono text-xs text-foreground [font-variant-ligatures:none] sm:hidden">
        {DIR_FORMALS.map((f) => (
          <li key={f}>
            {DIR_ACTUALS[f]} = {formatValue(step.globals[DIR_ACTUALS[f]])}; {formalSummary(f)}
          </li>
        ))}
      </ul>
      <figcaption className="px-1 pt-1 text-[11px] text-muted-foreground">
        Arrows appear only while a call is open. A copy-in arrow stays from the call on and lights up on the step that performs it. A copy-out arrow appears only on the return, the step that performs it; until then the row says no copy out yet. A ref is one box with two names: nothing is copied. A static task's box stays between calls and keeps its values.
      </figcaption>
    </figure>
  );
}

/** What the second call did to each caller variable, from the directions on screen (§13.3, §13.3.2, §13.5.2). */
function secondCallText(directions: Record<DirName, Direction>, lifetime: Lifetime, summary: DirSummary): string {
  const second = summary.afterSecond ?? {};
  return DIR_FORMALS.map((f) => {
    const actual = DIR_ACTUALS[f];
    const value = formatValue(second[actual]);
    switch (directions[f]) {
      case "output":
        return lifetime === "static"
          ? `Output ${f} kept the previous call's value instead of restarting at 0, so the second copy-out carries both increments: ${actual} = ${value} (§13.3.2).`
          : `Output ${f} restarted at 0, so the second call added the same ${DIR_ADDS[f]} again: ${actual} = ${value} (§13.3.2).`;
      case "inout":
        return `Inout ${f} copied in ${actual}'s ${formatValue(summary.after[actual])} and added ${DIR_ADDS[f]} to it: ${actual} = ${value} (§13.3).`;
      case "ref":
        return `Ref ${f} is ${actual} itself, so the second call added ${DIR_ADDS[f]} to it directly: ${actual} = ${value} (§13.5.2).`;
      case "input":
        return `Input ${f} is never copied back: ${actual} stays ${value} (§13.3).`;
      default:
        return `Const ref ${f} is read-only: ${actual} stays ${value} (§13.5.2).`;
    }
  }).join(" ");
}

function ShowDirsLab() {
  const [lifetime, setLifetime] = useState<Lifetime>("automatic");
  const [directions, setDirections] = useState<Record<DirName, Direction>>(DEFAULT_DIRECTIONS);
  const [nbaOnB, setNbaOnB] = useState(false);
  const [calls, setCalls] = useState<1 | 2>(1);
  const bench = useMemo(() => showDirsBench({ lifetime, directions, nbaOnB, calls }), [lifetime, directions, nbaOnB, calls]);
  const { issues, run } = useBench(bench);
  const summary = run ? directionsSummary(run) : undefined;
  const resetKey = bench.id;
  const issueKeys = new Set(issues.map((i) => i.key));
  const controls: Record<string, React.ReactNode> = {
    "sub:show_dirs": <LifetimeSwitch sub="show_dirs" lifetime={lifetime} onChange={setLifetime} />,
    "dir-b": <OperatorSwitch name="b" nba={nbaOnB} onChange={setNbaOnB} invalid={issues.some((i) => i.key === "dir-b" && i.cause === "nba")} />,
  };
  DIR_FORMALS.forEach((f) => {
    controls[`formal:show_dirs:${f}`] = (
      <LineSelect<Direction>
        label={`Direction of ${f}`}
        testId={`direction-${f}`}
        value={directions[f]}
        options={DIRECTION_OPTIONS}
        invalid={issueKeys.has(`formal:show_dirs:${f}`) || issues.some((i) => i.key === `dir-${f}` && i.cause === "const-ref-write")}
        onChange={(next) => setDirections((prev) => ({ ...prev, [f]: next }))}
      />
    );
  });
  const load = (next: { lifetime: Lifetime; directions: Record<DirName, Direction>; calls: 1 | 2 }) => {
    setDirections(next.directions);
    setLifetime(next.lifetime);
    setNbaOnB(false);
    setCalls(next.calls);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={calls === 2} onChange={(e) => setCalls(e.target.checked ? 2 : 1)} className="h-4 w-4 accent-cyan-500" />
          Call show_dirs a second time after the join
        </label>
        <button type="button" className={button} onClick={() => load({ lifetime: "automatic", directions: DEFAULT_DIRECTIONS, calls: 1 })}>
          Reset to the lesson's code
        </button>
        {/* ref is illegal in a static task (§13.5.2), so this preset also makes d an inout. */}
        <button type="button" className={button} onClick={() => load({ lifetime: "static", directions: { ...DEFAULT_DIRECTIONS, d: "inout" }, calls: 2 })}>
          Static, called twice
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Every direction, the lifetime and the operator on the b line are controls inside the code. Illegal combinations turn rose and name their clause.</p>
      <TraceView
        bench={bench}
        run={run}
        issues={issues}
        resetKey={resetKey}
        controls={controls}
        stepNoun="Simulation step"
        storage={false}
        prediction={
          run && summary
            ? {
                question: "All four caller variables start at 5. What does the caller see at t = 5 ns, while the task waits, and at t = 10 ns, after it returns?",
                options: directionOptions(summary, directions),
                intro:
                  calls === 2 && summary.afterSecond ? (
                    <p data-testid="second-call-note" className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm text-foreground [font-variant-ligatures:none]">
                      Second call, after t = 20 ns: {valuesText(summary.afterSecond)}. {secondCallText(directions, lifetime, summary)}
                    </p>
                  ) : undefined,
              }
            : undefined
        }
      >
        {(step) => <DirectionsDiagram step={step} directions={directions} lifetime={lifetime} />}
      </TraceView>
    </div>
  );
}

/**
 * The options for pulse(busy), each feedback written for the direction on screen.
 * The correct one comes from the run's log, so every legal state has exactly one:
 * nothing (input, or a copy-out of 0 into a busy that holds 0), both lines (ref),
 * or t=23 busy=1 only (<= in a static task, so the copy-out runs before the NBA update).
 */
function pulseOptions(log: string[], direction: Direction): PredictionOption[] {
  const key = log.join("|");
  const isRef = direction === "ref";
  const isInput = direction === "input";
  const lateHigh = key === "t=23 busy=1";
  const carrier = direction === "inout" ? "An inout" : "An output";
  const noneFeedback = isRef
    ? "With ref, flag is busy itself, so each write is a change on the module variable and the monitor wakes both times (§13.5.2)."
    : isInput
      ? "flag is an input: busy's 0 is copied in at the call and nothing is ever copied out. Every write stays in the task's flag, busy is never written, and always @(busy) never wakes (§13.3, §9.4.2)."
      : lateHigh
        ? "busy does change, once. The return copies out flag's 1, because the <= 0 has not applied yet, so busy goes from 0 to 1 and the monitor wakes (§13.3, §4.4.2.4, §9.4.2)."
        : direction === "inout"
          ? "flag is a copy: it takes busy's 0 at the call, and its 1 and its 0 live in the task's storage. Only the final 0 is copied back at t = 23 ns, into a busy that already holds 0: no change, so always @(busy) never wakes (§13.3, §9.4.2)."
          : "flag is the task's own variable, not busy. Its 1 and its 0 live in the task's storage; only the final 0 is copied out at t = 23 ns, into a busy that already holds 0: no change, so always @(busy) never wakes (§13.3, §9.4.2).";
  const bothFeedback = isRef
    ? "flag is busy itself: the write at t = 13 ns and the write at t = 23 ns each change busy, and always @(busy) prints on every change (§13.5.2, §9.4.2)."
    : isInput
      ? "That is what ref would give. An input is a one-way copy, so no write reaches busy (§13.3)."
      : `That is what ref would give. ${carrier} reaches the caller once, at the return, so the pulse never appears on busy (§13.3).`;
  const lowOnlyFeedback = isRef
    ? "With ref, the write of 1 at t = 13 ns lands on busy too, so the monitor also prints at t = 13 ns (§13.5.2, §9.4.2)."
    : isInput
      ? "An input is never copied out, so no 0 reaches busy at the return; busy is never written (§13.3)."
      : lateHigh
        ? "The final 0 is not in flag yet when the return runs: flag <= 1'b0 only schedules it for the NBA region, so the copy-out carries the old 1 (§13.3, §4.4.2.4)."
        : "The final 0 is indeed copied out at t = 23 ns, but busy already holds 0, and writing the value a variable already holds is no event: always @(busy) stays asleep (§9.4.2).";
  const highOnlyFeedback = isRef
    ? "With ref, the write of 0 at t = 23 ns lands on busy too: a second change, so the monitor prints again (§13.5.2, §9.4.2)."
    : isInput
      ? "An input is a one-way copy, so the write of 1 stays in flag and never reaches busy (§13.3)."
      : "At t = 13 ns only the task's flag goes high. A copy reaches busy once, at the return at t = 23 ns (§13.3).";
  const lateHighFeedback = lateHigh
    ? "Both writes land in the task's static flag. At t = 13 ns the NBA update sets flag to 1. At t = 23 ns flag <= 1'b0 only schedules its update, and the task returns first, in the same active region, so the copy-out carries the old 1: busy goes from 0 to 1 and the monitor wakes. The 0 lands in flag afterwards and never reaches busy (§13.3, §4.4.2.4, §9.4.2)."
    : isRef
      ? "With ref, busy goes to 1 at t = 13 ns, when flag is written, and back to 0 at t = 23 ns (§13.5.2)."
      : isInput
        ? "An input is never copied out, so nothing reaches busy at the return, whatever flag holds then (§13.3)."
        : "With =, flag is already 0 when the return copies it out. A 1 survives to the copy-out only if the final write is still waiting in the NBA region (§13.3, §4.4.2.4).";
  return [
    { id: "none", label: "Nothing: busy never changes", correct: key === "", feedback: noneFeedback },
    {
      id: "both",
      label: (
        <>
          <code className={code}>t=13 busy=1</code> then <code className={code}>t=23 busy=0</code>
        </>
      ),
      correct: key === "t=13 busy=1|t=23 busy=0",
      feedback: bothFeedback,
    },
    {
      id: "low-only",
      label: (
        <>
          <code className={code}>t=23 busy=0</code> only: the final value is copied out
        </>
      ),
      correct: key === "t=23 busy=0",
      feedback: lowOnlyFeedback,
    },
    {
      id: "high-only",
      label: (
        <>
          <code className={code}>t=13 busy=1</code> only
        </>
      ),
      correct: key === "t=13 busy=1",
      feedback: highOnlyFeedback,
    },
    {
      id: "late-high",
      label: (
        <>
          <code className={code}>t=23 busy=1</code> only: a 1 is copied out at the return
        </>
      ),
      correct: lateHigh,
      feedback: lateHighFeedback,
    },
  ];
}

function PulseLab() {
  const [lifetime, setLifetime] = useState<Lifetime>("automatic");
  const [direction, setDirection] = useState<Direction>("output");
  const [nba, setNba] = useState(false);
  const bench = useMemo(() => pulseBench({ lifetime, direction, nba }), [lifetime, direction, nba]);
  const { issues, run } = useBench(bench);
  const resetKey = bench.id;
  const issueKeys = new Set(issues.map((i) => i.key));
  const controls: Record<string, React.ReactNode> = {
    "sub:pulse": <LifetimeSwitch sub="pulse" lifetime={lifetime} onChange={setLifetime} />,
    // A write to a const ref is cured by the direction, not the operator; a <= through a ref or to an automatic formal is cured by the operator.
    "formal:pulse:flag": (
      <LineSelect<Direction> label="Direction of flag" testId="direction-flag" value={direction} options={DIRECTION_OPTIONS} invalid={issueKeys.has("formal:pulse:flag") || issues.some((i) => i.cause === "const-ref-write")} onChange={setDirection} />
    ),
    "pulse-high": <OperatorSwitch name="flag" nba={nba} onChange={setNba} invalid={issues.some((i) => i.key === "pulse-high" && i.cause === "nba")} />,
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        The direction of <code className={code}>flag</code> is a control on its line. Compare <code className={code}>output</code> with <code className={code}>ref</code> while watching <code className={code}>always @(busy)</code>.
      </p>
      <TraceView
        bench={bench}
        run={run}
        issues={issues}
        resetKey={resetKey}
        controls={controls}
        stepNoun="Simulation step"
        prediction={run ? { question: "pulse(busy) is called at t = 13 ns. What does always @(busy) print?", options: pulseOptions(run.log.map((l) => l.text), direction) } : undefined}
      >
        {(step, index) =>
          run ? (
            <StepWaveform
              signals={["busy"]}
              bitSignals={["busy"]}
              snapshots={run.trace.map((s) => ({ busy: s.globals.busy }))}
              currentIndex={index}
              axisLabel={`busy over the model's steps (each column is one step; the current step is at t = ${step.time} ns). A real viewer would draw it against simulation time.`}
            />
          ) : null
        }
      </TraceView>
    </div>
  );
}

/* ========================================================================= */
/* Mode: formals                                                              */
/* ========================================================================= */

type FormalsPreset = keyof typeof FORMAL_SIGNATURES;
const FORMAL_DIRECTIONS: readonly { value: Direction | ""; label: string }[] = [
  { value: "", label: "(blank)" },
  { value: "input", label: "input" },
  { value: "output", label: "output" },
  { value: "inout", label: "inout" },
  { value: "ref", label: "ref" },
];
const FORMAL_TYPES: readonly { value: DataType | ""; label: string }[] = [
  { value: "", label: "(blank)" },
  { value: "int", label: "int" },
  { value: "int unsigned", label: "int unsigned" },
  { value: "logic", label: "logic" },
  { value: "logic [7:0]", label: "logic [7:0]" },
  { value: "logic [15:0]", label: "logic [15:0]" },
];

const sourceLabel = (source: ResolvedFormal["directionSource"], clause: string) => (source === "explicit" ? "written" : source === "default" ? `the ${clause} default` : "inherited");

/** A question about a formal is only a question when part of its answer is unwritten. */
const hasUnwrittenPart = (f: ResolvedFormal) => f.directionSource !== "explicit" || f.typeSource !== "explicit";

function formalOptions(name: string, resolved: ResolvedFormal, clause: string): PredictionOption[] {
  const altDir: Direction = resolved.direction === "input" ? "output" : "input";
  const altType: DataType = resolved.type === "logic" ? "int" : "logic";
  const candidates: { direction: Direction; type: DataType }[] = [
    { direction: resolved.direction, type: resolved.type },
    { direction: altDir, type: resolved.type },
    { direction: resolved.direction, type: altType },
    { direction: altDir, type: altType },
  ];
  const seen = new Set<string>();
  const options: PredictionOption[] = [];
  const correctWhy =
    `${name} is ${resolved.direction} because ${
      resolved.directionSource === "explicit" ? "the direction is written" : resolved.directionSource === "default" ? "no direction has been written yet, and the default is input" : `it inherits the direction of ${resolved.directionFrom}, the formal before it`
    }; its type is ${resolved.type} because ${
      resolved.typeSource === "explicit" ? "the type is written" : resolved.typeSource === "default" ? "a formal with no type is a one-bit logic when it is the first formal or has its own direction" : `it inherits the type of ${resolved.typeFrom}`
    } (${clause}).`;
  candidates.forEach((cand) => {
    const id = `${cand.direction} ${cand.type}`;
    if (seen.has(id)) return;
    seen.add(id);
    const correct = cand.direction === resolved.direction && cand.type === resolved.type;
    let feedback = correctWhy;
    if (!correct) {
      const parts: string[] = [];
      if (cand.direction !== resolved.direction)
        parts.push(
          resolved.directionSource === "default"
            ? `no direction has been written before ${name}, so it is input by default, not ${cand.direction}`
            : resolved.directionSource === "inherited"
              ? `${name} has no direction of its own, so it takes ${resolved.directionFrom}'s ${resolved.direction}, not ${cand.direction}`
              : `${name}'s direction is written: ${resolved.direction}`,
        );
      if (cand.type !== resolved.type)
        parts.push(
          resolved.typeSource === "default"
            ? `a formal with no type is a one-bit logic when it is the first formal or has its own direction, so ${name} is logic, not ${cand.type}`
            : resolved.typeSource === "inherited"
              ? `${name} has no type of its own and no direction of its own, so it inherits ${resolved.typeFrom}'s ${resolved.type}, not ${cand.type}`
              : `${name}'s type is written: ${resolved.type}`,
        );
      feedback = `${parts.join("; ")} (${clause}).`;
    }
    options.push({ id, label: <code className={code}>{`${cand.direction} ${cand.type} ${name}`}</code>, correct, feedback });
  });
  // The candidates are built answer first; the order shown comes only from what each option states.
  return stableOptionOrder(options, (option) => `${name}:${option.id}`);
}

const WAIT_PROBE = 5;
const issuesText = (issues: CompileIssue[]) => issues.map((i) => `${i.message} (${i.clause})`).join(" ");

/** How long wait_cycles(5) waits, from waitCyclesEffect: 5 is 3'b101, so a one-bit n keeps 1. */
function waitOptions(sub: string, formal: ResolvedFormal, issues: CompileIssue[]): PredictionOption[] {
  const { stored, cycles } = waitCyclesEffect(WAIT_PROBE, formal.type);
  const blocked = issues.length > 0;
  const cyclesText = (k: number) => `${k} cycle${k === 1 ? "" : "s"}`;
  const truncated = stored !== WAIT_PROBE;
  const answer = `${sub}(${WAIT_PROBE}) stores ${WAIT_PROBE} into the ${formal.type} ${formal.name}: ${formal.name} = ${formatValue(stored)}, so it waits ${cyclesText(cycles)}${truncated ? `. ${WAIT_PROBE} is 3'b101, and only the low bit fits (§10.7)` : ""}.`;
  const wrong = (k: number) => {
    if (blocked) return `Nothing waits, because the call does not compile. ${issuesText(issues)}`;
    if (k === WAIT_PROBE) return `${WAIT_PROBE} does not fit in a ${formal.type}. Assigning to a narrower variable keeps only the low bits (§10.7): ${formal.name} = ${formatValue(stored)}, so it waits ${cyclesText(cycles)}. The language does not reject the call.`;
    if (truncated) return `${WAIT_PROBE} is 3'b101, so its low bit is 1: ${formal.name} = ${formatValue(stored)} and it waits ${cyclesText(cycles)} (§10.7). ${sub}(4) is the call that waits 0 cycles, because 4 is 3'b100.`;
    return k === 1
      ? `One cycle is what a one-bit ${formal.name} would give. This ${formal.name} is a ${formal.type}, wide enough for ${WAIT_PROBE}, so it waits ${cyclesText(cycles)}.`
      : `Nothing is lost: ${formal.name} is a ${formal.type}, wide enough for ${WAIT_PROBE}, so it waits ${cyclesText(cycles)}.`;
  };
  return [
    ...[0, 1, WAIT_PROBE].map((k) => ({ id: `cycles-${k}`, label: cyclesText(k), correct: !blocked && cycles === k, feedback: !blocked && cycles === k ? answer : wrong(k) })),
    {
      id: "error",
      label: "A compile error",
      correct: blocked,
      feedback: blocked
        ? `${sub}(${WAIT_PROBE}) does not compile. ${issuesText(issues)}`
        : truncated
          ? `A literal is a legal actual for an input, and a formal too narrow for it is legal too: the upper bits are discarded with no error required (§10.7). That is why this bug is quiet: ${answer}`
          : `A literal is a legal actual for an input. ${answer}`,
    },
  ];
}

/** What add(2, 3) returns, from addCall: the same options whatever is right, with a numeric one added when an edit makes the sum something else. */
function returnOptions(formals: readonly ResolvedFormal[], returnType: DataType | "void" | undefined): PredictionOption[] {
  const result = addCall(formals, returnType);
  const ret = resolveReturnType(returnType);
  const blocked = result.issues.length > 0;
  const implicit = ret.source === "implicit";
  const sum = result.sum ?? 0;
  const returned = formatValue(result.returned);
  const answer = blocked ? "error" : implicit ? `1'b${returned}` : returned;
  const cut = (result.args ?? []).filter((arg) => arg.stored !== arg.passed);
  const cutText = cut.length ? ` ${cut.map((arg) => `${arg.passed} is truncated to the ${arg.type} ${arg.name}, which stores ${formatValue(arg.stored)}`).join("; ")} (§10.7).` : "";
  const answerWhy = implicit
    ? `No return type is written, so add returns a one-bit logic (§13.4).${cutText} a + b is ${sum}, and only its low bit comes back: ${answer} (§10.7).`
    : `The return type is written: ${ret.type}.${cutText} a + b is ${sum}, which it holds whole, so add(2, 3) returns ${answer} (§13.4).`;
  const blockedWhy = `add(2, 3) does not compile. ${issuesText(result.issues)}`;
  const wrong = (label: string) => {
    if (blocked) return blockedWhy;
    if (label.startsWith("1'b")) {
      return implicit
        ? `The result is one bit, but it is the low bit of ${sum}: ${sum} is ${sum % 2 ? "odd" : "even"}, so ${answer}, not ${label} (§10.7).`
        : `A one-bit result is what add returns with no return type. Here ${ret.type} is written, so the whole ${sum} comes back (§13.4).`;
    }
    if (Number(label) !== sum) return `${label} needs both arguments to survive intact.${cutText} a + b is ${sum}. ${answerWhy}`;
    return `${sum} is what a + b computes, but the return type decides what comes back. None is written, and the formals' types do not set it: it is a one-bit logic (§13.4), so only the low bit survives (§10.7).`;
  };
  const numeric = [...new Set([5, ...(blocked ? [] : [sum])])].sort((x, y) => x - y).map(String);
  return [
    ...["1'b0", "1'b1", ...numeric].map((label) => ({ id: label, label: <code className={code}>{label}</code>, correct: label === answer, feedback: label === answer ? answerWhy : wrong(label) })),
    {
      id: "error",
      label: "A compile error",
      correct: blocked,
      feedback: blocked ? blockedWhy : implicit ? `A function with no return type is legal: the return type is then a one-bit logic (§13.4). ${answerWhy}` : `Both formals are inputs, so the literals 2 and 3 are legal actuals. ${answerWhy}`,
    },
  ];
}

/** Each formal as resolved, with where its direction and type came from. */
function ResolutionStrip({ resolved, chosen, clause }: { resolved: readonly ResolvedFormal[]; chosen?: string; clause: string }) {
  return (
    <ol role="list" aria-label="Resolved formals" data-testid="resolution-strip" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
      {resolved.map((f) => (
        <li key={f.name} data-testid={`resolved-${f.name}`} className={cn("rounded-lg border p-2 text-xs", f.name === chosen ? "border-cyan-500 bg-cyan-500/[0.08]" : "border-border/70 bg-background/50")}>
          <p className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">
            {f.direction} {f.type} {f.name}
          </p>
          <p className="mt-1 text-muted-foreground">
            direction: {sourceLabel(f.directionSource, clause)}
            {f.directionFrom ? (
              <>
                {" "}
                <span aria-hidden>←</span> from <code className={code}>{f.directionFrom}</code>
              </>
            ) : null}
          </p>
          <p className="text-muted-foreground">
            type: {sourceLabel(f.typeSource, clause)}
            {f.typeFrom ? (
              <>
                {" "}
                <span aria-hidden>←</span> from <code className={code}>{f.typeFrom}</code>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

function FormalsLab({ preset: initial }: { preset: FormalsPreset }) {
  const [preset, setPreset] = useState<FormalsPreset>(initial);
  const [formals, setFormals] = useState<FormalSpec[]>(() => FORMAL_SIGNATURES[initial].formals.map((f) => ({ ...f })));
  const [returnType, setReturnType] = useState<DataType | "void" | undefined>(FORMAL_SIGNATURES[initial].returnType);
  const [picked, setPicked] = useState<string>(FORMAL_SIGNATURES[initial].formals[FORMAL_SIGNATURES[initial].formals.length - 1].name);
  const signature = FORMAL_SIGNATURES[preset];
  const resolved = useMemo(() => resolveFormals(formals), [formals]);
  // Only a formal with something unwritten is a question; a fully written one would be answered by the signature above it.
  const askable = resolved.filter(hasUnwrittenPart);
  const chosen = askable.find((f) => f.name === picked) ?? askable[askable.length - 1];
  const editKey = `${preset}:${formals.map((f) => `${f.direction ?? ""}/${f.type ?? ""}`).join(",")}`;
  const clause = formalRulesClause(signature.kind);
  const loadPreset = (next: FormalsPreset) => {
    setPreset(next);
    setFormals(FORMAL_SIGNATURES[next].formals.map((f) => ({ ...f })));
    setReturnType(FORMAL_SIGNATURES[next].returnType);
    setPicked(FORMAL_SIGNATURES[next].formals[FORMAL_SIGNATURES[next].formals.length - 1].name);
  };
  const sigText = signatureToSource({ ...signature, formals, returnType });
  const first = resolved[0];
  const ret = resolveReturnType(returnType);
  const waitIssues = first ? literalCallIssues(signature.name, [first], [WAIT_PROBE]) : [];
  const add = signature.kind === "function" ? addCall(resolved, returnType) : undefined;
  // What the signature does to a call, predicted after what the formal resolves to.
  const consequence =
    signature.kind === "function" ? (
      <PredictionPrompt
        resetKey={`${editKey}:${returnType ?? ""}:return`}
        question={
          <>
            What does <code className={code}>add(2, 3)</code> return?
          </>
        }
        options={returnOptions(resolved, returnType)}
      >
        <div data-testid="return-type-strip" className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm [font-variant-ligatures:none]">
          <p className="text-muted-foreground">
            Resolved return type: <code className={code}>{ret.type}</code> ({ret.source === "implicit" ? "no return type written, so a one-bit logic, §13.4" : "written"}).
          </p>
          {add?.args ? (
            <p className="mt-1 text-muted-foreground">
              <code className={code}>add(2, 3)</code> stores {add.args.map((arg) => `${arg.name} = ${formatValue(arg.stored)}${arg.stored === arg.passed ? "" : ` (${arg.passed} truncated to a ${arg.type}, §10.7)`}`).join(" and ")}, computes {add.sum} and returns{" "}
              <code className={code}>{ret.source === "implicit" ? `1'b${formatValue(add.returned)}` : formatValue(add.returned)}</code>
              {ret.source === "implicit" ? `, the low bit of ${add.sum} (§10.7)` : ""}.
            </p>
          ) : (
            <IssueList issues={add?.issues ?? []} testId="add-issues" />
          )}
        </div>
      </PredictionPrompt>
    ) : (preset === "wait_cycles" || preset === "wait_cycles_ok") && first ? (
      <PredictionPrompt
        resetKey={`${editKey}:wait`}
        question={
          <>
            The body is <code className={code}>repeat ({first.name}) @(posedge clk);</code>. How long does <code className={code}>{`${signature.name}(${WAIT_PROBE})`}</code> wait?
          </>
        }
        options={waitOptions(signature.name, first, waitIssues)}
      >
        <div data-testid="wait-cycles-strip" className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm [font-variant-ligatures:none]">
          {waitIssues.length ? (
            <IssueList issues={waitIssues} testId="wait-cycles-issues" />
          ) : (
            <>
              <p className="font-semibold text-foreground">
                If the body is <code className={code}>repeat ({first.name}) @(posedge clk);</code>
              </p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {[4, 5].map((k) => {
                  const effect = waitCyclesEffect(k, first.type);
                  return (
                    <li key={k}>
                      <code className={code}>
                        {signature.name}({k})
                      </code>{" "}
                      stores {k} into a {first.type} {first.name}: {first.name} = {formatValue(effect.stored)}, so it waits {effect.cycles} cycle{effect.cycles === 1 ? "" : "s"}
                      {effect.stored !== k ? " (the upper bits are discarded, §10.7)" : ""}.
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </PredictionPrompt>
    ) : null;
  return (
    <div className="space-y-4">
      <ControlCaption text="Signature:">
        <SegmentedControl<FormalsPreset>
          label="Signature"
          mono
          options={(Object.keys(FORMAL_SIGNATURES) as FormalsPreset[]).map((k) => ({ value: k, label: k }))}
          value={preset}
          onChange={loadPreset}
        />
      </ControlCaption>
      <CodeTrace label="The signature as written" lines={[{ text: sigText, key: "sig" }]} />
      <div role="group" aria-label="Edit the formals" className="rounded-xl border border-border/70">
        <ScrollFrame label="formals table">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Each formal's written direction and type; blank means not written</caption>
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Formal
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Written direction
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  Written type
                </th>
              </tr>
            </thead>
            <tbody>
              {formals.map((f, i) => (
                <tr key={f.name} className="border-t border-border/50">
                  <th scope="row" className="px-2 py-1.5 font-mono font-medium text-foreground">
                    {f.name}
                  </th>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Written direction of ${f.name}`}
                      value={f.direction ?? ""}
                      onChange={(e) => setFormals((prev) => prev.map((p, k) => (k === i ? { ...p, direction: (e.target.value || undefined) as Direction | undefined } : p)))}
                      className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground"
                    >
                      {FORMAL_DIRECTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Written type of ${f.name}`}
                      value={f.type ?? ""}
                      onChange={(e) => setFormals((prev) => prev.map((p, k) => (k === i ? { ...p, type: (e.target.value || undefined) as DataType | undefined } : p)))}
                      className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground"
                    >
                      {FORMAL_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFrame>
      </div>
      {signature.kind === "function" ? (
        <label className="flex min-h-10 flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          Written return type
          <select aria-label="Written return type" value={returnType ?? ""} onChange={(e) => setReturnType((e.target.value || undefined) as DataType | undefined)} className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground">
            <option value="">(none written)</option>
            <option value="int">int</option>
            <option value="logic [7:0]">logic [7:0]</option>
          </select>
        </label>
      ) : null}
      {askable.length > 1 ? (
        <ControlCaption text="Formal to predict:">
          <SegmentedControl<string> label="Formal to predict" mono options={askable.map((f) => ({ value: f.name, label: f.name }))} value={chosen.name} onChange={setPicked} />
        </ControlCaption>
      ) : null}
      {chosen ? (
        <PredictionPrompt
          resetKey={`${editKey}:${chosen.name}`}
          question={
            <>
              What direction and type does <code className={code}>{chosen.name}</code> end up with?
            </>
          }
          options={formalOptions(chosen.name, chosen, clause)}
        >
          <div className="space-y-3">
            <ResolutionStrip resolved={resolved} chosen={chosen.name} clause={clause} />
            {consequence}
          </div>
        </PredictionPrompt>
      ) : (
        <div className="space-y-3">
          <ResolutionStrip resolved={resolved} clause={clause} />
          {consequence}
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* Mode: debug (the kata)                                                     */
/* ========================================================================= */

function DebugLab() {
  const [suspects, setSuspects] = useState<Record<string, string>>({});
  const [fixes, setFixes] = useState<KataFixes>(NO_KATA_FIXES);
  const [graded, setGraded] = useState<ReturnType<typeof gradeKata> | null>(null);
  // The narration explains the bugs, so the run stays closed until the first rerun or an explicit request.
  const [runOpen, setRunOpen] = useState(false);
  const runHeading = useRef<HTMLHeadingElement>(null);
  const bench = useMemo(() => kataBench(fixes), [fixes]);
  const { issues, run } = useBench(bench);
  const fixesKey = KATA_SUBS.map((s) => fixes[s]).join(",");
  const benchLines = useMemo<CodeTraceLine[]>(() => benchSource(bench, { comments: false }).map((l) => ({ text: l.text, key: l.key })), [bench]);
  const allFound = KATA_SYMPTOMS.every((s) => suspects[s.id] === s.suspect);
  return (
    <div className="space-y-5">
      <LogPanel label="The log of the bench as written" lines={KATA_BUGGY_LOG.map((text) => ({ text }))} testId="buggy-log" emphasizeLast={false} />
      <CodeTrace label="The bench, with your fixes as you pick them" lines={benchLines} />
      <section aria-label="Step 1: name the suspect line for each symptom" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">1. For each wrong or missing line, pick the declaration at fault</h4>
        {KATA_SYMPTOMS.map((symptom) => {
          const pickedKey = suspects[symptom.id];
          const pickedLine = KATA_SUSPECTS.find((l) => l.key === pickedKey);
          const right = pickedKey === symptom.suspect;
          return (
            <div key={symptom.id} data-testid={`symptom-${symptom.id}`} className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="text-sm text-foreground [font-variant-ligatures:none]">
                <span className="font-mono text-rose-700 dark:text-rose-300">{symptom.observed}</span> <span className="text-muted-foreground">(expected</span>{" "}
                <span className="font-mono text-emerald-700 dark:text-emerald-300">{symptom.expected}</span>
                <span className="text-muted-foreground">)</span>
              </p>
              <div role="group" aria-label={`Suspect line for ${symptom.observed}`} className="mt-2 grid gap-1.5 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                {KATA_SUSPECTS.map((line) => {
                  const isPicked = pickedKey === line.key;
                  return (
                    <button
                      key={line.key}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() => setSuspects((prev) => ({ ...prev, [symptom.id]: line.key }))}
                      className={cn(
                        "min-h-10 rounded-lg border px-2 py-1 text-left font-mono text-[11px] [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isPicked && right ? "border-emerald-500 bg-emerald-500/15" : isPicked ? "border-rose-500 bg-rose-500/15" : "border-border/70 hover:bg-muted",
                      )}
                    >
                      {line.label}
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite" data-testid={`suspect-live-${symptom.id}`}>
                {pickedLine ? (
                  <p className={cn("mt-2 text-sm", right ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200")}>
                    <strong>{right ? "Found it. " : "Not this one. "}</strong>
                    {right ? `${symptom.why} (${symptom.clause})` : pickedLine.feedback[symptom.id]}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
      <section aria-label="Step 2: choose a fix for each subroutine" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">2. Choose the smallest fix for each subroutine, then rerun</h4>
        {KATA_SUBS.map((sub: KataSub) => (
          <div key={sub} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3">
            <code className={cn(code, "text-sm")}>{sub}</code>
            <SegmentedControl<KataFix>
              label={`Fix for ${sub}`}
              options={KATA_FIXES.map((fix) => ({ value: fix, label: KATA_FIX_LABELS[fix] }))}
              value={fixes[sub]}
              onChange={(fix) => {
                setFixes((prev) => ({ ...prev, [sub]: fix }));
                setGraded(null);
              }}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={cn(button, "border-cyan-500/50 bg-cyan-500/10")}
            onClick={() => {
              setGraded(gradeKata(fixes));
              setRunOpen(true);
            }}
          >
            Rerun and grade
          </button>
          {/* No resetKey: a learner changing a fix is the learner reading the hints. */}
          <HintLadder
            hints={[
              "Two of the three subroutines have no lifetime keyword. In a module that means static: one copy of every argument and local, shared by every call (§13.3.1, §13.3.2, §13.4.2).",
              <>
                <code className={code}>sum_to</code> reads <code className={code}>n</code> after its recursive call. Which <code className={code}>n</code>? The one the innermost call left behind (§13.4.2). <code className={code}>log_after</code> has the same disease with <code className={code}>msg</code>.
              </>,
              <>
                <code className={code}>pulse</code> writes <code className={code}>flag</code> twice, but an output reaches the caller once, at the return (§13.3), and 0 → 0 is no event (§9.4.2). Which direction makes every write land on the caller's variable at once (§13.5.2)?
              </>,
            ]}
          />
        </div>
        <div aria-live="polite" data-testid="grade-live">
          {graded ? (
            <div data-testid="grade" className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
              <p className={cn("text-sm font-semibold", graded.passed ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200")}>
                {graded.passed ? "Passes: the log matches the corrected log line for line." : graded.issues.length ? "Does not compile." : "Not yet: some lines still differ from the corrected log."}
              </p>
              <IssueList issues={graded.issues} testId="grade-issues" />
              {graded.notes.map((note) => (
                <p key={note} className="text-sm text-amber-800 dark:text-amber-200">
                  <span aria-hidden>⚠ </span>
                  {note}
                </p>
              ))}
              <ol className="space-y-0.5 font-mono text-xs [font-variant-ligatures:none]">
                {graded.lines.map((line, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className={line.match ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                      <span aria-hidden>{line.match ? "✓" : "✕"}</span>
                      <span className="sr-only">{line.match ? "matches" : "differs"}</span>
                    </span>
                    <span className="text-muted-foreground">expected</span>
                    <span>{line.expected ?? "(nothing)"}</span>
                    {!line.match ? (
                      <>
                        <span className="text-muted-foreground">got</span>
                        <span className="text-rose-700 dark:text-rose-300">{line.actual ?? "(nothing)"}</span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </section>
      <section aria-label="Step 3: watch the bench run" className="space-y-3">
        <h4 ref={runHeading} tabIndex={-1} className="text-sm font-semibold text-foreground focus:outline-none">
          3. Watch the bench with your fixes applied
        </h4>
        {runOpen ? (
          <TraceView bench={bench} run={run} issues={issues} issuesTestId="bench-issues" resetKey={fixesKey} stepNoun="Simulation step" lanes />
        ) : (
          <div data-testid="run-closed" className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3 text-sm text-muted-foreground">
            <p className="min-w-0 flex-1 basis-60">The step-by-step run explains each bug as it happens, so it opens with your first rerun.</p>
            <button
              type="button"
              className={button}
              onClick={() => {
                // The heading stays mounted, so focus has somewhere to go when this button leaves.
                runHeading.current?.focus();
                setRunOpen(true);
              }}
            >
              Show the run anyway
            </button>
          </div>
        )}
      </section>
      <details className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">Show the worked solution</summary>
        <p className="mt-2 text-muted-foreground">
          {allFound ? "You found all three declarations. " : ""}
          The fixes, one word each:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]">
          {`task automatic log_after(input int delay_ns, input string msg);   // 1: automatic
function automatic int sum_to(input int n);                        // 2: automatic
task automatic pulse(ref logic flag);                              // 3: ref, not output`}
        </pre>
        <p className="mt-2 text-muted-foreground">The corrected log:</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]">{KATA_EXPECTED_LOG.join("\n")}</pre>
      </details>
    </div>
  );
}

/* ========================================================================= */
/* Shell                                                                      */
/* ========================================================================= */

const modeMeta: Record<SubroutineLabMode, { eyebrow: string; title: string; summary: string }> = {
  lifetime: {
    eyebrow: "Experiment · lifetime",
    title: "Where a task's variables live",
    summary: "Two overlapping calls of one task, with the lifetime keyword as a switch. Predict what call 1 prints, then watch the storage.",
  },
  recursion: {
    eyebrow: "Experiment · recursion",
    title: "Recursion needs automatic",
    summary: "Each call pushes an activation. Switch the lifetime, predict what the outermost call returns, then watch which n each return reads.",
  },
  directions: {
    eyebrow: "Experiment · argument directions",
    title: "When the caller sees a change",
    summary: "Copy-in at the call, copy-out at the return, ref at once. Every direction is a control in the code.",
  },
  formals: {
    eyebrow: "Experiment · implicit formals",
    title: "Types and directions you did not write",
    summary: "Edit a signature and predict what each formal resolves to; the strip shows what was written, defaulted or inherited.",
  },
  debug: {
    eyebrow: "Debug challenge · kata",
    title: "Fix the bench that lies",
    summary: "Three subroutine bugs, read from the log. Name the line, pick the smallest fix, rerun, and the model grades the log.",
  },
};

/** Header text for a preset that is a different lab from its mode's default. */
const presetMeta: Partial<Record<`${SubroutineLabMode}:${string}`, { title: string; summary: string }>> = {
  "lifetime:initializers": {
    title: "Initializers in static subroutines",
    summary: "A counting function called twice, a task called three times with two kinds of local, and the rule for declarations with an initializer.",
  },
  "recursion:sum_to": {
    title: "Recursion in the kata's sum_to",
    summary: "sum_to(n) is meant to add 1 + 2 + ... + n by recursion. Switch the lifetime, predict what it returns, then watch which n each return reads.",
  },
  "directions:pulse": {
    title: "pulse(busy): output or ref",
    summary: "A task raises flag for 10 ns while always @(busy) watches the caller's variable. Change how flag is passed and predict what the monitor prints.",
  },
};

export default function SubroutineLab({ mode = "lifetime", preset }: SubroutineLabProps) {
  const meta = { ...modeMeta[mode], ...(preset ? presetMeta[`${mode}:${preset}`] : undefined) };
  let body: React.ReactNode;
  if (mode === "lifetime") body = preset === "initializers" ? <LifetimeInitializersLab /> : <LifetimeSendLab />;
  else if (mode === "recursion") body = <RecursionLab preset={preset === "sum_to" ? "sum_to" : "fact"} />;
  else if (mode === "directions") body = preset === "pulse" ? <PulseLab /> : <ShowDirsLab />;
  else if (mode === "formals") body = <FormalsLab preset={preset && preset in FORMAL_SIGNATURES ? (preset as FormalsPreset) : "split"} />;
  else body = <DebugLab />;
  return (
    <VisualFrame label={`Subroutine lab: ${meta.title}`} eyebrow={meta.eyebrow} title={meta.title} summary={meta.summary} fidelity="model" assumptions={ASSUMPTIONS} className="min-w-0">
      <div data-testid={`subroutine-lab-${mode}`} className="min-w-0 space-y-4">
        {body}
      </div>
    </VisualFrame>
  );
}
