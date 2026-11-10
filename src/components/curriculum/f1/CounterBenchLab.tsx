"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { MutationMatrix, cellKey, type MutationCell, type MutationPrediction } from "@/components/visual-system/MutationMatrix";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback, usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  BENCH_DUTS,
  BENCH_DUT_IDS,
  COMPARE_FORMS,
  COMPARE_FORM_IDS,
  COUNTER_BENCH_ASSUMPTIONS,
  HOLE_FILL_EDGE,
  LESSON_CHECKS,
  LESSON_CONFIG,
  MUTANT_IDS,
  PLAN_ITEMS,
  RUN_LENGTHS,
  benchRtlLines,
  brokenParts,
  codeCoverage,
  configKey,
  coverageQuestion,
  evidenceVerdict,
  explainCheck,
  explainRun,
  findMutationPreset,
  functionalCoverage,
  mutantVerdict,
  mutationMatrix,
  percent,
  planRows,
  printedLinesOptions,
  runBench,
  showSample,
  type BenchConfig,
  type BenchDutId,
  type BenchPart,
  type BenchRun,
  type CompareFormId,
  type CounterBenchMode,
  type LabOption,
} from "@/lib/counter-bench-model";
import { cn } from "@/lib/utils";

export type { CounterBenchMode };

export interface CounterBenchLabProps {
  /** "mutation" (default): one run, stepped; "matrix": compare forms × mutants; "coverage": live coverage report. */
  mode?: CounterBenchMode;
  /** Mutation mode only: a preset id from MUTATION_PRESETS ("lesson-mutant", "x-blind", "self-copy"). */
  preset?: string;
}

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border/70 bg-background/50 p-3";
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const selectClass =
  "h-10 min-w-0 max-w-full rounded-md border border-border/70 bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

const toOptions = (options: LabOption[], code = true): PredictionOption[] =>
  options.map((o) => ({
    id: o.id,
    label: code ? <span className={cn(mono, "text-xs")}>{o.label}</span> : o.label,
    correct: o.correct,
    feedback: o.feedback,
  }));

/** A persistent polite live region: mounted from the first render, so its first text is announced. */
function LiveRegion({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="bench-live">
      {text}
    </p>
  );
}

/** Calls `onShown` once, when a prediction prompt reveals its children. */
function OnShown({ onShown, children }: { onShown: () => void; children: React.ReactNode }) {
  useEffect(() => {
    onShown();
    // Once per reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Waveform: count (ACT, solid) against expected (EXP, dashed)
// ---------------------------------------------------------------------------

const CW = 16;
const LEFT = 30;
const TOP = 24;
const LEVEL = 11;
const X_LANE = 12;

function CheckWaveform({ run, upTo }: { run: BenchRun; upTo: number }) {
  const n = run.checks.length;
  const width = LEFT + n * CW + 6;
  const plotTop = TOP + X_LANE;
  const height = plotTop + 7 * LEVEL + 24;
  const x = (i: number) => LEFT + i * CW + CW / 2;
  const y = (v: number | "X") => (v === "X" ? TOP + X_LANE / 2 : plotTop + (7 - v) * LEVEL + 4);
  const path = (values: (number | "X")[]) =>
    values
      .map((v, i) => {
        const x0 = LEFT + i * CW;
        const prefix = i === 0 ? `M${x0},${y(v)}` : `L${x0},${y(v)}`;
        return `${prefix} L${x0 + CW},${y(v)}`;
      })
      .join(" ");
  const shown = run.checks.slice(0, upTo + 1);
  const act = shown.map((c) => c.actual);
  const exp = shown.map((c) => c.compared);
  const glyph = (o: string) => (o === "pass" ? "✓" : o === "fail" ? "✕" : "–");
  const tone = (o: string) => (o === "pass" ? "fill-emerald-600 dark:fill-emerald-400" : o === "fail" ? "fill-rose-600 dark:fill-rose-400" : "fill-muted-foreground");
  const c = run.checks[upTo];
  const label = `Waveform for checks 0 to ${upTo}: count (ACT, solid) and expected (EXP, dashed). At check ${upTo}, count is ${showSample(c.actual)} and expected is ${showSample(c.compared)}; results so far PASS=${c.passSoFar} FAIL=${c.failSoFar}.`;
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={label}>
        {/* X lane and value grid */}
        <rect x={LEFT} y={TOP} width={n * CW} height={X_LANE} className="fill-rose-500/10" />
        <text x={LEFT - 4} y={TOP + X_LANE / 2 + 3.5} fontSize={11} textAnchor="end" className="fill-rose-700 dark:fill-rose-300">
          X
        </text>
        {[0, 7].map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={LEFT + n * CW} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="1 3" />
            <text x={LEFT - 4} y={y(v) + 3.5} fontSize={11} textAnchor="end" className="fill-muted-foreground">
              {v}
            </text>
          </g>
        ))}
        {shown.map((ch) => (
          <g key={ch.index}>
            <line x1={x(ch.index)} x2={x(ch.index)} y1={TOP} y2={plotTop + 7 * LEVEL + 8} className="stroke-border" strokeDasharray="2 2" />
            <text x={x(ch.index)} y={14} fontSize={12} textAnchor="middle" className={tone(ch.outcome)}>
              {glyph(ch.outcome)}
            </text>
          </g>
        ))}
        <path d={path(exp)} fill="none" strokeWidth={2} strokeDasharray="4 3" className="stroke-amber-600 dark:stroke-amber-300" />
        <path d={path(act)} fill="none" strokeWidth={1.6} className="stroke-cyan-700 dark:stroke-cyan-300" />
        <line x1={x(upTo)} x2={x(upTo)} y1={TOP - 4} y2={plotTop + 7 * LEVEL + 10} strokeWidth={1.5} className="stroke-foreground/70" />
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={height - 3} fontSize={11} textAnchor="middle" className="fill-muted-foreground">
            {i}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        x-axis: check k, taken at the falling edge {`10 + 10k`} ns. <span className="text-cyan-700 dark:text-cyan-300">── ACT</span> is count;{" "}
        <span className="text-amber-700 dark:text-amber-300">- - EXP</span> is the value the compare uses. Top row: ✓ pass, ✕ fail, – no compare ran. The shaded lane is X.
      </figcaption>
    </figure>
  );
}

function CheckTable({ run, upTo }: { run: BenchRun; upTo: number }) {
  return (
    <details className="rounded-lg border border-border/60 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-foreground [@media(pointer:coarse)]:min-h-10 [@media(pointer:coarse)]:py-3">Checks so far as a table</summary>
      <div className="mt-2 max-w-full overflow-x-auto" role="region" aria-label="Checks table" tabIndex={0}>
        <table className="w-full border-collapse text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="px-1 py-1">k</th>
              <th scope="col" className="px-1 py-1">ns</th>
              <th scope="col" className="px-1 py-1">count</th>
              <th scope="col" className="px-1 py-1">EXP</th>
              <th scope="col" className="px-1 py-1">cond</th>
              <th scope="col" className="px-1 py-1">result</th>
            </tr>
          </thead>
          <tbody className={mono}>
            {run.checks.slice(0, upTo + 1).map((c) => (
              <tr key={c.index} className="border-t border-border/50">
                <td className="px-1 py-0.5">{c.index}</td>
                <td className="px-1 py-0.5">{c.timeNs}</td>
                <td className="px-1 py-0.5">{showSample(c.actual)}</td>
                <td className="px-1 py-0.5">{showSample(c.compared)}</td>
                <td className="px-1 py-0.5">{c.cond === null ? "–" : `1'b${c.cond}`}</td>
                <td className="px-1 py-0.5">{c.outcome === "none" ? "no compare" : c.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Anatomy diagram with the broken part in its error state
// ---------------------------------------------------------------------------

function AnatomyDiagram({ run }: { run: BenchRun }) {
  const broken = brokenParts(run);
  const isBroken = (p: BenchPart) => broken.some((b) => b.part === p);
  const dut = BENCH_DUTS[run.config.dut];
  const form = COMPARE_FORMS[run.config.form];
  const node = (id: BenchPart, label: string, sublabel: string, kind: DiagramNode["kind"], col: number, row: number): DiagramNode => ({
    id,
    label,
    sublabel,
    kind,
    x: col === 0 ? 20 : 196,
    y: 34 + row * 82,
    w: 144,
    h: 52,
    state: isBroken(id) ? "error" : "normal",
    badge: isBroken(id) ? "broken" : undefined,
  });
  const nodes: DiagramNode[] = [
    { id: "tb", label: "tb_top", kind: "generic", x: 6, y: 6, w: 348, h: 252, container: true },
    node("stim", "clk, rst", dut.rstTiedLow ? "rst tied to 0 at the DUT" : "rst high at edge 0", "generic", 0, 0),
    node("model", "expected", form.selfCopy ? "a copy of count" : "reference model", "model", 1, 0),
    node("dut", "dut", dut.short, "dut", 0, 1),
    node("chk", form.op ? `count ${form.op} expected` : "compare", form.op ? "the compare" : "commented out", "scoreboard", 1, 1),
    node("cov", "seen_max", "coverage counter", "generic", 0, 2),
    node("sum", "$display", "PASS=n FAIL=m", "generic", 1, 2),
  ];
  const edges: DiagramEdge[] = [
    { id: "e1", from: "stim", to: "dut", style: "data", state: dut.rstTiedLow ? "error" : "normal" },
    { id: "e2", from: "stim", to: "model", style: "causal" },
    { id: "e3", from: "dut", to: "chk", style: "data" },
    { id: "e4", from: "model", to: "chk", style: "data", state: form.selfCopy ? "error" : "normal" },
    { id: "e5", from: "dut", to: "cov", style: "data" },
    { id: "e6", from: "chk", to: "sum", style: "data", state: form.op ? "normal" : "dim" },
    { id: "e7", from: "cov", to: "sum", style: "data" },
  ];
  const description = broken.length ? `Broken: ${broken.map((b) => `${b.part}: ${b.reason}`).join(" ")}` : "Nothing is broken: the DUT is correct and the compare can fail.";
  return (
    <div className="space-y-1">
      <BlockDiagram title="Anatomy of the self-checking bench" width={360} height={264} nodes={nodes} edges={edges} role="img" description={description} />
      <ul className="space-y-1 text-xs" aria-label="Broken parts">
        {broken.length ? (
          broken.map((b, i) => (
            <li key={i} className="text-rose-700 dark:text-rose-300">
              <span aria-hidden>✕ </span>
              <span className="font-semibold">{b.part}</span>: {b.reason}
            </li>
          ))
        ) : (
          <li className="text-muted-foreground">Nothing is broken in this configuration.</li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mutation mode
// ---------------------------------------------------------------------------

function benchLines(dutId: BenchDutId, formId: CompareFormId): CodeTraceLine[] {
  const dut = BENCH_DUTS[dutId];
  const form = COMPARE_FORMS[formId];
  const lines: CodeTraceLine[] = [];
  if (dut.resetOnlyWhenUnknown) lines.push({ key: "dut-rtl", text: `// in up_counter: ${dut.changedLine}`, owner: "design" });
  lines.push({ key: "inst", text: dut.resetOnlyWhenUnknown ? BENCH_DUTS.correct.changedLine : dut.changedLine, owner: "testbench" });
  lines.push({ key: "repeat", text: `repeat (${LESSON_CHECKS}) begin`, owner: "testbench" });
  lines.push({ key: "wait", text: "  @(negedge clk);", owner: "testbench" });
  lines.push({ key: "seen", text: "  if (count === 3'd7) seen_max++;", owner: "testbench" });
  if (form.before) lines.push({ key: "copy", text: `  ${form.before}`, owner: "testbench" });
  lines.push({ key: "compare", text: `  ${form.line}`, owner: "testbench" });
  lines.push({ key: "step", text: "  expected = expected + 3'd1;", owner: "testbench" });
  lines.push({ key: "end", text: "end", owner: "testbench" });
  lines.push({ key: "print1", text: '$display("PASS=%0d FAIL=%0d", pass_cnt, fail_cnt);', owner: "testbench" });
  lines.push({ key: "print2", text: '$display("COVERAGE seen_max=%0d", seen_max);', owner: "testbench" });
  return lines;
}

function MutationRun({ config, announce }: { config: BenchConfig; announce: (t: string) => void }) {
  const run = useMemo(() => runBench(config), [config]);
  const playback = usePlayback(run.checks.length, configKey(config));
  const i = Math.min(playback.index, run.checks.length - 1);
  const narration = explainCheck(run.checks[i], config.form);
  const isLast = i === run.checks.length - 1;

  // Announce on manual steps and when playback stops, never on every autoplay tick.
  const playing = playback.isPlaying;
  useEffect(() => {
    if (!playing) announce(narration);
  }, [announce, narration, playing]);

  const dut = BENCH_DUTS[config.dut];
  const verdicts = dut.mutant ? [mutantVerdict(config.dut, config.form)] : MUTANT_IDS.map((m) => mutantVerdict(m, config.form));

  return (
    <div className="space-y-3">
      <CheckWaveform run={run} upTo={i} />
      <PlaybackControls playback={playback} stepCount={run.checks.length} stepNoun="Check" describeStep={(k) => `check ${k} at ${run.checks[k].timeNs} ns, ${run.checks[k].outcome}`} />
      <p className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-sm text-foreground" data-testid="check-narration">
        {narration}
      </p>
      <CheckTable run={run} upTo={i} />
      {isLast ? (
        <div className={panel}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">The bench prints</p>
          <pre className={cn(mono, "mt-1 whitespace-pre-wrap text-sm text-foreground")} data-testid="printed-lines">
            {`${run.passLine}\n${run.coverageLine}`}
          </pre>
          <p className="mt-2 text-sm text-muted-foreground">{explainRun(run)}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Step to the last check to see the two printed lines and {dut.mutant ? "whether the check caught the mutant" : "what each mutant does with this compare"}.
        </p>
      )}
      <AnatomyDiagram run={run} />
      {isLast ? (
        <div className={panel} data-testid="mutant-verdicts">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {dut.mutant ? "Did the check catch the mutant?" : `Can ${COMPARE_FORMS[config.form].label} fail? Each mutant with this compare:`}
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {verdicts.map((v) => (
              <li key={v.mutant} className={v.killed ? "text-foreground" : "text-rose-700 dark:text-rose-300"}>
                <span aria-hidden>{v.killed ? "✕ " : "○ "}</span>
                {v.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MutationView({ preset, announce }: { preset?: string; announce: (t: string) => void }) {
  const initial = findMutationPreset(preset);
  const [dut, setDut] = useState<BenchDutId>(initial.dut);
  const [form, setForm] = useState<CompareFormId>(initial.form);
  const config: BenchConfig = useMemo(() => ({ ...LESSON_CONFIG, dut, form }), [dut, form]);
  const options = useMemo(() => toOptions(printedLinesOptions(config)), [config]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">DUT variant</p>
        <SegmentedControl
          label="DUT variant"
          value={dut}
          onChange={setDut}
          options={BENCH_DUT_IDS.map((id) => ({ value: id, label: BENCH_DUTS[id].label }))}
          className={touchButtons}
        />
        <p className="text-xs text-muted-foreground">{BENCH_DUTS[dut].change}</p>
      </div>
      <CodeTrace
        label="tb_top check loop (the compare form is the select on its line)"
        lines={benchLines(dut, form)}
        renderLineControl={(line) =>
          line.key === "compare" ? (
            <select aria-label="Compare form" value={form} onChange={(e) => setForm(e.target.value as CompareFormId)} className={cn(selectClass, "h-8 w-[9.5rem] bg-slate-900 text-slate-100 [@media(pointer:coarse)]:h-10")}>
              {COMPARE_FORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {COMPARE_FORMS[id].label}
                </option>
              ))}
            </select>
          ) : null
        }
      />
      <PredictionPrompt
        question={`Run the bench: which two lines does it print after ${LESSON_CHECKS} checks?`}
        options={options}
        resetKey={configKey(config)}
        className={touchButtons}
      >
        <MutationRun config={config} announce={announce} />
      </PredictionPrompt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix mode
// ---------------------------------------------------------------------------

function MatrixView({ announce }: { announce: (t: string) => void }) {
  const verdicts = useMemo(() => mutationMatrix(), []);
  const [predictions, setPredictions] = useState<Record<string, MutationPrediction>>({});
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | undefined>();
  const [fillHole, setFillHole] = useState(false);

  const cells: Record<string, MutationCell> = Object.fromEntries(
    verdicts.map((v) => [cellKey(v.form, v.mutant), { state: v.killed ? "caught" : "survived", summary: v.run.passLine } satisfies MutationCell]),
  );
  const rows = COMPARE_FORM_IDS.map((id) => ({ id, label: COMPARE_FORMS[id].label }));
  const columns = MUTANT_IDS.map((id) => ({ id, label: BENCH_DUTS[id].short }));
  const plan = planRows(LESSON_CHECKS, fillHole ? HOLE_FILL_EDGE : null);
  const selectedVerdict = selected ? verdicts.find((v) => cellKey(v.form, v.mutant) === selected) : undefined;
  const correctFails = COMPARE_FORM_IDS.map((f) => runBench({ ...LESSON_CONFIG, form: f })).filter((r) => r.fail > 0).length;
  // The plan table and its mutant column describe the same bench: with the hole filled,
  // both come from the run with rst asserted again at HOLE_FILL_EDGE.
  const planVerdicts = useMemo(() => (fillHole ? mutationMatrix(LESSON_CHECKS, HOLE_FILL_EDGE) : verdicts), [fillHole, verdicts]);
  const anyKill = (m: BenchDutId) => planVerdicts.some((v) => v.mutant === m && v.killed);
  const holeVerdicts = planVerdicts.filter((v) => v.mutant === "reset-ignored");
  const countId = useId();
  const predictedCount = verdicts.filter((v) => predictions[cellKey(v.form, v.mutant)] !== undefined).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Each row is the lesson bench with one compare form; each column swaps in one mutant. Press a cell to predict whether that bench prints a failure. A mutant counts as caught only when
        the same bench prints FAIL=0 on the correct DUT.
      </p>
      <MutationMatrix
        label="Compare forms against mutants"
        rows={rows}
        columns={columns}
        cells={cells}
        predictions={predictions}
        onPredict={(r, c, v) => setPredictions((p) => ({ ...p, [cellKey(r, c)]: v }))}
        revealed={revealed}
        onCellSelect={(r, c) => setSelected(cellKey(r, c))}
        selectedCell={selected}
        rowHeader="Compare form"
        columnTotals
        className={touchButtons}
      />
      {!revealed ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-describedby={countId}
            className={cn(buttonClass, "border-amber-500/60 bg-amber-500/10")}
            onClick={() => {
              setRevealed(true);
              announce(`Revealed. ${verdicts.filter((v) => v.killed).length} of ${verdicts.length} runs catch their mutant.`);
            }}
          >
            Run all {verdicts.length} benches and reveal
          </button>
          <span id={countId} className="text-xs text-muted-foreground" data-testid="predicted-count">
            {predictedCount} of {verdicts.length} predicted{predictedCount < verdicts.length ? "; cells you skip are revealed without a grade" : ""}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          On the correct DUT {correctFails === 0 ? "every compare form prints FAIL=0, so each ✕ is a real kill, not a false alarm." : `${correctFails} compare forms fail even on the correct DUT.`} Press a
          result to read its run.
        </p>
      )}
      {selectedVerdict ? (
        <div className={panel} data-testid="matrix-detail">
          <p className="text-sm font-semibold text-foreground">
            {COMPARE_FORMS[selectedVerdict.form].label} against {BENCH_DUTS[selectedVerdict.mutant].short}
          </p>
          <p className="mt-1 text-sm text-foreground">{selectedVerdict.text}</p>
          <p className="mt-1 text-sm text-muted-foreground">{explainRun(selectedVerdict.run)}</p>
        </div>
      ) : null}
      <div className={panel}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{fillHole ? `The plan, with coverage counts with rst asserted again at edge ${HOLE_FILL_EDGE}` : "The plan, with coverage counts on the lesson bench"}</p>
        <div className="mt-2 max-w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs" aria-label="Plan rows with coverage counts">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-2">Plan row</th>
                <th scope="col" className="py-1 pr-2">Hits</th>
                <th scope="col" className="py-1">Its mutant</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((row) => (
                <tr key={row.id} className="border-t border-border/50">
                  <th scope="row" className="py-1 pr-2 font-medium text-foreground">
                    {row.label}
                  </th>
                  <td className={cn(mono, "py-1 pr-2", revealed && row.hits === 0 && "font-semibold text-rose-700 dark:text-rose-300")}>{revealed ? row.hits : "?"}</td>
                  <td className="py-1">
                    {row.mutant ? (
                      <>
                        {BENCH_DUTS[row.mutant].short}
                        {revealed ? <span className="text-muted-foreground"> ({anyKill(row.mutant) ? "caught" : "survives"})</span> : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {revealed ? (
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground [@media(pointer:coarse)]:min-h-10">
              <input type="checkbox" checked={fillHole} onChange={(e) => setFillHole(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
              Fill the hole: assert rst again at edge {HOLE_FILL_EDGE}
            </label>
            {fillHole ? (
              <ul className="space-y-1 text-sm" aria-label="Reset ignored mid-count, with the hole filled">
                {holeVerdicts.map((v) => (
                  <li key={v.form} className={v.killed ? "text-foreground" : "text-rose-700 dark:text-rose-300"}>
                    <span aria-hidden>{v.killed ? "✕ " : "○ "}</span>
                    <span className={mono}>{COMPARE_FORMS[v.form].label}</span>: {v.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage mode
// ---------------------------------------------------------------------------

function CoverageResults({ run }: { run: BenchRun }) {
  const code = codeCoverage(run);
  const fn = functionalCoverage(run);
  const verdict = evidenceVerdict(run);
  const hitFor: Partial<Record<string, number>> = { always: code.lineHits.always, reset: code.lineHits.reset, wrap: code.lineHits.wrap, incr: code.lineHits.incr };
  const verdictClass =
    verdict.verdict === "no-evidence"
      ? "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      : verdict.verdict === "fail"
        ? "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200"
        : "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  return (
    <div className="space-y-3" data-testid="coverage-results">
      <CodeTrace
        label="up_counter with hits per line"
        lines={benchRtlLines(run.config.dut).map((l) => ({ key: l.key, text: l.text, owner: "design" }))}
        renderLineControl={(line) => {
          const hits = line.key ? hitFor[line.key] : undefined;
          if (hits === undefined) return null;
          return (
            <span className={cn(mono, "inline-block min-w-[2.5rem] rounded border px-1 text-right text-[11px]", hits === 0 ? "border-rose-400 text-rose-300" : "border-slate-500 text-slate-200")} aria-label={`${hits} hits`}>
              {hits}×
            </span>
          );
        }}
      />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <div className={panel}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Code coverage (§19.2)</p>
          <p className="mt-1 text-sm text-foreground" data-testid="statement-coverage">
            Statements {code.statementsCovered} of {code.statementsTotal} ({percent(code.statementsCovered, code.statementsTotal)}%) <span className="text-xs text-muted-foreground">§40.2.2</span>
          </p>
          <p className="text-sm text-foreground" data-testid="branch-coverage">
            Branches {code.branchesCovered} of {code.branches.length} ({percent(code.branchesCovered, code.branches.length)}%) <span className="text-xs text-muted-foreground">tool-defined</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {code.branches.map((b) => (
              <li key={b.id} className={b.hits === 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}>
                <span className={mono}>{b.label}</span>: {b.hits}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-foreground">
            Toggle {code.toggledBits} of {code.toggle.length} bits <span className="text-xs text-muted-foreground">§40.2.2</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {code.toggle.map((t) => (
              <li key={t.signal}>
                <span className={mono}>{t.signal}</span>: {t.seen0 ? "0 ✓" : "0 –"} {t.seen1 ? "1 ✓" : "1 –"}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">A bit seen at 0 and at 1 counts as toggled (§40.2.2). Tools that count 0-to-1 and 1-to-0 transitions may report rst as only partly toggled.</p>
        </div>
        <div className={panel}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Functional coverage against the plan</p>
          <ul className="mt-1 space-y-1 text-sm" aria-label="Plan items with hit counts">
            {PLAN_ITEMS.map((p) => (
              <li key={p.id} className={cn("flex items-baseline justify-between gap-2", fn.hits[p.id] === 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>
                <span>
                  {p.label}
                  {!p.scenario ? <span className="text-xs text-muted-foreground"> (evidence)</span> : null}
                </span>
                <span className={mono}>{fn.hits[p.id]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-foreground" data-testid="functional-coverage">
            Scenarios {fn.scenariosCovered} of {fn.scenariosTotal} ({percent(fn.scenariosCovered, fn.scenariosTotal)}%)
          </p>
        </div>
      </div>
      <p className={cn("rounded-lg border p-3 text-sm font-medium", verdictClass)} data-testid="evidence-verdict">
        {verdict.text}
      </p>
    </div>
  );
}

function CoverageView({ announce }: { announce: (t: string) => void }) {
  const [checks, setChecks] = useState<number>(LESSON_CHECKS);
  const [midResetAt, setMidResetAt] = useState<number | null>(null);
  const [compareOn, setCompareOn] = useState(true);
  const config: BenchConfig = useMemo(
    () => ({ dut: "correct", form: compareOn ? "case-ne" : "commented", checks, midResetAt: midResetAt !== null && midResetAt < checks ? midResetAt : null }),
    [checks, midResetAt, compareOn],
  );
  const key = configKey(config);
  const run = useMemo(() => runBench(config), [config]);

  const [revealedKeys, setRevealedKeys] = useState<string[]>([]);
  const [lastRevealed, setLastRevealed] = useState<BenchConfig | null>(null);
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const [pending, setPending] = useState<{ key: string; prev: BenchConfig | null }>({ key, prev: null });
  const seen = revealedKeys.includes(key);
  if (pending.key !== key && !seen) setPending({ key, prev: lastRevealed });

  const question = useMemo(() => coverageQuestion(pending.key === key ? pending.prev : lastRevealed, config), [pending, key, lastRevealed, config]);
  const markShown = useCallback(() => {
    setRevealedKeys((ks) => (ks.includes(key) ? ks : [...ks, key]));
    setLastRevealed(config);
    setAnsweredKey(key);
    announce(evidenceVerdict(run).text);
  }, [announce, config, key, run]);

  const showPrompt = !seen || answeredKey === key;

  return (
    <div className="space-y-4">
      <div className={cn(panel, "space-y-3")}>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Run length</p>
          <SegmentedControl
            label="Run length"
            value={String(checks)}
            onChange={(v) => {
              const n = Number(v);
              setChecks(n);
              // A second reset that no longer fits the run is cleared, not hidden and restored later.
              if (midResetAt !== null && midResetAt > n - 1) setMidResetAt(null);
            }}
            options={RUN_LENGTHS.map((n) => ({ value: String(n), label: `${n} cycles` }))}
            className={touchButtons}
          />
        </div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
          Assert rst again at rising edge
          <select
            className={selectClass}
            value={config.midResetAt === null ? "none" : String(config.midResetAt)}
            onChange={(e) => setMidResetAt(e.target.value === "none" ? null : Number(e.target.value))}
          >
            <option value="none">never (lesson bench)</option>
            {Array.from({ length: checks - 1 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                edge {k}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">The compare</p>
          <SegmentedControl
            label="The compare"
            value={compareOn ? "on" : "off"}
            onChange={(v) => setCompareOn(v === "on")}
            mono
            options={[
              { value: "on", label: "count !== expected" },
              { value: "off", label: "// disabled" },
            ]}
            className={touchButtons}
          />
        </div>
      </div>
      {showPrompt ? (
        <PredictionPrompt question={question.question} options={toOptions(question.options, question.kind === "baseline")} resetKey={key} className={touchButtons}>
          <OnShown key={key} onShown={markShown}>
            <CoverageResults run={run} />
          </OnShown>
        </PredictionPrompt>
      ) : (
        <CoverageResults run={run} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const TITLES: Record<CounterBenchMode, { label: string; title: string; summary: string }> = {
  mutation: {
    label: "Counter bench lab: can this check fail?",
    title: "Can this check fail?",
    summary: "Pick a DUT variant and a compare form, predict the two printed lines, then step through the 20 checks.",
  },
  matrix: {
    label: "Counter bench lab: compare forms against mutants",
    title: "Which checks catch which mutants?",
    summary: "Predict every cell, then reveal. The plan's coverage counts show where a mutant can hide.",
  },
  coverage: {
    label: "Counter bench lab: live coverage of the up_counter",
    title: "Coverage measures; only checks decide",
    summary: "Change the run, predict what the coverage report does, then run it.",
  },
};

export default function CounterBenchLab({ mode = "mutation", preset }: CounterBenchLabProps) {
  const [live, setLive] = useState("");
  const reduced = usePrefersReducedMotion();
  const announce = useCallback((t: string) => setLive(t), []);
  const t = TITLES[mode] ?? TITLES.mutation;
  return (
    <VisualFrame label={t.label} eyebrow="Experiment" title={t.title} summary={t.summary} fidelity="model" assumptions={COUNTER_BENCH_ASSUMPTIONS} className={cn("min-w-0", reduced && "[&_*]:!transition-none")}>
      <LiveRegion text={live} />
      {mode === "matrix" ? <MatrixView announce={announce} /> : mode === "coverage" ? <CoverageView announce={announce} /> : <MutationView preset={preset} announce={announce} />}
    </VisualFrame>
  );
}
