"use client";

import React, { useId, useMemo, useState } from "react";

import {
  CodeTrace,
  CycleWaveform,
  PlaybackControls,
  PredictionPrompt,
  SegmentedControl,
  ValueChip,
  VisualFrame,
  usePlayback,
  type CycleMarker,
  type PredictionOption,
} from "@/components/visual-system";
import {
  CHECKS,
  CHECK_IDS,
  CTX_VALUE,
  EVENT_LABELS,
  PMU_EVENTS,
  POWER_SCENARIOS,
  hex,
  runPowerSequence,
  upfLines,
  type PmuEvent,
  type PowerOutcome,
  type PowerRun,
  type PowerScenarioId,
  type PowerSnapshot,
  type PowerValue,
} from "@/lib/power-sequence-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "One switchable domain (PD_CPU) beside an always-on domain (PD_TOP). One retained register, ctx = 8'hA5, drives cpu_out across the boundary; scratch is not retained.",
  "UPF corruption semantics: while VDD_CPU is off every PD_CPU register reads X. Retention elements and isolation cells sit on the always-on supply.",
  "Each step is one PMU action. Clock gating, reset, supply settling time and the PMU's req/ack handshakes are not modelled; real flows usually stop the clock before save and reset non-retained logic after power-up.",
  "The UPF is illustrative (IEEE 1801 command forms, supplies abbreviated); check option spelling against your tool's UPF version.",
];

type Mode = PowerScenarioId | "custom";

const OUTCOME_LABELS: Record<PowerOutcome, string> = {
  clean: `PD_TOP only ever sees ${hex(CTX_VALUE)} or the clamp value 0, and ctx comes back as ${hex(CTX_VALUE)}.`,
  x_leak: `X reaches PD_TOP at some step, but ctx still comes back as ${hex(CTX_VALUE)}.`,
  context_lost: `No X reaches PD_TOP, but ctx does not come back as ${hex(CTX_VALUE)}.`,
  both: "X reaches PD_TOP, and ctx is lost.",
};

const claimsLeak = (o: PowerOutcome) => o === "x_leak" || o === "both";
const claimsLost = (o: PowerOutcome) => o === "context_lost" || o === "both";

function stepName(s: PowerSnapshot) {
  return s.event ? `step ${s.step} (${EVENT_LABELS[s.event]})` : "the initial state";
}

/** Diagnostic sentences built from the model run: each one names the step that decides the claim. */
function facts(run: PowerRun) {
  const snaps = run.snapshots;
  const leak = run.xLeakSteps.length ? snaps[run.xLeakSteps[0]] : null;
  const xSteps = snaps.filter((s) => s.cpuOut === "X").map((s) => s.step);
  const leakFact = leak
    ? `At ${stepName(leak)} PD_TOP receives X: ${leak.why}`
    : xSteps.length
      ? `cpu_out is X at step ${xSteps.join(", ")}, and cpu_iso_en is 1 at every one of those steps, so PD_TOP only sees the clamp.`
      : "cpu_out never goes X, so there is nothing to leak.";
  const restore = snaps.find((s) => s.event === "RESTORE");
  const save = snaps.find((s) => s.event === "SAVE");
  const ctxFact = run.contextRestored
    ? `The save at step ${save?.step} copied ${hex(CTX_VALUE)} while powered, and the restore at step ${restore?.step} copied it back.`
    : restore
      ? `At ${stepName(restore)}: ${restore.why}`
      : "There is no restore step, so ctx stays X after power-off.";
  return { leakFact, ctxFact };
}

function predictionOptions(run: PowerRun): PredictionOption[] {
  const { leakFact, ctxFact } = facts(run);
  return (Object.keys(OUTCOME_LABELS) as PowerOutcome[]).map((o) => {
    const correct = o === run.outcome;
    const parts: string[] = [];
    if (correct || claimsLeak(o) !== claimsLeak(run.outcome)) parts.push(leakFact);
    if (correct || claimsLost(o) !== claimsLost(run.outcome)) parts.push(ctxFact);
    return { id: o, label: OUTCOME_LABELS[o], correct, feedback: parts.join(" ") };
  });
}

/** Schematic of the two domains at one step. Text carries every state; colour only reinforces it. */
function PowerDiagram({ snap }: { snap: PowerSnapshot }) {
  const id = useId();
  const off = !snap.supplyOn;
  const xFill = `url(#${id}-x)`;
  const wire = (v: PowerValue) => (v === "X" ? "stroke-rose-500" : "stroke-cyan-600 dark:stroke-cyan-400");
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 360 210"
        className="block h-auto w-full min-w-[300px]"
        role="img"
        aria-label={`Step ${snap.step}: VDD_CPU ${off ? "off" : "on"}, isolation ${snap.isoEn ? "clamping to 0" : "passing"}, ctx ${hex(snap.ctx)}, retention ${hex(snap.retained)}, PD_TOP sees ${hex(snap.topSees)}`}
      >
        <defs>
          <pattern id={`${id}-x`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(244,63,94,0.12)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.7)" strokeWidth="2" />
          </pattern>
        </defs>
        {/* PD_TOP */}
        <rect x={6} y={30} width={130} height={150} rx={10} className="fill-emerald-500/5 stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={1.5} />
        <text x={16} y={50} className="fill-foreground text-[12px] font-semibold">PD_TOP</text>
        <text x={16} y={65} className="fill-muted-foreground text-[10px]">always on (VDD)</text>
        <text x={16} y={100} className="fill-muted-foreground text-[10px]">top_cpu_out</text>
        <rect x={16} y={108} width={90} height={26} rx={4} fill={snap.topSees === "X" ? xFill : undefined} className={snap.topSees === "X" ? "stroke-rose-500" : "fill-background stroke-border"} />
        <text x={61} y={125} textAnchor="middle" className="fill-foreground font-mono text-[12px] font-semibold">
          {hex(snap.topSees)}
        </text>
        {snap.topSees === "X" ? (
          <text x={16} y={152} className="fill-rose-600 text-[10px] font-semibold dark:fill-rose-300">✕ X reached PD_TOP</text>
        ) : null}

        {/* Isolation cell */}
        <line x1={196} y1={121} x2={180} y2={121} className={wire(snap.cpuOut)} strokeWidth={2.5} />
        <line x1={140} y1={121} x2={106} y2={121} className={wire(snap.topSees)} strokeWidth={2.5} />
        <rect x={140} y={100} width={40} height={42} rx={3} className={snap.isoEn ? "fill-amber-500/20 stroke-amber-500" : "fill-background stroke-border"} strokeWidth={1.5} />
        <text x={160} y={117} textAnchor="middle" className="fill-foreground text-[9px] font-bold">ISO</text>
        <text x={160} y={131} textAnchor="middle" className="fill-foreground text-[8.5px]">{snap.isoEn ? "clamp 0" : "pass"}</text>
        <text x={160} y={156} textAnchor="middle" className="fill-muted-foreground text-[9px]">iso_en={snap.isoEn}</text>

        {/* PD_CPU */}
        <rect
          x={196}
          y={30}
          width={158}
          height={150}
          rx={10}
          className={off ? "fill-slate-500/10 stroke-slate-400" : "fill-sky-500/5 stroke-sky-600 dark:stroke-sky-400"}
          strokeWidth={1.5}
          strokeDasharray={off ? "6 4" : undefined}
        />
        <text x={206} y={50} className="fill-foreground text-[12px] font-semibold">PD_CPU</text>
        <text x={206} y={65} className="fill-muted-foreground text-[10px]">VDD_CPU {off ? "OFF (corrupt)" : "ON"}</text>
        <text x={206} y={92} className="fill-muted-foreground text-[10px]">ctx (retained)</text>
        <rect x={206} y={98} width={68} height={24} rx={3} fill={snap.ctx === "X" ? xFill : undefined} className={snap.ctx === "X" ? "stroke-rose-500" : "fill-background stroke-violet-500/60"} />
        <text x={240} y={114} textAnchor="middle" className="fill-foreground font-mono text-[11px] font-semibold">{hex(snap.ctx)}</text>
        <text x={206} y={140} className="fill-muted-foreground text-[10px]">scratch</text>
        <rect x={206} y={146} width={68} height={24} rx={3} fill={snap.scratch === "X" ? xFill : undefined} className={snap.scratch === "X" ? "stroke-rose-500" : "fill-background stroke-violet-500/60"} />
        <text x={240} y={162} textAnchor="middle" className="fill-foreground font-mono text-[11px] font-semibold">{hex(snap.scratch)}</text>
        {/* Retention element: always-on supply, drawn solid even when the domain is off */}
        <rect x={284} y={98} width={62} height={46} rx={3} className="fill-background stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={1.5} />
        <text x={315} y={112} textAnchor="middle" className="fill-foreground text-[9px] font-bold">RET (VDD)</text>
        <text x={315} y={130} textAnchor="middle" className="fill-foreground font-mono text-[11px]">{hex(snap.retained)}</text>
        {snap.save ? <text x={315} y={160} textAnchor="middle" className="fill-amber-600 text-[9px] font-bold dark:fill-amber-300">◆ save</text> : null}
        {snap.restore ? <text x={315} y={160} textAnchor="middle" className="fill-amber-600 text-[9px] font-bold dark:fill-amber-300">◆ restore</text> : null}

        {/* Power switch */}
        <text x={275} y={18} textAnchor="middle" className="fill-foreground text-[10px]">
          sw_cpu: {snap.pwrEn ? "closed (pwr_en=1)" : "open (pwr_en=0)"}
        </text>
        <line x1={275} y1={22} x2={275} y2={30} className={off ? "stroke-slate-400" : "stroke-sky-600"} strokeWidth={2} strokeDasharray={off ? "2 3" : undefined} />
      </svg>
    </div>
  );
}

function waveSignals(run: PowerRun) {
  const s = run.snapshots;
  return [
    { name: "pwr_en", kind: "bit" as const, values: s.map((x) => x.pwrEn) },
    { name: "iso_en", kind: "bit" as const, values: s.map((x) => x.isoEn) },
    { name: "save", kind: "bit" as const, values: s.map((x) => x.save) },
    { name: "restore", kind: "bit" as const, values: s.map((x) => x.restore) },
    { name: "ctx", kind: "bus" as const, values: s.map((x) => (x.ctx === "X" ? "X" : hex(x.ctx).replace("8'h", ""))) },
    { name: "top_out", kind: "bus" as const, values: s.map((x) => (x.topSees === "X" ? "X" : hex(x.topSees).replace("8'h", ""))) },
  ];
}

function waveMarkers(run: PowerRun): CycleMarker[] {
  return run.snapshots
    .filter((s) => s.failures.length > 0)
    .map((s) => ({ edge: s.step, tone: "fail" as const, label: `step ${s.step}: ${s.failures.join(", ")} fails` }));
}

function SequenceView({ run, playbackKey }: { run: PowerRun; playbackKey: string }) {
  const playback = usePlayback(run.snapshots.length, playbackKey);
  const index = Math.min(playback.index, run.snapshots.length - 1);
  const snap = run.snapshots[index];
  const prev = run.snapshots[Math.max(0, index - 1)];
  const upf = upfLines().map((l) => ({ ...l, owner: "design" as const }));
  const failingSoFar = (id: (typeof CHECK_IDS)[number]) => {
    const step = run.firstFailure[id];
    return step !== undefined && step <= index ? step : undefined;
  };

  return (
    <div className="space-y-4">
      <p className={cn("rounded-lg border p-3 text-sm font-medium", run.outcome === "clean" ? "border-emerald-500/50 text-emerald-800 dark:text-emerald-200" : "border-rose-500/50 text-rose-800 dark:text-rose-200")} aria-live="polite">
        <span aria-hidden className="mr-1">{run.outcome === "clean" ? "✓" : "✕"}</span>
        {run.summary}
      </p>
      <PlaybackControls playback={playback} stepCount={run.snapshots.length} stepNoun="PMU step" describeStep={(i) => run.snapshots[i]?.what ?? ""} />
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-3">
          <PowerDiagram snap={snap} />
          <div aria-live="polite" className="rounded-lg border border-border/70 bg-background/50 p-3 text-[15px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Step {snap.step} of {run.snapshots.length - 1}
              {snap.event ? ` · ${EVENT_LABELS[snap.event]}` : " · initial state"}
            </p>
            <p className="mt-1 text-foreground"><strong>What: </strong>{snap.what}</p>
            <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Why: </strong>{snap.why}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ValueChip name="pwr_en" value={snap.pwrEn} changed={index > 0 && snap.pwrEn !== prev.pwrEn} />
            <ValueChip name="iso_en" value={snap.isoEn} changed={index > 0 && snap.isoEn !== prev.isoEn} />
            <ValueChip name="ctx" value={snap.ctx === "X" ? "X" : hex(snap.ctx)} changed={index > 0 && snap.ctx !== prev.ctx} />
            <ValueChip name="top_out" value={snap.topSees === "X" ? "X" : hex(snap.topSees)} changed={index > 0 && snap.topSees !== prev.topSees} />
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <CodeTrace label="power_intent.upf (illustrative)" lines={upf} activeKey={snap.upfKeys[snap.upfKeys.length - 1]} contextKeys={snap.upfKeys} />
          <section aria-label="Power-aware assertions" className="rounded-lg border border-border/70 p-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Power-aware assertions (up to this step)</p>
            <ul className="space-y-1">
              {CHECK_IDS.map((id) => {
                const fail = failingSoFar(id);
                return (
                  <li key={id} className={fail !== undefined ? "text-rose-700 dark:text-rose-300" : "text-foreground"}>
                    <span aria-hidden className="mr-1 font-bold">{fail !== undefined ? "✕" : "✓"}</span>
                    <code className="font-mono text-[12px] [font-variant-ligatures:none]">{CHECKS[id].sva}</code>
                    <span className="text-muted-foreground"> — {fail !== undefined ? `fails at step ${fail}` : "holds so far"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
      <CycleWaveform
        title="PMU control signals and boundary values"
        caption="x-axis: PMU steps (model time, one action per step), not clock cycles. Hatched = X. ✕ marks a step where an assertion fails."
        signals={waveSignals(run)}
        edges={run.snapshots.length}
        markers={waveMarkers(run)}
        cursor={index}
        onSelectEdge={(k) => playback.seek(k)}
      />
    </div>
  );
}

export const PowerDomainVisualizer: React.FC = () => {
  const [mode, setMode] = useState<Mode>("correct");
  const [custom, setCustom] = useState<PmuEvent[]>([]);
  const events = mode === "custom" ? custom : POWER_SCENARIOS[mode].events;
  const run = useMemo(() => runPowerSequence(events), [events]);
  const options = useMemo(() => predictionOptions(run), [run]);
  const key = `${mode}|${events.join(",")}`;

  return (
    <VisualFrame
      label="Power domain sequence model"
      eyebrow="Model"
      title="Power PD_CPU down and back up without corrupting PD_TOP"
      summary="Pick a PMU sequence, predict what the always-on domain sees, then step through it with the UPF command that governs each step."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <SegmentedControl
        label="PMU sequence"
        value={mode}
        onChange={setMode}
        options={[
          ...(Object.keys(POWER_SCENARIOS) as PowerScenarioId[]).map((id) => ({ value: id as Mode, label: POWER_SCENARIOS[id].title })),
          { value: "custom" as Mode, label: "Build your own" },
        ]}
      />
      <ol aria-label="Sequence under test" className="flex flex-wrap gap-2 text-xs">
        {events.length === 0 ? <li className="text-muted-foreground">No actions yet: add PMU actions below.</li> : null}
        {events.map((e, i) => (
          <li key={`${e}-${i}`} className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-mono [font-variant-ligatures:none]">
            {i + 1}. {EVENT_LABELS[e]}
          </li>
        ))}
      </ol>

      {mode === "custom" ? (
        <div className="space-y-4">
          <div role="group" aria-label="Add a PMU action" className="flex flex-wrap gap-2">
            {PMU_EVENTS.map((e) => (
              <button
                key={e}
                type="button"
                disabled={custom.includes(e)}
                onClick={() => setCustom((c) => [...c, e])}
                className="min-h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                + {EVENT_LABELS[e]}
              </button>
            ))}
            <button type="button" disabled={custom.length === 0} onClick={() => setCustom((c) => c.slice(0, -1))} className="min-h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              Undo last
            </button>
            <button type="button" disabled={custom.length === 0} onClick={() => setCustom([])} className="min-h-10 rounded-lg border border-border/70 px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              Clear
            </button>
          </div>
          <SequenceView run={run} playbackKey={key} />
        </div>
      ) : (
        <PredictionPrompt resetKey={key} question="Before stepping through: what does the always-on domain experience with this sequence?" options={options}>
          <SequenceView run={run} playbackKey={key} />
        </PredictionPrompt>
      )}
    </VisualFrame>
  );
};

export default PowerDomainVisualizer;
