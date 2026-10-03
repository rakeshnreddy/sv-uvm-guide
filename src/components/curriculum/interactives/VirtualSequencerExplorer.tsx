"use client";

import React, { useMemo, useState } from "react";

import { UvmLog } from "@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { runVirtualSequence, vseqBodySource, type VseqDispatch, type VseqRun } from "@/lib/uvm-sequencer-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Each agent's timeline comes from the sequencer model: config items take 20 ns each (2 items), data items 10 ns each (3 items).",
  "The test raises an objection, calls vseq.start(env.vsqr), and drops the objection when start() returns. No drain time.",
  "start() is a blocking task: it returns when the child's body() has finished.",
];

const DISPATCH_LABEL: Record<VseqDispatch, string> = {
  ordered: "one after another",
  fork_join: "fork … join",
  fork_join_none: "fork … join_none",
};

type AnswerId = "zero" | "after" | "never" | "fatal";

function correctAnswer(run: VseqRun): AnswerId {
  if (run.outcome.kind === "fatal") return "fatal";
  if (run.outcome.kind === "killed") return "never";
  return run.firstDataAt === 0 ? "zero" : "after";
}

function buildOptions(dispatch: VseqDispatch, assigned: boolean, run: VseqRun): PredictionOption[] {
  const right = correctAnswer(run);
  const cfgDone = 40;
  const fb: Record<AnswerId, string> = {
    zero:
      right === "zero"
        ? "fork starts both branches at the same time; join only waits for both to finish. The data driver gets D1 at 0 ns while the configuration is still being written."
        : dispatch === "ordered"
          ? "Without fork, d.start() is not reached until c.start() returns: start() blocks until the child's body() is done."
          : "Both children would start at 0 ns, but something ends the run before D1 is driven.",
    after:
      right === "after"
        ? `c.start() blocks until cfg_seq has sent its last item (t = ${cfgDone} ns). Only then does body() reach d.start().`
        : dispatch === "ordered"
          ? "That is what this order intends, but the run never gets that far."
          : "That is the sequential version. fork does not order its branches; it runs them at the same time.",
    never:
      right === "never"
        ? "join_none returns at once, so body() and vseq.start() return at 0 ns and the test drops its objection. Use join, or wait fork before body() ends."
        : "vseq.start() blocks until body() returns, and with join (or no fork) body() waits for the children, so the test stays alive.",
    fatal:
      right === "fatal"
        ? "p_sequencer.data_sqr is null, so data_seq runs with no sequencer and its start_item() is UVM_FATAL [SEQ]. Assign the handle in env.connect_phase."
        : assigned
          ? "The env assigns vsqr.data_sqr in connect_phase, so p_sequencer.data_sqr is a valid sequencer."
          : "The handle is null, but this dispatch ends the run before data_seq calls start_item().",
  };
  return [
    { id: "zero", label: "t = 0 ns, in parallel with the first config item", correct: right === "zero", feedback: fb.zero },
    { id: "after", label: `t = ${cfgDone} ns, right after cfg_seq returns`, correct: right === "after", feedback: fb.after },
    { id: "never", label: "Never: the test ends before any data item is driven", correct: right === "never", feedback: fb.never },
    { id: "fatal", label: "Never: data_seq hits a UVM_FATAL", correct: right === "fatal", feedback: fb.fatal },
  ];
}

function envSource(assigned: boolean): CodeTraceLine[] {
  return [
    { text: "// env.connect_phase", owner: "testbench" },
    { text: "vsqr.cfg_sqr  = cfg_agt.sqr;" },
    { text: assigned ? "vsqr.data_sqr = data_agt.sqr;" : "// vsqr.data_sqr = data_agt.sqr;   <- forgotten", key: "assign" },
    { text: "" },
    { text: "// test.run_phase" },
    { text: "phase.raise_objection(this);" },
    { text: "vseq.start(env.vsqr);   // blocks until body() returns" },
    { text: "phase.drop_objection(this);" },
  ];
}

function Timeline({ run }: { run: VseqRun }) {
  const W = 640;
  const left = 92;
  const maxT = Math.max(70, run.endOfTest, run.cfgDoneAt ?? 0);
  const x = (t: number) => left + ((W - left - 14) * t) / maxT;
  const rows: { id: "vseq" | "cfg" | "data"; label: string }[] = [
    { id: "vseq", label: "soc_vseq" },
    { id: "cfg", label: "cfg_sqr/drv" },
    { id: "data", label: "data_sqr/drv" },
  ];
  const rowH = 34;
  const H = rows.length * rowH + 44;
  const ticks = Array.from({ length: Math.floor(maxT / 10) + 1 }, (_, i) => i * 10);
  const endLabel = run.outcome.kind === "fatal" ? "UVM_FATAL" : "test ends";
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50 p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[300px]"
        role="img"
        aria-label={`Timeline: ${run.bars.map((b) => `${b.label} from ${b.start} to ${b.end} ns`).join("; ") || "no items driven"}. ${run.outcome.summary}`}
      >
        {rows.map((r, i) => {
          const y = 8 + i * rowH;
          return (
            <g key={r.id}>
              <text x={6} y={y + 20} className="fill-foreground font-mono text-[10.5px] font-semibold">
                {r.label}
              </text>
              <line x1={left} x2={W - 14} y1={y + rowH - 4} y2={y + rowH - 4} className="stroke-border" strokeWidth={0.6} />
              {r.id === "vseq" ? (
                run.vseqReturnsAt > 0 ? (
                  <rect x={x(0)} y={y + 9} width={x(run.vseqReturnsAt) - x(0)} height={14} rx={4} className="fill-amber-500/20 stroke-amber-500" />
                ) : (
                  <text x={x(0) + 4} y={y + 20} className="fill-amber-700 text-[10px] dark:fill-amber-300">
                    body() returned at 0 ns
                  </text>
                )
              ) : (
                run.bars
                  .filter((b) => b.lane === r.id)
                  .map((b) => (
                    <g key={b.label}>
                      <rect x={x(b.start) + 0.5} y={y + 9} width={Math.max(2, x(b.end) - x(b.start) - 1)} height={14} rx={3} className={r.id === "cfg" ? "fill-violet-500/70" : "fill-cyan-500/70"} />
                      <text x={(x(b.start) + x(b.end)) / 2} y={y + 19.5} textAnchor="middle" className="fill-slate-950 font-mono text-[9.5px] font-bold">
                        {b.label}
                      </text>
                    </g>
                  ))
              )}
            </g>
          );
        })}
        {run.cfgDoneAt !== undefined ? (
          <g>
            <line x1={x(run.cfgDoneAt)} x2={x(run.cfgDoneAt)} y1={4} y2={rows.length * rowH + 8} className="stroke-violet-500" strokeDasharray="4 3" />
            <text x={x(run.cfgDoneAt) + 3} y={rows.length * rowH + 4} className="fill-violet-700 text-[9px] dark:fill-violet-300">
              config done
            </text>
          </g>
        ) : null}
        <line x1={x(run.endOfTest)} x2={x(run.endOfTest)} y1={4} y2={rows.length * rowH + 8} className="stroke-rose-500" strokeWidth={1.5} />
        <text x={x(run.endOfTest) + 3} y={14} className="fill-rose-700 text-[9px] font-bold dark:fill-rose-300">
          {endLabel}
        </text>
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={rows.length * rowH + 22} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {t}
          </text>
        ))}
        <text x={W - 14} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[9px]">
          t (ns) · C = config item · D = data item
        </text>
      </svg>
    </div>
  );
}

/**
 * Virtual sequence dispatch on two agent sequencers: ordered vs fork…join vs
 * fork…join_none, and a missing p_sequencer handle. Timelines come from the
 * sequencer model.
 */
export default function VirtualSequencerExplorer() {
  const [dispatch, setDispatch] = useState<VseqDispatch>("fork_join");
  const [assigned, setAssigned] = useState(true);
  const run = useMemo(() => runVirtualSequence({ dispatch, dataHandleAssigned: assigned }), [dispatch, assigned]);
  const options = useMemo(() => buildOptions(dispatch, assigned, run), [dispatch, assigned, run]);
  const body: CodeTraceLine[] = useMemo(() => vseqBodySource(dispatch).map((l) => ({ ...l, owner: "testbench" as const })), [dispatch]);

  return (
    <VisualFrame
      label="Virtual sequence dispatch explorer"
      eyebrow="Experiment"
      title="Ordered, fork…join, or join_none?"
      summary="The DUT must be configured (cfg_seq on the config agent) before data arrives (data_seq on the data agent). Choose how soc_vseq starts them, predict, then check the timeline."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <SegmentedControl
        label="How soc_vseq.body() starts the two sequences"
        mono
        options={(Object.keys(DISPATCH_LABEL) as VseqDispatch[]).map((d) => ({ value: d, label: DISPATCH_LABEL[d] }))}
        value={dispatch}
        onChange={setDispatch}
      />
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-cyan-500" checked={assigned} onChange={(e) => setAssigned(e.target.checked)} />
        env.connect_phase assigns <code className="font-mono [font-variant-ligatures:none]">vsqr.data_sqr</code>
      </label>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace label="soc_vseq" lines={body} className="min-w-0" />
        <CodeTrace label="Wiring and test" lines={envSource(assigned)} activeKey={assigned ? undefined : "assign"} className="min-w-0" />
      </div>

      <PredictionPrompt question="When does the first data item (D1) reach the data driver?" options={options} resetKey={`${dispatch}:${assigned}`}>
        <div className="space-y-3">
          <p
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              run.outcome.kind === "ok"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
            )}
          >
            {run.outcome.kind === "ok" ? "✓ " : "✕ "}
            {run.outcome.summary}
          </p>
          <Timeline run={run} />
          <ol className="space-y-1 text-sm" aria-label="What happens, in time order">
            {run.events.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">t = {e.time}</span>
                <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{e.lane}</span>
                <span className="min-w-0 text-foreground">{e.what}</span>
              </li>
            ))}
          </ol>
          {run.log.length > 0 ? <UvmLog lines={run.log} /> : null}
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
