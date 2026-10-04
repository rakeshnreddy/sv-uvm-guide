"use client";

import React, { useMemo, useState } from "react";

import {
  CodeTrace,
  CycleWaveform,
  PredictionPrompt,
  SegmentedControl,
  VisualFrame,
  type CodeTraceLine,
  type CycleMarker,
  type CycleSignal,
  type PredictionOption,
} from "@/components/visual-system";
import {
  ASSERTION_IDS,
  ASSUMPTION_IDS,
  CONTRACT_ASSUMPTIONS,
  DUT_LABELS,
  SIM_CYCLES,
  classifyReplay,
  dutLines,
  propertyModuleLines,
  replaySequenceLines,
  replayTrace,
  runFormal,
  simulateRandom,
  type AssertionId,
  type AssumptionId,
  type DutVariant,
  type FormalReport,
  type SimRun,
  type TraceCycle,
} from "@/lib/formal-fifo-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS_TEXT = [
  "Only the FIFO occupancy counter is modelled (DEPTH = 4, 3-bit count). Data storage is not.",
  "Formal = exhaustive breadth-first search over every input sequence the enabled assumptions allow. The state space is tiny, so this is a full proof, and each counterexample is a shortest one.",
  "Simulation = one constrained-random run of 16 clock edges from a seeded generator. The driver's c_legal constraint obeys the interface contract.",
  "Properties use the values sampled at each rising edge (IEEE 1800-2023 §16.5.1). Reset is applied before edge 0, so disable iff never triggers.",
  "Real formal tools give the same verdicts on this design, but their engines, traces and reports differ.",
];

type Outcome = "both_proven" | "range_fails" | "full_fails" | "both_fail";

function outcomeOf(report: FormalReport): Outcome {
  const range = report.assertions.p_count_in_range.status === "cex";
  const full = report.assertions.p_full_is_correct.status === "cex";
  if (range && full) return "both_fail";
  if (range) return "range_fails";
  if (full) return "full_fails";
  return "both_proven";
}

const OUTCOME_CLAIMS: Record<Outcome, Record<AssertionId, "proven" | "cex">> = {
  both_proven: { p_count_in_range: "proven", p_full_is_correct: "proven" },
  range_fails: { p_count_in_range: "cex", p_full_is_correct: "proven" },
  full_fails: { p_count_in_range: "proven", p_full_is_correct: "cex" },
  both_fail: { p_count_in_range: "cex", p_full_is_correct: "cex" },
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  both_proven: "Both assertions are proven.",
  range_fails: "p_count_in_range gets a counterexample; p_full_is_correct is proven.",
  full_fails: "p_full_is_correct gets a counterexample; p_count_in_range is proven.",
  both_fail: "Both assertions get counterexamples.",
};

function predictionOptions(report: FormalReport): PredictionOption[] {
  const actual = outcomeOf(report);
  return (Object.keys(OUTCOME_LABELS) as Outcome[]).map((id) => {
    const claims = OUTCOME_CLAIMS[id];
    const correct = id === actual;
    const sentences = ASSERTION_IDS.map((a) => {
      const v = report.assertions[a];
      if (correct || claims[a] !== v.status) {
        return `${a} ${v.status === "cex" ? `has a counterexample at edge ${v.failCycle}` : v.vacuous ? "is proven, but only vacuously" : "is proven"}: ${v.why}`;
      }
      return null;
    }).filter(Boolean);
    return { id, label: OUTCOME_LABELS[id], correct, feedback: sentences.join(" ") };
  });
}

const statusGlyph = (status: string, vacuous = false) =>
  status === "cex" ? "✕" : status === "unreachable" ? "∅" : vacuous ? "○" : "✓";

function traceSignals(cycles: TraceCycle[]): CycleSignal[] {
  return [
    { name: "clk", kind: "clock" },
    { name: "push", kind: "bit", values: cycles.map((c) => c.push) },
    { name: "pop", kind: "bit", values: cycles.map((c) => c.pop) },
    { name: "count", kind: "bus", values: cycles.map((c) => c.count) },
    { name: "full", kind: "bit", values: cycles.map((c) => c.full) },
    { name: "empty", kind: "bit", values: cycles.map((c) => c.empty) },
  ];
}

function simMarkers(run: SimRun): CycleMarker[] {
  const markers: CycleMarker[] = [];
  for (const c of run.cycles) {
    const fails = ASSERTION_IDS.filter((a) => c.assertions[a] === "fail");
    if (fails.length) markers.push({ edge: c.cycle, tone: "fail", label: `edge ${c.cycle}: ${fails.join(", ")} fails` });
    else if (c.assumptionFails.length) markers.push({ edge: c.cycle, tone: "fail", glyph: "!", label: `edge ${c.cycle}: assumption ${c.assumptionFails.join(", ")} fails` });
    else if (c.covers.length) markers.push({ edge: c.cycle, tone: "info", label: `edge ${c.cycle}: c_reach_depth hit` });
  }
  return markers;
}

const SEEDS = ["1", "2", "3", "4", "5"] as const;
type Seed = (typeof SEEDS)[number];

export default function FormalVsSimulationVisualizer() {
  const [dut, setDut] = useState<DutVariant>("correct");
  const [enabled, setEnabled] = useState<AssumptionId[]>([...CONTRACT_ASSUMPTIONS]);
  const [selectedCex, setSelectedCex] = useState<AssertionId | null>(null);
  const [seed, setSeed] = useState<Seed>("1");

  const report = useMemo(() => runFormal({ dut, assumptions: enabled }), [dut, enabled]);
  const configKey = `${dut}|${enabled.join(",")}`;
  const options = useMemo(() => predictionOptions(report), [report]);
  const cexIds = ASSERTION_IDS.filter((a) => report.assertions[a].status === "cex");
  const shownCex = selectedCex && cexIds.includes(selectedCex) ? selectedCex : cexIds[0] ?? null;
  const cexVerdict = shownCex ? report.assertions[shownCex] : null;
  const replay = useMemo(() => (cexVerdict?.trace ? classifyReplay(replayTrace(dut, cexVerdict.trace, enabled)) : null), [cexVerdict, dut, enabled]);
  const sim = useMemo(() => simulateRandom(dut, Number(seed), enabled), [dut, seed, enabled]);

  const toggle = (id: AssumptionId) => {
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : ASSUMPTION_IDS.filter((x) => x === id || prev.includes(x))));
    setSelectedCex(null);
  };

  const propertyLines: CodeTraceLine[] = propertyModuleLines(enabled).map((l) => ({ ...l, owner: "testbench" }));
  const rtlLines: CodeTraceLine[] = dutLines(dut).map((l) => ({ ...l, owner: "design" }));

  return (
    <VisualFrame
      label="Formal vs simulation explorer"
      eyebrow="Experiment"
      title="One property library, two engines"
      summary={
        <>
          The same <code>assume</code>/<code>assert</code>/<code>cover</code> lines are bound into simulation and formal. Change the RTL or the assumptions, predict what formal reports, then replay its counterexample in UVM.
        </>
      }
      fidelity="model"
      assumptions={ASSUMPTIONS_TEXT}
    >
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">RTL under test</p>
          <SegmentedControl
            label="RTL under test"
            value={dut}
            onChange={(v) => {
              setDut(v);
              setSelectedCex(null);
            }}
            options={(Object.keys(DUT_LABELS) as DutVariant[]).map((v) => ({ value: v, label: DUT_LABELS[v] }))}
          />
          <CodeTrace label="fifo.sv (occupancy logic)" lines={rtlLines} activeKey={dut === "late_full" ? "full" : undefined} />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shared property library: toggle assumptions</p>
          <CodeTrace
            label="fifo_props.sv"
            lines={propertyLines}
            renderLineControl={(line) =>
              line.key && (ASSUMPTION_IDS as readonly string[]).includes(line.key) ? (
                <button
                  type="button"
                  aria-pressed={enabled.includes(line.key as AssumptionId)}
                  aria-label={`${line.key}: ${enabled.includes(line.key as AssumptionId) ? "enabled" : "disabled"}. Toggle assumption`}
                  onClick={() => toggle(line.key as AssumptionId)}
                  className={cn(
                    "min-h-7 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                    enabled.includes(line.key as AssumptionId) ? "border-sky-400 bg-sky-400/20 text-sky-100" : "border-slate-500 text-slate-400 hover:bg-white/10",
                  )}
                >
                  {enabled.includes(line.key as AssumptionId) ? "on" : "off"}
                </button>
              ) : null
            }
          />
          <p className="text-xs text-muted-foreground">
            Try: turn off <code>a_no_push_when_full</code>; switch to the late-flag RTL; then turn on <code>a_never_fill</code> with the buggy RTL.
          </p>
        </div>
      </div>

      <PredictionPrompt resetKey={configKey} question="Run formal on this setup. What does it report for the two assertions?" options={options}>
        <div className="space-y-5">
          <section aria-label="Formal results" className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Formal: {report.reachableStates} reachable states explored, every allowed input sequence
            </h4>
            <ul className="space-y-2" aria-live="polite">
              {ASSERTION_IDS.map((id) => {
                const v = report.assertions[id];
                return (
                  <li key={id} className={cn("rounded-lg border p-3 text-sm", v.status === "cex" ? "border-rose-500/50 bg-rose-500/5" : v.vacuous ? "border-amber-500/50 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span aria-hidden className="font-bold">{statusGlyph(v.status, v.vacuous)}</span>
                      <code className="font-mono [font-variant-ligatures:none]">{id}</code>
                      <span className="font-semibold">{v.status === "cex" ? `counterexample at edge ${v.failCycle}` : v.vacuous ? "proven (vacuous)" : "proven"}</span>
                      {v.status === "cex" ? (
                        <button
                          type="button"
                          aria-pressed={shownCex === id}
                          onClick={() => setSelectedCex(id)}
                          className="ml-auto min-h-8 rounded-md border border-border/70 px-2 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Show CEX trace for {id}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">{v.why}</p>
                  </li>
                );
              })}
              <li className={cn("rounded-lg border p-3 text-sm", report.covers.c_reach_depth.status === "covered" ? "border-emerald-500/40" : "border-amber-500/50 bg-amber-500/5")}>
                <span aria-hidden className="mr-2 font-bold">{statusGlyph(report.covers.c_reach_depth.status)}</span>
                <code className="font-mono [font-variant-ligatures:none]">c_reach_depth</code>{" "}
                <span className="font-semibold">{report.covers.c_reach_depth.status}</span>
                <p className="mt-1 text-muted-foreground">{report.covers.c_reach_depth.why}</p>
              </li>
              <li className="rounded-lg border border-sky-500/40 p-3 text-sm text-muted-foreground">
                Assumptions ({enabled.length ? enabled.join(", ") : "none"}) only restrict the inputs formal explores. Formal never checks them (IEEE 1800-2023 §16.14.2), so a missing or wrong assumption changes what &quot;proven&quot; means.
              </li>
            </ul>
          </section>

          {cexVerdict?.trace && shownCex ? (
            <section aria-label="Counterexample trace" className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Counterexample for {shownCex}</h4>
              <CycleWaveform
                title={`Counterexample for ${shownCex}`}
                caption="x-axis: clock edges after reset. Each column shows the values sampled at that edge; push/pop at edge k change count at edge k+1."
                signals={traceSignals(cexVerdict.trace)}
                edges={cexVerdict.trace.length}
                markers={[{ edge: cexVerdict.failCycle as number, tone: "fail", label: `${shownCex} fails at edge ${cexVerdict.failCycle}` }]}
                highlights={[{ from: cexVerdict.failCycle as number, to: cexVerdict.failCycle as number, tone: "fail", label: "failing edge" }]}
              />
              <PredictionPrompt
                resetKey={`${configKey}|${shownCex}`}
                question="Before you replay it in UVM: is this counterexample a design bug?"
                options={[
                  {
                    id: "bug",
                    label: "Yes. The RTL is wrong; file a bug.",
                    correct: replay?.kind === "dut_bug",
                    feedback:
                      replay?.kind === "dut_bug"
                        ? "Right. The trace only uses stimulus the contract allows, so the failure belongs to the RTL."
                        : "A counterexample is only a witness relative to the assumptions. This one uses stimulus the real environment never produces.",
                  },
                  {
                    id: "env",
                    label: "No. Formal used stimulus the real environment never produces.",
                    correct: replay?.kind === "spurious",
                    feedback:
                      replay?.kind === "spurious"
                        ? "Right. The trace breaks the interface contract, so the fix is the missing assumption, not the RTL."
                        : "Every input in this trace obeys the contract (no push while full, no pop while empty), so the environment is not to blame.",
                  },
                ]}
              >
                {replay ? (
                  <div className="space-y-2">
                    <p className={cn("text-sm font-medium", replay.kind === "dut_bug" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300")}>
                      Replay verdict: {replay.kind === "dut_bug" ? "✕ real DUT bug" : replay.kind === "spurious" ? "! spurious counterexample" : "no failure"}. {replay.why}
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]" aria-label="Generated replay sequence">
                      <code>{replaySequenceLines(cexVerdict.trace).join("\n")}</code>
                    </pre>
                  </div>
                ) : null}
              </PredictionPrompt>
            </section>
          ) : null}

          <section aria-label="Constrained-random simulation" className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Simulation: one constrained-random UVM run ({SIM_CYCLES} edges)</h4>
            <SegmentedControl label="Random seed" value={seed} onChange={setSeed} options={SEEDS.map((s) => ({ value: s, label: `seed ${s}` }))} />
            <ul className="space-y-1 text-sm" aria-live="polite">
              {ASSERTION_IDS.map((id) => {
                const fail = sim.firstAssertionFail[id];
                const matched = sim.cycles.filter((c) => c.assertions[id] !== "vacuous").length;
                return (
                  <li key={id}>
                    <span aria-hidden className="mr-1 font-bold">{fail === undefined ? "✓" : "✕"}</span>
                    <code className="font-mono [font-variant-ligatures:none]">{id}</code>:{" "}
                    {fail === undefined ? `no failure in ${SIM_CYCLES} edges` : `fails at edge ${fail}`}
                    {id === "p_full_is_correct" ? ` (antecedent matched at ${matched} edge${matched === 1 ? "" : "s"})` : ""}
                    {fail === undefined && report.assertions[id].status === "cex" ? " — formal found a counterexample this seed never exercised." : ""}
                  </li>
                );
              })}
              <li>
                <span aria-hidden className="mr-1 font-bold">{sim.coverHit.c_reach_depth === undefined ? "∅" : "✓"}</span>
                <code className="font-mono">c_reach_depth</code>: {sim.coverHit.c_reach_depth === undefined ? "never hit by this seed" : `hit at edge ${sim.coverHit.c_reach_depth}`}
              </li>
              {Object.entries(sim.firstAssumptionFail).map(([id, edge]) => (
                <li key={id} className="text-amber-700 dark:text-amber-300">
                  <span aria-hidden className="mr-1 font-bold">!</span>
                  Simulation checks assumptions too: <code className="font-mono">{id}</code> fails at edge {edge}. The legal environment does what this assumption forbids, so formal is over-constrained.
                </li>
              ))}
            </ul>
            <CycleWaveform
              title={`Constrained-random run, seed ${seed}`}
              caption="x-axis: clock edges after reset (one UVM item per edge). ✕ assertion fails, ! assumption fails, ● cover hit."
              signals={traceSignals(sim.cycles)}
              edges={sim.cycles.length}
              markers={simMarkers(sim)}
              cycleWidth={36}
            />
          </section>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
