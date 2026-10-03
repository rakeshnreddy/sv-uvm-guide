"use client";

import React, { useMemo, useState } from "react";

import { BlockDiagram, type DiagramEdge, type DiagramNode, type DiagramPort, type DiagramToken } from "@/components/visual-system/BlockDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  DEFAULT_SB_CONFIG,
  MUTANTS,
  POLICIES,
  SB_T_DROP,
  endOfTestLabels,
  itemShort,
  mutantLabels,
  ns,
  policyLabels,
  policyMatrix,
  runScoreboard,
  scoreboardSource,
  truthLabels,
  type DutOrdering,
  type EndOfTest,
  type MatchPolicy,
  type Mutant,
  type SbConfig,
  type SbItem,
  type SbResult,
  type SbStep,
  type SbTruth,
} from "@/lib/scoreboard-model";
import { cn } from "@/lib/utils";

export const SCOREBOARD_MODEL_ASSUMPTIONS = [
  "Five tagged requests (IDs 0 and 1). A correct DUT keeps each ID in request order; the cross-ID DUT answers id 1 faster, which AXI allows.",
  "The predictor writes the expected item when the request is seen. In one cycle its write is processed before the output monitor's; real monitors race, which is why the queue policies hold an early actual instead of failing it.",
  "uvm_scoreboard adds no behaviour (uvm-core src/comps/uvm_scoreboard.svh): matching, draining and accounting are your code, shown on the right.",
  "End of test follows uvm_objection: the test drops at 50 ns; a drain time delays the end; a raised objection holds it (src/base/uvm_objection.svh). Writes after run_phase ends never reach the scoreboard.",
  "Not modelled: latency checks, reset flush, monitors that reuse one handle (always publish a clone).",
];

const truthTone: Record<SbTruth, string> = {
  "clean-pass": "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  "hollow-pass": "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  "false-alarm": "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  "caught-run": "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  "caught-check": "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  escaped: "border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200",
};

const actionGlyph: Partial<Record<SbStep["action"], { glyph: string; text: string; className: string }>> = {
  match: { glyph: "✓", text: "match", className: "fill-emerald-600 dark:fill-emerald-400" },
  "held-match": { glyph: "✓", text: "match (held)", className: "fill-emerald-600 dark:fill-emerald-400" },
  mismatch: { glyph: "✕", text: "mismatch", className: "fill-rose-600 dark:fill-rose-400" },
  "held-mismatch": { glyph: "✕", text: "mismatch (held)", className: "fill-rose-600 dark:fill-rose-400" },
  unexpected: { glyph: "✕", text: "unexpected", className: "fill-rose-600 dark:fill-rose-400" },
  held: { glyph: "⏸", text: "held", className: "fill-amber-600 dark:fill-amber-300" },
  overwrite: { glyph: "!", text: "overwrote an outstanding item", className: "fill-amber-600 dark:fill-amber-300" },
};

/* ------------------------------------------------------------------------- */
/* Lane timeline                                                              */
/* ------------------------------------------------------------------------- */

const LANE_LABEL_W = 78;
const COL_W = 46;
const ROW_H = 40;

function Chip({ x, y, item, kind, active, faded }: { x: number; y: number; item: SbItem; kind: "exp" | "act"; active: boolean; faded: boolean }) {
  const w = COL_W - 6;
  return (
    <g opacity={faded ? 0.4 : 1}>
      <rect
        x={x - w / 2}
        y={y}
        width={w}
        height={30}
        rx={kind === "exp" ? 4 : 8}
        className={cn(kind === "exp" ? "fill-teal-500/10 stroke-teal-600 dark:stroke-teal-400" : "fill-sky-500/15 stroke-sky-600 dark:stroke-sky-400", active && "stroke-amber-500")}
        strokeWidth={active ? 2.4 : 1.2}
        strokeDasharray={kind === "exp" ? "4 2" : undefined}
      />
      <text x={x} y={y + 12} textAnchor="middle" className="fill-foreground font-mono text-[10.5px] font-bold [font-variant-ligatures:none]">
        #{item.seq}
      </text>
      <text x={x} y={y + 25} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px] [font-variant-ligatures:none]">
        {item.id}·{item.data.toString(16).toUpperCase()}
      </text>
    </g>
  );
}

function ScoreboardLanes({ result, current }: { result: SbResult; current?: SbStep }) {
  const maxT = Math.max(result.endTime, ...result.actuals.map((a) => a.t), ...result.expected.map((e) => e.t)) + 1;
  const cols = maxT + 1;
  const width = LANE_LABEL_W + cols * COL_W + 8;
  const height = 22 + ROW_H * 4 + 20;
  const cx = (t: number) => LANE_LABEL_W + t * COL_W + COL_W / 2;
  const rowY = (r: number) => 22 + r * ROW_H;
  const endX = cx(result.endTime) + COL_W / 2;
  const runSteps = result.steps.filter((s) => s.phase === "run");
  const verdicts = runSteps.filter((s) => actionGlyph[s.action]);
  const objectionEnd = result.config.endOfTest === "none" ? SB_T_DROP : result.endTime;
  const describe = `Expected items at ${result.expected.map((e) => `#${e.item.seq} ${ns(e.t)}`).join(", ")}. Actual items at ${result.actuals
    .map((a) => `#${a.item.seq} ${ns(a.t)}`)
    .join(", ")}. run_phase ends at ${ns(result.endTime)}.`;

  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block min-w-[300px]" role="img" aria-label={`Transaction timeline. ${describe}`}>
          {/* not-observed region */}
          <rect x={endX} y={14} width={Math.max(0, width - endX - 4)} height={ROW_H * 4 + 10} className="fill-slate-500/10" />
          <line x1={endX} x2={endX} y1={10} y2={rowY(4)} className="stroke-rose-500" strokeWidth={1.8} strokeDasharray="5 3" />
          <text x={endX + 4} y={11} className="fill-rose-700 text-[9.5px] font-semibold dark:fill-rose-300">
            run_phase ends · later writes unseen
          </text>
          {current ? <rect x={cx(current.t) - COL_W / 2} y={14} width={COL_W} height={ROW_H * 4 + 10} className="fill-cyan-400/10" /> : null}
          {["EXP predictor", "ACT monitor", "SCB verdict", "objection"].map((label, r) => (
            <g key={label}>
              <line x1={LANE_LABEL_W} x2={width - 4} y1={rowY(r) + ROW_H - 2} y2={rowY(r) + ROW_H - 2} className="stroke-border" strokeWidth={0.6} />
              <text x={4} y={rowY(r) + 16} className="fill-foreground text-[10.5px] font-semibold">
                {label.split(" ")[0]}
              </text>
              <text x={4} y={rowY(r) + 29} className="fill-muted-foreground text-[9px]">
                {label.split(" ")[1]}
              </text>
            </g>
          ))}
          {result.expected.map((e) => (
            <Chip
              key={`e${e.item.seq}`}
              x={cx(e.t)}
              y={rowY(0) + 4}
              item={e.item}
              kind="exp"
              active={current?.kind === "exp" && current.item?.seq === e.item.seq && current.t === e.t}
              faded={e.t > result.endTime}
            />
          ))}
          {result.actuals.map((a, i) => (
            <Chip
              key={`a${i}`}
              x={cx(a.t)}
              y={rowY(1) + 4}
              item={a.item}
              kind="act"
              active={current?.kind === "act" && current.t === a.t}
              faded={a.t > result.endTime}
            />
          ))}
          {verdicts.map((s, i) => {
            const g = actionGlyph[s.action]!;
            const stacked = verdicts.slice(0, i).filter((v) => v.t === s.t).length;
            return (
              <text key={`v${i}`} x={cx(s.t) + stacked * 12} y={rowY(2) + 24} textAnchor="middle" className={cn("text-[15px] font-bold", g.className)}>
                <title>{`${ns(s.t)}: ${g.text}`}</title>
                {g.glyph}
              </text>
            );
          })}
          {/* objection: test objection to the drop, then the drain */}
          <rect x={cx(0) - COL_W / 2} y={rowY(3) + 10} width={cx(SB_T_DROP) - cx(0) + COL_W / 2} height={12} rx={3} className="fill-violet-500/30 stroke-violet-500" />
          <text x={cx(0) - COL_W / 2 + 4} y={rowY(3) + 19} className="fill-foreground text-[8.5px]">
            test
          </text>
          {objectionEnd > SB_T_DROP ? (
            <>
              <rect
                x={cx(SB_T_DROP) + COL_W / 2}
                y={rowY(3) + 10}
                width={cx(objectionEnd) - cx(SB_T_DROP)}
                height={12}
                rx={3}
                className={result.config.endOfTest === "drain-time" ? "fill-slate-400/30 stroke-slate-500" : "fill-amber-400/30 stroke-amber-500"}
                strokeDasharray={result.config.endOfTest === "drain-time" ? "3 2" : undefined}
              />
              <text x={cx(SB_T_DROP) + COL_W / 2 + 4} y={rowY(3) + 19} className="fill-foreground text-[8.5px]">
                {result.config.endOfTest === "drain-time" ? "drain time" : result.timedOut ? "scoreboard (watchdog)" : "scoreboard"}
              </text>
            </>
          ) : null}
          {Array.from({ length: cols }, (_, t) => (
            <text key={`ax${t}`} x={cx(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9.5px]">
              {t * 10}
            </text>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        x-axis: simulation time in ns (one column per 10 ns cycle). EXP chips are dashed, ACT chips solid; each shows #request and id·data. ✓ match, ✕
        mismatch or unexpected, ⏸ held for check_phase, ! overwrote an outstanding prediction.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------- */
/* Topology                                                                   */
/* ------------------------------------------------------------------------- */

function ScoreboardTopology({ policy, step }: { policy: MatchPolicy; step?: SbStep }) {
  const nodes: DiagramNode[] = [
    { id: "in_mon", label: "req_mon", kind: "monitor", x: 16, y: 16, w: 130, h: 48 },
    { id: "dut", label: "DUT", sublabel: "tagged requests", kind: "dut", x: 245, y: 16, w: 150, h: 48 },
    { id: "out_mon", label: "rsp_mon", kind: "monitor", x: 494, y: 16, w: 130, h: 48 },
    { id: "pred", label: "predictor", kind: "predictor", x: 16, y: 128, w: 130, h: 50 },
    {
      id: "scb",
      label: "rsp_scoreboard",
      sublabel: policyLabels[policy],
      kind: "scoreboard",
      x: 230,
      y: 122,
      w: 200,
      h: 60,
      state: step?.error ? "error" : step?.action === "match" || step?.action === "held-match" ? "ok" : "normal",
    },
  ];
  const ports: DiagramPort[] = [
    { id: "in_ap", nodeId: "in_mon", side: "bottom", offset: 0.5, kind: "analysis_port" },
    { id: "pred_ap", nodeId: "pred", side: "right", offset: 0.5, kind: "analysis_port" },
    { id: "exp_imp", nodeId: "scb", side: "left", offset: 0.55, kind: "analysis_imp", label: "exp_imp" },
    { id: "act_imp", nodeId: "scb", side: "right", offset: 0.55, kind: "analysis_imp", label: "act_imp" },
    { id: "out_ap", nodeId: "out_mon", side: "bottom", offset: 0.5, kind: "analysis_port" },
  ];
  const edges: DiagramEdge[] = [
    { id: "pins-in", from: "in_mon", to: "dut", style: "structural", label: "pins" },
    { id: "pins-out", from: "dut", to: "out_mon", style: "structural", label: "pins" },
    { id: "req", from: "in_ap", to: "pred", style: "data", label: "req", points: [[81, 100]] },
    { id: "exp", from: "pred_ap", to: "exp_imp", style: "data", label: "exp", state: step?.kind === "exp" ? "active" : "normal" },
    { id: "act", from: "out_ap", to: "act_imp", style: "data", label: "act", points: [[559, 155]], state: step?.kind === "act" ? (step.error ? "error" : "active") : "normal" },
  ];
  const tokens: DiagramToken[] =
    step?.item && (step.kind === "exp" || step.kind === "act")
      ? [{ edgeId: step.kind, t: 0.55, label: `#${step.item.seq}`, tone: step.error ? "error" : step.kind === "exp" ? "control" : "data" }]
      : [];
  return <BlockDiagram title={`Scoreboard topology. ${step ? step.what : ""}`} width={640} height={196} minWidth={480} nodes={nodes} ports={ports} edges={edges} tokens={tokens} showLegend />;
}

/* ------------------------------------------------------------------------- */
/* Prediction feedback built from the model result                            */
/* ------------------------------------------------------------------------- */

function verdictOptions(r: SbResult): PredictionOption[] {
  const firstRun = r.steps.find((s) => s.phase === "run" && s.error);
  const firstCheck = r.steps.find((s) => s.phase === "check" && s.error);
  const o = r.outcome;
  return [
    {
      id: "pass",
      label: "PASS: no UVM_ERROR at all",
      correct: o === "pass",
      feedback:
        o === "pass"
          ? r.summary
          : o === "run"
            ? `A compare fails while the test runs. ${firstRun?.why ?? ""}`
            : `Nothing fails during run_phase, which is exactly why a scoreboard without a leftover check would pass. ${firstCheck?.why ?? ""}`,
    },
    {
      id: "run",
      label: "UVM_ERROR during run_phase: a compare fails",
      correct: o === "run",
      feedback:
        o === "run"
          ? r.summary
          : o === "pass"
            ? `No compare disagrees. ${r.summary}`
            : `No compare disagrees while the test runs: the problem is something that never arrives or never matches, and only check_phase can see that. ${firstCheck?.why ?? ""}`,
    },
    {
      id: "check",
      label: "No run-time error, but check_phase reports leftovers",
      correct: o === "check",
      feedback:
        o === "check"
          ? r.summary
          : o === "pass"
            ? `Nothing is left over to report. ${r.summary}`
            : `It fails earlier, at ${ns(firstRun?.t ?? 0)}: ${firstRun?.why ?? ""}`,
    },
  ];
}

function PendingPanel({ step }: { step?: SbStep }) {
  if (!step) return null;
  const { pending, held, outstanding } = step.snapshot;
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inside the scoreboard after this step</p>
      <div className="space-y-1.5">
        {pending.length === 0 ? <p className="text-muted-foreground">No expected items pending.</p> : null}
        {pending.map((p) => (
          <div key={p.name} className="flex flex-wrap items-center gap-1.5">
            <code className="min-w-[5.5rem] font-mono text-[11px] text-foreground [font-variant-ligatures:none]">{p.name}</code>
            {p.items.length === 0 ? <span className="text-muted-foreground">empty</span> : null}
            {p.items.map((it, i) => (
              <span key={`${p.name}-${i}`} className="rounded border border-dashed border-teal-500/70 px-1.5 py-0.5 font-mono text-[11px] text-teal-800 dark:text-teal-200">
                EXP #{it.seq} {itemShort(it)}
              </span>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <code className="min-w-[5.5rem] font-mono text-[11px] text-foreground">held_q</code>
          {held.length === 0 ? <span className="text-muted-foreground">empty</span> : null}
          {held.map((it, i) => (
            <span key={`h${i}`} className="rounded border border-sky-500/70 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-800 dark:text-sky-100">
              ACT {itemShort(it)}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground">
          outstanding = <strong className="text-foreground">{outstanding}</strong>
        </p>
      </div>
    </div>
  );
}

function RunReveal({ result }: { result: SbResult }) {
  const steps = result.steps;
  const playback = usePlayback(steps.length, JSON.stringify(result.config));
  const step = steps[Math.min(playback.index, steps.length - 1)];
  const lines: CodeTraceLine[] = scoreboardSource(result.config).map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));
  const t = truthLabels[result.truth];
  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl border p-3 text-sm", truthTone[result.truth])} aria-live="polite">
        <p className="font-semibold">
          <span aria-hidden className="mr-1.5">
            {t.glyph}
          </span>
          {result.verdict} · {t.text}
        </p>
        <p className="mt-1 text-foreground/90">{result.summary}</p>
      </div>
      <ScoreboardLanes result={result} current={step} />
      <PlaybackControls playback={playback} stepCount={steps.length} stepNoun="Scoreboard step" describeStep={(i) => steps[i]?.what ?? ""} />
      <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-sm" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {step.phase === "check" ? "check_phase" : step.phase === "end" ? "end of run_phase" : ns(step.t)} · step {playback.index + 1} of {steps.length}
        </p>
        <p className="mt-1 text-[15px] text-foreground">
          <strong>What: </strong>
          {step.what}
        </p>
        <p className="mt-1 text-foreground/90">
          <strong>Why: </strong>
          {step.why}
        </p>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-3">
          <ScoreboardTopology policy={result.config.policy} step={step} />
          <PendingPanel step={step} />
        </div>
        <CodeTrace label="rsp_scoreboard (generated from the model)" lines={lines} activeKey={step.codeKey} className="min-w-0" />
      </div>
      <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Simulation log">
        {result.log.join("\n")}
      </pre>
    </div>
  );
}

const reorderOptions: PredictionOption[] = [
  {
    id: "in-order",
    label: "In-order queue",
    correct: false,
    feedback: "An in-order queue compares every response with the oldest prediction, so the swapped pair mismatches. Its trouble is the opposite: it also fires on legal cross-ID reordering.",
  },
  {
    id: "per-id",
    label: "Per-ID queues",
    correct: false,
    feedback: "Per-ID queues compare each response with the oldest prediction for its ID. #3 arriving first meets #1's prediction, so it mismatches at once.",
  },
  {
    id: "single-slot",
    label: "One slot per ID",
    correct: false,
    feedback: "One slot per ID fails on nearly everything here, correct traffic included. It does not let this bug through, but its alarms carry no information.",
  },
  {
    id: "search-any",
    label: "Search any match",
    correct: true,
    feedback:
      "Searching for any equal item ignores order, so #3 and #1 each find their twin and nothing is reported. Same-ID order is a protocol rule; only an ordered per-ID check enforces it.",
  },
];

function PolicyMatrix({ dut }: { dut: DutOrdering }) {
  const matrix = useMemo(() => policyMatrix(dut), [dut]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-xs">
        <caption className="mb-2 text-left text-[11px] text-muted-foreground">
          Every DUT bug against every policy, {dut === "cross-id" ? "DUT reorders across IDs" : "in-order DUT"}, wait-until-idle, check_phase on.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-border p-1.5 text-left font-semibold">
              DUT bug
            </th>
            {POLICIES.map((p) => (
              <th key={p} scope="col" className="border-b border-border p-1.5 text-left font-semibold">
                {policyLabels[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.mutant}>
              <th scope="row" className="border-b border-border/60 p-1.5 text-left font-medium">
                {mutantLabels[row.mutant]}
              </th>
              {row.cells.map((c) => (
                <td key={c.policy} className={cn("border-b border-border/60 p-1.5", c.truth === "escaped" || c.truth === "false-alarm" ? "font-semibold text-rose-700 dark:text-rose-300" : "text-foreground")}>
                  <span aria-hidden className="mr-1">
                    {truthLabels[c.truth].glyph}
                  </span>
                  {truthLabels[c.truth].text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreboardExplorer() {
  const [config, setConfig] = useState<SbConfig>(DEFAULT_SB_CONFIG);
  const set = <K extends keyof SbConfig>(key: K, value: SbConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));
  const result = useMemo(() => runScoreboard(config), [config]);
  const configKey = JSON.stringify(config);

  return (
    <VisualFrame
      label="Scoreboard matching experiment"
      eyebrow="Experiment"
      title="Which bugs does your scoreboard catch?"
      summary="Pick a matching policy, a DUT and a DUT bug. Predict the report, then step through every write to the scoreboard."
      fidelity="model"
      assumptions={SCOREBOARD_MODEL_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">Matching policy</p>
          <SegmentedControl<MatchPolicy> label="Matching policy" value={config.policy} onChange={(v) => set("policy", v)} options={POLICIES.map((p) => ({ value: p, label: policyLabels[p] }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">DUT response order</p>
          <SegmentedControl<DutOrdering>
            label="DUT response order"
            value={config.dut}
            onChange={(v) => set("dut", v)}
            options={[
              { value: "in-order", label: "In request order" },
              { value: "cross-id", label: "Reorders across IDs" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">DUT bug</p>
          <SegmentedControl<Mutant> label="DUT bug" value={config.mutant} onChange={(v) => set("mutant", v)} options={MUTANTS.map((m) => ({ value: m, label: mutantLabels[m] }))} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">End of test</p>
          <SegmentedControl<EndOfTest>
            label="End of test"
            value={config.endOfTest}
            onChange={(v) => set("endOfTest", v)}
            options={(["none", "drain-time", "until-idle"] as EndOfTest[]).map((e) => ({ value: e, label: endOfTestLabels[e] }))}
          />
          <label className="mt-2 flex min-h-10 items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={config.checkPhase} onChange={(e) => set("checkPhase", e.target.checked)} className="h-4 w-4 accent-cyan-500" />
            check_phase reports leftovers
          </label>
        </div>
      </div>

      <PredictionPrompt
        question={`Five requests, IDs 0 and 1. With “${policyLabels[config.policy]}”, a DUT that ${config.dut === "cross-id" ? "reorders across IDs" : "answers in order"} and “${mutantLabels[config.mutant]}”, what does the test report?`}
        options={verdictOptions(result)}
        resetKey={configKey}
      >
        <RunReveal key={configKey} result={result} />
      </PredictionPrompt>

      <div className="space-y-3 rounded-xl border border-border/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Exhaustive check</p>
        <PredictionPrompt question="The DUT swaps two responses that share an ID (#1 and #3). Which scoreboard lets this bug through?" options={reorderOptions} resetKey={config.dut}>
          <PolicyMatrix dut={config.dut} />
        </PredictionPrompt>
      </div>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Debug challenge: the single-slot scoreboard                               */
/* ------------------------------------------------------------------------- */

const DEBUG_CONFIG: SbConfig = { policy: "single-slot", dut: "cross-id", mutant: "none", endOfTest: "until-idle", checkPhase: true };

const suspects: { key: string; verdict: "culprit" | "innocent"; feedback: string }[] = [
  {
    key: "exp-store",
    verdict: "culprit",
    feedback:
      "Yes. expected[t.id] = t keeps one prediction per ID. Requests #1 and #3 are both id 0 and both outstanding, so storing #3 erases #1. Every later id-0 compare is against the wrong request.",
  },
  {
    key: "unexpected",
    verdict: "innocent",
    feedback: "This line reports the symptom, not the cause: the slot is gone because an earlier compare consumed the wrong prediction. Ask why the slot held the wrong item.",
  },
  {
    key: "match",
    verdict: "innocent",
    feedback: "Comparing data is right. The compare fails because it is handed the wrong expected item. Look at how predictions are stored.",
  },
  {
    key: "check",
    verdict: "innocent",
    feedback: "check_phase is the part that works: it would catch a dropped response. The false errors happen during run_phase.",
  },
];

const fixes: { policy: MatchPolicy; label: string }[] = [
  { policy: "per-id", label: "Give each ID an ordered queue: exp_q[id].push_back(t) on predict, exp_q[id].pop_front() on compare" },
  { policy: "in-order", label: "Use one queue for every ID and compare in arrival order" },
  { policy: "search-any", label: "Keep a list and claim any pending prediction that equals the response" },
];

function ScoreboardDebugChallenge() {
  const buggy = useMemo(() => runScoreboard(DEBUG_CONFIG), []);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fix, setFix] = useState<MatchPolicy | null>(null);
  const lines: CodeTraceLine[] = scoreboardSource({ policy: "single-slot", endOfTest: "none", checkPhase: true }).map((l) => ({ text: l.text, key: l.key, owner: "testbench" }));
  const chosen = suspects.find((s) => s.key === suspect);
  const found = chosen?.verdict === "culprit";
  const grade = useMemo(() => {
    if (!fix) return null;
    const rows = MUTANTS.map((mutant) => ({ mutant, r: runScoreboard({ ...DEBUG_CONFIG, policy: fix, mutant }) }));
    const ok = rows.every(({ mutant, r }) => (mutant === "none" ? r.truth === "clean-pass" : r.truth === "caught-run" || r.truth === "caught-check"));
    return { rows, ok };
  }, [fix]);

  return (
    <VisualFrame
      label="Scoreboard debugging challenge"
      eyebrow="Debug it"
      title="A correct AXI-style DUT fails every regression"
      summary="The DUT keeps each ID in order and answers id 1 faster, which the protocol allows. The scoreboard below still reports errors. Find the line, then pick a fix; the model regrades it against a correct DUT and four buggy ones."
      fidelity="model"
      assumptions={SCOREBOARD_MODEL_ASSUMPTIONS}
    >
      <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Failing log">
        {buggy.log.join("\n")}
      </pre>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1: select the line that causes the false errors</p>
        <CodeTrace
          label="ooo_scoreboard (the original lesson code)"
          lines={lines}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            suspects.some((s) => s.key === line.key) && lines.find((l) => l.key === line.key) === line ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {chosen ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{found ? "Found it. " : "Not this one. "}</strong>
            {chosen.feedback}
          </p>
        ) : null}
        {!found ? (
          <HintLadder
            className="mt-2"
            hints={[
              "How many id-0 requests are outstanding at 30 ns? Count them in the timeline: #1 and #3.",
              "Where does the scoreboard keep a prediction until its response arrives? How many can it keep per ID?",
              "Follow #1: it is written at 10 ns. What happens to it at 30 ns?",
            ]}
          />
        ) : null}
      </div>
      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2: choose a fix; the model reruns a correct DUT and every DUT bug</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {fixes.map((f) => (
              <label key={f.policy} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fix === f.policy ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="sb-fix" checked={fix === f.policy} onChange={() => setFix(f.policy)} className="mt-1 accent-cyan-500" />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
          {grade ? (
            <div
              aria-live="polite"
              className={cn("mt-3 space-y-2 rounded-xl border p-3 text-sm", grade.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}
            >
              <p className="font-semibold text-foreground">
                {grade.ok
                  ? "Accepted. Clean on the correct DUT, and every bug is caught."
                  : fix === "in-order"
                    ? "Rejected. The correct DUT still fails: one queue assumes responses return in request order across IDs."
                    : "Rejected. The correct DUT passes, but a same-ID reorder now escapes."}
              </p>
              <ul className="space-y-1">
                {grade.rows.map(({ mutant, r }) => (
                  <li key={mutant} className="flex flex-wrap gap-x-2">
                    <span className="min-w-[13rem] text-muted-foreground">{mutantLabels[mutant]}</span>
                    <span className={r.truth === "escaped" || r.truth === "false-alarm" ? "font-semibold text-rose-700 dark:text-rose-300" : "text-foreground"}>
                      <span aria-hidden className="mr-1">
                        {truthLabels[r.truth].glyph}
                      </span>
                      {truthLabels[r.truth].text}
                    </span>
                  </li>
                ))}
              </ul>
              {grade.ok ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">
                  {scoreboardSource({ policy: "per-id", endOfTest: "until-idle", checkPhase: true })
                    .map((l) => l.text)
                    .join("\n")}
                </pre>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </VisualFrame>
  );
}

/**
 * Scoreboard matching: in-order vs per-ID queues, end-of-test accounting and
 * draining, and which DUT bugs each policy catches. `mode="debug"` shows the
 * broken single-slot scoreboard as a find-and-fix challenge.
 */
export default function ScoreboardMatchingVisualizer({ mode = "explore" }: { mode?: "explore" | "debug" }) {
  return mode === "debug" ? <ScoreboardDebugChallenge /> : <ScoreboardExplorer />;
}
