"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { PROCESS_MODEL_ASSUMPTIONS, ProcessTraceView, linesFor } from "@/components/visuals/ForkJoinVisualizer";
import { prepareScenario, simulateProcesses } from "@/lib/sv-process-model";

import { getProceduralScenario, proceduralScenarios, type AssignStyle, type ProceduralScenarioId } from "./procedural-blocks-data";

interface ProceduralBlocksSimulatorProps {
  scenario?: ProceduralScenarioId;
}

/**
 * initial, always and final procedures over simulation time, run on the
 * process model. The code is generated from the model data and is read-only:
 * learners change behaviour through the explicit controls, not by editing.
 */
const ProceduralBlocksSimulator = ({ scenario: initial = "procedures" }: ProceduralBlocksSimulatorProps) => {
  const [scenarioId, setScenarioId] = useState<ProceduralScenarioId>(initial);
  const [style, setStyle] = useState<AssignStyle>("nba");
  const preset = getProceduralScenario(scenarioId);
  const scenario = useMemo(() => preset.build(style), [preset, style]);
  const prepared = useMemo(() => prepareScenario(scenario), [scenario]);
  const result = useMemo(() => simulateProcesses(scenario), [scenario]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const resetKey = `${scenarioId}:${preset.styleToggle ? style : ""}`;

  return (
    <VisualFrame
      label="Procedural blocks simulator"
      eyebrow="Procedures over time"
      title="initial, always and final across simulation time"
      summary="Pick a program, predict its output, then step through it. Lanes show each procedure over simulation time; the region badge shows where in a time step each update lands."
      fidelity="model"
      assumptions={[
        ...PROCESS_MODEL_ASSUMPTIONS,
        "Within one time step the model shows the Active, NBA and Postponed regions only; F3C's ladder covers all regions.",
      ]}
    >
      <SegmentedControl
        label="Program"
        value={scenarioId}
        onChange={(id) => {
          setScenarioId(id);
          setStyle("nba");
        }}
        options={proceduralScenarios.map((s) => ({ value: s.id, label: s.label }))}
      />
      <p className="text-sm text-muted-foreground">{preset.summary}</p>
      {preset.styleToggle ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assignments</span>
          <SegmentedControl
            label="Assignment style"
            mono
            value={style}
            onChange={setStyle}
            options={[
              { value: "nba", label: "a <= b; b <= a;", ariaLabel: "Nonblocking assignments" },
              { value: "blocking", label: "a = b; b = a;", ariaLabel: "Blocking assignments" },
            ]}
          />
        </div>
      ) : null}
      <CodeTrace label="Code (read-only, generated from the model)" lines={lines} />
      <PredictionPrompt
        resetKey={resetKey}
        question={preset.question}
        options={preset.options.map((o) => ({ id: o.id, label: o.label, correct: o.matches(result), feedback: o.feedback(style) }))}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>What to notice: </strong>
            {preset.notice}
          </p>
          <ProcessTraceView prepared={prepared} result={result} resetKey={resetKey} watch={scenario.vars?.map((d) => d.name)} />
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
};

export default ProceduralBlocksSimulator;
