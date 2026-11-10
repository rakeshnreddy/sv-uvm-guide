"use client";

import React, { useId, useMemo, useRef, useState } from "react";

import {
  CodeTrace,
  CycleWaveform,
  PlaybackControls,
  SegmentedControl,
  ValueChip,
  VisualFrame,
  comparisonStyles,
  usePlayback,
  type CycleMarker,
} from "@/components/visual-system";
import {
  DETECTOR_ASSUMPTIONS,
  DETECTOR_PRESETS,
  LATCH_NOTE,
  LIGHT_STATES,
  MAX_DIN_BITS,
  SEED_KEYS,
  SEEDS_OFF_STEPPING_NOTE,
  TRAFFIC_ASSUMPTIONS,
  TRAFFIC_BENCH,
  TRAFFIC_PRESETS,
  cellText,
  describeDetectorEdge,
  describeTrafficEdge,
  detectorArcs,
  detectorCode,
  detectorMachine,
  explainLightAt,
  explainPrints,
  findDetectorPreset,
  findTrafficPreset,
  gradeDetectorGuess,
  gradeLightGuess,
  gradePrintGuess,
  latchSummary,
  logUpTo,
  matchLabel,
  mooreOutputStates,
  noMatchLabel,
  parseDinStream,
  runDetector,
  runSummary,
  runTraffic,
  stateDuration,
  trafficActiveKeys,
  trafficCode,
  trafficMachine,
  trafficVerdict,
  type Bit,
  type DetectState,
  type DetectorArc,
  type DetectorStyle,
  type GuessGrade,
  type LightState,
  type TrafficMachine,
} from "@/lib/fsm-stepper-model";
import { cn } from "@/lib/utils";

export type FsmMachineId = "seq-detect-101" | "traffic-light";

export interface FsmEdgeStepperProps {
  /** Which lesson machine to step. */
  machine?: FsmMachineId;
  /**
   * seq-detect-101: "bench" (default), "overlap", "1001", "111".
   * traffic-light: "lesson" (default), "break-yellow".
   */
  preset?: string;
  className?: string;
}

export { DETECTOR_ASSUMPTIONS, TRAFFIC_ASSUMPTIONS };

const btn =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const primaryBtn =
  "inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const linkBtn = "-ml-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PredictChip() {
  return (
    <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
      Predict
    </span>
  );
}

function Verdict({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className={cn("font-medium", ok === null ? "text-foreground" : ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
      {ok === null ? null : <span aria-hidden>{ok ? "✓ " : "✕ "}</span>}
      {children}
    </p>
  );
}

/** Native radio group: Tab enters it and arrow keys move, even before anything is chosen. */
function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1 text-xs text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 font-mono text-sm [font-variant-ligatures:none] focus-within:ring-2 focus-within:ring-ring",
              value === o.value ? "border-amber-500/70 bg-amber-500/10" : "border-border/70 bg-background/50",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-amber-500" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function FsmEdgeStepper({ machine = "seq-detect-101", preset, className }: FsmEdgeStepperProps) {
  return machine === "traffic-light" ? <TrafficStepper preset={preset} className={className} /> : <DetectorStepper preset={preset} className={className} />;
}

/* ======================================================================== */
/* 101 detector                                                             */
/* ======================================================================== */

interface BubbleLayout {
  x: number;
  y: number;
}

const R = 30;
const TOP = 96;

/**
 * The 4-state Moore diagram is wider, so it is drawn tighter and with larger text: at 390 px
 * its viewBox scales by about 0.8, and these sizes keep labels near the 3-state diagram's.
 */
function diagramLayout(stateCount: number) {
  return stateCount > 3 ? { spacing: 100, name: 11.5, small: 10, arc: 12 } : { spacing: 116, name: 10, small: 8.5, arc: 11 };
}

function arcPath(arc: DetectorArc, pos: Record<string, BubbleLayout>, index: Record<string, number>) {
  const a = pos[arc.from];
  const b = pos[arc.to];
  if (arc.from === arc.to) {
    return { d: `M ${a.x - 12} ${a.y - R + 3} C ${a.x - 30} ${a.y - R - 44}, ${a.x + 30} ${a.y - R - 44}, ${a.x + 12} ${a.y - R + 3}`, lx: a.x, ly: a.y - R - 38 };
  }
  const dist = index[arc.to] - index[arc.from];
  if (dist === 1) return { d: `M ${a.x + R} ${a.y} L ${b.x - R - 2} ${b.y}`, lx: (a.x + b.x) / 2, ly: a.y - 8 };
  const depth = 30 + 28 * (Math.abs(dist) - 1) + index[arc.from] * 10;
  const sign = dist < 0 ? 1 : -1;
  const y0 = a.y + sign * (R - 2);
  const d = `M ${a.x - 6} ${y0} C ${a.x - 10} ${y0 + sign * depth}, ${b.x + 10} ${y0 + sign * depth}, ${b.x + 6} ${b.y + sign * (R + 1)}`;
  return { d, lx: (a.x + b.x) / 2, ly: y0 + sign * (depth * 0.75 + 12) };
}

function DetectorDiagram({
  style,
  current,
  taken,
}: {
  style: DetectorStyle;
  current: DetectState | null;
  taken: DetectorArc | null;
}) {
  const id = useId().replace(/:/g, "");
  const m = detectorMachine(style);
  const arcs = detectorArcs(m);
  const moore = mooreOutputStates(m);
  const index: Record<string, number> = {};
  const pos: Record<string, BubbleLayout> = {};
  const layout = diagramLayout(m.states.length);
  m.states.forEach((s, i) => {
    index[s] = i;
    pos[s] = { x: 56 + i * layout.spacing, y: TOP };
  });
  const width = 56 * 2 + (m.states.length - 1) * layout.spacing;
  const height = 232;
  const isTaken = (a: DetectorArc) => Boolean(taken && taken.from === a.from && taken.din === a.din);
  const label = [
    `State diagram of the ${style === "mealy" ? "Mealy" : "Moore"} 101 detector with ${m.states.length} states.`,
    current ? `Current state ${current}.` : "",
    taken ? `Taken arc: ${taken.from} to ${taken.to} on din ${taken.din}.` : "",
    "The table below lists every arc.",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block h-auto w-full max-w-[520px] text-foreground">
      <defs>
        <marker id={`${id}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
        </marker>
        <marker id={`${id}-t`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-cyan-500" />
        </marker>
      </defs>
      <line x1={4} y1={TOP} x2={pos[m.states[0]].x - R - 2} y2={TOP} className="stroke-muted-foreground" strokeWidth={1.5} markerEnd={`url(#${id}-a)`} />
      <text x={2} y={TOP - 8} fontSize={layout.small} className="fill-muted-foreground">
        reset
      </text>
      {arcs.map((arc) => {
        const p = arcPath(arc, pos, index);
        const t = isTaken(arc);
        return (
          <g key={`${arc.from}-${arc.din}`}>
            <path
              d={p.d}
              fill="none"
              strokeWidth={t ? 3 : 1.5}
              className={cn("transition-colors duration-200 motion-reduce:transition-none", t ? "stroke-cyan-500" : "stroke-muted-foreground/70")}
              markerEnd={`url(#${id}-${t ? "t" : "a"})`}
            />
            <text x={p.lx} y={p.ly} fontSize={layout.arc} textAnchor="middle" className={t ? "fill-cyan-700 font-bold dark:fill-cyan-300" : "fill-foreground"}>
              {t ? "▶ " : ""}
              {arc.din}
              {arc.detected ? " / det=1" : ""}
            </text>
          </g>
        );
      })}
      {m.states.map((s) => {
        const now = s === current;
        return (
          <g key={s}>
            <circle
              cx={pos[s].x}
              cy={pos[s].y}
              r={R}
              strokeWidth={now ? 3 : 1.5}
              className={cn("transition-colors duration-200 motion-reduce:transition-none", now ? "fill-cyan-500/15 stroke-cyan-500" : "fill-background stroke-foreground/70")}
            />
            <text x={pos[s].x} y={pos[s].y + 4} fontSize={layout.name} textAnchor="middle" className="fill-foreground font-mono">
              {s}
            </text>
            {moore.includes(s) ? (
              <text x={pos[s].x} y={pos[s].y + 17} fontSize={layout.small} textAnchor="middle" className="fill-muted-foreground">
                det=1
              </text>
            ) : null}
            {now ? (
              <text x={pos[s].x} y={pos[s].y - 10} fontSize={layout.small} textAnchor="middle" className="fill-cyan-700 font-semibold dark:fill-cyan-300">
                now
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function DetectorTable({
  style,
  seeds,
  currentCell,
}: {
  style: DetectorStyle;
  seeds: boolean;
  currentCell: { state: DetectState; din: Bit } | null;
}) {
  const m = detectorMachine(style);
  const moore = mooreOutputStates(m);
  const rows: (DetectState | "x")[] = [...m.states, "x"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left text-xs">
        <caption className="mb-1 text-left text-xs font-semibold text-foreground">
          Every arc as a table: next state{style === "mealy" ? " and detected" : ""} for each state and din
        </caption>
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">
              state
            </th>
            <th scope="col" className="py-1 pr-2 font-medium">
              din = 0
            </th>
            <th scope="col" className="py-1 font-medium">
              din = 1
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-b border-border/40 align-top">
              <th scope="row" className="py-1.5 pr-2 font-mono font-normal">
                {row === "x" ? noMatchLabel(m) : row}
                {row !== "x" && moore.includes(row) ? <span className="block font-sans text-[10px] text-muted-foreground">detected = 1</span> : null}
              </th>
              {([0, 1] as Bit[]).map((din) => {
                const text = cellText(m, row, din, seeds);
                const now = currentCell !== null && currentCell.state === row && currentCell.din === din;
                return (
                  <td key={din} aria-current={now ? "true" : undefined} className={cn("py-1.5 pr-2 font-mono", now && "bg-cyan-500/15 font-semibold")}>
                    {now ? <span aria-hidden>▶ </span> : null}
                    {text.main}
                    {text.warning ? (
                      <span className="mt-0.5 block font-sans text-[11px] text-rose-700 dark:text-rose-300">
                        <span aria-hidden>⚠ </span>
                        {text.warning}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!seeds ? <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">⚠ An unassigned output {LATCH_NOTE}.</p> : null}
    </div>
  );
}

function DetectorStepper({ preset, className }: { preset?: string; className?: string }) {
  const initial = findDetectorPreset(preset);
  const [presetId, setPresetId] = useState<string>(initial.id);
  const [din, setDin] = useState<Bit[]>(initial.din);
  const [draft, setDraft] = useState(initial.din.join(""));
  const [inputError, setInputError] = useState<string | undefined>();
  const [style, setStyle] = useState<DetectorStyle>("mealy");
  const [seedsOff, setSeedsOff] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [grade, setGrade] = useState<GuessGrade | null>(null);
  const [guessNext, setGuessNext] = useState<DetectState | null>(null);
  const [guessDet, setGuessDet] = useState<Bit | null>(null);
  const [review, setReview] = useState<number | null>(null);

  const errorId = `${useId()}-din-error`;
  const streamInput = useRef<HTMLInputElement>(null);

  const run = useMemo(() => runDetector(style, din), [style, din]);
  const n = din.length;
  const predicting = !seedsOff && grade === null && revealed < n;
  const focusEdge = review ?? (grade ? revealed - 1 : null);
  const focus = focusEdge !== null ? run.edges[focusEdge] : null;
  const pending = predicting ? run.edges[revealed] : null;
  const currentState = focus ? focus.state : pending ? pending.state : null;
  const taken = focus ? { from: focus.state, to: focus.nextState, din: focus.din, detected: focus.detected } : null;

  const restart = () => {
    setRevealed(0);
    setGrade(null);
    setGuessNext(null);
    setGuessDet(null);
    setReview(null);
  };
  const applyStream = (bits: Bit[], id: string) => {
    setDin(bits);
    setDraft(bits.join(""));
    setPresetId(id);
    setInputError(undefined);
    restart();
  };
  const reveal = (withGuess: boolean) => {
    const guess = withGuess && guessNext && guessDet !== null ? { next: guessNext, detected: guessDet } : null;
    setGrade(gradeDetectorGuess(run, revealed, guess));
    setRevealed((r) => r + 1);
    setReview(null);
  };
  const nextEdge = () => {
    setGrade(null);
    setGuessNext(null);
    setGuessDet(null);
    setReview(null);
  };

  const codeLines = detectorCode(run.machine, !seedsOff).map((l) => ({ ...l, owner: "design" as const }));
  const activeKey = focus && !seedsOff ? focus.comb.decidingKey ?? focus.comb.executedKeys[0] : undefined;
  const contextKeys = focus && !seedsOff ? [...focus.comb.executedKeys, SEED_KEYS.state_next, SEED_KEYS.detected] : seedsOff ? [SEED_KEYS.state_next, SEED_KEYS.detected] : [];

  const markers: CycleMarker[] = run.edges
    .slice(0, revealed)
    .filter((e) => e.match)
    .map((e) => ({ edge: e.edge, tone: "pass", label: matchLabel(e) ?? "" }));

  const live = seedsOff
    ? latchSummary(run.machine, false)
    : review !== null && focus
      ? `Reviewing: ${describeDetectorEdge(focus)}`
      : grade && focusEdge !== null
        ? `${grade.headline} ${describeDetectorEdge(run.edges[focusEdge])}`
        : pending
          ? `Edge ${pending.edge}: state ${pending.state}, din ${pending.din}. Predict the next state and detected.`
          : runSummary(run);

  return (
    <VisualFrame
      label="FSM edge stepper: the 101 detector"
      eyebrow="Step it edge by edge"
      title="A two-process 101 detector, one rising edge at a time"
      summary="At each edge, predict the next state and detected from the code, then reveal: the taken arc, the case item that ran and one new waveform column."
      fidelity="model"
      assumptions={DETECTOR_ASSUMPTIONS}
      className={className}
    >
      <p role="status" aria-live="polite" className="sr-only" data-testid="fsm-live">
        {live}
      </p>

      <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
        <SegmentedControl
          label="din stream preset"
          value={presetId}
          onChange={(id) => {
            const p = DETECTOR_PRESETS.find((x) => x.id === id);
            if (p) applyStream(p.din, p.id);
            else {
              // Custom keeps the current stream and moves to the stream input to edit it.
              setPresetId("custom");
              streamInput.current?.focus();
            }
          }}
          options={[
            ...DETECTOR_PRESETS.map((p) => ({ value: p.id, label: p.label })),
            { value: "custom", label: "Custom" },
          ]}
        />
        <p className="text-xs text-muted-foreground">{DETECTOR_PRESETS.find((p) => p.id === presetId)?.blurb ?? "Your own stream: toggle the bits below or type one."}</p>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="din bits, one per edge">
          {din.map((b, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={b === 1}
              aria-label={`din bit ${i + 1} (edge ${i}): ${b}. Toggle.`}
              onClick={() => applyStream(din.map((x, j) => (j === i ? ((1 - x) as Bit) : x)), "custom")}
              className={cn(
                "h-10 w-9 rounded-md border font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                b === 1 ? "border-cyan-500/70 bg-cyan-500/15 text-foreground" : "border-border/70 text-muted-foreground",
                pending?.edge === i && "ring-2 ring-amber-400",
              )}
            >
              {b}
            </button>
          ))}
          <button type="button" className={btn} aria-label="Add a 0 bit" disabled={n >= MAX_DIN_BITS} onClick={() => applyStream([...din, 0], "custom")}>
            +
          </button>
          <button type="button" className={btn} aria-label="Remove the last bit" disabled={n <= 1} onClick={() => applyStream(din.slice(0, -1), "custom")}>
            −
          </button>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = parseDinStream(draft);
            if (parsed.error) setInputError(parsed.error);
            else applyStream(parsed.bits, DETECTOR_PRESETS.find((p) => p.din.join("") === parsed.bits.join(""))?.id ?? "custom");
          }}
        >
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Type a stream (0 and 1, up to {MAX_DIN_BITS} bits)
            <input
              ref={streamInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? errorId : undefined}
              className="h-10 w-48 max-w-full rounded-md border border-border/70 bg-background px-2 font-mono text-sm text-foreground"
            />
          </label>
          <button type="submit" className={btn}>
            Use stream
          </button>
        </form>
        {inputError ? (
          <p id={errorId} role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            {inputError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedControl
            label="Output style"
            value={style}
            onChange={(v) => {
              setStyle(v);
              restart();
            }}
            options={[
              { value: "mealy", label: "Mealy (lesson)" },
              { value: "moore", label: "Moore: add S_FOUND" },
            ]}
          />
          <label className="flex min-h-10 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={seedsOff}
              onChange={(e) => {
                setSeedsOff(e.target.checked);
                restart();
              }}
              className="h-4 w-4 accent-rose-500"
            />
            Break it: remove the seed lines
          </label>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-3">
          <DetectorDiagram style={style} current={currentState} taken={taken} />
          <details className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2" open={seedsOff}>
            <summary className="cursor-pointer text-sm font-medium text-foreground">Text table of every arc{seedsOff ? " and the unassigned paths" : ""}</summary>
            <div className="mt-2">
              <DetectorTable style={style} seeds={!seedsOff} currentCell={focus ? { state: focus.state, din: focus.din } : null} />
            </div>
          </details>
        </div>
        <CodeTrace className="min-w-0" label={`always_ff + always_comb (${style === "mealy" ? "Mealy" : "Moore"})`} lines={codeLines} activeKey={activeKey} contextKeys={contextKeys} />
      </div>

      {seedsOff ? (
        <div className="space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-3 text-sm">
          <p className="font-semibold text-foreground">{latchSummary(run.machine, false)}</p>
          <p className="text-muted-foreground">{SEEDS_OFF_STEPPING_NOTE}</p>
        </div>
      ) : predicting && pending && review === null ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3" aria-label={`Prediction for edge ${pending.edge}`} role="group">
          <p className="mb-2 text-sm font-semibold text-foreground">
            <PredictChip />
            Edge {pending.edge} (bit {pending.edge + 1} of {n}): what does the always_comb compute?
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <ValueChip name="state" value={pending.state} />
            <ValueChip name="din" value={pending.din} />
          </div>
          <div className="space-y-2">
            <ChoiceGroup
              legend="Next state (state after this edge)"
              value={guessNext}
              onChange={(v) => setGuessNext(v)}
              options={run.machine.states.map((s) => ({ value: s, label: s }))}
            />
            <ChoiceGroup
              legend="detected at this edge"
              value={guessDet === null ? null : (String(guessDet) as "0" | "1")}
              onChange={(v) => setGuessDet(v === "1" ? 1 : 0)}
              options={[
                { value: "0", label: "detected 0" },
                { value: "1", label: "detected 1" },
              ]}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={primaryBtn} disabled={!guessNext || guessDet === null} onClick={() => reveal(true)}>
              Lock in and step the edge
            </button>
            <button type="button" className={linkBtn} onClick={() => reveal(false)}>
              Reveal without predicting
            </button>
          </div>
        </div>
      ) : null}

      {!seedsOff && grade && focusEdge !== null && review === null ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm" data-testid="fsm-feedback">
          <Verdict ok={grade.predicted ? grade.nextCorrect && grade.detectedCorrect : null}>{grade.headline}</Verdict>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {grade.sentences.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {revealed < n ? (
              <button type="button" className={btn} onClick={nextEdge}>
                Next edge
              </button>
            ) : (
              <p className="font-medium text-foreground">{runSummary(run)}</p>
            )}
            <button type="button" className={btn} onClick={restart}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      {!seedsOff ? (
        revealed > 0 ? (
          <CycleWaveform
            title="101 detector, revealed edges"
            caption={`Column k is rising edge k; each value is the one sampled at that edge. ✓ marks a detection. ${revealed} of ${n} edges revealed. Select an edge number to review it.`}
            edges={revealed}
            cursor={focusEdge ?? undefined}
            onSelectEdge={(k) => setReview(k)}
            markers={markers}
            signals={[
              { name: "clk", kind: "clock" },
              { name: "din", kind: "bit", values: run.edges.slice(0, revealed).map((e) => e.din) },
              { name: "state", kind: "bus", values: run.edges.slice(0, revealed).map((e) => e.state) },
              { name: "detected", kind: "bit", values: run.edges.slice(0, revealed).map((e) => e.detected) },
            ]}
            cycleWidth={66}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">The waveform gains one column per revealed edge.</p>
        )
      ) : null}

      {review !== null && focus ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] p-2 text-sm">
          <span>Reviewing: {describeDetectorEdge(focus)}</span>
          <button type="button" className={btn} onClick={() => setReview(null)}>
            Back to stepping
          </button>
        </div>
      ) : null}
    </VisualFrame>
  );
}

/* ======================================================================== */
/* Traffic-light controller                                                 */
/* ======================================================================== */

const LIGHT_POS: Record<LightState, { x: number; y: number }> = {
  RED: { x: 60, y: 70 },
  GREEN: { x: 250, y: 70 },
  YELLOW: { x: 155, y: 178 },
};

const LIGHT_TONE: Record<LightState, string> = {
  RED: "fill-rose-500/20 stroke-rose-500",
  GREEN: "fill-emerald-500/20 stroke-emerald-500",
  YELLOW: "fill-amber-400/25 stroke-amber-500",
};

function TrafficDiagram({ m, current, showDurations }: { m: TrafficMachine; current: LightState | null; showDurations: boolean }) {
  const id = useId().replace(/:/g, "");
  const r = 40;
  const edge = (from: LightState, to: LightState) => {
    const a = LIGHT_POS[from];
    const b = LIGHT_POS[to];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    return { x1: a.x + ux * r, y1: a.y + uy * r, x2: b.x - ux * (r + 3), y2: b.y - uy * (r + 3), lx: (a.x + b.x) / 2, ly: (a.y + b.y) / 2 };
  };
  const label = `Traffic-light state diagram: RED to GREEN to YELLOW to RED, each move when timer is 0.${current ? ` Current state ${current}.` : ""} The table below lists each state's light and timer load.`;
  return (
    <svg viewBox="0 0 310 236" role="img" aria-label={label} className="block h-auto w-full max-w-[360px]">
      <defs>
        <marker id={`${id}-o`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10" fill="none" className="stroke-muted-foreground" strokeWidth={1.5} />
        </marker>
      </defs>
      {LIGHT_STATES.map((s) => {
        const e = edge(s, m.succ[s]);
        return (
          <g key={`e-${s}`}>
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="6 4" markerEnd={`url(#${id}-o)`} />
            <text x={e.lx + (s === "RED" ? 0 : s === "GREEN" ? 34 : -34)} y={e.ly + (s === "RED" ? -8 : 4)} fontSize={10} textAnchor="middle" className="fill-foreground">
              timer == 0
            </text>
          </g>
        );
      })}
      {LIGHT_STATES.map((s) => {
        const p = LIGHT_POS[s];
        const now = s === current;
        return (
          <g key={s}>
            <circle cx={p.x} cy={p.y} r={r} strokeWidth={now ? 4 : 1.5} className={cn("transition-all duration-200 motion-reduce:transition-none", LIGHT_TONE[s], !now && "opacity-60")} />
            <text x={p.x} y={p.y - 8} fontSize={12} textAnchor="middle" className="fill-foreground font-semibold">
              {now ? "▶ " : ""}
              {s}
            </text>
            <text x={p.x} y={p.y + 6} fontSize={10} textAnchor="middle" className="fill-foreground font-mono">
              light {m.light[s]}
            </text>
            <text x={p.x} y={p.y + 19} fontSize={9.5} textAnchor="middle" className="fill-muted-foreground font-mono">
              {showDurations ? `${stateDuration(m, s)} edge${stateDuration(m, s) === 1 ? "" : "s"}` : `loads ${m.timerWidth}'d${m.loads[s]}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TrafficStepper({ preset, className }: { preset?: string; className?: string }) {
  const initial = findTrafficPreset(preset);
  const [broken, setBroken] = useState(initial.broken);
  const [predictEdge, setPredictEdge] = useState(initial.predictEdge);
  const [guessLight, setGuessLight] = useState<LightState | null>(null);
  const [guessPrints, setGuessPrints] = useState<number[]>([]);
  const [committed, setCommitted] = useState<{ light: LightState | null; prints: number[] | null } | null>(null);

  const m = useMemo(() => trafficMachine(broken), [broken]);
  const run = useMemo(() => runTraffic(m), [m]);
  const n = run.edges.length;
  const playback = usePlayback(n, `${broken}-${committed ? "on" : "off"}`);
  const revealed = committed !== null;
  const k = Math.min(playback.index, n - 1);
  const e = run.edges[k];
  const keys = trafficActiveKeys(e);

  const resetPrediction = () => {
    setGuessLight(null);
    setGuessPrints([]);
    setCommitted(null);
    playback.reset();
  };

  const lightGrade = committed ? gradeLightGuess(run, predictEdge, committed.light) : null;
  const printGrade = committed?.prints ? gradePrintGuess(run, committed.prints) : null;

  const markers: CycleMarker[] = run.edges
    .filter((x) => x.edge <= k)
    .map((x) => ({ edge: x.edge, tone: x.match ? "pass" : "fail", label: `edge ${x.edge}: EXP ${x.expected}, ACT ${x.light} ${x.match ? "✓" : "✕"}` }));

  const live = !revealed
    ? `Predict the light at edge ${predictEdge} and which edges print a change.`
    : `${describeTrafficEdge(run, e)}${k === n - 1 ? ` ${trafficVerdict(run)}` : ""}`;

  const codeLines = trafficCode(m).map((l) => ({ ...l, owner: "design" as const }));
  const log = revealed ? logUpTo(run, k) : [];
  const prevTimer = k > 0 ? run.edges[k - 1].timer : undefined;

  return (
    <VisualFrame
      label="FSM edge stepper: the traffic-light controller"
      eyebrow="Step it edge by edge"
      title="The traffic-light controller: timer-held states and the self-checking bench"
      summary="Predict the light at an edge and which edges print a change, then step: the state bubble, the decoder item, the timer and the bench's EXP/ACT check move together."
      fidelity="model"
      assumptions={TRAFFIC_ASSUMPTIONS}
      className={className}
    >
      <p role="status" aria-live="polite" className="sr-only" data-testid="fsm-live">
        {live}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
        <SegmentedControl
          label="Controller version"
          value={broken ? "break-yellow" : "lesson"}
          onChange={(v) => {
            const p = TRAFFIC_PRESETS.find((x) => x.id === v) ?? TRAFFIC_PRESETS[0];
            setBroken(p.broken);
            setPredictEdge(p.predictEdge);
            resetPrediction();
          }}
          options={TRAFFIC_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-3">
          <TrafficDiagram m={m} current={revealed ? e.state : null} showDurations={revealed} />
          <table className="w-full text-left text-xs">
            <caption className="mb-1 text-left text-xs font-semibold text-foreground">Each state as a table</caption>
            <thead>
              <tr className="border-b border-border/70 text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">state</th>
                <th scope="col" className="py-1 pr-2 font-medium">light</th>
                <th scope="col" className="py-1 pr-2 font-medium">timer load</th>
                <th scope="col" className="py-1 font-medium">moves to (timer == 0)</th>
              </tr>
            </thead>
            <tbody>
              {LIGHT_STATES.map((s) => (
                <tr key={s} aria-current={revealed && e.state === s ? "true" : undefined} className={cn("border-b border-border/40", revealed && e.state === s && "bg-cyan-500/10 font-semibold")}>
                  <th scope="row" className="py-1 pr-2 font-mono font-normal">{s}</th>
                  <td className="py-1 pr-2 font-mono">{m.light[s]}</td>
                  <td className="py-1 pr-2 font-mono">{`${m.timerWidth}'d${m.loads[s]}`}{s === m.resetState ? ` (reset ${m.timerWidth}'d${m.resetTimer})` : ""}</td>
                  <td className="py-1 font-mono">{m.succ[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CodeTrace
          className="min-w-0"
          label={broken ? "traffic_light (break-it: YELLOW loads 4'd1)" : "traffic_light"}
          lines={codeLines}
          activeKey={revealed ? keys.active : undefined}
          contextKeys={revealed ? keys.context : []}
        />
      </div>

      {!revealed ? (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3" role="group" aria-label="Predictions for the traffic light">
          <p className="text-sm font-semibold text-foreground">
            <PredictChip />
            Reset is released before edge 0 with state RED and timer {m.resetTimer}. Edge k is at t = {run.edges[0].tNs} + {TRAFFIC_BENCH.periodNs}k ns.
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Choose an edge</p>
            <SegmentedControl
              label="Edge to predict"
              mono
              value={String(predictEdge)}
              onChange={(v) => {
                setPredictEdge(Number(v));
                setGuessLight(null);
              }}
              options={run.edges.map((x) => ({ value: String(x.edge), label: String(x.edge), ariaLabel: `edge ${x.edge}` }))}
            />
          </div>
          <ChoiceGroup
            legend={`Light sampled at edge ${predictEdge}`}
            value={guessLight}
            onChange={(v) => setGuessLight(v)}
            options={LIGHT_STATES.map((s) => ({ value: s, label: `${s} ${m.light[s]}` }))}
          />
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Which edges are followed by a printed change of light? (none is a valid answer)</legend>
            <div className="flex flex-wrap gap-1.5">
              {run.edges.map((x) => {
                const on = guessPrints.includes(x.edge);
                return (
                  <label
                    key={x.edge}
                    className={cn(
                      "inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-md border px-2 font-mono text-sm focus-within:ring-2 focus-within:ring-ring",
                      on ? "border-amber-500/70 bg-amber-500/15" : "border-border/70",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      aria-label={`edge ${x.edge} prints a change`}
                      onChange={() => setGuessPrints((g) => (on ? g.filter((y) => y !== x.edge) : [...g, x.edge]))}
                    />
                    <span aria-hidden>{on ? "✓" : ""}</span>
                    {x.edge}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryBtn} disabled={!guessLight} onClick={() => setCommitted({ light: guessLight, prints: [...guessPrints] })}>
              Lock in prediction
            </button>
            <button type="button" className={linkBtn} onClick={() => setCommitted({ light: null, prints: null })}>
              Reveal without predicting
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm" data-testid="fsm-feedback">
          {lightGrade ? <Verdict ok={committed?.light ? lightGrade.correct : null}>{lightGrade.headline}</Verdict> : null}
          <p className="text-muted-foreground">{explainLightAt(run, predictEdge)}</p>
          {printGrade ? <Verdict ok={printGrade.correct}>{printGrade.sentence}</Verdict> : null}
          <p className="text-muted-foreground">{explainPrints(run)}</p>
          <button type="button" className={btn} onClick={resetPrediction}>
            Predict again
          </button>
        </div>
      )}

      {revealed ? (
        <div className="space-y-3">
          <PlaybackControls playback={playback} stepCount={n} stepNoun="Edge" describeStep={(i) => describeTrafficEdge(run, run.edges[i])} />
          <div className="flex flex-wrap items-center gap-2">
            <ValueChip name="state" value={e.state} changed={k > 0 && run.edges[k - 1].state !== e.state} />
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold">
              <span aria-hidden>⏱</span>
              <ValueChip name="timer" value={e.timer} changed={prevTimer !== undefined && prevTimer !== e.timer} />
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs", comparisonStyles.expected.className)}>
              {comparisonStyles.expected.tag} {e.expected}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs", comparisonStyles.actual.className)}>
              {comparisonStyles.actual.tag} {e.light}
            </span>
            <span className={e.match ? comparisonStyles.match.className : comparisonStyles.mismatch.className} aria-label={e.match ? "match" : "mismatch"}>
              {e.match ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph}
            </span>
          </div>
          <p className="text-[15px] text-foreground" data-testid="fsm-narration">
            {describeTrafficEdge(run, e)}
          </p>
          <CycleWaveform
            title="Traffic light after reset"
            caption={`Column k is rising edge k after reset is released (t = ${run.edges[0].tNs} + ${TRAFFIC_BENCH.periodNs}k ns); each value is the one sampled at that edge. ✓/✕ is the bench's check against expected_light[k].`}
            edges={n}
            cursor={k}
            onSelectEdge={(i) => playback.seek(i)}
            markers={markers}
            signals={[
              { name: "clk", kind: "clock" },
              { name: "state", kind: "bus", values: run.edges.map((x) => x.state) },
              { name: "timer", kind: "bus", values: run.edges.map((x) => x.timer) },
              { name: "light", kind: "bus", values: run.edges.map((x) => x.light) },
            ]}
            cycleWidth={52}
          />
          <figure className="rounded-xl border border-border/70 bg-slate-950/90 p-3 text-slate-100">
            <figcaption className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Log up to edge {k}</figcaption>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs [font-variant-ligatures:none]" data-testid="fsm-log">
              {log.length ? log.join("\n") : "(nothing printed yet)"}
            </pre>
          </figure>
          {k === n - 1 ? <Verdict ok={run.fail === 0}>{trafficVerdict(run)}</Verdict> : null}
        </div>
      ) : null}
    </VisualFrame>
  );
}
