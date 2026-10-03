"use client";

import React from "react";

import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";

interface FlowStage {
  id: "spec" | "rtl" | "netlist" | "gds" | "silicon";
  label: string;
  description: string;
}

interface Methodology {
  id: string;
  name: string;
  stage: FlowStage["id"];
  /** What the method actually executes or analyses. */
  runsOn: string;
  summary: string;
}

export const FLOW_STAGES: FlowStage[] = [
  { id: "spec", label: "Specification", description: "Requirements and architecture. Reviewed and turned into a verification plan." },
  { id: "rtl", label: "RTL", description: "The synthesizable SystemVerilog model of the design." },
  { id: "netlist", label: "Gate-level netlist", description: "Gates produced by synthesis from the RTL." },
  { id: "gds", label: "Layout (GDSII)", description: "Physical layout sent to the fab. Checked with DRC/LVS, which check layout, not function." },
  { id: "silicon", label: "Silicon", description: "Fabricated chips on a lab board." },
];

export const METHODOLOGIES: Methodology[] = [
  {
    id: "formal",
    name: "Formal property verification",
    stage: "rtl",
    runsOn: "RTL plus assertions",
    summary: "Proves that properties (assertions) hold in every reachable state of a block, with no test vectors. Limited by how fast the state space grows.",
  },
  {
    id: "simulation",
    name: "RTL simulation",
    stage: "rtl",
    runsOn: "RTL plus a testbench",
    summary: "Executes the RTL with directed and constrained-random tests. The workhorse of this course, but too slow to boot an operating system on a full chip.",
  },
  {
    id: "emulation",
    name: "Emulation / FPGA prototyping",
    stage: "rtl",
    runsOn: "RTL compiled (synthesized) onto emulator hardware or FPGAs",
    summary: "Runs the same RTL orders of magnitude faster than simulation, fast enough to run firmware and boot an OS before tape-out.",
  },
  {
    id: "gate",
    name: "Equivalence checking & gate-level simulation",
    stage: "netlist",
    runsOn: "Gate-level netlist (compared with the RTL)",
    summary: "Equivalence checking proves that the synthesized netlist matches the RTL. Gate-level simulation checks reset, X-propagation and timing-annotated behaviour.",
  },
  {
    id: "lab",
    name: "Post-silicon validation",
    stage: "silicon",
    runsOn: "Real chips in the lab",
    summary: "Runs real software at full speed on real chips to find what escaped pre-silicon verification and to characterize the part.",
  },
];

const CHECK_OPTIONS: PredictionOption[] = [
  {
    id: "formal",
    label: "Formal property verification",
    correct: false,
    feedback: "Formal proves properties of blocks. It does not execute the billions of cycles of software needed to boot an OS.",
  },
  {
    id: "simulation",
    label: "Full-chip RTL simulation",
    correct: false,
    feedback: "Simulation runs the right model, but far too slowly. Booting an OS on a full SoC would take an impractically long time.",
  },
  {
    id: "emulation",
    label: "Emulation or FPGA prototyping of the RTL",
    correct: true,
    feedback: "The emulator runs the RTL compiled into hardware, orders of magnitude faster than simulation. It is the standard way to run real software before tape-out (pre-silicon validation).",
  },
  {
    id: "lab",
    label: "Post-silicon validation in the lab",
    correct: false,
    feedback: "That needs fabricated chips, which only exist after tape-out. The requirement is to boot before tape-out.",
  },
];

/**
 * F1B: where each verification method sits in the design flow. Learner-
 * controlled tour (no autoplay), then a transfer check.
 */
const VerificationMethodologiesDiagram = () => {
  const playback = usePlayback(METHODOLOGIES.length);
  const active = METHODOLOGIES[playback.index];

  return (
    <div data-testid="verification-methodologies-diagram">
      <VisualFrame
        label="Verification methods mapped to the design flow"
        eyebrow="Choosing the right tool for the job"
        title="The verification landscape"
        summary="Step through the methods, or select one. The highlighted stage is the design representation that the method runs on."
        fidelity="illustration"
        assumptions={[
          "Simplified flow. Real projects overlap these stages and iterate.",
          "Emulation and FPGA prototyping run synthesized RTL, so they sit at the RTL stage, not the netlist stage.",
        ]}
      >
        <ol className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))]" aria-label="Design flow stages">
          {FLOW_STAGES.map((stage, i) => {
            const isActive = stage.id === active.stage;
            const count = METHODOLOGIES.filter((m) => m.stage === stage.id).length;
            return (
              <li
                key={stage.id}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "rounded-xl border p-3 text-xs transition-colors motion-reduce:transition-none",
                  isActive ? "border-cyan-500 bg-cyan-500/10" : "border-border/70 bg-background/40",
                )}
              >
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <span className="text-muted-foreground" aria-hidden>
                    {i + 1}.
                  </span>
                  {stage.label}
                </p>
                <p className="mt-1 text-muted-foreground">{stage.description}</p>
                <p className={cn("mt-2 font-medium", isActive ? "text-cyan-800 dark:text-cyan-200" : "text-muted-foreground")}>
                  {isActive ? (
                    <>
                      <span aria-hidden>▶ </span>
                      {active.name} runs here
                    </>
                  ) : count > 0 ? (
                    `${count} method${count > 1 ? "s" : ""}`
                  ) : (
                    "No functional verification here"
                  )}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]" role="group" aria-label="Verification methods">
          {METHODOLOGIES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={i === playback.index}
              onClick={() => playback.seek(i)}
              className={cn(
                "min-h-10 rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                i === playback.index ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {i === playback.index ? <span aria-hidden>▶ </span> : null}
              {m.name}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm" aria-live="polite">
          <p className="font-semibold text-foreground">{active.name}</p>
          <p className="mt-1 text-foreground">
            <strong>Runs on: </strong>
            {active.runsOn} ({FLOW_STAGES.find((s) => s.id === active.stage)?.label} stage)
          </p>
          <p className="mt-1 text-muted-foreground">{active.summary}</p>
        </div>

        <PlaybackControls
          playback={playback}
          stepCount={METHODOLOGIES.length}
          stepNoun="Method"
          describeStep={(i) => `${METHODOLOGIES[i].name}, ${FLOW_STAGES.find((s) => s.id === METHODOLOGIES[i].stage)?.label} stage`}
        />

        <PredictionPrompt
          question="Your SoC must boot Linux before tape-out. Which method gets you there?"
          options={CHECK_OPTIONS}
        />

        <p className="text-xs text-muted-foreground">
          Teams combine these methods: formal for critical control logic, simulation for most functional checking, emulation for software and long
          scenarios, equivalence checking after synthesis, and lab validation on silicon.
        </p>
      </VisualFrame>
    </div>
  );
};

export default VerificationMethodologiesDiagram;
