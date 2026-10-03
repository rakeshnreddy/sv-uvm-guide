"use client";

import React, { useMemo, useState } from "react";

import {
  BlockDiagram,
  CodeTrace,
  PredictionPrompt,
  SegmentedControl,
  VisualFrame,
  type DiagramEdge,
  type DiagramNode,
  type PredictionOption,
} from "@/components/visual-system";
import {
  PSS_SCENARIOS,
  SCOREBOARD_LINES,
  generateTarget,
  pssSourceLines,
  resolveScenario,
  type PssOutcome,
  type PssResolution,
  type PssScenarioId,
  type TargetLang,
} from "@/lib/pss-scenario-model";

const ASSUMPTIONS = [
  "Language: the Accellera Portable Test and Stimulus Standard (PSS 2.x). PSS is an Accellera standard, not an IEEE one.",
  "Three rules are modelled: a buffer input binds to an output of an action that completes first; a missing producer is inferred; actions in parallel { } that lock a resource need distinct pool instances.",
  "Where a real tool may choose freely (which legal producer to infer, the random values), this model picks deterministically.",
  "Generated code is illustrative: the exec body templates expanded in schedule order. Real tools add their own runtime glue and file layout.",
];

type OptionId = PssOutcome | "unbound";

const OPTION_LABELS: Record<OptionId, string> = {
  as_written: "It runs exactly the actions the activity traverses, in activity order.",
  inferred: "It adds producer actions so every buffer input is written by an action that completes first, then runs the scenario.",
  infeasible: "It reports a solve-time error: no legal schedule exists.",
  unbound: "It runs the traversed actions and leaves any unbound input fields random.",
};

function predictionOptions(res: PssResolution): PredictionOption[] {
  const inferred = res.instances.find((i) => i.inferred);
  const bound = res.instances.find((i) => !i.inferred && Object.keys(i.boundFrom).length > 0);
  const why: Record<PssOutcome, string> = {
    as_written: bound ? `${bound.why}` : res.notes.join(" "),
    inferred: inferred ? inferred.why : res.notes.join(" "),
    infeasible: res.error ?? "",
  };
  const wrong: Record<OptionId, string> = {
    as_written:
      res.outcome === "inferred"
        ? `Something the activity never mentions has to run first. ${why.inferred}`
        : `The tool cannot run this as written. ${why.infeasible}`,
    inferred:
      res.outcome === "as_written"
        ? `Nothing needs adding: the traversed write_a already produces the buffer and completes before the read. ${why.as_written}`
        : `Inference can add actions, but it cannot add resource instances: chan_p's size is fixed by its declaration. ${why.infeasible}`,
    infeasible: `A legal schedule exists. ${res.outcome === "inferred" ? why.inferred : why.as_written}`,
    unbound: "A buffer input is never left dangling: it is bound to a producer's output (inferred if necessary), so the consumer reads exactly the values the producer wrote.",
  };
  return (Object.keys(OPTION_LABELS) as OptionId[]).map((id) => {
    const correct = id === res.outcome;
    return { id, label: OPTION_LABELS[id], correct, feedback: correct ? why[res.outcome] : wrong[id] };
  });
}

const COL_W = 196;
const NODE_W = 120;
const ROW_H = 78;

/** Lane per instance: parallel branches get their index; an inferred producer sits in its consumer's lane. */
function lanes(res: PssResolution): Map<string, number> {
  const lane = new Map<string, number>();
  for (const slot of res.slots) if (slot.length > 1) slot.forEach((inst, i) => lane.set(inst.id, i));
  for (const slot of res.slots) {
    if (slot.length !== 1) continue;
    const inst = slot[0];
    const consumer = res.instances.find((c) => Object.values(c.boundFrom).some((from) => from.startsWith(`${inst.id}.`)));
    lane.set(inst.id, consumer ? lane.get(consumer.id) ?? 0 : 0);
  }
  return lane;
}

function scheduleDiagram(res: PssResolution) {
  const laneOf = lanes(res);
  const laneCount = Math.max(1, ...Array.from(laneOf.values()).map((l) => l + 1));
  const nodes: DiagramNode[] = res.instances.map((inst) => ({
    id: inst.id,
    label: inst.id,
    sublabel: inst.chan !== undefined ? `locks chan ${inst.chan}` : inst.action === "read_check_a" ? "reads back" : "produces buffer",
    kind: "generic" as const,
    x: 12 + inst.slot * COL_W,
    y: 14 + (laneOf.get(inst.id) ?? 0) * ROW_H,
    w: NODE_W,
    h: 52,
    badge: inst.inferred ? "inferred" : undefined,
    state: inst.inferred ? ("active" as const) : ("normal" as const),
  }));
  const edges: DiagramEdge[] = res.instances.flatMap((inst) =>
    Object.entries(inst.boundFrom).map(([field, from]) => ({
      id: `${from}->${inst.id}.${field}`,
      from: from.split(".")[0],
      to: inst.id,
      style: "data" as const,
      label: "mem_buf_s",
    })),
  );
  return { nodes, edges, width: Math.max(320, 24 + (res.slots.length - 1) * COL_W + NODE_W), height: laneCount * ROW_H + 10 };
}

export function PssIntentMapVisualizer() {
  const [scenarioId, setScenarioId] = useState<PssScenarioId>("raw");
  const [target, setTarget] = useState<TargetLang>("C");
  const scenario = PSS_SCENARIOS[scenarioId];
  const res = useMemo(() => resolveScenario(scenario), [scenario]);
  const options = useMemo(() => predictionOptions(res), [res]);
  const source = useMemo(() => pssSourceLines(scenario).map((l) => ({ ...l, owner: "testbench" as const })), [scenario]);
  const diagram = useMemo(() => (res.feasible ? scheduleDiagram(res) : null), [res]);
  const code = useMemo(() => generateTarget(res, target), [res, target]);

  return (
    <VisualFrame
      label="PSS intent map"
      eyebrow="Model"
      title="One PSS model, two targets: what the tool adds, and what it emits"
      summary="Read the PSS source, predict what a PSS tool does with the activity, then compare the C and UVM realisations of the same resolved scenario."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <SegmentedControl
        label="Scenario"
        value={scenarioId}
        onChange={setScenarioId}
        options={(Object.keys(PSS_SCENARIOS) as PssScenarioId[]).map((id) => ({ value: id, label: PSS_SCENARIOS[id].title }))}
      />
      <CodeTrace label="mem_test.pss (Accellera PSS)" lines={source} activeKey="activity" contextKeys={["activity", "pool"]} />

      <PredictionPrompt resetKey={scenarioId} question={`What does a PSS tool do with ${scenario.topAction}'s activity?`} options={options}>
        <div className="space-y-4">
          <section aria-label="Resolved scenario" className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Resolved scenario</h4>
            {res.feasible && diagram ? (
              <>
                <BlockDiagram title={`Resolved schedule for ${scenario.topAction}: ${res.instances.map((i) => `${i.id}${i.inferred ? " inferred" : ""}`).join(", ")}`} {...diagram} minWidth={300} />
                <p className="text-[11px] text-muted-foreground">
                  Columns run left to right in time; boxes in the same column run in parallel. Solid arrows carry a mem_buf_s from producer to consumer. Highlighted boxes tagged INFERRED were added by the tool.
                </p>
              </>
            ) : (
              <p role="alert" className="rounded-lg border border-rose-500/50 bg-rose-500/5 p-3 text-sm text-rose-800 dark:text-rose-200">
                <span aria-hidden className="mr-1 font-bold">✕</span>
                {res.error}
              </p>
            )}
            <ol aria-label="Why each action is in the schedule" className="space-y-1 text-sm" aria-live="polite">
              {res.instances.map((inst) => (
                <li key={inst.id} className="rounded-md border border-border/60 bg-background/50 px-3 py-2">
                  <code className="font-mono [font-variant-ligatures:none]">{inst.id}</code>
                  {inst.inferred ? <span className="ml-2 rounded border border-dashed border-cyan-500 px-1 text-[10px] font-bold uppercase">inferred</span> : null}
                  <span className="text-muted-foreground"> — {inst.why}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Generated target code" className="space-y-2">
            <SegmentedControl
              label="Target"
              value={target}
              onChange={setTarget}
              options={[
                { value: "C", label: "C on the embedded core" },
                { value: "SV", label: "SystemVerilog / UVM simulation" },
              ]}
            />
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
              <pre data-testid="generated-code" className="min-w-0 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                <code>{code.join("\n")}</code>
              </pre>
              {target === "SV" ? (
                <div className="min-w-0 space-y-2 text-sm">
                  <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                    <code>{SCOREBOARD_LINES.join("\n")}</code>
                  </pre>
                  <p className="text-muted-foreground">
                    The UVM target only starts sequences. Checking stays in the scoreboard, which compares every monitored read with its reference memory, including reads that other sequences start. A compare inside a sequence would duplicate that check and miss traffic it did not start.
                  </p>
                </div>
              ) : (
                <p className="min-w-0 text-sm text-muted-foreground">
                  There is no scoreboard on a bare-metal core, so read_check_a&apos;s C template checks inline and calls test_fail(). Same schedule, same bindings, same solved values; only the exec bodies differ.
                </p>
              )}
            </div>
          </section>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}

export default PssIntentMapVisualizer;
