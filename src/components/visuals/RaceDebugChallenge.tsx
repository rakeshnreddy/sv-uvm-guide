"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { exploreOrderings, withAssignmentOp, withZeroDelay, type SvScenario } from "@/lib/sv-scheduler-model";
import { testbenchDriveScenario } from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

import { codeLinesFor } from "./scheduler/scheduler-view-helpers";
import { SCHEDULER_MODEL_ASSUMPTIONS } from "./TimeSlotTraceVisualizer";

const EXPECTED_Q = 3;

const suspects: { stmtId: string; verdict: "culprit" | "innocent"; feedback: string }[] = [
  {
    stmtId: "dut1",
    verdict: "innocent",
    feedback: "The flop is written the way hardware behaves: it reads din in Active and updates q in NBA. The read is fine — ask who else touches din in the same region.",
  },
  {
    stmtId: "tb1",
    verdict: "culprit",
    feedback: "Yes. din = 7 is a blocking write in Active, the same region where the flop reads din. Whichever process the simulator runs first decides whether the flop sees 3 or 7.",
  },
  {
    stmtId: "tb2",
    verdict: "innocent",
    feedback: "This read of q happens before the DUT's NBA update in every order, so it always sees the old q. It is not what makes q = 7.",
  },
];

interface FixOption {
  id: string;
  label: string;
  apply: (s: SvScenario) => SvScenario;
  review: string;
  /** Code-review verdict beyond what the model checks. */
  reviewOk: boolean;
}

const fixes: FixOption[] = [
  {
    id: "nba",
    label: "Change the driver to din <= 7",
    apply: (s) => withAssignmentOp(s, "tb1", "nba"),
    review: "Accepted. The write now lands in NBA, after every flop has read din.",
    reviewOk: true,
  },
  {
    id: "cb",
    label: "Drive through a clocking block: cb.din <= 7, read cb.q",
    apply: () => testbenchDriveScenario("clocking"),
    review: "Accepted — preferred. Timing is defined once in the interface; drives land in Re-NBA and monitors read Preponed samples.",
    reviewOk: true,
  },
  {
    id: "dut-delay",
    label: "Add #0 at the start of the DUT flop",
    apply: (s) => withZeroDelay(s, "DUT", true),
    review: "Rejected. It is deterministic, but the flop now always captures the testbench's new value — no real flop behaves that way — and you edited the design to fit the testbench.",
    reviewOk: false,
  },
  {
    id: "tb-delay",
    label: "Add #0 at the start of the driver",
    apply: (s) => withZeroDelay(s, "TB", true),
    review: "Passes here, rejected in review. #0 only moves the driver to Inactive; the next process that also uses #0 races it again there.",
    reviewOk: false,
  },
];

/** Debugging exercise: symptom → culprit line → fix, graded by the scheduler model. */
export default function RaceDebugChallenge() {
  const buggy = useMemo(() => testbenchDriveScenario("blocking"), []);
  const exploration = useMemo(() => exploreOrderings(buggy), [buggy]);
  const lines = useMemo(() => codeLinesFor(buggy), [buggy]);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const [hints, setHints] = useState(0);

  const found = suspects.find((s) => s.stmtId === suspect)?.verdict === "culprit";
  const labelOf = (id: string) => buggy.processes.find((p) => p.id === id)?.label ?? id;

  const fixResult = useMemo(() => {
    const fix = fixes.find((f) => f.id === fixId);
    if (!fix) return null;
    const result = exploreOrderings(fix.apply(buggy));
    const qs = result.outcomes.map((o) => o.finalValues.q);
    const faithful = result.deterministic && qs.every((q) => q === EXPECTED_Q);
    return { fix, result, qs, faithful };
  }, [fixId, buggy]);

  const hintText = [
    "Which statements execute when clk rises? List them and the region each one runs in.",
    "Look for a variable that one process writes with = and another process reads, both woken by the same edge.",
    "The DUT reads din. Who writes din, and with which operator?",
  ];

  return (
    <section aria-label="Race debugging challenge" className="not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Debug it</p>
          <h3 className="text-lg font-semibold text-foreground">The test that only fails on the other simulator</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The scoreboard expects the flop to capture <strong>{EXPECTED_Q}</strong> (din&apos;s value before the edge). Two runs of the same code disagree.
          </p>
        </div>
        <FidelityBadge fidelity="model" assumptions={SCHEDULER_MODEL_ASSUMPTIONS} />
      </header>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {exploration.outcomes.map((o) => {
          const pass = o.finalValues.q === EXPECTED_Q;
          return (
            <div key={o.signature} className={cn("rounded-xl border p-3 font-mono text-xs [font-variant-ligatures:none]", pass ? "border-emerald-500/40" : "border-rose-500/50")}>
              <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Run order: {o.runs[0].executionOrder.map(labelOf).join(" → ")}
              </p>
              <p className={pass ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                {pass ? "UVM_INFO  [SCB] match: q=3" : `UVM_ERROR [SCB] mismatch: expected q=3, actual q=${o.finalValues.q}`}
              </p>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1 — select the line that makes the result depend on order</p>
        <CodeTrace
          label="Suspect code"
          lines={lines}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            suspects.some((s) => s.stmtId === line.key) ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {suspect ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{found ? "Found it. " : "Not this one. "}</strong>
            {suspects.find((s) => s.stmtId === suspect)?.feedback}
          </p>
        ) : null}
        {!found ? (
          <div className="mt-2 text-sm">
            {hints < hintText.length ? (
              <button
                type="button"
                onClick={() => setHints((h) => h + 1)}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {hints === 0 ? "Need a hint?" : "Another hint"} ({hints}/{hintText.length})
              </button>
            ) : null}
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              {hintText.slice(0, hints).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2 — choose a fix; the model reruns every legal order</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {fixes.map((f) => (
              <label
                key={f.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                  fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70",
                )}
              >
                <input type="radio" name="race-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                <span className="font-mono text-[13px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          {fixResult ? (
            <div
              aria-live="polite"
              className={cn(
                "mt-3 space-y-2 rounded-xl border p-3 text-sm",
                fixResult.faithful && fixResult.fix.reviewOk ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10",
              )}
            >
              <p className="font-medium text-foreground">
                Model: {fixResult.result.deterministic ? `deterministic across ${fixResult.result.runCount} orders` : "still a race"} · flop captures{" "}
                {Array.from(new Set(fixResult.qs)).map((q) => (
                  <ValueChip key={String(q)} name="q" value={q} className="mx-0.5" />
                ))}{" "}
                {fixResult.faithful ? "✓ matches hardware" : "✕ not what hardware does"}
              </p>
              <p className="text-foreground/90">
                <strong>Review: </strong>
                {fixResult.fix.review}
              </p>
              {fixResult.fix.id === "cb" ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] text-slate-100 [font-variant-ligatures:none]">{`// The same fix inside a UVM driver
task run_phase(uvm_phase phase);
  forever begin
    seq_item_port.get_next_item(req);
    @(vif.drv_cb);
    vif.drv_cb.din <= req.data;   // lands in Re-NBA
    seq_item_port.item_done();
  end
endtask`}</pre>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </section>
  );
}
