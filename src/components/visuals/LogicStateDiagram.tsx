"use client";

import React, { useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { classifyValue, comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  BIT4_VALUES,
  BITWISE_TABLES,
  BITWISE_TABLE_NAMES,
  assignToIntegral,
  bitsToString,
  bitwiseBit,
  compare,
  conditionalOp,
  defaultVariableValue,
  diagnoseBitwiseGuess,
  diagnoseEqualityGuess,
  explainBitwise,
  explainCaseItem,
  formatLiteral,
  hasUnknown,
  ifBranch,
  isUnknownBit,
  logicalNot,
  notBit,
  parseBits,
  resize,
  selectCaseItem,
  toUnsigned,
  type BinaryBitwiseOp,
  type Bit4,
  type BitOutcome,
  type CaseKind,
} from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

export const FOUR_STATE_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 Tables 11-11 to 11-15 (bitwise), §11.4.5–§11.4.6 (equality), §11.4.7 (logical), §11.4.11 (?:), §12.4 (if), §12.5–§12.5.1 (case, casez, casex) and §6.11.2 (4-state to 2-state).",
  "Operands are unsigned and the same width. Width and sign rules live in the operator explorer.",
  "Simulator X-propagation modes (tool options that change if/case semantics) are not modelled.",
];

type Tab = "operators" | "equality" | "control" | "twostate";

/** ValueChip expects upper-case X/Z for the four-state cues. */
const chipValue = (bit: Bit4) => (bit === "x" ? "X" : bit === "z" ? "Z" : bit);

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function BitEditor({ name, bits, onChange }: { name: string; bits: Bit4[]; onChange: (bits: Bit4[]) => void }) {
  return (
    <div role="group" aria-label={`Bits of ${name}, most significant first`} className="flex flex-wrap items-center gap-1.5">
      <span className="w-6 font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{name}</span>
      {bits.map((bit, i) => {
        const index = bits.length - 1 - i;
        const next = BIT4_VALUES[(BIT4_VALUES.indexOf(bit) + 1) % BIT4_VALUES.length];
        return (
          <button
            // Keyed by position so focus stays on the bit while its value cycles.
            key={i}
            type="button"
            onClick={() => onChange(bits.map((b, k) => (k === i ? next : b)))}
            aria-label={`${name}[${index}] is ${bit}. Activate to change it to ${next}.`}
            className={cn(
              "h-10 w-10 rounded-md border font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              valueStyles[classifyValue(bit)].className,
            )}
          >
            {bit}
          </button>
        );
      })}
    </div>
  );
}

const codeLines = (lines: string[]): CodeTraceLine[] => lines.map((text, i) => ({ text, key: `l${i}` }));

function Why({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">
      <strong className="text-foreground">Why: </strong>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Picture                                                             */
/* ------------------------------------------------------------------ */

const PICTURE: { bit: Bit4; title: string; meaning: string }[] = [
  { bit: "0", title: "logic 0", meaning: "A known low value." },
  { bit: "1", title: "logic 1", meaning: "A known high value." },
  { bit: "x", title: "unknown", meaning: "The simulator cannot tell 0 from 1: never written, an x input, or equal-strength drivers that disagree." },
  { bit: "z", title: "high impedance", meaning: "Nothing drives this net. Logic operators read z as unknown." },
];

function FourValuePicture() {
  return (
    <figure className="rounded-xl border border-border/70 bg-background/50 p-3">
      <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        The picture: every 4-state bit holds one of four values
      </figcaption>
      <ul className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {PICTURE.map((p) => (
          <li key={p.bit} className="flex items-start gap-2 rounded-lg border border-border/60 p-2">
            <ValueChip value={chipValue(p.bit)} />
            <span className="text-xs text-muted-foreground">
              <strong className="block text-foreground">{p.title}</strong>
              {p.meaning}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        2-state types (<code className="font-mono">bit</code>, <code className="font-mono">int</code>, <code className="font-mono">byte</code>) keep only the first two.
      </p>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 1: operator truth tables                                        */
/* ------------------------------------------------------------------ */

type OperatorChoice = BinaryBitwiseOp | "~";

function OperatorsTab() {
  const [op, setOp] = useState<OperatorChoice>("&");
  const [a, setA] = useState<Bit4>("x");
  const [b, setB] = useState<Bit4>("0");
  const unary = op === "~";
  const result = unary ? notBit(a) : bitwiseBit(op, a, b);
  const expr = unary ? "~a" : `a ${op} b`;
  const options: PredictionOption[] = BIT4_VALUES.map((v) => ({
    id: v,
    label: <span className="font-mono [font-variant-ligatures:none]">y = 1&apos;b{v}</span>,
    correct: v === result,
    feedback: diagnoseBitwiseGuess(op, a, unary ? undefined : b, v),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Operator</p>
          <SegmentedControl
            label="Operator"
            mono
            value={op}
            onChange={setOp}
            options={[
              { value: "&", label: "&", ariaLabel: "bitwise AND" },
              { value: "|", label: "|", ariaLabel: "bitwise OR" },
              { value: "^", label: "^", ariaLabel: "bitwise XOR" },
              { value: "~^", label: "~^", ariaLabel: "bitwise XNOR" },
              { value: "~", label: "~", ariaLabel: "bitwise NOT" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Operand a</p>
          <SegmentedControl label="Value of a" mono value={a} onChange={setA} options={BIT4_VALUES.map((v) => ({ value: v, label: v }))} />
        </div>
        {!unary ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Operand b</p>
            <SegmentedControl label="Value of b" mono value={b} onChange={setB} options={BIT4_VALUES.map((v) => ({ value: v, label: v }))} />
          </div>
        ) : null}
      </div>

      <CodeTrace
        label="The expression"
        lines={codeLines([`logic a = 1'b${a};`, ...(unary ? [] : [`logic b = 1'b${b};`]), "logic y;", `assign y = ${expr};`])}
      />

      <PredictionPrompt resetKey={`${op}:${a}:${b}`} question={<>What value does <code className="font-mono">y</code> take?</>} options={options}>
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono [font-variant-ligatures:none]">y = {expr} =</span>
            <ValueChip name="y" value={chipValue(result)} />
          </div>
          <Why>{explainBitwise(op, a, unary ? undefined : b)}</Why>
          <TruthTable op={op} a={a} b={b} />
        </div>
      </PredictionPrompt>
    </div>
  );
}

function TruthTable({ op, a, b }: { op: OperatorChoice; a: Bit4; b: Bit4 }) {
  const caption = `${BITWISE_TABLE_NAMES[op]} of IEEE 1800-2023: ${op === "~" ? "~a" : `a ${op} b`} for every 4-state input`;
  if (op === "~") {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-[240px] border-collapse text-center font-mono text-sm [font-variant-ligatures:none]">
          <caption className="mb-1 text-left text-xs text-muted-foreground">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-border/60 px-2 py-1">a</th>
              {BIT4_VALUES.map((v) => (
                <th key={v} scope="col" className="border border-border/60 px-2 py-1">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="border border-border/60 px-2 py-1">~a</th>
              {BIT4_VALUES.map((v) => (
                <TableCell key={v} value={notBit(v)} current={v === a} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  const tbl = BITWISE_TABLES[op];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[260px] border-collapse text-center font-mono text-sm [font-variant-ligatures:none]">
        <caption className="mb-1 text-left text-xs text-muted-foreground">{caption}. Rows are a, columns are b.</caption>
        <thead>
          <tr>
            <th scope="col" className="border border-border/60 px-2 py-1">
              a {op} b
            </th>
            {BIT4_VALUES.map((v) => (
              <th key={v} scope="col" className="border border-border/60 px-2 py-1">b={v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BIT4_VALUES.map((row) => (
            <tr key={row}>
              <th scope="row" className="border border-border/60 px-2 py-1">a={row}</th>
              {BIT4_VALUES.map((col) => (
                <TableCell key={col} value={tbl[row][col]} current={row === a && col === b} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableCell({ value, current }: { value: Bit4; current: boolean }) {
  return (
    <td
      aria-current={current ? "true" : undefined}
      className={cn("border border-border/60 px-2 py-1", current && "outline outline-2 -outline-offset-2 outline-cyan-500")}
    >
      <span className={cn("inline-block min-w-6 rounded border px-1", valueStyles[classifyValue(value)].className)}>{value}</span>
      {current ? <span className="sr-only"> (your case)</span> : null}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 2: == vs === vs ==?                                             */
/* ------------------------------------------------------------------ */

const EQUALITY_PRESETS: { id: string; label: string; a: string; b: string }[] = [
  { id: "known-differs", label: "1x00 vs 0000", a: "1x00", b: "0000" },
  { id: "x-vs-x", label: "1x00 vs 1x00", a: "1x00", b: "1x00" },
  { id: "z-hides", label: "10z1 vs 1001", a: "10z1", b: "1001" },
  { id: "wildcard", label: "1011 vs 1x1z", a: "1011", b: "1x1z" },
];

const OUTCOME_GLYPH: Record<BitOutcome, { glyph: string; text: string; className: string }> = {
  match: { glyph: "=", text: "match", className: "text-emerald-700 dark:text-emerald-300" },
  mismatch: { glyph: "≠", text: "known bits differ", className: "text-rose-700 dark:text-rose-300" },
  ambiguous: { glyph: "?", text: "ambiguous (x/z)", className: "text-amber-700 dark:text-amber-300" },
  wildcard: { glyph: "*", text: "wildcard in b", className: "text-sky-700 dark:text-sky-300" },
};

function EqualityTab() {
  const [a, setA] = useState<Bit4[]>(() => parseBits("1x00"));
  const [b, setB] = useState<Bit4[]>(() => parseBits("0000"));
  const eq = compare("==", a, b);
  const ceq = compare("===", a, b);
  const weq = compare("==?", a, b);
  const branch = ifBranch([eq.result]);
  const options: PredictionOption[] = (["0", "1", "x"] as Bit4[]).map((v) => ({
    id: v,
    label: <span className="font-mono [font-variant-ligatures:none]">a == b is 1&apos;b{v}</span>,
    correct: v === eq.result,
    feedback: diagnoseEqualityGuess(a, b, v),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Load a case:</span>
        {EQUALITY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setA(parseBits(p.a));
              setB(parseBits(p.b));
            }}
            className="min-h-9 rounded-full border border-border/70 px-3 py-1 font-mono text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <BitEditor name="a" bits={a} onChange={setA} />
        <BitEditor name="b" bits={b} onChange={setB} />
        <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z.</p>
      </div>
      <CodeTrace
        label="The comparison"
        lines={codeLines([
          `logic [3:0] a = ${formatLiteral(a)};`,
          `logic [3:0] b = ${formatLiteral(b)};`,
          "$display(\"%b %b %b\", a == b, a === b, a ==? b);",
          "if (a == b) $display(\"equal\");",
          "else        $display(\"not proven equal\");",
        ])}
      />
      <PredictionPrompt resetKey={`${bitsToString(a)}:${bitsToString(b)}`} question={<>What does <code className="font-mono">a == b</code> return?</>} options={options}>
        <div className="space-y-4" aria-live="polite">
          <div className="overflow-x-auto">
            <table className="min-w-[280px] border-collapse text-center font-mono text-sm [font-variant-ligatures:none]">
              <caption className="mb-1 text-left text-xs text-muted-foreground">Bit-by-bit view of a == b (bit 3 is the MSB)</caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-border/60 px-2 py-1">bit</th>
                  {eq.bits.map((c) => (
                    <th key={c.index} scope="col" className="border border-border/60 px-2 py-1">{c.index}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["a", "b"] as const).map((name) => (
                  <tr key={name}>
                    <th scope="row" className="border border-border/60 px-2 py-1">{name}</th>
                    {eq.bits.map((c) => (
                      <td key={c.index} className="border border-border/60 px-2 py-1">{c[name]}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="border border-border/60 px-2 py-1">==</th>
                  {eq.bits.map((c) => (
                    <td key={c.index} className={cn("border border-border/60 px-2 py-1 font-semibold", OUTCOME_GLYPH[c.outcome].className)}>
                      <span aria-hidden>{OUTCOME_GLYPH[c.outcome].glyph}</span>
                      <span className="sr-only">{OUTCOME_GLYPH[c.outcome].text}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted-foreground">= match · ≠ known bits differ · ? ambiguous because of x/z</p>
          </div>
          <ul className="space-y-3">
            {[
              { expr: "a == b", r: eq },
              { expr: "a === b", r: ceq },
              { expr: "a ==? b", r: weq },
            ].map(({ expr, r }) => (
              <li key={expr} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm [font-variant-ligatures:none]">{expr}</code>
                  <ValueChip value={chipValue(r.result)} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.why}</p>
              </li>
            ))}
            <li className="rounded-lg border border-border/60 p-3 text-sm">
              <code className="font-mono [font-variant-ligatures:none]">if (a == b)</code> runs the <strong>{branch === "then" ? "then" : "else"}</strong> branch
              {eq.result === "x" ? ": an x condition is not true (§12.4)." : "."}
            </li>
          </ul>
        </div>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 3: if / ?: / case with x                                        */
/* ------------------------------------------------------------------ */

type Construct = "if" | "ifnot" | "ternary" | CaseKind;

const CASE_ITEMS: { label: string; literal: string }[] = [
  { label: "A", literal: "00" },
  { label: "B", literal: "1?" },
  { label: "C", literal: "x1" },
];

function ControlTab() {
  const [construct, setConstruct] = useState<Construct>("if");
  const [a, setA] = useState<Bit4>("x");
  const [sel, setSel] = useState<Bit4[]>(() => parseBits("x0"));
  const isCase = construct === "case" || construct === "casez" || construct === "casex";

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Construct"
        mono
        value={construct}
        onChange={setConstruct}
        options={[
          { value: "if", label: "if (a)" },
          { value: "ifnot", label: "if (!a)" },
          { value: "ternary", label: "a ? 1 : 0" },
          { value: "case", label: "case" },
          { value: "casez", label: "casez" },
          { value: "casex", label: "casex" },
        ]}
      />
      {isCase ? (
        <CasePanel kind={construct as CaseKind} sel={sel} setSel={setSel} />
      ) : (
        <IfPanel construct={construct as "if" | "ifnot" | "ternary"} a={a} setA={setA} />
      )}
    </div>
  );
}

function IfPanel({ construct, a, setA }: { construct: "if" | "ifnot" | "ternary"; a: Bit4; setA: (b: Bit4) => void }) {
  const cond: Bit4[] = construct === "ifnot" ? [logicalNot([a])] : [a];
  const branch = ifBranch(cond);
  const result: Bit4 = construct === "ternary" ? conditionalOp([a], ["1"], ["0"])[0] : branch === "then" ? "1" : "0";
  const lines =
    construct === "ternary"
      ? [`logic a = 1'b${a};`, "logic y;", "assign y = a ? 1'b1 : 1'b0;"]
      : [`logic a = 1'b${a};`, "logic y;", "always_comb", `  if (${construct === "ifnot" ? "!a" : "a"}) y = 1'b1;`, "  else       y = 1'b0;"];
  const unknown = isUnknownBit(a);

  const feedbackFor = (guess: Bit4): string => {
    if (construct === "ternary") {
      if (guess === result) {
        return unknown
          ? "With an ambiguous condition, ?: evaluates both sides and merges them bit by bit; 1 versus 0 merges to x (§11.4.11, Table 11-20). Unlike if, it does not pick a side."
          : `The condition is known ${a === "1" ? "true" : "false"}, so ?: returns the ${a === "1" ? "first" : "second"} value.`;
      }
      return unknown
        ? "?: does not silently choose a side when the condition is x or z. It evaluates both results and merges them, so disagreeing bits become x."
        : `a is a known ${a}, so the condition is ${a === "1" ? "true and y is 1" : "false and y is 0"}.`;
    }
    const condText = construct === "ifnot" ? "!a" : "a";
    if (guess === result) {
      if (!unknown) return `${condText} is ${cond[0]}, so the ${branch} branch runs and y = ${result}.`;
      return construct === "ifnot"
        ? "!x is still x (§11.4.7), so this condition is not true either. The else branch runs again: if (a) and if (!a) both take else when a is unknown (§12.4)."
        : "The then branch needs a known nonzero condition. x is not known true, so the else branch runs (§12.4). The result looks valid, which is how X bugs hide.";
    }
    if (guess === "x") return "An if statement never produces x by itself: it must run one branch, and an x or z condition counts as false (§12.4).";
    if (unknown) {
      return construct === "ifnot"
        ? "Negating an unknown does not make it known: !x is x (§11.4.7). x is not true, so the then branch does not run."
        : "x is not 'true enough': the then branch only runs for a known nonzero condition (§12.4).";
    }
    return `${condText} evaluates to ${cond[0]}, so the ${branch} branch runs.`;
  };

  const options: PredictionOption[] = (["1", "0", "x"] as Bit4[]).map((v) => ({
    id: v,
    label: <span className="font-mono [font-variant-ligatures:none]">y = 1&apos;b{v}</span>,
    correct: v === result,
    feedback: feedbackFor(v),
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Value of a</p>
        <SegmentedControl label="Value of a" mono value={a} onChange={setA} options={BIT4_VALUES.map((v) => ({ value: v, label: v }))} />
      </div>
      <CodeTrace label="The code" lines={codeLines(lines)} />
      <PredictionPrompt resetKey={`${construct}:${a}`} question={<>What is <code className="font-mono">y</code>?</>} options={options}>
        <div className="space-y-2 text-sm" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <ValueChip name="y" value={chipValue(result)} />
            {construct !== "ternary" ? (
              <span className="text-muted-foreground">
                condition <code className="font-mono">{construct === "ifnot" ? "!a" : "a"}</code> = {cond[0]} → <strong className="text-foreground">{branch}</strong> branch
              </span>
            ) : (
              <span className="text-muted-foreground">{unknown ? "both sides evaluated and merged" : "one side selected"}</span>
            )}
          </div>
          {construct !== "ternary" && unknown ? (
            <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
              X-optimism: y is a clean 0 although a is unknown. Compare with <code className="font-mono">a ? 1 : 0</code>, which keeps the x visible.
            </p>
          ) : null}
        </div>
      </PredictionPrompt>
    </div>
  );
}

function CasePanel({ kind, sel, setSel }: { kind: CaseKind; sel: Bit4[]; setSel: (b: Bit4[]) => void }) {
  const items = CASE_ITEMS.map((it) => parseBits(it.literal));
  const hit = selectCaseItem(kind, sel, items);
  const hitLabel = hit === "default" ? "D" : CASE_ITEMS[hit].label;
  const optionIds = [...CASE_ITEMS.map((it) => it.label), "D"];
  const options: PredictionOption[] = optionIds.map((label, i) => {
    const isDefault = label === "D";
    const correct = label === hitLabel;
    let feedback: string;
    if (isDefault) {
      feedback = correct
        ? `No item matches under ${kind} rules, so default runs (§12.5).`
        : `default only runs when no item matches. Here item ${hitLabel} matches first: ${explainCaseItem(kind, sel, items[hit as number])}`;
    } else {
      const why = explainCaseItem(kind, sel, items[i]);
      feedback = correct
        ? `${why} Items are checked in source order and the first match wins (§12.5).`
        : hit !== "default" && (hit as number) < i
          ? `Item ${hitLabel} matches earlier, and the first match wins (§12.5).`
          : why;
    }
    return { id: label, label: <span>Branch {label}{isDefault ? " (default)" : ""}</span>, correct, feedback };
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <BitEditor name="sel" bits={sel} onChange={setSel} />
        <p className="text-xs text-muted-foreground">Activate a bit to cycle it. Try sel = x0 under each of case, casez and casex.</p>
      </div>
      <CodeTrace
        label="The code"
        lines={codeLines([
          `logic [1:0] sel = ${formatLiteral(sel)};`,
          `${kind} (sel)`,
          ...CASE_ITEMS.map((it) => `  2'b${it.literal}:  branch = "${it.label}";`),
          `  default: branch = "D";`,
          "endcase",
        ])}
      />
      <PredictionPrompt resetKey={`${kind}:${bitsToString(sel)}`} question="Which branch runs?" options={options}>
        <ul className="space-y-2 text-sm" aria-live="polite">
          {CASE_ITEMS.map((it, i) => {
            const matched = explainCaseItem(kind, sel, items[i]);
            const isHit = hit === i;
            return (
              <li key={it.label} className={cn("rounded-lg border p-2", isHit ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/60")}>
                <span className="font-mono [font-variant-ligatures:none]">2&apos;b{it.literal}</span> (branch {it.label}){" "}
                {isHit ? <strong className={comparisonStyles.match.className}>{comparisonStyles.match.glyph} runs</strong> : null}
                <span className="block text-muted-foreground">{matched}</span>
              </li>
            );
          })}
          <li className={cn("rounded-lg border p-2", hit === "default" ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/60")}>
            default (branch D){" "}
            {hit === "default" ? <strong className={comparisonStyles.match.className}>{comparisonStyles.match.glyph} runs</strong> : <span className="text-muted-foreground">skipped</span>}
          </li>
          {kind === "casex" && hasUnknown(sel) && hit !== "default" ? (
            <li className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
              X-optimism: an unknown select still runs a real branch, so the bug is hidden. casex treats x in the case expression as a do-not-care too (§12.5.1).
            </li>
          ) : null}
        </ul>
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 4: into a 2-state variable                                      */
/* ------------------------------------------------------------------ */

type Target = "bit4" | "int" | "logic4";

const TARGETS: Record<Target, { decl: string; states: 2 | 4; width: number; name: string }> = {
  bit4: { decl: "bit [3:0] t;", states: 2, width: 4, name: "bit [3:0]" },
  int: { decl: "int t;", states: 2, width: 32, name: "int" },
  logic4: { decl: "logic [3:0] t;", states: 4, width: 4, name: "logic [3:0]" },
};

/** Compact literal: long all-zero prefixes are shortened, decimal added when known. */
function describeBits(bits: Bit4[]): string {
  const lit = bits.length > 8 && bits.slice(0, bits.length - 4).every((x) => x === "0") ? `${bits.length}'b0…0${bitsToString(bits.slice(-4))}` : formatLiteral(bits);
  const u = toUnsigned(bits);
  return u === null ? lit : `${lit} (${u.toString()})`;
}

function TwoStateTab() {
  const [src, setSrc] = useState<Bit4[]>(() => parseBits("1x0z"));
  const [target, setTarget] = useState<Target>("bit4");
  const t = TARGETS[target];
  const result = assignToIntegral(src, t);
  const sized = resize(src, t.width);

  const candidates: { id: string; bits: Bit4[]; feedback: string }[] = [
    {
      id: "copied",
      bits: sized,
      feedback:
        t.states === 4
          ? result.why
          : "A 2-state variable has no encoding for x or z, so they cannot be copied. They are converted (§6.11.2).",
    },
    {
      id: "zeroed",
      bits: sized.map((x) => (isUnknownBit(x) ? "0" : x)),
      feedback: t.states === 2 ? result.why : `${t.name} is 4-state: x and z survive the copy. Only 2-state targets convert them to 0.`,
    },
    {
      id: "ones",
      bits: sized.map((x) => (isUnknownBit(x) ? "1" : x)),
      feedback: "Unknown bits become 0, never 1 (§6.11.2).",
    },
    {
      id: "allzero",
      bits: sized.map(() => "0" as Bit4),
      feedback: "Only the unknown bits are converted. Known bits are copied as they are.",
    },
  ];
  const seen = new Set<string>();
  const options: PredictionOption[] = candidates
    .filter((c) => {
      const key = bitsToString(c.bits);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({
      id: c.id,
      label: <span className="font-mono [font-variant-ligatures:none]">t = {describeBits(c.bits)}</span>,
      correct: bitsToString(c.bits) === bitsToString(result.bits),
      feedback: bitsToString(c.bits) === bitsToString(result.bits) ? result.why : c.feedback,
    }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Source (4-state)</p>
          <BitEditor name="a" bits={src} onChange={setSrc} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Target type</p>
          <SegmentedControl
            label="Target type"
            mono
            value={target}
            onChange={setTarget}
            options={[
              { value: "bit4", label: "bit [3:0]" },
              { value: "int", label: "int" },
              { value: "logic4", label: "logic [3:0]" },
            ]}
          />
        </div>
      </div>
      <CodeTrace label="The assignment" lines={codeLines([`logic [3:0] a = ${formatLiteral(src)};`, t.decl, "initial t = a;"])} />
      <PredictionPrompt resetKey={`${bitsToString(src)}:${target}`} question={<>What does <code className="font-mono">t</code> hold after <code className="font-mono">t = a;</code>?</>} options={options}>
        <div className="space-y-3 text-sm" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono [font-variant-ligatures:none]">t =</span>
            <span className="font-mono [font-variant-ligatures:none]">{describeBits(result.bits)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Low four bits before and after the assignment">
            {sized.slice(-4).map((bit, i) => {
              const after = result.bits[result.bits.length - 4 + i];
              const changed = bit !== after;
              return (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 font-mono text-xs [font-variant-ligatures:none]">
                  <ValueChip value={chipValue(bit)} />→<ValueChip value={chipValue(after)} changed={changed} />
                </span>
              );
            })}
          </div>
          <Why>{result.why}</Why>
          <p className="text-muted-foreground">
            <code className="font-mono">$isunknown(a)</code> = {hasUnknown(src) ? "1" : "0"}, <code className="font-mono">$isunknown(t)</code> ={" "}
            {hasUnknown(result.bits) ? "1" : "0"}. {hasUnknown(src) && !hasUnknown(result.bits) ? "After the copy the evidence is gone: check before you convert." : ""}
          </p>
        </div>
      </PredictionPrompt>
      <DefaultsTable />
    </div>
  );
}

function DefaultsTable() {
  const rows: { decl: string; bits: Bit4[] }[] = [
    { decl: "logic [3:0] v;", bits: defaultVariableValue("logic", 4) },
    { decl: "integer n;", bits: defaultVariableValue("integer") },
    { decl: "bit [3:0] v;", bits: defaultVariableValue("bit", 4) },
    { decl: "int i;", bits: defaultVariableValue("int") },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[260px] border-collapse text-left text-sm">
        <caption className="mb-1 text-left text-xs text-muted-foreground">Value before any assignment (Table 6-7): 4-state starts at x, 2-state at 0</caption>
        <thead>
          <tr>
            <th scope="col" className="border border-border/60 px-2 py-1">Declaration</th>
            <th scope="col" className="border border-border/60 px-2 py-1">Starts as</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.decl}>
              <td className="border border-border/60 px-2 py-1 font-mono [font-variant-ligatures:none]">{r.decl}</td>
              <td className="border border-border/60 px-2 py-1 font-mono [font-variant-ligatures:none]">
                {r.bits.length > 8 ? `${r.bits.length}'b${r.bits[0]}…${r.bits[0]}` : formatLiteral(r.bits)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function LogicStateDiagram() {
  const [tab, setTab] = useState<Tab>("operators");
  return (
    <VisualFrame
      label="Four-state value explorer"
      eyebrow="Picture + experiment"
      title="Four values, one unknown"
      summary="Predict first, then reveal. Each tab runs the IEEE 1800-2023 rule for one place where x and z behave differently."
      fidelity="model"
      assumptions={FOUR_STATE_ASSUMPTIONS}
    >
      <FourValuePicture />
      <SegmentedControl
        label="Explorer tab"
        value={tab}
        onChange={setTab}
        options={[
          { value: "operators", label: "Operator tables" },
          { value: "equality", label: "== vs ===" },
          { value: "control", label: "if / case with x" },
          { value: "twostate", label: "Into 2-state" },
        ]}
      />
      <div className="min-w-0">
        {tab === "operators" ? <OperatorsTab /> : null}
        {tab === "equality" ? <EqualityTab /> : null}
        {tab === "control" ? <ControlTab /> : null}
        {tab === "twostate" ? <TwoStateTab /> : null}
      </div>
    </VisualFrame>
  );
}
