"use client";

import React, { useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { comparisonStyles } from "@/components/visual-system/visual-language";
import {
  classToSource,
  dist,
  distItemWeight,
  formatPercent,
  hard,
  legalValues,
  marginal,
  parseDistItems,
  sampledMarginal,
  sampleRandomize,
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

export type HeatmapScenarioId = "coupling" | "implication" | "dist" | "soft" | "debug";
type DistOp = ":=" | ":/";

interface CallToggle {
  id: string;
  label: string;
  apply: (call: RandomizeCall) => RandomizeCall;
}

interface Scenario {
  id: HeatmapScenarioId;
  label: string;
  /** What to try, in one sentence. */
  tryThis: string;
  build: (op: DistOp) => ClassModel;
  defaultOff: string[];
  callToggles?: CallToggle[];
  hasDistOp?: boolean;
  question: "px0" | "success";
}

const SIDE = 8;

const xy = (blocks: Array<[string, ConstraintItem[]]>): ClassModel => ({
  className: "item",
  vars: [
    { name: "x", type: { kind: "bits", width: 3 } },
    { name: "y", type: { kind: "bits", width: 3 } },
  ],
  blocks: blocks.map(([name, items]) => ({ name, items })),
});

export const HEATMAP_SCENARIOS: Scenario[] = [
  {
    id: "coupling",
    label: "Coupled variables",
    tryThis: "Predict with c_sum on, then switch on c_order. The legal cells stay the same; watch the odds move.",
    build: () => xy([["c_sum", [hard("x + y < 8")]], ["c_order", [solveBefore(["x"], ["y"])]]]),
    defaultOff: ["c_order"],
    question: "px0",
  },
  {
    id: "implication",
    label: "Implication",
    tryThis: "Implication is a Boolean (!a || b), not an if-statement. Add c_hi and see it constrain x backwards.",
    build: () => xy([["c_imp", [hard("(x == 0) -> (y == 0)")]], ["c_hi", [hard("y >= 4")]], ["c_order", [solveBefore(["x"], ["y"])]]]),
    defaultOff: ["c_hi", "c_order"],
    question: "px0",
  },
  {
    id: "dist",
    label: "dist := vs :/",
    tryThis: "Switch the range operator between := and :/, then add a hard constraint that fights the dist.",
    build: (op) => xy([["c_dist", [dist("x", `0 := 4, [1:3] ${op} 4`)]], ["c_not0", [hard("x != 0")]], ["c_big", [hard("x > 3")]]]),
    defaultOff: ["c_not0", "c_big"],
    hasDistOp: true,
    question: "px0",
  },
  {
    id: "soft",
    label: "soft priority",
    tryThis: "A soft constraint is a default with a rank, not a probability. Add a hard rule, a later soft rule, or an inline with.",
    build: () => xy([["c_def", [soft("x == 0")]], ["c_range", [hard("x inside {[2:7]}")]], ["c_late", [soft("x == 5")]]]),
    defaultOff: ["c_range", "c_late"],
    callToggles: [{ id: "with", label: "randomize() with { x > 3; }", apply: (call) => ({ ...call, inline: [hard("x > 3")] }) }],
    question: "px0",
  },
  {
    id: "debug",
    label: "Debug a failure",
    tryThis: "This call fails. Find the smallest set of constraints that conflict. Is c_odd guilty?",
    build: () => xy([["c_sum", [hard("x + y < 6")]], ["c_x", [hard("x > 3")]], ["c_y", [hard("y > 2")]], ["c_odd", [hard("y % 2 == 1")]]]),
    defaultOff: [],
    callToggles: [{ id: "rand_mode", label: "y.rand_mode(0) with y = 4", apply: (call) => ({ ...call, stateVars: { y: 4 } }) }],
    question: "success",
  },
];

export const HEATMAP_ASSUMPTIONS = [
  "Exact: the model enumerates all 64 (x, y) pairs, so every probability shown is exact for the rules below.",
  "No ordering: every legal pair is equally likely (IEEE 1800-2023 §18.5.9). solve x before y picks x first, uniformly over its legal values (§18.5.9).",
  "dist (§18.5.3): an item is picked by weight, then a legal value inside it. := on a range weighs every value; :/ shares the weight across the range. If a dist variable were coupled to other variables, tools may differ.",
  "soft (§18.5.13.1): a later declaration, or an inline with constraint, outranks an earlier one. A soft constraint is dropped only when it conflicts.",
  "The sampled histogram draws from the exact distribution with a seeded PRNG. It shows sampling noise, not a particular simulator's random generator.",
];

const pct = (p: number) => formatPercent(p);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const withFraction = (p: number) => (p === 0 || p === 1 ? pct(p) : `${pct(p)} (${toFraction(p)})`);

interface Config {
  enabled: Record<string, boolean>;
  callOn: Record<string, boolean>;
  op: DistOp;
}

function defaultConfig(s: Scenario): Config {
  const blocks = s.build(":=").blocks.map((b) => b.name);
  return {
    enabled: Object.fromEntries(blocks.map((b) => [b, !s.defaultOff.includes(b)])),
    callOn: Object.fromEntries((s.callToggles ?? []).map((t) => [t.id, false])),
    op: ":=",
  };
}

function buildCall(s: Scenario, cfg: Config): RandomizeCall {
  let call: RandomizeCall = { disabledBlocks: Object.entries(cfg.enabled).filter(([, on]) => !on).map(([b]) => b) };
  for (const t of s.callToggles ?? []) if (cfg.callOn[t.id]) call = t.apply(call);
  return call;
}

const sourceOf = (result: SolveResult, id: string) => result.clauses.find((c) => c.id === id)?.source ?? id;
const blockOf = (id: string) => id.split(".")[0];
const px0 = (r: SolveResult) => (r.status === "ok" ? (marginal(r, "x").get(0) ?? 0) : 0);

interface Built {
  cls: ClassModel;
  call: RandomizeCall;
  result: SolveResult;
}

function buildOptions(s: Scenario, cfg: Config, b: Built): { question: React.ReactNode; options: PredictionOption[] } {
  const r = b.result;
  const unsat = r.status === "unsat";
  const coreText = r.core.map((m) => m.clause.source).join("  ·  ");

  if (s.question === "success") {
    const n = r.solutions.length;
    return {
      question: (
        <>
          Will <code className="font-mono [font-variant-ligatures:none]">ok = p.randomize()</code> succeed with the constraints that are switched on?
        </>
      ),
      options: [
        {
          id: "yes",
          label: "Yes: it returns 1",
          correct: !unsat,
          feedback: unsat
            ? `Each constraint can hold on its own, but these cannot hold together: ${coreText}.`
            : `${n} of the 64 pairs satisfy every enabled constraint, so the solver can pick one.`,
        },
        {
          id: "no",
          label: "No: it returns 0",
          correct: unsat,
          feedback: unsat
            ? `No pair satisfies every enabled constraint. randomize() returns 0 and x, y keep their previous values (§18.6.3).`
            : `randomize() fails only when no combination satisfies all enabled hard constraints (§18.6.3). Here ${n} pairs do.`,
        },
      ],
    };
  }

  const exact = px0(r);
  const legalCount = r.solutions.length;
  const xZeroPairs = r.solutions.filter((sol) => sol.values.x === 0).length;
  const failOption: PredictionOption = {
    id: "fail",
    label: "randomize() fails, so x keeps its old value",
    correct: unsat,
    feedback: unsat
      ? `Right: no pair satisfies every enabled hard constraint. The conflict: ${coreText}.`
      : `At least one pair satisfies every enabled constraint (${legalCount} do), so randomize() succeeds.`,
  };
  const candidates: Array<{ value: number; label: string; feedback: string }> = [];
  let why = "";

  if (s.id === "coupling") {
    const ordered = cfg.enabled.c_order;
    const joint = px0(solve(b.cls, b.call, { ignoreSolveBefore: true }));
    why = ordered
      ? `solve x before y picks x first, uniformly over its ${legalValues(r, "x").length} legal values, then y (§18.5.9). Same ${legalCount} legal pairs, different odds.`
      : cfg.enabled.c_sum
        ? `Every legal pair is equally likely (§18.5.9). x = 0 owns ${xZeroPairs} of the ${legalCount} legal pairs, so P(x = 0) = ${toFraction(exact)}.`
        : "Nothing couples x to y, so all 64 pairs are legal and x is uniform over its 8 values.";
    candidates.push({
      value: 1 / 8,
      label: "12.5%: x has 8 values, each equally likely",
      feedback: `The constraints are solved together. With no solve…before, every legal (x, y) pair is equally likely (§18.5.9), and x = 0 owns ${xZeroPairs} of the ${legalCount} pairs.`,
    });
    candidates.push({
      value: joint,
      label: `${pct(joint)}: count x = 0's share of the legal pairs`,
      feedback: "That is the joint-uniform answer. solve x before y picks x first, uniformly over its legal values, then y (§18.5.9). The legal pairs are the same; the odds are not.",
    });
    if (legalCount > 0) {
      candidates.push({
        value: 1 / legalCount,
        label: `${pct(1 / legalCount)}: one legal pair out of ${legalCount}`,
        feedback: "That is the chance of one cell, such as (0, 0). P(x = 0) adds up the whole x = 0 column.",
      });
    }
  } else if (s.id === "implication") {
    const ordered = cfg.enabled.c_order;
    const joint = px0(solve(b.cls, b.call, { ignoreSolveBefore: true }));
    const xZeroLegal = legalValues(r, "x").includes(0);
    why = !cfg.enabled.c_imp
      ? "Without c_imp nothing ties x to y, so x is uniform."
      : !xZeroLegal
        ? "y >= 4 makes y == 0 impossible, so (x == 0) -> (y == 0) forces x != 0. Constraints work in both directions (§18.5.5), and solve…before cannot make an illegal value legal (§18.5.9)."
        : ordered
          ? `solve x before y picks x first, uniformly over its ${legalValues(r, "x").length} legal values (§18.5.9), so x = 0 gets its full share.`
          : `(x == 0) -> (y == 0) is the Boolean !(x == 0) || (y == 0) (§18.5.5). x = 0 forces y = 0, so x = 0 owns ${xZeroPairs} of the ${legalCount} legal pairs.`;
    candidates.push({
      value: 1 / 8,
      label: "12.5%: x is picked first; the implication only decides y",
      feedback: !xZeroLegal
        ? "The implication also works backwards: if y == 0 is impossible, x == 0 is impossible too (§18.5.5)."
        : "The solver does not evaluate x first. a -> b is the Boolean !a || b, solved together with every other constraint (§18.5.5).",
    });
    candidates.push({
      value: 1,
      label: "100%: the implication makes x == 0 true",
      feedback: cfg.enabled.c_imp
        ? "-> never asserts its left side. It only says what must hold if x == 0."
        : "c_imp is switched off with constraint_mode(0), so nothing ties x to y, and nothing forces x == 0.",
    });
    candidates.push({
      value: joint,
      label: `${pct(joint)}: x = 0's share of the legal pairs`,
      feedback: "That is the joint-uniform answer. solve x before y picks x first, uniformly over its legal values (§18.5.9).",
    });
  } else if (s.id === "dist") {
    const other: DistOp = cfg.op === ":=" ? ":/" : ":=";
    const otherResult = solve(s.build(other), b.call);
    const items = parseDistItems(`0 := 4, [1:3] ${cfg.op} 4`);
    const total = items.reduce((sum, it) => sum + distItemWeight(it), 0);
    why = !cfg.enabled.c_dist
      ? "With c_dist off, x is uniform over its 8 values."
      : cfg.enabled.c_not0
        ? "x != 0 is hard, so 0 is illegal. dist weights never override a hard constraint; they only share out what is legal (§18.5.3)."
        : `Item weights: 0 := 4 gives 4; [1:3] ${cfg.op} 4 gives ${distItemWeight(items[1])}. Total ${total}, so P(x = 0) = 4/${total}. Values 4–7 are not listed, so dist makes them illegal (§18.5.3).`;
    const offNote = "c_dist is switched off with constraint_mode(0), so no weights apply and x is uniform over its 8 values.";
    const not0Note = "x != 0 is a hard constraint, so 0 is illegal whatever the weights say (§18.5.3).";
    const context = (text: string) => (!cfg.enabled.c_dist ? offNote : cfg.enabled.c_not0 ? not0Note : text);
    candidates.push({
      value: px0(otherResult),
      label: `${pct(px0(otherResult))}: the ${other} reading`,
      feedback: context(
        cfg.op === ":/"
          ? "That is how := would read it: := gives every value in [1:3] the weight 4, so that range totals 12. :/ gives the whole range 4."
          : "That is how :/ would read it: :/ shares 4 across [1:3]. := gives each of 1, 2 and 3 the weight 4, so the range totals 12.",
      ),
    });
    candidates.push({
      value: 1 / 8,
      label: "12.5%: dist only biases; all 8 values stay legal",
      feedback: context("dist is also a membership test (§18.5.3). Only values in the list are legal, so 4–7 never appear."),
    });
    candidates.push({
      value: 0.04,
      label: "4%: the weight 4 is a percentage",
      feedback: context(`Weights are ratios, not percentages. Divide by the total weight (${total}).`),
    });
  } else if (s.id === "soft") {
    const def = r.droppedSoft.find((d) => d.clause.id === "c_def.0");
    const keptDef = r.keptSoft.some((c) => c.id === "c_def.0");
    const blockers = def ? def.conflictsWith.map((id) => sourceOf(r, id)).join(" and ") : "";
    why = !cfg.enabled.c_def
      ? "With c_def off, x is uniform over whatever the other constraints allow."
      : keptDef
        ? "Nothing contradicts soft x == 0, so it holds on every call (§18.5.13). soft is a rank, not a probability."
        : def?.reason === "higher-priority"
          ? `c_late is declared later, so it outranks c_def (§18.5.13.1). c_def conflicts with ${blockers} and is discarded.`
          : `soft x == 0 conflicts with the hard constraint ${blockers}, so it is discarded (§18.5.13). The remaining values are uniform.`;
    const offNote = "c_def is switched off with constraint_mode(0), so it plays no part. x is uniform over whatever the other constraints allow.";
    const context = (text: string) => (cfg.enabled.c_def ? text : offNote);
    candidates.push({
      value: 0.9,
      label: "About 90%: soft is a strong preference",
      feedback: context("soft is a priority, not a probability (§18.5.13). An uncontested soft constraint holds on every call; a contested one is dropped entirely."),
    });
    candidates.push({
      value: 1,
      label: "100%: the soft default always wins",
      feedback: context(
        def?.reason === "higher-priority"
          ? "Between conflicting soft constraints, the later declaration has higher priority (§18.5.13.1). Here c_late wins."
          : "Hard constraints always win over soft ones, and inline with constraints are added as hard constraints here (§18.7). The soft default is discarded.",
      ),
    });
    candidates.push({
      value: 1 / 8,
      label: "12.5%: soft constraints are ignored by default",
      feedback: context("A soft constraint is not ignored. It holds unless a higher-priority constraint contradicts it."),
    });
  }

  const options: PredictionOption[] = [];
  if (!unsat) options.push({ id: "exact", label: `${withFraction(exact)}`, correct: true, feedback: why });
  const seen = new Set<string>(unsat ? [] : [exact.toFixed(9)]);
  candidates.forEach((c, i) => {
    const key = c.value.toFixed(9);
    // A distractor computed from an unsatisfiable variant would read "0%"; it teaches nothing.
    if (seen.has(key) || (!unsat && close(c.value, exact)) || (unsat && c.value === 0)) return;
    seen.add(key);
    options.push({ id: `d${i}`, label: c.label, correct: false, feedback: c.feedback });
  });
  options.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  options.push(failOption);
  return {
    question: (
      <>
        After <code className="font-mono [font-variant-ligatures:none]">ok = p.randomize();</code> how likely is <code className="font-mono">x == 0</code>?
      </>
    ),
    options,
  };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function cellText(p: number) {
  if (p >= 0.9995) return "100";
  if (p < 0.0005) return "<0.1";
  return (p * 100).toFixed(1);
}

function SolutionGrid({ result }: { result: SolveResult }) {
  const [focus, setFocus] = useState<{ x: number; y: number }>({ x: 0, y: SIDE - 1 });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const byKey = new Map(result.solutions.map((s) => [`${s.values.x},${s.values.y}`, s]));
  const maxP = Math.max(...result.solutions.map((s) => s.probability), 0);
  const describe = (x: number, y: number) => {
    const sol = byKey.get(`${x},${y}`);
    return sol ? `x = ${x}, y = ${y}: legal, P = ${withFraction(sol.probability)}` : `x = ${x}, y = ${y}: illegal pair`;
  };
  const move = (dx: number, dy: number) => {
    const x = Math.min(SIDE - 1, Math.max(0, focus.x + dx));
    const y = Math.min(SIDE - 1, Math.max(0, focus.y + dy));
    setFocus({ x, y });
    refs.current[`${x},${y}`]?.focus();
  };
  const onKey = (event: React.KeyboardEvent) => {
    const map: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const delta = map[event.key];
    if (delta) {
      event.preventDefault();
      move(delta[0], delta[1]);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(-SIDE, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(SIDE, 0);
    }
  };
  const rowTemplate = { gridTemplateColumns: `1.75rem repeat(${SIDE}, minmax(0, 1fr))` };

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-muted-foreground">
        Each cell is one (x, y) pair. Numbers are exact probabilities in %; <span aria-hidden>·</span> marks an illegal pair. Use the arrow keys to read cells.
      </figcaption>
      <div role="grid" aria-label="Solution space: x across, y up. Each cell gives the exact probability." className="max-w-[26rem] space-y-px" onKeyDown={onKey}>
        {Array.from({ length: SIDE }, (_, r) => SIDE - 1 - r).map((y) => (
          <div role="row" key={y} className="grid gap-px" style={rowTemplate}>
            <div role="rowheader" className="flex items-center justify-end pr-1 font-mono text-[10px] text-muted-foreground">
              <span className="sr-only">y = </span>
              {y}
            </div>
            {Array.from({ length: SIDE }, (_, x) => {
              const sol = byKey.get(`${x},${y}`);
              const isFocus = focus.x === x && focus.y === y;
              const alpha = sol && maxP > 0 ? 0.1 + 0.55 * (sol.probability / maxP) : 0;
              return (
                <div
                  key={x}
                  role="gridcell"
                  ref={(el) => {
                    refs.current[`${x},${y}`] = el;
                  }}
                  tabIndex={isFocus ? 0 : -1}
                  aria-selected={isFocus}
                  aria-label={describe(x, y)}
                  onFocus={() => setFocus({ x, y })}
                  onClick={() => setFocus({ x, y })}
                  style={sol ? { backgroundColor: `rgba(6, 182, 212, ${alpha.toFixed(3)})` } : undefined}
                  className={cn(
                    "flex h-9 min-w-0 items-center justify-center rounded-[3px] font-mono text-[10px] tabular-nums outline-none sm:text-[11px] [font-variant-ligatures:none]",
                    sol ? "border border-cyan-500/40 text-foreground" : "border border-dashed border-border/60 bg-muted/20 text-muted-foreground",
                    isFocus && "ring-2 ring-amber-500 ring-offset-1 ring-offset-background",
                  )}
                >
                  {sol ? cellText(sol.probability) : <span aria-hidden>·</span>}
                </div>
              );
            })}
          </div>
        ))}
        <div className="grid gap-px" style={rowTemplate} aria-hidden>
          <div className="text-right font-mono text-[10px] text-muted-foreground">y/x</div>
          {Array.from({ length: SIDE }, (_, x) => (
            <div key={x} className="text-center font-mono text-[10px] text-muted-foreground">
              {x}
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-foreground" aria-live="polite">
        <span className="font-semibold">Selected: </span>
        {describe(focus.x, focus.y)}
      </p>
    </figure>
  );
}

const RUN_CHOICES = ["100", "1000", "10000"] as const;

function MarginalTable({ result }: { result: SolveResult }) {
  const [runs, setRuns] = useState<(typeof RUN_CHOICES)[number]>("1000");
  const [round, setRound] = useState(0);
  const exact = marginal(result, "x");
  const seed = 2026 + round;
  const sample = useMemo(() => (round > 0 ? sampleRandomize(result, Number(runs), seed) : null), [result, runs, round, seed]);
  const sampled = sample ? sampledMarginal(result, sample, "x") : null;
  const maxP = Math.max(...exact.values(), 0.0001);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Number of randomize() calls"
          options={RUN_CHOICES.map((n) => ({ value: n, label: `${Number(n).toLocaleString("en-US")}×` }))}
          value={runs}
          onChange={(value) => {
            setRuns(value);
            setRound(0);
          }}
        />
        <button
          type="button"
          onClick={() => setRound((n) => n + 1)}
          className="min-h-10 rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 text-sm font-medium text-foreground hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Run randomize() {Number(runs).toLocaleString("en-US")} times
        </button>
        {sample ? <span className="text-xs text-muted-foreground">seed {seed}</span> : null}
      </div>
      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="mb-2 text-left text-sm font-semibold text-foreground">
          P(x): exact <span className={cn("rounded border px-1 text-[10px] font-bold", comparisonStyles.expected.className)}>{comparisonStyles.expected.tag}</span> vs sampled{" "}
          <span className={cn("rounded border px-1 text-[10px] font-bold", comparisonStyles.actual.className)}>{comparisonStyles.actual.tag}</span>
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="w-10 py-1 font-medium">x</th>
            <th scope="col" className="py-1 font-medium">Exact</th>
            <th scope="col" className="py-1 font-medium">{sample ? `Sampled (${sample.runs.toLocaleString("en-US")} calls)` : "Sampled"}</th>
          </tr>
        </thead>
        <tbody>
          {[...exact.entries()].map(([x, p]) => {
            const count = sampled?.get(x) ?? 0;
            const freq = sample ? count / sample.runs : 0;
            return (
              <tr key={x} className="border-t border-border/50">
                <th scope="row" className="py-1 text-left font-mono font-medium">{x}</th>
                <td className="py-1 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 min-w-0 flex-1">
                      <div className="h-3 rounded-sm border border-dashed border-teal-500/80" style={{ width: `${(p / maxP) * 100}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono tabular-nums">{pct(p)}</span>
                  </div>
                </td>
                <td className="py-1">
                  {sample ? (
                    <div className="flex items-center gap-2">
                      <div className="h-3 min-w-0 flex-1">
                        <div className="h-3 rounded-sm border border-sky-500/70 bg-sky-500/40" style={{ width: `${Math.min(100, (freq / maxP) * 100)}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right font-mono tabular-nums">{pct(freq)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {sample
          ? `${sample.failures} of ${sample.runs.toLocaleString("en-US")} calls returned 0. A satisfiable problem never fails; the bars wobble around the exact value because each call is random.`
          : "Run the calls to compare a finite sample with the exact distribution."}
      </p>
    </div>
  );
}

function SoftStatus({ result }: { result: SolveResult }) {
  const softs = result.clauses.filter((c) => c.soft);
  if (softs.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {softs.map((c) => {
        const kept = result.keptSoft.some((k) => k.id === c.id);
        const dropped = result.droppedSoft.find((d) => d.clause.id === c.id);
        return (
          <li key={c.id} className={kept ? comparisonStyles.match.className : comparisonStyles.mismatch.className}>
            <span aria-hidden>{kept ? comparisonStyles.match.glyph : comparisonStyles.mismatch.glyph}</span>{" "}
            <code className="font-mono [font-variant-ligatures:none]">{c.source}</code>{" "}
            <span className="text-foreground">
              {kept
                ? "kept: it holds on every call"
                : dropped?.reason === "higher-priority"
                  ? `discarded: outranked by ${dropped.conflictsWith.map((id) => sourceOf(result, id)).join(", ")} (declared later)`
                  : `discarded: conflicts with ${dropped?.conflictsWith.map((id) => sourceOf(result, id)).join(", ") ?? "a hard constraint"}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CorePanel({ built }: { built: Built }) {
  const { result } = built;
  const coreIds = result.core.map((m) => m.clause.id);
  const lines: CodeTraceLine[] = classToSource(built.cls, built.call).map((l) => ({ text: l.text, key: l.key }));
  const innocent = result.clauses.filter((c) => c.kind !== "state" && !coreIds.includes(c.id));
  return (
    <div className="space-y-3">
      <CodeTrace
        label="The minimal conflict, marked ✕"
        lines={lines}
        contextKeys={coreIds}
        renderLineControl={(line) =>
          line.key && coreIds.includes(line.key) ? (
            <span className="rounded border border-rose-400/70 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-100">✕ conflict</span>
          ) : null
        }
      />
      <ul className="space-y-1 text-sm">
        {result.core.map((m) => (
          <li key={m.clause.id}>
            <span aria-hidden className="text-rose-700 dark:text-rose-300">✕ </span>
            <code className="font-mono [font-variant-ligatures:none]">{m.clause.source}</code>
            <span className="text-muted-foreground">
              {m.removalFixes ? " · switching only this off makes randomize() succeed" : " · switching only this off is not enough: another conflict remains"}
            </span>
          </li>
        ))}
      </ul>
      {innocent.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Not part of this conflict: {innocent.map((c) => c.source).join(", ")}. Turning those off changes nothing.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        A conflict usually needs several constraints together. When you switch constraints off one by one, the last one you switched off is in <em>a</em> conflict, but it is not the whole story. Your simulator's
        failure report lists the full set.
      </p>
    </div>
  );
}

function ResultView({ built, scenario }: { built: Built; scenario: Scenario }) {
  const { result } = built;
  if (result.status === "unsat") {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-800 dark:text-rose-200" aria-live="polite">
          ✕ randomize() returns 0: no (x, y) pair satisfies every enabled constraint. x and y keep their previous values (§18.6.3).
        </p>
        <CorePanel built={built} />
      </div>
    );
  }
  const ordered = result.stages.length > 1;
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200" aria-live="polite">
        ✓ randomize() succeeds: {result.solutions.length} of 64 pairs are legal. P(x = 0) = {withFraction(px0(result))}.
      </p>
      {ordered ? (
        <p className="text-xs text-muted-foreground">
          Solve order used: {result.stages.map((s) => `{${s.join(", ")}}`).join(" → ")} (§18.5.9).
        </p>
      ) : null}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <SolutionGrid result={result} />
        </div>
        <div className="min-w-0">
          <MarginalTable result={result} />
        </div>
      </div>
      {scenario.id === "soft" ? <SoftStatus result={result} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flagship
// ---------------------------------------------------------------------------

interface ConstraintSolverHeatmapVisualizerProps {
  initialScenario?: HeatmapScenarioId;
  /** Restrict the scenario picker (lessons can show a subset). */
  scenarios?: HeatmapScenarioId[];
}

export const ConstraintSolverHeatmapVisualizer = ({ initialScenario = "coupling", scenarios }: ConstraintSolverHeatmapVisualizerProps) => {
  const available = HEATMAP_SCENARIOS.filter((s) => !scenarios || scenarios.includes(s.id));
  const [scenarioId, setScenarioId] = useState<HeatmapScenarioId>(available.some((s) => s.id === initialScenario) ? initialScenario : available[0].id);
  const scenario = available.find((s) => s.id === scenarioId) ?? available[0];
  const [config, setConfig] = useState<Config>(() => defaultConfig(scenario));
  const toggleGroupId = useId();

  const switchScenario = (id: HeatmapScenarioId) => {
    const next = available.find((s) => s.id === id) ?? available[0];
    setScenarioId(id);
    setConfig(defaultConfig(next));
  };

  const built: Built = useMemo(() => {
    const cls = scenario.build(config.op);
    const call = buildCall(scenario, config);
    return { cls, call, result: solve(cls, call) };
  }, [scenario, config]);

  const prompt = useMemo(() => buildOptions(scenario, config, built), [scenario, config, built]);
  const lines: CodeTraceLine[] = classToSource(built.cls, built.call).map((l) => ({ text: l.text, key: l.key }));
  const configKey = `${scenario.id}|${config.op}|${JSON.stringify(config.enabled)}|${JSON.stringify(config.callOn)}`;
  const blocks = built.cls.blocks.map((b) => b.name);

  return (
    <VisualFrame
      label="Constraint solution-space lab"
      eyebrow="Experiment"
      title="Where does randomize() land?"
      summary="Switch constraints on and off, predict, then compare the exact distribution with a batch of simulated randomize() calls."
      fidelity="model"
      assumptions={HEATMAP_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Scenario"
        options={available.map((s) => ({ value: s.id, label: s.label }))}
        value={scenario.id}
        onChange={switchScenario}
      />
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">Try this: </strong>
        {scenario.tryThis}
      </p>

      <div className="space-y-2">
        <p id={toggleGroupId} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Constraint blocks (constraint_mode)
        </p>
        <div role="group" aria-labelledby={toggleGroupId} className="flex flex-wrap gap-2">
          {blocks.map((b) => {
            const on = config.enabled[b];
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                aria-label={`Constraint ${b}`}
                onClick={() => setConfig((c) => ({ ...c, enabled: { ...c.enabled, [b]: !c.enabled[b] } }))}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                  on ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{on ? "✓" : "✕"}</span>
                {b}
                <span className="font-sans text-[10px] uppercase tracking-wide">{on ? "on" : "off"}</span>
              </button>
            );
          })}
          {(scenario.callToggles ?? []).map((t) => {
            const on = config.callOn[t.id];
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setConfig((c) => ({ ...c, callOn: { ...c.callOn, [t.id]: !c.callOn[t.id] } }))}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                  on ? "border-amber-500 bg-amber-500/15 text-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{on ? "✓" : "+"}</span>
                {t.label}
              </button>
            );
          })}
        </div>
        {scenario.hasDistOp ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Weight operator on the range [1:3]:</span>
            <SegmentedControl
              label="Weight operator on the range [1:3]"
              mono
              options={[
                { value: ":=", label: ":=  weight per value", ariaLabel: ":= gives every value in the range the weight" },
                { value: ":/", label: ":/  weight shared by the range", ariaLabel: ":/ shares the weight across the range" },
              ]}
              value={config.op}
              onChange={(op) => setConfig((c) => ({ ...c, op: op as DistOp }))}
            />
          </div>
        ) : null}
      </div>

      <CodeTrace label="Generated from the model: class + randomize() call" lines={lines} />

      <PredictionPrompt resetKey={configKey} question={prompt.question} options={prompt.options}>
        <ResultView built={built} scenario={scenario} />
      </PredictionPrompt>
    </VisualFrame>
  );
};
