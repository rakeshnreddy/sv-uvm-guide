"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  applyQueueOp,
  createQueue,
  formatElemList,
  queueOverflowChoices,
  runQueueComparison,
  type QueueOp,
  type SvElem,
} from "@/lib/systemverilog-array-model";
import { cn } from "@/lib/utils";

import { DiagnosticChips, ElementStrip } from "./DynamicStructureVisualizer";

interface Preset {
  id: string;
  label: string;
  initial: SvElem[];
  program: QueueOp[];
  hint: string;
}

const PRESETS: Preset[] = [
  {
    id: "urgent",
    label: "Urgent push_front",
    initial: [1, 2, 3, 4],
    program: [{ op: "push_front", value: 9 }],
    hint: "push_front shifts every element up one index. Which element ends up beyond the bound?",
  },
  {
    id: "burst",
    label: "Burst past the bound",
    initial: [1, 2, 3],
    program: [
      { op: "push_back", value: 4 },
      { op: "push_back", value: 5 },
      { op: "push_back", value: 6 },
    ],
    hint: "Count the free positions first. Each push_back writes at index size().",
  },
  {
    id: "insert",
    label: "Insert into a full queue",
    initial: [1, 2, 3, 4],
    program: [
      { op: "insert", index: 1, value: 7 },
      { op: "insert", index: 9, value: 8 },
    ],
    hint: "insert(1, …) shifts the tail up. insert(9, …) uses an index larger than size().",
  },
  {
    id: "drain",
    label: "Pop, then push",
    initial: [1, 2, 3, 4],
    program: [
      { op: "pop_front" },
      { op: "push_back", value: 5 },
      { op: "push_back", value: 6 },
    ],
    hint: "pop_front makes room for exactly one element.",
  },
];

type OpKind = "push_back" | "push_front" | "insert" | "pop_front" | "pop_back" | "delete-index";

const opKinds: Array<{ value: OpKind; label: string }> = [
  { value: "push_back", label: "push_back(v)" },
  { value: "push_front", label: "push_front(v)" },
  { value: "insert", label: "insert(i, v)" },
  { value: "pop_front", label: "pop_front()" },
  { value: "pop_back", label: "pop_back()" },
  { value: "delete-index", label: "delete(i)" },
];

const MAX_STEPS = 6;

/** Statement text for an op, without the receiver: `.push_back(4)`. */
function opSuffix(op: QueueOp): string {
  return applyQueueOp(createQueue("x", "int", null, []), op).code.replace(/^v = x|^x/, "").replace(/;$/, "");
}

const ASSUMPTIONS = [
  "Both queues start with the same contents and run the same program; only the declaration differs.",
  "Implements §7.10.5: a write first behaves as if the queue were unbounded, then every element beyond the bound is discarded and a warning is issued.",
  "Invalid insert/delete indices and pops of an empty queue follow §7.10.2.2–§7.10.2.5 (no effect, optional warning).",
];

const fieldClass =
  "h-10 w-16 rounded-md border border-border bg-background px-2 font-mono text-sm [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const QueueOperationLab: React.FC = () => {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const [bound, setBound] = useState<"2" | "3" | "4">("3");
  const [program, setProgram] = useState<QueueOp[]>(preset.program);
  const [initial, setInitial] = useState<SvElem[]>(preset.initial);
  const [newKind, setNewKind] = useState<OpKind>("push_back");
  const [value, setValue] = useState(8);
  const [index, setIndex] = useState(1);

  const n = Number(bound);
  const comparison = useMemo(() => runQueueComparison(initial, n, program), [initial, n, program]);
  const bq = useMemo(() => createQueue("bq", "int", n, initial), [initial, n]);
  const choices = useMemo(() => queueOverflowChoices(bq, program), [bq, program]);
  const resetKey = `${presetId}|${bound}|${formatElemList(initial)}|${program.map(opSuffix).join(";")}`;

  const choosePreset = (id: string) => {
    const next = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
    setPresetId(id);
    setProgram(next.program);
    setInitial(next.initial);
    if (Number(bound) + 1 < next.initial.length) setBound("3");
  };

  const addStep = () => {
    if (program.length >= MAX_STEPS) return;
    const op: QueueOp =
      newKind === "push_back" || newKind === "push_front"
        ? { op: newKind, value }
        : newKind === "insert"
          ? { op: "insert", index, value }
          : newKind === "delete-index"
            ? { op: "delete-index", index }
            : { op: newKind };
    setProgram((p) => [...p, op]);
  };

  const init = `'{${initial.join(", ")}}`;
  const codeLines: CodeTraceLine[] = [
    { text: `int  q[$]${" ".repeat(String(n).length + 1)} = ${init};  // unbounded`, key: "dq", owner: "testbench" },
    { text: `int bq[$:${n}] = ${init};  // at most ${n + 1} elements`, key: "dbq", owner: "testbench" },
    ...program.map((op, i) => {
      const s = opSuffix(op);
      const lhs = s.startsWith("[") || /pop_/.test(s) ? "v = " : "";
      return { text: `${lhs}q${s};   ${lhs}bq${s};`, key: `s${i}` };
    }),
  ];

  const results = (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="rounded-xl border border-border/70 bg-background/50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Final · int q[$]</p>
          <ElementStrip name="q" values={comparison.unboundedFinal} />
        </div>
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/[0.05] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Final · int bq[$:{n}] · {comparison.warnings} warning{comparison.warnings === 1 ? "" : "s"}
          </p>
          <ElementStrip name="bq" values={comparison.boundedFinal} bound={n} />
        </div>
      </div>
      <ol className="space-y-2" aria-label="Step-by-step comparison">
        {comparison.steps.map((s, i) => (
          <li
            key={i}
            aria-current={i === comparison.firstDivergence ? "step" : undefined}
            className={cn(
              "space-y-2 rounded-xl border p-3",
              i === comparison.firstDivergence ? "border-amber-500/70 bg-amber-500/10" : "border-border/70 bg-background/40",
            )}
          >
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-muted-foreground">Step {i + 1}</span>
              <code className="font-mono text-foreground [font-variant-ligatures:none]">{opSuffix(s.op).replace(/^\./, "")}</code>
              {i === comparison.firstDivergence ? <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">◆ first divergence</span> : null}
              {!s.diverged ? <span className="text-muted-foreground">= same contents</span> : <span className="text-amber-800 dark:text-amber-200">≠ contents differ</span>}
            </p>
            <ElementStrip name="q" values={s.unbounded.after.values} changed={s.unbounded.changedIndices} />
            <ElementStrip name="bq" values={s.bounded.after.values} changed={s.bounded.changedIndices} bound={n} discarded={s.bounded.discarded} />
            <DiagnosticChips diagnostics={s.bounded.diagnostics} />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">bq: </strong>
              {s.bounded.why} ({s.bounded.clause})
            </p>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <VisualFrame
      label="Bounded queue comparison"
      eyebrow="Compare two executions"
      title={
        <span className="font-mono [font-variant-ligatures:none]">
          int q[$] <span className="font-sans font-normal text-muted-foreground">vs</span> int bq[$:N]
        </span>
      }
      summary="The same program runs on an unbounded queue and on a bounded one. Predict what the bounded queue keeps, then compare the two step by step."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="space-y-4" data-testid="queue-operation-lab">
        <SegmentedControl label="Scenario" options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={choosePreset} />
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Bound"
            mono
            options={(["2", "3", "4"] as const).map((b) => ({
              value: b,
              label: `[$:${b}] · ${Number(b) + 1} max`,
              disabled: Number(b) + 1 < initial.length,
            }))}
            value={bound}
            onChange={setBound}
          />
        </div>

        <CodeTrace label="Program (runs on both queues)" lines={codeLines} />

        <details className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Edit the program</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Operation
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as OpKind)}
                className="h-10 rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground [font-variant-ligatures:none]"
              >
                {opKinds.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {newKind === "insert" || newKind === "delete-index" ? (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                index i
                <input type="number" className={fieldClass} value={index} min={-1} max={9} onChange={(e) => setIndex(Math.max(-1, Math.min(9, Math.trunc(Number(e.target.value) || 0))))} />
              </label>
            ) : null}
            {newKind === "push_back" || newKind === "push_front" || newKind === "insert" ? (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                value v
                <input type="number" className={fieldClass} value={value} min={0} max={99} onChange={(e) => setValue(Math.max(0, Math.min(99, Math.trunc(Number(e.target.value) || 0))))} />
              </label>
            ) : null}
            <button type="button" onClick={addStep} disabled={program.length >= MAX_STEPS} className="min-h-10 rounded-lg border border-cyan-500/50 px-3 text-xs font-medium hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              Add step
            </button>
            <button type="button" onClick={() => setProgram((p) => p.slice(0, -1))} disabled={program.length === 0} className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              Remove last step
            </button>
            <button type="button" onClick={() => choosePreset(presetId)} className="min-h-10 rounded-lg border border-border/70 px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Restore scenario
            </button>
          </div>
        </details>

        <HintLadder resetKey={resetKey} hints={[preset.hint, `bq[$:${n}] keeps indices 0..${n}. After each write, anything at index ${n + 1} or above is thrown away.`]} />
        {choices.length >= 2 ? (
          <PredictionPrompt resetKey={resetKey} question={<>After the program, what does <code className="font-mono [font-variant-ligatures:none]">bq</code> hold?</>} options={choices}>
            {results}
          </PredictionPrompt>
        ) : (
          <div className="space-y-2" aria-live="polite">
            <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted-foreground">
              No step pushes <code className="font-mono">bq</code> past its bound, so every mental model agrees. Add a push to a full queue to make it interesting.
            </p>
            {results}
          </div>
        )}
      </div>
    </VisualFrame>
  );
};

export default QueueOperationLab;
