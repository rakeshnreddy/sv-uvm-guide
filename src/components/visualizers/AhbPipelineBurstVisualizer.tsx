"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl, type SegmentOption } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import {
  AHB_PRESETS,
  AHB_PROPERTIES,
  WRAP_START_OPTIONS,
  buildPrediction,
  checkBurst,
  evaluateAhbProperty,
  getPreset,
  hex,
  rowCells,
  simulateAhb,
  sizeBytes,
  type AhbConfig,
  type AhbControlId,
  type AhbPresetId,
  type AhbPropertyId,
  type AhbScenario,
  type AhbTrace,
  type PropertyResult,
  type WaveRow,
} from "@/lib/ahb-model";
import { cn } from "@/lib/utils";

export const AHB_MODEL_ASSUMPTIONS = [
  "Arm IHI0033B.b (AHB5 / AHB-Lite). One master, one slave region, 32-bit data bus. HREADY and HRESP are the multiplexed values the master sees (§4.3).",
  "Column k is clock cycle k, the HCLK period that ends at rising edge k; everything in it is sampled at edge k. The spec's interval T(k-1)–Tk is cycle k here.",
  "IDLE and BUSY are driven for a set number of cycles. A NONSEQ/SEQ stays on the bus until an edge with HREADY high accepts it (§3.1, §3.6.1).",
  "A 'cancel' master abandons the failing burst and the access already on the address bus, and drives IDLE in the second ERROR cycle (§3.5.2, §5.1.3). Re-issuing later is master policy and is not modelled.",
  "HRDATA is shown only in the cycle that completes with OKAY; a slave need not drive valid read data earlier or on ERROR (§6.1.2). Illegal bursts are flagged, not routed to a second slave.",
];

type ControlSpec = { label: string; options: SegmentOption<string>[]; mono?: boolean; get: (c: AhbConfig) => string; set: (c: AhbConfig, v: string) => AhbConfig };

const count = (max: number): SegmentOption<string>[] => Array.from({ length: max + 1 }, (_, i) => ({ value: String(i), label: String(i) }));

const CONTROLS: Record<AhbControlId, ControlSpec> = {
  waitsA: { label: "Wait states on A", options: count(3), get: (c) => String(c.waitsA), set: (c, v) => ({ ...c, waitsA: Number(v) }) },
  waitsB: { label: "Wait states on B", options: count(3), get: (c) => String(c.waitsB), set: (c, v) => ({ ...c, waitsB: Number(v) }) },
  busyCycles: { label: "BUSY cycles before A1", options: count(2), get: (c) => String(c.busyCycles), set: (c, v) => ({ ...c, busyCycles: Number(v) }) },
  waitsA0: { label: "Wait states on A0", options: count(2), get: (c) => String(c.waitsA0), set: (c, v) => ({ ...c, waitsA0: Number(v) }) },
  waitsA2: { label: "Wait states on A2", options: count(2), get: (c) => String(c.waitsA2), set: (c, v) => ({ ...c, waitsA2: Number(v) }) },
  wrapBurst: {
    label: "HBURST",
    mono: true,
    options: [
      { value: "WRAP4", label: "WRAP4" },
      { value: "INCR4", label: "INCR4" },
    ],
    get: (c) => c.wrapBurst,
    set: (c, v) => ({ ...c, wrapBurst: v as AhbConfig["wrapBurst"] }),
  },
  wrapStart: {
    label: "Start address",
    mono: true,
    options: WRAP_START_OPTIONS.map((a) => ({ value: String(a), label: hex(a) })),
    get: (c) => String(c.wrapStart),
    set: (c, v) => ({ ...c, wrapStart: Number(v) }),
  },
  errorPolicy: {
    label: "Master after ERROR",
    options: [
      { value: "cancel", label: "cancels" },
      { value: "continue", label: "continues" },
    ],
    get: (c) => c.errorPolicy,
    set: (c, v) => ({ ...c, errorPolicy: v as AhbConfig["errorPolicy"] }),
  },
  errorWaits: { label: "OKAY waits before ERROR", options: count(2), get: (c) => String(c.errorWaits), set: (c, v) => ({ ...c, errorWaits: Number(v) }) },
  errorInBurst: {
    label: "Transfer A",
    options: [
      { value: "single", label: "SINGLE (ERROR on A)" },
      { value: "burst", label: "INCR4 (ERROR on A1)" },
    ],
    get: (c) => (c.errorInBurst ? "burst" : "single"),
    set: (c, v) => ({ ...c, errorInBurst: v === "burst" }),
  },
  slaveStyle: {
    label: "Slave ERROR",
    options: [
      { value: "one-cycle-bug", label: "one cycle (buggy RTL)" },
      { value: "two-cycle", label: "two cycles (fixed RTL)" },
    ],
    get: (c) => c.slaveStyle,
    set: (c, v) => ({ ...c, slaveStyle: v as AhbConfig["slaveStyle"] }),
  },
};

const BUS_LABEL_GUARD = "​";

/** Model rows → CycleWaveform signals. A repeated text with a new identity (NONSEQ A, then NONSEQ B) still draws a new segment. */
function toSignals(trace: AhbTrace, rows: WaveRow[]): CycleSignal[] {
  return rows.map((row) => {
    if (row === "HCLK") return { name: "HCLK", kind: "clock" };
    const cells = rowCells(trace, row);
    if (row === "HREADY" || row === "HWRITE") {
      return { name: row, kind: "bit", values: cells.map((c) => (c.value === null ? undefined : (c.value as number))) };
    }
    let prevKey = "";
    let prevShown: string | undefined;
    const values = cells.map((cell) => {
      if (cell.value === null) {
        prevKey = cell.key;
        prevShown = undefined;
        return undefined;
      }
      const text = String(cell.value);
      let shown: string;
      if (cell.key === prevKey && prevShown !== undefined) shown = prevShown;
      else if (prevShown !== undefined && prevShown.replace(BUS_LABEL_GUARD, "") === text) shown = prevShown.endsWith(BUS_LABEL_GUARD) ? text : `${text}${BUS_LABEL_GUARD}`;
      else shown = text;
      prevKey = cell.key;
      prevShown = shown;
      return shown;
    });
    return { name: row, kind: "bus", values };
  });
}

function describeScenario(s: AhbScenario): { master: string[]; slave: string[] } {
  const master = s.bursts.map((b) => {
    const n = b.burst === "INCR" ? b.incrBeats ?? 1 : undefined;
    const busy = Object.entries(b.busyBefore ?? {})
      .filter(([, v]) => v > 0)
      .map(([i, v]) => `${v} BUSY before ${b.id}${i}`);
    return `${b.id}: ${b.write ? "write" : "read"} ${b.burst}${n ? ` (${n} beats)` : ""} of ${sizeBytes(b.hsize)}-byte beats from ${hex(b.start)}${busy.length ? `, ${busy.join(", ")}` : ""}`;
  });
  const slave = Object.entries(s.slave ?? {})
    .filter(([, r]) => r.waits > 0 || r.resp === "ERROR")
    .map(([label, r]) => {
      const err = r.resp === "ERROR" ? (s.errorStyle === "one-cycle-bug" ? ", then a one-cycle ERROR (bug)" : ", then a two-cycle ERROR") : "";
      return `${label}: ${r.waits} OKAY wait state${r.waits === 1 ? "" : "s"}${err}`;
    });
  if (slave.length === 0) slave.push("Every transfer completes with zero wait states.");
  if (Object.values(s.slave ?? {}).some((r) => r.resp === "ERROR")) {
    master.push(`After an ERROR the master ${s.onError === "continue" ? "continues" : "cancels"} (§3.5.2).`);
  }
  return { master, slave };
}

function resultSummary(r: PropertyResult): { glyph: string; text: string; tone: string } {
  if (r.failures.length > 0) {
    return { glyph: "✕", text: `fails at edge ${r.failures.map((f) => f.decidedAt).join(", ")}`, tone: "text-rose-700 dark:text-rose-300" };
  }
  if (r.vacuous) return { glyph: "○", text: "never triggered (vacuous)", tone: "text-slate-600 dark:text-slate-300" };
  return { glyph: "✓", text: `holds (${r.attempts.length} attempt${r.attempts.length === 1 ? "" : "s"})`, tone: "text-emerald-700 dark:text-emerald-300" };
}

const BUG_HINTS = [
  "Find the edge where HRESP is high. What is HREADY at that same edge?",
  "p_error_first_then_second only starts when HRESP is high AND HREADY is low. Does that ever happen here?",
  "p_error_second_needs_first starts whenever HRESP and HREADY are both high, then looks one edge back with $past.",
];

/**
 * AHB pipeline lab: predict, then step through a cycle-accurate run of the
 * `ahb-model` (IHI0033B.b) with wait states, BUSY, WRAP, reads and the
 * two-cycle ERROR, and check which assertions hold on the trace.
 */
export default function AhbPipelineBurstVisualizer() {
  const [presetId, setPresetId] = useState<AhbPresetId>("wait");
  const [config, setConfig] = useState<AhbConfig>(() => getPreset("wait").defaults);
  const [selectedProp, setSelectedProp] = useState<AhbPropertyId | null>(null);

  const preset = getPreset(presetId);
  const scenario = useMemo(() => preset.build(config), [preset, config]);
  const trace = useMemo(() => simulateAhb(scenario), [scenario]);
  const prediction = useMemo(() => buildPrediction(presetId, config, trace), [presetId, config, trace]);
  const results = useMemo(() => preset.properties.map((id) => evaluateAhbProperty(id, trace)), [preset, trace]);
  const runKey = `${presetId}:${JSON.stringify(config)}`;
  const playback = usePlayback(trace.cycles.length, runKey);
  const cursor = Math.min(playback.index, trace.cycles.length - 1);
  const current = trace.cycles[cursor];
  const activeProp = selectedProp && preset.properties.includes(selectedProp) ? selectedProp : preset.properties[0];
  const activeResult = results.find((r) => r.id === activeProp);
  const setup = describeScenario(scenario);
  const wrapCheck = presetId === "wrap" ? checkBurst(config.wrapStart, config.wrapBurst, 2) : null;

  const choosePreset = (id: AhbPresetId) => {
    setPresetId(id);
    setConfig(getPreset(id).defaults);
    setSelectedProp(null);
  };

  const signals = useMemo(() => toSignals(trace, preset.rows), [trace, preset.rows]);

  const markers: CycleMarker[] = useMemo(() => {
    if (selectedProp && activeResult) {
      return activeResult.attempts.map((a) => ({
        edge: a.decidedAt,
        tone: a.pass ? ("pass" as const) : ("fail" as const),
        short: `@${a.edge}`,
        label: `${AHB_PROPERTIES[activeResult.id].name}, attempt from edge ${a.edge}: ${a.pass ? "passes" : "fails"} at edge ${a.decidedAt}. ${a.why}`,
      }));
    }
    return trace.cycles
      .filter((c) => c.completed)
      .map((c) => ({
        edge: c.cycle,
        tone: c.hresp === "ERROR" ? ("fail" as const) : ("pass" as const),
        short: c.completed ?? "",
        label: `${c.completed} completes with ${c.hresp} at edge ${c.cycle}`,
      }));
  }, [selectedProp, activeResult, trace]);

  const highlights: CycleHighlight[] = useMemo(
    () =>
      trace.cycles.flatMap((c): CycleHighlight[] => {
        if (c.dataPhase === "wait") return [{ from: c.cycle, to: c.cycle, tone: "info", label: `Cycle ${c.cycle}: wait state (HREADY low, OKAY)` }];
        if (c.dataPhase === "error1" || c.dataPhase === "error2" || c.dataPhase === "error-bug") {
          return [{ from: c.cycle, to: c.cycle, tone: "fail", label: `Cycle ${c.cycle}: ERROR response` }];
        }
        return [];
      }),
    [trace],
  );

  return (
    <div data-testid="ahb-pipeline-burst-visualizer">
      <VisualFrame
        label="AHB pipeline lab"
        eyebrow="Experiment · AHB transfers"
        title="AHB pipeline lab: predict the cycle, then check it"
        summary="Pick a scenario, change the slave's wait states or the master's choices, predict, and step through the cycle-accurate run."
        fidelity="model"
        assumptions={AHB_MODEL_ASSUMPTIONS}
      >
        <SegmentedControl
          label="Scenario"
          options={AHB_PRESETS.map((p) => ({ value: p.id, label: p.title }))}
          value={presetId}
          onChange={(v) => choosePreset(v as AhbPresetId)}
        />

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          <div className="min-w-0 rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
            <p className="font-semibold text-foreground">{preset.title}</p>
            <p className="mt-1 text-muted-foreground">{preset.summary}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Master</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[12px] [font-variant-ligatures:none]">
              {setup.master.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Slave</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[12px] [font-variant-ligatures:none]">
              {setup.slave.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-background/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Change the run</p>
            {preset.controls.map((id) => {
              const spec = CONTROLS[id];
              return (
                <div key={id} className="space-y-1">
                  <p className="text-xs font-medium text-foreground">{spec.label}</p>
                  <SegmentedControl label={spec.label} options={spec.options} value={spec.get(config)} mono={spec.mono} onChange={(v) => setConfig((c) => spec.set(c, v))} />
                </div>
              );
            })}
          </div>
        </div>

        {presetId === "bug" ? <HintLadder hints={BUG_HINTS} resetKey={runKey} /> : null}

        <PredictionPrompt
          question={prediction.question}
          options={prediction.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }))}
          resetKey={runKey}
        >
          <div className="space-y-4">
            <PlaybackControls playback={playback} stepCount={trace.cycles.length} stepNoun="Cycle" describeStep={(i) => trace.cycles[i]?.what ?? ""} />

            <CycleWaveform
              title={`${preset.title}: AHB signals per cycle`}
              signals={signals}
              edges={trace.cycles.length}
              markers={markers}
              highlights={highlights}
              cursor={cursor}
              onSelectEdge={(k) => playback.seek(k)}
              cycleWidth={58}
              caption="Column k is cycle k; its dashed line is edge k, where every value in the column is sampled. Hatched = not driven or don't care (X). Shaded columns are wait states (blue) or ERROR cycles (red). Markers above an edge: ✓/✕ data completes OKAY/ERROR, or the selected assertion's result."
            />

            <div aria-live="polite" className="rounded-xl border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-sm">
              <p className="font-mono text-xs font-semibold text-cyan-800 dark:text-cyan-200">
                Cycle {cursor} → edge {cursor}
              </p>
              <p className="mt-1 text-foreground">{current?.what}</p>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">Why: </strong>
                {current?.why}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[300px] text-left text-xs">
                <caption className="sr-only">Transfer ledger: when each beat is on the address bus, accepted, and completed</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-1.5">Beat</th>
                    <th scope="col" className="px-2 py-1.5">HADDR</th>
                    <th scope="col" className="px-2 py-1.5">Address phase</th>
                    <th scope="col" className="px-2 py-1.5">Data phase</th>
                    <th scope="col" className="px-2 py-1.5">Result</th>
                  </tr>
                </thead>
                <tbody className="font-mono [font-variant-ligatures:none]">
                  {trace.beats.map((b) => {
                    return (
                      <tr key={b.label} className="border-t border-border/60">
                        <th scope="row" className="px-2 py-1.5 font-semibold">
                          {b.label} <span className="font-normal text-muted-foreground">{b.trans}</span>
                        </th>
                        <td className="px-2 py-1.5">{hex(b.addr)}</td>
                        <td className="px-2 py-1.5">
                          {b.firstAddrCycle === null ? "never issued" : `from cycle ${b.firstAddrCycle}${b.acceptEdge !== null ? `, accepted at edge ${b.acceptEdge}` : ", never accepted"}`}
                        </td>
                        <td className="px-2 py-1.5">{b.dataCycles.length ? `cycles ${b.dataCycles[0]}–${b.dataCycles[b.dataCycles.length - 1]}` : "—"}</td>
                        <td className={cn("px-2 py-1.5", b.status === "cancelled" ? "text-amber-700 dark:text-amber-300" : b.resp === "ERROR" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
                          {b.status === "cancelled" ? "◇ cancelled" : b.resp === "ERROR" ? `✕ ERROR at edge ${b.completeEdge}` : `✓ OKAY at edge ${b.completeEdge}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {wrapCheck ? (
              <div className={cn("rounded-xl border p-3 text-sm", wrapCheck.legal ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-rose-500/50 bg-rose-500/[0.06]")}>
                <p className="font-mono [font-variant-ligatures:none]">
                  {wrapCheck.addresses.map(hex).join(" → ")}
                  {wrapCheck.wrapBoundary ? ` (wraps at ${wrapCheck.wrapBoundary} bytes)` : ""}
                </p>
                <p className="mt-1">
                  {wrapCheck.legal ? "✓ Legal burst." : `✕ ${wrapCheck.issues.map((i) => `${i.text} (${i.cite})`).join(" ")}`}
                  {config.wrapBurst === "WRAP4" ? " The 1KB rule is for incrementing bursts; a WRAP4 stays inside its 16-byte block (§3.5)." : ""}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checker on this trace · select one to mark its attempts</p>
              <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                {results.map((r) => {
                  const prop = AHB_PROPERTIES[r.id];
                  const s = resultSummary(r);
                  const pressed = selectedProp === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => setSelectedProp(pressed ? null : r.id)}
                      className={cn(
                        "min-h-10 rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                        pressed ? "border-cyan-500 bg-cyan-500/10" : "border-border/70 bg-background/50 hover:bg-muted",
                      )}
                    >
                      <span className="block font-mono font-semibold [font-variant-ligatures:none]">{prop.name}</span>
                      <span className={cn("mt-0.5 inline-block rounded px-1 text-[10px] font-semibold uppercase tracking-wider", prop.kind === "protocol" ? "bg-violet-500/15 text-violet-800 dark:text-violet-200" : "bg-amber-500/20 text-amber-900 dark:text-amber-200")}>
                        {prop.kind === "protocol" ? `Protocol ${prop.cite}` : `Flawed: ${prop.cite}`}
                      </span>
                      <span className={cn("mt-1 block font-semibold", s.tone)}>
                        {s.glyph} {s.text}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeResult ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{AHB_PROPERTIES[activeResult.id].summary}</p>
                  {activeResult.failures.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-rose-700 dark:text-rose-300">
                      {activeResult.failures.map((f) => (
                        <li key={`${f.edge}-${f.decidedAt}`}>
                          Edge {f.decidedAt}: {f.why}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <CodeTrace label={`${AHB_PROPERTIES[activeResult.id].name} (evaluated by the model)`} lines={AHB_PROPERTIES[activeResult.id].source.map((text, i) => ({ text, key: `l${i}` }))} />
                </div>
              ) : null}
            </div>
          </div>
        </PredictionPrompt>
      </VisualFrame>
    </div>
  );
}
