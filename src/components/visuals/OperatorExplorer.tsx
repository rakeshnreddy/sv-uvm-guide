"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { BitStrip } from "@/components/visual-system/BitStrip";
import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { valueStyles } from "@/components/visual-system/visual-language";
import {
  bitAt,
  bitsOf,
  bitVectorReport,
  bitwiseRows,
  concatTargetDetail,
  conditionalDetail,
  declToSource,
  equalityFamily,
  formatCompact,
  fromBits,
  insideDetail,
  operatorCatalog,
  operatorDecls,
  operatorFamilies,
  operatorPredictionOptions,
  operatorPresets,
  operatorTemplate,
  parseExpression,
  parseLiteral,
  predictionVerdict,
  reductionFold,
  reinterpret,
  replCount,
  runOperator,
  slotName,
  streamBlocks,
  toBigInt,
  truthOf,
  typeToSource,
  type Bit4,
  type OperandSlot,
  type OperatorFamily,
  type OperatorInputs,
  type OperatorPreset,
  type OperatorSpec,
  type SvValue,
  type UnaryOp,
} from "@/lib/sv-expression-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Implements the IEEE 1800-2023 §11.4 operators on 4-state integral operands, with the truth tables of §11.4.8–11.4.9, Table 11-20 for ?: (§11.4.11) and the size rules of §11.6.",
  "Operands are logic vectors you edit bit by bit; z behaves like x on the bitwise, logical, arithmetic and ?: tables.",
  "inside is shown with singular values and constant ranges; unpacked-array members are not modelled.",
  "The bit vector functions follow §20.9: $countbits counts bits that match a control value, so x and z never count as 1; $onehot, $onehot0 and $isunknown return a bit and are never x.",
  "Streaming is shown as an expression result (its own width). Assigned to a wider variable it is left-aligned (§11.4.14).",
];

const bits = (s: string) => s.split("") as Bit4[];

/** Curated starting values per family: each one exposes the family's key 4-state behaviour. */
const FAMILY_DEFAULTS: Record<OperatorFamily, OperatorInputs> = {
  bitwise: { a: bits("10xz"), b: bits("0110"), c: bits("0000"), n: bits("001"), signedA: false },
  reduction: { a: bits("1x11"), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: false },
  logical: { a: bits("0x00"), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: false },
  equality: { a: bits("1x10"), b: bits("1x10"), c: bits("0000"), n: bits("001"), signedA: false },
  inside: { a: bits("1010"), b: bits("1x1x"), c: bits("0000"), n: bits("001"), signedA: false },
  conditional: { a: bits("1100"), b: bits("1010"), c: bits("x"), n: bits("001"), signedA: false },
  shift: { a: bits("1000"), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: true },
  concat: { a: bits("1100"), b: bits("0011"), c: bits("0000"), n: bits("001"), signedA: false },
  bitcount: { a: bits("0100"), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: false },
  stream: { a: bitsOf(parseLiteral("16'hA55A").value), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: false },
};

const STREAM_PRESETS = ["16'hA55A", "16'h1234", "16'hF00D"];

const NEXT_BIT: Record<Bit4, Bit4> = { "0": "1", "1": "x", x: "z", z: "0" };

const MIN_WIDTH = 1;
const MAX_WIDTH = 32;
const MAX_REPL = 8;

/** Keep the low `w` bits of a pattern, or pad it on the left with 0 to `w` bits. */
function fitWidth(pattern: Bit4[], w: number): Bit4[] {
  if (pattern.length >= w) return pattern.slice(pattern.length - w);
  return [...Array<Bit4>(w - pattern.length).fill("0"), ...pattern];
}

/** Operators whose template names a fixed bit of `a` (`n[3]`), so `a` keeps its own width whatever the `width` prop says. */
const FIXED_WIDTH_SPECS = new Set(["sign-extend"]);

/**
 * Fit the a/b/c vectors of `inputs` to the `width` prop. The ?: condition stays
 * 1 bit, and the operand of a fixed-width operator keeps its declared width.
 */
function fitInputs(inputs: Partial<OperatorInputs>, family: OperatorFamily, spec: OperatorSpec, width?: number): Partial<OperatorInputs> {
  if (width === undefined) return inputs;
  const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
  const out = { ...inputs };
  for (const slot of ["a", "b", "c"] as const) {
    const bitsIn = inputs[slot];
    const fixed = (slot === "c" && family === "conditional") || (slot === "a" && FIXED_WIDTH_SPECS.has(spec.id));
    if (bitsIn && !fixed) out[slot] = fitWidth(bitsIn, w);
  }
  return out;
}

/** Starting inputs for a family and operator: family defaults under the operator's own defaults, every vector fitted to the `width` prop. */
function baseInputs(family: OperatorFamily, spec: OperatorSpec, width?: number): OperatorInputs {
  const merged: OperatorInputs = { ...FAMILY_DEFAULTS[family], ...(spec.defaults ?? {}) };
  return { ...merged, ...fitInputs(merged, family, spec, width) };
}

/**
 * The preset whose operator and operand values are exactly what is loaded, if
 * any. Its note states what to notice about the result, so it is rendered only
 * inside the prediction gate (never as a tooltip).
 */
function matchingPreset(spec: OperatorSpec, inputs: OperatorInputs): OperatorPreset | undefined {
  return operatorPresets.find(
    (p) =>
      p.specId === spec.id &&
      (Object.keys(p.inputs) as (keyof OperatorInputs)[]).every((k) => {
        const want = p.inputs[k];
        const have = inputs[k];
        return Array.isArray(want) ? Array.isArray(have) && want.join("") === have.join("") : want === have;
      }),
  );
}

function bitClass(b: Bit4): string {
  if (b === "x") return valueStyles.unknown.className;
  if (b === "z") return valueStyles.highz.className;
  if (b === "1") return valueStyles.one.className;
  return valueStyles.zero.className;
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1 font-mono text-[0.92em] [font-variant-ligatures:none]">{children}</code>
);

/** Editable operand: one button per bit, MSB first. Each press cycles 0 → 1 → x → z. */
function BitEditor({ name, value, onChange, signed }: { name: string; value: Bit4[]; onChange: (next: Bit4[]) => void; signed?: boolean }) {
  const w = value.length;
  const groups: number[][] = [];
  value.forEach((_, k) => {
    const index = w - 1 - k;
    if (groups.length === 0 || (index + 1) % 4 === 0) groups.push([]);
    groups[groups.length - 1].push(k);
  });
  return (
    <div role="group" aria-label={`Operand ${name}, ${w} bit${w === 1 ? "" : "s"}`} className="min-w-0 space-y-1">
      <p className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
        {name} = {formatCompact(reinterpret(fromBits(value), false))}
        {signed ? " (signed)" : ""}
      </p>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {groups.map((g) => (
          <span key={g[0]} className="inline-flex gap-0.5">
            {g.map((k) => {
              const bit = value[k];
              const index = w - 1 - k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange(value.map((b, j) => (j === k ? NEXT_BIT[b] : b)))}
                  aria-label={`${name} bit ${index} is ${bit}; press to change to ${NEXT_BIT[bit]}`}
                  className={cn(
                    "flex h-10 w-7 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                    bitClass(bit),
                  )}
                >
                  {bit}
                </button>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Read-only bit strip with optional per-bit marks (vacated, wildcard). */
function Strip({ value, label, marks }: { value: SvValue; label: string; marks?: Record<number, string> }) {
  const all = bitsOf(value);
  const markNote = marks && Object.keys(marks).length ? `; marked bits: ${Object.entries(marks).map(([i, m]) => `${i} ${m}`).join(", ")}` : "";
  return (
    <span role="img" aria-label={`${label}: ${formatCompact(reinterpret(value, false))}${markNote}`} className="inline-flex flex-wrap gap-px font-mono [font-variant-ligatures:none]">
      {all.map((b, k) => {
        const index = value.width - 1 - k;
        const mark = marks?.[index];
        return (
          <span key={k} className={cn("flex w-5 flex-col items-center", index % 4 === 3 && k !== 0 && "ml-1")}>
            <span className={cn("flex h-6 w-5 items-center justify-center rounded-[3px] border text-[11px] font-semibold", bitClass(b), mark && "border-dashed")}>{b}</span>
            <span aria-hidden className="h-3 text-[9px] leading-3 text-muted-foreground">
              {mark ?? ""}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Replication count field: a constant from 0 to 8 (§11.4.12.1). */
function ReplCountField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(String(value));
  }
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span>
        Replication count <span className="font-mono [font-variant-ligatures:none]">R (0 … {MAX_REPL})</span>
      </span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_REPL}
        step={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_REPL) onChange(n);
        }}
        onBlur={() => setDraft(String(value))}
        className="h-10 w-full max-w-[8rem] rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Family-specific explanations (rendered from model helpers)
// ---------------------------------------------------------------------------

function BitwiseDetail({ spec, a, b }: { spec: OperatorSpec; a: SvValue; b: SvValue }) {
  const node = parseExpression(spec.template);
  const op = node.kind === "binary" ? (node.op as "&" | "|" | "^" | "~^") : "~";
  const rows = bitwiseRows(op, a, op === "~" ? undefined : b);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[260px] border-collapse text-left font-mono text-xs [font-variant-ligatures:none]">
        <caption className="mb-1 text-left font-sans text-xs text-muted-foreground">Bit by bit, using the truth table ({spec.clause})</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="px-2 py-1">bit</th>
            <th scope="col" className="px-2 py-1">a</th>
            {op !== "~" ? <th scope="col" className="px-2 py-1">b</th> : null}
            <th scope="col" className="px-2 py-1">result</th>
            <th scope="col" className="px-2 py-1">rule</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-t border-border/60">
              <td className="px-2 py-1">{r.index}</td>
              <td className="px-2 py-1">{r.a}</td>
              {op !== "~" ? <td className="px-2 py-1">{r.b}</td> : null}
              <td className="px-2 py-1">
                <ValueChip value={r.result} />
              </td>
              <td className="px-2 py-1 text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReductionDetail({ spec, a }: { spec: OperatorSpec; a: SvValue }) {
  const node = parseExpression(spec.template);
  const op: UnaryOp = node.kind === "unary" ? node.op : "&";
  const fold = reductionFold(op, a);
  const core = op.replace("~", "") || "&";
  return (
    <ol className="space-y-1 font-mono text-xs [font-variant-ligatures:none]" aria-label="Reduction fold">
      <li className="text-muted-foreground">start with bit {a.width - 1} = {bitAt(a, a.width - 1)}</li>
      {fold.steps.map((s) => (
        <li key={s.index}>
          {s.acc} {core} {s.bit} <span className="text-muted-foreground">(bit {s.index})</span> = {s.result}
        </li>
      ))}
      {fold.inverted ? (
        <li>
          ~{fold.base} = {fold.result} <span className="text-muted-foreground">(the ~ form inverts the reduction)</span>
        </li>
      ) : null}
    </ol>
  );
}

function LogicalDetail({ spec, a, b }: { spec: OperatorSpec; a: SvValue; b: SvValue }) {
  const describe = (name: string, v: SvValue) => {
    const t = truthOf(v);
    return (
      <li key={name}>
        <Code>{name}</Code> = {formatCompact(reinterpret(v, false))} → truth value <ValueChip value={t} />{" "}
        <span className="text-muted-foreground">{t === "1" ? "(has a 1 bit)" : t === "0" ? "(every bit is 0)" : "(no 1 bit, but an x/z bit)"}</span>
      </li>
    );
  };
  return <ul className="space-y-1 text-sm">{[describe("a", a), ...(spec.operands.includes("b") ? [describe("b", b)] : [])]}</ul>;
}

function EqualityDetail({ a, b }: { a: SvValue; b: SvValue }) {
  const fam = equalityFamily(a, b);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm" aria-label="The three equality operators on the same operands">
        {(
          [
            ["a == b", fam.logical, "§11.4.5"],
            ["a === b", fam.caseEq, "§11.4.5"],
            ["a ==? b", fam.wildcard, "§11.4.6"],
          ] as const
        ).map(([src, v, clause]) => (
          <span key={src} className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-2 py-1">
            <Code>{src}</Code> <ValueChip value={v} /> <span className="font-mono text-[10px] text-muted-foreground">{clause}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[260px] border-collapse text-left font-mono text-xs [font-variant-ligatures:none]">
          <caption className="mb-1 text-left font-sans text-xs text-muted-foreground">How each bit pair counts</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-1">bit</th>
              <th scope="col" className="px-2 py-1">a</th>
              <th scope="col" className="px-2 py-1">b</th>
              <th scope="col" className="px-2 py-1">for ==</th>
              <th scope="col" className="px-2 py-1">for ==?</th>
            </tr>
          </thead>
          <tbody>
            {fam.bits.map((r) => (
              <tr key={r.index} className="border-t border-border/60">
                <td className="px-2 py-1">{r.index}</td>
                <td className="px-2 py-1">{r.a}</td>
                <td className="px-2 py-1">{r.b}</td>
                <td className="px-2 py-1">{r.known === "match" ? "✓ match" : r.known === "mismatch" ? "✕ differs" : "? unknown"}</td>
                <td className="px-2 py-1">{r.wildcard ? "★ wildcard (b is x/z)" : r.known === "match" ? "✓ match" : r.known === "mismatch" ? "✕ differs" : "? unknown (a is x/z)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsideDetail({ a, b, c }: { a: SvValue; b: SvValue; c: SvValue }) {
  const det = insideDetail(a, [b, c]);
  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        {det.members.map((m, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs [font-variant-ligatures:none]">member {i === 0 ? "b" : "c"} = {formatCompact(reinterpret(m.value, false))}:</span>
            <span className="inline-flex items-center gap-1">
              <Code>a ==? {i === 0 ? "b" : "c"}</Code> <ValueChip value={m.wildcard} />
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              (<Code>a === {i === 0 ? "b" : "c"}</Code> would be <ValueChip value={m.caseEq} />)
            </span>
          </li>
        ))}
      </ul>
      <p>
        <strong>inside</strong> = OR of the <Code>==?</Code> results = <ValueChip value={det.result} />
        {det.ifCaseEquality !== det.result ? (
          <span className="text-rose-700 dark:text-rose-300">
            {" "}
            ✕ If inside used <Code>===</Code>, the answer would be {det.ifCaseEquality}.
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ShiftDetail({ spec, a, n, result }: { spec: OperatorSpec; a: SvValue; n: SvValue; result: SvValue }) {
  const k = toBigInt(n, false);
  const isRight = spec.id === "shr" || spec.id === "ashr";
  const s = k === null ? 0 : Math.min(Number(k), a.width);
  const marks: Record<number, string> = {};
  if (k !== null) {
    for (let i = 0; i < s; i += 1) marks[isRight ? a.width - 1 - i : i] = isRight ? (spec.id === "ashr" && a.signed ? "S" : "0") : "0";
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Strip value={a} label="a before the shift" />
      <span aria-hidden>→</span>
      <Strip value={result} label="after the shift" marks={marks} />
      <span className="text-xs text-muted-foreground">
        {k === null
          ? "The count has x/z bits, so every result bit is x."
          : `Shift by ${k.toString()}; marked bits are vacated (0 = zero fill, S = copy of the sign bit).`}
      </span>
    </div>
  );
}

function StreamDetail({ spec, a }: { spec: OperatorSpec; a: SvValue }) {
  const node = parseExpression(spec.template);
  const dir = node.kind === "stream" ? node.dir : "<<";
  const slice = node.kind === "stream" ? node.slice : 1;
  const { input, output } = streamBlocks(bitsOf(a), dir, slice);
  const shown = slice === 1 && dir === "<<" ? null : { input, output };
  // When bit reversal and byte swap coincide (e.g. 16'hA55A), say so: the value cannot tell them apart.
  const reorder = (k: number) => streamBlocks(bitsOf(a), "<<", k).output.flat().join("");
  const ambiguous = dir === "<<" && a.width >= 16 && reorder(1) === reorder(8);
  return (
    <div className="space-y-2 text-sm">
      {ambiguous ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-xs text-foreground">
          For this value, a bit reversal and a byte swap give the same result, so the value alone cannot tell you which one ran. Load a = 16&apos;h1234 to see them
          differ.
        </p>
      ) : null}
      {shown ? (
        <>
          <p className="text-xs text-muted-foreground">
            Cut into {slice}-bit blocks from the right, then {dir === "<<" ? "the block order is reversed" : "kept in order"} (bits inside a block never move):
          </p>
          {(
            [
              ["in", shown.input],
              ["out", shown.output],
            ] as const
          ).map(([tag, blocks]) => (
            <div key={tag} className="flex flex-wrap items-center gap-2 font-mono text-xs [font-variant-ligatures:none]">
              <span className="w-8 text-muted-foreground">{tag}</span>
              {blocks.map((blk, i) => (
                <span key={i} className="rounded border border-border/70 px-1.5 py-0.5">
                  {blk.join("")}
                </span>
              ))}
            </div>
          ))}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Slice size 1: the stream is reversed bit by bit, so bit 0 becomes the MSB.</p>
      )}
    </div>
  );
}

/**
 * `c ? a : b` next to `if (c) y = a; else y = b;`, one row per bit (§11.4.11, Table 11-20, §12.4).
 * The rule (in the answer's feedback) gives the path; this adds only the values of this run.
 */
function MergeDetail({ spec, c, a, b }: { spec: OperatorSpec; c: SvValue; a: SvValue; b: SvValue }) {
  const det = conditionalDetail(c, a, b);
  const cName = slotName(spec, "c");
  const aName = slotName(spec, "a");
  const bName = spec.id === "cond-z" ? "'z" : slotName(spec, "b");
  const condText = det.truth === "x" ? "x/z (ambiguous)" : det.truth;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        <Code>{cName}</Code> is {condText}.{" "}
        {det.truth === "x" ? (
          <>
            <Code>{`${aName} == ${bName}`}</Code> is <ValueChip value={det.equivalent} />
            {det.equivalent === "1" ? ", so either branch is the result." : ", so the table below merges them."}
          </>
        ) : (
          <>Only the {det.truth === "1" ? "first" : "second"} branch is evaluated and returned.</>
        )}
      </p>
      <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" role="region" aria-label="Merge table, scrollable" tabIndex={0}>
        <table className="border-collapse text-left font-mono text-xs [font-variant-ligatures:none]">
          <caption className="mb-1 text-left font-sans text-xs text-muted-foreground">{det.merged ? "Merged bit by bit with Table 11-20" : "Table 11-20 for comparison: this run does not use it"}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-1">bit</th>
              <th scope="col" className="px-2 py-1">? branch ({aName})</th>
              <th scope="col" className="px-2 py-1">: branch ({bName})</th>
              <th scope="col" className="px-2 py-1">Table 11-20 cell</th>
              <th scope="col" className="px-2 py-1">result</th>
            </tr>
          </thead>
          <tbody>
            {det.rows.map((r) => (
              <tr key={r.index} className="border-t border-border/60">
                <td className="px-2 py-1">{r.index}</td>
                <td className="px-2 py-1">{r.then}</td>
                <td className="px-2 py-1">{r.otherwise}</td>
                <td className={cn("px-2 py-1", !det.merged && "text-muted-foreground")}>
                  {r.then} with {r.otherwise} → {r.cell}
                  {!det.merged ? <span className="ml-1 font-sans">(not used)</span> : null}
                </td>
                <td className="px-2 py-1">
                  <ValueChip value={r.result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div role="group" className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 px-3 py-2" aria-label="if/else contrast">
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">if/else</span>
        <Code>{`if (${cName}) y = ${aName}; else y = ${bName};`}</Code>
        <span aria-hidden>→</span>
        <Strip value={det.ifElse} label="if/else stores" />
        <span className="text-xs text-muted-foreground">
          {det.truth === "x" ? (
            <>
              <Code>if</Code> treats an x/z condition as false and runs <Code>else</Code> (§12.4), which hides the unknown.
            </>
          ) : (
            <>Same answer: a known condition picks the same branch in both forms.</>
          )}
        </span>
      </div>
    </div>
  );
}

/** The four §20.9 functions on the same vector, with their $countbits arithmetic. The rule, in the answer's feedback, says how x and z count. */
function BitcountDetail({ spec, state }: { spec: OperatorSpec; state: SvValue }) {
  const name = slotName(spec, "a");
  const report = bitVectorReport(state, name);
  const current = spec.template.slice(0, spec.template.indexOf("("));
  return (
    <div className="space-y-2 text-sm">
      <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" role="region" aria-label="Bit vector functions table, scrollable" tabIndex={0}>
        <table className="border-collapse text-left font-mono text-xs [font-variant-ligatures:none]">
          <caption className="mb-1 text-left font-sans text-xs text-muted-foreground">
            Every bit vector function on <Code>{name}</Code> = {formatCompact(reinterpret(state, false))} (§20.9)
          </caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-1">function</th>
              <th scope="col" className="px-2 py-1">$countbits arithmetic</th>
              <th scope="col" className="px-2 py-1">result</th>
              <th scope="col" className="px-2 py-1">returns</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r) => {
              const highlighted = spec.id === "onehot-guarded" ? r.fn === "$onehot" || r.fn === "$isunknown" : r.fn === current;
              return (
                <tr key={r.fn} className={cn("border-t border-border/60", highlighted && "bg-cyan-500/10")} aria-current={highlighted ? "true" : undefined}>
                  <td className="px-2 py-1">
                    {highlighted ? <span aria-hidden>▶ </span> : null}
                    {r.fn}({name})
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{r.arithmetic}</td>
                  <td className="px-2 py-1">
                    <ValueChip value={r.returnType === "bit" ? r.result.slice(-1) : r.result} />
                  </td>
                  <td className="px-2 py-1">{r.returnType}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {spec.id !== "onehot-guarded" ? (
        <p className="text-xs text-muted-foreground">
          A reset check wants <Code>{`$onehot(${name}) && !$isunknown(${name})`}</Code>.
        </p>
      ) : null}
    </div>
  );
}

/** `{hi, lo} = rhs;`: the value cut by member width, MSB first (§11.4.12). The rule and any resizing are in the answer's feedback, so this adds only the bits. */
function ConcatTargetDetail({ spec, inputs }: { spec: OperatorSpec; inputs: OperatorInputs }) {
  const det = concatTargetDetail(spec, inputs);
  if (!det.ok) return null;
  const segments = det.parts.map((p) => ({ hi: p.hi, lo: p.lo, label: p.name }));
  return (
    <div className="space-y-3 text-sm">
      <BitStrip bits={bitsOf(det.resized)} label={`${spec.targetRhs} cut by member width`} valueText={formatCompact(reinterpret(det.resized, false))} segments={segments} bitNumbers />
      <ul className="space-y-1" aria-label="Members after the assignment">
        {det.parts.map((p, i) => (
          <li key={p.name} className="flex flex-wrap items-center gap-2 font-mono text-xs [font-variant-ligatures:none]">
            <span>
              {p.name} [{p.hi}:{p.lo}]:
            </span>
            <span className="text-muted-foreground">{formatCompact(reinterpret(det.before[i].value, false))}</span>
            <span aria-hidden>→</span>
            <Strip value={p.value} label={`${p.name} after`} />
            <span>= {formatCompact(reinterpret(p.value, false))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `{{R{n[3]}}, n}`: the sign bit replicated in front of n. The rule, in the answer's feedback, says what the copies are; this adds width, sign and legality. */
function SignExtendDetail({ spec, inputs, result }: { spec: OperatorSpec; inputs: OperatorInputs; result: SvValue }) {
  const n = fromBits(inputs.a);
  const R = replCount(spec, inputs);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <BitStrip bits={bitsOf(n)} label={`${slotName(spec, "a")} with its sign bit`} valueText={formatCompact(reinterpret(n, false))} signBit={n.width - 1} />
        <span aria-hidden>→</span>
        <BitStrip bits={bitsOf(result)} label="result with the replicated bits" valueText={formatCompact(reinterpret(result, false))} extendedFrom={n.width} />
      </div>
      <p className="text-xs text-muted-foreground">
        {R === 0 ? (
          <>
            A zero replication is legal here because <Code>n</Code> has a positive width (§11.4.12.1).
          </>
        ) : (
          <>
            The result is {n.width + R} bits, unsigned as every concatenation is (§11.8.1). Read as a signed number it is {toBigInt(reinterpret(result, true))?.toString() ?? "x"}, the
            same as <Code>n</Code> ({toBigInt(reinterpret(n, true))?.toString() ?? "x"}).
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal announcements
// ---------------------------------------------------------------------------

/**
 * Mounted only while the reveal shows. PredictionPrompt unmounts the focused
 * button when the learner commits and mounts its feedback together with its
 * live region, so this moves focus to that feedback and fills a live region that
 * is always mounted. Both belong in PredictionPrompt; drop this once it does them.
 */
function RevealAnnouncer({ prompt, text, onAnnounce }: { prompt: React.RefObject<HTMLDivElement>; text: string; onAnnounce: (text: string) => void }) {
  useEffect(() => {
    const feedback = prompt.current?.querySelector<HTMLElement>("[aria-live]");
    if (!feedback) return;
    feedback.tabIndex = -1;
    feedback.focus();
  }, [prompt]);
  useEffect(() => {
    onAnnounce(text);
    return () => onAnnounce("");
  }, [text, onAnnounce]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface OperatorExplorerProps {
  family?: OperatorFamily;
  /** Load a named starting point (`operatorPresets`), which also selects its family and operator. */
  initialPreset?: string;
  /**
   * Operand width in bits for a, b and c (1–32), applied to the family defaults
   * and to each operator's own default values. Two exceptions: the ?: condition
   * stays 1 bit, and `{{R{n[3]}}, n}` keeps its 4-bit n because the template names bit 3.
   */
  width?: number;
}

/** The pressed look matches a checked SegmentedControl option, so the loaded preset is visible as well as announced. */
const PRESET_BUTTON =
  "min-h-10 rounded-lg border border-border/70 px-3 font-mono text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-cyan-500 aria-pressed:bg-cyan-500/15 aria-pressed:font-semibold [font-variant-ligatures:none]";

const firstSpec = (f: OperatorFamily) => operatorCatalog.filter((s) => s.family === f)[0];

export default function OperatorExplorer({ family: initialFamily, initialPreset, width }: OperatorExplorerProps) {
  const preset = initialPreset ? operatorPresets.find((p) => p.id === initialPreset) : undefined;
  const startFamily = preset?.family ?? initialFamily ?? "bitwise";
  // A lesson that names its family keeps the others one click away, so the question stays near the top on a phone.
  const pinned = preset !== undefined || initialFamily !== undefined;
  const startSpec = (preset ? operatorCatalog.find((s) => s.id === preset.specId) : undefined) ?? firstSpec(startFamily);
  const [family, setFamily] = useState<OperatorFamily>(startFamily);
  const specs = operatorCatalog.filter((s) => s.family === family);
  const [specId, setSpecId] = useState(startSpec.id);
  const spec = specs.find((s) => s.id === specId) ?? specs[0];
  const [inputs, setInputs] = useState<OperatorInputs>(() => ({ ...baseInputs(startFamily, startSpec, width), ...(preset?.inputs ?? {}) }));

  const switchFamily = (f: OperatorFamily) => {
    const next = firstSpec(f);
    setFamily(f);
    setSpecId(next.id);
    setInputs(baseInputs(f, next, width));
  };
  const selectSpec = (id: string) => {
    const target = specs.find((s) => s.id === id);
    if (!target) return;
    setSpecId(target.id);
    if (target.defaults) setInputs((prev) => ({ ...prev, ...fitInputs(target.defaults ?? {}, family, target, width) }));
  };
  // The button that jumps unmounts with its aside, so focus moves to the operator it selected after the commit.
  const operatorPicker = useRef<HTMLDivElement>(null);
  const operatorFocusPending = useRef(false);
  useEffect(() => {
    if (!operatorFocusPending.current) return;
    operatorFocusPending.current = false;
    operatorPicker.current?.querySelector<HTMLElement>("[role='radio'][aria-checked='true']")?.focus();
  }, [specId]);
  const jumpTo = (id: string) => {
    const target = operatorCatalog.find((s) => s.id === id);
    if (!target) return;
    operatorFocusPending.current = true;
    setFamily(target.family);
    setSpecId(target.id);
    setInputs(baseInputs(target.family, target, width));
  };
  const applyPreset = (id: string) => {
    const p = operatorPresets.find((x) => x.id === id);
    if (!p) return;
    const target = operatorCatalog.find((s) => s.id === p.specId) ?? firstSpec(p.family);
    setFamily(p.family);
    setSpecId(target.id);
    setInputs({ ...baseInputs(p.family, target, width), ...p.inputs });
  };

  const template = operatorTemplate(spec, inputs);
  const result = useMemo(() => runOperator(spec, inputs), [spec, inputs]);
  const options = useMemo(() => operatorPredictionOptions(spec, inputs), [spec, inputs]);
  const decls = operatorDecls(spec, inputs);
  const resultWidth = result.ok ? result.value.width : Math.max(inputs.a.length, inputs.b.length);
  const yDecl = { name: "y", type: "logic" as const, width: resultWidth };
  const typeColumn = Math.max(...[...decls, ...(family === "conditional" ? [yDecl] : [])].map((d) => typeToSource(d).length));
  // %0d for the function that returns an int: %b would print all 32 of its bits.
  const displayFormat = family === "bitcount" && result.ok && result.value.width === 32 ? "%0d" : "%b";
  const statement = spec.targetRhs ? `${template};` : family === "conditional" ? `y = ${template};` : `$display("${displayFormat}", ${template});`;
  const lines: CodeTraceLine[] = [
    ...decls.map((d) => ({ text: declToSource(d, typeColumn), key: d.name })),
    ...(family === "conditional" ? [{ text: declToSource(yDecl, typeColumn), key: "y" }] : []),
    { text: statement, key: "expr" },
  ];
  const resetKey = JSON.stringify([spec.id, inputs]);
  const set = (slot: OperandSlot) => (next: Bit4[]) => setInputs((prev) => ({ ...prev, [slot]: next }));
  const presets = operatorPresets.filter((p) => p.family === family);
  const activePreset = matchingPreset(spec, inputs);
  const hasRepl = /\bR\b/.test(spec.template);
  // An operand editor is only worth showing while its value can change the answer: code that does not compile has no value to change.
  const showOperands = !spec.fixedAnswer && result.ok;
  // The correct answer's feedback always shows in the reveal, so a rule it already states is not repeated.
  // For code that does not compile that feedback is the compiler's message, which is the rule for this code.
  const ruleInFeedback = !result.ok || (options.find((o) => o.correct)?.feedback.includes(spec.rule) ?? false);
  const promptRef = useRef<HTMLDivElement>(null);
  const [verdict, setVerdict] = useState("");

  const a = fromBits(inputs.a, inputs.signedA);
  const b = fromBits(inputs.b);
  const c = fromBits(inputs.c);
  const n = fromBits(inputs.n);

  const question = spec.targetRhs ? (
    <>
      After <Code>{statement}</Code>, what do <Code>{slotName(spec, "a")}</Code> and <Code>{slotName(spec, "b")}</Code> hold?
    </>
  ) : family === "conditional" ? (
    <>
      What does <Code>{statement}</Code> store in <Code>y</Code>?
    </>
  ) : (
    <>
      What does <Code>{template}</Code> produce?
    </>
  );

  const familyPicker = <SegmentedControl label="Operator family" options={operatorFamilies.map((f) => ({ value: f.id, label: f.label }))} value={family} onChange={switchFamily} />;

  return (
    <VisualFrame
      label="Four-state operator explorer"
      eyebrow="Experiment"
      title="Four-state operator explorer"
      summary="Choose an operator, set each operand bit to 0, 1, x or z, predict the result, then reveal how the LRM's tables produce it."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      {(family === "bitwise" || family === "reduction") && spec.id !== "binary-nand" ? (
        <aside aria-label="Common misconception" className="rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">✕ A classic misconception</p>
          <p className="mt-1 text-foreground">
            There is no binary <Code>~&amp;</Code>. <Code>~&amp;a</Code> is the unary reduction NAND; a bitwise NAND is <Code>~(a &amp; b)</Code>.{" "}
            <button type="button" onClick={() => jumpTo("binary-nand")} className="inline-flex min-h-10 items-center text-xs font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300">
              Try a ~&amp; b
            </button>
          </p>
        </aside>
      ) : null}

      <div className="space-y-2">
        {pinned ? (
          <details>
            <summary className="cursor-pointer py-3 text-xs font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300">
              More operators
            </summary>
            <div className="mt-2">{familyPicker}</div>
          </details>
        ) : (
          familyPicker
        )}
        <div ref={operatorPicker}>
          <SegmentedControl
            label="Operator"
            options={specs.map((s) => ({ value: s.id, label: s.trap ? `${s.template} ⚠` : s.template, ariaLabel: s.trap ? `${s.template} (trap)` : s.template }))}
            value={spec.id}
            onChange={selectSpec}
            mono
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Governing clause: <span className="font-mono [font-variant-ligatures:none]">{spec.clause}</span>. The rule appears after you predict.
        </p>
      </div>

      {showOperands || hasRepl || presets.length > 0 ? (
        <div className="grid gap-3 rounded-xl border border-border/70 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,136px),1fr))]">
          {showOperands
            ? spec.operands.map((slot) => <BitEditor key={slot} name={slotName(spec, slot)} value={inputs[slot]} onChange={set(slot)} signed={slot === "a" && inputs.signedA} />)
            : null}
          {hasRepl ? <ReplCountField value={replCount(spec, inputs)} onChange={(r) => setInputs((prev) => ({ ...prev, repl: r }))} /> : null}
          {family === "shift" ? (
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-cyan-500" checked={inputs.signedA} onChange={(e) => setInputs((prev) => ({ ...prev, signedA: e.target.checked }))} />
              declare <Code>a</Code> as <Code>logic signed</Code>
            </label>
          ) : null}
          {family === "stream" ? (
            <div role="group" aria-label="Stream presets" className="col-span-full flex flex-wrap items-center gap-2">
              {STREAM_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={inputs.a.join("") === bitsOf(parseLiteral(p).value).join("")}
                  onClick={() => setInputs((prev) => ({ ...prev, a: bitsOf(parseLiteral(p).value) }))}
                  className={PRESET_BUTTON}
                >
                  a = {p}
                </button>
              ))}
            </div>
          ) : null}
          {presets.length > 0 ? (
            <div role="group" aria-label="Presets" className="col-span-full flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Presets</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={activePreset?.id === p.id}
                  onClick={() => applyPreset(p.id)}
                  className={PRESET_BUTTON}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <CodeTrace label="The code" lines={lines} />

      <div>
        <p role="status" aria-label="Prediction verdict" className="sr-only">
          {verdict}
        </p>
        <div ref={promptRef}>
          <PredictionPrompt
            resetKey={resetKey}
            question={question}
            options={options.map((o) => ({
              id: o.id,
              label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>,
              correct: o.correct,
              feedback: o.feedback.replace(/`/g, ""),
            }))}
          >
            {({ committed }) => (
              <div className="space-y-3">
                <RevealAnnouncer prompt={promptRef} text={predictionVerdict(options, committed)} onAnnounce={setVerdict} />
                {!ruleInFeedback ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Rule: </strong>
                    {spec.rule} <span className="font-mono text-[11px]">({spec.clause})</span>
                  </p>
                ) : null}
                {activePreset ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Notice: </strong>
                    {activePreset.note}
                  </p>
                ) : null}
                {!result.ok ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">Result:</span>
                    <span className="rounded-md border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-800 dark:text-rose-200">✕ Compile error</span>
                    <span className="text-xs text-muted-foreground">no value: this code never runs</span>
                  </p>
                ) : (
                  <>
                    {!spec.targetRhs ? (
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">Result:</span>
                        {result.value.width === 1 ? (
                          <ValueChip name={template} value={bitAt(result.value, 0)} />
                        ) : family === "bitcount" ? (
                          <ValueChip name={template} value={toBigInt(result.value)?.toString() ?? "x"} />
                        ) : (
                          <Strip value={result.value} label={`${template} result`} />
                        )}
                        <span className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
                          {family === "bitcount" && result.value.width === 32
                            ? `int (32 bits, signed) = ${toBigInt(result.value)?.toString() ?? "x"}`
                            : `${formatCompact(reinterpret(result.value, false))} · ${result.value.width} bit${result.value.width === 1 ? "" : "s"}, ${result.signed ? "signed" : "unsigned"}`}
                        </span>
                      </p>
                    ) : null}
                    {family === "bitwise" ? <BitwiseDetail spec={spec} a={a} b={b} /> : null}
                    {family === "reduction" ? <ReductionDetail spec={spec} a={a} /> : null}
                    {family === "logical" ? <LogicalDetail spec={spec} a={a} b={b} /> : null}
                    {family === "equality" ? <EqualityDetail a={a} b={b} /> : null}
                    {family === "inside" ? <InsideDetail a={a} b={b} c={c} /> : null}
                    {family === "conditional" ? <MergeDetail spec={spec} c={c} a={a} b={spec.id === "cond-z" ? fromBits(Array<Bit4>(a.width).fill("z")) : b} /> : null}
                    {family === "shift" ? <ShiftDetail spec={spec} a={a} n={n} result={result.value} /> : null}
                    {family === "bitcount" ? <BitcountDetail spec={spec} state={fromBits(inputs.a)} /> : null}
                    {family === "stream" ? <StreamDetail spec={spec} a={a} /> : null}
                    {family === "concat" && spec.targetRhs ? <ConcatTargetDetail spec={spec} inputs={inputs} /> : null}
                    {family === "concat" && spec.id === "sign-extend" ? <SignExtendDetail spec={spec} inputs={inputs} result={result.value} /> : null}
                    {family === "concat" && !spec.targetRhs && spec.id !== "sign-extend" ? (
                      <p className="text-sm text-muted-foreground">
                        {spec.id === "repl-n"
                          ? `${replCount(spec, inputs)} cop${replCount(spec, inputs) === 1 ? "y" : "ies"} of a: ${result.value.width} bits in all.`
                          : `a takes bits [${result.value.width - 1}:${inputs.b.length}] and b takes bits [${inputs.b.length - 1}:0]: ${result.value.width} bits in all.`}
                      </p>
                    ) : null}
                  </>
                )}
                {family === "inside" ? (
                  <aside aria-label="Common misconception" className="rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-3 text-sm text-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">✕ A classic misconception</p>
                    <p className="mt-1">
                      <Code>inside</Code> is not case equality: it compares with <Code>==?</Code>, so x/z bits in a set member are wildcards.
                    </p>
                  </aside>
                ) : null}
              </div>
            )}
          </PredictionPrompt>
        </div>
      </div>
    </VisualFrame>
  );
}
