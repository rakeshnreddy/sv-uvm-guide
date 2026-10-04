"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  classToSource,
  dist,
  formatPercent,
  hard,
  marginal,
  soft,
  solve,
  toFraction,
  valueText,
  type ClassModel,
  type ConstraintItem,
  type RandomizeCall,
  type RandVarDecl,
  type SolveOptions,
  type SolveResult,
} from "@/lib/constraint-solver-model";
import { cn } from "@/lib/utils";

export type ExplorerMode = "size" | "dist" | "soft" | "order" | "hole";
type OrderChoice = "none" | "kind" | "length";

interface Controls {
  rangeOp: ":/" | ":=";
  inline: boolean;
  lateSoft: boolean;
  order: OrderChoice;
}

const DEFAULT_CONTROLS: Controls = { rangeOp: ":/", inline: false, lateSoft: false, order: "none" };

const LENGTH: RandVarDecl = { name: "length", type: { kind: "bits", width: 5 } };
const KIND: RandVarDecl = { name: "kind", type: { kind: "enum", typeName: "kind_e", labels: ["SMALL", "JUMBO"] } };
const PROTO: RandVarDecl = { name: "proto", type: { kind: "enum", typeName: "protocol_t", labels: ["IPV4", "IPV6", "RAW"] } };
const KIND_LABELS = { SMALL: 0, JUMBO: 1 };
const PROTO_LABELS = { IPV4: 0, IPV6: 1, RAW: 2 };

const packet = (vars: RandVarDecl[], blocks: Array<[string, ConstraintItem[]]>, extra: Partial<ClassModel> = {}): ClassModel => ({
  className: "packet",
  vars,
  blocks: blocks.map(([name, items]) => ({ name, items })),
  ...extra,
});

interface ModeSetup {
  cls: ClassModel;
  call: RandomizeCall;
  options?: SolveOptions;
  /** Variable shown as rows. */
  rowVar: string;
  rowValues: number[];
}

function setupFor(mode: ExplorerMode, c: Controls): ModeSetup {
  const lengths = Array.from({ length: 13 }, (_, i) => i + 4);
  switch (mode) {
    case "size":
      return {
        cls: packet(
          [{ name: "length", type: { kind: "bits", width: 4 } }],
          [
            ["c_len", [hard("length inside {[1:8]}")]],
            ["c_size", [hard("payload.size() == length")]],
            ["c_data", [{ kind: "foreach", array: "payload", index: "i", body: [hard("payload[i] != 0")] }]],
          ],
          { arrays: [{ name: "payload", elem: { kind: "bits", width: 2 }, maxSize: 8 }] },
        ),
        call: {},
        rowVar: "length",
        rowValues: Array.from({ length: 8 }, (_, i) => i + 1),
      };
    case "dist":
      return {
        cls: packet([LENGTH], [
          ["c_len", [hard("length inside {[4:16]}")]],
          ["c_dist", [dist("length", `8 := 80, [4:16] ${c.rangeOp} 20`)]],
        ]),
        call: {},
        rowVar: "length",
        rowValues: lengths,
      };
    case "soft":
      return {
        cls: packet([LENGTH], [
          ["c_len", [hard("length inside {[4:16]}")]],
          ["c_soft", [soft("length == 16")]],
          ["c_small", [soft("length inside {[4:7]}")]],
        ]),
        call: { disabledBlocks: c.lateSoft ? [] : ["c_small"], inline: c.inline ? [hard("length < 10")] : undefined },
        rowVar: "length",
        rowValues: lengths,
      };
    case "order":
      return {
        cls: packet([LENGTH, KIND], [
          ["c_len", [hard("length inside {[4:16]}")]],
          ["c_kind", [hard("(kind == JUMBO) -> (length == 16)", KIND_LABELS)]],
          ...(c.order === "kind"
            ? ([["c_order", [{ kind: "solveBefore", before: ["kind"], after: ["length"] }]]] as Array<[string, ConstraintItem[]]>)
            : c.order === "length"
              ? ([["c_order", [{ kind: "solveBefore", before: ["length"], after: ["kind"] }]]] as Array<[string, ConstraintItem[]]>)
              : []),
        ]),
        call: {},
        rowVar: "length",
        rowValues: lengths,
      };
    case "hole":
      return {
        cls: packet([PROTO, { name: "length", type: { kind: "bits", width: 9 } }], [
          ["c_proto_len", [hard("(proto == IPV4) -> length inside {[20:60]}", PROTO_LABELS), hard("(proto == IPV6) -> length == 40", PROTO_LABELS)]],
          ["c_hardware_limit", [hard("length inside {16, 32, 64, 128, 256}")]],
        ]),
        call: c.inline ? { inline: [hard("proto == IPV6", PROTO_LABELS)] } : {},
        rowVar: "proto",
        rowValues: [0, 1, 2],
      };
  }
}

const MODES: Array<{ value: ExplorerMode; label: string }> = [
  { value: "size", label: "Array size" },
  { value: "dist", label: "dist weights" },
  { value: "soft", label: "soft priority" },
  { value: "order", label: "solve…before" },
  { value: "hole", label: "Debug: silent hole" },
];

const INSIGHT: Record<ExplorerMode, string> = {
  size: "§18.5.7.1: an array's size constraints are solved before its element (foreach) constraints. Longer payloads have far more element combinations, yet every legal length is equally likely, so you never need solve…before for a size.",
  dist: "§18.5.3: := gives every value of a range the weight; :/ gives the range the weight as a whole. A value listed in two items collects both weights. Weights are ratios, and dist is also a membership test.",
  soft: "§18.5.13: a soft constraint holds whenever it can and is discarded only when it conflicts. §18.5.13.1: later declarations and inline with constraints win. It is a priority, never a probability.",
  order: "§18.5.9: with no ordering, every legal (kind, length) pair is equally likely. solve a before b picks a first, uniformly over its legal values. The legal pairs never change.",
  hole: "§18.6.3: randomize() fails only when no combination satisfies every constraint. Here IPV6 can never be satisfied, so the solver quietly never picks it: a coverage hole, not a failure. Force it inline to turn the hole into a failure you can debug.",
};

const pct = (p: number) => formatPercent(p);
const frac = (p: number) => (p === 0 || p === 1 ? pct(p) : `${pct(p)} (${toFraction(p)})`);

interface Question {
  text: React.ReactNode;
  options: PredictionOption[];
}

function questionFor(mode: ExplorerMode, c: Controls, r: SolveResult): Question {
  const p = (name: string, value: number) => marginal(r, name).get(value) ?? 0;
  const make = (correctValue: number, correctFeedback: string, distractors: Array<{ value: number; label: string; feedback: string }>): PredictionOption[] => {
    const options: PredictionOption[] = [{ id: "exact", label: frac(correctValue), correct: true, feedback: correctFeedback }];
    const seen = new Set([correctValue.toFixed(9)]);
    distractors.forEach((d, i) => {
      if (seen.has(d.value.toFixed(9))) return;
      seen.add(d.value.toFixed(9));
      options.push({ id: `d${i}`, label: d.label, correct: false, feedback: d.feedback });
    });
    return options.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  };

  if (mode === "size") {
    const v = p("length", 8);
    return {
      text: "length = 8 allows 3⁸ = 6,561 payloads; length = 1 allows only 3. How likely is length == 8?",
      options: make(v, "The size is solved first (§18.5.7.1), uniformly over the 8 legal lengths. The payload elements are filled afterwards, so their count never weights length.", [
        {
          value: 6561 / 9840,
          label: "About 67%: most legal (length, payload) combinations have length 8",
          feedback: "That would be true if sizes and elements were one joint space. They are not: sizes are solved before elements (§18.5.7.1).",
        },
        { value: 1 / 16, label: "6.3% (1/16): length has 16 values", feedback: "c_len makes only 1..8 legal, so those 8 values share the probability." },
      ]),
    };
  }

  if (mode === "dist") {
    const v = p("length", 8);
    const other = solve(setupFor("dist", { ...c, rangeOp: c.rangeOp === ":/" ? ":=" : ":/" }).cls);
    const otherV = marginal(other, "length").get(8) ?? 0;
    return {
      text: (
        <>
          With <code className="font-mono [font-variant-ligatures:none]">{`length dist { 8 := 80, [4:16] ${c.rangeOp} 20 }`}</code>, how likely is length == 8?
        </>
      ),
      options: make(
        v,
        c.rangeOp === ":/"
          ? "8 sits in both items, so it collects both weights (§18.5.3): 80 from its own item plus 20/13 from the range. Total weight 100."
          : "With := the range weighs 13 × 20 = 260, so the total is 340. 8 collects 80 + 20 = 100 of it (§18.5.3).",
        [
          { value: 0.8, label: "80.0%: the item 8 := 80 decides it", feedback: "8 also appears in [4:16], and weights of a value listed twice add up (§18.5.3)." },
          { value: otherV, label: `${pct(otherV)}: the ${c.rangeOp === ":/" ? ":=" : ":/"} reading`, feedback: c.rangeOp === ":/" ? "That is how := would read it: 20 for every value of the range, 260 in total. :/ gives the whole range 20." : "That is how :/ would read it: 20 shared by the whole range. := gives each of the 13 values 20." },
          { value: 1 / 13, label: "7.7% (1/13): weights only matter when values conflict", feedback: "Weights shape the distribution on every call, not only in conflicts." },
        ],
      ),
    };
  }

  if (mode === "soft") {
    const v = p("length", 16);
    const dropped = r.droppedSoft.find((d) => d.clause.id === "c_soft.0");
    const why = !dropped
      ? "Nothing contradicts soft length == 16, so it holds on every call (§18.5.13)."
      : dropped.reason === "higher-priority"
        ? "c_small is declared later, so it outranks c_soft (§18.5.13.1). c_soft is discarded and length is uniform over 4..7."
        : "The inline with makes length < 10 a hard constraint, so soft length == 16 is discarded (§18.5.13). length is uniform over what remains.";
    return {
      text: "How likely is length == 16?",
      options: make(v, why, [
        { value: 0.9, label: "About 90%: soft is a strong preference", feedback: "soft is a priority, not a probability (§18.5.13). It holds every time or not at all." },
        { value: 1, label: "100%: a soft default always applies", feedback: dropped?.reason === "higher-priority" ? "Between conflicting soft constraints the later one wins (§18.5.13.1)." : "Hard constraints, including inline with constraints, always beat soft ones." },
        { value: 1 / 13, label: "7.7% (1/13): soft only matters in conflicts", feedback: "An uncontested soft constraint is satisfied on every call; it is not ignored." },
      ]),
    };
  }

  if (mode === "order") {
    const v = p("kind", 1);
    const unordered = solve(setupFor("order", { ...c, order: "none" }).cls);
    const joint = marginal(unordered, "kind").get(1) ?? 0;
    const why =
      c.order === "kind"
        ? "solve kind before length picks kind first, 50/50 over its two legal values; JUMBO then forces length = 16 (§18.5.9)."
        : c.order === "length"
          ? "solve length before kind picks length first, uniformly over 13 values. Only length = 16 allows JUMBO, and then kind is 50/50: 1/13 × 1/2 = 1/26."
          : `Every legal (kind, length) pair is equally likely (§18.5.9). There are ${unordered.solutions.length} pairs and only (JUMBO, 16) has kind = JUMBO.`;
    return {
      text: "How likely is kind == JUMBO?",
      options: make(v, why, [
        { value: 0.5, label: "50.0%: kind has two values", feedback: "Only true when kind is solved first. Otherwise the solver weighs whole (kind, length) pairs, and JUMBO owns one pair." },
        { value: joint, label: `${pct(joint)}: one of the ${unordered.solutions.length} legal pairs`, feedback: "That is the unordered (joint-uniform) answer. solve…before changes the probabilities while keeping the same legal pairs (§18.5.9)." },
        { value: 1 / 26, label: "3.8% (1/26): length first, then kind", feedback: "That is solve length before kind. The direction of the ordering matters." },
      ]),
    };
  }

  const fails = r.status === "unsat";
  return {
    text: (
      <>
        How does <code className="font-mono [font-variant-ligatures:none]">{fails ? "p.randomize() with { proto == IPV6; }" : "p.randomize()"}</code> behave?
      </>
    ),
    options: [
      {
        id: "never-ipv6",
        label: "It always succeeds, and proto is never IPV6",
        correct: !fails,
        feedback: fails
          ? "Not with the inline constraint: proto == IPV6 is now hard, and IPV6 needs length 40, which c_hardware_limit forbids."
          : "IPV6 needs length == 40, and 40 is not in the hardware list. The solver never fails; it simply never picks IPV6. That is a silent coverage hole.",
      },
      {
        id: "third",
        label: "It fails about 1 call in 3, whenever IPV6 is picked",
        correct: false,
        feedback: "The solver never picks a value and then gives up. randomize() fails only when no combination satisfies every constraint (§18.6.3).",
      },
      {
        id: "always-fails",
        label: "It fails on every call",
        correct: fails,
        feedback: fails
          ? "With proto == IPV6 forced, no length satisfies every constraint, so randomize() returns 0 on every call (§18.6.3)."
          : "IPV4 (length 32) and RAW (any listed length) are legal, so the solver always has a solution.",
      },
    ],
  };
}

function DistributionRows({ setup, result }: { setup: ModeSetup; result: SolveResult }) {
  const probs = marginal(result, setup.rowVar);
  const maxP = Math.max(...setup.rowValues.map((v) => probs.get(v) ?? 0), 0.0001);
  const completions = (value: number) => result.solutions.find((s) => s.values[setup.rowVar] === value)?.elementCompletions;
  const extra = (value: number) => {
    if (setup.cls.arrays?.length) {
      const n = completions(value);
      return n ? `payloads: 3^${value} = ${n.toLocaleString("en-US")}` : "";
    }
    if (setup.rowVar === "proto") {
      const lens = result.solutions.filter((s) => s.values.proto === value).map((s) => s.values.length);
      return lens.length ? `length ∈ {${lens.join(", ")}}` : "no legal length";
    }
    return "";
  };
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <caption className="mb-2 text-left text-sm font-semibold text-foreground">
        P({setup.rowVar}) — exact. Dot size and the number both show probability; ✕ means never generated.
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{setup.rowVar}</th>
          <th scope="col">Probability</th>
        </tr>
      </thead>
      <tbody>
        {setup.rowValues.map((v) => {
          const pr = probs.get(v) ?? 0;
          const note = extra(v);
          return (
            <tr key={v} className="border-t border-border/40">
              <th scope="row" className="w-20 py-1 pr-2 text-left font-mono font-medium [font-variant-ligatures:none]">
                {valueText(setup.cls, setup.rowVar, v)}
              </th>
              <td className="py-1">
                <div className="flex items-center gap-2">
                  {pr > 0 ? (
                    <span aria-hidden className="inline-flex w-5 shrink-0 justify-center">
                      <span className="inline-block rounded-full bg-violet-500" style={{ width: `${6 + 12 * Math.sqrt(pr / maxP)}px`, height: `${6 + 12 * Math.sqrt(pr / maxP)}px` }} />
                    </span>
                  ) : (
                    <span aria-hidden className="inline-flex w-5 shrink-0 justify-center text-rose-600 dark:text-rose-300">
                      ✕
                    </span>
                  )}
                  <div className="h-2.5 min-w-0 flex-1">
                    <div className="h-2.5 rounded-sm bg-violet-500/50" style={{ width: `${(pr / maxP) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono tabular-nums">{pr > 0 ? frac(pr) : "never"}</span>
                </div>
                {note ? <div className="pl-7 text-[11px] text-muted-foreground">{note}</div> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OrderGrid({ setup, result }: { setup: ModeSetup; result: SolveResult }) {
  const byKey = new Map(result.solutions.map((s) => [`${s.values.length},${s.values.kind}`, s.probability]));
  const maxP = Math.max(...result.solutions.map((s) => s.probability), 0.0001);
  return (
    <table className="w-full max-w-sm table-fixed border-collapse text-xs">
      <caption className="mb-2 text-left text-sm font-semibold text-foreground">Each (length, kind) pair: exact probability. ✕ = illegal pair.</caption>
      <thead>
        <tr className="text-muted-foreground">
          <th scope="col" className="w-16 py-1 text-left font-medium">length</th>
          <th scope="col" className="py-1 font-medium">SMALL</th>
          <th scope="col" className="py-1 font-medium">JUMBO</th>
        </tr>
      </thead>
      <tbody>
        {setup.rowValues.map((len) => (
          <tr key={len} className="border-t border-border/40">
            <th scope="row" className="py-1 text-left font-mono font-medium">{len}</th>
            {[0, 1].map((kind) => {
              const pr = byKey.get(`${len},${kind}`);
              const size = pr ? 6 + 14 * Math.sqrt(pr / maxP) : 0;
              return (
                <td key={kind} className="py-1">
                  <div className="flex items-center justify-center gap-1.5">
                    {pr !== undefined ? (
                      <>
                        <span aria-hidden className="inline-block rounded-full bg-violet-500" style={{ width: `${size}px`, height: `${size}px` }} />
                        <span className="font-mono tabular-nums">{pct(pr)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        <span aria-hidden>✕</span>
                        <span className="sr-only">illegal</span>
                      </span>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
        pressed ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted",
      )}
    >
      <span aria-hidden>{pressed ? "✓" : "+"}</span>
      {children}
    </button>
  );
}

export const ConstraintSolverExplorer = ({ initialMode = "size" }: { initialMode?: ExplorerMode }) => {
  const [mode, setMode] = useState<ExplorerMode>(initialMode);
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const setup = useMemo(() => setupFor(mode, controls), [mode, controls]);
  const result = useMemo(() => solve(setup.cls, setup.call, setup.options), [setup]);
  const question = useMemo(() => questionFor(mode, controls, result), [mode, controls, result]);
  const lines = classToSource(setup.cls, setup.call).map((l) => ({ text: l.text, key: l.key }));
  const resetKey = `${mode}|${JSON.stringify(controls)}`;

  return (
    <VisualFrame
      label="Constraint solver space explorer"
      eyebrow="Experiment"
      title="Constraint Solver Space Explorer"
      summary="Pick a technique, predict the probability, then see the exact distribution the constraints produce."
      fidelity="model"
      assumptions={[
        "Exact enumeration of every legal combination (IEEE 1800-2023 Clause 18).",
        "Array sizes are solved before array elements (§18.5.7.1). Payload elements are 2-bit here so the model can count them.",
        "dist picks an item by weight, then a legal value inside it (§18.5.3).",
        "Soft priorities follow §18.5.13.1: later declarations and inline with constraints win.",
      ]}
    >
      <SegmentedControl
        label="Technique"
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setControls(DEFAULT_CONTROLS);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {mode === "dist" ? (
          <SegmentedControl
            label="Weight operator on [4:16]"
            mono
            options={[
              { value: ":/", label: "[4:16] :/ 20", ariaLabel: ":/ shares 20 across the range" },
              { value: ":=", label: "[4:16] := 20", ariaLabel: ":= gives every value 20" },
            ]}
            value={controls.rangeOp}
            onChange={(rangeOp) => setControls((c) => ({ ...c, rangeOp }))}
          />
        ) : null}
        {mode === "soft" ? (
          <>
            <ToggleButton pressed={controls.lateSoft} onClick={() => setControls((c) => ({ ...c, lateSoft: !c.lateSoft }))}>
              c_small (declared later)
            </ToggleButton>
            <ToggleButton pressed={controls.inline} onClick={() => setControls((c) => ({ ...c, inline: !c.inline }))}>
              randomize() with {"{ length < 10; }"}
            </ToggleButton>
          </>
        ) : null}
        {mode === "order" ? (
          <SegmentedControl
            label="Ordering constraint"
            mono
            options={[
              { value: "none", label: "no ordering" },
              { value: "kind", label: "solve kind before length" },
              { value: "length", label: "solve length before kind" },
            ]}
            value={controls.order}
            onChange={(order) => setControls((c) => ({ ...c, order }))}
          />
        ) : null}
        {mode === "hole" ? (
          <ToggleButton pressed={controls.inline} onClick={() => setControls((c) => ({ ...c, inline: !c.inline }))}>
            randomize() with {"{ proto == IPV6; }"}
          </ToggleButton>
        ) : null}
      </div>

      <CodeTrace label="Generated from the model" lines={lines} />

      <PredictionPrompt resetKey={resetKey} question={question.text} options={question.options}>
        <div className="space-y-3">
          {result.status === "unsat" ? (
            <div className="space-y-2 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-900 dark:text-rose-100" aria-live="polite">
              <p className="font-medium">✕ randomize() returns 0 on every call. Minimal conflict:</p>
              <ul className="list-disc space-y-1 pl-5 font-mono [font-variant-ligatures:none]">
                {result.core.map((m) => (
                  <li key={m.clause.id}>{m.clause.source}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200" aria-live="polite">
                ✓ randomize() succeeds on every call ({result.solutions.length} legal combinations).
                {result.droppedSoft.length > 0 ? ` Discarded soft: ${result.droppedSoft.map((d) => d.clause.source).join(" ")}` : ""}
              </p>
              {mode === "order" ? <OrderGrid setup={setup} result={result} /> : null}
              <DistributionRows setup={mode === "order" ? { ...setup, rowVar: "kind", rowValues: [0, 1] } : setup} result={result} />
            </>
          )}
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-foreground">
            <strong>LRM: </strong>
            {INSIGHT[mode]}
          </p>
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
};
