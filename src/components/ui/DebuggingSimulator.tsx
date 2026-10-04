"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ALL_SCENARIOS,
  HANG_SCENARIOS,
  hangScenarios,
  runHang,
  type HangRun,
  type HangScenarioId,
  type LogLine,
} from "@/lib/uvm-hang-model";
import { cn } from "@/lib/utils";

export const HANG_MODEL_ASSUMPTIONS = [
  "A small deterministic scheduler runs the test, sequences, sequencer arbitration (FIFO), driver and scoreboard; every item takes 10 ns to drive.",
  "Sequencer rules follow uvm-core 2020.3.1: a second get_next_item() without item_done() reports an error and returns the same item; while a sequence holds grab()/lock(), only it is granted.",
  "The run phase ends when all objections are dropped (drain time 0, no phase_ready_to_end); a phase with no objection ends at once. The test sets a 1000 ns timeout, which raises PH_TIMEOUT.",
  "+UVM_OBJECTION_TRACE lines use the uvm_objection format; only the source line is shown, not the propagation to each parent.",
  "Log lines are abridged; identical consecutive messages are folded with a repeat count.",
];

type Probe = "processes" | "objections" | "sequencer";

const probeLabels: Record<Probe, string> = {
  processes: "Where is each process?",
  objections: "phase.get_objection().display_objections()",
  sequencer: "sqr.is_grabbed() / current_grabber()",
};

function LogView({ lines, label }: { lines: LogLine[]; label: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</figcaption>
      <ol className="max-h-72 overflow-auto py-2 font-mono text-[11.5px] leading-5 [font-variant-ligatures:none]" aria-label={label}>
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              "whitespace-pre px-3",
              l.kind === "error" && "text-rose-300",
              l.kind === "fatal" && "font-semibold text-rose-200",
              l.kind === "trace" && "text-sky-300",
            )}
          >
            {l.text}
            {l.repeat ? <span className="text-amber-300">{`   ×${l.repeat} (repeats until t = ${l.lastTime})`}</span> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function ProbeResult({ probe, run }: { probe: Probe; run: HangRun }) {
  if (probe === "processes") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-left text-xs">
          <caption className="sr-only">Process states at t = {run.endTime}</caption>
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-2">Process</th>
              <th scope="col" className="py-1 pr-2">State at t = {run.endTime}</th>
              <th scope="col" className="py-1">Since</th>
            </tr>
          </thead>
          <tbody>
            {run.processes.map((p) => (
              <tr key={p.name} className="border-t border-border/50 align-top">
                <td className="py-1 pr-2 font-mono [font-variant-ligatures:none]">{p.name}</td>
                <td className="py-1 pr-2">
                  <span aria-hidden>{p.blocked ? "⏸ " : p.status === "finished" ? "✓ " : "▶ "}</span>
                  {p.blocked ? "blocked in " : ""}
                  <span className="font-mono [font-variant-ligatures:none]">{p.status}</span>
                </td>
                <td className="py-1 font-mono tabular-nums">{p.since} ns</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (probe === "objections") {
    return <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">{run.objectionTable.join("\n")}</pre>;
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[11.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
      {[
        `sqr.is_grabbed()      = ${run.sequencer.grabbedBy ? 1 : 0}`,
        `sqr.current_grabber() = ${run.sequencer.grabbedBy ? `uvm_test_top.env.agt.sqr.${run.sequencer.grabbedBy}` : "null"}`,
        `item given to driver, awaiting item_done: ${run.sequencer.outstandingItem ?? "none"}`,
        `sequences waiting in start_item: ${run.sequencer.waitingRequests.length ? run.sequencer.waitingRequests.join(", ") : "none"}`,
      ].join("\n")}
    </pre>
  );
}

function runSummary(run: HangRun): string {
  if (run.ended === "timeout") return `Hang: PH_TIMEOUT fatal at t = ${run.endTime} ns after ${run.itemsCompleted} of ${run.itemsPlanned} items.`;
  if (run.itemsCompleted < run.itemsPlanned) return `Ends at t = ${run.endTime} ns with ${run.itemsCompleted} of ${run.itemsPlanned} items driven — it only looks clean.`;
  return `Ends cleanly at t = ${run.endTime} ns: ${run.itemsCompleted} of ${run.itemsPlanned} items, ${run.errors} UVM_ERROR${run.errors === 1 ? "" : "s"}.`;
}

interface DebuggingSimulatorProps {
  /** "hang" (default): the three classic hangs. "all": also the zero-time "passing" test. */
  scenario?: "hang" | "all";
}

/** Hang triage lab: read the evidence, name the component that owns the hang, then choose a fix the model reruns. */
export const DebuggingSimulator = ({ scenario = "hang" }: DebuggingSimulatorProps) => {
  const ids = scenario === "all" ? ALL_SCENARIOS : HANG_SCENARIOS;
  const [id, setId] = useState<HangScenarioId>(ids[0]);
  const [trace, setTrace] = useState(false);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const s = hangScenarios[id];
  const run = useMemo(() => runHang({ scenario: id, variant: "bug", objectionTrace: trace }), [id, trace]);
  const chosen = s.suspects.find((x) => x.id === suspect);
  const found = Boolean(chosen?.correct);
  const fix = s.fixes.find((f) => f.id === fixId);
  const fixRun = useMemo(() => (fix ? runHang({ scenario: id, variant: fix.variant, objectionTrace: trace }) : null), [fix, id, trace]);

  const choose = (next: HangScenarioId) => {
    setId(next);
    setProbes([]);
    setSuspect(null);
    setFixId(null);
  };
  const toggleProbe = (p: Probe) => setProbes((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <VisualFrame
      label="UVM hang triage lab"
      eyebrow="Debug it"
      title="Hang triage: who is holding the run open?"
      summary="Each run ends badly. Read the log, probe the testbench, name the component that owns the problem, then pick a fix — the model reruns it."
      fidelity="model"
      assumptions={HANG_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Hang scenario"
        options={ids.map((x) => ({ value: x, label: hangScenarios[x].title }))}
        value={id}
        onChange={choose}
      />
      <p className="text-sm text-foreground">
        <strong>Symptom: </strong>
        {s.symptom}
      </p>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={trace} onChange={(e) => setTrace(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        Rerun with <span className="font-mono [font-variant-ligatures:none]">+UVM_OBJECTION_TRACE</span>
      </label>

      <LogView lines={run.log} label={`Simulation log${trace ? " (+UVM_OBJECTION_TRACE)" : ""}`} />

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1 — probe the testbench at the end of the run</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(probeLabels) as Probe[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-expanded={probes.includes(p)}
              onClick={() => toggleProbe(p)}
              className={cn(
                "min-h-10 min-w-0 max-w-full rounded-lg border px-3 py-1.5 text-left font-mono text-xs [font-variant-ligatures:none] [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                probes.includes(p) ? "border-cyan-500 bg-cyan-500/10" : "border-border/70 hover:bg-muted",
              )}
            >
              {probes.includes(p) ? "▾ " : "▸ "}
              {probeLabels[p]}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          {probes.map((p) => (
            <section key={p} aria-label={probeLabels[p]} className="rounded-xl border border-border/70 bg-background/40 p-3">
              <ProbeResult probe={p} run={run} />
            </section>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">Step 2 — which component owns the problem?</legend>
        <div className="flex flex-wrap gap-2">
          {s.suspects.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={suspect === x.id}
              onClick={() => setSuspect(x.id)}
              className={cn(
                "min-h-10 rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                suspect === x.id ? (x.correct ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10") : "border-border/70 hover:bg-muted",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        {chosen ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{chosen.correct ? "✓ Found it. " : "✕ Not the owner. "}</strong>
            {chosen.feedback}
          </p>
        ) : null}
        {!found ? <HintLadder hints={s.hints} resetKey={id} className="mt-2" /> : null}
      </fieldset>

      {found ? (
        <div className="space-y-3">
          <CodeTrace label="The owner's code" lines={s.code.map((text, i) => ({ text, key: `l${i}`, owner: "testbench" }))} activeKey={`l${s.faultLine}`} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-foreground">Step 3 — choose a fix; the model reruns the test</legend>
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {s.fixes.map((f) => (
                <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                  <input type="radio" name={`hang-fix-${id}`} checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {fix && fixRun ? (
            <div aria-live="polite" className={cn("space-y-2 rounded-xl border p-3 text-sm", fix.correct ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}>
              <p className="font-medium text-foreground">
                <span aria-hidden>{fix.correct ? "✓ " : "✕ "}</span>
                Model: {runSummary(fixRun)}
              </p>
              <p className="text-foreground/90">{fixRun.narration}</p>
              <p>
                <strong>Review: </strong>
                {fix.review}
              </p>
              {fix.correct ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">{s.fixedCode.join("\n")}</pre>
              ) : null}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Log of the rerun</summary>
                <div className="mt-2">
                  <LogView lines={fixRun.log} label="Rerun log" />
                </div>
              </details>
            </div>
          ) : null}
        </div>
      ) : null}
    </VisualFrame>
  );
};

export default DebuggingSimulator;
