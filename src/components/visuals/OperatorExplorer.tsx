"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { valueStyles } from "@/components/visual-system/visual-language";
import {
  bitAt,
  bitsOf,
  bitwiseRows,
  declToSource,
  equalityFamily,
  formatCompact,
  fromBits,
  insideDetail,
  operatorCatalog,
  operatorDecls,
  operatorFamilies,
  operatorPredictionOptions,
  parseExpression,
  parseLiteral,
  reductionFold,
  reinterpret,
  runOperator,
  streamBlocks,
  toBigInt,
  truthOf,
  typeToSource,
  type Bit4,
  type OperandSlot,
  type OperatorFamily,
  type OperatorInputs,
  type OperatorSpec,
  type SvValue,
  type UnaryOp,
} from "@/lib/sv-expression-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Implements the IEEE 1800-2023 §11.4 operators on 4-state integral operands, with the truth tables of §11.4.8–11.4.9 and the size rules of §11.6.",
  "Operands are logic vectors you edit bit by bit; z behaves like x on every operator input, as the LRM tables specify.",
  "inside is shown with singular values and constant ranges; unpacked-array members are not modelled.",
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
  shift: { a: bits("1000"), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: true },
  concat: { a: bits("1100"), b: bits("0011"), c: bits("0000"), n: bits("001"), signedA: false },
  stream: { a: bitsOf(parseLiteral("16'hA55A").value), b: bits("0000"), c: bits("0000"), n: bits("001"), signedA: false },
};

const STREAM_PRESETS = ["16'hA55A", "16'h1234", "16'hF00D"];

const NEXT_BIT: Record<Bit4, Bit4> = { "0": "1", "1": "x", x: "z", z: "0" };

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
    <div role="group" aria-label={`Operand ${name}, ${w} bits`} className="space-y-1">
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OperatorExplorer({ family: initialFamily = "bitwise" }: { family?: OperatorFamily }) {
  const [family, setFamily] = useState<OperatorFamily>(initialFamily);
  const specs = operatorCatalog.filter((s) => s.family === family);
  const [specId, setSpecId] = useState(specs[0].id);
  const spec = specs.find((s) => s.id === specId) ?? specs[0];
  const [inputs, setInputs] = useState<OperatorInputs>(FAMILY_DEFAULTS[initialFamily]);

  const switchFamily = (f: OperatorFamily) => {
    setFamily(f);
    setSpecId(operatorCatalog.filter((s) => s.family === f)[0].id);
    setInputs(FAMILY_DEFAULTS[f]);
  };
  const jumpTo = (id: string) => {
    const target = operatorCatalog.find((s) => s.id === id);
    if (!target) return;
    setFamily(target.family);
    setSpecId(target.id);
    setInputs(FAMILY_DEFAULTS[target.family]);
  };

  const result = useMemo(() => runOperator(spec, inputs), [spec, inputs]);
  const options = useMemo(() => operatorPredictionOptions(spec, inputs), [spec, inputs]);
  const decls = operatorDecls(spec, inputs);
  const typeColumn = Math.max(...decls.map((d) => typeToSource(d).length));
  const lines: CodeTraceLine[] = [
    ...decls.map((d) => ({ text: declToSource(d, typeColumn), key: d.name })),
    { text: `$display("%b", ${spec.template});`, key: "expr" },
  ];
  const resetKey = JSON.stringify([spec.id, inputs]);
  const set = (slot: OperandSlot) => (next: Bit4[]) => setInputs((prev) => ({ ...prev, [slot]: next }));

  const a = fromBits(inputs.a, inputs.signedA);
  const b = fromBits(inputs.b);
  const c = fromBits(inputs.c);
  const n = fromBits(inputs.n);

  return (
    <VisualFrame
      label="Four-state operator explorer"
      eyebrow="Experiment"
      title="Four-state operator explorer"
      summary="Choose an operator, set each operand bit to 0, 1, x or z, predict the result, then reveal how the LRM's tables produce it."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <aside aria-label="Common misconceptions" className="rounded-xl border border-rose-500/40 bg-rose-500/[0.05] p-3 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">✕ Two classic misconceptions</p>
        <ul className="mt-1 space-y-1 text-foreground">
          <li>
            There is no binary <Code>~&amp;</Code>. <Code>~&amp;a</Code> is the unary reduction NAND; a bitwise NAND is <Code>~(a &amp; b)</Code>.{" "}
            <button type="button" onClick={() => jumpTo("binary-nand")} className="text-xs font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300">
              Try a ~&amp; b
            </button>
          </li>
          <li>
            <Code>inside</Code> is not case equality: it compares with <Code>==?</Code>, so x/z bits in a set member are wildcards.{" "}
            <button type="button" onClick={() => jumpTo("inside")} className="text-xs font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300">
              Try inside
            </button>
          </li>
        </ul>
      </aside>

      <div className="space-y-2">
        <SegmentedControl label="Operator family" options={operatorFamilies.map((f) => ({ value: f.id, label: f.label }))} value={family} onChange={switchFamily} />
        <SegmentedControl
          label="Operator"
          options={specs.map((s) => ({ value: s.id, label: s.trap ? `${s.template} ⚠` : s.template, ariaLabel: s.trap ? `${s.template} (trap: ${s.trap})` : s.template }))}
          value={spec.id}
          onChange={setSpecId}
          mono
        />
        <p className="text-xs text-muted-foreground">
          Governing clause: <span className="font-mono [font-variant-ligatures:none]">{spec.clause}</span>. The rule appears after you predict.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 p-3 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {spec.operands.map((slot) => (
          <BitEditor key={slot} name={slot} value={inputs[slot]} onChange={set(slot)} signed={slot === "a" && inputs.signedA} />
        ))}
        {family === "shift" ? (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-cyan-500" checked={inputs.signedA} onChange={(e) => setInputs((prev) => ({ ...prev, signedA: e.target.checked }))} />
            declare <Code>a</Code> as <Code>logic signed</Code>
          </label>
        ) : null}
        {family === "stream" ? (
          <div role="group" aria-label="Stream presets" className="flex flex-wrap items-center gap-2">
            {STREAM_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInputs((prev) => ({ ...prev, a: bitsOf(parseLiteral(p).value) }))}
                className="min-h-10 rounded-lg border border-border/70 px-3 font-mono text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [font-variant-ligatures:none]"
              >
                a = {p}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <CodeTrace label="The code" lines={lines} />

      <PredictionPrompt
        resetKey={resetKey}
        question={
          <>
            What does <Code>{spec.template}</Code> produce?
          </>
        }
        options={options.map((o) => ({
          id: o.id,
          label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>,
          correct: o.correct,
          feedback: o.feedback.replace(/`/g, ""),
        }))}
      >
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Rule: </strong>
            {spec.rule} <span className="font-mono text-[11px]">({spec.clause})</span>
          </p>
          {!result.ok ? (
            <p className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              ✕ Compile error: {result.error.message} <span className="font-mono text-[11px]">({result.error.clause})</span>
            </p>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Result:</span>
                {result.value.width === 1 ? <ValueChip name={spec.template} value={bitAt(result.value, 0)} /> : <Strip value={result.value} label={`${spec.template} result`} />}
                <span className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
                  {formatCompact(reinterpret(result.value, false))} · {result.value.width} bit{result.value.width === 1 ? "" : "s"}, {result.signed ? "signed" : "unsigned"}
                </span>
              </p>
              {family === "bitwise" ? <BitwiseDetail spec={spec} a={a} b={b} /> : null}
              {family === "reduction" ? <ReductionDetail spec={spec} a={a} /> : null}
              {family === "logical" ? <LogicalDetail spec={spec} a={a} b={b} /> : null}
              {family === "equality" ? <EqualityDetail a={a} b={b} /> : null}
              {family === "inside" ? <InsideDetail a={a} b={b} c={c} /> : null}
              {family === "shift" ? <ShiftDetail spec={spec} a={a} n={n} result={result.value} /> : null}
              {family === "stream" ? <StreamDetail spec={spec} a={a} /> : null}
              {family === "concat" ? (
                <p className="text-sm text-muted-foreground">
                  Each operand keeps its own width (self-determined) and the first one lands in the most significant bits. The result is unsigned (§11.8.1).
                </p>
              ) : null}
            </>
          )}
        </div>
      </PredictionPrompt>
    </VisualFrame>
  );
}
