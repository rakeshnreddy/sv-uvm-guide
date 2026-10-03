"use client";

import React, { useMemo } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { FidelityBadge } from "@/components/visual-system/FidelityBadge";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { exploreOrderings, simulateTimeSlot, type RegionId } from "@/lib/sv-scheduler-model";
import { testbenchDriveScenario } from "@/lib/sv-scheduler-scenarios";
import { cn } from "@/lib/utils";

import { RegionStrip, type RegionMark } from "./scheduler/RegionStrip";
import { codeLinesFor } from "./scheduler/scheduler-view-helpers";
import { SCHEDULER_MODEL_ASSUMPTIONS } from "./TimeSlotTraceVisualizer";

const styles = [
  { id: "blocking" as const, title: "din = 7", note: "Writes in Active, the same region where the DUT flop reads din." },
  { id: "nba" as const, title: "din <= 7", note: "Reads in Active, write lands in NBA — after every flop has read." },
  { id: "clocking" as const, title: "cb.din <= 7", note: "The driver waits on @(cb), which triggers in Observed — after the flop's NBA update. Its write lands in Re-NBA; cb.q still returns the Preponed sample." },
];

function analyse(style: (typeof styles)[number]["id"]) {
  const scenario = testbenchDriveScenario(style);
  const exploration = exploreOrderings(scenario);
  const run = simulateTimeSlot(scenario, [0]);
  const readStep = run.trace.find((s) => s.stmtId === "dut1");
  const writeStep = run.trace.find((s) => s.changed.includes("din"));
  const marks: RegionMark[] = [];
  if (readStep) marks.push({ region: readStep.region, kind: "read", label: "q<=din" });
  if (writeStep) marks.push({ region: (writeStep.sourceRegion ?? writeStep.region) as RegionId, kind: "write", label: "din" });
  return { scenario, exploration, marks, lines: codeLinesFor(scenario) };
}

/**
 * Three ways a testbench can drive a DUT input on the clock edge, each run
 * through every legal process order by the scheduler model.
 */
export default function TestbenchDriveComparison() {
  const results = useMemo(() => styles.map((s) => ({ ...s, ...analyse(s.id) })), []);

  return (
    <section aria-label="Testbench drive comparison" className="not-prose my-8 space-y-4 rounded-2xl border border-border/70 bg-card/40 p-3 sm:p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Compare</p>
          <h3 className="text-lg font-semibold text-foreground">Three ways to drive a DUT input at the clock edge</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Before the edge, <code className="font-mono">din = 3</code> and <code className="font-mono">q = 1</code>. On the edge the DUT runs{" "}
            <code className="font-mono">q &lt;= din</code> while the testbench drives 7 and reads <code className="font-mono">q</code> into{" "}
            <code className="font-mono">seen</code>.
          </p>
        </div>
        <FidelityBadge fidelity="model" assumptions={SCHEDULER_MODEL_ASSUMPTIONS} />
      </header>

      <PredictionPrompt
        question="Which driving styles make the flop capture 3 (the pre-edge value) in every legal process order?"
        options={[
          {
            id: "cb-only",
            label: "Only the clocking block",
            correct: false,
            feedback: "A plain <= from the testbench also works: its write lands in NBA, after the DUT has already read din in Active. Clocking blocks add more (Preponed sampling for monitors, skew control, one place to define timing).",
          },
          {
            id: "nba-cb",
            label: (
              <>
                <code className="font-mono [font-variant-ligatures:none]">&lt;=</code> and the clocking block
              </>
            ),
            correct: true,
            feedback: "Both defer the write past the Active region where the DUT reads din, so no order can let the flop see 7 early.",
          },
          {
            id: "all",
            label: "All three",
            correct: false,
            feedback: "din = 7 writes in Active, the same region where the flop reads din. If the testbench happens to run first, the flop captures 7 — a race.",
          },
          {
            id: "blocking",
            label: (
              <>
                Only <code className="font-mono">din = 7</code>
              </>
            ),
            correct: false,
            feedback: "Blocking writes are the problem, not the fix: they become visible immediately to any process that runs later in the same region.",
          },
        ]}
      >
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))]">
          {results.map((r) => {
            const qValues = r.exploration.outcomes.map((o) => o.finalValues.q);
            const seenValues = Array.from(new Set(r.exploration.outcomes.map((o) => o.finalValues.seen)));
            return (
              <article
                key={r.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-3",
                  r.exploration.deterministic ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-rose-500/50 bg-rose-500/[0.06]",
                )}
              >
                <header className="flex items-center justify-between gap-2">
                  <h4 className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{r.title}</h4>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      r.exploration.deterministic ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" : "bg-rose-500/20 text-rose-800 dark:text-rose-200",
                    )}
                  >
                    {r.exploration.deterministic ? "✓ deterministic" : "⚠ race"}
                  </span>
                </header>
                <CodeTrace label={`${r.title} bench`} lines={r.lines} contextKeys={["tb1", "dut1"]} className="text-[12px]" />
                <RegionStrip marks={r.marks} />
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flop captures</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {qValues.map((v, i) => (
                      <ValueChip key={i} name="q" value={v} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testbench read of q</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {seenValues.map((v, i) => (
                      <ValueChip key={i} name="seen" value={v} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{r.note}</p>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Notice the testbench read: with plain <code className="font-mono">q</code> it reads in Active before the DUT's NBA update, so it sees the{" "}
          <em>old</em> q — deterministic here only because the DUT uses <code className="font-mono">&lt;=</code>. Through{" "}
          <code className="font-mono">cb.q</code> it reads the Preponed sample, which stays correct even if the design were written with blocking assignments.
        </p>
      </PredictionPrompt>
    </section>
  );
}
