"use client";

import React, { useId, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  classToSource,
  formatPercent,
  hard,
  marginal,
  soft,
  solve,
  solveBefore,
  toFraction,
  type ClassModel,
  type ConstraintItem,
  type RandomizeCall,
  type SolveResult,
} from "@/lib/constraint-solver-model";
import { cn } from "@/lib/utils";

import InterviewQuestionPlayground from "./InterviewQuestionPlayground";

type ScenarioId = "base" | "solve_before" | "soft_hard" | "contradiction";

/** What one cell shows at one step. */
type CellView =
  | { kind: "space" }
  | { kind: "legal" }
  | { kind: "removed"; failing: string[] }
  | { kind: "prob"; p: number };

interface Step {
  text: string;
  cell: (a: number, b: number) => CellView;
}

interface ScenarioData {
  title: string;
  cls: ClassModel;
  call: RandomizeCall;
  steps: Step[];
}

const ab = (blocks: Array<[string, ConstraintItem[]]>): ClassModel => ({
  className: "Packet",
  vars: [
    { name: "A", type: { kind: "bits", width: 2 } },
    { name: "B", type: { kind: "bits", width: 2 } },
  ],
  blocks: blocks.map(([name, items]) => ({ name, items })),
});

const cellKey = (a: number, b: number) => `${a},${b}`;
const probOf = (r: SolveResult) => new Map(r.solutions.map((s) => [cellKey(s.values.A, s.values.B), s.probability]));

/** Which enabled constraints a pair violates (each one checked on its own, for the explanation only). */
function failingConstraints(cls: ClassModel, call: RandomizeCall, a: number, b: number): string[] {
  const pinned = { ...call, stateVars: { A: a, B: b } };
  const out: string[] = [];
  const blocks = cls.blocks.filter((blk) => blk.items.some((i) => i.kind !== "solveBefore"));
  for (const blk of blocks) {
    const alone: ClassModel = { ...cls, blocks: [blk] };
    if (solve(alone, { stateVars: pinned.stateVars }).status === "unsat") out.push(blk.name);
  }
  (call.inline ?? []).forEach((item, i) => {
    if (solve({ ...cls, blocks: [] }, { stateVars: pinned.stateVars, inline: [item] }).status === "unsat") out.push(`with #${i + 1}`);
  });
  return out;
}

function buildScenario(id: ScenarioId): ScenarioData {
  const all = (cls: ClassModel, call: RandomizeCall = {}) => {
    const r = solve(cls, call);
    const legal = new Set(r.solutions.map((s) => cellKey(s.values.A, s.values.B)));
    return { r, legal, probs: probOf(r) };
  };
  const space: Step["cell"] = () => ({ kind: "space" });

  if (id === "base") {
    const cls = ab([["c_sum", [hard("A + B < 4")]], ["c_ne", [hard("A != B")]]]);
    const { r, legal, probs } = all(cls);
    const n = r.solutions.length;
    const pA0 = marginal(r, "A").get(0) ?? 0;
    const removed = (a: number, b: number): CellView => (legal.has(cellKey(a, b)) ? { kind: "legal" } : { kind: "removed", failing: failingConstraints(cls, {}, a, b) });
    return {
      title: "Solve all constraints at once",
      cls,
      call: {},
      steps: [
        { text: "The space: every combination of the two 2-bit variables, 16 (A, B) pairs.", cell: space },
        {
          text: `Every constraint is one condition on the whole pair, and all of them must hold at the same time. There is no "first c_sum, then c_ne". ${n} pairs satisfy both.`,
          cell: removed,
        },
        { text: `randomize() picks uniformly among the ${n} legal pairs (§18.5.9): each has probability 1/${n}.`, cell: (a, b) => (legal.has(cellKey(a, b)) ? { kind: "prob", p: probs.get(cellKey(a, b)) ?? 0 } : removed(a, b)) },
        {
          text: `Consequence: P(A = 0) = ${toFraction(pA0)} (${formatPercent(pA0)}), not 1/4. A value of A that fits more B values is picked more often.`,
          cell: (a, b) => (legal.has(cellKey(a, b)) ? { kind: "prob", p: probs.get(cellKey(a, b)) ?? 0 } : removed(a, b)),
        },
      ],
    };
  }

  if (id === "solve_before") {
    const cls = ab([["c1", [hard("(A == 0) -> (B == 3)")]], ["order", [solveBefore(["A"], ["B"])]]]);
    const ordered = all(cls);
    const joint = probOf(solve(cls, {}, { ignoreSolveBefore: true }));
    const n = ordered.r.solutions.length;
    const removed = (a: number, b: number): CellView =>
      ordered.legal.has(cellKey(a, b)) ? { kind: "legal" } : { kind: "removed", failing: failingConstraints(cls, {}, a, b) };
    const pJoint = joint.get(cellKey(0, 3)) ?? 0;
    const pOrdered = ordered.probs.get(cellKey(0, 3)) ?? 0;
    return {
      title: "solve…before changes odds, not legality",
      cls,
      call: {},
      steps: [
        { text: "The space: 16 (A, B) pairs.", cell: space },
        { text: `c1 removes A = 0 with B ≠ 3. ${n} legal pairs remain, with or without the order constraint.`, cell: removed },
        {
          text: `Without solve…before, every legal pair is equally likely: (0, 3) has ${toFraction(pJoint)} = ${formatPercent(pJoint)}.`,
          cell: (a, b) => (joint.has(cellKey(a, b)) ? { kind: "prob", p: joint.get(cellKey(a, b)) ?? 0 } : removed(a, b)),
        },
        {
          text: `With solve A before B, A is chosen first, uniformly over its 4 legal values; then B. (0, 3) now has ${formatPercent(pOrdered)}. Same legal pairs, different probabilities (§18.5.9).`,
          cell: (a, b) => (ordered.legal.has(cellKey(a, b)) ? { kind: "prob", p: ordered.probs.get(cellKey(a, b)) ?? 0 } : removed(a, b)),
        },
      ],
    };
  }

  if (id === "soft_hard") {
    const cls = ab([["hard_c", [hard("A > 1")]], ["soft_c", [soft("B == 0")]]]);
    const call: RandomizeCall = { inline: [hard("B == 3")] };
    const final = all(cls, call);
    const allHard = ab([["hard_c", [hard("A > 1")]], ["soft_c", [hard("B == 0")]]]);
    const together = solve(allHard, call);
    const withoutInline = all(cls);
    const n = final.r.solutions.length;
    return {
      title: "Soft vs hard",
      cls,
      call,
      steps: [
        { text: "The space: 16 (A, B) pairs.", cell: space },
        {
          text: `First the solver tries every constraint together: A > 1, soft B == 0 and the inline B == 3. ${together.solutions.length} pairs satisfy all three, because B cannot be 0 and 3 at once.`,
          cell: (a, b) => ({ kind: "removed", failing: failingConstraints(allHard, call, a, b) }),
        },
        {
          text: `So the soft constraint is discarded (§18.5.13); the hard ones always stay. ${n} pairs remain. Without the inline with, soft B == 0 would hold on every call (${withoutInline.r.solutions.length} pairs, all with B = 0).`,
          cell: (a, b) => (final.legal.has(cellKey(a, b)) ? { kind: "legal" } : { kind: "removed", failing: failingConstraints(cls, { inline: call.inline }, a, b).filter((x) => x !== "soft_c") }),
        },
        {
          text: `randomize() picks uniformly among the ${n} remaining pairs: ${formatPercent(1 / n)} each.`,
          cell: (a, b) => (final.legal.has(cellKey(a, b)) ? { kind: "prob", p: final.probs.get(cellKey(a, b)) ?? 0 } : { kind: "removed", failing: [] }),
        },
      ],
    };
  }

  const cls = ab([["c1", [hard("A == 3")]], ["c2", [hard("A < 2")]]]);
  const r = solve(cls);
  const core = r.core.map((m) => m.clause.block).join(" and ");
  const removed = (a: number, b: number): CellView => ({ kind: "removed", failing: failingConstraints(cls, {}, a, b) });
  return {
    title: "Contradiction",
    cls,
    call: {},
    steps: [
      { text: "The space: 16 (A, B) pairs.", cell: space },
      { text: "Both constraints apply to every pair at once. No pair has A == 3 and A < 2, so every pair is removed.", cell: removed },
      { text: "The solution space is empty, so randomize() returns 0 and A, B keep their previous values (§18.6.3).", cell: removed },
      {
        text: `The minimal conflict is ${core}. Switching off either one with constraint_mode(0) makes the call succeed. Always check the return value.`,
        cell: removed,
      },
    ],
  };
}

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  base: "All constraints at once",
  solve_before: "Solve before",
  soft_hard: "Soft vs hard",
  contradiction: "Contradiction",
};

function Cell({ a, b, view }: { a: number; b: number; view: CellView }) {
  const label =
    view.kind === "space"
      ? `A = ${a}, B = ${b}: not yet checked`
      : view.kind === "legal"
        ? `A = ${a}, B = ${b}: legal`
        : view.kind === "removed"
          ? `A = ${a}, B = ${b}: removed${view.failing.length ? `, fails ${view.failing.join(", ")}` : ""}`
          : `A = ${a}, B = ${b}: legal, probability ${formatPercent(view.p)}`;
  return (
    <li
      aria-label={label}
      className={cn(
        "flex h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 font-mono text-[11px] transition-colors duration-200 motion-reduce:transition-none sm:h-16 sm:text-xs [font-variant-ligatures:none]",
        view.kind === "space" && "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        view.kind === "legal" && "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        view.kind === "prob" && "border-cyan-500 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100",
        view.kind === "removed" && "border-dashed border-slate-300 bg-transparent text-slate-400 dark:border-slate-700 dark:text-slate-500",
      )}
    >
      <span aria-hidden>
        A:{a} B:{b}
      </span>
      <span aria-hidden className="font-semibold">
        {view.kind === "legal" ? "✓" : view.kind === "removed" ? "✕" : view.kind === "prob" ? formatPercent(view.p) : "?"}
      </span>
    </li>
  );
}

export default function ConstraintSolverVisualizer() {
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const [step, setStep] = useState(0);
  const selectId = useId();
  const current = useMemo(() => buildScenario(scenario), [scenario]);
  const lines = classToSource(current.cls, current.call).map((l) => ({ text: l.text, key: l.key }));
  const lastStep = current.steps.length - 1;

  // The embedded interview question is answered by the same model.
  const quiz = useMemo(() => {
    const cls: ClassModel = {
      className: "Packet",
      vars: [
        { name: "A", type: { kind: "bits", width: 1 } },
        { name: "B", type: { kind: "bits", width: 1 } },
      ],
      blocks: [{ name: "c", items: [hard("(A == 0) -> (B == 1)")] }],
    };
    const r = solve(cls);
    return {
      pA0: marginal(r, "A").get(0) ?? 0,
      pairs: r.solutions.map((s) => `(A=${s.values.A}, B=${s.values.B})`).join(", "),
      n: r.solutions.length,
    };
  }, []);

  return (
    <div className="my-8 flex flex-col gap-6 font-sans">
      <VisualFrame
        label="Constraint solver stepper"
        eyebrow="Mental model"
        title="How the solver sees two 2-bit variables"
        summary="Step through what the solver does with the whole (A, B) space. Every cell's state and probability comes from the constraint model."
        fidelity="model"
        assumptions={[
          "Exact enumeration of all 16 (A, B) pairs (IEEE 1800-2023 §18.5.9).",
          "The steps explain the result; a real solver evaluates all constraints together, not one after another.",
          "Soft constraints are discarded only when they conflict with higher-priority constraints (§18.5.13).",
        ]}
        className="my-0"
      >
        <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={selectId} className="text-sm font-semibold text-foreground">
                Scenario
              </label>
              <select
                id={selectId}
                className="min-h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={scenario}
                onChange={(e) => {
                  setScenario(e.target.value as ScenarioId);
                  setStep(0);
                }}
              >
                {(Object.keys(SCENARIO_LABELS) as ScenarioId[]).map((id) => (
                  <option key={id} value={id}>
                    {SCENARIO_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>

            <CodeTrace label={`${current.title}: generated from the model`} lines={lines} />

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4" aria-live="polite">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step {step + 1} of {current.steps.length}
              </p>
              <p className="text-sm text-foreground">{current.steps[step].text}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="min-h-10 flex-1 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setStep(Math.min(lastStep, step + 1))}
                disabled={step === lastStep}
                className="min-h-10 flex-[2] rounded-md bg-cyan-600 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {step === lastStep ? "Finished" : "Next step →"}
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">State space (A × B)</p>
            <ul aria-label={`State space at step ${step + 1}`} className="mx-auto grid max-w-[18rem] grid-cols-4 gap-2">
              {[0, 1, 2, 3].flatMap((a) => [0, 1, 2, 3].map((b) => <Cell key={cellKey(a, b)} a={a} b={b} view={current.steps[step].cell(a, b)} />))}
            </ul>
            <p className="mt-3 text-center text-xs text-muted-foreground">✓ legal · ✕ removed · % exact probability · ? not yet checked</p>
          </div>
        </div>
      </VisualFrame>

      <InterviewQuestionPlayground
        title="Constraint Solver Pitfall"
        question={
          <p>
            You have a class with <code>rand bit A; rand bit B;</code> and a constraint <code>(A == 0) -{">"} (B == 1);</code>. Without <code>solve A before B;</code>, what is the
            probability that <code>A</code> is 0?
          </p>
        }
        options={[
          {
            id: "opt1",
            label: "50%, because A is a 1-bit variable (0 or 1).",
            isCorrect: false,
            explanation: "The solver picks uniformly from the legal (A, B) combinations, not from each variable on its own (§18.5.9).",
          },
          {
            id: "opt2",
            label: `${formatPercent(quiz.pA0)}, because there are ${quiz.n} legal combinations.`,
            isCorrect: true,
            explanation: `Correct. The legal combinations are ${quiz.pairs}. The solver picks one uniformly, so P(A = 0) = ${toFraction(quiz.pA0)}.`,
          },
          {
            id: "opt3",
            label: "100%, the implication forces A to be 0 first.",
            isCorrect: false,
            explanation: "A -> B is the Boolean !A || B (§18.5.5). It says what must hold if A == 0; it never forces A == 0.",
          },
        ]}
      />
    </div>
  );
}
