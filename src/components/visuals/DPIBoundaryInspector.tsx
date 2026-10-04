"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  DPI_SCENARIOS,
  DPI_TYPES,
  cParameter,
  cPrototype,
  checkDpi,
  findType,
  svImport,
  type Direction,
  type DpiVerdict,
} from "@/lib/sv-dpi-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Type mapping follows Table H.1 and Annex H.7, H.8 and H.12 of IEEE 1800-2023.",
  "Legality follows §35.5 (pure, context, time), §35.7 and §35.8 (exports).",
  "The SV compiler cannot see C code: rules about what the C body does are checked by nobody, so breaking them is undefined behaviour, not a compile error.",
  "Deterministic: no random hazards. Timing claims describe a single-threaded simulator.",
];

const VERDICT_TEXT: Record<DpiVerdict, { label: string; glyph: string; className: string }> = {
  legal: { label: "Legal", glyph: "✓", className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" },
  "compile-error": { label: "Compile error", glyph: "✕", className: "border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-100" },
  "runtime-undefined": {
    label: "Compiles, but illegal or undefined at run time",
    glyph: "⚠",
    className: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  },
};

const mono = "font-mono [font-variant-ligatures:none]";

function TypeCrossing() {
  const [typeId, setTypeId] = useState("int");
  const [dir, setDir] = useState<Direction>("input");
  const type = findType(typeId);
  const answer = cParameter(type, dir);

  const options: PredictionOption[] = useMemo(() => {
    const wrong = type.misconceptions.filter((m) => m.c !== answer);
    const list = [
      { id: answer, c: answer, correct: true, why: `${type.note} (${type.clause})` },
      ...wrong.map((m) => ({ id: m.c, c: m.c, correct: false, why: m.why })),
    ];
    // Deterministic order: alphabetical, so the right answer is not always first.
    return list
      .sort((a, b) => a.c.localeCompare(b.c))
      .map((o) => ({ id: o.id, label: <code className={cn(mono, "text-xs")}>{o.c}</code>, correct: o.correct, feedback: o.why }));
  }, [answer, type]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">1. Crossing the border: which C type arrives?</p>
      <div className="space-y-2">
        <SegmentedControl label="SystemVerilog formal type" mono options={DPI_TYPES.map((t) => ({ value: t.id, label: t.sv.replace(/ x$/, "") }))} value={typeId} onChange={setTypeId} />
        <SegmentedControl
          label="Argument direction"
          options={[
            { value: "input", label: "input" },
            { value: "output", label: "output / inout" },
          ]}
          value={dir}
          onChange={setDir}
        />
      </div>
      <CodeTrace label="SystemVerilog import" lines={[{ text: svImport(type, dir), owner: "testbench" }]} />
      <PredictionPrompt
        resetKey={`${typeId}:${dir}`}
        question={
          <>
            What is the C parameter in <code className={mono}>c_use</code> for <code className={mono}>{`${dir} ${type.sv}`}</code>?
          </>
        }
        options={options}
      >
        <div className="space-y-2" aria-live="polite">
          <CodeTrace label="Matching C prototype" lines={[{ text: '#include "svdpi.h"' }, { text: cPrototype(type, dir) }]} />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Reading it in C: </strong>
            <code className={cn(mono, "break-words text-xs text-foreground")}>{type.access}</code>
          </p>
          <p className="text-sm text-muted-foreground">
            {type.small ? "Small type: passed by value as an input, and allowed as a function result." : "Not a small type: passed by reference (or handle), and not allowed as a function result."}{" "}
            <span className="text-xs">({type.clause})</span>
          </p>
        </div>
      </PredictionPrompt>
      <details className="rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">Full mapping table (reference)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-xs">
            <caption className="sr-only">SystemVerilog type to C type for DPI arguments</caption>
            <thead>
              <tr className="border-b border-border/70 text-muted-foreground">
                <th scope="col" className="py-1 pr-2">SystemVerilog</th>
                <th scope="col" className="py-1 pr-2">C input</th>
                <th scope="col" className="py-1 pr-2">C output / inout</th>
                <th scope="col" className="py-1 pr-2">Result?</th>
              </tr>
            </thead>
            <tbody>
              {DPI_TYPES.map((t) => (
                <tr key={t.id} className="border-b border-border/40">
                  <th scope="row" className={cn(mono, "py-1 pr-2 font-normal")}>{t.sv}</th>
                  <td className={cn(mono, "py-1 pr-2")}>{t.cInput}</td>
                  <td className={cn(mono, "py-1 pr-2")}>{t.cOutput}</td>
                  <td className="py-1 pr-2">{t.small ? "✓ yes" : "✕ no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Legality() {
  const [scenarioId, setScenarioId] = useState(DPI_SCENARIOS[0].id);
  const scenario = DPI_SCENARIOS.find((s) => s.id === scenarioId) ?? DPI_SCENARIOS[0];
  const result = checkDpi(scenario.decl);
  const v = VERDICT_TEXT[result.verdict];
  const reasonText = result.reasons.map((r) => `${r.text} (${r.clause})`).join(" ");

  const feedbackFor = (id: DpiVerdict): string => {
    if (id === result.verdict) return reasonText || result.time;
    if (result.verdict === "compile-error") {
      return id === "legal" ? `The declaration itself breaks a rule: ${reasonText}` : `It never gets that far: ${reasonText}`;
    }
    if (result.verdict === "runtime-undefined") {
      return id === "legal"
        ? `The declaration compiles, but the C body breaks a rule nobody checks: ${reasonText}`
        : "The SV compiler only checks the declaration, which is fine here. It cannot see what the C body does, so rules about the C code are never compile errors.";
    }
    return `Nothing here breaks a DPI rule. ${result.time}`;
  };

  const options: PredictionOption[] = (["legal", "compile-error", "runtime-undefined"] as DpiVerdict[]).map((id) => ({
    id,
    label:
      id === "legal"
        ? "Legal: it compiles and behaves as written."
        : id === "compile-error"
          ? "Compile error: the SystemVerilog declaration itself is rejected."
          : "It compiles, but the call is illegal or undefined when it runs.",
    correct: id === result.verdict,
    feedback: feedbackFor(id),
  }));

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">2. pure, context, tasks and time: legal or not?</p>
      <SegmentedControl label="DPI scenario" options={DPI_SCENARIOS.map((s) => ({ value: s.id, label: s.title }))} value={scenarioId} onChange={setScenarioId} />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="SystemVerilog side" lines={scenario.sv.map((text) => ({ text, owner: "testbench" as const }))} />
        <CodeTrace label="C side" lines={scenario.c.map((text) => ({ text }))} />
      </div>
      <PredictionPrompt resetKey={scenarioId} question="What happens with this pair?" options={options}>
        <div className={cn("space-y-1 rounded-lg border px-3 py-2 text-sm", v.className)} aria-live="polite">
          <p className="font-semibold">
            {v.glyph} {v.label}
          </p>
          {result.reasons.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {result.reasons.map((r) => (
                <li key={r.text}>
                  {r.text} <span className="text-xs opacity-80">({r.clause})</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            <strong>Simulation time: </strong>
            {result.time}
          </p>
        </div>
      </PredictionPrompt>
    </div>
  );
}

export default function DPIBoundaryInspector() {
  return (
    <VisualFrame
      label="DPI boundary explorer"
      eyebrow="Experiment"
      title="DPI boundary: types, qualifiers and time"
      summary={
        <>
          Every value that crosses into C needs a matching C type, and every import makes promises (<code className={mono}>pure</code>,{" "}
          <code className={mono}>context</code>) that the SystemVerilog compiler cannot check against your C code. Predict each crossing before you reveal it.
        </>
      }
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <TypeCrossing />
      <hr className="border-border/60" />
      <Legality />
    </VisualFrame>
  );
}
