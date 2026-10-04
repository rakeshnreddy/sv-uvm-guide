"use client";

import React, { useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  COMMON_PHASES,
  RUNTIME_PHASE_NAMES,
  containerNodeName,
  customPhaseSource,
  insertCustomPhase,
  type CustomPhaseInsert,
  type InsertResult,
  type InsertTarget,
  type ScheduleStep,
} from "@/lib/uvm-phase-model";
import { cn } from "@/lib/utils";

export const METHODOLOGY_PHASE_ASSUMPTIONS = [
  "Model of uvm_phase::add() in uvm-core 2020.3.1 (IEEE 1800.2-2020 §9.3.1.6.1): anchors are looked up with find(..., stay_in_scope=1).",
  "The common domain holds build … final; the uvm domain holds one schedule, uvm_sched, with the 12 runtime phases, and runs beside run_phase.",
  "All components are in the default uvm domain. Phase jumps and user-defined domains are not modelled.",
  "Derived from reading the library source, not from a simulator run.",
];

const PHASE_NAME = "load_fw";

type PositionId = "after-reset" | "reset-to-configure" | "with-main" | "after-extract";

const POSITIONS: { id: PositionId; label: string; spec: Pick<CustomPhaseInsert, "after" | "before" | "with"> }[] = [
  { id: "after-reset", label: ".after_phase(reset)", spec: { after: "reset" } },
  { id: "reset-to-configure", label: ".after_phase(reset), .before_phase(configure)", spec: { after: "reset", before: "configure" } },
  { id: "with-main", label: ".with_phase(main)", spec: { with: "main" } },
  { id: "after-extract", label: ".after_phase(extract)", spec: { after: "extract" } },
];

type Answer = "fatal" | "serial" | "parallel" | "silent";

const ANSWERS: { id: Answer; label: string; feedback: string }[] = [
  {
    id: "fatal",
    label: "Nowhere: add() fails with UVM_FATAL [PH_BAD_ADD] during build_phase.",
    feedback:
      "add() looks for the anchor only inside the schedule or domain you call it on. The common domain cannot see reset or configure (they live in uvm_sched), and the uvm schedule cannot see extract.",
  },
  {
    id: "serial",
    label: "In its own slot between two neighbours, for every component.",
    feedback: "With only after_phase (or an after/before pair that are neighbours), add() splices the phase into the chain: the next phase waits for it.",
  },
  {
    id: "parallel",
    label: "In a parallel branch, beside other phases.",
    feedback: "with_phase, or an after/before pair with phases between them, creates a branch that runs alongside those phases and rejoins at the successor.",
  },
  {
    id: "silent",
    label: "The phase exists, but soc_env's load_fw_phase task is never called.",
    feedback: "The phasing engine calls exec_task(comp, phase) for each component. The inherited exec_task is empty, so without an override no component code runs.",
  },
];

export function classifyInsert(result: InsertResult): Answer {
  if (!result.ok) return "fatal";
  if (!result.componentMethodCalled) return "silent";
  return result.steps.some((s) => s.kind === "parallel") ? "parallel" : "serial";
}

function ScheduleView({ title, steps, highlight }: { title: string; steps: ScheduleStep[]; highlight: boolean }) {
  const chip = (name: string, custom: boolean) => (
    <span
      key={name}
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2 py-0.5 font-mono text-[11px] [font-variant-ligatures:none]",
        custom ? "border-violet-500 bg-violet-500/15 font-semibold text-violet-900 dark:text-violet-100" : "border-border/70 bg-card text-foreground",
      )}
    >
      {custom ? "✚ " : ""}
      {name}
    </span>
  );
  return (
    <div className={cn("rounded-xl border p-3", highlight ? "border-cyan-500/60" : "border-border/70")}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <ol className="flex flex-wrap items-center gap-1.5" aria-label={`${title} in execution order`}>
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {s.kind === "phase" ? (
              chip(s.name, Boolean(s.custom))
            ) : (
              <span className="inline-flex flex-col gap-1 rounded-lg border border-dashed border-violet-500/60 p-1" aria-label="parallel branch">
                {s.lanes.map((lane, j) => (
                  <span key={j} className="flex flex-wrap items-center gap-1">
                    <span aria-hidden className="text-[10px] text-muted-foreground">
                      ∥
                    </span>
                    {lane.map((n) => chip(n, n === s.custom))}
                  </span>
                ))}
              </span>
            )}
            {i < steps.length - 1 ? (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

const baseSteps = (names: string[]): ScheduleStep[] => names.map((name) => ({ kind: "phase", name }));

export default function MethodologyPhaseVisualizer() {
  const [target, setTarget] = useState<InsertTarget>("common");
  const [positionId, setPositionId] = useState<PositionId>("after-reset");
  const [execTask, setExecTask] = useState(true);
  const position = POSITIONS.find((p) => p.id === positionId) ?? POSITIONS[0];
  const spec: CustomPhaseInsert = { name: PHASE_NAME, target, implementsExecTask: execTask, ...position.spec };
  const key = `${target}|${positionId}|${execTask}`;
  const result = insertCustomPhase(spec);
  const answer = classifyInsert(result);
  const options: PredictionOption[] = ANSWERS.map((a) => ({ ...a, correct: a.id === answer }));

  const sourceLines: CodeTraceLine[] = customPhaseSource(spec)
    .split("\n")
    .map((text) => ({ text, owner: "testbench" as const, key: text.includes("exec_task") && text.includes("virtual") ? "exec" : text.startsWith("  // no exec_task") ? "exec" : undefined }));

  const commonSteps = target === "common" && result.ok ? result.steps : baseSteps(COMMON_PHASES.map((p) => p.name));
  const schedSteps = target === "uvm_sched" && result.ok ? result.steps : baseSteps([...RUNTIME_PHASE_NAMES]);

  return (
    <VisualFrame
      label="Custom phase insertion explorer"
      eyebrow="Experiment"
      title="Insert a custom phase: domain, schedule and exec_task"
      summary="A custom task phase needs the right container (the common domain or the uvm schedule), an anchor that lives in that container, and an exec_task that calls your component."
      fidelity="model"
      assumptions={METHODOLOGY_PHASE_ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Add to</p>
          <SegmentedControl
            label="Add to"
            mono
            value={target}
            onChange={setTarget}
            options={[
              { value: "common", label: "get_common_domain()" },
              { value: "uvm_sched", label: "get_uvm_schedule()" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Position</p>
          <SegmentedControl label="Position" mono value={positionId} onChange={setPositionId} options={POSITIONS.map((p) => ({ value: p.id, label: p.label }))} />
        </div>
      </div>

      <CodeTrace
        label="Phase class and registration (generated from your choices)"
        lines={sourceLines}
        renderLineControl={(line) =>
          line.key === "exec" ? (
            <button
              type="button"
              onClick={() => setExecTask((v) => !v)}
              aria-label={execTask ? "Remove the exec_task override" : "Add the exec_task override"}
              className="min-h-7 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [font-variant-ligatures:none]"
            >
              {execTask ? "remove exec_task" : "add exec_task"}
            </button>
          ) : null
        }
      />

      <PredictionPrompt question="Run the test. Where does load_fw run, and is soc_env's load_fw_phase task called?" options={options} resetKey={key}>
        <div className="space-y-3">
          {result.fatal ? (
            <p aria-live="polite" className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 font-mono text-[12px] text-rose-800 [font-variant-ligatures:none] dark:text-rose-200">
              ✕ UVM_FATAL [{result.fatal.id}] {result.fatal.message}
            </p>
          ) : (
            <p aria-live="polite" className="text-sm text-foreground">
              <strong>{result.componentMethodCalled ? "✓ load_fw runs for every component. " : "! load_fw runs, but calls nothing. "}</strong>
              Added to node &apos;{containerNodeName(target)}&apos;.
            </p>
          )}
          <ScheduleView title="Common domain (build … final)" steps={commonSteps} highlight={target === "common"} />
          <ScheduleView title="uvm domain · schedule uvm_sched (runs beside run_phase)" steps={schedSteps} highlight={target === "uvm_sched"} />
          {result.notes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
            {`// soc_env: the method exec_task calls
task load_fw_phase(uvm_phase phase);
  phase.raise_objection(this);
  // backdoor-load the firmware image
  phase.drop_objection(this);
endtask`}
          </pre>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
