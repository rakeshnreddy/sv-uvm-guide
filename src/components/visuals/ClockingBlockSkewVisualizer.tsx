"use client";

import React, { useEffect, useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  DEFAULT_SCENARIO,
  comparePoints,
  describePoint,
  edgeTime,
  formatClockValue,
  formatInputSkew,
  formatOutputSkew,
  rawBlockingDriveCapture,
  runClocking,
  scenarioToSource,
  type ClockValue,
  type ClockingRun,
  type ClockingScenario,
  type DriveForm,
  type DutTiming,
  type InputSkew,
  type OutputSkew,
  type SignalTrace,
} from "@/lib/sv-clocking-model";
import { cn } from "@/lib/utils";

export const CLOCKING_MODEL_ASSUMPTIONS = [
  "One clock, period 10 ns, rising edges at 5, 15, 25 and 35 ns are the clocking events.",
  "dout counts edges: 0 before edge 1, k after edge k (plus the chosen path delay).",
  "#1step is drawn just before the edge; it is one global time-precision step (§3.14.3).",
  "Input sampling follows §14.4/§14.13, drives follow §14.16, ## follows §14.11. Regions come from F3C's time-slot model.",
  "cb.dout reads X before its first clocking event (clause unverified).",
];

const INPUT_SKEWS: { id: string; label: string; skew: InputSkew }[] = [
  { id: "1step", label: "#1step", skew: { kind: "1step" } },
  { id: "zero", label: "#0", skew: { kind: "zero" } },
  { id: "1", label: "#1ns", skew: { kind: "delay", units: 1 } },
  { id: "2", label: "#2ns", skew: { kind: "delay", units: 2 } },
  { id: "4", label: "#4ns", skew: { kind: "delay", units: 4 } },
];

const OUTPUT_SKEWS: { id: string; label: string; skew: OutputSkew }[] = [
  { id: "zero", label: "#0", skew: { kind: "zero" } },
  { id: "1", label: "#1ns", skew: { kind: "delay", units: 1 } },
  { id: "2", label: "#2ns", skew: { kind: "delay", units: 2 } },
  { id: "4", label: "#4ns", skew: { kind: "delay", units: 4 } },
];

const DUT_TIMINGS: { id: string; label: string; dut: DutTiming }[] = [
  { id: "nba", label: "flop <= at the edge", dut: { delay: 0, update: "nba" } },
  { id: "blocking", label: "blocking = at the edge", dut: { delay: 0, update: "blocking" } },
  { id: "d1", label: "+1 ns path", dut: { delay: 1, update: "nba" } },
  { id: "d4", label: "+4 ns path", dut: { delay: 4, update: "nba" } },
  { id: "d8", label: "+8 ns path", dut: { delay: 8, update: "nba" } },
  { id: "d9", label: "+9 ns path", dut: { delay: 9, update: "nba" } },
];

const DRIVE_FORMS: { id: DriveForm; label: string }[] = [
  { id: "plain", label: "cb.din <= v;" },
  { id: "intra", label: "cb.din <= ##1 v;" },
  { id: "prefix", label: "##1 cb.din <= v;" },
];

/** Mounted only while PredictionPrompt shows its results, so the parent can gate the answer row. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

const showValue = (read: { value: ClockValue; candidates: ClockValue[]; race: boolean }) =>
  read.race ? `${read.candidates.map(formatClockValue).join(" or ")} (race)` : formatClockValue(read.value);

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const LABEL_W = 66;
const PX = 13;
const MARK_H = 34;
const ROW_H = 38;
const AXIS_H = 30;

interface TimelineProps {
  scenario: ClockingScenario;
  run: ClockingRun;
  showClockvar: boolean;
}

function segmentsOf(trace: SignalTrace, end: number) {
  const segs: { from: number; to: number; value: ClockValue }[] = [];
  let from = 0;
  let value = trace.initial;
  for (const change of trace.changes) {
    if (change.at.time > end) break;
    if (change.at.time > from) segs.push({ from, to: change.at.time, value });
    from = change.at.time;
    value = change.value;
  }
  segs.push({ from, to: end, value });
  return segs;
}

function Timeline({ scenario, run, showClockvar }: TimelineProps) {
  const id = useId();
  const { clock } = scenario;
  const end = edgeTime(clock, clock.edges) + clock.period / 2;
  const x = (t: number) => LABEL_W + t * PX;
  const rows: { name: string; trace?: SignalTrace }[] = [
    { name: "clk" },
    { name: "dout", trace: run.dout },
    ...(showClockvar ? [{ name: "cb.dout", trace: run.clockvar }] : []),
    { name: "din", trace: run.din },
  ];
  const width = x(end) + 12;
  const height = MARK_H + rows.length * ROW_H + AXIS_H;
  const rowTop = (i: number) => MARK_H + i * ROW_H;
  const doutRow = 1;
  const dinRow = rows.length - 1;
  const q = scenario.questionEdge;

  const sampleX = (edge: number) => {
    const s = run.edges[edge - 1].sample.at;
    if (s.region === "preponed") return x(s.time) - 5;
    if (s.region === "observed") return x(s.time) + 4;
    return x(s.time);
  };

  const ariaLabel = [
    `Timeline from 0 to ${end} ${clock.unit}. Rising edges at ${run.edges.map((e) => e.time).join(", ")} ${clock.unit}.`,
    `dout changes at ${run.dout.changes.map((c) => `${c.at.time}`).join(", ")} ${clock.unit}.`,
    `Input samples (▼) at ${run.edges.map((e) => describePoint(e.sample.at, clock.unit)).join("; ")}.`,
    run.drive ? `Drive (◆) lands at ${describePoint(run.drive.at, clock.unit)}; the DUT captures it at edge ${run.drive.capturedAtEdge}.` : "No drive matures.",
    showClockvar ? `cb.dout holds ${run.edges.map((e) => `${formatClockValue(e.sample.value)} from edge ${e.edge}`).join(", ")}.` : "",
  ].join(" ");

  return (
    <figure className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="block w-full min-w-[520px]">
          <defs>
            <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(244,63,94,0.12)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.7)" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Edge guides; the question edge is solid cyan. */}
          {run.edges.map((e) => (
            <line
              key={`g-${e.edge}`}
              x1={x(e.time)}
              x2={x(e.time)}
              y1={MARK_H - 6}
              y2={MARK_H + rows.length * ROW_H}
              className={e.edge === q ? "stroke-cyan-500" : "stroke-muted-foreground/30"}
              strokeWidth={e.edge === q ? 2 : 1}
              strokeDasharray={e.edge === q ? undefined : "3 3"}
            />
          ))}

          {/* ▼ sample markers with a dashed drop line into the dout row. */}
          {run.edges.map((e) => {
            const sx = sampleX(e.edge);
            return (
              <g key={`s-${e.edge}`}>
                <title>{`Edge ${e.edge} input sample: ${describePoint(e.sample.at, clock.unit)}`}</title>
                <text x={sx} y={14} textAnchor="middle" className="fill-violet-600 text-[13px] font-bold dark:fill-violet-300">
                  ▼
                </text>
                <text x={sx} y={27} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                  {e.sample.at.region === "preponed" ? "1step" : e.sample.at.region === "observed" ? "#0" : `${e.sample.at.time}`}
                </text>
                <line
                  x1={sx}
                  x2={sx}
                  y1={MARK_H - 4}
                  y2={rowTop(doutRow) + ROW_H - 6}
                  className="stroke-violet-500/70"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}

          {rows.map((row, i) => {
            const top = rowTop(i);
            const hi = top + 8;
            const lo = top + ROW_H - 10;
            const mid = (hi + lo) / 2;
            return (
              <g key={row.name}>
                <text x={6} y={mid} dominantBaseline="middle" className="fill-foreground font-mono text-[11px] [font-variant-ligatures:none]">
                  {row.name}
                </text>
                {row.name === "clk" ? (
                  <path
                    d={(() => {
                      let d = `M${x(0)},${lo}`;
                      for (let k = 1; k <= clock.edges; k += 1) {
                        const t = edgeTime(clock, k);
                        d += ` L${x(t)},${lo} L${x(t)},${hi} L${x(Math.min(t + clock.period / 2, end))},${hi} L${x(Math.min(t + clock.period / 2, end))},${lo}`;
                      }
                      return `${d} L${x(end)},${lo}`;
                    })()}
                    fill="none"
                    className="stroke-slate-400"
                    strokeWidth={1.5}
                  />
                ) : (
                  segmentsOf(row.trace as SignalTrace, end).map((seg, s) => {
                    const x0 = x(seg.from);
                    const x1 = x(seg.to);
                    const unknown = seg.value === "X";
                    return (
                      <g key={s}>
                        {unknown ? (
                          <rect x={x0 + 1} y={hi} width={Math.max(0, x1 - x0 - 2)} height={lo - hi} fill={`url(#${id}-hatch)`} />
                        ) : (
                          <path
                            d={`M${x0 + 3},${hi} L${x1 - 3},${hi} L${x1},${mid} L${x1 - 3},${lo} L${x0 + 3},${lo} L${x0},${mid} Z`}
                            className={row.name === "cb.dout" ? "fill-sky-500/10 stroke-sky-500" : "fill-indigo-500/5 stroke-indigo-400"}
                            strokeWidth={1.3}
                          />
                        )}
                        {x1 - x0 > 14 ? (
                          <text x={x0 + 6} y={mid} dominantBaseline="middle" className="fill-foreground font-mono text-[10.5px]">
                            {formatClockValue(seg.value)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}

          {/* ◆ drive lands, ✓ DUT capture edge. */}
          {run.drive ? (
            <g>
              <title>{`Drive lands at ${describePoint(run.drive.at, clock.unit)}`}</title>
              <text x={x(run.drive.at.time) + 3} y={rowTop(dinRow) + 7} textAnchor="middle" className="fill-amber-600 text-[12px] font-bold dark:fill-amber-300">
                ◆
              </text>
              {run.drive.capturedAtEdge <= clock.edges ? (
                <g>
                  <title>{`The DUT flop captures din at edge ${run.drive.capturedAtEdge}`}</title>
                  <text
                    x={x(edgeTime(clock, run.drive.capturedAtEdge)) + 9}
                    y={rowTop(dinRow) + ROW_H - 1}
                    textAnchor="middle"
                    className="fill-emerald-600 text-[11px] font-bold dark:fill-emerald-400"
                  >
                    ✓
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}

          {/* Axis */}
          {run.edges.map((e) => (
            <g key={`ax-${e.edge}`}>
              <text x={x(e.time)} y={height - 17} textAnchor="middle" className={cn("font-mono text-[10px]", e.edge === q ? "fill-cyan-700 font-bold dark:fill-cyan-300" : "fill-muted-foreground")}>
                edge {e.edge}
              </text>
              <text x={x(e.time)} y={height - 5} textAnchor="middle" className="fill-muted-foreground font-mono text-[9.5px]">
                {e.time} {clock.unit}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        x-axis: simulation time in {clock.unit}. ▼ input sample, ◆ synchronous drive lands (Re-NBA), ✓ DUT flop captures din. Hatched = X. The cyan edge is
        the one you predict.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Main visual
// ---------------------------------------------------------------------------

export default function ClockingBlockSkewVisualizer() {
  const [inputId, setInputId] = useState("1step");
  const [outputId, setOutputId] = useState("zero");
  const [dutId, setDutId] = useState("nba");
  const [driveForm, setDriveForm] = useState<DriveForm>("plain");
  const [hasDefaultClocking, setHasDefaultClocking] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const scenario: ClockingScenario = useMemo(
    () => ({
      ...DEFAULT_SCENARIO,
      inputSkew: INPUT_SKEWS.find((o) => o.id === inputId)?.skew ?? DEFAULT_SCENARIO.inputSkew,
      outputSkew: OUTPUT_SKEWS.find((o) => o.id === outputId)?.skew ?? DEFAULT_SCENARIO.outputSkew,
      dut: DUT_TIMINGS.find((o) => o.id === dutId)?.dut ?? DEFAULT_SCENARIO.dut,
      driveForm,
      hasDefaultClocking,
    }),
    [inputId, outputId, dutId, driveForm, hasDefaultClocking],
  );
  const run = useMemo(() => runClocking(scenario), [scenario]);
  const lines = useMemo(() => scenarioToSource(scenario), [scenario]);
  const { clock } = scenario;
  const q = run.question;
  const unit = clock.unit;
  const key = `${inputId}|${outputId}|${dutId}|${driveForm}|${hasDefaultClocking}`;

  const correct = q.afterCb.value;
  const changeOf = (v: ClockValue) => run.dout.changes.find((c) => c.value === v);
  const options: PredictionOption[] = [q.edge - 2, q.edge - 1, q.edge].map((v) => {
    const change = changeOf(v);
    const meaning = v === q.edge ? `the value the DUT produces at edge ${q.edge}` : `what dout holds after edge ${v}`;
    let feedback: string;
    if (v === correct) {
      feedback = `${q.sample.rule} At that point dout was ${v}${q.sample.source ? `, set at ${describePoint(q.sample.source.at, unit)} by ${q.sample.source.cause}` : ""}.`;
    } else if (change && comparePoints(change.at, q.sample.at) > 0) {
      feedback = `dout only becomes ${v} at ${describePoint(change.at, unit)}, after the sample point (${describePoint(q.sample.at, unit)}). The clocking block's photo was already taken.`;
    } else {
      const newer = q.sample.source;
      feedback = `dout was ${v} earlier, but it changed to ${formatClockValue(correct)}${newer ? ` at ${describePoint(newer.at, unit)}` : ""}, which is still before the sample point (${describePoint(q.sample.at, unit)}).`;
    }
    return { id: String(v), label: <span><span className="font-mono">{v}</span>: {meaning}</span>, correct: v === correct, feedback };
  });

  const timingLabel = DUT_TIMINGS.find((o) => o.id === dutId)?.label ?? "";

  return (
    <VisualFrame
      label="Clocking block skew timeline"
      eyebrow="Experiment"
      title="When does a clocking block sample and drive?"
      summary={
        <>
          The clocking block takes a <strong>photo</strong> of each input before the edge (▼) and delivers each drive after the edge (◆). Change the skews and
          the DUT&apos;s output timing, then predict what <code className="font-mono">cb.dout</code> returns at edge {q.edge}.
        </>
      }
      fidelity="model"
      assumptions={CLOCKING_MODEL_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Input skew</p>
          <SegmentedControl label="Input skew" mono options={INPUT_SKEWS.map((o) => ({ value: o.id, label: o.label }))} value={inputId} onChange={setInputId} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Output skew</p>
          <SegmentedControl label="Output skew" mono options={OUTPUT_SKEWS.map((o) => ({ value: o.id, label: o.label }))} value={outputId} onChange={setOutputId} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">DUT output timing</p>
          <SegmentedControl label="DUT output timing" options={DUT_TIMINGS.map((o) => ({ value: o.id, label: o.label }))} value={dutId} onChange={setDutId} />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showAdvanced ? "Hide" : "Show"} advanced: ## and default clocking
        </button>
        {showAdvanced ? (
          <div className="mt-2 space-y-2 rounded-lg border border-border/70 p-3 text-sm">
            <p className="text-xs font-semibold text-foreground">Drive statement at edge {scenario.driveEdge}</p>
            <SegmentedControl label="Drive statement form" mono options={DRIVE_FORMS.map((o) => ({ value: o.id, label: o.label }))} value={driveForm} onChange={setDriveForm} />
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-amber-500" checked={hasDefaultClocking} onChange={(e) => setHasDefaultClocking(e.target.checked)} />
              Declare <code className="font-mono [font-variant-ligatures:none]">cb</code> as <code className="font-mono">default clocking</code>
            </label>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace label="Generated from the controls" lines={lines} contextKeys={["skews", "drive", "read"]} activeKey={revealed ? "read" : undefined} />
        <div className="min-w-0 space-y-2">
          <Timeline scenario={scenario} run={run} showClockvar={revealed} />
          {run.driveError ? (
            <p role="alert" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              ✕ {run.driveError.error} ({run.driveError.clause}). <code className="font-mono">cb.din &lt;= ##1 v;</code> needs no default clocking: its ## counts
              cycles of cb itself (§14.16).
            </p>
          ) : null}
        </div>
      </div>

      <PredictionPrompt
        resetKey={key}
        question={
          <>
            The DUT output is &ldquo;{timingLabel}&rdquo;. After <code className="font-mono">@(cb)</code> at edge {q.edge} (t = {q.time} {unit}), which value
            does <code className="font-mono">x = cb.dout;</code> read?
          </>
        }
        options={options}
      >
        <RevealSignal onChange={setRevealed} />
        <div className="space-y-4" aria-live="polite">
          <p className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm text-foreground">
            <strong>cb.dout = {formatClockValue(correct)}</strong> at edge {q.edge}. Sample point: {describePoint(q.sample.at, unit)} ({q.sample.clause}).{" "}
            {q.afterCb.why}
            {run.driveError ? " (This assumes you fix the compile error in the drive line first.)" : ""}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-xs">
              <caption className="sr-only">Value read at each edge by three reading styles</caption>
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th scope="col" className="py-1 pr-2">Edge</th>
                  <th scope="col" className="py-1 pr-2">▼ sample point</th>
                  <th scope="col" className="py-1 pr-2 font-mono [font-variant-ligatures:none]">@(cb); cb.dout</th>
                  <th scope="col" className="py-1 pr-2 font-mono [font-variant-ligatures:none]">@(posedge clk); cb.dout</th>
                  <th scope="col" className="py-1 pr-2 font-mono [font-variant-ligatures:none]">@(posedge clk); dout</th>
                </tr>
              </thead>
              <tbody>
                {run.edges.map((e) => (
                  <tr key={e.edge} className={cn("border-b border-border/40", e.edge === q.edge && "bg-cyan-500/10")}>
                    <th scope="row" className="py-1 pr-2 font-medium">
                      {e.edge} ({e.time} {unit})
                    </th>
                    <td className="py-1 pr-2">{describePoint(e.sample.at, unit)}</td>
                    <td className="py-1 pr-2 font-mono">✓ {formatClockValue(e.afterCb.value)}</td>
                    <td className={cn("py-1 pr-2 font-mono", e.afterPosedge.race && "text-rose-700 dark:text-rose-300")}>
                      {e.afterPosedge.race ? "⚠ " : ""}
                      {showValue(e.afterPosedge)}
                    </td>
                    <td className={cn("py-1 pr-2 font-mono", e.raw.race && "text-rose-700 dark:text-rose-300")}>
                      {e.raw.race ? "⚠ " : ""}
                      {showValue(e.raw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">@(cb) then cb.dout</strong> always reads the photo of that edge: the clocking block updates its samples, then fires
              @(cb) in Observed (§14.10, §14.13).
            </li>
            <li>
              <strong className="text-foreground">@(posedge clk) then cb.dout</strong> wakes in Active and races the clocking block&apos;s own update: old or new
              photo (§14.13 NOTE). Never mix the two styles.
            </li>
            <li>
              <strong className="text-foreground">@(posedge clk) then raw dout</strong> reads in Active.{" "}
              {run.edges.some((e) => e.raw.race)
                ? "Here the DUT updates dout with a blocking assignment in Active at the same edge, so the read races (§4.7)."
                : "It happens to be deterministic here, but only because nothing writes dout in Active at the edge. Change the DUT to a blocking update and it races."}
            </li>
          </ul>

          <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">◆ The drive at edge {scenario.driveEdge}</p>
            {run.drive ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {run.driveBlocksUntilEdge ? <li>##1 blocks the testbench thread until edge {run.driveBlocksUntilEdge}; then the drive executes (§14.11).</li> : null}
                {run.drive.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-rose-700 dark:text-rose-300">✕ No drive: the code does not compile ({run.driveError?.clause}).</p>
            )}
            <p className="text-muted-foreground">
              Compare a racy <code className="font-mono [font-variant-ligatures:none]">@(posedge clk) din = 8&apos;hA5;</code>: the DUT may capture it at edge{" "}
              {rawBlockingDriveCapture(scenario.driveEdge).join(" or edge ")}, depending on process order (F3C).
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Skews in this run: input {formatInputSkew(scenario.inputSkew, unit)}, output {formatOutputSkew(scenario.outputSkew, unit)}.
          </p>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
