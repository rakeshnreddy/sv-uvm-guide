"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  addrPresets,
  buildExplorerSpec,
  covergroupToSource,
  createCoverageAccumulator,
  describeValues,
  elaborateCovergroup,
  forecastClosure,
  formatValue,
  generateStimulus,
  isClosed,
  opPresets,
  OP_LABELS,
  OP_TYPEDEF,
  stimulusPresets,
  stimulusToSource,
  type AddrPresetId,
  type CellMark,
  type ClosureForecast,
  type CovergroupSpec,
  type CoverageSnapshot,
  type CrossBinDecl,
  type ElaboratedCovergroup,
  type OpPresetId,
  type ResolvedBin,
  type SampleRecord,
  type StimulusPresetId,
  type StimulusSpec,
} from "@/lib/coverage-model";
import { cn } from "@/lib/utils";

export const COVERAGE_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §19.5 (bins), §19.6 (crosses, binsof/intersect, ignore/illegal cross bins) and §19.11 (coverage computation). Tested rule by rule.",
  "Stimulus is drawn from an exact distribution with a seeded generator: dist weights multiply across variables and excluded combinations are removed. A real solver's random sequence differs, but the probabilities match.",
  "Every sample calls sample() once with fresh values (no transitions, no iff guard).",
  "The expected sample count is exact (coupon collector with unequal probabilities); one seeded run is one draw from that distribution.",
  "An illegal_bins hit is reported as a run-time error. The model keeps sampling; a real tool may stop at its error limit.",
];

const fmtPct = (p: number) => `${Math.round(p * 10) / 10}%`;
const fmtN = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "∞");
const fmtP = (p: number) => (p >= 0.01 ? `${Math.round(p * 1000) / 10}%` : `1 in ${Math.round(1 / p)}`);
const opName = (v: number) => formatValue(v, OP_LABELS);
const describeSample = (values: Record<string, number>) => `addr = ${values.addr}, op = ${opName(values.op)}`;

interface RunStep {
  samples: number;
  snapshot: CoverageSnapshot;
  record?: SampleRecord;
  kind: "start" | "new" | "error" | "end";
  what: string;
  why: string;
}

interface RunResult {
  steps: RunStep[];
  curve: number[];
  closedAt: number | null;
  errorSamples: number[];
}

const MAX_ERROR_STEPS = 3;

function crossItem(snapshot: CoverageSnapshot) {
  return snapshot.items.find((i) => i.type === "cross");
}

/** Runs the seeded stimulus until 100% or the budget, keeping a snapshot at every sample that changes coverage. */
export function simulateExplorerRun(model: ElaboratedCovergroup, stimulus: StimulusSpec, budget: number, seed: number, forecast: ClosureForecast): RunResult {
  const acc = createCoverageAccumulator(model);
  const samples = generateStimulus(stimulus, budget, seed);
  const first = acc.snapshot();
  const cross0 = crossItem(first);
  const steps: RunStep[] = [
    {
      samples: 0,
      snapshot: first,
      kind: "start",
      what: "No samples yet: every counted bin is a hole.",
      why: `The cross has ${cross0?.total ?? 0} counted bins (automatic bins plus your own, minus ignored and illegal products). Each random sample lands in exactly one cross cell.`,
    },
  ];
  const curve: number[] = [];
  const errorSamples: number[] = [];
  let lastNew = 0;
  let errorSteps = 0;
  let closedAt: number | null = null;
  for (const s of samples) {
    const record = acc.apply(s);
    curve.push(record.percent);
    const n = record.index + 1;
    if (record.errors.length > 0) errorSamples.push(n);
    const closed = isClosed(acc.snapshot());
    if (record.newlyCovered.length > 0 || closed) {
      const snapshot = acc.snapshot();
      const cross = crossItem(snapshot);
      const crossName = model.crosses[0]?.name ?? "";
      const names = record.newlyCovered.map((k) => (k.startsWith(`${crossName}.`) ? k.slice(crossName.length + 1) : k));
      const gap = n - lastNew;
      lastNew = n;
      steps.push({
        samples: n,
        snapshot,
        record,
        kind: closed ? "end" : "new",
        what: `Sample ${n}: ${describeSample(record.values)} → first hit of ${names.join(" and ")}.${closed ? ` cg_bus reaches 100% at sample ${n}.` : ""}`,
        why: closed
          ? `The average for this stimulus is ${fmtN(forecast.expectedSamples)} samples; this seed needed ${n}. The last holes take longest because almost every sample lands in a bin that is already covered.`
          : `${cross?.covered ?? 0} of ${cross?.total ?? 0} cross bins covered. ${gap > 1 ? `The ${gap - 1} sample${gap - 1 === 1 ? "" : "s"} before this one landed in bins that were already covered.` : "It came right after the previous new bin."}`,
      });
      if (closed) {
        closedAt = n;
        break;
      }
    } else if (record.errors.length > 0 && errorSteps < MAX_ERROR_STEPS) {
      errorSteps += 1;
      steps.push({
        samples: n,
        snapshot: acc.snapshot(),
        record,
        kind: "error",
        what: `✕ Sample ${n}: ${describeSample(record.values)} hits illegal_bins ${record.errors[0].bin}.`,
        why: "The simulator reports a run-time error. The sample counts in no cross bin. Whether the run stops depends on the tool's error-limit setting, not on the covergroup.",
      });
    }
  }
  if (closedAt === null) {
    const snapshot = acc.snapshot();
    const holes = forecast.gating.filter((t) => {
      const it = snapshot.items.find((i) => i.name === t.item);
      return !it?.bins.find((b) => b.key === t.key)?.covered;
    });
    const unreachable = holes.filter((h) => h.p <= 0);
    steps.push({
      samples: samples.length,
      snapshot,
      kind: "end",
      what: `Stopped after ${samples.length} samples at ${fmtPct(snapshot.percent)}: ${holes.length} hole${holes.length === 1 ? "" : "s"} left.`,
      why:
        unreachable.length > 0
          ? `${unreachable.map((h) => h.name).join(", ")} ha${unreachable.length === 1 ? "s" : "ve"} probability 0: the stimulus never generates ${unreachable.length === 1 ? "it" : "them"}. More samples cannot help; change the constraints or, if the spec says it cannot happen, exclude it.`
          : `Every hole is reachable but rare (${holes
              .slice(0, 3)
              .map((h) => `${h.name}: ${fmtP(h.p)} per sample`)
              .join("; ")}). Run longer or bias the stimulus toward them.`,
    });
  }
  return { steps, curve, closedAt, errorSamples };
}

function predictionOptions(forecast: ClosureForecast): PredictionOption[] {
  const k = forecast.gating.length;
  const base = forecast.couponBaseline;
  const e = forecast.expectedSamples;
  const finite = Number.isFinite(e);
  const near = finite && e <= 1.5 * base;
  const rarest = [...forecast.gating].sort((a, b) => a.p - b.p)[0];
  const unreachable = forecast.unreachable.map((t) => t.name).join(", ");
  const exact = finite ? `The model's exact average is ${fmtN(e)} samples.` : "";
  return [
    {
      id: "k",
      label: `About ${k} samples: one per bin`,
      correct: false,
      feedback: `Random samples repeat bins. Once most bins are covered, almost every new sample lands in a covered bin, so the last holes take longest. Even with ${k} equally likely bins the average is ${k} × H${k} ≈ ${fmtN(base)}. ${exact}`,
    },
    {
      id: "coupon",
      label: `About ${fmtN(base)} samples (${k} bins × H${k}, the coupon-collector number)`,
      correct: near,
      feedback: near
        ? `The bins are close to equally likely, so the coupon-collector estimate holds. ${exact}`
        : finite
          ? `That holds only when all ${k} bins are equally likely. Here the rarest bin, ${rarest?.name}, is hit ${fmtP(rarest?.p ?? 0)} per sample, so it sets the pace. ${exact}`
          : `That assumes every bin can be hit. ${unreachable} has probability 0 under this stimulus.`,
    },
    {
      id: "rare",
      label: `Far more than ${fmtN(base)}: a rare bin sets the pace`,
      correct: finite && !near,
      feedback:
        finite && !near
          ? `Right: ${rarest?.name} is hit only ${fmtP(rarest?.p ?? 0)} per sample, and closure waits for the rarest bin. ${exact}`
          : finite
            ? `No bin is rare enough to dominate here. ${exact}`
            : `It is worse than rare: ${unreachable} has probability 0, so the wait is infinite.`,
    },
    {
      id: "never",
      label: "Never: some bin cannot be generated by this stimulus",
      correct: !finite,
      feedback: !finite
        ? `Right: ${unreachable} has probability 0. Random sampling can never close it. Fix the constraint, or exclude the bin if the spec says it cannot happen.`
        : `Every counted bin has a nonzero probability, so 100% is reachable. ${exact}`,
    },
  ];
}

/** Lets the parent know the prediction prompt has revealed its children. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

const markStyles: Record<CellMark, { glyph: string; label: string; className: string }> = {
  ignore: { glyph: "⊘", label: "ignore_bins", className: "border-slate-400/60 bg-slate-500/10 text-slate-600 dark:text-slate-300 bg-[repeating-linear-gradient(135deg,rgba(100,116,139,0.14)_0_4px,transparent_4px_8px)]" },
  illegal: { glyph: "✕", label: "illegal_bins", className: "border-rose-500/70 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

function binCaption(bin: ResolvedBin, enumLabels?: string[]) {
  if (enumLabels) return bin.values.map((v) => formatValue(v, enumLabels)).join(", ");
  return describeValues(bin.values);
}

function codeLines(spec: CovergroupSpec): CodeTraceLine[] {
  const lines = [OP_TYPEDEF, "", ...covergroupToSource(spec)];
  return lines.map((text) => {
    const m = /^\s*(?:ignore_bins|illegal_bins|bins) (\w+) = binsof/.exec(text);
    return { text, key: m ? `xbin:${m[1]}` : undefined };
  });
}

/** Which ignore/illegal declaration selects a product (for highlighting its code line). */
function declForProduct(model: ElaboratedCovergroup, productKey: string): string | undefined {
  const cross = model.crosses[0];
  const bin = cross?.bins.find((b) => (b.kind === "ignore" || b.kind === "illegal") && b.products.includes(productKey));
  return bin ? `xbin:${bin.name}` : undefined;
}

interface GridProps {
  model: ElaboratedCovergroup;
  marks: Record<string, CellMark>;
  snapshot: CoverageSnapshot | null;
  justHit: string[];
  action: CellMark;
  onToggleCells: (keys: string[]) => void;
}

function CrossGrid({ model, marks, snapshot, justHit, action, onToggleCells }: GridProps) {
  const cross = model.crosses[0];
  const [rowsCp, colsCp] = cross.coverpoints;
  const rows = cross.axes[0];
  const cols = cross.axes[1];
  const product = (r: ResolvedBin, c: ResolvedBin) => cross.products.find((p) => p.key === `${r.key}|${c.key}`);
  const crossCounts = snapshot?.items.find((i) => i.type === "cross");
  const actionName = markStyles[action].label;
  const headerBtn =
    "flex min-h-10 w-full flex-col items-center justify-center rounded-md border border-dashed border-border/70 px-1 py-1 text-[11px] leading-tight text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[280px] gap-1.5"
        style={{ gridTemplateColumns: `minmax(3.5rem, auto) repeat(${cols.length}, minmax(0, 1fr))` }}
        aria-label={`${cross.name}: ${rowsCp.name} rows × ${colsCp.name} columns`}
        role="group"
      >
        <div className="flex items-end p-1 font-mono text-[10px] text-muted-foreground [font-variant-ligatures:none]">
          {rowsCp.name} ↓ · {colsCp.name} →
        </div>
        {cols.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggleCells(rows.map((r) => `${r.key}|${c.key}`))}
            aria-label={`Toggle ${actionName} for column ${c.name}`}
            className={headerBtn}
          >
            <span className="font-mono font-semibold text-foreground [font-variant-ligatures:none]">{c.name}</span>
            <span className="font-mono [font-variant-ligatures:none]">{binCaption(c, colsCp.enumLabels)}</span>
          </button>
        ))}
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <button type="button" onClick={() => onToggleCells(cols.map((c) => `${r.key}|${c.key}`))} aria-label={`Toggle ${actionName} for row ${r.name}`} className={headerBtn}>
              <span className="font-mono font-semibold text-foreground [font-variant-ligatures:none]">{r.name}</span>
              <span className="font-mono [font-variant-ligatures:none]">{binCaption(r)}</span>
            </button>
            {cols.map((c) => {
              const p = product(r, c);
              if (!p) return <div key={c.key} />;
              const mark = p.status === "illegal" ? "illegal" : p.status === "ignored" ? "ignore" : undefined;
              const hits = snapshot?.productHits[p.key] ?? 0;
              const autoBin = crossCounts?.bins.find((b) => b.name === p.label && b.kind === "auto");
              const covered = Boolean(autoBin?.covered);
              const isNew = justHit.includes(p.key);
              let glyph: string;
              let text: string;
              let state: string;
              if (mark) {
                glyph = markStyles[mark].glyph;
                text = mark === "illegal" ? (snapshot && hits > 0 ? `${hits} error${hits === 1 ? "" : "s"}` : "illegal") : snapshot && hits > 0 ? `ignored ×${hits}` : "ignored";
                state = mark === "illegal" ? `illegal_bins ${p.binName}${snapshot ? `, ${hits} run-time error${hits === 1 ? "" : "s"}` : ""}` : `ignore_bins ${p.binName}, not counted`;
              } else if (!snapshot) {
                glyph = "○";
                text = "bin";
                state = "counted bin";
              } else if (covered) {
                glyph = "✓";
                text = `${hits}`;
                state = `covered, ${hits} hit${hits === 1 ? "" : "s"}`;
              } else {
                glyph = "○";
                text = "hole";
                state = "hole, 0 hits";
              }
              return (
                <button
                  key={c.key}
                  type="button"
                  data-testid={`cross-cell-${r.name}-${c.name}`}
                  aria-label={`${p.label}: ${state}${isNew ? ", just hit" : ""}. Activate to toggle ${actionName}.`}
                  aria-pressed={mark === action}
                  onClick={() => onToggleCells([p.key])}
                  className={cn(
                    "flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    mark
                      ? markStyles[mark].className
                      : !snapshot
                        ? "border-border/70 bg-background/60 text-muted-foreground hover:bg-muted"
                        : covered
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                          : "border-dashed border-amber-500/70 bg-amber-500/5 text-amber-800 dark:text-amber-200",
                    isNew && "ring-2 ring-cyan-400",
                  )}
                >
                  <span aria-hidden className="text-sm font-semibold leading-none">
                    {isNew ? "▲ " : ""}
                    {glyph}
                  </span>
                  <span aria-hidden className="mt-0.5 font-mono text-[11px] leading-none tabular-nums">
                    {text}
                  </span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function CoverageCurve({ curve, cursor, errorSamples, closedAt }: { curve: number[]; cursor: number; errorSamples: number[]; closedAt: number | null }) {
  const W = 320;
  const H = 120;
  const n = Math.max(1, curve.length);
  const x = (i: number) => 28 + (i / n) * (W - 36);
  const y = (p: number) => 10 + (1 - p / 100) * (H - 34);
  const stride = Math.max(1, Math.ceil(curve.length / 300));
  const pts = [`${x(0)},${y(0)}`];
  for (let i = 0; i < curve.length; i += stride) pts.push(`${x(i + 1)},${y(curve[i])}`);
  if (curve.length > 0) pts.push(`${x(curve.length)},${y(curve[curve.length - 1])}`);
  const at = (count: number) => (count <= 0 ? 0 : curve[Math.min(count, curve.length) - 1] ?? 0);
  const label = `Coverage of cg_bus against samples. ${curve.length} samples run; ${closedAt ? `100% at sample ${closedAt}` : `ends at ${fmtPct(at(curve.length))}`}. Cursor at sample ${cursor} (${fmtPct(at(cursor))}).`;
  return (
    <figure className="rounded-xl border border-border/70 bg-background/40 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full max-w-[520px]">
        <line x1={28} x2={W - 8} y1={y(100)} y2={y(100)} className="stroke-emerald-500/50" strokeDasharray="4 3" />
        <text x={24} y={y(100) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
          100%
        </text>
        <text x={24} y={y(0) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
          0%
        </text>
        <line x1={28} x2={W - 8} y1={y(0)} y2={y(0)} className="stroke-border" />
        <polyline points={pts.join(" ")} fill="none" className="stroke-cyan-500" strokeWidth={2} />
        {errorSamples.map((s) => (
          <text key={s} x={x(s)} y={y(0) + 12} textAnchor="middle" className="fill-rose-600 text-[10px] font-bold dark:fill-rose-400">
            ✕
          </text>
        ))}
        <line x1={x(cursor)} x2={x(cursor)} y1={6} y2={y(0)} className="stroke-amber-500" strokeWidth={1.5} />
        <text x={28} y={H - 4} className="fill-muted-foreground text-[9px]">
          sample 0
        </text>
        <text x={W - 8} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[9px]">
          sample {curve.length}
        </text>
      </svg>
      <figcaption className="mt-1 text-[11px] text-muted-foreground">
        x-axis: number of sample() calls, not simulation time. ✕ marks illegal-bin errors; the amber line is the playback cursor.
      </figcaption>
    </figure>
  );
}

function CoverageMath({ snapshot, model }: { snapshot: CoverageSnapshot; model: ElaboratedCovergroup }) {
  const cross = model.crosses[0];
  const included = snapshot.items.filter((i) => !i.excluded);
  const totalWeight = included.reduce((s, i) => s + i.weight, 0);
  const defaults = model.coverpoints.flatMap((cp) => cp.bins.filter((b) => b.kind === "default").map((b) => `${cp.name}.${b.name}`));
  const ignored = cross.products.filter((p) => p.status === "ignored").length;
  const illegal = cross.products.filter((p) => p.status === "illegal").length;
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm" aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coverage math (§19.11)</p>
      <ul className="space-y-1 font-mono text-[12px] [font-variant-ligatures:none]">
        {snapshot.items.map((it) => (
          <li key={it.name}>
            {it.name}: {it.covered} / {it.total}
            {it.type === "cross" ? ` (Bc ${cross.autoCount} + Bu ${cross.userCount})` : ""} = {fmtPct(it.percent)}
            {it.weight !== 1 ? ` · weight ${it.weight}` : ""}
          </li>
        ))}
        <li className="font-semibold text-foreground">
          cg_bus = ({included.map((i) => `${i.weight}×${fmtPct(i.percent)}`).join(" + ")}) / {totalWeight} = {fmtPct(snapshot.percent)}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        {ignored + illegal > 0 ? `${ignored} ignored and ${illegal} illegal cross product${ignored + illegal === 1 ? "" : "s"} are left out of the denominator. ` : ""}
        {defaults.length > 0 ? `${defaults.join(", ")} is a default bin: it is neither counted nor crossed. ` : ""}
        A bin counts as covered at {cross.atLeast} hit{cross.atLeast === 1 ? "" : "s"} (option.at_least).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Closure challenge (debug mode)
// ---------------------------------------------------------------------------

type SpecVariant = "forbidden" | "legal";
type FixId = "more" | "ignore" | "illegal" | "constraint";

const specVariants: Record<SpecVariant, string> = {
  forbidden: "Spec: a BURST to the register region (addr 48..63) is forbidden. The DUT must never receive one.",
  legal: "Spec: BURST is legal at every address, including the register region (addr 48..63).",
};

const challengeSelect = {
  op: "and",
  left: { op: "binsof", coverpoint: "cp_addr", bin: "high" },
  right: { op: "binsof", coverpoint: "cp_op", bin: "burst" },
} as const;

const fixes: { id: FixId; label: string; apply: (spec: CovergroupSpec, stim: StimulusSpec) => { spec: CovergroupSpec; stim: StimulusSpec; budget: number } }[] = [
  { id: "more", label: "Run 10× more random samples", apply: (spec, stim) => ({ spec, stim, budget: 5000 }) },
  {
    id: "ignore",
    label: "ignore_bins ign_high_burst = binsof(cp_addr.high) && binsof(cp_op.burst);",
    apply: (spec, stim) => ({ spec: withCrossBin(spec, { keyword: "ignore_bins", name: "ign_high_burst", select: challengeSelect }), stim, budget: 500 }),
  },
  {
    id: "illegal",
    label: "illegal_bins ill_high_burst = binsof(cp_addr.high) && binsof(cp_op.burst);",
    apply: (spec, stim) => ({ spec: withCrossBin(spec, { keyword: "illegal_bins", name: "ill_high_burst", select: challengeSelect }), stim, budget: 500 }),
  },
  { id: "constraint", label: "Delete the constraint !(addr inside {[48:63]} && op == BURST);", apply: (spec, stim) => ({ spec, stim: { ...stim, exclude: [] }, budget: 500 }) },
];

function withCrossBin(spec: CovergroupSpec, bin: CrossBinDecl): CovergroupSpec {
  return { ...spec, crosses: (spec.crosses ?? []).map((x) => ({ ...x, bins: [...(x.bins ?? []), bin] })) };
}

const specReview: Record<SpecVariant, Record<FixId, { ok: boolean; text: string }>> = {
  forbidden: {
    more: { ok: false, text: "The hole has probability 0. No number of samples reaches it, and the spec says it must not be reached anyway." },
    ignore: { ok: false, text: "Coverage closes, but a forbidden BURST would now pass silently: ignore_bins only removes the cell from the denominator." },
    illegal: { ok: true, text: "Preferred. The cell leaves the denominator and any forbidden BURST to 48..63 is reported as a run-time error." },
    constraint: { ok: false, text: "Coverage closes only because the test now sends traffic the spec forbids, and nothing flags it." },
  },
  legal: {
    more: { ok: false, text: "The constraint makes the combination impossible, so more samples cannot reach it." },
    ignore: { ok: false, text: "Coverage closes by hiding a real hole: legal behavior is never tested." },
    illegal: { ok: false, text: "This labels legal traffic as an error. It closes today only because the buggy constraint never generates it." },
    constraint: { ok: true, text: "Preferred. The generator now produces the legal combination and the real hole closes." },
  },
};

function ClosureChallenge({ showEyebrow = true }: { showEyebrow?: boolean }) {
  const [variant, setVariant] = useState<SpecVariant>("forbidden");
  const [fixId, setFixId] = useState<FixId | null>(null);
  const baseSpec = useMemo(() => buildExplorerSpec({ addr: "ranges", op: "named", marks: {} }), []);
  const baseStim = stimulusPresets.hole.spec;
  const stuck = useMemo(() => {
    const model = elaborateCovergroup(baseSpec);
    const forecast = forecastClosure(model, baseStim);
    const result = simulateExplorerRun(model, baseStim, 500, 11, forecast);
    return { forecast, final: result.steps[result.steps.length - 1].snapshot };
  }, [baseSpec, baseStim]);
  const outcome = useMemo(() => {
    const fix = fixes.find((f) => f.id === fixId);
    if (!fix) return null;
    const { spec, stim, budget } = fix.apply(baseSpec, baseStim);
    const model = elaborateCovergroup(spec);
    const forecast = forecastClosure(model, stim);
    const result = simulateExplorerRun(model, stim, budget, 11, forecast);
    const final = result.steps[result.steps.length - 1].snapshot;
    return { fix, closedAt: result.closedAt, percent: final.percent, errors: final.errors.length, budget, review: specReview[variant][fix.id] };
  }, [fixId, baseSpec, baseStim, variant]);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
      {showEyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Debug it · closure challenge</p> : null}
      <p className="text-sm text-foreground">
        A regression is stuck at <strong>{fmtPct(stuck.final.percent)}</strong>. The constrained stimulus never sends BURST to addresses 48..63, so the cross cell{" "}
        <code className="font-mono [font-variant-ligatures:none]">{stuck.forecast.unreachable.map((t) => t.name).join(", ")}</code> has probability 0. Which fix is right depends on the spec.
      </p>
      <SegmentedControl
        label="Which spec applies?"
        value={variant}
        onChange={(v) => setVariant(v)}
        options={[
          { value: "forbidden", label: "Spec A: forbidden" },
          { value: "legal", label: "Spec B: legal" },
        ]}
      />
      <p className="text-sm text-muted-foreground">{specVariants[variant]}</p>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">Choose a fix. The model reruns the same seed and checks two things: does coverage close, and does the fix match the spec?</legend>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {fixes.map((f) => (
            <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
              <input type="radio" name="coverage-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
              <span className="min-w-0 break-words font-mono text-[12px] [font-variant-ligatures:none]">{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {outcome ? (
        <div aria-live="polite" className="space-y-1 rounded-lg border border-border/70 p-3 text-sm">
          <p className={outcome.closedAt ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {outcome.closedAt ? `✓ Coverage closes: 100% at sample ${outcome.closedAt}.` : `✕ Still stuck at ${fmtPct(outcome.percent)} after ${outcome.budget.toLocaleString("en-US")} samples.`}
          </p>
          <p className={outcome.review.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {outcome.review.ok ? "✓ Matches the spec." : "✕ Does not match the spec."} {outcome.review.text}
          </p>
        </div>
      ) : null}
      {!outcome?.review.ok ? (
        <HintLadder
          resetKey={variant}
          hints={[
            "First ask whether the empty cell can ever happen in the real design.",
            "If it can never happen, it should leave the denominator. If it must never happen, you also want to hear about it when it does.",
            "If it is legal, the coverage model is right and the stimulus is wrong.",
          ]}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flagship
// ---------------------------------------------------------------------------

interface CoverageCrossExplorerProps {
  /** "closure" shows only the closure challenge (used in I-SV-3B). */
  mode?: "explore" | "closure";
  initialStimulus?: StimulusPresetId;
}

const BUDGETS = [100, 500, 2000];

export const CoverageCrossExplorerVisualizer: React.FC<CoverageCrossExplorerProps> = ({ mode = "explore", initialStimulus = "uniform" }) => {
  const [addr, setAddr] = useState<AddrPresetId>("ranges");
  const [op, setOp] = useState<OpPresetId>("auto");
  const [marks, setMarks] = useState<Record<string, CellMark>>({});
  const [action, setAction] = useState<CellMark>("ignore");
  const [stimulusId, setStimulusId] = useState<StimulusPresetId>(initialStimulus);
  const [crossOnly, setCrossOnly] = useState(false);
  const [budget, setBudget] = useState(500);
  const [seed, setSeed] = useState(1);
  const [lastCell, setLastCell] = useState<string | null>(null);

  const spec = useMemo(() => buildExplorerSpec({ addr, op, marks, crossOnly }), [addr, op, marks, crossOnly]);
  const model = useMemo(() => elaborateCovergroup(spec), [spec]);
  const stimulus = stimulusPresets[stimulusId].spec;
  const forecast = useMemo(() => forecastClosure(model, stimulus), [model, stimulus]);
  const configKey = JSON.stringify({ addr, op, marks, stimulusId, crossOnly });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const revealed = revealedKey === configKey;
  const onReveal = useCallback(() => setRevealedKey(configKey), [configKey]);

  const run = useMemo(() => simulateExplorerRun(model, stimulus, budget, seed, forecast), [model, stimulus, budget, seed, forecast]);
  const playback = usePlayback(run.steps.length, `${configKey}:${budget}:${seed}`);
  const step = run.steps[Math.min(playback.index, run.steps.length - 1)];

  const lines = useMemo(() => codeLines(spec), [spec]);
  const stimLines = useMemo(() => stimulusToSource(stimulus).map((text) => ({ text })), [stimulus]);
  const activeKey = lastCell ? declForProduct(model, lastCell) : undefined;

  const resetConfig = (fn: () => void) => {
    fn();
    setMarks({});
    setLastCell(null);
  };

  const toggleCells = (keys: string[]) => {
    setLastCell(keys[0] ?? null);
    setMarks((prev) => {
      const next = { ...prev };
      const allSet = keys.every((k) => prev[k] === action);
      for (const k of keys) {
        if (allSet) delete next[k];
        else next[k] = action;
      }
      return next;
    });
  };

  if (mode === "closure") {
    return (
      <VisualFrame
        label="Coverage closure challenge"
        eyebrow="Debug it"
        title="A hole that random seeds cannot close"
        summary="Same covergroup, same seed, four possible fixes. Decide with the spec in hand."
        fidelity="model"
        assumptions={COVERAGE_ASSUMPTIONS}
      >
        <ClosureChallenge showEyebrow={false} />
      </VisualFrame>
    );
  }

  const holes = revealed
    ? forecast.targets.filter((t) => {
        const it = step.snapshot.items.find((i) => i.name === t.item);
        return !it?.bins.find((b) => b.key === t.key)?.covered;
      })
    : [];
  const errorsSoFar = step.snapshot.errors;

  return (
    <VisualFrame
      label="Cross coverage explorer"
      eyebrow="Experiment · coverage closure"
      title="Cross coverage: bins, exclusions and the long tail"
      summary="Pick the bins and the stimulus, exclude cells, predict how long closure takes, then replay a seeded run."
      fidelity="model"
      assumptions={COVERAGE_ASSUMPTIONS}
      className="space-y-5"
    >
      <div data-testid="coverage-cross-explorer" className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">cp_addr bins</p>
          <SegmentedControl
            label="cp_addr bins"
            value={addr}
            onChange={(v) => resetConfig(() => setAddr(v))}
            options={(Object.keys(addrPresets) as AddrPresetId[]).map((id) => ({ value: id, label: addrPresets[id].label }))}
          />
          <p className="text-xs text-muted-foreground">{addrPresets[addr].summary}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">cp_op bins</p>
          <SegmentedControl
            label="cp_op bins"
            value={op}
            onChange={(v) => resetConfig(() => setOp(v))}
            options={(Object.keys(opPresets) as OpPresetId[]).map((id) => ({ value: id, label: opPresets[id].label }))}
          />
          <p className="text-xs text-muted-foreground">{opPresets[op].summary}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Stimulus</p>
          <SegmentedControl
            label="Stimulus"
            value={stimulusId}
            onChange={(v) => setStimulusId(v)}
            options={(Object.keys(stimulusPresets) as StimulusPresetId[]).map((id) => ({ value: id, label: stimulusPresets[id].label }))}
          />
          <p className="text-xs text-muted-foreground">{stimulusPresets[stimulusId].summary}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={crossOnly} onChange={(e) => setCrossOnly(e.target.checked)} className="accent-cyan-500" />
          Count only the cross (<code className="font-mono [font-variant-ligatures:none]">option.weight = 0</code> on both coverpoints)
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {model.crosses[0].name}: {model.crosses[0].products.length} cross products
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Click a cell, row or column to toggle</span>
            <SegmentedControl
              label="Cell action"
              mono
              value={action}
              onChange={(v) => setAction(v)}
              options={[
                { value: "ignore", label: "⊘ ignore_bins" },
                { value: "illegal", label: "✕ illegal_bins" },
              ]}
            />
          </div>
        </div>
        <CrossGrid
          model={model}
          marks={marks}
          snapshot={revealed ? step.snapshot : null}
          justHit={revealed && step.record ? step.record.products : []}
          action={action}
          onToggleCells={toggleCells}
        />
        <p className="text-[11px] text-muted-foreground">
          ○ counted bin (hole until hit) · ✓ covered, with hit count · ▲ hit on this step · ⊘ ignore_bins: not counted · ✕ illegal_bins: run-time error when hit
        </p>
        {Object.keys(marks).length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setMarks({});
              setLastCell(null);
            }}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all exclusions
          </button>
        ) : null}
      </div>

      {forecast.gating.length === 0 ? (
        <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">Every cell is excluded, so there is nothing left to cover. Clear some exclusions.</p>
      ) : (
        <PredictionPrompt
          resetKey={configKey}
          question={`With this stimulus, about how many random samples does cg_bus need to reach 100%? (${forecast.gating.length} bins gate closure.)`}
          options={predictionOptions(forecast)}
        >
          <RevealSignal onReveal={onReveal} />
          <div className="space-y-1 text-sm">
            <p>
              <strong>Model forecast:</strong> {Number.isFinite(forecast.expectedSamples) ? `${fmtN(forecast.expectedSamples)} samples on average` : "never closes"}
              {Number.isFinite(forecast.expectedSamples) ? ` (coupon-collector baseline ${fmtN(forecast.couponBaseline)}).` : "."}
            </p>
            {Number.isFinite(forecast.expectedSamples) ? (
              <p className="text-muted-foreground">
                Chance that {budget.toLocaleString("en-US")} samples are enough: {fmtPct(forecast.probabilityWithin(budget) * 100)}. Rarest bin:{" "}
                {(() => {
                  const r = [...forecast.gating].sort((a, b) => a.p - b.p)[0];
                  return `${r.name} at ${fmtP(r.p)} per sample.`;
                })()}
              </p>
            ) : null}
          </div>
        </PredictionPrompt>
      )}

      {revealed ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              Sample budget
              <select value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="h-9 rounded-md border border-border/70 bg-background/60 px-2 text-sm text-foreground">
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <span>Seed {seed}</span>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="inline-flex h-9 items-center rounded-lg border border-border/70 px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              New seed
            </button>
          </div>
          <PlaybackControls playback={playback} stepCount={run.steps.length} stepNoun="Coverage event" describeStep={(i) => run.steps[i]?.what ?? ""} />
          <div aria-live="polite" className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
            <p className={cn("font-medium", step.kind === "error" ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>{step.what}</p>
            <p className="mt-1 text-muted-foreground">
              <strong className="text-foreground">Why: </strong>
              {step.why}
            </p>
          </div>
          <CoverageCurve curve={run.curve} cursor={step.samples} errorSamples={run.errorSamples} closedAt={run.closedAt} />
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            <CoverageMath snapshot={step.snapshot} model={model} />
            <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Holes at this step</p>
              {holes.length === 0 ? (
                <p className="text-emerald-700 dark:text-emerald-300">✓ None: every counted bin is covered.</p>
              ) : (
                <ul className="space-y-1">
                  {holes.slice(0, 6).map((h) => (
                    <li key={h.key} className="text-muted-foreground">
                      <span className="font-mono text-foreground [font-variant-ligatures:none]">{h.item === "addr_x_op" ? h.name : `${h.item}.${h.name}`}</span>:{" "}
                      {h.p <= 0 ? "probability 0, never generated" : `${fmtP(h.p)} per sample (≈ ${fmtN(1 / h.p)} samples alone)`}
                    </li>
                  ))}
                  {holes.length > 6 ? <li className="text-muted-foreground">+{holes.length - 6} more</li> : null}
                </ul>
              )}
              {errorsSoFar.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">✕ Run-time errors: {errorsSoFar.length}</p>
                  <ul className="mt-1 space-y-1 font-mono text-[11px] text-rose-700 [font-variant-ligatures:none] dark:text-rose-300">
                    {errorsSoFar.slice(0, 3).map((e) => (
                      <li key={`${e.sample}-${e.bin}`}>
                        ✕ Error (sample {e.sample + 1}): {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div data-testid="covergroup-code" className="min-w-0">
          <CodeTrace label="Generated covergroup (from the model)" lines={lines} activeKey={activeKey} />
        </div>
        <div className="min-w-0">
          <CodeTrace label="Stimulus" lines={stimLines} />
        </div>
      </div>

      <ClosureChallenge />
    </VisualFrame>
  );
};

