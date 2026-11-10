"use client";

import React, { useId, useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { layoutGridDiagram } from "@/components/visual-system/diagram-layout";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  BENCH_FILE_CHOICES,
  CURSOR_FILES,
  CURSOR_LOOPS,
  DEBUG_CASES,
  benchRunFor,
  checkOutcomeOptions,
  chipValue,
  countConversions,
  debugCase,
  debugCaseNote,
  describeLineTape,
  describeTape,
  judgeRun,
  nextReturnChoices,
  returnMatches,
  runBench,
  runCursor,
  staleOptions,
  suspectFeedback,
  summaryOptions,
  type BenchFileName,
  type BenchStep,
  type CodeLine,
  type CursorFileId,
  type CursorLoop,
  type DebugCaseId,
  type DiagramEdgeId,
} from "@/lib/sv-file-io-model";
import {
  CMDLINE_PRESETS,
  LOOKUPS,
  PLUSARG_PALETTE,
  describeScanStep,
  displayPlusargValue,
  displayReturn,
  explainLookup,
  lookupById,
  plusargSource,
  returnOptions,
  runLookup,
  valueOptions,
  type CmdlinePresetId,
  type LookupId,
  type ValuePlusargsResult,
} from "@/lib/sv-plusargs-model";
import { cn } from "@/lib/utils";

export type FileReadMode = "cursor" | "bench" | "debug" | "plusargs";

export interface FileReadCursorVisualizerProps {
  /** cursor (default): the read cursor on a character tape. bench: the file-driven adder bench. debug: the log that lies. plusargs: command-line lookups. */
  mode?: FileReadMode;
  /**
   * cursor: "feeding-files" (in.txt, forever/break) | "robust-parsing" (a short line).
   * bench: "worked-example". debug: "case-2" | "case-3" | "case-4".
   * plusargs: "lesson" (+VECTORS=... +VERBOSE, query V) | "regression-scale" (+SEED=7 +SEED=2; seed defaults to 1 as in the lesson).
   */
  preset?: string;
  className?: string;
}

const CURSOR_PRESETS: Record<string, { file: CursorFileId; loop: CursorLoop }> = {
  "feeding-files": { file: "in-txt", loop: "forever-break" },
  "robust-parsing": { file: "short-line", loop: "forever-break" },
};
const PLUSARG_PRESETS: Record<string, { cmd: CmdlinePresetId; lookup: LookupId }> = {
  lesson: { cmd: "prefix-trap", lookup: "v" },
  "regression-scale": { cmd: "first-wins", lookup: "seed" },
};

const toTrace = (lines: CodeLine[]): CodeTraceLine[] => lines.map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

interface MultiQuestion {
  id: string;
  question: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
}

/** Predict-then-reveal for several linked questions: nothing below unlocks until every question has an answer or the learner skips. */
function MultiPrediction({ questions, resetKey, children }: { questions: MultiQuestion[]; resetKey: string; children: React.ReactNode }) {
  const groupId = useId();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setAnswers({});
    setRevealed(false);
    setCommitted(false);
  }
  const complete = questions.every((q) => answers[q.id]);
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3 sm:p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">
        <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
        Commit to an answer before you step through the run.
      </p>
      <div className="space-y-4">
        {questions.map((q) => {
          const chosen = q.options.find((o) => o.id === answers[q.id]);
          const right = q.options.find((o) => o.correct);
          return (
            <fieldset key={q.id} disabled={revealed}>
              <legend className="mb-2 text-sm font-medium text-foreground">{q.question}</legend>
              <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5 text-sm",
                      answers[q.id] === o.id && !revealed && "border-amber-500/70 bg-amber-500/10",
                      revealed && o.correct && "border-emerald-500/70 bg-emerald-500/10",
                      revealed && committed && answers[q.id] === o.id && !o.correct && "border-rose-500/70 bg-rose-500/10",
                      revealed && "cursor-default",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${groupId}-${q.id}`}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                      className="mt-1 accent-amber-500"
                    />
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] [font-variant-ligatures:none]">{o.label}</span>
                    {revealed && o.correct ? <span aria-label="correct answer">✓</span> : null}
                    {revealed && committed && answers[q.id] === o.id && !o.correct ? <span aria-label="your answer, incorrect">✕</span> : null}
                  </label>
                ))}
              </div>
              {/* Always mounted, so screen readers announce the verdict when it is filled in on reveal. */}
              <div className={cn("space-y-1 text-sm", revealed && "mt-2")} aria-live="polite" data-testid={`feedback-${q.id}`}>
                {revealed ? (
                  <>
                    {committed && chosen ? (
                      <p className={chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                        <strong>{chosen.correct ? "Correct. " : "Not quite. "}</strong>
                        {chosen.feedback}
                      </p>
                    ) : null}
                    {right && (!committed || !chosen?.correct) ? (
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">Why the answer holds: </strong>
                        {right.feedback}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </fieldset>
          );
        })}
      </div>
      {!revealed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!complete}
            onClick={() => {
              setCommitted(true);
              setRevealed(true);
            }}
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock in prediction
          </button>
          <button type="button" onClick={() => setRevealed(true)} className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Reveal without predicting
          </button>
        </div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  );
}

const CELL_GLYPH = (ch: string) => (ch === " " ? "␠" : ch === "\n" ? "⏎" : ch === "\t" ? "⇥" : ch);

/** The file (or line buffer) as a character tape with a read cursor. */
function Tape({
  name,
  text,
  pos,
  consumed,
  consumedUpTo,
  offendingAt,
  eof,
  showEofCell = true,
  variant = "file",
  testId,
}: {
  name: string;
  text: string;
  pos: number | null;
  consumed: [number, number] | null;
  consumedUpTo: number;
  offendingAt: number | null;
  eof: boolean;
  showEofCell?: boolean;
  /** "line": the $fgets string buffer. $feof reads the file, not this string, and $sscanf has no read cursor on it. */
  variant?: "file" | "line";
  testId?: string;
}) {
  const isLine = variant === "line";
  const rows: { ch: string; i: number }[][] = [[]];
  for (let i = 0; i < text.length; i += 1) {
    rows[rows.length - 1].push({ ch: text[i], i });
    if (text[i] === "\n") rows.push([]);
  }
  const description = isLine ? describeLineTape(text, consumed, offendingAt) : describeTape(name, text, { pos: pos ?? 0, consumed, offendingAt, eof });
  const cell = (ch: string, i: number) => {
    const now = consumed !== null && i >= consumed[0] && i < consumed[1];
    const done = !now && i < consumedUpTo;
    const off = offendingAt === i;
    const cursor = !isLine && pos === i;
    return (
      <span
        key={i}
        data-state={off ? "unread-offending" : now ? "consumed-now" : done ? "consumed" : "unread"}
        className={cn(
          "relative inline-flex h-8 min-w-7 items-center justify-center rounded border px-1 font-mono text-[13px] [font-variant-ligatures:none] transition-colors duration-200 motion-reduce:transition-none",
          now && "border-cyan-500 bg-cyan-500/20 font-bold text-foreground underline decoration-2 underline-offset-4",
          done && "border-border/40 bg-muted/30 text-muted-foreground/70 line-through decoration-1",
          !now && !done && !off && "border-border/70 bg-background/60 text-foreground",
          off && "border-dashed border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-200",
          (ch === " " || ch === "\n") && !now && "text-muted-foreground",
          cursor && "ring-2 ring-amber-500 ring-offset-1 ring-offset-background",
        )}
      >
        {CELL_GLYPH(ch)}
        {cursor ? (
          <span aria-hidden className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-amber-600 dark:text-amber-300">
            ▼
          </span>
        ) : null}
      </span>
    );
  };
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid={testId}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">{name}</span>
        {isLine ? (
          <span>
            {text.length} character{text.length === 1 ? "" : "s"} · the string $sscanf parses
          </span>
        ) : (
          <span>
            {text.length} character{text.length === 1 ? "" : "s"} · $feof = <strong className="text-foreground">{eof ? "nonzero" : "0"}</strong>
          </span>
        )}
      </figcaption>
      <div role="img" aria-label={description} className="space-y-2 pt-2">
        {rows.map((row, r) =>
          row.length || (r === rows.length - 1 && showEofCell) ? (
            <div key={r} className="flex flex-wrap gap-1">
              {row.map(({ ch, i }) => cell(ch, i))}
              {r === rows.length - 1 && showEofCell ? (
                <span
                  className={cn(
                    "relative inline-flex h-8 items-center justify-center rounded border border-dashed border-slate-400/70 px-1.5 text-[10px] font-bold tracking-wider text-muted-foreground",
                    pos === text.length && "ring-2 ring-amber-500 ring-offset-1 ring-offset-background",
                  )}
                >
                  EOF
                  {pos === text.length ? (
                    <span aria-hidden className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-amber-600 dark:text-amber-300">
                      ▼
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          ) : null,
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {isLine ? null : "▼ read cursor · "}
        <span className="font-semibold underline">underlined</span>: consumed by this call · <span className="line-through">struck</span>: consumed earlier · dashed red: left unread after a mismatch · ␠ space · ⏎ newline
      </p>
    </figure>
  );
}

function LogPanel({ lines, label = "Transcript", testId = "log" }: { lines: string[]; label?: string; testId?: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</figcaption>
      <ol className="space-y-0.5 px-3 py-2 font-mono text-[12px] leading-5 [font-variant-ligatures:none]" data-testid={testId}>
        {lines.length === 0 ? <li className="text-slate-400">(nothing printed yet)</li> : null}
        {lines.map((l, i) => (
          <li key={i} className={cn("whitespace-pre-wrap break-words", /^<(Error|Fatal)/.test(l) && "text-rose-300")}>
            {/^<(Error|Fatal)/.test(l) ? <span aria-hidden>✕ </span> : null}
            {l}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Narration({ what, why, stepLabel }: { what: string; why: string; stepLabel: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm" aria-live="polite" data-testid="narration">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{stepLabel}</p>
      <p className="mt-1 text-[15px] font-medium text-foreground">{what}</p>
      {why ? <p className="mt-1 text-muted-foreground">{why}</p> : null}
    </div>
  );
}

function ReturnChip({ value }: { value: string | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/70 bg-amber-500/10 px-2.5 py-0.5 font-mono text-sm text-amber-900 dark:text-amber-100" data-testid="return-chip">
      <span className="text-[10px] font-bold uppercase tracking-wider">returned</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// cursor mode
// ---------------------------------------------------------------------------

function CursorMode({ preset }: { preset?: string }) {
  const initial = CURSOR_PRESETS[preset ?? ""] ?? CURSOR_PRESETS["feeding-files"];
  const [fileId, setFileId] = useState<CursorFileId>(initial.file);
  const [loop, setLoop] = useState<CursorLoop>(initial.loop);
  const run = useMemo(() => runCursor(fileId, loop), [fileId, loop]);
  const key = `${fileId}|${loop}`;
  const questions: MultiQuestion[] = [
    { id: "checks", question: "How many checks run?", options: checkOutcomeOptions(run) },
    { id: "stale", question: "Does any check reuse values its read did not assign (for example, the last vector checked twice)?", options: staleOptions(run) },
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Vector file</p>
          <SegmentedControl label="Vector file" mono value={fileId} onChange={setFileId} options={CURSOR_FILES.map((f) => ({ value: f.id, label: f.name, ariaLabel: `${f.name}: ${f.note}` }))} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Read loop</p>
          <SegmentedControl label="Read loop" mono value={loop} onChange={setLoop} options={CURSOR_LOOPS.map((l) => ({ value: l.id, label: l.label }))} />
        </div>
      </div>
      <CodeTrace label={`Generated code: ${run.file.name}, ${CURSOR_LOOPS.find((l) => l.id === loop)?.label}`} lines={toTrace(run.source)} />
      {run.file.contents !== null ? (
        <Tape name={run.file.name} text={run.file.contents} pos={0} consumed={null} consumedUpTo={0} offendingAt={null} eof={false} testId="tape-preview" />
      ) : (
        <p className="rounded-xl border border-dashed border-rose-500/60 p-3 text-sm text-foreground">
          <span className="font-mono">{run.file.name}</span>: there is no such file, so there is no tape to read.
        </p>
      )}
      <MultiPrediction questions={questions} resetKey={key}>
        <CursorStepper key={key} run={run} />
      </MultiPrediction>
    </div>
  );
}

function CursorStepper({ run }: { run: ReturnType<typeof runCursor> }) {
  const playback = usePlayback(run.steps.length, run);
  const [guesses, setGuesses] = useState<Record<number, string>>({});
  const step = run.steps[playback.index];
  const next = run.steps[playback.index + 1];
  const n = countConversions(run.file.format);
  const nextChoices = next ? nextReturnChoices(next, n) : [];
  const guess = guesses[playback.index];
  return (
    <div className="space-y-3" data-testid="cursor-run">
      <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Call" describeStep={(i) => run.steps[i].what} />
      <Narration stepLabel={`Step ${playback.index + 1} of ${run.steps.length}`} what={step.what} why={step.why} />
      {guess !== undefined && step.returns !== null ? (
        <p className={cn("text-sm", returnMatches(step, guess) ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")} data-testid="guess-feedback">
          {returnMatches(step, guess) ? "✓ " : "✕ "}You predicted {guess}; the call returned {step.returns}.
        </p>
      ) : null}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="Executing" lines={toTrace(run.source)} activeKey={step.codeKey} />
        <div className="min-w-0 space-y-3">
          {run.file.contents !== null ? (
            <Tape name={run.file.name} text={run.file.contents} pos={step.pos} consumed={step.consumed} consumedUpTo={step.consumedUpTo} offendingAt={step.offendingAt} eof={step.eof} testId="tape" />
          ) : null}
          {step.line !== undefined ? (
            <Tape name="line (string)" text={step.line} pos={null} consumed={step.lineConsumed ?? null} consumedUpTo={0} offendingAt={step.lineOffendingAt ?? null} eof={false} showEofCell={false} variant="line" testId="line-tape" />
          ) : null}
          <div className="flex flex-wrap items-center gap-2" data-testid="chips">
            {run.file.vars.map((v) => (
              <ValueChip key={v.name} name={v.name} value={chipValue(step.values[v.name])} changed={step.changed.includes(v.name)} />
            ))}
            <ReturnChip value={step.returns} />
          </div>
        </div>
      </div>
      {nextChoices.length ? (
        <div role="group" aria-label="Predict what the next call returns" className="rounded-lg border border-amber-500/40 bg-amber-500/[0.05] p-2.5 text-sm">
          <p className="mb-1.5 text-xs font-medium text-foreground">Predict what the next call returns, then step forward:</p>
          <div className="flex flex-wrap gap-1.5">
            {nextChoices.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={guesses[playback.index + 1] === c}
                onClick={() => setGuesses((g) => ({ ...g, [playback.index + 1]: c }))}
                className={cn(
                  "min-h-10 min-w-10 rounded-lg border px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  guesses[playback.index + 1] === c ? "border-amber-500 bg-amber-500/20 font-semibold" : "border-border/70 bg-background/60",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <LogPanel lines={step.log} />
      {playback.isLast ? (
        <p className="text-sm text-foreground" data-testid="run-summary">
          {run.summary}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// bench mode
// ---------------------------------------------------------------------------

/** Same grid as the lesson's ArchitectureDiagram at the top of the page. */
export const BENCH_LAYOUT = layoutGridDiagram({
  cellWidth: 118,
  cellHeight: 54,
  gapX: 92,
  gapY: 64,
  nodes: [
    { id: "cli", label: "command line", sublabel: "+VECTORS=..., +DUMP", col: 0, row: 0 },
    { id: "vec", label: "vector file", sublabel: "a, b, expected sum", col: 1, row: 0 },
    { id: "top", label: "tb_top", col: 0, row: 1, colSpan: 2, container: true },
    { id: "init", label: "initial", sublabel: "drives and checks", col: 0, row: 1 },
    { id: "dut", label: "u_dut", sublabel: "adder8", kind: "dut", col: 1, row: 1 },
    { id: "log", label: "transcript", sublabel: "standard output", col: 0, row: 2 },
    { id: "vcd", label: "waves.vcd", sublabel: "only with +DUMP", col: 1, row: 2 },
  ],
  edges: [
    { id: "cli", from: "cli", to: "init", label: "$value$plusargs" },
    { id: "vec", from: "vec", to: "init", label: "$fscanf" },
    { id: "dut", from: "init", to: "dut", style: "structural", label: "a, b, sum" },
    { id: "log", from: "init", to: "log", label: "$display, $error" },
    { id: "vcd", from: "init", to: "vcd", label: "$dumpvars" },
  ],
});

const EDGE_NAMES: Record<DiagramEdgeId, string> = {
  cli: "$value$plusargs",
  vec: "$fopen / $fscanf / $fclose",
  dut: "a, b, sum",
  log: "$display, $error",
  vcd: "$dumpvars",
};

/** The bench diagram with the current step's arrow active; waves.vcd is dimmed without +DUMP. */
export function benchDiagram(edge: DiagramEdgeId | null, dump: boolean): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  return {
    nodes: BENCH_LAYOUT.nodes.map((nd) => ({ ...nd, state: nd.id === "vcd" && !dump ? "dim" : edge !== null && (nd.id === edge || (edge === "dut" && nd.id === "dut")) ? "active" : "normal" })),
    edges: BENCH_LAYOUT.edges.map((e) => ({ ...e, state: e.id === edge ? "active" : e.id === "vcd" && !dump ? "dim" : "normal" })),
  };
}

function BenchVarsRow({ step }: { step: BenchStep }) {
  const v = step.vars;
  const ch = (k: keyof typeof v) => step.changed.includes(k);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="bench-vars">
      <ValueChip name="vec_file" value={v.vec_file} changed={ch("vec_file")} />
      <ValueChip name="fd" value={v.fd} changed={ch("fd")} />
      <ValueChip name="code" value={v.code} changed={ch("code")} />
      <ValueChip name="a_v" value={chipValue(v.a_v)} changed={ch("a_v")} />
      <ValueChip name="b_v" value={chipValue(v.b_v)} changed={ch("b_v")} />
      <ValueChip name="exp_v" value={chipValue(v.exp_v)} changed={ch("exp_v")} />
      <ValueChip name="sum" value={chipValue(v.sum)} changed={ch("sum")} />
      <ValueChip name="n_pass" value={String(v.n_pass)} changed={ch("n_pass")} />
      <ValueChip name="n_fail" value={String(v.n_fail)} changed={ch("n_fail")} />
    </div>
  );
}

function BenchMode() {
  const [file, setFile] = useState<BenchFileName>("vectors.txt");
  const [dump, setDump] = useState<"off" | "on">("off");
  const run = useMemo(() => benchRunFor(file, dump === "on"), [file, dump]);
  const key = `${file}|${dump}`;
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">+VECTORS file</p>
          <SegmentedControl label="+VECTORS file" mono value={file} onChange={setFile} options={BENCH_FILE_CHOICES.map((f) => ({ value: f.name, label: f.name, ariaLabel: `${f.name}: ${f.note}` }))} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">+DUMP</p>
          <SegmentedControl label="+DUMP" value={dump} onChange={setDump} options={[{ value: "off", label: "without +DUMP" }, { value: "on", label: "with +DUMP" }]} />
        </div>
        <p className="break-words font-mono text-sm text-foreground" data-testid="bench-cmdline">
          <span className="text-muted-foreground">command line: </span>
          {run.cmdline.join(" ")}
        </p>
      </div>
      <PredictionPrompt
        question="What summary line does this run print?"
        options={summaryOptions(file, dump === "on").map((o) => ({ ...o, label: <span className="whitespace-pre-wrap font-mono text-[13px] [font-variant-ligatures:none]">{o.label}</span> }))}
        resetKey={key}
      >
        <BenchStepper key={key} run={run} />
      </PredictionPrompt>
    </div>
  );
}

function BenchStepper({ run, compact = false }: { run: ReturnType<typeof runBench>; compact?: boolean }) {
  const playback = usePlayback(run.steps.length, run);
  const step = run.steps[playback.index];
  const diagram = benchDiagram(step.edge, run.config.dump);
  return (
    <div className="space-y-3" data-testid="bench-run">
      <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Bench step" describeStep={(i) => run.steps[i].what} />
      <Narration stepLabel={`Step ${playback.index + 1} of ${run.steps.length} · t = ${step.timeNs} ns`} what={step.what} why={step.why} />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="tb_top initial block" lines={toTrace(run.source)} activeKey={step.codeKey} />
        <div className="min-w-0 space-y-3">
          {compact ? null : (
            <BlockDiagram
              title={`Bench diagram${step.edge ? `: the ${EDGE_NAMES[step.edge]} arrow is active` : ""}`}
              width={BENCH_LAYOUT.width}
              height={BENCH_LAYOUT.height}
              minWidth={300}
              nodes={diagram.nodes}
              edges={diagram.edges}
            />
          )}
          {run.fileText !== null && run.fileText !== undefined ? (
            <Tape name={run.config.file} text={run.fileText} pos={step.pos} consumed={step.consumed} consumedUpTo={step.pos ?? 0} offendingAt={step.offendingAt} eof={step.eof} testId="bench-tape" />
          ) : null}
          <BenchVarsRow step={step} />
          <ReturnChip value={step.returns} />
        </div>
      </div>
      <LogPanel lines={step.log} />
      {playback.isLast ? (
        <p className="text-sm text-foreground" data-testid="run-summary">
          {run.story}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// debug mode
// ---------------------------------------------------------------------------

function DebugMode({ preset }: { preset?: string }) {
  const initial = (DEBUG_CASES.some((c) => c.id === preset) ? preset : "case-2") as DebugCaseId;
  const [caseId, setCaseId] = useState<DebugCaseId>(initial);
  return (
    <div className="space-y-4">
      <SegmentedControl label="Debug case" value={caseId} onChange={setCaseId} options={DEBUG_CASES.map((c) => ({ value: c.id, label: c.title.split(":")[0], ariaLabel: c.title }))} />
      <DebugCasePanel key={caseId} caseId={caseId} />
    </div>
  );
}

function DebugCasePanel({ caseId }: { caseId: DebugCaseId }) {
  const c = debugCase(caseId);
  const buggy = useMemo(() => runBench(c.config), [c]);
  const note = useMemo(() => debugCaseNote(c), [c]);
  const [suspect, setSuspect] = useState<number | null>(null);
  const [found, setFound] = useState(false);
  const [fixId, setFixId] = useState<string | null>(null);
  const [rerunId, setRerunId] = useState<string | null>(null);
  const fixGroup = useId();
  const suspectLine = suspect !== null ? buggy.source[suspect] : null;
  const fb = suspectLine?.key ? suspectFeedback(c, suspectLine.key) : null;
  const fix = c.fixes.find((f) => f.id === rerunId) ?? null;
  const rerun = useMemo(() => (fix ? runBench(fix.config) : null), [fix]);
  const verdict = rerun ? judgeRun(rerun) : null;
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-base font-semibold text-foreground">{c.title}</h4>
        <p className="text-sm text-muted-foreground">{c.symptom}</p>
        {note ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="case-note">
            {note}
          </p>
        ) : null}
        <p className="mt-1 break-words font-mono text-sm text-foreground">
          <span className="text-muted-foreground">command line: </span>
          {buggy.cmdline.join(" ")}
        </p>
      </div>
      <LogPanel lines={buggy.log} label="The log (from the model)" testId="debug-log" />
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Click the line you suspect.</p>
        <ol aria-label="Generated bench code: choose the suspect line" className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 py-1 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">
          {buggy.source.map((line, i) => (
            <li key={i}>
              {line.key ? (
                <button
                  type="button"
                  aria-pressed={suspect === i}
                  aria-label={`Suspect line ${i + 1}: ${line.text.trim()}`}
                  onClick={() => {
                    setSuspect(i);
                    if (line.key && c.culprits.includes(line.key)) setFound(true);
                  }}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 border-l-2 px-2 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400",
                    suspect === i ? (fb?.correct ? "border-emerald-400 bg-emerald-400/15" : "border-rose-400 bg-rose-400/15") : "border-transparent",
                  )}
                >
                  <span aria-hidden className="w-6 shrink-0 text-right text-[11px] text-slate-400">
                    {i + 1}
                  </span>
                  <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.text}</code>
                </button>
              ) : (
                <div className="flex min-h-6 items-center gap-2 border-l-2 border-transparent px-2 text-slate-300">
                  <span aria-hidden className="w-6 shrink-0 text-right text-[11px] text-slate-400">
                    {i + 1}
                  </span>
                  <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.text}</code>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div aria-live="polite" data-testid="suspect-feedback">
        {fb ? (
          <p className={cn("text-sm", fb.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{fb.correct ? "Found it. " : "Not the cause. "}</strong>
            {fb.text}
          </p>
        ) : null}
      </div>
      <HintLadder hints={c.hints} resetKey={c.id} />
      {!found ? (
        <button type="button" onClick={() => setFound(true)} className="-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Skip to the fixes
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Choose a fix, then rerun the same bench model.</legend>
            <div className="grid gap-2">
              {c.fixes.map((f) => (
                <label key={f.id} className={cn("flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5 text-sm", fixId === f.id && "border-cyan-500/70 bg-cyan-500/10")}>
                  <input type="radio" name={fixGroup} checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            disabled={!fixId}
            onClick={() => setRerunId(fixId)}
            className="inline-flex h-10 items-center rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            Rerun with this fix
          </button>
          {rerun ? (
            <div data-testid="rerun">
              <LogPanel lines={rerun.log} label="Rerun log (same bench model)" testId="rerun-log" />
            </div>
          ) : null}
          {/* Always mounted, so each rerun's verdict is announced; the log above is not read out on every rerun. */}
          <div className="space-y-2" aria-live="polite" data-testid="rerun-verdict">
            {fix && verdict ? (
              <>
                <p className={cn("text-sm font-medium", verdict.honesty === "honest" ? "text-emerald-700 dark:text-emerald-300" : verdict.honesty === "lies" ? "text-rose-700 dark:text-rose-300" : "text-amber-800 dark:text-amber-200")} data-testid="verdict">
                  {verdict.honesty === "honest" ? "✓ " : verdict.honesty === "lies" ? "✕ " : "◐ "}
                  {verdict.text}
                </p>
                <p className="text-sm text-muted-foreground">
                  {fix.change} {fix.rootCause ? "This removes the root cause." : "It does not remove the root cause."}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// plusargs mode
// ---------------------------------------------------------------------------

function PlusargsMode({ preset }: { preset?: string }) {
  const initial = PLUSARG_PRESETS[preset ?? ""] ?? PLUSARG_PRESETS.lesson;
  const [tokens, setTokens] = useState<string[]>(CMDLINE_PRESETS.find((p) => p.id === initial.cmd)?.tokens ?? []);
  const [numericType, setNumericType] = useState<"int" | "logic32">("int");
  const [lookupId, setLookupId] = useState<LookupId>(initial.lookup);
  const [toAdd, setToAdd] = useState<string>(PLUSARG_PALETTE[0]);
  const spec = lookupById(lookupId);
  const result = useMemo(() => runLookup(tokens, lookupId, numericType), [tokens, lookupId, numericType]);
  const varName = spec.variable?.name ?? spec.flag ?? "";
  const key = `${tokens.join(" ")}|${numericType}|${lookupId}`;
  const callText = spec.kind === "test" ? `$test$plusargs("${spec.arg}")` : `$value$plusargs("${spec.arg}", ${varName})`;
  const questions: MultiQuestion[] = [{ id: "ret", question: `What does ${callText} return?`, options: returnOptions(result) }];
  if (result.kind === "value") questions.push({ id: "val", question: `What does ${varName} hold afterwards?`, options: valueOptions(result as ValuePlusargsResult, tokens, varName) });
  const selectId = useId();
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Command-line presets</p>
          <div className="flex flex-wrap gap-2">
            {CMDLINE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTokens(p.tokens)}
                aria-pressed={tokens.join(" ") === p.tokens.join(" ")}
                className={cn("min-h-10 rounded-full border px-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tokens.join(" ") === p.tokens.join(" ") ? "border-cyan-500 bg-cyan-500/15 font-semibold" : "border-border/70 text-muted-foreground")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Command line, searched left to right</p>
          <ol className="flex flex-wrap gap-2" aria-label="Plusargs on the command line" data-testid="tokens">
            {tokens.length === 0 ? <li className="text-sm text-muted-foreground">(no plusargs)</li> : null}
            {tokens.map((t, i) => (
              <li key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 pl-2 font-mono text-sm">
                <span>{t}</span>
                {i > 0 ? (
                  <button type="button" aria-label={`Move ${t} left`} onClick={() => setTokens((ts) => ts.map((x, j) => (j === i - 1 ? ts[i] : j === i ? ts[i - 1] : x)))} className="h-10 w-8 rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    ←
                  </button>
                ) : null}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTokens((ts) => ts.filter((_, j) => j !== i))} className="h-10 w-8 rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  ×
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor={selectId} className="text-xs text-muted-foreground">
              Add a plusarg
            </label>
            <select id={selectId} value={toAdd} onChange={(e) => setToAdd(e.target.value)} className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-sm text-foreground">
              {PLUSARG_PALETTE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setTokens((ts) => [...ts, toAdd])} className="h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Add
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Type of seed and test_num</p>
          <SegmentedControl label="Type of seed and test_num" mono value={numericType} onChange={setNumericType} options={[{ value: "int", label: "int" }, { value: "logic32", label: "logic [31:0]" }]} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Lookup</p>
          <SegmentedControl label="Lookup" mono value={lookupId} onChange={setLookupId} options={LOOKUPS.map((l) => ({ value: l.id, label: l.label }))} />
        </div>
      </div>
      <CodeTrace label="Lookups" lines={plusargSource(numericType).map((l) => ({ text: l.text, key: l.key, owner: "testbench" }))} activeKey={lookupId} />
      <MultiPrediction questions={questions} resetKey={key}>
        <PlusargScan key={key} tokens={tokens} lookupId={lookupId} numericType={numericType} />
      </MultiPrediction>
    </div>
  );
}

function PlusargScan({ tokens, lookupId, numericType }: { tokens: string[]; lookupId: LookupId; numericType: "int" | "logic32" }) {
  const spec = lookupById(lookupId);
  const result = runLookup(tokens, lookupId, numericType);
  const query = result.kind === "test" ? result.query : result.prefix;
  const total = result.scan.length + 1;
  const playback = usePlayback(total, `${tokens.join(" ")}|${lookupId}|${numericType}`);
  const atResult = playback.index >= result.scan.length;
  const current = atResult ? null : result.scan[playback.index];
  const varName = spec.variable?.name ?? spec.flag ?? "";
  const narration = current ? describeScanStep(current, query) : explainLookup(result, spec.variable?.name);
  return (
    <div className="space-y-3" data-testid="plusarg-scan">
      <PlaybackControls playback={playback} stepCount={total} stepNoun="Comparison" describeStep={(i) => (i < result.scan.length ? describeScanStep(result.scan[i], query) : "result")} />
      <Narration stepLabel={atResult ? "Result" : `Comparison ${playback.index + 1} of ${result.scan.length}`} what={narration} why={atResult ? "" : "The query must match every one of its characters at the start of the plusarg (§21.6)."} />
      <ol className="flex flex-wrap gap-3" aria-label={`"${query}" compared with each plusarg`}>
        {tokens.map((t, i) => {
          const s = result.scan[i];
          const examined = s !== undefined && i <= playback.index;
          const isCurrent = current?.tokenIndex === i;
          return (
            <li key={`${t}-${i}`} className={cn("min-w-0 rounded-lg border p-2", isCurrent ? "border-cyan-500 bg-cyan-500/10" : "border-border/70", s === undefined && "opacity-60")} data-testid={`scan-token-${i}`}>
              <div className="font-mono text-sm [font-variant-ligatures:none]">
                <span className="text-muted-foreground">+</span>
                {[...t.slice(1)].map((ch, k) => {
                  const matched = examined && k < (s?.matchedChars ?? 0);
                  const bad = examined && s?.mismatchAt === k;
                  const rest = examined && s?.matches && k >= query.length;
                  return (
                    <span key={k} className={cn(matched && "bg-emerald-500/20 font-semibold text-emerald-800 underline dark:text-emerald-200", bad && "bg-rose-500/20 text-rose-700 line-through dark:text-rose-200", rest && "bg-amber-500/20 text-amber-900 dark:text-amber-100")}>
                      {ch}
                    </span>
                  );
                })}
              </div>
              {isCurrent ? (
                <div className="mt-1 font-mono text-sm [font-variant-ligatures:none]" aria-hidden>
                  <span className="invisible">+</span>
                  {[...query].map((ch, k) => (
                    <span key={k} className={cn("rounded-sm border border-dashed border-cyan-500/60 px-[1px]", current && current.mismatchAt === k && "border-solid border-rose-500")}>
                      {ch}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-muted-foreground">{s === undefined ? "not examined: an earlier plusarg matched" : !examined ? "not yet compared" : s.matches ? "✓ match" : "✕ no match"}</p>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-muted-foreground">
        <span className="underline">underlined</span>: matched prefix · <span className="line-through">struck</span>: first mismatch · shaded amber: the remainder that gets converted
      </p>
      {atResult ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="plusarg-result">
          <ReturnChip value={displayReturn(result.returns)} />
          {result.kind === "value" ? (
            <ValueChip name={varName} value={displayPlusargValue(result.after)} changed={result.changed} />
          ) : (
            <ValueChip name={varName} value={result.returns === 0 ? 0 : 1} changed={result.returns !== 0} />
          )}
          {result.kind === "test" ? <span className="text-xs text-muted-foreground">{varName} = (result != 0)</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

const MODE_META: Record<FileReadMode, { label: string; eyebrow: string; title: string; summary: string; assumptions: string[] }> = {
  cursor: {
    label: "File reading lab: the read cursor",
    eyebrow: "Experiment",
    title: "Follow the read cursor through the file",
    summary: "Each call consumes characters from the tape and returns a code. Predict the run, then step it call by call.",
    assumptions: [
      "Deterministic model of $fopen, $fscanf, $sscanf, $fgets, $feof and $fclose (§21.3.1, §21.3.4.2, §21.3.4.3, §21.3.8). Only %h and %d conversions are modelled.",
      "“EOF detected” (§21.3.8) is modelled as a read trying to read past the last character, as in C stdio.",
      "A field shorter than its variable is zero-extended; §21.3.4.3 states only the too-long case (the LSBs are kept).",
      "Real logs add a tool-specific prefix to $fatal messages; it is shown as <Fatal prefix>.",
    ],
  },
  bench: {
    label: "File reading lab: the plusarg-selected, file-driven bench",
    eyebrow: "Worked example",
    title: "Run the file-driven bench on each vector file",
    summary: "Choose +VECTORS and +DUMP, predict the summary line, then step through plusargs, reads, drives, checks and counters.",
    assumptions: [
      "Same reading model as the cursor view; the adder is sum = a + b, 9 bits wide (§11.4.3 makes any x operand bit give an all-x sum).",
      "!== compares bit for bit including x and z (§11.4.5). %t follows $timeformat(-9, 0, \" ns\", 6) (§20.4.3).",
      "Error and fatal lines carry a tool-specific prefix, shown as <Error prefix, t> and <Fatal prefix, t>. Every real run also ends with the tool's own $finish report.",
    ],
  },
  debug: {
    label: "File reading lab: the log that lies",
    eyebrow: "Debug challenge",
    title: "Find the line that makes the log lie",
    summary: "Read the log, click the suspect line, choose a fix and rerun the same bench model. A wrong fix still lies.",
    assumptions: [
      "Logs come from the same bench model as the worked example.",
      "Case 2: the standard does not define a read on descriptor 0. The model returns -1; tools differ in the code and in whether they print a message.",
      "An honest log is defined as the one the fully guarded bench prints on the same file.",
    ],
  },
  plusargs: {
    label: "File reading lab: plusarg lookups",
    eyebrow: "Experiment",
    title: "Slide the lookup string across the command line",
    summary: "Edit the plusargs, pick a lookup and a type, predict the return value and the variable, then watch the prefix match.",
    assumptions: [
      "Deterministic model of §21.6: prefix match, command-line order, first match wins, a miss leaves the variable unchanged, an empty remainder stores zero, illegal characters write 'bx.",
      "'bx in a 2-state int becomes 0 (§6.11.2). Only %d and %s are modelled; signed or underscored remainders are excluded because §21.6 does not list the characters %d accepts.",
      "$test$plusargs returns a nonzero integer whose exact value is up to the tool; it is shown as “nonzero”.",
    ],
  },
};

export default function FileReadCursorVisualizer({ mode = "cursor", preset, className }: FileReadCursorVisualizerProps) {
  const meta = MODE_META[mode] ?? MODE_META.cursor;
  return (
    <VisualFrame label={meta.label} eyebrow={meta.eyebrow} title={meta.title} summary={meta.summary} fidelity="model" assumptions={meta.assumptions} className={className}>
      {mode === "bench" ? <BenchMode /> : mode === "debug" ? <DebugMode preset={preset} /> : mode === "plusargs" ? <PlusargsMode preset={preset} /> : <CursorMode preset={preset} />}
    </VisualFrame>
  );
}

