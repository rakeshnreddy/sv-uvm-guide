"use client";

import React, { useEffect, useMemo, useState } from "react";

import { CycleWaveform, type CycleHighlight, type CycleMarker, type CycleSignal, type MarkerTone } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  evaluateProperty,
  focusEdge,
  outcomeLabel,
  plainText,
  scenarioTrace,
  splitInlineCode,
  statusGlyph,
  temporalFamilies,
  type AttemptStatus,
  type BitRow,
  type SvaAttempt,
  type SvaEvaluation,
} from "@/lib/sva-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "One clock: column k is the value sampled at posedge clk edge k (Preponed, §16.5.1). Edges are cycle time, not ns.",
  "Results come from the same tested evaluator as the SVA trace lab (sva-model): implication §16.12.7, repetition §16.9.2, throughout §16.9.9, within §16.9.10.",
  "The trace is finite: an attempt still waiting at the last edge is pending, not failed (weak sequences in assert property, §16.12.2).",
];

const tone: Record<AttemptStatus, MarkerTone> = { PASS: "pass", FAIL: "fail", VACUOUS: "vacuous", PENDING: "pending", DISABLED: "info" };

const resultClass: Record<AttemptStatus, string> = {
  PASS: "border-emerald-500/60 bg-emerald-500/10",
  FAIL: "border-rose-500/60 bg-rose-500/10",
  VACUOUS: "border-dashed border-slate-400/70",
  PENDING: "border-amber-500/60 bg-amber-500/10",
  DISABLED: "border-sky-500/60 bg-sky-500/10",
};

function Rich({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, i) =>
        part.code ? (
          <code key={i} className="font-mono text-[0.92em] [font-variant-ligatures:none]">
            {part.text}
          </code>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Tells the parent when the prediction gate has opened (it mounts only after reveal). */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

const cloneRows = (rows: Record<string, BitRow>) => Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, [...v]])) as Record<string, BitRow>;

/**
 * Compare temporal operators on one editable trace: the learner predicts what
 * the selected operator reports for one attempt, then sees every operator in
 * the family side by side. Results come from `sva-model`.
 */
export default function TemporalLogicExplorer() {
  const [familyId, setFamilyId] = useState(temporalFamilies[0].id);
  const family = temporalFamilies.find((f) => f.id === familyId) ?? temporalFamilies[0];
  const [opIndex, setOpIndex] = useState("0");
  const [rows, setRows] = useState<Record<string, BitRow>>(() => cloneRows(temporalFamilies[0].rows));
  const [revealed, setRevealed] = useState(false);

  const trace = useMemo(() => scenarioTrace({ rows }), [rows]);
  const k = focusEdge(family, trace);
  const evaluations = useMemo(
    () =>
      family.operators.map((op) => {
        const result = evaluateProperty(op.property, trace);
        if (!result.ok) throw new Error(`Operator family ${family.id}: ${result.error.message}`);
        return result.evaluation;
      }),
    [family, trace],
  );
  const index = Number(opIndex);
  const operator = family.operators[index];
  const current: SvaEvaluation = evaluations[index];
  const focus: SvaAttempt = current.attempts[k];
  const traceKey = family.signals.map((s) => rows[s].join("")).join("|");

  const options: PredictionOption[] = useMemo(() => {
    const byLabel = new Map<string, { attempt: SvaAttempt; ops: string[] }>();
    family.operators.forEach((op, i) => {
      const a = evaluations[i].attempts[k];
      const label = outcomeLabel(a);
      const entry = byLabel.get(label) ?? { attempt: a, ops: [] };
      if (i !== index) entry.ops.push(op.property);
      byLabel.set(label, entry);
    });
    const correctLabel = outcomeLabel(focus);
    const distractors: SvaAttempt[] = [
      { start: k, status: "VACUOUS", end: k, reason: "", steps: [] },
      { start: k, status: "PENDING", end: trace.length - 1, reason: "", steps: [] },
    ];
    for (const d of distractors) if (!byLabel.has(outcomeLabel(d))) byLabel.set(outcomeLabel(d), { attempt: d, ops: [] });
    return [...byLabel.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, info]) => {
        const correct = label === correctLabel;
        let feedback: string;
        if (correct) feedback = `${plainText(focus.reason)}.`;
        else if (info.ops.length) {
          feedback = `That is what ${info.ops.join(" and ")} report${info.ops.length === 1 ? "s" : ""}: ${plainText(info.attempt.reason)}. The selected operator means "${operator.summary}".`;
        } else if (info.attempt.status === "VACUOUS") {
          feedback = `${family.trigger} is 1 at edge ${k}, so the antecedent matches and the consequent is checked. Vacuity needs the antecedent to miss.`;
        } else {
          feedback = `The trace has enough edges to decide this attempt: it is decided at edge ${focus.end}.`;
        }
        return { id: label, label, correct, feedback };
      });
  }, [family, evaluations, k, index, focus, operator, trace.length]);

  const changeFamily = (id: string) => {
    const next = temporalFamilies.find((f) => f.id === id);
    if (!next) return;
    setFamilyId(id);
    setOpIndex("0");
    setRows(cloneRows(next.rows));
  };

  const toggle = (signal: string, edge: number) => setRows((prev) => ({ ...prev, [signal]: prev[signal].map((v, i) => (i === edge ? (v ? 0 : 1) : v)) as BitRow }));

  const markers: CycleMarker[] = revealed
    ? current.attempts.map((a) => ({
        edge: a.start,
        tone: tone[a.status],
        glyph: statusGlyph[a.status],
        short: a.start === k ? "A" + a.start : undefined,
        label: `Attempt A${a.start}: ${a.status}${a.status === "VACUOUS" ? "" : ` at edge ${a.end}`}. ${plainText(a.reason)}`,
      }))
    : [{ edge: k, tone: "info", glyph: "?", short: `A${k}`, label: `Attempt A${k}: the attempt you predict` }];
  const highlights: CycleHighlight[] = revealed ? [{ from: k, to: Math.max(k, focus.end), tone: focus.status === "FAIL" ? "fail" : focus.status === "PASS" ? "pass" : "attempt" }] : [{ from: k, to: k, tone: "attempt" }];
  const signals: CycleSignal[] = [{ name: "clk", kind: "clock" }, ...family.signals.map((name) => ({ name, kind: "bit" as const, values: rows[name], editable: true }))];

  return (
    <VisualFrame
      label="Temporal operator comparison"
      eyebrow="Compare operators"
      title="Same trace, different temporal operators"
      summary="Pick an operator family and an operator, predict what one attempt reports, then compare every operator in the family on the same trace. Toggle cells to build corner cases."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="space-y-4" data-testid="temporal-logic-explorer">
        <SegmentedControl<string> label="Operator family" value={family.id} onChange={changeFamily} options={temporalFamilies.map((f) => ({ value: f.id, label: f.label }))} />
        <SegmentedControl<string>
          label="Operator"
          mono
          value={opIndex}
          onChange={setOpIndex}
          options={family.operators.map((op, i) => ({ value: String(i), label: op.property }))}
        />
        <pre className="overflow-x-auto rounded-xl bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
          <code>{`a_check: assert property (@(posedge clk) ${operator.property});\n// reads as: ${operator.summary}`}</code>
        </pre>

        <CycleWaveform
          title={`Trace for ${operator.property}`}
          signals={signals}
          edges={trace.length}
          markers={markers}
          highlights={highlights}
          cursor={k}
          onToggle={toggle}
          caption={`x-axis: posedge clk edges 0–${trace.length - 1} (cycle time). Column k is the value sampled at edge k (Preponed, §16.5.1). The highlighted attempt starts at the first edge where ${family.trigger} is 1. Toggle cells to change the trace; the prediction resets.`}
          className="min-w-0"
        />

        <PredictionPrompt
          resetKey={`${family.id}:${opIndex}:${traceKey}`}
          question={
            <>
              For the attempt that starts at edge {k}, what does <code className="font-mono [font-variant-ligatures:none]">{operator.property}</code> report?
            </>
          }
          options={options}
        >
          <RevealSignal onChange={setRevealed} />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Every operator in this family, attempt A{k}:</p>
            <ul className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]" aria-label={`Comparison for attempt A${k}`}>
              {family.operators.map((op, i) => {
                const a = evaluations[i].attempts[k];
                return (
                  <li key={op.property} aria-current={i === index ? "true" : undefined} className={cn("rounded-lg border p-3 text-sm", resultClass[a.status], i === index && "ring-2 ring-cyan-500")}>
                    <code className="block font-mono text-[12.5px] [font-variant-ligatures:none]">{op.property}</code>
                    <p className="mt-1 font-semibold">
                      <span aria-hidden>{statusGlyph[a.status]} </span>
                      {outcomeLabel(a)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <Rich text={a.reason} />.
                    </p>
                  </li>
                );
              })}
            </ul>
            {focus.steps.length ? (
              <ol className="space-y-1 text-sm" aria-label={`How ${operator.property} matched for attempt A${k}`}>
                {focus.steps.map((s, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {s.toEdge !== undefined && s.toEdge !== s.edge ? `edges ${s.edge}–${s.toEdge}` : `edge ${s.edge}`}
                    </span>
                    <span aria-hidden>{s.kind === "match" ? "✓" : s.kind === "fail" ? "✕" : s.kind === "wait" ? "…" : "→"}</span>
                    <code className="font-mono text-[12.5px] [font-variant-ligatures:none]">{s.element}</code>
                    <span className="min-w-0 text-muted-foreground">{s.detail}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </PredictionPrompt>

        <PredictionPrompt
          question={
            <>
              Timing check: in <code className="font-mono [font-variant-ligatures:none]">assert property (@(posedge clk) req |=&gt; gnt);</code> req is sampled high at edge 10. When is gnt checked?
            </>
          }
          options={[
            {
              id: "same-edge",
              label: "At edge 10, using the value gnt had just before edge 10",
              correct: false,
              feedback: "That is |->, which starts the consequent on the antecedent's end edge. |=> starts it one tick later.",
            },
            {
              id: "observed",
              label: "At edge 10, after the design's NBA updates, in the Observed region",
              correct: false,
              feedback: "Assertions are evaluated in Observed, but on values sampled in Preponed (§16.5, §16.5.1). And |=> moves the check to the next tick anyway.",
            },
            {
              id: "next-edge",
              label: "At edge 11, using the value gnt had just before edge 11 (its Preponed sample)",
              correct: true,
              feedback: "|=> starts the consequent at the clock tick after the antecedent's end point (§16.12.7), and every value it reads is the one sampled in that tick's Preponed region (§16.5.1).",
            },
            {
              id: "between",
              label: "Whenever gnt rises between edges 10 and 11",
              correct: false,
              feedback: "Concurrent assertions only see sampled values at clock ticks. A pulse that starts and ends between two edges is invisible to them.",
            },
          ]}
        />
      </div>
    </VisualFrame>
  );
}
